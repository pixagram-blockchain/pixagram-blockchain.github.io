import * as React from "preact/compat";

import withStyles from "@material-ui/core/styles/withStyles";
import DialogContent from "@material-ui/core/DialogContent";
import Typography from "@material-ui/core/Typography";
import FlagIcon from "@material-ui/icons/Flag";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import ArrowForwardRoundedIcon from "@material-ui/icons/ArrowForwardRounded";
import ErrorOutlineIcon from "@material-ui/icons/ErrorOutline";
import ReportProblemOutlinedIcon from "@material-ui/icons/ReportProblemOutlined";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
// Section icons: filled glyphs, cut out of their tiles.
import TrafficRoundedIcon from "@material-ui/icons/TrafficRounded";
import ExploreRoundedIcon from "@material-ui/icons/ExploreRounded";
import DnsRoundedIcon from "@material-ui/icons/DnsRounded";
import TuneRoundedIcon from "@material-ui/icons/TuneRounded";
import FlagRoundedIcon from "@material-ui/icons/FlagRounded";
import TollRoundedIcon from "@material-ui/icons/TollRounded";
import ForumRoundedIcon from "@material-ui/icons/ForumRounded";
import DescriptionRoundedIcon from "@material-ui/icons/DescriptionRounded";
// Recharts by module, as the wallet imports it: one copy of the library in the app.
import { ResponsiveContainer } from "recharts/lib/component/ResponsiveContainer";
import { BarChart } from "recharts/lib/chart/BarChart";
import { Bar } from "recharts/lib/cartesian/Bar";
import { XAxis } from "recharts/lib/cartesian/XAxis";
import { YAxis } from "recharts/lib/cartesian/YAxis";
import { CartesianGrid } from "recharts/lib/cartesian/CartesianGrid";
import { ReferenceLine } from "recharts/lib/cartesian/ReferenceLine";
import { Tooltip } from "recharts/lib/component/Tooltip";
import { LabelList } from "recharts/lib/component/LabelList";

import { withLanguage } from "../utils/withLanguage";
import { towerGet, towerSeries, nowSec, fmtCompact, fmtInt, fmtPct, fmtAgo } from "../utils/tower";
import {
    tr, trf, Card, Tile, Pill, Meter, Empty, Skeleton, Visible, ChartTip, Legend, GlyphTile, Heatmap,
    SERIES, AXIS, GRID, BAR_CURSOR, BAR, HBAR, stackShape, axisTick, bucketLabel, fillBuckets, newestOnly,
    Masonry, StickyBar, BackButton, HUB_EASE, hubSnapshot, hubPlay, hubStop, revealTop, releaseScroll
} from "./GDTowerKit";
import GDReports from "./GDReports";

const K = "components.gdcontrol_tower.";

// System goals (article, component 4). Each reads live figures and returns { current, target, done, label }.
// Edit this list to change the objectives; witnesses' own drafted objectives can be added the same way.
const GOALS = [
    {
        id: "witness-seats",
        title: () => tr(K + "goal_seats", "Fill every elected witness seat"),
        description: () => tr(K + "goal_seats_desc", "Empty seats go to anyone who runs a witness node, without stake."),
        read: ({ gov }) => {
            const w = gov && gov.witnesses && gov.witnesses.extra;
            if (!w) return null;
            return { current: w.elected, target: w.max_voted, text: `${w.elected} / ${w.max_voted}` };
        }
    },
    {
        id: "capture-cost",
        title: () => tr(K + "goal_capture", "Make a majority of the schedule expensive"),
        description: () => tr(K + "goal_capture_desc", "Taking a majority of block production should cost at least half of all user stake."),
        read: ({ gov }) => {
            const m = gov && (gov.capture_cost_pxp || []).find((x) => x.dim === "majority");
            if (!m || !m.extra) return null;
            const share = m.extra.share_of_user_stake || 0;
            return { current: share, target: 0.5, text: `${fmtPct(share, 0)} / 50%` };
        }
    },
    {
        id: "participation",
        title: () => tr(K + "goal_participation", "Half of user stake votes for witnesses"),
        description: () => tr(K + "goal_participation_desc", "Directly or through a proxy. Higher participation makes the vote harder to capture."),
        read: ({ gov }) => {
            const p = gov ? gov.witness_vote_participation : null;
            if (p == null) return null;
            return { current: p, target: 0.5, text: `${fmtPct(p, 0)} / 50%` };
        }
    },
    {
        id: "debt-ratio",
        title: () => tr(K + "goal_debt", "Keep PXS below the stop-print line"),
        description: () => tr(K + "goal_debt_desc", "Above 20% of virtual supply, content rewards stop being paid in PXS."),
        read: ({ ov }) => {
            const r = ov && ov.supply ? ov.supply.pxs_debt_ratio : null;
            if (r == null) return null;
            // Progress = headroom left under the line; done while below it.
            return { current: Math.max(0, 0.2 - r), target: 0.2, done: r < 0.2, text: `${fmtPct(r, 1)} / 20%` };
        }
    },
    {
        id: "treasury",
        title: () => tr(K + "goal_treasury", "Distribute the company treasury on schedule"),
        description: () => tr(K + "goal_treasury_desc", "Stake leaving the company accounts, against the 9-to-11-year path."),
        read: ({ treasury }) => {
            if (!treasury) return null;
            const total = treasury.find((x) => x.dim === "");
            const others = treasury.find((x) => x.dim === "to_others");
            if (!total || !others || !total.extra) return null;
            const { lower, upper } = total.extra;
            const v = others.value || 0;
            return {
                current: v, target: Math.max(upper, 1e-9), done: v >= lower && v <= upper,
                text: `${fmtPct(v, 2)} · ${tr(K + "path", "path")} ${fmtPct(lower, 2)}–${fmtPct(upper, 2)}`
            };
        }
    },
    {
        id: "monthly-active",
        title: () => tr(K + "goal_mau", "1,000 monthly active accounts"),
        description: () => tr(K + "goal_mau_desc", "Accounts that signed an operation in the last 30 days."),
        read: ({ stickiness }) => {
            const s = stickiness && stickiness[0];
            if (!s || !s.extra) return null;
            return { current: s.extra.mau, target: 1000, text: `${fmtInt(s.extra.mau)} / 1,000` };
        }
    }
];

// The kit's Pill icons, for the badges of the grid's cards.
const BADGE_ICONS = { red: ErrorOutlineIcon, amber: ReportProblemOutlinedIcon, ok: CheckCircleOutlineIcon, muted: null };

const CAPTURE_LABELS = {
    stall_finality: () => tr(K + "stall_finality", "Stall finality (more than 1/3)"),
    majority: () => tr(K + "majority", "Majority of the schedule"),
    hardfork_quorum: () => tr(K + "hardfork_quorum", "Hardfork quorum")
};

const DAY = 86400;

// Witness charts (last 30 days, day buckets).
const VOTE_STACK = stackShape(["approvals", "removals"]);
const CONCENTRATION = [1, 5, 10, 20, 50];
const FRESHNESS = [["<15m", "<15m"], ["15-30m", "15–30m"], ["30-60m", "30–60m"], ["1-24h", "1–24h"], [">24h", ">24h"]];
const NAME_TICK = { ...AXIS.tick, fontFamily: "'Normative Pro'", fontSize: 12, fill: "#aaa" };
const VALUE_LABEL = { fill: "#aaa", fontSize: 11, fontFamily: "'Geist Mono', monospace" };
const dayTick = (b) => axisTick(b, "day");
const dayLabel = (b) => bucketLabel(b, "day");

/** Sum of a per-witness series over its points: Map witness → total (the overall total, dim "", left out). */
function perDim(points) {
    const m = new Map();
    for (const p of points || []) if (p.dim !== "") m.set(p.dim, (m.get(p.dim) || 0) + (p.value || 0));
    return m;
}

/** Sum of a series' overall total (dim ""). */
const totalOf = (points) => (points || []).reduce((t, p) => t + (p.dim === "" ? p.value || 0 : 0), 0);

/** Share of slots filled, with enough decimals that a witness who missed blocks never reads 100%. */
function filledShare(produced, missed) {
    if (missed === 0) return "100%";
    for (const digits of [2, 3, 4]) {
        const v = fmtPct(produced / (produced + missed), digits);
        if (!v.startsWith("100")) return v;
    }
    return "> 99.99%";
}

