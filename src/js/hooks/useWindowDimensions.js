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

    // ── Look-ahead windows ─────────────────────────────────────────────
    // All three distances are multiples of one unit: the viewport height
    // scaled by its own aspect ratio (h × h/w). That keeps them measured in
    // CARDS rather than pixels — a phone shows one tall full-width card per
    // screen, a four-column desktop several short rows, and h²/w grows
    // exactly where the cards are taller. From the outside in:
    //
    //   overscanByPixels   8×  cells are mounted (measured, placed) this far
    //                          beyond the viewport on either side — the
    //                          Masonry's own render window.
    //   artworkAheadPx     4×  a mounted card renders its artwork once it is
    //                          within this distance of the viewport — the
    //                          `visible` band applied by the pages' cell
    //                          renderers. Used to be 1× in Feed / Profile,
    //                          2× in FeedPersonal and ≈0 in Community (its
    //                          band read a 0-height root), so cards were
    //                          placed ~5 screens ahead but stayed blank until
    //                          under a screen away — artwork popped in late
    //                          while scrolling. Kept at half the mount window
    //                          so a card is always measured before it draws.
    //   loadMoreThreshold  6×  the next page is fetched once LESS than this
    //                          remains below the viewport (was 4× — equal to
    //                          the new artwork band, so the fetch would only
    //                          have started once the band reached the tail
    //                          of the loaded list). Half a band further out,
    //                          the page is already in flight when the band
    //                          gets there.
    //
    //   1920×1080: unit ≈ 608 px → mount 4 860 · artwork 2 430 · fetch 3 645
    //    390×844:  unit ≈ 1 827 px → mount 14 610 · artwork 7 310 · fetch 10 960
    const lookAheadUnit = dims.height * (dims.height / dims.width);
    const overscanByPixels = lookAheadUnit * 8;
    const artworkAheadPx = lookAheadUnit * 4;
    const loadMoreThreshold = lookAheadUnit * 6;

    return {
        windowWidth: dims.width,
        windowHeight: dims.height,
        isMobile,
        overscanByPixels,
        artworkAheadPx,
        loadMoreThreshold,
    };
};

export default useWindowDimensions;