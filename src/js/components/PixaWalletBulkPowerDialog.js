import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import Typography from "@material-ui/core/Typography";
import TextField from "@material-ui/core/TextField";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import IconButton from "@material-ui/core/IconButton";
import InputAdornment from "@material-ui/core/InputAdornment";
import Tooltip from "@material-ui/core/Tooltip";
import Collapse from "@material-ui/core/Collapse";
import LinearProgress from "@material-ui/core/LinearProgress";
import CircularProgress from "@material-ui/core/CircularProgress";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import Chip from "@material-ui/core/Chip";
import AddRounded from "@material-ui/icons/AddRounded";
import DeleteOutlineRounded from "@material-ui/icons/DeleteOutlineRounded";
import CloudUploadRounded from "@material-ui/icons/CloudUploadRounded";
import DownloadRounded from "@material-ui/icons/SaveAltRounded";
import CheckCircleRounded from "@material-ui/icons/CheckCircleRounded";
import ErrorRounded from "@material-ui/icons/ErrorRounded";
import Visibility from "@material-ui/icons/Visibility";
import VisibilityOff from "@material-ui/icons/VisibilityOff";
import PixaPower from "../icons/PixaPower";
import * as actions from "../actions/utils";

import { T } from "../utils/T";
import { t, getLocaleCode } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";
/*
 * PixaWalletBulkPowerDialog
 * ─────────────────────────
 * Treasury-only (pixa.team / pixa.rex) tool for BULK, MULTI-SIGNATURE direct
 * Pixa Power (PXP) transfers. Standard PXP is non-transferable; these accounts
 * move it directly via native `transfer` ops whose amount is denominated in
 * VESTS (the symbol selects the power semantics — same mechanism as the single
 * Send-Power dialog).
 *
 * Because the account is an n-of-n multisig held by different people who cannot
 * co-locate their keys, signing is split across three tabs:
 *
 *   CREATE     One coordinator lists {recipient, PXP} rows, freezes them into a
 *              single unsigned transaction envelope, and downloads
 *              transactions.json. The envelope (ref block + expiration + ops)
 *              is fixed here so every co-signer signs identical bytes.
 *   SIGN       Each co-signer opens transactions.json, enters THEIR private
 *              active key, and downloads a copy carrying their one signature.
 *              Signing happens locally; the key never leaves the device.
 *   BROADCAST  Anyone gathers the signed copies, merges them (signatures are
 *              unioned), the active-authority threshold is verified, and the
 *              fully-signed transaction is broadcast.
 *
 * The transaction expiration is chain-capped (commonly ~1 hour), so a signing
 * session must complete inside that window or the coordinator regenerates it.
 */

const styles = (theme) => ({
    darkGreyDialog: {
        backgroundColor: "#181818ff !important",
        "& .MuiButton-contained.Mui-disabled": { opacity: 0.35 },
    },
    tabs: {
        borderBottom: "1px solid #2a2a2a",
        marginBottom: 16,
        "& .MuiTab-root": { minWidth: 0, color: "#888" },
        "& .Mui-selected": { color: "#fff" },
        "& .MuiTabs-indicator": { backgroundColor: "#bbb" },
    },
    banner: {
        backgroundColor: "#101010",
        borderRadius: "6px",
        padding: "8px 12px",
        margin: "0px 0px 12px 0px",
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
    expiredBanner: {
        backgroundColor: "#161616",
        border: "1px solid #555",
        borderRadius: "6px",
        padding: "8px 12px",
        margin: "12px 0px 4px 0px",
        color: "#e0e0e0",
        fontSize: "12px",
        lineHeight: "1.4",
    },
    entryRow: {
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        marginBottom: 8,
    },
    fileBox: {
        border: "1px dashed #3a3a3a",
        borderRadius: 8,
        padding: "16px",
        textAlign: "center",
        backgroundColor: "#141414",
        margin: "8px 0px",
    },
    list: {
        maxHeight: 200,
        overflowY: "auto",
        backgroundColor: "#141414",
        borderRadius: 8,
        margin: "8px 0px",
    },
    mono: { fontFamily: "monospace" },
});

const HARD_MAX_EXPIRY_MIN = 60; // chain typically rejects expiration > 1h

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

function download(filename, text) {
    try {
        const blob = new Blob([text], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
        console.warn("[PixaWalletBulkPowerDialog] download failed:", e);
    }
}

function readFileAsJson(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => {
            try { resolve(JSON.parse(String(r.result))); }
            catch (e) { reject(new Error(t("components.pixa_wallet_bulk_power_dialog.file_not_valid_json", { name: file.name }))); }
        };
        r.onerror = () => reject(new Error(t("components.pixa_wallet_bulk_power_dialog.file_could_not_be_read", { name: file.name })));
        r.readAsText(file);
    });
}

