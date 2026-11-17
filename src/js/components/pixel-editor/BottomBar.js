// ============================================================================
// pixel-editor/BottomBar.js — the tabs and the drawer they open
//
// Seven tabs, each opening its panel in a drawer. The tab bar is the app's:
// a rounded bar whose light pill slides to the tab picked. In the drawer the
// panels lie side by side in a swipeable view: a swipe sideways moves to the
// next or previous panel, a tab picked slides there.
//
//   Phones and upright tablets: the bar runs along the bottom; the drawer is
//     a card that rises between the canvas and the bar. A finger drags it
//     down from anywhere on it once its panel is scrolled to the top.
//   Wide screens (and phones on their side): a column on the right. Open, it
//     holds the drawer with the bar under it, as wide as the drawer; closed,
//     it narrows to the tabs alone, stacked upright down its middle. Where
//     the canvas stays at least square beside the open drawer, the drawer is
//     pinned open (`pinned`): no close button, and the open tab stays open.
//
// Either way the canvas gives up the room rather than being covered, so the
// whole image stays in view while a preview runs. The same tab again, the
// drawer's close button, a drag down (bottom) or a swipe right on its head
// (side), or Escape from inside it closes it.
// ============================================================================

import * as React from "preact/compat";
import { useRef, useState, useEffect } from "preact/compat";
import SwipeableViews from "react-swipeable-views";
import makeStyles from "@material-ui/core/styles/makeStyles";
import ButtonBase from "@material-ui/core/ButtonBase";
import Collapse from "@material-ui/core/Collapse";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";

import LayersIcon from "@material-ui/icons/Layers";
import PaletteIcon from "@material-ui/icons/Palette";
import TuneIcon from "@material-ui/icons/Tune";
import SelectAllIcon from "@material-ui/icons/SelectAll";
import TonalityIcon from "@material-ui/icons/Tonality";
import PhotoFilterIcon from "@material-ui/icons/PhotoFilter";
import HistoryIcon from "@material-ui/icons/History";
import KeyboardArrowDownIcon from "@material-ui/icons/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@material-ui/icons/KeyboardArrowRight";

import { tp } from "./labels";
import { PanelActive } from "./editorUtils";
import { EASE, SURFACE, RADIUS, GAP } from "./ui";

export const TABS = [
    { id: "layers", Icon: LayersIcon, label: "tab_layers" },
    { id: "colors", Icon: PaletteIcon, label: "tab_colors" },
    { id: "tool", Icon: TuneIcon, label: "tab_tool" },
    { id: "select", Icon: SelectAllIcon, label: "tab_select" },
    { id: "effects", Icon: TonalityIcon, label: "tab_effects" },
    { id: "filters", Icon: PhotoFilterIcon, label: "tab_filters" },
    { id: "history", Icon: HistoryIcon, label: "tab_history" },
];

/** The side column: open (drawer + bar) and closed (the upright tabs). */
export const SIDE_WIDTH = 380;
export const RAIL_WIDTH = 64;
const BAR_HEIGHT = 56;
const RAIL_TAB = 52;
const SIDE_MS = 240;

// The swipeable view moves like the app's own (same spring).
const SPRING = { tension: 450, friction: 60, duration: "120ms", easeFunction: "cubic-bezier(0.280, 0.840, 0.420, 1)", delay: "5ms" };
// A gesture that starts on one of these belongs to it: not a swipe, not a drag.
const NO_SWIPE = ".MuiSlider-root, input, textarea, select, [contenteditable='true'], [data-no-swipe]";
// Dragged down this far (or flicked), the bottom drawer closes.
const CLOSE_DRAG = 72;

