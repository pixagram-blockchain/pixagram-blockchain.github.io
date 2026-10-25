import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import { useTheme } from "@material-ui/core/styles";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import IconButton from "@material-ui/core/IconButton";
import ButtonBase from "@material-ui/core/ButtonBase";
import Collapse from "@material-ui/core/Collapse";
import Tooltip from "@material-ui/core/Tooltip";

import CloseRounded from "@material-ui/icons/CloseRounded";
import FileCopyRounded from "@material-ui/icons/FileCopyRounded";
import CheckRounded from "@material-ui/icons/CheckRounded";
import ExpandMoreRounded from "@material-ui/icons/ExpandMoreRounded";
import CheckCircleRounded from "@material-ui/icons/CheckCircleRounded";
import HourglassEmptyRounded from "@material-ui/icons/HourglassEmptyRounded";
import FingerprintRounded from "@material-ui/icons/FingerprintRounded";
import MemoryRounded from "@material-ui/icons/MemoryRounded";
import ThumbUpRounded from "@material-ui/icons/ThumbUpRounded";
import ThumbDownRounded from "@material-ui/icons/ThumbDownRounded";
import CommentRounded from "@material-ui/icons/CommentRounded";
import PersonRounded from "@material-ui/icons/PersonRounded";
import EditRounded from "@material-ui/icons/EditRounded";
import CodeRounded from "@material-ui/icons/CodeRounded";
import AccountBalanceWalletRounded from "@material-ui/icons/AccountBalanceWalletRounded";
import LockRounded from "@material-ui/icons/LockRounded";
import OpenInNewRounded from "@material-ui/icons/OpenInNewRounded";

import useLiveTimeAgo from "../hooks/useLiveTimeAgo";
import { t, tx as translate, useLanguage } from "../utils/text";
import { formatDate, formatInteger, formatPercent, formatFiatFromUsd } from "../utils/numberFormat";
import { get_cached_settings } from "../utils/settings";
import { tr } from "./GDTowerKit";
import {
    describeOperation, fmtUnit, toDisplayUnit, isAssetObj, isAssetString,
    isVirtualRecord, humanizeOpType, KIND_ICON, DIR_STYLE,
} from "../utils/chainOps";

/* ────────────────────────────────────────────────────────────────────────────
 * TransactionInspector — one dialog for every history row.
 *
 * The host (the wallet, the profile page) mounts ONE of these and hands it
 * the record of the row that was clicked:
 *   record : { idx, type, data, timestamp, trx_id, block, trx_in_block,
 *              op_in_trx, virtual_op, clipped? }   (utils/chainOps
 *              toHistoryRecord — the account-history entry, flattened)
 *
 * It shows what the row only hints at: the amount with its value today, when
 * it happened (local and chain time), whether its block is irreversible yet,
 * the transaction and block it lives in, every field of the operation
 * decoded, and the raw operation to copy.
 *
 * Props:
 *   open, onClose
 *   record          the operation to show (kept through the exit animation)
 *   account         whose history this is — decides in / out
 *   api             finality (dynamic global properties), VESTS → PXP when
 *                   no converter is given, prices when none are given
 *   vestToPixa      live VESTS → PXP converter (the wallet has one)
 *   pxaUsd, pxsUsd, fiatRate, currency
 *                   prices and display currency (the wallet has them; else
 *                   read from api.prices and the Settings currency)
 *   originRect      rect of the icon that was clicked: the dialog grows out
 *                   of that icon, and shrinks back into it on close while it
 *                   is still on screen (not when closing to navigate)
 *   icon, iconColor, iconBackground
 *                   draw the header icon like the clicked one (the profile's
 *                   timeline dots); default: the wallet's glyph and tint
 *   onOpenAccount(name), onOpenPost(author, permlink)
 *                   navigation; the dialog closes first
 * ──────────────────────────────────────────────────────────────────────────── */

const L = (key, fallback) => tr("components.transaction_inspector." + key, fallback);

const FULL_DATE = {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit", second: "2-digit",
};

const ACCOUNT_NAME = /^[a-z][a-z0-9.-]{1,15}$/;
// Payload fields that hold one account name.
const ACCOUNT_FIELDS = new Set([
    "from", "to", "account", "voter", "author", "parent_author", "curator",
    "comment_author", "delegator", "delegatee", "creator", "new_account_name",
    "owner", "receiver", "agent", "who", "benefactor", "producer", "publisher",
    "from_account", "to_account", "witness", "proxy", "account_to_recover",
    "recovery_account", "new_recovery_account",
]);
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$/;
// Payload fields that hold an identifier (a permlink, an id, a key): code.
const IDENT_FIELD = /(permlink|^id|_id|_key)$/;
// Memo text that looks like it carries a link — the phishing warning shows.
const LINKISH = /(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|net|org|io|app|xyz|link|site|top)\b/i;
// trx_in_block of a virtual operation produced outside any transaction.
const UINT32_MAX = 4294967295;

