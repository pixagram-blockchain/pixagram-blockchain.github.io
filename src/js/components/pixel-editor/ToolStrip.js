// ============================================================================
// pixel-editor/ToolStrip.js — the tools: a rail on the left of wide screens,
// a scrolling toolbar across the top of phones
//
// Round 44 px buttons; the active tool is inverted (light disc, dark glyph),
// the app's convention for "this one is on". The paint colours close the
// strip and stay in place while the tools scroll: a tap opens the Colors
// panel, a long press or right-click swaps them. When tools are cut off, the
// cut edge fades out to say "there is more".
// ============================================================================

import * as React from "preact/compat";
import { useRef, useState, useLayoutEffect } from "preact/compat";
import makeStyles from "@material-ui/core/styles/makeStyles";
import ButtonBase from "@material-ui/core/ButtonBase";
import Tooltip from "@material-ui/core/Tooltip";

import CreateIcon from "@material-ui/icons/Create";
import ColorizeIcon from "@material-ui/icons/Colorize";
import OpenWithIcon from "@material-ui/icons/OpenWith";
import CropFreeIcon from "@material-ui/icons/CropFree";
import PanoramaFishEyeIcon from "@material-ui/icons/PanoramaFishEye";
import GestureIcon from "@material-ui/icons/Gesture";

import {
    EraserIcon, MagicWandIcon, ColorSelectIcon, LineSelectIcon, BrushSelectIcon, MirrorAxisIcon,
} from "./icons";
import { TOOL_IDS, TOOL_KEYS, toolLabel, tp } from "./labels";
import { useEditorEvents, cssColor } from "./editorUtils";
import { EASE } from "./ui";

export const TOOL_ICONS = {
    "pencil": CreateIcon,
    "eraser": EraserIcon,
    "picker": ColorizeIcon,
    "move": OpenWithIcon,
    "select-rect": CropFreeIcon,
    "select-ellipse": PanoramaFishEyeIcon,
    "select-line": LineSelectIcon,
    "select-path": GestureIcon,
    "select-brush": BrushSelectIcon,
    "select-area": MagicWandIcon,
    "select-color": ColorSelectIcon,
    "mirror-axis": MirrorAxisIcon,
};

/** The tool the strip shows as active (the eraser is the pencil erasing). */
export const activeToolKey = (ed) => (ed.activeToolId === "pencil" && ed.brush.blend === "erase" ? "eraser" : ed.activeToolId);

export function chooseTool(ed, id) {
    if (id === "eraser") ed.useTool("pencil", { blend: "erase" });
    else if (id === "pencil") ed.useTool("pencil", ed.brush.blend === "erase" ? { blend: "over" } : undefined);
    else ed.useTool(id);
}

// Transparent colours show over a checkerboard.
const CHECKER = "repeating-conic-gradient(#3a3a3a 0% 25%, #262626 0% 50%) 50% / 8px 8px";

const FADE = 28;
const fade = (dir, start, end) => {
    if (!start && !end) return undefined;
    const a = start ? `transparent 0, #000 ${FADE}px` : "#000 0";
    const b = end ? `#000 calc(100% - ${FADE}px), transparent 100%` : "#000 100%";
    return `linear-gradient(${dir}, ${a}, ${b})`;
};

