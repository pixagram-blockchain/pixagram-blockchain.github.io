/**
 * render-pool.js — unified upscaling pool.
 *
 * Merges the former hexagonrenderwasm.js / crtWebgl.js / xbrzwasm.js /
 * render-pool.js into a single module and adds the TRI algorithm
 * (triangulated upscaler, original to @pixagram/upscaler, MIT) on both
 * paths:
 *   - GPU (WebGL2):  TriGpuRenderer
 *   - CPU (WASM):    tri_upscale_config
 *
 * Public API (unchanged + triF):
 *   xbrzF(image_data, scale, callback, terminate, id, mode)
 *   hexF (image_data, scale, callback, terminate, id, mode)
 *   crtF (image_data, scale, callback, terminate, id, mode)
 *   sqrF (image_data, scale, callback, terminate, id, mode)
 *   triF (image_data, scale, callback, terminate, id, mode)   // NEW
 *   cutF — compatibility alias for triF
 *   releaseId(id)                       // drops callbacks, KEEPS cached renders
 *   getCachedRender(id, algo, scale)    // cache-first lookup (skip decode+upscale)
 *   acquireCachedBitmap(id, algo, scale)  // consumer-owned bitmap for a cached render
 *   acquireBestCachedBitmap(id, algo)     // …at the largest cached scale for this id
 *   clearRenderCache()
 *   configureRenderCache({maxEntries, maxBytes, maxBitmaps, maxBitmapBytes})
 *   configureGpuGuard({maxOutputPixels})
 *   window.__PIXA_RENDER_POOL_STATS__()
 *
 * Render cache: the last MAX_CACHED_RENDERS (default 40) finished
 * upscales are retained as ImageData in a global LRU and survive card
 * unmount, so scrolling back repaints without re-decoding or
 * re-upscaling.
 *
 * Master-bitmap layer: repeat serves of a cached render used to pay a
 * full ImageData→ImageBitmap raster every time (bitmaps are
 * single-consumer: transferFromImageBitmap detaches whatever the
 * consumer gets, so nothing handed out can be kept). The pool now pins
 * a pool-owned "master" ImageBitmap the first time a cached render is
 * RE-served (mint-on-hit — cold first paints cost exactly what they did
 * before), and every serve after that is a cheap bitmap→bitmap clone
 * instead of a raster. The master itself never leaves the pool, so no
 * consumer can detach it; consumers always receive their own clone.
 * Masters live under their own count/byte budget and are closed on
 * eviction independently of their ImageData, which stays and simply
 * re-mints a master on the next hit. This is what makes the dialog's
 * hero animation reactive on reopens and revisits: the flight starts
 * from a ~1 ms clone instead of a decode + upscale (or a multi-MB
 * raster).
 *
 * GPU size guard: what crashes the GPU is never the scale factor itself
 * but the output surface it implies (imgd.width*scale × imgd.height*scale
 * RGBA). Before any GPU render the pool checks those output dimensions
 * against the device's probed texture/renderbuffer/viewport limit and a
 * configurable pixel budget; oversized jobs silently take the WASM path
 * instead of resetting the driver.
 *
 * TRI preserves alpha (interpolation runs on premultiplied RGBA), so
 * transparent pixel art stays transparent.
 */

import createSVG from "./vtracer";
import {
    CrtGpuRenderer,
    HexGpuRenderer,
    XbrzGpuRenderer,
    XBRZ_PRESETS,
} from '@pixagram/upscaler';
import init, {
    get_memory,
    crt_upscale_config,
    hex_upscale_config,
    tri_upscale_config,
    xbrz_upscale_config,
} from '@pixagram/upscaler/wasm';
// Namespace import so the optional `initThreadPool` export (present only in the
// multi-threaded build) can be feature-detected without breaking single-threaded builds.
import * as upscalerWasm from '@pixagram/upscaler/wasm';

await ensureUpscalerReady();

// ── WASM bootstrap ────────────────────────────────────────────────────
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

/**
 * Copy a WASM upscale result out of linear memory into a fresh ImageData.
 * The copy is required: the view aliases WASM memory, which is reused by the
 * next call and detached whenever the heap grows.
 */
function wasmResultToImageData(r) {
    const m = get_memory();
    const view = new Uint8ClampedArray(m.buffer, r.ptr, r.len);
    return new ImageData(new Uint8ClampedArray(view), r.width, r.height);
}

// ── GPU renderer lifecycle (one lazy singleton per algorithm) ────────
const gpuFactories = {
    crt:  () => CrtGpuRenderer.create(),
    hex:  () => HexGpuRenderer.create(),
    xbrz: () => XbrzGpuRenderer.create(),
};

const gpuRenderers = {};

/**
 * Lazily create (or re-create after a lost WebGL context / dispose) the GPU
 * renderer for an algorithm. The stale instance is disposed first so the
 * shared-context reference count doesn't leak across re-creations.
 */
function getGpuRenderer(algo) {
    let r = gpuRenderers[algo];
    if (!r || !r.isReady()) {
        if (r && typeof r.dispose === "function") {
            try { r.dispose(); } catch (e) {}
        }
        r = gpuRenderers[algo] = gpuFactories[algo]();
    }
    return r;
}

