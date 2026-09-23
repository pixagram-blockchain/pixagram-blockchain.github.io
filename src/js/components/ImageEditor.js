// ============================================================================
// ImageEditor.js — Crop (rotate, flip) a picked picture before it is converted
//
// Opened by NewPost through the edit button that sits on the picture in the
// upload zone. Non-destructive: it always receives the ORIGINAL upload plus
// the edit last applied to it (`initialEdit`), so reopening it shows the
// previous crop frame in place and "Reset" goes back to the untouched
// picture.
//
// Interaction model (the one Google Photos uses on the web): the picture is
// fitted into a dark stage and a crop frame lies over it, the rest of the
// picture dimmed. Drag inside the frame to move it, drag a corner or an edge
// to resize it — the aspect stays locked when a preset chip is selected —
// and use the toolbar to rotate by 90°, mirror, or reset. Everything works
// with a mouse, a pen or a finger (pointer events, touch-action: none, big
// hit areas) and the dialog goes full-screen on phones. The UI is greyscale
// and borderless (rounded corners only), like the rest of NewPost.
//
// Output: "Done" renders the crop at source resolution — capped at
// `maxOutputSize` on the longest side — into a fresh File: JPEG when the
// source is a JPEG, PNG otherwise (lossless, keeps transparency and keeps
// pixel art exact), then hands it back through onComplete(file, edit). When
// the edit is the identity (nothing cropped, rotated or flipped) the
// original File is handed back with edit = null.
//
// Props:
//   open           bool
//   file           File — the ORIGINAL picture (already normalised)
//   initialEdit    { crop, rotation, flip, aspect } | null — edit to reopen with
//   maxOutputSize  number — longest side of the exported picture (default 4096)
//   onClose        () => void — cancel, nothing changes
//   onComplete     (file: File, edit: object|null) => void
//
// Geometry: `crop` is expressed in "edit space" — the source picture AFTER
// rotation and flip — in source pixels, so exporting is a plain copy of that
// rectangle. `rotation` (0/90/180/270, clockwise) and `flip` (mirror on the
// vertical axis) are parametrised as "rotate, then flip".
// ============================================================================

import * as React from "preact/compat";
import { useState, useCallback, useMemo, useEffect, useRef } from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import Chip from "@material-ui/core/Chip";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";
import CircularProgress from "@material-ui/core/CircularProgress";
import RotateRightIcon from "@material-ui/icons/RotateRight";
import FlipIcon from "@material-ui/icons/Flip";
import RestoreIcon from "@material-ui/icons/Restore";

import { t, useLanguage } from "../utils/text";

// ============================================================================
// COPY
// ============================================================================
// Plain English, gathered here so the strings can be moved to locale keys in
// one place (only the shared "words.cancel" key is resolved through t()).

const COPY = {
    crop: "Crop",
    done: "Done",
    loading: "Loading picture…",
    hint: "Drag the frame or its corners",
    couldNotRead: "Could not read this picture. Please try another one.",
    exportFailed: "Could not save the crop. Please try again.",
    aspectRatio: "Aspect ratio",
    rotate: "Rotate 90°",
    flip: "Flip horizontally",
    reset: "Reset",
    cropFrame: "Crop frame — drag to move, drag a corner or an edge to resize, arrow keys to nudge",
    free: "Free",
    original: "Original",
    square: "Square"
};

// ============================================================================
// CONSTANTS
// ============================================================================

// Aspect presets. `value` is the frame ratio (width / height): null = free,
// "original" = the picture's own ratio (follows rotation), a number = fixed.
const ASPECTS = [
    { id: "free",     label: COPY.free,     value: null },
    { id: "original", label: COPY.original, value: "original" },
    { id: "square",   label: COPY.square,   value: 1 },
    { id: "4:3",      label: "4:3",         value: 4 / 3 },
    { id: "3:4",      label: "3:4",         value: 3 / 4 },
    { id: "16:9",     label: "16:9",        value: 16 / 9 },
    { id: "9:16",     label: "9:16",        value: 9 / 16 }
];

// Smallest crop frame, in source pixels (unless the picture is smaller).
const MIN_CROP_PX = 16;

// Room around the fitted picture, so the corner handles (which straddle the
// frame) and the dimmed margin stay visible.
const STAGE_PAD = 28;
const STAGE_PAD_MOBILE = 20;

// Invisible hit areas, centred on the frame's corners / edges — finger-sized.
const CORNER_HIT = 40;
const EDGE_HIT = 28;

// Pictures whose longest side is at most this many pixels are shown with
// nearest-neighbour scaling (pixel art stays crisp); larger ones — photos —
// get smooth scaling. Same threshold as NewPost's zone preview.
const PIXEL_ART_MAX_SIDE = 256;

const ROTATIONS = [0, 90, 180, 270];

// Corner brackets (an L drawn from a 22×22 viewBox, rotated per corner) and
// the short bars at the middle of each edge — Google Photos' frame language.
const BRACKET_PATH = "M3 20 V3 H20";

