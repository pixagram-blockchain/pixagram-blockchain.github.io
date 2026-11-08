// @ts-check
/**
 * Image import: tells apart native pixel art, upscaled pixel art and photos,
 * and always ends with packed colours ready to become an indexed layer.
 *
 *  1. decodeImage: PNG bytes are decoded here (no DOM); anything else goes
 *     through createImageBitmap with colour management off.
 *  2. detectPixelGrid: counts colour edges per column and per row (tolerating
 *     noise), then finds the period k and offset that put at least 90% of the
 *     edges on a grid, x and y separately, checked by cell uniformity.
 *  3. recoverPixelArt: each grid cell takes the majority colour of its
 *     interior; from k >= 4 a 1-px rim is ignored.
 *  4. importPhoto: area downscale in linear light to a pixel budget, then
 *     weighted k-means in Oklab down to a colour count.
 */
import { decodePNG, isPNG } from './png.js';
import { reduceColors } from '../ops/color-ops.js';
import { MAX_SIZE } from '../model/Document.js';

// ---------------------------------------------------------------- decoding

/**
 * @param {any} source PNG bytes (Uint8Array / ArrayBuffer), Blob or File,
 *   ImageData-like { data, width, height }, ImageBitmap, image or canvas element
 * @returns {Promise<{ rgba: Uint32Array, width: number, height: number, name?: string }>}
 */
export async function decodeImage(source) {
  const name = source && typeof source.name === 'string' ? source.name : undefined;
  if (source && source.data && source.width && source.height && !(source instanceof Uint8Array)) {
    return { ...fromImageData(source), name };
  }
  let bytes = null;
  if (source instanceof ArrayBuffer) bytes = new Uint8Array(source);
  else if (source instanceof Uint8Array) bytes = source;
  else if (typeof Blob !== 'undefined' && source instanceof Blob) bytes = new Uint8Array(await source.arrayBuffer());
  if (bytes && isPNG(bytes)) {
    try {
      return { ...(await decodePNG(bytes)), name };
    } catch (err) {
      if (typeof createImageBitmap === 'undefined') throw err; // interlaced PNG outside a browser
    }
  }
  if (typeof createImageBitmap === 'undefined') throw new Error('This image format needs a browser decoder (createImageBitmap)');
  const blob = bytes ? new Blob([bytes]) : source;
  const bitmap = typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap
    ? source
    : await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(bitmap.width, bitmap.height)
    : Object.assign(document.createElement('canvas'), { width: bitmap.width, height: bitmap.height });
  const ctx = /** @type {any} */ (canvas).getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  return { ...fromImageData(ctx.getImageData(0, 0, bitmap.width, bitmap.height)), name };
}

/** @param {{ data: ArrayLike<number> & { buffer?: ArrayBuffer, byteOffset?: number }, width: number, height: number }} img */
function fromImageData(img) {
  const n = img.width * img.height, d = img.data;
  const rgba = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    const a = d[i * 4 + 3];
    rgba[i] = a ? ((a << 24) | (d[i * 4 + 2] << 16) | (d[i * 4 + 1] << 8) | d[i * 4]) >>> 0 : 0;
  }
  return { rgba, width: img.width, height: img.height };
}

/** Distinct colours, stopping at `cap`. @param {Uint32Array} rgba @param {number} [cap] */
export function countColors(rgba, cap = Infinity) {
  const seen = new Set();
  for (let i = 0; i < rgba.length; i++) {
    const c = rgba[i] >>> 24 ? rgba[i] : 0;
    if (!seen.has(c)) { seen.add(c); if (seen.size >= cap) break; }
  }
  return seen.size;
}

// ---------------------------------------------------------------- grid detection

/** Largest channel difference, alpha included; two transparent pixels are equal. @param {number} a @param {number} b */
function dist(a, b) {
  if (a === b) return 0;
  const aa = a >>> 24, ba = b >>> 24;
  if (!aa && !ba) return 0;
  const dr = Math.abs((a & 255) - (b & 255)), dg = Math.abs(((a >>> 8) & 255) - ((b >>> 8) & 255));
  const db = Math.abs(((a >>> 16) & 255) - ((b >>> 16) & 255)), da = Math.abs(aa - ba);
  return Math.max(dr, dg, db, da);
}

