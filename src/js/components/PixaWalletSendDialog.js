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
import Avatar from "@material-ui/core/Avatar";
import LinearProgress from "@material-ui/core/LinearProgress";
import SwipeSend from "./SwipeSend";
import SwapHorizRounded from "@material-ui/icons/SwapHorizRounded";
import PixaSupra from "../icons/PixaSupra";
import PixaLiquid from "../icons/PixaLiquid";
import Collapse from "@material-ui/core/Collapse";
import Fade from "@material-ui/core/Fade";
import Grow from "@material-ui/core/Grow";
import Tooltip from "@material-ui/core/Tooltip";
import CircularProgress from "@material-ui/core/CircularProgress";
import Checkbox from "@material-ui/core/Checkbox";
import FormControlLabel from "@material-ui/core/FormControlLabel";

import { t } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";
const styles = theme => ({
    slider: {
        margin: "16px 16px 32px 16px",
        width: "calc(100% - 32px)",
        "& .MuiSlider-valueLabel": {
            color: "#fff"
        },
        "& .MuiSlider-valueLabel > span > span": {
            color: "#000"
        },
        "& .MuiSlider-thumb": {
            boxShadow: "0px 0px 0px 14px rgb(255 255 255 / 16%)"
        },
        "& .MuiSlider-active.MuiSlider-thumb": {
            boxShadow: "0px 0px 0px 14px rgb(255 255 255 / 24%)"
        }
    },
    popper: {
        backgroundColor: "#242424ff !important"
    },
    darkGreyDialog: {
        backgroundColor: "#181818ff !important",
        "& .MuiButton-contained.Mui-disabled": {
            opacity: 0.35,
        }
    },
    whiteDialog: {
        backgroundColor: "#fff !important",
        color: "#000 !important",
        boxShadow: "0px 11px 15px -7px rgb(255 255 255 / 20%), 0px 24px 38px 3px rgb(255 255 255 / 14%), 0px 9px 46px 8px rgb(255 255 255 / 12%) !important",
        "& .MuiTypography-colorTextSecondary": {
            color: "#101010 !important"
        },
        "& .MuiButton-textPrimary": {
            color: "#222 !important",
            "&:hover": {
                color: "#000 !important",
            }
        },
        "& .MuiButton-containedPrimary": {
            color: "#ddd !important",
            backgroundColor: "#111 !important",
            "&.Mui-disabled": {
                color: "#fff !important",
                backgroundColor: "#666 !important",
                opacity: 0.35,
            },
            "&:hover": {
                color: "#fff !important",
                backgroundColor: "#000 !important",
            }
        }
    },
    progress: {
        margin: "16px 0px 16px 0px !important",
        "&.MuiLinearProgress-colorPrimary": {
            backgroundColor: "#222",
        },
        "& div.MuiLinearProgress-barColorPrimary": {
            backgroundColor: "#666"
        }
    }
});

function NumberFormatCustom(props) {
    const { inputRef, onChange, currency, ...other } = props;

    return (
        <NumericFormat
            {...other}
            ref={inputRef}
            onValueChange={(values) => {
                onChange({
                    target: {
                        name: props.name,
                        value: values.value,
                    },
                });
            }}
            thousandSeparator={" "}
            decimalSeparator={"."}
            allowedDecimalSeparators={[",", "."]}
            thousandsGroupStyle={'thousand'}
            decimalScale={"2"}
            fixedDecimalScale={false}
            allowNegative={false}
            allowLeadingZeros={true}
            suffix={" "+currency}
            prefix={""}
        />
    );
}

class PixaWalletSendDialog extends React.PureComponent {

    constructor(props) {
        super(props);
        this.state = {
            classes: props.classes,
            keepMounted: props.keepMounted || false,
            open: props.open,
            type: props.type,
            _username: "",
            _confirm_open: false,
            _confirm_locked: true,
            _confirm_success: 0,
            _confirm_error: "",
            _token_number: 666,
            _legal_name: "",
            _maxPXS: props.maxPXS || 0,
            _maxPXA: props.maxPXA || 0,
            _amount_percent: 0,
            _amount: "0.0",
            _authors: [],             // Search results: [{ username, image, name }]
            _selected_author: null,   // Resolved profile of currently typed/selected user
            _searching: false,        // Loading indicator while searching
            _memo: "",
            _lockedUsername: props.lockedUsername || false,
            _recurrent: false,        // recurring-transfer toggle
            _recurrence: "24",        // hours between payments (min 24)
            _executions: "12",        // number of payments (min 2)
        };

        // Debounce timer ref
        this._searchTimer = null;
        // Cache: username -> { username, image, name }
        this._profileCache = {};
    };

