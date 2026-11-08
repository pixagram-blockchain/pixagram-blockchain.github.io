// @ts-check
/**
 * The context menu as plain data, with pixa.pics' sections, items, labels and
 * visibility rules. Every item is a command id plus arguments, so a host
 * renders the model however it likes and runs `editor.run(item.id, item.args)`
 * on pick. The toolbox, a command palette and the tests reuse the same model.
 */
import { toHex } from '../color/rgba.js';

/** Section titles in display order. */
export const MENU_SECTIONS = ['Tools', 'Mirror mode', 'Apply to selection', 'Color', 'Effect'];

/**
 * @typedef {{ kind: 'item', id: string, label: string, icon: string, args: object, enabled: boolean, swatch?: string, checked?: boolean }} MenuItem
 * @typedef {{ kind: 'header', text: string }} MenuHeader
 * @typedef {{ kind: 'section', title: string, items: MenuItem[] }} MenuSection
 */

/**
 * @param {import('../core/Editor.js').Editor} editor
 * @param {{ x: number, y: number } | null} pixel document pixel under the pointer, or null when off the art
 * @returns {Array<MenuHeader | MenuSection>}
 */
export function buildContextMenu(editor, pixel) {
  const ed = editor, doc = ed.doc, b = ed.brush;
  const inside = !!pixel && pixel.x >= 0 && pixel.y >= 0 && pixel.x < doc.width && pixel.y < doc.height;
  /** @param {string} id @param {string} label @param {string} icon @param {object} [args] @param {boolean} [extra] @returns {MenuItem} */
  const item = (id, label, icon, args = {}, extra = true) => ({ kind: 'item', id, label, icon, args, enabled: extra && ed.can(id, args) });

  /** @type {Array<MenuHeader | MenuSection>} */
  const model = [{ kind: 'header', text: inside ? `X: ${/** @type {any} */ (pixel).x}, Y: ${/** @type {any} */ (pixel).y}` : 'out' }];

  // Tools and mirror mode: when the mirror tool is active or a mirror mode is on.
  if (ed.activeToolId === 'mirror-axis' || b.mirror !== 'none') {
    const pencilOn = ed.activeToolId === 'pencil';
    model.push({
      kind: 'section', title: 'Tools', items: [
        { ...item('tool.use', 'Pencil', 'pencil', { id: 'pencil', pixelPerfect: false }, !(pencilOn && !b.pixelPerfect)), checked: pencilOn && !b.pixelPerfect },
        { ...item('tool.use', 'Pencil perfect', 'pencil-perfect', { id: 'pencil', pixelPerfect: true }, !(pencilOn && b.pixelPerfect)), checked: pencilOn && b.pixelPerfect },
      ],
    });
    model.push({
      kind: 'section', title: 'Mirror mode', items: [
        ['none', 'None', 'mirror-none'], ['vertical', 'Vertical', 'mirror-vertical'],
        ['horizontal', 'Horizontal', 'mirror-horizontal'], ['both', 'Both', 'mirror-both'],
      ].map(([mode, label, icon]) => ({ ...item('pencil.mirror', label, icon, { mode }), checked: b.mirror === mode })),
    });
  }

  // Apply to selection: when something is selected.
  if (!doc.selection.isEmpty()) {
    model.push({
      kind: 'section', title: 'Apply to selection', items: [
        item('selection.clear', 'Unselect', 'select-clear'),
        item('selection.recolor', 'Colorize dynamical', 'colorize', { target: 'primary' }),
        item('selection.averageColor', 'Get average color', 'average'),
        item('selection.shrink', 'Shrink', 'select-shrink', { by: 1 }),
        item('selection.grow', 'Grow', 'select-grow', { by: 1 }),
        item('selection.border', 'Border', 'border'),
        item('selection.fill', 'Bucket', 'bucket'),
        item('selection.crop', 'Crop', 'crop'),
        item('selection.invert', 'Invert', 'select-invert'),
        item('selection.copy', 'Copy', 'copy'),
        item('selection.cut', 'Cut', 'cut'),
        item('selection.erase', 'Erase', 'erase'),
      ],
    });
  }

  // Color: when the pointer is over the art.
  if (inside) {
    const p = /** @type {{x: number, y: number}} */ (pixel);
    const here = doc.compositeAt(p.x, p.y), primary = ed.colors.primary >>> 0;
    model.push({
      kind: 'section', title: 'Color', items: [
        { ...item('color.pick', 'Pick color', 'picker', { x: p.x, y: p.y }, here !== primary), swatch: toHex(here) },
        { ...item('color.replace', 'Replace color', 'replace', { x: p.x, y: p.y }, here !== primary), swatch: toHex(primary) },
      ],
    });
  }

  // Effect: always.
  const colours = doc.activeLayer.colorCount();
  model.push({
    kind: 'section', title: 'Effect', items: [
      item('effect.autoContrast', 'Increase contrast', 'contrast', { intensity: 0.2 }),
      item('effect.autoSaturation', 'Increase saturation', 'saturation', { intensity: 0.2 }),
      item('ui.open', 'Add a filter', 'filter', { panel: 'filters' }),
      item('palette.reduce', 'Remove 10% of all colors', 'reduce', { keep: 0.9 }, colours >= 2),
      item('palette.reduce', 'Remove automatically some colors', 'reduce-auto', { keep: 'auto' }, colours >= 2),
      item('effect.smooth', 'Smooth a bit', 'smooth', { rounds: 1 }),
    ],
  });
  return model;
}

/** Flat list of items, for shortcuts and tests. @param {ReturnType<typeof buildContextMenu>} model */
export function menuItems(model) {
  /** @type {MenuItem[]} */
  const out = [];
  for (const s of model) if (s.kind === 'section') out.push(...s.items);
  return out;
}
