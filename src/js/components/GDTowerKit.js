// Shared building blocks for the Metrics and Control Tower views.
// Greyscale only, no solid borders: surfaces are told apart by fill (#101010 / #171717),
// series by lightness and dash pattern, parts of a whole by hatching, severity by a pill with an icon and a word.
// Icons sit in a rounded tile with the glyph cut out of it, as in the Pixagram mark.
// Both views are hubs: a grid of sections that opens into one of them. The icon tiles carry the motion
// between the two (hubSnapshot / hubPlay), and cards of different heights stack in a Masonry.
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
import ArrowBackRoundedIcon from "@material-ui/icons/ArrowBackRounded";
import Collapse from "@material-ui/core/Collapse";
// Recharts by module, as the wallet already imports it: one copy of the library in the app, and only
// the chart types a view uses in its chunk.
import { ResponsiveContainer } from "recharts/lib/component/ResponsiveContainer";
import { AreaChart } from "recharts/lib/chart/AreaChart";
import { Area } from "recharts/lib/cartesian/Area";
import { Rectangle } from "recharts/lib/shape/Rectangle";

import { t, getLocaleCode } from "../utils/text";
import { fmtSignedPct, fmtPct, fmtInt } from "../utils/tower";

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

// ---------------------------------------------------------------- motion

// Quick out, long settle: every move of a hub (icons flying, cards rising, masonry cells sliding) uses it.
export const HUB_EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

// Duration of an icon's flight between a hub's grid and a section's header, in ms.
export const HUB_MS = 520;

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

// Meters: dashes of 4 × 6 px, 3 px apart, drawn by an SVG tile repeated along the row so their corners stay round.
const DASH = 4;
const DASH_GAP = 3;
const DASH_H = 6;
const METER_TRACK = "#262626";
const METER_FILL = "#9a9a9a";
const METER_STRONG = "#f0f0f0";

function dashes(color) {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${DASH + DASH_GAP}' height='${DASH_H}'><rect width='${DASH}' height='${DASH_H}' rx='1' fill='${color}'/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}") left center / ${DASH + DASH_GAP}px ${DASH_H}px repeat-x`;
}

// Heatmap cells, from nothing to the busiest. A cell without data (not yet, not scheduled) is left hollow.
const HEAT = ["#1b1b1b", "#2b2b2b", "#424242", "#5e5e5e", "#868686", "#b8b8b8"];

// Parts of a whole, told apart by hatching (lines at four angles, a grid, dots) and by lightness.
const HATCHES = [
    { angle: 45, gap: 4, width: 1.3, color: "#d6d6d6" },
    { angle: 0, gap: 4, width: 1.2, color: "#a3a3a3" },
    { angle: 90, gap: 4, width: 1.2, color: "#8a8a8a" },
    { angle: -45, gap: 5, width: 1.2, color: "#bcbcbc" },
    { grid: true, gap: 6, width: 1, color: "#909090" },
    { dots: true, gap: 5, r: 1.15, color: "#c4c4c4" },
    { angle: 45, gap: 8, width: 1, color: "#767676" },
    { angle: 0, gap: 7, width: 1, color: "#6a6a6a" }
];

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
 * Ticks for a time axis of `rows` ({ bucket }): over more than two days of hours, one at each midnight,
 * which axisTick shows as the date; otherwise undefined, and the chart picks its own.
 */
