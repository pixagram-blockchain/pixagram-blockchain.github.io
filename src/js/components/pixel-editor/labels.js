// ============================================================================
// pixel-editor/labels.js — every word the editor shows, through t()
//
// The core speaks English (history entries, the context-menu model): those
// strings are mapped to keys here, so the editor reads in the app's language.
// An English label without a key falls through as itself.
// ============================================================================

import { t } from "../../utils/text";

const P = "components.pixel_editor.";

/** t() under components.pixel_editor. */
export const tp = (key, vars) => t(P + key, vars);

/** The editor's tools, in rail order. `null` marks a gap between groups. */
export const TOOL_IDS = [
    "pencil", "eraser", "picker", "move", null,
    "select-rect", "select-ellipse", "select-line", "select-path", "select-brush", "select-area", "select-color", null,
    "mirror-axis",
];

/** Tool shortcut keys, as the canvas zone binds them. */
export const TOOL_KEYS = {
    pencil: "B", eraser: "E", picker: "I", move: "V",
    "select-rect": "M", "select-ellipse": "O", "select-line": "U", "select-path": "L",
    "select-brush": "S", "select-area": "W", "select-color": "Shift+W",
};

const slug = (s) => s.replace(/-/g, "_");

export const toolLabel = (id) => tp("tool_" + slug(id));
export const toolHint = (id) => tp("hint_" + slug(id));

// ── history: the core's transaction labels ───────────────────────────────
const HISTORY = {
    "Pencil": "h_pencil",
    "Eraser": "h_eraser",
    "Select": "h_select",
    "Select all": "h_select_all",
    "Unselect": "h_deselect",
    "Invert selection": "h_invert_selection",
    "Grow selection": "h_grow_selection",
    "Shrink selection": "h_shrink_selection",
    "Fill selection": "h_fill",
    "Border": "h_border",
    "Erase": "h_erase",
    "Crop": "h_crop",
    "Copy": "h_copy",
    "Cut": "h_cut",
    "Paste": "h_paste",
    "Paste as layer": "h_paste_as_layer",
    "Lift selection": "h_lift_selection",
    "Duplicate selection": "h_duplicate_selection",
    "Move": "h_move",
    "Scale": "h_resize",
    "Apply": "h_apply",
    "Cancel": "h_cancel",
    "Delete floating": "h_discard",
    "Import": "h_import",
    "Import layer": "h_import",
    "New layer": "h_new_layer",
    "Duplicate layer": "h_duplicate_layer",
    "Delete layer": "h_delete_layer",
    "Move layer": "h_move_layer",
    "Merge down": "h_merge_down",
    "Merge visible": "h_merge_visible",
    "Layer properties": "h_layer_properties",
    "Rename layer": "h_rename_layer",
    "Layer opacity": "h_layer_opacity",
    "Hide layer": "h_hide_layer",
    "Show layer": "h_show_layer",
    "Lock layer": "h_lock_layer",
    "Unlock layer": "h_unlock_layer",
    "Mirror": "h_mirror",
    "Rotate": "h_rotate",
    "Replace color": "h_replace_color",
    "Canvas size": "h_canvas_size",
    "Increase contrast": "fx_auto_contrast",
    "Increase saturation": "fx_auto_saturation",
    "Colour to alpha": "fx_color_to_alpha",
    "Remove colours": "fx_reduce",
    "Filter": "h_filter",
    "Colorize dynamical": "fx_colorize",
    "Lightness": "fx_lightness",
    "Saturation": "fx_saturation",
    "Smooth": "fx_smooth",
    "Vignette": "fx_vignette",
};

// Names written into the document outlive the language they were made in,
// and are made even if the language chunk has not landed yet (t() is blank
// until it does): English stands in then.
export const layerName = (n) => tp("layer_n", { n }) || `Layer ${n}`;
export const layerCopyName = (name) => tp("layer_copy", { name }) || `${name} copy`;

/**
 * A history entry's label in the app's language. Entries keep the English
 * label (the core's own, or one of the panels' below), so the list follows a
 * language change and saved projects carry no translation.
 */
export const historyLabel = (label) => (HISTORY[label] ? tp(HISTORY[label]) : label);

// ── context menu: the core model's sections and items ───────────────────
const SECTIONS = {
    "Tools": "menu_tools",
    "Mirror mode": "menu_mirror_mode",
    "Apply to selection": "menu_apply_to_selection",
    "Color": "menu_color",
    "Effect": "menu_effect",
};
export const sectionLabel = (title) => (SECTIONS[title] ? tp(SECTIONS[title]) : title);

// Items are told apart by their icon name (unique within the model).
const ITEMS = {
    "pencil": "tool_pencil",
    "pencil-perfect": "menu_pencil_perfect",
    "mirror-none": "mirror_none",
    "mirror-vertical": "mirror_vertical",
    "mirror-horizontal": "mirror_horizontal",
    "mirror-both": "mirror_both",
    "select-clear": "sel_clear",
    "colorize": "fx_colorize",
    "average": "sel_average",
    "select-shrink": "sel_shrink",
    "select-grow": "sel_grow",
    "border": "sel_border",
    "bucket": "sel_fill",
    "crop": "sel_crop",
    "select-invert": "sel_invert",
    "copy": "sel_copy",
    "cut": "sel_cut",
    "erase": "sel_erase",
    "picker": "menu_pick_color",
    "replace": "menu_replace_color",
    "contrast": "menu_increase_contrast",
    "saturation": "menu_increase_saturation",
    "filter": "menu_add_filter",
    "reduce": "menu_remove_ten_percent",
    "reduce-auto": "menu_remove_some_colors",
    "smooth": "menu_smooth_a_bit",
};
export const menuItemLabel = (item) => (ITEMS[item.icon] ? tp(ITEMS[item.icon]) : item.label);
