import React from "react";
import withStyles from "@material-ui/core/styles/withStyles";
import Dialog from "@material-ui/core/Dialog";
import Typography from "@material-ui/core/Typography";
import ButtonBase from "@material-ui/core/ButtonBase";
import CircularProgress from "@material-ui/core/CircularProgress";
import {DoneRounded} from "@material-ui/icons";
import { withPrices } from "../hooks/usePrices";
import {
    estimateVoteValue, fiatOf, formatPxs,
    getRewardSnapshot, getRewardSnapshotSync,
    getVoterAccount, getVoterAccountSync,
} from "../utils/voteValue";

// ─── Dial Geometry ───────────────────────────────────────────────────────────
// The dialog is a disc. One square viewBox covers the whole disc and the arc
// is concentric with it (watch-bezel style); the SVG scales with the disc.
const VB = 320;
const VB_W = VB;
const VB_H = VB;
const CX = VB / 2;
const CY = VB / 2;
const R = 122;
const STROKE_W = 34;
const THUMB_R = 20;
// Margin between the track's outer edge and the disc's rim: 160 − (R + 17) = 21.
// Ticks sit on the INNER edge of the track, pointing towards the centre.
const TICK_OUTER = R - STROKE_W / 2 + 4;
const TICK_INNER = R - STROKE_W / 2 - 2;
// Labels sit inside the arc, just past the ticks.
const LABEL_R = R - STROKE_W / 2 - 16;

// Disc diameter: 340px max, otherwise whatever fits the screen with a 20px
// margin on each side. `svh` = the viewport with the mobile browser bars
// shown, so the disc never ends up under them; `vh` is the fallback for
// browsers without small-viewport units.
const discSize = (vh) => "min(340px, calc(100vw - 40px), calc(100" + vh + " - 40px))";
const DISC = discSize("svh");
const DISC_FALLBACK = discSize("vh");
// Base font size of the HTML overlays, scaled with the disc (14px at 340px)
// so the button content keeps its proportions when the disc shrinks.
const discFont = (disc) => "calc(" + disc + " * 14 / 340)";

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

/**
 * Anchoring for labels drawn INSIDE the arc: the text grows away from the
 * track, towards the centre of the dial (left half → start, right → end).
 */
