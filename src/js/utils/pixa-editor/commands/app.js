// @ts-check
/**
 * Application-level commands: canvas size, document colours, reference image,
 * the canvas view (view.*) and files (file.*). View commands are enabled once
 * a canvas zone is attached; file commands return promises.
 */
import { Mask } from '../model/Mask.js';
import { MAX_SIZE } from '../model/Document.js';
import { makeReference, updateReference, moveReference } from '../model/Reference.js';
import { reduceColors } from '../ops/color-ops.js';

/**
 * Offset of the old content inside a resized canvas.
 * @param {string | {x: number, y: number}} anchor @param {number} dw width change @param {number} dh height change
 */
export function anchorOffset(anchor, dw, dh) {
  if (anchor && typeof anchor === 'object') return { x: Math.round(anchor.x), y: Math.round(anchor.y) };
  const a = String(anchor || 'center');
  const fx = a.includes('left') ? 0 : a.includes('right') ? 1 : 0.5;
  const fy = a.includes('top') ? 0 : a.includes('bottom') ? 1 : 0.5;
  return { x: Math.floor(dw * fx), y: Math.floor(dh * fy) };
}

/** @param {import('../core/Editor.js').Editor} editor */
export function registerAppCommands(editor) {
  const c = editor.commands;
  const hasView = (/** @type {any} */ ed) => !!ed.view;
  /** The attached view (the commands below are enabled only with one). @param {import('../core/Editor.js').Editor} ed */
  const view = (ed) => /** @type {import('../view/index.js').CanvasZone} */ (ed.view);

  c.register({
    id: 'document.resize', label: 'Canvas size',
    isEnabled: (ed, a) => !ed.doc.floating && a.width >= 1 && a.height >= 1 && a.width <= MAX_SIZE && a.height <= MAX_SIZE
      && (a.width !== ed.doc.width || a.height !== ed.doc.height || (a.anchor && typeof a.anchor === 'object' && (a.anchor.x || a.anchor.y))),
    run(ed, a) {
      const W = Math.round(a.width), H = Math.round(a.height);
      ed.transact('Canvas size', (tx) => {
        const doc = tx.documentWillChange(), w0 = doc.width, h0 = doc.height;
        const { x: ox, y: oy } = anchorOffset(a.anchor, W - w0, H - h0);
        for (const l of doc.layers) {
          const idx = new Uint16Array(W * H);
          for (let y = 0; y < h0; y++) {
            const ty = y + oy;
            if (ty < 0 || ty >= H) continue;
            for (let x = 0; x < w0; x++) {
              const tx2 = x + ox;
              if (tx2 >= 0 && tx2 < W) idx[ty * W + tx2] = l.indices[y * w0 + x];
            }
          }
          l.replaceData(W, H, l.palette, idx);
        }
        const sel = new Mask(W, H);
        doc.selection.forEach((/** @type {number} */ i) => {
          const x = (i % w0) + ox, y = Math.floor(i / w0) + oy;
          if (x >= 0 && y >= 0 && x < W && y < H) sel.set(y * W + x);
        });
        doc.width = W;
        doc.height = H;
        doc.selection = sel;
        doc.reference = moveReference(doc.reference, ox, oy);
        ed.resizeDirty();
      });
      return true;
    },
  });

  // ---------------------------------------------------------------- reference image
  c.register({
    // Every layer's colours move to one shared set of at most `limit` (default: the colour limit).
    id: 'palette.fitLimit', label: 'Fit the colour limit',
    isEnabled: (ed, a) => {
      const limit = a.limit ?? ed.options.colorLimit;
      return limit > 0 && !ed.doc.floating && ed.colorCount() > limit;
    },
    run(ed, a) {
      const limit = a.limit ?? ed.options.colorLimit;
      const counts = ed.census.document(ed.doc);
      const colors = [0, ...counts.keys()], usage = [0, ...counts.values()];
      const mapped = reduceColors(Uint32Array.from(colors), Uint32Array.from(usage), limit);
      const to = new Map(colors.map((col, i) => [col, mapped[i]]));
      ed.transact(`Fit ${limit} colours`, (tx) => {
        for (const l of ed.doc.layers) {
          const pal = l.palette.view().slice();
          let changed = false;
          for (let i = 1; i < pal.length; i++) {
            const t = to.get(pal[i]);
            if (t !== undefined && t !== pal[i]) { pal[i] = t; changed = true; }
          }
          if (changed) tx.replacePalette(l, pal);
        }
      });
      return true;
    },
  });

  c.register({
    id: 'reference.set', label: 'Reference image',
    isEnabled: (ed, a) => a.bytes instanceof Uint8Array && a.width > 0 && a.height > 0,
    run(ed, a) {
      const doc = ed.doc;
      // Fit inside the document by default, keeping the aspect ratio.
      const k = Math.min(doc.width / a.width, doc.height / a.height);
      const dw = a.dw ?? Math.max(1, Math.round(a.width * k)), dh = a.dh ?? Math.max(1, Math.round(a.height * k));
      const ref = makeReference({ ...a, dw, dh, x: a.x ?? Math.round((doc.width - dw) / 2), y: a.y ?? Math.round((doc.height - dh) / 2) });
      ed.transact('Reference image', (tx) => { tx.structureWillChange(); doc.reference = ref; ed.markAllDirty(); });
      ed.events.emit('reference', { reference: ref });
      return true;
    },
  });
  c.register({
    id: 'reference.update', label: 'Reference image',
    isEnabled: (ed) => !!ed.doc.reference,
    run(ed, a) {
      const { label, merge, ...patch } = a, current = ed.doc.reference;
      if (!current) return false;
      const ref = updateReference(current, patch);
      ed.transact(label || 'Reference image', (tx) => { tx.structureWillChange(); ed.doc.reference = ref; }, merge === undefined ? undefined : { merge });
      ed.events.emit('reference', { reference: ref });
      return true;
    },
  });
  c.register({
    id: 'reference.clear', label: 'Remove reference',
    isEnabled: (ed) => !!ed.doc.reference,
    run(ed) {
      ed.transact('Remove reference', (tx) => { tx.structureWillChange(); ed.doc.reference = null; });
      ed.events.emit('reference', { reference: null });
      return true;
    },
  });

  // ---------------------------------------------------------------- view
  c.register({ id: 'view.fit', label: 'Fit', isEnabled: hasView, run: (ed) => { view(ed).fit(); } });
  c.register({ id: 'view.zoomIn', label: 'Zoom in', isEnabled: hasView, run: (ed) => { view(ed).zoomBy(1.25); } });
  c.register({ id: 'view.zoomOut', label: 'Zoom out', isEnabled: hasView, run: (ed) => { view(ed).zoomBy(0.8); } });
  c.register({
    id: 'view.zoom', label: 'Zoom', isEnabled: (ed, a) => hasView(ed) && a.scale > 0,
    run: (ed, a) => { view(ed).zoomTo(a.scale, a.x, a.y); },
  });
  c.register({ id: 'view.pan', label: 'Pan', isEnabled: hasView, run: (ed, a) => { view(ed).panBy(a.dx || 0, a.dy || 0); } });
  c.register({
    id: 'view.grid', label: 'Pixel grid', isEnabled: hasView,
    run: (ed, a) => { view(ed).setGrid(a.on ?? !view(ed).o.grid); },
  });

  // ---------------------------------------------------------------- files
  c.register({ id: 'file.new', label: 'New', run: (ed, a) => { ed.newDocument(a.width ?? 32, a.height ?? 32); } });
  c.register({ id: 'file.import', label: 'Import', isEnabled: (ed, a) => !!a.source, run: (ed, a) => ed.import(a.source, a) });
  c.register({ id: 'file.open', label: 'Open project', isEnabled: (ed, a) => !!a.bytes, run: (ed, a) => ed.open(a.bytes) });
  c.register({ id: 'file.exportPNG', label: 'Export PNG', run: (ed, a) => ed.export.png(a) });
  c.register({ id: 'file.exportProject', label: 'Save project', run: (ed, a) => ed.export.project(a) });
}
