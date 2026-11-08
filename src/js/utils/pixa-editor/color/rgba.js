// @ts-check
/**
 * Packed colours.
 *
 * A colour is one unsigned 32-bit integer in ImageData byte order on
 * little-endian hardware: bytes R, G, B, A -> value 0xAABBGGRR. This is the
 * same layout as `new Uint32Array(imageData.data.buffer)` and as SIMDope's
 * `Color#uint32`, so buffers move between the three without conversion.
 *
 * Alpha is straight (not premultiplied). Every fully transparent colour is
 * canonicalised to 0 so palettes never fill up with invisible variants.
 */

export const TRANSPARENT = 0;

/** @param {number} c */ export const red = (c) => c & 255;
/** @param {number} c */ export const green = (c) => (c >>> 8) & 255;
/** @param {number} c */ export const blue = (c) => (c >>> 16) & 255;
/** @param {number} c */ export const alpha = (c) => c >>> 24;

/**
 * @param {number} r @param {number} g @param {number} b @param {number} [a]
 * @returns {number}
 */
export function pack(r, g, b, a = 255) {
  a = clamp8(a);
  if (a === 0) return 0;
  return ((a << 24) | (clamp8(b) << 16) | (clamp8(g) << 8) | clamp8(r)) >>> 0;
}

/** @param {number} c @returns {number} */
export function canonical(c) {
  return c >>> 24 === 0 ? 0 : c >>> 0;
}

