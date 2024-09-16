import * as React from "preact/compat";
import {NumericFormat} from 'react-number-format';
import withStyles from "@material-ui/core/styles/withStyles";
import Typography from "@material-ui/core/Typography";
import TextField from "@material-ui/core/TextField";
import Autocomplete from '@material-ui/lab/Autocomplete';
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import Slider from "@material-ui/core/Slider";
import Avatar from "@material-ui/core/Avatar";
import SwipeSend from "./SwipeSend";
import PixaPower from "../icons/PixaPower";
import Collapse from "@material-ui/core/Collapse";
import Fade from "@material-ui/core/Fade";
import Grow from "@material-ui/core/Grow";
import Tooltip from "@material-ui/core/Tooltip";
import CircularProgress from "@material-ui/core/CircularProgress";

import { T } from "../utils/T";
import { t } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";
/*
 * PixaWalletSendPowerDialog
 * ─────────────────────────
 * A privileged dialog used by special accounts (pixa.team, pixa.rex) to
 * transfer Pixa Power (PXP / VESTS) directly to another account.
 *
 * Standard PXP is non-transferable on a HIVE/STEEM-style chain. This dialog
 * targets a custom_json operation under id: "pixa.power" with action
 * "transfer_power", broadcast under the *active* authority. That envelope is
 * deliberately chosen because:
 *   1. it requires active auth, matching the value-bearing nature of the op,
 *   2. it is forward-compatible with multi-signature flows (multiple entries
 *      in required_auths trigger an n-of-m signing aggregation on the chain),
 *   3. it doesn't depend on a forked native op being shipped first — the
 *      chain can later interpret pixa.power custom_jsons in a hardfork,
 *      with no UI rewrite needed.
 *
 * The signing/broadcast itself is handled by the parent
 * (PixaWalletDialog._handle_send_power_confirm); this component only collects
 * inputs (recipient + amount) and gates them behind the swipe-to-confirm.
 */

const styles = theme => ({
    slider: {
        margin: "16px 16px 32px 16px",
        width: "calc(100% - 32px)",
        "& .MuiSlider-valueLabel": { color: "#fff" },
        "& .MuiSlider-valueLabel > span > span": { color: "#000" },
        "& .MuiSlider-thumb": { boxShadow: "0px 0px 0px 14px rgb(255 255 255 / 16%)" },
        "& .MuiSlider-active.MuiSlider-thumb": { boxShadow: "0px 0px 0px 14px rgb(255 255 255 / 24%)" }
    },
    popper: { backgroundColor: "#242424ff !important" },
    darkGreyDialog: {
        backgroundColor: "#181818ff !important",
        "& .MuiButton-contained.Mui-disabled": { opacity: 0.35 }
    },
    whiteDialog: {
        backgroundColor: "#fff !important",
        color: "#000 !important",
        boxShadow: "0px 11px 15px -7px rgb(255 255 255 / 20%), 0px 24px 38px 3px rgb(255 255 255 / 14%), 0px 9px 46px 8px rgb(255 255 255 / 12%) !important",
        "& .MuiTypography-colorTextSecondary": { color: "#101010 !important" },
        "& .MuiButton-textPrimary": { color: "#222 !important", "&:hover": { color: "#000 !important" } },
        "& .MuiButton-containedPrimary": {
            color: "#ddd !important", backgroundColor: "#111 !important",
            "&.Mui-disabled": { color: "#fff !important", backgroundColor: "#666 !important", opacity: 0.35 },
            "&:hover": { color: "#fff !important", backgroundColor: "#000 !important" }
        }
    },
    specialBanner: {
        backgroundColor: "#101010",
        borderRadius: "6px",
        padding: "8px 12px",
        margin: "16px 0px 12px 0px",
        color: "#ccc",
        fontSize: "12px",
        lineHeight: "1.4",
    }
});

const SLIDER_MARKS = [
    { value: 0, label: "0%" },
    { value: 25, label: "25%" },
    { value: 50, label: "50%" },
    { value: 75, label: "75%" },
    { value: 100, label: "100%" },
];

