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
 *
 * The list also moves without anything scrolling: a slide animating into
 * place (the wallet's tab change is a transform), or content above it growing
 * or shrinking (a section opening, a chart loading). Scroll and resize alone
 * left the window where it was, with blank rows past its edge until the next
 * scroll. The window is now recomputed at the end of every transition and
 * animation, and whenever something above the list inside its scroller
 * changes size; and while every clip is out of view (a slide still off
 * screen) it covers the rows the nearest clip will show once it lands.
 * ──────────────────────────────────────────────────────────────────────────── */

const CLIPS = /(auto|scroll|overlay|hidden|clip)/;
// Elements between the list and its scroller watched for size changes.
const MAX_WATCHED = 24;

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
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
            let viewTop = 0;
            let viewBottom = viewportHeight;
            for (const c of clips) {
                const r = c.getBoundingClientRect();
                if (r.top > viewTop) viewTop = r.top;
                if (r.bottom < viewBottom) viewBottom = r.bottom;
            }
            if (viewBottom <= viewTop && clips.length) {
                // Nothing in view: a slide still translated off screen while
                // it animates in. Rows keep their place relative to the
                // nearest clip, so window what it will show once it lands
                // (at most a viewport's worth) rather than the overscan alone.
                const r = clips[0].getBoundingClientRect();
                viewTop = r.top;
                viewBottom = Math.min(r.bottom, r.top + viewportHeight);
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
        // Moves that scroll nothing (see the header).
        document.addEventListener("transitionend", schedule, true);
        document.addEventListener("animationend", schedule, true);
        let ro;
        if (typeof ResizeObserver === "function") {
            ro = new ResizeObserver(schedule);
            for (const c of clips) ro.observe(c);
            // What sits above the list inside its scroller: the wrappers on
            // the way up and everything before each of them. One of those
            // changing size is what moves the list without a scroll.
            let watched = 0;
            const watch = (el) => {
                if (watched >= MAX_WATCHED) return;
                ro.observe(el);
                watched++;
            };
            for (let a = node; a && a !== clips[0] && a !== document.body; a = a.parentElement) {
                if (a !== node) watch(a);
                for (let s = a.previousElementSibling; s; s = s.previousElementSibling) watch(s);
            }
        }
        return () => {
            document.removeEventListener("scroll", schedule, { capture: true });
            window.removeEventListener("resize", schedule);
            document.removeEventListener("transitionend", schedule, true);
            document.removeEventListener("animationend", schedule, true);
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