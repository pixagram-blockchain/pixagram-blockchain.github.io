"use strict";;
import * as React from "preact/compat";
import { useCallback, useEffect, useRef, useState } from "preact/compat";
import Portal from "@material-ui/core/Portal";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import ArrowBackRounded from "@material-ui/icons/ArrowBackRounded";
import ArrowForwardRounded from "@material-ui/icons/ArrowForwardRounded";
import CheckRounded from "@material-ui/icons/CheckRounded";

import { t } from "../utils/text";

// ─── Tour ─────────────────────────────────────────────────────────────────────
// First-visit guided tour. Renders a dimmed overlay with a "spotlight" cut
// around the current step's anchor element and a tooltip card with an arrow,
// Back / Next / Skip controls, and a step counter.
//
// Steps schema:
//   {
//     target?:    string | string[]   CSS selector(s) for the anchor. The
//                                     first selector matching a VISIBLE element
//                                     wins. Omit (or null) for a centered step.
//     title?:     string
//     content:    string | vnode
//     placement?: "auto"|"top"|"bottom"|"left"|"right"|"center"  (default auto)
//     onEnter?:   () => void          Runs when the step becomes active —
//                                     e.g. programmatically switch a tab.
//   }
//
// Anchors are resolved with a short retry loop (lazy/masonry content), and a
// step whose anchor never shows up is skipped in the direction of travel
// instead of blocking the tour — so steps can safely point at elements that
// only exist on some layouts (mobile vs desktop) or aren't wired up yet.
// Skipping never ends the tour by itself: when there is nothing resolvable
// left ahead, the step falls back to a centered card, so the tour only
// closes on an explicit Done, Skip, or Esc from the user.
//
// props: steps (array), onFinish(reason) with reason ∈ "completed"|"skipped".

const Z_INDEX = 1600;      // above the app shell & snackbar, below nothing else
const SPOT_PAD = 6;        // px of breathing room around the anchor
const GAP = 14;            // anchor ↔ tooltip gap (the arrow lives in it)
const MARGIN = 12;         // min distance from the viewport edges
const RETRY_MS = 120;      // anchor-resolution retry cadence…
const MAX_RETRIES = 10;    // …and budget (~1.2s) before the step is skipped

const DIM = "rgba(0, 0, 0, 0.8)";
const CARD_BG = "#fff";
const SPOT_RING = "0 0 0 2px #fff";                         // white border on the cutout
const SPOT_GLOW = "0 0 24px 8px rgba(255, 255, 255, 0.55)"; // soft white halo over the dim

// ── Anchor resolution ─────────────────────────────────────────────────────────

function findVisibleTarget(target) {
    const selectors = Array.isArray(target) ? target : [target];
    for (let i = 0; i < selectors.length; i++) {
        let nodes;
        try { nodes = document.querySelectorAll(selectors[i]); } catch (e) { continue; }
        for (let j = 0; j < nodes.length; j++) {
            const r = nodes[j].getBoundingClientRect();
            if (r.width > 1 && r.height > 1) return nodes[j];
        }
    }
    return null;
}

// ── Geometry ──────────────────────────────────────────────────────────────────

const clamp = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max));

const DEFAULT_SPOT_RADIUS = 12;

// The spotlight follows the anchor's own shape: a circular button gets a
// circular ring, a pill gets a capsule, and square-cornered elements keep the
// default rounding. Pixel radii are padded by SPOT_PAD so the ring stays
// concentric with the element's corner; "50%" keeps its shape on the padded
// box; CSS clamps oversized values (9999px pills) to a capsule on its own.
function spotRadiusFor(el) {
    if (!el) return DEFAULT_SPOT_RADIUS + "px";
    try {
        const br = (window.getComputedStyle(el).borderRadius || "").trim();
        if (/^\d+(\.\d+)?%$/.test(br)) return br;
        const px = (br.match(/\d+(\.\d+)?(?=px)/g) || []).map(Number).filter((n) => n > 0);
        if (px.length) return (Math.max(...px) + SPOT_PAD) + "px";
    } catch (e) {}
    return DEFAULT_SPOT_RADIUS + "px";
}

