import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import Typography from "@material-ui/core/Typography";
import Tooltip from "@material-ui/core/Tooltip";
import FormControl from "@material-ui/core/FormControl";
import FormGroup from "@material-ui/core/FormGroup";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Checkbox from "@material-ui/core/Checkbox";
import Switch from "@material-ui/core/Switch";

import CallReceivedRounded from "@material-ui/icons/CallReceivedRounded";
import CallMadeRounded from "@material-ui/icons/CallMadeRounded";
import SyncAltRounded from "@material-ui/icons/SyncAltRounded";
import FlashOnRounded from "@material-ui/icons/FlashOnRounded";
import SwapHorizRounded from "@material-ui/icons/SwapHorizRounded";
import RedeemRounded from "@material-ui/icons/RedeemRounded";
import PeopleAltRounded from "@material-ui/icons/PeopleAltRounded";
import ReplayRounded from "@material-ui/icons/ReplayRounded";
import LockRounded from "@material-ui/icons/LockRounded";
import HelpOutlineRounded from "@material-ui/icons/HelpOutlineRounded";

import useLiveTimeAgo from "../hooks/useLiveTimeAgo";

// tx is aliased: this file uses `tx` for a blockchain transaction
// (describeOperation(tx, …), for (const tx of history)), so importing the
// resolver under its own name would shadow — and read — as the wrong thing.
import { t, tk, tx as translate, useLanguage } from "../utils/text";

/* ────────────────────────────────────────────────────────────────────────────
 * Asset helpers (ported from PixaWalletDialog so this component is standalone).
 * The only runtime-dependent helper we still need from the parent is
 * `vestToPixa`, because the VESTS→PXP rate depends on live global props.
 * ──────────────────────────────────────────────────────────────────────────── */

const NAI_TO_CHAIN = {
    "@@000000021": { symbol: "HIVE", precision: 3 },
    "@@000000013": { symbol: "HBD", precision: 3 },
    "@@000000037": { symbol: "VESTS", precision: 6 },
};
const CHAIN_TO_DISPLAY = {
    TESTS: "PXA", HIVE: "PXA", PIXA: "PXA",
    TBD: "PXS", HBD: "PXS",
    VESTS: "PXP",
};
const DISPLAY_PRECISION = { PXA: 3, PXS: 3, PXP: 3 };

