import * as React from "preact/compat";

import withStyles from "@material-ui/core/styles/withStyles";
import DialogContent from "@material-ui/core/DialogContent";
import Typography from "@material-ui/core/Typography";
import ButtonBase from "@material-ui/core/ButtonBase";
import ForumIcon from "@material-ui/icons/Forum";
import GavelIcon from "@material-ui/icons/Gavel";
import BallotIcon from "@material-ui/icons/Ballot";
import CampaignIcon from "../icons/Campaign";
import AccountBalanceIcon from "@material-ui/icons/AccountBalance";
import WarningIcon from "@material-ui/icons/Warning";
import SecurityIcon from "@material-ui/icons/Security";
import BugReportIcon from "@material-ui/icons/BugReport";
import GroupIcon from "@material-ui/icons/Group";

import { HISTORY, PROPOSALS_PORTAL, COMMUNITY_PORTALS } from "../utils/constants";
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
    // The proposals row: same tile anatomy, stretched across every column of
    // the grid so it leads the eight portals as the one "take action" entry.
    proposalsTile: {
        gridColumn: "1 / -1"
    },
    // Keeps the full-width description at a readable measure instead of one
    // long line across a 1200px dialog.
    proposalsDescription: {
        maxWidth: "640px"
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
        width: "100%",
        // The subscriber stat only mounts once its count has arrived, so the
        // row reserves its height up front — otherwise every tile would grow
        // by a line as the nine answers land and the grid would reflow.
        minHeight: "18px"
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

// ── Portal presentation ──────────────────────────────────────────────────
// Ids and order come from utils/constants: the grid renders PROPOSALS_PORTAL
// as a full-width row, then the eight COMMUNITY_PORTALS in their order. This
// map only attaches, per portal `name`, what this view adds on top of
// `{ name, id }`: an icon and the copy. The copy is resolved at render time
// (thunks over t()) so the withLanguage repaint picks up the new language;
// portal names live in `words` because the drawer menu prints the same
// ones. The one figure a tile shows — its subscriber count — is not
// presentation: it is fetched live per portal on mount (see
// _loadSubscribers) and lives in component state.
const PORTAL_PRESENTATION = {
    proposals: {
        title: () => t("words.proposals"),
        description: () => t("components.gddisruptions.turn_a_report_into_action_create_a"),
        icon: BallotIcon
    },
    discussions: {
        title: () => t("words.discussion"),
        description: () => t("components.gddisruptions.general_discussions_about_the_pixagram_ecosystem"),
        icon: ForumIcon
    },
    governance: {
        title: () => t("words.governance"),
        description: () => t("components.gddisruptions.proposals_voting_discussions_and_decision_making"),
        icon: GavelIcon
    },
    marketing: {
        title: () => t("words.marketing"),
        description: () => t("components.gddisruptions.marketing_initiatives_partnerships_and_promotion"),
        icon: CampaignIcon
    },
    legal: {
        title: () => t("words.legal"),
        description: () => t("components.gddisruptions.legal_considerations_compliance_discussions_and"),
        icon: AccountBalanceIcon
    },
    risks: {
        title: () => t("words.risks"),
        description: () => t("components.gddisruptions.risk_assessment_threat_analysis_and_mitigation_s"),
        icon: WarningIcon,
        urgent: true
    },
    security: {
        title: () => t("words.security"),
        description: () => t("components.gddisruptions.security_audits_vulnerability_reports_and_best_p"),
        icon: SecurityIcon
    },
    bugs: {
        title: () => t("words.bug_reports"),
        description: () => t("components.gddisruptions.report_bugs_technical_issues_and_track_their"),
        icon: BugReportIcon
    },
    community: {
        title: () => t("words.community"),
        description: () => t("components.gddisruptions.community_events_meetups_collaborations_and_soci"),
        icon: GroupIcon
    }
};

// `{ name, id }` from the constants merged with the presentation above. An
// unknown `name` (a portal added to the constants before this map) still
// renders — as a bare tile carrying its id — rather than crashing the grid.
const toTopic = (portal) => ({ ...portal, ...(PORTAL_PRESENTATION[portal.name] || {}) });
const PROPOSALS_TOPIC = toTopic(PROPOSALS_PORTAL);
const TOPICS = COMMUNITY_PORTALS.map(toTopic);
// Every tile that gets a subscriber count: the proposals row is a community
// like the other eight, so it is counted the same way.
const ALL_TOPICS = [PROPOSALS_TOPIC, ...TOPICS];

class GDDisruptions extends React.PureComponent {
    // Live subscriber count per portal id (`community.subscribers` from
    // bridge.get_community). A portal is absent from the map until its
    // answer lands, and stays absent when the call fails — the tile then
    // shows no figure rather than a fake 0.
    state = {
        subscribers: {}
    };

    // GovernanceDialog mounts every view when it opens (disableLazyLoading)
    // and drops them when it closes (keepMounted={false}), so the nine calls
    // can still be in flight when this unmounts; the flag keeps their
    // answers from touching a dead component.
    _mounted = false;

    componentDidMount() {
        this._mounted = true;
        this._loadSubscribers();
    }

    componentWillUnmount() {
        this._mounted = false;
    }

    // One bridge.get_community per portal, fired in parallel. There is no
    // multi-name variant: list_communities only filters by title/about, so it
    // cannot select the nine portals by name. Each tile fills in as its own
    // answer arrives instead of waiting for the slowest one. The wrapper
    // sanitizes the payload (subscribers is a validated number or 0) and
    // resolves null on any failure, so a failed portal just stays blank.
    // GovernanceDialog never re-renders (hard shouldComponentUpdate false),
    // so `api` is read once here; if it isn't initialized yet the counts
    // simply stay blank for this opening.
    _loadSubscribers = () => {
        const { api } = this.props;
        const communities = api && api.communities;
        if (!communities || typeof communities.getCommunity !== "function") return;

        ALL_TOPICS.forEach((topic) => {
            Promise.resolve(communities.getCommunity(topic.id))
                .then((community) => {
                    if (!this._mounted || !community) return;
                    const count = community.subscribers;
                    if (typeof count !== "number" || !Number.isFinite(count)) return;
                    this.setState((prev) => ({
                        subscribers: { ...prev.subscribers, [topic.id]: count }
                    }));
                })
                .catch(() => {});
        });
    }

    // Every tile links to its portal's community page. The dialog is modal,
    // so it closes itself on the way out — otherwise the page would change
    // underneath a dialog that stays open. GovernanceDialog threads its
    // onClose down for exactly this.
    _openPortal = (portal) => {
        if (typeof this.props.onClose === "function") this.props.onClose();
        HISTORY.push("/" + portal.id);
    }

    // The tile's only figure. Rendered once the count is known; until then
    // (and after a failed call) the meta row stays empty at its reserved
    // height.
    _renderSubscribers = (topic) => {
        const { classes } = this.props;
        const count = this.state.subscribers[topic.id];
        if (typeof count !== "number") return null;

        return (
            <span className={classes.topicStat}>
                <GroupIcon className={classes.topicStatIcon} />
                <span className={classes.topicStatValue}>{count}</span> {t("components.gddisruptions.subscribers")}
            </span>
        );
    }

    _renderProposalsTile = () => {
        const { classes } = this.props;
        const topic = PROPOSALS_TOPIC;
        const IconComponent = topic.icon || BallotIcon;
        const title = topic.title ? topic.title() : topic.name;
        const description = topic.description ? topic.description() : "";

        return (
            <ButtonBase
                className={classes.topicTile + " " + classes.proposalsTile}
                onClick={() => this._openPortal(topic)}
            >
                <IconComponent className={classes.topicBackgroundIcon} />
                <div className={classes.topicContent}>
                    <Typography className={classes.topicTitle}>
                        {title}
                    </Typography>
                    {description && (
                        <Typography className={classes.topicDescription + " " + classes.proposalsDescription}>
                            {description}
                        </Typography>
                    )}
                    <div className={classes.topicMeta}>
                        {this._renderSubscribers(topic)}
                    </div>
                </div>
            </ButtonBase>
        );
    }

    _renderTopicTile = (topic) => {
        const { classes } = this.props;
        const IconComponent = topic.icon || ForumIcon;
        const title = topic.title ? topic.title() : topic.name;
        const description = topic.description ? topic.description() : "";

        return (
            <ButtonBase
                key={topic.name}
                className={classes.topicTile}
                onClick={() => this._openPortal(topic)}
            >
                {topic.urgent && (
                    <span className={classes.urgentBadge}>{t("components.gddisruptions.urgent")}</span>
                )}
                <IconComponent className={classes.topicBackgroundIcon} />
                <div className={classes.topicContent}>
                    <Typography className={classes.topicTitle}>
                        {title}
                    </Typography>
                    {description && (
                        <Typography className={classes.topicDescription}>
                            {description}
                        </Typography>
                    )}
                    <div className={classes.topicMeta}>
                        {this._renderSubscribers(topic)}
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
                    {this._renderProposalsTile()}
                    {TOPICS.map(topic => this._renderTopicTile(topic))}
                </div>
            </DialogContent>
        );
    }
}

export default withLanguage(withStyles(styles)(GDDisruptions));