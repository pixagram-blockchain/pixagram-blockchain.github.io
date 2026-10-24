/**
 * utils/shareArtworkRender — the share image of a freshly published artwork:
 * the render.
 *
 * The artwork goes through the render pool with the viewer's renderer, then
 * utils/watermark stamps the wordmark + license band under it: the file
 * PostDialog's watermarked download makes, at the size utils/shareArtwork
 * picks for sharing. Index starts it the moment the post's broadcast
 * succeeds (ARTWORK_PUBLISHED), so it is ready — or nearly — when the share
 * dialog opens after the publish animation.
 *
 * Fetched on demand, and it fetches its own heavy parts (PNG decoder, render
 * pool, watermark + encoder): none of it ships before someone publishes.
 */
import JSLoader from "./JSLoader";
import { shareScale, shareFileName, dataUrlToBlob, imageSource } from "./shareArtwork";

// A step that never answers fails instead of leaving the dialog on its
// skeleton for good (with "Try again" in reach): the render pool's, and
// every other — utils/watermark, for one, loses an encoder failure on the
// way and then never settles.
const RENDER_TIMEOUT_MS = 90000;
const STEP_TIMEOUT_MS = 60000;

function withTimeout(promise, ms, what) {
    let timer = 0;
    const timeout = new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(what + " did not answer")), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function makeCanvas(width, height) {
    if (typeof OffscreenCanvas !== "undefined") {
        try {
            const canvas = new OffscreenCanvas(width, height);
            const ctx = canvas.getContext("2d");
            if (ctx) return { canvas, ctx };
        } catch (e) { /* a DOM canvas below */ }
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return { canvas, ctx: canvas.getContext("2d") };
}

function closeBitmap(bitmap) {
    if (bitmap && typeof bitmap.close === "function") {
        try { bitmap.close(); } catch (e) { /* already closed */ }
    }
}

function releaseFrame(frame) {
    if (frame && frame.bitmap) closeBitmap(frame.bitmap);
}

// The artwork as ImageData of our own: pixels already in hand (NewPost's, or
// PostDialog's { imgd } shape) are copied — the render pool may keep the
// buffer it is handed, and "Try again" needs them once more; an image (the
// data URL stored on chain, or bare base64) is decoded the way PostDialog's
// getMetadata does.
async function decodeArtwork(image) {
    if (!image) return null;
    const pixels = (typeof ImageData !== "undefined" && image instanceof ImageData) ? image
        : (typeof image === "object" && image.imgd) ? image.imgd
        : null;
    if (pixels) return new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height);
    if (typeof image !== "string") return null;
    const { pngdby } = await JSLoader(() => import("./png-db"));
    const obj = await pngdby.get_new_img_obj(imageSource(image));
    return pngdby.get_new_img_data(obj);
}

// One pass through the render pool, called as PostDialog's download calls it.
// Resolves with { bitmap } (ours to close) or { data } — the bitmap is the
// reliable half; the pool's ImageData can be empty or a recycled buffer, so
// it is copied when it's all there is.
function renderFrame(pool, renderer, src, scale, id, mode) {
    return new Promise((resolve, reject) => {
        let settled = false;
        let timer = 0;
        const settle = (error, frame) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (error) reject(error);
            else resolve(frame);
        };
        timer = setTimeout(() => settle(new Error("the render pool did not answer")), RENDER_TIMEOUT_MS);

        const take = (d, b) => {
            if (settled) { closeBitmap(b); return; }
            if (b && b.width && b.height) { settle(null, { bitmap: b }); return; }
            closeBitmap(b);
            if (d && d.data && d.data.length) {
                settle(null, { data: new ImageData(new Uint8ClampedArray(d.data), d.width, d.height) });
                return;
            }
            settle(new Error("empty render result"));
        };
        // xBRZ reports progressively: take the pass that reaches the target
        // size (PostDialog's download filter) and drop the ones before it.
        const target = src.width * scale;
        const onRendered = renderer !== "xbrz" ? take : (d, b) => {
            if (!d || target - 128 < (d.width || (b && b.width) || 0)) take(d, b);
            else closeBitmap(b);
        };

        try {
            if (renderer === "hexagon") pool.hexF(src, scale, onRendered, true, id, mode);
            else if (renderer === "xbrz") pool.xbrzF(src, scale, onRendered, true, id, mode);
            else if (renderer === "crt") pool.crtF(src, scale, onRendered, true, id, mode);
            else if (renderer === "tri") pool.triF(src, scale, onRendered, true, id, mode);
            else pool.sqrF(src, scale, onRendered, true, id, mode);
        } catch (e) {
            settle(e);
        }
    });
}

