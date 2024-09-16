/* eslint-disable no-restricted-globals */
/**
 * nsfw.worker.js
 * ===========================================================================
 * Runs NSFWJS (MobileNetV2) entirely off the main thread.
 *
 * Why base64 / no separate files
 *   The tfjs WASM binary and the model weights are NOT fetched as standalone
 *   files. Instead:
 *     - The WASM binaries are base64-embedded (see nsfw-base64.js)
 *       and handed to tfjs as blob: URLs via setWasmPaths(fileMap). Nothing
 *       hits the network for .wasm, so a SPA fallback that returns index.html
 *       for unknown paths can't poison the WebAssembly load (the old
 *       "expected magic word 00 61 73 6d, found 3c 21 44 4f" error).
 *     - The model is loaded with the bundled named model ("MobileNetV2"),
 *       whose weights are base64-embedded inside the nsfwjs package, so there
 *       is no model.json / .bin fetch either.
 *
 * IndexedDB still caches the *parsed* model so subsequent sessions skip the
 * decode/instantiate cost.
 *
 * Backend: WASM (from the embedded blob) -> WebGL -> CPU.
 *
 * Workers have no DOM, so the main thread sends raw {data,width,height}
 * pixels; we wrap them in a tensor and classify that.
 */

"use strict";

import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-wasm";
import "@tensorflow/tfjs-backend-webgl";
import { setWasmPaths } from "@tensorflow/tfjs-backend-wasm";
import { load } from "nsfwjs/core";
import { MobileNetV2Model } from "nsfwjs/models/mobilenet_v2";

import { WASM_SIMD_B64, WASM_PLAIN_B64 } from "./nsfw-base64.js";

// ===== Config ==============================================================
const MODEL_NAME = "MobileNetV2";                         // bundled, base64 weights
const IDB_MODEL_KEY = "indexeddb://pixagram-nsfw-mobilenet-v2";
const MODEL_INPUT_SIZE = 224;

let modelPromise = null;

// ===== base64 -> Blob URL ==================================================
function b64ToBytes(b64) {
    var bin = atob(b64);
    var len = bin.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}
function b64ToWasmBlobURL(b64) {
    var bytes = b64ToBytes(b64);
    var blob = new Blob([bytes], { type: "application/wasm" });
    return URL.createObjectURL(blob);
}

// ===== Backend init: WASM (embedded) -> WebGL -> CPU =======================
async function initBackend() {
    try { tf.enableProdMode(); } catch (e) {}

    // Build blob: URLs for the embedded binaries and register them. The
    // file-map form of setWasmPaths requires entries for all three names;
    // the threaded-simd build is never selected without cross-origin
    // isolation, so we point it at the SIMD blob as a harmless placeholder.
    try {
        var simdURL = b64ToWasmBlobURL(WASM_SIMD_B64);
        var plainURL = b64ToWasmBlobURL(WASM_PLAIN_B64);
        setWasmPaths({
            "tfjs-backend-wasm.wasm": plainURL,
            "tfjs-backend-wasm-simd.wasm": simdURL,
            "tfjs-backend-wasm-threaded-simd.wasm": simdURL,
        });
    } catch (e) {
        // If setWasmPaths throws (already initialized), continue -> WebGL/CPU
        // fallback below still works.
    }

    var order = ["wasm", "webgl", "cpu"];
    for (var i = 0; i < order.length; i++) {
        try {
            await tf.setBackend(order[i]);
            await tf.ready();
            if (tf.getBackend() === order[i]) return order[i];
        } catch (e) { /* next */ }
    }
    await tf.ready();
    return tf.getBackend();
}

// ===== Model load: IndexedDB-first, save-on-miss ===========================
async function loadModel() {
    if (modelPromise) return modelPromise;

    modelPromise = (async () => {
        var backend = await initBackend();

        // 1) Parsed model cached in IndexedDB?
        try {
            var cached = await load(IDB_MODEL_KEY, { size: MODEL_INPUT_SIZE });
            return { model: cached, backend: backend, source: "indexeddb" };
        } catch (e) { /* first run -> fall through */ }

        // 2) Load the bundled named model (weights are base64 inside nsfwjs;
        //    no network fetch for model.json / .bin).
        var fresh = await load(MODEL_NAME, {
            modelDefinitions: [MobileNetV2Model],
        });

        // 3) Persist parsed weights for next session (best-effort).
        try { await fresh.model.save(IDB_MODEL_KEY); } catch (e) {}

        return { model: fresh, backend: backend, source: "bundled" };
    })();

    // A rejected load must not be cached forever -- drop it so the next
    // warmup/classify message can retry instead of replaying the failure.
    // The returned promise still rejects to the current caller, so this run's
    // error surfaces through the message-protocol try/catch below.
    modelPromise.catch(function () { modelPromise = null; });

    return modelPromise;
}

