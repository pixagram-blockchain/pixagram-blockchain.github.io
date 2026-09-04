import * as React from "preact/compat";
import { HISTORY } from "../utils/constants";
import { idle, cancelIdle } from "../utils/idle";
import withStyles from "@material-ui/core/styles/withStyles";
import Fade from "@material-ui/core/Fade";
import ExploreIcon from "@material-ui/icons/Explore";
import InfoIcon from "@material-ui/icons/Info";
import Button from "@material-ui/core/Button";

import { t } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";
import getIT from "../data/pixaLogoWhite";
// Loaded on demand the first time "Learn More" is pressed — the dialog
// (tech story, STEEM→HIVE→PIXA table and the team section with its base64
// portraits) never taxes the landing page's critical-path bundle.
const LearnMoreDialog = React.lazy(() => import("../components/LearnMoreDialog"));

const styles = theme => ({
    // ── Scoped JSS keyframes ──
    // They MUST live at the sheet top level: JSS only registers top-level
    // "@keyframes" rules in the sheet's keyframes map, and that map is what
    // resolves the "$name" animationName references below. Nested inside a
    // rule (or under "@global") they never enter the map, so "$bounceGlow"
    // etc. can't resolve. (The unreferenced hueRotate / slideUpFade /
    // slideRightFade globals were removed with the same pass.)
    "@keyframes bounceGlow": {
        "0%": {
            boxShadow: "0 0 12px #ffffff66, 0 0 24px #ffffff99, 0 4px 20px rgba(0,0,0,0.2)",
            transform: "scale(1) translateY(0px)"
        },
        "4%": {
            boxShadow: "0 0 20px #ffffff88, 0 0 40px #ffffffbb, 0 8px 30px rgba(0,0,0,0.3)",
            transform: "scale(1.08) translateY(-2px)"
        },
        "8%": {
            boxShadow: "0 0 8px #ffffff44, 0 0 16px #ffffff77, 0 2px 15px rgba(0,0,0,0.15)",
            transform: "scale(0.98) translateY(1px)"
        },
        "12%": {
            boxShadow: "0 0 12px #ffffff66, 0 0 24px #ffffff99, 0 4px 20px rgba(0,0,0,0.2)",
            transform: "scale(1) translateY(0px)"
        },
    },
    "@keyframes pulseHover": {
        "0%": {
            boxShadow: "0 0 12px #ffffff66, 0 0 24px #ffffff99, 0 4px 20px rgba(0,0,0,0.2)",
            transform: "scale(1) translateY(0px)"
        },
        "50%": {
            boxShadow: "0 0 40px #ffffff99, 0 0 80px #ffffffdd, 0 15px 50px rgba(0,0,0,0.5)",
            transform: "scale(1.09) translateY(-5px)"
        },
        "100%": {
            boxShadow: "0 0 30px #ffffff99, 0 0 60px #ffffffcc, 0 10px 40px rgba(0,0,0,0.4)",
            transform: "scale(1.06) translateY(-3px)"
        },
    },
    "@keyframes spiralReveal": {
        "0%": {
            filter: "opacity(0)",
            transform: "translate(50%, 50%) scale(0) rotate(180deg)"
        },
        "60%": {
            filter: "opacity(0.8)",
            transform: "translate(-15%, -30%) scale(1.1) rotate(10deg)"
        },
        "100%": {
            filter: "opacity(1)",
            transform: "translate(-25%, -50%) scale(1) rotate(0deg)"
        },
    },
    homeRoot: {
        userSelect: "none",
        zIndex: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        alignItems: "flex-start",
        // dvh keeps the bottom-anchored CTA inside the VISIBLE viewport on
        // mobile (100vh kept as JSS fallback).
        fallbacks: { height: "100vh" },
        height: "100dvh",
        width: "100vw",
        position: "relative",
        padding: "32px",
        fontFamily: `"Industry Book", "Normative Pro"`,
        // No willChange: filter here — nothing ever animates a filter on the
        // root, and the hint pinned a full-viewport filter-ready layer for the
        // page's whole lifetime. translateZ(0) STAYS: it makes homeRoot the
        // containing block for the two position:fixed layers (bgCanvas,
        // homeOverlay2), which is what lets this element's overflow:hidden
        // clip the oversized overlay.
        transform: "translateZ(0)",
        [theme.breakpoints.down("md")]: {
            padding: "16px",
        },
        "&:hover > .overlay": {
            opacity: 0.75,
            transition: "opacity 600ms cubic-bezier(0.25, 0.46, 0.45, 0.94) 0ms"
        },
        "& > .overlay": {
            opacity: 1.0,
            transition: "opacity 800ms cubic-bezier(0.25, 0.46, 0.45, 0.94) 300ms"
        }
    },
    homeLogo: {
        width: 280,
        userSelect: "none",
        [theme.breakpoints.down("md")]: {
            width: "160px",
            height: "160px"
        },
        [theme.breakpoints.down("sm")]: {
            width: "72px",
            height: "72px"
        }
    },
    homeTitles: {
        padding: "24px 0px",
        lineHeight: "normal",
        [theme.breakpoints.down("md")]: {
            padding: "8px",
        },
        [theme.breakpoints.down("sm")]: {
            padding: "0px",
        }
    },
    homeTitle: {
        userSelect: "none",
        zIndex: 2,
        display: "flex",
        "& > div > h3": {
            fontSize: "21px",
            marginTop: 12,
            color: "#a3a3a3",
            fontWeight: "normal",
        },
        "& > div > h2": {
            fontSize: "64px",
            color: "#bdbdbd",
            fontWeight: "normal",
            marginTop: 0,
            marginBottom: 0,
        },
        "& > div > h1": {
            fontSize: "96px",
            color: "#ffffff",
            marginTop: 0,
            marginBottom: -12,
        },
        [theme.breakpoints.down("md")]: {
            "& > div > h1": {
                marginTop: 0,
                marginBottom: 0,
                fontSize: "32px",
                color: "#ffffff"
            },
            "& > div > h3": {
                display: "none"
            },
            "& > div > h2": {
                fontSize: "32px",
                color: "#bdbdbd",
                fontWeight: "normal",
                marginTop: 0,
                marginBottom: 0,
            },
        },
        [theme.breakpoints.down("sm")]: {
            "& > div > h1": {
                marginTop: 0,
                marginBottom: 0,
                fontSize: "38px",
                color: "#ffffff"
            },
            "& > div > h3": {
                display: "none"
            },
            "& > div > h2": {
                color: "#bdbdbd",
                fontSize: "21px",
                fontWeight: "normal",
                marginTop: 0,
                marginBottom: 0,
            },
        }
    },
    homeActions: {
        zIndex: 4,
        padding: "24px",
        textAlign: "center",
        width: "100%",
        position: "absolute",
        // left: 0 is the centering fix. Without it the abspos box keeps its
        // STATIC left (the flex parent's content box starts after homeRoot's
        // 32px / 16px padding), so the 100%-wide box began at x=32 and its
        // text-centered pill sat 32px right of the true viewport centre.
        // Anchored to the padding box (x=0), 100% + text-align now centre it
        // exactly on every breakpoint.
        left: 0,
        bottom: "64px",
        // The old `filter: grayscale(1) !important` is gone: it existed only
        // to desaturate the rainbow ripple (everything else in here is already
        // achromatic) and it cost a filter stacking layer that every frame of
        // the infinite bounceGlow animation had to be composited through. The
        // ripple gradients below are now grey AT THE SOURCE (exact
        // grayscale(1) luminance of the brand colors), same rendered pixels.
    },
    homeActionGroup: {
        display: "inline-flex",
        alignItems: "stretch",
        borderRadius: "32px",
        overflow: "hidden",
        transform: "scale(1)",
        transition: "all 500ms cubic-bezier(0.25, 0.46, 0.45, 0.94) !important",
        animationName: "$bounceGlow",
        animationTimingFunction: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        animationDuration: "4s",
        animationFillMode: "both",
        animationDelay: "1.5s",
        animationIterationCount: "infinite",
        boxShadow: "0 0 12px #ffffff66, 0 0 24px #ffffff99, 0 4px 20px rgba(0,0,0,0.2)",
        // box-shadow can't be composited, so hinting it bought nothing and
        // cost an over-allocated layer; transform is the useful hint. The
        // shadow keyframes still repaint, but only ~0.5 s out of every 4 s
        // cycle (12% → 100% holds the base values).
        willChange: "transform",
        // Hover lifts the WHOLE group so the square junction never shears apart;
        // per-button feedback is background-only (see below).
        "&:hover": {
            animationName: "$pulseHover",
            animationTimingFunction: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            animationDuration: "400ms",
            animationFillMode: "both",
            animationDelay: "0ms",
            animationIterationCount: "1",
            boxShadow: "0 0 30px #ffffff99, 0 0 60px #ffffffcc, 0 10px 40px rgba(0,0,0,0.4)",
            transform: "scale(1.06) translateY(-3px)",
        },
    },
    homeActionLearn: {
        background: "white",
        color: "#2f2f2f",
        // Pill on the outside, dead-square at the junction.
        borderRadius: "32px 0 0 32px !important",
        padding: "6px 22px",
        minWidth: "0 !important",
        transition: "background 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94) !important",
        "& .MuiButton-label": {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
        },
        "& svg": {
            fontSize: "1.5rem",
            marginBottom: "3px",
        },
        "& .homeActionLearnText": {
            fontSize: "11px",
            letterSpacing: "0.06em",
            lineHeight: 1,
            whiteSpace: "nowrap",
        },
        "&:hover": {
            background: "#e9e9e9",
        },
        // Grey ripple, computed ONCE at authoring time instead of pushing the
        // rainbow through a per-frame grayscale(1) filter. Each stop is the
        // CSS-filter luminance (0.2126 R + 0.7152 G + 0.0722 B, sRGB) of the
        // brand color it replaces, alphas untouched:
        //   #f000ff→#454545  #0095ff→#7d7d7d  #0cffe9→#cacaca
        //   #d8ff00→#e4e4e4  #f59300→#9d9d9d  #6f0000→#181818
        // (The `in hsl shorter hue` interpolation is dropped HERE only: between
        // achromatic stops it changes nothing, and the plain syntax also
        // parses on engines that don't know color-interpolation gradients.
        // The fullscreen rainbow overlay keeps its hsl path — see
        // homeOverlay2.)
        '& .MuiTouchRipple-child': {
            backgroundImage: `
            radial-gradient(
              circle at 50% 50%,
              #4545456b, #7d7d7ddb, #cacacaba, #e4e4e4b5, #9d9d9dc2, #181818c7, transparent, transparent
            )`,
        },
        [theme.breakpoints.down("sm")]: {
            padding: "4px 16px",
        },
    },
    homeActionBrowse: {
        background: "white",
        borderRadius: "0 32px 32px 0 !important",
        // Wider than its sibling on purpose — this is the primary action.
        padding: "14px 16px",
        fontSize: "16px",
        transition: "background 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94) !important",
        "& svg": {
            marginLeft: "10px",
            fontSize: "1.75rem",
        },
        "&:hover": {
            background: "#f4f4f4",
            boxShadow: "none",
            "& svg": {},
        },
        // Same pre-greyed ripple as the Learn button (see the note there).
        '& .MuiTouchRipple-child': {
            backgroundImage: `
            radial-gradient(
              circle at 50% 50%,
              #4545456b, #7d7d7ddb, #cacacaba, #e4e4e4b5, #9d9d9dc2, #181818c7, transparent, transparent
            )`,
        },
        [theme.breakpoints.down("sm")]: {
            padding: "12px 30px",
            fontSize: "16px",
        },
    },
    homeText: {
        userSelect: "none",
        padding: "16px",
        textAlign: "center",
        width: "100%",
        zIndex: 1,
        "& > h3": {
            fontSize: "24px",
            fontWeight: "normal"
        }
    },
    homeOverlay1: {
        contain: "size style layout",
        opacity: 1.0,
        zIndex: 0,
        // No own transition: the `& > .overlay` rules on homeRoot already own
        // the opacity transition (and win on specificity), and `all` here only
        // widened what the style engine had to watch.
        position: "absolute",
        pointerEvents: "none",
        userSelect: "none",
        width: "100%",
        height: "100%",
        top: 0,
        left: 0,
        background: "linear-gradient(90deg, black 16px, #0000003d 192px, #00000000 256px)"
    },
    homeOverlay2: {
        overflow: "hidden",
        animationName: "$spiralReveal",
        animationTimingFunction: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        animationDuration: "600ms",
        animationFillMode: "both",
        animationDelay: "0ms",
        left: "35%",
        top: "55%",
        // No willChange: this element is 200% × 200% of the viewport, and the
        // old hint (five properties, incl. top/left which aren't compositable
        // and backdrop-filter which is never used) pinned a texture ~16× the
        // screen for the whole session. The 600 ms one-shot reveal promotes
        // itself while it runs; after that the layer can be released.
        contain: "size style layout",
        backgroundPosition: "0% 0%",
        zIndex: 1,
        position: "fixed",
        pointerEvents: "none",
        userSelect: "none",
        width: "200%",
        height: "200%",
        backgroundOrigin: "border-box",
        backgroundRepeat: "no-repeat",
        // backgroundAttachment: local / the old touchActions typo removed:
        // nothing here scrolls or receives touches (pointer-events: none).
        backgroundSize: "125% 150% !important",
        // The `in hsl shorter hue` interpolation STAYS here: this overlay is a
        // real rainbow and the hue PATH between stops is the whole effect —
        // unlike the CTA ripples, where every stop is achromatic and the
        // keyword changed nothing. A plain-sRGB twin is declared as a fallback
        // so an engine that can't parse the keyword drops only the second
        // declaration (leaving a rainbow) instead of the only one (leaving the
        // overlay blank). Where the keyword IS supported, the later
        // declaration wins and the look is unchanged.
        fallbacks: {
            background: "radial-gradient(circle at 70% 70%, transparent, transparent 31%, #f000ff6b 36%, #0095ffdb 42%, #0cffe9ba 46%, #d8ff00b5 50%, #f59300c2 53%, #6f0000c7 57%, transparent 61%)"
        },
        background: "radial-gradient(circle at 70% 70% in hsl shorter hue, transparent, transparent 31%, #f000ff6b 36%, #0095ffdb 42%, #0cffe9ba 46%, #d8ff00b5 50%, #f59300c2 53%, #6f0000c7 57%, transparent 61%)"
    },
    homeExample: {
        display: "flex",
        flexDirection: "row",
        justifyContent: "flex-start",
        alignItems: "flex-start",
        zIndex: -1,
        // The slide is driven from JS now (elastic marquee — see _stripLoop):
        // the old `smoothSlide` CSS keyframes owned `transform` for the whole
        // animation, so a pointer could never take over mid-flight without a
        // visible snap. JS writes one translate3d per frame instead, and the
        // auto-drift, grab-and-roll and wheel input all share that transform.
        willChange: "transform",
        cursor: "grab",
        // Horizontal pans belong to the strip; vertical stays with the
        // browser (pinch-zoom etc.) so touch gestures don't dead-end here.
        touchAction: "pan-y",
        "&.dragging": {
            cursor: "grabbing",
        },
        // While rolling, the hover pop would make items jiggle under the
        // pointer — freeze it for the duration of the gesture. (The base
        // 600 ms transform transition un-pops the grabbed item smoothly.)
        "&.dragging > div:hover": {
            transform: "scale(1) translateY(0px)",
            zIndex: 0,
        },
        "&.dragging > div::after": {
            cursor: "grabbing",
        },
        "& > div::after": {
            position: "absolute",
            content: "''",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            userSelect: "none",
            cursor: "grab",
            background: "transparent"
        },
        // No rotateY(0) / backface-visibility on the items anymore: the 3D
        // transform forced EVERY tile onto its own permanent compositor layer
        // (~30 textures of GPU memory), for nothing — the whole strip already
        // moves as ONE layer via the per-frame translate3d on the container,
        // and a hovered tile promotes itself for the duration of its
        // transition. (content-visibility: visible was the default, dropped.)
        "& > div": {
            transition: "transform 600ms cubic-bezier(0.25, 0.46, 0.45, 0.94) !important",
            position: "relative",
            height: "300px",
            userSelect: "none",
            margin: "16px",
            transform: "scale(1) translateY(0px)",
            [theme.breakpoints.down("md")]: {
                height: "240px",
            }
        },
        "& > div:hover": {
            borderRadius: "24px",
            transition: "transform 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94) !important",
            transform: "scale(1.08) translateY(-12px)",
            zIndex: 10,
        },
        "& > div img": {
            borderRadius: "32px",
            height: "100%",
            // Kill the native image ghost-drag so the grab gesture wins
            // (draggable={false} on the imgs covers the rest).
            "-webkit-user-drag": "none",
        },
    },
    homeTiltedPictures: {
        zIndex: -1,
        [theme.breakpoints.down("md")]: {
            marginTop: "32px"
        },
        [theme.breakpoints.down("sm")]: {
            marginTop: "24px"
        }
    },
    bgCanvas: {
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        // The WebGL backing buffer is sized from window.innerHeight (the
        // visible viewport); dvh makes the CSS box match it 1:1 so the
        // starfield isn't vertically stretched on mobile (vh = URL-bar-
        // hidden height there). 100vh kept as JSS fallback.
        fallbacks: { height: "100vh" },
        height: "100dvh",
        zIndex: -1,
        background: "#000"
        // No CSS `filter: grayscale()` here on purpose: stars are greyscaled inside
        // the fragment shader and the lightning is kept blue, both in this SAME canvas.
        // A CSS filter on this element would desaturate the lightning too — which is
        // exactly why the greyscale lives in WebGL. Any global CSS effect added here
        // would apply to both layers at once.
    }
});
// Performance detection constants
const PERF_TEST_DURATION = 2000; // Test for 2 seconds
const PERF_FPS_THRESHOLD = 28;   // Below this = low performance mode
const PERF_FPS_HARD_FLOOR = 15;  // Below this even the low tier is retired
// A single frame this long means software rasterization (SwiftShader /
// llvmpipe — Lighthouse, PSI, VMs, GPU-blocklisted machines): each frame
// there costs 0.4–1.1 s of MAIN-THREAD CPU. Two such frames in a row and
// the shader is stopped immediately, without waiting out the 2 s probe
// (whose own frames would each block the main thread for ~1 s).
const PERF_SLOW_FRAME_MS = 250;
const PERF_SLOW_FRAME_STRIKES = 2; // consecutive slow frames before stopping

