"use strict";
import React from "preact/compat";

// ── AnswerMarkdown ────────────────────────────────────────────────────────────
// The light Markdown the Worker's answers are written in (v4.8), as React nodes —
// never HTML: every piece of text becomes a text node, so whatever the model
// wrote renders literally. What is understood:
//
//   blocks    paragraphs (blank lines apart), "### " headings, "- " bullet lists,
//             "1. " numbered lists
//   inline    **bold**, `code`, [text](https://…) links (https only, new tab),
//             "@author" mentions (links to the profile), and the citations:
//               [E12] [E12, E201]   an /ask body's evidence ids — the ones that name
//                                   a post the answer holds become small numbered
//                                   links that open the post; the others go
//               [1] [2]             a /help answer's excerpt numbers, links to the
//                                   documentation sections (sources)
//
// renderBlocks(markdown, ctx) → nodes; renderInline(text, ctx) → nodes.
//   ctx = { classes, onGoToUsername?, cards?, cites?, onOpenCard?, sources? }
//   cards  { [evidence id]: { id, author, permlink, path, title, src } }
//   cites  Map evidence id → number shown (citationNumbers builds it over the whole answer,
//          so a post keeps its number from one section to the next)

// An account name (3–16: a letter first, then letters, digits, dots, dashes), not followed by more of
// one; a full stop after it ends the sentence.
const MENTION_RE = /(@[a-z][a-z0-9.-]{1,14}[a-z0-9])(?![a-z0-9-]|\.[a-z0-9])/g;
const EVIDENCE_CITE_RE = /\[((?:[REDCI]\d{1,9})(?:\s*[,;]\s*[REDCI]\d{1,9})*)\]/g;
const INLINE_RE = /\[((?:[REDCI]\d{1,9})(?:\s*[,;]\s*[REDCI]\d{1,9})*)\]|\[(\d{1,2})\]|\*\*([^*\n]{1,200})\*\*|`([^`\n]{1,160})`|\[([^\]\n]{1,120})\]\((https:\/\/[^\s)]{1,300})\)/g;

const ids = (list) => String(list).split(/\s*[,;]\s*/).filter(Boolean);

/** Plain text with "@author" as links to the profile. */
export function withMentions(text, onGoToUsername, className) {
    if (!onGoToUsername || !text.includes("@")) return text;
    const out = [];
    let last = 0;
    let m;
    MENTION_RE.lastIndex = 0;
    while ((m = MENTION_RE.exec(text))) {
        if (m.index > 0 && /[\p{L}\p{N}_]/u.test(text[m.index - 1])) continue; // an e-mail-like "a@b"
        const name = m[1].slice(1);
        if (m.index > last) out.push(text.slice(last, m.index));
        out.push(
            <span
                key={"m" + m.index}
                role="link"
                tabIndex={0}
                className={className}
                onClick={() => onGoToUsername(name)}
                onKeyDown={(e) => { if (e.key === "Enter") onGoToUsername(name); }}
            >
                {m[1]}
            </span>,
        );
        last = m.index + m[0].length;
    }
    if (!out.length) return text;
    if (last < text.length) out.push(text.slice(last));
    return out;
}

/**
 * The evidence ids `markdown` cites that name a post the answer holds (`cards`), numbered in
 * order of first appearance: Map id → n. One map per answer, over every part that cites.
 */
export function citationNumbers(texts, cards) {
    const map = new Map();
    if (!cards) return map;
    for (const text of texts) {
        if (typeof text !== "string") continue;
        let m;
        EVIDENCE_CITE_RE.lastIndex = 0;
        while ((m = EVIDENCE_CITE_RE.exec(text))) {
            for (const id of ids(m[1])) if (cards[id] && !map.has(id)) map.set(id, map.size + 1);
        }
    }
    return map;
}

/** Citations of posts the answer does not hold go, with the space before them; a sentence keeps its full stop. */
function dropUnknownCitations(text, cards) {
    if (!text.includes("[")) return text;
    return text
        .replace(/\s*\[((?:[REDCI]\d{1,9})(?:\s*[,;]\s*[REDCI]\d{1,9})*)\]/g, (m, list) => (cards && ids(list).some((id) => cards[id]) ? m : ""))
        .replace(/\s+([.,;:!?])/g, "$1");
}

function Cite({ classes, n, card, onOpenCard }) {
    const title = card.title ? card.title + " · @" + card.author : "@" + card.author;
    return (
        <sup className={classes.answerCite}>
            <a
                role="link"
                tabIndex={0}
                title={title}
                onClick={(e) => { e.preventDefault(); if (onOpenCard) onOpenCard(card); }}
                onKeyDown={(e) => { if (e.key === "Enter" && onOpenCard) onOpenCard(card); }}
            >
                {n}
            </a>
        </sup>
    );
}

/** One line of text with its inline marks, citations and mentions. */
export function renderInline(text, ctx) {
    const { classes, onGoToUsername, cards, cites, onOpenCard, sources } = ctx;
    const s = dropUnknownCitations(String(text == null ? "" : text), cards);
    const byN = sources ? new Map(sources.map((x) => [x.n, x])) : null;
    const out = [];
    let last = 0;
    let m;
    INLINE_RE.lastIndex = 0;
    const plain = (t, key) => {
        if (!t) return;
        const nodes = withMentions(t, onGoToUsername, classes.answerMention);
        if (Array.isArray(nodes)) out.push(<React.Fragment key={key}>{nodes}</React.Fragment>);
        else out.push(nodes);
    };
    while ((m = INLINE_RE.exec(s))) {
        if (m.index > last) plain(s.slice(last, m.index), "t" + last);
        if (m[1]) {
            // [E12, E201]: the posts the answer holds, as numbered links; the rest were dropped above
            const known = ids(m[1]).filter((id) => cards && cards[id] && cites && cites.has(id));
            known.forEach((id, i) => {
                if (i) out.push(" ");
                out.push(<Cite key={"c" + m.index + id} classes={classes} n={cites.get(id)} card={cards[id]} onOpenCard={onOpenCard} />);
            });
        } else if (m[2]) {
            // [n]: a documentation excerpt
            const src = byN ? byN.get(Number(m[2])) : null;
            out.push(
                src ? (
                    <sup key={"s" + m.index} className={classes.answerCite}>
                        <a href={src.url} target="_blank" rel="noopener noreferrer" title={src.heading ? src.title + " › " + src.heading : src.title}>
                            [{m[2]}]
                        </a>
                    </sup>
                ) : (
                    m[0]
                ),
            );
        } else if (m[3]) {
            out.push(<b key={"b" + m.index}>{withMentions(m[3], onGoToUsername, classes.answerMention)}</b>);
        } else if (m[4]) {
            out.push(<code key={"k" + m.index} className={classes.answerCode}>{m[4]}</code>);
        } else {
            out.push(
                <a key={"l" + m.index} href={m[6]} target="_blank" rel="noopener noreferrer" className={classes.answerLink}>
                    {m[5]}
                </a>,
            );
        }
        last = m.index + m[0].length;
    }
    if (last < s.length) plain(s.slice(last), "t" + last);
    return out.length === 1 ? out[0] : out;
}

const HEADING_RE = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/;
const BULLET_RE = /^\s*[-*•]\s+(.*)$/;
const NUMBERED_RE = /^\s*\d{1,3}[.)]\s+(.*)$/;

/** The blocks of a Markdown text: [{ type: "h" | "p" | "ul" | "ol", text | lines | items }]. */
export function parseBlocks(markdown) {
    const blocks = [];
    let cur = null;
    const flush = () => {
        if (cur) blocks.push(cur);
        cur = null;
    };
    for (const raw of String(markdown == null ? "" : markdown).split(/\r?\n/)) {
        const line = raw.replace(/\s+$/, "");
        if (!line.trim()) {
            flush();
            continue;
        }
        let m;
        if ((m = HEADING_RE.exec(line))) {
            flush();
            blocks.push({ type: "h", text: m[1] });
        } else if ((m = BULLET_RE.exec(line))) {
            if (!cur || cur.type !== "ul") {
                flush();
                cur = { type: "ul", items: [] };
            }
            cur.items.push(m[1]);
        } else if ((m = NUMBERED_RE.exec(line))) {
            if (!cur || cur.type !== "ol") {
                flush();
                cur = { type: "ol", items: [] };
            }
            cur.items.push(m[1]);
        } else {
            if (!cur || cur.type !== "p") {
                flush();
                cur = { type: "p", lines: [] };
            }
            cur.lines.push(line.trim());
        }
    }
    flush();
    return blocks;
}

/** A Markdown text as paragraphs, headings and lists (text nodes only). */
export function renderBlocks(markdown, ctx) {
    const { classes } = ctx;
    return parseBlocks(markdown).map((b, i) => {
        if (b.type === "h") return <h4 key={i} className={classes.answerHeading}>{renderInline(b.text, ctx)}</h4>;
        if (b.type === "ul" || b.type === "ol") {
            const Tag = b.type;
            return (
                <Tag key={i} className={classes.answerList}>
                    {b.items.map((item, j) => <li key={j}>{renderInline(item, ctx)}</li>)}
                </Tag>
            );
        }
        return (
            <p key={i} className={classes.answerText}>
                {b.lines.map((line, j) => (
                    <React.Fragment key={j}>
                        {j ? "\n" : null}
                        {renderInline(line, ctx)}
                    </React.Fragment>
                ))}
            </p>
        );
    });
}
