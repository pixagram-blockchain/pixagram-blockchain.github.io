// @ts-check
import { Mask } from '../model/Mask.js';

/**
 * Integer Bresenham line, endpoints included.
 * @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1
 * @param {(x: number, y: number) => void} fn
 */
export function bresenham(x0, y0, x1, y1, fn) {
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    fn(x0, y0);
    if (x0 === x1 && y0 === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/**
 * Stamps `offsets` (pairs dx, dy) at (cx, cy) into the mask, clipped.
 * @param {Mask} mask @param {number} cx @param {number} cy @param {Int16Array} offsets
 */
export function stamp(mask, cx, cy, offsets) {
  const w = mask.width, h = mask.height;
  for (let k = 0; k < offsets.length; k += 2) {
    const x = cx + offsets[k], y = cy + offsets[k + 1];
    if (x >= 0 && y >= 0 && x < w && y < h) mask.set(y * w + x);
  }
}

/**
 * A line stamped with a brush tip (1-px line when `offsets` is [0, 0]).
 * @param {number} w @param {number} h @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1
 * @param {Int16Array} [offsets]
 */
export function lineMask(w, h, x0, y0, x1, y1, offsets = Int16Array.of(0, 0)) {
  const m = new Mask(w, h);
  bresenham(x0, y0, x1, y1, (x, y) => stamp(m, x, y, offsets));
  return m;
}

/** @param {number} w @param {number} h @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 */
export function rectMask(w, h, x0, y0, x1, y1) {
  const m = new Mask(w, h);
  m.fillRect(x0, y0, x1, y1);
  return m;
}

/**
 * Filled ellipse inscribed in the inclusive box, tested at pixel centres with
 * radii trimmed by a quarter pixel so small ellipses come out round (3 x 3 is
 * a plus, 4 x 4 loses its corners). Symmetric on both axes at every size.
 * @param {number} w @param {number} h @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1
 */
export function ellipseMask(w, h, x0, y0, x1, y1) {
  const m = new Mask(w, h);
  const ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1);
  const cx = (ax + bx + 1) / 2, cy = (ay + by + 1) / 2;
  const rx = Math.max(0.25, (bx - ax + 1) / 2 - 0.25), ry = Math.max(0.25, (by - ay + 1) / 2 - 0.25);
  for (let y = ay; y <= by; y++) {
    const t = (y + 0.5 - cy) / ry;
    if (t * t > 1 + 1e-9) continue;
    const half = rx * Math.sqrt(Math.max(0, 1 - t * t));
    const xs = Math.ceil(cx - half - 0.5 - 1e-9), xe = Math.floor(cx + half - 0.5 + 1e-9);
    if (xe >= xs) m.setSpan(y, xs, xe);
  }
  return m;
}

/**
 * Even-odd polygon fill at pixel centres, plus the outline itself so thin
 * lassos still select their pixels. Points are in document space (floats).
 * @param {number} w @param {number} h @param {ArrayLike<number>} pts x0, y0, x1, y1, ...
 */
export function polygonMask(w, h, pts) {
  const m = new Mask(w, h);
  const n = pts.length >> 1;
  if (n === 0) return m;
  let minY = Infinity, maxY = -Infinity;
  for (let k = 0; k < n; k++) { minY = Math.min(minY, pts[2 * k + 1]); maxY = Math.max(maxY, pts[2 * k + 1]); }
  const xs = [];
  for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(h - 1, Math.ceil(maxY)); y++) {
    const yc = y + 0.5;
    xs.length = 0;
    for (let k = 0; k < n; k++) {
      const xa = pts[2 * k], ya = pts[2 * k + 1];
      const j = (k + 1) % n, xb = pts[2 * j], yb = pts[2 * j + 1];
      if ((ya <= yc && yc < yb) || (yb <= yc && yc < ya)) xs.push(xa + ((yc - ya) * (xb - xa)) / (yb - ya));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const x0 = Math.ceil(xs[k] - 0.5), x1 = Math.ceil(xs[k + 1] - 0.5) - 1;
      if (x1 >= x0) m.setSpan(y, x0, x1);
    }
  }
  for (let k = 0; k < n; k++) {
    const j = (k + 1) % n;
    bresenham(Math.floor(pts[2 * k]), Math.floor(pts[2 * k + 1]), Math.floor(pts[2 * j]), Math.floor(pts[2 * j + 1]), (x, y) => {
      if (x >= 0 && y >= 0 && x < w && y < h) m.set(y * w + x);
    });
  }
  return m;
}

/**
 * Scanline span flood fill.
 * @param {number} w @param {number} h @param {number} sx @param {number} sy
 * @param {(i: number) => boolean} test pixel belongs to the region
 * @param {4|8} [connectivity]
 */
export function floodMask(w, h, sx, sy, test, connectivity = 4) {
  const m = new Mask(w, h);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h || !test(sy * w + sx)) return m;
  const stack = [sx, sy];
  const ok = (i) => !m.get(i) && test(i);
  while (stack.length) {
    const y = /** @type {number} */ (stack.pop()), x = /** @type {number} */ (stack.pop());
    const row = y * w;
    if (!ok(row + x)) continue;
    let l = x, r = x;
    while (l > 0 && ok(row + l - 1)) l--;
    while (r < w - 1 && ok(row + r + 1)) r++;
    m.setSpan(y, l, r);
    const a = connectivity === 8 ? Math.max(0, l - 1) : l, b = connectivity === 8 ? Math.min(w - 1, r + 1) : r;
    for (const ny of [y - 1, y + 1]) {
      if (ny < 0 || ny >= h) continue;
      const nrow = ny * w;
      let inRun = false;
      for (let x2 = a; x2 <= b; x2++) {
        const good = ok(nrow + x2);
        if (good && !inRun) { stack.push(x2, ny); inRun = true; } else if (!good) inRun = false;
      }
    }
  }
  return m;
}

/**
 * Every pixel passing `test`, wherever it is.
 * @param {number} w @param {number} h @param {(i: number) => boolean} test
 */
export function globalMask(w, h, test) {
  const m = new Mask(w, h);
  const n = w * h;
  for (let i = 0; i < n; i++) if (test(i)) m.data[i >>> 5] |= 1 << (i & 31);
  m.version++;
  return m;
}
