// @ts-check
/**
 * PNG codec without a DOM. The encoder writes indexed PNGs (1, 2, 4 or 8 bits
 * per pixel, PLTE + tRNS) whenever the image has at most 256 colours, else
 * RGB or RGBA, with integer nearest-neighbour upscaling done row by row. The
 * decoder reads every non-interlaced PNG; interlaced files go through the
 * browser decoder instead (see io/import.js).
 */
import { compress, decompress, crc32, ByteWriter } from './bytes.js';
import { compositeAll } from '../render/composite.js';

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
export const MAX_EXPORT_SIDE = 16384;

/**
 * @param {Uint32Array} rgba packed colours @param {number} width @param {number} height
 * @param {{ indexed?: boolean | 'auto', scale?: number, chunks?: Array<{ type: string, data: Uint8Array }> }} [o]
 *   `chunks`: extra ancillary chunks, written after the image data
 * @returns {Promise<Uint8Array>}
 */
export async function encodePNG(rgba, width, height, o = {}) {
  const scale = Math.max(1, Math.floor(o.scale ?? 1));
  const W = width * scale, H = height * scale;
  if (W > MAX_EXPORT_SIDE || H > MAX_EXPORT_SIDE) throw new RangeError(`PNG would be ${W} x ${H}; the limit is ${MAX_EXPORT_SIDE} per side`);

  // Palette when it fits: translucent entries first so tRNS stays short.
  const seen = new Map();
  let paletteOk = o.indexed !== false;
  for (let i = 0; i < rgba.length && paletteOk; i++) {
    const c = (rgba[i] >>> 24) === 0 ? 0 : rgba[i] >>> 0;
    if (!seen.has(c)) {
      seen.set(c, seen.size);
      if (seen.size > 256) paletteOk = false;
    }
  }
  if (o.indexed === true && !paletteOk) throw new Error('More than 256 colours: cannot write an indexed PNG');

  let colorType, bitDepth, channels, plte = null, trns = null;
  /** @type {Map<number, number> | null} */
  let index = null;
  if (paletteOk) {
    const colors = [...seen.keys()].sort((a, b) => ((a >>> 24) === 255 ? 1 : 0) - ((b >>> 24) === 255 ? 1 : 0));
    index = new Map(colors.map((c, i) => [c, i]));
    colorType = 3;
    bitDepth = colors.length <= 2 ? 1 : colors.length <= 4 ? 2 : colors.length <= 16 ? 4 : 8;
    channels = 1;
    plte = new Uint8Array(colors.length * 3);
    colors.forEach((c, i) => { plte[i * 3] = c & 255; plte[i * 3 + 1] = (c >>> 8) & 255; plte[i * 3 + 2] = (c >>> 16) & 255; });
    const translucent = colors.filter((c) => (c >>> 24) !== 255).length;
    if (translucent) trns = Uint8Array.from(colors.slice(0, translucent), (c) => c >>> 24);
  } else {
    let opaque = true;
    for (let i = 0; i < rgba.length; i++) if ((rgba[i] >>> 24) !== 255) { opaque = false; break; }
    colorType = opaque ? 2 : 6;
    bitDepth = 8;
    channels = opaque ? 3 : 4;
  }

  const bitsPerPixel = bitDepth * channels, rowBytes = Math.ceil((W * bitsPerPixel) / 8), bpp = Math.max(1, bitsPerPixel >> 3);
  const raw = new Uint8Array(H * (rowBytes + 1));
  let prev = new Uint8Array(rowBytes), cur = new Uint8Array(rowBytes);
  const cand = [new Uint8Array(rowBytes), new Uint8Array(rowBytes), new Uint8Array(rowBytes), new Uint8Array(rowBytes), new Uint8Array(rowBytes)];
  let lastSourceRow = -1;
  for (let y = 0; y < H; y++) {
    const sy = Math.floor(y / scale), out = y * (rowBytes + 1);
    if (sy === lastSourceRow) {
      raw[out] = 2; // Up: the row repeats, every byte filters to zero
      continue;
    }
    lastSourceRow = sy;
    cur.fill(0);
    const row = sy * width;
    if (index) {
      const perByte = 8 / bitDepth;
      for (let x = 0; x < W; x++) {
        const c = rgba[row + Math.floor(x / scale)];
        const v = /** @type {number} */ (index.get((c >>> 24) === 0 ? 0 : c >>> 0));
        if (bitDepth === 8) cur[x] = v;
        else cur[Math.floor(x / perByte)] |= v << (8 - bitDepth * ((x % perByte) + 1));
      }
    } else {
      for (let x = 0; x < W; x++) {
        const c = rgba[row + Math.floor(x / scale)], k = x * channels;
        cur[k] = c & 255; cur[k + 1] = (c >>> 8) & 255; cur[k + 2] = (c >>> 16) & 255;
        if (channels === 4) cur[k + 3] = c >>> 24;
      }
    }
    // Adaptive filter for true colour; None for indexed (the PNG recommendation).
    let best = 0;
    if (!index) {
      let bestSum = Infinity;
      for (let f = 0; f < 5; f++) {
        const d = cand[f];
        let sum = 0;
        for (let i = 0; i < rowBytes; i++) {
          const a = i >= bpp ? cur[i - bpp] : 0, b = y > 0 ? prev[i] : 0, c = i >= bpp && y > 0 ? prev[i - bpp] : 0;
          const v = (cur[i] - (f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : paeth(a, b, c))) & 255;
          d[i] = v;
          sum += v < 128 ? v : 256 - v;
        }
        if (sum < bestSum) { bestSum = sum; best = f; }
      }
      raw[out] = best;
      raw.set(cand[best], out + 1);
    } else {
      raw[out] = 0;
      raw.set(cur, out + 1);
    }
    const t = prev; prev = cur; cur = t;
  }

  const w = new ByteWriter(raw.length / 4 + 1024);
  w.bytes(SIGNATURE);
  const ihdr = new ByteWriter(13);
  ihdr.u32be(W); ihdr.u32be(H); ihdr.u8(bitDepth); ihdr.u8(colorType); ihdr.u8(0); ihdr.u8(0); ihdr.u8(0);
  chunk(w, 'IHDR', ihdr.result());
  if (plte) chunk(w, 'PLTE', plte);
  if (trns) chunk(w, 'tRNS', trns);
  chunk(w, 'IDAT', await compress(raw, 'deflate'));
  for (const c of o.chunks || []) chunk(w, c.type, c.data);
  chunk(w, 'IEND', new Uint8Array(0));
  return w.result();
}

