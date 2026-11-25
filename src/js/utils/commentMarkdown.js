/**
 * Markdown editing for the comment composer (components/CommentComposer).
 *
 * The composer is a plain <textarea> holding markdown — what goes on chain is
 * exactly what the reader typed — and its format bar only rewrites that text:
 * `**bold**`, `*italic*`, `> quote`, `- item` / `1. item`, and one
 * `![alt](url)` image. Every operation is a pure function of
 * (value, selectionStart, selectionEnd) returning an EDIT:
 *
 *     { from, to, text, selStart, selEnd }
 *
 * — replace value.slice(from, to) with `text`, then select [selStart, selEnd)
 * in the new value. The component applies an edit as ONE insertText, so one
 * Ctrl+Z undoes one button press.
 *
 * Block operations (quote, list) put a blank line between the block and a
 * neighbouring line of another kind. Markdown needs it: a text line right
 * under a quote or a list item is a "lazy continuation" of it, so without the
 * blank line the next sentence would be swallowed by the quote.
 *
 * No imports, no DOM: unit-testable in Node.
 */

/** Images a comment (or an artwork's description) may hold. */
export const MAX_COMMENT_IMAGES = 1;

/* ── Lines ──────────────────────────────────────────────────────────── */

const lineStartAt = (value, pos) => (pos > 0 ? value.lastIndexOf("\n", pos - 1) + 1 : 0);
const lineEndAt = (value, pos) => {
    const i = value.indexOf("\n", pos);
    return i === -1 ? value.length : i;
};
const isBlank = (line) => !line || !line.trim();

/** The whole lines a selection touches. One that ends at column 0 of a line
 *  (a drag down to the start of the next line) does not take that line. */
function touchedLines(value, start, end) {
    const last = end > start && value[end - 1] === "\n" ? end - 1 : end;
    const from = lineStartAt(value, start);
    const to = lineEndAt(value, Math.max(last, from));
    return { from, to };
}

/** The line above the one starting at `from`, or null at the top. */
const lineBefore = (value, from) => (from > 0 ? value.slice(lineStartAt(value, from - 1), from - 1) : null);
/** The line below the one ending at `to`, or null at the bottom. */
const lineAfter = (value, to) => (to < value.length ? value.slice(to + 1, lineEndAt(value, to + 1)) : null);

/* ── Block prefixes ─────────────────────────────────────────────────── */

const QUOTE_RE = /^ {0,3}>[ \t]?/;
// After any quote prefix: indent, then "-", "*", "+" or "1." / "1)" followed
// by blanks — or the bare marker at the end of the line (an item not yet
// written). "*emphasis*", "-5 °C" and "1.5 kg" are not items.
const LIST_RE = /^([ \t]*)(?:([-*+])|(\d{1,9})([.)]))(?:[ \t]+|$)/;

/**
 * A line's quote prefix and list marker. `markerAt` is where a list marker
 * starts (or would be inserted), `prefixEnd` where the line's text starts.
 */
function parseLine(line) {
    const q = QUOTE_RE.exec(line);
    const quote = q ? q[0] : "";
    const rest = line.slice(quote.length);
    const m = LIST_RE.exec(rest);
    if (!m) {
        const lead = /^[ \t]*/.exec(rest)[0].length;
        return {
            quote, kind: "none", indent: rest.slice(0, lead), marker: "", bullet: "", num: 0, delim: "",
            markerAt: quote.length + lead, prefixEnd: quote.length,
        };
    }
    const markerAt = quote.length + m[1].length;
    const marker = m[0].slice(m[1].length);
    return {
        quote, kind: m[2] ? "bullet" : "number", indent: m[1], marker,
        bullet: m[2] || "", num: m[3] ? parseInt(m[3], 10) : 0, delim: m[4] || "",
        markerAt, prefixEnd: markerAt + marker.length,
    };
}

/** "blank" | "quote" | "list" | "text" — what a line is, for block spacing. */
function blockKind(line) {
    if (isBlank(line)) return "blank";
    if (QUOTE_RE.test(line)) return "quote";
    return parseLine(line).kind === "none" ? "text" : "list";
}

