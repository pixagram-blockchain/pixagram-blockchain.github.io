/**
 * The document behind the comment composer's VISUAL mode
 * (components/CommentVisualEditor).
 *
 * A comment is markdown on chain — in either mode. The visual editor shows the
 * same text as a small document:
 *
 *     block   { type: "paragraph", children }
 *             { type: "quote",     children }
 *             { type: "list", ordered, start, items: [children, …] }
 *     inline  { type: "text", text, bold, italic }
 *             { type: "break" }
 *             { type: "image", url, alt, raw }   raw: its markdown as read
 *
 * which is exactly what the format bar writes: **bold**, *italic*, > quote,
 * bullet and numbered lists, one image. parseComment() reads markdown into
 * it, serializeComment() writes it back.
 *
 * Whatever the reader does NOT recognise stays the text it was — a link, a
 * heading, inline code, a table, `\*` — and is written back character for
 * character. So markdown the visual editor has no button for still works
 * when typed, and a comment loaded for editing is never rewritten behind
 * the author's back. Nothing is escaped on the way out, for the same reason.
 *
 * Two things cannot be shown as that document without changing them: text
 * whose line starts matter (code fences, indented code, HTML blocks) and
 * nesting (a list in a quote, a list in a list). parseComment() reports them
 * as `exact: false`, and commentVisualizable() is the question the composer
 * asks before it shows a text in the visual editor; those stay in markdown.
 *
 * No imports, no DOM: unit-testable in Node.
 */

/* ── Characters ─────────────────────────────────────────────────────── */

// CommonMark's "Unicode punctuation": P* and S*. Built at run time so the
// build never has to expand \p{…}, and an engine without it gets ASCII.
let PUNCT_RE = /[!-/:-@[-`{-~]/;
try { PUNCT_RE = new RegExp("[\\p{P}\\p{S}]", "u"); } catch (e) { /* ASCII */ }

const ASCII_PUNCT_RE = /[!-/:-@[-`{-~]/;
const isSpace = (ch) => ch === "" || /\s/.test(ch);
const isPunct = (ch) => ch !== "" && PUNCT_RE.test(ch);

/* ── Blocks: line starts ────────────────────────────────────────────── */

const QUOTE_RE = /^ {0,3}>[ \t]?/;
// Indent, then "-", "*", "+" or "1." / "1)", then blanks — or the bare marker
// at the end of the line. Same rule as utils/commentMarkdown's.
const ITEM_RE = /^( {0,3})(?:([-*+])|(\d{1,9})([.)]))(?:[ \t]+|$)/;
const NESTED_ITEM_RE = /^[ \t]+(?:[-*+]|\d{1,9}[.)])(?:[ \t]+|$)/;
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;
const RULE_RE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const CODE_INDENT_RE = /^(?: {4}|\t| {1,3}\t)/;
// What starts an HTML block (CommonMark's conditions 1 to 6) — its lines
// are HTML, not markdown, down to the next blank line…
const HTML_BLOCK_RE = new RegExp("^ {0,3}<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--|\\?|![A-Za-z]|!\\[CDATA\\[|/?(?:"
    + "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|"
    + "fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|"
    + "menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul"
    + ")(?:[\\s/>]|$))", "i");
// …and so does any tag standing alone on the first line of a block
// (condition 7). "<b>bold</b> text" is neither: a paragraph like any other.
const HTML_LINE_RE = /^ {0,3}<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>[ \t]*$/;

const HEADING_RE = /^ {0,3}#{1,6}(?:[ \t]|$)/;
// A lazy line — one that continues a quote or an item without its ">" or its
// indent — that would not mean the same written WITH it: "===" and "--"
// become a heading's underline, a "|" row gets the line break rows are
// spared (utils/commentMarkdown, commentBodyForBroadcast).
const LAZY_ODD_RE = /^ {0,3}(?:\||=+[ \t]*$|-+[ \t]*$)/;
const SETEXT_RE = /^ {0,3}(?:=+|-+)[ \t]*$/;

const isBlank = (line) => !line || !line.trim();

/** { ordered, num, rest } for a line that starts a list item, else null. */
function readItem(line) {
    if (RULE_RE.test(line)) return null; // "- - -" is a rule, not a list
    const m = ITEM_RE.exec(line);
    if (!m) return null;
    return {
        ordered: !m[2],
        num: m[3] ? parseInt(m[3], 10) : 0,
        rest: line.slice(m[0].length),
        // "-", "*", "+", "." or ")": another one starts another list
        mark: m[2] || m[4],
        indent: m[1].length,
        // the column a line must reach to belong INSIDE this item
        inner: m[1].length + (m[2] ? 1 : m[3].length + 1) + 1,
    };
}

/** A line that ends the paragraph (or the lazy quote / item) above it. */
function interrupts(line) {
    if (QUOTE_RE.test(line) || FENCE_RE.test(line)) return true;
    const item = readItem(line);
    // Markdown's rule: an empty item, or a numbered one not starting at 1,
    // does not interrupt a paragraph.
    return !!item && !isBlank(item.rest) && (!item.ordered || item.num === 1);
}

/** A line that is never the lazy continuation of a quote or a list item:
 *  it starts a block of its own, and so ends the one above it. */
function startsBlock(line) {
    return interrupts(line) || HEADING_RE.test(line) || RULE_RE.test(line) || HTML_BLOCK_RE.test(line);
}

/* ── Inline: tokens ─────────────────────────────────────────────────── */

