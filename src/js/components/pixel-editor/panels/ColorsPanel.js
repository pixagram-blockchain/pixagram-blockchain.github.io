// ============================================================================
// pixel-editor/panels/ColorsPanel.js — paint colours
//
// The app's circular HSLuv picker edits the primary or the secondary colour;
// alpha has its own slider (the picker is opaque), the hex field takes
// #rgb / #rrggbb / #rrggbbaa. Under it, the colours already in the active
// layer, ordered along SIMDope's Hilbert curve so neighbours look alike: a
// tap paints with one, a long press or right-click makes it the secondary.
//
// The picker keeps its own HSLuv state from mount, so it is remounted (new
// key) whenever the colour changes from elsewhere — the eyedropper, a
// swatch, a swap — and it only writes back once the user has touched it:
// its mount-time onChange is an HSLuv round trip that could nudge an exact
// palette colour by one unit.
// ============================================================================

import * as React from "preact/compat";
import { useState, useRef, useEffect, useMemo } from "preact/compat";
import makeStyles from "@material-ui/core/styles/makeStyles";
import ButtonBase from "@material-ui/core/ButtonBase";
import IconButton from "@material-ui/core/IconButton";
import InputBase from "@material-ui/core/InputBase";
import Tooltip from "@material-ui/core/Tooltip";
import SwapVertIcon from "@material-ui/icons/SwapVert";
import { Color as SIMDopeColor } from "simdope";

import CircularColorPicker from "../../ColorPicker";
import { pack, toHex, fromHex, interop } from "../../../utils/pixa-editor/index.js";
import { tp } from "../labels";
import { useEditorEvents, cssColor } from "../editorUtils";
import { Section, SliderField, Hint, EASE } from "../ui";

const CHECKER = "repeating-conic-gradient(#3a3a3a 0% 25%, #262626 0% 50%) 50% / 8px 8px";
const MAX_SWATCHES = 128;
const SIMDOPE = { Color: SIMDopeColor };

const useStyles = makeStyles({
    // From 600 px the picker sits beside its fields instead of above them, so
    // the whole panel fits the drawer's height without scrolling.
    columns: {
        display: "grid",
        gridTemplateColumns: "minmax(300px, 340px) minmax(0, 1fr)",
        columnGap: 32,
        alignItems: "start",
    },
    side: {
        paddingTop: 4,
    },
    top: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 8,
    },
    target: {
        flex: 1,
        height: 48,
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: 10,
        padding: "0 14px 0 8px",
        borderRadius: 24,
        backgroundColor: "#171717",
        color: "#bbbbbb",
        fontFamily: `"Industry Book", "Normative Pro"`,
        fontSize: 13,
        transition: `background-color 160ms ${EASE}, color 160ms ${EASE}`,
        "&:hover": { backgroundColor: "#212121", color: "#ffffff" },
    },
    targetOn: {
        backgroundColor: "#e9e9e9 !important",
        color: "#1d1d1d !important",
    },
    dot: {
        position: "relative",
        flex: "0 0 auto",
        width: 32,
        height: 32,
        borderRadius: "50%",
        overflow: "hidden",
        background: CHECKER,
        boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
        "& > span": { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    },
    hexText: {
        fontFamily: `"Geist Mono", "Red Hat Display"`,
        fontSize: 12,
        textTransform: "uppercase",
    },
    swap: {
        width: 48,
        height: 48,
        backgroundColor: "#171717",
        color: "#dddddd",
        "&:hover": { backgroundColor: "#262626" },
    },
    picker: {
        display: "flex",
        justifyContent: "center",
        padding: "4px 0 8px",
        touchAction: "none",
    },
    hexRow: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 4px 8px",
    },
    hexLabel: {
        fontSize: 13,
        color: "#bbbbbb",
        fontFamily: `"Industry Book", "Normative Pro"`,
    },
    hexInput: {
        flex: 1,
        height: 40,
        padding: "0 16px",
        borderRadius: 20,
        backgroundColor: "rgba(255, 255, 255, 0.045)",
        color: "#eeeeee",
        fontFamily: `"Geist Mono", "Red Hat Display"`,
        fontSize: 14,
        "&.Mui-focused": { backgroundColor: "rgba(255, 255, 255, 0.07)" },
    },
    hexBad: {
        color: "#f2b8b5",
    },
    swatches: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(32px, 1fr))",
        gap: 6,
    },
    swatch: {
        position: "relative",
        width: "100%",
        paddingTop: "100%",
        borderRadius: 10,
        overflow: "hidden",
        background: CHECKER,
        transition: `transform 140ms ${EASE}, box-shadow 140ms ${EASE}`,
        "& > span": { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
        "&:hover": { transform: "scale(1.08)", boxShadow: "0 4px 12px rgba(0,0,0,0.6)" },
    },
    swatchOn: {
        transform: "scale(0.82)",
        boxShadow: "0 0 0 3px #101010, 0 0 0 5px #e9e9e9",
        "&:hover": { transform: "scale(0.86)" },
    },
});

