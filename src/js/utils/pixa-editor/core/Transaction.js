// @ts-check
import {
  TILE, readTile, writeTile, sameBuffer, TilePatch, MaskPatch, StructurePatch, DocumentPatch,
  FloatingPatch, HistoryEntry, snapshotStructure, sameStructure, snapshotDocument,
} from '../history/patches.js';
import { Mask } from '../model/Mask.js';

/**
 * The only write path. A transaction copies each touched tile once before
 * the first write, remembers selection / structure / floating / document
 * state on first change, and turns the differences into one history entry
 * on commit. Rollback restores everything it touched.
 */
export class Transaction {
  /** @param {import('./Editor.js').Editor} editor @param {string} label @param {{ gesture?: boolean } & Record<string, any>} [meta] */
  constructor(editor, label, meta = {}) {
    this.editor = editor;
    this.doc = editor.doc;
    this.label = label;
    this.meta = meta;
    this.tilesX = Math.ceil(this.doc.width / TILE);
    this.tilesY = Math.ceil(this.doc.height / TILE);
    /** @type {Map<any, {flags: Uint8Array, tiles: Map<number, Uint32Array>}>} */
    this.layers = new Map();
    /** @type {Uint32Array | null} */
    this.maskBefore = null;
    /** @type {any} */
    this.structBefore = null;
    /** @type {any} */
    this.docBefore = null;
    /** @type {any} */
    this.floatingBefore = undefined;
    this.state = 'open';
  }

  // ------------------------------------------------------------------ pixels

  /** @param {any} layer */
  record(layer) {
    let r = this.layers.get(layer);
    if (!r) {
      r = { flags: new Uint8Array(this.tilesX * this.tilesY), tiles: new Map() };
      this.layers.set(layer, r);
    }
    return r;
  }

  /** @param {any} layer @param {number} t */
  touchTile(layer, t) {
    const r = this.record(layer);
    if (r.flags[t]) return;
    r.flags[t] = 1;
    r.tiles.set(t, readTile(layer, t, this.tilesX));
  }

  /** @param {any} layer @param {number} x @param {number} y */
  touch(layer, x, y) {
    this.touchTile(layer, (y >> 5) * this.tilesX + (x >> 5));
  }

  /** Colour of pixel i before this transaction began. @param {any} layer @param {number} i */
  baseColor(layer, i) {
    const w = this.doc.width, x = i % w, y = (i - x) / w;
    const r = this.layers.get(layer);
    const t = (y >> 5) * this.tilesX + (x >> 5);
    if (r && r.flags[t]) return /** @type {Uint32Array} */ (r.tiles.get(t))[((y & 31) << 5) + (x & 31)];
    return layer.getColor(i);
  }

  /** @param {any} layer @param {number} i @param {number} color */
  setColor(layer, i, color) {
    const w = this.doc.width, x = i % w, y = (i - x) / w, t = (y >> 5) * this.tilesX + (x >> 5);
    this.touchTile(layer, t);
    const k = (layer.indices[i] = layer.palette.add(color));
    if (k) layer.markTile(t);
    this.editor.markDirty(x, y);
  }

  /** @param {any} layer @param {number} i @param {number} index palette index */
  setIndex(layer, i, index) {
    const w = this.doc.width, x = i % w, y = (i - x) / w, t = (y >> 5) * this.tilesX + (x >> 5);
    this.touchTile(layer, t);
    layer.indices[i] = index;
    if (index) layer.markTile(t);
    this.editor.markDirty(x, y);
  }

  /**
   * Writes a full RGBA image into a layer, only where it differs (and where
   * `mask` is set, when given).
   * @param {any} layer @param {Uint32Array} rgba @param {Mask | null} [mask]
   */
  writeRGBA(layer, rgba, mask = null) {
    const pal = layer.palette.colors, idx = layer.indices;
    for (let i = 0; i < rgba.length; i++) {
      if (mask && !mask.get(i)) continue;
      if (pal[idx[i]] !== rgba[i]) this.setColor(layer, i, rgba[i]);
    }
  }

