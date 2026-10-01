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

// Easing shared by the reveal and the CTA. EASE_OUT decelerates hard into
// rest (quint-like); EASE_BACK overshoots a touch and settles.
const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
const EASE_BACK = "cubic-bezier(0.34, 1.56, 0.64, 1)";

// ── Artwork reveal: one wave, driven by CSS ──
// The strip used to reveal through a setState staircase: a timer chain
// bumping state._y with gaps growing ×1.5. Every img onLoad (2 × N of them)
// and every resize armed ANOTHER chain, and the re-keyed Fade around each
// revealed tile remounted its img — whose onLoad armed yet another. The
// result was a burst of tiles, then a near-stall (the shared gap compounded
// across all chains), and ~2N re-renders of the page on the way. Now each
// tile gets its delay once, at render, and the browser plays the whole wave
// on the compositor. The gaps still grow, in the spirit of the old ×1.5,
// but gently and with a ceiling.
const REVEAL_DURATION_MS = 700;
const REVEAL_STAGGER_MS = 90;      // gap between the first two tiles
const REVEAL_STAGGER_GROWTH = 1.1; // each next gap is 10% longer
const REVEAL_MAX_DELAY_MS = 1500;  // the wave never takes longer than this
// Tiles past this index sit far beyond the right edge when the wave plays
// (and only scroll in seconds later), so they're simply rendered visible.
const REVEAL_MAX_ITEMS = 18;

// Delay of tile k (k counts across both copies, left to right): the sum of
// the k first gaps, capped.
const revealDelay = (k) => Math.min(
    REVEAL_MAX_DELAY_MS,
    Math.round(REVEAL_STAGGER_MS * (Math.pow(REVEAL_STAGGER_GROWTH, k) - 1) / (REVEAL_STAGGER_GROWTH - 1))
);

// Decode every artwork BEFORE it enters the DOM and keep its intrinsic size.
// The tiles then mount fully laid out (width/height attributes → aspect
// ratio), so the strip has its final geometry on its first frame: no tiles
// growing from 0 px wide one by one as each image finished loading, no loop
// period re-measured 2N times, and no reveal fading in an empty box. An
// image that fails to decode keeps w/h = 0 and simply lays out on load.
const decodeArtworks = (urls) => Promise.all(urls.map((src) => new Promise((resolve) => {
    const img = new Image();
    const done = () => resolve({ src, w: img.naturalWidth | 0, h: img.naturalHeight | 0 });
    img.decoding = "async";
    if (typeof img.decode === "function") {
        img.src = src;
        img.decode().then(done, done);
    } else {
        img.onload = done;
        img.onerror = done;
        img.src = src;
    }
})));