export function timeTicks(rows, grain) {
    if (grain !== "hour" || !rows || rows.length < 49) return undefined;
    const ticks = rows.map((r) => r.bucket).filter((b) => b % 86400 === 0);
    return ticks.length >= 2 ? ticks : undefined;
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
    // meter: a row of short dashes, lit up to the value
    meter: { position: "relative", height: `${DASH_H}px`, overflow: "visible" },
    meterTrack: { position: "absolute", left: 0, top: 0, bottom: 0, width: "100%", background: dashes(METER_TRACK) },
    meterFill: { position: "absolute", left: 0, top: 0, bottom: 0, background: dashes(METER_FILL), transition: "width 300ms ease" },
    meterFillStrong: { background: dashes(METER_STRONG) },
    meterMark: { position: "absolute", top: "-4px", bottom: "-4px", width: "2px", borderRadius: "1px", backgroundColor: "#777" },
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
        "&:hover $accordionIcon": { color: "#5c5c5c" },
        "&:focus-visible": { outline: "none", boxShadow: "inset 0 0 0 2px #555" }
    },
    // the open section's tile lights up, as the active choice of a switch does
    accordionHeadOpen: { "& $accordionIcon, &:hover $accordionIcon": { color: "#e8e8e8" } },
    accordionLead: { display: "flex", alignItems: "flex-start", gap: "14px", minWidth: 0 },
    accordionIcon: { display: "flex", flex: "0 0 auto", marginTop: "3px", color: "#424242", transition: "color 150ms ease" },
    accordionText: { display: "flex", flexDirection: "column", minWidth: 0 },
    accordionTitle: { fontSize: "18px", fontWeight: 600, color: "#fff", fontFamily: "'Industry Book'", lineHeight: 1.3 },
    accordionDescription: { display: "block", fontSize: "14px", color: "#888", fontFamily: "'Normative Pro'", marginTop: "2px", maxWidth: "640px", lineHeight: 1.45 },
    accordionChevron: { color: "#666", fontSize: "26px", flex: "0 0 auto", transition: "transform 200ms ease" },
    accordionBody: { padding: "4px 0 28px 0" },
    // pie of hatched parts (a ring, the figure under the pointer in its middle) and its legend
    pie: { display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", alignItems: "center", columnGap: "24px" },
    pieStacked: { gridTemplateColumns: "minmax(0, 1fr)", justifyItems: "center", rowGap: "16px" },
    pieFigure: { position: "relative", lineHeight: 0 },
    pieSlice: { transition: "opacity 150ms ease, transform 150ms ease" },
    pieCenter: {
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        lineHeight: 1.2,
        pointerEvents: "none"
    },
    pieCenterValue: { fontSize: "16px", fontWeight: 600, color: "#fff", fontFamily: "'Geist Mono', monospace", whiteSpace: "nowrap" },
    pieCenterCaption: {
        fontSize: "11px",
        color: "#777",
        fontFamily: "'Normative Pro'",
        marginTop: "3px",
        lineHeight: 1.3,
        overflow: "hidden",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical"
    },
    pieLegend: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0, width: "100%" },
    pieRow: {
        display: "grid",
        gridTemplateColumns: "14px minmax(0, 1fr) auto",
        alignItems: "center",
        columnGap: "10px",
        padding: "6px 8px",
        borderRadius: "10px",
        transition: "background-color 150ms ease"
    },
    pieRowActive: { backgroundColor: "#171717" },
    pieSwatch: { display: "block" },
    pieName: { fontSize: "13px", color: "#ddd", fontFamily: "'Normative Pro'", lineHeight: 1.3, minWidth: 0 },
    pieSub: { display: "block", fontSize: "11px", color: "#666", marginTop: "1px" },
    pieShare: { fontSize: "13px", color: "#fff", fontFamily: "'Geist Mono', monospace", textAlign: "right", whiteSpace: "nowrap" },
    // heatmap: rows of cells, lighter where busier
    heatGrid: { display: "grid", columnGap: "3px", rowGap: "4px", alignItems: "center" },
    heatLabel: {
        fontSize: "11px",
        color: "#888",
        fontFamily: "'Geist Mono', monospace",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: "128px",
        paddingRight: "8px"
    },
    heatRowHead: { gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginTop: "6px" },
    heatCell: { borderRadius: "3px", minWidth: 0, transition: "box-shadow 120ms ease" },
    heatCellHollow: { boxShadow: "inset 0 0 0 1px #1f1f1f" },
    heatCellOn: { boxShadow: "0 0 0 1.5px #ffffff" },
    heatRight: { paddingLeft: "10px", textAlign: "right", fontSize: "12px", color: "#ddd", fontFamily: "'Geist Mono', monospace", whiteSpace: "nowrap" },
    heatTicks: { position: "relative", height: "14px", marginTop: "2px" },
    heatTick: { position: "absolute", top: 0, fontSize: "11px", color: "#666", fontFamily: "'Geist Mono', monospace", whiteSpace: "nowrap" },
    heatFoot: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px 16px", marginTop: "12px" },
    heatReadout: { flex: "1 1 200px", fontSize: "12px", color: "#aaa", fontFamily: "'Normative Pro'", minHeight: "16px" },
    heatScale: { display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#666", fontFamily: "'Normative Pro'", marginLeft: "auto" },
    heatSwatch: { width: "10px", height: "10px", borderRadius: "2px" },
    // funnel: stages side by side, the flow narrowing from one to the next
    funnel: { position: "relative" },
    funnelCols: { display: "grid" },
    funnelValue: { textAlign: "center", fontSize: "15px", fontWeight: 600, color: "#fff", fontFamily: "'Geist Mono', monospace", padding: "4px 4px 12px" },
    funnelBody: { position: "relative" },
    funnelSvg: { position: "absolute", left: 0, top: 0, width: "100%", height: "100%", display: "block", overflow: "visible" },
    funnelPills: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0, display: "grid", alignItems: "center", justifyItems: "center", pointerEvents: "none" },
    funnelPill: {
        backgroundColor: "#ececec",
        color: "#111",
        fontFamily: "'Geist Mono', monospace",
        fontSize: "12px",
        fontWeight: 600,
        lineHeight: "18px",
        padding: "1px 10px",
        borderRadius: "11px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.45)",
        whiteSpace: "nowrap"
    },
    funnelLabel: { textAlign: "center", fontSize: "13px", color: "#888", fontFamily: "'Normative Pro'", padding: "12px 6px 2px", lineHeight: 1.3 },
    funnelDivider: { position: "absolute", top: 0, bottom: 0, width: "1px", backgroundColor: "rgba(255,255,255,0.06)", pointerEvents: "none" },
    funnelRows: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(112px, 1.1fr) auto", columnGap: "14px" },
    funnelRowLabel: { fontSize: "13px", color: "#aaa", fontFamily: "'Normative Pro'", alignSelf: "center", lineHeight: 1.3 },
    funnelRowValue: { fontSize: "13px", color: "#fff", fontFamily: "'Geist Mono', monospace", textAlign: "right", alignSelf: "center" },
    funnelColumn: { position: "relative" },
    // flow: where an amount goes, as ribbons from its sources to its recipients
    flow: { position: "relative", width: "100%" },
    flowSvg: { display: "block", overflow: "visible" },
    flowRibbon: { transition: "stroke 150ms ease, opacity 150ms ease" },
    flowPct: { fontSize: "18px", fill: "#fff", fontFamily: "'Geist Mono', monospace" },
    flowCaption: { fontSize: "11px", fill: "#777", fontFamily: "'Normative Pro'" },
    flowLabel: { fontSize: "13px", fill: "#9a9a9a", fontFamily: "'Normative Pro'", transition: "fill 150ms ease" },
    flowLabelOn: { fill: "#fff" },
    flowValue: { fontSize: "14px", fill: "#ececec", fontFamily: "'Geist Mono', monospace" },
    flowSub: { fontSize: "11px", fill: "#666", fontFamily: "'Normative Pro'" },
    flowTile: { color: "#353535", transition: "color 150ms ease" },
    flowTileOn: { color: "#e8e8e8" },
    // masonry: cards in columns, each right under the one above, moved (not reflowed) when a height changes
    masonry: { position: "relative", minWidth: 0 },
    masonryCell: {
        position: "absolute",
        left: 0,
        top: 0,
        minWidth: 0,
        transition: `transform 380ms ${HUB_EASE}`,
        "@media (prefers-reduced-motion: reduce)": { transition: "none" }
    },
    // hub header: a bar that sticks to the top of the view while its content scrolls under it
    hubBar: {
        position: "sticky",
        top: "-1px",
        zIndex: 4,
        display: "flex",
        alignItems: "center",
        gap: "12px",
        minWidth: 0,
        margin: "-8px -12px 0 -12px",
        padding: "8px 12px",
        borderRadius: "0 0 20px 20px",
        transition: "background-color 200ms ease, box-shadow 200ms ease"
    },
    hubBarStuck: {
        backgroundColor: "rgba(8, 8, 8, 0.86)",
        backdropFilter: "blur(16px) saturate(140%)",
        boxShadow: "0 14px 32px rgba(0, 0, 0, 0.55)"
    },
    // back to the grid: a round tile, as the switch's items are
    back: {
        appearance: "none",
        border: "none",
        flex: "0 0 auto",
        width: "40px",
        height: "40px",
        borderRadius: "14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        cursor: "pointer",
        color: "#c7c7c7",
        backgroundColor: "#171717",
        transition: "background-color 150ms ease, color 150ms ease",
        "&:hover": { backgroundColor: "#262626", color: "#fff" },
        "&:hover $backIcon": { transform: "translateX(-2px)" },
        "&:focus-visible": { outline: "none", boxShadow: "0 0 0 2px #555" }
    },
    backIcon: { fontSize: "22px", transition: `transform 200ms ${HUB_EASE}` }
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

const clamp01 = (v) => Math.max(0, Math.min(1, v || 0));

/**
 * Horizontal meter 0..1: a row of dashes, lit up to the value, with optional marks (thresholds) at
 * positions 0..1. The row holds whole dashes only, so a value never ends on half a dash; any value above
 * zero lights at least one.
 */
export const Meter = withKit(({ classes, value, marks = [], strong }) => {
    const [ref, width] = useWidth();
    const v = clamp01(value);
    const period = DASH + DASH_GAP;
    const n = width ? Math.max(1, Math.floor((width + DASH_GAP) / period)) : 0;
    const track = n ? n * period - DASH_GAP : 0;
    const lit = v > 0 ? Math.max(1, Math.round(v * n)) : 0;
    return (
        <div ref={ref} className={classes.meter} role="meter" aria-valuemin={0} aria-valuemax={1} aria-valuenow={v}>
            <div className={classes.meterTrack} style={track ? { width: `${track}px` } : undefined} />
            <div
                className={`${classes.meterFill} ${strong ? classes.meterFillStrong : ""}`}
                style={{ width: n ? `${lit ? lit * period - DASH_GAP : 0}px` : `${v * 100}%` }}
            />
            {marks.map((m) => (
                <div
                    key={m}
                    className={classes.meterMark}
                    style={{ left: track ? `${Math.round(clamp01(m) * track) - 1}px` : `calc(${clamp01(m) * 100}% - 1px)` }}
                />
            ))}
        </div>
    );
});

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
 * called while the section is open or folding. `icon` (an icon component) is cut out of a tile before the
 * title; the open section's tile is lit.
 */
const Lazy = ({ render }) => render();

