/**
 * arweaveImage.js — client-side pipeline for storing post images on Arweave
 * via the Turbo bundling service.
 *
 * Policy (front-end):
 *   - Hard cap ~1M px: anything larger is downscaled (area-preserving sqrt
 *     scale, high-quality smoothing) before encoding.
 *   - Encode WebP:
 *       lossless  when  colorCount < 256
 *                 AND   ORIGINAL size < 0.25M px
 *                 AND   the lossless encode is <= FREE_TIER_BUDGET_BYTES
 *       lossy     otherwise (quality ladder 80 → 50, stopping at the first
 *                 result within budget; the smallest result is used if none
 *                 fits).
 *
 * The 99 kB budget keeps the signed ANS-104 data item under Turbo's
 * "free uploads under 100 KiB" threshold (102,400 bytes) with headroom for
 * the ~1.3 kB signature/tags overhead — uploads within budget cost 0 credits.
 *
 * Upload goes through the Cloudflare Worker (which holds the Turbo signing
 * key); retrieval goes through the Turbo gateway.
 */

import { default as encodeWebp } from '@jsquash/webp/encode';

// ── Tunables ─────────────────────────────────────────────────────────────
export const MAX_PIXELS = 1_000_000;            // ~1M px front-end cap
export const LOSSLESS_MAX_PIXELS = 250_000;     // 0.25M px, measured on the ORIGINAL
export const LOSSLESS_MAX_COLORS = 256;         // strictly fewer than 256 distinct RGBA
export const FREE_TIER_BUDGET_BYTES = 99_000;   // ≤ 99 kB payload (Turbo free tier is < 100 KiB per data item)
const LOSSY_QUALITY_LADDER = [80, 70, 60, 50];

// The deployed Cloudflare Worker (see arweave-image-worker.js + ARWEAVE_IMAGES.md)
export const ARWEAVE_UPLOAD_ENDPOINT = 'https://pixagram-arweave-images.p1x4.workers.dev/';
// Instant-retrieval gateway — Turbo's dataCaches/fastFinalityIndexes host.
// (arweave.net and other ar.io gateways also serve the id once it propagates.)
export const TURBO_GATEWAY = 'turbo-gateway.com';

// Same tuned parameter set as encodeImage.js — preserves exact pixel colors
// and sharp edges for pixel art.
const LOSSLESS_PARAMS = {
    quality: 0, target_size: 0, target_PSNR: 0,
    method: 6, sns_strength: 100,
    filter_strength: 0, filter_sharpness: 0, filter_type: 0,
    partitions: 0, segments: 4, pass: 6, show_compressed: 0,
    preprocessing: 0, autofilter: 1, partition_limit: 0,
    alpha_compression: 1, alpha_filtering: 0, alpha_quality: 100,
    lossless: 1, exact: 1, image_hint: 1,
    emulate_jpeg_size: 0, thread_level: 0, low_memory: 0,
    near_lossless: 100, use_delta_palette: 1, use_sharp_yuv: 0,
};