const prefersReducedMotion = () => {
    try {
        return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (e) {
        return false;
    }
};

// Chain timestamps are UTC, usually without the trailing "Z".
function chainTimeMs(raw) {
    if (typeof raw !== "string" || !raw) return 0;
    const ms = new Date(/[zZ]$/.test(raw) ? raw : raw + "Z").valueOf();
    return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

function prettyChainTime(raw) {
    if (typeof raw !== "string" || !raw) return "";
    return raw.replace("T", " ").replace(/(\.\d+)?Z?$/, "") + " UTC";
}

/* ── Chain state: finality + VESTS rate ───────────────────────────────────── */

// Dynamic global properties, shared by every inspector for a few seconds:
// the last irreversible block decides the finality line, the vesting fund
// converts VESTS when the host passes no converter.
const DGP_TTL_MS = 3000;
// While the block is still reversible, look again on this beat (capped), so
// the status turns final with the dialog open.
const FINALITY_POLL_MS = 3000;
const FINALITY_POLL_MAX = 40;
let dgpCache = { at: 0, value: null, pending: null };

function fetchDgp(api) {
    const globals = api && api.globals;
    if (!globals || typeof globals.getDynamicGlobalProperties !== "function") return Promise.resolve(null);
    if (dgpCache.value && Date.now() - dgpCache.at < DGP_TTL_MS) return Promise.resolve(dgpCache.value);
    if (dgpCache.pending) return dgpCache.pending;
    const pending = Promise.resolve()
        .then(() => globals.getDynamicGlobalProperties())
        .then((value) => {
            dgpCache = { at: Date.now(), value: value || dgpCache.value, pending: null };
            return dgpCache.value;
        }, () => {
            dgpCache = { ...dgpCache, pending: null };
            return dgpCache.value;
        });
    dgpCache = { ...dgpCache, pending };
    return pending;
}

function useChainState(api, active, block) {
    const [dgp, setDgp] = React.useState(() => dgpCache.value);
    React.useEffect(() => {
        if (!active) return undefined;
        let cancelled = false;
        let timer = 0;
        let polls = 0;
        const tick = () => {
            fetchDgp(api).then((value) => {
                if (cancelled) return;
                if (value) setDgp(value);
                const lib = Number(value && value.last_irreversible_block_num);
                const b = Number(block);
                if (b > 0 && Number.isFinite(lib) && lib > 0 && b > lib && ++polls < FINALITY_POLL_MAX) {
                    timer = setTimeout(tick, FINALITY_POLL_MS);
                }
            });
        };
        tick();
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [api, active, block]);
    return dgp;
}

// VESTS → PXP from the global properties, the way the wallet does it.
function useVestConverter(api, dgp) {
    const shares = dgp && dgp.total_vesting_shares;
    const fund = dgp && (dgp.total_vesting_fund_pixa || dgp.total_vesting_fund_steem || dgp.total_vesting_fund_hive);
    const sharesKey = typeof shares === "object" ? JSON.stringify(shares) : shares;
    const fundKey = typeof fund === "object" ? JSON.stringify(fund) : fund;
    return React.useMemo(() => {
        const formatter = api && api.formatter;
        if (!formatter || typeof formatter.vestToPixa !== "function" || !shares || !fund) return null;
        return (vests) => {
            const v = parseFloat(vests) || 0;
            return v === 0 ? 0 : formatter.vestToPixa(v, shares, fund);
        };
    }, [api, sharesKey, fundKey]); // eslint-disable-line react-hooks/exhaustive-deps
}

/* ── Prices ───────────────────────────────────────────────────────────────── */

function usePricing(api, open, given) {
    const supplied = Number(given.pxaUsd) > 0;
    const [own, setOwn] = React.useState(null);
    React.useEffect(() => {
        if (!open || supplied) return undefined;
        let cancelled = false;
        const prices = api && api.prices;
        const snap = prices && typeof prices.getSync === "function" ? prices.getSync() : null;
        const currency = given.currency || (get_cached_settings() || {}).currency || "USD";
        // Values stay in USD until the rate for the Settings currency is
        // known — never USD figures under another currency's code.
        const base = {
            pxaUsd: Number(snap && snap.pxaUsd) || 0,
            pxsUsd: Number(snap && snap.pxsUsd) || 0,
            fiatRate: 1,
            currency: "USD",
        };
        setOwn(base);
        if (currency !== "USD" && prices && typeof prices.getFiatRate === "function") {
            Promise.resolve(prices.getFiatRate(currency)).then((rate) => {
                const r = Number(rate);
                if (!cancelled && Number.isFinite(r) && r > 0) setOwn({ ...base, fiatRate: r, currency });
            }, () => {});
        }
        return () => { cancelled = true; };
    }, [api, open, supplied]); // eslint-disable-line react-hooks/exhaustive-deps
    if (supplied) {
        const rate = Number(given.fiatRate);
        return {
            pxaUsd: Number(given.pxaUsd),
            pxsUsd: Number(given.pxsUsd) || 0,
            fiatRate: Number.isFinite(rate) && rate > 0 ? rate : 1,
            currency: given.currency || "USD",
        };
    }
    return own;
}

/* ── Header ───────────────────────────────────────────────────────────────── */

// Operations the wallet's describeOperation leaves generic but the profile's
// History tab shows: titled with the timeline's own copy.
function socialHeader(rec, me) {
    const d = rec.data || {};
    switch (rec.type) {
        case "vote": {
            const w = Number(d.weight) || 0;
            const down = w < 0;
            const mine = d.voter === me;
            return {
                kind: "vote",
                direction: mine ? "out" : "in",
                Icon: down ? ThumbDownRounded : ThumbUpRounded,
                title: mine
                    ? `${t(down ? "components.timeline_event.downvoted" : "components.timeline_event.upvoted")} @${d.author}`
                    : `${t(down ? "components.timeline_event.downvote_from" : "components.timeline_event.upvote_from")} @${d.voter}`,
                subtitle: d.permlink || "",
                headline: formatPercent(w / 100, w % 100 ? 2 : 0),
            };
        }
        case "comment": {
            if (d.parent_author) {
                return {
                    kind: "comment", direction: "self", Icon: CommentRounded,
                    title: `${t("components.timeline_event.replied_to")} @${d.parent_author}`,
                    subtitle: d.parent_permlink || "",
                };
            }
            const blog = /^(pixa|portal)-\d+$/.test(d.parent_permlink || "");
            return {
                kind: "comment", direction: "self", Icon: CommentRounded,
                title: t(blog ? "components.timeline_event.published_a_blog_post" : "components.timeline_event.published_a_pixel_art"),
                subtitle: d.title || d.permlink || "",
            };
        }
        case "comment_payout_update":
            return {
                kind: "payout", direction: "self", Icon: AccountBalanceWalletRounded,
                title: t("components.timeline_event.post_rewards_finalized"),
                subtitle: d.permlink || "",
            };
        case "account_create":
        case "account_create_with_delegation":
        case "create_claimed_account":
        case "account_created":
            return {
                kind: "account", direction: "self", Icon: PersonRounded,
                title: d.creator
                    ? `${t("components.timeline_event.account_created_by")} @${d.creator}`
                    : t("components.timeline_event.account_created"),
                subtitle: d.new_account_name ? `@${d.new_account_name}` : "",
            };
        case "account_update":
        case "account_update2":
            return {
                kind: "account", direction: "self", Icon: EditRounded,
                title: t("components.timeline_event.profile_metadata_updated"),
                subtitle: d.account ? `@${d.account}` : "",
            };
        case "custom_json":
            return {
                kind: "custom", direction: "self", Icon: CodeRounded,
                title: humanizeOpType(rec.type),
                subtitle: d.id || "",
            };
        default:
            return null;
    }
}

// Without a VESTS converter, VESTS stays VESTS — never raw VESTS labelled PXP.
const rawVestsUnit = (vests) => vests;

function buildHeader(rec, me, vestToPixa) {
    const desc = describeOperation(rec, me, vestToPixa || rawVestsUnit);
    let amounts = desc.amounts;
    if (!vestToPixa) amounts = amounts.map((u) => (u.token === "PXP" ? { token: "VESTS", value: u.value } : u));
    if (desc.kind !== "other") {
        return {
            kind: desc.kind,
            direction: desc.direction,
            Icon: (KIND_ICON[desc.kind] || KIND_ICON.other)(desc.direction),
            title: translate(desc.title),
            subtitle: desc.subtitle ? translate(desc.subtitle) : "",
            amounts,
            headline: "",
        };
    }
    const social = socialHeader(rec, me);
    return {
        kind: "other",
        direction: "self",
        Icon: KIND_ICON.other(),
        title: humanizeOpType(rec.type) || translate(desc.title),
        subtitle: "",
        headline: "",
        ...(social || {}),
        amounts,
    };
}

function amountLine(amounts, sign) {
    return amounts
        .map((u, i) => (i === 0 ? `${sign}${fmtUnit(u)}` : fmtUnit(u)))
        .join("  +  ");
}

// Value today, in the display currency. PXP is PXA-denominated.
function fiatOf(amounts, pricing) {
    if (!pricing || !(pricing.pxaUsd > 0)) return "";
    let usd = 0;
    let priced = false;
    for (const u of amounts) {
        const price = u.token === "PXA" || u.token === "PXP" ? pricing.pxaUsd : u.token === "PXS" ? pricing.pxsUsd : 0;
        if (!(price > 0)) continue;
        usd += Math.abs(u.value) * price;
        priced = true;
    }
    if (!priced) return "";
    return formatFiatFromUsd(usd, pricing.fiatRate, pricing.currency, 2);
}

/* ── Fields ───────────────────────────────────────────────────────────────── */

function classifyField(opType, key, value) {
    if (value === null || value === undefined || value === "") return "empty";
    if (typeof value === "object" && !isAssetObj(value) && Object.keys(value).length === 0) return "empty";
    if (key === "memo" && typeof value === "string") return "memo";
    if (Array.isArray(value) && value.length > 0 && /auths$/.test(key)
        && value.every((v) => typeof v === "string" && ACCOUNT_NAME.test(v))) return "accounts";
    if (typeof value === "string" && ACCOUNT_FIELDS.has(key) && ACCOUNT_NAME.test(value)) return "account";
    if (isAssetString(value) || isAssetObj(value)) return "asset";
    if (typeof value === "string" && /json/.test(key)) return "json";
    if (typeof value === "string" && key === "body") return "longtext";
    if (typeof value === "boolean") return "bool";
    if (typeof value === "number" || (typeof value === "string" && /^-?\d+$/.test(value))) {
        if ((opType === "vote" && key === "weight") || /^percent/.test(key)) return "percent";
        return "number";
    }
    if (typeof value === "string" && ISO_TIME.test(value)) return "date";
    if (typeof value === "object") return "object";
    if (IDENT_FIELD.test(key)) return "ident";
    return "text";
}

function parseJsonField(value) {
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" ? parsed : null;
    } catch (e) {
        return null;
    }
}

// Long chain identifiers break at underscores rather than mid-word.
function breakableKey(key) {
    const parts = String(key).split("_");
    const out = [];
    parts.forEach((p, i) => {
        if (i > 0) out.push("_", <wbr key={"w" + i} />);
        out.push(p);
    });
    return out;
}

/* ── Clipboard ────────────────────────────────────────────────────────────── */

function copyText(text, near) {
    const fallback = () => {
        try {
            // Inside the dialog, so its focus trap leaves the selection alone.
            const host = (near && near.parentNode) || document.body;
            const area = document.createElement("textarea");
            area.value = text;
            area.setAttribute("readonly", "");
            area.style.position = "fixed";
            area.style.top = "0";
            area.style.left = "0";
            area.style.opacity = "0";
            host.appendChild(area);
            area.select();
            const ok = document.execCommand("copy");
            host.removeChild(area);
            return ok;
        } catch (e) {
            return false;
        }
    };
    try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
            return navigator.clipboard.writeText(text).then(() => true, fallback);
        }
    } catch (e) { /* fall through */ }
    return Promise.resolve(fallback());
}

