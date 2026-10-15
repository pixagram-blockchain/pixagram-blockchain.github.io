/* ────────────────────────────────────────────────────────────────────────────
 * Chain operations → display data.
 *
 * Shared by the wallet's history list (WalletHistory), the transaction
 * inspector (TransactionInspector) and the profile's History tab, so one
 * operation reads the same wherever it shows up. Pure data in, display data
 * out: no React state, no network.
 *
 * The asset helpers, describeOperation, KIND_ICON and DIR_STYLE moved here
 * from WalletHistory unchanged.
 * ──────────────────────────────────────────────────────────────────────────── */

import CallReceivedRounded from "@material-ui/icons/CallReceivedRounded";
import CallMadeRounded from "@material-ui/icons/CallMadeRounded";
import SyncAltRounded from "@material-ui/icons/SyncAltRounded";
import FlashOnRounded from "@material-ui/icons/FlashOnRounded";
import SwapHorizRounded from "@material-ui/icons/SwapHorizRounded";
import RedeemRounded from "@material-ui/icons/RedeemRounded";
import PeopleAltRounded from "@material-ui/icons/PeopleAltRounded";
import LockRounded from "@material-ui/icons/LockRounded";
import HelpOutlineRounded from "@material-ui/icons/HelpOutlineRounded";

import { tk } from "./text";
import { formatAmount } from "./numberFormat";

/* ────────────────────────────────────────────────────────────────────────────
 * Asset helpers.
 * The only runtime-dependent input is `vestToPixa`, because the VESTS→PXP
 * rate depends on live global props.
 * ──────────────────────────────────────────────────────────────────────────── */

export const NAI_TO_CHAIN = {
    "@@000000021": { symbol: "HIVE", precision: 3 },
    "@@000000013": { symbol: "HBD", precision: 3 },
    "@@000000037": { symbol: "VESTS", precision: 6 },
};
export const CHAIN_TO_DISPLAY = {
    TESTS: "PXA", HIVE: "PXA", PIXA: "PXA",
    TBD: "PXS", HBD: "PXS",
    VESTS: "PXP",
};
export const DISPLAY_PRECISION = { PXA: 3, PXS: 3, PXP: 3 };

// Parse a raw asset (condenser string or AppBase NAI object) → { value, chainSymbol }.
export function parseAsset(asset) {
    if (asset == null) return null;
    if (typeof asset === "string") {
        const parts = asset.trim().split(/\s+/);
        if (parts.length !== 2) return null;
        const v = parseFloat(parts[0]);
        if (!Number.isFinite(v)) return null;
        return { value: v, chainSymbol: parts[1] };
    }
    if (typeof asset === "object" && asset.nai) {
        const mapping = NAI_TO_CHAIN[asset.nai];
        if (!mapping) return null;
        const precision = typeof asset.precision === "number" ? asset.precision : mapping.precision;
        const amountStr = typeof asset.amount === "string" ? asset.amount : String(asset.amount ?? "0");
        const v = parseFloat(amountStr) / Math.pow(10, precision);
        if (!Number.isFinite(v)) return null;
        return { value: v, chainSymbol: mapping.symbol };
    }
    return null;
}

// Normalize any asset to display units: { token: 'PXA'|'PXS'|'PXP', value }.
// VESTS is converted through vestToPixa (raw VESTS are huge — never shown directly).
export function toDisplayUnit(asset, vestToPixa) {
    const parsed = parseAsset(asset);
    if (!parsed) return null;
    const token = CHAIN_TO_DISPLAY[parsed.chainSymbol] || parsed.chainSymbol;
    if (token === "PXP") {
        const pxp = typeof vestToPixa === "function" ? vestToPixa(parsed.value) : parsed.value;
        return { token: "PXP", value: pxp };
    }
    return { token, value: parsed.value };
}

// Display string for a unit — grouping/decimal marks follow the Settings
// locale. Rows keep the raw units (see `amounts` below) and format at render
// time, so a language switch re-formats every row; only the two market
// subtitles bake this string in, and `rows` is rebuilt on a locale change.
export function fmtUnit(unit) {
    if (!unit) return "";
    const p = DISPLAY_PRECISION[unit.token] ?? 3;
    return formatAmount(unit.value, unit.token, p);
}

