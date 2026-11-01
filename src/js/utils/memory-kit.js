/**
 * utils/memory-kit.js — bounded caches, cold storage and release helpers.
 *
 * Drop-in, dependency-free. Four tools:
 *
 *   ByteLRU          a Map with a byte budget, an entry budget and an optional
 *                    TTL; evicts the least recently used entry and calls
 *                    onEvict(key, value, reason) so the owner can close a
 *                    bitmap, revoke an object URL, ...
 *   ColdStore        large, rarely read binary data kept as Blobs. Blob bytes
 *                    live in Chrome's browser process (paged to disk when the
 *                    Blob pool fills), not in the page's renderer, so they
 *                    leave both the JS heap and the "JSArrayBufferData"
 *                    bucket. Optional Cache API persistence survives reloads.
 *   pixel helpers    release canvases, borrow a scratch canvas, ImageData ⇄
 *                    Blob, post pixels to a worker without a copy.
 *   onPageAway       trim hooks for when the page is hidden, frozen or left.
 *
 * Sizes are estimates. A string is counted at 2 bytes per char (worst case for
 * V8, which stores Latin-1 strings such as base64 at 1 byte per char).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Size estimation
// ─────────────────────────────────────────────────────────────────────────────

const has = (name) => typeof globalThis[name] !== "undefined";

export function sizeOf(value) {
    if (value == null) return 0;
    if (typeof value === "string") return value.length * 2;
    if (typeof value === "number" || typeof value === "boolean") return 8;
    if (value instanceof ArrayBuffer) return value.byteLength;
    // A view keeps its WHOLE buffer alive: count the buffer, not the view.
    if (ArrayBuffer.isView(value)) return value.buffer.byteLength;
    if (has("ImageData") && value instanceof ImageData) return value.data.buffer.byteLength;
    if (has("ImageBitmap") && value instanceof ImageBitmap) return value.width * value.height * 4;
    if (has("HTMLCanvasElement") && value instanceof HTMLCanvasElement) return value.width * value.height * 4;
    if (has("OffscreenCanvas") && value instanceof OffscreenCanvas) return value.width * value.height * 4;
    // Blob bytes are outside the renderer; the handle itself is tiny.
    if (has("Blob") && value instanceof Blob) return 64;
    return 256; // plain object: unknown, assume small
}

const cleanSize = (n) => (Number.isFinite(n) && n > 0 ? n : 0);

// ─────────────────────────────────────────────────────────────────────────────
// ByteLRU
// ─────────────────────────────────────────────────────────────────────────────

export class ByteLRU {
    /**
     * @param {object}   [o]
     * @param {number}   [o.maxBytes=Infinity]   byte budget
     * @param {number}   [o.maxEntries=Infinity] entry budget
     * @param {number}   [o.ttlMs=0]             0 = no expiry
     * @param {function} [o.sizeOf]              (value) => bytes
     * @param {function} [o.onEvict]             (key, value, reason) => void, called
     *        for values the cache held and let go: "evicted", "expired",
     *        "deleted", "cleared", "replaced". Never for a value it refused.
     */
    constructor(o = {}) {
        this.maxBytes = o.maxBytes ?? Infinity;
        this.maxEntries = o.maxEntries ?? Infinity;
        this.ttlMs = o.ttlMs ?? 0;
        this.sizeOf = o.sizeOf || sizeOf;
        this.onEvict = o.onEvict || null;
        this._map = new Map(); // key -> { value, bytes, at }
        this._bytes = 0;
    }

    get bytes() { return this._bytes; }
    get size() { return this._map.size; }

    has(key) { return this.peek(key) !== undefined; }

    /** Read without refreshing recency. */
    peek(key) {
        const e = this._map.get(key);
        if (!e) return undefined;
        if (this._expired(e)) { this._drop(key, e, "expired"); return undefined; }
        return e.value;
    }

    /** Read and mark as most recently used. */
    get(key) {
        const e = this._map.get(key);
        if (!e) return undefined;
        if (this._expired(e)) { this._drop(key, e, "expired"); return undefined; }
        this._map.delete(key);
        this._map.set(key, e);
        return e.value;
    }

    /**
     * Insert or update. Calling set() again with the same value re-counts its
     * size (use it after the value grew, e.g. once pixels were decoded).
     * Returns false when the value is larger than the whole budget and was
     * not kept; the caller still owns it.
     */
    set(key, value, bytes) {
        const size = cleanSize(bytes ?? this.sizeOf(value));
        const old = this._map.get(key);
        if (old) {
            this._map.delete(key);
            this._bytes -= old.bytes;
            if (old.value !== value) this._evicted(key, old.value, "replaced");
        }
        if (size > this.maxBytes) return false;
        this._map.set(key, { value, bytes: size, at: Date.now() });
        this._bytes += size;
        this.trim(this.maxBytes, key);
        return true;
    }

    delete(key) {
        const e = this._map.get(key);
        if (!e) return false;
        this._drop(key, e, "deleted");
        return true;
    }

    clear() {
        const entries = [...this._map];
        this._map.clear();
        this._bytes = 0;
        for (const [key, e] of entries) this._evicted(key, e.value, "cleared");
    }

    /**
     * Evict oldest entries until within budget, or within `targetBytes`
     * (e.g. trim(0.5 * maxBytes) when the page is hidden). `keep` is never
     * evicted: the entry being inserted.
     */
    trim(targetBytes = this.maxBytes, keep) {
        for (const [key, e] of this._map) {
            if (this._bytes <= targetBytes && this._map.size <= this.maxEntries) break;
            if (key === keep) continue;
            this._drop(key, e, "evicted");
        }
    }

    /** Drop every entry older than ttlMs (call from a timer or on hide). */
    prune() {
        if (!this.ttlMs) return;
        for (const [key, e] of this._map) if (this._expired(e)) this._drop(key, e, "expired");
    }

    keys() { return this._map.keys(); }

    _expired(e) { return this.ttlMs > 0 && Date.now() - e.at > this.ttlMs; }

    _drop(key, e, reason) {
        this._map.delete(key);
        this._bytes -= e.bytes;
        this._evicted(key, e.value, reason);
    }

    _evicted(key, value, reason) {
        if (!this.onEvict) return;
        try { this.onEvict(key, value, reason); } catch (err) { /* never break the cache */ }
    }
}