const EDGE_HANDLES = [
    { id: "n", cursor: "ns-resize", style: { top: -EDGE_HIT / 2, left: CORNER_HIT / 2, right: CORNER_HIT / 2, height: EDGE_HIT } },
    { id: "s", cursor: "ns-resize", style: { bottom: -EDGE_HIT / 2, left: CORNER_HIT / 2, right: CORNER_HIT / 2, height: EDGE_HIT } },
    { id: "w", cursor: "ew-resize", style: { left: -EDGE_HIT / 2, top: CORNER_HIT / 2, bottom: CORNER_HIT / 2, width: EDGE_HIT } },
    { id: "e", cursor: "ew-resize", style: { right: -EDGE_HIT / 2, top: CORNER_HIT / 2, bottom: CORNER_HIT / 2, width: EDGE_HIT } }
];

const CORNER_HANDLES = [
    { id: "nw", cursor: "nwse-resize", rotate: 0,   style: { top: -CORNER_HIT / 2, left: -CORNER_HIT / 2 },    bracket: { top: -3, left: -3 } },
    { id: "ne", cursor: "nesw-resize", rotate: 90,  style: { top: -CORNER_HIT / 2, right: -CORNER_HIT / 2 },   bracket: { top: -3, right: -3 } },
    { id: "se", cursor: "nwse-resize", rotate: 180, style: { bottom: -CORNER_HIT / 2, right: -CORNER_HIT / 2 }, bracket: { bottom: -3, right: -3 } },
    { id: "sw", cursor: "nesw-resize", rotate: 270, style: { bottom: -CORNER_HIT / 2, left: -CORNER_HIT / 2 },  bracket: { bottom: -3, left: -3 } }
];

const EDGE_MARKS = [
    { id: "n", style: { top: -1.5, left: "50%", marginLeft: -9, width: 18, height: 3 } },
    { id: "s", style: { bottom: -1.5, left: "50%", marginLeft: -9, width: 18, height: 3 } },
    { id: "w", style: { left: -1.5, top: "50%", marginTop: -9, width: 3, height: 18 } },
    { id: "e", style: { right: -1.5, top: "50%", marginTop: -9, width: 3, height: 18 } }
];

// ============================================================================
// STYLES — greyscale, no borders (rounded corners only), NewPost's language
// ============================================================================

const styles = theme => ({
    dialog: {
        "& div.MuiPaper-rounded.MuiDialog-paper": {
            width: "min(calc(100% - 64px), 800px)",
            maxWidth: "none"
        }
    },
    content: {
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        "&.MuiDialogContent-root": {
            padding: "24px 24px 0px 24px",
            overflowY: "hidden"
        }
    },
    contentMobile: {
        "&.MuiDialogContent-root": {
            flex: "1 1 auto",
            padding: "16px 16px 0px 16px",
            overflowY: "auto"
        }
    },
    // The dark surface the picture is fitted into.
    stage: {
        position: "relative",
        width: "100%",
        height: "min(58vh, 620px)",
        minHeight: 280,
        borderRadius: "21px",
        backgroundColor: "#0b0b0b",
        overflow: "hidden",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTapHighlightColor: "transparent"
    },
    stageMobile: {
        height: "auto",
        flex: "1 1 auto",
        minHeight: 240
    },
    stageCanvas: {
        position: "absolute",
        display: "block",
        pointerEvents: "none",
        WebkitUserDrag: "none"
    },
    stageMessage: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center",
        color: "#888"
    },
    // Dims the picture outside the frame; clipped to the picture.
    maskLayer: {
        position: "absolute",
        overflow: "hidden",
        pointerEvents: "none"
    },
    dimBox: {
        position: "absolute",
        boxShadow: "0 0 0 100vmax rgba(0, 0, 0, 0.58), inset 0 0 0 1px rgba(255, 255, 255, 0.85)"
    },
    // The frame itself, with its handles — not clipped, so the hit areas
    // that straddle the picture's edges stay reachable.
    cropLayer: {
        position: "absolute",
        pointerEvents: "none"
    },
    cropBox: {
        position: "absolute",
        pointerEvents: "auto",
        cursor: "move",
        outline: "none",
        "&:focus-visible $bracket": {
            filter: "drop-shadow(0 0 4px rgba(255, 255, 255, 0.95))"
        }
    },
    cropBoxDragging: {
        "& $gridLine": {
            opacity: 0.75
        }
    },
    // Rule-of-thirds grid, subtle at rest, stronger while dragging.
    gridLine: {
        position: "absolute",
        backgroundColor: "rgba(255, 255, 255, 0.5)",
        opacity: 0.3,
        transition: "opacity 160ms ease-out",
        pointerEvents: "none"
    },
    gridV: {
        top: 0,
        bottom: 0,
        width: 1
    },
    gridH: {
        left: 0,
        right: 0,
        height: 1
    },
    handle: {
        position: "absolute"
    },
    bracket: {
        position: "absolute",
        width: 22,
        height: 22,
        color: "#ffffff",
        pointerEvents: "none",
        filter: "drop-shadow(0 0 2px rgba(0, 0, 0, 0.6))"
    },
    edgeMark: {
        position: "absolute",
        backgroundColor: "#ffffff",
        borderRadius: 2,
        pointerEvents: "none",
        filter: "drop-shadow(0 0 2px rgba(0, 0, 0, 0.6))"
    },
    // Aspect chips + rotate / flip / reset, under the stage.
    toolbar: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginTop: 16,
        flexWrap: "wrap"
    },
    chipsRow: {
        display: "flex",
        gap: 8,
        flex: "1 1 240px",
        minWidth: 0,
        overflowX: "auto",
        padding: "4px 2px",
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": {
            display: "none"
        }
    },
    chip: {
        flex: "0 0 auto",
        backgroundColor: "#1f1f1f",
        color: "#bbb",
        fontWeight: 500,
        "&:hover, &:focus": {
            backgroundColor: "#2b2b2b"
        },
        "&.Mui-disabled": {
            opacity: 0.4
        }
    },
    chipActive: {
        backgroundColor: "#c7c7c7 !important",
        color: "#171717 !important"
    },
    tools: {
        display: "flex",
        alignItems: "center",
        gap: 4,
        marginLeft: "auto",
        flex: "0 0 auto"
    },
    toolButton: {
        color: "#ccc",
        "&:hover": {
            backgroundColor: "rgba(255, 255, 255, 0.08)"
        },
        "&.Mui-disabled": {
            color: "#555"
        }
    },
    actions: {
        backgroundColor: "#171717",
        borderRadius: "32px",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 24px"
    },
    actionsMobile: {
        borderRadius: "32px 32px 0px 0px",
        paddingBottom: "max(16px, env(safe-area-inset-bottom))"
    },
    stepLabel: {
        textTransform: "uppercase",
        marginBottom: "8px",
        fontWeight: 600,
        marginTop: 0,
        fontSize: "1rem",
        color: "#ccc",
        lineHeight: 1
    },
    stepHint: {
        color: "#999",
        display: "block",
        fontSize: "0.875rem",
        lineHeight: 1.125,
        fontVariantNumeric: "tabular-nums"
    },
    cancelButton: {
        color: "#bbb",
        "&:hover": {
            color: "#fff",
            backgroundColor: "rgba(255, 255, 255, 0.06)"
        }
    },
    doneButton: {
        borderRadius: "32px",
        backgroundColor: "#e6e6e6",
        color: "#111",
        boxShadow: "none",
        "&:hover": {
            backgroundColor: "#ffffff",
            boxShadow: "none"
        },
        "&.Mui-disabled": {
            backgroundColor: "#2a2a2a",
            color: "#666"
        }
    }
});

