// @ts-check
import { EventBus } from './EventBus.js';
import { Transaction } from './Transaction.js';
import { Commands } from './Commands.js';
import { ColorCensus, countLayer, countRGBA, capColors } from './colors.js';
import { History } from '../history/History.js';
import { TILE } from '../history/patches.js';
import { Document } from '../model/Document.js';
import { fromHex, toHex } from '../color/rgba.js';
import { createTools } from '../tools/index.js';
import { FloatingController } from '../tools/floating-controller.js';
import { registerEffects } from '../commands/effects.js';
import { registerSelectionCommands } from '../commands/selection.js';
import { registerLayerCommands } from '../commands/layers.js';
import { registerFloatingCommands } from '../commands/floating.js';
import { registerMiscCommands } from '../commands/misc.js';
import { registerAppCommands } from '../commands/app.js';
import { Layer } from '../model/Layer.js';
import { Floating } from '../model/Floating.js';
import { decodeImage, importPixelArt } from '../io/import.js';
import { exportPNG, readPNGChunks, PROJECT_CHUNK } from '../io/png.js';
import { serializeProject, parseProject, isProject } from '../io/project.js';
import { reduceColors } from '../ops/color-ops.js';
import { Autosave } from '../persist/autosave.js';
import { WorkerPool } from '../worker/pool.js';

const MB = 1024 * 1024;

/**
 * @typedef {Object} EditorOptions
 * @property {number} [width] @property {number} [height]
 * @property {Document} [document]
 * @property {{ budgetMB?: number, maxEntries?: number, linear?: boolean }} [history]
 *   Undo is linear: a new edit after undo drops the redo branch.
 * @property {boolean} [copyFloats] pixa.pics parity: Copy also lifts a floating duplicate (default true)
 * @property {number} [colorLimit] document palette size that triggers 'color-limit' (default 256, 0 = off)
 * @property {boolean} [strictColors] never let the document palette exceed colorLimit: new colours
 *   beyond it move to their nearest allowed colour, in previews and commits alike (default false)
 * @property {import('../persist/autosave.js').AutosaveOptions | false} [autosave] IndexedDB backup (off unless given)
 * @property {import('../worker/pool.js').WorkerOptions | false} [workers] heavy previews and imports off the main thread
 */

/**
 * @typedef {'square'|'circle'|'diamond'|'plus'|'hbar'|'vbar'|'custom'} TipShape
 * @typedef {{ tip: TipShape, size: number, pixelPerfect: boolean, opacity: number,
 *   blend: 'over'|'replace'|'erase', mirror: 'none'|'vertical'|'horizontal'|'both',
 *   mirrorAxis: { x2: number, y2: number } | null, customTip: Int16Array | null }} BrushSettings
 *   mirrorAxis is stored doubled, so axes can sit on half pixels (null = document centre).
 * @typedef {{ mode: 'replace'|'add'|'remove', threshold: number, connectivity: 4|8,
 *   metric: 'channel'|'oklab', sample: 'layer'|'composite' }} SelectionSettings
 *   threshold 0 = exact colour, 1 = everything.
 */

/** The tool map, plus `use()` and `active` for hosts. */
class ToolRegistry extends Map {
  /** @param {any} editor @param {Map<string, any>} tools */
  constructor(editor, tools) {
    super(tools);
    this.editor = editor;
  }
  /** @param {string} id @param {object} [settings] */
  use(id, settings) { this.editor.useTool(id, settings); }
  get active() { return this.editor.activeToolId; }
}

/**
 * Settings object whose properties read from `store` and write through
 * `apply`, so `editor.brush.size = 3` behaves like `editor.setBrush({ size: 3 })`.
 * @template {Record<string, any>} T
 * @param {T} store @param {(patch: Partial<T>) => void} apply
 * @returns {T}
 */
