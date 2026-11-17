import {generate, transform, describeGenerate, describeTransform} from "./AI";
import { NO_AI } from "../ai_provenance";
import * as sd from 'smart-downscaler/bundler';
sd.init();
import { isHeic, probe, toFile, init as initHeic, resetWasm as resetHeicWasm } from "@pixagram/heic";

// Function to compute the new scaling ratio
function computeRatio(originalWidth, originalHeight, maxPixels) {
    "use strict";
    const originalPixels = originalWidth * originalHeight;
    let scale = Math.sqrt(maxPixels / originalPixels);
    return Math.min(scale, 1); // Ensure the scale does not increase the image size
}

// Function to create an OffscreenCanvas or fallback to document canvas
function createCanvas(width, height) {
    "use strict";
    let canvas;
    try {
        if (typeof OffscreenCanvas !== "undefined") {
            canvas = new OffscreenCanvas(width, height);
        } else {
            throw new Error("OffscreenCanvas not supported");
        }
    } catch (e) {
        canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
    }
    return canvas;
}

function setContextPixelated(ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;
}

// ── Mobile canvas limits ────────────────────────────────────────────────
// iOS Safari refuses any canvas larger than 16,777,216 px (4096×4096):
// getContext() returns null. A default iPhone 15 Pro / 16 photo is 24 MP
// (48 MP in full-resolution mode), so the probe used to crash right there
// ("Cannot set property imageSmoothingEnabled of null") and the wizard never
// got past step 1. Android has no hard cap, but a full-size 50–200 MP photo
// read back as RGBA and copied into WASM memory can run the tab out of memory.
const MAX_SAFE_CANVAS_PIXELS = 16777216;
// Area of the cheap colour pre-check (≈1 MP).
const PROBE_SAMPLE_PIXELS = 1024 * 1024;

// Free a canvas's backing store right away. Safari also caps the TOTAL
// memory of live canvases (~384 MB) and only reclaims them on GC, so a few
// retries with big photos could otherwise exhaust it.
function releaseCanvas(canvas) {
    try { canvas.width = 0; canvas.height = 0; } catch (e) { /* ignore */ }
}

function get2dContext(canvas) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
        throw new Error(`Canvas 2D context unavailable (${canvas.width}×${canvas.height} may exceed this device's limit)`);
    }
    return ctx;
}

// Draw `bitmap` at w×h with nearest-neighbour sampling and read it back.
// Nearest-neighbour never invents colours: every sampled pixel is a pixel
// of the source.
function readPixels(bitmap, w, h) {
    const canvas = createCanvas(w, h);
    try {
        const ctx = get2dContext(canvas);
        setContextPixelated(ctx);
        ctx.drawImage(bitmap, 0, 0, w, h);
        return ctx.getImageData(0, 0, w, h);
    } finally {
        releaseCanvas(canvas);
    }
}

// True as soon as `data` holds `limit` distinct colours (early exit, so a
// photo is rejected after a few hundred pixels). Fully transparent pixels
// all count as one colour whatever their RGB.
function hasAtLeastColors(data, limit) {
    const px = new Uint32Array(data.buffer, data.byteOffset, data.byteLength >> 2);
    const seen = new Set();
    for (let i = 0; i < px.length; i++) {
        const v = px[i];
        seen.add((v >>> 24) === 0 ? 0 : v);
        if (seen.size >= limit) return true;
    }
    return false;
}

// Exact colour count for the final decision, with the same semantics as
// smart-downscaler's analyze_colors(data, limit, ...).color_count, which it
// replaces: colours are keyed by RGB (alpha ignored, transparent pixels
// included) and the count stops at `limit`. Counting in JS keeps the
// full-resolution pixels out of the smart-downscaler WebAssembly heap, which
// grows to the largest image it is handed and never shrinks.
function countColorsUpTo(data, limit) {
    const seen = new Set();
    for (let i = 0; i < data.length; i += 4) {
        seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
        if (seen.size >= limit) break;
    }
    return seen.size;
}

