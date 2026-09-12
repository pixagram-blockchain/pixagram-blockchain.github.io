/**
 * YOLOBuffer — You Only Look Once.
 *
 * A self-zeroing buffer for sensitive cryptographic key material.
 * Designed to minimize the lifetime of plaintext secrets in memory.
 *
 * Principles:
 *   1. The YOLOBuffer owns the ONLY copy of the bytes it was given. The
 *      constructor copies the input into an off-heap buffer
 *      (CryptoUtils.secureAlloc) and zeros the input in place. Nothing
 *      inside the class ever turns the bytes into a string.
 *   2. On consume (`.take()`), the SAME array is handed to the caller and
 *      the internal reference is released. There is no copy and nothing is
 *      zeroed at this point: after `.take()`, the caller holds the one live
 *      copy of the secret and MUST zero it. Prefer `.use()`, which does that
 *      for you even if the callback throws.
 *   3. On `.destroy()`, the buffer is filled with zeros unconditionally.
 *   4. If neither is called, the FinalizationRegistry callback zeros the
 *      buffer when the YOLOBuffer is garbage-collected (best-effort — it
 *      never runs on page unload, and never for an object something still
 *      references).
 *   5. A YOLOBuffer can only be consumed ONCE. Subsequent reads throw.
 *
 * Why the constructor copies (v2.2): V8 keeps typed arrays of ≤ 64 bytes on
 * its managed heap, where the GC moves them and leaves unzeroed copies
 * behind, and reading `.buffer` on such an array materialises an off-heap
 * backing store by memcpy while abandoning the on-heap original unzeroed.
 * Every key this class wraps (32-byte secret, 51-byte WIF) is under that
 * threshold, and v2.1's constructor read `data.buffer` to register the GC
 * safety net — i.e. it created exactly the copy it was meant to prevent.
 * Now the input is copied into an explicit ArrayBuffer (always off-heap)
 * and zeroed BEFORE anything touches `.buffer`.
 *
 * Usage in the signing path:
 *
 *   // Pattern A: scoped (PREFERRED — cleanup is guaranteed on throw).
 *   // Sign inside the callback, broadcast OUTSIDE it: the key's lifetime
 *   // must not span a network round-trip.
 *   const yolo = await keyManager.requestKeyBuffer(account, 'posting');
 *   const signed = await yolo.use((bytes) => {                    // ① bytes auto-zeroed
 *       const pk = PrivateKey.fromString(new TextDecoder().decode(bytes)); // ② a COPY (+ a WIF string until raw-32 storage lands)
 *       try { return client.broadcast.sign(tx, pk); }             //    sync — no await in here
 *       finally { zeroPrivateKey(pk); }                           // ③ zero dpixa's copy (`.secret`)
 *   });
 *   await client.broadcast.send(signed);                          // key material is already gone
 *
 *   // Pattern B: manual lifecycle — only if you cannot use a callback
 *   const raw = yolo.take();                         // ① you now own this
 *   try {
 *       const pk = PrivateKey.fromString(new TextDecoder().decode(raw));
 *       try { return sign(pk); }
 *       finally { zeroPrivateKey(pk); }              // ② PrivateKey's copy
 *   } finally {
 *       raw.fill(0);                                 // ③ your copy
 *   }
 *
 *   // Pattern C: `using` (Explicit Resource Management, where available)
 *   using yolo = sm.getKeyAsYOLO('posting');         // destroy() runs at scope exit
 *
 * NOTE: anything that copies the secret out of `bytes` — `TextDecoder.decode`,
 * `PrivateKey.fromString`, `Uint8Array.from`, `.slice()` — is not covered by
 * this cleanup. Every derived copy needs its own cleanup, and JS strings can
 * never be zeroed at all. dpixa's PrivateKey keeps the 32 raw bytes in
 * `.secret`; zero that field, and do it without optional chaining so a
 * renamed field fails loudly instead of silently skipping the cleanup.
 *
 * Known limits (not fixable from JS): the signing library converts the
 * scalar to a BigInt (immutable) and hmac-drbg copies the key for RFC 6979;
 * strings are never zeroed. What remains controllable is lifetime — keep it
 * to the signature, not the broadcast.
 *
 * @version 2.2.0
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
     * The held value describes only OUR region of the backing store. Since
     * v2.2 the YOLOBuffer always owns a whole, dedicated ArrayBuffer, so the
     * region is the entire buffer — the offset/length form is kept so a
     * future zero-copy constructor path stays safe.
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

    // ── Explicit Resource Management ────────────────

    /**
     * `using yolo = …` support. Defined only where the runtime has
     * Symbol.dispose (Chromium 134+, Firefox 134+, Node 24+); a computed key
     * of `undefined` would otherwise create a method literally named
     * "undefined".
     */
    static {
        if (typeof Symbol.dispose === 'symbol') {
            Object.defineProperty(YOLOBuffer.prototype, Symbol.dispose, {
                value() { this.destroy(); },
                writable: true, configurable: true, enumerable: false,
            });
        }
    }

    // ── Constructor ─────────────────────────────────

    /**
     * Create a YOLOBuffer from raw bytes.
     *
     * The input is COPIED into a dedicated off-heap buffer and then ZEROED
     * in place. After construction the caller's array contains zeros; the
     * YOLOBuffer holds the only live copy. (v2.1 took ownership of the
     * caller's array instead — see the header for why that leaked.)
     *
     * For string inputs, use the static factories instead:
     *   YOLOBuffer.fromString(wif)
     *   YOLOBuffer.fromHex(hex)
     *
     * @param {Uint8Array} data — Raw key bytes. Zeroed on return.
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

        // Copy first, zero second, and never read `data.buffer`: on an
        // on-heap typed array that access materialises an unzeroed copy.
        const own = CryptoUtils.secureCopy(data);
        data.fill(0);

        this.#buffer = own;
        this.#consumed = false;
        this.#originalLength = own.length;

        YOLOBuffer.#registry?.register(this, {
            buffer:     own.buffer,
            byteOffset: 0,
            byteLength: own.byteLength,
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
        // TextEncoder output is off-heap already; the constructor copies it
        // once more and zeros this intermediate.
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
        // CryptoUtils.hexToBytes throws on any non-hex character.
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
     * Prefer {@link YOLOBuffer#use}.
     *
     * @returns {Uint8Array} Raw key bytes (caller owns this reference)
     * @throws {Error} If already consumed or destroyed
     */
    take() {
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
     * @deprecated since 2.2 — use {@link YOLOBuffer#take}. A consuming
     * getter reads like a free peek: `yolo.bytes.length` in a log line
     * silently eats the key and disarms the GC safety net. Same semantics
     * as take(), kept for existing call sites.
     * @returns {Uint8Array}
     */
    get bytes() {
        return this.take();
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
     * is zeroed even if the callback throws. The bytes are zeroed when
     * the callback's result settles, so do NOT await network I/O inside
     * the callback: sign in here, broadcast outside (see header).
     *
     * Remember that anything the callback COPIES out of `bytes`
     * (`TextDecoder.decode`, `PrivateKey.fromString`, `.slice()`) is not
     * covered by this cleanup and must be zeroed by the callback itself.
     *
     * @template T
     * @param {YOLOBuffer} yoloBuf — Buffer to consume
     * @param {function(Uint8Array): Promise<T>|T} fn — Callback receiving raw bytes
     * @returns {Promise<T>} Result of the callback
     */
    static async use(yoloBuf, fn) {
        const raw = yoloBuf.take();
        try {
            return await fn(raw);
        } finally {
            raw.fill(0);
        }
    }

    /**
     * Instance form of {@link YOLOBuffer.use} — `yolo.use(fn)`.
     *
     * Preferred over reading `.take()` directly: manual call sites have to
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