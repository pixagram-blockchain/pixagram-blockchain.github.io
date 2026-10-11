"use strict";
import React, { useCallback, useEffect, useMemo, useState } from "preact/compat";
import CircularProgress from "@material-ui/core/CircularProgress";
import QuestionAnswerOutlined from "@material-ui/icons/QuestionAnswerOutlined";
import LibraryBooksOutlined from "@material-ui/icons/LibraryBooksOutlined";
import ThumbUpOutlined from "@material-ui/icons/ThumbUpOutlined";
import ThumbDownOutlined from "@material-ui/icons/ThumbDownOutlined";
import SubdirectoryArrowRight from "@material-ui/icons/SubdirectoryArrowRight";
import SearchIcon from "@material-ui/icons/Search";

import { t, useLanguage } from "../../utils/text";

import { BODY_FOLD_CHARS, FOLLOW_UPS_SHOWN, SEARCHES_SHOWN } from "./config";
import { tr } from "./highlight";
import { citationNumbers, renderBlocks, renderInline, withMentions } from "./AnswerMarkdown";
import { answerVote, modelLabel } from "./searchApi";

// ── AnswerCard ────────────────────────────────────────────────────────────────
// The answer to the question typed, above the results (useSearch.answer):
//
//   about the artworks (/ask)        the index's answer first ("@author" mentions as
//                                    links to the profile). v4.8, under it: the
//                                    model's body — several paragraphs, every
//                                    sentence verified by the Worker, its citations
//                                    as numbered links to the posts — marked with
//                                    the model's name; "From the index" (the facts
//                                    and the overview the Worker computed, folded);
//                                    "How this was worked out" (the reasoning
//                                    trail, folded); "Keep in mind" (the caveats);
//                                    the artworks behind it as thumbnails; the
//                                    follow-up questions and related searches as
//                                    chips that go back into the box; a vote.
//                                    While the model's part is on its way, a line
//                                    says so (the index's answer and its digest
//                                    show meanwhile); when it could not come, why,
//                                    and a way to ask again.
//   about the platform (/help)       the documentation's answer (v4.8: at length,
//                                    steps as a list), its [n] citations as links
//                                    to the sections, the sections (with their
//                                    excerpts when the model could not write an
//                                    answer), "See also" (the other sections of
//                                    those pages), follow-up questions as chips
//   documentation pages that match   when the Worker saw no question but the
//                                    words are the platform's own
//
// Everything is text from the Worker rendered as text nodes (never HTML;
// AnswerMarkdown reads the light Markdown); links are the https ones searchApi
// let through, opened in a new tab.

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

/** The model that wrote a text: a small label ("GLM-5.3 Flash"). */
function ModelBadge({ classes, model }) {
    const label = modelLabel(model);
    if (!label) return null;
    return (
        <span className={classes.answerModel} title={tr(t, "components.search_results.checked_against_the_index", "Every claim checked against the index")}>
            {label}
        </span>
    );
}

/** A folded part of the answer ("From the index", "How this was worked out"): a <details> with the Worker's own title. */
function Folded({ classes, title, open, children }) {
    return (
        <details className={classes.answerFold} open={open || undefined}>
            <summary className={classes.answerFoldTitle}>{title}</summary>
            {children}
        </details>
    );
}

/**
 * v4.8: the model's body under the index's answer — folded past BODY_FOLD_CHARS with "Read more"
 * (the dropdown is a small window); the citations of posts the answer holds open them.
 */
function Body({ classes, body, ctx, model }) {
    useLanguage();
    const [expanded, setExpanded] = useState(false);
    const long = body.length > BODY_FOLD_CHARS;
    const blocks = useMemo(() => renderBlocks(body, ctx), [body, ctx]);
    const toggle = useCallback(() => setExpanded((x) => !x), []);
    return (
        <div className={classes.answerBody}>
            <ModelBadge classes={classes} model={model} />
            <div className={classes.answerBodyText + (long && !expanded ? " " + classes.answerBodyFolded : "")}>{blocks}</div>
            {long ? (
                <button type="button" className={classes.answerMore} onClick={toggle} aria-expanded={expanded}>
                    {expanded ? tr(t, "components.search_results.show_less", "Show less") : tr(t, "components.search_results.read_more", "Read more")}
                </button>
            ) : null}
        </div>
    );
}

/**
 * v4.8: where the model's part stands — on its way (the index's answer shows meanwhile); could
 * not come (and a way to ask again); the model had nothing verified to add. Nothing once it is in.
 */
