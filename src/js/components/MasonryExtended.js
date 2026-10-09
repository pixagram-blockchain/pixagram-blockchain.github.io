"use strict";

import * as React from "preact/compat";
import { Masonry, createMasonryCellPositioner as createBaseCellPositioner } from "@pixagram/virtualized/dist/es/index";
import { EASE } from "../theme/motion";

// ── MasonryExtended ────────────────────────────────────────────────────
// Single shared subclass replacing the four per-page copies (Feed,
// FeedPersonal, Community, Profile). Superset of all of them:
//
//   • render(): when the measurer cache / positioner aren't built yet
//     (root still measuring at 0×0), render a same-box placeholder div
//     instead of letting @pixagram/virtualized crash on a null cache.
//     (Feed / FeedPersonal / Profile behaviour, now also covering
//     Community.)
//
//   • _getEstimatedTotalHeight(): clamp the column estimate to ≥1 and
//     guard against a non-finite estimate (defaultWidth 0 during the
//     first measure pass). (Community's isFinite guard, now everywhere.)
//
//   • useTransform (on by default, defaultProps below): cells are placed
//     with `transform: translate3d(x, y, 0)` instead of top/left, so a
//     re-pack moves them on the compositor and each cell repaints on its
//     own layer. Implemented entirely here, on top of the untouched base:
//     the base render hands every placed cell a cached style object
//     `{ top, left|right, width, height, position }`; a wrapper around the
//     page's cellRenderer converts that into the transform style — one
//     transform object per base style object (and per motion variant, see
//     "Motion"), so a cell keeps a stable style identity for as long as the
//     base does and memo'd cards bail on it — and passes the placed offsets
//     along as the `top` / `left` params. That is what the pages' position
//     tracking and visibility bands read (never `style.top`, which is 0 in
//     this mode). The measurement pass (a `{ width }`-only style, no
//     position yet) goes through untouched, and `useTransform={false}`
//     keeps the upstream style shape.
//
// Pages render this UNCONTROLLED — no `scrollTop` prop. In controlled
// mode the base takes its offset from the prop through
// getDerivedStateFromProps, which overwrites the live scroll position on
// every render: fed from a 500 ms poll, the rendered window lagged the
// real scroll by up to a tick and every tick forced an `isScrolling`
// flip plus a reset render. Uncontrolled, it reads the live offset from
// its own scroll handler and skips setState when the cell range hasn't
// moved. Programmatic scrolls (the grid hooks' scrollTo) write the
// container's scrollTop, and the scroll event that follows is handled
// like any other.
//
// ── Relayout past a change ─────────────────────────────────────────────
// The library keys its whole layout by INDEX: the CellMeasurerCache's
// heights, the position cache, the cached cell styles. A row added,
// removed or changed in the middle of the list left every index past it
// holding its previous occupant's height and position — cards overlapping
// or leaving gaps — which is why the pages used to reset the whole grid
// (every visible cell re-measured, one forced layout each, and a flash) on
// any change to their list. The layout is now reconciled here instead.
// Every render compares each index's cell identity (the keyMapper) — and,
// when the page passes `cellLayoutKey`, what that cell's height depends on
// — with the previous render's. From the first index that differs:
//   • a measured height moves with its cell to the index the cell now sits
//     at, so a cell that only moved is never measured again;
//   • a cell whose layout key changed keeps its old height for now and is
//     re-measured in place by its CellMeasurer (its cache entry is
//     cleared, its position is not);
//   • a cell new to the list is placed provisionally, at the measurer's
//     default height, when known cells follow it — they stay mounted and
//     placed while it is measured in place, rather than dropping out of
//     the grid until it is;
//   • the positioner is replayed from index 0 (arithmetic only, no DOM),
//     so every cell past the change lands where it now belongs.
// Cells before the change keep their measurements and positions, and only
// what changed is measured. A re-measure that changes a placed cell's
// height (a changed cell, a provisional one, a hole that finally renders)
// replays the positions again from that cell. A changed or provisional cell
// outside the render window but before its end (above the viewport, say)
// is mounted for that one measuring render all the same — otherwise the
// cells in view would sit on its old or estimated height until it was
// scrolled to. Those off-window measurements are capped per frame.
//
// The replay needs the positioner's config, which the library keeps in a
// closure: build the positioner with this module's
// createMasonryCellPositioner, which remembers it. With a bare library
// positioner none of this runs and the base behaviour stands.
//
// ── Cells that render nothing ──────────────────────────────────────────
// A cell whose renderer returns null (an artwork the image measurer hasn't
// sized, or failed to) is placed as a zero-height hole, so the cells behind
// it are not held back. Once it renders, its CellMeasurer measures it and
// the layout past it re-flows. (The base placed the cells measured after
// such a cell out of order and never came back for it.)
//
// ── Motion ─────────────────────────────────────────────────────────────
// After a relayout, cells that were placed in the previous render glide to
// their new place (a transform transition, RELAYOUT_MS); a cell new to the
// list scales and fades in where it lands. A cell whose key is in the
// `exitingKeys` prop scales down and fades out in place, both at once
// (EXIT_MS); the page drops its row afterwards (useCellExit in
// hooks/useMasonryGrid) and the cells past it glide into the gap. A cell
// coming out of the measuring pass has no on-screen position to move from,
// so it never takes a transition. Cells are emitted in index order rather
// than the position cache's column order: a keyed reorder moves DOM nodes,
// and a moved node drops its running transition. A relayout inside the part
// of the list that is still filling in doesn't animate: ImageMeasurer hands
// over items as their images resolve, in list order but skipping the ones
// still loading, so a slow image lands mid-list — gliding the cards past it
// each time would only shuffle the grid while it loads. That part is the
// rows added since the list began to grow, for as long as it keeps growing
// and FILL_QUIET_MS after: the whole grid on a first load, the new page when
// scrolling loads one. A change above it (a new post at the top while a
// page loads) still glides. A delete's own exit plays regardless.

