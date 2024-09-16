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
import ScheduleRounded from "@material-ui/icons/ScheduleRounded";
import GavelRounded from "@material-ui/icons/GavelRounded";
import OpacityRounded from "@material-ui/icons/OpacityRounded";
import AcUnitRounded from "@material-ui/icons/AcUnitRounded";
import HowToVoteRounded from "@material-ui/icons/HowToVoteRounded";
import FlashOnRounded from "@material-ui/icons/FlashOnRounded";
import AccountBalanceRounded from "@material-ui/icons/AccountBalanceRounded";
import ArrowForwardRounded from "@material-ui/icons/ArrowForwardRounded";
import ArrowBackRounded from "@material-ui/icons/ArrowBackRounded";
import PixaPower from "../icons/PixaPower";

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

    // ── Phase diagram (shared with PXA) ────────────────────────────────────────
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
    jobCardHighlight: {backgroundColor: "#181818"},
    jobIcon: {
        width: 36, height: 36, borderRadius: "50%", backgroundColor: "#0a0a0a",
        display: "flex", alignItems: "center", justifyContent: "center",
        "& svg": {width: 20, height: 20, fill: "#fff"},
    },
    jobTitle: {fontFamily: TITLE_FONT, fontSize: "0.95rem", fontWeight: 600, color: "#fff", margin: 0, lineHeight: 1.2},
    jobBody: {fontSize: "0.8rem", color: "#a5a5a5", lineHeight: 1.5, margin: 0},
    jobTie: {fontFamily: TITLE_FONT, fontSize: "0.58rem", color: "#888", letterSpacing: "0.06em", textTransform: "uppercase", backgroundColor: "#000", borderRadius: 6, padding: "2px 8px", alignSelf: "flex-start"},

    // ── Power-down ladder (pure CSS) ───────────────────────────────────────────
    ladderCard: {backgroundColor: "#0a0a0a", borderRadius: 20, padding: "18px 18px 14px", margin: "8px 0"},
    ladderLegend: {display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16},
    ladderLegendItem: {display: "flex", flexDirection: "column", gap: 2},
    ladderLegendKicker: {fontFamily: TITLE_FONT, fontSize: "0.6rem", color: "#666", letterSpacing: "0.08em", textTransform: "uppercase"},
    ladderLegendValue: {fontFamily: TITLE_FONT, fontSize: "0.95rem", fontWeight: 600, color: "#fff"},
    ladderBars: {display: "flex", alignItems: "flex-end", gap: 5, height: 150, paddingTop: 18},
    ladderCol: {flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", position: "relative"},
    ladderBar: {width: "100%", borderRadius: "4px 4px 0 0", backgroundImage: "linear-gradient(to top, #262626, #5a5a5a)"},
    ladderBarFinal: {backgroundImage: "linear-gradient(to top, #8a8a8a, #ffffff)"},
    ladderCap: {position: "absolute", top: -15, fontFamily: TITLE_FONT, fontSize: "0.56rem", color: "#fff", whiteSpace: "nowrap"},
    ladderAxis: {display: "flex", justifyContent: "space-between", marginTop: 7},
    ladderTick: {fontFamily: TITLE_FONT, fontSize: "0.62rem", color: "#888", letterSpacing: "0.03em"},
    ladderBody: {fontSize: "0.82rem", color: "#a5a5a5", lineHeight: 1.55, margin: "13px 0 0 0"},

    // ── Classification card ──────────────────────────────────────────────────────
    classificationCard: {backgroundColor: "#1a1a1a", borderRadius: 20, padding: "20px 22px", margin: "8px 0", display: "flex", flexDirection: "column", gap: 10},
    classificationKicker: {fontFamily: TITLE_FONT, fontSize: "0.62rem", color: "#888", letterSpacing: "0.1em", textTransform: "uppercase"},
    classificationStatement: {fontFamily: TITLE_FONT, fontSize: "1.15rem", fontWeight: 600, color: "#ffffff", lineHeight: 1.3, margin: 0, [theme.breakpoints.down("sm")]: {fontSize: "1rem"}},
    classificationBody: {fontSize: "0.85rem", color: "#c7c7c7", lineHeight: 1.6, margin: 0},

    footnote: {margin: "26px 0 4px 0", padding: "16px 18px", backgroundColor: "#0a0a0a", borderRadius: 16, fontSize: "0.78rem", color: "#888", lineHeight: 1.6, textAlign: "center"},
    footnoteAccent: {fontFamily: TITLE_FONT, color: "#ffffff", letterSpacing: "0.04em"},
});

// ── Static, illustrative model data (not live values) ───────────────────────
const buildAnatomy = () => [
    {key: "mind", label: t("words.mind"), sub: t("words.oracle"), Icon: ExploreRounded},
    {key: "body", label: t("words.body"), sub: t("words.atlas"), Icon: FitnessCenterRounded},
    {key: "consciousness", label: t("words.consciousness"), sub: t("words.supra"), Icon: BlurOnRounded},
    {key: "soul", label: t("words.soul"), sub: t("words.macro"), Icon: AllInclusiveRounded},
];

