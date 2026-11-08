// @ts-check
/**
 * Flattens a region of the document into packed colours, the way the screen
 * shows it: visible layers bottom to top at their opacity, the floating layer
 * just above the active one, and the preview override (an effect or filter
 * being tried) in place of its layer's real colours. DOM-free, so the canvas
 * view and the tests share it.
 */
import { over } from '../color/rgba.js';

/**
 * @typedef {{ layer: any, palette?: Uint32Array, rgba?: Uint32Array } | null} Override
 * @typedef {{ includeFloating?: boolean, upTo?: number, base?: { data: Uint32Array, layers: number } | null }} RegionOptions
 * `upTo` composites only the bottom `upTo` layers (no floating); `base` holds
 * the exact composite of the bottom `base.layers` layers for the whole
 * document, so compositing resumes from there.
 */

/**
 * Tile by tile, then pixel by pixel. Per 32 x 32 tile only the layers that
 * have something there take part (layer occupancy); per pixel, compositing
 * starts at the topmost opaque pixel of a fully opaque layer, since nothing
 * under it shows. over() is inlined with its exact arithmetic, so results are
 * bit-identical to blending every layer with over(), bottom to top.
 * @param {import('../model/Document.js').Document} doc
 * @param {Override} override
 * @param {number} x0 @param {number} y0 @param {number} w @param {number} h region, clipped by the caller
 * @param {Uint32Array} [out] w * h, reused when given
 * @param {RegionOptions} [o]
 */
export function compositeRegion(doc, override, x0, y0, w, h, out, o = {}) {
  const W = doc.width, layers = doc.layers, active = doc.activeIndex;
  const L = Math.min(layers.length, o.upTo ?? layers.length);
  const fl = o.upTo !== undefined || o.includeFloating === false || !doc.floating || doc.floating.pristine ? null : doc.floating;
  const n = w * h;
  const dst = out && out.length >= n ? out : new Uint32Array(n);
  const base = o.base && o.base.layers <= Math.min(L, active) ? o.base : null;
  const from = base ? base.layers : 0, baseData = base ? base.data : null;

  const pals = new Array(L), idxs = new Array(L), ops = new Int32Array(L), occs = new Array(L);
  let ovk = -1, /** @type {Uint32Array} */ ovRgba = new Uint32Array(0);
  for (let k = 0; k < L; k++) {
    const l = layers[k], ov = override && override.layer === l ? override : null;
    pals[k] = ov && ov.palette ? ov.palette : l.palette.colors;
    idxs[k] = l.indices;
    ops[k] = l.visible && l.opacity > 0 ? Math.round(l.opacity * 255) : 0;
    if (ov && ov.rgba) { ovk = k; ovRgba = ov.rgba; }
    // Occupancy is about index 0, which is transparent in every palette; a pixel preview has no indices.
    occs[k] = ops[k] && k !== ovk && !(pals[k][0] >>> 24) ? l.occupiedTiles() : null;
  }
  const fx0 = fl ? fl.x : 0, fy0 = fl ? fl.y : 0, fx1 = fl ? fl.x + fl.dw : 0, fy1 = fl ? fl.y + fl.dh : 0;
  const TX = Math.ceil(W / 32), sub = new Int32Array(Math.max(1, L));

  for (let ty = y0 >> 5; ty <= (y0 + h - 1) >> 5; ty++) {
    const ay = Math.max(y0, ty << 5), by = Math.min(y0 + h, (ty << 5) + 32);
    for (let tx = x0 >> 5; tx <= (x0 + w - 1) >> 5; tx++) {
      const ax = Math.max(x0, tx << 5), bx = Math.min(x0 + w, (tx << 5) + 32), t = ty * TX + tx;
      let m = 0;
      for (let k = from; k < L; k++) if (ops[k] && (!occs[k] || occs[k][t])) sub[m++] = k;
      const flHere = !!fl && ax < fx1 && bx > fx0 && ay < fy1 && by > fy0;
      if (m === 0 && !flHere) {
        for (let y = ay; y < by; y++) {
          const orow = (y - y0) * w - x0, row = y * W;
          for (let x = ax; x < bx; x++) dst[orow + x] = baseData ? baseData[row + x] : 0;
        }
        continue;
      }
      // Fast paths: one or two palette layers in this tile, no floating layer.
      if (!flHere && m <= 2 && sub[0] !== ovk && (m === 1 || sub[1] !== ovk)) {
        const k0 = sub[0], p0 = pals[k0], i0 = idxs[k0], o0 = ops[k0];
        const k1 = m === 2 ? sub[1] : k0, p1 = pals[k1], i1 = idxs[k1], o1 = ops[k1], two = m === 2;
        for (let y = ay; y < by; y++) {
          const row = y * W, orow = (y - y0) * w - x0;
          for (let x = ax; x < bx; x++) {
            const si = row + x;
            let d = baseData ? baseData[si] : 0;
            if (two) {
              const c1 = p1[i1[si]];
              if (c1 >>> 24 === 255 && o1 === 255) { dst[orow + x] = c1; continue; }
              const c0 = p0[i0[si]], a0 = c0 >>> 24;
              if (a0 !== 0) d = a0 === 255 && o0 === 255 ? c0 : blend(d, c0, a0, o0);
              const a1 = c1 >>> 24;
              if (a1 !== 0) d = blend(d, c1, a1, o1);
            } else {
              const c0 = p0[i0[si]], a0 = c0 >>> 24;
              if (a0 !== 0) d = a0 === 255 && o0 === 255 ? c0 : blend(d, c0, a0, o0);
            }
            dst[orow + x] = d;
          }
        }
        continue;
      }
      if (!flHere && ovk < 0) {
        // Plain case: palette layers only, nothing floating here.
        for (let y = ay; y < by; y++) {
          const row = y * W, orow = (y - y0) * w - x0;
          for (let x = ax; x < bx; x++) {
            const si = row + x;
            let s = 0, d = baseData ? baseData[si] : 0;
            for (let j = m - 1; j >= 0; j--) {
              const k = sub[j];
              if (ops[k] !== 255) continue;
              const c = pals[k][idxs[k][si]];
              if (c >>> 24 === 255) { s = j + 1; d = c; break; }
            }
            for (let j = s; j < m; j++) {
              const k = sub[j], c = pals[k][idxs[k][si]], a = c >>> 24;
              if (a !== 0) d = a === 255 && ops[k] === 255 ? c : blend(d, c, a, ops[k]);
            }
            dst[orow + x] = d;
          }
        }
        continue;
      }
      for (let y = ay; y < by; y++) {
        const row = y * W, orow = (y - y0) * w - x0, flRow = flHere && y >= fy0 && y < fy1;
        for (let x = ax; x < bx; x++) {
          const si = row + x;
          let s = 0, d = baseData ? baseData[si] : 0, startK = from;
          for (let j = m - 1; j >= 0; j--) {
            const k = sub[j];
            if (ops[k] !== 255) continue;
            const c = k === ovk ? ovRgba[si] : pals[k][idxs[k][si]];
            // An opaque pixel of a fully opaque layer: it is the result so far, the layers under it never show.
            if (c >>> 24 === 255) { s = j + 1; d = c; startK = k; break; }
          }
          // The floating layer sits just above the active layer.
          let flPending = flRow && x >= fx0 && x < fx1 && startK <= active;
          for (let j = s; j < m; j++) {
            const k = sub[j];
            if (flPending && k > active) { d = floatOver(d, /** @type {any} */ (fl), x - fx0, y - fy0); flPending = false; }
            const c = k === ovk ? ovRgba[si] : pals[k][idxs[k][si]], a = c >>> 24;
            if (a !== 0) d = a === 255 && ops[k] === 255 ? c : blend(d, c, a, ops[k]);
          }
          if (flPending) d = floatOver(d, /** @type {any} */ (fl), x - fx0, y - fy0);
          dst[orow + x] = d;
        }
      }
    }
  }
  return dst;
}

