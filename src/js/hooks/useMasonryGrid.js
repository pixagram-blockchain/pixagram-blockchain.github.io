"use strict";

import { useCallback, useEffect, useMemo, useRef, useState } from "preact/compat";
import { CellMeasurerCache, createMasonryCellPositioner } from "@pixagram/virtualized/dist/es/index";

// ── useMasonryGrid ─────────────────────────────────────────────────────
// One parameterized grid hook replacing the three near-identical copies
// that had drifted apart in Feed.js, FeedPersonal.js and Community.js.
// (Profile keeps its multi-tab variant: it juggles three masonry refs and
// per-tab caches — a genuinely different shape, not drift.)
//
// Page-specific layout numbers (pageWidth, postListHeight, paddingX,
// viewWidth) stay in the pages: they're page chrome, not grid mechanics.
// Pages spread them next to this hook's return:
//
//     const core = useMasonryGrid({ ..., deriveChrome: FEED_CHROME });
//     const grid = { ...core, pageWidth, postListHeight, ...core.chrome };
//
// Differences captured as options:
//   getColumnCount      Feed: width breakpoints → 1..4. Others: fixed 1.
//   getColumnWidth      Community uses a sidebar-offset formula instead of
//                       the (root − gutters) / columns default.
//   maxColumnWidth      FeedPersonal caps the single column at 720 px.
//   fallbackColumnWidth pre-measure default (356 / 640 / 800).
//   defaultHeight       measurer default (600, Community: 400).
//   visibleIdsInit      Feed/FP used {}, Community used [] — kept per page
//                       so existing cellRenderer indexing is untouched.
//   deriveChrome        (scrollTop, scrollY) => the page's scroll-driven
//                       chrome flags — see "Scroll tracking" below.
//   loadMorePosts/…     infinite scroll is optional (Community: none).
//
// ── Scroll position is NOT React state ─────────────────────────────────
// This hook used to keep scrollTop / scrollY in state and set both on
// every 500 ms poll tick that moved. Nothing consumed the raw numbers
// except a handful of booleans (hide the tab bar past 72 px scrolling
// down, hide the FAB past 512 px scrolling up …), yet each tick
// re-rendered the whole page: MUI's Tabs (whose indicator effect forces a
// layout), every dialog kept mounted, the ImageMeasurer and the Masonry —
// which, handed the polled value as a controlled `scrollTop` prop, then
// rendered a window up to a tick behind the real scroll and scheduled a
// reset render after it. The live position now lives in refs; the page
// hands in `deriveChrome`, a pure function of (scrollTop, scrollY) that
// returns the flags it needs, and the only state here is that object —
// replaced when a flag flips, kept by identity otherwise. A page that
// still needs the raw numbers (Community, whose tab bar and header take
// them) returns them from deriveChrome and gets the previous behaviour.
// The Masonry is rendered uncontrolled (no scrollTop prop): it tracks its
// own scroll events, and scrollTo below writes the container directly.

export const GUTTER_SIZE = 16;
export const SCROLL_INTERVAL_MS = 500;

const defaultGetColumnWidth = ({ rootWidth, columnCount, gutter }) =>
    Math.floor((rootWidth - (columnCount + 1) * gutter) / columnCount);

const NO_CHROME = Object.freeze({});
const defaultDeriveChrome = () => NO_CHROME;

// Shallow key/value compare of two chrome objects.
const sameChrome = (a, b) => {
    if (a === b) return true;
    if (!a || !b) return false;
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (let i = 0; i < ka.length; i++) if (a[ka[i]] !== b[ka[i]]) return false;
    return true;
};

