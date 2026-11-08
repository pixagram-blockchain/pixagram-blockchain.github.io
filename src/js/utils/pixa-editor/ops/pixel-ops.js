// @ts-check
/** Pixel effects: functions from a packed RGBA image to a new one. */
import { over, mix, channelDistance, withAlpha } from '../color/rgba.js';

const BAYER4 = Float32Array.from([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16));

/**
 * Majority smoothing (the pixa.pics rule, read from a copy so changes do not
 * cascade within a pass): a pixel takes its neighbours' dominant colour when
 * 6 of 8 agree, or when the two dominant colours fill all 8, the first has 5
 * and the pixel is within 24 of their mix.
 * @param {Uint32Array} rgba @param {number} w @param {number} h @param {number} [rounds]
 */
export function smooth(rgba, w, h, rounds = 1) {
  let src = rgba.slice();
  const cols = new Uint32Array(8), counts = new Uint8Array(8);
  for (let r = 0; r < rounds; r++) {
    const dst = src.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if ((dx === 0 && dy === 0) || xx < 0 || xx >= w) continue;
            const c = src[yy * w + xx];
            let k = 0;
            while (k < n && cols[k] !== c) k++;
            if (k === n) { cols[n] = c; counts[n] = 0; n++; }
            counts[k]++;
          }
        }
        let a = -1, b = -1;
        for (let k = 0; k < n; k++) {
          if (a < 0 || counts[k] > counts[a]) { b = a; a = k; } else if (b < 0 || counts[k] > counts[b]) b = k;
        }
        if (a < 0) continue;
        const i = y * w + x;
        if (counts[a] >= 6) dst[i] = cols[a];
        else if (b >= 0 && counts[a] + counts[b] >= 8 && counts[a] >= 5) {
          if (channelDistance(src[i], mix(cols[a], cols[b], 0.5)) <= 24) dst[i] = cols[a];
        }
      }
    }
    src = dst;
  }
  return src;
}

/**
 * Vignette toward `color`: elliptical falloff fitted to the canvas, cut into
 * `rings` bands, optionally Bayer-dithered between bands.
 * @param {Uint32Array} rgba @param {number} w @param {number} h
 * @param {{ color: number, intensity?: number, rings?: number, dither?: boolean, inner?: number }} o
 */
export function vignette(rgba, w, h, o) {
  const intensity = o.intensity ?? 0.5, rings = Math.max(1, o.rings ?? 6), inner = o.inner ?? 0.35;
  const out = new Uint32Array(rgba.length);
  const ca = o.color >>> 24;
  for (let y = 0; y < h; y++) {
    const ny = (y + 0.5 - h / 2) / (h / 2);
    for (let x = 0; x < w; x++) {
      const nx = (x + 0.5 - w / 2) / (w / 2);
      const r = Math.sqrt(nx * nx + ny * ny) / Math.SQRT2;
      let t = Math.min(1, Math.max(0, (r - inner) / (1 - inner)));
      t = t * t * (3 - 2 * t);
      const q = o.dither
        ? Math.min(rings, Math.floor(t * rings + BAYER4[((y & 3) << 2) | (x & 3)])) / rings
        : Math.round(t * rings) / rings;
      const i = y * w + x;
      out[i] = q > 0 ? over(rgba[i], withAlpha(o.color, ca * q * intensity)) : rgba[i];
    }
  }
  return out;
}

/**
 * Mirror of any typed image (packed colours or palette indices).
 * @template {Uint32Array|Uint16Array} T
 * @param {T} src @param {number} w @param {number} h @param {'x'|'y'} axis 'x' flips left-right
 * @returns {T}
 */
export function mirror(src, w, h, axis) {
  const out = /** @type {T} */ (new /** @type {any} */ (src.constructor)(src.length));
  for (let y = 0; y < h; y++) {
    const sy = axis === 'y' ? h - 1 - y : y;
    for (let x = 0; x < w; x++) out[y * w + x] = src[sy * w + (axis === 'x' ? w - 1 - x : x)];
  }
  return out;
}

/**
 * Quarter turn of any typed image. Returns the new data; width and height swap.
 * @template {Uint32Array|Uint16Array} T
 * @param {T} src @param {number} w @param {number} h @param {1|-1} dir 1 = clockwise
 * @returns {T}
 */
export function rotate(src, w, h, dir) {
  const out = /** @type {T} */ (new /** @type {any} */ (src.constructor)(src.length));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = dir === 1 ? h - 1 - y : y, ny = dir === 1 ? x : w - 1 - x;
      out[ny * h + nx] = src[y * w + x];
    }
  }
  return out;
}

/**
 * Sub-rectangle of any typed image.
 * @template {Uint32Array|Uint16Array} T
 * @param {T} src @param {number} w @param {number} x0 @param {number} y0 @param {number} cw @param {number} ch
 * @returns {T}
 */
export function crop(src, w, x0, y0, cw, ch) {
  const out = /** @type {T} */ (new /** @type {any} */ (src.constructor)(cw * ch));
  for (let y = 0; y < ch; y++) out.set(src.subarray((y0 + y) * w + x0, (y0 + y) * w + x0 + cw), y * cw);
  return out;
}
