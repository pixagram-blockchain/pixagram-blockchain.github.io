import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import createGlobe from "cobe";
import CircularProgress from "@material-ui/core/CircularProgress";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import CheckIcon from "@material-ui/icons/Check";
import LinkOffIcon from "@material-ui/icons/LinkOff";
import { DEFAULT_NODES } from "../utils/constants";
import { DEFAULT_API_NODE_URL, normalize_node_url, same_node_url, measure_node_latency } from "../utils/settings";

import { t } from "../utils/text";

/**
 * Globe.js — API Node Globe Selector (cobe v2)
 *
 * Identity: a node IS its URL. Selection (`selectedUrl`), the click callback
 * (`onNodeSelect(url)`), the latency table and the status bar are all keyed by
 * the normalized endpoint URL — DEFAULT_NODES ids only serve as React keys. A
 * `selectedUrl` that matches none of `nodes` is a custom endpoint: no pin, no
 * arc, but it is pinged and named in the status bar like any other.
 *
 * Latency: best of three, via utils/settings' measure_node_latency — the one
 * probe shared with the boot race (first request pays DNS + TCP + TLS, so a
 * single sample overstates every node; the series stops at the first failure
 * so a dead node costs one timeout, not three).
 *
 * Labels: positioned by THIS component, not by cobe's CSS Anchor Positioning.
 * Anchor positioning is Chromium-only in practice — Safari ignores
 * `position-anchor`/`anchor()`, so every label collapsed to its static spot
 * (bottom-left of the box). We reproduce cobe's own marker projection (the
 * exact rotation matrix its renderer applies) in JS and write each label's
 * transform once per frame, which works identically in every browser. Not
 * giving the markers an `id` also keeps cobe from rebuilding a <style> element
 * and re-laying-out anchor <div>s 60× a second — on WebKit that stylesheet
 * rewrite is a full style recalc of the whole Settings dialog per frame, which
 * is the other half of why the globe "rotated poorly" there. The stylesheet
 * cobe still creates is detached right after creation, so its per-frame text
 * writes cost nothing.
 *
 * Sizing: cobe multiplies `width`/`height` by `devicePixelRatio` itself. The
 * previous code passed dimension×dpr AND dpr, i.e. a dimension×dpr² backing
 * store — 4× the fragment work on a 2× display, 9× on a 3× iPhone, for
 * pixels that were never shown. `width`/`height` are CSS pixels now, and dpr
 * is capped at 2 (a 3× phone gains nothing visible from a 3× globe).
 *
 * The globe fills its container width (square) and is re-created on resize
 * via ResizeObserver. Dragging is captured on `window`, so the drag area is
 * the whole screen rather than just the canvas bounds. Rotation is
 * time-based, so a 120 Hz Safari (ProMotion) spins at the same speed as 60 Hz.
 */

const FONT_FAMILY = '"Industry Book", "Normative Pro"';

// ── Globe geometry (must match what we pass to createGlobe below) ───────────
// cobe renders a unit sphere scaled to 0.8 of the NDC half-width and lifts
// markers by `markerElevation` above it — projectPoint() mirrors that.
const GLOBE_RADIUS = 0.8;
const GLOBE_THETA = 0.3;
const GLOBE_SCALE = 1.0;
const MARKER_ELEVATION = 0.02;
const LABEL_LIFT_PX = 8;           // gap between a pin and the label above it
const ROTATION_RAD_PER_MS = 0.003 / (1000 / 60); // = the old 0.003 per 60 Hz frame
const MAX_FRAME_MS = 100;          // clamp dt after a hidden-tab gap
const MAX_DPR = 2;

const YOU_KEY = "you";
const YOU_LABEL_BG = "#171717";
const YOU_LABEL_FG = "#ffffff";
const YOU_MARKER_COLOR = [0, 0, 0];   // black dot, per spec

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

// Labels sit at the container origin; the rAF loop moves them with a
// transform (compositor-only — no layout, which is what keeps Safari at
// full frame rate). `transform` and `pointerEvents` are deliberately NOT in
// this object, and `opacity` is only the constant 0 start value: the loop
// owns all three, and a React re-render (a ping landing, a selection change)
// only rewrites style keys whose value differs between renders — a constant
// never does — so the loop's writes survive every re-render.
const S_LABEL_BASE = {
    position: "absolute",
    left: 0,
    top: 0,
    opacity: 0,
    fontFamily: FONT_FAMILY,
    fontSize: 11,
    whiteSpace: "nowrap",
    padding: "2px 7px",
    borderRadius: 3,
    transition: "opacity .3s",
    display: "flex",
    alignItems: "center",
    gap: 5,
    zIndex: 10,
    border: "none",
    willChange: "transform, opacity",
};

