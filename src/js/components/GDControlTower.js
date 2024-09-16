import * as React from "preact/compat";

import withStyles from "@material-ui/core/styles/withStyles";
import DialogContent from "@material-ui/core/DialogContent";
import Typography from "@material-ui/core/Typography";
import DashboardIcon from "@material-ui/icons/Dashboard";

import { t } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";
const styles = theme => ({
    dialogContent: {
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "400px"
    },
    emptyState: {
        textAlign: "center",
        padding: "48px 24px",
        maxWidth: "400px"
    },
    iconWrapper: {
        width: "80px",
        height: "80px",
        borderRadius: "20px",
        backgroundColor: "#101010",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "0 auto 24px auto"
    },
    icon: {
        fontSize: "40px",
        color: "#444"
    },
    title: {
        fontSize: "24px",
        fontWeight: 600,
        color: "#fff",
        fontFamily: "'Industry Book'",
        marginBottom: "12px"
    },
    description: {
        fontSize: "14px",
        color: "#666",
        fontFamily: "'Normative Pro'",
        lineHeight: 1.6,
        marginBottom: "24px"
    },
    comingSoonBadge: {
        display: "inline-block",
        fontSize: "12px",
        fontWeight: 600,
        fontFamily: "'Industry Book'",
        textTransform: "uppercase",
        letterSpacing: "1px",
        padding: "8px 16px",
        borderRadius: "20px",
        backgroundColor: "#222",
        color: "#888"
    },
    featureList: {
        marginTop: "32px",
        padding: "24px",
        backgroundColor: "#101010",
        borderRadius: "16px",
        textAlign: "left"
    },
    featureListTitle: {
        fontSize: "14px",
        fontWeight: 600,
        color: "#888",
        fontFamily: "'Industry Book'",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        marginBottom: "16px"
    },
    featureItem: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "8px 0",
        borderBottom: "1px solid #1a1a1a",
        "&:last-child": {
            borderBottom: "none"
        }
    },
    featureDot: {
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        backgroundColor: "#333"
    },
    featureText: {
        fontSize: "14px",
        fontFamily: "'Normative Pro'",
        color: "#666"
    }
});

const PLANNED_FEATURES = [
    "Real-time network health monitoring",
    "Transaction flow visualization",
    "Witness performance dashboard",
    "Token distribution analytics",
    "Community activity heatmaps",
    "Alert and notification center"
];

class GDControlTower extends React.PureComponent {
    render() {
        const { classes } = this.props;

        return (
            <DialogContent className={classes.dialogContent}>
                <div className={classes.emptyState}>
                    <div className={classes.iconWrapper}>
                        <DashboardIcon className={classes.icon} />
                    </div>
                    <Typography className={classes.title}>
                        {t("components.gdcontrol_tower.control_tower")}
                    </Typography>
                    <Typography className={classes.description}>
                        {t(
                            "components.gdcontrol_tower.a_centralized_dashboard_for_monitoring_the_entir"
                        )}
                    </Typography>
                    <span className={classes.comingSoonBadge}>
                        {t("words.coming_soon")}
                    </span>
                    
                    <div className={classes.featureList}>
                        <Typography className={classes.featureListTitle}>
                            {t("components.gdcontrol_tower.planned_features")}
                        </Typography>
                        {PLANNED_FEATURES.map((feature, index) => (
                            <div key={index} className={classes.featureItem}>
                                <span className={classes.featureDot} />
                                <span className={classes.featureText}>{feature}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </DialogContent>
        );
    }
}

export default withLanguage(withStyles(styles)(GDControlTower));