import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import Card from '@material-ui/core/Card';
import Backdrop from '@material-ui/core/Backdrop';
import Portal from '@material-ui/core/Portal';
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";
import Fade from "@material-ui/core/Fade";
import CloseRounded from "@material-ui/icons/CloseRounded";
import ExploreRounded from "@material-ui/icons/ExploreRounded";
import FitnessCenterRounded from "@material-ui/icons/FitnessCenterRounded";
import BlurOnRounded from "@material-ui/icons/BlurOnRounded";
import AllInclusiveRounded from "@material-ui/icons/AllInclusiveRounded";
import VisibilityRounded from "@material-ui/icons/VisibilityRounded";
import GrainRounded from "@material-ui/icons/GrainRounded";
import ScheduleRounded from "@material-ui/icons/ScheduleRounded";
import RestaurantRounded from "@material-ui/icons/RestaurantRounded";
import CompareArrowsRounded from "@material-ui/icons/CompareArrowsRounded";
import AccountBalanceRounded from "@material-ui/icons/AccountBalanceRounded";
import GavelRounded from "@material-ui/icons/GavelRounded";
import ArrowForwardRounded from "@material-ui/icons/ArrowForwardRounded";
import ArrowDownwardRounded from "@material-ui/icons/ArrowDownwardRounded";
import ContentCutRounded from "../icons/ContentCut";
import PixaSupra from "../icons/PixaSupra";

import {ResponsiveContainer} from 'recharts/lib/component/ResponsiveContainer';
import {AreaChart} from 'recharts/lib/chart/AreaChart';
import {Area} from 'recharts/lib/cartesian/Area';
import {XAxis} from 'recharts/lib/cartesian/XAxis';
import {YAxis} from 'recharts/lib/cartesian/YAxis';
import {Tooltip as TooltipChart} from 'recharts/lib/component/Tooltip';
import {CartesianGrid} from 'recharts/lib/cartesian/CartesianGrid';
import {Legend} from 'recharts/lib/component/Legend';
import {ReferenceArea} from 'recharts/lib/cartesian/ReferenceArea';

import { T } from "../utils/T";
import { t } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";
// Heading font stack. Body copy inherits the app's normative font.
const TITLE_FONT = '"Industry Book", "Normative Pro", sans-serif';

