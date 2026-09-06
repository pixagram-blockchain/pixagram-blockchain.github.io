import * as React from "preact/compat";
import { useReducer, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import Backdrop from "@material-ui/core/Backdrop";
import Portal from "@material-ui/core/Portal";
import { crtF, hexF, sqrF, triF, xbrzF, acquireBestCachedBitmap } from "../utils/render-pool";
import { pngdby } from "../utils/png-db";

/* ══════════════════════════════════════════════════════════════════════
 * PictureDialog — fullscreen viewer for a profile / community picture.
 *
 * PostDialog's image half, and nothing else: the blurred greyscale
 * Backdrop, the two blur backplates, the bitmaprenderer canvas painted by
 * the render pool with the user's CURRENT renderer/mode (square, hexagon,
 * xBRZ, CRT, tri), wheel / drag / pinch, the FLIP hero from the clicked
 * element and the reverse hero back onto it on close. No drawer, no
 * arrows, no comments, no download.
 *
 * Contract with the host (see hooks/usePictureDialog.js, which the pages
 * use to satisfy it):
 *   open            bool
 *   src             the picture (data URI or URL)
 *   renderer, mode  settings._renderer / settings._mode
 *   originRect      { left, top, width, height, radius:[tl,tr,br,bl] } of the
 *                   clicked element, or null → plain scale-in
 *   getReturnRect   () → same shape, live, or null → plain fade-out
 *   onClose         fires once the close animation has landed — the host
 *                   then pops its "#picture" history entry
 *   pictureId       optional render-pool cache key (default: content hash)
 *
 * History is deliberately NOT handled here (same split as PostDialog ↔
 * usePostNavigation): the dialog only asks to close; the host owns the URL.
 * ══════════════════════════════════════════════════════════════════════ */

// ── Layout constants (PostDialog's, minus the drawer) ────────────────
const STYLE_ROOT_CONTAINER = Object.freeze({ userSelect: "none", width: "100%", height: "100%", display: "flex", overflow: "hidden", contain: "size style layout" });
const STYLE_CLOSE_OVERLAY = Object.freeze({ position: "absolute", left: 0, top: 0, width: "100%", height: "100%" });
const STYLE_IMG_ANIM_INNER = Object.freeze({
    userSelect: "none", touchAction: "none", pointerEvents: "none",
    transformOrigin: "50% 50%",
    contain: "layout style",
});
const STYLE_BLUR_1 = Object.freeze({ contain: "strict", contentVisibility: "auto", userSelect: "none", touchAction: "none", pointerEvents: "none", position: "absolute", zIndex: -2, width: "100%", height: "100%", filter: "blur(108px) brightness(1.314)" });
const STYLE_BLUR_2 = Object.freeze({ contain: "strict", contentVisibility: "auto", userSelect: "none", touchAction: "none", pointerEvents: "none", position: "absolute", zIndex: -1, width: "100%", height: "100%", filter: "blur(192px) brightness(1.618)" });
// Visibility and border-radius are NOT declared here on purpose — both are
// owned by imperative DOM writes (visibility flips in setImgd after the
// paint; the radius is animated during hero flights), and a React-managed
// value would clobber them on the next render. Width/height stay React-
// managed because they track `_size`. See PostDialog's STYLE_CANVAS_CONTEXT.
const STYLE_CANVAS_CONTEXT = Object.freeze({ zIndex: 1, userSelect: "none", touchAction: "none", pointerEvents: "initial" });

const PREVENT_CONTEXT = (e) => { e.preventDefault(); e.stopImmediatePropagation(); };
const ZERO_RADIUS = Object.freeze([0, 0, 0, 0]);
const EMPTY_META = Object.freeze({ imgd: null, width: 0, height: 0 });
const HERO_MS = 420;       // transition length of classes.heroTransition
const HERO_SETTLE_MS = 460; // open-hero cleanup timer (transition + a frame)
const CLOSE_LAND_MS = 440;  // reverse-hero landing → props.onClose
const CLOSE_RESET_MS = 600; // Backdrop fade-out before the canvas is dropped

const transformFor = (left, top, zoom) =>
    `translate3d(calc(${left}px - 50%), calc(${top}px - 50%), 0) scale(${(zoom / 3).toFixed(4)})`;

// PostDialog's canvas radius rule: rounded for the two smoothing renderers,
// square-cornered for the others; divided by zoom so the VISUAL radius stays
// put while the wrapper's transform scale changes.
const rendererRadius = (renderer, zoom) =>
    (renderer === "xbrz" || renderer === "tri") ? (128 / (window.devicePixelRatio || 1) / (zoom || 1) | 0) : 0;
const radiusCss = (r) => `${r.toFixed(2)}px ${r.toFixed(2)}px ${r.toFixed(2)}px ${r.toFixed(2)}px`;
// Four visual corner radii (px on screen) → the canvas-local css that
// displays as exactly those radii once the wrapper is scaled by zoom / 3.
const localRadiusCss = (visual, zoom) => {
    const k = zoom / 3 || 1;
    const v = visual && visual.length === 4 ? visual : ZERO_RADIUS;
    return v.map((x) => `${(Math.max(0, x) / k).toFixed(2)}px`).join(" ");
};

// Content-keyed cache id for the render pool. Artwork ids are the post's
// numeric id; a picture has none, and keying by username would serve a
// stale render after a profile-picture change — so key by the bytes.
function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36);
}
const pictureIdFor = (src) => "picture:" + (src ? src.length.toString(36) + "-" + fnv1a(src) : "none");

function createCanvas(width, height) {
    let canvas;
    if ("OffscreenCanvas" in window) {
        canvas = new OffscreenCanvas(width, height);
    } else {
        canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
    }
    canvas.ctx = canvas.getContext("2d", { willReadFrequently: true });
    return canvas;
}

