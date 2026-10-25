/**
 * nsfw-detect.js
 * ---------------------------------------------------------------------------
 * Main-thread facade over @pixagram/nsfw-lite (binary sfw / nsfw classifier).
 *
 * The classifier package owns its own Web Worker (with an automatic
 * main-thread fallback) and request batching, so this module NO LONGER needs a
 * hand-rolled worker or a ./nsfw.worker.js file — that file can be deleted.
 * What stays here is the app-specific glue:
 *   - a per-post-id verdict cache in IndexedDB (classify each id once/device),
 *   - the render-time gating rules,
 *   - the synchronous getCached() lookup used by the render path.
 *
 * Public API (unchanged):
 *   configure({ filterEnabled, threshold, thresholds, wasmPaths, inputSize, ... })
 *   ensureNsfw({ id, getImgData, alreadyFlagged }) -> Promise<boolean>
 *   getCached(id) -> boolean | undefined
 *   warmup() -> Promise<void>
 *   dispose()
 *
 * `getImgData` is the same async () => ImageData PaperCard already builds from
 * png-db. ensureNsfw() turns that ImageData into an ImageBitmap for the
 * detector. The package does NOT move the bitmap to its worker: it draws it on
 * the main thread, reads it back with getImageData, and transfers those pixels.
 * So when the source is larger than the model input, the bitmap is created
 * already shrunk to fit inside inputSize x inputSize (aspect ratio kept,
 * nearest filter). That makes the main-thread readback and the transfer tiny,
 * while the model input stays identical: the package's own letterbox then
 * resizes 1:1 and only adds the padding bars. createImageBitmap only reads the
 * source pixels, so the caller's ImageData is never neutered.
 */

"use strict";

// Adjust the specifier if you vendor the package under a different name/path.
import { NsfwDetector } from "@pixagram/nsfw-lite";
// --- IndexedDB verdict cache ----------------------------------------------
// The model changed (old 5-class EfficientNet -> binary MobileNetV4), and the
// cache key is the IMAGE content hash, not the model — so a verdict cached by
// the old model must NOT be reused for the new one. The DB name is bumped to
// start this model with a clean cache; the old "pixagram-nsfw" DB is left
// untouched. To reclaim its space: indexedDB.deleteDatabase("pixagram-nsfw").
const DB_NAME = "pixagram-nsfw-lite";
const STORE = "verdicts";
const DB_VERSION = 1;

let _dbPromise = null;
function openDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
        let req;
        try { req = indexedDB.open(DB_NAME, DB_VERSION); }
        catch (e) { return reject(e); }
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE)) {
                db.createObjectStore(STORE, { keyPath: "id" });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    }).catch(() => null); // null = no IDB (private mode etc.) -> in-memory only
    return _dbPromise;
}

async function idbGet(id) {
    const db = await openDB();
    if (!db) return undefined;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE, "readonly");
            const req = tx.objectStore(STORE).get(id);
            req.onsuccess = () => resolve(req.result || undefined);
            req.onerror = () => resolve(undefined);
        } catch (e) { resolve(undefined); }
    });
}

async function idbPut(record) {
    const db = await openDB();
    if (!db) return;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE, "readwrite");
            tx.objectStore(STORE).put(record);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        } catch (e) { resolve(); }
    });
}

// Read EVERY persisted verdict in one transaction (used to prime the in-memory
// mirror at warmup). Resolves to [] when IDB is unavailable.
async function idbGetAll() {
    const db = await openDB();
    if (!db) return [];
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE, "readonly");
            const req = tx.objectStore(STORE).getAll();
            req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
            req.onerror = () => resolve([]);
        } catch (e) { resolve([]); }
    });
}

// --- In-memory mirror (fast synchronous reads for the render path) --------
const memCache = new Map();   // id -> { nsfw, score, ... }
const inflight = new Map();   // id -> Promise<boolean>  (dedupes concurrent calls)

// Debug-gated logger (see config.debug). Centralised so every call site is
// silenced together in production. (config is declared below; log() is only
// ever invoked after module evaluation, so the reference is safe.)
function log(...args) {
    if (config.debug) console.log("[nsfw]", ...args);
}

const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);

