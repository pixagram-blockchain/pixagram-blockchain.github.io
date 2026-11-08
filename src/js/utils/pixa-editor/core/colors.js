// @ts-check
/**
 * Document colour bookkeeping: per-layer colour counts cached by layer
 * revision, their union for the document, and the cap that keeps a document
 * at or under N colours (256 by default, so every export can be PNG8).
 *
 * The cap counts the document palette: every colour used on any layer,
 * hidden layers included. Semi-transparent layers can still blend into extra
 * colours in a flattened export; the export reports the true count.
 */
import { toOklab } from '../color/rgba.js';

/**
 * Colour → pixel count for one layer, transparent excluded.
 * @param {import('../model/Layer.js').Layer} layer
 * @returns {Map<number, number>}
 */
export function countLayer(layer) {
  const u = layer.usage(), pal = layer.palette.colors, counts = new Map();
  for (let i = 1; i < u.length; i++) {
    if (!u[i]) continue;
    const c = pal[i];
    if (!(c >>> 24)) continue;
    counts.set(c, (counts.get(c) || 0) + u[i]);
  }
  return counts;
}

/**
 * Colour → pixel count of packed colours, transparent excluded.
 * @param {Uint32Array} rgba
 * @returns {Map<number, number>}
 */
export function countRGBA(rgba) {
  const counts = new Map();
  let last = -1, n = 0;
  for (let i = 0; i < rgba.length; i++) {
    const c = rgba[i];
    if (c === last) { n++; continue; }
    if (last >>> 24 && n) counts.set(last, (counts.get(last) || 0) + n);
    last = c;
    n = 1;
  }
  if (last >>> 24 && n) counts.set(last, (counts.get(last) || 0) + n);
  return counts;
}

/** Per-layer counts, recomputed only when a layer's revision moves. */
export class ColorCensus {
  constructor() {
    /** @type {WeakMap<object, { revision: number, counts: Map<number, number> }>} */
    this.cache = new WeakMap();
  }

  /** Current counts of a layer. @param {import('../model/Layer.js').Layer} layer */
  layer(layer) {
    const hit = this.cache.get(layer);
    if (hit && hit.revision === layer.revision) return hit.counts;
    const counts = countLayer(layer);
    this.cache.set(layer, { revision: layer.revision, counts });
    return counts;
  }

  /** Last counts seen for a layer, whatever its revision now; null if never seen. @param {object} layer */
  peek(layer) {
    return this.cache.get(layer)?.counts ?? null;
  }

  /**
   * Union of every layer's colours with summed counts.
   * @param {import('../model/Document.js').Document} doc
   */
  document(doc) {
    const out = new Map();
    for (const l of doc.layers) for (const [c, n] of this.layer(l)) out.set(c, (out.get(c) || 0) + n);
    return out;
  }
}

/** @param {number} c */
const feature = (c) => {
  const [L, A, B] = toOklab(c);
  return [L, A, B, ((c >>> 24) / 255) * 0.5];
};

/**
 * Which new colours stay and where the others go, so that `base` plus the
 * new colours fit in `limit`. Deterministic: the most used new colours stay
 * (ties broken by value); the rest move to their nearest allowed colour in
 * Oklab, alpha weighted.
 * @param {Map<number, number>} fresh new colour → pixel count
 * @param {Iterable<number>} base colours already present
 * @param {number} limit
 * @returns {Map<number, number>} moved colour → replacement
 */
export function capColors(fresh, base, limit) {
  const baseList = [...base].sort((a, b) => a - b);
  const room = Math.max(0, limit - baseList.length);
  const sorted = [...fresh.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const moves = new Map();
  if (sorted.length <= room) return moves;
  const allowed = baseList.concat(sorted.slice(0, room).map((e) => e[0]));
  if (!allowed.length) {
    for (const [c] of sorted) moves.set(c, 0);
    return moves;
  }
  const feats = allowed.map(feature);
  for (let k = room; k < sorted.length; k++) {
    const c = sorted[k][0], f = feature(c);
    let best = 0, bd = Infinity;
    for (let j = 0; j < feats.length; j++) {
      const g = feats[j];
      const d = (f[0] - g[0]) ** 2 + (f[1] - g[1]) ** 2 + (f[2] - g[2]) ** 2 + (f[3] - g[3]) ** 2;
      if (d < bd) { bd = d; best = j; }
    }
    moves.set(c, allowed[best]);
  }
  return moves;
}
