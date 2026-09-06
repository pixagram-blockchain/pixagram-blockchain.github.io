import * as React from "preact/compat";
import { NumericFormat } from "react-number-format";
import withStyles from "@material-ui/core/styles/withStyles";
import Typography from "@material-ui/core/Typography";
import TextField from "@material-ui/core/TextField";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import Tooltip from "@material-ui/core/Tooltip";
import Slider from "@material-ui/core/Slider";
import Collapse from "@material-ui/core/Collapse";
import PixaLiquid from "../icons/PixaLiquid";
import PixaPower from "../icons/PixaPower";

import { t } from "../utils/text";
import { formatAmount, formatNumber, formatFiatFromUsd, formatDate, numericInputProps, resolveLocale } from "../utils/numberFormat";
import { previewPowerDown } from "../utils/powerDown";

import { withLanguage } from "../utils/withLanguage";
const styles = (theme) => ({
    slider: {
        margin: "16px 16px 32px 16px",
        width: "calc(100% - 32px)",
        "& .MuiSlider-valueLabel": { color: "#fff" },
        "& .MuiSlider-valueLabel > span > span": { color: "#000" },
        "& .MuiSlider-thumb": { boxShadow: "0px 0px 0px 14px rgb(255 255 255 / 16%)" },
        "& .MuiSlider-active.MuiSlider-thumb": {
            boxShadow: "0px 0px 0px 14px rgb(255 255 255 / 24%)",
        },
    },
    darkGreyDialog: {
        backgroundColor: "#181818ff !important",
        "& .MuiButton-contained.Mui-disabled": {
            opacity: 0.35,
        }
    },
    // The payout plan under the amount field: what the power-down will pay,
    // when, and what that is worth in the user's reference currency. Quiet
    // block, no hover — it is information, not a control.
    schedule: {
        backgroundColor: "#111111",
        borderRadius: "16px",
        padding: "12px 16px",
        margin: "0px 0px 16px 0px",
        "& > p": { margin: "3px 0px" },
    },
    scheduleLead: { color: "#e0e0e0" },
    scheduleLine: { color: "#a5a5a5" },
    scheduleNote: { color: "#666666", display: "block", marginTop: "6px" },
});

// Fewer marks = better performance
const SLIDER_MARKS = [
    { value: 0, label: "0%" },
    { value: 25, label: "25%" },
    { value: 50, label: "50%" },
    { value: 75, label: "75%" },
    { value: 100, label: "100%" },
];

// MUI TextField inputComponent must forward ref. The grouping and decimal
// characters follow the Settings locale (numericInputProps); the value the
// wallet receives stays a "." decimal string whatever is displayed.
const NumberFormatCustom = React.memo(
    React.forwardRef(function NumberFormatCustom(props, ref) {
        const { onChange, currency, locale, name, ...other } = props;
        return (
            <NumericFormat
                {...other}
                getInputRef={ref}
                onValueChange={(values) => {
                    onChange?.({
                        target: { name, value: values.value },
                    });
                }}
                {...numericInputProps(locale)}
                thousandsGroupStyle="thousand"
                decimalScale={2}
                fixedDecimalScale={false}
                allowNegative={false}
                allowLeadingZeros={true}
                suffix={` ${currency}`}
            />
        );
    })
);