// ============================================================================
// GEOMETRY
// ============================================================================

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

// Size of the edit space (the picture after rotation).
const rotatedSize = (nw, nh, rotation) =>
    (rotation % 180 === 0) ? { w: nw, h: nh } : { w: nh, h: nw };

// Largest rectangle with `ratio` (w / h) that fits in W × H, centred. A null
// ratio means "free": the whole picture.
function fitRatio(ratio, W, H) {
    if (!ratio) return { x: 0, y: 0, w: W, h: H };
    let w = W;
    let h = w / ratio;
    if (h > H) {
        h = H;
        w = h * ratio;
    }
    return { x: (W - w) / 2, y: (H - h) / 2, w, h };
}

// Smallest frame allowed — on-ratio when one is locked, never larger than
// the picture itself.
function minSize(ratio, W, H) {
    let minW = Math.min(MIN_CROP_PX, W);
    let minH = Math.min(MIN_CROP_PX, H);
    if (ratio) {
        if (minW / ratio > minH) minH = minW / ratio; else minW = minH * ratio;
        if (minW > W) { minW = W; minH = W / ratio; }
        if (minH > H) { minH = H; minW = H * ratio; }
    }
    return { minW, minH };
}

// The frame after dragging `handle` ("move", "n", "e", "s", "w", "ne", …)
// by (dx, dy) source pixels from `start`, kept inside the W × H picture and
// on `ratio` when one is locked (null = free).
function dragRect(handle, start, dx, dy, ratio, W, H) {
    if (handle === "move") {
        return {
            ...start,
            x: clamp(start.x + dx, 0, Math.max(0, W - start.w)),
            y: clamp(start.y + dy, 0, Math.max(0, H - start.h))
        };
    }

    const { minW, minH } = minSize(ratio, W, H);
    const hasN = handle.indexOf("n") !== -1;
    const hasS = handle.indexOf("s") !== -1;
    const hasW = handle.indexOf("w") !== -1;
    const hasE = handle.indexOf("e") !== -1;

    let left = start.x;
    let top = start.y;
    let right = start.x + start.w;
    let bottom = start.y + start.h;

    if (!ratio) {
        // Free: each dragged edge moves on its own, the others stay put.
        // (The Math.max/Math.min guards keep the frame inside the picture
        // even if it starts out smaller than the minimum — a stale edit.)
        if (hasW) left = clamp(start.x + dx, 0, Math.max(0, right - minW));
        if (hasE) right = clamp(right + dx, Math.min(W, left + minW), W);
        if (hasN) top = clamp(start.y + dy, 0, Math.max(0, bottom - minH));
        if (hasS) bottom = clamp(bottom + dy, Math.min(H, top + minH), H);
        return { x: left, y: top, w: right - left, h: bottom - top };
    }

    const isCorner = (hasN || hasS) && (hasW || hasE);
    if (isCorner) {
        // The opposite corner is the anchor; the frame follows the larger of
        // the two drag components so it never lags behind the pointer.
        const ax = hasE ? left : right;
        const ay = hasS ? top : bottom;
        const sx = hasE ? 1 : -1;
        const sy = hasS ? 1 : -1;
        const px = (hasE ? right : left) + dx;
        const py = (hasS ? bottom : top) + dy;
        let w = Math.max(0, (px - ax) * sx);
        const h = Math.max(0, (py - ay) * sy);
        w = Math.max(w, h * ratio);
        const availW = sx > 0 ? W - ax : ax;
        const availH = sy > 0 ? H - ay : ay;
        w = Math.min(w, availW, availH * ratio);
        w = Math.max(w, Math.min(minW, availW, availH * ratio));
        const hh = w / ratio;
        return { x: sx > 0 ? ax : ax - w, y: sy > 0 ? ay : ay - hh, w, h: hh };
    }

    if (hasW || hasE) {
        // Edge: the dragged edge drives the width, the height follows and
        // the frame stays centred on its previous vertical middle.
        const anchorX = hasE ? left : right;
        const avail = hasE ? W - anchorX : anchorX;
        let w = clamp(hasE ? right + dx - anchorX : anchorX - (left + dx), minW, avail);
        let h = w / ratio;
        if (h > H) {
            h = H;
            w = h * ratio;
        }
        const cy = start.y + start.h / 2;
        const y = clamp(cy - h / 2, 0, Math.max(0, H - h));
        return { x: hasE ? anchorX : anchorX - w, y, w, h };
    }

    // Top / bottom edge: the height drives, the width follows.
    const anchorY = hasS ? top : bottom;
    const avail = hasS ? H - anchorY : anchorY;
    let h = clamp(hasS ? bottom + dy - anchorY : anchorY - (top + dy), minH, avail);
    let w = h * ratio;
    if (w > W) {
        w = W;
        h = w / ratio;
    }
    const cx = start.x + start.w / 2;
    const x = clamp(cx - w / 2, 0, Math.max(0, W - w));
    return { x, y: hasS ? anchorY : anchorY - h, w, h };
}