// ── Shrink-on-load ──────────────────────────────────────────────────────
// createImageBitmap(blob) decodes the whole photo: 24 MP is ~98 MB of RGBA,
// 48 MP ~195 MB, 200 MP ~800 MB, which is enough to kill a phone's tab.
// When the target size is known, decodeBitmap() asks the browser for the
// bitmap already shrunk (resizeWidth), so the full-size pixels are never
// kept and, where the decoder supports it (JPEG in Chromium), never produced.
//
// Each step falls back to the previous behaviour: no size → full decode;
// resize options rejected → full decode; options silently ignored → a
// full-size bitmap that callers downscale with drawImage exactly as before.

// Display size of an image file, read through an off-screen <img>. Browsers
// only parse the header for `load`; the pixels are decoded lazily at paint
// time, and this <img> is never painted. naturalWidth/Height already account
// for EXIF orientation. Resolves null where there is no DOM (worker) or the
// file can't be read.
function getImageSize(blob) {
    if (!(blob instanceof Blob) || typeof Image === "undefined" || typeof URL === "undefined" || !URL.createObjectURL) {
        return Promise.resolve(null);
    }
    const url = URL.createObjectURL(blob);
    return new Promise((resolve) => {
        const img = new Image();
        const done = (size) => {
            img.onload = img.onerror = null;
            try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
            resolve(size);
        };
        img.onload = () => done(img.naturalWidth > 0 && img.naturalHeight > 0
            ? { width: img.naturalWidth, height: img.naturalHeight }
            : null);
        img.onerror = () => done(null);
        img.src = url;
    });
}

// Decode `blob` so that its area is at most `maxPixels`, keeping the aspect
// ratio. Only the width is requested, so the browser derives the height
// itself and the picture can't come out stretched (if browser and <img> ever
// disagreed on EXIF rotation, the result would only be somewhat smaller than
// asked, never distorted).
async function decodeBitmap(blob, maxPixels, resizeQuality = "pixelated") {
    const size = await getImageSize(blob);
    if (size) {
        const scale = computeRatio(size.width, size.height, maxPixels);
        if (scale < 1) {
            try {
                return await createImageBitmap(blob, {
                    resizeWidth: Math.max(1, Math.round(size.width * scale)),
                    resizeQuality
                });
            } catch (e) {
                // resize options unsupported here: plain decode below
            }
        }
    }
    return createImageBitmap(blob, { resizeQuality });
}

// True when `bitmap` (any size) shows at least `limit` colours on a ≤1 MP
// nearest-neighbour sample. NN sampling never invents colours, so "true"
// proves the source has at least that many.
function sampleHasManyColors(bitmap, limit) {
    const { width, height } = bitmap;
    const s = Math.min(1, Math.sqrt(PROBE_SAMPLE_PIXELS / (width * height)));
    const sample = readPixels(
        bitmap,
        Math.max(1, Math.round(width * s)),
        Math.max(1, Math.round(height * s))
    );
    return hasAtLeastColors(sample.data, limit);
}

const isJpeg = (file) => /^image\/(jpe?g|pjpeg)$/i.test(file?.type || "");