const S_LABEL_NODE = { ...S_LABEL_BASE, cursor: "pointer", color: "#000000", background: "#ffffff" };
const S_LABEL_NODE_SELECTED = { ...S_LABEL_NODE, fontWeight: 600 };
const S_LABEL_YOU = { ...S_LABEL_BASE, cursor: "default", color: YOU_LABEL_FG, background: YOU_LABEL_BG, fontWeight: 600 };

const S_HOST = { position: "absolute", inset: 0 };
const S_CANVAS = { width: "100%", height: "100%", display: "block", cursor: "grab", touchAction: "none" };
const S_OVERLAY = {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    zIndex: 5,
    background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.6) 25%, rgba(0,0,0,0) 50%)",
};
const S_PING_SPINNER = { color: "#999", display: "block" };
const S_PING_OFF = { fontSize: 13, color: "#666", display: "block" };
const S_PING_MS = { fontSize: 10, color: "#666", fontWeight: 500 };

// Hostname for a list row's secondary line — falls back to the raw URL when it
// doesn't parse (same spirit as selectedNode's "Custom" fallback below).
const nodeHost = (url) => {
    try { return new URL(url).hostname; } catch (e) { return url || ""; }
};

// Canonical key for a node URL; the raw string when it doesn't normalize so a
// malformed entry still gets a stable key rather than colliding on null.
const urlKey = (url) => normalize_node_url(url) || String(url || "");

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

// ── Latency ───────────────────────────────────────────────────────────────
// Best of 3 sequential samples, -1 when unreachable — the same probe the
// boot race in utils/settings uses, so the number shown here is the number
// the automatic selection decided on.
const measureLatency = measure_node_latency;

// ── Projection (mirrors cobe v2's marker projection) ───────────────────────
// Unit-sphere position of a [lat, lng], in cobe's frame.
function latLngToVec3(location) {
    const lat = location[0] * Math.PI / 180;
    const lng = location[1] * Math.PI / 180 - Math.PI;
    const c = Math.cos(lat);
    return [-c * Math.cos(lng), Math.sin(lat), c * Math.sin(lng)];
}

// Screen position (fractions of the canvas box) and visibility of a unit
// vector at marker elevation, for the current phi/theta. `aspect` is the
// canvas width/height ratio (1 for our square). A pin is visible when it
// faces the camera OR sits outside the sphere's silhouette (elevation pushes
// rim pins past the disc) — same two clauses cobe uses for --cobe-visible-*.
function projectPoint(v, phi, theta, aspect) {
    const r = GLOBE_RADIUS + MARKER_ELEVATION;
    const x = v[0] * r, y = v[1] * r, z = v[2] * r;
    const ct = Math.cos(theta), st = Math.sin(theta);
    const cp = Math.cos(phi), sp = Math.sin(phi);
    const c = cp * x + sp * z;
    const s = sp * st * x + ct * y - cp * st * z;
    const depth = -sp * ct * x + st * y + cp * ct * z;
    return {
        x: ((c / aspect) * GLOBE_SCALE + 1) / 2,
        y: (-s * GLOBE_SCALE + 1) / 2,
        visible: depth >= 0 || (c * c + s * s) >= GLOBE_RADIUS * GLOBE_RADIUS,
    };
}

