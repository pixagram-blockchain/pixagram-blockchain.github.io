/**
 * utils/toxicity.js — Toxic Comment Helper (shared singleton)
 *
 * Thin, settings-aware orchestration layer over @pixagram/toxicity. Same
 * module shape as utils/nsfw.js (configure / warmup / dispose + default
 * export) so Index.js can manage both identically.
 *
 * Loading policy (deliberate, in order):
 *   1. Importing THIS module costs nothing — @pixagram/toxicity and
 *      onnxruntime-web are only dynamic-import()ed from inside check paths.
 *   2. Nothing loads while the `toxicity_enabled` setting is false.
 *   3. Nothing loads until the user has actually typed MORE THAN 3 characters
 *      into a watched field — short strings resolve to null without touching
 *      the network.
 *   4. Disabling the setting mid-session releases the model (Index.js calls
 *      configure({enabled:false}) + dispose(), and we also self-subscribe to
 *      the settings cache as a belt-and-braces).
 *
 * Everything runs on-device via onnxruntime-web — no text ever leaves the
 * browser (see the copy in SettingsDialog).
 */

import * as settings_api from "./settings";

export const MIN_CHARS = 4;        // "> 3 chars" — the model never loads below this
export const DEFAULT_DEBOUNCE_MS = 650;

let _enabledOverride = null;       // configure({enabled}) — Index.js authoritative push
let _wasmPaths = undefined;        // e.g. "/ort/" if ort-web wasm isn't at default path
let _threshold = undefined;        // undefined → package default (0.7)
let _pkgPromise = null;            // in-flight import of @pixagram/toxicity
let _classifier = null;            // live ToxicityClassifier instance

/** Current on/off state: Index.js push wins, else the settings cache. */
export const is_enabled = () => {
    if (_enabledOverride !== null) return _enabledOverride;
    const s = settings_api.get_cached_settings();
    return s.toxicity_enabled !== false; // default ON
};

/**
 * Called by Index.js when settings are (re)caught — same contract as
 * utils/nsfw.js. `enabled:false` releases the model immediately.
 */
export const configure = ({ enabled, wasmPaths, threshold } = {}) => {
    if (typeof wasmPaths === "string") _wasmPaths = wasmPaths;
    if (typeof threshold === "number") _threshold = threshold;
    if (typeof enabled === "boolean") {
        _enabledOverride = enabled;
        if (!enabled) dispose();
    }
};

// Belt-and-braces: if anything else flips the setting (another tab through the
// storage layer, a future surface), release the model without waiting for
// Index.js. Subscribing is just adding a callback to a Set — no side effects.
settings_api.subscribe((s) => {
    if (s && s.toxicity_enabled === false && _enabledOverride === null) dispose();
});

const _get_classifier = async () => {
    if (_classifier) return _classifier;
    if (!_pkgPromise) {
        _pkgPromise = import("@pixagram/toxicity").catch((e) => {
            _pkgPromise = null; // transient (offline first hit) — allow retry
            throw e;
        });
    }
    const pkg = await _pkgPromise;
    if (!_classifier) {
        const opts = { wasmPaths: _wasmPaths };
        if (typeof _threshold === "number") opts.threshold = _threshold;
        _classifier = new pkg.ToxicityClassifier(opts);
    }
    return _classifier;
};

/**
 * Classify `text` if — and only if — the helper is enabled and the text is
 * longer than 3 characters. Returns null when skipped, otherwise
 * { toxic, score, label, scores }. Never throws: on any failure the helper
 * silently stands down (it must never block typing or sending).
 */
export const check_toxicity = async (text) => {
    const trimmed = String(text || "").trim();
    if (!is_enabled()) return null;
    if (trimmed.length < MIN_CHARS) return null;
    try {
        const clf = await _get_classifier();
        if (!is_enabled()) return null; // setting flipped while loading
        return await clf.classify(trimmed);
    } catch (e) {
        console.warn("[toxicity] check failed (helper stands down):", e && e.message);
        return null;
    }
};

/**
 * Debounced checker for "when the user doesn't type anymore".
 *
 *   const checker = create_toxicity_checker((result, text) => {...});
 *   onInput: checker.check(value);
 *   unmount: checker.cancel();
 *
 * - trailing debounce (`delay` ms after the LAST keystroke)
 * - out-of-order-safe: a stale async result never overwrites a newer one
 * - clearing the field (or dropping under 4 chars) reports null immediately
 *   so warnings vanish without waiting for the debounce.
 */
export const create_toxicity_checker = (onResult, delay = DEFAULT_DEBOUNCE_MS) => {
    let timer = null;
    let seq = 0;
    let cancelled = false;

    const run = (text) => {
        const my = ++seq;
        check_toxicity(text).then((result) => {
            if (cancelled || my !== seq) return;
            try { onResult(result, text); } catch (e) { /* listener error */ }
        });
    };

    return {
        check(text) {
            if (cancelled) return;
            if (timer) { clearTimeout(timer); timer = null; }
            const trimmed = String(text || "").trim();
            if (!is_enabled() || trimmed.length < MIN_CHARS) {
                ++seq; // invalidate any in-flight classification
                try { onResult(null, text); } catch (e) { /* listener error */ }
                return;
            }
            timer = setTimeout(() => { timer = null; run(text); }, delay);
        },
        cancel() {
            cancelled = true;
            ++seq;
            if (timer) { clearTimeout(timer); timer = null; }
        },
    };
};

// ── Pre-broadcast soft gate ─────────────────────────────────────────────────
// "Detect toxicity of comments BEFORE broadcasting": on send, re-check the
// exact body (instant — the debounced pass already cached it). If it's toxic
// and the user hasn't been warned about THIS text yet, block that one click;
// the next click on the unchanged text goes through. Helper, not censor.
const _warned = new Map(); // fieldKey -> exact text already warned about
const SEND_GATE_TIMEOUT_MS = 1500; // never make "send" wait on a cold model load

/**
 * @returns {Promise<boolean>} true ⇒ caller should show a snackbar and NOT
 * broadcast this click; false ⇒ proceed.
 */
export const confirm_before_send = async (fieldKey, text) => {
    const trimmed = String(text || "").trim();
    if (_warned.get(fieldKey) === trimmed) {
        _warned.delete(fieldKey); // user insists — let it through
        return false;
    }
    // The debounced watcher normally has this exact text LRU-cached, so this
    // resolves in microseconds. Cold-path safety: past the budget, wave the
    // send through rather than stall it on a model download.
    const result = await Promise.race([
        check_toxicity(trimmed),
        new Promise((resolve) => setTimeout(() => resolve(null), SEND_GATE_TIMEOUT_MS)),
    ]);
    if (result && result.toxic) {
        _warned.set(fieldKey, trimmed);
        return true;
    }
    _warned.delete(fieldKey);
    return false;
};

/** Forget a pending "press send again" state (e.g. when a dialog closes). */
export const clear_send_warning = (fieldKey) => { _warned.delete(fieldKey); };

/** Optional pre-load (NOT called at idle by design — the model waits for typing). */
export const warmup = () => { _get_classifier().catch(() => {}); };

/** Release the WASM session + package instance. Re-loads lazily on next check. */
export const dispose = () => {
    if (_classifier) {
        try { _classifier.dispose(); } catch (e) { /* already gone */ }
        _classifier = null;
    }
    _pkgPromise = null;
    _warned.clear();
};

export default {
    MIN_CHARS,
    is_enabled,
    configure,
    check_toxicity,
    create_toxicity_checker,
    confirm_before_send,
    clear_send_warning,
    warmup,
    dispose,
};
