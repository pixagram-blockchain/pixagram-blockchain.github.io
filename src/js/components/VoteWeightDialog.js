import React from "react";
import withStyles from "@material-ui/core/styles/withStyles";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import CloseIcon from "@material-ui/icons/Close";
import IconButton from "@material-ui/core/IconButton";
import {DoneRounded} from "@material-ui/icons";

// ─── Arc Geometry ────────────────────────────────────────────────────────────
// Single fixed viewBox — the SVG scales responsively via CSS width + viewBox.
const VB_W = 310;
const VB_H = 220;
const CX = VB_W / 2;
const CY = 190;
const R = 120;
const STROKE_W = 36;
const THUMB_R = 21;
const TICK_OUTER = R + STROKE_W / 2 + 2;
const TICK_INNER = R + STROKE_W / 2 - 4;
const LABEL_R = R + STROKE_W / 2 + 16;

/** Math-convention angle → SVG point (y-down). */
function toSvg(angle, radius) {
    if (radius === undefined) radius = R;
    return {
        x: CX + radius * Math.cos(angle),
        y: CY - radius * Math.sin(angle),
    };
}

/** API weight (−10 000 … +10 000) → angle (π … 0). */
function valueToAngle(v) {
    return Math.PI * (1 - (v + 10000) / 20000);
}

/** Angle (clamped 0…π) → API weight, snapped to step of 100. */
function angleToValue(angle) {
    const a = Math.max(0, Math.min(Math.PI, angle));
    const raw = (1 - a / Math.PI) * 20000 - 10000;
    return Math.round(raw / 100) * 100;
}

/** SVG arc path between two math-convention angles at the track radius. */
function arcPath(startAngle, endAngle) {
    if (Math.abs(startAngle - endAngle) < 0.002) return "";
    const s = toSvg(startAngle);
    const e = toSvg(endAngle);
    const large = Math.abs(startAngle - endAngle) > Math.PI ? 1 : 0;
    const sweep = startAngle > endAngle ? 1 : 0;
    return (
        "M " + s.x.toFixed(2) + " " + s.y.toFixed(2) +
        " A " + R + " " + R + " 0 " + large + " " + sweep +
        " " + e.x.toFixed(2) + " " + e.y.toFixed(2)
    );
}

// Full track arc from −100 % (π) to +100 % (0)
const TRACK_PATH = arcPath(Math.PI, 0);

// Tick marks at every 25 %
const TICKS = [-10000, -7500, -5000, -2500, 0, 2500, 5000, 7500, 10000];