function NumberFormatCustom(props) {
    const { inputRef, onChange, ...other } = props;
    return (
        <NumericFormat
            {...other}
            ref={inputRef}
            onValueChange={(values) => {
                onChange({ target: { name: props.name, value: values.value } });
            }}
            thousandSeparator={" "}
            decimalSeparator={"."}
            allowedDecimalSeparators={[",", "."]}
            thousandsGroupStyle={'thousand'}
            decimalScale={6}
            fixedDecimalScale={false}
            allowNegative={false}
            allowLeadingZeros={true}
            suffix={" PXP"}
        />
    );
}

class PixaWalletSendPowerDialog extends React.PureComponent {

    constructor(props) {
        super(props);
        this.state = {
            classes: props.classes,
            open: props.open,
            _username: "",
            _confirm_open: false,
            _confirm_locked: true,
            _confirm_success: 0,
            _confirm_error: "",
            _maxPXP: props.maxPXP || 0,
            _amount_percent: 0,
            _amount: 0,
            _authors: [],
            _selected_author: null,
            _searching: false,
            _isDragging: false,
            _tempPercent: 0,
            // Reserved memo / coordination note (optional, currently unused on-chain
            // but useful for multi-sig audit trails).
            _memo: "",
        };
        this._searchTimer = null;
        this._profileCache = {};
    }

    shouldComponentUpdate() { return false; }

    componentWillUnmount() {
        if (this._searchTimer) clearTimeout(this._searchTimer);
    }

    componentWillReceiveProps(new_props) {
        const wasOpen = this.state.open;
        // Reset on close
        if (!new_props.open && wasOpen) {
            new_props = {
                ...new_props,
                _confirm_open: false,
                _confirm_locked: true,
                _confirm_success: 0,
                _confirm_error: "",
                _amount: 0,
                _amount_percent: 0,
                _tempPercent: 0,
                _username: "",
                _authors: [],
                _selected_author: null,
                _searching: false,
                _memo: "",
            };
        }
        // Reset on open (catches stale _confirm_success from race conditions)
        if (new_props.open && !wasOpen) {
            new_props = {
                ...new_props,
                _confirm_open: false,
                _confirm_locked: true,
                _confirm_success: 0,
                _confirm_error: "",
            };
        }
        const updates = {...new_props};
        if (new_props.maxPXP !== undefined) updates._maxPXP = new_props.maxPXP;
        this.setState(updates, () => this.forceUpdate());
    }

    // ── Account Search ──────────────────────────────────────────────

    _normalizeAuthor = (acc) => {
        if (!acc) return null;
        const username = acc.username || acc.name || '';
        if (!username) return null;
        if (this._profileCache[username]) return this._profileCache[username];
        const entry = {
            username,
            image: acc.image || (acc._profile && acc._profile.profile_image) || '',
            name: acc.display_name || (acc._profile && acc._profile.display_name) || username,
        };
        this._profileCache[username] = entry;
        return entry;
    };

    _onUsernameInputChange = (event, newInputValue) => {
        const input = (newInputValue || '').toLowerCase().replace(/^@/, '').trim();
        this.setState({_username: input}, () => this.forceUpdate());
        if (this._searchTimer) clearTimeout(this._searchTimer);
        if (!input) {
            this.setState({_authors: [], _searching: false, _selected_author: null}, () => this.forceUpdate());
            return;
        }
        if (this._profileCache[input]) {
            this.setState({_selected_author: this._profileCache[input]});
        }
        this._searchTimer = setTimeout(() => this._searchAccounts(input), 280);
    };

