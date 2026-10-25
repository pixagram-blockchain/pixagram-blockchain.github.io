import * as React from "preact/compat";

/* ══════════════════════════════════════════════════════════════════════
 * ImageLightbox — full-screen viewer for one article image.
 *
 * Opens as a hero flight out of the clicked <img> and lets the reader look
 * closely, with the gestures people already know from photo apps:
 *
 *   • pinch, double-tap, mouse wheel, trackpad pinch, + / − / 0
 *       → zoom between the fitted size and 3× (a very long strip may go
 *         further, until it fills the screen)
 *   • drag while zoomed → pan, with momentum and a rubber edge
 *   • drag while fitted → the picture follows the finger, shrinking and
 *       letting the article show through; let go far or fast enough and
 *       it flies home. On touch the article scrolls along underneath, so
 *       "slide it up and keep reading" works the way it always did.
 *   • pinch below the fitted size / wheel down while fitted → shrinks it
 *       home (the wheel also scrolls the article, like before)
 *   • tap / click on the picture → zoomed: back to fit; fitted: close.
 *       On touch a single tap waits a beat, so a double tap can zoom.
 *   • tap / click the backdrop, Escape → close; arrows pan when zoomed.
 *
 * Everything on screen is driven imperatively: one rAF loop writes the
 * transform, the corner radius and the backdrop opacity, so no gesture
 * frame ever goes through a render.
 *
 * Corners: the visible radius is computed per frame and divided by the
 * current scale before it is written, so it morphs from the article
 * image's own corners to the viewer's without being squashed by the
 * transform (which is what a CSS border-radius transition under a FLIP
 * scale does). Once fitted, the corners scale with the picture like the
 * rest of it, so zooming never repaints them.
 *
 * Sharpness: transforms are composited, so a zoomed bitmap would stay at
 * its fitted resolution. When a zoom comes to rest the <img> box is laid
 * out again at the zoomed size (scale ÷ that factor stays the same on
 * screen) and the browser re-rasters it crisp — pixel art included,
 * since the source's image-rendering is copied over.
 *
 * Props:
 *   source        the article <img> (hero origin / destination; hidden
 *                 while the viewer shows it)
 *   src, alt      what to show
 *   onClosed()    the flight home has landed — unmount the viewer
 *   onDragScroll(dy)  optional: scroll the page underneath by dy px
 *                 (touch drag-away and wheel-away use it)
 * ══════════════════════════════════════════════════════════════════════ */

// ── Tuning ───────────────────────────────────────────────────────────────
const OPEN_MS = 340;                  // flight out of the article
const CLOSE_MS = 320;                 // flight home
const ZOOM_MS = 300;                  // double-tap / keyboard / settle zooms
const DECODE_WAIT_MS = 120;           // longest wait for the copy to decode before flying

const COMPACT_MAX_WIDTH = 960;        // the app's phone cutoff: below it the picture runs edge to edge
const WIDE_FIT_RATIO = 0.8;           // desktop: the fitted picture takes 80% of the screen
const COMPACT_RADIUS = 12;            // phones: small corners on the full-width picture
const WIDE_RADIUS_MIN = 12;           // desktop: ~⅕ of the short side, clamped
const WIDE_RADIUS_MAX = 42;

const MAX_ZOOM = 3;                   // × the fitted size
const DOUBLE_TAP_ZOOM = 2.5;
const STRIP_FILL_FROM = 4;            // a strip needing more than this to fill the screen…
const STRIP_FILL_LIMIT = 12;          // …may zoom until it does, up to this
const MIN_SCALE = 0.2;
const ZOOM_EPS = 0.01;
const OVERZOOM_ROOM = 0.35;           // pinch past the max: rubber room, × max
const UNDERZOOM_EXP = 0.7;            // pinch below fit: scale = raw^0.7 (resisted, never ≤ 0)

const TAP_SLOP_TOUCH = 10;
const TAP_SLOP_MOUSE = 4;
const TAP_MAX_MS = 500;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP = 40;

const DISMISS_MIN_PX = 64;            // drag-away distance that closes…
const DISMISS_RATIO = 0.1;            // …or this share of the screen height, whichever is larger
const DISMISS_VELOCITY = 0.35;        // px/ms — a flick closes from a short distance
const DISMISS_FLICK_MIN_PX = 16;
const DISMISS_SHRINK = 0.25;          // scale lost at half a screen of drag
const DISMISS_FADE_RATIO = 0.4;       // backdrop gone at this share of the screen height
const PINCH_CLOSE_SCALE = 0.8;        // released below this × fit → close

const WHEEL_LINE_PX = 33;
const WHEEL_STEP_MAX = 120;
const WHEEL_ZOOM_RATE = 0.0022;       // per px of wheel: one 100px notch ≈ 1.25×
const PINCH_WHEEL_RATE = 0.012;       // trackpad pinch arrives as small ctrl+wheel deltas
const PINCH_WHEEL_MAX_DELTA = 50;     // above this a ctrl+wheel is a mouse notch, not a pinch
const PINCH_WHEEL_IDLE_MS = 180;      // trackpad pinch ended → settle (or close)
const WHEEL_SMOOTH_MS = 60;
const WHEEL_DISMISS_PX = 140;         // wheel travel at fit that sends it home (as before)
const WHEEL_PULL_HOLD_MS = 700;       // a pull with no further wheel springs back after this (slow notches still add up)
const WHEEL_LATCH_MS = 450;           // wheel-down that just reached fit keeps holding there this long
const WHEEL_ANCHOR_MS = 600;          // notches this close together, cursor still → same zoom anchor
const WHEEL_PULL_SHRINK = 0.12;
const WHEEL_PULL_DIM = 0.5;

const KEY_ZOOM = 1.5;
const KEY_PAN_RATIO = 0.2;

const SPRING_W = 0.022;               // critically damped, per ms (~300 ms to settle)
const FRICTION = 0.995;               // pan momentum decay, per ms
const MAX_VELOCITY = 4;               // px/ms
const VELOCITY_WINDOW_MS = 100;
const RUBBER_C = 0.55;                // UIScrollView's rubber-band constant
const RES_STEP = 1.15;                // re-raster when zoomed this far past the current raster

const CHANNELS = ["T", "Q", "O", "G", "F"];   // transform, corners, backdrop, gesture dim, fade
const SCROLL_KEYS = new Set([" ", "Spacebar", "PageUp", "PageDown", "Home", "End",
    "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"]);

// ── Math helpers ─────────────────────────────────────────────────────────
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v) => clamp(v, 0, 1);
const now = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
// When the input actually happened. Velocities and tap timings use it, so a
// busy main thread that delivers several moves at once can't fake a flick or
// swallow one. Falls back to now() where timeStamp has another time base.
const eventTime = (e) => {
    const n = now(), ts = e && e.timeStamp;
    return ts > 0 && Math.abs(n - ts) < 60000 ? ts : n;
};

// CSS cubic-bezier as a function of time → progress.
function cubicBezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (t) => ((ax * t + bx) * t + cx) * t;
    const sy = (t) => ((ay * t + by) * t + cy) * t;
    const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
        if (x <= 0) return 0;
        if (x >= 1) return 1;
        let t = x;
        for (let i = 0; i < 8; i++) {
            const e = sx(t) - x;
            if (Math.abs(e) < 1e-6) return sy(t);
            const d = dx(t);
            if (Math.abs(d) < 1e-6) break;
            t -= e / d;
        }
        let lo = 0, hi = 1;
        t = x;
        for (let i = 0; i < 40; i++) {
            const v = sx(t);
            if (Math.abs(v - x) < 1e-6) break;
            if (v < x) lo = t; else hi = t;
            t = (lo + hi) / 2;
        }
        return sy(t);
    };
}
const EASE = cubicBezier(0.2, 0, 0, 1);   // the dialog's LIGHTBOX_EASING