/** Noise floor from the neighbour-distance median; 0 for clean images. @param {Uint32Array} rgba @param {number} w @param {number} h */
function noiseFloor(rgba, w, h) {
  const hist = new Uint32Array(256);
  let n = 0;
  const step = Math.max(1, Math.floor((w * h) / 400000));
  for (let i = 1; i < rgba.length; i += step) {
    if (i % w === 0) continue;
    hist[dist(rgba[i], rgba[i - 1])]++;
    n++;
  }
  let acc = 0, median = 0;
  for (let d = 0; d < 256; d++) { acc += hist[d]; if (acc * 2 >= n) { median = d; break; } }
  return median === 0 ? 0 : Math.min(64, 2 * median + 2);
}

/**
 * Edge counts per column (between x-1 and x) and per row (between y-1 and y).
 * With noise, only the local maximum of a blurred edge counts.
 * @param {Uint32Array} rgba @param {number} w @param {number} h @param {number} tau
 */
function edgeProfiles(rgba, w, h, tau) {
  const ex = new Float64Array(w), ey = new Float64Array(h);
  const dRow = new Float32Array(w + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 1; x < w; x++) dRow[x] = dist(rgba[row + x], rgba[row + x - 1]);
    dRow[0] = 0; dRow[w] = 0;
    for (let x = 1; x < w; x++) {
      const d = dRow[x];
      if (d <= tau) continue;
      if (tau > 0 && !(d >= dRow[x - 1] && d > dRow[x + 1])) continue;
      ex[x]++;
    }
  }
  let prev = new Float32Array(w), cur = new Float32Array(w), next = new Float32Array(w);
  const rowDist = (y, out) => {
    if (y < 1 || y >= h) { out.fill(0); return; }
    const a = y * w, b = a - w;
    for (let x = 0; x < w; x++) out[x] = dist(rgba[a + x], rgba[b + x]);
  };
  rowDist(1, cur);
  rowDist(2, next);
  for (let y = 1; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = cur[x];
      if (d <= tau) continue;
      if (tau > 0 && !(d >= prev[x] && d > next[x])) continue;
      ey[y]++;
    }
    const t = prev; prev = cur; cur = next; next = t;
    rowDist(y + 2, next);
  }
  return { ex, ey };
}

/**
 * Periods k and offsets o that put at least `share` of the edges on a grid,
 * largest k first.
 * @param {Float64Array} e @param {number} len @param {number} maxK @param {number} share @param {boolean} loose count edges one pixel off the grid (noisy input)
 */
function axisCandidates(e, len, maxK, share, loose) {
  let total = 0;
  for (let x = 1; x < len; x++) total += e[x];
  if (total < 4) return { flat: true, list: [] };
  const list = [];
  for (let k = 2; k <= Math.min(maxK, Math.floor(len / 2)); k++) {
    const s = new Float64Array(k);
    for (let x = 1; x < len; x++) s[x % k] += e[x];
    let best = 0, bestV = -1;
    for (let o = 0; o < k; o++) {
      const v = loose && k >= 6 ? s[o] + s[(o + 1) % k] + s[(o + k - 1) % k] : s[o];
      if (v > bestV) { bestV = v; best = o; }
    }
    const frac = bestV / total;
    if (frac >= share) list.push({ k, o: best, frac });
  }
  list.sort((a, b) => b.k - a.k);
  return { flat: false, list };
}

/**
 * Share of full grid cells whose interior is one colour (within tol).
 * @param {Uint32Array} rgba @param {number} w @param {number} h
 * @param {number} kx @param {number} ox @param {number} ky @param {number} oy @param {number} tol
 */
function gridUniformity(rgba, w, h, kx, ox, ky, oy, tol) {
  const cols = [], rows = [];
  for (let x0 = ox; x0 + kx <= w; x0 += kx) cols.push(x0);
  for (let y0 = oy; y0 + ky <= h; y0 += ky) rows.push(y0);
  const n = cols.length * rows.length;
  if (!n) return 0;
  const step = Math.max(1, Math.floor(n / 1500));
  const rx = kx >= 4 ? 1 : 0, ry = ky >= 4 ? 1 : 0;
  let checked = 0, passed = 0;
  for (let c = 0; c < n; c += step) {
    const x0 = cols[c % cols.length], y0 = rows[Math.floor(c / cols.length)];
    let r = 0, g = 0, b = 0, a = 0, m = 0, first = -1, same = 0;
    for (let y = y0 + ry; y < y0 + ky - ry; y++) {
      for (let x = x0 + rx; x < x0 + kx - rx; x++) {
        const v = rgba[y * w + x];
        if (first < 0) first = v;
        if (v === first) same++;
        r += v & 255; g += (v >>> 8) & 255; b += (v >>> 16) & 255; a += v >>> 24; m++;
      }
    }
    checked++;
    if (tol === 0) {
      if (same >= 0.9 * m) passed++;
      continue;
    }
    const mean = ((Math.round(a / m) << 24) | (Math.round(b / m) << 16) | (Math.round(g / m) << 8) | Math.round(r / m)) >>> 0;
    let ok = 0;
    for (let y = y0 + ry; y < y0 + ky - ry; y++) for (let x = x0 + rx; x < x0 + kx - rx; x++) if (dist(rgba[y * w + x], mean) <= tol) ok++;
    if (ok >= 0.9 * m) passed++;
  }
  return checked ? passed / checked : 0;
}

