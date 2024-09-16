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

const NumberFormatCustom = React.memo(
    React.forwardRef(function NumberFormatCustom(props, ref) {
        const { onChange, currency, name, ...other } = props;
        return (
            <NumericFormat
                {...other}
                getInputRef={ref}
                onValueChange={(values) => {
                    onChange?.({
                        target: { name, value: values.value },
                    });
                }}
                thousandSeparator={" "}
                decimalSeparator={"."}
                allowedDecimalSeparators={[",", "."]}
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
            _ticker: null,
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

    componentDidMount() {
        this._fetch_ticker();
    }

    componentDidUpdate(prevProps) {
        if (this.props.open && !prevProps.open) {
            this._fetch_ticker();
        }
    }

    _fetch_ticker = async () => {
        const { api } = this.props;
        if (!api) return;
        try {
            const ticker = await api.market.getTicker();
            this.setState({ _ticker: ticker });
        } catch (e) {
            /* ignore */
        }
    };

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

    _exchangeRate = () => {
        return this.state._ticker
            ? parseFloat(this.state._ticker.latest) || 57
            : 57;
    };

    _computeOtherAmount = (amount) => {
        const t = (this.state.type || "").toUpperCase();
        const rate = this._exchangeRate();
        return t === "SUPRA" ? amount * rate : amount / rate;
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
        const displayAmount = Number.isFinite(_amount)
            ? Number(_amount.toFixed(2))
            : 0;
        const otherAmount = this._computeOtherAmount(displayAmount);
        const displayOtherAmount = Number.isFinite(otherAmount)
            ? Number(otherAmount.toFixed(2))
            : 0;
        const usdValue =
            currency === "PXA"
                ? displayAmount * 0.1
                : displayAmount * 5.69;
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
                        {t("words.swap")}
                    </Typography>

                    <LinearProgress
                        className={classes.progress}
                        style={{ margin: "0px 0px 16px 0px" }}
                        variant="determinate"
                        value={displayPercent}
                    />

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
                                    inputProps: { currency },
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
                                                    margin: "0px 8px -12px 0px",
                                                    fontSize: "1em",
                                                }}
                                            />
                                        ) : (
                                            <PixaLiquid
                                                style={{
                                                    margin: "0px 8px -12px 0px",
                                                    fontSize: "1em",
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
                                >{`${max} ${currency}`}</span>
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
                                    inputProps: { currency: otherCurrency },
                                    startAdornment:
                                        otherCurrency !== "PXA" ? (
                                            <PixaSupra
                                                style={{
                                                    margin: "0px 8px -12px 0px",
                                                    fontSize: "1em",
                                                }}
                                            />
                                        ) : (
                                            <PixaLiquid
                                                style={{
                                                    margin: "0px 8px -12px 0px",
                                                    fontSize: "1em",
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
                            >{`= $${usdValue.toFixed(2)}`}</Typography>
                        </div>
                    </div>
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
                                    onClick={() => onConfirm?.(Number(_amount.toFixed(2)), currency)}
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