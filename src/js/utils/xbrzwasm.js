import createSVG from "./vtracer";
import { XbrzGpuRenderer, XBRZ_PRESETS } from '@pixagram/upscaler';
import init, {get_memory, xbrz_upscale_config} from '@pixagram/upscaler/wasm';
// Namespace import so the optional `initThreadPool` export (present only in the
// multi-threaded build) can be feature-detected without breaking single-threaded builds.
import * as upscalerWasm from '@pixagram/upscaler/wasm';
await ensureUpscalerReady();

let renderer;
let img = document.createElement("img");
const canvas = new OffscreenCanvas(1, 1);
const canvas2 = new OffscreenCanvas(1, 1);
const context = canvas.getContext("2d", {willReadFrequently: true, powerPreference: "high-performance", desynchronized: "true"});
const context2 = canvas2.getContext("2d", {willReadFrequently: true, powerPreference: "high-performance", desynchronized: "true"});

export default async function upscale(imgd, scale, tempCallback, processN = 1, mode = "GPU") {
    let o;
    if((""+mode).toUpperCase() === "GPU") {

        if(typeof renderer === "undefined"){
            renderer = XbrzGpuRenderer.create();
        }else if(!renderer.isReady()){
            renderer = XbrzGpuRenderer.create();
        }

        o = renderer.render(imgd, {  ...XBRZ_PRESETS.smooth, scale });
    }else {
        // WASM/CPU path. When the multi-threaded build is loaded and the thread
        // pool was started in ensureUpscalerReady(), xbrz_upscale_config splits the
        // destination into stripes and scales them across the rayon pool. The call
        // site is unchanged — only the internals run in parallel.
        if(typeof renderer?.dispose === "function" ){  renderer.dispose(); }
        const m = get_memory();
        const r = xbrz_upscale_config(imgd.data, imgd.width, imgd.height, scale, 40,  4.0, 4.0, 2.4);
        const om = new Uint8Array(
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

    const imgd2 = new ImageData(o.data, o.width, o.height);
    if(scale <= 8){
        return imgd2;
    }else {
        tempCallback(imgd2);
        return Promise.resolve(new Promise(async (resolve, reject) => {
            const svg_url = await createSVG(imgd2, "blob", processN);
            const scaleUp = Math.ceil(scale / Math.round(Math.min(scale, 6)));
            const newWidth = Math.round(imgd2.width * scaleUp);
            const newHeight = Math.round(imgd2.height * scaleUp);
            canvas2.width = imgd2.width;
            canvas2.height = imgd2.height;
            canvas.width = newWidth;
            canvas.height = newHeight;
            img.onload = () => {
                context2.putImageData(imgd2, 0, 0);
                context.drawImage(canvas2, 0, 0, canvas2.width, canvas2.height, 0, 0, canvas.width, canvas.height);
                context.drawImage(img, 0, 0, img.naturalWidth || img.width, img.naturalHeight || img.height, 0, 0, canvas.width, canvas.height);
                resolve(context.getImageData(0, 0, canvas.width, canvas.height));
                URL.revokeObjectURL(svg_url);
            };
            img.src = svg_url;
        }));
    }
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
