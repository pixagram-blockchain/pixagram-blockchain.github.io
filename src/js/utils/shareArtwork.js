/**
 * utils/shareArtwork — the share image of a freshly published artwork: the
 * pure half.
 *
 * What the watermarked file looks like (its proportions, and where the band's
 * wordmark and license land — the dialog's skeleton draws both before any
 * pixel exists), the scale it is rendered at, its file name, and when the
 * "share your creation" dialog opens (createShareFlow).
 *
 * No imports and no DOM: Index and ShareArtworkDialog import it statically,
 * the render itself (utils/shareArtworkRender, fetched on demand) builds on
 * it, and tests/shareArtwork.test.mjs runs it as is.
 */

/* ── The watermarked file ──────────────────────────────────────────────────
 * utils/watermark draws the render, then a white band under it, 200 px tall
 * per 1000 px of width (its scaleFactor = width / 1000): the wordmark on the
 * left (760 × 200 at that reference width), the license on the right
 * (240 × 200). A W × H render becomes a W × (H + 0.2 W) file at any scale, so
 * the file's shape follows from the artwork's proportions alone. */
export const BAND_RATIO = 200 / 1000;

// Proportions assumed until the artwork is decoded: a square.
function proportions(width, height) {
    return width > 0 && height > 0 ? [width, height] : [1, 1];
}

/** Width ÷ height of the watermarked file, for a width × height artwork. */
export function watermarkedRatio(width, height) {
    const [w, h] = proportions(width, height);
    return w / (h + BAND_RATIO * w);
}

/** Share of the file's height taken by the artwork; the band has the rest. */
export function artworkFraction(width, height) {
    const [w, h] = proportions(width, height);
    return h / (h + BAND_RATIO * w);
}

/** Pixel size of the file utils/watermark makes from a width × height render
 *  (canvas sizes are integers: the band's height truncates with them). */
export function watermarkedSize(width, height) {
    return { width: Math.trunc(width), height: Math.trunc(height + BAND_RATIO * width) };
}

/* ── Skeleton of the band ──────────────────────────────────────────────────
 * Where the band's shapes land, measured on the two SVGs utils/watermark
 * draws, in band units: the 1000 × 200 reference band, the wordmark's
 * 760 × 200 viewBox on the left and the license's 240 × 200 one from x = 760.
 * Text lines keep 60 % of their capital height, centred, as text skeletons
 * do. tone 0 is a panel, tone 1 something drawn on one. */
const BAND_BONES = [
    // wordmark
    { x0: 12.75, y0: 19, x1: 743, y1: 181, r: 21.59, tone: 0 },                         // panel
    { x0: 26.6, y0: 31.6, x1: 163.4, y1: 168.4, r: 13.68, tone: 1 },                    // logo tile
    { x0: 185, y0: 55.26, x1: 721.41, y1: 86.34, r: "pill", tone: 1 },                  // PIXAGRAM.COM
    { x0: 182.57, y0: 110.6, x1: 724.08, y1: 118.6, r: "pill", tone: 1 },               // rainbow rule
    { x0: 184, y0: 135.26, x1: 723.08, y1: 148.03, r: "pill", tone: 1 },                // tagline
    // license
    { x0: 780, y0: 20, x1: 980, y1: 180, r: 23.85, tone: 0 },                           // card
    { x0: 852.57, y0: 30.1, x1: 907.43, y1: 84.96, r: "round", tone: 1 },               // badge
    { x0: 805.65, y0: 113.23, x1: 952.69, y1: 121.91, r: "pill", tone: 1 },             // "PIXA License 1.0"
    { x0: 788.05, y0: 134, x1: 971.95, y1: 172.08, r: [8.65, 8.65, 17.29, 17.29], tone: 1 }, // name plate
];

const pct = (n) => +n.toFixed(3) + "%";

// Corner radii in band units → CSS, relative to the bone's own box.
function cssRadius(r, w, h) {
    if (r === "pill") return "999px";
    if (r === "round") return "50%";
    const corners = Array.isArray(r) ? r : [r, r, r, r];
    return corners.map((c) => pct((c / w) * 100)).join(" ")
        + " / " + corners.map((c) => pct((c / h) * 100)).join(" ");
}

