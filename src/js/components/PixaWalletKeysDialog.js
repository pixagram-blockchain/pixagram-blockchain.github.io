import * as React from "preact/compat";
import { memo, useMemo } from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import Typography from "@material-ui/core/Typography";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import InputAdornment from "@material-ui/core/InputAdornment";
import OutlinedInput from "@material-ui/core/OutlinedInput";
import IconButton from "@material-ui/core/IconButton";
import Checkbox from "@material-ui/core/Checkbox";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Visibility from "@material-ui/icons/Visibility";
import VisibilityOff from "@material-ui/icons/VisibilityOff";
import CircularProgress from "@material-ui/core/CircularProgress";
import Backdrop from "@material-ui/core/Backdrop";
import Portal from "@material-ui/core/Portal";
import Collapse from "@material-ui/core/Collapse";
import Tooltip from "@material-ui/core/Tooltip";
import FileCopyOutlined from "@material-ui/icons/FileCopyOutlined";
import InfoOutlined from "@material-ui/icons/InfoOutlined";
import LockOpenRounded from "@material-ui/icons/LockOpenRounded";
import ChipInput from "./ChipInput";
import SeedPhraseMenu from "./SeedPhraseMenu";
import SeedPlus from "../icons/SeedPlus";
import SproutOutline from "../icons/SproutOutline";
import KeyIcon from "@material-ui/icons/VpnKey";
import { generateMnemonic, generateMasterKey, generatePDF, getWordsPossible } from "../utils/BackUpWallet2";
import SecurityRounded from "@material-ui/icons/SecurityRounded";
import RestoreRounded from "@material-ui/icons/RestoreRounded";
import TextField from "@material-ui/core/TextField";
import Autocomplete from "@material-ui/lab/Autocomplete";
import Avatar from "@material-ui/core/Avatar";
import Fade from "@material-ui/core/Fade";
import Tab from "@material-ui/core/Tab";
import Tabs from "@material-ui/core/Tabs";
import SwipeableViews from "react-swipeable-views";

import { T } from "../utils/T";
import { t, useLanguage, getLanguage } from "../utils/text";
import * as actions from "../actions/utils";

import { withLanguage } from "../utils/withLanguage";
/** How long a private key is allowed to sit on the clipboard. */
const CLIPBOARD_CLEAR_MS = 30000;

