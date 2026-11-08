// @ts-check
/**
 * Heavy, pure operations that may run in a worker. Each takes and returns
 * plain data (typed arrays, numbers, plain objects), so the same table runs
 * on the main thread when no worker is available.
 */
import { smooth, vignette } from '../ops/pixel-ops.js';
import { reduceColors } from '../ops/color-ops.js';
import { importPixelArt } from '../io/import.js';

/** @type {Record<string, (...args: any[]) => any>} */
export const OPS = {
  smooth: (rgba, w, h, rounds) => smooth(rgba, w, h, rounds),
  vignette: (rgba, w, h, o) => vignette(rgba, w, h, o),
  reduceColors: (colors, usage, target) => reduceColors(colors, usage, target),
  importPixelArt: (rgba, w, h, o) => importPixelArt(rgba, w, h, o),
};

/**
 * Buffers inside a result that can be transferred instead of copied.
 * @param {any} value @returns {ArrayBuffer[]}
 */
export function transferables(value) {
  const out = new Set();
  const visit = (v, depth) => {
    if (!v || depth > 2) return;
    if (ArrayBuffer.isView(v)) { if (v.buffer instanceof ArrayBuffer) out.add(v.buffer); return; }
    if (typeof v === 'object') for (const k of Object.keys(v)) visit(v[k], depth + 1);
  };
  visit(value, 0);
  return [...out];
}
