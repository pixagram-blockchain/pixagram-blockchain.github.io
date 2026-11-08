// ============================================================================
// pixel-editor/editorUtils.js — glue between the editor core and React
//
//   useEditorEvents(ed, types)   re-render on editor events, ≤ 1 per frame
//   documentFromImageData(...)   ImageData → one-layer Document
//   imageDataFromDocument(doc)   flattened Document → ImageData
//   paintPixels(canvas, ...)     packed pixels into a canvas, 1:1
//   thumbPixels(...)             nearest-neighbour thumbnail of packed pixels
//   cssColor(c)                  packed colour → CSS rgba()
// ============================================================================

import { useEffect, useReducer } from "preact/compat";
import { Document, Layer } from "../../utils/pixa-editor/index.js";

/**
 * Re-renders the calling component when one of the editor events fires,
 * coalesced to at most one render per animation frame. Each panel subscribes
 * to what it shows, so a stroke or a slider drag does not repaint the whole
 * dialog — only the parts that read the state that changed.
 *
 * @param {object|null} ed  the editor (nothing happens while it is null)
 * @param {string[]} types  editor event names
 */
export function useEditorEvents(ed, types) {
    const [, bump] = useReducer((n) => n + 1, 0);
    const key = types.join(" ");
    useEffect(() => {
        if (!ed) return undefined;
        let raf = 0;
        const schedule = () => {
            if (raf) return;
            raf = requestAnimationFrame(() => {
                raf = 0;
                bump();
            });
        };
        const offs = key.split(" ").map((type) => ed.on(type, schedule));
        return () => {
            offs.forEach((off) => off());
            if (raf) cancelAnimationFrame(raf);
        };
    }, [ed, key]);
}

// ImageData bytes are R, G, B, A; read as little-endian 32-bit words they are
// 0xAABBGGRR, the packing the core uses everywhere.
const packedView = (imageData) => new Uint32Array(
    imageData.data.buffer,
    imageData.data.byteOffset,
    imageData.width * imageData.height
);

/**
 * One-layer document holding a copy of the picture. Throws a RangeError when
 * a single layer cannot index that many colours (over 65 535) — the caller
 * reports it; pixel art never comes close.
 */
export function documentFromImageData(imageData, layerName) {
    const { width, height } = imageData;
    const rgba = packedView(imageData).slice();
    const layer = Layer.fromRGBA(rgba, width, height, layerName);
    return new Document({ width, height, layers: [layer] });
}

/** The visible image, all layers flattened, as an ImageData of the same size. */
export function imageDataFromDocument(doc) {
    const rgba = doc.compositeRGBA();
    const bytes = new Uint8ClampedArray(rgba.buffer.slice(rgba.byteOffset, rgba.byteOffset + doc.width * doc.height * 4));
    return new ImageData(bytes, doc.width, doc.height);
}

/**
 * Nearest-neighbour copy of packed pixels that fits `max` on its longer side
 * (the pixels themselves when they already fit). Thumbnails of big documents
 * then never push megabytes through putImageData.
 */
export function thumbPixels(rgba, width, height, max) {
    const k = Math.max(width, height) / max;
    if (k <= 1) return { rgba, width, height };
    const w = Math.max(1, Math.round(width / k)), h = Math.max(1, Math.round(height / k));
    const out = new Uint32Array(w * h);
    for (let y = 0; y < h; y++) {
        const sy = Math.min(height - 1, Math.floor((y + 0.5) * height / h)) * width;
        for (let x = 0; x < w; x++) out[y * w + x] = rgba[sy + Math.min(width - 1, Math.floor((x + 0.5) * width / w))];
    }
    return { rgba: out, width: w, height: h };
}

/** Packed pixels into a canvas at 1:1 (CSS scales it, pixelated). */
export function paintPixels(canvas, rgba, width, height) {
    if (!canvas) return;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, width * height * 4), width, height), 0, 0);
}

/** Packed 0xAABBGGRR → CSS rgba(). */
export const cssColor = (c) => {
    c >>>= 0;
    return `rgba(${c & 255}, ${(c >>> 8) & 255}, ${(c >>> 16) & 255}, ${((c >>> 24) / 255).toFixed(3)})`;
};

/** Packed colour → { r, g, b, a } with a in 0..1, the shape CircularColorPicker takes. */
export const toRgbObject = (c) => {
    c >>>= 0;
    return { r: c & 255, g: (c >>> 8) & 255, b: (c >>> 16) & 255, a: (c >>> 24) / 255 };
};

/** Perceived lightness of a packed colour, 0..1 (for picking a readable ink over it). */
export const luma = (c) => (0.2126 * (c & 255) + 0.7152 * ((c >>> 8) & 255) + 0.0722 * ((c >>> 16) & 255)) / 255;
