// @ts-check
/**
 * Tools are small state machines driven by pointer events in document
 * space. They never write pixels outside a transaction, and selection tools
 * only build masks that the `selection.combine` command merges.
 *
 * Pointer event: { x, y } in document pixels (floats), { ix, iy } the pixel,
 * inside, button (0 primary), shift, ctrl, alt, meta, pointerType, scale
 * (screen px per document px).
 */
import { Mask } from '../model/Mask.js';
import { bresenham, lineMask, rectMask, ellipseMask, polygonMask, floodMask, globalMask } from '../ops/raster.js';
import { tipOffsets, tipFromMask } from '../brush/tips.js';
import { over, erase, matcher } from '../color/rgba.js';
import { compositeAll } from '../render/composite.js';

/** @param {import('../core/Editor.js').Editor} ed @param {any} p */
export function selectModeFor(ed, p) {
  if (p.shift) return 'add';
  if (p.ctrl || p.meta) return 'remove';
  return ed.selection.mode;
}

/** @param {import('../core/Editor.js').Editor} ed */
export function currentTip(ed) {
  const b = ed.brush;
  return b.tip === 'custom' && b.customTip ? b.customTip : tipOffsets(b.tip === 'custom' ? 'square' : b.tip, b.size);
}

/** Mirror partners of a pixel under the brush's mirror mode. @param {import('../core/Editor.js').Editor} ed @param {number} x @param {number} y */
export function mirrorPoints(ed, x, y) {
  const b = ed.brush, doc = ed.doc;
  const ax = b.mirrorAxis ? b.mirrorAxis.x2 : doc.width, ay = b.mirrorAxis ? b.mirrorAxis.y2 : doc.height;
  const pts = [x, y];
  const h = b.mirror === 'horizontal' || b.mirror === 'both', v = b.mirror === 'vertical' || b.mirror === 'both';
  if (h) pts.push(ax - x - 1, y);
  if (v) pts.push(x, ay - y - 1);
  if (h && v) pts.push(ax - x - 1, ay - y - 1);
  return pts;
}

// ---------------------------------------------------------------- pencil

export class PencilTool {
  /** @param {import('../core/Editor.js').Editor} ed */
  constructor(ed) {
    this.id = 'pencil';
    this.ed = ed;
    /** @type {any} */
    this.s = null;
    /** @type {any} */
    this.hover = null;
    this.picking = false;
  }

  cursor() { return 'crosshair'; }

  /** @param {any} p */
  down(p) {
    if (p.button !== 0) return;
    const ed = this.ed, doc = ed.doc, b = ed.brush;
    if (p.ctrl || p.meta) { this.picking = true; ed.run('color.pick', { x: p.ix, y: p.iy }); return; }
    const layer = doc.activeLayer;
    if (layer.locked) { ed.events.emit('status', { message: 'The active layer is locked' }); return; }
    if (doc.floating) ed.run('floating.commit');
    const offsets = currentTip(ed);
    this.s = {
      tx: ed.begin(b.blend === 'erase' ? 'Eraser' : 'Pencil', { gesture: true }),
      layer,
      stroke: new Mask(doc.width, doc.height),
      last: [p.ix, p.iy],
      offsets,
      perfect: b.pixelPerfect && offsets.length === 2,
      path: [],
      counts: new Map(),
      color: ed.colors.primary,
      op: Math.round(b.opacity * 255),
      blend: b.blend,
    };
    this.visit(p.ix, p.iy);
  }

  /** @param {any} p */
  move(p) {
    this.hover = p;
    if (this.picking) { this.ed.run('color.pick', { x: p.ix, y: p.iy }); return; }
    const s = this.s;
    if (!s) return;
    const [lx, ly] = s.last;
    if (lx === p.ix && ly === p.iy) return;
    let first = true;
    bresenham(lx, ly, p.ix, p.iy, (x, y) => {
      if (first) { first = false; return; }
      this.visit(x, y);
    });
    s.last = [p.ix, p.iy];
  }

  up() {
    this.picking = false;
    if (!this.s) return;
    this.s.tx.commit();
    this.s = null;
  }

  cancel() {
    this.picking = false;
    if (!this.s) return;
    this.s.tx.rollback();
    this.s = null;
  }

