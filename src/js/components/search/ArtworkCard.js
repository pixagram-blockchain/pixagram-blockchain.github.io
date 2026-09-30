"use strict";
import React, { useCallback, useMemo, useState } from "preact/compat";
import Tooltip from "@material-ui/core/Tooltip";
import withStyles from "@material-ui/core/styles/withStyles";

import { ARTWORK_RADIUS } from "./config";

// ── ArtworkCard ───────────────────────────────────────────────────────────────
// The simplest possible card: the image, rounded corners, nothing else — no
// title, no overlay, no shadow. The box reserves the artwork's aspect ratio
// from the search index (width/height are known before the image loads), so
// the masonry never shifts while thumbnails stream in. The native WebP is the
// source (a few KB); it is scaled with the browser's default smooth
// interpolation, since the thumbnails are smaller than the artwork and
// nearest-neighbour downscaling would alias.
//
// Hovering (or focusing) a card shows a tooltip above it: the title, then
// "@author" on the line below — the same "@author · …" line as the post rows.

// Same faces as the post rows: "Industry Book" for the title, "Normative Pro" under it.
const TIP_TITLE = {
    display: "block", fontFamily: '"Industry Book"', fontSize: 14, letterSpacing: 0.2, lineHeight: 1.3,
    color: "#202020", overflowWrap: "anywhere",
};
const TIP_META = {
    display: "block", fontFamily: '"Normative Pro"', fontSize: 12, lineHeight: 1.35, color: "#101010", marginTop: 2,
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
};

// One step darker than the dropdown so it reads over the cards; 8 px off the card.
const ArtworkTooltip = withStyles({
    tooltip: {
        backgroundColor: "#111111",
        color: "#dddddd",
        padding: "6px 10px",
        borderRadius: 8,
        maxWidth: 260,
        boxShadow: "0 6px 18px rgba(0,0,0,0.45)",
    },
    tooltipPlacementTop: { margin: "8px 0" },
    tooltipPlacementBottom: { margin: "8px 0" },
})(Tooltip);

/** The tooltip's content. Only rendered while the tooltip is open. */
function ArtworkTip({ item }) {
    return (
        <React.Fragment>
            {item.title ? <span style={TIP_TITLE}>{item.title}</span> : null}
            <span style={TIP_META}>@{item.author}</span>
        </React.Fragment>
    );
}

export const ArtworkCard = React.memo(
    ({ item, onOpen }) => {
        const [loaded, setLoaded] = useState(false);
        const [failed, setFailed] = useState(false);
        const onClick = useCallback(() => onOpen(item), [onOpen, item]);
        const onLoad = useCallback(() => setLoaded(true), []);
        const onError = useCallback(() => setFailed(true), []);
        const tip = useMemo(() => <ArtworkTip item={item} />, [item]);
        if (failed) return null;
        return (
            <ArtworkTooltip title={tip} placement="top" enterDelay={300}>
                <div
                    role="button"
                    tabIndex={0}
                    onClick={onClick}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
                    style={{
                        position: "relative",
                        width: "100%",
                        aspectRatio: `${item.width || 1} / ${item.height || 1}`,
                        borderRadius: ARTWORK_RADIUS,
                        overflow: "hidden",
                        backgroundColor: loaded ? "transparent" : "#2e2e2e",
                        cursor: "pointer",
                        outline: "none",
                    }}
                >
                    <img
                        src={item.src}
                        alt={item.title || ""}
                        width={item.width || undefined}
                        height={item.height || undefined}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                        onLoad={onLoad}
                        onError={onError}
                        style={{
                            display: "block",
                            width: "100%",
                            height: "100%",
                            objectFit: "fill",
                            opacity: loaded ? 1 : 0,
                            transition: "opacity 120ms linear",
                            userSelect: "none",
                        }}
                    />
                </div>
            </ArtworkTooltip>
        );
    },
    (prev, next) => prev.item === next.item && prev.onOpen === next.onOpen,
);