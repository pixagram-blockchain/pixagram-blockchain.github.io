// ============================================================================
// pixel-editor/RadialMenu.js — the context menu, as a ring that expands
//
// Right-click, long press, double tap or Shift+F10 on the canvas blooms a
// ring around the pointer, in the look of the app's text-editor radial menu
// (light discs, the hovered name in a dark pill at the centre, active items
// inverted). The inner ring holds the pixa.pics menu sections — Tools and
// Mirror mode when mirroring, Apply to selection when something is selected,
// Color over the art, Effect always — plus View, Undo and Redo. A section
// expands into an outer arc of its actions, centred on it: hover with a
// mouse, tap with a finger, Enter from the keyboard.
//
// The sections and their actions come from the core's menu model
// (buildContextMenu), so they follow pixa.pics' rules for what shows when;
// every action is a command, run with ed.run(id, args).
//
// Keyboard: arrows move around the current ring, Enter opens or runs,
// Escape closes the arc, then the menu.
// ============================================================================

import * as React from "preact/compat";
import { useState, useEffect, useRef, useMemo } from "preact/compat";

import CreateIcon from "@material-ui/icons/Create";
import FlipIcon from "@material-ui/icons/Flip";
import SelectAllIcon from "@material-ui/icons/SelectAll";
import PaletteIcon from "@material-ui/icons/Palette";
import TonalityIcon from "@material-ui/icons/Tonality";
import ZoomInIcon from "@material-ui/icons/ZoomIn";
import ZoomOutIcon from "@material-ui/icons/ZoomOut";
import ZoomOutMapIcon from "@material-ui/icons/ZoomOutMap";
import GridOnIcon from "@material-ui/icons/GridOn";
import GridOffIcon from "@material-ui/icons/GridOff";
import UndoIcon from "@material-ui/icons/Undo";
import RedoIcon from "@material-ui/icons/Redo";
import NotInterestedIcon from "@material-ui/icons/NotInterested";
import BorderInnerIcon from "@material-ui/icons/BorderInner";
import ClearIcon from "@material-ui/icons/Clear";
import FormatPaintIcon from "@material-ui/icons/FormatPaint";
import BlurCircularIcon from "@material-ui/icons/BlurCircular";
import FullscreenIcon from "@material-ui/icons/Fullscreen";
import FullscreenExitIcon from "@material-ui/icons/FullscreenExit";
import BorderOuterIcon from "@material-ui/icons/BorderOuter";
import FormatColorFillIcon from "@material-ui/icons/FormatColorFill";
import CropIcon from "@material-ui/icons/Crop";
import FileCopyIcon from "@material-ui/icons/FileCopy";
import ColorizeIcon from "@material-ui/icons/Colorize";
import FindReplaceIcon from "@material-ui/icons/FindReplace";
import Brightness6Icon from "@material-ui/icons/Brightness6";
import InvertColorsIcon from "@material-ui/icons/InvertColors";
import PhotoFilterIcon from "@material-ui/icons/PhotoFilter";
import GrainIcon from "@material-ui/icons/Grain";
import BlurOnIcon from "@material-ui/icons/BlurOn";
import WavesIcon from "@material-ui/icons/Waves";
import MoreHorizIcon from "@material-ui/icons/MoreHoriz";

import { EraserIcon, ScissorsIcon, InvertSelectionIcon, PixelPerfectIcon } from "./icons";
import { tp, sectionLabel, menuItemLabel } from "./labels";

const R1 = 84;          // inner ring radius
const R2_MAX = 148;     // outer arc radius on roomy screens
const ITEM = 44;        // disc diameter
const ROTATE_90 = { fontSize: 20, transform: "rotate(90deg)" };
const ICON = { fontSize: 20 };

const SECTION_ICONS = {
    "Tools": CreateIcon,
    "Mirror mode": FlipIcon,
    "Apply to selection": SelectAllIcon,
    "Color": PaletteIcon,
    "Effect": TonalityIcon,
};

