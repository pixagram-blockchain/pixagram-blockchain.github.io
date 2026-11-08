// ============================================================================
// pixel-editor/ui.js — the small building blocks every panel shares
//
// Dark, flat and borderless, like the rest of the app: surfaces are told
// apart by tone (#101010 sheet, #171717 controls, #212121 hover) and by
// space, never by lines. Selected = inverted (light chip, dark ink), the
// same convention as the app's radial menu.
// ============================================================================

import * as React from "preact/compat";
import makeStyles from "@material-ui/core/styles/makeStyles";
import ButtonBase from "@material-ui/core/ButtonBase";
import Slider from "@material-ui/core/Slider";
import Switch from "@material-ui/core/Switch";
import Tooltip from "@material-ui/core/Tooltip";

export const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

const useStyles = makeStyles({
    section: {
        padding: "4px 0 12px 0",
    },
    sectionHead: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: 28,
        marginBottom: 6,
    },
    sectionTitle: {
        fontFamily: `"Industry Book", "Normative Pro"`,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "#939393",
    },
    segmented: {
        display: "inline-flex",
        flexWrap: "wrap",
        gap: 4,
        padding: 4,
        borderRadius: 20,
        backgroundColor: "#171717",
        maxWidth: "100%",
    },
    segment: {
        height: 32,
        padding: "0 14px",
        borderRadius: 16,
        color: "#bbbbbb",
        fontFamily: `"Industry Book", "Normative Pro"`,
        fontSize: 13,
        whiteSpace: "nowrap",
        transition: `background-color 160ms ${EASE}, color 160ms ${EASE}`,
        "&:hover": { backgroundColor: "#262626", color: "#ffffff" },
        "&.Mui-focusVisible": { backgroundColor: "#2e2e2e" },
    },
    segmentOn: {
        backgroundColor: "#e9e9e9 !important",
        color: "#1d1d1d !important",
    },
    tiles: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))",
        gap: 8,
    },
    tile: {
        minHeight: 76,
        padding: "10px 6px 8px",
        borderRadius: 18,
        backgroundColor: "#171717",
        color: "#dddddd",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        textAlign: "center",
        transition: `background-color 160ms ${EASE}, color 160ms ${EASE}, opacity 160ms ${EASE}`,
        "&:hover": { backgroundColor: "#212121", color: "#ffffff" },
        "&.Mui-focusVisible": { backgroundColor: "#2a2a2a" },
        "&.Mui-disabled": { opacity: 0.32 },
        "& .MuiSvgIcon-root": { fontSize: 22 },
    },
    tileOn: {
        backgroundColor: "#e9e9e9 !important",
        color: "#1d1d1d !important",
    },
    tileLabel: {
        fontFamily: `"Industry Book", "Normative Pro"`,
        fontSize: 12,
        lineHeight: 1.2,
        maxWidth: "100%",
        overflowWrap: "anywhere",   // long compound words (de, fi, hu…) still fit
        hyphens: "auto",
    },
    field: {
        padding: "2px 4px 0",
    },
    fieldHead: {
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 8,
        fontSize: 13,
        color: "#bbbbbb",
        fontFamily: `"Industry Book", "Normative Pro"`,
    },
    fieldValue: {
        fontFamily: `"Geist Mono", "Red Hat Display"`,
        fontVariantNumeric: "tabular-nums",
        color: "#eeeeee",
        fontSize: 12,
    },
    slider: {
        padding: "14px 0 !important",
        "& .MuiSlider-thumb": { width: 16, height: 16, marginTop: -7, marginLeft: -8 },
        "& .MuiSlider-rail": { opacity: 0.24 },
    },
    switchRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        minHeight: 40,
        padding: "0 0 0 4px",
        fontSize: 13,
        color: "#bbbbbb",
        fontFamily: `"Industry Book", "Normative Pro"`,
    },
    hint: {
        margin: "4px 4px 0",
        fontSize: 12,
        lineHeight: 1.45,
        color: "#8a8a8a",
        fontFamily: `"Normative Pro", "Industry Book"`,
    },
});

export function Section({ title, action, children }) {
    const classes = useStyles();
    return (
        <section className={classes.section}>
            {(title || action) && (
                <div className={classes.sectionHead}>
                    <span className={classes.sectionTitle}>{title}</span>
                    {action}
                </div>
            )}
            {children}
        </section>
    );
}

/** A row of pill buttons, one selected. options: [{ value, label, title? }] */
export function Segmented({ value, options, onChange, ariaLabel }) {
    const classes = useStyles();
    return (
        <div className={classes.segmented} role="radiogroup" aria-label={ariaLabel}>
            {options.map((o) => {
                const on = String(o.value) === String(value);
                const button = (
                    <ButtonBase
                        key={o.value}
                        role="radio"
                        aria-checked={on}
                        className={classes.segment + (on ? " " + classes.segmentOn : "")}
                        onClick={() => { if (!on) onChange(o.value); }}
                    >
                        {o.label}
                    </ButtonBase>
                );
                return o.title ? <Tooltip key={o.value} title={o.title}>{button}</Tooltip> : button;
            })}
        </div>
    );
}

export function Tiles({ children }) {
    const classes = useStyles();
    return <div className={classes.tiles}>{children}</div>;
}

/** A square action: icon over a short label. */
export function Tile({ Icon, iconStyle, label, title, onClick, disabled, on }) {
    const classes = useStyles();
    const tile = (
        <ButtonBase
            className={classes.tile + (on ? " " + classes.tileOn : "")}
            disabled={!!disabled}
            onClick={onClick}
            aria-pressed={on === undefined ? undefined : !!on}
            aria-label={label}
        >
            {Icon && <Icon style={iconStyle} />}
            <span className={classes.tileLabel}>{label}</span>
        </ButtonBase>
    );
    // A disabled button fires no events: the tooltip needs a live wrapper.
    if (!title) return tile;
    return <Tooltip title={title}><span style={{ display: "grid" }}>{tile}</span></Tooltip>;
}

/** Label, live value and a slider. onCommit fires when the drag ends. */
export function SliderField({ label, value, min, max, step = 1, onChange, onCommit, format = String, disabled }) {
    const classes = useStyles();
    return (
        <div className={classes.field}>
            <div className={classes.fieldHead}>
                <span>{label}</span>
                <span className={classes.fieldValue}>{format(value)}</span>
            </div>
            <Slider
                className={classes.slider}
                value={value}
                min={min}
                max={max}
                step={step}
                disabled={disabled}
                onChange={(e, v) => onChange(Array.isArray(v) ? v[0] : v)}
                onChangeCommitted={onCommit ? (e, v) => onCommit(Array.isArray(v) ? v[0] : v) : undefined}
                aria-label={label}
            />
        </div>
    );
}

export function SwitchField({ label, checked, onChange, disabled }) {
    const classes = useStyles();
    return (
        <label className={classes.switchRow} style={{ opacity: disabled ? 0.5 : 1 }}>
            <span>{label}</span>
            <Switch color="primary" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        </label>
    );
}

export function Hint({ children }) {
    const classes = useStyles();
    return <p className={classes.hint}>{children}</p>;
}
