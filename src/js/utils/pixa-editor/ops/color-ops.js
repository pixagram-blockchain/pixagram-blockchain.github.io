// @ts-check
/**
 * Palette transforms: functions from a palette (Uint32Array, index 0 is
 * transparent) and per-entry usage counts to a new palette of the same
 * length. They cost O(colours) and never look at pixel positions.
 */
import {
  pack, unpack, mix, luma, toHsl, fromHsl, toOklab, fromOklab, maxChroma, clamp8, canonical,
} from '../color/rgba.js';

/**
 * Value at the given cumulative weight fraction.
 * @param {Array<[number, number]>} pairs [value, weight], sorted by value
 * @param {number} q 0..1
 */
function weightedQuantile(pairs, q) {
  let total = 0;
  for (const [, w] of pairs) total += w;
  if (!total) return 0;
  const target = q * total;
  let acc = 0;
  for (const [v, w] of pairs) {
    acc += w;
    if (acc >= target) return v;
  }
  return pairs[pairs.length - 1][0];
}

/** @param {Uint32Array} colors @param {Uint32Array} usage */
function visibleEntries(colors, usage) {
  const out = [];
  for (let i = 1; i < colors.length; i++) if (usage[i] && colors[i] >>> 24) out.push(i);
  return out;
}

/**
 * Stretches lightness between the 1st and 99th usage-weighted percentiles,
 * then mixes with the original by `intensity`.
 * @param {Uint32Array} colors @param {Uint32Array} usage @param {number} intensity 0..1
 */
export function autoContrast(colors, usage, intensity = 1) {
  const idx = visibleEntries(colors, usage);
  const out = colors.slice();
  if (idx.length < 2) return out;
  const pairs = /** @type {Array<[number, number]>} */ (idx.map((i) => [luma(colors[i]), usage[i]])).sort((a, b) => a[0] - b[0]);
  const lo = weightedQuantile(pairs, 0.01), hi = weightedQuantile(pairs, 0.99);
  if (hi - lo < 1) return out;
  const k = 255 / (hi - lo);
  for (const i of idx) {
    const [r, g, b, a] = unpack(colors[i]);
    out[i] = mix(colors[i], pack((r - lo) * k, (g - lo) * k, (b - lo) * k, a), intensity);
  }
  return out;
}

/**
 * Stretches Oklch chroma between usage-weighted percentiles, hue and
 * lightness kept. Chroma is measured relative to the most the sRGB gamut
 * allows at each colour's lightness and hue, so a stretched colour never
 * clips: the 1st percentile maps to grey's side, the 99th to the gamut edge.
 * Then mixes with the original by `intensity`.
 * @param {Uint32Array} colors @param {Uint32Array} usage @param {number} intensity
 */
export function autoSaturation(colors, usage, intensity = 1) {
  const idx = visibleEntries(colors, usage);
  const out = colors.slice();
  if (!idx.length) return out;
  const lch = new Map(idx.map((i) => {
    const [L, A, B] = toOklab(colors[i]);
    const C = Math.hypot(A, B), h = Math.atan2(B, A), max = maxChroma(L, h);
    return [i, { L, C, h, max, rel: max > 1e-4 ? Math.min(1, C / max) : 0 }];
  }));
  const pairs = /** @type {Array<[number, number]>} */ (idx.map((i) => [/** @type {any} */ (lch.get(i)).rel, usage[i]])).sort((a, b) => a[0] - b[0]);
  const lo = weightedQuantile(pairs, 0.01), hi = weightedQuantile(pairs, 0.99);
  if (hi - lo < 0.01) return out;
  for (const i of idx) {
    const v = /** @type {any} */ (lch.get(i));
    if (v.max <= 1e-4) continue; // greys and pure black or white have no hue to stretch
    const rel = Math.min(1, Math.max(0, (v.rel - lo) / (hi - lo)));
    const C = rel * v.max;
    out[i] = mix(colors[i], fromOklab(v.L, C * Math.cos(v.h), C * Math.sin(v.h), colors[i] >>> 24), intensity);
  }
  return out;
}

