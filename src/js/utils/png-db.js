import { ready, hashBase58, toBytes } from '@pixagram/pixahash';

import { default as decodeWEBP } from '@jsquash/webp/decode';
import { default as decodePNG } from '@jsquash/png/decode';
import { B64chromium } from 'chromium-base64';
import { probeImageSync } from './image-probe';

const _b64 = new B64chromium();
const base64ToBytes = _b64.base64ToBytes.bind(_b64);

// Warm up the WASM hasher during module load so the first hash doesn't wait on
// instantiation. `ready()` is memoized, so awaiting this promise later is free.
const hashReady = ready();

// --- Constants ---
const DATA_IMG_PREFIX = "data:image/";
const WEBP_PREFIX = "data:image/webp;base64,";
const PNG_PREFIX = "data:image/png;base64,";
// Entry cache capacity. Each entry holds the raw payload bytes, the probed
// size, and — once the background decode lands — the SOURCE-resolution
// ImageData, all keyed together under one content hash. Sources are pixel
// art, so entries are small (a 128×128 RGBA source is 64 KiB of ImageData);
// 400 entries covers a long feed session for low tens of MB. Upscaled output
// is deliberately NOT stored here — that lives in render-pool's LRU.
//
// Why not a WeakMap/WeakSet: weak collections can't do this job. Keys here
// are content-hash strings (WeakMap keys must be objects), and weak
// collections are non-enumerable and unbounded — "keep exactly the last 400"
// is impossible to express, and an ImageData referenced only by a weak cache
// is collectable immediately, turning hit rates into GC-timing roulette. A
// bounded strong ring gives the same intent (small, capped, auto-evicting)
// deterministically.
const CACHE_SIZE = 400;
// Width of the content-id hash. 64 bits → ~11-char base58 ids, with collision
// probability negligible for a content cache of this size.
const HASH_BITS = 64;
// Hard cap on the permanently-failed blacklist so it can't grow without bound
// over a long session (each miss otherwise adds an entry forever).
const FAILED_SET_LIMIT = 300;

// --- Helper Functions ---

/**
 * Converts a base64 data URI to a Uint8Array.
 * Returns null on malformed input instead of throwing.
 */
function dataUriToBytes(dataUri, start) {
    const commaIndex = start || dataUri.indexOf(',');
    if (commaIndex === -1) return null;
    try {
        return base64ToBytes(dataUri.substring(commaIndex + 1));
    } catch {
        return null;
    }
}

/** Identifies the image type from a data URI prefix. */
function identifyType(input) {
    if (input.startsWith(WEBP_PREFIX)) return ["WEBP", 22];
    if (input.startsWith(PNG_PREFIX)) return ["PNG", 21];
    if (input.startsWith(DATA_IMG_PREFIX)) return ["UNKNOWN", 0];
    return ["STRING", 0];
}

/**
 * Hashes the input string and returns bytes + type + hash.
 * Returns null if input is invalid or base64 decoding fails.
 * Assumes the WASM hasher is ready (callers await `hashReady` first).
 */
function hashThat(input) {
    if (typeof input !== "string" || input.length === 0) return null;

    const [type, start] = identifyType(input);
    const data = type !== "STRING" ? dataUriToBytes(input, start) : toBytes(input);
    if (!data) return null;

    // Key on the decoded payload bytes (base64 payload for data URIs, UTF-8
    // bytes for plain strings). Unchanged derivation — ids stay stable.
    const hash = hashBase58(new Uint8Array(data.buffer), 0, HASH_BITS);
    return { data, type, hash };
}

/**
 * Decodes image data and returns dimensions + decoded pixel data.
 * Returns null on any decode failure.
 */
async function decodeImage(type, data) {
    try {
        if (type === "PNG") return await decodePNG(data);
        if (type === "WEBP") return await decodeWEBP(data);
    } catch {
        return null;
    }
    return null;
}

// --- Core Cache Implementation ---

/** Fixed-size circular buffer cache. */
class FixedSizeCache {
    constructor(size) {
        // Clamp to ≥1: a 0 size makes `cursor = (cursor + 1) % 0` NaN, after
        // which every insert lands on the same "NaN" slot and the ring
        // silently degrades to ~2 live entries. Never let that happen again.
        this.size = Math.max(1, size | 0);
        this.storageArray = new Array(this.size).fill(null);
        this.hashIndexMap = new Map();
        this.cursor = 0;
    }

    has(hash) {
        return this.hashIndexMap.has(hash);
    }

