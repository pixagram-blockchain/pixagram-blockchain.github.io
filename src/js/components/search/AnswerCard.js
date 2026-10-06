"use strict";
import React, { useCallback, useMemo, useState } from "preact/compat";
import CircularProgress from "@material-ui/core/CircularProgress";
import QuestionAnswerOutlined from "@material-ui/icons/QuestionAnswerOutlined";
import LibraryBooksOutlined from "@material-ui/icons/LibraryBooksOutlined";

import { t, useLanguage } from "../../utils/text";

import { tr } from "./highlight";

// ── AnswerCard ────────────────────────────────────────────────────────────────
// The answer to the question typed, above the results (useSearch.answer):
//
//   about the artworks (/ask)        the sentence, "@author" mentions as links to
//                                    the profile, then the artworks behind it as
//                                    thumbnails that open them
//   about the platform (/help)       the documentation's answer, its [n]
//                                    citations as links to the sections, then
//                                    the sections (with their excerpts when the
//                                    model could not write an answer)
//   documentation pages that match   when the Worker saw no question but the
//                                    words are the platform's own
//
// Everything is text from the Worker rendered as text nodes (never HTML); links
// are the https ones searchApi let through, opened in a new tab.

// An account name (3–16: a letter first, then letters, digits, dots, dashes), not followed by more of
// one; a full stop after it ends the sentence.
const MENTION_RE = /(@[a-z][a-z0-9.-]{1,14}[a-z0-9])(?![a-z0-9-]|\.[a-z0-9])/g;

/** Plain text with "@author" as links to the profile. */
function withMentions(text, onGoToUsername, className) {
    if (!onGoToUsername) return text;
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

const INLINE_RE = /\[(\d{1,2})\]|\*\*([^*\n]{1,200})\*\*|`([^`\n]{1,120})`/g;

/** Plain text with [n] as links to source n, **bold** and `code` (the help answer's only markup). */
function withCitations(text, sources, classes) {
    const byN = new Map(sources.map((s) => [s.n, s]));
    const out = [];
    let last = 0;
    let m;
    INLINE_RE.lastIndex = 0;
    while ((m = INLINE_RE.exec(text))) {
        if (m.index > last) out.push(text.slice(last, m.index));
        if (m[1]) {
            const s = byN.get(Number(m[1]));
            out.push(
                s ? (
                    <sup key={"c" + m.index} className={classes.answerCite}>
                        <a href={s.url} target="_blank" rel="noopener noreferrer" title={s.heading ? s.title + " › " + s.heading : s.title}>
                            [{m[1]}]
                        </a>
                    </sup>
                ) : (
                    m[0]
                ),
            );
        } else if (m[2]) {
            out.push(<b key={"b" + m.index}>{m[2]}</b>);
        } else {
            out.push(<code key={"k" + m.index} className={classes.answerCode}>{m[3]}</code>);
        }
        last = m.index + m[0].length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
}

/** An artwork behind the answer: a small square thumbnail that opens it. */
function AnswerThumb({ classes, item, onOpen }) {
    const [failed, setFailed] = useState(false);
    const onError = useCallback(() => setFailed(true), []);
    const onClick = useCallback(() => onOpen(item), [onOpen, item]);
    if (failed) return null;
    return (
        <button type="button" className={classes.answerThumb} onClick={onClick} title={item.title ? item.title + " · @" + item.author : "@" + item.author}>
            <img src={item.src} alt={item.title || ""} loading="lazy" decoding="async" draggable={false} onError={onError} />
        </button>
    );
}

function Sources({ classes, sources, excerpts }) {
    if (!sources.length) return null;
    return (
        <ol className={classes.answerSources}>
            {sources.map((s) => (
                <li key={s.n + s.url}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer">
                        <span className={classes.answerSourceN}>{s.n}</span>
                        {s.heading ? s.title + " › " + s.heading : s.title || s.url}
                    </a>
                    {excerpts && s.excerpt ? <span className={classes.answerExcerpt}>{s.excerpt}</span> : null}
                </li>
            ))}
        </ol>
    );
}

export const AnswerCard = React.memo(
    ({ classes, answer, onGoToUsername, onOpenArtwork }) => {
        useLanguage();
        const data = answer && !answer.loading ? answer.data : null;
        const thumbs = useMemo(() => (data && data.route === "ask" ? data.items.slice(0, 6) : []), [data]);
        if (!answer) return null;

        if (answer.loading) {
            const head = answer.route === "help"
                ? tr(t, "components.search_results.reading_the_documentation", "Reading the documentation…")
                : tr(t, "components.search_results.looking_for_the_answer", "Looking for the answer…");
            return (
                <div className={classes.answerCard + " " + classes.answerPending} aria-busy="true" aria-live="polite">
                    <CircularProgress size={14} style={{ color: "#777" }} />
                    <span>{head}</span>
                </div>
            );
        }
        if (!data) return null;

        if (data.route === "ask") {
            return (
                <div className={classes.answerCard + (data.empty ? " " + classes.answerEmpty : "")} role="region" aria-live="polite" aria-label={tr(t, "components.search_results.answer", "Answer")}>
                    <div className={classes.answerHead}>
                        <QuestionAnswerOutlined />
                        <span>{tr(t, "components.search_results.answer", "Answer")}</span>
                    </div>
                    <p className={classes.answerText}>{withMentions(data.text, onGoToUsername, classes.answerMention)}</p>
                    {thumbs.length ? (
                        <div className={classes.answerThumbs}>
                            {thumbs.map((item) => <AnswerThumb key={item.id} classes={classes} item={item} onOpen={onOpenArtwork} />)}
                        </div>
                    ) : null}
                </div>
            );
        }

        if (data.route === "help") {
            const answered = data.status === "answered";
            return (
                <div className={classes.answerCard + (answered ? "" : " " + classes.answerEmpty)} role="region" aria-live="polite" aria-label={tr(t, "components.search_results.from_the_documentation", "From the documentation")}>
                    <div className={classes.answerHead}>
                        <LibraryBooksOutlined />
                        <span>{tr(t, "components.search_results.from_the_documentation", "From the documentation")}</span>
                    </div>
                    {data.text ? <p className={classes.answerText}>{withCitations(data.text, data.sources, classes)}</p> : null}
                    <Sources classes={classes} sources={data.sources} excerpts={data.status === "excerpts"} />
                </div>
            );
        }

        // No question, but the words are the platform's: the documentation pages that match.
        return (
            <div className={classes.answerCard} role="region" aria-label={tr(t, "components.search_results.in_the_documentation", "In the documentation")}>
                <div className={classes.answerHead}>
                    <LibraryBooksOutlined />
                    <span>{tr(t, "components.search_results.in_the_documentation", "In the documentation")}</span>
                </div>
                <Sources classes={classes} sources={data.links} excerpts={false} />
            </div>
        );
    },
    (prev, next) =>
        prev.answer === next.answer &&
        prev.onGoToUsername === next.onGoToUsername &&
        prev.onOpenArtwork === next.onOpenArtwork &&
        prev.classes === next.classes,
);