export const RELAYOUT_MS = 320;
export const EXIT_MS = 240;
// Scale a cell shrinks to on its way out (and grows from on its way in).
export const EXIT_SCALE = 0.8;
// Accelerating curve for an element leaving the screen.
const EXIT_EASE = "cubic-bezier(0.4, 0, 1, 1)";
const MOVE_TRANSITION = `transform ${RELAYOUT_MS}ms ${EASE}`;
const ENTER_TRANSITION = `transform ${RELAYOUT_MS}ms ${EASE}, opacity ${RELAYOUT_MS}ms ${EASE}`;
const EXIT_TRANSITION = `transform ${EXIT_MS}ms ${EXIT_EASE}, opacity ${EXIT_MS}ms ${EXIT_EASE}`;
// How long after a relayout placed cells still take the move transition:
// the glide plus the measuring passes that settle the layout.
const MOTION_WINDOW_MS = RELAYOUT_MS + 200;
// How long the list has to stop growing before relayouts among the rows it
// added animate again — see "Motion".
const FILL_QUIET_MS = 1000;
// Most cells outside the render window mounted per animation frame just to
// be measured; the rest follow in the next frames (a long run of them — the
// NSFW filter turned off while scrolled deep — would otherwise be one long
// task: the base re-renders after each measuring pass in the same flush).
const OFFSCREEN_MEASURE_BUDGET = 12;
const nextFrame = typeof requestAnimationFrame === "function"
    ? (fn) => requestAnimationFrame(fn)
    : (fn) => setTimeout(fn, 16);
const cancelFrame = typeof cancelAnimationFrame === "function"
    ? (id) => cancelAnimationFrame(id)
    : (id) => clearTimeout(id);

// How each cell key was placed, remembered for the next render.
const PLACED = 1;
const ENTERING = 2;
const EXITING = 3;

// What an index past a change held, carried over to the cell's new index.
const HELD_MEASURED = 1;
const HELD_PENDING = 2;
const HELD_HOLE = 3;