// Generic decode for a picture the pixel-art decoder can't take (a plain
// https URL, a non-PNG). Reads the pixels back through a 2d canvas so the
// render pool gets real ImageData; a cross-origin image whose host sends
// no CORS header taints the canvas — in that case we keep the decoded
// bitmap and paint it directly, unrendered (the only thing that CAN be
// shown for it).
function loadViaImage(src) {
    return new Promise((resolve) => {
        let done = false;
        const finish = (v) => { if (!done) { done = true; resolve(v); } };
        const img = new Image();
        if (!/^data:/i.test(src)) img.crossOrigin = "anonymous";
        img.decoding = "async";
        img.onerror = () => finish(null);
        img.onload = () => {
            const w = img.naturalWidth, h = img.naturalHeight;
            if (!w || !h) return finish(null);
            try {
                const c = createCanvas(w, h);
                c.ctx.drawImage(img, 0, 0);
                const imgd = c.ctx.getImageData(0, 0, w, h);
                finish({ imgd, width: w, height: h, bitmap: null });
            } catch (e) {
                if (typeof createImageBitmap !== "function") return finish(null);
                createImageBitmap(img)
                    .then((bitmap) => finish({ imgd: null, width: w, height: h, bitmap }))
                    .catch(() => finish(null));
            }
        };
        img.src = src;
    });
}

// Same decoder PostDialog uses for artworks first (WASM PNG path + its
// decoded-source cache), generic <img> path second.
async function decodeSource(src) {
    if (!src) return null;
    try {
        const imgOBJ = await pngdby.get_new_img_obj(src);
        const imgd = await pngdby.get_new_img_data(imgOBJ);
        if (imgd && imgd.width > 0 && imgd.height > 0) {
            return { imgd, width: imgd.width, height: imgd.height, bitmap: null };
        }
    } catch (e) {}
    return loadViaImage(src);
}

const styles = (theme) => ({
    backdrop: {
        zIndex: theme.zIndex.drawer + 1,
        backdropFilter: "blur(9px) grayscale(1)",
        overflow: "hidden",
        userSelect: "none",
    },
    // PostDialog's viewLeft spanning the whole viewport (no drawer to leave
    // room for). `position: inherit` resolves to the Backdrop's `fixed`, and
    // the transform makes this the containing block of the fixed image
    // wrapper — anchored at the viewport origin, so posLeft/posTop are
    // viewport coordinates and the geometry never needs measuring.
    view: {
        width: "100%",
        height: "100%",
        position: "inherit",
        contain: "layout style size",
        transform: "translateZ(0px)",
        zIndex: -1,
    },
    hidden: {
        filter: "opacity(0)",
        transform: "scale(.5)",
        transformOrigin: "50% 50%",
        transition: "transform 220ms cubic-bezier(0.3, 0, 0.8, 0.15), filter 260ms cubic-bezier(0.3, 0, 0.8, 0.15)",
        willChange: "transform, filter, opacity",
        backfaceVisibility: "hidden",
        contain: "layout style",
    },
    appear: {
        filter: "opacity(1)",
        transform: "scale(1)",
        transformOrigin: "50% 50%",
        transition: "transform 350ms cubic-bezier(0.2, 0.9, 0.3, 1), filter 320ms cubic-bezier(0.2, 0.9, 0.3, 1)",
        willChange: "auto",
        backfaceVisibility: "hidden",
        contain: "layout style",
    },
    heroAppear: {
        filter: "opacity(1)",
        transform: "none",
        transformOrigin: "50% 50%",
        willChange: "auto",
        contain: "layout style",
    },
    heroTransition: {
        transition: `transform ${HERO_MS}ms cubic-bezier(0.2, 0.9, 0.3, 1) !important`,
        willChange: "transform !important",
        backfaceVisibility: "hidden",
    },
    // Rides along with heroTransition on the canvas: the picture leaves the
    // page with the corner radii of the element it was clicked on (a 56px
    // half-rounded profile picture, a 24px mobile card image…) and morphs
    // to the renderer's radius while it flies — and back on the return trip.
    heroRadius: {
        transition: `border-radius ${HERO_MS}ms cubic-bezier(0.2, 0.9, 0.3, 1) !important`,
    },
    /* Reverse-hero close (PostDialog's closingChrome, minus the chrome it no
     * longer has). Applied on the Backdrop root while the picture flies back
     * onto its element: the tint + blur clear so the page shows through
     * behind the flying image, and the whole dialog stops catching clicks
     * from the first frame of the flight. The transition keeps `opacity`
     * with !important because MUI's Fade writes an inline opacity
     * transition on this node that would otherwise win. */
    closingChrome: {
        backgroundColor: "transparent !important",
        backdropFilter: "blur(0px) grayscale(0) !important",
        pointerEvents: "none",
        // The canvas opts back in to hit-testing on itself (pointer-events:
        // initial inline) — an ancestor's `none` does not beat that, and
        // the flying picture would eat clicks aimed at what it flies over.
        "& canvas": {
            pointerEvents: "none !important",
        },
        transition: "background-color 300ms cubic-bezier(0.4, 0, 0.2, 1), backdrop-filter 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 195ms cubic-bezier(0.4, 0, 0.2, 1) !important",
    },
    // Top-level scoped keyframes: a keyframes rule nested under @global inside
    // a class never enters the sheet's keyframes registry, so its `$ref`
    // would not resolve (the Home.js finding).
    "@keyframes pictureBlurFade": {
        "0%":   { opacity: 0 },
        "100%": { opacity: 1 },
    },
    // Slow opacity fade-in for the two blur backplate <img>s, applied
    // imperatively by setImgd at the same tick that swaps their src.
    blurFadeIn: {
        animation: "$pictureBlurFade 1600ms cubic-bezier(0.2, 0.9, 0.3, 1) forwards",
        willChange: "opacity",
    },
});

/* ══════════════════════════════════════════════════════════════════════
 * REDUCER — patch-merge, as in PostDialog.
 * ══════════════════════════════════════════════════════════════════════ */
const INITIAL_STATE = {
    open: false,
    // Reverse-hero close in progress → classes.closingChrome on the Backdrop.
    _closing: false,
    src: "",
    renderer: "square",
    mode: undefined,
    zoom: 1.33,
    metadata: EMPTY_META,
    _size: {},
    _hidden: true,
};

function patchReducer(prev, patch) {
    return { ...prev, ...patch };
}