// The frame, rotated 90° clockwise along with a W × H picture.
const rotateRectCW = (c, W, H) => ({ x: H - c.y - c.h, y: c.x, w: c.h, h: c.w });

// The frame, mirrored along with a picture W wide.
const flipRectH = (c, W) => ({ ...c, x: W - c.x - c.w });

// Snap the frame to whole source pixels (so pixel art is copied, not
// resampled), never empty, never outside the picture.
function roundRect(c, W, H) {
    const x0 = clamp(Math.round(c.x), 0, Math.max(0, W - 1));
    const y0 = clamp(Math.round(c.y), 0, Math.max(0, H - 1));
    const x1 = clamp(Math.round(c.x + c.w), x0 + 1, W);
    const y1 = clamp(Math.round(c.y + c.h), y0 + 1, H);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// Validate an edit against the picture it is (supposedly) for; anything off
// falls back to the untouched picture.
function sanitizeEdit(edit, nw, nh) {
    const rotation = edit && ROTATIONS.indexOf(edit.rotation) !== -1 ? edit.rotation : 0;
    const flip = !!(edit && edit.flip);
    const { w: W, h: H } = rotatedSize(nw, nh, rotation);

    let crop = { x: 0, y: 0, w: W, h: H };
    const c = edit && edit.crop;
    if (c && Number.isFinite(c.x) && Number.isFinite(c.y) && c.w > 0 && c.h > 0
        && c.x >= 0 && c.y >= 0 && c.x + c.w <= W + 0.5 && c.y + c.h <= H + 0.5) {
        const x = clamp(c.x, 0, W);
        const y = clamp(c.y, 0, H);
        crop = { x, y, w: Math.min(c.w, W - x), h: Math.min(c.h, H - y) };
        if (!(crop.w > 0) || !(crop.h > 0)) crop = { x: 0, y: 0, w: W, h: H };
    }

    let aspect = null;
    if (edit && (edit.aspect === "original" || (typeof edit.aspect === "number" && edit.aspect > 0))) {
        aspect = edit.aspect;
    }
    return { rotation, flip, crop, aspect };
}

// Post-multiplies the context's transform with the "rotate, then flip" map
// from source pixels to edit space, using exact integer matrices (a
// ctx.rotate(π/2) would leave cos(π/2) ≈ 6e-17 residues that resample pixel
// art). Call after the crop/scale transform, before drawImage(img, 0, 0).
function applyEditTransform(ctx, nw, nh, rotation, flip) {
    const { w: W } = rotatedSize(nw, nh, rotation);
    if (flip) ctx.transform(-1, 0, 0, 1, W, 0);
    switch (rotation) {
        case 90:  ctx.transform(0, 1, -1, 0, nh, 0); break;   // (u, v) → (nh − v, u)
        case 180: ctx.transform(-1, 0, 0, -1, nw, nh); break; // (u, v) → (nw − u, nh − v)
        case 270: ctx.transform(0, -1, 1, 0, 0, nw); break;   // (u, v) → (v, nw − u)
        default: break;
    }
}

const isPixelArtLike = (natural) => Math.max(natural.w, natural.h) <= PIXEL_ART_MAX_SIDE;

// ============================================================================
// EXPORT
// ============================================================================

const dataUrlToBlob = (dataUrl) => {
    const comma = dataUrl.indexOf(",");
    const meta = dataUrl.slice(0, comma);
    const type = (meta.match(/^data:([^;]+)/) || [])[1] || "application/octet-stream";
    const bin = atob(dataUrl.slice(comma + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type });
};

// Renders the (integer) crop `c` of the edited picture into a Blob. `k` < 1
// only when the crop exceeds `maxSide`, in which case it is downscaled with
// smoothing; otherwise the pixels are copied exactly.
function renderCrop(img, natural, rotation, flip, c, maxSide, type, quality) {
    return new Promise((resolve, reject) => {
        const k = Math.min(1, maxSide / Math.max(c.w, c.h));
        const outW = Math.max(1, Math.round(c.w * k));
        const outH = Math.max(1, Math.round(c.h * k));

        const canvas = document.createElement("canvas");
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("2d context unavailable"));

        ctx.imageSmoothingEnabled = k < 1;
        ctx.imageSmoothingQuality = "high";
        ctx.setTransform(outW / c.w, 0, 0, outH / c.h, 0, 0);
        ctx.transform(1, 0, 0, 1, -c.x, -c.y);
        applyEditTransform(ctx, natural.w, natural.h, rotation, flip);
        ctx.drawImage(img, 0, 0);

        if (typeof canvas.toBlob === "function") {
            canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob returned null"))), type, quality);
        } else {
            try { resolve(dataUrlToBlob(canvas.toDataURL(type, quality))); } catch (e) { reject(e); }
        }
    });
}