// iOS rubber band: the further past the edge, the less it follows.
function rubber(d, dim, c = RUBBER_C) {
    if (!d || !(dim > 0)) return 0;
    const a = Math.abs(d);
    return Math.sign(d) * (1 - 1 / ((a * c) / dim + 1)) * dim;
}
function unrubber(r, dim, c = RUBBER_C) {
    if (!r || !(dim > 0)) return 0;
    const a = Math.min(Math.abs(r), dim * 0.95);
    return (Math.sign(r) * (1 / (1 - a / dim) - 1) * dim) / c;
}
function rubberClamp(v, min, max, dim) {
    if (v < min) return min + rubber(v - min, dim);
    if (v > max) return max + rubber(v - max, dim);
    return v;
}
function unrubberClamp(v, min, max, dim) {
    if (v < min) return min + unrubber(v - min, dim);
    if (v > max) return max + unrubber(v - max, dim);
    return v;
}
// Zoom with resistance past the max and below the fitted size. Below fit
// it is a power curve, not the rubber band: a pinch can start at any size
// (a small image grabbed mid-flight starts at 0.3×) and must always move
// the way the fingers do, which needs `raw` to stay positive.
function softScale(raw, maxS) {
    if (raw > maxS) return maxS + rubber(raw - maxS, maxS * OVERZOOM_ROOM);
    if (raw < 1) return Math.pow(Math.max(raw, 1e-4), UNDERZOOM_EXP);
    return raw;
}
function unsoftScale(s, maxS) {
    if (s > maxS) return maxS + unrubber(s - maxS, maxS * OVERZOOM_ROOM);
    if (s < 1) return Math.pow(Math.max(s, 1e-4), 1 / UNDERZOOM_EXP);
    return s;
}

// The view after scaling to `s` around the screen point (fx, fy).
function zoomAbout(v, s, fx, fy) {
    const k = s / v.s;
    return { s, x: fx - (fx - v.x) * k, y: fy - (fy - v.y) * k };
}

// "12px" → 12, "50%" → ref × 0.5 (first radius of an elliptical pair),
// clamped the way the browser clamps overlapping corners.
function radiusPx(value, ref) {
    if (!value) return 0;
    const first = String(value).trim().split(/\s+/)[0];
    let n = parseFloat(first);
    if (!isFinite(n) || n <= 0) return 0;
    if (first.endsWith("%")) n = (n * ref) / 100;
    return Math.min(n, ref / 2);
}
function readRadii(el, ref) {
    try {
        const cs = window.getComputedStyle(el);
        return [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius]
            .map((v) => radiusPx(v, ref));
    } catch (e) {
        return [0, 0, 0, 0];
    }
}

// One axis of a momentum pan: friction inside the bounds, a critically
// damped spring back once past them (the overshoot is the bounce).
function stepAxis(a, dt, min, max) {
    if (a.done) return;
    if (a.pos < min - 0.01 || a.pos > max + 0.01) {
        const target = a.pos < min ? min : max;
        const d0 = a.pos - target, v0 = a.vel, e = Math.exp(-SPRING_W * dt);
        a.pos = target + (d0 + (v0 + SPRING_W * d0) * dt) * e;
        a.vel = (v0 - SPRING_W * (v0 + SPRING_W * d0) * dt) * e;
        if (Math.abs(a.pos - target) < 0.25 && Math.abs(a.vel) < 0.01) {
            a.pos = target;
            a.vel = 0;
            a.done = true;
        }
        return;
    }
    if (Math.abs(a.vel) < 0.01) {
        a.vel = 0;
        a.done = true;
        return;
    }
    const decay = Math.pow(FRICTION, dt);
    a.pos += (a.vel * (decay - 1)) / Math.log(FRICTION);
    a.vel *= decay;
}

function pushSample(samples, t, x, y) {
    samples.push([t, x, y]);
    while (samples.length > 2 && t - samples[0][0] > 200) samples.shift();
}

// Release velocity (px/ms) over the last ~100 ms of movement; zero when
// the finger came to rest before letting go.
function releaseVelocity(samples, t) {
    if (samples.length < 2) return [0, 0];
    const last = samples[samples.length - 1];
    if (t - last[0] > 80) return [0, 0];
    let first = last;
    for (let i = samples.length - 2; i >= 0; i--) {
        if (last[0] - samples[i][0] > VELOCITY_WINDOW_MS) break;
        first = samples[i];
    }
    const dt = last[0] - first[0];
    if (dt < 10) return [0, 0];
    return [
        clamp((last[1] - first[1]) / dt, -MAX_VELOCITY, MAX_VELOCITY),
        clamp((last[2] - first[2]) / dt, -MAX_VELOCITY, MAX_VELOCITY),
    ];
}

// ── Static styles ────────────────────────────────────────────────────────
const OVERLAY_STYLE = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 150,
    overflow: "hidden",
    touchAction: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
    WebkitTapHighlightColor: "transparent",
    outline: "none",
    cursor: "zoom-out",
};
const BACKDROP_STYLE = {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.82)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    opacity: 0,
    willChange: "opacity",
    pointerEvents: "none",
};
const IMAGE_STYLE = {
    position: "absolute",
    left: 0,
    top: 0,
    display: "block",
    margin: 0,
    maxWidth: "none",
    maxHeight: "none",
    transformOrigin: "0 0",
    willChange: "transform",
    boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
    objectFit: "fill",
    userSelect: "none",
    WebkitUserSelect: "none",
    WebkitUserDrag: "none",
};

export default class ImageLightbox extends React.PureComponent {
    constructor(props) {
        super(props);
        this._overlay = null;
        this._backdrop = null;
        this._img = null;

        this._phase = "init";        // init → open → closing → closed
        this._L = null;              // layout: viewport, fitted box, zoom limits, corner radius
        this._nat = { w: 1, h: 1 };
        this._srcR = [0, 0, 0, 0];   // the article image's corners (visible px)

        // What is on screen — written to the DOM once per frame by _apply().
        this._v = { x: 0, y: 0, s: 1 };   // picture's top-left (px) and scale vs. its fitted size
        this._q = 0;                 // corners: 0 = the article image's, 1 = the viewer's
        this._baseO = 0;             // backdrop: closed 0 ↔ open 1
        this._dim = 1;               // backdrop × gesture (dragging away, pinching small)
        this._fade = 1;              // picture opacity — only a source-less open/close fades it
        this._res = 1;               // the <img> box is laid out at fitted size × res
        this._applied = { r: "", o: "", f: "" };

        this._anims = { T: null, Q: null, O: null, G: null, F: null };
        this._raf = 0;
        this._tIdle = false;

        this._ptrs = new Map();      // pointerId → { x, y }
        this._g = null;              // gesture in progress
        this._lastTap = null;        // touch tap waiting to learn whether it is a double tap
        this._tapTimer = 0;
        this._pull = 0;              // wheel-down travel pushing the fitted picture away (px)
        this._pullTimer = 0;
        this._latchUntil = 0;        // wheel-down holds at fit until then (it just zoomed out)
        this._pinchWheel = null;     // trackpad pinch (ctrl+wheel) in progress: { raw, fx, fy }
        this._wheelAnchor = null;    // picture point the wheel is zooming into (see _anchor)
        this._pinchWheelTimer = 0;
        this._decodeTimer = 0;
        this._prevFocus = null;
        this._reduce = false;
        this._sourceHidden = false;
        this._bound = false;
    }

    _setOverlay = (node) => { this._overlay = node; };
    _setBackdrop = (node) => { this._backdrop = node; };
    _setImg = (node) => { this._img = node; };

    /* ── Lifecycle ─────────────────────────────────────────────────────── */

