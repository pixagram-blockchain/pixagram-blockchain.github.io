"use strict";
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import ClickAwayListener from "@material-ui/core/ClickAwayListener";
import IconButton from "@material-ui/core/IconButton";
import Badge from "@material-ui/core/Badge";
import CloseIcon from "@material-ui/icons/Close";
import ArrowBackRounded from "@material-ui/icons/ArrowBackRounded";
import TuneIcon from "@material-ui/icons/Tune";

import { t, useLanguage } from "../../utils/text";

import { DESKTOP_MIN_WIDTH, DROPDOWN_MAX_HEIGHT, DROPDOWN_MIN_HEIGHT, SEARCH_EXPAND_PX } from "./config";
import { countFilters } from "./filters";
import { tr } from "./highlight";
import { searchStyles } from "./styles";
import { SearchResults } from "./SearchResults";

// ── SearchBar ─────────────────────────────────────────────────────────────────
// The toolbar's search box: input, filter button (white, with the number of
// active filters as a badge), close/back button, click-away, and the results
// dropdown anchored to the bar.
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

const GUTTER_DESKTOP = 24;
const GUTTER_MOBILE = 16;

function sameMetrics(a, b) {
    return a.width === b.width && a.maxHeight === b.maxHeight && a.extra === b.extra;
}

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
        const setRef = useCallback((el) => { if (el) setAnchorEl(el); }, []);
        const setWrapperRef = useCallback((el) => { if (el) setWrapperEl(el); }, []);
        const { width, maxHeight, extra } = useBarMetrics(anchorEl, wrapperEl, open);

        // The dropdown may be open on the panel or filters alone (empty input):
        // the button then closes the search rather than navigating back.
        const openRef = useRef(open);
        openRef.current = open;
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

        return (
            <ClickAwayListener onClickAway={onClickAway}>
                <div className={classes.searchBarWrapper} ref={setWrapperRef} style={{ "--search-extra": `${extra}px` }}>
                    <div className={open ? classes.searchBarOpen : classes.searchBar} ref={setRef}>
                        <input
                            className={classes.searchInput}
                            type="text"
                            value={value}
                            placeholder={placeholder}
                            onChange={onChange}
                            autoComplete="off"
                            spellCheck="false"
                        />
                        {controls ? (
                            <IconButton
                                className={classes.filterButton + (filtersOpen ? " " + classes.filterButtonOn : "")}
                                onClick={onFilters}
                                aria-label={filterCount ? `${filtersLabel} (${filterCount})` : filtersLabel}
                                aria-expanded={filtersOpen}
                                title={filtersLabel}
                            >
                                <Badge badgeContent={filterCount} invisible={!filterCount} max={99} classes={{ badge: classes.filterBadge }}>
                                    <TuneIcon />
                                </Badge>
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
