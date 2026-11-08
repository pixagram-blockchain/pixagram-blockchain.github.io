// @ts-check
import { Mask } from '../model/Mask.js';

export const TILE = 32;
const TILE_AREA = TILE * TILE;

/**
 * Colours of one 32 x 32 tile of a layer. Patches store colours, not palette
 * indices, so palette compaction can run at any time without breaking undo.
 * @param {import('../model/Layer.js').Layer} layer @param {number} t tile index
 * @param {number} tilesX
 */
export function readTile(layer, t, tilesX) {
  const buf = new Uint32Array(TILE_AREA);
  const x0 = (t % tilesX) * TILE, y0 = Math.floor(t / tilesX) * TILE;
  const w = layer.width, h = layer.height;
  const pal = layer.palette.colors, idx = layer.indices;
  const x1 = Math.min(w, x0 + TILE), y1 = Math.min(h, y0 + TILE);
  for (let y = y0; y < y1; y++) {
    const row = y * w, brow = (y - y0) * TILE - x0;
    for (let x = x0; x < x1; x++) buf[brow + x] = pal[idx[row + x]];
  }
  return buf;
}

/** @param {import('../model/Layer.js').Layer} layer @param {number} t @param {number} tilesX @param {Uint32Array} buf */
export function writeTile(layer, t, tilesX, buf) {
  const x0 = (t % tilesX) * TILE, y0 = Math.floor(t / tilesX) * TILE;
  const w = layer.width, h = layer.height;
  const x1 = Math.min(w, x0 + TILE), y1 = Math.min(h, y0 + TILE);
  const pal = layer.palette, idx = layer.indices;
  let lastC = -1, lastI = 0;
  for (let y = y0; y < y1; y++) {
    const row = y * w, brow = (y - y0) * TILE - x0;
    for (let x = x0; x < x1; x++) {
      const c = buf[brow + x];
      if (c !== lastC) { lastC = c; lastI = pal.add(c); }
      idx[row + x] = lastI;
    }
  }
  layer.markTile(t);
  layer.revision++;
}

/**
 * Writes only the listed pixels of a tile.
 * @param {import('../model/Layer.js').Layer} layer @param {number} t @param {number} tilesX
 * @param {Uint16Array} pos offsets inside the tile (y * 32 + x) @param {Uint32Array} colors
 */
export function writeTilePixels(layer, t, tilesX, pos, colors) {
  const x0 = (t % tilesX) * TILE, y0 = Math.floor(t / tilesX) * TILE, w = layer.width;
  const pal = layer.palette, idx = layer.indices;
  let lastC = -1, lastI = 0;
  for (let k = 0; k < pos.length; k++) {
    const c = colors[k], p = pos[k];
    if (c !== lastC) { lastC = c; lastI = pal.add(c); }
    idx[(y0 + (p >> 5)) * w + x0 + (p & 31)] = lastI;
  }
  layer.markTile(t);
  layer.revision++;
}

/** Below this many changed pixels a tile patch keeps only those pixels (10 bytes each, against 8 KB). */
const SPARSE_LIMIT = 800;

