/**
 * ContentSanitizer — Pure JS content sanitization pipeline.
 *
 * Tiered sanitization for blockchain social content:
 *   Tier 1: Memo      — Minimal inline formatting only
 *   Tier 2: Comment   — Block elements + code, no images
 *   Tier 3: Post      — Full rich content including images
 *
 * Also provides:
 *   - JSON sanitization (depth-limited, key-validated)
 *   - Username sanitization (HIVE account rules)
 *   - Plain text extraction (HTML/Markdown → text)
 *   - TF-IDF extractive summarization
 *
 * Drop-in replacement for @pixagram/sanitizer WASM module.
 *
 * @version 2.0.0
 * @module ContentSanitizer
 */

// 'sanitize-html/index' (extensionless deep path) only resolves under bundlers
// that guess extensions. It fails under Node ESM and strict-resolution
// bundlers; the package's documented entry point works everywhere.
import sanitizeHtmlLib from 'sanitize-html';
import { marked } from 'marked';

// ═══════════════════════════════════════════════════════════
// Marked configuration (module-level, set once)
// ═══════════════════════════════════════════════════════════

marked.setOptions({
    gfm:       true,
    breaks:    false,
    pedantic:  false,
    headerIds: false,
    mangle:    false,
});

// ═══════════════════════════════════════════════════════════
// SVG Security Analyzer
// ═══════════════════════════════════════════════════════════

/**
 * Elements an SVG may contain.
 *
 * Derived from what the app actually emits — GradientEditorDialog builds
 * blog-post gradients from svg/defs/g/rect/circle/ellipse/path/linearGradient/
 * radialGradient/stop/filter/feTurbulence/feGaussianBlur/feColorMatrix/
 * feComponentTransfer/feFuncA — widened to the rest of the static SVG drawing
 * vocabulary so hand-written and pasted SVG still works.
 *
 * An allowlist is the real fix for SVG. The denylist below is kept as a second
 * layer, but it is the wrong shape for the problem: it can only reject the
 * attacks someone thought of, which is how four encoding bypasses survived in
 * it. This inverts that.
 *
 * Deliberately absent, each closing an attack class rather than one payload:
 *   <script> <foreignObject> <handler> <iframe> <object> <embed> <applet>
 *   <audio> <video> <link> <meta> <base>   — execution and embedding
 *   <a>      — the only reason an href scheme can appear at all, and a link
 *              inside an <img>-rendered SVG does nothing anyway
 *   <style>  — CSS is a standing attack surface and nothing here emits it;
 *              every graphic in the app is attribute-styled
 */
const SVG_ALLOWED_ELEMENTS = Object.freeze(new Set([
    // structure
    'svg', 'g', 'defs', 'symbol', 'use', 'switch', 'title', 'desc', 'metadata',
    // shapes
    'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path',
    // text
    'text', 'tspan', 'textpath',
    // paint servers and clipping
    'lineargradient', 'radialgradient', 'stop', 'pattern',
    'clippath', 'mask', 'marker', 'filter', 'image',
    // filter primitives
    'feblend', 'fecolormatrix', 'fecomponenttransfer', 'fecomposite',
    'feconvolvematrix', 'fediffuselighting', 'fedisplacementmap',
    'fedistantlight', 'fedropshadow', 'feflood', 'fefunca', 'fefuncb',
    'fefuncg', 'fefuncr', 'fegaussianblur', 'feimage', 'femerge',
    'femergenode', 'femorphology', 'feoffset', 'fepointlight',
    'fespecularlighting', 'fespotlight', 'fetile', 'feturbulence',
    // animation (attribute targets are checked separately)
    'animate', 'animatetransform', 'animatemotion', 'set', 'mpath',
]));

/**
 * Whether the element allowlist is enforced. On by default. This is the one
 * check that can reject SVG which previously rendered, so it is switchable
 * without a rebuild if something in the existing on-chain corpus trips it.
 * @type {boolean}
 */
let SVG_ALLOWLIST_ENABLED = true;

/**
 * @param {boolean} enabled
 */
export function setSvgAllowlist(enabled) {
    SVG_ALLOWLIST_ENABLED = enabled !== false;
}

/**
 * Validates SVG markup embedded in data URIs.
 *
 * This is a denylist, and denylists lose to encoding tricks unless the input
 * is normalised first. Three normalisation steps run before any pattern is
 * matched, each closing a bypass that was live against the previous version:
 *
 *   1. **Encoding.** `atob()` yields bytes. A UTF-16LE SVG decodes to
 *      `\0<\0s\0c\0r...`, so `includes('<script')` never fires — while the
 *      browser honours the BOM and parses it as XML perfectly well. Rather
 *      than try to decode every encoding a browser accepts, anything that is
 *      not UTF-8/ASCII is rejected outright. Legitimate SVG reaching here is
 *      machine-generated ASCII.
 *   2. **Character references.** `&#106;avascript:` is `javascript:` to a
 *      parser and is not to `indexOf`. References are expanded first,
 *      repeatedly, to catch double encoding.
 *   3. **URL invisibles.** Browsers strip TAB, LF, CR and NUL from URLs
 *      before resolving a scheme, so `jav&#9;ascript:` runs. They are
 *      stripped before the scheme checks.
 *
 * Scope note: an SVG loaded through `<img>` cannot execute script in any
 * current browser, so most of this is defence for the paths where the same
 * value gets rendered as a document — `<object>`, `<embed>`, a new tab, or
 * inline injection. The validator is shared, so it is held to the stricter
 * bar rather than the `<img>` bar.
 */
class SvgSecurityAnalyzer {

    static #MAX_DECODED_LENGTH = 2_000_000;
    static #MAX_ELEMENTS       = 20_000;