// Resolves with the full-resolution ImageData when the upload is already
// pixel art (fewer than `maxColor` colours), otherwise with false.
//
// maxWidth / maxHeight are kept for call-site compatibility. As before they
// don't cap anything: computeRatio() never returns more than 1, so the old
// `ratio > 1` early-out could never fire and large upscaled pixel art has
// always been accepted at its full size. That behaviour is unchanged.
export const isArtworkPixelart = async function(file, maxWidth, maxHeight, maxColor) {
    file = await normalizeUpload(file); // HEIC → JPEG/PNG; createImageBitmap cannot decode HEIC outside Safari

    // 0. Phone photos are JPEG (HEIC is normalized to JPEG): judge them on
    //    a copy decoded directly at ≤1 MP, so a big photo is never decoded at
    //    full size just to learn it isn't pixel art. Lossless formats (PNG,
    //    GIF, WebP — where pixel art lives) skip this: a browser that ignores
    //    resizeQuality could blend block edges into extra colours there.
    if (isJpeg(file)) {
        const small = await decodeBitmap(file, PROBE_SAMPLE_PIXELS);
        try {
            if (sampleHasManyColors(small, maxColor)) return false;
        } finally {
            small.close();
        }
    }

    const bitmap = await createImageBitmap(file);

    try {
        const { width, height } = bitmap;
        const area = width * height;

        // 1. Cheap pre-check on a ≤1 MP nearest-neighbour sample (already done
        //    above for JPEG; cheap to repeat for the rare few-colour JPEG).
        if (area > PROBE_SAMPLE_PIXELS && sampleHasManyColors(bitmap, maxColor)) return false;

        // 2. Few colours: possibly pixel art. The full-resolution pixels are
        //    needed (they become the post), but only when the device can hold
        //    them. A > 16.7 MP image with so few colours is vanishingly rare;
        //    it simply takes the regular path, which downsizes to ≤ 2560 px.
        if (area > MAX_SAFE_CANVAS_PIXELS) return false;

        const imgd = readPixels(bitmap, width, height);
        return countColorsUpTo(imgd.data, maxColor) < maxColor ? imgd : false;
    } finally {
        bitmap.close();
    }
}

// Build a configuration. Every binding call consumes the object it is given,
// so a fresh one is built per call.
//
// The same options must be used for prepare_rgba() and downscale_prepared():
// quality, engine, the resolution / colour limits, alpha handling and
// exact-colour mode are baked into the prepared image. `colors` may differ
// freely between calls (and is irrelevant for prepare).
function buildDownscaleConfig(colors = 256) {
    const config = sd.WasmDownscaleConfig.fast();   // PAX engine, automatic compensation
    // 'medoid': every output colour is a colour of the source (no compensation,
    // no colour reduction, nearest-neighbour resolution cap).
    if (colors !== undefined) {
        config.palette_size = colors;           // 1–256; out-of-range values are clamped by the library
    }
    return config;
}

// Copy a binding result into an ImageData and release its WebAssembly memory
// right away (wasm-bindgen would only free it at garbage collection).
function takeImageData(result) {
    try {
        return new ImageData(result.data, result.width, result.height);
    } finally {
        result.free();
    }
}

// Output (target) dimensions for a given max-size, from the ORIGINAL image dims.
function targetDims(origWidth, origHeight, size) {
    const ratio = computeRatio(origWidth, origHeight, size * size);
    return [Math.max(1, Math.round(origWidth * ratio)), Math.max(1, Math.round(origHeight * ratio))];
}

// One-shot path: prepare + downscale in a single call (for callers that don't
// reuse a prepared image). `fast` selects the "fast" quality mode; it used to
// be accepted and ignored.
function generateScaledImageData(options, imgd, fast = false) {
    const [newWidth, newHeight] = targetDims(imgd.width, imgd.height, options.size);

    return takeImageData(sd.downscale(
        imgd.data,
        imgd.width,
        imgd.height,
        newWidth,
        newHeight,
        buildDownscaleConfig(options.colors)
    ));
}

// Reuse path: downscale from an already-prepared image. The size-independent
// work (resolution cap, conversion to the working colour space, structural
// analysis) was done ONCE in prepare_rgba; here only extraction, palette and
// assignment run per size.
function generateScaledFromPrepared(options, prepared, origWidth, origHeight) {
    const [newWidth, newHeight] = targetDims(origWidth, origHeight, options.size);

    return takeImageData(sd.downscale_prepared(
        prepared,
        newWidth,
        newHeight,
        buildDownscaleConfig(options.colors)
    ));
}

// Export the generateScaledImageData function for use in quantization
export { generateScaledImageData };

// Let the browser handle input and paint between two long synchronous steps.
const yieldToBrowser = () => new Promise((resolve) => setTimeout(resolve, 0));

