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

/** Tools whose drags may start outside the art with a mouse or pen (elsewhere, and for a finger, outside pans). */
const SELECTION_TOOLS = new Set(['select-rect', 'select-ellipse', 'select-line', 'select-path', 'select-brush']);
const HANDLE_CURSORS = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize', move: 'move' };
const TOOL_KEYS = { b: 'pencil', i: 'picker', v: 'move', m: 'select-rect', o: 'select-ellipse', l: 'select-path', w: 'select-area', u: 'select-line', s: 'select-brush' };

/**
 * Touch: a long press (held, still) or a double tap opens the menu. Only a tap (short, still)
 * can start a double tap, so a stroke followed by a quick dot is never mistaken for one.
 */
const LONG_PRESS_MS = 500, LONG_PRESS_SLOP = 8;
const TAP_MS = 350, TAP_SLOP = 10, DOUBLE_TAP_MS = 250, DOUBLE_TAP_SLOP = 28;

/**
 * How much of the art panning and zooming must leave in the zone, in CSS px (all of it when it
 * is smaller): the art may travel almost out of view, so a zoom around a point beside it keeps
 * that point under the pointer instead of sliding the art.
 */
const KEEP_IN_VIEW = 48;

/**
 * Zooming glides rather than jumps. A step (keys, buttons, the menu) zooms by ZOOM_STEP; the wheel
 * by WHEEL_ZOOM per CSS px of travel (a mouse notch, about 100 px, is some 13 %). Both move at
 * least one device pixel per art pixel while the zoom is crisp. A glide takes GLIDE_MS; wheel
 * travel within WHEEL_GESTURE_MS of the last adds to the same glide.
 */
const ZOOM_STEP = 1.2, WHEEL_ZOOM = 0.0012, GLIDE_MS = 180, WHEEL_GESTURE_MS = 250;

/**
 * Auto-pan while a drag holds the pointer at the zone edge: after a short wait it eases in, faster
 * the further past the edge (CSS px per second), and stops once the art's own edge is in view
 * with a margin. Selections and floating layers start it in a band inside the edge; painting only
 * once the pointer has left the zone.
 */
const AUTO_PAN = { band: 16, wait: 220, ramp: 450, min: 40, max: 480, reach: 96, margin: 24 };

/**
 * The art's entrance (intro): it fades up in `fade` ms while it springs from `from` of its size,
 * overshooting a little and settling (a decay in s and a period in s), all over within `ms`.
 */
const INTRO = { fade: 240, from: 0.84, decay: 0.12, period: 0.34, ms: 680 };