  /**
   * Palette op: replaces colours entry by entry. Tiles holding a changed
   * entry are backed up first, so undo works on colours.
   * @param {any} layer @param {Uint32Array} colors same length as the palette
   */
  replacePalette(layer, colors) {
    const pal = layer.palette, n = pal.length;
    const changed = new Uint8Array(n);
    let any = false;
    for (let i = 1; i < n; i++) if (pal.colors[i] !== colors[i]) { changed[i] = 1; any = true; }
    if (!any) return;
    const w = this.doc.width, idx = layer.indices;
    const r = this.record(layer);
    for (let i = 0; i < idx.length; i++) {
      if (!changed[idx[i]]) continue;
      const x = i % w, y = (i - x) / w, t = (y >> 5) * this.tilesX + (x >> 5);
      if (!r.flags[t]) this.touchTile(layer, t);
      this.editor.markDirty(x, y);
    }
    pal.replaceAll(colors);
  }

  // ------------------------------------------------------------------ selection

  selectionWillChange() {
    if (!this.maskBefore) this.maskBefore = this.doc.selection.toRuns();
    return this.doc.selection;
  }

  /** @param {Mask} mask */
  setSelection(mask) {
    this.selectionWillChange();
    if (mask.sameShape(this.doc.selection)) this.doc.selection.copyFrom(mask);
    else this.doc.selection = mask.clone();
  }

  // ------------------------------------------------------------------ structure

  structureWillChange() {
    if (!this.structBefore) this.structBefore = snapshotStructure(this.doc);
    return this.doc;
  }

  documentWillChange() {
    if (!this.docBefore) this.docBefore = snapshotDocument(this.doc);
    return this.doc;
  }

  /** @param {any} floating Floating or null */
  setFloating(floating) {
    if (this.floatingBefore === undefined) this.floatingBefore = this.doc.floating;
    this.editor.markFloatingDirty(this.doc.floating);
    this.doc.floating = floating;
    this.editor.markFloatingDirty(floating);
  }

  // ------------------------------------------------------------------ end

  commit() {
    if (this.state !== 'open') return null;
    // Last chance to adjust pixels inside this transaction (strict colour cap).
    this.editor._beforeCommit?.(this);
    this.state = 'committed';
    const doc = this.doc, patches = [];
    if (this.docBefore) {
      patches.push(new DocumentPatch(this.docBefore, snapshotDocument(doc)));
    } else {
      for (const [layer, r] of this.layers) {
        for (const [t, before] of r.tiles) {
          const after = readTile(layer, t, this.tilesX);
          if (!sameBuffer(before, after)) patches.push(new TilePatch(layer, t, this.tilesX, before, after));
        }
      }
      if (this.structBefore) {
        const after = snapshotStructure(doc);
        if (!sameStructure(this.structBefore, after)) {
          patches.push(new StructurePatch(this.structBefore, after));
          this.editor.markAllDirty();
        }
      }
    }
    if (this.maskBefore && !this.docBefore) {
      const after = doc.selection.toRuns();
      if (!sameBuffer(this.maskBefore, after)) patches.push(new MaskPatch(doc.width, doc.height, this.maskBefore, after));
    }
    if (this.floatingBefore !== undefined && this.floatingBefore !== doc.floating && !this.docBefore) {
      patches.push(new FloatingPatch(this.floatingBefore, doc.floating));
    }
    for (const layer of this.layers.keys()) { layer.revision++; layer.compact(); }
    const entry = patches.length ? new HistoryEntry(this.label, patches, this.meta) : null;
    if (entry) this.editor.history.push(entry);
    this.editor._endTransaction(this, entry);
    return entry;
  }

  rollback() {
    if (this.state !== 'open') return;
    this.state = 'rolledback';
    const doc = this.doc;
    if (this.docBefore) {
      new DocumentPatch(this.docBefore, this.docBefore).apply(this.editor, 'before');
    } else {
      for (const [layer, r] of this.layers) {
        for (const [t, before] of r.tiles) {
          writeTile(layer, t, this.tilesX, before);
          const x0 = (t % this.tilesX) * TILE, y0 = Math.floor(t / this.tilesX) * TILE;
          this.editor.markDirtyRect(x0, y0, x0 + TILE - 1, y0 + TILE - 1);
        }
      }
      if (this.structBefore) new StructurePatch(this.structBefore, this.structBefore).apply(this.editor, 'before');
    }
    for (const layer of this.layers.keys()) layer.revision++;
    if (this.maskBefore) {
      if (doc.selection.width !== doc.width || doc.selection.height !== doc.height) doc.selection = new Mask(doc.width, doc.height);
      doc.selection.setRuns(this.maskBefore);
    }
    if (this.floatingBefore !== undefined) doc.floating = this.floatingBefore;
    this.editor.markAllDirty();
    this.editor._endTransaction(this, null, true);
  }
}