// Labels at key positions
const LABELS = [
    { value: -10000, label: "−100%" },
    { value: -5000,  label: "−50%" },
    { value: 0,      label: "0%" },
    { value: 5000,   label: "+50%" },
    { value: 10000,  label: "+100%" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initialWeight(weight, defaultPower, isUpvote) {
    const base = Math.max(1, Math.min(100, defaultPower || 100)) * 100;
    if (isUpvote) return Math.max(100, Math.min(10000, base));
    return -Math.max(100, Math.min(10000, base));
}

function labelAnchor(angle) {
    const deg = (angle * 180) / Math.PI;
    if (deg > 135) return { textAnchor: "end",    dx: -2, dy: 5 };
    if (deg > 100) return { textAnchor: "end",    dx: 0,  dy: -2 };
    if (deg > 80)  return { textAnchor: "middle",  dx: 0,  dy: -6 };
    if (deg > 45)  return { textAnchor: "start",   dx: 0,  dy: -2 };
    return             { textAnchor: "start",   dx: 2,  dy: 5 };
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = () => ({
    paper: {
        backgroundColor: "#fff !important",
        borderRadius: "64px !important",
        overflow: "visible !important",
        color: "#000 !important",
    },
    dialogContent: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "4px 8px 0 8px",
        overflow: "visible",
        "&:first-child": { paddingTop: 4 },
    },
    errorText: {
        color: "#666",
        marginTop: 4,
        textAlign: "center",
    },
    actions: {
        justifyContent: "center",
        padding: "4px 16px 16px",
        gap: 12,
    },
    closeIcon: {
        color: "#000000",
        position: "absolute",
        top: 24,
        right: 24
    },
    svgWrapper: {
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
    },
    svg: {
        display: "block",
        maxWidth: "min(320px, calc(100vw - 120px))",
        width: "100%",
        height: "auto",
    },
    blackButton: {
        width: "72px",
        height: "72px",
        borderRadius: "100px !important",
        marginTop: "-56px",
        backgroundColor: "#000 !important",
        color: "#fff !important",
        filter: "drop-shadow(0px 0px 0px #00000000)",
        transition: "filter 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,border 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
        "&:hover": {
            backgroundColor: "#222",
            color: "#fff",
            filter: "drop-shadow(0px 0px 6px #00000088)",
            transition: "filter 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,border 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
        }
    },
});

// ═════════════════════════════════════════════════════════════════════════════
// VoteWeightDialog
// ═════════════════════════════════════════════════════════════════════════════
class VoteWeightDialog extends React.PureComponent {
    constructor(props) {
        super(props);
        const isUpvote = (props.weight || 0) >= 0;
        this.state = {
            weight: initialWeight(props.weight, props.defaultVotingPower, isUpvote),
            broadcasting: false,
            error: null,
        };
        this._svgRef = null;
        this._dragging = false;
        this._closed = false;
    }

    componentDidUpdate(prevProps) {
        if (this.props.open && !prevProps.open) {
            const isUpvote = (this.props.weight || 0) >= 0;
            this._closed = false;
            this.setState({
                weight: initialWeight(this.props.weight, this.props.defaultVotingPower, isUpvote),
                broadcasting: false,
                error: null,
            });
        }
    }

    // ── Pointer handling ─────────────────────────────────────────────────

    _onPointerDown = (e) => {
        if (this.state.broadcasting) return;
        e.preventDefault();
        this._dragging = true;
        if (this._svgRef && this._svgRef.setPointerCapture) {
            try { this._svgRef.setPointerCapture(e.pointerId); } catch (_) {}
        }
        this._updateFromPointer(e);
    };

    _onPointerMove = (e) => {
        if (!this._dragging) return;
        e.preventDefault();
        this._updateFromPointer(e);
    };

    _onPointerUp = (e) => {
        if (!this._dragging) return;
        this._dragging = false;
        if (this._svgRef && this._svgRef.releasePointerCapture) {
            try { this._svgRef.releasePointerCapture(e.pointerId); } catch (_) {}
        }
    };

    _updateFromPointer = (e) => {
        const svg = this._svgRef;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        // Map screen → viewBox
        const px = ((e.clientX - rect.left) / rect.width) * VB_W;
        const py = ((e.clientY - rect.top) / rect.height) * VB_H;
        // Math-convention angle from centre
        const dx = px - CX;
        const dy = -(py - CY);
        let angle = Math.atan2(dy, dx);
        // Clamp: below centre → snap to nearest end
        if (angle < 0) angle = dx >= 0 ? 0 : Math.PI;
        const value = angleToValue(angle);
        if (value !== this.state.weight) {
            this.setState({ weight: value });
        }
    };

    // ── Actions ──────────────────────────────────────────────────────────

    _handleConfirm = async () => {
        const { onBroadcast, onClose } = this.props;
        const { weight } = this.state;
        if (typeof onBroadcast !== "function") return;
        this.setState({ broadcasting: true, error: null });
        try {
            await onBroadcast(weight);
            // Mark as closed BEFORE calling onClose — prevents _handleCancel
            // from firing if MUI Dialog emits onClose during unmount
            this._closed = true;
            if (typeof onClose === "function") onClose();
        } catch (e) {
            this.setState({ broadcasting: false, error: e.message || "Broadcast failed" });
        }
    };

    _handleCancel = () => {
        // Guard: if _handleConfirm already closed us, don't run cancel logic
        if (this._closed) return;
        this._closed = true;
        const { onCancel, onClose } = this.props;
        if (typeof onCancel === "function") onCancel();
        if (typeof onClose === "function") onClose();
    };

    // ── Render ───────────────────────────────────────────────────────────

    render() {
        const { classes, open } = this.props;
        const { weight, broadcasting, error } = this.state;

        const isUpvote = weight >= 0;
        const pct = Math.round(weight / 100);
        const pctStr = (weight > 0 ? "+" : "") + pct + "%";
        const zeroAngle = Math.PI / 2;
        const curAngle = valueToAngle(weight);
        const fillPath = weight === 0 ? "" : arcPath(zeroAngle, curAngle);
        const thumb = toSvg(curAngle);

        return (
            <Dialog
                open={open}
                maxWidth="xs"
                fullWidth
                onClose={broadcasting ? undefined : this._handleCancel}
                keepMounted={false}
                PaperProps={{ className: classes.paper }}
            >
                <IconButton onClick={broadcasting ? undefined : this._handleCancel} className={classes.closeIcon}><CloseIcon/></IconButton>
                <DialogContent className={classes.dialogContent}>
                    <div className={classes.svgWrapper}>
                        <svg
                            ref={(el) => { this._svgRef = el; }}
                            viewBox={"0 0 " + VB_W + " " + VB_H}
                            className={classes.svg}
                            style={{
                                overflow: "visible",
                                touchAction: "none",
                                userSelect: "none",
                                WebkitUserSelect: "none",
                                cursor: broadcasting ? "default" : "pointer",
                            }}
                            onPointerDown={broadcasting ? undefined : this._onPointerDown}
                            onPointerMove={broadcasting ? undefined : this._onPointerMove}
                            onPointerUp={broadcasting ? undefined : this._onPointerUp}
                        >
                            {/* ── Track ─────────────────────────────── */}
                            <path
                                d={TRACK_PATH}
                                stroke="#fff"
                                strokeWidth={STROKE_W}
                                fill="none"
                                strokeLinecap="round"
                            />

                            {/* ── Track inner edge highlight ───────────────── */}
                            <path
                                d={TRACK_PATH}
                                stroke="#eee"
                                strokeWidth={STROKE_W - 6}
                                fill="none"
                                strokeLinecap="round"
                            />

                            {/* ── Tick marks ────────────────────────────────── */}
                            {TICKS.map((v) => {
                                const a = valueToAngle(v);
                                const outer = toSvg(a, TICK_OUTER);
                                const inner = toSvg(a, TICK_INNER);
                                return (
                                    <line
                                        key={v}
                                        x1={inner.x.toFixed(2)}
                                        y1={inner.y.toFixed(2)}
                                        x2={outer.x.toFixed(2)}
                                        y2={outer.y.toFixed(2)}
                                        stroke="#999"
                                        strokeWidth={v % 5000 === 0 ? 2 : 1}
                                    />
                                );
                            })}

                            {/* ── Fill arc ─────────────────────────── */}
                            {fillPath && (
                                <path
                                    d={fillPath}
                                    stroke="#aaa"
                                    strokeWidth={STROKE_W - 8}
                                    fill="none"
                                    strokeLinecap="round"
                                />
                            )}

                            {/* ── Labels ────────────────────────────────────── */}
                            {LABELS.map((m) => {
                                const a = valueToAngle(m.value);
                                const p = toSvg(a, LABEL_R);
                                const props = labelAnchor(a);
                                return (
                                    <text
                                        key={m.value}
                                        x={p.x.toFixed(2)}
                                        y={p.y.toFixed(2)}
                                        textAnchor={props.textAnchor}
                                        dx={props.dx}
                                        dy={props.dy}
                                        fill="#333"
                                        fontSize="10"
                                        fontFamily={`'Industry Book'`}
                                        fontWeight="500"
                                    >
                                        {m.label}
                                    </text>
                                );
                            })}

                            {/* ── Centre percent display ───────────────────── */}
                            <text
                                x={CX}
                                y={CY - R * 0.42 - 8}
                                textAnchor="middle"
                                dominantBaseline="central"
                                fill="#000"
                                fontSize="40"
                                fontFamily={"'Geist Mono', monospace"}
                                fontWeight="400"
                                style={{ fontVariantNumeric: "tabular-nums" }}
                            >
                                {pctStr}
                            </text>
                            <text
                                x={CX}
                                y={CY - R * 0.42 + 28 - 2}
                                textAnchor="middle"
                                dominantBaseline="central"
                                fill="#444"
                                fontSize="16"
                                fontFamily={`'Industry Book'`}
                                fontWeight="500"
                                letterSpacing="2"
                            >
                                {isUpvote ? "UPVOTE" : "DOWNVOTE"}
                            </text>

                            {/* ── 0 % marker (subtle dot at top) ───────────── */}
                            <circle
                                cx={CX}
                                cy={CY - R}
                                r={6}
                                fill={weight === 0 ? "#000" : "#fff"}
                            />

                            {/* ── Thumb ─────────────────────────────────────── */}
                            <circle
                                cx={thumb.x.toFixed(2)}
                                cy={thumb.y.toFixed(2)}
                                r={THUMB_R + 10}
                                fill="transparent"
                            />
                            <circle
                                cx={thumb.x.toFixed(2)}
                                cy={thumb.y.toFixed(2)}
                                r={THUMB_R}
                                fill="#777"
                                stroke="#eee"
                                strokeWidth="2.5"
                            />
                            <circle
                                cx={thumb.x.toFixed(2)}
                                cy={thumb.y.toFixed(2)}
                                r={THUMB_R - 6}
                                fill="none"
                                stroke="#777"
                                strokeWidth="1"
                            />
                        </svg>
                    </div>

                    {error && (
                        <Typography className={classes.errorText} variant="body2">
                            {error}
                        </Typography>
                    )}
                </DialogContent>

                <DialogActions className={classes.actions}>
                    <IconButton
                        onClick={this._handleConfirm}
                        disabled={broadcasting}
                        variant="contained"
                        className={classes.blackButton}
                        size={"large"}
                    >
                        {broadcasting ? (
                            <CircularProgress size={18} style={{ color: "#fff" }} />
                        ) : (
                            <DoneRounded style={{color: "#fff"}}/>
                        )}
                    </IconButton>
                </DialogActions>
            </Dialog>
        );
    }
}

export default withStyles(styles)(VoteWeightDialog);