/**
 * nsfw.worker.js
 * ---------------------------------------------------------------------------
 * @pixagram/eve off the main thread, for nsfw-detect.js, which starts this
 * worker and is its only client. The package, its embedded model and ONNX
 * Runtime are loaded here: none of them is in the page's bundle, the page never
 * waits for an inference, and the whole heap goes away when nsfw-detect.js
 * terminates the worker.
 *
 * Protocol. Every request carries an `id` and its answer repeats it:
 *   <- { type: "ready", shapes, interpolation, model, sha256 }   once, at start
 *   -> { id, type: "load", options }       options: { wasmPaths, numThreads }
 *   <- { id, ok: true }
 *   -> { id, type: "classify", source }    source: an ImageBitmap, transferred
 *   <- { id, ok: true, score, inputSize, sourceSize, ms }
 *   <- { id, ok: false, error }            for a request that failed
 *
 * The threshold is not applied here: nsfw-detect.js gates on `score` itself, so
 * that a new threshold takes effect on cached verdicts too.
 */
import { classify, info, load } from "@pixagram/eve";

self.postMessage({
    type: "ready",
    shapes: info.inputShapes.map((shape) => [shape[0], shape[1]]),
    interpolation: info.interpolation,
    model: info.file,
    sha256: info.sha256,
});

self.onmessage = async (ev) => {
    const m = ev.data || {};
    try {
        if (m.type === "load") {
            await load(m.options || {});
            self.postMessage({ id: m.id, ok: true });
        } else if (m.type === "classify") {
            let res;
            try {
                res = await classify(m.source);
            } finally {
                // The bitmap was transferred to this worker: it is ours to release.
                try { m.source && m.source.close && m.source.close(); } catch (e) {}
            }
            self.postMessage({
                id: m.id, ok: true,
                score: res.score, inputSize: res.inputSize, sourceSize: res.sourceSize, ms: res.ms,
            });
        } else {
            throw new Error("unknown request: " + m.type);
        }
    } catch (e) {
        self.postMessage({ id: m.id, ok: false, error: String((e && e.message) || e) });
    }
};
