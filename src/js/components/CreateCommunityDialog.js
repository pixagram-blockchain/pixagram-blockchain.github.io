import * as React from "preact/compat";
import { NumericFormat } from 'react-number-format';
import withStyles from "@material-ui/core/styles/withStyles";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import InputAdornment from "@material-ui/core/InputAdornment";
import SwipeableViews from 'react-swipeable-views';
import Typography from "@material-ui/core/Typography";
import OutlinedInput from "@material-ui/core/OutlinedInput";
import CircularProgress from "@material-ui/core/CircularProgress";
import IconButton from "@material-ui/core/IconButton";
import Collapse from "@material-ui/core/Collapse";
import Step from "@material-ui/core/Step";
import StepLabel from "@material-ui/core/StepLabel";
import Stepper from "@material-ui/core/Stepper";
import Fade from "@material-ui/core/Fade";
import Checkbox from '@material-ui/core/Checkbox';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import ErrorRounded from "@material-ui/icons/ErrorRounded";
import CheckRounded from "@material-ui/icons/CheckRounded";
import CheckCircleRounded from "@material-ui/icons/CheckCircleRounded";
import Tooltip from "@material-ui/core/Tooltip";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import ListItemText from "@material-ui/core/ListItemText";
import FileCopyOutlined from "@material-ui/icons/FileCopyOutlined";
import TextField from "@material-ui/core/TextField";
import Chip from "@material-ui/core/Chip";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import Box from "@material-ui/core/Box";
import AccountCheck from "../icons/AccountCheck";
import AccountAlert from "../icons/AccountAlert";
import AccountQuestion from "../icons/AccountQuestion";
import { generateMnemonic, generateMasterKey, generatePDF } from "../utils/BackUpWallet2";
import * as actions from "../actions/utils";
import { HISTORY } from "../utils/constants";
import { CONTENT_LANGUAGES, LANGUAGE_NAME } from "../utils/locale-status";

import { t, getLanguage } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";

// Hoisted static styles — were inline literals re-created on every render.
const ST_C_BBB__FS_22 = { color: "#bbb", fontSize: 22 };
const ST_C_DDD = { color: "#ddd" };
const ST_W_20__H_20__BR_50 = { width: 20, height: 20, borderRadius: "50%", border: "2px solid #444", display: "block" };
const ST_C_FFF__FS_42__MT_8 = { color: "#fff", fontSize: 42, marginTop: 8 };
const ST_FS_13__C_CCC__MB_14 = { fontSize: 13, color: "#ccc", marginBottom: 14 };
const ST_C_AAA__BC_555 = { color: "#aaa", borderColor: "#555" };
const ST_D_FLEX__JC_FLEX_END__MB_16 = { display: "flex", justifyContent: "flex-end", marginBottom: 16 };
const ST_MB_0 = { marginBottom: 0 };
const ST_FS_13__C_999__MB_16 = { fontSize: 13, color: "#999", marginBottom: 16, textAlign: "left" };
const ST_MB_16 = { marginBottom: 16 };
const ST_MB_8 = { marginBottom: 8 };
const ST_C_7B7B7B = { color: "#7b7b7b" };
const ST_C_888 = { color: "#888" };
const ST_C_666__FS_13__WS_NOWRAP = { color: "#666", fontSize: 13, whiteSpace: "nowrap" };
const ST_FS_12__C_BBB__MB_16 = { fontSize: 12, color: "#bbb", marginBottom: 16, textAlign: "right" };
const ST_D_FLEX__AI_CENTER__MB_16 = { display: "flex", alignItems: "center", marginBottom: 16 };
const ST_MB_8__C_CCC = { marginBottom: 8, color: "#ccc" };
const ST_MT_8 = { marginTop: 8 };
const ST_PT_8__PB_8 = { paddingTop: 8, paddingBottom: 8 };
const ST_MB_12 = { marginBottom: 12 };
const ST_ML_8__C_888 = { marginLeft: 8, color: "#888" };
const ST_W_60 = { width: 60 };
const ST_ML_4__MR_8__C_888 = { marginLeft: 4, marginRight: 8, color: "#888" };
const ST_FS_12__C_666__TA_LEFT = { fontSize: 12, color: "#666", textAlign: "left" };
const ST_D_FLEX__FD_COLUMN__M_0_0_16PX_0 = { display: "flex", flexDirection: "column", margin: "0 0 16px 0" };
const ST_W_100__M_0 = { width: "100%", margin: 0 };
const ST_C_888__MT_8 = { color: "#888", marginTop: 8 };
const ST_BG_TRANSPARENT = { backgroundColor: "transparent" };
const ST_TA_RIGHT = { textAlign: "right" };
const ST_C_999 = { color: "#999" };
const ST_BG_222__C_CCC = { backgroundColor: "#222", color: "#ccc" };

// =============================================================================
// Styles — greyscale only
// =============================================================================

