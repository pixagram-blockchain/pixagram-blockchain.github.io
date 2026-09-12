/**
 * CryptoUtils — Shared cryptographic primitives.
 *
 * Single source of truth for byte generation, hex encoding, and
 * ID creation. Replaces identical copy-pasted helpers in
 * session-manager.js, broadcast-queue.js, and pixaproxyapi.js.
 *
 * All methods are static — no instantiation needed.
 *
 * v1.1.0:
 *   - secureAlloc() / secureCopy(): buffers for key material are allocated
 *     with an explicit ArrayBuffer so their backing store is off the JS
 *     engine's moving heap (see secureAlloc for the why). getRandomBytes()
 *     uses it, so YOLOBuffer.random() and friends are off-heap from byte 0.
 *
 * @version 1.1.0
 * @module CryptoUtils
 */

export class CryptoUtils {

    /** @private — prevent instantiation of static utility class */
    constructor() {
        throw new TypeError('CryptoUtils is a static class and cannot be instantiated');
    }

    // ── Secret-safe allocation ──────────────────────

    /**
     * Allocate a Uint8Array whose backing store lives OUTSIDE the engine's
     * moving heap.
     *
     * V8 allocates typed arrays of ≤ 64 bytes (--typed_array_max_size_in_heap)
     * inside its managed heap ("on-heap typed arrays"). A 32-byte key or a
     * 51-byte WIF created with `new Uint8Array(n)`, `.slice()`, or by most
     * libraries lives there, which defeats zeroing in two ways:
     *   - the GC moves such objects (scavenge, compaction) and leaves unzeroed
     *     copies behind in the space it evacuated;
     *   - reading `.buffer` on one materialises an off-heap backing store by
     *     memcpy and abandons the on-heap original without zeroing it.
     * `.fill(0)` only ever reaches the copy that is live at that moment.
     * SpiderMonkey has an analogous inline/nursery-storage optimisation.
     *
     * Constructing the ArrayBuffer explicitly forces an off-heap backing store
     * from the first byte: the memory never moves, so `.fill(0)` is final.
     * Use this for every buffer that will hold key material. Ordinary buffers
     * (IVs, salts, ciphertext, ids) don't need it.
     *
     * Web-API outputs (TextEncoder.encode, SubtleCrypto results) already come
     * with an explicit ArrayBuffer and are off-heap; JS-created arrays are not.
     *
     * @param {number} length — Byte length (≥ 0)
     * @returns {Uint8Array} Zero-filled, off-heap
     * @throws {RangeError} If length is not a non-negative integer
     */
    static secureAlloc(length) {
        if (!Number.isInteger(length) || length < 0) {
            throw new RangeError(`secureAlloc: length must be a non-negative integer (got ${length})`);
        }
        return new Uint8Array(new ArrayBuffer(length));
    }

    /**
     * Copy bytes into a fresh off-heap buffer (see secureAlloc).
     *
     * Does NOT zero the source: the caller decides whether it owns it.
     * The idiom for a source you own is
     *   `const own = CryptoUtils.secureCopy(src); src.fill(0);`
     * — note that `src.fill(0)` must come AFTER the copy and must not be
     * preceded by any access to `src.buffer` (see secureAlloc).
     *
     * @param {Uint8Array} src
     * @returns {Uint8Array} Off-heap copy of `src`
     * @throws {TypeError} If src is not a Uint8Array
     */
    static secureCopy(src) {
        if (!(src instanceof Uint8Array)) {
            throw new TypeError('secureCopy requires a Uint8Array');
        }
        const out = CryptoUtils.secureAlloc(src.byteLength);
        out.set(src);
        return out;
    }

    // ── Random bytes ────────────────────────────────

    /**
     * Generate cryptographically secure random bytes.
     *
     * Requires Web Crypto (all browsers, Node ≥ 19). The previous
     * `require('crypto')` fallback could never run: this is an ES module,
     * so `require` is not defined and the "fallback" threw ReferenceError
     * instead of degrading. Failing loudly is the only honest option —
     * silently returning weak or empty bytes here would be catastrophic.
     *
     * The output is allocated off-heap (secureAlloc) so callers that use it
     * as key material can zero it reliably; for IVs and salts that costs
     * nothing measurable.
     *
     * @param {number} length — Number of random bytes to generate
     * @returns {Uint8Array} Random bytes
     * @throws {RangeError} If length is not a positive integer
     * @throws {Error} If no secure RNG is available
     */
    static getRandomBytes(length) {
        // NaN/Infinity/fractional used to slip past `length <= 0` and produce
        // a zero-length array — a silent "no entropy" result.
        if (!Number.isInteger(length) || length <= 0) {
            throw new RangeError(`Byte length must be a positive integer (got ${length})`);
        }

        if (!globalThis.crypto?.getRandomValues) {
            throw new Error(
                'CryptoUtils: no secure RNG available — Web Crypto is required (Node ≥ 19 or any browser)',
            );
        }

        const out = CryptoUtils.secureAlloc(length);

        // getRandomValues throws QuotaExceededError above 65 536 bytes per call.
        const MAX_PER_CALL = 65_536;
        for (let offset = 0; offset < length; offset += MAX_PER_CALL) {
            const end = Math.min(offset + MAX_PER_CALL, length);
            globalThis.crypto.getRandomValues(out.subarray(offset, end));
        }
        return out;
    }