  /** One point of the stroke path. @param {number} x @param {number} y */
  visit(x, y) {
    const s = this.s;
    if (!s.perfect) { this.stampAt(x, y, 1); return; }
    s.path.push(x, y);
    this.stampAt(x, y, 1);
    const n = s.path.length;
    if (n >= 6) {
      const ax = s.path[n - 6], ay = s.path[n - 5], bx = s.path[n - 4], by = s.path[n - 3], cx = s.path[n - 2], cy = s.path[n - 1];
      const diagonal = Math.abs(ax - cx) === 1 && Math.abs(ay - cy) === 1;
      const corner = (bx === ax && by === cy) || (by === ay && bx === cx);
      if (diagonal && corner) {
        this.stampAt(bx, by, -1);
        s.path.splice(n - 4, 2);
      }
    }
  }

  /** @param {number} cx @param {number} cy @param {1|-1} sign paint or unpaint */
  stampAt(cx, cy, sign) {
    const s = this.s, off = s.offsets;
    for (let k = 0; k < off.length; k += 2) {
      const pts = mirrorPoints(this.ed, cx + off[k], cy + off[k + 1]);
      for (let m = 0; m < pts.length; m += 2) this.touch(pts[m], pts[m + 1], sign);
    }
  }

  /** @param {number} x @param {number} y @param {1|-1} sign */
  touch(x, y, sign) {
    const s = this.s, doc = this.ed.doc;
    if (x < 0 || y < 0 || x >= doc.width || y >= doc.height) return;
    const i = y * doc.width + x;
    if (s.perfect) {
      const n = (s.counts.get(i) || 0) + sign;
      s.counts.set(i, n);
      if (sign < 0) {
        if (n <= 0 && s.stroke.get(i)) {
          s.stroke.unset(i);
          s.tx.setColor(s.layer, i, s.tx.baseColor(s.layer, i));
        }
        return;
      }
    }
    if (s.stroke.get(i)) return;
    s.stroke.set(i);
    const base = s.tx.baseColor(s.layer, i);
    let next;
    if (s.blend === 'erase') next = erase(base, s.op);
    else if (s.blend === 'replace') next = s.op >= 255 ? s.color : over(0, s.color, s.op);
    else next = over(base, s.color, s.op);
    if (next !== s.layer.getColor(i)) s.tx.setColor(s.layer, i, next);
  }

  overlay() {
    const h = this.hover;
    if (!h || !h.inside) return [];
    const items = [];
    const off = currentTip(this.ed);
    const pts = mirrorPoints(this.ed, h.ix, h.iy);
    for (let m = 0; m < pts.length; m += 2) items.push({ kind: 'footprint', x: pts[m], y: pts[m + 1], offsets: off, mirrored: m > 0 });
    return items;
  }
}

// ---------------------------------------------------------------- picker, mirror axis

export class PickerTool {
  /** @param {import('../core/Editor.js').Editor} ed */
  constructor(ed) { this.id = 'picker'; this.ed = ed; this.active = false; }
  cursor() { return 'copy'; }
  /** @param {any} p */
  down(p) { if (p.button !== 0) return; this.active = true; this.pick(p); }
  /** @param {any} p */
  move(p) { if (this.active) this.pick(p); }
  up() { this.active = false; }
  cancel() { this.active = false; }
  /** @param {any} p */
  pick(p) { if (p.inside) this.ed.run('color.pick', { x: p.ix, y: p.iy, layerOnly: p.alt }); }
  overlay() { return []; }
}

export class MirrorAxisTool {
  /** @param {import('../core/Editor.js').Editor} ed */
  constructor(ed) { this.id = 'mirror-axis'; this.ed = ed; }
  cursor() { return 'crosshair'; }
  /**
   * Axes snap to the nearest half pixel: a tap near a pixel's centre puts
   * them through that pixel, near its edge between two pixels, so both odd
   * and even shapes mirror exactly. Stored doubled (x2 = 2 * axis).
   * @param {any} p
   */
  down(p) {
    if (p.button !== 0 || !p.inside) return;
    const doc = this.ed.doc;
    const x2 = Math.max(1, Math.min(2 * doc.width - 1, Math.round(p.x * 2)));
    const y2 = Math.max(1, Math.min(2 * doc.height - 1, Math.round(p.y * 2)));
    this.ed.setBrush({ mirrorAxis: { x2, y2 }, mirror: this.ed.brush.mirror === 'none' ? 'both' : this.ed.brush.mirror });
  }
  move() {}
  up() {}
  cancel() {}
  overlay() { return []; }
}