    static #DANGEROUS_ELEMENTS = Object.freeze([
        '<script', '<foreignobject', '<handler', '<iframe',
        '<object', '<embed', '<applet', '<audio', '<video',
        '<link', '<meta', '<base',
    ]);

    static #DANGEROUS_SCHEMES = Object.freeze([
        'javascript:', 'vbscript:', 'livescript:', 'mocha:',
        'data:text/html', 'data:application/', 'data:text/xml',
        'data:image/svg',
    ]);

    static #CSS_ATTACKS = Object.freeze([
        'expression(', 'expression (',
        '-moz-binding',
        'behavior:',
        'url(javascript', 'url( javascript',
        'url(data:text', 'url( data:text',
        '@import',
    ]);

    /** @type {RegExp} — matches on[a-z]+= (all 60+ SVG event handlers) */
    static #EVENT_HANDLER_RE = /\bon[a-z]+\s*=/i;

    /** @type {RegExp} — animate elements targeting dangerous attributes */
    static #ANIMATE_RE = /<(?:animate|animatetransform|animatemotion|set)\b[^>]*attributename\s*=\s*["'](?:href|xlink:href|src|action|formaction|style|class)/i;

    /** @type {RegExp} — external references from any resource-loading element */
    static #EXTERNAL_REF_RE = /<(?:use|image|feimage|filter|pattern|mask|textpath|mpath)\b[^>]*(?:xlink:)?href\s*=\s*["']\s*(?:https?:|\/\/)/i;

    /** @type {RegExp} — characters browsers discard when resolving a URL */
    static #URL_INVISIBLES_RE = /[\u0000-\u0020\u00A0\u1680\u2000-\u200D\u2028\u2029\u202F\u205F\u3000\uFEFF]/g;

    static #NAMED_ENTITIES = Object.freeze({
        lt: '<', gt: '>', amp: '&', quot: '"', apos: "'",
        tab: '\t', newline: '\n', colon: ':', sol: '/', lpar: '(', rpar: ')',
    });

    /**
     * Decode bytes to text, refusing anything that is not UTF-8/ASCII.
     *
     * A NUL byte or a UTF-16/32 BOM means the document is in an encoding this
     * scanner cannot reason about, and every string check below would silently
     * pass. Reject rather than guess.
     *
     * @param {Uint8Array} bytes
     * @returns {string|null} decoded text, or null if it must not be trusted
     */
    static #toText(bytes) {
        if (bytes.length > SvgSecurityAnalyzer.#MAX_DECODED_LENGTH) return null;

        if (bytes.length >= 2) {
            const b0 = bytes[0], b1 = bytes[1];
            if ((b0 === 0xFF && b1 === 0xFE) || (b0 === 0xFE && b1 === 0xFF)) return null;  // UTF-16
        }
        if (bytes.length >= 4 && bytes[0] === 0 && bytes[1] === 0) return null;             // UTF-32BE
        if (bytes.includes(0x00)) return null;                                              // stray NUL

        try {
            return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        } catch {
            return null;
        }
    }

    /**
     * Expand XML/HTML character references so pattern matching sees what the
     * parser will see. Repeated to catch `&amp;#106;` → `&#106;` → `j`.
     *
     * @param {string} s
     * @returns {string}
     */
    static #decodeEntities(s) {
        let out = s;
        for (let round = 0; round < 3; round++) {
            const next = out
                .replace(/&#x([0-9a-f]{1,6});?/gi, (m, h) => {
                    const c = parseInt(h, 16);
                    try { return c <= 0x10FFFF ? String.fromCodePoint(c) : m; } catch { return m; }
                })
                .replace(/&#(\d{1,7});?/g, (m, d) => {
                    const c = parseInt(d, 10);
                    try { return c <= 0x10FFFF ? String.fromCodePoint(c) : m; } catch { return m; }
                })
                .replace(/&([a-z]+);/gi, (m, n) =>
                    SvgSecurityAnalyzer.#NAMED_ENTITIES[n.toLowerCase()] ?? m);
            if (next === out) break;
            out = next;
        }
        return out;
    }

    /**
     * Check whether decoded SVG bytes are safe to render.
     *
     * @param {Uint8Array} bytes — raw decoded bytes of the SVG
     * @returns {{ ok: boolean, reason?: string }}
     */
    static inspect(bytes) {
        const text = SvgSecurityAnalyzer.#toText(bytes);
        if (text === null) return { ok: false, reason: 'svg-bad-encoding' };

        // An XML declaration claiming a non-UTF-8 encoding means the browser
        // will decode differently than we just did.
        const decl = text.slice(0, 256).match(/encoding\s*=\s*["']([^"']+)["']/i);
        if (decl && !/^(utf-?8|us-ascii|ascii)$/i.test(decl[1].trim())) {
            return { ok: false, reason: 'svg-foreign-encoding' };
        }

        // Doctypes and entity declarations have no legitimate use in an inline
        // SVG and are the entry point for XXE and billion-laughs expansion.
        const early = text.toLowerCase();
        if (early.includes('<!doctype') || early.includes('<!entity')) {
            return { ok: false, reason: 'svg-doctype' };
        }

        const elementCount = (text.match(/</g) || []).length;
        if (elementCount > SvgSecurityAnalyzer.#MAX_ELEMENTS) {
            return { ok: false, reason: 'svg-too-many-elements' };
        }

        const decoded = SvgSecurityAnalyzer.#decodeEntities(text);
        const lower   = decoded.toLowerCase();

        for (const el of SvgSecurityAnalyzer.#DANGEROUS_ELEMENTS) {
            if (lower.includes(el)) return { ok: false, reason: `svg-element:${el.slice(1)}` };
        }

        if (SvgSecurityAnalyzer.#EVENT_HANDLER_RE.test(decoded)) {
            return { ok: false, reason: 'svg-event-handler' };
        }

        // Scheme checks run against a copy with URL-invisible characters
        // removed, because that is what the browser resolves.
        const collapsed = lower.replace(SvgSecurityAnalyzer.#URL_INVISIBLES_RE, '');
        for (const scheme of SvgSecurityAnalyzer.#DANGEROUS_SCHEMES) {
            if (collapsed.includes(scheme)) return { ok: false, reason: `svg-scheme:${scheme}` };
        }

        for (const css of SvgSecurityAnalyzer.#CSS_ATTACKS) {
            if (collapsed.includes(css)) return { ok: false, reason: 'svg-css-attack' };
        }

        if (SvgSecurityAnalyzer.#EXTERNAL_REF_RE.test(decoded)) {
            return { ok: false, reason: 'svg-external-ref' };
        }
        if (SvgSecurityAnalyzer.#ANIMATE_RE.test(decoded)) {
            return { ok: false, reason: 'svg-animate-attack' };
        }

        // Element allowlist — the primary control. Everything above is the
        // second layer.
        if (SVG_ALLOWLIST_ENABLED) {
            const tags = decoded.match(/<\s*([a-zA-Z][a-zA-Z0-9-]*)/g) || [];
            for (const raw of tags) {
                const tag = raw.replace(/^<\s*/, '').toLowerCase();
                if (!SVG_ALLOWED_ELEMENTS.has(tag)) {
                    return { ok: false, reason: `svg-element-not-allowed:${tag}` };
                }
            }
        }

        // Filter primitives are cheap to write and expensive to render. A
        // hand-crafted feGaussianBlur with a huge stdDeviation, or feTurbulence
        // with a high octave count, will pin the compositor on an otherwise
        // valid image — the one denial-of-service an <img> tag cannot refuse.
        for (const [attr, limit] of [['stddeviation', 500], ['numoctaves', 8], ['scale', 1000]]) {
            const re = new RegExp(attr + '\\s*=\\s*["\']([^"\']*)', 'gi');
            let m;
            while ((m = re.exec(decoded)) !== null) {
                for (const part of m[1].trim().split(/[\s,]+/)) {
                    if (Math.abs(parseFloat(part)) > limit) {
                        return { ok: false, reason: `svg-filter-cost:${attr}` };
                    }
                }
            }
        }

        return { ok: true };
    }

    /**
     * @deprecated Kept for the old string-based call shape.
     * @param {string} decoded
     * @returns {boolean}
     */
    static isSafe(decoded) {
        const bytes = new Uint8Array(decoded.length);
        for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i) & 0xFF;
        return SvgSecurityAnalyzer.inspect(bytes).ok;
    }
}

// ═══════════════════════════════════════════════════════════
// Image format sniffing
// ═══════════════════════════════════════════════════════════

/**
 * Identify a format from its leading bytes.
 *
 * The declared MIME type in a data URI is attacker-controlled and must never
 * decide how the bytes are treated. Declaring `image/png` over SVG markup
 * used to skip the SVG analysis entirely.
 *
 * @param {Uint8Array} b
 * @returns {string|null} canonical MIME, or null if unrecognised
 */
/**
 * Base64 characters to decode when only a header is needed. 87_384 chars is
 * ~64 KB — comfortably past a JPEG's SOF marker even behind a large EXIF
 * block, and a multiple of 4 so the slice stays on a base64 group boundary.
 */
const PREFIX_B64_CHARS = 87_384;

/**
 * @param {string} b64
 * @returns {Uint8Array}
 */