// Backing-store cap. The canvas renders at DEVICE resolution (CSS px × DPR) so
// the thin lightning bolt stays crisp on hi-DPI / Retina screens instead of being
// rendered small and stretched up. This cap only stops 4K/5K from rendering an
// absurd pixel count; it is NOT a quality downgrade at normal sizes.
const MAX_BACKING_DIM = 3072; // longest side, device px
const DPR_CAP = 2;            // ignore DPR beyond 2× (diminishing returns)

// Shader work per quality tier. Fewer fbm octaves / star layers = far cheaper
// fragments — and crucially this does NOT affect sharpness (that comes from
// resolution), so the bolt stays crisp on every tier. Pushed as uniforms each
// frame, so the tier can change after the perf test with NO shader recompile.
const QUALITY = {
    low:    { octaves: 4, layers: 4 },
    normal: { octaves: 6, layers: 5 },
};

// ── Elastic artwork strip ──
// ONE velocity model drives the marquee: the ambient auto-drift, pointer
// drags (grab & roll) and wheel/scroll impulses all feed the same offset.
// STRIP_LOOP_SECONDS preserves the old CSS timing (50% over 20 s), so the
// idle look is identical to the retired `smoothSlide` keyframes.
const STRIP_LOOP_SECONDS = 20;
// Per-frame (60 fps reference) decay of the velocity EXCESS over the ambient
// drift: flings and wheel kicks relax back into the auto-rotation instead of
// the strip stopping dead — that's the "elastic" part. Applied as
// pow(STRIP_FRICTION, dt * 60) so it's frame-rate independent.
const STRIP_FRICTION = 0.94;
// How hard the strip chases the finger while grabbed (1 = rigid 1:1, lower =
// more rubber-band). ~100 ms of lag at 0.35 — noticeable, not sloppy.
const STRIP_FOLLOW = 0.35;
const STRIP_WHEEL_GAIN = 5;        // px/s of velocity impulse per wheel px
const STRIP_MAX_SPEED = 6000;      // px/s clamp for flings + wheel bursts
const STRIP_FLING_WINDOW_MS = 120; // pointer-sample window → release velocity

