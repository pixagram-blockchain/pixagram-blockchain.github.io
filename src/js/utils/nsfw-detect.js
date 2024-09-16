/**
 * nsfw-detect.js
 * ─────────────────────────────────────────────────────────────────────────
 * Main-thread façade over the NSFW classification worker.
 *
 * Responsibilities
 *   • Spin up (lazily) and own the single classification Web Worker.
 *   • Cache results per post id (the pixel-art content hash) in IndexedDB so
 *     a given id is only ever classified once per device.
 *   • Enforce the gating rules:
 *       1. Only classify when NSFW filtering is ON (filterEnabled).
 *       2. Skip classification when the post is *already* labelled NSFW
 *          (data.nsfw === true) — it's blurred regardless, no need to spend
 *          compute confirming it.
 *       3. Skip when we already have a cached verdict for this id.
 *   • Turn the post's source pixel-art (an ImageData / decoded buffer) into a
 *     transferable payload for the worker.
 *
 * Public API
 *   configure({ filterEnabled, threshold })
 *   ensureNsfw({ id, getImgData, alreadyFlagged }) -> Promise<boolean>
 *   getCached(id) -> boolean | undefined
 *   warmup()
 *
 * `getImgData` is the same async () => ImageData function PaperCard already
 * builds from png-db, so the source pixels are reused — we never re-decode.
 */

"use strict";

// ─── IndexedDB result cache ──────────────────────────────────────────────
// Tiny standalone store; keeps the NSFW utility independent of LacertaDB's
// lifecycle. Key = post id (content hash), value = { nsfw, score, ts }.
const DB_NAME = "pixagram-nsfw";
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
    }).catch(() => null); // null = no IDB (private mode etc.) → in-memory only
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

// ─── In-memory mirror (fast synchronous reads for the render path) ────────
const memCache = new Map();   // id -> { nsfw, score }
const inflight = new Map();   // id -> Promise<boolean>  (dedupes concurrent calls)

// ─── Config ───────────────────────────────────────────────────────────────
const config = {
    filterEnabled: false, // set true when the user has NSFW filtering ON
    // Flag NSFW if ANY single class exceeds its per-class threshold, OR the
    // combined Porn+Hentai+Sexy sum exceeds `combined`. Tuned so a Sexy=0.86
    // image alone is flagged (was previously slipping through a sum-only rule
    // that needed 0.6, leaving Sexy ≤ 0.59 alone unflagged).
    thresholds: {
        porn: 0.35,
        hentai: 0.35,
        sexy: 0.50,
        combined: 0.60,
    },
};

export function configure(opts = {}) {
    if (typeof opts.filterEnabled === "boolean") config.filterEnabled = opts.filterEnabled;
    if (opts.thresholds && typeof opts.thresholds === "object") {
        config.thresholds = Object.assign({}, config.thresholds, opts.thresholds);
    }
    // Back-compat: a single `threshold` number maps to the combined-sum gate.
    if (typeof opts.threshold === "number") {
        config.thresholds = Object.assign({}, config.thresholds, { combined: opts.threshold });
    }
}

// ─── Worker management ──────────────────────────────────────────────────
let _worker = null;
let _reqSeq = 0;
const _pending = new Map(); // reqId -> { resolve, reject }

function getWorker() {
    if (_worker) return _worker;
    // webpack 5 worker syntax — emits a separate chunk, runs off-thread.
    _worker = new Worker(new URL("./nsfw.worker.js", import.meta.url), {
        type: "module",
        name: "nsfw-classifier",
    });
    _worker.onmessage = (event) => {
        const msg = event.data || {};
        const entry = _pending.get(msg.reqId);
        if (!entry) return;
        _pending.delete(msg.reqId);
        if (msg.type === "classify:done" || msg.type === "warmup:done") {
            entry.resolve(msg);
        } else if (msg.type === "classify:error" || msg.type === "warmup:error") {
            entry.reject(new Error(msg.error || "nsfw worker error"));
        }
    };
    _worker.onerror = (e) => {
        // Reject everything in flight; the verdict path will fail-open.
        for (const [, entry] of _pending) entry.reject(e);
        _pending.clear();
    };
    return _worker;
}

function postToWorker(message, transfer) {
    return new Promise((resolve, reject) => {
        const reqId = ++_reqSeq;
        _pending.set(reqId, { resolve, reject });
        try {
            getWorker().postMessage(Object.assign({ reqId }, message), transfer || []);
        } catch (e) {
            _pending.delete(reqId);
            reject(e);
        }
    });
}

