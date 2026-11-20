/**
 * nsfw-detect.js
 * ---------------------------------------------------------------------------
 * Main-thread facade over @pixagram/eve (binary sfw / nsfw classifier: EVE-Nano,
 * 8-bit, one of 13 model inputs chosen from the picture's aspect ratio).
 *
 * @pixagram/eve runs where it is imported and has no Web Worker of its own, so
 * ./nsfw.worker.js is back: a small module worker that imports the package and
 * answers this module's requests. The model, ONNX Runtime and the package's
 * pixel readback all live there. If a worker cannot start, the package is
 * imported here instead (dynamically, so it stays out of the main bundle
 * otherwise) and runs on the main thread: the "auto" behaviour of before.
 * What stays here is the app-specific glue:
 *   - a per-post-id verdict cache in IndexedDB (classify each id once/device),
 *   - the render-time gating rules,
 *   - the synchronous getCached() lookup used by the render path.
 *
 * Public API (unchanged):
 *   configure({ filterEnabled, threshold, thresholds, wasmPaths, useWorker, ... })
 *   ensureNsfw({ id, getImgData, alreadyFlagged }) -> Promise<boolean>
 *   getCached(id) -> boolean | undefined
 *   warmup() -> Promise<void>
 *   classifyImage(source, { width, height, threshold }) -> Promise<{ ok, nsfw, score }>
 *       on-demand check for the store builds' creation gate (no cache, ignores
 *       filterEnabled, reports failures as ok:false)
 *   warmupClassifier() -> Promise<void>   model load for classifyImage()
 *   dispose()
 *
 * `getImgData` is the same async () => ImageData PaperCard already builds from
 * png-db. ensureNsfw() turns that ImageData into an ImageBitmap and TRANSFERS
 * the bitmap to the worker. When the picture is larger than the model input it
 * will get, the bitmap is created already shrunk to the exact size the package
 * would letterbox it to (same input shape, same rounding, nearest filter). That
 * keeps the transfer and the worker's readback tiny while the model input stays
 * identical: the package then resizes 1:1 and only adds the padding bars. (The
 * few sizes for which that would not hold are sent whole: see fitForModel.)
 * createImageBitmap only reads the source pixels, so the caller's ImageData is
 * never neutered.
 */

"use strict";

import { ByteLRU } from "./memory-kit";

// --- Memory bounds -----------------------------------------------------------
// Verdicts kept in memory (the rest are read from IndexedDB on a miss), and
// verdicts kept in IndexedDB (older ones are pruned when the cache is primed).
// Both used to be unbounded: every verdict this device ever stored was loaded
// into memory at warm-up.
const MEM_CACHE_ENTRIES = 5000;
const IDB_MAX_RECORDS = 20000;
// The detector runs ONNX Runtime and the model in a worker. Ending the worker
// after this long without a classification gives back its whole heap; the
// next classification starts a new one.
const DETECTOR_IDLE_MS = 2 * 60 * 1000;
// --- IndexedDB verdict cache ----------------------------------------------
// The model changed again (binary MobileNetV4 -> EVE-Nano), and the cache key
// is the IMAGE content hash, not the model — so a verdict cached by an older
// model must NOT be reused for this one (its scores are on another scale). The
// DB name is bumped to start this model with a clean cache; the older DBs are
// left untouched. To reclaim their space:
//   indexedDB.deleteDatabase("pixagram-nsfw-lite");   // MobileNetV4
//   indexedDB.deleteDatabase("pixagram-nsfw");        // EfficientNet
// Bump the name again whenever the model embedded in @pixagram/eve changes.
const DB_NAME = "pixagram-nsfw-eve";
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

// Delete the given verdicts in one transaction (pruning). Best-effort.
async function idbDeleteMany(ids) {
    const db = await openDB();
    if (!db || !ids.length) return;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE, "readwrite");
            const store = tx.objectStore(STORE);
            for (const id of ids) store.delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
            tx.onabort = () => resolve();
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
// Least-recently-used, MEM_CACHE_ENTRIES at most; a miss falls back to IDB.
const memCache = new ByteLRU({ maxEntries: MEM_CACHE_ENTRIES });   // id -> { nsfw, score, ... }
const inflight = new Map();   // id -> Promise<boolean>  (dedupes concurrent calls)

// Debug-gated logger (see config.debug). Centralised so every call site is
// silenced together in production. (config is declared below; log() is only
// ever invoked after module evaluation, so the reference is safe.)
function log(...args) {
    if (config.debug) console.log("[nsfw]", ...args);
}