    get(hash) {
        const idx = this.hashIndexMap.get(hash);
        return idx !== undefined ? this.storageArray[idx].value : undefined;
    }

    set(hash, item) {
        if (this.hashIndexMap.has(hash)) {
            this.storageArray[this.hashIndexMap.get(hash)].value = item;
            return;
        }

        const oldEntry = this.storageArray[this.cursor];
        if (oldEntry) {
            this.hashIndexMap.delete(oldEntry.key);
        }

        this.storageArray[this.cursor] = { key: hash, value: item };
        this.hashIndexMap.set(hash, this.cursor);
        this.cursor = (this.cursor + 1) % this.size;
    }

    delete(hash) {
        const idx = this.hashIndexMap.get(hash);
        if (idx === undefined) return;
        this.hashIndexMap.delete(hash);
        this.storageArray[idx] = null;
    }
}

// --- Public API ---

export const pngdb = () => {
    // Content hash → { id, type, data, width, height, decoded }. Size arrives
    // first (header probe); `decoded` (ImageData) is filled in by the
    // background decode. Both live in the SAME entry so "base64 → size" and
    // "base64 → ImageData" are one lookup with one eviction policy.
    const imgCache = new FixedSizeCache(CACHE_SIZE);
    // Fast path: exact input string → hash. Skips the base64 decode + hash on
    // repeated lookups of the same data URI (the common case when feed tiles
    // re-render). Bounded like imgCache; keys are references to strings the
    // caller already holds, so no copies are made.
    const keyCache = new FixedSizeCache(CACHE_SIZE);
    // Track permanently failed hashes so we never re-attempt them (bounded).
    const failedSet = new Set();
    // In-flight decodes, keyed by hash — concurrent calls for the same image
    // share one decode instead of each paying for their own.
    const pendingDecodes = new Map();

    const addFailed = (hash) => {
        if (failedSet.size >= FAILED_SET_LIMIT) {
            // Sets iterate in insertion order — drop the oldest half.
            // Floor at 1 so the countdown always terminates (a 0 start
            // would decrement past 0 and clear the entire set).
            let n = Math.max(1, FAILED_SET_LIMIT >> 1);
            for (const h of failedSet) {
                failedSet.delete(h);
                if (--n === 0) break;
            }
        }
        failedSet.add(hash);
    };

    const snapshot = (entry) =>
        ({ id: entry.id, type: entry.type, data: entry.data, width: entry.width, height: entry.height });

    /**
     * Full pixel decode for an entry, shared across concurrent callers AND
     * across the warm-up path: at most one decode is ever in flight per
     * content hash. Resolves to ImageData or null. On failure the hash is
     * blacklisted and the size entry dropped, so the id stops resolving to
     * a card that could never paint.
     */
    const decodeEntry = (entry) => {
        let pending = pendingDecodes.get(entry.id);
        if (pending) return pending;
        pending = (async () => {
            const decoded = await decodeImage(entry.type, entry.data);
            if (!decoded || !(decoded.width > 0) || !(decoded.height > 0)) {
                // Valid-looking header but undecodable body — blacklist.
                addFailed(entry.id);
                imgCache.delete(entry.id);
                return null;
            }
            entry.decoded = decoded;
            // The container header is authoritative for layout, but if the
            // decoder ever disagrees, the pixels win.
            entry.width = decoded.width;
            entry.height = decoded.height;
            // Re-pin if the ring evicted the entry while the decode ran; if
            // a REPLACEMENT entry for the same id was created in the
            // meantime (evicted-then-reprobed race), hydrate that one too so
            // the shared result isn't decoded a second time.
            const live = imgCache.get(entry.id);
            if (live === undefined) {
                imgCache.set(entry.id, entry);
            } else if (live !== entry) {
                live.decoded = decoded;
                live.width = decoded.width;
                live.height = decoded.height;
            }
            return decoded;
        })();
        pendingDecodes.set(entry.id, pending);
        pending.finally(() => pendingDecodes.delete(entry.id));
        return pending;
    };

    // ── Warm-up queue ────────────────────────────────────────────────
    // Background decodes run one at a time with a yield in between, so a
    // burst of 40 freshly-probed tiles doesn't stack 40 synchronous WASM
    // decodes into one frame while the masonry is laying out. This queue
    // is strictly non-critical: get_new_img_data() calls decodeEntry()
    // directly (priority lane), and pendingDecodes dedupes if the same
    // entry's warm-up is already running.
    const warmQueue = [];
    let warming = false;
    const drainWarmQueue = async () => {
        if (warming) return;
        warming = true;
        while (warmQueue.length > 0) {
            const entry = warmQueue.shift();
            if (entry.decoded || failedSet.has(entry.id)) continue;
            try { await decodeEntry(entry); } catch { /* absorbed */ }
            // Yield between decodes so paint/scroll stays responsive.
            await new Promise((res) => setTimeout(res, 0));
        }
        warming = false;
    };
    const warmEntry = (entry) => {
        warmQueue.push(entry);
        drainWarmQueue();
    };

    /**
     * Returns image metadata (id, type, data, width, height) — FAST.
     *
     * Dimensions come from a header-only probe (no pixel decode), so this
     * resolves in microseconds and the masonry can lay out immediately. As a
     * side effect it enqueues the full pixel decode in the background, so by
     * the time a card asks for ImageData it is usually ready or in flight.
     *
     * Returns null if the image cannot be parsed — the entry is blacklisted
     * so subsequent calls for the same input short-circuit.
     */
    const get_new_img_obj = async (base64) => {
        await hashReady;

        // String-identity fast path: no base64 decode, no hashing.
        const knownHash = keyCache.get(base64);
        if (knownHash !== undefined) {
            if (failedSet.has(knownHash)) return null;
            if (imgCache.has(knownHash)) return snapshot(imgCache.get(knownHash));
            // Cache entry was evicted — fall through to recover data/type.
        }

        const parsed = hashThat(base64);
        if (!parsed) return null;

        const { hash, type, data } = parsed;
        keyCache.set(base64, hash);

        if (failedSet.has(hash)) return null;

        if (imgCache.has(hash)) {
            return snapshot(imgCache.get(hash));
        }

        // ── Fast path: header-only probe ─────────────────────────────
        // Decoding base64 is cheap (already done for hashing); decoding
        // pixels is not. Read width/height straight from the container
        // header and return — the expensive decode happens off-path.
        const probed = probeImageSync(data);
        // A data URI with an unrecognized prefix can still be a decodable
        // PNG/WEBP under the hood — trust the header over the label.
        const resolvedType =
            type === "UNKNOWN" && probed
                ? (probed.type === "png" ? "PNG" : probed.type === "webp" ? "WEBP" : type)
                : type;

        if (probed && probed.width > 0 && probed.height > 0 &&
            (resolvedType === "PNG" || resolvedType === "WEBP")) {
            const entry = {
                id: hash,
                type: resolvedType,
                data,
                width: probed.width,
                height: probed.height,
                decoded: null,
            };
            imgCache.set(hash, entry);
            // Non-critical for the masonry: start computing the ImageData
            // now so the render path finds it ready. Fire and forget —
            // failures are absorbed and blacklisted inside decodeEntry.
            warmEntry(entry);
            return snapshot(entry);
        }

        // ── Fallback: probe couldn't identify a decodable image ──────
        // (corrupt/unknown header). The full decode is the source of
        // truth, exactly as before probing existed.
        const entry = { id: hash, type: resolvedType, data, width: 0, height: 0, decoded: null };
        const decoded = await decodeEntry(entry);
        return decoded ? snapshot(entry) : null;
    };

    /**
     * Returns decoded pixel data (ImageData) for a previously-fetched
     * img_obj. Usually just joins the background decode that
     * get_new_img_obj already started; pays for a decode itself only if
     * the entry was evicted or the warm-up hasn't reached it yet.
     * Returns null if decode fails or img_obj is invalid.
     */
    const get_new_img_data = async (img_obj) => {
        if (!img_obj || !img_obj.id) return null;
        if (failedSet.has(img_obj.id)) return null;

        if (imgCache.has(img_obj.id)) {
            const cached = imgCache.get(img_obj.id);
            if (cached.decoded) return cached.decoded;
            // Priority lane: joins the in-flight warm decode if there is
            // one, otherwise starts the decode immediately (ahead of any
            // queued warm-ups).
            return decodeEntry(cached);
        }

        // Entry was evicted between measure and render — rebuild it from
        // the snapshot (it carries type + payload bytes) and decode once,
        // shared. Re-inserting means a post-eviction re-decode is paid at
        // most once instead of on every call.
        const entry = {
            id: img_obj.id,
            type: img_obj.type,
            data: img_obj.data,
            width: img_obj.width | 0,
            height: img_obj.height | 0,
            decoded: null,
        };
        imgCache.set(entry.id, entry);
        return decodeEntry(entry);
    };

    return { get_new_img_obj, get_new_img_data };
};

export const pngdby = pngdb();