// A chain asset string ("1.234 TESTS", "0.500000 VESTS") always carries its
// decimals and one of the chain's symbols. Matching any "number word" took a
// post titled "8 Bit" for an amount of 8 Bit.
const ASSET_SYMBOLS = new Set([...Object.keys(CHAIN_TO_DISPLAY), "PXA", "PXS", "PXP"]);
export const isAssetString = (s) => {
    if (typeof s !== "string") return false;
    const m = /^-?\d+\.\d+\s+([A-Z]+)$/.exec(s.trim());
    return !!m && ASSET_SYMBOLS.has(m[1]);
};
export const isAssetObj = (o) => o && typeof o === "object" && typeof o.nai === "string" && "amount" in o;

// Walk a payload, sum every asset-shaped value by display token. Fork-resilient:
// reward virtual-ops rename fields between forks (hbd_payout/sbd_payout/…), so we
// detect by shape rather than by key name. Returns [{ token, value }, …].
export function collectAssetParts(payload, vestToPixa) {
    const byToken = {};
    for (const k in payload) {
        const v = payload[k];
        if (!isAssetString(v) && !isAssetObj(v)) continue;
        const unit = toDisplayUnit(v, vestToPixa);
        if (!unit) continue;
        byToken[unit.token] = (byToken[unit.token] || 0) + unit.value;
    }
    return Object.keys(byToken)
        .filter((t) => Math.abs(byToken[t]) > 1e-9)
        .map((t) => ({ token: t, value: byToken[t] }));
}

/* ────────────────────────────────────────────────────────────────────────────
 * Operation → display descriptor.
 * direction: 'in' (credit, +) | 'out' (debit, −) | 'self' (neutral)
 * kind: drives the icon + tint  (transfer | power | savings | market | convert
 *                                | reward | delegation | other)
 * ──────────────────────────────────────────────────────────────────────────── */

