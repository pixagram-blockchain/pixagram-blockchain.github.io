// Shared building blocks for the Metrics and Control Tower views.
// Greyscale only, no solid borders: surfaces are told apart by fill (#101010 / #171717),
// series by lightness and dash pattern, severity by a pill with an icon and a word.
import * as React from "preact/compat";

import withStyles from "@material-ui/core/styles/withStyles";
import Typography from "@material-ui/core/Typography";
import Tooltip from "@material-ui/core/Tooltip";
import TrendingUpIcon from "@material-ui/icons/TrendingUp";
import TrendingDownIcon from "@material-ui/icons/TrendingDown";
import TrendingFlatIcon from "@material-ui/icons/TrendingFlat";
import ErrorOutlineIcon from "@material-ui/icons/ErrorOutline";
import ReportProblemOutlinedIcon from "@material-ui/icons/ReportProblemOutlined";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import InfoOutlinedIcon from "@material-ui/icons/InfoOutlined";
import { ResponsiveContainer, AreaChart, Area } from "recharts";

import { t } from "../utils/text";
import { fmtSignedPct } from "../utils/tower";

/**
 * Translation with an English fallback. utils/text renders a missing key as its last segment,
 * so that value (or the key itself) means "not in any locale yet": show the fallback instead.
 */
export function tr(key, fallback) {
    const v = t(key);
    return !v || v === key || v === key.slice(key.lastIndexOf(".") + 1) ? fallback : v;
}

/** Same, with {name} placeholders filled by the component (single braces: left alone by utils/text). */
export function trf(key, fallback, vars) {
    return tr(key, fallback).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? String(vars[k]) : m));
}

// ---------------------------------------------------------------- chart look

export const INK = { primary: "#ffffff", secondary: "#888888", muted: "#666666", faint: "#444444" };

// Up to three series per chart: told apart by lightness AND dash, always labelled.
export const SERIES = [
    { stroke: "#f0f0f0", fill: "#d6d6d6", dash: undefined },
    { stroke: "#9a9a9a", fill: "#8a8a8a", dash: "6 4" },
    { stroke: "#5e5e5e", fill: "#4e4e4e", dash: "2 4" }
];

export const AXIS = {
    axisLine: false,
    tickLine: false,
    tick: { fill: INK.muted, fontSize: 11, fontFamily: "'Geist Mono', monospace" },
    tickMargin: 8
};

export const GRID = { vertical: false, stroke: "rgba(255,255,255,0.06)", strokeDasharray: "2 6" };

export const CURSOR = { stroke: "rgba(255,255,255,0.18)", strokeWidth: 1 };
export const BAR_CURSOR = { fill: "rgba(255,255,255,0.04)" };

export const ACTIVE_DOT = { r: 4, fill: "#ffffff", stroke: "#101010", strokeWidth: 2 };

// ---------------------------------------------------------------- styles