/** onEvict helper: frees whatever the evicted value holds. */
export function releaseValue(_key, value) {
    if (!value) return;
    if (has("ImageBitmap") && value instanceof ImageBitmap) value.close();
    else if (typeof value === "string" && value.startsWith("blob:")) URL.revokeObjectURL(value);
    else if ((has("HTMLCanvasElement") && value instanceof HTMLCanvasElement) ||
             (has("OffscreenCanvas") && value instanceof OffscreenCanvas)) releaseCanvas(value);
    else if (typeof value.close === "function") value.close();      // VideoFrame, ImageDecoder
    else if (typeof value.dispose === "function") value.dispose();  // tensors, sessions
}

// ─────────────────────────────────────────────────────────────────────────────
// ColdStore — Blob-backed storage for big, rarely read bytes
// ─────────────────────────────────────────────────────────────────────────────

export class ColdStore {
    /**
     * @param {object} [o]
     * @param {number} [o.maxBytes=256 MiB] budget for Blobs held in memory.
     *        Chrome's own in-memory Blob limit is 2 GB on 64-bit desktop and
     *        RAM/100 on Android; beyond it Chrome pages Blobs to disk.
     * @param {string} [o.cacheName] Cache API name: entries also persist there
     *        and are re-read from disk after eviction or reload. That tier is
     *        NOT size-limited by this class: call delete()/clearPersisted(),
     *        and add the name to the service worker's kept caches.
     */
    constructor(o = {}) {
        this.cacheName = o.cacheName || null;
        this._lru = new ByteLRU({ maxBytes: o.maxBytes ?? 256 * 1024 * 1024, sizeOf: (b) => b.size });
        this._cache = null;
    }