// ---------------------------------------------------------------- move

export class MoveTool {
  /** @param {import('../core/Editor.js').Editor} ed */
  constructor(ed) { this.id = 'move'; this.ed = ed; }
  cursor() { return 'move'; }
  /**
   * What the view should do with this drag: 'floating' drags the floating
   * layer (lifting the selection first when the drag starts inside it; Alt
   * lifts a copy), 'pan' pans the view.
   * @param {any} p @returns {'floating'|'pan'|void}
   */
  down(p) {
    const ed = this.ed, doc = ed.doc;
    if (p.button !== 0) return;
    if (doc.floating) return 'floating';
    if (p.inside && doc.selection.has(p.ix, p.iy)) {
      if (ed.run('selection.lift', { duplicate: !!p.alt })) return 'floating';
    }
    return 'pan';
  }
  move() {}
  up() {}
  cancel() {}
  overlay() { return []; }
}

// ---------------------------------------------------------------- selection tools

class ShapeSelectTool {
  /** @param {import('../core/Editor.js').Editor} ed @param {'line'|'rect'|'ellipse'} shape */
  constructor(ed, shape) {
    this.id = `select-${shape}`;
    this.shape = shape;
    this.ed = ed;
    /** @type {any} */ this.anchor = null;
    /** @type {any} */ this.current = null;
    /** @type {any} */ this.hover = null;
    this.dragging = false;
    this.moved = false;
    /** @type {'replace'|'add'|'remove'} */
    this.mode = 'replace';
    this.startShift = false;
    /** @type {any} */ this.cache = null;
  }

  cursor() { return 'crosshair'; }

  /** @param {any} p */
  down(p) {
    if (p.button !== 0) return;
    if (!this.anchor) {
      this.anchor = [p.ix, p.iy];
      this.current = [p.ix, p.iy];
      this.mode = selectModeFor(this.ed, p);
      this.startShift = !!p.shift;
      this.dragging = true;
      this.moved = false;
    } else {
      this.current = [p.ix, p.iy];
      this.finish(p);
    }
  }

  /** @param {any} p */
  move(p) {
    this.hover = p;
    if (!this.anchor) return;
    this.current = [p.ix, p.iy];
    if (this.dragging && (p.ix !== this.anchor[0] || p.iy !== this.anchor[1])) this.moved = true;
    this.lastMods = { alt: p.alt, shift: p.shift };
  }

  /** @param {any} p */
  up(p) {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.moved) this.finish(p);
  }

  cancel() { this.anchor = null; this.dragging = false; this.cache = null; }

  /** @param {any} p */
  finish(p) {
    const mask = this.build(p);
    const labels = { line: 'Select line', rect: 'Select rectangle', ellipse: 'Select ellipse' };
    this.anchor = null;
    this.cache = null;
    this.ed.run('selection.combine', { mask, mode: this.mode, label: labels[this.shape] });
  }

  /** @param {any} [mods] */
  build(mods = this.lastMods || {}) {
    const doc = this.ed.doc, [ax, ay] = this.anchor;
    let [bx, by] = this.current;
    const constrain = mods.shift && !this.startShift, fromCentre = !!mods.alt;
    if (this.shape === 'line') {
      if (constrain) {
        const dx = bx - ax, dy = by - ay, ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
        const len = Math.max(Math.abs(dx), Math.abs(dy));
        bx = ax + Math.round(Math.cos(ang) * len);
        by = ay + Math.round(Math.sin(ang) * len);
      }
      return lineMask(doc.width, doc.height, ax, ay, bx, by, currentTip(this.ed));
    }
    let x0 = ax, y0 = ay;
    if (constrain) {
      const s = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
      bx = ax + Math.sign(bx - ax || 1) * s;
      by = ay + Math.sign(by - ay || 1) * s;
    }
    if (fromCentre) { x0 = 2 * ax - bx; y0 = 2 * ay - by; }
    return this.shape === 'rect' ? rectMask(doc.width, doc.height, x0, y0, bx, by) : ellipseMask(doc.width, doc.height, x0, y0, bx, by);
  }

  overlay() {
    if (!this.anchor) return [];
    const key = `${this.anchor}|${this.current}|${this.mode}|${JSON.stringify(this.lastMods || {})}|${this.ed.doc.selection.version}`;
    if (!this.cache || this.cache.key !== key) {
      const shape = this.build();
      const result = this.ed.doc.selection.clone().combine(shape, this.mode);
      this.cache = { key, items: [{ kind: 'mask', mask: result, preview: true }, { kind: 'anchor', x: this.anchor[0], y: this.anchor[1] }] };
    }
    return this.cache.items;
  }
}

