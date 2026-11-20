"use strict";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "preact/compat";

import {
    DESKTOP_MIN_WIDTH, MASONRY_COLUMNS, MASONRY_GAP,
    FULL_COLLAPSE_MS, FULL_COLUMN_PX, FULL_COLUMN_PX_DESKTOP, FULL_ENTER_PX, FULL_EXPAND_MS, FULL_HEIGHT,
    FULL_MAX_COLUMNS, FULL_MAX_COLUMNS_DESKTOP, FULL_WIDTH,
} from "./config";
import { focusOf, scrollToFocus } from "./sections";
import { BAR_H, BAR_H_SM, SCROLL_MARGIN, SCROLL_MARGIN_SM } from "./styles";

// ── Full screen ───────────────────────────────────────────────────────────────
// Scrolled down into the index's results (the posts and the artworks), the open
// search — bar and dropdown, already one rounded shape — grows into a
// full-screen panel over the dimmed page; scrolled back up until they are out
// of sight, it shrinks back into the toolbar.
//
// The move is a hero transition of the bar itself. Full screen, the bar is the
// panel, the dropdown filling it under the input row (styles.js, searchBarFull):
// on desktop a centred sheet, FULL_WIDTH of the viewport's width and FULL_HEIGHT
// of its height, rounded; on phones the whole screen, square. Its box — and its
// corners — are animated from where bar + dropdown stood to the panel, or back
// (FLIP: the end state is laid out, the animation runs from the start state to
// it), and its content is laid out live at every frame: the input row
// stretches, the buttons ride to the corner, the results widen, in one motion.
// An empty, hidden copy of the bar keeps its place in the toolbar (nothing
// there moves) and tells where the panel goes back to.
//
// The panel need not be taller than the dropdown (on a laptop, FULL_HEIGHT of
// the screen is less than the dropdown's own height), nor stand as high: while
// it moves, the list keeps the posts or artworks that made it grow as far in
// sight as they were — and, shrinking, out of sight — rather than letting them
// slip away under its bottom edge, or pop back up.
//
// What decides — one scroll handler, once a frame:
//   grow     scrolling down, past the first MIN_SCROLL_PX, with the posts or the
//            artworks showing by FULL_ENTER_PX
//   shrink   scrolling up with neither in sight anymore, or up to the top of the
//            list (artworks found first stand right there). At the top, where a
//            list has nothing left to scroll, a wheel turn up or a pull down
//            counts as scrolling up.
// Nothing is decided while the panel moves, nor until the layout has settled
// after it: the scrolling it causes (the list's window growing, the browser
// keeping the content in place) is nobody's gesture. Closing the search ends
// it at once; with prefers-reduced-motion the panel switches without moving.
//
// Full, the masonry takes as many columns as the panel holds (fullColumns:
// fewer, larger ones in the desktop sheet), from the moment the panel starts
// growing until it starts shrinking: the moments the artworks are only just in
// sight, or out of it.
//
// The subheader in focus (sections.js) — the list's sticky subheader standing at
// the top of its window, none while the list is at its top — is read where the
// reader's scrolling is: in the same handler, once a frame, after every move of
// the panel, and whenever what the list shows changes. It is told to `onFocus`
// (useSearch keeps it, Index puts it in the address: +search-…).
//
// An order (`order`, from useSearch.restore: the address moved — the back arrow,
// a reload, a link) puts the list where the address says:
//   a subheader   the search is the panel, whichever section it is — the
//                 reader's own scrolling only grows it into the posts and the
//                 artworks, the address does for any of them — and the list goes
//                 to that subheader as soon as the results are in (`settled`):
//                 to the nearest section when that one has nothing to show, and
//                 back to the toolbar when the search found nothing at all
//   none          the list at its top, the search in the toolbar
// An order's panel is simply there, or gone: no transition, as the address
// brings a state back, not a gesture — and the list is put in place in the
// layout it ends in. While an order is under way the list's scrolling decides
// nothing; the reader's hand on the list (wheel, touch, mouse, a key) ends it,
// and so does a new text or filter (useSearch takes the order back).

// Material's emphasized easing: a quick start that settles softly.
const EASE = "cubic-bezier(0.2, 0, 0, 1)";
// The first pixels of scrolling are not "scrolled down" yet (a trackpad's jitter).
const MIN_SCROLL_PX = 8;
// A pull down this long at the top of the list (touch screens) is a scroll up.
const PULL_PX = 24;
const NO_CONTENT = Object.freeze([]);

const viewportSize = () =>
    (typeof window === "undefined" ? { w: 0, h: 0 } : { w: window.innerWidth, h: window.innerHeight });

