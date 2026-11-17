// ============================================================================
// pixel-editor/RadialMenu.js — the context menu, as one round surface
//
// Right-click, long press, double tap or Shift+F10 on the canvas opens a disc
// around the pointer: a hub in the middle naming what the pointer is on (the
// pixel under it at first), ringed by the menu's sections. A section opens
// into a band that hugs the ring around it, centred on it, holding its
// actions. Disc and band are one rounded surface with no gaps: every item is
// a slice of it, so wherever the pointer is on the surface, it is on
// something (the hub closes the menu). Light surface, dark glyphs, the open
// section and active choices inverted — the look of the app's text-editor
// radial menu.
//
// The ring holds the pixa.pics menu sections — Tools and Mirror mode when
// mirroring, Apply to selection when something is selected, Color over the
// art, Effect always — plus View, Undo and Redo. The sections and their
// actions come from the core's menu model (buildContextMenu), so they follow
// pixa.pics' rules for what shows when; every action is a command, run with
// ed.run(id, args).
//
// Mouse or pen: hovering a section opens its band (another section takes
// over only after a short pause, so a diagonal path out to the band does not
// switch it). Finger: a tap opens a section, a tap runs an action. Keyboard:
// arrows move around the current ring, Enter opens or runs, Escape closes the
// band, then the menu.
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

// Geometry, in px from the centre: hub, ring, band.
const HUB = 58;                     // hub radius: the label lives here
const BAND = 54;                    // thickness of the ring and of the band
const RING = HUB + BAND;            // outer edge of the ring
const OUTER = RING + BAND;          // outer edge of the band
const R1 = HUB + BAND / 2;          // glyphs on the ring
const R2 = RING + BAND / 2;         // glyphs on the band
const PILL = BAND - 12;             // thickness of an item's highlight
const ITEM_ARC = 50;                // length of band per action, at R2
const MAX_SWEEP = 300;              // the band never wraps further round (degrees)
const SWITCH_MS = 160;              // hover pause before another section's band takes over
const FILLET = 12;                  // radius rounding the corners where the band meets the ring
const ICON = { fontSize: 20 };
const ROTATE_90 = { fontSize: 20, transform: "rotate(90deg)" };

// Tones: the surface, an item under the pointer, an item that is on.
const SURFACE = "#ececec";
const HOVER = "#d6d6d6";
const ON = "#1d1d1d";
const ON_HOVER = "#000000";
const INK = "#1d1d1d";
const INK_ON = "#ffffff";
const INK_OFF = "#a9a9a9";

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

// A zero-size layer at the overlay's corner: it moves, fades or scales its
// children without covering anything itself.
const LAYER = { position: "absolute", left: 0, top: 0, width: 0, height: 0, overflow: "visible" };

const ITEM = {
    position: "absolute",
    padding: 0,
    margin: 0,
    border: "none",
    outline: "none",
    background: "transparent",
    WebkitTapHighlightColor: "transparent",
};

const GLYPH = {
    position: "absolute",
    width: 24,
    height: 24,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
    transition: "color 120ms ease, transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)",
};

const HUB_LABEL = {
    position: "absolute",
    width: HUB * 2,
    height: HUB * 2,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 12px",
    boxSizing: "border-box",
    textAlign: "center",
    color: INK,
    fontFamily: `"Industry Book", "Normative Pro"`,
    fontSize: 12,
    lineHeight: 1.25,
    overflowWrap: "anywhere",
    WebkitTapHighlightColor: "transparent",
};

const SWATCH_DOT = {
    position: "absolute",
    right: -3,
    bottom: -3,
    width: 14,
    height: 14,
    borderRadius: "50%",
    boxShadow: "0 0 0 1.5px rgba(0,0,0,0.35)",
    background: "repeating-conic-gradient(#3a3a3a 0% 25%, #262626 0% 50%) 50% / 6px 6px",
    overflow: "hidden",
};