function decodeBase64(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

function sniffImageType(b) {
    const at = (i, ...sig) => sig.every((v, k) => b[i + k] === v);

    if (b.length >= 8 && at(0, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)) return 'image/png';
    if (b.length >= 3 && at(0, 0xFF, 0xD8, 0xFF))                               return 'image/jpeg';
    if (b.length >= 6 && at(0, 0x47, 0x49, 0x46, 0x38))                         return 'image/gif';
    if (b.length >= 2 && at(0, 0x42, 0x4D))                                     return 'image/bmp';
    if (b.length >= 4 && at(0, 0x00, 0x00, 0x01, 0x00))                         return 'image/x-icon';
    if (b.length >= 12 && at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp';
    if (b.length >= 12 && at(4, 0x66, 0x74, 0x79, 0x70)) {
        const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
        if (brand === 'avif' || brand === 'avis') return 'image/avif';
    }

    // SVG is text. Skip a UTF-8 BOM and leading whitespace, then look for the
    // XML prolog, a comment, or the root element.
    let i = (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) ? 3 : 0;
    while (i < b.length && b[i] <= 0x20) i++;
    const head = String.fromCharCode(...b.slice(i, i + 64)).toLowerCase();
    // '<!doctype' is included so a legacy DOCTYPE-prefixed SVG is identified
    // and then rejected by the analyzer with an accurate reason, rather than
    // falling through here as an unrecognised format.
    if (head.startsWith('<?xml') || head.startsWith('<svg') ||
        head.startsWith('<!--') || head.startsWith('<!doctype')) return 'image/svg+xml';

    return null;
}

/**
 * Read intrinsic dimensions from a raster header.
 *
 * Needed because file size says nothing about decoded cost: a ~5 kB PNG can
 * declare 30000×30000 and expand to gigabytes of RGBA in the decoder, taking
 * the tab with it. That is the one attack an `<img>` tag cannot defend against
 * on its own.
 *
 * @param {string} mime
 * @param {Uint8Array} b
 * @returns {{ width: number, height: number }|null} null when not derivable
 */
function readDimensions(mime, b) {
    const be32 = (i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
    const le16 = (i) => b[i] | (b[i + 1] << 8);
    const le32 = (i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

    switch (mime) {
        case 'image/png':
            if (b.length < 24) return null;
            return { width: be32(16), height: be32(20) };

        case 'image/gif':
            if (b.length < 10) return null;
            return { width: le16(6), height: le16(8) };

        case 'image/bmp':
            if (b.length < 26) return null;
            return { width: le32(18), height: Math.abs(le32(22) | 0) };

        case 'image/jpeg': {
            let i = 2;
            while (i + 9 < b.length) {
                if (b[i] !== 0xFF) { i++; continue; }
                const marker = b[i + 1];
                // SOF0..SOF15, excluding DHT (C4), JPG (C8) and DAC (CC)
                if (marker >= 0xC0 && marker <= 0xCF &&
                    marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
                    return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
                }
                const len = (b[i + 2] << 8) | b[i + 3];
                if (len < 2) return null;
                i += 2 + len;
            }
            return null;
        }

        case 'image/webp': {
            if (b.length < 30) return null;
            const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
            if (chunk === 'VP8X') {
                return {
                    width:  1 + (b[24] | (b[25] << 8) | (b[26] << 16)),
                    height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)),
                };
            }
            if (chunk === 'VP8 ') {
                return { width: le16(26) & 0x3FFF, height: le16(28) & 0x3FFF };
            }
            if (chunk === 'VP8L') {
                const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
                return { width: 1 + (bits & 0x3FFF), height: 1 + ((bits >>> 14) & 0x3FFF) };
            }
            return null;
        }

        default:
            return null;   // ICO and AVIF: capped by byte size only
    }
}

// ═══════════════════════════════════════════════════════════
// Image Utilities
// ═══════════════════════════════════════════════════════════

/** @type {RegExp} */
const BASE64_IMAGE_RE = /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml|bmp|ico|avif);base64,[A-Za-z0-9+/=]+$/;

class ImageUtils {

    static #MAX_BASE64_LENGTH = 7_000_000;
    /** Decoded-pixel ceiling. A few kB of PNG can declare 30000x30000. */
    static #MAX_PIXELS        = 40_000_000;
    static #MAX_URL_LENGTH    = 4_096;
    static #IMG_TAG_RE  = /<img[ \t\n\r][^>]*>/gi;
    static #SRC_ATTR_RE = /src[ \t\n\r]*=[ \t\n\r]*["']([^"']+)["']/i;
    static #ALT_ATTR_RE = /alt[ \t\n\r]*=[ \t\n\r]*["']([^"']*)["']/i;

    /**
     * Fully inspect a base64 image data URI.
     *
     * The single gate for every base64 image in the app: post bodies (pixel
     * art is stored this way), profile images and community images out of
     * on-chain JSON metadata, and the data viewer's preview. All of that is
     * attacker-controlled — anyone can write anything into their own profile
     * metadata on a public chain — so the declared MIME type is treated as a
     * claim and nothing more.
     *
     * @param {string} dataUri
     * @returns {{ ok: boolean, reason?: string, mime?: string, bytes?: number,
     *             width?: number, height?: number, declared?: string }}
     */
    static inspectDataUri(dataUri) {
        if (typeof dataUri !== 'string')                       return { ok: false, reason: 'not-a-string' };
        if (dataUri.length > ImageUtils.#MAX_BASE64_LENGTH)     return { ok: false, reason: 'too-long' };

        const m = dataUri.match(BASE64_IMAGE_RE);
        if (!m) return { ok: false, reason: 'malformed-data-uri' };
        const declared = `image/${m[1] === 'jpg' ? 'jpeg' : m[1]}`;

        const comma = dataUri.indexOf(',');
        const b64   = dataUri.slice(comma + 1);

        // Length must be a multiple of 4 with padding only at the end. atob is
        // lenient about both, so a malformed payload would otherwise reach a
        // decoder as a "valid" image.
        if (b64.length % 4 !== 0)                              return { ok: false, reason: 'bad-base64-length' };
        if (/=[^=]/.test(b64))                                 return { ok: false, reason: 'bad-base64-padding' };

        // Byte count without decoding anything.
        const padding   = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
        const byteCount = (b64.length / 4) * 3 - padding;
        if (!byteCount)                                        return { ok: false, reason: 'empty' };

        // Decode a prefix only. A raster's format and dimensions live in the
        // header, and this path runs on every sanitize pass — twice per render
        // under the two-layer contract — so decoding a multi-megabyte pixel-art
        // body in full to read 24 bytes of IHDR is not affordable. SVG is the
        // exception: it is text and every byte has to be scanned.
        const prefixB64 = b64.length > PREFIX_B64_CHARS ? b64.slice(0, PREFIX_B64_CHARS) : b64;

        let bytes;
        try {
            bytes = decodeBase64(prefixB64);
        } catch {
            return { ok: false, reason: 'undecodable-base64' };
        }
        if (!bytes.length)                                     return { ok: false, reason: 'empty' };

        // What the bytes ARE, not what the URI claims they are.
        const sniffed = sniffImageType(bytes);
        if (!sniffed)                                          return { ok: false, reason: 'unrecognised-format', declared, bytes: byteCount };
        if (sniffed !== declared) {
            return { ok: false, reason: `mime-mismatch:${declared}-vs-${sniffed}`, declared, mime: sniffed, bytes: byteCount };
        }

        if (sniffed === 'image/svg+xml') {
            let full = bytes;
            if (b64.length > PREFIX_B64_CHARS) {
                try { full = decodeBase64(b64); }
                catch { return { ok: false, reason: 'undecodable-base64' }; }
            }
            const verdict = SvgSecurityAnalyzer.inspect(full);
            if (!verdict.ok) return { ok: false, reason: verdict.reason, mime: sniffed, declared, bytes: byteCount };
            return { ok: true, mime: sniffed, declared, bytes: byteCount };
        }

        const dims = readDimensions(sniffed, bytes);
        if (dims) {
            if (!dims.width || !dims.height) {
                return { ok: false, reason: 'zero-dimension', mime: sniffed, declared, bytes: byteCount };
            }
            if (dims.width * dims.height > ImageUtils.#MAX_PIXELS) {
                return {
                    ok: false, reason: 'decompression-bomb', mime: sniffed, declared,
                    bytes: byteCount, width: dims.width, height: dims.height,
                };
            }
        }

        return { ok: true, mime: sniffed, declared, bytes: byteCount, ...(dims || {}) };
    }

    /**
     * Validate a base64 data URI image.
     * @param {string} dataUri
     * @returns {boolean}
     */
    static isValidBase64(dataUri) {
        return ImageUtils.inspectDataUri(dataUri).ok;
    }

    /**
     * Validate an image URL. HTTPS only — plaintext http is not an image we
     * are willing to render, and a scheme-relative URL is normalised to https
     * before it gets here.
     * @param {string} url
     * @returns {boolean}
     */
    static isValidUrl(url) {
        if (!url.startsWith('https://')) return false;
        const lower = url.toLowerCase();
        if (lower.includes('javascript:') || lower.includes('vbscript:')) return false;
        return url.length <= ImageUtils.#MAX_URL_LENGTH;
    }

    /**
     * Extract image metadata from HTML.
     * @param {string} html — sanitized or raw HTML
     * @returns {Array<{ src: string, alt: string, is_base64: boolean, index: number }>}
     */
    static extract(html) {
        const images = [];
        let index = 0;
        const re = new RegExp(ImageUtils.#IMG_TAG_RE.source, 'gi');
        let match;

        while ((match = re.exec(html)) !== null) {
            const tag      = match[0];
            const srcMatch = ImageUtils.#SRC_ATTR_RE.exec(tag);
            if (!srcMatch?.[1]) continue;

            const src      = srcMatch[1];
            const altMatch = ImageUtils.#ALT_ATTR_RE.exec(tag);
            const alt      = altMatch?.[1] ?? '';
            const isBase64 = src.startsWith('data:');

            if (isBase64 && !ImageUtils.isValidBase64(src)) continue;
            if (!isBase64 && !ImageUtils.isValidUrl(src))   continue;

            images.push({ src, alt, is_base64: isBase64, index: index++ });
        }
        return images;
    }

    // NOTE: a `limit(html, maxCount)` helper used to live here and deleted
    // <img> tags from already-rendered HTML. Removed deliberately — capping
    // images is a property of the extracted index, not of the body. Nothing
    // in this module rewrites markup after sanitize-html any more.
}

// ═══════════════════════════════════════════════════════════
// Image Proxy
// ═══════════════════════════════════════════════════════════

/**
 * Default image proxy prefix — the deployed pixa-image-service worker.
 * @type {string}
 */
export const DEFAULT_IMAGE_PROXY_BASE = 'https://pixa-image-service.p1x4.workers.dev/?url=';

/**
 * Base URL of the image proxy worker. Every non-base64 image is rewritten to
 * sit behind it, so the browser never fetches a third-party origin directly.
 *
 * Module-level rather than per-call because safeHTML() — the component-side
 * guard — has no access to the api instance and must apply the same rule.
 * Defaults to the deployed worker, so proxying is on even if nothing calls
 * setImageProxyBase(); pass null to that to turn it off.
 *
 * @type {string|null} null disables proxying (images are emitted direct).
 */
let IMAGE_PROXY_BASE = DEFAULT_IMAGE_PROXY_BASE;

/**
 * Configure the image proxy prefix.
 *
 * The whole prefix is yours, so either URL shape works:
 *   'https://img.example.com/?url='   → query style
 *   'https://img.example.com/p/'      → path style
 * The original URL is appended encodeURIComponent'd, so query strings and
 * fragments in the source URL survive intact.
 *
 * @param {string|null} base — prefix, or null/'' to disable proxying
 */
export function setImageProxyBase(base) {
    IMAGE_PROXY_BASE = (typeof base === 'string' && base) ? base : null;
}

/** @returns {string|null} the configured prefix */
export function getImageProxyBase() {
    return IMAGE_PROXY_BASE;
}

/**
 * sanitize-html `transformTags` handler for `<img>`.
 *
 * Runs INSIDE sanitize-html — deliberately, so the sanitizer stays the only
 * stage that writes markup — and before scheme filtering, so a src it rewrites
 * is still scheme-checked afterwards.
 *
 * Three rules:
 *   1. Anything that is not `data:image/…` or `https://` loses its src and is
 *      then dropped whole by exclusiveFilter. That covers plaintext http,
 *      javascript:, relative paths and malformed data URIs. An insecure image
 *      is removed, not downgraded to a broken tag.
 *   2. Scheme-relative `//host/x.png` is normalised to https first. It is not
 *      plaintext — it inherits the page scheme, which is https.
 *   3. Everything else non-base64 is prefixed with the proxy.
 *
 * Idempotent, which is not optional: sanitisation runs once in pixaproxyapi
 * and again in the component, so a src already behind the proxy must be left
 * alone rather than wrapped twice.
 *
 * @param {string|null} proxyBase — per-call override; falls back to module state
 * @returns {function(string, object): { tagName: string, attribs: object }}
 */
function makeImgTransform(proxyBase) {
    return (tagName, attribs) => {
        // Resolved per call, not per factory call: SanitizeConfigs is built at
        // module load, before setImageProxyBase() runs. Capturing here would
        // freeze the base at null forever.
        const base = proxyBase === undefined ? IMAGE_PROXY_BASE : proxyBase;

        const drop = { tagName: 'img', attribs: {} };
        let src = (attribs.src || '').trim();
        if (!src) return drop;

        if (src.startsWith('//')) src = `https:${src}`;

        if (/^data:/i.test(src)) {
            return ImageUtils.isValidBase64(src)
                ? { tagName: 'img', attribs: { ...attribs, src } }
                : drop;
        }

        if (!ImageUtils.isValidUrl(src)) return drop;

        if (base && !src.startsWith(base)) src = base + encodeURIComponent(src);

        return { tagName: 'img', attribs: { ...attribs, src } };
    };
}

/** Discard `<img>` elements the transform emptied out. */
function dropSrclessImages(frame) {
    return frame.tag === 'img' && !frame.attribs.src;
}

// ═══════════════════════════════════════════════════════════
// Text Processing Utilities
// ═══════════════════════════════════════════════════════════

class TextProcessor {

    static #HTML_ENTITY_MAP = Object.freeze({
        '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
        '&apos;': "'", '&#x27;': "'", '&#39;': "'", '&nbsp;': ' ',
        '&ndash;': '\u2013', '&mdash;': '\u2014',
        '&lsquo;': '\u2018', '&rsquo;': '\u2019',
        '&ldquo;': '\u201c', '&rdquo;': '\u201d',
        '&hellip;': '\u2026', '&copy;': '\u00a9', '&reg;': '\u00ae',
        '&trade;': '\u2122', '&euro;': '\u20ac', '&pound;': '\u00a3',
        '&yen;': '\u00a5', '&cent;': '\u00a2', '&deg;': '\u00b0',
        '&times;': '\u00d7', '&divide;': '\u00f7', '&bull;': '\u2022',
        '&rarr;': '\u2192', '&larr;': '\u2190', '&uarr;': '\u2191', '&darr;': '\u2193',
    });

    /** Detect whether content is predominantly HTML vs Markdown. */
    static isPredominantlyHtml(content) {
        const trimmed = content.trim();
        if (/^<(!|html|div|p[ >])/.test(trimmed)) return true;

        const htmlIndicators = [
            '<p>', '<p ', '</p>', '<div', '</div>', '<h1', '<h2', '<h3',
            '<h4', '<h5', '<h6', '<table', '<tr', '<td', '<ul>', '<ol>',
            '</ul>', '</ol>', '<blockquote', '</blockquote>',
            '<br>', '<br/>', '<br />', '<hr>', '<hr/>', '<hr />',
        ];
        const mdIndicators = [
            '\n# ', '\n## ', '\n### ', '\n- ', '\n* ', '\n1. ',
            '\n> ', '\n```', '\n---', '\n***', '\n___', '\n|',
        ];

        const count = (indicators) => {
            let n = 0;
            for (const ind of indicators) {
                let idx = -1;
                while ((idx = content.indexOf(ind, idx + 1)) !== -1) n++;
            }
            return n;
        };

        const htmlCount = count(htmlIndicators);
        const mdCount   = count(mdIndicators);
        return htmlCount > mdCount && htmlCount >= 2;
    }

    /** Convert Markdown to HTML. */
    static markdownToHtml(md) {
        return marked.parse(md);
    }

    /** Decode HTML entities (named + numeric). */
    static decodeEntities(text) {
        let result = text;
        for (const [entity, replacement] of Object.entries(TextProcessor.#HTML_ENTITY_MAP)) {
            result = result.replaceAll(entity, replacement);
        }
        return result.replace(/&(#?[a-zA-Z0-9_]+);/g, (match, entity) => {
            if (entity.startsWith('#x') || entity.startsWith('#X')) {
                return TextProcessor.#codePointOrRaw(parseInt(entity.slice(2), 16), match);
            }
            if (entity.startsWith('#')) {
                return TextProcessor.#codePointOrRaw(parseInt(entity.slice(1), 10), match);
            }
            return match;
        });
    }

    /**
     * String.fromCodePoint throws RangeError outside 0…0x10FFFF, and lone
     * surrogates produce broken output. The old guard was `isFinite(code) &&
     * code > 0`, so a body containing `&#99999999;` threw straight out of
     * extractPlainText()/summarizeContent() — trivially reachable from any
     * user-authored post.
     *
     * @param {number} code
     * @param {string} raw — original entity text, returned unchanged if invalid
     * @returns {string}
     */
    static #codePointOrRaw(code, raw) {
        if (!Number.isInteger(code) || code <= 0 || code > 0x10FFFF) return raw;
        if (code >= 0xD800 && code <= 0xDFFF) return raw;   // lone surrogate
        try { return String.fromCodePoint(code); } catch { return raw; }
    }

    /** Strip HTML tags and decode entities → plain text. */
    static htmlToPlainText(html) {
        let text = html;
        text = text.replace(/<br[ \t\n\r]*\/?>/gi, '\n');
        text = text.replace(/<\/?(p|div|h[1-6]|li|tr|blockquote|section|article|figure|figcaption|details|summary|dt|dd)(?:[ \t\n\r/][^>]*)?>/gi, '\n');
        text = text.replace(/<hr[ \t\n\r]*\/?>/gi, '\n');
        text = text.replace(/<[^>]+>/g, '');
        text = TextProcessor.decodeEntities(text);
        text = text.split('\n').map(l => l.trim()).join('\n');
        text = text.replace(/\n{3,}/g, '\n\n');
        return text.trim();
    }

    /** Normalize whitespace to single spaces. */
    static normalizeWhitespace(text) {
        return text.trim().replace(/[ \t\n\r\f]+/g, ' ');
    }

    /** Truncate body without splitting inside HTML tags. */
    static truncate(body, maxLen) {
        if (maxLen <= 0 || body.length <= maxLen) return body;
        const truncated = body.slice(0, maxLen);
        const lastLt = truncated.lastIndexOf('<');
        if (lastLt !== -1 && lastLt > maxLen - 200) return truncated.slice(0, lastLt);
        return truncated;
    }
}

// ═══════════════════════════════════════════════════════════
// Mention & Hashtag Processor
// ═══════════════════════════════════════════════════════════

class MentionProcessor {

    static #MENTION_RE = /(^|[ \t\n\r>(])@([a-zA-Z][a-zA-Z0-9.\-]{2,15})/g;
    static #HASHTAG_RE = /(^|[ \t\n\r>(])#([a-zA-Z][a-zA-Z0-9\-]{0,31})/g;

    static #htmlEscape(s) {
        return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    static #isValidUsername(username) {
        return username.length >= 3 && username.length <= 16
            && /^[a-z]/.test(username) && /^[a-z0-9.\-]+$/.test(username)
            && !/[.\-]{2}/.test(username) && !/[.\-]$/.test(username);
    }

    static #isContinuationChar(text, pos) {
        if (pos >= text.length) return false;
        const c = text.charCodeAt(pos);
        return (c >= 0x61 && c <= 0x7a) || (c >= 0x41 && c <= 0x5a)
            || (c >= 0x30 && c <= 0x39) || c === 0x2e || c === 0x2d;
    }

    static #isHashtagContinuation(text, pos) {
        if (pos >= text.length) return false;
        const c = text.charCodeAt(pos);
        return (c >= 0x61 && c <= 0x7a) || (c >= 0x41 && c <= 0x5a)
            || (c >= 0x30 && c <= 0x39) || c === 0x2d;
    }

    static #replaceWithBoundaryCheck(text, re, isContinuation, makeReplacement) {
        re.lastIndex = 0;
        let result  = '';
        let lastEnd = 0;
        let match;

        while ((match = re.exec(text)) !== null) {
            if (match.index < lastEnd) continue;
            if (isContinuation(text, match.index + match[0].length)) continue;

            const replacement = makeReplacement(match[2]);
            if (replacement !== null) {
                result += text.slice(lastEnd, match.index) + match[1] + replacement;
                lastEnd = match.index + match[0].length;
            }
        }
        return result + text.slice(lastEnd);
    }

    static #findTagEnd(html, start) {
        let pos     = start + 1;
        let inQuote = false;
        let quoteChar = '';
        while (pos < html.length) {
            const c = html[pos];
            if (inQuote) { if (c === quoteChar) inQuote = false; }
            else if (c === '"' || c === "'") { inQuote = true; quoteChar = c; }
            else if (c === '>') return pos;
            pos++;
        }
        return -1;
    }

    /**
     * Process @mentions and #hashtags in HTML, respecting link nesting.
     * @param {string} html
     * @returns {string}
     */
    static process(html) {
        let result = '';
        let pos = 0;
        let linkDepth = 0;

        while (pos < html.length) {
            if (html[pos] === '<') {
                const tagEnd = MentionProcessor.#findTagEnd(html, pos);
                if (tagEnd !== -1) {
                    const tag = html.slice(pos, tagEnd + 1);
                    const lower = tag.toLowerCase();
                    if (lower.startsWith('<a ') || lower === '<a>') linkDepth++;
                    else if (lower.startsWith('</a'))                linkDepth = Math.max(0, linkDepth - 1);
                    result += tag;
                    pos = tagEnd + 1;
                } else {
                    result += '<';
                    pos++;
                }
            } else {
                let textStart = pos;
                while (pos < html.length && html[pos] !== '<') pos++;
                const text = html.slice(textStart, pos);

                if (linkDepth > 0) {
                    result += text;
                } else {
                    let processed = MentionProcessor.#replaceWithBoundaryCheck(
                        text,
                        new RegExp(MentionProcessor.#MENTION_RE.source, 'g'),
                        MentionProcessor.#isContinuationChar,
                        (username) => {
                            const lower = username.toLowerCase();
                            if (!MentionProcessor.#isValidUsername(lower)) return null;
                            const esc = MentionProcessor.#htmlEscape(lower);
                            return `<a href="/@${esc}" class="pixa-mention" data-username="${esc}">@${esc}</a>`;
                        },
                    );
                    processed = MentionProcessor.#replaceWithBoundaryCheck(
                        processed,
                        new RegExp(MentionProcessor.#HASHTAG_RE.source, 'g'),
                        MentionProcessor.#isHashtagContinuation,
                        (tag) => {
                            const esc = MentionProcessor.#htmlEscape(tag.toLowerCase());
                            return `<a href="/trending/${esc}" class="pixa-hashtag">#${esc}</a>`;
                        },
                    );
                    result += processed;
                }
            }
        }
        return result;
    }
}