const CopyButton = ({ text, classes }) => {
    const [done, setDone] = React.useState(false);
    const timer = React.useRef(0);
    React.useEffect(() => () => clearTimeout(timer.current), []);
    const onClick = (e) => {
        e.stopPropagation();
        copyText(String(text), e.currentTarget).then((ok) => {
            if (!ok) return;
            setDone(true);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setDone(false), 1600);
        });
    };
    const label = done ? L("copied", "Copied") : L("copy", "Copy");
    return (
        <Tooltip title={label} placement="top">
            <IconButton size="small" className={classes.copy} onClick={onClick} aria-label={label}>
                {done ? <CheckRounded /> : <FileCopyRounded />}
            </IconButton>
        </Tooltip>
    );
};

const AccountPill = ({ name, classes, onOpen }) => {
    if (!onOpen) return <span className={classes.accountStatic}>@{name}</span>;
    return (
        <ButtonBase focusRipple className={classes.account} onClick={() => onOpen(name)}>
            @{name}
        </ButtonBase>
    );
};

const Row = ({ label, labelIsKey, classes, children }) => (
    <div className={classes.row}>
        <dt className={labelIsKey ? `${classes.label} ${classes.labelKey} monospace` : classes.label}>
            {labelIsKey ? breakableKey(label) : label}
        </dt>
        <dd className={classes.value}>{children}</dd>
    </div>
);

function FieldValue({ opType, name, value, clippedLength, vestToPixa, classes, onOpenAccount }) {
    const kind = classifyField(opType, name, value);
    const clippedNote = clippedLength ? (
        <span className={classes.note}>{L("shortened", "Shortened for display")}</span>
    ) : null;
    switch (kind) {
        case "empty":
            return <span className={classes.muted}>—</span>;
        case "account":
            return <AccountPill name={value} classes={classes} onOpen={onOpenAccount} />;
        case "accounts":
            return (
                <span className={classes.pills}>
                    {value.map((n) => <AccountPill key={n} name={n} classes={classes} onOpen={onOpenAccount} />)}
                </span>
            );
        case "asset": {
            const unit = toDisplayUnit(value, vestToPixa || rawVestsUnit);
            const shown = unit && !vestToPixa && unit.token === "PXP" ? { token: "VESTS", value: unit.value } : unit;
            const raw = typeof value === "string" ? value : JSON.stringify(value);
            const display = shown ? fmtUnit(shown) : raw;
            return (
                <span className={classes.stack}>
                    <span className={classes.figure}>{display}</span>
                    {raw !== display ? <span className={`${classes.rawAsset} monospace`}>{raw}</span> : null}
                </span>
            );
        }
        case "memo": {
            if (value.charAt(0) === "#") {
                return (
                    <span className={classes.stack}>
                        <span className={classes.encrypted}><LockRounded />{L("encrypted_memo", "Encrypted memo")}</span>
                        <span className={`${classes.hash} monospace`}>{value}</span>
                    </span>
                );
            }
            return (
                <span className={classes.stack}>
                    <span className={classes.memo}>{value}</span>
                    {LINKISH.test(value) ? (
                        <span className={classes.note}>{t("components.pixa_wallet_dialog.beware_of_spam_and_phishing_links_in")}</span>
                    ) : null}
                    {clippedNote}
                </span>
            );
        }
        case "json": {
            const parsed = parseJsonField(value);
            return (
                <span className={classes.stack}>
                    <pre className={`${classes.pre} monospace`}>{parsed ? JSON.stringify(parsed, null, 2) : value}</pre>
                    {clippedNote}
                </span>
            );
        }
        case "longtext":
            return (
                <span className={classes.stack}>
                    <span className={classes.longText}>{value}</span>
                    {clippedNote}
                </span>
            );
        case "percent": {
            const n = Number(value) / 100;
            return <span className={classes.figure}>{formatPercent(n, Number(value) % 100 ? 2 : 0)}</span>;
        }
        case "number":
        case "bool":
            return <span className={`${classes.code} monospace`}>{String(value)}</span>;
        case "date": {
            const ms = chainTimeMs(value);
            return (
                <span className={classes.stack}>
                    <span>{ms ? formatDate(new Date(ms), FULL_DATE) : value}</span>
                    <span className={`${classes.rawAsset} monospace`}>{prettyChainTime(value)}</span>
                </span>
            );
        }
        case "object":
            return <pre className={`${classes.pre} monospace`}>{JSON.stringify(value, null, 2)}</pre>;
        case "ident":
            return <span className={`${classes.hash} monospace`}>{String(value)}</span>;
        default: {
            // Identifier-like (a permlink, a key, an id): monospace, breaks anywhere.
            const s = String(value);
            const ident = !/\s/.test(s) && s.length > 20;
            return (
                <span className={classes.stack}>
                    <span className={ident ? `${classes.hash} monospace` : undefined}>{s}</span>
                    {clippedNote}
                </span>
            );
        }
    }
}

/* ── Opening out of the icon ──────────────────────────────────────────────── */

// The dialog opens out of the icon that was clicked: the icon's circle grows
// into the dialog's place, a rounded square on the way, while its glyph fades
// out; then the content appears. Closing plays it back into the same icon
// when that icon is still on screen.
//
// What grows is the paper itself: it is clipped to a window that starts as
// the icon and opens to the whole paper, and shifted so that window starts
// where the icon is. A veil over the content wears the icon's colours and
// glyph, turns the paper's colour, then lifts off the content. The icon on
// the page is hidden while the dialog is open, by a held animation: its own
// styles stay untouched, and it stays focusable for the focus the dialog
// hands back.

