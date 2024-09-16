import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import Typography from "@material-ui/core/Typography";
import TextField from "@material-ui/core/TextField";
import Autocomplete from "@material-ui/lab/Autocomplete";
import Chip from "@material-ui/core/Chip";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import Tooltip from "@material-ui/core/Tooltip";
import IconButton from "@material-ui/core/IconButton";
import InputAdornment from "@material-ui/core/InputAdornment";
import Collapse from "@material-ui/core/Collapse";
import LinearProgress from "@material-ui/core/LinearProgress";
import CircularProgress from "@material-ui/core/CircularProgress";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import Visibility from "@material-ui/icons/Visibility";
import VisibilityOff from "@material-ui/icons/VisibilityOff";
import CheckCircleRounded from "@material-ui/icons/CheckCircleRounded";
import ErrorRounded from "@material-ui/icons/ErrorRounded";
import DownloadRounded from "@material-ui/icons/SaveAltRounded";
import ShieldKey from "../icons/shieldKey";
import * as actions from "../actions/utils";
import { generateMnemonic, generateMasterKey, generatePDF } from "../utils/BackUpWallet2";

import { T } from "../utils/T";
import { t, getLanguage } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";
/*
 * CreateBulkAccountDialog
 * ───────────────────────
 * Admin tool exposed only on the @initminer wallet. Creates one or many
 * accounts in a single session by broadcasting `account_create` operations
 * signed *locally* with the creator's active key (entered here, never sent to
 * a server). Each new account gets a fresh random master password from which
 * all four role keys are derived; those credentials are collected and offered
 * as a download at the end — they are the ONLY copy, so the operator must save
 * them.
 *
 * This is deliberately distinct from the public CreateAccountDialog (which
 * defers to a faucet Worker). Here the signer is the treasury/genesis account
 * and everything happens client-side.
 */

const styles = (theme) => ({
    darkGreyDialog: {
        backgroundColor: "#181818ff !important",
        "& .MuiButton-contained.Mui-disabled": { opacity: 0.35 },
    },
    popper: { backgroundColor: "#242424ff !important" },
    banner: {
        backgroundColor: "#101010",
        borderRadius: "6px",
        padding: "8px 12px",
        margin: "16px 0px 12px 0px",
        color: "#ccc",
        fontSize: "12px",
        lineHeight: "1.4",
    },
    warnBanner: {
        backgroundColor: "#141414",
        border: "1px solid #333",
        borderRadius: "6px",
        padding: "8px 12px",
        margin: "12px 0px 4px 0px",
        color: "#bbb",
        fontSize: "12px",
        lineHeight: "1.4",
    },
    progress: {
        margin: "16px 0px 8px 0px !important",
        "&.MuiLinearProgress-colorPrimary": { backgroundColor: "#222" },
        "& div.MuiLinearProgress-barColorPrimary": { backgroundColor: "#666" },
    },
    resultList: {
        maxHeight: 220,
        overflowY: "auto",
        margin: "8px 0px 0px 0px",
        backgroundColor: "#141414",
        borderRadius: "8px",
    },
    chipOk: { backgroundColor: "#2a2a2a", color: "#eee", margin: 2 },
    chipBad: { backgroundColor: "#1c1c1c", color: "#888", margin: 2 },
    chipChecking: { backgroundColor: "#232323", color: "#bbb", margin: 2 },
    mono: { fontFamily: "monospace" },
});

// HIVE/STEEM account-name rules (client-side pre-check; chain is final arbiter).
function isValidAccountName(name) {
    if (typeof name !== "string") return false;
    const n = name.toLowerCase();
    if (n.length < 3 || n.length > 16) return false;
    const labels = n.split(".");
    for (const l of labels) {
        if (l.length < 1) return false;
        if (!/^[a-z]/.test(l)) return false;
        if (!/[a-z0-9]$/.test(l)) return false;
        if (!/^[a-z0-9-]+$/.test(l)) return false;
        if (l.indexOf("--") !== -1) return false;
    }
    return true;
}