/** The band's skeleton shapes: CSS boxes in percent of the band. */
export const BAND_SKELETON = Object.freeze(BAND_BONES.map(({ x0, y0, x1, y1, r, tone }) => Object.freeze({
    tone,
    style: Object.freeze({
        left: pct(x0 / 10),
        top: pct(y0 / 2),
        width: pct((x1 - x0) / 10),
        height: pct((y1 - y0) / 2),
        borderRadius: cssRadius(r, x1 - x0, y1 - y0),
    }),
})));

/* ── Render scale ──────────────────────────────────────────────────────────
 * PostDialog's download scales with the viewport (up to ×32: a large artwork
 * can come out 6000 px wide). A file to post elsewhere wants a steady size:
 * the render about SHARE_WIDTH wide — the band's lettering is drawn at 14 px
 * per 1000 px of width and stops reading well much below that — and no side
 * over SHARE_MAX_SIDE. PostDialog's bounds otherwise: ×32 at most, at least
 * ×3 for the hexagon renderer and ×2 for the others. */
export const SHARE_WIDTH = 2048;
export const SHARE_MAX_SIDE = 4096;
const MAX_SCALE = 32;

export function shareScale(renderer, width, height) {
    const min = renderer === "hexagon" ? 3 : 2;
    const w = Math.max(1, Math.trunc(width) || 1);
    const h = Math.max(1, Math.trunc(height) || 1);
    const scale = Math.min(
        Math.round(SHARE_WIDTH / w),
        Math.floor(SHARE_MAX_SIDE / Math.max(w, h)),
        MAX_SCALE,
    );
    return Math.max(min, scale);
}

/* ── The file ──────────────────────────────────────────────────────────────── */
const EXTENSIONS = {
    "image/png": "png",
    "image/webp": "webp",
    "image/jpeg": "jpg",
    "image/avif": "avif",
    "image/gif": "gif",
};

/** PostDialog's download name, with the extension of the type actually encoded. */
export function shareFileName(author, renderer, type, format) {
    const ext = EXTENSIONS[String(type || "").toLowerCase()] || String(format || "png").toLowerCase();
    return "Artwork_From_@" + (author || "unknown")
        + "_Printed_Using_" + String(renderer || "square").toUpperCase() + "." + ext;
}

/** A data: URL as a Blob; null for anything else. The encoder hands back a
 *  data URL, and a several-MB one is slow in an <img> and refused by Chrome's
 *  downloads past ~2 MB — the dialog works from an object URL instead. */
export function dataUrlToBlob(url) {
    if (typeof url !== "string" || url.slice(0, 5) !== "data:") return null;
    const comma = url.indexOf(",");
    if (comma < 0) return null;
    const meta = url.slice(5, comma);
    const type = meta.split(";")[0] || "application/octet-stream";
    const body = url.slice(comma + 1);
    let bytes;
    if (/;base64$/i.test(meta)) {
        const binary = atob(body);
        bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    } else {
        bytes = new TextEncoder().encode(decodeURIComponent(body));
    }
    return new Blob([bytes], { type });
}

/* ── The artwork handed over ───────────────────────────────────────────────
 * The decoder loads URLs. The artwork may arrive as one (a data URL, as
 * stored on chain) or as bare base64 — NewPost's `base64` state, by its own
 * account — which is typed here from its first bytes. */
const BASE64_SIGNATURES = [
    ["UklGR", "image/webp"],        // RIFF
    ["iVBORw0KGgo", "image/png"],
    ["/9j/", "image/jpeg"],
    ["R0lGOD", "image/gif"],
];

/** An artwork image as a URL the decoder can load: a URL (data:, blob:,
 *  http(s):) as it is, bare base64 as a data: URL of the type its first bytes
 *  say (WebP, what NewPost publishes, when they say nothing). Anything that
 *  isn't a string — ImageData… — comes back unchanged. */