export const AccordionSection = withKit(({ classes, scope, id, title, description, icon, open, onToggle, headRef, render, children }) => {
    const bodyId = `gd-${scope}-${id}`;
    return (
        <div className={classes.accordion}>
            <Typography component="h2" className={classes.accordionHeading}>
                <button
                    type="button"
                    ref={headRef}
                    className={`${classes.accordionHead} ${open ? classes.accordionHeadOpen : ""}`}
                    onClick={() => onToggle(id)}
                    aria-expanded={open}
                    aria-controls={bodyId}
                >
                    <span className={classes.accordionLead}>
                        {icon ? (
                            <span className={classes.accordionIcon}>
                                <GlyphTile icon={icon} size={36} glyph={22} />
                            </span>
                        ) : null}
                        <span className={classes.accordionText}>
                            <span className={classes.accordionTitle}>{title}</span>
                            {description ? <span className={classes.accordionDescription}>{description}</span> : null}
                        </span>
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

// ---------------------------------------------------------------- hub

/** True when the person asked their system for less motion: hubs then switch views without animating. */
export function lessMotion() {
    try {
        return typeof window === "undefined" || !window.matchMedia || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {
        return true;
    }
}

/**
 * Back to a hub's grid: a round tile with an arrow. Extra props (data-*) go to the button.
 */
export const BackButton = withKit(({ classes, onClick, label, ...rest }) => (
    <Tooltip title={label || ""} placement="bottom" enterDelay={400}>
        <button type="button" className={classes.back} onClick={onClick} aria-label={label} {...rest}>
            <ArrowBackRoundedIcon className={classes.backIcon} />
        </button>
    </Tooltip>
));

/**
 * The header of a hub's section: sticks to the top of the scrolling view and takes a dark, blurred
 * surface once the content passes under it (it sits 1 px above the edge then, which is how it knows).
 */
export const StickyBar = withKit(({ classes, children, className }) => {
    const mark = React.useRef(null);
    const [el, setEl] = React.useState(null);
    const [stuck, setStuck] = React.useState(false);
    React.useEffect(() => {
        if (!el || typeof IntersectionObserver === "undefined") return undefined;
        // Clipped at its top edge, and moved away from the mark that sits where it would be in the flow:
        // stuck (a bar that merely scrolls out of sight stays next to its mark).
        const io = new IntersectionObserver(([e]) => {
            const m = mark.current;
            const moved = m ? e.boundingClientRect.top - m.getBoundingClientRect().bottom - parseFloat(window.getComputedStyle(el).marginTop || "0") : 1;
            // (not isIntersecting: with a threshold of 1, Chrome reports a bar clipped by 1 px as not intersecting)
            setStuck(e.intersectionRatio > 0 && e.intersectionRect.top - e.boundingClientRect.top > 0.5 && moved > 0.5);
        }, { threshold: [1] });
        io.observe(el);
        return () => io.disconnect();
    }, [el]);
    return (
        <>
            {/* flow-root: an empty block would let the bar's negative margin collapse through it and sit under it */}
            <div ref={mark} aria-hidden="true" style={{ display: "flow-root" }} />
            <div ref={setEl} className={`${classes.hubBar} ${stuck ? classes.hubBarStuck : ""} ${className || ""}`}>{children}</div>
        </>
    );
});

/**
 * Lets a hub's header bar stick while the page scrolls. A sticky bar holds to its nearest ancestor that
 * clips overflow; a dialog's content box (overflow auto) that never scrolls itself, because it grows with
 * its content inside a scrolling slide, would catch the bar and carry it away. Such a box `el` is measured
 * once (does it grow with a very tall child?) and, when it does, left to overflow visibly: nothing changes
 * for it, and the bar holds to the element that really scrolls. A box of fixed height keeps scrolling.
 */
export function releaseScroll(el) {
    if (!el || typeof window === "undefined") return;
    if (!/(auto|scroll|hidden|overlay)/.test(window.getComputedStyle(el).overflowY)) return;
    const probe = document.createElement("div");
    probe.style.cssText = "height:100000px;width:1px;visibility:hidden;pointer-events:none";
    el.appendChild(probe);
    const grows = el.clientHeight >= 100000;
    el.removeChild(probe);
    if (grows) el.style.overflow = "visible";
}

/**
 * Scrolls the scrolling ancestor of `el` back up when the person had scrolled past the top of `el`, so a
 * view that just changed starts in sight. Instant: the change itself is what animates.
 */
export function revealTop(el, margin = 24) {
    if (!el) return;
    for (let p = el.parentElement; p; p = p.parentElement) {
        const s = window.getComputedStyle(p);
        if (/(auto|scroll|overlay)/.test(s.overflowY) && p.scrollHeight > p.clientHeight + 1) {
            const top = el.getBoundingClientRect().top - p.getBoundingClientRect().top - p.clientTop;
            if (top < 0) p.scrollTop = Math.max(0, p.scrollTop + top - margin);
            return;
        }
    }
    const top = el.getBoundingClientRect().top;
    if (top < 0) window.scrollBy(0, top - margin);
}

const rectOf = (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
};

/**
 * What a hub shows just before it switches between its grid and a section, for hubPlay to start from:
 * where each icon (data-hub-icon) and card (data-hub-card) is on screen, and a copy of the grid
 * (data-hub-grid) that is about to go. Call it from getSnapshotBeforeUpdate, while the old view is
 * still in the page.
 * The copy keeps the grid's class names. A styled component that leaves with the grid takes its style
 * sheet with it (MUI removes a sheet nothing uses, and makes a new one, with new names, for the next
 * user), so the grid's cards are styled by their view's own sheet, which stays.
 */
export function hubSnapshot(root) {
    if (!root || lessMotion() || typeof root.animate !== "function") return null;
    const icons = new Map();
    root.querySelectorAll("[data-hub-icon]").forEach((el) => {
        const r = rectOf(el);
        if (r.width && r.height) icons.set(el.getAttribute("data-hub-icon"), { ...r, color: window.getComputedStyle(el).color });
    });
    const cards = new Map();
    root.querySelectorAll("[data-hub-card]").forEach((el) => {
        cards.set(el.getAttribute("data-hub-card"), { ...rectOf(el), fill: window.getComputedStyle(el).backgroundColor });
    });
    const grid = root.querySelector("[data-hub-grid]");
    return { icons, cards, grid: grid ? { node: grid.cloneNode(true), ...rectOf(grid) } : null };
}

/** Ends the animations of a hub's last switch, at once: called before the next one starts. */
export function hubStop(root) {
    const run = root && root.__hubRun;
    if (!run) return;
    root.__hubRun = null;
    run.anims.forEach((a) => {
        try {
            a.finish();
        } catch (e) {
            a.cancel();
        }
    });
    if (run.layer.parentNode) run.layer.parentNode.removeChild(run.layer);
}

let copySeq = 0;

/** Ids in a copied subtree made unique again, and the references to them (an icon tile's mask). */
function renameIds(node) {
    const n = ++copySeq;
    node.querySelectorAll("[id]").forEach((x) => {
        const id = `${x.id}-c${n}`;
        node.querySelectorAll(`[mask="url(#${x.id})"]`).forEach((y) => y.setAttribute("mask", `url(#${id})`));
        x.id = id;
    });
}

/** The copy of a hub's part, taken out of the hub's bookkeeping so no later query finds it. */
function inert(node) {
    const attrs = ["data-hub-icon", "data-hub-card", "data-hub-grid", "data-hub-enter", "data-hub-reveal", "data-hub-swap"];
    [node, ...node.querySelectorAll("*")].forEach((x) => attrs.forEach((a) => x.removeAttribute(a)));
    node.setAttribute("aria-hidden", "true");
    return node;
}

/**
 * Animates a hub's switch from what `snap` saw (hubSnapshot) to what is in the page now. `from` and `to`
 * are the open section before and after, null for the grid; `order` lists the section ids.
 * - grid → section: the grid's copy fades out where it was, the picked card last; each icon of the grid
 *   that is also in the new view flies to its new place; the element marked data-hub-reveal grows out
 *   of the picked card; parts marked data-hub-enter rise in, in their order.
 * - section → grid: the icons fly back down, the cards rise in around them, and the card of the section
 *   left behind glows for a moment, to show where it went.
 * - section → section: the part marked data-hub-swap slides in from the side of the section it was on.
 * Call it from componentDidUpdate, once the new view is in the page. Nothing moves when the person asked
 * for less motion.
 */
export function hubPlay(root, snap, { from = null, to = null, order = [] } = {}) {
    hubStop(root);
    if (!root || !snap || lessMotion() || from === to) return;
    const base = root.getBoundingClientRect();
    const layer = document.createElement("div");
    layer.setAttribute("aria-hidden", "true");
    Object.assign(layer.style, { position: "absolute", left: "0", top: "0", width: "0", height: "0", overflow: "visible", pointerEvents: "none", zIndex: "6" });
    root.appendChild(layer);
    const anims = [];
    const run = { anims, layer };
    root.__hubRun = run;
    const at = (r) => ({ left: `${r.left - base.left}px`, top: `${r.top - base.top}px` });
    const inView = (sel) => Array.from(root.querySelectorAll(sel)).filter((el) => !layer.contains(el));
    const flying = new Set(inView("[data-hub-icon]").map((el) => el.getAttribute("data-hub-icon")).filter((id) => snap.icons.has(id)));

    // 1. the grid that left: its copy fades out where it was, cards further from the picked one first
    if (snap.grid && to != null) {
        const g = snap.grid.node;
        Object.assign(g.style, { position: "absolute", margin: "0", width: `${snap.grid.width}px`, ...at(snap.grid) });
        g.querySelectorAll("[data-hub-icon]").forEach((el) => {
            if (flying.has(el.getAttribute("data-hub-icon"))) el.style.visibility = "hidden";
        });
        const cards = Array.from(g.querySelectorAll("[data-hub-card]"));
        const picked = cards.findIndex((el) => el.getAttribute("data-hub-card") === to);
        const fades = cards.map((el, i) => {
            const seen = snap.cards.get(el.getAttribute("data-hub-card"));
            if (seen && seen.fill) el.style.backgroundColor = seen.fill;
            const mine = i === picked;
            const far = picked < 0 ? i : Math.abs(i - picked);
            return [el, mine
                ? [[{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(1.03)" }], { duration: 300, delay: 60, easing: "ease-out", fill: "forwards" }]
                : [[{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(6px) scale(0.97)" }], { duration: 220, delay: Math.max(0, 60 - far * 12), easing: "ease-in", fill: "forwards" }]];
        });
        renameIds(inert(g));
        layer.appendChild(g);
        fades.forEach(([el, [frames, opts]]) => anims.push(el.animate(frames, opts)));
    }

    // 2. icons: a copy flies from where the icon was to where it is now; the icon shows when it lands
    let n = 0;
    inView("[data-hub-icon]").forEach((el) => {
        const a = snap.icons.get(el.getAttribute("data-hub-icon"));
        const b = rectOf(el);
        if (!a || !b.width) return;
        const dx = a.left - b.left;
        const dy = a.top - b.top;
        const s = a.width / b.width;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(s - 1) < 0.02) return;
        const color = window.getComputedStyle(el).color;
        const copy = inert(el.cloneNode(true));
        renameIds(copy);
        Object.assign(copy.style, {
            position: "absolute", margin: "0", width: `${b.width}px`, height: `${b.height}px`,
            transformOrigin: "0 0", color, visibility: "visible", ...at(b)
        });
        layer.appendChild(copy);
        el.style.visibility = "hidden";
        const anim = copy.animate(
            [{ transform: `translate(${dx}px, ${dy}px) scale(${s})`, color: a.color }, { transform: "translate(0px, 0px) scale(1)", color }],
            { duration: HUB_MS, delay: n++ * 16, easing: HUB_EASE, fill: "both" }
        );
        const land = () => {
            el.style.visibility = "";
            if (copy.parentNode) copy.parentNode.removeChild(copy);
        };
        anim.onfinish = land;
        anim.oncancel = land;
        anims.push(anim);
    });

    if (from == null || to == null) {
        // 3. the section grows out of the card it was opened from
        const grow = to != null ? inView("[data-hub-reveal]")[0] : null;
        const card = grow ? snap.cards.get(to) : null;
        if (grow && card) {
            const r = rectOf(grow);
            const inset = [card.top - r.top, r.left + r.width - card.left - card.width, r.top + r.height - card.top - card.height, card.left - r.left]
                .map((v) => `${Math.max(0, v)}px`).join(" ");
            anims.push(grow.animate(
                [{ clipPath: `inset(${inset} round 16px)` }, { clipPath: "inset(0px 0px 0px 0px round 0px)" }],
                { duration: HUB_MS, easing: HUB_EASE }
            ));
        }
        // 4. the new view's parts rise in, in their order
        inView("[data-hub-enter]").forEach((el) => {
            const k = Number(el.getAttribute("data-hub-enter")) || 0;
            anims.push(el.animate(
                [{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }],
                { duration: 420, delay: to == null ? 40 + k * 26 : 140 + k * 70, easing: HUB_EASE, fill: "backwards" }
            ));
        });
        // 5. back on the grid, the card of the section just left glows for a moment
        const left = to == null && from != null ? inView("[data-hub-card]").find((el) => el.getAttribute("data-hub-card") === from) : null;
        if (left) {
            const fill = window.getComputedStyle(left).backgroundColor;
            anims.push(left.animate([{ backgroundColor: "#262626" }, { backgroundColor: "#262626", offset: 0.35 }, { backgroundColor: fill }], { duration: 1100, easing: "ease-out" }));
        }
    } else {
        // 6. from one section to another: the new one slides in from its side
        const dir = Math.sign(order.indexOf(to) - order.indexOf(from)) || 1;
        inView("[data-hub-swap]").forEach((el) => anims.push(el.animate(
            [{ opacity: 0, transform: `translateX(${dir * 32}px)` }, { opacity: 1, transform: "none" }],
            { duration: 380, easing: HUB_EASE }
        )));
    }

    if (!anims.length) {
        hubStop(root);
        return;
    }
    let pending = anims.length;
    const done = () => {
        if (--pending > 0 || root.__hubRun !== run) return;
        root.__hubRun = null;
        if (layer.parentNode) layer.parentNode.removeChild(layer);
    };
    anims.forEach((a) => (a.finished ? a.finished.then(done, done) : done()));
}

/**
 * Where a masonry's cells go: in turn into each column, right under the cell above, wide ones across all
 * columns below everything before them (the turn starts again after one). A cell keeps its column when the
 * heights change, as data loads: it only slides up or down. Returns the height.
 */
function placeCells(box, cols, gap) {
    const cells = [];
    for (let el = box.firstElementChild; el; el = el.nextElementSibling) if (el.hasAttribute("data-masonry-cell")) cells.push(el);
    const width = box.clientWidth;
    const colWidth = (width - gap * (cols - 1)) / cols;
    const heights = cells.map((el) => el.offsetHeight);
    const tops = new Array(cols).fill(0);
    let turn = 0;
    const spots = cells.map((el, i) => {
        const h = heights[i];
        if (cols === 1 || el.getAttribute("data-masonry-cell") === "wide") {
            const y = Math.max(...tops);
            if (h) tops.fill(y + h + gap);
            turn = 0;
            return [0, y];
        }
        const c = turn++ % cols;
        const y = tops[c];
        if (h) tops[c] = y + h + gap;
        return [c * (colWidth + gap), y];
    });
    cells.forEach((el, i) => {
        const t = `translate(${Math.round(spots[i][0])}px, ${Math.round(spots[i][1])}px)`;
        if (!el.hasAttribute("data-placed")) {
            // a new cell appears where it belongs; only later moves slide
            el.setAttribute("data-placed", "");
            el.style.transition = "none";
            window.requestAnimationFrame(() => (el.style.transition = ""));
        }
        if (el.style.transform !== t) el.style.transform = t;
    });
    return Math.max(0, Math.max(...tops) - gap);
}

let masonryGuess = 0; // columns of the last masonry laid out: the next one starts with them

/**
 * Cards in columns, each one right under the card above it, so cards of different heights stack without
 * the holes a grid leaves under the shorter card of a row. Cards take the columns in turn, in their order
 * (the first two side by side, as in a grid). As many columns as fit at `minColumn` px, at most `columns`;
 * a child with the `wide` prop spans them all, below everything before it. The cells are measured as
 * their content changes, and slide to their new place when they have to move.
 */
export const Masonry = withKit(({ classes, children, columns = 2, minColumn = 380, gap = 16, className, style }) => {
    const box = React.useRef(null);
    const [cols, setCols] = React.useState(() => Math.max(1, Math.min(columns, masonryGuess || 1)));
    const live = React.useRef({ watched: new Set() });
    Object.assign(live.current, { cols, setCols, columns, minColumn, gap });
    const fit = (width) => {
        const s = live.current;
        return Math.max(1, Math.min(s.columns, Math.floor((width + s.gap) / (s.minColumn + s.gap))));
    };

    // Observers, once: the box for its width, each cell for its height.
    React.useLayoutEffect(() => {
        const el = box.current;
        if (!el) return undefined;
        let frame = 0;
        // Sizes that change inside the observer's callback could not be reported in this frame: the box's
        // height, and a new number of columns (it re-renders the cells), wait for the next one.
        const later = (fn) => {
            window.cancelAnimationFrame(frame);
            frame = window.requestAnimationFrame(fn);
        };
        const relayout = () => {
            const s = live.current;
            const want = fit(el.clientWidth);
            if (want !== s.cols) {
                later(() => {
                    masonryGuess = want;
                    s.setCols(want);
                });
                return;
            }
            const h = placeCells(el, s.cols, s.gap);
            later(() => (el.style.height = `${h}px`));
        };
        if (typeof ResizeObserver === "undefined") {
            window.addEventListener("resize", relayout);
            return () => {
                window.removeEventListener("resize", relayout);
                window.cancelAnimationFrame(frame);
            };
        }
        const ro = new ResizeObserver(relayout);
        ro.observe(el);
        live.current.ro = ro;
        return () => {
            ro.disconnect();
            live.current.ro = null;
            live.current.watched.clear();
            window.cancelAnimationFrame(frame);
        };
    }, []);

    // After every render, before paint: the right number of columns, then every cell in its place.
    React.useLayoutEffect(() => {
        const el = box.current;
        if (!el) return;
        const want = fit(el.clientWidth);
        masonryGuess = want;
        if (want !== cols) {
            setCols(want);
            return;
        }
        el.style.height = `${placeCells(el, cols, gap)}px`;
        const { ro, watched } = live.current;
        if (!ro) return;
        const cells = new Set();
        for (let c = el.firstElementChild; c; c = c.nextElementSibling) if (c.hasAttribute("data-masonry-cell")) cells.add(c);
        watched.forEach((c) => {
            if (!cells.has(c)) {
                ro.unobserve(c);
                watched.delete(c);
            }
        });
        cells.forEach((c) => {
            if (!watched.has(c)) {
                ro.observe(c);
                watched.add(c);
            }
        });
    });

    const items = React.Children.toArray(children).filter((c) => c && typeof c === "object");
    const part = `calc((100% - ${gap * (cols - 1)}px) / ${cols})`;
    return (
        <div ref={box} className={`${classes.masonry} ${className || ""}`} style={style}>
            {items.map((c, i) => {
                const wide = !!(c.props && c.props.wide);
                return (
                    <div
                        key={c.key != null ? c.key : i}
                        className={classes.masonryCell}
                        data-masonry-cell={wide ? "wide" : ""}
                        style={{ width: wide || cols === 1 ? "100%" : part }}
                    >
                        {c}
                    </div>
                );
            })}
        </div>
    );
});

// ---------------------------------------------------------------- figures

let figureSeq = 0;

/** An id unique in the page and stable for the component's life, for SVG masks, patterns and gradients. */
function useUid(prefix) {
    const ref = React.useRef(null);
    if (ref.current === null) ref.current = `${prefix}-${++figureSeq}`;
    return ref.current;
}

/** `a` and `b` (#rrggbb) mixed, `t` of the way from a to b. */
function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const ch = (p, s) => (p >> s) & 255;
    const m = (s) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
    return `#${((1 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)).toString(16).slice(1)}`;
}

/**
 * An icon cut out of a rounded tile, as the P is cut out of the Pixagram mark. The tile takes the text
 * colour (set `color` on it or a parent) and whatever lies behind it shows through the glyph.
 */
export function GlyphTile({ icon: Icon, size = 36, glyph = 20, x, y, className, style }) {
    const id = useUid("gd-tile");
    const r = Math.round(size * 0.22);
    const o = (size - glyph) / 2;
    return (
        <svg className={className} style={style} x={x} y={y} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
            <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width={size} height={size}>
                <rect width={size} height={size} rx={r} fill="#fff" />
                {Icon ? <Icon x={o} y={o} width={glyph} height={glyph} style={{ color: "#000", fontSize: `${glyph}px` }} /> : null}
            </mask>
            <rect width={size} height={size} rx={r} fill="currentColor" mask={`url(#${id})`} />
        </svg>
    );
}

/** One hatching of HATCHES as an SVG pattern. */
function Hatch({ id, spec }) {
    const g = spec.gap;
    return (
        <pattern id={id} patternUnits="userSpaceOnUse" width={g} height={g} patternTransform={spec.angle ? `rotate(${spec.angle})` : undefined}>
            {spec.dots ? <circle cx={g / 2} cy={g / 2} r={spec.r} fill={spec.color} /> : <rect x="0" y="0" width={g} height={spec.width} fill={spec.color} />}
            {spec.grid ? <rect x="0" y="0" width={spec.width} height={g} fill={spec.color} /> : null}
        </pattern>
    );
}

let measureCtx = null;

/** Draws the component again once the page's web fonts have loaded, for figures that measure their text. */
function useFontsReady() {
    const [, setReady] = React.useState(false);
    React.useEffect(() => {
        let live = true;
        const fonts = typeof document !== "undefined" ? document.fonts : null;
        if (fonts && fonts.status !== "loaded" && fonts.ready) fonts.ready.then(() => live && setReady(true));
        return () => {
            live = false;
        };
    }, []);
}

/** Width in px of `text` set in `font` (a CSS font shorthand), measured on a canvas; estimated without one. */
function textWidth(text, font) {
    const s = String(text == null ? "" : text);
    try {
        if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
        measureCtx.font = font;
        return measureCtx.measureText(s).width;
    } catch (e) {
        return s.length * 7;
    }
}

/** Path of a ring slice from angle a0 to a1 (radians, clockwise from 3 o'clock), outer radius R, inner r. */
function ringSlice(cx, cy, R, r, a0, a1) {
    const p = (rad, a) => `${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)}`;
    if (a1 - a0 >= 2 * Math.PI - 1e-6) {
        return `M ${cx + R} ${cy} A ${R} ${R} 0 1 1 ${cx - R} ${cy} A ${R} ${R} 0 1 1 ${cx + R} ${cy} Z `
            + `M ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} Z`;
    }
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M ${p(R, a0)} A ${R} ${R} 0 ${large} 1 ${p(R, a1)} L ${p(r, a1)} A ${r} ${r} 0 ${large} 0 ${p(r, a0)} Z`;
}

/**
 * Parts of a whole as a hatched ring, with its legend beside it (below it where the place is narrow).
 * `data`: [{ key, label, value, sub, center }], drawn in the order given; `center` ({ value, caption })
 * is shown in the ring, and a part's own `center` replaces it while the part is under the pointer.
 */
export const PatternPie = withKit(({ classes, data, size = 184, center, shareFormatter = (v) => fmtPct(v, 1), label }) => {
    const uid = useUid("gd-pie");
    const [ref, width] = useWidth();
    const [active, setActive] = React.useState(null);
    const items = (data || []).filter((x) => x && x.value > 0);
    const total = items.reduce((t, x) => t + x.value, 0);
    let angle = -Math.PI / 2;
    const slices = items.map((x, i) => {
        const share = total ? x.value / total : 0;
        const a0 = angle;
        angle += share * 2 * Math.PI;
        return { ...x, share, a0, a1: angle, fill: `url(#${uid}-${i % HATCHES.length})` };
    });
    const c = size / 2;
    const R = c - 6;
    const r = Math.round(R * 0.6);
    const on = slices.find((s) => s.key === active) || null;
    const shown = on ? on.center || { value: shareFormatter(on.share), caption: on.label } : center;
    const stacked = width > 0 && width < size + 236;
    return (
        <div ref={ref} className={`${classes.pie} ${stacked ? classes.pieStacked : ""}`}>
            <div className={classes.pieFigure} style={{ width: `${size}px`, height: `${size}px` }}>
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} onMouseLeave={() => setActive(null)}>
                    <defs>{HATCHES.map((h, i) => <Hatch key={i} id={`${uid}-${i}`} spec={h} />)}</defs>
                    {slices.map((s) => {
                        const mid = (s.a0 + s.a1) / 2;
                        const lift = on && on.key === s.key ? 4 : 0;
                        const path = ringSlice(c, c, R, r, s.a0, s.a1);
                        return (
                            <g
                                key={s.key}
                                className={classes.pieSlice}
                                style={{ opacity: on && on.key !== s.key ? 0.3 : 1, transform: `translate(${(lift * Math.cos(mid)).toFixed(2)}px, ${(lift * Math.sin(mid)).toFixed(2)}px)` }}
                                onMouseEnter={() => setActive(s.key)}
                            >
                                <path d={path} fill="rgba(255,255,255,0.03)" />
                                <path d={path} fill={s.fill} stroke="#101010" strokeWidth="2" strokeLinejoin="round" />
                            </g>
                        );
                    })}
                </svg>
                {shown ? (
                    <div className={classes.pieCenter} style={{ width: `${r * 2 - 18}px` }}>
                        <span className={classes.pieCenterValue}>{shown.value}</span>
                        {shown.caption ? <span className={classes.pieCenterCaption}>{shown.caption}</span> : null}
                    </div>
                ) : null}
            </div>
            <div className={classes.pieLegend}>
                {slices.map((s) => (
                    <div
                        key={s.key}
                        className={`${classes.pieRow} ${on && on.key === s.key ? classes.pieRowActive : ""}`}
                        onMouseEnter={() => setActive(s.key)}
                        onMouseLeave={() => setActive(null)}
                    >
                        <svg className={classes.pieSwatch} width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                            <rect x="0.5" y="0.5" width="13" height="13" rx="3.5" fill={s.fill} stroke="rgba(255,255,255,0.2)" />
                        </svg>
                        <span className={classes.pieName}>
                            {s.label}
                            {s.sub ? <span className={classes.pieSub}>{s.sub}</span> : null}
                        </span>
                        <span className={classes.pieShare}>{shareFormatter(s.share)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
});

const TICK_FONT = "11px 'Geist Mono', monospace";

/**
 * Column labels under a heatmap, kept inside its width, without the ones that would run into a neighbour
 * (the last one always stays).
 */
function HeatTicks({ classes, ticks, columns, style }) {
    const [ref, width] = useWidth();
    useFontsReady();
    if (!width) {
        return (
            <div ref={ref} className={classes.heatTicks} style={style}>
                {ticks.map((tk) => (
                    <span
                        key={tk.at}
                        className={classes.heatTick}
                        style={{ left: `${(tk.at / columns) * 100}%`, transform: tk.at <= 0 ? "none" : tk.at >= columns ? "translateX(-100%)" : "translateX(-50%)" }}
                    >
                        {tk.label}
                    </span>
                ))}
            </div>
        );
    }
    // where each label sits, centred on its place but never past either end
    const span = (tk) => {
        const w = textWidth(tk.label, TICK_FONT);
        const x = (tk.at / columns) * width;
        const left = Math.max(0, Math.min(width - w, tk.at <= 0 ? x : tk.at >= columns ? x - w : x - w / 2));
        return [left, left + w];
    };
    const last = ticks[ticks.length - 1];
    const end = span(last);
    const shown = [];
    for (const tk of ticks.slice(0, -1)) {
        const [a, b] = span(tk);
        const prev = shown.length ? span(shown[shown.length - 1]) : null;
        if ((prev && a < prev[1] + 10) || b > end[0] - 10) continue;
        shown.push(tk);
    }
    shown.push(last);
    return (
        <div ref={ref} className={classes.heatTicks} style={style}>
            {shown.map((tk) => (
                <span key={tk.at} className={classes.heatTick} style={{ left: `${span(tk)[0].toFixed(1)}px` }}>
                    {tk.label}
                </span>
            ))}
        </div>
    );
}

/**
 * Rows of cells, lighter where the value is higher: six shades from nothing to the highest value shown
 * (or `max`). `rows`: [{ key, label, title, cells: [{ v, ... }], right }]; a cell whose v is null stays
 * hollow (no data yet, not scheduled). `ticks` label the columns below ({ at, label }, `at` a column
 * index, `columns` for the right edge, halves for the middle of a column). `readout(row, column, cell)`
 * describes the cell under the pointer (or the last one tapped); `idle` is shown when there is none. `low`
 * and `high` name the ends of the scale. Where the cells would be under 7 px wide beside their labels, each
 * row's label and value move above its cells, which then take the full width.
 */
export const Heatmap = withKit(({ classes, rows, columns, ticks = [], cellHeight = 16, max, readout, idle, low, high, label }) => {
    const [ref, width] = useWidth();
    const [on, setOn] = React.useState(null);
    let top = max;
    if (top == null) {
        top = 0;
        for (const row of rows) for (const cell of row.cells) if (cell && cell.v > top) top = cell.v;
    }
    const level = (v) => (v == null ? -1 : v <= 0 || !top ? 0 : Math.min(5, 1 + Math.floor((v / top) * 5 - 1e-9)));
    const hasRight = rows.some((row) => row.right != null);
    const gap = columns > 24 ? 2 : 3;
    const labelWidth = Math.min(128, Math.max(0, ...rows.map((row) => (typeof row.label === "string" ? textWidth(row.label, TICK_FONT) : 64))) + 8);
    const cellWidth = width ? (width - labelWidth - (hasRight ? 80 : 0) - (columns + 1) * gap) / columns : 99;
    const stacked = cellWidth < 7;
    const pick = (e) => {
        const el = e.target;
        const ri = el && el.getAttribute ? el.getAttribute("data-r") : null;
        if (ri != null) setOn([+ri, +el.getAttribute("data-c")]);
    };
    const cur = on && rows[on[0]] ? rows[on[0]] : null;
    const cell = cur ? cur.cells[on[1]] : null;
    const text = cell && cell.v != null && readout ? readout(cur, on[1], cell) : idle;
    const template = stacked
        ? `repeat(${columns}, minmax(0, 1fr))`
        : `max-content repeat(${columns}, minmax(0, 1fr))${hasRight ? " max-content" : ""}`;
    return (
        <div ref={ref} role="img" aria-label={label}>
            <div className={classes.heatGrid} style={{ gridTemplateColumns: template, columnGap: `${gap}px` }} onMouseOver={pick} onClick={pick} onMouseLeave={() => setOn(null)}>
                {rows.map((row, ri) => {
                    const name = <div className={classes.heatLabel} title={row.title || (typeof row.label === "string" ? row.label : undefined)}>{row.label}</div>;
                    const right = hasRight ? <div className={classes.heatRight}>{row.right}</div> : null;
                    return (
                        <React.Fragment key={row.key}>
                            {stacked ? <div className={classes.heatRowHead}>{name}{right}</div> : name}
                            {row.cells.map((x, ci) => {
                                const l = level(x ? x.v : null);
                                const lit = on && on[0] === ri && on[1] === ci && l >= 0;
                                return (
                                    <div
                                        key={ci}
                                        data-r={ri}
                                        data-c={ci}
                                        className={`${classes.heatCell} ${l < 0 ? classes.heatCellHollow : ""} ${lit ? classes.heatCellOn : ""}`}
                                        style={{ height: `${cellHeight}px`, backgroundColor: l < 0 ? "transparent" : HEAT[l] }}
                                    />
                                );
                            })}
                            {stacked ? null : right}
                        </React.Fragment>
                    );
                })}
                {ticks.length ? (
                    <>
                        {stacked ? null : <div />}
                        <HeatTicks classes={classes} ticks={ticks} columns={columns} style={{ gridColumn: `span ${columns}` }} />
                        {hasRight && !stacked ? <div /> : null}
                    </>
                ) : null}
            </div>
            <div className={classes.heatFoot}>
                <span className={classes.heatReadout}>{text || ""}</span>
                <span className={classes.heatScale}>
                    {low}
                    {HEAT.map((s) => <span key={s} className={classes.heatSwatch} style={{ backgroundColor: s }} />)}
                    {high}
                </span>
            </div>
        </div>
    );
});

/**
 * Outline of a funnel layer in a 100 × (n × 100) box, the stages along x: each stage keeps its height
 * over the first `a` of its column, then eases into the next stage's height, arriving `e` into the next
 * column (a layer that arrives later trails the one in front of it). `pad` widens the layer all along.
 */
function funnelPath(shares, pad, a, e) {
    const n = shares.length;
    const L = n * 100;
    const height = (s) => pad + 1.2 + (50 - 12 - 1.2) * s; // half-height; the widest layer pads by 12
    const knots = [];
    shares.forEach((s, i) => {
        const h = height(s);
        knots.push(i === 0 ? [0, h, "M"] : [Math.min(L, i * 100 + e * 100), h, "C"]);
        knots.push([i === n - 1 ? L : i * 100 + a * 100, h, "L"]);
    });
    const y = (h, side) => (50 - side * h).toFixed(2);
    let d = "";
    knots.forEach(([x, h, kind], j) => {
        if (kind === "M") d += `M${x},${y(h, 1)}`;
        else if (kind === "L") d += `L${x},${y(h, 1)}`;
        else {
            const [px, ph] = knots[j - 1];
            const xm = (px + x) / 2;
            d += `C${xm},${y(ph, 1)} ${xm},${y(h, 1)} ${x},${y(h, 1)}`;
        }
    });
    for (let j = knots.length - 1; j >= 0; j--) {
        const [x, h] = knots[j];
        const next = knots[j + 1];
        if (next && next[2] === "C") {
            const xm = (x + next[0]) / 2;
            d += `C${xm},${y(next[1], -1)} ${xm},${y(h, -1)} ${x},${y(h, -1)}`;
        } else d += `L${x},${y(h, -1)}`;
    }
    return d + "Z";
}

/**
 * A funnel: one column per stage, as tall as its share of the first stage, flowing into the next, inside
 * two darker bands that trail it. Counts above, the share of the first stage in a pill, names below.
 * Where the columns would be under 84 px wide, the stages stack and the funnel runs down.
 * `stages`: [{ key, label, value }].
 */
export const Funnel = withKit(({ classes, stages, valueFormatter = fmtInt, pctFormatter = (v) => fmtPct(v, 0), height = 168, label }) => {
    const uid = useUid("gd-funnel");
    const [ref, width] = useWidth();
    const n = stages.length;
    const first = n ? stages[0].value || 0 : 0;
    const shares = stages.map((s) => (first ? clamp01((s.value || 0) / first) : 0));
    const across = !width || width >= n * 84;
    const L = n * 100;
    const layers = [
        { pad: 12, a: 0.68, e: 0.12, fill: `url(#${uid}-outer)` },
        { pad: 6, a: 0.62, e: 0.06, fill: `url(#${uid}-mid)` },
        { pad: 0, a: 0.56, e: 0, fill: `url(#${uid}-in)` }
    ];
    // the first stage lightest, the later ones a step darker each
    const shade = stages.map((s, i) => (i === 0 ? "#d6d6d6" : mix("#8e8e8e", "#4c4c4c", n > 2 ? (i - 1) / (n - 2) : 0)));
    const defs = (
        <defs>
            <linearGradient id={`${uid}-in`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={L} y2="0">
                {shade.map((col, i) => [
                    <stop key={`a${i}`} offset={i / n} stopColor={col} />,
                    <stop key={`b${i}`} offset={(i + 1) / n} stopColor={col} />
                ])}
            </linearGradient>
            <linearGradient id={`${uid}-mid`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={L} y2="0">
                <stop offset="0" stopColor="#5c5c5c" />
                <stop offset={Math.min(1, 1.4 / n)} stopColor="#383838" />
                <stop offset="1" stopColor="#2a2a2a" />
            </linearGradient>
            <linearGradient id={`${uid}-outer`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={L} y2="0">
                <stop offset="0" stopColor="#2c2c2c" />
                <stop offset="1" stopColor="#1b1b1b" />
            </linearGradient>
        </defs>
    );
    const paths = layers.map((ly, i) => <path key={i} d={funnelPath(shares, ly.pad, ly.a, ly.e)} fill={ly.fill} />);
    const pills = stages.map((s, i) => <span key={s.key} className={classes.funnelPill}>{pctFormatter(shares[i])}</span>);
    if (across) {
        const cols = { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` };
        return (
            <div ref={ref} className={classes.funnel} role="img" aria-label={label}>
                <div className={classes.funnelCols} style={cols}>
                    {stages.map((s) => <div key={s.key} className={classes.funnelValue}>{valueFormatter(s.value)}</div>)}
                </div>
                <div className={classes.funnelBody} style={{ height: `${height}px` }}>
                    <svg className={classes.funnelSvg} viewBox={`0 0 ${L} 100`} preserveAspectRatio="none" aria-hidden="true">
                        {defs}
                        {paths}
                    </svg>
                    <div className={classes.funnelPills} style={cols}>{pills}</div>
                </div>
                <div className={classes.funnelCols} style={cols}>
                    {stages.map((s) => <div key={s.key} className={classes.funnelLabel}>{s.label}</div>)}
                </div>
                {stages.slice(1).map((s, i) => <div key={s.key} className={classes.funnelDivider} style={{ left: `${((i + 1) / n) * 100}%` }} />)}
            </div>
        );
    }
    return (
        <div ref={ref} className={classes.funnelRows} role="img" aria-label={label} style={{ gridTemplateRows: `repeat(${n}, 42px)` }}>
            {stages.map((s, i) => (
                <React.Fragment key={s.key}>
                    <div className={classes.funnelRowLabel} style={{ gridRow: i + 1, gridColumn: 1 }}>{s.label}</div>
                    <div className={classes.funnelRowValue} style={{ gridRow: i + 1, gridColumn: 3 }}>{valueFormatter(s.value)}</div>
                </React.Fragment>
            ))}
            <div className={classes.funnelColumn} style={{ gridRow: `1 / span ${n}`, gridColumn: 2 }}>
                <svg className={classes.funnelSvg} viewBox={`0 0 100 ${L}`} preserveAspectRatio="none" aria-hidden="true">
                    {defs}
                    <g transform="matrix(0 1 1 0 0 0)">{paths}</g>
                </svg>
                <div className={classes.funnelPills} style={{ gridTemplateRows: `repeat(${n}, minmax(0, 1fr))` }}>{pills}</div>
            </div>
        </div>
    );
});

/**
 * Heights for a column of blocks sharing `avail` px in proportion to `values`, none under its `mins` px.
 */
function layoutColumn(values, mins, avail) {
    const fixed = values.map(() => false);
    for (let pass = 0; pass <= values.length; pass++) {
        const freeValue = values.reduce((t, v, i) => t + (fixed[i] ? 0 : v), 0);
        const freeSpace = avail - mins.reduce((t, m, i) => t + (fixed[i] ? m : 0), 0);
        let changed = false;
        values.forEach((v, i) => {
            if (!fixed[i] && (freeValue ? (v / freeValue) * freeSpace : 0) < mins[i]) {
                fixed[i] = true;
                changed = true;
            }
        });
        if (!changed) {
            const left = values.filter((v, i) => !fixed[i]).length;
            return values.map((v, i) => (fixed[i] ? mins[i] : freeValue ? (v / freeValue) * freeSpace : freeSpace / Math.max(1, left)));
        }
    }
    return mins.slice();
}

/**
 * Where an amount goes. Each source is a block with its share of the whole; ribbons run from it to the
 * recipients it paid, each as thick as its part (6 px at least) with a bright thread along it, and each
 * recipient shows its amount beside its tile. `sources`: [{ key, caption }]; `targets`: [{ key, icon,
 * sub, title }], ordered by amount; `links`: [{ source, target, value, label }]. A ribbon, its label or
 * its recipient under the pointer brings that ribbon forward.
 */
export const Flow = withKit(({ classes, sources, targets, links, valueFormatter = fmtInt, shareFormatter = (v) => fmtPct(v, 0), label }) => {
    const uid = useUid("gd-flow");
    const [ref, W] = useWidth();
    const [on, setOn] = React.useState(null);
    useFontsReady();
    const live = links.filter((l) => l.value > 0 && sources.some((s) => s.key === l.source) && targets.some((x) => x.key === l.target));
    const total = live.reduce((t, l) => t + l.value, 0);
    const byTarget = new Map();
    live.forEach((l) => byTarget.set(l.target, (byTarget.get(l.target) || 0) + l.value));
    const tList = targets.filter((x) => byTarget.has(x.key)).sort((a, b) => byTarget.get(b.key) - byTarget.get(a.key));
    const sList = sources.filter((s) => live.some((l) => l.source === s.key));
    const m = tList.length;
    const H = Math.max(200, m * 64);
    if (!W || !total) return <div ref={ref} className={classes.flow} style={{ height: `${H}px` }} />;

    const wide = W >= 440;
    const LW = wide ? 64 : 54;
    const RW = wide ? 44 : 0;
    const x0 = LW;
    const x3 = W - RW;
    const x1 = x0 + (wide ? 136 : 104);
    const x2 = x3 - (wide ? 112 : 88);
    const xm = (x1 + x2) / 2;
    const gap = 10;
    const sOut = sList.map((s) => live.filter((l) => l.source === s.key));
    const sValue = sOut.map((ls) => ls.reduce((t, l) => t + l.value, 0));
    const sHeight = layoutColumn(sValue, sOut.map((ls) => Math.max(56, ls.length * 30)), H - gap * Math.max(0, sList.length - 1));
    const tIndex = new Map(tList.map((x, i) => [x.key, i]));
    const tY = (key) => (H * (tIndex.get(key) + 0.5)) / m;
    const maxV = Math.max(...live.map((l) => l.value));
    const thick = (v) => 6 + 22 * (v / maxV);
    const ribbons = [];
    let top = 0;
    const blocks = sList.map((s, i) => {
        const b = { ...s, y: top, h: sHeight[i], share: sValue[i] / total };
        top += sHeight[i] + gap;
        // a source's ribbons leave from the middle of its block, side by side, and fan out to their recipients
        const out = sOut[i].slice().sort((p, q) => tIndex.get(p.target) - tIndex.get(q.target));
        const at = [];
        out.forEach((l, j) => at.push(j ? at[j - 1] + Math.max(26, (thick(out[j - 1].value) + thick(l.value)) / 2 + 6) : 0));
        const first = b.y + b.h / 2 - (at.length ? at[at.length - 1] : 0) / 2;
        out.forEach((l, j) => {
            const ys = Math.max(b.y + 10, Math.min(b.y + b.h - 10, first + at[j]));
            ribbons.push({ ...l, id: `${l.source}>${l.target}`, ys, yt: tY(l.target), thick: thick(l.value) });
        });
        return b;
    });
    const lit = (r) => on === r.id || on === r.target;
    const anyOn = on != null;
    // amounts are right-aligned before the tiles; the thread runs from the end of a ribbon's label to the start of its amount
    const tx = wide ? x3 - 14 : W;
    const threadEnd = new Map(tList.map((x) => {
        const w = Math.max(textWidth(valueFormatter(byTarget.get(x.key)), "14px 'Geist Mono', monospace"), x.sub ? textWidth(x.sub, "11px 'Normative Pro'") : 0);
        return [x.key, Math.max(x2, tx - w - 10)];
    }));
    const curve = (r) => `C${xm},${r.ys.toFixed(1)} ${xm},${r.yt.toFixed(1)} ${x2},${r.yt.toFixed(1)}`;
    const path = (r) => `M${x0},${r.ys.toFixed(1)} L${x1},${r.ys.toFixed(1)} ${curve(r)} L${x3},${r.yt.toFixed(1)}`;
    const thread = (r) => {
        const from = Math.min(x1, x0 + 14 + textWidth(r.label, "13px 'Normative Pro'") + 10);
        return `M${from.toFixed(1)},${r.ys.toFixed(1)} L${x1},${r.ys.toFixed(1)} ${curve(r)} L${threadEnd.get(r.target).toFixed(1)},${r.yt.toFixed(1)}`;
    };
    const order = ribbons.slice().sort((p, q) => (lit(p) ? 1 : 0) - (lit(q) ? 1 : 0));
    return (
        <div ref={ref} className={classes.flow} style={{ height: `${H}px` }}>
            <svg className={classes.flowSvg} width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} onMouseLeave={() => setOn(null)}>
                <defs>
                    <linearGradient id={`${uid}-thread`} gradientUnits="userSpaceOnUse" x1={x0} y1="0" x2={x3} y2="0">
                        <stop offset="0" stopColor="#fff" stopOpacity="0.1" />
                        <stop offset="0.3" stopColor="#fff" stopOpacity="0.22" />
                        <stop offset="0.55" stopColor="#fff" stopOpacity="0.62" />
                        <stop offset="0.82" stopColor="#fff" stopOpacity="0.3" />
                        <stop offset="1" stopColor="#fff" stopOpacity="0.14" />
                    </linearGradient>
                </defs>
                {order.map((r) => (
                    <g key={r.id} onMouseEnter={() => setOn(r.id)}>
                        <path
                            className={classes.flowRibbon}
                            d={path(r)}
                            fill="none"
                            stroke={lit(r) ? "rgba(255,255,255,0.13)" : anyOn ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.065)"}
                            strokeWidth={r.thick}
                        />
                        <path
                            className={classes.flowRibbon}
                            d={thread(r)}
                            fill="none"
                            stroke={lit(r) ? "rgba(255,255,255,0.9)" : `url(#${uid}-thread)`}
                            strokeWidth={lit(r) ? 1.5 : 1.2}
                            opacity={anyOn && !lit(r) ? 0.35 : 1}
                            pointerEvents="none"
                        />
                    </g>
                ))}
                {blocks.map((b) => (
                    <g key={b.key} pointerEvents="none">
                        <rect x="0" y={b.y} width={LW} height={b.h} rx="16" fill="#171717" />
                        <text className={classes.flowPct} x={LW / 2} y={b.y + b.h / 2 + (b.caption ? 0 : 6)} textAnchor="middle">{shareFormatter(b.share)}</text>
                        {b.caption ? <text className={classes.flowCaption} x={LW / 2} y={b.y + b.h / 2 + 17} textAnchor="middle">{b.caption}</text> : null}
                    </g>
                ))}
                {ribbons.map((r) => (
                    <text
                        key={r.id}
                        className={`${classes.flowLabel} ${lit(r) ? classes.flowLabelOn : ""}`}
                        x={x0 + 14}
                        y={r.ys}
                        dominantBaseline="central"
                        onMouseEnter={() => setOn(r.id)}
                    >
                        {r.label}
                    </text>
                ))}
                {tList.map((x) => {
                    const yt = tY(x.key);
                    return (
                        <g key={x.key} onMouseEnter={() => setOn(x.key)}>
                            {x.title ? <title>{x.title}</title> : null}
                            <text className={classes.flowValue} x={tx} y={yt + (x.sub ? -3 : 5)} textAnchor="end">{valueFormatter(byTarget.get(x.key))}</text>
                            {x.sub ? <text className={classes.flowSub} x={tx} y={yt + 13} textAnchor="end">{x.sub}</text> : null}
                            {wide && x.icon ? (
                                <GlyphTile
                                    icon={x.icon}
                                    size={44}
                                    glyph={24}
                                    x={W - 44}
                                    y={yt - 22}
                                    className={`${classes.flowTile} ${on === x.key || ribbons.some((r) => r.target === x.key && on === r.id) ? classes.flowTileOn : ""}`}
                                />
                            ) : null}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
});

// ---------------------------------------------------------------- loading

/**
 * [ref, width] for function components: the width in px of the element given to `ref`, kept current as it
 * resizes (0 until measured). For figures that draw at pixel size or choose a layout by the room they have.
 */
export function useWidth() {
    const [el, setEl] = React.useState(null);
    const [width, setWidth] = React.useState(0);
    React.useLayoutEffect(() => {
        if (!el) return undefined;
        const read = () => setWidth(el.clientWidth);
        read();
        if (typeof ResizeObserver === "undefined") {
            window.addEventListener("resize", read);
            return () => window.removeEventListener("resize", read);
        }
        const observer = new ResizeObserver(read);
        observer.observe(el);
        return () => observer.disconnect();
    }, [el]);
    return [setEl, width];
}

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