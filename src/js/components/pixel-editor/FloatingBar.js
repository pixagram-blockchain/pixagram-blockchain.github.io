// ============================================================================
// pixel-editor/FloatingBar.js — actions for floating pixels
//
// Shown over the top of the canvas while something floats (a lifted or
// duplicated selection, a paste, an import): apply, apply as a new layer,
// flip, turn, drop or cancel. Enter and Escape do the same from the keyboard.
// ============================================================================

import * as React from "preact/compat";
import { useRef } from "preact/compat";
import makeStyles from "@material-ui/core/styles/makeStyles";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import Grow from "@material-ui/core/Grow";

import CheckIcon from "@material-ui/icons/Check";
import LibraryAddIcon from "@material-ui/icons/LibraryAdd";
import FlipIcon from "@material-ui/icons/Flip";
import RotateLeftIcon from "@material-ui/icons/RotateLeft";
import RotateRightIcon from "@material-ui/icons/RotateRight";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import CloseIcon from "@material-ui/icons/Close";

import { tp } from "./labels";
import { useEditorEvents } from "./editorUtils";
import { EASE } from "./ui";

const useStyles = makeStyles({
    wrap: {
        position: "absolute",
        top: 12,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 3,
    },
    bar: {
        pointerEvents: "auto",
        display: "flex",
        alignItems: "center",
        gap: 2,
        maxWidth: "calc(100% - 16px)",
        overflowX: "auto",
        padding: "4px 6px 4px 14px",
        borderRadius: 28,
        backgroundColor: "rgba(23, 23, 23, 0.94)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.55)",
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": { display: "none" },
    },
    label: {
        flex: "0 0 auto",
        marginRight: 6,
        fontFamily: `"Industry Book", "Normative Pro"`,
        fontSize: 13,
        color: "#bbbbbb",
        whiteSpace: "nowrap",
    },
    size: {
        fontFamily: `"Geist Mono", "Red Hat Display"`,
        fontSize: 11,
        color: "#8a8a8a",
        marginLeft: 6,
    },
    button: {
        flex: "0 0 auto",
        color: "#dddddd",
        transition: `background-color 160ms ${EASE}`,
        "&:hover": { backgroundColor: "#2a2a2a", color: "#ffffff" },
        "& .MuiSvgIcon-root": { fontSize: 20 },
    },
    apply: {
        backgroundColor: "#e9e9e9",
        color: "#1d1d1d",
        "&:hover": { backgroundColor: "#ffffff", color: "#000000" },
    },
});

const KIND = { lift: "floating_lifted", copy: "floating_copy", paste: "floating_pasted", import: "floating_imported" };

export default function FloatingBar({ ed }) {
    const classes = useStyles();
    useEditorEvents(ed, ["floating", "change", "history"]);
    // The last floating stays drawn while the bar shrinks away.
    const last = useRef(null);
    if (ed.doc.floating) last.current = ed.doc.floating;
    const f = ed.doc.floating || last.current;
    const b = (Icon, title, onClick, extra = "", iconStyle) => (
        <Tooltip title={title}>
            <IconButton size="small" className={classes.button + (extra ? " " + extra : "")} aria-label={title} onClick={onClick}>
                <Icon style={iconStyle} />
            </IconButton>
        </Tooltip>
    );
    return (
        <Grow in={!!ed.doc.floating} unmountOnExit onExited={() => { last.current = null; }}>
            <div className={classes.wrap}>
                {f && (
                    <div className={classes.bar} role="toolbar" aria-label={tp(KIND[f.mode] || "floating")}>
                        <span className={classes.label}>
                            {tp(KIND[f.mode] || "floating")}
                            <span className={classes.size}>{f.dw} × {f.dh}</span>
                        </span>
                        {b(CheckIcon, tp("floating_apply"), () => ed.run("floating.commit", {}), classes.apply)}
                        {b(LibraryAddIcon, tp("floating_as_layer"), () => ed.run("floating.commit", { asNewLayer: true }))}
                        {b(FlipIcon, tp("fx_mirror_x"), () => ed.run("effect.mirror", { axis: "x" }))}
                        {b(FlipIcon, tp("fx_mirror_y"), () => ed.run("effect.mirror", { axis: "y" }), "", { transform: "rotate(90deg)" })}
                        {b(RotateLeftIcon, tp("fx_rotate_left"), () => ed.run("effect.rotate", { dir: -1 }))}
                        {b(RotateRightIcon, tp("fx_rotate_right"), () => ed.run("effect.rotate", { dir: 1 }))}
                        {b(DeleteOutlineIcon, tp("floating_discard"), () => ed.run("floating.discard"))}
                        {b(CloseIcon, tp(f.mode === "lift" ? "floating_put_back" : "cancel"), () => ed.run("floating.cancel"))}
                    </div>
                )}
            </div>
        </Grow>
    );
}