// --- Config ----------------------------------------------------------------
const config = {
    filterEnabled: false, // set true when the user has NSFW filtering ON
    // Per-verdict console logging. Off by default: at feed scale this is one
    // log line per image, which is noise (and a small cost) in production.
    // Turn on with configure({ debug: true }).
    debug: false,
    // Binary gate: an image is flagged when P(nsfw) >= thresholds.nsfw.
    // The scale is this model's, not the previous one's: the 8-bit EVE file
    // answers between 0.11 and 0.89, so a gate at or below 0.11 flags every
    // image and one above 0.89 flags none.
    thresholds: { nsfw: 0.8 },
    // Passed to @pixagram/eve's load(). The model is embedded in the package;
    // only onnxruntime-web's own WASM binary is fetched. Leave wasmPaths unset
    // when the bundler copies that binary (Vite, webpack 5 do); otherwise point
    // it at the folder that serves ort-wasm-simd-threaded.wasm and .mjs.
    runtime: {
        useWorker: "auto",   // "auto" (default): worker, else main thread | true | false
        wasmPaths: undefined, // e.g. "/ort/" (resolved against the page, for the worker too)
        numThreads: 1, // >1 needs cross-origin isolation (COOP/COEP)
    },
};

// useWorker "auto": set once a worker could not start where the main thread
// then could; from then on the main thread is used directly. When both fail
// (offline, WASM binary not found) it stays false and the next call tries the
// worker again.
let _workerFailed = false;

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
    // Runtime options, used the next time the detector starts. The previous
    // package's inputSize, backend, maxBatch and batchDelayMs are accepted and
    // ignored: the model inputs come from the package, it runs on WASM, and
    // images are classified one by one.
    for (const k of ["useWorker", "wasmPaths", "numThreads"]) {
        if (k in opts) {
            config.runtime[k] = opts[k];
            _workerFailed = false; // new settings: the worker gets another try
        }
    }
}

// --- Detector (single shared instance, lazily created) --------------------
// The "detector" is the client of ./nsfw.worker.js or, when a worker cannot
// start, @pixagram/eve itself on the main thread. Either way it offers:
//   kind      "worker" | "main"
//   shapes    the model inputs, [[width, height], ...], in the package's order
//   nearest   true when the model resizes nearest-neighbour (this one does)
//   classify(bitmap) -> Promise<{ score, inputSize, ms }>   the bitmap is
//             consumed; images run one after the other, there is no batching
//   dispose()
// Requests to the worker are matched to their answers by a sequence number.

// How long the worker may take to fetch its script and report ready before the
// main-thread fallback takes over. What follows (the model load and a first
// test picture) is not timed: it waits for onnxruntime-web's WASM binary,
// however slow the network.
const WORKER_START_MS = 30000;

// load() options for the package. A worker resolves a relative URL against its
// own script, not the page, so wasmPaths is made absolute here.
function runtimeOptions() {
    const r = config.runtime;
    const base = typeof document !== "undefined" ? document.baseURI : self.location.href;
    const abs = (u) => { try { return new URL(u, base).href; } catch (e) { return String(u); } };
    const opts = {};
    const wp = r.wasmPaths;
    if (typeof wp === "string" || (typeof URL !== "undefined" && wp instanceof URL)) {
        opts.wasmPaths = abs(wp);
    } else if (wp && typeof wp === "object") {
        opts.wasmPaths = {};
        for (const k of ["wasm", "mjs"]) {
            if (wp[k] != null) opts.wasmPaths[k] = abs(wp[k]);
        }
    }
    if (Number.isInteger(r.numThreads) && r.numThreads >= 0) opts.numThreads = r.numThreads;
    return opts;
}

