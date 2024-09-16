/**
 * Shared URL guards for attacker-controlled values.
 *
 * Profile images, community images, link lists and contact entries all come from
 * on-chain metadata: any account can write anything, and once written it is
 * permanent. The JSON sanitizer makes those values safe for an HTML *text*
 * context; it does not and cannot make them safe for every sink they land in.
 * Encoding must match the sink:
 *
 *   HTML text   ->  React escapes it automatically (nothing needed)
 *   href        ->  safeHttpUrl()      — scheme must be http(s)
 *   CSS url()   ->  safeCssImageUrl()  — no quote/paren/backslash may survive
 *
 * Every component that interpolates chain data into an href or a background-image
 * must go through here rather than rolling its own check.
 */

// Characters a browser silently discards while parsing a URL, plus the
// zero-width and bidi controls used to smuggle them past string comparisons.
// Stripped BEFORE any scheme test — otherwise "java\tscript:" survives the
// check and re-forms into a live javascript: URL inside the browser.
const INVISIBLES_RE =
    /[\u0000-\u001f\u007f\u200b-\u200f\u2028\u2029\u202a-\u202e\u2060-\u2064\ufeff]/g;

/**
 * Validate a value destined for an href.
 * @returns {string|null} absolute http(s) URL, or null when it must not be linked.
 *          Callers MUST render plain text on null rather than emitting an anchor.
 */
export function safeHttpUrl(value) {
    if (typeof value !== 'string') return null;

    const v = value.replace(INVISIBLES_RE, '').trim();
    if (!v) return null;

    // A value carrying any non-http scheme is rejected outright rather than
    // prefixed into nonsense ("file:///etc/passwd" -> "https://file///...").
    const isHttp = /^https?:\/\//i.test(v);
    if (!isHttp && /^[a-z][a-z0-9+.-]*:/i.test(v)) return null;

    const candidate = isHttp ? v : `https://${v.replace(/^\/+/, '')}`;
    try {
        const u = new URL(candidate);
        return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : null;
    } catch (e) {
        return null;
    }
}

// Strict allowlist. React does NOT escape inline style values, so a value
// containing a quote and a paren escapes url(...) and injects arbitrary CSS —
// enough to make every viewer's browser fetch a URL of the attacker's choosing,
// which turns any profile view into a visitor beacon. Forbidding quotes,
// parens, backslashes, angle brackets and whitespace makes the breakout
// impossible rather than merely inconvenient.
const SAFE_IMG_RE = /^https?:\/\/[^\s"'()\\<>]+$/i;
// `svg+xml` belongs here. Pixagram's cover art IS an SVG gradient — the editor
// emits `data:image/svg+xml;base64,…` (GradientEditorDialog) — so leaving it out
// made cssBackgroundImage() return 'none' for every cover the platform
// generates itself.
//
// It is also safe. An SVG reached through CSS url() or an <img> src is rendered
// in the browser's restricted image mode: no script execution, no external
// fetches, no access to the embedding document. That is a different threat
// model from an inline <svg> element in innerHTML, which is why the sanitizer's
// own BASE64_IMAGE_RE already allowed svg+xml. The two allowlists disagreeing
// was the bug.
//
// Still base64-only on purpose: `;utf8,<svg …>` would put raw, unescaped markup
// inside a CSS url(), and the quoting guarantee below is the only thing keeping
// that string from closing early.
const SAFE_DATA_IMG_RE = /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;

/**
 * Validate a value destined for CSS `url(...)` or an <img src>.
 * @returns {string|null} the value, or null when it cannot be used safely.
 */
export function safeCssImageUrl(value) {
    if (typeof value !== 'string') return null;
    const v = value.trim();
    if (!v) return null;
    return (SAFE_IMG_RE.test(v) || SAFE_DATA_IMG_RE.test(v)) ? v : null;
}

/**
 * Build a CSS background-image value, falling back when the source is unusable.
 * Always emits the quoted form; combined with the allowlist above the quotes
 * cannot be closed early.
 */
export function cssBackgroundImage(value, fallback) {
    const safe = safeCssImageUrl(value) || safeCssImageUrl(fallback);
    return safe ? `url("${safe}")` : 'none';
}
