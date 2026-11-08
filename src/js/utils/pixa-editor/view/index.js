// @ts-check
/**
 * The canvas zone: a movable, zoomable view of the document plus all pointer,
 * wheel, touch and keyboard input. Importing this module lets
 * `editor.attach(element, options)` work; the core stays DOM-free.
 *
 * Three stacked screen-resolution canvases inside the zone element, each sized
 * in whole device pixels and placed on a whole device pixel:
 *   under  checkerboard behind the art
 *   art    the document, scaled with nearest-neighbour sampling from an
 *          offscreen document-resolution canvas that is updated tile by tile
 *          from the editor's dirty set
 *   over   grid, marching ants, brush footprint, tool previews, floating
 *          frame and handles, mirror axes
 * Drawing the art in screen pixels (rather than scaling a canvas with CSS) keeps
 * every art pixel exactly where the pointer maps it, at any device pixel ratio.
 */
import { Editor } from '../core/Editor.js';
import { Compositor } from '../render/composite.js';
import { buildContextMenu } from '../menus/context-menu.js';
import { tipOutline } from '../brush/tips.js';
import { currentTip } from '../tools/index.js';
import { toCss } from '../color/rgba.js';
import { TILE } from '../history/patches.js';
import { encodePNG } from '../io/png.js';

/**
 * @typedef {Object} ZoneOptions
 * @property {boolean} [overlay] draw the overlay (default true)
 * @property {boolean} [crispZoom] snap zoom to whole device pixels per art pixel when zoomed in (default true)
 * @property {boolean} [grid] pixel grid from 8 screen px per art pixel (default true)
 * @property {'builtin'|'event'} [menu] built-in context menu, or only the 'contextmenu' event (default 'builtin')
 * @property {boolean} [keyboard] shortcuts on the window (default true)
 * @property {'import'|'event'|false} [paste] images pasted from other apps: import as floating (default), only emit 'paste-image', or ignore
 * @property {'import'|'event'|false} [drop] dropped image or .pixa files: import as floating (default), only emit 'drop-file', or ignore
 * @property {boolean} [systemClipboard] Copy and Cut also write a PNG to the system clipboard (default true)
 * @property {{ checker?: [string, string], checkerSize?: number, grid?: string, accent?: string, frame?: string }} [theme]
 */

/** Tools whose drags may start outside the art (elsewhere, outside pans). */
const SELECTION_TOOLS = new Set(['select-rect', 'select-ellipse', 'select-line', 'select-path', 'select-brush']);
const HANDLE_CURSORS = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize', move: 'move' };
const TOOL_KEYS = { b: 'pencil', i: 'picker', v: 'move', m: 'select-rect', o: 'select-ellipse', l: 'select-path', w: 'select-area', u: 'select-line', s: 'select-brush' };

/** On macOS a Ctrl-click is the secondary click: it opens the menu instead of using the tool. */
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');

/** Keys that buttons, sliders, radios and lists use themselves when focused. */
const CONTROL_KEYS = new Set([' ', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);
const CONTROLS = 'button, input, select, textarea, a[href], summary, [contenteditable], [role="slider"], [role="radio"], [role="tab"], [role="option"], [role="menuitem"], [role="spinbutton"], [role="listbox"], [role="grid"], [role="tree"]';

/** @param {any} el */
const isTyping = (el) => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !['range', 'checkbox', 'radio', 'button', 'color'].includes(el.type));

/**
 * Decodes encoded image bytes for drawing.
 * @param {Uint8Array} bytes @param {string} mime @returns {Promise<any>} an ImageBitmap, or an image element
 */
