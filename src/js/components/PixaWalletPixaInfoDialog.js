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
import CompareArrowsRounded from "@material-ui/icons/CompareArrowsRounded";
import WidgetsRounded from "@material-ui/icons/WidgetsRounded";
import PieChartRounded from "@material-ui/icons/PieChartRounded";
import GavelRounded from "@material-ui/icons/GavelRounded";
import OpacityRounded from "@material-ui/icons/OpacityRounded";
import AcUnitRounded from "@material-ui/icons/AcUnitRounded";
import SwapHorizRounded from "@material-ui/icons/SwapHorizRounded";
import StorefrontRounded from "@material-ui/icons/StorefrontRounded";
import PaletteRounded from "@material-ui/icons/PaletteRounded";
import ArrowForwardRounded from "@material-ui/icons/ArrowForwardRounded";
import ArrowBackRounded from "@material-ui/icons/ArrowBackRounded";
import PixaLiquid from "../icons/PixaLiquid";

import {ResponsiveContainer} from 'recharts/lib/component/ResponsiveContainer';
import {PieChart} from 'recharts/lib/chart/PieChart';
import {Pie} from 'recharts/lib/polar/Pie';
import {Cell} from 'recharts/lib/component/Cell';
import {Tooltip as TooltipChart} from 'recharts/lib/component/Tooltip';

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

    // ── Phase diagram (shared with PXP) ────────────────────────────────────────
    phaseCard: {backgroundColor: "#0a0a0a", borderRadius: 20, padding: "20px", margin: "8px 0"},
    phaseGrid: {display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "stretch", [theme.breakpoints.down("xs")]: {gridTemplateColumns: "1fr"}},
    phaseNode: {
        backgroundColor: "#111", borderRadius: 16, padding: "18px 16px",
        display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 6,
        transition: "background-color 180ms cubic-bezier(0.4, 0, 0.2, 1), color 180ms cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": {backgroundColor: "#181818"},
    },
    phaseNodeActive: {backgroundColor: "#1a1a1a"},
    phaseIcon: {
        width: 46, height: 46, borderRadius: "50%", backgroundColor: "#0a0a0a",
        display: "flex", alignItems: "center", justifyContent: "center",
        "& svg": {width: 24, height: 24, fill: "#ffffff"},
    },
    phaseIconActive: {backgroundColor: "#ffffff", "& svg": {fill: "#000"}},
    phaseToken: {fontFamily: TITLE_FONT, fontSize: "1.15rem", fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1.1},
    phasePhase: {fontFamily: TITLE_FONT, fontSize: "0.6rem", color: "#888", letterSpacing: "0.1em", textTransform: "uppercase"},
    phaseDesc: {fontSize: "0.76rem", color: "#a5a5a5", lineHeight: 1.45, margin: "2px 0 0 0"},
    phaseMid: {display: "flex", flexDirection: "column", justifyContent: "center", gap: 10, padding: "4px 0"},
    phaseLane: {display: "flex", flexDirection: "column", alignItems: "center", gap: 3, backgroundColor: "#161616", borderRadius: 12, padding: "9px 12px", minWidth: 132},
    phaseLaneArrow: {display: "flex", alignItems: "center", gap: 6, "& svg": {width: 18, height: 18, fill: "#fff"}},
    phaseLaneWord: {fontFamily: TITLE_FONT, fontSize: "0.74rem", fontWeight: 700, color: "#fff", letterSpacing: "0.04em", textTransform: "uppercase"},
    phaseLaneSub: {fontSize: "0.6rem", color: "#888", letterSpacing: "0.04em", textTransform: "uppercase", lineHeight: 1.3, textAlign: "center"},
    phaseFooter: {textAlign: "center", marginTop: 16, fontSize: "0.8rem", color: "#a5a5a5", lineHeight: 1.5},
    phaseFooterAccent: {fontFamily: TITLE_FONT, color: "#fff", letterSpacing: "0.03em"},

    // ── Job grid ───────────────────────────────────────────────────────────────
    jobGrid: {display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, [theme.breakpoints.down("xs")]: {gridTemplateColumns: "1fr"}},
    jobCard: {
        backgroundColor: "#111", borderRadius: 16, padding: "16px 16px",
        display: "flex", flexDirection: "column", gap: 6,
        transition: "background-color 180ms cubic-bezier(0.4, 0, 0.2, 1), color 180ms cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": {backgroundColor: "#181818"},
    },
    jobIcon: {
        width: 36, height: 36, borderRadius: "50%", backgroundColor: "#0a0a0a",
        display: "flex", alignItems: "center", justifyContent: "center",
        "& svg": {width: 20, height: 20, fill: "#fff"},
    },
    jobTitle: {fontFamily: TITLE_FONT, fontSize: "0.95rem", fontWeight: 600, color: "#fff", margin: 0, lineHeight: 1.2},
    jobBody: {fontSize: "0.8rem", color: "#a5a5a5", lineHeight: 1.5, margin: 0},

    // ── Chart card + donut legend ────────────────────────────────────────────────
    chartCard: {backgroundColor: "#0a0a0a", borderRadius: 20, padding: "16px 12px 12px", margin: "8px 0"},
    chartLabel: {fontSize: "0.78rem", color: "#a5a5a5", textAlign: "center", marginTop: 6, lineHeight: 1.5},
    pieLegend: {display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 14, marginTop: 4},
    pieLegendItem: {display: "flex", alignItems: "center", gap: 6},
    pieSwatch: {width: 10, height: 10, borderRadius: 2, flexShrink: 0},
    pieLegendLabel: {fontSize: "0.74rem", color: "#a5a5a5"},
    pieLegendPct: {fontFamily: TITLE_FONT, fontSize: "0.74rem", color: "#fff", fontWeight: 600},

    // ── Classification card ──────────────────────────────────────────────────────
    classificationCard: {backgroundColor: "#1a1a1a", borderRadius: 20, padding: "20px 22px", margin: "8px 0", display: "flex", flexDirection: "column", gap: 10},
    classificationKicker: {fontFamily: TITLE_FONT, fontSize: "0.62rem", color: "#888", letterSpacing: "0.1em", textTransform: "uppercase"},
    classificationStatement: {fontFamily: TITLE_FONT, fontSize: "1.15rem", fontWeight: 600, color: "#ffffff", lineHeight: 1.3, margin: 0, [theme.breakpoints.down("sm")]: {fontSize: "1rem"}},
    classificationBody: {fontSize: "0.85rem", color: "#c7c7c7", lineHeight: 1.6, margin: 0},

    footnote: {margin: "26px 0 4px 0", padding: "16px 18px", backgroundColor: "#0a0a0a", borderRadius: 16, fontSize: "0.78rem", color: "#888", lineHeight: 1.6, textAlign: "center"},
    footnoteAccent: {fontFamily: TITLE_FONT, color: "#ffffff", letterSpacing: "0.04em"},
});