/** The posts or the artworks show in the list's window, by at least `margin` px. */
function indexShowing(list, margin) {
    const view = list.getBoundingClientRect();
    const sections = list.querySelectorAll("[data-search-index]");
    for (let i = 0; i < sections.length; i++) {
        const r = sections[i].getBoundingClientRect();
        if (r.height > 0 && r.top < view.bottom - margin && r.bottom > view.top) return true;
    }
    return false;
}

/**
 * The masonry's columns in a list `width` px wide, full screen: about FULL_COLUMN_PX each — in the
 * desktop sheet (`desktop`) fewer and larger, about FULL_COLUMN_PX_DESKTOP each.
 */
export function fullColumns(width, desktop = false) {
    const column = desktop ? FULL_COLUMN_PX_DESKTOP : FULL_COLUMN_PX;
    const max = desktop ? FULL_MAX_COLUMNS_DESKTOP : FULL_MAX_COLUMNS;
    const n = Math.round((width + MASONRY_GAP) / (column + MASONRY_GAP));
    return Math.max(MASONRY_COLUMNS, Math.min(max, n || 0));
}

/** Where the panel's containing block starts (the viewport's corner, unless an ancestor holds it). */
function originOf(panel, rect) {
    const cs = window.getComputedStyle(panel);
    return { x: rect.left - (parseFloat(cs.left) || 0), y: rect.top - (parseFloat(cs.top) || 0) };
}

/**
 * Back from the panel's styles to the toolbar's without the bar's own transitions (its corners,
 * its widening margin): they would play from the panel's values — the bottom corners opening and
 * the toolbar's next button sliding. Computed once with none, they are simply there.
 */
function withoutTransitions(el) {
    const before = el.style.transition;
    el.style.transition = "none";
    void window.getComputedStyle(el).marginRight;
    el.style.transition = before;
}