// Library positioner that remembers its config (initial and every reset),
// so MasonryExtended can replay it. Drop-in for the library export.
export const createMasonryCellPositioner = (config) => {
    const positioner = createBaseCellPositioner(config);
    const reset = positioner.reset;
    positioner.config = config;
    positioner.reset = (params) => {
        positioner.config = params;
        reset(params);
    };
    return positioner;
};

class MasonryExtended extends Masonry {
    constructor(props) {
        super(props);
        // base style object → { style, transform, top, left, + motion
        // variants }. A WeakMap on the base's own cached objects: when the
        // base drops or replaces one (geometry change, clearCellPositions),
        // ours goes with it.
        this._transformStyles = new WeakMap();
        this._rawCellRenderer = null;
        this._wrappedCellRenderer = (params) => this._renderCell(params);

        // ── Relayout bookkeeping ──
        this._relayoutOn = false;
        this._laidCache = null;
        this._laidPositioner = null;
        this._laidIds = [];        // keyMapper(i) as of the last render
        this._laidShapes = [];     // cellLayoutKey(i) as of the last render
        this._placedHeights = [];  // height each placed index was placed with
        this._placedLefts = [];
        this._placedTops = [];
        // Placed with a height its CellMeasurer has yet to confirm (a changed
        // cell's old height, a new cell's default one): index → height. Its
        // cache entry stays empty, so the CellMeasurer measures it in place.
        this._pendingHeights = new Map();
        this._fresh = new Set();   // pending cells new to the list (no measurement yet)
        this._holes = new Set();   // placed as zero-height (renders nothing)
        this._nullAt = new Set();  // indices whose renderer returned nothing this render
        this._renderedAt = new Set(); // placed indices rendered this render

        // ── Motion bookkeeping ──
        this._vnodeIndex = new WeakMap(); // element → index, for ordering
        this._prevPlaced = new Map();     // key → PLACED | ENTERING | EXITING, last commit
        this._curPlaced = null;
        this._motionUntil = 0;
        this._motionFrom = 0;
        this._motion = false;
        // The rows still filling in (see "Motion"): from `_fillFrom` on, while
        // the list grew less than FILL_QUIET_MS ago (`_fillAt`).
        this._fillFrom = 0;
        this._fillAt = 0;
        this._lastExitingKeys = undefined;
        this._offscreenBudget = OFFSCREEN_MEASURE_BUDGET;
        this._offscreenFrame = 0;
        this._offscreenDeferred = false;
    }

    _canRelayout() {
        const { cellMeasurerCache, cellPositioner } = this.props;
        return !!(cellMeasurerCache && cellPositioner && cellPositioner.config
            && typeof cellPositioner.reset === "function");
    }

    render() {
        const { cellMeasurerCache, cellPositioner, height, width, style, exitingKeys } = this.props;
        if (!cellMeasurerCache || !cellPositioner) {
            return (
                <div
                    style={{
                        boxSizing: "border-box",
                        height,
                        width,
                        position: "relative",
                        overflow: "hidden",
                        ...style,
                    }}
                />
            );
        }
        this._reconcileLayout();
        if (exitingKeys !== this._lastExitingKeys) {
            // Elements cached while scrolling carry their previous style.
            this._lastExitingKeys = exitingKeys;
            this._cellCache.clear();
        }
        this._nullAt.clear();
        this._renderedAt.clear();
        this._motion = Date.now() < this._motionUntil;
        this._curPlaced = new Map();
        // The base render reads `this.props.cellRenderer` — hand it the
        // wrapper for the duration of that one synchronous call, then put
        // the real props back so everything outside render (the
        // PureComponent compare, componentDidUpdate's prevProps, the
        // pages' `masonry.props.itemsWithSizes` reads) sees them untouched.
        const raw = this.props;
        this._rawCellRenderer = raw.cellRenderer;
        this.props = { ...raw, cellRenderer: this._wrappedCellRenderer };
        let out;
        try {
            out = super.render();
        } finally {
            this.props = raw;
        }
        this._carryCachedPlacements();
        this._measureOffscreen(out);
        this._orderChildren(out);
        return out;
    }