// Normalize an upload to a browser-decodable file, converting HEIC exactly once.
//
// An upload reaches three consumers before continue_it: the preview <img>
// (object URL), createImageBitmap in isArtworkPixelart, and transform(), which
// sends the bytes to the AI server as-is. Chrome and Firefox decode HEIC in
// none of them and neither does the AI, so an iPhone HEIC is converted here,
// up front, with @pixagram/heic, and everything downstream keeps seeing a
// standard image. PNG when the source carries alpha, otherwise JPEG at q=0.92:
// the picture is downscaled to ≤2560 px and palette-quantized afterwards, so
// that quality is invisible in the result while keeping the AI upload small.
//
// Non-HEIC uploads pass through untouched (272-byte sniff; the decoder wasm is
// never loaded). Memoized per File object so the probe and the pipeline share
// one decode when both are handed the same upload.
//
// Memory: the decoder's WebAssembly heap grows to the largest photo decoded
// (a 12 MP iPhone photo is 46.5 MiB of RGBA, plus input and YUV planes) and
// never shrinks. Once no conversion is running, the instance is dropped and a
// small fresh one is created: resetHeicWasm() alone only forgets the loader's
// promise, while the wasm-bindgen glue keeps the old instance until init()
// replaces it. The counter keeps a reset from landing in the middle of a
// second conversion (a handle freed after re-init would corrupt the new one).
const normalizedUploads = new WeakMap();
let heicJobs = 0;
const releaseHeicMemory = () => {
    if (--heicJobs > 0) return;
    resetHeicWasm();
    initHeic().catch(() => {}); // a failure here only means the next upload loads it again
};
export const normalizeUpload = async function(file) {
    if (!(file instanceof Blob) || !(await isHeic(file))) { return file; }
    let converted = normalizedUploads.get(file);
    if (!converted) {
        heicJobs++;
        converted = probe(file).then((info) => toFile(file, info.hasAlpha
            ? { type: "image/png" }
            : { type: "image/jpeg", quality: 0.92 }))
            .finally(releaseHeicMemory);
        normalizedUploads.set(file, converted);
        converted.catch(() => normalizedUploads.delete(file)); // a retry reruns the conversion
    }
    return converted;
};