const ITEM_ICONS = {
    "pencil": [CreateIcon],
    "pencil-perfect": [PixelPerfectIcon],
    "mirror-none": [NotInterestedIcon],
    "mirror-vertical": [FlipIcon],
    "mirror-horizontal": [FlipIcon, ROTATE_90],
    "mirror-both": [BorderInnerIcon],
    "select-clear": [ClearIcon],
    "colorize": [FormatPaintIcon],
    "average": [BlurCircularIcon],
    "select-shrink": [FullscreenExitIcon],
    "select-grow": [FullscreenIcon],
    "border": [BorderOuterIcon],
    "bucket": [FormatColorFillIcon],
    "crop": [CropIcon],
    "select-invert": [InvertSelectionIcon],
    "copy": [FileCopyIcon],
    "cut": [ScissorsIcon],
    "erase": [EraserIcon],
    "picker": [ColorizeIcon],
    "replace": [FindReplaceIcon],
    "contrast": [Brightness6Icon],
    "saturation": [InvertColorsIcon],
    "filter": [PhotoFilterIcon],
    "reduce": [GrainIcon],
    "reduce-auto": [BlurOnIcon],
    "smooth": [WavesIcon],
};

const OVERLAY = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    outline: "none",
    touchAction: "none",
};

const DISC = {
    position: "absolute",
    width: ITEM,
    height: ITEM,
    padding: 0,
    margin: 0,
    borderRadius: "50%",
    border: "none",
    outline: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 6px 18px rgba(0,0,0,0.45)",
    WebkitTapHighlightColor: "transparent",
};

const CENTER_LABEL = {
    position: "absolute",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
    maxWidth: R1 * 2 - ITEM - 4,
    padding: "4px 10px",
    borderRadius: 12,
    backgroundColor: "rgba(16,16,16,0.92)",
    color: "#ffffff",
    fontFamily: `"Industry Book", "Normative Pro"`,
    fontSize: 12,
    lineHeight: 1.3,
    textAlign: "center",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
};

const SWATCH_DOT = {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 16,
    height: 16,
    borderRadius: "50%",
    boxShadow: "0 0 0 2px #101010",
    background: "repeating-conic-gradient(#3a3a3a 0% 25%, #262626 0% 50%) 50% / 6px 6px",
    overflow: "hidden",
};

const polar = (deg, r) => {
    const a = (deg * Math.PI) / 180;
    return [Math.cos(a) * r, Math.sin(a) * r];
};

/** Entries of the inner ring, from the core's model plus View, Undo, Redo. */
function buildRing(ed, model, onOpenTab) {
    const asEntry = (item) => {
        const [Icon, style] = ITEM_ICONS[item.icon] || [MoreHorizIcon];
        return {
            key: item.id + ":" + JSON.stringify(item.args),
            label: menuItemLabel(item),
            Icon,
            iconStyle: style,
            enabled: item.enabled,
            checked: !!item.checked,
            swatch: item.swatch,
            run: () => (item.id === "ui.open" ? onOpenTab(item.args.panel) : ed.run(item.id, item.args)),
        };
    };
    const ring = model.filter((p) => p.kind === "section").map((s) => ({
        key: "section:" + s.title,
        label: sectionLabel(s.title),
        Icon: SECTION_ICONS[s.title] || MoreHorizIcon,
        enabled: true,
        swatch: s.title === "Color" && s.items[0] ? s.items[0].swatch : undefined,
        items: s.items.map(asEntry),
    }));
    const grid = !!(ed.view && ed.view.o && ed.view.o.grid);
    ring.push({
        key: "section:view",
        label: tp("menu_view"),
        Icon: ZoomInIcon,
        enabled: true,
        items: [
            { key: "fit", label: tp("view_fit"), Icon: ZoomOutMapIcon, enabled: ed.can("view.fit", {}), run: () => ed.run("view.fit") },
            { key: "zoom-in", label: tp("view_zoom_in"), Icon: ZoomInIcon, enabled: ed.can("view.zoomIn", {}), run: () => ed.run("view.zoomIn") },
            { key: "zoom-out", label: tp("view_zoom_out"), Icon: ZoomOutIcon, enabled: ed.can("view.zoomOut", {}), run: () => ed.run("view.zoomOut") },
            { key: "grid", label: tp(grid ? "view_grid_off" : "view_grid_on"), Icon: grid ? GridOffIcon : GridOnIcon, enabled: ed.can("view.grid", { on: !grid }), checked: grid, run: () => ed.run("view.grid", { on: !grid }) },
        ],
    });
    ring.push({ key: "undo", label: tp("undo"), Icon: UndoIcon, enabled: ed.history.canUndo(), run: () => ed.undo() });
    ring.push({ key: "redo", label: tp("redo"), Icon: RedoIcon, enabled: ed.history.canRedo(), run: () => ed.redo() });
    return ring;
}