// Hoisted static styles — were inline literals re-created per render (this
// dialog re-renders on every keystroke of the key / username fields).
const SHRINK_LABEL_PROPS = { shrink: true };
const KEY_FIELD_STYLE = { margin: "8px 0px 8px 0px" };
const KEY_ADORNMENT_STYLE = { margin: "0px 8px -6px 0px" };
const USERNAMES_STYLE = { marginTop: 8 };
const COUNTS_ROW_STYLE = { display: "flex", justifyContent: "space-between", marginTop: 6 };
const COUNTS_TEXT_STYLE = { color: "#777", fontSize: 12 };
const FEE_FIELD_STYLE = { margin: "12px 0px 0px 0px" };
const RESULT_ICON_STYLE = { minWidth: 36 };
const RESULT_OK_STYLE = { color: "#e0e0e0" };
const RESULT_BAD_STYLE = { color: "#777" };
const RESULT_SECONDARY_OK = { style: { color: "#8a8a8a" } };
const RESULT_SECONDARY_BAD = { style: { color: "#aaa" } };
const RESULT_DL_STYLE = { color: "#bbb" };
const ACTIONS_STYLE = { textAlign: "right" };
const DL_ALL_ICON_STYLE = { marginLeft: 8 };
const CREATING_SPINNER_STYLE = { marginRight: 8, color: "#bbb" };
const AT_SIGN_STYLE = { color: "#666", marginRight: 2 };
const TAG_AT_STYLE = { color: "#888", marginRight: 2 };
const OPTION_HINT_STYLE = { color: "#888", marginLeft: 8, fontSize: 12 };

// Stable Autocomplete helpers — were arrow literals re-created per render.
const getUsernameOptionLabel = (o) => (typeof o === "string" ? o : o.label || "");
const getUsernameOptionDisabled = (o) => typeof o === "object" && !o.valid;
const renderUsernameOption = (o) => (
    <span style={{ opacity: o.valid ? 1 : 0.7 }}>
        <span style={AT_SIGN_STYLE}>@</span>{o.label}
        {o.valid
            ? <span style={OPTION_HINT_STYLE}>{t("components.create_bulk_account_dialog.add_username")}</span>
            : <span style={OPTION_HINT_STYLE}>3–16 chars, start with a letter</span>}
    </span>
);
const renderUsernamesInput = (params) => (
    <TextField
        {...params}
        variant="filled"
        label={t("components.create_bulk_account_dialog.new_usernames")}
        placeholder={t("components.create_bulk_account_dialog.type_a_username_and_press_enter")}
        InputLabelProps={SHRINK_LABEL_PROPS}
    />
);