function computeLayout(step, el, tw, th) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (!el || step.placement === "center") {
        return {
            placement: "center",
            spot: null,
            tip: { top: Math.max(MARGIN, (vh - th) / 2), left: Math.max(MARGIN, (vw - tw) / 2) },
            arrow: null,
        };
    }

    const r = el.getBoundingClientRect();
    const spot = {
        top: r.top - SPOT_PAD,
        left: r.left - SPOT_PAD,
        width: r.width + SPOT_PAD * 2,
        height: r.height + SPOT_PAD * 2,
        radius: spotRadiusFor(el),
    };
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;

    let placement = step.placement;
    if (!placement || placement === "auto") {
        const fitsBelow = spot.top + spot.height + GAP + th <= vh - MARGIN;
        const fitsAbove = spot.top - GAP - th >= MARGIN;
        placement = fitsBelow ? "bottom" : (fitsAbove ? "top" : "bottom");
    }

    let top, left, arrow;
    if (placement === "bottom" || placement === "top") {
        left = clamp(cx - tw / 2, MARGIN, vw - tw - MARGIN);
        top = placement === "bottom" ? spot.top + spot.height + GAP : spot.top - GAP - th;
        top = clamp(top, MARGIN, vh - th - MARGIN);
        arrow = { side: placement === "bottom" ? "top" : "bottom", offset: clamp(cx - left, 18, tw - 18) };
    } else {
        top = clamp(cy - th / 2, MARGIN, vh - th - MARGIN);
        left = placement === "right" ? spot.left + spot.width + GAP : spot.left - GAP - tw;
        left = clamp(left, MARGIN, vw - tw - MARGIN);
        arrow = { side: placement === "right" ? "left" : "right", offset: clamp(cy - top, 18, th - 18) };
    }

    return { placement, spot, tip: { top, left }, arrow };
}

const near = (a, b) => Math.abs(a - b) < 0.5;

function sameLayout(a, b) {
    if (!a || !b) return a === b;
    if (a.placement !== b.placement) return false;
    if (!near(a.tip.top, b.tip.top) || !near(a.tip.left, b.tip.left)) return false;
    if (!a.spot !== !b.spot) return false;
    if (a.spot && (!near(a.spot.top, b.spot.top) || !near(a.spot.left, b.spot.left) ||
        !near(a.spot.width, b.spot.width) || !near(a.spot.height, b.spot.height) ||
        a.spot.radius !== b.spot.radius)) return false;
    if (!a.arrow !== !b.arrow) return false;
    if (a.arrow && (a.arrow.side !== b.arrow.side || !near(a.arrow.offset, b.arrow.offset))) return false;
    return true;
}

// ── Static styles ─────────────────────────────────────────────────────────────

const SPOT_TRANSITION = "top 280ms ease, left 280ms ease, width 280ms ease, height 280ms ease, border-radius 280ms ease";
// After the overlay has entered, opacity joins the transition set; before
// that, transitions are off entirely so the first appearance fades in at its
// final position instead of flying in from the parked -9999px coordinates.
const ENTERED_TRANSITION = SPOT_TRANSITION + ", opacity 250ms ease";
const SHIELD_TRANSITION = "background 280ms ease, opacity 250ms ease";

const TIP_BASE = {
    position: "fixed",
    zIndex: Z_INDEX + 2,
    width: "calc(100vw - 24px)",
    maxWidth: 340,
    boxSizing: "border-box",
    background: CARD_BG,
    color: "#111",
    borderRadius: 14,
    padding: "18px 18px 12px 18px",
    boxShadow: "0 12px 40px rgba(0, 0, 0, 0.55)",
};

const TITLE_STYLE = { fontSize: 15, fontWeight: 700, letterSpacing: 0.3, marginBottom: 6 };
const BODY_STYLE = { fontSize: 13.5, lineHeight: 1.55, color: "#4a4a4a" };
const FOOTER_STYLE = { display: "flex", alignItems: "center", marginTop: 14 };
const COUNTER_STYLE = { color: "#9a9a9a", fontSize: 12, margin: "0 10px", userSelect: "none" };
const SKIP_BTN = { color: "#767676", textTransform: "none", minWidth: 0, padding: "4px 8px" };
const NAV_BTN = { color: "#111", backgroundColor: "rgba(0, 0, 0, 0.06)", marginLeft: 8 };
const NAV_BTN_DISABLED = { color: "#c4c4c4", marginLeft: 8 };
const DONE_BTN = {
    backgroundColor: "#111", color: "#fff", textTransform: "none",
    fontWeight: 600, borderRadius: 10, marginLeft: 8, padding: "4px 12px",
};