// The render as ImageData for utils/watermark. Hexagon renders are stretched
// back to the artwork's proportions — hex cells don't tile its rectangle
// exactly; PostDialog's download does the same.
function frameToImageData(frame, renderer, srcWidth, srcHeight) {
    try {
        const w = frame.bitmap ? frame.bitmap.width : frame.data.width;
        const h = frame.bitmap ? frame.bitmap.height : frame.data.height;
        const outH = renderer === "hexagon" ? Math.ceil(w / (srcWidth / srcHeight)) : h;
        if (!frame.bitmap && outH === h) return frame.data;
        const out = makeCanvas(w, outH);
        if (frame.bitmap) {
            out.ctx.drawImage(frame.bitmap, 0, 0, w, h, 0, 0, w, outH);
        } else {
            const tmp = makeCanvas(w, h);
            tmp.ctx.putImageData(frame.data, 0, 0);
            out.ctx.drawImage(tmp.canvas, 0, 0, w, h, 0, 0, w, outH);
        }
        return out.ctx.getImageData(0, 0, w, outH, { colorSpace: "srgb" });
    } finally {
        releaseFrame(frame);
    }
}

/**
 * Make the share image of a freshly published artwork.
 *
 *   post      { author, permlink, image, width?, height?, created? }
 *             image: the artwork's ImageData (bare, or PostDialog's
 *             { imgd }), or the image stored on chain (a data URL, or bare
 *             base64); width/height, when known, shape the skeleton before
 *             the artwork is decoded
 *   options   { renderer, mode, format } — the viewer's settings, as
 *             PostDialog uses them — and holdUntil: a promise the
 *             main-thread half (watermark, encode) waits for
 *   onUpdate  called with a new snapshot at every step:
 *             { status: "preparing" | "ready" | "failed",
 *               width, height,          the artwork's size (0: not known yet)
 *               href, type, filename }  once ready
 *
 * Returns { cancel() }: drops whatever is still to come and revokes the
 * object URL — call it once the image is no longer shown.
 */
export function startShareImage(post, options, onUpdate) {
    const o = options || {};
    const renderer = o.renderer || "square";
    const author = String((post && post.author) || "");
    const permlink = String((post && post.permlink) || "");
    let cancelled = false;
    let objectUrl = null;
    let snapshot = {
        status: "preparing",
        width: (post && post.width) | 0,
        height: (post && post.height) | 0,
        href: null,
        type: "",
        filename: "",
    };
    const emit = (patch) => {
        if (cancelled) return;
        snapshot = Object.assign({}, snapshot, patch);
        if (typeof onUpdate === "function") onUpdate(snapshot);
    };

    // Fetched alongside the decode: both are needed later anyway.
    const poolP = JSLoader(() => import("./render-pool"));
    const watermarkP = JSLoader(() => import("./watermark"));
    poolP.catch(() => {});
    watermarkP.catch(() => {});

    (async () => {
        const src = await withTimeout(decodeArtwork(post && post.image), STEP_TIMEOUT_MS, "the decode");
        if (cancelled) return;
        if (!src || !src.width || !src.height) throw new Error("the artwork could not be decoded");
        const srcWidth = src.width, srcHeight = src.height;
        if (srcWidth !== snapshot.width || srcHeight !== snapshot.height) {
            emit({ width: srcWidth, height: srcHeight });
        }

        // Off the main thread: the render pool's workers.
        const pool = await withTimeout(poolP, STEP_TIMEOUT_MS, "the render pool's download");
        if (cancelled) return;
        const scale = shareScale(renderer, srcWidth, srcHeight);
        const frame = await renderFrame(pool, renderer, src, scale, "share:" + author + "/" + permlink, o.mode);
        if (cancelled) { releaseFrame(frame); return; }

        // On it: not while the publish animation is playing.
        if (o.holdUntil) {
            try { await o.holdUntil; } catch (e) { /* go ahead */ }
        }
        if (cancelled) { releaseFrame(frame); return; }
        const art = frameToImageData(frame, renderer, srcWidth, srcHeight);

        const watermark = await withTimeout(watermarkP, STEP_TIMEOUT_MS, "the watermark's download");
        if (cancelled) return;
        const format = String(o.format || "png").toLowerCase();
        const year = new Date((post && post.created) || Date.now()).getFullYear();
        const encoded = await withTimeout(
            watermark.default(art, "@" + author, year, format.toUpperCase()),
            STEP_TIMEOUT_MS, "the watermark",
        );
        if (cancelled) return;

        const blob = (typeof Blob !== "undefined" && encoded instanceof Blob) ? encoded : dataUrlToBlob(encoded);
        const href = blob ? URL.createObjectURL(blob) : (typeof encoded === "string" ? encoded : "");
        if (!href) throw new Error("the image could not be encoded");
        if (blob) objectUrl = href;
        const type = (blob && blob.type) || "image/" + (format === "jpg" ? "jpeg" : format);
        emit({ status: "ready", href, type, filename: shareFileName(author, renderer, type, format) });
    })().catch((error) => {
        if (cancelled) return;
        console.warn("[shareArtwork] the share image could not be made:", (error && error.message) || error);
        emit({ status: "failed" });
    });

    return {
        cancel() {
            cancelled = true;
            if (objectUrl) {
                try { URL.revokeObjectURL(objectUrl); } catch (e) { /* gone already */ }
                objectUrl = null;
            }
        },
    };
}
