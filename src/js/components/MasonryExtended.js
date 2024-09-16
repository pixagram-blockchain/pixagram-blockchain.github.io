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

class MasonryExtended extends Masonry {
    render() {
        const { cellMeasurerCache, cellPositioner, height, width, style } = this.props;
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
        return super.render();
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

export default MasonryExtended;