/**
 * @param {Uint32Array} rgba @param {number} w @param {number} h
 * @param {{ maxScale?: number, share?: number }} [o]
 * @returns {{ kx: number, ky: number, ox: number, oy: number, confidence: number, noise: number }}
 */
export function detectPixelGrid(rgba, w, h, o = {}) {
  const maxK = o.maxScale ?? 64, share = o.share ?? 0.9;
  const tau = noiseFloor(rgba, w, h);
  const { ex, ey } = edgeProfiles(rgba, w, h, tau);
  const cx = axisCandidates(ex, w, maxK, share, tau > 0), cy = axisCandidates(ey, h, maxK, share, tau > 0);
  const tol = tau === 0 ? 0 : tau;
  const none = { kx: 1, ky: 1, ox: 0, oy: 0, confidence: 0, noise: tau };

  /** @type {Array<[any, any]>} */
  const pairs = [];
  const xs = cx.flat ? cy.list.map((c) => ({ k: c.k, o: 0, frac: 1 })) : cx.list;
  const ys = cy.flat ? cx.list.map((c) => ({ k: c.k, o: 0, frac: 1 })) : cy.list;
  for (const a of xs) for (const b of ys) pairs.push([a, b]);
  pairs.sort((p, q) => ((q[0].k === q[1].k ? 2 : 1) * q[0].k * q[1].k) - ((p[0].k === p[1].k ? 2 : 1) * p[0].k * p[1].k));
  const one = { k: 1, o: 0, frac: 1 };
  if (!cy.flat) for (const a of xs) pairs.push([a, one]);
  if (!cx.flat) for (const b of ys) pairs.push([one, b]);
  for (const [a, b] of pairs.slice(0, 40)) {
    const u = gridUniformity(rgba, w, h, a.k, a.o % a.k, b.k, b.o % b.k, tol);
    if (u >= 0.9) return { kx: a.k, ky: b.k, ox: a.o % a.k, oy: b.o % b.k, confidence: Math.min(a.frac, b.frac) * u, noise: tau };
  }
  return none;
}

// ---------------------------------------------------------------- recovery

/** Cell spans along one axis: partial border cells count when at least half covered. @param {number} len @param {number} k @param {number} o */
function spans(len, k, o) {
  const out = [];
  for (let s = o > 0 ? o - k : 0; s < len; s += k) {
    const a = Math.max(0, s), b = Math.min(len, s + k);
    if ((b - a) * 2 >= k) out.push(a, b);
  }
  return out;
}

/**
 * @param {Uint32Array} rgba @param {number} w @param {number} h
 * @param {{ kx: number, ky: number, ox: number, oy: number, noise?: number }} grid
 */
export function recoverPixelArt(rgba, w, h, grid) {
  const sx = spans(w, grid.kx, grid.ox), sy = spans(h, grid.ky, grid.oy);
  const nx = sx.length / 2, ny = sy.length / 2, out = new Uint32Array(nx * ny);
  const noisy = (grid.noise ?? 0) > 0;
  const counts = new Map();
  const hist = noisy ? [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)] : null;
  for (let j = 0; j < ny; j++) {
    let y0 = sy[j * 2], y1 = sy[j * 2 + 1];
    if (grid.ky >= 4 && y1 - y0 >= 3) { y0++; y1--; }
    for (let i = 0; i < nx; i++) {
      let x0 = sx[i * 2], x1 = sx[i * 2 + 1];
      if (grid.kx >= 4 && x1 - x0 >= 3) { x0++; x1--; }
      if (!hist) {
        counts.clear();
        let best = 0, bestN = 0;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const c = rgba[y * w + x];
            const n = (counts.get(c) || 0) + 1;
            counts.set(c, n);
            if (n > bestN) { bestN = n; best = c; }
          }
        }
        out[j * nx + i] = best;
        continue;
      }
      for (const hh of hist) hh.fill(0);
      let m = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const c = rgba[y * w + x];
          hist[0][c & 255]++; hist[1][(c >>> 8) & 255]++; hist[2][(c >>> 16) & 255]++; hist[3][c >>> 24]++;
          m++;
        }
      }
      const med = hist.map((hh) => { let acc = 0; for (let v = 0; v < 256; v++) { acc += hh[v]; if (acc * 2 >= m) return v; } return 255; });
      out[j * nx + i] = med[3] < 8 ? 0 : ((med[3] << 24) | (med[2] << 16) | (med[1] << 8) | med[0]) >>> 0;
    }
  }
  if (noisy) snapColors(out, Math.max(6, (grid.noise ?? 0) * 0.75));
  return { rgba: out, width: nx, height: ny };
}

