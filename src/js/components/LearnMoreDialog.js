import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import Dialog from "@material-ui/core/Dialog";
import Fade from "@material-ui/core/Fade";
import IconButton from "@material-ui/core/IconButton";
import CloseIcon from "@material-ui/icons/Close";
import TeamAndCompany from "./TeamAndCompany";

import { T } from "../utils/T";
import { t, tk, tx } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";
const styles = theme => ({
    paper: {
        position: "relative",
        background: "#000000",
        color: "#ffffff",
        // "Nearly covers" the screen on desktop…
        width: "calc(100vw - 96px)",
        maxWidth: "1400px",
        // --app-h: the measured visible height (utils/viewport) — 100vh is
        // the toolbar-hidden height on phones and overflowed the screen.
        height: "calc(var(--app-h, 100vh) - 96px)",
        maxHeight: "calc(var(--app-h, 100vh) - 96px)",
        margin: 0,
        borderRadius: "24px",
        border: "none",
        boxShadow: "0 0 80px rgba(0, 0, 0, 0.9)",
        overflow: "hidden",
        fontFamily: `"Industry Book", "Normative Pro", sans-serif`,
        // …and completely covers it on mobile.
        [theme.breakpoints.down("sm")]: {
            width: "100vw",
            maxWidth: "100vw",
            height: "100%",
            maxHeight: "100%",
            borderRadius: 0,
            border: "none",
        },
    },
    backdrop: {
        backgroundColor: "rgba(0, 0, 0, 0.82)",
        backdropFilter: "blur(6px)",
    },
    // Close affordance exists ONLY on mobile — on desktop the backdrop
    // click / Escape key does the job (the dialog never fills the screen).
    closeButton: {
        display: "none",
        [theme.breakpoints.down("sm")]: {
            display: "inline-flex",
            position: "fixed",
            top: "calc(12px + env(safe-area-inset-top))",
            right: "12px",
            zIndex: 10,
            color: "#ffffff",
            background: "rgba(255, 255, 255, 0.08)",
            "&:hover": {
                background: "rgba(255, 255, 255, 0.16)",
            },
        },
    },
    scrollBody: {
        height: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch",
        scrollbarColor: "#2e2e2e transparent",
        "&::-webkit-scrollbar": {
            width: "6px",
        },
        "&::-webkit-scrollbar-thumb": {
            background: "#2e2e2e",
            borderRadius: "6px",
        },
        "&::-webkit-scrollbar-track": {
            background: "transparent",
        },
    },
    inner: {
        maxWidth: "1080px",
        margin: "0 auto",
        padding: "64px 48px 96px 48px",
        [theme.breakpoints.down("sm")]: {
            padding: "56px 20px 80px 20px",
        },
    },
    eyebrow: {
        fontSize: "14px",
        letterSpacing: "0.35em",
        textTransform: "uppercase",
        color: "#8a8a8a",
        fontWeight: "bold",
        marginBottom: "12px",
        userSelect: "none",
    },
    heroTitle: {
        fontSize: "52px",
        fontweight: "bold",
        lineHeight: 1.05,
        margin: "0 0 16px 0",
        color: "#ffffff",
        [theme.breakpoints.down("sm")]: {
            fontSize: "34px",
        },
    },
    heroSub: {
        fontSize: "18px",
        lineHeight: 1.7,
        color: "#a3a3a3",
        margin: 0,
        fontFamily: `"Normative Pro", "Industry Book", sans-serif`,
        [theme.breakpoints.down("sm")]: {
            fontSize: "16px",
        },
    },
    section: {
        marginTop: "72px",
        [theme.breakpoints.down("sm")]: {
            marginTop: "56px",
        },
    },
    sectionTitle: {
        fontSize: '28px',
        fontWeight: 'bold',
        marginBottom: '24px',
        color: "#fff",
    },
    prose: {
        fontSize: "16px",
        lineHeight: 1.8,
        color: "#aaaaaa",
        margin: "0 0 16px 0",
        fontFamily: `"Normative Pro", "Industry Book", sans-serif`,
        "& strong": {
            color: "#ffffff",
            fontWeight: 600,
        },
    },
    // ── Lineage strip: STEEM → HIVE → PIXA ──────────────────────────────
    lineage: {
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "12px",
        margin: "28px 0 10px 0",
    },
    lineageNode: {
        background: "#101010",
        borderRadius: "16px",
        padding: "12px 24px",
        textAlign: "center",
        "& b": {
            display: "block",
            fontSize: "16px",
            color: "#ffffff",
            fontWeight: 600,
            letterSpacing: "0.08em",
        },
        "& span": {
            display: "block",
            fontSize: "12px",
            color: "#8a8a8a",
            marginTop: "2px",
            fontFamily: `"Normative Pro", "Industry Book", sans-serif`,
        },
    },
    lineageNodePixa: {
        borderColor: "#ffffff",
        background: "#202020",
    },
    lineageArrow: {
        color: "#5c5c5c",
        fontSize: "20px",
        userSelect: "none",
    },
    lineageBranch: {
        fontSize: "14px",
        color: "#777777",
        fontFamily: `"Normative Pro", "Industry Book", sans-serif`,
    },
    // ── Spec cards ───────────────────────────────────────────────────────
    specGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
        gap: "14px",
        marginTop: "28px",
    },
    specCard: {
        background: "#101010",
        borderRadius: "16px",
        padding: "18px 16px",
        transition: "background 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        "&:hover": {
            borderColor: "#202020",
        },
    },
    specValue: {
        fontSize: "30px",
        color: "#ffffff",
        lineHeight: 1.1,
    },
    specLabel: {
        fontSize: "13px",
        color: "#8a8a8a",
        marginTop: "6px",
        lineHeight: 1.5,
        fontFamily: `"Normative Pro", "Industry Book", sans-serif`,
    },
    // ── Comparison table ─────────────────────────────────────────────────
    tableWrap: {
        marginTop: "28px",
        overflowX: "auto",
        borderRadius: "16px",
        WebkitOverflowScrolling: "touch",
        "&::-webkit-scrollbar": {
            height: "6px",
        },
        "&::-webkit-scrollbar-thumb": {
            background: "#2e2e2e",
            borderRadius: "6px",
        },
    },
    table: {
        width: "100%",
        minWidth: "780px",
        borderCollapse: "collapse",
        fontFamily: `"Normative Pro", "Industry Book", sans-serif`,
        fontSize: "14px",
        "& th, & td": {
            textAlign: "left",
            padding: "14px 18px",
            verticalAlign: "top",
            lineHeight: 1.55,
        },
        "& tbody tr:last-child th, & tbody tr:last-child td": {
            borderBottom: "none",
        },
        "& thead th": {
            background: "#101010",
            color: "#ffffff",
            fontSize: "15px",
            letterSpacing: "0.06em",
            whiteSpace: "nowrap",
        },
        "& thead th small": {
            display: "block",
            fontSize: "11px",
            color: "#777777",
            letterSpacing: "0.02em",
            marginTop: "4px",
            fontWeight: "normal",
        },
        "& tbody th": {
            color: "#8a8a8a",
            fontWeight: "normal",
            whiteSpace: "nowrap",
            width: "1%",
        },
        "& tbody td": {
            color: "#c9c9c9",
        },
        // $-refs win the specificity fight against "& tbody td" above.
        "& $pixaCol": {
            background: "rgba(255, 255, 255, 0.05)",
            color: "#ffffff",
        },
        "& $pixaHead": {
            background: "#191919",
            textShadow: "0 0 14px rgba(255, 255, 255, 0.4)",
        },
    },
    pixaCol: {},
    pixaHead: {},
    headArrow: {
        color: "#5c5c5c",
        marginRight: "8px",
    },
    tableFootnote: {
        fontSize: "13px",
        color: "#777777",
        marginTop: "12px",
        fontFamily: `"Normative Pro", "Industry Book", sans-serif`,
    },
    // ── Permanence banner ────────────────────────────────────────────────
    banner: {
        marginTop: "72px",
        borderRadius: "24px",
        padding: "40px 32px",
        background: "radial-gradient(ellipse at 50% -20%, #202020, #101010 70%)",
        textAlign: "center",
        [theme.breakpoints.down("sm")]: {
            marginTop: "56px",
            padding: "32px 20px",
        },
    },
    bannerTitle: {
        fontSize: "30px",
        color: "#ffffff",
        fontWeight: "normal",
        margin: "0 0 12px 0",
    },
    bannerText: {
        fontSize: "16px",
        color: "#a3a3a3",
        lineHeight: 1.8,
        maxWidth: "680px",
        margin: "0 auto",
        fontFamily: `"Normative Pro", "Industry Book", sans-serif`,
        "& strong": {
            color: "#ffffff",
            fontWeight: 600,
        },
    },
    // ── Team ─────────────────────────────────────────────────────────────
    teamSection: {
        marginTop: "72px",
        paddingTop: "48px",
        [theme.breakpoints.down("sm")]: {
            marginTop: "56px",
            paddingTop: "40px",
        },
    },
    // TeamAndCompany ships its own 24px container padding — pull it flush
    // with this dialog's gutters so both columns align.
    teamWrap: {
        margin: "0 -24px",
        [theme.breakpoints.down("sm")]: {
            margin: "0 -20px",
        },
    },
});