const GROW_MS = 480;
const SHRINK_MS = 380;
// Backdrop and dialog timings while the dialog grows or shrinks: closing
// unmounts a little after the shrink has landed on the icon.
const MORPH_DURATION = { enter: GROW_MS, exit: SHRINK_MS + 40 };
// The dialog's own fade stays off: the window does the showing.
const MORPH_OPAQUE = { opacity: 1 };
// Samples of the window's path (piecewise linear between them).
const MORPH_STEPS = 36;
// Path progress at which the circle starts to square off, and by which it is
// a rounded square with this radius.
const CIRCLE_UNTIL = 0.18;
const SQUARE_AT = 0.5;
const SQUARE_RADIUS = 32;
// Path progress over which the long side of a tall (or wide) dialog catches
// up with the short one: the window opens as a rounded square, then
// stretches into the dialog's shape, done a little before the end.
const STRETCH_FROM = 0.35;
const STRETCH_TO = 0.92;
// The glyph grows a little as it fades.
const GLYPH_GROWTH = 1.9;
const SOFT_EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

function cubicBezier(x1, y1, x2, y2) {
    const ax = 3 * x1 - 3 * x2 + 1, bx = 3 * x2 - 6 * x1, cx = 3 * x1;
    const ay = 3 * y1 - 3 * y2 + 1, by = 3 * y2 - 6 * y1, cy = 3 * y1;
    const xAt = (s) => ((ax * s + bx) * s + cx) * s;
    const yAt = (s) => ((ay * s + by) * s + cy) * s;
    return (x) => {
        if (x <= 0) return 0;
        if (x >= 1) return 1;
        let lo = 0;
        let hi = 1;
        let s = x;
        for (let i = 0; i < 24; i++) {
            s = (lo + hi) / 2;
            if (xAt(s) < x) lo = s;
            else hi = s;
        }
        return yAt(s);
    };
}
// Quick out, long settle — the path's pace, both ways.
const EMPHASIZED = cubicBezier(0.2, 0, 0, 1);

function canMorph() {
    if (prefersReducedMotion()) return false;
    try {
        return typeof Element.prototype.animate === "function"
            && !!(window.CSS && CSS.supports && CSS.supports("clip-path", "inset(1px round 1px)"));
    } catch (e) {
        return false;
    }
}

const isConnected = (el) => (el.isConnected !== undefined ? el.isConnected : document.documentElement.contains(el));

function onScreen(r) {
    const vw = window.innerWidth || 0;
    const vh = window.innerHeight || 0;
    return r.width > 0 && r.height > 0 && r.left + r.width > 0 && r.top + r.height > 0 && r.left < vw && r.top < vh;
}

// The element's rect while it is in the page and on screen, else null.
function liveRect(el) {
    if (!el || !isConnected(el)) return null;
    const r = el.getBoundingClientRect();
    return onScreen(r) ? r : null;
}

// The icon that was clicked: the element under the middle of its rect that
// has that rect (the hit is usually its glyph), past this dialog's own layers.
function findSource(from, ownRoot) {
    if (!from || typeof document.elementsFromPoint !== "function") return null;
    let hits;
    try {
        hits = document.elementsFromPoint(from.left + from.width / 2, from.top + from.height / 2);
    } catch (e) {
        return null;
    }
    const same = (r) => Math.abs(r.left - from.left) < 2 && Math.abs(r.top - from.top) < 2
        && Math.abs(r.width - from.width) < 2 && Math.abs(r.height - from.height) < 2;
    let tried = 0;
    for (const hit of hits) {
        if (ownRoot && ownRoot.contains(hit)) continue;
        if (++tried > 4) break;
        let el = hit;
        for (let depth = 0; el && el !== document.body && depth < 6; depth++) {
            if (same(el.getBoundingClientRect())) return el;
            el = el.parentElement;
        }
    }
    return null;
}

// Hidden without touching its styles; cancel() shows it again.
function holdHidden(el) {
    try {
        return el.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 1, fill: "forwards" });
    } catch (e) {
        return null;
    }
}

function radiusPx(value, rect) {
    const side = Math.min(rect.width, rect.height);
    const n = parseFloat(value);
    if (!Number.isFinite(n)) return side / 2;
    return Math.max(0, Math.min(/%$/.test(value) ? (n / 100) * side : n, side / 2));
}

const isClear = (color) => !color || color === "transparent" || /^rgba\(.*,\s*0\)$/.test(color);

// A copy of a glyph that renders like the original wherever it is put.
function copyGlyph(svg, size) {
    const copy = svg.cloneNode(true);
    copy.setAttribute("aria-hidden", "true");
    copy.removeAttribute("id");
    const gs = getComputedStyle(svg);
    Object.assign(copy.style, size ? {
        width: size + "px", height: size + "px", fontSize: size + "px", padding: "0", boxSizing: "content-box",
    } : {
        width: gs.width, height: gs.height, fontSize: gs.fontSize, padding: gs.padding, boxSizing: gs.boxSizing, color: gs.color,
    });
    Object.assign(copy.style, { display: "block", flex: "none", margin: "0", transition: "none" });
    return copy;
}

// How the clicked icon looks right now: colours, corners, glyph. Without the
// element (not found), its rect and the header icon's colours and glyph.
function readLook(el, rect, fallback, fallbackGlyph) {
    const look = { bg: fallback.bg, fg: fallback.fg, radius: Math.min(rect.width, rect.height) / 2, glyph: null };
    let svg = null;
    if (el) {
        const cs = getComputedStyle(el);
        if (!isClear(cs.backgroundColor)) look.bg = cs.backgroundColor;
        if (cs.color) look.fg = cs.color;
        look.radius = radiusPx(cs.borderTopLeftRadius, rect);
        svg = el.querySelector("svg");
    }
    if (svg) look.glyph = copyGlyph(svg, 0);
    else if (fallbackGlyph) look.glyph = copyGlyph(fallbackGlyph, Math.round(Math.min(rect.width, rect.height) / 2));
    return look;
}

// The veil, laid over the content while the paper grows or shrinks: opaque in
// the paper's colour, with the icon's colour (often translucent) as a tint
// over it, and the icon's glyph on top. It also takes the pointer meanwhile:
// the paper opens right under it, and nothing there should light up (a copy
// button's tooltip) before the content is in place.
function makeVeil(paper, look, paperBg) {
    const fill = { position: "absolute", top: "0", right: "0", bottom: "0", left: "0" };
    const veil = document.createElement("div");
    veil.setAttribute("aria-hidden", "true");
    Object.assign(veil.style, fill, {
        zIndex: "5", display: "flex", alignItems: "center", justifyContent: "center",
        opacity: "0", backgroundColor: paperBg, color: look.fg,
    });
    const tint = document.createElement("div");
    Object.assign(tint.style, fill, { backgroundColor: look.bg, opacity: "0" });
    veil.appendChild(tint);
    let glyph = null;
    if (look.glyph) {
        glyph = document.createElement("div");
        Object.assign(glyph.style, { position: "relative", display: "flex", flex: "none" });
        glyph.appendChild(look.glyph);
        veil.appendChild(glyph);
    }
    paper.appendChild(veil);
    return { veil, tint, glyph };
}

