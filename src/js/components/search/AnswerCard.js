"use strict";
import React, { useCallback, useEffect, useMemo, useState } from "preact/compat";
import CircularProgress from "@material-ui/core/CircularProgress";
import QuestionAnswerOutlined from "@material-ui/icons/QuestionAnswerOutlined";
import LibraryBooksOutlined from "@material-ui/icons/LibraryBooksOutlined";
import ThumbUpOutlined from "@material-ui/icons/ThumbUpOutlined";
import ThumbDownOutlined from "@material-ui/icons/ThumbDownOutlined";

import { t, useLanguage } from "../../utils/text";

import { tr } from "./highlight";
import { answerVote, modelLabel } from "./searchApi";

// ── AnswerCard ────────────────────────────────────────────────────────────────
// The answer to the question typed, above the results (useSearch.answer):
//
//   about the artworks (/ask)        the sentence, "@author" mentions as links to
//                                    the profile, then the artworks behind it as
//                                    thumbnails that open them. v4: the index's
//                                    answer first; under it GPT-OSS's explanation
//                                    of it, marked with the model's name, once it
//                                    has come (a line says it is on its way, or
//                                    why there is none); a vote on the answer
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

/** The model that wrote a text: a small label ("GPT-OSS 120B"). */
function ModelBadge({ classes, model }) {
    const label = modelLabel(model);
    if (!label) return null;
    return (
        <span className={classes.answerModel} title={tr(t, "components.search_results.checked_against_the_index", "Every claim checked against the index")}>
            {label}
        </span>
    );
}

/**
 * v4: GPT-OSS's part under the index's answer — its explanation once it has come; while it comes,
 * a line that says so; afterwards, when there is none, why (and, when the model could not answer,
 * a way to ask again).
 */
function Explanation({ classes, data, explaining, onGoToUsername, onRetry }) {
    if (explaining) {
        return (
            <div className={classes.answerExplaining} aria-busy="true" aria-live="polite">
                <CircularProgress size={12} style={{ color: "#777" }} />
                <span>{tr(t, "components.search_results.gpt_oss_is_explaining", "GPT-OSS is explaining…")}</span>
            </div>
        );
    }
    if (data.explanation && !data.byModel) {
        return (
            <div className={classes.answerExplanation}>
                <ModelBadge classes={classes} model={data.model} />
                <p className={classes.answerText}>{withMentions(data.explanation, onGoToUsername, classes.answerMention)}</p>
            </div>
        );
    }
    if (data.explainOutcome === "none") {
        return <p className={classes.answerNote}>{tr(t, "components.search_results.gpt_oss_had_nothing_verified_to_add", "GPT-OSS had nothing verified to add.")}</p>;
    }
    if (data.explainOutcome === "unavailable") {
        return (
            <p className={classes.answerNote}>
                {tr(t, "components.search_results.gpt_oss_could_not_answer", "GPT-OSS could not answer just now.")}{" "}
                {onRetry ? (
                    <button type="button" className={classes.answerRetry} onClick={onRetry}>
                        {tr(t, "components.search_results.try_again", "Try again")}
                    </button>
                ) : null}
            </p>
        );
    }
    return null;
}

/** v4: was the answer helpful? One vote per answer (its query_id), sent to the Worker. */
function Vote({ classes, queryId, onRate }) {
    const [vote, setVote] = useState(() => answerVote(queryId));
    useEffect(() => setVote(answerVote(queryId)), [queryId]);
    const up = useCallback(() => { onRate(queryId, 1); setVote(1); }, [onRate, queryId]);
    const down = useCallback(() => { onRate(queryId, -1); setVote(-1); }, [onRate, queryId]);
    if (vote) {
        return <div className={classes.answerVote}><span>{tr(t, "components.search_results.thanks_for_your_feedback", "Thanks for your feedback")}</span></div>;
    }
    return (
        <div className={classes.answerVote}>
            <button type="button" className={classes.answerVoteButton} onClick={up} aria-label={tr(t, "components.search_results.helpful", "Helpful")} title={tr(t, "components.search_results.helpful", "Helpful")}>
                <ThumbUpOutlined />
            </button>
            <button type="button" className={classes.answerVoteButton} onClick={down} aria-label={tr(t, "components.search_results.not_helpful", "Not helpful")} title={tr(t, "components.search_results.not_helpful", "Not helpful")}>
                <ThumbDownOutlined />
            </button>
        </div>
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
    ({ classes, answer, controls, onGoToUsername, onOpenArtwork }) => {
        useLanguage();
        const data = answer && !answer.loading ? answer.data : null;
        const thumbs = useMemo(() => (data && data.route === "ask" ? data.items.slice(0, 6) : []), [data]);
        const onRetry = controls && controls.explainAgain ? controls.explainAgain : null;
        const onRate = controls && controls.rateAnswer ? controls.rateAnswer : null;
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
            // nothing found or nothing to answer from: dimmed; a question asked back is read as it is
            const dim = data.empty && !data.clarify;
            return (
                <div className={classes.answerCard + (dim ? " " + classes.answerEmpty : "")} role="region" aria-live="polite" aria-label={tr(t, "components.search_results.answer", "Answer")}>
                    <div className={classes.answerHead}>
                        <QuestionAnswerOutlined />
                        <span>{tr(t, "components.search_results.answer", "Answer")}</span>
                        {data.byModel ? <ModelBadge classes={classes} model={data.model} /> : null}
                    </div>
                    <p className={classes.answerText}>{withMentions(data.text, onGoToUsername, classes.answerMention)}</p>
                    <Explanation classes={classes} data={data} explaining={!!answer.explaining} onGoToUsername={onGoToUsername} onRetry={onRetry} />
                    {thumbs.length ? (
                        <div className={classes.answerThumbs}>
                            {thumbs.map((item) => <AnswerThumb key={item.id} classes={classes} item={item} onOpen={onOpenArtwork} />)}
                        </div>
                    ) : null}
                    {data.queryId && onRate && !answer.explaining ? <Vote classes={classes} queryId={data.queryId} onRate={onRate} /> : null}
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
        prev.controls === next.controls &&
        prev.onGoToUsername === next.onGoToUsername &&
        prev.onOpenArtwork === next.onOpenArtwork &&
        prev.classes === next.classes,
);
