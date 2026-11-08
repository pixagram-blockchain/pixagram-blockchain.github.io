// ============================================================================
// pixel-editor/BottomBar.js — bottom tabs and the drawer they open
//
// Seven tabs along the bottom; a tab opens its panel in a drawer. On phones
// and tablets held upright the drawer rises between the canvas and the tabs;
// on wide screens (and phones on their side, too short for that) it slides
// in from the right instead, beside the canvas. Either way the canvas gives
// up the drawer's room rather than being covered, so the whole image stays
// in view while a preview runs (it refits on its own until the user zooms).
// The same tab again, the drawer's close button, a swipe on its head (down
// for the bottom drawer, right for the side one) or Escape from inside it
// closes it.
//
// On phones the tabs show icons, with the label of the open one; from 600 px
// up every tab shows its label.
// ============================================================================

import * as React from "preact/compat";
import { useRef, useState, useEffect } from "preact/compat";
import makeStyles from "@material-ui/core/styles/makeStyles";
import BottomNavigation from "@material-ui/core/BottomNavigation";
import BottomNavigationAction from "@material-ui/core/BottomNavigationAction";
import Collapse from "@material-ui/core/Collapse";
import IconButton from "@material-ui/core/IconButton";

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
import { EASE } from "./ui";

/** Width of the side drawer, and how long it takes to slide. */
export const SIDE_WIDTH = 380;
const SIDE_MS = 220;

export const TABS = [
    { id: "layers", Icon: LayersIcon, label: "tab_layers" },
    { id: "colors", Icon: PaletteIcon, label: "tab_colors" },
    { id: "tool", Icon: TuneIcon, label: "tab_tool" },
    { id: "select", Icon: SelectAllIcon, label: "tab_select" },
    { id: "effects", Icon: TonalityIcon, label: "tab_effects" },
    { id: "filters", Icon: PhotoFilterIcon, label: "tab_filters" },
    { id: "history", Icon: HistoryIcon, label: "tab_history" },
];

const useStyles = makeStyles({
    collapse: {
        flex: "0 0 auto",
        position: "relative",
        zIndex: 2,
    },
    sheet: {
        position: "relative",
        display: "flex",
        flexDirection: "column",
        maxHeight: "calc(var(--app-h, 100vh) * 0.46)",
        borderRadius: "21px 21px 0 0",
        backgroundColor: "#101010",
        boxShadow: "0 -10px 32px rgba(0,0,0,0.55)",
        transition: `transform 200ms ${EASE}`,
        willChange: "transform",
    },
    sheetWide: {
        maxHeight: "calc(var(--app-h, 100vh) * 0.42)",
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
        backgroundColor: "#3c3c3c",
    },
    close: {
        position: "absolute",
        right: 8,
        top: 2,
        color: "#8a8a8a",
        "&:hover": { color: "#ffffff" },
    },
    content: {
        flex: "1 1 auto",
        minHeight: 0,
        overflowY: "auto",
        overscrollBehavior: "contain",
        padding: "0 16px 16px",
    },
    inner: {
        maxWidth: 760,
        margin: "0 auto",
    },
    // Side drawer: the wrapper's width animates; the sheet keeps its own
    // width the whole time, so the panel never reflows while it slides.
    sideWrap: {
        flex: "0 0 auto",
        position: "relative",
        zIndex: 2,
        overflow: "hidden",
        transition: `width ${SIDE_MS}ms ${EASE}`,
    },
    sideSheet: {
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        width: SIDE_WIDTH,
        display: "flex",
        flexDirection: "column",
        borderRadius: "21px 0 0 21px",
        backgroundColor: "#101010",
        boxShadow: "-10px 0 32px rgba(0,0,0,0.55)",
        transition: `transform 200ms ${EASE}`,
        willChange: "transform",
    },
    sideHead: {
        flex: "0 0 auto",
        height: 44,
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        padding: "0 8px",
        touchAction: "none",
    },
    sideClose: {
        color: "#8a8a8a",
        "&:hover": { color: "#ffffff" },
    },
    tabs: {
        flex: "0 0 auto",
        height: "auto",
        minHeight: 60,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        backgroundColor: "#000000",
        position: "relative",
        zIndex: 3,
    },
    tab: {
        minWidth: 0,
        maxWidth: "none",
        flex: 1,
        padding: "6px 0 8px",
        color: "rgba(255, 255, 255, 0.5)",
        transition: `color 225ms ${EASE}`,
        "&:hover": { color: "rgba(255, 255, 255, 0.85)" },
        "& .MuiBottomNavigationAction-label": {
            fontFamily: `"Industry Book", "Normative Pro"`,
            fontSize: "11px !important",
            letterSpacing: "0.02em",
            marginTop: 2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "100%",
        },
        "& .MuiSvgIcon-root": { fontSize: 22 },
    },
    tabOn: {
        color: "#ffffff !important",
    },
});

