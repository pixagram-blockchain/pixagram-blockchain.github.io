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
import BankTransferOut from "@material-ui/icons/AccountBalanceRounded";
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
                decimalScale={3}
                fixedDecimalScale={false}
                allowNegative={false}
                allowLeadingZeros={true}
                suffix={` ${currency}`}
            />
        );
    })
);

/**
 * Deposit / withdraw a single currency (PXA or PXS) to/from savings.
 *
 * The currency is fixed by the `type` prop ("PIXA" | "SUPRA"); the `mode`
 * prop ("deposit" | "withdraw") selects which balance caps the amount and
 * what copy is shown. Confirmation is delegated to the parent
 * (onConfirm(mode, amount, currency)) which raises the shared white confirm
 * dialog, so there is no SwipeSend here.
 */
class PixaWalletSavingsDialog extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            _maxDeposit: props.maxDeposit || 0,
            _maxWithdraw: props.maxWithdraw || 0,
            _amount: 0,
            _amount_percent: 0,
            _isDragging: false,
            _tempPercent: 0,
            _wasOpen: false,
            type: props.type || "PIXA",
            mode: props.mode || "deposit",
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

        if (nextProps.mode && nextProps.mode !== prevState.mode) {
            updates.mode = nextProps.mode;
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

        if (nextProps.maxDeposit !== undefined && nextProps.maxDeposit !== prevState._maxDeposit) {
            updates._maxDeposit = nextProps.maxDeposit;
        }
        if (nextProps.maxWithdraw !== undefined && nextProps.maxWithdraw !== prevState._maxWithdraw) {
            updates._maxWithdraw = nextProps.maxWithdraw;
        }

        return Object.keys(updates).length > 0 ? updates : null;
    }

    _clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    _isDeposit = () => (this.state.mode || "deposit") === "deposit";

    _currentMax = () => {
        const { _maxDeposit, _maxWithdraw } = this.state;
        return this._isDeposit() ? _maxDeposit : _maxWithdraw;
    };

    _currency = () => {
        const t = (this.state.type || "").toUpperCase();
        return t === "SUPRA" ? "PXS" : "PXA";
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

    shouldComponentUpdate(nextProps, nextState) {
        if (nextState._isDragging && this.state._isDragging) {
            return nextState._tempPercent !== this.state._tempPercent;
        }
        return true;
    }

    render() {
        const { classes, open, onClose, onConfirm } = this.props;
        const { _amount, _amount_percent, _isDragging, _tempPercent } = this.state;

        const isDeposit = this._isDeposit();
        const currency = this._currency();
        const max = this._currentMax();
        const displayPercent = _isDragging
            ? Math.round(_tempPercent)
            : Math.round(_amount_percent);
        const displayAmount = Number.isFinite(_amount)
            ? Number(_amount.toFixed(3))
            : 0;
        const noBalance = max <= 0;
        const amountInvalid = displayAmount <= 0 || displayAmount > max;

        const title = isDeposit ? t("words.deposit_to_savings") : t("words.withdraw_from_savings");
        const note = isDeposit
            ? t("components.pixa_wallet_savings_dialog.funds_in_savings_can_be_withdrawn_at")
            : t("components.pixa_wallet_savings_dialog.withdrawals_are_released_after_a_3");
        const emptyTooltip = isDeposit
            ? t("components.pixa_wallet_savings_dialog.you_dont_have_any_to_deposit", { currency })
            : t("components.pixa_wallet_savings_dialog.you_dont_have_any_in_savings", { currency });

        const CurrencyIcon = currency === "PXA" ? PixaLiquid : PixaSupra;

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
                        {title}
                    </Typography>

                    <Typography
                        variant="body2"
                        color="textSecondary"
                        component="p"
                        style={{ margin: "8px 0px 0px 0px" }}
                    >
                        {note}
                    </Typography>

                    <LinearProgress
                        className={classes.progress}
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
                            style={{ margin: "8px 21px 16px 21px", textAlign: "left" }}
                        >
                            {isDeposit
                                ? t("components.pixa_wallet_savings_dialog.error_the_amount_is_above_your")
                                : t("components.pixa_wallet_savings_dialog.error_the_amount_is_above_your_2")}
                        </Typography>
                    </Collapse>

                    <TextField
                        style={{ margin: "16px 0px 8px 0px" }}
                        fullWidth
                        onChange={this._onTextChange}
                        label={isDeposit ? t("components.pixa_wallet_savings_dialog.deposit") : t("components.pixa_wallet_savings_dialog.withdraw")}
                        variant="filled"
                        value={displayAmount}
                        InputLabelProps={{ shrink: true }}
                        InputProps={{
                            inputComponent: NumberFormatCustom,
                            inputProps: { currency },
                            startAdornment: (
                                <CurrencyIcon
                                    style={{ margin: "0px 8px -12px 0px", fontSize: "1em" }}
                                />
                            ),
                        }}
                    />
                    <Typography
                        variant="body2"
                        color="textSecondary"
                        component="p"
                        style={{ margin: "0px 21px 24px 21px", textAlign: "right" }}
                    >
                        <span>{isDeposit ? t("components.pixa_wallet_savings_dialog.available") : t("components.pixa_wallet_savings_dialog.in_savings")}</span>
                        <span
                            onClick={this._onMaxClick}
                            style={{ cursor: "pointer", textDecoration: "underline" }}
                        >{`${Number(max.toFixed(3))} ${currency}`}</span>
                    </Typography>
                </DialogContent>

                <DialogActions style={{ textAlign: "right" }}>
                    <Button variant="text" color="primary" onClick={onClose}>
                        {t("words.cancel", { TUC: true })}
                    </Button>
                    <Tooltip
                        title={noBalance ? emptyTooltip : ""}
                        disableHoverListener={!noBalance && !amountInvalid}
                        disableFocusListener={!noBalance && !amountInvalid}
                        disableTouchListener={!noBalance && !amountInvalid}
                    >
                        <span>
                            <Button
                                variant="contained"
                                color="primary"
                                autoFocus
                                onClick={() =>
                                    onConfirm?.(
                                        isDeposit ? "deposit" : "withdraw",
                                        Number(_amount.toFixed(3)),
                                        currency
                                    )
                                }
                                disabled={noBalance || amountInvalid}
                            >
                                {isDeposit ? t("components.pixa_wallet_savings_dialog.deposit", { TUC: true }) : t("components.pixa_wallet_savings_dialog.withdraw", { TUC: true })}{" "}
                                <BankTransferOut style={{ marginLeft: "8px" }} />
                            </Button>
                        </span>
                    </Tooltip>
                </DialogActions>
            </Dialog>
        );
    }
}

export default withLanguage(withStyles(styles)(PixaWalletSavingsDialog));
