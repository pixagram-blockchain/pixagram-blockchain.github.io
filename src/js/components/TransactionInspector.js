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
 *   originRect      rect of the icon that was clicked: the dialog's icon
 *                   flies out of it
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

/* ── Icon flight ──────────────────────────────────────────────────────────── */

// The header icon grows out of the icon that was clicked: a copy of it flies
// from the clicked rect to its place in the dialog, then hands over.
const FLIGHT_MS = 380;
const FLIGHT_EASE = "cubic-bezier(0.2, 0, 0, 1)";

function flyFrom(origin, el) {
    if (!origin || !el || prefersReducedMotion() || typeof el.animate !== "function") return null;
    const to = el.getBoundingClientRect();
    if (!(to.width > 0) || !(origin.width > 0)) return null;
    const ghost = el.cloneNode(true);
    ghost.setAttribute("aria-hidden", "true");
    Object.assign(ghost.style, {
        position: "fixed",
        left: to.left + "px",
        top: to.top + "px",
        width: to.width + "px",
        height: to.height + "px",
        margin: "0",
        zIndex: "1400",
        pointerEvents: "none",
        transformOrigin: "50% 50%",
    });
    document.body.appendChild(ghost);
    el.style.visibility = "hidden";
    const dx = origin.left + origin.width / 2 - (to.left + to.width / 2);
    const dy = origin.top + origin.height / 2 - (to.top + to.height / 2);
    const scale = origin.width / to.width;
    let finished = false;
    const done = () => {
        if (finished) return;
        finished = true;
        if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
        el.style.visibility = "";
    };
    let anim = null;
    try {
        anim = ghost.animate([
            { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
            { transform: "translate(0px, 0px) scale(1)" },
        ], { duration: FLIGHT_MS, easing: FLIGHT_EASE });
        anim.onfinish = done;
        anim.oncancel = done;
    } catch (e) {
        done();
        return null;
    }
    return () => {
        try { if (anim) anim.cancel(); } catch (e) { /* already gone */ }
        done();
    };
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
    // noSsr: the real answer on the first render — the icon flight measures
    // the dialog as soon as it mounts, fullscreen or not.
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

    // Icon flight — once per opening, as soon as the header icon is laid out.
    const iconEl = React.useRef(null);
    const flownFor = React.useRef(null);
    const landFlight = React.useRef(null);
    const tryFly = React.useCallback(() => {
        const el = iconEl.current;
        if (!el || !open || !originRect || flownFor.current === originRect) return;
        flownFor.current = originRect;
        if (landFlight.current) landFlight.current();
        landFlight.current = flyFrom(originRect, el);
    }, [open, originRect]);
    const setIconEl = React.useCallback((el) => {
        iconEl.current = el;
        if (el) tryFly();
    }, [tryFly]);
    React.useEffect(() => { tryFly(); }, [tryFly]);
    // Closed (or unmounted) mid-flight: the copy must not land on a dialog
    // that is fading out.
    React.useEffect(() => {
        if (!open && landFlight.current) {
            landFlight.current();
            landFlight.current = null;
        }
    }, [open]);
    React.useEffect(() => () => { if (landFlight.current) landFlight.current(); }, []);

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

    const openAccount = onOpenAccount ? (name) => { if (onClose) onClose(); onOpenAccount(name); } : null;
    const openPost = postRef ? () => { if (onClose) onClose(); onOpenPost(postRef.author, postRef.permlink); } : null;

    const iconStyle = {
        color: iconColor || tint.fg,
        backgroundColor: iconBackground || tint.halo,
    };

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
        >
            <div className={classes.header}>
                <div className={classes.headRow}>
                    <div ref={setIconEl} className={classes.bigIcon} style={iconStyle}>
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
