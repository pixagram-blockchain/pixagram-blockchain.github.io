/**
 * YOLOBuffer — You Only Look Once.
 *
 * A self-zeroing buffer for sensitive cryptographic key material.
 * Designed to minimize the lifetime of plaintext secrets in memory.
 *
 * Principles:
 *   1. The internal buffer is the ONLY copy — no intermediate strings.
 *   2. On consume (getter `.bytes`), the SAME array is handed to the caller
 *      and the internal reference is released. There is no copy and nothing
 *      is zeroed at this point: after `.bytes`, the caller holds the one
 *      live copy of the secret and MUST zero it. Prefer `.use()`, which
 *      does that for you even if the callback throws.
 *   3. On `.destroy()`, the buffer is filled with zeros unconditionally.
 *   4. If neither is called, the FinalizationRegistry callback zeros
 *      the buffer when the YOLOBuffer is garbage-collected (best-effort).
 *   5. A YOLOBuffer can only be consumed ONCE. Subsequent reads throw.
 *
 * Usage in the signing path:
 *
 *   // Pattern A: Scoped (PREFERRED — cleanup is guaranteed on throw)
 *   const yolo = await keyManager.requestKeyBuffer(account, 'posting');
 *   const result = await yolo.use(async (bytes) => {          // ① auto-zeroed
 *       const pk = PrivateKey.fromBuffer(Buffer.from(bytes));  // ② a COPY
 *       try { return await client.broadcast.vote(op, pk); }
 *       finally { pk.key?.fill?.(0); }                         // ③ zero it
 *   });
 *
 *   // Pattern B: Manual lifecycle — only if you cannot use a callback
 *   const raw = yolo.bytes;                          // ① you now own this
 *   try {
 *       const pk = PrivateKey.fromBuffer(Buffer.from(raw));
 *       try { return await sign(pk); }
 *       finally { pk.key?.fill?.(0); }               // ② PrivateKey's copy
 *   } finally {
 *       raw.fill(0);                                 // ③ your copy
 *   }
 *
 * NOTE: `Buffer.from(bytes)` / `PrivateKey.fromBuffer()` COPY the secret.
 * Zeroing the YOLOBuffer's bytes does not reach those copies — every
 * derived copy needs its own cleanup, as shown above.
 *
 * @version 2.1.0
 * @module YOLOBuffer
 */

import { CryptoUtils } from './crypto-utils.js';

// ============================================
// YOLOBuffer Class
// ============================================

export class YOLOBuffer {

    // ── Private instance fields ─────────────────────

    /** @type {Uint8Array|null} — the secret bytes (nulled after consume/destroy) */
    #buffer;
    /** @type {boolean} — whether bytes have been consumed or destroyed */
    #consumed;
    /** @type {number} — original byte length (preserved for introspection) */
    #originalLength;

    // ── GC safety net (class-level singleton) ───────

    /**
     * @type {FinalizationRegistry|null}
     *
     * The held value describes only OUR region of the backing store.
     * Previously the whole ArrayBuffer was zeroed, so wrapping a view into a
     * larger buffer (e.g. a slice of a decryption output) would wipe unrelated
     * bytes belonging to someone else once this object was collected.
     */
    static #registry = typeof FinalizationRegistry !== 'undefined'
        ? new FinalizationRegistry(({ buffer, byteOffset, byteLength }) => {
            try {
                if (buffer?.byteLength > 0 && byteLength > 0) {
                    new Uint8Array(buffer, byteOffset, byteLength).fill(0);
                }
            } catch { /* ArrayBuffer may already be detached */ }
        })
        : null;

    // ── Constructor ─────────────────────────────────