const styles = theme => ({
    dialog: {
        "& .MuiDialog-paperFullWidth": {
            width: "min(100%, 720px) !important",
            background: "#000000",
        }
    },
    inputEndAdornment: {
        "& .MuiIconButton-root.Mui-disabled": {
            color: "#7b7b7b",
        },
        "& .MuiCircularProgress-colorSecondary": {
            color: "#7b7b7b",
            marginLeft: "8px",
        }
    },
    buttonNotDisabled: {
        "&.MuiButtonBase-root.Mui-disabled": {
            cursor: "help",
            pointerEvents: "all",
        }
    },
    infoChip: {
        marginBottom: 16,
        backgroundColor: "#1a1a1a",
        color: "#ddd",
        "& .MuiChip-label": {
            fontSize: 14,
        }
    },
    greyError: {
        "& .MuiOutlinedInput-root.Mui-error .MuiOutlinedInput-notchedOutline": {
            borderColor: "#888",
        },
        "& .MuiFormLabel-root.Mui-error": {
            color: "#888",
        },
    },
    buttonEnabled: {
        color: "#ccc",
        backgroundColor: "#ffffff00",
        "&:hover": {
            color: "#fff",
            backgroundColor: "#ffffff06",
        }
    },
    buttonDisabled: {
        color: "#555",
        backgroundColor: "#ffffff00",
    },
    advancedHeader: {
        display: "flex",
        alignItems: "center",
        cursor: "pointer",
        userSelect: "none",
        padding: "8px 0",
    },
    advancedLabel: {
        fontSize: 13,
        color: "#888",
        flex: 1,
        transition: "color 150ms ease",
    },
    advancedArrow: {
        color: "#666",
        fontSize: 20,
        transition: "transform 200ms ease",
    },
    advancedArrowOpen: {
        transform: "rotate(180deg)",
    },
    // ── In-modal progress ──
    progressRoot: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px 32px",
        minHeight: 260,
    },
    progressStep: {
        display: "flex",
        alignItems: "center",
        width: "100%",
        maxWidth: 380,
        marginBottom: 22,
    },
    progressIcon: {
        width: 28,
        height: 28,
        marginRight: 14,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    progressText: {
        fontSize: 14,
        color: "#555",
    },
    progressTextActive: {
        fontSize: 14,
        color: "#fff",
    },
    progressTextDone: {
        fontSize: 14,
        color: "#999",
    },
    errorBox: {
        marginTop: 24,
        padding: "16px 20px",
        backgroundColor: "#1a1a1a",
        borderRadius: 8,
        width: "100%",
        maxWidth: 380,
    },
    pxpWarning: {
        fontSize: 13,
        color: "#bbb",
        padding: "12px 16px",
        backgroundColor: "#111",
        borderRadius: 8,
        marginBottom: 16,
    },
});

// =============================================================================
// PXP numeric input mask  (mirrors NumberFormatCustom in PixaWalletSendDialog)
// =============================================================================

function PxpNumberFormat(props) {
    const { inputRef, onChange, ...other } = props;

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
            decimalScale={3}
            fixedDecimalScale={false}
            allowNegative={false}
            allowLeadingZeros={true}
            suffix={" PXP"}
            prefix={""}
        />
    );
}

// =============================================================================
// Component
// =============================================================================

// Stable render helpers + SwipeableViews config — were literals re-created
// on every render (the dialog re-renders per keystroke of its inputs).
const renderCapitalized = (v) => v.charAt(0).toUpperCase() + v.slice(1);
const renderUppercased = (v) => v.toUpperCase();
const SWIPE_CONTAINER_STYLE = { height: "100%" };
const SWIPE_SPRING_CONFIG = {
    tension: 450,
    friction: 60,
    duration: "360ms",
    easeFunction: "cubic-bezier(0.280, 0.840, 0.420, 1)",
    delay: "5ms",
};
const CREATE_ENABLED_STYLE = { color: "#fff" };
const CREATE_DISABLED_STYLE = { color: "#555" };

class CreateCommunityDialog extends React.PureComponent {

    constructor(props) {
        super(props);
        this.state = {
            classes: props.classes,
            api: props.api || null,
            keepMounted: props.keepMounted || false,
            open: props.open,
            ...CreateCommunityDialog._getInitialFormState(),

            // General (not reset between opens)
            _fullscreen: (window.innerWidth || document.documentElement.clientWidth || (document.body || document.getElementsByTagName('body')[0]).clientWidth) <= 960,
            _creation_fee: "3.000 PIXA",
            _logged_in_user: null,
        };
    }