/** Eagerly load the model so the first real classification is fast. */
export function warmup() {
    if (!config.filterEnabled) return Promise.resolve();
    return postToWorker({ type: "warmup" }).catch(() => {});
}

// ─── ImageData → transferable payload ────────────────────────────────────
// We copy the buffer so the original ImageData (which png-db / the render
// pool may reuse) is not neutered by the structured-clone transfer.
function toTransferable(imgd) {
    if (!imgd || !imgd.data || !imgd.width || !imgd.height) return null;
    const src = imgd.data;
    // Uint8ClampedArray → copy into a transferable ArrayBuffer.
    const copy = new Uint8ClampedArray(src.length);
    copy.set(src);
    return {
        payload: { data: copy, width: imgd.width, height: imgd.height },
        transfer: [copy.buffer],
    };
}

// ─── Public: synchronous cached lookup (for render decisions) ────────────
export function getCached(id) {
    const m = memCache.get(id);
    return m ? m.nsfw : undefined;
}

// ─── Public: ensure we have a verdict for `id` ───────────────────────────
/**
 * @param {object}   args
 * @param {string}   args.id              post content hash / id
 * @param {Function} args.getImgData      async () => ImageData (source pixels)
 * @param {boolean}  args.alreadyFlagged  data.nsfw — already labelled NSFW?
 * @returns {Promise<boolean>}  resolves to the NSFW verdict (true = unsafe)
 *
 * Gating:
 *   • filterEnabled === false  → never classify; resolve false (show all).
 *   • alreadyFlagged === true  → resolve true without classifying (it's
 *                                blurred anyway; no compute needed).
 *   • cached verdict present   → resolve it (mem first, then IDB).
 *   • otherwise                → classify once in the worker, cache, resolve.
 */
export async function ensureNsfw({ id, getImgData, alreadyFlagged }) {
    // Rule 1: filtering off → don't run the model at all.
    if (!config.filterEnabled) return false;

    // Rule 2: already labelled NSFW → it's filtered regardless; skip compute.
    if (alreadyFlagged === true) {
        const rec = { id, nsfw: true, score: 1, ts: Date.now(), labelled: true };
        memCache.set(id, rec);
        idbPut(rec);
        console.log("[nsfw]", id, { nsfw: true, labelled: true });
        return true;
    }

    if (!id) return false;

    // Rule 3a: in-memory verdict.
    const mem = memCache.get(id);
    if (mem) {
        console.log("[nsfw]", id, { nsfw: mem.nsfw, cached: "mem", porn: mem.porn, hentai: mem.hentai, sexy: mem.sexy });
        return mem.nsfw;
    }

    // Rule 3b: dedupe concurrent calls for the same id.
    if (inflight.has(id)) return inflight.get(id);

    const work = (async () => {
        // Rule 3c: persisted verdict.
        const persisted = await idbGet(id);
        if (persisted) {
            memCache.set(id, persisted);
            return persisted.nsfw;
        }

        // Need the source pixels.
        let imgd = null;
        try { imgd = await getImgData(); } catch (e) { imgd = null; }
        const t = toTransferable(imgd);
        if (!t) {
            console.log("[nsfw]", id, "no image data → fail-open");
            return false;
        }

        let verdict = false, score = 0, porn = 0, hentai = 0, sexy = 0;
        let neutral = 0, drawing = 0, triggers = [], workerMs = 0, backend = null;
        try {
            const res = await postToWorker(
                { type: "classify", id, payload: t.payload, thresholds: config.thresholds },
                t.transfer
            );
            verdict = !!res.nsfw;
            score = res.score || 0;
            porn = res.porn || 0;
            hentai = res.hentai || 0;
            sexy = res.sexy || 0;
            neutral = res.neutral || 0;
            drawing = res.drawing || 0;
            triggers = res.triggers || [];
            workerMs = res.ms || 0;
            backend = res.backend || null;
        } catch (e) {
            console.log("[nsfw]", id, "worker error:", e && e.message);
            return false;
        }

        const rec = { id, nsfw: verdict, score, porn, hentai, sexy, neutral, drawing, triggers, ms: workerMs, backend, ts: Date.now() };
        memCache.set(id, rec);
        idbPut(rec);
        return verdict;
    })();

    inflight.set(id, work);
    try { return await work; }
    finally { inflight.delete(id); }
}

/** Tear down the worker (e.g. when filtering is turned off for the session). */
export function dispose() {
    if (_worker) { try { _worker.terminate(); } catch (e) {} _worker = null; }
    _pending.clear();
    inflight.clear();
}

export default {
    configure,
    ensureNsfw,
    getCached,
    warmup,
    dispose,
};