const DEG = Math.PI / 180;
const at = (cx, cy, r, deg) => [cx + Math.cos(deg * DEG) * r, cy + Math.sin(deg * DEG) * r];
const n2 = (v) => Math.round(v * 100) / 100;

/**
 * Outline of a slice of ring between radii r0 < r1, from angle a0 to a1
 * (degrees, clockwise from 3 o'clock), each end straight or rounded off, in
 * coordinates shifted by (ox, oy). The same outline draws the band and
 * clips each item's button to its slice.
 */
function slicePath(cx, cy, r0, r1, a0, a1, roundStart, roundEnd, ox = 0, oy = 0) {
    const p = (r, a) => {
        const [x, y] = at(cx, cy, r, a);
        return `${n2(x - ox)} ${n2(y - oy)}`;
    };
    const large = a1 - a0 > 180 ? 1 : 0, h = n2((r1 - r0) / 2);
    return `M ${p(r1, a0)} A ${r1} ${r1} 0 ${large} 1 ${p(r1, a1)} ` +
        (roundEnd ? `A ${h} ${h} 0 0 1 ${p(r0, a1)} ` : `L ${p(r0, a1)} `) +
        `A ${r0} ${r0} 0 ${large} 0 ${p(r0, a0)} ` +
        (roundStart ? `A ${h} ${h} 0 0 1 ${p(r1, a0)} ` : `L ${p(r1, a0)} `) + "Z";
}

/** Bounding box of such a slice, rounded ends included. */
function sliceBox(cx, cy, r0, r1, a0, a1, roundStart, roundEnd) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = ([x, y]) => {
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    };
    const steps = Math.max(2, Math.ceil((a1 - a0) / 3));
    for (let k = 0; k <= steps; k++) {
        const a = a0 + ((a1 - a0) * k) / steps;
        add(at(cx, cy, r0, a));
        add(at(cx, cy, r1, a));
    }
    const h = (r1 - r0) / 2, rm = (r0 + r1) / 2;
    [[a0, roundStart], [a1, roundEnd]].forEach(([a, round]) => {
        if (!round) return;
        const [mx, my] = at(cx, cy, rm, a);
        add([mx - h, my - h]);
        add([mx + h, my + h]);
    });
    const x = Math.floor(x0) - 1, y = Math.floor(y0) - 1;
    return { x, y, w: Math.ceil(x1) + 2 - x, h: Math.ceil(y1) + 2 - y };
}

/**
 * The inside corner where a band's rounded end (centre at radius rc, radius
 * h) meets the ring (radius `ring`), filled round with a fillet of radius f:
 * `side` +1 past the band's end angle a, -1 before its start.
 */
function filletPath(cx, cy, ring, rc, h, a, side, f) {
    const R = ring + f, S = h + f;
    const x = (R * R - S * S + rc * rc) / (2 * rc), y2 = R * R - x * x;
    if (!(y2 > 0)) return "";
    const y = side * Math.sqrt(y2);
    // In the frame turned by a: the centre at 0, the band's end at (rc, 0).
    const cos = Math.cos(a * DEG), sin = Math.sin(a * DEG);
    const toScreen = (px, py) => [cx + px * cos - py * sin, cy + px * sin + py * cos];
    const [fx, fy] = toScreen(x, y);
    const [ex, ey] = toScreen(rc, 0);
    const t1 = [cx + ((fx - cx) * ring) / R, cy + ((fy - cy) * ring) / R];
    const t2 = [ex + ((fx - ex) * h) / S, ey + ((fy - ey) * h) / S];
    const cross = (t1[0] - fx) * (t2[1] - fy) - (t1[1] - fy) * (t2[0] - fx);
    const p = ([px, py]) => `${n2(px)} ${n2(py)}`;
    return `M ${p(t1)} A ${f} ${f} 0 0 ${cross > 0 ? 1 : 0} ${p(t2)} L ${p([ex, ey])} L ${p([cx, cy])} Z`;
}