/**
 * The ONLY operations this dialog is allowed to sign.
 *
 * The CREATE tab builds its batch with api.broadcast.buildTransferOp(), so a
 * legitimate file contains transfers and nothing else. Anything outside this
 * set is refused at import — a co-signer receives this file from a third party
 * ("one coordinator builds the batch, then download"), so the file is
 * untrusted input, and an active-key signature over an unreviewed operation
 * is the whole risk. Keep in sync with _build().
 */
const ALLOWED_OPS = new Set(["transfer", "transfer_to_vesting", "delegate_vesting_shares"]);

/**
 * Decompose a transaction into something a person can actually check before
 * they type a private key. Returns every operation, not a count.
 */
function inspectTx(tx) {
    const ops = Array.isArray(tx && tx.operations) ? tx.operations : [];
    const rows = [];
    const rejected = [];
    const senders = new Set();

    for (let i = 0; i < ops.length; i++) {
        const op = ops[i];
        const name = Array.isArray(op) ? String(op[0] || "") : "";
        const d = (Array.isArray(op) && op[1] && typeof op[1] === "object") ? op[1] : {};

        if (!ALLOWED_OPS.has(name)) { rejected.push({ index: i, name: name || "(malformed)" }); continue; }

        if (d.from) senders.add(String(d.from));
        rows.push({
            index: i,
            name,
            from: d.from ? String(d.from) : "",
            to: String(d.to || d.delegatee || d.to_account || ""),
            amount: typeof d.amount === "string" ? d.amount
                : (d.vesting_shares ? String(d.vesting_shares) : "")
        });
    }

    return { rows, rejected, senders: [...senders], count: ops.length };
}

// Accept either our wrapper ({ transaction: {...} }) or a bare transaction.
function extractTx(obj) {
    if (obj && obj.transaction && Array.isArray(obj.transaction.operations)) return obj.transaction;
    if (obj && Array.isArray(obj.operations)) return obj;
    return null;
}

function sigCount(tx) {
    return tx && Array.isArray(tx.signatures) ? tx.signatures.length : 0;
}

