import * as React from "preact/compat";

import withStyles from "@material-ui/core/styles/withStyles";
import DialogContent from "@material-ui/core/DialogContent";
import Typography from "@material-ui/core/Typography";
import ButtonBase from "@material-ui/core/ButtonBase";
import ForumIcon from "@material-ui/icons/Forum";
import GavelIcon from "@material-ui/icons/Gavel";
import CampaignIcon from "../icons/Campaign";
import AccountBalanceIcon from "@material-ui/icons/AccountBalance";
import WarningIcon from "@material-ui/icons/Warning";
import SecurityIcon from "@material-ui/icons/Security";
import BugReportIcon from "@material-ui/icons/BugReport";
import GroupIcon from "@material-ui/icons/Group";

import { t } from "../utils/text";

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
    topicsGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "16px",
        marginBottom: "24px"
    },
    topicTile: {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        padding: "24px",
        backgroundColor: "#101010",
        borderRadius: "16px",
        textAlign: "left",
        transition: "background-color 200ms ease",
        position: "relative",
        overflow: "hidden",
        "&:hover": {
            backgroundColor: "#171717"
        }
    },
    topicBackgroundIcon: {
        position: "absolute",
        top: "-10px",
        right: "-10px",
        fontSize: "100px",
        color: "#fff",
        opacity: 0.05,
        pointerEvents: "none"
    },
    topicContent: {
        position: "relative",
        zIndex: 1,
        width: "100%"
    },
    topicTitle: {
        fontSize: "18px",
        fontWeight: 600,
        color: "#fff",
        fontFamily: "'Industry Book'",
        marginBottom: "8px"
    },
    topicDescription: {
        fontSize: "13px",
        color: "#888",
        fontFamily: "'Normative Pro'",
        lineHeight: 1.6,
        marginBottom: "16px"
    },
    topicMeta: {
        display: "flex",
        alignItems: "center",
        gap: "16px",
        width: "100%"
    },
    topicStat: {
        display: "flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "12px",
        fontFamily: "'Normative Pro'",
        color: "#666"
    },
    topicStatValue: {
        fontFamily: "'Geist Mono', monospace"
    },
    topicStatIcon: {
        fontSize: "14px"
    },
    urgentBadge: {
        position: "absolute",
        top: "12px",
        right: "12px",
        fontSize: "10px",
        fontWeight: 600,
        fontFamily: "'Industry Book'",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        padding: "4px 8px",
        borderRadius: "8px",
        backgroundColor: "#333",
        color: "#fff",
        zIndex: 2
    }
});

const TOPICS = [
    {
        id: "discussion",
        title: "Discussion",
        description: "General discussions about the Pixagram ecosystem, feature requests, and community feedback.",
        icon: ForumIcon,
        posts: 1247,
        active: 89,
        link: "/c/discussion"
    },
    {
        id: "governance",
        title: "Governance",
        description: "Proposals, voting discussions, and decision-making processes for the ecosystem.",
        icon: GavelIcon,
        posts: 456,
        active: 34,
        link: "/c/governance"
    },
    {
        id: "marketing",
        title: "Marketing",
        description: "Marketing initiatives, partnerships, and promotional campaigns for Pixagram.",
        icon: CampaignIcon,
        posts: 324,
        active: 18,
        link: "/c/marketing"
    },
    {
        id: "legal",
        title: "Legal",
        description: "Legal considerations, compliance discussions, and regulatory updates affecting the ecosystem.",
        icon: AccountBalanceIcon,
        posts: 89,
        active: 5,
        link: "/c/legal"
    },
    {
        id: "risks",
        title: "Risks",
        description: "Risk assessment, threat analysis, and mitigation strategies for ecosystem security.",
        icon: WarningIcon,
        posts: 167,
        active: 12,
        urgent: true,
        link: "/c/risks"
    },
    {
        id: "security",
        title: "Security",
        description: "Security audits, vulnerability reports, and best practices for safe usage.",
        icon: SecurityIcon,
        posts: 234,
        active: 21,
        link: "/c/security"
    },
    {
        id: "bugs",
        title: "Bug Reports",
        description: "Report bugs, technical issues, and track their resolution status.",
        icon: BugReportIcon,
        posts: 567,
        active: 43,
        link: "/c/bugs"
    },
    {
        id: "community",
        title: "Community",
        description: "Community events, meetups, collaborations, and social initiatives.",
        icon: GroupIcon,
        posts: 892,
        active: 67,
        link: "/c/community"
    }
];

class GDDisruptions extends React.PureComponent {
    _handleTopicClick = (topic) => {
        console.log("Opening topic:", topic.title, topic.link);
        // In production, this would navigate to the community
        // window.location.href = topic.link;
    }

    _renderTopicTile = (topic) => {
        const { classes } = this.props;
        const IconComponent = topic.icon;
        
        return (
            <ButtonBase
                key={topic.id}
                className={classes.topicTile}
                onClick={() => this._handleTopicClick(topic)}
            >
                {topic.urgent && (
                    <span className={classes.urgentBadge}>{t("components.gddisruptions.urgent")}</span>
                )}
                <IconComponent className={classes.topicBackgroundIcon} />
                <div className={classes.topicContent}>
                    <Typography className={classes.topicTitle}>
                        {topic.title}
                    </Typography>
                    <Typography className={classes.topicDescription}>
                        {topic.description}
                    </Typography>
                    <div className={classes.topicMeta}>
                        <span className={classes.topicStat}>
                            <ForumIcon className={classes.topicStatIcon} />
                            <span className={classes.topicStatValue}>{topic.posts}</span> posts
                        </span>
                        <span className={classes.topicStat}>
                            <GroupIcon className={classes.topicStatIcon} />
                            <span className={classes.topicStatValue}>{topic.active}</span> active
                        </span>
                    </div>
                </div>
            </ButtonBase>
        );
    }

    render() {
        const { classes } = this.props;

        return (
            <DialogContent className={classes.dialogContent}>
                <Typography className={classes.sectionTitle}>{t("components.gddisruptions.report_categories")}</Typography>
                <Typography className={classes.sectionDescription}>
                    {t("components.gddisruptions.select_a_topic_to_view_reports_and")}
                </Typography>
                <div className={classes.topicsGrid}>
                    {TOPICS.map(topic => this._renderTopicTile(topic))}
                </div>
            </DialogContent>
        );
    }
}

export default withLanguage(withStyles(styles)(GDDisruptions));