    /**
     * Create a YOLOBuffer from raw bytes.
     *
     * IMPORTANT: The input Uint8Array is NOT copied — YOLOBuffer takes
     * ownership. The caller MUST NOT retain or reuse the input array.
     *
     * For string inputs, use the static factories instead:
     *   YOLOBuffer.fromString(wif)
     *   YOLOBuffer.fromHex(hex)
     *
     * @param {Uint8Array} data — Raw key bytes. Ownership is transferred.
     * @throws {TypeError} If data is not a Uint8Array
     * @throws {RangeError} If data is empty
     */
    constructor(data) {
        if (!(data instanceof Uint8Array)) {
            throw new TypeError('YOLOBuffer requires Uint8Array — use .fromString() or .fromHex() for strings');
        }
        if (data.length === 0) {
            throw new RangeError('YOLOBuffer cannot wrap an empty buffer');
        }

        this.#buffer = data;
        this.#consumed = false;
        this.#originalLength = data.length;

        YOLOBuffer.#registry?.register(this, {
            buffer:     data.buffer,
            byteOffset: data.byteOffset,
            byteLength: data.byteLength,
        }, this);
    }

    // ── Static factories ────────────────────────────

    /**
     * Create from a JS string (e.g. WIF key).
     *
     * The source string cannot be zeroed (JS string immutability),
     * but the YOLOBuffer owns a mutable byte copy that CAN be zeroed.
     *
     * @param {string} str — Sensitive string to wrap
     * @returns {YOLOBuffer}
     */
    static fromString(str) {
        if (typeof str !== 'string' || str.length === 0) {
            throw new TypeError('YOLOBuffer.fromString requires a non-empty string');
        }
        return new YOLOBuffer(new TextEncoder().encode(str));
    }

    /**
     * Create from a hex-encoded string.
     *
     * @param {string} hex — Hex-encoded key material (even length)
     * @returns {YOLOBuffer}
     */
    static fromHex(hex) {
        if (typeof hex !== 'string' || hex.length === 0 || hex.length % 2 !== 0) {
            throw new TypeError('YOLOBuffer.fromHex requires a valid even-length hex string');
        }
        // Delegated: the old inline parseInt() loop turned invalid hex into 0x00
        // bytes silently, which for key material means "a key of zeros".
        return new YOLOBuffer(CryptoUtils.hexToBytes(hex));
    }

    /**
     * Create filled with cryptographically random bytes.
     *
     * @param {number} length — Number of random bytes
     * @returns {YOLOBuffer}
     */
    static random(length) {
        // Delegated: this had the same unreachable require('crypto') branch as
        // CryptoUtils, plus no chunking above the 65 536-byte getRandomValues cap.
        return new YOLOBuffer(CryptoUtils.getRandomBytes(length));
    }

    // ── Core API ────────────────────────────────────

    /**
     * Consume the buffer — one-shot read.
     *
     * Returns the internal Uint8Array and surrenders ownership.
     * The caller receives the only live copy and MUST zero it after use.
     *
     * @returns {Uint8Array} Raw key bytes (caller owns this reference)
     * @throws {Error} If already consumed or destroyed
     */
    get bytes() {
        if (this.#consumed) {
            throw new Error('YOLOBuffer: already consumed — key material is gone');
        }

        this.#consumed = true;
        const out = this.#buffer;
        this.#buffer = null;

        YOLOBuffer.#registry?.unregister(this);
        return out;
    }

    /**
     * Explicitly zero and release the buffer without reading it.
     *
     * Use when an operation is aborted or an error occurs before
     * the key is needed. Safe to call multiple times.
     */
    destroy() {
        if (this.#buffer) {
            this.#buffer.fill(0);
            this.#buffer = null;
        }
        this.#consumed = true;
        YOLOBuffer.#registry?.unregister(this);
    }

    // ── Introspection (no key material exposed) ─────

    /** Whether the buffer has been consumed or destroyed. */
    get isConsumed() {
        return this.#consumed;
    }

    /** Whether the buffer still holds live key material. */
    get isLive() {
        return !this.#consumed && this.#buffer !== null;
    }

    /** Original byte length (available even after consumption). */
    get length() {
        return this.#originalLength;
    }

    // ── Serialization guards ────────────────────────

    /** Prevent accidental JSON serialization of key material. */
    toJSON() {
        return { consumed: this.#consumed, length: this.#originalLength };
    }

    /** Prevent accidental string coercion of key material. */
    toString() {
        return `[YOLOBuffer ${this.#consumed ? 'consumed' : 'live'} ${this.#originalLength}B]`;
    }

    /** Prevent key leakage via Node.js console.log / util.inspect. */
    [Symbol.for('nodejs.util.inspect.custom')]() {
        return this.toString();
    }

    // ── Scoped access (static) ──────────────────────

    /**
     * Execute a callback with the raw bytes and guarantee cleanup.
     *
     * This is the preferred usage pattern — it ensures the byte array
     * is zeroed even if the callback throws.
     *
     * Remember that anything the callback COPIES out of `bytes`
     * (`Buffer.from`, `PrivateKey.fromBuffer`, `TextDecoder.decode`) is not
     * covered by this cleanup and must be zeroed by the callback itself.
     *
     * @template T
     * @param {YOLOBuffer} yoloBuf — Buffer to consume
     * @param {function(Uint8Array): Promise<T>|T} fn — Callback receiving raw bytes
     * @returns {Promise<T>} Result of the callback
     */
    static async use(yoloBuf, fn) {
        const raw = yoloBuf.bytes;
        try {
            return await fn(raw);
        } finally {
            raw.fill(0);
        }
    }

    /**
     * Instance form of {@link YOLOBuffer.use} — `yolo.use(fn)`.
     *
     * Preferred over reading `.bytes` directly: manual call sites have to
     * remember three separate cleanups and historically only did one.
     *
     * @template T
     * @param {function(Uint8Array): Promise<T>|T} fn — Callback receiving raw bytes
     * @returns {Promise<T>} Result of the callback
     */
    async use(fn) {
        return YOLOBuffer.use(this, fn);
    }
}

export default YOLOBuffer;
