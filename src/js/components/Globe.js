import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import createGlobe from "cobe";
import CircularProgress from "@material-ui/core/CircularProgress";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import CheckIcon from "@material-ui/icons/Check";
import LinkOffIcon from "@material-ui/icons/LinkOff";
import { DEFAULT_NODES } from "../utils/constants";

import { t } from "../utils/text";

/**
 * Globe.js — Witness Node Globe Selector (cobe v2)
 *
 * v2 API: no onRender. Call globe.update() in a rAF loop.
 * Markers/arcs update dynamically via globe.update({ markers, arcs }).
 * Labels use CSS Anchor Positioning (--cobe-{id}).
 *
 * Sizing: the globe fills its container width (square) and is re-created on
 * resize via ResizeObserver. Dragging is captured globally on `window`, so the
 * drag area is the whole screen rather than just the canvas bounds.
 *
 * Node list: a selectable list sits next to the globe (below it on narrow
 * screens) and shares the labels' click handler. Labels of geographically
 * close nodes overlap on the sphere; list rows never do. The active node's
 * row shows a check icon at the right.
 */

const FONT_FAMILY = '"Industry Book", "Normative Pro"';

// ── Node-list styles (module scope — static, never re-created per render) ──
const S_GLOBE_ROW = {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    gap: 12,
};

const S_LIST = {
    flex: "1 1 210px",
    minWidth: 200,
    maxWidth: 340,
    overflowY: "auto",
    padding: "0px 16px",
    boxSizing: "border-box",
};

const S_LIST_ITEM = {
    borderRadius: 6,
    padding: "5px 8px",
    marginBottom: 2,
    color: "#ffffff",   // drives the ButtonBase ripple/focus tint on the dark bg
};

const S_ITEM_PRIMARY = {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    lineHeight: 1.25,
};

const S_ITEM_SECONDARY = {
    fontFamily: FONT_FAMILY,
    fontSize: 10.5,
    color: "#8a8a8a",
    lineHeight: 1.25,
};

const S_ITEM_PING = {
    fontFamily: FONT_FAMILY,
    fontSize: 10,
    color: "#999",
    fontWeight: 500,
    minWidth: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    flexShrink: 0,
};

const S_ITEM_CHECK = {
    width: 24,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    flexShrink: 0,
};

// Hostname for a list row's secondary line — falls back to the raw URL when it
// doesn't parse (same spirit as selectedNode's "Custom" fallback below).
const nodeHost = (url) => {
    try { return new URL(url).hostname; } catch (e) { return url || ""; }
};

// ── Locale → approximate location (no geolocation permission) ──────────
// ISO 3166-1 alpha-2 region → approximate [lat, lng]
const REGION_COORDS = {
    CH: [46.80, 8.23], DE: [51.16, 10.45], FR: [46.60, 2.21], IT: [41.87, 12.57],
    AT: [47.52, 14.55], LU: [49.61, 6.13], BE: [50.50, 4.47], NL: [52.13, 5.29],
    GB: [55.38, -3.44], IE: [53.41, -8.24], ES: [40.46, -3.75], PT: [39.40, -8.22],
    PL: [51.92, 19.15], CZ: [49.82, 15.47], SK: [48.67, 19.70], HU: [47.16, 19.50],
    RO: [45.94, 24.97], BG: [42.73, 25.49], GR: [39.07, 21.82], HR: [45.10, 15.20],
    SI: [46.15, 14.99], RS: [44.02, 21.01], UA: [48.38, 31.17], RU: [55.75, 37.62],
    SE: [60.13, 18.64], NO: [60.47, 8.47], FI: [61.92, 25.75], DK: [56.26, 9.50],
    IS: [64.96, -19.02], EE: [58.60, 25.01], LV: [56.88, 24.60], LT: [55.17, 23.88],
    CH_ALT: [46.80, 8.23], TR: [38.96, 35.24], US: [39.83, -98.58], CA: [56.13, -106.35],
    MX: [23.63, -102.55], BR: [-14.24, -51.93], AR: [-38.42, -63.62], CL: [-35.68, -71.54],
    CO: [4.57, -74.30], PE: [-9.19, -75.02], CN: [35.86, 104.20], JP: [36.20, 138.25],
    KR: [35.91, 127.77], IN: [20.59, 78.96], ID: [-0.79, 113.92], TH: [15.87, 100.99],
    VN: [14.06, 108.28], PH: [12.88, 121.77], MY: [4.21, 101.98], SG: [1.35, 103.82],
    AU: [-25.27, 133.78], NZ: [-40.90, 174.89], ZA: [-30.56, 22.94], EG: [26.82, 30.80],
    NG: [9.08, 8.68], KE: [-0.02, 37.91], MA: [31.79, -7.09], IL: [31.05, 34.85],
    SA: [23.89, 45.08], AE: [23.42, 53.85],
};

