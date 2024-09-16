import { CrtGpuRenderer } from '@pixagram/upscaler';
import init, { crt_upscale_config, get_memory } from '@pixagram/upscaler/wasm';
// Namespace import so the optional `initThreadPool` export (present only in the
// multi-threaded build) can be feature-detected without breaking single-threaded builds.
import * as upscalerWasm from '@pixagram/upscaler/wasm';

let renderer;
await ensureUpscalerReady();

export default async function upscale(imgd, scale, mode = "CPU") {

    let o;

    if ((""+mode).toUpperCase() === "GPU") {
        if(typeof renderer === "undefined"){
            renderer = CrtGpuRenderer.create();
        }else if(!renderer.isReady()){
            renderer = CrtGpuRenderer.create();
        }
        o = renderer.render(imgd, {
            scale: scale,              // 2-32 (default: 3)
            warpX: 0.015,          // Horizontal curvature (default: 0.015)
            warpY: 0.02,           // Vertical curvature (default: 0.02)
            scanHardness: -4.0,    // Scanline sharpness (default: -4.0)
            scanOpacity: 0.5,      // Scanline intensity (default: 0.5)
            maskOpacity: 0.3,      // Shadow mask intensity (default: 0.3)
            enableWarp: true,      // Enable barrel distortion
            enableScanlines: true, // Enable scanlines
            enableMask: true,      // Enable shadow mask
        });
    } else {
        // WASM/CPU path. When the multi-threaded build is loaded and the thread
        // pool was started in ensureUpscalerReady(), crt_upscale_config fans the
        // per-row work out across the rayon pool automatically. The call site is
        // unchanged — only the internals run in parallel.
        if(typeof renderer?.dispose === "function" ){  renderer.dispose(); }
        const m = get_memory();
        const r = crt_upscale_config(imgd.data, imgd.width, imgd.height, scale, 0.015, 0.02, -4.0, 0.5, 0.3, true, true, true);
        const om = new Uint8ClampedArray(
            m.buffer,
            r.ptr,
            r.len
        );
        o = new ImageData(
            new Uint8ClampedArray(om),
            r.width,
            r.height
        );
    }

    return new ImageData(o.data, o.width, o.height);
}
export function dispose() {
    if(typeof renderer === "undefined"){ return;}
    if(typeof renderer.dispose !== "function" ){ return; }
    return renderer.dispose();
}

/**
 * Initialise the WASM module and, when the multi-threaded build is present,
 * spin up the rayon thread pool. Runs at most once per JS context (the promise
 * is memoised on globalThis) and is safe on every build/page:
 *   - default (single-threaded) build -> initThreadPool isn't exported, skipped
 *   - page without cross-origin isolation -> SharedArrayBuffer unavailable, skipped
 * In every skipped case the module keeps working single-threaded, exactly as before.
 */
function ensureUpscalerReady() {
    return (globalThis.__upscalerReady ??= (async () => {
        await init();
        // `initThreadPool` exists only in the multi-threaded build. Resolve it with a
        // runtime-computed key so bundlers (webpack/Vite/etc.) don't emit an
        // "export 'initThreadPool' was not found" warning against the single-threaded build.
        const initThreadPool = upscalerWasm[["init", "Thread", "Pool"].join("")];
        const canThread =
            typeof initThreadPool === "function" &&
            globalThis.crossOriginIsolated === true;
        if (!canThread) return;
        try {
            const threads = globalThis.navigator?.hardwareConcurrency || 4;
            await initThreadPool(threads);
        } catch (err) {
            console.warn("[upscaler] thread pool init failed; running single-threaded:", err);
        }
    })());
}