// JPEG stays JPEG (a photo re-encoded as PNG would balloon); everything else
// — PNG, WEBP, GIF, BMP, the decoded HEIC — becomes a lossless PNG.
const outputType = (file) => (/^image\/jpe?g$/i.test((file && file.type) || "") ? "image/jpeg" : "image/png");

const outputName = (file, type) => {
    const base = ((file && file.name) || "picture").replace(/\.[^.]+$/, "") || "picture";
    return `${base}-edited.${type === "image/jpeg" ? "jpg" : "png"}`;
};

const safeRevokeURL = (url) => {
    if (url && typeof url === "string" && url.startsWith("blob:")) {
        try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
    }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const EMPTY_RECT = { x: 0, y: 0, w: 0, h: 0 };

// status: "idle" → nothing to show (closed / no file)
//         "loading" → decoding the picture
//         "ready" → the crop frame is live
//         "error"
function ImageEditor(props) {
    const { classes, open, file, initialEdit, maxOutputSize = 4096, onClose, onComplete } = props;
    useLanguage();

    const isMobile = useMediaQuery("(max-width: 704px)");

    const [status, setStatus] = useState("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [natural, setNatural] = useState({ w: 0, h: 0 });
    const [rotation, setRotation] = useState(0);
    const [flip, setFlip] = useState(false);
    const [crop, setCrop] = useState(EMPTY_RECT);
    const [aspect, setAspect] = useState(null);
    const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
    const [dragging, setDragging] = useState(false);
    const [exporting, setExporting] = useState(false);

    // Refs
    const imgRef = useRef(null);          // decoded HTMLImageElement (display + export source)
    const stageRef = useRef(null);
    const canvasRef = useRef(null);
    const genRef = useRef(0);             // generation counter — invalidates stale async work
    const dragRef = useRef(null);         // the pointer drag in progress
    const urlRef = useRef("");
    const initialEditRef = useRef(initialEdit);
    initialEditRef.current = initialEdit;

    // ── Open: decode the picture, seed the edit ─────────────────────────
    useEffect(() => {
        genRef.current += 1;
        const gen = genRef.current;

        dragRef.current = null;
        setDragging(false);
        setExporting(false);
        setErrorMsg("");

        if (!open || !file) {
            imgRef.current = null;
            safeRevokeURL(urlRef.current);
            urlRef.current = "";
            setStatus("idle");
            return undefined;
        }

        setStatus("loading");
        const url = URL.createObjectURL(file);
        urlRef.current = url;

        const img = new Image();
        img.decoding = "async";
        img.onload = () => {
            if (genRef.current !== gen) return;
            const nw = img.naturalWidth;
            const nh = img.naturalHeight;
            if (!nw || !nh) {
                setErrorMsg(COPY.couldNotRead);
                setStatus("error");
                return;
            }
            imgRef.current = img;
            const init = sanitizeEdit(initialEditRef.current, nw, nh);
            setNatural({ w: nw, h: nh });
            setRotation(init.rotation);
            setFlip(init.flip);
            setCrop(init.crop);
            setAspect(init.aspect);
            setStatus("ready");
        };
        img.onerror = () => {
            if (genRef.current !== gen) return;
            setErrorMsg(COPY.couldNotRead);
            setStatus("error");
        };
        img.src = url;

        return () => {
            safeRevokeURL(url);
            if (urlRef.current === url) urlRef.current = "";
        };
    }, [open, file]);

    // Invalidate in-flight work on unmount.
    useEffect(() => () => {
        genRef.current += 1;
        imgRef.current = null;
        safeRevokeURL(urlRef.current);
    }, []);

    // ── Stage size (responsive) ─────────────────────────────────────────
    // The observer callback only *schedules* a measurement for the next
    // frame, and the state update is a no-op when nothing changed. A state
    // update applied synchronously inside the observer's callback would have
    // Preact re-render (it renders in a microtask) while the browser is still
    // delivering resize notifications, which surfaces as "ResizeObserver
    // loop completed with undelivered notifications".
    useEffect(() => {
        if (!open) return undefined;
        const el = stageRef.current;
        if (!el) return undefined;

        const hasRaf = typeof requestAnimationFrame === "function";
        let frame = 0;

        const measure = () => {
            frame = 0;
            const w = el.clientWidth;
            const h = el.clientHeight;
            setStageSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
        };
        const schedule = () => {
            if (frame) return;
            frame = hasRaf ? requestAnimationFrame(measure) : setTimeout(measure, 16);
        };
        const cancel = () => {
            if (!frame) return;
            if (hasRaf) cancelAnimationFrame(frame); else clearTimeout(frame);
            frame = 0;
        };

        measure();

        if (typeof ResizeObserver !== "undefined") {
            const observer = new ResizeObserver(schedule);
            observer.observe(el);
            return () => {
                observer.disconnect();
                cancel();
            };
        }
        window.addEventListener("resize", schedule);
        return () => {
            window.removeEventListener("resize", schedule);
            cancel();
        };
    }, [open, status, isMobile]);

    // ── Derived geometry ────────────────────────────────────────────────
    const edit = useMemo(() => rotatedSize(natural.w, natural.h, rotation), [natural, rotation]);

    const pad = isMobile ? STAGE_PAD_MOBILE : STAGE_PAD;

    // Where the (rotated) picture sits on the stage, in CSS pixels.
    const display = useMemo(() => {
        const availW = stageSize.w - 2 * pad;
        const availH = stageSize.h - 2 * pad;
        if (!(edit.w > 0) || !(edit.h > 0) || availW <= 0 || availH <= 0) return EMPTY_RECT;
        const s = Math.min(availW / edit.w, availH / edit.h);
        const w = Math.max(1, Math.floor(edit.w * s));
        const h = Math.max(1, Math.floor(edit.h * s));
        return { x: Math.round((stageSize.w - w) / 2), y: Math.round((stageSize.h - h) / 2), w, h };
    }, [stageSize, edit, pad]);

    // CSS pixels per source pixel.
    const scale = edit.w > 0 && display.w > 0 ? display.w / edit.w : 0;

    // The locked ratio in force (null = free).
    const ratioValue = aspect === "original" ? (edit.h > 0 ? edit.w / edit.h : null) : aspect;

    const isFullFrame = crop.x === 0 && crop.y === 0 && crop.w === edit.w && crop.h === edit.h;
    const isModified = rotation !== 0 || flip || !isFullFrame;

    // Output size, as "Done" will render it.
    const output = useMemo(() => {
        if (status !== "ready") return null;
        const c = roundRect(crop, edit.w, edit.h);
        const k = Math.min(1, maxOutputSize / Math.max(c.w, c.h));
        return { w: Math.max(1, Math.round(c.w * k)), h: Math.max(1, Math.round(c.h * k)) };
    }, [status, crop, edit, maxOutputSize]);

    // ── Draw the picture into the stage canvas ──────────────────────────
    // Only the picture: the frame, the dimming and the handles are DOM
    // elements, so dragging never redraws the (possibly huge) bitmap.
    useEffect(() => {
        if (status !== "ready") return;
        const canvas = canvasRef.current;
        const img = imgRef.current;
        if (!canvas || !img || display.w < 1 || display.h < 1) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        const cw = Math.max(1, Math.round(display.w * dpr));
        const ch = Math.max(1, Math.round(display.h * dpr));
        canvas.width = cw;
        canvas.height = ch;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, cw, ch);
        // Pixel art enlarged on screen keeps hard pixels; everything else is
        // smoothed (high quality matters when a photo is shrunk a lot).
        ctx.imageSmoothingEnabled = !(isPixelArtLike(natural) && cw / edit.w >= 1);
        ctx.imageSmoothingQuality = "high";
        ctx.setTransform(cw / edit.w, 0, 0, ch / edit.h, 0, 0);
        applyEditTransform(ctx, natural.w, natural.h, rotation, flip);
        ctx.drawImage(img, 0, 0);
    }, [status, display, natural, edit, rotation, flip]);

    // ── Frame interaction (mouse, pen, touch through pointer events) ────
    const handlePointerDown = useCallback((e) => {
        if (status !== "ready" || exporting || !scale) return;
        if (e.pointerType === "mouse" && e.button !== 0) return;

        const target = e.target && e.target.closest ? e.target.closest("[data-handle]") : null;
        const handle = target ? target.getAttribute("data-handle") : "move";

        e.preventDefault();
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        try { e.currentTarget.focus({ preventScroll: true }); } catch (_) { /* ignore */ }

        dragRef.current = { pointerId: e.pointerId, handle, startX: e.clientX, startY: e.clientY, start: crop };
        setDragging(true);
    }, [status, exporting, scale, crop]);

    const handlePointerMove = useCallback((e) => {
        const d = dragRef.current;
        if (!d || d.pointerId !== e.pointerId || !scale) return;
        e.preventDefault();
        const dx = (e.clientX - d.startX) / scale;
        const dy = (e.clientY - d.startY) / scale;
        setCrop(dragRect(d.handle, d.start, dx, dy, ratioValue, edit.w, edit.h));
    }, [scale, ratioValue, edit]);

    const handlePointerEnd = useCallback((e) => {
        const d = dragRef.current;
        if (!d || d.pointerId !== e.pointerId) return;
        dragRef.current = null;
        setDragging(false);
        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    }, []);

    // Arrow keys nudge the frame (Shift: bigger steps).
    const handleKeyDown = useCallback((e) => {
        if (status !== "ready" || exporting) return;
        const step = Math.max(1, Math.round(edit.w * 0.01)) * (e.shiftKey ? 5 : 1);
        let dx = 0;
        let dy = 0;
        switch (e.key) {
            case "ArrowLeft": dx = -step; break;
            case "ArrowRight": dx = step; break;
            case "ArrowUp": dy = -step; break;
            case "ArrowDown": dy = step; break;
            default: return;
        }
        e.preventDefault();
        setCrop((c) => dragRect("move", c, dx, dy, null, edit.w, edit.h));
    }, [status, exporting, edit]);

    // ── Toolbar ─────────────────────────────────────────────────────────
    const handleAspect = useCallback((value) => {
        if (status !== "ready") return;
        setAspect(value);
        const ratio = value === "original" ? edit.w / edit.h : value;
        setCrop(fitRatio(ratio, edit.w, edit.h));
    }, [status, edit]);

    const isAspectActive = (value) => {
        if (value === null) return aspect === null;
        if (value === "original") return aspect === "original";
        return typeof aspect === "number" && Math.abs(aspect - value) < 1e-6;
    };

    const handleRotate = useCallback(() => {
        if (status !== "ready") return;
        const { w: W, h: H } = edit;
        setCrop((c) => rotateRectCW(c, W, H));
        // A fixed ratio turns with the picture (16:9 becomes 9:16).
        setAspect((a) => (typeof a === "number" ? 1 / a : a));
        // Parametrised as "rotate, then flip": a clockwise turn of a mirrored
        // picture is a counter-clockwise turn before the mirror.
        setRotation((r) => (flip ? (r + 270) % 360 : (r + 90) % 360));
    }, [status, edit, flip]);

    const handleFlip = useCallback(() => {
        if (status !== "ready") return;
        const { w: W } = edit;
        setCrop((c) => flipRectH(c, W));
        setFlip((f) => !f);
    }, [status, edit]);

    const handleReset = useCallback(() => {
        if (status !== "ready") return;
        setRotation(0);
        setFlip(false);
        setAspect(null);
        setCrop({ x: 0, y: 0, w: natural.w, h: natural.h });
    }, [status, natural]);

    // ── Confirm / cancel ────────────────────────────────────────────────
    const handleDone = useCallback(async () => {
        if (status !== "ready" || exporting) return;
        const img = imgRef.current;
        if (!img) return;

        const c = roundRect(crop, edit.w, edit.h);
        const identity = rotation === 0 && !flip
            && c.x === 0 && c.y === 0 && c.w === edit.w && c.h === edit.h;
        if (identity) {
            // Nothing to render: the original stands (this also undoes a
            // previous edit when the user reset the frame).
            if (onComplete) onComplete(file, null);
            return;
        }

        const gen = genRef.current;
        setExporting(true);
        setErrorMsg("");
        try {
            const type = outputType(file);
            const blob = await renderCrop(img, natural, rotation, flip, c, maxOutputSize, type, 0.92);
            if (genRef.current !== gen) return;
            const out = new File([blob], outputName(file, blob.type || type), {
                type: blob.type || type,
                lastModified: Date.now()
            });
            const k = Math.min(1, maxOutputSize / Math.max(c.w, c.h));
            if (onComplete) {
                onComplete(out, {
                    crop: c,
                    rotation,
                    flip,
                    aspect,
                    width: Math.max(1, Math.round(c.w * k)),
                    height: Math.max(1, Math.round(c.h * k))
                });
            }
        } catch (e) {
            console.error("[ImageEditor] Could not render the crop:", e);
            if (genRef.current === gen) setErrorMsg(COPY.exportFailed);
        } finally {
            if (genRef.current === gen) setExporting(false);
        }
    }, [status, exporting, crop, edit, rotation, flip, aspect, natural, maxOutputSize, file, onComplete]);

    const handleCancel = useCallback(() => {
        if (exporting) return;
        if (onClose) onClose();
    }, [exporting, onClose]);

    // ── Render ──────────────────────────────────────────────────────────
    const ready = status === "ready";
    const displayStyle = { left: display.x, top: display.y, width: display.w, height: display.h };
    const cropStyle = {
        left: crop.x * scale,
        top: crop.y * scale,
        width: crop.w * scale,
        height: crop.h * scale
    };

    const hint = status === "loading"
        ? COPY.loading
        : status === "error"
            ? errorMsg
            : errorMsg
                ? errorMsg
                : output
                    ? `${output.w} × ${output.h} px${isModified ? "" : " — " + COPY.hint}`
                    : "";

    return (
        <Dialog
            className={classes.dialog}
            open={open}
            fullScreen={isMobile}
            maxWidth={false}
            fullWidth={false}
            disablePortal={false}
            onClose={handleCancel}
            keepMounted={false}
        >
            <DialogContent className={classes.content + (isMobile ? " " + classes.contentMobile : "")}>
                <div
                    ref={stageRef}
                    className={classes.stage + (isMobile ? " " + classes.stageMobile : "")}
                >
                    {ready && (
                        <React.Fragment>
                            <canvas ref={canvasRef} className={classes.stageCanvas} style={displayStyle} />

                            {/* dimming outside the frame, clipped to the picture */}
                            <div className={classes.maskLayer} style={displayStyle}>
                                <div className={classes.dimBox} style={cropStyle} />
                            </div>

                            {/* the frame and its handles */}
                            <div className={classes.cropLayer} style={displayStyle}>
                                <div
                                    className={classes.cropBox + (dragging ? " " + classes.cropBoxDragging : "")}
                                    style={cropStyle}
                                    tabIndex={0}
                                    role="group"
                                    aria-label={COPY.cropFrame}
                                    onPointerDown={handlePointerDown}
                                    onPointerMove={handlePointerMove}
                                    onPointerUp={handlePointerEnd}
                                    onPointerCancel={handlePointerEnd}
                                    onKeyDown={handleKeyDown}
                                >
                                    {/* rule-of-thirds grid */}
                                    <div className={classes.gridLine + " " + classes.gridV} style={{ left: "33.333%" }} />
                                    <div className={classes.gridLine + " " + classes.gridV} style={{ left: "66.667%" }} />
                                    <div className={classes.gridLine + " " + classes.gridH} style={{ top: "33.333%" }} />
                                    <div className={classes.gridLine + " " + classes.gridH} style={{ top: "66.667%" }} />

                                    {/* hit areas: edges first, corners on top */}
                                    {EDGE_HANDLES.map((h) => (
                                        <div
                                            key={h.id}
                                            data-handle={h.id}
                                            className={classes.handle}
                                            style={{ ...h.style, cursor: h.cursor }}
                                        />
                                    ))}
                                    {CORNER_HANDLES.map((h) => (
                                        <div
                                            key={h.id}
                                            data-handle={h.id}
                                            className={classes.handle}
                                            style={{ ...h.style, width: CORNER_HIT, height: CORNER_HIT, cursor: h.cursor }}
                                        />
                                    ))}

                                    {/* visible marks */}
                                    {EDGE_MARKS.map((m) => (
                                        <div key={m.id} className={classes.edgeMark} style={m.style} />
                                    ))}
                                    {CORNER_HANDLES.map((h) => (
                                        <svg
                                            key={"bracket-" + h.id}
                                            className={classes.bracket}
                                            viewBox="0 0 22 22"
                                            style={{ ...h.bracket, transform: `rotate(${h.rotate}deg)` }}
                                        >
                                            <path
                                                d={BRACKET_PATH}
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="3"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                    ))}
                                </div>
                            </div>
                        </React.Fragment>
                    )}

                    {status === "loading" && (
                        <div className={classes.stageMessage}>
                            <CircularProgress size={32} thickness={4} style={{ color: "#888" }} />
                        </div>
                    )}
                    {status === "error" && (
                        <div className={classes.stageMessage}>
                            <Typography variant="body2" style={{ color: "#888" }}>{errorMsg}</Typography>
                        </div>
                    )}
                </div>

                <div className={classes.toolbar}>
                    <div className={classes.chipsRow} role="radiogroup" aria-label={COPY.aspectRatio}>
                        {ASPECTS.map((a) => {
                            const active = isAspectActive(a.value);
                            return (
                                <Chip
                                    key={a.id}
                                    label={a.label}
                                    clickable
                                    disabled={!ready || exporting}
                                    role="radio"
                                    aria-checked={active}
                                    onClick={() => handleAspect(a.value)}
                                    className={classes.chip + (active ? " " + classes.chipActive : "")}
                                />
                            );
                        })}
                    </div>
                    <div className={classes.tools}>
                        <IconButton
                            className={classes.toolButton}
                            onClick={handleRotate}
                            disabled={!ready || exporting}
                            aria-label={COPY.rotate}
                            title={COPY.rotate}
                        >
                            <RotateRightIcon />
                        </IconButton>
                        <IconButton
                            className={classes.toolButton}
                            onClick={handleFlip}
                            disabled={!ready || exporting}
                            aria-label={COPY.flip}
                            title={COPY.flip}
                        >
                            <FlipIcon />
                        </IconButton>
                        <IconButton
                            className={classes.toolButton}
                            onClick={handleReset}
                            disabled={!ready || exporting || !isModified}
                            aria-label={COPY.reset}
                            title={COPY.reset}
                        >
                            <RestoreIcon />
                        </IconButton>
                    </div>
                </div>
            </DialogContent>

            <DialogActions className={classes.actions + (isMobile ? " " + classes.actionsMobile : "")}>
                <Box style={{ textAlign: "left", minWidth: 0 }}>
                    <Typography variant="body2" className={classes.stepLabel}>
                        {COPY.crop}
                    </Typography>
                    <Typography variant="caption" className={classes.stepHint}>
                        {hint}
                    </Typography>
                </Box>
                <Box style={{ flex: "0 0 auto" }}>
                    <Button
                        variant="text"
                        className={classes.cancelButton}
                        onClick={handleCancel}
                        disabled={exporting}
                    >
                        {t("words.cancel")}
                    </Button>
                    <Button
                        size="large"
                        variant="contained"
                        className={classes.doneButton}
                        onClick={handleDone}
                        disabled={!ready || exporting}
                    >
                        {exporting ? (
                            <CircularProgress size={24} style={{ color: "#111" }} />
                        ) : COPY.done}
                    </Button>
                </Box>
            </DialogActions>
        </Dialog>
    );
}

export default withStyles(styles)(ImageEditor);