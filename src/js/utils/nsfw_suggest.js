// ============================================================================
// utils/nsfw_suggest.js — the on-device NSFW check on a picture being posted
//
// NewPost runs it on the picture it publishes, and EditPostDialog on a
// picture edited in the pixel editor: when the classifier rates the picture
// sensitive, the NSFW switch turns on, and the author can turn it off again.
// It bridges to the classifier PaperCard uses to blur feed images
// (utils/nsfw.js).
//
// The classifier pulls in a model and ONNX Runtime that must not weigh on the
// dialogs' bundles or first paint, so, as in PaperCard.js, it is imported
// lazily and kept at module scope: the cost is paid once per session, and the
// two dialogs share it.
// ============================================================================

let _nsfwMod = null;
let _nsfwModPromise = null;

// Idempotent loader. Resolves to the module (default export) or null if the
// import failed. Safe to call repeatedly / concurrently.
export function loadNsfwDetect() {
    if (_nsfwMod) return Promise.resolve(_nsfwMod);
    if (_nsfwModPromise) return _nsfwModPromise;
    _nsfwModPromise = import("./nsfw")
        .then((m) => { _nsfwMod = (m && (m.default || m)) || null; return _nsfwMod; })
        .catch(() => {
            // Clear the promise so a later attempt may retry, and resolve to
            // null so callers treat detection as unavailable (fail-open).
            _nsfwModPromise = null;
            return null;
        });
    return _nsfwModPromise;
}

// Fast, dependency-free 53-bit string hash (cyrb53). Used to derive a stable,
// content-addressed id for the verdict cache from the encoded image: identical
// image bytes => identical id => classified at most once per device. Matches
// utils/nsfw.js's documented convention that the cache key is a content hash.
export function nsfwImageKey(str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return "img-" + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

// Load the classifier and its verdict cache ahead of a check, so that the
// check itself is quick (EditPostDialog does it when the pixel editor opens).
// Best-effort: never rejects.
export function warmNsfwCheck() {
    return loadNsfwDetect().then((mod) => {
        if (!mod) return undefined;
        mod.configure({ filterEnabled: true }); // warmup is a no-op while off
        return mod.warmup ? mod.warmup() : undefined;
    }).catch(() => {});
}

// The verdict this device already holds for a picture, without loading
// anything: true or false, or undefined when there is none yet.
export function peekNsfw(key) {
    if (!_nsfwMod || !key) return undefined;
    try { return _nsfwMod.getCached(key); } catch (e) { return undefined; }
}

// How long a check may take, model loading included, before it counts as
// "not sensitive".
export const NSFW_CHECK_TIMEOUT_MS = 15000;

/**
 * Does the picture look sensitive? Resolves true when the classifier says
 * so, and false when it says not, cannot run, or takes longer than
 * `timeoutMs`: the check suggests the flag, it never stands in the way.
 *
 * @param {object}   args
 * @param {string}   args.key         nsfwImageKey of the encoded picture
 * @param {Function} args.getImgData  async () => ImageData, the picture's pixels
 * @param {number}   [args.timeoutMs]
 * @returns {Promise<boolean>}
 */
export async function checkNsfw({ key, getImgData, timeoutMs = NSFW_CHECK_TIMEOUT_MS }) {
    let timer = null;
    const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve(false), timeoutMs); });
    const check = (async () => {
        const mod = await loadNsfwDetect();
        if (!mod) return false;
        mod.configure({ filterEnabled: true }); // the classifier no-ops while off
        const cached = mod.getCached(key);
        if (cached !== undefined) return cached;
        return mod.ensureNsfw({ id: key, getImgData, alreadyFlagged: false });
    })();
    try {
        return (await Promise.race([check, timeout])) === true;
    } catch (e) {
        return false;
    } finally {
        clearTimeout(timer);
    }
}
