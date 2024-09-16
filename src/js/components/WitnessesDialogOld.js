import * as React from "preact/compat";

import withStyles from "@material-ui/core/styles/withStyles";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import LinearProgress from '@material-ui/core/LinearProgress';
import Checkbox from '@material-ui/core/Checkbox';
import Tooltip from "@material-ui/core/Tooltip";
import TextField from "@material-ui/core/TextField";
import BlockViewer from "./BlockViewer";
import JSLoader from "../utils/JSLoader";
import Tab from "@material-ui/core/Tab";
import PieChart from "@material-ui/icons/PieChart";
import Tabs from "@material-ui/core/Tabs";
import SwipeableViews from "react-swipeable-views";
import Vote from "../icons/Vote";
import timeAgo from "../utils/TimeAgo";
import ButtonBase from "@material-ui/core/ButtonBase";
import IconButton from "@material-ui/core/IconButton";
import CloseIcon from "@material-ui/icons/Close";
import Description from "@material-ui/icons/Description";
import Accordion from "@material-ui/core/Accordion";
import AccordionDetails from "@material-ui/core/AccordionDetails";
import AccordionSummary from "@material-ui/core/AccordionSummary";
import AccordionActions from "@material-ui/core/AccordionActions";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import Chip from "@material-ui/core/Chip";
import Divider from "@material-ui/core/Divider";
import InfoIcon from "@material-ui/icons/Info";
import ThumbUpIcon from "@material-ui/icons/ThumbUp";
import LinkIcon from "@material-ui/icons/Link";
import {Pageview} from "@material-ui/icons";