    componentDidMount() {
        const src = this.props.source;
        const img = this._img, overlay = this._overlay;
        if (!img || !overlay) return;
        this._reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

        let rect = null;
        try { if (src && src.isConnected) rect = src.getBoundingClientRect(); } catch (e) {}
        const hasRect = !!(rect && rect.width > 0 && rect.height > 0);
        this._nat = {
            w: (src && src.naturalWidth) || (hasRect ? rect.width : 1),
            h: (src && src.naturalHeight) || (hasRect ? rect.height : 1),
        };
        this._L = this._computeLayout();
        if (hasRect) {
            this._srcR = readRadii(src, Math.min(rect.width, rect.height));
            this._v = this._viewFromRect(rect);
        } else {
            // Nothing on screen to fly from: grow in from just under the fitted size.
            this._v = zoomAbout(this._fitView(), 0.92, this._L.vw / 2, this._L.vh / 2);
            this._q = 1;
            this._fade = 0;
        }
        try {
            const cs = window.getComputedStyle(src);
            if (cs.imageRendering) img.style.imageRendering = cs.imageRendering;   // pixel art stays crisp
        } catch (e) {}
        this._sizeImg();
        this._apply();
        this._bind();

        this._prevFocus = document.activeElement;
        try { overlay.focus({ preventScroll: true }); } catch (e) {}

        // The copy sits exactly over the source; fly once it can paint, so
        // hiding the source never shows an empty frame.
        let started = false;
        const go = () => {
            if (started) return;
            started = true;
            clearTimeout(this._decodeTimer);
            this._decodeTimer = 0;
            if (this._phase === "init") this._startOpen(hasRect);
        };
        this._decodeTimer = setTimeout(go, DECODE_WAIT_MS);
        if (typeof img.decode === "function") img.decode().then(go, go);
        else go();
    }

    componentWillUnmount() {
        this._phase = "closed";
        this._unbind();
        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = 0;
        clearTimeout(this._tapTimer);
        clearTimeout(this._pullTimer);
        clearTimeout(this._pinchWheelTimer);
        clearTimeout(this._decodeTimer);
        this._hideSource(false);
        this._restoreFocus();
    }

    _startOpen(hasRect) {
        this._phase = "open";
        if (hasRect) this._hideSource(true);
        const ms = this._reduce ? 0 : OPEN_MS;
        this._tweenT(this._fitView(), ms, "open");
        this._tweenScalar("Q", "_q", 1, ms);
        this._tweenScalar("O", "_baseO", 1, ms);
        if (!hasRect) this._tweenScalar("F", "_fade", 1, ms);
        this._setCursor();
    }

    /** Fly home (or fade out) and call onClosed when landed. */
    close = () => {
        if (this._phase === "closing" || this._phase === "closed") return;
        this._phase = "closing";
        this._cancelTapTimer();
        this._lastTap = null;
        this._dropWheel();
        this._g = null;
        this._releaseAll();
        clearTimeout(this._decodeTimer);
        this._stopCh("G");    // keep whatever dim a drag left — it multiplies down to 0

        const ms = this._reduce ? 0 : CLOSE_MS;
        const back = this._returnView();
        if (back) {
            this._srcR = back.r;
            this._tweenT(back.v, ms, "close");
            this._tweenScalar("Q", "_q", 0, ms);
            this._tweenScalar("F", "_fade", 1, ms);
        } else {
            // The source left the page (or the screen layout): dissolve in place.
            const L = this._L, v = this._v;
            const cx = v.x + (L.baseW * v.s) / 2, cy = v.y + (L.baseH * v.s) / 2;
            this._tweenT(zoomAbout(v, v.s * 0.92, cx, cy), ms, "close");
            this._tweenScalar("F", "_fade", 0, ms);
        }
        this._tweenScalar("O", "_baseO", 0, ms);
        this._setCursor();
        this._kick();
    };

    _finish() {
        if (this._phase === "closed") return;
        this._phase = "closed";
        this._hideSource(false);
        this._restoreFocus();
        if (typeof this.props.onClosed === "function") this.props.onClosed();
    }

    _hideSource(hide) {
        if (hide === this._sourceHidden) return;
        this._sourceHidden = hide;
        try {
            const src = this.props.source;
            if (src) src.style.visibility = hide ? "hidden" : "";
        } catch (e) {}
    }

    _restoreFocus() {
        const prev = this._prevFocus;
        this._prevFocus = null;
        try {
            if (this._overlay && document.activeElement === this._overlay &&
                prev && prev.isConnected && typeof prev.focus === "function") {
                prev.focus({ preventScroll: true });
            }
        } catch (e) {}
    }

    _bind() {
        const o = this._overlay;
        if (!o || this._bound) return;
        this._bound = true;
        if (typeof window !== "undefined" && window.PointerEvent) {
            o.addEventListener("pointerdown", this._onPointerDown);
            o.addEventListener("pointermove", this._onPointerMove);
            o.addEventListener("pointerup", this._onPointerUp);
            o.addEventListener("pointercancel", this._onPointerCancel);
            o.addEventListener("lostpointercapture", this._onLostCapture);
        } else {
            o.addEventListener("click", this._onClickFallback);
        }
        o.addEventListener("wheel", this._onWheel, { passive: false });
        o.addEventListener("touchstart", this._onTouchStart, { passive: false });
        o.addEventListener("touchmove", this._onTouchMove, { passive: false });
        o.addEventListener("gesturestart", this._preventDefault);
        o.addEventListener("gesturechange", this._preventDefault);
        o.addEventListener("dragstart", this._preventDefault);
        window.addEventListener("keydown", this._onKey, true);
        window.addEventListener("resize", this._onResize);
    }

    _unbind() {
        const o = this._overlay;
        if (!this._bound) return;
        this._bound = false;
        if (o) {
            o.removeEventListener("pointerdown", this._onPointerDown);
            o.removeEventListener("pointermove", this._onPointerMove);
            o.removeEventListener("pointerup", this._onPointerUp);
            o.removeEventListener("pointercancel", this._onPointerCancel);
            o.removeEventListener("lostpointercapture", this._onLostCapture);
            o.removeEventListener("click", this._onClickFallback);
            o.removeEventListener("wheel", this._onWheel);
            o.removeEventListener("touchstart", this._onTouchStart);
            o.removeEventListener("touchmove", this._onTouchMove);
            o.removeEventListener("gesturestart", this._preventDefault);
            o.removeEventListener("gesturechange", this._preventDefault);
            o.removeEventListener("dragstart", this._preventDefault);
        }
        window.removeEventListener("keydown", this._onKey, true);
        window.removeEventListener("resize", this._onResize);
    }

    /* ── Geometry ──────────────────────────────────────────────────────── */

    _computeLayout() {
        const de = document.documentElement;
        const vw = window.innerWidth || (de && de.clientWidth) || 1;
        const vh = window.innerHeight || (de && de.clientHeight) || 1;
        const compact = vw < COMPACT_MAX_WIDTH;
        const nw = Math.max(1, this._nat.w), nh = Math.max(1, this._nat.h);
        const boxW = compact ? vw : vw * WIDE_FIT_RATIO;
        const boxH = compact ? vh : vh * WIDE_FIT_RATIO;
        const fit = Math.min(boxW / nw, boxH / nh);
        const baseW = Math.max(1, nw * fit), baseH = Math.max(1, nh * fit);
        // Scale at which the picture covers the screen: a long strip may zoom
        // that far (so it can be read edge to edge), and a double tap goes
        // straight there.
        const fill = Math.max(vw / baseW, vh / baseH);
        const maxS = Math.max(MAX_ZOOM, Math.min(fill, STRIP_FILL_LIMIT));
        const tapS = fill > STRIP_FILL_FROM ? Math.min(fill, maxS) : Math.min(DOUBLE_TAP_ZOOM, maxS);
        const short = Math.min(baseW, baseH);
        const rFit = compact ? Math.min(COMPACT_RADIUS, short / 8) : clamp(short / 5, WIDE_RADIUS_MIN, WIDE_RADIUS_MAX);
        return { vw, vh, compact, baseW, baseH, fitX: (vw - baseW) / 2, fitY: (vh - baseH) / 2, maxS, tapS, rFit };
    }

    _fitView() {
        const L = this._L;
        return { x: L.fitX, y: L.fitY, s: 1 };
    }

    // Same proportions as the fitted picture, scaled to the rect's width and
    // centred on it — the copy never stretches, even mid-flight.
    _viewFromRect(rect) {
        const L = this._L;
        const s = rect.width / L.baseW;
        return { x: rect.left, y: rect.top + (rect.height - L.baseH * s) / 2, s };
    }

