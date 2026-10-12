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
import ExpandMoreRoundedIcon from "@material-ui/icons/ExpandMoreRounded";
import Collapse from "@material-ui/core/Collapse";
// Recharts by module, as the wallet already imports it: one copy of the library in the app, and only
// the chart types a view uses in its chunk.
import { ResponsiveContainer } from "recharts/lib/component/ResponsiveContainer";
import { AreaChart } from "recharts/lib/chart/AreaChart";
import { Area } from "recharts/lib/cartesian/Area";
import { Rectangle } from "recharts/lib/shape/Rectangle";

import { t, getLocaleCode } from "../utils/text";
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

// Solid hairlines: dashes are reserved for telling series apart.
export const GRID = { vertical: false, stroke: "rgba(255,255,255,0.06)" };

export const CURSOR = { stroke: "rgba(255,255,255,0.18)", strokeWidth: 1 };
export const BAR_CURSOR = { fill: "rgba(255,255,255,0.04)" };

export const ACTIVE_DOT = { r: 4, fill: "#ffffff", stroke: "#101010", strokeWidth: 2 };

// Bars: at most 24 px thick, rounded at the data end only.
export const BAR = { maxBarSize: 24, radius: [4, 4, 0, 0], isAnimationActive: false };
export const HBAR = { maxBarSize: 18, radius: [0, 4, 4, 0], isAnimationActive: false };

// A range (low to high within a bucket) behind a line: a wash, never a block.
export const BAND = { stroke: "none", fill: "#ffffff", fillOpacity: 0.08, isAnimationActive: false };

// ---------------------------------------------------------------- dates

/** The app's language for dates (utils/text), en-GB when it cannot say. */
function dateLocale() {
    try {
        return (typeof getLocaleCode === "function" && getLocaleCode()) || "en-GB";
    } catch (e) {
        return "en-GB";
    }
}

/** A UTC timestamp (seconds) as a calendar date in the app's language. The Tower counts days in UTC. */
export function fmtDate(sec, opts) {
    const d = new Date(sec * 1000);
    try {
        return d.toLocaleDateString(dateLocale(), { timeZone: "UTC", ...opts });
    } catch (e) {
        return d.toLocaleDateString("en-GB", { timeZone: "UTC", ...opts });
    }
}

const hh = (sec) => `${String(new Date(sec * 1000).getUTCHours()).padStart(2, "0")}:00`;

/**
 * Axis label of a time bucket: hours as "15:00" and the date at midnight, days as "11 Oct", months as
 * "Oct 26". Short enough for the last label to fit at the chart's edge; tooltips use bucketLabel.
 */
export function axisTick(bucket, grain) {
    if (grain === "hour" && new Date(bucket * 1000).getUTCHours() !== 0) return hh(bucket);
    if (grain === "month") return fmtDate(bucket, { month: "short", year: "2-digit" });
    if (grain === "year") return String(new Date(bucket * 1000).getUTCFullYear());
    return fmtDate(bucket, { day: "numeric", month: "short" });
}

/** Full label of a bucket, for tooltips: "11 Oct 09:00", "11 Oct", "Week of 5 Oct 2026", "October 2026". */
export function bucketLabel(bucket, grain) {
    if (grain === "hour") return `${fmtDate(bucket, { day: "numeric", month: "short" })} ${hh(bucket)}`;
    if (grain === "week") return trf("components.gdreports.week_of_n", "Week of {n}", { n: fmtDate(bucket, { day: "numeric", month: "short", year: "numeric" }) });
    if (grain === "month") return fmtDate(bucket, { month: "long", year: "numeric" });
    if (grain === "year") return String(new Date(bucket * 1000).getUTCFullYear());
    return fmtDate(bucket, { day: "numeric", month: "short" });
}

/**
 * One row per hour or day bucket of [from, to), so a quiet bucket shows as 0 instead of vanishing from the
 * axis: rows missing from `rows` get 0 for each of `keys`.
 */