/** "bullet" | "number" when every written line is that kind of item, else "none". */
function listState(lines) {
    let state = null;
    for (const line of lines) {
        if (isBlank(line)) continue;
        const kind = parseLine(line).kind;
        if (kind === "none" || (state && state !== kind)) return "none";
        state = kind;
    }
    return state || "none";
}

/** True when every written line is quoted. */
function quoteState(lines) {
    let any = false;
    for (const line of lines) {
        if (isBlank(line)) continue;
        if (!QUOTE_RE.test(line)) return false;
        any = true;
    }
    return any;
}

/**
 * Rewrite the lines of [from, to). `perLine(line, i)` returns null (line
 * unchanged) or { at, del, ins }: replace line.slice(at, at + del) with ins.
 * Returns the new block and `map`, which carries an old position (anywhere
 * in the value) to the new one: a position inside a replaced prefix lands
 * at its end, i.e. where the line's text starts.
 */
function editLines(value, from, to, perLine) {
    const lines = value.slice(from, to).split("\n");
    const segs = [];
    const out = [];
    let oldPos = from;
    let newPos = from;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const e = perLine(line, i) || null;
        const next = e ? line.slice(0, e.at) + e.ins + line.slice(e.at + e.del) : line;
        segs.push({ oldStart: oldPos, oldEnd: oldPos + line.length, newStart: newPos, e });
        out.push(next);
        oldPos += line.length + 1;
        newPos += next.length + 1;
    }
    const text = out.join("\n");
    const delta = text.length - (to - from);
    const map = (pos) => {
        if (pos > to) return pos + delta;
        if (pos < from) return pos;
        for (const s of segs) {
            if (pos > s.oldEnd) continue;
            let c = pos - s.oldStart;
            const e = s.e;
            if (e && c >= e.at) c = c <= e.at + e.del ? e.at + e.ins.length : c + e.ins.length - e.del;
            return s.newStart + c;
        }
        return from + text.length;
    };
    return { text, map };
}

/**
 * The edit for a rewritten block, with a blank line added above and/or below
 * where the neighbouring line is of another kind than the block's new kind
 * (see the module comment).
 */
function blockEdit(value, start, end, from, to, block) {
    const first = block.text.split("\n").find((l) => !isBlank(l));
    const kind = first === undefined ? "blank" : blockKind(first);
    let before = "";
    let after = "";
    if (kind !== "blank") {
        const prev = lineBefore(value, from);
        const next = lineAfter(value, to);
        if (prev !== null && !isBlank(prev) && blockKind(prev) !== kind) before = "\n";
        if (next !== null && !isBlank(next) && blockKind(next) !== kind) after = "\n";
    }
    const map = (pos) => block.map(pos) + (pos < from ? 0 : before.length) + (pos > to ? after.length : 0);
    return { from, to, text: before + block.text + after, selStart: map(start), selEnd: map(end) };
}

/** Quote / unquote the selected lines. */
export function toggleQuote(value, start, end) {
    const { from, to } = touchedLines(value, start, end);
    const lines = value.slice(from, to).split("\n");
    const on = !quoteState(lines);
    const many = lines.length > 1;
    const block = editLines(value, from, to, (line) => {
        // A blank line inside a quoted selection gets a bare ">": the quote
        // stays one quote with two paragraphs instead of two quotes.
        if (on) return { at: 0, del: 0, ins: many && isBlank(line) ? ">" : "> " };
        const q = QUOTE_RE.exec(line);
        return q ? { at: 0, del: q[0].length, ins: "" } : null;
    });
    return blockEdit(value, start, end, from, to, block);
}

/**
 * The list button's three states, in turn: no list → bullets → numbers → no
 * list. The state is read off the selected lines (listState); numbering goes
 * on from a numbered item right above.
 */
export function cycleList(value, start, end) {
    const { from, to } = touchedLines(value, start, end);
    const lines = value.slice(from, to).split("\n");
    const state = listState(lines);
    const next = state === "none" ? "bullet" : state === "bullet" ? "number" : "none";
    const many = lines.length > 1;
    let n = 1;
    if (next === "number") {
        const prev = lineBefore(value, from);
        if (prev !== null && !isBlank(prev)) {
            const p = parseLine(prev);
            if (p.kind === "number") n = p.num + 1;
        }
    }
    const block = editLines(value, from, to, (line) => {
        if (many && isBlank(line)) return null;
        const p = parseLine(line);
        if (next === "none") return p.kind === "none" ? null : { at: p.markerAt, del: p.marker.length, ins: "" };
        const ins = next === "bullet" ? "- " : n++ + ". ";
        return { at: p.markerAt, del: p.kind === "none" ? 0 : p.marker.length, ins };
    });
    return blockEdit(value, start, end, from, to, block);
}

