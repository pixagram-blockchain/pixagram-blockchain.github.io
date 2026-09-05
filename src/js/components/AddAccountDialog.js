// =============================================================================
// AddAccountDialog.js
//
// "Create an account with your credits" — a one-step dialog styled to match
// the wallet's Send / Delegate / Power dialogs. An already-logged-in user
// mints a fresh on-chain account for someone else, in a single atomic
// multi-op transaction. Two creation methods are offered:
//
//   Resource Credits (default when usable — no PXA leaves the wallet):
//       [claim_account (fee 0)]      ← skipped when the creator already holds
//                                      a claimed-account token
//       + create_claimed_account
//       + (optional) delegate_vesting_shares
//       + (optional) transfer PXA
//       + (optional) transfer PXS
//
//   PXA fee (the original path):
//       account_create + the same optional gifts
//
// There is intentionally no seed-recovery branch and no phone verification:
// the creator either pays the chain fee or spends Resource Credits, so the
// chain itself is the anti-spam mechanism.
//
// Visual contract
// ---------------
//   - Dark-grey paper (#181818), the same `darkGreyDialog` palette used by
//     PixaWalletSendDialog / DelegateDialog / PowerDialog.
//   - Filled TextField for username; one filled TextField for each of the
//     three gift amounts. NumericFormat input formatting matches the
//     wallet dialogs (space thousand separator, dot decimal).
//   - Strict greyscale — no theme accents. The method selector is a
//     two-cell segmented control in the same #101010 / #262626 idiom as the
//     wallet summary block.
//
// Behaviour
// ---------
//   - Username validated synchronously (validateUsername) and asynchronously
//     (api.accounts.getAccounts) with 250ms debounce.
//   - Keys are NOT pre-generated in the background; they are derived inline
//     when the user clicks CREATE, so the button's enabled-state never
//     depends on async background success. If derivation fails, the error
//     panel surfaces the actual exception.
//   - Chain reads: `api.globals.getChainProperties()`,
//     `api.globals.getDynamicGlobalProperties()` (raw pass-through — carries
//     total_vesting_shares and available_account_subsidies) and
//     `api.accounts.getAccounts(...)` (sanitized; carries
//     pending_claimed_accounts since pixaproxyapi v4.4.x).
//   - Resource Credits come from pixaproxyapi's `api.rc` group, which wraps
//     the dpixa client.rc API documented in @pixagram/dpixa's README:
//     getRCMana (manabar), getResourceParams / getResourcePool (RC pricing)
//     and getRcStats (rc_api.get_rc_stats, HF26+ regen shares). RC reads
//     never block the wallet summary; when they are unavailable the RC
//     method stays selectable and the chain has the final word.
//   - The on-screen RC cost is computed with the chain's own formula
//     (resource_credits::compute_cost) from the live pool state, so it is an
//     estimate only in the sense that pools move between blocks. It never
//     hard-blocks the CREATE button: the chain's rejection message states
//     the exact RC needed, so an optimistic attempt is always informative.
//     The only hard block is chain-exact: no claimed token AND the chain's
//     subsidized-account pool is empty (claim_account with fee 0 cannot pass).
//   - PXP is presented as PXA-equivalent Power (VESTS × the vesting-fund ratio
//     from dynamic global properties) but always delegated on-chain as VESTS.
//   - All user-facing strings are keyed under components.add_account_dialog
//     (plus words.amount); the memo "Welcome to Pixagram" goes on-chain and
//     stays English on purpose.
//   - Broadcast is one call to `api.broadcast.sendOperations(ops, key)`
//     after `keyManager.requestKey(currentAccount, "active")` — both
//     claim_account and create_claimed_account are active-key operations.
//     If the vault is locked, the existing UnlockKeyDialog stacks on top.
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
import ButtonBase from "@material-ui/core/ButtonBase";
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
import FlashOnIcon from "@material-ui/icons/FlashOn";
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

// Creation methods.
const METHOD_RC  = "rc";   // claim_account (fee 0) + create_claimed_account
const METHOD_FEE = "fee";  // account_create, fee paid in PXA

// ── Chain constants (Hive protocol, inherited by the Pixa fork) ─────────────
const RC_REGEN_TIME_SEC         = 60 * 60 * 24 * 5;               // HIVE_RC_REGEN_TIME: empty → full in 5 days
const BLOCK_INTERVAL_SEC        = 3;                              // HIVE_BLOCK_INTERVAL
const RC_REGEN_BLOCKS           = RC_REGEN_TIME_SEC / BLOCK_INTERVAL_SEC; // 144 000
const HIVE_100_PERCENT          = 10000;                          // basis points
const ACCOUNT_SUBSIDY_PRECISION = HIVE_100_PERCENT;               // one subsidized account in available_account_subsidies

