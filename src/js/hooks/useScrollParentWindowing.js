import * as React from "preact/compat";

/* ────────────────────────────────────────────────────────────────────────────
 * Fixed-row-height windowing against the DIALOG's own scrollbar.
 *
 * The list renders at its full virtual height (top/bottom spacers) inside
 * whatever scrolls around it, so there is never a second, boxed scrollbar.
 *
 * Shared by WalletHistory and FollowListModal. Compared with the first
 * version that lived in WalletHistory, the visible band is now the
 * intersection of EVERY clipping ancestor (plus the viewport) instead of
 * "the nearest ancestor with overflow:auto". That matters inside dialogs:
 * MUI's DialogContent declares overflow-y:auto but is often not height-bound,
 * while the SwipeableViews slide above it is the element that really scrolls.
 * Intersecting all of them is correct whichever one scrolls, and scroll events
 * are caught with one capturing listener on the document for the same reason.
 * Rects are used throughout, so swipe transforms don't disturb the maths.
 * ──────────────────────────────────────────────────────────────────────────── */

const CLIPS = /(auto|scroll|overlay|hidden|clip)/;

function clippingAncestors(node) {
    const out = [];
    let el = node && node.parentElement;
    while (el && el !== document.body && el !== document.documentElement) {
        const cs = window.getComputedStyle(el);
        if (CLIPS.test(cs.overflowY) || CLIPS.test(cs.overflow)) out.push(el);
        el = el.parentElement;
    }
    return out;
}

export function useScrollParentWindowing(itemCount, rowHeight, overscan = 8) {
    const listRef = React.useRef(null);
    const rafRef = React.useRef(0);
    const [range, setRange] = React.useState({ start: 0, end: Math.min(itemCount, 30) });

    React.useLayoutEffect(() => {
        const node = listRef.current;
        if (!node) return;
        const clips = clippingAncestors(node);

        const measure = () => {
            rafRef.current = 0;
            const el = listRef.current;
            if (!el) return;
            const listTop = el.getBoundingClientRect().top;
            let viewTop = 0;
            let viewBottom = window.innerHeight || document.documentElement.clientHeight;
            for (const c of clips) {
                const r = c.getBoundingClientRect();
                if (r.top > viewTop) viewTop = r.top;
                if (r.bottom < viewBottom) viewBottom = r.bottom;
            }
            if (viewBottom < viewTop) viewBottom = viewTop; // fully clipped → overscan only
            const localStart = Math.max(0, viewTop - listTop);
            const localEnd = Math.max(0, viewBottom - listTop);
            const start = Math.min(itemCount, Math.max(0, Math.floor(localStart / rowHeight) - overscan));
            const end = Math.min(itemCount, Math.ceil(localEnd / rowHeight) + overscan);
            setRange((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
        };

        const schedule = () => {
            if (rafRef.current) return;
            rafRef.current = requestAnimationFrame(measure);
        };

        measure();
        document.addEventListener("scroll", schedule, { capture: true, passive: true });
        window.addEventListener("resize", schedule);
        let ro;
        if (clips.length && typeof ResizeObserver === "function") {
            ro = new ResizeObserver(schedule);
            for (const c of clips) ro.observe(c);
        }
        return () => {
            document.removeEventListener("scroll", schedule, { capture: true });
            window.removeEventListener("resize", schedule);
            if (ro) ro.disconnect();
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = 0;
        };
    }, [itemCount, rowHeight, overscan]);

    return { listRef, start: range.start, end: range.end };
}

/**
 * Ask for the next page once the rendered window comes within `threshold`
 * rows of the end of the list.
 *
 * The caller owns the state machine; this hook only fires while `enabled`
 * (= has more AND nothing in flight). Pass `version` (e.g. the raw item count)
 * when a page can land without changing `count` — a filtered view — so the
 * check runs again after every page.
 */
export function useEndReached({ end, count, enabled, onEndReached, threshold = 20, version = 0 }) {
    const cb = React.useRef(onEndReached);
    cb.current = onEndReached;
    React.useEffect(() => {
        if (!enabled || typeof cb.current !== "function") return;
        if (count - end <= threshold) cb.current();
    }, [end, count, enabled, threshold, version]);
}

export default useScrollParentWindowing;