class PixaWalletPowerDialog extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            _username: "",
            _amount: 0,
            _amount_percent: 0,
            _maxPXP: props.maxPXP || 0,
            _maxPXA: props.maxPXA || 0,
            type: props.type || "POWER-UP",
            // Track if slider is being dragged
            _isDragging: false,
            // Temporary value while dragging
            _tempPercent: 0,
            // Track open state for reset
            _wasOpen: false,
        };
    }

    static getDerivedStateFromProps(nextProps, prevState) {
        const updates = {};
        const isOpening = !!nextProps.open && !prevState._wasOpen;
        if (nextProps.type && nextProps.type !== prevState.type) {
            updates.type = nextProps.type;
            updates._amount = 0;
            updates._amount_percent = 0;
            updates._tempPercent = 0;
        }
        if (isOpening) {
            updates._amount = 0;
            updates._amount_percent = 0;
            updates._tempPercent = 0;
            updates._isDragging = false;
        }
        updates._wasOpen = !!nextProps.open;
        if (nextProps.maxPXP !== undefined && nextProps.maxPXP !== prevState._maxPXP) {
            updates._maxPXP = nextProps.maxPXP;
        }
        if (nextProps.maxPXA !== undefined && nextProps.maxPXA !== prevState._maxPXA) {
            updates._maxPXA = nextProps.maxPXA;
        }
        return Object.keys(updates).length > 0 ? updates : null;
    }

    _clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    _isPowerDown = () => (this.state.type || "").toUpperCase() === "POWER-DOWN";

    _currentMax = () => {
        const { _maxPXP, _maxPXA } = this.state;
        return this._isPowerDown() ? _maxPXP : _maxPXA;
    };

    _currency = () => (this._isPowerDown() ? "PXP" : "PXA");

    _description = () => {
        if (this._isPowerDown()) {
            return t("components.pixa_wallet_power_dialog.if_you_change_the_power_down");
        }
        return t("components.pixa_wallet_power_dialog.pixa_power_pxp_is_non_transferable");
    };

    _handleAmountFromPercent = (percent) => {
        const max = this._currentMax();
        const p = this._clamp(Number(percent) || 0, 0, 100);
        const amount = (max * p) / 100;
        this.setState({ _amount_percent: p, _amount: amount });
    };

    _handlePercentFromAmount = (amount) => {
        const max = this._currentMax();
        const a = this._clamp(Number(amount) || 0, 0, max);
        const p = max > 0 ? (a / max) * 100 : 0;
        this.setState({ _amount: a, _amount_percent: p, _tempPercent: p });
    };

    // While dragging, only update temp value
    _onSliderChange = (_, value) => {
        const v = Array.isArray(value) ? value[0] : value;
        this.setState({ _isDragging: true, _tempPercent: v });
    };

    // When released, commit the value
    _onSliderChangeCommitted = (_, value) => {
        const v = Array.isArray(value) ? value[0] : value;
        this._handleAmountFromPercent(v);
        this.setState({ _isDragging: false, _tempPercent: v });
    };

    _onTextChange = (e) => {
        const raw = e?.target?.value ?? "0";
        this._handlePercentFromAmount(raw);
    };

    shouldComponentUpdate(nextProps, nextState) {
        // Don't re-render while dragging unless tempPercent changed
        if (nextState._isDragging && this.state._isDragging) {
            return nextState._tempPercent !== this.state._tempPercent;
        }
        return true;
    }

    // Fiat value of a PXA-denominated amount in the user's reference currency
    // (PXP is PXA-denominated too). Null while the price is unknown, so the
    // fiat parenthesis is simply not printed rather than printing "0.00".
    _fiat = (pxaAmount) => {
        const { pixaUsdPrice, fiatRate, fiatCurrency } = this.props;
        const price = Number(pixaUsdPrice);
        if (!Number.isFinite(price) || price <= 0) return null;
        return formatFiatFromUsd(pxaAmount * price, fiatRate, fiatCurrency || "USD", 2);
    };

    /**
     * The payout plan for the amount being chosen — shown live under the
     * field for a power-down, and worth-about line for a power-up.
     */
    _renderPlan = (amount) => {
        const { classes, powerDownIntervals, powerDownIntervalSeconds } = this.props;
        const fiatOf = this._fiat;

        if (!this._isPowerDown()) {
            const fiat = fiatOf(amount);
            if (!fiat) return null;
            return (
                <Typography variant="body2" component="p" className={classes.scheduleLine} style={{ margin: "0px 0px 16px 0px" }}>
                    {t("components.pixa_wallet_dialog.worth_about", { fiat })}
                </Typography>
            );
        }

        const plan = previewPowerDown({ amountPxa: amount, intervals: powerDownIntervals, intervalSeconds: powerDownIntervalSeconds });
        const instalmentFiat = fiatOf(plan.instalmentPxa);
        const totalFiat = fiatOf(plan.totalPxa);
        // Once the schedule is known these are whole days; a non-integer
        // interval (custom chain config) is shown with one decimal.
        const days = formatNumber(plan.intervalDays, { min: 0, max: 1 });

        return (
            <div className={classes.schedule}>
                <Typography variant="body2" component="p" className={classes.scheduleLead}>
                    {t("components.pixa_wallet_power_dialog.paid_out_in_instalments", { count: formatNumber(plan.instalments, 0), days })}
                </Typography>
                <Typography variant="body2" component="p" className={classes.scheduleLine}>
                    {t("components.pixa_wallet_power_dialog.each_instalment", {
                        amount: formatAmount(plan.instalmentPxa, "PXA", 3),
                        fiat: instalmentFiat || "—",
                    })}
                </Typography>
                <Typography variant="body2" component="p" className={classes.scheduleLine}>
                    {t("components.pixa_wallet_power_dialog.first_payment", { date: formatDate(plan.firstDate) })}
                </Typography>
                <Typography variant="body2" component="p" className={classes.scheduleLine}>
                    {t("components.pixa_wallet_power_dialog.last_payment", { date: formatDate(plan.lastDate) })}
                </Typography>
                <Typography variant="body2" component="p" className={classes.scheduleLead}>
                    {t("components.pixa_wallet_power_dialog.total_at_todays_price", {
                        amount: formatAmount(plan.totalPxa, "PXA", 3),
                        fiat: totalFiat || "—",
                    })}
                </Typography>
                <Typography variant="caption" component="span" className={classes.scheduleNote}>
                    {t("components.pixa_wallet_power_dialog.estimate_note")}
                </Typography>
            </div>
        );
    };

    render() {
        const { classes, open, onClose, onConfirm, keepMounted = false } = this.props;
        const { _username, _amount, _amount_percent, _isDragging, _tempPercent } = this.state;

        const isPowerDown = this._isPowerDown();
        const title = isPowerDown ? t("components.pixa_wallet_dialog.power_down_2") : t("components.pixa_wallet_dialog.power_up");
        const startAdornment = isPowerDown ? <PixaPower style={{marginBottom:-12}}/> : <PixaLiquid style={{marginBottom:-12}}/>;
        const currency = this._currency();
        const description = this._description();
        const max = this._currentMax();

        // Use temp value while dragging, committed value otherwise
        const displayPercent = _isDragging ? Math.round(_tempPercent) : Math.round(_amount_percent);
        const displayAmount = Number.isFinite(_amount) ? Number(_amount.toFixed(2)) : 0;

        const noBalance = max <= 0;
        const disabledTooltip = noBalance
            ? t("components.pixa_wallet_power_dialog.you_dont_have_any_to", {
            currency: currency,
            title: title.toLowerCase()
        })
            : "";

        return (
            <Dialog
                open={!!open}
                fullWidth
                disablePortal={false}
                onClose={onClose}
                keepMounted={keepMounted}
                PaperProps={{ classes: { root: classes.darkGreyDialog } }}
            >
                <DialogContent>
                    <Typography component={"h2"} variant={"h6"}>
                        {title}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" component="p" style={{ margin: "32px 0 16px" }}>
                        {description}
                    </Typography>

                    <form noValidate autoComplete="off">
                        <Slider
                            color="secondary"
                            className={classes.slider}
                            value={displayPercent}
                            onChange={this._onSliderChange}
                            onChangeCommitted={this._onSliderChangeCommitted}
                            valueLabelDisplay="auto"
                            marks={SLIDER_MARKS}
                            min={0}
                            max={100}
                            step={1}
                        />

                        <TextField
                            style={{ margin: "32px 0 16px" }}
                            fullWidth
                            onChange={this._onTextChange}
                            label={t("words.amount")}
                            variant="filled"
                            value={displayAmount}
                            InputLabelProps={{ shrink: true }}
                            InputProps={{
                                inputComponent: NumberFormatCustom,
                                // `locale` doubles as the memo-buster: a language switch
                                // re-formats the field even though its value did not move.
                                inputProps: { currency, locale: resolveLocale() },
                                startAdornment: startAdornment
                            }}
                            helperText={t("components.pixa_wallet_power_dialog.max", { max: formatNumber(max, { min: 0, max: 2 }), currency })}
                        />
                    </form>

                    <Collapse in={displayAmount > 0}>
                        {this._renderPlan(displayAmount)}
                    </Collapse>
                </DialogContent>
                <DialogActions style={{ textAlign: "right" }} className={classes.darkGreyActions}>
                    <Button variant="text" color="primary" onClick={onClose}>{t("words.cancel", {TUC: true})} </Button>
                    <Tooltip title={disabledTooltip} disableHoverListener={!noBalance && displayAmount > 0} disableFocusListener={!noBalance && displayAmount > 0} disableTouchListener={!noBalance && displayAmount > 0}>
                        <span>
                            <Button
                                variant="contained"
                                color="primary"
                                autoFocus
                                onClick={() => onConfirm?.(_username, Number(_amount.toFixed(2)))}
                                disabled={noBalance || displayAmount <= 0}
                            >{t("words.confirm", {TUC: true})} </Button>
                        </span>
                    </Tooltip>
                </DialogActions>
            </Dialog>
        );
    }
}

export default withLanguage(withStyles(styles)(PixaWalletPowerDialog));