const styles = theme => ({
    dialog: {
        "& .MuiDialog-paperScrollPaper": {
            maxHeight: "calc(100% - 60px)",
            [theme.breakpoints.down("sm")]: {
                maxHeight: "100%",
                minHeight: "100%",
                margin: "0px",
                borderRadius: "0px !important",
                display: "flex",
                flexDirection: "column"
            }
        },
        "& .MuiDialog-paperFullWidth": {
            [theme.breakpoints.down("sm")]: {
                width: "100% !important"
            }
        },
        "& .react-swipeable-view-container": {
            height: "max(80vh, calc(-372px + 100vh)) !important",
            [theme.breakpoints.down("sm")]: {
                flex: "1 1 auto !important",
                height: "auto !important"
            }
        },
        "& .react-swipeable-view-container > div": {
            height: "max(80vh, calc(-372px + 100vh)) !important",
            overflow: "hidden auto !important",
            [theme.breakpoints.down("sm")]: {
                height: "100% !important"
            }
        }
    },
    cardTabs: {
        backgroundColor: "#171717",
        "& .MuiTab-root": {
            minWidth: "72px !important"
        },
        "& .MuiTab-textColorPrimary.Mui-selected": {
            backgroundColor: "transparent",
        },
        "& .MuiTab-textColorPrimary.Mui-selected .MuiTab-wrapper": {
            color: "#171717 !important"
        },
        "& .MuiTab-fullWidth": {
            backgroundColor: "transparent",
            color: "#989898",
            transition: "all 225ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
            borderRadius: "21px"
        },
        "& .MuiTab-fullWidth:hover": {
            backgroundColor: "rgba(255,255,255,0.06)"
        },
        "& span.MuiTabs-indicator": {
            zIndex: "-1",
            height: "48px",
            backgroundColor: "#c7c7c7",
            borderRadius: "21px",
            transform: "scale3d(0.875, 0.75, 1)"
        },
        margin: "0px 16px 0px 16px",
        width: "calc(100% - 32px)",
        borderRadius: "21px",
        top: 0,
        left: 0,
        zIndex: 1,
        transition: "transform 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
    },
    subTitle: {
        margin: "24px 0px 12px 0px"
    },
    dialogContent: {
        margin: "12px 0px 24px 0px"
    },
    link: {
        cursor: "pointer",
        textDecoration: "underline"
    },
    boxContainer: {
        display: "flex",
        flexWrap: "wrap"
    },
    boxContainerBlocks: {
        display: "flex",
        flexFlow: "row",
        position: "relative",
        marginTop: "12px",
        overflowX: "hidden"
    },
    overlayBlocks: {
        pointerEvents: "none",
        position: "absolute",
        width: "100%",
        height: "100%",
        top: 0,
        left: 0,
        backgroundImage: "linear-gradient(to right, transparent 80%, black 100%)",
    },
    tooltip: {
        margin: "8px",
        display: "block",
        fontSize: "14px",
        lineHeight: "22px"
    },
    boxLarge: {
        userSelect: "none",
        cursor: "pointer",
        padding: 16,
        margin: 8,
        backgroundColor: "#88888833",
        flex: "1 1 calc(100% - 16px)",
        borderRadius: "21px",
        boxSizing: "border-box",
        transition: "background-color 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms",
        "&:hover": {
            backgroundColor: "#8888884d",
            transition: "background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        }
    },
    box: {
        userSelect: "none",
        cursor: "pointer",
        padding: 16,
        margin: 8,
        backgroundColor: "#88888833",
        borderRadius: "19px",
        boxSizing: "border-box",
        transition: "background-color 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms",
        flex: "1 1 calc(25% - 16px)",
        [theme.breakpoints.down("sm")]: {
            flex: "1 1 calc(50% - 16px)",
        },
        "&:hover": {
            backgroundColor: "#8888884d",
            transition: "background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        }
    },
    boxBlock: {
        userSelect: "none",
        cursor: "pointer",
        padding: 16,
        margin: 8,
        backgroundColor: "#88888833",
        flex: "0 0 20%",
        [theme.breakpoints.down("sm")]: {
            flex: "0 0 33%",
        },
        borderRadius: "21px",
        boxSizing: "border-box",
        transition: "background-color 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms",
        "&:hover": {
            backgroundColor: "#8888884d",
            transition: "background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        }
    },
    boxBlockDisabled: {
        userSelect: "none",
        cursor: "pointer",
        padding: 16,
        margin: 8,
        color: "#000",
        backgroundColor: "#ccc",
        flex: "0 0 20%",
        [theme.breakpoints.down("sm")]: {
            flex: "0 0 33%",
        },
        borderRadius: "21px",
        boxSizing: "border-box",
        transition: "background-color 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms",
        "&:hover": {
            color: "#111",
            backgroundColor: "#eee",
            transition: "background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        }
    },
    boxPrimary: {
        fontSize: "21px",
        fontWeight: "bold",
        color: "#fff",
        display: "block",
        marginBottom: "4px"
    },
    boxSecondary: {
        fontSize: "12px",
        color: "#999",
        display: "block"
    },
    nextBlockPrimary: {
        fontSize: "21px",
        color: "#000",
        display: "block",
        marginBottom: "4px"
    },
    nextBlockSecondary: {
        fontSize: "12px",
        color: "#222",
        display: "block"
    },
    linearProgress: {
        margin: "16px 0px 12px 0px",
        borderRadius: "6px",
        height: "18px",
        lineHeight: "18px",
        "@global": {
            "@keyframes glow": {
                "0%": {
                    background: "#3f3f3f",
                    color: "#d2d2d2"
                },
                "100%": {
                    background: "#595959",
                    color: "#fff"
                },
            }
        },
        "& div.MuiLinearProgress-barColorPrimary": {
            background: "#cdcdcd",
            "&::after": {
                content: `"Supra"`,
                position: "absolute",
                right: 8,
                bottom: 0,
                fontSize: "11px",
                color: "#000"
            },
        },
        "& div.MuiLinearProgress-colorPrimary": {
            "&::after": {
                content: `"Debt Limit"`,
                position: "absolute",
                right: 8,
                bottom: 0,
                fontSize: "11px",
                animation: "$glow 1s infinite linear alternate",
            },
            animation: "$glow 1s infinite linear alternate"
        },
        "& div.MuiLinearProgress-dashedColorPrimary": {
            background: "#2d2d2d",
            backgroundImage: "inherit",
            animation: "none",
            "&::after": {
                content: `"Pixa Backed"`,
                position: "absolute",
                right: 8,
                bottom: 0,
                fontSize: "11px",
                color: "#595959"
            },
        }
    },
    witnessTableWrapper: {
        overflowX: "auto",
        touchAction: "manipulation",
        contain: "style layout",
        "-webkit-overflow-scrolling": "touch"
    },
    witnessTable:  {
        width: "100%",
        minWidth: "700px",
        borderCollapse: "collapse",
        marginTop: theme.spacing(2),
        marginBottom: theme.spacing(1),
        fontSize: "0.875rem",
        "& tr > th": {
            backgroundColor: "#191919",
            padding: theme.spacing(1.5),
            textAlign: "left",
            fontWeight: 600,
            borderBottom: `0px solid #ffffff12`,
            transition: "background-color 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms",
        },
        "& tr:hover > th": {
            backgroundColor: "#222",
            transition: "background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        },
        "& tr > th:first-child": {
            borderRadius: "16px 0px 0px 0px"
        },
        "& tr > th:last-child": {
            borderRadius: "0px 16px 0px 0px",
        },
        "& tr > td": {
            backgroundColor: "transparent",
            transition: "background-color 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms",
        },
        "& tr:hover > td": {
            backgroundColor: "#171717",
            transition: "background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        },
        "& tr:last-child > td:first-child": {
            borderRadius: "0px 0px 0px 16px"
        },
        "& tr:last-child > td:last-child": {
            borderRadius: "0px 0px 16px 0px",
        },
        "& td": {
            padding: "4px 12px",
            borderBottom: `1px solid #ffffff12`
        },
        "& tr:last-child td": {
            borderBottom: "0px"
        },
        "& tbody": {
            backgroundColor: "#101010"
        }
    },
    closeButton: {
        position: "absolute",
        right: 8,
        top: 8
    },
    textFieldWrapper: {
        width: "100%",
        boxSizing: "border-box",
        margin: "8px 0px 16px 0px"
    },
    // Proposals Section Styles
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

// Proposal Component
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
                return `${classes.proposalTitlePending}`;
            case 'expired':
                return `${classes.proposalTitleExpired}`;
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
                        <span className={classes.proposalDate}>{proposal.startDate} - {proposal.endDate} ({proposal.duration})</span>
                        <span className={classes.proposalFunding}>{formatPXS(proposal.totalFunding)}</span>
                        <span className={classes.proposalDaily}>(Daily {proposal.dailyPay} PXS)</span>
                    </div>
                </div>
                <div className={classes.proposalVoteInfo}>
                    <span className={classes.proposalVoteCount}>
                        {formatVotes(proposal.votes)}
                    </span>
                    <span className={classes.proposalVoteLabel}>Pixa Power</span>
                </div>
            </AccordionSummary>
            <AccordionDetails className={classes.proposalDetails}>
                <div className={classes.proposalAuthorRow}>
                    <ButtonBase style={{ borderRadius: "10px" }}>
                        <div
                            className={`pixelated ${classes.proposalAuthorAvatar}`}
                            style={{ backgroundImage: `url(${proposal.authorImage})` }}
                        />
                    </ButtonBase>
                    <div className={classes.proposalAuthorInfo}>
                        <span className={classes.proposalAuthorName}>@{proposal.author}</span>
                        {proposal.receiver && proposal.receiver !== proposal.author && (
                            <span className={classes.proposalReceiverName}>for @{proposal.receiver}</span>
                        )}
                    </div>
                </div>
                <Typography className={classes.proposalDescription}>
                    {proposal.description}
                </Typography>
                <div className={classes.proposalStatsRow}>
                    <div className={classes.proposalStatBlock}>
                        <div className={classes.proposalStatBlockLabel}>Total Requested</div>
                        <div className={classes.proposalStatBlockValue}>{formatPXS(proposal.totalFunding)}</div>
                    </div>
                    <div className={classes.proposalStatBlock}>
                        <div className={classes.proposalStatBlockLabel}>Daily Pay</div>
                        <div className={classes.proposalStatBlockValue}>{proposal.dailyPay} PXS</div>
                    </div>
                    <div className={classes.proposalStatBlock}>
                        <div className={classes.proposalStatBlockLabel}>Paid Out</div>
                        <div className={classes.proposalStatBlockValue}>{formatPXS(proposal.paidOut)}</div>
                    </div>
                    <div className={classes.proposalStatBlock}>
                        <div className={classes.proposalStatBlockLabel}>Remaining</div>
                        <div className={classes.proposalStatBlockValue}>{formatPXS(proposal.remaining)}</div>
                    </div>
                    <div className={classes.proposalStatBlock}>
                        <div className={classes.proposalStatBlockLabel}>Days Left</div>
                        <div className={classes.proposalStatBlockValue}>{proposal.daysRemaining}</div>
                    </div>
                </div>
            </AccordionDetails>
            <AccordionActions className={classes.proposalActions}>
                <Button
                    className={classes.proposalLinkButton}
                    startIcon={<Pageview/>}
                    href={proposal.link}
                    target="_blank"
                >
                    View Proposal
                </Button>
                <div>
                    <Button  variant={"contained"} onClick={() => onVote && onVote(proposal.id)}>
                        Vote
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

class WitnessesDialog extends React.PureComponent {

    constructor(props) {
        super(props);
        this.state = {
            classes: props.classes,
            open: props.open,
            _authors: [],
            _tab_value: 0,
            _blocks_number: 0,
            _blockViewerOpen: false,
            _proposals_filter: "all"
        };
    };

    shouldComponentUpdate(nextProps, nextState, nextContext) {
        return false;
    }

    componentWillMount() {

    }

    componentDidMount() {
        JSLoader( () => import("../data/authors")).then((d1) => {
            const authors = d1.default();
            this.setState({_authors: authors}, () => {
                this.forceUpdate();
            });
        });
    }

    componentWillReceiveProps(nextProps, nextContext) {

        if(this.state.open !== nextProps.open) {
            this.setState({open: nextProps.open}, () => {
                this.forceUpdate(() => {

                    if(this.state.open) {

                        const interval = setInterval(() => {
                            this.setState({_blocks_number: this.state._blocks_number+1}, () => {
                                this.forceUpdate();
                            });
                            if(this.state._blocks_number >= 4) {
                                clearInterval(interval);
                            }
                        }, 3000);
                    }else {
                        this.setState({_blocks_number: 0}, () => {
                            this.forceUpdate();
                        });
                    }
                });
            });
        }
    }

    _handleTabChange = (e, value) => {
        this.setState({_tab_value: value}, () => {
            this.swipeableViewScrollTop();
            this.forceUpdate();
        })
    }

    swipeableViewScrollTop = () => {

        let views = document.getElementsByClassName("react-swipeable-view-container"), i = 0;
        let view = views.item(0);
        let child = view.children.item(0);
        child.style.scrollBehavior = "smooth";
        child.scrollTop = 0;
    };

    _set_block_viewer_open = () => {
        this.setState({_blockViewerOpen: true}, () => {
            this.forceUpdate();
        });
    }
    _set_block_viewer_close = () => {
        this.setState({_blockViewerOpen: false}, () => {
            this.forceUpdate();
        });
    }

    _handleTableTouchStart = (e) => {
        e.stopPropagation();
    }

    _handleProposalFilterChange = (filter) => {
        this.setState({ _proposals_filter: filter }, () => {
            this.forceUpdate();
        });
    }

    _handleProposalVote = (proposalId) => {
        console.log("Voting for proposal:", proposalId);
        // Implement vote logic here
    }

    _get_views = () => {

        const {
            classes,
            _authors,
            _blocks_number,
            _proposals_filter
        } = this.state;

        const _currentBlock = 12889222+_blocks_number;
        const _now = Date.now();

        const blocks_demo = [
            <div className={classes.boxBlock} onClick={this._set_block_viewer_open}>
                <span className={classes.boxPrimary}>{`#${ new Intl.NumberFormat("en-IN", {}).format(_currentBlock)}`}</span>
                <span className={classes.boxSecondary}>
                <span style={{color: "#fff"}}>@sophiajulio</span>
                <span> processed 73.6kB </span>
                <Tooltip arrow title={new Date(_now - 2100).toLocaleDateString("en", {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric'
                })}>
                    <span className={classes.subheaderDate}>{timeAgo.format(new Date(_now - 2100))}</span>
                </Tooltip>
                <span> with 1675 Transactions</span>
            </span>
            </div>,
            <div className={classes.boxBlock} onClick={this._set_block_viewer_open}>
                <span className={classes.boxPrimary}>{`#${ new Intl.NumberFormat("en-IN", {}).format(_currentBlock - 1)}`}</span>
                <span className={classes.boxSecondary}>
                <span style={{color: "#fff"}}>@debw</span>
                <span> processed 31.9kB </span>
                <Tooltip arrow title={new Date(_now - 5100).toLocaleDateString("en", {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric'
                })}>
                    <span className={classes.subheaderDate}>{timeAgo.format(new Date(_now - 5100))}</span>
                </Tooltip>
                <span> with 297 Transactions</span>
            </span>
            </div>,
            <div className={classes.boxBlock} onClick={this._set_block_viewer_open}>
                <span className={classes.boxPrimary}>{`#${ new Intl.NumberFormat("en-IN", {}).format(_currentBlock - 2)}`}</span>
                <span className={classes.boxSecondary}>
                <span style={{color: "#fff"}}>@fririus</span>
                <span> 19.2kB processed </span>
                <Tooltip arrow title={new Date(_now - 8100).toLocaleDateString("en", {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric'
                })}>
                    <span className={classes.subheaderDate}>{timeAgo.format(new Date(_now - 8100))}</span>
                </Tooltip>
                <span> with 143 Transactions</span>
            </span>
            </div>,
            <div className={classes.boxBlock} onClick={this._set_block_viewer_open}>
                <span className={classes.boxPrimary}>{`#${ new Intl.NumberFormat("en-IN", {}).format(_currentBlock - 3)}`}</span>
                <span className={classes.boxSecondary}>
                <span style={{color: "#fff"}}>@debw</span>
                <span> 41.7kB processed </span>
                <Tooltip arrow title={new Date(_now - 11100).toLocaleDateString("en", {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric'
                })}>
                    <span className={classes.subheaderDate}>{timeAgo.format(new Date(_now - 8100))}</span>
                </Tooltip>
                <span> with 452 Transactions</span>
                </span>
            </div>
        ];

        const blocks = blocks_demo.slice(-_blocks_number)

        return [
            <DialogContent scroll={"paper"} className={classes.dialogContent}>
                <Typography component={"h2"} variant={"h6"}>Status</Typography>
                <Typography component={"p"} variant={"body1"}>The system status.</Typography>
                <div className={classes.boxContainer}>
                    <div className={classes.box}>
                        <span className={classes.boxPrimary}>5M</span>
                        <span className={classes.boxSecondary}>Number of accounts</span>
                    </div>
                    <div className={classes.box}>
                        <span className={classes.boxPrimary}>5%</span>
                        <span className={classes.boxSecondary}>Of active accounts in the last 7 days</span>
                    </div>
                    <div className={classes.box}>
                        <span className={classes.boxPrimary}>$ 1.2 B</span>
                        <span className={classes.boxSecondary}>Market capitalisation</span>
                    </div>
                    <div className={classes.box}>
                        <span className={classes.boxPrimary}>+ 5K</span>
                        <span className={classes.boxSecondary}>New accounts in the last 7 days</span>
                    </div>
                    <div className={classes.box}>
                        <span className={classes.boxPrimary}>9.5%</span>
                        <span className={classes.boxSecondary}>Inflation per year</span>
                    </div>
                    <div className={classes.box}>
                        <span className={classes.boxPrimary}>3.0s</span>
                        <span className={classes.boxSecondary}>Block interval time</span>
                    </div>
                    <div className={classes.box}>
                        <span className={classes.boxPrimary}>$ 50M</span>
                        <span className={classes.boxSecondary}>Decentralized Pixa Fund</span>
                    </div>
                    <div className={classes.box}>
                        <span className={classes.boxPrimary}>$280K</span>
                        <span className={classes.boxSecondary}>Payout in the last 7 days for creator and curators</span>
                    </div>
                </div>
                <Typography component={"h2"} variant={"h6"}>Metrics</Typography>
                <Typography component={"p"} variant={"body1"}>Only next witnesses can modify the metrics.</Typography>
                <div className={classes.boxContainer}>
                    <Tooltip title={
                        <div className={classes.tooltip}>
                            <span>PixaSupra is a type of token which is pegged to something that should equate <a style={{color: "#000"}} href={"https://truflation.com/marketplace/us-big-mac"} target={"_blank"}>big mac index of the united state</a>. Similar to most StableCoin, its algorithms ensure the coin is always valued at the price of this meal.</span>
                        </div>
                    } interactive arrow>
                        <div className={classes.box}>
                            <span className={classes.boxPrimary}>$ 5.69</span>
                            <span className={classes.boxSecondary}>Recommended price of one PixaSupra (PS)</span>
                        </div>
                    </Tooltip>
                    <Tooltip title={
                        <div className={classes.tooltip}>
                            <span>The price feed for the PixaSupra versus Pixa is around 1:57. The price feed is used to balance the incentive between currencies. The SupraPixa versus Pixa reserve seek an equilibrium there should be <b>3x more</b> liquid token than the pegged one. It means we have now a margin of <b>4.1x</b> for correcting the supply, if the price drop by this much, the haircut rule apply.</span>
                        </div>
                    } interactive arrow>
                        <div className={classes.box}>
                            <span className={classes.boxPrimary}>1 : 57</span>
                            <span className={classes.boxSecondary}>Conversion rate PS / PL</span>
                        </div>
                    </Tooltip>
                    <Tooltip title={
                        <div className={classes.tooltip}>
                            <span>Based on the price feed (1:57) and the PixaSupra (Mostly like the Big mac index) the average price for one pixa token is around 10 cents USD.</span>
                        </div>
                    } interactive arrow>
                        <div className={classes.box}>
                            <span className={classes.boxPrimary}>$ 0.10</span>
                            <span className={classes.boxSecondary}>Price of one PixaLiquid (PL)</span>
                        </div>
                    </Tooltip>
                    <Tooltip title={
                        <div className={classes.tooltip}>
                            <span>Similar to most StableCoin, its algorithms requires however manual input for course correction, a fair APR enable the system to adapt to the price feed voted onto and reward users for long term stacking.</span>
                        </div>
                    } interactive arrow>
                        <div className={classes.box}>
                            <span className={classes.boxPrimary}>0%</span>
                            <span className={classes.boxSecondary}>Recommended APR on the stacking of PixaSupra.</span>
                        </div>
                    </Tooltip>
                    <Tooltip title={
                        <div className={classes.tooltip}>
                            <span>The blockchain can emit various ratio of PixaSupra versus Pixa. Since PixaSupra is backed by Pixa, PixaSupra acts as debt of the blockchain.</span>
                        </div>
                    } interactive arrow>
                        <div className={classes.boxLarge}>
                            <span className={classes.boxPrimary}>8.1% / 30% (3.7x margin)</span>
                            <LinearProgress className={classes.linearProgress} variant="buffer" value={8.1} valueBuffer={30} />
                            <span className={classes.boxSecondary}>Pixa Supra should never surpass 30% of Pixa capitalization.<br/>So the price of Pixa could drop by 3.7x without any consequences. A possible consequence is an "haircut" to Pixa Supra (reducing it's issuing).</span>
                        </div>
                    </Tooltip>
                </div>
                <Typography component={"h2"} variant={"h6"}>Blocks</Typography>
                <Typography component={"p"} variant={"body1"}>The blockchain produces a block every 3 seconds while the primary node (witness) rotates.</Typography>
                <div className={classes.boxContainerBlocks}>
                    <div className={classes.overlayBlocks}></div>
                    <div className={classes.boxBlockDisabled}>
                        <span className={classes.nextBlockPrimary}>Next Block</span>
                        <span className={classes.nextBlockSecondary}>In 1 Second by @primerz</span>
                    </div>
                    {blocks}
                </div>
                <Typography component={"h2"} variant={"h6"} style={{marginTop: 12}}>Endpoint</Typography>
                <p>You can choose the node of the blockchain you connect to interact with the network.</p>
                <List>
                    <ListItem>
                        <ListItemText primary={"https://api.pixagram.com"} secondary={"Located in Monaco"}/>
                    </ListItem>
                </List>
            </DialogContent>,
            <DialogContent scroll={"paper"} className={classes.dialogContent}>
                <Typography component={"h2"} variant={"h6"} style={{marginTop: 12}}>Voting</Typography>
                <p>You can delegate your vote if you prefer, or vote for someone who's not listed here.</p>
                <div className={classes.textFieldWrapper}>
                    <TextField id="custom-witness" label="@username" variant="outlined" fullWidth/>
                </div>
                <div style={{textAlign: "right"}}>
                    <Button>Vote For Account</Button>
                    <Button>Delegate My Vote</Button>
                </div>
                <Typography component={"h2"} variant={"h6"} style={{marginTop: 12}}>Top Witnesses</Typography>
                <p>You can vote for up to 30 witnesses while only 21 witnesses are required to quite randomly lead the blockchain.</p>
                <div className={classes.witnessTableWrapper} onTouchStart={this._handleTableTouchStart} onTouchMove={this._handleTableTouchStart}>
                    <table className={classes.witnessTable}>
                        <thead>
                        <tr style={{textAlign: "left"}}>
                            <th>Rank</th>
                            <th>Witness</th>
                            <th>Version</th>
                            <th>Votes</th>
                            <th>Last Block</th>
                            <th>Miss</th>
                            <th>Price Feed</th>
                            <th>Voted</th>
                        </tr>
                        </thead>
                        <tbody>
                        {Object.values(_authors).map((value, index) => {
                            const labelId = `checkbox-list-secondary-label-${value.username}`;

                            return (
                                <tr key={index}>
                                    <td style={{fontFamily: `'Geist Mono'`, fontWeight: "bold"}}>#{index+1}</td>
                                    <td style={{display: "flex", gap: 8}}>
                                        <ButtonBase style={{ margin: "8px 8px 8px 0px", borderRadius: "12px"}}>
                                            <div className={"pixelated"} style={{backgroundSize: "cover", backgroundImage: `url(${value.image})`, width: 42, height: 42, borderRadius: "12px"}}></div>
                                        </ButtonBase>
                                        <div style={{marginLeft: 8}}>
                                            <strong style={{display: "block", fontSize: "14px", fontFamily: `'Industry Book'`}}>{`@${value.username}`}</strong>
                                            <span style={{marginTop: "4px", color: "#999", display: "block", fontSize: "11px", fontFamily: `''Normative Pro''`}}>{`${value.description}`}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{margin: "8px", padding: "4px 8px", borderRadius: "8px", backgroundColor: "#333", color: "fff", fontWeight: "bold", fontFamily: "'Geist Mono'"}}>1.28.3</div>
                                    </td>
                                    <td style={{fontFamily: `'Geist Mono'`}}>
                                        89
                                    </td>
                                    <td>
                                        <div style={{fontSize: "12px", fontFamily: "'Geist Mono'"}}>#906738</div>
                                        <div style={{fontSize: "8px"}}>(1 second ago)</div>
                                    </td>
                                    <td style={{fontFamily: `'Geist Mono'`}}>
                                        89
                                    </td>
                                    <td style={{fontFamily: `'Geist Mono'`}}>
                                        $0.25
                                    </td>
                                    <td>
                                        <Checkbox
                                            edge="end"
                                            inputProps={{ 'aria-labelledby': labelId }}
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>
            </DialogContent>,
            <DialogContent scroll={"paper"} className={classes.dialogContent}>
                {/* DPF Statistics Box */}
                <div className={classes.dpfStatsBox}>
                    <div className={classes.dpfStatsHeader}>
                        <span className={classes.dpfStatsTitle}>
                            DAO Treasury
                            <Tooltip
                                arrow
                                interactive
                                title={
                                    <div className={classes.tooltip}>
                                        The Decentralized Pixa Fund (DPF) is an on chain decentralized autonomous organisation treasury that allows users to submit proposals for funding and vote on which proposals should be funded.
                                    </div>
                                }
                            >
                                <InfoIcon className={classes.dpfInfoIcon} />
                            </Tooltip>
                        </span>
                    </div>
                    <div className={classes.dpfStatsGrid}>
                        <div className={classes.dpfStatItem}>
                            <div className={classes.dpfStatLabel}>Daily Funded</div>
                            <div className={classes.dpfStatValue}>PXS 97.1K</div>
                        </div>
                        <div className={classes.dpfStatItem}>
                            <div className={classes.dpfStatLabel}>Daily Budget</div>
                            <div className={classes.dpfStatValue}>PXS 250.0K</div>
                        </div>
                        <div className={classes.dpfStatItem}>
                            <div className={classes.dpfStatLabel}>Total Budget</div>
                            <div className={classes.dpfStatValue}>PXS 51.3M</div>
                        </div>
                    </div>
                </div>

                {DEMO_PROPOSALS.map((proposal) => (
                    <ProposalItem
                        key={proposal.id}
                        classes={classes}
                        proposal={proposal}
                        onVote={this._handleProposalVote}
                    />
                ))}

                {UNFUNDED_PROPOSALS.map((proposal) => (
                    <ProposalItem
                        key={proposal.id}
                        classes={classes}
                        proposal={proposal}
                        onVote={this._handleProposalVote}
                    />
                ))}
            </DialogContent>
        ]
    }

    render() {

        const {
            classes,
            open,
            keepMounted,
            _authors,
            _tab_value,
            _blockViewerOpen
        } = this.state;

        return (
            <React.Fragment>
                <Dialog className={classes.dialog}
                        open={open}
                        maxWidth={"lg"}
                        fullWidth={true}
                        disablePortal={false}
                        onClose={this.props.onClose}
                        keepMounted={false}>
                    <DialogTitle style={{display: "flex", margin: "0px 0px 0px 0px", position: "relative"}}>
                        <Typography component={"h1"} variant={"h4"} style={{float: "left", width: "100%", margin: "0px"}}>Governance</Typography>
                        <IconButton className={classes.closeButton} onClick={this.props.onClose} aria-label="close">
                            <CloseIcon />
                        </IconButton>
                    </DialogTitle>
                    <Tabs
                        className={classes.cardTabs}
                        value={_tab_value}
                        variant="fullWidth"
                        indicatorColor="primary"
                        textColor="primary"
                        onChange={this._handleTabChange}
                        fullwidth={true}
                    >
                        <Tab icon={<PieChart/>} />
                        <Tab icon={<Vote/>} />
                        <Tab icon={<Description/>} />
                    </Tabs>
                    <SwipeableViews
                        ignoreNativeScroll={true}
                        containerStyle={{height: "100%"}}
                        animateHeight={false}
                        animateTransitions={true}
                        disableLazyLoading={true}
                        resistance={true}
                        springConfig={{tension: 450, friction: 60, duration: '120ms', easeFunction: 'cubic-bezier(0.280, 0.840, 0.420, 1)', delay: '5ms'}}
                        index={_tab_value}
                        onChangeIndex={(v) => this._handleTabChange({}, v)}
                        disabled={false}
                        key={"swipe-able-view"}
                    >
                        {this._get_views()}
                    </SwipeableViews>
                </Dialog>
                <BlockViewer open={_blockViewerOpen} onClose={this._set_block_viewer_close}/>
            </React.Fragment>
        );
    }
}

export default withStyles(styles)(WitnessesDialog);