export function describeOperation(tx, me, vestToPixa) {
    const d = tx.data || {};
    // `amounts` holds raw { token, value } units — never pre-formatted strings —
    // so the spam filter can compare numbers and the row formats per locale.
    const A = (asset) => toDisplayUnit(asset, vestToPixa);
    const out = { kind: "other", direction: "self", title: "", subtitle: "", amounts: [] };

    switch (tx.type) {
        /* ── Direct transfers ─────────────────────────────────────────── */
        case "transfer": {
            const inc = d.to === me;
            out.kind = "transfer";
            out.direction = inc ? "in" : "out";
            out.title = inc ? tk("components.wallet_history.received_from", {
                from: d.from
            }) : tk("components.wallet_history.sent_to", {
                to: d.to
            });
            out.subtitle = d.memo || "";
            out.amounts = [A(d.amount)];
            break;
        }
        case "recurrent_transfer":
        case "fill_recurrent_transfer": {
            const inc = d.to === me;
            out.kind = "transfer";
            out.direction = inc ? "in" : "out";
            out.title = inc ? tk("components.wallet_history.recurring_from", {
                from: d.from
            }) : tk("components.wallet_history.recurring_to", {
                to: d.to
            });
            out.subtitle = d.memo || "";
            out.amounts = [A(d.amount)];
            break;
        }

        /* ── Power up / down ──────────────────────────────────────────── */
        case "transfer_to_vesting": {
            const self = d.to === me && d.from === me;
            const inc = d.to === me && d.from !== me;
            out.kind = "power";
            out.direction = self ? "self" : inc ? "in" : "out";
            out.title = self ? tk("components.wallet_history.power_up") : inc ? tk("components.wallet_history.power_up_from", {
                from: d.from
            }) : tk("components.wallet_history.power_up_to", {
                to: d.to
            });
            out.amounts = [A(d.amount)];
            break;
        }
        case "withdraw_vesting": {
            out.kind = "power";
            out.direction = "self";
            const pxp = toDisplayUnit(d.vesting_shares, vestToPixa);
            out.title = (pxp && pxp.value > 0) ? tk("components.wallet_history.power_down") : tk("components.wallet_history.power_down_stopped");
            out.amounts = pxp && pxp.value > 0 ? [pxp] : [];
            break;
        }
        case "fill_vesting_withdraw": {
            out.kind = "power";
            out.direction = "in";
            out.title = tk("components.wallet_history.power_down_payout");
            out.amounts = [A(d.deposited)];
            break;
        }
        case "set_withdraw_vesting_route": {
            out.kind = "power";
            out.direction = "self";
            out.title = tk("components.wallet_history.power_down_route_set");
            out.subtitle = d.to_account ? `→ @${d.to_account} · ${(d.percent || 0) / 100}%` : "";
            break;
        }
        case "return_vesting_delegation": {
            out.kind = "delegation";
            out.direction = "in";
            out.title = tk("components.wallet_history.delegation_returned");
            out.amounts = [A(d.vesting_shares)];
            break;
        }

        /* ── Rewards (high-volume virtual ops) ────────────────────────── */
        case "author_reward": {
            out.kind = "reward";
            out.direction = "in";
            out.title = tk("components.wallet_history.author_reward");
            out.subtitle = d.permlink ? tk("components.wallet_history.on", {
                permlink: d.permlink
            }) : "";
            out.amounts = collectAssetParts(d, vestToPixa);
            break;
        }
        case "curation_reward": {
            out.kind = "reward";
            out.direction = "in";
            out.title = tk("components.wallet_history.curation_reward");
            const who = d.author || d.comment_author;
            out.subtitle = who ? tk("components.wallet_history.vote_on", {
                who: who
            }) : "";
            out.amounts = [A(d.reward)];
            break;
        }
        case "comment_benefactor_reward": {
            out.kind = "reward";
            out.direction = "in";
            out.title = tk("components.wallet_history.beneficiary_reward");
            out.subtitle = d.author ? tk("components.wallet_history.from", {
                author: d.author
            }) : "";
            out.amounts = collectAssetParts(d, vestToPixa);
            break;
        }
        case "comment_reward": {
            out.kind = "reward";
            out.direction = "in";
            out.title = tk("components.wallet_history.post_payout");
            out.subtitle = d.permlink ? `${d.permlink}` : "";
            out.amounts = [A(d.payout)];
            break;
        }
        case "producer_reward": {
            out.kind = "reward";
            out.direction = "in";
            out.title = tk("components.wallet_history.block_reward");
            out.amounts = [A(d.vesting_shares)];
            break;
        }
        case "claim_reward_balance": {
            out.kind = "reward";
            out.direction = "in";
            out.title = tk("components.wallet_history.rewards_claimed");
            out.amounts = [
                d.reward_pixa ? A(d.reward_pixa) : null,
                d.reward_pxs ? A(d.reward_pxs) : null,
                d.reward_vests ? toDisplayUnit(d.reward_vests, vestToPixa) : null,
            ].filter(Boolean);
            break;
        }

        /* ── Delegation ───────────────────────────────────────────────── */
        case "delegate_vesting_shares": {
            const inc = d.delegatee === me;
            out.kind = "delegation";
            out.direction = inc ? "in" : "out";
            out.title = inc ? tk("components.wallet_history.delegation_from", {
                delegator: d.delegator
            }) : tk("components.wallet_history.delegation_to", {
                delegatee: d.delegatee
            });
            out.amounts = [A(d.vesting_shares)];
            break;
        }

        /* ── Savings ──────────────────────────────────────────────────── */
        case "transfer_to_savings": {
            out.kind = "savings";
            out.direction = d.from === me && d.to !== me ? "out" : "self";
            out.title = tk("components.wallet_history.savings_deposit");
            out.subtitle = d.memo || "";
            out.amounts = [A(d.amount)];
            break;
        }
        case "transfer_from_savings": {
            out.kind = "savings";
            out.direction = "self";
            out.title = tk("components.wallet_history.savings_withdrawal");
            out.subtitle = d.memo || "";
            out.amounts = [A(d.amount)];
            break;
        }
        case "cancel_transfer_from_savings": {
            out.kind = "savings";
            out.direction = "self";
            out.title = tk("words.savings_withdrawal_cancelled");
            break;
        }
        case "fill_transfer_from_savings": {
            out.kind = "savings";
            out.direction = "in";
            out.title = tk("components.wallet_history.savings_payout");
            out.amounts = [A(d.amount)];
            break;
        }
        case "interest": {
            out.kind = "savings";
            out.direction = "in";
            out.title = tk("components.wallet_history.savings_interest");
            out.amounts = [A(d.interest)];
            break;
        }

        /* ── Internal market ──────────────────────────────────────────── */
        case "limit_order_create":
        case "limit_order_create2": {
            out.kind = "market";
            out.direction = "self";
            out.title = tk("components.wallet_history.order_placed");
            const sell = toDisplayUnit(d.amount_to_sell, vestToPixa);
            out.subtitle = sell ? tk("components.wallet_history.selling", {
                fmtUnit: fmtUnit(sell)
            }) : "";
            out.amounts = sell ? [sell] : [];
            break;
        }
        case "limit_order_cancel": {
            out.kind = "market";
            out.direction = "self";
            out.title = tk("components.wallet_history.order_cancelled");
            out.subtitle = d.orderid != null ? `#${d.orderid}` : "";
            break;
        }
        case "fill_order": {
            out.kind = "market";
            out.direction = "self";
            out.title = tk("components.wallet_history.order_filled");
            const got = toDisplayUnit(d.open_pays, vestToPixa);
            const paid = toDisplayUnit(d.current_pays, vestToPixa);
            out.subtitle = paid ? tk("components.wallet_history.paid", {
                fmtUnit: fmtUnit(paid)
            }) : "";
            out.amounts = got ? [got] : [];
            break;
        }

        /* ── Conversions ──────────────────────────────────────────────── */
        case "convert":
        case "collateralized_convert": {
            out.kind = "convert";
            out.direction = "self";
            out.title = tx.type === "collateralized_convert" ? tk("components.wallet_history.convert_collateralized") : tk("components.wallet_history.convert");
            out.amounts = [A(d.amount)];
            break;
        }
        case "fill_convert_request":
        case "fill_collateralized_convert_request": {
            out.kind = "convert";
            out.direction = "self";
            out.title = tk("components.wallet_history.conversion_settled");
            out.amounts = [A(d.amount_out || d.amount_in)];
            break;
        }

        /* ── Escrow ───────────────────────────────────────────────────── */
        case "escrow_transfer": {
            out.kind = "transfer";
            out.direction = d.from === me ? "out" : "self";
            out.title = tk("components.wallet_history.escrow_funded", {
                to: d.to
            });
            out.amounts = collectAssetParts(d, vestToPixa);
            break;
        }
        case "escrow_release": {
            out.kind = "transfer";
            out.direction = d.receiver === me ? "in" : "self";
            out.title = tk("components.wallet_history.escrow_released");
            out.amounts = collectAssetParts(d, vestToPixa);
            break;
        }
        case "escrow_approve":
        case "escrow_dispute": {
            out.kind = "transfer";
            out.direction = "self";
            out.title = tx.type === "escrow_dispute" ? tk("components.wallet_history.escrow_disputed") : tk("components.wallet_history.escrow_approved");
            break;
        }

        /* ── Fallback: still surface any asset movement the op carries ── */
        default: {
            out.title = tx.type ? tx.type.replace(/_/g, " ") : tk("components.wallet_history.unknown_operation");
            out.amounts = collectAssetParts(d, vestToPixa);
        }
    }

    out.amounts = (out.amounts || []).filter(Boolean);
    return out;
}