// --- Config ----------------------------------------------------------------
const config = {
    filterEnabled: false, // set true when the user has NSFW filtering ON
    // Per-verdict console logging. Off by default: at feed scale this is one
    // log line per image, which is noise (and a small cost) in production.
    // Turn on with configure({ debug: true }).
    debug: true,
    // Binary gate: an image is flagged when P(nsfw) >= thresholds.nsfw.
    thresholds: { nsfw: 0.40 },
    // Model input edge: preprocess.size of the embedded model (160 for the
    // current build). Sources larger than this are shrunk to fit inside
    // inputSize x inputSize before they reach the detector. It MUST equal the
    // model's size — if you ship a model trained at another resolution, change
    // it here too, or the package would resize a second time and the model
    // would no longer see the pixels it was trained on.
    inputSize: 160,
    // Passed through to NsfwDetector.create(). wasmPaths usually MUST point at
    // wherever onnxruntime-web's .wasm/.mjs assets are served from for the model
    // to load; the rest are optional.
    runtime: {
        useWorker: "auto",   // "auto" (default) | true | false
        backend: isMobile ? "wasm" : "auto",   // "auto" tries WebGPU then WASM | "webgpu" | "wasm"
        wasmPaths: undefined, // e.g. "/ort/"
        numThreads: 1, // >1 needs cross-origin isolation (COOP/COEP)
        maxBatch: isMobile ? 4 : 8, // images per batched inference (package default 8)
        batchDelayMs: 24, // coalescing window (package default 12ms)
    },
};

export function configure(opts = {}) {
    if (typeof opts.filterEnabled === "boolean") config.filterEnabled = opts.filterEnabled;
    if (typeof opts.debug === "boolean") config.debug = opts.debug;
    if (opts.thresholds && typeof opts.thresholds === "object") {
        config.thresholds = Object.assign({}, config.thresholds, opts.thresholds);
    }
    // Back-compat: a single `threshold` number is the nsfw probability gate.
    if (typeof opts.threshold === "number") {
        config.thresholds = Object.assign({}, config.thresholds, { nsfw: opts.threshold });
    }
    // Must match the model's input size (see config.inputSize).
    if (Number.isInteger(opts.inputSize) && opts.inputSize > 0) config.inputSize = opts.inputSize;
    // Engine/runtime options forwarded to the detector.
    for (const k of ["useWorker", "backend", "wasmPaths", "numThreads", "maxBatch", "batchDelayMs"]) {
        if (k in opts) config.runtime[k] = opts[k];
    }
}

// --- Detector (single shared instance, lazily created) --------------------
// Replaces the old manual worker + reqId protocol: NsfwDetector internally
// spawns a worker (or falls back to the main thread) and batches calls, so
// many ensureNsfw() calls during a render coalesce into few inferences.
let _detectorPromise = null;
function getDetector() {
    if (_detectorPromise) return _detectorPromise;
    const r = config.runtime;
    _detectorPromise = NsfwDetector.create({
        useWorker: r.useWorker,
        backend: r.backend,
        wasmPaths: r.wasmPaths,
        numThreads: r.numThreads,
        maxBatch: r.maxBatch,
        batchDelayMs: r.batchDelayMs,
        // Baked for completeness/debug; the live gate below is what we trust, so
        // configure({ threshold }) still works without recreating the detector.
        thresholds: { nsfw: config.thresholds.nsfw },
    }).catch((e) => {
        _detectorPromise = null; // allow a later call to retry creation
        throw e;
    });
    return _detectorPromise;
}

// --- Pre-shrink helpers -----------------------------------------------------
// Fit (w, h) inside S x S without distortion, with the same rounding as the
// trainer's letterbox and the package's resizeToSquare (round half up, >= 1px).
// Both sides are computed here on purpose: when only resizeWidth or only
// resizeHeight is given, createImageBitmap derives the other side with ceil(),
// which is 1px off the trainer's rounding for about half of all sizes
// (e.g. 161x92 -> 160x92 instead of 160x91).
function fitInside(w, h, S) {
    const scale = Math.min(S / w, S / h);
    return {
        scale,
        width: Math.max(1, Math.round(w * scale)),
        height: Math.max(1, Math.round(h * scale)),
    };
}

// The model was trained with nearest-neighbour resizing, so the shrink must use
// resizeQuality: "pixelated" (the default, "low", smooths). Not every browser
// honours it — Firefox only supports resizeQuality since v149; older versions
// ignore it and smooth — so test once, the same way the package does before
// it trusts the option, upscaling and downscaling an alternating black/white
// row and checking that no in-between grey appears. If the test fails,
// bitmaps are created at full size exactly as before and the package's own
// canvas-based nearest resize is used.
let _pixelatedPromise = null;
function pixelatedResizeWorks() {
    if (_pixelatedPromise) return _pixelatedPromise;
    _pixelatedPromise = (async () => {
        if (typeof createImageBitmap !== "function" || typeof ImageData === "undefined") return false;
        const staysCrisp = async (srcW, dstW) => {
            const src = new Uint8ClampedArray(srcW * 4);
            for (let i = 0; i < srcW; i++) {
                const v = i % 2 ? 255 : 0;
                src[i * 4] = src[i * 4 + 1] = src[i * 4 + 2] = v;
                src[i * 4 + 3] = 255;
            }
            const bmp = await createImageBitmap(new ImageData(src, srcW, 1), {
                resizeWidth: dstW,
                resizeHeight: 1,
                resizeQuality: "pixelated",
                premultiplyAlpha: "none",
            });
            try {
                if (bmp.width !== dstW || bmp.height !== 1) return false; // resize ignored
                const canvas = typeof OffscreenCanvas !== "undefined"
                    ? new OffscreenCanvas(dstW, 1)
                    : Object.assign(document.createElement("canvas"), { width: dstW, height: 1 });
                const ctx = canvas.getContext("2d", { willReadFrequently: true });
                if (!ctx) return false;
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(bmp, 0, 0);
                const px = ctx.getImageData(0, 0, dstW, 1).data;
                for (let i = 0; i < px.length; i += 4) {
                    if (px[i] > 1 && px[i] < 254) return false; // blended -> not nearest
                }
                return true;
            } finally {
                bmp.close();
            }
        };
        try {
            return (await staysCrisp(4, 16)) && (await staysCrisp(16, 6));
        } catch (e) {
            return false;
        }
    })();
    return _pixelatedPromise;
}