/** Merges colours closer than tol into their weighted mean, most frequent first. @param {Uint32Array} rgba @param {number} tol */
function snapColors(rgba, tol) {
  const freq = new Map();
  for (const c of rgba) freq.set(c, (freq.get(c) || 0) + 1);
  const order = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  /** @type {Array<{seed: number, sum: number[], n: number}>} */
  const clusters = [];
  const of = new Map();
  for (const [c, n] of order) {
    let target = clusters.find((cl) => dist(cl.seed, c) <= tol);
    if (!target) clusters.push((target = { seed: c, sum: [0, 0, 0, 0], n: 0 }));
    target.sum[0] += (c & 255) * n; target.sum[1] += ((c >>> 8) & 255) * n; target.sum[2] += ((c >>> 16) & 255) * n; target.sum[3] += (c >>> 24) * n;
    target.n += n;
    of.set(c, target);
  }
  const colorOf = new Map(clusters.map((cl) => {
    const [r, g, b, a] = cl.sum.map((s) => Math.round(s / cl.n));
    return [cl, a < 8 ? 0 : ((a << 24) | (b << 16) | (g << 8) | r) >>> 0];
  }));
  for (let i = 0; i < rgba.length; i++) rgba[i] = /** @type {number} */ (colorOf.get(of.get(rgba[i])));
}

// ---------------------------------------------------------------- photos

const TO_LINEAR = Float32Array.from({ length: 256 }, (_, v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});
/** @param {number} l */
const toSRGB8 = (l) => {
  const c = l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(c * 255)));
};

/** Area weights for resampling len -> out. @param {number} len @param {number} n */
function areaWeights(len, n) {
  const scale = len / n, list = [];
  for (let o = 0; o < n; o++) {
    const a = o * scale, b = (o + 1) * scale, items = [];
    for (let s = Math.floor(a); s < Math.ceil(b); s++) {
      const w = Math.min(b, s + 1) - Math.max(a, s);
      if (w > 1e-6) items.push(s, w);
    }
    list.push(items);
  }
  return list;
}

/**
 * Box-filter downscale in linear light with premultiplied alpha.
 * @param {Uint32Array} rgba @param {number} w @param {number} h @param {number} tw @param {number} th
 */
export function areaDownscale(rgba, w, h, tw, th) {
  const wx = areaWeights(w, tw), wy = areaWeights(h, th);
  const mid = new Float32Array(tw * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < tw; x++) {
      const items = wx[x];
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = 0; k < items.length; k += 2) {
        const c = rgba[y * w + items[k]], wt = items[k + 1], al = ((c >>> 24) / 255) * wt;
        r += TO_LINEAR[c & 255] * al; g += TO_LINEAR[(c >>> 8) & 255] * al; b += TO_LINEAR[(c >>> 16) & 255] * al; a += al;
      }
      const o = (y * tw + x) * 4;
      mid[o] = r; mid[o + 1] = g; mid[o + 2] = b; mid[o + 3] = a;
    }
  }
  const out = new Uint32Array(tw * th), sx = w / tw;
  for (let y = 0; y < th; y++) {
    const items = wy[y];
    let wsum = 0;
    for (let k = 1; k < items.length; k += 2) wsum += items[k];
    for (let x = 0; x < tw; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = 0; k < items.length; k += 2) {
        const o = (items[k] * tw + x) * 4, wt = items[k + 1];
        r += mid[o] * wt; g += mid[o + 1] * wt; b += mid[o + 2] * wt; a += mid[o + 3] * wt;
      }
      const alpha = a / (wsum * sx);
      if (alpha < 16 / 255 || a <= 0) { out[y * tw + x] = 0; continue; }
      out[y * tw + x] = ((Math.round(alpha * 255) << 24) | (toSRGB8(b / a) << 16) | (toSRGB8(g / a) << 8) | toSRGB8(r / a)) >>> 0;
    }
  }
  return out;
}