function createInst() {
    return {
        currentRenderId: 0,
        pictureId: "picture:none",

        // Drag / pinch / wheel
        dragging: false,
        dragStartX: 0, dragStartY: 0,
        dragOriginLeft: 0, dragOriginTop: 0,
        pendingDx: 0, pendingDy: 0,
        rafDragId: null, rafWheelId: null, pendingWheelEvent: null,
        activePointers: null, pinchStartDist: null, startZoom: 1.33,
        twoPointer: false, twoPointerTimeout: null,

        // Image placement (viewport coords; the wrapper is position:fixed)
        posLeft: 0, posTop: 0, currentZoom: 1.33,
        viewMeasurement: { left: 0, top: 0, width: 0, height: 0 },
        positionSetForId: null,
        resizeRaf: null,

        // Open hero
        heroAnimating: false,
        originRect: null,
        heroTransitionTimer: null,
        pendingFullRender: null,

        // Reverse hero
        closingHero: false,
        closingHeroTimer: null,
        closeResetTimer: null,

        // Imperatively-driven DOM
        blurEl1: null, blurEl2: null, innerEl: null,
        committedImage: null,

        // Undecodable-for-the-pool fallback (tainted cross-origin image)
        rawBitmap: null,
    };
}

/* ══════════════════════════════════════════════════════════════════════
 * useImageGestures — wheel zoom, pointer drag, pinch. Direct DOM writes,
 * lifted from PostDialog; the only addition is the canvas radius tracking
 * the zoom (PostDialog has React recompute it from `zoom`, here it is
 * imperative so the hero can animate it).
 * ══════════════════════════════════════════════════════════════════════ */
function useImageGestures(viewRef, imageRef, canvasRef, inst, stateRef, dispatch) {

    const applyTransform = useCallback(() => {
        // The reverse-hero flight owns the transform.
        if (inst.closingHero) return;
        const el = imageRef.current;
        if (!el || !el.style) return;
        el.style.transform = transformFor(inst.posLeft, inst.posTop, inst.currentZoom);
        if (!inst.heroAnimating) {
            const can = canvasRef.current;
            if (can) can.style.borderRadius = radiusCss(rendererRadius(stateRef.current.renderer, inst.currentZoom));
        }
    }, []);

    const applyWheel = useCallback(() => {
        inst.rafWheelId = null;
        const e = inst.pendingWheelEvent;
        if (!e) return;
        inst.pendingWheelEvent = null;

        const m = inst.viewMeasurement;
        const s = stateRef.current._size;
        if (!s || !s.width) return;
        const current = inst.currentZoom;

        const deltaY = e.deltaY;
        let delta = Math.max(Math.min(0.125, Math.abs(deltaY * -0.01)), 0.25);
        delta = deltaY * -0.01 > 0 ? delta : -delta;

        const scaleRatio = Math.pow(current < 1 ? 1 / current : current, 1.6);
        const newScale = current + delta * current * (0.9 / scaleRatio);

        if (newScale > 5 || newScale < 0.2) return;

        const ccW = m.width, ccH = m.height;
        const cwW = s.width * current, cwH = s.height * current;

        const posX = e.pageX ? (e.pageX - m.left | 0) : (ccW / 2 | 0);
        const posY = e.pageY ? (e.pageY - m.top | 0) : (ccH / 2 | 0);

        const ratio = 1 - current / newScale;
        const ratio2 = newScale / current;

        let nmx = (inst.posLeft - posX * ratio) * ratio2 + (e.movementX || 0) | 0;
        let nmy = (inst.posTop - posY * ratio) * ratio2 + (e.movementY || 0) | 0;

        const fmx = (ccW - cwW) / 2 | 0, fmy = (ccH - cwH) / 2 | 0;
        nmx -= fmx; nmy -= fmy;
        const nmxR = Math.min(Math.abs(nmx), cwW + fmx) * (nmx < 0 ? -1 : 1) + fmx;
        const nmyR = Math.min(Math.abs(nmy), cwH + fmy) * (nmy < 0 ? -1 : 1) + fmy;

        inst.currentZoom = newScale;
        inst.posLeft = nmxR;
        inst.posTop = nmyR;
        applyTransform();
        dispatch({ zoom: newScale });
    }, []);

    const handleWheel = useCallback((e) => {
        inst.pendingWheelEvent = e;
        if (!inst.rafWheelId) inst.rafWheelId = requestAnimationFrame(applyWheel);
    }, []);

    // On-screen rect of the wrapper, computed instead of measured: it is
    // position:fixed, transformed about its own centre, and its layout box
    // is exactly the canvas CSS box (_size * 2).
    const getImageRect = useCallback(() => {
        const s = stateRef.current._size;
        if (!s || !s.width) return null;
        const k = inst.currentZoom / 3;
        const w = s.width * 2 * k, h = s.height * 2 * k;
        return {
            left: inst.posLeft - w / 2, top: inst.posTop - h / 2,
            right: inst.posLeft + w / 2, bottom: inst.posTop + h / 2,
            width: w, height: h,
        };
    }, []);

    const applyDrag = useCallback(() => {
        inst.rafDragId = null;
        if (!inst.dragging) return;
        inst.posLeft = inst.dragOriginLeft + inst.pendingDx;
        inst.posTop = inst.dragOriginTop + inst.pendingDy;
        applyTransform();
    }, []);

    const handlePointerDown = useCallback((e) => {
        if (e.button !== 0 && e.pointerType === "mouse") return;

        if (inst.activePointers) {
            inst.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (inst.activePointers.size === 2) {
                const pts = [...inst.activePointers.values()];
                inst.pinchStartDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
                inst.startZoom = inst.currentZoom;
                inst.twoPointer = true;
                inst.dragging = false;
                return;
            }
        } else {
            inst.activePointers = new Map();
            inst.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }

        if (inst.twoPointer) return;

        const rect = getImageRect();
        if (!rect) return;

        if (e.clientX >= rect.left && e.clientX <= rect.right &&
            e.clientY >= rect.top && e.clientY <= rect.bottom) {
            inst.dragging = true;
            inst.dragStartX = e.clientX;
            inst.dragStartY = e.clientY;
            inst.dragOriginLeft = inst.posLeft;
            inst.dragOriginTop = inst.posTop;
            if (imageRef.current) imageRef.current.style.willChange = "transform";
        }
    }, []);

    const handlePointerMove = useCallback((e) => {
        if (inst.activePointers && inst.activePointers.has(e.pointerId)) {
            inst.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (inst.activePointers.size === 2 && inst.pinchStartDist) {
                const pts = [...inst.activePointers.values()];
                const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
                const zoom = Math.max(0.2, Math.min(inst.startZoom * (dist / inst.pinchStartDist), 5));
                inst.currentZoom = zoom;
                applyTransform();
                dispatch({ zoom });
                return;
            }
        }
        if (!inst.dragging || inst.twoPointer) return;
        inst.pendingDx = e.clientX - inst.dragStartX;
        inst.pendingDy = e.clientY - inst.dragStartY;
        if (!inst.rafDragId) inst.rafDragId = requestAnimationFrame(applyDrag);
    }, []);

    const handlePointerUp = useCallback((e) => {
        if (inst.activePointers) {
            inst.activePointers.delete(e.pointerId);
            if (inst.activePointers.size < 2) inst.pinchStartDist = null;
            if (inst.activePointers.size === 0) {
                inst.activePointers = null;
                if (inst.twoPointer) {
                    inst.twoPointerTimeout = setTimeout(() => {
                        inst.twoPointer = false;
                        inst.twoPointerTimeout = null;
                    }, 120);
                }
            }
        }
        if (inst.dragging) {
            inst.dragging = false;
            if (imageRef.current) imageRef.current.style.willChange = "auto";
        }
    }, []);

    useEffect(() => {
        const el = viewRef.current;
        if (!el) return;
        const events = [
            ["wheel", handleWheel],
            ["pointerdown", handlePointerDown],
            ["pointermove", handlePointerMove],
            ["pointerup", handlePointerUp],
            ["pointercancel", handlePointerUp],
            ["pointerleave", handlePointerUp],
        ];
        events.forEach(([ev, fn]) => el.addEventListener(ev, fn, { passive: true }));
        return () => events.forEach(([ev, fn]) => el.removeEventListener(ev, fn, { passive: true }));
    }, [viewRef.current]);

    return { applyTransform, getImageRect };
}