    componentDidMount() {
        super.componentDidMount();
        this._afterCommit();
    }

    componentDidUpdate(prevProps, prevState) {
        super.componentDidUpdate(prevProps, prevState);
        this._afterCommit();
    }

    componentWillUnmount() {
        super.componentWillUnmount();
        if (this._offscreenFrame) cancelFrame(this._offscreenFrame);
        this._offscreenFrame = 0;
    }

    // Full reset (layout change, list replaced): nothing laid out survives.
    clearCellPositions() {
        this._resetLayoutState();
        super.clearCellPositions();
    }

    // ── Cell wrapper ───────────────────────────────────────────────────
    _renderCell(params) {
        const raw = this._rawCellRenderer;
        const base = params.style;
        const index = params.index;
        // Measurement pass — no position yet. The page's renderer sees the
        // `{ width }` style as always and no `top` / `left` params.
        if (!base || base.top === undefined) {
            // Already measured and only waiting on an earlier cell to be
            // placed: nothing to measure, and unplaced it would sit in flow
            // on top of the grid.
            if (this._relayoutOn && this.props.cellMeasurerCache.has(index)) return null;
            return this._note(raw(params), index);
        }
        this._renderedAt.add(index);
        if (!this.props.useTransform) return this._note(raw(params), index);
        let entry = this._transformStyles.get(base);
        if (entry === undefined) {
            const rtl = base.right !== undefined;
            const left = rtl ? base.right : base.left;
            const top = base.top;
            const transform = "translate3d(" + (rtl ? -left : left) + "px, " + top + "px, 0)";
            const style = { height: base.height, width: base.width, position: "absolute", top: 0 };
            style[rtl ? "right" : "left"] = 0;
            style.transform = transform;
            entry = { style, transform, top, left };
            this._transformStyles.set(base, entry);
        }
        const key = params.key;
        const exitingKeys = this.props.exitingKeys;
        const prev = this._prevPlaced.get(key);
        let kind = PLACED;
        let style;
        if (exitingKeys && exitingKeys.has(key)) {
            kind = EXITING;
            style = entry.exit || (entry.exit = {
                ...entry.style,
                transform: entry.transform + " scale(" + EXIT_SCALE + ")",
                opacity: 0,
                pointerEvents: "none",
                transition: EXIT_TRANSITION,
            });
        } else if (!this._motion || index < this._motionFrom) {
            style = entry.style;
        } else if (prev === undefined) {
            // Not on screen a render ago. A cell new to the list (placed
            // with a provisional height) starts small and transparent; the
            // render that settles its height grows and fades it in.
            if (this._fresh.has(index)) {
                kind = ENTERING;
                style = entry.enter || (entry.enter = {
                    ...entry.style,
                    transform: entry.transform + " scale(" + EXIT_SCALE + ")",
                    opacity: 0,
                });
            } else {
                style = entry.style;
            }
        } else if (prev === ENTERING) {
            style = entry.enterIn || (entry.enterIn = { ...entry.style, transition: ENTER_TRANSITION });
        } else {
            style = entry.moving || (entry.moving = { ...entry.style, transition: MOVE_TRANSITION });
        }
        // A cell awaiting its re-measure has an empty cache entry, so the
        // base sized its box at the default height: keep the one it was
        // placed with.
        if (this._pendingHeights.has(index) && style.height !== this._placedHeights[index]) {
            style = { ...style, height: this._placedHeights[index] };
        }
        this._curPlaced.set(key, kind);
        return this._note(raw({ ...params, style, top: entry.top, left: entry.left }), index);
    }

    _note(element, index) {
        if (element == null || element === false) this._nullAt.add(index);
        else if (typeof element === "object") this._vnodeIndex.set(element, index);
        return element;
    }

