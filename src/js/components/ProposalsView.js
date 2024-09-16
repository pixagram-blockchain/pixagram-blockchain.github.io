import * as React from "preact/compat";

import withStyles from "@material-ui/core/styles/withStyles";
import DialogContent from "@material-ui/core/DialogContent";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import Tooltip from "@material-ui/core/Tooltip";
import ButtonBase from "@material-ui/core/ButtonBase";
import Accordion from "@material-ui/core/Accordion";
import AccordionDetails from "@material-ui/core/AccordionDetails";
import AccordionSummary from "@material-ui/core/AccordionSummary";
import AccordionActions from "@material-ui/core/AccordionActions";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import InfoIcon from "@material-ui/icons/Info";
import Pageview from "@material-ui/icons/Pageview";
import { cssBackgroundImage, safeHttpUrl } from "../utils/safeUrl";

import { t } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";
const styles = theme => ({
    dialogContent: {
        margin: "12px 0px 24px 0px"
    },
    tooltip: {
        margin: "8px",
        display: "block",
        fontSize: "14px",
        lineHeight: "22px"
    },
    // DPF Stats Box Styles
    dpfStatsBox: {
        backgroundColor: "#101010",
        borderRadius: "16px",
        padding: "24px",
        display: "flex",
        margin: "16px 0px 24px 0px",
        transition: "background-color 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms",
        "&:hover": {
            backgroundColor: "#171717",
            transition: "background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        }
    },
    dpfStatsHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontFamily: "'Industry Book'",
    },
    dpfStatsTitle: {
        fontSize: "32px",
        fontWeight: 600,
        color: "#e0e0e0",
        display: "flex",
        alignItems: "center",
        gap: "8px"
    },
    dpfInfoIcon: {
        fontSize: "18px",
        color: "#888",
        cursor: "pointer",
        transition: "color 150ms ease",
        "&:hover": {
            color: "#aaa"
        }
    },
    dpfStatsGrid: {
        display: "flex",
        flex: "1 1 auto",
        flexWrap: "wrap",
        gap: "24px",
        [theme.breakpoints.down("sm")]: {
            gap: "16px"
        }
    },
    dpfStatItem: {
        flex: "1 1 auto",
        minWidth: "120px",
        textAlign: "center",
        [theme.breakpoints.down("sm")]: {
            minWidth: "calc(50% - 16px)"
        }
    },
    dpfStatLabel: {
        fontSize: "14px",
        fontWeight: 500,
        color: "#888",
        textTransform: "uppercase",
        fontFamily: "'Industry Book'",
        letterSpacing: "0.5px",
        marginBottom: "4px"
    },
    dpfStatValue: {
        fontSize: "21px",
        fontWeight: 500,
        color: "#ffffff",
        fontFamily: "'Geist Mono', monospace"
    },
    // Proposal Accordion Styles
    proposalAccordion: {
        backgroundColor: "#101010 !important",
        borderRadius: "16px !important",
        marginBottom: "12px !important",
        "&.Mui-expanded": {
            margin: "0px 0px 12px 0px !important",
            backgroundColor: "#171717 !important"
        },
        transition: "background-color 200ms ease, border-color 200ms ease",
    },
    proposalSummary: {
        padding: "8px 20px",
        minHeight: "80px !important",
        "&.Mui-expanded": {
            minHeight: "80px !important"
        },
        "& .MuiAccordionSummary-content": {
            margin: "12px 0px !important",
            alignItems: "flex-start",
            flexDirection: "column",
            gap: "8px",
            [theme.breakpoints.up("md")]: {
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between"
            }
        },
        "& .MuiAccordionSummary-expandIcon": {
            color: "#888"
        }
    },
    proposalMainInfo: {
        flex: "1 1 auto",
        display: "flex",
        flexDirection: "column",
        gap: "6px"
    },
    proposalTitleRow: {
        display: "flex",
        alignItems: "center",
        gap: "16px",
        flexWrap: "wrap",
        fontSize: "14px",
        marginBottom: "2px"
    },
    proposalId: {
        fontSize: "13px",
        fontWeight: 500,
        color: "#666",
        fontFamily: "'Geist Mono', monospace"
    },
    proposalMeta: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        flexWrap: "wrap"
    },
    proposalDate: {
        fontSize: "12px",
        color: "#777",
        fontFamily: "'Geist Mono', monospace"
    },
    proposalFunding: {
        fontSize: "12px",
        fontWeight: 600,
        color: "#ffffff",
        fontFamily: "'Geist Mono', monospace"
    },
    proposalDaily: {
        fontSize: "11px",
        color: "#888",
        fontFamily: "'Geist Mono', monospace"
    },
    proposalStatusChip: {
        fontSize: "10px",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        padding: "2px 8px",
        borderRadius: "12px",
        backgroundColor: "#ffffff",
        color: "#000000"
    },
    proposalTitle: {
        color: "#fff",
    },
    proposalTitleExpired: {
        color: "#333",
    },
    proposalTitlePending: {
        color: "#999",
    },
    proposalStatusChipPending: {
        backgroundColor: "#999",
        color: "#111"
    },
    proposalStatusChipExpired: {
        backgroundColor: "#444",
        color: "#9e9e9e"
    },
    proposalVoteInfo: {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: "4px",
        minWidth: "100px",
        [theme.breakpoints.down("sm")]: {
            alignItems: "flex-start",
            marginTop: "8px"
        }
    },
    proposalVoteCount: {
        fontSize: "18px",
        fontWeight: 700,
        color: "#e0e0e0",
        fontFamily: "'Geist Mono', monospace",
        display: "flex",
        alignItems: "center",
        gap: "6px"
    },
    proposalVoteLabel: {
        fontSize: "10px",
        color: "#777",
        textTransform: "uppercase",
        letterSpacing: "0.5px"
    },
    proposalDetails: {
        padding: "16px 24px",
        flexDirection: "column"
    },
    proposalAuthorRow: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        marginBottom: "16px"
    },
    proposalAuthorAvatar: {
        width: 36,
        height: 36,
        borderRadius: "10px",
        backgroundSize: "cover",
        backgroundPosition: "center"
    },
    proposalAuthorInfo: {
        display: "flex",
        flexDirection: "column"
    },
    proposalAuthorName: {
        fontSize: "16px",
        fontWeight: 600,
        color: "#ffffff",
        fontFamily: "'Industry Book'",
    },
    proposalReceiverName: {
        fontSize: "14px",
        color: "#888",
        fontFamily: "'Industry Book'",
    },
    proposalDescription: {
        fontSize: "14px",
        lineHeight: 1.6,
        color: "#aaa",
        marginBottom: "16px"
    },
    proposalStatsRow: {
        display: "flex",
        flexWrap: "wrap",
        gap: "24px",
        marginTop: "12px",
        padding: "16px",
        backgroundColor: "#101010",
        borderRadius: "16px"
    },
    proposalStatBlock: {
        flex: "1 1 auto",
        minWidth: "90px",
        textAlign: "center"
    },
    proposalStatBlockLabel: {
        fontSize: "12px",
        color: "#666",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        marginBottom: "4px",
        fontFamily: "'Industry Book'",
        fontWeight: "bold"
    },
    proposalStatBlockValue: {
        fontSize: "16px",
        fontWeight: 400,
        color: "#e0e0e0",
        fontFamily: "'Geist Mono', monospace"
    },
    proposalActions: {
        padding: "12px 16px",
        justifyContent: "space-between",
        borderRadius: "0px 0px 16px 16px"
    },
    proposalLinkButton: {
        color: "#888",
        fontSize: "12px",
        textTransform: "none",
        "&:hover": {
            color: "#fbfbfb",
            backgroundColor: "transparent"
        }
    }
});