/** A viewport rectangle as one of the panel's keyframes (its fixed coordinates), with its corners. */
const keyframe = (r, origin, radius) => ({
    top: `${r.top - origin.y}px`,
    left: `${r.left - origin.x}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
    borderRadius: radius,
});

/** An element's corner radius as it stands (the open bar's top corners: the shape's corners). */
const radiusOf = (el) => window.getComputedStyle(el).borderTopLeftRadius;

/**
 * The first posts or artworks section of the list, and how far its top stands above the list's
 * bottom edge (`above` > 0: in sight by that much; ≤ 0: out of sight); null without one.
 */
function indexAnchor(list) {
    const el = list.querySelector("[data-search-index]");
    return el ? { el, above: list.getBoundingClientRect().bottom - el.getBoundingClientRect().top } : null;
}

/**
 * While `anim` runs, once a frame, the list scrolls just enough that the anchor's section stays in
 * sight by at least as much as it was (`keepInSight`) — or, shrinking, stays out of sight. It only
 * ever corrects toward that, so the reader's own scrolling the same way goes through. Returns
 * release(): stops, after one last correction (the end state) when asked.
 */
function holdAnchor(list, anchor, anim, keepInSight) {
    let frame = 0;
    const correct = () => {
        if (!anchor.el.isConnected) return;
        const view = list.getBoundingClientRect();
        const above = view.bottom - anchor.el.getBoundingClientRect().top;
        // in sight by as much as it was, as far as the list's window allows (its top no higher
        // than the window's: artworks found first stay right under the input row)
        const want = Math.min(anchor.above, view.height);
        if (keepInSight ? above < want - 0.5 : above > 0.5) {
            list.scrollTop += keepInSight ? want - above : -above;
        }
    };
    const loop = () => {
        correct();
        frame = anim.playState === "running" ? requestAnimationFrame(loop) : 0;
    };
    if (anim) frame = requestAnimationFrame(loop);
    return (last) => {
        cancelAnimationFrame(frame);
        frame = 0;
        if (last) correct();
    };
}

/**
 * The open search's full-screen state, for SearchBar:
 *   { full, columns, height, tick, vw, spacer, setSpacer, setScroller }
 *   full         the bar is the panel (growing into it, in it, or shrinking back)
 *   columns      the artworks' masonry columns
 *   height       the dropdown's height in the panel (its filter panel's room)
 *   tick         counts the moves that ended: what measures the bar measures again
 *   vw           the viewport's width (followed while full)
 *   spacer       the bar's stand-in in the toolbar while full (setSpacer: its ref)
 *   setScroller  ref of the results' scrolling list
 * `panel` is the bar's element, `resultsRef` the dropdown's, `maxHeightRef` the
 * dropdown's maximum height under the bar in the toolbar (where the panel goes back).
 *
 * The subheader in focus, and the orders that put the list at one (see above):
 *   order     { focus, n } — where the address says the list stands (results.focusOrder);
 *             null: none under way
 *   settled   the results are in: nothing of the search is still on its way
 *   content   what the list shows, as dependencies: when one changes, the list may stand elsewhere
 *   onFocus   (focus, order) — the subheader in focus (null: none), told whenever it may have
 *             changed; `order` is the order that is over with it, else null
 */
export function useFullScreen({
    open, panel, resultsRef, maxHeightRef, reduceMotion,
    order = null, settled = true, content = NO_CONTENT, onFocus = null,
}) {
    const [full, setFull] = useState(false);
    const [shrinking, setShrinking] = useState(false);
    const [viewport, setViewport] = useState(viewportSize);
    const [tick, setTick] = useState(0);
    const [scroller, setScroller] = useState(null);
    const [spacer, setSpacer] = useState(null);

    // What the listeners and the moves read: the decision taken (full), a move or its
    // aftermath under way (busy), the list's last scroll position (y), the running
    // animation, what the next commit completes (pending), the settling frame, and the
    // order under way (order).
    const st = useRef({ full: false, busy: false, y: 0, anim: null, release: null, pending: null, settle: 0, order: null });
    const live = useRef(null);
    live.current = { panel, scroller, spacer, reduceMotion, onFocus };

    // Tell where the list stands: its subheader in focus (`done`: the order that is over with it).
    const tell = useCallback((list, done) => {
        const told = live.current.onFocus;
        if (told) told(focusOf(list), done || null);
    }, []);

    // Two frames after the last layout change, the scrolling it caused is over: from then
    // on, the list's scroll position is the reader's again.
    const settle = useCallback(() => {
        const s = st.current;
        cancelAnimationFrame(s.settle);
        s.settle = requestAnimationFrame(() => {
            s.settle = requestAnimationFrame(() => {
                s.settle = 0;
                s.busy = false;
                const list = live.current.scroller;
                s.y = list ? list.scrollTop : 0;
                setTick((n) => n + 1);
            });
        });
    }, []);

    const stop = useCallback(() => {
        const s = st.current;
        if (s.release) {
            s.release(false);
            s.release = null;
        }
        if (s.anim) {
            s.anim.onfinish = null;
            s.anim.cancel();
            s.anim = null;
        }
        cancelAnimationFrame(s.settle);
        s.settle = 0;
        s.busy = false;
        s.pending = null;
    }, []);

    // Grow: the start box is measured now; the commit lays the panel out, and the layout
    // effect below animates from the one to the other. `ordered`: an order's panel, simply
    // there (no transition), the list left for the order to place.
    const grow = useCallback((ordered) => {
        const s = st.current;
        const { panel: bar, scroller: list, reduceMotion: still } = live.current;
        if (s.full || s.busy || !bar) return;
        const b = bar.getBoundingClientRect();
        const drop = resultsRef.current;
        const bottom = drop ? drop.getBoundingClientRect().bottom : b.bottom;
        s.full = true;
        s.busy = true;
        s.pending = {
            kind: "grow",
            from: { top: b.top, left: b.left, width: b.width, height: Math.max(b.height, bottom - b.top) },
            radius: radiusOf(bar),
            // the posts or artworks that made it grow, and how far in sight: kept so
            anchor: list && !ordered ? indexAnchor(list) : null,
            still: !!ordered || !!still || typeof bar.animate !== "function",
        };
        setViewport(viewportSize());
        setFull(true);
    }, [resultsRef]);

    // Shrink: the panel's box is animated, still in the panel's layout, to the bar's place
    // in the toolbar plus the dropdown it will have there; once there, the commit puts the
    // toolbar layout back (and the layout effect lets go of the animation). `ordered`: an
    // order's doing — back in the toolbar at once, the list where the order put it.
    const shrink = useCallback((ordered) => {
        const s = st.current;
        const { panel: bar, scroller: list, spacer: home, reduceMotion: still } = live.current;
        if (!s.full || s.busy) return;
        s.busy = true;
        // shrinking because the posts and artworks left sight: they stay out of it
        const anchor = list && !ordered ? indexAnchor(list) : null;
        const hidden = anchor && anchor.above <= 0 ? anchor : null;
        const done = () => {
            s.full = false;
            s.pending = { kind: "shrunk", hidden };
            setShrinking(false);
            setFull(false);
        };
        if (ordered || still || !bar || !home || typeof bar.animate !== "function") {
            done();
            return;
        }
        const from = bar.getBoundingClientRect();
        const to = home.getBoundingClientRect();
        // the dropdown it goes back to: as tall as its content, up to its maximum
        const drop = resultsRef.current;
        const content = drop && list ? list.getBoundingClientRect().top - drop.getBoundingClientRect().top + list.scrollHeight : 0;
        const max = maxHeightRef.current || content;
        const height = to.height + (content > 0 ? Math.min(max, content) : max);
        const origin = originOf(bar, from);
        let anim = null;
        try {
            anim = bar.animate(
                [
                    keyframe(from, origin, radiusOf(bar)),
                    keyframe({ top: to.top, left: to.left, width: to.width, height }, origin, radiusOf(home)),
                ],
                { duration: FULL_COLLAPSE_MS, easing: EASE, fill: "forwards" },
            );
        } catch (e) {
            anim = null;
        }
        if (!anim) {
            done();
            return;
        }
        s.anim = anim;
        s.release = hidden ? holdAnchor(list, hidden, anim, false) : null;
        anim.onfinish = () => {
            if (s.release) s.release(true);
            s.release = null;
            done();
        };
        // the masonry gets its own columns back now, while the artworks are out of sight
        setShrinking(true);
    }, [resultsRef, maxHeightRef]);

    // The commit that laid the panel out, or the toolbar back, completes the move.
    useLayoutEffect(() => {
        const s = st.current;
        const p = s.pending;
        if (!p) return;
        const bar = live.current.panel;
        const list = live.current.scroller;
        if (p.kind === "grow" && full) {
            s.pending = null;
            if (!p.still && bar) {
                const to = bar.getBoundingClientRect();
                const origin = originOf(bar, to);
                try {
                    const anim = bar.animate(
                        [keyframe(p.from, origin, p.radius), keyframe(to, origin, radiusOf(bar))],
                        { duration: FULL_EXPAND_MS, easing: EASE },
                    );
                    s.anim = anim;
                    s.release = p.anchor && list ? holdAnchor(list, p.anchor, anim, true) : null;
                    anim.onfinish = () => {
                        s.anim = null;
                        if (s.release) s.release(true);
                        s.release = null;
                        settle();
                    };
                    return;
                } catch (e) {
                    // no animation: the panel is simply there
                }
            }
            // there at once: the posts or artworks kept in sight all the same
            if (p.anchor && list) holdAnchor(list, p.anchor, null, true)(true);
            settle();
        } else if (p.kind === "shrunk" && !full) {
            s.pending = null;
            // the bar is back in the toolbar, right where the animation held it: let go
            if (s.anim) {
                s.anim.onfinish = null;
                s.anim.cancel();
                s.anim = null;
            }
            if (bar) withoutTransitions(bar);
            if (p.hidden && list) holdAnchor(list, p.hidden, null, false)(true);
            settle();
        }
    }, [full, settle]);

    // Closed, the search is no panel anymore: at once (its results went with it, and an
    // order still under way).
    useLayoutEffect(() => {
        if (open) return;
        const s = st.current;
        s.order = null;
        if (!s.full && !s.busy && !s.anim) return;
        stop();
        const bar = live.current.panel;
        if (bar) withoutTransitions(bar);
        s.full = false;
        setShrinking(false);
        setFull(false);
    }, [open, stop]);

    useEffect(() => stop, [stop]);

    // An order comes, or is taken back before the list got there (a new text, a filter: the
    // reader moved on) — the panel it opened for nothing, its list still at the top, then goes
    // back to the toolbar, as it does when a new text empties a list the reader had scrolled.
    useLayoutEffect(() => {
        const s = st.current;
        const takenBack = !!s.order && !order;
        s.order = order || null;
        if (!takenBack || !s.full || s.busy) return;
        const list = live.current.scroller;
        if (!list || list.scrollTop <= 0) shrink();
    }, [order, shrink]);

    // The order under way is carried out as far as it can be, whenever something it waits for
    // moves: the bar, the list, the results, the panel.
    useLayoutEffect(() => {
        const s = st.current;
        const o = s.order;
        if (!o || !open) return;
        const list = live.current.scroller;
        let placed = false;
        if (o.focus) {
            // A subheader: the panel at once…
            if (!s.full && !s.busy) grow(true);
            // … and the list at it once the results are in (their sections are not there before).
            if (!list || !settled) return;
            placed = scrollToFocus(list, o.focus);
            s.y = list.scrollTop;
            // In the panel's own layout only: once more when it has settled (tick).
            if (placed && (s.busy || !s.full)) return;
        }
        if (!placed) {
            // None — or a search that found nothing to stand at: the list at its top, the
            // search in the toolbar.
            if (list) {
                list.scrollTop = 0;
                s.y = 0;
            }
            if (s.busy) return;
            if (s.full) shrink(true);
        }
        s.order = null;
        tell(list, o);
    }, [order, open, panel, scroller, settled, tick, full, grow, shrink, tell]);

    // After a move of the panel, and whenever what the list shows changes, the list may
    // stand elsewhere (and nowhere once it is gone: none). Not while the panel moves or an
    // order is under way: their end tells.
    useEffect(() => {
        const s = st.current;
        if (s.busy || s.order) return;
        tell(scroller);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scroller, tick, tell, ...content]);

    // Full, the panel follows the viewport (CSS insets); the columns and heights here too.
    useEffect(() => {
        if (!full) return undefined;
        const onResize = () => setViewport((p) => {
            const n = viewportSize();
            return n.w === p.w && n.h === p.h ? p : n;
        });
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [full]);

    // The reader's scrolling, read once a frame.
    useEffect(() => {
        if (!scroller) return undefined;
        const s = st.current;
        s.y = scroller.scrollTop;
        let frame = 0;
        let pullFrom = null;
        const decide = () => {
            frame = 0;
            const y = scroller.scrollTop;
            const dy = y - s.y;
            s.y = y;
            // (nor while an order is under way: the list is on its way to where the address says)
            if (s.busy || s.order || !dy) return;
            if (dy > 0) {
                if (!s.full && y > MIN_SCROLL_PX && indexShowing(scroller, FULL_ENTER_PX)) grow();
            } else if (s.full && (y <= 0 || !indexShowing(scroller, 0))) {
                shrink();
            }
            // the subheader in focus now (a move just started tells it when it has settled)
            if (!s.busy) tell(scroller);
        };
        const onScroll = () => {
            if (!frame) frame = requestAnimationFrame(decide);
        };
        // The reader's hand on the list ends an order under way: the list is theirs, where it stands.
        const takeOver = () => {
            const o = s.order;
            if (!o) return;
            s.order = null;
            s.y = scroller.scrollTop;
            tell(scroller, o);
        };
        // At the top, a list has nothing left to scroll up: the wheel turned up is the scroll up…
        const onWheel = (e) => {
            takeOver();
            if (s.full && !s.busy && e.deltaY < 0 && scroller.scrollTop <= 0) shrink();
        };
        // … and so is a finger pulling the list down.
        const onTouchStart = (e) => {
            takeOver();
            pullFrom = e.touches.length === 1 && scroller.scrollTop <= 0 ? e.touches[0].clientY : null;
        };
        const onTouchMove = (e) => {
            if (pullFrom === null || !s.full || s.busy || e.touches.length !== 1) return;
            if (e.touches[0].clientY - pullFrom > PULL_PX && scroller.scrollTop <= 0) {
                pullFrom = null;
                shrink();
            }
        };
        const passive = { passive: true };
        scroller.addEventListener("scroll", onScroll, passive);
        scroller.addEventListener("wheel", onWheel, passive);
        scroller.addEventListener("touchstart", onTouchStart, passive);
        scroller.addEventListener("touchmove", onTouchMove, passive);
        // (the scrollbar dragged, a row clicked; a key while the focus is in the list)
        scroller.addEventListener("mousedown", takeOver, passive);
        scroller.addEventListener("keydown", takeOver, passive);
        return () => {
            scroller.removeEventListener("scroll", onScroll, passive);
            scroller.removeEventListener("wheel", onWheel, passive);
            scroller.removeEventListener("touchstart", onTouchStart, passive);
            scroller.removeEventListener("touchmove", onTouchMove, passive);
            scroller.removeEventListener("mousedown", takeOver, passive);
            scroller.removeEventListener("keydown", takeOver, passive);
            if (frame) cancelAnimationFrame(frame);
        };
    }, [scroller, grow, shrink, tell]);

    // The panel: a centred FULL_WIDTH × FULL_HEIGHT sheet on desktop, the whole screen below.
    const desktop = viewport.w >= DESKTOP_MIN_WIDTH;
    const panelWidth = desktop ? viewport.w * FULL_WIDTH : viewport.w;
    const panelHeight = desktop ? viewport.h * FULL_HEIGHT : viewport.h;
    const columns = full && !shrinking
        ? fullColumns(panelWidth - 2 * (desktop ? SCROLL_MARGIN : SCROLL_MARGIN_SM), desktop)
        : MASONRY_COLUMNS;
    const height = Math.max(0, Math.floor(panelHeight - (desktop ? BAR_H : BAR_H_SM)));
    return { full, columns, height, tick, vw: viewport.w, spacer, setSpacer, setScroller };
}
