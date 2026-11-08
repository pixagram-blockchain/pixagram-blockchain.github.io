// ============================================================================
// pixel-editor/panels/SelectionPanel.js — what to do with the selection
//
// Shapes are only ever made through selections: select, then fill, border,
// erase, crop, copy, move… Every tile is enabled exactly when its command can
// run, so the grid also tells what is possible right now.
// ============================================================================

import * as React from "preact/compat";

import SelectAllIcon from "@material-ui/icons/SelectAll";
import ClearIcon from "@material-ui/icons/Clear";
import FullscreenIcon from "@material-ui/icons/Fullscreen";
import FullscreenExitIcon from "@material-ui/icons/FullscreenExit";
import BorderOuterIcon from "@material-ui/icons/BorderOuter";
import FormatColorFillIcon from "@material-ui/icons/FormatColorFill";
import CropIcon from "@material-ui/icons/Crop";
import FileCopyIcon from "@material-ui/icons/FileCopy";
import AssignmentIcon from "@material-ui/icons/Assignment";
import OpenWithIcon from "@material-ui/icons/OpenWith";
import LibraryAddIcon from "@material-ui/icons/LibraryAdd";
import BlurCircularIcon from "@material-ui/icons/BlurCircular";
import BrushIcon from "@material-ui/icons/Brush";

import { EraserIcon, ScissorsIcon, InvertSelectionIcon } from "../icons";
import { tp } from "../labels";
import { useEditorEvents } from "../editorUtils";
import { Section, Tiles, Tile, Hint } from "../ui";

const ACTIONS = [
    { id: "selection.all", label: "sel_all", Icon: SelectAllIcon },
    { id: "selection.clear", label: "sel_clear", Icon: ClearIcon },
    { id: "selection.invert", label: "sel_invert", Icon: InvertSelectionIcon },
    { id: "selection.grow", args: { by: 1 }, label: "sel_grow", Icon: FullscreenIcon },
    { id: "selection.shrink", args: { by: 1 }, label: "sel_shrink", Icon: FullscreenExitIcon },
    { id: "selection.fill", label: "sel_fill", Icon: FormatColorFillIcon, title: "sel_fill_hint" },
    { id: "selection.border", label: "sel_border", Icon: BorderOuterIcon, title: "sel_border_hint" },
    { id: "selection.erase", label: "sel_erase", Icon: EraserIcon },
    { id: "selection.crop", label: "sel_crop", Icon: CropIcon },
    { id: "selection.copy", label: "sel_copy", Icon: FileCopyIcon },
    { id: "selection.cut", label: "sel_cut", Icon: ScissorsIcon },
    { id: "clipboard.paste", label: "sel_paste", Icon: AssignmentIcon },
    { id: "selection.lift", label: "sel_lift", Icon: OpenWithIcon, title: "sel_lift_hint" },
    { id: "selection.lift", args: { duplicate: true }, label: "sel_duplicate", Icon: LibraryAddIcon, title: "sel_duplicate_hint" },
    { id: "selection.averageColor", label: "sel_average", Icon: BlurCircularIcon, title: "sel_average_hint" },
    { id: "brush.tipFromSelection", label: "sel_tip", Icon: BrushIcon, title: "sel_tip_hint" },
];

export default function SelectionPanel({ ed }) {
    useEditorEvents(ed, ["selection", "change", "floating", "history", "clipboard", "colors"]);
    const count = ed.doc.selection.count();
    const b = count ? ed.doc.selection.bounds() : null;   // inclusive x0..x1, y0..y1
    return (
        <Section title={count ? tp("selected_px", { n: count }) : tp("nothing_selected")}>
            <Tiles>
                {ACTIONS.map((a) => {
                    const args = a.args || {};
                    return (
                        <Tile
                            key={a.label}
                            Icon={a.Icon}
                            label={tp(a.label)}
                            title={a.title ? tp(a.title) : undefined}
                            disabled={!ed.can(a.id, args)}
                            onClick={() => ed.run(a.id, args)}
                        />
                    );
                })}
            </Tiles>
            {!count && <Hint>{tp("selection_hint")}</Hint>}
            {b && (
                <Hint>{tp("selection_bounds", { width: b.x1 - b.x0 + 1, height: b.y1 - b.y0 + 1, x: b.x0, y: b.y0 })}</Hint>
            )}
        </Section>
    );
}
