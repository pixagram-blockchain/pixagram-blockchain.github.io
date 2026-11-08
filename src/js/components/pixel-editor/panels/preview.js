// ============================================================================
// pixel-editor/panels/preview.js — live previews for the Effects and Filters
// panels
//
// usePreview(ed) runs one editor preview session at a time: the canvas shows
// the result while sliders move, Apply commits it as one history step, Cancel
// (or leaving the panel) restores the image. A preview the editor ends on its
// own — a stroke, an undo, Done — is forgotten here too.
//
// PreviewCard is the panel's header while a preview runs: name, parameters,
// Apply and Cancel.
// ============================================================================

import * as React from "preact/compat";
import { useState, useRef, useEffect } from "preact/compat";
import makeStyles from "@material-ui/core/styles/makeStyles";
import Button from "@material-ui/core/Button";
import CheckIcon from "@material-ui/icons/Check";

import { tp } from "../labels";
import { SliderField, SwitchField, Hint } from "../ui";

export function usePreview(ed) {
    const [preview, setPreview] = useState(null);   // { key, id, args, session }
    const ref = useRef(null);
    ref.current = preview;

    useEffect(() => ed.on("preview", (e) => {
        const p = ref.current;
        if (!e.active && p && p.session.id === e.id && ed.previewSession !== p.session) setPreview(null);
    }), [ed]);

    // Leaving the panel (another tab, the sheet closing) drops an unapplied preview.
    useEffect(() => () => {
        const p = ref.current;
        if (p && ed.previewSession === p.session) p.session.cancel();
    }, [ed]);

    const live = () => {
        const p = ref.current;
        return p && ed.previewSession === p.session ? p : null;
    };

    /** Starts a preview, or retunes the running one when it is the same command. */
    const open = (key, id, args) => {
        const p = live();
        if (p && p.id === id) {
            p.session.update(args);
            setPreview({ ...p, key, args: { ...p.args, ...args } });
            return true;
        }
        if (p) p.session.cancel();
        if (!ed.can(id, args)) { setPreview(null); return false; }
        const session = ed.preview(id, args);
        if (!session) { setPreview(null); return false; }
        setPreview({ key, id, args, session });
        return true;
    };
    const update = (patch) => {
        const p = live();
        if (!p) return;
        p.session.update(patch);
        setPreview({ ...p, args: { ...p.args, ...patch } });
    };
    const apply = () => {
        const p = live();
        setPreview(null);
        if (p) p.session.commit();
    };
    const cancel = () => {
        const p = live();
        setPreview(null);
        if (p) p.session.cancel();
    };
    return { preview, open, update, apply, cancel };
}

const useStyles = makeStyles({
    card: {
        margin: "0 0 12px",
        padding: "12px 12px 8px",
        borderRadius: 21,
        backgroundColor: "#171717",
    },
    head: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 4,
    },
    title: {
        flex: 1,
        minWidth: 0,
        fontFamily: `"Industry Book", "Normative Pro"`,
        fontSize: 15,
        color: "#ffffff",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    cancel: {
        color: "#bbbbbb !important",
        textTransform: "none",
    },
    apply: {
        borderRadius: "21px !important",
        backgroundColor: "#ffffff !important",
        color: "#000000 !important",
        textTransform: "none",
        fontWeight: 600,
        boxShadow: "none",
        "&:hover": { backgroundColor: "#e0e0e0 !important" },
    },
});

/**
 * params: [{ key, label, min, max, step, fmt?, type?: "check" }]
 */
export function PreviewCard({ title, note, params, args, onChange, onApply, onCancel }) {
    const classes = useStyles();
    return (
        <div className={classes.card} role="group" aria-label={title}>
            <div className={classes.head}>
                <span className={classes.title}>{title}</span>
                <Button size="small" className={classes.cancel} onClick={onCancel}>{tp("cancel")}</Button>
                <Button size="small" variant="contained" className={classes.apply} startIcon={<CheckIcon />} onClick={onApply}>
                    {tp("apply")}
                </Button>
            </div>
            {note && <Hint>{note}</Hint>}
            {params.map((q) => (q.type === "check" ? (
                <SwitchField key={q.key} label={q.label} checked={!!args[q.key]} onChange={(v) => onChange(q.key, v)} />
            ) : (
                <SliderField
                    key={q.key}
                    label={q.label}
                    value={args[q.key]}
                    min={q.min}
                    max={q.max}
                    step={q.step}
                    format={q.fmt || String}
                    onChange={(v) => onChange(q.key, v)}
                />
            )))}
        </div>
    );
}