const styles = theme => ({
    dialogContent: { padding: "24px", [theme.breakpoints.down("sm")]: { padding: "16px" } },
    // the view: the grid of categories, or the open one under its header (the hub's motion is drawn in it)
    hub: { position: "relative" },
    // 4 × 2 categories on a wide screen, 2 × 4 on a tablet, a list of 8 on a phone
    grid: {
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: "16px",
        [theme.breakpoints.down("sm")]: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
        [theme.breakpoints.down("xs")]: { gridTemplateColumns: "minmax(0, 1fr)", gap: "12px" }
    },
    sumCard: {
        position: "relative",
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        minHeight: "248px",
        padding: "18px 18px 14px 18px",
        borderRadius: "16px",
        backgroundColor: "#101010",
        cursor: "pointer",
        transition: "background-color 200ms cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": { backgroundColor: "#151515" },
        "&:hover $sumIcon": { color: "#e8e8e8" },
        "&:hover $moreIcon": { transform: "translateX(3px)" },
        [theme.breakpoints.down("xs")]: { minHeight: 0 }
    },
    sumHead: { display: "flex", alignItems: "center", gap: "12px", minWidth: 0, marginBottom: "18px" },
    sumIcon: {
        display: "flex",
        flex: "0 0 auto",
        width: "36px",
        height: "36px",
        color: "#424242",
        transition: "color 200ms ease",
        "& > svg": { width: "100%", height: "100%" }
    },
    sumTitle: {
        flex: "1 1 auto",
        minWidth: 0,
        fontSize: "15px",
        fontWeight: 600,
        color: "#fff",
        fontFamily: "'Industry Book'",
        lineHeight: 1.3
    },
    sumBody: { flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column" },
    sumValue: {
        fontSize: "26px",
        fontWeight: 700,
        color: "#fff",
        fontFamily: "'Geist Mono', monospace",
        lineHeight: 1.1,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
    },
    sumWord: { fontSize: "24px", fontWeight: 600, color: "#fff", fontFamily: "'Industry Book'", lineHeight: 1.15 },
    sumUnit: { fontSize: "12px", fontWeight: 400, color: "#666", marginLeft: "6px", fontFamily: "'Normative Pro'" },
    sumCaption: { fontSize: "12px", color: "#777", fontFamily: "'Normative Pro'", marginTop: "4px", lineHeight: 1.4 },
    sumFacts: {
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        alignItems: "center",
        columnGap: "12px",
        rowGap: "6px",
        marginTop: "16px"
    },
    sumLabel: { fontSize: "12px", color: "#888", fontFamily: "'Normative Pro'", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    sumFact: { fontSize: "12px", color: "#ddd", fontFamily: "'Geist Mono', monospace", textAlign: "right", whiteSpace: "nowrap" },
    sumItem: { minWidth: 0, marginTop: "12px", "&:first-child": { marginTop: 0 } },
    sumItemLabel: { fontSize: "11px", color: "#666", fontFamily: "'Industry Book'", textTransform: "uppercase", letterSpacing: "0.5px" },
    sumItemTitle: { fontSize: "14px", color: "#ddd", fontFamily: "'Normative Pro'", marginTop: "3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    sumItemSub: { fontSize: "12px", color: "#666", fontFamily: "'Normative Pro'", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    // goals met, one segment each
    segments: { display: "flex", gap: "4px", marginTop: "14px" },
    segment: { flex: "1 1 0", height: "6px", borderRadius: "3px", backgroundColor: "#262626" },
    segmentOn: { backgroundColor: "#e8e8e8" },
    segmentUnknown: { backgroundColor: "#1b1b1b" },
    chips: { display: "flex", flexWrap: "wrap", gap: "6px" },
    chip: { fontSize: "12px", color: "#aaa", fontFamily: "'Geist Mono', monospace", backgroundColor: "#171717", borderRadius: "10px", padding: "4px 10px" },
    // The grid's cards use this view's styles only, not the kit's Pill and Skeleton: the copy of the grid
    // that fades out when a category opens keeps its class names, and the kit's sheets leave with the grid.
    badge: {
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        flex: "0 0 auto",
        fontSize: "11px",
        fontWeight: 600,
        fontFamily: "'Industry Book'",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        padding: "3px 10px 3px 8px",
        borderRadius: "12px",
        whiteSpace: "nowrap"
    },
    badgeIcon: { fontSize: "14px" },
    badge_red: { backgroundColor: "#e8e8e8", color: "#111" },
    badge_amber: { backgroundColor: "#3a3a3a", color: "#e0e0e0" },
    badge_ok: { backgroundColor: "#1d1d1d", color: "#888" },
    badge_muted: { backgroundColor: "#1d1d1d", color: "#666" },
    sumSkeleton: {
        height: "92px",
        borderRadius: "12px",
        background: "linear-gradient(90deg, #141414 0%, #1a1a1a 50%, #141414 100%)",
        backgroundSize: "200% 100%",
        animation: "$sumShimmer 1.4s ease-in-out infinite"
    },
    "@keyframes sumShimmer": { "0%": { backgroundPosition: "200% 0" }, "100%": { backgroundPosition: "-200% 0" } },
    // the way into a category, at the foot of its card
    more: {
        appearance: "none",
        border: "none",
        font: "inherit",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px",
        width: "calc(100% + 8px)",
        margin: "16px -4px 0 -4px",
        padding: "9px 10px 9px 12px",
        borderRadius: "12px",
        backgroundColor: "#171717",
        color: "#c7c7c7",
        fontSize: "13px",
        fontFamily: "'Normative Pro'",
        transition: "background-color 150ms ease, color 150ms ease",
        "&:hover": { backgroundColor: "#222", color: "#fff" },
        "&:focus-visible": { outline: "none", boxShadow: "0 0 0 2px #555" }
    },
    moreIcon: { fontSize: "18px", transition: `transform 250ms ${HUB_EASE}` },
    // an open category: back, its icon and title in a bar that sticks, its description under it
    headIcon: { display: "flex", flex: "0 0 auto", width: "36px", height: "36px", color: "#e8e8e8", "& > svg": { width: "100%", height: "100%" } },
    headTitle: {
        flex: "1 1 auto",
        minWidth: 0,
        fontSize: "20px",
        fontWeight: 600,
        color: "#fff",
        fontFamily: "'Industry Book'",
        lineHeight: 1.25,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
    },
    headDescription: {
        fontSize: "14px",
        color: "#888",
        fontFamily: "'Normative Pro'",
        lineHeight: 1.45,
        maxWidth: "720px",
        margin: "2px 0 20px 100px",
        [theme.breakpoints.down("xs")]: { margin: "8px 0 18px 0" }
    },
    below: { marginTop: "16px" },
    // system state banner
    banner: {
        backgroundColor: "#101010",
        borderRadius: "16px",
        padding: "20px 24px",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: "16px",
        alignItems: "center",
        [theme.breakpoints.down("xs")]: { gridTemplateColumns: "minmax(0, 1fr)" }
    },
    bannerStrong: { backgroundColor: "#1b1b1b" },
    bannerLabel: { fontSize: "12px", color: "#888", fontFamily: "'Industry Book'", textTransform: "uppercase", letterSpacing: "0.5px" },
    bannerState: { fontSize: "28px", fontWeight: 600, color: "#fff", fontFamily: "'Industry Book'", lineHeight: 1.2, marginTop: "4px" },
    bannerText: { fontSize: "14px", color: "#888", fontFamily: "'Normative Pro'", marginTop: "4px" },
    bannerFacts: { display: "grid", gridTemplateColumns: "repeat(2, auto)", columnGap: "24px", rowGap: "6px" },
    factLabel: { fontSize: "12px", color: "#666", fontFamily: "'Normative Pro'" },
    factValue: { fontSize: "12px", color: "#ddd", fontFamily: "'Geist Mono', monospace", textAlign: "right" },
    tiles: {
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: "16px",
        [theme.breakpoints.down("sm")]: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
        [theme.breakpoints.down("xs")]: { gridTemplateColumns: "minmax(0, 1fr)" }
    },
    // rows: spacing and hover fill, never a rule
    rows: { display: "flex", flexDirection: "column", gap: "2px", margin: "0 -8px" },
    row: {
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        alignItems: "center",
        gap: "12px",
        padding: "8px",
        borderRadius: "10px",
        transition: "background-color 150ms ease",
        "&:hover": { backgroundColor: "#171717" }
    },
    rowLead: { display: "flex", alignItems: "center", gap: "10px", minWidth: 0 },
    rowMain: { minWidth: 0 },
    rowTitle: {
        fontSize: "14px", color: "#ddd", fontFamily: "'Normative Pro'", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        [theme.breakpoints.down("xs")]: { whiteSpace: "normal" }
    },
    rowSub: { fontSize: "12px", color: "#666", fontFamily: "'Normative Pro'", marginTop: "2px" },
    rowValue: { fontSize: "13px", color: "#fff", fontFamily: "'Geist Mono', monospace", textAlign: "right", whiteSpace: "nowrap" },
    rowValueMuted: { color: "#888" },
    rowMeter: { marginTop: "6px" },
    // witness table
    wHead: {
        display: "grid",
        gridTemplateColumns: "28px minmax(0, 1.4fr) 1fr 0.7fr 0.8fr 0.8fr",
        gap: "8px",
        padding: "0 8px 6px 8px",
        fontSize: "11px",
        color: "#666",
        fontFamily: "'Industry Book'",
        textTransform: "uppercase",
        letterSpacing: "0.5px"
    },
    wRow: {
        display: "grid",
        gridTemplateColumns: "28px minmax(0, 1.4fr) 1fr 0.7fr 0.8fr 0.8fr",
        gap: "8px",
        alignItems: "center",
        padding: "8px",
        borderRadius: "10px",
        fontSize: "13px",
        fontFamily: "'Geist Mono', monospace",
        color: "#ddd",
        transition: "background-color 150ms ease",
        "&:hover": { backgroundColor: "#171717" }
    },
    wRowOut: { color: "#666" },
    wName: { fontFamily: "'Normative Pro'", fontSize: "14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    wNum: { textAlign: "right", whiteSpace: "nowrap" },
    wPos: { color: "#666" },
    tableScroll: { overflowX: "auto", margin: "0 -8px" },
    tableInner: { minWidth: "520px", padding: "0 0" },
    // stat list inside a card
    stats: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", rowGap: "10px", columnGap: "16px", alignItems: "center" },
    statLabel: { fontSize: "13px", color: "#aaa", fontFamily: "'Normative Pro'" },
    statValue: { fontSize: "13px", color: "#fff", fontFamily: "'Geist Mono', monospace", textAlign: "right" },
    statMeter: { gridColumn: "1 / -1", marginTop: "-4px" },
    spacer: { height: "16px" },
    chart: { width: "100%", height: "200px" },
    chartShort: { width: "100%", height: "160px" },
    listTitle: {
        fontSize: "11px",
        color: "#666",
        fontFamily: "'Industry Book'",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        margin: "16px 0 4px 0"
    },
    note: { fontSize: "12px", color: "#666", fontFamily: "'Normative Pro'", marginTop: "12px", lineHeight: 1.5 },
    // goals (same card as the original GDMetrics goals)
    goals: {
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: "12px",
        [theme.breakpoints.down("sm")]: { gridTemplateColumns: "minmax(0, 1fr)" }
    },
    goalCard: {
        backgroundColor: "#101010",
        borderRadius: "16px",
        padding: "20px",
        transition: "background-color 200ms cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": { backgroundColor: "#171717" }
    },
    goalHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "16px" },
    goalInfo: { display: "flex", alignItems: "flex-start", gap: "12px", minWidth: 0 },
    // a goal met lights its tile, as an open section does
    goalTile: { display: "flex", flex: "0 0 auto", color: "#3a3a3a" },
    goalTileDone: { color: "#e8e8e8" },
    goalTitle: { fontSize: "16px", fontWeight: 600, color: "#fff", fontFamily: "'Industry Book'", marginBottom: "4px" },
    goalDescription: { fontSize: "13px", fontFamily: "'Normative Pro'", color: "#888" },
    goalProgressText: { display: "flex", justifyContent: "space-between", marginTop: "10px", fontSize: "12px", fontFamily: "'Geist Mono', monospace", color: "#888" },
    // block production: the heatmap's fill rates, a pill when they fall short
    fillRate: { display: "inline-flex", justifyContent: "flex-end", minWidth: "64px" }
});

// The view's categories, in order: the grid the view opens on, each card with the category's key figures,
// and the page each one opens. The open one is named in the address (+governance-tower-<id>, ids without
// "-"); none is open on the grid. A category loads the rest of its data when it opens.
const SECTIONS = [
    { id: "state", icon: TrafficRoundedIcon, title: () => tr(K + "s_state", "System state"), description: () => tr(K + "s_state_desc", "Alerts raised by the Tower. Red means act now, amber means watch.") },
    { id: "steering", icon: ExploreRoundedIcon, title: () => tr(K + "s_steering", "System steering"), description: () => tr(K + "s_steering_desc", "Who produces the blocks, how much it would cost to take control, and how much of the stake takes part.") },
    { id: "witnesses", icon: DnsRoundedIcon, title: () => tr(K + "s_witness_activity", "Witnesses, last 30 days"), description: () => tr(K + "s_witness_activity_desc", "Block production, the votes that move the schedule, what producers earn, how concentrated the vote is, and what witnesses set and run.") },
    { id: "attributes", icon: TuneRoundedIcon, title: () => tr(K + "s_attributes", "System attributes"), description: () => tr(K + "s_attributes_desc", "The parameters the chain runs on now, as voted by witnesses or set by the protocol.") },
    { id: "goals", icon: FlagRoundedIcon, title: () => tr(K + "s_goals", "System goals"), description: () => tr(K + "s_goals_desc", "The objectives the network steers towards, measured live.") },
    { id: "funds", icon: TollRoundedIcon, title: () => tr(K + "s_funds", "Funds and price feeds"), description: () => tr(K + "s_funds_desc", "Proposals to the Decentralized Pixa Fund, and the feeds that set PXS conversions.") },
    { id: "events", icon: ForumRoundedIcon, title: () => tr(K + "s_events", "System events and actions"), description: () => tr(K + "s_events_desc", "Where the community discusses the system, and what governance did in response to alerts.") },
    { id: "reports", icon: DescriptionRoundedIcon, title: () => tr(K + "s_reports", "Reports"), description: () => tr(K + "s_reports_desc", "Witness reports for each day, week and month, compared with the period before, ready to post.") }
];
const SECTION_IDS = SECTIONS.map((x) => x.id);

// What each section reads (keys of `_jobs`). The status and alerts are always read (the system state is on
// the grid and in every category's header); the grid reads what its cards show; the reports card loads itself.
const ALWAYS = ["status", "alerts"];
const GRID_DATA = ["gov", "ov", "fee", "production", "concentration", "treasury", "stickiness", "dpf", "portals", "actions"];
const SECTION_DATA = {
    state: [],
    steering: ["gov", "witnesses"],
    witnesses: ["ov", "production", "approvals", "removals", "stakeAdded", "stakeRemoved", "producerPay", "concentration", "interestVotes", "freshness", "versions"],
    attributes: ["ov", "fee", "curation", "witnesses"],
    goals: ["gov", "ov", "treasury", "stickiness"],
    funds: ["dpf", "witnesses", "ov"],
    events: ["portals", "actions"],
    reports: []
};

class GDControlTower extends React.PureComponent {
    // `localSection` is the open section when no parent drives it (no onSectionChange).
    state = { loading: true, d: {}, localSection: null };
    root = React.createRef();
    seq = 0;

    componentDidMount() {
        releaseScroll(this.root.current && this.root.current.parentElement);
        this.visible = new Visible(() => this.load(), 60000);
        this.visible.attach(this.root.current);
    }

    // The view is about to switch between the grid and a category: where its icons and cards are now, for
    // the switch to start from.
    getSnapshotBeforeUpdate(prevProps, prevState) {
        return this._open(prevProps, prevState) !== this._open() ? hubSnapshot(this.root.current) : null;
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        const open = this._open();
        const prev = this._open(prevProps, prevState);
        if (open === prev) return;
        revealTop(this.root.current);
        hubPlay(this.root.current, snapshot, { from: prev, to: open, order: SECTION_IDS });
        // load what the new view shows now if it is on screen, else as soon as it is
        const shown = !!(this.visible && this.visible.visible);
        if (!shown && this.visible) this.visible.last = 0;
        this.setState({ loading: true }, () => shown && this.load());
    }

    componentWillUnmount() {
        if (this.visible) this.visible.detach();
        hubStop(this.root.current);
    }

    /** The open section: the parent's `section` prop when it drives the view, else the view's own choice. */
    _open(props = this.props, state = this.state) {
        const s = props.onSectionChange ? props.section : state.localSection;
        return SECTION_IDS.indexOf(s) >= 0 ? s : null;
    }

    /** Opens category `id`, or the grid of categories for null. */
    _select = (id) => {
        if (id === this._open()) return;
        if (this.props.onSectionChange) this.props.onSectionChange(id);
        else this.setState({ localSection: id });
    };

    _back = () => this._select(null);

    load() {
        const seq = ++this.seq;
        const open = this._open();
        const jobs = this._jobs();
        const keys = [...ALWAYS, ...(open ? SECTION_DATA[open] || [] : GRID_DATA)].filter((k, i, all) => all.indexOf(k) === i);
        Promise.all(keys.map((k) => jobs[k]())).then((values) => {
            if (seq !== this.seq) return;
            const d = { ...this.state.d };
            keys.forEach((k, i) => (d[k] = values[i]));
            this.setState({ d, loading: false });
        });
    }

    /** Every request the view can make, as functions, so a section starts only its own. */
    _jobs() {
        const soft = (p) => p.catch(() => null);
        const get = (path, ttl) => () => soft(towerGet(path, ttl).then((r) => r.data));
        const values = (path, ttl) => () => soft(towerGet(path, ttl).then((r) => r.data.values));
        return {
            status: () => soft(towerGet("/status", 10000)),
            ov: get("/overview", 30000),
            alerts: get("/alerts?state=open&limit=50", 30000),
            gov: get("/governance", 60000),
            witnesses: get("/witnesses", 60000),
            dpf: get("/dpf", 300000),
            actions: get("/actions?limit=8", 300000),
            portals: get("/portals", 300000),
            treasury: values("/metrics/treasury_distribution/latest?grain=day", 600000),
            stickiness: values("/metrics/stickiness/latest?grain=day", 600000),
            curation: values("/metrics/curation_share_observed/latest?grain=day", 600000),
            fee: values("/metrics/account_creation_fee/latest?grain=hour", 600000),
            ...this._witnessJobs(soft)
        };
    }

    /** Witness activity over the last 30 days (day buckets) and the witness gauges, cached 5 minutes. */
    _witnessJobs(soft) {
        const { from, to } = this._window();
        const series = (m) => () => soft(towerSeries(m, { grain: "day", from, to, dim: "*" }, 300000));
        const latest = (m, g) => () => soft(towerGet(`/metrics/${m}/latest?grain=${g}`, 300000).then((r) => newestOnly(r.data.values)));
        return {
            production: series("block_production"),
            approvals: series("witness_approvals"),
            removals: series("witness_removals"),
            stakeAdded: series("witness_stake_added"),
            stakeRemoved: series("witness_stake_removed"),
            producerPay: series("producer_rewards"),
            concentration: latest("vote_concentration", "day"),
            interestVotes: latest("witness_interest_rate", "hour"),
            freshness: latest("feed_freshness", "hour"),
            versions: latest("witness_versions", "hour")
        };
    }

    // ------------------------------------------------------------ 2. system state

    /** The system state from the open alerts: its level, its word, the counts, and the scanner's status. */
    _systemState() {
        const { d, loading } = this.state;
        const alerts = d.alerts || [];
        const red = alerts.filter((a) => a.severity === "red" && a.state !== "closed").length;
        const amber = alerts.filter((a) => a.severity === "amber" && a.state !== "closed").length;
        const level = !d.alerts ? "muted" : red ? "red" : amber ? "amber" : "ok";
        return {
            red,
            amber,
            level,
            st: d.status ? d.status.data : null,
            word: !d.alerts
                ? loading ? tr(K + "connecting", "Connecting…") : tr(K + "unreachable", "Tower unreachable")
                : red ? tr(K + "state_red", "Intervention needed") : amber ? tr(K + "state_amber", "Watch") : tr(K + "state_ok", "Nominal"),
            text: !d.alerts
                ? tr(K + "unreachable_text", "The statistics service does not answer; figures below may be missing.")
                : `${red} ${tr(K + "red_alerts", "red")} · ${amber} ${tr(K + "amber_alerts", "amber")} · ${tr(K + "open_alerts", "open alerts")}`,
            pill: level === "ok" ? tr(K + "ok", "ok") : level === "muted" ? "–" : level === "red" ? tr(K + "red", "red") : tr(K + "amber", "amber")
        };
    }

    _renderBanner() {
        const { classes } = this.props;
        const { red, level, st, word, text, pill } = this._systemState();
        return (
            <div className={`${classes.banner} ${red ? classes.bannerStrong : ""}`}>
                <div>
                    <div className={classes.bannerLabel}>{tr(K + "system_state", "System state")}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                        <div className={classes.bannerState}>{word}</div>
                        <Pill level={level}>{pill}</Pill>
                    </div>
                    <div className={classes.bannerText}>{text}</div>
                </div>
                <div className={classes.bannerFacts}>
                    <span className={classes.factLabel}>{tr(K + "block", "Block")}</span>
                    <span className={classes.factValue}>{st && st.cursor ? fmtInt(st.cursor) : "–"}</span>
                    <span className={classes.factLabel}>{tr(K + "lag", "Lag")}</span>
                    <span className={classes.factValue}>{st && st.ingest_lag_blocks != null ? `${fmtInt(st.ingest_lag_blocks)} ${tr(K + "blocks", "blocks")}` : "–"}</span>
                    <span className={classes.factLabel}>{tr(K + "scanner", "Scanner")}</span>
                    <span className={classes.factValue}>{st && st.scanner ? (st.scanner.paused ? tr(K + "paused", "paused") : st.scanner.mode || tr(K + "starting", "starting")) : "–"}</span>
                    <span className={classes.factLabel}>{tr(K + "snapshot", "Snapshot")}</span>
                    <span className={classes.factValue}>{st && st.last_snapshot ? trf(K + "ago_n", "{n} ago", { n: fmtAgo(st.last_snapshot) }) : "–"}</span>
                </div>
            </div>
        );
    }

    _renderAlerts() {
        const { classes } = this.props;
        const { d } = this.state;
        if (!d.alerts) return <Card>{this.state.loading ? <Skeleton height={120} /> : <Empty>{tr(K + "no_data", "No data.")}</Empty>}</Card>;
        const list = [...d.alerts].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "red" ? -1 : 1));
        return (
            <Card
                title={tr(K + "alerts", "Alerts")}
                subtitle={tr(K + "alerts_sub", "Thresholds on the metrics, and single chain events that matter on their own")}
            >
                {list.length === 0 ? (
                    <Empty>{tr(K + "no_alerts", "No open alert: every watched metric is within its bands.")}</Empty>
                ) : (
                    <div className={classes.rows}>
                        {list.map((a) => (
                            <div key={a.id} className={classes.row}>
                                <div className={classes.rowLead}>
                                    <Pill level={a.severity}>{a.severity === "red" ? tr(K + "red", "red") : tr(K + "amber", "amber")}</Pill>
                                    <div className={classes.rowMain}>
                                        <div className={classes.rowTitle} title={a.title}>{(a.title || "").replace(/^(RED|AMBER): /, "")}</div>
                                        <div className={classes.rowSub}>
                                            {a.metric_title || tr(K + "chain_event", "Chain event")}
                                            {a.state === "acknowledged" ? ` · ${tr(K + "acknowledged", "acknowledged")}` : ""}
                                            {a.note ? ` · ${a.note}` : ""}
                                        </div>
                                    </div>
                                </div>
                                <div className={`${classes.rowValue} ${classes.rowValueMuted}`}>{fmtAgo(a.opened)}</div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        );
    }

    // ------------------------------------------------------------ 6. system steering

    _renderCapture() {
        const { classes } = this.props;
        const { d } = this.state;
        const g = d.gov;
        if (!g) return <Card>{this.state.loading ? <Skeleton height={260} /> : <Empty>{tr(K + "no_data", "No data.")}</Empty>}</Card>;
        const w = g.witnesses && g.witnesses.extra;
        const order = ["stall_finality", "majority", "hardfork_quorum"];
        const capture = order.map((k) => (g.capture_cost_pxp || []).find((x) => x.dim === k)).filter(Boolean);
        const hf = g.hf_readiness;
        return (
            <Card
                title={tr(K + "cost_of_capture", "Cost of capture")}
                subtitle={tr(K + "cost_of_capture_sub", "Stake an attacker needs to win schedule seats")}
                info={tr(K + "cost_of_capture_info", "Witnesses with a signing key are scheduled by votes. While there are fewer candidates than elected seats, an empty seat is taken by anyone who runs a witness node, even with no votes at all.")}
            >
                <div className={classes.rows}>
                    {capture.map((c) => {
                        const x = c.extra || {};
                        const free = c.value === 0;
                        return (
                            <div key={c.dim} className={classes.row}>
                                <div className={classes.rowMain}>
                                    <div className={classes.rowTitle}>{CAPTURE_LABELS[c.dim] ? CAPTURE_LABELS[c.dim]() : c.dim}</div>
                                    <div className={classes.rowSub}>
                                        {x.seats} {tr(K + "seats_needed", "seats needed")} · {x.free_seats} {tr(K + "free", "free")}
                                        {x.weakest_displaced ? ` · ${trf(K + "outvote_n", "outvote {n}", { n: "@" + x.weakest_displaced })}` : ""}
                                    </div>
                                </div>
                                <div className={classes.rowValue}>
                                    {free ? <Pill level="red">{tr(K + "free_cost", "free")}</Pill> : c.value == null ? "–" : `${fmtCompact(c.value)} PXP`}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className={classes.spacer} />
                <div className={classes.stats}>
                    <span className={classes.statLabel}>{tr(K + "elected_witnesses", "Elected witnesses")}</span>
                    <span className={classes.statValue}>{w ? `${w.elected} / ${w.max_voted}` : "–"}</span>
                    <span className={classes.statLabel}>{tr(K + "bench", "Backup witnesses (bench)")}</span>
                    <span className={classes.statValue}>{g.bench == null ? "–" : fmtInt(g.bench)}</span>
                    <span className={classes.statLabel}>{tr(K + "participation", "User stake voting for witnesses")}</span>
                    <span className={classes.statValue}>{fmtPct(g.witness_vote_participation, 0)}</span>
                    <div className={classes.statMeter}><Meter value={g.witness_vote_participation || 0} marks={[0.5]} /></div>
                    <span className={classes.statLabel}>{tr(K + "largest_proxy", "Largest proxy")}</span>
                    <span className={classes.statValue}>
                        {g.proxy_top_share && g.proxy_top_share.extra && g.proxy_top_share.extra.proxy ? `@${g.proxy_top_share.extra.proxy} ${fmtPct(g.proxy_top_share.value, 0)}` : tr(K + "none", "none")}
                    </span>
                    <span className={classes.statLabel}>{tr(K + "on_majority_version", "Elected on the majority version")}</span>
                    <span className={classes.statValue}>{hf ? `${fmtPct(hf.value, 0)} · ${hf.extra ? hf.extra.majority_version : ""}` : "–"}</span>
                    <span className={classes.statLabel}>{tr(K + "shared_keys", "Signing keys shared by several witnesses")}</span>
                    <span className={classes.statValue}>{g.shared_signing_keys ? fmtInt(g.shared_signing_keys.value) : "–"}</span>
                    <span className={classes.statLabel}>{tr(K + "treasury_votes", "Votes by restricted treasury accounts")}</span>
                    <span className={classes.statValue}>
                        {g.treasury_invariant && g.treasury_invariant.violations > 0 ? <Pill level="red">{fmtInt(g.treasury_invariant.violations)}</Pill> : "0"}
                    </span>
                    <span className={classes.statLabel}>{tr(K + "fresh_stake_votes", "Witness votes from accounts under 7 days, 30 d")}</span>
                    <span className={classes.statValue}>{fmtInt((g.fresh_stake_votes_30d || []).length)}</span>
                </div>
            </Card>
        );
    }

    _renderWitnesses() {
        const { classes } = this.props;
        const { d } = this.state;
        const list = d.witnesses;
        return (
            <Card
                title={tr(K + "witnesses", "Witnesses")}
                subtitle={tr(K + "witnesses_sub", "Ranked by votes; vote for them in Viability management")}
            >
                {!list ? (this.state.loading ? <Skeleton height={260} /> : <Empty>{tr(K + "no_data", "No data.")}</Empty>) : list.length === 0 ? (
                    <Empty>{tr(K + "no_witnesses", "No witness snapshot yet.")}</Empty>
                ) : (
                    <div className={classes.tableScroll}>
                        <div className={classes.tableInner}>
                            <div className={classes.wHead}>
                                <span>#</span>
                                <span>{tr(K + "witness", "Witness")}</span>
                                <span style={{ textAlign: "right" }}>{tr(K + "votes_pxp", "Votes PXP")}</span>
                                <span style={{ textAlign: "right" }}>{tr(K + "missed_24h", "Missed 24 h")}</span>
                                <span style={{ textAlign: "right" }}>{tr(K + "feed_age", "Feed age")}</span>
                                <span style={{ textAlign: "right" }}>{tr(K + "version", "Version")}</span>
                            </div>
                            {list.map((w) => (
                                <div key={w.witness} className={`${classes.wRow} ${!w.elected ? classes.wRowOut : ""}`} title={w.disabled ? tr(K + "disabled", "disabled: no signing key") : w.url || ""}>
                                    <span className={classes.wPos}>{w.position}</span>
                                    <span className={classes.wName}>@{w.witness}{w.disabled ? " · " + tr(K + "off", "off") : ""}</span>
                                    <span className={classes.wNum}>{fmtCompact(w.votes_pxp)}</span>
                                    <span className={classes.wNum}>{w.missed_24h && w.elected ? <Pill level={w.miss_rate_24h > 0.04 ? "red" : w.miss_rate_24h > 0.01 ? "amber" : "muted"} icon={false}>{w.missed_24h}</Pill> : "0"}</span>
                                    <span className={classes.wNum}>{w.feed_age_hours == null || !w.elected ? "–" : w.feed_age_hours > 24 ? <Pill level={w.feed_age_hours > 72 ? "red" : "amber"} icon={false}>{Math.round(w.feed_age_hours)}h</Pill> : `${w.feed_age_hours.toFixed(1)}h`}</span>
                                    <span className={classes.wNum}>{w.running_version || "–"}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </Card>
        );
    }

    // ------------------------------------------------------------ 1. system attributes

    _renderAttributes() {
        const { classes } = this.props;
        const { d, loading } = this.state;
        const s = d.ov ? d.ov.supply : null;
        const g = d.ov ? d.ov.governance : null;
        const fee = d.fee && d.fee[0] ? d.fee[0].value : null;
        const cur = d.curation && d.curation[0] ? d.curation[0].value : null;
        const blockSize = d.witnesses && d.witnesses.length ? d.witnesses[0].maximum_block_size : null;
        const l = loading && !d.ov;
        return (
            <div className={classes.tiles}>
                <Tile label={tr(K + "account_fee", "Account creation fee")} value={fee == null ? "–" : fmtCompact(fee)} unit="PIXA" sub={tr(K + "median_of_witnesses", "median of the witnesses")} loading={l} />
                <Tile label={tr(K + "max_block", "Maximum block size")} value={blockSize ? fmtCompact(blockSize / 1048576, 1) : "–"} unit="MiB" sub={tr(K + "voted_by_witnesses", "voted by witnesses")} loading={l} />
                <Tile label={tr(K + "debt_ratio", "PXS debt ratio")} value={s ? fmtPct(s.pxs_debt_ratio, 1) : "–"} sub={tr(K + "stop_print_at", "printing stops at 20%")} loading={l} />
                <Tile label={tr(K + "feed", "Price feed")} value={s && s.feed_pixa_per_pxs ? s.feed_pixa_per_pxs.toFixed(3) : "–"} unit="PIXA/PXS" sub={tr(K + "median_feed", "median of the elected witnesses")} loading={l} />
                <Tile label={tr(K + "vests_ratio", "PIXA per VESTS")} value={s ? s.vests_ratio.toFixed(6) : "–"} sub={tr(K + "no_stake_yield", "flat: no yield on stake")} loading={l} />
                <Tile label={tr(K + "curation_share", "Curation share")} value={cur == null ? "–" : fmtPct(cur, 0)} sub={tr(K + "curation_expected", "observed yesterday; 40% expected")} loading={l} />
                <Tile label={tr(K + "chain_version", "Chain version")} value={g ? g.majority_version || "–" : "–"} sub={g ? `${g.hf_required_witnesses} ${tr(K + "witnesses_for_hardfork", "witnesses activate a hardfork")}` : ""} loading={l} />
            </div>
        );
    }

    // ------------------------------------------------------------ 4. system goals

    /** Each goal with its live reading (null while its data is missing), its progress, and whether it is met. */
    _goalResults() {
        const { d } = this.state;
        const ctx = { gov: d.gov, ov: d.ov, treasury: d.treasury, stickiness: d.stickiness };
        return GOALS.map((goal) => {
            const r = goal.read(ctx);
            return {
                goal,
                r,
                progress: r ? Math.max(0, Math.min(1, r.current / r.target)) : 0,
                done: r ? (r.done !== undefined ? r.done : r.current >= r.target) : false
            };
        });
    }

    _renderGoals() {
        const { classes } = this.props;
        return (
            <div className={classes.goals}>
                {this._goalResults().map(({ goal, r, progress, done }) => {
                    return (
                        <div key={goal.id} className={classes.goalCard}>
                            <div className={classes.goalHeader}>
                                <div className={classes.goalInfo}>
                                    <span className={`${classes.goalTile} ${done ? classes.goalTileDone : ""}`}>
                                        <GlyphTile icon={done ? CheckCircleIcon : FlagIcon} size={40} glyph={22} />
                                    </span>
                                    <div style={{ minWidth: 0 }}>
                                        <Typography className={classes.goalTitle}>{goal.title()}</Typography>
                                        <Typography className={classes.goalDescription}>{goal.description()}</Typography>
                                    </div>
                                </div>
                                <Pill level={!r ? "muted" : done ? "ok" : "amber"} icon={false}>
                                    {!r ? "–" : done ? tr(K + "met", "met") : tr(K + "open", "open")}
                                </Pill>
                            </div>
                            <Meter value={progress} strong={done} />
                            <div className={classes.goalProgressText}>
                                <span>{r ? r.text : tr(K + "waiting_for_data", "waiting for data")}</span>
                                <span>{r ? fmtPct(progress, 0) : ""}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    // ------------------------------------------------------------ 7. decentralized funds

    _renderDpf() {
        const { classes } = this.props;
        const { d } = this.state;
        const f = d.dpf;
        if (!f) return <Card>{this.state.loading ? <Skeleton height={200} /> : <Empty>{tr(K + "no_data", "No data.")}</Empty>}</Card>;
        const active = f.proposals.filter((p) => p.status === "active");
        const ret = active.find((p) => p.id === f.return_proposal_id);
        const others = active.filter((p) => p.id !== f.return_proposal_id).sort((a, b) => b.total_votes_vests - a.total_votes_vests);
        const max = Math.max(1, ...active.map((p) => p.total_votes_vests));
        return (
            <Card
                title={tr(K + "dpf", "Decentralized Pixa Fund")}
                subtitle={`${fmtCompact(f.balance_pxs)} PXS · ${tr(K + "runway", "runway")} ${f.runway_days == null ? "–" : fmtInt(f.runway_days) + " " + tr(K + "days", "days")}`}
                info={tr(K + "dpf_info", "A proposal is paid while its votes exceed those of the return proposal (id 2), whose payments flow back into the fund. The mark on each bar is the return proposal's votes.")}
            >
                {others.length === 0 ? <Empty>{tr(K + "no_proposals", "No active proposal besides the return proposal.")}</Empty> : (
                    <div className={classes.rows}>
                        {others.map((p) => (
                            <div key={p.id} className={classes.row}>
                                <div className={classes.rowMain}>
                                    <div className={classes.rowTitle} title={p.subject}>#{p.id} · {p.subject}</div>
                                    <div className={classes.rowSub}>
                                        @{p.receiver} · {fmtCompact(p.daily_pay_pxs)} PXS/{tr(K + "day", "day")} · {trf(K + "until_n", "until {n}", { n: p.end.slice(0, 10) })}
                                    </div>
                                    <div className={classes.rowMeter}>
                                        <Meter value={p.total_votes_vests / max} marks={ret ? [ret.total_votes_vests / max] : []} strong={p.above_return} />
                                    </div>
                                </div>
                                <div className={classes.rowValue}>
                                    {p.above_return ? <Pill level="ok">{tr(K + "funded", "funded")}</Pill> : <Pill level="muted" icon={false}>{tr(K + "not_funded", "not funded")}</Pill>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {f.paid_by_receiver.filter((x) => !x.returned_to_fund).length ? (
                    <div className={classes.note}>
                        {tr(K + "paid_so_far", "Paid out so far")}:{" "}
                        {f.paid_by_receiver.filter((x) => !x.returned_to_fund).map((x) => `@${x.receiver} ${fmtCompact(x.pxs)} PXS`).join(" · ")}
                    </div>
                ) : null}
            </Card>
        );
    }

    // ------------------------------------------------------------ price feeds

    _renderFeeds() {
        const { classes } = this.props;
        const { d } = this.state;
        const list = (d.witnesses || []).filter((w) => w.elected && w.feed_pixa_per_pxs);
        const s = d.ov ? d.ov.supply : null;
        return (
            <Card
                title={tr(K + "price_feeds", "Price feeds")}
                subtitle={s && s.feed_pixa_per_pxs ? `${tr(K + "median", "median")} ${s.feed_pixa_per_pxs.toFixed(3)} PIXA ${tr(K + "per_pxs", "per PXS")}` : ""}
                info={tr(K + "feeds_info", "Each elected witness's last published feed and its distance to the median. A feed far from the others, or one not updated for a day, deserves a question to its operator.")}
            >
                {list.length === 0 ? <Empty>{tr(K + "no_feeds", "No feed published yet.")}</Empty> : (
                    <div className={classes.rows}>
                        {list.map((w) => (
                            <div key={w.witness} className={classes.row}>
                                <div className={classes.rowMain}>
                                    <div className={classes.rowTitle}>@{w.witness}</div>
                                    <div className={classes.rowSub}>{w.feed_age_hours == null ? "" : trf(K + "updated_n_ago", "updated {n} ago", { n: w.feed_age_hours < 1 ? Math.round(w.feed_age_hours * 60) + "m" : Math.round(w.feed_age_hours) + "h" })}</div>
                                </div>
                                <div className={classes.rowValue}>
                                    {w.feed_pixa_per_pxs.toFixed(3)}
                                    <span style={{ color: "#666", marginLeft: "8px" }}>
                                        {w.feed_deviation == null ? "" : Math.abs(w.feed_deviation) < 0.0005 ? "=" : `${w.feed_deviation > 0 ? "+" : ""}${(w.feed_deviation * 100).toFixed(1)}%`}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        );
    }

    // ------------------------------------------------------------ 5 & 8. system events and discussions

    _renderDiscussions() {
        const { classes } = this.props;
        const { d } = this.state;
        const portals = (d.portals || []).slice().sort((a, b) => (b.last_post_ts || 0) - (a.last_post_ts || 0));
        return (
            <Card
                title={tr(K + "discussions", "Discussions")}
                subtitle={tr(K + "discussions_sub", "Portals where the system's health and functionality are debated")}
                info={tr(K + "discussions_info", "Disruptions are reported and discussed in the portals (see the Disruptions tab). Controversy is the stake-weighted disagreement of the last 30 days.")}
            >
                {!d.portals ? (this.state.loading ? <Skeleton height={200} /> : <Empty>{tr(K + "no_data", "No data.")}</Empty>) : (
                    <div className={classes.rows}>
                        {portals.slice(0, 9).map((p) => (
                            <div key={p.portal} className={classes.row}>
                                <div className={classes.rowMain}>
                                    <div className={classes.rowTitle}>{p.title || p.portal}</div>
                                    <div className={classes.rowSub}>
                                        {fmtInt(p.posts)} {tr(K + "posts", "posts")} · {fmtInt(p.replies)} {tr(K + "replies", "replies")} · {fmtInt(p.subscribers || 0)} {tr(K + "subscribers", "subscribers")}
                                        {p.controversy_30d != null ? ` · ${tr(K + "controversy", "controversy")} ${p.controversy_30d.toFixed(2)}` : ""}
                                    </div>
                                </div>
                                <div className={`${classes.rowValue} ${classes.rowValueMuted}`}>{p.last_post ? fmtAgo(p.last_post) : "–"}</div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        );
    }

    // ------------------------------------------------------------ governance actions

    _renderActions() {
        const { classes } = this.props;
        const { d } = this.state;
        const list = d.actions || [];
        return (
            <Card
                title={tr(K + "actions", "Governance actions")}
                subtitle={tr(K + "actions_sub", "What was done about an alert, and whether the metric moved 7 and 30 days later")}
            >
                {!d.actions ? (this.state.loading ? <Skeleton height={160} /> : <Empty>{tr(K + "no_data", "No data.")}</Empty>) : list.length === 0 ? (
                    <Empty>{tr(K + "no_actions", "No action logged yet. Witnesses and operators log their responses to alerts so the Tower can show whether they worked.")}</Empty>
                ) : (
                    <div className={classes.rows}>
                        {list.map((a) => (
                            <div key={a.id} className={classes.row}>
                                <div className={classes.rowMain}>
                                    <div className={classes.rowTitle} title={a.description}>{a.description}</div>
                                    <div className={classes.rowSub}>
                                        {a.lever ? `${a.lever} · ` : ""}{a.actor || ""} · {trf(K + "ago_n", "{n} ago", { n: fmtAgo(a.t) })}
                                        {a.metric ? ` · ${a.metric}` : ""}
                                    </div>
                                </div>
                                <div className={classes.rowValue}>
                                    {a.value_at_action == null ? "–" : fmtCompact(a.value_at_action)}
                                    <span style={{ color: "#666" }}> → {a.review_7d == null ? "…" : fmtCompact(a.review_7d)} → {a.review_30d == null ? "…" : fmtCompact(a.review_30d)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        );
    }

    // ------------------------------------------------------------ witnesses, last 30 days

    /** The 30 days the witness charts cover: whole days, up to the end of the current hour (stable for the cache). */
    _window() {
        const to = Math.ceil((nowSec() + 1) / 3600) * 3600;
        return { from: Math.ceil((to - 30 * DAY) / DAY) * DAY, to };
    }

    /** PIXA per VESTS, to show stake metrics (VESTS) as Pixa Power. About 1 on Pixa. */
    _ratio() {
        const s = this.state.d.ov ? this.state.d.ov.supply : null;
        return s && s.vests_ratio ? s.vests_ratio : 1;
    }

    _wait(height) {
        return this.state.loading ? <Skeleton height={height} /> : <Empty>{tr(K + "no_data", "No data.")}</Empty>;
    }

    _renderProduction() {
        const { classes } = this.props;
        const { d } = this.state;
        const { from, to } = this._window();
        const pts = d.production;
        const days = pts
            ? fillBuckets(
                pts.filter((p) => p.dim === "").map((p) => ({ bucket: p.bucket, missed: p.extra ? p.extra.missed || 0 : 0, produced: p.extra ? p.extra.produced || 0 : 0 })),
                from, to, "day", ["missed", "produced"]
            )
            : [];
        const produced = days.reduce((t, r) => t + r.produced, 0);
        const missed = days.reduce((t, r) => t + r.missed, 0);
        const per = new Map();
        for (const p of pts || []) {
            if (p.dim === "" || !p.extra) continue;
            const x = per.get(p.dim) || { produced: 0, missed: 0 };
            x.produced += p.extra.produced || 0;
            x.missed += p.extra.missed || 0;
            per.set(p.dim, x);
        }
        const all = Array.from(per.entries()).map(([w, x]) => ({ w, ...x, rate: x.produced + x.missed ? x.missed / (x.produced + x.missed) : 0 }));
        const missing = all.filter((x) => x.missed > 0).sort((a, b) => b.missed - a.missed || b.produced - a.produced);
        const filled = filledShare;
        // Heatmap: a row per witness that missed blocks, a cell per day; hollow on days it had no slot.
        const shown = missing.slice(0, 8);
        const byDay = new Map(shown.map((x) => [x.w, new Map()]));
        for (const p of pts || []) if (byDay.has(p.dim) && p.extra) byDay.get(p.dim).set(p.bucket, p.extra);
        const rows = shown.map((x) => ({
            key: x.w,
            label: `@${x.w}`,
            title: `@${x.w} · ${trf(K + "produced_missed_n", "{p} produced · {m} missed", { p: fmtInt(x.produced), m: fmtInt(x.missed) })}`,
            cells: days.map((dd) => {
                const e = byDay.get(x.w).get(dd.bucket);
                const slots = e ? (e.produced || 0) + (e.missed || 0) : 0;
                return { v: slots ? e.missed || 0 : null, slots, day: dd.bucket };
            }),
            right: (
                <span className={classes.fillRate}>
                    {x.rate > 0.01 ? <Pill level={x.rate > 0.04 ? "red" : "amber"} icon={false}>{filled(x.produced, x.missed)}</Pill> : filled(x.produced, x.missed)}
                </span>
            )
        }));
        const n = days.length;
        const ticks = n ? Array.from(new Set([0, Math.round((n - 1) / 3), Math.round((2 * (n - 1)) / 3), n - 1])).map((i) => ({ at: i + 0.5, label: dayTick(days[i].bucket) })) : [];
        return (
            <Card
                title={tr(K + "block_production", "Block production")}
                subtitle={produced + missed ? trf(K + "slots_filled_n", "{n} of slots filled · 30 days", { n: filled(produced, missed) }) : tr(K + "last_30_days", "last 30 days")}
                info={tr(K + "block_production_heat_info", "Blocks produced over scheduled slots. Each row is a witness that missed blocks, each cell a day: the lighter, the more slots it left empty that day (hollow: no slot that day). A missed slot is not lost: the chain carries on with the next witness, 3 seconds later.")}
            >
                {!pts ? this._wait(220) : produced + missed === 0 ? (
                    <Empty>{tr(K + "no_production", "No block recorded in these 30 days yet.")}</Empty>
                ) : missed === 0 || !shown.length ? (
                    <Empty>{tr(K + "no_missed", "No block missed in 30 days.")}</Empty>
                ) : (
                    <>
                        <Heatmap
                            rows={rows}
                            columns={n}
                            cellHeight={16}
                            ticks={ticks}
                            readout={(row, col, cell) => trf(K + "missed_readout_n", "{w} · {day} · {m} missed of {s} slots", { w: row.label, day: dayLabel(cell.day), m: fmtInt(cell.v), s: fmtInt(cell.slots) })}
                            idle={trf(K + "missed_total_n", "{n} blocks missed in 30 days. Point at a day to read it.", { n: fmtInt(missed) })}
                            low={tr(K + "fewer", "Fewer")}
                            high={tr(K + "more_missed", "More missed")}
                            label={tr(K + "block_production", "Block production")}
                        />
                        {all.length > shown.length ? (
                            <div className={classes.note}>
                                {missing.length > shown.length ? `${trf(K + "more_missed_n", "{n} more witnesses missed blocks.", { n: fmtInt(missing.length - shown.length) })} ` : ""}
                                {all.length > missing.length ? trf(K + "others_missed_none_n", "Witnesses with no missed block: {n}.", { n: fmtInt(all.length - missing.length) }) : ""}
                            </div>
                        ) : null}
                    </>
                )}
            </Card>
        );
    }

    _renderWitnessVotes() {
        const { classes } = this.props;
        const { d } = this.state;
        const { from, to } = this._window();
        const ratio = this._ratio();
        const byDay = new Map();
        const row = (b) => {
            if (!byDay.has(b)) byDay.set(b, { bucket: b, approvals: 0, removals: 0 });
            return byDay.get(b);
        };
        for (const p of d.approvals || []) if (p.dim === "") row(p.bucket).approvals = p.value || 0;
        for (const p of d.removals || []) if (p.dim === "") row(p.bucket).removals = -(p.value || 0);
        const days = fillBuckets(Array.from(byDay.values()).sort((a, b) => a.bucket - b.bucket), from, to, "day", ["approvals", "removals"]);
        const nA = days.reduce((t, r) => t + r.approvals, 0);
        const nR = days.reduce((t, r) => t - r.removals, 0);
        const added = perDim(d.stakeAdded);
        const removed = perDim(d.stakeRemoved);
        const aN = perDim(d.approvals);
        const rN = perDim(d.removals);
        const movers = Array.from(new Set([...aN.keys(), ...rN.keys()]))
            .map((w) => ({ w, net: ((added.get(w) || 0) - (removed.get(w) || 0)) * ratio, a: aN.get(w) || 0, r: rN.get(w) || 0 }))
            .filter((x) => x.a || x.r)
            .sort((a, b) => Math.abs(b.net) - Math.abs(a.net) || b.a + b.r - (a.a + a.r))
            .slice(0, 5);
        const names = { approvals: tr(K + "approvals", "Approvals"), removals: tr(K + "removals", "Removals") };
        return (
            <Card
                title={tr(K + "witness_votes", "Witness votes")}
                subtitle={nA + nR ? trf(K + "approvals_removals_n", "approvals {a} · removals {r} · 30 days", { a: fmtInt(nA), r: fmtInt(nR) }) : tr(K + "last_30_days", "last 30 days")}
                info={tr(K + "witness_votes_info", "Witness approvals and removals cast each day. Below, the witnesses whose backing moved most: the stake behind each vote when it was cast, own and proxied, as Pixa Power.")}
            >
                {!d.approvals && !d.removals ? this._wait(220) : nA + nR === 0 ? (
                    <Empty>{tr(K + "no_witness_votes", "No witness vote in 30 days.")}</Empty>
                ) : (
                    <>
                        <div className={classes.chartShort}>
                            <ResponsiveContainer>
                                <BarChart data={days} margin={{ top: 8, right: 16, bottom: 0, left: -16 }} stackOffset="sign" barCategoryGap="24%">
                                    <CartesianGrid {...GRID} />
                                    <XAxis dataKey="bucket" tickFormatter={dayTick} {...AXIS} minTickGap={24} />
                                    <YAxis {...AXIS} allowDecimals={false} width={48} tickFormatter={(v) => fmtInt(Math.abs(v))} />
                                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.18)" />
                                    <Tooltip cursor={BAR_CURSOR} content={<ChartTip labelFormatter={dayLabel} names={names} valueFormatter={(v) => fmtInt(Math.abs(v))} />} />
                                    <Bar dataKey="approvals" name={names.approvals} stackId="w" fill={SERIES[0].fill} {...BAR} shape={VOTE_STACK} />
                                    <Bar dataKey="removals" name={names.removals} stackId="w" fill={SERIES[2].fill} {...BAR} shape={VOTE_STACK} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <Legend items={[{ label: names.approvals, color: SERIES[0].fill, shape: "block" }, { label: names.removals, color: SERIES[2].fill, shape: "block" }]} />
                        {movers.length ? (
                            <>
                                <div className={classes.listTitle}>{tr(K + "backing_moved", "Backing that moved most")}</div>
                                <div className={classes.rows}>
                                    {movers.map((x) => (
                                        <div key={x.w} className={classes.row}>
                                            <div className={classes.rowMain}>
                                                <div className={classes.rowTitle}>@{x.w}</div>
                                                <div className={classes.rowSub}>{trf(K + "approvals_removals_short_n", "approvals {a} · removals {r}", { a: fmtInt(x.a), r: fmtInt(x.r) })}</div>
                                            </div>
                                            <div className={classes.rowValue}>{`${x.net < 0 ? "−" : "+"}${fmtCompact(Math.abs(x.net))} PXP`}</div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : null}
                    </>
                )}
            </Card>
        );
    }

    _renderProducerPay() {
        const { classes } = this.props;
        const { d } = this.state;
        const ratio = this._ratio();
        const total = totalOf(d.producerPay) * ratio;
        const rows = Array.from(perDim(d.producerPay).entries())
            .map(([w, v]) => ({ w, pxp: v * ratio }))
            .filter((x) => x.pxp > 0)
            .sort((a, b) => b.pxp - a.pxp)
            .slice(0, 12);
        return (
            <Card
                title={tr(K + "producer_rewards", "Producer rewards")}
                subtitle={d.producerPay ? trf(K + "pxp_30d_n", "{n} PXP · 30 days", { n: fmtCompact(total) }) : ""}
                info={tr(K + "producer_rewards_info", "Pixa Power paid to each witness for the blocks it produced, at the current VESTS ratio.")}
            >
                {!d.producerPay ? this._wait(220) : rows.length === 0 ? (
                    <Empty>{tr(K + "no_producer_rewards", "No producer reward in 30 days.")}</Empty>
                ) : (
                    <div style={{ width: "100%", height: `${Math.max(120, rows.length * 30)}px` }}>
                        <ResponsiveContainer>
                            <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 64, bottom: 0, left: 0 }} barCategoryGap="24%">
                                <XAxis type="number" hide domain={[0, "dataMax"]} />
                                <YAxis type="category" dataKey="w" {...AXIS} width={112} tickFormatter={(w) => "@" + w} tick={NAME_TICK} interval={0} />
                                <Tooltip
                                    cursor={BAR_CURSOR}
                                    content={<ChartTip labelFormatter={(l) => "@" + l} valueFormatter={(v) => `${fmtCompact(v)} PXP · ${fmtPct(total ? v / total : 0, 1)}`} />}
                                />
                                <Bar dataKey="pxp" name={tr(K + "earned", "Earned")} fill={SERIES[1].fill} {...HBAR}>
                                    <LabelList dataKey="pxp" position="right" formatter={(v) => fmtCompact(v)} style={VALUE_LABEL} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </Card>
        );
    }

    _renderConcentration() {
        const { classes } = this.props;
        const { d } = this.state;
        const vc = new Map((d.concentration || []).map((v) => [v.dim, v]));
        const data = CONCENTRATION.filter((k) => vc.has("top" + k) && vc.get("top" + k).value != null).map((k) => ({
            k, label: trf(K + "top_n", "Top {n}", { n: k }), share: vc.get("top" + k).value
        }));
        const extra = data.length ? vc.get("top" + data[0].k).extra : null;
        return (
            <Card
                title={tr(K + "vote_concentration", "Vote concentration")}
                subtitle={extra ? trf(K + "entities_largest_n", "voting entities: {n} · largest @{who}", { n: fmtInt(extra.entities), who: extra.largest || "–" }) : ""}
                info={tr(K + "vote_concentration_info", "Share of the stake voting for witnesses held by the largest voting entities; stake proxied to an account counts with that account. The fewer entities above the 50% line, the easier the schedule is to capture.")}
            >
                {!d.concentration ? this._wait(200) : data.length === 0 ? (
                    <Empty>{tr(K + "no_concentration", "Computed once a day from the Tower's balances: the first value appears after the first daily run.")}</Empty>
                ) : (
                    <div className={classes.chart}>
                        <ResponsiveContainer>
                            <BarChart data={data} margin={{ top: 20, right: 16, bottom: 0, left: -8 }} barCategoryGap="24%">
                                <CartesianGrid {...GRID} />
                                <XAxis dataKey="label" {...AXIS} interval={0} />
                                <YAxis {...AXIS} width={48} domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(v) => fmtPct(v, 0)} />
                                <ReferenceLine y={0.5} stroke="rgba(255,255,255,0.3)" strokeDasharray="4 4" />
                                <Tooltip
                                    cursor={BAR_CURSOR}
                                    content={<ChartTip valueFormatter={(v) => `${fmtPct(v, 1)} ${tr(K + "of_voting_stake", "of the voting stake")}`} />}
                                />
                                <Bar dataKey="share" name={tr(K + "share_of_votes", "Share of the voting stake")} fill={SERIES[1].fill} {...BAR}>
                                    <LabelList dataKey="share" position="top" formatter={(v) => fmtPct(v, 0)} style={VALUE_LABEL} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </Card>
        );
    }

    _renderInterestVotes() {
        const { classes } = this.props;
        const { d } = this.state;
        const iv = d.interestVotes;
        const med = iv ? iv.find((v) => v.dim === "") : null;
        const median = med && med.value != null ? med.value : null;
        const rows = (iv || [])
            .filter((v) => v.dim !== "" && v.value != null)
            .map((v) => ({ w: v.dim, rate: v.value }))
            .sort((a, b) => b.rate - a.rate || (a.w < b.w ? -1 : 1));
        const pct = (v) => `${Number(v.toFixed(2))}%`;
        const allZero = !median && rows.every((r) => !r.rate);
        return (
            <Card
                title={tr(K + "interest_votes", "PXS interest rate")}
                subtitle={median != null ? trf(K + "median_rate_n", "{n} now: the median of the elected witnesses' votes", { n: pct(median) }) : ""}
                info={tr(K + "interest_votes_info", "The interest paid on PXS in savings is the median of the rates the elected witnesses vote. Each bar is one witness's vote; the line is the median.")}
            >
                {!iv ? this._wait(160) : rows.length === 0 ? (
                    <Empty>{tr(K + "no_rate_votes", "No witness has voted a rate yet.")}</Empty>
                ) : allZero ? (
                    <Empty>{tr(K + "all_zero_rate", "Every witness votes 0%: PXS in savings earns no interest.")}</Empty>
                ) : (
                    <div style={{ width: "100%", height: `${Math.max(120, rows.length * 30)}px` }}>
                        <ResponsiveContainer>
                            <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }} barCategoryGap="24%">
                                <XAxis type="number" hide domain={[0, "dataMax"]} />
                                <YAxis type="category" dataKey="w" {...AXIS} width={112} tickFormatter={(w) => "@" + w} tick={NAME_TICK} interval={0} />
                                {median ? <ReferenceLine x={median} stroke="rgba(255,255,255,0.3)" strokeDasharray="4 4" /> : null}
                                <Tooltip cursor={BAR_CURSOR} content={<ChartTip labelFormatter={(l) => "@" + l} valueFormatter={(v) => pct(v)} />} />
                                <Bar dataKey="rate" name={tr(K + "rate_vote", "Rate voted")} fill={SERIES[1].fill} {...HBAR}>
                                    <LabelList dataKey="rate" position="right" formatter={(v) => pct(v)} style={VALUE_LABEL} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </Card>
        );
    }

    _renderFreshness() {
        const { classes } = this.props;
        const { d } = this.state;
        const fr = new Map((d.freshness || []).map((v) => [v.dim, v.value || 0]));
        const data = FRESHNESS.map(([k, label]) => ({ k, label, n: fr.get(k) || 0 }));
        const elected = data.reduce((t, x) => t + x.n, 0);
        const versions = (d.versions || []).slice().sort((a, b) => (b.value || 0) - (a.value || 0));
        const hf = versions.length && versions[0].extra && versions[0].extra.hf_votes ? Object.entries(versions[0].extra.hf_votes).sort((a, b) => b[1] - a[1]) : [];
        return (
            <Card
                title={tr(K + "feeds_versions", "Feed freshness and versions")}
                subtitle={d.freshness ? trf(K + "elected_n", "elected witnesses: {n}", { n: fmtInt(elected) }) : ""}
                info={tr(K + "feeds_versions_info", "How long ago each elected witness last published a price feed, then the software the witnesses with a signing key run and the hardfork they vote for.")}
            >
                {!d.freshness ? this._wait(160) : (
                    <div className={classes.chartShort}>
                        <ResponsiveContainer>
                            <BarChart data={data} margin={{ top: 20, right: 16, bottom: 0, left: -16 }} barCategoryGap="24%">
                                <CartesianGrid {...GRID} />
                                <XAxis dataKey="label" {...AXIS} interval={0} />
                                <YAxis {...AXIS} allowDecimals={false} width={48} />
                                <Tooltip
                                    cursor={BAR_CURSOR}
                                    content={<ChartTip labelFormatter={(l) => trf(K + "feed_updated_n", "Feed updated {n} ago", { n: l })} valueFormatter={(v) => fmtInt(v)} />}
                                />
                                <Bar dataKey="n" name={tr(K + "witnesses", "Witnesses")} fill={SERIES[1].fill} {...BAR}>
                                    <LabelList dataKey="n" position="top" formatter={(v) => (v ? fmtInt(v) : "")} style={VALUE_LABEL} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
                {versions.length ? (
                    <>
                        <div className={classes.listTitle}>{tr(K + "witnesses_by_version", "Witnesses by version")}</div>
                        <div className={classes.rows}>
                            {versions.map((v) => (
                                <div key={v.dim} className={classes.row}>
                                    <div className={classes.rowMain}>
                                        <div className={classes.rowTitle}>{v.dim === "unknown" ? tr(K + "unknown_version", "not reported") : v.dim}</div>
                                    </div>
                                    <div className={classes.rowValue}>{fmtInt(v.value || 0)}</div>
                                </div>
                            ))}
                        </div>
                        {hf.length ? (
                            <div className={classes.note}>
                                {tr(K + "hardfork_votes", "Hardfork votes")}: {hf.map(([ver, n]) => `${ver === "unknown" ? "–" : ver} × ${n}`).join(" · ")}
                            </div>
                        ) : null}
                    </>
                ) : null}
            </Card>
        );
    }

    // ------------------------------------------------------------ the grid: each category's key figures

    /** A Pill drawn with this view's styles, for the grid's cards (see `badge` in the styles). */
    _badge(level, text) {
        const { classes } = this.props;
        const Icon = BADGE_ICONS[level];
        return (
            <span className={`${classes.badge} ${classes["badge_" + level]}`}>
                {Icon ? <Icon className={classes.badgeIcon} /> : null}
                {text}
            </span>
        );
    }

    /** The figures a category's card shows in the grid, a skeleton while they load. */
    _summary(id) {
        const { classes } = this.props;
        const { d, loading } = this.state;
        const waiting = (...keys) => loading && keys.some((k) => d[k] === undefined);
        const skeleton = <div className={classes.sumSkeleton} />;
        const figure = (value, unit, caption) => (
            <>
                <div className={classes.sumValue}>
                    {value}
                    {unit ? <span className={classes.sumUnit}>{unit}</span> : null}
                </div>
                {caption ? <div className={classes.sumCaption}>{caption}</div> : null}
            </>
        );
        const facts = (rows) => (
            <div className={classes.sumFacts}>
                {rows.map(([label, value]) => (
                    <React.Fragment key={label}>
                        <span className={classes.sumLabel}>{label}</span>
                        <span className={classes.sumFact}>{value}</span>
                    </React.Fragment>
                ))}
            </div>
        );
        const item = (label, title, sub) => (
            <div className={classes.sumItem}>
                <div className={classes.sumItemLabel}>{label}</div>
                <div className={classes.sumItemTitle} title={typeof title === "string" ? title : undefined}>{title}</div>
                {sub ? <div className={classes.sumItemSub}>{sub}</div> : null}
            </div>
        );
        switch (id) {
            case "state": {
                const s = this._systemState();
                return (
                    <>
                        <div className={classes.sumWord}>{s.word}</div>
                        <div className={classes.sumCaption}>{s.text}</div>
                        {facts([
                            [tr(K + "block", "Block"), s.st && s.st.cursor ? fmtInt(s.st.cursor) : "–"],
                            [tr(K + "lag", "Lag"), s.st && s.st.ingest_lag_blocks != null ? `${fmtInt(s.st.ingest_lag_blocks)} ${tr(K + "blocks", "blocks")}` : "–"]
                        ])}
                    </>
                );
            }
            case "steering": {
                if (waiting("gov")) return skeleton;
                const g = d.gov;
                const w = g && g.witnesses && g.witnesses.extra;
                const majority = g ? (g.capture_cost_pxp || []).find((x) => x.dim === "majority") : null;
                return (
                    <>
                        {figure(w ? `${w.elected} / ${w.max_voted}` : "–", null, tr(K + "elected_witnesses", "Elected witnesses"))}
                        {facts([
                            [
                                CAPTURE_LABELS.majority(),
                                !majority || majority.value == null ? "–" : majority.value === 0 ? this._badge("red", tr(K + "free_cost", "free")) : `${fmtCompact(majority.value)} PXP`
                            ],
                            [tr(K + "stake_voting", "Stake voting"), g && g.witness_vote_participation != null ? fmtPct(g.witness_vote_participation, 0) : "–"]
                        ])}
                    </>
                );
            }
            case "witnesses": {
                if (waiting("production", "concentration")) return skeleton;
                let produced = 0;
                let missed = 0;
                for (const p of d.production || []) {
                    if (p.dim !== "" || !p.extra) continue;
                    produced += p.extra.produced || 0;
                    missed += p.extra.missed || 0;
                }
                const top5 = (d.concentration || []).find((v) => v.dim === "top5");
                return (
                    <>
                        {figure(produced + missed ? filledShare(produced, missed) : "–", null, tr(K + "slots_filled_sub", "of block slots filled"))}
                        {facts([
                            [tr(K + "blocks_missed", "Blocks missed"), produced + missed ? fmtInt(missed) : "–"],
                            [trf(K + "top_n_hold", "Top {n} hold", { n: 5 }), top5 && top5.value != null ? fmtPct(top5.value, 0) : "–"]
                        ])}
                    </>
                );
            }
            case "attributes": {
                if (waiting("ov", "fee")) return skeleton;
                const s = d.ov ? d.ov.supply : null;
                const fee = d.fee && d.fee[0] ? d.fee[0].value : null;
                return (
                    <>
                        {figure(s ? fmtPct(s.pxs_debt_ratio, 1) : "–", null, `${tr(K + "debt_ratio", "PXS debt ratio")} · ${tr(K + "stop_print_at", "printing stops at 20%")}`)}
                        {facts([
                            [tr(K + "feed", "Price feed"), s && s.feed_pixa_per_pxs ? `${s.feed_pixa_per_pxs.toFixed(3)} PIXA/PXS` : "–"],
                            [tr(K + "account_fee", "Account creation fee"), fee == null ? "–" : `${fmtCompact(fee)} PIXA`]
                        ])}
                    </>
                );
            }
            case "goals": {
                if (waiting("gov", "ov", "treasury", "stickiness")) return skeleton;
                const results = this._goalResults();
                const met = results.filter((x) => x.r && x.done).length;
                const next = results.find((x) => x.r && !x.done);
                return (
                    <>
                        {figure(`${met} / ${results.length}`, null, tr(K + "goals_met", "goals met"))}
                        <div className={classes.segments}>
                            {results.map((x) => (
                                <span
                                    key={x.goal.id}
                                    title={x.goal.title()}
                                    className={`${classes.segment} ${!x.r ? classes.segmentUnknown : x.done ? classes.segmentOn : ""}`}
                                />
                            ))}
                        </div>
                        {next ? <div className={classes.sumFacts}>{item(tr(K + "next_goal", "Next"), next.goal.title(), next.r.text)}</div> : null}
                    </>
                );
            }
            case "funds": {
                if (waiting("dpf", "ov")) return skeleton;
                const f = d.dpf;
                const s = d.ov ? d.ov.supply : null;
                const funded = f ? f.proposals.filter((p) => p.status === "active" && p.id !== f.return_proposal_id && p.above_return).length : null;
                return (
                    <>
                        {figure(f ? fmtCompact(f.balance_pxs) : "–", "PXS", tr(K + "dpf", "Decentralized Pixa Fund"))}
                        {facts([
                            [tr(K + "runway_label", "Runway"), f && f.runway_days != null ? `${fmtInt(f.runway_days)} ${tr(K + "days", "days")}` : "–"],
                            [tr(K + "funded_proposals", "Funded proposals"), funded == null ? "–" : fmtInt(funded)],
                            [tr(K + "median_feed_label", "Median feed"), s && s.feed_pixa_per_pxs ? s.feed_pixa_per_pxs.toFixed(3) : "–"]
                        ])}
                    </>
                );
            }
            case "events": {
                if (waiting("portals", "actions")) return skeleton;
                const portal = (d.portals || []).slice().sort((a, b) => (b.last_post_ts || 0) - (a.last_post_ts || 0))[0];
                const action = (d.actions || [])[0];
                return (
                    <>
                        {item(
                            tr(K + "latest_discussion", "Latest discussion"),
                            portal ? portal.title || portal.portal : "–",
                            portal ? [portal.last_post ? trf(K + "last_post_n", "last post {n} ago", { n: fmtAgo(portal.last_post) }) : null, `${fmtInt(portal.replies)} ${tr(K + "replies", "replies")}`].filter(Boolean).join(" · ") : null
                        )}
                        {item(
                            tr(K + "latest_action", "Latest action"),
                            action ? action.description : tr(K + "no_action_yet", "None logged yet"),
                            action ? `${action.lever ? action.lever + " · " : ""}${trf(K + "ago_n", "{n} ago", { n: fmtAgo(action.t) })}` : null
                        )}
                    </>
                );
            }
            case "reports":
                return (
                    <>
                        <div className={classes.chips}>
                            {[tr(K + "cadence_day", "Day"), tr(K + "cadence_week", "Week"), tr(K + "cadence_month", "Month")].map((x) => (
                                <span key={x} className={classes.chip}>{x}</span>
                            ))}
                        </div>
                        <div className={classes.sumCaption} style={{ marginTop: "12px" }}>
                            {tr(K + "reports_card_sub", "Ranking, votes, production, missed blocks, parameters, feeds and versions, against the period before.")}
                        </div>
                    </>
                );
            default:
                return null;
        }
    }

    /** The grid of categories: 4 × 2, 2 × 4 on a tablet, 8 × 1 on a phone. */
    _renderGrid() {
        const { classes } = this.props;
        const state = this._systemState();
        return (
            <div key="grid" className={classes.grid} data-hub-grid="">
                {SECTIONS.map((x, i) => (
                    <div key={x.id} className={classes.sumCard} onClick={() => this._select(x.id)} data-hub-card={x.id} data-hub-enter={i}>
                        <div className={classes.sumHead}>
                            <span className={classes.sumIcon} data-hub-icon={x.id}>
                                <GlyphTile icon={x.icon} size={36} glyph={21} />
                            </span>
                            <Typography component="h3" className={classes.sumTitle}>{x.title()}</Typography>
                            {x.id === "state" ? this._badge(state.level, state.pill) : null}
                        </div>
                        <div className={classes.sumBody}>{this._summary(x.id)}</div>
                        <button
                            type="button"
                            className={classes.more}
                            onClick={(e) => {
                                e.stopPropagation();
                                this._select(x.id);
                            }}
                            aria-label={`${tr(K + "details", "Details")}: ${x.title()}`}
                        >
                            <span>{tr(K + "details", "Details")}</span>
                            <ArrowForwardRoundedIcon className={classes.moreIcon} />
                        </button>
                    </div>
                ))}
            </div>
        );
    }

    /** An open category: back, its icon and title (they stay at the top), its description, its cards. */
    _renderOpen(open) {
        const { classes } = this.props;
        const sec = SECTIONS[SECTION_IDS.indexOf(open)];
        const state = this._systemState();
        return (
            <div key="open" data-hub-reveal="">
                <StickyBar>
                    <BackButton onClick={this._back} label={tr(K + "all_categories", "All categories")} />
                    <span className={classes.headIcon} data-hub-icon={open}>
                        <GlyphTile icon={sec.icon} size={36} glyph={21} />
                    </span>
                    <Typography component="h2" className={classes.headTitle}>{sec.title()}</Typography>
                    <Pill level={state.level}>{state.pill}</Pill>
                </StickyBar>
                <div key={open} data-hub-swap="">
                    <Typography className={classes.headDescription} data-hub-enter="0">{sec.description()}</Typography>
                    <div data-hub-enter="1">{this._renderSection(open)}</div>
                </div>
            </div>
        );
    }

    // ------------------------------------------------------------ an open category

    _renderSection(id) {
        const { classes } = this.props;
        switch (id) {
            case "state":
                return (
                    <>
                        {this._renderBanner()}
                        <div className={classes.below}>{this._renderAlerts()}</div>
                    </>
                );
            case "steering":
                return (
                    <Masonry>
                        {this._renderCapture()}
                        {this._renderWitnesses()}
                    </Masonry>
                );
            case "witnesses":
                return (
                    <Masonry>
                        {this._renderProduction()}
                        {this._renderWitnessVotes()}
                        {this._renderProducerPay()}
                        {this._renderConcentration()}
                        {this._renderInterestVotes()}
                        {this._renderFreshness()}
                    </Masonry>
                );
            case "attributes":
                return this._renderAttributes();
            case "goals":
                return this._renderGoals();
            case "funds":
                return (
                    <Masonry>
                        {this._renderDpf()}
                        {this._renderFeeds()}
                    </Masonry>
                );
            case "events":
                return (
                    <Masonry>
                        {this._renderDiscussions()}
                        {this._renderActions()}
                    </Masonry>
                );
            case "reports":
                return (
                    <GDReports
                        kinds={["witnesses"]}
                        title={tr(K + "witness_reports", "Witness reports")}
                        info={tr(K + "witness_reports_info", "Written by the Tower when a period closes; the current period is built on request. Ranking, votes, production, missed blocks, parameters, feeds and versions, against the period before.")}
                    />
                );
            default:
                return null;
        }
    }

    render() {
        const { classes } = this.props;
        const open = this._open();
        return (
            <DialogContent className={classes.dialogContent}>
                <div ref={this.root} className={classes.hub}>
                    {open ? this._renderOpen(open) : this._renderGrid()}
                </div>
            </DialogContent>
        );
    }
}

export default withLanguage(withStyles(styles)(GDControlTower));