export const KIND_ICON = {
    transfer: (dir) => (dir === "in" ? CallReceivedRounded : dir === "out" ? CallMadeRounded : SyncAltRounded),
    power: () => FlashOnRounded,
    savings: () => LockRounded,
    market: () => SwapHorizRounded,
    convert: () => SwapHorizRounded,
    reward: () => RedeemRounded,
    delegation: () => PeopleAltRounded,
    other: () => HelpOutlineRounded,
};

// Greyscale only — direction is carried by brightness, the +/- sign, and the
// glyph (received / sent / swap), never by hue. Credits read brightest, debits
// and internal movements sit a shade back.
export const DIR_STYLE = {
    in:   { fg: "#f2f2f2", halo: "rgba(255,255,255,0.10)", sign: "+" },
    out:  { fg: "#8f8f8f", halo: "rgba(255,255,255,0.05)", sign: "\u2212" },
    self: { fg: "#9a9a9a", halo: "rgba(255,255,255,0.07)", sign: "" },
};

/* ────────────────────────────────────────────────────────────────────────────
 * Account-history entries → records.
 *
 * A record is one operation as the account history reports it, flattened:
 *   { idx, type, data, timestamp,
 *     trx_id, block, trx_in_block, op_in_trx, virtual_op, clipped? }
 * `idx` is the account-history sequence number, `type` the operation name
 * (without "_operation"), `data` its payload. The chain coordinates are what
 * the transaction inspector shows. `clipped`, when present, maps a payload
 * field to its full length when the record kept only its start.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Normalize a history entry's op to { name, payload }:
 *   - Condenser: entry.op = ["op_name", {payload}]
 *   - AppBase:   entry.op = { type: "op_name_operation", value: {payload} }
 */
