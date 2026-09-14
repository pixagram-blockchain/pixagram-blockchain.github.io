// ============================================================================
// utils/community-rules.js — one parser for community rules / principles
//
// The chain has no `rules` property. hivemind's CommunityOp._read_props accepts
// title, about, description, lang, is_nsfw and flag_text and silently drops
// everything else, so the rule list has to live inside `description`. It is
// stored there as a plain markdown bullet list ("- rule" per line) and parsed
// back out on read.
//
// Anything that WRITES rules must use serializeRules(); anything that READS
// them must use parseRules(). If the editor writes a list and a view splits it
// some other way, the two drift apart on the first rule that contains a dash.
//
// parseRules is deliberately forgiving, because `description` predates this
// format and already holds whatever people typed: "-", "*", "•", "1.", "1)",
// "(1)", markdown headings, indented wraps, blank-line-separated paragraphs,
// and — when a caller falls back to the rendered `description` instead of
// `description_source` — HTML. All of it comes back as a flat array of trimmed
// one-line strings, with nothing silently thrown away.
// ============================================================================

/** Bullet or ordered-list marker at the head of a line. */
const MARKER_RE = /^[ \t\u00a0]*(?:[-–—*+•‣·◦▪▫>]+|\d{1,3}[ \t]*[.)\]:]|\([ \t]*\d{1,3}[ \t]*\))[ \t]+/;

/** Markdown heading — "## Rules". Keeps the text, drops the hashes. */
const HEADING_RE = /^[ \t]*#{1,6}[ \t]+/;

/** Cheap "did someone hand us rendered HTML?" probe. */
const HTML_RE = /<(?:\/?)(?:p|br|li|ul|ol|div|h[1-6]|blockquote|span|strong|em)\b[^>]*>/i;

/** Bullet written on save. */
const BULLET = "-";

/** Guard against a pathological description turning into 10k list rows. */
const MAX_RULES = 100;

/**
 * Rendered HTML → text. Only runs when the input actually looks like HTML.
 * The output is never inserted into the DOM — it goes into a form field and
 * then back on chain as text — so this strips tags rather than sanitising.
 */
function htmlToText(html) {
    return html
        .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
        .replace(/<[ \t]*br[ \t]*\/?[ \t]*>/gi, "\n")
        .replace(/<[ \t]*li\b[^>]*>/gi, "\n" + BULLET + " ")
        .replace(/<\/[ \t]*(?:li|p|div|h[1-6]|tr|blockquote|ul|ol)[ \t]*>/gi, "\n")
        .replace(/<\/?[a-z][^>]*>/gi, "")
        .replace(/&nbsp;/gi, " ")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, "\"")
        .replace(/&#0*39;|&apos;/gi, "'")
        .replace(/&amp;/gi, "&");
}

/** Collapse whitespace runs and trim. Rules are one line each by definition. */
function squash(line) {
    return String(line).replace(/[\s\u00a0]+/g, " ").trim();
}

/** Strip a leading bullet / number / heading marker, if there is one. */
function stripMarker(line) {
    const withoutHeading = line.replace(HEADING_RE, "");
    const marked = MARKER_RE.test(withoutHeading) || withoutHeading !== line;
    return { marked, text: squash(withoutHeading.replace(MARKER_RE, "")) };
}

/**
 * Normalise one rule as typed: strips a marker the user pasted along with the
 * text ("- no spam" → "no spam") and flattens it to a single line.
 */
export function normalizeRule(text) {
    if (typeof text !== "string") return "";
    return stripMarker(text).text;
}

/**
 * description (markdown, plain text or HTML) → array of rules.
 *
 * Line handling mirrors markdown's lazy continuation: a marked line starts a
 * new rule, an unmarked line right under it continues that rule, and a blank
 * line ends it. So a wrapped sentence stays one rule and a prose paragraph
 * becomes one rule instead of one rule per wrapped line.
 */
export function parseRules(input) {
    if (typeof input !== "string" || !input.trim()) return [];

    const text = HTML_RE.test(input) ? htmlToText(input) : input;
    const out = [];
    let open = false;   // previous line carried content, so the next may continue it

    for (const rawLine of text.split(/\r\n|\r|\n/)) {
        if (!rawLine.trim()) { open = false; continue; }

        const { marked, text: body } = stripMarker(rawLine);

        if (marked) {
            if (body) { out.push(body); open = true; } else { open = false; }
        } else if (open && out.length) {
            out[out.length - 1] = squash(out[out.length - 1] + " " + body);
        } else if (body) {
            out.push(body); open = true;
        }

        if (out.length >= MAX_RULES) break;
    }

    return out;
}

/** Array of rules → the `description` string that goes on chain. */
export function serializeRules(list) {
    if (!Array.isArray(list) || !list.length) return "";
    return list.map((rule) => BULLET + " " + rule).join("\n");
}

/** Rules as readable text, with no markup — for toxicity checks and previews. */
export function rulesPlainText(list) {
    return Array.isArray(list) ? list.join("\n") : "";
}

/**
 * Characters left for ONE more rule, given the description cap. Accounts for
 * the "- " prefix and the newline that joins it to the rule above, so a rule
 * that fits here cannot push the payload past the indexer's limit.
 */
export function remainingRuleChars(list, max) {
    const cap = Number(max) || 0;
    const used = serializeRules(list).length;
    const separator = Array.isArray(list) && list.length ? 1 : 0;
    return Math.max(0, cap - used - separator - BULLET.length - 1);
}

/**
 * Append rules within the budget. Returns the new list plus what it refused
 * and why, so the caller can say which — silently dropping half a pasted list
 * is worse than the paste failing.
 */
export function appendRules(list, incoming, max) {
    const out = Array.isArray(list) ? list.slice() : [];
    const items = Array.isArray(incoming) ? incoming : [incoming];
    let duplicates = 0;
    let overflow = 0;

    for (const raw of items) {
        const rule = normalizeRule(raw);
        if (!rule) continue;
        if (out.indexOf(rule) !== -1) { duplicates++; continue; }
        if (out.length >= MAX_RULES || rule.length > remainingRuleChars(out, max)) { overflow++; continue; }
        out.push(rule);
    }

    return { list: out, duplicates, overflow, added: out.length - (Array.isArray(list) ? list.length : 0) };
}

/** True when two rule lists are the same rules in the same order. */
export function rulesEqual(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}

export { MAX_RULES, BULLET };
