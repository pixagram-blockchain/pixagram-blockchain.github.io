import {generate, transform} from "./AI";
import { analyze_colors, downscale_rgba, WasmDownscaleConfig, downscale_prepared, prepare_rgba } from 'smart-downscaler';

// Function to smooth the image data
function smoothImageData(imageData) {
    "use strict";
    const { width, height, data } = imageData;
    const pixels = new Uint32Array(data.buffer);

    function getColor (x, y, pxls, w) { "use strict"; return pxls[y * w + x | 0] }
    function setColor (x, y, color, pxls, w) { "use strict"; pxls[y * w + x | 0] = color >>> 0; }

    let currentColor = 0, colorCount = {}, neighbors = new Uint32Array(8), color = 0;
    for (let y = 1; y < height - 1; y = y+1|0) {
        for (let x = 1; x < width - 1; x = x+1|0) {
            colorCount = {};
            currentColor = getColor(x, y, pixels, width);
            neighbors[0] = getColor(x - 1, y - 1, pixels, width);
            neighbors[1] = getColor(x, y - 1, pixels, width);
            neighbors[2] = getColor(x + 1, y - 1, pixels, width);
            neighbors[3] = getColor(x - 1, y, pixels, width);
            neighbors[4] = getColor(x + 1, y, pixels, width);
            neighbors[5] = getColor(x - 1, y + 1, pixels, width);
            neighbors[6] = getColor(x, y + 1, pixels, width);
            neighbors[7] = getColor(x + 1, y + 1, pixels, width);

            for(var i = 0; i < 8; i++){
                color = neighbors[i];
                colorCount[color] = (colorCount[color] || 0) + 1;
                if(i >= 5 && colorCount[color] >= 6) {
                    setColor(x, y, color, pixels, width);
                }
            }
        }
    }

    const outputData = new Uint8ClampedArray(pixels.buffer);
    return new ImageData(outputData, width, height);
}

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

export const isArtworkPixelart = async function(file, maxWidth, maxHeight, maxColor) {
    maxWidth = parseInt(maxWidth);
    maxHeight = parseInt(maxHeight);

    const maxPixels = maxWidth * maxHeight;
    const bitmap = await createImageBitmap(file);
    const ratio = computeRatio(bitmap.width, bitmap.height, maxPixels);


    if(ratio > 1.00){ return false; }

    const canvas = createCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");
    setContextPixelated(context);
    context.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);
    bitmap.close();
    const imgd = context.getImageData(0, 0, canvas.width, canvas.height);
    const r = analyze_colors(imgd.data, maxColor, "frequency");

    return Boolean(ratio <= 1.00 && r?.color_count < maxColor) ? imgd: false;
}

// Build the downscaler config. Preprocess + segmentation settings here must be
// identical between prepare() and downscale_prepared() (they define the prepared image).
function buildDownscaleConfig(colors) {
    const config = new WasmDownscaleConfig();
    config.palette_size = colors;
    config.palette_strategy = 'medoid';          // exact source colors; try 'oklab' to let color_rarity/detail_boost shape the palette too
    config.segmentation_method = "hierarchy_fast";
    config.two_pass_refinement = true;
    config.region_weight = 0.15;
    config.neighbor_weight = 0.15;                // lowered from 0.24 — less erosion of thin features (lips, eyes)
    config.max_resolution_mp = 1.25;             // (prepare-time) resolution cap
    config.max_color_preprocess = 16384;           // (prepare-time) color pre-quantization
    config.k_centroid = 4;                        // "Salient" — keep colorful minorities in mixed tiles (was 2=Dominant)
    config.k_centroid_iterations = 2;

    // Rare / important color preservation (lips, eyes, highlights):
    config.reserve_colors = Math.max(2, Math.round(colors / 8)); // hard guarantee: 32→4, 48→6, 64→8 slots
    config.detail_boost = 0.8;                    // saliency weighting toward detail-rich colors (replaces the previously-inert edge_weight)
    config.color_rarity = 0.35;                   // damp frequency vote so large flat areas don't monopolize the palette

    // NEW — restore saturation lost when colors merge, and isolate skin tones:
    config.chroma_recovery = 0.6;                 // push palette colors back toward source mean chroma (perceptual, gamut-clamped)
    config.skin_protection = 0.5;                 // extract skin vs non-skin in separate domains so they never merge

    return config;
}

// Output (target) dimensions for a given max-size, from the ORIGINAL image dims.
function targetDims(origWidth, origHeight, size) {
    const ratio = computeRatio(origWidth, origHeight, size * size);
    return [Math.round(origWidth * ratio), Math.round(origHeight * ratio)];
}

// One-shot path: preprocess + downscale in a single call (used by quantizeImageData
// and any caller that doesn't reuse a prepared image).
function generateScaledImageData(options, imgd, fast = false) {
    const [newWidth, newHeight] = targetDims(imgd.width, imgd.height, options.size);
    const config = buildDownscaleConfig(options.colors);

    const result = downscale_rgba(
        imgd.data,
        imgd.width,
        imgd.height,
        newWidth,
        newHeight,
        config
    );

    return new ImageData(result.data, result.width, result.height);
}