// Proposal Item Component
const ProposalItem = ({ classes, proposal, onVote }) => {
    const getStatusChipClass = (status) => {
        switch (status) {
            case 'active':
                return classes.proposalStatusChip;
            case 'pending':
                return `${classes.proposalStatusChip} ${classes.proposalStatusChipPending}`;
            case 'expired':
                return `${classes.proposalStatusChip} ${classes.proposalStatusChipExpired}`;
            default:
                return classes.proposalStatusChip;
        }
    };

    const getTitleClass = (status) => {
        switch (status) {
            case 'active':
                return classes.proposalTitle;
            case 'pending':
                return classes.proposalTitlePending;
            case 'expired':
                return classes.proposalTitleExpired;
            default:
                return classes.proposalTitle;
        }
    };

    const formatVotes = (votes) => {
        if (votes >= 1000000) {
            return `${(votes / 1000000).toFixed(2)}m`;
        } else if (votes >= 1000) {
            return `${(votes / 1000).toFixed(1)}k`;
        }
        return votes.toString();
    };

    const formatPXS = (amount) => {
        if (amount >= 1000) {
            return `${(amount / 1000).toFixed(2)}k PXS`;
        }
        return `${amount} PXS`;
    };

    return (
        <Accordion className={classes.proposalAccordion}>
            <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                className={classes.proposalSummary}
            >
                <div className={classes.proposalMainInfo}>
                    <div className={classes.proposalTitleRow}>
                        <span className={getTitleClass(proposal.status)}>{proposal.title}</span>
                        <span className={classes.proposalId}>#{proposal.id}</span>
                        <span className={getStatusChipClass(proposal.status)}>{proposal.status}</span>
                    </div>
                    <div className={classes.proposalMeta}>
                        <span className={classes.proposalDate}>
                            {proposal.startDate} - {proposal.endDate} ({proposal.duration})
                        </span>
                        <span className={classes.proposalFunding}>{formatPXS(proposal.totalFunding)}</span>
                        <span className={classes.proposalDaily}>{t("components.proposals_view.daily_pxs", {
                                dailyPay: proposal.dailyPay
                            })}</span>
                    </div>
                </div>
                <div className={classes.proposalVoteInfo}>
                    <span className={classes.proposalVoteCount}>
                        {formatVotes(proposal.votes)}
                    </span>
                    <span className={classes.proposalVoteLabel}>{t("words.pixa_power")}</span>
                </div>
            </AccordionSummary>
            <AccordionDetails className={classes.proposalDetails}>
                <div className={classes.proposalAuthorRow}>
                    <ButtonBase style={{ borderRadius: "10px" }}>
                        <div
                            className={`pixelated ${classes.proposalAuthorAvatar}`}
                            style={{ backgroundImage: cssBackgroundImage(proposal.authorImage) }}
                        />
                    </ButtonBase>
                    <div className={classes.proposalAuthorInfo}>
                        <span className={classes.proposalAuthorName}>@{proposal.author}</span>
                        {proposal.receiver && proposal.receiver !== proposal.author && (
                            <span className={classes.proposalReceiverName}>{t("words.for_receiver", {
                                    receiver: proposal.receiver
                                })}</span>
                        )}
                    </div>
                </div>
                <Typography className={classes.proposalDescription}>
                    {proposal.description}
                </Typography>
                <div className={classes.proposalStatsRow}>
                    <div className={classes.proposalStatBlock}>
                        <div className={classes.proposalStatBlockLabel}>{t("components.proposals_view.total_requested")}</div>
                        <div className={classes.proposalStatBlockValue}>{formatPXS(proposal.totalFunding)}</div>
                    </div>
                    <div className={classes.proposalStatBlock}>
                        <div className={classes.proposalStatBlockLabel}>{t("components.proposals_view.daily_pay")}</div>
                        <div className={classes.proposalStatBlockValue}>{proposal.dailyPay} PXS</div>
                    </div>
                    <div className={classes.proposalStatBlock}>
                        <div className={classes.proposalStatBlockLabel}>{t("components.proposals_view.paid_out")}</div>
                        <div className={classes.proposalStatBlockValue}>{formatPXS(proposal.paidOut)}</div>
                    </div>
                    <div className={classes.proposalStatBlock}>
                        <div className={classes.proposalStatBlockLabel}>{t("components.proposals_view.remaining")}</div>
                        <div className={classes.proposalStatBlockValue}>{formatPXS(proposal.remaining)}</div>
                    </div>
                    <div className={classes.proposalStatBlock}>
                        <div className={classes.proposalStatBlockLabel}>{t("words.days_left")}</div>
                        <div className={classes.proposalStatBlockValue}>{proposal.daysRemaining}</div>
                    </div>
                </div>
            </AccordionDetails>
            <AccordionActions className={classes.proposalActions}>
                <Button
                    className={classes.proposalLinkButton}
                    startIcon={<Pageview />}
                    {...(safeHttpUrl(proposal.link)
                        ? { href: safeHttpUrl(proposal.link), target: "_blank", rel: "noopener noreferrer" }
                        : { disabled: true })}
                >
                    {t("words.view_proposal")}
                </Button>
                <div>
                    <Button variant={"contained"} onClick={() => onVote && onVote(proposal.id)}>
                        {t("components.proposals_view.vote")}
                    </Button>
                </div>
            </AccordionActions>
        </Accordion>
    );
};

