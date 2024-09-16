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
import PixaLiquid from "../icons/PixaLiquid";
import PixaPower from "../icons/PixaPower";
import PixaSupra from "../icons/PixaSupra";

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
        }
    },
});

// Fewer marks = better performance
const SLIDER_MARKS = [
    { value: 0, label: "0%" },
    { value: 25, label: "25%" },
    { value: 50, label: "50%" },
    { value: 75, label: "75%" },
    { value: 100, label: "100%" },
];

// MUI TextField inputComponent must forward ref:
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

    _currentMax = () => {
        const { _maxPXP, _maxPXA, type } = this.state;
        const t = (type || "").toUpperCase();
        return t === "POWER-DOWN" ? _maxPXP : _maxPXA;
    };

    _currency = () => {
        const kind = (this.state.type || "").toUpperCase();
        return kind === "POWER-DOWN" ? "PXP" : "PXA";
    };

    _description = () => {
        const kind = (this.state.type || "").toUpperCase();
        if (kind === "POWER-DOWN") {
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

    render() {
        const { classes, open, onClose, onConfirm, keepMounted = false } = this.props;
        const { _username, _amount, _amount_percent, _isDragging, _tempPercent, type } = this.state;

        const title = (type || "").toUpperCase() === "POWER-DOWN" ? t("components.pixa_wallet_dialog.power_down_2") : t("components.pixa_wallet_dialog.power_up");
        const startAdornment = (type || "").toUpperCase() === "POWER-DOWN" ? <PixaPower style={{marginBottom:-12}}/> : <PixaLiquid style={{marginBottom:-12}}/>;
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
                            style={{ margin: "32px 0 24px" }}
                            fullWidth
                            onChange={this._onTextChange}
                            label={t("words.amount")}
                            variant="filled"
                            value={displayAmount}
                            InputLabelProps={{ shrink: true }}
                            InputProps={{
                                inputComponent: NumberFormatCustom,
                                inputProps: { currency },
                                startAdornment: startAdornment
                            }}
                            helperText={t("components.pixa_wallet_power_dialog.max", { max, currency })}
                        />
                    </form>
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