// ── Greyscale recharts tooltip ──────────────────────────────────────────────
const _PieTooltip = ({active, payload}) => {
    if (!active || !payload || !payload.length) return null;
    const p = payload[0];
    return (
        <div style={{background: '#1e1e1e', color: '#ffffff', borderRadius: 8, padding: 10, fontSize: 12, lineHeight: 1.5}}>
            <span style={{display: "inline-block", width: 8, height: 8, borderRadius: 2, background: p.payload.fill, marginRight: 6, verticalAlign: "middle"}}/>
            <strong>{p.name}</strong>: {Number(p.value)}%
        </div>
    );
};

// ── Static, illustrative model data (not live values) ───────────────────────
const buildAnatomy = () => [
    {key: "mind", label: t("words.mind"), sub: t("words.oracle"), Icon: ExploreRounded},
    {key: "body", label: t("words.body"), sub: t("words.atlas"), Icon: FitnessCenterRounded},
    {key: "consciousness", label: t("words.consciousness"), sub: t("words.supra"), Icon: BlurOnRounded},
    {key: "soul", label: t("words.soul"), sub: t("words.macro"), Icon: AllInclusiveRounded},
];

// Built per render, not held in a module const: a const resolves t() once when
// this chunk is parsed and freezes the copy in that locale, so a language change
// in Settings would never reach it.
const buildJobs = () => [
    {title: t("components.pixa_wallet_pixa_info_dialog.the_transfer_rail"), body: t("components.pixa_wallet_pixa_info_dialog.the_fee_light_medium_the_whole_network_moves"), Icon: SwapHorizRounded},
    {title: t("components.pixa_wallet_pixa_info_dialog.marketplace_unit_royalties"), body: t("components.pixa_wallet_pixa_info_dialog.pixel_art_nfts_are_priced_and_traded_in"), Icon: StorefrontRounded},
    {title: t("components.pixa_wallet_pixa_info_dialog.the_gateway_to_pxp"), body: t("components.pixa_wallet_pixa_info_dialog.power_up_and_pxa_freezes_one_for_one"), Icon: AcUnitRounded},
    {title: t("components.pixa_wallet_pixa_info_dialog.where_the_supra_lands"), body: t("components.pixa_wallet_pixa_info_dialog.when_a_supra_settles_the_body_is_delivered"), Icon: BlurOnRounded},
    {title: t("components.pixa_wallet_pixa_info_dialog.pay_for_the_work"), body: t("components.pixa_wallet_pixa_info_dialog.protocol_emission_reaches_authors_curators_and_witnesses_as"), Icon: PaletteRounded},
];

