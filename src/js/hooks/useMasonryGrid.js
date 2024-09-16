"use strict";

import { useCallback, useEffect, useMemo, useRef, useState } from "preact/compat";
import { CellMeasurerCache, createMasonryCellPositioner } from "@pixagram/virtualized/dist/es/index";

// ── useMasonryGrid ─────────────────────────────────────────────────────
// One parameterized grid hook replacing the three near-identical copies
// that had drifted apart in Feed.js, FeedPersonal.js and Community.js.
// (Profile keeps its multi-tab variant: it juggles three masonry refs and
// per-tab caches — a genuinely different shape, not drift.)
//
// Page-specific layout numbers (pageWidth, postListHeight, hideTab /
// hideFab / shouldCollapseMobileCard, paddingX, viewWidth) stay in the
// pages: they're page chrome, not grid mechanics. Pages spread them next
// to this hook's return:
//
//     const core = useMasonryGrid({ ... });
//     const grid = { ...core, pageWidth, postListHeight, hideFab };
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
//   scrollReloadDivisor Feed/Community reset the scroll-accumulator at
//                       overscan/2, FeedPersonal at overscan/1.
//   loadMorePosts/…     infinite scroll is optional (Community: none).

export const GUTTER_SIZE = 16;
export const SCROLL_INTERVAL_MS = 500;

const defaultGetColumnWidth = ({ rootWidth, columnCount, gutter }) =>
    Math.floor((rootWidth - (columnCount + 1) * gutter) / columnCount);

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
                            // infinite scroll (all three optional — omit to disable)
                            loadMorePosts = null,
                            loadingMore = false,
                            loadMoreThreshold = 2048,
                            scrollReloadDivisor = 2,
                        }) => {
    const masonryRef = useRef(null);
    const rootRef = useRef(null);

    const [scrollTop, setScrollTop] = useState(0);
    const [scrollY, setScrollY] = useState(0);
    const [rootDimensions, setRootDimensions] = useState({ width: 0, height: 0 });
    const [selectedPostIndex, setSelectedPostIndex] = useState(0);

    const scrollTopRef = useRef(0);
    const scrollYRef = useRef(0);
    const topScrollByIndex = useRef([]);
    const heightByIndex = useRef([]);
    const xyByIndex = useRef([]);
    const lastScrollCheckHeight = useRef(0);

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
    const setRootElement = useCallback((el) => {
        if (!el) return;
        rootRef.current = el;
        const rect = el.getBoundingClientRect();
        setRootDimensions({ width: rect.width, height: rect.height });
    }, []);

    useEffect(() => {
        if (!rootRef.current) return;
        const rect = rootRef.current.getBoundingClientRect();
        if (rect.width >= 100 && rect.height >= 100) {
            setRootDimensions({ width: rect.width, height: rect.height });
        }
    }, [windowWidth, windowHeight]);

    // Retry until root has valid dimensions (masonry is position:absolute
    // so the wrapper div may start at 0×0 before content lays out)
    useEffect(() => {
        if (rootDimensions.width >= 100 && rootDimensions.height >= 100) return;
        let cancelled = false;
        const retry = () => {
            if (cancelled || !rootRef.current) return;
            const r = rootRef.current.getBoundingClientRect();
            if (r.width >= 100 && r.height >= 100) setRootDimensions({ width: r.width, height: r.height });
            else setTimeout(retry, 50);
        };
        setTimeout(retry, 50);
        return () => { cancelled = true; };
    }, [rootDimensions.width, rootDimensions.height]);

    const setMasonryElement = useCallback((el) => { if (el) masonryRef.current = el; }, []);

    // ── Recompute on layout change ─────────────────────────────────────
    useEffect(() => {
        const masonry = masonryRef.current;
        if (!masonry || !cellMeasurerCache || !cellPositioner) return;
        cellMeasurerCache.clearAll();
        cellMeasurerCache.visible_ids = visibleIdsInit();
        cellPositioner.reset(cellPositionerConfig);
        masonry.clearCellPositions();
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

            lastScrollCheckHeight.current += yDiff;
            const scrollReload =
                Math.abs(lastScrollCheckHeight.current) > (overscanByPixels / scrollReloadDivisor);
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
                setScrollTop(currentST);
                setScrollY(newY);
                if (scrollReload) lastScrollCheckHeight.current = 0;
            }
        }, SCROLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [overscanByPixels, loadMoreThreshold, scrollReloadDivisor]);

    // ── Scroll control ─────────────────────────────────────────────────
    const scrollTo = useCallback((top) => {
        const masonry = masonryRef.current;
        if (!masonry?._scrollingContainer) return;
        masonry._scrollingContainer.scrollTop = top;
        scrollTopRef.current = top;
        setScrollTop(top);
        masonry.forceUpdate();
    }, []);

    const scrollToIndex = useCallback((index) => {
        const idx = index ?? selectedPostIndex;
        const top = (topScrollByIndex.current[idx] || 0)
            + (heightByIndex.current[idx] || 0) / 2
            - rootDimensions.height / 3;
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
        topScrollByIndex.current[index] = top;
        heightByIndex.current[index] = height;
        xyByIndex.current[index] = [rowIndex, columnIndex];
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
        masonry.forceUpdate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cellMeasurerCache, cellPositioner, cellPositionerConfig]);

    return {
        masonryRef, setMasonryElement, setRootElement,
        cellMeasurerCache, cellPositioner, columnWidth, columnCount,
        scrollingResetTimeInterval: SCROLL_INTERVAL_MS,
        scrollTop, scrollY, scrollTo, scrollToIndex,
        getScrollTop, restoreScrollTop,
        rootDimensions, overscanByPixels,
        selectedPostIndex, setSelectedPostIndex, trackElementPosition,
        xyByIndex, resetMasonry,
    };
};

export default useMasonryGrid;