// `onDead` is called if the worker dies after it started (a crash): the
// requests in flight are rejected and the next call starts a new detector.
function createWorkerDetector(onDead) {
    return new Promise((resolve, reject) => {
        let worker;
        try {
            // Keep this exact form: bundlers (webpack 5, Vite) recognise it and
            // emit the worker file, and @pixagram/eve for it, by themselves.
            worker = new Worker(new URL("./nsfw.worker.js", import.meta.url), { type: "module" });
        } catch (e) {
            reject(e);
            return;
        }

        const pending = new Map();   // seq -> { resolve, reject }
        let seq = 0;
        let started = false;
        let dead = false;
        let startTimer = 0;
        const end = (err) => {
            if (dead) return;
            dead = true;
            clearTimeout(startTimer);
            try { worker.terminate(); } catch (e) {}
            for (const p of pending.values()) p.reject(err);
            pending.clear();
            if (started) onDead(); else reject(err);
        };
        const call = (msg, transfer) => new Promise((res, rej) => {
            if (dead) { rej(new Error("worker ended")); return; }
            const id = ++seq;
            pending.set(id, { resolve: res, reject: rej });
            try {
                worker.postMessage(Object.assign({ id }, msg), transfer || []);
            } catch (e) {
                pending.delete(id);
                rej(e);
            }
        });
        startTimer = setTimeout(() => end(new Error("worker did not start")), WORKER_START_MS);

        worker.onmessage = (ev) => {
            const m = ev.data || {};
            if (m.type === "ready") {
                // The script is in and knows the model's inputs. Load the model,
                // then have the worker classify a 2 x 2 picture: to read a
                // transferred bitmap back it needs OffscreenCanvas, which Safari
                // before 16.4 and Firefox before 105 do not have. There the model
                // loads but no picture can be classified, so a worker that fails
                // this is a worker that could not start ("auto": main thread).
                clearTimeout(startTimer);
                call({ type: "load", options: runtimeOptions() })
                    .then(() => createImageBitmap(new ImageData(2, 2)))
                    .then((probe) => call({ type: "classify", source: probe }, [probe]))
                    .then(() => {
                        started = true;
                        resolve({
                            kind: "worker",
                            shapes: m.shapes,
                            nearest: m.interpolation === "nearest",
                            classify: (bitmap) => call({ type: "classify", source: bitmap }, [bitmap]),
                            dispose: () => end(new Error("detector disposed")),
                        });
                    }, end);
                return;
            }
            const p = pending.get(m.id);
            if (!p) return;
            pending.delete(m.id);
            if (m.ok) p.resolve(m); else p.reject(new Error(m.error || "worker error"));
        };
        worker.onerror = (ev) => {
            if (ev && ev.preventDefault) ev.preventDefault();
            end(new Error((ev && ev.message) || "worker failed"));
        };
        worker.onmessageerror = () => end(new Error("worker message could not be read"));
    });
}

async function createMainDetector() {
    const eve = await import("@pixagram/eve");
    await eve.dispose(); // a clean start, so that load() takes the options
    await eve.load(runtimeOptions());
    return {
        kind: "main",
        shapes: eve.info.inputShapes,
        nearest: eve.info.interpolation === "nearest",
        classify: (bitmap) => eve.classify(bitmap),
        dispose: () => eve.dispose(),
    };
}

let _detectorPromise = null;
function getDetector() {
    if (_detectorPromise) return _detectorPromise;
    const mode = config.runtime.useWorker;
    const haveWorker = typeof Worker !== "undefined";
    let mine = null;
    const forget = () => { if (_detectorPromise === mine) _detectorPromise = null; };
    let starting;
    if (haveWorker && (mode === true || (mode !== false && !_workerFailed))) {
        starting = createWorkerDetector(forget).catch((e) => {
            if (mode === true) throw e; // a worker was required
            log("worker unavailable -> main thread:", e && e.message);
            return createMainDetector().then((detector) => {
                _workerFailed = true;
                return detector;
            });
        });
    } else if (mode === true) {
        starting = Promise.reject(new Error("Web Workers are not available"));
    } else {
        starting = createMainDetector();
    }
    mine = starting.catch((e) => {
        forget(); // allow a later call to retry creation
        throw e;
    });
    _detectorPromise = mine;
    return mine;
}

// --- Pre-shrink helpers -----------------------------------------------------
// Fit (w, h) inside bw x bh without distortion, with the same rounding as the
// trainer's letterbox and the package's (round half up, >= 1px, never larger
// than the box). Both sides are computed here on purpose: when only resizeWidth
// or only resizeHeight is given, createImageBitmap derives the other side with
// ceil(), which is 1px off the trainer's rounding for about half of all sizes
// (e.g. 161x92 -> 160x92 instead of 160x91).
function fitInside(w, h, bw, bh = bw) {
    const scale = Math.min(bw / w, bh / h);
    return {
        scale,
        width: Math.max(1, Math.min(bw, Math.round(w * scale))),
        height: Math.max(1, Math.min(bh, Math.round(h * scale))),
    };
}