// Parse a raw asset (condenser string or AppBase NAI object) → { value, chainSymbol }.
function parseAsset(asset) {
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
function toDisplayUnit(asset, vestToPixa) {
    const parsed = parseAsset(asset);
    if (!parsed) return null;
    const token = CHAIN_TO_DISPLAY[parsed.chainSymbol] || parsed.chainSymbol;
    if (token === "PXP") {
        const pxp = typeof vestToPixa === "function" ? vestToPixa(parsed.value) : parsed.value;
        return { token: "PXP", value: pxp };
    }
    return { token, value: parsed.value };
}

function fmtUnit(unit) {
    if (!unit) return "";
    const p = DISPLAY_PRECISION[unit.token] ?? 3;
    return `${unit.value.toFixed(p)} ${unit.token}`;
}

const isAssetString = (s) => typeof s === "string" && /^-?\d+(\.\d+)?\s+[A-Za-z]+$/.test(s.trim());
const isAssetObj = (o) => o && typeof o === "object" && typeof o.nai === "string" && "amount" in o;

// Walk a payload, sum every asset-shaped value by display token. Fork-resilient:
// reward virtual-ops rename fields between forks (hbd_payout/sbd_payout/…), so we
// detect by shape rather than by key name. Returns ["1.234 PXA", "0.500 PXS", …].
function collectAssetParts(payload, vestToPixa) {
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
        .map((t) => fmtUnit({ token: t, value: byToken[t] }));
}

/* ────────────────────────────────────────────────────────────────────────────
 * Operation → display descriptor.
 * direction: 'in' (credit, green, +) | 'out' (debit, red, −) | 'self' (neutral)
 * kind: drives the icon + tint  (transfer | power | savings | market | convert
 *                                | reward | delegation | other)
 * ──────────────────────────────────────────────────────────────────────────── */

function describeOperation(tx, me, vestToPixa) {
    const d = tx.data || {};
    const A = (asset) => fmtUnit(toDisplayUnit(asset, vestToPixa));
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
            out.amounts = pxp && pxp.value > 0 ? [fmtUnit(pxp)] : [];
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
                d.reward_vests ? fmtUnit(toDisplayUnit(d.reward_vests, vestToPixa)) : null,
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
            out.amounts = sell ? [fmtUnit(sell)] : [];
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
            out.amounts = got ? [fmtUnit(got)] : [];
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

const KIND_ICON = {
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
const DIR_STYLE = {
    in:   { fg: "#f2f2f2", halo: "rgba(255,255,255,0.10)", sign: "+" },
    out:  { fg: "#8f8f8f", halo: "rgba(255,255,255,0.05)", sign: "\u2212" },
    self: { fg: "#9a9a9a", halo: "rgba(255,255,255,0.07)", sign: "" },
};

/* ────────────────────────────────────────────────────────────────────────────
 * Lightweight fixed-height windowing (no dependency).
 * Renders only the rows in view + a small overscan, padded by top/bottom
 * spacers so the scrollbar stays correct. Swap for react-window's
 * <FixedSizeList> if you'd rather use the maintained library — the row markup
 * below drops straight into its `children` render-prop.
 * ──────────────────────────────────────────────────────────────────────────── */
const ROW_H = 64;
const OVERSCAN = 8;

// Find the nearest scrollable ancestor so we virtualize against the DIALOG'S own
// scrollbar instead of introducing a second one inside the list. Mirrors the
// predicate the wallet already uses elsewhere (auto | scroll | overlay).
function findScrollParent(node) {
    let el = node && node.parentElement;
    while (el) {
        const oy = window.getComputedStyle(el).overflowY;
        if (oy === "auto" || oy === "scroll" || oy === "overlay") return el;
        el = el.parentElement;
    }
    return null; // none found → fall back to the window
}

// Windowing driven by an ancestor scroll container (or the window). Visibility is
// computed from bounding rects, so it stays correct even though the swipeable
// view applies CSS transforms. Only the intersecting rows are mounted; spacers
// preserve the scroll height.
function useScrollParentWindowing(itemCount, rowHeight) {
    const listRef = React.useRef(null);
    const rafRef = React.useRef(0);
    const [range, setRange] = React.useState({ start: 0, end: Math.min(itemCount, 30) });

    React.useLayoutEffect(() => {
        const node = listRef.current;
        if (!node) return;
        const scrollParent = findScrollParent(node);
        const target = scrollParent || window;

        const measure = () => {
            rafRef.current = 0;
            const el = listRef.current;
            if (!el) return;
            const listTop = el.getBoundingClientRect().top;
            let viewTop, viewBottom;
            if (scrollParent) {
                const pr = scrollParent.getBoundingClientRect();
                viewTop = pr.top;
                viewBottom = pr.bottom;
            } else {
                viewTop = 0;
                viewBottom = window.innerHeight || document.documentElement.clientHeight;
            }
            const localStart = Math.max(0, viewTop - listTop);
            const localEnd = Math.max(0, viewBottom - listTop);
            const start = Math.max(0, Math.floor(localStart / rowHeight) - OVERSCAN);
            const end = Math.min(itemCount, Math.ceil(localEnd / rowHeight) + OVERSCAN);
            setRange((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
        };

        const schedule = () => {
            if (rafRef.current) return;
            rafRef.current = requestAnimationFrame(measure);
        };

        measure();
        target.addEventListener("scroll", schedule, { passive: true });
        window.addEventListener("resize", schedule);
        let ro;
        if (scrollParent && typeof ResizeObserver === "function") {
            ro = new ResizeObserver(schedule);
            ro.observe(scrollParent);
        }
        return () => {
            target.removeEventListener("scroll", schedule);
            window.removeEventListener("resize", schedule);
            if (ro) ro.disconnect();
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [itemCount, rowHeight]);

    return { listRef, start: range.start, end: range.end };
}

/* ── A single ledger row (memoized) ───────────────────────────────────────── */
const HistoryRow = React.memo(function HistoryRow({ row, classes, locales }) {
    useLanguage();
    const { desc, date } = row;
    const Icon = (KIND_ICON[desc.kind] || KIND_ICON.other)(desc.direction);
    const s = DIR_STYLE[desc.direction] || DIR_STYLE.self;
    const sign = s.sign;
    const amount = desc.amounts.length
        ? desc.amounts.map((a, i) => (i === 0 ? `${sign}${a}` : a)).join("  +  ")
        : "";

    // Live relative date — one watcher per MOUNTED row: the windowing above
    // unmounts off-screen rows, so their watchers are released as you scroll,
    // and the rest go with the list on dialog close. Rows without a
    // timestamp (date null) arm nothing.
    const rel = useLiveTimeAgo(date);
    const abs = date
        ? date.toLocaleDateString(locales, {
            weekday: "long", year: "numeric", month: "long",
            day: "numeric", hour: "numeric", minute: "numeric",
        })
        : "";

    return (
        <ListItem className={classes.row} style={{ height: ROW_H }}>
            <div className={classes.iconWrap} style={{ color: s.fg, backgroundColor: s.halo }}>
                <Icon fontSize="small" />
            </div>

            <div className={classes.body}>
                <span className={classes.title}>{translate(desc.title)}</span>
                {desc.subtitle ? <span className={classes.subtitle}>{translate(desc.subtitle)}</span> : null}
            </div>

            <div className={classes.right}>
                {amount ? <span className={classes.amount} style={{ color: s.fg }}>{amount}</span> : null}
                {date ? (
                    <Tooltip arrow title={abs}>
                        <span className={classes.date}>{rel}</span>
                    </Tooltip>
                ) : null}
            </div>
        </ListItem>
    );
});

/* ────────────────────────────────────────────────────────────────────────────
 * WalletHistory — owns the filter row + the windowed list.
 * Props:
 *   history     : Array<{ idx, type, data, timestamp }>   (parent's _walletHistory)
 *   username    : string                                  (account.username)
 *   locales     : string | string[]
 *   vestToPixa  : (rawVests:number) => number             (live rate from parent)
 *
 * Scrolling belongs to the dialog: the list renders at full virtual height and
 * windows against the nearest scrollable ancestor — no inner scrollbar.
 * ──────────────────────────────────────────────────────────────────────────── */
function WalletHistory({ history, username, locales, vestToPixa, classes }) {
    const [fIncoming, setIncoming] = React.useState(true);
    const [fOutgoing, setOutgoing] = React.useState(true);
    const [fPersonal, setPersonal] = React.useState(true);
    const [fRewards, setRewards] = React.useState(true);
    const [fHideSpam, setHideSpam] = React.useState(false);

    // 1) Describe + filter ONCE, producing a flat array the row renderer indexes
    //    into. This is what makes virtualization clean: rows are pure data.
    const rows = React.useMemo(() => {
        const out = [];
        for (const tx of history || []) {
            const desc = describeOperation(tx, username, vestToPixa);

            const isReward = desc.kind === "reward";
            const isPersonal = desc.direction === "self";
            const isIncoming = desc.direction === "in";
            const isOutgoing = desc.direction === "out";

            if (isReward && !fRewards) continue;
            if (isIncoming && !isReward && !fIncoming) continue;
            if (isOutgoing && !fOutgoing) continue;
            if (isPersonal && !fPersonal) continue;

            if (fHideSpam && desc.amounts.length) {
                const nums = desc.amounts.map((a) => parseFloat(a)).filter(Number.isFinite);
                if (nums.length && nums.every((n) => Math.abs(n) < 1)) continue;
            }

            out.push({
                key: tx.idx != null ? tx.idx : out.length,
                desc,
                date: tx.timestamp ? new Date(tx.timestamp + "Z") : null,
            });
        }
        return out;
    }, [history, username, vestToPixa, fIncoming, fOutgoing, fPersonal, fRewards, fHideSpam]);

    // 2) Virtualize against the dialog's own scrollbar (no inner scroll area).
    const { listRef, start, end } = useScrollParentWindowing(rows.length, ROW_H);
    const slice = rows.slice(start, end);
    const topPad = start * ROW_H;
    const bottomPad = Math.max(0, (rows.length - end) * ROW_H);

    return (
        <div className={classes.wrap}>
            <FormControl component="fieldset" className={classes.filterBar}>
                <FormGroup row className={classes.filterGroup}>
                    <FormControlLabel
                        control={<Checkbox size="small" color="primary" checked={fIncoming} onChange={(e) => setIncoming(e.target.checked)} />}
                        label={t("components.wallet_history.incoming")} labelPlacement="bottom"
                    />
                    <FormControlLabel
                        control={<Checkbox size="small" color="primary" checked={fOutgoing} onChange={(e) => setOutgoing(e.target.checked)} />}
                        label={t("components.wallet_history.outgoing")} labelPlacement="bottom"
                    />
                    <FormControlLabel
                        control={<Checkbox size="small" color="primary" checked={fPersonal} onChange={(e) => setPersonal(e.target.checked)} />}
                        label={t("components.wallet_history.personal")} labelPlacement="bottom"
                    />
                    <FormControlLabel
                        control={<Checkbox size="small" color="primary" checked={fRewards} onChange={(e) => setRewards(e.target.checked)} />}
                        label={t("components.wallet_history.rewards")} labelPlacement="bottom"
                    />
                    <FormControlLabel
                        style={{ marginTop: 8 }}
                        control={<Switch style={{ marginBottom: 8 }} size="small" color="primary" checked={fHideSpam} onChange={(e) => setHideSpam(e.target.checked)} />}
                        label={t("components.wallet_history.hide_dust")} labelPlacement="bottom"
                    />
                </FormGroup>
            </FormControl>
            {rows.length === 0 ? (
                <Typography className={classes.empty} variant="body2">{t("components.wallet_history.no_transactions_found")}</Typography>
            ) : (
                <div ref={listRef}>
                    <List dense disablePadding>
                        <div style={{ height: topPad }} />
                        {slice.map((row) => (
                            <HistoryRow key={row.key} row={row} classes={classes} locales={locales} />
                        ))}
                        <div style={{ height: bottomPad }} />
                    </List>
                </div>
            )}
        </div>
    );
}

const styles = (theme) => ({
    wrap: { width: "100%" },

    filterBar: {
        width: "100%",
        backgroundColor: "#111111",
        borderRadius: 16,
        margin: "24px 0px 12px 0px",
        padding: "8px 8px",
    },
    filterGroup: {
        "& > .MuiFormControlLabel-root": {
            marginLeft: 8,
            marginRight: 8,
            "& .MuiTypography-body1": { fontSize: 14 },
        },
    },

    row: {
        height: 64,
        boxSizing: "border-box",
        backgroundColor: "transparent",
        borderRadius: 0,
        gap: 12,
        transition: "background-color 220ms cubic-bezier(0.4,0,0.2,1), border-radius 220ms cubic-bezier(0.4,0,0.2,1)",
        "&:hover": { backgroundColor: "#101010", borderRadius: 12 },
    },

    iconWrap: {
        flex: "0 0 auto",
        width: 40,
        height: 40,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },

    body: {
        flex: "1 1 auto",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
    },
    title: {
        color: "#e8e8e8",
        fontSize: 15,
        fontWeight: 500,
        lineHeight: "20px",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    subtitle: {
        color: "#6f6f6f",
        fontSize: 13,
        lineHeight: "18px",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },

    right: {
        flex: "0 0 auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        justifyContent: "center",
        textAlign: "right",
        maxWidth: "48%",
    },
    amount: {
        fontSize: 15,
        fontWeight: 600,
        lineHeight: "20px",
        fontVariantNumeric: "tabular-nums",
        fontFeatureSettings: '"tnum"',
        whiteSpace: "nowrap",
    },
    date: {
        color: "#6f6f6f",
        fontSize: 12,
        lineHeight: "16px",
        whiteSpace: "nowrap",
        cursor: "default",
    },

    empty: { color: "#666", padding: 16 },
});

export default withStyles(styles)(WalletHistory);