// ── Component ─────────────────────────────────────────────────────────
export default function Globe({
                                  nodes = DEFAULT_NODES,
                                  selectedUrl,                  // active endpoint URL (any spelling; normalized here)
                                  onNodeSelect,                 // (url) => void — receives the normalized URL
                                  size = 300,                   // fallback only; the globe fills its container width
                              }) {
    const canvasRef = useRef(null);
    const hostRef = useRef(null);        // cobe's only sibling-free parent — see the effect below
    const containerRef = useRef(null);
    const globeRef = useRef(null);
    const rafRef = useRef(null);
    const phiRef = useRef(0);
    const pointerInteracting = useRef(null);  // null or startX
    const dragStartPhi = useRef(0);

    // Refs for dynamic data — read in the rAF loop
    const markersRef = useRef([]);
    const arcsRef = useRef([]);
    const labelElsRef = useRef(new Map());     // key → <div> (callback refs)
    const labelTargetsRef = useRef([]);        // [{ key, vec }] — what the loop projects
    const labelLastRef = useRef(new Map());    // key → last written transform/visibility

    // Measured square dimension (px). 0 until the container is measured.
    const [dimension, setDimension] = useState(0);

    const [userLocation] = useState(() => localeToLocation());
    const [pings, setPings] = useState({});      // urlKey → ms | -1
    const [pinging, setPinging] = useState(null); // urlKey being (re)measured on click

    // Same resolution rule everywhere: nothing selected → the default endpoint.
    const resolvedSelectedUrl = normalize_node_url(selectedUrl) || DEFAULT_API_NODE_URL;

    const selectedNode = useMemo(() => {
        const found = nodes.find((n) => same_node_url(n.url, resolvedSelectedUrl));
        if (found) return found;
        // Not one of the predefined nodes — a custom endpoint. It has no fixed
        // lat/lng so it never gets a globe pin, but the status bar names it.
        return { id: "custom", name: nodeHost(resolvedSelectedUrl) || "Custom", url: resolvedSelectedUrl, custom: true };
    }, [nodes, resolvedSelectedUrl]);
    const selectedKey = urlKey(selectedNode.url);

    // List rows — nodes enriched with a display hostname + URL key, memoised
    // on `nodes` so rows aren't re-derived on every ping-state update.
    const listNodes = useMemo(
        () => nodes.map((n) => ({ ...n, host: nodeHost(n.url), key: urlKey(n.url) })),
        [nodes]
    );

    // ── Auto-ping all nodes on mount (best of 3, nodes in parallel) ────
    useEffect(() => {
        let cancelled = false;
        nodes.forEach(async (node) => {
            const ms = await measureLatency(node.url);
            if (!cancelled) setPings((prev) => ({ ...prev, [urlKey(node.url)]: ms }));
        });
        return () => { cancelled = true; };
    }, [nodes]);

    // ── Also ping a custom endpoint, so its status-bar row isn't left
    // blank while it's the active selection ─────────────────────────────
    useEffect(() => {
        if (!selectedNode.custom) return;
        let cancelled = false;
        const key = urlKey(selectedNode.url);
        (async () => {
            const ms = await measureLatency(selectedNode.url);
            if (!cancelled) setPings((prev) => ({ ...prev, [key]: ms }));
        })();
        return () => { cancelled = true; };
    }, [selectedNode]);

    // ── Click handler (labels + list rows) ────────────────────────────
    const handleNodeClick = useCallback(
        async (node) => {
            const url = normalize_node_url(node.url) || node.url;
            if (onNodeSelect) onNodeSelect(url);
            const key = urlKey(url);
            setPinging(key);
            const ms = await measureLatency(url);
            setPings((prev) => ({ ...prev, [key]: ms }));
            setPinging((current) => (current === key ? null : current));
        },
        [onNodeSelect]
    );

    // ── Markers + label targets (no globe rebuild needed) ─────────────
    // Markers carry NO `id`: an id makes cobe maintain an anchor <div> and a
    // stylesheet for it on every frame, and we position labels ourselves.
    useEffect(() => {
        const nodeMarkers = nodes.map((n) => {
            const selected = same_node_url(n.url, resolvedSelectedUrl);
            return {
                location: n.location,
                size: selected ? 0.07 : 0.05,
                color: selected ? [1.0, 1.0, 1.0] : [0.6, 0.6, 0.6],
            };
        });
        // "You" — the visitor's own approximate location (locale-derived, see
        // localeToLocation above). Black dot + #171717/white label, per spec.
        // Never mistaken for a selectable node: it isn't in `nodes`, has no
        // onNodeSelect handler, and its label isn't clickable.
        markersRef.current = userLocation
            ? [...nodeMarkers, { location: userLocation, size: 0.045, color: YOU_MARKER_COLOR }]
            : nodeMarkers;

        const targets = nodes.map((n) => ({ key: urlKey(n.url), vec: latLngToVec3(n.location) }));
        if (userLocation) targets.push({ key: YOU_KEY, vec: latLngToVec3(userLocation) });
        labelTargetsRef.current = targets;

        if (globeRef.current) globeRef.current.update({ markers: markersRef.current });
    }, [nodes, resolvedSelectedUrl, userLocation]);

    // ── Arcs ──────────────────────────────────────────────────────────
    useEffect(() => {
        // Reuses `selectedNode` so a custom endpoint — which has no
        // `.location` — correctly draws no arc instead of pointing at nodes[0].
        arcsRef.current = (userLocation && selectedNode.location)
            ? [{ from: userLocation, to: selectedNode.location, color: [0.4, 0.4, 0.4] }]
            : [];
        if (globeRef.current) globeRef.current.update({ arcs: arcsRef.current });
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
    // The rAF loop advances phi (time-based), pushes it to the globe and
    // projects the labels; markers/arcs are pushed only when they change.
    // ══════════════════════════════════════════════════════════════════
    useEffect(() => {
        const canvas = canvasRef.current;
        const host = hostRef.current;
        if (!canvas || !host || dimension <= 0) return;

        const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

        // cobe v2 appends one <style> to <head> for its --cobe-visible-*
        // variables and rewrites its text on every update(). Remember the
        // current tail so we can find that element afterwards.
        const headTailBefore = document.head.lastElementChild;

        const globe = createGlobe(canvas, {
            devicePixelRatio: dpr,
            width:  dimension,      // CSS px — cobe multiplies by dpr itself
            height: dimension,
            phi:               phiRef.current,
            theta:             GLOBE_THETA,
            dark:              1,
            diffuse:           1.2,
            mapSamples:        16000,
            mapBrightness:     6,
            mapBaseBrightness: 0.05,
            scale:             GLOBE_SCALE,
            offset:            [0, 0],
            markerElevation:   MARKER_ELEVATION,
            baseColor:         [1, 1, 1],
            markerColor:       [0.8, 0.8, 0.8],
            glowColor:         [0.1, 0.1, 0.1],
            markers:           markersRef.current,
            arcs:              arcsRef.current,
            arcColor:          [0.4, 0.4, 0.4],
            arcWidth:          1.0,
            arcHeight:         0.3,
        });

        // Detach cobe's variables stylesheet. Nothing reads --cobe-visible-*
        // here (no marker ids), and a CONNECTED <style> whose text changes
        // every frame is a whole-document style recalc per frame on WebKit.
        // Text writes to a detached <style> are free. Guarded on it being the
        // element cobe just appended (":root{" is its signature) so nothing
        // else in <head> can ever be touched.
        const headTailAfter = document.head.lastElementChild;
        if (headTailAfter && headTailAfter !== headTailBefore
            && headTailAfter.tagName === "STYLE"
            && /^:root\{/.test(headTailAfter.textContent || "")) {
            headTailAfter.remove();
        }

        globeRef.current = globe;
        labelLastRef.current = new Map(); // positions are stale after a re-create

        const aspect = canvas.height > 0 ? canvas.width / canvas.height : 1;
        let lastTs = 0;

        function animate(ts) {
            if (!globeRef.current) return;

            // Auto-rotate only when not dragging; time-based so refresh rate
            // doesn't change the speed, clamped so a hidden tab can't jump.
            const dt = lastTs ? Math.min(ts - lastTs, MAX_FRAME_MS) : 1000 / 60;
            lastTs = ts;
            if (pointerInteracting.current === null) {
                phiRef.current += ROTATION_RAD_PER_MS * dt;
            }

            globe.update({ phi: phiRef.current });

            // Labels: same projection cobe applied to the pins this frame.
            const els = labelElsRef.current;
            const last = labelLastRef.current;
            const phi = phiRef.current;
            for (const target of labelTargetsRef.current) {
                const el = els.get(target.key);
                if (!el) continue;
                const p = projectPoint(target.vec, phi, GLOBE_THETA, aspect);
                const px = Math.round(p.x * dimension * 10) / 10;
                const py = Math.round(p.y * dimension * 10) / 10;
                // Anchor the label's bottom-centre LABEL_LIFT_PX above the pin.
                const transform = `translate(${px}px, ${py - LABEL_LIFT_PX}px) translate(-50%, -100%)`;
                const prev = last.get(target.key);
                if (!prev || prev.transform !== transform) el.style.transform = transform;
                if (!prev || prev.visible !== p.visible) {
                    el.style.opacity = p.visible ? "1" : "0";
                    el.style.pointerEvents = p.visible ? "auto" : "none";
                }
                if (!prev) last.set(target.key, { transform, visible: p.visible });
                else { prev.transform = transform; prev.visible = p.visible; }
            }

            rafRef.current = requestAnimationFrame(animate);
        }

        rafRef.current = requestAnimationFrame(animate);

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            globe.destroy();
            globeRef.current = null;
            // cobe v2 re-parents the canvas into a wrapper <div> it inserts
            // and leaves that wrapper behind on destroy. Put the canvas back
            // under our host and drop the wrapper, so a re-create (resize)
            // doesn't nest wrappers and Preact keeps owning a canvas whose
            // parent is the element it rendered it into.
            if (canvas.parentNode !== host) host.appendChild(canvas);
            for (const child of Array.from(host.childNodes)) {
                if (child !== canvas) host.removeChild(child);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dimension]);

    // ── Drag handlers (whole-screen via window listeners) ─────────────
    const handleWindowMove = useCallback((e) => {
        if (pointerInteracting.current === null) return;
        const delta = e.clientX - pointerInteracting.current;
        phiRef.current = dragStartPhi.current + delta / 200;
    }, []);

    const endDrag = useCallback(() => {
        pointerInteracting.current = null;
        if (canvasRef.current) canvasRef.current.style.cursor = "grab";
        window.removeEventListener("pointermove", handleWindowMove);
        window.removeEventListener("pointerup", endDrag);
        window.removeEventListener("pointercancel", endDrag);
    }, [handleWindowMove]);

    const onPointerDown = useCallback((e) => {
        pointerInteracting.current = e.clientX;
        dragStartPhi.current = phiRef.current;
        if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
        window.addEventListener("pointermove", handleWindowMove);
        window.addEventListener("pointerup", endDrag);
        window.addEventListener("pointercancel", endDrag); // Safari fires this on interrupted touches
    }, [handleWindowMove, endDrag]);

    // Safety: drop any window listeners if we unmount mid-drag
    useEffect(() => () => {
        window.removeEventListener("pointermove", handleWindowMove);
        window.removeEventListener("pointerup", endDrag);
        window.removeEventListener("pointercancel", endDrag);
    }, [handleWindowMove, endDrag]);

    // Callback refs for the labels — the loop looks elements up by key. One
    // stable function per key: a fresh closure per render would make Preact
    // detach (null) and re-attach every label on every ping update.
    const labelRefFnsRef = useRef(new Map());
    const registerLabel = useCallback((key) => {
        let fn = labelRefFnsRef.current.get(key);
        if (!fn) {
            fn = (el) => {
                if (el) labelElsRef.current.set(key, el);
                else { labelElsRef.current.delete(key); labelLastRef.current.delete(key); }
            };
            labelRefFnsRef.current.set(key, fn);
        }
        return fn;
    }, []);

    const renderPing = (key, styled) => {
        const isPinging = pinging === key;
        const ping = pings[key];
        if (isPinging) return <CircularProgress size={10} thickness={6} color="inherit" style={S_PING_SPINNER} />;
        if (ping == null) return null;
        if (ping < 0) return <LinkOffIcon style={S_PING_OFF} />;
        return styled ? <span style={S_PING_MS}>{`${ping}ms`}</span> : `${ping}ms`;
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
                    {/* The canvas is the host's ONLY child: cobe v2 wraps the canvas
                        in a <div> of its own, and Preact tolerates that re-parenting
                        only when no sibling reconciliation happens in the same parent
                        — labels and overlay live one level up. */}
                    <div ref={hostRef} style={S_HOST}>
                        <canvas
                            ref={canvasRef}
                            onPointerDown={onPointerDown}
                            style={S_CANVAS}
                        />
                    </div>

                    {/* Dark→transparent overlay (dark at the bottom, clear by the middle) */}
                    <div style={S_OVERLAY} />

                    {/* Labels — positioned by the rAF loop (transform/opacity),
                        hidden until the first frame places them. */}
                    {listNodes.map((node) => {
                        const isSelected = node.key === selectedKey;
                        return (
                            <div
                                key={node.key}
                                ref={registerLabel(node.key)}
                                onClick={() => handleNodeClick(node)}
                                style={isSelected ? S_LABEL_NODE_SELECTED : S_LABEL_NODE}
                            >
                                <span>{node.name}</span>
                                {renderPing(node.key, true)}
                            </div>
                        );
                    })}

                    {/* "You" — browser-locale-derived location, not a selectable node */}
                    {userLocation && (
                        <div ref={registerLabel(YOU_KEY)} style={S_LABEL_YOU}>
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
                        const isSelected = node.key === selectedKey;
                        return (
                            <ListItem
                                key={node.key}
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
                                    {renderPing(node.key, false)}
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
                {pinging === selectedKey ? (
                    <CircularProgress size={8} thickness={6} color="inherit" style={{ color: "#999", flexShrink: 0 }} />
                ) : (
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#777", boxShadow: "0 0 5px rgba(119,119,119,0.4)", flexShrink: 0 }} />
                )}
                <span style={{ color: "#666", flexShrink: 0 }}>API</span>
                <span style={{ color: "#fff", fontWeight: 500 }}>
                    {selectedNode.name || "—"}
                </span>
                {pings[selectedKey] != null && (
                    <span style={{ fontSize: 10, color: "#999", fontWeight: 500, marginLeft: 2 }}>
                        {pings[selectedKey] < 0 ? "unreachable" : `${pings[selectedKey]}ms`}
                    </span>
                )}
            </div>
        </div>
    );
}