export const normalizeHistoryOp = (rawOp) => {
    if (Array.isArray(rawOp)) {
        return { name: rawOp[0], payload: rawOp[1] || {} };
    }
    if (rawOp && typeof rawOp === "object") {
        const rawType = rawOp.type || "";
        const name = rawType.endsWith("_operation")
            ? rawType.slice(0, -"_operation".length)
            : rawType;
        return { name, payload: rawOp.value || {} };
    }
    return { name: "", payload: {} };
};

// A string that owns its characters. V8 keeps a slice of a long string as a
// view onto the whole original, so `body.slice(0, 120)` pins the full body
// (base64 images included) for as long as the slice lives. The JSON round
// trip allocates a fresh, flat copy.
export const ownString = (s) => (typeof s === "string" && s.length > 12 ? JSON.parse(JSON.stringify(s)) : s);

// Shallow copy of `payload` with every string longer than `max` cut to its
// first `max` characters, as owned copies (see ownString). A post body can
// carry base64 images, and a deep timeline keeps one record per event, so
// the records must not pin whole bodies in memory. Returns { data, clipped }
// — `clipped` is null when nothing was cut, else { field: originalLength }.
function clipPayload(payload, max) {
    if (!payload || typeof payload !== "object" || !(max > 0)) return { data: payload, clipped: null };
    let data = payload;
    let clipped = null;
    for (const key of Object.keys(payload)) {
        const value = payload[key];
        if (typeof value !== "string" || value.length <= max) continue;
        if (data === payload) data = { ...payload };
        data[key] = ownString(value.slice(0, max));
        if (!clipped) clipped = {};
        clipped[key] = value.length;
    }
    return { data, clipped };
}

/**
 * One account-history entry ([idx, entry] from get_account_history, either
 * API shape) → a record. `opts.clip` caps the length of payload strings.
 */
export function toHistoryRecord(idx, entry, opts) {
    const e = entry || {};
    const { name, payload } = normalizeHistoryOp(e.op);
    const { data, clipped } = clipPayload(payload, opts && opts.clip);
    const record = {
        idx,
        type: name,
        data,
        timestamp: e.timestamp,
        trx_id: e.trx_id,
        block: e.block,
        trx_in_block: e.trx_in_block,
        op_in_trx: e.op_in_trx,
        virtual_op: e.virtual_op,
    };
    if (clipped) record.clipped = clipped;
    return record;
}

// Virtual operations (rewards, fills, payouts…) are produced by the chain
// itself, never signed by anyone, and carry an all-zero transaction id.
// `virtual_op` is a boolean on current nodes and a counter on older ones.
const NULL_TRX_ID = /^0+$/;
export function isVirtualRecord(record) {
    if (!record) return false;
    if (record.virtual_op === true) return true;
    if (typeof record.virtual_op === "number" && record.virtual_op > 0) return true;
    return typeof record.trx_id === "string" && NULL_TRX_ID.test(record.trx_id);
}

// The chain's own operation name, readable: "account_update2" → "Account update2".
export function humanizeOpType(type) {
    const s = String(type || "").replace(/_/g, " ").trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}