// Demo proposal data
const DEMO_PROPOSALS = [
    {
        id: 350,
        title: "Pixagram Core Development & Infrastructure",
        status: "active",
        startDate: "Jun 25, 2025",
        endDate: "Jun 26, 2026",
        duration: "366 days",
        totalFunding: 232410,
        dailyPay: 635,
        votes: 67890000,
        author: "pixadev",
        receiver: "pixa.fund",
        authorImage: "https://images.hive.blog/u/pixadev/avatar",
        description: "Ongoing development and maintenance of Pixagram's core blockchain infrastructure, including witness nodes, API endpoints, and network security improvements. This proposal covers server costs, developer salaries, and essential tooling.",
        paidOut: 131946,
        remaining: 100464,
        daysRemaining: 149,
        link: "/@pixadev/pixagram-core-development-proposal"
    },
    {
        id: 336,
        title: "Pixa Mobile App Development & Maintenance",
        status: "active",
        startDate: "Mar 21, 2025",
        endDate: "Jun 21, 2026",
        duration: "457 days",
        totalFunding: 180970,
        dailyPay: 396,
        votes: 63220000,
        author: "pixamobile",
        authorImage: "https://images.hive.blog/u/ecency/avatar",
        description: "Development and maintenance of the official Pixa mobile application for iOS and Android. Includes new features, bug fixes, performance optimizations, and user experience improvements.",
        paidOut: 123766,
        remaining: 57204,
        daysRemaining: 144,
        link: "/@pixamobile/pixa-mobile-development-5"
    },
    {
        id: 359,
        title: "Pixa Art Database & NFT Indexer",
        status: "active",
        startDate: "Oct 10, 2025",
        endDate: "Oct 10, 2026",
        duration: "365 days",
        totalFunding: 13140,
        dailyPay: 36,
        votes: 61210000,
        author: "pixaindex",
        authorImage: "https://images.hive.blog/u/mahdiyari/avatar",
        description: "Maintenance of the public Pixa Art database and NFT indexing infrastructure. Provides free API access for developers building on the Pixagram ecosystem.",
        paidOut: 3960,
        remaining: 9180,
        daysRemaining: 255,
        link: "/@pixaindex/pixa-art-database-maintenance"
    },
    {
        id: 341,
        title: "Pixa Wallet Browser Extension 2025",
        status: "active",
        startDate: "May 15, 2025",
        endDate: "May 15, 2026",
        duration: "365 days",
        totalFunding: 219000,
        dailyPay: 600,
        votes: 58190000,
        author: "pixawallet",
        authorImage: "https://images.hive.blog/u/keychain/avatar",
        description: "Development of Pixa Wallet, a secure browser extension for managing Pixa tokens, signing transactions, and interacting with dApps on the Pixagram blockchain.",
        paidOut: 153000,
        remaining: 66000,
        daysRemaining: 110,
        link: "/@pixawallet/pixa-wallet-development-2025"
    },
    {
        id: 344,
        title: "Pixagram Core Protocol Development Year 2",
        status: "active",
        startDate: "Apr 30, 2025",
        endDate: "May 1, 2026",
        duration: "366 days",
        totalFunding: 128100,
        dailyPay: 350,
        votes: 57360000,
        author: "pixacore",
        authorImage: "https://images.hive.blog/u/howo/avatar",
        description: "Continued development of Pixagram's core protocol, including consensus improvements, transaction throughput optimization, and new blockchain features for the pixel art and NFT ecosystem.",
        paidOut: 94500,
        remaining: 33600,
        daysRemaining: 96,
        link: "/@pixacore/core-development-year-2"
    }
];

