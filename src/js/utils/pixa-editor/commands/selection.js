// @ts-check
import { Mask } from '../model/Mask.js';
import { Floating } from '../model/Floating.js';
import { over } from '../color/rgba.js';
import { averageColor } from '../ops/color-ops.js';
import { usageIn } from '../ops/apply.js';
import { crop } from '../ops/pixel-ops.js';
import { moveReference } from '../model/Reference.js';

/** @param {import('../core/Editor.js').Editor} ed */
const hasSelection = (ed) => !ed.doc.selection.isEmpty();
/** @param {import('../core/Editor.js').Editor} ed */
const editable = (ed) => hasSelection(ed) && !ed.doc.activeLayer.locked && !ed.doc.floating;

/**
 * Pixels of the active layer under the mask, cut to the mask's bounds.
 * @param {any} doc @param {Mask} mask
 */
export function extractSelection(doc, mask) {
  const b = mask.bounds();
  if (!b) return null;
  const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1, layer = doc.activeLayer, W = doc.width;
  const rgba = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (b.y0 + y) * W + b.x0 + x;
      if (mask.get(i)) rgba[y * w + x] = layer.getColor(i);
    }
  }
  return { rgba, width: w, height: h, x: b.x0, y: b.y0 };
}

/** @param {import('../core/Editor.js').Editor} editor */
export function registerSelectionCommands(editor) {
  const c = editor.commands;

  c.register({
    id: 'selection.combine',
    label: 'Select',
    run(ed, a) {
      const mode = a.mode || ed.selection.mode;
      ed.transact(a.label || 'Select', (tx) => {
        const sel = tx.selectionWillChange();
        sel.combine(a.mask, mode);
      });
      return true;
    },
  });
  c.register({ id: 'selection.all', label: 'Select all', run: (ed) => ed.transact('Select all', (tx) => tx.selectionWillChange().fill()) });
  c.register({ id: 'selection.clear', label: 'Unselect', isEnabled: hasSelection, run: (ed) => ed.transact('Unselect', (tx) => tx.selectionWillChange().clear()) });
  c.register({ id: 'selection.invert', label: 'Invert', run: (ed) => ed.transact('Invert selection', (tx) => tx.selectionWillChange().invert()) });
  c.register({
    id: 'selection.grow', label: 'Grow', isEnabled: hasSelection,
    run: (ed, a) => ed.transact('Grow selection', (tx) => tx.selectionWillChange().grow(a.by ?? 1, a.connectivity ?? 4)),
  });
  c.register({
    id: 'selection.shrink', label: 'Shrink', isEnabled: hasSelection,
    run: (ed, a) => ed.transact('Shrink selection', (tx) => tx.selectionWillChange().shrink(a.by ?? 1, a.connectivity ?? 4, a.edgeIsOutside ?? true)),
  });

  c.register({
    id: 'selection.fill', label: 'Bucket', isEnabled: editable,
    run(ed, a) {
      const layer = ed.doc.activeLayer, color = a.color ?? ed.colors.primary, op = Math.round((a.opacity ?? ed.brush.opacity) * 255);
      ed.transact('Fill selection', (tx) => {
        ed.doc.selection.forEach((i) => tx.setColor(layer, i, over(layer.getColor(i), color, op)));
      });
      return true;
    },
  });
  c.register({
    id: 'selection.border', label: 'Border', isEnabled: editable,
    run(ed, a) {
      const layer = ed.doc.activeLayer, color = a.color ?? ed.colors.primary, op = Math.round((a.opacity ?? ed.brush.opacity) * 255);
      const edge = ed.doc.selection.innerBorder(a.width ?? 1, a.connectivity ?? 4);
      ed.transact('Border', (tx) => {
        edge.forEach((i) => tx.setColor(layer, i, over(layer.getColor(i), color, op)));
      });
      return true;
    },
  });
  c.register({
    id: 'selection.erase', label: 'Erase', isEnabled: editable,
    run(ed) {
      const layer = ed.doc.activeLayer;
      ed.transact('Erase', (tx) => ed.doc.selection.forEach((i) => { if (layer.indices[i]) tx.setIndex(layer, i, 0); }));
      return true;
    },
  });
  c.register({
    id: 'selection.averageColor', label: 'Get average color', isEnabled: hasSelection,
    run(ed) {
      const layer = ed.doc.activeLayer;
      ed.setColors({ primary: averageColor(layer.palette.view(), usageIn(layer, ed.doc.selection)) });
      return true;
    },
  });

  c.register({
    id: 'selection.crop', label: 'Crop', isEnabled: (ed) => hasSelection(ed) && !ed.doc.floating,
    run(ed) {
      const b = ed.doc.selection.bounds();
      if (!b) return false;
      const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1;
      ed.transact('Crop', (tx) => {
        const doc = tx.documentWillChange();
        const W = doc.width;
        for (const l of doc.layers) l.replaceData(w, h, l.palette, crop(l.indices, W, b.x0, b.y0, w, h));
        const sel = new Mask(w, h);
        doc.selection.forEach((i) => {
          const x = i % W, y = (i - x) / W;
          if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) sel.set((y - b.y0) * w + (x - b.x0));
        });
        doc.width = w;
        doc.height = h;
        // A rectangle crops to nothing left to mark; any other shape stays selected.
        if (sel.count() === w * h) sel.clear();
        doc.selection = sel;
        doc.reference = moveReference(doc.reference, -b.x0, -b.y0);
        ed.resizeDirty();
      });
      return true;
    },
  });

  const toClipboard = (ed) => {
    const piece = extractSelection(ed.doc, ed.doc.selection);
    if (piece) ed.clipboard = { ...piece, sourceLayerId: ed.doc.activeLayerId };
    ed.events.emit('clipboard', ed.clipboard);
    return piece;
  };

  c.register({
    id: 'selection.copy', label: 'Copy', isEnabled: (ed) => hasSelection(ed) && !ed.doc.floating,
    run(ed) {
      const piece = toClipboard(ed);
      if (piece && ed.options.copyFloats) {
        ed.transact('Copy', (tx) => tx.setFloating(new Floating({
          ...piece, mode: 'copy', sourceLayerId: ed.doc.activeLayerId,
          origin: { x: piece.x, y: piece.y }, source: { rgba: piece.rgba, width: piece.width, height: piece.height },
        })));
      }
      return true;
    },
  });
  c.register({
    id: 'selection.cut', label: 'Cut', isEnabled: editable,
    run(ed) {
      const piece = toClipboard(ed);
      if (!piece) return false;
      const layer = ed.doc.activeLayer;
      ed.transact('Cut', (tx) => {
        ed.doc.selection.forEach((i) => { if (layer.indices[i]) tx.setIndex(layer, i, 0); });
        tx.selectionWillChange().clear();
        tx.setFloating(new Floating({ ...piece, mode: 'lift', sourceLayerId: layer.id, origin: { x: piece.x, y: piece.y }, source: { rgba: piece.rgba, width: piece.width, height: piece.height } }));
      });
      return true;
    },
  });
  c.register({
    id: 'selection.lift', label: 'Move selection', isEnabled: (ed, a) => (a.duplicate ? hasSelection(ed) && !ed.doc.floating : editable(ed)),
    /** `duplicate`: lift a copy and leave the source in place (Alt-drag). */
    run(ed, a) {
      const piece = extractSelection(ed.doc, ed.doc.selection);
      if (!piece) return false;
      const layer = ed.doc.activeLayer;
      const source = { rgba: piece.rgba, width: piece.width, height: piece.height };
      ed.transact(a.duplicate ? 'Duplicate selection' : 'Lift selection', (tx) => {
        if (!a.duplicate) ed.doc.selection.forEach((i) => { if (layer.indices[i]) tx.setIndex(layer, i, 0); });
        tx.selectionWillChange().clear();
        tx.setFloating(new Floating({ ...piece, mode: a.duplicate ? 'copy' : 'lift', sourceLayerId: layer.id, origin: { x: piece.x, y: piece.y }, source }));
      });
      return true;
    },
  });
  c.register({
    id: 'clipboard.paste', label: 'Paste', isEnabled: (ed) => !!ed.clipboard,
    run(ed, a) {
      const clip = ed.clipboard;
      if (!clip) return false;
      if (ed.doc.floating) ed.run('floating.commit');
      const x = a.x ?? clip.x ?? 0, y = a.y ?? clip.y ?? 0;
      ed.transact('Paste', (tx) => tx.setFloating(new Floating({ rgba: clip.rgba, width: clip.width, height: clip.height, x, y, mode: 'paste' })));
      return true;
    },
  });
}