// ── Helpers ──────────────────────────────────────────────────────────────
function createCanvas(width, height) {
    if (typeof OffscreenCanvas !== 'undefined') {
        return new OffscreenCanvas(width, height);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

function computeRatio(width, height, maxPixels) {
    const scale = Math.sqrt(maxPixels / (width * height));
    return Math.min(scale, 1);
}

/**
 * Count distinct RGBA colors, stopping as soon as `limit` is reached —
 * we only care whether the image stays under LOSSLESS_MAX_COLORS.
 */
export function countColorsUpTo(imageData, limit) {
    const pixels = new Uint32Array(
        imageData.data.buffer,
        imageData.data.byteOffset,
        imageData.data.length >> 2
    );
    const seen = new Set();
    for (let i = 0; i < pixels.length; i++) {
        seen.add(pixels[i]);
        if (seen.size >= limit) return limit;
    }
    return seen.size;
}

/**
 * Normalize File | Blob | ImageData | ImageBitmap into
 * { imageData, originalWidth, originalHeight }, applying the 1M px cap.
 * The ORIGINAL dimensions (pre-cap) are what the lossless size rule uses.
 */
async function toCappedImageData(input) {
    let bitmap = null;
    let sourceWidth, sourceHeight;
    let sourceImageData = null;

    if (typeof ImageData !== 'undefined' && input instanceof ImageData) {
        sourceImageData = input;
        sourceWidth = input.width;
        sourceHeight = input.height;
    } else if (typeof ImageBitmap !== 'undefined' && input instanceof ImageBitmap) {
        bitmap = input;
        sourceWidth = bitmap.width;
        sourceHeight = bitmap.height;
    } else {
        bitmap = await createImageBitmap(input); // File / Blob
        sourceWidth = bitmap.width;
        sourceHeight = bitmap.height;
    }

    const ratio = computeRatio(sourceWidth, sourceHeight, MAX_PIXELS);
    const width = Math.max(1, Math.floor(sourceWidth * ratio));
    const height = Math.max(1, Math.floor(sourceHeight * ratio));

    // Already ImageData and within the cap: use as-is, no canvas round-trip.
    if (sourceImageData && ratio >= 1) {
        return { imageData: sourceImageData, originalWidth: sourceWidth, originalHeight: sourceHeight };
    }

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    // Photographic downscale: smoothing ON. Pixel art never reaches this
    // resize in practice (the lossless branch requires < 0.25M px, where
    // ratio is 1 and the source is passed through untouched).
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (sourceImageData) {
        const src = createCanvas(sourceWidth, sourceHeight);
        src.getContext('2d').putImageData(sourceImageData, 0, 0);
        ctx.drawImage(src, 0, 0, width, height);
    } else {
        ctx.drawImage(bitmap, 0, 0, width, height);
        if (input !== bitmap) bitmap.close();
    }

    return {
        imageData: ctx.getImageData(0, 0, width, height),
        originalWidth: sourceWidth,
        originalHeight: sourceHeight,
    };
}

async function encodeToBlob(imageData, params) {
    const buffer = await encodeWebp(imageData, params);
    return new Blob([buffer], { type: 'image/webp' });
}

// ── Policy encode ────────────────────────────────────────────────────────
/**
 * @param {File|Blob|ImageData|ImageBitmap} input
 * @returns {Promise<{blob: Blob, bytes: number, width: number, height: number,
 *                    originalWidth: number, originalHeight: number,
 *                    lossless: boolean, colorCount: number|null,
 *                    withinFreeBudget: boolean}>}
 */
export async function encodeImageForArweave(input) {
    const { imageData, originalWidth, originalHeight } = await toCappedImageData(input);
    const originalPixels = originalWidth * originalHeight;

    let colorCount = null;

    // Lossless attempt: small original + limited palette (pixel art profile)
    if (originalPixels < LOSSLESS_MAX_PIXELS) {
        colorCount = countColorsUpTo(imageData, LOSSLESS_MAX_COLORS);
        if (colorCount < LOSSLESS_MAX_COLORS) {
            const blob = await encodeToBlob(imageData, LOSSLESS_PARAMS);
            if (blob.size <= FREE_TIER_BUDGET_BYTES) {
                return {
                    blob, bytes: blob.size,
                    width: imageData.width, height: imageData.height,
                    originalWidth, originalHeight,
                    lossless: true, colorCount, withinFreeBudget: true,
                };
            }
            // Lossless came out too big → fall through to lossy.
        }
    }

    // Lossy ladder: first quality that fits the free budget, else smallest.
    let best = null;
    for (const quality of LOSSY_QUALITY_LADDER) {
        const blob = await encodeToBlob(imageData, { lossless: 0, quality });
        if (!best || blob.size < best.size) best = blob;
        if (blob.size <= FREE_TIER_BUDGET_BYTES) { best = blob; break; }
    }

    return {
        blob: best, bytes: best.size,
        width: imageData.width, height: imageData.height,
        originalWidth, originalHeight,
        lossless: false, colorCount,
        withinFreeBudget: best.size <= FREE_TIER_BUDGET_BYTES,
    };
}

// ── Upload + retrieval ───────────────────────────────────────────────────
export function arweaveImageUrl(id, gateway = TURBO_GATEWAY) {
    return `https://${gateway}/${id}`;
}

/**
 * POST the encoded WebP to the Cloudflare Worker, which validates it and
 * signs/pays the Turbo upload with the server-held key.
 *
 * `headers` is where the caller's auth goes — the same posting-key-signature
 * headers the image host uses, or an x-upload-token during development.
 */
export async function uploadImageToArweave(blob, { endpoint = ARWEAVE_UPLOAD_ENDPOINT, headers = {} } = {}) {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'image/webp', ...headers },
        body: blob,
    });
    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Arweave upload failed (${response.status}): ${detail}`);
    }
    return response.json(); // { id, url, bytes, winc }
}

/**
 * Convenience: encode per policy, upload, return everything the editor needs.
 * The returned `url` is what goes into the ImageNode / markdown.
 */
export async function storeImageOnArweave(input, options = {}) {
    const encoded = await encodeImageForArweave(input);
    const uploaded = await uploadImageToArweave(encoded.blob, options);
    return {
        id: uploaded.id,
        url: uploaded.url || arweaveImageUrl(uploaded.id),
        bytes: encoded.bytes,
        width: encoded.width,
        height: encoded.height,
        lossless: encoded.lossless,
        withinFreeBudget: encoded.withinFreeBudget,
    };
}