const styles = () => ({
    section: {
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: "16px",
        marginTop: "40px",
        marginBottom: "16px",
        flexWrap: "wrap"
    },
    sectionFirst: { marginTop: "8px" },
    sectionTitle: {
        fontSize: "18px",
        fontWeight: 600,
        color: "#fff",
        fontFamily: "'Industry Book'",
        lineHeight: 1.3
    },
    sectionDescription: {
        fontSize: "14px",
        color: "#888",
        fontFamily: "'Normative Pro'",
        marginTop: "2px",
        maxWidth: "640px"
    },
    card: {
        backgroundColor: "#101010",
        borderRadius: "16px",
        padding: "20px",
        position: "relative",
        minWidth: 0,
        display: "flex",
        flexDirection: "column"
    },
    cardHead: {
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "12px",
        marginBottom: "12px"
    },
    cardTitle: {
        fontSize: "12px",
        fontWeight: 500,
        color: "#888",
        fontFamily: "'Industry Book'",
        textTransform: "uppercase",
        letterSpacing: "0.5px"
    },
    cardSubtitle: {
        fontSize: "12px",
        color: "#666",
        fontFamily: "'Normative Pro'",
        marginTop: "2px"
    },
    cardInfo: { fontSize: "16px", color: "#555", cursor: "help", flex: "0 0 auto", "&:hover": { color: "#aaa" } },
    tooltipText: {
        margin: "8px",
        display: "block",
        fontSize: "14px",
        fontFamily: "'Normative Pro'",
        lineHeight: "22px",
        maxWidth: "300px"
    },
    // KPI tile
    tile: {
        backgroundColor: "#101010",
        borderRadius: "16px",
        padding: "20px 20px 0 20px",
        transition: "background-color 200ms cubic-bezier(0.4, 0, 0.2, 1)",
        position: "relative",
        overflow: "hidden",
        minWidth: 0,
        "&:hover": { backgroundColor: "#171717" }
    },
    tileHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "12px" },
    tileValue: {
        fontSize: "28px",
        fontWeight: 700,
        color: "#fff",
        fontFamily: "'Geist Mono', monospace",
        lineHeight: 1.1,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
    },
    tileUnit: { fontSize: "13px", fontWeight: 400, color: "#666", marginLeft: "6px" },
    tileSub: { fontSize: "12px", fontFamily: "'Normative Pro'", color: "#666", marginTop: "4px", minHeight: "16px" },
    tileSpark: { height: "44px", margin: "8px -20px 0 -20px" },
    tileNoSpark: { height: "20px" },
    trend: {
        display: "flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "12px",
        fontFamily: "'Geist Mono', monospace",
        color: "#888",
        whiteSpace: "nowrap"
    },
    trendIcon: { fontSize: "16px", color: "#888" },
    // tooltip of charts
    chartTip: {
        backgroundColor: "#1d1d1d",
        borderRadius: "12px",
        padding: "10px 12px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        minWidth: "140px"
    },
    chartTipLabel: { fontSize: "12px", color: "#888", fontFamily: "'Normative Pro'", marginBottom: "6px" },
    chartTipRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", lineHeight: "20px" },
    chartTipName: { fontSize: "12px", color: "#aaa", fontFamily: "'Normative Pro'", display: "flex", alignItems: "center", gap: "6px" },
    chartTipValue: { fontSize: "13px", color: "#fff", fontFamily: "'Geist Mono', monospace" },
    // legend swatch: a short line in the series' shade and dash
    swatch: { display: "inline-block", width: "16px", height: "0px", borderTopWidth: "2px", borderTopStyle: "solid", flex: "0 0 auto" },
    legend: { display: "flex", flexWrap: "wrap", gap: "16px", marginTop: "10px" },
    legendItem: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#888", fontFamily: "'Normative Pro'" },
    // pills
    pill: {
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "11px",
        fontWeight: 600,
        fontFamily: "'Industry Book'",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        padding: "3px 10px 3px 8px",
        borderRadius: "12px",
        whiteSpace: "nowrap",
        flex: "0 0 auto"
    },
    pillIcon: { fontSize: "14px" },
    pill_red: { backgroundColor: "#e8e8e8", color: "#111" },
    pill_amber: { backgroundColor: "#3a3a3a", color: "#e0e0e0" },
    pill_ok: { backgroundColor: "#1d1d1d", color: "#888" },
    pill_muted: { backgroundColor: "#1d1d1d", color: "#666" },
    // meter
    meter: { position: "relative", height: "8px", borderRadius: "4px", backgroundColor: "#222", overflow: "visible" },
    meterFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: "4px", backgroundColor: "#888" },
    meterFillStrong: { backgroundColor: "#fff" },
    meterMark: { position: "absolute", top: "-4px", bottom: "-4px", width: "2px", borderRadius: "1px", backgroundColor: "#555" },
    // switch (same language as the dialog's tabs)
    switch: { display: "inline-flex", backgroundColor: "#171717", borderRadius: "21px", padding: "4px", gap: "2px" },
    switchItem: {
        appearance: "none",
        border: "none",
        background: "transparent",
        color: "#989898",
        fontFamily: "'Geist Mono', monospace",
        fontSize: "12px",
        padding: "6px 14px",
        borderRadius: "17px",
        cursor: "pointer",
        transition: "all 225ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
        "&:hover": { backgroundColor: "rgba(255,255,255,0.06)" },
        "&:focus-visible": { outline: "none", boxShadow: "0 0 0 2px #555" }
    },
    switchActive: { backgroundColor: "#c7c7c7 !important", color: "#171717" },
    empty: {
        fontSize: "13px",
        color: "#666",
        fontFamily: "'Normative Pro'",
        lineHeight: 1.5,
        padding: "12px 0"
    },
    skeleton: {
        borderRadius: "12px",
        background: "linear-gradient(90deg, #141414 0%, #1a1a1a 50%, #141414 100%)",
        backgroundSize: "200% 100%",
        animation: "$shimmer 1.4s ease-in-out infinite"
    },
    "@keyframes shimmer": { "0%": { backgroundPosition: "200% 0" }, "100%": { backgroundPosition: "-200% 0" } }
});

