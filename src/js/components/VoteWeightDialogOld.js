import React from "react";
import withStyles from "@material-ui/core/styles/withStyles";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogActions from "@material-ui/core/DialogActions";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import Slider from "@material-ui/core/Slider";
import CircularProgress from "@material-ui/core/CircularProgress";

// ─── Marks ───────────────────────────────────────────────────────────────────
const UPVOTE_MARKS = [
    { value: 100,   label: "1%" },
    { value: 2500,  label: "25%" },
    { value: 5000,  label: "50%" },
    { value: 7500,  label: "75%" },
    { value: 10000, label: "100%" },
];

const DOWNVOTE_MARKS = [
    { value: -100,   label: "-1%" },
    { value: -2500,  label: "-25%" },
    { value: -5000,  label: "-50%" },
    { value: -7500,  label: "-75%" },
    { value: -10000, label: "-100%" },
];

// ─── Shared slider base ─────────────────────────────────────────────────────
const sliderBase = {
    height: 360,
    "& .MuiSlider-root": {
        color: "#888",
    },
    "& .MuiSlider-track": {
        backgroundColor: "#aaa",
    },
    "& .MuiSlider-rail": {
        backgroundColor: "#333",
    },
    "& .MuiSlider-thumb": {
        width: 28,
        height: 28,
        marginLeft: -12,
        backgroundColor: "#ccc",
        boxShadow: "0px 0px 0px 14px rgba(255, 255, 255, 0.08)",
    },
    "& .MuiSlider-thumb:hover, & .MuiSlider-thumb.Mui-focusVisible": {
        boxShadow: "0px 0px 0px 14px rgba(255, 255, 255, 0.14)",
    },
    "& .MuiSlider-active.MuiSlider-thumb": {
        boxShadow: "0px 0px 0px 14px rgba(255, 255, 255, 0.14)",
    },
    "& .MuiSlider-valueLabel": {
        left: "calc(-50% - 8px)",
        "& > span": {
            backgroundColor: "#999",
        },
        "& > span > span": {
            color: "#000",
        },
    },
    "& .MuiSlider-markLabel": {
        left: 40,
        fontSize: "0.75rem",
        color: "#666",
    },
    "& .MuiSlider-mark": {
        width: 6,
        height: 2,
        borderRadius: 1,
        backgroundColor: "#444",
    },
};

const styles = () => ({
    dialogContent: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "0 24px 8px 24px",
        overflow: "visible",
    },
    sliderContainer: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px 48px 16px 24px",
        height: "320px"
    },
    slider: {
        ...sliderBase,
        color: "#888",
    },
    percentDisplay: {
        fontWeight: 700,
        fontSize: "2rem",
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1,
        color: "#ccc",
    },
    errorText: {
        color: "#b1b1b1",
        marginTop: 8,
        textAlign: "center",
    },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initialWeight(weight, defaultPower, isUpvote) {
    // Use defaultVotingPower (0-100) scaled to API range (0-10000)
    const base = Math.max(1, Math.min(100, defaultPower || 100)) * 100;
    if (isUpvote) return Math.max(100, Math.min(10000, base));
    return -Math.max(100, Math.min(10000, base));
}

function formatPercent(value) {
    return (value / 100).toFixed(0) + "%";
}

// ═════════════════════════════════════════════════════════════════════════════
// VoteWeightDialog
// ═════════════════════════════════════════════════════════════════════════════
class VoteWeightDialog extends React.PureComponent {
    constructor(props) {
        super(props);
        const isUpvote = (props.weight || 0) >= 0;
        this.state = {
            weight: initialWeight(props.weight, props.defaultVotingPower, isUpvote),
            isUpvote,
            broadcasting: false,
            error: null,
        };
    }

    componentDidUpdate(prevProps) {
        if (this.props.open && !prevProps.open) {
            const isUpvote = (this.props.weight || 0) >= 0;
            this.setState({
                weight: initialWeight(this.props.weight, this.props.defaultVotingPower, isUpvote),
                isUpvote,
                broadcasting: false,
                error: null,
            });
        }
    }

    _handleWeightChange = (_event, value) => {
        this.setState({ weight: value });
    };

    _handleConfirm = async () => {
        const { onBroadcast } = this.props;
        const { weight } = this.state;
        if (typeof onBroadcast !== "function") return;
        this.setState({ broadcasting: true, error: null });
        try {
            await onBroadcast(weight);
        } catch (e) {
            this.setState({ broadcasting: false, error: e.message || "Broadcast failed" });
        }
    };

    _handleCancel = () => {
        const { onCancel } = this.props;
        if (typeof onCancel === "function") onCancel();
    };

    render() {
        const { classes, open } = this.props;
        const { weight, isUpvote, broadcasting, error } = this.state;
        const pct = (weight / 100).toFixed(0);

        return (
            <Dialog
                open={open}
                maxWidth="xs"
                fullWidth
                disablePortal
                onClose={broadcasting ? undefined : this._handleCancel}
                keepMounted={false}
            >
                <DialogTitle style={{ margin: 0, paddingBottom: 48 }}>
                    <Typography component="h1" variant="h5" style={{ margin: 0 }}>
                        {isUpvote ? "Upvote" : "Downvote"} at {isUpvote ? "+" : ""}{pct}%
                    </Typography>
                </DialogTitle>
                <DialogContent className={classes.dialogContent}>
                    <div className={classes.sliderContainer}>
                        {isUpvote ? (
                            <Slider
                                orientation="vertical"
                                className={classes.slider}
                                value={weight}
                                min={100}
                                max={10000}
                                step={100}
                                onChange={this._handleWeightChange}
                                valueLabelDisplay="off"
                                //valueLabelFormat={formatPercent}
                                marks={UPVOTE_MARKS}
                                disabled={broadcasting}
                            />
                        ) : (
                            <Slider
                                orientation="vertical"
                                className={classes.slider}
                                value={weight}
                                min={-10000}
                                max={-100}
                                step={100}
                                onChange={this._handleWeightChange}
                                valueLabelDisplay="off"
                                //valueLabelFormat={formatPercent}
                                marks={DOWNVOTE_MARKS}
                                disabled={broadcasting}
                            />
                        )}
                    </div>

                    {error && (
                        <Typography className={classes.errorText} variant="body2">
                            {error}
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={this._handleCancel} disabled={broadcasting} color="default">
                        Cancel
                    </Button>
                    <Button
                        onClick={this._handleConfirm}
                        disabled={broadcasting}
                        variant="contained"
                        style={{ backgroundColor: "#999", color: "#000" }}
                    >
                        {broadcasting ? (
                            <CircularProgress size={20} style={{ color: "#000" }} />
                        ) : (
                            "Confirm"
                        )}
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }
}

export default withStyles(styles)(VoteWeightDialog);