/**
 * Colour to alpha by un-mixing (as in GIMP): each colour becomes the most
 * transparent colour that, laid over `key`, reproduces it.
 * @param {Uint32Array} colors @param {number} key @param {number} intensity
 */
export function colorToAlpha(colors, key, intensity = 1) {
  const out = colors.slice();
  const k = [key & 255, (key >>> 8) & 255, (key >>> 16) & 255];
  for (let i = 1; i < colors.length; i++) {
    const c = colors[i];
    const a0 = c >>> 24;
    if (!a0) continue;
    const p = [c & 255, (c >>> 8) & 255, (c >>> 16) & 255];
    let alpha = 0;
    for (let ch = 0; ch < 3; ch++) {
      let a = 0;
      if (p[ch] > k[ch]) a = (p[ch] - k[ch]) / (255 - k[ch]);
      else if (p[ch] < k[ch]) a = (k[ch] - p[ch]) / k[ch];
      if (a > alpha) alpha = a;
    }
    let result = 0;
    if (alpha > 1e-6) {
      const rgb = p.map((v, ch) => (v - k[ch]) / alpha + k[ch]);
      result = pack(rgb[0], rgb[1], rgb[2], alpha * a0);
    }
    out[i] = mix(c, result, intensity);
  }
  return out;
}

/** @param {Uint32Array} colors @param {number} from @param {number} to */
export function replaceColor(colors, from, to) {
  from = canonical(from);
  const out = colors.slice();
  for (let i = 1; i < colors.length; i++) if (colors[i] === from) out[i] = to;
  return out;
}

/**
 * Usage-weighted circular mean hue of saturated colours, or null.
 * @param {Uint32Array} colors @param {Uint32Array} usage
 */
export function meanHue(colors, usage) {
  let sx = 0, sy = 0;
  for (let i = 1; i < colors.length; i++) {
    if (!usage[i] || !(colors[i] >>> 24)) continue;
    const [h, s] = toHsl(colors[i]);
    if (s < 5) continue;
    const w = usage[i] * (s / 100);
    sx += Math.cos((h * Math.PI) / 180) * w;
    sy += Math.sin((h * Math.PI) / 180) * w;
  }
  if (Math.abs(sx) + Math.abs(sy) < 1e-9) return null;
  return ((Math.atan2(sy, sx) * 180) / Math.PI + 360) % 360;
}

/**
 * Recolour ("Colorize dynamical"): rotates every hue so the weighted mean
 * hue lands on the target's hue; saturation and lightness kept. A grey
 * target desaturates instead. `strength` scales the change.
 * @param {Uint32Array} colors @param {Uint32Array} usage @param {number} target @param {number} [strength]
 */
export function recolor(colors, usage, target, strength = 1) {
  const out = colors.slice();
  const [th, ts] = toHsl(target);
  const mean = meanHue(colors, usage);
  for (let i = 1; i < colors.length; i++) {
    const c = colors[i];
    if (!(c >>> 24)) continue;
    const [h, s, l, a] = toHsl(c);
    let next;
    if (ts < 5) next = fromHsl(h, s * (1 - strength), l, a);
    else {
      const delta = mean === null ? 0 : ((th - mean + 540) % 360) - 180;
      next = mean === null ? fromHsl(th, Math.max(s, ts * strength), l, a) : fromHsl(h + delta * strength, s, l, a);
    }
    out[i] = next;
  }
  return out;
}

/** @param {Uint32Array} colors @param {number} dS @param {number} dL percentage points */
export function hslNudge(colors, dS, dL) {
  const out = colors.slice();
  for (let i = 1; i < colors.length; i++) {
    const c = colors[i];
    if (!(c >>> 24)) continue;
    const [h, s, l, a] = toHsl(c);
    out[i] = fromHsl(h, s + dS, l + dL, a);
  }
  return out;
}

/**
 * Usage-weighted mean colour, averaged in Oklab.
 * @param {Uint32Array} colors @param {Uint32Array} usage
 */
export function averageColor(colors, usage) {
  let L = 0, A = 0, B = 0, al = 0, w = 0, wa = 0;
  for (let i = 0; i < colors.length; i++) {
    if (!usage[i]) continue;
    const c = colors[i], a = c >>> 24;
    wa += usage[i];
    al += a * usage[i];
    if (!a) continue;
    const [l, aa, bb] = toOklab(c);
    const ww = usage[i] * a;
    L += l * ww; A += aa * ww; B += bb * ww; w += ww;
  }
  if (!w) return 0;
  return fromOklab(L / w, A / w, B / w, al / wa);
}