function Elaboration({ classes, data, elaborating, onRetry }) {
    if (elaborating) {
        return (
            <div className={classes.answerExplaining} aria-busy="true" aria-live="polite">
                <CircularProgress size={12} style={{ color: "#777" }} />
                <span>{tr(t, "components.search_results.writing_the_full_answer", "Writing the full answer…")}</span>
            </div>
        );
    }
    if (data.elaborationOutcome === "unavailable") {
        return (
            <p className={classes.answerNote}>
                {tr(t, "components.search_results.the_full_answer_could_not_be_written", "The full answer could not be written just now.")}{" "}
                {onRetry ? (
                    <button type="button" className={classes.answerRetry} onClick={onRetry}>
                        {tr(t, "components.search_results.try_again", "Try again")}
                    </button>
                ) : null}
            </p>
        );
    }
    if (data.elaborationOutcome === "none" && !(data.rich && data.rich.body)) {
        // the Worker gave the model's part up (three failures, or a reply it could not use)
        return <p className={classes.answerNote}>{tr(t, "components.search_results.no_full_answer_for_this_question", "No full answer for this question.")}</p>;
    }
    return null;
}

/**
 * v4.8: the answer's follow-up questions and related searches, as chips: a click puts the text in
 * the box and sends it where its route says (controls.pickSuggestion), like a suggestion row.
 */