const styles = theme => ({
    backdrop: {
        zIndex: theme.zIndex.drawer + 2,
        backdropFilter: "blur(5px)",
    },
    dialogCard: {
        userSelect: "none",
        height: "86%",
        maxWidth: "920px",
        width: "100%",
        margin: "auto",
        borderRadius: "32px",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#0e0e0e !important",
        backgroundImage: "radial-gradient(circle at 20% -10%, #161616 0%, transparent 45%)",
        [theme.breakpoints.down("sm")]: {
            maxHeight: "100%",
            height: "100%",
            maxWidth: "100%",
            width: "100%",
            borderRadius: "0px",
        },
    },
    dialogTitle: {
        padding: "20px 24px 12px 24px",
        backgroundColor: "#0e0e0e",
        position: "relative",
        flex: "0 0 auto",
        "& .MuiTypography-root": {display: "flex", alignItems: "center", gap: 12},
        [theme.breakpoints.down("sm")]: {padding: "16px 16px 8px 16px"},
    },
    titleText: {
        fontFamily: TITLE_FONT,
        fontSize: "1.4rem",
        fontWeight: 600,
        color: "#ffffff",
        lineHeight: 1.2,
        display: "flex",
        flexDirection: "column",
    },
    titleSub: {
        fontFamily: TITLE_FONT,
        fontSize: "0.72rem",
        fontWeight: 400,
        color: "#888",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        marginTop: 2,
    },
    titleIconWrap: {
        width: 48,
        height: 48,
        borderRadius: "50%",
        backgroundColor: "#1a1a1a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        "& svg": {fill: "#ffffff", width: 28, height: 28},
    },
    closeButton: {
        position: "absolute",
        top: 16,
        right: 16,
        color: "#888",
        transition: "background-color 180ms cubic-bezier(0.4, 0, 0.2, 1), color 180ms cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": {color: "#fff", backgroundColor: "#1a1a1a"},
    },
    dialogContent: {
        "&.MuiDialogContent-root": {padding: "0 24px 28px 24px"},
        flex: "1 1 auto",
        overflowY: "auto",
        overflowX: "hidden",
        backgroundColor: "#040404",
        [theme.breakpoints.down("sm")]: {
            "&.MuiDialogContent-root": {padding: "0 16px 20px 16px"},
        },
    },

    // ── Hero ──────────────────────────────────────────────────────────────
    hero: {
        padding: "26px 0 6px 0",
    },
    heroTitle: {
        fontFamily: TITLE_FONT,
        fontSize: "2rem",
        fontWeight: 700,
        color: "#ffffff",
        lineHeight: 1.12,
        margin: "0 0 12px 0",
        [theme.breakpoints.down("sm")]: {fontSize: "1.5rem"},
    },
    heroAccent: {color: "#c7c7c7"},
    heroBody: {fontSize: "0.96rem", color: "#a5a5a5", lineHeight: 1.6},
    heroBodyEmphasis: {color: "#ffffff"},
    statRow: {
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 8,
        margin: "18px 0 0 0",
        [theme.breakpoints.down("xs")]: {gridTemplateColumns: "1fr"},
    },
    statCell: {
        backgroundColor: "#0d0d0d",
        borderRadius: 14,
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
    },
    statValue: {fontFamily: TITLE_FONT, fontSize: "1.05rem", fontWeight: 600, color: "#ffffff", lineHeight: 1.2},
    statLabel: {fontFamily: TITLE_FONT, fontSize: "0.64rem", color: "#666", letterSpacing: "0.06em", textTransform: "uppercase"},

    // ── Anatomy chip (shared cohesion device) ──────────────────────────────
    anatomyChip: {
        display: "flex",
        alignItems: "stretch",
        gap: 4,
        backgroundColor: "#0a0a0a",
        borderRadius: 18,
        padding: 8,
        marginTop: 16,
        overflowX: "auto",
    },
    anatomyNode: {
        flex: "1 1 0",
        minWidth: 76,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 5,
        padding: "10px 6px",
        borderRadius: 13,
        textAlign: "center",
    },
    anatomyNodeActive: {backgroundColor: "#1a1a1a"},
    anatomyIcon: {
        width: 30, height: 30, borderRadius: "50%", backgroundColor: "#131313",
        display: "flex", alignItems: "center", justifyContent: "center",
        "& svg": {width: 16, height: 16, fill: "#777"},
    },
    anatomyIconActive: {backgroundColor: "#ffffff", "& svg": {fill: "#000"}},
    anatomyLabel: {fontFamily: TITLE_FONT, fontSize: "0.62rem", color: "#888", letterSpacing: "0.04em", textTransform: "uppercase", lineHeight: 1.1},
    anatomyLabelActive: {color: "#ffffff"},
    anatomySub: {fontSize: "0.54rem", color: "#555", lineHeight: 1},

    // ── Section scaffolding ─────────────────────────────────────────────────
    section: {margin: "30px 0 8px 0"},
    sectionHeader: {display: "flex", alignItems: "center", gap: 10, marginBottom: 12},
    chapterNum: {
        fontFamily: TITLE_FONT, fontSize: "1.5rem", fontWeight: 700, color: "#222",
        lineHeight: 1, flexShrink: 0, width: 34, fontVariantNumeric: "tabular-nums",
    },
    sectionIcon: {"& svg": {fill: "#ffffff", width: 22, height: 22, flexShrink: 0}, display: "flex"},
    sectionTitle: {fontFamily: TITLE_FONT, fontSize: "1.12rem", fontWeight: 600, color: "#ffffff", margin: 0, lineHeight: 1.3},
    sectionSubtitle: {fontSize: "0.88rem", color: "#888", lineHeight: 1.6, margin: "0 0 16px 0", maxWidth: 760},
    bodyEmphasis: {color: "#c7c7c7", fontWeight: 500},

    // ── Pull-quote ───────────────────────────────────────────────────────────
    pullQuote: {
        fontFamily: TITLE_FONT, fontSize: "1.5rem", fontWeight: 700, color: "#ffffff",
        lineHeight: 1.15, margin: "0 0 14px 0",
        [theme.breakpoints.down("xs")]: {fontSize: "1.25rem"},
    },

    // ── Organ grid + relation strip ───────────────────────────────────────────
    organGrid: {
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10,
        [theme.breakpoints.down("sm")]: {gridTemplateColumns: "repeat(2, 1fr)"},
        [theme.breakpoints.down("xs")]: {gridTemplateColumns: "1fr"},
    },
    organCard: {
        backgroundColor: "#111", borderRadius: 16,
        padding: "16px 14px", display: "flex", flexDirection: "column", gap: 6,
        transition: "background-color 180ms cubic-bezier(0.4, 0, 0.2, 1), color 180ms cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": {backgroundColor: "#181818"},
    },
    organIcon: {
        width: 38, height: 38, borderRadius: "50%", backgroundColor: "#0a0a0a",
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 2,
        "& svg": {width: 21, height: 21, fill: "#ffffff"},
    },
    organFaculty: {fontFamily: TITLE_FONT, fontSize: "0.6rem", color: "#888", letterSpacing: "0.1em", textTransform: "uppercase"},
    organName: {fontFamily: TITLE_FONT, fontSize: "1.1rem", fontWeight: 700, color: "#ffffff", margin: 0, lineHeight: 1.1},
    organNature: {fontFamily: TITLE_FONT, fontSize: "0.58rem", color: "#666", letterSpacing: "0.06em", textTransform: "uppercase", marginTop: -2},
    organBody: {fontSize: "0.78rem", color: "#a5a5a5", lineHeight: 1.5, margin: "4px 0 0 0"},
    relationStrip: {
        display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap",
        gap: 10, backgroundColor: "#0a0a0a", borderRadius: 14,
        padding: "12px 14px", marginTop: 12,
    },
    relationItem: {display: "flex", flexDirection: "column", alignItems: "center", gap: 1},
    relationWord: {fontFamily: TITLE_FONT, fontSize: "0.82rem", fontWeight: 700, color: "#ffffff", lineHeight: 1},
    relationVerb: {fontFamily: TITLE_FONT, fontSize: "0.6rem", color: "#888", letterSpacing: "0.06em", textTransform: "uppercase"},
    relationArrow: {display: "flex", "& svg": {width: 16, height: 16, fill: "#444"}},

    // ── Pipeline (the mind, three steps) ───────────────────────────────────────
    flowGrid: {display: "grid", gridTemplateColumns: "1fr", gap: 0},
    flowNode: {backgroundColor: "#111", borderRadius: 16, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4},
    flowNodeHighlight: {backgroundColor: "#181818"},
    stepHeadline: {display: "flex", alignItems: "center", gap: 10, "& svg": {fill: "#ffffff", width: 20, height: 20}},
    flowNodeTitle: {fontFamily: TITLE_FONT, fontSize: "0.95rem", fontWeight: 600, color: "#ffffff", margin: 0, flex: 1},
    flowNodeBadge: {fontFamily: TITLE_FONT, fontSize: "0.62rem", color: "#888", letterSpacing: "0.05em", textTransform: "uppercase", backgroundColor: "#000", padding: "2px 8px", borderRadius: 6, whiteSpace: "nowrap"},
    flowNodeBody: {fontSize: "0.82rem", color: "#a5a5a5", lineHeight: 1.55, margin: 0},
    flowArrow: {display: "flex", justifyContent: "center", margin: "4px 0", "& svg": {fill: "#444", width: 22, height: 22}},

    // ── Corridor gauge (the body) ──────────────────────────────────────────────
    gaugeCard: {backgroundColor: "#0a0a0a", borderRadius: 20, padding: "18px 20px 12px", margin: "8px 0"},
    gaugeLegend: {display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 14, marginBottom: 16},
    gaugeLegendItem: {display: "flex", flexDirection: "column", gap: 2},
    gaugeLegendKicker: {fontFamily: TITLE_FONT, fontSize: "0.6rem", color: "#666", letterSpacing: "0.08em", textTransform: "uppercase"},
    gaugeLegendValue: {fontFamily: TITLE_FONT, fontSize: "0.95rem", fontWeight: 600, color: "#ffffff"},
    gaugeBarWrap: {position: "relative", height: 58, marginTop: 4, marginBottom: 34},
    gaugeTrack: {position: "absolute", left: 0, right: 0, top: 20, height: 16, backgroundColor: "#070707", borderRadius: 8, overflow: "hidden"},
    gaugeTired: {
        position: "absolute", left: 0, width: "30%", top: 0, bottom: 0,
        backgroundImage: "repeating-linear-gradient(45deg, #1a1a1a, #1a1a1a 4px, #0d0d0d 4px, #0d0d0d 8px)",
    },
    gaugeHonoured: {position: "absolute", left: "30%", width: "70%", top: 0, bottom: 0, backgroundColor: "#333"},
    gaugeTarget: {position: "absolute", left: "50%", width: "20%", top: 0, bottom: 0, backgroundColor: "#ffffff"},
    gaugeFloor: {position: "absolute", left: "30%", top: 12, height: 32, width: 2, backgroundColor: "#888"},
    gaugeMarker: {position: "absolute", left: "60%", top: 2, transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center"},
    gaugeMarkerDot: {width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "7px solid #fff"},
    gaugeMarkerLabel: {fontFamily: TITLE_FONT, fontSize: "0.55rem", color: "#fff", letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap", marginBottom: 2},
    gaugeTick: {position: "absolute", top: 42, fontFamily: TITLE_FONT, fontSize: "0.64rem", color: "#a5a5a5", letterSpacing: "0.03em", whiteSpace: "nowrap"},
    gaugeBody: {fontSize: "0.82rem", color: "#a5a5a5", lineHeight: 1.55, margin: 0},

    // ── Regime cards ───────────────────────────────────────────────────────────
    regimeGrid: {display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12, [theme.breakpoints.down("xs")]: {gridTemplateColumns: "1fr"}},
    regimeCard: {backgroundColor: "#111", borderRadius: 16, padding: "14px 16px"},
    regimeCardHighlight: {backgroundColor: "#181818"},
    regimeHeader: {display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 4},
    regimeTitle: {fontFamily: TITLE_FONT, fontSize: "0.88rem", fontWeight: 600, color: "#ffffff", margin: 0},
    regimeRange: {fontFamily: TITLE_FONT, fontSize: "0.72rem", color: "#888"},
    regimeBody: {fontSize: "0.8rem", color: "#a5a5a5", lineHeight: 1.5, margin: 0},

    // ── Chart card ───────────────────────────────────────────────────────────
    chartCard: {backgroundColor: "#0a0a0a", borderRadius: 20, padding: "16px 12px 8px 8px", margin: "8px 0"},
    chartLabel: {fontSize: "0.78rem", color: "#a5a5a5", textAlign: "center", marginTop: 6, lineHeight: 1.5},

    // ── Supra concept card ──────────────────────────────────────────────────────
    conceptCard: {backgroundColor: "#0a0a0a", borderRadius: 20, padding: "20px 22px", margin: "8px 0", display: "flex", flexDirection: "column", gap: 10},
    conceptLead: {fontFamily: TITLE_FONT, fontSize: "1.1rem", fontWeight: 600, color: "#ffffff", lineHeight: 1.3, margin: 0},
    conceptBody: {fontSize: "0.85rem", color: "#c7c7c7", lineHeight: 1.6, margin: 0},

    // ── Sibling, not twin ───────────────────────────────────────────────────────
    siblingWrap: {display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "stretch", margin: "8px 0", [theme.breakpoints.down("xs")]: {gridTemplateColumns: "1fr"}},
    creatureCard: {backgroundColor: "#0a0a0a", borderRadius: 16, padding: "16px 16px", display: "flex", flexDirection: "column", gap: 10},
    creatureHead: {display: "flex", alignItems: "center", gap: 8, "& svg": {width: 20, height: 20, fill: "#fff"}},
    creatureTitle: {fontFamily: TITLE_FONT, fontSize: "1rem", fontWeight: 700, color: "#ffffff", margin: 0, lineHeight: 1},
    creatureKicker: {fontFamily: TITLE_FONT, fontSize: "0.56rem", color: "#666", letterSpacing: "0.08em", textTransform: "uppercase"},
    creatureRow: {display: "flex", gap: 10},
    creatureOrgan: {fontFamily: TITLE_FONT, fontSize: "0.58rem", color: "#666", letterSpacing: "0.06em", textTransform: "uppercase", width: 56, flexShrink: 0, paddingTop: 2, lineHeight: 1.3},
    creatureText: {fontSize: "0.76rem", color: "#a5a5a5", lineHeight: 1.45, margin: 0},
    siblingDivider: {display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, [theme.breakpoints.down("xs")]: {flexDirection: "row", flexWrap: "wrap", padding: "4px 0"}},
    siblingBar: {width: 2, flex: 1, minHeight: 24, backgroundImage: "linear-gradient(#161616, #3a3a3a, #161616)", [theme.breakpoints.down("xs")]: {display: "none"}},
    siblingSymbol: {fontFamily: TITLE_FONT, fontSize: "1.1rem", color: "#555", lineHeight: 1, [theme.breakpoints.down("xs")]: {display: "none"}},
    siblingChip: {fontFamily: TITLE_FONT, fontSize: "0.55rem", color: "#888", letterSpacing: "0.06em", textTransform: "uppercase", backgroundColor: "#111", borderRadius: 8, padding: "5px 8px", whiteSpace: "nowrap"},

    // ── Two grammars ───────────────────────────────────────────────────────────
    grammarWrap: {backgroundColor: "#0a0a0a", borderRadius: 18, padding: 6, margin: "8px 0", overflow: "hidden"},
    grammarHead: {display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "8px 14px 10px"},
    grammarHeadCell: {fontFamily: TITLE_FONT, fontSize: "0.62rem", color: "#666", letterSpacing: "0.08em", textTransform: "uppercase"},
    grammarRow: {display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "11px 14px"},
    grammarRowAlt: {backgroundColor: "#141414", borderRadius: 10},
    grammarTermMuted: {fontFamily: TITLE_FONT, fontSize: "0.84rem", fontWeight: 600, color: "#888", textDecoration: "line-through", textDecorationColor: "#444", lineHeight: 1.2},
    grammarGlossMuted: {fontSize: "0.72rem", color: "#5e5e5e", lineHeight: 1.4, marginTop: 2},
    grammarTerm: {fontFamily: TITLE_FONT, fontSize: "0.84rem", fontWeight: 600, color: "#ffffff", lineHeight: 1.2},
    grammarGloss: {fontSize: "0.72rem", color: "#a5a5a5", lineHeight: 1.4, marginTop: 2},

    // ── Classification card ──────────────────────────────────────────────────────
    classificationCard: {backgroundColor: "#1a1a1a", borderRadius: 20, padding: "20px 22px", margin: "8px 0", display: "flex", flexDirection: "column", gap: 10},
    classificationKicker: {fontFamily: TITLE_FONT, fontSize: "0.62rem", color: "#888", letterSpacing: "0.1em", textTransform: "uppercase"},
    classificationStatement: {fontFamily: TITLE_FONT, fontSize: "1.15rem", fontWeight: 600, color: "#ffffff", lineHeight: 1.3, margin: 0, [theme.breakpoints.down("sm")]: {fontSize: "1rem"}},
    classificationBody: {fontSize: "0.85rem", color: "#c7c7c7", lineHeight: 1.6, margin: 0},

    footnote: {margin: "26px 0 4px 0", padding: "16px 18px", backgroundColor: "#0a0a0a", borderRadius: 16, fontSize: "0.78rem", color: "#888", lineHeight: 1.6, textAlign: "center"},
    footnoteAccent: {fontFamily: TITLE_FONT, color: "#ffffff", letterSpacing: "0.04em"},
});

// ── Greyscale recharts tooltip ──────────────────────────────────────────────
const _HaircutTooltip = ({active, payload, label}) => {
    if (!active || !payload || !payload.length) return null;
    return (
        <div style={{background: '#1e1e1e', color: '#ffffff', borderRadius: 8, padding: 10, fontSize: 12, lineHeight: 1.5}}>
            <div style={{color: "#888", marginBottom: 4}}>{t("components.pixa_wallet_supra_info_dialog.body_at_the_weight", {
                    label: label
                })}</div>
            {payload.map((p, i) => (
                <div key={i}>
                    <span style={{display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: p.stroke, marginRight: 6, verticalAlign: "middle"}}/>
                    <strong>{p.name}:</strong> {Number(p.value).toFixed(0)}%
                </div>
            ))}
        </div>
    );
};

// ── Static, illustrative model data (not live values) ───────────────────────
const buildOrgans = () => [
    {faculty: t("words.the_mind"), name: t("words.oracle"), nature: t("components.pixa_wallet_supra_info_dialog.mental_abstract"), body: t("components.pixa_wallet_supra_info_dialog.names_the_weight_the_body_should_carry_a"), Icon: ExploreRounded},
    {faculty: t("words.the_body"), name: t("words.atlas"), nature: t("components.pixa_wallet_supra_info_dialog.physical_dynamic"), body: t("components.pixa_wallet_supra_info_dialog.bears_the_weight_pxa_pxp_together_liquid"), Icon: FitnessCenterRounded},
    {faculty: t("words.the_consciousness"), name: t("words.supra"), nature: t("components.pixa_wallet_supra_info_dialog.projection_derived"), body: t("components.pixa_wallet_supra_info_dialog.what_you_actually_hold_pxs_the_body_observed"), Icon: BlurOnRounded},
    {faculty: t("words.the_soul"), name: t("words.macro"), nature: t("components.pixa_wallet_supra_info_dialog.energetic_flowing"), body: t("components.pixa_wallet_supra_info_dialog.energy_in_flow_not_a_supply_what"), Icon: AllInclusiveRounded},
];

const buildRelation = () => [
    {word: t("words.oracle"), verb: t("components.pixa_wallet_supra_info_dialog.senses")},
    {word: t("words.atlas"), verb: t("components.pixa_wallet_supra_info_dialog.bears")},
    {word: t("words.macro"), verb: t("components.pixa_wallet_supra_info_dialog.regulates")},
    {word: t("words.supra"), verb: t("components.pixa_wallet_supra_info_dialog.observed")},
];

const buildPipeline = () => [
    {title: t("components.pixa_wallet_supra_info_dialog.witnesses_report"), badge: t("components.pixa_wallet_supra_info_dialog.21_elected_hourly"), body: t("components.pixa_wallet_supra_info_dialog.twenty_one_witnesses_elected_by_staked_pxp_each"), Icon: VisibilityRounded},
    {title: t("components.pixa_wallet_supra_info_dialog.two_stage_median"), badge: t("components.pixa_wallet_supra_info_dialog.doubly_median_84_h"), body: t("components.pixa_wallet_supra_info_dialog.a_median_across_the_twenty_one_witnesses_rejects"), Icon: GrainRounded, highlight: true},
    {title: t("components.pixa_wallet_supra_info_dialog.settlement"), badge: t("components.pixa_wallet_supra_info_dialog.reading_haircut"), body: t("components.pixa_wallet_supra_info_dialog.when_you_settle_the_atlas_is_delivered"), Icon: ScheduleRounded},
];

const buildRegimes = () => [
    {title: t("components.pixa_wallet_supra_info_dialog.tired_body"), range: t("components.pixa_wallet_supra_info_dialog.below_3"), body: t("components.pixa_wallet_supra_info_dialog.below_the_floor_the_haircut_falls_linearly_toward"), highlight: true},
    {title: t("components.pixa_wallet_supra_info_dialog.viable_corridor"), range: t("components.pixa_wallet_supra_info_dialog.3_10"), body: t("components.pixa_wallet_supra_info_dialog.reserves_sit_at_three_to_ten_times"), highlight: false},
    {title: t("components.pixa_wallet_supra_info_dialog.deep_capacity"), range: t("components.pixa_wallet_supra_info_dialog.above_10"), body: t("components.pixa_wallet_supra_info_dialog.the_body_simply_has_more_capacity_than"), highlight: false},
];

// Haircut returns 1.0 inside the corridor and falls linearly toward zero below 3×.
// X axis = reserves as a multiple of the weight the oracle implies.
const HAIRCUT_DATA = [
    {r: "0×", payout: 0, withheld: 100},
    {r: "1×", payout: 33, withheld: 67},
    {r: "2×", payout: 67, withheld: 33},
    {r: "3×", payout: 100, withheld: 0},
    {r: "5×", payout: 100, withheld: 0},
    {r: "7×", payout: 100, withheld: 0},
    {r: "10×", payout: 100, withheld: 0},
];

const buildFiatCreature = () => ({
    title: t("components.pixa_wallet_supra_info_dialog.fiat"), kicker: t("components.pixa_wallet_supra_info_dialog.a_creature_of_its_own"), Icon: AccountBalanceRounded,
    rows: [
        {organ: t("components.pixa_wallet_supra_info_dialog.its_mind"), text: t("components.pixa_wallet_supra_info_dialog.central_banks_the_imf_the_bis_a")},
        {organ: t("components.pixa_wallet_supra_info_dialog.its_body"), text: t("components.pixa_wallet_supra_info_dialog.the_real_economy_reserves_the_institutions_that_bear")},
        {organ: t("components.pixa_wallet_supra_info_dialog.its_soul"), text: t("components.pixa_wallet_supra_info_dialog.monetary_energy_in_flow_shaped_by_policy")},
    ],
});
const buildSupraCreature = () => ({
    title: "Pixa Supra", kicker: t("components.pixa_wallet_supra_info_dialog.a_creature_of_its_own"), Icon: PixaSupra,
    rows: [
        {organ: t("components.pixa_wallet_supra_info_dialog.its_mind"), text: t("components.pixa_wallet_supra_info_dialog.a_witness_compass_reading_an_ideal_of")},
        {organ: t("components.pixa_wallet_supra_info_dialog.its_body"), text: t("components.pixa_wallet_supra_info_dialog.the_creative_economy_pxa_pxp_artworks_and_publications")},
        {organ: t("components.pixa_wallet_supra_info_dialog.its_soul"), text: t("components.pixa_wallet_supra_info_dialog.its_own_energy_in_flow_harmonised_by")},
    ],
});
const buildSiblingChips = () => [t("components.pixa_wallet_supra_info_dialog.no_shared_body"), t("components.pixa_wallet_supra_info_dialog.no_shared_mind"), t("components.pixa_wallet_supra_info_dialog.no_value_drawn")];

const buildGrammarRows = () => [
    {stable: t("components.pixa_wallet_supra_info_dialog.peg"), stableGloss: t("components.pixa_wallet_supra_info_dialog.bound_to_a_fiat_unit_defended_at"), supra: t("words.oracle"), supraGloss: t("components.pixa_wallet_supra_info_dialog.a_mental_compass_oriented_not_pegged")},
    {stable: t("components.pixa_wallet_supra_info_dialog.reserve"), stableGloss: t("components.pixa_wallet_supra_info_dialog.a_fiat_stockpile_held_against_the_supply"), supra: t("words.atlas"), supraGloss: t("components.pixa_wallet_supra_info_dialog.the_body_the_network_already_runs_on")},
    {stable: t("components.pixa_wallet_supra_info_dialog.defence"), stableGloss: t("components.pixa_wallet_supra_info_dialog.mints_or_burns_to_force_a_number"), supra: t("words.haircut"), supraGloss: t("components.pixa_wallet_supra_info_dialog.tells_the_truth_about_the_body_defends")},
    {stable: t("components.pixa_wallet_supra_info_dialog.issuer"), stableGloss: t("components.pixa_wallet_supra_info_dialog.an_entity_that_stands_behind_it_at"), supra: t("components.pixa_wallet_supra_info_dialog.no_issuer"), supraGloss: t("components.pixa_wallet_supra_info_dialog.bound_only_to_consensus_no_party_can")},
    {stable: t("components.pixa_wallet_supra_info_dialog.banking_risk"), stableGloss: t("components.pixa_wallet_supra_info_dialog.fails_when_the_reserve_fails"), supra: t("components.pixa_wallet_supra_info_dialog.no_banking_risk"), supraGloss: t("components.pixa_wallet_supra_info_dialog.nothing_references_the_banking_system")},
];

// Anatomy chip: which organ this dialog is about.
// Built per render, not held in module consts: a const resolves t() once when
// this chunk is parsed and freezes the copy in that locale.
const buildAnatomy = () => [
    {key: "mind", label: t("words.mind"), sub: t("words.oracle"), Icon: ExploreRounded},
    {key: "body", label: t("words.body"), sub: t("words.atlas"), Icon: FitnessCenterRounded},
    {key: "consciousness", label: t("words.consciousness"), sub: t("words.supra"), Icon: BlurOnRounded},
    {key: "soul", label: t("words.soul"), sub: t("words.macro"), Icon: AllInclusiveRounded},
];

class PixaWalletSupraInfoDialog extends React.Component {

    _handle_backdrop_click = () => {
        if (this.props.onClose) this.props.onClose();
    };

    render() {
        const FIAT_CREATURE = buildFiatCreature();
        const SUPRA_CREATURE = buildSupraCreature();
        const {classes, open} = this.props;
        const active = "consciousness";

        const card = (
            <Card elevation={4} className={classes.dialogCard}>
                <DialogTitle disableTypography className={classes.dialogTitle}>
                    <Typography component={"div"}>
                        <div className={classes.titleIconWrap}>
                            <PixaSupra style={{transform: "scale(0.85)"}}/>
                        </div>
                        <div className={classes.titleText}>
                            <span>{t("components.pixa_wallet_supra_info_dialog.pixa_supra_pxs")}</span>
                            <span className={classes.titleSub}>{t("components.pixa_wallet_supra_info_dialog.a_coin_with_its_own_body_mind")}</span>
                        </div>
                    </Typography>
                    <IconButton aria-label={t("words.close")} className={classes.closeButton} onClick={() => this.props.onClose && this.props.onClose()}>
                        <CloseRounded/>
                    </IconButton>
                </DialogTitle>

                <DialogContent className={classes.dialogContent}>

                    {/* ───── Hero ───── */}
                    <Fade appear in={!!open} timeout={500} style={{transitionDelay: "200ms"}}>
                    <div className={classes.hero}>
                        <Typography component={"h2"} className={classes.heroTitle}><T
                                k="components.pixa_wallet_supra_info_dialog.pxs_is_what_you_0_hold_0"
                                slots={[
                                    <span className={classes.heroAccent} key="0" />,
                                    <span className={classes.heroAccent} key="1" />
                                ]} /></Typography>
                        <Typography component={"p"} className={classes.heroBody}><T
                                k="components.pixa_wallet_supra_info_dialog.a_supracoin_is_a_living_thing_rendered"
                                slots={[
                                    <span className={classes.heroBodyEmphasis} key="0" />,
                                    <span className={classes.heroBodyEmphasis} key="1" />,
                                    <span className={classes.heroBodyEmphasis} key="2" />,
                                    <span className={classes.heroBodyEmphasis} key="3" />,
                                    <span className={classes.heroBodyEmphasis} key="4" />,
                                    <span className={classes.heroBodyEmphasis} key="5" />
                                ]} /></Typography>

                        <div className={classes.statRow}>
                            <div className={classes.statCell}>
                                <span className={classes.statValue}>3 – 10 ×</span>
                                <span className={classes.statLabel}>{t("components.pixa_wallet_supra_info_dialog.body_over_the_weight")}</span>
                            </div>
                            <div className={classes.statCell}>
                                <span className={classes.statValue}>21 × 84</span>
                                <span className={classes.statLabel}>{t("components.pixa_wallet_supra_info_dialog.readings_in_the_compass")}</span>
                            </div>
                            <div className={classes.statCell}>
                                <span className={classes.statValue}>{t("components.pixa_wallet_supra_info_dialog.no_issuer")}</span>
                                <span className={classes.statLabel}>{t("components.pixa_wallet_supra_info_dialog.minted_only_by_converting_pxa")}</span>
                            </div>
                        </div>

                        <div className={classes.anatomyChip}>
                            {buildAnatomy().map((a) => {
                                const isActive = a.key === active;
                                return (
                                    <div key={a.key} className={`${classes.anatomyNode} ${isActive ? classes.anatomyNodeActive : ''}`}>
                                        <div className={`${classes.anatomyIcon} ${isActive ? classes.anatomyIconActive : ''}`}><a.Icon/></div>
                                        <span className={`${classes.anatomyLabel} ${isActive ? classes.anatomyLabelActive : ''}`}>{a.label}</span>
                                        <span className={classes.anatomySub}>{a.sub}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    </Fade>

                    {/* ───── 01 · Anatomy ───── */}
                    <Fade appear in={!!open} timeout={500} style={{transitionDelay: "400ms"}}>
                    <div className={classes.section}>
                        <div className={classes.sectionHeader}>
                            <span className={classes.chapterNum}>01</span>
                            <Typography component={"h3"} className={classes.sectionTitle}>{t("components.pixa_wallet_supra_info_dialog.anatomy_of_a_living_coin")}</Typography>
                        </div>
                        <Typography component={"p"} className={classes.sectionSubtitle}><T
                                k="components.pixa_wallet_supra_info_dialog.four_parts_one_system_and_pxs_is"
                                slots={[<span className={classes.bodyEmphasis} key="0" />]} /></Typography>
                        <div className={classes.organGrid}>
                            {buildOrgans().map((o) => (
                                <div key={o.name} className={classes.organCard}>
                                    <div className={classes.organIcon}><o.Icon/></div>
                                    <span className={classes.organFaculty}>{o.faculty}</span>
                                    <Typography component={"h4"} className={classes.organName}>{o.name}</Typography>
                                    <span className={classes.organNature}>{o.nature}</span>
                                    <Typography component={"p"} className={classes.organBody}>{o.body}</Typography>
                                </div>
                            ))}
                        </div>
                        <div className={classes.relationStrip}>
                            {buildRelation().map((r, i) => (
                                <React.Fragment key={r.word}>
                                    <div className={classes.relationItem}>
                                        <span className={classes.relationWord}>{r.word}</span>
                                        <span className={classes.relationVerb}>{r.verb}</span>
                                    </div>
                                    {i < buildRelation().length - 1 && (
                                        <span className={classes.relationArrow}><ArrowForwardRounded/></span>
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                    </Fade>

                    {/* ───── 02 · The Mind ───── */}
                    <Fade appear in={!!open} timeout={500} style={{transitionDelay: "600ms"}}>
                    <div className={classes.section}>
                        <div className={classes.sectionHeader}>
                            <span className={classes.chapterNum}>02</span>
                            <span className={classes.sectionIcon}><ExploreRounded/></span>
                            <Typography component={"h3"} className={classes.sectionTitle}>{t("components.pixa_wallet_supra_info_dialog.the_mind_oracle")}</Typography>
                        </div>
                        <Typography component={"p"} className={classes.pullQuote}>{t("components.pixa_wallet_supra_info_dialog.a_compass_not_a_peg")}</Typography>
                        <Typography component={"p"} className={classes.sectionSubtitle}><T
                                k="components.pixa_wallet_supra_info_dialog.the_mind_is_mental_bound_to_no"
                                slots={[<span className={classes.bodyEmphasis} key="0" />]} /></Typography>
                        <div className={classes.flowGrid}>
                            {buildPipeline().map((n, i) => (
                                <React.Fragment key={n.title}>
                                    <div className={`${classes.flowNode} ${n.highlight ? classes.flowNodeHighlight : ''}`}>
                                        <div className={classes.stepHeadline}>
                                            <n.Icon/>
                                            <Typography component={"h4"} className={classes.flowNodeTitle}>{n.title}</Typography>
                                            <span className={classes.flowNodeBadge}>{n.badge}</span>
                                        </div>
                                        <Typography component={"p"} className={classes.flowNodeBody}>{n.body}</Typography>
                                    </div>
                                    {i < buildPipeline().length - 1 && (
                                        <div className={classes.flowArrow}><ArrowDownwardRounded/></div>
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                    </Fade>

                    {/* ───── 03 · The Body ───── */}
                    <Fade appear in={!!open} timeout={500} style={{transitionDelay: "800ms"}}>
                    <div className={classes.section}>
                        <div className={classes.sectionHeader}>
                            <span className={classes.chapterNum}>03</span>
                            <span className={classes.sectionIcon}><FitnessCenterRounded/></span>
                            <Typography component={"h3"} className={classes.sectionTitle}>{t("components.pixa_wallet_supra_info_dialog.the_body_atlas")}</Typography>
                        </div>
                        <Typography component={"p"} className={classes.sectionSubtitle}><T
                                k="components.pixa_wallet_supra_info_dialog.the_body_is_0_pxa_pxp_0"
                                slots={[
                                    <span className={classes.bodyEmphasis} key="0" />,
                                    <span className={classes.bodyEmphasis} key="1" />,
                                    <span className={classes.bodyEmphasis} key="2" />,
                                    <span className={classes.bodyEmphasis} key="3" />
                                ]} /></Typography>
                        <div className={classes.gaugeCard}>
                            <div className={classes.gaugeLegend}>
                                <div className={classes.gaugeLegendItem}>
                                    <span className={classes.gaugeLegendKicker}>{t("components.pixa_wallet_supra_info_dialog.floor_30_spent")}</span>
                                    <span className={classes.gaugeLegendValue}>3 ×</span>
                                </div>
                                <div className={classes.gaugeLegendItem}>
                                    <span className={classes.gaugeLegendKicker}>{t("components.pixa_wallet_supra_info_dialog.design_target")}</span>
                                    <span className={classes.gaugeLegendValue}>5 – 7 ×</span>
                                </div>
                                <div className={classes.gaugeLegendItem}>
                                    <span className={classes.gaugeLegendKicker}>{t("components.pixa_wallet_supra_info_dialog.deep_capacity_10_spent")}</span>
                                    <span className={classes.gaugeLegendValue}>10 ×</span>
                                </div>
                            </div>
                            <div className={classes.gaugeBarWrap}>
                                <div className={classes.gaugeTrack}>
                                    <div className={classes.gaugeTired}/>
                                    <div className={classes.gaugeHonoured}/>
                                    <div className={classes.gaugeTarget}/>
                                </div>
                                <div className={classes.gaugeFloor}/>
                                <div className={classes.gaugeMarker}>
                                    <span className={classes.gaugeMarkerLabel}>{t("components.pixa_wallet_supra_info_dialog.design_target_2")}</span>
                                    <span className={classes.gaugeMarkerDot}/>
                                </div>
                                <span className={classes.gaugeTick} style={{left: "10%", transform: "translateX(-50%)"}}>{t("components.pixa_wallet_supra_info_dialog.1_the_weight")}</span>
                                <span className={classes.gaugeTick} style={{left: "30%", transform: "translateX(-50%)"}}>{t("components.pixa_wallet_supra_info_dialog.3_floor")}</span>
                                <span className={classes.gaugeTick} style={{left: "100%", transform: "translateX(-92%)"}}>{t("components.pixa_wallet_supra_info_dialog.10_capacity")}</span>
                            </div>
                            <Typography component={"p"} className={classes.gaugeBody}>
                                {t(
                                    "components.pixa_wallet_supra_info_dialog.the_hatched_band_is_the_tired_zone"
                                )}
                            </Typography>
                        </div>
                    </div>
                    </Fade>

                    {/* ───── 04 · The Consciousness ───── */}
                    <Fade appear in={!!open} timeout={500} style={{transitionDelay: "1000ms"}}>
                    <div className={classes.section}>
                        <div className={classes.sectionHeader}>
                            <span className={classes.chapterNum}>04</span>
                            <span className={classes.sectionIcon}><BlurOnRounded/></span>
                            <Typography component={"h3"} className={classes.sectionTitle}>{t("components.pixa_wallet_supra_info_dialog.the_consciousness_supra")}</Typography>
                        </div>
                        <Typography component={"p"} className={classes.sectionSubtitle}>
                            {t(
                                "components.pixa_wallet_supra_info_dialog.the_supra_is_a_projection_riding_on"
                            )}
                        </Typography>
                        <div className={classes.conceptCard}>
                            <Typography component={"p"} className={classes.conceptLead}>
                                {t(
                                    "components.pixa_wallet_supra_info_dialog.hold_pxs_and_you_hold_the_projection"
                                )}
                            </Typography>
                            <Typography component={"p"} className={classes.conceptBody}>
                                {t("components.pixa_wallet_supra_info_dialog.when_you_settle_the_body_is_delivered")}
                            </Typography>
                        </div>
                    </div>
                    </Fade>

                    {/* ───── 05 · The Soul ───── */}
                    <Fade appear in={!!open} timeout={500} style={{transitionDelay: "1200ms"}}>
                    <div className={classes.section}>
                        <div className={classes.sectionHeader}>
                            <span className={classes.chapterNum}>05</span>
                            <span className={classes.sectionIcon}><ContentCutRounded/></span>
                            <Typography component={"h3"} className={classes.sectionTitle}>{t("components.pixa_wallet_supra_info_dialog.the_soul_macro")}</Typography>
                        </div>
                        <Typography component={"p"} className={classes.pullQuote}>{t("components.pixa_wallet_supra_info_dialog.pixa_never_defends_pixa_adjusts")}</Typography>
                        <Typography component={"p"} className={classes.sectionSubtitle}><T
                                k="components.pixa_wallet_supra_info_dialog.the_macro_is_energy_in_flow_not"
                                slots={[
                                    <span className={classes.bodyEmphasis} key="0" />,
                                    <span className={classes.bodyEmphasis} key="1" />,
                                    <span className={classes.bodyEmphasis} key="2" />
                                ]} /></Typography>
                        <div className={classes.regimeGrid}>
                            {buildRegimes().map((t) => (
                                <div key={t.title} className={`${classes.regimeCard} ${t.highlight ? classes.regimeCardHighlight : ''}`}>
                                    <div className={classes.regimeHeader}>
                                        <Typography component={"h4"} className={classes.regimeTitle}>{t.title}</Typography>
                                        <span className={classes.regimeRange}>{t.range}</span>
                                    </div>
                                    <Typography component={"p"} className={classes.regimeBody}>{t.body}</Typography>
                                </div>
                            ))}
                        </div>
                        <div className={classes.chartCard}>
                            <ResponsiveContainer width="100%" height={230}>
                                <AreaChart data={HAIRCUT_DATA} margin={{top: 8, right: 16, left: -8, bottom: 0}}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#222"/>
                                    <XAxis dataKey="r" tick={{fill: '#888', fontSize: 11}} axisLine={false} tickLine={false}/>
                                    <YAxis tick={{fill: '#888', fontSize: 11}} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} domain={[0, 100]}/>
                                    <ReferenceArea x1="3×" x2="10×" y1={0} y2={100} fill="#1a1a1a" fillOpacity={0.7}/>
                                    <TooltipChart content={<_HaircutTooltip/>} cursor={{stroke: '#444', strokeWidth: 1}}/>
                                    <Legend verticalAlign="top" height={28} iconType="circle" iconSize={8} wrapperStyle={{color: '#a5a5a5', fontSize: 11}}/>
                                    <Area type="linear" name={t("components.pixa_wallet_supra_info_dialog.delivered")} dataKey="payout" stackId="1" stroke="#ffffff" strokeWidth={2} fill="#2a2a2a" fillOpacity={1}/>
                                    <Area type="linear" name={t("components.pixa_wallet_supra_info_dialog.held_back_by_haircut")} dataKey="withheld" stackId="1" stroke="#888" strokeWidth={2} fill="#121212" fillOpacity={1} strokeDasharray="5 4"/>
                                </AreaChart>
                            </ResponsiveContainer>
                            <Typography component={"p"} className={classes.chartLabel}>
                                {t(
                                    "components.pixa_wallet_supra_info_dialog.the_haircut_across_the_bodys_strength_shaded"
                                )}
                            </Typography>
                        </div>
                    </div>
                    </Fade>

                    {/* ───── 06 · Beside fiat ───── */}
                    <Fade appear in={!!open} timeout={500} style={{transitionDelay: "1400ms"}}>
                    <div className={classes.section}>
                        <div className={classes.sectionHeader}>
                            <span className={classes.chapterNum}>06</span>
                            <span className={classes.sectionIcon}><CompareArrowsRounded/></span>
                            <Typography component={"h3"} className={classes.sectionTitle}>{t("components.pixa_wallet_supra_info_dialog.beside_fiat_never_within_it")}</Typography>
                        </div>
                        <Typography component={"p"} className={classes.pullQuote}>{t("components.pixa_wallet_supra_info_dialog.a_sibling_not_a_twin")}</Typography>
                        <Typography component={"p"} className={classes.sectionSubtitle}><T
                                k="components.pixa_wallet_supra_info_dialog.fiat_is_itself_a_living_being_its"
                                slots={[
                                    <span className={classes.bodyEmphasis} key="0" />,
                                    <span className={classes.bodyEmphasis} key="1" />
                                ]} /></Typography>
                        <div className={classes.siblingWrap}>
                            <div className={classes.creatureCard}>
                                <div className={classes.creatureHead}>
                                    <FIAT_CREATURE.Icon/>
                                    <div>
                                        <Typography component={"h4"} className={classes.creatureTitle}>{FIAT_CREATURE.title}</Typography>
                                        <span className={classes.creatureKicker}>{FIAT_CREATURE.kicker}</span>
                                    </div>
                                </div>
                                {FIAT_CREATURE.rows.map((row) => (
                                    <div key={row.organ} className={classes.creatureRow}>
                                        <span className={classes.creatureOrgan}>{row.organ}</span>
                                        <Typography component={"p"} className={classes.creatureText}>{row.text}</Typography>
                                    </div>
                                ))}
                            </div>
                            <div className={classes.siblingDivider}>
                                <div className={classes.siblingBar}/>
                                <span className={classes.siblingSymbol}>∥</span>
                                {buildSiblingChips().map((c) => (<span key={c} className={classes.siblingChip}>{c}</span>))}
                                <div className={classes.siblingBar}/>
                            </div>
                            <div className={classes.creatureCard}>
                                <div className={classes.creatureHead}>
                                    <SUPRA_CREATURE.Icon style={{transform: "scale(0.85)"}}/>
                                    <div>
                                        <Typography component={"h4"} className={classes.creatureTitle}>{SUPRA_CREATURE.title}</Typography>
                                        <span className={classes.creatureKicker}>{SUPRA_CREATURE.kicker}</span>
                                    </div>
                                </div>
                                {SUPRA_CREATURE.rows.map((row) => (
                                    <div key={row.organ} className={classes.creatureRow}>
                                        <span className={classes.creatureOrgan}>{row.organ}</span>
                                        <Typography component={"p"} className={classes.creatureText}>{row.text}</Typography>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    </Fade>

                    {/* ───── 07 · Not a stablecoin ───── */}
                    <Fade appear in={!!open} timeout={500} style={{transitionDelay: "1600ms"}}>
                    <div className={classes.section}>
                        <div className={classes.sectionHeader}>
                            <span className={classes.chapterNum}>07</span>
                            <span className={classes.sectionIcon}><RestaurantRounded/></span>
                            <Typography component={"h3"} className={classes.sectionTitle}>{t("components.pixa_wallet_supra_info_dialog.why_this_is_not_a_stablecoin")}</Typography>
                        </div>
                        <Typography component={"p"} className={classes.sectionSubtitle}>
                            {t(
                                "components.pixa_wallet_supra_info_dialog.two_grammars_that_dont_translate_the_words"
                            )}
                        </Typography>
                        <div className={classes.grammarWrap}>
                            <div className={classes.grammarHead}>
                                <span className={classes.grammarHeadCell}>{t("components.pixa_wallet_supra_info_dialog.a_stablecoin_says")}</span>
                                <span className={classes.grammarHeadCell}>{t("components.pixa_wallet_supra_info_dialog.the_supra_says")}</span>
                            </div>
                            {buildGrammarRows().map((row, i) => (
                                <div key={row.supra} className={`${classes.grammarRow} ${i % 2 === 0 ? classes.grammarRowAlt : ''}`}>
                                    <div>
                                        <div className={classes.grammarTermMuted}>{row.stable}</div>
                                        <div className={classes.grammarGlossMuted}>{row.stableGloss}</div>
                                    </div>
                                    <div>
                                        <div className={classes.grammarTerm}>{row.supra}</div>
                                        <div className={classes.grammarGloss}>{row.supraGloss}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    </Fade>

                    {/* ───── 08 · The serious bit ───── */}
                    <Fade appear in={!!open} timeout={500} style={{transitionDelay: "1800ms"}}>
                    <div className={classes.section}>
                        <div className={classes.sectionHeader}>
                            <span className={classes.chapterNum}>08</span>
                            <span className={classes.sectionIcon}><GavelRounded/></span>
                            <Typography component={"h3"} className={classes.sectionTitle}>{t("words.the_serious_bit")}</Typography>
                        </div>
                        <div className={classes.classificationCard}>
                            <span className={classes.classificationKicker}>{t("words.the_position")}</span>
                            <Typography component={"p"} className={classes.classificationStatement}>
                                {t(
                                    "components.pixa_wallet_supra_info_dialog.pxs_is_a_supracoin_a_category_of"
                                )}
                            </Typography>
                            <Typography component={"p"} className={classes.classificationBody}><T
                                    k="components.pixa_wallet_supra_info_dialog.oriented_to_an_ideal_of_purchasing_power"
                                    slots={[
                                        <span className={classes.bodyEmphasis} key="0" />,
                                        <span className={classes.bodyEmphasis} key="1" />
                                    ]} /></Typography>
                        </div>
                        <div className={classes.conceptCard}>
                            <Typography component={"p"} className={classes.conceptLead}>
                                {t(
                                    "components.pixa_wallet_supra_info_dialog.this_design_does_not_remove_risk_it"
                                )}
                            </Typography>
                            <Typography component={"p"} className={classes.conceptBody}>
                                {t("components.pixa_wallet_supra_info_dialog.no_monetary_mechanism_removes_risk_a_stablecoin_concentrates")}
                            </Typography>
                        </div>
                    </div>
                    </Fade>

                    <Fade appear in={!!open} timeout={500} style={{transitionDelay: "2000ms"}}>
                    <div className={classes.footnote}>
                        {t(
                            "components.pixa_wallet_supra_info_dialog.the_oracle_senses_the_atlas_bears_the"
                        )}<br/>
                        <span className={classes.footnoteAccent}>{t("components.pixa_wallet_supra_info_dialog.inherit_eternity_shape_infinity")}</span>
                    </div>
                    </Fade>
                </DialogContent>
            </Card>
        );

        return (
            <Portal>
                <Backdrop open={!!open} className={classes.backdrop}>
                    <div style={{width: "100%", height: "100%", position: "absolute"}} onClick={this._handle_backdrop_click}/>
                    <Fade in={!!open} timeout={400}>
                        {card}
                    </Fade>
                </Backdrop>
            </Portal>
        );
    }
}

export default withLanguage(withStyles(styles)(PixaWalletSupraInfoDialog));