/** @param {number} v */
export function clamp8(v) {
  v = Math.round(v);
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/** @param {number} c @returns {[number, number, number, number]} */
export function unpack(c) {
  return [c & 255, (c >>> 8) & 255, (c >>> 16) & 255, c >>> 24];
}

/**
 * Accepts #rgb, #rgba, #rrggbb and #rrggbbaa (case-insensitive).
 * @param {string} hex @returns {number}
 */
export function fromHex(hex) {
  let h = String(hex).trim().replace(/^#/, '');
  if (h.length === 3 || h.length === 4) h = h.split('').map((ch) => ch + ch).join('');
  if (h.length === 6) h += 'ff';
  if (h.length !== 8 || /[^0-9a-f]/i.test(h)) throw new Error(`Invalid colour: ${hex}`);
  const n = parseInt(h, 16);
  return pack((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
}

/** @param {number} c @returns {string} '#rrggbbaa' */
export function toHex(c) {
  const [r, g, b, a] = unpack(c);
  return '#' + [r, g, b, a].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** CSS rgba() string, for canvases and DOM swatches. @param {number} c */
export function toCss(c) {
  const [r, g, b, a] = unpack(c);
  return `rgba(${r},${g},${b},${+(a / 255).toFixed(4)})`;
}

/**
 * Straight-alpha source-over: `src` painted over `dst`, with `src` alpha
 * further scaled by `opacity` (0..255). Exact to rounding.
 * @param {number} dst @param {number} src @param {number} [opacity]
 * @returns {number}
 */
export function over(dst, src, opacity = 255) {
  const sa = ((src >>> 24) * opacity) / 65025; // 0..1
  if (sa <= 0) return dst >>> 0;
  const da = (dst >>> 24) / 255;
  if (sa >= 1 || da <= 0) {
    return pack(src & 255, (src >>> 8) & 255, (src >>> 16) & 255, sa * 255);
  }
  const k = da * (1 - sa);
  const oa = sa + k;
  return pack(
    ((src & 255) * sa + (dst & 255) * k) / oa,
    (((src >>> 8) & 255) * sa + ((dst >>> 8) & 255) * k) / oa,
    (((src >>> 16) & 255) * sa + ((dst >>> 16) & 255) * k) / oa,
    oa * 255,
  );
}

/**
 * Removes `amount` (0..255) of alpha, as an eraser at partial opacity does.
 * @param {number} dst @param {number} amount
 */
export function erase(dst, amount = 255) {
  const a = dst >>> 24;
  const na = Math.round(a * (1 - amount / 255));
  return na <= 0 ? 0 : ((dst & 0xffffff) | (na << 24)) >>> 0;
}

/**
 * Linear mix of two colours, channel by channel, alpha included.
 * @param {number} a @param {number} b @param {number} t 0..1
 */
export function mix(a, b, t) {
  if (t <= 0) return canonical(a);
  if (t >= 1) return canonical(b);
  const u = 1 - t;
  return pack(
    (a & 255) * u + (b & 255) * t,
    ((a >>> 8) & 255) * u + ((b >>> 8) & 255) * t,
    ((a >>> 16) & 255) * u + ((b >>> 16) & 255) * t,
    (a >>> 24) * u + (b >>> 24) * t,
  );
}

/** Replaces alpha. @param {number} c @param {number} a 0..255 */
export function withAlpha(c, a) {
  return pack(c & 255, (c >>> 8) & 255, (c >>> 16) & 255, a);
}

/** Gamma-encoded luma (Rec. 709 weights), 0..255. @param {number} c */
export function luma(c) {
  return 0.2126 * (c & 255) + 0.7152 * ((c >>> 8) & 255) + 0.0722 * ((c >>> 16) & 255);
}

// ---------------------------------------------------------------- HSL

/**
 * @param {number} c
 * @returns {[number, number, number, number]} h 0..360, s 0..100, l 0..100, a 0..255
 */
export function toHsl(c) {
  const r = (c & 255) / 255, g = ((c >>> 8) & 255) / 255, b = ((c >>> 16) & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  const d = max - min;
  if (d > 1e-9) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s * 100, l * 100, c >>> 24];
}

/** @param {number} h @param {number} s @param {number} l @param {number} [a] */
export function fromHsl(h, s, l, a = 255) {
  h = ((h % 360) + 360) % 360;
  s = Math.min(100, Math.max(0, s)) / 100;
  l = Math.min(100, Math.max(0, l)) / 100;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = h / 360;
  const ch = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  if (s === 0) return pack(l * 255, l * 255, l * 255, a);
  return pack(ch(hk + 1 / 3) * 255, ch(hk) * 255, ch(hk - 1 / 3) * 255, a);
}

// ---------------------------------------------------------------- Oklab

const LIN = new Float64Array(256);
for (let i = 0; i < 256; i++) {
  const v = i / 255;
  LIN[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
/** @param {number} v linear 0..1 */
function toGamma8(v) {
  v = v <= 0 ? 0 : v >= 1 ? 1 : v;
  return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
}

/** @param {number} c @returns {[number, number, number]} L 0..1, a, b */
export function toOklab(c) {
  const r = LIN[c & 255], g = LIN[(c >>> 8) & 255], b = LIN[(c >>> 16) & 255];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/**
 * Oklab to linear sRGB, unclamped (components outside 0..1 are out of gamut).
 * @param {number} L @param {number} A @param {number} B @returns {[number, number, number]}
 */
export function oklabToLinear(L, A, B) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** @param {number} L @param {number} A @param {number} B @param {number} [a] */
export function fromOklab(L, A, B, a = 255) {
  const [r, g, b] = oklabToLinear(L, A, B);
  return pack(toGamma8(r), toGamma8(g), toGamma8(b), a);
}

/**
 * Largest Oklch chroma that stays inside sRGB at this lightness and hue.
 * @param {number} L 0..1 @param {number} h hue in radians
 */
export function maxChroma(L, h) {
  if (L <= 0 || L >= 1) return 0;
  const ca = Math.cos(h), sa = Math.sin(h), eps = 1e-6;
  let lo = 0, hi = 0.5;
  for (let k = 0; k < 24; k++) {
    const c = (lo + hi) / 2, [r, g, b] = oklabToLinear(L, c * ca, c * sa);
    if (r < -eps || g < -eps || b < -eps || r > 1 + eps || g > 1 + eps || b > 1 + eps) hi = c;
    else lo = c;
  }
  return lo;
}

// ---------------------------------------------------------------- matching

/** Largest per-channel difference, alpha included, 0..255. @param {number} a @param {number} b */
export function channelDistance(a, b) {
  if ((a >>> 24) === 0 && (b >>> 24) === 0) return 0;
  return Math.max(
    Math.abs((a & 255) - (b & 255)),
    Math.abs(((a >>> 8) & 255) - ((b >>> 8) & 255)),
    Math.abs(((a >>> 16) & 255) - ((b >>> 16) & 255)),
    Math.abs((a >>> 24) - (b >>> 24)),
  );
}

/** Oklab Euclidean distance with alpha folded in, roughly 0..1. @param {number} a @param {number} b */
export function oklabDistance(a, b) {
  const aa = a >>> 24, ba = b >>> 24;
  if (aa === 0 && ba === 0) return 0;
  const [l1, a1, b1] = toOklab(a), [l2, a2, b2] = toOklab(b);
  const dA = (aa - ba) / 255;
  return Math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2 + dA * dA);
}

/**
 * Builds a predicate "colour matches the seed within threshold".
 * threshold 0 = exact; 1 = everything. metric 'channel' compares the largest
 * channel difference with threshold * 255 (pixa.pics semantics); 'oklab'
 * compares the perceptual distance with threshold.
 * @param {number} seed @param {number} threshold @param {'channel'|'oklab'} [metric]
 * @returns {(c: number) => boolean}
 */
export function matcher(seed, threshold, metric = 'channel') {
  seed = canonical(seed);
  if (threshold <= 0) return (c) => canonical(c) === seed;
  if (threshold >= 1) return () => true;
  if (metric === 'oklab') return (c) => oklabDistance(seed, c) <= threshold;
  const limit = threshold * 255;
  return (c) => channelDistance(seed, c) <= limit;
}