const styles = theme => ({
    // ── Scoped JSS keyframes ──
    // Kept at the sheet top level, the documented form, where the "$name"
    // animationName references below resolve. (Placed directly inside a
    // rule they make jss-plugin-nested throw; under a rule's "@global" they
    // do resolve — that is how Index's rainbow is written, checked against
    // MUI's JSS preset.) The unreferenced hueRotate / slideUpFade /
    // slideRightFade globals were removed in an earlier pass.
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
    // (No `pulseHover` keyframes anymore — see homeActionLift.)
    // Artwork reveal: one keyframes, staggered per tile by animation-delay
    // (see revealDelay). Opacity + transform only, so the whole wave runs on
    // the compositor — no setState per tile, no Transition instances.
    "@keyframes artReveal": {
        "0%": {
            opacity: 0,
            transform: "translate3d(0, 14px, 0) scale(0.96)"
        },
        "100%": {
            opacity: 1,
            transform: "none"
        },
    },
    // Reduced-motion twin: the same wave, without the rise.
    "@keyframes artFade": {
        "0%": { opacity: 0 },
        "100%": { opacity: 1 },
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
    // ── CTA hover, as transitions ──
    // The hover used to SWAP animations on homeActionGroup (bounceGlow →
    // pulseHover). A CSS animation owns its properties outright, so neither
    // edge could ever be eased: entering restarted from pulseHover's 0% (a
    // snap if the idle bounce was mid-flight) and leaving snapped straight
    // from the lifted pose back to bounceGlow's 0%. Now the two motions live
    // on two elements: the idle bounce stays an animation on the group, and
    // this wrapper owns the hover lift as plain transitions — eased both
    // ways, reversible mid-flight. The stronger hover glow is a pre-painted
    // shadow on ::before whose OPACITY fades (compositor-only), instead of a
    // box-shadow interpolated (and repainted) every frame.
    homeActionLift: {
        position: "relative",
        display: "inline-block",
        verticalAlign: "top",
        borderRadius: "32px",
        // Own stacking context, so the ::before glow (z-index -1) sits right
        // behind the pill rather than behind the whole page.
        zIndex: 0,
        transform: "translate3d(0, 0, 0) scale(1)",
        // Leaving: a calm settle back, no overshoot.
        transition: `transform 520ms ${EASE_OUT}`,
        willChange: "transform",
        "&::before": {
            content: "''",
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: -1,
            borderRadius: "inherit",
            pointerEvents: "none",
            boxShadow: "0 0 30px #ffffff99, 0 0 60px #ffffffcc, 0 10px 40px rgba(0,0,0,0.4)",
            opacity: 0,
            transition: `opacity 520ms ${EASE_OUT}`,
        },
        // Real hover only: on touch screens :hover sticks after a tap, which
        // left the pill lifted under the Learn-More dialog until the next tap
        // elsewhere. Touch feedback is the ripple.
        "@media (hover: hover)": {
            "&:hover": {
                // Entering: a small overshoot (the old pulseHover's 1.09 peak
                // settling to 1.06), as an easing curve instead of keyframes.
                transform: "translate3d(0, -3px, 0) scale(1.06)",
                transition: `transform 460ms ${EASE_BACK}`,
            },
            "&:hover::before": {
                opacity: 1,
                transition: `opacity 320ms ${EASE_OUT}`,
            },
            // The idle bounce holds still under the cursor — paused where it
            // is (it rests 88% of its cycle), resumed from the same frame on
            // leave. No restart, no snap.
            "&:hover $homeActionGroup": {
                animationPlayState: "paused",
            },
        },
    },
    homeActionGroup: {
        display: "inline-flex",
        alignItems: "stretch",
        borderRadius: "32px",
        overflow: "hidden",
        transform: "scale(1)",
        // No `transition: all` anymore: every property it could have eased is
        // owned by the bounce animation, and the hover moved to the wrapper.
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
        // `backwards`, not `both`: the resting pose is declared below as the
        // element's own transform (identical to the 100% keyframe), so when
        // the reveal ends the ring settles into plain styles. A filled
        // animation kept `filter: opacity(1)` + the transform pinned on this
        // 200% × 200% layer for the page's whole life.
        animationFillMode: "backwards",
        animationDelay: "0ms",
        transform: "translate(-25%, -50%)",
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
        // Reserve the strip's height (tile 300 / 240 px + 2 × 16 px margin)
        // from the first paint. The artworks arrive on idle, a beat after the
        // text below has already faded in — without this the empty strip was
        // 0 px tall and that text jumped down ~330 px when they landed.
        minHeight: "332px",
        [theme.breakpoints.down("md")]: {
            minHeight: "272px",
        },
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
            // The imgs carry width/height attributes (their decoded size, see
            // decodeArtworks) so every tile has its final width at its very
            // first layout. `auto` stops the width attribute from applying
            // as a literal px width; the attribute pair then only supplies
            // the aspect ratio, and the width follows the 100% height.
            width: "auto",
            // Kill the native image ghost-drag so the grab gesture wins
            // (draggable={false} on the imgs covers the rest).
            "-webkit-user-drag": "none",
        },
    },
    // Applied to the img (not its tile): the tile's transform belongs to the
    // hover pop, and `backwards` fill hands the img back to its plain styles
    // the moment its reveal ends, so nothing stays pinned by the animation.
    homeArtReveal: {
        animationName: "$artReveal",
        animationDuration: `${REVEAL_DURATION_MS}ms`,
        animationTimingFunction: EASE_OUT,
        animationFillMode: "backwards",
        "@media (prefers-reduced-motion: reduce)": {
            animationName: "$artFade",
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

// Shader work per quality tier. Fewer fbm octaves = far cheaper fragments —
// and crucially this does NOT affect sharpness (that comes from resolution),
// so the bolt stays crisp on every tier. Pushed as a uniform each frame, so
// the tier can change after the perf test with NO shader recompile.
//
// The star-layer count is NOT part of the tier anymore. Each layer's depth
// phase and hash seed derive from 1 / layerCount, so going 4 → 5 layers
// re-dealt EVERY star at once: the whole starfield visibly jumped ~2 s after
// the page appeared, on exactly the machines that passed the perf test. The
// count is fixed now; the tier only moves the bolt's octaves, and that move
// is eased in fractionally (see uOctaves) instead of switched.
const QUALITY = {
    low:    { octaves: 4 },
    normal: { octaves: 6 },
};
const STAR_LAYERS = 5;
// How fast the octave count follows a tier change (per-second rate of the
// exponential ease; ~0.6 s to settle).
const OCTAVE_EASE_PER_S = 6;

// ── Background frame pacing ──
// The background renders at ~30 fps on purpose (ambient, battery). The old
// gate (`now - last >= 33.3 ms`) sat exactly ON the vsync grid of a 60 Hz
// screen, so timestamp jitter alternated 2- and 3-refresh gaps (33 / 50 ms)
// — a visible judder — and on 144 Hz it alternated 4 and 5. The loop now
// estimates the refresh interval and draws on every Nth refresh, N fixed for
// the display: evenly spaced frames at the rate nearest the target.
const BG_TARGET_FPS = 30;
// Starfield fade-in from black after the GL init, done in the shader (uFade)
// so the canvas stays opaque — fading the canvas element itself would show
// whatever lies behind it instead of black.
const BG_INTRO_MS = 900;

// Returns tick(now) → "draw this frame?", to be called on EVERY rAF tick.
// The refresh estimate only learns from gaps near itself, so dropped frames
// (gaps of 2–3 refreshes while the main thread is busy) can't drag it; a
// display that really changed rate is re-learned after a run of misses. The
// gate then sits half a refresh BELOW the Nth refresh — never on the grid
// itself, where timestamp jitter decides — so each drawn frame is exactly N
// refreshes after the previous one: 60 Hz → every 2nd, 90 → 3rd, 120 → 4th,
// 144 → 5th (28.8 fps), 240 → 8th.
const createFramePacer = (targetFps) => {
    const target = 1000 / targetFps;
    let vsync = 0;     // refresh-interval estimate, ms (0 = not known yet)
    let stride = 0;    // draw every `stride` refreshes
    let prevTick = -1;
    let lastDraw = -Infinity;
    let misses = 0;
    return (now) => {
        if (prevTick >= 0) {
            const d = now - prevTick;
            if (d > 2 && d < 100) { // ignore tab-switch gaps outright
                if (!vsync) {
                    vsync = d;
                } else if (d > vsync * 0.5 && d < vsync * 1.5) {
                    vsync += (d - vsync) * 0.1;
                    misses = 0;
                } else if (++misses > 30) {
                    vsync = d;
                    misses = 0;
                }
            }
        }
        prevTick = now;
        if (!vsync) { // very first tick: nothing to pace against yet
            lastDraw = now;
            return true;
        }
        // Hysteresis: re-pick N only when the estimate clearly calls for
        // another one, so a rate sitting between two Ns can't flip-flop.
        const ideal = target / vsync;
        if (!stride || Math.abs(ideal - stride) > 0.6) stride = Math.max(1, Math.round(ideal));
        if (now - lastDraw >= (stride - 0.5) * vsync) {
            lastDraw = now;
            return true;
        }
        return false;
    };
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
// Below this speed, a strip that is settling toward a standstill (Learn-More
// dialog open, reduced motion) is considered stopped — the loop then stops
// writing a transform whose change would be sub-pixel.
const STRIP_REST_SPEED = 1;        // px/s

// ── Leaving the page ──
// The exit is a dissolve that Index plays on this page while the app mounts
// underneath (it keeps this page mounted and passes `departing`). The strip's
// drift is handed to a linear CSS transition for that moment, so it keeps
// gliding on the compositor while the main thread is busy mounting the app.
// The glide only has to outlast Index's dissolve.
const STRIP_EXIT_GLIDE_MS = 1200;
// The hand-off is usually within a frame of the click (the page chunk is
// warm). If it isn't — a cold chunk download — the starfield dims after this
// grace period, so the click still visibly "took".
const EXIT_FEEDBACK_DELAY_MS = 160;

// ── Auto-enter (the app started on the landing page, logged in) ──
// Index flips the `autoEnterFeed` prop once it knows the visitor whose page
// load STARTED here is logged in (see useLandingAutoEnter there; a return
// to this page inside the already-running app never flips it). The page
// then plays the very same exit as the Browse button — the route push here,
// the dissolve and the rainbow in Index on the home→app flip — into the
// personal feed.
// If the session is known almost instantly (cached, local), the exit would
// start while the entrance is still revealing (600 ms spiral, the
// Fade-ins): this floor lets the landing finish arriving first, so the
// sequence reads as home → rainbow → feed and never as a flash.
const AUTO_ENTER_MIN_DWELL_MS = 900;
const AUTO_ENTER_PATH = "/feed/";

const HIDDEN_STYLE = Object.freeze({ visibility: "hidden" });

class Home extends React.PureComponent {
    constructor(props) {
        super(props);
        // Only what render() actually reads lives in state. classes comes
        // straight from props (withStyles), HISTORY is a module constant, and
        // the old `_settings` mirror + its componentDidUpdate sync made every
        // settings change re-render this page TWICE for a value nothing here
        // consumed.
        this.state = {
            // (The reveal staircase's _y / _firstTimeRevealImage /
            // _intervalTimeRevealImage* state is gone — the reveal is a CSS
            // wave now, see revealDelay.)
            _learn_more_opened: false,
            // Stays true after the first open, so the lazily-loaded dialog
            // keeps its exit transition instead of unmounting abruptly.
            _learn_more_mounted: false,
            // The artwork strip ships in its own chunk (../data/homeArts) and
            // is loaded on idle right after mount — see componentDidMount.
            // Keeping it out of this (eagerly imported) module keeps ~195 KB
            // of base64 out of the critical-path entry bundle. Each entry is
            // { src, w, h }: the decoded size travels with the url.
            _artworks: [],
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
        // ── Leaving the page ──
        // Set the moment an exit (Browse click or auto-enter) has pushed the
        // route: the auto-enter never fires on top of a click the visitor
        // already made. A click is never blocked by it.
        this._leaving = false;
        this._mountedAt = 0;      // performance.now() at mount (dwell floor)
        this._autoEnterTimer = 0; // pending dwell-delayed auto-enter
        this._exitFeedbackTimer = 0; // pending slow-hand-off canvas dim
        // Set once Index starts dissolving this page (the `departing` prop):
        // from then on nothing here draws, measures or reacts any more.
        this._departed = false;
    }

    componentDidMount() {
        this._mounted = true;
        this._mountedAt = performance.now();
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
                .then((m) => decodeArtworks((m && m.default) || []))
                .then((artworks) => {
                    if (!this._mounted || this._departed) return;
                    // ONE commit with every tile already decoded and sized;
                    // the callback measures the loop period once, right
                    // after it. The reveal wave starts with the commit.
                    this.setState({ _artworks: artworks }, this._scheduleStripMeasure);
                })
                .catch(() => { /* non-critical: marquee just stays empty */ });
        });
    }

    // Two props change over the page's life (settings is baked once and
    // nothing here reads it), and both are acted on strictly as false→true
    // TRANSITIONS:
    //   • autoEnterFeed — a page that mounts with the flag already true is a
    //     return visit (the visitor left home before Index's flip landed),
    //     and a return to the landing page must never redirect;
    //   • departing — Index has swapped the app in underneath and is
    //     dissolving this page over it (see _depart).
    componentDidUpdate(prevProps) {
        if (this.props.autoEnterFeed && !prevProps.autoEnterFeed) {
            this._scheduleAutoEnter();
        }
        if (this.props.departing && !prevProps.departing) {
            this._depart();
        }
    }

    componentWillUnmount() {
        // Synchronous flag stops the animation loop immediately
        this._mounted = false;

        // A dwell-delayed auto-enter must not fire into an unmounted page
        if (this._autoEnterTimer) {
            clearTimeout(this._autoEnterTimer);
            this._autoEnterTimer = 0;
        }
        if (this._exitFeedbackTimer) {
            clearTimeout(this._exitFeedbackTimer);
            this._exitFeedbackTimer = 0;
        }

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
            // Departing: the canvas holds its last frame for the dissolve,
            // and re-assigning its size would clear that frame to black.
            if (!this._mounted || this._departed) return;
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
        if (this._departed) return;
        const el = this._stripEl;
        const count = this.state._artworks.length;
        if (!el || !count || el.children.length < count * 2) {
            this._stripHalf = 0;
            this._stripAutoSpeed = 0;
            return;
        }
        const prev = this._stripHalf;
        const next = Math.max(0, el.children[count].offsetLeft - el.children[0].offsetLeft);
        // The period changes when the tiles resize (the 300 ↔ 240 px
        // breakpoint, a rotated phone). Every tile scales with it, so scale
        // the position too: the same artwork stays under the viewport
        // instead of the strip jumping to wherever the old px offset now
        // lands. Drag anchors and velocity scale along, so a gesture in
        // flight keeps its feel.
        if (prev > 0 && next > 0 && next !== prev) {
            const k = next / prev;
            this._stripOffset *= k;
            this._stripDragStartOffset *= k;
            this._stripDragTarget *= k;
            this._stripVelocity *= k;
        }
        this._stripHalf = next;
        this._stripAutoSpeed = next / STRIP_LOOP_SECONDS;
    }

    // Debounced through rAF: the artworks commit, the strip ref, resizes and
    // any tile that had to lay out on load all land here, and one layout read
    // per frame is plenty. It ONLY measures now — it used to also arm a new
    // reveal chain on every call (see revealDelay for that story).
    _scheduleStripMeasure = () => {
        if (this._stripMeasureRaf) return;
        this._stripMeasureRaf = requestAnimationFrame(() => {
            this._stripMeasureRaf = 0;
            if (this._mounted) this._measureStrip();
        });
    }

    _stripLoop = (ts) => {
        // Departed: the compositor glide owns the transform now (_depart).
        if (!this._mounted || this._departed) return;
        this._stripRafId = requestAnimationFrame(this._stripLoop);

        const last = this._stripLastTs || ts;
        this._stripLastTs = ts;
        // Clamp the step: the first frame back from a hidden tab reports a
        // multi-second dt (rAF pauses there) — uncapped, the strip teleports.
        const dt = Math.min(Math.max((ts - last) / 1000, 0), 0.05);
        const el = this._stripEl;
        const half = this._stripHalf;
        if (!el || half <= 0 || dt === 0) return;

        if (this._stripDragging) {
            // Elastic follow: chase the finger with a light rubber-band lag.
            const k = 1 - Math.pow(1 - STRIP_FOLLOW, dt * 60);
            this._stripOffset += (this._stripDragTarget - this._stripOffset) * k;
        } else {
            // Decay the EXCESS over the ambient drift, not the velocity
            // itself: flings and wheel kicks relax back into the auto-
            // rotation (even from the "wrong" direction — the sign crossing
            // is smooth) instead of the strip ever stopping dead.
            //
            // The Learn-More dialog covers the page. It used to freeze the
            // marquee on the spot and restart it at full speed on close; now
            // the drift's target just drops to 0 while it's open, so the
            // strip glides to a halt behind the opening backdrop and glides
            // back up on close — the same relaxation as after a fling.
            const still = this._stripReducedMotion || this.state._learn_more_opened;
            const auto = still ? 0 : this._stripAutoSpeed;
            const excess = (this._stripVelocity - auto) * Math.pow(STRIP_FRICTION, dt * 60);
            this._stripVelocity = auto + excess;
            // An exponential decay never reaches 0 on its own: snap to a real
            // standstill once it's imperceptible, so the write-on-change
            // below goes quiet instead of nudging the transform by sub-pixel
            // amounts for minutes.
            if (auto === 0 && Math.abs(this._stripVelocity) < STRIP_REST_SPEED) {
                this._stripVelocity = 0;
            }
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

    // ── Leaving the landing page ──
    // ONE exit for both ways out (Browse click, auto-enter): the route is
    // pushed at once, and on the home→app flip Index keeps this page mounted
    // above the freshly mounted app and dissolves it (LandingLayer), while
    // RootAnimationOverlay plays the rainbow — so the auto-enter is pixel-
    // identical to the click, by construction rather than by copy.
    //
    // The canvas no longer fades here on its own. Its 200 ms fade raced the
    // swap: Home was unmounted a frame or two after the click, so the page
    // simply cut to the app. The whole page now dissolves as one; the canvas
    // only dims early when the hand-off is slow (cold page chunk), as
    // feedback that the click took.
    _enterApp = (path) => {
        this._leaving = true;
        if (this._canvas && !this._exitFeedbackTimer) {
            this._exitFeedbackTimer = setTimeout(() => {
                this._exitFeedbackTimer = 0;
                if (!this._mounted || this._departed || !this._canvas) return;
                this._canvas.style.transition = "opacity 240ms ease-out";
                this._canvas.style.opacity = "0";
            }, EXIT_FEEDBACK_DELAY_MS);
        }
        HISTORY.push(path);
    }

    // ── Departure: Index is dissolving this page over the app ──
    // Everything that would cost main-thread time while the app mounts
    // underneath stops here; everything still visible keeps moving on the
    // compositor. Terminal by design: a return to the landing page mounts a
    // fresh instance (Index keys the layer per visit), so nothing resumes.
    _depart = () => {
        if (this._departed) return;
        this._departed = true;
        this._leaving = true; // vetoes a pending auto-enter for good
        if (this._autoEnterTimer) {
            clearTimeout(this._autoEnterTimer);
            this._autoEnterTimer = 0;
        }
        if (this._exitFeedbackTimer) {
            clearTimeout(this._exitFeedbackTimer);
            this._exitFeedbackTimer = 0;
        }

        // Starfield: stop drawing. The canvas keeps presenting its last frame
        // through the dissolve (the GL context is only released at unmount),
        // so the background fades out with the page instead of going black.
        if (this._animationId) {
            cancelAnimationFrame(this._animationId);
            this._animationId = null;
        }
        if (this._initRafId) {
            cancelAnimationFrame(this._initRafId);
            this._initRafId = 0;
        }
        window.removeEventListener('mousemove', this._handleMouseMove);
        window.removeEventListener('wheel', this._onStripWheel);

        // Strip: the per-frame JS loop stops, and its current drift is handed
        // to a linear transition — same speed, same direction, but run by
        // the compositor, so it can't stutter while the app's first render
        // holds the main thread.
        if (this._stripRafId) {
            cancelAnimationFrame(this._stripRafId);
            this._stripRafId = 0;
        }
        const el = this._stripEl;
        if (el) {
            const v = this._stripDragging ? 0 : this._stripVelocity;
            this._stripDragging = false;
            el.classList.remove("dragging");
            if (v && this._stripHalf > 0) {
                // Kept inside the two copies, so even a fling caught mid-
                // flight can't glide past the strip's end into blank space.
                const ahead = Math.max(0, 2 * this._stripHalf - window.innerWidth - this._stripOffset);
                const travel = Math.max(-this._stripOffset, Math.min(ahead, v * (STRIP_EXIT_GLIDE_MS / 1000)));
                el.style.transition = `transform ${STRIP_EXIT_GLIDE_MS}ms linear`;
                el.style.transform = `translate3d(${-(this._stripOffset + travel)}px, 0, 0)`;
            }
        }

        // A dialog left open (the browser's Back while reading) closes with
        // its own exit transition instead of vanishing with the page.
        if (this.state._learn_more_opened) {
            this.setState({ _learn_more_opened: false });
        }
    }

    _goToFeed = () => {
        this._enterApp("/created/");
    }

    // Auto-enter, first step: honour the dwell floor. Landing straight into
    // the exit while the entrance is still revealing would read as a flash
    // (see AUTO_ENTER_MIN_DWELL_MS); past the floor it fires right away.
    _scheduleAutoEnter = () => {
        if (this._autoEnterTimer) return;
        const remaining = AUTO_ENTER_MIN_DWELL_MS - (performance.now() - this._mountedAt);
        if (remaining <= 0) {
            this._autoEnter();
            return;
        }
        this._autoEnterTimer = setTimeout(() => {
            this._autoEnterTimer = 0;
            this._autoEnter();
        }, remaining);
    }

    // Auto-enter, second step. Vetoed — for good, Index's gate is one-shot —
    // when the visitor has already taken the page over: they clicked Browse
    // themselves (`_leaving`, the click always wins), or they opened Learn
    // More at any point (`_learn_more_mounted` stays true after the first
    // open): someone who came to read must not be whisked away from under
    // a dialog. Otherwise: exactly what the Browse button does, aimed at the
    // personal feed.
    _autoEnter = () => {
        if (!this._mounted || this._leaving) return;
        if (this.state._learn_more_mounted) return;
        this._enterApp(AUTO_ENTER_PATH);
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
        // Departing: resizing the backing store would wipe the frozen frame.
        if (!gl || !canvas || this._departed) return;

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
        if (!gl || !canvas || !this._mounted || this._departed) return;

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
            uniform float uOctaves;      // fbm octaves (quality tier) — FRACTIONAL while a tier change eases in
            uniform int   uNumLayers;    // star depth layers (fixed: STAR_LAYERS)
            uniform float uFade;         // 0 → 1 intro fade from black
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
                // 8 is the unrolled ceiling; the break stops early on cheaper
                // tiers. uOctaves is fractional while a tier change eases in:
                // the last octave enters at a partial weight, so the bolt's
                // detail grows (or recedes) smoothly instead of jumping.
                for (int i = 0; i < 8; i++) {
                    float w = clamp(uOctaves - float(i), 0.0, 1.0);
                    if (w <= 0.0) break;
                    value += amplitude * noise(p) * w;
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

                // Intro: scaled from black, the canvas itself stays opaque.
                fragColor = vec4(col * uFade, 1.0);
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
        const fadeLoc       = gl.getUniformLocation(program, 'uFade');

        // Fixed for the page's life (see STAR_LAYERS) — set once.
        gl.uniform1i(layersLoc, STAR_LAYERS);
        gl.uniform1f(layerStepLoc, 1.0 / STAR_LAYERS);

        const pace = createFramePacer(BG_TARGET_FPS);
        // Shader clock (ms). It advances by the time between DRAWN frames,
        // each step capped, so whenever drawing pauses — the Learn-More dialog,
        // a hidden tab — the stars and the bolt resume exactly where they
        // stopped instead of jumping ahead by the length of the pause. It
        // starts at the page clock, so the opening frame is the same as ever.
        let clock = -1;
        let lastDrawTs = -1;
        let introStart = -1;
        // Starts on the cheap tier; eased toward the tier the probe settles on.
        let octaves = QUALITY.low.octaves;

        const render = (now) => {
            if (!this._mounted || this._departed) return;

            // The Learn-More dialog covers the page (near-fullscreen desktop,
            // fullscreen mobile) — don't burn GPU on a background nobody can
            // see. rAF stays armed so the resume is instant, and the perf
            // probe restarts from scratch on close: a stretch of these no-op
            // frames must not be measured as "fast shader frames".
            if (this.state._learn_more_opened) {
                this._perfTestStart = 0;
                lastDrawTs = -1; // the clock resumes from here, no catch-up
                this._animationId = requestAnimationFrame(render);
                return;
            }

            this._checkPerformance(now);
            // _checkPerformance may have just retired the shader (_stopBg
            // nulls _gl). The closure's `gl` would keep "drawing" silently on
            // the lost context and re-arm rAF forever without this guard.
            if (!this._gl) return;

            if (pace(now)) {
                const dt = lastDrawTs < 0 ? 0 : Math.min(now - lastDrawTs, 100);
                lastDrawTs = now;
                clock = clock < 0 ? now : clock + dt;
                if (introStart < 0) introStart = now;

                // Smooth the cursor (lerp) — no setState. Time-based: the
                // same 0.1-per-30-fps-frame glide whatever cadence the pacer
                // picked for this display.
                const follow = 1 - Math.pow(0.9, dt / (1000 / 30));
                this._smoothMouseX += (this._targetMouseX - this._smoothMouseX) * follow;
                this._smoothMouseY += (this._targetMouseY - this._smoothMouseY) * follow;

                // Normalise so (0,0) = screen centre, range ~[-1,1], +y up.
                // Done from window size (not framebuffer px), so it's DPR-independent
                // and no longer drifts toward a corner.
                const w = window.innerWidth || 1;
                const h = window.innerHeight || 1;
                const mx = (this._smoothMouseX / w) * 2.0 - 1.0;
                const my = (this._smoothMouseY / h) * 2.0 - 1.0;

                // Use the richer tier only once the perf test confirms headroom,
                // eased in over ~0.6 s rather than switched in one frame.
                // Octave count does NOT affect crispness (resolution does), so
                // the bolt stays sharp during the warmup regardless.
                const target = (this.state._performanceLocked && !this.state._lowPerformance)
                    ? QUALITY.normal.octaves
                    : QUALITY.low.octaves;
                if (octaves !== target) {
                    octaves += (target - octaves) * (1 - Math.exp(-OCTAVE_EASE_PER_S * dt / 1000));
                    if (Math.abs(target - octaves) < 0.01) octaves = target;
                }

                // Intro: smoothstep from black over BG_INTRO_MS.
                const p = Math.min(1, (now - introStart) / BG_INTRO_MS);
                const fade = p * p * (3 - 2 * p);

                gl.clear(gl.COLOR_BUFFER_BIT);
                gl.uniform2f(resolutionLoc, canvas.width, canvas.height);
                gl.uniform1f(timeLoc, clock * 0.001);
                gl.uniform2f(mouseLoc, mx, -my);
                gl.uniform2f(energyResLoc, this._energyW || canvas.width, this._energyH || canvas.height);
                gl.uniform1f(octavesLoc, octaves);
                gl.uniform1f(fadeLoc, fade);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
            }

            this._animationId = requestAnimationFrame(render);
        };

        // Stored like every later frame, so a departure or unmount landing
        // before the first frame can still cancel it.
        this._animationId = requestAnimationFrame(render);
    }

    // One tile of the strip. `copy` is the loop's second half. k numbers the
    // tiles left to right across BOTH copies, so with few artworks (both
    // halves on screen) the wave simply runs on into the second copy.
    _renderArtwork = (art, i, copy) => {
        const k = copy ? this.state._artworks.length + i : i;
        const reveal = k < REVEAL_MAX_ITEMS;
        return (
            <div key={(copy ? "img2-" : "img1-") + i}>
                <img
                    className={reveal ? "pixelated " + this.props.classes.homeArtReveal : "pixelated"}
                    style={reveal ? { animationDelay: revealDelay(k) + "ms" } : undefined}
                    src={art.src}
                    width={art.w || undefined}
                    height={art.h || undefined}
                    decoding="async"
                    draggable={false}
                    // Sized tiles never re-lay out on load; only one whose
                    // size couldn't be read up front re-measures the loop.
                    onLoad={art.w ? undefined : this._scheduleStripMeasure}
                    alt={copy
                        ? t("components.home.artwork_duplicate", { i: i + 1 })
                        : `Artwork ${i + 1}`}
                />
            </div>
        );
    }

    render() {
        const { classes, departing } = this.props;
        const { _artworks, _learn_more_opened, _learn_more_mounted, _svg_logo } = this.state;
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
                {/* Hidden the moment the page departs: Index's rainbow starts
                    from this exact ring and flies off, and a second copy left
                    fading in place here would read as the ring splitting. */}
                <div
                    className={classes.homeOverlay2 + " overlay"}
                    style={departing ? HIDDEN_STYLE : undefined}
                />
                <div className={classes.homeTiltedPictures}>
                    {/* No Fade around the strip anymore: it faded in an EMPTY
                        box (the artworks arrive on idle, later). The tiles
                        reveal themselves, see _renderArtwork. */}
                    <div
                        className={classes.homeExample}
                        ref={this._setStripRef}
                        onPointerDown={this._onStripPointerDown}
                        onPointerMove={this._onStripPointerMove}
                        onPointerUp={this._onStripPointerUp}
                        onPointerCancel={this._onStripPointerCancel}
                    >
                        {_artworks.map((art, i) => this._renderArtwork(art, i, false))}
                        {_artworks.map((art, i) => this._renderArtwork(art, i, true))}
                    </div>
                </div>
                <div className={classes.homeText}>
                    <Fade in={true} timeout={1000}>
                        <h3>{t("components.home.get_tokens_for_every_posts_votes_and")} <br/> {t("components.home.trade_and_create_artworks_in_minutes")}</h3>
                    </Fade>
                </div>
                {/* Fade now wraps the positioned container rather than the
                    pill: Fade writes an inline `transition` (opacity) on its
                    child, which would wipe out homeActionLift's own hover
                    transitions. */}
                <Fade in={true} timeout={1200}>
                    <div className={classes.homeActions}>
                        <div className={classes.homeActionLift}>
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
                        </div>
                    </div>
                </Fade>
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