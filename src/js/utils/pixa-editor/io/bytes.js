// @ts-check
/**
 * Byte helpers shared by the PNG codec and the project format: native
 * (de)compression through Compression Streams, CRC-32, Adler-32 and a
 * stored-block zlib fallback for runtimes without CompressionStream.
 */

/** @param {Uint8Array} bytes @param {'deflate'|'deflate-raw'|'gzip'} format */
export async function compress(bytes, format = 'deflate') {
  if (typeof CompressionStream === 'undefined') {
    if (format === 'deflate') return storedZlib(bytes);
    if (format === 'deflate-raw') return storedDeflate(bytes);
    throw new Error('CompressionStream is not available');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** @param {Uint8Array} bytes @param {'deflate'|'deflate-raw'|'gzip'} format */
export async function decompress(bytes, format = 'deflate') {
  if (typeof DecompressionStream === 'undefined') throw new Error('DecompressionStream is not available');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** @param {Uint8Array} bytes @param {number} [start] @param {number} [end] */
export function crc32(bytes, start = 0, end = bytes.length) {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** @param {Uint8Array} bytes */
export function adler32(bytes) {
  let a = 1, b = 0;
  for (let i = 0; i < bytes.length; ) {
    const end = Math.min(bytes.length, i + 5552);
    for (; i < end; i++) { a += bytes[i]; b += a; }
    a %= 65521;
    b %= 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/** Raw deflate made of stored (uncompressed) blocks. @param {Uint8Array} bytes */
export function storedDeflate(bytes) {
  const blocks = Math.max(1, Math.ceil(bytes.length / 65535));
  const out = new Uint8Array(bytes.length + blocks * 5);
  let o = 0;
  for (let b = 0; b < blocks; b++) {
    const start = b * 65535, len = Math.min(65535, bytes.length - start);
    out[o++] = b === blocks - 1 ? 1 : 0;
    out[o++] = len & 255; out[o++] = len >>> 8;
    out[o++] = ~len & 255; out[o++] = (~len >>> 8) & 255;
    out.set(bytes.subarray(start, start + len), o);
    o += len;
  }
  return out;
}

/** zlib stream made of stored blocks. @param {Uint8Array} bytes */
export function storedZlib(bytes) {
  const body = storedDeflate(bytes), out = new Uint8Array(body.length + 6);
  out[0] = 0x78; out[1] = 0x01;
  out.set(body, 2);
  new DataView(out.buffer).setUint32(out.length - 4, adler32(bytes));
  return out;
}

/** Growable byte writer. */
export class ByteWriter {
  constructor(size = 1024) {
    this.buf = new Uint8Array(size);
    this.length = 0;
  }
  /** @param {number} n */
  ensure(n) {
    if (this.length + n <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.length + n) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.length));
    this.buf = next;
  }
  /** @param {ArrayLike<number>} bytes */
  bytes(bytes) { this.ensure(bytes.length); this.buf.set(bytes, this.length); this.length += bytes.length; }
  /** @param {number} v */
  u8(v) { this.ensure(1); this.buf[this.length++] = v & 255; }
  /** @param {number} v */
  u32be(v) { this.ensure(4); new DataView(this.buf.buffer).setUint32(this.length, v >>> 0, false); this.length += 4; }
  /** @param {number} v */
  u32le(v) { this.ensure(4); new DataView(this.buf.buffer).setUint32(this.length, v >>> 0, true); this.length += 4; }
  /** @param {string} s ASCII */
  ascii(s) { for (let i = 0; i < s.length; i++) this.u8(s.charCodeAt(i)); }
  result() { return this.buf.slice(0, this.length); }
}

/** Packed colours to little-endian bytes (R, G, B, A per pixel). @param {Uint32Array} words */
export function wordsToBytes(words) {
  const out = new Uint8Array(words.length * 4), dv = new DataView(out.buffer);
  for (let i = 0; i < words.length; i++) dv.setUint32(i * 4, words[i], true);
  return out;
}

/** @param {Uint8Array} bytes */
export function bytesToWords(bytes) {
  const n = bytes.length >>> 2, out = new Uint32Array(n), dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < n; i++) out[i] = dv.getUint32(i * 4, true);
  return out;
}