    // Where the top-left may sit at scale s: centred on an axis the picture
    // doesn't fill, edge to edge on one it overflows.
    _bounds(s) {
        const L = this._L;
        const w = L.baseW * s, h = L.baseH * s;
        const minX = w <= L.vw ? (L.vw - w) / 2 : L.vw - w;
        const minY = h <= L.vh ? (L.vh - h) / 2 : L.vh - h;
        return { minX, maxX: w <= L.vw ? minX : 0, minY, maxY: h <= L.vh ? minY : 0 };
    }

    _hit(x, y) {
        const L = this._L, v = this._v;
        return x >= v.x && x <= v.x + L.baseW * v.s && y >= v.y && y <= v.y + L.baseH * v.s;
    }

    _returnView() {
        const src = this.props.source;
        if (!src || !src.isConnected || !this._L) return null;
        let r = null;
        try { r = src.getBoundingClientRect(); } catch (e) { return null; }
        if (!r || !(r.width > 0 && r.height > 0)) return null;
        return { v: this._viewFromRect(r), r: readRadii(src, Math.min(r.width, r.height)) };
    }

    _sizeImg() {
        const img = this._img, L = this._L;
        if (!img || !L) return;
        img.style.width = (L.baseW * this._res).toFixed(2) + "px";
        img.style.height = (L.baseH * this._res).toFixed(2) + "px";
        this._applied.r = "";   // corners are written in the box's own pixels
    }

    // Re-raster at rest: lay the box out at the zoomed size once a zoom has
    // settled, back to the fitted size once it is home.
    _updateResolution() {
        const L = this._L, s = this._v.s;
        let res = this._res;
        if (s > res * RES_STEP) res = Math.min(s, L.maxS);
        else if (s < 1 + ZOOM_EPS && res > 1) res = 1;
        if (res === this._res) return;
        this._res = res;
        this._sizeImg();
        this._apply();
    }

    /* ── Frame loop ────────────────────────────────────────────────────── */

    _apply() {
        const img = this._img, L = this._L;
        if (!img || !L) return;
        const v = this._v;
        const k = v.s / this._res;
        img.style.transform = "translate3d(" + v.x.toFixed(2) + "px," + v.y.toFixed(2) + "px,0) scale(" + k.toFixed(5) + ")";
        let r;
        if (this._q >= 1) {
            r = (L.rFit * this._res).toFixed(2) + "px";
        } else {
            // Visible radius blends from the source's corners to the fitted
            // ones (which scale with the picture), then is divided by the
            // transform scale so the transform can't squash it.
            const q = this._q, phys = L.rFit * v.s;
            const cap = (Math.min(L.baseW, L.baseH) * v.s) / 2;
            r = this._srcR.map((r0) => (Math.min(cap, r0 + (phys - r0) * q) / k).toFixed(2) + "px").join(" ");
        }
        if (r !== this._applied.r) {
            img.style.borderRadius = r;
            this._applied.r = r;
        }
        const o = clamp01(this._baseO * this._dim).toFixed(3);
        if (o !== this._applied.o && this._backdrop) {
            this._backdrop.style.opacity = o;
            this._applied.o = o;
        }
        const f = clamp01(this._fade).toFixed(3);
        if (f !== this._applied.f) {
            img.style.opacity = f;
            this._applied.f = f;
        }
    }

    _kick() {
        if (!this._raf && this._phase !== "closed") this._raf = requestAnimationFrame(this._frame);
    }

    _frame = (t) => {
        this._raf = 0;
        if (this._phase === "closed") return;
        let busy = false;
        const A = this._anims;
        for (let i = 0; i < CHANNELS.length; i++) {
            const ch = CHANNELS[i], a = A[ch];
            if (!a) continue;
            if (a.step(t)) busy = true;
            else if (A[ch] === a) {
                A[ch] = null;
                if (ch === "T") this._tIdle = true;
            }
        }
        this._apply();
        if (this._phase === "closing") {
            if (busy) this._kick();
            else this._finish();
            return;
        }
        this._setCursor();
        if (busy) this._kick();
        if (this._tIdle) {
            this._tIdle = false;
            this._onTIdle();
        }
    };

    // The transform stopped moving: if nothing is touching it, sharpen.
    _onTIdle() {
        if (this._phase === "open" && !this._ptrs.size && !this._pinchWheel && !this._pull && !this._anims.T) {
            this._updateResolution();
        }
        this._setCursor();
    }

    _stopCh(ch) { this._anims[ch] = null; }
    _stopT() { this._anims.T = null; }

    /* ── Animations ────────────────────────────────────────────────────── */

    // Straight-line flight in (x, y, scale) — the hero open / close.
    _tweenT(to, ms, kind) {
        this._wheelAnchor = null;
        const from = { x: this._v.x, y: this._v.y, s: this._v.s };
        const t0 = now();
        this._anims.T = {
            kind,
            step: (t) => {
                const p = ms > 0 ? clamp01((t - t0) / ms) : 1;
                const e = EASE(p);
                this._v = {
                    x: from.x + (to.x - from.x) * e,
                    y: from.y + (to.y - from.y) * e,
                    s: from.s + (to.s - from.s) * e,
                };
                return p < 1;
            },
        };
        this._kick();
    }

    _tweenScalar(ch, key, to, ms) {
        const from = this[key];
        if (!(ms > 0) || from === to) {
            this[key] = to;
            this._anims[ch] = null;
            this._kick();
            return;
        }
        const t0 = now();
        this._anims[ch] = {
            kind: "tween",
            step: (t) => {
                const p = clamp01((t - t0) / ms);
                this[key] = from + (to - from) * EASE(p);
                return p < 1;
            },
        };
        this._kick();
    }

    _springScalar(ch, key, to) {
        if (this._phase === "closing" || this._phase === "closed") return;   // the flight home owns the picture
        let d = this[key] - to, vel = 0, last = now();
        if (this._reduce || Math.abs(d) < 1e-4) {
            this[key] = to;
            this._anims[ch] = null;
            this._kick();
            return;
        }
        this._anims[ch] = {
            kind: "spring",
            step: (t) => {
                const dt = clamp(t - last, 0, 64);
                last = t;
                const e = Math.exp(-SPRING_W * dt);
                const nd = (d + (vel + SPRING_W * d) * dt) * e;
                vel = (vel - SPRING_W * (vel + SPRING_W * d) * dt) * e;
                d = nd;
                if (Math.abs(d) < 1e-3 && Math.abs(vel) < 1e-5) {
                    this[key] = to;
                    return false;
                }
                this[key] = to + d;
                return true;
            },
        };
        this._kick();
    }

    _approachScalar(ch, key, to) {
        if (this._phase === "closing" || this._phase === "closed") return;   // the flight home owns the picture
        const cur = this._anims[ch];
        if (cur && cur.kind === "approach") {
            cur.to = to;
            return;
        }
        let last = now();
        const anim = {
            kind: "approach",
            to,
            step: (t) => {
                const dt = clamp(t - last, 0, 64);
                last = t;
                const a = this._reduce ? 1 : 1 - Math.exp(-dt / WHEEL_SMOOTH_MS);
                const next = this[key] + (anim.to - this[key]) * a;
                const done = Math.abs(anim.to - next) < 1e-3;
                this[key] = done ? anim.to : next;
                return !done;
            },
        };
        this._anims[ch] = anim;
        this._kick();
    }

    // Critically damped spring to a view, starting with the release velocity.
    _springT(to, vel) {
        if (this._phase === "closing" || this._phase === "closed") return;   // the flight home owns the picture
        this._wheelAnchor = null;
        if (this._reduce) {
            this._anims.T = null;
            this._v = { x: to.x, y: to.y, s: to.s };
            this._tIdle = true;
            this._kick();
            return;
        }
        const st = [[this._v.x - to.x, vel[0]], [this._v.y - to.y, vel[1]], [this._v.s - to.s, 0]];
        let last = now();
        this._anims.T = {
            kind: "spring",
            step: (t) => {
                const dt = clamp(t - last, 0, 64);
                last = t;
                const e = Math.exp(-SPRING_W * dt);
                let busy = false;
                for (let i = 0; i < 3; i++) {
                    const d0 = st[i][0], v0 = st[i][1];
                    const d = (d0 + (v0 + SPRING_W * d0) * dt) * e;
                    const v = (v0 - SPRING_W * (v0 + SPRING_W * d0) * dt) * e;
                    st[i][0] = d;
                    st[i][1] = v;
                    if (i < 2 ? (Math.abs(d) > 0.25 || Math.abs(v) > 0.01) : (Math.abs(d) > 2e-4 || Math.abs(v) > 1e-5)) busy = true;
                }
                if (!busy) {
                    this._v = { x: to.x, y: to.y, s: to.s };
                    return false;
                }
                this._v = { x: to.x + st[0][0], y: to.y + st[1][0], s: to.s + st[2][0] };
                return true;
            },
        };
        this._kick();
    }