// --- Warmup + cache priming -------------------------------------------------
let _primePromise = null;

// Bulk-load persisted verdicts into the in-memory mirror. The render path's
// getCached() reads ONLY memCache (synchronously), so without this every
// previously-seen post pays an async IDB round-trip in ensureNsfw() before its
// verdict is known again. Priming makes those reads hit immediately — no
// re-classification, and (paired with warmup) no flash of un-blurred content
// for posts this device already judged NSFW. Runs at most once; one getAll.
export function primeCache() {
    if (_primePromise) return _primePromise;
    _primePromise = idbGetAll().then((rows) => {
        let n = 0;
        for (const rec of rows) {
            if (rec && rec.id != null && !memCache.has(rec.id)) {
                memCache.set(rec.id, rec);
                n++;
            }
        }
        log("primed", n, "cached verdict(s) into memory");
        return n;
    }).catch(() => 0);
    return _primePromise;
}

/**
 * Warm everything the first classification would otherwise pay for on the
 * render path: spawn the worker + initialise the ORT session (model load),
 * prime the verdict cache from IndexedDB, and run the one-time "pixelated"
 * resize test. All run in parallel and are best-effort, so a failure in any
 * never blocks rendering. No-op when filtering is off (nothing will be
 * classified). Idempotent — safe to call from app bootstrap and again on
 * settings changes.
 */
export function warmup() {
    if (!config.filterEnabled) return Promise.resolve();
    return Promise.all([
        getDetector().then(() => {}).catch(() => {}),
        primeCache(),
        pixelatedResizeWorks(),
    ]).then(() => {});
}

// --- Verdict from a cached record ------------------------------------------
// Recomputed from the stored probability so changing the threshold via
// configure() takes effect without clearing the cache. Externally-labelled
// posts (alreadyFlagged) are always unsafe regardless of threshold. Older
// records without a numeric score fall back to their stored boolean.
function verdictFor(rec) {
    if (!rec) return undefined;
    if (rec.labelled) return true;
    if (typeof rec.score === "number") return rec.score >= config.thresholds.nsfw;
    return !!rec.nsfw;
}

// --- Public: synchronous cached lookup (for render decisions) -------------
export function getCached(id) {
    return verdictFor(memCache.get(id));
}

// --- Public: ensure we have a verdict for `id` ----------------------------
/**
 * @param {object}   args
 * @param {string}   args.id              post content hash / id
 * @param {Function} args.getImgData      async () => ImageData (source pixels)
 * @param {boolean}  args.alreadyFlagged  data.nsfw — already labelled NSFW?
 * @returns {Promise<boolean>}  resolves to the NSFW verdict (true = unsafe)
 *
 * Gating:
 *   - filterEnabled === false  -> never classify; resolve false (show all).
 *   - alreadyFlagged === true  -> resolve true without classifying (it's
 *                                 blurred anyway; no compute needed).
 *   - cached verdict present   -> resolve it (mem first, then IDB).
 *   - otherwise                -> classify once via the detector, cache, resolve.
 */