export function fillBuckets(rows, from, to, grain, keys) {
    if (grain !== "hour" && grain !== "day") return rows;
    const step = grain === "hour" ? 3600 : 86400;
    const by = new Map(rows.map((r) => [r.bucket, r]));
    const out = [];
    // never past the bucket now running: a later slot would only be an empty bar
    const end = Math.min(to, (Math.floor(Date.now() / 1000 / step) + 1) * step);
    for (let b = Math.ceil(from / step) * step; b < end; b += step) {
        const r = by.get(b) || { bucket: b };
        const row = { ...r };
        for (const k of keys) if (row[k] == null) row[k] = 0;
        out.push(row);
    }
    return out;
}

/**
 * The values of a `/metrics/{id}/latest` response that belong to its newest write. The API returns each
 * dimension's own last row, so a dimension no longer written (a version nobody runs any more, a witness
 * without a key) would otherwise linger with its old value.
 */
export function newestOnly(values) {
    const list = values || [];
    let newest = "";
    for (const v of list) if (v.t && v.t > newest) newest = v.t;
    return newest ? list.filter((v) => v.t === newest) : list;
}

/**
 * Bar shape for a stack (`shape={stackShape(keys)}` on each of its bars, keys bottom to top): a segment
 * resting on another gives up 2 px at its base, so stacked fills stay 2 px apart on any surface, and only
 * the outermost segment of each bar (above or below zero) gets the rounded data end.
 */