// One value + one label per card — the raw numbers ARE the pitch.
// Labels are deferred translations (tk): these tables are evaluated once at
// import time, so they are resolved with tx() at render. Values stay literal.
const SPECS = [
    { value: "3 s", label: tk("components.learn_more_dialog.block_time_near_instant_confirmations") },
    { value: "$0", label: tk("components.learn_more_dialog.fees_resource_credits_recharge_over_time") },
    { value: "1000+", label: tk("components.learn_more_dialog.transactions_per_second_of_capacity") },
    { value: "72 kB", label: tk("components.learn_more_dialog.blog_posts_written_directly_on_chain") },
    { value: "PoB", label: tk("components.learn_more_dialog.proof_of_brain_rewards_both_creation_and") },
];

// [row label, STEEM, HIVE, PIXA] — tk() cells, plain strings for the
// untranslatable ones (sizes, the dash); tx() resolves both at render.
const TABLE_ROWS = [
    [
        tk("components.learn_more_dialog.origin"),
        tk("components.learn_more_dialog.original_social_blockchain_2016"),
        tk("components.learn_more_dialog.community_hard_fork_of_steem_2020"),
        tk("components.learn_more_dialog.new_chain_forked_from_the_hive_steem_codebase"),
    ],
    [
        tk("components.learn_more_dialog.track_record"),
        tk("components.learn_more_dialog.valued_at_over_1b_top_10_cryptocurrency_in"),
        tk("components.learn_more_dialog.independent_and_active_since_2020"),
        tk("components.learn_more_dialog.inherits_10_years_of_battle_tested_code"),
    ],
    [
        tk("words.governance"),
        tk("components.learn_more_dialog.centralized_stake_its_takeover_triggered_the"),
        tk("components.learn_more_dialog.community_run_witnesses"),
        tk("components.learn_more_dialog.community_run_witnesses_from_day_one"),
    ],
    [
        tk("components.learn_more_dialog.block_time"),
        tk("components.learn_more_dialog.3_seconds"),
        tk("components.learn_more_dialog.3_seconds"),
        tk("components.learn_more_dialog.3_seconds"),
    ],
    [
        tk("components.learn_more_dialog.fees"),
        tk("components.learn_more_dialog.mostly_fee_less_resource_credits"),
        tk("components.learn_more_dialog.mostly_fee_less_resource_credits"),
        tk("components.learn_more_dialog.mostly_fee_less_credits_recharge_over_time"),
    ],
    [
        tk("components.learn_more_dialog.throughput"),
        tk("components.learn_more_dialog.thousands_of_tps"),
        tk("components.learn_more_dialog.thousands_of_tps"),
        tk("components.learn_more_dialog.thousands_of_tps"),
    ],
    [
        tk("components.learn_more_dialog.post_size"),
        "~64 kB",
        "~64 kB",
        "72 kB",
    ],
    [
        tk("components.learn_more_dialog.media_storage"),
        tk("components.learn_more_dialog.off_chain_links"),
        tk("components.learn_more_dialog.off_chain_links_ipfs"),
        tk("components.learn_more_dialog.fully_on_chain_base64_png_webp_no_hashes"),
    ],
    [
        tk("components.learn_more_dialog.rewards"),
        tk("components.learn_more_dialog.proof_of_brain_posting_curation"),
        tk("components.learn_more_dialog.proof_of_brain_posting_curation"),
        tk("components.learn_more_dialog.proof_of_brain_tuned_for_pixel_artists"),
    ],
    [
        tk("components.learn_more_dialog.nfts"),
        "—",
        tk("components.learn_more_dialog.second_layer_apps"),
        tk("components.learn_more_dialog.native_concept_marketplace_arrives_in_phase"),
    ],
    [
        tk("components.learn_more_dialog.focus"),
        tk("components.learn_more_dialog.general_blogging"),
        tk("components.learn_more_dialog.general_blogging_dapps"),
        tk("components.learn_more_dialog.pixel_art_social_network"),
    ],
];

