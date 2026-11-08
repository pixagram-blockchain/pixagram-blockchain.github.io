// ============================================================================
// pixel-editor/panels/LayersPanel.js — layers, top first, reordered by drag
//
// Each row: drag handle, thumbnail, name and facts, visibility, lock. The
// handle drags with mouse, pen or finger (pointer events, so it works the
// same on phones): the row follows the pointer, the others make room, and
// the drop is one "Move layer" step. Arrow keys on a focused handle move the
// layer too. The sheet scrolls by itself when the drag nears its edges.
// ============================================================================

import * as React from "preact/compat";
import { useState, useRef, useLayoutEffect } from "preact/compat";
import makeStyles from "@material-ui/core/styles/makeStyles";
import ButtonBase from "@material-ui/core/ButtonBase";
import IconButton from "@material-ui/core/IconButton";
import InputBase from "@material-ui/core/InputBase";
import Tooltip from "@material-ui/core/Tooltip";

import DragIndicatorIcon from "@material-ui/icons/DragIndicator";
import VisibilityIcon from "@material-ui/icons/Visibility";
import VisibilityOffIcon from "@material-ui/icons/VisibilityOff";
import LockIcon from "@material-ui/icons/Lock";
import LockOpenIcon from "@material-ui/icons/LockOpen";
import AddIcon from "@material-ui/icons/Add";
import FileCopyIcon from "@material-ui/icons/FileCopy";
import CallMergeIcon from "@material-ui/icons/CallMerge";
import MergeTypeIcon from "@material-ui/icons/MergeType";
import EditIcon from "@material-ui/icons/Edit";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";

import { tp, layerName, layerCopyName } from "../labels";
import { useEditorEvents, thumbPixels, paintPixels } from "../editorUtils";
import { Section, SliderField, EASE } from "../ui";

const ROW_H = 60;   // row pitch: 56 px row + 4 px gap
const THUMB = 40;
const CHECKER = "repeating-conic-gradient(#3a3a3a 0% 25%, #262626 0% 50%) 50% / 8px 8px";