    shouldComponentUpdate(nextProps, nextState, nextContext) {
        return false;
    }

    componentDidMount() {
        // No static author load — search is live via API
    }

    componentWillUnmount() {
        if (this._searchTimer) clearTimeout(this._searchTimer);
    }

    componentWillReceiveProps(new_props) {

        if(!new_props.open && this.state.open){
            new_props = {
                ...new_props,
                _confirm_open: false,
                _confirm_locked: true,
                _confirm_success: 0,
                _confirm_error: "",
                _amount: "0.0",
                _amount_percent: 0,
                _username: "",
                _memo: "",
                _authors: [],
                _selected_author: null,
                _searching: false,
                _recurrent: false,
                _recurrence: "24",
                _executions: "12",
            };
        }

        // Reset confirm state on open (catches stale state from race condition)
        if(new_props.open && !this.state.open){
            new_props = {
                ...new_props,
                _confirm_open: false,
                _confirm_locked: true,
                _confirm_success: 0,
                _confirm_error: "",
                _recurrent: false,
                _recurrence: "24",
                _executions: "12",
            };
            // Prefill username when provided (e.g. viewing someone else's wallet)
            if (new_props.initialUsername) {
                new_props._username = new_props.initialUsername;
                // Resolve the profile after state update
                setTimeout(() => { this._resolveUsername(new_props.initialUsername); }, 0);
            }
        }

        // Update max balances from parent
        const updates = {...new_props};
        if (new_props.maxPXA !== undefined) updates._maxPXA = new_props.maxPXA;
        if (new_props.maxPXS !== undefined) updates._maxPXS = new_props.maxPXS;
        if (new_props.lockedUsername !== undefined) updates._lockedUsername = new_props.lockedUsername;

        this.setState(updates, () => {
            this.forceUpdate();
        });
    }

    // ── Account Search ──────────────────────────────────────────────

    /**
     * Normalize a sanitized account entity from the API into
     * the { username, image, name } shape the Autocomplete needs.
     */
    _normalizeAuthor = (acc) => {
        if (!acc) return null;
        const username = acc.username || acc.name || '';
        if (!username) return null;

        // Check cache first
        if (this._profileCache[username]) return this._profileCache[username];

        const entry = {
            username,
            image: acc.image || (acc._profile && acc._profile.profile_image) || '',
            name: acc.display_name || (acc._profile && acc._profile.display_name) || username,
        };
        this._profileCache[username] = entry;
        return entry;
    };

    /**
     * Called on every keystroke in the username field.
     * Debounces 280ms, then:
     *  1. lookupAccounts(input, 7) → array of username strings
     *  2. getAccounts(usernames) → full sanitized entities with profile pics
     *  3. Normalize and set _authors + resolve _selected_author if exact match
     */
    _onUsernameInputChange = (event, newInputValue) => {
        const input = (newInputValue || '').toLowerCase().replace(/^@/, '').trim();

        this.setState({_username: input}, () => {
            this.forceUpdate();
        });

        // Clear previous timer
        if (this._searchTimer) clearTimeout(this._searchTimer);

        // Empty input → clear results
        if (!input) {
            this.setState({_authors: [], _searching: false, _selected_author: null}, () => {
                this.forceUpdate();
            });
            return;
        }

        // If exact match already in cache, resolve immediately
        if (this._profileCache[input]) {
            this.setState({_selected_author: this._profileCache[input]});
        }

        // Debounce the API call
        this._searchTimer = setTimeout(() => {
            this._searchAccounts(input);
        }, 280);
    };

