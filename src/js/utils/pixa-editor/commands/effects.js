// @ts-check
/**
 * Effects, filters and colour reduction. Each is declared once with a
 * `compute` step; `run` and `preview` are derived from it, so the preview
 * shows exactly what the commit will write. With a selection, the result is
 * limited to it.
 */
import { usageIn, applyPalette, applyPixels, palettePreview, pixelPreview } from '../ops/apply.js';
import { autoContrast, autoSaturation, colorToAlpha, reduceColors, recolor, hslNudge, replaceColor } from '../ops/color-ops.js';
import { smooth, vignette } from '../ops/pixel-ops.js';
import { applyFilter, FILTER_NAMES } from '../ops/filters.js';
import { fromHex } from '../color/rgba.js';

/**
 * Colour argument: a packed colour, a hex string, or 'primary' / 'secondary'.
 * @param {import('../core/Editor.js').Editor} ed @param {any} v @param {number} fallback
 */
export function colorArg(ed, v, fallback) {
  if (v === undefined || v === null) return fallback >>> 0;
  if (v === 'primary') return ed.colors.primary >>> 0;
  if (v === 'secondary') return ed.colors.secondary >>> 0;
  if (typeof v === 'string') return fromHex(v);
  return v >>> 0;
}

/**
 * @typedef {{ id: string, label: string, kind: 'palette'|'pixels', selectionOnly?: boolean,
 *   defaults?: object, enabledWhen?: (editor: any, layer: any, args: any) => boolean,
 *   compute: (editor: any, layer: any, mask: any, args: any) => Uint32Array,
 *   worker?: (editor: any, layer: any, mask: any, args: any) => { op: string, args: any[] } | null }} EffectDef
 * `worker` describes the same computation as a worker job; previews use it on
 * big documents so the page stays responsive.
 */

/** Target layer and mask for an effect. @param {import('../core/Editor.js').Editor} editor @param {boolean} [selectionOnly] */
export function effectTarget(editor, selectionOnly = false) {
  const doc = editor.doc, layer = doc.activeLayer;
  const sel = doc.selection.isEmpty() ? null : doc.selection;
  if (selectionOnly && !sel) return null;
  return { layer, mask: sel };
}

/** @param {import('../core/Editor.js').Editor} editor @param {EffectDef} def */
export function registerEffect(editor, def) {
  const enabled = (/** @type {any} */ ed, /** @type {any} */ args) => {
    const t = effectTarget(ed, def.selectionOnly);
    return !!t && !t.layer.locked && !ed.doc.floating && (!def.enabledWhen || def.enabledWhen(ed, t.layer, args || {}));
  };
  const prepare = (/** @type {any} */ ed, /** @type {any} */ args) => {
    const t = /** @type {any} */ (effectTarget(ed, def.selectionOnly));
    return { layer: t.layer, mask: t.mask, a: { ...(def.defaults || {}), ...args } };
  };
  const apply = (/** @type {any} */ ed, /** @type {any} */ p, /** @type {Uint32Array} */ out) => {
    ed.transact(def.label, (/** @type {any} */ tx) => {
      if (def.kind === 'palette') applyPalette(tx, p.layer, p.mask, out);
      else applyPixels(tx, p.layer, p.mask, out);
    });
  };
  // Everything the result depends on, so a cached preview is reused only when it still applies.
  const keyOf = (/** @type {any} */ ed, /** @type {any} */ p) => JSON.stringify([p.a, p.layer.id, p.layer.revision, p.mask ? p.mask.version : -1, ed.colors.primary, ed.colors.secondary]);

  editor.commands.register({
    id: def.id,
    label: def.label,
    isEnabled: enabled,
    run(ed, args) {
      const p = prepare(ed, args);
      apply(ed, p, def.compute(ed, p.layer, p.mask, p.a));
      return true;
    },
    preview(ed, args) {
      let current = { ...args }, token = 0, closed = false;
      /** @type {{ key: string, out: Uint32Array } | null} */
      let cache = null;
      const show = (/** @type {any} */ p, /** @type {Uint32Array} */ out) => {
        const shown = ed.capPreview(def.kind, p.layer, p.mask, out);
        ed.setOverride(def.kind === 'palette' ? palettePreview(p.layer, p.mask, shown) : pixelPreview(p.layer, p.mask, shown));
      };
      const refresh = () => {
        if (closed) return;
        const p = prepare(ed, current), key = keyOf(ed, p), t = ++token;
        if (cache && cache.key === key) { show(p, cache.out); return; }
        const heavy = def.kind === 'pixels' ? ed.doc.width * ed.doc.height >= ed.options.minWorkerPixels : true;
        const pool = ed.pool;
        const job = pool && def.worker && heavy ? def.worker(ed, p.layer, p.mask, p.a) : null;
        if (!pool || !job) {
          cache = { key, out: def.compute(ed, p.layer, p.mask, p.a) };
          show(p, cache.out);
          return;
        }
        session.pending = true;
        ed.events.emit('preview', { id: def.id, active: true, pending: true });
        pool.run(job.op, job.args).then((/** @type {Uint32Array} */ out) => {
          if (closed || t !== token) return;
          cache = { key, out };
          session.pending = false;
          show(p, out);
          ed.events.emit('preview', { id: def.id, active: true, pending: false });
        }, (/** @type {any} */ error) => {
          if (closed || t !== token) return;
          session.pending = false;
          ed.events.emit('error', { source: def.id, error });
        });
      };
      const offColors = ed.events.on('colors', refresh);
      const close = () => { closed = true; offColors(); ed.endPreview(session); };
      const session = {
        id: def.id,
        pending: false,
        get args() { return current; },
        /** @param {object} next */
        update(next) { current = { ...current, ...next }; refresh(); },
        /** One undo step; reuses the preview's result when it still applies. */
        commit() {
          close();
          if (!ed.can(def.id, current)) return false;
          const p = prepare(ed, current);
          if (cache && cache.key === keyOf(ed, p)) {
            apply(ed, p, cache.out);
            ed.events.emit('command', { id: def.id, args: current });
            return true;
          }
          return ed.run(def.id, current);
        },
        cancel() { close(); },
      };
      ed.beginPreview(session);
      refresh();
      return session;
    },
  });
}