/**
 * The drawer. `open` false closes it; the panel stays drawn until onExited,
 * so it slides away with its content. `side` puts it on the right.
 */
export function Drawer({ open, label, wide, side, onClose, onExited, children }) {
    const classes = useStyles();
    const sheet = useRef(null);
    const swipe = useRef(null);
    const onExitedRef = useRef(onExited);
    onExitedRef.current = onExited;

    // The side sheet stays mounted while it slides out; a timer rather than
    // transitionend, so it also leaves when transitions are turned off.
    const [present, setPresent] = useState(!!open);
    useEffect(() => {
        if (!side) return undefined;
        if (open) {
            setPresent(true);
            return undefined;
        }
        const timer = setTimeout(() => {
            setPresent(false);
            onExitedRef.current();
        }, SIDE_MS + 20);
        return () => clearTimeout(timer);
    }, [side, open]);

    // A swipe on the head closes the drawer: down for the bottom one, right
    // for the side one.
    const onDown = (e) => {
        if (e.target.closest && e.target.closest("button")) return;
        swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId, d: 0 };
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* synthetic */ }
    };
    const onMove = (e) => {
        const s = swipe.current;
        if (!s || s.id !== e.pointerId || !sheet.current) return;
        s.d = Math.max(0, side ? e.clientX - s.x : e.clientY - s.y);
        sheet.current.style.transition = "none";
        sheet.current.style.transform = side ? `translateX(${s.d}px)` : `translateY(${s.d}px)`;
    };
    const onUp = (e) => {
        const s = swipe.current;
        if (!s || s.id !== e.pointerId) return;
        swipe.current = null;
        if (sheet.current) {
            sheet.current.style.transition = "";
            sheet.current.style.transform = "";
        }
        if (s.d > 64) onClose();
    };
    const swipeHandlers = { onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onUp };

    // Escape with the focus inside the drawer closes it (and nothing else).
    const onKeyDown = (e) => {
        if (e.key === "Escape" && !e.defaultPrevented) {
            const t = e.target;
            if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
            e.preventDefault();
            e.stopPropagation();
            // The panel is about to unmount with the focus in it: hand the
            // focus to the tab that opened it.
            const dialog = sheet.current && sheet.current.closest("[role='dialog']");
            const tab = dialog && dialog.querySelector(".MuiBottomNavigation-root [aria-expanded='true']");
            if (tab) tab.focus();
            onClose();
        }
    };

    const closeButton = (Icon, className) => (
        <IconButton size="small" className={className} aria-label={tp("close_panel")} title={tp("close_panel")} onClick={onClose}>
            <Icon />
        </IconButton>
    );

    if (side) {
        return (
            <div className={classes.sideWrap} style={{ width: open ? SIDE_WIDTH : 0 }}>
                {(open || present) && (
                    <div ref={sheet} className={classes.sideSheet} onKeyDown={onKeyDown} role="region" aria-label={label}>
                        <div className={classes.sideHead} {...swipeHandlers}>
                            {closeButton(KeyboardArrowRightIcon, classes.sideClose)}
                        </div>
                        <div className={classes.content}>
                            <div className={classes.inner}>{children}</div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <Collapse in={open} timeout={220} className={classes.collapse} onExited={onExited}>
            <div ref={sheet} className={classes.sheet + (wide ? " " + classes.sheetWide : "")} onKeyDown={onKeyDown} role="region" aria-label={label}>
                <div className={classes.head} {...swipeHandlers}>
                    <span className={classes.handle} />
                    {closeButton(KeyboardArrowDownIcon, classes.close)}
                </div>
                <div className={classes.content}>
                    <div className={classes.inner}>{children}</div>
                </div>
            </div>
        </Collapse>
    );
}

export function Tabs({ tab, wide, onChange }) {
    const classes = useStyles();
    return (
        <BottomNavigation
            className={classes.tabs}
            value={tab || false}
            showLabels={wide}
            onChange={(e, value) => onChange(value === tab ? null : value)}
        >
            {TABS.map((t) => (
                <BottomNavigationAction
                    key={t.id}
                    value={t.id}
                    label={tp(t.label)}
                    icon={<t.Icon />}
                    className={classes.tab + (tab === t.id ? " " + classes.tabOn : "")}
                    aria-label={tp(t.label)}
                    aria-expanded={tab === t.id}
                />
            ))}
        </BottomNavigation>
    );
}