// The model input a w x h picture gets: the rule of @pixagram/eve and of the
// trainer. EVE has one input per aspect ratio, all within the same pixel
// budget; the one that keeps the most of the picture maximises the INTEGER
// min(BW*h, BH*w), and a tie goes to the earlier shape. The rule is repeated
// here so that the shrink can happen on this side of the worker. Every answer
// carries the input the package really used, and checkInput() reports a
// difference.
function modelInputFor(w, h, shapes) {
    const iw = Math.max(1, Math.floor(w));
    const ih = Math.max(1, Math.floor(h));
    let best = shapes[0];
    let bestKey = -1;
    for (const shape of shapes) {
        const key = Math.min(shape[0] * ih, shape[1] * iw);
        if (key > bestKey) {
            best = shape;
            bestKey = key;
        }
    }
    return best;
}

// The size a w x h picture has inside its model input. A bitmap created at
// exactly this size is letterboxed 1:1 by the package, so the model sees the
// same pixels as from the full picture — PROVIDED the package gives the small
// bitmap the same input. It decides from the bitmap's own size, and for about
// one size in 200 the rounding lands on a tie between two inputs that goes the
// other way (83x266 belongs to 80x320 and shrinks to 80x256, which ties with
// 96x256, the earlier shape). `keepsInput` says whether the shrunk size is
// safe; when it is not, the picture is sent whole and the package does it all.
function fitForModel(w, h, shapes) {
    const input = modelInputFor(w, h, shapes);
    const fit = fitInside(w, h, input[0], input[1]);
    fit.input = input;
    fit.keepsInput = modelInputFor(fit.width, fit.height, shapes) === input;
    return fit;
}

// Not debug-gated and shown once: if this ever prints, pictures are being
// resized twice and the verdicts are not the model's.
let _inputWarned = false;
function checkInput(expected, res) {
    const got = res && res.inputSize;
    if (_inputWarned || !expected || !got || (got[0] === expected[0] && got[1] === expected[1])) return;
    _inputWarned = true;
    console.warn("[nsfw] the model used input " + got.join("x") + " where " + expected.join("x") +
        " was expected: nsfw-detect.js and @pixagram/eve no longer choose the model input the" +
        " same way (see modelInputFor)");
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
//
// Only the newest MEM_CACHE_ENTRIES verdicts are loaded, and IndexedDB is
// pruned to the newest IDB_MAX_RECORDS (the store is keyed by id, so "newest"
// comes from sorting the getAll result by `ts`; records without one sort last).
export function primeCache() {
    if (_primePromise) return _primePromise;
    _primePromise = idbGetAll().then((rows) => {
        const valid = rows.filter((rec) => rec && rec.id != null);
        valid.sort((a, b) => (b.ts || 0) - (a.ts || 0)); // newest first
        if (valid.length > IDB_MAX_RECORDS) {
            idbDeleteMany(valid.slice(IDB_MAX_RECORDS).map((rec) => rec.id));
        }
        // Insert the oldest of the kept set first, so the newest end up as the
        // most recently used entries of the LRU.
        const keep = valid.slice(0, MEM_CACHE_ENTRIES);
        let n = 0;
        for (let i = keep.length - 1; i >= 0; i--) {
            const rec = keep[i];
            if (!memCache.has(rec.id)) {
                memCache.set(rec.id, rec);
                n++;
            }
        }
        log("primed", n, "cached verdict(s) into memory");
        return n;
    }).catch(() => 0);
    return _primePromise;
}

// End the detector's worker after DETECTOR_IDLE_MS without a classification.
// Unlike dispose(), this leaves in-flight bookkeeping alone and re-arms itself
// while calls are pending; getDetector() recreates the worker on demand.
// `_adhocPending` counts classifyImage() calls, which have no id and so are
// not in `inflight`.
let _idleTimer = 0;
let _adhocPending = 0;
function endDetectorWhenIdle() {
    clearTimeout(_idleTimer);
    _idleTimer = setTimeout(() => {
        if (inflight.size > 0 || _adhocPending > 0) { endDetectorWhenIdle(); return; }
        if (_detectorPromise) {
            const p = _detectorPromise;
            _detectorPromise = null;
            p.then((d) => d.dispose()).catch(() => {});
            log("detector ended after", DETECTOR_IDLE_MS / 1000, "s idle");
        }
    }, DETECTOR_IDLE_MS);
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
    ]).then(() => {
        // Armed here too: when every verdict comes from the cache, no
        // classification ever runs, and the warmed worker would live forever.
        endDetectorWhenIdle();
    });
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

        // The detector knows the model's inputs, which the shrink below needs.
        let detector = null;
        try {
            detector = await getDetector();
        } catch (e) {
            log(id, "detector unavailable -> fail-open:", e && e.message);
            return false; // fail-open
        }

        // The detector takes an ImageBitmap. When the source is bigger than the
        // model input it will get, create it already shrunk to the size it has
        // inside that input — no distortion, no padding (the package adds the
        // letterbox bars itself, and with a bitmap of that size its own resize
        // is exactly 1:1, so the model sees the same pixels as from the full
        // picture). Smaller sources (most sprites) are passed at native size
        // and upscaled by the package, as before.
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
        const fit = fitForModel(imgd.width, imgd.height, detector.shapes);
        const shrink = fit.scale < 1 && fit.keepsInput && detector.nearest && (await pixelatedResizeWorks());
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
        // Read the size before classify(): the bitmap is handed over (the
        // worker takes it by transfer, which leaves it empty here).
        const sent = `${bitmap.width}x${bitmap.height}`;

        let score = 0, workerMs = 0, modelInput = "";
        try {
            const res = await detector.classify(bitmap);
            // A verdict is only stored for a real probability.
            if (!res || typeof res.score !== "number" || res.score !== res.score) throw new Error("no score");
            score = res.score;
            workerMs = res.ms || 0;
            modelInput = res.inputSize ? res.inputSize.join("x") : "";
            checkInput(fit.input, res);
        } catch (e) {
            log(id, "classify error:", e && e.message);
            return false; // fail-open
        } finally {
            // Ours to release. After a transfer this is a no-op, and the
            // worker closes the copy it received.
            try { bitmap.close && bitmap.close(); } catch (e) {}
            endDetectorWhenIdle();
        }

        const verdict = score >= config.thresholds.nsfw;
        const rec = { id, nsfw: verdict, score, ms: workerMs, ts: Date.now() };
        memCache.set(id, rec);
        idbPut(rec);
        config.debug && log(id, {
            nsfw: verdict, score: +Number(score).toFixed(3), on: detector.kind, ms: workerMs,
            input: `${imgd.width}x${imgd.height}`, sent, model: modelInput,
        });
        return verdict;
    })();

    inflight.set(id, work);
    try { return await work; }
    finally { inflight.delete(id); }
}

