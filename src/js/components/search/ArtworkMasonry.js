"use strict";
import React, { useMemo } from "preact/compat";

import { MASONRY_COLUMNS, MASONRY_GAP } from "./config";
import { ArtworkCard } from "./ArtworkCard";

// ── ArtworkMasonry ────────────────────────────────────────────────────────────
// Two equal-width columns. Because every item's aspect ratio is known up front
// (from the search index), the layout is computed, not measured: each card
// goes to the currently shortest column, heights counted in aspect units.
// Deterministic, no layout thrash, no library.

function distribute(items, columns) {
    const cols = Array.from({ length: columns }, () => ({ items: [], height: 0 }));
    for (const item of items) {
        let target = cols[0];
        for (const c of cols) if (c.height < target.height) target = c;
        target.items.push(item);
        target.height += (item.aspect || 1) + 0.04; // + gap, in column-width units
    }
    return cols.map((c) => c.items);
}

export const ArtworkMasonry = React.memo(
    ({ items, onOpen, columns = MASONRY_COLUMNS, gap = MASONRY_GAP }) => {
        const cols = useMemo(() => distribute(items, columns), [items, columns]);
        if (!items.length) return null;
        return (
            <div style={{ display: "flex", gap, alignItems: "flex-start", padding: `4px 0 ${gap + 6}px 0` }}>
                {cols.map((col, i) => (
                    <div key={i} style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", gap }}>
                        {col.map((item) => (
                            <ArtworkCard key={item.id} item={item} onOpen={onOpen} />
                        ))}
                    </div>
                ))}
            </div>
        );
    },
    (prev, next) =>
        prev.items === next.items &&
        prev.onOpen === next.onOpen &&
        prev.columns === next.columns &&
        prev.gap === next.gap,
);
