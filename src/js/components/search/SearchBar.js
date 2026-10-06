"use strict";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import ClickAwayListener from "@material-ui/core/ClickAwayListener";
import IconButton from "@material-ui/core/IconButton";
import Badge from "@material-ui/core/Badge";
import CloseIcon from "@material-ui/icons/Close";
import ArrowBackRounded from "@material-ui/icons/ArrowBackRounded";
import TuneIcon from "@material-ui/icons/Tune";
import SearchIcon from "@material-ui/icons/Search";

import { t, useLanguage } from "../../utils/text";

import {
    DESKTOP_MIN_WIDTH, DROPDOWN_MAX_HEIGHT, DROPDOWN_MIN_HEIGHT, SEARCH_EXPAND_PX,
    EXAMPLE_FADE_MS, EXAMPLE_FIRST_MS, EXAMPLE_INTERVAL_MS,
} from "./config";
import { countFilters } from "./filters";
import { tr } from "./highlight";
import { ghostFor } from "./intent";
import { searchStyles } from "./styles";
import { SearchResults } from "./SearchResults";
import { LISTBOX_ID, fillable, optionId } from "./SuggestionList";

// ── SearchBar ─────────────────────────────────────────────────────────────────
// The toolbar's search box: input, filter button, close/back button,
// click-away, and the results dropdown anchored to the bar.
//
// The filter button's icon follows the search: a magnifier while it is closed
// (so the bar reads as a search box), the filter icon once it is open, with the
// number of active filters as a badge. The click is the same either way: it
// expands or collapses the filter panel, so from the closed bar it opens the
// search with the panel out.
//
// Sizing, all measured live (ResizeObserver on the bar + window resize):
//   width       the dropdown copies the bar's width, so it follows window
//               resizes and breakpoint changes
//   max height  from the bar's bottom edge to the viewport's bottom, within
//               DROPDOWN_MIN/MAX_HEIGHT — the dropdown grows on tall screens
//   widening    open on desktop (≥ DESKTOP_MIN_WIDTH), the bar widens by up to
//               SEARCH_EXPAND_PX when the viewport has room to its right; its
//               right margin shrinks by the same amount (see styles.js), so the
//               toolbar layout does not move
// Styles come from ./styles; the closed bar renders exactly where it did.
//
// v3, inside the input (overlays laid exactly over its text box, measured from
// the input itself, so the input keeps its own styles and place):
//   placeholder   the plain "Search" first, then the Worker's examples in the
//                 UI language ("cat", "who posted the first cat?", a title, a
//                 documentation question…), one after the other, each fading
//                 out and the next in. Only while the box is empty and the page
//                 visible; never with prefers-reduced-motion.
//   ghost text    the rest of the Worker's completion after the caret
//                 ("dra" + "gon"), while the caret is at the end and the text
//                 fits.
// Keys (Tab is never taken: it moves on, as everywhere):
//   ↓ ↑           move through the suggestions (the input keeps the focus)
//   Enter         pick the highlighted suggestion, else search now and answer
//                 a question now; Ctrl/⌘ + Enter on a documentation row opens
//                 its page
//   →             at the end of the text: the highlighted suggestion into the box
//                 to go on typing, else the ghost text; in an empty box, the
//                 example shown, as if typed
//   Esc           the highlight goes, then the suggestions, then the search

const GUTTER_DESKTOP = 24;
const GUTTER_MOBILE = 16;
const EMPTY_ITEMS = Object.freeze([]);

function sameMetrics(a, b) {
    return a.width === b.width && a.maxHeight === b.maxHeight && a.extra === b.extra;
}

// ── the input's text box, for the overlays ──

const FONT_PROPS = ["fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing", "wordSpacing", "lineHeight", "textTransform"];

function sameBox(a, b) {
    if (!a || !b) return a === b;
    if (a.left !== b.left || a.top !== b.top || a.width !== b.width || a.height !== b.height) return false;
    return FONT_PROPS.every((k) => a.font[k] === b.font[k]);
}

