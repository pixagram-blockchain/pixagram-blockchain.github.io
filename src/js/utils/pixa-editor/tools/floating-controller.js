// @ts-check
/**
 * Drags and scales the floating layer, whatever tool is active (as in
 * pixa.pics, where import mode captures the pointer). One gesture = one
 * history entry.
 */
export class FloatingController {
  /** @param {import('../core/Editor.js').Editor} ed */
  constructor(ed) {
    this.ed = ed;
    /** @type {any} */ this.g = null;
  }

  /**
   * What the pointer is over: 'move', a handle ('n', 'se', ...) or null.
   * @param {any} p
   */
  hit(p) {
    const f = this.ed.doc.floating;
    if (!f) return null;
    const r = 8 / (p.scale || 1);
    const x0 = f.x, y0 = f.y, x1 = f.x + f.dw, y1 = f.y + f.dh;
    const nearX = (v) => Math.abs(p.x - v) <= r, nearY = (v) => Math.abs(p.y - v) <= r;
    const inX = p.x >= x0 - r && p.x <= x1 + r, inY = p.y >= y0 - r && p.y <= y1 + r;
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    if (nearX(x0) && nearY(y0)) return 'nw';
    if (nearX(x1) && nearY(y0)) return 'ne';
    if (nearX(x0) && nearY(y1)) return 'sw';
    if (nearX(x1) && nearY(y1)) return 'se';
    if (nearX(mx) && nearY(y0)) return 'n';
    if (nearX(mx) && nearY(y1)) return 's';
    if (nearX(x0) && nearY(my)) return 'w';
    if (nearX(x1) && nearY(my)) return 'e';
    if (p.x >= x0 && p.x < x1 && p.y >= y0 && p.y < y1) return 'move';
    if (inX && inY) return 'move';
    return null;
  }

  /** @param {any} p @param {string} kind */
  down(p, kind) {
    const f = this.ed.doc.floating;
    const tx = this.ed.begin(kind === 'move' ? 'Move' : 'Scale', { gesture: true });
    tx.setFloating(f);
    this.g = { tx, kind, orig: f, sx: p.x, sy: p.y, moved: false };
  }

  /** True once the current drag has changed the floating layer. */
  get moved() {
    return !!this.g?.moved;
  }

  /** @param {any} p */
  move(p) {
    const g = this.g;
    if (!g) return;
    const o = g.orig, dx = Math.round(p.x - g.sx), dy = Math.round(p.y - g.sy);
    if (dx || dy) g.moved = true;
    if (g.kind === 'move') {
      g.tx.setFloating(o.with({ x: o.x + dx, y: o.y + dy }));
      return;
    }
    let x = o.x, y = o.y, w = o.dw, h = o.dh;
    if (g.kind.includes('e')) w = o.dw + dx;
    if (g.kind.includes('s')) h = o.dh + dy;
    if (g.kind.includes('w')) { w = o.dw - dx; x = o.x + dx; }
    if (g.kind.includes('n')) { h = o.dh - dy; y = o.y + dy; }
    if (p.shift && g.kind.length === 2) {
      const k = Math.max(w / o.width, h / o.height);
      const nw = Math.max(1, Math.round(o.width * k)), nh = Math.max(1, Math.round(o.height * k));
      if (g.kind.includes('w')) x = o.x + o.dw - nw;
      if (g.kind.includes('n')) y = o.y + o.dh - nh;
      w = nw; h = nh;
    }
    // Snap to whole multiples of the source size: crisp pixel-art scaling.
    const snap = (v, base) => {
      const m = v / base, r = Math.round(m);
      return r >= 1 && Math.abs(m - r) < 0.15 ? r * base : v;
    };
    const sw = snap(Math.max(1, w), o.width), sh = snap(Math.max(1, h), o.height);
    if (g.kind.includes('w')) x += w - sw;
    if (g.kind.includes('n')) y += h - sh;
    g.tx.setFloating(o.with({ x, y, dw: sw, dh: sh }));
  }

  up() {
    if (!this.g) return;
    this.g.tx.commit();
    this.g = null;
  }

  cancel() {
    if (!this.g) return;
    this.g.tx.rollback();
    this.g = null;
  }

  get active() {
    return !!this.g;
  }
}