function settings(store, apply) {
  const view = {};
  for (const key of Object.keys(store)) {
    Object.defineProperty(view, key, {
      enumerable: true,
      get: () => store[key],
      set: (v) => apply(/** @type {any} */ ({ [key]: v })),
    });
  }
  return /** @type {T} */ (view);
}

/** @param {Blob | Uint8Array} b */
const asBytes = async (b) => (b instanceof Uint8Array ? b : new Uint8Array(await b.arrayBuffer()));
/** @param {Uint8Array} bytes @param {string} type @param {boolean} [blob] */
const asBlob = (bytes, type, blob = true) => (blob && typeof Blob !== 'undefined' ? new Blob([bytes], { type }) : bytes);

/**
 * The facade. Hosts talk to it through commands, previews and events; tools
 * and commands write through transactions.
 */
export class Editor {
  /** @param {EditorOptions} [opts] */
  constructor(opts = {}) {
    if (opts.history?.linear === false) throw new Error('Only linear undo is supported');
    this.options = {
      copyFloats: opts.copyFloats !== false,
      colorLimit: Math.max(0, opts.colorLimit ?? 256),
      strictColors: !!opts.strictColors,
      minWorkerPixels: (opts.workers ? opts.workers.minPixels : undefined) ?? 65536,
    };
    this.events = new EventBus();
    this.doc = opts.document || new Document({ width: opts.width ?? 64, height: opts.height ?? 64 });
    this.history = new History({ budgetBytes: (opts.history?.budgetMB ?? 64) * MB, maxEntries: opts.history?.maxEntries });
    this.commands = new Commands(this);
    this.census = new ColorCensus();
    /** Number of document colours when last checked, and whether that was over the limit. */
    this.colorState = { count: 0, over: false };
    /** History state of the last save or open (see markSaved). */
    this.savedState = 0;

    /**
     * Primary and secondary colours, packed; `colors.set({ primary: '#ff004dff' })` is setColors.
     * @type {{ primary: number, secondary: number, readonly set: (c: { primary?: number|string, secondary?: number|string }) => void }}
     */
    this.colors = /** @type {any} */ ({ primary: fromHex('#000000'), secondary: fromHex('#ffffff') });
    Object.defineProperty(this.colors, 'set', { value: (/** @type {any} */ c) => this.setColors(c), enumerable: false });
    /** @type {BrushSettings} */
    this._brush = { tip: 'square', size: 1, pixelPerfect: false, opacity: 1, blend: 'over', mirror: 'none', mirrorAxis: null, customTip: null };
    /** Brush settings; assigning a property is the same as setBrush({ property }). */
    this.brush = settings(this._brush, (b) => this.setBrush(b));
    /** @type {SelectionSettings} */
    this._selection = { mode: 'replace', threshold: 0, connectivity: 4, metric: 'channel', sample: 'layer' };
    /** Selection-tool settings; assigning a property is the same as setSelectionSettings({ property }). */
    this.selection = settings(this._selection, (s) => this.setSelectionSettings(s));

    /** Last copied or cut pixels (internal clipboard). @type {{ rgba: Uint32Array, width: number, height: number, x: number, y: number, sourceLayerId: string } | null} */
    this.clipboard = null;
    /** @type {Transaction | null} */ this.tx = null;
    /** @type {import('./Commands.js').PreviewSession | null} */ this.previewSession = null;
    /** @type {{ layer: any, palette?: Uint32Array, rgba?: Uint32Array } | null} */ this.override = null;
    /** @type {null | (() => void)} called when something needs a redraw */ this.onDirty = null;
    // Dirty 32 x 32 tiles for the renderer (sized by resizeDirty).
    this.tilesX = 0;
    this.tilesY = 0;
    this.dirtyTiles = new Uint8Array(0);
    this.dirtyAll = true;
    this.dirtyAny = true;
    this.resizeDirty();
    this.tools = new ToolRegistry(this, createTools(this));
    this.floatingController = new FloatingController(this);
    this.activeToolId = 'pencil';
    registerEffects(this);
    registerSelectionCommands(this);
    registerLayerCommands(this);
    registerFloatingCommands(this);
    registerMiscCommands(this);
    registerAppCommands(this);
    /** The canvas zone, once attached. @type {import('../view/index.js').CanvasZone | null} */
    this.view = null;
    /** @type {WorkerPool | null} */
    this.pool = opts.workers && opts.workers.create ? new WorkerPool(opts.workers) : null;
    this.export = {
      /**
       * @param {{ scale?: number, indexed?: boolean|'auto', layerId?: string, includeFloating?: boolean,
       *   embedProject?: boolean, blob?: boolean }} [o] embedProject: the PNG also carries the layered project
       */
      png: async (o = {}) => {
        const project = o.embedProject ? await serializeProject(this.doc, { colors: this.colors }) : undefined;
        return asBlob(await exportPNG(this.doc, { ...o, project }), 'image/png', o.blob !== false);
      },
      /** @param {{ blob?: boolean }} [o] */
      project: async (o = {}) => asBlob(await serializeProject(this.doc, { colors: this.colors }), 'application/x-pixa', o.blob !== false),
    };
    /** @type {Autosave | null} */
    this.persist = null;
    if (opts.autosave && (opts.autosave.store || globalThis.indexedDB)) this.persist = new Autosave(this, opts.autosave).start();
    this.refreshColors(true);
  }