// Main function to process the image file
// style: the AI LoRA ("retroart" | "lucasart" | "vga" | "homm"); turbo: one
// 768 px tile instead of the 1280 px pass (~4x faster). Both only matter when
// use_ai is set.
//
// The result's `ai` says which branch below ran, { type, model }, which the
// post's AI disclosure is pre-filled from (utils/ai_provenance.js):
// describeGenerate() for text to image, describeTransform(style) for image
// to image, NO_AI otherwise. It follows the branch, not the caller's intent:
// a description with a picture is a transformation of that picture,
// whichever tab asked for it.
export const processImageFile = async function ({file, description},
                                                maxWidth,
                                                maxHeight,
                                                paletteColors,
                                                callback,
                                                callback2,
                                                use_ai,
                                                ratio = "1:1",
                                                steps = 8,
                                                fidelity=0.8,
                                                style = "retroart",
                                                turbo = false) {

    const outputSizes = [
        { name: "S", size: 160, colors: 48 },
        { name: "M" ,size: 192, colors: 52 },
        { name: "L" ,size: 224, colors: 56 },
        { name: "XL" ,size: 256, colors: 60 },
        { name: "XXL" ,size: 320, colors: 64 },
    ];

    const continue_it = async (blob, title, ai = NO_AI) => {
        const maxPixels = maxWidth * maxHeight;

        // Decoded already shrunk to ≤ maxWidth×maxHeight px of area (see
        // decodeBitmap): a 24–200 MP phone photo is never held at full size.
        // The drawImage below still finishes the job if the browser ignored
        // the resize request.
        const bitmap = await decodeBitmap(blob, maxPixels, "pixelated");
        const scale = computeRatio(bitmap.width, bitmap.height, maxPixels);

        const resizedWidth = Math.round(bitmap.width * scale);
        const resizedHeight = Math.round(bitmap.height * scale);

        const canvasOriginal = createCanvas(resizedWidth, resizedHeight);
        const canvasWidth = canvasOriginal.width;
        const canvasHeight = canvasOriginal.height;
        let imagedataOriginal;
        try {
            const contextOriginal = get2dContext(canvasOriginal);
            setContextPixelated(contextOriginal);
            contextOriginal.drawImage(bitmap, 0, 0, canvasWidth, canvasHeight);
            imagedataOriginal = contextOriginal.getImageData(0, 0, canvasWidth, canvasHeight);
        } finally {
            bitmap.close();
            // The pixels now live in imagedataOriginal; free the canvas
            // instead of waiting for GC (Safari's total canvas budget).
            releaseCanvas(canvasOriginal);
        }
        // A second ImageData over the SAME pixel buffer (no copy: a 2560 px
        // picture is 26 MB). Nothing here writes to it — the downscaler only
        // reads its input — but a caller that edits one in place edits both.
        const imagedata = new ImageData(new Uint8ClampedArray(imagedataOriginal.data.buffer), imagedataOriginal.width, imagedataOriginal.height);
        const cachedBuffer = imagedata;
        const origWidth = cachedBuffer.width;
        const origHeight = cachedBuffer.height;

        // Prepare ONCE: resolution cap, alpha handling, conversion to the working
        // colour space and structural analysis don't depend on the target size or
        // the palette, so they are computed a single time and the handle is reused
        // for every preview. The pixels are copied into WebAssembly memory here;
        // cachedBuffer is not referenced by the handle afterwards.
        let prepared = sd.prepare(
            cachedBuffer.data,
            origWidth,
            origHeight,
            buildDownscaleConfig(16192)
        );
        const livePrepared = () => {
            if (!prepared) {
                throw new Error("Previews are no longer available: disposePrepared() was called");
            }
            return prepared;
        };

        // Create a preview generator function that can be called on-demand
        const generatePreview = (sizeName) => {
            const sizeConfig = outputSizes.find(s => s.name === sizeName);
            if (!sizeConfig) {
                throw new Error(`Unknown size: ${sizeName}`);
            }

            return generateScaledFromPrepared(sizeConfig, livePrepared(), origWidth, origHeight);
        };

        // Create a batch generator for preloading. Each size is one synchronous
        // WebAssembly call (0.1–0.3 s); the browser gets a turn between two of
        // them, so the progress callback's update can actually be painted. If
        // disposePrepared() is called meanwhile, the sizes done so far are returned.
        const generateAllPreviews = async (progressCallback) => {
            const previews = {};
            for (let i = 0; i < outputSizes.length; i++) {
                if (!prepared) { break; }
                if (i > 0) {
                    await yieldToBrowser();
                    if (!prepared) { break; }
                }
                const size = outputSizes[i];
                previews[size.name] = generateScaledFromPrepared(size, prepared, origWidth, origHeight);
                if (progressCallback) {
                    progressCallback(size.name, i + 1, outputSizes.length);
                }
            }
            return previews;
        };

        // Frees the prepared image's WASM memory (≈ 13 MB for a 1 MP working
        // image). Optional — wasm-bindgen also frees on GC — but call it when
        // you're done generating previews to release sooner. Safe to call twice.
        const disposePrepared = () => {
            const handle = prepared;
            prepared = null;
            if (handle) {
                try { handle.free(); } catch (e) { /* already freed / GC'd */ }
            }
        };

        return {
            artwork: imagedataOriginal,
            originalImageData: imagedataOriginal, // Store original for comparison
            processedCanvasData: imagedata, // Store the intermediate canvas data
            availableSizes: outputSizes.map(s => s.name),
            sizeConfigs: outputSizes,
            generatePreview, // Function to generate a single preview on-demand
            generateAllPreviews, // Function to generate all previews
            disposePrepared, // Call when finished to release the prepared image early
            canvasWidth,
            canvasHeight,
            cachedBuffer, // Store the buffer for future use
            prompt: title || "",
            ai // What made the picture: { type, model }
        };
    }

    // Both branches below need a decodable file: transform() uploads it to the
    // AI as-is and continue_it hands it to createImageBitmap. Memoized, so an
    // upload already normalized by the caller (or by isArtworkPixelart) is free.
    if (file instanceof Blob) { file = await normalizeUpload(file); }

    // NOTE (unchanged from the previous version, see the hand-over notes): a
    // promise passes ONE value to then(), so `title` below is undefined unless
    // ./AI resolves with a custom thenable; and the try/catch only sees a
    // synchronous throw of transform(), not a rejected promise.
    if(typeof file === "undefined" && typeof description === "string") {

        return generate(description, ratio, steps, callback, callback2).then((blob, title) => continue_it(blob, title, describeGenerate()));

    }else if(use_ai){
        try {
            return transform(file, steps, fidelity, callback, callback2, description, style, turbo).then((blob, title) => continue_it(blob, title, describeTransform(style)));
        } catch (e) {
            return continue_it(file, "", NO_AI);
        }
    } else {
        return continue_it(file, "", NO_AI);
    }
};