/* ══════════════════════════════════════════════════════════════════════
 * COMPONENT
 * ══════════════════════════════════════════════════════════════════════ */
function PictureDialog(props) {
    const { classes } = props;

    const [state, rawDispatch] = useReducer(patchReducer, INITIAL_STATE);
    const stateRef = useRef(null);
    if (!stateRef.current) stateRef.current = { ...INITIAL_STATE };
    Object.assign(stateRef.current, state);

    // Sync dispatch: stateRef sees the patch immediately, React re-renders
    // asynchronously (PostDialog's pattern).
    const dispatch = useCallback((patch) => {
        Object.assign(stateRef.current, patch);
        rawDispatch(patch);
    }, [rawDispatch]);

    const instRef = useRef(null);
    if (!instRef.current) instRef.current = createInst();
    const inst = instRef.current;

    // Stable access to the latest callbacks from timers / promises.
    const onCloseRef = useRef(props.onClose);
    onCloseRef.current = props.onClose;
    const getReturnRectRef = useRef(props.getReturnRect);
    getReturnRectRef.current = props.getReturnRect;

    const viewRef = useRef(null);
    const imageRef = useRef(null);
    const canvasRef = useRef(null);

    const { applyTransform } = useImageGestures(viewRef, imageRef, canvasRef, inst, stateRef, dispatch);

    /* ================================================================
     * CANVAS & RENDER PIPELINE
     * ================================================================ */
    const clearCanvas = useCallback(() => {
        const can = canvasRef.current;
        if (can) {
            can.width = 0; can.height = 0; can._cachedAR = null;
            can._previewFor = null; can._previewW = 0;
            // Re-arm the invisibility latch until setImgd has painted at the
            // new size (React rewrites CSS width/height ahead of the worker).
            can.style.visibility = "hidden";
        }
    }, []);

    const releaseRawBitmap = useCallback(() => {
        const b = inst.rawBitmap;
        inst.rawBitmap = null;
        if (b) { try { b.close && b.close(); } catch (e) {} }
    }, []);

    // Symmetric teardown for the blur backplates — only on a real close, so
    // the next open starts from a blank slate and a clean fade-in.
    const clearBlurImages = useCallback(() => {
        const fade = classes.blurFadeIn;
        [inst.blurEl1, inst.blurEl2].forEach((b) => {
            if (!b) return;
            b.removeAttribute("src");
            if (fade) b.classList.remove(fade);
            // Undo the reverse hero's imperative fade-out.
            b.style.opacity = "";
            b.style.transition = "";
        });
        if (inst.innerEl) inst.innerEl.style.opacity = "0";
    }, [classes]);

    const setImgd = useCallback((imgd, b, id, renderId, isPreview) => {
        const st = stateRef.current;
        if (id !== inst.pictureId || renderId !== inst.currentRenderId) {
            if (b) { try { b.close && b.close(); } catch (e) {} }
            return;
        }
        const _size = st._size;
        const can = canvasRef.current;
        if (!can || !_size || !_size.width || !b) {
            if (b) { try { b.close && b.close(); } catch (e) {} }
            return;
        }

        // ORDERING CONTRACT — PostDialog's, verbatim in spirit:
        //   1. resolve start/final positions (pure arithmetic)
        //   2. stage the outer-div transform (+ canvas radius) at the START
        //   3-5. size + paint the canvas, update its CSS box
        //   6. swap the blur backplate srcs, take the fade class OFF
        //   7. reveal (visibility + inner opacity) — instantly, no transition
        //   8. ONE forced reflow committing the start state
        //   9. add the transition classes + set the final transform/radius
        // No rAF anywhere: the flush at 8 does what "waiting a frame" used
        // to do, synchronously, so the browser paints exactly one frame at
        // the start state and interpolates from there.

        // ── 1. positions ────────────────────────────────────────────────
        const viewRect = inst.viewMeasurement;
        const finalLeft = viewRect.width / 2 | 0;
        const finalTop = viewRect.height / 2 | 0;
        const finalZoom = st.zoom || 1.33;
        const isHero = inst.heroAnimating && inst.originRect;
        let startLeft, startTop, startZoom;
        if (isHero) {
            const origin = inst.originRect;
            // `cover` semantics: the picture is shown cropped-to-cover in its
            // page element (background-size: cover), so the flight starts with
            // the canvas covering the element's box — exact for square
            // pictures, overflowing the shorter axis for the rest.
            startZoom = Math.max(origin.width / (_size.width * 2), origin.height / (_size.height * 2)) * 3;
            startLeft = (origin.left + origin.width / 2) | 0;
            startTop = (origin.top + origin.height / 2) | 0;
        } else {
            startLeft = finalLeft;
            startTop = finalTop;
            startZoom = finalZoom;
        }

        // Same-picture repaint (resize, renderer change, deferred sharper
        // pass): paint in place, keep the current transform, no animation.
        const samePicture = inst.positionSetForId === id && !inst.heroAnimating;

        const el = imageRef.current;

        // ── 2. stage the start transform ────────────────────────────────
        if (!samePicture && el) {
            inst.posLeft = startLeft;
            inst.posTop = startTop;
            inst.currentZoom = startZoom;
            el.classList.remove(classes.heroTransition);
            el.style.transform = transformFor(startLeft, startTop, startZoom);
            can.classList.remove(classes.heroRadius);
            can.style.borderRadius = isHero
                ? localRadiusCss(inst.originRect.radius, startZoom)
                : radiusCss(rendererRadius(st.renderer, startZoom));
        }

        // ── 3-5. size + paint ───────────────────────────────────────────
        const targetW = _size.width * 3, targetH = _size.height * 3;
        const needsResize = can.width !== targetW || can.height !== targetH;
        const ar = `${imgd.width} / ${imgd.height}`;
        if (can._cachedAR !== ar) { can.style.aspectRatio = ar; can._cachedAR = ar; }
        if (needsResize) { can.width = targetW; can.height = targetH; }

        // Mark what this paint is BEFORE the transfer neutralizes `b`.
        can._previewFor = isPreview ? id : null;
        can._previewW = isPreview ? b.width : 0;

        if (can.context && typeof can.context.transferFromImageBitmap === "function") {
            can.context.transferFromImageBitmap(b);
        } else {
            // 2d fallback (no bitmaprenderer support)
            const ctx = can.context || (can.context = can.getContext("2d"));
            ctx.clearRect(0, 0, can.width, can.height);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(b, 0, 0, can.width, can.height);
        }
        try { b.close && b.close(); } catch (e) {}
        const cssW = `${_size.width * 2}px`, cssH = `${_size.height * 2}px`;
        if (can.style.width !== cssW) can.style.width = cssW;
        if (can.style.height !== cssH) can.style.height = cssH;

        // ── 6. atomic blur swap + fade restart (part 1) ─────────────────
        const want = st.src || "";
        let fadeRestart = false;
        if (want && inst.committedImage !== want) {
            if (inst.blurEl1 && inst.blurEl1.getAttribute("src") !== want) inst.blurEl1.src = want;
            if (inst.blurEl2 && inst.blurEl2.getAttribute("src") !== want) inst.blurEl2.src = want;
            inst.committedImage = want;
            const fade = classes.blurFadeIn;
            if (fade) {
                if (inst.blurEl1) inst.blurEl1.classList.remove(fade);
                if (inst.blurEl2) inst.blurEl2.classList.remove(fade);
                fadeRestart = true;
            }
        }

        // ── 7. reveal ───────────────────────────────────────────────────
        if (can.style.visibility !== "visible") can.style.visibility = "visible";
        if (inst.innerEl) inst.innerEl.style.opacity = "1";

        if (samePicture) {
            if (fadeRestart) {
                void (inst.blurEl1 || inst.blurEl2 || {}).offsetWidth;
                const fade = classes.blurFadeIn;
                if (inst.blurEl1) inst.blurEl1.classList.add(fade);
                if (inst.blurEl2) inst.blurEl2.classList.add(fade);
            }
            if (st._hidden) dispatch({ _hidden: false });
            else applyTransform();
            return;
        }

        // ── 8. ONE forced reflow ────────────────────────────────────────
        if (el) void el.offsetHeight;
        else if (fadeRestart) void (inst.blurEl1 || inst.blurEl2 || {}).offsetWidth;

        if (fadeRestart) {
            const fade = classes.blurFadeIn;
            if (inst.blurEl1) inst.blurEl1.classList.add(fade);
            if (inst.blurEl2) inst.blurEl2.classList.add(fade);
        }

        // ── 9. kick ─────────────────────────────────────────────────────
        inst.posLeft = finalLeft; inst.posTop = finalTop;
        inst.currentZoom = finalZoom; inst.positionSetForId = id;

        if (isHero && el) {
            el.classList.add(classes.heroTransition);
            el.style.transform = transformFor(finalLeft, finalTop, finalZoom);
            can.classList.add(classes.heroRadius);
            can.style.borderRadius = radiusCss(rendererRadius(st.renderer, finalZoom));
            dispatch({ _hidden: false, zoom: finalZoom });

            if (inst.heroTransitionTimer) clearTimeout(inst.heroTransitionTimer);
            inst.heroTransitionTimer = setTimeout(() => {
                inst.heroTransitionTimer = null;
                inst.heroAnimating = false; inst.originRect = null;
                if (el) el.classList.remove(classes.heroTransition);
                const canNow = canvasRef.current;
                if (canNow) canNow.classList.remove(classes.heroRadius);
                dispatch({ zoom: finalZoom });
                // Landed. If the flight flew a smaller pool-cached render and
                // the dialog needs a bigger one, run the sharper pass now —
                // with heroAnimating cleared it takes the same-picture path:
                // an in-place pixel swap, no re-animation. A close that raced
                // this timer drops the pass: the fade-out / reverse hero must
                // keep the pixels it has.
                const pending = inst.pendingFullRender;
                inst.pendingFullRender = null;
                if (pending && stateRef.current.open && !stateRef.current._closing && !inst.closingHero) pending();
            }, HERO_SETTLE_MS);
        } else {
            if (el) el.style.transform = transformFor(finalLeft, finalTop, finalZoom);
            dispatch({ _hidden: false });
        }
    }, [classes, applyTransform]);

    const renderPipeline = useCallback((renderer, imgd, size, mode) => {
        const id = inst.pictureId;
        const renderId = inst.currentRenderId;
        if (!size || !size.width) return;

        // Undecodable-for-the-pool picture: paint the raw bitmap (a clone —
        // the transfer detaches whatever it is handed) with no renderer.
        if (!imgd) {
            const raw = inst.rawBitmap;
            if (!raw || typeof createImageBitmap !== "function") return;
            createImageBitmap(raw)
                .then((clone) => setImgd({ width: raw.width, height: raw.height }, clone, id, renderId))
                .catch(() => {});
            return;
        }

        const cb = (d, b) => {
            const dims = (d && d.width && d.height) ? d : imgd;
            if (b) return setImgd(dims, b, id, renderId);
            // Pool handed pixels without a bitmap — mint one.
            if (d && d.data && typeof createImageBitmap === "function") {
                createImageBitmap(d).then((bmp) => setImgd(dims, bmp, id, renderId)).catch(() => {});
            }
        };

        // Full-quality pool render at this renderer's dialog scale —
        // PostDialog's dispatch verbatim.
        const runFullRender = () => {
            if (renderId !== inst.currentRenderId) return;
            if (renderer === "hexagon") {
                const scale = Math.max(Math.min(32, Math.ceil(size.width / imgd.width)), 3);
                hexF(imgd, scale, cb, true, id, mode);
            } else if (renderer === "xbrz") {
                const scale = Math.max(Math.min(32, Math.ceil(size.width / imgd.width) * 2), 6);
                xbrzF(imgd, scale, cb, true, id, mode);
            } else if (renderer === "crt") {
                const scale = Math.max(Math.min(32, Math.ceil(size.width / imgd.width) * 2), 6);
                crtF(imgd, scale, cb, true, id, mode);
            } else if (renderer === "tri") {
                const scale = Math.max(Math.min(32, Math.ceil(size.width / imgd.width) * 2), 6);
                triF(imgd, scale, cb, true, id, mode);
            } else {
                const scale = Math.max(Math.min(32, Math.ceil(size.width / imgd.width) * 2), 6);
                sqrF(imgd, scale, cb, true, id, mode);
            }
        };

        const heroInFlight = inst.heroAnimating && inst.originRect;

        // Mid-hero re-run while a cached preview is on screen (a resize
        // inside the flight): refresh the deferred pass instead of launching
        // a render against the animation.
        if (heroInFlight && canvasRef.current && canvasRef.current._previewFor === id) {
            inst.pendingFullRender = (size.width * 2 > (canvasRef.current._previewW || 0)) ? runFullRender : null;
            return;
        }

        // Hero fast path, pool edition: a previous open (or the avatar
        // rendered elsewhere through the pool) often left this picture in the
        // render cache — fly the LARGEST cached render (a cheap master-bitmap
        // clone) so the flight starts now, and defer the sharper pass to the
        // hero-end flush, skipping it when the cached render already covers
        // the dialog's CSS box. A miss falls through to the normal render.
        if (heroInFlight && typeof acquireBestCachedBitmap === "function") {
            const poolAlgo =
                renderer === "hexagon" ? "hex" :
                    renderer === "xbrz" ? "xbrz" :
                        renderer === "crt" ? "crt" :
                            renderer === "tri" ? "tri" : "sqr";
            let acq = null;
            try { acq = acquireBestCachedBitmap(id, poolAlgo); } catch (e) { acq = null; }
            if (acq && typeof acq.then === "function") {
                acq.then((res) => {
                    const bitmap = res && res.bitmap;
                    if (!bitmap || !bitmap.width) { runFullRender(); return; }
                    if (renderId !== inst.currentRenderId || !inst.heroAnimating) {
                        try { bitmap.close && bitmap.close(); } catch (e) {}
                        if (renderId === inst.currentRenderId) runFullRender();
                        return;
                    }
                    const pw = bitmap.width;
                    setImgd(imgd, bitmap, id, renderId, true); // paints + kicks the hero
                    inst.pendingFullRender = (size.width * 2 > pw) ? runFullRender : null;
                }).catch(() => { if (renderId === inst.currentRenderId) runFullRender(); });
                return;
            }
        }

        inst.pendingFullRender = null;
        runFullRender();
    }, [setImgd]);

    const computeSize = useCallback(() => {
        const st = stateRef.current;
        // Arithmetic view box — no layout read. The Backdrop is fixed
        // fullscreen and the view spans it entirely, so the box IS the
        // viewport (innerWidth/innerHeight never trigger reflow).
        const vw = window.innerWidth || document.documentElement.clientWidth || 960;
        const vh = window.innerHeight || document.documentElement.clientHeight || 640;
        inst.viewMeasurement = { left: 0, top: 0, width: vw, height: vh };

        const md = st.metadata;
        if (!md || !md.width || !md.height) return;

        const zMax = Math.min((vw - 16) / md.width, (vh - 16) / md.height);
        const size = { width: md.width * zMax | 0, height: md.height * zMax | 0 };
        if (!size.width || !size.height) return;
        dispatch({ _size: size });

        renderPipeline(st.renderer, md.imgd, size, st.mode);
    }, [renderPipeline]);

    const debouncedComputeSize = useCallback(() => {
        if (!inst.resizeRaf) {
            inst.resizeRaf = requestAnimationFrame(() => { inst.resizeRaf = null; computeSize(); });
        }
    }, [computeSize]);

    /* ================================================================
     * CLOSE — reverse hero when the host still shows the element
     * ================================================================ */
    const onRequestClose = useCallback(() => {
        const st = stateRef.current;
        if (!st.open) return;
        if (inst.closingHero) return; // already flying home — ignore re-clicks

        const el = imageRef.current;
        const can = canvasRef.current;
        const _size = st._size;
        const getRect = getReturnRectRef.current;
        const canFly =
            el && can && _size && _size.width > 0 &&
            !st._hidden && inst.positionSetForId != null &&
            typeof getRect === "function";
        let rect = null;
        if (canFly) { try { rect = getRect(); } catch (e) { rect = null; } }

        if (rect && rect.width > 0 && rect.height > 0) {
            inst.closingHero = true;
            // An open-hero still in flight would strip the transition class
            // from under us when its timer fires — take over cleanly, and
            // drop its deferred sharper pass: nothing may swap the pixels
            // mid-flight.
            if (inst.heroTransitionTimer) { clearTimeout(inst.heroTransitionTimer); inst.heroTransitionTimer = null; }
            inst.heroAnimating = false; inst.originRect = null;
            inst.pendingFullRender = null;

            // Inverse of the open mapping (cover semantics, see setImgd).
            const endZoom = Math.max(rect.width / (_size.width * 2), rect.height / (_size.height * 2)) * 3;
            const endLeft = (rect.left + rect.width / 2) | 0;
            const endTop = (rect.top + rect.height / 2) | 0;

            // Fade the blur backplates out of the flight — the element it
            // lands on has no halo.
            const fade = classes.blurFadeIn;
            if (fade) {
                if (inst.blurEl1) inst.blurEl1.classList.remove(fade);
                if (inst.blurEl2) inst.blurEl2.classList.remove(fade);
            }

            // Landing values BEFORE `_closing` re-renders the wrapper's inline
            // transform from inst — writing the string the transition is
            // already heading to leaves it undisturbed.
            inst.posLeft = endLeft; inst.posTop = endTop; inst.currentZoom = endZoom;

            el.classList.add(classes.heroTransition);
            can.classList.add(classes.heroRadius);
            // ONE flush: commits the current transform + radius as the
            // transitions' start values, and the fade-class removals.
            void el.offsetHeight;
            [inst.blurEl1, inst.blurEl2].forEach((b) => {
                if (!b) return;
                b.style.transition = "opacity 220ms cubic-bezier(0.4, 0, 0.2, 1)";
                b.style.opacity = "0";
            });
            el.style.transform = transformFor(endLeft, endTop, endZoom);
            can.style.borderRadius = localRadiusCss(rect.radius, endZoom);
            dispatch({ _closing: true });

            if (inst.closingHeroTimer) clearTimeout(inst.closingHeroTimer);
            inst.closingHeroTimer = setTimeout(() => {
                inst.closingHeroTimer = null;
                inst.closingHero = false;
                const elNow = imageRef.current;
                if (elNow) elNow.classList.remove(classes.heroTransition);
                const canNow = canvasRef.current;
                if (canNow) canNow.classList.remove(classes.heroRadius);
                onCloseRef.current?.();
            }, CLOSE_LAND_MS);
            return;
        }

        onCloseRef.current?.();
    }, [classes]);

    /* ================================================================
     * REFS
     * ================================================================ */
    const setViewRefCb = useCallback((el) => {
        if (el) {
            viewRef.current = el;
            computeSize();
        }
    }, [computeSize]);

    const setImageRefCb = useCallback((el) => {
        if (el) imageRef.current = el;
    }, []);

    const setCanvasRefCb = useCallback((can) => {
        if (!can || typeof can.getContext !== "function") return;
        try { can.context = can.getContext("bitmaprenderer"); } catch (e) { can.context = null; }
        // Invisible from its first frame regardless of commit ordering; the
        // reveal happens in setImgd.
        can.style.visibility = "hidden";
        canvasRef.current = can;
        const st = stateRef.current;
        if (st.metadata && st.metadata.width && st._size && st._size.width) {
            renderPipeline(st.renderer, st.metadata.imgd, st._size, st.mode);
        }
    }, [renderPipeline]);

    // Blur backplates and the inner wrapper are driven imperatively (see
    // setImgd); the callbacks are stable so the elements are never remounted.
    const setBlur1RefCb = useCallback((el) => {
        if (!el) return;
        inst.blurEl1 = el;
        if (inst.committedImage && el.getAttribute("src") !== inst.committedImage) el.src = inst.committedImage;
    }, []);
    const setBlur2RefCb = useCallback((el) => {
        if (!el) return;
        inst.blurEl2 = el;
        if (inst.committedImage && el.getAttribute("src") !== inst.committedImage) el.src = inst.committedImage;
    }, []);
    const setInnerRefCb = useCallback((el) => {
        if (!el) return;
        inst.innerEl = el;
        if (!inst.committedImage) el.style.opacity = "0";
    }, []);

    /* ================================================================
     * EFFECTS — lifecycle
     * ================================================================ */
    useEffect(() => {
        window.addEventListener("resize", debouncedComputeSize, { passive: true });
        return () => {
            window.removeEventListener("resize", debouncedComputeSize, { passive: true });
            if (inst.twoPointerTimeout) clearTimeout(inst.twoPointerTimeout);
            if (inst.rafDragId) cancelAnimationFrame(inst.rafDragId);
            if (inst.rafWheelId) cancelAnimationFrame(inst.rafWheelId);
            if (inst.resizeRaf) cancelAnimationFrame(inst.resizeRaf);
            if (inst.heroTransitionTimer) clearTimeout(inst.heroTransitionTimer);
            if (inst.closingHeroTimer) clearTimeout(inst.closingHeroTimer);
            if (inst.closeResetTimer) clearTimeout(inst.closeResetTimer);
            inst.currentRenderId++;
            releaseRawBitmap();
        };
    }, []);

    // Escape closes, the same way a backdrop click does. Keystrokes typed
    // into an editable element are never hijacked.
    useEffect(() => {
        if (!state.open) return;
        const onKey = (e) => {
            if (e.key !== "Escape" && e.keyCode !== 27) return;
            const t = e.target;
            if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
            e.preventDefault();
            onRequestClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [state.open, onRequestClose]);

    // Pre-paint canvas clear — a layout effect so the frame that first shows
    // the new props never carries the previous picture's pixels (PostDialog's
    // "old image flashes for ~50ms" fix). A reopen of the SAME picture is
    // treated like an image change for the same reason.
    const prevImageRef = useRef(undefined);
    const prevOpenRef = useRef(false);
    useLayoutEffect(() => {
        const img = props.src;
        const open = props.open;
        const newlyOpened = open && !prevOpenRef.current;
        prevOpenRef.current = open;
        if (prevImageRef.current === img && !newlyOpened) return;
        prevImageRef.current = img;
        const can = canvasRef.current;
        if (can) {
            can.width = 0; can.height = 0; can._cachedAR = null;
            can.style.visibility = "hidden";
        }
        if (inst.innerEl) inst.innerEl.style.opacity = "0";
    });

    // Props → state, open/close and the decode → size → render chain.
    const prevPropsRef = useRef({});
    useEffect(() => {
        const prev = prevPropsRef.current;
        const isNewlyClosed = !props.open && prev.open === true;
        const isNewlyOpened = props.open && !prev.open;
        const isNewImage = isNewlyOpened || (props.src !== prev.src);

        // ── Close path ──────────────────────────────────────────────────
        // Flip `open` only; leave the painted canvas and blurs alone for the
        // Backdrop's fade-out, then drop them so a reopen never flashes the
        // stale picture and the bitmap isn't held around.
        if (isNewlyClosed) {
            dispatch({ open: false });
            prevPropsRef.current = { open: false, src: prev.src, renderer: prev.renderer, mode: prev.mode };
            if (inst.closeResetTimer) clearTimeout(inst.closeResetTimer);
            inst.closeResetTimer = setTimeout(() => {
                inst.closeResetTimer = null;
                if (stateRef.current.open) return; // reopened meanwhile
                inst.currentRenderId++;
                clearCanvas();
                clearBlurImages();
                releaseRawBitmap();
                inst.pendingFullRender = null;
                inst.positionSetForId = null;
                inst.heroAnimating = false; inst.originRect = null;
                inst.closingHero = false;
                if (inst.heroTransitionTimer) { clearTimeout(inst.heroTransitionTimer); inst.heroTransitionTimer = null; }
                if (inst.closingHeroTimer) { clearTimeout(inst.closingHeroTimer); inst.closingHeroTimer = null; }
                inst.committedImage = null;
                // Both "previous props" snapshots must go, or reopening the
                // same picture compares equal and skips the whole pipeline.
                prevPropsRef.current = {};
                prevImageRef.current = undefined;
                dispatch({ src: "", _closing: false, _hidden: true, zoom: 1.33, metadata: EMPTY_META, _size: {} });
            }, CLOSE_RESET_MS);
            return;
        }

        if (inst.closeResetTimer) { clearTimeout(inst.closeResetTimer); inst.closeResetTimer = null; }

        if (!props.open) {
            prevPropsRef.current = { open: false, src: props.src, renderer: props.renderer, mode: props.mode };
            return;
        }

        const extra = {};
        if (isNewImage) {
            inst.currentRenderId++;
            inst.pictureId = props.pictureId || pictureIdFor(props.src || "");
            clearCanvas();
            releaseRawBitmap();
            inst.pendingFullRender = null;
            // A new picture must never inherit a reverse hero in progress
            // (fast reopen inside the teardown window).
            extra._closing = false;
            if (inst.closingHero) {
                inst.closingHero = false;
                [inst.blurEl1, inst.blurEl2].forEach((b) => {
                    if (!b) return;
                    b.style.opacity = "";
                    b.style.transition = "";
                });
            }
            if (inst.closingHeroTimer) { clearTimeout(inst.closingHeroTimer); inst.closingHeroTimer = null; }
            extra._hidden = true;
            extra.metadata = EMPTY_META;
            extra._size = {};
        }

        dispatch({ open: true, src: props.src || "", renderer: props.renderer || "square", mode: props.mode, ...extra });

        if (isNewImage) {
            if (props.originRect && props.originRect.width > 0 && props.originRect.height > 0) {
                inst.originRect = props.originRect; inst.heroAnimating = true;
            } else {
                // Hero-less open (deep link, forward, no measurable element).
                inst.originRect = null; inst.heroAnimating = false;
            }
            inst.positionSetForId = null;

            if (props.src) {
                const renderId = inst.currentRenderId;
                requestAnimationFrame(() => {
                    if (renderId !== inst.currentRenderId) return;
                    decodeSource(props.src).then((result) => {
                        if (renderId !== inst.currentRenderId) return;
                        if (!result) {
                            // Nothing we can show — hand the close back to the
                            // host so the URL and the page are left as they were.
                            inst.heroAnimating = false; inst.originRect = null;
                            onCloseRef.current?.();
                            return;
                        }
                        if (result.bitmap) inst.rawBitmap = result.bitmap;
                        inst.currentZoom = 1.33;
                        dispatch({ metadata: { imgd: result.imgd, width: result.width, height: result.height }, zoom: 1.33 });
                        computeSize();
                    }).catch(() => {
                        if (renderId !== inst.currentRenderId) return;
                        inst.heroAnimating = false; inst.originRect = null;
                        onCloseRef.current?.();
                    });
                });
            }
        } else if (props.renderer !== prev.renderer || props.mode !== prev.mode) {
            // Renderer switched while open: re-render in place (same-picture
            // path in setImgd, no animation).
            inst.currentRenderId++;
            computeSize();
        }

        prevPropsRef.current = { open: true, src: props.src, renderer: props.renderer, mode: props.mode };
    }, [props.open, props.src, props.renderer, props.mode, props.originRect, props.pictureId]);

    /* ================================================================
     * RENDER
     * ================================================================ */
    const { open, renderer, _size, _hidden, _closing, metadata } = state;

    const canvasStyle = useMemo(() => ({
        ...STYLE_CANVAS_CONTEXT,
        width: (_size.width || 0) * 2,
        height: (_size.height || 0) * 2,
    }), [_size.width, _size.height]);

    const imageAnimClass =
        (inst.heroAnimating && !_hidden) ? classes.heroAppear
            : (_hidden ? classes.hidden : classes.appear);

    // Nearest-neighbour CSS scaling for the square renderer and for the raw
    // (unrendered) bitmap fallback; the smoothing renderers paint their own.
    const pixelated = renderer === "square" || (!metadata.imgd && !!inst.rawBitmap);

    return (
        <Portal>
            <Backdrop keepMounted={true} open={open}
                      className={_closing ? `${classes.backdrop} ${classes.closingChrome}` : classes.backdrop}>
                <div style={STYLE_ROOT_CONTAINER}>
                    <div className={classes.view} ref={setViewRefCb}>
                        <div style={STYLE_CLOSE_OVERLAY} onClick={onRequestClose} />
                        <div ref={setImageRefCb}
                             style={{
                                 contain: "layout style", willChange: inst.dragging ? "transform" : "auto",
                                 position: "fixed",
                                 transform: transformFor(inst.posLeft, inst.posTop, inst.currentZoom),
                                 transformOrigin: "50% 50%",
                                 userSelect: "none", touchAction: "none", pointerEvents: "none",
                                 cursor: inst.dragging ? "grabbing" : "grab",
                             }}>
                            <div ref={setInnerRefCb} className={imageAnimClass} style={STYLE_IMG_ANIM_INNER}>
                                {/* Blur backplates: src is set imperatively by setImgd so it
                                    swaps atomically with the canvas pixels. */}
                                <img ref={setBlur1RefCb} decoding="async" style={STYLE_BLUR_1} alt="" />
                                <img ref={setBlur2RefCb} decoding="async" style={STYLE_BLUR_2} alt="" />
                                <canvas onContextMenu={PREVENT_CONTEXT}
                                        className={pixelated ? "pixelated" : ""}
                                        ref={setCanvasRefCb}
                                        style={canvasStyle} />
                            </div>
                        </div>
                    </div>
                </div>
            </Backdrop>
        </Portal>
    );
}

export default withStyles(styles)(PictureDialog);