// language code → fallback region (used when locale has no region subtag)
const LANGUAGE_REGION = {
    en: "GB", fr: "FR", de: "DE", it: "IT", es: "ES", pt: "PT", nl: "NL",
    pl: "PL", cs: "CZ", sk: "SK", hu: "HU", ro: "RO", bg: "BG", el: "GR",
    hr: "HR", sl: "SI", sr: "RS", uk: "UA", ru: "RU", sv: "SE", nb: "NO",
    nn: "NO", no: "NO", fi: "FI", da: "DK", is: "IS", et: "EE", lv: "LV",
    lt: "LT", tr: "TR", zh: "CN", ja: "JP", ko: "KR", hi: "IN", id: "ID",
    th: "TH", vi: "VN", ms: "MY", ar: "SA", he: "IL",
};

function getBrowserLocales(options = {}) {
    const opt = { languageCodeOnly: false, ...options };
    const browserLocales =
        typeof navigator !== "undefined"
            ? (navigator.languages === undefined ? [navigator.language] : navigator.languages)
            : undefined;
    if (!browserLocales) return undefined;
    return browserLocales
        .filter(Boolean)
        .map((locale) => {
            const trimmed = locale.trim();
            return opt.languageCodeOnly ? trimmed.split(/-|_/)[0] : trimmed;
        });
}

function localeToLocation(fallback = [47.3667, 7.35]) {
    const locales = getBrowserLocales() || [];
    for (const loc of locales) {
        const parts = loc.split(/-|_/);
        const lang = (parts[0] || "").toLowerCase();
        // region is the last subtag, but only if it's a 2-letter code
        // (skips script subtags like the "Hant" in zh-Hant-TW)
        let region = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : null;
        if (region && !/^[A-Z]{2}$/.test(region)) region = null;
        if (!region && LANGUAGE_REGION[lang]) region = LANGUAGE_REGION[lang];
        if (region && REGION_COORDS[region]) return REGION_COORDS[region];
    }
    return fallback;
}

// ── Ping utility ──────────────────────────────────────────────────────
async function pingNode(url, timeout = 4000) {
    return new Promise((resolve) => {
        const start = performance.now();
        const controller = new AbortController();
        const timer = setTimeout(() => { controller.abort(); resolve(-1); }, timeout);
        fetch(url, { method: "HEAD", mode: "no-cors", cache: "no-store", signal: controller.signal })
            .then(() => { clearTimeout(timer); resolve(Math.round(performance.now() - start)); })
            .catch(() => { clearTimeout(timer); resolve(-1); });
    });
}