// --- Public: classify one image on demand -----------------------------------
// The creation gate of the store builds (components/NewPost.js, see
// utils/store.js) checks every picture that enters the wizard, whatever the
// "show NSFW" setting. Unlike ensureNsfw() it ignores filterEnabled, keeps no
// cache (a draft is not a post) and REPORTS a failure instead of answering
// "safe", so the caller decides whether that fails open or closed.

// Longest side a source is brought down to when the browser can't shrink it
// nearest-neighbour itself (pixelatedResizeWorks() false): small enough that
// the package's own resize to the model input doesn't have to read a 12 MP
// photo back, large enough to leave that resize most of the work.
const FALLBACK_MAX_SIDE = 640;

const isBlob = (x) => typeof Blob !== "undefined" && x instanceof Blob;

function sourceSize(source) {
    if (!source) return null;
    const width = source.naturalWidth || source.videoWidth || source.width || 0;
    const height = source.naturalHeight || source.videoHeight || source.height || 0;
    return width > 0 && height > 0 ? { width, height } : null;
}

// An <img> for a Blob createImageBitmap refuses (SVG in Chromium, some older
// WebViews). `revoke` frees its object URL.
function decodeBlobAsImage(blob) {
    return new Promise((resolve, reject) => {
        let url;
        try { url = URL.createObjectURL(blob); } catch (e) { reject(e); return; }
        const img = new Image();
        img.onload = () => resolve({ img, revoke: () => URL.revokeObjectURL(url) });
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("image decode failed")); };
        img.src = url;
    });
}