    /**
     * Returns a clean copy of all form/wizard state.
     * Used by the constructor and on dialog close to fully reset.
     */
    static _getInitialFormState() {
        return {
            _tab_value: 0,

            // Step 1 — Portal Details
            _title: "",
            _about: "",
            _portal_type: "topic",
            _lang: "en",

            // Step 2 — Credentials
            _portal_username: "",
            _portal_username_syntax_error: false,
            _pending_username_validation: false,
            _portal_username_available: false,
            _credentials_saved_checkbox: false,
            _sprout_downloaded: false,

            // Delegation
            _delegation_pxp: 50,
            _available_pxp: 0,
            _pxp_loaded: false,
            _global_props: null,

            // Advanced configuration
            _advanced_open: false,
            _default_beneficiary: "",
            _beneficiary_percentage: 0,

            // Keys (populated after sprout download)
            _publicKeys: null,
            _privateKeys: null,

            // Creation progress (null = idle)
            _creation_phase: null,
            _creation_error: "",
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────────────────

    componentDidMount() {
        this._checkLoggedInUser();
        this._generatePortalUsername();
        this._fetchCreationFee();
        this._fetchUserPxp();
        window.addEventListener("resize", this._computeSize);
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this._computeSize);
    }

    componentWillReceiveProps(new_props) {
        // Capture transition flags BEFORE setState so we compare against the previous value
        const isNewlyOpened = new_props.open === true && !this.state.open;
        const isNewlyClosed = new_props.open === false && this.state.open;

        this.setState({
            ...new_props,
            api: new_props.api,
        }, () => {
            if (isNewlyClosed) {
                // Full form reset so the next open starts clean
                this.setState(CreateCommunityDialog._getInitialFormState());
            }
            if (isNewlyOpened) {
                // Reset form first, then refetch everything
                this.setState(CreateCommunityDialog._getInitialFormState(), () => {
                    this._checkLoggedInUser();
                    this._generatePortalUsername();
                    this._fetchCreationFee();
                    this._fetchUserPxp();
                });
            }
        });
    }

    _computeSize = () => {
        const fullscreen = (window.innerWidth || document.documentElement.clientWidth || (document.body || document.getElementsByTagName('body')[0]).clientWidth) <= 960;
        if (this.state._fullscreen !== fullscreen) {
            this.setState({ _fullscreen: fullscreen }, () => this.forceUpdate());
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Init helpers
    // ─────────────────────────────────────────────────────────────────────────

    _checkLoggedInUser = async () => {
        const { api } = this.state;
        if (api && api.sessionManager) {
            try {
                const user = await api.sessionManager.getActiveAccount();
                this.setState({ _logged_in_user: user }, () => {
                    if (user) this._fetchUserPxp();
                });
            } catch (e) { /* not logged in */ }
        }
    };

    _fetchCreationFee = async () => {
        const { api } = this.state;
        if (api && api.globals) {
            try {
                const props = await api.globals.getChainProperties();
                if (props && props.account_creation_fee) {
                    this.setState({ _creation_fee: props.account_creation_fee });
                }
            } catch (e) {
                console.warn("[CreateCommunityDialog] Could not fetch creation fee:", e);
            }
        }
    };

    _fetchUserPxp = async () => {
        const { api, _logged_in_user } = this.state;
        if (!api || !_logged_in_user) return;

        try {
            const [accounts, globalProps] = await Promise.all([
                api.accounts.getAccounts([_logged_in_user]),
                api.globals.getDynamicGlobalProperties(),
            ]);

            if (!accounts || !accounts[0] || !globalProps) return;

            const account = accounts[0];

            // Own vesting minus what's already delegated out (can't delegate received vesting)
            // Use parseFloat directly — the proxy translates chain symbols (VESTS → PXP)
            // which dpixa's getVests/Asset.fromString does not recognise.
            const ownVests = parseFloat(account.vesting_shares) || 0;
            const delegatedVests = parseFloat(account.delegated_vesting_shares) || 0;
            const availableVests = ownVests - delegatedVests;

            const totalVestingShares = globalProps.total_vesting_shares;
            const totalVestingFundPixa = globalProps.total_vesting_fund_pixa
                || globalProps.total_vesting_fund_steem
                || globalProps.total_vesting_fund_hive
                || "0";

            const availablePxp = api.formatter.vestToPixa(
                availableVests,
                totalVestingShares,
                totalVestingFundPixa,
            );

            this.setState({
                _available_pxp: Math.max(0, Math.floor(availablePxp * 1000) / 1000),
                _global_props: globalProps,
                _pxp_loaded: true,
            });
        } catch (e) {
            console.warn("[CreateCommunityDialog] Could not fetch PXP balance:", e);
            this.setState({ _pxp_loaded: true, _available_pxp: 0 });
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Portal username
    // ─────────────────────────────────────────────────────────────────────────

    _portalTypeToDigit = (type) => type === "journal" ? 2 : type === "council" ? 3 : 1;

    _generatePortalUsername = () => {
        const { _portal_type } = this.state;
        const typeDigit = this._portalTypeToDigit(_portal_type);
        const rest = Math.floor(Math.random() * 90000) + 10000; // 5 random digits
        this.setState({
            _portal_username: `portal-${typeDigit}${rest}`,
            _sprout_downloaded: false,
            _publicKeys: null,
            _privateKeys: null,
        }, () => this._validatePortalUsername());
    };

    _validatePortalUsername = async () => {
        const { api, _portal_username } = this.state;

        if (!/^portal-[1-3]\d{4,6}$/.test(_portal_username)) {
            this.setState({
                _portal_username_syntax_error: true,
                _portal_username_available: false,
                _pending_username_validation: false,
            });
            return;
        }

        this.setState({ _pending_username_validation: true, _portal_username_syntax_error: false });

        if (api && api.accounts) {
            try {
                const accs = await api.accounts.getAccounts([_portal_username]);
                this.setState({
                    _pending_username_validation: false,
                    _portal_username_available: !accs || accs.length === 0 || !accs[0],
                });
            } catch (e) {
                console.error("[CreateCommunityDialog] username check error:", e);
                this.setState({ _pending_username_validation: false, _portal_username_available: false });
            }
        } else {
            setTimeout(() => {
                this.setState({ _pending_username_validation: false, _portal_username_available: true });
            }, 500);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Sprout / key generation  (follows CreateAccountDialog pattern)
    // ─────────────────────────────────────────────────────────────────────────

    _generateAndDownloadSprout = async () => {
        const { _portal_username } = this.state;

        try {
            // Wordlist follows the active UI language (English fallback).
            const seed = await generateMnemonic(24, getLanguage());
            const masterKey = await generateMasterKey(seed, "");
            const [blob, keys] = await generatePDF(_portal_username, seed, "", masterKey);

            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.download = `KeysOf-${_portal_username}-Pixagram.pdf`;
            a.href = url;
            a.click();
            a.remove();
            URL.revokeObjectURL(url);

            this.setState({
                _publicKeys: keys.pub,
                _privateKeys: keys.priv,
                _sprout_downloaded: true,
                _credentials_saved_checkbox: true,
            });
        } catch (e) {
            console.error("[CreateCommunityDialog] sprout generation failed:", e);
            actions.trigger_snackbar(t("components.create_community_dialog.failed_to_generate_portal_sprout"));
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Input handlers
    // ─────────────────────────────────────────────────────────────────────────

    _handleTitleChange = (e) => this.setState({ _title: e.target.value });
    _handleAboutChange = (e) => this.setState({ _about: e.target.value });
    _handleLangChange = (e) => this.setState({ _lang: e.target.value });
    _handlePortalTypeChange = (e) => this.setState({ _portal_type: e.target.value }, () => {
        this._generatePortalUsername();
    });

    _handlePortalUsernameChange = (e) => {
        this.setState({
            _portal_username: e.target.value,
            _sprout_downloaded: false,
            _publicKeys: null,
            _privateKeys: null,
        }, () => this._validatePortalUsername());
    };

    _handleDelegationChange = (e) => {
        const raw = parseFloat(e.target.value || 0);
        const value = isNaN(raw) ? 0 : Math.max(0, raw);
        this.setState({ _delegation_pxp: value });
    };

    _handleCredentialsSavedCheckboxChange = (e) => {
        const checked = e.target.checked;
        if (checked && !this.state._sprout_downloaded) {
            // Checking the box before downloading triggers the download
            this._generateAndDownloadSprout();
        }
        this.setState({ _credentials_saved_checkbox: checked });
    };

    _handleDefaultBeneficiaryChange = (e) =>
        this.setState({ _default_beneficiary: e.target.value.toLowerCase().replace("@", "") });

    _handleBeneficiaryPercentageChange = (e) =>
        this.setState({ _beneficiary_percentage: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) });

    _toggleAdvanced = () =>
        this.setState((prev) => ({ _advanced_open: !prev._advanced_open }));

    // ─────────────────────────────────────────────────────────────────────────
    // Navigation
    // ─────────────────────────────────────────────────────────────────────────

    _handleTabChange = (e, value) => {
        if (value >= 0 && value <= 1) {
            this.setState({ _tab_value: value });
        }
    };

    _onSwipeIndexChange = (v) => this._handleTabChange({}, v);
    _goToPreviousStep = () => this._handleTabChange({}, this.state._tab_value - 1);
    _goToNextStep = () => this._handleTabChange({}, this.state._tab_value + 1);

    _canAdvance = () => {
        const { _tab_value, _title, _about } = this.state;
        if (_tab_value === 0) return _title.trim().length >= 3 && _about.trim().length >= 10;
        return true;
    };

    _canCreate = () => {
        const {
            _portal_username_available,
            _pending_username_validation,
            _sprout_downloaded,
            _credentials_saved_checkbox,
            _creation_phase,
            _delegation_pxp,
            _available_pxp,
            _pxp_loaded,
        } = this.state;

        return (
            _portal_username_available &&
            !_pending_username_validation &&
            _sprout_downloaded &&
            _credentials_saved_checkbox &&
            _creation_phase === null &&
            _pxp_loaded &&
            _delegation_pxp <= _available_pxp
        );
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Convert PXP ↔ VESTS
    // ─────────────────────────────────────────────────────────────────────────

    _pxpToVestsString = (pxp) => {
        const { api, _global_props } = this.state;
        if (!api || !_global_props) return "0.000000 VESTS";

        const totalVestingShares = _global_props.total_vesting_shares;
        const totalVestingFundPixa = _global_props.total_vesting_fund_pixa
            || _global_props.total_vesting_fund_steem
            || _global_props.total_vesting_fund_hive
            || "0";

        const vests = api.formatter.pixaToVest(pxp, totalVestingShares, totalVestingFundPixa);
        return `${vests.toFixed(6)} VESTS`;
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Portal creation pipeline
    // ─────────────────────────────────────────────────────────────────────────

    _handleCreatePortal = async () => {
        const {
            api,
            _portal_username,
            _title,
            _about,
            _portal_type,
            _lang,
            _logged_in_user,
            _creation_fee,
            _publicKeys,
            _privateKeys,
            _delegation_pxp,
            _default_beneficiary,
            _beneficiary_percentage,
        } = this.state;

        if (!_logged_in_user) { actions.trigger_snackbar(t("components.create_community_dialog.please_log_in_to_create_a_portal")); return; }
        if (!api || !api.broadcast) { actions.trigger_snackbar(t("components.create_community_dialog.api_not_available")); return; }
        if (!_publicKeys || !_privateKeys) { actions.trigger_snackbar(t("components.create_community_dialog.download_the_portal_sprout_first")); return; }

        const portalAuths = {
            posting: _privateKeys.posting,
            active: _privateKeys.active,
        };

        const buildAuth = (pubKey) => ({
            weight_threshold: 1,
            account_auths: [],
            key_auths: [[pubKey, 1]],
        });

        // ── Phase 1 — Create portal account ─────────────────────────────────
        this.setState({ _creation_phase: "creating", _creation_error: "" });

        try {
            await api.broadcast.accountCreate({
                fee: _creation_fee,
                creator: _logged_in_user,
                newAccountName: _portal_username,
                owner: buildAuth(_publicKeys.owner),
                active: buildAuth(_publicKeys.active),
                posting: buildAuth(_publicKeys.posting),
                memoKey: _publicKeys.memo,
                jsonMetadata: JSON.stringify({ profile: {} }),
            });
        } catch (err) {
            console.error("[CreateCommunityDialog] accountCreate failed:", err);
            this.setState({ _creation_phase: "error", _creation_error: err.message || "Account creation failed" });
            return;
        }

        // ── Phase 2 — Delegate PXP ──────────────────────────────────────────
        if (_delegation_pxp > 0) {
            this.setState({ _creation_phase: "delegating" });

            try {
                const vestsString = this._pxpToVestsString(_delegation_pxp);
                await api.broadcast.delegateVestingShares(
                    _logged_in_user,
                    _portal_username,
                    vestsString,
                );
            } catch (err) {
                console.error("[CreateCommunityDialog] delegation failed:", err);
                this.setState({ _creation_phase: "error", _creation_error: err.message || "Delegation failed" });
                return;
            }
        }

        // ── Phase 3 — Set creator as admin ──────────────────────────────────
        this.setState({ _creation_phase: "admin" });

        try {
            await api.broadcast.customJson({
                requiredPostingAuths: [_portal_username],
                id: "community",
                json: JSON.stringify(["setRole", {
                    community: _portal_username,
                    account: _logged_in_user,
                    role: "admin",
                }]),
            }, portalAuths);
        } catch (err) {
            console.error("[CreateCommunityDialog] setRole failed:", err);
            this.setState({ _creation_phase: "error", _creation_error: err.message || "Failed to set admin role" });
            return;
        }

        // ── Phase 4 — Configure portal properties ───────────────────────────
        this.setState({ _creation_phase: "configuring" });

        // Give pixamind a moment to index the community from the setRole op
        // in Phase 3 before we send updateProps — otherwise it may silently
        // drop the update for a community it hasn't registered yet.
        await new Promise((r) => setTimeout(r, 3000));

        try {
            // Match the field set that EditCommunityDialog uses — pixamind
            // validates strictly and unknown keys (e.g. settings) can cause
            // silent rejection of the entire op.
            const portalProps = {
                title: _title,
                about: _about,
                description: "",
                lang: _lang,
                is_nsfw: false,
                flag_text: "",
            };

            if (_default_beneficiary && _beneficiary_percentage > 0) {
                portalProps.default_beneficiary = {
                    account: _default_beneficiary,
                    weight: _beneficiary_percentage * 100,
                };
            }

            // Sign updateProps with portal's own posting key — portal is the
            // owner of its own community and always has posting permission.
            // Must use requiredPostingAuths (not requiredAuths) because
            // pixamind only processes community ops under posting authority.
            await api.broadcast.customJson({
                requiredPostingAuths: [_portal_username],
                id: "community",
                json: JSON.stringify(["updateProps", {
                    community: _portal_username,
                    props: portalProps,
                }]),
            }, { posting: portalAuths.posting });

            // Subscribe the creator (keyManager handles the creator's key)
            await api.broadcast.customJson({
                requiredPostingAuths: [_logged_in_user],
                id: "community",
                json: JSON.stringify(["subscribe", {
                    community: _portal_username,
                }]),
            });
        } catch (err) {
            console.error("[CreateCommunityDialog] configure failed:", err);
            this.setState({ _creation_phase: "error", _creation_error: err.message || "Failed to configure portal" });
            return;
        }

        // ── Done ─────────────────────────────────────────────────────────────
        this.setState({ _creation_phase: "done" });
        await new Promise((r) => setTimeout(r, 700));

        actions.trigger_snackbar(t("components.create_community_dialog.portal_created_successfully", {
            _title: _title
        }));

        // Navigate to the newly created portal page
        HISTORY.push("/" + _portal_username);

        if (this.props.onCreated) {
            this.props.onCreated({
                name: _portal_username,
                title: _title,
                about: _about,
                type: _portal_type,
                creator: _logged_in_user,
            });
        }

        this._resetAndClose();
    };

    _resetAndClose = () => {
        this.setState(CreateCommunityDialog._getInitialFormState(), () => {
            if (this.props.onClose) this.props.onClose();
        });
    };

    // ─────────────────────────────────────────────────────────────────────────
    // In-modal progress
    // ─────────────────────────────────────────────────────────────────────────

    _renderProgress = () => {
        const {
            classes,
            _creation_phase,
            _creation_error,
            _logged_in_user,
            _delegation_pxp,
        } = this.state;

        // Build phases dynamically (delegation only shown if > 0)
        const phases = [
            { key: "creating",    label: "Creating portal" },
        ];

        if (_delegation_pxp > 0) {
            phases.push({ key: "delegating", label: "Delegating PXP to portal" });
        }

        phases.push(
            { key: "admin",       label: t("components.create_community_dialog.setting_as_admin", {
                _logged_in_user: _logged_in_user
            }) },
            { key: "configuring", label: "Setting portal's configuration" },
        );

        const phaseOrder = phases.map(p => p.key).concat("done");
        const currentIdx = phaseOrder.indexOf(_creation_phase);
        const isError = _creation_phase === "error";

        return (
            <div className={classes.progressRoot}>
                {phases.map((phase, i) => {
                    const isDone = currentIdx > i;
                    const isActive = currentIdx === i && !isError;

                    let icon;
                    if (isDone) {
                        icon = <CheckRounded style={ST_C_BBB__FS_22} />;
                    } else if (isActive) {
                        icon = <CircularProgress size={20} style={ST_C_DDD} />;
                    } else {
                        icon = (
                            <span style={ST_W_20__H_20__BR_50} />
                        );
                    }

                    let textClass = classes.progressText;
                    if (isDone) textClass = classes.progressTextDone;
                    if (isActive) textClass = classes.progressTextActive;

                    return (
                        <div className={classes.progressStep} key={phase.key}>
                            <div className={classes.progressIcon}>{icon}</div>
                            <Typography className={textClass}>{phase.label}</Typography>
                        </div>
                    );
                })}

                {_creation_phase === "done" && (
                    <Fade in>
                        <CheckCircleRounded style={ST_C_FFF__FS_42__MT_8} />
                    </Fade>
                )}

                {isError && (
                    <div className={classes.errorBox}>
                        <Typography style={ST_FS_13__C_CCC__MB_14}>
                            {_creation_error}
                        </Typography>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={this._resetAndClose}
                            style={ST_C_AAA__BC_555}
                        >{t("words.close", {TUC: true})} </Button>
                    </div>
                )}
            </div>
        );
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Step views
    // ─────────────────────────────────────────────────────────────────────────

    _getViews = () => {
        const {
            classes,
            _title,
            _about,
            _portal_type,
            _lang,
            _portal_username,
            _portal_username_syntax_error,
            _pending_username_validation,
            _portal_username_available,
            _sprout_downloaded,
            _credentials_saved_checkbox,
            _delegation_pxp,
            _available_pxp,
            _pxp_loaded,
            _advanced_open,
            _default_beneficiary,
            _beneficiary_percentage,
            _creation_fee,
            _logged_in_user,
        } = this.state;

        const insufficientPxp = _pxp_loaded && _delegation_pxp > _available_pxp;

        return [
            // ── Step 1: Portal Details ───────────────────────────────────────
            <DialogContent key="view-1">
                <div style={ST_D_FLEX__JC_FLEX_END__MB_16}>
                    <Chip className={classes.infoChip} label={t("components.create_community_dialog.creation_fee", {
                        _creation_fee: _creation_fee
                    })} style={ST_MB_0} />
                </div>

                {!_logged_in_user && (
                    <Typography style={ST_FS_13__C_999__MB_16}>
                        {t("components.create_community_dialog.you_must_be_logged_in_to_create")}
                    </Typography>
                )}

                <FormControl variant="outlined" fullWidth style={ST_MB_16}>
                    <InputLabel htmlFor="title-input">{t("components.create_community_dialog.portal_title")}</InputLabel>
                    <OutlinedInput
                        id="title-input"
                        value={_title}
                        onChange={this._handleTitleChange}
                        placeholder={t("components.create_community_dialog.my_awesome_portal")}
                        labelWidth={85}
                    />
                </FormControl>

                <FormControl variant="outlined" fullWidth style={ST_MB_16}>
                    <InputLabel htmlFor="about-input">{t("components.create_community_dialog.about")}</InputLabel>
                    <OutlinedInput
                        id="about-input"
                        value={_about}
                        onChange={this._handleAboutChange}
                        multiline
                        rows={3}
                        placeholder={t("components.create_community_dialog.describe_what_your_portal_is_about")}
                        labelWidth={45}
                    />
                </FormControl>

                <FormControl variant="outlined" fullWidth style={ST_MB_8}>
                    <InputLabel htmlFor="type-select">{t("components.create_community_dialog.portal_type")}</InputLabel>
                    <Select
                        id="type-select"
                        value={_portal_type}
                        onChange={this._handlePortalTypeChange}
                        labelWidth={85}
                        renderValue={renderCapitalized}
                    >
                        <MenuItem value="topic">
                            <ListItemText primary={t("components.create_community_dialog.topic")} secondary={t("components.create_community_dialog.anyone_can_post_or_comment")} />
                        </MenuItem>
                        <MenuItem value="journal">
                            <ListItemText primary={t("components.create_community_dialog.journal")} secondary={t("components.create_community_dialog.only_members_can_post_and_guests_can")} />
                        </MenuItem>
                        <MenuItem value="council">
                            <ListItemText primary={t("components.create_community_dialog.council")} secondary={t("components.create_community_dialog.only_members_can_post_or_comment")} />
                        </MenuItem>
                    </Select>
                </FormControl>

                <FormControl variant="outlined" fullWidth style={ST_MB_8}>
                    <InputLabel htmlFor="lang-select">{t("words.language")}</InputLabel>
                    <Select
                        id="lang-select"
                        value={_lang}
                        onChange={this._handleLangChange}
                        labelWidth={75}
                        renderValue={renderUppercased}
                    >
                        {CONTENT_LANGUAGES.map((l) => (
                            <MenuItem key={l} value={l}>
                                <ListItemText primary={LANGUAGE_NAME[l] || l.toUpperCase()} secondary={l.toUpperCase()} />
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </DialogContent>,

            // ── Step 2: Credentials ──────────────────────────────────────────
            <DialogContent key="view-2">
                {/* PXP balance warning */}
                {_pxp_loaded && _available_pxp <= 0 && (
                    <Typography className={classes.pxpWarning}>
                        {t("components.create_community_dialog.not_enough_pixa_power_token_to_create")}
                    </Typography>
                )}

                {/* Portal username */}
                <FormControl variant="outlined" fullWidth style={ST_MB_16}>
                    <InputLabel htmlFor="portal-username-input">{t("components.create_community_dialog.portal_username")}</InputLabel>
                    <OutlinedInput
                        id="portal-username-input"
                        value={_portal_username}
                        onChange={this._handlePortalUsernameChange}
                        error={
                            _portal_username_syntax_error ||
                            (!_pending_username_validation && !_portal_username_available && _portal_username.length > 0)
                        }
                        className={classes.inputEndAdornment}
                        endAdornment={
                            <Tooltip
                                title={
                                    _portal_username_syntax_error
                                        ? "Invalid format. Use: portal-XXXXXX"
                                        : _pending_username_validation
                                            ? "Checking availability…"
                                            : _portal_username_available
                                                ? "Username available"
                                                : "Username not available"
                                }
                            >
                                <InputAdornment position="end" className={classes.inputEndAdornment}>
                                    {_pending_username_validation ? (
                                        <Box position="relative" display="inline-flex">
                                            <CircularProgress variant="indeterminate" size={36} style={ST_C_7B7B7B} />
                                            <Box
                                                top={0} left={0} bottom={0} right={0}
                                                position="absolute"
                                                display="flex"
                                                alignItems="center"
                                                justifyContent="center"
                                            >
                                                <IconButton edge="end" disabled className={classes.buttonNotDisabled}>
                                                    <AccountQuestion />
                                                </IconButton>
                                            </Box>
                                        </Box>
                                    ) : _portal_username_syntax_error ? (
                                        <IconButton edge="end" disabled className={classes.buttonNotDisabled}>
                                            <AccountAlert />
                                        </IconButton>
                                    ) : _portal_username_available ? (
                                        <IconButton edge="end" disabled className={classes.buttonNotDisabled}>
                                            <AccountCheck />
                                        </IconButton>
                                    ) : _portal_username.length > 0 ? (
                                        <IconButton edge="end" disabled className={classes.buttonNotDisabled}>
                                            <ErrorRounded style={ST_C_888} />
                                        </IconButton>
                                    ) : null}
                                    <IconButton
                                        edge="end"
                                        onClick={this._generatePortalUsername}
                                        disabled={_pending_username_validation}
                                    >
                                        <FileCopyOutlined />
                                    </IconButton>
                                </InputAdornment>
                            </Tooltip>
                        }
                        labelWidth={120}
                    />
                </FormControl>

                {/* Delegation (PXP) */}
                <TextField
                    className={classes.greyError}
                    variant="outlined"
                    fullWidth
                    label={t("components.create_community_dialog.delegation")}
                    value={_delegation_pxp}
                    onChange={this._handleDelegationChange}
                    error={insufficientPxp}
                    style={{ marginBottom: insufficientPxp ? 8 : 16 }}
                    InputLabelProps={{ shrink: true }}
                    InputProps={{
                        inputComponent: PxpNumberFormat,
                        endAdornment: (
                            <InputAdornment position="end">
                                <Typography style={ST_C_666__FS_13__WS_NOWRAP}>
                                    / {_pxp_loaded ? _available_pxp.toFixed(3) : "…"} PXP
                                </Typography>
                            </InputAdornment>
                        ),
                    }}
                />
                {insufficientPxp && (
                    <Typography style={ST_FS_12__C_BBB__MB_16}>
                        {t(
                            "components.create_community_dialog.not_enough_pixa_power_token_please_power"
                        )}
                    </Typography>
                )}

                {/* Download credentials */}
                <div style={ST_D_FLEX__AI_CENTER__MB_16}>
                    <Button
                        variant="text"
                        onClick={this._generateAndDownloadSprout}
                        disabled={!_portal_username_available || _pending_username_validation}
                        style={{ color: _sprout_downloaded ? "#bbb" : "#ddd" }}
                    >
                        {_sprout_downloaded ? "RE-DOWNLOAD CREDENTIALS" : "DOWNLOAD CREDENTIALS"}
                    </Button>
                </div>

                {/* Acknowledge — always visible; checking it triggers the download if not done yet */}
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={_credentials_saved_checkbox}
                            onChange={this._handleCredentialsSavedCheckboxChange}
                            disabled={!_portal_username_available || _pending_username_validation}
                            style={ST_C_888}
                        />
                    }
                    label={t(
                        "components.create_community_dialog.i_have_securely_saved_the_portal_credentials"
                    )}
                    style={ST_MB_8__C_CCC}
                />

                {/* Advanced configuration */}
                <div
                    className={classes.advancedHeader}
                    onClick={this._toggleAdvanced}
                    style={ST_MT_8}
                >
                    <Typography className={classes.advancedLabel}>
                        {t("components.create_community_dialog.advanced_configuration")}
                    </Typography>
                    <ExpandMoreIcon
                        className={`${classes.advancedArrow} ${_advanced_open ? classes.advancedArrowOpen : ""}`}
                    />
                </div>

                <Collapse in={_advanced_open}>
                    <div style={ST_PT_8__PB_8}>
                        <FormControl variant="outlined" fullWidth style={ST_MB_12}>
                            <InputLabel htmlFor="beneficiary-input">{t("components.create_community_dialog.default_beneficiary")}</InputLabel>
                            <OutlinedInput
                                id="beneficiary-input"
                                value={_default_beneficiary}
                                onChange={this._handleDefaultBeneficiaryChange}
                                placeholder={t("words.username")}
                                startAdornment={
                                    <InputAdornment position="start">
                                        <Typography style={ST_ML_8__C_888}>@</Typography>
                                    </InputAdornment>
                                }
                                endAdornment={
                                    <InputAdornment position="end">
                                        <TextField
                                            type="number"
                                            value={_beneficiary_percentage}
                                            onChange={this._handleBeneficiaryPercentageChange}
                                            style={ST_W_60}
                                            inputProps={{ min: 0, max: 100 }}
                                        />
                                        <Typography style={ST_ML_4__MR_8__C_888}>%</Typography>
                                    </InputAdornment>
                                }
                                labelWidth={130}
                            />
                        </FormControl>
                        <Typography style={ST_FS_12__C_666__TA_LEFT}>
                            {t(
                                "components.create_community_dialog.specify_a_default_beneficiary_account_that_will"
                            )}
                        </Typography>
                    </div>
                </Collapse>
            </DialogContent>,
        ];
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────

    render() {
        const {
            classes,
            open,
            _fullscreen,
            _tab_value,
            _creation_phase,
        } = this.state;

        const isCreating = _creation_phase !== null;
        // Evaluate the gate checks once — they were each called 2-3 times below.
        const canCreate = this._canCreate();
        const canAdvance = this._canAdvance();

        return (
            <Dialog
                className={classes.dialog}
                open={open}
                fullScreen={_fullscreen}
                fullWidth={true}
                disablePortal={false}
                onClose={isCreating ? undefined : this.props.onClose}
                keepMounted={false}
            >
                {/* Header */}
                <DialogTitle style={ST_D_FLEX__FD_COLUMN__M_0_0_16PX_0}>
                    <Typography component="h1" variant="h4" style={ST_W_100__M_0}>
                        {t("components.create_community_dialog.create_a_new_portal")}
                    </Typography>
                    <Typography variant="subtitle1" style={ST_C_888__MT_8}>
                        {t(
                            "components.create_community_dialog.your_voice_is_worth_something_on_blockchain"
                        )}
                    </Typography>
                </DialogTitle>
                {isCreating ? (
                    this._renderProgress()
                ) : (
                    <React.Fragment>
                        <Stepper activeStep={_tab_value} style={ST_BG_TRANSPARENT}>
                            <Step completed={_tab_value > 0}>
                                <StepLabel>{t("components.create_community_dialog.portal_details")}</StepLabel>
                            </Step>
                            <Step completed={false}>
                                <StepLabel optional={<Typography variant="caption">{t("components.create_community_dialog.important")}</Typography>}>
                                    {t("components.create_community_dialog.credentials")}
                                </StepLabel>
                            </Step>
                        </Stepper>

                        <SwipeableViews
                            ignoreNativeScroll={true}
                            containerStyle={SWIPE_CONTAINER_STYLE}
                            animateTransitions={true}
                            disableLazyLoading={true}
                            resistance={true}
                            springConfig={SWIPE_SPRING_CONFIG}
                            index={_tab_value}
                            onChangeIndex={this._onSwipeIndexChange}
                            disabled={false}
                            key="swipe-able-view"
                        >
                            {this._getViews()}
                        </SwipeableViews>

                        <DialogActions style={ST_TA_RIGHT}>
                            <Fade in={_tab_value > 0}>
                                <Button
                                    variant="text"
                                    onClick={this._goToPreviousStep}
                                    disabled={_tab_value === 0}
                                    style={ST_C_999}
                                >{t("words.back", {TUC: true})} </Button>
                            </Fade>
                            <Button
                                variant="contained"
                                onClick={this.props.onClose}
                                style={ST_BG_222__C_CCC}
                            >{t("words.cancel", {TUC: true})} </Button>
                            {_tab_value === 1 ? (
                                <Button
                                    variant="text"
                                    onClick={this._handleCreatePortal}
                                    disabled={!canCreate}
                                    style={canCreate ? CREATE_ENABLED_STYLE : CREATE_DISABLED_STYLE}
                                >
                                    {t("components.create_community_dialog.create_portal")}
                                </Button>
                            ) : (
                                <Button
                                    className={canAdvance ? classes.buttonEnabled : classes.buttonDisabled}
                                    variant="text"
                                    onClick={this._goToNextStep}
                                    disabled={!canAdvance}
                                >{t("words.next", {TUC: true})} </Button>
                            )}
                        </DialogActions>
                    </React.Fragment>
                )}
            </Dialog>
        );
    }
}

export default withLanguage(withStyles(styles)(CreateCommunityDialog));