    _searchAccounts = async (input) => {
        const api = this.props.api;
        if (!api) return;
        this.setState({_searching: true}, () => this.forceUpdate());
        try {
            const names = await api.accounts.lookupAccounts(input, 7);
            if (!Array.isArray(names) || names.length === 0) {
                this.setState({_authors: [], _searching: false, _selected_author: null}, () => this.forceUpdate());
                return;
            }
            const accounts = await api.accounts.getAccounts(names);
            const authors = (accounts || []).map(a => this._normalizeAuthor(a)).filter(Boolean);
            const currentInput = this.state._username;
            const exactMatch = authors.find(a => a.username === currentInput) || null;
            this.setState({_authors: authors, _searching: false, _selected_author: exactMatch || this.state._selected_author}, () => this.forceUpdate());
        } catch (e) {
            this.setState({_searching: false}, () => this.forceUpdate());
        }
    };

    _onAutocompleteChange = (event, value) => {
        if (value && typeof value === 'object' && value.username) {
            this.setState({_username: value.username, _selected_author: value}, () => this.forceUpdate());
        } else if (typeof value === 'string') {
            const resolved = this._profileCache[value] || null;
            this.setState({_username: value, _selected_author: resolved}, () => {
                this.forceUpdate();
                if (!resolved && value.length > 0) this._resolveUsername(value);
            });
        }
    };

    _resolveUsername = async (username) => {
        const api = this.props.api;
        if (!api || !username) return;
        try {
            const accounts = await api.accounts.getAccounts([username]);
            if (accounts && accounts[0]) {
                const author = this._normalizeAuthor(accounts[0]);
                if (author && author.username === this.state._username) {
                    this.setState({_selected_author: author}, () => this.forceUpdate());
                }
            }
        } catch (e) {}
    };

    // ── Amount (slider + text) ──────────────────────────────────────

    _clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    _handleAmountFromPercent = (percent) => {
        const max = this.state._maxPXP;
        const p = this._clamp(Number(percent) || 0, 0, 100);
        const amount = (max * p) / 100;
        this.setState({ _amount_percent: p, _amount: amount }, () => this.forceUpdate());
    };

    _handlePercentFromAmount = (amount) => {
        const max = this.state._maxPXP;
        const a = this._clamp(Number(amount) || 0, 0, max);
        const p = max > 0 ? (a / max) * 100 : 0;
        this.setState({ _amount: a, _amount_percent: p, _tempPercent: p }, () => this.forceUpdate());
    };

    _onSliderChange = (_, value) => {
        const v = Array.isArray(value) ? value[0] : value;
        this.setState({ _isDragging: true, _tempPercent: v }, () => this.forceUpdate());
    };

    _onSliderChangeCommitted = (_, value) => {
        const v = Array.isArray(value) ? value[0] : value;
        this._handleAmountFromPercent(v);
        this.setState({ _isDragging: false, _tempPercent: v }, () => this.forceUpdate());
    };

    _onTextChange = (e) => {
        const raw = e?.target?.value ?? "0";
        this._handlePercentFromAmount(raw);
    };

    _onMemoChange = (e) => {
        const v = (e?.target?.value ?? "").slice(0, 256);
        this.setState({ _memo: v }, () => this.forceUpdate());
    };

    // ── Confirm dialog ──────────────────────────────────────────────

    _open_confirm_dialog = () => {
        const { _username, _selected_author } = this.state;
        if (_username && (!_selected_author || _selected_author.username !== _username)) {
            this._resolveUsername(_username);
        }
        this.setState({_confirm_open: true, _confirm_success: 0, _confirm_error: "", _confirm_locked: true}, () => this.forceUpdate());
    };

    _close_confirm_dialog = () => {
        this.setState({_confirm_open: false, _confirm_success: 0, _confirm_error: ""}, () => this.forceUpdate());
    };

    _confirm_transaction = async () => {
        if (this.state._confirm_success !== 0) return;
        const { _username, _amount, _memo } = this.state;
        this.setState({_confirm_success: 1, _confirm_error: ""}, () => this.forceUpdate());
        try {
            if (typeof this.props.onSendPower === 'function') {
                // Pass memo as a third arg so the parent can include it in
                // the custom_json payload when the chain supports it.
                await this.props.onSendPower(_username, _amount, _memo);
            }
            this.setState({_confirm_success: 2}, () => this.forceUpdate());
        } catch (err) {
            this.setState({_confirm_success: 0, _confirm_error: err.message || t("components.pixa_wallet_send_power_dialog.transfer_failed")}, () => this.forceUpdate());
        }
    };

