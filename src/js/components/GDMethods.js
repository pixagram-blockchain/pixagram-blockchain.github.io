import * as React from "preact/compat";

import withStyles from "@material-ui/core/styles/withStyles";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import Typography from "@material-ui/core/Typography";
import ButtonBase from "@material-ui/core/ButtonBase";
import GetAppIcon from "@material-ui/icons/GetApp";
import PlayArrowIcon from "@material-ui/icons/PlayArrow";
import AccessTimeIcon from "@material-ui/icons/AccessTime";
import SchoolIcon from "@material-ui/icons/School";
import HistoryIcon from "@material-ui/icons/History";
import GavelIcon from "@material-ui/icons/Gavel";
import MemoryIcon from "@material-ui/icons/Memory";
import PaletteIcon from "@material-ui/icons/Palette";
import AccountBalanceIcon from "@material-ui/icons/AccountBalance";
import CodeIcon from "@material-ui/icons/Code";

import { t, tk, tx } from "../utils/text";
import { withLanguage } from "../utils/withLanguage";

const styles = theme => ({
    dialogContent: {
        padding: "24px"
    },
    sectionTitle: {
        fontSize: "18px",
        fontWeight: 600,
        color: "#fff",
        fontFamily: "'Industry Book'",
        marginTop: "32px",
        marginBottom: "8px",
        "&:first-child": {
            marginTop: 0
        }
    },
    sectionDescription: {
        fontSize: "14px",
        color: "#888",
        fontFamily: "'Normative Pro'",
        marginBottom: "16px"
    },
    guideGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "16px",
        marginBottom: "24px"
    },
    guideTile: {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        padding: "20px",
        backgroundColor: "#101010",
        borderRadius: "16px",
        textAlign: "left",
        transition: "background-color 200ms cubic-bezier(0.4, 0, 0.2, 1)",
        position: "relative",
        overflow: "hidden",
        cursor: "pointer",
        "&:hover": {
            backgroundColor: "#171717"
        }
    },
    guideBackgroundIcon: {
        position: "absolute",
        top: "-10px",
        right: "-10px",
        fontSize: "100px",
        color: "#fff",
        opacity: 0.05,
        pointerEvents: "none"
    },
    guideContent: {
        position: "relative",
        zIndex: 1,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        height: "100%"
    },
    guideTitle: {
        fontSize: "16px",
        fontWeight: 600,
        color: "#fff",
        fontFamily: "'Industry Book'",
        marginBottom: "8px"
    },
    guideDescription: {
        fontSize: "13px",
        color: "#888",
        fontFamily: "'Normative Pro'",
        lineHeight: 1.5,
        marginBottom: "16px",
        flex: 1
    },
    guideFooter: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%"
    },
    guideReadTime: {
        display: "flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "12px",
        fontFamily: "'Normative Pro'",
        color: "#666"
    },
    readTimeIcon: {
        fontSize: "14px"
    },
    guideActions: {
        display: "flex",
        alignItems: "center",
        gap: "8px"
    },
    actionButton: {
        display: "flex",
        alignItems: "center",
        gap: "4px",
        padding: "4px 10px 4px 8px",
        borderRadius: "8px",
        backgroundColor: "#1e1e1e",
        color: "#aaa",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.5px",
        fontFamily: "'Normative Pro'",
        transition: "background-color 200ms cubic-bezier(0.4, 0, 0.2, 1), color 200ms cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": {
            backgroundColor: "#2c2c2c",
            color: "#fff"
        }
    },
    actionIcon: {
        fontSize: "15px"
    },
    videoDialogPaper: {
        width: "100%",
        maxWidth: "960px",
        margin: "24px",
        padding: 0,
        border: "none",
        borderRadius: "32px",
        backgroundColor: "#000",
        overflow: "hidden"
    },
    videoPlayer: {
        display: "block",
        width: "100%",
        maxHeight: "calc(var(--app-h, 100vh) * 0.8)",
        outline: "none",
        backgroundColor: "#000"
    }
});

const GATEWAY = "https://turbo-gateway.com/";

