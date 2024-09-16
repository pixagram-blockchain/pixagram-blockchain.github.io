import { ColorImageConverter } from "vtracer-color";
import { SIMDopeCreate, SIMDopeCreateConfAdd } from "simdope";

// Configuration for SIMD color operations
const MODE = SIMDopeCreateConfAdd({
    create: { new_of: true, new_uint32: true, new_uint32b: true },
    properties: { uint32: true, hex: true },
    methods: {
        get_element: true,
        euclidean_match_with: true,
        slice_uint32: true,
        get_deduplicated_sorted_uint32a: true
    }
});

const { Color, Colors } = SIMDopeCreate(MODE);
const serializer = new XMLSerializer();

// Pre-computed constants for color replacement
const BLACK_UINT32 = 0x000000FF;
const REPLACEMENT_UINT32 = 0x161616FF;

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

/**
 * Efficiently replaces black pixels with a near-black substitute
 * to preserve transparency distinction in vectorization.
 *
 * @param {Uint32Array} pixels - Pixel buffer as Uint32Array
 * @returns {void} - Mutates in place
 */
function replaceBlackPixels(pixels) {
    // Direct comparison is ~100x faster than Color.new_uint32().euclidean_match_with()
    for (let i = 0, len = pixels.length; i < len; i++) {
        if (pixels[i] === BLACK_UINT32) {
            pixels[i] = REPLACEMENT_UINT32;
        }
    }
}

/**
 * Creates final SVG string with color corrections applied.
 * Single-pass regex replacement for performance.
 */
function createOutputSvg(svgElement, canvasElement, output) {
    if (!svgElement || !canvasElement) {
        console.error('SVG or Canvas element not found');
        return null;
    }

    // Clean up element attributes before serialization
    svgElement.removeAttribute("style");
    svgElement.removeAttribute("id");

    let svgString = serializer.serializeToString(svgElement);

    // Single-pass replacement using a map for O(1) lookups
    const colorReplacements = {
        '#000000': 'transparent',
        '#161616': '#000000'
    };

    svgString = svgString.replace(
        /style="fill: (#[0-9a-fA-F]{6});"/g,
        (match, color) => {
            const replacement = colorReplacements[color.toLowerCase()];
            return replacement
                ? `style="fill: ${replacement};"`
                : match;
        }
    );

    // Clean up DOM elements
    svgElement.remove();
    canvasElement.remove();

    if (output === "svg") {
        return svgString;
    } else if (output === "blob") {
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        return URL.createObjectURL(blob);
    }

    return svgString;
}

/**
 * Converter runner with proper lifecycle management.
 * Each instance owns its resources exclusively.
 */
class ConverterRunner {
    #converter = null;
    #stopped = false;
    #frameId = null;
    #n = null;

    constructor(canvasId, svgId, options = {}, n = null) {
        this.canvasId = canvasId;
        this.svgId = svgId;
        this.#n = n;
        this.options = {
            mode: "polygon",
            clustering_mode: "color",
            hierarchical: "cutout",
            corner_threshold: 1 / 60,
            length_threshold: 6.0,
            max_iterations: 1,
            splice_threshold: 1 / 45,
            filter_speckle: 16,
            color_precision: 0,
            layer_difference: 0,
            path_precision: 2,
            ...options
        };
    }

    #initConverter() {
        // Always free existing converter before creating new one
        this.#freeConverter();
        const config = JSON.stringify({
            canvas_id: this.canvasId,
            svg_id: this.svgId,
            ...this.options
        });