class LearnMoreDialog extends React.PureComponent {
    render() {
        const { classes, open, onClose } = this.props;

        return (
            <Dialog
                open={Boolean(open)}
                onClose={onClose}
                maxWidth={false}
                scroll="paper"
                TransitionComponent={Fade}
                transitionDuration={{ enter: 400, exit: 250 }}
                classes={{ paper: classes.paper }}
                BackdropProps={{ className: classes.backdrop }}
                aria-labelledby="learn-more-title"
            >
                <IconButton
                    className={classes.closeButton}
                    onClick={onClose}
                    aria-label={t("words.close")}
                    size="small"
                >
                    <CloseIcon />
                </IconButton>
                <div className={classes.scrollBody}>
                    <div className={classes.inner}>

                        {/* ── Hero ─────────────────────────────────────── */}
                        <div className={classes.eyebrow}>{t("components.learn_more_dialog.under_the_hood")}</div>
                        <h1 id="learn-more-title" className={classes.heroTitle}>
                            {t("components.learn_more_dialog.proven_tech_new_canvas")}
                        </h1>
                        <p className={classes.heroSub}>
                            {t("components.learn_more_dialog.pixagram_runs_on_the_pixa_chain_a")}
                        </p>

                        {/* ── The story ────────────────────────────────── */}
                        <div className={classes.section}>
                            <h2 className={classes.sectionTitle}>{t("components.learn_more_dialog.a_decade_of_history_behind_every_block")}</h2>
                            <p className={classes.prose}><T
                                    k="components.learn_more_dialog.strong_steem_strong_launched_in_2016_as"
                                    vars={{
                                        text: " "
                                    }} /></p>
                            <p className={classes.prose}><T
                                    k="components.learn_more_dialog.in_2020_a_governance_takeover_split_the"
                                    vars={{
                                        text: " "
                                    }} /></p>
                            <p className={classes.prose}>
                                <strong>PIXA</strong> {t("components.learn_more_dialog.brings_that_lineage_back_with_a_new")}
                            </p>

                            <div className={classes.lineage}>
                                <div className={classes.lineageNode}>
                                    <b>STEEM</b>
                                    <span>{t("components.learn_more_dialog.2016_where_it_began")}</span>
                                </div>
                                <div className={classes.lineageArrow}>→</div>
                                <div className={classes.lineageNode}>
                                    <b>HIVE</b>
                                    <span>{t("components.learn_more_dialog.2020_the_community_fork")}</span>
                                </div>
                                <div className={classes.lineageArrow}>→</div>
                                <div className={`${classes.lineageNode} ${classes.lineageNodePixa}`}>
                                    <b>PIXA</b>
                                    <span>{t("components.learn_more_dialog.the_next_chapter")}</span>
                                </div>
                            </div>
                            <div className={classes.lineageBranch}>
                                {t(
                                    "components.learn_more_dialog.side_branches_blurt_golos_still_online_today"
                                )}
                            </div>
                        </div>

                        {/* ── Specs ────────────────────────────────────── */}
                        <div className={classes.section}>
                            <h2 className={classes.sectionTitle}>{t("components.learn_more_dialog.what_the_chain_delivers")}</h2>
                            <div className={classes.specGrid}>
                                {SPECS.map((spec, i) => (
                                    <div key={i} className={classes.specCard}>
                                        <div className={classes.specValue}>{spec.value}</div>
                                        <div className={classes.specLabel}>{tx(spec.label)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ── STEEM → HIVE → PIXA table ────────────────── */}
                        <div className={classes.section}>
                            <h2 className={classes.sectionTitle}>{t("components.learn_more_dialog.from_steem_to_hive_to_pixa")}</h2>
                            <div className={classes.tableWrap}>
                                <table className={classes.table}>
                                    <thead>
                                        <tr>
                                            <th aria-hidden="true"></th>
                                            <th>
                                                STEEM
                                                <small>{t("components.learn_more_dialog.2016_the_origin")}</small>
                                            </th>
                                            <th>
                                                <span className={classes.headArrow}>→</span>HIVE
                                                <small>{t("components.learn_more_dialog.2020_the_community_fork")}</small>
                                            </th>
                                            <th className={classes.pixaHead}>
                                                <span className={classes.headArrow}>→</span>PIXA
                                                <small>{t("components.learn_more_dialog.the_next_chapter")}</small>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {TABLE_ROWS.map((row, i) => (
                                            <tr key={i}>
                                                <th scope="row">{tx(row[0])}</th>
                                                <td>{tx(row[1])}</td>
                                                <td>{tx(row[2])}</td>
                                                <td className={classes.pixaCol}>{tx(row[3])}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className={classes.tableFootnote}>
                                {t("components.learn_more_dialog.the_same_family_tree_also_produced_blurt")}
                            </div>
                        </div>

                        {/* ── Permanence banner ────────────────────────── */}
                        <div className={classes.banner}>
                            <h2 className={classes.bannerTitle}>{t("components.learn_more_dialog.stored_forever_literally")}</h2>
                            <p className={classes.bannerText}><T
                                    k="components.learn_more_dialog.every_artwork_is_written_into_the_chain"
                                    vars={{
                                        text: " "
                                    }} /></p>
                        </div>

                        {/* ── Team & company ───────────────────────────── */}
                        <div className={classes.teamSection}>
                            <div className={classes.teamWrap}>
                                <TeamAndCompany />
                            </div>
                        </div>

                    </div>
                </div>
            </Dialog>
        );
    }
}

export default withLanguage(withStyles(styles)(LearnMoreDialog));