class PathSelectTool {
  /** @param {import('../core/Editor.js').Editor} ed */
  constructor(ed) {
    this.id = 'select-path';
    this.ed = ed;
    /** @type {number[]} */ this.points = [];
    this.dragging = false;
    this.polygon = false;
    /** @type {'replace'|'add'|'remove'} */
    this.mode = 'replace';
    /** @type {any} */ this.hover = null;
    this.lastTap = 0;
  }

  cursor() { return 'crosshair'; }

  /** @param {any} p */
  down(p) {
    if (p.button !== 0) return;
    if (this.polygon) {
      const pts = this.points, n = pts.length, s = p.scale || 1;
      const nearFirst = Math.hypot(p.x - pts[0], p.y - pts[1]) * s < 10;
      // A double-click is two clicks close in time *and* place; two quick clicks far apart are two vertices.
      const now = Date.now(), dbl = now - this.lastTap < 350 && Math.hypot(p.x - pts[n - 2], p.y - pts[n - 1]) * s < 8;
      this.lastTap = now;
      if ((nearFirst || dbl) && n >= 6) { this.finish(); return; }
      if (dbl) return; // too few vertices to close: ignore the repeated click
      pts.push(p.x, p.y);
      return;
    }
    this.mode = selectModeFor(this.ed, p);
    this.points = [p.x, p.y];
    this.dragging = true;
    this.lastTap = Date.now();
  }

  /** @param {any} p */
  move(p) {
    this.hover = p;
    if (!this.dragging) return;
    const n = this.points.length;
    if (Math.hypot(p.x - this.points[n - 2], p.y - this.points[n - 1]) >= 0.5) this.points.push(p.x, p.y);
  }

  up() {
    if (!this.dragging) return;
    this.dragging = false;
    let length = 0;
    for (let k = 2; k < this.points.length; k += 2) length += Math.hypot(this.points[k] - this.points[k - 2], this.points[k + 1] - this.points[k - 1]);
    if (this.points.length >= 6 && length > 2) this.finish();
    else { this.polygon = true; this.points = this.points.slice(0, 2); }
  }

  /** @param {string} key */
  key(key) {
    if (key === 'Enter' && this.points.length >= 6) { this.finish(); return true; }
    return false;
  }

  cancel() { this.points = []; this.dragging = false; this.polygon = false; }

  finish() {
    const doc = this.ed.doc;
    const mask = polygonMask(doc.width, doc.height, this.points);
    this.points = [];
    this.polygon = false;
    this.ed.run('selection.combine', { mask, mode: this.mode, label: 'Select path' });
  }

  overlay() {
    if (!this.points.length) return [];
    const pts = this.points.slice();
    if (this.polygon && this.hover) pts.push(this.hover.x, this.hover.y);
    return [{ kind: 'polyline', points: pts, closed: this.dragging }];
  }
}

/**
 * Sampling helper shared by the two colour selectors.
 * @param {any} ed @param {number} x @param {number} y
 */
function colorSampler(ed, x, y) {
  const doc = ed.doc, s = ed.selection, i = y * doc.width + x;
  if (s.sample === 'composite') {
    const rgba = compositeAll(doc, null, { includeFloating: false });
    const m = matcher(rgba[i], s.threshold, s.metric), cache = new Map();
    return (j) => {
      const c = rgba[j];
      let r = cache.get(c);
      if (r === undefined) cache.set(c, (r = m(c)));
      return r;
    };
  }
  const layer = doc.activeLayer, pal = layer.palette, idx = layer.indices;
  const m = matcher(layer.getColor(i), s.threshold, s.metric);
  const ok = new Uint8Array(pal.length);
  for (let k = 0; k < pal.length; k++) ok[k] = m(pal.colors[k]) ? 1 : 0;
  return (j) => ok[idx[j]] === 1;
}