/** An item's highlight: a pill along the ring, or a disc when its slice is short. */
function pillShape(cx, cy, r, a0, a1) {
    const cap = (PILL / 2 + 3) / r / DEG;
    const b0 = a0 + cap, b1 = a1 - cap;
    if (b1 - b0 > 0.5) {
        const p = (a) => at(cx, cy, r, a).map(n2).join(" ");
        return { d: `M ${p(b0)} A ${r} ${r} 0 ${b1 - b0 > 180 ? 1 : 0} 1 ${p(b1)}` };
    }
    const [x, y] = at(cx, cy, r, (a0 + a1) / 2);
    return { x, y, r: Math.max(12, Math.min(PILL / 2, ((a1 - a0) * DEG * r) / 2 - 3)) };
}

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
    const [expanded, setExpandedState] = useState(-1);
    // Also kept in a ref: two quick key presses must see each other's change.
    const expandedRef = useRef(-1);
    const setExpanded = (i) => {
        expandedRef.current = i;
        setExpandedState(i);
    };
    const [bandShown, setBandShown] = useState(false);
    const [hovered, setHovered] = useState(null);
    // Keyboard focus: null until an arrow or Tab is pressed, so a mouse or a
    // finger never sees an item light up on its own.
    const [focus, setFocus] = useState(null);
    const items = useRef(new Map());
    const overlay = useRef(null);
    const switching = useRef(0);
    const hubDown = useRef(null);
    // How the last press came: a mouse click on a section keeps it open (its
    // band opened on hover already), a tap opens or closes it.
    const pressedBy = useRef("");

    const ring = useMemo(() => buildRing(ed, menu.model, onOpenTab), [ed, menu, onOpenTab]);
    const header = menu.model.find((p) => p.kind === "header");

    // The centre keeps the whole surface, band included, on screen.
    const W = window.innerWidth, H = window.innerHeight;
    const margin = OUTER + 10;
    const clampAxis = (v, size) => (size < margin * 2 ? size / 2 : Math.min(Math.max(v, margin), size - margin));
    const cx = clampAxis(menu.screen.x, W), cy = clampAxis(menu.screen.y, H);

    // The ring: one slice per entry, the first at 12 o'clock.
    const step = 360 / ring.length;
    const angleOf = (i) => -90 + i * step;
    // The band: one slice per action, centred on its section.
    const section = expanded >= 0 ? ring[expanded] : null;
    const outer = section && section.items ? section.items : [];
    const arcStep = outer.length ? Math.min(ITEM_ARC / R2 / DEG, MAX_SWEEP / outer.length) : 0;
    const band0 = section ? angleOf(expanded) - (outer.length * arcStep) / 2 : 0;

    useEffect(() => {
        if (overlay.current) overlay.current.focus({ preventScroll: true });
        const id = requestAnimationFrame(() => setShown(true));
        return () => {
            cancelAnimationFrame(id);
            clearTimeout(switching.current);
        };
    }, []);

    // A new band fades in around its section.
    useEffect(() => {
        setBandShown(false);
        if (expanded < 0) return undefined;
        const id = requestAnimationFrame(() => setBandShown(true));
        return () => cancelAnimationFrame(id);
    }, [expanded]);

    useEffect(() => {
        if (!focus) return;
        const el = items.current.get(focus.ring + ":" + focus.index);
        if (el) el.focus({ preventScroll: true });
    }, [focus, expanded, bandShown]);

    const run = (entry) => {
        if (!entry.enabled) return;
        onClose();
        entry.run();
    };
    const pickInner = (i, viaKeyboard) => {
        clearTimeout(switching.current);
        const entry = ring[i];
        if (!entry.enabled) return;
        if (entry.items) {
            const hovering = !viaKeyboard && (pressedBy.current === "mouse" || pressedBy.current === "pen");
            const open = expandedRef.current === i && !hovering ? -1 : i;
            setExpanded(open);
            if (viaKeyboard && open >= 0) setFocus({ ring: 1, index: 0 });
            return;
        }
        run(entry);
    };
    // Hover opens a section's band at once when none is open; another one
    // replaces it only if the pointer stays on it a moment.
    const hoverSection = (i) => {
        clearTimeout(switching.current);
        if (expandedRef.current === i) return;
        if (expandedRef.current < 0) setExpanded(i);
        else switching.current = setTimeout(() => setExpanded(i), SWITCH_MS);
    };

    const onKeyDown = (e) => {
        const now = focus || { ring: 0, index: -1 };
        const count = now.ring === 0 ? ring.length : outer.length;
        const move = (by) => {
            e.preventDefault();
            e.stopPropagation();
            setFocus({ ring: now.ring, index: (now.index + by + count) % count });
        };
        if (e.key === "ArrowRight" || e.key === "ArrowDown") move(1);
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") move(-1);
        else if (e.key === "Escape" || e.key === "Esc") {
            e.preventDefault();
            e.stopPropagation();
            const open = expandedRef.current;
            if (open >= 0) { setFocus({ ring: 0, index: open }); setExpanded(-1); }
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

    // Every item: its slice (the button, clipped to it), its glyph, and the
    // pill that lights up under it.
    const slices = [];
    ring.forEach((entry, i) => slices.push({
        entry, level: 0, index: i, r0: HUB, r1: RING, r: R1,
        a0: angleOf(i) - step / 2, a1: angleOf(i) + step / 2, roundStart: false, roundEnd: false,
        active: expanded === i || entry.checked,
    }));
    outer.forEach((entry, j) => slices.push({
        entry, level: 1, index: j, r0: RING, r1: OUTER, r: R2,
        a0: band0 + j * arcStep, a1: band0 + (j + 1) * arcStep, roundStart: j === 0, roundEnd: j === outer.length - 1,
        active: entry.checked,
    }));

    const pill = (sl) => {
        const { entry, active } = sl;
        const lit = hovered && hovered.key === entry.key && entry.enabled;
        const shape = pillShape(cx, cy, sl.r, sl.a0, sl.a1);
        const color = active ? (lit ? ON_HOVER : ON) : HOVER;
        const style = { opacity: active || lit ? 1 : 0, transition: "opacity 120ms ease, stroke 120ms ease, fill 120ms ease" };
        return shape.d
            ? <path key={sl.level + ":" + entry.key} d={shape.d} fill="none" stroke={color} strokeWidth={PILL} strokeLinecap="round" style={style} />
            : <circle key={sl.level + ":" + entry.key} cx={shape.x} cy={shape.y} r={shape.r} fill={color} style={style} />;
    };

    const button = (sl) => {
        const { entry, level, index } = sl;
        const box = sliceBox(cx, cy, sl.r0, sl.r1, sl.a0, sl.a1, sl.roundStart, sl.roundEnd);
        const clip = `path("${slicePath(cx, cy, sl.r0, sl.r1, sl.a0, sl.a1, sl.roundStart, sl.roundEnd, box.x, box.y)}")`;
        const [gx, gy] = at(cx, cy, sl.r, (sl.a0 + sl.a1) / 2);
        const disabled = !entry.enabled;
        const lit = hovered && hovered.key === entry.key && !disabled;
        const Icon = entry.Icon;
        return (
            <button
                key={level + ":" + entry.key}
                ref={(el) => { if (el) items.current.set(level + ":" + index, el); else items.current.delete(level + ":" + index); }}
                type="button"
                role="menuitem"
                aria-label={entry.label}
                aria-disabled={disabled}
                aria-haspopup={entry.items ? "menu" : undefined}
                aria-expanded={entry.items ? expanded === index : undefined}
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onPointerDown={(e) => { pressedBy.current = e.pointerType; }}
                onClick={() => (level === 0 ? pickInner(index, false) : run(entry))}
                // Hover opens bands for a mouse or a pen only: a finger taps,
                // and the mouse events emulated after a tap would undo it.
                onPointerEnter={(e) => {
                    if (e.pointerType === "touch") return;
                    setHovered(entry);
                    if (level === 0 && entry.items) hoverSection(index);
                    else if (level === 0) clearTimeout(switching.current);
                }}
                onPointerLeave={(e) => {
                    if (e.pointerType === "touch") return;
                    setHovered((h) => (h && h.key === entry.key ? null : h));
                    if (level === 0) clearTimeout(switching.current);
                }}
                onFocus={() => { if (focus) setHovered(entry); }}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        if (level === 0) pickInner(index, true);
                        else run(entry);
                    }
                }}
                style={{
                    ...ITEM,
                    left: box.x,
                    top: box.y,
                    width: box.w,
                    height: box.h,
                    clipPath: clip,
                    WebkitClipPath: clip,
                    cursor: disabled ? "default" : "pointer",
                    color: disabled ? INK_OFF : sl.active ? INK_ON : INK,
                }}
            >
                <span style={{ ...GLYPH, left: gx - box.x - 12, top: gy - box.y - 12, transform: lit ? "scale(1.12)" : "none" }}>
                    <Icon style={entry.iconStyle || ICON} />
                    {entry.swatch && <span style={SWATCH_DOT}><span style={{ display: "block", width: "100%", height: "100%", background: entry.swatch }} /></span>}
                </span>
            </button>
        );
    };

    const inner = slices.filter((sl) => sl.level === 0), band = slices.filter((sl) => sl.level === 1);
    const bloom = {
        ...LAYER,
        transformOrigin: `${cx}px ${cy}px`,
        transform: shown ? "none" : "scale(0.82)",
        opacity: shown ? 1 : 0,
        transition: "transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 140ms ease",
    };
    const fade = { ...LAYER, opacity: bandShown ? 1 : 0, transition: "opacity 160ms ease" };

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
            <div style={bloom}>
                <svg
                    width={W}
                    height={H}
                    aria-hidden="true"
                    style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none", filter: "drop-shadow(0 10px 26px rgba(0, 0, 0, 0.5))" }}
                >
                    <circle cx={cx} cy={cy} r={RING} fill={SURFACE} />
                    {section && (
                        // Two pixels under the ring's edge, so the two meet without
                        // a seam; the inside corners at its ends filled round.
                        <g style={{ opacity: bandShown ? 1 : 0, transition: "opacity 160ms ease" }} fill={SURFACE}>
                            <path d={slicePath(cx, cy, RING - 2, OUTER, band0, band0 + outer.length * arcStep, true, true)} />
                            <path d={filletPath(cx, cy, RING, (RING - 2 + OUTER) / 2, (OUTER - RING + 2) / 2, band0, -1, FILLET)} />
                            <path d={filletPath(cx, cy, RING, (RING - 2 + OUTER) / 2, (OUTER - RING + 2) / 2, band0 + outer.length * arcStep, 1, FILLET)} />
                        </g>
                    )}
                    {inner.map(pill)}
                    <g style={{ opacity: bandShown ? 1 : 0, transition: "opacity 160ms ease" }}>{band.map(pill)}</g>
                </svg>
                {inner.map(button)}
                <div style={fade}>{band.map(button)}</div>
                <div
                    role="presentation"
                    style={{ ...HUB_LABEL, left: cx - HUB, top: cy - HUB }}
                    // A tap on the hub closes the menu: down and up both on it,
                    // so the tap that opened the menu (a double tap) does not.
                    onPointerDown={(e) => { hubDown.current = e.pointerId; }}
                    onPointerUp={(e) => { if (hubDown.current === e.pointerId) onClose(); hubDown.current = null; }}
                    onPointerCancel={() => { hubDown.current = null; }}
                    onPointerEnter={(e) => { if (e.pointerType !== "touch") clearTimeout(switching.current); }}
                >
                    <span style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{centreText}</span>
                </div>
            </div>
        </div>
    );
}