const useStyles = makeStyles({
    list: {
        position: "relative",
        margin: 0,
        padding: 0,
        listStyle: "none",
    },
    row: {
        position: "relative",
        height: ROW_H - 4,
        marginBottom: 4,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "0 4px 0 0",
        borderRadius: 18,
        backgroundColor: "transparent",
        color: "#cccccc",
        userSelect: "none",
        cursor: "pointer",
        transition: `transform 180ms ${EASE}, background-color 160ms ${EASE}, box-shadow 160ms ${EASE}`,
        "&:hover": { backgroundColor: "#171717" },
        "&:focus-visible": { outline: "none", backgroundColor: "#1d1d1d" },
    },
    rowActive: {
        backgroundColor: "#212121 !important",
        color: "#ffffff",
    },
    rowDragging: {
        zIndex: 2,
        transition: "none !important",
        backgroundColor: "#2a2a2a !important",
        boxShadow: "0 10px 28px rgba(0,0,0,0.6)",
        cursor: "grabbing",
    },
    rowHidden: {
        "& $thumb, & $name": { opacity: 0.45 },
    },
    handle: {
        width: 36,
        height: 56,
        borderRadius: 18,
        color: "#6f6f6f",
        cursor: "grab",
        touchAction: "none",
        "&:hover, &.Mui-focusVisible": { color: "#dddddd" },
    },
    thumbBox: {
        flex: "0 0 auto",
        width: THUMB,
        height: THUMB,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    thumb: {
        background: CHECKER,
        borderRadius: 6,
        boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
    },
    text: {
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 2,
    },
    name: {
        fontFamily: `"Industry Book", "Normative Pro"`,
        fontSize: 14,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    meta: {
        fontFamily: `"Geist Mono", "Red Hat Display"`,
        fontSize: 11,
        color: "#8a8a8a",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    rename: {
        fontFamily: `"Industry Book", "Normative Pro"`,
        fontSize: 14,
        color: "#ffffff",
        backgroundColor: "#101010",
        borderRadius: 10,
        padding: "2px 8px",
    },
    mini: {
        color: "#9a9a9a",
        "&:hover": { color: "#ffffff" },
        "& .MuiSvgIcon-root": { fontSize: 20 },
    },
    miniOff: {
        color: "#5c5c5c",
    },
    actions: {
        display: "flex",
        flexWrap: "wrap",
        gap: 4,
        padding: "4px 0 8px",
    },
    action: {
        width: 44,
        height: 44,
        borderRadius: "50%",
        backgroundColor: "#171717",
        color: "#dddddd",
        transition: `background-color 160ms ${EASE}`,
        "&:hover": { backgroundColor: "#262626", color: "#ffffff" },
        "&.Mui-disabled": { opacity: 0.32 },
        "& .MuiSvgIcon-root": { fontSize: 20 },
    },
});

/** The scrolling ancestor (the sheet's content), for auto-scroll while dragging. */
const scrollerOf = (el) => {
    for (let p = el && el.parentElement; p; p = p.parentElement) {
        const o = getComputedStyle(p).overflowY;
        if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight) return p;
    }
    return null;
};

function LayerThumb({ layer, width, height, className }) {
    const ref = useRef(null);
    const revision = layer.revision;
    useLayoutEffect(() => {
        const t = thumbPixels(layer.toRGBA(), width, height, 96);
        paintPixels(ref.current, t.rgba, t.width, t.height);
    }, [layer, revision, width, height]);
    const k = THUMB / Math.max(width, height);
    return (
        <canvas
            ref={ref}
            className={className + " pixelated"}
            style={{ width: Math.max(4, Math.round(width * k)), height: Math.max(4, Math.round(height * k)) }}
        />
    );
}

function ActionButton({ classes, title, Icon, onClick, disabled }) {
    return (
        <Tooltip title={title}>
            <span>
                <IconButton className={classes.action} aria-label={title} onClick={onClick} disabled={disabled}>
                    <Icon />
                </IconButton>
            </span>
        </Tooltip>
    );
}

export default function LayersPanel({ ed }) {
    const classes = useStyles();
    useEditorEvents(ed, ["layers", "change", "document", "floating"]);
    const doc = ed.doc;
    const n = doc.layers.length;
    const rows = doc.layers.slice().reverse();          // top layer first
    const active = doc.activeLayer;

    const [drag, setDrag] = useState(null);
    const dragRef = useRef(null);
    const listRef = useRef(null);
    const [renaming, setRenaming] = useState(null);     // { id, value }
    const opacityDrag = useRef(1);

    // ── drag and drop ─────────────────────────────────────────────────────
    const startDrag = (e, layer, index) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* synthetic */ }
        const scroller = scrollerOf(listRef.current);
        const d = {
            id: layer.id, from: index, to: index, dy: 0, startY: e.clientY,
            pointerId: e.pointerId, scroller, scroll0: scroller ? scroller.scrollTop : 0,
        };
        dragRef.current = d;
        setDrag({ ...d });
    };
    const moveDrag = (e) => {
        const d = dragRef.current;
        if (!d || e.pointerId !== d.pointerId) return;
        if (d.scroller) {
            const r = d.scroller.getBoundingClientRect();
            if (e.clientY < r.top + 36) d.scroller.scrollTop -= 8;
            else if (e.clientY > r.bottom - 36) d.scroller.scrollTop += 8;
        }
        d.dy = e.clientY - d.startY + (d.scroller ? d.scroller.scrollTop - d.scroll0 : 0);
        d.to = Math.max(0, Math.min(n - 1, Math.round(d.from + d.dy / ROW_H)));
        setDrag({ ...d });
    };
    const endDrag = (e, cancelled) => {
        const d = dragRef.current;
        if (!d || (e && e.pointerId !== d.pointerId)) return;
        dragRef.current = null;
        setDrag(null);
        // Display order is top first; layer order is bottom first.
        if (!cancelled && d.to !== d.from) ed.run("layer.move", { id: d.id, to: n - 1 - d.to });
    };
    const onHandleKey = (e, layer) => {
        const by = e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : 0;
        if (!by) return;
        e.preventDefault();
        e.stopPropagation();
        if (ed.can("layer.move", { id: layer.id, by })) ed.run("layer.move", { id: layer.id, by });
    };
    const offsetOf = (i) => {
        if (!drag) return 0;
        if (i === drag.from) return drag.dy;
        if (drag.from < drag.to && i > drag.from && i <= drag.to) return -ROW_H;
        if (drag.to < drag.from && i >= drag.to && i < drag.from) return ROW_H;
        return 0;
    };

    // ── rename ────────────────────────────────────────────────────────────
    const commitRename = () => {
        if (!renaming) return;
        const layer = doc.layerById(renaming.id), name = renaming.value.trim();
        setRenaming(null);
        if (layer && name && name !== layer.name) ed.run("layer.set", { id: layer.id, name, label: "Rename layer" });
    };

    const setVisible = (layer) => ed.run("layer.set", {
        id: layer.id, visible: !layer.visible, label: layer.visible ? "Hide layer" : "Show layer",
    });
    const setLocked = (layer) => ed.run("layer.set", {
        id: layer.id, locked: !layer.locked, label: layer.locked ? "Unlock layer" : "Lock layer",
    });

    const newLayer = () => ed.run("layer.create", { name: layerName(n + 1) });
    const duplicate = () => ed.run("layer.duplicate", { name: layerCopyName(active.name) });

    return (
        <div>
            <ul className={classes.list} ref={listRef} aria-label={tp("tab_layers")}>
                {rows.map((layer, i) => {
                    const isActive = layer.id === active.id;
                    const dragging = drag && drag.from === i;
                    const colors = layer.colorCount();
                    const facts = [tp("n_colors", { color: { color: colors } })];
                    if (layer.opacity < 1) facts.push(`${Math.round(layer.opacity * 100)}%`);
                    if (layer.locked) facts.push(tp("locked"));
                    return (
                        <li
                            key={layer.id}
                            className={classes.row + (isActive ? " " + classes.rowActive : "") + (dragging ? " " + classes.rowDragging : "") + (layer.visible ? "" : " " + classes.rowHidden)}
                            style={{ transform: `translateY(${offsetOf(i)}px)` }}
                            tabIndex={0}
                            aria-current={isActive}
                            onClick={() => { if (!isActive && !drag) ed.run("layer.select", { id: layer.id }); }}
                            onKeyDown={(e) => {
                                if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
                                    e.preventDefault();
                                    if (!isActive) ed.run("layer.select", { id: layer.id });
                                }
                            }}
                            onDoubleClick={() => setRenaming({ id: layer.id, value: layer.name })}
                        >
                            <ButtonBase
                                className={classes.handle}
                                aria-label={tp("drag_to_reorder")}
                                title={tp("drag_to_reorder")}
                                onPointerDown={(e) => startDrag(e, layer, i)}
                                onPointerMove={moveDrag}
                                onPointerUp={(e) => endDrag(e, false)}
                                onPointerCancel={(e) => endDrag(e, true)}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => onHandleKey(e, layer)}
                            >
                                <DragIndicatorIcon />
                            </ButtonBase>
                            <span className={classes.thumbBox}>
                                <LayerThumb layer={layer} width={doc.width} height={doc.height} className={classes.thumb} />
                            </span>
                            <span className={classes.text}>
                                {renaming && renaming.id === layer.id ? (
                                    <InputBase
                                        autoFocus
                                        className={classes.rename}
                                        value={renaming.value}
                                        inputProps={{ "aria-label": tp("rename_layer"), maxLength: 64 }}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => setRenaming({ id: layer.id, value: e.target.value })}
                                        onKeyDown={(e) => {
                                            e.stopPropagation();
                                            if (e.key === "Enter") commitRename();
                                            if (e.key === "Escape") setRenaming(null);
                                        }}
                                        onBlur={commitRename}
                                    />
                                ) : (
                                    <span className={classes.name}>{layer.name}</span>
                                )}
                                <span className={classes.meta}>{facts.join(" · ")}</span>
                            </span>
                            <Tooltip title={tp(layer.visible ? "hide_layer" : "show_layer")}>
                                <IconButton
                                    size="small"
                                    className={classes.mini + (layer.visible ? "" : " " + classes.miniOff)}
                                    aria-label={tp(layer.visible ? "hide_layer" : "show_layer")}
                                    aria-pressed={!layer.visible}
                                    onClick={(e) => { e.stopPropagation(); setVisible(layer); }}
                                >
                                    {layer.visible ? <VisibilityIcon /> : <VisibilityOffIcon />}
                                </IconButton>
                            </Tooltip>
                            <Tooltip title={tp(layer.locked ? "unlock_layer" : "lock_layer")}>
                                <IconButton
                                    size="small"
                                    className={classes.mini + (layer.locked ? "" : " " + classes.miniOff)}
                                    aria-label={tp(layer.locked ? "unlock_layer" : "lock_layer")}
                                    aria-pressed={!!layer.locked}
                                    onClick={(e) => { e.stopPropagation(); setLocked(layer); }}
                                >
                                    {layer.locked ? <LockIcon /> : <LockOpenIcon />}
                                </IconButton>
                            </Tooltip>
                        </li>
                    );
                })}
            </ul>

            <div className={classes.actions}>
                <ActionButton classes={classes} title={tp("new_layer")} Icon={AddIcon} onClick={newLayer} disabled={!ed.can("layer.create", {})} />
                <ActionButton classes={classes} title={tp("duplicate_layer")} Icon={FileCopyIcon} onClick={duplicate} disabled={!ed.can("layer.duplicate", {})} />
                <ActionButton classes={classes} title={tp("merge_down")} Icon={CallMergeIcon} onClick={() => ed.run("layer.mergeDown")} disabled={!ed.can("layer.mergeDown", {})} />
                <ActionButton classes={classes} title={tp("merge_visible")} Icon={MergeTypeIcon} onClick={() => ed.run("layer.mergeVisible")} disabled={!ed.can("layer.mergeVisible", {})} />
                <ActionButton classes={classes} title={tp("rename_layer")} Icon={EditIcon} onClick={() => setRenaming({ id: active.id, value: active.name })} />
                <ActionButton classes={classes} title={tp("delete_layer")} Icon={DeleteOutlineIcon} onClick={() => ed.run("layer.delete")} disabled={!ed.can("layer.delete", {})} />
            </div>

            <Section title={tp("layer_opacity")}>
                <SliderField
                    label={active.name}
                    value={Math.round(active.opacity * 100)}
                    min={0}
                    max={100}
                    format={(v) => `${v}%`}
                    // One history step per drag: same merge key until the drag ends.
                    onChange={(v) => ed.run("layer.set", { id: active.id, opacity: v / 100, label: "Layer opacity", merge: `opacity-${active.id}-${opacityDrag.current}` })}
                    onCommit={() => { opacityDrag.current += 1; }}
                />
            </Section>
        </div>
    );
}