    _openCache() {
        if (!this.cacheName || !has("caches")) return Promise.resolve(null);
        if (!this._cache) {
            this._cache = caches.open(this.cacheName).catch(() => { this._cache = null; return null; });
        }
        return this._cache;
    }

    _url(key) { return `/__cold__/${encodeURIComponent(String(key))}`; }

    /** True when `key` is held in memory (the persisted tier is not checked). */
    has(key) { return this._lru.has(key); }

    /** Store bytes (ArrayBuffer, typed array, Blob). Returns the Blob. */
    async put(key, data, type = "application/octet-stream") {
        if (data == null) throw new TypeError("ColdStore.put: no data");
        const blob = data instanceof Blob ? data : new Blob([data], { type });
        this._lru.set(key, blob, blob.size);
        const cache = await this._openCache();
        if (cache) await cache.put(this._url(key), new Response(blob, { headers: { "content-type": blob.type } }));
        return blob;
    }

    async getBlob(key) {
        const hit = this._lru.get(key);
        if (hit) return hit;
        const cache = await this._openCache();
        if (!cache) return null;
        const res = await cache.match(this._url(key));
        if (!res) return null;
        const blob = await res.blob();
        this._lru.set(key, blob, blob.size);
        return blob;
    }

    /** Each call allocates a fresh ArrayBuffer: read once, use, drop. */
    async getArrayBuffer(key) {
        const blob = await this.getBlob(key);
        return blob ? blob.arrayBuffer() : null;
    }

    /** Decode straight to an ImageBitmap: no ArrayBuffer copy on the JS side. */
    async getBitmap(key, options) {
        const blob = await this.getBlob(key);
        return blob ? createImageBitmap(blob, options) : null;
    }

    async delete(key) {
        this._lru.delete(key);
        const cache = await this._openCache();
        if (cache) await cache.delete(this._url(key));
    }

    /** Forget in-memory Blobs; persisted copies stay in the Cache API. */
    dropMemory() { this._lru.clear(); }

    /** Delete the persisted tier as well. */
    async clearPersisted() {
        this._lru.clear();
        if (this.cacheName && has("caches")) { this._cache = null; await caches.delete(this.cacheName); }
    }

    get bytesInMemory() { return this._lru.bytes; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pixel helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shrink a canvas to 1×1 so its backing store is released. Pass the WebGL
 * context too if the canvas has one: losing it frees its GPU resources.
 */
export function releaseCanvas(canvas, gl) {
    if (!canvas) return;
    if (gl) {
        try { const ext = gl.getExtension("WEBGL_lose_context"); if (ext) ext.loseContext(); } catch (e) { /* ignore */ }
    }
    canvas.width = 1;
    canvas.height = 1;
}

function makeScratch(willReadFrequently) {
    const canvas = has("OffscreenCanvas") ? new OffscreenCanvas(1, 1) : document.createElement("canvas");
    return { canvas, ctx: canvas.getContext("2d", { willReadFrequently }), busy: false };
}
const _scratch = new Map(); // willReadFrequently -> { canvas, ctx, busy }

/**
 * Run fn(ctx, canvas) on a scratch 2D canvas sized w×h, then shrink it.
 * Reusing the canvas saves allocation; the shrink is what stops a 16× upscale
 * from pinning hundreds of MB after the job. `fn` must be synchronous: the
 * canvas is shrunk as soon as it returns. Re-entrant calls get their own
 * temporary canvas.
 */
export function withScratch2D(w, h, fn, { willReadFrequently = true } = {}) {
    let s = _scratch.get(willReadFrequently);
    if (!s) { s = makeScratch(willReadFrequently); _scratch.set(willReadFrequently, s); }
    else if (s.busy) s = makeScratch(willReadFrequently);
    const { canvas, ctx } = s;
    s.busy = true;
    canvas.width = w;
    canvas.height = h;
    try {
        const out = fn(ctx, canvas);
        if (out && typeof out.then === "function") throw new TypeError("withScratch2D: fn must be synchronous");
        return out;
    } finally {
        canvas.width = 1;
        canvas.height = 1;
        s.busy = false;
    }
}

/**
 * ImageData → compressed Blob. How well it compresses depends on the
 * renderer: in a test, an 8× render of a 64×64, 16-colour sprite shrank about
 * 116× with nearest-neighbour, 58× hex, 15× xBRZ and only 3× CRT.
 * Canvas encoding premultiplies alpha, so semi-transparent pixels (xBRZ
 * edges) may shift slightly on the way back.
 */
export async function imageDataToBlob(imgd, type = "image/png") {
    if (has("OffscreenCanvas")) {
        const c = new OffscreenCanvas(imgd.width, imgd.height);
        c.getContext("2d").putImageData(imgd, 0, 0);
        try { return await c.convertToBlob({ type }); } finally { releaseCanvas(c); }
    }
    const c = document.createElement("canvas");
    c.width = imgd.width; c.height = imgd.height;
    c.getContext("2d").putImageData(imgd, 0, 0);
    try {
        return await new Promise((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error("toBlob failed"))), type));
    } finally {
        releaseCanvas(c);
    }
}