    _unlock_confirm = () => { this.setState({_confirm_locked: false}, () => this.forceUpdate()); };
    _lock_confirm = () => { this.setState({_confirm_locked: true}, () => this.forceUpdate()); };

    render() {
        const {
            classes, _username, _amount, _amount_percent, _confirm_open, _maxPXP,
            _authors, _selected_author, _searching, _confirm_locked, _confirm_success,
            open, _isDragging, _tempPercent, _memo,
        } = this.state;

        const resolvedImage = (_selected_author && _selected_author.username === _username) ? _selected_author.image : '';
        const max = _maxPXP;
        const displayPercent = _isDragging ? Math.round(_tempPercent) : Math.round(_amount_percent);
        const displayAmount = Number.isFinite(_amount) ? Number(_amount.toFixed(6)) : 0;
        const ownerUsername = (this.props.account || {}).username || '';
        // Multi-sig hint: if the parent passes a co-signers list we surface it
        // in the confirm dialog so the user knows the broadcast won't settle
        // until the threshold is met.
        const cosigners = Array.isArray(this.props.cosigners) ? this.props.cosigners : [];
        const requiresMultisig = cosigners.length > 0;

        return (
            <React.Fragment>
                <Dialog open={open}
                        fullWidth={true}
                        disablePortal={false}
                        onClose={this.props.onClose}
                        keepMounted={false}
                        PaperProps={{classes: {root: classes.darkGreyDialog}}}>
                    <DialogContent>
                        <Typography component={"h2"} variant={"h6"}>{t("components.pixa_wallet_send_power_dialog.send_pixa_power")}</Typography>
                        <div className={classes.specialBanner}><T
                                k="components.pixa_wallet_send_power_dialog.strong_privileged_operation_strong_direct_pxp_tr"
                                vars={{
                                    ownerUsername: `@${ownerUsername}`
                                }} /></div>
                        <Typography variant="body2" color="textSecondary" component="p" style={{margin: "8px 0px 16px 0px"}}>{t(
                                "components.pixa_wallet_send_power_dialog.transfer_pixa_power_pxp_from_to_another",
                                {
                                    ownerUsername: `@${ownerUsername}`
                                }
                            )}</Typography>
                        <div>
                            <Autocomplete
                                classes={{paper: classes.popper}}
                                options={_authors}
                                getOptionLabel={(option) => typeof option === 'string' ? option : option.username || ''}
                                getOptionDisabled={(option) => option && option.username === ownerUsername}
                                filterOptions={(x) => x}
                                inputValue={_username}
                                onChange={this._onAutocompleteChange}
                                onInputChange={this._onUsernameInputChange}
                                loading={_searching}
                                loadingText={t("words.searching")}
                                noOptionsText={_username.length > 0 ? t("words.no_accounts_found") : t("words.type_a_username")}
                                renderOption={(option) => {
                                    const isOwn = option.username === ownerUsername;
                                    return (
                                        <div style={{ display: "flex", alignItems: "center", opacity: isOwn ? 0.4 : 1 }}>
                                            <Avatar src={option.image} alt={option.username} style={{ marginRight: 8, width: 32, height: 32, borderRadius: "8px" }} className={"pixelated"} />
                                            <div>
                                                <strong>@{option.username}</strong>{isOwn ? <span style={{color: "#888", fontWeight: "normal"}}> {t("words.you")}</span> : null}
                                                <div style={{ fontSize: 12, color: "#888" }}>{option.name}</div>
                                            </div>
                                        </div>
                                    );
                                }}
                                freeSolo
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label={t("words.recipient")}
                                        variant="filled"
                                        fullWidth
                                        InputLabelProps={{ shrink: true }}
                                        InputProps={{
                                            ...params.InputProps,
                                            startAdornment: (
                                                <React.Fragment>
                                                    <Avatar src={resolvedImage} style={{ width: 24, height: 24, marginRight: 6, borderRadius: "6px" }} className={"pixelated"} />
                                                    <span style={{ marginRight: -4, color: '#fff' }}>@</span>
                                                    {params.InputProps.startAdornment}
                                                </React.Fragment>
                                            ),
                                            endAdornment: (
                                                <React.Fragment>
                                                    {_searching ? <CircularProgress color="inherit" size={18} /> : null}
                                                    {params.InputProps.endAdornment}
                                                </React.Fragment>
                                            ),
                                        }}
                                    />
                                )}
                                style={{ marginBottom: 8 }}
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

