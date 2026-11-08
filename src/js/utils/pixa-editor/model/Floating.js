// @ts-check
/**
 * Pixels that float above the active layer until committed: a lifted
 * selection, a paste or an import. Immutable: every change returns a new
 * object, so history can keep references instead of copies.
 */
export class Floating {
  /**
   * @param {{ rgba: Uint32Array, width: number, height: number, x: number, y: number,
   *   dw?: number, dh?: number, mode: 'lift'|'copy'|'paste'|'import',
   *   sourceLayerId?: string|null, origin?: {x: number, y: number} | null,
   *   source?: {rgba: Uint32Array, width: number, height: number} | null }} o
   */
  constructor(o) {
    this.rgba = o.rgba;
    this.width = o.width | 0;
    this.height = o.height | 0;
    this.x = Math.round(o.x);
    this.y = Math.round(o.y);
    this.dw = Math.max(1, Math.round(o.dw ?? o.width));
    this.dh = Math.max(1, Math.round(o.dh ?? o.height));
    this.mode = o.mode;
    this.sourceLayerId = o.sourceLayerId ?? null;
    this.origin = o.origin ?? null;
    /** Untransformed pixels of a lift, so Cancel can put them back exactly. */
    this.source = o.source ?? null;
  }

  /**
   * A copy that has not been moved, scaled or transformed yet sits exactly on
   * the pixels it came from: committing it changes nothing, and drawing it
   * would double semi-transparent pixels.
   */
  get pristine() {
    const s = this.source, o = this.origin;
    return this.mode === 'copy' && !!s && !!o && this.rgba === s.rgba && this.x === o.x && this.y === o.y
      && this.dw === this.width && this.dh === this.height;
  }

  /** Colour at destination offset (dx, dy) inside dw x dh, nearest neighbour. @param {number} dx @param {number} dy */
  sample(dx, dy) {
    const sx = Math.min(this.width - 1, Math.floor((dx * this.width) / this.dw));
    const sy = Math.min(this.height - 1, Math.floor((dy * this.height) / this.dh));
    return this.rgba[sy * this.width + sx];
  }

  /** Colour landing on document pixel (x, y), or 0. @param {number} x @param {number} y */
  colorAt(x, y) {
    const dx = x - this.x, dy = y - this.y;
    if (dx < 0 || dy < 0 || dx >= this.dw || dy >= this.dh) return 0;
    return this.sample(dx, dy);
  }

  /** @param {Partial<Floating>} patch */
  with(patch) {
    return new Floating({ ...this, ...patch });
  }

  /** @param {'x'|'y'} axis */
  flipped(axis) {
    const { width: w, height: h, rgba } = this;
    const out = new Uint32Array(rgba.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const sx = axis === 'x' ? w - 1 - x : x, sy = axis === 'y' ? h - 1 - y : y;
        out[y * w + x] = rgba[sy * w + sx];
      }
    }
    return this.with({ rgba: out });
  }

  /** Quarter turn about its centre. @param {1|-1} dir 1 = clockwise */
  rotated(dir) {
    const { width: w, height: h, rgba } = this;
    const out = new Uint32Array(rgba.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = dir === 1 ? h - 1 - y : y, ny = dir === 1 ? x : w - 1 - x;
        out[ny * h + nx] = rgba[y * w + x];
      }
    }
    const cx = this.x + this.dw / 2, cy = this.y + this.dh / 2;
    return new Floating({
      ...this, rgba: out, width: h, height: w, dw: this.dh, dh: this.dw,
      x: Math.round(cx - this.dh / 2), y: Math.round(cy - this.dw / 2),
    });
  }
}