  // ------------------------------------------------------------ host API

  /** @param {string} type @param {(payload: any) => void} fn */
  on(type, fn) { return this.events.on(type, fn); }
  /** @param {string} type @param {(payload: any) => void} fn */
  off(type, fn) { this.events.off(type, fn); }

  /**
   * Mounts the canvas zone. Needs the view module: `import '@pixa/editor/view'`.
   * @param {any} element @param {object} [o]
   */
  attach(element, o) {
    const factory = /** @type {any} */ (Editor).viewFactory;
    if (!factory) throw new Error("Import '@pixa/editor/view' before attaching a canvas zone");
    this.view?.dispose();
    this.view = factory(this, element, o || {});
    return this.view;
  }

  dispose() {
    if (this.previewSession) this.previewSession.cancel();
    this.view?.dispose();
    this.view = null;
    this.persist?.dispose();
    this.pool?.terminate();
    this.events.listeners.clear();
  }

  /** True when the document differs from the last save or open. */
  get dirty() {
    return this.history.stateId() !== this.savedState;
  }

  /** The current state counts as saved (exports, project saves). */
  markSaved() {
    this.savedState = this.history.stateId();
    this.events.emit('saved', { dirty: false });
  }

  /**
   * Imports an image or a .pixa project.
   * @param {any} source File, Blob, bytes, ImageData-like or bitmap
   * @param {{ as?: 'document'|'layer'|'floating', mode?: 'auto'|'pixel'|'photo', scale?: number,
   *   maxPixels?: number, colors?: number, downscale?: any, ignoreProject?: boolean, grow?: boolean }} [o]
   *   A PNG that carries a project (export.png({ embedProject: true })) reopens with its layers,
   *   unless ignoreProject is set. `grow` enlarges the canvas when a layer import is bigger.
   */
  async import(source, o = {}) {
    const bytes = source instanceof Uint8Array || source instanceof ArrayBuffer || (typeof Blob !== 'undefined' && source instanceof Blob)
      ? await asBytes(source instanceof ArrayBuffer ? new Uint8Array(source) : source) : null;
    const embedded = bytes && !o.ignoreProject ? readPNGChunks(bytes).get(PROJECT_CHUNK)?.[0] : null;
    if (bytes && (isProject(bytes) || (embedded && isProject(embedded)))) {
      await this.open(embedded || bytes);
      return { kind: 'project', width: this.doc.width, height: this.doc.height, summary: `Project ${this.doc.width} × ${this.doc.height}, ${this.doc.layers.length} layers` };
    }
    const name = source?.name;
    const img = await decodeImage(bytes || source);
    const { downscale, ...plain } = o;
    const r = this.pool && !downscale
      ? await this.pool.run('importPixelArt', [img.rgba, img.width, img.height, plain])
      : importPixelArt(img.rgba, img.width, img.height, o);
    this.place(r, o.as ?? 'document', name, { grow: o.grow });
    this.events.emit('import', { kind: r.kind, summary: r.summary, as: o.as ?? 'document' });
    return r;
  }