// A picture with at most this many distinct colours is indexed-colour art: a
// palette (256 entries at most) can hold every colour it has.
const INDEXED_ART_MAX_COLORS = 256;

// Custom quantization function that can be called from the component.
//
// `inputBuffer` is an ImageData (the converter's cachedBuffer, or the pixel-art
// probe's ImageData when the upload skipped the converter). Target dimensions
// are an exact per-axis division so that an "Nx" downscale of artwork that was
// enlarged Nx lands back on its native pixel grid (e.g. 400×200 at 4x →
// 100×50).
//
// The first parameter is kept for call-site compatibility but is no longer
// read: the authoritative dimensions are inputBuffer's own.
//
// options.exactColors — build the palette only from colours that exist in the
//   source (what the old 'hue' setting was meant to do). Left undefined, it is
//   decided from the picture: on for indexed-colour art (≤ 256 colours), off
//   for everything else. For pixel art this matters twice: a reduction to
//   fewer colours never invents an in-between shade, and a picture above the
//   working-resolution cap (1 MP, e.g. a 32×32 sprite exported at 40x) is
//   sampled rather than averaged before the reduction. Measured on enlarged
//   sprites of 0.02–4.2 MP reduced back to their native grid with enough
//   colours: identical to the original, pixel for pixel. Without exact colours
//   that only holds up to the cap; above it the structure is still right but
//   colours drift by a few levels (up to 4 of 255 in "balanced", 14 in "fast").
//   For photographs the default (off) gives the better palette.
// options.fast — use the "fast" quality mode (live sliders).
export const quantizeImageData = function(canvas, inputBuffer, downscaleRatio, numColors, { exactColors, fast = false } = {}) {
    if (!(downscaleRatio > 0)) {
        throw new RangeError(`quantizeImageData: downscaleRatio must be a positive number (got ${downscaleRatio})`);
    }
    const newWidth = Math.max(1, Math.round(inputBuffer.width / downscaleRatio));
    const newHeight = Math.max(1, Math.round(inputBuffer.height / downscaleRatio));

    // Photographs leave this loop after a few hundred pixels; indexed art is
    // scanned once (≈ 15 ms per megapixel).
    const exact = exactColors === undefined
        ? countColorsUpTo(inputBuffer.data, INDEXED_ART_MAX_COLORS + 1) <= INDEXED_ART_MAX_COLORS
        : Boolean(exactColors);

    return takeImageData(sd.downscale(
        inputBuffer.data,
        inputBuffer.width,
        inputBuffer.height,
        newWidth,
        newHeight,
        buildDownscaleConfig(numColors)
    ));
};