const withKit = withStyles(styles);

// ---------------------------------------------------------------- components

export const Section = withKit(({ classes, title, description, right, first }) => (
    <div className={`${classes.section} ${first ? classes.sectionFirst : ""}`}>
        <div>
            <Typography component="h2" className={classes.sectionTitle}>{title}</Typography>
            {description ? <Typography className={classes.sectionDescription}>{description}</Typography> : null}
        </div>
        {right || null}
    </div>
));

export const InfoTip = withKit(({ classes, text }) =>
    text ? (
        <Tooltip arrow interactive title={<span className={classes.tooltipText}>{text}</span>}>
            <InfoOutlinedIcon className={classes.cardInfo} />
        </Tooltip>
    ) : null
);

export const Card = withKit(({ classes, title, subtitle, info, right, children, style, className }) => (
    <div className={`${classes.card} ${className || ""}`} style={style}>
        {title || right ? (
            <div className={classes.cardHead}>
                <div style={{ minWidth: 0 }}>
                    {title ? <div className={classes.cardTitle}>{title}</div> : null}
                    {subtitle ? <div className={classes.cardSubtitle}>{subtitle}</div> : null}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {right || null}
                    <InfoTip text={info} />
                </div>
            </div>
        ) : null}
        {children}
    </div>
));

export const Trend = withKit(({ classes, change, invert }) => {
    if (change == null || !isFinite(change)) return null;
    const flat = Math.abs(change) < 0.005;
    const Icon = flat ? TrendingFlatIcon : change > 0 ? TrendingUpIcon : TrendingDownIcon;
    return (
        <span className={classes.trend} title={invert ? "lower is better" : undefined}>
            <Icon className={classes.trendIcon} />
            {fmtSignedPct(change)}
        </span>
    );
});

/** KPI tile: label, value, change against the previous period, and a sparkline of the period. */
export const Tile = withKit(({ classes, label, value, unit, sub, change, spark, info, loading }) => (
    <div className={classes.tile}>
        <div className={classes.tileHead}>
            <span className={classes.cardTitle}>{label}</span>
            {info ? <InfoTip text={info} /> : <Trend change={change} />}
        </div>
        {loading ? (
            <div className={classes.skeleton} style={{ height: "31px", width: "60%" }} />
        ) : (
            <div className={classes.tileValue}>
                {value}
                {unit ? <span className={classes.tileUnit}>{unit}</span> : null}
            </div>
        )}
        <div className={classes.tileSub}>{info && change != null ? <Trend change={change} /> : sub}</div>
        {spark && spark.length > 1 ? (
            <div className={classes.tileSpark}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={spark} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                        <defs>
                            <linearGradient id="towerSpark" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#ffffff" stopOpacity={0.14} />
                                <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="v" stroke="#8a8a8a" strokeWidth={1.5} fill="url(#towerSpark)" isAnimationActive={false} dot={false} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        ) : (
            <div className={classes.tileNoSpark} />
        )}
    </div>
));

/** Recharts tooltip content: label on top, one row per series with its swatch. */
export const ChartTip = withKit(({ classes, active, payload, label, labelFormatter, valueFormatter, names }) => {
    if (!active || !payload || !payload.length) return null;
    return (
        <div className={classes.chartTip}>
            <div className={classes.chartTipLabel}>{labelFormatter ? labelFormatter(label, payload) : label}</div>
            {payload.map((p, i) => {
                const s = SERIES[Math.min(i, SERIES.length - 1)];
                return (
                    <div key={p.dataKey || i} className={classes.chartTipRow}>
                        <span className={classes.chartTipName}>
                            {payload.length > 1 ? (
                                <span className={classes.swatch} style={{ borderTopColor: p.stroke || p.fill || s.stroke, borderTopStyle: p.strokeDasharray ? "dashed" : "solid" }} />
                            ) : null}
                            {(names && names[p.dataKey]) || p.name}
                        </span>
                        <span className={classes.chartTipValue}>{valueFormatter ? valueFormatter(p.value, p) : p.value}</span>
                    </div>
                );
            })}
        </div>
    );
});