/**
 * Weighted k-means in Oklab (alpha as a fourth axis). Returns a new palette
 * of the same length in which every used colour maps to its cluster colour.
 * @param {Uint32Array} colors @param {Uint32Array} usage
 * @param {number | 'auto'} target colour count, or 'auto' (cap 255, else halve)
 */
export function reduceColors(colors, usage, target) {
  const idx = visibleEntries(colors, usage);
  const count = idx.length;
  let k = target === 'auto' ? (count > 255 ? 255 : Math.floor(count / 2)) : Math.round(target);
  k = Math.max(1, k);
  const out = colors.slice();
  if (count <= k) return out;

  // Points: one per colour, or per RGB555 + 3-bit alpha bucket for big palettes.
  /** @type {Array<{c: number[], w: number, members: number[]}>} */
  let points;
  const feature = (c) => {
    const [l, a, b] = toOklab(c);
    return [l, a, b, ((c >>> 24) / 255) * 0.5];
  };
  if (count > 4096) {
    const buckets = new Map();
    for (const i of idx) {
      const c = colors[i];
      const key = ((c & 255) >> 3) | ((((c >>> 8) & 255) >> 3) << 5) | ((((c >>> 16) & 255) >> 3) << 10) | (((c >>> 24) >> 5) << 15);
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = { sum: [0, 0, 0, 0], w: 0, members: [] }));
      const f = feature(c), w = usage[i];
      for (let d = 0; d < 4; d++) b.sum[d] += f[d] * w;
      b.w += w;
      b.members.push(i);
    }
    points = [...buckets.values()].map((b) => ({ c: b.sum.map((s) => s / b.w), w: b.w, members: b.members }));
  } else {
    points = idx.map((i) => ({ c: feature(colors[i]), w: usage[i], members: [i] }));
  }
  k = Math.min(k, points.length);

  const dist = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2 + (p[3] - q[3]) ** 2;
  // Deterministic seeding: heaviest point, then the point maximising weight x distance^2.
  const centroids = [];
  let first = 0;
  for (let p = 1; p < points.length; p++) if (points[p].w > points[first].w) first = p;
  centroids.push(points[first].c.slice());
  const dmin = points.map((p) => dist(p.c, centroids[0]));
  while (centroids.length < k) {
    let best = -1, bestScore = -1;
    for (let p = 0; p < points.length; p++) {
      const s = dmin[p] * Math.sqrt(points[p].w);
      if (s > bestScore) { bestScore = s; best = p; }
    }
    if (bestScore <= 0) break;
    centroids.push(points[best].c.slice());
    for (let p = 0; p < points.length; p++) dmin[p] = Math.min(dmin[p], dist(points[p].c, points[best].c));
  }
  const assign = new Int32Array(points.length).fill(-1);
  for (let iter = 0; iter < 12; iter++) {
    let moved = 0;
    for (let p = 0; p < points.length; p++) {
      let best = 0, bd = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const d = dist(points[p].c, centroids[c]);
        if (d < bd) { bd = d; best = c; }
      }
      if (assign[p] !== best) { assign[p] = best; moved++; }
    }
    const sums = centroids.map(() => [0, 0, 0, 0, 0]);
    for (let p = 0; p < points.length; p++) {
      const s = sums[assign[p]], w = points[p].w;
      for (let d = 0; d < 4; d++) s[d] += points[p].c[d] * w;
      s[4] += w;
    }
    for (let c = 0; c < centroids.length; c++) if (sums[c][4]) centroids[c] = sums[c].slice(0, 4).map((v) => v / sums[c][4]);
    if (!moved) break;
  }
  const colorOf = centroids.map((c) => fromOklab(c[0], c[1], c[2], clamp8((c[3] / 0.5) * 255)));
  for (let p = 0; p < points.length; p++) for (const i of points[p].members) out[i] = colorOf[assign[p]];
  return out;
}