    // Eased approach to a view that may change every frame (wheel pull).
    _approachT(to) {
        if (this._phase === "closing" || this._phase === "closed") return;   // the flight home owns the picture
        this._wheelAnchor = null;
        const cur = this._anims.T;
        if (cur && cur.kind === "approach") {
            cur.to = to;
            return;
        }
        let last = now();
        const anim = {
            kind: "approach",
            to,
            step: (t) => {
                const dt = clamp(t - last, 0, 64);
                last = t;
                const a = this._reduce ? 1 : 1 - Math.exp(-dt / WHEEL_SMOOTH_MS);
                const g = anim.to, v = this._v;
                const x = v.x + (g.x - v.x) * a, y = v.y + (g.y - v.y) * a, s = v.s + (g.s - v.s) * a;
                const done = Math.abs(g.x - x) < 0.25 && Math.abs(g.y - y) < 0.25 && Math.abs(g.s - s) < 1e-4;
                this._v = done ? { x: g.x, y: g.y, s: g.s } : { x, y, s };
                return !done;
            },
        };
        this._anims.T = anim;
        this._kick();
    }

    // Zoom to `s2` around a screen point, scale interpolated in log space
    // (an even-feeling zoom), ending inside the bounds.
    _zoomTo(s2, fx, fy, ms) {
        if (this._phase === "closing" || this._phase === "closed") return;   // the flight home owns the picture
        this._wheelAnchor = null;
        const L = this._L, v0 = { x: this._v.x, y: this._v.y, s: this._v.s };
        const w = L.baseW * v0.s, h = L.baseH * v0.s;
        fx = clamp(fx, v0.x, v0.x + w);   // zooming on the backdrop zooms the nearest part of the picture
        fy = clamp(fy, v0.y, v0.y + h);
        const raw = zoomAbout(v0, s2, fx, fy);
        const b = this._bounds(s2);
        const ox = clamp(raw.x, b.minX, b.maxX) - raw.x;
        const oy = clamp(raw.y, b.minY, b.maxY) - raw.y;
        const lr = Math.log(s2 / v0.s);
        const dur = this._reduce ? 0 : (ms == null ? ZOOM_MS : ms);
        const t0 = now();
        this._anims.T = {
            kind: "zoom",
            step: (t) => {
                const p = dur > 0 ? clamp01((t - t0) / dur) : 1;
                const e = EASE(p);
                const s = v0.s * Math.exp(lr * e);
                const k = s / v0.s;
                this._v = { s, x: fx - (fx - v0.x) * k + ox * e, y: fy - (fy - v0.y) * k + oy * e };
                return p < 1;
            },
        };
        this._kick();
    }

    _momentumT(vel) {
        if (this._phase === "closing" || this._phase === "closed") return;   // the flight home owns the picture
        this._wheelAnchor = null;
        if (this._reduce) {
            const b = this._bounds(this._v.s);
            this._v = { s: this._v.s, x: clamp(this._v.x, b.minX, b.maxX), y: clamp(this._v.y, b.minY, b.maxY) };
            this._anims.T = null;
            this._tIdle = true;
            this._kick();
            return;
        }
        const ax = { pos: this._v.x, vel: vel[0], done: false };
        const ay = { pos: this._v.y, vel: vel[1], done: false };
        let last = now();
        this._anims.T = {
            kind: "momentum",
            step: (t) => {
                const dt = clamp(t - last, 0, 64);
                last = t;
                const b = this._bounds(this._v.s);
                stepAxis(ax, dt, b.minX, b.maxX);
                stepAxis(ay, dt, b.minY, b.maxY);
                this._v = { s: this._v.s, x: ax.pos, y: ay.pos };
                return !(ax.done && ay.done);
            },
        };
        this._kick();
    }

    // After a gesture: scale back into range around the focal point, else
    // glide with the release velocity and bounce off the edges.
    _settle(vel, focal) {
        const L = this._L, v = this._v;
        if (this._dim !== 1) this._springScalar("G", "_dim", 1);
        const sT = clamp(v.s, 1, L.maxS);
        if (Math.abs(sT - v.s) > 1e-3) {
            const F = focal || { x: L.vw / 2, y: L.vh / 2 };
            this._zoomTo(sT, F.x, F.y);
            return;
        }
        const b = this._bounds(v.s);
        const out = v.x < b.minX - 0.5 || v.x > b.maxX + 0.5 || v.y < b.minY - 0.5 || v.y > b.maxY + 0.5;
        if (!out && Math.hypot(vel[0], vel[1]) < 0.05) {
            this._v = { s: v.s, x: clamp(v.x, b.minX, b.maxX), y: clamp(v.y, b.minY, b.maxY) };
            this._tIdle = true;
            this._kick();
            return;
        }
        this._momentumT(vel);
    }

    /* ── Pointer gestures ──────────────────────────────────────────────── */

    _two() {
        const it = this._ptrs.values();
        const a = it.next().value, b = it.next().value;
        return a && b ? [a, b] : null;
    }

    _releaseAll() {
        const o = this._overlay;
        this._ptrs.forEach((p, id) => {
            try { if (o && o.hasPointerCapture && o.hasPointerCapture(id)) o.releasePointerCapture(id); } catch (e) {}
        });
        this._ptrs.clear();
    }