// The window from the icon (e = 0) to the paper (e = 1), in viewport px. The
// short side opens steadily; the long side keeps level with it, then catches
// up: the window passes through a rounded square before it stretches into
// the dialog's shape. Corners: the icon's own as it starts to grow, a rounded
// square's by mid-way, the paper's at the end.
function windowPath(icon, paper) {
    const wide = paper.w >= paper.h;
    const s0 = wide ? icon.h : icon.w;
    const s1 = wide ? paper.h : paper.w;
    const d0 = (wide ? icon.w : icon.h) - s0;
    const d1 = (wide ? paper.w : paper.h) - s1;
    const roundness = icon.r / (Math.min(icon.w, icon.h) / 2 || 1);
    const square = Math.max(paper.r, SQUARE_RADIUS);
    const box = (e) => {
        const short = lerp(s0, s1, e);
        const long = short + lerp(d0, d1, smoothstep((e - STRETCH_FROM) / (STRETCH_TO - STRETCH_FROM)));
        return {
            w: wide ? long : short,
            h: wide ? short : long,
            cx: lerp(icon.cx, paper.cx, e),
            cy: lerp(icon.cy, paper.cy, e),
        };
    };
    const atCircle = box(CIRCLE_UNTIL);
    const circleR = (roundness * Math.min(atCircle.w, atCircle.h)) / 2;
    return (e) => {
        const g = box(e);
        let r;
        if (e <= CIRCLE_UNTIL) r = (roundness * Math.min(g.w, g.h)) / 2;
        else if (e <= SQUARE_AT) r = lerp(circleR, square, (e - CIRCLE_UNTIL) / (SQUARE_AT - CIRCLE_UNTIL));
        else r = lerp(square, paper.r, (e - SQUARE_AT) / (1 - SQUARE_AT));
        g.r = Math.min(r, Math.min(g.w, g.h) / 2);
        return g;
    };
}

// Keyframes for the paper: shifted so the window sits on the path, clipped to
// the window. `progress` maps time (0 → 1) to path progress.
function paperFrames(path, P, progress) {
    const pcx = P.left + P.width / 2;
    const pcy = P.top + P.height / 2;
    const px = (n) => Math.round(n * 100) / 100 + "px";
    const frames = [];
    for (let i = 0; i <= MORPH_STEPS; i++) {
        const u = i / MORPH_STEPS;
        const g = path(progress(u));
        frames.push({
            offset: u,
            transform: `translate(${px(g.cx - pcx)}, ${px(g.cy - pcy)})`,
            clipPath: `inset(${px(Math.max(0, (P.height - g.h) / 2))} ${px(Math.max(0, (P.width - g.w) / 2))} round ${px(g.r)})`,
        });
    }
    return frames;
}

const paperOf = (node) => (node && (node.querySelector('[role="dialog"]') || node.firstElementChild)) || null;

// Everything the grow or the shrink measured, for one paper.
function morphSetup(m, node, rect, fallback, headIcon) {
    const paper = paperOf(node);
    if (!paper || typeof paper.animate !== "function") return null;
    const P = paper.getBoundingClientRect();
    if (!(P.width > 0 && P.height > 0)) return null;
    const look = readLook(m.source, rect, fallback, headIcon && headIcon.querySelector("svg"));
    const ps = getComputedStyle(paper);
    const path = windowPath(
        { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2, w: rect.width, h: rect.height, r: look.radius },
        { cx: P.left + P.width / 2, cy: P.top + P.height / 2, w: P.width, h: P.height, r: radiusPx(ps.borderTopLeftRadius, P) },
    );
    return { paper, P, path, ...makeVeil(paper, look, ps.backgroundColor) };
}

function stopMorph(m) {
    const anims = m.anims;
    m.anims = [];
    m.phase = "";
    anims.forEach((a) => {
        try { a.cancel(); } catch (e) { /* already gone */ }
    });
    if (m.veil && m.veil.parentNode) m.veil.parentNode.removeChild(m.veil);
    m.veil = null;
}

// The icon on the page shows again; the dialog forgets it.
function releaseSource(m) {
    if (m.hold) {
        try { m.hold.cancel(); } catch (e) { /* already gone */ }
    }
    m.hold = null;
    m.source = null;
}

function startGrow(m, node, fallback, headIcon) {
    const from = m.from;
    m.source = findSource(from, node && node.parentNode);
    const rect = (m.source && m.source.getBoundingClientRect()) || from;
    const set = morphSetup(m, node, rect, fallback, headIcon);
    if (!set) {
        // Nothing to measure (no paper laid out yet): a plain entrance.
        m.source = null;
        const paper = paperOf(node);
        if (paper && typeof paper.animate === "function") {
            m.anims = [paper.animate([
                { opacity: 0, transform: "scale(0.96)" },
                { opacity: 1, transform: "none" },
            ], { duration: 220, easing: SOFT_EASE })];
        }
        return;
    }
    if (m.source) m.hold = holdHidden(m.source);
    const { paper, P, path, veil, tint, glyph } = set;
    m.veil = veil;
    // Backwards fill: a grow reversed by an early close holds on the icon.
    const timing = { duration: GROW_MS, fill: "backwards" };
    const grow = paper.animate(paperFrames(path, P, EMPHASIZED), timing);
    m.anims = [
        grow,
        // The icon's colour carries the growing shape, then gives way to
        // the paper's, which lifts off the content as the shape settles.
        tint.animate([
            { offset: 0, opacity: 1 },
            { offset: 0.3, opacity: 1, easing: SOFT_EASE },
            { offset: 0.6, opacity: 0 },
            { offset: 1, opacity: 0 },
        ], timing),
        veil.animate([
            { offset: 0, opacity: 1 },
            { offset: 0.42, opacity: 1, easing: SOFT_EASE },
            { offset: 0.8, opacity: 0 },
            { offset: 1, opacity: 0 },
        ], timing),
    ];
    if (glyph) {
        m.anims.push(glyph.animate([
            { offset: 0, opacity: 1, transform: "scale(1)", easing: SOFT_EASE },
            { offset: 0.3, opacity: 0, transform: `scale(${GLYPH_GROWTH})` },
            { offset: 1, opacity: 0, transform: `scale(${GLYPH_GROWTH})` },
        ], timing));
    }
    m.phase = "grow";
    grow.onfinish = () => {
        if (m.phase === "grow" && m.anims[0] === grow) stopMorph(m);
    };
}

// Closed before the grow finished: the same motion, backwards and a little
// quicker, from wherever it got to.
function reverseGrow(m) {
    m.phase = "shrink";
    m.anims.forEach((a) => {
        try {
            a.playbackRate = -1.25;
            a.play();
        } catch (e) { /* gone */ }
    });
}

function startShrink(m, node, fallback, headIcon) {
    const rect = liveRect(m.source);
    const set = rect ? morphSetup(m, node, rect, fallback, headIcon) : null;
    if (!set) {
        // The icon went away as the dialog closed: fade out instead.
        const paper = paperOf(node);
        if (paper && typeof paper.animate === "function") {
            m.anims = [paper.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: SOFT_EASE, fill: "forwards" })];
        }
        return;
    }
    const { paper, P, path, veil, tint, glyph } = set;
    m.veil = veil;
    // Forwards fill: it rests on the icon until the dialog unmounts.
    const timing = { duration: SHRINK_MS, fill: "forwards" };
    m.anims = [
        paper.animate(paperFrames(path, P, (u) => 1 - EMPHASIZED(u)), timing),
        veil.animate([
            { offset: 0, opacity: 0, easing: SOFT_EASE },
            { offset: 0.16, opacity: 1 },
            { offset: 1, opacity: 1 },
        ], timing),
        tint.animate([
            { offset: 0, opacity: 0 },
            { offset: 0.2, opacity: 0, easing: SOFT_EASE },
            { offset: 0.5, opacity: 1 },
            { offset: 1, opacity: 1 },
        ], timing),
    ];
    if (glyph) {
        m.anims.push(glyph.animate([
            { offset: 0, opacity: 0, transform: `scale(${GLYPH_GROWTH})` },
            { offset: 0.45, opacity: 0, transform: `scale(${GLYPH_GROWTH})`, easing: SOFT_EASE },
            { offset: 0.85, opacity: 1, transform: "scale(1)" },
            { offset: 1, opacity: 1, transform: "scale(1)" },
        ], timing));
    }
    m.phase = "shrink";
}

