"use strict";
import React, { useCallback, useMemo, useState } from "preact/compat";
import SearchIcon from "@material-ui/icons/Search";
import QuestionAnswerOutlined from "@material-ui/icons/QuestionAnswerOutlined";
import LibraryBooksOutlined from "@material-ui/icons/LibraryBooksOutlined";
import ImageOutlined from "@material-ui/icons/ImageOutlined";
import TrendingUp from "@material-ui/icons/TrendingUp";
import Spellcheck from "@material-ui/icons/Spellcheck";
import CallMade from "@material-ui/icons/CallMade";
import OpenInNew from "@material-ui/icons/OpenInNew";

import { t, useLanguage } from "../../utils/text";

import { tr } from "./highlight";
import { fold, splitSuggestion } from "./intent";

// ── SuggestionList ────────────────────────────────────────────────────────────
// What the v3 Worker proposes for the text typed, at the top of the dropdown:
// one row per suggestion, its kind as an icon (a search, a question it answers,
// a documentation section, a post's title with its thumbnail, a popular search,
// a spelling correction). The part already typed is dimmed, the rest is bright,
// so the row reads as "what you would get".
//
//   click / Enter on the highlighted row   pick it (SearchBar decides: a title
//                                          opens its post, the rest is searched,
//                                          a question also gets its answer)
//   ↓ ↑ in the input                        move the highlight (the mouse only
//                                          hovers: Enter never picks a row the
//                                          pointer happens to rest on)
//   ↖ on a row, → on the highlighted one    put its text in the box to go on typing
//   ↗ on a documentation row, Ctrl/⌘ + Enter on the highlighted one
//                                          open the page on GitHub
//
// The rows are options of a listbox the input controls (aria-activedescendant),
// and they never take the focus: the input keeps it while the mouse picks. The
// ↖ and ↗ buttons are the mouse's way to what the keys above do: kept out of the
// accessibility tree (an option holds no controls) and out of the tab order.

export const LISTBOX_ID = "pixagram-search-suggestions";
export const optionId = (i) => `${LISTBOX_ID}-${i}`;

const ICONS = {
    complete: SearchIcon,
    question: QuestionAnswerOutlined,
    help: LibraryBooksOutlined,
    title: ImageOutlined,
    popular: TrendingUp,
    correction: Spellcheck,
};

const keepFocus = (e) => e.preventDefault();

/** Rows whose text can go into the box to go on typing: not a title (it opens its post), not a section (it asks the documentation). */
export const fillable = (s) => s.kind !== "title" && s.kind !== "help";
const stop = (e) => e.stopPropagation();
const FILL_ICON_STYLE = { transform: "rotate(-90deg)" };

/**
 * Where the words typed (two letters or more) occur in `text`, folded (case and accents aside):
 * [start, end) ranges, merged. Folding keeps the length for the scripts that matter here.
 */
function typedRanges(text, query) {
    const hay = fold(text);
    if (hay.length !== text.length) return [];
    const ranges = [];
    for (const w of fold(query).split(/\s+/)) {
        if (w.length < 2) continue;
        for (let at = hay.indexOf(w); at !== -1; at = hay.indexOf(w, at + w.length)) ranges.push([at, at + w.length]);
    }
    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const r of ranges) {
        const last = merged[merged.length - 1];
        if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
        else merged.push(r.slice());
    }
    return merged;
}

/**
 * The text as "what you typed, dimmed" and "what the box adds, bright": a row that extends the
 * text typed has the typed part first; in any other row, the words typed are dimmed where they
 * occur.
 */
function SuggestionText({ classes, text, query }) {
    const parts = splitSuggestion(text, query);
    if (parts) {
        return (
            <React.Fragment>
                <span className={classes.sugTyped}>{parts.typed}</span>
                <span className={classes.sugRest}>{parts.rest}</span>
            </React.Fragment>
        );
    }
    const ranges = typedRanges(text, query);
    if (!ranges.length) return <span className={classes.sugPlain}>{text}</span>;
    const out = [];
    let at = 0;
    for (const [a, b] of ranges) {
        if (a > at) out.push(<span key={"p" + at} className={classes.sugPlain}>{text.slice(at, a)}</span>);
        out.push(<span key={"t" + a} className={classes.sugTyped}>{text.slice(a, b)}</span>);
        at = b;
    }
    if (at < text.length) out.push(<span key={"p" + at} className={classes.sugPlain}>{text.slice(at)}</span>);
    return out;
}