// rc_resource_types, in chain index order. get_resource_params /
// get_resource_pool key their maps by these names; get_rc_stats().share is
// an array indexed the same way.
const RC_RESOURCE_KEYS = [
    "resource_history_bytes",
    "resource_new_accounts",
    "resource_market_bytes",
    "resource_state_bytes",
    "resource_execution_time",
];

// Resource usage the chain books for our transaction — constants lifted from
// libraries/chain/rc/resource_sizes.cpp + resource_count.cpp (Hive master).
// They only matter for the on-screen estimate; the node computes the real
// bill with its own copies.
const PERSISTENT_STATE_BYTE = 5 * 365 * 24;   // a state byte kept ~5 years
const LASTING_STATE_BYTE    = 5 * 365 * 12;   // ~2.5 years
const RC_STATE_BYTES = {
    account_create_base:     (616 + 144 + 312) * PERSISTENT_STATE_BYTE, // account + account_authority objects
    authority_key_member:    36 * PERSISTENT_STATE_BYTE,                // per key in an authority
    transaction_base:        128,                                       // × expiry hours (1 for our 1-min expiry)
    delegate_vesting_shares: 88 * LASTING_STATE_BYTE,                   // vesting_delegation_object
};
const RC_EXEC_TIME = {
    transaction:      2821 + 386 + 3415,
    verify_authority: 94165,                        // per signature
    claim_account:    336 + 8028 + 267 + 150,
    create_claimed:   964 + 46331 + 342 + 10778,
    transfer:         638 + 5023 + 204 + 134,
    delegate:         411 + 11998 + 3110 + 1208,
};
// Serialized transaction size (history / market bytes) — header + one
// signature, then per-op sizes for the shapes this dialog builds.
const TX_BYTES = {
    base:           12 + 66,
    claim:          32,
    create_claimed: 290,    // three single-key authorities + memo key + json_metadata
    transfer:       60,
    delegate:       40,
};

const HAS_BIGINT = typeof BigInt === "function";

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

