// @ts-check
/**
 * Brush tips as lists of (dx, dy) offsets around the pointer pixel.
 * Odd sizes centre on the pixel; even sizes extend one pixel further left/up.
 *
 * Circles: odd size 2R+1 keeps i^2 + j^2 <= R^2 + R - 1, even size 2R keeps
 * (i + 1/2)^2 + (j + 1/2)^2 <= R^2. That gives the shapes pixel artists draw
 * by hand: 3 = plus, 4 = square without corners, 5 = rows 3-5-5-5-3.
 */

export const TIP_SHAPES = /** @type {const} */ (['square', 'circle', 'diamond', 'plus', 'hbar', 'vbar']);
export const MAX_TIP_SIZE = 32;

/** @type {Map<string, Int16Array>} */
const cache = new Map();

/**
 * @param {string} shape @param {number} size
 * @returns {Int16Array} dx0, dy0, dx1, dy1, ...
 */
export function tipOffsets(shape, size) {
  size = Math.max(1, Math.min(MAX_TIP_SIZE, Math.round(size)));
  const key = `${shape}:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const out = [];
  const even = size % 2 === 0, R = Math.floor(size / 2);
  const lo = -R, hi = even ? R - 1 : R;
  for (let j = lo; j <= hi; j++) {
    for (let i = lo; i <= hi; i++) {
      // Distances measured from the brush centre.
      const fx = even ? i + 0.5 : i, fy = even ? j + 0.5 : j;
      let keep = false;
      switch (shape) {
        case 'square': keep = true; break;
        case 'circle': keep = even ? fx * fx + fy * fy <= R * R + 1e-9 : (R === 0 || i * i + j * j <= R * R + R - 1); break;
        case 'diamond': keep = Math.abs(fx) + Math.abs(fy) <= R + 1e-9; break;
        case 'plus': keep = Math.abs(fx) < 1 || Math.abs(fy) < 1; break;
        case 'hbar': keep = j === 0; break;
        case 'vbar': keep = i === 0; break;
        default: throw new Error(`Unknown tip shape: ${shape}`);
      }
      if (keep) out.push(i, j);
    }
  }
  const arr = Int16Array.from(out);
  cache.set(key, arr);
  return arr;
}

/**
 * A custom tip from a mask: its set pixels around the centre of its bounds.
 * @param {import('../model/Mask.js').Mask} mask
 */
export function tipFromMask(mask) {
  const b = mask.bounds();
  if (!b) return Int16Array.of(0, 0);
  const cx = Math.floor((b.x0 + b.x1) / 2), cy = Math.floor((b.y0 + b.y1) / 2);
  const out = [];
  mask.forEach((i) => {
    const x = i % mask.width, y = (i - x) / mask.width;
    out.push(x - cx, y - cy);
  });
  return Int16Array.from(out);
}

/**
 * Outline segments of a tip (for the cursor footprint), in tip-local pixel
 * edge coordinates: [x0, y0, x1, y1, ...].
 * @param {Int16Array} offsets
 */
export function tipOutline(offsets) {
  const set = new Set();
  for (let k = 0; k < offsets.length; k += 2) set.add(`${offsets[k]},${offsets[k + 1]}`);
  const segs = [];
  for (let k = 0; k < offsets.length; k += 2) {
    const x = offsets[k], y = offsets[k + 1];
    if (!set.has(`${x},${y - 1}`)) segs.push(x, y, x + 1, y);
    if (!set.has(`${x},${y + 1}`)) segs.push(x, y + 1, x + 1, y + 1);
    if (!set.has(`${x - 1},${y}`)) segs.push(x, y, x, y + 1);
    if (!set.has(`${x + 1},${y}`)) segs.push(x + 1, y, x + 1, y + 1);
  }
  return Float32Array.from(segs);
}
