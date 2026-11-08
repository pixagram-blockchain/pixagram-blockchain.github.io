// ============================================================================
// pixel-editor/panels/ToolPanel.js — options of the active tool
//
//   pencil / eraser   tip, size, opacity, pixel-perfect, blend, mirror
//   selection tools   mode (replace / add / subtract), tolerance and
//                     neighbours for the colour tools, width and tip for the
//                     line and brush selections
//   picker, move, mirror axis   how they work, in one line
// ============================================================================

import * as React from "preact/compat";
import makeStyles from "@material-ui/core/styles/makeStyles";
import ButtonBase from "@material-ui/core/ButtonBase";
import Button from "@material-ui/core/Button";
import Tooltip from "@material-ui/core/Tooltip";

import { TIP_SHAPES, tipOffsets } from "../../../utils/pixa-editor/index.js";
import { tp, toolLabel, toolHint } from "../labels";
import { useEditorEvents } from "../editorUtils";
import { activeToolKey } from "../ToolStrip";
import { Section, Segmented, SliderField, SwitchField, Hint, EASE } from "../ui";

const useStyles = makeStyles({
    tips: {
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
    },
    tip: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: "#171717",
        color: "#dddddd",
        transition: `background-color 160ms ${EASE}, color 160ms ${EASE}, opacity 160ms ${EASE}`,
        "&:hover": { backgroundColor: "#262626", color: "#ffffff" },
        "&.Mui-disabled": { opacity: 0.32 },
    },
    tipOn: {
        backgroundColor: "#e9e9e9 !important",
        color: "#1d1d1d !important",
    },
    stack: {
        display: "flex",
        flexDirection: "column",
        gap: 10,
    },
    centerAxes: {
        alignSelf: "flex-start",
        color: "#dddddd",
        backgroundColor: "#171717",
        borderRadius: "16px !important",
        textTransform: "none",
        "&:hover": { backgroundColor: "#262626" },
    },
});

/** One tip, drawn from the same offsets the brush stamps. */
function TipGlyph({ offsets }) {
    const cells = [];
    if (offsets) {
        for (let k = 0; k < offsets.length; k += 2) {
            const x = offsets[k], y = offsets[k + 1];
            if (Math.abs(x) <= 4 && Math.abs(y) <= 4) cells.push(<rect key={k} x={x - 0.5} y={y - 0.5} width="1.02" height="1.02" />);
        }
    }
    return (
        <svg viewBox="-4.5 -4.5 9 9" width="20" height="20" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true">
            {offsets ? cells : (
                // No custom tip yet: a dashed square, "from the selection".
                <rect x="-4" y="-4" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="0.8" strokeDasharray="1 1" />
            )}
        </svg>
    );
}

function TipPicker({ ed, classes }) {
    const size = Math.min(9, Math.max(5, ed.brush.size | 1));
    const hasSelection = !ed.doc.selection.isEmpty();
    return (
        <div className={classes.tips} role="radiogroup" aria-label={tp("tip")}>
            {[...TIP_SHAPES, "custom"].map((shape) => {
                const on = ed.brush.tip === shape;
                const custom = shape === "custom";
                const disabled = custom && !ed.brush.customTip && !hasSelection;
                const offsets = custom ? ed.brush.customTip : tipOffsets(shape, size);
                const onClick = () => {
                    if (!custom) ed.setBrush({ tip: shape });
                    else if (hasSelection) ed.run("brush.tipFromSelection");
                    else if (ed.brush.customTip) ed.setBrush({ tip: "custom" });
                };
                return (
                    <Tooltip key={shape} title={tp("tip_" + shape)}>
                        <span>
                            <ButtonBase
                                className={classes.tip + (on ? " " + classes.tipOn : "")}
                                role="radio"
                                aria-checked={on}
                                aria-label={tp("tip_" + shape)}
                                disabled={disabled}
                                onClick={onClick}
                            >
                                <TipGlyph offsets={offsets} />
                            </ButtonBase>
                        </span>
                    </Tooltip>
                );
            })}
        </div>
    );
}

function MirrorOptions({ ed, classes }) {
    return (
        <div className={classes.stack}>
            <Segmented
                ariaLabel={tp("mirror")}
                value={ed.brush.mirror}
                onChange={(mode) => ed.run("pencil.mirror", { mode })}
                options={[
                    { value: "none", label: tp("mirror_none") },
                    { value: "vertical", label: tp("mirror_vertical") },
                    { value: "horizontal", label: tp("mirror_horizontal") },
                    { value: "both", label: tp("mirror_both") },
                ]}
            />
            {ed.brush.mirrorAxis && (
                <Button className={classes.centerAxes} onClick={() => ed.setBrush({ mirrorAxis: null })}>
                    {tp("center_axes")}
                </Button>
            )}
        </div>
    );
}