function Chips({ classes, followUps, searches, onPick }) {
    useLanguage();
    if (!onPick || (!followUps.length && !searches.length)) return null;
    const chip = (s, Icon, label) => (
        <button key={s.route + "\u0000" + s.text} type="button" className={classes.answerChip} onClick={() => onPick(s)} title={label}>
            <Icon />
            <span>{s.text}</span>
        </button>
    );
    const ask = tr(t, "components.search_results.you_may_also_ask", "You may also ask");
    const related = tr(t, "components.search_results.related_searches", "Related searches");
    return (
        <div className={classes.answerChips} aria-label={ask}>
            {followUps.map((s) => chip(s, SubdirectoryArrowRight, ask))}
            {searches.map((s) => chip(s, SearchIcon, related))}
        </div>
    );
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

/** v4.8: the other sections of the pages a help answer cites. */
function Related({ classes, related }) {
    useLanguage();
    if (!related.length) return null;
    return (
        <div className={classes.answerRelated}>
            <span className={classes.answerRelatedTitle}>{tr(t, "components.search_results.see_also", "See also")}</span>
            {related.map((r) => (
                <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer" className={classes.answerRelatedLink}>
                    {r.heading ? (r.title ? r.title + " › " + r.heading : r.heading) : r.title}
                </a>
            ))}
        </div>
    );
}

/** The /ask answer: the index's answer, the model's part, the digest, the posts, the chips, the vote. */
function AskAnswer({ classes, answer, data, controls, onGoToUsername, onOpenArtwork }) {
    useLanguage();
    const rich = data.rich;
    const onRetry = controls && controls.elaborateAgain ? controls.elaborateAgain : null;
    const onRate = controls && controls.rateAnswer ? controls.rateAnswer : null;
    const onPick = controls && controls.pickSuggestion ? controls.pickSuggestion : null;
    const thumbs = useMemo(() => data.items.slice(0, 6), [data.items]);
    // the citations of the body (and the trail) number the posts they open, once per answer
    const cites = useMemo(
        () => citationNumbers([rich ? rich.body : "", ...(rich ? rich.thinking.map((s) => s.text) : [])], data.cards),
        [rich, data.cards],
    );
    const onOpenCard = useCallback((card) => onOpenArtwork(card), [onOpenArtwork]);
    const ctx = useMemo(() => ({ classes, onGoToUsername, cards: data.cards, cites, onOpenCard }), [classes, onGoToUsername, data.cards, cites, onOpenCard]);

    // nothing found or nothing to answer from: dimmed; a question asked back is read as it is
    const dim = data.empty && !data.clarify;
    const body = rich && rich.body ? rich.body : "";
    // v4's one explanation sentence: with a body it opens the direct answer; alone, it stands as before
    const direct = data.text + (data.explanation && !data.byModel && body ? " " + data.explanation : "");
    const followUps = rich ? rich.followUps.slice(0, FOLLOW_UPS_SHOWN) : [];
    const searches = rich ? rich.searches.slice(0, SEARCHES_SHOWN) : [];
    const hasIndex = !!rich && (rich.overview.length > 0 || rich.facts.length > 0);
    return (
        <div className={classes.answerCard + (dim ? " " + classes.answerEmpty : "")} role="region" aria-live="polite" aria-label={tr(t, "components.search_results.answer", "Answer")}>
            <div className={classes.answerHead}>
                <QuestionAnswerOutlined />
                <span>{tr(t, "components.search_results.answer", "Answer")}</span>
                {data.byModel ? <ModelBadge classes={classes} model={data.model} /> : null}
            </div>
            <p className={classes.answerText + " " + classes.answerLead}>{withMentions(direct, onGoToUsername, classes.answerMention)}</p>
            {body ? (
                <Body classes={classes} body={body} ctx={ctx} model={data.model} />
            ) : data.explanation && !data.byModel ? (
                <div className={classes.answerExplanation}>
                    <ModelBadge classes={classes} model={data.model} />
                    <p className={classes.answerText}>{withMentions(data.explanation, onGoToUsername, classes.answerMention)}</p>
                </div>
            ) : null}
            <Elaboration classes={classes} data={data} elaborating={!!answer.elaborating} onRetry={onRetry} />
            {hasIndex ? (
                <Folded classes={classes} title={tr(t, "components.search_results.from_the_index", "From the index")}>
                    {rich.overview.length ? <p className={classes.answerText}>{rich.overview.map((line, i) => <React.Fragment key={i}>{i ? " " : null}{renderInline(line, ctx)}</React.Fragment>)}</p> : null}
                    {rich.facts.length ? <ul className={classes.answerList}>{rich.facts.map((f, i) => <li key={i}>{renderInline(f, ctx)}</li>)}</ul> : null}
                </Folded>
            ) : null}
            {rich && rich.thinking.length ? (
                <Folded classes={classes} title={tr(t, "components.search_results.how_this_was_worked_out", "How this was worked out")}>
                    <ol className={classes.answerList + " " + classes.answerTrail}>
                        {rich.thinking.map((s) => (
                            <li key={s.n} className={s.status === "qualified" ? classes.answerQualified : undefined}>{renderInline(s.text, ctx)}</li>
                        ))}
                    </ol>
                </Folded>
            ) : null}
            {rich && rich.caveats.length ? (
                <div className={classes.answerCaveats}>
                    <span className={classes.answerFoldTitle}>{tr(t, "components.search_results.keep_in_mind", "Keep in mind")}</span>
                    <ul className={classes.answerList}>{rich.caveats.map((c, i) => <li key={i}>{renderInline(c, ctx)}</li>)}</ul>
                </div>
            ) : null}
            {thumbs.length ? (
                <div className={classes.answerThumbs}>
                    {thumbs.map((item) => <AnswerThumb key={item.id} classes={classes} item={item} onOpen={onOpenArtwork} />)}
                </div>
            ) : null}
            <Chips classes={classes} followUps={followUps} searches={searches} onPick={onPick} />
            {data.queryId && onRate && !answer.elaborating ? <Vote classes={classes} queryId={data.queryId} onRate={onRate} /> : null}
        </div>
    );
}

/** The /help answer: the documentation's text with its citations, the sections, see also, follow-ups. */
function HelpAnswer({ classes, data, controls, onGoToUsername }) {
    useLanguage();
    const answered = data.status === "answered";
    const onPick = controls && controls.pickSuggestion ? controls.pickSuggestion : null;
    const ctx = useMemo(() => ({ classes, onGoToUsername, sources: data.sources }), [classes, onGoToUsername, data.sources]);
    const blocks = useMemo(() => (data.text ? renderBlocks(data.text, ctx) : null), [data.text, ctx]);
    return (
        <div className={classes.answerCard + (answered ? "" : " " + classes.answerEmpty)} role="region" aria-live="polite" aria-label={tr(t, "components.search_results.from_the_documentation", "From the documentation")}>
            <div className={classes.answerHead}>
                <LibraryBooksOutlined />
                <span>{tr(t, "components.search_results.from_the_documentation", "From the documentation")}</span>
            </div>
            {blocks ? <div className={classes.answerBodyText}>{blocks}</div> : null}
            <Sources classes={classes} sources={data.sources} excerpts={data.status === "excerpts"} />
            <Related classes={classes} related={data.related || []} />
            <Chips classes={classes} followUps={(data.followUps || []).slice(0, FOLLOW_UPS_SHOWN)} searches={[]} onPick={onPick} />
        </div>
    );
}

export const AnswerCard = React.memo(
    ({ classes, answer, controls, onGoToUsername, onOpenArtwork }) => {
        useLanguage();
        const data = answer && !answer.loading ? answer.data : null;
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
        if (data.route === "ask") return <AskAnswer classes={classes} answer={answer} data={data} controls={controls} onGoToUsername={onGoToUsername} onOpenArtwork={onOpenArtwork} />;
        if (data.route === "help") return <HelpAnswer classes={classes} data={data} controls={controls} onGoToUsername={onGoToUsername} />;

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