// The bitmap handed to the detector: shrunk to its size inside the model input
// with the training filter when the browser can (same rules as ensureNsfw);
// when it cannot, to FALLBACK_MAX_SIDE with a smooth filter; else as is (a
// small picture, or one of the few sizes fitForModel() says not to shrink).
// Falls back to a plain createImageBitmap when the options are refused.
// Resolves to { bitmap, input }: `input` is the model input the package must
// then report (see checkInput), or null where that cannot be told in advance.
async function bitmapForModel(detector, drawable, width, height) {
    const base = { premultiplyAlpha: "none", colorSpaceConversion: "none" };
    const fit = fitForModel(width, height, detector.shapes);
    const nearest = detector.nearest && (await pixelatedResizeWorks());
    let opts = base;
    let input = fit.input;
    if (nearest && fit.scale < 1 && fit.keepsInput) {
        opts = { ...base, resizeWidth: fit.width, resizeHeight: fit.height, resizeQuality: "pixelated" };
    } else if (!nearest && Math.max(width, height) > FALLBACK_MAX_SIDE) {
        const near = fitInside(width, height, FALLBACK_MAX_SIDE);
        opts = { ...base, resizeWidth: near.width, resizeHeight: near.height, resizeQuality: "medium" };
        input = null; // a smooth pre-shrink may round the aspect ratio across two inputs
    }
    try {
        return { bitmap: await createImageBitmap(drawable, opts), input };
    } catch (e) {
        return { bitmap: await createImageBitmap(drawable), input: null };
    }
}

/**
 * @param {ImageData|ImageBitmap|Blob|HTMLImageElement|HTMLCanvasElement|OffscreenCanvas} source
 * @param {object} [opts]
 * @param {number} [opts.width]      decoded width of a Blob source, when known
 *                                   (spares a full-size decode before the shrink)
 * @param {number} [opts.height]     decoded height of a Blob source, when known
 * @param {number} [opts.threshold]  P(nsfw) gate; default: the configured one
 * @returns {Promise<{ok: boolean, nsfw: boolean, score: number}>}
 *   ok:false when the image could not be classified (decode or model failure).
 */
export async function classifyImage(source, opts = {}) {
    const threshold = typeof opts.threshold === "number" ? opts.threshold : config.thresholds.nsfw;
    clearTimeout(_idleTimer);
    _adhocPending++;
    const owned = [];     // bitmaps made here, closed in `finally`
    let revoke = null;
    try {
        // First: the detector knows the model's inputs, which the shrink needs.
        const detector = await getDetector();
        let drawable = source;
        let size = null;
        let bitmap = null;
        let expected = null;
        if (isBlob(source)) {
            try {
                if (opts.width > 0 && opts.height > 0) {
                    // Size known: decode straight to the model's size.
                    size = { width: opts.width, height: opts.height };
                    const made = await bitmapForModel(detector, source, size.width, size.height);
                    bitmap = made.bitmap;
                    expected = made.input;
                    owned.push(bitmap);
                } else {
                    drawable = await createImageBitmap(source, { premultiplyAlpha: "none", colorSpaceConversion: "none" });
                    owned.push(drawable);
                }
            } catch (e) {
                bitmap = null;
                const decoded = await decodeBlobAsImage(source);
                revoke = decoded.revoke;
                drawable = decoded.img;
            }
        }
        if (!bitmap) {
            size = sourceSize(drawable);
            if (!size) throw new Error("no image size");
            const made = await bitmapForModel(detector, drawable, size.width, size.height);
            bitmap = made.bitmap;
            expected = made.input;
            owned.push(bitmap);
        }

        // Read the size before classify(): the worker takes the bitmap by transfer.
        const sent = `${bitmap.width}x${bitmap.height}`;
        const res = await detector.classify(bitmap);
        if (!res || typeof res.score !== "number" || res.score !== res.score) throw new Error("no score");
        checkInput(expected, res);
        const score = res.score;
        const nsfw = score >= threshold;
        config.debug && log("adhoc", { nsfw, score: +Number(score).toFixed(3), on: detector.kind, input: `${size.width}x${size.height}`, sent });
        return { ok: true, nsfw, score };
    } catch (e) {
        log("adhoc classify failed:", e && e.message);
        return { ok: false, nsfw: false, score: 0 };
    } finally {
        for (const bmp of owned) {
            try { bmp && bmp.close && bmp.close(); } catch (e) {}
        }
        if (revoke) revoke();
        _adhocPending--;
        endDetectorWhenIdle();
    }
}

/**
 * Load the model ahead of a classifyImage() call, whatever filterEnabled says
 * (warmup() is a no-op while the feed filter is off). Best-effort.
 */
export function warmupClassifier() {
    return Promise.all([
        getDetector().then(() => {}).catch(() => {}),
        pixelatedResizeWorks(),
    ]).then(() => { endDetectorWhenIdle(); });
}

/** Tear down the detector (e.g. when filtering is turned off for the session). */
export function dispose() {
    clearTimeout(_idleTimer);
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
    classifyImage,
    warmupClassifier,
    dispose,
};