const useStyles = makeStyles({
    // ── tab bar ──────────────────────────────────────────────────────────
    bar: {
        flex: "0 0 auto",
        height: BAR_HEIGHT,
        padding: 4,
        borderRadius: RADIUS,
        backgroundColor: SURFACE.tabs,
        boxSizing: "border-box",
    },
    // Upright: a card the column's full height, the tabs grouped in its middle.
    rail: {
        width: RAIL_WIDTH,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
    },
    track: {
        position: "relative",
        display: "flex",
        flexDirection: "row",
        width: "100%",
        height: "100%",
    },
    trackV: {
        flexDirection: "column",
        flex: "0 1 auto",
        height: TABS.length * RAIL_TAB,
        maxHeight: "100%",
    },
    // The pill sits in a slot the size of one tab and slides from slot to
    // slot (translate by whole slots), so it needs no measuring and keeps
    // up with a bar that is itself still growing.
    pill: {
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
    },
    pillInner: {
        position: "absolute",
        top: 4,
        bottom: 4,
        left: 4,
        right: 4,
        borderRadius: RADIUS,
        backgroundColor: SURFACE.pill,
        transition: `transform 220ms ${EASE}`,
    },
    pillAway: {
        transform: "scale(0.6)",
    },
    tab: {
        position: "relative",
        zIndex: 1,
        flex: "1 1 0",
        minWidth: 0,
        minHeight: 0,
        borderRadius: RADIUS,
        color: "#9a9a9a",
        gap: 8,
        transition: `color 225ms ${EASE}, background-color 225ms ${EASE}`,
        "&:hover:not([aria-selected='true'])": { color: "#e6e6e6", backgroundColor: "rgba(255, 255, 255, 0.06)" },
        "&.Mui-focusVisible:not([aria-selected='true'])": { backgroundColor: "rgba(255, 255, 255, 0.12)" },
        "& .MuiSvgIcon-root": { fontSize: 22, flex: "0 0 auto" },
    },
    tabOn: {
        color: `${SURFACE.tabs} !important`,
        transitionDelay: "75ms",
    },
    tabLabel: {
        fontFamily: `"Industry Book", "Normative Pro"`,
        fontSize: 12,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },

    // ── bottom drawer ────────────────────────────────────────────────────
    collapse: {
        flex: "0 0 auto",
        position: "relative",
        zIndex: 2,
        // Clipped once open too (Collapse lets it overflow then): a drawer
        // dragged down slides away above the tab bar, as it does closing,
        // rather than showing around and under the bar.
        "&.MuiCollapse-entered": { overflow: "hidden" },
    },
    sheetGap: {
        paddingTop: GAP,
    },
    // One height for every panel: the canvas keeps its size from tab to tab.
    sheet: {
        position: "relative",
        display: "flex",
        flexDirection: "column",
        height: "calc(var(--app-h, 100vh) * 0.46)",
        borderRadius: RADIUS,
        backgroundColor: SURFACE.panel,
        overflow: "hidden",
        transition: `transform 200ms ${EASE}`,
        willChange: "transform",
    },
    sheetWide: {
        height: "calc(var(--app-h, 100vh) * 0.42)",
    },
    head: {
        flex: "0 0 auto",
        position: "relative",
        height: 36,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        touchAction: "none",
        cursor: "grab",
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: "#4a4a4a",
    },
    close: {
        position: "absolute",
        right: 8,
        top: 2,
        color: "#9a9a9a",
        "&:hover": { color: "#ffffff" },
    },
    // The swipeable view and its slides: each panel scrolls on its own.
    views: {
        flex: "1 1 auto",
        minHeight: 0,
    },
    slide: {
        height: "100%",
        overflowX: "hidden",
        overflowY: "auto",
        overscrollBehavior: "contain",
        padding: "0 16px 16px",
        boxSizing: "border-box",
    },
    inner: {
        maxWidth: 760,
        margin: "0 auto",
    },
    // Above the bottom drawer: a drawer dragged down slides under it.
    bottomBar: {
        position: "relative",
        zIndex: 3,
        marginTop: GAP,
    },

    // ── side column ──────────────────────────────────────────────────────
    side: {
        flex: "0 0 auto",
        position: "relative",
        marginLeft: GAP,
        overflow: "hidden",
        transition: `width ${SIDE_MS}ms ${EASE}`,
    },
    // The open column, drawn at its full width the whole time: the column's
    // edge uncovers it as the column grows and hides it as it shrinks, so the
    // panel never reflows while it slides.
    sideOpen: {
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        width: SIDE_WIDTH,
        display: "flex",
        flexDirection: "column",
        animation: `$sideIn ${SIDE_MS}ms ${EASE}`,
    },
    "@keyframes sideIn": {
        from: { opacity: 0 },
        to: { opacity: 1 },
    },
    sideSheet: {
        flex: "1 1 auto",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        borderRadius: RADIUS,
        backgroundColor: SURFACE.panel,
        overflow: "hidden",
        transition: `transform 200ms ${EASE}`,
        willChange: "transform",
    },
    sideHead: {
        flex: "0 0 auto",
        height: 48,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 8px 0 16px",
        touchAction: "none",
    },
    sideTitle: {
        flex: 1,
        minWidth: 0,
        margin: 0,
        fontFamily: `"Industry Book", "Normative Pro"`,
        fontSize: 15,
        fontWeight: 400,
        lineHeight: 1.3,
        color: "#ffffff",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    sideClose: {
        color: "#9a9a9a",
        "&:hover": { color: "#ffffff" },
    },
    sideRail: {
        position: "absolute",
        right: 0,
        bottom: 0,
        width: RAIL_WIDTH,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        transition: `opacity 180ms ${EASE}`,
    },
    // Fades first, then leaves the tab order and the accessibility tree.
    gone: {
        opacity: 0,
        visibility: "hidden",
        pointerEvents: "none",
        transition: `opacity 180ms ${EASE}, visibility 0s linear 180ms`,
    },
});

/** Focuses a panel's tab in whichever bar is showing. */
export function focusTab(from, id) {
    const dialog = from && from.closest && from.closest("[role='dialog']");
    const button = dialog && id && dialog.querySelector(`[role='tablist']:not([aria-hidden='true']) [data-tab='${id}']`);
    if (button) button.focus();
}

/**
 * The tab bar. `tab` is the open panel (null: none); `onChange` gets the tab
 * picked, or null when the open one is picked again. `vertical` stacks the
 * tabs; `labels` writes each label beside its icon (otherwise it is the
 * tooltip); `hidden` keeps the bar laid out but out of reach.
 */
export function Tabs({ tab, onChange, vertical, labels, hidden, className }) {
    const classes = useStyles();
    const n = TABS.length;
    const index = TABS.findIndex((t) => t.id === tab);
    const shown = index >= 0;

    // The pill slides between tabs; it fades in where it lands when nothing
    // was picked before, and fades out where it was when the panel closes.
    const last = useRef(index);
    const slide = last.current >= 0 && shown;
    const slot = shown ? index : Math.max(0, last.current);
    useEffect(() => { if (shown) last.current = index; else last.current = -1; });
    const along = vertical ? "Y" : "X";
    const pillStyle = {
        width: vertical ? "100%" : `${100 / n}%`,
        height: vertical ? `${100 / n}%` : "100%",
        transform: `translate${along}(${slot * 100}%)`,
        opacity: shown ? 1 : 0,
        transition: slide
            ? `transform 300ms ${EASE}, opacity 200ms ${EASE}`
            : `opacity 200ms ${EASE}`,
    };

    // Arrow keys move between tabs (roving focus); Enter or Space opens.
    const track = useRef(null);
    const onKeyDown = (e) => {
        const keys = vertical ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"];
        if (![...keys, "Home", "End"].includes(e.key)) return;
        const buttons = track.current ? [...track.current.querySelectorAll("[role='tab']")] : [];
        const at = buttons.indexOf(document.activeElement);
        if (at < 0) return;
        e.preventDefault();
        const to = e.key === "Home" ? 0
            : e.key === "End" ? buttons.length - 1
                : (at + (e.key === keys[1] ? 1 : -1) + buttons.length) % buttons.length;
        buttons[to].focus();
    };

    const focusable = shown ? index : 0;
    return (
        <div
            className={classes.bar + (vertical ? " " + classes.rail : "") + (className ? " " + className : "")}
            role="tablist"
            aria-label={tp("panels")}
            aria-orientation={vertical ? "vertical" : "horizontal"}
            aria-hidden={hidden ? "true" : undefined}
        >
            <div ref={track} className={classes.track + (vertical ? " " + classes.trackV : "")} onKeyDown={onKeyDown}>
                <span className={classes.pill} style={pillStyle}>
                    <span className={classes.pillInner + (shown ? "" : " " + classes.pillAway)} />
                </span>
                {TABS.map((t, i) => {
                    const on = i === index;
                    const label = tp(t.label);
                    const button = (
                        <ButtonBase
                            key={t.id}
                            role="tab"
                            data-tab={t.id}
                            aria-selected={on}
                            aria-label={label}
                            tabIndex={hidden ? -1 : (i === focusable ? 0 : -1)}
                            className={classes.tab + (on ? " " + classes.tabOn : "")}
                            onClick={() => onChange(on ? null : t.id)}
                        >
                            <t.Icon />
                            {labels && <span className={classes.tabLabel}>{label}</span>}
                        </ButtonBase>
                    );
                    return labels ? button : (
                        <Tooltip key={t.id} title={label} placement={vertical ? "left" : "top"}>{button}</Tooltip>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * The panels side by side, the one for `tab` on show: a swipe sideways moves
 * to the next or previous one (`onChange` gets its tab), a tab picked slides
 * there. Every panel stays mounted, so a swipe uncovers real content, but
 * only the one on show listens to the editor (PanelActive) or can be reached
 * (the others are inert). A touch that
 * starts on a slider, the colour wheel, a field or a drag handle belongs to
 * it: the view stays put for that gesture.
 */
function PanelViews({ tab, onChange, renderPanel }) {
    const classes = useStyles();
    const index = Math.max(0, TABS.findIndex((t) => t.id === tab));
    // Disabled for one gesture at a time; set as the touch starts, before the
    // first move (renders land between touch events), cleared as it ends.
    const [held, setHeld] = useState(false);
    const heldRef = useRef(false);
    const hold = (on) => {
        if (heldRef.current === on) return;
        heldRef.current = on;
        setHeld(on);
    };
    return (
        <div
            className={classes.views}
            onTouchStartCapture={(e) => hold(!!(e.target && e.target.closest && e.target.closest(NO_SWIPE)))}
            onTouchEndCapture={(e) => { if (!e.touches || e.touches.length === 0) hold(false); }}
            onTouchCancelCapture={() => hold(false)}
        >
            <SwipeableViews
                index={index}
                onChangeIndex={(i) => onChange(TABS[i].id)}
                disabled={held}
                resistance
                animateHeight={false}
                animateTransitions
                disableLazyLoading
                springConfig={SPRING}
                style={{ height: "100%" }}
                containerStyle={{ height: "100%" }}
                slideStyle={{ height: "100%", overflow: "hidden" }}
            >
                {TABS.map((t, i) => (
                    // Out of view, a panel is inert: still drawn for a swipe to
                    // uncover, but out of reach of Tab, clicks and screen readers
                    // (Tab would otherwise wander from panel to panel).
                    <div key={t.id} className={classes.slide} data-panel={t.id} inert={i !== index}>
                        <PanelActive.Provider value={i === index}>
                            <div className={classes.inner}>{renderPanel(t.id)}</div>
                        </PanelActive.Provider>
                    </div>
                ))}
            </SwipeableViews>
        </div>
    );
}

/** The nearest scrolling box between `node` and `root` is scrolled away from its top. */
function scrolledDown(node, root) {
    for (let n = node; n && n !== root; n = n.parentElement) {
        if (n.scrollTop > 0 && n.scrollHeight > n.clientHeight) {
            const oy = getComputedStyle(n).overflowY;
            if (oy === "auto" || oy === "scroll") return true;
        }
    }
    return false;
}

/**
 * A finger drags the bottom drawer down from anywhere on it (its head too)
 * once the panel under it is scrolled to the top — before that, it scrolls
 * the panel — and not from a slider, the colour wheel or a field. Let go
 * past CLOSE_DRAG px, or flicked down, the drawer closes from where it is;
 * otherwise it springs back.
 */
function useSheetDrag(sheet, onClose) {
    const close = useRef(onClose);
    close.current = onClose;
    useEffect(() => {
        const el = sheet.current;
        if (!el) return undefined;
        let g = null;
        const end = () => {
            const was = g;
            g = null;
            if (!was || !was.dragging) return;
            el.style.transition = "";
            if (was.d > CLOSE_DRAG || (was.v > 0.6 && was.d > 16)) close.current();
            else el.style.transform = "";
        };
        const start = (e) => {
            g = null;
            if (e.touches.length !== 1) return;
            const t = e.target;
            if (t && t.closest && t.closest(NO_SWIPE)) return;
            const p = e.touches[0];
            g = { x: p.clientX, y: p.clientY, target: t, decided: false, dragging: false, d: 0, v: 0, lastY: p.clientY, lastT: e.timeStamp };
        };
        const move = (e) => {
            if (!g) return;
            if (e.touches.length !== 1) { end(); return; }
            const p = e.touches[0], dx = p.clientX - g.x, dy = p.clientY - g.y;
            if (!g.decided) {
                if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
                g.decided = true;
                g.dragging = dy > Math.abs(dx) * 1.2 && !scrolledDown(g.target, el);
                if (!g.dragging) { g = null; return; }
                el.style.transition = "none";
            }
            if (e.cancelable) e.preventDefault();          // the panel does not scroll meanwhile
            const dt = Math.max(1, e.timeStamp - g.lastT);
            g.v = (p.clientY - g.lastY) / dt;
            g.lastY = p.clientY;
            g.lastT = e.timeStamp;
            g.d = Math.max(0, dy);
            el.style.transform = `translateY(${g.d}px)`;
        };
        el.addEventListener("touchstart", start, { passive: true });
        el.addEventListener("touchmove", move, { passive: false });
        el.addEventListener("touchend", end);
        el.addEventListener("touchcancel", end);
        return () => {
            el.removeEventListener("touchstart", start);
            el.removeEventListener("touchmove", move);
            el.removeEventListener("touchend", end);
            el.removeEventListener("touchcancel", end);
        };
    }, [sheet]);
}

/**
 * A swipe on a drawer's head closes it: down for the bottom one, right for
 * the side one. With a mouse or a pen; a finger on the bottom drawer is
 * useSheetDrag's.
 */
function useSwipeToClose(sheet, axis, onClose, { touch = true, enabled = true } = {}) {
    const swipe = useRef(null);
    const onPointerDown = (e) => {
        if (!enabled || (!touch && e.pointerType === "touch")) return;
        if (e.target.closest && e.target.closest("button")) return;
        swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId, d: 0 };
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* synthetic */ }
    };
    const onPointerMove = (e) => {
        const s = swipe.current;
        if (!s || s.id !== e.pointerId || !sheet.current) return;
        s.d = Math.max(0, axis === "x" ? e.clientX - s.x : e.clientY - s.y);
        sheet.current.style.transition = "none";
        sheet.current.style.transform = `translate${axis === "x" ? "X" : "Y"}(${s.d}px)`;
    };
    const onPointerUp = (e) => {
        const s = swipe.current;
        if (!s || s.id !== e.pointerId) return;
        swipe.current = null;
        if (sheet.current) {
            sheet.current.style.transition = "";
            sheet.current.style.transform = "";
        }
        if (s.d > 64) onClose();
    };
    return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp };
}

/**
 * Escape from inside a drawer closes it (and nothing else), then focuses its
 * tab; a pinned drawer stays, and Escape only takes the focus to its tab.
 */
function useEscapeToClose(sheet, tabId, onClose, pinned) {
    return (e) => {
        if (e.key !== "Escape" || e.defaultPrevented) return;
        const t = e.target;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
        e.preventDefault();
        e.stopPropagation();
        const from = sheet.current;
        if (!pinned) onClose();
        requestAnimationFrame(() => focusTab(from, tabId));
    };
}

/**
 * The bottom drawer, a card above the tab bar, `tab` open (null: closed).
 * The panels stay drawn until onExited, so they slide away with the card.
 */
export function Drawer({ open, tabId, label, wide, onChange, onClose, onExited, renderPanel }) {
    const classes = useStyles();
    const sheet = useRef(null);
    const swipe = useSwipeToClose(sheet, "y", onClose, { touch: false });
    const onKeyDown = useEscapeToClose(sheet, tabId, onClose, false);
    useSheetDrag(sheet, onClose);
    // A drawer dragged shut leaves where it was let go; it comes back whole.
    const reset = () => { if (sheet.current) { sheet.current.style.transition = ""; sheet.current.style.transform = ""; } };
    useEffect(() => { if (open) reset(); }, [open]);
    return (
        <Collapse in={open} timeout={220} className={classes.collapse} onExited={() => { reset(); onExited(); }}>
            <div className={classes.sheetGap}>
                <div ref={sheet} className={classes.sheet + (wide ? " " + classes.sheetWide : "")} onKeyDown={onKeyDown} role="region" aria-label={label}>
                    <div className={classes.head} {...swipe}>
                        <span className={classes.handle} />
                        <IconButton size="small" className={classes.close} aria-label={tp("close_panel")} title={tp("close_panel")} onClick={onClose}>
                            <KeyboardArrowDownIcon />
                        </IconButton>
                    </div>
                    {tabId && <PanelViews tab={tabId} onChange={onChange} renderPanel={renderPanel} />}
                </div>
            </div>
        </Collapse>
    );
}

/** The bottom tab bar, with the room above it that separates it from the canvas. */
export function BottomTabs(props) {
    const classes = useStyles();
    return <Tabs {...props} className={classes.bottomBar} />;
}

/**
 * The right-hand column on wide screens: the drawer with the tab bar under
 * it while a panel is open, the upright tabs alone while none is. `pinned`:
 * the drawer cannot be closed (the host keeps a tab open).
 */
export function SideColumn({ tab, onChange, label, pinned, onClose, onExited, renderPanel }) {
    const classes = useStyles();
    const open = !!tab;
    const sheet = useRef(null);
    const column = useRef(null);
    const lastTab = useRef(tab);
    if (tab) lastTab.current = tab;
    const swipe = useSwipeToClose(sheet, "x", onClose, { enabled: !pinned });
    const onKeyDown = useEscapeToClose(sheet, lastTab.current, onClose, pinned);

    // The open side stays drawn while it slides away; a timer rather than
    // transitionend, so it also leaves when transitions are turned off.
    const onExitedRef = useRef(onExited);
    onExitedRef.current = onExited;
    const [present, setPresent] = useState(open);
    useEffect(() => {
        if (open) {
            setPresent(true);
            return undefined;
        }
        const timer = setTimeout(() => {
            setPresent(false);
            onExitedRef.current();
        }, SIDE_MS + 20);
        return () => clearTimeout(timer);
    }, [open]);

    // A tab picked with the keyboard: the bar it was in is about to hide, so
    // the focus follows to the same tab in the bar that shows.
    useEffect(() => {
        const col = column.current;
        const active = document.activeElement;
        if (!col || !active || !col.contains(active) || !active.closest("[role='tablist']")) return;
        const id = open ? tab : lastTab.current;
        requestAnimationFrame(() => focusTab(col, id));
    }, [open]);

    return (
        <div ref={column} className={classes.side} style={{ width: open ? SIDE_WIDTH : RAIL_WIDTH }}>
            {(open || present) && (
                <div className={classes.sideOpen + (open ? "" : " " + classes.gone)}>
                    <div ref={sheet} className={classes.sideSheet} onKeyDown={onKeyDown} role="region" aria-label={label}>
                        <div className={classes.sideHead} {...swipe}>
                            <h2 className={classes.sideTitle}>{label}</h2>
                            {!pinned && (
                                <IconButton size="small" className={classes.sideClose} aria-label={tp("close_panel")} title={tp("close_panel")} onClick={onClose}>
                                    <KeyboardArrowRightIcon />
                                </IconButton>
                            )}
                        </div>
                        <PanelViews tab={lastTab.current} onChange={onChange} renderPanel={renderPanel} />
                    </div>
                    <Tabs tab={tab} onChange={onChange} hidden={!open} className={classes.bottomBar} />
                </div>
            )}
            <div className={classes.sideRail + (open ? " " + classes.gone : "")}>
                <Tabs tab={null} onChange={onChange} vertical hidden={open} />
            </div>
        </div>
    );
}
