// =============================================================================
// AddAccountDialog.js
//
// "Create an account with your credits" — a one-step dialog styled to match
// the wallet's Send / Delegate / Power dialogs. An already-logged-in user
// spends their own balance to mint a fresh on-chain account for someone else,
// in a single atomic multi-op transaction:
//
//   account_create + (optional) delegate_vesting_shares
//                  + (optional) transfer PXA
//                  + (optional) transfer PXS
//
// There is intentionally no seed-recovery branch and no phone verification:
// the user pays the on-chain creation fee, so the chain itself is the
// anti-spam mechanism.
//
// Visual contract
// ---------------
//   - Dark-grey paper (#181818), the same `darkGreyDialog` palette used by
//     PixaWalletSendDialog / DelegateDialog / PowerDialog.
//   - Filled TextField for username; one filled TextField for each of the
//     three gift amounts. NumericFormat input formatting matches the
//     wallet dialogs (space thousand separator, dot decimal).
//   - Strict greyscale — no theme accents.
//
// Behaviour
// ---------
//   - Username validated synchronously (validateUsername) and asynchronously
//     (api.accounts.getAccounts) with 250ms debounce.
//   - Keys are NOT pre-generated in the background; they are derived inline
//     when the user clicks CREATE, so the button's enabled-state never
//     depends on async background success. If derivation fails, the error
//     panel surfaces the actual exception.
//   - All chain reads use `api.globals.getChainProperties()` and
//     `api.accounts.getAccounts(...)`. The account_creation_fee comes back
//     either as an asset string ("3.000 PIXA") or as a modern NAI object
//     ({ amount, precision, nai }) — both are handled.
//   - PXP is presented as PXA-equivalent Power (VESTS × the vesting-fund ratio
//     from dynamic global properties) but always delegated on-chain as VESTS.
//   - Broadcast is one call to `api.broadcast.sendOperations(ops, key)`
//     after `keyManager.requestKey(currentAccount, "active")`. If the vault
//     is locked, the existing UnlockKeyDialog stacks on top.
// =============================================================================

import * as React from "preact/compat";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "preact/compat";
import { NumericFormat } from "react-number-format";
import withStyles from "@material-ui/core/styles/withStyles";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Typography from "@material-ui/core/Typography";
import TextField from "@material-ui/core/TextField";
import Button from "@material-ui/core/Button";
import InputAdornment from "@material-ui/core/InputAdornment";
import Tooltip from "@material-ui/core/Tooltip";
import CircularProgress from "@material-ui/core/CircularProgress";
import Fade from "@material-ui/core/Fade";
import Collapse from "@material-ui/core/Collapse";
import LinearProgress from "@material-ui/core/LinearProgress";
import AccountRemove from "../icons/AccountRemove";
import AccountQuestion from "../icons/AccountQuestion";
import AccountAlert from "../icons/AccountAlert";
import AccountCheck from "../icons/AccountCheck";
import AccountPlus from "../icons/AccountPlus";
import PixaLiquid from "../icons/PixaLiquid";
import PixaSupra from "../icons/PixaSupra";
import PixaPower from "../icons/PixaPower";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import { validateUsername, generateMnemonic, generateMasterKey, generatePDF } from "../utils/BackUpWallet2";
import * as actions from "../actions/utils";

import { t, useLanguage, getLanguage } from "../utils/text";

// =============================================================================
// CONSTANTS
// =============================================================================

const AUTO_CLOSE_MS = 6000;

const SYM_PXA = "PXA";
const SYM_PXS = "PXS";
const SYM_PXP = "PXP";

// PXP is shown to the user as PXA-equivalent "Power" (VESTS × vesting-fund
// ratio), so its DISPLAY precision matches PXA (3 dp). On-chain it is always
// VESTS, which keeps its own 6-dp precision — used only when serializing the
// delegate_vesting_shares op (see powerToVestsAsset).
const PREC      = { [SYM_PXA]: 3, [SYM_PXS]: 3, [SYM_PXP]: 3 };
const CHAIN_SYM = { [SYM_PXA]: "PIXA", [SYM_PXS]: "PXS", [SYM_PXP]: "VESTS" };
const VESTS_PRECISION = 6;

// =============================================================================
// HELPERS
// =============================================================================

function parseAsset(s) {
    if (typeof s !== "string") return null;
    const parts = s.trim().split(/\s+/);
    if (parts.length !== 2) return null;
    const amount = parseFloat(parts[0]);
    if (!Number.isFinite(amount)) return null;
    return { amount, symbol: parts[1] };
}

function formatAsset(amount, symbol) {
    const p = PREC[symbol] ?? 3;
    return `${(Number(amount) || 0).toFixed(p)} ${symbol}`;
}

/**
 * display-symbol → chain-symbol asset string. PXA/PXS only — PXP is NOT routed
 * through here because its display unit (Power) differs from its chain unit
 * (VESTS). See powerToVestsAsset for the PXP → VESTS conversion.
 */
function toChainAsset(amount, symbol) {
    const chainSym  = CHAIN_SYM[symbol] || symbol;
    const precision = PREC[symbol] ?? 3;
    return `${Number(amount).toFixed(precision)} ${chainSym}`;
}

