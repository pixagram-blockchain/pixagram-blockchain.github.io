import * as React from "preact/compat";

import withStyles from "@material-ui/core/styles/withStyles";
import DialogContent from "@material-ui/core/DialogContent";
import Typography from "@material-ui/core/Typography";
import LinearProgress from "@material-ui/core/LinearProgress";
import TrendingUpIcon from "@material-ui/icons/TrendingUp";
import TrendingDownIcon from "@material-ui/icons/TrendingDown";
import TrendingFlatIcon from "@material-ui/icons/TrendingFlat";
import FlagIcon from "@material-ui/icons/Flag";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";

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
    metricsGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: "16px",
        marginBottom: "24px"
    },
    metricCard: {
        backgroundColor: "#101010",
        borderRadius: "16px",
        padding: "20px",
        transition: "background-color 200ms ease",
        position: "relative",
        overflow: "hidden",
        "&:hover": {
            backgroundColor: "#171717"
        }
    },
    metricHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "12px"
    },
    metricLabel: {
        fontSize: "12px",
        fontWeight: 500,
        color: "#888",
        fontFamily: "'Industry Book'",
        textTransform: "uppercase",
        letterSpacing: "0.5px"
    },
    metricTrend: {
        display: "flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "12px",
        fontFamily: "'Geist Mono', monospace",
        color: "#888"
    },
    trendIcon: {
        fontSize: "16px",
        color: "#888"
    },
    metricValue: {
        fontSize: "28px",
        fontWeight: 700,
        color: "#fff",
        fontFamily: "'Geist Mono', monospace",
        marginBottom: "4px"
    },
    metricSubtext: {
        fontSize: "12px",
        fontFamily: "'Normative Pro'",
        color: "#666"
    },
    // Goals Section
    goalsContainer: {
        marginTop: "24px"
    },
    goalCard: {
        backgroundColor: "#101010",
        borderRadius: "16px",
        padding: "20px",
        marginBottom: "12px",
        transition: "background-color 200ms ease",
        position: "relative",
        overflow: "hidden",
        "&:hover": {
            backgroundColor: "#171717"
        }
    },
    goalHeader: {
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: "16px"
    },
    goalInfo: {
        display: "flex",
        alignItems: "flex-start",
        gap: "12px"
    },
    goalIconWrapper: {
        width: "40px",
        height: "40px",
        borderRadius: "10px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#fff"
    },
    goalIcon: {
        color: "#000",
        fontSize: "20px"
    },
    goalTitle: {
        fontSize: "16px",
        fontWeight: 600,
        color: "#fff",
        fontFamily: "'Industry Book'",
        marginBottom: "4px"
    },
    goalDescription: {
        fontSize: "13px",
        fontFamily: "'Normative Pro'",
        color: "#888"
    },
    goalStatus: {
        fontSize: "12px",
        fontWeight: 600,
        fontFamily: "'Industry Book'",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        padding: "4px 12px",
        borderRadius: "12px",
        backgroundColor: "#222",
        color: "#888"
    },
    goalStatusComplete: {
        backgroundColor: "#333",
        color: "#fff"
    },
    goalProgress: {
        marginTop: "12px"
    },
    goalProgressBar: {
        height: "8px",
        borderRadius: "4px",
        backgroundColor: "#222",
        "& .MuiLinearProgress-bar": {
            backgroundColor: "#888",
            borderRadius: "4px"
        }
    },
    goalProgressBarComplete: {
        "& .MuiLinearProgress-bar": {
            backgroundColor: "#fff"
        }
    },
    goalProgressText: {
        display: "flex",
        justifyContent: "space-between",
        marginTop: "8px",
        fontSize: "12px",
        fontFamily: "'Normative Pro'",
        color: "#666"
    },
    goalProgressValue: {
        fontFamily: "'Geist Mono', monospace",
        color: "#fff"
    },
    monospace: {
        fontFamily: "'Geist Mono', monospace"
    }
});

const METRICS = [
    {
        id: "daily-users",
        label: "Daily Active Users",
        value: "12.4K",
        trend: "up",
        change: "+8.2%",
        subtext: "vs. last week"
    },
    {
        id: "transactions",
        label: "Daily Transactions",
        value: "89.2K",
        trend: "up",
        change: "+12.5%",
        subtext: "vs. last week"
    },
    {
        id: "nft-minted",
        label: "NFTs Minted",
        value: "1,247",
        trend: "down",
        change: "-3.1%",
        subtext: "last 24 hours"
    },
    {
        id: "total-staked",
        label: "Total Staked",
        value: "847M",
        trend: "up",
        change: "+2.3%",
        subtext: "Pixa Power"
    },
    {
        id: "creator-rewards",
        label: "Creator Rewards",
        value: "$41.2K",
        trend: "flat",
        change: "0.0%",
        subtext: "last 24 hours"
    },
    {
        id: "curator-rewards",
        label: "Curator Rewards",
        value: "$18.7K",
        trend: "up",
        change: "+5.4%",
        subtext: "last 24 hours"
    }
];

