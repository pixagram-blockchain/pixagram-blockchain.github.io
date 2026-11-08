// @ts-check
import { Palette } from './Palette.js';
import { canonical } from '../color/rgba.js';

let counter = 0;
/** @param {string} prefix */
export function newId(prefix) {
  counter = (counter + 1) % 1e9;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

/**
 * An indexed layer: a palette plus one 16-bit index per pixel. Colour work
 * (filters, contrast, recolour) touches the palette; pixel work touches indices.
 */
export class Layer {
  /**
   * @param {{ width: number, height: number, name?: string, id?: string,
   *   palette?: Palette, indices?: Uint16Array, visible?: boolean,
   *   opacity?: number, locked?: boolean }} o
   */
  constructor(o) {
    this.id = o.id || newId('layer');
    this.name = o.name || 'Layer';
    this.width = o.width | 0;
    this.height = o.height | 0;
    this.palette = o.palette || new Palette();
    this.indices = o.indices || new Uint16Array(this.width * this.height);
    if (this.indices.length !== this.width * this.height) throw new Error('Layer indices have the wrong length');
    this.visible = o.visible !== false;
    this.opacity = o.opacity === undefined ? 1 : Math.min(1, Math.max(0, o.opacity));
    this.locked = !!o.locked;
    /** Bumped whenever pixels or colours change: a cheap key for caches and thumbnails. */
    this.revision = 0;
    /** Palette length after the last compaction, so compact() can skip cheaply. */
    this.compactedLength = this.palette.length;
    /**
     * Per 32 x 32 tile: 1 when the tile may hold a non-transparent index. Kept
     * conservative by every write (see markTile) and rebuilt exactly when the
     * revision moves, so the compositor can skip empty tiles of sparse layers.
     * @type {Uint8Array | null}
     */
    this.occupancy = null;
    this.occupancyRevision = -1;
  }

  /** Tiles across. */
  get tilesX() {
    return Math.ceil(this.width / 32);
  }

  /** Records a write of a non-transparent index in tile t. @param {number} t */
  markTile(t) {
    if (this.occupancy) this.occupancy[t] = 1;
  }

  /** Up-to-date occupancy per tile (rebuilt when the revision moved). */
  occupiedTiles() {
    if (this.occupancy && this.occupancyRevision === this.revision) return this.occupancy;
    const tx = this.tilesX, ty = Math.ceil(this.height / 32), occ = new Uint8Array(tx * ty), idx = this.indices, w = this.width;
    for (let y = 0; y < this.height; y++) {
      const row = y * w, trow = (y >> 5) * tx;
      for (let x = 0; x < w; x++) if (idx[row + x] !== 0) { occ[trow + (x >> 5)] = 1; x |= 31; }
    }
    this.occupancy = occ;
    this.occupancyRevision = this.revision;
    return occ;
  }

  /** @param {number} width @param {number} height @param {string} [name] */
  static blank(width, height, name) {
    return new Layer({ width, height, name });
  }

  /**
   * @param {Uint32Array} rgba packed colours, row-major
   * @param {number} width @param {number} height @param {string} [name]
   */
  static fromRGBA(rgba, width, height, name) {
    const layer = new Layer({ width, height, name });
    const pal = layer.palette, idx = layer.indices;
    let last = -1, lastIdx = 0;
    for (let i = 0; i < rgba.length; i++) {
      const c = rgba[i];
      if (c !== last) { last = c; lastIdx = pal.add(c); }
      idx[i] = lastIdx;
    }
    return layer;
  }

  /** @param {number} i */
  getColor(i) {
    return this.palette.colors[this.indices[i]];
  }

  /** Raw write, no history: use a Transaction for user edits. @param {number} i @param {number} c */
  setColor(i, c) {
    const k = (this.indices[i] = this.palette.add(c));
    if (k && this.occupancy) { const x = i % this.width; this.occupancy[(((i - x) / this.width) >> 5) * this.tilesX + (x >> 5)] = 1; }
    this.revision++;
  }

  /** @param {Uint32Array} [out] */
  toRGBA(out) {
    const n = this.indices.length;
    out = out || new Uint32Array(n);
    const pal = this.palette.colors, idx = this.indices;
    for (let i = 0; i < n; i++) out[i] = pal[idx[i]];
    return out;
  }

  /** Pixel count per palette index. */
  usage() {
    const counts = new Uint32Array(this.palette.length);
    const idx = this.indices;
    for (let i = 0; i < idx.length; i++) counts[idx[i]]++;
    return counts;
  }

  /** Distinct visible colours actually used. */
  colorCount() {
    const u = this.usage(), seen = new Set();
    for (let i = 1; i < u.length; i++) if (u[i]) seen.add(this.palette.colors[i]);
    return seen.size;
  }

  /**
   * Drops unused entries and merges duplicates. Representation only: no
   * visible change, so it never needs a history entry.
   * @param {boolean} [force] compact even when little would be gained
   */
  compact(force = false) {
    const dup = this.palette.map.size < this.palette.length;
    // Cheap exit: no duplicates and fewer than 64 entries added since the last compaction.
    if (!force && !dup && this.palette.length - this.compactedLength < 64) return false;
    const u = this.usage();
    let unused = 0;
    for (let i = 1; i < u.length; i++) if (!u[i]) unused++;
    if (!force && !dup && unused < 64 && unused * 4 < this.palette.length) { this.compactedLength = this.palette.length; return false; }
    const fresh = new Palette();
    const remap = new Uint16Array(this.palette.length);
    for (let i = 1; i < u.length; i++) {
      if (u[i]) remap[i] = fresh.add(this.palette.colors[i]);
    }
    const idx = this.indices;
    for (let i = 0; i < idx.length; i++) idx[i] = remap[idx[i]];
    this.palette = fresh;
    this.compactedLength = fresh.length;
    return true;
  }

  props() {
    return { name: this.name, visible: this.visible, opacity: this.opacity, locked: this.locked };
  }

  /** @param {Partial<{name: string, visible: boolean, opacity: number, locked: boolean}>} p */
  setProps(p) {
    if (p.name !== undefined) this.name = String(p.name);
    if (p.visible !== undefined) this.visible = !!p.visible;
    if (p.opacity !== undefined) this.opacity = Math.min(1, Math.max(0, +p.opacity));
    if (p.locked !== undefined) this.locked = !!p.locked;
  }

  /** @param {{ keepId?: boolean, name?: string }} [o] */
  clone(o = {}) {
    return new Layer({
      id: o.keepId ? this.id : undefined,
      name: o.name || this.name,
      width: this.width,
      height: this.height,
      palette: this.palette.clone(),
      indices: this.indices.slice(),
      visible: this.visible,
      opacity: this.opacity,
      locked: this.locked,
    });
  }

  /**
   * Replaces size and pixels at once (crop, rotate, resize).
   * @param {number} width @param {number} height @param {Palette} palette @param {Uint16Array} indices
   */
  replaceData(width, height, palette, indices) {
    this.width = width;
    this.height = height;
    this.palette = palette;
    this.indices = indices;
    this.compactedLength = palette.length;
    this.occupancy = null;
    this.revision++;
  }
}

/** @param {number} c */
export const isTransparent = (c) => canonical(c) === 0;
