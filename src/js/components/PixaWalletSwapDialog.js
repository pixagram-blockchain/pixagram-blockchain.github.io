import * as React from "preact/compat";
import { NumericFormat } from "react-number-format";
import withStyles from "@material-ui/core/styles/withStyles";
import Typography from "@material-ui/core/Typography";
import TextField from "@material-ui/core/TextField";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import Slider from "@material-ui/core/Slider";
import Tooltip from "@material-ui/core/Tooltip";
import LinearProgress from "@material-ui/core/LinearProgress";
import Collapse from "@material-ui/core/Collapse";
import SwapHorizRounded from "@material-ui/icons/SwapHorizRounded";
import PixaSupra from "../icons/PixaSupra";
import PixaLiquid from "../icons/PixaLiquid";

import { t } from "../utils/text";
import { formatAmount, formatFiatFromUsd, numericInputProps, resolveLocale } from "../utils/numberFormat";

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
        },
    },
    progress: {
        margin: "16px 0px 16px 0px !important",
        "&.MuiLinearProgress-colorPrimary": {
            backgroundColor: "#222",
        },
        "& div.MuiLinearProgress-barColorPrimary": {
            backgroundColor: "#666",
        },
    },
});

const SLIDER_MARKS = [
    { value: 0, label: "0%" },
    { value: 25, label: "25%" },
    { value: 50, label: "50%" },
    { value: 75, label: "75%" },
    { value: 100, label: "100%" },
];

// Round DOWN to `d` decimals so the amount can never exceed the balance
// (9.278 must not become 9.28). The epsilon absorbs float noise.
const floorTo = (v, d) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return 0;
    const f = Math.pow(10, d);
    return Math.floor(n * f + 1e-9) / f;
};

// Chain assets (PXA / PXS) carry 3 decimals.
const DECIMALS = 3;

// Conversion rules on the Pixa chain (Hive's, unchanged — see
// pixagram-blockchain/information, 05-pixa-supra/haircut-corridor-and-settlement.md):
//   PXA → PXS  `collateralized_convert`. The PXA is locked as collateral and half
//              of it is converted at once, at the feed price plus a 5% fee. About
//              3.5 days later the chain burns what that PXS cost at the median then
//              (fee included) and returns the rest of the collateral.
//   PXS → PXA  `convert`. No fee. The PXS leaves the balance now and the PXA is paid
//              about 3.5 days later, at the median feed in force at that moment.
const COLLATERAL_CONVERTED_SHARE = 0.5; // 200% collateral: half is converted at once
const COLLATERALIZED_FEE = 0.05;        // PXA → PXS only

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
                decimalScale={DECIMALS}
                fixedDecimalScale={false}
                allowNegative={false}
                allowLeadingZeros={true}
                suffix={` ${currency}`}
            />
        );
    })
);