const hexOf = (c) => {
    const h = toHex(c >>> 0);
    return (c >>> 24) === 255 ? h.slice(0, 7) : h;
};

function Swatch({ classes, color, on, onPick, onPickSecondary }) {
    const timer = useRef(0);
    const long = useRef(false);
    return (
        <ButtonBase
            className={classes.swatch + (on ? " " + classes.swatchOn : "")}
            aria-label={hexOf(color)}
            title={hexOf(color)}
            onClick={() => { if (!long.current) onPick(color); }}
            onContextMenu={(e) => { e.preventDefault(); onPickSecondary(color); }}
            onPointerDown={() => {
                long.current = false;
                clearTimeout(timer.current);
                timer.current = setTimeout(() => { long.current = true; onPickSecondary(color); }, 500);
            }}
            onPointerUp={() => clearTimeout(timer.current)}
            onPointerLeave={() => clearTimeout(timer.current)}
            onPointerCancel={() => clearTimeout(timer.current)}   // the drawer scrolled instead
        >
            <span style={{ background: cssColor(color) }} />
        </ButtonBase>
    );
}

export default function ColorsPanel({ ed, narrow }) {
    const classes = useStyles();
    useEditorEvents(ed, ["colors", "change", "layers", "document"]);
    const [target, setTarget] = useState("primary");
    const color = ed.colors[target] >>> 0;
    const alpha = color >>> 24;

    // The RGB behind a fully transparent colour is gone from the packed value
    // (transparent is canonical 0); keep the last visible one per target so
    // the alpha slider can bring it back.
    const lastRgb = useRef({ primary: 0, secondary: 0xffffff });
    if (alpha > 0) lastRgb.current[target] = color & 0xffffff;
    const rgb = lastRgb.current[target];
    const r = rgb & 255, g = (rgb >>> 8) & 255, b = (rgb >>> 16) & 255;

    // Picker remount bookkeeping (see header).
    const [pickerKey, setPickerKey] = useState(0);
    const fromPicker = useRef(-1);
    const mountedRgb = useRef(rgb);
    const touched = useRef(false);
    useEffect(() => {
        if (rgb === mountedRgb.current || rgb === fromPicker.current) return;
        mountedRgb.current = rgb;
        touched.current = false;
        setPickerKey((k) => k + 1);
    }, [rgb]);
    const shownTarget = useRef(target);
    useEffect(() => {
        if (shownTarget.current === target) return;
        shownTarget.current = target;
        mountedRgb.current = lastRgb.current[target];
        touched.current = false;
        setPickerKey((k) => k + 1);
    }, [target]);

    const setTargetColor = (c) => ed.setColors({ [target]: c >>> 0 });
    const onPicker = (v) => {
        if (!touched.current) return;
        const c = pack(v.r, v.g, v.b, alpha || 255);
        fromPicker.current = c & 0xffffff;
        setTargetColor(c);
    };

    // Hex field: shows the colour until edited; Enter or leaving applies.
    const [hexDraft, setHexDraft] = useState(null);
    const [hexBad, setHexBad] = useState(false);
    // Enter on a bad value says so; leaving the field with one puts the colour back.
    const applyHex = (revertIfBad) => {
        if (hexDraft === null) return;
        const v = hexDraft.trim().replace(/^#?/, "#");
        if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) {
            setTargetColor(fromHex(v));
            setHexDraft(null);
            setHexBad(false);
        } else if (revertIfBad) {
            setHexDraft(null);
            setHexBad(false);
        } else {
            setHexBad(true);
        }
    };

    // Colours of the active layer, Hilbert-ordered.
    const layer = ed.doc.activeLayer;
    const revision = layer.revision;
    const swatches = useMemo(() => {
        const used = layer.usage(), seen = new Set();
        for (let i = 1; i < used.length; i++) if (used[i]) seen.add(layer.palette.colors[i] >>> 0);
        const list = [...seen];
        const order = interop.sortPalette(list, { SIMDope: SIMDOPE, by: "hilbert" });
        return { colors: order.slice(0, MAX_SWATCHES).map((i) => list[i]), total: list.length };
    }, [layer, revision]);

    const size = narrow ? 232 : 248;

    const pickerColumn = (
        <div>
            <div className={classes.top}>
                {["primary", "secondary"].map((which) => (
                    <ButtonBase
                        key={which}
                        className={classes.target + (target === which ? " " + classes.targetOn : "")}
                        aria-pressed={target === which}
                        onClick={() => setTarget(which)}
                    >
                        <span className={classes.dot}><span style={{ background: cssColor(ed.colors[which]) }} /></span>
                        <span>
                            {tp(which)}
                            <br />
                            <span className={classes.hexText}>{hexOf(ed.colors[which])}</span>
                        </span>
                    </ButtonBase>
                ))}
                <Tooltip title={tp("swap_colors")}>
                    <IconButton className={classes.swap} aria-label={tp("swap_colors")} onClick={() => ed.run("color.swap")}>
                        <SwapVertIcon />
                    </IconButton>
                </Tooltip>
            </div>

            <div className={classes.picker} onPointerDownCapture={() => { touched.current = true; }}>
                <CircularColorPicker key={pickerKey} color={{ r, g, b, a: 1 }} size={size} onChange={onPicker} />
            </div>
        </div>
    );

    const fields = (
        <div className={narrow ? undefined : classes.side}>
            <SliderField
                label={tp("alpha")}
                value={Math.round((alpha / 255) * 100)}
                min={0}
                max={100}
                format={(v) => `${v}%`}
                onChange={(v) => {
                    const a = Math.round((v / 100) * 255);
                    setTargetColor(a === 0 ? 0 : ((a << 24) | rgb) >>> 0);
                }}
            />

            <div className={classes.hexRow}>
                <span className={classes.hexLabel}>{tp("hex")}</span>
                <InputBase
                    className={classes.hexInput + (hexBad ? " " + classes.hexBad : "")}
                    value={hexDraft === null ? hexOf(color) : hexDraft}
                    inputProps={{ "aria-label": tp("hex"), spellCheck: false, maxLength: 9, autoCapitalize: "off" }}
                    onChange={(e) => { setHexDraft(e.target.value); setHexBad(false); }}
                    onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") applyHex(false);
                        if (e.key === "Escape") { setHexDraft(null); setHexBad(false); }
                    }}
                    onBlur={() => applyHex(true)}
                />
            </div>
            {hexBad && <Hint>{tp("hex_invalid")}</Hint>}

            <Section title={tp("layer_colors", { name: layer.name })}>
                {swatches.colors.length ? (
                    <div className={classes.swatches}>
                        {swatches.colors.map((c) => (
                            <Swatch
                                key={c}
                                classes={classes}
                                color={c}
                                on={c === (ed.colors.primary >>> 0)}
                                onPick={(x) => ed.setColors({ primary: x })}
                                onPickSecondary={(x) => ed.setColors({ secondary: x })}
                            />
                        ))}
                    </div>
                ) : (
                    <Hint>{tp("layer_is_empty")}</Hint>
                )}
                {swatches.colors.length > 0 && (
                    <Hint>
                        {swatches.total > MAX_SWATCHES
                            ? tp("swatches_hint_more", { shown: MAX_SWATCHES, color: { color: swatches.total } })
                            : tp("swatches_hint")}
                    </Hint>
                )}
            </Section>
        </div>
    );

    return (
        <div className={narrow ? undefined : classes.columns}>
            {pickerColumn}
            {fields}
        </div>
    );
}