    // While scrolling the base reuses cached elements without calling the
    // renderer: those cells are still placed where they were.
    _carryCachedPlacements() {
        if (!this.state.isScrolling) return;
        const cur = this._curPlaced;
        const cached = this._cellCache;
        this._prevPlaced.forEach((kind, key) => {
            if (!cur.has(key) && cached.has(key)) cur.set(key, kind);
        });
    }

    // A changed or provisional cell outside the render window, but before
    // its end — above the viewport, say, or in a shorter column beside it —
    // would keep its old or estimated height until scrolled to, with every
    // cell past it off by the error, the ones in view included. Mount it
    // where it was placed for one render: its CellMeasurer measures it, the
    // layout past it settles before paint, and the next render leaves it out
    // of the window like any other cell. Cells past the window's end move
    // nothing in view and are measured when they get there.
    _measureOffscreen(out) {
        // The window's last index as the base computed it — cells it reused
        // from its scroll cache included, which never pass through us.
        const windowEnd = this._renderedRangeStop;
        if (!this._relayoutOn || this._pendingHeights.size === 0 || windowEnd < 0) return;
        const inner = out && out.props && out.props.children;
        const list = inner && inner.props && inner.props.children;
        if (!Array.isArray(list)) return;
        const { keyMapper, cellMeasurerCache: cache, rowDirection } = this.props;
        const scrolling = this.state.isScrolling;
        const side = rowDirection === "rtl" ? "right" : "left";
        this._pendingHeights.forEach((h, i) => {
            if (i > windowEnd || this._renderedAt.has(i)) return;
            const key = keyMapper(i);
            // Pushed from the base's scroll cache without passing through us.
            if (scrolling && this._cellCache.has(key)) return;
            if (!this._spendOffscreen()) return;
            // The base's own style object for a placed cell (same cache, same
            // shape), so the transform wrapper treats it like any other.
            const left = this._placedLefts[i];
            const top = this._placedTops[i];
            const width = cache.getWidth(i);
            const height = cache.getHeight(i);
            const cached = this._styleCache.get(i);
            let style;
            if (cached !== undefined && cached.left === left && cached.top === top && cached.width === width && cached.height === height) {
                style = cached.style;
            } else {
                style = { height, position: "absolute", top, width };
                style[side] = left;
                this._styleCache.set(i, { left, top, width, height, style });
            }
            const element = this._renderCell({ index: i, isScrolling: scrolling, key, parent: this, style });
            if (element != null && element !== false) list.push(element);
        });
    }

    // One off-window mount from this frame's budget. Spent out, the cell
    // waits: the frame that refills the budget renders again.
    _spendOffscreen() {
        if (this._offscreenBudget === 0) {
            this._offscreenDeferred = true;
            return false;
        }
        this._offscreenBudget--;
        if (!this._offscreenFrame) {
            this._offscreenFrame = nextFrame(() => {
                this._offscreenFrame = 0;
                this._offscreenBudget = OFFSCREEN_MEASURE_BUDGET;
                if (this._offscreenDeferred) {
                    this._offscreenDeferred = false;
                    this.forceUpdate();
                }
            });
        }
        return true;
    }

    // Emit the cells in index order (see "Motion"). The base builds
    // <div scroller><div inner>{children}</div></div>; the array is sorted
    // in place before Preact diffs it.
    _orderChildren(out) {
        const inner = out && out.props && out.props.children;
        const list = inner && inner.props && inner.props.children;
        if (!Array.isArray(list) || list.length < 2) return;
        const order = this._vnodeIndex;
        const rank = (v) => {
            const i = v ? order.get(v) : undefined;
            return i === undefined ? Infinity : i;
        };
        let last = -Infinity;
        let sorted = true;
        for (let i = 0; i < list.length; i++) {
            const r = rank(list[i]);
            if (r < last) { sorted = false; break; }
            last = r;
        }
        if (sorted) return;
        const ranked = list.map((v, i) => ({ v, r: rank(v), i }));
        ranked.sort((a, b) => (a.r === b.r ? a.i - b.i : a.r < b.r ? -1 : 1));
        for (let i = 0; i < ranked.length; i++) list[i] = ranked[i].v;
    }