/* ── Dialog ───────────────────────────────────────────────────────────────── */

let titleIds = 0;

function TransactionInspector(props) {
    const {
        classes, open, record, account, api, vestToPixa: vestToPixaProp,
        pxaUsd, pxsUsd, fiatRate, currency, originRect,
        icon, iconColor, iconBackground,
        onClose, onOpenAccount, onOpenPost,
    } = props;
    useLanguage();
    const theme = useTheme();
    // noSsr: the real answer on the first render — the opening measures the
    // dialog as soon as it mounts, fullscreen or not.
    const fullScreen = useMediaQuery(theme.breakpoints.down("xs"), { noSsr: true });

    // The last record stays on screen through the exit animation.
    const lastRef = React.useRef(null);
    if (record) lastRef.current = record;
    const rec = record || lastRef.current;
    const active = !!open && !!rec;

    const titleIdRef = React.useRef(null);
    if (titleIdRef.current === null) titleIdRef.current = "tx-inspector-title-" + (++titleIds);

    const dgp = useChainState(api, active, rec && rec.block);
    const ownConverter = useVestConverter(api, dgp);
    const vestToPixa = typeof vestToPixaProp === "function" ? vestToPixaProp : ownConverter;
    const pricing = usePricing(api, active, { pxaUsd, pxsUsd, fiatRate, currency });

    const [rawOpen, setRawOpen] = React.useState(false);
    React.useEffect(() => { setRawOpen(false); }, [rec]);

    // Opening out of the clicked icon. Bookkeeping lives in a ref — the motion
    // never re-renders. Whether this opening grows, and whether this closing
    // shrinks back, is settled as `open` flips, before the transition reads
    // its timings.
    const motionRef = React.useRef(null);
    if (motionRef.current === null) {
        motionRef.current = {
            open: false, grow: false, shrink: false, leaving: false,
            from: null, source: null, hold: null, anims: [], veil: null, phase: "",
        };
    }
    const motion = motionRef.current;
    if (!!open !== motion.open) {
        motion.open = !!open;
        if (motion.open) {
            motion.leaving = false;
            motion.shrink = false;
            motion.from = originRect && originRect.width > 0 && originRect.height > 0
                ? { left: originRect.left, top: originRect.top, width: originRect.width, height: originRect.height }
                : null;
            motion.grow = !!motion.from && onScreen(motion.from) && canMorph();
        } else {
            // Back into the icon only when it is still there: not when the
            // dialog closes to navigate, nor when the icon left the screen.
            motion.shrink = motion.grow && !motion.leaving && !!liveRect(motion.source);
        }
    }
    const morphing = motion.open ? motion.grow : motion.shrink;

    // The header icon, and its colours: the stand-ins when the clicked icon
    // can't be found on the page.
    const iconEl = React.useRef(null);
    const faceRef = React.useRef({ bg: "", fg: "" });
    const onEnter = React.useCallback((node) => {
        const m = motionRef.current;
        stopMorph(m);
        releaseSource(m);
        if (m.grow) startGrow(m, node, faceRef.current, iconEl.current);
    }, []);
    const onExit = React.useCallback((node) => {
        const m = motionRef.current;
        if (m.shrink && m.phase === "grow" && m.anims[0] && m.anims[0].playState === "running") {
            reverseGrow(m);
        } else if (m.shrink) {
            stopMorph(m);
            startShrink(m, node, faceRef.current, iconEl.current);
        } else {
            // No way back: the icon shows again under the fading dialog.
            stopMorph(m);
            releaseSource(m);
        }
    }, []);
    const onExited = React.useCallback(() => {
        const m = motionRef.current;
        stopMorph(m);
        releaseSource(m);
    }, []);
    React.useEffect(() => {
        const m = motionRef.current;
        return () => {
            stopMorph(m);
            releaseSource(m);
        };
    }, []);

    const ms = rec ? chainTimeMs(rec.timestamp) : 0;
    const relative = useLiveTimeAgo(active && ms ? ms : null, { labels: "long" });

    if (!rec) return null;

    const head = buildHeader(rec, account, vestToPixa);
    const tint = DIR_STYLE[head.direction] || DIR_STYLE.self;
    const HeadIcon = head.Icon;
    const amountText = head.amounts.length ? amountLine(head.amounts, tint.sign) : head.headline;
    const subtitle = head.subtitle && head.subtitle !== (rec.data && rec.data.memo) ? head.subtitle : "";
    const fiat = head.amounts.length ? fiatOf(head.amounts, pricing) : "";

    const virtual = isVirtualRecord(rec);
    const block = Number(rec.block) > 0 ? Number(rec.block) : 0;
    const lib = Number(dgp && dgp.last_irreversible_block_num);
    const finality = block && Number.isFinite(lib) && lib > 0 ? (block <= lib ? "final" : "pending") : "";
    const trxIndex = Number(rec.trx_in_block);
    const opIndex = Number(rec.op_in_trx);
    const showPosition = !virtual && Number.isFinite(trxIndex) && trxIndex >= 0 && trxIndex < UINT32_MAX;

    const data = rec.data && typeof rec.data === "object" ? rec.data : {};
    const fields = Object.keys(data).filter((k) => !(k === "extensions" && Array.isArray(data[k]) && data[k].length === 0));
    const clipped = rec.clipped || {};
    const author = data.comment_author || data.author;
    const permlink = data.comment_permlink || data.permlink;
    const postRef = onOpenPost && typeof author === "string" && typeof permlink === "string" && author && permlink
        ? { author, permlink }
        : null;

    const raw = {
        op: [rec.type, data],
        trx_id: rec.trx_id,
        block: rec.block,
        trx_in_block: rec.trx_in_block,
        op_in_trx: rec.op_in_trx,
        virtual_op: rec.virtual_op,
        timestamp: rec.timestamp,
        history_index: rec.idx,
    };
    const rawText = JSON.stringify(raw, null, 2);

    // Closing to go somewhere else: no way back into the icon.
    const leave = () => {
        motion.leaving = true;
        if (onClose) onClose();
    };
    const openAccount = onOpenAccount ? (name) => { leave(); onOpenAccount(name); } : null;
    const openPost = postRef ? () => { leave(); onOpenPost(postRef.author, postRef.permlink); } : null;

    const iconStyle = {
        color: iconColor || tint.fg,
        backgroundColor: iconBackground || tint.halo,
    };
    faceRef.current = { bg: iconStyle.backgroundColor, fg: iconStyle.color };

    return (
        <Dialog
            open={!!open}
            onClose={onClose}
            fullWidth
            maxWidth="sm"
            fullScreen={fullScreen}
            scroll="paper"
            aria-labelledby={titleIdRef.current}
            classes={{ paper: fullScreen ? `${classes.paper} ${classes.paperFull}` : classes.paper }}
            transitionDuration={morphing ? MORPH_DURATION : undefined}
            TransitionProps={{ onEnter, onExit, onExited, style: morphing ? MORPH_OPAQUE : undefined }}
        >
            <div className={classes.header}>
                <div className={classes.headRow}>
                    <div ref={iconEl} className={classes.bigIcon} style={iconStyle}>
                        {icon || <HeadIcon />}
                    </div>
                    <div className={classes.headText}>
                        <h2 id={titleIdRef.current} className={classes.title}>{head.title}</h2>
                        {subtitle ? <p className={classes.subtitle}>{subtitle}</p> : null}
                        <span className={`${classes.opName} monospace`}>{rec.type}</span>
                    </div>
                </div>
                <IconButton className={classes.close} onClick={onClose} aria-label={L("close", "Close")}>
                    <CloseRounded />
                </IconButton>

                {head.amounts.length > 1 ? (
                    <div className={`${classes.amount} ${classes.amountStack}`} style={{ color: tint.fg }}>
                        {head.amounts.map((u, i) => <div key={u.token + i}>{tint.sign}{fmtUnit(u)}</div>)}
                    </div>
                ) : amountText ? (
                    <div className={classes.amount} style={{ color: tint.fg }}>{amountText}</div>
                ) : null}
                {fiat ? (
                    <div className={classes.fiat}>
                        <span className="monospace">≈ {fiat}</span> {L("at_todays_price", "at today's price")}
                    </div>
                ) : null}

                <div className={classes.status}>
                    {finality === "final" ? (
                        <span className={`${classes.statusItem} ${classes.statusStrong}`}>
                            <CheckCircleRounded />{L("irreversible", "Irreversible")}
                        </span>
                    ) : finality === "pending" ? (
                        <span className={`${classes.statusItem} ${classes.statusMuted}`}>
                            <HourglassEmptyRounded />{L("reversible", "Not yet irreversible")}
                        </span>
                    ) : null}
                    {virtual ? (
                        <span className={`${classes.statusItem} ${classes.statusMuted}`}>
                            <MemoryRounded />{L("virtual", "Virtual operation")}
                        </span>
                    ) : rec.trx_id ? (
                        <span className={`${classes.statusItem} ${classes.statusMuted}`}>
                            <FingerprintRounded />{L("signed", "Signed transaction")}
                        </span>
                    ) : null}
                </div>
                {virtual ? (
                    <p className={classes.hint}>{L("virtual_hint", "Created by the chain itself, not signed by anyone.")}</p>
                ) : null}
            </div>

            <DialogContent className={classes.content}>
                {ms ? (
                    <div className={classes.when}>
                        <div className={classes.whenMain}>{formatDate(new Date(ms), FULL_DATE)}</div>
                        <div className={classes.whenSub}>{relative}</div>
                        <div className={`${classes.whenSub} monospace`}>{prettyChainTime(rec.timestamp)}</div>
                    </div>
                ) : null}

                <section className={classes.section}>
                    <h3 className={classes.sectionTitle}>{L("transaction", "Transaction")}</h3>
                    <dl className={classes.rows}>
                        {!virtual && rec.trx_id ? (
                            <Row label={L("transaction_id", "Transaction ID")} classes={classes}>
                                <span className={classes.line}>
                                    <span className={`${classes.hash} monospace`}>{rec.trx_id}</span>
                                    <CopyButton text={rec.trx_id} classes={classes} />
                                </span>
                            </Row>
                        ) : null}
                        {block ? (
                            <Row label={L("block", "Block")} classes={classes}>
                                <span className={classes.line}>
                                    <span className={classes.figure}>#{formatInteger(block)}</span>
                                    <CopyButton text={String(block)} classes={classes} />
                                </span>
                            </Row>
                        ) : null}
                        {showPosition ? (
                            <Row label={L("index_in_block", "Index in block")} classes={classes}>
                                <span className={`${classes.code} monospace`}>{trxIndex}</span>
                            </Row>
                        ) : null}
                        {showPosition && Number.isFinite(opIndex) ? (
                            <Row label={L("index_in_transaction", "Index in transaction")} classes={classes}>
                                <span className={`${classes.code} monospace`}>{opIndex}</span>
                            </Row>
                        ) : null}
                        {rec.idx != null && Number.isFinite(Number(rec.idx)) ? (
                            <Row label={L("history_entry", "History entry")} classes={classes}>
                                <span className={classes.figure}>#{formatInteger(Number(rec.idx))}</span>
                            </Row>
                        ) : null}
                    </dl>
                </section>

                {fields.length ? (
                    <section className={classes.section}>
                        <h3 className={classes.sectionTitle}>{L("operation", "Operation")}</h3>
                        <dl className={classes.rows}>
                            {fields.map((name) => (
                                <Row key={name} label={name} labelIsKey classes={classes}>
                                    <FieldValue
                                        opType={rec.type}
                                        name={name}
                                        value={data[name]}
                                        clippedLength={clipped[name]}
                                        vestToPixa={vestToPixa}
                                        classes={classes}
                                        onOpenAccount={openAccount}
                                    />
                                </Row>
                            ))}
                        </dl>
                        {openPost ? (
                            <div className={classes.actions}>
                                <ButtonBase focusRipple className={classes.action} onClick={openPost}>
                                    {L("open_post", "Open post")}<OpenInNewRounded />
                                </ButtonBase>
                            </div>
                        ) : null}
                    </section>
                ) : null}

                <section className={classes.section}>
                    <div className={classes.rawHead}>
                        <ButtonBase
                            className={classes.rawToggle}
                            onClick={() => setRawOpen((v) => !v)}
                            aria-expanded={rawOpen}
                        >
                            <span>{L("raw_data", "Raw data")}</span>
                            <ExpandMoreRounded className={rawOpen ? `${classes.chevron} ${classes.chevronOpen}` : classes.chevron} />
                        </ButtonBase>
                        <CopyButton text={rawText} classes={classes} />
                    </div>
                    <Collapse in={rawOpen} mountOnEnter>
                        <pre className={`${classes.pre} ${classes.rawPre} monospace`}>{rawText}</pre>
                    </Collapse>
                </section>
            </DialogContent>
        </Dialog>
    );
}