    _onPointerDown = (e) => {
        if (this._phase !== "open") return;
        if (e.pointerType === "mouse" && e.button !== 0) return;
        if (e.cancelable) e.preventDefault();
        try { this._overlay.setPointerCapture(e.pointerId); } catch (err) {}
        this._ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        this._dropWheel();
        const t = eventTime(e);
        if (this._ptrs.size === 1) {
            const type = e.pointerType || "mouse";
            // A press catches a gliding or settling picture where it is (and
            // that press is then not a tap). The opening flight lands anyway.
            const T = this._anims.T;
            const caught = !!(T && T.kind !== "open");
            if (caught) this._stopT();
            // Second press of a possible double tap: the first tap's fate is
            // decided by this one.
            let double = false;
            const last = this._lastTap;
            if (last && type !== "mouse") {
                double = t - last.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - last.x, e.clientY - last.y) < DOUBLE_TAP_SLOP;
                this._cancelTapTimer();
                this._lastTap = null;
            }
            this._g = { mode: "pending", type, sx: e.clientX, sy: e.clientY, t0: t, caught, double,
                s0: this._v.s, samples: [[t, e.clientX, e.clientY]] };
        } else if (this._ptrs.size === 2) {
            this._beginPinch(t);
        }
    };

    _beginPinch(t) {
        const pts = this._two();
        if (!pts) return;
        const [a, b] = pts;
        this._cancelTapTimer();
        this._lastTap = null;
        this._stopT();
        this._stopCh("G");
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const prev = this._g;
        this._g = {
            mode: "pinch",
            type: "touch",
            s0: prev && prev.s0 != null ? prev.s0 : this._v.s,   // where this touch sequence began
            v0: { x: this._v.x, y: this._v.y, s: this._v.s },
            raw0: unsoftScale(this._v.s, this._L.maxS),
            mid0: mid,
            dist0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
            dim0: this._dim,
            focal: mid,
            samples: [[t, mid.x, mid.y]],
        };
        this._setCursor();
    }

    _onPointerMove = (e) => {
        const p = this._ptrs.get(e.pointerId);
        if (!p) return;
        p.x = e.clientX;
        p.y = e.clientY;
        const g = this._g;
        if (!g || this._phase !== "open") return;
        const t = eventTime(e);
        if (g.mode === "pinch") {
            this._pinchMove(t);
            return;
        }
        if (this._ptrs.size > 1) return;
        const L = this._L;
        if (g.mode === "pending") {
            const dx = p.x - g.sx, dy = p.y - g.sy;
            const slop = g.type === "mouse" ? TAP_SLOP_MOUSE : TAP_SLOP_TOUCH;
            if (dx * dx + dy * dy < slop * slop) return;
            // It's a drag. Take the picture from wherever it is (even mid-flight).
            this._stopT();
            g.mode = this._v.s > 1 + ZOOM_EPS ? "pan" : "dismiss";
            g.sx = p.x;
            g.sy = p.y;
            g.lastY = p.y;
            g.v0 = { x: this._v.x, y: this._v.y, s: this._v.s };
            g.samples = [];
            if (g.mode === "pan") {
                const b = this._bounds(this._v.s);
                g.rawX0 = unrubberClamp(this._v.x, b.minX, b.maxX, L.vw);
                g.rawY0 = unrubberClamp(this._v.y, b.minY, b.maxY, L.vh);
            } else {
                this._stopCh("G");
                g.dim0 = this._dim;
                g.scroll = g.type !== "mouse" && typeof this.props.onDragScroll === "function";
            }
            this._setCursor();
        }
        pushSample(g.samples, t, p.x, p.y);
        if (g.mode === "pan") {
            const b = this._bounds(this._v.s);
            this._v = {
                s: this._v.s,
                x: rubberClamp(g.rawX0 + (p.x - g.sx), b.minX, b.maxX, L.vw),
                y: rubberClamp(g.rawY0 + (p.y - g.sy), b.minY, b.maxY, L.vh),
            };
        } else if (g.mode === "dismiss") {
            // Follows the finger, shrinking around the grabbed point.
            const travel = p.y - g.sy;
            const pull = Math.min(1, Math.abs(travel) / (L.vh * 0.5));
            const s = g.v0.s * (1 - DISMISS_SHRINK * pull);
            const ux = (g.sx - g.v0.x) / g.v0.s, uy = (g.sy - g.v0.y) / g.v0.s;
            this._v = { s, x: p.x - ux * s, y: p.y - uy * s };
            this._dim = g.dim0 * (1 - Math.min(1, Math.abs(travel) / (L.vh * DISMISS_FADE_RATIO)));
            // The article moves with the finger underneath, so the gap the
            // picture left travels along and the flight home stays short.
            if (g.scroll) {
                const step = p.y - g.lastY;
                if (step) this.props.onDragScroll(-step);
            }
            g.lastY = p.y;
        }
        this._kick();
    };

    _pinchMove(t) {
        const g = this._g, L = this._L;
        const pts = this._two();
        if (!pts) return;
        const [a, b] = pts;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
        const s = Math.max(MIN_SCALE, softScale((g.raw0 * dist) / g.dist0, L.maxS));
        // The picture point first under the fingers stays under them.
        const ux = (g.mid0.x - g.v0.x) / g.v0.s, uy = (g.mid0.y - g.v0.y) / g.v0.s;
        this._v = { s, x: mx - ux * s, y: my - uy * s };
        this._dim = Math.min(g.dim0, s < 1 ? clamp01((s - 0.45) / 0.55) : 1);
        g.focal = { x: mx, y: my };
        pushSample(g.samples, t, mx, my);
        this._kick();
    }

    _onPointerUp = (e) => this._release(e, false);
    _onPointerCancel = (e) => this._release(e, true);
    _onLostCapture = (e) => {
        if (this._ptrs.has(e.pointerId)) this._release(e, true);
    };

    _release(e, cancelled) {
        const p = this._ptrs.get(e.pointerId);
        if (!p) return;
        if (!cancelled) {
            p.x = e.clientX;
            p.y = e.clientY;
        }
        this._ptrs.delete(e.pointerId);
        try {
            const o = this._overlay;
            if (o && o.hasPointerCapture && o.hasPointerCapture(e.pointerId)) o.releasePointerCapture(e.pointerId);
        } catch (err) {}
        const g = this._g;
        if (!g || this._phase !== "open") {
            if (!this._ptrs.size) this._g = null;
            return;
        }
        const t = eventTime(e);
        if (g.mode === "pinch") {
            if (this._ptrs.size >= 2) {
                this._beginPinch(t);
                return;
            }
            if (this._ptrs.size === 1) {
                // One finger stays: carry on as a pan from exactly here.
                const q = this._ptrs.values().next().value;
                const L = this._L, b = this._bounds(this._v.s);
                this._g = {
                    mode: "pan",
                    type: g.type,
                    sx: q.x,
                    sy: q.y,
                    t0: t,
                    v0: { x: this._v.x, y: this._v.y, s: this._v.s },
                    rawX0: unrubberClamp(this._v.x, b.minX, b.maxX, L.vw),
                    rawY0: unrubberClamp(this._v.y, b.minY, b.maxY, L.vh),
                    focal: g.focal,
                    s0: g.s0,
                    samples: [[t, q.x, q.y]],
                };
                return;
            }
            this._g = null;
            this._endGesture(g, [0, 0], cancelled, p);
            return;
        }
        if (this._ptrs.size) return;
        this._g = null;
        if (g.mode === "pending") {
            if (!cancelled && !g.caught && t - g.t0 < TAP_MAX_MS) this._onTap(p.x, p.y, g.type, t, g.double);
            else this._settle([0, 0], null);
            this._setCursor();
            return;
        }
        const vel = cancelled ? [0, 0] : releaseVelocity(g.samples, t);
        this._endGesture(g, vel, cancelled, p);
    }

    _endGesture(g, vel, cancelled, p) {
        const L = this._L;
        if (g.mode === "dismiss") {
            const travel = (p ? p.y : g.sy) - g.sy;
            const vy = vel[1];
            const far = Math.abs(travel) > Math.max(DISMISS_MIN_PX, L.vh * DISMISS_RATIO);
            const flick = Math.abs(vy) > DISMISS_VELOCITY && Math.abs(travel) > DISMISS_FLICK_MIN_PX && (vy > 0) === (travel > 0);
            if (!cancelled && (far || flick)) {
                this.close();
                return;
            }
            this._springT(this._fitView(), vel);
            this._springScalar("G", "_dim", 1);
            this._setCursor();
            return;
        }
        // pan, or a pinch that ended with both fingers at once. Close only
        // when the gesture itself shrank the picture: one grabbed small,
        // mid-flight, and spread a little is still on its way in.
        const s0 = g.s0 != null ? g.s0 : 1;
        if (!cancelled && this._v.s < PINCH_CLOSE_SCALE && this._v.s < s0 - 0.02) {
            this.close();
            return;
        }
        this._settle(vel, g.focal || (p ? { x: p.x, y: p.y } : null));
        this._setCursor();
    }

    /* ── Taps ──────────────────────────────────────────────────────────── */

    _onTap(x, y, type, t, double) {
        if (double) {
            this._toggleZoom(x, y);
            return;
        }
        if (type === "mouse") {
            this._tapAction(x, y);
            return;
        }
        // Touch: wait a beat — a second tap makes it a double tap.
        this._lastTap = { x, y, t };
        this._cancelTapTimer();
        this._tapTimer = setTimeout(() => {
            this._tapTimer = 0;
            this._lastTap = null;
            this._tapAction(x, y);
        }, DOUBLE_TAP_MS);
    }

    _cancelTapTimer() {
        if (this._tapTimer) clearTimeout(this._tapTimer);
        this._tapTimer = 0;
    }

    // On the picture: zoomed → back to fit, fitted → close. Backdrop: close.
    _tapAction(x, y) {
        if (this._phase !== "open") return;
        if (this._hit(x, y) && this._v.s > 1 + ZOOM_EPS) {
            this._zoomTo(1, x, y);
            return;
        }
        this.close();
    }

    _toggleZoom(x, y) {
        if (this._v.s > 1 + ZOOM_EPS) this._zoomTo(1, x, y);
        else this._zoomTo(this._L.tapS, x, y);
    }

    _onClickFallback = () => this.close();

    _onTouchStart = (e) => {
        if (e.touches && e.touches.length > 1 && e.cancelable) e.preventDefault();   // no page zoom
    };

    _onTouchMove = (e) => {
        if (e.cancelable) e.preventDefault();
    };

    _preventDefault = (e) => {
        if (e.cancelable) e.preventDefault();
    };

    /* ── Wheel ─────────────────────────────────────────────────────────── */
    // Wheel up zooms in around the cursor, wheel down zooms back out. Once
    // fitted, further wheel-down pushes the picture away and scrolls the
    // article along (the old "scroll to dismiss") — but not in the same
    // scroll that just zoomed it out: that one holds at fit until the wheel
    // pauses. Trackpad pinch (ctrl+wheel) zooms continuously and, like a
    // touch pinch, can shrink the picture home.
    //
    // Nothing here depends on the rhythm of the notches: the zoom target
    // lives on the running animation, and a pull only springs back after
    // the wheel has been still for a while.

    _onWheel = (e) => {
        if (e.cancelable) e.preventDefault();
        if (this._phase !== "open" || this._ptrs.size) return;
        const L = this._L;
        let dx = e.deltaX || 0, dy = e.deltaY || 0;
        if (e.deltaMode === 1) { dx *= WHEEL_LINE_PX; dy *= WHEEL_LINE_PX; }
        else if (e.deltaMode === 2) { dx *= L.vw; dy *= L.vh; }
        if (e.shiftKey && !dx) { dx = dy; dy = 0; }   // shift+wheel scrolls sideways
        const fx = e.clientX, fy = e.clientY;
        if (e.ctrlKey) {
            if (dy) this._wheelPinch(dy, fx, fy);
            return;
        }
        if (this._pinchWheel) {
            this._endPinchWheel();
            if (this._phase !== "open") return;   // that pinch sent it home
        }
        if (Math.abs(dx) > Math.abs(dy)) {
            this._wheelPan(dx);
            return;
        }
        if (!dy) return;
        const t = now();
        const step = clamp(dy, -WHEEL_STEP_MAX, WHEEL_STEP_MAX);
        if (step < 0) {
            this._latchUntil = 0;
            if (this._pull > 0) this._wheelPull(step);
            else this._wheelZoom(Math.exp(-step * WHEEL_ZOOM_RATE), fx, fy);
            return;
        }
        if (this._wheelGoal() > 1 + ZOOM_EPS) {
            this._wheelZoom(Math.exp(-step * WHEEL_ZOOM_RATE), fx, fy);
            if (this._wheelGoal() <= 1 + 1e-6) this._latchUntil = t + WHEEL_LATCH_MS;
            return;
        }
        if (t < this._latchUntil) {
            this._latchUntil = t + WHEEL_LATCH_MS;   // still the scroll that zoomed it out
            return;
        }
        this._wheelPull(step);
    };

    // Sideways wheel (trackpad, tilt wheel, shift+wheel) pans a zoomed picture.
    _wheelPan(dx) {
        if (this._phase !== "open") return;
        const v = this._v;
        if (v.s <= 1 + ZOOM_EPS) return;
        this._stopT();
        this._wheelAnchor = null;
        const b = this._bounds(v.s);
        this._v = {
            s: v.s,
            x: clamp(v.x - clamp(dx, -WHEEL_STEP_MAX, WHEEL_STEP_MAX), b.minX, b.maxX),
            y: clamp(v.y, b.minY, b.maxY),
        };
        this._tIdle = true;
        this._kick();
    }

    // Where the wheel is taking the zoom (the running animation's goal).
    _wheelGoal() {
        const T = this._anims.T;
        return T && T.kind === "wheel" ? T.goal : this._v.s;
    }

    _wheelZoom(factor, fx, fy) {
        if (this._phase === "closing" || this._phase === "closed") return;   // the flight home owns the picture
        const L = this._L;
        let T = this._anims.T;
        if (!(T && T.kind === "wheel")) {
            let last = now();
            const anim = {
                kind: "wheel",
                goal: this._v.s,
                anchor: null,
                ox: 0,
                oy: 0,
                step: (t) => {
                    const dt = clamp(t - last, 0, 64);
                    last = t;
                    const goal = anim.goal;
                    const a = this._reduce ? 1 : 1 - Math.exp(-dt / WHEEL_SMOOTH_MS);
                    let s = this._v.s + (goal - this._v.s) * a;
                    if (Math.abs(goal - s) < goal * 0.0015) s = goal;
                    // The anchored picture point goes back under the cursor (the
                    // bounds win while the picture is smaller than the screen);
                    // whatever offset it started with eases out.
                    anim.ox = Math.abs(anim.ox) < 0.25 ? 0 : anim.ox * (1 - a);
                    anim.oy = Math.abs(anim.oy) < 0.25 ? 0 : anim.oy * (1 - a);
                    const tg = this._wheelTarget(anim.anchor, s);
                    this._v = { s, x: tg.x + anim.ox, y: tg.y + anim.oy };
                    return s !== goal || anim.ox !== 0 || anim.oy !== 0;
                },
            };
            this._anims.T = T = anim;
        }
        const A = this._wheelAnchorAt(fx, fy);
        if (A !== T.anchor) {
            // Take over from exactly where the picture is — mid-flight, mid-spring,
            // past an edge — and ease out the distance to the anchored spot.
            T.anchor = A;
            const v = this._v, tg = this._wheelTarget(A, v.s);
            T.ox = v.x - tg.x;
            T.oy = v.y - tg.y;
        }
        T.goal = clamp(T.goal * factor, 1, L.maxS);
        if (this._dim !== 1) this._springScalar("G", "_dim", 1);
        this._kick();
    }

    // Where a wheel / trackpad zoom puts the picture at scale s: the anchored
    // point under the cursor, kept inside the bounds; below the fitted size,
    // shrinking around the screen centre (on its way home).
    _wheelTarget(A, s) {
        const L = this._L;
        if (s < 1) {
            const f = zoomAbout(this._fitView(), s, L.vw / 2, L.vh / 2);
            return { x: f.x, y: f.y };
        }
        const b = this._bounds(s);
        return {
            x: clamp(A.px - A.ux * L.baseW * s, b.minX, b.maxX),
            y: clamp(A.py - A.uy * L.baseH * s, b.minY, b.maxY),
        };
    }

    // The picture point a wheel / trackpad zoom keeps under the cursor. It
    // stays the same while the cursor stays put and the notches keep coming,
    // so zooming in from the fitted size — where the picture first has to
    // stay centred — still ends on the detail that was pointed at, instead
    // of drifting by the centring of every notch.
    _wheelAnchorAt(fx, fy) {
        const t = now(), a = this._wheelAnchor;
        if (a && t - a.t < WHEEL_ANCHOR_MS && Math.abs(fx - a.fx) < 3 && Math.abs(fy - a.fy) < 3) {
            a.t = t;
            return a;
        }
        const n = { t };
        this._anchor(n, fx, fy);
        this._wheelAnchor = n;
        return n;
    }

    // Pin the picture point under (fx, fy) — or the nearest point of the
    // picture, from the backdrop.
    _anchor(a, fx, fy) {
        const L = this._L, v = this._v;
        const W = L.baseW * v.s, H = L.baseH * v.s;
        a.px = clamp(fx, v.x, v.x + W);
        a.py = clamp(fy, v.y, v.y + H);
        a.ux = (a.px - v.x) / W;
        a.uy = (a.py - v.y) / H;
        a.fx = fx;
        a.fy = fy;
    }

    _wheelPull(step) {
        if (this._phase === "closing" || this._phase === "closed") return;   // the flight home owns the picture
        const L = this._L;
        const prev = this._pull;
        this._pull = clamp(prev + step, 0, WHEEL_DISMISS_PX);
        const moved = this._pull - prev;
        if (moved && typeof this.props.onDragScroll === "function") this.props.onDragScroll(moved);
        clearTimeout(this._pullTimer);
        this._pullTimer = 0;
        if (this._pull >= WHEEL_DISMISS_PX) {
            this._pull = 0;
            this.close();
            return;
        }
        const k = this._pull / WHEEL_DISMISS_PX;
        this._approachT(zoomAbout(this._fitView(), 1 - WHEEL_PULL_SHRINK * k, L.vw / 2, L.vh / 2));
        this._approachScalar("G", "_dim", 1 - WHEEL_PULL_DIM * k);
        if (this._pull > 0) this._pullTimer = setTimeout(this._releasePull, WHEEL_PULL_HOLD_MS);
    }

    // The wheel went still before the picture was pushed all the way: back.
    _releasePull = () => {
        this._pullTimer = 0;
        if (this._phase !== "open" || !this._pull) return;
        this._pull = 0;
        this._springT(this._fitView(), [0, 0]);
        this._springScalar("G", "_dim", 1);
    };

    _wheelPinch(dy, fx, fy) {
        if (this._phase === "closing" || this._phase === "closed") return;   // the flight home owns the picture
        const L = this._L;
        if (this._pull) {
            clearTimeout(this._pullTimer);
            this._pullTimer = 0;
            this._pull = 0;
        }
        const t = now();
        let pw = this._pinchWheel;
        if (!pw) pw = this._pinchWheel = { raw: unsoftScale(this._v.s, L.maxS), s0: this._v.s, fx, fy, t, anchor: null, ox: 0, oy: 0 };
        const A = this._wheelAnchorAt(fx, fy);
        pw.fx = fx;
        pw.fy = fy;
        clearTimeout(this._pinchWheelTimer);
        this._pinchWheelTimer = setTimeout(this._endPinchWheel, PINCH_WHEEL_IDLE_MS);
        this._stopT();
        this._stopCh("G");
        const v = this._v;
        if (A !== pw.anchor) {
            // Start from exactly where the picture is (see _wheelZoom).
            pw.anchor = A;
            const tg = this._wheelTarget(A, v.s);
            pw.ox = v.x - tg.x;
            pw.oy = v.y - tg.y;
        } else {
            const k = this._reduce ? 0 : Math.exp(-clamp(t - pw.t, 0, 200) / WHEEL_SMOOTH_MS);
            pw.ox = Math.abs(pw.ox) < 0.25 ? 0 : pw.ox * k;
            pw.oy = Math.abs(pw.oy) < 0.25 ? 0 : pw.oy * k;
        }
        pw.t = t;
        const rate = Math.abs(dy) < PINCH_WHEEL_MAX_DELTA ? PINCH_WHEEL_RATE : WHEEL_ZOOM_RATE;
        pw.raw = clamp(pw.raw * Math.exp(-clamp(dy, -WHEEL_STEP_MAX, WHEEL_STEP_MAX) * rate), 0.05, L.maxS * 4);
        const s = Math.max(MIN_SCALE, softScale(pw.raw, L.maxS));
        const tg = this._wheelTarget(A, s);
        this._v = { s, x: tg.x + pw.ox, y: tg.y + pw.oy };
        this._dim = s < 1 ? clamp01((s - 0.45) / 0.55) : 1;
        this._kick();
    }

    // Trackpad pinch ended: shrunk far enough → home, else back into range.
    _endPinchWheel = () => {
        clearTimeout(this._pinchWheelTimer);
        this._pinchWheelTimer = 0;
        const pw = this._pinchWheel;
        this._pinchWheel = null;
        if (!pw || this._phase !== "open") return;
        if (this._v.s < PINCH_CLOSE_SCALE && this._v.s < pw.s0 - 0.02) {
            this.close();
            return;
        }
        this._settle([0, 0], { x: pw.fx, y: pw.fy });
    };

    // A finger, a resize or closing takes over from the wheel: forget it
    // (whatever comes next settles the picture).
    _dropWheel() {
        this._wheelAnchor = null;
        clearTimeout(this._pullTimer);
        clearTimeout(this._pinchWheelTimer);
        this._pullTimer = 0;
        this._pinchWheelTimer = 0;
        this._pull = 0;
        this._pinchWheel = null;
        this._latchUntil = 0;
    }

    /* ── Keyboard & viewport ───────────────────────────────────────────── */

    _onKey = (e) => {
        if (this._phase === "closed") return;
        const key = e.key;
        if (key === "Escape" || key === "Esc") {
            e.preventDefault();
            e.stopPropagation();
            this.close();
            return;
        }
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (this._phase !== "open") {
            if (SCROLL_KEYS.has(key)) e.preventDefault();   // the page stays still under the flight
            return;
        }
        const L = this._L, v = this._v;
        const cx = L.vw / 2, cy = L.vh / 2;
        if (key === "+" || key === "=" || key === "-" || key === "_" || key === "0" || key.startsWith("Arrow")) {
            // Keys take over from the wheel: a pending pull must not spring
            // back over the zoom they start, and whatever the wheel left
            // half-done (pushed away, pinched small) settles first — the
            // key's own zoom / pan below replaces that if it moves anything.
            const unsettled = this._pull > 0 || !!this._pinchWheel;
            this._dropWheel();
            if (unsettled) this._settle([0, 0], null);
            else if (this._dim !== 1) this._springScalar("G", "_dim", 1);
        }
        const base = Math.max(1, v.s);   // from the fitted size if it was pushed / pinched smaller
        let handled = true;
        switch (key) {
            case "+":
            case "=":
                this._zoomTo(clamp(base * KEY_ZOOM, 1, L.maxS), cx, cy);
                break;
            case "-":
            case "_":
                this._zoomTo(clamp(base / KEY_ZOOM, 1, L.maxS), cx, cy);
                break;
            case "0":
                this._zoomTo(1, cx, cy);
                break;
            case "ArrowLeft":
            case "ArrowRight":
            case "ArrowUp":
            case "ArrowDown":
                if (v.s > 1 + ZOOM_EPS) {
                    const d = KEY_PAN_RATIO * Math.min(L.vw, L.vh);
                    const dx = key === "ArrowLeft" ? d : key === "ArrowRight" ? -d : 0;
                    const dy = key === "ArrowUp" ? d : key === "ArrowDown" ? -d : 0;
                    const b = this._bounds(v.s);
                    this._springT({ s: v.s, x: clamp(v.x + dx, b.minX, b.maxX), y: clamp(v.y + dy, b.minY, b.maxY) }, [0, 0]);
                }
                break;
            default:
                handled = SCROLL_KEYS.has(key);
        }
        if (handled) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    // Rotation / window resize: refit (zoom resets — the old geometry is gone).
    _onResize = () => {
        if (this._phase !== "open" && this._phase !== "init") return;
        const old = this._L;
        const L = this._computeLayout();
        if (old && old.vw === L.vw && old.vh === L.vh) return;
        this._L = L;
        this._g = null;
        this._releaseAll();
        this._dropWheel();
        this._cancelTapTimer();
        this._lastTap = null;
        this._stopT();
        this._stopCh("G");
        this._dim = 1;
        this._res = 1;
        this._sizeImg();
        if (this._phase === "init") {
            const back = this._returnView();
            this._v = back ? back.v : zoomAbout(this._fitView(), 0.92, L.vw / 2, L.vh / 2);
        } else {
            this._v = this._fitView();
        }
        this._apply();
        this._setCursor();
    };

    _setCursor() {
        const o = this._overlay;
        if (!o) return;
        let c = "zoom-out";
        if (this._phase === "closing" || this._phase === "closed") c = "";
        else if (this._g && this._g.mode === "pan") c = "grabbing";
        else if (this._v.s > 1 + ZOOM_EPS) c = "grab";
        if (o.style.cursor !== c) o.style.cursor = c;
    }

    render() {
        const { src, alt } = this.props;
        return (
            <div
                ref={this._setOverlay}
                style={OVERLAY_STYLE}
                role="dialog"
                aria-modal="true"
                aria-label={alt || undefined}
                tabIndex={-1}
            >
                <div ref={this._setBackdrop} style={BACKDROP_STYLE} />
                <img ref={this._setImg} style={IMAGE_STYLE} src={src} alt={alt || ""} draggable={false} />
            </div>
        );
    }
}