export async function ensureNsfw({ id, getImgData, alreadyFlagged }) {
    // Rule 1: filtering off -> don't run the model at all.
    if (!config.filterEnabled) return false;

    // Rule 2: already labelled NSFW -> it's filtered regardless; skip compute.
    if (alreadyFlagged === true) {
        // Re-renders of a flagged post hit this on every call — don't redo
        // the memCache/IDB write once a labelled record is in place.
        const existing = memCache.get(id);
        if (existing && existing.labelled) return true;
        const rec = { id, nsfw: true, score: 1, labelled: true, ts: Date.now() };
        memCache.set(id, rec);
        idbPut(rec);
        config.debug && log(id, { nsfw: true, labelled: true });
        return true;
    }

    if (!id) return false;

    // Rule 3a: in-memory verdict.
    const mem = memCache.get(id);
    if (mem) {
        const v = verdictFor(mem);
        // Hottest path in the module — guard the call so the args object
        // isn't allocated per render when debug is off.
        config.debug && log(id, { nsfw: v, cached: "mem", score: mem.score });
        return v;
    }

    // Rule 3b: dedupe concurrent calls for the same id.
    if (inflight.has(id)) return inflight.get(id);

    const work = (async () => {
        // Rule 3c: persisted verdict.
        const persisted = await idbGet(id);
        if (persisted) {
            memCache.set(id, persisted);
            return verdictFor(persisted);
        }

        // Need the source pixels.
        let imgd = null;
        try { imgd = await getImgData(); } catch (e) { imgd = null; }
        if (!imgd || !imgd.data || !imgd.width || !imgd.height) {
            log(id, "no image data -> fail-open");
            return false;
        }

        // The detector takes an ImageBitmap. When the source is bigger than the
        // model input, create it already shrunk to fit inside
        // inputSize x inputSize — no distortion, no padding (the package adds
        // the letterbox bars itself, and with a bitmap that already fits its
        // own resize is exactly 1:1, so the model sees the same pixels as
        // before). Smaller sources (most sprites) are passed at native size and
        // upscaled by the package, as before.
        //
        // The options mirror the render path in PaperCard's CanvasImage so the
        // classifier sees exactly the pixels we'd display:
        //   premultiplyAlpha:"none"     -> straight (non-premultiplied) alpha,
        //                                  matching ImageData semantics;
        //                                  premultiplying would distort the
        //                                  channel values the model reads.
        //   colorSpaceConversion:"none" -> feed the raw sRGB bytes; don't let
        //                                  the UA apply an embedded color profile.
        //   resizeQuality:"pixelated"   -> nearest neighbour, the filter the
        //                                  model was trained with (only used
        //                                  where the browser honours it).
        // createImageBitmap only READS imgd, so the caller's ImageData is never
        // neutered by this.
        const fit = fitInside(imgd.width, imgd.height, config.inputSize);
        const shrink = fit.scale < 1 && (await pixelatedResizeWorks());
        const bitmapOpts = { premultiplyAlpha: "none", colorSpaceConversion: "none" };
        if (shrink) {
            bitmapOpts.resizeWidth = fit.width;
            bitmapOpts.resizeHeight = fit.height;
            bitmapOpts.resizeQuality = "pixelated";
        }

        let bitmap = null;
        try {
            bitmap = await createImageBitmap(imgd, bitmapOpts);
        } catch (e) {
            log(id, "createImageBitmap failed -> fail-open:", e && e.message);
            return false; // fail-open
        }
        // Read the size before classify(): the bitmap may be closed afterwards.
        const sent = `${bitmap.width}x${bitmap.height}`;

        let score = 0, sfw = 0, triggers = [], workerMs = 0, backend = null;
        try {
            const detector = await getDetector();
            const res = await detector.classify(bitmap);
            const s = res && res.scores;
            score = s && typeof s.nsfw === "number" ? s.nsfw : 0;
            sfw = s && typeof s.sfw === "number" ? s.sfw : 0;
            triggers = (res && res.triggers) || [];
            workerMs = (res && res.ms) || 0;
            backend = (res && res.backend) || null;
        } catch (e) {
            log(id, "classify error:", e && e.message);
            return false; // fail-open
        } finally {
            // We own the bitmap and the package has finished reading it once
            // classify() settles, so release its memory now.
            try { bitmap.close && bitmap.close(); } catch (e) {}
        }

        const verdict = score >= config.thresholds.nsfw;
        const rec = { id, nsfw: verdict, score, sfw, triggers, ms: workerMs, backend, ts: Date.now() };
        memCache.set(id, rec);
        idbPut(rec);
        config.debug && log(id, {
            nsfw: verdict, score: +Number(score).toFixed(3), backend, ms: workerMs,
            input: `${imgd.width}x${imgd.height}`, sent,
        });
        return verdict;
    })();

    inflight.set(id, work);
    try { return await work; }
    finally { inflight.delete(id); }
}

/** Tear down the detector (e.g. when filtering is turned off for the session). */
export function dispose() {
    if (_detectorPromise) {
        const p = _detectorPromise;
        _detectorPromise = null;
        p.then((d) => d.dispose()).catch(() => {});
    }
    inflight.clear();
    // memCache is intentionally kept (cheap, and IDB-backed). To fully reset
    // in-memory state as well, also call: memCache.clear();
}

export default {
    configure,
    ensureNsfw,
    getCached,
    warmup,
    primeCache,
    dispose,
};