    /**
     * Perform the actual lookup + full account fetch.
     */
    _searchAccounts = async (input) => {
        const api = this.props.api;
        if (!api) return;

        this.setState({_searching: true}, () => { this.forceUpdate(); });

        try {
            // 1. lookupAccounts: returns up to 7 account name strings starting with `input`
            const names = await api.accounts.lookupAccounts(input, 7);
            if (!Array.isArray(names) || names.length === 0) {
                this.setState({_authors: [], _searching: false, _selected_author: null}, () => {
                    this.forceUpdate();
                });
                return;
            }

            // 2. getAccounts: returns full sanitized entities with _profile
            const accounts = await api.accounts.getAccounts(names);
            const authors = (accounts || [])
                .map(a => this._normalizeAuthor(a))
                .filter(Boolean);

            // 3. Resolve selected author (exact match)
            const currentInput = this.state._username;
            const exactMatch = authors.find(a => a.username === currentInput) || null;

            this.setState({
                _authors: authors,
                _searching: false,
                _selected_author: exactMatch || this.state._selected_author,
            }, () => {
                this.forceUpdate();
            });
        } catch (e) {
            console.warn('[PixaWalletSendDialog] _searchAccounts error:', e);
            this.setState({_searching: false}, () => { this.forceUpdate(); });
        }
    };

    /**
     * When the user picks an option from the dropdown (click or enter).
     */
    _onAutocompleteChange = (event, value) => {
        if (value && typeof value === 'object' && value.username) {
            this.setState({
                _username: value.username,
                _selected_author: value,
            }, () => { this.forceUpdate(); });
        } else if (typeof value === 'string') {
            // freeSolo: user typed a name and pressed enter
            const resolved = this._profileCache[value] || null;
            this.setState({
                _username: value,
                _selected_author: resolved,
            }, () => {
                this.forceUpdate();
                // If not cached yet, resolve it
                if (!resolved && value.length > 0) {
                    this._resolveUsername(value);
                }
            });
        }
    };

    /**
     * Resolve a single username to get its profile (for the confirm dialog avatar).
     */
    _resolveUsername = async (username) => {
        const api = this.props.api;
        if (!api || !username) return;

        try {
            const accounts = await api.accounts.getAccounts([username]);
            if (accounts && accounts[0]) {
                const author = this._normalizeAuthor(accounts[0]);
                if (author && author.username === this.state._username) {
                    this.setState({_selected_author: author}, () => { this.forceUpdate(); });
                }
            }
        } catch (e) { /* ignore */ }
    };

    _handle_amount_text_change = (event, value, max) => {

        // Chain assets carry 3 decimals; round at the single place the
        // amount is set so float artifacts and >3-decimal input can never
        // reach the confirm screen or the broadcast layer.
        const amount = (Math.round(parseFloat(event.target.value || value || 0) * 1000) / 1000).toString();
        this.setState({_amount: amount+"", _amount_percent: parseFloat(amount)/max*100}, () => {

            this.forceUpdate();
        });
    };

    toggleCurrency = (event) => {

        if(this.state.type.length > 0) {

            if(typeof this.props.onToggleCurrency === "function"){
                this.props.onToggleCurrency(this.state.type === "PIXA" ? "SUPRA": "PIXA");
            }
        }
    };

    _open_confirm_dialog = () => {
        const { _username, _selected_author } = this.state;

        // Resolve the username before showing confirm if not already resolved
        if (_username && (!_selected_author || _selected_author.username !== _username)) {
            this._resolveUsername(_username);
        }

        this.setState({_confirm_open: true, _confirm_success: 0, _confirm_error: "", _confirm_locked: true}, () => {
            this.forceUpdate();
        });
    }
    _close_confirm_dialog = () => {
        this.setState({_confirm_open: false, _confirm_success: 0, _confirm_error: ""}, () => {
            this.forceUpdate();
        });
    }

    _confirm_transaction = async () => {
        if (this.state._confirm_success !== 0) return;

        const { _username, _amount, _memo, type, _recurrent, _recurrence, _executions } = this.state;
        const currency = (type || '').toUpperCase() === 'PIXA' ? 'PXA' : 'PXS';

        // Recurring transfers require recurrence >= 24h and executions >= 2 on-chain.
        const recurrentOpts = _recurrent
            ? {
                recurrence: Math.max(24, Math.floor(Number(_recurrence) || 0)),
                executions: Math.max(2, Math.floor(Number(_executions) || 0)),
            }
            : null;

        this.setState({_confirm_success: 1, _confirm_error: ""}, () => {
            this.forceUpdate();
        });

        try {
            if (typeof this.props.onSend === 'function') {
                await this.props.onSend(_username, parseFloat(_amount), currency, _memo, recurrentOpts);
            }
            this.setState({_confirm_success: 2}, () => {
                this.forceUpdate();
            });
        } catch (err) {
            this.setState({_confirm_success: 0, _confirm_error: err.message || t("components.pixa_wallet_send_dialog.transaction_failed")}, () => {
                this.forceUpdate();
            });
        }
    };