function buildAuth(pubKey) {
    return { weight_threshold: 1, account_auths: [], key_auths: [[pubKey, 1]] };
}

function assetAmount(s) {
    const p = parseAsset(s);
    return p ? p.amount : 0;
}

// Pure — were re-created inside the component on every render.
const clampToMax  = (n, max) => Math.max(0, Math.min(Number(n) || 0, max));
const roundToPrec = (n, sym) => {
    const f = Math.pow(10, PREC[sym]);
    return Math.floor((Number(n) || 0) * f) / f;
};

// Hoisted static styles + static adornment elements — were literals re-created
// on every render (this dialog re-renders per keystroke of the username and
// amount fields). Static JSX elements are immutable, so reusing one instance
// across renders is safe and lets the reconciler bail out on them.
const SHRINK_LABEL_PROPS = { shrink: true };
const AMOUNT_FIELD_STYLE = { margin: "0px 0px 8px 0px" };
const AMOUNT_ICON_STYLE = { margin: "0px 8px -12px 0px", fontSize: "1em" };
const PXA_FIELD_ICON = <PixaLiquid style={AMOUNT_ICON_STYLE} />;
const PXS_FIELD_ICON = <PixaSupra style={AMOUNT_ICON_STYLE} />;
const PXP_FIELD_ICON = <PixaPower style={AMOUNT_ICON_STYLE} />;
const USERNAME_INPUT_PROPS = {
    autoCapitalize: "none",
    autoCorrect: "off",
    spellCheck: false,
    autoComplete: "off",
    style: { textTransform: "lowercase" },
};
const USERNAME_AT_STYLE = { marginRight: 4, color: "#fff" };
const TITLE_ROW_STYLE = { display: "flex", alignItems: "center", gap: 12 };
const TITLE_ICON_STYLE = { color: "#cccccc" };
const INTRO_STYLE = { margin: "16px 0" };
const WALLET_SPINNER_WRAP_STYLE = { display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 0" };
const GREY_SPINNER_STYLE = { color: "#888" };
const CANT_AFFORD_STYLE = { marginTop: 8, color: "#bdbdbd", fontSize: 13 };
const WORKING_SPINNER_STYLE = { color: "#cccccc" };
const SUCCESS_NAME_STYLE = { color: "#f0f0f0" };
const SUCCESS_SUB_STYLE = { fontSize: 13 };
const AUTO_CLOSE_STYLE = { color: "#666", fontSize: 12, marginTop: 8 };
const ACTIONS_STYLE = { textAlign: "right" };
const ICON_GREY_STYLE = { color: "#777" };
const ICON_MID_STYLE = { color: "#a0a0a0" };
const ICON_LIGHT_STYLE = { color: "#e0e0e0" };

/**
 * PXA-per-VESTS ratio = total_vesting_fund_pixa / total_vesting_shares, read
 * from the chain's dynamic global properties. This is the multiplier that
 * turns raw VESTS into PXA-equivalent "Power" for display. Returns 0 when the
 * properties are missing/unparseable, which the UI treats as "rate unknown"
 * and disables PXP delegation rather than guessing.
 */
function vestRatioFromDGP(dgp) {
    if (!dgp) return 0;
    const fund   = assetAmount(typeof dgp.total_vesting_fund_pixa === "string" ? dgp.total_vesting_fund_pixa : "");
    const shares = assetAmount(typeof dgp.total_vesting_shares    === "string" ? dgp.total_vesting_shares    : "");
    return shares > 0 ? fund / shares : 0;
}

/**
 * Convert a PXP amount (PXA-equivalent Power) into a chain-ready VESTS asset
 * string for delegate_vesting_shares:
 *
 *     vests = power / ratio
 *
 * The result is clamped to the delegator's actually-available VESTS and floored
 * to VESTS precision, so a "max" selection can never round above the
 * delegatable balance and get the transaction rejected.
 */
function powerToVestsAsset(power, ratio, availableVests) {
    const zero = `${(0).toFixed(VESTS_PRECISION)} VESTS`;
    if (!(ratio > 0)) return zero;
    let vests = power / ratio;
    if (vests > availableVests) vests = availableVests;
    const f = Math.pow(10, VESTS_PRECISION);
    vests = Math.floor(vests * f) / f;          // never round up past the cap
    return `${vests.toFixed(VESTS_PRECISION)} VESTS`;
}

/**
 * Normalize whatever shape the chain returns for account_creation_fee into
 * a display-symbol asset string like "3.000 PXA".
 *
 * Accepts:
 *   (a) Asset string with chain symbol:  "3.000 PIXA"
 *   (b) Asset string in display form:    "3.000 PXA"
 *   (c) NAI object:                      { amount: "3000", precision: 3, nai: "@@..." }
 */
function normalizeFee(raw, fallback = "3.000 " + SYM_PXA) {
    if (typeof raw === "string") {
        const parsed = parseAsset(raw);
        if (parsed) {
            const map = { PIXA: SYM_PXA, PXS: SYM_PXS, VESTS: SYM_PXP };
            const symbol = map[parsed.symbol] || parsed.symbol;
            return formatAsset(parsed.amount, symbol);
        }
        return fallback;
    }
    if (raw && typeof raw === "object") {
        // Pixagram fork NAI prefixes — adjust here if the chain changes.
        const naiToSym = {
            "@@000000021": SYM_PXA,
            "@@000000013": SYM_PXS,
            "@@000000037": SYM_PXP,
        };
        const amountInt = parseInt(raw.amount, 10);
        const precision = Number.isFinite(raw.precision) ? raw.precision : 3;
        const symbol    = naiToSym[raw.nai] || SYM_PXA;
        if (Number.isFinite(amountInt)) {
            return formatAsset(amountInt / Math.pow(10, precision), symbol);
        }
    }
    return fallback;
}

function extractErrorMessage(error) {
    if (!error) return "Unknown error";
    return (
        (error.jse_info && error.jse_info.stack && error.jse_info.stack[0] && error.jse_info.stack[0].format) ||
        (error.data && error.data.stack && error.data.stack[0] && error.data.stack[0].format) ||
        (error.payload && error.payload.error && error.payload.error.message) ||
        (error.payload && error.payload.error && error.payload.error.data && error.payload.error.data.stack && error.payload.error.data.stack[0] && error.payload.error.data.stack[0].format) ||
        error.message ||
        (typeof error === "string" ? error : null) ||
        "Unknown error"
    );
}

// =============================================================================
// NumberFormatCustom — same shape used by wallet dialogs
// =============================================================================

function NumberFormatCustom(props) {
    const { inputRef, onChange, currency, decimals, ...other } = props;
    return (
        <NumericFormat
            {...other}
            getInputRef={inputRef}
            onValueChange={(values) => {
                onChange({ target: { name: props.name, value: values.value } });
            }}
            thousandSeparator={" "}
            decimalSeparator={"."}
            allowedDecimalSeparators={[",", "."]}
            thousandsGroupStyle="thousand"
            decimalScale={decimals ?? 2}
            fixedDecimalScale={false}
            allowNegative={false}
            allowLeadingZeros={true}
            suffix={` ${currency || ""}`}
        />
    );
}

// =============================================================================
// STYLES — wallet-dialog idiom (#181818 paper, filled inputs, greyscale)
// =============================================================================

const styles = (theme) => ({
    darkGreyDialog: {
        backgroundColor: "#181818ff !important",
        "& .MuiButton-contained.Mui-disabled": { opacity: 0.35 },
    },
    sectionLabel: {
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "#888",
        margin: "20px 0 6px 0",
    },
    balanceLine: {
        display: "flex",
        justifyContent: "space-between",
        padding: "6px 0",
        fontSize: 13,
        color: "#bdbdbd",
    },
    balanceLineValue: {
        color: "#dcdcdc",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    },
    balanceBlock: {
        backgroundColor: "#101010",
        borderRadius: 12,
        padding: "8px 16px",
        marginTop: 4,
    },
    helperRow: {
        fontSize: 13,
        color: "#9b9b9b",
        margin: "4px 0 0 0",
        textAlign: "right",
    },
    statusPanel: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: "32px 16px",
        minHeight: 220,
        textAlign: "center",
    },
    statusIcon:      { fontSize: 64, color: "#e6e6e6" },
    statusIconError: { fontSize: 64, color: "#9e9e9e" },
    statusMessage:   { color: "#cccccc", fontSize: 14, maxWidth: 440 },
    errorMessage: {
        color: "#bdbdbd",
        fontSize: 13,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        backgroundColor: "#101010",
        border: "1px solid #262626",
        borderRadius: 12,
        padding: "12px 14px",
        maxWidth: 480,
        textAlign: "left",
    },
    progressOverlay: {
        position: "absolute",
        top: 0, left: 0, right: 0,
        height: 2,
        "& .MuiLinearProgress-barColorPrimary": { backgroundColor: "#7a7a7a" },
        "& .MuiLinearProgress-colorPrimary":    { backgroundColor: "#1a1a1a" },
    },
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const AddAccountDialog = ({ classes, open, api, onClose }) => {
    useLanguage();

    // ── Lifecycle / timers ───────────────────────────────────────────────────
    const isMounted      = useRef(true);
    const autoCloseTimer = useRef(null);
    const debounceRef    = useRef(null);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
            if (autoCloseTimer.current) { clearTimeout(autoCloseTimer.current); autoCloseTimer.current = null; }
            if (debounceRef.current)    { clearTimeout(debounceRef.current);    debounceRef.current    = null; }
        };
    }, []);

    // ── Wallet state ─────────────────────────────────────────────────────────
    const [currentAccount,     setCurrentAccount]     = useState(null);
    const [accountInfo,        setAccountInfo]        = useState(null);
    const [accountInfoLoading, setAccountInfoLoading] = useState(true);
    const [creationFee,        setCreationFee]        = useState(null);
    const [vestRatio,          setVestRatio]          = useState(0); // PXA per VESTS

    // ── Username state ───────────────────────────────────────────────────────
    const [username,            setUsername]            = useState("");
    const [usernameSyntaxError, setUsernameSyntaxError] = useState("");
    const [usernamePending,     setUsernamePending]     = useState(false);
    const [usernameAvailable,   setUsernameAvailable]   = useState(false);
    const [usernameTaken,       setUsernameTaken]       = useState(false);

    // ── Gift amounts (numeric floats; serialized at submit time) ────────────
    const [pxaAmount,  setPxaAmount]  = useState(0);
    const [pxsAmount,  setPxsAmount]  = useState(0);
    const [pxpAmount,  setPxpAmount]  = useState(0);

    // ── Status ───────────────────────────────────────────────────────────────
    // 'form' | 'working' | 'success' | 'error'
    const [status,         setStatus]         = useState("form");
    const [errorMessage,   setErrorMessage]   = useState("");
    const [autoCloseInSec, setAutoCloseInSec] = useState(null);
    const [pdfDownloaded,  setPdfDownloaded]  = useState(false);
    const lastPdfBlob      = useRef(null);
    const lastUsername     = useRef("");

    // ─────────────────────────────────────────────────────────────────────────
    // Load: current account + balances + creation fee
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!open || !api) return;
        let cancelled = false;

        (async () => {
            setAccountInfoLoading(true);
            try {
                const acct =
                    (api.sessionManager && api.sessionManager.currentAccount) ||
                    (await api.sessionManager?.getActiveAccount?.()) ||
                    null;

                if (!acct) {
                    if (!cancelled && isMounted.current) {
                        setStatus("error");
                        setErrorMessage("You must be logged in to create an account from your credits.");
                        setAccountInfoLoading(false);
                    }
                    return;
                }
                if (cancelled || !isMounted.current) return;
                setCurrentAccount(acct);

                const [infoArr, props, dgp] = await Promise.all([
                    api.accounts.getAccounts([acct], true).catch(() => []),
                    api.globals.getChainProperties().catch(() => null),
                    // Dynamic global properties carry total_vesting_fund_pixa and
                    // total_vesting_shares (the VESTS↔PXA ratio). Adjust this
                    // method path if your `api` wrapper exposes it elsewhere.
                    (api.globals.getDynamicGlobalProperties
                        ? api.globals.getDynamicGlobalProperties().catch(() => null)
                        : Promise.resolve(null)),
                ]);
                if (cancelled || !isMounted.current) return;

                const info = (infoArr && infoArr[0]) || null;
                setAccountInfo(info);

                const raw = props && props.account_creation_fee;
                try { console.log("[AddAccountDialog] raw account_creation_fee:", raw); } catch (_) {}
                const feeDisplay = normalizeFee(raw);
                console.log("[AddAccountDialog] resolved creation fee:", feeDisplay);
                setCreationFee(feeDisplay);

                const ratio = vestRatioFromDGP(dgp);
                console.log("[AddAccountDialog] vesting ratio (PXA per VESTS):", ratio);
                setVestRatio(ratio);

                setAccountInfoLoading(false);
            } catch (err) {
                console.error("[AddAccountDialog] account/fee load failed:", err);
                if (!cancelled && isMounted.current) {
                    setStatus("error");
                    setErrorMessage("Could not read your wallet. " + (err && err.message ? err.message : ""));
                    setAccountInfoLoading(false);
                }
            }
        })();

        return () => { cancelled = true; };
    }, [open, api]);

    // ─────────────────────────────────────────────────────────────────────────
    // Derived balances and spendable caps
    // ─────────────────────────────────────────────────────────────────────────
    const pxaBalance = useMemo(
        () => assetAmount(accountInfo?.balance || formatAsset(0, SYM_PXA)),
        [accountInfo]
    );
    const pxsBalance = useMemo(
        () => assetAmount(accountInfo?.pxs_balance || formatAsset(0, SYM_PXS)),
        [accountInfo]
    );
    // Raw VESTS the delegator can actually delegate (own − already delegated).
    // This is the hard cap the chain enforces; the broadcast amount is clamped
    // to it so a "max" Power selection can't round above the real balance.
    const pxpAvailableVests = useMemo(() => {
        if (!accountInfo) return 0;
        const own       = assetAmount(accountInfo.vesting_shares           || "");
        const delegated = assetAmount(accountInfo.delegated_vesting_shares || "");
        return Math.max(0, own - delegated);
    }, [accountInfo]);

    // Same balance expressed in PXP (PXA-equivalent Power) for display + input.
    // 0 when the vesting ratio is unknown, which disables the PXP field.
    const pxpAvailable = useMemo(
        () => (vestRatio > 0 ? pxpAvailableVests * vestRatio : 0),
        [pxpAvailableVests, vestRatio]
    );

    const creationFeeAmount = useMemo(
        () => assetAmount(creationFee || formatAsset(0, SYM_PXA)),
        [creationFee]
    );

    // PXA available to gift = balance - creation fee. Negative ⇒ can't afford.
    const pxaGiftCap = useMemo(
        () => Math.max(0, pxaBalance - creationFeeAmount),
        [pxaBalance, creationFeeAmount]
    );

    const canAffordFee = pxaBalance >= creationFeeAmount && creationFee !== null;

    // ─────────────────────────────────────────────────────────────────────────
    // Username handler
    // ─────────────────────────────────────────────────────────────────────────
    const onUsernameChange = useCallback(async (e) => {
        const raw = String(e?.target?.value || "").toLowerCase();
        setUsername(raw);
        setUsernameTaken(false);
        setUsernameAvailable(false);
        setUsernameSyntaxError("");

        if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }

        if (!raw.length) {
            setUsernamePending(false);
            return;
        }
        setUsernamePending(true);

        let syntaxErr = "";
        try {
            const v = await validateUsername(raw);
            syntaxErr = v === null ? "" : v;
        } catch (_) { syntaxErr = ""; }

        if (!isMounted.current) return;
        if (syntaxErr && syntaxErr.length) {
            setUsernameSyntaxError(syntaxErr);
            setUsernamePending(false);
            return;
        }

        debounceRef.current = setTimeout(async () => {
            try {
                const accounts = await api.accounts.getAccounts([raw]);
                if (!isMounted.current) return;
                const taken = Boolean(accounts && accounts[0] && accounts[0].name === raw);
                setUsernamePending(false);
                setUsernameTaken(taken);
                setUsernameAvailable(!taken);
            } catch (err) {
                console.error("[AddAccountDialog] availability check failed:", err);
                if (!isMounted.current) return;
                setUsernamePending(false);
                setUsernameAvailable(false);
                setUsernameTaken(false);
            }
        }, 250);
    }, [api]);

    // ─────────────────────────────────────────────────────────────────────────
    // Text-field amount handlers — clamp to the spendable cap and round to
    // the asset's precision.
    // ─────────────────────────────────────────────────────────────────────────
    // Each handler doubles as the field's onChange (unwraps the event itself),
    // so renderAmountField no longer wraps it in a fresh arrow per render.
    const setPxaFromAmount = useCallback((n) => {
        if (n && n.target) n = n.target.value;
        setPxaAmount(roundToPrec(clampToMax(n, pxaGiftCap), SYM_PXA));
    }, [pxaGiftCap]);

    const setPxsFromAmount = useCallback((n) => {
        if (n && n.target) n = n.target.value;
        setPxsAmount(roundToPrec(clampToMax(n, pxsBalance), SYM_PXS));
    }, [pxsBalance]);

    const setPxpFromAmount = useCallback((n) => {
        if (n && n.target) n = n.target.value;
        setPxpAmount(roundToPrec(clampToMax(n, pxpAvailable), SYM_PXP));
    }, [pxpAvailable]);

    // ─────────────────────────────────────────────────────────────────────────
    // PDF download — triggered after a successful broadcast
    // ─────────────────────────────────────────────────────────────────────────
    const triggerPdfDownload = useCallback(() => {
        const blob = lastPdfBlob.current;
        const name = lastUsername.current;
        if (!blob || !name) return;
        try {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.download = `KeysOf-${name}-Pixagram.pdf`;
            a.href = url;
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            setPdfDownloaded(true);
        } catch (err) {
            console.error("[AddAccountDialog] PDF download failed:", err);
        }
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // Auto-close countdown after success
    // ─────────────────────────────────────────────────────────────────────────
    const startAutoClose = useCallback(() => {
        let remaining = Math.ceil(AUTO_CLOSE_MS / 1000);
        setAutoCloseInSec(remaining);
        const tick = () => {
            remaining -= 1;
            if (!isMounted.current) return;
            if (remaining <= 0) {
                setAutoCloseInSec(0);
                if (autoCloseTimer.current) { clearTimeout(autoCloseTimer.current); autoCloseTimer.current = null; }
                onClose && onClose();
                return;
            }
            setAutoCloseInSec(remaining);
            autoCloseTimer.current = setTimeout(tick, 1000);
        };
        if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
        autoCloseTimer.current = setTimeout(tick, 1000);
    }, [onClose]);

    // ─────────────────────────────────────────────────────────────────────────
    // Submit — derives keys, builds ops, broadcasts in one click
    // ─────────────────────────────────────────────────────────────────────────
    const canSubmit = useMemo(() => {
        if (status !== "form")    return false;
        if (!currentAccount)      return false;
        if (!usernameAvailable)   return false;
        if (usernamePending)      return false;
        if (!canAffordFee)        return false;
        return true;
    }, [status, currentAccount, usernameAvailable, usernamePending, canAffordFee]);

    const handleSubmit = useCallback(async () => {
        if (!canSubmit) return;

        setStatus("working");
        setErrorMessage("");

        try {
            // 1. Derive keys inline so any failure surfaces in the error panel.
            console.log("[AddAccountDialog] generating mnemonic…");
            // Seed wordlist follows the active UI language; languages without
            // a BIP-39 wordlist fall back to English inside BackUpWallet2.
            const seed = await generateMnemonic(18, getLanguage());
            console.log("[AddAccountDialog] deriving master key…");
            const masterKey = await generateMasterKey(seed, "");
            console.log("[AddAccountDialog] building backup PDF + role keys…");
            const [pdfBlob, keys] = await generatePDF(username, seed, "", masterKey);
            const pub = keys && keys.pub;
            if (!pub || !pub.owner || !pub.active || !pub.posting || !pub.memo) {
                throw new Error("Key derivation returned an incomplete authority set.");
            }
            lastPdfBlob.current  = pdfBlob;
            lastUsername.current = username;

            // 2. Re-fetch the fee just before signing (validators reject
            //    account_create with a stale fee on fee-bump blocks).
            let feeForOp = creationFee;
            try {
                const props = await api.globals.getChainProperties();
                feeForOp = normalizeFee(props && props.account_creation_fee, creationFee);
            } catch (_) { /* fall back to dialog-load fee */ }
            console.log("[AddAccountDialog] fee for op:", feeForOp);

            // 3. Build the op array (display → chain symbols at this boundary).
            const feeParsed = parseAsset(feeForOp) || { amount: 0, symbol: SYM_PXA };
            const ops = [];

            ops.push(["account_create", {
                fee: toChainAsset(feeParsed.amount, feeParsed.symbol),
                creator: currentAccount,
                new_account_name: username,
                owner:   buildAuth(pub.owner),
                active:  buildAuth(pub.active),
                posting: buildAuth(pub.posting),
                memo_key: pub.memo,
                json_metadata: JSON.stringify({
                    created_by: "pixagram-credit-gift",
                    created_at: new Date().toISOString(),
                    gifter: currentAccount,
                }),
            }]);

            if (pxpAmount > 0) {
                // pxpAmount is PXP (PXA-equivalent Power). The chain only knows
                // VESTS, so convert back here, clamped to the real available
                // VESTS so a "max" selection can't be rejected for overshoot.
                ops.push(["delegate_vesting_shares", {
                    delegator: currentAccount,
                    delegatee: username,
                    vesting_shares: powerToVestsAsset(pxpAmount, vestRatio, pxpAvailableVests),
                }]);
            }
            if (pxaAmount > 0) {
                ops.push(["transfer", {
                    from: currentAccount,
                    to:   username,
                    amount: toChainAsset(pxaAmount, SYM_PXA),
                    memo:   "Welcome to Pixagram",
                }]);
            }
            if (pxsAmount > 0) {
                ops.push(["transfer", {
                    from: currentAccount,
                    to:   username,
                    amount: toChainAsset(pxsAmount, SYM_PXS),
                    memo:   "Welcome to Pixagram",
                }]);
            }

            console.log("[AddAccountDialog] ops:", JSON.stringify(ops, null, 2));

            // 4. Active key (UnlockKeyDialog stacks if the vault is locked).
            console.log("[AddAccountDialog] requesting active key for", currentAccount);
            const key = await api.keyManager.requestKey(currentAccount, "active");

            // 5. Atomic broadcast.
            console.log("[AddAccountDialog] broadcasting…");
            const result = await api.broadcast.sendOperations(ops, key);
            console.log("[AddAccountDialog] broadcast result:", result);

            if (!isMounted.current) return;

            // 6. Force-download the recipient's backup PDF and show success.
            triggerPdfDownload();
            if (actions && actions.trigger_snackbar) {
                actions.trigger_snackbar(t("components.add_account_dialog.account_created", {
                    username: username
                }));
            }
            try { await api.accounts.getAccounts([currentAccount], true); } catch (_) {}

            setStatus("success");
            startAutoClose();
        } catch (err) {
            console.error("[AddAccountDialog] account creation failed:", err);
            if (!isMounted.current) return;
            setStatus("error");
            setErrorMessage(extractErrorMessage(err) || "The transaction was rejected. Please try again.");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canSubmit, api, currentAccount, username, creationFee, pxaAmount, pxsAmount, pxpAmount, vestRatio, pxpAvailableVests, triggerPdfDownload, startAutoClose]);

    const handleRetry = useCallback(() => {
        setStatus("form");
        setErrorMessage("");
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // Username helper icon and message
    // ─────────────────────────────────────────────────────────────────────────
    const usernameIcon = useMemo(() => {
        if (username.length === 0)                                  return <AccountQuestion style={ICON_GREY_STYLE} />;
        if (usernamePending)                                        return <CircularProgress size={20} style={GREY_SPINNER_STYLE} />;
        if (usernameSyntaxError && usernameSyntaxError.length)      return <AccountAlert    style={ICON_MID_STYLE} />;
        if (usernameTaken)                                          return <AccountRemove   style={ICON_MID_STYLE} />;
        if (usernameAvailable)                                      return <AccountCheck    style={ICON_LIGHT_STYLE} />;
        return <AccountQuestion style={ICON_GREY_STYLE} />;
    }, [username, usernamePending, usernameSyntaxError, usernameTaken, usernameAvailable]);

    const usernameHelper = useMemo(() => {
        if (username.length === 0)                              return "";
        if (usernameSyntaxError && usernameSyntaxError.length)  return usernameSyntaxError;
        if (usernamePending)                                    return "Checking availability…";
        if (usernameTaken)                                      return "That username is already taken.";
        if (usernameAvailable)                                  return "Available.";
        return "";
    }, [username, usernameSyntaxError, usernamePending, usernameTaken, usernameAvailable]);

    // ─────────────────────────────────────────────────────────────────────────
    // Render helper — one filled text field per gift amount
    // ─────────────────────────────────────────────────────────────────────────
    const renderAmountField = ({ label, currency, decimals, icon, value, max, onAmountChange, helperText }) => (
        <TextField
            style={AMOUNT_FIELD_STYLE}
            fullWidth
            onChange={onAmountChange}
            label={label}
            variant="filled"
            value={Number(value || 0)}
            InputLabelProps={SHRINK_LABEL_PROPS}
            InputProps={{
                inputComponent: NumberFormatCustom,
                inputProps: { currency, decimals },
                startAdornment: icon,
            }}
            helperText={helperText}
            disabled={max <= 0}
        />
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────
    const renderForm = () => (
        <Fade in timeout={200}>
            <div>
                <Typography component="h2" variant="h6" style={TITLE_ROW_STYLE}>
                    <AccountPlus style={TITLE_ICON_STYLE} />
                    {t("components.add_account_dialog.create_an_account_with_your_credits")}
                </Typography>
                <Typography variant="body2" color="textSecondary" component="p" style={INTRO_STYLE}>
                    {t("components.add_account_dialog.spend_your_own_balance_to_mint_a")}
                </Typography>

                {/* ── Recipient ── */}
                <div className={classes.sectionLabel}>{t("words.recipient")}</div>
                <TextField
                    fullWidth
                    variant="filled"
                    label={t("words.username")}
                    value={username}
                    onChange={onUsernameChange}
                    InputLabelProps={SHRINK_LABEL_PROPS}
                    InputProps={{
                        startAdornment: <span style={USERNAME_AT_STYLE}>@</span>,
                        endAdornment: <InputAdornment position="end">{usernameIcon}</InputAdornment>,
                    }}
                    inputProps={USERNAME_INPUT_PROPS}
                />
                <Collapse in={usernameHelper.length > 0 && username.length > 0}>
                    <Typography className={classes.helperRow}>{usernameHelper}</Typography>
                </Collapse>

                {/* ── Wallet summary ── */}
                <div className={classes.sectionLabel}>{t("components.add_account_dialog.your_wallet")}</div>
                {accountInfoLoading ? (
                    <div style={WALLET_SPINNER_WRAP_STYLE}>
                        <CircularProgress size={20} style={GREY_SPINNER_STYLE} />
                    </div>
                ) : (
                    <div className={classes.balanceBlock}>
                        <div className={classes.balanceLine}>
                            <span>{t("components.add_account_dialog.pxa_balance")}</span>
                            <span className={classes.balanceLineValue}>{formatAsset(pxaBalance, SYM_PXA)}</span>
                        </div>
                        <div className={classes.balanceLine}>
                            <span>{t("components.add_account_dialog.pxs_balance")}</span>
                            <span className={classes.balanceLineValue}>{formatAsset(pxsBalance, SYM_PXS)}</span>
                        </div>
                        <div className={classes.balanceLine}>
                            <span>{t("components.add_account_dialog.pxp_available_to_delegate")}</span>
                            <span className={classes.balanceLineValue}>{formatAsset(pxpAvailable, SYM_PXP)}</span>
                        </div>
                        <div className={classes.balanceLine}>
                            <span>{t("components.add_account_dialog.account_creation_fee")}</span>
                            <span className={classes.balanceLineValue}>− {creationFee || ("3.000 " + SYM_PXA)}</span>
                        </div>
                    </div>
                )}
                {!accountInfoLoading && !canAffordFee && (
                    <Typography style={CANT_AFFORD_STYLE}>{t("components.add_account_dialog.your_pxa_balance_does_not_cover_the", {
                            creationFee: creationFee
                        })}</Typography>
                )}

                {/* ── PXA gift ── */}
                <div className={classes.sectionLabel}>{t("components.add_account_dialog.send_pxa")}</div>
                {renderAmountField({
                    label: "Amount",
                    currency: "PXA",
                    decimals: 3,
                    icon: PXA_FIELD_ICON,
                    value: pxaAmount,
                    max: pxaGiftCap,
                    onAmountChange: setPxaFromAmount,
                    helperText: t("components.add_account_dialog.max_pxa_after_fee", {
                        pxaGiftCap: pxaGiftCap.toFixed(PREC[SYM_PXA])
                    }),
                })}

                {/* ── PXS gift ── */}
                <div className={classes.sectionLabel}>{t("components.add_account_dialog.send_pxs")}</div>
                {renderAmountField({
                    label: "Amount",
                    currency: "PXS",
                    decimals: 3,
                    icon: PXS_FIELD_ICON,
                    value: pxsAmount,
                    max: pxsBalance,
                    onAmountChange: setPxsFromAmount,
                    helperText: t("components.add_account_dialog.max_pxs", {
                        pxsBalance: pxsBalance.toFixed(PREC[SYM_PXS])
                    }),
                })}

                {/* ── PXP delegation (shown as PXA-equivalent Power; sent as VESTS) ── */}
                <div className={classes.sectionLabel}>{t("components.add_account_dialog.delegate_pxp")}</div>
                {renderAmountField({
                    label: "Amount",
                    currency: "PXP",
                    decimals: 3,
                    icon: PXP_FIELD_ICON,
                    value: pxpAmount,
                    max: pxpAvailable,
                    onAmountChange: setPxpFromAmount,
                    helperText: vestRatio > 0
                        ? t(
                        "components.add_account_dialog.max_pxp_delegated_as_vesting_shares_returns",
                        {
                            pxpAvailable: pxpAvailable.toFixed(PREC[SYM_PXP])
                        }
                    )
                        : "Vesting rate unavailable — PXP delegation is temporarily disabled.",
                })}
            </div>
        </Fade>
    );

    const renderWorking = () => (
        <div className={classes.statusPanel}>
            <CircularProgress size={48} style={WORKING_SPINNER_STYLE} />
            <Typography className={classes.statusMessage}>
                {t(
                    "components.add_account_dialog.generating_keys_signing_the_transaction_broadcas"
                )}
            </Typography>
        </div>
    );

    const renderSuccess = () => (
        <div className={classes.statusPanel}>
            <CheckCircleOutlineIcon className={classes.statusIcon} />
            <Typography className={classes.statusMessage}>
                <strong style={SUCCESS_NAME_STYLE}>@{username}</strong> {t("components.add_account_dialog.is_live_on_chain")}
            </Typography>
            <Typography className={classes.statusMessage} style={SUCCESS_SUB_STYLE}>{t(
                    "components.add_account_dialog.the_recipients_keys_backup_pdf_was_downloaded",
                    {
                        text: pdfDownloaded ? " — please hand it over securely." : "."
                    }
                )}</Typography>
            {!pdfDownloaded && (
                <Button variant="contained" color="primary" onClick={triggerPdfDownload}>
                    {t("components.add_account_dialog.re_download_backup_pdf")}
                </Button>
            )}
            {autoCloseInSec !== null && (
                <Typography style={AUTO_CLOSE_STYLE}>{t("components.add_account_dialog.closing_in_s", {
                        autoCloseInSec: autoCloseInSec
                    })}</Typography>
            )}
        </div>
    );

    const renderError = () => (
        <div className={classes.statusPanel}>
            <AccountAlert className={classes.statusIconError} />
            <Typography className={classes.statusMessage}>
                {t("components.add_account_dialog.the_account_could_not_be_created")}
            </Typography>
            <div className={classes.errorMessage}>{errorMessage || "Unknown error."}</div>
        </div>
    );

    // Build a friendly hint for *why* the button is disabled — surfaces in a
    // tooltip so the user isn't left wondering.
    const disabledHint = useMemo(() => {
        if (canSubmit) return "";
        if (!currentAccount)                  return "Resolving your active account…";
        if (accountInfoLoading)               return "Loading your wallet…";
        if (!username.length)                 return "Choose a username for the new account.";
        if (usernamePending)                  return "Checking that username on-chain…";
        if (usernameSyntaxError &&
            usernameSyntaxError.length)       return usernameSyntaxError;
        if (usernameTaken)                    return "That username is already taken.";
        if (!usernameAvailable)               return "Pick a valid, available username.";
        if (!canAffordFee)                    return t("components.add_account_dialog.your_pxa_balance_does_not_cover_the", {
            creationFee: creationFee || ""
        });
        return "";
    }, [canSubmit, currentAccount, accountInfoLoading, username, usernamePending, usernameSyntaxError, usernameTaken, usernameAvailable, canAffordFee, creationFee]);

    return (
        <Dialog
            open={!!open}
            fullWidth
            maxWidth="sm"
            disablePortal={false}
            onClose={status === "working" ? undefined : onClose}
            disableEscapeKeyDown={status === "working"}
            disableBackdropClick={status === "working"}
            keepMounted={false}
            PaperProps={{ classes: { root: classes.darkGreyDialog } }}
        >
            {status === "working" && <LinearProgress className={classes.progressOverlay} />}
            <DialogContent>
                {status === "form"    && renderForm()}
                {status === "working" && renderWorking()}
                {status === "success" && renderSuccess()}
                {status === "error"   && renderError()}
            </DialogContent>
            <DialogActions style={ACTIONS_STYLE}>
                {status === "form" && (
                    <>
                        <Button variant="text" color="primary" onClick={onClose}>{t("words.cancel", {TUC: true})}</Button>
                        <Tooltip
                            title={disabledHint}
                            disableHoverListener={canSubmit}
                            disableFocusListener={canSubmit}
                            disableTouchListener={canSubmit}
                        >
                            <span>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    autoFocus
                                    onClick={handleSubmit}
                                    disabled={!canSubmit}
                                >{t("words.create", {TUC: true})} </Button>
                            </span>
                        </Tooltip>
                    </>
                )}
                {status === "working" && (
                    <Button variant="text" color="primary" disabled>{t("components.add_account_dialog.working")}</Button>
                )}
                {status === "success" && (
                    <Button variant="contained" color="primary" onClick={onClose}>{t("words.done", {TUC: true})}</Button>
                )}
                {status === "error" && (
                    <>
                        <Button variant="text" color="primary" onClick={onClose}>{t("words.cancel", {TUC: true})}</Button>
                        <Button variant="contained" color="primary" onClick={handleRetry}>{t("components.add_account_dialog.try_again")}</Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    );
};

AddAccountDialog.displayName = "AddAccountDialog";
export default withStyles(styles)(memo(AddAccountDialog));