// ═══════════════════════════════════════════════════════════
// Link Processor
// ═══════════════════════════════════════════════════════════

class LinkProcessor {

    static #DEFAULT_INTERNAL_DOMAINS = Object.freeze([
        'pixa.pics', 'pixagram.com', 'hive.blog', 'peakd.com', 'ecency.com',
        'hivesigner.com', 'hive-keychain.com', 'splinterlands.com',
        'images.hive.blog', 'files.peakd.com', 'steemitimages.com', 'imgp.steemit.com',
    ]);

    static #LINK_TAG_RE  = /(<a[ \t\n\r][^>]*>)([\s\S]*?)<\/a>/gi;
    static #HREF_ATTR_RE = /href[ \t\n\r]*=[ \t\n\r]*["']([^"']+)["']/i;

    static #extractDomain(href) {
        try {
            return new URL(href.startsWith('//') ? `https:${href}` : href).hostname;
        } catch { return ''; }
    }

    static #isInternal(domain, customDomains) {
        const lower = domain.toLowerCase();
        const all   = [...LinkProcessor.#DEFAULT_INTERNAL_DOMAINS, ...customDomains];
        return all.some(d => {
            const dl = d.toLowerCase();
            return lower === dl || lower.endsWith(`.${dl}`);
        });
    }

    static #stripTags(s) {
        let result = '';
        let inTag  = false;
        for (const c of s) {
            if (c === '<') inTag = true;
            else if (c === '>') inTag = false;
            else if (!inTag) result += c;
        }
        return result;
    }

    /**
     * Build a sanitize-html `transformTags` handler for `<a>`.
     *
     * This used to be a regex rewrite that ran AFTER sanitize-html, which meant
     * the last thing touching the markup was not the sanitizer. It re-emitted
     * `innerText` verbatim and hand-escaped the href, so it was not exploitable
     * — but the invariant "whatever the sanitizer returns is what reaches the
     * DOM" is worth more than the convenience. Doing it as a transform also
     * means the real HTML parser decides what an `<a>` tag is, instead of
     * `/(<a[ \t\n\r][^>]*>)([\s\S]*?)<\/a>/`.
     *
     * @param {string[]} customDomains — additional domains treated as internal
     * @returns {function(string, object): { tagName: string, attribs: object }}
     */
    static makeTransform(customDomains = []) {
        return (tagName, attribs) => {
            const out = { ...attribs, rel: 'noopener noreferrer' };
            const cls = typeof attribs.class === 'string' ? attribs.class : '';

            // Mentions and hashtags are internal by construction.
            if (cls.includes('pixa-mention') || cls.includes('pixa-hashtag')) {
                return { tagName, attribs: out };
            }

            const href   = typeof attribs.href === 'string' ? attribs.href : '';
            const domain = LinkProcessor.#extractDomain(href);
            const isExternal = href !== ''
                && !href.startsWith('/') && !href.startsWith('#') && !href.startsWith('mailto:')
                && domain !== '' && !LinkProcessor.#isInternal(domain, customDomains);

            if (isExternal) {
                out.class = cls ? `${cls} pixa-external-link` : 'pixa-external-link';
                out['data-external'] = 'true';
                out['data-domain']   = domain;
                out.target           = '_blank';
            }
            return { tagName, attribs: out };
        };
    }

    /**
     * Collect link metadata from already-sanitized HTML. READ-ONLY — returns
     * the same shape as before ({ href, text, domain, is_external }) and does
     * not modify the markup; `is_external` is read back from the data attribute
     * the transform above wrote.
     *
     * @param {string} html — output of sanitize-html
     * @returns {Array<{ href: string, text: string, domain: string, is_external: boolean }>}
     */
    static collect(html) {
        const links = [];
        const re = new RegExp(LinkProcessor.#LINK_TAG_RE.source, 'gi');
        let match;

        while ((match = re.exec(html)) !== null) {
            const openTag   = match[1];
            const innerText = match[2];
            const hrefMatch = LinkProcessor.#HREF_ATTR_RE.exec(openTag);
            if (!hrefMatch?.[1]) continue;

            const href   = hrefMatch[1];
            const isMeta = openTag.includes('pixa-mention') || openTag.includes('pixa-hashtag');

            links.push({
                href,
                text:        LinkProcessor.#stripTags(innerText),
                domain:      isMeta ? '' : LinkProcessor.#extractDomain(href),
                is_external: !isMeta && /data-external[ \t\n\r]*=[ \t\n\r]*["']true["']/i.test(openTag),
            });
        }
        return links;
    }
}

// ═══════════════════════════════════════════════════════════
// sanitize-html Configurations
// ═══════════════════════════════════════════════════════════

const SAFE_CLASS_PATTERNS = [/^pixa-/, /^language-/, /^highlight-/, /^hljs/];

const SanitizeConfigs = Object.freeze({

    memo: {
        allowedTags:       ['strong', 'b', 'em', 'i', 'a'],
        allowedAttributes: { 'a': ['href', 'class', 'data-username'] },
        allowedSchemes:    ['https', 'mailto'],
        transformTags:     { 'a': sanitizeHtmlLib.simpleTransform('a', { rel: 'noopener noreferrer' }) },
    },

    comment: {
        allowedTags: [
            'strong', 'b', 'em', 'i', 'a', 'p', 'br',
            'blockquote', 'pre', 'code', 'ul', 'ol', 'li',
            'u', 's', 'del', 'sub', 'sup', 'mark', 'small',
        ],
        allowedAttributes: {
            // target/data-external/data-domain are what LinkProcessor adds AFTER
            // sanitization. Without them here, the documented "call safeHTML()
            // last" practice silently stripped the external-link treatment.
            'a':    ['href', 'title', 'rel', 'class', 'target', 'data-username', 'data-external', 'data-domain'],
            'code': ['data-language'],
            '*':    ['class'],
        },
        allowedClasses:  { '*': SAFE_CLASS_PATTERNS },
        allowedSchemes:  ['http', 'https', 'mailto'],
        transformTags:   { 'a': sanitizeHtmlLib.simpleTransform('a', { rel: 'noopener noreferrer' }) },
    },

    post: {
        allowedTags: [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
            'div', 'span', 'section', 'blockquote', 'pre', 'code',
            'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
            'caption', 'colgroup', 'col', 'ul', 'ol', 'li',
            'dl', 'dt', 'dd', 'figure', 'figcaption', 'details', 'summary', 'center',
            'a', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins', 'mark',
            'small', 'sub', 'sup', 'abbr', 'cite', 'q', 'kbd', 'var', 'samp', 'time',
            'ruby', 'rt', 'rp', 'img',
        ],
        allowedAttributes: {
            // See the note in the comment tier: these three are added by
            // LinkProcessor after sanitize-html runs, so safeHTML() has to
            // recognise them or it undoes its own pipeline's work.
            'a':          ['href', 'title', 'rel', 'class', 'target', 'data-username', 'data-external', 'data-domain'],
            'img':        ['src', 'alt', 'title', 'width', 'height', 'loading'],
            'td':         ['colspan', 'rowspan', 'align'],
            'th':         ['colspan', 'rowspan', 'align', 'scope'],
            'col':        ['span'],
            'colgroup':   ['span'],
            'code':       ['data-language'],
            'pre':        ['data-language'],
            'time':       ['datetime'],
            'blockquote': ['cite'],
            'abbr':       ['title'],
            '*':          ['class'],
        },
        // http is deliberately absent: a plaintext image is removed, never
        // rendered and never silently upgraded.
        allowedSchemes:            ['http', 'https', 'mailto'],
        allowedSchemesByTag:       { img: ['https', 'data'] },
        allowedClasses:            { '*': [...SAFE_CLASS_PATTERNS, /^text-/, /^align-/] },
        allowProtocolRelative:     true,
        transformTags:             {
            'a':   sanitizeHtmlLib.simpleTransform('a', { rel: 'noopener noreferrer' }),
            'img': makeImgTransform(undefined),
        },
        exclusiveFilter:                   dropSrclessImages,
        allowedSchemesAppliedToAttributes: ['href', 'src', 'cite'],
    },

    strip: {
        allowedTags:       [],
        allowedAttributes: {},
    },
});

// ═══════════════════════════════════════════════════════════
// JSON Sanitizer
// ═══════════════════════════════════════════════════════════

class JsonSanitizer {

    static #MAX_DEPTH       = 5;
    static #MAX_STRING_LEN  = 10_000;
    static #MAX_IMAGE_LEN   = 7_000_000;
    static #MAX_ARRAY_LEN   = 100;
    static #MAX_OBJECT_KEYS = 50;
    static #VALID_KEY_RE    = /^[a-zA-Z_][a-zA-Z0-9_\-]{0,63}$/;
    /** Keys that mutate an object's prototype rather than adding a property.
     *  `__proto__` matches #VALID_KEY_RE (leading underscore is allowed). */
    static #FORBIDDEN_KEYS  = new Set(['__proto__', 'constructor', 'prototype']);

    static sanitize(jsonStr) {
        if (!jsonStr) return '{}';
        try {
            const raw   = JSON.parse(jsonStr);
            const clean = JsonSanitizer.#sanitizeValue(raw, 0);
            return clean !== null ? JSON.stringify(clean) : '{}';
        } catch { return '{}'; }
    }

    static #sanitizeValue(value, depth) {
        if (depth > JsonSanitizer.#MAX_DEPTH) return null;
        if (value === null || value === undefined) return null;

        const type = typeof value;

        if (type === 'string') {
            const limit = value.trim().startsWith('data:image/')
                ? JsonSanitizer.#MAX_IMAGE_LEN
                : JsonSanitizer.#MAX_STRING_LEN;
            return safeString(value, limit);
        }
        if (type === 'number')  return isFinite(value) ? value : null;
        if (type === 'boolean') return value;

        if (Array.isArray(value)) {
            return value.slice(0, JsonSanitizer.#MAX_ARRAY_LEN)
                .map(v => JsonSanitizer.#sanitizeValue(v, depth + 1))
                .filter(v => v !== null);
        }

        if (type === 'object') {
            // Object.create(null): belt and braces alongside #FORBIDDEN_KEYS, so
            // even a missed key name can't reach a real prototype.
            const clean = Object.create(null);
            const keys  = Object.keys(value).slice(0, JsonSanitizer.#MAX_OBJECT_KEYS);
            for (const k of keys) {
                if (!JsonSanitizer.#VALID_KEY_RE.test(k)) continue;
                if (JsonSanitizer.#FORBIDDEN_KEYS.has(k)) continue;
                const v = JsonSanitizer.#sanitizeValue(value[k], depth + 1);
                if (v !== null) clean[k] = v;
            }
            return clean;
        }

        return null;
    }
}

// ═══════════════════════════════════════════════════════════
// TF-IDF Summarizer
// ═══════════════════════════════════════════════════════════

class Summarizer {

    static #STOP_WORDS = new Set([
        'a', 'an', 'the', 'is', 'it', 'of', 'in', 'to', 'and', 'or', 'for',
        'on', 'at', 'by', 'be', 'as', 'so', 'if', 'do', 'no', 'up', 'he',
        'we', 'my', 'me', 'am', 'are', 'was', 'has', 'had', 'not', 'but',
        'its', 'his', 'her', 'she', 'him', 'our', 'you', 'all', 'can', 'did',
        'get', 'got', 'may', 'who', 'how', 'now', 'out', 'own', 'too', 'than',
        'that', 'them', 'then', 'they', 'this', 'from', 'with', 'what', 'when',
        'will', 'been', 'have', 'just', 'more', 'also', 'into', 'some', 'such',
        'very', 'your', 'much', 'were', 'here', 'there', 'which', 'about',
        'their', 'would', 'could', 'should', 'these', 'those', 'being', 'other',
        'after', 'where', 'while', 'because', 'through', 'between', 'before', 'during',
        'https', 'http', 'www', 'com', 'org', 'html',
    ]);

    static #tokenize(text) {
        return text.toLowerCase()
            .split(/[^a-zA-Z0-9']+/)
            .map(w => w.replace(/^'+|'+$/g, ''))
            .filter(w => w.length > 1 && !Summarizer.#STOP_WORDS.has(w));
    }

    static #splitSentences(text) {
        // Single forward scan with index arithmetic instead of re-slicing the
        // remainder and resetting lastIndex on every sentence.
        //
        // NOTE: the previous version was NOT quadratic in practice — V8's
        // sliced strings make `remaining.slice(...)` O(1), so 500 KB / 100 000
        // sentences ran in ~33 ms. This version is ~25% faster and, more
        // usefully, doesn't depend on that engine optimisation (engines that
        // copy on slice would make the old shape genuinely quadratic).
        // Output is identical.
        const src = text.trim();
        if (!src) return [];

        const sentences = [];
        const re = /[.!?]+(?:[ \t\n\r]+|$)/g;
        let last = 0;
        let match;

        while ((match = re.exec(src)) !== null) {
            const end = match.index + match[0].length;
            const sentence = src.slice(last, end).trim();
            if (sentence.length > 2) sentences.push(sentence);
            last = end;
        }
        const tail = src.slice(last).trim();
        if (tail.length > 2) sentences.push(tail);
        return sentences;
    }

    static summarize(plainText, sentenceCount) {
        const sentences = Summarizer.#splitSentences(plainText);
        if (!sentences.length) {
            return { summary: '', sentences: [], total_sentences: 0, keywords: [] };
        }

        const count     = Math.min(sentenceCount, sentences.length);
        const total     = sentences.length;
        const allTokens = Summarizer.#tokenize(plainText);

        if (allTokens.length === 0) {
            return {
                summary:         sentences[0] ?? '',
                sentences:       sentences.slice(0, count).map((text, i) => ({ text, score: 0, position: i })),
                total_sentences: total,
                keywords:        [],
            };
        }

        // TF scores
        const wordFreq = {};
        for (const token of allTokens) wordFreq[token] = (wordFreq[token] ?? 0) + 1;

        const tfScores = {};
        for (const [word, freq] of Object.entries(wordFreq)) {
            tfScores[word] = freq / allTokens.length;
        }

        // Score sentences
        const scored = sentences.map((text, pos) => {
            const tokens = Summarizer.#tokenize(text);
            if (tokens.length === 0) return { text, score: 0, position: pos };

            const tfScore       = tokens.reduce((sum, t) => sum + (tfScores[t] ?? 0), 0) / tokens.length;
            const positionBonus = total > 1 ? 0.2 * (1 - pos / total) : 0;
            const lengthPenalty = tokens.length < 5 ? 0.5 : 1.0;
            const punctBonus    = /[.!?]$/.test(text) ? 1.0 : 0.85;

            return { text, score: tfScore * lengthPenalty * punctBonus + positionBonus, position: pos };
        });

        // Top N by score, then re-sort by position
        scored.sort((a, b) => b.score - a.score);
        const top = scored.slice(0, count).sort((a, b) => a.position - b.position);

        const keywords = Object.entries(wordFreq)
            .map(([word, freq]) => ({ word, score: freq / allTokens.length }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);

        return {
            summary:         top.map(s => s.text).join(' '),
            sentences:       top,
            total_sentences: total,
            keywords,
        };
    }
}

// ═══════════════════════════════════════════════════════════
// Default Options
// ═══════════════════════════════════════════════════════════

const DEFAULT_OPTIONS = Object.freeze({
    internal_domains: ['pixa.pics', 'pixagram.com'],
    max_body_length:  500_000,
    // Bounds the extracted `images` INDEX only — the rendered body is never
    // touched. null/undefined = no bound. This used to cap the HTML itself and
    // defaulted to 0, which deleted every image from every post body.
    max_image_count:  null,
    // Per-call override for the image proxy prefix. undefined = use whatever
    // setImageProxyBase() configured; null = emit direct URLs for this call.
    image_proxy_base: undefined,
});

function parseOptions(optionsJson) {
    if (!optionsJson) return { ...DEFAULT_OPTIONS };
    try {
        const parsed = typeof optionsJson === 'string' ? JSON.parse(optionsJson) : optionsJson;
        return { ...DEFAULT_OPTIONS, ...parsed };
    } catch { return { ...DEFAULT_OPTIONS }; }
}

// ═══════════════════════════════════════════════════════════
// Public API (same signatures as WASM module)
// ═══════════════════════════════════════════════════════════

/** Init — no-op for WASM API compatibility. */
export default async function pixaContentInit() {}

/** Tier 1: Memo sanitization. */
export function sanitizeMemo(body, optionsJson) {
    if (!body) return { html: '' };
    if (body.trim().startsWith('data:')) return { html: '' };

    const opts = parseOptions(optionsJson);

    if (body.startsWith('#')) {
        const safe = sanitizeHtmlLib(body, SanitizeConfigs.strip);
        return { html: `<span class="pixa-encrypted-memo">${safe}</span>` };
    }

    const input          = TextProcessor.truncate(body, Math.min(opts.max_body_length, 2048));
    const htmlRaw        = TextProcessor.isPredominantlyHtml(input) ? input : TextProcessor.markdownToHtml(input);
    const htmlMentions   = MentionProcessor.process(htmlRaw);
    const html           = sanitizeHtmlLib(htmlMentions, SanitizeConfigs.memo);
    return { html };
}

/** Tier 2: Comment sanitization. */
export function sanitizeComment(body, optionsJson) {
    if (!body) return { html: '', links: [] };
    if (body.trim().startsWith('data:')) return { html: '', links: [] };

    const opts         = parseOptions(optionsJson);
    const input        = TextProcessor.truncate(body, opts.max_body_length);
    const htmlRaw      = TextProcessor.isPredominantlyHtml(input) ? input : TextProcessor.markdownToHtml(input);
    const htmlMentions = MentionProcessor.process(htmlRaw);

    // External-link marking happens INSIDE sanitize-html now, so the sanitizer
    // is the last stage that writes markup.
    const html  = sanitizeHtmlLib(htmlMentions, {
        ...SanitizeConfigs.comment,
        transformTags: { 'a': LinkProcessor.makeTransform(opts.internal_domains) },
    });
    const links = LinkProcessor.collect(html);
    return { html, links };
}

/** Tier 3: Post sanitization (full rich content). */
export function sanitizePost(body, optionsJson) {
    if (!body) return { html: '', links: [], images: [] };

    const opts    = parseOptions(optionsJson);
    const trimmed = body.trim();

    // Pixel art short-circuit: body IS a base64 image
    if (trimmed.startsWith('data:image/')) {
        if (ImageUtils.isValidBase64(trimmed)) {
            return { html: '', images: [{ src: trimmed, alt: '', is_base64: true, index: 0 }], links: [] };
        }
        return { html: '', links: [], images: [] };
    }

    const input        = TextProcessor.truncate(body, opts.max_body_length);
    const htmlRaw      = TextProcessor.isPredominantlyHtml(input) ? input : TextProcessor.markdownToHtml(input);
    const htmlMentions = MentionProcessor.process(htmlRaw);

    // External-link marking happens INSIDE sanitize-html now, so the sanitizer
    // is the last and only stage that writes markup. Nothing runs after it.
    const html = sanitizeHtmlLib(htmlMentions, {
        ...SanitizeConfigs.post,
        transformTags: {
            'a':   LinkProcessor.makeTransform(opts.internal_domains),
            'img': makeImgTransform(opts.image_proxy_base),
        },
    });

    // Extracted AFTER sanitization, so only images that survived the allowlist
    // are indexed.
    const allImages = ImageUtils.extract(html);

    // `max_image_count` bounds the extracted INDEX, never the rendered body.
    // Dropping <img> tags out of `html` used to be what this option did, which
    // silently truncated the author's post: a body with eleven screenshots came
    // back missing the last few, with no indication anything had been removed.
    // A body is not ours to edit. `images` is a derived index — the thing
    // consumers page through, build thumbnails from and bound for cost — so a
    // cap there is meaningful and lossless. Consequence, deliberately: with a
    // cap in effect `images` is a PREFIX of what `html` contains, not a
    // complete description of it.
    const images = (opts.max_image_count === null || opts.max_image_count === undefined)
        ? allImages
        : allImages.slice(0, Math.max(0, opts.max_image_count));

    const links = LinkProcessor.collect(html);

    return { html, links, images };
}

/** Sanitize a JSON string (depth-limited, key-validated). */
export function safeJson(jsonStr) {
    return JsonSanitizer.sanitize(jsonStr);
}

/**
 * Reverse the five entity substitutions sanitize-html performs when it
 * serialises TEXT. With allowedTags: [] the library both strips tags and
 * escapes what remains, so `Tom & Jerry` came back as `Tom &amp; Jerry`,
 * `5 < 10` as `5 &lt; 10` — and those values are rendered as text by React
 * (profile `about`, `name`, …), so users saw the raw entities.
 *
 * Only these five are reversed — NOT the general entity decoder, which would
 * also expand author-written numeric escapes and change their meaning.
 *
 * The result is PLAIN TEXT and must never be passed to innerHTML /
 * dangerouslySetInnerHTML. Use safeHTML() for that.
 *
 * @param {string} s
 * @returns {string}
 */
function unescapeTextEntities(s) {
    return s
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');   // last, so &amp;lt; → &lt; and not <
}

/** Sanitize a single string value. Returns PLAIN TEXT, never HTML. */
// Characters a browser silently discards when parsing a URL attribute, plus the
// zero-width / bidi controls used to smuggle them past string comparisons.
// These MUST be stripped BEFORE any scheme test: otherwise "java\tscript:" and
// "java\0script:" pass every check here and re-form into a live javascript: URL
// once the browser parses the href.
const URL_INVISIBLES_RE = /[\u0000-\u001f\u007f\u200b-\u200f\u2028\u2029\u202a-\u202e\u2060-\u2064\ufeff]/g;

// Script-capable schemes. Matched on the normalized string, tolerating the
// whitespace-before-colon form ("javascript :").
const DANGEROUS_SCHEME_RE = /^(javascript|vbscript|livescript|mocha|data)\s*:/i;

export function safeString(s, maxLen) {
    if (typeof s !== 'string') return null;

    // Normalize FIRST — everything below must reason about the same string the
    // browser will eventually see, not the one the attacker typed.
    const trimmed = s.replace(URL_INVISIBLES_RE, '').trim();
    if (!trimmed) return null;

    // Valid base64 image — pass through
    if (trimmed.startsWith('data:image/')) {
        return ImageUtils.isValidBase64(trimmed) && trimmed.length <= maxLen ? trimmed : null;
    }

    // Reject dangerous URI schemes
    const lower = trimmed.toLowerCase();
    if (DANGEROUS_SCHEME_RE.test(lower)) {
        return null;
    }

    // Only these become live links. Protocol-relative "//host" is deliberately
    // NOT a URL here — it falls through to the text branch instead of becoming
    // an href that inherits the page scheme.
    const isUrl = lower.startsWith('https://') || lower.startsWith('http://')
        || lower.startsWith('mailto:') || lower.startsWith('tel:');

    let cleaned;
    if (isUrl) {
        cleaned = trimmed;
    } else {
        const stripped = sanitizeHtmlLib(trimmed, SanitizeConfigs.strip);
        const strippedLower = stripped.toLowerCase();
        if (strippedLower.includes('javascript:') || strippedLower.includes('vbscript:')) return null;
        // Un-escape AFTER the scheme checks above, so those still run against
        // the escaped form and can't be smuggled past via entities.
        cleaned = unescapeTextEntities(stripped).replace(URL_INVISIBLES_RE, '');
    }

    const result = cleaned.trim();
    if (!result) return null;
    return result.length > maxLen ? result.slice(0, maxLen).trimEnd() || null : result;
}

/** Sanitize a HIVE username. */
export function sanitizeUsername(username) {
    if (!username) return '';
    const trimmed = username.trim().toLowerCase();
    if (trimmed.length < 3 || trimmed.length > 16) return '';
    if (!/^[a-z]/.test(trimmed))   return '';
    if (!/^[a-z0-9.\-]+$/.test(trimmed)) return '';
    if (/[.\-]{2}/.test(trimmed))  return '';
    if (/[.\-]$/.test(trimmed))    return '';
    return trimmed;
}

/** Extract plain text from HTML/Markdown body. */
export function extractPlainText(body) {
    if (!body) return '';
    if (body.trim().startsWith('data:')) return '';
    const html = TextProcessor.isPredominantlyHtml(body) ? body : TextProcessor.markdownToHtml(body);
    return TextProcessor.normalizeWhitespace(TextProcessor.htmlToPlainText(html));
}

/** TF-IDF extractive summarization. */
export function summarizeContent(body, sentenceCount) {
    if (!body) return { summary: '', keywords: [], sentences: [], total_sentences: 0 };
    const plain = extractPlainText(body);
    return Summarizer.summarize(plain, sentenceCount || 3);
}

/**
 * Last-guard HTML sanitizer for dangerouslySetInnerHTML boundaries.
 *
 * Assumes the input is already-rendered HTML (markdown conversion, mention
 * processing, etc. have already happened).  This function does NOT perform
 * any markdown rendering — it only strips tags, attributes, and URI schemes
 * that are not on the post-tier allowlist.
 *
 * Use this as the final call before passing a string to dangerouslySetInnerHTML
 * to ensure defense-in-depth even if upstream sanitization was skipped or
 * the data was mutated after initial sanitization.
 *
 * @param {string} html — Pre-rendered HTML to sanitize
 * @returns {string} Sanitized HTML safe for innerHTML injection
 */
/**
 * Inspect a base64 image data URI before rendering it.
 *
 * For any component that puts attacker-controlled bytes in an <img src>:
 * the data viewer's preview, profile and community avatars, cover images.
 * Returns the reason on failure so the UI can say what it refused and why
 * rather than silently showing nothing.
 *
 * @param {string} value
 * @returns {{ ok: boolean, reason?: string, mime?: string, declared?: string,
 *             bytes?: number, width?: number, height?: number }}
 */
export function inspectImageDataUri(value) {
    return ImageUtils.inspectDataUri(value);
}

/**
 * Profile / community / cover image accessor.
 *
 * These live in on-chain JSON metadata, which is wholly attacker-controlled.
 * Returns the value only if it is either a fully validated base64 image or a
 * plain https URL; anything else — http, javascript:, a malformed data URI, a
 * mislabelled or oversized image — becomes null so the caller renders a
 * placeholder instead.
 *
 * @param {string} value
 * @returns {string|null}
 */
export function safeProfileImage(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.replace(URL_INVISIBLES_RE, '').trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('data:')) {
        return ImageUtils.inspectDataUri(trimmed).ok ? trimmed : null;
    }
    if (trimmed.startsWith('//')) return null;   // scheme-relative: resolve it upstream, not here
    return ImageUtils.isValidUrl(trimmed) ? trimmed : null;
}

export function safeHTML(html) {
    if (!html) return '';
    if (typeof html !== 'string') return '';
    return sanitizeHtmlLib(html, SanitizeConfigs.post);
}