        this.#converter = ColorImageConverter.new_with_string(config);
        this.#converter.init();
    }

    #freeConverter() {
        if (this.#converter) {
            try {
                this.#converter.free();
            } catch (e) {
                console.warn('Converter already freed:', e);
            }
            this.#converter = null;
        }
    }

    run(output = "svg") {
        return new Promise((resolve, reject) => {
            this.#stopped = false;
            this.#initConverter();

            const tick = () => {
                if (this.#stopped) {
                    this.#freeConverter();
                    reject(new ConversionCancelledError(this.#n));
                    return;
                }

                try {
                    let done = false;
                    const startTick = performance.now();

                    // Process for up to 25ms per frame
                    while (!(done = this.#converter.tick()) && performance.now() - startTick < 25) {}

                    if (!done) {
                        this.#frameId = requestAnimationFrame(tick);
                    } else {
                        this.#complete(output, resolve);
                    }
                } catch (e) {
                    this.#freeConverter();
                    reject(e);
                }
            };

            // Use requestAnimationFrame instead of setTimeout for better performance
            this.#frameId = requestAnimationFrame(tick);
        });
    }

    #complete(output, resolve) {
        const svgElement = document.getElementById(this.svgId);
        const canvasElement = document.getElementById(this.canvasId);

        const result = createOutputSvg(svgElement, canvasElement, output);

        this.#freeConverter();
        resolve(result);
    }

    stop() {
        this.#stopped = true;
        if (this.#frameId) {
            cancelAnimationFrame(this.#frameId);
            this.#frameId = null;
        }
        this.#freeConverter();
    }

    /**
     * Explicit cleanup - call when done with this runner
     */
    dispose() {
        this.stop();
    }
}

/**
 * Prepares canvas with image data for vectorization.
 * Handles both ImageData and URL sources.
 */
async function prepareCanvas(canvas, svg, imageSource) {
    const ctx = canvas.getContext('2d', { colorSpace: "srgb" });

    if (imageSource instanceof ImageData) {
        canvas.width = imageSource.width;
        canvas.height = imageSource.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Replace black pixels efficiently
        const pixels = new Uint32Array(imageSource.data.buffer);
        replaceBlackPixels(pixels);

        // Create new ImageData with modified buffer
        const modifiedData = new ImageData(
            new Uint8ClampedArray(pixels.buffer),
            imageSource.width,
            imageSource.height
        );
        ctx.putImageData(modifiedData, 0, 0);

    } else {
        // Load from URL
        const img = await loadImage(imageSource);
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        // Get and modify pixel data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = new Uint32Array(imageData.data.buffer);
        replaceBlackPixels(pixels);

        ctx.putImageData(imageData, 0, 0);
    }

    // Configure SVG element
    svg.setAttribute("fill", "transparent");
    svg.setAttribute("height", canvas.height + "px");
    svg.setAttribute("width", canvas.width + "px");
}

/**
 * Promise-based image loading
 */
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

/**
 * Creates or retrieves DOM elements for vectorization
 */
function getOrCreateElements(canvasId, svgId) {
    let canvas = document.getElementById(canvasId);
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = canvasId;
        canvas.style.display = 'none';
        document.body.appendChild(canvas);
    }

    let svg = document.getElementById(svgId);
    if (!svg) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = svgId;
        svg.style.display = 'none';
        document.body.appendChild(svg);
    }

    return { canvas, svg };
}

// Instance counter for unique IDs
let instanceCounter = 0;

// Registry of active runners by n - enables cancellation of previous runs
const activeRunners = new Map();

/**
 * Main API: Convert raster image to SVG
 *
 * If called with the same `n` while a previous conversion is running,
 * the previous conversion is cancelled and the new one takes over.
 *
 * @param {ImageData|string} imageSource - ImageData object or image URL
 * @param {string} output - "svg" for string, "blob" for blob URL
 * @param {number} n - Instance identifier (required for cancellation tracking)
 * @returns {Promise<string>} - SVG string or blob URL
 */
export default async function createSVG(imageSource, output = "svg", n = 0) {
    // Cancel any existing runner with the same n
    const existingRunner = activeRunners.get(n);
    if (existingRunner) {
        existingRunner.stop();
        activeRunners.delete(n);
    }

    const canvasId = `vtracer-canvas-${n}`;
    const svgId = `vtracer-svg-${n}`;

    const { canvas, svg } = getOrCreateElements(canvasId, svgId);

    await prepareCanvas(canvas, svg, imageSource);

    const runner = new ConverterRunner(canvasId, svgId, {}, n);

    // Register this runner
    activeRunners.set(n, runner);

    try {
        const result = await runner.run(output);
        return result;
    } finally {
        // Only delete if this runner is still the active one for this n
        // (prevents race condition if a newer call already replaced it)
        if (activeRunners.get(n) === runner) {
            activeRunners.delete(n);
        }
        runner.dispose();
    }
}

/**
 * Cancel an in-progress conversion by its n identifier
 *
 * @param {number} n - Instance identifier to cancel
 * @returns {boolean} - true if a runner was cancelled, false if none found
 */
export function cancelSVG(n) {
    const runner = activeRunners.get(n);
    if (runner) {
        runner.stop();
        activeRunners.delete(n);
        return true;
    }
    return false;
}

/**
 * Cancel all in-progress conversions
 */
export function cancelAllSVG() {
    for (const [n, runner] of activeRunners) {
        runner.stop();
    }
    activeRunners.clear();
}

/**
 * Advanced API: Create a reusable converter for batch processing
 * Caller is responsible for calling dispose() when done.
 */
export function createConverter(options = {}) {
    const instanceId = instanceCounter++;
    const canvasId = `vtracer-canvas-${instanceId}`;
    const svgId = `vtracer-svg-${instanceId}`;

    const { canvas, svg } = getOrCreateElements(canvasId, svgId);
    const runner = new ConverterRunner(canvasId, svgId, options);

    return {
        async convert(imageSource, output = "svg") {
            await prepareCanvas(canvas, svg, imageSource);
            return runner.run(output);
        },
        stop() {
            runner.stop();
        },
        dispose() {
            runner.dispose();
        }
    };
}