// Titles and descriptions are deferred translations (tk): this table is
// evaluated once at import time, so they are resolved with tx() at render.
const SERIES = [
    {
        id: "foundations",
        title: tk("components.gdmethods.series_1_foundations"),
        description: tk("components.gdmethods.the_shared_notebook_the_three_network_shapes"),
        icon: SchoolIcon,
        guides: [
            {
                id: "guide-01",
                title: tk("components.gdmethods.01_what_is_a_blockchain"),
                description: tk("components.gdmethods.a_notebook_everyone_can_read_nobody_can_erase"),
                readMinutes: 5,
                href: GATEWAY + "-Awk5plnR1W6obYdtWHmiCFfZUpXESaAiKePDTG0ztM",
                video: GATEWAY + "kmyYwWBgB4gWqjzWjD9KAAiCEXW2w7e7QcfyS9ldRTI"
            },
            {
                id: "guide-02",
                title: tk("components.gdmethods.02_three_shapes_of_networks"),
                description: tk("components.gdmethods.baran_s_1964_diagram_centralized_decentralized"),
                readMinutes: 5,
                href: GATEWAY + "-VPzbsi8YlsF8xsEWIUnp2FQEZvitZhcig-Wt0njjxk",
                video: GATEWAY + "IJ-JTB217osbjE0_ibV3tXIr7Czf-LilXpGono6OOfU"
            },
            {
                id: "guide-03",
                title: tk("components.gdmethods.03_pow_vs_pos_vs_dpos"),
                description: tk("components.gdmethods.three_answers_to_who_writes_the_next_block"),
                readMinutes: 5,
                href: GATEWAY + "1rLaHTDQp8eAKuwK2JYqaqeumJiBl_R9HnpaUXMrSjc",
                video: GATEWAY + "TQdwEXeO3nSyguqVN0YtmA86U8XRcb2MSjcSJ3XME-o"
            },
            {
                id: "guide-04",
                title: tk("components.gdmethods.04_the_faucet"),
                description: tk("components.gdmethods.inflation_as_payroll_the_reward_pool_the_13"),
                readMinutes: 5,
                href: GATEWAY + "dVOqe2KgxEwzaMHOVDWKuUcdgGQY8_ZiPOytfTPcmOg",
                video: GATEWAY + "cjWk12LzzWDiUC0O2OLpGzUG1mWMX_Zc-VdCb2t8ri0"
            }
        ]
    },
    {
        id: "steem-story",
        title: tk("components.gdmethods.series_2_the_steem_story"),
        description: tk("components.gdmethods.bitshares_to_the_400m_summer_how_a_mutual_aid"),
        icon: HistoryIcon,
        guides: [
            {
                id: "guide-05",
                title: tk("components.gdmethods.05_bitshares_the_prequel"),
                description: tk("components.gdmethods.dan_larimer_graphene_dpos_and_bitusd_the"),
                readMinutes: 5,
                href: GATEWAY + "S0_14r74qdVecSdiOyNpO2EOS-S4aURNMTg1K4AiJtE",
                video: GATEWAY + "HXJot2E_XgxS9Dn8bV8KkwFTc5Lk5sM2i99A73ppfdQ"
            },
            {
                id: "guide-06",
                title: tk("components.gdmethods.06_steem_is_born_2016"),
                description: tk("components.gdmethods.from_mutual_aid_sketch_to_independence_day"),
                readMinutes: 5,
                href: GATEWAY + "WeoocCixa26_1O5Pb3bj6wjUZVn73Gv-9-DCmO4MYdA",
                video: GATEWAY + "u555AvpyeDhrdbmddWo0Vk_6hFkixHkQbdSIslqmg3Y"
            },
            {
                id: "guide-07",
                title: tk("components.gdmethods.07_proof_of_brain"),
                description: tk("components.gdmethods.stake_weighted_upvotes_the_7_day_window"),
                readMinutes: 5,
                href: GATEWAY + "OR-zOAZKGMlVYhbPGNV4Cgxb91UnXgIIuWrjKuaindI",
                video: GATEWAY + "M4XrnqlLwhyTaCSvD-1ooKTLpVphL-02xLZnuJNLJC4"
            },
            {
                id: "guide-08",
                title: tk("components.gdmethods.08_the_token_triangle"),
                description: tk("components.gdmethods.steem_steem_power_and_sbd_spend_commit"),
                readMinutes: 5,
                href: GATEWAY + "Ac2pv23V4pRAdDHSY7G5Fw5bPEbhGTj5ADnqMyisa5w",
                video: GATEWAY + "t26pC0soUoeV53P_uR8eJS4a-4P0Vc56aYBv40tox8k"
            },
            {
                id: "guide-09",
                title: tk("components.gdmethods.09_the_400m_summer"),
                description: tk("components.gdmethods.july_2016_2_000_in_a_fortnight_briefly_the_3"),
                readMinutes: 5,
                href: GATEWAY + "72DsSzhDFO5U6Xdm1uD_ScYTlVKs-qOBPlqWE-mKYiY",
                video: GATEWAY + "qdneOd5OVbqIWjUHCE8wBpBvt4i3mghqy6JShnjn2Cs"
            },
            {
                id: "guide-10",
                title: tk("components.gdmethods.10_censorship_resistance"),
                description: tk("components.gdmethods.the_missing_delete_button_what_the_chain"),
                readMinutes: 5,
                href: GATEWAY + "z5XrCbEiisBz5S18XUIL5dEKD7SsnZrnRfI6OKpyA84",
                video: GATEWAY + "QT9xOg5L7vGzFPDDGHWh29i6eSSp_kM5Ie78oDJrDEQ"
            }
        ]
    },
    {
        id: "the-war",
        title: tk("components.gdmethods.series_3_the_war_the_hive_fork"),
        description: tk("components.gdmethods.february_to_may_2020_the_acquisition_the"),
        icon: GavelIcon,
        guides: [
            {
                id: "guide-11",
                title: tk("components.gdmethods.11_enter_justin_sun"),
                description: tk("components.gdmethods.valentine_s_day_2020_a_billionaire_buys_the"),
                readMinutes: 5,
                href: GATEWAY + "jeINni4YoXaedHeZFatjcOdRTrtj3zG4TCJX93Cz5hM"
            },
            {
                id: "guide-12",
                title: tk("components.gdmethods.12_the_counterattack"),
                description: tk("components.gdmethods.soft_fork_0_22_2_freezes_the_stake_three"),
                readMinutes: 5,
                href: GATEWAY + "RFsq_WHpYcCL6T-Ad5uhkIJ8fnhH4qoKohQNGudKa9k"
            },
            {
                id: "guide-13",
                title: tk("components.gdmethods.13_hive_rises"),
                description: tk("components.gdmethods.march_20_2020_copy_the_universe_airdrop_1_1"),
                readMinutes: 5,
                href: GATEWAY + "GvNrVBOmP8FA7qElJeBJ9PuFG--X5lpNvV0PCuglnOo"
            },
            {
                id: "guide-14",
                title: tk("components.gdmethods.14_new_steem_the_retaliation"),
                description: tk("components.gdmethods.freeze_for_freeze_fork_for_fork_64_accounts"),
                readMinutes: 5,
                href: GATEWAY + "KTp_6OXY52Y0MF7eV3lA2-IPdFoIJd5J5gg7nr7I5ZI"
            }
        ]
    },
    {
        id: "deep-dives",
        title: tk("components.gdmethods.series_4_technology_deep_dives"),
        description: tk("components.gdmethods.witnesses_accounts_keys_bandwidth_and_hive_s"),
        icon: MemoryIcon,
        guides: [
            {
                id: "guide-15",
                title: tk("components.gdmethods.15_the_21_witnesses"),
                description: tk("components.gdmethods.blocks_parameters_and_hardforks_the_elected"),
                readMinutes: 5,
                href: GATEWAY + "8gW_n-p_Zu7_wlrYX7eMY-DasbGdbaN5mGe3BH7qaDo"
            },
            {
                id: "guide-16",
                title: tk("components.gdmethods.16_usernames_not_addresses"),
                description: tk("components.gdmethods.the_account_object_names_as_identity_keys_as"),
                readMinutes: 5,
                href: GATEWAY + "TpDbap8HJzg1WIHCyIDtRgoqz3IJlTE2I0hGShiTZFA"
            },
            {
                id: "guide-17",
                title: tk("components.gdmethods.17_four_keys_the_safety_net"),
                description: tk("components.gdmethods.posting_active_owner_memo_ranked_by_blast"),
                readMinutes: 5,
                href: GATEWAY + "HTBlE18FE3NSXSAYlb9C9YyvBp5iN_AD-Y62g6axzBM"
            },
            {
                id: "guide-18",
                title: tk("components.gdmethods.18_paying_without_fees"),
                description: tk("components.gdmethods.bandwidth_and_resource_credits_meter_the_pipe"),
                readMinutes: 5,
                href: GATEWAY + "2QRVnrQEzanW4bxJqqd4WGuRRBCj-J6f8LKwRlbm-mg"
            },
            {
                id: "guide-19",
                title: tk("components.gdmethods.19_hive_on_its_own_terms"),
                description: tk("components.gdmethods.scars_to_patches_the_30_day_lock_the_dhf_and"),
                readMinutes: 5,
                href: GATEWAY + "umh3VYxo_jalONygcv4VCydwFGtOfZ_8E9NFZTMmLHI"
            }
        ]
    },
    {
        id: "pixa-platform",
        title: tk("components.gdmethods.series_5_the_pixa_platform"),
        description: tk("components.gdmethods.art_as_payload_the_on_chain_pipeline_the_four"),
        icon: PaletteIcon,
        guides: [
            {
                id: "guide-20",
                title: tk("components.gdmethods.20_meet_pixagram"),
                description: tk("components.gdmethods.the_heir_21_witnesses_128_kb_posts_and_art"),
                readMinutes: 5,
                href: GATEWAY + "sVPGsm4qL3F4I4Fv7AMPBkaoN2VF3TQ6JarCKMHIgCM"
            },
            {
                id: "guide-21",
                title: tk("components.gdmethods.21_the_on_chain_pipeline"),
                description: tk("components.gdmethods.from_2_mb_to_19_kb_k_centroid_kopf_lischinski"),
                readMinutes: 5,
                href: GATEWAY + "p5Lr5DOWTSQTOBXPyfQO32trNe2saTbt4mTDajieAj0"
            },
            {
                id: "guide-22",
                title: tk("components.gdmethods.22_the_rendering_engines"),
                description: tk("components.gdmethods.squared_xbrz_hexagonal_crt_four_personalities"),
                readMinutes: 5,
                href: GATEWAY + "zW4coxHNZMbzIGIf3QSBSvWs_d7cmnUIDWQbsI3eKXw"
            },
            {
                id: "guide-23",
                title: tk("components.gdmethods.23_a_history_of_pixel_art"),
                description: tk("components.gdmethods.fifty_years_in_five_acts_necessity_mastery"),
                readMinutes: 5,
                href: GATEWAY + "EsGDkUNZ9r063dMleGPzqtfzigO_sFNqn-fuNtF10ww"
            }
        ]
    },
    {
        id: "pixa-economy",
        title: tk("components.gdmethods.series_6_the_pixa_economy"),
        description: tk("components.gdmethods.pxa_pxp_and_the_supra_and_the_genesis_that"),
        icon: AccountBalanceIcon,
        guides: [
            {
                id: "guide-24",
                title: tk("components.gdmethods.24_three_tokens_pxa_pxp_pxs"),
                description: tk("components.gdmethods.zero_liquid_at_genesis_100m_pxp_ever_and_0"),
                readMinutes: 5,
                href: GATEWAY + "jeFmaOikj9BDmiyXfrr7b0CSx9I0Y9Kiyr2xU1ISzBc"
            },
            {
                id: "guide-25",
                title: tk("components.gdmethods.25_the_supracoin"),
                description: tk("components.gdmethods.pxs_the_big_mac_reference_the_two_median"),
                readMinutes: 5,
                href: GATEWAY + "6lXdPWtSIg8FpTW9Msw_OTG3WNoWaO-MbEscEJ3e5uI"
            },
            {
                id: "guide-26",
                title: tk("components.gdmethods.26_genesis_without_a_ninja_mine"),
                description: tk("components.gdmethods.the_war_answered_at_block_zero_four_locks"),
                readMinutes: 5,
                href: GATEWAY + "k6PT9UvPcCYn41rykfX7hJf3S1nQ2DLrC6gbPIu2BW4"
            }
        ]
    },
    {
        id: "practical",
        title: tk("components.gdmethods.series_7_practical"),
        description: tk("components.gdmethods.hands_on_your_first_account_the_vault_and"),
        icon: CodeIcon,
        guides: [
            {
                id: "guide-27",
                title: tk("components.gdmethods.27_your_first_account"),
                description: tk("components.gdmethods.master_password_paper_bookmark_the_vault"),
                readMinutes: 5,
                href: GATEWAY + "imQx_kuB3azx04g3E3VP8oW_0mVvwkQME2F4IERNhhs"
            },
            {
                id: "guide-28",
                title: tk("components.gdmethods.28_dpixa_in_twenty_lines"),
                description: tk("components.gdmethods.connect_read_write_act_the_whole_network_in"),
                readMinutes: 5,
                href: GATEWAY + "TBlK0gZ7jCdAZ9jt6r4RbgyCmmm27XBgQbdr7d_VOkY"
            }
        ]
    }
];