function arrowStyle(arrow) {
    const base = {
        position: "absolute",
        width: 12,
        height: 12,
        background: CARD_BG,
        transform: "rotate(45deg)",
    };
    switch (arrow.side) {
        case "top": return { ...base, top: -6, left: arrow.offset - 6 };
        case "bottom": return { ...base, bottom: -6, left: arrow.offset - 6 };
        case "left": return { ...base, left: -6, top: arrow.offset - 6 };
        case "right": return { ...base, right: -6, top: arrow.offset - 6 };
        default: return base;
    }
}

// ── Component ─────────────────────────────────────────────────────────────────

const Tour = ({ steps, onFinish }) => {
    const [index, setIndex] = useState(0);
    const [layout, setLayout] = useState(null);
    const [entered, setEntered] = useState(false);

    const count = steps.length;
    const step = steps[index] || null;
    const isLast = index >= count - 1;

    // Refs as firewalls against stale closures (same pattern as Index).
    const tipRef = useRef(null);
    const targetRef = useRef(null);
    const dirRef = useRef(1);
    const centerFallbackRef = useRef(-1); // step index forced to render centered
    const indexRef = useRef(index); indexRef.current = index;
    const stepRef = useRef(step); stepRef.current = step;
    const onFinishRef = useRef(onFinish); onFinishRef.current = onFinish;

    // Measure the anchor + tooltip and reposition; no-ops while unchanged so
    // the 250ms tracking interval below doesn't churn renders.
    const refresh = useCallback(() => {
        const s = stepRef.current;
        if (!s) return;
        const forceCenter = centerFallbackRef.current === indexRef.current;
        const el = s.target && !forceCenter ? targetRef.current : null;
        if (s.target && !forceCenter && !el) return; // still resolving
        const tip = tipRef.current;
        const tw = (tip && tip.offsetWidth) || 320;
        const th = (tip && tip.offsetHeight) || 170;
        const next = computeLayout(s, el, tw, th);
        setLayout((prev) => (sameLayout(prev, next) ? prev : next));
    }, []);

    // ── Step entry: run onEnter, resolve the anchor (with retries) ────────
    useEffect(() => {
        const s = steps[index];
        if (!s) { onFinishRef.current("completed"); return; }

        let cancelled = false;
        let timer = 0;
        let tries = 0;
        centerFallbackRef.current = -1; // fresh step, fresh chance to anchor

        if (typeof s.onEnter === "function") {
            try { s.onEnter(); } catch (e) {}
        }

        const attempt = () => {
            if (cancelled) return;
            if (!s.target) { targetRef.current = null; refresh(); return; }
            const el = findVisibleTarget(s.target);
            if (el) { targetRef.current = el; refresh(); return; }
            if (++tries > MAX_RETRIES) {
                // Anchor never showed up (not on this layout, or not wired up
                // yet) — move on in the direction of travel instead of stalling.
                let next = index + (dirRef.current >= 0 ? 1 : -1);
                if (next < 0) next = index + 1;
                if (next < count) { setIndex(next); return; }
                // Nothing left ahead. A missing anchor must never end the
                // tour on its own — render this step as a centered card
                // instead, so closing still takes an explicit Done or Skip.
                centerFallbackRef.current = index;
                targetRef.current = null;
                refresh();
                return;
            }
            timer = setTimeout(attempt, RETRY_MS);
        };
        attempt();

        return () => { cancelled = true; clearTimeout(timer); };
    }, [index, steps, count, refresh]);

    // ── Keep the spotlight glued to a moving anchor ────────────────────────
    // capture-phase scroll catches the nested masonry scrolling containers;
    // the interval catches transform animations (tab bars slide in/out) and
    // masonry reflows that fire no scroll/resize event.
    useEffect(() => {
        const onMove = () => refresh();
        window.addEventListener("resize", onMove);
        window.addEventListener("scroll", onMove, true);
        const interval = setInterval(refresh, 250);
        return () => {
            window.removeEventListener("resize", onMove);
            window.removeEventListener("scroll", onMove, true);
            clearInterval(interval);
        };
    }, [refresh]);

    // Re-measure right after a render: the tooltip height changes with each
    // step's content, and the first pass positions against the old size.
    // sameLayout() makes this converge instead of looping.
    useEffect(() => {
        const raf = requestAnimationFrame(refresh);
        return () => cancelAnimationFrame(raf);
    }, [index, layout, refresh]);

    // First appearance: everything has already rendered at its final position
    // with opacity 0 and no transitions. Two frames after the layout stops
    // changing (giving the measurement-corrected pass time to land), flip
    // `entered` — the whole overlay fades in in place. Every later step keeps
    // the usual glide.
    useEffect(() => {
        if (entered || !layout) return;
        let raf2 = 0;
        const raf1 = requestAnimationFrame(() => {
            raf2 = requestAnimationFrame(() => setEntered(true));
        });
        return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
    }, [entered, layout]);

    // ── Controls ───────────────────────────────────────────────────────────
    const goNext = useCallback(() => {
        dirRef.current = 1;
        if (indexRef.current + 1 >= count) onFinishRef.current("completed");
        else setIndex(indexRef.current + 1);
    }, [count]);

    const goBack = useCallback(() => {
        dirRef.current = -1;
        if (indexRef.current > 0) setIndex(indexRef.current - 1);
    }, []);

    const skip = useCallback(() => onFinishRef.current("skipped"), []);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape") { e.stopPropagation(); skip(); }
            else if (e.key === "ArrowRight") goNext();
            else if (e.key === "ArrowLeft") goBack();
        };
        window.addEventListener("keydown", onKey, true);
        return () => window.removeEventListener("keydown", onKey, true);
    }, [goNext, goBack, skip]);

    if (!step) return null;

    const centered = !layout || !layout.spot;

    return (
        <Portal>
            {/* Click/scroll shield. The dimming comes from the spotlight's
                spread shadow when there is an anchor; for centered steps the
                shield itself dims. */}
            <div
                style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: Z_INDEX,
                    background: centered ? DIM : "transparent",
                    opacity: entered ? 1 : 0,
                    transition: entered ? SHIELD_TRANSITION : "none",
                    touchAction: "none",
                    userSelect: "none",
                }}
            />
            {layout && layout.spot && (
                <div
                    style={{
                        position: "fixed",
                        top: layout.spot.top,
                        left: layout.spot.left,
                        width: layout.spot.width,
                        height: layout.spot.height,
                        borderRadius: layout.spot.radius,
                        boxShadow: `${SPOT_RING}, ${SPOT_GLOW}, 0 0 0 100vmax ${DIM}`,
                        opacity: entered ? 1 : 0,
                        transition: entered ? ENTERED_TRANSITION : "none",
                        pointerEvents: "none",
                        zIndex: Z_INDEX + 1,
                    }}
                />
            )}
            <div
                ref={tipRef}
                role="dialog"
                aria-label={step.title || "Tour"}
                style={{
                    ...TIP_BASE,
                    top: layout ? layout.tip.top : -9999,
                    left: layout ? layout.tip.left : -9999,
                    visibility: layout ? "visible" : "hidden",
                    opacity: entered ? 1 : 0,
                    transition: entered ? ENTERED_TRANSITION : "none",
                }}
            >
                {layout && layout.arrow ? <div style={arrowStyle(layout.arrow)} /> : null}
                {step.title ? <div style={TITLE_STYLE}>{step.title}</div> : null}
                <div style={BODY_STYLE}>{step.content}</div>
                <div style={FOOTER_STYLE}>
                    <Button size="small" onClick={skip} style={SKIP_BTN}>{t("components.tour.skip")}</Button>
                    <div style={{ flex: 1 }} />
                    <span style={COUNTER_STYLE}>{(index + 1) + " / " + count}</span>
                    <IconButton
                        size="small"
                        onClick={goBack}
                        disabled={index === 0}
                        style={index === 0 ? NAV_BTN_DISABLED : NAV_BTN}
                    >
                        <ArrowBackRounded fontSize="small" />
                    </IconButton>
                    {isLast ? (
                        <Button size="small" onClick={goNext} style={DONE_BTN}>
                            <CheckRounded style={{ fontSize: 18, marginRight: 6 }} />
                            {t("components.tour.done")}
                        </Button>
                    ) : (
                        <IconButton size="small" onClick={goNext} style={NAV_BTN}>
                            <ArrowForwardRounded fontSize="small" />
                        </IconButton>
                    )}
                </div>
            </div>
        </Portal>
    );
};

export default Tour;