/**
 * Photo to pixel art: downscale to a pixel budget, then reduce colours.
 * @param {Uint32Array} rgba @param {number} w @param {number} h
 * @param {{ maxPixels?: number, colors?: number,
 *   downscale?: (rgba: Uint32Array, w: number, h: number, tw: number, th: number) => Uint32Array }} [o]
 *   `downscale` is the plug-in point for a better engine (smart-downscale as WASM).
 */
export function importPhoto(rgba, w, h, o = {}) {
  const budget = o.maxPixels ?? 192 * 192;
  const s = Math.min(1, Math.sqrt(budget / (w * h)), MAX_SIZE / w, MAX_SIZE / h);
  const tw = Math.max(1, Math.round(w * s)), th = Math.max(1, Math.round(h * s));
  const small = tw === w && th === h ? rgba.slice() : (o.downscale || areaDownscale)(rgba, w, h, tw, th);
  const target = o.colors ?? 64;
  // Index 0 is the transparent entry, as in every palette of the core.
  const index = new Map([[0, 0]]), colors = [0], usage = [0];
  for (const c of small) {
    let i = index.get(c);
    if (i === undefined) { index.set(c, (i = colors.length)); colors.push(c); usage.push(0); }
    usage[i]++;
  }
  if (colors.length - 1 > target) {
    const mapped = reduceColors(Uint32Array.from(colors), Uint32Array.from(usage), target);
    for (let i = 0; i < small.length; i++) small[i] = mapped[/** @type {number} */ (index.get(small[i]))];
  }
  return { rgba: small, width: tw, height: th };
}

// ---------------------------------------------------------------- decision

/**
 * @typedef {{ kind: 'native'|'upscaled'|'photo', rgba: Uint32Array, width: number, height: number,
 *   colors: number, grid: { kx: number, ky: number, ox: number, oy: number, confidence: number } | null,
 *   source: { width: number, height: number, colors: number }, summary: string }} ImportResult
 */

/**
 * @param {Uint32Array} rgba @param {number} w @param {number} h
 * @param {{ mode?: 'auto'|'pixel'|'photo', scale?: number, maxPixels?: number, colors?: number, maxScale?: number,
 *   downscale?: (rgba: Uint32Array, w: number, h: number, tw: number, th: number) => Uint32Array }} [o]
 *   `scale` forces the grid period (manual override).
 * @returns {ImportResult}
 */
export function importPixelArt(rgba, w, h, o = {}) {
  const mode = o.mode ?? 'auto';
  const sourceColors = countColors(rgba, 65536);
  const source = { width: w, height: h, colors: sourceColors };
  const fits = (W, H) => W <= MAX_SIZE && H <= MAX_SIZE;
  if (mode !== 'photo') {
    let grid = null;
    if (o.scale && o.scale > 1) {
      const auto = detectPixelGrid(rgba, w, h, { maxScale: o.scale });
      grid = auto.kx === o.scale && auto.ky === o.scale ? auto : { kx: o.scale, ky: o.scale, ox: 0, oy: 0, confidence: 0, noise: auto.noise };
    } else {
      const g = detectPixelGrid(rgba, w, h, { maxScale: o.maxScale });
      if (g.kx > 1 || g.ky > 1) grid = g;
    }
    if (grid) {
      const r = recoverPixelArt(rgba, w, h, grid);
      if (fits(r.width, r.height)) {
        const colors = countColors(r.rgba);
        const k = grid.kx === grid.ky ? `${grid.kx}×` : `${grid.kx}×${grid.ky}`;
        return { kind: 'upscaled', ...r, colors, grid, source, summary: `${k} pixel art, offset (${grid.ox}, ${grid.oy}) → ${r.width} × ${r.height}, ${colors} colour${colors === 1 ? '' : 's'}` };
      }
    }
    if (fits(w, h) && (mode === 'pixel' || sourceColors <= 256)) {
      return { kind: 'native', rgba: rgba.slice(), width: w, height: h, colors: sourceColors, grid: null, source, summary: `Pixel art, ${w} × ${h}, ${sourceColors} colour${sourceColors === 1 ? '' : 's'}` };
    }
  }
  const p = importPhoto(rgba, w, h, o);
  const colors = countColors(p.rgba);
  return { kind: 'photo', ...p, colors, grid: null, source, summary: `Photo ${w} × ${h} → ${p.width} × ${p.height}, ${colors} colours` };
}