/** @param {number} a @param {number} b @param {number} c */
function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** @param {ByteWriter} w @param {string} type @param {Uint8Array} data */
function chunk(w, type, data) {
  w.u32be(data.length);
  const start = w.length;
  w.ascii(type);
  w.bytes(data);
  w.u32be(crc32(w.buf, start, w.length));
}

/**
 * Chunks of a PNG by type, without decoding pixels.
 * @param {Uint8Array} bytes @returns {Map<string, Uint8Array[]>}
 */
export function readPNGChunks(bytes) {
  const out = new Map();
  if (!isPNG(bytes)) return out;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let p = 8; p + 8 <= bytes.length; ) {
    const len = dv.getUint32(p), type = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
    if (!out.has(type)) out.set(type, []);
    out.get(type).push(bytes.subarray(p + 8, p + 8 + len));
    if (type === 'IEND') break;
    p += 12 + len;
  }
  return out;
}

/** Private, ancillary, unsafe-to-copy chunk that carries a whole .pixa project. */
export const PROJECT_CHUNK = 'pxPA';

/** @param {Uint8Array} bytes */
export function isPNG(bytes) {
  return bytes.length > 8 && SIGNATURE.every((v, i) => bytes[i] === v);
}

/**
 * @param {Uint8Array} bytes
 * @returns {Promise<{ rgba: Uint32Array, width: number, height: number }>}
 */