/** @param {Uint32Array} a @param {Uint32Array} b */
function same(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export class TilePatch {
  /**
   * Colours of one tile before and after. Few changes are stored sparsely
   * (positions plus colours), many as the two whole tiles.
   * @param {import('../model/Layer.js').Layer} layer @param {number} tile @param {number} tilesX
   * @param {Uint32Array} before @param {Uint32Array} after whole tiles, 1024 colours each
   */
  constructor(layer, tile, tilesX, before, after) {
    this.kind = 'tile';
    this.layer = layer;
    this.tile = tile;
    this.tilesX = tilesX;
    let n = 0;
    for (let i = 0; i < TILE_AREA; i++) if (before[i] !== after[i]) n++;
    this.changed = n;
    if (n < SPARSE_LIMIT) {
      const pos = new Uint16Array(n), b = new Uint32Array(n), a = new Uint32Array(n);
      for (let i = 0, k = 0; i < TILE_AREA; i++) {
        if (before[i] !== after[i]) { pos[k] = i; b[k] = before[i]; a[k] = after[i]; k++; }
      }
      /** @type {Uint16Array | null} */ this.pos = pos;
      this.before = b;
      this.after = a;
    } else {
      this.pos = null;
      this.before = before;
      this.after = after;
    }
    this.bytes = (this.pos ? this.pos.byteLength : 0) + this.before.byteLength + this.after.byteLength + 56;
  }

  /** @param {import('../core/Editor.js').Editor} editor @param {'before'|'after'} which */
  apply(editor, which) {
    const colors = which === 'before' ? this.before : this.after;
    if (this.pos) writeTilePixels(this.layer, this.tile, this.tilesX, this.pos, colors);
    else writeTile(this.layer, this.tile, this.tilesX, colors);
    const x0 = (this.tile % this.tilesX) * TILE, y0 = Math.floor(this.tile / this.tilesX) * TILE;
    editor.markDirtyRect(x0, y0, x0 + TILE - 1, y0 + TILE - 1);
  }
}

export class MaskPatch {
  /** @param {number} width @param {number} height @param {Uint32Array} before @param {Uint32Array} after runs */
  constructor(width, height, before, after) {
    this.kind = 'mask';
    this.width = width;
    this.height = height;
    this.before = before;
    this.after = after;
    this.bytes = before.byteLength + after.byteLength + 32;
  }

  /** @param {import('../core/Editor.js').Editor} editor @param {'before'|'after'} which */
  apply(editor, which) {
    const runs = which === 'before' ? this.before : this.after;
    const doc = editor.doc;
    if (doc.selection.width !== this.width || doc.selection.height !== this.height) {
      doc.selection = new Mask(this.width, this.height);
    }
    doc.selection.setRuns(runs);
  }
}

/** @param {any} doc */
export function snapshotStructure(doc) {
  return {
    layers: doc.layers.slice(),
    activeLayerId: doc.activeLayerId,
    props: new Map(doc.layers.map((l) => [l, l.props()])),
    reference: doc.reference,
  };
}

/** @param {ReturnType<typeof snapshotStructure>} a @param {ReturnType<typeof snapshotStructure>} b */
export function sameStructure(a, b) {
  if (a.activeLayerId !== b.activeLayerId || a.layers.length !== b.layers.length || a.reference !== b.reference) return false;
  for (let i = 0; i < a.layers.length; i++) {
    if (a.layers[i] !== b.layers[i]) return false;
    const pa = a.props.get(a.layers[i]), pb = b.props.get(b.layers[i]);
    if (JSON.stringify(pa) !== JSON.stringify(pb)) return false;
  }
  return true;
}

export class StructurePatch {
  /** @param {ReturnType<typeof snapshotStructure>} before @param {ReturnType<typeof snapshotStructure>} after */
  constructor(before, after) {
    this.kind = 'structure';
    this.before = before;
    this.after = after;
    this.bytes = 64 * (before.layers.length + after.layers.length) + 64;
  }

  /** @param {import('../core/Editor.js').Editor} editor @param {'before'|'after'} which */
  apply(editor, which) {
    const s = which === 'before' ? this.before : this.after;
    const doc = editor.doc;
    doc.layers = s.layers.slice();
    doc.activeLayerId = s.activeLayerId;
    for (const [layer, p] of s.props) layer.setProps(p);
    doc.reference = s.reference;
    editor.markAllDirty();
  }
}

/** Full copy of size, layers, selection and floating: crop, rotate, resize. @param {any} doc */
export function snapshotDocument(doc) {
  return {
    width: doc.width,
    height: doc.height,
    layers: doc.layers.slice(),
    activeLayerId: doc.activeLayerId,
    data: doc.layers.map((l) => ({ layer: l, width: l.width, height: l.height, palette: l.palette.clone(), indices: l.indices.slice() })),
    selection: doc.selection.toRuns(),
    floating: doc.floating,
    reference: doc.reference,
  };
}

export class DocumentPatch {
  /** @param {ReturnType<typeof snapshotDocument>} before @param {ReturnType<typeof snapshotDocument>} after */
  constructor(before, after) {
    this.kind = 'document';
    this.before = before;
    this.after = after;
    const size = (s) => s.data.reduce((n, d) => n + d.indices.byteLength + d.palette.length * 4, 0) + s.selection.byteLength;
    this.bytes = size(before) + size(after) + 128;
  }

  /** @param {import('../core/Editor.js').Editor} editor @param {'before'|'after'} which */
  apply(editor, which) {
    const s = which === 'before' ? this.before : this.after;
    const doc = editor.doc;
    doc.width = s.width;
    doc.height = s.height;
    doc.layers = s.layers.slice();
    doc.activeLayerId = s.activeLayerId;
    for (const d of s.data) d.layer.replaceData(d.width, d.height, d.palette.clone(), d.indices.slice());
    doc.selection = Mask.fromRuns(s.width, s.height, s.selection);
    doc.floating = s.floating;
    doc.reference = s.reference;
    editor.resizeDirty();
    editor.markAllDirty();
  }
}

export class FloatingPatch {
  /** @param {any} before @param {any} after Floating or null */
  constructor(before, after) {
    this.kind = 'floating';
    this.before = before;
    this.after = after;
    this.bytes = 96;
  }

  /** @param {import('../core/Editor.js').Editor} editor @param {'before'|'after'} which */
  apply(editor, which) {
    editor.markFloatingDirty(editor.doc.floating);
    editor.doc.floating = which === 'before' ? this.before : this.after;
    editor.markFloatingDirty(editor.doc.floating);
  }
}

let entryCounter = 0;
export class HistoryEntry {
  /** @param {string} label @param {Array<{kind: string, bytes: number, apply: Function}>} patches @param {object} [meta] */
  constructor(label, patches, meta = {}) {
    this.id = ++entryCounter;
    this.label = label;
    this.patches = patches;
    this.meta = meta;
    this.time = Date.now();
    this.bytes = patches.reduce((n, p) => n + p.bytes, 0);
    this.kinds = new Set(patches.map((p) => p.kind));
  }
}

export { same as sameBuffer };