// Pixagram mainnet inflation split (launch checklist, Q3, agreed 70/0/15/15):
// content rewards ~70% (creators 60% / curators 40%), witnesses 15%, DPF 15%,
// and 0% to stakers — staker interest is eliminated. Slowly-decreasing schedule.
const buildEmission = () => [
    {id: "creators",  name: t("words.creators"),  value: 42, fill: "#ffffff"},
    {id: "curators",  name: t("words.curators"),  value: 28, fill: "#b8b8b8"},
    {id: "witnesses", name: t("words.witnesses"), value: 15, fill: "#7e7e7e"},
    {id: "dpf",       name: "Pixa Fund \u00b7 DPF", value: 15, fill: "#4a4a4a"},
];

class PixaWalletPixaInfoDialog extends React.Component {

    _handle_backdrop_click = () => {
        if (this.props.onClose) this.props.onClose();
    };

    render() {
        const {classes, open} = this.props;
        const active = "body";

        const card = (
            <Card elevation={4} className={classes.dialogCard}>
                <DialogTitle disableTypography className={classes.dialogTitle}>
                    <Typography component={"div"}>
                        <div className={classes.titleIconWrap}>
                            <PixaLiquid style={{transform: "scale(0.85)"}}/>
                        </div>
                        <div className={classes.titleText}>
                            <span>{t("components.pixa_wallet_pixa_info_dialog.pixa_liquid_pxa")}</span>
                            <span className={classes.titleSub}>{t(
                                "components.pixa_wallet_pixa_info_dialog.the_body_flowing_the_liquid_phase"
                            )}</span>
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
                                k="components.pixa_wallet_pixa_info_dialog.pxa_is_the_body_0_flowing_0"
                                slots={[
                                    <span className={classes.heroAccent} key="0" />,
                                    <span className={classes.heroAccent} key="1" />
                                ]} /></Typography>
                        <Typography component={"p"} className={classes.heroBody}><T
                                k="components.pixa_wallet_pixa_info_dialog.pixa_is_one_living_being_and_pxa"
                                slots={[
                                    <span className={classes.heroBodyEmphasis} key="0" />,
                                    <span className={classes.heroBodyEmphasis} key="1" />,
                                    <span className={classes.heroBodyEmphasis} key="2" />,
                                    <span className={classes.heroBodyEmphasis} key="3" />,
                                    <span className={classes.heroBodyEmphasis} key="4" />
                                ]} /></Typography>

                        <div className={classes.statRow}>
                            <div className={classes.statCell}>
                                <span className={classes.statValue}>1 : 1</span>
                                <span className={classes.statLabel}>{t("components.pixa_wallet_pixa_info_dialog.freezes_to_pxp_instant")}</span>
                            </div>
                            <div className={classes.statCell}>
                                <span className={classes.statValue}>{t("components.pixa_wallet_pixa_info_dialog.pxa_pxp")}</span>
                                <span className={classes.statLabel}>{t("components.pixa_wallet_pixa_info_dialog.together_the_atlas_the_body")}</span>
                            </div>
                            <div className={classes.statCell}>
                                <span className={classes.statValue}>{t("components.pixa_wallet_pixa_info_dialog.no_claim")}</span>
                                <span className={classes.statLabel}>{t("components.pixa_wallet_pixa_info_dialog.on_pixagram_sa_not_equity")}</span>
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

                    {/* ───── 01 · Two phases of one body ───── */}
                    <Fade appear in={!!open} timeout={500} style={{transitionDelay: "400ms"}}>
                    <div className={classes.section}>
                        <div className={classes.sectionHeader}>
                            <span className={classes.chapterNum}>01</span>
                            <span className={classes.sectionIcon}><CompareArrowsRounded/></span>
                            <Typography component={"h3"} className={classes.sectionTitle}>{t("words.two_phases_of_one_body")}</Typography>
                        </div>
                        <Typography component={"p"} className={classes.sectionSubtitle}><T
                                k="components.pixa_wallet_pixa_info_dialog.power_up_and_pxa_0_freezes_0"
                                slots={[
                                    <span className={classes.bodyEmphasis} key="0" />,
                                    <span className={classes.bodyEmphasis} key="1" />,
                                    <span className={classes.bodyEmphasis} key="2" />
                                ]} /></Typography>
                        <div className={classes.phaseCard}>
                            <div className={classes.phaseGrid}>
                                <div className={`${classes.phaseNode} ${classes.phaseNodeActive}`}>
                                    <div className={`${classes.phaseIcon} ${classes.phaseIconActive}`}><OpacityRounded/></div>
                                    <Typography component={"h4"} className={classes.phaseToken}>PXA</Typography>
                                    <span className={classes.phasePhase}>{t("words.liquid_flowing")}</span>
                                    <Typography component={"p"} className={classes.phaseDesc}>{t(
                                        "words.spendable_now_the_medium_the_economy_moves"
                                    )}</Typography>
                                </div>
                                <div className={classes.phaseMid}>
                                    <div className={classes.phaseLane}>
                                        <span className={classes.phaseLaneArrow}><ArrowForwardRounded/></span>
                                        <span className={classes.phaseLaneWord}>{t("words.power_up")}</span>
                                        <span className={classes.phaseLaneSub}>{t("words.freeze_1_1_instant")}</span>
                                    </div>
                                    <div className={classes.phaseLane}>
                                        <span className={classes.phaseLaneArrow}><ArrowBackRounded/></span>
                                        <span className={classes.phaseLaneWord}>{t("words.power_down")}</span>
                                        <span className={classes.phaseLaneSub}>{t("words.melt_over_13_weeks")}</span>
                                    </div>
                                </div>
                                <div className={classes.phaseNode}>
                                    <div className={classes.phaseIcon}><AcUnitRounded/></div>
                                    <Typography component={"h4"} className={classes.phaseToken}>PXP</Typography>
                                    <span className={classes.phasePhase}>{t("words.solid_staked")}</span>
                                    <Typography component={"p"} className={classes.phaseDesc}>{t(
                                        "words.locked_to_give_the_body_weight_voice"
                                    )}</Typography>
                                </div>
                            </div>
                            <Typography component={"p"} className={classes.phaseFooter}>
                                <span className={classes.phaseFooterAccent}>{t("words.pxa_pxp_the_atlas")}</span> {t(
                                    "words.one_body_two_phases_liquid_to_move"
                                )}
                            </Typography>
                        </div>
                    </div>
                    </Fade>

                    {/* ───── 02 · What the liquid does ───── */}
                    <Fade appear in={!!open} timeout={500} style={{transitionDelay: "600ms"}}>
                    <div className={classes.section}>
                        <div className={classes.sectionHeader}>
                            <span className={classes.chapterNum}>02</span>
                            <span className={classes.sectionIcon}><WidgetsRounded/></span>
                            <Typography component={"h3"} className={classes.sectionTitle}>{t("components.pixa_wallet_pixa_info_dialog.what_the_liquid_does")}</Typography>
                        </div>
                        <Typography component={"p"} className={classes.sectionSubtitle}>
                            {t("components.pixa_wallet_pixa_info_dialog.pxa_is_the_working_liquid_of_the")}
                        </Typography>
                        <div className={classes.jobGrid}>
                            {buildJobs().map((j) => (
                                <div key={j.title} className={classes.jobCard}>
                                    <div className={classes.jobIcon}><j.Icon/></div>
                                    <Typography component={"h4"} className={classes.jobTitle}>{j.title}</Typography>
                                    <Typography component={"p"} className={classes.jobBody}>{j.body}</Typography>
                                </div>
                            ))}
                        </div>
                    </div>
                    </Fade>

                    {/* ───── 03 · Where the liquid comes from ───── */}
                    <Fade appear in={!!open} timeout={500} style={{transitionDelay: "800ms"}}>
                    <div className={classes.section}>
                        <div className={classes.sectionHeader}>
                            <span className={classes.chapterNum}>03</span>
                            <span className={classes.sectionIcon}><PieChartRounded/></span>
                            <Typography component={"h3"} className={classes.sectionTitle}>{t("components.pixa_wallet_pixa_info_dialog.where_the_liquid_comes_from")}</Typography>
                        </div>
                        <Typography component={"p"} className={classes.sectionSubtitle}><T
                                k="components.pixa_wallet_pixa_info_dialog.no_company_prints_pxa_the_protocol_0"
                                slots={[
                                    <span className={classes.bodyEmphasis} key="0" />,
                                    <span className={classes.bodyEmphasis} key="1" />,
                                    <span className={classes.bodyEmphasis} key="2" />
                                ]} /></Typography>
                        <div className={classes.chartCard}>
                            <ResponsiveContainer width="100%" height={236}>
                                <PieChart>
                                    <Pie data={buildEmission()} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={56} outerRadius={88} paddingAngle={2} stroke="#0a0a0a" strokeWidth={2}>
                                        {buildEmission().map((e) => (<Cell key={e.id} fill={e.fill}/>))}
                                    </Pie>
                                    <TooltipChart content={<_PieTooltip/>}/>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className={classes.pieLegend}>
                                {buildEmission().map((e) => (
                                    <div key={e.id} className={classes.pieLegendItem}>
                                        <span className={classes.pieSwatch} style={{background: e.fill}}/>
                                        <span className={classes.pieLegendLabel}>{e.name}</span>
                                        <span className={classes.pieLegendPct}>{e.value}%</span>
                                    </div>
                                ))}
                            </div>
                            <Typography component={"p"} className={classes.chartLabel}>
                                {t(
                                    "components.pixa_wallet_pixa_info_dialog.the_fixed_shares_of_new_emission_within"
                                )}
                            </Typography>
                        </div>
                    </div>
                    </Fade>

                    {/* ───── 04 · The serious bit ───── */}
                    <Fade appear in={!!open} timeout={500} style={{transitionDelay: "1000ms"}}>
                    <div className={classes.section}>
                        <div className={classes.sectionHeader}>
                            <span className={classes.chapterNum}>04</span>
                            <span className={classes.sectionIcon}><GavelRounded/></span>
                            <Typography component={"h3"} className={classes.sectionTitle}>{t("words.the_serious_bit")}</Typography>
                        </div>
                        <div className={classes.classificationCard}>
                            <span className={classes.classificationKicker}>{t("words.the_position")}</span>
                            <Typography component={"p"} className={classes.classificationStatement}>
                                {t(
                                    "components.pixa_wallet_pixa_info_dialog.pxa_is_the_liquid_equivalent_of_pxp"
                                )}
                            </Typography>
                            <Typography component={"p"} className={classes.classificationBody}>
                                {t("components.pixa_wallet_pixa_info_dialog.it_is_earned_through_protocol_emission_not")}
                            </Typography>
                        </div>
                    </div>
                    </Fade>

                    <Fade appear in={!!open} timeout={500} style={{transitionDelay: "1200ms"}}>
                    <div className={classes.footnote}>
                        {t(
                            "components.pixa_wallet_pixa_info_dialog.liquid_to_move_solid_to_govern_one"
                        )}<br/>
                        <span className={classes.footnoteAccent}>{t(
                            "components.pixa_wallet_pixa_info_dialog.liquid_by_design_durable_by_consensus"
                        )}</span>
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

export default withLanguage(withStyles(styles)(PixaWalletPixaInfoDialog));