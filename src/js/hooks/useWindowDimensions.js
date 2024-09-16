"use strict";

import { useEffect, useRef, useState } from "preact/compat";

// ── useWindowDimensions ────────────────────────────────────────────────
// Single source of truth for viewport dimensions, replacing the four
// per-page copies (Feed / FeedPersonal / Community / Profile).
//
// Resize strategy — the two axes are deliberately handled differently:
//
//   • WIDTH changes feed columnWidth, which is the memo key for the
//     CellMeasurerCache + positioner. Every committed width therefore
//     costs a full clearAll() → reset() → clearCellPositions() →
//     remeasure of the masonry. A desktop drag-resize fires `resize`
//     continuously, so width commits are TRAILING-DEBOUNCED: one reflow
//     when the drag settles instead of dozens mid-drag.
//
//   • HEIGHT-only changes are cheap (overscan / list-height math, no
//     cache invalidation) but happen constantly on mobile: iOS Safari
//     fires `resize` every time the URL bar collapses or expands while
//     the user scrolls. Those flush on the next animation frame so the
//     layout tracks the viewport without ever busting the measurer cache.
//
// Both paths bail out when nothing actually changed.

const getWindowDimensions = () => {
    const doc = document.documentElement;
    const body = document.body || document.getElementsByTagName("body")[0];
    return {
        width: window.innerWidth || doc.clientWidth || body.clientWidth,
        height: window.innerHeight || doc.clientHeight || body.clientHeight,
    };
};

const WIDTH_DEBOUNCE_MS = 150;

const useWindowDimensions = () => {
    const [dims, setDims] = useState(getWindowDimensions);
    const lastRef = useRef(dims);

    useEffect(() => {
        let rafId = null;
        let widthTimer = null;

        const commit = () => {
            rafId = null;
            widthTimer = null;
            const next = getWindowDimensions();
            const prev = lastRef.current;
            if (next.width === prev.width && next.height === prev.height) return;
            lastRef.current = next;
            setDims(next);
        };

        const onResize = () => {
            const live = getWindowDimensions();
            if (live.width !== lastRef.current.width) {
                // Width drag in progress — collapse to a single trailing commit.
                if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
                if (widthTimer != null) clearTimeout(widthTimer);
                widthTimer = setTimeout(commit, WIDTH_DEBOUNCE_MS);
            } else if (widthTimer == null && rafId == null) {
                // Height-only (mobile URL bar, soft keyboard) — next frame.
                rafId = requestAnimationFrame(commit);
            }
        };

        window.addEventListener("resize", onResize, { passive: true });
        return () => {
            window.removeEventListener("resize", onResize);
            if (rafId != null) cancelAnimationFrame(rafId);
            if (widthTimer != null) clearTimeout(widthTimer);
        };
    }, []);

    const isMobile = dims.width <= 960;
    const overscanByPixels = dims.height * (dims.height / dims.width) * 8;
    const loadMoreThreshold = dims.height * (dims.height / dims.width) * 4;

    return {
        windowWidth: dims.width,
        windowHeight: dims.height,
        isMobile,
        overscanByPixels,
        loadMoreThreshold,
    };
};

export default useWindowDimensions;