/** @param {number} d @param {import('../model/Floating.js').Floating} fl @param {number} dx @param {number} dy */
function floatOver(d, fl, dx, dy) {
  const c = fl.sample(dx, dy);
  return c >>> 24 ? over(d, c, 255) : d;
}

/**
 * over(d, c, op) for a source with alpha a > 0, with over()'s exact arithmetic.
 * @param {number} d @param {number} c @param {number} a @param {number} op
 */
function blend(d, c, a, op) {
  const sa = (a * op) / 65025, da = (d >>> 24) / 255;
  if (sa >= 1 || da <= 0) {
    const a8 = Math.round(sa * 255);
    return a8 === 0 ? 0 : ((a8 << 24) | (c & 0xffffff)) >>> 0;
  }
  const kd = da * (1 - sa), oa = sa + kd, a8 = Math.round(oa * 255);
  if (a8 === 0) return 0;
  const r = Math.round(((c & 255) * sa + (d & 255) * kd) / oa);
  const g = Math.round((((c >>> 8) & 255) * sa + ((d >>> 8) & 255) * kd) / oa);
  const b = Math.round((((c >>> 16) & 255) * sa + ((d >>> 16) & 255) * kd) / oa);
  return ((a8 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

/**
 * A compositor that keeps the flattened layers under the active one, so
 * strokes and previews on the active layer only blend it and the layers
 * above. Results are identical to compositeRegion.
 */
export class Compositor {
  constructor() {
    this.key = '';
    /** @type {{ data: Uint32Array, layers: number } | null} */
    this.base = null;
  }

  /** @param {import('../model/Document.js').Document} doc @param {number} upTo */
  keyFor(doc, upTo) {
    let k = `${doc.width}x${doc.height}:${upTo}`;
    for (let i = 0; i < upTo; i++) {
      const l = doc.layers[i];
      k += `|${l.id}:${l.revision}:${l.visible ? 1 : 0}:${l.opacity}`;
    }
    return k;
  }

  /**
   * @param {import('../model/Document.js').Document} doc @param {Override} override
   * @param {number} x0 @param {number} y0 @param {number} w @param {number} h
   * @param {Uint32Array} [out] @param {{ includeFloating?: boolean }} [o]
   */
  region(doc, override, x0, y0, w, h, out, o = {}) {
    const a = doc.activeIndex;
    const below = override ? doc.layers.indexOf(override.layer) < a : false;
    if (a < 1 || below) return compositeRegion(doc, override, x0, y0, w, h, out, o);
    const key = this.keyFor(doc, a);
    if (key !== this.key || !this.base) {
      this.base = { data: compositeRegion(doc, null, 0, 0, doc.width, doc.height, undefined, { upTo: a }), layers: a };
      this.key = key;
    }
    return compositeRegion(doc, override, x0, y0, w, h, out, { ...o, base: this.base });
  }

  invalidate() {
    this.key = '';
    this.base = null;
  }
}

/**
 * The whole document, flattened.
 * @param {import('../model/Document.js').Document} doc
 * @param {{ layer: any, palette?: Uint32Array, rgba?: Uint32Array } | null} [override]
 * @param {{ includeFloating?: boolean }} [o]
 */
export function compositeAll(doc, override = null, o = {}) {
  return compositeRegion(doc, override, 0, 0, doc.width, doc.height, undefined, o);
}
