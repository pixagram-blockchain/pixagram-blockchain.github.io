// @ts-check
/**
 * Bridges to the pixa.pics modules, passed in by the host so the core keeps
 * zero runtime dependencies:
 *
 *   import { SetFixed } from '@asaitama/boolean-array';
 *   import SIMDope from 'simdope';
 *   const sf = interop.maskToSetFixed(editor.doc.selection, SetFixed);
 *
 * Masks share SetFixed's exact bit layout (LSB-first words, length in the
 * last word), and packed colours share SIMDope's uint32 byte order, so both
 * conversions are copies at most.
 */
import { Mask } from '../model/Mask.js';
import { toOklab } from '../color/rgba.js';

/** Zero-copy SetFixed view of a mask (size repaired, see Mask#toSetFixed). @param {Mask} mask @param {any} SetFixed */
export function maskToSetFixed(mask, SetFixed) {
  return mask.toSetFixed(SetFixed);
}

/** @param {any} setFixed @param {number} width @param {number} height */
export function maskFromSetFixed(setFixed, width, height) {
  return Mask.fromSetFixed(setFixed, width, height);
}

/** @param {any} SIMDope the simdope default export @param {number} packed */
export function toSIMDopeColor(SIMDope, packed) {
  return SIMDope.Color.new_uint32(packed >>> 0);
}

/** @param {{ uint32: number }} color */
export function fromSIMDopeColor(color) {
  return color.uint32 >>> 0;
}

/**
 * Display order for a palette. With SIMDope, along one of its colour-space
 * curves ('hilbert', 'lebesgue', 'moore'); without it, by Oklab lightness then
 * hue. Transparent entries go last.
 * @param {ArrayLike<number>} colors
 * @param {{ by?: 'hilbert'|'lebesgue'|'moore'|'lightness', SIMDope?: any }} [o]
 * @returns {number[]} indices into `colors`
 */
export function sortPalette(colors, o = {}) {
  const by = o.by ?? (o.SIMDope ? 'hilbert' : 'lightness');
  const keys = Array.from(colors, (c, i) => {
    c >>>= 0;
    if (!(c >>> 24)) return [i, Infinity, 0];
    if (by !== 'lightness' && o.SIMDope) return [i, Number(o.SIMDope.Color.new_uint32(c)[by]), 0];
    const [L, A, B] = toOklab(c);
    return [i, Math.round(L * 20), Math.atan2(B, A)];
  });
  keys.sort((a, b) => a[1] - b[1] || a[2] - b[2]);
  return keys.map((k) => k[0]);
}