/** Whether the system asks for less motion: then glides jump and the entrance only fades. */
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    /** The last tap: when and where it ended, and the history state before it. */
    this.lastTap = { time: 0, x: 0, y: 0, state: /** @type {any} */ (0) };
    /** Where and when the finger now down touched. @type {{ x: number, y: number, time: number } | null} */
    this.touchStart = null;
    /** @type {any} */ this.longPress = null;
    /** A trackpad pinch in progress: its unrounded zoom and the art point it holds. @type {any} */
    this.pinchWheel = null;
    /** @type {any} */ this.autoPan = null;
    /** A zoom gliding to its view. @type {any} */ this.glide = null;
    /** The wheel zoom under way: its travel and the unrounded zoom it asks for. @type {any} */ this.wheel = null;
    /** The art's entrance, while it plays. @type {any} */ this.introAnim = null;
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
    // The wheel button drags as the Move tool: no autoscroll or paste of its own.
    on(el, 'mousedown', (e) => { if (/** @type {MouseEvent} */ (e).button === 1) e.preventDefault(); });
    on(el, 'auxclick', (e) => { if (/** @type {MouseEvent} */ (e).button === 1) e.preventDefault(); });
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
    // Resizing a canvas clears it, and a frame requested now would only draw after the next
    // paint: while a container animates its size that paints a blank zone every frame. So a
    // resize draws at once, before the browser paints.
    const refit = () => { if (this.resize()) this.flush(); };
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(refit);
      ro.observe(el);
      this.cleanup.push(() => ro.disconnect());
    } else on(window, 'resize', refit);
    // Moving to a screen with another pixel ratio changes no CSS size: watch the ratio itself.
    if (typeof matchMedia === 'function') {
      /** @type {MediaQueryList | null} */ let mq = null;
      const onRatio = () => { refit(); watch(); };
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
    this.stopGlide(false);
    this.stopIntro();
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

  /** Follows the zone's size and pixel ratio. @returns {boolean} whether the canvases changed */
  resize() {
    const dpr = globalThis.devicePixelRatio || 1, dprChanged = dpr !== this.dpr;
    this.dpr = dpr;
    this.origin();
    const w = Math.max(1, this.el.clientWidth), h = Math.max(1, this.el.clientHeight);
    if (w === this.width && h === this.height && !dprChanged && this.under.width === Math.round(w * dpr)) return false;
    this.width = w; this.height = h;
    for (const c of this.canvases()) {
      // CSS size from the backing size, so the browser shows it 1:1 (never stretched by a fraction).
      c.width = Math.round(w * this.dpr);
      c.height = Math.round(h * this.dpr);
      c.style.width = `${c.width / this.dpr}px`;
      c.style.height = `${c.height / this.dpr}px`;
    }
    if (this.autoFit || this.glide?.fit) this.fit();
    // Another pixel ratio: snap the zoom to whole device pixels per art pixel again.
    else if (dprChanged) this.zoomTo(this.scale, w / 2, h / 2, true);
    else this.applyView();
    return true;
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

  /** The fitted view: the whole art, crisp, centred. */
  fitView() {
    const doc = this.ed.doc;
    let s = this.fitScale;
    if (this.o.crispZoom && s * this.dpr >= 1) s = Math.max(1, Math.floor(s * this.dpr)) / this.dpr;
    return { s, tx: (this.width - doc.width * s) / 2, ty: (this.height - doc.height * s) / 2 };
  }

  /** Fits the art at once; the view then follows the zone's size until it is zoomed or panned. */
  fit() {
    this.stopGlide(false);
    const v = this.fitView();
    this.scale = v.s;
    this.tx = v.tx;
    this.ty = v.ty;
    this.autoFit = true;
    this.applyView();
  }

  /** Glides to the fit, then fits as fit() does. */
  fitGlide() {
    const v = this.fitView();
    this.glideTo(v.s, v.tx, v.ty, { fit: true });
  }

  /**
   * @param {number} scale @param {number} [sx] anchor in zone px (defaults to the centre) @param {number} [sy]
   * @param {boolean} [snap]
   */
  zoomTo(scale, sx = this.width / 2, sy = this.height / 2, snap = true) {
    this.stopGlide();
    this.viewAround(scale, sx, sy, (sx - this.tx) / this.scale, (sy - this.ty) / this.scale, snap);
  }

  /**
   * Zooms so that the art point (ax, ay) sits at zone point (sx, sy).
   * @param {number} scale @param {number} sx @param {number} sy @param {number} ax @param {number} ay
   * @param {boolean} [snap]
   */
  viewAround(scale, sx, sy, ax, ay, snap = true) {
    this.stopGlide();
    let s = Math.min(this.maxScale, Math.max(this.minScale, scale));
    if (snap) s = this.crisp(s);
    this.scale = s;
    this.tx = sx - ax * s;
    this.ty = sy - ay * s;
    this.autoFit = false;
    this.applyView();
  }

  /**
   * The zoom one step by `factor` from `s`, within the zoom limits: when snapping, a step always
   * moves at least one device pixel per art pixel.
   * @param {number} s @param {number} factor
   */
  stepScale(s, factor) {
    let next = s * factor;
    if (this.o.crispZoom && s * this.dpr >= 1) {
      const d = s * this.dpr;
      next = (factor > 1 ? Math.max(Math.round(d * factor), Math.floor(d) + 1) : Math.min(Math.round(d * factor), Math.ceil(d) - 1)) / this.dpr;
      if (next * this.dpr < 1) next = s * factor;
    }
    return Math.min(this.maxScale, Math.max(this.minScale, next));
  }

  /** Zooms by a step of `factor` at once. @param {number} factor @param {number} [sx] @param {number} [sy] */
  zoomBy(factor, sx, sy) {
    this.stopGlide();
    this.zoomTo(this.stepScale(this.scale, factor), sx, sy, true);
  }

  /**
   * One zoom step in (dir > 0) or out around zone point (sx, sy), gliding there; steps taken
   * while it glides go on from where it is heading.
   * @param {number} dir @param {number} [sx] @param {number} [sy]
   */
  zoomStep(dir, sx = this.width / 2, sy = this.height / 2) {
    const base = this.glideBase();
    this.zoomGlide(this.stepScale(base.s, dir > 0 ? ZOOM_STEP : 1 / ZOOM_STEP), sx, sy, base);
  }

  /** The view a glide is heading to, or the view as it is. */
  glideBase() {
    const g = this.glide;
    return g ? { s: g.to.s, tx: g.to.tx, ty: g.to.ty } : { s: this.scale, tx: this.tx, ty: this.ty };
  }

  /**
   * Glides to `scale` around zone point (sx, sy): the art point there in view `base` ends there.
   * @param {number} scale @param {number} sx @param {number} sy @param {{ s: number, tx: number, ty: number }} [base]
   */
  zoomGlide(scale, sx, sy, base = this.glideBase()) {
    const s = this.crisp(Math.min(this.maxScale, Math.max(this.minScale, scale)));
    const ax = (sx - base.tx) / base.s, ay = (sy - base.ty) / base.s;
    const v = this.clampFor(s, sx - ax * s, sy - ay * s);
    this.glideTo(s, v.tx, v.ty);
  }

  /**
   * Glides the view to (scale, tx, ty) in GLIDE_MS, easing out: a zoom about the one art point
   * both views put in the same place, so the art there stays put all the way.
   * @param {number} scale @param {number} tx @param {number} ty @param {{ fit?: boolean, ms?: number }} [o]
   */
  glideTo(scale, tx, ty, o = {}) {
    const fit = !!o.fit, ms = o.ms ?? GLIDE_MS;
    this.stopGlide(false);
    const from = { s: this.scale, tx: this.tx, ty: this.ty }, to = { s: scale, tx, ty };
    const still = from.s === to.s && Math.abs(from.tx - to.tx) < 0.5 && Math.abs(from.ty - to.ty) < 0.5;
    if (ms <= 0 || still || reducedMotion()) { this.endGlide(to, fit); return; }
    const g = this.glide = { from, to, fit, t0: performance.now(), ms, raf: 0 };
    /** @param {number} now */
    const step = (now) => {
      if (this.glide !== g) return;
      const t = Math.min(1, Math.max(0, (now - g.t0) / g.ms));
      if (t >= 1) { this.glide = null; this.endGlide(to, fit); return; }
      const k = 1 - (1 - t) ** 3, s = from.s * (to.s / from.s) ** k, ds = from.s - to.s;
      if (Math.abs(ds) > 1e-9) {
        const ax = (to.tx - from.tx) / ds, ay = (to.ty - from.ty) / ds;
        this.tx = from.tx + ax * (from.s - s);
        this.ty = from.ty + ay * (from.s - s);
      } else {
        this.tx = from.tx + (to.tx - from.tx) * k;
        this.ty = from.ty + (to.ty - from.ty) * k;
      }
      this.scale = s;
      this.autoFit = false;
      this.applyView();
      g.raf = requestAnimationFrame(step);
    };
    g.raf = requestAnimationFrame(step);
  }

  /** @param {{ s: number, tx: number, ty: number }} to @param {boolean} fit */
  endGlide(to, fit) {
    if (fit) { this.fit(); return; }
    this.scale = to.s;
    this.tx = to.tx;
    this.ty = to.ty;
    this.autoFit = false;
    this.applyView();
  }

  /** Stops a glide: at the view it was heading to (finish), or where it is. @param {boolean} [finish] */
  stopGlide(finish = true) {
    const g = this.glide;
    if (!g) return;
    this.glide = null;
    cancelAnimationFrame(g.raf);
    if (finish) this.endGlide(g.to, g.fit);
  }

  /** Ends at once whatever plays (a glide, the entrance), as it would have ended. */
  settle() {
    this.stopGlide();
    this.stopIntro();
  }

  /** @param {number} dx @param {number} dy */
  panBy(dx, dy) {
    this.stopGlide();
    this.tx += dx;
    this.ty += dy;
    this.autoFit = false;
    this.applyView();
  }

  /** Keeps a strip of the art inside the zone (see KEEP_IN_VIEW), whatever the zoom. */
  clampView() {
    const v = this.clampFor(this.scale, this.tx, this.ty);
    this.tx = v.tx;
    this.ty = v.ty;
  }

  /** (tx, ty) moved as little as keeps the strip of the art in the zone at zoom s. @param {number} s @param {number} tx @param {number} ty */
  clampFor(s, tx, ty) {
    const doc = this.ed.doc, aw = doc.width * s, ah = doc.height * s;
    const kx = Math.min(aw, KEEP_IN_VIEW, this.width), ky = Math.min(ah, KEEP_IN_VIEW, this.height);
    return { tx: Math.min(this.width - kx, Math.max(kx - aw, tx)), ty: Math.min(this.height - ky, Math.max(ky - ah, ty)) };
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
    // A press ends a glide or the entrance where they were going: tools work on a still view.
    this.settle();
    this.el.focus({ preventScroll: true });
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { this.el.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    const ed = this.ed;

    if (this.pointers.size === 2) {
      // Second finger: whatever the first one started becomes a pinch (and no tap).
      this.cancelLongPress();
      this.touchStart = null;
      this.lastTap.time = 0;
      if (this.gesture?.kind === 'tool' || this.gesture?.kind === 'floating') ed.cancelToolGesture();
      const [a, b] = [...this.pointers.values()];
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, o = this.origin();
      // The art point between the fingers, held there for the whole pinch: each step is worked
      // out from it rather than from the last (rounded) view, so the art never drifts.
      this.gesture = {
        kind: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), cx, cy, scale: this.scale,
        ax: (cx - o.x - this.tx) / this.scale, ay: (cy - o.y - this.ty) / this.scale,
      };
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
      const now = performance.now(), last = this.lastTap;
      this.touchStart = null;
      if (now - last.time < DOUBLE_TAP_MS && Math.hypot(e.clientX - last.x, e.clientY - last.y) < DOUBLE_TAP_SLOP) {
        // Double tap: open the menu, and take back what the first tap did (if it did anything:
        // compared by state, as a new step after an undo also drops the redo branch).
        if (ed.history.stateId() !== last.state && ed.history.canUndo()) ed.undo();
        last.time = 0;
        this.gesture = { kind: 'none' };
        this.openMenu(e.clientX, e.clientY);
        return;
      }
      last.state = ed.history.stateId();
      this.touchStart = { x: e.clientX, y: e.clientY, time: now };
      this.startLongPress(e);
    }

    if (this.space) { this.startPan(e); return; }

    // The wheel button is the Move tool for the length of its drag, whatever tool is picked: it
    // drags the floating layer (from anywhere) or the selection under it (lifted first, a copy
    // with Alt), and pans anywhere else.
    const wheelButton = e.button === 1;
    const toolId = wheelButton ? 'move' : ed.activeToolId, tool = wheelButton ? ed.tools.get('move') : ed.tool;
    if (wheelButton) p.button = 0;
    const doc = ed.doc, hadFloating = !!doc.floating;
    let hit = null;
    if (doc.floating) {
      hit = ed.floatingController.hit(p);
      if (hit) {
        ed.floatingController.down(p, hit);
        this.gesture = { kind: 'floating', hit };
        this.updateCursor();
        return;
      }
    }
    // One finger outside the art moves the view, whatever the tool; a tap there still applies a
    // floating layer, as a click outside it does.
    if (e.pointerType === 'touch' && !p.inside) {
      this.gesture = { kind: 'pan', x: e.clientX, y: e.clientY, tapApplies: hadFloating && toolId !== 'move' };
      this.updateCursor();
      return;
    }
    // A click outside the floating layer applies it; the Move tool may still drag it from anywhere.
    if (hadFloating && toolId !== 'move' && e.button === 0) ed.run('floating.commit');
    const outsideOk = SELECTION_TOOLS.has(toolId) || (toolId === 'move' && !!doc.floating);
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
    if (this.longPress && Math.hypot(e.clientX - this.longPress.x, e.clientY - this.longPress.y) > LONG_PRESS_SLOP) this.cancelLongPress();

    if (g?.kind === 'pinch') {
      const pts = [...this.pointers.values()];
      if (pts.length < 2) return;
      const [a, b] = pts, d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      const o = this.origin();
      this.viewAround(g.scale * (d / Math.max(1, g.d)), cx - o.x, cy - o.y, g.ax, g.ay, false);
      g.cx = cx; g.cy = cy;
      return;
    }
    if (g?.kind === 'pan') {
      // The view moves in whole device pixels: what rounding left behind carries over to the
      // next move, so the art keeps up with a sub-pixel pointer (pen, touch) exactly. Against the
      // pan limit the remainder is dropped, so the way back starts at once.
      const dx = e.clientX - g.x + (g.rx || 0), dy = e.clientY - g.y + (g.ry || 0), tx = this.tx, ty = this.ty;
      this.panBy(dx, dy);
      g.rx = dx - (this.tx - tx);
      g.ry = dy - (this.ty - ty);
      if (Math.abs(g.rx) * this.dpr >= 1) g.rx = 0;
      if (Math.abs(g.ry) * this.dpr >= 1) g.ry = 0;
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
        // Settle on whole device pixels around where the fingers were, so the art stays put.
        const o = this.origin();
        this.viewAround(this.scale, g.cx - o.x, g.cy - o.y, g.ax, g.ay, true);
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
    } else if (g.kind === 'pan' && g.tapApplies && !cancelled && ed.doc.floating) {
      const s = this.touchStart;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) < TAP_SLOP) ed.run('floating.commit', {});
    }
    if (e.pointerType === 'touch') {
      // A tap with the tool, on a floating layer or beside the art may be the first of a double tap.
      const s = this.touchStart, now = performance.now();
      const tap = !cancelled && !!s && g.kind !== 'none' && now - s.time < TAP_MS && Math.hypot(e.clientX - s.x, e.clientY - s.y) < TAP_SLOP;
      this.lastTap = { ...this.lastTap, time: tap ? now : 0, x: e.clientX, y: e.clientY };
      this.touchStart = null;
    }
    this.updateCursor();
    this.request('over');
  }

  /** @param {WheelEvent} e */
  onWheel(e) {
    e.preventDefault();
    this.closeMenu();
    this.stopIntro();
    const o = this.origin(), sx = e.clientX - o.x, sy = e.clientY - o.y;
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.height : 1;
    if (e.shiftKey && !e.ctrlKey) { this.panBy(-(e.deltaY || e.deltaX) * unit, 0); return; }
    if (e.altKey && !e.ctrlKey) { this.panBy(0, -e.deltaY * unit); return; }
    const dy = e.deltaY * unit;
    if (Math.abs(dy) < 0.5) return;
    if (e.ctrlKey && e.deltaMode === 0 && Math.abs(dy) < 40) {
      // Trackpad pinch (small ctrl+wheel steps; a mouse notch with Ctrl is far larger and glides
      // below): it follows the fingers at once. Its steps add up unrounded, so a slow pinch zooms
      // too (each small step alone would round back to the same crisp scale), around a point held
      // for the pinch.
      this.stopGlide();
      const now = performance.now(), z = this.pinchWheel;
      const going = !!z && now - z.time < 300 && z.shown === this.scale && z.sx === sx && z.sy === sy;
      const target = Math.min(this.maxScale, Math.max(this.minScale, (going ? z.target : this.scale) * Math.exp(-dy * 0.01)));
      const ax = going ? z.ax : (sx - this.tx) / this.scale, ay = going ? z.ay : (sy - this.ty) / this.scale;
      this.viewAround(target, sx, sy, ax, ay, true);
      this.pinchWheel = { target, shown: this.scale, time: now, sx, sy, ax, ay };
      return;
    }
    // A wheel notch counts as about 100 px, whatever unit the browser gives it in.
    this.wheelZoom(e.deltaY * (e.deltaMode === 1 ? 100 / 3 : e.deltaMode === 2 ? 300 : 1), sx, sy);
  }

  /**
   * Wheel travel (CSS px; down zooms out) zooms by WHEEL_ZOOM per px around zone point (sx, sy),
   * gliding. The travel of one turn of the wheel adds up unrounded, so a free-spinning wheel or a
   * trackpad zooms smoothly too; and half a notch always moves at least one step, however coarse
   * the crisp zooms are there.
   * @param {number} travel @param {number} sx @param {number} sy
   */
  wheelZoom(travel, sx, sy) {
    const now = performance.now(), dir = travel < 0 ? 1 : -1, base = this.glideBase();
    let w = this.wheel;
    if (!w || now - w.time > WHEEL_GESTURE_MS || w.dir !== dir) w = this.wheel = { want: base.s, travel: 0, stepped: false, dir, time: now };
    w.time = now;
    w.travel += Math.abs(travel);
    w.want = Math.min(this.maxScale, Math.max(this.minScale, w.want * Math.exp(-travel * WHEEL_ZOOM)));
    let s = this.crisp(w.want);
    if (dir > 0 ? s < base.s : s > base.s) s = base.s;
    if (s === base.s && !w.stepped && w.travel >= 50) {
      s = this.stepScale(base.s, dir > 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
      w.want = s;
    }
    if (s === base.s) return;
    w.stepped = true;
    this.zoomGlide(s, sx, sy, base);
  }

  /** @param {PointerEvent} e */
  startLongPress(e) {
    this.cancelLongPress();
    this.longPress = {
      x: e.clientX, y: e.clientY,
      timer: setTimeout(() => {
        this.longPress = null;
        // What the finger started is taken back: a dot, or a floating layer it began to drag.
        if (this.gesture?.kind === 'tool' || this.gesture?.kind === 'floating') this.ed.cancelToolGesture();
        this.stopAutoPan();
        this.gesture = { kind: 'none' };
        this.updateCursor();
        this.openMenu(e.clientX, e.clientY);
      }, LONG_PRESS_MS),
    };
  }

  cancelLongPress() {
    if (this.longPress) clearTimeout(this.longPress.timer);
    this.longPress = null;
  }

  /**
   * Pans while a drag holds the pointer at the zone edge (see AUTO_PAN): how far into the edge
   * band, or past the zone's edge, sets the speed; the frames move it.
   * @param {PointerEvent} e
   */
  checkAutoPan(e) {
    const A = AUTO_PAN, g = this.gesture, o = this.origin();
    const band = g?.kind === 'floating' || SELECTION_TOOLS.has(this.ed.activeToolId) ? A.band : 0;
    /** @param {number} v @param {number} size depth into the band: + brings the art's start into view */
    const depth = (v, size) => (v < band ? band - v : v > size - band ? size - band - v : 0);
    const dx = depth(e.clientX - o.x, this.width), dy = depth(e.clientY - o.y, this.height);
    if (!dx && !dy) { this.stopAutoPan(); return; }
    const a = this.autoPan || (this.autoPan = { since: performance.now(), last: 0, fx: 0, fy: 0, raf: 0 });
    Object.assign(a, { event: e, dx, dy });
    if (!a.raf) a.raf = requestAnimationFrame((t) => this.autoPanStep(t));
  }

  /** One frame of auto-pan: time-based, so a fast screen pans no faster. @param {number} now */
  autoPanStep(now) {
    const a = this.autoPan, A = AUTO_PAN, g = this.gesture;
    if (!a || !g) return;
    a.raf = requestAnimationFrame((t) => this.autoPanStep(t));
    const dt = a.last ? Math.min(0.05, (now - a.last) / 1000) : 0;
    a.last = now;
    const held = now - a.since - A.wait;
    if (held <= 0 || !dt) return;
    const r = Math.min(1, held / A.ramp), ease = r * r * (3 - 2 * r);
    /** @param {number} d */
    const speed = (d) => {
      const k = Math.min(1, Math.abs(d) / A.reach);
      return Math.sign(d) * (A.min + (A.max - A.min) * k * k) * ease;
    };
    // Whole device pixels at a time; the remainder carries over, so a slow pan still moves.
    a.fx += a.dx ? speed(a.dx) * dt : 0;
    a.fy += a.dy ? speed(a.dy) * dt : 0;
    const whole = (v) => Math.trunc(v * this.dpr) / this.dpr;
    let vx = whole(a.fx), vy = whole(a.fy);
    a.fx -= vx;
    a.fy -= vy;
    // Only as far as brings the art's edge into view: there is nothing to reach beyond it.
    const aw = this.ed.doc.width * this.scale, ah = this.ed.doc.height * this.scale;
    if (vx > 0) vx = Math.min(vx, Math.max(0, A.margin - this.tx));
    else if (vx < 0) vx = Math.max(vx, Math.min(0, this.width - A.margin - this.tx - aw));
    if (vy > 0) vy = Math.min(vy, Math.max(0, A.margin - this.ty));
    else if (vy < 0) vy = Math.max(vy, Math.min(0, this.height - A.margin - this.ty - ah));
    if (!vx && !vy) return;
    this.panBy(vx, vy);
    const p = this.toPointer(a.event);
    if (g.kind === 'floating') this.ed.floatingController.move(p);
    else this.ed.tool?.move?.(p);
    this.request('over');
  }

  stopAutoPan() {
    if (this.autoPan?.raf) cancelAnimationFrame(this.autoPan.raf);
    this.autoPan = null;
  }

  /**
   * The art's entrance (see INTRO): the canvases fade up while the art springs from a little
   * smaller to its size, overshooting once and settling; only the fade where the system asks for
   * less motion. It only shows: the view and where the pointer lands are untouched, and a press
   * or the wheel ends it at once.
   * @param {{ delay?: number }} [o] ms before it starts (the canvases stay hidden meanwhile)
   */
  intro(o = {}) {
    this.stopIntro();
    const canvases = this.canvases(), still = reducedMotion(), end = (still ? INTRO.fade : INTRO.ms) / 1000;
    const it = this.introAnim = { t0: performance.now() + Math.max(0, o.delay ?? 0), raf: 0 };
    for (const c of canvases) c.style.opacity = '0';
    /** @param {number} now */
    const step = (now) => {
      if (this.introAnim !== it) return;
      const t = (now - it.t0) / 1000;
      if (t >= end) { this.stopIntro(); return; }
      if (t > 0) {
        const a = Math.min(1, (t * 1000) / INTRO.fade), fade = 1 - (1 - a) ** 2;
        const k = still ? 1 : 1 - (1 - INTRO.from) * Math.exp(-t / INTRO.decay) * Math.cos((2 * Math.PI * t) / INTRO.period);
        // Around the art's middle, wherever the view has it now.
        const doc = this.ed.doc, cx = this.tx + (doc.width * this.scale) / 2, cy = this.ty + (doc.height * this.scale) / 2;
        for (const c of canvases) {
          c.style.opacity = String(fade);
          c.style.transformOrigin = `${cx}px ${cy}px`;
          c.style.transform = `scale(${k})`;
        }
      }
      it.raf = requestAnimationFrame(step);
    };
    it.raf = requestAnimationFrame(step);
  }

  /** Ends the entrance at once, as it would end. */
  stopIntro() {
    const it = this.introAnim;
    if (!it) return;
    this.introAnim = null;
    cancelAnimationFrame(it.raf);
    for (const c of this.canvases()) {
      c.style.opacity = '';
      c.style.transform = '';
      c.style.transformOrigin = '';
    }
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
      if (k === '0') { this.fitGlide(); e.preventDefault(); return; }
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
      case '0': this.fitGlide(); e.preventDefault(); return;
      case '+': case '=': this.zoomStep(1); e.preventDefault(); return;
      case '-': case '_': this.zoomStep(-1); e.preventDefault(); return;
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

  /** Draws what is waiting for the next frame now. */
  flush() {
    if (!this.frame) return;
    cancelAnimationFrame(this.frame);
    this.render(performance.now());
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
