import { VTracer, resolveOptions } from "@pixagram/vtracer";

/*
 * Raster -> SVG, on top of @pixagram/vtracer.
 *
 * Same exports and call signatures as the vtracer-color version of this file,
 * with these differences in how the work gets done:
 *
 *  - The conversion runs in a worker instead of in 25 ms slices on the main
 *    thread, and nothing is added to the document: no hidden <canvas>, no
 *    hidden <svg>, no element ids.
 *  - Transparency is handled by the tracer: pixels with alpha 0 get no shape.
 *    The black <-> #161616 swap and the '#000000' -> 'transparent' rewrite are
 *    gone, so black stays black and the input ImageData is never modified.
 *  - With output "blob" the SVG never becomes a JS string: its bytes move
 *    from the worker straight into the Blob.
 *  - Markup: paths carry fill="#rrggbb" (not style="fill: ...") and absolute
 *    coordinates (no translate()), and the root has width, height and a
 *    viewBox, so the image scales when drawn larger.
 */

/** Upper bound on tracer workers. They start on demand and stop after 30 s idle. */
const MAX_WORKERS = 2;

const RADIANS_TO_DEGREES = 180 / Math.PI;

/**
 * The settings this module has always used, in @pixagram/vtracer units.
 * vtracer-color took them as:
 *   corner_threshold: 1 / 60, splice_threshold: 1 / 45   (radians)
 *   filter_speckle: 16                                   (an area: 4 x 4 px)
 *   color_precision: 0                                   (bits dropped: 8 kept)
 *
 * hierarchical: vtracer-color's "cutout" re-clustered the image and simplified
 * every shape's closed outline on its own; that is what "stacked" polygons
 * are here (same long straight edges, and no gaps between neighbours because
 * shapes overlap). "cutout" was needed back then so that the shapes rewritten
 * to 'transparent' showed the canvas rather than a lower layer; with real
 * transparency that reason is gone. This engine's "cutout" is a different
 * algorithm (a mosaic with shared borders) that hugs the pixel staircase much
 * more closely - pass { hierarchical: "cutout" } to createConverter for it.
 */