  /**
   * Puts imported pixels into the document. In strict colour mode the
   * pixels are first reduced to the colour limit.
   * @param {{ rgba: Uint32Array, width: number, height: number }} r
   * @param {'document'|'layer'|'floating'} [as] @param {string} [name] @param {{ grow?: boolean }} [o]
   */
  place(r, as = 'document', name, o = {}) {
    const title = (name || 'Imported').replace(/\.[a-z0-9]+$/i, '');
    const rgba = this.options.strictColors && as === 'document' ? this.reduceToLimit(r.rgba) : r.rgba;
    if (as === 'document') {
      this.setDocument(new Document({ width: r.width, height: r.height, name: title, layers: [Layer.fromRGBA(rgba, r.width, r.height, title)] }));
      return;
    }
    if (this.doc.floating) this.run('floating.commit');
    if (as === 'layer' && o.grow && (r.width > this.doc.width || r.height > this.doc.height)) {
      this.run('document.resize', { width: Math.max(r.width, this.doc.width), height: Math.max(r.height, this.doc.height), anchor: 'center' });
    }
    const doc = this.doc, ox = Math.floor((doc.width - r.width) / 2), oy = Math.floor((doc.height - r.height) / 2);
    if (as === 'floating') {
      this.transact('Import', (tx) => tx.setFloating(new Floating({ rgba, width: r.width, height: r.height, x: ox, y: oy, mode: 'import' })));
      return;
    }
    const layer = Layer.blank(doc.width, doc.height, title);
    const fill = (/** @type {(i: number, c: number) => void} */ set) => {
      for (let y = 0; y < r.height; y++) {
        const ty = y + oy;
        if (ty < 0 || ty >= doc.height) continue;
        for (let x = 0; x < r.width; x++) {
          const tx2 = x + ox, c = rgba[y * r.width + x];
          if (tx2 >= 0 && tx2 < doc.width && c >>> 24) set(ty * doc.width + tx2, c);
        }
      }
    };
    // Normally the layer is filled while detached, so the structure patch alone undoes it;
    // in strict colour mode it is filled inside the transaction, where the cap applies.
    const strict = this.options.strictColors && this.options.colorLimit > 0;
    if (!strict) fill((i, c) => layer.setColor(i, c));
    this.transact('Import layer', (tx) => {
      tx.structureWillChange();
      doc.layers.splice(doc.activeIndex + 1, 0, layer);
      doc.activeLayerId = layer.id;
      if (strict) fill((i, c) => tx.setColor(layer, i, c));
    });
  }

  /** Reduces packed colours to the colour limit (strict mode). @param {Uint32Array} rgba */
  reduceToLimit(rgba) {
    const limit = this.options.colorLimit;
    const counts = countRGBA(rgba);
    if (!limit || counts.size <= limit) return rgba;
    const colors = [0, ...counts.keys()], usage = [0, ...counts.values()];
    const mapped = reduceColors(Uint32Array.from(colors), Uint32Array.from(usage), limit);
    const to = new Map(colors.map((c, i) => [c, mapped[i]]));
    return rgba.map((c) => (c >>> 24 ? /** @type {number} */ (to.get(c)) : 0));
  }

  /** Opens .pixa bytes as the document. @param {Uint8Array | ArrayBuffer | Blob} input */
  async open(input) {
    const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : await asBytes(/** @type {any} */ (input));
    const { doc, colors } = await parseProject(bytes);
    this.setDocument(doc);
    if (colors) this.setColors(colors);
    return doc;
  }