export default function RadialMenu({ ed, menu, onClose, onOpenTab }) {
    const [shown, setShown] = useState(false);
    const [expanded, setExpanded] = useState(-1);
    const [arcShown, setArcShown] = useState(false);
    const [hovered, setHovered] = useState(null);
    // Keyboard focus: null until an arrow or Tab is pressed, so a mouse or a
    // finger never sees a disc light up on its own.
    const [focus, setFocus] = useState(null);
    const discs = useRef(new Map());
    const overlay = useRef(null);

    const ring = useMemo(() => buildRing(ed, menu.model, onOpenTab), [ed, menu, onOpenTab]);
    const header = menu.model.find((p) => p.kind === "header");

    // Geometry: the outer arc shrinks on small screens; the centre keeps the
    // whole flower on screen.
    const W = window.innerWidth, H = window.innerHeight;
    const R2 = Math.max(R1 + 52, Math.min(R2_MAX, Math.min(W, H) / 2 - ITEM / 2 - 10));
    const margin = R2 + ITEM / 2 + 8;
    const clampAxis = (v, size) => (size < margin * 2 ? size / 2 : Math.min(Math.max(v, margin), size - margin));
    const cx = clampAxis(menu.screen.x, W), cy = clampAxis(menu.screen.y, H);

    const step = 360 / ring.length;
    const angleOf = (i) => -90 + i * step;
    const section = expanded >= 0 ? ring[expanded] : null;
    const outer = section && section.items ? section.items : [];
    // Arc spacing: discs 8 px apart on the outer circle, folded to fit 320°.
    const arcStep = Math.min((ITEM + 8) / R2 * (180 / Math.PI), outer.length > 1 ? 320 / (outer.length - 1) : 0);
    const outerAngle = (j) => (section ? angleOf(expanded) + (j - (outer.length - 1) / 2) * arcStep : 0);

    useEffect(() => {
        if (overlay.current) overlay.current.focus({ preventScroll: true });
        const id = requestAnimationFrame(() => setShown(true));
        return () => cancelAnimationFrame(id);
    }, []);

    // A new arc blooms out of its section disc.
    useEffect(() => {
        setArcShown(false);
        if (expanded < 0) return undefined;
        const id = requestAnimationFrame(() => setArcShown(true));
        return () => cancelAnimationFrame(id);
    }, [expanded]);

    useEffect(() => {
        if (!focus) return;
        const el = discs.current.get(focus.ring + ":" + focus.index);
        if (el) el.focus({ preventScroll: true });
    }, [focus, expanded, arcShown]);

    const run = (entry) => {
        if (!entry.enabled) return;
        onClose();
        entry.run();
    };
    const pickInner = (i, viaKeyboard) => {
        const entry = ring[i];
        if (!entry.enabled) return;
        if (entry.items) {
            const open = expanded === i ? -1 : i;
            setExpanded(open);
            if (viaKeyboard && open >= 0) setFocus({ ring: 1, index: 0 });
            return;
        }
        run(entry);
    };

    const onKeyDown = (e) => {
        const at = focus || { ring: 0, index: -1 };
        const count = at.ring === 0 ? ring.length : outer.length;
        const move = (by) => {
            e.preventDefault();
            e.stopPropagation();
            setFocus({ ring: at.ring, index: (at.index + by + count) % count });
        };
        if (e.key === "ArrowRight" || e.key === "ArrowDown") move(1);
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") move(-1);
        else if (e.key === "Escape" || e.key === "Esc") {
            e.preventDefault();
            e.stopPropagation();
            if (at.ring === 1 || expanded >= 0) { setFocus({ ring: 0, index: Math.max(0, expanded) }); setExpanded(-1); }
            else onClose();
        } else if (e.key === "Tab") {
            e.preventDefault();
            move(e.shiftKey ? -1 : 1);
        }
    };

    // Escape also has to win over the canvas zone's own shortcuts.
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape" || e.key === "Esc") onKeyDown(e);
        };
        document.addEventListener("keydown", onKey, true);
        return () => document.removeEventListener("keydown", onKey, true);
    });

    const centreText = hovered ? hovered.label : section ? section.label : header && header.text !== "out" ? header.text : "";

    const disc = (entry, ringIndex, index, dx, dy, delay, active, from) => {
        const isHovered = hovered && hovered.key === entry.key;
        const disabled = !entry.enabled;
        let backgroundColor = "#e9e9e9";
        let color = "#1d1d1d";
        if (disabled) color = "#b5b5b5";
        else if (active) { backgroundColor = isHovered ? "#000000" : "#1d1d1d"; color = "#ffffff"; }
        else if (isHovered) backgroundColor = "#ffffff";
        const Icon = entry.Icon;
        const on = ringIndex === 0 ? shown : arcShown;
        return (
            <button
                key={entry.key}
                ref={(el) => { if (el) discs.current.set(ringIndex + ":" + index, el); else discs.current.delete(ringIndex + ":" + index); }}
                type="button"
                role="menuitem"
                aria-label={entry.label}
                aria-disabled={disabled}
                aria-haspopup={entry.items ? "menu" : undefined}
                aria-expanded={entry.items ? expanded === index : undefined}
                title={entry.label}
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => (ringIndex === 0 ? pickInner(index, false) : run(entry))}
                // Hover expands for a mouse or a pen only: a finger taps, and
                // the mouse events emulated after a tap would undo that tap.
                onPointerEnter={(e) => {
                    if (e.pointerType === "touch") return;
                    setHovered(entry);
                    if (ringIndex === 0 && entry.items && expanded !== index) setExpanded(index);
                }}
                onPointerLeave={(e) => { if (e.pointerType !== "touch") setHovered(null); }}
                onFocus={() => { if (focus) setHovered(entry); }}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        if (ringIndex === 0) pickInner(index, true);
                        else run(entry);
                    }
                }}
                style={{
                    ...DISC,
                    left: cx - ITEM / 2,
                    top: cy - ITEM / 2,
                    cursor: disabled ? "default" : "pointer",
                    backgroundColor,
                    color,
                    opacity: on ? (disabled ? 0.55 : 1) : 0,
                    transform: on
                        ? `translate(${dx}px, ${dy}px) scale(${isHovered && !disabled ? 1.12 : 1})`
                        : `translate(${from[0]}px, ${from[1]}px) scale(0.4)`,
                    transition:
                        `transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1) ${delay}ms, ` +
                        `opacity 150ms ease ${delay}ms, ` +
                        "background-color 120ms ease, color 120ms ease",
                }}
            >
                <Icon style={entry.iconStyle || ICON} />
                {entry.swatch && <span style={SWATCH_DOT}><span style={{ display: "block", width: "100%", height: "100%", background: entry.swatch }} /></span>}
            </button>
        );
    };

    return (
        <div
            ref={overlay}
            tabIndex={-1}
            style={OVERLAY}
            role="menu"
            aria-label={tp("menu")}
            // Pointer events, not mouse/touch: the finger that long-pressed
            // the menu open is still captured by the canvas, and the mouse
            // events a browser emulates when it lifts must not close it.
            onPointerDown={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); onClose(); } }}
            onMouseDown={(e) => { if (e.target === e.currentTarget) e.preventDefault(); }}
            onContextMenu={(e) => {
                e.preventDefault();
                if (e.target !== e.currentTarget) return;
                // A right-click elsewhere on the canvas moves the menu there.
                const zone = ed.view;
                const r = zone && zone.el ? zone.el.getBoundingClientRect() : null;
                if (r && e.clientX >= r.left && e.clientX < r.right && e.clientY >= r.top && e.clientY < r.bottom) zone.openMenu(e.clientX, e.clientY);
                else onClose();
            }}
            onKeyDown={onKeyDown}
        >
            {ring.map((entry, i) => {
                const [dx, dy] = polar(angleOf(i), R1);
                return disc(entry, 0, i, dx, dy, i * 14, expanded === i || entry.checked, [0, 0]);
            })}
            {outer.map((entry, j) => {
                const [dx, dy] = polar(outerAngle(j), R2);
                return disc(entry, 1, j, dx, dy, j * 12, entry.checked, polar(angleOf(expanded), R1));
            })}
            {centreText && (
                <div style={{ ...CENTER_LABEL, left: cx, top: cy }}>{centreText}</div>
            )}
        </div>
    );
}