// ===== Classify one ImageData payload ======================================
// `thresholds` is an object: { porn, hentai, sexy, combined }.
// An image is flagged NSFW if ANY one of the four conditions is met:
//   - Porn   >= thresholds.porn      (default 0.35)
//   - Hentai >= thresholds.hentai    (default 0.35)
//   - Sexy   >= thresholds.sexy      (default 0.50)
//   - Porn + Hentai + Sexy >= thresholds.combined  (default 0.60)
// Per-class checks catch a single loud signal (e.g. Sexy 0.85 alone), the
// combined check catches diffuse cases where everything is medium-high.
async function classifyPayload(payload, thresholds) {
    var loaded = await loadModel();
    var model = loaded.model;

    // tf.browser.fromPixels in a worker accepts:
    //   - ImageData
    //   - OffscreenCanvas
    //   - a plain object, but ONLY when its `data` is a Uint32Array
    // Our payload arrives as a Uint8ClampedArray (one byte per channel), so
    // wrap it in a real ImageData. Falls back to a Uint32Array view if the
    // ImageData constructor is unavailable (very old browsers).
    var imageData;
    if (typeof ImageData !== "undefined") {
        imageData = new ImageData(payload.data, payload.width, payload.height);
    } else {
        imageData = {
            data: new Uint32Array(
                payload.data.buffer,
                payload.data.byteOffset,
                payload.width * payload.height
            ),
            width: payload.width,
            height: payload.height,
        };
    }

    var tStart = (self.performance && self.performance.now) ? self.performance.now() : Date.now();

    var input = tf.browser.fromPixels(imageData, 3); // RGB
    var resized = tf.image.resizeBilinear(input, [MODEL_INPUT_SIZE, MODEL_INPUT_SIZE], true);
    input.dispose();

    var predictions;
    try {
        predictions = await model.classify(resized);
    } finally {
        resized.dispose();
    }

    var tEnd = (self.performance && self.performance.now) ? self.performance.now() : Date.now();
    var ms = Math.round(tEnd - tStart);

    var porn = 0, hentai = 0, sexy = 0, neutral = 0, drawing = 0;
    for (var i = 0; i < predictions.length; i++) {
        var c = predictions[i].className;
        if (c === "Porn") porn = predictions[i].probability;
        else if (c === "Hentai") hentai = predictions[i].probability;
        else if (c === "Sexy") sexy = predictions[i].probability;
        else if (c === "Neutral") neutral = predictions[i].probability;
        else if (c === "Drawing") drawing = predictions[i].probability;
    }
    var combined = porn + hentai + sexy;

    // Track exactly which gate(s) tripped -- useful for debugging false +/-.
    var triggers = [];
    if (porn >= thresholds.porn)         triggers.push("porn>=" + thresholds.porn);
    if (hentai >= thresholds.hentai)     triggers.push("hentai>=" + thresholds.hentai);
    if (sexy >= thresholds.sexy)         triggers.push("sexy>=" + thresholds.sexy);
    if (combined >= thresholds.combined) triggers.push("combined>=" + thresholds.combined);
    var nsfw = triggers.length > 0;

    return {
        predictions: predictions,
        nsfw: nsfw,
        triggers: triggers,
        score: combined,
        porn: porn,
        hentai: hentai,
        sexy: sexy,
        neutral: neutral,
        drawing: drawing,
        ms: ms,
        backend: loaded.backend,
        modelSource: loaded.source,
    };
}

// ===== Message protocol ====================================================
self.onmessage = async function (event) {
    var msg = event.data || {};
    var type = msg.type, reqId = msg.reqId;

    if (type === "warmup") {
        try {
            var w = await loadModel();
            self.postMessage({ type: "warmup:done", reqId: reqId, backend: w.backend, source: w.source });
        } catch (err) {
            self.postMessage({ type: "warmup:error", reqId: reqId, error: String((err && err.message) || err) });
        }
        return;
    }

    if (type === "classify") {
        // Backwards-compatible: accept either a thresholds object or a legacy
        // single-number threshold (treated as the combined-sum threshold).
        var t = msg.thresholds;
        if (typeof msg.threshold === "number" && !t) {
            t = { porn: 0.35, hentai: 0.35, sexy: 0.5, combined: msg.threshold };
        }
        if (!t) t = { porn: 0.35, hentai: 0.35, sexy: 0.5, combined: 0.6 };

        try {
            var result = await classifyPayload(msg.payload, t);
            console.log("[nsfw]", msg.id, {
                nsfw: result.nsfw,
                porn: +result.porn.toFixed(3),
                hentai: +result.hentai.toFixed(3),
                sexy: +result.sexy.toFixed(3),
                neutral: +result.neutral.toFixed(3),
                drawing: +result.drawing.toFixed(3),
                sum: +result.score.toFixed(3),
                triggers: result.triggers,
                ms: result.ms,
                backend: result.backend,
            });
            self.postMessage({
                type: "classify:done",
                reqId: reqId,
                id: msg.id,
                nsfw: result.nsfw,
                score: result.score,
                porn: result.porn,
                hentai: result.hentai,
                sexy: result.sexy,
                neutral: result.neutral,
                drawing: result.drawing,
                triggers: result.triggers,
                ms: result.ms,
                backend: result.backend,
                modelSource: result.modelSource,
                predictions: result.predictions,
            });
        } catch (err) {
            console.log("[nsfw]", msg.id, "ERROR", err && err.message);
            self.postMessage({
                type: "classify:error",
                reqId: reqId,
                id: msg.id,
                error: String((err && err.message) || err),
            });
        }
        return;
    }
};