// Built per render, not held in a module const: a const resolves t() once when
// this chunk is parsed and freezes the copy in that locale, so a language change
// in Settings would never reach it. The four organ words live in `words` because
// all three wallet info dialogs show the same set.
const buildJobs = () => [
    {title: t("components.pixa_wallet_power_info_dialog.your_voice"), body: t("components.pixa_wallet_power_info_dialog.staked_pxp_is_your_vote_electing_the"), Icon: HowToVoteRounded},
    {title: t("components.pixa_wallet_power_info_dialog.fee_less_bandwidth"), body: t("components.pixa_wallet_power_info_dialog.stake_confers_resource_credits_so_you_can_post"), Icon: FlashOnRounded},
    {title: t("components.pixa_wallet_power_info_dialog.it_weights_the_oracle"), body: t("components.pixa_wallet_power_info_dialog.witnesses_are_elected_by_staked_pxp_so"), Icon: ExploreRounded, tie: t("components.pixa_wallet_power_info_dialog.the_body_thinking"), highlight: true},
    {title: t("components.pixa_wallet_power_info_dialog.it_funds_the_fund"), body: t("components.pixa_wallet_power_info_dialog.a_share_of_emission_directed_by_staked_weight"), Icon: AccountBalanceRounded},
];

// Power-down: 13 equal weekly tranches. The staircase shows cumulative liquid
// PXA returned each week, reaching 100% at week 13 (~91 days). Fixed by protocol.
const POWERDOWN_WEEKS = 13;

class PixaWalletPowerInfoDialog extends React.Component {

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
                            <PixaPower style={{transform: "scale(0.85)"}}/>
                        </div>
                        <div className={classes.titleText}>
                            <span>{t("components.pixa_wallet_power_info_dialog.pixa_power_pxp")}</span>
                            <span className={classes.titleSub}>{t("components.pixa_wallet_power_info_dialog.the_body_at_rest_the_weight_the")}</span>
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
                                k="components.pixa_wallet_power_info_dialog.pxp_is_the_body_0_at_rest"
                                slots={[
                                    <span className={classes.heroAccent} key="0" />,
                                    <span className={classes.heroAccent} key="1" />,
                                    <span className={classes.heroAccent} key="2" />
                                ]} /></Typography>
                        <Typography component={"p"} className={classes.heroBody}><T
                                k="components.pixa_wallet_power_info_dialog.pixa_is_one_living_being_and_pxa"
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
                                <span className={classes.statLabel}>{t("components.pixa_wallet_power_info_dialog.freezes_from_pxa_instant")}</span>
                            </div>
                            <div className={classes.statCell}>
                                <span className={classes.statValue}>{t("components.pixa_wallet_power_info_dialog.13_weeks")}</span>
                                <span className={classes.statLabel}>{t("components.pixa_wallet_power_info_dialog.to_melt_back_to_liquid")}</span>
                            </div>
                            <div className={classes.statCell}>
                                <span className={classes.statValue}>{t("components.pixa_wallet_power_info_dialog.nutzungs_token")}</span>
                                <span className={classes.statLabel}>{t("components.pixa_wallet_power_info_dialog.finma_27_mar_2025")}</span>
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
                                k="components.pixa_wallet_power_info_dialog.pxp_is_pxa_0_frozen_solid_0"
                                slots={[
                                    <span className={classes.bodyEmphasis} key="0" />,
                                    <span className={classes.bodyEmphasis} key="1" />,
                                    <span className={classes.bodyEmphasis} key="2" />
                                ]} /></Typography>
                        <div className={classes.phaseCard}>
                            <div className={classes.phaseGrid}>
                                <div className={classes.phaseNode}>
                                    <div className={classes.phaseIcon}><OpacityRounded/></div>
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
                                <div className={`${classes.phaseNode} ${classes.phaseNodeActive}`}>
                                    <div className={`${classes.phaseIcon} ${classes.phaseIconActive}`}><AcUnitRounded/></div>
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

