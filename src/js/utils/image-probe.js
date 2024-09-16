"use strict";

// ── image-probe.js ────────────────────────────────────────────────────
// Header-only image dimension probing for PNG and WEBP byte buffers.
//
// This is a dependency-free vendoring of the two sync parsers we need
// from `probe-image-size` (nodeca, MIT) — lib/parse_sync/png.js and
// lib/parse_sync/webp.js. The npm package's sync entry cannot be
// imported directly in this bundle: its shared lib/common.js constructs
// a stream Transform subclass at module scope (`require('stream')` +
// `stream-parser`), which throws at load time under webpack 5 unless a
// stream polyfill is bundled — dead weight for header parsing. The
// parsing logic below is byte-for-byte the same; if the bundle ever
// grows a stream polyfill anyway, this module can be swapped for
// `import probeSync from 'probe-image-size/sync'` unchanged (same
// signature, same result shape).
//
// probeImageSync(bytes) → { width, height, type, mime } | null
//   • Reads only the container header — no pixel decode, no async,
//     no WASM. Cost is O(header): microseconds even on large images.
//   • Accepts any Uint8Array-like (indexable bytes with .length).
//   • Returns null on anything it can't identify; never throws.

const readUInt16LE = (d, o) => d[o] | (d[o + 1] << 8);
const readUInt32LE = (d, o) =>
    (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16)) + d[o + 3] * 0x1000000;
const readUInt32BE = (d, o) =>
    d[o] * 0x1000000 + ((d[o + 1] << 16) | (d[o + 2] << 8) | d[o + 3]);

// ── PNG ───────────────────────────────────────────────────────────────
// 8-byte signature, then IHDR must be the first chunk — width/height sit
// at fixed offsets 16/20 (big-endian u32).

const SIG_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function sliceEq(src, start, dest) {
    for (let i = start, j = 0; j < dest.length; ) {
        if (src[i++] !== dest[j++]) return false;
    }
    return true;
}

function parsePNG(data) {
    if (data.length < 24) return null;
    if (!sliceEq(data, 0, SIG_PNG)) return null;
    // first chunk must be IHDR
    if (data[12] !== 0x49 || data[13] !== 0x48 || data[14] !== 0x44 || data[15] !== 0x52) return null;
    return {
        width: readUInt32BE(data, 16),
        height: readUInt32BE(data, 20),
        type: "png",
        mime: "image/png",
    };
}

// ── WEBP ──────────────────────────────────────────────────────────────
// RIFF container: walk chunks until one of the three bitstream headers
// (lossy 'VP8 ', lossless 'VP8L', extended 'VP8X') yields dimensions.
// EXIF orientation is deliberately ignored — layout only needs w/h.

function parseVP8(data, offset) {
    // frame tag must end with the 0x9D012A start code
    if (data[offset + 3] !== 0x9d || data[offset + 4] !== 0x01 || data[offset + 5] !== 0x2a) return null;
    return {
        width: readUInt16LE(data, offset + 6) & 0x3fff,
        height: readUInt16LE(data, offset + 8) & 0x3fff,
        type: "webp",
        mime: "image/webp",
    };
}

function parseVP8L(data, offset) {
    if (data[offset] !== 0x2f) return null;
    const bits = readUInt32LE(data, offset + 1);
    return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
        type: "webp",
        mime: "image/webp",
    };
}

function parseVP8X(data, offset) {
    return {
        width: (((data[offset + 6] << 16) | (data[offset + 5] << 8) | data[offset + 4]) + 1),
        height: (((data[offset + 9] << 16) | (data[offset + 8] << 8) | data[offset + 7]) + 1),
        type: "webp",
        mime: "image/webp",
    };
}

function parseWEBP(data) {
    if (data.length < 16) return null;
    // 'RIFF' .... 'WEBP'
    if (data[0] !== 0x52 || data[1] !== 0x49 || data[2] !== 0x46 || data[3] !== 0x46) return null;
    if (data[8] !== 0x57 || data[9] !== 0x45 || data[10] !== 0x42 || data[11] !== 0x50) return null;

    let offset = 12;
    const fileLength = readUInt32LE(data, 4) + 8;
    if (fileLength > data.length) return null;

    while (offset + 8 < fileLength) {
        if (data[offset] === 0) {
            // odd-sized chunks are padded with a 0 byte — skip padding
            offset++;
            continue;
        }
        const c0 = data[offset], c1 = data[offset + 1], c2 = data[offset + 2], c3 = data[offset + 3];
        const length = readUInt32LE(data, offset + 4);
        let result = null;

        if (c0 === 0x56 && c1 === 0x50 && c2 === 0x38) {                       // 'VP8'…
            if (c3 === 0x20 && length >= 10) result = parseVP8(data, offset + 8);   // 'VP8 '
            else if (c3 === 0x4c && length >= 5) result = parseVP8L(data, offset + 8);  // 'VP8L'
            else if (c3 === 0x58 && length >= 10) result = parseVP8X(data, offset + 8); // 'VP8X'
        }
        if (result) return result;
        offset += 8 + length;
    }
    return null;
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Probe PNG/WEBP dimensions from raw bytes without decoding pixels.
 * @param {Uint8Array} data
 * @returns {{width:number, height:number, type:string, mime:string}|null}
 */
export function probeImageSync(data) {
    if (!data || typeof data.length !== "number") return null;
    try {
        return parsePNG(data) || parseWEBP(data);
    } catch {
        return null;
    }
}

export default probeImageSync;