class Home extends React.PureComponent {
    constructor(props) {
        super(props);
        // Only what render() actually reads lives in state. classes comes
        // straight from props (withStyles), HISTORY is a module constant, and
        // the old `_settings` mirror + its componentDidUpdate sync made every
        // settings change re-render this page TWICE for a value nothing here
        // consumed.
        this.state = {
            _y: 0,
            _firstTimeRevealImage: 100,
            _intervalTimeRevealImage: 2000,
            _intervalTimeRevealImageMultipier: 0.8,
            _learn_more_opened: false,
            // Stays true after the first open, so the lazily-loaded dialog
            // keeps its exit transition instead of unmounting abruptly.
            _learn_more_mounted: false,
            // The artwork strip ships in its own chunk (../data/homeArts) and
            // is loaded on idle right after mount — see componentDidMount.
            // Keeping it out of this (eagerly imported) module keeps ~195 KB
            // of base64 out of the critical-path entry bundle.
            _artworks_url: [],
            _lowPerformance: false,
            _performanceLocked: false, // Once set, don't change
            _svg_logo: getIT()
        };
        // Synchronous mount flag — used by animation loops (must NOT be in state)
        this._mounted = false;
        // Handle for the deferred (post-first-paint) WebGL init, so it can be
        // cancelled if the page unmounts before it fires.
        this._initRafId = 0;
        // rAF-throttle for window resizes: mobile URL-bar show/hide and
        // desktop drag-resize fire resize storms, and each raw call
        // reallocated the full-DPR WebGL backing store per EVENT.
        this._resizeRaf = 0;
        // Performance test variables (not in state to avoid re-renders)
        this._perfTestStart = 0;
        this._perfFrameCount = 0;
        this._perfLastTs = 0;      // previous rAF timestamp (slow-frame probe)
        this._perfSlowStrikes = 0; // consecutive frames over PERF_SLOW_FRAME_MS
        // WebGL resource tracking for cleanup (single merged canvas)
        this._program = null;
        this._buffer = null;
        // Lightning region size in framebuffer px (recomputed on every resize)
        this._energyW = 0;
        this._energyH = 0;
        // Mouse tracking (smooth interpolation, no setState)
        this._targetMouseX = window.innerWidth / 2;
        this._targetMouseY = window.innerHeight / 2;
        this._smoothMouseX = window.innerWidth / 2;
        this._smoothMouseY = window.innerHeight / 2;
        // ── Elastic artwork strip (all outside state: touched every frame) ──
        this._stripEl = null;
        this._stripHalf = 0;        // px width of ONE copy of the artworks (loop period)
        this._stripOffset = 0;      // current position, px — applied as translate3d(-offset)
        this._stripVelocity = 0;    // px/s; relaxes toward _stripAutoSpeed when idle
        this._stripAutoSpeed = 0;   // px/s ambient drift = _stripHalf / STRIP_LOOP_SECONDS
        this._stripRafId = 0;
        this._stripLastTs = 0;
        this._stripMeasureRaf = 0;
        this._stripDragging = false;
        this._stripPointerId = -1;
        this._stripDragStartX = 0;
        this._stripDragStartOffset = 0;
        this._stripDragTarget = 0;
        this._stripAppliedOffset = NaN; // last offset written to style (NaN ⇒ first write always lands)
        this._stripSamples = [];    // recent {t, x} pointer moves → fling velocity
        // Reduced motion retires the auto-drift only; drag & wheel stay
        // available (explicit user input) — same policy as the shader above.
        this._stripReducedMotion = !!(window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    }

    componentDidMount() {
        this._mounted = true;
        // No mousemove listener here anymore: the parallax exists solely for
        // the shader's uMouse uniform, so it's registered in _setBgCanvasRef
        // once a healthy GL context exists and dropped again in _stopBg.
        window.addEventListener('resize', this._handleResize, { passive: true });
        // Wheel anywhere on the page rolls the strip — the landing page has
        // nothing else to scroll (homeRoot is a fixed 100dvh box). Passive:
        // the handler never preventDefaults, so no scroll-blocking warnings.
        window.addEventListener('wheel', this._onStripWheel, { passive: true });

        // Elastic strip loop — one transform write per frame for the page's
        // lifetime (rAF self-pauses on hidden tabs). Deliberately separate
        // from the WebGL loop: the shader may retire itself on weak machines
        // (_stopBg) and the marquee must keep rolling regardless.
        this._stripRafId = requestAnimationFrame(this._stripLoop);

        // Deferred artwork strip: fetch the base64 art chunk once first
        // paint and the WebGL init have had a frame to breathe. The module
        // is cached after the first visit, so the marquee fills near-
        // instantly on return visits while never blocking the entry parse.
        this._artsIdleId = idle(() => {
            this._artsIdleId = null;
            import("../data/homeArts")
                .then((m) => {
                    if (!this._mounted) return;
                    // Callback re-measures the loop period once the items are
                    // committed (each img onLoad re-measures again as widths
                    // settle — the strip is width-agnostic until then).
                    this.setState(
                        { _artworks_url: (m && m.default) || [] },
                        this._scheduleStripMeasure
                    );
                })
                .catch(() => { /* non-critical: marquee just stays empty */ });
        });
    }

    componentWillUnmount() {
        // Synchronous flag stops the animation loop immediately
        this._mounted = false;

        // Cancel a still-pending deferred artwork load
        if (this._artsIdleId != null) {
            cancelIdle(this._artsIdleId);
            this._artsIdleId = null;
        }

        // Cancel a still-pending throttled resize
        if (this._resizeRaf) {
            cancelAnimationFrame(this._resizeRaf);
            this._resizeRaf = 0;
        }

        // Cancel a still-pending deferred GL init (mounted then unmounted
        // before the double rAF fired). The _mounted guard in _initBg also
        // covers a callback already in flight.
        if (this._initRafId) {
            cancelAnimationFrame(this._initRafId);
            this._initRafId = 0;
        }

        // ── Hide canvas BEFORE GL teardown ──
        // Stops the compositor from showing the last-painted framebuffer during the
        // unmount → next-page-mount transition (otherwise a single frame can flash).
        if (this._canvas) {
            this._canvas.style.display = "none";
        }

        if (this._animationId) {
            cancelAnimationFrame(this._animationId);
            this._animationId = null;
        }

        // ── Elastic strip teardown ──
        if (this._stripRafId) {
            cancelAnimationFrame(this._stripRafId);
            this._stripRafId = 0;
        }
        if(this._imageAppearsTimeout) {
            clearTimeout(this._imageAppearsTimeout)
        }
        if (this._stripMeasureRaf) {
            cancelAnimationFrame(this._stripMeasureRaf);
            this._stripMeasureRaf = 0;
        }
        this._stripEl = null;

        window.removeEventListener('mousemove', this._handleMouseMove);
        window.removeEventListener('resize', this._handleResize);
        window.removeEventListener('wheel', this._onStripWheel);

        // ── WebGL cleanup: free GPU resources (single context now) ──
        this._cleanupGL(this._gl, this._program, this._buffer);

        this._canvas = null;
        this._gl = null;
    }

    /** Delete a program + buffer, then lose the context */
    _cleanupGL = (gl, program, buffer) => {
        if (!gl) return;
        try {
            if (program) gl.deleteProgram(program);
            if (buffer) gl.deleteBuffer(buffer);
            const ext = gl.getExtension("WEBGL_lose_context");
            if (ext) ext.loseContext();
        } catch (_) { /* swallow */ }
    }

    _handleMouseMove = (e) => {
        // Store target position - will be interpolated in render loop (no setState!)
        this._targetMouseX = e.clientX;
        this._targetMouseY = e.clientY;
    }

    // Coalesced through rAF: resize storms (mobile URL bar, drag-resize) now
    // cost at most one canvas resize + one strip measure per frame.
    _handleResize = () => {
        if (this._resizeRaf) return;
        this._resizeRaf = requestAnimationFrame(() => {
            this._resizeRaf = 0;
            if (!this._mounted) return;
            if (this._canvas && this._gl) {
                this._resizeCanvas();
            }
            // Item heights are breakpoint-dependent (300 → 240 px), so the
            // loop period changes with the viewport too.
            this._scheduleStripMeasure();
        });
    }

    // ═══════════════ Elastic artwork strip ═══════════════
    // The marquee used to be a CSS keyframes animation (translateX 0 → -50%
    // over 20 s). CSS owns `transform` for the whole animation though, so a
    // pointer could never take over mid-flight without a snap. It is driven
    // from JS now, with ONE velocity model shared by three inputs:
    //   • the ambient auto-drift (same speed & direction as the old CSS),
    //   • grab & roll (pointer capture, elastic follow, fling on release),
    //   • wheel / trackpad scroll anywhere on the page (velocity impulses).
    // Everything lives OUTSIDE state (touched every frame — same rule as the
    // mouse parallax above) and the loop writes exactly one translate3d per
    // frame, negligible next to the WebGL background.

    _setStripRef = (el) => {
        this._stripEl = el;
        if (el) this._scheduleStripMeasure();
    }

    // Loop period = distance between copy #1 and copy #2 of the SAME artwork
    // (children[count] vs children[0]). Measured from offsetLeft instead of
    // scrollWidth / 2 because trailing flex margins are excluded from scroll
    // overflow in some engines — scrollWidth / 2 would come up ~8 px short
    // and the wrap point would visibly jump once per revolution.
    _measureStrip = () => {
        const el = this._stripEl;
        const count = this.state._artworks_url.length;
        if (!el || !count || el.children.length < count * 2) {
            this._stripHalf = 0;
            this._stripAutoSpeed = 0;
            return;
        }
        this._stripHalf = Math.max(0, el.children[count].offsetLeft - el.children[0].offsetLeft);
        this._stripAutoSpeed = this._stripHalf / STRIP_LOOP_SECONDS;
    }

    // Debounced through rAF: every img onLoad calls this (the base64 chunk
    // decodes the whole strip in a burst) and one layout read per frame is
    // plenty. The velocity model self-adapts — no reset needed on re-measure.
    _showNextImage = () => {
        return setTimeout(() => {
            const newY = this.state._y + 1 | 0;
            const newIntervalTimeRevealImage = this.state._intervalTimeRevealImage * this.state._intervalTimeRevealImageMultipier;

            if(this.state._artworks_url.length >= newY){
               this.setState({_y: newY, _intervalTimeRevealImage: newIntervalTimeRevealImage}, () => {
                   this._imageAppearsTimeout = this._showNextImage();
                });
            }
        }, this.state._intervalTimeRevealImage);
    }
    
    _scheduleStripMeasure = () => {
        setTimeout(() => {
            this._imageAppearsTimeout = this._showNextImage();
        }, this.state._firstTimeRevealImage);
        if (this._stripMeasureRaf) return;
        this._stripMeasureRaf = requestAnimationFrame(() => {
            this._stripMeasureRaf = 0;
            if (this._mounted) this._measureStrip();
        });
    }

    _stripLoop = (ts) => {
        if (!this._mounted) return;
        this._stripRafId = requestAnimationFrame(this._stripLoop);

        const last = this._stripLastTs || ts;
        this._stripLastTs = ts;
        // Clamp the step: the first frame back from a hidden tab reports a
        // multi-second dt (rAF pauses there) — uncapped, the strip teleports.
        const dt = Math.min(Math.max((ts - last) / 1000, 0), 0.05);
        const el = this._stripEl;
        const half = this._stripHalf;
        if (!el || half <= 0 || dt === 0) return;

        // The Learn-More dialog covers the whole page: freeze the marquee (and
        // its per-frame style write) while it's open. _stripLastTs kept
        // updating above, so the resume dt is one frame, not the whole pause.
        if (this.state._learn_more_opened) return;

        if (this._stripDragging) {
            // Elastic follow: chase the finger with a light rubber-band lag.
            const k = 1 - Math.pow(1 - STRIP_FOLLOW, dt * 60);
            this._stripOffset += (this._stripDragTarget - this._stripOffset) * k;
        } else {
            // Decay the EXCESS over the ambient drift, not the velocity
            // itself: flings and wheel kicks relax back into the auto-
            // rotation (even from the "wrong" direction — the sign crossing
            // is smooth) instead of the strip ever stopping dead.
            const auto = this._stripReducedMotion ? 0 : this._stripAutoSpeed;
            const excess = (this._stripVelocity - auto) * Math.pow(STRIP_FRICTION, dt * 60);
            this._stripVelocity = auto + excess;
            this._stripOffset += this._stripVelocity * dt;
            // Wrap into [0, half) — the modulo keeps BOTH directions
            // seamless. (Not while dragging: the finger's target must stay
            // in the same coordinate space as the offset all gesture long.)
            this._stripOffset = ((this._stripOffset % half) + half) % half;
        }

        // Write only on change: with prefers-reduced-motion (no drift) or a
        // settled velocity the offset is static, and re-writing an identical
        // transform still invalidates style every frame for nothing.
        if (this._stripOffset !== this._stripAppliedOffset) {
            this._stripAppliedOffset = this._stripOffset;
            el.style.transform = `translate3d(${-this._stripOffset}px, 0, 0)`;
        }
    }

    _onStripPointerDown = (e) => {
        // Primary pointer only (first finger / left mouse button).
        if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
        const el = this._stripEl;
        if (!el || this._stripHalf <= 0) return;

        this._stripDragging = true;
        this._stripPointerId = e.pointerId;
        this._stripDragStartX = e.clientX;
        this._stripDragStartOffset = this._stripOffset;
        this._stripDragTarget = this._stripOffset;
        this._stripVelocity = 0;
        this._stripSamples.length = 0;
        this._stripSamples.push({ t: performance.now(), x: e.clientX });

        el.classList.add("dragging");
        // Capture so the roll keeps following even when the pointer leaves
        // the strip (or the window) mid-gesture.
        try { el.setPointerCapture(e.pointerId); } catch (_) { /* older engines */ }
    }

    _onStripPointerMove = (e) => {
        if (!this._stripDragging || e.pointerId !== this._stripPointerId) return;
        // Finger right → strip right → offset decreases (offset is applied negated).
        this._stripDragTarget = this._stripDragStartOffset - (e.clientX - this._stripDragStartX);

        const now = performance.now();
        this._stripSamples.push({ t: now, x: e.clientX });
        while (this._stripSamples.length > 2 &&
        now - this._stripSamples[0].t > STRIP_FLING_WINDOW_MS) {
            this._stripSamples.shift();
        }
    }

    _onStripPointerUp = (e) => {
        if (!this._stripDragging || e.pointerId !== this._stripPointerId) return;
        this._endStripDrag(e, true);
    }

    // pointercancel = the browser confiscated the gesture (e.g. it turned
    // into a vertical scroll under touch-action: pan-y) — end WITHOUT a fling.
    _onStripPointerCancel = (e) => {
        if (!this._stripDragging || e.pointerId !== this._stripPointerId) return;
        this._endStripDrag(e, false);
    }

    _endStripDrag = (e, withFling) => {
        this._stripDragging = false;
        this._stripPointerId = -1;

        const el = this._stripEl;
        if (el) {
            el.classList.remove("dragging");
            try { el.releasePointerCapture(e.pointerId); } catch (_) { /* already released */ }
        }

        // Release velocity from samples RECENT AT RELEASE TIME only (px/s).
        // Samples are pushed on move events, so a drag that pauses before
        // release still holds the pre-pause burst — without this cutoff the
        // strip would phantom-fling on a hold-then-release. Filtering by the
        // release clock means: paused finger → no recent samples → v = 0 →
        // hand back to the auto-drift, which is the expected feel.
        let v = 0;
        if (withFling) {
            const now = performance.now();
            this._stripSamples.push({ t: now, x: e.clientX });
            const s = this._stripSamples.filter((p) => now - p.t <= STRIP_FLING_WINDOW_MS);
            if (s.length >= 2) {
                const a = s[0];
                const b = s[s.length - 1];
                const span = b.t - a.t;
                if (span > 16) v = -((b.x - a.x) / span) * 1000;
            }
        }
        this._stripVelocity = Math.max(-STRIP_MAX_SPEED, Math.min(STRIP_MAX_SPEED, v));
        this._stripSamples.length = 0;
    }

    _onStripWheel = (e) => {
        if (this._stripHalf <= 0 || this._stripDragging) return;
        // Dialog open → its scrollable content owns the wheel.
        if (this.state._learn_more_opened) return;

        let d = e.deltaY + e.deltaX; // trackpad horizontal swipes count too
        if (e.deltaMode === 1) d *= 16;                      // lines → px
        else if (e.deltaMode === 2) d *= window.innerHeight; // pages → px
        if (!d) return;

        // A wheel tick is an impulse into the SAME physics as a fling — the
        // strip rolls forward/backward, then relaxes back into the drift.
        this._stripVelocity = Math.max(
            -STRIP_MAX_SPEED,
            Math.min(STRIP_MAX_SPEED, this._stripVelocity + d * STRIP_WHEEL_GAIN)
        );
    }

    _checkPerformance = (timestamp) => {
        // Skip if already locked
        if (!this._mounted || this.state._performanceLocked) return;

        // Initialize test start
        if (this._perfTestStart === 0) {
            this._perfTestStart = timestamp;
            this._perfFrameCount = 0;
            this._perfLastTs = timestamp;
            this._perfSlowStrikes = 0;
            return;
        }

        // Fast bail: TWO CONSECUTIVE frames over PERF_SLOW_FRAME_MS mean the
        // shader is being rasterized in software (or the machine has no
        // business running it) — retire it NOW instead of letting the 2 s
        // probe block the main thread for seconds. Requiring consecutive
        // strikes forgives a one-off GC pause, and also the huge timestamp
        // delta of the first frame back from a hidden tab (rAF doesn't fire
        // while hidden) — the fast frame that follows resets the counter.
        const frameMs = timestamp - this._perfLastTs;
        this._perfLastTs = timestamp;
        if (frameMs > PERF_SLOW_FRAME_MS) {
            if (++this._perfSlowStrikes >= PERF_SLOW_FRAME_STRIKES) {
                console.log(`Performance test: ${frameMs.toFixed(0)} ms frame → shader STOPPED (software rendering suspected)`);
                this.setState({ _lowPerformance: true, _performanceLocked: true });
                this._stopBg();
                return;
            }
            // A single slow frame (GC pause, or the multi-second rAF gap of a
            // hidden tab) poisons the fps average — restart the sampling
            // window instead of letting a 5 s tab-switch gap read as
            // "0.8 fps" and trip the hard floor below. The strike counter
            // deliberately SURVIVES the restart, so a genuinely slow renderer
            // still stops on its very next slow frame.
            this._perfTestStart = timestamp;
            this._perfFrameCount = 0;
            return;
        } else {
            this._perfSlowStrikes = 0;
        }

        this._perfFrameCount++;
        const elapsed = timestamp - this._perfTestStart;

        // After test duration, make final decision and lock it
        if (elapsed >= PERF_TEST_DURATION) {
            const fps = (this._perfFrameCount / elapsed) * 1000;

            // Below the hard floor even the low tier can't keep the main
            // thread breathing — retire the shader, keep the static bg.
            if (fps < PERF_FPS_HARD_FLOOR) {
                console.log(`Performance test: ${fps.toFixed(1)} FPS → shader STOPPED (below hard floor)`);
                this.setState({ _lowPerformance: true, _performanceLocked: true });
                this._stopBg();
                return;
            }

            const isLowPerf = fps < PERF_FPS_THRESHOLD;

            console.log(`Performance test: ${fps.toFixed(1)} FPS → ${isLowPerf ? 'LOW' : 'NORMAL'} mode (locked)`);

            this.setState({
                _lowPerformance: isLowPerf,
                _performanceLocked: true
            }, () => {
                this._resizeCanvas();
            });
        }
    }

    // ── Mid-session retirement of the shader (perf bail) ──
    // Stops the loop, frees the GL resources and fades the canvas out so the
    // static black background takes over. componentWillUnmount keeps its own
    // display:none teardown for the page-leave case; this one is gentler
    // because the user is still looking at the page. The `if (!this._gl)`
    // guard in the render loop keeps the (already-scheduled) closure from
    // drawing on the lost context and re-arming rAF afterwards.
    _stopBg = () => {
        if (this._animationId) {
            cancelAnimationFrame(this._animationId);
            this._animationId = null;
        }
        if (this._initRafId) {
            cancelAnimationFrame(this._initRafId);
            this._initRafId = 0;
        }
        // Nothing reads the cursor once the loop is gone — stop tracking it.
        // (componentWillUnmount's unconditional removal stays correct: a
        // second removeEventListener for an absent listener is a no-op.)
        window.removeEventListener('mousemove', this._handleMouseMove);
        if (this._canvas) {
            this._canvas.style.transition = "opacity 200ms ease-out";
            this._canvas.style.opacity = "0";
        }
        this._cleanupGL(this._gl, this._program, this._buffer);
        this._gl = null;
        this._program = null;
        this._buffer = null;
    }

    _goToFeed = () => {
        // Fade the canvas before unmount so it doesn't visibly snap away
        if (this._canvas) {
            this._canvas.style.transition = "opacity 200ms ease-out";
            this._canvas.style.opacity = "0";
        }
        // Navigate immediately — fade runs in parallel with the route change
        HISTORY.push("/created/");
    }

    _openLearnMore = () => {
        // Mount flag triggers the lazy chunk fetch; open flag drives the Dialog.
        this.setState({ _learn_more_opened: true, _learn_more_mounted: true });
    };

    _closeLearnMore = () => {
        this.setState({ _learn_more_opened: false });
    };

    _setBgCanvasRef = (canvas) => {
        if (!canvas?.getContext) return;

        // Users who asked the OS for reduced motion get the static background:
        // the canvas keeps its inline black background and no GL loop starts.
        if (window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            return;
        }

        const gl = canvas.getContext("webgl2", {
            antialias: false,
            alpha: false,
            depth: false,                 // 2D fullscreen pass — no depth buffer needed
            stencil: false,               // …and no stencil buffer
            preserveDrawingBuffer: false,
            desynchronized: true,         // skip extra compositor sync where supported
            powerPreference: "low-power", // prefer the low-power GPU
            // On SOFTWARE renderers (SwiftShader / llvmpipe — Lighthouse, PSI
            // bots, VMs, remote desktops, GPU-blocklisted machines) every
            // drawArrays of this shader executes on the CPU and blocks the
            // MAIN THREAD for 0.4–1.1 s per frame. This flag makes
            // getContext() return null there instead of handing back a
            // context that freezes the page — the null return below then
            // leaves the static black background in place.
            failIfMajorPerformanceCaveat: true
        });

        if (!gl) return;

        // Belt and braces: a few drivers still hand out a "hardware" context
        // that is software underneath. If the renderer string admits it, bail
        // out before any shader work. The slow-frame probe in
        // _checkPerformance stays as the last line of defense if the string
        // lies too.
        try {
            const dbg = gl.getExtension("WEBGL_debug_renderer_info");
            const renderer = dbg
                ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
                : "";
            if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer)) {
                const ext = gl.getExtension("WEBGL_lose_context");
                if (ext) ext.loseContext();
                return;
            }
        } catch (_) { /* renderer string unavailable — continue */ }