                    {/* ───── 02 · What the solid does ───── */}
                    <Fade appear in={!!open} timeout={500} style={{transitionDelay: "600ms"}}>
                    <div className={classes.section}>
                        <div className={classes.sectionHeader}>
                            <span className={classes.chapterNum}>02</span>
                            <span className={classes.sectionIcon}><WidgetsRounded/></span>
                            <Typography component={"h3"} className={classes.sectionTitle}>{t("components.pixa_wallet_power_info_dialog.what_the_solid_does")}</Typography>
                        </div>
                        <Typography component={"p"} className={classes.sectionSubtitle}>
                            {t(
                                "components.pixa_wallet_power_info_dialog.staking_is_not_idle_it_buys_four"
                            )}
                        </Typography>
                        <div className={classes.jobGrid}>
                            {buildJobs().map((j) => (
                                <div key={j.title} className={`${classes.jobCard} ${j.highlight ? classes.jobCardHighlight : ''}`}>
                                    <div className={classes.jobIcon}><j.Icon/></div>
                                    <Typography component={"h4"} className={classes.jobTitle}>{j.title}</Typography>
                                    <Typography component={"p"} className={classes.jobBody}>{j.body}</Typography>
                                    {j.tie && <span className={classes.jobTie}>{j.tie}</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                    </Fade>

                    {/* ───── 03 · Getting liquid again ───── */}
                    <Fade appear in={!!open} timeout={500} style={{transitionDelay: "800ms"}}>
                    <div className={classes.section}>
                        <div className={classes.sectionHeader}>
                            <span className={classes.chapterNum}>03</span>
                            <span className={classes.sectionIcon}><ScheduleRounded/></span>
                            <Typography component={"h3"} className={classes.sectionTitle}>{t("components.pixa_wallet_power_info_dialog.getting_liquid_again")}</Typography>
                        </div>
                        <Typography component={"p"} className={classes.sectionSubtitle}><T
                                k="components.pixa_wallet_power_info_dialog.unstaking_is_gradual_and_fixed_power_down"
                                slots={[<span className={classes.bodyEmphasis} key="0" />]} /></Typography>
                        <div className={classes.ladderCard}>
                            <div className={classes.ladderLegend}>
                                <div className={classes.ladderLegendItem}>
                                    <span className={classes.ladderLegendKicker}>{t("components.pixa_wallet_power_info_dialog.each_tranche")}</span>
                                    <span className={classes.ladderLegendValue}>~7.7%</span>
                                </div>
                                <div className={classes.ladderLegendItem}>
                                    <span className={classes.ladderLegendKicker}>{t("components.pixa_wallet_power_info_dialog.tranches")}</span>
                                    <span className={classes.ladderLegendValue}>{t("components.pixa_wallet_power_info_dialog.13_weekly")}</span>
                                </div>
                                <div className={classes.ladderLegendItem}>
                                    <span className={classes.ladderLegendKicker}>{t("components.pixa_wallet_power_info_dialog.fully_liquid")}</span>
                                    <span className={classes.ladderLegendValue}>{t("components.pixa_wallet_power_info_dialog.91_days")}</span>
                                </div>
                            </div>
                            <div className={classes.ladderBars}>
                                {Array.from({length: POWERDOWN_WEEKS}).map((_, i) => {
                                    const isFinal = i === POWERDOWN_WEEKS - 1;
                                    const pct = ((i + 1) / POWERDOWN_WEEKS) * 100;
                                    return (
                                        <div key={i} className={classes.ladderCol}>
                                            {(i === 0 || isFinal) && (
                                                <span className={classes.ladderCap}>{isFinal ? "100%" : "~8%"}</span>
                                            )}
                                            <div className={`${classes.ladderBar} ${isFinal ? classes.ladderBarFinal : ''}`} style={{height: `${pct}%`}}/>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className={classes.ladderAxis}>
                                <span className={classes.ladderTick}>{t("components.pixa_wallet_power_info_dialog.week_1")}</span>
                                <span className={classes.ladderTick}>{t("components.pixa_wallet_power_info_dialog.cumulative_pxa_returned")}</span>
                                <span className={classes.ladderTick}>{t("components.pixa_wallet_power_info_dialog.week_13")}</span>
                            </div>
                            <Typography component={"p"} className={classes.ladderBody}>
                                {t(
                                    "components.pixa_wallet_power_info_dialog.each_week_another_equal_slice_melts_back"
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
                            <span className={classes.classificationKicker}>{t("components.pixa_wallet_power_info_dialog.the_legal_record")}</span>
                            <Typography component={"p"} className={classes.classificationStatement}>
                                {t(
                                    "components.pixa_wallet_power_info_dialog.pxp_is_a_nutzungs_token_a_utility"
                                )}
                            </Typography>
                            <Typography component={"p"} className={classes.classificationBody}><T
                                    k="components.pixa_wallet_power_info_dialog.it_confers_protocol_functionality_governance_and"
                                    slots={[<span className={classes.bodyEmphasis} key="0" />]} /></Typography>
                        </div>
                    </div>
                    </Fade>

                    <Fade appear in={!!open} timeout={500} style={{transitionDelay: "1200ms"}}>
                    <div className={classes.footnote}>
                        {t(
                            "components.pixa_wallet_power_info_dialog.frozen_to_give_the_being_its_weight"
                        )}<br/>
                        <span className={classes.footnoteAccent}>{t("components.pixa_wallet_power_info_dialog.hold_long_vote_true")}</span>
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

export default withLanguage(withStyles(styles)(PixaWalletPowerInfoDialog));