// Reuse path: downscale from an already-prepared image. Preprocessing + segmentation
// were computed ONCE in prepare_rgba; here we only run palette + tiling per size.
function generateScaledFromPrepared(options, prepared, origWidth, origHeight) {
    const [newWidth, newHeight] = targetDims(origWidth, origHeight, options.size);
    const config = buildDownscaleConfig(options.colors);

    const result = downscale_prepared(
        prepared,
        newWidth,
        newHeight,
        config
    );

    return new ImageData(result.data, result.width, result.height);
}

// Export the generateScaledImageData function for use in quantization
export { generateScaledImageData };

// Main function to process the image file
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
                                                style = "retroart") {

    const outputSizes = [
        { name: "S", size: 160, colors: 48 },
        { name: "M" ,size: 192, colors: 52 },
        { name: "L" ,size: 224, colors: 56 },
        { name: "XL" ,size: 256, colors: 60 },
        { name: "XXL" ,size: 320, colors: 64 },
    ];

    const continue_it = async (blob, title) => {
        const maxPixels = maxWidth * maxHeight;
        const bitmap = await createImageBitmap(blob, {resizeQuality: "pixelated"});
        const ratio = computeRatio(bitmap.width, bitmap.height, maxPixels);

        const resizedWidth = parseInt(Math.round(bitmap.width * ratio));
        const resizedHeight = parseInt(Math.round(bitmap.height * ratio));

        const canvasOriginal = createCanvas(resizedWidth, resizedHeight);
        const contextOriginal = canvasOriginal.getContext("2d");
        setContextPixelated(contextOriginal);
        contextOriginal.drawImage(bitmap, 0, 0, canvasOriginal.width, canvasOriginal.height);
        bitmap.close();

        const imagedataOriginal = contextOriginal.getImageData(0, 0, canvasOriginal.width, canvasOriginal.height);
        const imagedata = new ImageData(new Uint8ClampedArray(imagedataOriginal.data.buffer), imagedataOriginal.width, imagedataOriginal.height);
        const cachedBuffer = imagedata;

        // Prepare ONCE: resolution capping, color pre-quantization, and segmentation
        // are independent of the target size, so we compute them a single time and
        // reuse the handle across all preview sizes. palette_size in this config is
        // irrelevant for prepare (only preprocess + segmentation settings matter).
        const prepared = prepare_rgba(
            cachedBuffer.data,
            cachedBuffer.width,
            cachedBuffer.height,
            buildDownscaleConfig(2048)
        );
        const origWidth = cachedBuffer.width;
        const origHeight = cachedBuffer.height;

        // Create a preview generator function that can be called on-demand
        const generatePreview = (sizeName) => {
            const sizeConfig = outputSizes.find(s => s.name === sizeName);
            if (!sizeConfig) {
                throw new Error(`Unknown size: ${sizeName}`);
            }

            return generateScaledFromPrepared(sizeConfig, prepared, origWidth, origHeight);
        };

        // Create a batch generator for preloading
        const generateAllPreviews = async (progressCallback) => {
            const previews = {};
            for (let i = 0; i < outputSizes.length; i++) {
                const size = outputSizes[i];
                previews[size.name] = generateScaledFromPrepared(size, prepared, origWidth, origHeight);
                if (progressCallback) {
                    progressCallback(size.name, i + 1, outputSizes.length);
                }
            }
            return previews;
        };

        // Frees the prepared image's WASM memory. Optional — wasm-bindgen also frees
        // on GC — but call it when you're done generating previews to release sooner.
        const disposePrepared = () => {
            try { prepared.free(); } catch (e) { /* already freed / GC'd */ }
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
            canvasWidth: canvasOriginal.width,
            canvasHeight: canvasOriginal.height,
            cachedBuffer, // Store the buffer for future use
            prompt: title || ""
        };
    }

    if(typeof file === "undefined" && typeof description === "string") {

        return generate(description, ratio, steps, callback, callback2).then((blob, title) => continue_it(blob, title));

    }else if(use_ai){
        try {
            return transform(file, steps, fidelity, callback, callback2, description, style).then((blob, title) => continue_it(blob, title));
        } catch (e) {
            return continue_it(file, "");
        }
    } else {
        return continue_it(file, "");
    }
};

// Custom quantization function that can be called from the component.
//
// `inputBuffer` is an ImageData (the converter's cachedBuffer, or the pixel-art
// probe's ImageData when the upload skipped the converter). Target dimensions
// are an exact per-axis division so that an "Nx" downscale of artwork that was
// enlarged Nx lands back on its native pixel grid (e.g. 400×200 at 4x →
// 100×50). The previous implementation routed through the size²-area heuristic
// of generateScaledImageData, which is only exact for square images (400×200
// at 4x came out 141×71).
//
// The first parameter is kept for call-site compatibility but is no longer
// read: the authoritative dimensions are inputBuffer's own.
export const quantizeImageData = function(canvas, inputBuffer, downscaleRatio, numColors) {
    const newWidth = Math.max(1, Math.round(inputBuffer.width / downscaleRatio));
    const newHeight = Math.max(1, Math.round(inputBuffer.height / downscaleRatio));

    const result = downscale_rgba(
        inputBuffer.data,
        inputBuffer.width,
        inputBuffer.height,
        newWidth,
        newHeight,
        buildDownscaleConfig(numColors)
    );

    return new ImageData(result.data, result.width, result.height);
};