class PixaWalletSwapDialog extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            _maxPXS: props.maxPXS || 0,
            _maxPXA: props.maxPXA || 0,
            _amount: 0,
            _amount_percent: 0,
            _isDragging: false,
            _tempPercent: 0,
            _wasOpen: false,
            type: props.type || "PIXA",
        };
    }

    static getDerivedStateFromProps(nextProps, prevState) {
        const updates = {};
        const isOpening = !!nextProps.open && !prevState._wasOpen;
        const isClosing = !nextProps.open && prevState._wasOpen;

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

        if (isClosing) {
            updates._amount = 0;
            updates._amount_percent = 0;
        }

        updates._wasOpen = !!nextProps.open;

        if (nextProps.maxPXS !== undefined && nextProps.maxPXS !== prevState._maxPXS) {
            updates._maxPXS = nextProps.maxPXS;
        }
        if (nextProps.maxPXA !== undefined && nextProps.maxPXA !== prevState._maxPXA) {
            updates._maxPXA = nextProps.maxPXA;
        }

        return Object.keys(updates).length > 0 ? updates : null;
    }

    _clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    _currentMax = () => {
        const { _maxPXS, _maxPXA, type } = this.state;
        const t = (type || "").toUpperCase();
        return t === "SUPRA" ? _maxPXS : _maxPXA;
    };

    _currency = () => {
        const t = (this.state.type || "").toUpperCase();
        return t === "SUPRA" ? "PXS" : "PXA";
    };

    _otherCurrency = () => {
        const t = (this.state.type || "").toUpperCase();
        return t === "SUPRA" ? "PXA" : "PXS";
    };

    // PXA per PXS at the witness median feed. The wallet prices PXS as
    // PXA × that feed ratio (api.prices), so dividing the two USD prices gives
    // the rate conversions settle at. (The internal-market ticker used before
    // is not what conversions use, and it fell back to a hard-coded 57.)
    _feedRatio = () => {
        const pxaUsd = Number(this.props.pixaUsdPrice);
        const pxsUsd = Number(this.props.pxsUsdPrice);
        return Number.isFinite(pxaUsd) && Number.isFinite(pxsUsd) && pxaUsd > 0 && pxsUsd > 0
            ? pxsUsd / pxaUsd
            : 0;
    };

    // Estimate of what the conversion pays: PXS credited at once for PXA → PXS,
    // PXA paid at settlement for PXS → PXA. 0 while the feed is unknown.
    _computeOtherAmount = (amount) => {
        const ratio = this._feedRatio();
        if (!(ratio > 0)) return 0;
        const kind = (this.state.type || "").toUpperCase();
        return kind === "SUPRA"
            ? amount * ratio
            : (amount * COLLATERAL_CONVERTED_SHARE) / (ratio * (1 + COLLATERALIZED_FEE));
    };

    _handleAmountFromPercent = (percent) => {
        const max = this._currentMax();
        const p = this._clamp(Number(percent) || 0, 0, 100);
        const amount = floorTo((max * p) / 100, DECIMALS);
        this.setState({ _amount_percent: p, _amount: amount });
    };

    _handlePercentFromAmount = (amount) => {
        const max = this._currentMax();
        const a = floorTo(this._clamp(Number(amount) || 0, 0, max), DECIMALS);
        const p = max > 0 ? (a / max) * 100 : 0;
        this.setState({ _amount: a, _amount_percent: p, _tempPercent: p });
    };

    _onSliderChange = (_, value) => {
        const v = Array.isArray(value) ? value[0] : value;
        this.setState({ _isDragging: true, _tempPercent: v });
    };

    _onSliderChangeCommitted = (_, value) => {
        const v = Array.isArray(value) ? value[0] : value;
        this._handleAmountFromPercent(v);
        this.setState({ _isDragging: false, _tempPercent: v });
    };

    _onTextChange = (e) => {
        const raw = e?.target?.value ?? "0";
        this._handlePercentFromAmount(raw);
    };

    _onMaxClick = () => {
        const max = this._currentMax();
        this._handlePercentFromAmount(max);
    };

    toggleCurrency = () => {
        if (typeof this.props.onToggleCurrency === "function") {
            this.props.onToggleCurrency(
                (this.state.type || "").toUpperCase() === "PIXA" ? "SUPRA" : "PIXA"
            );
        }
    };

    shouldComponentUpdate(nextProps, nextState) {
        if (nextState._isDragging && this.state._isDragging) {
            return nextState._tempPercent !== this.state._tempPercent;
        }
        return true;
    }

    render() {
        const { classes, open, onClose, onConfirm } = this.props;
        const {
            _amount,
            _amount_percent,
            _isDragging,
            _tempPercent,
            type,
        } = this.state;

        const currency = this._currency();
        const otherCurrency = this._otherCurrency();
        const max = this._currentMax();
        const displayPercent = _isDragging
            ? Math.round(_tempPercent)
            : Math.round(_amount_percent);
        const displayAmount = floorTo(_amount, DECIMALS);
        const otherAmount = this._computeOtherAmount(displayAmount);
        // Rounded down to the chain's 3 decimals, as the chain does.
        const displayOtherAmount = Number.isFinite(otherAmount)
            ? floorTo(otherAmount, DECIMALS)
            : 0;
        // Worth of the amount received, in the user's reference currency. It sits
        // under "Receive", and for PXA → PXS it is about half the worth of the PXA
        // locked (the other half comes back later). Prices come from the wallet
        // (api.prices) — nothing is hard-coded — and the line is simply not shown
        // while they are unknown.
        const { pixaUsdPrice, pxsUsdPrice, fiatRate, fiatCurrency } = this.props;
        const receiveUnitUsd = Number(otherCurrency === "PXA" ? pixaUsdPrice : pxsUsdPrice);
        const fiatValue = Number.isFinite(receiveUnitUsd) && receiveUnitUsd > 0
            ? formatFiatFromUsd(displayOtherAmount * receiveUnitUsd, fiatRate, fiatCurrency || "USD", 2)
            : null;
        const locale = resolveLocale();
        const noBalance = max <= 0;
        const amountInvalid = displayAmount <= 0 || displayAmount > max;

        return (
            <Dialog
                open={!!open}
                fullWidth
                disablePortal={false}
                onClose={onClose}
                keepMounted={false}
                PaperProps={{ classes: { root: classes.darkGreyDialog } }}
            >
                <DialogContent>
                    <Typography component="h2" variant="h6">
                        {t("components.pixa_wallet_swap_dialog.convert_to", {
                            currency: currency,
                            otherCurrency: otherCurrency
                        })}
                    </Typography>

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

                    <Collapse in={displayAmount > max}>
                        <Typography
                            variant="body2"
                            color="textSecondary"
                            component="p"
                            style={{
                                margin: "8px 21px 16px 21px",
                                textAlign: "left",
                            }}
                        >
                            {t(
                                "components.pixa_wallet_swap_dialog.error_the_amount_is_above_your_balance"
                            )}
                        </Typography>
                    </Collapse>

                    <div style={{ display: "flex", gap: "16px" }}>
                        <div style={{ flex: 1 }}>
                            <TextField
                                style={{ margin: "16px 0px 8px 0px" }}
                                fullWidth
                                onChange={this._onTextChange}
                                label={t("components.pixa_wallet_swap_dialog.convert")}
                                variant="filled"
                                value={displayAmount}
                                InputLabelProps={{ shrink: true }}
                                InputProps={{
                                    inputComponent: NumberFormatCustom,
                                    inputProps: { currency, locale },
                                    endAdornment: (
                                        <Tooltip
                                            title={t("components.pixa_wallet_swap_dialog.swap_instead_of", {
                                                otherCurrency: otherCurrency,
                                                currency: currency
                                            })}
                                        >
                                            <Button onClick={this.toggleCurrency}>
                                                <SwapHorizRounded
                                                    style={{ marginRight: "4px" }}
                                                />{" "}
                                                {otherCurrency}
                                            </Button>
                                        </Tooltip>
                                    ),
                                    startAdornment:
                                        currency !== "PXA" ? (
                                            <PixaSupra
                                                style={{
                                                    margin: "0px 8px -24px 0px",
                                                    fontSize: "1.5em",
                                                }}
                                            />
                                        ) : (
                                            <PixaLiquid
                                                style={{
                                                    margin: "0px 8px -24px 0px",
                                                    fontSize: "1.5em",
                                                }}
                                            />
                                        ),
                                }}
                            />
                            <Typography
                                variant="body2"
                                color="textSecondary"
                                component="p"
                                style={{
                                    margin: "0px 21px 16px 21px",
                                    textAlign: "right",
                                }}
                            >
                                <span>{t("components.pixa_wallet_swap_dialog.maxima")} </span>
                                <span
                                    onClick={this._onMaxClick}
                                    style={{
                                        cursor: "pointer",
                                        textDecoration: "underline",
                                    }}
                                >{formatAmount(max, currency, { min: 0, max: 3 })}</span>
                            </Typography>
                        </div>
                        <div style={{ flex: 1 }}>
                            <TextField
                                style={{ margin: "16px 0px 8px 0px" }}
                                fullWidth
                                label={t("components.pixa_wallet_swap_dialog.receive")}
                                variant="filled"
                                disabled
                                value={displayOtherAmount}
                                InputLabelProps={{ shrink: true }}
                                InputProps={{
                                    inputComponent: NumberFormatCustom,
                                    inputProps: { currency: otherCurrency, locale },
                                    startAdornment:
                                        otherCurrency !== "PXA" ? (
                                            <PixaSupra
                                                style={{
                                                    margin: "0px 8px -24px 0px",
                                                    fontSize: "1.5em",
                                                }}
                                            />
                                        ) : (
                                            <PixaLiquid
                                                style={{
                                                    margin: "0px 8px -24px 0px",
                                                    fontSize: "1.5em",
                                                }}
                                            />
                                        ),
                                }}
                            />
                            <Typography
                                variant="body2"
                                color="textSecondary"
                                component="p"
                                style={{
                                    margin: "0px 21px 24px 21px",
                                    textAlign: "right",
                                }}
                            >{fiatValue ? t("components.pixa_wallet_dialog.worth_about", { fiat: fiatValue }) : ""}</Typography>
                        </div>
                    </div>
                    {/* How this direction settles: what arrives now, what later, the fee. */}
                    <Typography
                        variant="body2"
                        color="textSecondary"
                        component="p"
                        style={{
                            margin: "0px 21px 8px 21px",
                            textAlign: "left",
                        }}
                    >
                        {currency === "PXA"
                            ? t("components.pixa_wallet_swap_dialog.half_of_the_pxa_is_converted_at")
                            : t("components.pixa_wallet_swap_dialog.no_fee_the_pxs_leaves_your_balance")}
                    </Typography>
                </DialogContent>
                <DialogActions
                    style={{ textAlign: "right" }}
                    className={classes.darkGreyActions}
                >
                    <Button variant="text" color="primary" onClick={onClose}>{t("words.cancel", {TUC: true})} </Button>
                    <Tooltip
                        title={
                            noBalance
                                ? t("components.pixa_wallet_swap_dialog.you_dont_have_any_to_swap", {
                                    currency: currency
                                })
                                : ""
                        }
                        disableHoverListener={!noBalance && !amountInvalid}
                        disableFocusListener={!noBalance && !amountInvalid}
                        disableTouchListener={!noBalance && !amountInvalid}
                    >
                            <span>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    autoFocus
                                    onClick={() => onConfirm?.(displayAmount, currency)}
                                    disabled={noBalance || amountInvalid}
                                >{t("words.confirm", {TUC: true})} </Button>
                            </span>
                    </Tooltip>
                </DialogActions>
            </Dialog>
        );
    }
}

export default withLanguage(withStyles(styles)(PixaWalletSwapDialog));