    _unlock_confirm = () => {
        this.setState({_confirm_locked: false}, () => {
            this.forceUpdate();
        });
    }

    _lock_confirm = () => {
        this.setState({_confirm_locked: true}, () => {
            this.forceUpdate();
        });
    }

    render() {

        const {
            classes,
            _username,
            _amount,
            _amount_percent,
            _confirm_open,
            _maxPXS,
            _maxPXA,
            _authors,
            _selected_author,
            _searching,
            _confirm_locked,
            _confirm_success,
            open,
            type,
            _memo,
            _lockedUsername,
            _recurrent,
            _recurrence,
            _executions
        } = this.state;

        // Resolved avatar for the current input
        const resolvedImage = (_selected_author && _selected_author.username === _username)
            ? _selected_author.image
            : '';

        var title, currency, description, max;
        switch ((type || "").toUpperCase()) {
            case "PIXA":
                title = t("components.pixa_wallet_send_dialog.transfer");
                currency = "PXA";
                description = t("components.pixa_wallet_send_dialog.pixa_pxa_is_the_main_cryptocurrency");
                max = _maxPXA;
                break;
            case "SUPRA":
                title = t("components.pixa_wallet_send_dialog.transfer");
                currency = "PXS";
                description = t("components.pixa_wallet_send_dialog.pixa_supra_pxs_is_the_additional")
                max = _maxPXS;
        }

        return (
            <React.Fragment>
                <Dialog open={open}
                        fullWidth={true}
                        disablePortal={false}
                        onClose={this.props.onClose}
                        keepMounted={false}
                        PaperProps={{classes: {root: classes.darkGreyDialog}}}>
                    <DialogContent>
                        <Typography component={"h2"} variant={"h6"}>{title}</Typography>
                        <div>
                            <LinearProgress className={classes.progress} style={{margin: "0px 0px 16px 0px"}} variant={"determinate"} value={_amount_percent}/>
                            <Autocomplete
                                classes={{paper: classes.popper}}
                                options={_authors}
                                getOptionLabel={(option) => typeof option === 'string' ? option : option.username || ''}
                                getOptionDisabled={(option) => option && option.username === ((this.props.account || {}).username || '')}
                                filterOptions={(x) => x}
                                inputValue={_username}
                                onChange={this._onAutocompleteChange}
                                onInputChange={_lockedUsername ? undefined : this._onUsernameInputChange}
                                loading={_searching}
                                loadingText={t("words.searching")}
                                noOptionsText={_username.length > 0 ? t("words.no_accounts_found") : t("words.type_a_username")}
                                disabled={_lockedUsername}
                                renderOption={(option) => {
                                    const isOwn = option.username === ((this.props.account || {}).username || '');
                                    return (
                                        <div style={{ display: "flex", alignItems: "center", opacity: isOwn ? 0.4 : 1 }}>
                                            <Avatar
                                                src={option.image}
                                                alt={option.username}
                                                style={{ marginRight: 8, width: 32, height: 32, borderRadius: "8px" }}
                                                className={"pixelated"}
                                            />
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
                                        label={t("words.username")}
                                        variant="filled"
                                        fullWidth
                                        InputLabelProps={{ shrink: true }}
                                        InputProps={{
                                            ...params.InputProps,
                                            startAdornment: (
                                                <React.Fragment>
                                                    <Avatar
                                                        src={resolvedImage}
                                                        style={{ width: 24, height: 24, marginRight: 6, borderRadius: "6px" }}
                                                        className={"pixelated"}
                                                    />
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
                            <TextField
                                style={{margin: "16px 0px 8px 0px"}}
                                fullWidth={true}
                                onChange={(e, v) => this._handle_amount_text_change(e, v, max)}
                                label={t("words.amount")}
                                variant="filled"
                                value={_amount}
                                InputProps={{
                                    inputComponent: NumberFormatCustom,
                                    inputProps: {currency: currency},
                                    endAdornment: (
                                        <Button onClick={this.toggleCurrency}>
                                            <SwapHorizRounded style={{marginRight: "4px"}}/> {type === "PIXA" ? "PXS": "PXA"}
                                        </Button>
                                    ),
                                    startAdornment: (
                                        currency !== "PXA" ? <PixaSupra style={{margin: "0px 8px -12px 0px", fontSize: "1em"}}/>: <PixaLiquid style={{margin: "0px 8px -12px 0px", fontSize: "1em"}}/>
                                    )
                                }}
                            />
                            {/* NEW: Memo input */}
                            <TextField
                                style={{margin: "8px 0px 8px 0px"}}
                                fullWidth={true}
                                label={t("words.memo_optional")}
                                variant="filled"
                                value={_memo}
                                onChange={(e) => this.setState({_memo: e.target.value}, () => this.forceUpdate())}
                                inputProps={{ maxLength: 140 }}
                                placeholder={t("components.pixa_wallet_send_dialog.what_is_this_transfer_for")}
                                multiline
                                rowsMax={4}
                            />
                            {/* NEW: Recurring transfer toggle + schedule */}
                            <FormControlLabel
                                style={{margin: "4px 0px 0px 0px"}}
                                control={
                                    <Checkbox
                                        color="primary"
                                        checked={_recurrent}
                                        onChange={(e) => this.setState({_recurrent: e.target.checked}, () => this.forceUpdate())}
                                    />
                                }
                                label={t("components.pixa_wallet_send_dialog.make_this_a_recurring_transfer")}
                            />
                            <Collapse in={_recurrent}>
                                <div style={{display: "flex", gap: "16px", margin: "8px 0px 0px 0px"}}>
                                    <TextField
                                        style={{flex: 1}}
                                        fullWidth={true}
                                        type="number"
                                        label={t("components.pixa_wallet_send_dialog.every_hours")}
                                        variant="filled"
                                        value={_recurrence}
                                        onChange={(e) => this.setState({_recurrence: e.target.value}, () => this.forceUpdate())}
                                        InputLabelProps={{ shrink: true }}
                                        inputProps={{ min: 24, step: 1 }}
                                    />
                                    <TextField
                                        style={{flex: 1}}
                                        fullWidth={true}
                                        type="number"
                                        label={t("components.pixa_wallet_send_dialog.number_of_payments")}
                                        variant="filled"
                                        value={_executions}
                                        onChange={(e) => this.setState({_executions: e.target.value}, () => this.forceUpdate())}
                                        InputLabelProps={{ shrink: true }}
                                        inputProps={{ min: 2, step: 1 }}
                                    />
                                </div>
                                <Typography variant="body2" color="textSecondary" component="p" style={{margin: "8px 21px 0px 21px"}}>{t("components.pixa_wallet_send_dialog.the_first_payment_is_sent_now_then", {
                                        Number: Number(_recurrence) || 24,
                                        Number_2: Number(_executions) || 0
                                    })}</Typography>
                            </Collapse>
                        </div>
                        <Typography variant="body2" color="textSecondary" component="p" style={{margin: "16px 0px 24px 0px"}}>{t("components.pixa_wallet_send_dialog.this_is_equivalent_to", {
                            _amount: (currency === "PXA" ? _amount * 0.1: _amount * 5.69).toFixed(2)
                        })}</Typography>
                    </DialogContent>
                    <DialogActions style={{textAlign: "right"}} className={classes.darkGreyActions}>
                        <Fade in={_confirm_success === 0} timeout={300}><Button variant="text" color="primary" onClick={this.props.onClose}>{t("words.cancel", {TUC: true})}</Button></Fade>
                        <Fade in={_confirm_success === 0} timeout={450}>
                            <Tooltip title={max <= 0 ? t("components.pixa_wallet_send_dialog.you_dont_have_any_to_transfer", {
                                currency: currency
                            }) : ""} disableHoverListener={max > 0} disableFocusListener={max > 0} disableTouchListener={max > 0}>
                                <span><Button variant="contained" color="primary" autoFocus onClick={this._open_confirm_dialog} disabled={max <= 0 || !_username || parseFloat(_amount) <= 0}>{t("words.confirm", {TUC: true})}</Button></span>
                            </Tooltip>
                        </Fade>
                    </DialogActions>
                </Dialog>
                <Dialog PaperProps={{classes: {root: classes.whiteDialog}}}
                        open={open && _confirm_open}
                        maxWidth={"xs"}
                        disablePortal={false}
                        onClose={() => {this._close_confirm_dialog()}}
                        keepMounted={false}>
                    <DialogContent>
                        <Fade in timeout={0}><Typography style={{marginTop: 8, marginBottom: 24}} component={"h2"} variant={"h6"}>{t("components.pixa_wallet_send_dialog.confirm_your_transaction")}</Typography></Fade>
                        <div style={{textAlign: "center"}}>
                            <Fade in timeout={150}><Typography className={"monospace"} variant="body2" color="textSecondary" component="span" style={{display: "block", fontSize: "36px", fontWeight: "bold", color: "#111"}}>{`${parseFloat(_amount).toFixed(3)} ${currency} `}</Typography></Fade>
                            <Fade in timeout={300}><Typography className={"monospace"} variant="body2" color="textSecondary" component="span" style={{fontSize: "21px", color: "#272727"}}>{`${(currency === "PXA" ? _amount * 0.1: _amount * 5.69).toFixed(2)}`}</Typography></Fade>
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
                            {/* NEW: Memo display under amount */}
                            {_memo.length > 0  && <Fade in timeout={800}>
                                <Typography className={"monospace"} variant="body2" color="textSecondary" component="div" style={{fontSize: "14px", color: "#444", marginTop: 8}}>
                                    {t("components.pixa_wallet_send_dialog.memo", { memo: _memo })}
                                </Typography>
                            </Fade>}
                            {/* NEW: Recurring schedule summary */}
                            {_recurrent && <Fade in timeout={850}>
                                <Typography variant="body2" color="textSecondary" component="div" style={{fontSize: "14px", color: "#444", marginTop: 8}}>
                                    {t("components.pixa_wallet_send_dialog.repeats_every_h_payments", {
                                        max: Math.max(24, Math.floor(Number(_recurrence) || 0)),
                                        max_2: Math.max(2, Math.floor(Number(_executions) || 0))
                                    })}
                                </Typography>
                            </Fade>}
                        </div>
                        <Fade in={_confirm_success <= 2} timeout={1000}>
                            <SwipeSend unlocked={Boolean(!_confirm_locked)} completed={_confirm_success} onUnlock={this._unlock_confirm} onLock={this._lock_confirm}/>
                        </Fade>
                        <Collapse in={Boolean(!_confirm_locked)}>
                            <div style={{textAlign: _confirm_success < 2 ? "left": "center"}}>
                                {this.state._confirm_error ?
                                    <Typography variant="body2" component="p" style={{margin: "4px 0px 8px 0px", color: "#555"}}>{this.state._confirm_error}</Typography>
                                    : _confirm_success < 1 ?
                                        <Typography variant="body2" color="textSecondary" component="p" style={{margin: "4px 0px 8px 0px"}}>{t("components.pixa_wallet_send_dialog.transactions_can_not_be_reversed")}</Typography>
                                        : _confirm_success < 2 ?
                                            <Typography variant="body2" color="textSecondary" component="p" style={{margin: "4px 0px 8px 0px"}}>{t("components.pixa_wallet_send_dialog.the_transactions_is_being_processed")}</Typography>
                                            :<Typography variant="body2" color="textSecondary" component="p" style={{margin: "4px 0px 8px 0px"}}>{t("components.pixa_wallet_send_dialog.transaction_completed")}</Typography>
                                }
                            </div>
                        </Collapse>
                    </DialogContent>
                    {_confirm_success !== 0 &&
                        <DialogActions style={{textAlign: "right"}}>
                            <Fade in timeout={300}>
                                <Button variant="contained" color="primary" onClick={() => {this.props.onClose()}} disabled={_confirm_success < 2}>{t("words.send", {TUC: true})}</Button>
                            </Fade>
                        </DialogActions>}
                    {_confirm_success === 0 &&
                        <DialogActions style={{textAlign: "right"}}>
                            <Fade in timeout={300}>
                                <Button variant="text" color="primary" autoFocus onClick={() => {this._close_confirm_dialog()}}>{t("words.cancel", {TUC: true})}</Button>
                            </Fade>
                            <Fade in timeout={450}>
                                <Button variant="contained" color="primary" onClick={() => {this._confirm_transaction()}} disabled={_confirm_locked}>{t("words.send", {TUC: true})}</Button>
                            </Fade>
                        </DialogActions>}

                </Dialog>
            </React.Fragment>
        );
    }
}

export default withLanguage(withStyles(styles)(PixaWalletSendDialog));