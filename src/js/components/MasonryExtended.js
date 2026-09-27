"use strict";

import * as React from "preact/compat";
import { Masonry } from "@pixagram/virtualized/dist/es/index";

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
//     transform object per base style object, so a cell keeps a stable
//     style identity for as long as the base does and memo'd cards bail
//     on it — and passes the placed offsets along as the `top` / `left`
//     params. That is what the pages' position tracking and visibility
//     bands read (never `style.top`, which is 0 in this mode). The
//     measurement pass (a `{ width }`-only style, no position yet) goes
//     through untouched, and `useTransform={false}` bypasses the wrapper
//     for the upstream style shape.
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

class MasonryExtended extends Masonry {
    constructor(props) {
        super(props);
        // base style object → { style: transform style, top, left }. A
        // WeakMap on the base's own cached objects: when the base drops or
        // replaces one (geometry change, clearCellPositions), ours goes
        // with it.
        this._transformStyles = new WeakMap();
        this._rawCellRenderer = null;
        this._transformCellRenderer = (params) => this._renderTransformCell(params);
    }

    _renderTransformCell(params) {
        const raw = this._rawCellRenderer;
        const base = params.style;
        // Measurement pass — no position yet. The page's renderer sees the
        // `{ width }` style as always and no `top` / `left` params.
        if (!base || base.top === undefined) return raw(params);
        let entry = this._transformStyles.get(base);
        if (entry === undefined) {
            const rtl = base.right !== undefined;
            const left = rtl ? base.right : base.left;
            const top = base.top;
            const style = { height: base.height, width: base.width, position: "absolute", top: 0 };
            style[rtl ? "right" : "left"] = 0;
            style.transform = "translate3d(" + (rtl ? -left : left) + "px, " + top + "px, 0)";
            entry = { style, top, left };
            this._transformStyles.set(base, entry);
        }
        return raw({ ...params, style: entry.style, top: entry.top, left: entry.left });
    }

    render() {
        const { cellMeasurerCache, cellPositioner, height, width, style, useTransform } = this.props;
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
        if (!useTransform) return super.render();
        // The base render reads `this.props.cellRenderer` — hand it the
        // wrapper for the duration of that one synchronous call, then put
        // the real props back so everything outside render (the
        // PureComponent compare, componentDidUpdate's prevProps, the
        // pages' `masonry.props.itemsWithSizes` reads) sees them untouched.
        const raw = this.props;
        this._rawCellRenderer = raw.cellRenderer;
        this.props = { ...raw, cellRenderer: this._transformCellRenderer };
        try {
            return super.render();
        } finally {
            this.props = raw;
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
MasonryExtended.defaultProps = { ...Masonry.defaultProps, useTransform: true };

export default MasonryExtended;