class ColorSelectTool {
  /** @param {import('../core/Editor.js').Editor} ed @param {boolean} contiguous */
  constructor(ed, contiguous) {
    this.id = contiguous ? 'select-area' : 'select-color';
    this.contiguous = contiguous;
    this.ed = ed;
  }
  cursor() { return 'crosshair'; }
  /** @param {any} p */
  down(p) {
    if (p.button !== 0 || !p.inside) return;
    const doc = this.ed.doc, test = colorSampler(this.ed, p.ix, p.iy);
    const mask = this.contiguous
      ? floodMask(doc.width, doc.height, p.ix, p.iy, test, this.ed.selection.connectivity)
      : globalMask(doc.width, doc.height, test);
    this.ed.run('selection.combine', { mask, mode: selectModeFor(this.ed, p), label: this.contiguous ? 'Select area' : 'Select colour' });
  }
  move() {}
  up() {}
  cancel() {}
  overlay() { return []; }
}

/**
 * Selection brush: the pencil's stamp engine (tip, size, mirror) writing
 * into a mask; the mask joins the selection when the stroke ends.
 */
class SelectBrushTool {
  /** @param {import('../core/Editor.js').Editor} ed */
  constructor(ed) {
    this.id = 'select-brush';
    this.ed = ed;
    /** @type {any} */ this.s = null;
    /** @type {any} */ this.hover = null;
  }
  cursor() { return 'crosshair'; }
  /** @param {any} p */
  down(p) {
    if (p.button !== 0) return;
    const doc = this.ed.doc;
    this.s = { mask: new Mask(doc.width, doc.height), mode: selectModeFor(this.ed, p), last: [p.ix, p.iy], offsets: currentTip(this.ed) };
    this.stamp(p.ix, p.iy);
  }
  /** @param {any} p */
  move(p) {
    this.hover = p;
    const s = this.s;
    if (!s) return;
    const [lx, ly] = s.last;
    if (lx === p.ix && ly === p.iy) return;
    bresenham(lx, ly, p.ix, p.iy, (x, y) => this.stamp(x, y));
    s.last = [p.ix, p.iy];
  }
  /** @param {number} cx @param {number} cy */
  stamp(cx, cy) {
    const s = this.s, off = s.offsets, m = s.mask, doc = this.ed.doc;
    for (let k = 0; k < off.length; k += 2) {
      const pts = mirrorPoints(this.ed, cx + off[k], cy + off[k + 1]);
      for (let j = 0; j < pts.length; j += 2) {
        const x = pts[j], y = pts[j + 1];
        if (x >= 0 && y >= 0 && x < doc.width && y < doc.height) m.set(y * doc.width + x);
      }
    }
  }
  up() {
    const s = this.s;
    if (!s) return;
    this.s = null;
    if (!s.mask.isEmpty()) this.ed.run('selection.combine', { mask: s.mask, mode: s.mode, label: 'Select brush' });
  }
  cancel() { this.s = null; }
  overlay() {
    const items = [];
    if (this.s) items.push({ kind: 'mask', mask: this.ed.doc.selection.clone().combine(this.s.mask, this.s.mode), preview: true });
    const h = this.hover;
    if (h && h.inside) {
      const off = currentTip(this.ed), pts = mirrorPoints(this.ed, h.ix, h.iy);
      for (let m = 0; m < pts.length; m += 2) items.push({ kind: 'footprint', x: pts[m], y: pts[m + 1], offsets: off, mirrored: m > 0, outlineOnly: true });
    }
    return items;
  }
}

/** @param {import('../core/Editor.js').Editor} ed */
export function createTools(ed) {
  const tools = [
    new PencilTool(ed), new PickerTool(ed), new MoveTool(ed), new MirrorAxisTool(ed),
    new PathSelectTool(ed), new ColorSelectTool(ed, false), new ColorSelectTool(ed, true),
    new ShapeSelectTool(ed, 'line'), new ShapeSelectTool(ed, 'rect'), new ShapeSelectTool(ed, 'ellipse'),
    new SelectBrushTool(ed),
  ];
  return new Map(tools.map((t) => [t.id, t]));
}

export { tipFromMask };