/** A post's thumbnail (the native image, scaled down); its kind's icon when it fails. */
function Thumb({ classes, src, fallback: Fallback }) {
    const [failed, setFailed] = useState(false);
    const onError = useCallback(() => setFailed(true), []);
    if (!src || failed) return <Fallback />;
    return <img className={classes.sugThumb} src={src} alt="" loading="lazy" decoding="async" draggable={false} onError={onError} />;
}

const SuggestionRow = React.memo(
    ({ classes, s, i, query, active, labels, onPick, onFill }) => {
        const Icon = ICONS[s.kind] || SearchIcon;
        const onClick = useCallback(() => onPick(s), [onPick, s]);
        const onFillClick = useCallback((e) => {
            e.stopPropagation();
            onFill(s);
        }, [onFill, s]);
        const canFill = fillable(s);
        const badge = s.route === "ask" ? labels.answer : s.route === "help" ? labels.docs : null;
        return (
            <li
                id={optionId(i)}
                role="option"
                aria-selected={active}
                className={classes.sugRow + (active ? " on" : "")}
                onMouseDown={keepFocus}
                onClick={onClick}
                title={s.kind === "help" && s.source ? s.source.url : undefined}
            >
                <span className={classes.sugIcon}>
                    {s.kind === "title" && s.post ? <Thumb classes={classes} src={s.post.image} fallback={Icon} /> : <Icon />}
                </span>
                <span className={classes.sugMain}>
                    <SuggestionText classes={classes} text={s.text} query={query} />
                </span>
                {badge ? <span className={classes.sugBadge}>{badge}</span> : null}
                {s.kind === "help" && s.source ? (
                    <a
                        className={classes.sugAction}
                        href={s.source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onMouseDown={keepFocus}
                        onClick={stop}
                        tabIndex={-1}
                        title={labels.openPage}
                        aria-hidden="true"
                    >
                        <OpenInNew />
                    </a>
                ) : null}
                {canFill ? (
                    <button
                        type="button"
                        className={classes.sugAction}
                        onMouseDown={keepFocus}
                        onClick={onFillClick}
                        tabIndex={-1}
                        title={labels.fill}
                        aria-hidden="true"
                    >
                        <CallMade style={FILL_ICON_STYLE} />
                    </button>
                ) : null}
            </li>
        );
    },
    (prev, next) =>
        prev.s === next.s &&
        prev.i === next.i &&
        prev.query === next.query &&
        prev.active === next.active &&
        prev.labels === next.labels &&
        prev.onPick === next.onPick &&
        prev.onFill === next.onFill &&
        prev.classes === next.classes,
);

export const SuggestionList = React.memo(
    ({ classes, items, query, highlight, onPick, onFill }) => {
        useLanguage();
        const answer = tr(t, "components.search_results.answer", "Answer");
        const docs = tr(t, "components.search_results.docs", "Docs");
        const fill = tr(t, "components.search_results.edit_this_search", "Edit this search");
        const openPage = tr(t, "components.search_results.open_the_page", "Open the page");
        // One object per language: the rows compare it by identity.
        const labels = useMemo(() => ({ answer, docs, fill, openPage }), [answer, docs, fill, openPage]);
        if (!items.length) return null;
        return (
            <ul id={LISTBOX_ID} role="listbox" className={classes.sugList} aria-label={tr(t, "components.search_results.suggestions", "Suggestions")}>
                {items.map((s, i) => (
                    <SuggestionRow
                        key={s.kind + "\u0000" + s.text}
                        classes={classes}
                        s={s}
                        i={i}
                        query={query}
                        active={i === highlight}
                        labels={labels}
                        onPick={onPick}
                        onFill={onFill}
                    />
                ))}
            </ul>
        );
    },
    (prev, next) =>
        prev.items === next.items &&
        prev.query === next.query &&
        prev.highlight === next.highlight &&
        prev.onPick === next.onPick &&
        prev.onFill === next.onFill &&
        prev.classes === next.classes,
);