function labelAnchor(angle) {
    const deg = (angle * 180) / Math.PI;
    if (deg > 100) return { textAnchor: "start" };
    if (deg >= 80) return { textAnchor: "middle" };
    return { textAnchor: "end" };
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const TRANSITION = "filter 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,border 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms";

const styles = () => ({
    // The paper IS the disc.
    paper: {
        fallbacks: [{ width: DISC_FALLBACK, height: DISC_FALLBACK, fontSize: discFont(DISC_FALLBACK) }],
        position: "relative",
        backgroundColor: "#fff !important",
        borderRadius: "50% !important",
        width: DISC,
        height: DISC,
        fontSize: discFont(DISC),
        maxWidth: "none !important",
        maxHeight: "none !important",
        margin: "16px !important",
        overflow: "visible !important",
        color: "#000 !important",
    },
    svg: {
        position: "absolute",
        top: 0,
        left: 0,
        display: "block",
        width: "100%",
        height: "100%",
    },
    errorText: {
        position: "absolute",
        top: "60%",
        left: "50%",
        transform: "translateX(-50%)",
        width: "62%",
        color: "#666",
        fontSize: "0.86em",
        lineHeight: 1.2,
        textAlign: "center",
        pointerEvents: "none",
    },
    // Confirm button: bowl shape (flat-ish top with rounded corners, deep
    // elliptical bottom) that follows the curve of the disc, like a watch
    // face's primary action.
    blackButton: {
        position: "absolute",
        left: "50%",
        bottom: "10%",
        transform: "translateX(-50%)",
        width: "60%",
        height: "21%",
        borderRadius: "16% 16% 50% 50% / 42% 42% 58% 58%",
        paddingBottom: "3%",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.7em",
        fontSize: "inherit",
        backgroundColor: "#171717",
        color: "#fff",
        filter: "drop-shadow(0px 0px 0px #00000000)",
        transition: TRANSITION,
        "&:hover": {
            backgroundColor: "#000",
            filter: "drop-shadow(0px 0px 6px #00000088)",
        },
        "&.Mui-focusVisible": {
            filter: "drop-shadow(0px 0px 6px #00000088)",
        },
    },
    buttonIcon: {
        flex: "0 0 auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "1.7em",
        height: "1.7em",
        fontSize: "inherit",
        color: "#fff",
    },
    buttonValues: {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        minWidth: 0,
        lineHeight: 1.2,
        fontVariantNumeric: "tabular-nums",
        userSelect: "none",
        whiteSpace: "nowrap",
    },
    buttonPxs: {
        color: "#fff",
        fontFamily: "'Geist Mono', monospace",
        fontSize: "1em",
        fontWeight: 500,
    },
    buttonFiat: {
        color: "#a3a3a3",
        fontFamily: "'Geist Mono', monospace",
        fontSize: "0.79em",
        marginTop: "0.07em",
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
            // Reward-fund snapshot + the voter's account (vesting shares,
            // manabar) behind the live value estimate. Seeded from the RAM
            // caches so a re-opened dialog shows a figure on its first paint.
            snapshot: getRewardSnapshotSync(props.api),
            account: getVoterAccountSync(props.api, props.voter),
        };
        this._svgRef = null;
        this._dragging = false;
        this._closed = false;
        this._unmounted = false;
        this._pricingToken = 0;
    }

    componentDidMount() {
        if (this.props.open) this._loadPricing();
    }

    componentWillUnmount() {
        this._unmounted = true;
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
            this._loadPricing();
        } else if (this.props.open && (prevProps.api !== this.props.api || prevProps.voter !== this.props.voter)) {
            this._loadPricing();
        }
    }

    // ── Vote value estimate ──────────────────────────────────────────────
    // Needs `api` (reward fund / dgp / feed reads) and `voter` (the account
    // whose vesting shares and mana decide the rshares) — both optional props;
    // without them the confirm button shows only its icon. Fetches are RAM-
    // cached and deduped in utils/voteValue, so re-opening is instant.

    _loadPricing = () => {
        const { api, voter } = this.props;
        if (!api) return;
        const token = ++this._pricingToken;
        const live = () => !this._unmounted && token === this._pricingToken;
        getRewardSnapshot(api)
            .then((snap) => { if (live() && snap) this.setState({ snapshot: snap }); })
            .catch(() => {});
        if (voter) {
            getVoterAccount(api, voter)
                .then((acc) => { if (live() && acc) this.setState({ account: acc }); })
                .catch(() => {});
        }
    };

    /**
     * What a vote at `weight` would be worth right now → { pxs, fiat,
     * currency, ready }. Pure math over the cached snapshot + account
     * (HF20 vote evaluator → rshares → reward fund → PXA), priced through
     * usePrices() — PXA anchored in USD, PXS derived from it — rather than
     * the raw 1:1 bootstrap feed. Tracks the thumb live while dragging.
     */
    _estimate = (weight) => {
        const { snapshot, account } = this.state;
        const prices = this.props.prices;
        const ready = !!(snapshot && snapshot.ok && account);
        const value = ready ? estimateVoteValue(account, weight, snapshot, prices) : { pxs: 0, usd: 0 };
        const fiat = fiatOf(value.usd, prices);
        return { pxs: value.pxs, fiat: fiat.amount, currency: fiat.currency, ready };
    };

    /** Estimate shown inside the confirm button → { pxsText, fiatText } or null. */
    _estimateTexts = () => {
        const { api, voter } = this.props;
        if (!api || !voter) return null;
        const est = this._estimate(this.state.weight);
        if (!est.ready) return { pxsText: "…", fiatText: "" };
        const sign = est.pxs > 0 ? "+" : est.pxs < 0 ? "−" : "";
        return {
            pxsText: "≈ " + sign + formatPxs(Math.abs(est.pxs)) + " PXS",
            fiatText: Math.abs(est.fiat).toFixed(2) + " " + est.currency,
        };
    };

    // ── Pointer handling ─────────────────────────────────────────────────

    _toViewBox = (e) => {
        const rect = this._svgRef.getBoundingClientRect();
        return {
            px: ((e.clientX - rect.left) / rect.width) * VB_W,
            py: ((e.clientY - rect.top) / rect.height) * VB_H,
        };
    };

    _onPointerDown = (e) => {
        if (this.state.broadcasting || !this._svgRef) return;
        // The lower half of the disc holds the confirm button: a press there
        // must not snap the weight to ±100 %. Only presses on the upper half
        // (the dial) start a drag; once started, a drag may go anywhere.
        const { py } = this._toViewBox(e);
        if (py > CY + STROKE_W / 2) return;
        e.preventDefault();
        this._dragging = true;
        if (this._svgRef.setPointerCapture) {
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
        if (!this._svgRef) return;
        const { px, py } = this._toViewBox(e);
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
        const est = this._estimateTexts();

        return (
            <Dialog
                open={open}
                maxWidth={false}
                onClose={broadcasting ? undefined : this._handleCancel}
                keepMounted={false}
                PaperProps={{ className: classes.paper }}
            >
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
                    onPointerCancel={broadcasting ? undefined : this._onPointerUp}
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

                    {/* ── Labels (inside the arc) ───────────────────── */}
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
                                dominantBaseline="central"
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
                        y={CY - 30}
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
                        y={CY + 6}
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

                {error && (
                    <Typography className={classes.errorText} variant="body2">
                        {error}
                    </Typography>
                )}

                <ButtonBase
                    onClick={this._handleConfirm}
                    disabled={broadcasting}
                    className={classes.blackButton}
                    aria-label={"Confirm vote " + pctStr + (est && est.fiatText ? ", " + est.pxsText + ", " + est.fiatText : "")}
                >
                    <span className={classes.buttonIcon}>
                        {broadcasting ? (
                            <CircularProgress size="1.3em" style={{ color: "#fff" }} />
                        ) : (
                            <DoneRounded style={{ color: "#fff", fontSize: "1.7em" }} />
                        )}
                    </span>
                    {est && (
                        <span className={classes.buttonValues}>
                            <span className={classes.buttonPxs}>{est.pxsText}</span>
                            {est.fiatText && <span className={classes.buttonFiat}>{est.fiatText}</span>}
                        </span>
                    )}
                </ButtonBase>
            </Dialog>
        );
    }
}

export default withStyles(styles)(withPrices(VoteWeightDialog));