    // ── Relayout ───────────────────────────────────────────────────────
    _resetLayoutState() {
        this._laidIds = [];
        this._laidShapes = [];
        this._placedHeights = [];
        this._placedLefts = [];
        this._placedTops = [];
        this._pendingHeights.clear();
        this._fresh.clear();
        this._holes.clear();
        this._prevPlaced = new Map();
        this._motionUntil = 0;
        this._fillFrom = 0;
        this._fillAt = 0;
    }

    // Rows new to the list came in, the first of them no earlier than
    // `start` — the index just past the last row that was there before them.
    // After a pause that starts a new fill there; within FILL_QUIET_MS of
    // the last new rows it extends the current one.
    _noteAdded(start) {
        const now = Date.now();
        if (now - this._fillAt >= FILL_QUIET_MS || start < this._fillFrom) this._fillFrom = start;
        this._fillAt = now;
    }

    _snapshot(n, start) {
        const { keyMapper, cellLayoutKey } = this.props;
        const ids = this._laidIds;
        const shapes = this._laidShapes;
        ids.length = n;
        shapes.length = n;
        for (let i = start; i < n; i++) {
            ids[i] = keyMapper(i);
            shapes[i] = cellLayoutKey ? cellLayoutKey(i) : undefined;
        }
    }

    _reconcileLayout() {
        const { cellCount, cellMeasurerCache, cellPositioner, keyMapper, cellLayoutKey } = this.props;
        const n = cellCount | 0;
        this._relayoutOn = this._canRelayout();
        if (cellMeasurerCache !== this._laidCache || cellPositioner !== this._laidPositioner) {
            // A new cache or positioner — the first real render, or a layout
            // change the grid hook flushes right after this render. Nothing
            // laid out so far belongs to it.
            this._laidCache = cellMeasurerCache;
            this._laidPositioner = cellPositioner;
            this._resetLayoutState();
            this._snapshot(n, 0);
            if (n > 0) this._noteAdded(0);
            return;
        }
        const ids = this._laidIds;
        const shapes = this._laidShapes;
        const prevN = ids.length;
        let from = -1;
        for (let i = 0, m = Math.min(n, prevN); i < m; i++) {
            if (keyMapper(i) !== ids[i] || (cellLayoutKey && cellLayoutKey(i) !== shapes[i])) {
                from = i;
                break;
            }
        }
        if (from === -1) {
            if (n >= prevN) {
                // Unchanged, or rows appended: the measuring pass handles those.
                if (n > prevN) {
                    this._snapshot(n, prevN);
                    this._noteAdded(prevN);
                }
                return;
            }
            from = n; // rows removed from the tail
        }
        if (!this._relayoutOn) {
            this._snapshot(n, 0);
            return;
        }
        const prevIds = ids.slice();
        const prevShapes = shapes.slice();
        this._snapshot(n, from);
        this._relayoutFrom(from, prevIds, prevShapes);
    }