// ── Component ─────────────────────────────────────────────────────────
export default function Globe({
                                  nodes = DEFAULT_NODES,
                                  selectedNodeId,
                                  onNodeSelect,
                                  customUrl = null,   // active URL when selectedNodeId isn't one of `nodes` (a custom endpoint)
                                  size = 300,   // fallback only; the globe now fills its container width
                              }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const globeRef = useRef(null);
    const rafRef = useRef(null);
    const phiRef = useRef(0);
    const pointerInteracting = useRef(null);  // null or startX
    const dragStartPhi = useRef(0);

    // Refs for dynamic data — read in the rAF loop
    const markersRef = useRef([]);
    const arcsRef = useRef([]);

    // Measured square dimension (px). 0 until the container is measured.
    const [dimension, setDimension] = useState(0);

    const [userLocation] = useState(() => localeToLocation());
    const [pings, setPings] = useState({});
    const [pinging, setPinging] = useState(null);

    const selectedNode = useMemo(() => {
        const found = nodes.find((n) => n.id === selectedNodeId);
        if (found) return found;
        // selectedNodeId doesn't match a predefined node — the user is
        // pointed at a custom endpoint. It has no fixed lat/lng so it never
        // gets a globe pin, but the status bar below should still name it.
        if (customUrl) {
            let label = "Custom";
            try { label = new URL(customUrl).hostname; } catch (e) { /* keep "Custom" */ }
            return { id: selectedNodeId || "custom", name: label, url: customUrl };
        }
        return nodes[0];
    }, [nodes, selectedNodeId, customUrl]);

    // Same resolution rule as the globe labels/markers: fall back to the first
    // node when nothing is selected. While a custom endpoint is active the id
    // matches no row, so the list correctly shows no check.
    const resolvedSelectedId = selectedNodeId || nodes[0].id;

    // List rows — nodes enriched with a display hostname, memoised on `nodes`
    // so rows aren't re-derived on every ping-state update.
    const listNodes = useMemo(
        () => nodes.map((n) => ({ ...n, host: nodeHost(n.url) })),
        [nodes]
    );

    // ── Auto-ping all nodes on mount ────────────────────────────────
    useEffect(() => {
        nodes.forEach(async (node) => {
            const ms = await pingNode(node.url);
            setPings((prev) => ({ ...prev, [node.id]: ms }));
        });
    }, [nodes]);

    // ── Also ping a custom endpoint, if any, so its status-bar row isn't
    // left blank while it's the active selection ───────────────────────
    useEffect(() => {
        if (!customUrl) return;
        let cancelled = false;
        const key = selectedNodeId || "custom";
        (async () => {
            const ms = await pingNode(customUrl);
            if (!cancelled) setPings((prev) => ({ ...prev, [key]: ms }));
        })();
        return () => { cancelled = true; };
    }, [customUrl, selectedNodeId]);

    // ── Click handler ─────────────────────────────────────────────────
    const handleNodeClick = useCallback(
        async (node) => {
            if (onNodeSelect) onNodeSelect(node.id);
            setPinging(node.id);
            const ms = await pingNode(node.url);
            setPings((prev) => ({ ...prev, [node.id]: ms }));
            setPinging(null);
        },
        [onNodeSelect]
    );

    // ── Keep markers ref in sync (no globe rebuild needed) ────────────
    useEffect(() => {
        const resolvedId = selectedNodeId || nodes[0].id;
        const nodeMarkers = nodes.map((n) => ({
            location: n.location,
            size: n.id === resolvedId ? 0.07 : 0.05,
            color: n.id === resolvedId ? [1.0, 1.0, 1.0] : [0.6, 0.6, 0.6],
            id: n.id,
        }));
        // "You" — the visitor's own approximate location (locale-derived, see
        // localeToLocation above). Greyscale like everything else here: a
        // lighter grey than an unselected node (0.6) but dimmer than the
        // selected node's white (1.0), so it reads as its own thing without
        // relying on hue. Never mistaken for a selectable node: it isn't in
        // `nodes`, has no onNodeSelect handler, and its label isn't clickable.
        markersRef.current = userLocation
            ? [...nodeMarkers, { location: userLocation, size: 0.045, color: [0.8, 0.8, 0.8], id: "you" }]
            : nodeMarkers;
    }, [nodes, selectedNodeId, userLocation]);

    // ── Keep arcs ref in sync ─────────────────────────────────────────
    useEffect(() => {
        // Reuses `selectedNode` (rather than re-deriving it) so a custom
        // endpoint — which has no `.location` — correctly draws no arc
        // instead of silently pointing at nodes[0].
        if (userLocation && selectedNode && selectedNode.location) {
            arcsRef.current = [{
                from: userLocation,
                to: selectedNode.location,
                color: [0.4, 0.4, 0.4],
            }];
        } else {
            arcsRef.current = [];
        }
    }, [userLocation, selectedNode]);

    // ── Measure container width → drives a square globe ───────────────
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const measure = () => {
            const w = Math.round(el.offsetWidth) || size;
            setDimension((prev) => (prev === w ? prev : w));
        };

        measure();

        let ro;
        if (typeof ResizeObserver !== "undefined") {
            ro = new ResizeObserver(measure);
            ro.observe(el);
        } else {
            window.addEventListener("resize", measure);
        }

        return () => {
            if (ro) ro.disconnect();
            else window.removeEventListener("resize", measure);
        };
    }, [size]);

    // ══════════════════════════════════════════════════════════════════
    // Create globe when the measured dimension changes (cobe v2 API).
    // globe.update() pushes new phi/markers/arcs each frame.
    // ══════════════════════════════════════════════════════════════════
    useEffect(() => {
        if (!canvasRef.current || dimension <= 0) return;

        const dpr = window.devicePixelRatio || 1;

        const globe = createGlobe(canvasRef.current, {
            devicePixelRatio: dpr,
            width:  dimension * dpr,
            height: dimension * dpr,
            phi:               0,
            theta:             0.3,
            dark:              1,
            diffuse:           1.2,
            mapSamples:        16000,
            mapBrightness:     6,
            mapBaseBrightness: 0.05,
            scale:             1.0,
            offset:            [0, 0],
            markerElevation:   0.02,
            baseColor:         [1, 1, 1],
            markerColor:       [0.8, 0.8, 0.8],
            glowColor:         [0.1, 0.1, 0.1],
            markers:           markersRef.current,
            arcs:              arcsRef.current,
            arcColor:          [0.4, 0.4, 0.4],
            arcWidth:          1.0,
            arcHeight:         0.3,
        });

        globeRef.current = globe;

        // v2 animation loop
        function animate() {
            if (!globeRef.current) return;

            // Auto-rotate only when not dragging
            if (pointerInteracting.current === null) {
                phiRef.current += 0.003;
            }

            globe.update({
                phi:     phiRef.current,
                markers: markersRef.current,
                arcs:    arcsRef.current,
            });

            rafRef.current = requestAnimationFrame(animate);
        }

        rafRef.current = requestAnimationFrame(animate);

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            globe.destroy();
            globeRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dimension]);

    // ── Drag handlers (whole-screen via window listeners) ─────────────
    const handleWindowMove = useCallback((e) => {
        if (pointerInteracting.current === null) return;
        const clientX =
            e.clientX != null ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        const delta = clientX - pointerInteracting.current;
        phiRef.current = dragStartPhi.current + delta / 200;
    }, []);

    const endDrag = useCallback(() => {
        pointerInteracting.current = null;
        if (canvasRef.current) canvasRef.current.style.cursor = "grab";
        window.removeEventListener("pointermove", handleWindowMove);
        window.removeEventListener("pointerup", endDrag);
    }, [handleWindowMove]);

    const onPointerDown = useCallback((e) => {
        pointerInteracting.current = e.clientX;
        dragStartPhi.current = phiRef.current;
        if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
        window.addEventListener("pointermove", handleWindowMove);
        window.addEventListener("pointerup", endDrag);
    }, [handleWindowMove, endDrag]);

    // Safety: drop any window listeners if we unmount mid-drag
    useEffect(() => () => {
        window.removeEventListener("pointermove", handleWindowMove);
        window.removeEventListener("pointerup", endDrag);
    }, [handleWindowMove, endDrag]);

    // ── Label style ───────────────────────────────────────────────────
    const sLabel = {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        whiteSpace: "nowrap",
        cursor: "pointer",
        padding: "2px 7px",
        borderRadius: 3,
        transition: "opacity .3s",
        pointerEvents: "auto",
        display: "flex",
        alignItems: "center",
        gap: 5,
    };

    // ── Render ────────────────────────────────────────────────────────
    return (
        // Break out of the DialogContent horizontal padding (MUI default 24px)
        // so the globe spans the full dialog width. Adjust -24px if your
        // DialogContent padding differs.
        <div style={{ position: "relative", width: "calc(100% + 48px)", margin: "16px -24px 0", display: "flex", flexDirection: "column", alignItems: "center", userSelect: "none" }}>
            {/* Globe + node list: side by side when the row is wide enough
                (globe min 260px + list min 200px), wrapped to stacked otherwise.
                The globe container stays the ResizeObserver target, so it keeps
                its square aspect at whatever width the row hands it. */}
            <div style={S_GLOBE_ROW}>
                <div ref={containerRef} style={{ position: "relative", flex: "1 1 300px", minWidth: 260, maxWidth: "100%", height: dimension || size, overflow: "hidden" }}>
                    <canvas
                        ref={canvasRef}
                        onPointerDown={onPointerDown}
                        style={{
                            width: "100%",
                            height: "100%",
                            display: "block",
                            cursor: "grab",
                            contain: "layout",
                            touchAction: "none",
                        }}
                    />

                    {/* Dark→transparent overlay (dark at the bottom, clear by the middle) */}
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            pointerEvents: "none",
                            zIndex: 5,
                            background:
                                "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.6) 25%, rgba(0,0,0,0) 50%)",
                        }}
                    />

                    {/* Labels — CSS Anchor Positioning (cobe v2) */}
                    {nodes.map((node) => {
                        const isSelected = node.id === (selectedNodeId || nodes[0].id);
                        const isPinging  = pinging === node.id;
                        const ping       = pings[node.id];

                        return (
                            <div
                                key={node.id}
                                onClick={() => handleNodeClick(node)}
                                style={{
                                    ...sLabel,
                                    position: "absolute",
                                    bottom: "anchor(top)",
                                    left: "anchor(center)",
                                    positionAnchor: `--cobe-${node.id}`,
                                    translate: "-50% -8px",
                                    opacity: `var(--cobe-visible-${node.id}, 0)`,
                                    color:       "#000000",
                                    fontWeight:  isSelected ? 600 : 400,
                                    background:  "#ffffff",
                                    border:      "none",
                                    zIndex: 10,
                                }}
                            >
                                <span>{node.name}</span>
                                {isPinging && (
                                    <CircularProgress size={10} thickness={6} color="inherit" style={{ color: "#999", display: "block" }} />
                                )}
                                {!isPinging && ping != null && (
                                    ping < 0
                                        ? <LinkOffIcon style={{ fontSize: 13, color: "#666", display: "block" }} />
                                        : <span style={{ fontSize: 10, color: "#666", fontWeight: 500 }}>{`${ping}ms`}</span>
                                )}
                            </div>
                        );
                    })}

                    {/* "You" — browser-locale-derived location, not a selectable node */}
                    {userLocation && (
                        <div
                            style={{
                                ...sLabel,
                                position: "absolute",
                                bottom: "anchor(top)",
                                left: "anchor(center)",
                                positionAnchor: "--cobe-you",
                                translate: "-50% -8px",
                                opacity: "var(--cobe-visible-you, 0)",
                                color: "#000000",
                                fontWeight: 600,
                                background: "#ffffff",
                                border: "none",
                                cursor: "default",
                                zIndex: 10,
                            }}
                        >
                            <span>{t("components.globe.you")}</span>
                        </div>
                    )}
                </div>

                {/* Node list — same click handler as the globe labels. Labels of
                    geographically close nodes overlap on the sphere; these rows
                    give every node an unambiguous target. The check marks the
                    active node (none while a custom endpoint is active — the
                    status bar below covers that case). */}
                <List dense disablePadding aria-label={t("components.globe.api_nodes")} style={{ ...S_LIST, maxHeight: dimension || size }}>
                    {listNodes.map((node) => {
                        const isSelected = node.id === resolvedSelectedId;
                        const isPinging  = pinging === node.id;
                        const ping       = pings[node.id];

                        return (
                            <ListItem
                                key={node.id}
                                button
                                disableGutters
                                selected={isSelected}
                                onClick={() => handleNodeClick(node)}
                                style={{ ...S_LIST_ITEM, background: isSelected ? "rgba(255,255,255,0.08)" : "transparent" }}
                            >
                                <ListItemText
                                    primary={node.name}
                                    secondary={node.host}
                                    primaryTypographyProps={{ style: { ...S_ITEM_PRIMARY, color: isSelected ? "#ffffff" : "#e6e6e6", fontWeight: isSelected ? 600 : 400 } }}
                                    secondaryTypographyProps={{ style: S_ITEM_SECONDARY }}
                                    style={{ margin: "0px 8px 0px 0px" }}
                                />
                                <span style={S_ITEM_PING}>
                                    {isPinging && (
                                        <CircularProgress size={10} thickness={6} color="inherit" style={{ color: "#999", display: "block" }} />
                                    )}
                                    {!isPinging && ping != null && (
                                        ping < 0
                                            ? <LinkOffIcon style={{ fontSize: 13, color: "#666", display: "block" }} />
                                            : `${ping}ms`
                                    )}
                                </span>
                                <span style={S_ITEM_CHECK}>
                                    {isSelected && <CheckIcon style={{ fontSize: 18, color: "#ffffff" }} />}
                                </span>
                            </ListItem>
                        );
                    })}
                </List>
            </div>
            {/* Selected node status bar */}
            <div
                style={{
                    marginTop: 10,
                    padding: "7px 14px",
                    background: "rgba(255,255,255,0.08)",
                    border: "none",
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    fontFamily: FONT_FAMILY,
                    fontSize: 12,
                    color: "#c0c0c0",
                    width: "fit-content",
                    maxWidth: "100%",
                }}
            >
                {pinging === (selectedNode && selectedNode.id) ? (
                    <CircularProgress size={8} thickness={6} color="inherit" style={{ color: "#999", flexShrink: 0 }} />
                ) : (
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#777", boxShadow: "0 0 5px rgba(119,119,119,0.4)", flexShrink: 0 }} />
                )}
                <span style={{ color: "#666", flexShrink: 0 }}>API</span>
                <span style={{ color: "#fff", fontWeight: 500 }}>
                    {selectedNode ? selectedNode.name : "—"}
                </span>
                {selectedNode && pings[selectedNode.id] != null && (
                    <span style={{ fontSize: 10, color: "#999", fontWeight: 500, marginLeft: 2 }}>
                        {pings[selectedNode.id] < 0 ? "unreachable" : `${pings[selectedNode.id]}ms`}
                    </span>
                )}
            </div>
        </div>
    );
}