/**
 * Where the input's text sits inside the bar (its offsetParent): left/top/width/
 * height of the text box and the input's font, re-measured when the bar's size,
 * its open state or the fonts change. Null until measured.
 */
function useInputBox(input, deps) {
    const [box, setBox] = useState(null);
    const [fontsTick, setFontsTick] = useState(0);
    useEffect(() => {
        const fonts = typeof document !== "undefined" ? document.fonts : null;
        if (!fonts || !fonts.ready) return undefined;
        let live = true;
        fonts.ready.then(() => { if (live) setFontsTick((n) => n + 1); }).catch(() => {});
        return () => { live = false; };
    }, []);
    useLayoutEffect(() => {
        if (!input || typeof window === "undefined") return;
        const cs = window.getComputedStyle(input);
        const px = (v) => parseFloat(v) || 0;
        const padLeft = px(cs.paddingLeft);
        const padRight = px(cs.paddingRight);
        const font = {};
        for (const k of FONT_PROPS) font[k] = cs[k];
        const next = {
            left: input.offsetLeft + px(cs.borderLeftWidth) + padLeft,
            top: input.offsetTop + px(cs.borderTopWidth),
            width: Math.max(0, input.clientWidth - padLeft - padRight),
            height: input.clientHeight,
            font,
        };
        setBox((prev) => (sameBox(prev, next) ? prev : next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [input, fontsTick, ...deps]);
    return box;
}

// ── the placeholder's examples ──

function usePageVisible() {
    const [visible, setVisible] = useState(() => typeof document === "undefined" || document.visibilityState !== "hidden");
    useEffect(() => {
        if (typeof document === "undefined") return undefined;
        const on = () => setVisible(document.visibilityState !== "hidden");
        document.addEventListener("visibilitychange", on);
        return () => document.removeEventListener("visibilitychange", on);
    }, []);
    return visible;
}

function useReducedMotion() {
    const query = "(prefers-reduced-motion: reduce)";
    const [reduce, setReduce] = useState(() => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(query).matches);
    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return undefined;
        const mq = window.matchMedia(query);
        const on = () => setReduce(mq.matches);
        if (mq.addEventListener) mq.addEventListener("change", on);
        else if (mq.addListener) mq.addListener(on);
        return () => {
            if (mq.removeEventListener) mq.removeEventListener("change", on);
            else if (mq.removeListener) mq.removeListener(on);
        };
    }, []);
    return reduce;
}

/**
 * The example the placeholder shows: { index, shown } — index -1 is the plain
 * placeholder; `shown` false while it fades out. Runs while `running`, and
 * resumes after the last example shown when it runs again.
 */
function useExampleCycle(examples, running) {
    const [state, setState] = useState({ index: -1, shown: true });
    const lastRef = useRef(-1);
    useEffect(() => {
        const n = examples ? examples.length : 0;
        if (!running || !n) {
            setState((s) => (s.index === -1 && s.shown ? s : { index: -1, shown: true }));
            return undefined;
        }
        let timer = 0;
        const fadeOut = () => {
            setState((s) => (s.shown ? { index: s.index, shown: false } : s));
            timer = setTimeout(() => {
                const index = (lastRef.current + 1) % n;
                lastRef.current = index;
                setState({ index, shown: true });
                timer = setTimeout(fadeOut, EXAMPLE_INTERVAL_MS);
            }, EXAMPLE_FADE_MS);
        };
        timer = setTimeout(fadeOut, EXAMPLE_FIRST_MS);
        return () => clearTimeout(timer);
    }, [examples, running]);
    return state;
}

const coarsePointer = () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

function useBarMetrics(bar, wrapper, open) {
    const [metrics, setMetrics] = useState({ width: 0, maxHeight: 0, extra: 0 });
    // One observer per element for the bar's lifetime; `open` is read from a ref
    // and a change of it re-measures (before paint, so the widening starts in the
    // same frame the dropdown appears).
    const openRef = useRef(open);
    openRef.current = open;
    const measureRef = useRef(null);

    useEffect(() => {
        if (!bar) return undefined;
        let frame = 0;
        const measure = () => {
            if (frame) {
                cancelAnimationFrame(frame);
                frame = 0;
            }
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const desktop = vw >= DESKTOP_MIN_WIDTH;
            const r = bar.getBoundingClientRect();
            let extra = 0;
            if (openRef.current && desktop && wrapper) {
                // The wrapper keeps its closed size (margin trade-off), so its right
                // edge is a stable reference for the room left in the viewport.
                const room = vw - GUTTER_DESKTOP - wrapper.getBoundingClientRect().right;
                extra = Math.max(0, Math.min(SEARCH_EXPAND_PX, Math.floor(room)));
            }
            const gutter = desktop ? GUTTER_DESKTOP : GUTTER_MOBILE;
            const next = {
                width: Math.round(r.width),
                maxHeight: Math.max(DROPDOWN_MIN_HEIGHT, Math.min(DROPDOWN_MAX_HEIGHT, Math.floor(vh - r.bottom - gutter))),
                extra,
            };
            setMetrics((prev) => (sameMetrics(prev, next) ? prev : next));
        };
        const schedule = () => {
            if (!frame) frame = requestAnimationFrame(measure);
        };
        measureRef.current = measure;
        measure();
        // Measured straight from the observer callback (it runs after layout, before
        // paint), so the dropdown tracks the bar's widening in the same frame.
        const ro = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
        if (ro) ro.observe(bar);
        window.addEventListener("resize", schedule);
        return () => {
            measureRef.current = null;
            if (ro) ro.disconnect();
            window.removeEventListener("resize", schedule);
            if (frame) cancelAnimationFrame(frame);
        };
    }, [bar, wrapper]);

    useLayoutEffect(() => {
        if (measureRef.current) measureRef.current();
    }, [open]);

    return metrics;
}

const SearchBarInner = React.memo(
    ({
         classes, open, value, placeholder, onChange, onReset, onGoHome,
         results, history, controls,
         onGoToUsername, onGoToTag, onGoToCommunity, onGoToArtwork, onGoToPost, onSetTagNavigation,
     }) => {
        useLanguage();
        const [anchorEl, setAnchorEl] = useState(null);
        const [wrapperEl, setWrapperEl] = useState(null);
        const [inputEl, setInputEl] = useState(null);
        const setRef = useCallback((el) => { if (el) setAnchorEl(el); }, []);
        const setWrapperRef = useCallback((el) => { if (el) setWrapperEl(el); }, []);
        const setInputRef = useCallback((el) => { if (el) setInputEl(el); }, []);
        const { width, maxHeight, extra } = useBarMetrics(anchorEl, wrapperEl, open);
        const openRef = useRef(open);
        openRef.current = open;

        // ── v3: suggestions, ghost text, examples ──
        const suggest = results ? results.suggest : null;
        const examples = results ? results.examples : null;
        const box = useInputBox(inputEl, [width, open]);

        // The suggestion rows shown: not the text itself.
        const typed = String(value || "").trim().toLowerCase();
        const items = useMemo(
            () => (suggest && typed ? suggest.items.filter((s) => s.text.trim().toLowerCase() !== typed) : EMPTY_ITEMS),
            [suggest, typed],
        );
        // The highlighted row belongs to the rows it was picked among: new rows, none highlighted.
        const itemsRef = useRef(items);
        itemsRef.current = items;
        const [hl, setHl] = useState({ items: null, i: -1 });
        const highlight = hl.items === items ? hl.i : -1;
        const setHighlight = useCallback((i) => setHl({ items: itemsRef.current, i }), []);
        // Esc closes the list for the text it was closed on: suggestions still on their way for it
        // stay away; the next keystroke, or ↓, brings the list back.
        const [dismissedFor, setDismissedFor] = useState(null);
        const dismissed = dismissedFor !== null && dismissedFor === value;
        const listShown = open && items.length > 0 && !dismissed;
        // any other text (a keystroke, a closed search) forgets it: the same words later show again
        useEffect(() => {
            if (dismissedFor !== null && dismissedFor !== value) setDismissedFor(null);
        }, [value, dismissedFor]);
        useEffect(() => {
            if (highlight < 0 || typeof document === "undefined") return;
            const el = document.getElementById(optionId(highlight));
            if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "nearest" });
        }, [highlight]);

        // Ghost text: only with the caret at the end of a text that fits the box.
        const [focused, setFocused] = useState(false);
        const [caretTick, setCaretTick] = useState(0);
        const [fits, setFits] = useState(true);
        const onCaret = useCallback(() => setCaretTick((n) => n + 1), []);
        useLayoutEffect(() => {
            if (inputEl) setFits(inputEl.scrollWidth <= inputEl.clientWidth + 1);
        }, [inputEl, value, box]);
        const caretAtEnd = !!inputEl && inputEl.selectionStart === String(value || "").length && inputEl.selectionEnd === inputEl.selectionStart;
        const ghost = focused && fits && caretAtEnd && highlight < 0 && !dismissed ? ghostFor(value, suggest && suggest.completion) : "";
        void caretTick; // re-read the caret after a click or an arrow key

        const pageVisible = usePageVisible();
        const reduceMotion = useReducedMotion();
        const hasExamples = !!examples && examples.length > 0;
        const cycle = useExampleCycle(examples, hasExamples && !value && pageVisible && !reduceMotion);
        const example = hasExamples && cycle.index >= 0 ? examples[cycle.index] : null;
        // The animated placeholder replaces the input's own while there are examples to show.
        const overlayPlaceholder = hasExamples && !value && !reduceMotion;

        const pick = useCallback((s) => {
            if (!s) return;
            setHighlight(-1);
            if (s.kind === "title" && s.post && onGoToArtwork) onGoToArtwork(s.post);
            else if (controls && controls.pickSuggestion) controls.pickSuggestion(s);
        }, [controls, onGoToArtwork]);
        const fill = useCallback((s) => {
            if (!s || !controls || !controls.applyText) return;
            setHighlight(-1);
            // Into the box as typed, a space after a finished word, the caret at the end.
            const text = s.kind === "complete" || s.kind === "correction" || s.kind === "popular" ? s.text + " " : s.text;
            controls.applyText(text, "type");
            if (inputEl) inputEl.focus();
        }, [controls, inputEl]);

        const highlightRef = useRef(highlight);
        highlightRef.current = highlight;
        const ghostRef = useRef(ghost);
        ghostRef.current = ghost;
        const exampleRef = useRef(example);
        exampleRef.current = example;
        const valueRef = useRef(value);
        valueRef.current = value;
        const listShownRef = useRef(listShown);
        listShownRef.current = listShown;
        const dismissedRef = useRef(dismissed);
        dismissedRef.current = dismissed;

        const onKeyDown = useCallback((e) => {
            if (e.isComposing || e.keyCode === 229) return; // an IME is composing
            const list = itemsRef.current;
            const n = listShownRef.current ? list.length : 0;
            const h = highlightRef.current;
            switch (e.key) {
                case "ArrowDown":
                    if (n) {
                        e.preventDefault();
                        setHighlight(h + 1 >= n ? -1 : h + 1);
                    } else if (dismissedRef.current && list.length && openRef.current) {
                        // the list closed with Esc comes back, its first row highlighted
                        e.preventDefault();
                        setDismissedFor(null);
                        setHighlight(0);
                    }
                    break;
                case "ArrowUp":
                    if (n) {
                        e.preventDefault();
                        setHighlight(h <= -1 ? n - 1 : h - 1);
                    }
                    break;
                case "Enter": {
                    if (!controls) break;
                    e.preventDefault();
                    const s = h >= 0 && h < n ? list[h] : null;
                    if (s && (e.ctrlKey || e.metaKey) && s.source && s.source.url) {
                        // the documentation page itself, in a new tab
                        window.open(s.source.url, "_blank", "noopener,noreferrer");
                        break;
                    }
                    if (s) pick(s);
                    else if (controls.submit) controls.submit();
                    // On a phone, Enter means "show me": the keyboard goes, the results show.
                    if (coarsePointer() && e.currentTarget && typeof e.currentTarget.blur === "function") e.currentTarget.blur();
                    break;
                }
                case "ArrowRight": {
                    if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey || !controls) break;
                    const input = e.currentTarget;
                    if (!input || input.selectionStart !== input.value.length || input.selectionEnd !== input.value.length) break;
                    const s = h >= 0 && h < n ? list[h] : null;
                    if (s) {
                        // the highlighted suggestion into the box, to go on typing (the ↖ of its row;
                        // a title or a documentation section has none: nothing to go on with)
                        if (fillable(s)) {
                            e.preventDefault();
                            fill(s);
                        }
                    } else if (ghostRef.current && controls.acceptCompletion && controls.acceptCompletion()) {
                        e.preventDefault();
                    } else if (!input.value && exampleRef.current && controls.applyText) {
                        // the example the placeholder shows, as if typed
                        e.preventDefault();
                        controls.applyText(exampleRef.current.text, "type");
                    }
                    break;
                }
                case "Escape":
                    // one step at a time: the highlight, the list, then the search
                    if (h >= 0) {
                        e.preventDefault();
                        setHighlight(-1);
                    } else if (n) {
                        e.preventDefault();
                        setDismissedFor(valueRef.current);
                    } else if (openRef.current) {
                        e.preventDefault();
                        onReset();
                    }
                    break;
                default:
                    break;
            }
        }, [controls, pick, fill, onReset, setHighlight]);
        const onFocus = useCallback(() => setFocused(true), []);
        const onBlur = useCallback(() => setFocused(false), []);

        // The dropdown may be open on the panel or filters alone (empty input):
        // the button then closes the search rather than navigating back (openRef).
        const onButton = useCallback(() => (openRef.current ? onReset() : onGoHome()), [onReset, onGoHome]);
        const onFilters = useCallback(() => { if (controls) controls.toggleFilters(); }, [controls]);
        // The date range picker's calendar is a dialog rendered in a portal, outside
        // this element; under Preact its clicks do not bubble through the component
        // tree, so ClickAwayListener would see them as "away" and reset the search.
        const onClickAway = useCallback((e) => {
            const target = e && e.target;
            if (target && typeof target.closest === "function" && target.closest(".MuiDialog-root")) return;
            onReset();
        }, [onReset]);

        const filterCount = countFilters(results && results.filters);
        const filtersOpen = !!(results && results.filtersOpen);
        const filtersLabel = tr(t, "components.search_bar.filters", "Filters");
        // Closed, the button is named like the magnifier it shows (the placeholder's
        // "Search"). There is no count to show then: an active filter keeps the
        // search open.
        const buttonTitle = open ? filtersLabel : tr(t, "words.search", "Search");
        const buttonLabel = open && filterCount ? `${filtersLabel} (${filterCount})` : buttonTitle;

        return (
            <ClickAwayListener onClickAway={onClickAway}>
                <div className={classes.searchBarWrapper} ref={setWrapperRef} style={{ "--search-extra": `${extra}px` }}>
                    <div className={open ? classes.searchBarOpen : classes.searchBar} ref={setRef}>
                        <input
                            ref={setInputRef}
                            className={classes.searchInput}
                            type="text"
                            value={value}
                            placeholder={overlayPlaceholder ? "" : placeholder}
                            aria-label={placeholder}
                            onChange={onChange}
                            onKeyDown={onKeyDown}
                            onKeyUp={onCaret}
                            onClick={onCaret}
                            onSelect={onCaret}
                            onFocus={onFocus}
                            onBlur={onBlur}
                            autoComplete="off"
                            spellCheck="false"
                            enterKeyHint="search"
                            role="combobox"
                            aria-autocomplete="both"
                            aria-expanded={listShown}
                            aria-controls={listShown ? LISTBOX_ID : undefined}
                            aria-activedescendant={listShown && highlight >= 0 ? optionId(highlight) : undefined}
                        />
                        {box && (ghost || overlayPlaceholder) ? (
                            <div
                                className={classes.inputOverlay}
                                aria-hidden="true"
                                data-overlay={ghost ? "ghost" : "placeholder"}
                                style={{ left: box.left, top: box.top, width: box.width, height: box.height, ...box.font }}
                            >
                                {ghost ? (
                                    <span>
                                        <span className={classes.ghostTyped}>{value}</span>
                                        <span className={classes.ghostRest}>{ghost}</span>
                                    </span>
                                ) : (
                                    <span className={classes.placeholderText} style={{ opacity: cycle.shown ? 1 : 0 }}>
                                        {example ? example.text : placeholder}
                                    </span>
                                )}
                            </div>
                        ) : null}
                        {controls ? (
                            <IconButton
                                className={classes.filterButton + (filtersOpen ? " " + classes.filterButtonOn : "")}
                                onClick={onFilters}
                                aria-label={buttonLabel}
                                aria-expanded={filtersOpen}
                                title={buttonTitle}
                            >
                                {open ? (
                                    <Badge badgeContent={filterCount} invisible={!filterCount} max={99} classes={{ badge: classes.filterBadge }}>
                                        <TuneIcon />
                                    </Badge>
                                ) : (
                                    <SearchIcon />
                                )}
                            </IconButton>
                        ) : null}
                        <IconButton className={classes.searchButton} onClick={onButton}>
                            {open ? <CloseIcon /> : <ArrowBackRounded />}
                        </IconButton>
                    </div>
                    {open && anchorEl && width > 0 && (
                        <SearchResults
                            classes={classes}
                            query={value}
                            results={results}
                            suggestions={listShown ? items : EMPTY_ITEMS}
                            highlight={highlight}
                            onPick={pick}
                            onFill={fill}
                            anchorEl={anchorEl}
                            width={width}
                            maxHeight={maxHeight}
                            history={history}
                            controls={controls}
                            onGoToUsername={onGoToUsername}
                            onGoToTag={onGoToTag}
                            onGoToCommunity={onGoToCommunity}
                            onGoToArtwork={onGoToArtwork}
                            onGoToPost={onGoToPost}
                            onSetTagNavigation={onSetTagNavigation}
                        />
                    )}
                </div>
            </ClickAwayListener>
        );
    },
    (prev, next) =>
        prev.open === next.open &&
        prev.value === next.value &&
        prev.placeholder === next.placeholder &&
        prev.results === next.results &&
        prev.history === next.history &&
        prev.classes === next.classes &&
        prev.controls === next.controls &&
        prev.onChange === next.onChange &&
        prev.onReset === next.onReset &&
        prev.onGoHome === next.onGoHome &&
        prev.onGoToUsername === next.onGoToUsername &&
        prev.onGoToTag === next.onGoToTag &&
        prev.onGoToCommunity === next.onGoToCommunity &&
        prev.onGoToArtwork === next.onGoToArtwork &&
        prev.onGoToPost === next.onGoToPost &&
        prev.onSetTagNavigation === next.onSetTagNavigation,
);

export const SearchBar = withStyles(searchStyles)(SearchBarInner);