  // ------------------------------------------------------------ colours in the document

  /** Distinct colours used across all layers. */
  colorCount() {
    return this.census.document(this.doc).size;
  }

  /**
   * Changes the colour limit (0 = none) and strict mode. Colours already in the
   * document stay as they are; 'color-limit' reports when they are over the
   * new limit, and palette.fitLimit brings them under it.
   * @param {{ limit?: number, strict?: boolean }} p
   */
  setColorPolicy(p) {
    if (p.limit !== undefined) this.options.colorLimit = Math.max(0, Math.round(p.limit) || 0);
    if (p.strict !== undefined) this.options.strictColors = !!p.strict;
    this.colorState = { count: 0, over: false };
    this.refreshColors();
    this.events.emit('color-policy', { limit: this.options.colorLimit, strict: this.options.strictColors });
  }

  /**
   * Re-counts document colours after a change and reports crossing the limit.
   * @param {boolean} [silent]
   */
  refreshColors(silent = false) {
    const limit = this.options.colorLimit;
    if (!limit && !this.options.strictColors) return;
    const count = this.colorCount(), over = !!limit && count > limit;
    const changed = over !== this.colorState.over;
    this.colorState = { count, over };
    if (changed && !silent) this.events.emit('color-limit', { count, limit, over, strict: this.options.strictColors });
  }

  /**
   * Strict colour cap, applied inside every commit: colours this transaction
   * adds beyond the limit move to their nearest allowed colour.
   * @param {Transaction} tx
   */
  _beforeCommit(tx) {
    const limit = this.options.colorLimit;
    if (!this.options.strictColors || !limit || tx.docBefore || !tx.layers.size) return;
    const doc = this.doc, base = new Set();
    for (const l of doc.layers) {
      // Touched layers: the colours they had before this transaction (cached, revision not bumped yet).
      const counts = tx.layers.has(l) ? this.census.peek(l) : this.census.layer(l);
      if (counts) for (const c of counts.keys()) base.add(c);
    }
    const fresh = new Map();
    for (const l of tx.layers.keys()) {
      if (!doc.layers.includes(l)) continue;
      for (const [c, n] of countLayer(l)) if (!base.has(c)) fresh.set(c, (fresh.get(c) || 0) + n);
    }
    if (base.size + fresh.size <= limit) return;
    const moves = capColors(fresh, base, limit);
    if (!moves.size) return;
    for (const l of tx.layers.keys()) {
      if (!doc.layers.includes(l)) continue;
      const colors = l.palette.view().slice();
      let changed = false;
      for (let i = 1; i < colors.length; i++) {
        const to = moves.get(colors[i]);
        if (to !== undefined) { colors[i] = to; changed = true; }
      }
      if (changed) tx.replacePalette(l, colors);
    }
    this.events.emit('color-limit', { count: limit, limit, over: false, strict: true, mapped: moves.size });
  }

  /**
   * The strict-mode mapping applied to a preview result, so a preview shows
   * exactly what the commit will keep.
   * @param {'palette'|'pixels'} kind @param {Layer} layer @param {any} mask @param {Uint32Array} out
   */
  capPreview(kind, layer, mask, out) {
    const limit = this.options.colorLimit;
    if (!this.options.strictColors || !limit) return out;
    const base = new Set();
    for (const l of this.doc.layers) for (const c of this.census.layer(l).keys()) base.add(c);
    const idx = layer.indices, pal = layer.palette.colors;
    let after;
    if (kind === 'palette' && !mask) {
      after = new Map();
      const u = layer.usage();
      for (let i = 1; i < u.length; i++) if (u[i] && out[i] >>> 24) after.set(out[i], (after.get(out[i]) || 0) + u[i]);
    } else {
      const full = new Uint32Array(idx.length);
      for (let i = 0; i < idx.length; i++) full[i] = pal[idx[i]];
      if (kind === 'palette') /** @type {any} */ (mask).forEach((/** @type {number} */ i) => { full[i] = out[idx[i]]; });
      else if (mask) mask.forEach((/** @type {number} */ i) => { full[i] = out[i]; });
      else full.set(out);
      after = countRGBA(full);
    }
    const fresh = new Map();
    for (const [c, n] of after) if (!base.has(c)) fresh.set(c, n);
    if (base.size + fresh.size <= limit) return out;
    const moves = capColors(fresh, base, limit);
    if (!moves.size) return out;
    return out.map((c) => moves.get(c) ?? c);
  }