const DEFAULT_OPTIONS = {
    mode: "polygon",
    clustering: "color",
    hierarchical: "stacked",
    cornerThreshold: (1 / 60) * RADIANS_TO_DEGREES,
    lengthThreshold: 6.0,
    maxIterations: 1,
    spliceThreshold: (1 / 45) * RADIANS_TO_DEGREES,
    filterSpeckle: 4,
    colorPrecision: 8,
    layerDifference: 0,
    pathPrecision: 2,
    xmlHeader: false,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Old option names (snake_case, vtracer-color units) -> @pixagram/vtracer.
 * Anything else is passed through, so the new camelCase names work as they are.
 */
const LEGACY_OPTIONS = {
    canvas_id: () => null,
    svg_id: () => null,
    clustering_mode: (v) => ["clustering", v],
    corner_threshold: (v) => ["cornerThreshold", clamp(v * RADIANS_TO_DEGREES, 0, 180)],
    splice_threshold: (v) => ["spliceThreshold", clamp(v * RADIANS_TO_DEGREES, 0, 180)],
    length_threshold: (v) => ["lengthThreshold", v],
    max_iterations: (v) => ["maxIterations", clamp(v, 0, 64)],
    filter_speckle: (v) => ["filterSpeckle", Math.round(Math.sqrt(Math.max(0, v)))],
    color_precision: (v) => ["colorPrecision", clamp(8 - v, 1, 8)],
    layer_difference: (v) => ["layerDifference", v],
    path_precision: (v) => ["pathPrecision", v],
};

function toTracerOptions(options = {}) {
    const out = {};
    for (const [key, value] of Object.entries(options)) {
        if (value === undefined) continue;
        const legacy = LEGACY_OPTIONS[key];
        if (!legacy) {
            out[key] = value;
            continue;
        }
        const mapped = legacy(value);
        if (mapped) out[mapped[0]] = mapped[1];
    }
    return out;
}

/**
 * Error thrown when a conversion is cancelled
 */
export class ConversionCancelledError extends Error {
    constructor(n) {
        super(`Conversion ${n} was cancelled`);
        this.name = 'ConversionCancelledError';
        this.n = n;
    }
}

let tracer = null;

function getTracer() {
    if (tracer === null) {
        const cores = (typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 2;
        tracer = new VTracer({ workers: clamp(cores - 1, 1, MAX_WORKERS) });
    }
    return tracer;
}

/**
 * Promise-based image loading
 */
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        // lets images from CORS-enabled hosts be read back; same-origin,
        // data: and blob: URLs are unaffected
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Image could not be loaded: ${String(src).slice(0, 128)}`));
        img.src = src;
    });
}

/**
 * Decodes an image URL to pixels. Done here rather than in the worker so it
 * works wherever a 2D canvas does.
 */
async function loadPixels(src) {
    const img = await loadImage(src);
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (!width || !height) {
        throw new Error("Image has no intrinsic size");
    }

    const canvas = typeof OffscreenCanvas === "function"
        ? new OffscreenCanvas(width, height)
        : Object.assign(document.createElement("canvas"), { width, height });
    const ctx = canvas.getContext("2d", { colorSpace: "srgb", willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);

    // Drop the decoded copies now instead of waiting for the collector.
    canvas.width = 1;
    canvas.height = 1;
    img.removeAttribute("src");
    return imageData;
}

/**
 * One conversion. `n` is only used to label a cancellation.
 */
async function convert(imageSource, output, options, signal, n) {
    try {
        const fromUrl = typeof imageSource === "string" || imageSource instanceof URL;
        const source = fromUrl ? await loadPixels(String(imageSource)) : imageSource;
        if (signal.aborted) {
            throw new ConversionCancelledError(n);
        }

        // Pixels decoded here belong to nobody else: move them to the worker.
        // A caller's ImageData is copied, and stays untouched and usable.
        const call = { signal, transfer: fromUrl };

        if (output === "blob") {
            const bytes = await getTracer().trace(source, options, { ...call, output: "bytes" });
            return URL.createObjectURL(new Blob([bytes], { type: 'image/svg+xml' }));
        }
        return await getTracer().trace(source, options, call);
    } catch (e) {
        // However the abort surfaced, report it the way this module always has.
        if (signal.aborted) {
            throw new ConversionCancelledError(n);
        }
        throw e;
    }
}

// Running conversions by n - enables cancellation of previous runs
const activeConversions = new Map();

/**
 * Main API: Convert raster image to SVG
 *
 * If called with the same `n` while a previous conversion is running,
 * the previous conversion is cancelled and the new one takes over.
 *
 * @param {ImageData|string} imageSource - ImageData object or image URL
 *        (ImageBitmap, Blob and canvas elements are accepted too)
 * @param {string} output - "svg" for string, "blob" for blob URL
 * @param {number} n - Instance identifier (required for cancellation tracking)
 * @returns {Promise<string>} - SVG string or blob URL
 */
export default async function createSVG(imageSource, output = "svg", n = 0) {
    // Cancel any existing conversion with the same n
    cancelSVG(n);

    const controller = new AbortController();
    activeConversions.set(n, controller);

    try {
        return await convert(imageSource, output, DEFAULT_OPTIONS, controller.signal, n);
    } finally {
        // Only delete if this conversion is still the active one for this n
        // (a newer call may already have replaced it)
        if (activeConversions.get(n) === controller) {
            activeConversions.delete(n);
        }
    }
}

/**
 * Cancel an in-progress conversion by its n identifier
 *
 * @param {number} n - Instance identifier to cancel
 * @returns {boolean} - true if a conversion was cancelled, false if none found
 */
export function cancelSVG(n) {
    const controller = activeConversions.get(n);
    if (controller) {
        activeConversions.delete(n);
        controller.abort();
        return true;
    }
    return false;
}

/**
 * Cancel all in-progress conversions
 */
export function cancelAllSVG() {
    const controllers = Array.from(activeConversions.values());
    activeConversions.clear();
    for (const controller of controllers) {
        controller.abort();
    }
}

/**
 * Advanced API: Create a reusable converter for batch processing
 *
 * `options` may use the old vtracer-color names and units (corner_threshold
 * in radians, filter_speckle as an area, ...) or @pixagram/vtracer's own
 * (cornerThreshold in degrees, filterSpeckle in pixels, ...).
 * Invalid options throw here, not at the first conversion.
 */
export function createConverter(options = {}) {
    const traceOptions = { ...DEFAULT_OPTIONS, ...toTracerOptions(options) };
    resolveOptions(traceOptions);

    let controller = null;

    const stop = () => {
        if (controller) {
            controller.abort();
            controller = null;
        }
    };

    return {
        async convert(imageSource, output = "svg") {
            // one conversion at a time per converter: a new one replaces the old
            stop();
            const own = new AbortController();
            controller = own;
            try {
                return await convert(imageSource, output, traceOptions, own.signal, null);
            } finally {
                if (controller === own) {
                    controller = null;
                }
            }
        },
        stop,
        dispose: stop,
    };
}