    _relayoutFrom(from, prevIds, prevShapes) {
        const cache = this.props.cellMeasurerCache;
        const ids = this._laidIds;
        const shapes = this._laidShapes;
        const prevN = prevIds.length;
        const n = ids.length;
        // What each index past the change held, by cell identity.
        const held = new Map();
        const before = new Set();
        for (let i = from; i < prevN; i++) {
            const id = prevIds[i];
            before.add(id);
            if (held.has(id)) continue;
            if (cache.has(i)) held.set(id, { kind: HELD_MEASURED, height: cache.getHeight(i), shape: prevShapes[i] });
            else if (this._pendingHeights.has(i)) held.set(id, { kind: HELD_PENDING, height: this._pendingHeights.get(i), shape: prevShapes[i], fresh: this._fresh.has(i) });
            else if (this._holes.has(i)) held.set(id, { kind: HELD_HOLE, shape: prevShapes[i] });
        }
        for (let i = from; i < prevN; i++) {
            if (cache.has(i)) cache.clear(i, 0);
        }
        this._pendingHeights.forEach((h, i) => { if (i >= from) this._pendingHeights.delete(i); });
        this._fresh.forEach((i) => { if (i >= from) this._fresh.delete(i); });
        this._holes.forEach((i) => { if (i >= from) this._holes.delete(i); });
        // Last render's "rendered nothing" is per index; the holes that are
        // still holes were carried over above.
        this._nullAt.clear();
        // Seat it again under the index each cell sits at now.
        const width = cache.defaultWidth;
        let added = false;
        let lastBefore = from - 1;
        for (let i = from; i < n; i++) {
            if (before.has(ids[i])) lastBefore = i;
            else added = true;
            const e = held.get(ids[i]);
            if (e === undefined) continue; // new to the list, or never measured
            held.delete(ids[i]);
            const same = e.shape === shapes[i];
            if (e.kind === HELD_HOLE) {
                if (same) this._holes.add(i);
            } else if (e.kind === HELD_MEASURED && same) {
                cache.set(i, 0, width, e.height);
            } else {
                // Changed (or still unconfirmed): placed at its old height
                // until its CellMeasurer has measured it in place.
                this._pendingHeights.set(i, e.height);
                if (e.fresh && same) this._fresh.add(i);
            }
        }
        if (added) this._noteAdded(lastBefore + 1);
        this._replay(from);
    }

    // Re-place every cell from index 0 with the positioner reset.
    _replay(from) {
        const positioner = this.props.cellPositioner;
        positioner.reset(positioner.config);
        this._positionCache = new this._positionCache.constructor();
        this._placedHeights.length = 0;
        this._placedLefts.length = 0;
        this._placedTops.length = 0;
        this._cellCache.clear();
        this._advanceFrontier();
        // Cells before `from` land exactly where they were: only the ones
        // from the first change on take the motion styles — and none when
        // the change is among the rows still filling in.
        const now = Date.now();
        if (from < this._fillFrom || now - this._fillAt >= FILL_QUIET_MS) {
            this._motionFrom = now < this._motionUntil ? Math.min(this._motionFrom, from) : from;
            this._motionUntil = now + MOTION_WINDOW_MS;
        }
        const onRelayout = this.props.onRelayout;
        if (onRelayout) onRelayout(from);
    }

    // Place cells strictly in index order, from the first unplaced one, for
    // as long as their height is known. The base's measuring pass picks up
    // from where this stops (it starts at the position cache's count).
    _advanceFrontier() {
        const { cellCount, cellMeasurerCache: cache, cellPositioner } = this.props;
        const n = cellCount | 0;
        const width = cache.defaultWidth;
        const start = this._positionCache.count;
        let lastKnown;
        for (let i = start; i < n; i++) {
            if (cache.has(i)) {
                this._pendingHeights.delete(i);
                this._fresh.delete(i);
                this._holes.delete(i);
                const at = cellPositioner(i);
                this._setPlaced(i, at.left, at.top, cache.getHeight(i));
                continue;
            }
            if (this._holes.has(i) || this._nullAt.has(i)) {
                // Renders nothing: zero height, beside the cell before it.
                this._holes.add(i);
                this._setPlaced(i, i > 0 ? this._placedLefts[i - 1] : 0, i > 0 ? this._placedTops[i - 1] : 0, 0);
                continue;
            }
            let height = this._pendingHeights.get(i);
            if (height === undefined) {
                // Unmeasured. Place it provisionally only when known cells
                // follow it (a cell inserted mid-list); at the end of the
                // list the measuring pass measures it first, as always.
                if (lastKnown === undefined) lastKnown = this._lastKnownIndex(n);
                if (lastKnown <= i) break;
                height = cache.defaultHeight;
                this._pendingHeights.set(i, height);
                this._fresh.add(i);
            }
            // The positioner reads heights from the cache: seat the
            // provisional one for the call, then leave the entry empty so
            // the CellMeasurer measures the cell.
            cache.set(i, 0, width, height);
            const at = cellPositioner(i);
            cache.clear(i, 0);
            this._setPlaced(i, at.left, at.top, height);
        }
        return this._positionCache.count > start;
    }