                            <TextField
                                style={{margin: "0px 0px 8px 0px"}}
                                fullWidth={true}
                                onChange={this._onTextChange}
                                label={t("words.amount")}
                                variant="filled"
                                value={displayAmount}
                                InputLabelProps={{ shrink: true }}
                                InputProps={{
                                    inputComponent: NumberFormatCustom,
                                    startAdornment: <PixaPower style={{margin: "0px 8px -12px 0px", fontSize: "1em"}}/>
                                }}
                                helperText={t("words.max_max_pxp", {
                                    max: max.toFixed(6)
                                })}
                            />

                            <TextField
                                style={{margin: "8px 0px 0px 0px"}}
                                fullWidth={true}
                                onChange={this._onMemoChange}
                                label={t("words.memo_optional")}
                                variant="filled"
                                value={_memo}
                                InputLabelProps={{ shrink: true }}
                                inputProps={{ maxLength: 256 }}
                                helperText={t(
                                    "components.pixa_wallet_send_power_dialog.audit_note_included_with_the_operation"
                                )}
                            />
                        </div>
                    </DialogContent>
                    <DialogActions style={{textAlign: "right"}}>
                        <Fade in={_confirm_success === 0} timeout={300}><Button variant="text" color="primary" onClick={this.props.onClose}>{t("words.cancel", {TUC: true})}</Button></Fade>
                        <Fade in={_confirm_success === 0} timeout={450}>
                            <Tooltip title={max <= 0 ? t("components.pixa_wallet_send_power_dialog.no_pxp_available_to_transfer") : ""} disableHoverListener={max > 0} disableFocusListener={max > 0} disableTouchListener={max > 0}>
                                <span><Button variant="contained" color="primary" autoFocus onClick={this._open_confirm_dialog} disabled={max <= 0 || !_username || displayAmount <= 0 || _username === ownerUsername}>{t("words.confirm", {TUC: true})}</Button></span>
                            </Tooltip>
                        </Fade>
                    </DialogActions>
                </Dialog>
                {/* Confirmation dialog (white, like Send / Delegate) */}
                <Dialog PaperProps={{classes: {root: classes.whiteDialog}}}
                        open={open && _confirm_open}
                        maxWidth={"xs"}
                        disablePortal={false}
                        onClose={() => this._close_confirm_dialog()}
                        keepMounted={false}>
                    <DialogContent>
                        <Fade in timeout={0}><Typography style={{marginTop: 8, marginBottom: 24}} component={"h2"} variant={"h6"}>{t("components.pixa_wallet_send_power_dialog.confirm_power_transfer")}</Typography></Fade>
                        <div style={{textAlign: "center"}}>
                            <Fade in timeout={150}><Typography className={"monospace"} variant="body2" color="textSecondary" component="span" style={{display: "block", fontSize: "36px", fontWeight: "bold", color: "#111"}}>{`${displayAmount.toFixed(2)} PXP`}</Typography></Fade>
                            <Fade in timeout={300}><Typography className={"monospace"} variant="body2" color="textSecondary" component="span" style={{fontSize: "14px", color: "#666"}}>{t("components.pixa_wallet_send_power_dialog.from", { ownerUsername })}</Typography></Fade>
                        </div><br/>
                        <div style={{textAlign: "center"}}>
                            <Grow in timeout={450}>
                                <Avatar
                                    src={resolvedImage}
                                    className={"pixelated"}
                                    style={{ width: 160, height: 160, margin: "12px auto 12px auto", borderRadius: "42px" }}
                                />
                            </Grow>
                            <Fade in timeout={600}>
                                <Typography variant="body2" color="textSecondary" component="span" style={{fontWeight: "bold", fontSize: "18px"}}>{`@${_username}`}</Typography>
                            </Fade>
                            {_selected_author && _selected_author.name && _selected_author.name !== _username && (
                                <Fade in timeout={700}>
                                    <Typography variant="body2" color="textSecondary" component="div" style={{fontSize: "13px", color: "#666", marginTop: 2}}>
                                        {_selected_author.name}
                                    </Typography>
                                </Fade>
                            )}
                            {requiresMultisig && (
                                <Fade in timeout={800}>
                                    <Typography variant="body2" component="div" style={{fontSize: "12px", color: "#a06600", marginTop: 8}}>{t(
                                            "components.pixa_wallet_send_power_dialog.multi_signature_required_co_signer_must_approve",
                                            {
                                                cosigner: { cosigner: cosigners.length },
                                            }
                                        )}</Typography>
                                </Fade>
                            )}
                        </div>
                        <Fade in={_confirm_success <= 2} timeout={1000}>
                            <SwipeSend unlocked={Boolean(!_confirm_locked)} completed={_confirm_success} onUnlock={this._unlock_confirm} onLock={this._lock_confirm}/>
                        </Fade>
                        <Collapse in={Boolean(!_confirm_locked)}>
                            <div style={{textAlign: _confirm_success < 2 ? "left": "center"}}>
                                {this.state._confirm_error ?
                                    <Typography variant="body2" component="p" style={{margin: "4px 0px 8px 0px", color: "#555"}}>{this.state._confirm_error}</Typography>
                                    : _confirm_success < 1 ?
                                        <Typography variant="body2" color="textSecondary" component="p" style={{margin: "4px 0px 8px 0px"}}>{requiresMultisig ? t(
                                            "components.pixa_wallet_send_power_dialog.this_transfer_is_irreversible_once_the_multi"
                                        ) : t(
                                            "components.pixa_wallet_send_power_dialog.this_transfer_is_irreversible_once_broadcast"
                                        )}</Typography>
                                        : _confirm_success < 2 ?
                                            <Typography variant="body2" color="textSecondary" component="p" style={{margin: "4px 0px 8px 0px"}}>{t("components.pixa_wallet_send_power_dialog.the_transfer_is_being_broadcast")}</Typography>
                                            :<Typography variant="body2" color="textSecondary" component="p" style={{margin: "4px 0px 8px 0px"}}>{requiresMultisig ? t("components.pixa_wallet_send_power_dialog.submitted_awaiting_co_signers") : t("components.pixa_wallet_send_power_dialog.transfer_completed")}</Typography>
                                }
                            </div>
                        </Collapse>
                    </DialogContent>
                    {_confirm_success !== 0 &&
                        <DialogActions style={{textAlign: "right"}}>
                            <Fade in timeout={300}>
                                <Button variant="contained" color="primary" onClick={() => this.props.onClose()} disabled={_confirm_success < 2}>{t("words.done", {TUC: true})}</Button>
                            </Fade>
                        </DialogActions>}
                    {_confirm_success === 0 &&
                        <DialogActions style={{textAlign: "right"}}>
                            <Fade in timeout={300}>
                                <Button variant="text" color="primary" autoFocus onClick={() => this._close_confirm_dialog()}>{t("words.cancel", {TUC: true})}</Button>
                            </Fade>
                            <Fade in timeout={450}>
                                <Button variant="contained" color="primary" onClick={() => this._confirm_transaction()} disabled={_confirm_locked}>{t("words.transfer", {TUC: true})}</Button>
                            </Fade>
                        </DialogActions>}
                </Dialog>
            </React.Fragment>
        );
    }
}

export default withLanguage(withStyles(styles)(PixaWalletSendPowerDialog));