const UNFUNDED_PROPOSALS = [
    {
        id: 362,
        title: "Pixagram Gaming SDK & Integration Tools",
        status: "pending",
        startDate: "Feb 1, 2026",
        endDate: "Feb 1, 2027",
        duration: "365 days",
        totalFunding: 91250,
        dailyPay: 250,
        votes: 12500000,
        author: "pixagames",
        authorImage: "https://images.hive.blog/u/splinterlands/avatar",
        description: "Development of a comprehensive SDK for game developers to integrate Pixagram NFTs and tokens into their games. Includes documentation, sample projects, and developer support.",
        paidOut: 0,
        remaining: 91250,
        daysRemaining: 365,
        link: "/@pixagames/gaming-sdk-proposal"
    },
    {
        id: 358,
        title: "Pixa Art Education & Onboarding Program",
        status: "pending",
        startDate: "Jan 15, 2026",
        endDate: "Jul 15, 2026",
        duration: "181 days",
        totalFunding: 27150,
        dailyPay: 150,
        votes: 8200000,
        author: "pixaedu",
        authorImage: "https://images.hive.blog/u/hiveonboard/avatar",
        description: "Educational program to onboard new pixel artists to the Pixagram ecosystem. Includes tutorials, workshops, and mentorship programs for emerging creators.",
        paidOut: 0,
        remaining: 27150,
        daysRemaining: 181,
        link: "/@pixaedu/education-onboarding-program"
    }
];