/* ── Styles ───────────────────────────────────────────────────────────────── */

const HEAD_FONT = '"Industry Book", "Normative Pro", sans-serif';
const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

const styles = (theme) => {
    const xs = theme.breakpoints.down("xs");
    return {
        paper: {
            backgroundColor: "#0e0e0e",
            backgroundImage: "none",
            color: "#e8e8e8",
            borderRadius: 28,
            overflow: "hidden",
        },
        paperFull: {
            borderRadius: 0,
        },

        header: {
            position: "relative",
            flex: "0 0 auto",
            padding: "24px 24px 20px",
            borderBottom: "1px solid #191919",
            [xs]: {
                padding: "calc(20px + env(safe-area-inset-top, 0px)) 20px 18px",
            },
        },
        headRow: {
            display: "flex",
            alignItems: "center",
            gap: 16,
            paddingRight: 44,
        },
        bigIcon: {
            flex: "0 0 auto",
            width: 56,
            height: 56,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            "& svg": { fontSize: 28 },
        },
        headText: {
            flex: "1 1 auto",
            minWidth: 0,
        },
        title: {
            margin: 0,
            fontFamily: HEAD_FONT,
            fontSize: 20,
            lineHeight: "26px",
            fontWeight: 600,
            color: "#f2f2f2",
            overflowWrap: "anywhere",
        },
        subtitle: {
            margin: "2px 0 0",
            color: "#8f8f8f",
            fontSize: 14,
            lineHeight: "20px",
            overflowWrap: "anywhere",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
        },
        opName: {
            display: "inline-block",
            marginTop: 6,
            padding: "1px 8px",
            borderRadius: 8,
            backgroundColor: "#181818",
            color: "#8f8f8f",
            fontSize: 12,
            lineHeight: "20px",
        },
        close: {
            position: "absolute",
            top: 16,
            right: 16,
            color: "#8f8f8f",
            "&:hover": { color: "#ffffff", backgroundColor: "rgba(255,255,255,0.06)" },
            [xs]: {
                top: "calc(12px + env(safe-area-inset-top, 0px))",
                right: 12,
            },
        },
        amount: {
            marginTop: 20,
            fontSize: 30,
            lineHeight: "36px",
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            fontFeatureSettings: '"tnum"',
            overflowWrap: "anywhere",
            [xs]: { fontSize: 26, lineHeight: "32px" },
        },
        amountStack: {
            fontSize: 24,
            lineHeight: "30px",
            [xs]: { fontSize: 22, lineHeight: "28px" },
        },
        fiat: {
            marginTop: 2,
            color: "#8f8f8f",
            fontSize: 14,
            lineHeight: "20px",
        },
        status: {
            display: "flex",
            flexWrap: "wrap",
            gap: "6px 18px",
            marginTop: 16,
            fontSize: 13,
            lineHeight: "20px",
            "&:empty": { display: "none" },
        },
        statusItem: {
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            "& svg": { fontSize: 16 },
        },
        statusStrong: { color: "#f2f2f2" },
        statusMuted: { color: "#8f8f8f" },
        hint: {
            margin: "4px 0 0",
            color: "#6f6f6f",
            fontSize: 12,
            lineHeight: "18px",
        },

        content: {
            "&.MuiDialogContent-root": {
                padding: "4px 24px 28px",
                [xs]: { padding: "4px 20px calc(24px + env(safe-area-inset-bottom, 0px))" },
            },
        },
        when: {
            padding: "16px 0 4px",
        },
        whenMain: {
            fontSize: 15,
            lineHeight: "22px",
            color: "#e8e8e8",
        },
        whenSub: {
            fontSize: 13,
            lineHeight: "20px",
            color: "#8f8f8f",
        },
        section: {
            marginTop: 20,
        },
        sectionTitle: {
            margin: "0 0 2px",
            fontFamily: HEAD_FONT,
            fontSize: 15,
            lineHeight: "22px",
            fontWeight: 600,
            color: "#f2f2f2",
        },
        rows: {
            margin: 0,
            padding: 0,
        },
        row: {
            display: "flex",
            alignItems: "baseline",
            gap: 16,
            padding: "9px 0",
            borderTop: "1px solid #171717",
            "&:first-child": { borderTop: 0 },
            [xs]: { flexDirection: "column", gap: 2 },
        },
        label: {
            flex: "0 0 140px",
            margin: 0,
            color: "#7a7a7a",
            fontSize: 13,
            lineHeight: "22px",
            overflowWrap: "anywhere",
            [xs]: { flex: "0 0 auto" },
        },
        labelKey: {
            fontSize: 12,
        },
        value: {
            flex: "1 1 auto",
            minWidth: 0,
            margin: 0,
            color: "#e8e8e8",
            fontSize: 14,
            lineHeight: "22px",
            overflowWrap: "anywhere",
            [xs]: { width: "100%" },
        },
        line: {
            display: "flex",
            alignItems: "center",
            gap: 4,
            minWidth: 0,
        },
        stack: {
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 2,
            minWidth: 0,
            width: "100%",
        },
        pills: {
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
        },
        figure: {
            fontVariantNumeric: "tabular-nums",
            fontFeatureSettings: '"tnum"',
        },
        code: {
            fontSize: 13,
            color: "#cfcfcf",
        },
        hash: {
            fontSize: 13,
            wordBreak: "break-all",
            color: "#cfcfcf",
            minWidth: 0,
        },
        muted: { color: "#6f6f6f" },
        rawAsset: {
            color: "#6f6f6f",
            fontSize: 12,
            lineHeight: "18px",
            wordBreak: "break-all",
        },
        note: {
            color: "#6f6f6f",
            fontSize: 12,
            lineHeight: "18px",
        },
        copy: {
            flex: "0 0 auto",
            padding: 5,
            color: "#6f6f6f",
            "&:hover": { color: "#ffffff" },
            "& svg": { fontSize: 16 },
        },
        account: {
            height: 26,
            padding: "0 10px",
            borderRadius: 13,
            backgroundColor: "#1a1a1a",
            color: "#f2f2f2",
            fontSize: 13,
            lineHeight: "26px",
            transition: `background-color 160ms ${EASE}`,
            "&:hover": { backgroundColor: "#262626" },
            "&.Mui-focusVisible": { boxShadow: "0 0 0 2px rgba(255,255,255,0.5)" },
        },
        accountStatic: { color: "#f2f2f2" },
        encrypted: {
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "#bdbdbd",
            "& svg": { fontSize: 16 },
        },
        memo: {
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            backgroundColor: "#151515",
            borderRadius: 12,
            padding: "8px 12px",
            width: "100%",
            boxSizing: "border-box",
        },
        longText: {
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            maxHeight: 200,
            overflowY: "auto",
            backgroundColor: "#151515",
            borderRadius: 12,
            padding: "8px 12px",
            width: "100%",
            boxSizing: "border-box",
            fontSize: 13,
            lineHeight: "20px",
            color: "#cfcfcf",
        },
        pre: {
            margin: 0,
            width: "100%",
            boxSizing: "border-box",
            maxHeight: 240,
            overflow: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            backgroundColor: "#090909",
            border: "1px solid #1a1a1a",
            borderRadius: 12,
            padding: "10px 12px",
            fontSize: 12,
            lineHeight: "18px",
            color: "#c8c8c8",
        },
        rawPre: {
            marginTop: 6,
            maxHeight: 360,
        },
        actions: {
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 12,
        },
        action: {
            height: 36,
            padding: "0 14px 0 16px",
            borderRadius: 18,
            gap: 8,
            backgroundColor: "#d0d0d0",
            color: "#151515",
            fontSize: 14,
            fontWeight: 600,
            transition: `background-color 200ms ${EASE}, color 200ms ${EASE}`,
            "&:hover": { backgroundColor: "#ffffff", color: "#000000" },
            "&.Mui-focusVisible": { boxShadow: "0 0 0 2px rgba(255,255,255,0.5)" },
            "& svg": { fontSize: 18 },
        },
        rawHead: {
            display: "flex",
            alignItems: "center",
            gap: 4,
        },
        rawToggle: {
            flex: "1 1 auto",
            justifyContent: "space-between",
            padding: "6px 4px 6px 0",
            borderRadius: 8,
            color: "#f2f2f2",
            fontFamily: HEAD_FONT,
            fontSize: 15,
            lineHeight: "22px",
            fontWeight: 600,
            "&.Mui-focusVisible": { boxShadow: "0 0 0 2px rgba(255,255,255,0.5)" },
        },
        chevron: {
            color: "#8f8f8f",
            transition: `transform 200ms ${EASE}`,
        },
        chevronOpen: {
            transform: "rotate(180deg)",
        },
    };
};

export default withStyles(styles)(React.memo(TransactionInspector));