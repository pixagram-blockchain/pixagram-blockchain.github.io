// ============================================================================
// utils/artwork_body.js — the artwork a pixel-art post carries as its body
//
// A pixel-art post's body is the picture itself: "data:image/webp;base64,…",
// one lossless WebP and nothing else (information repository,
// 09-developers/artwork-encoding-spec.md). EditPostDialog opens it in the
// pixel editor and writes the result back in the same form:
//
//   readArtworkBody(body)    what the body holds: a picture the editor can
//                            open, an erased artwork, or a picture it cannot
//                            take back as it is
//   decodeArtworkBody(body)  the picture's pixels, as ImageData
//   encodeArtworkBody(imgd)  pixels → a body, encoded as NewPost encodes one
//   sameImageData(a, b)      tells the editor's Done without a change apart
//   artworkKb(body)          the file's weight in kB, as NewPost shows it
// ============================================================================

import JSLoader from "./JSLoader";
import { blobToImageData } from "./memory-kit";
import { inspectImageDataUri } from "./api/sanitizer";

export const ARTWORK_BODY_PREFIX = "data:image/webp;base64,";

// api.pixagram.com refuses a request over about 1 MiB with HTTP 413 (wiki,
// 21-reference/chain-parameters.md). The body travels in that request with
// the rest of the transaction (metadata, title, signature), so it stays about
// 48 KiB clear of it. The largest artwork on chain so far is under 500 kB.
export const ARTWORK_BODY_MAX_LENGTH = 1000000;

export const ARTWORK = Object.freeze({
    EDITABLE: "editable",        // a still WebP, the format the app writes
    ERASED: "erased",            // "deleted" (an erased artwork) or no picture at all
    UNSUPPORTED: "unsupported",  // a picture the editor would not give back as it is
});

/**
 * What a post body holds, read from its header only (nothing is decoded).
 *
 * @param {string} body
 * @returns {{ status: string, reason?: string, mime?: string,
 *             width?: number, height?: number, bytes?: number }}
 */
export function readArtworkBody(body) {
    const text = typeof body === "string" ? body.trim() : "";
    if (!text.startsWith("data:image/")) return { status: ARTWORK.ERASED };
    // The app's one gate for base64 pictures: well-formed, the declared type
    // matching the file's first bytes, and no decompression bomb.
    const info = inspectImageDataUri(text);
    if (!info.ok) return { status: ARTWORK.UNSUPPORTED, reason: info.reason };
    // The editor gives back one still picture, saved as lossless WebP: a body
    // of another type would change format, an animation would lose all but
    // its first frame.
    if (info.mime !== "image/webp") return { status: ARTWORK.UNSUPPORTED, reason: "not-webp", mime: info.mime };
    if (isAnimatedWebp(text)) return { status: ARTWORK.UNSUPPORTED, reason: "animated", mime: info.mime };
    return { status: ARTWORK.EDITABLE, mime: info.mime, width: info.width, height: info.height, bytes: info.bytes };
}

/**
 * The picture in a body, as ImageData; null when it cannot be decoded.
 * Through a bitmap first (exact pixels, no colour management); through an
 * <img> where createImageBitmap is missing or refuses the file.
 *
 * @param {string} body  a body readArtworkBody calls editable
 * @returns {Promise<ImageData|null>}
 */
export async function decodeArtworkBody(body) {
    const text = typeof body === "string" ? body.trim() : "";
    const comma = text.indexOf(",");
    if (!text.startsWith("data:image/") || comma < 0) return null;
    if (typeof createImageBitmap === "function") {
        try {
            const mime = text.slice("data:".length, text.indexOf(";"));
            const imageData = await blobToImageData(new Blob([base64Bytes(text.slice(comma + 1))], { type: mime }));
            if (imageData && imageData.width && imageData.height) return imageData;
        } catch (error) {
            console.warn("[artwork_body] bitmap decode failed, trying an <img>:", error && error.message);
        }
    }
    return decodeWithImageElement(text);
}

/**
 * Pixels → a post body: lossless WebP with libwebp's `exact`, encoded as
 * NewPost encodes the picture it publishes.
 *
 * @param {ImageData} imageData
 * @returns {Promise<string>} "data:image/webp;base64,…"
 */
export async function encodeArtworkBody(imageData) {
    const { encodeIMG } = await JSLoader(() => import("./encodeImage"));
    const body = await encodeIMG(imageData, "WEBP", true);
    if (typeof body !== "string" || !body.startsWith(ARTWORK_BODY_PREFIX) || body.length === ARTWORK_BODY_PREFIX.length) {
        throw new Error("The WebP encoder returned no image");
    }
    return body;
}

/** Same size and the same RGBA bytes. */
export function sameImageData(a, b) {
    if (!a || !b || a.width !== b.width || a.height !== b.height) return false;
    const x = a.data, y = b.data;
    if (!x || !y || x.length !== y.length) return false;
    if (x.byteOffset % 4 === 0 && y.byteOffset % 4 === 0) {
        // Four bytes at a time: a 2160 × 1184 picture is 2.5 M comparisons.
        const x32 = new Uint32Array(x.buffer, x.byteOffset, x.length >> 2);
        const y32 = new Uint32Array(y.buffer, y.byteOffset, y.length >> 2);
        for (let i = 0; i < x32.length; i++) if (x32[i] !== y32[i]) return false;
        for (let i = x32.length << 2; i < x.length; i++) if (x[i] !== y[i]) return false;
        return true;
    }
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
    return true;
}

/** The file's weight in kB (1,000 bytes), as NewPost shows it: ¾ of the body's length. */
export function artworkKb(body) {
    return ((typeof body === "string" ? body.length : 0) / 1000) * 3 / 4;
}

// ── internals ─────────────────────────────────────────────────────────────

function base64Bytes(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

// An animated WebP is an extended file ("VP8X") with the animation flag set:
//   "RIFF" size "WEBP" "VP8X" chunk-size flags …   — flags 0x02 = animation
function isAnimatedWebp(dataUri) {
    const head = base64Bytes(dataUri.slice(dataUri.indexOf(",") + 1).slice(0, 32));
    return head.length >= 21
        && head[12] === 0x56 && head[13] === 0x50 && head[14] === 0x38 && head[15] === 0x58   // "VP8X"
        && (head[20] & 0x02) !== 0;
}

function decodeWithImageElement(src) {
    return new Promise((resolve) => {
        try {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                try {
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    const ctx = canvas.getContext("2d");
                    if (!ctx || !canvas.width || !canvas.height) return resolve(null);
                    ctx.drawImage(img, 0, 0);
                    resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
                } catch (error) {
                    resolve(null);
                } finally {
                    canvas.width = 1; // release the pixels now rather than at GC
                    canvas.height = 1;
                }
            };
            img.onerror = () => resolve(null);
            img.src = src;
        } catch (error) {
            resolve(null);
        }
    });
}