class CreateBulkAccountDialog extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            _creatorKey: "",
            _showKey: false,
            _usernames: [],
            _input: "",
            _fee: "",
            _feeLoaded: false,
            _availability: {}, // name -> 'checking' | 'available' | 'taken'
            _running: false,
            _done: false,
            _progress: 0,
            _results: [], // { name, status:'ok'|'error', id?, block?, message?, credentials? }
            _wasOpen: false,
        };
        this._availTimer = null;
    }

    static getDerivedStateFromProps(nextProps, prevState) {
        const isOpening = !!nextProps.open && !prevState._wasOpen;
        if (isOpening) {
            return {
                _wasOpen: true,
                _creatorKey: "",
                _showKey: false,
                _usernames: [],
                _input: "",
                _availability: {},
                _running: false,
                _done: false,
                _progress: 0,
                _results: [],
            };
        }
        if (!nextProps.open && prevState._wasOpen) {
            return { _wasOpen: false, _creatorKey: "" };
        }
        return null;
    }

    componentDidUpdate(prevProps) {
        if (this.props.open && !prevProps.open && !this.state._feeLoaded) {
            this._loadFee();
        }
    }

    componentWillUnmount() {
        if (this._availTimer) clearTimeout(this._availTimer);
    }

    // Coerce whatever getChainProperties returns for the fee (string, dhive
    // Asset, or {amount, symbol}) into a display asset string.
    _feeToString = (v) => {
        if (v == null) return "";
        if (typeof v === "string") return v.trim();
        if (typeof v === "object") {
            try {
                const s = v.toString();
                if (s && s !== "[object Object]" && s.indexOf(" ") !== -1) return s.trim();
            } catch (_) { /* ignore */ }
            if (v.amount != null && v.symbol) return `${v.amount} ${v.symbol}`;
        }
        return "";
    };

    _liquidSymbol = () => this.props.liquidSymbol || "PIXA";

    _loadFee = async () => {
        const api = this.props.api;
        if (!api) return;
        let fee = "";
        try {
            const props = await api.globals.getChainProperties();
            fee = this._feeToString(props && props.account_creation_fee);
        } catch (e) { /* fall through to default */ }
        if (!fee) fee = `0.000 ${this._liquidSymbol()}`;
        this.setState({ _fee: fee, _feeLoaded: true }, () => this.forceUpdate());
    };

    _checkAvailability = async (names) => {
        const api = this.props.api;
        if (!api || names.length === 0) return;
        const marks = { ...this.state._availability };
        names.forEach((n) => { if (!marks[n]) marks[n] = "checking"; });
        this.setState({ _availability: marks }, () => this.forceUpdate());
        try {
            const accounts = await api.accounts.getAccounts(names);
            const taken = new Set((accounts || []).map((a) => (a && (a.name || a.username) || "").toLowerCase()));
            const next = { ...this.state._availability };
            names.forEach((n) => { next[n] = taken.has(n) ? "taken" : "available"; });
            this.setState({ _availability: next }, () => this.forceUpdate());
        } catch (e) {
            const next = { ...this.state._availability };
            names.forEach((n) => { delete next[n]; });
            this.setState({ _availability: next }, () => this.forceUpdate());
        }
    };

    _onUsernamesChange = (event, newValue, reason) => {
        if (reason === "clear") {
            this.setState({ _usernames: [], _availability: {} }, () => this.forceUpdate());
            return;
        }
        // Normalise every entry: lowercase, strip @, dedupe, keep only new names.
        const cleaned = [];
        const seen = new Set();
        for (const raw of newValue) {
            const v = String(typeof raw === "string" ? raw : (raw && raw.label) || "")
                .toLowerCase().replace(/^@+/, "").trim();
            if (v && !seen.has(v)) { seen.add(v); cleaned.push(v); }
        }
        this.setState({ _usernames: cleaned, _input: "" }, () => this.forceUpdate());

        // Debounced availability check for the valid, not-yet-known names.
        const toCheck = cleaned.filter((n) => isValidAccountName(n) && !this.state._availability[n]);
        if (this._availTimer) clearTimeout(this._availTimer);
        if (toCheck.length) this._availTimer = setTimeout(() => this._checkAvailability(toCheck), 400);
    };

    _onInputChange = (event, value, reason) => {
        if (reason === "input") this.setState({ _input: value }, () => this.forceUpdate());
    };

    _onCreatorKeyChange = (e) => {
        this.setState({ _creatorKey: e.target.value }, () => this.forceUpdate());
    };

    _toggleShowKey = () => {
        this.setState({ _showKey: !this.state._showKey }, () => this.forceUpdate());
    };

    _onFeeChange = (e) => {
        this.setState({ _fee: e.target.value }, () => this.forceUpdate());
    };

    // Reads live state at call time — stable identity across renders.
    _filterUsernameOptions = (options, params) => {
        const input = (params.inputValue || "").toLowerCase().replace(/^@+/, "").trim();
        if (!input || this.state._usernames.includes(input)) return [];
        return [{ label: input, valid: isValidAccountName(input) }];
    };

    _renderUsernameTags = (value, getTagProps) => {
        const { _availability } = this.state;
        return value.map((name, index) => (
            <Chip
                key={name}
                size="small"
                className={this._chipClass(name)}
                label={<span><span style={TAG_AT_STYLE}>@</span>{name}{_availability[name] === "taken" ? " · taken" : ""}</span>}
                {...getTagProps({ index })}
            />
        ));
    };

    _chipClass = (name) => {
        const { classes } = this.props;
        if (!isValidAccountName(name)) return classes.chipBad;
        const s = this.state._availability[name];
        if (s === "taken") return classes.chipBad;
        if (s === "checking") return classes.chipChecking;
        return classes.chipOk;
    };

    _creatable = () => {
        const { _usernames, _availability } = this.state;
        return _usernames.filter((n) => isValidAccountName(n) && _availability[n] !== "taken");
    };

    _startCreate = async () => {
        const api = this.props.api;
        const creator = (this.props.creator || "").toLowerCase();
        const key = this.state._creatorKey.trim();
        const targets = this._creatable();

        if (!api || !creator) return;
        if (!key || !api.auth.isWif(key)) {
            if (actions?.trigger_snackbar) actions.trigger_snackbar(t(
                "components.create_bulk_account_dialog.enter_a_valid_active_private_key_for",
                {
                    creator: creator
                }
            ), "error");
            return;
        }
        if (targets.length === 0) {
            if (actions?.trigger_snackbar) actions.trigger_snackbar(t(
                "components.create_bulk_account_dialog.add_at_least_one_valid_available_username"
            ), "error");
            return;
        }

        // Pre-flight: the entered key must belong to the creator's active authority.
        try {
            const pub = api.auth.wifToPublic(key);
            const accs = await api.accounts.getAccounts([creator]);
            const active = accs && accs[0] && accs[0].active;
            const keyAuths = (active && active.key_auths) || [];
            const ok = keyAuths.some((ka) => Array.isArray(ka) && ka[0] === pub);
            if (!ok) {
                if (actions?.trigger_snackbar) actions.trigger_snackbar(t("components.create_bulk_account_dialog.that_key_is_not_on_s_active", {
                    creator: creator
                }), "error");
                return;
            }
        } catch (e) {
            // Non-fatal: if the lookup fails we still attempt (chain will reject a bad key).
            console.warn("[CreateBulkAccountDialog] authority pre-check failed:", e);
        }

        // Resolve the creation fee with the correct chain symbol. Prefer the
        // value already loaded; if empty (e.g. created before load finished),
        // fetch it now; finally fall back to a zero fee in the liquid symbol.
        let feeToUse = this._feeToString(this.state._fee);
        if (!feeToUse) {
            try {
                const props = await api.globals.getChainProperties();
                feeToUse = this._feeToString(props && props.account_creation_fee);
            } catch (_) { /* ignore */ }
        }
        if (!feeToUse) feeToUse = `0.000 ${this._liquidSymbol()}`;

        this.setState({ _running: true, _done: false, _progress: 0, _results: [] }, () => this.forceUpdate());

        const results = [];
        for (let i = 0; i < targets.length; i++) {
            const name = targets[i];
            try {
                // 24-word mnemonic → master key → backup PDF, exactly as in
                // CreateAccountDialog. generatePDF returns [blob, keys] where
                // keys.pub = { owner, active, posting, memo } public keys; the
                // PDF itself carries the seed + all keys for recovery.
                // Wordlist follows the active UI language (English fallback).
                const seed = await generateMnemonic(24, getLanguage());
                const masterKey = await generateMasterKey(seed, "");
                const [pdfBlob, keys] = await generatePDF(name, seed, "", masterKey);
                const publicKeys = keys && keys.pub ? keys.pub : null;
                if (!publicKeys || !publicKeys.owner || !publicKeys.active || !publicKeys.posting || !publicKeys.memo) {
                    throw new Error("key derivation failed");
                }
                const op = api.broadcast.buildAccountCreateOp({
                    fee: feeToUse,
                    creator,
                    newAccountName: name,
                    publicKeys,
                });
                const tx = await api.broadcast.prepareTransaction([op], { expirationSeconds: 3600 });
                const signed = api.broadcast.signTransaction(tx, key);
                const res = await api.broadcast.broadcastTransactionSynchronous(signed);
                const result = {
                    name,
                    status: "ok",
                    id: res && res.id,
                    block: res && res.block_num,
                    pdfBlob,
                    masterKey,
                };
                results.push(result);
                // Save the backup PDF right away. The awaits above space the
                // downloads out, which keeps browsers from blocking them.
                this._savePdf(result);
            } catch (err) {
                results.push({ name, status: "error", message: (err && err.message) || "Failed" });
            }
            this.setState({
                _results: results.slice(),
                _progress: Math.round(((i + 1) / targets.length) * 100),
            }, () => this.forceUpdate());
        }

        const okCount = results.filter((r) => r.status === "ok").length;
        this.setState({ _running: false, _done: true }, () => this.forceUpdate());
        if (actions?.trigger_snackbar) {
            actions.trigger_snackbar(t(
                "components.create_bulk_account_dialog.created_account_save_the_pdf_backups",
                {
                    okCount: okCount,
                    target_count: targets.length,
                    account: { account: targets.length }
                }
            ), okCount ? "success" : "error");
        }
    };

    // Save one account's backup PDF (mirrors CreateAccountDialog._trigger_pdf_download).
    _savePdf = (result) => {
        if (!result || !result.pdfBlob) return;
        try {
            const url = URL.createObjectURL(result.pdfBlob);
            const a = document.createElement("a");
            a.download = `KeysOf-${result.name}-Pixagram.pdf`;
            a.href = url;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 2000);
        } catch (e) {
            console.warn("[CreateBulkAccountDialog] PDF save failed:", e);
        }
    };

    // Re-save every backup PDF, staggered so the browser doesn't block them.
    _saveAllPdfs = () => {
        const ok = this.state._results.filter((r) => r.status === "ok" && r.pdfBlob);
        ok.forEach((r, i) => setTimeout(() => this._savePdf(r), i * 350));
    };

    render() {
        const { classes, open, onClose, creator } = this.props;
        const {
            _creatorKey, _showKey, _usernames, _input, _fee,
            _availability, _running, _done, _progress, _results,
        } = this.state;

        const creatable = this._creatable();
        const invalidCount = _usernames.filter((n) => !isValidAccountName(n)).length;
        const takenCount = _usernames.filter((n) => _availability[n] === "taken").length;
        const okResults = _results.filter((r) => r.status === "ok").length;

        return (
            <Dialog
                open={!!open}
                fullWidth
                maxWidth="sm"
                disablePortal={false}
                onClose={onClose}
                keepMounted={false}
                PaperProps={{ classes: { root: classes.darkGreyDialog } }}
            >
                <DialogContent>
                    <Typography component="h2" variant="h6">{t("words.create_accounts")}</Typography>
                    <div className={classes.banner}><T
                            k="components.create_bulk_account_dialog.strong_genesis_operation_strong_broadcast_0_acco"
                            vars={{
                                creator: (creator || "").toLowerCase()
                            }}
                            slots={[
                                <span className={classes.mono} key="0" />,
                                <span className={classes.mono} key="1" />
                            ]} /></div>

                    <TextField
                        style={KEY_FIELD_STYLE}
                        fullWidth
                        type={_showKey ? "text" : "password"}
                        label={t("components.create_bulk_account_dialog.active_private_key", {
                            creator: (creator || "").toLowerCase()
                        })}
                        variant="filled"
                        value={_creatorKey}
                        onChange={this._onCreatorKeyChange}
                        disabled={_running}
                        autoComplete="off"
                        InputLabelProps={SHRINK_LABEL_PROPS}
                        InputProps={{
                            startAdornment: <ShieldKey style={KEY_ADORNMENT_STYLE} />,
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton aria-label={t("words.toggle_key_visibility")} onClick={this._toggleShowKey} edge="end">
                                        {_showKey ? <VisibilityOff /> : <Visibility />}
                                    </IconButton>
                                </InputAdornment>
                            ),
                        }}
                    />

                    <Autocomplete
                        multiple
                        freeSolo
                        classes={{ paper: classes.popper }}
                        options={[]}
                        value={_usernames}
                        inputValue={_input}
                        disabled={_running}
                        onChange={this._onUsernamesChange}
                        onInputChange={this._onInputChange}
                        filterOptions={this._filterUsernameOptions}
                        getOptionLabel={getUsernameOptionLabel}
                        getOptionDisabled={getUsernameOptionDisabled}
                        renderOption={renderUsernameOption}
                        renderTags={this._renderUsernameTags}
                        renderInput={renderUsernamesInput}
                        style={USERNAMES_STYLE}
                    />
                    <div style={COUNTS_ROW_STYLE}>
                        <Typography variant="body2" style={COUNTS_TEXT_STYLE}>
                            {creatable.length} ready{invalidCount ? ` · ${invalidCount} invalid` : ""}{takenCount ? ` · ${takenCount} taken` : ""}
                        </Typography>
                        <Typography variant="body2" style={COUNTS_TEXT_STYLE}>
                            {t("components.create_bulk_account_dialog.fee_account")} <span className={classes.mono}>{_fee || "…"}</span>
                        </Typography>
                    </div>

                    <TextField
                        style={FEE_FIELD_STYLE}
                        fullWidth
                        label={t("components.create_bulk_account_dialog.creation_fee_per_account")}
                        variant="filled"
                        value={_fee}
                        disabled={_running}
                        onChange={this._onFeeChange}
                        InputLabelProps={SHRINK_LABEL_PROPS}
                        helperText={t(
                            "components.create_bulk_account_dialog.prefilled_from_the_chains_account_creation_fee"
                        )}
                    />

                    <div className={classes.warnBanner}><T
                            k="components.create_bulk_account_dialog.each_account_is_generated_from_a_fresh" /></div>

                    <Collapse in={_running || _done}>
                        <LinearProgress className={classes.progress} variant="determinate" value={_progress} />
                        {_results.length > 0 && (
                            <List dense className={classes.resultList}>
                                {_results.map((r) => (
                                    <ListItem key={r.name}>
                                        <ListItemIcon style={RESULT_ICON_STYLE}>
                                            {r.status === "ok"
                                                ? <CheckCircleRounded style={RESULT_OK_STYLE} />
                                                : <ErrorRounded style={RESULT_BAD_STYLE} />}
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={<span className={classes.mono}>@{r.name}</span>}
                                            secondary={r.status === "ok"
                                                ? t("components.create_bulk_account_dialog.block_backup_pdf_ready", {
                                                block: r.block ?? "—"
                                            })
                                                : (r.message || "Failed")}
                                            secondaryTypographyProps={r.status === "ok" ? RESULT_SECONDARY_OK : RESULT_SECONDARY_BAD}
                                        />
                                        {r.status === "ok" && r.pdfBlob && (
                                            <ListItemSecondaryAction>
                                                <Tooltip title={t("components.create_bulk_account_dialog.re_save_backup_pdf")}>
                                                    <IconButton size="small" edge="end" onClick={() => this._savePdf(r)} style={RESULT_DL_STYLE}>
                                                        <DownloadRounded />
                                                    </IconButton>
                                                </Tooltip>
                                            </ListItemSecondaryAction>
                                        )}
                                    </ListItem>
                                ))}
                            </List>
                        )}
                    </Collapse>
                </DialogContent>
                <DialogActions style={ACTIONS_STYLE}>
                    {_done && okResults > 0 && (
                        <Button variant="text" color="primary" onClick={this._saveAllPdfs}>
                            {t("components.create_bulk_account_dialog.download_all_pdfs")} <DownloadRounded style={DL_ALL_ICON_STYLE} />
                        </Button>
                    )}
                    <Button variant="text" color="primary" onClick={onClose} disabled={_running}>
                        {_done ? "CLOSE" : "CANCEL"}
                    </Button>
                    {!_done && (
                        <Tooltip title={creatable.length === 0 ? "Add at least one valid, available username" : ""} disableHoverListener={creatable.length > 0}>
                            <span>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={this._startCreate}
                                    disabled={_running || creatable.length === 0 || !_creatorKey}
                                >
                                    {_running
                                        ? <React.Fragment><CircularProgress size={16} style={CREATING_SPINNER_STYLE} /> {t("components.create_bulk_account_dialog.creating")}</React.Fragment>
                                        : `Create ${creatable.length || ""}`.trim()}
                                </Button>
                            </span>
                        </Tooltip>
                    )}
                </DialogActions>
            </Dialog>
        );
    }
}

export default withLanguage(withStyles(styles)(CreateBulkAccountDialog));