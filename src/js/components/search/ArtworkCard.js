"use strict";
import React, { useCallback, useState } from "preact/compat";

import { ARTWORK_RADIUS } from "./config";

// ── ArtworkCard ───────────────────────────────────────────────────────────────
// The simplest possible card: the image, rounded corners, nothing else — no
// title, no overlay, no shadow. The box reserves the artwork's aspect ratio
// from the search index (width/height are known before the image loads), so
// the masonry never shifts while thumbnails stream in. The native WebP is the
// source (a few KB); it is scaled with the browser's default smooth
// interpolation, since the thumbnails are smaller than the artwork and
// nearest-neighbour downscaling would alias.

export const ArtworkCard = React.memo(
    ({ item, onOpen }) => {
        const [loaded, setLoaded] = useState(false);
        const [failed, setFailed] = useState(false);
        const onClick = useCallback(() => onOpen(item), [onOpen, item]);
        const onLoad = useCallback(() => setLoaded(true), []);
        const onError = useCallback(() => setFailed(true), []);
        if (failed) return null;
        return (
            <div
                role="button"
                tabIndex={0}
                onClick={onClick}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
                title={item.title || undefined}
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
        );
    },
    (prev, next) => prev.item === next.item && prev.onOpen === next.onOpen,
);