    _setPlaced(i, left, top, height) {
        this._positionCache.setPosition(i, left, top, height);
        this._placedLefts[i] = left;
        this._placedTops[i] = top;
        this._placedHeights[i] = height;
    }

    _lastKnownIndex(n) {
        const cache = this.props.cellMeasurerCache;
        for (let i = n - 1; i >= 0; i--) {
            if (cache.has(i) || this._pendingHeights.has(i)) return i;
        }
        return -1;
    }

    // Called by the base (componentDidUpdate → _checkInvalidateOnUpdate)
    // with the range of cells its CellMeasurers just measured.
    _populatePositionCache(startIndex, stopIndex) {
        if (!this._relayoutOn) {
            super._populatePositionCache(startIndex, stopIndex);
            return;
        }
        const cache = this.props.cellMeasurerCache;
        const frontier = this._positionCache.count;
        // Measured while already placed: a changed or provisional cell, or
        // a hole that rendered at last. Re-flow from it if it moved.
        let dirty = -1;
        for (let i = Math.max(0, startIndex), end = Math.min(stopIndex, frontier - 1); i <= end; i++) {
            if (!cache.has(i)) continue;
            const wasPending = this._pendingHeights.delete(i);
            const wasHole = this._holes.delete(i);
            this._fresh.delete(i);
            // The element the base cached while scrolling still carries the
            // provisional box (and an entering cell's start style).
            if (wasPending || wasHole) this._cellCache.delete(this.props.keyMapper(i));
            if (dirty === -1 && cache.getHeight(i) !== this._placedHeights[i]) dirty = i;
        }
        if (dirty !== -1) this._replay(dirty);
        else this._advanceFrontier();
    }

    _afterCommit() {
        if (this._curPlaced) {
            this._prevPlaced = this._curPlaced;
            this._curPlaced = null;
        }
        if (!this._relayoutOn) return;
        const cache = this.props.cellMeasurerCache;
        // Placed provisionally but rendered nothing: a hole after all.
        let from = -1;
        this._nullAt.forEach((i) => {
            if (this._pendingHeights.has(i) && !cache.has(i)) {
                this._pendingHeights.delete(i);
                this._fresh.delete(i);
                this._holes.add(i);
                if (from === -1 || i < from) from = i;
            }
        });
        if (from !== -1) {
            this._replay(from);
            this.forceUpdate();
            return;
        }
        // The measuring pass stopped on a cell that renders nothing: step
        // over it so the cells behind it get measured and placed.
        const count = this._positionCache.count;
        if (count < (this.props.cellCount | 0) && this._nullAt.has(count) && this._advanceFrontier()) {
            this.forceUpdate();
        }
    }

    _getEstimatedTotalHeight() {
        const { cellCount, cellMeasurerCache, width } = this.props;
        if (!cellMeasurerCache) return 0;
        const estimatedColumnCount = Math.max(
            1,
            Math.floor(width / (cellMeasurerCache.defaultWidth || 1)),
        );
        const estimate = this._positionCache.estimateTotalHeight(
            cellCount,
            estimatedColumnCount,
            cellMeasurerCache.defaultHeight || 0,
        );
        return isFinite(estimate) ? estimate : 0;
    }
}

// Static defaultProps are inherited through the constructor chain, so this
// restates the base set to add one flag; a page can still pass
// `useTransform={false}` to opt out.
//
// Further optional props (all stable references on the pages' side):
//   cellLayoutKey(index)  what the cell's height depends on, compared with
//                         `===` (see "Relayout past a change")
//   exitingKeys           Set of cell keys playing their exit
//   onRelayout(from)      cells from `from` on were re-placed; the pages
//                         drop the positions they tracked past it. Called
//                         during render: refs only, no setState.
MasonryExtended.defaultProps = { ...Masonry.defaultProps, useTransform: true };

export default MasonryExtended;