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
        transition: "background-color 200ms ease",
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
        transition: "background-color 200ms ease, color 200ms ease",
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
        maxHeight: "80vh",
        outline: "none",
        backgroundColor: "#000"
    }
});

const GATEWAY = "https://turbo-gateway.com/";

const SERIES = [
    {
        id: "foundations",
        title: "Series 1 \u2014 Foundations",
        description: "The shared notebook, the three network shapes, consensus, and the faucet \u2014 everything the story stands on.",
        icon: SchoolIcon,
        guides: [
            {
                id: "guide-01",
                title: "01 \u00b7 What Is a Blockchain?",
                description: "A notebook everyone can read, nobody can erase \u2014 blocks, hashes, and the 21 bookkeepers.",
                readTime: "5 min",
                href: GATEWAY + "-Awk5plnR1W6obYdtWHmiCFfZUpXESaAiKePDTG0ztM",
                video: GATEWAY + "kmyYwWBgB4gWqjzWjD9KAAiCEXW2w7e7QcfyS9ldRTI"
            },
            {
                id: "guide-02",
                title: "02 \u00b7 Three Shapes of Networks",
                description: "Baran's 1964 diagram \u2014 centralized, decentralized, distributed \u2014 and the test that never lies.",
                readTime: "5 min",
                href: GATEWAY + "-VPzbsi8YlsF8xsEWIUnp2FQEZvitZhcig-Wt0njjxk",
                video: GATEWAY + "IJ-JTB217osbjE0_ibV3tXIr7Czf-LilXpGono6OOfU"
            },
            {
                id: "guide-03",
                title: "03 \u00b7 PoW vs PoS vs DPoS",
                description: "Three answers to who writes the next block \u2014 and why the fastest chose elected hubs.",
                readTime: "5 min",
                href: GATEWAY + "1rLaHTDQp8eAKuwK2JYqaqeumJiBl_R9HnpaUXMrSjc",
                video: GATEWAY + "TQdwEXeO3nSyguqVN0YtmA86U8XRcb2MSjcSJ3XME-o"
            },
            {
                id: "guide-04",
                title: "04 \u00b7 The Faucet",
                description: "Inflation as payroll: the reward pool, the 13-week door, and three generations of the split.",
                readTime: "5 min",
                href: GATEWAY + "dVOqe2KgxEwzaMHOVDWKuUcdgGQY8_ZiPOytfTPcmOg",
                video: GATEWAY + "cjWk12LzzWDiUC0O2OLpGzUG1mWMX_Zc-VdCb2t8ri0"
            }
        ]
    },
    {
        id: "steem-story",
        title: "Series 2 \u2014 The Steem Story",
        description: "BitShares to the $400M summer: how a mutual-aid sketch became the first social blockchain.",
        icon: HistoryIcon,
        guides: [
            {
                id: "guide-05",
                title: "05 \u00b7 BitShares: The Prequel",
                description: "Dan Larimer, Graphene, DPoS and BitUSD \u2014 the engine every chain in this story runs on.",
                readTime: "5 min",
                href: GATEWAY + "S0_14r74qdVecSdiOyNpO2EOS-S4aURNMTg1K4AiJtE",
                video: GATEWAY + "HXJot2E_XgxS9Dn8bV8KkwFTc5Lk5sM2i99A73ppfdQ"
            },
            {
                id: "guide-06",
                title: "06 \u00b7 Steem Is Born (2016)",
                description: "From mutual-aid sketch to Independence Day launch \u2014 and the Evil Plan, published in the open.",
                readTime: "5 min",
                href: GATEWAY + "WeoocCixa26_1O5Pb3bj6wjUZVn73Gv-9-DCmO4MYdA",
                video: GATEWAY + "u555AvpyeDhrdbmddWo0Vk_6hFkixHkQbdSIslqmg3Y"
            },
            {
                id: "guide-07",
                title: "07 \u00b7 Proof of Brain",
                description: "Stake-weighted upvotes, the 7-day window, curation as a paid craft \u2014 and the honest failure modes.",
                readTime: "5 min",
                href: GATEWAY + "OR-zOAZKGMlVYhbPGNV4Cgxb91UnXgIIuWrjKuaindI",
                video: GATEWAY + "M4XrnqlLwhyTaCSvD-1ooKTLpVphL-02xLZnuJNLJC4"
            },
            {
                id: "guide-08",
                title: "08 \u00b7 The Token Triangle",
                description: "STEEM, Steem Power and SBD \u2014 spend, commit, stabilize \u2014 and the debt-cap prior art.",
                readTime: "5 min",
                href: GATEWAY + "Ac2pv23V4pRAdDHSY7G5Fw5bPEbhGTj5ADnqMyisa5w",
                video: GATEWAY + "t26pC0soUoeV53P_uR8eJS4a-4P0Vc56aYBv40tox8k"
            },
            {
                id: "guide-09",
                title: "09 \u00b7 The $400M Summer",
                description: "July 2016: +2,000% in a fortnight, briefly the #3 crypto \u2014 a headline both true and misleading.",
                readTime: "5 min",
                href: GATEWAY + "72DsSzhDFO5U6Xdm1uD_ScYTlVKs-qOBPlqWE-mKYiY",
                video: GATEWAY + "qdneOd5OVbqIWjUHCE8wBpBvt4i3mghqy6JShnjn2Cs"
            },
            {
                id: "guide-10",
                title: "10 \u00b7 Censorship Resistance",
                description: "The missing delete button: what the chain guarantees, the front-end nuance, Venezuela by the numbers.",
                readTime: "5 min",
                href: GATEWAY + "z5XrCbEiisBz5S18XUIL5dEKD7SsnZrnRfI6OKpyA84",
                video: GATEWAY + "QT9xOg5L7vGzFPDDGHWh29i6eSSp_kM5Ie78oDJrDEQ"
            }
        ]
    },
    {
        id: "the-war",
        title: "Series 3 \u2014 The War & the Hive Fork",
        description: "February to May 2020: the acquisition, the exchange coup, the Hive fork, and the retaliation.",
        icon: GavelIcon,
        guides: [
            {
                id: "guide-11",
                title: "11 \u00b7 Enter Justin Sun",
                description: "Valentine's Day 2020: a billionaire buys the company \u2014 and the ninja-mined stake attached to it.",
                readTime: "5 min",
                href: GATEWAY + "jeINni4YoXaedHeZFatjcOdRTrtj3zG4TCJX93Cz5hM"
            },
            {
                id: "guide-12",
                title: "12 \u00b7 The Counterattack",
                description: "Soft fork 0.22.2 freezes the stake; three exchanges answer with ~42M SP of customer votes.",
                readTime: "5 min",
                href: GATEWAY + "RFsq_WHpYcCL6T-Ad5uhkIJ8fnhH4qoKohQNGudKa9k"
            },
            {
                id: "guide-13",
                title: "13 \u00b7 Hive Rises",
                description: "March 20, 2020: copy the universe, airdrop 1:1, exclude the stake \u2014 and weld the coup door shut.",
                readTime: "5 min",
                href: GATEWAY + "GvNrVBOmP8FA7qElJeBJ9PuFG--X5lpNvV0PCuglnOo"
            },
            {
                id: "guide-14",
                title: "14 \u00b7 New Steem: The Retaliation",
                description: "Freeze for freeze, fork for fork: 64 accounts, $6.3M seized \u2014 and the Bittrex twist.",
                readTime: "5 min",
                href: GATEWAY + "KTp_6OXY52Y0MF7eV3lA2-IPdFoIJd5J5gg7nr7I5ZI"
            }
        ]
    },
    {
        id: "deep-dives",
        title: "Series 4 \u2014 Technology Deep Dives",
        description: "Witnesses, accounts, keys, bandwidth, and Hive's rewritten constitution \u2014 the machinery, opened.",
        icon: MemoryIcon,
        guides: [
            {
                id: "guide-15",
                title: "15 \u00b7 The 21 Witnesses",
                description: "Blocks, parameters and hardforks: the elected civil service \u2014 and the livestream that hires it.",
                readTime: "5 min",
                href: GATEWAY + "8gW_n-p_Zu7_wlrYX7eMY-DasbGdbaN5mGe3BH7qaDo"
            },
            {
                id: "guide-16",
                title: "16 \u00b7 Usernames, Not Addresses",
                description: "The account object: names as identity, keys as replaceable staff, multisig since 2016.",
                readTime: "5 min",
                href: GATEWAY + "TpDbap8HJzg1WIHCyIDtRgoqz3IJlTE2I0hGShiTZFA"
            },
            {
                id: "guide-17",
                title: "17 \u00b7 Four Keys & the Safety Net",
                description: "Posting, active, owner, memo \u2014 ranked by blast radius \u2014 plus the 30-day recovery.",
                readTime: "5 min",
                href: GATEWAY + "HTBlE18FE3NSXSAYlb9C9YyvBp5iN_AD-Y62g6axzBM"
            },
            {
                id: "guide-18",
                title: "18 \u00b7 Paying Without Fees",
                description: "Bandwidth and Resource Credits: meter the pipe, not the wallet \u2014 and delegation for onboarding.",
                readTime: "5 min",
                href: GATEWAY + "2QRVnrQEzanW4bxJqqd4WGuRRBCj-J6f8LKwRlbm-mg"
            },
            {
                id: "guide-19",
                title: "19 \u00b7 Hive, On Its Own Terms",
                description: "Scars to patches: the 30-day lock, the DHF, and the return-proposal decoy.",
                readTime: "5 min",
                href: GATEWAY + "umh3VYxo_jalONygcv4VCydwFGtOfZ_8E9NFZTMmLHI"
            }
        ]
    },
    {
        id: "pixa-platform",
        title: "Series 5 \u2014 The Pixa Platform",
        description: "Art as payload: the on-chain pipeline, the four render engines, and fifty years of pixels.",
        icon: PaletteIcon,
        guides: [
            {
                id: "guide-20",
                title: "20 \u00b7 Meet Pixagram",
                description: "The heir: 21 witnesses, 128 KB posts, and art stored as the payload \u2014 not a pointer.",
                readTime: "5 min",
                href: GATEWAY + "sVPGsm4qL3F4I4Fv7AMPBkaoN2VF3TQ6JarCKMHIgCM"
            },
            {
                id: "guide-21",
                title: "21 \u00b7 The On-Chain Pipeline",
                description: "From 2 MB to 19 KB: K-centroid, Kopf\u2013Lischinski, base64, block.",
                readTime: "5 min",
                href: GATEWAY + "p5Lr5DOWTSQTOBXPyfQO32trNe2saTbt4mTDajieAj0"
            },
            {
                id: "guide-22",
                title: "22 \u00b7 The Rendering Engines",
                description: "Squared, xBRZ, hexagonal, CRT \u2014 four personalities for the same pixels.",
                readTime: "5 min",
                href: GATEWAY + "zW4coxHNZMbzIGIf3QSBSvWs_d7cmnUIDWQbsI3eKXw"
            },
            {
                id: "guide-23",
                title: "23 \u00b7 A History of Pixel Art",
                description: "Fifty years in five acts: necessity, mastery, exile, renaissance, provenance.",
                readTime: "5 min",
                href: GATEWAY + "EsGDkUNZ9r063dMleGPzqtfzigO_sFNqn-fuNtF10ww"
            }
        ]
    },
    {
        id: "pixa-economy",
        title: "Series 6 \u2014 The Pixa Economy",
        description: "PXA, PXP and the Supra \u2014 and the genesis that answers the war at block zero.",
        icon: AccountBalanceIcon,
        guides: [
            {
                id: "guide-24",
                title: "24 \u00b7 Three Tokens: PXA, PXP, PXS",
                description: "Zero liquid at genesis, 100M PXP ever, and 0% for sitting still.",
                readTime: "5 min",
                href: GATEWAY + "jeFmaOikj9BDmiyXfrr7b0CSx9I0Y9Kiyr2xU1ISzBc"
            },
            {
                id: "guide-25",
                title: "25 \u00b7 The Supracoin",
                description: "PXS: the Big Mac reference, the two-median oracle, the print gate and the haircut.",
                readTime: "5 min",
                href: GATEWAY + "6lXdPWtSIg8FpTW9Msw_OTG3WNoWaO-MbEscEJ3e5uI"
            },
            {
                id: "guide-26",
                title: "26 \u00b7 Genesis Without a Ninja-Mine",
                description: "The war answered at block zero: four locks written in consensus, not promises.",
                readTime: "5 min",
                href: GATEWAY + "k6PT9UvPcCYn41rykfX7hJf3S1nQ2DLrC6gbPIu2BW4"
            }
        ]
    },
    {
        id: "practical",
        title: "Series 7 \u2014 Practical",
        description: "Hands-on: your first account, the Vault, and the whole network in twenty lines of dpixa.",
        icon: CodeIcon,
        guides: [
            {
                id: "guide-27",
                title: "27 \u00b7 Your First Account",
                description: "Master password, paper, bookmark, the Vault (Argon2id) \u2014 self-custody done safely.",
                readTime: "5 min",
                href: GATEWAY + "imQx_kuB3azx04g3E3VP8oW_0mVvwkQME2F4IERNhhs"
            },
            {
                id: "guide-28",
                title: "28 \u00b7 dpixa in Twenty Lines",
                description: "Connect, read, write, act: the whole network in four moves \u2014 the series finale.",
                readTime: "5 min",
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
                        {guide.title}
                    </Typography>
                    <Typography className={classes.guideDescription}>
                        {guide.description}
                    </Typography>
                    <div className={classes.guideFooter}>
                        <span className={classes.guideReadTime}>
                            <AccessTimeIcon className={classes.readTimeIcon} />
                            {guide.readTime}
                        </span>
                        <div className={classes.guideActions}>
                            {guide.video &&
                                <ButtonBase
                                    className={classes.actionButton}
                                    onClick={(event) => this._handlePlayVideo(event, guide)}
                                >
                                    <PlayArrowIcon className={classes.actionIcon} />
                                    VIDEO
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
                <Typography className={classes.sectionTitle}>{series.title}</Typography>
                <Typography className={classes.sectionDescription}>
                    {series.description}
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

export default withStyles(styles)(GDMethods);