class ProposalsView extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            filter: "all"
        };
    }

    _handleProposalVote = (proposalId) => {
        console.log("Voting for proposal:", proposalId);
        // Implement vote logic here
    }

    _handleFilterChange = (filter) => {
        this.setState({ filter });
    }

    render() {
        const { classes } = this.props;

        return (
            <DialogContent scroll={"paper"} className={classes.dialogContent}>
                {/* DPF Statistics Box */}
                <div className={classes.dpfStatsBox}>
                    <div className={classes.dpfStatsHeader}>
                        <span className={classes.dpfStatsTitle}>
                            {t("words.dao_treasury")}
                            <Tooltip
                                arrow
                                interactive
                                title={
                                    <div className={classes.tooltip}>
                                        {t("components.proposals_view.the_decentralized_pixa_fund_dpf_is_an")}
                                    </div>
                                }
                            >
                                <InfoIcon className={classes.dpfInfoIcon} />
                            </Tooltip>
                        </span>
                    </div>
                    <div className={classes.dpfStatsGrid}>
                        <div className={classes.dpfStatItem}>
                            <div className={classes.dpfStatLabel}>{t("components.proposals_view.daily_funded")}</div>
                            <div className={classes.dpfStatValue}>{t("components.proposals_view.pxs_97_1k")}</div>
                        </div>
                        <div className={classes.dpfStatItem}>
                            <div className={classes.dpfStatLabel}>{t("components.proposals_view.daily_budget")}</div>
                            <div className={classes.dpfStatValue}>{t("components.proposals_view.pxs_250_0k")}</div>
                        </div>
                        <div className={classes.dpfStatItem}>
                            <div className={classes.dpfStatLabel}>{t("components.proposals_view.total_budget")}</div>
                            <div className={classes.dpfStatValue}>{t("components.proposals_view.pxs_51_3m")}</div>
                        </div>
                    </div>
                </div>
                {/* Active Proposals */}
                {DEMO_PROPOSALS.map((proposal) => (
                    <ProposalItem
                        key={proposal.id}
                        classes={classes}
                        proposal={proposal}
                        onVote={this._handleProposalVote}
                    />
                ))}
                {/* Unfunded/Pending Proposals */}
                {UNFUNDED_PROPOSALS.map((proposal) => (
                    <ProposalItem
                        key={proposal.id}
                        classes={classes}
                        proposal={proposal}
                        onVote={this._handleProposalVote}
                    />
                ))}
            </DialogContent>
        );
    }
}

export default withLanguage(withStyles(styles)(ProposalsView));