/** Arguments of reduceColors for a layer (and selection). @param {any} layer @param {any} mask @param {any} a @returns {[Uint32Array, Uint32Array, number|'auto']} */
function reduceArgs(layer, mask, a) {
  const usage = usageIn(layer, mask);
  let used = 0;
  for (let i = 1; i < usage.length; i++) if (usage[i] && layer.palette.colors[i] >>> 24) used++;
  const target = a.keep === 'auto' ? 'auto' : a.keep < 1 ? Math.max(1, Math.round(a.keep * used)) : a.keep;
  return [layer.palette.view().slice(), usage, target];
}

/** @param {import('../core/Editor.js').Editor} ed @param {any} a */
const vignetteArgs = (ed, a) => ({ color: colorArg(ed, a.color, ed.colors.primary), intensity: a.intensity, rings: a.rings, dither: a.dither });

/** @param {import('../core/Editor.js').Editor} editor */
export function registerEffects(editor) {
  const pal = (layer) => layer.palette.view().slice();
  /** @type {EffectDef[]} */
  const defs = [
    {
      id: 'effect.autoContrast', label: 'Increase contrast', kind: 'palette', defaults: { intensity: 1 },
      compute: (ed, layer, mask, a) => autoContrast(pal(layer), usageIn(layer, mask), a.intensity),
    },
    {
      id: 'effect.autoSaturation', label: 'Increase saturation', kind: 'palette', defaults: { intensity: 1 },
      compute: (ed, layer, mask, a) => autoSaturation(pal(layer), usageIn(layer, mask), a.intensity),
    },
    {
      id: 'effect.colorToAlpha', label: 'Colour to alpha', kind: 'palette', defaults: { intensity: 1 },
      compute: (ed, layer, mask, a) => colorToAlpha(pal(layer), colorArg(ed, a.color, ed.colors.primary), a.intensity),
    },
    {
      id: 'palette.reduce', label: 'Remove colours', kind: 'palette', defaults: { keep: 'auto' },
      enabledWhen: (ed, layer) => layer.colorCount() >= 2,
      compute: (ed, layer, mask, a) => reduceColors(...reduceArgs(layer, mask, a)),
      // k-means over thousands of colours takes a moment: previews run it in the worker.
      worker: (ed, layer, mask, a) => (layer.palette.length > 1024 ? { op: 'reduceColors', args: reduceArgs(layer, mask, a) } : null),
    },
    {
      id: 'filter.apply', label: 'Filter', kind: 'palette', defaults: { name: FILTER_NAMES[0], intensity: 1 },
      compute: (ed, layer, mask, a) => applyFilter(pal(layer), a.name, a.intensity),
    },
    {
      id: 'selection.recolor', label: 'Colorize dynamical', kind: 'palette', selectionOnly: true, defaults: { strength: 1 },
      compute: (ed, layer, mask, a) => recolor(pal(layer), usageIn(layer, mask), colorArg(ed, a.target, ed.colors.primary), a.strength),
    },
    {
      id: 'selection.lightness', label: 'Lightness', kind: 'palette', selectionOnly: true, defaults: { delta: 10 },
      compute: (ed, layer, mask, a) => hslNudge(pal(layer), 0, a.delta),
    },
    {
      id: 'selection.saturation', label: 'Saturation', kind: 'palette', selectionOnly: true, defaults: { delta: 10 },
      compute: (ed, layer, mask, a) => hslNudge(pal(layer), a.delta, 0),
    },
    {
      id: 'effect.smooth', label: 'Smooth', kind: 'pixels', defaults: { rounds: 1 },
      compute: (ed, layer, mask, a) => smooth(layer.toRGBA(), layer.width, layer.height, a.rounds),
      worker: (ed, layer, mask, a) => ({ op: 'smooth', args: [layer.toRGBA(), layer.width, layer.height, a.rounds] }),
    },
    {
      id: 'effect.vignette', label: 'Vignette', kind: 'pixels', defaults: { intensity: 0.5, rings: 6, dither: false },
      compute: (ed, layer, mask, a) => vignette(layer.toRGBA(), layer.width, layer.height, vignetteArgs(ed, a)),
      worker: (ed, layer, mask, a) => ({ op: 'vignette', args: [layer.toRGBA(), layer.width, layer.height, vignetteArgs(ed, a)] }),
    },
  ];
  for (const d of defs) registerEffect(editor, d);

  // Replace color (context menu): that pixel's colour becomes the primary colour across the layer.
  editor.commands.register({
    id: 'color.replace',
    label: 'Replace color',
    isEnabled: (ed, a) => {
      const l = ed.doc.activeLayer;
      if (!l || l.locked || a.x === undefined) return false;
      const c = l.getColor(a.y * ed.doc.width + a.x);
      return c !== ed.colors.primary;
    },
    run(ed, a) {
      const l = ed.doc.activeLayer, from = l.getColor(a.y * ed.doc.width + a.x);
      ed.transact('Replace color', (tx) => tx.replacePalette(l, replaceColor(l.palette.view().slice(), from, ed.colors.primary)));
      return true;
    },
  });
}

export { FILTER_NAMES };
