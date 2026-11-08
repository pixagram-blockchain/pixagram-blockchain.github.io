// @ts-check
/**
 * Colour filters, applied to palette colours (O(colours)). The 26 named
 * looks are pixa.pics' lookup tables (MIT), kept as data in filters/presets.js;
 * Greyscale, Sepia, Screen and Difference are code, ported from pixa.pics.
 * Every filter output is mixed with the original by `intensity`.
 */
import presetFile from './filters/presets.js';
import { mix } from '../color/rgba.js';

/** @type {Map<string, {r: Uint8Array, g: Uint8Array, b: Uint8Array}>} */
const LUTS = new Map();
for (const [name, t] of Object.entries(presetFile.presets)) {
  if (name === '...none') continue;
  const compose = (ch) => Uint8Array.from(ch, (v) => t.a[v]);
  LUTS.set(name.replace(/^\./, ''), { r: compose(t.r), g: compose(t.g), b: compose(t.b) });
}

const SPECIAL = ['Greyscale', 'Sepia', 'Screen', 'Difference'];
export const FILTER_NAMES = [...LUTS.keys(), ...SPECIAL];

/** @param {number} v */
const screenComp = (v) => 255 - Math.min(255, Math.max(0, v + v - Math.round(((v / 255) * (v / 255)) * 255)));
/** @param {number} v @param {number} lo @param {number} hi */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Filtered colour at full strength.
 * @param {string} name @param {number} c
 */
export function filterColor(name, c) {
  const a = c >>> 24;
  if (!a) return 0;
  const r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
  const lut = LUTS.get(name);
  let nr, ng, nb;
  if (lut) { nr = lut.r[r]; ng = lut.g[g]; nb = lut.b[b]; }
  else if (name === 'Greyscale') nr = ng = nb = ((r + g + b) / 3) | 0;
  else if (name === 'Sepia') {
    nr = clamp((r * 0.393 + g * 0.769 + b * 0.189) | 0, 0, 255);
    ng = clamp((r * 0.349 + g * 0.686 + b * 0.168) | 0, 0, 255);
    nb = clamp((r * 0.272 + g * 0.534 + b * 0.131) | 0, 0, 255);
  } else if (name === 'Screen') { nr = screenComp(r); ng = screenComp(g); nb = screenComp(b); }
  else if (name === 'Difference') nr = ng = nb = 0;
  else throw new Error(`Unknown filter: ${name}`);
  return ((a << 24) | (nb << 16) | (ng << 8) | nr) >>> 0;
}

/**
 * pixa.pics scales two special filters down: Screen to a quarter and
 * Difference to half of the requested intensity.
 * @param {string} name @param {number} intensity
 */
function effectiveIntensity(name, intensity) {
  if (name === 'Screen') return intensity / 4;
  if (name === 'Difference') return intensity / 2;
  return intensity;
}

/**
 * @param {Uint32Array} colors palette @param {string} name @param {number} intensity 0..1
 */
export function applyFilter(colors, name, intensity = 1) {
  const t = effectiveIntensity(name, intensity);
  const out = colors.slice();
  for (let i = 1; i < colors.length; i++) {
    const c = colors[i];
    if (c >>> 24) out[i] = mix(c, filterColor(name, c), t);
  }
  return out;
}