/* ── Inline: bold / italic ──────────────────────────────────────────── */

const MARKS = { bold: "**", italic: "*" };
// What a run of n emphasis markers carries: ** bold, * italic, *** both.
const carries = (kind, n) => (kind === "bold" ? n >= 2 : n === 1 || n >= 3);
const EDGE_PUNCT_RE = /[.,;:!?"'“”‘’«»()[\]{}<>]/;
const SPACE_RE = /\s/;

/** The run of one marker character ("*" or "_") next to `pos` — dir -1
 *  looks left, +1 right — within [lo, hi). Counted up to 3. */
function runAt(value, pos, dir, lo, hi) {
    let i = dir < 0 ? pos - 1 : pos;
    if (i < lo || i >= hi) return { ch: "", n: 0 };
    const ch = value[i];
    if (ch !== "*" && ch !== "_") return { ch: "", n: 0 };
    let n = 0;
    while (i >= lo && i < hi && value[i] === ch && n < 3) {
        n++;
        i += dir;
    }
    return { ch, n };
}

/** Where a line's text starts: after its quote prefix and list marker. */
function textStart(value, ls, le) {
    const p = parseLine(value.slice(ls, le));
    return ls + (p.kind === "none" ? p.markerAt : p.prefixEnd);
}

/** Markers of `kind` right around [s, e) ("outside") or at its own edges ("inside"). */
function segmentStyle(value, s, e, ls, le, kind) {
    const m = MARKS[kind].length;
    const L = runAt(value, s, -1, ls, le);
    const R = runAt(value, e, +1, ls, le);
    if (L.n && L.ch === R.ch && carries(kind, Math.min(L.n, R.n))) return { where: "outside", m };
    const Li = runAt(value, s, +1, s, e);
    const Ri = runAt(value, e, -1, s, e);
    if (Li.n && Li.ch === Ri.ch && e - s > Li.n + Ri.n && carries(kind, Math.min(Li.n, Ri.n))) {
        return { where: "inside", m };
    }
    return null;
}

/** A `**…**` (or `*…*`) span of the line holding all of [s, e). Runs are
 *  paired left to right — the reading of an ordinary comment line. */
function enclosingSpan(value, s, e, ls, le, kind) {
    const cs = textStart(value, ls, le);
    const re = /\*+/g;
    const runs = [];
    const text = value.slice(cs, le);
    let mm;
    while ((mm = re.exec(text))) {
        if (carries(kind, Math.min(mm[0].length, 3))) runs.push({ at: cs + mm.index, n: mm[0].length });
    }
    for (let i = 0; i + 1 < runs.length; i += 2) {
        const o = runs[i];
        const c = runs[i + 1];
        if (s >= o.at + o.n && e <= c.at) return { o, c };
    }
    return null;
}

/** The word the caret sits strictly inside, edge punctuation excluded. */
function wordAt(value, pos, ls, le) {
    if (pos <= ls || pos >= le) return null;
    if (SPACE_RE.test(value[pos - 1]) || SPACE_RE.test(value[pos])) return null;
    let s = pos;
    let e = pos;
    while (s > ls && !SPACE_RE.test(value[s - 1])) s--;
    while (e < le && !SPACE_RE.test(value[e])) e++;
    const cs = textStart(value, ls, le);
    if (s < cs) s = cs;
    while (s < e && EDGE_PUNCT_RE.test(value[s])) s++;
    while (e > s && EDGE_PUNCT_RE.test(value[e - 1])) e--;
    return e > s && pos >= s && pos <= e ? { s, e } : null;
}

function wrapSegment(value, s, e, M, a = s, b = e) {
    const m = M.length;
    const map = (p) => (p < s ? p : p > e ? p + 2 * m : p + m);
    return { from: s, to: e, text: M + value.slice(s, e) + M, selStart: map(a), selEnd: map(b) };
}

function unwrapSegment(value, s, e, st, a = s, b = e) {
    const m = st.m;
    if (st.where === "outside") {
        const from = s - m;
        const to = e + m;
        const map = (p) => (p < from ? p : p <= s ? from : p <= e ? p - m : p <= to ? e - m : p - 2 * m);
        return { from, to, text: value.slice(s, e), selStart: map(a), selEnd: map(b) };
    }
    const map = (p) => (p < s ? p : p <= s + m ? s : p < e - m ? p - m : p <= e ? e - 2 * m : p - 2 * m);
    return { from: s, to: e, text: value.slice(s + m, e - m), selStart: map(a), selEnd: map(b) };
}

function unwrapSpan(value, span, m, a, b) {
    const cs = span.o.at + span.o.n;
    const ce = span.c.at;
    const from = cs - m;
    const to = ce + m;
    const map = (p) => (p < from ? p : p <= cs ? from : p <= ce ? p - m : p <= to ? ce - m : p - 2 * m);
    return { from, to, text: value.slice(cs, ce), selStart: map(a), selEnd: map(b) };
}

function inlineOnLines(value, start, end, kind) {
    const M = MARKS[kind];
    const { from, to } = touchedLines(value, start, end);
    const segs = [];
    let pos = from;
    for (const line of value.slice(from, to).split("\n")) {
        const ls = pos;
        const le = pos + line.length;
        pos = le + 1;
        let s = Math.max(start, textStart(value, ls, le));
        let e = Math.min(end, le);
        while (s < e && SPACE_RE.test(value[s])) s++;
        while (e > s && SPACE_RE.test(value[e - 1])) e--;
        if (e > s) segs.push({ s, e, st: segmentStyle(value, s, e, ls, le, kind) });
    }
    if (!segs.length) return { active: false, edit: null };
    const active = segs.every((g) => g.st);
    let out = "";
    let cursor = from;
    for (const g of segs) {
        const edit = active ? unwrapSegment(value, g.s, g.e, g.st) : g.st ? null : wrapSegment(value, g.s, g.e, M);
        if (!edit) continue;
        out += value.slice(cursor, edit.from) + edit.text;
        cursor = edit.to;
    }
    out += value.slice(cursor, to);
    return { active, edit: { from, to, text: out, selStart: from, selEnd: from + out.length } };
}

/**
 * Bold / italic. Returns { active, edit }: `active` is what the button shows
 * (the selection, or the caret's word or span, already carries the style),
 * `edit` what a press does.
 *
 *   caret between an empty pair "**|**"   → the pair goes
 *   caret inside a styled span            → the span loses the style
 *   caret inside a word                   → the word is toggled
 *   caret anywhere else                   → an empty pair, caret inside
 *   selection                             → trimmed of edge blanks, then
 *                                           unwrapped if styled, else wrapped
 *   selection over several lines          → each line's part, together
 */
export function toggleInline(value, start, end, kind) {
    const v = value || "";
    if (start > end) {
        const x = start;
        start = end;
        end = x;
    }
    if (v.slice(start, end).indexOf("\n") !== -1) return inlineOnLines(v, start, end, kind);
    const M = MARKS[kind];
    const m = M.length;
    const ls = lineStartAt(v, start);
    const le = lineEndAt(v, start);
    let s = start;
    let e = end;
    if (s < e) {
        while (s < e && SPACE_RE.test(v[s])) s++;
        while (e > s && SPACE_RE.test(v[e - 1])) e--;
    }
    if (s === e) {
        const pos = start === end ? start : s;
        const L = runAt(v, pos, -1, ls, le);
        const R = runAt(v, pos, +1, ls, le);
        if (L.n && L.ch === R.ch && carries(kind, Math.min(L.n, R.n))) {
            return { active: true, edit: { from: pos - m, to: pos + m, text: "", selStart: pos - m, selEnd: pos - m } };
        }
        const span = enclosingSpan(v, pos, pos, ls, le, kind);
        if (span) return { active: true, edit: unwrapSpan(v, span, m, pos, pos) };
        const w = wordAt(v, pos, ls, le);
        if (w) {
            const st = segmentStyle(v, w.s, w.e, ls, le, kind);
            return st
                ? { active: true, edit: unwrapSegment(v, w.s, w.e, st, pos, pos) }
                : { active: false, edit: wrapSegment(v, w.s, w.e, M, pos, pos) };
        }
        return { active: false, edit: { from: pos, to: pos, text: M + M, selStart: pos + m, selEnd: pos + m } };
    }
    const st = segmentStyle(v, s, e, ls, le, kind);
    if (st) return { active: true, edit: unwrapSegment(v, s, e, st) };
    const span = enclosingSpan(v, s, e, ls, le, kind);
    if (span) return { active: true, edit: unwrapSpan(v, span, m, s, e) };
    return { active: false, edit: wrapSegment(v, s, e, M) };
}

/* ── Newlines in lists and quotes ───────────────────────────────────── */

/**
 * What a new line does inside a list item or a quote: the next line starts
 * with the next marker ("- ", "3. ", "> "); on an item (or quote line) that
 * is still empty it ends the list instead — the marker goes, and the caret
 * moves to a fresh line below a blank one. Null when the line is neither, so
 * the key does what it always does.
 *
 * `listsOnly`: for an Enter that would otherwise SEND (desktop), lists only —
 * writing a list must not post the comment at its first item.
 */
export function continueOnNewline(value, start, end, opts) {
    const listsOnly = !!(opts && opts.listsOnly);
    if (start !== end) return null;
    const v = value || "";
    const ls = lineStartAt(v, start);
    const le = lineEndAt(v, start);
    const line = v.slice(ls, le);
    const p = parseLine(line);
    if (p.kind === "none" && (listsOnly || !p.quote)) return null;
    const prefixEnd = p.kind === "none" ? p.quote.length : p.prefixEnd;
    if (start - ls < prefixEnd) return null;
    if (isBlank(line.slice(prefixEnd))) {
        const prev = lineBefore(v, ls);
        const text = prev !== null && !isBlank(prev) ? "\n" : "";
        return { from: ls, to: le, text, selStart: ls + text.length, selEnd: ls + text.length };
    }
    const quote = p.quote ? p.quote.replace(/[ \t]*$/, "") + " " : "";
    const marker = p.kind === "bullet"
        ? p.indent + p.bullet + " "
        : p.kind === "number" ? p.indent + (p.num + 1) + p.delim + " " : "";
    const text = "\n" + quote + marker;
    return { from: start, to: start, text, selStart: start + text.length, selEnd: start + text.length };
}

/* ── Images ─────────────────────────────────────────────────────────── */

// ![alt](url), ![alt](<url>), ![alt](url "title") — and raw <img …> tags,
// which the comment tier renders as well.
const MD_IMAGE_RE = /!\[((?:\\.|[^\]\\\n])*)\]\([ \t]*(<[^<>\n]*>|[^\s()<>]+(?:\([^\s()<>]*\)[^\s()<>]*)*)(?:[ \t]+(?:"[^"\n]*"|'[^'\n]*'|\([^()\n]*\)))?[ \t]*\)/g;
const HTML_IMAGE_RE = /<img\b[^>]*>/gi;
const HTML_SRC_RE = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;

/** Every image in the text, in order: { start, end, url, alt }. */
export function findImages(value) {
    const v = value || "";
    const found = [];
    let m;
    MD_IMAGE_RE.lastIndex = 0;
    while ((m = MD_IMAGE_RE.exec(v))) {
        let url = m[2];
        if (url.charAt(0) === "<") url = url.slice(1, -1);
        found.push({ start: m.index, end: m.index + m[0].length, url: url.trim(), alt: m[1] });
    }
    HTML_IMAGE_RE.lastIndex = 0;
    while ((m = HTML_IMAGE_RE.exec(v))) {
        const src = HTML_SRC_RE.exec(m[0]);
        found.push({ start: m.index, end: m.index + m[0].length, url: src ? src[1] || src[2] || src[3] || "" : "", alt: "" });
    }
    return found.sort((a, b) => a.start - b.start);
}

/** Alt text out of a file name: "sunset over Zug.webp" → "sunset over Zug". */
export function altFromFileName(name) {
    const base = String(name || "").replace(/\.[^./\\]+$/, "");
    const clean = base.replace(/[[\]\\\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
    return clean || "image";
}

// encodeURIComponent leaves "(" and ")" alone — they would end the link.
const URL_ESCAPES = { "(": "%28", ")": "%29", "<": "%3C", ">": "%3E" };

/** `![alt](url)`, with the few characters that would end the URL escaped. */
export function imageMarkdown(url, alt) {
    const a = String(alt || "").replace(/[[\]\\\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
    const u = String(url || "").trim().replace(/[\s()<>]/g, (c) => URL_ESCAPES[c] || encodeURIComponent(c));
    return "![" + a + "](" + u + ")";
}

/**
 * Put an image in. The text holds MAX_COMMENT_IMAGES (one) at most, so when
 * there is one already the new image takes its place; otherwise it goes in
 * as a paragraph of its own after the selection.
 */
export function insertImage(value, start, end, url, alt) {
    const v = value || "";
    const token = imageMarkdown(url, alt);
    const images = findImages(v);
    if (images.length) {
        const img = images[0];
        const caret = img.start + token.length;
        return { from: img.start, to: img.end, text: token, selStart: caret, selEnd: caret };
    }
    const at = Math.max(start, end);
    const before = v.slice(0, at);
    const after = v.slice(at);
    const lead = !before ? "" : /\n\n$/.test(before) ? "" : /\n$/.test(before) ? "\n" : "\n\n";
    const tail = !after ? "" : /^\n\n/.test(after) ? "" : /^\n/.test(after) ? "\n" : "\n\n";
    const caret = at + lead.length + token.length;
    return { from: at, to: at, text: lead + token + tail, selStart: caret, selEnd: caret };
}

/** Take the first image out, with the blank lines it stood between. */
export function removeFirstImage(value) {
    const v = value || "";
    const images = findImages(v);
    if (!images.length) return null;
    const img = images[0];
    const before = v.slice(0, img.start);
    const after = v.slice(img.end);
    const lead = /\n*$/.exec(before)[0].length;
    const tail = /^\n*/.exec(after)[0].length;
    const from = img.start - lead;
    const to = img.end + tail;
    const joined = before.slice(0, before.length - lead) && after.slice(tail);
    const text = joined ? "\n".repeat(Math.min(2, lead + tail)) : "";
    return { from, to, text, selStart: from + text.length, selEnd: from + text.length };
}

/** Null, or "too_many_images" when the text holds more than `max` images. */
export function commentImageProblem(text, max = MAX_COMMENT_IMAGES) {
    return findImages(text).length > max ? "too_many_images" : null;
}

/* ── Format state (the buttons' look) ───────────────────────────────── */

/** What the format bar shows for this selection. */
export function formatState(value, start, end) {
    const v = value || "";
    const s = Math.min(start || 0, end || 0);
    const e = Math.max(start || 0, end || 0);
    const { from, to } = touchedLines(v, s, e);
    const lines = v.slice(from, to).split("\n");
    const images = findImages(v);
    return {
        bold: toggleInline(v, s, e, "bold").active,
        italic: toggleInline(v, s, e, "italic").active,
        quote: quoteState(lines),
        list: listState(lines),
        imageCount: images.length,
        imageUrl: images.length ? images[0].url : "",
    };
}

/* ── Broadcast ──────────────────────────────────────────────────────── */

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;

/**
 * The body to broadcast: a line break typed in the box stays a line break.
 *
 * The app renders markdown with `breaks: false`, where a single newline
 * inside a paragraph is only a space — two lines typed one under the other
 * came out as one. Each such line gets markdown's hard break (two trailing
 * spaces), outside code fences, and not before a blank line (a paragraph
 * break already). Idempotent: a line that already ends in a hard break is
 * left alone, so an edited comment does not grow.
 */
export function commentBodyForBroadcast(text) {
    const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
    let fence = "";
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const f = FENCE_RE.exec(line);
        if (f) {
            const ch = f[1].charAt(0);
            if (!fence) fence = ch;
            else if (ch === fence) fence = "";
            continue;
        }
        if (fence || i === lines.length - 1) continue;
        const next = lines[i + 1];
        if (isBlank(line) || isBlank(next) || FENCE_RE.test(next)) continue;
        if (/( {2,}|\\)$/.test(line)) continue;
        if (/^ {0,3}(#{1,6}(\s|$)|\|)/.test(line)) continue;
        lines[i] = line.replace(/[ \t]+$/, "") + "  ";
    }
    return lines.join("\n");
}