const GOALS = [
    {
        id: "goal-1",
        title: "1 Million Active Users",
        description: "Reach 1 million monthly active users on the platform",
        current: 847000,
        target: 1000000,
        status: "active"
    },
    {
        id: "goal-2",
        title: "100K NFT Collections",
        description: "Support 100,000 unique NFT collections",
        current: 78500,
        target: 100000,
        status: "active"
    },
    {
        id: "goal-3",
        title: "Decentralization Target",
        description: "Achieve 50+ active witnesses",
        current: 50,
        target: 50,
        status: "complete"
    },
    {
        id: "goal-4",
        title: "$10M Daily Volume",
        description: "Reach $10M in daily trading volume",
        current: 4200000,
        target: 10000000,
        status: "active"
    }
];

class GDMetrics extends React.PureComponent {
    _getTrendIcon = (trend) => {
        const { classes } = this.props;
        switch (trend) {
            case 'up':
                return <TrendingUpIcon className={classes.trendIcon} />;
            case 'down':
                return <TrendingDownIcon className={classes.trendIcon} />;
            default:
                return <TrendingFlatIcon className={classes.trendIcon} />;
        }
    }

    _formatNumber = (num) => {
        if (num >= 1000000) {
            return `${(num / 1000000).toFixed(1)}M`;
        } else if (num >= 1000) {
            return `${(num / 1000).toFixed(0)}K`;
        }
        return num.toString();
    }

    _renderMetricCard = (metric) => {
        const { classes } = this.props;

        return (
            <div key={metric.id} className={classes.metricCard}>
                <div className={classes.metricHeader}>
                    <span className={classes.metricLabel}>{metric.label}</span>
                    <span className={classes.metricTrend}>
                        {this._getTrendIcon(metric.trend)}
                        {metric.change}
                    </span>
                </div>
                <div className={classes.metricValue}>{metric.value}</div>
                <div className={classes.metricSubtext}>{metric.subtext}</div>
            </div>
        );
    }

    _renderGoalCard = (goal) => {
        const { classes } = this.props;
        const progress = (goal.current / goal.target) * 100;
        const isComplete = goal.status === 'complete';

        return (
            <div key={goal.id} className={classes.goalCard}>
                <div className={classes.goalHeader}>
                    <div className={classes.goalInfo}>
                        <div className={classes.goalIconWrapper}>
                            {isComplete ? (
                                <CheckCircleIcon className={classes.goalIcon} />
                            ) : (
                                <FlagIcon className={classes.goalIcon} />
                            )}
                        </div>
                        <div>
                            <Typography className={classes.goalTitle}>{goal.title}</Typography>
                            <Typography className={classes.goalDescription}>{goal.description}</Typography>
                        </div>
                    </div>
                    <span className={`${classes.goalStatus} ${isComplete ? classes.goalStatusComplete : ''}`}>
                        {goal.status}
                    </span>
                </div>
                <div className={classes.goalProgress}>
                    <LinearProgress
                        variant="determinate"
                        value={Math.min(progress, 100)}
                        className={`${classes.goalProgressBar} ${isComplete ? classes.goalProgressBarComplete : ''}`}
                    />
                    <div className={classes.goalProgressText}>
                        <span className={classes.goalProgressValue}>
                            {this._formatNumber(goal.current)} / {this._formatNumber(goal.target)}
                        </span>
                        <span className={classes.monospace}>{progress.toFixed(1)}%</span>
                    </div>
                </div>
            </div>
        );
    }

    render() {
        const { classes } = this.props;

        return (
            <DialogContent className={classes.dialogContent}>
                <Typography className={classes.sectionTitle}>{t("components.gdmetrics.key_metrics")}</Typography>
                <Typography className={classes.sectionDescription}>
                    {t("components.gdmetrics.real_time_analytics_and_performance_indicators_f")}
                </Typography>
                <div className={classes.metricsGrid}>
                    {METRICS.map(metric => this._renderMetricCard(metric))}
                </div>
                <Typography className={classes.sectionTitle}>{t("components.gdmetrics.ecosystem_goals")}</Typography>
                <Typography className={classes.sectionDescription}>
                    {t("components.gdmetrics.track_progress_towards_major_milestones_for_the")}
                </Typography>
                <div className={classes.goalsContainer}>
                    {GOALS.map(goal => this._renderGoalCard(goal))}
                </div>
            </DialogContent>
        );
    }
}

export default withLanguage(withStyles(styles)(GDMetrics));