        this._canvas = canvas;
        this._gl = gl;

        // The cursor parallax feeds ONLY the shader's uMouse uniform, so the
        // window listener starts here — after the reduced-motion, no-WebGL2
        // and software-renderer bail-outs above — instead of at mount for
        // every visitor. Idempotent: re-adding the same handler reference is
        // a no-op, and _stopBg / componentWillUnmount remove it.
        window.addEventListener('mousemove', this._handleMouseMove, { passive: true });

        // Defer GL init off the first-paint critical path. This ref callback
        // fires during React's commit, BEFORE the browser paints — running the
        // shader compile + link + buffer setup here (the fragment shader is
        // large: fbm star field + lightning) blocks first paint by tens of ms,
        // so the title, logo and CTA would all wait on shader compilation. The
        // canvas already shows its inline black background, so the DOM content
        // paints on the first frame and the starfield fades in ~1 frame later.
        // The double rAF guarantees that first frame has committed before the
        // expensive work runs; the handle is cancelled on unmount and _initBg
        // re-checks _mounted defensively.
        this._initRafId = requestAnimationFrame(() => {
            this._initRafId = requestAnimationFrame(() => {
                this._initRafId = 0;
                if (this._mounted) this._initBg();
            });
        });
    }

    _resizeCanvas = () => {
        const canvas = this._canvas;
        const gl = this._gl;
        if (!gl || !canvas) return;

        const cssW = window.innerWidth;
        const cssH = window.innerHeight;

        // Render at DEVICE resolution so the lightning is pixel-crisp on hi-DPI
        // screens (this is what the old, separate lightning canvas did — the merge
        // had dropped it). Same resolution on every tier: sharpness must not depend
        // on the perf tier. Low-power stays smooth via fewer shader octaves, not by
        // rendering fewer pixels. The cap only reins in 4K/5K.
        const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
        let bw = Math.round(cssW * dpr);
        let bh = Math.round(cssH * dpr);

        const longest = Math.max(bw, bh);
        if (longest > MAX_BACKING_DIM) {
            const k = MAX_BACKING_DIM / longest;
            bw = Math.round(bw * k);
            bh = Math.round(bh * k);
        }
        bw = Math.max(1, bw);
        bh = Math.max(1, bh);

        // Assigning canvas.width/height resets the drawing buffer EVEN when
        // the value is unchanged — skip the reallocation when the backing
        // store is already right (e.g. a resize event that didn't change the
        // rounded device-px size).
        if (canvas.width !== bw || canvas.height !== bh) {
            canvas.width  = bw;
            canvas.height = bh;
        }
        canvas.style.width  = cssW + 'px';
        canvas.style.height = cssH + 'px';

        // Lightning sub-region — same footprint as before (anchored top-left, full
        // height, width = max(66.6vw, min(1440px, 100vw))), expressed in the SAME
        // backing-store px via the real backing/CSS ratio so the bolt keeps its
        // position regardless of DPR or the cap.
        const sx = bw / cssW;
        const energyCssW = Math.max(cssW * 0.666, Math.min(1440, cssW));
        this._energyW = Math.max(1, Math.round(energyCssW * sx));
        this._energyH = bh;

        gl.viewport(0, 0, bw, bh);
    }

    // ── Single merged WebGL background ──
    // Stars (greyscaled in-shader) + lightning (kept blue) are rendered together
    // in ONE fragment shader on ONE canvas, then composited with a screen blend
    // (this replaces the old `mix-blend-mode: screen` between two stacked canvases).
    _initBg = () => {
        const canvas = this._canvas;
        const gl = this._gl;
        if (!gl || !canvas || !this._mounted) return;

        this._resizeCanvas();

        const compileShader = (type, source) => {
            const shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.error('Shader compile error:', gl.getShaderInfoLog(shader));
                throw new Error(gl.getShaderInfoLog(shader));
            }
            return shader;
        };

        const vertexShaderSource = `#version 300 es
            precision mediump float;
            in vec2 a_position;
            out vec2 v_uv;
            void main() {
                v_uv = a_position;            // clip space (-1..1), used by the star field
                gl_Position = vec4(a_position, 0.0, 1.0);
            }`;

        // Merged fragment shader: greyscale stars + blue lightning, screen-blended.
        const fragmentShaderSource = `#version 300 es
            precision mediump float;

            uniform vec2  uResolution;   // full canvas size in px
            uniform float uTime;         // seconds (currentTime * 0.001)
            uniform vec2  uMouse;        // normalised, (0,0) = screen centre, +y up
            uniform vec2  uEnergyRes;    // lightning region px (left-anchored, full height)
            uniform int   uOctaves;      // fbm octaves (quality tier)
            uniform int   uNumLayers;    // star depth layers (quality tier)
            uniform float uLayerStep;    // 1.0 / uNumLayers

            out vec4 fragColor;
            in vec2 v_uv;

            #define TAU 6.28318
            #define Velocity 0.02
            #define CanvasView 15.0

            // ---------------- star field ----------------
            float Hash21(vec2 p) {
                p = fract(p * vec2(123.34, 456.21));
                p += dot(p, p + 45.32);
                return fract(p.x * p.y);
            }

            float Star(vec2 uv) {
                float d = length(uv);
                float m = 0.02 / d;
                m *= smoothstep(0.8, 0.2, d);
                return m;
            }

            // The stars are greyscaled anyway (see main), so the whole star
            // pass runs on SCALARS: instead of building the rainbow hsv2rgb
            // colour per star and collapsing the summed vec3 to luminance at
            // the end, each star contributes its LUMINANCE directly. dot() is
            // linear, so lum(Σ star·colour) == Σ star·lum(colour) — pixel-
            // identical output, one float accumulator instead of three.
            // tm = star-clock (uTime * 1.5) so the original star speed is preserved
            float StarLayer(vec2 uv, float layerIdx, float tm) {
                vec2 gv = fract(uv) - 0.5;
                vec2 id = floor(uv);

                float n = Hash21(id);
                float size = fract(n * 345.67);
                vec2 offset = vec2(n, fract(n * 34.0)) - 0.5;

                float star = Star(gv - offset * 0.8) * size;

                // luminance of the old hsv2rgb(hue) = 0.8·dot(rgb, W) + 0.2
                // (W sums to 1), so the twinkle-with-hue brightness cycle the
                // rainbow produced is preserved exactly.
                float hue = fract(tm * 0.03 + n + layerIdx * 0.15);
                vec3 rgb = clamp(abs(mod(hue * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
                float lum = dot(rgb, vec3(0.299, 0.587, 0.114)) * 0.8 + 0.2;

                star *= 0.5 + 0.5 * sin(tm * 0.5 + n * TAU);

                return star * lum;
            }

            // ---------------- lightning ----------------
            float hash12(vec2 p) {
                vec3 p3 = fract(vec3(p.xyx) * 0.1031);
                p3 += dot(p3, p3.yzx + 33.33);
                return fract((p3.x + p3.y) * p3.z);
            }

            float noise(vec2 p) {
                vec2 ip = floor(p);
                vec2 fp = fract(p);
                fp = fp * fp * (3.0 - 2.0 * fp);
                float a = hash12(ip);
                float b = hash12(ip + vec2(1.0, 0.0));
                float c = hash12(ip + vec2(0.0, 1.0));
                float d = hash12(ip + vec2(1.0, 1.0));
                return mix(mix(a, b, fp.x), mix(c, d, fp.x), fp.y);
            }

            float fbm(vec2 p) {
                float value = 0.0;
                float amplitude = 0.5;
                // precomputed rotation for ~0.45 rad
                mat2 rot = mat2(0.90045, -0.43497, 0.43497, 0.90045);
                // 8 is the unrolled ceiling; the break stops early on cheaper tiers
                for (int i = 0; i < 8; i++) {
                    if (i >= uOctaves) break;
                    value += amplitude * noise(p);
                    p = rot * p * 2.0;
                    amplitude *= 0.5;
                }
                return value;
            }

            void main() {
                // ---- STARS: fullscreen, greyscaled here in the shader ----
                vec2 suv = v_uv;
                suv.x *= uResolution.x / uResolution.y;

                float ts = uTime * 1.5;   // keep original star animation speed

                // mouse parallax — a resting cursor (screen centre) means no shift
                vec2 M = uMouse * 0.15;
                M.x += sin(ts * 0.15) * 0.1;
                M.y += cos(ts * 0.15) * 0.1;

                float t = ts * Velocity;
                float stars = 0.0;   // scalar: luminance accumulates directly
                // 6 is the unrolled ceiling; the break trims layers on cheaper tiers
                for (int li = 0; li < 6; li++) {
                    if (li >= uNumLayers) break;
                    float i = float(li) * uLayerStep;
                    float depth = fract(i + t);
                    float scl = mix(CanvasView, 1.0, depth);
                    float fade = depth * smoothstep(1.0, 0.85, depth);
                    stars += StarLayer(suv * scl + i * 453.2 + M, i, ts) * fade;
                }
                stars *= 1.0 - length(v_uv) * 0.25;   // vignette

                // already luminance — greyscaled per-star above. The lightning
                // below is intentionally NOT desaturated.
                vec3 starsGray = vec3(stars);

                // ---- LIGHTNING: stays blue, placed in the old energy-canvas footprint ----
                // gl_FragCoord is in framebuffer px; dividing by the (left-anchored,
                // full-height) energy region reproduces the bolt's original position/scale.
                vec2 buv = (gl_FragCoord.xy / uEnergyRes) * 2.0 - 1.0;
                buv.x *= uEnergyRes.x / uEnergyRes.y;
                // The bolt lives near buv.x ≈ 0 and fades as 1/dist, so far columns can
                // never contribute — skip the expensive fbm there. Big win on wide
                // screens; on 16:9 the whole width is near the bolt, so nothing changes.
                vec3 bolt = vec3(0.0);
                if (abs(buv.x) < 3.0) {
                    vec2 duv = buv + fbm(buv + uTime * 0.8) * 2.0 - 1.0;
                    float dist = abs(duv.x);
                    bolt = vec3(0.2, 0.3, 0.8) * (0.04 / max(dist, 0.001));
                }

                // ---- composite: screen blend (matches the old stacked-canvas look) ----
                vec3 col = 1.0 - (1.0 - clamp(starsGray, 0.0, 1.0)) * (1.0 - clamp(bolt, 0.0, 1.0));

                fragColor = vec4(col, 1.0);
            }`;

        try {
            const program = gl.createProgram();
            const vShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
            const fShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

            gl.attachShader(program, vShader);
            gl.attachShader(program, fShader);
            gl.bindAttribLocation(program, 0, 'a_position');
            gl.linkProgram(program);

            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                throw new Error(gl.getProgramInfoLog(program));
            }

            gl.deleteShader(vShader);
            gl.deleteShader(fShader);

            const positionBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.bufferData(
                gl.ARRAY_BUFFER,
                new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
                gl.STATIC_DRAW
            );

            gl.clearColor(0, 0, 0, 1);

            // Pre-bind everything once
            gl.useProgram(program);
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

            // Track for cleanup
            this._program = program;
            this._buffer = positionBuffer;

            this._renderBg(program);
        } catch (error) {
            console.error('WebGL setup failed:', error);
        }
    }

    _renderBg = (program) => {
        const gl = this._gl;
        const canvas = this._canvas;
        if (!gl || !canvas) return;

        const resolutionLoc = gl.getUniformLocation(program, 'uResolution');
        const timeLoc       = gl.getUniformLocation(program, 'uTime');
        const mouseLoc      = gl.getUniformLocation(program, 'uMouse');
        const energyResLoc  = gl.getUniformLocation(program, 'uEnergyRes');
        const octavesLoc    = gl.getUniformLocation(program, 'uOctaves');
        const layersLoc     = gl.getUniformLocation(program, 'uNumLayers');
        const layerStepLoc  = gl.getUniformLocation(program, 'uLayerStep');

        let lastTime = 0;
        const frameInterval = 1000 / 30; // cap at 30 FPS (ambient background — no need for 60)

        const render = (currentTime) => {
            if (!this._mounted) return;

            // The Learn-More dialog covers the page (near-fullscreen desktop,
            // fullscreen mobile) — don't burn GPU on a background nobody can
            // see. rAF stays armed so the resume is instant, and the perf
            // probe restarts from scratch on close: a stretch of these no-op
            // frames must not be measured as "fast shader frames".
            if (this.state._learn_more_opened) {
                this._perfTestStart = 0;
                this._animationId = requestAnimationFrame(render);
                return;
            }

            this._checkPerformance(currentTime);
            // _checkPerformance may have just retired the shader (_stopBg
            // nulls _gl). The closure's `gl` would keep "drawing" silently on
            // the lost context and re-arm rAF forever without this guard.
            if (!this._gl) return;

            if (currentTime - lastTime >= frameInterval) {
                // smooth the cursor (lerp) — no setState
                this._smoothMouseX += (this._targetMouseX - this._smoothMouseX) * 0.1;
                this._smoothMouseY += (this._targetMouseY - this._smoothMouseY) * 0.1;

                // Normalise so (0,0) = screen centre, range ~[-1,1], +y up.
                // Done from window size (not framebuffer px), so it's DPR-independent
                // and no longer drifts toward a corner.
                const w = window.innerWidth || 1;
                const h = window.innerHeight || 1;
                const mx = (this._smoothMouseX / w) * 2.0 - 1.0;
                const my = (this._smoothMouseY / h) * 2.0 - 1.0;

                // Use the richer tier only once the perf test confirms headroom.
                // Octave count does NOT affect crispness (resolution does), so the
                // bolt stays sharp during the warmup regardless.
                const q = (this.state._performanceLocked && !this.state._lowPerformance)
                    ? QUALITY.normal
                    : QUALITY.low;

                gl.clear(gl.COLOR_BUFFER_BIT);
                gl.uniform2f(resolutionLoc, canvas.width, canvas.height);
                gl.uniform1f(timeLoc, currentTime * 0.001);
                gl.uniform2f(mouseLoc, mx, -my);
                gl.uniform2f(energyResLoc, this._energyW || canvas.width, this._energyH || canvas.height);
                gl.uniform1i(octavesLoc, q.octaves);
                gl.uniform1i(layersLoc, q.layers);
                gl.uniform1f(layerStepLoc, 1.0 / q.layers);
                gl.drawArrays(gl.TRIANGLES, 0, 6);

                lastTime = currentTime;
            }

            this._animationId = requestAnimationFrame(render);
        };

        requestAnimationFrame(render);
    }

    render() {
        const { classes } = this.props;
        const { _y, _intervalTimeRevealImage, _artworks_url, _learn_more_opened, _learn_more_mounted, _svg_logo } = this.state;
        return (
            <div className={classes.homeRoot}>
                {/* Single WebGL background: greyscale stars + blue lightning, screen-blended */}
                <canvas
                    style={{background: "#000"}}
                    className={classes.bgCanvas}
                    ref={this._setBgCanvasRef}
                />
                <Fade in={true} timeout={600}>
                    <div className={classes.homeOverlay1 + " overlay"} />
                </Fade>
                <div className={classes.homeTitle}>
                    <div>
                        {/* No Fade wrapper: a zero timeout made it a no-op that only cost a Transition instance. */}
                        <img style={{pointerEvents: "none", userSelect: "none", filter: "drop-shadow(0px 0px 6px #ffffff66)"}} className={classes.homeLogo} src={_svg_logo} alt={t("components.home.pixagram_logo")} />
                    </div>
                    <div className={classes.homeTitles}>
                        <h1><span style={{filter: "drop-shadow(0px 0px 8px #ffffff99)"}}>{t("components.home.pixagram_com")}</span></h1>
                        <h2><span>{t("components.home.social_nfts_marketplace")}</span></h2>
                        <h3>
                            <span>{t("components.home.create_artworks_lasting_forever_on_the_blockchai")}</span>
                        </h3>
                    </div>
                </div>
                <div className={classes.homeOverlay2 + " overlay"} />
                <div className={classes.homeTiltedPictures}>
                    <Fade in={true} timeout={600}>
                        <div
                            className={classes.homeExample}
                            ref={this._setStripRef}
                            onPointerDown={this._onStripPointerDown}
                            onPointerMove={this._onStripPointerMove}
                            onPointerUp={this._onStripPointerUp}
                            onPointerCancel={this._onStripPointerCancel}
                        >
                            {_artworks_url.map((url, i) => (
                                <div key={`img1-${i}`}>
                                    <Fade key={`img1a-${i}-${Boolean(i <= _y-1)}`} in={Boolean(i <= _y-1)} timeout={{appear: _intervalTimeRevealImage, enter: _intervalTimeRevealImage, exit: _intervalTimeRevealImage}}><img
                                        className="pixelated"
                                        src={url}
                                        draggable={false}
                                        onLoad={this._scheduleStripMeasure}
                                        alt={`Artwork ${i + 1}`}
                                    /></Fade>
                                </div>
                            ))}
                            {_artworks_url.map((url, i) => (
                                <div key={`img2-${i}`}>
                                    <img
                                        loading="lazy"
                                        decoding="async"
                                        className="pixelated"
                                        src={url}
                                        draggable={false}
                                        onLoad={this._scheduleStripMeasure}
                                        alt={t("components.home.artwork_duplicate", {
                                            i: i + 1
                                        })}
                                    />
                                </div>
                            ))}
                        </div>
                    </Fade>
                </div>
                <div className={classes.homeText}>
                    <Fade in={true} timeout={1000}>
                        <h3>{t("components.home.get_tokens_for_every_posts_votes_and")} <br/> {t("components.home.trade_and_create_artworks_in_minutes")}</h3>
                    </Fade>
                </div>
                <div className={classes.homeActions}>
                    <Fade in={true} timeout={1200}>
                        <div className={classes.homeActionGroup}>
                            <Button
                                variant="contained"
                                size="large"
                                onClick={this._openLearnMore}
                                className={classes.homeActionLearn}
                                aria-label={t("components.home.learn_more_about_pixagram")}
                            >
                                <InfoIcon />
                                <span className="homeActionLearnText">{t("components.home.learn_more")}</span>
                            </Button>
                            <Button
                                variant="contained"
                                size="large"
                                onClick={this._goToFeed}
                                className={classes.homeActionBrowse}
                            >
                                {t("components.home.browse_posts")} <ExploreIcon />
                            </Button>
                        </div>
                    </Fade>
                </div>
                {_learn_more_mounted &&
                    <React.Suspense fallback={null}>
                        <LearnMoreDialog
                            open={_learn_more_opened}
                            onClose={this._closeLearnMore}
                        />
                    </React.Suspense>}
            </div>
        );
    }
}

export default withLanguage(withStyles(styles)(Home));