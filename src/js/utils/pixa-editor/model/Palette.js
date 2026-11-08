// @ts-check
import { canonical } from '../color/rgba.js';

export const MAX_COLORS = 65535;

/**
 * An append-friendly colour table. Index 0 is always fully transparent, so a
 * fresh index buffer (all zeros) is an empty layer and erasing means writing 0.
 * Several indices may briefly hold the same colour (after a palette op);
 * `indexOf` returns the first, and `Layer#compact()` merges them.
 */
export class Palette {
  /** @param {ArrayLike<number>} [colors] */
  constructor(colors) {
    /** @type {Uint32Array} */
    this.colors = new Uint32Array(64);
    this.length = 0;
    /** @type {Map<number, number>} */
    this.map = new Map();
    this.add(0);
    if (colors) for (let i = 0; i < colors.length; i++) this.add(colors[i]);
  }

  /** @param {number} i */
  get(i) {
    return this.colors[i];
  }

  /** @param {number} c @returns {number} index or -1 */
  indexOf(c) {
    const i = this.map.get(canonical(c));
    return i === undefined ? -1 : i;
  }

  /** Returns the index of `c`, appending it when new. @param {number} c */
  add(c) {
    c = canonical(c);
    const known = this.map.get(c);
    if (known !== undefined) return known;
    if (this.length >= MAX_COLORS) throw new RangeError(`Palette is full (${MAX_COLORS} colours)`);
    if (this.length === this.colors.length) {
      const grown = new Uint32Array(Math.min(MAX_COLORS, this.colors.length * 2));
      grown.set(this.colors);
      this.colors = grown;
    }
    const i = this.length++;
    this.colors[i] = c;
    this.map.set(c, i);
    return i;
  }

  /**
   * Replaces the colour stored at index i (palette ops). Index 0 stays transparent.
   * @param {number} i @param {number} c
   */
  set(i, c) {
    if (i === 0) return;
    c = canonical(c);
    const old = this.colors[i];
    if (old === c) return;
    this.colors[i] = c;
    if (this.map.get(old) === i) {
      this.map.delete(old);
      for (let j = 0; j < this.length; j++) {
        if (this.colors[j] === old) { this.map.set(old, j); break; }
      }
    }
    const current = this.map.get(c);
    if (current === undefined || current > i) this.map.set(c, i);
  }

  /** Replaces every colour at once (same length). @param {ArrayLike<number>} colors */
  replaceAll(colors) {
    if (colors.length !== this.length) throw new Error('replaceAll needs the same palette length');
    this.map.clear();
    for (let i = 0; i < this.length; i++) {
      const c = i === 0 ? 0 : canonical(colors[i]);
      this.colors[i] = c;
      if (!this.map.has(c)) this.map.set(c, i);
    }
  }

  /** Live view of the used part. */
  view() {
    return this.colors.subarray(0, this.length);
  }

  clone() {
    const p = new Palette();
    p.colors = this.colors.slice();
    p.length = this.length;
    p.map = new Map(this.map);
    return p;
  }

  /** @param {ArrayLike<number>} colors index 0 must be transparent */
  static fromArray(colors) {
    const p = new Palette();
    p.colors = new Uint32Array(Math.max(64, colors.length));
    p.length = 0;
    p.map.clear();
    for (let i = 0; i < colors.length; i++) {
      const c = i === 0 ? 0 : canonical(colors[i]);
      p.colors[p.length++] = c;
      if (!p.map.has(c)) p.map.set(c, i);
    }
    return p;
  }
}