const useStyles = makeStyles({
    rail: {
        flex: "0 0 auto",
        width: 64,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "0 0 12px",
        backgroundColor: "#000",
    },
    strip: {
        flex: "0 0 auto",
        height: 56,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        padding: "0 8px 0 0",
        backgroundColor: "#000",
    },
    scrollV: {
        flex: "1 1 auto",
        minHeight: 0,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        padding: "8px 0",
        overflowY: "auto",
        overflowX: "hidden",
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": { display: "none" },
    },
    scrollH: {
        flex: "1 1 auto",
        minWidth: 0,
        height: "100%",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        padding: "0 8px",
        overflowX: "auto",
        overflowY: "hidden",
        scrollbarWidth: "none",
        overscrollBehaviorX: "contain",
        "&::-webkit-scrollbar": { display: "none" },
    },
    gap: {
        flex: "0 0 auto",
        width: 10,
        height: 10,
    },
    tool: {
        flex: "0 0 auto",
        width: 44,
        height: 44,
        borderRadius: "50%",
        color: "#bbbbbb",
        transition: `background-color 160ms ${EASE}, color 160ms ${EASE}, transform 160ms ${EASE}`,
        "&:hover": { backgroundColor: "#212121", color: "#ffffff" },
        "&.Mui-focusVisible": { backgroundColor: "#2a2a2a", color: "#ffffff" },
        "& .MuiSvgIcon-root": { fontSize: 22 },
    },
    toolOn: {
        backgroundColor: "#e9e9e9 !important",
        color: "#1d1d1d !important",
    },
    swatches: {
        flex: "0 0 auto",
        position: "relative",
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: "#262626",   // light enough for a black colour to show
        transition: `background-color 160ms ${EASE}`,
        "&:hover": { backgroundColor: "#313131" },
    },
    swatch: {
        position: "absolute",
        borderRadius: "50%",
        overflow: "hidden",
        background: CHECKER,
        boxShadow: "0 2px 6px rgba(0,0,0,0.55)",
        "& > span": { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    },
    primary: { width: 26, height: 26, left: 7, top: 7, zIndex: 1 },
    secondary: { width: 20, height: 20, right: 7, bottom: 7 },
});

/** Which ends of a scroller have content cut off. */
function useOverflowEdges(ref, vertical) {
    const [edges, setEdges] = useState({ start: false, end: false });
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        const measure = () => {
            const pos = vertical ? el.scrollTop : el.scrollLeft;
            const size = vertical ? el.clientHeight : el.clientWidth;
            const total = vertical ? el.scrollHeight : el.scrollWidth;
            const start = pos > 1;
            const end = pos + size < total - 1;
            setEdges((e) => (e.start === start && e.end === end ? e : { start, end }));
        };
        measure();
        el.addEventListener("scroll", measure, { passive: true });
        const ro = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
        if (ro) ro.observe(el);
        else window.addEventListener("resize", measure);
        return () => {
            el.removeEventListener("scroll", measure);
            if (ro) ro.disconnect();
            else window.removeEventListener("resize", measure);
        };
    }, [ref, vertical]);
    return edges;
}

export default function ToolStrip({ ed, vertical, onOpenColors }) {
    const classes = useStyles();
    useEditorEvents(ed, ["tool", "brush", "colors"]);
    const active = activeToolKey(ed);
    const press = useRef({ timer: 0, swapped: false });

    // Long press on the swatches swaps the colours (touch has no right button).
    const onSwatchDown = () => {
        press.current.swapped = false;
        clearTimeout(press.current.timer);
        press.current.timer = setTimeout(() => {
            press.current.swapped = true;
            ed.run("color.swap");
        }, 500);
    };
    const onSwatchUp = () => clearTimeout(press.current.timer);
    const onSwatchClick = () => {
        if (press.current.swapped) return;
        onOpenColors();
    };
    // Right-click swaps; so does a long press, which on Android also fires
    // contextmenu — the flag keeps that from swapping twice.
    const onSwatchMenu = (e) => {
        e.preventDefault();
        clearTimeout(press.current.timer);
        if (press.current.swapped) return;
        press.current.swapped = true;
        ed.run("color.swap");
    };

    const scroller = useRef(null);
    const edges = useOverflowEdges(scroller, vertical);
    const mask = fade(vertical ? "to bottom" : "to right", edges.start, edges.end);
    const maskStyle = mask ? { WebkitMaskImage: mask, maskImage: mask } : undefined;

    return (
        <nav className={vertical ? classes.rail : classes.strip} aria-label={tp("tools")}>
            <div ref={scroller} className={vertical ? classes.scrollV : classes.scrollH} style={maskStyle}>
                {TOOL_IDS.map((id, i) => {
                    if (id === null) return <span key={"gap" + i} className={classes.gap} />;
                    const Icon = TOOL_ICONS[id];
                    const on = active === id;
                    const key = TOOL_KEYS[id];
                    return (
                        <Tooltip key={id} title={key ? `${toolLabel(id)} (${key})` : toolLabel(id)} placement={vertical ? "right" : "bottom"}>
                            <ButtonBase
                                className={classes.tool + (on ? " " + classes.toolOn : "")}
                                aria-label={toolLabel(id)}
                                aria-pressed={on}
                                onClick={() => chooseTool(ed, id)}
                            >
                                <Icon />
                            </ButtonBase>
                        </Tooltip>
                    );
                })}
            </div>
            <Tooltip title={tp("colors_hint")} placement={vertical ? "right" : "bottom"}>
                <ButtonBase
                    className={classes.swatches}
                    aria-label={tp("tab_colors")}
                    onClick={onSwatchClick}
                    onPointerDown={onSwatchDown}
                    onPointerUp={onSwatchUp}
                    onPointerLeave={onSwatchUp}
                    onPointerCancel={onSwatchUp}
                    onContextMenu={onSwatchMenu}
                >
                    <span className={classes.swatch + " " + classes.primary}><span style={{ background: cssColor(ed.colors.primary) }} /></span>
                    <span className={classes.swatch + " " + classes.secondary}><span style={{ background: cssColor(ed.colors.secondary) }} /></span>
                </ButtonBase>
            </Tooltip>
        </nav>
    );
}