/** Blob → ImageData, via a bitmap and a scratch canvas that is shrunk after. */
export async function blobToImageData(blob) {
    const bmp = await createImageBitmap(blob, { premultiplyAlpha: "none", colorSpaceConversion: "none" });
    try {
        return withScratch2D(bmp.width, bmp.height, (ctx) => {
            ctx.drawImage(bmp, 0, 0);
            return ctx.getImageData(0, 0, bmp.width, bmp.height);
        });
    } finally {
        bmp.close();
    }
}

/**
 * postMessage an ImageData's pixels without copying them when possible: the
 * buffer is moved, so imgd.data is detached here afterwards. A view onto part
 * of a larger buffer (a WebAssembly heap, a pool's output slab) or a
 * SharedArrayBuffer is copied first, since moving it would take the whole
 * buffer, or is impossible.
 */
export function postImageData(target, imgd, extra = {}) {
    let px = imgd.data;
    const shared = has("SharedArrayBuffer") && px.buffer instanceof SharedArrayBuffer;
    if (shared || px.byteOffset !== 0 || px.byteLength !== px.buffer.byteLength) px = px.slice();
    const msg = { ...extra, width: imgd.width, height: imgd.height, pixels: px.buffer };
    try {
        target.postMessage(msg, [px.buffer]);
    } catch (e) {                      // not transferable (e.g. a WebAssembly.Memory buffer)
        const copy = px.slice();
        target.postMessage({ ...msg, pixels: copy.buffer }, [copy.buffer]);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Budgets and page lifecycle
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A budget scaled to the device. navigator.deviceMemory is a rounded GB value
 * that only Chromium reports; elsewhere (Safari, Firefox) this assumes 4 GB,
 * i.e. half the desktop budget.
 */
export function budgetBytes(desktopBytes, { minBytes = desktopBytes / 8, assumeGb = 4 } = {}) {
    const gb = (typeof navigator !== "undefined" && navigator.deviceMemory) || assumeGb;
    return Math.max(minBytes, Math.round(desktopBytes * Math.min(1, gb / 8)));
}

/**
 * Call fn("hidden" | "freeze" | "pagehide") when the page is put away, so
 * caches can trim to a low-water mark. The web has no memory-pressure event;
 * these lifecycle moments are the usual proxy. Returns an unsubscribe function.
 */
export function onPageAway(fn) {
    if (typeof document === "undefined") return () => {};
    const onVis = () => { if (document.visibilityState === "hidden") fn("hidden"); };
    const onFreeze = () => fn("freeze");
    const onHide = () => fn("pagehide");
    document.addEventListener("visibilitychange", onVis);
    document.addEventListener("freeze", onFreeze);
    window.addEventListener("pagehide", onHide);
    return () => {
        document.removeEventListener("visibilitychange", onVis);
        document.removeEventListener("freeze", onFreeze);
        window.removeEventListener("pagehide", onHide);
    };
}