/** 1234567 → "1 234 567" (space separator, like the NumericFormat inputs). */
function formatInt(n) {
    const v = Math.floor(Number(n) || 0);
    return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Compact RC figure: 1.24 T RC / 812.5 M RC / 42 k RC. */
function formatRc(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "—";
    const abs = Math.abs(v);
    if (abs >= 1e12) return `${(v / 1e12).toFixed(2)} T RC`;
    if (abs >= 1e9)  return `${(v / 1e9).toFixed(2)} B RC`;
    if (abs >= 1e6)  return `${(v / 1e6).toFixed(1)} M RC`;
    if (abs >= 1e3)  return `${(v / 1e3).toFixed(0)} k RC`;
    return `${Math.round(v)} RC`;
}

/** Regeneration delay for the RC shortfall warning — locale-keyed. */
function formatRegenTime(h) {
    if (!(h > 0)) return "";
    if (h < 1)  return t("components.add_account_dialog.regen_under_an_hour");
    if (h < 48) return t("components.add_account_dialog.regen_hours", { hours: Math.ceil(h) });
    return t("components.add_account_dialog.regen_days", { days: (h / 24).toFixed(1) });
}

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
const METHOD_ICON_STYLE = { fontSize: 18 };
const RC_OPTION_ICON  = <FlashOnIcon style={METHOD_ICON_STYLE} />;
const FEE_OPTION_ICON = <PixaLiquid  style={METHOD_ICON_STYLE} />;
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
const ERROR_HINT_STYLE = { color: "#9b9b9b", fontSize: 13, maxWidth: 480 };
const ACTIONS_STYLE = { textAlign: "right" };
const ICON_GREY_STYLE = { color: "#777" };
const ICON_MID_STYLE = { color: "#a0a0a0" };
const ICON_LIGHT_STYLE = { color: "#e0e0e0" };

// Resource-Credits read state. `supported` is false when the api wrapper has
// no rc group; `loading` covers the four parallel RC calls.
const RC_INITIAL = { loading: false, supported: false, mana: null, params: null, pool: null, stats: null };

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
 * total_vesting_shares as an exact integer in the asset's smallest unit
 * (satoshi-VESTS, 6 dp) — the value the chain feeds into RC regen:
 * rc_regen = total_vesting_shares.amount / (HIVE_RC_REGEN_TIME / HIVE_BLOCK_INTERVAL).
 * Accepts the legacy "123.456789 VESTS" string or a NAI object. Null when
 * unparseable or when BigInt is unavailable.
 */
function vestingUnitsFromDGP(dgp) {
    if (!HAS_BIGINT || !dgp) return null;
    const raw = dgp.total_vesting_shares;
    try {
        if (typeof raw === "string") {
            const m = raw.trim().match(/^(\d+)(?:\.(\d*))?\s+[A-Z]+$/);
            if (!m) return null;
            const frac = ((m[2] || "") + "0".repeat(VESTS_PRECISION)).slice(0, VESTS_PRECISION);
            return BigInt(m[1] + frac);
        }
        if (raw && typeof raw === "object" && raw.amount !== undefined) {
            const precision = Number.isFinite(raw.precision) ? raw.precision : VESTS_PRECISION;
            let units = BigInt(String(raw.amount));
            if (precision < VESTS_PRECISION) units *= BigInt(Math.pow(10, VESTS_PRECISION - precision));
            return units;
        }
    } catch (_) { /* fall through */ }
    return null;
}

/** Lenient BigInt coercion for chain numbers that arrive as number or string. */
function toBig(v) {
    if (!HAS_BIGINT || v === null || v === undefined) return null;
    try {
        if (typeof v === "bigint") return v;
        if (typeof v === "number") return Number.isFinite(v) ? BigInt(Math.trunc(v)) : null;
        if (typeof v === "string") {
            const s = v.trim();
            return /^-?\d+$/.test(s) ? BigInt(s) : null;
        }
    } catch (_) { /* fall through */ }
    return null;
}

/**
 * resource_credits::compute_cost — the chain's RC price of `count` units of
 * one resource against its current pool:
 *
 *     cost = ((regen × coeff_a) >> shift + 1) × count / (coeff_b + max(pool, 0)) + 1
 *
 * Everything is 128-bit on the node, hence BigInt here.
 */
function rcCostOfResource(curve, poolUnits, count, regenShare) {
    const ZERO = BigInt(0);
    if (count <= ZERO) return ZERO;
    const a = toBig(curve.coeff_a);
    const b = toBig(curve.coeff_b);
    const shift = toBig(curve.shift);
    if (a === null || b === null || shift === null) return null;
    let num = regenShare * a;
    num >>= shift;
    num += BigInt(1);
    num *= count;
    let denom = b;
    if (poolUnits > ZERO) denom += poolUnits;
    if (denom <= ZERO) return null;
    return num / denom + BigInt(1);
}

/**
 * RC bill of the creation transaction this dialog is about to broadcast.
 *
 *   params / pool  — rc_api.get_resource_params / get_resource_pool
 *   stats          — rc_api.get_rc_stats (HF26+): `share[i]` is the basis-point
 *                    slice of the global regen assigned to pool i. Without it
 *                    (pre-HF26 nodes) every pool is priced against the full
 *                    regen, which is what those nodes do.
 *   claim          — true when a claim_account op is included
 *   transfers      — number of transfer ops (each is a "market" op)
 *   delegation     — whether a delegate_vesting_shares op is included
 *
 * Returns a Number (RC) or null when the inputs can't be trusted.
 */
function estimateCreationRc({ params, pool, stats, totalVestingUnits, claim, transfers, delegation }) {
    if (!HAS_BIGINT || !params || !pool || totalVestingUnits === null) return null;
    const ZERO = BigInt(0);
    const regen = totalVestingUnits / BigInt(RC_REGEN_BLOCKS);
    if (regen <= ZERO) return 0; // the node makes everything free when regen is 0

    const txBytes =
        TX_BYTES.base + (claim ? TX_BYTES.claim : 0) + TX_BYTES.create_claimed +
        transfers * TX_BYTES.transfer + (delegation ? TX_BYTES.delegate : 0);
    const stateBytes =
        RC_STATE_BYTES.transaction_base + RC_STATE_BYTES.account_create_base +
        3 * RC_STATE_BYTES.authority_key_member +
        (delegation ? RC_STATE_BYTES.delegate_vesting_shares : 0);
    const execTime =
        RC_EXEC_TIME.transaction + RC_EXEC_TIME.verify_authority +
        (claim ? RC_EXEC_TIME.claim_account : 0) + RC_EXEC_TIME.create_claimed +
        transfers * RC_EXEC_TIME.transfer + (delegation ? RC_EXEC_TIME.delegate : 0);

    // Same index order as RC_RESOURCE_KEYS.
    const usage = [txBytes, claim ? 1 : 0, transfers > 0 ? txBytes : 0, stateBytes, execTime];
    const share = stats && Array.isArray(stats.share) && stats.share.length === RC_RESOURCE_KEYS.length
        ? stats.share
        : null;

    let total = ZERO;
    for (let i = 0; i < RC_RESOURCE_KEYS.length; i++) {
        const key = RC_RESOURCE_KEYS[i];
        const p = params[key];
        const q = pool[key];
        if (!p || !p.price_curve_params || !q) return null;
        const poolUnits = toBig(q.pool);
        if (poolUnits === null) return null;
        // Usage is booked in pool units (new accounts: 10 000 units per account).
        const unitRaw = toBig(p.resource_dynamics_params && p.resource_dynamics_params.resource_unit);
        const unit = unitRaw !== null && unitRaw > ZERO ? unitRaw : BigInt(1);
        let regenShare = regen;
        if (share) {
            const bps = toBig(share[i]);
            if (bps === null) return null;
            regenShare = (regen * bps) / BigInt(HIVE_100_PERCENT);
        }
        if (regenShare <= ZERO) continue; // pools with no regen share are free on-chain
        const cost = rcCostOfResource(p.price_curve_params, poolUnits, BigInt(usage[i]) * unit, regenShare);
        if (cost === null) return null;
        total += cost;
    }
    return Number(total);
}

/**
 * dpixa's Manabar → { current, max, pct }. dpixa reports `percentage` in
 * basis points (despite its README example), so the percentage is derived
 * here from current / max instead. Current is clamped to max for display.
 */
function normalizeManabar(m) {
    if (!m) return null;
    const max = Number(m.max_mana);
    let current = Number(m.current_mana);
    if (!Number.isFinite(max) || !Number.isFinite(current)) return null;
    current = Math.max(0, Math.min(current, max));
    const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
    return { current, max, pct };
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
    if (!error) return "";
    return (
        (error.jse_info && error.jse_info.stack && error.jse_info.stack[0] && error.jse_info.stack[0].format) ||
        (error.data && error.data.stack && error.data.stack[0] && error.data.stack[0].format) ||
        (error.payload && error.payload.error && error.payload.error.message) ||
        (error.payload && error.payload.error && error.payload.error.data && error.payload.error.data.stack && error.payload.error.data.stack[0] && error.payload.error.data.stack[0].format) ||
        error.message ||
        (typeof error === "string" ? error : null) ||
        ""
    );
}

// Chain-side rejections specific to the RC path (not_enough_rc_exception
// "Account: X has N RC, needs M RC", the empty subsidy pool, a spent token).
const RC_ERROR_RE = /\bRC\b|resource credit|subsidized account|claimed account/i;

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
// MethodOption — one cell of the creation-method selector
// =============================================================================

const MethodOption = memo(function MethodOption({ classes, selected, icon, title, subtitle, onSelect }) {
    return (
        <ButtonBase
            focusRipple
            role="radio"
            aria-checked={selected}
            className={selected ? `${classes.methodOption} ${classes.methodOptionSelected}` : classes.methodOption}
            onClick={onSelect}
        >
            <span className={classes.methodTitle}>{icon}{title}</span>
            <span className={classes.methodSub}>{subtitle}</span>
        </ButtonBase>
    );
});

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
    rcBar: {
        height: 4,
        borderRadius: 2,
        margin: "0 0 6px 0",
        "&.MuiLinearProgress-colorPrimary":   { backgroundColor: "#1f1f1f" },
        "& .MuiLinearProgress-barColorPrimary": { backgroundColor: "#8a8a8a", borderRadius: 2 },
    },
    methodRow: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 8,
        marginTop: 4,
    },
    methodOption: {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        textAlign: "left",
        padding: "10px 14px",
        borderRadius: 12,
        backgroundColor: "#101010",
        color: "#bdbdbd",
        transition: "background-color 120ms ease, color 120ms ease",
        "&:hover":            { backgroundColor: "#161616" },
        "&.Mui-focusVisible": {  },
    },
    methodOptionSelected: {
        backgroundColor: "#2a2a2a",
        color: "#f0f0f0",
        "&:hover": { backgroundColor: "#2e2e2e", },
    },
    methodTitle: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
        fontWeight: 600,
        lineHeight: "20px",
    },
    methodSub: {
        fontSize: 12,
        color: "#8d8d8d",
        marginTop: 2,
        lineHeight: "16px",
    },
    methodNote: {
        fontSize: 13,
        color: "#9b9b9b",
        margin: "8px 2px 0 2px",
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
    const [dgp,                setDgp]                = useState(null); // raw dynamic global properties

    // ── Creation method + Resource Credits ───────────────────────────────────
    const [method, setMethod] = useState(METHOD_RC);
    const methodTouched       = useRef(false); // once the user picks, stop auto-selecting
    const [rc, setRc]         = useState(RC_INITIAL);

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
    // Load: current account + balances + creation fee, then Resource Credits
    // (RC reads run alongside and never hold the wallet summary back)
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!open || !api) return;
        let cancelled = false;

        const loadResourceCredits = async (acct) => {
            const rcApi = api.rc;
            if (!rcApi || typeof rcApi.getRCMana !== "function") {
                console.warn("[AddAccountDialog] api.rc is not available — RC readout disabled");
                if (!cancelled && isMounted.current) setRc({ ...RC_INITIAL, supported: false });
                return;
            }
            if (!cancelled && isMounted.current) setRc((prev) => ({ ...prev, loading: true, supported: true }));

            const warn = (label) => (err) => {
                console.warn(`[AddAccountDialog] rc.${label} failed:`, err && err.message ? err.message : err);
                return null;
            };
            const [mana, params, pool, stats] = await Promise.all([
                rcApi.getRCMana(acct).catch(warn("getRCMana")),
                (typeof rcApi.getResourceParams === "function"
                    ? rcApi.getResourceParams().catch(warn("getResourceParams"))
                    : Promise.resolve(null)),
                (typeof rcApi.getResourcePool === "function"
                    ? rcApi.getResourcePool().catch(warn("getResourcePool"))
                    : Promise.resolve(null)),
                (typeof rcApi.getRcStats === "function"
                    ? rcApi.getRcStats().catch(warn("getRcStats"))
                    : Promise.resolve(null)),
            ]);
            if (cancelled || !isMounted.current) return;

            const manabar = normalizeManabar(mana);
            console.log("[AddAccountDialog] RC manabar:", manabar, "| stats shares:", stats && stats.share);
            setRc({ loading: false, supported: true, mana: manabar, params, pool, stats });
        };

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
                        setErrorMessage(t("components.add_account_dialog.you_must_be_logged_in"));
                        setAccountInfoLoading(false);
                    }
                    return;
                }
                if (cancelled || !isMounted.current) return;
                setCurrentAccount(acct);

                // Fire-and-forget: the wallet block renders as soon as the
                // three core reads land; the RC lines fill in when theirs do.
                loadResourceCredits(acct).catch((err) => {
                    console.warn("[AddAccountDialog] RC load failed:", err);
                    if (!cancelled && isMounted.current) setRc((prev) => ({ ...prev, loading: false }));
                });

                const [infoArr, props, dgpRaw] = await Promise.all([
                    api.accounts.getAccounts([acct], true).catch(() => []),
                    api.globals.getChainProperties().catch(() => null),
                    // Dynamic global properties carry total_vesting_fund_pixa and
                    // total_vesting_shares (the VESTS↔PXA ratio and the RC regen
                    // base) plus available_account_subsidies (the zero-fee
                    // claim_account gate).
                    (api.globals.getDynamicGlobalProperties
                        ? api.globals.getDynamicGlobalProperties().catch(() => null)
                        : Promise.resolve(null)),
                ]);
                if (cancelled || !isMounted.current) return;

                const info = (infoArr && infoArr[0]) || null;
                setAccountInfo(info);
                console.log("[AddAccountDialog] pending_claimed_accounts:", info && info.pending_claimed_accounts);

                const raw = props && props.account_creation_fee;
                try { console.log("[AddAccountDialog] raw account_creation_fee:", raw); } catch (_) {}
                const feeDisplay = normalizeFee(raw);
                console.log("[AddAccountDialog] resolved creation fee:", feeDisplay);
                setCreationFee(feeDisplay);

                const ratio = vestRatioFromDGP(dgpRaw);
                console.log("[AddAccountDialog] vesting ratio (PXA per VESTS):", ratio,
                    "| available_account_subsidies:", dgpRaw && dgpRaw.available_account_subsidies);
                setVestRatio(ratio);
                setDgp(dgpRaw || null);

                setAccountInfoLoading(false);
            } catch (err) {
                console.error("[AddAccountDialog] account/fee load failed:", err);
                if (!cancelled && isMounted.current) {
                    setStatus("error");
                    setErrorMessage(t("components.add_account_dialog.could_not_read_your_wallet", {
                        error: err && err.message ? err.message : ""
                    }));
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

    const isRc = method === METHOD_RC;

    // PXA available to gift: the whole balance on the RC path, balance − fee
    // when the fee is paid in PXA. Negative ⇒ can't afford the fee.
    const pxaGiftCap = useMemo(
        () => (isRc ? pxaBalance : Math.max(0, pxaBalance - creationFeeAmount)),
        [isRc, pxaBalance, creationFeeAmount]
    );

    const canAffordFee = pxaBalance >= creationFeeAmount && creationFee !== null;

    // A method switch can shrink the PXA cap under the current gift amount.
    useEffect(() => {
        setPxaAmount((a) => (a > pxaGiftCap ? roundToPrec(pxaGiftCap, SYM_PXA) : a));
    }, [pxaGiftCap]);

    // ─────────────────────────────────────────────────────────────────────────
    // Resource-Credits derivations
    // ─────────────────────────────────────────────────────────────────────────
    // Claimed-account tokens already held by the creator (chain counter
    // pending_claimed_accounts). With a token in hand, no claim_account op is
    // needed and the creation is nearly free in RC.
    const pendingClaimed = useMemo(() => {
        const n = Number(accountInfo?.pending_claimed_accounts);
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    }, [accountInfo]);
    const useToken = pendingClaimed > 0;

    // Whole subsidized accounts left in the chain's pool. claim_account with a
    // zero fee is rejected on-chain when this is 0 — a hard, chain-exact gate.
    // Null when the property is missing (older node / unknown shape).
    const subsidizedAvailable = useMemo(() => {
        const v = dgp ? Number(dgp.available_account_subsidies) : NaN;
        return Number.isFinite(v) ? Math.max(0, Math.floor(v / ACCOUNT_SUBSIDY_PRECISION)) : null;
    }, [dgp]);

    const totalVestingUnits = useMemo(() => vestingUnitsFromDGP(dgp), [dgp]);

    const hasPxaGift = pxaAmount > 0;
    const hasPxsGift = pxsAmount > 0;
    const hasPxpGift = pxpAmount > 0;

    const rcEstimate = useMemo(() => {
        if (!rc.params || !rc.pool) return null;
        try {
            return estimateCreationRc({
                params: rc.params,
                pool: rc.pool,
                stats: rc.stats,
                totalVestingUnits,
                claim: !useToken,
                transfers: (hasPxaGift ? 1 : 0) + (hasPxsGift ? 1 : 0),
                delegation: hasPxpGift,
            });
        } catch (err) {
            console.warn("[AddAccountDialog] RC estimate failed:", err);
            return null;
        }
    }, [rc.params, rc.pool, rc.stats, totalVestingUnits, useToken, hasPxaGift, hasPxsGift, hasPxpGift]);

    // Soft signal: RC below the estimate. Never blocks (the chain's own error
    // message states the exact RC needed), but drives the warning copy and
    // the default-method choice.
    const rcShortfall = useMemo(() => {
        if (useToken || !rc.mana || rcEstimate === null) return 0;
        return Math.max(0, rcEstimate - rc.mana.current);
    }, [useToken, rc.mana, rcEstimate]);

    // RC regenerate linearly, empty → full in RC_REGEN_TIME_SEC.
    const rcRegenHours = (rc.mana && rc.mana.max > 0 && rcShortfall > 0)
        ? (rcShortfall / rc.mana.max) * (RC_REGEN_TIME_SEC / 3600)
        : 0;
    const rcNeedsMorePower = Boolean(rc.mana && rcEstimate !== null && !useToken && rcEstimate > rc.mana.max);

    // Hard, chain-exact block: a fresh claim is required and the chain has
    // nothing left to subsidize it with.
    const rcBlocked = !useToken && subsidizedAvailable === 0;

    // Default method once the wallet and RC reads are in: Resource Credits
    // unless they are knowably short and the fee is affordable. A manual pick
    // is never overridden.
    useEffect(() => {
        if (accountInfoLoading || rc.loading || methodTouched.current) return;
        const preferFee = (rcBlocked || rcShortfall > 0) && canAffordFee;
        setMethod(preferFee ? METHOD_FEE : METHOD_RC);
    }, [accountInfoLoading, rc.loading, rcBlocked, rcShortfall, canAffordFee]);

    const selectRcMethod = useCallback(() => {
        methodTouched.current = true;
        setMethod(METHOD_RC);
    }, []);
    const selectFeeMethod = useCallback(() => {
        methodTouched.current = true;
        setMethod(METHOD_FEE);
    }, []);

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
        if (isRc) {
            if (rcBlocked)        return false;
        } else {
            if (!canAffordFee)    return false;
        }
        return true;
    }, [status, currentAccount, usernameAvailable, usernamePending, isRc, rcBlocked, canAffordFee]);

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
                throw new Error(t("components.add_account_dialog.incomplete_authority_set"));
            }
            lastPdfBlob.current  = pdfBlob;
            lastUsername.current = username;

            const jsonMetadata = JSON.stringify({
                created_by: "pixagram-credit-gift",
                created_at: new Date().toISOString(),
                gifter: currentAccount,
                creation: isRc ? "resource_credits" : "creation_fee",
            });

            // 2. Build the op array (display → chain symbols at this boundary).
            const ops = [];

            if (isRc) {
                // Re-read the token count right before signing: a token may
                // have been spent (or claimed) elsewhere since the dialog opened.
                let tokens = pendingClaimed;
                try {
                    const fresh = await api.accounts.getAccounts([currentAccount], true);
                    const n = Number(fresh && fresh[0] && fresh[0].pending_claimed_accounts);
                    if (Number.isFinite(n)) tokens = Math.max(0, Math.floor(n));
                } catch (_) { /* keep the dialog-load count */ }
                console.log("[AddAccountDialog] claimed-account tokens at signing:", tokens);

                if (!(tokens > 0)) {
                    // Zero fee ⇒ the chain bills the claim to the creator's RC
                    // and takes one subsidized account from its pool.
                    ops.push(["claim_account", {
                        creator: currentAccount,
                        fee: toChainAsset(0, SYM_PXA),
                        extensions: [],
                    }]);
                }
                ops.push(["create_claimed_account", {
                    creator: currentAccount,
                    new_account_name: username,
                    owner:   buildAuth(pub.owner),
                    active:  buildAuth(pub.active),
                    posting: buildAuth(pub.posting),
                    memo_key: pub.memo,
                    json_metadata: jsonMetadata,
                    extensions: [],
                }]);
            } else {
                // Re-fetch the fee just before signing (validators reject
                // account_create with a stale fee on fee-bump blocks).
                let feeForOp = creationFee;
                try {
                    const props = await api.globals.getChainProperties();
                    feeForOp = normalizeFee(props && props.account_creation_fee, creationFee);
                } catch (_) { /* fall back to dialog-load fee */ }
                console.log("[AddAccountDialog] fee for op:", feeForOp);

                const feeParsed = parseAsset(feeForOp) || { amount: 0, symbol: SYM_PXA };
                ops.push(["account_create", {
                    fee: toChainAsset(feeParsed.amount, feeParsed.symbol),
                    creator: currentAccount,
                    new_account_name: username,
                    owner:   buildAuth(pub.owner),
                    active:  buildAuth(pub.active),
                    posting: buildAuth(pub.posting),
                    memo_key: pub.memo,
                    json_metadata: jsonMetadata,
                }]);
            }

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

            // 3. Active key (UnlockKeyDialog stacks if the vault is locked).
            //    claim_account / create_claimed_account / account_create are all
            //    active-authority operations.
            console.log("[AddAccountDialog] requesting active key for", currentAccount);
            const key = await api.keyManager.requestKey(currentAccount, "active");

            // 4. Atomic broadcast.
            console.log("[AddAccountDialog] broadcasting…");
            const result = await api.broadcast.sendOperations(ops, key);
            console.log("[AddAccountDialog] broadcast result:", result);

            if (!isMounted.current) return;

            // 5. Force-download the recipient's backup PDF and show success.
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
            setErrorMessage(extractErrorMessage(err) || t("components.add_account_dialog.the_transaction_was_rejected"));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canSubmit, api, currentAccount, username, isRc, pendingClaimed, creationFee, pxaAmount, pxsAmount, pxpAmount, vestRatio, pxpAvailableVests, triggerPdfDownload, startAutoClose]);

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
        if (usernamePending)                                    return t("components.add_account_dialog.checking_availability");
        if (usernameTaken)                                      return t("components.add_account_dialog.that_username_is_already_taken");
        if (usernameAvailable)                                  return t("components.add_account_dialog.available");
        return "";
    }, [username, usernameSyntaxError, usernamePending, usernameTaken, usernameAvailable]);

    // ─────────────────────────────────────────────────────────────────────────
    // Method selector copy + RC readout copy
    // ─────────────────────────────────────────────────────────────────────────
    const methodNote = isRc
        ? (useToken
            ? t("components.add_account_dialog.note_rc_token", { n: pendingClaimed })
            : t("components.add_account_dialog.note_rc_claim"))
        : t("components.add_account_dialog.note_fee", { fee: creationFee || ("3.000 " + SYM_PXA) });

    const rcManaText = rc.loading
        ? "…"
        : (rc.supported && rc.mana
            ? `${rc.mana.pct.toFixed(0)} % (${formatRc(rc.mana.current)})`
            : t("components.add_account_dialog.unavailable"));

    const rcCostText = rc.loading
        ? "…"
        : (rcEstimate !== null ? `≈ ${formatRc(rcEstimate)}` : t("components.add_account_dialog.unknown"));

    // Warning under the wallet block for the selected method. Only the
    // subsidy-pool case also disables CREATE; the RC shortfalls are advisory.
    const walletWarning = useMemo(() => {
        if (accountInfoLoading) return "";
        if (!isRc) {
            return canAffordFee ? "" : t("components.add_account_dialog.your_pxa_balance_does_not_cover_the", {
                creationFee: creationFee
            });
        }
        if (rcBlocked)        return t("components.add_account_dialog.warn_no_subsidized_accounts");
        if (!rc.mana || rc.loading) return "";
        if (rcNeedsMorePower) return t("components.add_account_dialog.warn_rc_needs_more_power", {
            cost: formatRc(rcEstimate),
            max:  formatRc(rc.mana.max),
        });
        if (rcShortfall > 0)  return t("components.add_account_dialog.warn_rc_shortfall", {
            current: formatRc(rc.mana.current),
            cost:    formatRc(rcEstimate),
            when:    formatRegenTime(rcRegenHours),
        });
        return "";
    }, [accountInfoLoading, isRc, canAffordFee, creationFee, rcBlocked, rc.mana, rc.loading, rcNeedsMorePower, rcShortfall, rcEstimate, rcRegenHours]);

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

                {/* ── Creation method ── */}
                <div className={classes.sectionLabel}>{t("components.add_account_dialog.creation_method")}</div>
                <div className={classes.methodRow} role="radiogroup" aria-label={t("components.add_account_dialog.creation_method")}>
                    <MethodOption
                        classes={classes}
                        selected={isRc}
                        icon={RC_OPTION_ICON}
                        title={t("components.add_account_dialog.resource_credits")}
                        subtitle={t("components.add_account_dialog.claim_an_account_with_rc_no_fee")}
                        onSelect={selectRcMethod}
                    />
                    <MethodOption
                        classes={classes}
                        selected={!isRc}
                        icon={FEE_OPTION_ICON}
                        title={t("components.add_account_dialog.pxa_fee")}
                        subtitle={creationFee
                            ? t("components.add_account_dialog.pay_fee", { fee: creationFee })
                            : t("components.add_account_dialog.pay_the_chain_fee")}
                        onSelect={selectFeeMethod}
                    />
                </div>
                <Typography className={classes.methodNote}>{methodNote}</Typography>

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
                        {isRc ? (
                            <>
                                <div className={classes.balanceLine}>
                                    <span>{t("components.add_account_dialog.resource_credits")}</span>
                                    <span className={classes.balanceLineValue}>{rcManaText}</span>
                                </div>
                                {rc.mana && (
                                    <LinearProgress
                                        variant="determinate"
                                        value={rc.mana.pct}
                                        className={classes.rcBar}
                                        aria-label={t("components.add_account_dialog.resource_credits")}
                                    />
                                )}
                                {useToken && (
                                    <div className={classes.balanceLine}>
                                        <span>{t("components.add_account_dialog.claimed_account_tokens")}</span>
                                        <span className={classes.balanceLineValue}>{formatInt(pendingClaimed)}</span>
                                    </div>
                                )}
                                <div className={classes.balanceLine}>
                                    <span>{t("components.add_account_dialog.estimated_rc_cost")}</span>
                                    <span className={classes.balanceLineValue}>{rcCostText}</span>
                                </div>
                                {!useToken && subsidizedAvailable !== null && (
                                    <div className={classes.balanceLine}>
                                        <span>{t("components.add_account_dialog.subsidized_accounts_left_on_chain")}</span>
                                        <span className={classes.balanceLineValue}>{formatInt(subsidizedAvailable)}</span>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className={classes.balanceLine}>
                                <span>{t("components.add_account_dialog.account_creation_fee")}</span>
                                <span className={classes.balanceLineValue}>− {creationFee || ("3.000 " + SYM_PXA)}</span>
                            </div>
                        )}
                    </div>
                )}
                {walletWarning.length > 0 && (
                    <Typography style={CANT_AFFORD_STYLE}>{walletWarning}</Typography>
                )}

                {/* ── PXA gift ── */}
                <div className={classes.sectionLabel}>{t("components.add_account_dialog.send_pxa")}</div>
                {renderAmountField({
                    label: t("words.amount"),
                    currency: "PXA",
                    decimals: 3,
                    icon: PXA_FIELD_ICON,
                    value: pxaAmount,
                    max: pxaGiftCap,
                    onAmountChange: setPxaFromAmount,
                    helperText: isRc
                        ? t("components.add_account_dialog.max_pxa_no_fee", {
                            pxaGiftCap: pxaGiftCap.toFixed(PREC[SYM_PXA])
                        })
                        : t("components.add_account_dialog.max_pxa_after_fee", {
                            pxaGiftCap: pxaGiftCap.toFixed(PREC[SYM_PXA])
                        }),
                })}

                {/* ── PXS gift ── */}
                <div className={classes.sectionLabel}>{t("components.add_account_dialog.send_pxs")}</div>
                {renderAmountField({
                    label: t("words.amount"),
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
                    label: t("words.amount"),
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
                        : t("components.add_account_dialog.vesting_rate_unavailable"),
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
                        text: pdfDownloaded ? " " + t("components.add_account_dialog.please_hand_it_over_securely") : "."
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
            <div className={classes.errorMessage}>{errorMessage || t("components.add_account_dialog.unknown_error")}</div>
            {isRc && RC_ERROR_RE.test(errorMessage || "") && (
                <Typography style={ERROR_HINT_STYLE}>{t("components.add_account_dialog.hint_rc_error")}</Typography>
            )}
        </div>
    );

    // Build a friendly hint for *why* the button is disabled — surfaces in a
    // tooltip so the user isn't left wondering.
    const disabledHint = useMemo(() => {
        if (canSubmit) return "";
        if (!currentAccount)                  return t("components.add_account_dialog.resolving_your_active_account");
        if (accountInfoLoading)               return t("components.add_account_dialog.loading_your_wallet");
        if (!username.length)                 return t("components.add_account_dialog.choose_a_username_for_the_new_account");
        if (usernamePending)                  return t("components.add_account_dialog.checking_that_username_on_chain");
        if (usernameSyntaxError &&
            usernameSyntaxError.length)       return usernameSyntaxError;
        if (usernameTaken)                    return t("components.add_account_dialog.that_username_is_already_taken");
        if (!usernameAvailable)               return t("components.add_account_dialog.pick_a_valid_available_username");
        if (isRc && rcBlocked)                return t("components.add_account_dialog.hint_no_subsidized_accounts");
        if (!isRc && !canAffordFee)           return t("components.add_account_dialog.your_pxa_balance_does_not_cover_the", {
            creationFee: creationFee || ""
        });
        return "";
    }, [canSubmit, currentAccount, accountInfoLoading, username, usernamePending, usernameSyntaxError, usernameTaken, usernameAvailable, isRc, rcBlocked, canAffordFee, creationFee]);

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