const useMasonryGrid = ({
                            // viewport (from useWindowDimensions)
                            windowWidth,
                            windowHeight,
                            isMobile,
                            overscanByPixels,
                            // layout
                            getColumnCount,
                            getColumnWidth = defaultGetColumnWidth,
                            fallbackColumnWidth = 356,
                            maxColumnWidth = Infinity,
                            // measurer
                            defaultHeight = 600,
                            minHeight = 144,
                            visibleIdsInit = () => ({}),
                            // scroll-driven page chrome (see the header note)
                            deriveChrome = defaultDeriveChrome,
                            // infinite scroll (all three optional — omit to disable)
                            loadMorePosts = null,
                            loadingMore = false,
                            loadMoreThreshold = 2048,
                        }) => {
    const masonryRef = useRef(null);
    const rootRef = useRef(null);

    const [rootDimensions, setRootDimensions] = useState({ width: 0, height: 0 });
    const [selectedPostIndex, setSelectedPostIndex] = useState(0);

    // Live scroll position — refs, never state (see the header note).
    const scrollTopRef = useRef(0);
    const scrollYRef = useRef(0);
    const topScrollByIndex = useRef([]);
    const heightByIndex = useRef([]);
    const xyByIndex = useRef([]);

    // The page's scroll-driven flags: the one piece of scroll-derived state.
    // deriveChrome is read through a ref so the poll never resubscribes when
    // a page passes an inline function.
    const deriveChromeRef = useRef(deriveChrome);
    deriveChromeRef.current = deriveChrome;
    const [chrome, setChrome] = useState(() => deriveChrome(0, 0));
    const applyChrome = useCallback((top, y) => {
        const next = deriveChromeRef.current(top, y);
        setChrome(prev => (sameChrome(prev, next) ? prev : next));
    }, []);

    // ── Column layout ──────────────────────────────────────────────────
    const columnCount = useMemo(
        () => (getColumnCount ? getColumnCount(windowWidth) : 1),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [windowWidth],
    );

    const columnWidth = useMemo(() => {
        const rw = rootDimensions.width;
        if (rw < 100) return fallbackColumnWidth;
        const raw = getColumnWidth({
            rootWidth: rw,
            columnCount,
            isMobile,
            gutter: GUTTER_SIZE,
        });
        return Math.min(raw, maxColumnWidth);
        // getColumnWidth is expected to be a module-level (stable) function.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rootDimensions.width, columnCount, isMobile, fallbackColumnWidth, maxColumnWidth]);

    // ── Cell measurer cache ────────────────────────────────────────────
    const cellMeasurerCache = useMemo(() => {
        const cache = new CellMeasurerCache({
            defaultHeight,
            defaultWidth: columnWidth || fallbackColumnWidth,
            fixedWidth: true,
            minHeight,
        });
        cache.visible_ids = visibleIdsInit();
        return cache;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [columnWidth]);

    // ── Cell positioner ────────────────────────────────────────────────
    const cellPositionerConfig = useMemo(() => ({
        cellMeasurerCache, columnCount, columnWidth, spacer: GUTTER_SIZE,
    }), [cellMeasurerCache, columnCount, columnWidth]);

    const cellPositioner = useMemo(
        () => createMasonryCellPositioner(cellPositionerConfig),
        [cellPositionerConfig],
    );

    // ── Root measurement ───────────────────────────────────────────────
    // Only the WIDTH is load-bearing (columnWidth derives from it). The
    // wrapper's height is ~0 by design — the masonry inside it is
    // position:absolute — so the previous `height >= 100` gate meant (a) a
    // window resize never re-measured the root, leaving columnWidth stuck at
    // its mount value, and (b) the 50 ms retry below never settled and
    // forced a layout every tick for the page's lifetime. Gate on width
    // only, bail out on unchanged values, and let a ResizeObserver (drawer
    // toggles, orientation changes) do the re-measuring instead of polling.
    const measureRoot = useCallback(() => {
        const el = rootRef.current;
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        if (rect.width < 100) return false;
        setRootDimensions(prev =>
            (prev.width === rect.width && prev.height === rect.height)
                ? prev
                : { width: rect.width, height: rect.height });
        return true;
    }, []);

    const setRootElement = useCallback((el) => {
        if (!el) return;
        rootRef.current = el;
        measureRoot();
    }, [measureRoot]);

    useEffect(() => { measureRoot(); }, [windowWidth, windowHeight, measureRoot]);

    useEffect(() => {
        const el = rootRef.current;
        if (!el || typeof ResizeObserver === "undefined") return;
        const ro = new ResizeObserver(() => { measureRoot(); });
        ro.observe(el);
        return () => ro.disconnect();
        // rootRef is populated by the callback ref before effects run.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [measureRoot]);

    // Bounded retry for the rare case where the wrapper has no width yet at
    // ref-attach time (hidden tab, pending layout). Stops as soon as a width
    // lands, or after 5 s — never an unbounded forced-layout loop again.
    useEffect(() => {
        if (rootDimensions.width >= 100) return;
        let cancelled = false;
        let attempts = 0;
        let timer = 0;
        const retry = () => {
            if (cancelled) return;
            if (!measureRoot() && ++attempts < 100) timer = setTimeout(retry, 50);
        };
        timer = setTimeout(retry, 50);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [rootDimensions.width, measureRoot]);

    const setMasonryElement = useCallback((el) => { if (el) masonryRef.current = el; }, []);

    // ── Recompute on layout change ─────────────────────────────────────
    useEffect(() => {
        const masonry = masonryRef.current;
        if (!masonry || !cellMeasurerCache || !cellPositioner) return;
        cellMeasurerCache.clearAll();
        cellMeasurerCache.visible_ids = visibleIdsInit();
        cellPositioner.reset(cellPositionerConfig);
        masonry.clearCellPositions();
        // The tracked positions belong to the layout just discarded; cells
        // in range re-track on the next render, the rest read as unplaced.
        topScrollByIndex.current = [];
        heightByIndex.current = [];
        masonry.forceUpdate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [columnWidth, cellMeasurerCache, cellPositioner, cellPositionerConfig]);

    // ── Scroll tracking + (optional) infinite scroll ───────────────────
    // Refs keep the polling interval from going stale without resubscribing.
    const loadMoreRef = useRef(loadMorePosts);
    const loadingMoreRef = useRef(loadingMore);
    loadMoreRef.current = loadMorePosts;
    loadingMoreRef.current = loadingMore;

    useEffect(() => {
        const interval = setInterval(() => {
            const masonry = masonryRef.current;
            if (!masonry?._scrollingContainer) return;

            const prevST = scrollTopRef.current;
            const prevSY = scrollYRef.current;
            const container = masonry._scrollingContainer;
            const currentST = container.scrollTop;
            const yDiff = currentST - prevST;

            // Direction accumulator: drifts negative while scrolling down,
            // positive while scrolling up, clamped — what the chrome flags
            // read for "hide on the way down, show on the way up".
            const newY = Math.min(Math.max(-64, prevSY - yDiff), 64);

            // Infinite scroll detection (only when the page wired a loader).
            // The trigger is poll-driven, so it must also fire when the
            // current batch does NOT overflow the container: scrollHeight is
            // clamped to clientHeight then (remaining ≤ 0) and no scroll can
            // ever happen, so the old `scrollHeight > clientHeight`
            // precondition starved load-more forever on an under-filled
            // first page (small tag feeds, heavy NSFW filtering, tall or
            // many-column viewports). Only require that the container has
            // laid out — clientHeight > 0 keeps the 0×0 boot ticks silent —
            // and let the page loaders' own guards (isLoading / loadingMore
            // / hasMore / empty list) turn the repeated polls into no-ops
            // once the tail is reached, exactly like sitting at the bottom
            // of a long list already does today.
            if (loadMoreRef.current && !loadingMoreRef.current) {
                const scrollH = container.scrollHeight || 0;
                const clientH = container.clientHeight || 0;
                if (clientH > 0 && scrollH - currentST - clientH < loadMoreThreshold) {
                    loadMoreRef.current();
                }
            }

            if (prevST !== currentST || prevSY !== newY) {
                scrollTopRef.current = currentST;
                scrollYRef.current = newY;
                applyChrome(currentST, newY);
            }
        }, SCROLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [loadMoreThreshold, applyChrome]);

    // ── Scroll control ─────────────────────────────────────────────────
    // Writes the container; the Masonry (uncontrolled) picks the new offset
    // up from the scroll event that follows. The forceUpdate covers the case
    // where the write lands inside the current cell range — the event then
    // changes nothing, and a reset of the caches (the usual reason to scroll
    // to 0) still needs a render.
    const scrollTo = useCallback((top) => {
        const masonry = masonryRef.current;
        if (!masonry?._scrollingContainer) return;
        masonry._scrollingContainer.scrollTop = top;
        scrollTopRef.current = top;
        applyChrome(top, scrollYRef.current);
        masonry.forceUpdate();
    }, [applyChrome]);

    const scrollToIndex = useCallback((index) => {
        const idx = index ?? selectedPostIndex;
        // Viewport height comes from the scroll container itself — the
        // wrapper div is ~0 px tall (see root measurement above), so
        // rootDimensions.height would pin the target card to the top edge.
        const container = masonryRef.current?._scrollingContainer;
        const viewH = container?.clientHeight || rootDimensions.height || 0;
        const top = (topScrollByIndex.current[idx] || 0)
            + (heightByIndex.current[idx] || 0) / 2
            - viewH / 3;
        scrollTo(top);
    }, [selectedPostIndex, rootDimensions.height, scrollTo]);

    // Synchronous read of the live scroll position — safe to call from an
    // unmount cleanup (state would be stale there; the container isn't).
    const getScrollTop = useCallback(() => {
        const masonry = masonryRef.current;
        return masonry?._scrollingContainer
            ? masonry._scrollingContainer.scrollTop
            : scrollTopRef.current;
    }, []);

    // Best-effort scroll restore for cache-served views. The masonry needs
    // measured cells before a deep scrollTop sticks (scrollHeight grows as
    // ImageMeasurer resolves), so retry until the target is reachable.
    // Returns a cancel function for effect cleanup.
    const restoreScrollTop = useCallback((top) => {
        if (!top || top <= 0) return () => {};
        let cancelled = false;
        let attempts = 0;
        const tryRestore = () => {
            if (cancelled) return;
            const masonry = masonryRef.current;
            const container = masonry?._scrollingContainer;
            if (container && container.scrollHeight >= top + container.clientHeight) {
                scrollTo(top);
                return;
            }
            if (++attempts < 40) setTimeout(tryRestore, 100);
        };
        requestAnimationFrame(tryRestore);
        return () => { cancelled = true; };
    }, [scrollTo]);

    const trackElementPosition = useCallback((index, top, height, rowIndex, columnIndex) => {
        // Masonry also runs the cellRenderer for cells it is still MEASURING,
        // off-layout, with a width-only style — `+style.top` is NaN there.
        // Never let that pass overwrite a position recorded while the cell
        // was actually placed; getCellPosition relies on the distinction.
        if (Number.isFinite(top)) {
            topScrollByIndex.current[index] = top;
            heightByIndex.current[index] = height;
        }
        xyByIndex.current[index] = [rowIndex, columnIndex];
    }, []);

    // Where a cell currently sits in the scroll container — or null while
    // the masonry hasn't placed it yet: it lays cells out lazily as the
    // viewport approaches them, so a card deep in the list has no position
    // until something scrolls towards it (see FeedPersonal's focus seek).
    const getCellPosition = useCallback((index) => {
        const top = topScrollByIndex.current[index];
        if (!Number.isFinite(top)) return null;
        return { top, height: heightByIndex.current[index] || 0 };
    }, []);

    // Force-clear all Masonry caches in one call. Used by the parent
    // whenever the underlying post list is fully replaced (initial load,
    // sort change, post_published refetch). forceUpdate alone isn't enough
    // — Masonry caches measured cell heights by id and its _positionCache
    // keeps the old layout until clearCellPositions().
    const resetMasonry = useCallback(() => {
        const masonry = masonryRef.current;
        if (!masonry || !cellMeasurerCache || !cellPositioner) return;
        cellMeasurerCache.clearAll();
        cellMeasurerCache.visible_ids = visibleIdsInit();
        cellPositioner.reset(cellPositionerConfig);
        masonry.clearCellPositions();
        topScrollByIndex.current = [];
        heightByIndex.current = [];
        masonry.forceUpdate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cellMeasurerCache, cellPositioner, cellPositionerConfig]);

    return {
        masonryRef, setMasonryElement, setRootElement,
        cellMeasurerCache, cellPositioner, columnWidth, columnCount,
        scrollingResetTimeInterval: SCROLL_INTERVAL_MS,
        chrome, scrollTo, scrollToIndex,
        getScrollTop, restoreScrollTop,
        rootDimensions, overscanByPixels,
        selectedPostIndex, setSelectedPostIndex, trackElementPosition,
        getCellPosition, xyByIndex, resetMasonry,
    };
};

export default useMasonryGrid;