  // ------------------------------------------------------------ dirty tiles

  resizeDirty() {
    this.tilesX = Math.ceil(this.doc.width / TILE);
    this.tilesY = Math.ceil(this.doc.height / TILE);
    this.dirtyTiles = new Uint8Array(this.tilesX * this.tilesY);
    this.dirtyAll = true;
    this.dirtyAny = true;
    this.onDirty?.();
  }

  /** @param {number} x @param {number} y */
  markDirty(x, y) {
    this.dirtyTiles[(y >> 5) * this.tilesX + (x >> 5)] = 1;
    if (!this.dirtyAny) { this.dirtyAny = true; this.onDirty?.(); }
  }

  /** @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 inclusive */
  markDirtyRect(x0, y0, x1, y1) {
    const tx0 = Math.max(0, x0 >> 5), ty0 = Math.max(0, y0 >> 5);
    const tx1 = Math.min(this.tilesX - 1, x1 >> 5), ty1 = Math.min(this.tilesY - 1, y1 >> 5);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) this.dirtyTiles[ty * this.tilesX + tx] = 1;
    if (!this.dirtyAny) { this.dirtyAny = true; this.onDirty?.(); }
  }

  /** Marks the rectangle a floating layer covers. @param {any} f Floating or null */
  markFloatingDirty(f) {
    if (!f) return;
    const x0 = Math.max(0, f.x), y0 = Math.max(0, f.y), x1 = Math.min(this.doc.width - 1, f.x + f.dw - 1), y1 = Math.min(this.doc.height - 1, f.y + f.dh - 1);
    if (x1 >= x0 && y1 >= y0) this.markDirtyRect(x0, y0, x1, y1);
  }

  markAllDirty() {
    this.dirtyAll = true;
    if (!this.dirtyAny) { this.dirtyAny = true; this.onDirty?.(); }
  }

  /** Hands the dirty set to the renderer and resets it. */
  takeDirty() {
    const out = { all: this.dirtyAll, tiles: this.dirtyTiles, tilesX: this.tilesX, tilesY: this.tilesY, any: this.dirtyAny };
    this.dirtyTiles = new Uint8Array(this.tilesX * this.tilesY);
    this.dirtyAll = false;
    this.dirtyAny = false;
    return out;
  }

  // ------------------------------------------------------------ transactions

  /**
   * Opens a transaction. If a stroke or floating drag holds one, that
   * gesture ends first (as if the pointer went up), so a shortcut pressed
   * mid-stroke keeps the stroke and runs after it.
   * With `meta.merge`, a transaction right after one with the same merge key
   * replaces it: one history step for a whole slider drag.
   * @param {string} label @param {{ gesture?: boolean, merge?: string } & Record<string, any>} [meta]
   */
  begin(label, meta) {
    if (this.tx) {
      if (this.tx.meta?.gesture) this.finishGesture();
      if (this.tx) throw new Error(`A transaction is already open (${this.tx.label})`);
    }
    if (this.previewSession) this.previewSession.cancel();
    if (meta?.merge !== undefined) {
      const h = this.history, top = h.index && h.index === h.stack.length ? h.stack[h.index - 1] : null;
      if (top && /** @type {any} */ (top.meta)?.merge === meta.merge) h.retract(this);
    }
    this.tx = new Transaction(this, label, meta);
    return this.tx;
  }

  /** Ends a stroke or floating drag in progress, keeping what it did. */
  finishGesture() {
    if (this.floatingController.active) this.floatingController.up();
    if (this.tx?.meta?.gesture) /** @type {any} */ (this.tool)?.up?.();
    if (this.tx?.meta?.gesture) this.tx.commit();
  }

  /**
   * @template T
   * @param {string} label @param {(tx: Transaction) => T} fn @param {object} [meta]
   * @returns {T}
   */
  transact(label, fn, meta) {
    const tx = this.begin(label, meta);
    try {
      const r = fn(tx);
      tx.commit();
      return r;
    } catch (err) {
      tx.rollback();
      throw err;
    }
  }

  /** @param {Transaction} tx @param {any} entry @param {boolean} [rolledBack] */
  _endTransaction(tx, entry, rolledBack = false) {
    if (this.tx === tx) this.tx = null;
    if (entry) this._announce(entry, 'commit');
    else if (rolledBack) this.events.emit('change', { reason: 'rollback', dirty: this.dirty });
  }

  /** @param {any} entry @param {'commit'|'undo'|'redo'} how */
  _announce(entry, how) {
    const k = entry.kinds;
    this.refreshColors();
    this.events.emit('change', { reason: how, label: entry.label, kinds: [...k], dirty: this.dirty });
    if (k.has('mask') || k.has('document')) this.events.emit('selection', this.selectionInfo());
    if (k.has('structure') || k.has('document') || k.has('tile')) this.events.emit('layers', { reason: how });
    if (k.has('document')) this.events.emit('document', { width: this.doc.width, height: this.doc.height });
    if (k.has('floating') || k.has('document')) this.events.emit('floating', { floating: this.doc.floating });
    this.events.emit('history', this.historyState());
  }

  /** Ends gestures and previews before history moves: a stroke in progress is kept, then undone like any edit. */
  _settle() {
    this.finishGesture();
    if (this.tx) this.tx.commit();
    if (this.previewSession) this.previewSession.cancel();
    this.cancelToolGesture();
  }

  undo() {
    this._settle();
    const e = this.history.undo(this);
    if (e) this._announce(e, 'undo');
    return !!e;
  }

  redo() {
    this._settle();
    const e = this.history.redo(this);
    if (e) this._announce(e, 'redo');
    return !!e;
  }

  /**
   * Undoes or redoes until `position` entries are applied (0 = as opened).
   * @param {number} position
   */
  goTo(position) {
    const target = Math.max(0, Math.min(this.history.stack.length, Math.round(position)));
    let moved = false;
    while (this.history.index > target && this.undo()) moved = true;
    while (this.history.index < target && this.redo()) moved = true;
    return moved;
  }

  historyState() {
    return { canUndo: this.history.canUndo(), canRedo: this.history.canRedo(), entries: this.history.list(), bytes: this.history.bytes, position: this.history.index, dirty: this.dirty };
  }

  selectionInfo() {
    const s = this.doc.selection;
    return { empty: s.isEmpty(), bounds: s.bounds(), version: s.version };
  }

  // ------------------------------------------------------------ document

  /** @param {Document} doc @param {{ keepHistory?: boolean }} [o] */
  setDocument(doc, o = {}) {
    if (this.tx) this.tx.rollback();
    if (this.previewSession) this.previewSession.cancel();
    this.cancelToolGesture();
    this.doc = doc;
    if (!o.keepHistory) this.history.clear();
    this.savedState = this.history.stateId();
    this.resizeDirty();
    this.refreshColors();
    this.events.emit('document', { width: doc.width, height: doc.height, replaced: true });
    this.events.emit('layers', { reason: 'document' });
    this.events.emit('selection', this.selectionInfo());
    this.events.emit('floating', { floating: doc.floating });
    this.events.emit('history', this.historyState());
  }

  /** @param {number} width @param {number} height */
  newDocument(width, height) {
    this.setDocument(new Document({ width, height }));
  }

  // ------------------------------------------------------------ colours, brush, tools

  /** @param {{ primary?: number|string, secondary?: number|string }} c */
  setColors(c) {
    const norm = (/** @type {number|string} */ v) => (typeof v === 'string' ? fromHex(v) : v >>> 0);
    if (c.primary !== undefined) this.colors.primary = norm(c.primary);
    if (c.secondary !== undefined) this.colors.secondary = norm(c.secondary);
    this.events.emit('colors', { primary: toHex(this.colors.primary), secondary: toHex(this.colors.secondary) });
  }

  /** @param {Partial<BrushSettings>} b */
  setBrush(b) {
    const next = { ...b };
    if (next.size !== undefined) next.size = Math.max(1, Math.min(32, Math.round(next.size)));
    if (next.opacity !== undefined) next.opacity = Math.max(0, Math.min(1, next.opacity));
    Object.assign(this._brush, next);
    this.events.emit('brush', { ...this._brush });
    this.onDirty?.();
  }

  /** @param {Partial<SelectionSettings>} s */
  setSelectionSettings(s) {
    const next = { ...s };
    if (next.threshold !== undefined) next.threshold = Math.max(0, Math.min(1, next.threshold));
    if (next.connectivity !== undefined) next.connectivity = next.connectivity === 8 ? 8 : 4;
    Object.assign(this._selection, next);
    this.events.emit('selection-settings', { ...this._selection });
  }

  get tool() {
    return this.tools.get(this.activeToolId);
  }

  /** @param {string} id @param {object} [settingsPatch] brush and/or selection settings to apply */
  useTool(id, settingsPatch) {
    if (!this.tools.has(id)) throw new Error(`Unknown tool: ${id}`);
    if (id !== this.activeToolId) {
      this.cancelToolGesture();
      if (this.doc.floating && id !== 'move') this.run('floating.commit');
    }
    this.activeToolId = id;
    if (settingsPatch) {
      /** @type {any} */ const sel = {}, brush = {};
      for (const [k, v] of Object.entries(settingsPatch)) {
        if (k in this._selection) sel[k] = v;
        else brush[k] = v;
      }
      if (Object.keys(sel).length) this.setSelectionSettings(sel);
      if (Object.keys(brush).length) this.setBrush(brush);
    }
    this.events.emit('tool', { id });
    this.onDirty?.();
  }

  cancelToolGesture() {
    this.tool?.cancel();
    this.floatingController.cancel();
  }

  // ------------------------------------------------------------ commands, previews

  /** @param {string} id @param {object} [args] */
  run(id, args) { return this.commands.run(id, args); }
  /** @param {string} id @param {object} [args] */
  can(id, args) { return this.commands.can(id, args); }
  /** @param {string} id @param {object} [args] */
  preview(id, args) { return this.commands.preview(id, args); }

  /** @param {any} session */
  beginPreview(session) {
    if (this.previewSession && this.previewSession !== session) this.previewSession.cancel();
    this.previewSession = session;
    this.events.emit('preview', { id: session.id, active: true });
  }

  /** @param {any} session */
  endPreview(session) {
    if (this.previewSession !== session) return;
    this.previewSession = null;
    this.setOverride(null);
    this.events.emit('preview', { id: session.id, active: false });
  }

  /** @param {{ layer: any, palette?: Uint32Array, rgba?: Uint32Array } | null} o */
  setOverride(o) {
    this.override = o;
    this.markAllDirty();
  }

  // ------------------------------------------------------------ queries

  /** @param {number} x @param {number} y */
  compositeAt(x, y) {
    return this.doc.compositeAt(x, y);
  }
}

/** @param {EditorOptions} [opts] */
export function createEditor(opts) {
  return new Editor(opts);
}
