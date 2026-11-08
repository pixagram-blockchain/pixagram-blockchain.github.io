// @ts-check
import { fromHex } from '../color/rgba.js';
import { tipFromMask } from '../brush/tips.js';

/** @param {import('../core/Editor.js').Editor} editor */
export function registerMiscCommands(editor) {
  const c = editor.commands;

  c.register({
    id: 'color.pick', label: 'Pick color',
    run(ed, a) {
      const doc = ed.doc;
      if (a.x < 0 || a.y < 0 || a.x >= doc.width || a.y >= doc.height) return false;
      const col = a.layerOnly ? doc.activeLayer.getColor(a.y * doc.width + a.x) : doc.compositeAt(a.x, a.y);
      ed.setColors({ primary: col });
      return col;
    },
  });
  c.register({
    id: 'color.swap', label: 'Swap colours',
    run(ed) { ed.setColors({ primary: ed.colors.secondary, secondary: ed.colors.primary }); },
  });
  c.register({
    id: 'color.set', label: 'Set colour',
    run(ed, a) { ed.setColors({ [a.which || 'primary']: typeof a.color === 'string' ? fromHex(a.color) : a.color }); },
  });

  c.register({ id: 'history.undo', label: 'Undo', isEnabled: (ed) => ed.history.canUndo(), run: (ed) => ed.undo() });
  c.register({ id: 'history.redo', label: 'Redo', isEnabled: (ed) => ed.history.canRedo(), run: (ed) => ed.redo() });

  c.register({
    id: 'tool.use', label: 'Tool',
    run(ed, a) {
      const { id, ...settings } = a;
      ed.useTool(id, Object.keys(settings).length ? settings : undefined);
    },
  });
  c.register({
    id: 'pencil.mirror', label: 'Mirror mode',
    isEnabled: (ed, a) => a.mode !== ed.brush.mirror,
    run(ed, a) { ed.setBrush({ mirror: a.mode }); },
  });
  c.register({
    id: 'brush.tipFromSelection', label: 'Use selection as tip',
    isEnabled: (ed) => !ed.doc.selection.isEmpty(),
    run(ed) { ed.setBrush({ tip: 'custom', customTip: tipFromMask(ed.doc.selection) }); },
  });
  c.register({
    id: 'document.new', label: 'New',
    run(ed, a) { ed.newDocument(a.width ?? 32, a.height ?? 32); },
  });
  c.register({
    id: 'ui.open', label: 'Open panel',
    run(ed, a) { ed.events.emit('ui', { open: a.panel }); },
  });
}