export function stackShape(keys) {
    return function StackSegment(props) {
        const { height, value, payload, dataKey } = props;
        if (!height) return null;
        const own = payload ? payload[dataKey] : 0;
        const sign = own < 0 ? -1 : 1;
        const outer = !keys.slice(keys.indexOf(dataKey) + 1).some((k) => payload && payload[k] && Math.sign(payload[k]) === sign);
        const onBase = !Array.isArray(value) || !value[0];
        const s = height > 0 ? 1 : -1;
        return (
            <Rectangle
                {...props}
                radius={outer ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                height={onBase ? height : s * Math.max(1, Math.abs(height) - 2)}
            />
        );
    };
}

/**
 * A value scale with round ticks, for a YAxis: { domain, ticks, step }. A flat series gets at least ±1%
 * around it, so rounding noise never reads as a cliff; at most `maxTicks` ticks; `integer` keeps the step a
 * whole number (counts). Label the ticks with tickFormat(step), so neighbouring ticks never print alike.
 */
export function niceScale(lo, hi, maxTicks = 5, floorAtZero = true, integer = false) {
    if (lo == null || hi == null || !isFinite(lo) || !isFinite(hi)) return { domain: ["auto", "auto"], ticks: undefined, step: null };
    let a = lo;
    let b = hi;
    const floor = Math.max(Math.abs(hi), Math.abs(lo)) * 0.02 || 1;
    if (b - a < floor) {
        const pad = (floor - (b - a)) / 2;
        a -= pad;
        b += pad;
    }
    if (floorAtZero && lo >= 0) a = Math.max(0, a);
    const power = Math.max(integer ? 0 : -12, Math.floor(Math.log10((b - a) / Math.max(1, maxTicks - 1))));
    let step = 0;
    let n0 = 0;
    let n1 = 0;
    search: for (const p of [power, power + 1, power + 2]) {
        for (const f of integer ? [1, 2, 5] : [1, 2, 2.5, 5]) {
            step = f * Math.pow(10, p);
            n0 = Math.floor(a / step + 1e-9);
            n1 = Math.ceil(b / step - 1e-9);
            if (n1 - n0 + 1 <= maxTicks) break search;
        }
    }
    const ticks = [];
    for (let n = n0; n <= n1; n++) ticks.push(Number((n * step).toPrecision(12)));
    return { domain: [ticks[0], ticks[ticks.length - 1]], ticks, step };
}

/** Tick labels for a niceScale step: compact like fmtCompact (K from 10,000, M, B), with the decimals the step needs. */
export function tickFormat(step) {
    return (v) => {
        if (v == null || !isFinite(v)) return "";
        const a = Math.abs(v);
        const [div, unit] = a >= 1e9 ? [1e9, "B"] : a >= 1e6 ? [1e6, "M"] : a >= 1e4 ? [1e3, "K"] : [1, ""];
        const s = step ? step / div : 1;
        let digits = 0;
        while (digits < 3 && Math.abs(Math.round(s * Math.pow(10, digits)) - s * Math.pow(10, digits)) > 1e-6) digits++;
        const text = (a / div).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
        return `${v < 0 ? "−" : ""}${text}${unit}`;
    };
}

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
        flexWrap: "wrap",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "8px 12px",
        marginBottom: "12px"
    },
    // the title takes the line; a control too wide to sit beside it moves below, to the right
    cardHeadMain: { minWidth: 0, flex: "1 1 180px" },
    cardHeadRight: { display: "flex", alignItems: "center", gap: "8px", marginLeft: "auto" },
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
    "@keyframes shimmer": { "0%": { backgroundPosition: "200% 0" }, "100%": { backgroundPosition: "-200% 0" } },
    // legend swatch for bars and areas: a small rounded block, as the mark is
    swatchBlock: { display: "inline-block", width: "10px", height: "10px", borderRadius: "3px", flex: "0 0 auto" },
    // compact stats for narrow places (profile sidebar, wallet, follow list)
    miniStats: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px" },
    // wide places: as many as fit at 150 px, two per row on a phone
    miniStatsAuto: { gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" },
    miniStat: {
        backgroundColor: "#171717",
        borderRadius: "12px",
        padding: "10px 12px",
        minWidth: 0,
        transition: "background-color 150ms ease",
        "&:hover": { backgroundColor: "#1d1d1d" }
    },
    miniStatHead: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "6px", minWidth: 0 },
    miniStatLabel: {
        fontSize: "11px",
        color: "#888",
        fontFamily: "'Industry Book'",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
    },
    miniStatValue: {
        fontSize: "18px",
        fontWeight: 600,
        color: "#fff",
        fontFamily: "'Geist Mono', monospace",
        lineHeight: 1.25,
        marginTop: "4px",
        minWidth: 0,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
    },
    miniStatUnit: { fontSize: "11px", fontWeight: 400, color: "#666", marginLeft: "4px" },
    miniStatSub: { fontSize: "11px", color: "#666", fontFamily: "'Normative Pro'", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    miniTrend: { display: "inline-flex", alignItems: "center", gap: "2px", fontSize: "11px", fontFamily: "'Geist Mono', monospace", color: "#888", whiteSpace: "nowrap" },
    miniTrendIcon: { fontSize: "14px", color: "#888" },
    // a refetch keeps the previous figures on screen, dimmed: no skeleton, no jump
    frame: { transition: "opacity 200ms ease" },
    frameBusy: { opacity: 0.45 },
    // collapsible section: the wallet's section header, for places without one
    collapseHeader: {
        appearance: "none",
        border: "none",
        background: "transparent",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        padding: "8px 4px 8px 8px",
        borderRadius: "16px",
        cursor: "pointer",
        color: "#fff",
        textAlign: "left",
        transition: "background-color 150ms ease",
        "&:hover": { backgroundColor: "rgba(255,255,255,0.04)" },
        "&:focus-visible": { outline: "none", boxShadow: "0 0 0 2px #555" }
    },
    collapseTitle: { display: "flex", alignItems: "baseline", gap: "8px", minWidth: 0, fontSize: "15px", fontWeight: 600, fontFamily: "'Industry Book'" },
    collapseCount: { fontSize: "12px", color: "#666", fontWeight: 400, fontFamily: "'Geist Mono', monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    collapseChevron: { color: "#666", transition: "transform 200ms ease", flex: "0 0 auto" },
    collapseChevronOpen: { transform: "rotate(180deg)" },
    collapseBody: { padding: "4px 0 12px 0" },
    // accordion of a view's sections (Metrics, Control Tower): one open at a time
    accordion: { "& + &": { marginTop: "2px" } },
    accordionHeading: { margin: 0 },
    accordionHead: {
        appearance: "none",
        border: "none",
        background: "transparent",
        color: "inherit",
        textAlign: "left",
        cursor: "pointer",
        width: "calc(100% + 24px)",
        margin: "0 -12px",
        padding: "14px 12px",
        borderRadius: "16px",
        scrollMarginTop: "8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        transition: "background-color 150ms ease",
        "&:hover": { backgroundColor: "rgba(255,255,255,0.03)" },
        "&:focus-visible": { outline: "none", boxShadow: "inset 0 0 0 2px #555" }
    },
    accordionText: { display: "flex", flexDirection: "column", minWidth: 0 },
    accordionTitle: { fontSize: "18px", fontWeight: 600, color: "#fff", fontFamily: "'Industry Book'", lineHeight: 1.3 },
    accordionDescription: { display: "block", fontSize: "14px", color: "#888", fontFamily: "'Normative Pro'", marginTop: "2px", maxWidth: "640px", lineHeight: 1.45 },
    accordionChevron: { color: "#666", fontSize: "26px", flex: "0 0 auto", transition: "transform 200ms ease" },
    accordionBody: { padding: "4px 0 28px 0" }
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
                <div className={classes.cardHeadMain}>
                    {title ? <div className={classes.cardTitle}>{title}</div> : null}
                    {subtitle ? <div className={classes.cardSubtitle}>{subtitle}</div> : null}
                </div>
                <div className={classes.cardHeadRight}>
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
                                <span
                                    className={classes.swatch}
                                    style={{
                                        // A range band (low-high) is a faint wash: key it faintly too.
                                        borderTopColor: Array.isArray(p.value) ? "rgba(255,255,255,0.3)" : p.stroke && p.stroke !== "none" ? p.stroke : p.fill || s.stroke,
                                        borderTopStyle: p.strokeDasharray ? "dashed" : "solid"
                                    }}
                                />
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

/** Legend: a line key for lines, a block for bars and areas (shape: "block"), as the mark is drawn. */
export const Legend = withKit(({ classes, items }) => (
    <div className={classes.legend}>
        {items.map((it, i) => {
            const s = SERIES[Math.min(i, SERIES.length - 1)];
            return (
                <span key={it.label} className={classes.legendItem}>
                    {it.shape === "block" ? (
                        <span className={classes.swatchBlock} style={{ backgroundColor: it.color || s.fill }} />
                    ) : (
                        <span className={classes.swatch} style={{ borderTopColor: it.color || s.stroke, borderTopStyle: (it.dash !== undefined ? it.dash : s.dash) ? "dashed" : "solid" }} />
                    )}
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

/** Compact stat: label, value with unit, change against the period before, and a short line under it. */
export const MiniStat = withKit(({ classes, label, value, unit, change, sub, title }) => {
    const flat = change != null && isFinite(change) && Math.abs(change) < 0.005;
    const Icon = change == null || !isFinite(change) ? null : flat ? TrendingFlatIcon : change > 0 ? TrendingUpIcon : TrendingDownIcon;
    // Ten times or more: "×12" reads better than "+1,100%".
    const changeText = Icon ? (change >= 9 ? `×${Math.round(change + 1)}` : fmtSignedPct(change, Math.abs(change) >= 1 ? 0 : 1)) : null;
    return (
        <div className={classes.miniStat} title={title}>
            <div className={classes.miniStatLabel}>{label}</div>
            <div className={classes.miniStatHead}>
                <span className={classes.miniStatValue}>
                    {value}
                    {unit ? <span className={classes.miniStatUnit}>{unit}</span> : null}
                </span>
                {Icon ? (
                    <span className={classes.miniTrend}>
                        <Icon className={classes.miniTrendIcon} />
                        {changeText}
                    </span>
                ) : null}
            </div>
            {sub ? <div className={classes.miniStatSub}>{sub}</div> : null}
        </div>
    );
});

/** Two compact stats per row, or (columns > 2) as many as fit, at least 150 px each. */
export const MiniStats = withKit(({ classes, children, columns = 2 }) => (
    <div className={`${classes.miniStats} ${columns > 2 ? classes.miniStatsAuto : ""}`}>{children}</div>
));

/** Keeps the last render on screen while new figures load, dimmed. */
export const Frame = withKit(({ classes, busy, children, style }) => (
    <div className={`${classes.frame} ${busy ? classes.frameBusy : ""}`} style={style} aria-busy={busy ? "true" : undefined}>
        {children}
    </div>
));

/**
 * Collapsible section with the wallet's header look: title, a short summary that stays visible while
 * collapsed, and a chevron. Content is mounted only once opened, so nothing loads before that.
 */
export class CollapseSection extends React.PureComponent {
    state = { open: !!this.props.defaultOpen, mounted: !!this.props.defaultOpen };

    _toggle = () => this.setState((s) => ({ open: !s.open, mounted: true }), () => {
        if (this.props.onToggle) this.props.onToggle(this.state.open);
    });

    render() {
        return <CollapseSectionView {...this.props} open={this.state.open} mounted={this.state.mounted} onToggle={this._toggle} />;
    }
}

const CollapseSectionView = withKit(({ classes, title, count, open, mounted, onToggle, children, style }) => (
    <div style={style}>
        <button type="button" className={classes.collapseHeader} onClick={onToggle} aria-expanded={open}>
            <span className={classes.collapseTitle}>
                <span>{title}</span>
                {count ? <span className={classes.collapseCount}>{count}</span> : null}
            </span>
            <ExpandMoreRoundedIcon className={`${classes.collapseChevron} ${open ? classes.collapseChevronOpen : ""}`} />
        </button>
        <Collapse in={open} timeout="auto">
            <div className={classes.collapseBody}>{mounted ? children : null}</div>
        </Collapse>
    </div>
));

/** Duration of an accordion section opening or closing, in ms. */
export const ACCORDION_MS = 250;

/**
 * One section of an accordion, controlled: `open` comes from the view (and the address), `onToggle(id)`
 * asks for it to open or close. The body is only in the page while open, so a closed section draws nothing.
 * `scope` keeps ids unique when several views are mounted at once; `headRef` receives the header button.
 * Give the body as `render` (a function) rather than children when it is costly to build: it is then only
 * called while the section is open or folding.
 */
const Lazy = ({ render }) => render();

export const AccordionSection = withKit(({ classes, scope, id, title, description, open, onToggle, headRef, render, children }) => {
    const bodyId = `gd-${scope}-${id}`;
    return (
        <div className={classes.accordion}>
            <Typography component="h2" className={classes.accordionHeading}>
                <button
                    type="button"
                    ref={headRef}
                    className={classes.accordionHead}
                    onClick={() => onToggle(id)}
                    aria-expanded={open}
                    aria-controls={bodyId}
                >
                    <span className={classes.accordionText}>
                        <span className={classes.accordionTitle}>{title}</span>
                        {description ? <span className={classes.accordionDescription}>{description}</span> : null}
                    </span>
                    <ExpandMoreRoundedIcon className={`${classes.accordionChevron} ${open ? classes.collapseChevronOpen : ""}`} />
                </button>
            </Typography>
            <Collapse in={open} timeout={ACCORDION_MS} unmountOnExit>
                <div id={bodyId} role="region" aria-label={typeof title === "string" ? title : undefined} className={classes.accordionBody}>
                    {render ? <Lazy render={render} /> : children}
                </div>
            </Collapse>
        </div>
    );
});

// ---------------------------------------------------------------- loading

/**
 * [ref, seen] for function components: `seen` turns true once the element given to `ref` has been on
 * screen, and stays true. A block in a hidden tab or a collapsed card loads nothing until it is shown.
 */
export function useSeen() {
    const [el, setEl] = React.useState(null);
    const [seen, setSeen] = React.useState(false);
    React.useEffect(() => {
        if (seen || !el) return undefined;
        if (typeof IntersectionObserver === "undefined") {
            setSeen(true);
            return undefined;
        }
        const io = new IntersectionObserver((entries) => {
            if (entries.some((e) => e.isIntersecting)) {
                setSeen(true);
                io.disconnect();
            }
        });
        io.observe(el);
        return () => io.disconnect();
    }, [el, seen]);
    return [setEl, seen];
}

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