class GDMethods extends React.PureComponent {
    state = {
        videoGuide: null
    };

    _handleDownload = (guide) => {
        window.open(guide.href, "_blank");
    }

    _handleDownloadClick = (event, guide) => {
        event.stopPropagation();
        this._handleDownload(guide);
    }

    _handlePlayVideo = (event, guide) => {
        event.stopPropagation();
        this.setState({ videoGuide: guide });
    }

    _handleCloseVideo = () => {
        this.setState({ videoGuide: null });
    }

    _renderGuideTile = (guide, BackgroundIcon) => {
        const { classes } = this.props;

        return (
            <div
                key={guide.id}
                className={classes.guideTile}
                onClick={() => this._handleDownload(guide)}
            >
                <BackgroundIcon className={classes.guideBackgroundIcon} />
                <div className={classes.guideContent}>
                    <Typography className={classes.guideTitle}>
                        {tx(guide.title)}
                    </Typography>
                    <Typography className={classes.guideDescription}>
                        {tx(guide.description)}
                    </Typography>
                    <div className={classes.guideFooter}>
                        <span className={classes.guideReadTime}>
                            <AccessTimeIcon className={classes.readTimeIcon} />
                            {t("components.gdmethods.n_min", { minutes: guide.readMinutes })}
                        </span>
                        <div className={classes.guideActions}>
                            {guide.video &&
                                <ButtonBase
                                    className={classes.actionButton}
                                    onClick={(event) => this._handlePlayVideo(event, guide)}
                                >
                                    <PlayArrowIcon className={classes.actionIcon} />
                                    {t("components.gdmethods.video", { TUC: true })}
                                </ButtonBase>
                            }
                            <ButtonBase
                                className={classes.actionButton}
                                onClick={(event) => this._handleDownloadClick(event, guide)}
                            >
                                <GetAppIcon className={classes.actionIcon} />
                                PDF
                            </ButtonBase>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    _renderSeries = (series) => {
        const { classes } = this.props;

        return (
            <React.Fragment key={series.id}>
                <Typography className={classes.sectionTitle}>{tx(series.title)}</Typography>
                <Typography className={classes.sectionDescription}>
                    {tx(series.description)}
                </Typography>
                <div className={classes.guideGrid}>
                    {series.guides.map(guide => this._renderGuideTile(guide, series.icon))}
                </div>
            </React.Fragment>
        );
    }

    _renderVideoDialog = () => {
        const { classes } = this.props;
        const { videoGuide } = this.state;

        return (
            <Dialog
                open={Boolean(videoGuide)}
                onClose={this._handleCloseVideo}
                classes={{ paper: classes.videoDialogPaper }}
                maxWidth={false}
            >
                {videoGuide &&
                    <video
                        className={classes.videoPlayer}
                        src={videoGuide.video}
                        controls
                        autoPlay
                        playsInline
                    />
                }
            </Dialog>
        );
    }

    render() {
        const { classes } = this.props;

        return (
            <DialogContent className={classes.dialogContent}>
                {SERIES.map(series => this._renderSeries(series))}
                {this._renderVideoDialog()}
            </DialogContent>
        );
    }
}

export default withLanguage(withStyles(styles)(GDMethods));