export function imageSource(value) {
    if (typeof value !== "string") return value;
    const s = value.trim();
    if (!s || /^(data|blob|https?):/i.test(s)) return s;
    const base64 = s.replace(/\s+/g, "");
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return s;
    const known = BASE64_SIGNATURES.find(([head]) => base64.startsWith(head));
    return "data:" + (known ? known[1] : "image/webp") + ";base64," + base64;
}

/* ── When the dialog opens ─────────────────────────────────────────────────
 * The render starts the moment the post's broadcast succeeds (published());
 * the dialog opens `delayMs` after the publish animation has played
 * (animationEnded()) — the next event as a rule, the animation starting once
 * the editor has closed. Along the way:
 *
 *   - published() hands back a promise the render's main-thread half (the
 *     watermark and the encode) waits for, so that half doesn't take frames
 *     from the animation. It resolves when the animation ends, or after
 *     `holdMaxMs` should the animation never show;
 *   - an animation that ended up to `latePostMs` before published() is taken
 *     as that publication's (the two events come from different places): no
 *     hold, and the delay still counts from the animation's end;
 *   - onDue() fires only while a publication is pending: settled() (the
 *     dialog opened) or a newer published() withdraws it;
 *   - a publication whose animation hasn't ended `staleMs` later is let go:
 *     onDrop(), and nothing is pending any more — a later, unrelated
 *     animation never opens a dialog on it.
 *
 * Timers are injectable for the test harness. */
export function createShareFlow(options) {
    const o = options || {};
    const delayMs = o.delayMs != null ? o.delayMs : 3000;
    const holdMaxMs = o.holdMaxMs != null ? o.holdMaxMs : 20000;
    const latePostMs = o.latePostMs != null ? o.latePostMs : 10000;
    const staleMs = o.staleMs != null ? o.staleMs : 60000;
    const now = o.now || (() => Date.now());
    const setTimer = o.setTimer || ((fn, ms) => setTimeout(fn, ms));
    const clearTimer = o.clearTimer || ((id) => clearTimeout(id));
    const onDue = o.onDue || (() => {});
    const onDrop = o.onDrop || (() => {});

    let pending = false;        // a publication waiting for its dialog
    let release = null;         // resolves the current render's hold
    let holdTimer = null;
    let dueTimer = null;
    let staleTimer = null;
    let endedAt = null;         // an animation that ended with no publication to pair

    const openHold = () => {
        if (holdTimer !== null) { clearTimer(holdTimer); holdTimer = null; }
        const resolve = release;
        release = null;
        if (resolve) resolve();
    };
    const cancelDue = () => {
        if (dueTimer !== null) { clearTimer(dueTimer); dueTimer = null; }
    };
    const cancelStale = () => {
        if (staleTimer !== null) { clearTimer(staleTimer); staleTimer = null; }
    };
    const scheduleDue = (ms) => {
        cancelDue();
        dueTimer = setTimer(() => {
            dueTimer = null;
            if (pending) onDue();
        }, Math.max(0, ms));
    };

    return {
        /** The post's broadcast has succeeded. Returns what the render's
         *  main-thread half waits for: a promise, or null (go ahead). */
        published() {
            openHold(); // a previous render's hold: that render is superseded
            cancelDue();
            cancelStale();
            pending = true;
            const since = endedAt === null ? Infinity : now() - endedAt;
            if (since >= 0 && since < latePostMs) {
                endedAt = null;
                scheduleDue(delayMs - since);
                return null;
            }
            endedAt = null;
            staleTimer = setTimer(() => {
                staleTimer = null;
                if (!pending) return;
                pending = false;
                cancelDue();
                openHold();
                onDrop();
            }, staleMs);
            return new Promise((resolve) => {
                release = resolve;
                holdTimer = setTimer(openHold, holdMaxMs);
            });
        },
        /** The publish animation has played to its end. */
        animationEnded() {
            openHold();
            if (pending) {
                endedAt = null;
                cancelStale();
                scheduleDue(delayMs);
            } else {
                endedAt = now();
            }
        },
        /** The dialog has opened: nothing is pending any more. */
        settled() {
            pending = false;
            cancelDue();
            cancelStale();
        },
        dispose() {
            pending = false;
            endedAt = null;
            cancelDue();
            cancelStale();
            openHold();
        },
    };
}
