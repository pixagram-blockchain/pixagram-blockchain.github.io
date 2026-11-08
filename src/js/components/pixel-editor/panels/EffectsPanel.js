// ============================================================================
// pixel-editor/panels/EffectsPanel.js — adjustments with live preview
//
// Tuned effects open a preview (PreviewCard on top, the canvas shows the
// result as the sliders move); flips and turns apply at once. Effects act on
// the selection when there is one, on the active layer otherwise; Colorize,
// Lightness and Saturation need a selection. The values last used for each
// effect are kept while the editor is open.
// ============================================================================

import * as React from "preact/compat";
import { useRef } from "preact/compat";

import Brightness6Icon from "@material-ui/icons/Brightness6";
import InvertColorsIcon from "@material-ui/icons/InvertColors";
import OpacityIcon from "@material-ui/icons/Opacity";
import WavesIcon from "@material-ui/icons/Waves";
import VignetteIcon from "@material-ui/icons/Vignette";
import GrainIcon from "@material-ui/icons/Grain";
import FormatPaintIcon from "@material-ui/icons/FormatPaint";
import WbSunnyIcon from "@material-ui/icons/WbSunny";
import TonalityIcon from "@material-ui/icons/Tonality";
import FlipIcon from "@material-ui/icons/Flip";
import RotateLeftIcon from "@material-ui/icons/RotateLeft";
import RotateRightIcon from "@material-ui/icons/RotateRight";

import { tp } from "../labels";
import { useEditorEvents } from "../editorUtils";
import { Section, Tiles, Tile, Hint } from "../ui";
import { usePreview, PreviewCard } from "./preview";

const pct = (v) => `${Math.round(v * 100)}%`;
const signed = (v) => `${v > 0 ? "+" : ""}${v}`;
const ROTATE_90 = { transform: "rotate(90deg)" };

const strength = (value = 1) => ({ key: "intensity", label: "param_strength", min: 0, max: 1, step: 0.05, value, fmt: pct });

export const EFFECTS = [
    { key: "contrast", id: "effect.autoContrast", label: "fx_auto_contrast", Icon: Brightness6Icon, params: [strength()] },
    { key: "saturation", id: "effect.autoSaturation", label: "fx_auto_saturation", Icon: InvertColorsIcon, params: [strength()] },
    { key: "alpha", id: "effect.colorToAlpha", label: "fx_color_to_alpha", Icon: OpacityIcon, note: "note_color_to_alpha", params: [strength()] },
    { key: "smooth", id: "effect.smooth", label: "fx_smooth", Icon: WavesIcon, params: [{ key: "rounds", label: "param_rounds", min: 1, max: 4, step: 1, value: 1 }] },
    {
        key: "vignette", id: "effect.vignette", label: "fx_vignette", Icon: VignetteIcon, note: "note_vignette",
        params: [strength(0.5), { key: "rings", label: "param_rings", min: 2, max: 12, step: 1, value: 6 }, { key: "dither", label: "param_dither", type: "check", value: false }],
    },
    {
        key: "reduce", id: "palette.reduce", label: "fx_reduce", Icon: GrainIcon,
        params: [{
            key: "keep", label: "param_keep", min: 2, max: 64, step: 1,
            value: (ed) => Math.max(2, Math.min(64, Math.floor(ed.doc.activeLayer.colorCount() / 2))),
            fmt: (v) => tp("n_colors", { color: { color: v } }),
        }],
    },
    { key: "colorize", id: "selection.recolor", fixed: { target: "primary" }, label: "fx_colorize", Icon: FormatPaintIcon, note: "note_colorize", params: [{ ...strength(), key: "strength" }] },
    { key: "lightness", id: "selection.lightness", label: "fx_lightness", Icon: WbSunnyIcon, params: [{ key: "delta", label: "param_amount", min: -50, max: 50, step: 1, value: 10, fmt: signed }] },
    { key: "sat", id: "selection.saturation", label: "fx_saturation", Icon: TonalityIcon, params: [{ key: "delta", label: "param_amount", min: -50, max: 50, step: 1, value: 15, fmt: signed }] },
    { key: "flipx", run: "effect.mirror", args: { axis: "x" }, label: "fx_mirror_x", Icon: FlipIcon },
    { key: "flipy", run: "effect.mirror", args: { axis: "y" }, label: "fx_mirror_y", Icon: FlipIcon, iconStyle: ROTATE_90 },
    { key: "rotl", run: "effect.rotate", args: { dir: -1 }, label: "fx_rotate_left", Icon: RotateLeftIcon },
    { key: "rotr", run: "effect.rotate", args: { dir: 1 }, label: "fx_rotate_right", Icon: RotateRightIcon },
];

export default function EffectsPanel({ ed }) {
    useEditorEvents(ed, ["selection", "change", "floating", "layers", "colors", "preview"]);
    const { preview, open, update, apply, cancel } = usePreview(ed);
    const lastArgs = useRef(new Map());

    const argsFor = (fx) => {
        const args = { ...(fx.fixed || {}) };
        for (const q of fx.params) {
            const kept = lastArgs.current.get(fx.key + "." + q.key);
            args[q.key] = kept !== undefined ? kept : (typeof q.value === "function" ? q.value(ed) : q.value);
        }
        return args;
    };

    const current = preview && EFFECTS.find((fx) => fx.key === preview.key);
    const selected = !ed.doc.selection.isEmpty();
    const floating = !!ed.doc.floating;

    return (
        <div>
            {current && (
                <PreviewCard
                    title={tp(current.label)}
                    note={current.note ? tp(current.note) : null}
                    params={current.params.map((q) => ({ ...q, label: tp(q.label) }))}
                    args={preview.args}
                    onChange={(key, v) => {
                        lastArgs.current.set(current.key + "." + key, v);
                        update({ [key]: v });
                    }}
                    onApply={apply}
                    onCancel={cancel}
                />
            )}
            <Section title={tp("tab_effects")}>
                <Tiles>
                    {EFFECTS.map((fx) => {
                        const id = fx.run || fx.id;
                        const args = fx.run ? fx.args : argsFor(fx);
                        const on = !!current && current.key === fx.key;
                        return (
                            <Tile
                                key={fx.key}
                                Icon={fx.Icon}
                                iconStyle={fx.iconStyle}
                                label={tp(fx.label)}
                                title={fx.note ? tp(fx.note) : undefined}
                                on={fx.run ? undefined : on}
                                disabled={!on && !ed.can(id, args)}
                                onClick={() => {
                                    if (fx.run) { cancel(); ed.run(fx.run, fx.args); }
                                    else if (on) cancel();
                                    else open(fx.key, fx.id, args);
                                }}
                            />
                        );
                    })}
                </Tiles>
                <Hint>
                    {floating ? tp("fx_hint_floating") : selected ? tp("fx_hint_selection") : tp("fx_hint_layer")}
                </Hint>
            </Section>
        </div>
    );
}