const styles = (theme) => ({
    content: { padding: "16px 24px" },
    // ── Tabbed shell — same treatment as AppInfoDialog ──────────────────────
    dialog: {
        "& .MuiDialog-paperScrollPaper": {
            [theme.breakpoints.down("sm")]: {
                maxHeight: "100%"
            }
        },
        "& .MuiDialog-paperFullWidth": {
            [theme.breakpoints.down("sm")]: {
                width: "100% !important"
            }
        },
        "& .react-swipeable-view-container": {
            height: "min(80vh, calc(-420px + 100vh)) !important",
            // fullScreen (≤960px): the -420px budget assumed a floating paper;
            // in fullscreen only the header (title + tabs) and actions (~220px)
            // sit outside the swipeable area.
            [theme.breakpoints.down("sm")]: {
                height: "calc(100vh - 220px) !important"
            }
        },
        "& .react-swipeable-view-container > div": {
            height: "min(80vh, calc(-420px + 100vh)) !important",
            overflow: "hidden overlay !important",
            [theme.breakpoints.down("sm")]: {
                height: "calc(100vh - 220px) !important"
            }
        }
    },
    cardTabs: {
        backgroundColor: "#171717",
        "& .MuiTab-root": {
            minWidth: "72px !important"
        },
        "& .MuiTab-textColorPrimary.Mui-selected": {
            backgroundColor: "transparent",
        },
        "& .MuiTab-textColorPrimary.Mui-selected .MuiTab-wrapper": {
            color: "#171717 !important"
        },
        "& .MuiTab-fullWidth": {
            backgroundColor: "transparent",
            color: "#989898",
            transition: "all 225ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
            borderRadius: "21px"
        },
        "& .MuiTab-fullWidth:hover": {
            backgroundColor: "rgba(255,255,255,0.06)"
        },
        "& span.MuiTabs-indicator": {
            zIndex: "-1",
            height: "48px",
            backgroundColor: "#c7c7c7",
            borderRadius: "21px",
            transform: "scale3d(0.875, 0.75, 1)"
        },
        margin: "8px 16px 0px 16px",
        width: "calc(100% - 32px)",
        borderRadius: "21px",
        top: 0,
        left: 0,
        zIndex: 1,
        transition: "transform 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
    },
    titleUser: {
        alignSelf: "center",
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#888888",
        whiteSpace: "nowrap",
        [theme.breakpoints.down("xs")]: { display: "none" },
    },
    darkGreyDialog: { backgroundColor: "#000 !important" },
    keySection: { marginBottom: "24px", padding: "16px", backgroundColor: "#101010", borderRadius: "21px" },
    keySectionGrid: {
        display: "grid", gridTemplateColumns: "1fr 280px", gap: "24px",
        "@media (max-width:768px)": { gridTemplateColumns: "1fr", gap: "16px" },
    },
    keySectionLeft: { display: "flex", flexDirection: "column" },
    keySectionRight: { "@media (max-width:768px)": { display: "none" } },
    keyTitleRow: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", "& svg": { fontSize: "20px", color: "#888" } },
    keyTitleMobile: {
        display: "none",
        "@media (max-width:768px)": { display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", "& svg": { fontSize: "20px", color: "#888" } },
    },
    mobileInfoIcon: {
        display: "none",
        "@media (max-width:768px)": { display: "inline-flex" },
        "& .MuiIconButton-root": { color: "#fff", padding: "4px" },
    },
    keyDescription: { color: "#9b9b9b", fontSize: "14px", lineHeight: "1.5", marginBottom: "12px" },
    keyInput: {
        marginBottom: "12px", marginTop: "12px",
        "& .MuiOutlinedInput-root": { backgroundColor: "#111" },
        "& .MuiOutlinedInput-input": { fontFamily: "monospace", fontSize: "13px" },
    },
    publicKeyInput: {
        marginBottom: "12px", marginTop: "12px",
        "& .MuiOutlinedInput-root": { backgroundColor: "#0a0a0a" },
        "& .MuiOutlinedInput-input": { fontFamily: "monospace", fontSize: "12px", color: "#888" },
    },
    permissionsTitle: { color: "#fff", fontSize: "14px", fontWeight: 600, marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" },
    permissionsSubtitle: { color: "#aaa", fontSize: "13px", marginBottom: "8px" },
    permissionsList: { margin: "0", paddingLeft: "20px", "& li": { color: "#888", fontSize: "13px", lineHeight: "1.8" } },
    inputEndAdornment: { "& .MuiIconButton-root": { color: "#7b7b7b" }, "& .MuiIconButton-root:hover": { color: "#fff" } },
    divider: { backgroundColor: "#333", margin: "24px 0" },
    sectionTitle: { color: "#fff", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" },
    backdrop: { zIndex: "1301", color: "#fff" },
    buttonNotDisabled: { "&.MuiButtonBase-root.Mui-disabled": { cursor: "help", pointerEvents: "all" } },
    generateSection: { backgroundColor: "#101010", borderRadius: "21px", padding: "16px", marginTop: "16px" },
    tooltipRoot: { maxWidth: "min(75vw, 500px)", borderRadius: "16px", backgroundColor: "#dddddd !important", color: "#0e0e0e !important" },
    tooltipContent: { padding: "8px", "& ul": { margin: "8px 0 0 0", paddingLeft: "20px" }, "& li": { fontSize: "13px", lineHeight: "1.6" } },
    whiteButton: {
        "&.MuiButton-contained": { backgroundColor: "#d0d0d0", color: "#151515", transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms" },
        "&.MuiButton-contained:hover": { backgroundColor: "#ffffff", color: "#000000" },
        "&.MuiButton-contained.Mui-disabled": { opacity: 0.35 },
    },
    revealButton: {
        marginTop: "8px",
        fontSize: "12px",
        color: "#888",
        "&:hover": { color: "#fff" },
    },
    recoveryPopper: { backgroundColor: "#242424ff !important" },
    recoveryWarning: {
        backgroundColor: "#1c1c1c",
        borderRadius: "10px",
        padding: "10px 14px",
        margin: "8px 0px 16px 0px",
        color: "#e0e0e0",
        fontSize: "13px",
        lineHeight: "1.5",
    },
    recoveryPendingBox: {
        backgroundColor: "#161616",
        borderRadius: "10px",
        padding: "10px 14px",
        margin: "8px 0px 16px 0px",
        color: "#bdbdbd",
        fontSize: "13px",
        lineHeight: "1.5",
    },
    recoveryCurrentBox: {
        backgroundColor: "#101010",
        borderRadius: "10px",
        padding: "10px 14px",
        margin: "0px 0px 12px 0px",
        color: "#9a9a9a",
        fontSize: "13px",
    },
});

// ─────────────────────────────────────────────────────────────────────────────
const KEY_CONFIG = {
    posting: {
        title: "Posting Key",
        descriptionKeys: ["posting_description_1", "posting_description_2"],
        permissionKeys: ["perm_publish_a_post_or_comment", "perm_edit_a_post_or_comment", "perm_upvote_or_downvote", "perm_reblog_content", "perm_follow_people", "perm_mute_accounts"],
    },
    active: {
        title: "Active Key",
        descriptionKeys: ["active_description_1", "active_description_2"],
        permissionKeys: ["perm_transfer_tokens", "perm_power_pixa_up_or_down", "perm_token_conversion", "perm_vote_for_witnesses", "perm_place_an_order_on_an", "perm_certain_profile_changes", "perm_publish_a_witness_price_feed", "perm_create_a_new_user"],
    },
    owner: {
        title: "Owner Key",
        descriptionKeys: ["owner_description_1"],
        permissionKeys: ["perm_reset_owner_active_and_posting", "perm_recover_your_account", "perm_decline_voting_rights"],
    },
    memo: {
        title: "Memo Key",
        descriptionKeys: ["memo_description_1"],
        permissionKeys: ["perm_send_an_encrypted_message", "perm_view_an_encrypted_message"],
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Tabs — same visual treatment as AppInfoDialog (pill Tabs + SwipeableViews).
// The active tab drives the icon + title rendered atop the dialog.
// ─────────────────────────────────────────────────────────────────────────────
const TAB_CONFIG = [
    { titleKey: "tab_wallet_keys", icon: KeyIcon },
    { titleKey: "tab_account_recovery", icon: RestoreRounded },
    { titleKey: "tab_keys_update", icon: SecurityRounded },
];

// ─────────────────────────────────────────────────────────────────────────────
// Key Section — supports "unknown" state with Reveal button
// ─────────────────────────────────────────────────────────────────────────────
const KeySection = memo(function KeySection({ classes, keyType, keyValue, publicKeyValue, isAvailable, isVisible, onToggleVisibility, onCopyKey, onRevealKey, isOwnProfile }) {
    useLanguage();
    const config = KEY_CONFIG[keyType];
    const handleToggle = React.useCallback(() => onToggleVisibility(keyType), [keyType, onToggleVisibility]);
    const handleCopy = React.useCallback(() => onCopyKey(keyValue, config.title), [keyValue, config.title, onCopyKey]);
    const handleCopyPublic = React.useCallback(() => onCopyKey(publicKeyValue, `Public ${config.title}`), [publicKeyValue, config.title, onCopyKey]);
    const handleReveal = React.useCallback(() => onRevealKey(keyType), [keyType, onRevealKey]);

    const endAdornment = useMemo(() => {
        if (!isAvailable) {
            return (
                <InputAdornment position="end" className={classes.inputEndAdornment}>
                    <Tooltip title={t("components.pixa_wallet_keys_dialog.this_key_is_not_in_your_current")}>
                        <IconButton edge="end" onClick={handleReveal}><LockOpenRounded /></IconButton>
                    </Tooltip>
                </InputAdornment>
            );
        }
        return (
            <InputAdornment position="end" className={classes.inputEndAdornment}>
                <Tooltip title={t("components.pixa_wallet_keys_dialog.copy_to_clipboard")}><IconButton edge="end" onClick={handleCopy} size="small"><FileCopyOutlined fontSize="small" /></IconButton></Tooltip>
                <Tooltip title={isVisible ? t("components.pixa_wallet_keys_dialog.hide_key") : t("components.pixa_wallet_keys_dialog.reveal_key")}><IconButton edge="end" onClick={handleToggle}>{isVisible ? <Visibility /> : <VisibilityOff />}</IconButton></Tooltip>
            </InputAdornment>
        );
    }, [classes, isAvailable, isVisible, handleToggle, handleCopy, handleReveal]);

    const publicKeyEndAdornment = useMemo(() => (
        <InputAdornment position="end" className={classes.inputEndAdornment}>
            <Tooltip title={t("components.pixa_wallet_keys_dialog.copy_public_key")}><IconButton edge="end" onClick={handleCopyPublic} size="small"><FileCopyOutlined fontSize="small" /></IconButton></Tooltip>
        </InputAdornment>
    ), [classes, handleCopyPublic]);

    const tooltipContent = useMemo(() => (
        <span className={classes.tooltipContent}>
            <T k="components.pixa_wallet_keys_dialog.permissions_use_your_key_to" vars={{ title: config.title }} />
            <ul>{config.permissionKeys.map((p, i) => <li key={i}>{t("components.pixa_wallet_keys_dialog." + p)}</li>)}</ul>
        </span>
    ), [classes, config]);

    const displayValue = useMemo(() => {
        if (!isAvailable) return t("components.pixa_wallet_keys_dialog.unknown_not_in_current_session");
        if (!isVisible) return "••••••••••••••••••••••••••••••••••••••••••••••••••••";
        return keyValue;
    }, [keyValue, isAvailable, isVisible]);

    return (
        <div className={classes.keySection}>
            <div className={classes.keySectionGrid}>
                <div className={classes.keySectionLeft}>
                    <div className={classes.keyTitleMobile}>
                        <KeyIcon /><Typography variant="h6" component="h3" style={{ flex: 1 }}>{config.title}</Typography>
                        <span className={classes.mobileInfoIcon}><Tooltip interactive enterTouchDelay={200} leaveTouchDelay={4000} classes={{ tooltip: classes.tooltipRoot }} title={tooltipContent}><IconButton><InfoOutlined /></IconButton></Tooltip></span>
                    </div>
                    {config.descriptionKeys.map((desc, idx) => <Typography key={idx} className={classes.keyDescription} component="p">{t("components.pixa_wallet_keys_dialog." + desc)}</Typography>)}
                    {isOwnProfile !== false && <FormControl fullWidth variant="outlined" className={classes.keyInput}>
                        <InputLabel htmlFor={`key-input-${keyType}`}>{t("components.pixa_wallet_keys_dialog.private", {
                                title: config.title
                            })}</InputLabel>
                        <OutlinedInput
                            id={`key-input-${keyType}`}
                            type="text"
                            value={displayValue}
                            readOnly
                            endAdornment={endAdornment}
                            labelWidth={keyType === "posting" ? 120 : keyType === "active" ? 110 : keyType === "owner" ? 110 : 105}
                            style={!isAvailable ? { opacity: 0.5, fontStyle: "italic" } : undefined}
                        />
                    </FormControl>}
                    <FormControl fullWidth variant="outlined" className={classes.publicKeyInput}>
                        <InputLabel htmlFor={`public-key-input-${keyType}`}>{t("components.pixa_wallet_keys_dialog.public", {
                                title: config.title
                            })}</InputLabel>
                        <OutlinedInput disabled={true} id={`public-key-input-${keyType}`} type="text" value={publicKeyValue || t("components.pixa_wallet_keys_dialog.not_available")} readOnly endAdornment={publicKeyEndAdornment} labelWidth={keyType === "posting" ? 115 : keyType === "active" ? 105 : keyType === "owner" ? 105 : 100} />
                    </FormControl>
                </div>
                <div className={classes.keySectionRight}>
                    <div className={classes.permissionsTitle}><KeyIcon />{config.title}</div>
                    <Typography className={classes.permissionsSubtitle}>{t("components.pixa_wallet_keys_dialog.use_your_to", {
                            title: config.title
                        })}</Typography>
                    <ul className={classes.permissionsList}>{config.permissionKeys.map((p, i) => <li key={i}>{t("components.pixa_wallet_keys_dialog." + p)}</li>)}</ul>
                </div>
            </div>
        </div>
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Dialog
// ─────────────────────────────────────────────────────────────────────────────
class PixaWalletKeysDialog extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            classes: props.classes, keepMounted: props.keepMounted || false, open: props.open,
            _tab_value: 0,
            username: (props.account || {}).username || (props.account || {}).name || props.username || "",
            keys: { posting: "", active: "", owner: "", memo: "" },
            publicKeys: { posting: "", active: "", owner: "", memo: "" },
            _keyVisibility: { posting: false, active: false, owner: false, memo: false },
            _seed: [], _seed_menu_anchor: null,
            _seed_word_input: "", _seed_word_suggestion: [],
            _password: "", _showPassword: true,
            _backdropOpened: false, _downloaded: false, _applying: false,
            _newPublicKeys: { owner: "", active: "", posting: "", memo: "" },
            _newPrivateKeys: { owner: "", active: "", posting: "", memo: "" },
            // Single-step backup acknowledgement (matches CreateAccountDialog's
            // "you must download before continuing" pattern). User must (a) click
            // the DOWNLOAD button — which sets _downloaded — and (b) tick the
            // "I downloaded the document" checkbox before Step 3 unlocks.
            _documentAcknowledged: false,
            _fullscreen: (window.innerWidth || document.documentElement.clientWidth || (document.body || document.getElementsByTagName('body')[0]).clientWidth) <= 960,
            _isOwnProfile: props.isOwnProfile !== false,
            // ── Recovery Account ──────────────────────────────────────────
            // _currentRecovery: the recovery_account currently in effect on chain.
            // _pendingRecovery: a pending change request (if any), with effective_on ts.
            // _recoveryInput / _recoveryAuthors / _recoverySelected: autocomplete state
            //   matching the pattern used in PixaWalletDelegateDialog.
            // _recovery_loading is set during the broadcast itself; it is intentionally
            //   distinct from _applying so the two flows don't interfere.
            _currentRecovery: "",
            _pendingRecovery: null,
            _recoveryInput: "",
            _recoveryAuthors: [],
            _recoverySelected: null,
            _recoverySearching: false,
            _recovery_loading: false,
            _recovery_confirm_open: false,
            _recovery_error: "",
        };
        this._recoverySearchTimer = null;
        this._recoveryProfileCache = {};
    }

    componentDidMount() { window.addEventListener("resize", this._computeSize); this._load_keys(); this._load_recovery(); }

    /**
     * Silently load keys via getWalletKeys.
     * Only returns keys already in session/vault cache — never prompts.
     */
    _load_keys = async () => {
        const { api, account } = this.props;
        const username = (account || {}).username || (account || {}).name || this.state.username;
        if (!username || !api) return;
        try {
            const result = await api.getWalletKeys(username);
            this.setState({
                keys: { ...this.state.keys, ...result.privateKeys },
                publicKeys: { ...this.state.publicKeys, ...result.publicKeys },
                username,
            }, () => this.forceUpdate());
        } catch (e) { console.warn('[PixaWalletKeysDialog] _load_keys error:', e); }
    };

    /**
     * Load the account's current recovery_account and any pending change request.
     * Two reads:
     *   1. accounts.getAccounts → object.recovery_account (the value in effect now)
     *   2. database.findChangeRecoveryAccountRequests → pending request, if any,
     *      with effective_on (UTC ISO timestamp 30 days after the broadcast).
     * These are independent calls; we run them in parallel and ignore failures
     * individually so a missing pending-request endpoint doesn't break the
     * current-recovery display.
     */
    _load_recovery = async () => {
        const { api, account } = this.props;
        const username = (account || {}).username || (account || {}).name || this.state.username;
        if (!username || !api) return;
        try {
            const [accs, pendingList] = await Promise.all([
                api.accounts && api.accounts.getAccounts ? api.accounts.getAccounts([username]).catch(() => []) : Promise.resolve([]),
                api.database && api.database.findChangeRecoveryAccountRequests ? api.database.findChangeRecoveryAccountRequests([username]).catch(() => []) : Promise.resolve([]),
            ]);
            const acc = (accs && accs[0]) || null;
            const currentRecovery = acc ? (acc.recovery_account || '') : '';
            // Pending request shape (HIVE/STEEM): { account_to_recover, recovery_account, effective_on }
            const pending = (Array.isArray(pendingList) ? pendingList : [])
                .find(r => r && (r.account_to_recover === username || r.account === username)) || null;
            this.setState({
                _currentRecovery: currentRecovery,
                _pendingRecovery: pending,
            }, () => this.forceUpdate());
        } catch (e) {
            console.warn('[PixaWalletKeysDialog] _load_recovery error:', e);
        }
    };

    /**
     * Request a specific key type on demand (prompting).
     * Called when user clicks the "Reveal" button on an unknown key.
     * Uses requestKey which will trigger PIN/key-entry dialog if needed.
     */
    _revealKey = async (keyType) => {
        const { api } = this.props;
        const { username } = this.state;
        if (!api || !api.keyManager || !username) return;
        try {
            const key = await api.keyManager.requestKey(username, keyType);
            if (key) {
                this.setState((prev) => ({
                    keys: { ...prev.keys, [keyType]: key },
                }), () => this.forceUpdate());
            }
        } catch (e) {
            console.warn(`[PixaWalletKeysDialog] _revealKey(${keyType}) cancelled or failed:`, e.message);
        }
    };

    componentWillUnmount() {
        clearTimeout(this._clipboardTimer);
        window.removeEventListener("resize", this._computeSize);
        if (this._recoverySearchTimer) clearTimeout(this._recoverySearchTimer);
    }

    _computeSize = () => {
        const fullscreen = (window.innerWidth || document.documentElement.clientWidth || (document.body || document.getElementsByTagName('body')[0]).clientWidth) <= 960;
        if (this.state._fullscreen !== fullscreen) this.setState({ _fullscreen: fullscreen }, () => this.forceUpdate());
    };

    _handleTabChange = (e, value) => {
        this.setState({ _tab_value: value }, () => {
            this.swipeableViewScrollTop();
            this.forceUpdate();
        });
    };

    swipeableViewScrollTop = () => {
        // Same approach as AppInfoDialog: reset the slides' scroll position on
        // tab change. Every slide is reset (not just the first) so a
        // previously-scrolled tab reopens at its top.
        const views = document.getElementsByClassName("react-swipeable-view-container");
        for (let i = 0; i < views.length; i++) {
            const children = views.item(i).children;
            for (let j = 0; j < children.length; j++) {
                const child = children.item(j);
                if (!child) continue;
                child.style.scrollBehavior = "smooth";
                child.scrollTop = 0;
            }
        }
    };

    componentWillReceiveProps(new_props) {
        const wasOpen = this.state.open;
        const updates = { ...new_props };
        if (new_props.account && (new_props.account.username || new_props.account.name)) updates.username = new_props.account.username || new_props.account.name;
        if (new_props.isOwnProfile !== undefined) updates._isOwnProfile = new_props.isOwnProfile !== false;

        // Reset on close
        if (!new_props.open && wasOpen) {
            updates._tab_value = 0;
            updates._keyVisibility = { posting: false, active: false, owner: false, memo: false };
            updates._seed = [];
            updates._seed_word_input = "";
            updates._seed_word_suggestion = [];
            updates._password = "";
            updates._downloaded = false;
            updates._newPublicKeys = { owner: "", active: "", posting: "", memo: "" };
            updates._newPrivateKeys = { owner: "", active: "", posting: "", memo: "" };
            updates._documentAcknowledged = false;
            // Recovery account fields — reset draft, keep nothing in flight
            updates._recoveryInput = "";
            updates._recoveryAuthors = [];
            updates._recoverySelected = null;
            updates._recoverySearching = false;
            updates._recovery_loading = false;
            updates._recovery_confirm_open = false;
            updates._recovery_error = "";
        }

        this.setState(updates, () => {
            this.forceUpdate();
            if (new_props.open && !wasOpen) {
                this._load_keys();
                this._load_recovery();
            }
        });
    }

    _toggleKeyVisibility = (keyType) => { this.setState((prev) => ({ _keyVisibility: { ...prev._keyVisibility, [keyType]: !prev._keyVisibility[keyType] } }), () => this.forceUpdate()); };
    /**
     * Copying a private key puts it on the system clipboard, where every other
     * application can read it, clipboard managers capture it, and Windows
     * Clipboard History / macOS Universal Clipboard / Gboard sync it OFF the
     * device. It then persists until something else overwrites it.
     *
     * So: warn, and schedule an overwrite. The overwrite is best-effort — it
     * cannot reach a value already synced elsewhere — but it bounds the window
     * on this machine from "forever" to CLIPBOARD_CLEAR_MS.
     */
    _copyKey = (keyValue, keyName) => {
        if (!keyValue || !navigator.clipboard) return;
        navigator.clipboard.writeText(keyValue).then(() => {
            if (actions?.trigger_snackbar) {
                actions.trigger_snackbar(
                    t("components.pixa_wallet_keys_dialog.private_key_on_clipboard_warning"), "error");
            }
            clearTimeout(this._clipboardTimer);
            this._clipboardTimer = setTimeout(() => {
                navigator.clipboard.writeText(" ").catch(() => {});
            }, CLIPBOARD_CLEAR_MS);
        }).catch(() => {
            if (actions?.trigger_snackbar) {
                actions.trigger_snackbar(t("components.pixa_wallet_keys_dialog.could_not_copy"), "error");
            }
        });
    };

    // Suggestions search the UI language's wordlist; getWordsPossible merges
    // in English matches (all pre-multilanguage seeds are English) and always
    // ranks an exact hit first, so _before_seed_word_add keeps working for
    // legacy seeds on any UI language.
    _set_suggestion = async () => {
        const { _seed_word_input } = this.state;
        if (_seed_word_input.length < 1) { this.setState({ _seed_word_suggestion: [] }, () => this.forceUpdate()); }
        else { const s = await getWordsPossible(_seed_word_input, getLanguage(), 5); this.setState({ _seed_word_suggestion: s }, () => this.forceUpdate()); }
    };

    _before_seed_word_add = () => { const { _seed_word_suggestion, _seed_word_input } = this.state; return (_seed_word_suggestion[0] || "") === _seed_word_input; };
    _on_seed_input = (input) => { this.setState({ _seed_word_input: input }, () => this._set_suggestion()); };
    // Any mutation of seed or password invalidates any prior download:
    // the PDF was generated for *those* inputs, and applying afterwards
    // would broadcast keys derived from different inputs than what the
    // user backed up. Reset both the download flag and the acknowledgement
    // so the user has to re-tick to re-download.
    _add_within_seed = (e) => { this.setState({ _seed: this.state._seed.concat(e), _downloaded: false, _documentAcknowledged: false }, () => this.forceUpdate()); };
    _delete_within_seed = (e) => { this.setState({ _seed: this.state._seed.filter((w) => e.indexOf(w) === -1), _downloaded: false, _documentAcknowledged: false }, () => this.forceUpdate()); };
    _set_seed_phrase_anchor = (target) => { this.setState({ _seed_menu_anchor: target }, () => this.forceUpdate()); };

    _generate_new_seed = async (entropy) => {
        const counts = { 128: 12, 160: 15, 192: 18, 224: 21, 256: 24 };
        // Wordlist follows the active UI language (English fallback).
        const _seed = await generateMnemonic(counts[entropy] || 18, getLanguage());
        this.setState({ _seed, _downloaded: false, _documentAcknowledged: false }, () => this.forceUpdate());
    };

    _handlePasswordChange = (e) => { this.setState({ _password: e.target.value.toString(), _downloaded: false, _documentAcknowledged: false }, () => this.forceUpdate()); };
    _handleClickShowPassword = () => { this.setState({ _showPassword: !this.state._showPassword }, () => this.forceUpdate()); };
    _handleMouseDownPassword = (event) => { event.preventDefault(); };

    // The checkbox IS the download trigger (per the dialog's "checkbox is a
    // download button" spec). Ticking it kicks off PDF generation; the box
    // can only be ticked when the seed is a valid mnemonic length. Apply
    // becomes enabled once _generate_and_download_sprout sets _downloaded.
    // Re-ticking after a successful download does not re-download — the user
    // can untick and re-tick if they want a fresh copy.
    _handleDocumentAcknowledged = (event) => {
        const { checked } = event.target;
        const wasDownloaded = this.state._downloaded;
        this.setState({ _documentAcknowledged: checked }, () => {
            if (checked && !wasDownloaded) {
                this._generate_and_download_sprout();
            } else {
                this.forceUpdate();
            }
        });
    };

    _generate_and_download_sprout = async () => {
        const callback = async () => {
            const { username, _seed, _password } = this.state;
            const masterKey = await generateMasterKey(_seed, _password);
            const [blob, keys] = await generatePDF(username, _seed, _password, masterKey);
            const url = URL.createObjectURL(blob);
            let a = document.createElement("a"); a.download = `KeysOf-${username}-Pixagram.pdf`; a.href = url; a.click(); a.remove();
            // Revoking on the same tick as click() cancels the download in
            // Firefox. This blob is the key-backup PDF, so the failure mode is
            // "user believes their keys are backed up and they are not".
            setTimeout(() => URL.revokeObjectURL(url), 2000);
            this.setState({ _newPublicKeys: keys.pub, _newPrivateKeys: keys.priv, _downloaded: true, _backdropOpened: false }, () => this.forceUpdate());
        };
        this.setState({ _backdropOpened: true }, () => { this.forceUpdate(() => { setTimeout(callback, 500); }); });
    };

    /**
     * Apply new keys. Owner key is requested HERE (via updateAccount2 → requestKey('owner')),
     * which will trigger the PIN/key-entry dialog only at this point.
     */
    _applyNewKeys = async () => {
        const { api } = this.props;
        const { username, _newPublicKeys } = this.state;
        if (!api || !username || !_newPublicKeys.owner) return;

        // Two-phase loading: prompt for the owner key BEFORE raising the
        // backdrop, otherwise the backdrop (zIndex 1301) covers the
        // keyManager's PIN/key-entry modal and the user can't authenticate.
        // After the key is unlocked and cached in-session, the broadcast
        // method's internal requestKey call is a cache hit (no second prompt).
        this.setState({ _applying: true }, () => this.forceUpdate());
        try {
            if (api.keyManager && typeof api.keyManager.requestKey === 'function') {
                await api.keyManager.requestKey(username, 'owner');
            }
        } catch (err) {
            // User cancelled or entered an invalid key. Clear the applying
            // flag so the button becomes clickable again, but stay on the
            // confirm step so they can retry.
            console.warn('[PixaWalletKeysDialog] owner key prompt cancelled:', err);
            this.setState({ _applying: false }, () => this.forceUpdate());
            return;
        }

        this.setState({ _backdropOpened: true }, () => this.forceUpdate());
        try {
            const makeAuth = (pubKey) => ({ weight_threshold: 1, account_auths: [], key_auths: [[pubKey, 1]] });
            await api.broadcast.updateAccount2({
                account: username,
                auth: {
                    owner: makeAuth(_newPublicKeys.owner),
                    active: makeAuth(_newPublicKeys.active),
                    posting: makeAuth(_newPublicKeys.posting),
                    memo_key: _newPublicKeys.memo,
                },
            });
            // Keys applied successfully — logout and redirect to homepage
            this.setState({ _backdropOpened: false, _applying: false }, async () => {
                this.forceUpdate();
                try {
                    if (api.logout) await api.logout();
                } catch (e) { console.warn('[PixaWalletKeysDialog] logout error:', e); }
                if (this.props.onClose) this.props.onClose();
                window.location.href = '/';
            });
        } catch (err) {
            console.warn('[PixaWalletKeysDialog] _applyNewKeys error:', err);
            this.setState({ _backdropOpened: false, _applying: false }, () => this.forceUpdate());
        }
    };

    // ────────────────────────────────────────────────────────────────────────
    // Recovery Account
    // ────────────────────────────────────────────────────────────────────────
    //
    // change_recovery_account is owner-key signed and creates a *pending*
    // request that takes effect 30 days after broadcast. During the wait
    // window, broadcasting again with a different value replaces the pending
    // request; broadcasting with the *current* recovery account cancels it.
    //
    // The autocomplete plumbing here mirrors PixaWalletDelegateDialog so that
    // behaviour stays consistent across the wallet.

    _normalizeRecoveryAuthor = (acc) => {
        if (!acc) return null;
        const username = acc.username || acc.name || '';
        if (!username) return null;
        if (this._recoveryProfileCache[username]) return this._recoveryProfileCache[username];
        const entry = {
            username,
            image: acc.image || (acc._profile && acc._profile.profile_image) || '',
            name: acc.display_name || (acc._profile && acc._profile.display_name) || username,
        };
        this._recoveryProfileCache[username] = entry;
        return entry;
    };

    _onRecoveryInputChange = (event, newInputValue) => {
        const input = (newInputValue || '').toLowerCase().replace(/^@/, '').trim();
        this.setState({ _recoveryInput: input, _recovery_error: "" }, () => this.forceUpdate());
        if (this._recoverySearchTimer) clearTimeout(this._recoverySearchTimer);
        if (!input) {
            this.setState({ _recoveryAuthors: [], _recoverySearching: false, _recoverySelected: null }, () => this.forceUpdate());
            return;
        }
        if (this._recoveryProfileCache[input]) {
            this.setState({ _recoverySelected: this._recoveryProfileCache[input] });
        }
        this._recoverySearchTimer = setTimeout(() => this._searchRecoveryAccounts(input), 280);
    };

    _searchRecoveryAccounts = async (input) => {
        const { api } = this.props;
        if (!api || !api.accounts) return;
        this.setState({ _recoverySearching: true }, () => this.forceUpdate());
        try {
            const names = await api.accounts.lookupAccounts(input, 7);
            if (!Array.isArray(names) || names.length === 0) {
                this.setState({ _recoveryAuthors: [], _recoverySearching: false, _recoverySelected: null }, () => this.forceUpdate());
                return;
            }
            const accounts = await api.accounts.getAccounts(names);
            const authors = (accounts || []).map(a => this._normalizeRecoveryAuthor(a)).filter(Boolean);
            const exactMatch = authors.find(a => a.username === this.state._recoveryInput) || null;
            this.setState({
                _recoveryAuthors: authors,
                _recoverySearching: false,
                _recoverySelected: exactMatch || this.state._recoverySelected,
            }, () => this.forceUpdate());
        } catch (e) {
            this.setState({ _recoverySearching: false }, () => this.forceUpdate());
        }
    };

    _onRecoveryAutocompleteChange = (event, value) => {
        if (value && typeof value === 'object' && value.username) {
            this.setState({ _recoveryInput: value.username, _recoverySelected: value, _recovery_error: "" }, () => this.forceUpdate());
        } else if (typeof value === 'string') {
            const resolved = this._recoveryProfileCache[value] || null;
            this.setState({ _recoveryInput: value, _recoverySelected: resolved, _recovery_error: "" }, () => this.forceUpdate());
        }
    };

    _open_recovery_confirm = () => {
        const { _recoveryInput, _currentRecovery, username } = this.state;
        // Local validation before opening confirm dialog
        if (!_recoveryInput) {
            this.setState({ _recovery_error: t("components.pixa_wallet_keys_dialog.please_choose_a_recovery_account") }, () => this.forceUpdate());
            return;
        }
        if (_recoveryInput === username) {
            this.setState({ _recovery_error: t("components.pixa_wallet_keys_dialog.you_cannot_set_your_own_account") }, () => this.forceUpdate());
            return;
        }
        if (_recoveryInput === _currentRecovery) {
            this.setState({ _recovery_error: t("components.pixa_wallet_keys_dialog.this_is_already_your_current_recovery") }, () => this.forceUpdate());
            return;
        }
        this.setState({ _recovery_confirm_open: true, _recovery_error: "" }, () => this.forceUpdate());
    };

    _close_recovery_confirm = () => {
        this.setState({ _recovery_confirm_open: false }, () => this.forceUpdate());
    };

    _confirm_recovery_change = async () => {
        const { api } = this.props;
        const { username, _recoveryInput } = this.state;
        if (!api || !api.broadcast || !username || !_recoveryInput) return;

        // Resolve the chosen account one more time before broadcast — guards
        // against a typed-but-never-resolved username that doesn't actually
        // exist on chain (the chain would reject the op anyway, but better UX
        // to surface it before prompting for the owner key).
        try {
            const accs = await api.accounts.getAccounts([_recoveryInput]);
            if (!accs || !accs[0]) {
                this.setState({ _recovery_error: t("components.pixa_wallet_keys_dialog.account_does_not_exist", {
                    _recoveryInput: _recoveryInput
                }), _recovery_confirm_open: false }, () => this.forceUpdate());
                return;
            }
        } catch (e) {
            // If lookup itself failed, surface and bail; safer than broadcasting blind.
            this.setState({ _recovery_error: t("components.pixa_wallet_keys_dialog.could_not_verify_the_recovery_account"), _recovery_confirm_open: false }, () => this.forceUpdate());
            return;
        }

        // ── Two-phase loading flow ──────────────────────────────────────
        // 1. Request the owner key explicitly *before* showing the backdrop.
        //    keyManager.requestKey opens its own PIN/key-entry modal; if we
        //    raise the dark backdrop first, it sits on top of that modal
        //    (the backdrop has zIndex 1301, intentionally high to cover the
        //    main dialog) and the user can't see or interact with the prompt.
        // 2. Once the key is resolved (and cached in-session by the key
        //    manager), *then* show the backdrop with the broadcasting
        //    spinner and call the broadcast method, which will reuse the
        //    cached key without prompting again.
        this.setState({ _recovery_error: "" }, () => this.forceUpdate());
        try {
            if (api.keyManager && typeof api.keyManager.requestKey === 'function') {
                await api.keyManager.requestKey(username, 'owner');
            }
        } catch (err) {
            // User dismissed the prompt or entered an invalid key. Stay in
            // the confirm dialog so they can retry without losing the typed
            // recipient.
            console.warn('[PixaWalletKeysDialog] owner key prompt cancelled:', err);
            this.setState({
                _recovery_loading: false,
                _recovery_error: t("components.pixa_wallet_keys_dialog.owner_key_required_to_change_recovery"),
            }, () => this.forceUpdate());
            return;
        }

        this.setState({ _recovery_loading: true, _backdropOpened: true }, () => this.forceUpdate());
        try {
            await api.broadcast.changeRecoveryAccount(username, _recoveryInput);
            // Refresh both the current value (unchanged for 30 days) and the
            // pending-request list so the UI reflects the new pending state.
            await this._load_recovery();
            this.setState({
                _recovery_loading: false,
                _backdropOpened: false,
                _recovery_confirm_open: false,
                _recoveryInput: "",
                _recoverySelected: null,
                _recoveryAuthors: [],
            }, () => this.forceUpdate());
        } catch (err) {
            console.warn('[PixaWalletKeysDialog] _confirm_recovery_change error:', err);
            this.setState({
                _recovery_loading: false,
                _backdropOpened: false,
                _recovery_confirm_open: false,
                _recovery_error: t("components.pixa_wallet_keys_dialog.could_not_change_recovery_account", { message: (err && err.message ? err.message : t("components.pixa_wallet_dialog.unknown_error")) }),
            }, () => this.forceUpdate());
        }
    };

    _cancel_pending_recovery = () => {
        // Cancelling a pending change is just broadcasting another
        // change_recovery_account that resets the value to the current effective
        // recovery account. Pre-fill the input and surface the confirm dialog.
        const { _currentRecovery } = this.state;
        if (!_currentRecovery) return;
        this.setState({
            _recoveryInput: _currentRecovery,
            _recoverySelected: this._recoveryProfileCache[_currentRecovery] || { username: _currentRecovery, name: _currentRecovery, image: '' },
            _recovery_confirm_open: true,
            _recovery_error: "",
        }, () => this.forceUpdate());
    };

    render() {
        const { classes, open, _fullscreen, _isOwnProfile, _tab_value, username, keys, publicKeys, _keyVisibility, _seed, _seed_menu_anchor, _seed_word_input, _seed_word_suggestion, _password, _showPassword, _documentAcknowledged, _backdropOpened, _applying, _downloaded,
            _currentRecovery, _pendingRecovery, _recoveryInput, _recoveryAuthors, _recoverySelected, _recoverySearching,
            _recovery_loading, _recovery_confirm_open, _recovery_error,
        } = this.state;
        // Apply Keys unlocks once the user has both downloaded the document AND
        // ticked the acknowledgement checkbox. Ticking implies downloading via
        // _handleDocumentAcknowledged, but the user can untick to revoke, so
        // we still check both.
        const backupAcknowledged = _downloaded && _documentAcknowledged;
        const hasSeed = [12, 15, 18, 21, 24].indexOf(_seed.length) !== -1;

        // Recovery account derived display values
        const recoveryResolvedImage = (_recoverySelected && _recoverySelected.username === _recoveryInput) ? _recoverySelected.image : '';
        const recoveryEffectiveOn = _pendingRecovery
            ? (_pendingRecovery.effective_on || _pendingRecovery.effective_at || '')
            : '';
        const recoveryDaysRemaining = recoveryEffectiveOn
            ? Math.max(0, Math.ceil((new Date(recoveryEffectiveOn + (recoveryEffectiveOn.endsWith('Z') ? '' : 'Z')).getTime() - Date.now()) / 86400000))
            : null;
        const recoverySubmitDisabled = !_recoveryInput || _recoveryInput === username || _recoveryInput === _currentRecovery || _recovery_loading;

        // ── Tabs ─────────────────────────────────────────────────────────────
        // Clamp for safety; non-own profiles only ever see tab 0 (keys), since
        // recovery + key update are owner-only flows.
        const tabValue = _isOwnProfile ? Math.min(Math.max(_tab_value || 0, 0), TAB_CONFIG.length - 1) : 0;
        const activeTab = TAB_CONFIG[tabValue] || TAB_CONFIG[0];
        const TitleIcon = activeTab.icon;
        const keysView = ['posting', 'active', 'owner', 'memo'].map((kt) => (
            <KeySection
                key={kt}
                classes={classes}
                keyType={kt}
                keyValue={keys[kt]}
                publicKeyValue={publicKeys[kt]}
                isAvailable={!!keys[kt]}
                isVisible={_keyVisibility[kt]}
                onToggleVisibility={this._toggleKeyVisibility}
                onCopyKey={this._copyKey}
                onRevealKey={this._revealKey}
                isOwnProfile={_isOwnProfile}
            />
        ));

        return (
            <React.Fragment>
                <Dialog className={classes.dialog} open={open} fullScreen={_fullscreen} fullWidth={true} maxWidth="md" disablePortal={false} onClose={this.props.onClose} keepMounted={false} PaperProps={{ classes: { root: classes.darkGreyDialog } }}>
                    {/* ── Icon + title atop — mirrors AppInfoDialog's header, driven by
                        the active tab. The @username tag keeps the account context the
                        old static title carried. ── */}
                    <DialogTitle disableTypography style={{ display: "flex", alignItems: "center", margin: "0px 0px 16px 0px" }}>
                        <Typography component={"h1"} variant={"h4"} style={{ float: "left", width: "100%", margin: "0px", display: "flex", alignItems: "center", gap: "12px" }}>
                            <TitleIcon style={{ fontSize: 32 }} />
                            {t("components.pixa_wallet_keys_dialog." + activeTab.titleKey)}
                        </Typography>
                        {username ? <Typography component={"span"} className={classes.titleUser}>@{username}</Typography> : null}
                    </DialogTitle>

                    {/* ── Pill tabs, same treatment as AppInfoDialog. Hidden for
                        non-own profiles: recovery + key update are owner-only flows,
                        so the public view collapses to the keys list alone. ── */}
                    {_isOwnProfile && <Tabs
                        className={classes.cardTabs}
                        value={tabValue}
                        variant="fullWidth"
                        indicatorColor="primary"
                        textColor="primary"
                        onChange={this._handleTabChange}
                    >
                        <Tab icon={<KeyIcon />} aria-label={t("components.pixa_wallet_keys_dialog." + TAB_CONFIG[0].titleKey)} />
                        <Tab icon={<RestoreRounded />} aria-label={t("components.pixa_wallet_keys_dialog." + TAB_CONFIG[1].titleKey)} />
                        <Tab icon={<SecurityRounded />} aria-label={t("components.pixa_wallet_keys_dialog." + TAB_CONFIG[2].titleKey)} />
                    </Tabs>}

                    {_isOwnProfile ? <SwipeableViews
                        ignoreNativeScroll={true}
                        containerStyle={{ height: "100%" }}
                        animateHeight={false}
                        animateTransitions={true}
                        disableLazyLoading={true}
                        resistance={true}
                        springConfig={{ tension: 450, friction: 60, duration: '120ms', easeFunction: 'cubic-bezier(0.280, 0.840, 0.420, 1)', delay: '5ms' }}
                        index={tabValue}
                        onChangeIndex={(v) => this._handleTabChange({}, v)}
                        disabled={false}
                        key={"swipe-able-view"}
                    >
                        {/* ── Tab 0 — Wallet Keys ── */}
                        <DialogContent scroll={"paper"} className={classes.content} key={"tab-keys"}>
                            {keysView}
                        </DialogContent>

                        {/* ── Tab 1 — Account Recovery ───────────────────────────────────
                            A nominated trusted account that can initiate account recovery
                            if the owner key is lost or compromised. Changes go through a
                            30-day pending window before taking effect. Owner-key-only. */}
                        <DialogContent scroll={"paper"} className={classes.content} key={"tab-recovery"}>
                            <div className={classes.generateSection} style={{ marginTop: 0 }}>
                                <Typography style={{ color: "#9b9b9b", fontSize: "14px", marginBottom: "16px" }}>
                                    {t(
                                        "components.pixa_wallet_keys_dialog.nominate_a_trusted_account_a_co_founder"
                                    )}
                                </Typography>

                                <div className={classes.recoveryWarning}><T
                                        k="components.pixa_wallet_keys_dialog.strong_30_day_waiting_period_strong_changing" /></div>

                                <div className={classes.recoveryCurrentBox}>
                                    <span style={{ color: "#777" }}>{t("components.pixa_wallet_keys_dialog.current_recovery_account")} </span>
                                    <strong style={{ color: "#fff", fontFamily: "monospace" }}>
                                        {_currentRecovery ? `@${_currentRecovery}` : "— none configured —"}
                                    </strong>
                                </div>

                                {_pendingRecovery && (
                                    <div className={classes.recoveryPendingBox}>
                                        <strong>{t("components.pixa_wallet_keys_dialog.pending_change")}</strong>{' '}
                                        to <span style={{ fontFamily: "monospace" }}>@{_pendingRecovery.recovery_account}</span>
                                        {recoveryDaysRemaining !== null && (
                                            <><T
                                                    k="components.pixa_wallet_keys_dialog.effective_in_strong_strong_day"
                                                    vars={{ day: { day: recoveryDaysRemaining } }} /></>
                                        )}
                                        {recoveryEffectiveOn && (
                                            <> ({recoveryEffectiveOn.replace('T', ' ').replace(/\.\d+$/, '').replace(/Z$/, ' UTC')})</>
                                        )}
                                        <div style={{ marginTop: 8, textAlign: "right" }}>
                                            <Button variant="text" size="small" onClick={this._cancel_pending_recovery} style={{ color: "#bdbdbd" }}>
                                                {t("components.pixa_wallet_keys_dialog.cancel_pending_change")}
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                <Autocomplete
                                    classes={{ paper: classes.recoveryPopper }}
                                    options={_recoveryAuthors}
                                    getOptionLabel={(option) => typeof option === 'string' ? option : (option.username || '')}
                                    getOptionDisabled={(option) => option && option.username === username}
                                    filterOptions={(x) => x}
                                    inputValue={_recoveryInput}
                                    onChange={this._onRecoveryAutocompleteChange}
                                    onInputChange={this._onRecoveryInputChange}
                                    loading={_recoverySearching}
                                    loadingText={t("words.searching")}
                                    noOptionsText={_recoveryInput.length > 0 ? t("words.no_accounts_found") : t("words.type_a_username")}
                                    renderOption={(option) => {
                                        const isSelf = option.username === username;
                                        return (
                                            <div style={{ display: "flex", alignItems: "center", opacity: isSelf ? 0.4 : 1 }}>
                                                <Avatar src={option.image} alt={option.username} style={{ marginRight: 8, width: 32, height: 32, borderRadius: "8px" }} className={"pixelated"} />
                                                <div>
                                                    <strong>@{option.username}</strong>{isSelf ? <span style={{ color: "#888", fontWeight: "normal" }}> {t("words.you")}</span> : null}
                                                    <div style={{ fontSize: 12, color: "#888" }}>{option.name}</div>
                                                </div>
                                            </div>
                                        );
                                    }}
                                    freeSolo
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label={t("components.pixa_wallet_keys_dialog.new_recovery_account")}
                                            variant="outlined"
                                            fullWidth
                                            InputLabelProps={{ shrink: true }}
                                            InputProps={{
                                                ...params.InputProps,
                                                startAdornment: (
                                                    <React.Fragment>
                                                        <Avatar src={recoveryResolvedImage} style={{ width: 24, height: 24, marginRight: 6, borderRadius: "6px" }} className={"pixelated"} />
                                                        <span style={{ marginRight: -4, color: '#fff' }}>@</span>
                                                        {params.InputProps.startAdornment}
                                                    </React.Fragment>
                                                ),
                                                endAdornment: (
                                                    <React.Fragment>
                                                        {_recoverySearching ? <CircularProgress color="inherit" size={18} /> : null}
                                                        {params.InputProps.endAdornment}
                                                    </React.Fragment>
                                                ),
                                            }}
                                        />
                                    )}
                                    style={{ marginTop: 8, marginBottom: 8 }}
                                />

                                {_recovery_error && (
                                    <Typography style={{ fontSize: 12, color: "#cccccc", fontStyle: "italic", margin: "4px 4px 8px 4px" }}>{_recovery_error}</Typography>
                                )}

                                <Typography style={{ fontSize: 12, color: "#666", margin: "4px 4px 12px 4px" }}>
                                    {t(
                                        "components.pixa_wallet_keys_dialog.pick_someone_you_trust_personally_a_co"
                                    )} <strong style={{ color: "#fff" }}>{t("components.pixa_wallet_keys_dialog.owner_key_required")}</strong> {t("components.pixa_wallet_keys_dialog.to_broadcast")}
                                </Typography>

                                <div style={{ textAlign: "right" }}>
                                    <Tooltip title={recoverySubmitDisabled ? (
                                        !_recoveryInput ? t("components.pixa_wallet_keys_dialog.enter_a_recovery_account")
                                            : _recoveryInput === username ? t("components.pixa_wallet_keys_dialog.you_cannot_set_yourself")
                                                : _recoveryInput === _currentRecovery ? t("components.pixa_wallet_keys_dialog.same_as_current_recovery_account")
                                                    : t("components.pixa_wallet_keys_dialog.working")
                                    ) : ""} disableHoverListener={!recoverySubmitDisabled} disableFocusListener={!recoverySubmitDisabled} disableTouchListener={!recoverySubmitDisabled}>
                                    <span>
                                        <Button variant="contained" className={classes.whiteButton} onClick={this._open_recovery_confirm} disabled={recoverySubmitDisabled}>
                                            {_recovery_loading ? t("words.broadcasting", { TUC: true }) : t("components.pixa_wallet_keys_dialog.request_change", { TUC: true })}
                                        </Button>
                                    </span>
                                    </Tooltip>
                                </div>
                            </div>
                        </DialogContent>

                        {/* ── Tab 2 — Keys Update ────────────────────────────────────────
                            Single flat panel: generate a seed (ChipInput) + optional
                            password, tick the combined download-acknowledgement checkbox
                            (which triggers the PDF download), then apply. No seed words
                            are rendered outside the input itself. */}
                        <DialogContent scroll={"paper"} className={classes.content} key={"tab-update"}>
                            <div className={classes.generateSection} style={{ marginTop: 0 }}>
                                <Typography style={{ color: "#9b9b9b", fontSize: "14px", marginBottom: "16px" }}>
                                    {t(
                                        "components.pixa_wallet_keys_dialog.generate_a_fresh_seed_phrase_to_derive"
                                    )}
                                </Typography>

                                <ChipInput style={{ marginBottom: _seed_word_suggestion.length > 0 && _seed_word_input.length > 0 ? 8 : 16 }} fullWidth variant="outlined" label={t("components.pixa_wallet_keys_dialog.mnemonic_seed_phrase")} placeholder={_seed.length > 0 ? "" : t("components.pixa_wallet_keys_dialog.click_the_icon_to_generate_a")} value={_seed} inputProps={{ style: { minWidth: "64px" } }} onBeforeAdd={this._before_seed_word_add} onUpdateInput={(e) => this._on_seed_input(e.target.value)} onAdd={this._add_within_seed} onDelete={this._delete_within_seed}
                                           endAdornment={<Tooltip title={t("components.pixa_wallet_keys_dialog.click_to_generate_a_new_seed_phrase")}><InputAdornment style={{ position: "absolute", right: "16px", bottom: "24px" }} position="end" className={classes.inputEndAdornment}><IconButton edge="end" style={{ marginTop: -8 }} onClick={(e) => this._set_seed_phrase_anchor(e.currentTarget)}><SeedPlus /></IconButton></InputAdornment></Tooltip>}
                                />
                                <Collapse in={_seed_word_suggestion.length > 0 && _seed_word_input.length > 0}><Typography style={{ fontSize: "13px", marginBottom: "12px", color: "#888", textAlign: "right" }}>{t("components.pixa_wallet_keys_dialog.suggestions", {
                                        seed_word_suggestion: _seed_word_suggestion.join(", ")
                                    })}</Typography></Collapse>

                                <FormControl variant="outlined" fullWidth style={{ marginTop: 8 }}>
                                    <InputLabel htmlFor="seed-password-input">{t("components.pixa_wallet_keys_dialog.password_optional_but_recommended")}</InputLabel>
                                    <OutlinedInput id="seed-password-input" type={_showPassword ? "text" : "password"} value={_password} onChange={this._handlePasswordChange}
                                                   endAdornment={<Tooltip title={t("words.toggle_password_visibility")}><InputAdornment position="end"><IconButton edge="end" onClick={this._handleClickShowPassword} onMouseDown={this._handleMouseDownPassword}>{_showPassword ? <Visibility /> : <VisibilityOff />}</IconButton></InputAdornment></Tooltip>}
                                                   labelWidth={230} />
                                </FormControl>
                                <Typography style={{ fontSize: "12px", marginTop: "12px", color: "#666" }}>{t(
                                    "components.pixa_wallet_keys_dialog.adding_a_password_provides_extra_security_especi"
                                )}</Typography>
                                <SeedPhraseMenu onGenerate={this._generate_new_seed} anchorEl={_seed_menu_anchor} onClose={() => this._set_seed_phrase_anchor(null)} />

                                <Typography style={{ fontFamily: "'Industry Book'", fontSize: "14px", color: "#ffffff", margin: "16px 0px 4px 0px" }}>
                                    {t("components.pixa_wallet_keys_dialog.no_one_can_steal_or_recover_your")}
                                </Typography>
                                <Typography style={{ fontSize: "13px", color: "#9b9b9b", marginBottom: 12 }}>
                                    {t("components.pixa_wallet_keys_dialog.keep_them_in_a_safe_place_and")}
                                </Typography>

                                <Tooltip title={!hasSeed ? t("components.pixa_wallet_keys_dialog.generate_or_enter_a_valid_seed") : ""} disableHoverListener={hasSeed} disableFocusListener={hasSeed} disableTouchListener={hasSeed}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={_documentAcknowledged}
                                                onChange={this._handleDocumentAcknowledged}
                                                disabled={!hasSeed || _backdropOpened}
                                                size="small"
                                            />
                                        }
                                        label={_downloaded ? t("components.pixa_wallet_keys_dialog.i_downloaded_the_document") : t("components.pixa_wallet_keys_dialog.download_the_document_and_acknowledge")}
                                    />
                                </Tooltip>

                                <div style={{ textAlign: "right", marginTop: 8 }}>
                                    <Tooltip title={!backupAcknowledged ? t("components.pixa_wallet_keys_dialog.tick_the_box_above_to_download") : ""} disableHoverListener={backupAcknowledged} disableFocusListener={backupAcknowledged} disableTouchListener={backupAcknowledged}>
                                        <span><Button variant="contained" className={classes.whiteButton} onClick={this._applyNewKeys} disabled={!backupAcknowledged || _applying}>{_applying ? t("components.pixa_wallet_keys_dialog.applying", { TUC: true }) : t("components.pixa_wallet_keys_dialog.apply_keys", { TUC: true })}</Button></span>
                                    </Tooltip>
                                </div>
                            </div>
                        </DialogContent>
                    </SwipeableViews> : <DialogContent scroll={"paper"} className={classes.content}>
                        {keysView}
                    </DialogContent>}
                    <DialogActions style={{ padding: "16px 24px" }}><Button variant="text" color="primary" onClick={this.props.onClose}>{t("words.close", {TUC: true})}</Button></DialogActions>
                </Dialog>
                {/* Recovery account confirmation dialog. White-on-black, mirroring the
                    visual treatment of other irreversible-style confirmations in the
                    wallet. Owner-key prompting happens inside changeRecoveryAccount. */}
                <Dialog open={open && _recovery_confirm_open}
                        maxWidth={"xs"}
                        disablePortal={false}
                        onClose={this._close_recovery_confirm}
                        keepMounted={false}
                        PaperProps={{ classes: { root: classes.darkGreyDialog } }}>
                    <DialogTitle><Typography component="h2" variant="h6">{t("components.pixa_wallet_keys_dialog.confirm_recovery_account_change")}</Typography></DialogTitle>
                    <DialogContent>
                        <Typography variant="body2" style={{ color: "#bbb", marginBottom: 16 }}><T
                                k="components.pixa_wallet_keys_dialog.you_are_about_to_request_a_change"
                                vars={{
                                    username: username
                                }}
                                slots={[<strong style={{ color: "#fff", fontFamily: "monospace" }} key="0" />]} /></Typography>
                        <div style={{ textAlign: "center", margin: "16px 0" }}>
                            <Fade in timeout={150}>
                                <Avatar
                                    src={recoveryResolvedImage}
                                    className={"pixelated"}
                                    style={{ width: 120, height: 120, margin: "8px auto 12px auto", borderRadius: "32px" }}
                                />
                            </Fade>
                            <Fade in timeout={300}>
                                <Typography component="div" style={{ fontWeight: "bold", fontSize: 18, color: "#fff" }}>{`@${_recoveryInput}`}</Typography>
                            </Fade>
                            {_recoverySelected && _recoverySelected.name && _recoverySelected.name !== _recoveryInput && (
                                <Fade in timeout={450}>
                                    <Typography component="div" style={{ fontSize: 13, color: "#888", marginTop: 2 }}>{_recoverySelected.name}</Typography>
                                </Fade>
                            )}
                        </div>
                        {_currentRecovery && _recoveryInput === _currentRecovery ? (
                            <div className={classes.recoveryPendingBox}><T
                                    k="components.pixa_wallet_keys_dialog.this_will_strong_cancel_any_pending_recovery" /></div>
                        ) : (
                            <div className={classes.recoveryWarning}><T
                                    k="components.pixa_wallet_keys_dialog.once_broadcast_the_chain_will_create_a"
                                    vars={{
                                        currentRecovery: _currentRecovery || 'none'
                                    }}
                                    slots={[<span style={{ fontFamily: "monospace" }} key="0" />]} /></div>
                        )}
                        {_recovery_error && (
                            <Typography style={{ fontSize: 12, color: "#cccccc", fontStyle: "italic", margin: "8px 4px" }}>{_recovery_error}</Typography>
                        )}
                    </DialogContent>
                    <DialogActions style={{ padding: "8px 16px 16px 16px" }}>
                        <Button variant="text" color="primary" onClick={this._close_recovery_confirm} disabled={_recovery_loading}>{t("words.cancel", {TUC: true})}</Button>
                        <Button variant="contained" className={classes.whiteButton} onClick={this._confirm_recovery_change} disabled={_recovery_loading}>
                            {_recovery_loading ? "BROADCASTING..." : "CONFIRM"}
                        </Button>
                    </DialogActions>
                </Dialog>
                <Portal><Backdrop className={classes.backdrop} open={_backdropOpened}><CircularProgress color="inherit" />{_applying && <Typography style={{ marginLeft: 16, color: "#fff" }}>{t("components.pixa_wallet_keys_dialog.applying_new_keys_to_the_blockchain")}</Typography>}{_recovery_loading && !_applying && <Typography style={{ marginLeft: 16, color: "#fff" }}>{t("components.pixa_wallet_keys_dialog.broadcasting_recovery_account_change")}</Typography>}</Backdrop></Portal>
            </React.Fragment>
        );
    }
}

export default withLanguage(withStyles(styles)(PixaWalletKeysDialog));