async function decodePicture(bytes, mime) {
  const blob = new Blob([/** @type {BlobPart} */ (bytes)], { type: mime });
  if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
  const url = URL.createObjectURL(blob), img = new Image();
  try {
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export class CanvasZone {
  /** @param {import('../core/Editor.js').Editor} editor @param {HTMLElement} element @param {ZoneOptions} [o] */
  constructor(editor, element, o = {}) {
    this.ed = editor;
    this.el = element;
    this.o = { overlay: true, crispZoom: true, grid: true, menu: 'builtin', keyboard: true, ...o };
    this.theme = { checker: ['#cfcfcf', '#f4f4f4'], checkerSize: 8, grid: 'rgba(0,0,0,0.18)', accent: '#ffffff', frame: 'rgba(0,0,0,0.55)', ...(o.theme || {}) };
    this.dpr = globalThis.devicePixelRatio || 1;
    /** viewport: screen = t + doc * scale, in CSS px of the zone */
    this.scale = 1; this.tx = 0; this.ty = 0;
    this.autoFit = true;
    this.width = 0; this.height = 0;
    /** @type {Map<number, any>} */ this.pointers = new Map();
    /** @type {any} */ this.gesture = null;
    /** @type {any} */ this.hover = null;
    this.space = false;
    this.antsPhase = 0;
    this.lastAnts = 0;
    /** @type {any} */ this.outlineCache = null;
    /** @type {Map<any, any>} */ this.maskOutlines = new Map();
    /** @type {any} */ this.tipCache = null;
    this.frame = 0;
    this.needs = { under: true, art: true, ref: true, over: true };
    /** @type {Array<() => void>} */ this.cleanup = [];
    /** @type {any} */ this.menuEl = null;
    this.lastTap = { time: 0, x: 0, y: 0, entries: 0 };
    /** @type {any} */ this.longPress = null;
    /** @type {any} */ this.autoPan = null;
    /** @type {CanvasPattern | null} */ this.checker = null;
    /** Keeps the layers under the active one flattened, so strokes and previews redraw fast. */
    this.compositor = new Compositor();
    /** The decoded reference picture, for the bytes it came from. @type {{ bytes: Uint8Array, image: any } | null} */ this.refPic = null;
    this.suppressMenu = false;
    /** @type {any} */ this.pasteTimer = 0;
    /** @type {{x: number, y: number} | null} */ this.pasteAt = null;
    /** Offset that puts the canvases on whole device pixels when the zone sits between them. */
    this.shift = { x: 0, y: 0 };

    element.classList.add('pixa-zone');
    if (getComputedStyle(element).position === 'static') element.style.position = 'relative';
    Object.assign(element.style, { overflow: 'hidden', touchAction: 'none', userSelect: 'none' });
    if (!element.hasAttribute('tabindex')) element.tabIndex = 0;
    const mk = (cls) => {
      const c = document.createElement('canvas');
      c.className = cls;
      Object.assign(c.style, { position: 'absolute', left: '0', top: '0', pointerEvents: 'none' });
      element.appendChild(c);
      return c;
    };
    /** Empty box at the content origin, never shifted: where layout puts the zone's content. */
    this.probe = document.createElement('div');
    Object.assign(this.probe.style, { position: 'absolute', left: '0', top: '0', width: '0', height: '0', pointerEvents: 'none' });
    element.appendChild(this.probe);
    this.under = mk('pixa-under');
    /** Reference picture: moved before the art or before the overlay. */
    this.refCanvas = mk('pixa-reference');
    this.art = mk('pixa-art');
    this.over = mk('pixa-over');
    this.underCtx = /** @type {CanvasRenderingContext2D} */ (this.under.getContext('2d'));
    this.artCtx = /** @type {CanvasRenderingContext2D} */ (this.art.getContext('2d'));
    this.overCtx = /** @type {CanvasRenderingContext2D} */ (this.over.getContext('2d'));
    this.refCtx = /** @type {CanvasRenderingContext2D} */ (this.refCanvas.getContext('2d'));
    /** @type {any} */ this.drawnRef = undefined;
    /** The document at 1:1, the source of the art canvas. */
    this.src = document.createElement('canvas');
    this.srcCtx = /** @type {CanvasRenderingContext2D} */ (this.src.getContext('2d'));

    this.prevOnDirty = editor.onDirty;
    editor.onDirty = () => this.request();
    this.listen();
    this.resize();
    this.syncDocument(true);
  }

  // ------------------------------------------------------------ wiring

  listen() {
    const ed = this.ed, el = this.el;
    const on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); this.cleanup.push(() => target.removeEventListener(type, fn, opts)); };
    const redrawOver = () => this.request('over');
    for (const t of ['selection', 'floating', 'tool', 'brush', 'selection-settings', 'colors', 'preview']) this.cleanup.push(ed.events.on(t, redrawOver));
    this.cleanup.push(ed.events.on('document', (e) => this.syncDocument(!!e.replaced)));
    this.cleanup.push(ed.events.on('change', redrawOver));

    on(el, 'pointerdown', (e) => this.onDown(e));
    on(el, 'pointermove', (e) => this.onMove(e));
    on(el, 'pointerup', (e) => this.onUp(e));
    on(el, 'pointercancel', (e) => this.onUp(e, true));
    on(el, 'pointerleave', (e) => { if (!this.gesture && e.pointerType === 'mouse') { this.hover = null; this.ed.tool?.move?.({ ...this.toPointer(e), inside: false }); this.request('over'); } });
    on(el, 'wheel', (e) => this.onWheel(e), { passive: false });
    on(el, 'contextmenu', (e) => {
      e.preventDefault();
      if (this.suppressMenu) { this.suppressMenu = false; return; }
      if (this.gesture?.kind === 'pinch') return;
      this.openMenu(e.clientX, e.clientY);
    });
    on(el, 'dragover', (e) => { if (this.o.drop !== false) e.preventDefault(); });
    on(el, 'drop', (e) => this.onDrop(e));
    if (this.o.paste !== false) on(window, 'paste', (e) => this.onPaste(/** @type {ClipboardEvent} */ (e)));
    this.cleanup.push(ed.events.on('clipboard', (piece) => this.toSystemClipboard(piece)));
    this.cleanup.push(ed.events.on('reference', () => this.syncReference()));
    this.cleanup.push(ed.events.on('change', () => { if (this.drawnRef !== this.ed.doc.reference) this.syncReference(); }));
    if (this.o.keyboard) {
      on(window, 'keydown', (e) => this.onKey(e));
      on(window, 'keyup', (e) => { if (e.code === 'Space') { this.space = false; this.updateCursor(); } });
      on(window, 'blur', () => { this.space = false; });
    }
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => this.resize());
      ro.observe(el);
      this.cleanup.push(() => ro.disconnect());
    } else on(window, 'resize', () => this.resize());
    // Moving to a screen with another pixel ratio changes no CSS size: watch the ratio itself.
    if (typeof matchMedia === 'function') {
      /** @type {MediaQueryList | null} */ let mq = null;
      const onRatio = () => { this.resize(); watch(); };
      const watch = () => {
        mq?.removeEventListener('change', onRatio);
        mq = matchMedia(`(resolution: ${globalThis.devicePixelRatio || 1}dppx)`);
        mq.addEventListener('change', onRatio);
      };
      watch();
      this.cleanup.push(() => mq?.removeEventListener('change', onRatio));
    }
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    clearTimeout(this.pasteTimer);
    this.stopAutoPan();
    this.closeMenu();
    this.refPic?.image?.close?.();
    this.refPic = null;
    for (const f of this.cleanup) f();
    this.cleanup = [];
    this.ed.onDirty = this.prevOnDirty;
    for (const c of [this.probe, ...this.canvases()]) c.remove();
    this.el.classList.remove('pixa-zone');
    if (this.ed.view === this) this.ed.view = null;
  }

  /** The stacked canvases, bottom to top as created. */
  canvases() {
    return [this.under, this.refCanvas, this.art, this.over];
  }

  // ------------------------------------------------------------ geometry

  /**
   * Top-left of the zone's content box in client px, inside any border. When it falls between
   * device pixels, the canvases are shifted by the fraction, so the browser never snaps or
   * resamples them; zone coordinates (tx, ty, toDoc, toScreen) count from the shifted origin.
   * Measured on an empty box placed there (clientLeft is rounded, and borders snap to device pixels).
   */
  origin() {
    const r = this.probe.getBoundingClientRect(), dpr = this.dpr;
    const x = r.left, y = r.top;
    const ax = Math.round(x * dpr) / dpr, ay = Math.round(y * dpr) / dpr;
    if (ax - x !== this.shift.x || ay - y !== this.shift.y) {
      this.shift = { x: ax - x, y: ay - y };
      for (const c of this.canvases()) { c.style.left = `${this.shift.x}px`; c.style.top = `${this.shift.y}px`; }
    }
    return { x: ax, y: ay };
  }

  resize() {
    const dpr = globalThis.devicePixelRatio || 1, dprChanged = dpr !== this.dpr;
    this.dpr = dpr;
    this.origin();
    const w = Math.max(1, this.el.clientWidth), h = Math.max(1, this.el.clientHeight);
    if (w === this.width && h === this.height && !dprChanged && this.under.width === Math.round(w * dpr)) return;
    this.width = w; this.height = h;
    for (const c of this.canvases()) {
      // CSS size from the backing size, so the browser shows it 1:1 (never stretched by a fraction).
      c.width = Math.round(w * this.dpr);
      c.height = Math.round(h * this.dpr);
      c.style.width = `${c.width / this.dpr}px`;
      c.style.height = `${c.height / this.dpr}px`;
    }
    if (this.autoFit) this.fit();
    // Another pixel ratio: snap the zoom to whole device pixels per art pixel again.
    else if (dprChanged) this.zoomTo(this.scale, w / 2, h / 2, true);
    else this.applyView();
  }

  /** @param {boolean} replaced */
  syncDocument(replaced) {
    const doc = this.ed.doc;
    if (this.src.width !== doc.width || this.src.height !== doc.height) {
      this.src.width = doc.width;
      this.src.height = doc.height;
      replaced = true;
    }
    this.ed.markAllDirty();
    if (replaced) this.fit();
    this.request();
  }

  get fitScale() {
    const doc = this.ed.doc, m = 24;
    return Math.max(0.01, Math.min((this.width - 2 * m) / doc.width, (this.height - 2 * m) / doc.height));
  }

  get minScale() { return this.fitScale / 6; }
  get maxScale() { return Math.max(this.fitScale * 6, 64); }

  /** @param {number} s */
  crisp(s) {
    if (!this.o.crispZoom) return s;
    const d = s * this.dpr;
    return d >= 1 ? Math.max(1, Math.round(d)) / this.dpr : s;
  }

  fit() {
    const doc = this.ed.doc;
    let s = this.fitScale;
    if (this.o.crispZoom && s * this.dpr >= 1) s = Math.max(1, Math.floor(s * this.dpr)) / this.dpr;
    this.scale = s;
    this.tx = (this.width - doc.width * s) / 2;
    this.ty = (this.height - doc.height * s) / 2;
    this.autoFit = true;
    this.applyView();
  }

  /**
   * @param {number} scale @param {number} [sx] anchor in zone px (defaults to the centre) @param {number} [sy]
   * @param {boolean} [snap]
   */
  zoomTo(scale, sx = this.width / 2, sy = this.height / 2, snap = true) {
    let s = Math.min(this.maxScale, Math.max(this.minScale, scale));
    if (snap) s = this.crisp(s);
    const dx = (sx - this.tx) / this.scale, dy = (sy - this.ty) / this.scale;
    this.scale = s;
    this.tx = sx - dx * s;
    this.ty = sy - dy * s;
    this.autoFit = false;
    this.applyView();
  }

  /** @param {number} factor @param {number} [sx] @param {number} [sy] */
  zoomBy(factor, sx, sy) {
    let next = this.scale * factor;
    // When snapping, make sure a step always moves at least one device pixel per art pixel.
    if (this.o.crispZoom && this.scale * this.dpr >= 1) {
      const d = this.scale * this.dpr;
      next = (factor > 1 ? Math.max(Math.round(d * factor), Math.floor(d) + 1) : Math.min(Math.round(d * factor), Math.ceil(d) - 1)) / this.dpr;
      if (next * this.dpr < 1) next = this.scale * factor;
    }
    this.zoomTo(next, sx, sy, true);
  }

  /** @param {number} dx @param {number} dy */
  panBy(dx, dy) {
    this.tx += dx;
    this.ty += dy;
    this.autoFit = false;
    this.applyView();
  }

  /** Keeps at least a quarter of the art, or 48 px, inside the zone. */
  clampView() {
    const doc = this.ed.doc, aw = doc.width * this.scale, ah = doc.height * this.scale;
    const kx = Math.min(aw, Math.max(48, aw * 0.25)), ky = Math.min(ah, Math.max(48, ah * 0.25));
    this.tx = Math.min(this.width - kx, Math.max(kx - aw, this.tx));
    this.ty = Math.min(this.height - ky, Math.max(ky - ah, this.ty));
  }

  applyView() {
    this.origin();
    this.clampView();
    const r = (v) => Math.round(v * this.dpr) / this.dpr;
    this.tx = r(this.tx); this.ty = r(this.ty);
    this.needs.under = true;
    this.needs.art = true;
    this.needs.ref = true;
    this.needs.over = true;
    this.request();
    this.ed.events.emit('viewport', { scale: this.scale, tx: this.tx, ty: this.ty, zoom: this.scale / this.fitScale, fit: this.autoFit });
  }

  /** @param {number} sx @param {number} sy zone px */
  toDoc(sx, sy) {
    return { x: (sx - this.tx) / this.scale, y: (sy - this.ty) / this.scale };
  }

  /** @param {number} x @param {number} y doc px */
  toScreen(x, y) {
    return { x: this.tx + x * this.scale, y: this.ty + y * this.scale };
  }

  /** Tool pointer from a DOM event. @param {PointerEvent | MouseEvent} e */
  toPointer(e) {
    const o = this.origin();
    const sx = e.clientX - o.x, sy = e.clientY - o.y;
    const { x, y } = this.toDoc(sx, sy), doc = this.ed.doc;
    const ix = Math.floor(x), iy = Math.floor(y);
    return {
      x, y, ix, iy, sx, sy, inside: ix >= 0 && iy >= 0 && ix < doc.width && iy < doc.height,
      button: /** @type {any} */ (e).button ?? 0, shift: e.shiftKey, ctrl: e.ctrlKey, alt: e.altKey, meta: e.metaKey,
      pointerType: /** @type {any} */ (e).pointerType || 'mouse', scale: this.scale, pressure: /** @type {any} */ (e).pressure ?? 0.5,
    };
  }

  // ------------------------------------------------------------ pointer input

  /** @param {PointerEvent} e */
  onDown(e) {
    this.closeMenu();
    this.el.focus({ preventScroll: true });
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { this.el.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    const ed = this.ed;

    if (this.pointers.size === 2) {
      // Second finger: whatever the first one started becomes a pinch.
      this.cancelLongPress();
      if (this.gesture?.kind === 'tool' || this.gesture?.kind === 'floating') ed.cancelToolGesture();
      const [a, b] = [...this.pointers.values()];
      this.gesture = { kind: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, scale: this.scale };
      return;
    }
    if (this.pointers.size > 2) return;
    if (IS_MAC && e.button === 0 && e.ctrlKey && e.pointerType === 'mouse') return; // the contextmenu event follows
    if (e.button === 2) {
      // Right button: cancels a gesture in progress, otherwise the contextmenu event follows.
      if (this.cancelGesture()) this.suppressMenu = true;
      return;
    }

    const p = this.toPointer(e);
    if (e.pointerType === 'touch') {
      const now = performance.now();
      if (now - this.lastTap.time < 200 && Math.hypot(e.clientX - this.lastTap.x, e.clientY - this.lastTap.y) < 20) {
        // Double tap: open the menu, and take back what the first tap did.
        if (ed.history.list().length > this.lastTap.entries && ed.history.canUndo()) ed.undo();
        this.lastTap.time = 0;
        this.gesture = { kind: 'none' };
        this.openMenu(e.clientX, e.clientY);
        return;
      }
      this.lastTap.entries = ed.history.list().length;
      this.startLongPress(e);
    }

    if (e.button === 1 || this.space) { this.startPan(e); return; }

    const doc = ed.doc, tool = ed.tool, hadFloating = !!doc.floating;
    let hit = null;
    if (doc.floating) {
      hit = ed.floatingController.hit(p);
      if (hit) {
        ed.floatingController.down(p, hit);
        this.gesture = { kind: 'floating', hit };
        this.updateCursor();
        return;
      }
      // A tap outside the floating layer applies it; the Move tool may still drag it from anywhere.
      if (ed.activeToolId !== 'move' && e.button === 0) ed.run('floating.commit');
    }
    const outsideOk = SELECTION_TOOLS.has(ed.activeToolId) || (ed.activeToolId === 'move' && !!doc.floating);
    if (!p.inside && !outsideOk) {
      this.startPan(e);
      return;
    }
    const r = tool.down(p);
    if (r === 'pan') { this.startPan(e); return; }
    if (r === 'floating') {
      ed.floatingController.down(p, 'move');
      // Started outside an existing floating layer: a tap without a drag applies it.
      this.gesture = { kind: 'floating', hit: 'move', tapApplies: hadFloating && !hit };
      this.updateCursor();
      return;
    }
    this.gesture = { kind: 'tool', last: p };
    this.request('over');
  }

  /** Cancels a stroke or floating drag in progress. @returns {boolean} whether one was running */
  cancelGesture() {
    const g = this.gesture;
    if (!g || (g.kind !== 'tool' && g.kind !== 'floating')) return false;
    this.ed.cancelToolGesture();
    this.gesture = null;
    this.stopAutoPan();
    this.updateCursor();
    this.request('over');
    return true;
  }

  /** @param {PointerEvent} e */
  startPan(e) {
    this.gesture = { kind: 'pan', x: e.clientX, y: e.clientY };
    this.updateCursor();
  }

  /** @param {PointerEvent} e */
  onMove(e) {
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // A second button pressed during a drag arrives as a move: right button cancels.
    if (e.button === 2 && this.cancelGesture()) { this.suppressMenu = true; return; }
    const g = this.gesture, ed = this.ed;
    if (this.longPress && Math.hypot(e.clientX - this.longPress.x, e.clientY - this.longPress.y) > 8) this.cancelLongPress();

    if (g?.kind === 'pinch') {
      const pts = [...this.pointers.values()];
      if (pts.length < 2) return;
      const [a, b] = pts, d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      const o = this.origin();
      this.panBy(cx - g.cx, cy - g.cy);
      this.zoomTo(g.scale * (d / Math.max(1, g.d)), cx - o.x, cy - o.y, false);
      g.cx = cx; g.cy = cy;
      return;
    }
    if (g?.kind === 'pan') {
      this.panBy(e.clientX - g.x, e.clientY - g.y);
      g.x = e.clientX; g.y = e.clientY;
      return;
    }
    const events = g && typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];
    for (const ev of events.length ? events : [e]) {
      const p = this.toPointer(ev);
      if (g?.kind === 'floating') ed.floatingController.move(p);
      else ed.tool?.move?.(p);
      if (g?.kind === 'tool') g.last = p;
      this.hover = p;
    }
    if (g && (g.kind === 'tool' || g.kind === 'floating')) this.checkAutoPan(e);
    else this.updateCursor();
    ed.events.emit('pointer', { x: this.hover?.ix, y: this.hover?.iy, inside: !!this.hover?.inside });
    this.request('over');
  }

  /** @param {PointerEvent} e @param {boolean} [cancelled] */
  onUp(e, cancelled = false) {
    this.pointers.delete(e.pointerId);
    this.cancelLongPress();
    this.stopAutoPan();
    const g = this.gesture, ed = this.ed;
    if (g?.kind === 'pinch') {
      if (this.pointers.size === 0) {
        this.gesture = null;
        this.zoomTo(this.scale, this.width / 2, this.height / 2, true);
      }
      return;
    }
    if (this.pointers.size > 0) return;
    this.gesture = null;
    if (!g) return;
    const p = this.toPointer(e);
    if (g.kind === 'floating') {
      if (cancelled) ed.floatingController.cancel();
      else if (g.tapApplies && !ed.floatingController.moved) {
        ed.floatingController.cancel();
        ed.run('floating.commit', {});
      } else ed.floatingController.up();
    } else if (g.kind === 'tool') {
      if (cancelled) ed.cancelToolGesture();
      else ed.tool?.up?.(p);
      if (e.pointerType === 'touch') this.lastTap = { ...this.lastTap, time: performance.now(), x: e.clientX, y: e.clientY };
    }
    this.updateCursor();
    this.request('over');
  }

  /** @param {WheelEvent} e */
  onWheel(e) {
    e.preventDefault();
    this.closeMenu();
    const o = this.origin(), sx = e.clientX - o.x, sy = e.clientY - o.y;
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.height : 1;
    if (e.shiftKey && !e.ctrlKey) { this.panBy(-(e.deltaY || e.deltaX) * unit, 0); return; }
    if (e.altKey && !e.ctrlKey) { this.panBy(0, -e.deltaY * unit); return; }
    const dy = e.deltaY * unit;
    if (Math.abs(dy) < 0.5) return;
    if (e.ctrlKey) this.zoomTo(this.scale * Math.exp(-dy * 0.01), sx, sy, true); // trackpad pinch: smooth
    else this.zoomBy(dy < 0 ? 1.25 : 0.8, sx, sy);
  }

  /** @param {PointerEvent} e */
  startLongPress(e) {
    this.cancelLongPress();
    this.longPress = {
      x: e.clientX, y: e.clientY,
      timer: setTimeout(() => {
        this.longPress = null;
        if (this.gesture?.kind === 'tool') this.ed.cancelToolGesture();
        this.gesture = { kind: 'none' };
        this.openMenu(e.clientX, e.clientY);
      }, 500),
    };
  }

  cancelLongPress() {
    if (this.longPress) clearTimeout(this.longPress.timer);
    this.longPress = null;
  }

  /** Pans while a gesture holds the pointer near the zone edge. @param {PointerEvent} e */
  checkAutoPan(e) {
    const o = this.origin(), m = 24;
    const x = e.clientX - o.x, y = e.clientY - o.y;
    const vx = x < m ? m - x : x > this.width - m ? this.width - m - x : 0;
    const vy = y < m ? m - y : y > this.height - m ? this.height - m - y : 0;
    if (!vx && !vy) { this.stopAutoPan(); return; }
    const speed = (v) => Math.sign(v) * Math.min(14, Math.abs(v) * 0.5 + 2);
    this.autoPan = { vx: vx ? speed(vx) : 0, vy: vy ? speed(vy) : 0, event: e };
    if (!this.autoPan.raf) {
      const step = () => {
        const a = this.autoPan;
        if (!a || !this.gesture) return;
        this.panBy(a.vx, a.vy);
        const p = this.toPointer(a.event);
        if (this.gesture.kind === 'floating') this.ed.floatingController.move(p);
        else this.ed.tool?.move?.(p);
        a.raf = requestAnimationFrame(step);
      };
      this.autoPan.raf = requestAnimationFrame(step);
    }
  }

  stopAutoPan() {
    if (this.autoPan?.raf) cancelAnimationFrame(this.autoPan.raf);
    this.autoPan = null;
  }

  updateCursor() {
    const g = this.gesture, ed = this.ed;
    let c = ed.tool?.cursor?.() || 'default';
    if (g?.kind === 'pan' || this.space) c = g?.kind === 'pan' ? 'grabbing' : 'grab';
    else if (g?.kind === 'floating') c = HANDLE_CURSORS[g.hit] || 'move';
    else if (ed.doc.floating && this.hover) {
      const hit = ed.floatingController.hit(this.hover);
      if (hit) c = HANDLE_CURSORS[hit];
    } else if (this.hover && !this.hover.inside && !SELECTION_TOOLS.has(ed.activeToolId)) c = 'grab';
    if (this.el.style.cursor !== c) this.el.style.cursor = c;
  }

  // ------------------------------------------------------------ keyboard

  /** @param {KeyboardEvent} e */
  onKey(e) {
    if (isTyping(e.target) || e.defaultPrevented) return;
    const ed = this.ed, mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    const run = (id, args) => { if (ed.can(id, args)) ed.run(id, args); e.preventDefault(); };
    if (this.menuEl && this.menuKey(e)) return;
    // A focused control elsewhere keeps its own keys (Space and Enter press, arrows move), and
    // nothing reaches the canvas from inside an open dialog.
    const t = /** @type {any} */ (e.target);
    if (t && t !== this.el && t.closest) {
      if (t.closest('dialog[open]')) return;
      if (CONTROL_KEYS.has(e.key) && !mod && t.closest(CONTROLS)) return;
    }
    if (e.code === 'Space' && !mod) { if (!this.space) { this.space = true; this.updateCursor(); } e.preventDefault(); return; }
    if ((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu') {
      e.preventDefault();
      const o = this.origin();
      const at = this.hover ? { x: o.x + this.hover.sx, y: o.y + this.hover.sy } : { x: o.x + this.width / 2, y: o.y + this.height / 2 };
      this.openMenu(at.x, at.y);
      return;
    }
    if (e.key === 'Escape' && this.cancelGesture()) { e.preventDefault(); return; }
    if (mod) {
      if (k === 'z' && !e.shiftKey) return run('history.undo');
      if ((k === 'z' && e.shiftKey) || k === 'y') return run('history.redo');
      if (k === 'c') return run('selection.copy');
      if (k === 'x') return run('selection.cut');
      if (k === 'v') {
        // The paste event (fired by the same keys) brings system-clipboard images; if none
        // arrives, the internal clipboard is pasted: in place, or at the pointer with Shift.
        this.pasteAt = e.shiftKey && this.hover?.inside ? { x: this.hover.ix, y: this.hover.iy } : null;
        clearTimeout(this.pasteTimer);
        this.pasteTimer = setTimeout(() => this.pasteInternal(), this.o.paste === false ? 0 : 60);
        return;
      }
      if (k === 'a' && !e.shiftKey) return run('selection.all');
      if (k === 'd' || (k === 'a' && e.shiftKey)) return run('selection.clear');
      if (k === 'i' && e.shiftKey) return run('selection.invert');
      if (k === '0') { this.fit(); e.preventDefault(); return; }
      return;
    }
    if (e.altKey) return;
    switch (e.key) {
      case 'Escape':
        if (ed.tool?.points?.length || ed.tool?.anchor) ed.cancelToolGesture();
        else if (ed.doc.floating) ed.run('floating.cancel');
        else if (!ed.doc.selection.isEmpty()) ed.run('selection.clear');
        e.preventDefault();
        return;
      case 'Enter':
        if (ed.tool?.key?.('Enter')) { e.preventDefault(); return; }
        if (ed.doc.floating) run('floating.commit', {});
        return;
      case 'Delete': case 'Backspace':
        if (ed.doc.floating) run('floating.discard');
        else run('selection.erase');
        return;
      case 'ArrowLeft': case 'ArrowRight': case 'ArrowUp': case 'ArrowDown': {
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0, dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        if (!ed.doc.floating && !ed.doc.selection.isEmpty() && ed.activeToolId === 'move') ed.run('selection.lift');
        if (ed.doc.floating) run('floating.move', { dx, dy });
        else { this.panBy(-dx * 16, -dy * 16); e.preventDefault(); }
        return;
      }
      case '0': this.fit(); e.preventDefault(); return;
      case '+': case '=': this.zoomBy(1.25); e.preventDefault(); return;
      case '-': case '_': this.zoomBy(0.8); e.preventDefault(); return;
      case '[': ed.setBrush({ size: Math.max(1, ed.brush.size - 1) }); e.preventDefault(); return;
      case ']': ed.setBrush({ size: Math.min(32, ed.brush.size + 1) }); e.preventDefault(); return;
      case 'x': ed.run('color.swap'); e.preventDefault(); return;
      case 'e': ed.useTool('pencil', { blend: ed.brush.blend === 'erase' ? 'over' : 'erase' }); e.preventDefault(); return;
      case 'W': ed.useTool('select-color'); e.preventDefault(); return;
      default:
        if (TOOL_KEYS[e.key]) {
          ed.useTool(TOOL_KEYS[e.key], TOOL_KEYS[e.key] === 'pencil' ? { blend: 'over' } : undefined);
          e.preventDefault();
        }
    }
  }

  // ------------------------------------------------------------ clipboard, paste, drop

  pasteInternal() {
    const ed = this.ed, clip = ed.clipboard;
    if (!clip || !ed.can('clipboard.paste', {})) return;
    const at = this.pasteAt;
    ed.run('clipboard.paste', at ? { x: at.x - Math.floor(clip.width / 2), y: at.y - Math.floor(clip.height / 2) } : {});
  }

  /** @param {ClipboardEvent} e */
  onPaste(e) {
    if (isTyping(e.target)) return;
    const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
    const file = item?.getAsFile();
    if (!file) return; // the keydown fallback pastes the internal clipboard
    e.preventDefault();
    clearTimeout(this.pasteTimer);
    if (this.o.paste === 'event') this.ed.events.emit('paste-image', { file });
    else this.ed.import(file, { as: 'floating' }).catch((/** @type {any} */ error) => this.ed.events.emit('error', { source: 'paste', error }));
  }

  /** @param {DragEvent} e */
  onDrop(e) {
    if (this.o.drop === false) return;
    const file = [...(e.dataTransfer?.files || [])].find((f) => f.type.startsWith('image/') || /\.pixa$/i.test(f.name));
    if (!file) return;
    e.preventDefault();
    if (this.o.drop === 'event') this.ed.events.emit('drop-file', { file });
    else this.ed.import(file, { as: 'floating' }).catch((/** @type {any} */ error) => this.ed.events.emit('error', { source: 'drop', error }));
  }

  /** Copy and Cut also put the pixels on the system clipboard as PNG, where the browser allows it. @param {any} piece */
  toSystemClipboard(piece) {
    const nav = /** @type {any} */ (globalThis.navigator), Item = /** @type {any} */ (globalThis).ClipboardItem;
    if (!piece || this.o.systemClipboard === false || !nav?.clipboard?.write || !Item) return;
    const png = encodePNG(piece.rgba, piece.width, piece.height).then((bytes) => new Blob([bytes], { type: 'image/png' }));
    try {
      nav.clipboard.write([new Item({ 'image/png': png })]).catch(() => { /* denied or unsupported: the internal clipboard still works */ });
    } catch { /* ClipboardItem without promise support */ }
  }

  // ------------------------------------------------------------ reference image

  /** Decodes a new reference picture, and puts its canvas below or above the art. */
  syncReference() {
    const ref = this.ed.doc.reference;
    if (this.refPic && this.refPic.bytes !== ref?.bytes) {
      this.refPic.image?.close?.();
      this.refPic = null;
    }
    if (ref && !this.refPic) {
      const pic = /** @type {{ bytes: Uint8Array, image: any }} */ ({ bytes: ref.bytes, image: null });
      this.refPic = pic;
      decodePicture(ref.bytes, ref.mime).then((image) => {
        if (this.refPic !== pic) { image.close?.(); return; }
        pic.image = image;
        this.needs.ref = true;
        this.request();
      }, (/** @type {any} */ error) => this.ed.events.emit('error', { source: 'reference', error }));
    }
    const c = this.refCanvas;
    if (ref?.above) this.over.before(c);
    else this.art.before(c);
    this.needs.ref = true;
    this.request();
  }

  /** The reference picture in its rectangle, drawn under the same transform as the art. */
  drawReference() {
    const c = this.refCtx, ref = this.ed.doc.reference, image = this.refPic?.image;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.refCanvas.width, this.refCanvas.height);
    if (!ref || !ref.visible || !image) return;
    const k = this.scale * this.dpr;
    const turned = ref.rotation % 2 === 1;
    // The picture's own size in document pixels, before the quarter turns.
    const bw = turned ? ref.dh : ref.dw, bh = turned ? ref.dw : ref.dh;
    c.save();
    c.globalAlpha = ref.opacity;
    // Magnified: keep its pixels square; shrunk: smooth it.
    c.imageSmoothingEnabled = (bw * k) / ref.width < 1 || (bh * k) / ref.height < 1;
    c.imageSmoothingQuality = 'high';
    c.setTransform(k, 0, 0, k, this.tx * this.dpr, this.ty * this.dpr);
    c.translate(ref.x + ref.dw / 2, ref.y + ref.dh / 2);
    c.rotate((ref.rotation * Math.PI) / 2);
    c.drawImage(image, -bw / 2, -bh / 2, bw, bh);
    c.restore();
  }

  /** @param {boolean} on */
  setGrid(on) {
    this.o.grid = !!on;
    this.request('over');
  }

  // ------------------------------------------------------------ context menu

  /** Builds the model, emits 'contextmenu', and shows the built-in menu. @param {number} clientX @param {number} clientY */
  openMenu(clientX, clientY) {
    const o = this.origin();
    const { x, y } = this.toDoc(clientX - o.x, clientY - o.y);
    const doc = this.ed.doc, ix = Math.floor(x), iy = Math.floor(y);
    const pixel = ix >= 0 && iy >= 0 && ix < doc.width && iy < doc.height ? { x: ix, y: iy } : null;
    const model = buildContextMenu(this.ed, pixel);
    this.ed.events.emit('contextmenu', { screen: { x: clientX, y: clientY }, pixel, model });
    if (this.o.menu === 'builtin') this.showMenu(model, clientX, clientY);
  }

  /** @param {any[]} model @param {number} clientX @param {number} clientY */
  showMenu(model, clientX, clientY) {
    this.closeMenu();
    const menu = document.createElement('div');
    menu.className = 'pixa-menu';
    menu.setAttribute('role', 'menu');
    const items = [];
    for (const part of model) {
      if (part.kind === 'header') {
        const h = document.createElement('div');
        h.className = 'pixa-menu-header';
        h.textContent = part.text;
        menu.appendChild(h);
        continue;
      }
      const t = document.createElement('div');
      t.className = 'pixa-menu-title';
      t.textContent = part.title;
      menu.appendChild(t);
      for (const it of part.items) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'pixa-menu-item';
        b.setAttribute('role', it.checked !== undefined ? 'menuitemradio' : 'menuitem');
        if (it.checked) b.setAttribute('aria-checked', 'true');
        b.disabled = !it.enabled;
        b.dataset.icon = it.icon;
        if (it.swatch) {
          const s = document.createElement('span');
          s.className = 'pixa-menu-swatch';
          s.style.setProperty('--swatch', it.swatch);
          b.appendChild(s);
        }
        const label = document.createElement('span');
        label.textContent = it.label;
        b.appendChild(label);
        b.addEventListener('click', () => {
          this.closeMenu();
          if (this.ed.can(it.id, it.args)) this.ed.run(it.id, it.args);
          this.el.focus({ preventScroll: true });
        });
        menu.appendChild(b);
        items.push(b);
      }
    }
    document.body.appendChild(menu);
    const mw = menu.offsetWidth, mh = menu.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    menu.style.left = `${Math.max(4, Math.min(clientX, vw - mw - 4))}px`;
    menu.style.top = `${Math.max(4, Math.min(clientY, vh - mh - 4))}px`;
    const away = (/** @type {Event} */ ev) => { if (!menu.contains(/** @type {any} */ (ev.target))) this.closeMenu(); };
    setTimeout(() => {
      window.addEventListener('pointerdown', away, true);
      window.addEventListener('wheel', away, true);
    }, 0);
    this.menuEl = { el: menu, items, away };
    items.find((b) => !b.disabled)?.focus({ preventScroll: true });
  }

  /** @param {KeyboardEvent} e @returns {boolean} handled */
  menuKey(e) {
    const m = this.menuEl;
    if (!m) return false;
    const enabled = m.items.filter((/** @type {HTMLButtonElement} */ b) => !b.disabled);
    const i = enabled.indexOf(/** @type {any} */ (document.activeElement));
    if (e.key === 'Escape') { this.closeMenu(); this.el.focus(); e.preventDefault(); return true; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const n = enabled.length, next = e.key === 'ArrowDown' ? (i + 1) % n : (i - 1 + n) % n;
      enabled[next]?.focus();
      e.preventDefault();
      return true;
    }
    return e.key === 'Enter' || e.key === ' ';
  }

  closeMenu() {
    const m = this.menuEl;
    if (!m) return;
    window.removeEventListener('pointerdown', m.away, true);
    window.removeEventListener('wheel', m.away, true);
    m.el.remove();
    this.menuEl = null;
  }

  // ------------------------------------------------------------ rendering

  /** @param {'under'|'over'} [what] */
  request(what) {
    if (what) this.needs[what] = true;
    if (!this.frame) this.frame = requestAnimationFrame((t) => this.render(t));
  }

  /** @param {number} time */
  render(time) {
    this.frame = 0;
    this.drawArt();
    if (this.needs.under) { this.needs.under = false; this.drawUnder(); }
    if (this.needs.ref || this.drawnRef !== this.ed.doc.reference) { this.needs.ref = false; this.drawnRef = this.ed.doc.reference; this.drawReference(); }
    const ants = !this.ed.doc.selection.isEmpty() || !!this.ed.doc.floating;
    if (ants && time - this.lastAnts > 110) { this.lastAnts = time; this.antsPhase = (this.antsPhase + 1) % 8; this.needs.over = true; }
    if (this.needs.over) { this.needs.over = false; this.drawOver(); }
    if (ants) this.frame = requestAnimationFrame((t) => this.render(t));
  }

  drawArt() {
    const ed = this.ed, doc = ed.doc;
    if (this.src.width !== doc.width || this.src.height !== doc.height) {
      this.src.width = doc.width;
      this.src.height = doc.height;
      ed.markAllDirty();
    }
    if (ed.dirtyAny) {
      const d = ed.takeDirty(), override = ed.override, comp = this.compositor;
      // An open transaction that writes under the active layer has not bumped revisions yet.
      if (ed.tx) for (const l of ed.tx.layers.keys()) if (l !== doc.activeLayer) { comp.invalidate(); break; }
      if (d.all) {
        const px = comp.region(doc, override, 0, 0, doc.width, doc.height);
        this.srcCtx.putImageData(new ImageData(new Uint8ClampedArray(px.buffer, 0, doc.width * doc.height * 4), doc.width, doc.height), 0, 0);
        this.needs.art = true;
      } else {
        const buf = this.tileBuf || (this.tileBuf = new Uint32Array(TILE * TILE));
        for (let t = 0; t < d.tiles.length; t++) {
          if (!d.tiles[t]) continue;
          const x0 = (t % d.tilesX) * TILE, y0 = Math.floor(t / d.tilesX) * TILE;
          const w = Math.min(TILE, doc.width - x0), h = Math.min(TILE, doc.height - y0);
          if (w <= 0 || h <= 0) continue;
          const px = comp.region(doc, override, x0, y0, w, h, buf);
          this.srcCtx.putImageData(new ImageData(new Uint8ClampedArray(px.buffer, 0, w * h * 4), w, h), x0, y0);
          if (!this.needs.art) this.blitArt(x0, y0, x0 + w, y0 + h);
        }
      }
    }
    if (this.needs.art) {
      this.needs.art = false;
      this.artCtx.setTransform(1, 0, 0, 1, 0, 0);
      this.artCtx.clearRect(0, 0, this.art.width, this.art.height);
      this.blitArt(0, 0, doc.width, doc.height);
    }
  }

  /**
   * Copies document pixels [x0, x1) x [y0, y1) to the art canvas, scaled with nearest-neighbour
   * sampling under one fixed transform, so every update lands on exactly the same device pixels.
   * @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1
   */
  blitArt(x0, y0, x1, y1) {
    const c = this.artCtx, s = this.scale, k = s * this.dpr, ox = this.tx * this.dpr, oy = this.ty * this.dpr;
    // Only what is on screen; one extra pixel each side covers device pixels shared at fractional scales.
    x0 = Math.max(x0, Math.floor(-this.tx / s) - 1, 0); y0 = Math.max(y0, Math.floor(-this.ty / s) - 1, 0);
    x1 = Math.min(x1, Math.ceil((this.width - this.tx) / s) + 1, this.ed.doc.width); y1 = Math.min(y1, Math.ceil((this.height - this.ty) / s) + 1, this.ed.doc.height);
    if (x1 <= x0 || y1 <= y0) return;
    // Device pixels whose centres fall inside the region: exactly the ones these source pixels own.
    const own = (/** @type {number} */ v) => Math.ceil(v - 0.5);
    const X0 = Math.max(0, own(ox + x0 * k)), Y0 = Math.max(0, own(oy + y0 * k));
    const X1 = Math.min(this.art.width, own(ox + x1 * k)), Y1 = Math.min(this.art.height, own(oy + y1 * k));
    if (X1 <= X0 || Y1 <= Y0) return;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.beginPath();
    c.rect(X0, Y0, X1 - X0, Y1 - Y0);
    c.clip();
    c.clearRect(X0, Y0, X1 - X0, Y1 - Y0);
    c.imageSmoothingEnabled = false;
    c.setTransform(k, 0, 0, k, ox, oy);
    // Draw one source pixel wider each side, clipped: neighbours' edges never leave seams.
    const sx0 = Math.max(0, x0 - 1), sy0 = Math.max(0, y0 - 1), sx1 = Math.min(this.ed.doc.width, x1 + 1), sy1 = Math.min(this.ed.doc.height, y1 + 1);
    c.drawImage(this.src, sx0, sy0, sx1 - sx0, sy1 - sy0, sx0, sy0, sx1 - sx0, sy1 - sy0);
    c.restore();
  }

  drawUnder() {
    const c = this.underCtx, doc = this.ed.doc, dpr = this.dpr;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.under.width, this.under.height);
    const x0 = Math.max(0, this.tx), y0 = Math.max(0, this.ty);
    const x1 = Math.min(this.width, this.tx + doc.width * this.scale), y1 = Math.min(this.height, this.ty + doc.height * this.scale);
    if (x1 <= x0 || y1 <= y0) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.shadowColor = 'rgba(0,0,0,0.35)';
    c.shadowBlur = 12;
    c.fillStyle = this.theme.checker[1];
    c.fillRect(this.tx, this.ty, doc.width * this.scale, doc.height * this.scale);
    c.shadowBlur = 0;
    if (!this.checker) {
      const n = this.theme.checkerSize, tile = document.createElement('canvas');
      tile.width = tile.height = n * 2;
      const t = /** @type {CanvasRenderingContext2D} */ (tile.getContext('2d'));
      t.fillStyle = this.theme.checker[1];
      t.fillRect(0, 0, n * 2, n * 2);
      t.fillStyle = this.theme.checker[0];
      t.fillRect(0, 0, n, n);
      t.fillRect(n, n, n, n);
      this.checker = /** @type {CanvasPattern} */ (c.createPattern(tile, 'repeat'));
    }
    this.checker.setTransform(new DOMMatrix().translate(this.tx, this.ty));
    c.fillStyle = this.checker;
    c.fillRect(x0, y0, x1 - x0, y1 - y0);
  }

  drawOver() {
    const c = this.overCtx, ed = this.ed, doc = ed.doc, s = this.scale, dpr = this.dpr;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.over.width, this.over.height);
    if (!this.o.overlay) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const px = 1 / dpr;

    // Pixel grid
    if (this.o.grid && s >= 8) {
      const vx0 = Math.max(0, Math.floor(-this.tx / s)), vy0 = Math.max(0, Math.floor(-this.ty / s));
      const vx1 = Math.min(doc.width, Math.ceil((this.width - this.tx) / s)), vy1 = Math.min(doc.height, Math.ceil((this.height - this.ty) / s));
      c.beginPath();
      for (let x = vx0; x <= vx1; x++) { const X = Math.round((this.tx + x * s) * dpr) / dpr + px / 2; c.moveTo(X, this.ty + vy0 * s); c.lineTo(X, this.ty + vy1 * s); }
      for (let y = vy0; y <= vy1; y++) { const Y = Math.round((this.ty + y * s) * dpr) / dpr + px / 2; c.moveTo(this.tx + vx0 * s, Y); c.lineTo(this.tx + vx1 * s, Y); }
      c.strokeStyle = this.theme.grid;
      c.lineWidth = px;
      c.stroke();
    }

    // Mirror axes
    const b = ed.brush;
    if (b.mirror !== 'none' && (ed.activeToolId === 'pencil' || ed.activeToolId === 'mirror-axis')) {
      const ax = (b.mirrorAxis ? b.mirrorAxis.x2 : doc.width) / 2, ay = (b.mirrorAxis ? b.mirrorAxis.y2 : doc.height) / 2;
      c.save();
      c.setLineDash([6, 4]);
      c.lineWidth = 1;
      c.strokeStyle = 'rgba(0,0,0,0.6)';
      const line = (x0, y0, x1, y1) => { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
      const h = b.mirror === 'horizontal' || b.mirror === 'both', v = b.mirror === 'vertical' || b.mirror === 'both';
      for (const [col, off] of /** @type {Array<[string, number]>} */ ([['rgba(0,0,0,0.7)', 0], ['rgba(255,255,255,0.9)', 5]])) {
        c.strokeStyle = col;
        c.lineDashOffset = off;
        if (h) { const X = this.tx + ax * s; line(X, this.ty, X, this.ty + doc.height * s); }
        if (v) { const Y = this.ty + ay * s; line(this.tx, Y, this.tx + doc.width * s, Y); }
      }
      c.restore();
    }

    // Selection
    if (!doc.selection.isEmpty()) this.drawAnts(this.selectionPath(), false);

    // Tool overlay
    for (const item of ed.tool?.overlay?.() || []) this.drawItem(item);

    // Floating frame and handles
    const f = doc.floating;
    if (f) {
      const a = this.toScreen(f.x, f.y), w = f.dw * s, h = f.dh * s;
      const path = new Path2D();
      path.rect(Math.round(a.x * dpr) / dpr + px / 2, Math.round(a.y * dpr) / dpr + px / 2, w, h);
      this.strokeAnts(path);
      c.fillStyle = '#ffffff';
      c.strokeStyle = '#000000';
      c.lineWidth = 1;
      const hs = 7;
      for (const [hx, hy] of [[0, 0], [0.5, 0], [1, 0], [0, 0.5], [1, 0.5], [0, 1], [0.5, 1], [1, 1]]) {
        const X = Math.round(a.x + hx * w - hs / 2) + 0.5, Y = Math.round(a.y + hy * h - hs / 2) + 0.5;
        c.fillRect(X, Y, hs, hs);
        c.strokeRect(X, Y, hs, hs);
      }
    }
  }

  /** Selection outline as a doc-space path, cached by mask version. */
  selectionPath() {
    const m = this.ed.doc.selection;
    const key = `${m.version}:${m.width}x${m.height}`;
    if (this.outlineCache?.key === key && this.outlineCache.mask === m) return this.outlineCache.path;
    const path = this.outlinePath(m);
    this.outlineCache = { key, mask: m, path };
    return path;
  }

  /** @param {any} mask */
  outlinePath(mask) {
    const o = mask.outline(), path = new Path2D();
    for (let k = 0; k < o.horizontal.length; k += 3) { path.moveTo(o.horizontal[k + 1], o.horizontal[k]); path.lineTo(o.horizontal[k + 2], o.horizontal[k]); }
    for (let k = 0; k < o.vertical.length; k += 3) { path.moveTo(o.vertical[k], o.vertical[k + 1]); path.lineTo(o.vertical[k], o.vertical[k + 2]); }
    return path;
  }

  /** Strokes a doc-space path as marching ants. @param {Path2D} path @param {boolean} preview */
  drawAnts(path, preview) {
    const c = this.overCtx, s = this.scale, dpr = this.dpr;
    // Snap the doc grid to device pixels so 1-px lines stay sharp.
    const ox = Math.round(this.tx * dpr) / dpr + 0.5 / dpr, oy = Math.round(this.ty * dpr) / dpr + 0.5 / dpr;
    c.save();
    c.setTransform(dpr * s, 0, 0, dpr * s, ox * dpr, oy * dpr);
    c.lineWidth = 1 / (s * dpr) * Math.max(1, Math.round(dpr));
    c.strokeStyle = preview ? 'rgba(255,255,255,0.85)' : '#ffffff';
    c.setLineDash([]);
    c.stroke(path);
    c.strokeStyle = preview ? 'rgba(0,0,0,0.7)' : '#000000';
    c.setLineDash([4 / s, 4 / s]);
    c.lineDashOffset = -this.antsPhase / s;
    c.stroke(path);
    c.restore();
  }

  /** Screen-space path as marching ants. @param {Path2D} path */
  strokeAnts(path) {
    const c = this.overCtx;
    c.save();
    c.lineWidth = 1;
    c.strokeStyle = '#ffffff';
    c.stroke(path);
    c.strokeStyle = '#000000';
    c.setLineDash([4, 4]);
    c.lineDashOffset = -this.antsPhase;
    c.stroke(path);
    c.restore();
  }

  /** @param {any} item */
  drawItem(item) {
    const c = this.overCtx, s = this.scale;
    if (item.kind === 'footprint') {
      const off = item.offsets;
      if (!this.tipCache || this.tipCache.off !== off) this.tipCache = { off, segs: tipOutline(off) };
      const a = this.toScreen(item.x, item.y);
      c.save();
      if (!item.mirrored && !item.outlineOnly && this.ed.brush.blend !== 'erase') {
        c.fillStyle = toCss(this.ed.colors.primary);
        c.globalAlpha = 0.45;
        for (let k = 0; k < off.length; k += 2) c.fillRect(a.x + off[k] * s, a.y + off[k + 1] * s, s, s);
        c.globalAlpha = 1;
      }
      const path = new Path2D(), segs = this.tipCache.segs;
      for (let k = 0; k < segs.length; k += 4) { path.moveTo(a.x + segs[k] * s, a.y + segs[k + 1] * s); path.lineTo(a.x + segs[k + 2] * s, a.y + segs[k + 3] * s); }
      c.lineWidth = 2;
      c.strokeStyle = 'rgba(255,255,255,0.9)';
      c.stroke(path);
      c.lineWidth = 1;
      c.strokeStyle = item.mirrored ? 'rgba(0,0,0,0.45)' : '#000000';
      c.stroke(path);
      c.restore();
      return;
    }
    if (item.kind === 'mask') {
      let cached = this.maskOutlines.get(item.mask);
      if (!cached) {
        if (this.maskOutlines.size > 4) this.maskOutlines.clear();
        cached = this.outlinePath(item.mask);
        this.maskOutlines.set(item.mask, cached);
      }
      this.drawAnts(cached, true);
      return;
    }
    if (item.kind === 'anchor') {
      const a = this.toScreen(item.x + 0.5, item.y + 0.5);
      c.save();
      c.strokeStyle = '#000';
      c.lineWidth = 3;
      c.beginPath(); c.moveTo(a.x - 6, a.y); c.lineTo(a.x + 6, a.y); c.moveTo(a.x, a.y - 6); c.lineTo(a.x, a.y + 6); c.stroke();
      c.strokeStyle = '#fff';
      c.lineWidth = 1;
      c.stroke();
      c.restore();
      return;
    }
    if (item.kind === 'polyline') {
      const pts = item.points;
      if (pts.length < 2) return;
      const path = new Path2D();
      const a = this.toScreen(pts[0], pts[1]);
      path.moveTo(a.x, a.y);
      for (let k = 2; k < pts.length; k += 2) { const p = this.toScreen(pts[k], pts[k + 1]); path.lineTo(p.x, p.y); }
      if (item.closed) path.closePath();
      this.strokeAnts(path);
      c.save();
      c.fillStyle = '#fff';
      c.strokeStyle = '#000';
      c.fillRect(a.x - 3, a.y - 3, 6, 6);
      c.strokeRect(a.x - 3.5, a.y - 3.5, 7, 7);
      c.restore();
    }
  }

  /** Current view as plain numbers. */
  get state() {
    return { scale: this.scale, tx: this.tx, ty: this.ty, zoom: this.scale / this.fitScale, fit: this.autoFit };
  }
}

/** @param {import('../core/Editor.js').Editor} editor @param {HTMLElement} element @param {ZoneOptions} [o] */
export function attach(editor, element, o) {
  return editor.attach(element, o);
}

/** @type {any} */ (Editor).viewFactory = (/** @type {any} */ ed, /** @type {HTMLElement} */ el, /** @type {ZoneOptions} */ o) => new CanvasZone(ed, el, o);

export { Editor };
