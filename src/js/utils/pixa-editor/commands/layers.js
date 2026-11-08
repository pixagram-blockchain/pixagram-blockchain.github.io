// @ts-check
import { Layer } from '../model/Layer.js';
import { Mask } from '../model/Mask.js';
import { over, withAlpha } from '../color/rgba.js';
import { mirror, rotate } from '../ops/pixel-ops.js';
import { rotateReference } from '../model/Reference.js';

/** @param {import('../core/Editor.js').Editor} ed */
const noFloat = (ed) => !ed.doc.floating;

/** @param {import('../core/Editor.js').Editor} editor */
export function registerLayerCommands(editor) {
  const c = editor.commands;
  const nextName = (doc) => {
    let n = doc.layers.length + 1;
    while (doc.layers.some((l) => l.name === `Layer ${n}`)) n++;
    return `Layer ${n}`;
  };

  c.register({
    id: 'layer.create', label: 'New layer', isEnabled: noFloat,
    run(ed, a) {
      const doc = ed.doc;
      const layer = Layer.blank(doc.width, doc.height, a.name || nextName(doc));
      ed.transact('New layer', (tx) => {
        tx.structureWillChange();
        doc.layers.splice(doc.activeIndex + 1, 0, layer);
        doc.activeLayerId = layer.id;
      });
      return layer;
    },
  });
  c.register({
    id: 'layer.duplicate', label: 'Duplicate layer', isEnabled: noFloat,
    run(ed, a) {
      const doc = ed.doc, src = doc.activeLayer;
      const copy = src.clone({ name: a.name || `${src.name} (copy)` });
      ed.transact('Duplicate layer', (tx) => {
        tx.structureWillChange();
        doc.layers.splice(doc.activeIndex + 1, 0, copy);
        doc.activeLayerId = copy.id;
      });
      return copy;
    },
  });
  c.register({
    id: 'layer.delete', label: 'Delete layer', isEnabled: (ed) => ed.doc.layers.length > 1 && noFloat(ed),
    run(ed, a) {
      const doc = ed.doc, id = a.id || doc.activeLayerId, i = doc.indexOfLayer(id);
      if (i < 0) return false;
      ed.transact('Delete layer', (tx) => {
        tx.structureWillChange();
        doc.layers.splice(i, 1);
        if (doc.activeLayerId === id) doc.activeLayerId = doc.layers[Math.max(0, i - 1)].id;
      });
      return true;
    },
  });
  c.register({
    id: 'layer.move', label: 'Move layer',
    isEnabled: (ed, a) => {
      const doc = ed.doc, i = doc.indexOfLayer(a.id || doc.activeLayerId);
      const to = a.to ?? i + (a.by ?? 0);
      return i >= 0 && to !== i && to >= 0 && to < doc.layers.length;
    },
    run(ed, a) {
      const doc = ed.doc, i = doc.indexOfLayer(a.id || doc.activeLayerId), to = a.to ?? i + (a.by ?? 0);
      ed.transact('Move layer', (tx) => {
        tx.structureWillChange();
        const [l] = doc.layers.splice(i, 1);
        doc.layers.splice(to, 0, l);
      });
      return true;
    },
  });
  c.register({
    id: 'layer.mergeDown', label: 'Merge down', isEnabled: (ed) => ed.doc.activeIndex > 0 && noFloat(ed),
    run(ed) {
      const doc = ed.doc, i = doc.activeIndex, upper = doc.layers[i], lower = doc.layers[i - 1];
      const ou = Math.round(upper.opacity * 255), ol = lower.opacity;
      ed.transact('Merge down', (tx) => {
        tx.structureWillChange();
        const n = doc.width * doc.height;
        for (let p = 0; p < n; p++) {
          const lc = lower.getColor(p), uc = upper.getColor(p);
          const base = ol >= 1 ? lc : withAlpha(lc, (lc >>> 24) * ol);
          const out = uc ? over(base, uc, ou) : base;
          if (out !== lc) tx.setColor(lower, p, out);
        }
        lower.setProps({ opacity: 1, visible: lower.visible || upper.visible });
        doc.layers.splice(i, 1);
        doc.activeLayerId = lower.id;
      });
      return true;
    },
  });
  c.register({
    id: 'layer.mergeVisible', label: 'Merge visible',
    isEnabled: (ed) => ed.doc.layers.filter((l) => l.visible).length > 1 && noFloat(ed),
    run(ed) {
      const doc = ed.doc, visible = doc.layers.filter((l) => l.visible), target = visible[0];
      ed.transact('Merge visible', (tx) => {
        tx.structureWillChange();
        const n = doc.width * doc.height;
        for (let p = 0; p < n; p++) {
          let col = 0;
          for (const l of visible) col = over(col, l.getColor(p), Math.round(l.opacity * 255));
          if (col !== target.getColor(p)) tx.setColor(target, p, col);
        }
        target.setProps({ opacity: 1 });
        doc.layers = doc.layers.filter((l) => l === target || !l.visible);
        doc.activeLayerId = target.id;
      });
      return true;
    },
  });
  c.register({
    id: 'layer.set', label: 'Layer properties',
    run(ed, a) {
      const layer = ed.doc.layerById(a.id || ed.doc.activeLayerId);
      if (!layer) return false;
      const { id, label, merge, ...props } = a;
      ed.transact(label || 'Layer properties', (tx) => { tx.structureWillChange(); layer.setProps(props); }, merge === undefined ? undefined : { merge });
      return true;
    },
  });
  c.register({
    id: 'layer.select', label: 'Select layer',
    run(ed, a) {
      if (!ed.doc.layerById(a.id)) return false;
      ed.doc.activeLayerId = a.id;
      if (ed.doc.floating) ed.markAllDirty();
      ed.events.emit('layers', { reason: 'select' });
      return true;
    },
  });

  // Mirror: floating layer, else the selection's content, else the whole active layer.
  c.register({
    id: 'effect.mirror', label: 'Mirror',
    isEnabled: (ed) => !!ed.doc.floating || !ed.doc.activeLayer.locked,
    run(ed, a) {
      const axis = a.axis === 'y' ? 'y' : 'x', doc = ed.doc;
      if (doc.floating) {
        ed.transact('Mirror', (tx) => tx.setFloating(/** @type {any} */ (doc.floating).flipped(axis)));
        return true;
      }
      const layer = doc.activeLayer, W = doc.width, H = doc.height;
      const b = doc.selection.bounds();
      ed.transact(axis === 'x' ? 'Mirror horizontally' : 'Mirror vertically', (tx) => {
        if (!b) {
          const next = mirror(layer.indices, W, H, axis);
          for (let i = 0; i < next.length; i++) if (next[i] !== layer.indices[i]) tx.setIndex(layer, i, next[i]);
          return;
        }
        const sel = doc.selection, moved = [];
        const flip = (x, y) => (axis === 'x' ? [b.x0 + b.x1 - x, y] : [x, b.y0 + b.y1 - y]);
        sel.forEach((i) => moved.push(i, layer.getColor(i)));
        for (let k = 0; k < moved.length; k += 2) tx.setIndex(layer, moved[k], 0);
        const next = new Mask(W, H);
        for (let k = 0; k < moved.length; k += 2) {
          const i = moved[k], x = i % W, y = (i - x) / W, [nx, ny] = flip(x, y), j = ny * W + nx;
          tx.setColor(layer, j, moved[k + 1]);
          next.set(j);
        }
        tx.setSelection(next);
      });
      return true;
    },
  });

  // Rotate: the floating layer if any, else the whole document (every layer and the selection).
  c.register({
    id: 'effect.rotate', label: 'Rotate',
    run(ed, a) {
      const dir = a.dir === -1 ? -1 : 1, doc = ed.doc;
      if (doc.floating) {
        ed.transact('Rotate', (tx) => tx.setFloating(/** @type {any} */ (doc.floating).rotated(dir)));
        return true;
      }
      ed.transact(dir === 1 ? 'Rotate +90°' : 'Rotate −90°', (tx) => {
        tx.documentWillChange();
        const W = doc.width, H = doc.height;
        for (const l of doc.layers) l.replaceData(H, W, l.palette, rotate(l.indices, W, H, dir));
        const sel = new Mask(H, W);
        doc.selection.forEach((i) => {
          const x = i % W, y = (i - x) / W;
          const nx = dir === 1 ? H - 1 - y : y, ny = dir === 1 ? x : W - 1 - x;
          sel.set(ny * H + nx);
        });
        doc.width = H;
        doc.height = W;
        doc.selection = sel;
        doc.reference = rotateReference(doc.reference, dir, W, H);
        ed.resizeDirty();
      });
      return true;
    },
  });
}
