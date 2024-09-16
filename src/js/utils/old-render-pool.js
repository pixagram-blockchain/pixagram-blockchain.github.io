import {default as hexUpscale, dispose as disposeHEX} from "./hexagonrenderwasm";
import {default as xbrzUpscale, dispose as disposeXBRZ} from "./xbrzwasm";
import {default as crtUpscale, dispose as disposeCRT} from "./crtWebgl";

// ── Square (nearest-neighbor) upscaler ────────────────────────────────
// Kept identical to previous behavior; runs on main thread.
function upscale_square(imgd, scale) {
    const canvas = document.createElement("canvas");
    const canvas2 = document.createElement("canvas");
    canvas.width = imgd.width * scale;
    canvas.height = imgd.height * scale;
    canvas2.width = imgd.width;
    canvas2.height = imgd.height;
    const context = canvas.getContext("2d");
    const context2 = canvas2.getContext("2d");
    context.imageSmoothingEnabled = false;
    context2.imageSmoothingEnabled = false;
    context2.putImageData(imgd, 0, 0);
    context.drawImage(canvas2, 0, 0, canvas2.width, canvas2.height, 0, 0, canvas.width, canvas.height);
    return context.getImageData(0, 0, canvas.width, canvas.height);
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
// data[id]       → cached ImageData (for cache hits)
// bitmap[id]     → cached ImageBitmap (matching data[id])
// timestamp[id]  → last-touch time for LRU eviction
let workerState = {
    xbrz: { worker: false, callbacks: {}, data: {}, bitmap: {}, timestamp: {} },
    hex:  { worker: false, callbacks: {}, data: {}, bitmap: {}, timestamp: {} },
    sqr:  { worker: false, callbacks: {}, data: {}, bitmap: {}, timestamp: {} },
    crt:  { worker: false, callbacks: {}, data: {}, bitmap: {}, timestamp: {} },
};

let workerStateSize = 0;
const CACHE_SIZE_BUDGET = 256 * 1024; // bytes of ImageData across the whole pool

// Switching algorithms: terminate the workers for inactive algorithms
// and drop their callbacks. The active algorithm's callbacks are
// managed via cache eviction and per-consumer releaseId().
function terminateOtherWorkers(currentWorker) {
    for (const worker in workerState) {
        if (worker !== currentWorker) {
            manager.terminateWorker(worker);
            workerState[worker].callbacks = {};
            // Note: we deliberately keep data/bitmap caches around in
            // case the user switches back. They'll be evicted by LRU.
        }
    }
}

// Evict the single oldest entry across the currently active algorithm
// until total cached size is back within budget. Each iteration removes
// one entry — call repeatedly if needed.
function evictOldest(algorithm) {
    const state = workerState[algorithm];
    const keys = Object.keys(state.timestamp);
    if (keys.length === 0) return false;

    let minIdx = 0;
    let minVal = state.timestamp[keys[0]];
    for (let i = 1; i < keys.length; i++) {
        const v = state.timestamp[keys[i]];
        if (v < minVal) { minVal = v; minIdx = i; }
    }
    const key = keys[minIdx];
    const entry = state.data[key];
    const sizeDeleted = (entry && entry.data && entry.data.byteLength) | 0;

    try { state.bitmap[key] && state.bitmap[key].close && state.bitmap[key].close(); } catch (e) {}
    delete state.data[key];
    delete state.bitmap[key];
    delete state.callbacks[key];
    delete state.timestamp[key];
    workerStateSize -= sizeDeleted;
    if (workerStateSize < 0) workerStateSize = 0;
    return true;
}

// ── Worker reply handler ─────────────────────────────────────────────
// Routes a render result to the registered callback (if still present)
// and updates the LRU cache. If the consumer has already released its
// id via releaseId(), we drop the result on the floor — no DOM is held.
async function received(r, id2, algorithm2) {
    const state = workerState[algorithm2];
    if (!state) return;

    const cb = state.callbacks[id2];
    if (typeof cb !== "function") {
        // Consumer is gone. Nothing to do — do NOT populate the cache,
        // because there is no live consumer to hand the bitmap to and
        // creating one would only be useful if the same id remounts,
        // which is rare and not worth the retention risk.
        return;
    }

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

    // Populate the LRU cache for fast re-hits.
    const size = (r && r.data && r.data.byteLength) | 0;

    // If we're replacing an existing entry, account for the old size
    // and close the old bitmap before overwriting.
    if (state.data[id2]) {
        const oldSize = (state.data[id2].data && state.data[id2].data.byteLength) | 0;
        workerStateSize -= oldSize;
        try { state.bitmap[id2] && state.bitmap[id2].close && state.bitmap[id2].close(); } catch (e) {}
    }

    state.data[id2] = r;
    state.bitmap[id2] = bmp;
    state.timestamp[id2] = Date.now() | 0;
    workerStateSize += size;

    // Evict until within budget. Loops because a single eviction may
    // not free enough if the new entry is large.
    while (workerStateSize > CACHE_SIZE_BUDGET) {
        if (!evictOldest(algorithm2)) break;
    }
}

function disposeAll() {
    disposeHEX();
    disposeXBRZ();
    disposeCRT();
}

// ── Main entry ────────────────────────────────────────────────────────
async function processWorker(algorithm, image_data, scale, callback, terminate = false, id, mode = "GPU") {
    const fullId = id + "-" + algorithm + "-" + scale;
    terminateOtherWorkers(algorithm);
    workerState[algorithm].callbacks[fullId] = callback;

    // Cache hit: serve immediately from cached ImageData/ImageBitmap.
    const cached = workerState[algorithm].data[fullId];
    if (typeof cached !== "undefined") {
        const imgd = cached;
        const bmp = workerState[algorithm].bitmap[fullId];
        // Bump timestamp so this entry is treated as freshly used.
        workerState[algorithm].timestamp[fullId] = Date.now() | 0;
        try { callback(imgd, bmp); } catch (e) {}
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

    // Main-thread WASM/WebGL path.
    if (mode !== "GPU") {
        disposeAll();
    }

    const n = Object.keys(workerState[algorithm].callbacks).length;

    if (algorithm === "hex") {
        const imgd = await hexUpscale(image_data, scale, mode);
        await received(imgd, fullId, algorithm);
        disposeCRT();
        disposeXBRZ();
    } else if (algorithm === "xbrz") {
        const imgd = await xbrzUpscale(image_data, scale, (tempImgd) => { received(tempImgd, fullId, algorithm); }, n, mode);
        await received(imgd, fullId, algorithm);
        disposeCRT();
        disposeHEX();
    } else if (algorithm === "crt") {
        const imgd = await crtUpscale(image_data, scale, mode);
        await received(imgd, fullId, algorithm);
        disposeXBRZ();
        disposeHEX();
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

export function sqrF(image_data, scale, callback, terminate, id, mode) {
    processWorker('sqr', image_data, scale, callback, terminate, id, mode);
}

// ── Public API: consumer lifecycle ───────────────────────────────────
// Call this from a component's unmount cleanup to release any callbacks
// and cached results associated with `id` across all algorithms and
// scales. Without this, the pool's callbacks map retains the consumer's
// closure (and any DOM nodes it references) indefinitely.
export function releaseId(id) {
    if (id == null) return;
    for (const algorithm of ['xbrz', 'hex', 'crt', 'sqr']) {
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

        // Drop cached data/bitmap for the same id+scale prefix.
        const dataKeys = Object.keys(state.data);
        for (let i = 0; i < dataKeys.length; i++) {
            const key = dataKeys[i];
            if (key.startsWith(prefix)) {
                const sz = (state.data[key] && state.data[key].data && state.data[key].data.byteLength) | 0;
                try { state.bitmap[key] && state.bitmap[key].close && state.bitmap[key].close(); } catch (e) {}
                delete state.data[key];
                delete state.bitmap[key];
                delete state.timestamp[key];
                workerStateSize -= sz;
            }
        }
    }
    if (workerStateSize < 0) workerStateSize = 0;
}

// Optional: expose pool stats for debugging in DevTools.
// Inspect via: window.__PIXA_RENDER_POOL_STATS__()
if (typeof window !== 'undefined') {
    window.__PIXA_RENDER_POOL_STATS__ = function () {
        const out = { totalBytes: workerStateSize, algorithms: {} };
        for (const a of ['xbrz', 'hex', 'crt', 'sqr']) {
            out.algorithms[a] = {
                callbacks: Object.keys(workerState[a].callbacks).length,
                cached: Object.keys(workerState[a].data).length,
            };
        }
        return out;
    };
}