export const Legend = withKit(({ classes, items }) => (
    <div className={classes.legend}>
        {items.map((it, i) => {
            const s = SERIES[Math.min(i, SERIES.length - 1)];
            return (
                <span key={it.label} className={classes.legendItem}>
                    <span className={classes.swatch} style={{ borderTopColor: it.color || s.stroke, borderTopStyle: (it.dash !== undefined ? it.dash : s.dash) ? "dashed" : "solid" }} />
                    {it.label}
                </span>
            );
        })}
    </div>
));

const PILL_ICONS = { red: ErrorOutlineIcon, amber: ReportProblemOutlinedIcon, ok: CheckCircleOutlineIcon, muted: null };

export const Pill = withKit(({ classes, level = "muted", children, icon = true }) => {
    const Icon = icon ? PILL_ICONS[level] : null;
    return (
        <span className={`${classes.pill} ${classes["pill_" + level]}`}>
            {Icon ? <Icon className={classes.pillIcon} /> : null}
            {children}
        </span>
    );
});

/** Horizontal meter 0..1 with optional marks (thresholds) at positions 0..1. */
export const Meter = withKit(({ classes, value, marks = [], strong }) => (
    <div className={classes.meter} role="meter" aria-valuemin={0} aria-valuemax={1} aria-valuenow={value || 0}>
        <div
            className={`${classes.meterFill} ${strong ? classes.meterFillStrong : ""}`}
            style={{ width: `${Math.max(0, Math.min(1, value || 0)) * 100}%` }}
        />
        {marks.map((m) => (
            <div key={m} className={classes.meterMark} style={{ left: `calc(${Math.max(0, Math.min(1, m)) * 100}% - 1px)` }} />
        ))}
    </div>
));

export const Switch = withKit(({ classes, options, value, onChange, label }) => (
    <div className={classes.switch} role="radiogroup" aria-label={label}>
        {options.map((o) => (
            <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={o.value === value}
                className={`${classes.switchItem} ${o.value === value ? classes.switchActive : ""}`}
                onClick={() => onChange(o.value)}
            >
                {o.label}
            </button>
        ))}
    </div>
));

export const Empty = withKit(({ classes, children }) => <div className={classes.empty}>{children}</div>);

export const Skeleton = withKit(({ classes, height = 160 }) => <div className={classes.skeleton} style={{ height: `${height}px` }} />);

// ---------------------------------------------------------------- loading

/**
 * Loads data while the view is on screen and refreshes it every `every` ms while it stays there.
 * The dialog keeps every tab mounted, so off-screen tabs must not poll.
 */
export class Visible {
    constructor(onVisible, every = 60000) {
        this.onVisible = onVisible;
        this.every = every;
        this.visible = false;
        this.last = 0;
        this.timer = null;
        this.observer = null;
    }
    attach(el) {
        if (!el || this.observer) return;
        if (typeof IntersectionObserver === "undefined") {
            this.visible = true;
            this.tick();
        } else {
            this.observer = new IntersectionObserver((entries) => {
                const v = entries.some((e) => e.isIntersecting);
                if (v && !this.visible) {
                    this.visible = true;
                    if (Date.now() - this.last > this.every / 2) this.tick();
                } else if (!v) this.visible = false;
            });
            this.observer.observe(el);
        }
        this.timer = setInterval(() => {
            if (this.visible && typeof document !== "undefined" && document.visibilityState === "visible") this.tick();
        }, this.every);
    }
    tick() {
        this.last = Date.now();
        this.onVisible();
    }
    detach() {
        if (this.observer) this.observer.disconnect();
        if (this.timer) clearInterval(this.timer);
        this.observer = null;
        this.timer = null;
    }
}

export const kitStyles = styles;