// ![alt](url), ![alt](<url>), ![alt](url "title") — utils/commentMarkdown's.
const IMAGE_RE = /!\[((?:\\.|[^\]\\\n])*)\]\([ \t]*(<[^<>\n]*>|[^\s()<>]+(?:\([^\s()<>]*\)[^\s()<>]*)*)(?:[ \t]+(?:"[^"\n]*"|'[^'\n]*'|\([^()\n]*\)))?[ \t]*\)/y;
// The "(…)" of a link, from its "]": nothing in an address is emphasis.
const LINK_DEST_RE = /\]\([ \t]*(?:<[^<>\n]*>|[^\s()<>]*(?:\([^\s()<>]*\)[^\s()<>]*)*)(?:[ \t]+(?:"[^"\n]*"|'[^'\n]*'|\([^()\n]*\)))?[ \t]*\)/y;
// <https://…>, <a href>, </a>, <!-- -->
const ANGLE_RE = /<(?:[A-Za-z][A-Za-z0-9+.-]*:[^\s<>]*|\/?[A-Za-z][^<>\n]*|[!?][^<>\n]*)>/y;
const URL_RE = /(?:https?:\/\/|www\.)[^\s<>]*/iy;
const URL_TAIL_RE = /[?!.,:;*_~'")\]]+$/;

function stickyMatch(re, text, at) {
    re.lastIndex = at;
    return re.exec(text);
}

/**
 * Cut a line into the pieces emphasis is worked out on:
 *   text    literal characters
 *   image   an image the document shows (opts.image decides)
 *   delim   a run of "*" or "_" — the only thing that can become a mark
 * Code spans, escapes, tags, addresses and link targets are text here: an
 * "_" inside https://host/a_b_ is part of the address, not an italic.
 */
function tokenize(line, opts) {
    const tokens = [];
    const n = line.length;
    let textFrom = -1;
    const flush = (to) => {
        if (textFrom !== -1 && to > textFrom) tokens.push({ kind: "text", s: textFrom, e: to });
        textFrom = -1;
    };
    const literal = (from, to) => {
        // joins the text around it: one token, one run
        if (textFrom === -1) textFrom = from;
        return to;
    };
    let i = 0;
    while (i < n) {
        const ch = line[i];
        if (ch === "\\" && i + 1 < n && ASCII_PUNCT_RE.test(line[i + 1])) {
            i = literal(i, i + 2);
            continue;
        }
        if (ch === "`") {
            let run = 1;
            while (i + run < n && line[i + run] === "`") run++;
            // closed by a run of the same length
            let close = -1;
            let j = i + run;
            while (j < n) {
                if (line[j] !== "`") { j++; continue; }
                let len = 1;
                while (j + len < n && line[j + len] === "`") len++;
                if (len === run) { close = j + len; break; }
                j += len;
            }
            if (close !== -1 && opts && opts.code) opts.code.push([i, close]);
            i = literal(i, close === -1 ? i + run : close);
            continue;
        }
        if (ch === "<") {
            const m = stickyMatch(ANGLE_RE, line, i);
            if (m) { i = literal(i, i + m[0].length); continue; }
        }
        if (ch === "!" && line[i + 1] === "[") {
            const m = stickyMatch(IMAGE_RE, line, i);
            if (m) {
                let url = m[2];
                if (url.charAt(0) === "<") url = url.slice(1, -1);
                url = url.trim();
                if (opts && opts.image && opts.image(url, i)) {
                    flush(i);
                    tokens.push({ kind: "image", s: i, e: i + m[0].length, url, alt: m[1], raw: m[0] });
                    i += m[0].length;
                } else {
                    i = literal(i, i + m[0].length);
                }
                continue;
            }
        }
        if (ch === "]" && line[i + 1] === "(") {
            const m = stickyMatch(LINK_DEST_RE, line, i);
            if (m) { i = literal(i, i + m[0].length); continue; }
        }
        if ((ch === "h" || ch === "H" || ch === "w" || ch === "W")
            && (i === 0 || isSpace(line[i - 1]) || isPunct(line[i - 1]))) {
            const m = stickyMatch(URL_RE, line, i);
            if (m) {
                const url = m[0].replace(URL_TAIL_RE, "");
                if (url.length > 4) { i = literal(i, i + url.length); continue; }
            }
        }
        if (ch === "*" || ch === "_") {
            let e = i + 1;
            while (e < n && line[e] === ch) e++;
            const prev = i > 0 ? line[i - 1] : "";
            const next = e < n ? line[e] : "";
            // CommonMark's flanking rules
            const left = !isSpace(next) && (!isPunct(next) || isSpace(prev) || isPunct(prev));
            const right = !isSpace(prev) && (!isPunct(prev) || isSpace(next) || isPunct(next));
            flush(i);
            tokens.push({
                kind: "delim", s: i, e, ch, len: e - i,
                canOpen: ch === "*" ? left : left && (!right || isPunct(prev)),
                canClose: ch === "*" ? right : right && (!left || isPunct(next)),
            });
            i = e;
            continue;
        }
        if (textFrom === -1) textFrom = i;
        i++;
    }
    flush(n);
    return tokens;
}

/* ── Inline: emphasis ───────────────────────────────────────────────── */

/**
 * CommonMark's delimiter algorithm over one line. Returns the line as a flat
 * list of runs — { type: "text", text, bold, italic } and images — and, in
 * `removed`, the source ranges that were markers (for mapping a caret from
 * the typed text to the formatted one).
 *
 * `bm` / `im` on a run say which character made it bold / italic when that
 * was "_": serializeComment() writes the same one back, so a text that was
 * only read is written unchanged.
 */
function parseInline(line, opts) {
    const tokens = tokenize(line, opts);
    // A linked list of nodes; delimiters are nodes too until they are used up.
    const head = { kind: "head", prev: null, next: null };
    let tail = head;
    const delims = [];
    for (const tk of tokens) {
        const node = { ...tk, prev: tail, next: null };
        if (tk.kind === "delim") { node.left = tk.len; node.s0 = tk.s; node.e0 = tk.e; delims.push(node); }
        tail.next = node;
        tail = node;
    }
    const removed = [];
    const pairs = []; // [opener, closer, opener's characters, closer's] of every mark made
    const live = delims.slice(); // the delimiter stack

    let ci = 0;
    while (ci < live.length) {
        const closer = live[ci];
        if (!closer.canClose || closer.left === 0) { ci++; continue; }
        let oi = ci - 1;
        let found = false;
        for (; oi >= 0; oi--) {
            const opener = live[oi];
            if (opener.ch !== closer.ch || !opener.canOpen || opener.left === 0) continue;
            // the "multiple of 3" rule
            const odd = (opener.canClose || closer.canOpen)
                && (opener.len + closer.len) % 3 === 0
                && !(opener.len % 3 === 0 && closer.len % 3 === 0);
            if (!odd) { found = true; break; }
        }
        if (!found) {
            // never a closer; it may still open something
            if (!closer.canOpen) live.splice(ci, 1); else ci++;
            continue;
        }
        const opener = live[oi];
        const use = opener.left >= 2 && closer.left >= 2 ? 2 : 1;
        // the opener gives its inner characters, the closer its first ones
        pairs.push([opener, closer, [opener.e - use, opener.e], [closer.s, closer.s + use]]);
        removed.push([opener.e - use, opener.e]);
        removed.push([closer.s, closer.s + use]);
        opener.e -= use; opener.left -= use;
        closer.s += use; closer.left -= use;
        // wrap what stands between them
        const wrap = {
            kind: use === 2 ? "strong" : "em", ch: closer.ch,
            first: opener.next === closer ? null : opener.next,
            last: opener.next === closer ? null : closer.prev,
            prev: opener, next: closer,
        };
        if (wrap.first) { wrap.first.prev = null; wrap.last.next = null; }
        opener.next = wrap;
        closer.prev = wrap;
        // delimiters between the two are plain text from now on
        live.splice(oi + 1, ci - oi - 1);
        ci = oi + 1;
        if (opener.left === 0) { live.splice(oi, 1); ci--; }
        if (closer.left === 0) live.splice(ci, 1);
    }

    const runs = [];
    const push = (text, marks) => {
        if (!text) return;
        const last = runs[runs.length - 1];
        if (last && last.type === "text" && last.bold === marks.bold && last.italic === marks.italic
            && last.bm === marks.bm && last.im === marks.im) {
            last.text += text;
            return;
        }
        const run = { type: "text", text, bold: marks.bold, italic: marks.italic };
        if (marks.bm) run.bm = marks.bm;
        if (marks.im) run.im = marks.im;
        runs.push(run);
    };
    const walk = (node, marks) => {
        for (; node; node = node.next) {
            if (node.kind === "text") push(line.slice(node.s, node.e), marks);
            else if (node.kind === "delim") push(line.slice(node.s, node.e), marks);
            else if (node.kind === "image") runs.push({ type: "image", url: node.url, alt: node.alt, raw: node.raw });
            else if (node.kind === "strong") {
                walk(node.first, { ...marks, bold: true, bm: marks.bold ? marks.bm : (node.ch === "_" ? "_" : undefined) });
            } else if (node.kind === "em") {
                walk(node.first, { ...marks, italic: true, im: marks.italic ? marks.im : (node.ch === "_" ? "_" : undefined) });
            }
        }
    };
    walk(head.next, { bold: false, italic: false, bm: undefined, im: undefined });
    removed.sort((a, b) => a[0] - b[0]);
    return { runs, removed, delims, pairs };
}

/**
 * One line of text as formatted runs — what the visual editor turns typed
 * markdown into. `changed` is false when the line holds no mark and no
 * image (the caller leaves the text as it is); `removed` is the list of
 * source ranges that were markers.
 */
export function inlineRuns(text, opts) {
    const line = String(text == null ? "" : text);
    if (line.indexOf("*") === -1 && line.indexOf("_") === -1 && line.indexOf("![") === -1) {
        return { runs: line ? [{ type: "text", text: line, bold: false, italic: false }] : [], removed: [], changed: false };
    }
    const { runs, removed } = parseInline(line, opts);
    const changed = removed.length > 0 || runs.some((r) => r.type === "image");
    return { runs, removed, changed };
}

/* ── Parsing ────────────────────────────────────────────────────────── */

/** Lines → inline children, a break between two lines. */
function linesToInline(lines, opts, state) {
    const out = [];
    for (let i = 0; i < lines.length; i++) {
        if (i > 0) out.push({ type: "break" });
        const line = lines[i];
        if (!line) continue;
        const { runs } = parseInline(line, {
            // one image per document: the comment tier shows the first only
            image: (url) => state.images < state.maxImages && (!opts || !opts.isImageUrl || opts.isImageUrl(url)),
        });
        for (const r of runs) {
            if (r.type === "image") {
                if (state.images >= state.maxImages) {
                    // a second image on the same line: it stays text
                    out.push({ type: "text", text: r.raw, bold: false, italic: false });
                    continue;
                }
                state.images++;
            }
            out.push(r);
        }
    }
    return mergeText(out);
}

function mergeText(items) {
    const out = [];
    for (const it of items) {
        const last = out[out.length - 1];
        if (it.type === "text" && last && last.type === "text"
            && !!last.bold === !!it.bold && !!last.italic === !!it.italic
            && last.bm === it.bm && last.im === it.im) {
            last.text += it.text;
        } else {
            out.push(it.type === "text" ? { ...it } : it);
        }
    }
    return out;
}

const rstrip = (line) => line.replace(/[ \t]+$/, "");

/**
 * Markdown → { blocks, exact }.
 *
 * opts.maxImages   images the document may show (default 1; 0 for none)
 * opts.isImageUrl  (url) → whether that address can be shown as an image
 *
 * `exact` is false when the text holds something the blocks cannot carry
 * without changing it (see the module comment). The blocks are still
 * returned — every character of the text is in them — but the composer
 * keeps such a text in markdown.
 */
export function parseComment(markdown, opts) {
    const text = String(markdown == null ? "" : markdown).replace(/\r\n?/g, "\n");
    const lines = text.split("\n");
    const blocks = [];
    const state = {
        images: 0,
        maxImages: opts && typeof opts.maxImages === "number" ? opts.maxImages : 1,
    };
    let exact = true;
    let i = 0;
    const n = lines.length;

    while (i < n) {
        const line = lines[i];
        if (isBlank(line)) { i++; continue; }

        // ── a fenced block: its lines are code, not markdown ──
        const fence = FENCE_RE.exec(line);
        if (fence) {
            exact = false;
            const ch = fence[1].charAt(0);
            const len = fence[1].length;
            const body = [line];
            i++;
            while (i < n) {
                const l = lines[i];
                body.push(l);
                i++;
                const close = FENCE_RE.exec(l);
                if (close && close[1].charAt(0) === ch && close[1].length >= len && isBlank(l.slice(close[0].length))) break;
            }
            const children = [];
            body.forEach((l, k) => {
                if (k > 0) children.push({ type: "break" });
                if (l) children.push({ type: "text", text: l, bold: false, italic: false });
            });
            blocks.push({ type: "paragraph", children });
            continue;
        }

        // ── a quote ──
        if (QUOTE_RE.test(line)) {
            const body = [];
            while (i < n) {
                const l = lines[i];
                if (isBlank(l)) break;
                const q = QUOTE_RE.exec(l);
                if (q) {
                    const rest = rstrip(l.slice(q[0].length));
                    // a quote in a quote, a list or code in a quote
                    if (QUOTE_RE.test(rest) || readItem(rest) || FENCE_RE.test(rest) || CODE_INDENT_RE.test(rest)) exact = false;
                    body.push(rest);
                } else if (startsBlock(l)) {
                    break;
                } else if (body.length && body[body.length - 1] === "") {
                    break; // nothing to continue after an empty quoted line
                } else {
                    if (LAZY_ODD_RE.test(l)) exact = false;
                    body.push(rstrip(l).replace(/^[ \t]+/, "")); // lazy continuation
                }
                i++;
            }
            blocks.push({ type: "quote", children: linesToInline(body, opts, state) });
            continue;
        }

        // ── a list ──
        const first = readItem(line);
        if (first) {
            const items = [];
            const ordered = first.ordered;
            let cur = null;
            let inner = 0;
            let loose = false;
            while (i < n) {
                const l = lines[i];
                if (isBlank(l)) {
                    // A blank line does not end the list when its next item
                    // follows: that is the same list, written "loose".
                    let k = i;
                    while (k < n && isBlank(lines[k])) k++;
                    const nextItem = k < n ? readItem(lines[k]) : null;
                    if (nextItem && nextItem.ordered === ordered && nextItem.mark === first.mark && nextItem.indent < inner) {
                        loose = true;
                        i = k;
                        continue;
                    }
                    // …and what follows it indented belongs INSIDE the item
                    // above: a second paragraph, a nested list.
                    if (k < n && /^(?: {2,}|\t)/.test(lines[k])) exact = false;
                    break;
                }
                const it = readItem(l);
                if (it && cur && it.indent >= inner) {
                    exact = false; // a list in a list
                    cur.push(rstrip(l).replace(/^[ \t]+/, ""));
                } else if (it) {
                    if (it.ordered !== ordered || it.mark !== first.mark) break; // another list
                    if (CODE_INDENT_RE.test(it.rest) || FENCE_RE.test(it.rest) || QUOTE_RE.test(it.rest) || readItem(it.rest)) exact = false;
                    cur = [rstrip(it.rest)];
                    inner = it.inner;
                    items.push(cur);
                } else if (QUOTE_RE.test(l) || FENCE_RE.test(l) || HEADING_RE.test(l) || RULE_RE.test(l) || HTML_BLOCK_RE.test(l)) {
                    // a block of its own: under the list when it starts the
                    // line, inside the item when it is indented into it
                    if (/^[ \t]/.test(l)) exact = false;
                    break;
                } else {
                    if (/^ */.exec(l)[0].length < inner && LAZY_ODD_RE.test(l)) exact = false;
                    cur.push(rstrip(l).replace(/^[ \t]+/, ""));
                }
                i++;
            }
            const block = {
                type: "list", ordered, start: ordered ? first.num : 1,
                items: items.map((ls) => linesToInline(ls, opts, state)),
            };
            if (loose) block.loose = true;
            blocks.push(block);
            continue;
        }

        // ── a paragraph ──
        if (CODE_INDENT_RE.test(line) || HTML_LINE_RE.test(line)) exact = false;
        const body = [];
        while (i < n) {
            const l = lines[i];
            if (isBlank(l)) break;
            if (body.length && interrupts(l)) break;
            // an HTML block runs to the next blank line, whatever its lines are
            if (HTML_BLOCK_RE.test(l)) exact = false;
            body.push(rstrip(l));
            i++;
            // A heading, a rule or a heading's underline is the end of its
            // block: the line after it starts a new one (a list, code, …)
            // rather than continuing a paragraph.
            if (HEADING_RE.test(l) || RULE_RE.test(l) || (body.length > 1 && SETEXT_RE.test(l))) break;
        }
        blocks.push({ type: "paragraph", children: linesToInline(body, opts, state) });
    }
    return { blocks, exact };
}

/* ── Serializing ────────────────────────────────────────────────────── */

const URL_ESCAPES = { "(": "%28", ")": "%29", "<": "%3C", ">": "%3E" };

function imageToken(img) {
    if (img.raw) return img.raw; // as it was read
    const alt = String(img.alt || "").replace(/[[\]\\\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
    const url = String(img.url || "").trim().replace(/[\s()<>]/g, (c) => URL_ESCAPES[c] || encodeURIComponent(c));
    return "![" + alt + "](" + url + ")";
}

const KINDS = ["bold", "italic"];
// The marker of a run's mark: the one it was read with, else the style's.
const markOf = (kind, run, style) => (kind === "bold"
    ? ((run.bm || style.bold) === "_" ? "__" : "**")
    : ((run.im || style.italic) === "_" ? "_" : "*"));

/** Runs of one line, ready to be written: no empty run, blanks keeping a
 *  mark only when both their neighbours have it too (a mark never opens or
 *  closes on a blank), equal neighbours joined. */
function normalizeRuns(items) {
    const runs = items.filter((r) => r.type !== "text" || r.text);
    for (let i = 0; i < runs.length; i++) {
        const r = runs[i];
        if (r.type !== "text" || r.text.trim()) continue;
        const prev = runs[i - 1];
        const next = runs[i + 1];
        const keeps = (kind) => !!(r[kind] && prev && prev.type === "text" && prev[kind] && next && next.type === "text" && next[kind]);
        runs[i] = { type: "text", text: r.text, bold: keeps("bold"), italic: keeps("italic"), bm: r.bm, im: r.im };
    }
    return mergeText(runs);
}

/** The same runs with every word carrying one set of marks — those of any
 *  of its letters. Marks then only change at a blank, where markers never
 *  meet: the spelling of last resort (see serializeLine). */
function wordAligned(runs) {
    const out = [];
    let word = [];
    const flush = () => {
        if (!word.length) return;
        const bold = word.some((p) => p.bold);
        const italic = word.some((p) => p.italic);
        for (const p of word) out.push({ type: "text", text: p.text, bold, italic });
        word = [];
    };
    for (const r of runs) {
        if (r.type !== "text") { flush(); out.push(r); continue; }
        for (const part of r.text.split(/(\s+)/)) {
            if (!part) continue;
            if (/^\s+$/.test(part)) {
                flush();
                out.push({ type: "text", text: part, bold: !!r.bold, italic: !!r.italic });
            } else {
                word.push({ text: part, bold: !!r.bold, italic: !!r.italic });
            }
        }
    }
    flush();
    return normalizeRuns(out);
}

/**
 * One line of runs → markdown, with `style` naming the marker character of
 * a mark that was not read with one ("*" unless said otherwise).
 *
 * Marks are kept on a stack, outermost first. A marker only works where
 * markdown's flanking rules let it: an opening one must be followed by the
 * text directly, a closing one must follow it directly, and neither may
 * stand between a letter and punctuation ("a**(b)**"). So blanks at the
 * edge of a marked run are written outside the markers, and so is the one
 * punctuation character that would break the rule.
 */
function emitLine(runs, style, trace) {
    let out = "";
    let blanks = "";      // trailing blanks of the text just written, held back
    let floor = 0;        // `out` is never cut back below this length
    let markFrom = -1;    // where the run of markers ending `out` starts…
    let markTo = -1;      // …and where it ends (out.length while it still ends it)
    let written = 0;      // characters of the runs' own text in `out` so far
    const stack = [];     // open marks, outermost first: { kind, tok }

    // Text goes out in the order it came in; only markers are added. `trace`
    // (normalizeLine) notes each one: after how many characters of text, how
    // long, opening or closing — enough to carry a caret across.
    const put = (text) => {
        out += text;
        written += text.length;
    };
    const mark = (tok, open) => {
        if (markTo !== out.length) markFrom = out.length;
        if (trace) trace.marks.push({ at: written, md: out.length, len: tok.length, open });
        out += tok;
        markTo = out.length;
    };
    // The character a marker written now would follow: markers written back
    // to back are one run, so it is the one before that run.
    const before = () => out.charAt((markTo === out.length ? markFrom : out.length) - 1);
    // How many runs from `from` on keep `kind`: the mark that lasts longer
    // is opened first, so it is the outer one.
    const lasts = (from, kind) => {
        let k = from;
        while (k < runs.length && runs[k].type === "text" && runs[k][kind]) k++;
        return k - from;
    };
    const firstCharOf = (idx) => {
        const r = runs[idx];
        if (!r) return "";
        return r.type === "image" ? "!" : r.text.charAt(0);
    };
    const close = (cut, nextCh) => {
        if (cut >= stack.length) return;
        let moved = "";
        const take = () => { moved = out.charAt(out.length - 1) + moved; out = out.slice(0, -1); written--; };
        if (nextCh && !isSpace(nextCh) && !isPunct(nextCh) && out.length > floor && isPunct(out.charAt(out.length - 1))) take();
        while (out.length > floor && /\s/.test(out.charAt(out.length - 1))) take();
        for (let k = stack.length - 1; k >= cut; k--) mark(stack[k].tok, false);
        stack.length = cut;
        floor = out.length;
        put(moved);
    };

    for (let idx = 0; idx < runs.length; idx++) {
        const r = runs[idx];
        const isText = r.type === "text";
        let cut = stack.length;
        for (let k = 0; k < stack.length; k++) {
            if (!isText || !r[stack[k].kind]) { cut = k; break; }
        }
        close(cut, blanks ? blanks.charAt(0) : firstCharOf(idx));
        put(blanks);
        blanks = "";
        if (!isText) {
            if (trace) trace.images.push(out.length);
            put(imageToken(r));
            continue;
        }

        let text = r.text;
        const open = KINDS.filter((kind) => r[kind] && !stack.some((m) => m.kind === kind));
        if (open.length) {
            for (;;) {
                const lead = /^\s+/.exec(text);
                if (lead) { put(lead[0]); text = text.slice(lead[0].length); continue; }
                const b = before();
                if (text.length > 1 && isPunct(text.charAt(0)) && b && !isSpace(b) && !isPunct(b)) {
                    put(text.charAt(0));
                    text = text.slice(1);
                    continue;
                }
                break;
            }
            if (open.length === 2 && lasts(idx, "italic") > lasts(idx, "bold")) open.reverse();
            for (const kind of open) {
                const tok = markOf(kind, r, style);
                mark(tok, true);
                stack.push({ kind, tok });
            }
            floor = out.length + 1; // a mark keeps one character at least
        }
        if (stack.length) {
            const trail = /\s*$/.exec(text)[0];
            put(text.slice(0, text.length - trail.length));
            blanks = trail;
        } else {
            put(text);
        }
    }
    close(0, "");
    put(blanks);
    return out;
}

// The marks of every letter of a line: "aB", "bBI", … (blanks and
// punctuation may sit outside the markers, so they are not compared).
function marksKey(runs) {
    let key = "";
    for (const r of runs) {
        const isText = r.type === "text";
        // an image is compared as the text it is written as (no mark on it)
        const text = isText ? r.text : (r.type === "image" ? imageToken(r) : "");
        const tag = (isText && r.bold ? "B" : "") + (isText && r.italic ? "I" : "") + "|";
        for (const ch of text) {
            if (isSpace(ch) || isPunct(ch)) continue;
            key += ch + tag;
        }
    }
    return key;
}

const STYLES = [{}, { bold: "_" }, { italic: "_" }, { bold: "_", italic: "_" }];

/**
 * One line of inline children → markdown.
 *
 * "*" markers do for nearly every line. A few stackings read differently
 * from what was meant — marks that start or end INSIDE a word, back to
 * back: "***ab*c*d***" — so what was written is read back, and where the
 * letters do not carry the marks they were given, "__" / "_" are tried for
 * one of the marks. Markdown has no spelling at all for some of them (a
 * bold and an italic overlapping inside one word): those lines are written
 * with each word marked whole.
 */
// The same runs with the "*" and "_" of their TEXT made inert: what is left
// to read back are the markers written for the marks, and nothing else.
const inert = (runs) => runs.map((r) => (r.type === "text" && /[*_]/.test(r.text)
    ? { ...r, text: r.text.replace(/[*_]/g, "^") }
    : r));

// Whose characters a range of the written line is: a marker of ours (see
// emitLine's trace), text the reader typed, or some of each.
function whose(trace, [from, to]) {
    // markers written back to back are one stretch: "***" for a bold and an
    // italic is read in its own order, not in the order it was written
    if (!trace.stretches) {
        trace.stretches = [];
        for (const m of trace.marks) {
            const last = trace.stretches[trace.stretches.length - 1];
            if (last && last[1] === m.md) last[1] = m.md + m.len; else trace.stretches.push([m.md, m.md + m.len]);
        }
    }
    let inside = false;
    let touched = false;
    for (const [a, b] of trace.stretches) {
        if (from >= a && to <= b) inside = true;
        if (from < b && to > a) touched = true;
    }
    return inside ? "ours" : touched ? "both" : "typed";
}

// Read back, do the markers written for the marks work — every one of them
// used, and only with one another? (A "*" of the text right against a "*"
// marker makes one run of the two, and the wrong half may get used.)
function markersHold(spelt) {
    const read = parseInline(spelt.out, null);
    let used = 0;
    for (const pair of read.pairs) {
        const opener = whose(spelt.trace, pair[2]);
        const closer = whose(spelt.trace, pair[3]);
        if (opener !== closer || opener === "both") return false;
        if (opener === "ours") used += (pair[2][1] - pair[2][0]) + (pair[3][1] - pair[3][0]);
    }
    return used === spelt.trace.marks.reduce((n, m) => n + m.len, 0);
}

function spellLine(items) {
    const runs = normalizeRuns(items);
    const emit = (list, style) => {
        const trace = { marks: [], images: [] };
        return { out: emitLine(list, style, trace), trace, runs: list };
    };
    if (!runs.some((r) => r.type === "text" && (r.bold || r.italic))) return emit(runs, STYLES[0]);
    // Do the markers carry the marks? Two checks on what was written, read
    // back. On the runs with their own "*" and "_" taken out of play (those
    // are text the reader typed; reading THEM as markdown is normalizeLine's
    // business): every letter has the marks it was given. And on the line
    // as it is: the markers only pair with one another.
    const probe = inert(runs);
    const want = marksKey(probe);
    let second = null;
    for (const style of STYLES) {
        if (marksKey(parseInline(emitLine(probe, style, null), null).runs) !== want) continue;
        const spelt = emit(runs, style);
        if (markersHold(spelt)) return spelt;
        if (!second) second = spelt;
    }
    if (second) return second;
    // No spelling carries the marks. Inside a code span none could: there a
    // marker is just a character, which is what "`a*b*c`" typed out means —
    // the markers stay as written. Anywhere else, each word is marked whole.
    const first = emit(runs, STYLES[0]);
    const code = [];
    tokenize(first.out, { code });
    if (code.some(([from, to]) => first.trace.marks.some((m) => m.md >= from && m.md < to))) return first;
    return emit(wordAligned(runs), STYLES[0]);
}

const serializeLine = (items) => spellLine(items).out;

/* ── A line being edited ────────────────────────────────────────────── */

const itemLength = (item) => (item.type === "image" ? imageToken(item).length : (item.text || "").length);
const lineText = (items) => items.map((it) => (it.type === "image" ? imageToken(it) : (it.text || ""))).join("");
const imageCount = (items) => items.reduce((n, it) => n + (it.type === "image" ? 1 : 0), 0);

/**
 * Keep a line of the visual editor equal to what its own markdown reads as.
 *
 * The line (its text runs and images, in order) is written as markdown and
 * read back. For a line that was only formatted with the buttons the two are
 * the same, and null is returned: nothing to do. They differ when the line
 * holds markdown that was TYPED — "**word**" still in plain text, an image's
 * "![alt](url)" — or marks markdown cannot carry there (a bold inside a code
 * span): the runs returned are then what the comment will actually show, and
 * the editor replaces the line with them. That is the whole rule of typed
 * markdown, whichever nodes the markers ended up in.
 *
 * items         [{ type: "text", text, bold, italic } | { type: "image", url, alt, raw }]
 * opts.carets   positions to carry over: [[itemIndex, offset], …] — offset
 *               in the item's text; around an image, 0 before and 1 after
 * opts.typing   index in `carets` of the caret the reader is typing at
 *               (−1 for none): a marker still being typed is left alone —
 *               "**bold*" waits for its second "*" instead of turning into
 *               an italic for one keystroke
 * opts.image    (url) → may text spelling an image become a NEW image
 * → null, or { runs, carets: [[runIndex, offset], …] }
 */
export function normalizeLine(items, opts) {
    let result = null;
    let line = items;
    let carets = (opts && opts.carets) || [];
    let typing = opts && typeof opts.typing === "number" ? opts.typing : -1;
    // Read back, a line can read differently once more — a "*" of the text
    // that now stands against a marker. A few rounds settle it; the editor
    // gets the settled line, in one go.
    for (let round = 0; round < 4; round++) {
        const step = normalizeOnce(line, { carets, typing, image: round === 0 && opts ? opts.image : null });
        if (!step) break;
        result = step;
        line = step.runs;
        carets = step.carets;
        typing = -1;
    }
    return result;
}

function normalizeOnce(items, opts) {
    const list = (items || []).filter((it) => it && (it.type === "image" || it.text));
    const text = lineText(list);
    const marked = list.some((it) => it.type === "text" && (it.bold || it.italic));
    if (!marked && text.indexOf("*") === -1 && text.indexOf("_") === -1 && text.indexOf("![") === -1) return null;

    const spelt = spellLine(list);
    const md = spelt.out;
    const trace = spelt.trace;
    const present = new Set(trace.images); // where the images already there stand
    const mayImage = opts && opts.image;
    const read = parseInline(md, {
        image: (url, at) => present.has(at) || (!!mayImage && mayImage(url)),
    });
    const runs = normalizeRuns(read.runs);
    if (lineText(runs) === text && imageCount(runs) === imageCount(list)
        && marksKey(runs) === marksKey(normalizeRuns(list))) return null;

    // A caret, from its item to the markdown: the text before it, plus the
    // markers written before it. At a marker's own place the caret is inside
    // the mark when it stands in the marked item, outside when it stands in
    // the next one.
    const starts = [];
    let acc = 0;
    for (const it of items || []) {
        starts.push(acc);
        if (it && (it.type === "image" || it.text)) acc += itemLength(it);
    }
    const toMarkdown = (itemIndex, offset) => {
        const it = (items || [])[itemIndex];
        const len = it ? itemLength(it) : 0;
        const o = it && it.type === "image" ? (offset > 0 ? len : 0) : Math.max(0, Math.min(offset, len));
        const at = (starts[itemIndex] || 0) + o;
        let pos = at;
        for (const m of trace.marks) {
            if (m.at < at || (m.at === at && (m.open ? o < len : o === 0))) pos += m.len;
        }
        return pos;
    };
    const carets = ((opts && opts.carets) || []).map(([k, o]) => toMarkdown(k, o));

    // A "*" of the text closing a mark that a marker of OURS opened (or the
    // other way round) is a marker half typed inside marked text —
    // "**one *two**" on the way to "**one *two* three**". Read as it
    // stands it would undo the mark around it: the line is left alone
    // until the reader has finished.
    for (const pair of read.pairs) {
        const opener = whose(trace, pair[2]);
        const closer = whose(trace, pair[3]);
        if (opener !== closer || opener === "both") return null;
    }

    // The marker the reader is in the middle of typing: wait for the rest.
    const typing = opts && typeof opts.typing === "number" ? opts.typing : -1;
    if (typing >= 0 && typing < carets.length) {
        const here = carets[typing];
        const d = read.delims.find((x) => x.e0 === here);
        if (d) {
            if (d.left > 0 && d.left < d.len) return null;
            if (d.left === 0 && read.pairs.some(([opener, closer]) => closer === d && opener.left > 0)) return null;
        }
    }

    // …and from the markdown to the runs read back.
    const lengths = runs.map((r) => (r.type === "image" ? r.raw.length : r.text.length));
    const toRun = (pos) => {
        let gone = 0;
        let after = false;
        for (const [s, e] of read.removed) {
            if (e <= pos) { gone += e - s; if (e === pos) after = true; }
            else if (s < pos) { gone += pos - s; after = true; }
        }
        const at = pos - gone;
        let start = 0;
        let k = 0;
        for (; k < runs.length - 1; k++) {
            const end = start + lengths[k];
            // on the border of two runs the caret stays with the one before
            // it — unless it stood after a marker: then it is past that run
            if (at < end || (at === end && !after)) break;
            start = end;
        }
        if (!runs.length) return [0, 0];
        const inRun = Math.max(0, Math.min(at - start, lengths[k]));
        return [k, runs[k].type === "image" ? (inRun > 0 ? 1 : 0) : inRun];
    };
    return { runs, carets: carets.map(toRun) };
}

/** Inline children → lines of markdown (cut at the breaks). */
function inlineToLines(children) {
    const lines = [];
    let cur = [];
    for (const c of children || []) {
        if (c.type === "break") { lines.push(serializeLine(cur)); cur = []; } else cur.push(c);
    }
    lines.push(serializeLine(cur));
    return lines;
}

/**
 * Blocks → markdown. Blocks are a blank line apart.
 *
 * Two lists of one kind in a row would read as ONE list with a gap in it,
 * so the second takes the other marker ("*" for "-", "1)" for "1."), which
 * is how markdown tells them apart.
 */
export function serializeComment(blocks) {
    const parts = [];
    let lastList = null; // { ordered, alt } of the list just written, if it was the last block
    for (const b of blocks || []) {
        if (!b) continue;
        const wasList = lastList;
        lastList = null;
        if (b.type === "quote") {
            // an empty line inside a quote is a bare ">": one quote, two
            // paragraphs — not two quotes
            parts.push(inlineToLines(b.children).map((l) => (l ? "> " + l : ">")).join("\n"));
        } else if (b.type === "list") {
            const items = b.items || [];
            if (!items.length) { lastList = wasList; continue; }
            const ordered = !!b.ordered;
            const alt = !!(wasList && wasList.ordered === ordered && !wasList.alt);
            const start = ordered ? (typeof b.start === "number" && b.start >= 0 ? b.start : 1) : 0;
            const out = [];
            items.forEach((children, k) => {
                const marker = ordered ? (start + k) + (alt ? ") " : ". ") : (alt ? "* " : "- ");
                const pad = " ".repeat(marker.length);
                const lines = inlineToLines(children).map((l, j) => (j === 0 ? marker + l : (l ? pad + l : "")));
                out.push(lines.join("\n"));
            });
            parts.push(out.join(b.loose ? "\n\n" : "\n"));
            lastList = { ordered, alt };
        } else {
            const lines = inlineToLines(b.children);
            if (lines.some((l) => l !== "")) parts.push(lines.join("\n"));
        }
    }
    return parts.join("\n\n");
}

/* ── Can the visual editor show this text? ──────────────────────────── */

// What writing a text back may change: blanks, and the characters of line
// markers and emphasis ("* a" → "- a", "1)" → "1.", a lazy line → "> …").
const squash = (s) => String(s).replace(/[\s>*_+\-.)\d]/g, "");

/**
 * True when `markdown` can be shown in the visual editor and written back
 * without a change of meaning: the reader took it whole (exact), what it
 * writes back reads the same again, and no character but a marker or a
 * blank differs. The composer asks this of every text that does not come
 * from the visual editor itself — a comment loaded for editing, the text
 * typed in markdown mode when the mode is switched.
 */
export function commentVisualizable(markdown, opts) {
    const src = String(markdown == null ? "" : markdown);
    if (!src.trim()) return true;
    let parsed;
    let out;
    try {
        parsed = parseComment(src, opts);
        if (!parsed.exact) return false;
        out = serializeComment(parsed.blocks);
        const again = parseComment(out, opts);
        if (!again.exact || serializeComment(again.blocks) !== out) return false;
    } catch (e) {
        return false;
    }
    return squash(src) === squash(out);
}