export async function decodePNG(bytes) {
  if (!isPNG(bytes)) throw new Error('Not a PNG file');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 8, width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  /** @type {Uint8Array | null} */ let plte = null;
  /** @type {Uint8Array | null} */ let trns = null;
  const idat = [];
  while (p + 8 <= bytes.length) {
    const len = dv.getUint32(p), type = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
    const data = bytes.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      width = dv.getUint32(p + 8); height = dv.getUint32(p + 12);
      bitDepth = bytes[p + 16]; colorType = bytes[p + 17]; interlace = bytes[p + 20];
    } else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (!width || !height) throw new Error('PNG without a header');
  if (interlace) throw new Error('Interlaced PNG');
  const total = idat.reduce((n, d) => n + d.length, 0), z = new Uint8Array(total);
  let o = 0;
  for (const d of idat) { z.set(d, o); o += d.length; }
  const raw = await decompress(z, 'deflate');

  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`Unknown PNG colour type ${colorType}`);
  const bitsPerPixel = bitDepth * channels, rowBytes = Math.ceil((width * bitsPerPixel) / 8), bpp = Math.max(1, bitsPerPixel >> 3);
  const rgba = new Uint32Array(width * height);
  let prev = new Uint8Array(rowBytes), cur = new Uint8Array(rowBytes);
  const sample = (row, x) => {
    if (bitDepth === 8) return row[x];
    if (bitDepth === 16) return row[x * 2];
    const perByte = 8 / bitDepth, shift = 8 - bitDepth * ((x % perByte) + 1);
    return (row[Math.floor(x / perByte)] >> shift) & ((1 << bitDepth) - 1);
  };
  const scaleGrey = bitDepth < 8 ? 255 / ((1 << bitDepth) - 1) : 1;
  const trnsKey = trns && colorType === 0 && trns.length >= 2 ? (trns[0] << 8) | trns[1] : -1;
  const trnsRGB = trns && colorType === 2 && trns.length >= 6 ? [trns[1], trns[3], trns[5], (trns[0] << 8) | trns[1], (trns[2] << 8) | trns[3], (trns[4] << 8) | trns[5]] : null;
  for (let y = 0; y < height; y++) {
    const at = y * (rowBytes + 1), f = raw[at];
    for (let i = 0; i < rowBytes; i++) {
      const x = raw[at + 1 + i], a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      cur[i] = (x + (f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : paeth(a, b, c))) & 255;
    }
    const row = y * width;
    for (let x = 0; x < width; x++) {
      let r, g, b, al = 255;
      if (colorType === 3) {
        const k = sample(cur, x);
        r = plte ? plte[k * 3] : 0; g = plte ? plte[k * 3 + 1] : 0; b = plte ? plte[k * 3 + 2] : 0;
        al = trns && k < trns.length ? trns[k] : 255;
      } else if (colorType === 0 || colorType === 4) {
        const raw16 = bitDepth === 16 ? (cur[x * channels * 2] << 8) | cur[x * channels * 2 + 1] : -1;
        const v = bitDepth === 16 ? cur[x * channels * 2] : colorType === 4 ? cur[x * 2] : Math.round(sample(cur, x) * scaleGrey);
        r = g = b = v;
        if (colorType === 4) al = bitDepth === 16 ? cur[x * 4 + 2] : cur[x * 2 + 1];
        else if (trnsKey >= 0 && (bitDepth === 16 ? raw16 : sample(cur, x)) === trnsKey) al = 0;
      } else {
        const step = bitDepth === 16 ? 2 : 1, k = x * channels * step;
        r = cur[k]; g = cur[k + step]; b = cur[k + 2 * step];
        if (colorType === 6) al = cur[k + 3 * step];
        else if (trnsRGB) {
          const hit = bitDepth === 16
            ? ((cur[k] << 8) | cur[k + 1]) === trnsRGB[3] && ((cur[k + 2] << 8) | cur[k + 3]) === trnsRGB[4] && ((cur[k + 4] << 8) | cur[k + 5]) === trnsRGB[5]
            : r === trnsRGB[0] && g === trnsRGB[1] && b === trnsRGB[2];
          if (hit) al = 0;
        }
      }
      rgba[row + x] = al === 0 ? 0 : ((al << 24) | (b << 16) | (g << 8) | r) >>> 0;
    }
    const t = prev; prev = cur; cur = t;
  }
  return { rgba, width, height };
}

/**
 * The visible picture (or one layer) as PNG bytes.
 * @param {import('../model/Document.js').Document} doc
 * @param {{ scale?: number, indexed?: boolean | 'auto', layerId?: string | null, includeFloating?: boolean,
 *   project?: Uint8Array }} [o] `project`: .pixa bytes to embed, so the PNG reopens with its layers
 */
export async function exportPNG(doc, o = {}) {
  let rgba;
  if (o.layerId) {
    const l = doc.layerById(o.layerId);
    if (!l) throw new Error(`No layer ${o.layerId}`);
    rgba = l.toRGBA();
  } else {
    rgba = compositeAll(doc, null, { includeFloating: o.includeFloating ?? false });
  }
  const chunks = o.project ? [{ type: PROJECT_CHUNK, data: o.project }] : [];
  return encodePNG(rgba, doc.width, doc.height, { scale: o.scale, indexed: o.indexed ?? 'auto', chunks });
}
