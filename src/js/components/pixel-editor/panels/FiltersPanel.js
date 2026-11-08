// ============================================================================
// pixel-editor/panels/FiltersPanel.js — the 30 pixa.pics colour filters
//
// Each filter shows on a thumbnail of the image (active layer filtered). A
// tap previews it on the canvas; picking another filter retunes the same
// preview, the strength slider mixes it with the original, Apply keeps it.
// Thumbnails are cached by the core and redrawn when the image changes.
// ============================================================================

import * as React from "preact/compat";
import { useEffect, useRef, useState, useLayoutEffect } from "preact/compat";
import makeStyles from "@material-ui/core/styles/makeStyles";
import ButtonBase from "@material-ui/core/ButtonBase";

import { FILTER_NAMES, FilterPreviews } from "../../../utils/pixa-editor/index.js";
import { tp } from "../labels";
import { useEditorEvents, paintPixels } from "../editorUtils";
import { Section, Hint, EASE } from "../ui";
import { usePreview, PreviewCard } from "./preview";

const THUMB = 72;
const CHECKER = "repeating-conic-gradient(#3a3a3a 0% 25%, #262626 0% 50%) 50% / 8px 8px";
const pct = (v) => `${Math.round(v * 100)}%`;
const STRENGTH = [{ key: "intensity", label: "param_strength", min: 0, max: 1, step: 0.05, fmt: pct }];

const useStyles = makeStyles({
    grid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))",
        gap: 10,
    },
    filter: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        padding: 6,
        borderRadius: 18,
        color: "#bbbbbb",
        transition: `background-color 160ms ${EASE}, color 160ms ${EASE}`,
        "&:hover": { backgroundColor: "#171717", color: "#ffffff" },
        "&.Mui-disabled": { opacity: 0.32 },
    },
    filterOn: {
        backgroundColor: "#e9e9e9 !important",
        color: "#1d1d1d !important",
    },
    thumbBox: {
        width: THUMB,
        height: THUMB,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 12,
        overflow: "hidden",
        background: CHECKER,
    },
    thumb: {
        maxWidth: "100%",
        maxHeight: "100%",
    },
    name: {
        fontFamily: `"Industry Book", "Normative Pro"`,
        fontSize: 12,
        lineHeight: 1.2,
        textAlign: "center",
        maxWidth: THUMB + 8,
        overflow: "hidden",
        textOverflow: "ellipsis",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
    },
});

function FilterThumb({ thumb, className }) {
    const ref = useRef(null);
    useLayoutEffect(() => {
        if (thumb) paintPixels(ref.current, thumb.rgba, thumb.width, thumb.height);
    }, [thumb]);
    if (!thumb) return null;
    const k = THUMB / Math.max(thumb.width, thumb.height);
    return (
        <canvas
            ref={ref}
            className={className + " pixelated"}
            style={{ width: Math.round(thumb.width * k), height: Math.round(thumb.height * k) }}
        />
    );
}

export default function FiltersPanel({ ed }) {
    const classes = useStyles();
    useEditorEvents(ed, ["floating", "preview", "layers"]);
    const { preview, open, update, apply, cancel } = usePreview(ed);
    const intensity = useRef(0.8);

    // Thumbnails: once on open, then shortly after each change of the image.
    const previews = useRef(null);
    const [thumbs, setThumbs] = useState(null);
    useEffect(() => {
        if (!previews.current) previews.current = new FilterPreviews();
        let timer = 0;
        const render = () => {
            timer = 0;
            // While a filter is previewed, the image it would show is the preview itself.
            if (ed.previewSession) return;
            setThumbs(previews.current.render(ed.doc, { size: THUMB, intensity: 1 }));
        };
        render();
        const soon = () => { if (!timer) timer = setTimeout(render, 350); };
        const offs = [ed.on("change", soon), ed.on("layers", soon), ed.on("document", soon)];
        return () => {
            offs.forEach((off) => off());
            clearTimeout(timer);
        };
    }, [ed]);

    const filtering = preview && preview.id === "filter.apply" ? preview.args.name : null;
    const blocked = !!ed.doc.floating;

    return (
        <div>
            {filtering && (
                <PreviewCard
                    title={tp("filter_named", { name: filtering })}
                    params={STRENGTH.map((q) => ({ ...q, label: tp(q.label) }))}
                    args={preview.args}
                    onChange={(key, v) => { intensity.current = v; update({ [key]: v }); }}
                    onApply={apply}
                    onCancel={cancel}
                />
            )}
            <Section title={tp("tab_filters")}>
                <div className={classes.grid}>
                    {FILTER_NAMES.map((name) => {
                        const on = filtering === name;
                        return (
                            <ButtonBase
                                key={name}
                                className={classes.filter + (on ? " " + classes.filterOn : "")}
                                aria-pressed={on}
                                disabled={blocked}
                                onClick={() => (on ? cancel() : open("filter", "filter.apply", { name, intensity: intensity.current }))}
                            >
                                <span className={classes.thumbBox}>
                                    <FilterThumb thumb={thumbs && thumbs.get(name)} className={classes.thumb} />
                                </span>
                                <span className={classes.name}>{name}</span>
                            </ButtonBase>
                        );
                    })}
                </div>
                <Hint>{blocked ? tp("fx_hint_floating") : tp("filters_hint")}</Hint>
            </Section>
        </div>
    );
}