function BrushOptions({ ed, classes }) {
    const b = ed.brush;
    return (
        <React.Fragment>
            <Section title={tp("tip")}>
                <TipPicker ed={ed} classes={classes} />
            </Section>
            <SliderField label={tp("size")} value={b.size} min={1} max={32} format={(v) => tp("px", { n: v })} onChange={(v) => ed.setBrush({ size: v })} />
            <SliderField label={tp("opacity")} value={Math.round(b.opacity * 100)} min={1} max={100} format={(v) => `${v}%`} onChange={(v) => ed.setBrush({ opacity: v / 100 })} />
            <SwitchField
                label={tp("pixel_perfect")}
                checked={b.pixelPerfect}
                disabled={b.size !== 1 || b.tip === "custom"}
                onChange={(v) => ed.setBrush({ pixelPerfect: v })}
            />
            <Section title={tp("blend")}>
                <Segmented
                    ariaLabel={tp("blend")}
                    value={b.blend}
                    onChange={(v) => ed.setBrush({ blend: v })}
                    options={[
                        { value: "over", label: tp("blend_over") },
                        { value: "replace", label: tp("blend_replace"), title: tp("blend_replace_hint") },
                        { value: "erase", label: tp("blend_erase") },
                    ]}
                />
            </Section>
            <Section title={tp("mirror")}>
                <MirrorOptions ed={ed} classes={classes} />
            </Section>
        </React.Fragment>
    );
}

function SelectionOptions({ ed, id, classes }) {
    const s = ed.selection;
    const colourTool = id === "select-area" || id === "select-color";
    const tipTool = id === "select-line" || id === "select-brush";
    return (
        <React.Fragment>
            <Section title={tp("mode")}>
                <Segmented
                    ariaLabel={tp("mode")}
                    value={s.mode}
                    onChange={(mode) => ed.setSelectionSettings({ mode })}
                    options={[
                        { value: "replace", label: tp("mode_replace") },
                        { value: "add", label: tp("mode_add"), title: tp("mode_add_hint") },
                        { value: "remove", label: tp("mode_remove"), title: tp("mode_remove_hint") },
                    ]}
                />
            </Section>
            {colourTool && (
                <React.Fragment>
                    <SliderField
                        label={tp("tolerance")}
                        value={Math.round(s.threshold * 100)}
                        min={0}
                        max={100}
                        format={(v) => `${v}%`}
                        onChange={(v) => ed.setSelectionSettings({ threshold: v / 100 })}
                    />
                    {id === "select-area" && (
                        <Section title={tp("neighbors")}>
                            <Segmented
                                ariaLabel={tp("neighbors")}
                                value={s.connectivity}
                                onChange={(v) => ed.setSelectionSettings({ connectivity: Number(v) })}
                                options={[
                                    { value: 4, label: tp("four_sides") },
                                    { value: 8, label: tp("eight_with_corners") },
                                ]}
                            />
                        </Section>
                    )}
                    <Section title={tp("compare")}>
                        <Segmented
                            ariaLabel={tp("compare")}
                            value={s.metric}
                            onChange={(metric) => ed.setSelectionSettings({ metric })}
                            options={[
                                { value: "channel", label: tp("channels") },
                                { value: "oklab", label: tp("perceptual") },
                            ]}
                        />
                    </Section>
                    <Section title={tp("look_at")}>
                        <Segmented
                            ariaLabel={tp("look_at")}
                            value={s.sample}
                            onChange={(sample) => ed.setSelectionSettings({ sample })}
                            options={[
                                { value: "layer", label: tp("active_layer") },
                                { value: "composite", label: tp("whole_image") },
                            ]}
                        />
                    </Section>
                </React.Fragment>
            )}
            {tipTool && (
                <React.Fragment>
                    <SliderField
                        label={tp(id === "select-line" ? "width" : "size")}
                        value={ed.brush.size}
                        min={1}
                        max={32}
                        format={(v) => tp("px", { n: v })}
                        onChange={(v) => ed.setBrush({ size: v })}
                    />
                    <Section title={tp("tip")}>
                        <TipPicker ed={ed} classes={classes} />
                    </Section>
                </React.Fragment>
            )}
        </React.Fragment>
    );
}

export default function ToolPanel({ ed }) {
    const classes = useStyles();
    useEditorEvents(ed, ["tool", "brush", "selection-settings", "selection"]);
    const id = ed.activeToolId;
    const key = activeToolKey(ed);

    let body = null;
    if (id === "pencil") body = <BrushOptions ed={ed} classes={classes} />;
    else if (id.indexOf("select") === 0) body = <SelectionOptions ed={ed} id={id} classes={classes} />;
    else if (id === "mirror-axis") body = <MirrorOptions ed={ed} classes={classes} />;

    return (
        <Section title={toolLabel(key)}>
            <div className={classes.stack}>
                {body}
                <Hint>{toolHint(key)}</Hint>
            </div>
        </Section>
    );
}