    // ── Hex encoding ────────────────────────────────

    /**
     * Encode a byte array to a lowercase hex string.
     *
     * Not for key material: the result is an immutable JS string that can
     * never be zeroed.
     *
     * @param {Uint8Array} bytes — Bytes to encode
     * @returns {string} Hex-encoded string
     */
    static bytesToHex(bytes) {
        // Pre-built lookup table: 3× faster than .toString(16) per byte
        return Array.from(bytes, b => CryptoUtils.#HEX_TABLE[b]).join('');
    }

    /**
     * Decode a hex string to a Uint8Array.
     *
     * @param {string} hex — Hex-encoded string (even length)
     * @returns {Uint8Array} Decoded bytes
     * @throws {TypeError} If hex string is invalid
     */
    static hexToBytes(hex) {
        if (typeof hex !== 'string' || hex.length % 2 !== 0) {
            throw new TypeError('hexToBytes requires an even-length hex string');
        }

        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            // #HEX_LOOKUP stores 0xFF (not undefined) for invalid nibbles, and
            // is only 128 entries long — so the old `=== undefined` guard only
            // caught chars ≥ 128. hexToBytes('zz') silently returned [0xFF].
            // Any value > 15 is invalid, whether it came from the fill or from
            // an out-of-range index.
            const high = CryptoUtils.#HEX_LOOKUP[hex.charCodeAt(i)];
            const low  = CryptoUtils.#HEX_LOOKUP[hex.charCodeAt(i + 1)];
            if (!(high <= 15) || !(low <= 15)) {
                throw new TypeError(`Invalid hex character at position ${i}`);
            }
            bytes[i >> 1] = (high << 4) | low;
        }
        return bytes;
    }

    // ── ID generation ───────────────────────────────

    /**
     * Generate a random hex-encoded identifier.
     *
     * @param {number} [byteLength=32] — Number of random bytes (output hex = 2× this)
     * @returns {string} Random hex string (e.g. 64 chars for 32 bytes)
     */
    static generateId(byteLength = 32) {
        return CryptoUtils.bytesToHex(CryptoUtils.getRandomBytes(byteLength));
    }

    // ── Hashing ─────────────────────────────────────

    /**
     * Compute SHA-256 hash of a string or byte array.
     *
     * @param {string|Uint8Array} data — Data to hash
     * @returns {Promise<string>} Hex-encoded SHA-256 hash
     * @throws {Error} If SubtleCrypto is unavailable
     */
    static async sha256Hex(data) {
        if (!globalThis.crypto?.subtle) {
            throw new Error('SubtleCrypto unavailable — cannot compute SHA-256');
        }
        const encoded = typeof data === 'string'
            ? new TextEncoder().encode(data)
            : data;
        const buffer = await globalThis.crypto.subtle.digest('SHA-256', encoded);
        return CryptoUtils.bytesToHex(new Uint8Array(buffer));
    }

    // ── Constant-time comparison ────────────────────

    /**
     * Constant-time comparison of two byte arrays.
     * Prevents timing side-channel attacks on hash/MAC comparisons.
     *
     * @param {Uint8Array} a
     * @param {Uint8Array} b
     * @returns {boolean} True if arrays are identical
     */
    static constantTimeEqual(a, b) {
        if (a.length !== b.length) return false;
        let diff = 0;
        for (let i = 0; i < a.length; i++) {
            diff |= a[i] ^ b[i];
        }
        return diff === 0;
    }

    // ── Pre-computed lookup tables ───────────────────

    /** @type {string[]} — byte → hex lookup (256 entries) */
    static #HEX_TABLE = Array.from({ length: 256 }, (_, i) =>
        i.toString(16).padStart(2, '0')
    );

    /** @type {Uint8Array} — char code → nibble value lookup */
    static #HEX_LOOKUP = (() => {
        const table = new Uint8Array(128).fill(255);
        for (let i = 0; i < 10; i++) table[0x30 + i] = i;        // '0'-'9'
        for (let i = 0; i < 6; i++)  table[0x41 + i] = 10 + i;   // 'A'-'F'
        for (let i = 0; i < 6; i++)  table[0x61 + i] = 10 + i;   // 'a'-'f'
        return table;
    })();
}

export default CryptoUtils;