function disposeGpu(algo) {
    const r = gpuRenderers[algo];
    if (r && typeof r.dispose === "function") {
        try { r.dispose(); } catch (e) {}
    }
    gpuRenderers[algo] = undefined;
}

/** Dispose every GPU renderer except `keep` (pass null to dispose all). */
function disposeGpuExcept(keep) {
    for (const algo of Object.keys(gpuFactories)) {
        if (algo !== keep) disposeGpu(algo);
    }
}

function disposeAll() {
    disposeGpuExcept(null);
}

// ── GPU size guard ───────────────────────────────────────────────────
// The scale factor isn't what crashes the GPU — the output surface is:
// outW = imgd.width * scale, outH = imgd.height * scale. Past
// MAX_TEXTURE_SIZE the allocation fails or resets the driver; even
// inside the limit a huge RGBA target (outW*outH*4 bytes) can exhaust
// VRAM or run the draw long enough to trip the OS watchdog (TDR).
// Probe the device limits once, then gate every GPU path on the OUTPUT
// dimensions; oversized jobs take the WASM path instead.
let gpuLimitsCache = null;

function getGpuLimits() {
    if (gpuLimitsCache) return gpuLimitsCache;
    let maxDim = 4096; // conservative floor if probing fails
    try {
        const gl = new OffscreenCanvas(1, 1).getContext("webgl2");
        if (gl) {
            maxDim = Math.min(
                gl.getParameter(gl.MAX_TEXTURE_SIZE),
                gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
            );
            const vp = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
            if (vp && vp.length >= 2) maxDim = Math.min(maxDim, vp[0], vp[1]);
            const lose = gl.getExtension("WEBGL_lose_context");
            if (lose) lose.loseContext(); // release the probe context now
        }
    } catch (e) {}
    gpuLimitsCache = { maxDim };
    return gpuLimitsCache;
}

// Budget BELOW the hard limit: 16k×16k is legal on most desktops yet
// still ~1 GiB RGBA — enough to reset a weak driver on its own.
// 16 MP output ≈ 64 MB. Tune per device tier via configureGpuGuard.
let MAX_GPU_OUTPUT_PIXELS = 16 * 1024 * 1024;

/** Tune the GPU output budget at runtime (e.g. lower on weak devices). */
export function configureGpuGuard({ maxOutputPixels } = {}) {
    if (Number.isFinite(maxOutputPixels) && maxOutputPixels > 0) {
        MAX_GPU_OUTPUT_PIXELS = maxOutputPixels;
    }
}

/** True when imgd × scale fits the GPU (dimension limit + pixel budget). */
function gpuCanHandle(imgd, scale) {
    const outW = imgd.width * scale;
    const outH = imgd.height * scale;
    if (!(outW > 0) || !(outH > 0)) return false;
    const { maxDim } = getGpuLimits();
    if (outW > maxDim || outH > maxDim) return false;
    if (outW * outH > MAX_GPU_OUTPUT_PIXELS) return false;
    return true;
}

// ── Per-algorithm upscalers (GPU / WASM) ─────────────────────────────

