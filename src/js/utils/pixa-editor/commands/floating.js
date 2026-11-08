// @ts-check
import { Mask } from '../model/Mask.js';
import { Layer } from '../model/Layer.js';
import { over } from '../color/rgba.js';

/** @param {import('../core/Editor.js').Editor} ed */
const hasFloat = (ed) => !!ed.doc.floating;

/**
 * Writes a floating layer into `layer` (source-over: its transparent pixels
 * never erase what is below) and returns the footprint of what it wrote.
 * @param {any} tx @param {any} doc @param {any} f Floating @param {any} layer
 */
export function stampFloating(tx, doc, f, layer) {
  const W = doc.width, H = doc.height, footprint = new Mask(W, H);
  for (let dy = 0; dy < f.dh; dy++) {
    const y = f.y + dy;
    if (y < 0 || y >= H) continue;
    for (let dx = 0; dx < f.dw; dx++) {
      const x = f.x + dx;
      if (x < 0 || x >= W) continue;
      const c = f.sample(dx, dy);
      if (!(c >>> 24)) continue;
      const i = y * W + x;
      tx.setColor(layer, i, over(layer.getColor(i), c, 255));
      footprint.set(i);
    }
  }
  return footprint;
}

/** @param {import('../core/Editor.js').Editor} editor */
export function registerFloatingCommands(editor) {
  const c = editor.commands;
  c.register({
    id: 'floating.move', label: 'Move', isEnabled: hasFloat,
    run(ed, a) {
      const f = ed.doc.floating;
      if (!f) return false;
      const x = a.x ?? f.x + (a.dx ?? 0), y = a.y ?? f.y + (a.dy ?? 0);
      ed.transact('Move', (tx) => tx.setFloating(f.with({ x, y })));
      return true;
    },
  });
  c.register({
    id: 'floating.scale', label: 'Scale', isEnabled: hasFloat,
    run(ed, a) {
      const f = ed.doc.floating;
      if (!f) return false;
      ed.transact('Scale', (tx) => tx.setFloating(f.with({ dw: Math.max(1, a.dw ?? f.dw), dh: Math.max(1, a.dh ?? f.dh), x: a.x ?? f.x, y: a.y ?? f.y })));
      return true;
    },
  });
  c.register({
    id: 'floating.commit', label: 'Apply', isEnabled: hasFloat,
    run(ed, a) {
      const doc = ed.doc, f = doc.floating;
      if (!f) return false;
      ed.transact(a.asNewLayer ? 'Paste as layer' : 'Apply', (tx) => {
        let layer = (f.sourceLayerId && doc.layerById(f.sourceLayerId)) || doc.activeLayer;
        if (f.pristine && !a.asNewLayer) { tx.setFloating(null); return; }
        if (a.asNewLayer) {
          tx.structureWillChange();
          layer = Layer.blank(doc.width, doc.height, 'Pasted layer');
          doc.layers.splice(doc.activeIndex + 1, 0, layer);
          doc.activeLayerId = layer.id;
        }
        const footprint = stampFloating(tx, doc, f, layer);
        tx.setFloating(null);
        tx.setSelection(footprint);
      });
      return true;
    },
  });
  c.register({
    id: 'floating.discard', label: 'Delete', isEnabled: hasFloat,
    /** Drops the floating pixels without writing them; a lift's source stays erased. */
    run(ed) {
      ed.transact('Delete floating', (tx) => tx.setFloating(null));
      return true;
    },
  });
  c.register({
    id: 'floating.cancel', label: 'Cancel', isEnabled: hasFloat,
    run(ed) {
      const doc = ed.doc, f = doc.floating;
      if (!f) return false;
      ed.transact('Cancel', (tx) => {
        const origin = f.origin;
        if (f.mode === 'lift' && origin) {
          const layer = (f.sourceLayerId && doc.layerById(f.sourceLayerId)) || doc.activeLayer;
          const src = f.source || f;
          const restored = f.with({ rgba: src.rgba, width: src.width, height: src.height, x: origin.x, y: origin.y, dw: src.width, dh: src.height });
          tx.setSelection(stampFloating(tx, doc, restored, layer));
        }
        tx.setFloating(null);
      });
      return true;
    },
  });
}
