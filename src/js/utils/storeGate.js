/*
 * utils/storeGate.js — the store builds' image check, for any upload surface.
 *
 * In the Google Play and App Store apps (utils/store.js) no mature picture may
 * be uploaded, generated or published. Every surface that takes a picture in
 * runs it through screenPicture() before showing or using it, and calls
 * notifyStoreGate() when the answer is not SCREEN.OK:
 *
 *   const outcome = await screenPicture(fileOrImageData, { width, height });
 *   if (outcome !== SCREEN.OK) { notifyStoreGate(outcome); return; }
 *
 * The check is the on-device classifier the feed already uses
 * (utils/nsfw.js, classifyImage): nothing leaves the device for it. It fails
 * CLOSED: a picture that can't be checked (model failed to load, picture
 * can't be decoded) is SCREEN.UNCHECKED, and a store build doesn't use it.
 *
 * In the browser STORE_GATE is false, screenPicture() answers SCREEN.OK at
 * once and nothing is loaded.
 *
 * Used by components/NewPost.js (every way a picture enters the wizard, and
 * Publish) and components/pixel-editor/PixelEditorDialog.js (the picture it
 * opens on, pictures pasted or dropped on the canvas and the result of Done,
 * whichever dialog opened the editor).
 */

import dispatcher from "../dispatcher";
import { t } from "./text";
import { isStoreBuild } from "./store";

export const STORE_GATE = isStoreBuild();

export const SCREEN = Object.freeze({
    OK: "ok",
    MATURE: "mature",          // classified as mature: erase it
    UNCHECKED: "unchecked",    // couldn't be classified: don't use it
    PROMPT: "prompt",          // a text-to-image description asking for mature content
});

// The classifier module, loaded on first use and shared with the feed (same
// module instance, same worker).
let _nsfwModPromise = null;
const loadClassifier = () => {
    if (!_nsfwModPromise) {
        _nsfwModPromise = import("./nsfw")
            .then((m) => (m && (m.default || m)) || null)
            .catch(() => { _nsfwModPromise = null; return null; });
    }
    return _nsfwModPromise;
};

/** Load the model ahead of the first check (a dialog that will need it opened). */
export const warmupStoreGate = () => {
    if (!STORE_GATE) return Promise.resolve();
    return loadClassifier().then((mod) => {
        if (mod && typeof mod.warmupClassifier === "function") return mod.warmupClassifier();
    }).catch(() => {});
};

/**
 * SCREEN.OK, SCREEN.MATURE or SCREEN.UNCHECKED for one picture.
 * @param {ImageData|ImageBitmap|Blob|HTMLImageElement|HTMLCanvasElement} source
 * @param {{width:number,height:number}} [size] decoded size of a Blob, if known
 */
export async function screenPicture(source, size) {
    if (!STORE_GATE) return SCREEN.OK;
    if (!source) return SCREEN.UNCHECKED;
    const mod = await loadClassifier();
    if (!mod || typeof mod.classifyImage !== "function") return SCREEN.UNCHECKED;
    let result = null;
    try { result = await mod.classifyImage(source, size || {}); } catch (e) { result = null; }
    if (!result || !result.ok) return SCREEN.UNCHECKED;
    return result.nsfw ? SCREEN.MATURE : SCREEN.OK;
}

// The messages explain why a picture just vanished, which the shell's ~2 s
// snackbar doesn't leave time to read. Index's SNACKBAR handler honours
// `duration` (actions.trigger_snackbar sends its hold time under another name,
// so it would be ignored there), hence the direct dispatch.
const SNACKBAR_MS = 6000;
const MESSAGES = {
    [SCREEN.MATURE]: "components.store_policy.mature_content_not_allowed",
    [SCREEN.UNCHECKED]: "components.store_policy.picture_could_not_be_checked",
    [SCREEN.PROMPT]: "components.store_policy.mature_prompt_not_allowed",
};

/** The snackbar for a refused picture or description. */
export function notifyStoreGate(outcome) {
    const message = t(MESSAGES[outcome] || MESSAGES[SCREEN.MATURE]);
    const send = () => dispatcher.dispatch({ type: "SNACKBAR", data: { message, duration: SNACKBAR_MS } });
    if (dispatcher.isDispatching()) setTimeout(send, 10);
    else send();
}

/**
 * For callers that only need a yes/no (PixelEditorDialog's paste and drop):
 * checks the picture, shows the snackbar when it's refused, resolves true
 * when it may be used.
 */
export async function screenPictureOrNotify(source, size) {
    const outcome = await screenPicture(source, size);
    if (outcome !== SCREEN.OK) notifyStoreGate(outcome);
    return outcome === SCREEN.OK;
}