async function crtUpscale(imgd, scale, mode = "CPU") {
    let o;
    if (("" + mode).toUpperCase() === "GPU" && scale < 6 && gpuCanHandle(imgd, scale)) {
        o = getGpuRenderer("crt").render(imgd, {
            scale: scale,          // 2-32 (default: 3)
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
        // WASM/CPU path. With the multi-threaded build + started pool, the
        // kernel fans per-row work across rayon automatically.
        disposeGpu("crt");
        const r = crt_upscale_config(imgd.data, imgd.width, imgd.height, scale,
            0.015, 0.02, -4.0, 0.5, 0.3, true, true, true);
        // wasmResultToImageData already returns a fresh ImageData — no re-wrap.
        return wasmResultToImageData(r);
    }
    return new ImageData(o.data, o.width, o.height);
}

async function hexUpscale(imgd, scale, mode = "CPU") {
    let o;
    if (("" + mode).toUpperCase() === "GPU" && scale < 8 && gpuCanHandle(imgd, scale)) {
        o = getGpuRenderer("hex").render(imgd, {
            scale,
            orientation: 'flat-top',
            drawBorders: false,
            borderColor: "#00000000",
            borderThickness: 0,
            backgroundColor: "#00000000",
        });
    } else {
        disposeGpu("hex");
        // The raw wasm export takes numbers, not the strings the GPU options
        // accept: orientation 0 = flat-top (1 = pointy-top), colors are
        // 0xRRGGBBAA u32 values. The old per-file version passed strings here
        // and only worked through implicit >>>0 coercion to 0.
        const r = hex_upscale_config(imgd.data, imgd.width, imgd.height, scale,
            /* orientation  */ 0,
            /* draw_borders */ false,
            /* border_color */ 0x00000000,
            /* thickness    */ 0,
            /* background   */ 0x00000000);
        return wasmResultToImageData(r);
    }
    return new ImageData(o.data, o.width, o.height);
}

// xBRZ keeps its hybrid pipeline: native xBRZ up to 8x, then a vtracer SVG
// composite for larger factors. Reused scratch surfaces below.
let xbrzImg = null;
let xbrzCanvas = null;
let xbrzCanvas2 = null;
let xbrzContext = null;
let xbrzContext2 = null;

function ensureXbrzScratch() {
    if (xbrzCanvas) return;
    xbrzImg = document.createElement("img");
    xbrzCanvas = new OffscreenCanvas(1, 1);
    xbrzCanvas2 = new OffscreenCanvas(1, 1);
    xbrzContext = xbrzCanvas.getContext("2d", { willReadFrequently: true, powerPreference: "high-performance", desynchronized: "true" });
    xbrzContext2 = xbrzCanvas2.getContext("2d", { willReadFrequently: true, powerPreference: "high-performance", desynchronized: "true" });
}

async function xbrzUpscale(imgd, scale, tempCallback, processN = 1, mode = "GPU") {
    let imgd2;
    // 8x is included in the GPU gate: the size guard, not the scale
    // ceiling, is what keeps the driver alive — a small sprite at 8x is a
    // trivial target, a large input reroutes to WASM before allocation.
    if (("" + mode).toUpperCase() === "GPU" && scale <= 8 && gpuCanHandle(imgd, scale)) {
        const o = getGpuRenderer("xbrz").render(imgd, { ...XBRZ_PRESETS.smooth, scale });
        imgd2 = new ImageData(o.data, o.width, o.height);
    } else {
        disposeGpu("xbrz");
        // Same values as XBRZ_PRESETS.smooth:
        // (tolerance, centerBias, dominantThreshold, steepThreshold)
        const r = xbrz_upscale_config(imgd.data, imgd.width, imgd.height, scale,
            40, 4.0, 4.0, 2.4);
        // wasmResultToImageData already returns a fresh ImageData — no re-wrap.
        imgd2 = wasmResultToImageData(r);
    }

    if (scale <= 8) {
        return imgd2;
    }

    // scale > 8: hand the 8x result over immediately, then refine through
    // the vtracer SVG path and resolve with the composited final image.
    tempCallback(imgd2);
    ensureXbrzScratch();
    let svg_url;
    try {
        svg_url = await createSVG(imgd2, "blob", processN);
    } catch (e) {
        // vtracer failed — keep the 8x result instead of hanging the pipeline.
        console.warn("[render-pool] createSVG failed; keeping 8x xbrz result:", e);
        return imgd2;
    }
    return new Promise((resolve) => {
        const scaleUp = Math.ceil(scale / Math.round(Math.min(scale, 8)));
        const newWidth = Math.round(imgd2.width * scaleUp);
        const newHeight = Math.round(imgd2.height * scaleUp);
        xbrzCanvas2.width = imgd2.width;
        xbrzCanvas2.height = imgd2.height;
        xbrzCanvas.width = newWidth;
        xbrzCanvas.height = newHeight;
        xbrzImg.onload = () => {
            xbrzContext2.putImageData(imgd2, 0, 0);
            xbrzContext.drawImage(xbrzCanvas2, 0, 0, xbrzCanvas2.width, xbrzCanvas2.height, 0, 0, xbrzCanvas.width, xbrzCanvas.height);
            xbrzContext.drawImage(xbrzImg, 0, 0, xbrzImg.naturalWidth || xbrzImg.width, xbrzImg.naturalHeight || xbrzImg.height, 0, 0, xbrzCanvas.width, xbrzCanvas.height);
            resolve(xbrzContext.getImageData(0, 0, xbrzCanvas.width, xbrzCanvas.height));
            URL.revokeObjectURL(svg_url);
        };
        // If the SVG fails to decode, don't hang the pipeline (the old code
        // left the promise pending and leaked the blob URL): release the URL
        // and settle with the 8x result the consumer already received.
        xbrzImg.onerror = () => {
            URL.revokeObjectURL(svg_url);
            resolve(imgd2);
        };
        xbrzImg.src = svg_url;
    });
}

// ── Square (nearest-neighbor) upscaler ────────────────────────────────
// Same output as before; runs on main thread. The two canvases are now
// reused scratch surfaces (mirrors the xbrz scratch pattern) instead of
// fresh DOM canvases per call, and willReadFrequently keeps them
// software-backed so getImageData doesn't stall on a GPU sync each time.
let sqrCanvas = null;
let sqrCanvas2 = null;
let sqrContext = null;
let sqrContext2 = null;

function ensureSqrScratch() {
    if (sqrCanvas) return;
    sqrCanvas = new OffscreenCanvas(1, 1);
    sqrCanvas2 = new OffscreenCanvas(1, 1);
    sqrContext = sqrCanvas.getContext("2d", { willReadFrequently: true });
    sqrContext2 = sqrCanvas2.getContext("2d", { willReadFrequently: true });
}

function upscale_square(imgd, scale) {
    ensureSqrScratch();
    sqrCanvas.width = imgd.width * scale;
    sqrCanvas.height = imgd.height * scale;
    sqrCanvas2.width = imgd.width;
    sqrCanvas2.height = imgd.height;
    // Resizing a canvas resets its context state — re-apply after sizing.
    sqrContext.imageSmoothingEnabled = false;
    sqrContext2.imageSmoothingEnabled = false;
    sqrContext2.putImageData(imgd, 0, 0);
    sqrContext.drawImage(sqrCanvas2, 0, 0, sqrCanvas2.width, sqrCanvas2.height, 0, 0, sqrCanvas.width, sqrCanvas.height);
    return sqrContext.getImageData(0, 0, sqrCanvas.width, sqrCanvas.height);
}

// ── Worker manager ────────────────────────────────────────────────────
// Workers are created once and reused. `onmessage` is wired at creation
// time and routes every reply through the module-level `received()`
// function — we never overwrite `onmessage` per request, so closures from
// past requests don't pin state across postMessage round-trips.
class WorkerManager {
    constructor(scripts) {
        this.workers = new Map(); // workerName -> { worker, type }
        this.workerScripts = scripts;
    }

    createWorker(workerName, workerScript, isShared = false) {
        if (this.workers.has(workerName)) {
            return this.workers.get(workerName).worker;
        }

        const blob = new Blob([workerScript], { type: 'application/javascript' });
        const workerURL = URL.createObjectURL(blob);
        let worker;

        if (isShared) {
            worker = new SharedWorker(workerURL);
            worker.port.onmessage = (event) => {
                // event.data is [imgd, id, algorithm]
                received(event.data[0], event.data[1], event.data[2]);
            };
            worker.port.start();
        } else {
            worker = new Worker(workerURL);
            worker.onmessage = (event) => {
                received(event.data[0], event.data[1], event.data[2]);
            };
        }

        // The Blob URL is no longer needed once the worker has been
        // instantiated; release it so it doesn't leak in document state.
        try { URL.revokeObjectURL(workerURL); } catch (e) {}

        this.workers.set(workerName, { worker, type: isShared ? 'shared' : 'dedicated' });
        return worker;
    }

    sendDataToWorker(workerName, data, options = {}, id) {
        let workerObj = this.workers.get(workerName);
        if (!workerObj) {
            if (typeof this.workerScripts[workerName] !== "undefined") {
                this.createWorker(workerName, this.workerScripts[workerName], false);
                workerObj = this.workers.get(workerName);
            } else {
                throw new Error(`Worker ${workerName} not found`);
            }
        }

        const { worker, type } = workerObj;
        const message = { type: options.type || 'default', data, id, algorithm: workerName };
        const transferables = [];

        if (options.type === 'canvas') {
            const offscreen = options.canvas.transferControlToOffscreen();
            message.canvas = offscreen;
            transferables.push(offscreen);
        } else if (options.type === 'sharedBuffer') {
            message.sharedArrayBuffer = options.sharedArrayBuffer;
            transferables.push(options.sharedArrayBuffer);
        } else if (options.type === 'imageData') {
            message.imageData = data.data;
        }

        if (type === 'dedicated') {
            worker.postMessage(message, transferables);
        } else if (type === 'shared') {
            worker.port.postMessage(message, transferables);
        }
    }

    terminateWorker(workerName) {
        const workerObj = this.workers.get(workerName);
        if (workerObj) {
            if (workerObj.type === 'dedicated') {
                workerObj.worker.onmessage = null;
                workerObj.worker.terminate();
            } else if (workerObj.type === 'shared') {
                workerObj.worker.port.onmessage = null;
                workerObj.worker.port.close();
            }
            this.workers.delete(workerName);
        }
    }
}

const manager = new WorkerManager({});

// ── Per-algorithm state ──────────────────────────────────────────────
// callbacks[id]  → consumer callback (closes over a DOM canvas — must be
//                  cleared aggressively on consumer unmount via releaseId)
// data[id]       → cached upscaled ImageData (the render cache)
// timestamp[id]  → LRU recency tick for the render cache
// bitmaps[id]    → { bmp, bytes } pool-owned master ImageBitmap for the
//                  same key (mint-on-hit; see serveBitmap below)
//
// The ImageData remains the source of truth. A master bitmap is only an
// accelerator: it is NEVER handed to a consumer (a consumer's
// bitmaprenderer context would detach it via transferFromImageBitmap
// and close() it — the failure mode the old bitmap cache died of).
// Consumers always receive a fresh clone of the master; the master
// stays home, is validated for detachment on every access, and is
// closed on eviction while its ImageData lives on.
const ALGORITHMS = ['xbrz', 'hex', 'crt', 'tri', 'sqr'];

let workerState = {
    xbrz: { worker: false, callbacks: {}, data: {}, timestamp: {}, bitmaps: {} },
    hex:  { worker: false, callbacks: {}, data: {}, timestamp: {}, bitmaps: {} },
    sqr:  { worker: false, callbacks: {}, data: {}, timestamp: {}, bitmaps: {} },
    crt:  { worker: false, callbacks: {}, data: {}, timestamp: {}, bitmaps: {} },
    tri:  { worker: false, callbacks: {}, data: {}, timestamp: {}, bitmaps: {} },
};

// ── Render cache policy ──────────────────────────────────────────────
// The cache answers one question: "did we already upscale this exact
// content at this exact scale with this exact algorithm?" Keys are
// `${contentHash}-${algorithm}-${scale}`, so column-width changes and
// renderer switches miss cleanly and coexist.
//
// Retention is bounded two ways:
//   MAX_CACHED_RENDERS — keep the N most recently used finished renders,
//                        global across algorithms. This is the "scroll
//                        back through the last screens instantly" budget.
//   MAX_CACHED_BYTES   — safety ceiling so a burst of unusually large
//                        outputs can't pile up N × multi-MB surfaces.
// Recency uses a monotonic tick rather than Date.now()|0 — the old int32
// truncation of an epoch timestamp overflows and can misorder the LRU.
let workerStateSize = 0;   // bytes of cached ImageData across the pool
let workerStateCount = 0;  // number of cached renders across the pool
let lruTick = 0;

let MAX_CACHED_RENDERS = 40;
let MAX_CACHED_BYTES = 128 * 1024 * 1024;

// Master-bitmap budget — separate and smaller than the ImageData budget
// because bitmaps typically live in GPU/driver memory. Recency rides the
// SAME timestamp table as the render cache (a serve bumps both), so the
// masters kept hot are exactly the renders being re-served.
let bitmapBytes = 0;       // bytes of pinned master bitmaps (w*h*4)
let bitmapCount = 0;
let MAX_CACHED_BITMAPS = 16;
let MAX_CACHED_BITMAP_BYTES = 64 * 1024 * 1024;

/** Tune render-cache bounds at runtime (e.g. lower on constrained devices). */
export function configureRenderCache({ maxEntries, maxBytes, maxBitmaps, maxBitmapBytes } = {}) {
    if (Number.isFinite(maxEntries) && maxEntries >= 0) MAX_CACHED_RENDERS = maxEntries | 0;
    if (Number.isFinite(maxBytes) && maxBytes >= 0) MAX_CACHED_BYTES = maxBytes;
    if (Number.isFinite(maxBitmaps) && maxBitmaps >= 0) MAX_CACHED_BITMAPS = maxBitmaps | 0;
    if (Number.isFinite(maxBitmapBytes) && maxBitmapBytes >= 0) MAX_CACHED_BITMAP_BYTES = maxBitmapBytes;
    trimRenderCache();
    trimBitmaps();
}

// Switching algorithms: terminate the workers for inactive algorithms
// and drop their callbacks. Cached renders are kept — the LRU evicts
// them, and they're what makes switching back cheap.
function terminateOtherWorkers(currentWorker) {
    for (const worker in workerState) {
        if (worker !== currentWorker) {
            manager.terminateWorker(worker);
            workerState[worker].callbacks = {};
        }
    }
}

/** Remove one cached render and fix the global accounting. */
function dropEntry(algorithm, key) {
    const state = workerState[algorithm];
    dropMaster(algorithm, key); // a master never outlives its ImageData
    const entry = state.data[key];
    if (entry === undefined) return;
    workerStateSize -= (entry && entry.data && entry.data.byteLength) | 0;
    workerStateCount -= 1;
    delete state.data[key];
    delete state.timestamp[key];
    if (workerStateSize < 0) workerStateSize = 0;
    if (workerStateCount < 0) workerStateCount = 0;
}

// ── Master bitmaps (mint-on-hit accelerator) ─────────────────────────

/** The pool-owned master ImageBitmap for a key, or null. Self-heals: a
 *  master that reads as detached (width 0 — someone transferred or
 *  closed a borrowed reference) is dropped instead of served. */
function getMaster(algorithm, key) {
    const rec = workerState[algorithm].bitmaps[key];
    if (!rec) return null;
    if (!rec.bmp || !(rec.bmp.width > 0)) { dropMaster(algorithm, key); return null; }
    return rec.bmp;
}

/** Unpin + close a master. Accounting uses the bytes recorded at adopt
 *  time, so a detached bitmap (width 0) still balances the books. */
function dropMaster(algorithm, key) {
    const state = workerState[algorithm];
    const rec = state.bitmaps[key];
    if (!rec) return;
    delete state.bitmaps[key];
    bitmapBytes -= rec.bytes | 0;
    bitmapCount -= 1;
    if (bitmapBytes < 0) bitmapBytes = 0;
    if (bitmapCount < 0) bitmapCount = 0;
    try { rec.bmp && rec.bmp.close && rec.bmp.close(); } catch (e) {}
}

/** Pin `bmp` as the master for a key (replacing any previous master —
 *  the xbrz>8x path overwrites the 8x preview with the SVG composite,
 *  and the master must follow the pixels). Then trim to budget without
 *  evicting the key just adopted. */
function adoptMaster(algorithm, key, bmp) {
    if (!bmp || !(bmp.width > 0)) return;
    dropMaster(algorithm, key);
    const bytes = bmp.width * bmp.height * 4;
    workerState[algorithm].bitmaps[key] = { bmp, bytes };
    bitmapBytes += bytes;
    bitmapCount += 1;
    trimBitmaps(algorithm, key);
}

/** Evict the least recently used master across ALL algorithms (recency =
 *  the shared render-cache timestamps), never touching the protected key. */
function evictOldestBitmap(protectAlgo, protectKey) {
    let bestAlgo = null, bestKey = null, bestVal = Infinity;
    for (let i = 0; i < ALGORITHMS.length; i++) {
        const a = ALGORITHMS[i];
        const bitmaps = workerState[a].bitmaps;
        const ts = workerState[a].timestamp;
        for (const k in bitmaps) {
            if (a === protectAlgo && k === protectKey) continue;
            const t = ts[k] !== undefined ? ts[k] : -1;
            if (t < bestVal) { bestVal = t; bestAlgo = a; bestKey = k; }
        }
    }
    if (bestKey === null) return false;
    dropMaster(bestAlgo, bestKey);
    return true;
}

function trimBitmaps(protectAlgo, protectKey) {
    while (bitmapCount > MAX_CACHED_BITMAPS || bitmapBytes > MAX_CACHED_BITMAP_BYTES) {
        if (!evictOldestBitmap(protectAlgo, protectKey)) break;
    }
}

/**
 * Serve a consumer-owned ImageBitmap for a cached render, through the
 * master layer: the first serve per key pays one ImageData→bitmap raster
 * and pins the result as the pool's master; every serve after that is a
 * cheap bitmap→bitmap clone. Whatever this resolves to belongs to the
 * caller (safe to transferFromImageBitmap / close) — never the master.
 *
 * Concurrency note: two simultaneous first-serves of one key can both
 * mint; the second adopt replaces (closes) the first master, and the
 * loser's clone then rejects and falls back to a direct re-raster. Rare,
 * benign, and cheaper to tolerate than to serialize.
 */
async function serveBitmap(algorithm, key, imageData) {
    const existing = getMaster(algorithm, key);
    if (existing) {
        try { return await createImageBitmap(existing); }
        catch (e) { dropMaster(algorithm, key); /* closed under us — re-mint below */ }
    }
    const minted = await createImageBitmap(imageData, 0, 0, imageData.width, imageData.height);
    const bytes = minted.width * minted.height * 4;
    // Never pin a master that alone busts the budget (a 32x render of a
    // large source can be tens of MB) — serve it uncached instead.
    if (bytes > MAX_CACHED_BITMAP_BYTES) return minted;
    adoptMaster(algorithm, key, minted);
    if (!getMaster(algorithm, key)) return minted; // budget rejected the pin
    try {
        return await createImageBitmap(minted);
    } catch (e) {
        // Clone failed (context loss / detach race) — the pin is unusable.
        dropMaster(algorithm, key);
        return await createImageBitmap(imageData, 0, 0, imageData.width, imageData.height);
    }
}

// Evict the least recently used render across ALL algorithms. Callbacks
// are untouched: cache eviction must never cancel a live consumer (the
// old implementation deleted callbacks here, which under memory pressure
// could drop the final xbrz>8x composite for a still-mounted card).
function evictOldestGlobal() {
    let bestAlgo = null;
    let bestKey = null;
    let bestVal = Infinity;
    for (let i = 0; i < ALGORITHMS.length; i++) {
        const ts = workerState[ALGORITHMS[i]].timestamp;
        for (const k in ts) {
            if (ts[k] < bestVal) { bestVal = ts[k]; bestAlgo = ALGORITHMS[i]; bestKey = k; }
        }
    }
    if (bestKey === null) return false;
    dropEntry(bestAlgo, bestKey);
    return true;
}

function trimRenderCache() {
    while (workerStateCount > MAX_CACHED_RENDERS || workerStateSize > MAX_CACHED_BYTES) {
        if (!evictOldestGlobal()) break;
    }
}

/** Drop every cached render (does not touch live callbacks). */
export function clearRenderCache() {
    for (const algo of ALGORITHMS) {
        const bitmaps = workerState[algo].bitmaps;
        for (const k in bitmaps) {
            try { bitmaps[k].bmp && bitmaps[k].bmp.close && bitmaps[k].bmp.close(); } catch (e) {}
        }
        workerState[algo].bitmaps = {};
        workerState[algo].data = {};
        workerState[algo].timestamp = {};
    }
    workerStateSize = 0;
    workerStateCount = 0;
    bitmapBytes = 0;
    bitmapCount = 0;
}

/**
 * Cache-first lookup. Returns the finished upscaled ImageData for
 * id+algorithm+scale and bumps its recency, or undefined on a miss.
 * A consumer that hits here can skip the ENTIRE source pipeline for this
 * draw — no base64 decode, no PNG/WEBP decode, no upscale — and just
 * mint a bitmap from the returned ImageData. The returned ImageData is
 * pool-owned and must not be mutated.
 */
export function getCachedRender(id, algorithm, scale) {
    const state = workerState[algorithm];
    if (!state) return undefined;
    const key = id + "-" + algorithm + "-" + scale;
    const hit = state.data[key];
    if (hit !== undefined) state.timestamp[key] = ++lruTick;
    return hit;
}

/**
 * Consumer-owned bitmap for a cached render. Returns null SYNCHRONOUSLY
 * on a miss (so callers can branch without awaiting), else a Promise of
 * { imgd, bitmap, scale } where `bitmap` is the caller's to consume
 * (transferFromImageBitmap / close) and `imgd` is the pool-owned
 * ImageData (read-only, as with getCachedRender). First call per key
 * pays one raster and pins the master; later calls are cheap clones.
 */
export function acquireCachedBitmap(id, algorithm, scale) {
    const state = workerState[algorithm];
    if (!state) return null;
    const key = id + "-" + algorithm + "-" + scale;
    const imgd = state.data[key];
    if (imgd === undefined) return null;
    state.timestamp[key] = ++lruTick;
    return serveBitmap(algorithm, key, imgd).then((bitmap) => ({ imgd, bitmap, scale }));
}

/**
 * Like acquireCachedBitmap, but at the LARGEST scale the pool still
 * holds for id+algorithm. This is the hero's fallback source: when the
 * clicked card's canvas is gone (virtualized away, reopen after close,
 * deep link back), the freshest pixels available are usually the card-
 * or dialog-scale render already sitting in the LRU — fly those and let
 * the sharper pass run after landing. Null synchronously on a total miss.
 */
export function acquireBestCachedBitmap(id, algorithm) {
    const state = workerState[algorithm];
    if (!state) return null;
    const prefix = id + "-" + algorithm + "-";
    let bestKey = null;
    let bestScale = -Infinity;
    for (const k in state.data) {
        if (!k.startsWith(prefix)) continue;
        const s = parseFloat(k.slice(prefix.length));
        if (Number.isFinite(s) && s > bestScale) { bestScale = s; bestKey = k; }
    }
    if (bestKey === null) return null;
    const imgd = state.data[bestKey];
    state.timestamp[bestKey] = ++lruTick;
    return serveBitmap(algorithm, bestKey, imgd).then((bitmap) => ({ imgd, bitmap, scale: bestScale }));
}

// ── Worker reply handler ─────────────────────────────────────────────
// Caches the finished render, then routes a consumer-owned bitmap to the
// registered callback (if one is still mounted).
async function received(r, id2, algorithm2) {
    const state = workerState[algorithm2];
    if (!state || !r) return;

    // 1) Cache the ImageData — even when the consumer has already
    // unmounted. Virtualized feeds release cards freely while renders
    // are in flight; retaining the result is the point of the render
    // cache (scrolling back repaints from here with zero recompute), and
    // ImageData holds no DOM or GPU handles, so retention is safe under
    // the LRU bounds. (The xbrz>8x path calls this twice per id — the 8x
    // preview, then the SVG composite — the accounting handles the
    // overwrite.)
    if (state.data[id2] !== undefined) {
        workerStateSize -= (state.data[id2].data && state.data[id2].data.byteLength) | 0;
        workerStateCount -= 1;
        // The pixels for this key are being replaced (xbrz>8x: the SVG
        // composite overwrites the 8x preview) — a master minted off the
        // old pixels would serve stale content, so it dies with them.
        dropMaster(algorithm2, id2);
    }
    state.data[id2] = r;
    state.timestamp[id2] = ++lruTick;
    workerStateSize += (r.data && r.data.byteLength) | 0;
    workerStateCount += 1;
    trimRenderCache();

    // 2) Serve the live consumer, if any, with a bitmap of its own.
    const cb = state.callbacks[id2];
    if (typeof cb !== "function") return;

    let bmp;
    try {
        bmp = await createImageBitmap(r, 0, 0, r.width, r.height);
    } catch (e) {
        // If bitmap creation fails, still hand the ImageData to the
        // consumer — its fallback path can drawImage from ImageData.
        cb(r, undefined);
        return;
    }

    // Re-check after the await: consumer may have unmounted while we
    // were awaiting createImageBitmap.
    const cbStill = state.callbacks[id2];
    if (typeof cbStill !== "function") {
        try { bmp.close && bmp.close(); } catch (e) {}
        return;
    }
    cbStill(r, bmp);
}

// ── Main entry ────────────────────────────────────────────────────────
async function processWorker(algorithm, image_data, scale, callback, terminate = false, id, mode = "GPU") {
    const fullId = id + "-" + algorithm + "-" + scale;
    terminateOtherWorkers(algorithm);
    workerState[algorithm].callbacks[fullId] = callback;

    // Cache hit: serve from the cached ImageData with a freshly minted
    // bitmap. (The old path handed out the cached bitmap object itself,
    // which the consumer then detached via transferFromImageBitmap and
    // close()d — poisoning the cache for every later hit on that key.)
    const cached = workerState[algorithm].data[fullId];
    if (typeof cached !== "undefined") {
        workerState[algorithm].timestamp[fullId] = ++lruTick;
        // A hit is hot by definition — serve through the master layer:
        // the first hit pays the raster once and pins it, every later
        // hit is a cheap bitmap→bitmap clone (see serveBitmap).
        serveBitmap(algorithm, fullId, cached)
            .then((bmp) => {
                const cb = workerState[algorithm].callbacks[fullId];
                if (typeof cb !== "function") {
                    try { bmp.close && bmp.close(); } catch (e) {}
                    return;
                }
                try { cb(cached, bmp); } catch (e) {}
            })
            .catch(() => {
                const cb = workerState[algorithm].callbacks[fullId];
                if (typeof cb === "function") {
                    try { cb(cached, undefined); } catch (e) {}
                }
            });
        return;
    }

    if (workerState[algorithm].worker) {
        manager.sendDataToWorker(algorithm, {
            data: image_data,
            scale: scale,
        }, {
            type: 'imageData',
        }, fullId);
        return;
    }

    // Main-thread WASM/WebGL path. In CPU mode no GPU renderer should stay
    // alive; in GPU mode the just-used renderer is kept and the others are
    // released (they all share one WebGL context, so this trims textures,
    // not contexts). Whether a GPU-eligible call actually renders on the
    // GPU is decided inside each upscaler: mode + scale gate + gpuCanHandle
    // (the output-size guard) — an oversized job falls through to WASM.
    if (mode !== "GPU") {
        disposeAll();
    }

    if (algorithm === "hex") {
        const imgd = await hexUpscale(image_data, scale, mode);
        await received(imgd, fullId, algorithm);
        disposeGpuExcept("hex");
    } else if (algorithm === "xbrz") {
        // Only the xbrz/vtracer path consumes the live-callback count.
        const n = Object.keys(workerState[algorithm].callbacks).length;
        const imgd = await xbrzUpscale(image_data, scale, (tempImgd) => { received(tempImgd, fullId, algorithm); }, n, mode);
        await received(imgd, fullId, algorithm);
        disposeGpuExcept("xbrz");
    } else if (algorithm === "crt") {
        const imgd = await crtUpscale(image_data, scale, mode);
        await received(imgd, fullId, algorithm);
        disposeGpuExcept("crt");
    } else if (algorithm === "tri") {
        const imgd = await triUpscale(image_data, scale, mode);
        await received(imgd, fullId, algorithm);
        disposeGpuExcept("tri");
    } else if (algorithm === "sqr") {
        disposeAll();
        const imgd = await upscale_square(image_data, scale);
        await received(imgd, fullId, algorithm);
    }
}

// ── Public API: per-algorithm shortcuts ──────────────────────────────
export function xbrzF(image_data, scale, callback, terminate, id, mode) {
    processWorker('xbrz', image_data, scale, callback, terminate, id, mode);
}

export function hexF(image_data, scale, callback, terminate, id, mode) {
    processWorker('hex', image_data, scale, callback, terminate, id, mode);
}

export function crtF(image_data, scale, callback, terminate, id, mode) {
    processWorker('crt', image_data, scale, callback, terminate, id, mode);
}

export function triF(image_data, scale, callback, terminate, id, mode) {
    processWorker('tri', image_data, scale, callback, terminate, id, mode);
}

// Compatibility alias for earlier integrations; routes to TRI.
export function cutF(image_data, scale, callback, terminate, id, mode) {
    processWorker('tri', image_data, scale, callback, terminate, id, mode);
}

export function sqrF(image_data, scale, callback, terminate, id, mode) {
    processWorker('sqr', image_data, scale, callback, terminate, id, mode);
}

// ── Public API: consumer lifecycle ───────────────────────────────────
// Call this from a component's unmount cleanup. It releases the pool's
// reference to the consumer CALLBACK — the closure that pins a DOM
// canvas, which is the actual leak vector — but deliberately KEEPS the
// cached renders: they hold plain pixel data, they're bounded by the
// LRU, and they're exactly what makes remounting the same card (scroll
// away, scroll back) paint instantly instead of re-running the whole
// decode + upscale pipeline.
export function releaseId(id) {
    if (id == null) return;
    for (const algorithm of ALGORITHMS) {
        const state = workerState[algorithm];
        const prefix = id + "-" + algorithm + "-";

        // Drop callbacks for every scale of this id. Most cards only
        // use one scale, but a renderer switch (xbrz→hex) or a column
        // width change can register multiple.
        const cbKeys = Object.keys(state.callbacks);
        for (let i = 0; i < cbKeys.length; i++) {
            if (cbKeys[i].startsWith(prefix)) {
                delete state.callbacks[cbKeys[i]];
            }
        }
    }
}

// Optional: expose pool stats for debugging in DevTools.
// Inspect via: window.__PIXA_RENDER_POOL_STATS__()
if (typeof window !== 'undefined') {
    window.__PIXA_RENDER_POOL_STATS__ = function () {
        const out = {
            totalBytes: workerStateSize,
            totalCached: workerStateCount,
            bitmapBytes: bitmapBytes,
            bitmapCached: bitmapCount,
            limits: {
                maxEntries: MAX_CACHED_RENDERS, maxBytes: MAX_CACHED_BYTES,
                maxBitmaps: MAX_CACHED_BITMAPS, maxBitmapBytes: MAX_CACHED_BITMAP_BYTES,
            },
            // probedMaxDim is null until the first GPU-eligible render
            // runs the probe (getGpuLimits is lazy).
            gpuGuard: {
                probedMaxDim: gpuLimitsCache ? gpuLimitsCache.maxDim : null,
                maxOutputPixels: MAX_GPU_OUTPUT_PIXELS,
            },
            algorithms: {},
        };
        for (const a of ALGORITHMS) {
            out.algorithms[a] = {
                callbacks: Object.keys(workerState[a].callbacks).length,
                cached: Object.keys(workerState[a].data).length,
                masters: Object.keys(workerState[a].bitmaps).length,
            };
        }
        return out;
    };
}