function stamp() {
    return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

class PixaWalletBulkPowerDialog extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            _tab: 0,
            _wasOpen: false,

            // CREATE
            _entries: [{ to: "", pxp: "" }],
            _expiryMin: 60,
            _building: false,
            _builtFile: null, // wrapper object

            // SIGN
            _signKey: "",
            _showKey: false,
            _signWrapper: null,
            _signFileName: "",
            _signerLabel: "",
            _signing: false,
            _signedFile: null,

            // BROADCAST
            _mergeFiles: [], // [{ name, wrapper, tx }]
            _fromAuth: null, // { threshold, keyAuths:[pub...] } for the 'from' account
            _verifying: false,
            _ready: false,
            _broadcasting: false,
            _broadcastResult: null, // { id, block } | { error }
        };
        this._signInputRef = null;
        this._mergeInputRef = null;
    }

    static getDerivedStateFromProps(nextProps, prevState) {
        const isOpening = !!nextProps.open && !prevState._wasOpen;
        if (isOpening) {
            return {
                _wasOpen: true,
                _tab: 0,
                _entries: [{ to: "", pxp: "" }],
                _expiryMin: 60,
                _building: false,
                _builtFile: null,
                _signKey: "",
                _showKey: false,
                _signWrapper: null,
                _signFileName: "",
                _signerLabel: "",
                _signing: false,
                _signedFile: null,
                _mergeFiles: [],
                _fromAuth: null,
                _verifying: false,
                _ready: false,
                _broadcasting: false,
                _broadcastResult: null,
            };
        }
        if (!nextProps.open && prevState._wasOpen) {
            return { _wasOpen: false, _signKey: "" };
        }
        return null;
    }

    _fromName = () => (this.props.account && (this.props.account.username || this.props.account.name)) || "";

    // ── CREATE ──────────────────────────────────────────────────────────

    _addEntry = () => {
        this.setState({ _entries: [...this.state._entries, { to: "", pxp: "" }] }, () => this.forceUpdate());
    };
    _removeEntry = (i) => {
        const next = this.state._entries.slice();
        next.splice(i, 1);
        this.setState({ _entries: next.length ? next : [{ to: "", pxp: "" }] }, () => this.forceUpdate());
    };
    _setEntry = (i, field, value) => {
        const next = this.state._entries.slice();
        next[i] = { ...next[i], [field]: field === "to" ? String(value).toLowerCase().replace(/^@+/, "") : value };
        this.setState({ _entries: next }, () => this.forceUpdate());
    };

    _validEntries = () =>
        this.state._entries.filter((e) => isValidAccountName(e.to) && Number(e.pxp) > 0);

    _totalPxp = () =>
        this.state._entries.reduce((s, e) => s + (Number(e.pxp) || 0), 0);

    _build = async () => {
        const { api, pixaToVest } = this.props;
        const from = this._fromName();
        const valid = this._validEntries();
        if (!api || !from) return;
        if (typeof pixaToVest !== "function") {
            if (actions?.trigger_snackbar) actions.trigger_snackbar(t(
                "components.pixa_wallet_bulk_power_dialog.vesting_price_unavailable_reopen_the_wallet"
            ), "error");
            return;
        }
        if (valid.length === 0) {
            if (actions?.trigger_snackbar) actions.trigger_snackbar(t(
                "components.pixa_wallet_bulk_power_dialog.add_at_least_one_valid_recipient_and"
            ), "error");
            return;
        }
        const expiryMin = Math.max(1, Math.min(HARD_MAX_EXPIRY_MIN, Number(this.state._expiryMin) || 60));

        this.setState({ _building: true }, () => this.forceUpdate());
        try {
            const vestsSymbol = this.props.vestsSymbol || "VESTS";
            const ops = valid.map((e) => {
                const vests = pixaToVest(Number(e.pxp));                              // PXP → VESTS magnitude
                const amountDisplay = api.formatter.formatAsset(vests, vestsSymbol, 6); // "N.dddddd VESTS"
                return api.broadcast.buildTransferOp(from, e.to, amountDisplay);       // translated to chain symbol
            });
            const tx = await api.broadcast.prepareTransaction(ops, { expirationSeconds: expiryMin * 60 });
            const wrapper = {
                kind: "pixagram-bulk-power-transfer",
                from,
                created_at: new Date().toISOString(),
                expiration: tx.expiration,
                entries: valid.map((e) => ({ to: e.to, pxp: Number(e.pxp) })),
                transaction: tx,
            };
            this.setState({ _builtFile: wrapper, _building: false }, () => this.forceUpdate());
            download(`transactions-${from}-${stamp()}.json`, JSON.stringify(wrapper, null, 2));
            if (actions?.trigger_snackbar) actions.trigger_snackbar(t(
                "components.pixa_wallet_bulk_power_dialog.transactions_json_downloaded_send_it_to_your"
            ), "success");
        } catch (err) {
            this.setState({ _building: false }, () => this.forceUpdate());
            if (actions?.trigger_snackbar) actions.trigger_snackbar(t("components.pixa_wallet_bulk_power_dialog.build_failed", {
                err: ((err && err.message) || "error")
            }), "error");
        }
    };

    // ── SIGN ────────────────────────────────────────────────────────────

    _pickSignFile = () => { if (this._signInputRef) this._signInputRef.click(); };
    _onSignFile = async (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = "";
        if (!file) return;
        try {
            const obj = await readFileAsJson(file);
            const tx = extractTx(obj);
            if (!tx) throw new Error("no transaction found in file");

            // Refuse before the key field is ever shown. A file that contains
            // an account_update or a plain PXA transfer is not a bulk power
            // batch, and must never reach signTransaction().
            const check = inspectTx(tx);
            if (!check.count) throw new Error("that file contains no operations");
            if (check.rejected.length) {
                throw new Error(
                    "refused: this file contains " + check.rejected.length +
                    " operation(s) this dialog cannot sign (" +
                    check.rejected.map((r) => r.name).join(", ") + ")"
                );
            }
            this.setState({ _signWrapper: obj.transaction ? obj : { transaction: tx }, _signFileName: file.name, _signedFile: null }, () => this.forceUpdate());
        } catch (err) {
            if (actions?.trigger_snackbar) actions.trigger_snackbar((err && err.message) || t("components.pixa_wallet_bulk_power_dialog.invalid_file"), "error");
        }
    };

    _sign = async () => {
        const { api } = this.props;
        const wrapper = this.state._signWrapper;
        const key = this.state._signKey.trim();
        if (!api || !wrapper) return;
        const tx = extractTx(wrapper);
        if (!tx) return;

        // Defence in depth: state could have been replaced between import and
        // click. Never sign an operation that was not displayed for review.
        const check = inspectTx(tx);
        if (!check.count || check.rejected.length) {
            if (actions?.trigger_snackbar) actions.trigger_snackbar(
                t("components.pixa_wallet_bulk_power_dialog.refused_unreviewable_operations"), "error");
            return;
        }

        if (!key || !api.auth.isWif(key)) {
            if (actions?.trigger_snackbar) actions.trigger_snackbar(t("components.pixa_wallet_bulk_power_dialog.enter_a_valid_private_key"), "error");
            return;
        }

        this.setState({ _signing: true }, () => this.forceUpdate());
        try {
            // Soft authority check: warn (don't block) if the key isn't among the
            // 'from' account's active keys — it may authorise via account_auths.
            try {
                const from = (tx.operations[0] && tx.operations[0][1] && tx.operations[0][1].from) || wrapper.from;
                const pub = api.auth.wifToPublic(key);
                const accs = await api.accounts.getAccounts([from]);
                const keyAuths = (accs && accs[0] && accs[0].active && accs[0].active.key_auths) || [];
                const known = keyAuths.some((ka) => Array.isArray(ka) && ka[0] === pub);
                if (!known && actions?.trigger_snackbar) {
                    actions.trigger_snackbar(t(
                        "components.pixa_wallet_bulk_power_dialog.note_this_key_isnt_in_s_active",
                        {
                            from: from
                        }
                    ), "error");
                }
            } catch (_) { /* non-fatal */ }

            const signedTx = api.broadcast.signTransaction(tx, key);
            const label = (this.state._signerLabel || "").toLowerCase().replace(/[^a-z0-9._-]/g, "") || "signer";
            const out = { ...wrapper, transaction: signedTx, signed_by: [...(wrapper.signed_by || []), label] };
            this.setState({ _signedFile: out, _signing: false }, () => this.forceUpdate());
            download(`signed-${label}-${stamp()}.json`, JSON.stringify(out, null, 2));
            if (actions?.trigger_snackbar) actions.trigger_snackbar(t(
                "components.pixa_wallet_bulk_power_dialog.signed_copy_downloaded_send_it_to_whoever"
            ), "success");
        } catch (err) {
            this.setState({ _signing: false }, () => this.forceUpdate());
            if (actions?.trigger_snackbar) actions.trigger_snackbar(t("components.pixa_wallet_bulk_power_dialog.signing_failed", {
                err: ((err && err.message) || "error")
            }), "error");
        }
    };

    // ── BROADCAST ───────────────────────────────────────────────────────

    _pickMergeFiles = () => { if (this._mergeInputRef) this._mergeInputRef.click(); };
    _onMergeFiles = async (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = "";
        if (files.length === 0) return;
        const added = this.state._mergeFiles.slice();
        for (const file of files) {
            try {
                const obj = await readFileAsJson(file);
                const tx = extractTx(obj);
                if (!tx) throw new Error(t("components.pixa_wallet_bulk_power_dialog.file_no_transaction_found", { name: file.name }));
                added.push({ name: file.name, wrapper: obj, tx });
            } catch (err) {
                if (actions?.trigger_snackbar) actions.trigger_snackbar((err && err.message) || t("components.pixa_wallet_bulk_power_dialog.invalid_file"), "error");
            }
        }
        this.setState({ _mergeFiles: added, _ready: false, _broadcastResult: null }, () => this.forceUpdate());
        this._verifyMerge(added);
    };

    _removeMergeFile = (i) => {
        const next = this.state._mergeFiles.slice();
        next.splice(i, 1);
        this.setState({ _mergeFiles: next, _ready: false, _broadcastResult: null }, () => this.forceUpdate());
        this._verifyMerge(next);
    };

    _tryMerge = (files) => {
        const list = (files || this.state._mergeFiles).map((f) => f.tx);
        if (list.length === 0) return null;
        return this.props.api.broadcast.mergeSignedTransactions(list);
    };

    _verifyMerge = async (files) => {
        const api = this.props.api;
        const list = files || this.state._mergeFiles;
        if (!api || list.length === 0) { this.setState({ _ready: false, _fromAuth: null }, () => this.forceUpdate()); return; }

        this.setState({ _verifying: true }, () => this.forceUpdate());
        try {
            const merged = this._tryMerge(list);
            const from = (merged.operations[0] && merged.operations[0][1] && merged.operations[0][1].from) || "";
            let fromAuth = this.state._fromAuth;
            if (!fromAuth && from) {
                const accs = await api.accounts.getAccounts([from]);
                const active = accs && accs[0] && accs[0].active;
                fromAuth = active
                    ? { threshold: active.weight_threshold, keyAuths: (active.key_auths || []).map((ka) => ka[0]) }
                    : null;
            }
            let ready = false;
            try { ready = !!(await api.authority.verifyAuthority(merged)); } catch (_) { ready = false; }
            this.setState({ _ready: ready, _fromAuth: fromAuth, _verifying: false }, () => this.forceUpdate());
        } catch (err) {
            // Envelope mismatch or merge error.
            this.setState({ _ready: false, _verifying: false }, () => this.forceUpdate());
            if (actions?.trigger_snackbar) actions.trigger_snackbar((err && err.message) || t("components.pixa_wallet_bulk_power_dialog.cannot_merge_these_files"), "error");
        }
    };

    _broadcast = async () => {
        const api = this.props.api;
        this.setState({ _broadcasting: true, _broadcastResult: null }, () => this.forceUpdate());
        try {
            const merged = this._tryMerge();
            if (!merged) throw new Error(t("components.pixa_wallet_bulk_power_dialog.nothing_to_broadcast"));
            const res = await api.broadcast.broadcastTransactionSynchronous(merged);
            this.setState({ _broadcasting: false, _broadcastResult: { id: res && res.id, block: res && res.block_num } }, () => this.forceUpdate());
            if (actions?.trigger_snackbar) actions.trigger_snackbar(t(
                "components.pixa_wallet_bulk_power_dialog.bulk_transfer_broadcast_in_block",
                {
                    res: (res && res.block_num)
                }
            ), "success");
            if (typeof this.props.onBroadcasted === "function") this.props.onBroadcasted(res);
        } catch (err) {
            this.setState({ _broadcasting: false, _broadcastResult: { error: (err && err.message) || t("components.pixa_wallet_bulk_power_dialog.broadcast_failed_2") } }, () => this.forceUpdate());
            if (actions?.trigger_snackbar) actions.trigger_snackbar(t("components.pixa_wallet_bulk_power_dialog.broadcast_failed", {
                err: ((err && err.message) || "error")
            }), "error");
        }
    };

    // ── helpers ─────────────────────────────────────────────────────────

    _isExpired = (iso) => {
        if (!iso) return false;
        const exp = new Date(iso + "Z").getTime();
        return Number.isFinite(exp) && exp < Date.now();
    };

    _mergedSummary = () => {
        try {
            const merged = this._tryMerge();
            if (!merged) return null;
            return { sigs: sigCount(merged), ops: merged.operations.length, expiration: merged.expiration };
        } catch (_) { return null; }
    };

    // ── render ──────────────────────────────────────────────────────────

    render() {
        const { classes, open, onClose } = this.props;
        const {
            _tab, _entries, _expiryMin, _building, _builtFile,
            _signKey, _showKey, _signWrapper, _signFileName, _signerLabel, _signing, _signedFile,
            _mergeFiles, _fromAuth, _verifying, _ready, _broadcasting, _broadcastResult,
        } = this.state;

        const from = this._fromName();
        const maxPXP = Number(this.props.maxPXP) || 0;
        const totalPxp = this._totalPxp();
        const overBudget = maxPXP > 0 && totalPxp > maxPXP + 1e-6;
        const valid = this._validEntries();

        const signTx = extractTx(_signWrapper || {});
        const signExpired = signTx && this._isExpired(signTx.expiration);
        const mergedSummary = this._mergedSummary();
        const mergedExpired = mergedSummary && this._isExpired(mergedSummary.expiration);
        const threshold = _fromAuth ? _fromAuth.threshold : null;

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
                    <Typography component="h2" variant="h6" style={{ marginBottom: 4 }}>
                        {t("components.pixa_wallet_bulk_power_dialog.bulk_power_transfer")}
                    </Typography>
                    <div className={classes.banner}><T
                            k="components.pixa_wallet_bulk_power_dialog.strong_multi_signature_treasury_operation_strong"
                            vars={{
                                from: from
                            }}
                            slots={[<span className={classes.mono} key="0" />]} /></div>

                    <Tabs
                        className={classes.tabs}
                        value={_tab}
                        onChange={(e, v) => this.setState({ _tab: v }, () => this.forceUpdate())}
                        variant="fullWidth"
                        textColor="inherit"
                    >
                        <Tab label={t("components.pixa_wallet_bulk_power_dialog.create")} />
                        <Tab label={t("components.pixa_wallet_bulk_power_dialog.sign")} />
                        <Tab label={t("components.pixa_wallet_bulk_power_dialog.broadcast")} />
                    </Tabs>

                    {/* ─────────────── CREATE ─────────────── */}
                    {_tab === 0 && (
                        <div>
                            <Typography variant="body2" style={{ color: "#999", marginBottom: 12 }}><T
                                    k="components.pixa_wallet_bulk_power_dialog.one_coordinator_builds_the_batch_add_a"
                                    slots={[<span className={classes.mono} key="0" />]} /></Typography>

                            {_entries.map((e, i) => {
                                const nameBad = e.to.length > 0 && !isValidAccountName(e.to);
                                return (
                                    <div key={i} className={classes.entryRow}>
                                        <TextField
                                            variant="filled"
                                            label={t("words.recipient")}
                                            value={e.to}
                                            error={nameBad}
                                            disabled={_building}
                                            onChange={(ev) => this._setEntry(i, "to", ev.target.value)}
                                            InputLabelProps={{ shrink: true }}
                                            InputProps={{ startAdornment: <InputAdornment position="start"><span style={{ color: "#777" }}>@</span></InputAdornment> }}
                                            style={{ flex: 2 }}
                                        />
                                        <TextField
                                            variant="filled"
                                            label="PXP"
                                            value={e.pxp}
                                            disabled={_building}
                                            onChange={(ev) => {
                                                const v = ev.target.value.replace(/[^0-9.]/g, "");
                                                this._setEntry(i, "pxp", v);
                                            }}
                                            InputLabelProps={{ shrink: true }}
                                            InputProps={{ startAdornment: <PixaPower style={{ margin: "0px 6px -6px 0px", fontSize: "1em" }} /> }}
                                            style={{ flex: 1 }}
                                        />
                                        <IconButton size="small" onClick={() => this._removeEntry(i)} disabled={_building} style={{ marginTop: 8, color: "#888" }}>
                                            <DeleteOutlineRounded />
                                        </IconButton>
                                    </div>
                                );
                            })}

                            <Button size="small" onClick={this._addEntry} disabled={_building} startIcon={<AddRounded />} style={{ color: "#bbb", marginTop: 4 }}>
                                {t("components.pixa_wallet_bulk_power_dialog.add_entry")}
                            </Button>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                                <Typography variant="body2" style={{ color: overBudget ? "#e0e0e0" : "#999", fontSize: 13 }}>
                                    <T k="components.pixa_wallet_bulk_power_dialog.total_pxp"
                                       vars={{
                                           total: totalPxp.toLocaleString(getLocaleCode(), { maximumFractionDigits: 6 }),
                                           available: maxPXP > 0
                                               ? t("components.pixa_wallet_bulk_power_dialog.of_available", {
                                                     max: maxPXP.toLocaleString(getLocaleCode(), { maximumFractionDigits: 3 }) })
                                               : ""
                                       }}
                                       slots={[<span className={classes.mono} key="0" />]} />
                                </Typography>
                                <Chip size="small" label={t("components.pixa_wallet_bulk_power_dialog.valid_count", { count: valid.length })} style={{ backgroundColor: "#242424", color: "#ddd" }} />
                            </div>

                            <TextField
                                style={{ marginTop: 12 }}
                                fullWidth
                                type="number"
                                label={t(
                                    "components.pixa_wallet_bulk_power_dialog.signing_window_minutes_until_expiry"
                                )}
                                value={_expiryMin}
                                disabled={_building}
                                onChange={(ev) => this.setState({ _expiryMin: ev.target.value }, () => this.forceUpdate())}
                                InputLabelProps={{ shrink: true }}
                                inputProps={{ min: 1, max: HARD_MAX_EXPIRY_MIN }}
                                helperText={t(
                                    "components.pixa_wallet_bulk_power_dialog.all_signers_must_sign_and_broadcast_within",
                                    {
                                        HARD_MAX_EXPIRY_MIN: HARD_MAX_EXPIRY_MIN
                                    }
                                )}
                            />

                            {overBudget && (
                                <div className={classes.expiredBanner}>{t(
                                        "components.pixa_wallet_bulk_power_dialog.the_total_pxp_exceeds_s_available_pixa",
                                        {
                                            totalPxp: totalPxp.toLocaleString(getLocaleCode(), { maximumFractionDigits: 6 }),
                                            from: from
                                        }
                                    )}</div>
                            )}

                            {_builtFile && (
                                <div className={classes.warnBanner}><T
                                        k="components.pixa_wallet_bulk_power_dialog.built_transfer_expiring_0_0_utc_if"
                                        vars={{
                                            transfer: { transfer: (_builtFile.entries || []).length },
                                            expiration: _builtFile.expiration
                                        }}
                                        slots={[<span className={classes.mono} key="0" />]} /></div>
                            )}
                        </div>
                    )}

                    {/* ─────────────── SIGN ─────────────── */}
                    {_tab === 1 && (
                        <div>
                            <Typography variant="body2" style={{ color: "#999", marginBottom: 8 }}><T
                                    k="components.pixa_wallet_bulk_power_dialog.each_co_signer_open_the_0_transactions"
                                    slots={[<span className={classes.mono} key="0" />]} /></Typography>

                            <input type="file" accept="application/json,.json" ref={(el) => (this._signInputRef = el)} onChange={this._onSignFile} style={{ display: "none" }} />
                            <div className={classes.fileBox}>
                                <Button variant="outlined" onClick={this._pickSignFile} startIcon={<CloudUploadRounded />} style={{ color: "#ddd", borderColor: "#3a3a3a" }}>
                                    {_signFileName ? t("components.pixa_wallet_bulk_power_dialog.choose_a_different_file") : t("components.pixa_wallet_bulk_power_dialog.upload_transactions_json")}
                                </Button>
                                {_signFileName && (
                                    <Typography variant="body2" style={{ color: "#888", marginTop: 8 }} className={classes.mono}>{_signFileName}</Typography>
                                )}
                            </div>

                            {signTx && (() => {
                                // Every operation is itemised. The previous version showed
                                // only operations[0].from and a count labelled "transfer(s)",
                                // which meant a co-signer typed an active key against a
                                // transaction whose contents they could not see.
                                const insp = inspectTx(signTx);
                                const multiSender = insp.senders.length > 1;
                                return (
                                    <>
                                        {multiSender && (
                                            <div className={classes.warnBanner}>
                                                {t("components.pixa_wallet_bulk_power_dialog.multiple_sending_accounts", {
                                                    senders: insp.senders.join(", ")
                                                })}
                                            </div>
                                        )}
                                        <List dense className={classes.list}>
                                            {insp.rows.map((r) => (
                                                <ListItem key={r.index} divider>
                                                    <ListItemText
                                                        primary={
                                                            <span className={classes.mono}>
                                                                {r.amount || "?"}{"  →  @"}{r.to || "?"}
                                                            </span>
                                                        }
                                                        secondary={t("components.pixa_wallet_bulk_power_dialog.op_from", {
                                                            name: r.name,
                                                            from: r.from || "?"
                                                        })}
                                                    />
                                                </ListItem>
                                            ))}
                                        </List>
                                        <Typography
                                            variant="body2"
                                            style={{ color: signExpired ? "#cfcfcf" : "#8a8a8a", margin: "4px 0px 8px 0px" }}
                                        >
                                            {t("components.pixa_wallet_bulk_power_dialog.operations_signatures_expires_utc", {
                                                operation_count: insp.rows.length,
                                                sigCount: sigCount(signTx),
                                                expiration: signTx.expiration
                                            })}
                                        </Typography>
                                    </>
                                );
                            })()}

                            {signExpired && (
                                <div className={classes.expiredBanner}>
                                    {t(
                                        "components.pixa_wallet_bulk_power_dialog.this_transaction_has_expired_ask_the_coordinator"
                                    )}
                                </div>
                            )}

                            <TextField
                                style={{ margin: "12px 0px 0px 0px" }}
                                fullWidth
                                type={_showKey ? "text" : "password"}
                                label={t("components.pixa_wallet_bulk_power_dialog.your_active_private_key")}
                                variant="filled"
                                value={_signKey}
                                disabled={_signing || !signTx}
                                onChange={(e) => this.setState({ _signKey: e.target.value }, () => this.forceUpdate())}
                                autoComplete="off"
                                InputLabelProps={{ shrink: true }}
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton onClick={() => this.setState({ _showKey: !_showKey }, () => this.forceUpdate())} edge="end">
                                                {_showKey ? <VisibilityOff /> : <Visibility />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                            />
                            <TextField
                                style={{ margin: "8px 0px 0px 0px" }}
                                fullWidth
                                label={t("components.pixa_wallet_bulk_power_dialog.your_name_label_optional")}
                                variant="filled"
                                value={_signerLabel}
                                disabled={_signing || !signTx}
                                onChange={(e) => this.setState({ _signerLabel: e.target.value }, () => this.forceUpdate())}
                                InputLabelProps={{ shrink: true }}
                                helperText={t(
                                    "components.pixa_wallet_bulk_power_dialog.only_used_to_name_your_downloaded_file"
                                )}
                            />

                            {_signedFile && (
                                <div className={classes.warnBanner}><T
                                        k="components.pixa_wallet_bulk_power_dialog.signed_your_copy_now_carries_0_0"
                                        vars={{
                                            sigCount: sigCount(extractTx(_signedFile))
                                        }}
                                        slots={[<span className={classes.mono} key="0" />]} /></div>
                            )}
                        </div>
                    )}

                    {/* ─────────────── BROADCAST ─────────────── */}
                    {_tab === 2 && (
                        <div>
                            <Typography variant="body2" style={{ color: "#999", marginBottom: 8 }}>
                                {t(
                                    "components.pixa_wallet_bulk_power_dialog.gather_every_signed_copy_upload_them_together"
                                )}
                            </Typography>

                            <input type="file" accept="application/json,.json" multiple ref={(el) => (this._mergeInputRef = el)} onChange={this._onMergeFiles} style={{ display: "none" }} />
                            <div className={classes.fileBox}>
                                <Button variant="outlined" onClick={this._pickMergeFiles} startIcon={<CloudUploadRounded />} style={{ color: "#ddd", borderColor: "#3a3a3a" }}>
                                    {t("components.pixa_wallet_bulk_power_dialog.upload_signed_files")}
                                </Button>
                            </div>

                            {_mergeFiles.length > 0 && (
                                <List dense className={classes.list}>
                                    {_mergeFiles.map((f, i) => (
                                        <ListItem key={i}>
                                            <ListItemIcon style={{ minWidth: 34 }}>
                                                <CheckCircleRounded style={{ color: sigCount(f.tx) > 0 ? "#e0e0e0" : "#8a8a8a" }} />
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={<span className={classes.mono}>{f.name}</span>}
                                                secondary={t("components.pixa_wallet_bulk_power_dialog.signature_count", { signature: { signature: sigCount(f.tx) } })}
                                                secondaryTypographyProps={{ style: { color: "#8a8a8a" } }}
                                            />
                                            <IconButton size="small" onClick={() => this._removeMergeFile(i)} style={{ color: "#888" }}>
                                                <DeleteOutlineRounded />
                                            </IconButton>
                                        </ListItem>
                                    ))}
                                </List>
                            )}

                            {mergedSummary && (
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                                    <Typography variant="body2" style={{ color: "#bbb" }}><T
                                            k="components.pixa_wallet_bulk_power_dialog.merged_0_0_signature_s_transfer_s"
                                            vars={{
                                                sigs: mergedSummary.sigs,
                                                threshold: threshold ? ` / ${threshold}` : "",
                                                ops: mergedSummary.ops
                                            }}
                                            slots={[<span className={classes.mono} key="0" />]} /></Typography>
                                    {_verifying
                                        ? <CircularProgress size={16} style={{ color: "#888" }} />
                                        : _ready
                                            ? <Chip size="small" icon={<CheckCircleRounded style={{ color: "#e0e0e0" }} />} label={t("components.pixa_wallet_bulk_power_dialog.threshold_met")} style={{ backgroundColor: "#2a2a2a", color: "#eee" }} />
                                            : <Chip size="small" label={t("components.pixa_wallet_bulk_power_dialog.needs_more_signatures")} style={{ backgroundColor: "#1a1a1a", color: "#999" }} />}
                                </div>
                            )}

                            {mergedExpired && (
                                <div className={classes.expiredBanner}>
                                    {t(
                                        "components.pixa_wallet_bulk_power_dialog.the_merged_transaction_has_expired_and_can"
                                    )}
                                </div>
                            )}

                            {_broadcastResult && _broadcastResult.id && (
                                <div className={classes.warnBanner}><T
                                        k="components.pixa_wallet_bulk_power_dialog.broadcast_in_block_0_0_tx_1"
                                        vars={{
                                            block: _broadcastResult.block,
                                            String: String(_broadcastResult.id).slice(0, 16)
                                        }}
                                        slots={[
                                            <span className={classes.mono} key="0" />,
                                            <span className={classes.mono} key="1" />
                                        ]} /></div>
                            )}
                            {_broadcastResult && _broadcastResult.error && (
                                <div className={classes.expiredBanner}>
                                    {_broadcastResult.error}
                                </div>
                            )}

                            {_broadcasting && <LinearProgress style={{ marginTop: 12, backgroundColor: "#222" }} />}
                        </div>
                    )}
                </DialogContent>
                <DialogActions style={{ textAlign: "right" }}>
                    <Button variant="text" color="primary" onClick={onClose} disabled={_building || _signing || _broadcasting}>{t("words.close", {TUC: true})} </Button>

                    {_tab === 0 && (
                        <React.Fragment>
                            {_builtFile && (
                                <Button variant="text" color="primary" onClick={() => download(`transactions-${from}-${stamp()}.json`, JSON.stringify(_builtFile, null, 2))}>
                                    {t("components.pixa_wallet_bulk_power_dialog.re_download")} <DownloadRounded style={{ marginLeft: 8 }} />
                                </Button>
                            )}
                            <Tooltip title={overBudget ? t("components.pixa_wallet_bulk_power_dialog.total_exceeds_available_pxp") : (valid.length === 0 ? t("components.pixa_wallet_bulk_power_dialog.add_a_valid_recipient_and_amount") : "")} disableHoverListener={valid.length > 0 && !overBudget}>
                                <span>
                                    <Button variant="contained" color="primary" onClick={this._build} disabled={_building || valid.length === 0 || overBudget}>
                                        {_building ? <React.Fragment><CircularProgress size={16} style={{ marginRight: 8, color: "#bbb" }} /> {t("components.pixa_wallet_bulk_power_dialog.building")}</React.Fragment> : t("components.pixa_wallet_bulk_power_dialog.build_download")}
                                    </Button>
                                </span>
                            </Tooltip>
                        </React.Fragment>
                    )}

                    {_tab === 1 && (
                        <Button variant="contained" color="primary" onClick={this._sign} disabled={_signing || !signTx || signExpired || !_signKey}>
                            {_signing ? <React.Fragment><CircularProgress size={16} style={{ marginRight: 8, color: "#bbb" }} /> {t("components.pixa_wallet_bulk_power_dialog.signing")}</React.Fragment> : t("components.pixa_wallet_bulk_power_dialog.sign_download")}
                        </Button>
                    )}

                    {_tab === 2 && (
                        <Tooltip title={!_ready ? t("components.pixa_wallet_bulk_power_dialog.not_enough_signatures_yet") : (mergedExpired ? t("components.pixa_wallet_bulk_power_dialog.transaction_expired") : "")} disableHoverListener={_ready && !mergedExpired}>
                            <span>
                                <Button variant="contained" color="primary" onClick={this._broadcast} disabled={_broadcasting || !_ready || mergedExpired || _mergeFiles.length === 0}>
                                    {_broadcasting ? <React.Fragment><CircularProgress size={16} style={{ marginRight: 8, color: "#bbb" }} /> {t("words.broadcasting")}</React.Fragment> : t("components.pixa_wallet_bulk_power_dialog.broadcast")}
                                </Button>
                            </span>
                        </Tooltip>
                    )}
                </DialogActions>
            </Dialog>
        );
    }
}

export default withLanguage(withStyles(styles)(PixaWalletBulkPowerDialog));