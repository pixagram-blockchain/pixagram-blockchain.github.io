import * as React from "preact/compat";
import timeAgo from '../utils/TimeAgo';
import { NumericFormat } from 'react-number-format';

import withStyles from "@material-ui/core/styles/withStyles";
import DialogContent from "@material-ui/core/DialogContent";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import Checkbox from '@material-ui/core/Checkbox';
import TextField from "@material-ui/core/TextField";
import IconButton from "@material-ui/core/IconButton";
import ButtonBase from "@material-ui/core/ButtonBase";
import CircularProgress from "@material-ui/core/CircularProgress";
import Collapse from "@material-ui/core/Collapse";
import Skeleton from "@material-ui/lab/Skeleton";
import { cssBackgroundImage } from "../utils/safeUrl";
import { DEFAULT_NODES } from "../utils/constants";

import { T } from "../utils/T";
import { t } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";
import ExpandMoreRounded from "@material-ui/icons/ExpandMoreRounded";

const { memo } = React;

const styles = theme => ({
    dialogContent: {
        padding: "24px"
    },
    sectionTitle: {
        fontSize: "18px",
        fontWeight: 600,
        color: "#fff",
        fontFamily: "'Industry Book'",
        marginBottom: "8px"
    },
    sectionDescription: {
        fontSize: "14px",
        color: "#888",
        fontFamily: "'Normative Pro'",
        marginBottom: "16px"
    },
    textFieldWrapper: {
        width: "100%",
        boxSizing: "border-box",
        margin: "8px 0px 16px 0px"
    },
    buttonGroup: {
        display: "flex",
        gap: "12px",
        justifyContent: "flex-end",
        marginBottom: "32px"
    },
    witnessTableWrapper: {
        overflowX: "auto",
        // Reaching the end of the table must not turn into the browser's
        // back-swipe / page overscroll.
        overscrollBehaviorX: "contain",
        touchAction: "manipulation",
        contain: "style layout",
        "-webkit-overflow-scrolling": "touch"
    },
    witnessTable: {
        width: "100%",
        minWidth: "1040px",
        borderCollapse: "collapse",
        marginTop: theme.spacing(2),
        marginBottom: theme.spacing(1),
        fontSize: "0.875rem",
        "& tr > th": {
            backgroundColor: "#191919",
            padding: theme.spacing(1.5),
            textAlign: "left",
            fontWeight: 600,
            whiteSpace: "nowrap",
            borderBottom: `0px solid #ffffff12`,
            transition: "background-color 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms",
        },
        "& tr:hover > th": {
            backgroundColor: "#222",
            transition: "background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        },
        "& tr > th:first-child": {
            borderRadius: "16px 0px 0px 0px"
        },
        "& tr > th:last-child": {
            borderRadius: "0px 16px 0px 0px",
        },
        "& tr > td": {
            backgroundColor: "transparent",
            transition: "background-color 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms",
        },
        "& tr:hover > td": {
            backgroundColor: "#171717",
            transition: "background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        },
        // The row of the witness that signed the current head block.
        "& tr$rowProducing > td": {
            backgroundColor: "#1c1c1c"
        },
        "& tr$rowProducing:hover > td": {
            backgroundColor: "#202020"
        },
        "& tr:last-child > td:first-child": {
            borderRadius: "0px 0px 0px 16px"
        },
        "& tr:last-child > td:last-child": {
            borderRadius: "0px 0px 16px 0px",
        },
        "& td": {
            padding: "4px 12px",
            borderBottom: `1px solid #ffffff12`
        },
        "& tr:last-child td": {
            borderBottom: "0px"
        },
        "& tbody": {
            backgroundColor: "#101010"
        }
    },
    rowProducing: {},
    witnessCell: {
        display: "flex",
        gap: 8,
        alignItems: "center"
    },
    witnessAvatar: {
        margin: "8px 8px 8px 0px",
        borderRadius: "12px",
        backgroundSize: "cover",
        width: 42,
        height: 42
    },
    witnessInfo: {
        marginLeft: 8
    },
    witnessName: {
        display: "block",
        fontSize: "14px",
        fontFamily: "'Industry Book'"
    },
    witnessDescription: {
        marginTop: "4px",
        color: "#999",
        display: "block",
        fontSize: "11px",
        fontFamily: "'Normative Pro'"
    },
    // "API available" — the witness also operates one of the public API nodes
    // (DEFAULT_NODES). Same pill as witnessBadge, sized to sit after the name.
    apiBadge: {
        display: "inline-block",
        verticalAlign: "middle",
        marginLeft: "8px",
        padding: "1px 6px",
        borderRadius: "8px",
        backgroundColor: "#262626",
        color: "#bbb",
        fontSize: "10px",
        lineHeight: "16px",
        fontFamily: "'Geist Mono'",
        fontWeight: "bold",
        letterSpacing: "0.5px",
        whiteSpace: "nowrap"
    },
    // Round status after the name: "producing now" (signed the head block),
    // "in this round" (in current_shuffled_witnesses) or "backup". Same pill
    // as apiBadge; the modifiers below only change the colours.
    statusBadge: {
        display: "inline",
        verticalAlign: "middle",
        marginLeft: "8px",
        padding: "1px 6px",
        borderRadius: "8px",
        backgroundColor: "#262626",
        color: "#bbb",
        fontSize: "10px",
        lineHeight: "16px",
        fontFamily: "'Geist Mono'",
        fontWeight: "bold",
        letterSpacing: "0.5px",
        whiteSpace: "nowrap"
    },
    statusProducing: {
        backgroundColor: "#ffffff",
        color: "#000000"
    },
    statusBackup: {
        backgroundColor: "#1a1a1a",
        color: "#777"
    },
    versionBadge: {
        margin: "8px",
        padding: "4px 8px",
        borderRadius: "8px",
        backgroundColor: "#262626",
        color: "#fff",
        fontWeight: "bold",
        fontFamily: "'Geist Mono'",
        display: "inline"
    },
    monoText: {
        fontFamily: "'Geist Mono'"
    },
    blockInfo: {
        fontSize: "12px",
        fontFamily: "'Geist Mono'"
    },
    blockTime: {
        fontSize: "8px",
        color: "#666"
    },
    loadingWrap: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
        color: "#666"
    },
    emptyRow: {
        padding: "24px !important",
        textAlign: "center",
        color: "#777",
        fontFamily: "'Normative Pro'"
    },
    witnessPanel: {
        marginTop: "32px",
        marginBottom: "16px",
        padding: "20px",
        borderRadius: "16px",
        backgroundColor: "#101010"
    },
    witnessPanelHeader: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "8px"
    },
    witnessBadge: {
        padding: "2px 8px",
        borderRadius: "8px",
        backgroundColor: "#262626",
        color: "#bbb",
        fontSize: "11px",
        fontFamily: "'Geist Mono'",
        fontWeight: "bold",
        letterSpacing: "0.5px"
    },
    broadcastError: {
        marginTop: "8px",
        padding: "8px 12px",
        borderRadius: "8px",
        backgroundColor: "#1a1a1a",
        color: "#bbb",
        border: "1px solid #ffffff1f",
        fontSize: "12px",
        fontFamily: "'Geist Mono'"
    },
    broadcastSuccess: {
        marginTop: "8px",
        padding: "8px 12px",
        borderRadius: "8px",
        backgroundColor: "#1a1a1a",
        color: "#bbb",
        border: "1px solid #ffffff1f",
        fontSize: "12px",
        fontFamily: "'Geist Mono'"
    },
    // ── Witness schedule panel: live block line, then an expandable ──
    // ── "Details" section with the round stats and the round itself ──
    schedulePanel: {
        marginTop: "8px",
        marginBottom: "16px",
        padding: "20px",
        borderRadius: "16px",
        backgroundColor: "#101010"
    },
    // The "Details" toggle in the panel header. Same pill family as
    // witnessBadge, pushed to the right edge of the header.
    scheduleToggle: {
        marginLeft: "auto",
        display: "inline-flex",
        alignItems: "center",
    },
    scheduleChevron: {
        color: "#888",
        flexShrink: 0,
        transition: "transform 320ms cubic-bezier(0.4, 0, 0.2, 1), color 200ms ease"
    },
    scheduleChevronOpen: {
        flexShrink: 0,
        transform: "rotate(180deg)",
        color: "#dddddd"
    },
    scheduleDetails: {
        paddingTop: "18px"
    },
    liveLine: {
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "8px 20px",
        margin: "12px 0px 0px 0px",
        fontFamily: "'Geist Mono'",
        fontSize: "12px",
        color: "#aaa"
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: "50%",
        backgroundColor: "#ffffff",
        boxShadow: "0 0 0 3px rgba(255,255,255,0.14)",
        flexShrink: 0
    },
    liveItem: {
        display: "flex",
        alignItems: "baseline",
        gap: "6px",
        whiteSpace: "nowrap"
    },
    liveLabel: {
        color: "#666",
        fontFamily: "'Industry Book'",
        fontSize: "10px",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.5px"
    },
    liveValue: {
        color: "#fff",
        fontWeight: "bold"
    },
    liveLink: {
        cursor: "pointer",
        "&:hover": {
            textDecoration: "underline"
        }
    },
    statsGrid: {
        display: "flex",
        flexWrap: "wrap",
        gap: "16px 24px"
    },
    statItem: {
        flex: "1 1 auto",
        minWidth: "110px",
        [theme.breakpoints.down("sm")]: {
            minWidth: "calc(50% - 12px)"
        }
    },
    statLabel: {
        fontSize: "10px",
        fontWeight: 600,
        color: "#666",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        fontFamily: "'Industry Book'",
        marginBottom: "4px"
    },
    statValue: {
        fontSize: "15px",
        color: "#fff",
        fontFamily: "'Geist Mono'",
        whiteSpace: "nowrap"
    },
    statSub: {
        fontSize: "10px",
        color: "#666",
        fontFamily: "'Geist Mono'",
        marginTop: "2px"
    },
    roundStrip: {
        display: "flex",
        flexWrap: "wrap",
        gap: "6px",
        marginTop: "18px"
    },
    roundChip: {
        padding: "3px 9px",
        borderRadius: "8px",
        backgroundColor: "#1a1a1a",
        border: "1px solid transparent",
        color: "#999",
        fontSize: "11px",
        fontFamily: "'Geist Mono'",
        cursor: "default",
        whiteSpace: "nowrap",
        transition: "background-color 150ms ease, color 150ms ease, border-color 150ms ease"
    },
    roundChipNext: {
        borderColor: "#666",
        color: "#e0e0e0"
    },
    roundChipCurrent: {
        backgroundColor: "#ffffff",
        color: "#000000",
        fontWeight: "bold"
    }
});

// Inline style objects and option bags that used to be re-created on every
// render — hoisted so memoised children see the same reference each time.
const NO_MARGIN_BOTTOM = { marginBottom: 0 };
const AVATAR_BUTTON_STYLE = { borderRadius: "12px" };
const RANK_STYLE = { fontWeight: "bold" };
const SPINNER_STYLE = { marginRight: 8, color: "inherit" };
const ADMIN_BUTTONS_STYLE = { marginTop: "16px", marginBottom: 0 };
const SHRINK_LABEL = { shrink: true };
const PASSIVE = { passive: true };

// Whether the schedule panel's "Details" section is open. Kept for the
// session so re-opening the dialog keeps the last choice.
let scheduleDetailsOpen = false;

// ──────────────────────────────────────────────────────────────
// Currency input (mirrors PixaWalletSendDialog's NumberFormatCustom):
// renders a numeric field with a chain-asset suffix, e.g. "1.000 PXS".
// ──────────────────────────────────────────────────────────────
function NumberFormatCustom(props) {
    const { inputRef, onChange, currency, ...other } = props;
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
            suffix={" " + currency}
            prefix={""}
        />
    );
}

// ──────────────────────────────────────────────────────────────
// account_creation_fee bounds, in 0.001-PIXA units — the stock Hive
// HIVE_MIN_ACCOUNT_CREATION_FEE / HIVE_MAX_ACCOUNT_CREATION_FEE. The node
// rejects anything outside this range ("account_creation_fee smaller than
// minimum account creation fee"), so the form enforces it before signing.
// ──────────────────────────────────────────────────────────────
const FEE_SYMBOL = 'PIXA';           // raw chain symbol (never the display "PXA")
const FEE_PRECISION = 3;
const FEE_MIN_UNITS = 1;             // 0.001 PIXA
const FEE_MAX_UNITS = 1000000000;    // 1,000,000.000 PIXA

const FEE_INPUT_PROPS = { inputComponent: NumberFormatCustom, inputProps: { currency: FEE_SYMBOL } };

// "0.001" → 1; "" / "abc" / negative → NaN
const feeInputToUnits = (s) => {
    const n = Number(String(s === null || s === undefined ? '' : s).trim());
    return Number.isFinite(n) && n >= 0 ? Math.round(n * Math.pow(10, FEE_PRECISION)) : NaN;
};
const isValidFeeUnits = (u) =>
    Number.isInteger(u) && u >= FEE_MIN_UNITS && u <= FEE_MAX_UNITS;
// 1 → "0.001 PIXA" — the asset string dpixa's Types.Asset serializer expects
const feeUnitsToAsset = (u) =>
    `${(u / Math.pow(10, FEE_PRECISION)).toFixed(FEE_PRECISION)} ${FEE_SYMBOL}`;

// ──────────────────────────────────────────────────────────────
// A witness is considered "active" when it has a real signing
// key. Disabled witnesses publish the null public key, which
// is a long run of 1s regardless of chain address prefix
// (STM / HIVE / PIX etc). Detecting a long 1-run is prefix-safe.
//
// The null key is <prefix>1111111111111111111111111111111114T1Anm: 33 ones
// (one per zero byte of the 33-byte key) and a 6-char checksum. The run
// threshold was 40, which no null key ever reaches, so disabled witnesses
// were never filtered — 30 is comfortably above any real key's 1-run.
// ──────────────────────────────────────────────────────────────
const NULL_KEY_RUN_RE = /1{30,}/;
const isActiveWitness = (w) =>
    !!w && typeof w.signing_key === 'string' && !NULL_KEY_RUN_RE.test(w.signing_key);

// ──────────────────────────────────────────────────────────────
// Live chain state
//
// A block is produced every HIVE_BLOCK_INTERVAL (3 s) by the next witness in
// the round, so `current_witness` in the dynamic global properties changes
// every block.
//
// A fixed 3 s timer lands anywhere inside a block, so on average it shows a
// block 1.5 s after the fact. Instead the panel aligns itself to the chain:
// each block's own timestamp says when the next one is due, and the poll is
// scheduled `lead` ms after that. A poll that still sees the old head asked
// too early — it retries shortly and widens the lead; clean hits narrow it
// again, so the lead settles just above the node's real latency (and absorbs
// a modest local-clock skew, in either direction). When the local clock and
// chain time disagree by more than POLL_MAX_SKEW_MS the two cannot be
// aligned, and it falls back to a plain once-per-block cadence.
// ──────────────────────────────────────────────────────────────
const BLOCK_INTERVAL_S = 3;
const BLOCK_INTERVAL_MS = BLOCK_INTERVAL_S * 1000;
const POLL_LEAD_START_MS = 400;      // first guess: ask this long after a block is due
const POLL_LEAD_MIN_MS = -1500;      // may go negative: a local clock that runs behind
const POLL_LEAD_MAX_MS = 2500;
const POLL_LEAD_STEP_MS = 250;       // widen by this after a miss
const POLL_LEAD_RELAX_MS = 25;       // narrow by this after a clean hit
const POLL_RETRY_MS = 600;           // a miss retries after this…
const POLL_MAX_RETRIES = 1;          // …this many times, then waits a full interval
const POLL_MIN_GAP_MS = 200;
const POLL_MAX_SKEW_MS = 10000;
const ROWS_REFRESH_MS = 60 * 1000;   // witness rows, avatars and the median feed
const SCHEDULE_RETRY_MS = 30 * 1000; // when the schedule read failed
const WITNESS_FETCH_LIMIT = 60;
const WITNESS_LIST_MAX = 30;         // the max-votable set, and the table's length

// Chain timestamps are naive UTC ("2026-09-23T12:00:00"); NaN when absent.
const chainMs = (s) => (s ? Date.parse(String(s).replace(/Z?$/, 'Z')) : NaN);
// ms → the same naive-UTC shape the chain emits, so TimeAgo treats both alike.
const toChainIso = (ms) => new Date(ms).toISOString().slice(0, 19);

// ──────────────────────────────────────────────────────────────
// Format helpers
// ──────────────────────────────────────────────────────────────
const formatVotes = (v) => {
    const n = typeof v === 'string' ? Number(v) : (v || 0);
    if (!isFinite(n) || n <= 0) return '0';
    // VESTS are huge — collapse into readable magnitudes.
    if (n >= 1e15) return `${(n / 1e15).toFixed(2)}P`;
    if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
    if (n >= 1e9)  return `${(n / 1e9).toFixed(2)}G`;
    if (n >= 1e6)  return `${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3)  return `${(n / 1e3).toFixed(1)}k`;
    return String(Math.round(n));
};

const formatInt = (n) => (Number(n) || 0).toLocaleString('en-US');

// 65536 → "64 KB", 2097152 → "2 MB"
const formatBytes = (n) => {
    const v = Number(n) || 0;
    if (v >= 1048576) return `${(v / 1048576).toFixed(v % 1048576 ? 2 : 0)} MB`;
    if (v >= 1024) return `${(v / 1024).toFixed(v % 1024 ? 1 : 0)} KB`;
    return `${v} B`;
};

// 45 → "45s", 125 → "2m 5s", 3900 → "1h 5m"
const formatSeconds = (s) => {
    const v = Math.max(0, Math.round(s));
    if (v < 60) return `${v}s`;
    if (v < 3600) return `${Math.floor(v / 60)}m ${v % 60}s`;
    if (v < 86400) return `${Math.floor(v / 3600)}h ${Math.floor((v % 3600) / 60)}m`;
    return `${Math.floor(v / 86400)}d ${Math.floor((v % 86400) / 3600)}h`;
};

// Witness `votes` are vesting share units (1e6 per VESTS). Through the
// vesting share price — total_vesting_fund_<coin> / total_vesting_shares,
// the fund key found by prefix so the fork's coin name does not matter —
// they become Pixa Power, which is what the number means to a voter.
const vestingSharePrice = (dgp) => {
    if (!dgp || typeof dgp !== 'object') return null;
    const fundKey = Object.keys(dgp).find(k => k.startsWith('total_vesting_fund_'));
    const fund = fundKey ? parseFeedAsset(dgp[fundKey]).amount : NaN;
    const shares = parseFeedAsset(dgp.total_vesting_shares).amount;
    return (fund > 0 && shares > 0) ? fund / shares : null;
};
const sharesToPower = (shares, price) => {
    const vests = (Number(shares) || 0) / 1e6;
    return (Number.isFinite(price) && price > 0) ? vests * price : null;
};
const formatPower = (v) => {
    const n = Number(v) || 0;
    if (n >= 1e9) return `${(n / 1e9).toFixed(2)}b`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}m`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
    return String(Math.round(n));
};

// ──────────────────────────────────────────────────────────────
// Price feed
//
// The fork renamed the HBD-era witness fields to PXS: the record carries
// `pxs_exchange_rate` / `last_pxs_exchange_update` (the same `pxs_*` names the
// proxy's witnessSetProperties() broadcasts). `hbd_*` / `sbd_*` are kept as
// fallbacks only so a stock-named node still renders.
//
// The feed is a Price { base: "X PXS", quote: "Y PIXA" } and is read as a
// ratio — how many PXA one PXS is worth (quote ÷ base, the same orientation
// as PricesAPI's feedRatio) — and written that way: "1 PXS = 102 PXA".
// There is no fiat on chain, so no dollar sign anywhere.
// ──────────────────────────────────────────────────────────────
const getWitnessPriceFeed = (w) =>
    (w && (w.pxs_exchange_rate || w.hbd_exchange_rate || w.sbd_exchange_rate)) || null;

const getWitnessFeedUpdatedAt = (w) =>
    (w && (w.last_pxs_exchange_update || w.last_hbd_exchange_update || w.last_sbd_exchange_update)) || null;

const parseFeedAsset = (a) => {
    if (!a) return { amount: NaN, symbol: '' };
    if (typeof a === 'string') {
        const m = a.trim().match(/^([\d.]+)\s*([A-Za-z]*)$/);
        return m ? { amount: Number(m[1]), symbol: m[2] || '' } : { amount: NaN, symbol: '' };
    }
    if (typeof a === 'object' && 'amount' in a) {
        const p = Number(a.precision || 0);
        return { amount: Number(a.amount) / Math.pow(10, p), symbol: '' };
    }
    return { amount: NaN, symbol: '' };
};

// Read-only display values of the witness's current on-chain parameters
// (`witness.props`). `account_creation_fee` may arrive as a legacy asset
// string ("0.001 PIXA") or an NAI object — `parseFeedAsset` reads both. The
// fork renamed `hbd_interest_rate` → `pxs_interest_rate`; the stock names are
// kept as fallbacks like the price-feed fields above (first *defined* value
// wins — 0 is a legitimate rate, so no `||` chain here).
const asPlainNumberString = (v) =>
    (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) ? '' : String(Number(v));

const getWitnessChainProps = (w) => {
    const p = (w && w.props) || {};
    const fee = parseFeedAsset(p.account_creation_fee);
    const rate = [p.pxs_interest_rate, p.hbd_interest_rate, p.sbd_interest_rate]
        .find((v) => v !== undefined && v !== null);
    return {
        baseFee: Number.isFinite(fee.amount) ? fee.amount.toFixed(FEE_PRECISION) : '',
        maxBlockSize: asPlainNumberString(p.maximum_block_size),
        interestRate: asPlainNumberString(rate)
    };
};

// Human string of the raw feed as published, e.g. "1.000 PXS / 20.000 PIXA".
const formatRawPriceFeed = (feed) => {
    if (!feed || !feed.base || !feed.quote) return '';
    const asText = (a) => (typeof a === 'string' ? a : `${parseFeedAsset(a).amount}`);
    return `${asText(feed.base)} / ${asText(feed.quote)}`;
};

// Chain symbol → the symbol the app writes (PIXA is shown as PXA everywhere).
const DISPLAY_SYMBOL = { PIXA: 'PXA', PXS: 'PXS', VESTS: 'PXP' };
const displaySymbol = (sym, fallback) => DISPLAY_SYMBOL[sym] || sym || fallback;

// 102.000 → "102", 101.500 → "101.5", 57.143 → "57.143"
const formatRatio = (n) => n.toFixed(3).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');

const formatPriceFeed = (feed) => {
    if (!feed) return '—';
    const base = parseFeedAsset(feed.base);    // PXS side
    const quote = parseFeedAsset(feed.quote);  // PXA side
    // A witness that never published a feed still carries a zero price
    // (0/0, or 0 PXS over the default quote) — render as em-dash rather than
    // a meaningless ratio.
    if (!isFinite(base.amount) || !isFinite(quote.amount)) return '—';
    if (base.amount <= 0 || quote.amount <= 0) return '—';
    const ratio = quote.amount / base.amount;  // PXA per 1 PXS
    return `1 ${displaySymbol(base.symbol, 'PXS')} = ${formatRatio(ratio)} ${displaySymbol(quote.symbol, 'PXA')}`;
};

// ──────────────────────────────────────────────────────────────
// "API available"
//
// A witness is marked as running a public API node when it matches one of
// the app's known nodes (utils/constants DEFAULT_NODES): either the node
// entry names it explicitly (`witness: "<account>"`) or the host of the
// witness's on-chain `url` is the node's host.
// ──────────────────────────────────────────────────────────────
const hostOf = (url) => {
    if (!url || typeof url !== 'string') return '';
    try {
        const u = new URL(url.trim());
        if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
        return u.hostname.toLowerCase().replace(/^www\./, '');
    } catch (e) {
        return '';
    }
};

const findApiNodeForWitness = (w) => {
    if (!w || !Array.isArray(DEFAULT_NODES)) return null;
    const owner = String(w.owner || '').toLowerCase();
    const witnessHost = hostOf(w.url);
    for (const node of DEFAULT_NODES) {
        if (!node) continue;
        if (node.witness && String(node.witness).toLowerCase() === owner) return node;
        const nodeHost = hostOf(node.url);
        if (witnessHost && nodeHost && witnessHost === nodeHost) return node;
    }
    return null;
};

// Was a hand-rolled English ladder ("3m ago", "2h ago"). utils/TimeAgo now
// speaks every locale the browser knows, so the only thing worth keeping here
// is the sentinel for a witness that has never produced a block.
const formatTimeAgo = (iso) => {
    if (!iso || String(iso).startsWith('1970')) return '—';
    return timeAgo.format(iso, { labels: 'short' }) || '—';
};

// ──────────────────────────────────────────────────────────────
// Row view-model
//
// Everything about a witness row that only changes when the witness list
// itself is re-read (once a minute) is computed once per list, here — the
// URL parsing for the API badge, the feed ratio, the chain props, the
// number formatting. The per-block parts — who is producing, how old the
// last block is, the vote weight in PXP — are derived in render from the
// live state and handed to the row as plain strings, so a row re-renders
// only when something it actually shows has changed.
// ──────────────────────────────────────────────────────────────
const buildRowStatics = (w) => {
    const apiNode = findApiNodeForWitness(w);
    const feed = getWitnessPriceFeed(w);
    const chainProps = getWitnessChainProps(w);
    const lastBlock = Number(w.last_confirmed_block_num) || 0;
    return {
        name: w.owner,
        url: typeof w.url === 'string' ? w.url : '',
        hasApiNode: !!apiNode,
        apiNodeUrl: (apiNode && typeof apiNode.url === 'string') ? apiNode.url : '',
        version: w.running_version || '—',
        votes: w.votes,
        votesText: formatVotes(w.votes),
        lastBlock,
        lastBlockText: lastBlock ? formatInt(lastBlock) : '—',
        fallbackAgo: w.last_aslot_time || w.created,
        missedText: w.total_missed != null ? String(w.total_missed) : '—',
        feedText: formatPriceFeed(feed),
        feedRaw: formatRawPriceFeed(feed),
        feedUpdated: formatTimeAgo(getWitnessFeedUpdatedAt(w)),
        baseFeeText: chainProps.baseFee ? `${chainProps.baseFee} ${displaySymbol(FEE_SYMBOL)}` : '—',
        maxBlockSizeText: chainProps.maxBlockSize ? formatBytes(chainProps.maxBlockSize) : '',
        maxBlockBytesText: chainProps.maxBlockSize ? formatInt(chainProps.maxBlockSize) : ''
    };
};

// Who signed the head block, and who is in the current round.
const statusFor = (name, round) =>
    (round.currentWitness && name === round.currentWitness) ? 'producing'
        : round.roundSet.has(name) ? 'round'
            : round.shuffled.length > 0 ? 'backup'
                : '';

// Age of the witness's last block from the head block it trails by (one
// slot per block); the record's own timestamps as a fallback.
const lastBlockAgoFor = (row, round) =>
    (round.head > 0 && row.lastBlock > 0 && Number.isFinite(round.chainNowMs))
        ? formatTimeAgo(toChainIso(round.chainNowMs - Math.max(0, round.head - row.lastBlock) * BLOCK_INTERVAL_MS))
        : formatTimeAgo(row.fallbackAgo);

const stopTouchPropagation = (e) => e.stopPropagation();

// ──────────────────────────────────────────────────────────────
// Memoised sections
//
// The dialog re-renders once per block. Everything below takes only stable
// references (classes, bound handlers) and primitives, so a section that
// has nothing new to show is skipped entirely — the 30 MUI checkboxes and
// avatar buttons in particular, which were the bulk of every render.
//
// Each section also receives `epoch` (see render): it moves only when this
// component's own props change, which is how withLanguage reaches us on a
// language switch, so the sections re-translate exactly then and not on
// every block.
// ──────────────────────────────────────────────────────────────

const VoteCheckbox = memo(function VoteCheckbox({ name, voted, canVote, labelId, onToggle }) {
    return (
        <Checkbox
            edge="end"
            checked={voted}
            disabled={!canVote}
            onChange={(_e, checked) => onToggle(name, checked)}
            inputProps={{ 'aria-labelledby': labelId }}
        />
    );
});

const WitnessAvatar = memo(function WitnessAvatar({ classes, url }) {
    return (
        <ButtonBase style={AVATAR_BUTTON_STYLE}>
            <div
                className={`pixelated ${classes.witnessAvatar}`}
                style={{ backgroundImage: cssBackgroundImage(url) }}
            />
        </ButtonBase>
    );
});

const WitnessRow = memo(function WitnessRow(props) {
    const { classes, rank, row, avatarUrl, status, lastBlockAgo, powerText, voted, canVote, onToggleVote } = props;
    const labelId = `witness-vote-${row.name}`;

    return (
        <tr className={status === 'producing' ? classes.rowProducing : undefined}>
            <td className={classes.monoText} style={RANK_STYLE}>
                #{rank}
            </td>
            <td>
                <div className={classes.witnessCell}>
                    <WitnessAvatar classes={classes} url={avatarUrl} />
                    <div className={classes.witnessInfo}>
                        <strong className={classes.witnessName} id={labelId}>
                            @{row.name}
                            {status === 'producing' ? (
                                <span className={`${classes.statusBadge} ${classes.statusProducing}`}>
                                    {t("components.gdvmwitnesses.producing_now")}
                                </span>
                            ) : status === 'round' ? (
                                <span className={classes.statusBadge}>{t("components.gdvmwitnesses.in_this_round")}</span>
                            ) : status === 'backup' ? (
                                <span className={`${classes.statusBadge} ${classes.statusBackup}`}>{t("components.gdvmwitnesses.backup")}</span>
                            ) : null}
                            {row.hasApiNode ? (
                                <span className={classes.apiBadge} title={row.apiNodeUrl}>
                                    {t("words.api_available")}
                                </span>
                            ) : null}
                        </strong>
                        <span className={classes.witnessDescription}>
                            {row.url}
                        </span>
                    </div>
                </div>
            </td>
            <td>
                <div className={classes.versionBadge}>
                    {row.version}
                </div>
            </td>
            <td className={classes.monoText}>
                {row.votesText}
                {powerText ? (
                    <div className={classes.blockTime}>≈ {powerText} PXP</div>
                ) : null}
            </td>
            <td>
                <div className={classes.blockInfo}>
                    #{row.lastBlockText}
                </div>
                <div className={classes.blockTime}>
                    ({lastBlockAgo})
                </div>
            </td>
            <td className={classes.monoText}>
                {row.missedText}
            </td>
            <td className={classes.monoText} title={row.feedRaw}>
                <div className={classes.blockInfo}>
                    {row.feedText}
                </div>
                {row.feedUpdated !== '—' ? (
                    <div className={classes.blockTime}>
                        ({row.feedUpdated})
                    </div>
                ) : null}
            </td>
            <td className={classes.monoText}>
                {row.baseFeeText}
            </td>
            <td className={classes.monoText}>
                {row.maxBlockSizeText ? (
                    <>
                        <div className={classes.blockInfo}>{row.maxBlockSizeText}</div>
                        <div className={classes.blockTime}>({t("components.gdvmwitnesses.bytes", { n: row.maxBlockBytesText })})</div>
                    </>
                ) : '—'}
            </td>
            <td>
                <VoteCheckbox
                    name={row.name}
                    voted={voted}
                    canVote={canVote}
                    labelId={labelId}
                    onToggle={onToggleVote}
                />
            </td>
        </tr>
    );
});

// Placeholder rows matching the 10-column witness table (rank, avatar+name,
// version, votes, block info, misses, feed, creation fee, block size, vote
// checkbox) so the table doesn't resize or jump when real rows arrive.
// Skeleton provides its own theme-aware shimmer.
const SKELETON_ROWS = [0, 1, 2, 3, 4, 5];
const LoadingRows = memo(function LoadingRows({ classes }) {
    return (
        <>
            {SKELETON_ROWS.map((i) => (
                <tr key={`sk-${i}`} aria-busy="true">
                    <td className={classes.monoText}><Skeleton variant="text" width={20} /></td>
                    <td>
                        <div className={classes.witnessCell}>
                            <Skeleton variant="circle" width={32} height={32} style={{ marginRight: 8 }} />
                            <div className={classes.witnessInfo}>
                                <Skeleton variant="text" width={90} height={14} />
                                <Skeleton variant="text" width={140} height={11} />
                            </div>
                        </div>
                    </td>
                    <td><Skeleton variant="rect" width={44} height={16} style={{ borderRadius: 4 }} /></td>
                    <td className={classes.monoText}><Skeleton variant="text" width={70} /></td>
                    <td>
                        <Skeleton variant="text" width={60} height={12} />
                        <Skeleton variant="text" width={40} height={10} />
                    </td>
                    <td className={classes.monoText}><Skeleton variant="text" width={48} /></td>
                    <td className={classes.monoText}><Skeleton variant="text" width={48} /></td>
                    <td className={classes.monoText}><Skeleton variant="text" width={56} /></td>
                    <td className={classes.monoText}><Skeleton variant="text" width={48} /></td>
                    <td><Skeleton variant="rect" width={18} height={18} style={{ borderRadius: 3 }} /></td>
                </tr>
            ))}
        </>
    );
});

const VoteForm = memo(function VoteForm({ classes, value, canAct, onChange, onVote, onDelegate }) {
    const hasTarget = !!value.trim();
    return (
        <>
            <div className={classes.textFieldWrapper}>
                <TextField
                    id="custom-witness"
                    label={t("words.username_2")}
                    variant="outlined"
                    fullWidth
                    value={value}
                    onChange={onChange}
                />
            </div>
            <div className={classes.buttonGroup}>
                <Button
                    variant="outlined"
                    onClick={onVote}
                    disabled={!canAct || !hasTarget}
                >
                    {t("words.vote_for_account")}
                </Button>
                <Button
                    variant="contained"
                    onClick={onDelegate}
                    disabled={!canAct || !hasTarget}
                >
                    {t("words.delegate_my_vote")}
                </Button>
            </div>
        </>
    );
});

// ──────────────────────────────────────────────────────────────
// Witness self-administration panel
// Rendered only when the logged-in account is itself an active witness.
// `account_creation_fee` and `url` are operator-editable; maximum_block_size
// and the interest rate are shown read-only and re-sent unchanged. Broadcast
// as witness_update, signed by the account's active key.
// ──────────────────────────────────────────────────────────────
const WitnessAdminPanel = memo(function WitnessAdminPanel(props) {
    const {
        classes, account, baseFee, maxBlockSize, interestRate, url,
        broadcasting, error, success, onBaseFeeChange, onUrlChange, onBroadcast
    } = props;

    if (!account) return null;

    // `account_creation_fee` and `url` are validated in the handler and
    // the signing key is resolved by the API layer, so the broadcast
    // button only blocks while a broadcast is in flight.
    const feeOutOfRange = baseFee !== "" && !isValidFeeUnits(feeInputToUnits(baseFee));

    return (
        <div className={classes.witnessPanel}>
            <div className={classes.witnessPanelHeader}>
                <Typography className={classes.sectionTitle} style={NO_MARGIN_BOTTOM}>
                    {t("components.gdvmwitnesses.witness_properties")}
                </Typography>
                <span className={classes.witnessBadge}>{t("components.gdvmwitnesses.you_are_a_witness")}</span>
            </div>
            <Typography className={classes.sectionDescription}><T
                k="components.gdvmwitnesses.broadcast_a_new_set_of_chain_parameters"
                vars={{
                    currentAccount: account
                }} /></Typography>
            <TextField
                className={classes.textFieldWrapper}
                label={t("components.gdvmwitnesses.account_creation_fee")}
                variant="outlined"
                fullWidth
                value={baseFee}
                onChange={onBaseFeeChange}
                disabled={broadcasting}
                error={feeOutOfRange}
                InputLabelProps={SHRINK_LABEL}
                InputProps={FEE_INPUT_PROPS}
            />
            <TextField
                className={classes.textFieldWrapper}
                label={t("components.gdvmwitnesses.maximum_block_size_bytes")}
                variant="outlined"
                fullWidth
                disabled
                value={String(maxBlockSize)}
                InputLabelProps={SHRINK_LABEL}
            />
            <TextField
                className={classes.textFieldWrapper}
                label={t("components.gdvmwitnesses.pxs_interest_rate_basis_points_100_1")}
                variant="outlined"
                fullWidth
                disabled
                value={String(interestRate)}
                InputLabelProps={SHRINK_LABEL}
            />
            <TextField
                className={classes.textFieldWrapper}
                label={t("components.gdvmwitnesses.witness_url")}
                placeholder="https://your-witness.example"
                variant="outlined"
                fullWidth
                value={url}
                onChange={onUrlChange}
                disabled={broadcasting}
                InputLabelProps={SHRINK_LABEL}
            />
            {error ? (
                <div className={classes.broadcastError}>{error}</div>
            ) : null}
            {success ? (
                <div className={classes.broadcastSuccess}>
                    {t("components.gdvmwitnesses.properties_broadcast_successfully")}
                </div>
            ) : null}
            <div className={classes.buttonGroup} style={ADMIN_BUTTONS_STYLE}>
                <Button
                    variant="contained"
                    onClick={onBroadcast}
                    disabled={broadcasting}
                >
                    {broadcasting ? (
                        <>
                            <CircularProgress size={16} style={SPINNER_STYLE} />
                            {t("words.broadcasting")}
                        </>
                    ) : t("components.gdvmwitnesses.broadcast_properties")}
                </Button>
            </div>
        </div>
    );
});

// ──────────────────────────────────────────────────────────────
// Witness schedule panel
//
// Always visible: the header and the live line (head block, who signed it,
// who is next, slot in the round, participation, chain time), refreshed
// once per block. Behind the "Details" toggle: the round stats from
// get_witness_schedule (re-read when the round is reshuffled) and the round
// itself in signing order. The details are not mounted while collapsed, so
// the collapsed panel costs one short line per block.
// ──────────────────────────────────────────────────────────────
function ScheduleDetails(props) {
    const { classes, head, shuffled, slotIdx, nextIdx, schedule, dgpMaxBlockSize, medianFeed, witnessCount } = props;

    const nextShuffle = Number(schedule?.next_shuffle_block_num) || 0;
    const blocksToShuffle = nextShuffle > head ? nextShuffle - head : 0;
    const median = (schedule?.median_props && typeof schedule.median_props === 'object')
        ? schedule.median_props
        : null;
    const medianProps = getWitnessChainProps(median ? { props: median } : null);

    const stat = (label, value, sub) => (
        <div className={classes.statItem}>
            <div className={classes.statLabel}>{label}</div>
            <div className={classes.statValue}>{(value === null || value === undefined || value === '') ? '—' : value}</div>
            {sub ? <div className={classes.statSub}>{sub}</div> : null}
        </div>
    );

    return (
        <div className={classes.scheduleDetails}>
            <div className={classes.statsGrid}>
                {stat(
                    t("components.gdvmwitnesses.scheduled"),
                    shuffled.length || Number(schedule?.num_scheduled_witnesses) || null,
                    schedule
                        ? t("components.gdvmwitnesses.elected_timeshare", {
                            elected: Number(schedule.max_voted_witnesses) || 0,
                            timeshare: Number(schedule.max_runner_witnesses) || 0
                        })
                        : null
                )}
                {stat(
                    t("components.gdvmwitnesses.next_shuffle"),
                    nextShuffle ? `#${formatInt(nextShuffle)}` : null,
                    nextShuffle
                        ? (blocksToShuffle === 1
                            ? t("components.gdvmwitnesses.in_1_block", { time: formatSeconds(BLOCK_INTERVAL_S) })
                            : t("components.gdvmwitnesses.in_blocks", {
                                blocks: blocksToShuffle,
                                time: formatSeconds(blocksToShuffle * BLOCK_INTERVAL_S)
                            }))
                        : null
                )}
                {stat(
                    t("components.gdvmwitnesses.majority_version"),
                    schedule?.majority_version || null,
                    (schedule?.hardfork_required_witnesses !== null && schedule?.hardfork_required_witnesses !== undefined)
                        ? t("components.gdvmwitnesses.witnesses_to_hardfork", { n: schedule.hardfork_required_witnesses })
                        : null
                )}
                {stat(
                    t("components.gdvmwitnesses.creation_fee"),
                    medianProps.baseFee ? `${medianProps.baseFee} ${displaySymbol(FEE_SYMBOL)}` : null,
                    t("components.gdvmwitnesses.median_of_the_round")
                )}
                {stat(
                    t("components.gdvmwitnesses.max_block_size"),
                    medianProps.maxBlockSize ? formatBytes(medianProps.maxBlockSize) : null,
                    dgpMaxBlockSize
                        ? t("components.gdvmwitnesses.current", { size: formatBytes(dgpMaxBlockSize) })
                        : t("components.gdvmwitnesses.median_of_the_round")
                )}
                {medianProps.interestRate !== ''
                    ? stat(
                        t("components.gdvmwitnesses.pxs_interest"),
                        `${(Number(medianProps.interestRate) / 100).toFixed(2)}%`,
                        t("components.gdvmwitnesses.median_per_year")
                    )
                    : null}
                {stat(
                    t("components.gdvmwitnesses.median_feed"),
                    medianFeed ? formatPriceFeed(medianFeed) : null,
                    medianFeed ? formatRawPriceFeed(medianFeed) : null
                )}
                {stat(
                    t("components.gdvmwitnesses.registered"),
                    witnessCount !== null ? formatInt(witnessCount) : null,
                    t("components.gdvmwitnesses.witness_accounts")
                )}
            </div>

            {shuffled.length > 0 ? (
                <div className={classes.roundStrip}>
                    {shuffled.map((name, i) => {
                        const cls = `${classes.roundChip}${
                            i === slotIdx ? ` ${classes.roundChipCurrent}` :
                                i === nextIdx ? ` ${classes.roundChipNext}` : ''
                        }`;
                        return (
                            <span key={`${name}-${i}`} className={cls}>
                                {i + 1}. {name}
                            </span>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
}

const SchedulePanel = memo(function SchedulePanel(props) {
    const {
        classes, open, onToggle,
        head, currentWitness, nextWitness, slotIdx, nextIdx, shuffled,
        participation, chainTime, schedule, dgpMaxBlockSize, medianFeed, witnessCount
    } = props;
    const slotCount = shuffled.length;

    return (
        <div className={classes.schedulePanel}>
            <div className={classes.witnessPanelHeader}>
                <Typography className={classes.sectionTitle} style={NO_MARGIN_BOTTOM}>
                    {t("components.gdvmwitnesses.witness_schedule")}
                </Typography>
                {slotCount > 0 ? (
                    <span className={classes.witnessBadge}>
                        {t("components.gdvmwitnesses.slots", { n: slotCount })}
                    </span>
                ) : null}
                <IconButton
                    className={classes.scheduleToggle}
                    onClick={onToggle}
                    aria-expanded={open}
                >
                    <ExpandMoreRounded
                        className={`${classes.scheduleChevron}${open ? ` ${classes.scheduleChevronOpen}` : ''}`}
                        aria-hidden="true"
                    />
                </IconButton>
            </div>
            <Typography className={classes.sectionDescription} style={NO_MARGIN_BOTTOM}>
                {t("components.gdvmwitnesses.one_block_every_seconds_signed_by_the", {
                    seconds: BLOCK_INTERVAL_S,
                    blocks: slotCount || 'N'
                })}
            </Typography>

            <div className={classes.liveLine}>
                <span className={classes.liveDot} />
                <span className={classes.liveItem}>
                    <span className={classes.liveLabel}>{t("components.gdvmwitnesses.block")}</span>
                    <span className={classes.liveValue}>{head ? `#${formatInt(head)}` : '—'}</span>
                </span>
                <span className={classes.liveItem}>
                    <span className={classes.liveLabel}>{t("components.gdvmwitnesses.signed_by")}</span>
                    <span className={classes.liveValue}>{currentWitness ? `@${currentWitness}` : '—'}</span>
                </span>
                <span className={classes.liveItem}>
                    <span className={classes.liveLabel}>{t("components.gdvmwitnesses.next")}</span>
                    <span>{nextWitness ? `@${nextWitness}` : '—'}</span>
                </span>
                {slotCount > 0 && slotIdx >= 0 ? (
                    <span className={classes.liveItem}>
                        <span className={classes.liveLabel}>{t("components.gdvmwitnesses.slot")}</span>
                        <span>{slotIdx + 1} / {slotCount}</span>
                    </span>
                ) : null}
                {participation !== null ? (
                    <span className={classes.liveItem}>
                        <span className={classes.liveLabel}>{t("components.gdvmwitnesses.participation")}</span>
                        <span>{participation.toFixed(1)}%</span>
                    </span>
                ) : null}
                <span className={classes.liveItem}>
                    <span className={classes.liveLabel}>{t("components.gdvmwitnesses.chain_time")}</span>
                    <span>{chainTime}</span>
                </span>
            </div>

            <Collapse in={open} timeout="auto" mountOnEnter unmountOnExit>
                <ScheduleDetails
                    classes={classes}
                    head={head}
                    shuffled={shuffled}
                    slotIdx={slotIdx}
                    nextIdx={nextIdx}
                    schedule={schedule}
                    dgpMaxBlockSize={dgpMaxBlockSize}
                    medianFeed={medianFeed}
                    witnessCount={witnessCount}
                />
            </Collapse>
        </div>
    );
});

class GDVMWitnesses extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            customWitness: "",
            _loading: true,
            _witnesses: [],
            _avatars: {},          // { witnessName: imageUrl }
            _myVotes: new Set(),   // witness owner names the current user has voted for
            _currentAccount: null,
            // ── Live chain state (polled once per block) ──
            _dgp: null,            // raw get_dynamic_global_properties
            _vestPrice: null,      // PXA per VESTS — votes → Pixa Power
            _schedule: null,       // raw get_witness_schedule
            _witnessCount: null,   // get_witness_count
            _medianFeed: null,     // get_current_median_history_price { base, quote }
            _scheduleOpen: scheduleDetailsOpen,   // the schedule panel's "Details" section
            // ── Witness self-administration ──
            _selfWitness: null,    // full witness record for the current account, or null
            // Chain parameters, all seeded from the witness's current on-chain
            // `props` in _loadData. `account_creation_fee` and `url` are
            // operator-editable and broadcast; maximum_block_size and
            // pxs_interest_rate stay read-only in this release and are never
            // sent (see _handleBroadcastWitnessProps).
            _propsBaseFee: "",              // account_creation_fee as typed, e.g. "0.001"
            _propsMaxBlockSize: "",         // maximum_block_size (bytes)
            _propsInterestRate: "",         // pxs_interest_rate (basis points; 100 = 1%)
            _propsUrl: "",                  // url — editable witness URL
            _propsBroadcasting: false,
            _propsError: "",
            _propsSuccess: false
        };
        this._mounted = false;
        this._tableWrapRef = React.createRef();

        // ── Polling ──
        this._timer = null;
        this._polling = false;
        this._lastHead = 0;
        this._lead = POLL_LEAD_START_MS;
        this._missed = 0;

        // ── Loads ──
        this._loadGen = 0;
        this._loadedAccount = undefined;   // account the votes / admin panel were last loaded for
        this._witnessLoad = null;          // in-flight witness list read; further callers share it
        this._witnessReloadWanted = false; // …and ask for one more pass once it lands
        this._rowsRefreshedAt = 0;
        this._scheduleLoading = false;
        this._scheduleTriedAt = 0;
        this._avatarCache = {};            // owner → image url ('' when the profile has none)

        // ── Render caches ──
        this._propsSeen = null;
        this._epoch = 0;
        this._rowStaticsFor = null;
        this._rowStaticsEpoch = -1;
        this._rowStaticsList = [];
    }

    componentDidMount() {
        this._mounted = true;
        this._loadData();
        this._loadSchedule();
        this._loadMedianFeed();
        this._poll();

        // A swipe on the table must not reach the dialog's own gesture
        // handlers, but the browser may start scrolling it at once: passive
        // listeners can still stop propagation, they just can't cancel.
        const wrap = this._tableWrapRef.current;
        if (wrap) {
            wrap.addEventListener("touchstart", stopTouchPropagation, PASSIVE);
            wrap.addEventListener("touchmove", stopTouchPropagation, PASSIVE);
        }
        if (typeof document !== "undefined") {
            document.addEventListener("visibilitychange", this._handleVisibility);
        }
    }

    componentDidUpdate(prevProps) {
        if (prevProps.api !== this.props.api) {
            this._lastHead = 0;
            this._loadData();
            this._loadSchedule();
            this._loadMedianFeed();
            this._poll();
        }
    }

    componentWillUnmount() {
        this._mounted = false;
        this._clearTimer();
        const wrap = this._tableWrapRef.current;
        if (wrap) {
            wrap.removeEventListener("touchstart", stopTouchPropagation, PASSIVE);
            wrap.removeEventListener("touchmove", stopTouchPropagation, PASSIVE);
        }
        if (typeof document !== "undefined") {
            document.removeEventListener("visibilitychange", this._handleVisibility);
        }
    }

    _sessionAccount = () => {
        const { api } = this.props;
        return api?.sessionManager?.getCurrentAccountSync?.() ||
            api?.sessionManager?.currentAccount ||
            null;
    }

    // ── Loads ─────────────────────────────────────────────────────
    //
    // Nothing waits for anything else: the witness rows go up as soon as the
    // list is back (avatars follow in a second read), and the current
    // account's votes and witness record each land on their own. The panel
    // used to wait for all of it before showing a single row.

    _loadData = () => {
        const { api } = this.props;
        if (!api?.witnesses) return;

        const account = this._sessionAccount();
        const accountChanged = this._loadedAccount !== undefined && account !== this._loadedAccount;
        this._loadedAccount = account;
        // A later _loadData supersedes this one: its late results are dropped.
        const gen = ++this._loadGen;
        const fresh = () => this._mounted && gen === this._loadGen;

        // The rows don't depend on who is signed in.
        this._loadWitnesses();

        // Another account took over: clear the old one's votes and panel now
        // rather than showing them until the new reads land. The checkboxes
        // stay disabled until the new votes are known.
        if (accountChanged) {
            this.setState({ _currentAccount: null, _myVotes: new Set(), _selfWitness: null });
        }

        this._loadVotes(api, account).then((myVotes) => {
            if (fresh()) this.setState({ _myVotes: myVotes, _currentAccount: account });
        });

        this._loadSelfWitness(api, account).then((selfWitness) => {
            if (!fresh()) return;
            // Seed the editable URL field from the witness's current on-chain
            // `url` so re-broadcasting "as is" doesn't accidentally blank out a
            // previously-set value. The read-only parameters are seeded from
            // the same record so the panel shows what is actually on chain.
            const chainProps = getWitnessChainProps(selfWitness);
            this.setState({
                _selfWitness: selfWitness,
                _propsBaseFee: chainProps.baseFee,
                _propsMaxBlockSize: chainProps.maxBlockSize,
                _propsInterestRate: chainProps.interestRate,
                _propsUrl: (selfWitness && typeof selfWitness.url === 'string') ? selfWitness.url : ""
            });
        });
    }

    // Current user's witness votes — used to check/uncheck the checkboxes.
    _loadVotes = async (api, account) => {
        const myVotes = new Set();
        if (account && api.witnesses.listWitnessVotes) {
            try {
                const votes = await api.witnesses.listWitnessVotes({
                    start: [account, ''],
                    order: 'by_account_witness',
                    limit: 100
                });
                for (const v of (votes || [])) {
                    if (v?.account === account && v?.witness) myVotes.add(v.witness);
                }
            } catch (e) {
                console.warn('[GDVMWitnesses] list_witness_votes failed:', e?.message);
            }
        }
        return myVotes;
    }

    // Is the current user themselves a witness? The top-30 list might not
    // include them (they could be ranked lower), so query the chain directly.
    // A witness with the disabled/null signing key is treated as
    // not-a-witness for this panel.
    _loadSelfWitness = async (api, account) => {
        if (!account || typeof api.witnesses?.getWitnessByAccount !== 'function') return null;
        try {
            const w = await api.witnesses.getWitnessByAccount(account);
            return (w && isActiveWitness(w)) ? w : null;
        } catch (e) {
            console.warn('[GDVMWitnesses] getWitnessByAccount failed:', e?.message);
            return null;
        }
    }

    // Top witnesses by vote → rows, then their avatars. One read at a time:
    // a caller that arrives while one is in flight shares it and gets one
    // more pass afterwards (a vote just changed the numbers, say).
    _loadWitnesses = () => {
        if (this._witnessLoad) {
            this._witnessReloadWanted = true;
            return this._witnessLoad;
        }
        this._witnessLoad = (async () => {
            try {
                do {
                    this._witnessReloadWanted = false;
                    await this._fetchWitnessesOnce();
                } while (this._mounted && this._witnessReloadWanted);
            } finally {
                this._witnessLoad = null;
            }
        })();
        return this._witnessLoad;
    }

    _fetchWitnessesOnce = async () => {
        const { api } = this.props;
        if (!api?.witnesses) return;
        this._rowsRefreshedAt = Date.now();
        try {
            // condenser_api's get_witnesses_by_vote already returns the
            // ordering we want (descending).
            const raw = await api.witnesses.getWitnessesByVote('', WITNESS_FETCH_LIMIT);
            if (!this._mounted) return;
            const list = Array.isArray(raw) ? raw : [];
            // "Listing only active witnesses" → drop disabled ones, and cap at
            // the max-votable set per the copy here.
            const active = list.filter(isActiveWitness).slice(0, WITNESS_LIST_MAX);

            // The rows go up now, with whatever avatars are already cached…
            this.setState({ _loading: false, _witnesses: active, _avatars: this._avatarsFor(active) });

            // …and the missing avatars follow in one batched account read.
            const missing = active.map(w => w.owner).filter(n => !(n in this._avatarCache));
            if (missing.length === 0 || typeof api.accounts?.getAccounts !== 'function') return;
            try {
                const accs = await api.accounts.getAccounts(missing);
                for (const acc of (accs || [])) {
                    if (acc?.name) this._avatarCache[acc.name] = acc._profile?.profile_image || '';
                }
            } catch (e) {
                console.warn('[GDVMWitnesses] getAccounts for avatars failed:', e?.message);
            }
            for (const n of missing) if (!(n in this._avatarCache)) this._avatarCache[n] = '';
            if (this._mounted) this.setState({ _avatars: this._avatarsFor(active) });
        } catch (e) {
            console.warn('[GDVMWitnesses] failed to load witnesses:', e?.message);
            if (this._mounted) this.setState({ _loading: false });
        }
    }

    _avatarsFor = (active) => {
        const avatars = {};
        for (const w of active) {
            const url = this._avatarCache[w.owner];
            if (url) avatars[w.owner] = url;
        }
        return avatars;
    }

    _loadSchedule = async () => {
        const { api } = this.props;
        if (!api?.witnesses || this._scheduleLoading) return;
        this._scheduleLoading = true;
        this._scheduleTriedAt = Date.now();
        try {
            // WitnessesAPI._fetch answers null on failure, never throws.
            const [schedule, count] = await Promise.all([
                typeof api.witnesses.getWitnessSchedule === 'function' ? api.witnesses.getWitnessSchedule() : null,
                typeof api.witnesses.getWitnessCount === 'function' ? api.witnesses.getWitnessCount() : null,
            ]);
            if (!this._mounted) return;
            const patch = {};
            if (schedule && typeof schedule === 'object') patch._schedule = schedule;
            if (count !== null && count !== undefined && Number.isFinite(Number(count))) patch._witnessCount = Number(count);
            if (Object.keys(patch).length > 0) this.setState(patch);
        } finally {
            this._scheduleLoading = false;
        }
    }

    _loadMedianFeed = async () => {
        const { api } = this.props;
        if (typeof api?.globals?.getCurrentMedianHistoryPrice !== 'function') return;
        try {
            const median = await api.globals.getCurrentMedianHistoryPrice();
            if (!this._mounted) return;
            if (median && typeof median === 'object') this.setState({ _medianFeed: median });
        } catch (e) {
            console.warn('[GDVMWitnesses] median price failed:', e?.message);
        }
    }

    // ── Live chain state ──────────────────────────────────────────

    _applyDgp = (dgp) => {
        const price = vestingSharePrice(dgp);
        this.setState(price ? { _dgp: dgp, _vestPrice: price } : { _dgp: dgp });
    }

    _clearTimer = () => {
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }
    }

    _scheduleNextPoll = (delay) => {
        if (!this._mounted || this._timer) return;
        // No point polling a tab nobody is looking at.
        if (typeof document !== "undefined" && document.hidden) return;
        const ms = Math.min(BLOCK_INTERVAL_MS + POLL_LEAD_MAX_MS, Math.max(POLL_MIN_GAP_MS, Math.round(delay)));
        this._timer = setTimeout(this._poll, ms);
    }

    _handleVisibility = () => {
        if (typeof document === "undefined") return;
        if (document.hidden) this._clearTimer();
        else this._poll();
    }

    // One read of the dynamic global properties, then the next one is timed
    // from the block it saw (see the Live chain state notes above). Calling
    // this directly cancels the pending timer and polls now.
    _poll = async () => {
        this._clearTimer();
        const { api } = this.props;
        if (!this._mounted || this._polling) return;
        if (typeof api?.globals?.getDynamicGlobalProperties !== 'function') return;
        this._polling = true;
        let delay = BLOCK_INTERVAL_MS;
        try {
            const sentAt = Date.now();
            const dgp = await api.globals.getDynamicGlobalProperties();
            if (!this._mounted) return;
            const head = Number(dgp?.head_block_number) || 0;
            if (head > 0 && head !== this._lastHead) {
                // New block. A miss just before it means we asked too early —
                // widen the lead; a clean hit lets it creep back down.
                this._lead = this._missed
                    ? Math.min(POLL_LEAD_MAX_MS, this._lead + POLL_LEAD_STEP_MS)
                    : Math.max(POLL_LEAD_MIN_MS, this._lead - POLL_LEAD_RELAX_MS);
                this._missed = 0;
                this._lastHead = head;
                this._applyDgp(dgp);
                this._afterBlock(head);
                // Ask for the next block just after it is due, by the chain's
                // own clock — unless the local clock is too far off to trust.
                const blockMs = chainMs(dgp.time);
                delay = (Number.isFinite(blockMs) && Math.abs(sentAt - blockMs) <= POLL_MAX_SKEW_MS)
                    ? blockMs + BLOCK_INTERVAL_MS + this._lead - Date.now()
                    : BLOCK_INTERVAL_MS;
            } else {
                // Same head: the block is late or the node lags. Retry once,
                // then wait a full interval so a slow node is not hammered.
                this._missed++;
                delay = this._missed <= POLL_MAX_RETRIES ? POLL_RETRY_MS : BLOCK_INTERVAL_MS;
            }
        } catch (e) {
            console.warn('[GDVMWitnesses] poll failed:', e?.message);
        } finally {
            this._polling = false;
            this._scheduleNextPoll(delay);
        }
    }

    // Everything that hangs off a new block besides the live line. None of
    // it is awaited: each read has its own in-flight guard and lands on its
    // own, so the poll cadence is never held up by a slow node.
    _afterBlock = (head) => {
        // Login / logout / account switch while this tab is open: the
        // checkboxes and the admin panel follow the signing account.
        if (this._sessionAccount() !== this._loadedAccount) this._loadData();

        // New round: re-read the schedule on the block it changes. A missing
        // schedule (node did not answer) is retried on the slow cadence only.
        const now = Date.now();
        const sched = this.state._schedule;
        const nextShuffle = Number(sched?.next_shuffle_block_num) || 0;
        if (sched ? (nextShuffle > 0 && head >= nextShuffle) : (now - this._scheduleTriedAt >= SCHEDULE_RETRY_MS)) {
            this._loadSchedule();
        }

        // Rows, avatars and the median feed on a slow cadence — by the clock,
        // not by counting polls, so a tab hidden for a while refreshes on its
        // first block back.
        if (now - this._rowsRefreshedAt >= ROWS_REFRESH_MS) {
            this._loadWitnesses();
            this._loadMedianFeed();
        }
    }

    // ── Handlers ──────────────────────────────────────────────────

    _handleCustomWitnessChange = (e) => {
        this.setState({ customWitness: e.target.value });
    }

    _handleToggleSchedule = () => {
        this.setState((s) => {
            scheduleDetailsOpen = !s._scheduleOpen;
            return { _scheduleOpen: scheduleDetailsOpen };
        });
    }

    _cleanAccountInput = (raw) =>
        String(raw || '').trim().replace(/^@/, '').toLowerCase();

    _handleToggleVote = async (witnessName, shouldApprove) => {
        const { api } = this.props;
        const { _currentAccount, _myVotes } = this.state;
        if (!api?.broadcast || !_currentAccount) return;

        // Optimistic flip
        const next = new Set(_myVotes);
        if (shouldApprove) next.add(witnessName); else next.delete(witnessName);
        this.setState({ _myVotes: next });

        try {
            await api.broadcast.accountWitnessVote(
                _currentAccount, witnessName, !!shouldApprove
            );
            // hived applies the vote as the block is applied, so the witness's
            // `votes` figure has already moved — re-read the rows.
            if (this._mounted) this._loadWitnesses();
        } catch (e) {
            console.warn('[GDVMWitnesses] vote toggle failed:', e?.message);
            if (!this._mounted) return;
            this.setState({ _myVotes: _myVotes });
        }
    }

    _handleVoteForAccount = async () => {
        const { api } = this.props;
        const { _currentAccount } = this.state;
        const target = this._cleanAccountInput(this.state.customWitness);
        if (!target || !api?.broadcast || !_currentAccount) return;
        try {
            await api.broadcast.accountWitnessVote(_currentAccount, target, true);
            if (!this._mounted) return;
            this.setState({ customWitness: "" });
            this._loadData();
        } catch (e) {
            console.warn('[GDVMWitnesses] vote failed:', e?.message);
        }
    }

    _handleDelegateVote = async () => {
        const { api } = this.props;
        const { _currentAccount } = this.state;
        const target = this._cleanAccountInput(this.state.customWitness);
        if (!target || !api?.broadcast || !_currentAccount) return;
        try {
            await api.broadcast.accountWitnessProxy(_currentAccount, target);
            if (!this._mounted) return;
            this.setState({ customWitness: "" });
        } catch (e) {
            console.warn('[GDVMWitnesses] proxy failed:', e?.message);
        }
    }

    // ──────────────────────────────────────────────────────────────
    // Witness-properties helpers
    // ──────────────────────────────────────────────────────────────

    _handlePropsBaseFeeChange = (e) => {
        const value = e.target.value;
        // NumericFormat also reports prop-driven changes (the seed from
        // chain); ignore those so they don't clear a fresh success/error.
        if (value === this.state._propsBaseFee) return;
        this.setState({
            _propsBaseFee: value,
            _propsError: "",
            _propsSuccess: false
        });
    };

    _handlePropsUrlChange = (e) => {
        this.setState({
            _propsUrl: e.target.value,
            _propsError: "",
            _propsSuccess: false
        });
    };

    _handleBroadcastWitnessProps = async () => {
        const { api } = this.props;
        const { _currentAccount, _selfWitness, _propsBaseFee, _propsUrl } = this.state;

        if (!_currentAccount || !_selfWitness || !api?.broadcast?.witnessUpdate) {
            this.setState({ _propsError: t("components.gdvmwitnesses.missing_account_witness_record_or_broadcast_api") });
            return;
        }

        // Broadcast witness_update, signed by the account's ACTIVE authority
        // (BroadcastAPI.witnessUpdate requests 'active'). witness_set_properties
        // is authorized instead by the block-signing key — which this account's
        // active key is not — so it can't be used from a UI that only has the
        // active key. witness_update is the active-key equivalent.
        //
        // The block-signing key goes in block_signing_key (passed through
        // unchanged — no rotation), NOT as an authorizing key.
        //
        // witness_update is NOT sparse: owner/url/block_signing_key/props/fee
        // are all set every time. So the two read-only parameters
        // (maximum_block_size, interest rate) must be re-sent unchanged — we
        // carry the witness record's current `props` forward verbatim and only
        // override account_creation_fee.
        const signingKey = _selfWitness.signing_key;
        if (!signingKey) {
            this.setState({
                _propsError: t("components.gdvmwitnesses.no_signing_key_on_the_witness_record")
            });
            return;
        }

        // Validate in integer 0.001-PIXA units so float noise can't push a
        // typed "0.001" below the chain floor. This is the guard that stops
        // the "account_creation_fee smaller than minimum" (min 0.001) reject.
        const feeUnits = feeInputToUnits(_propsBaseFee);
        if (!isValidFeeUnits(feeUnits)) {
            this.setState({
                _propsError: t("components.gdvmwitnesses.account_creation_fee_must_be_between_and", {
                    min: feeUnitsToAsset(FEE_MIN_UNITS),
                    max: feeUnitsToAsset(FEE_MAX_UNITS)
                })
            });
            return;
        }

        // The chain rejects an empty url ("URL size must be greater than 0"),
        // so fail fast here instead of round-tripping to the node.
        const url = String(_propsUrl || "").trim();
        if (!url) {
            this.setState({ _propsError: t("components.gdvmwitnesses.witness_url_cannot_be_empty") });
            return;
        }

        // Preserve the record's current chain props (correct field names for
        // this chain, including the interest-rate field) and change only the
        // fee. account_creation_fee goes out as a display-symbol asset string;
        // BroadcastAPI.witnessUpdate translates it to the chain symbol.
        const currentProps = (_selfWitness.props && typeof _selfWitness.props === 'object' && !Array.isArray(_selfWitness.props))
            ? _selfWitness.props
            : {};
        const props = {
            ...currentProps,
            account_creation_fee: feeUnitsToAsset(feeUnits)
        };

        this.setState({
            _propsBroadcasting: true,
            _propsError: "",
            _propsSuccess: false
        });

        try {
            await api.broadcast.witnessUpdate({
                owner: _currentAccount,
                url,
                blockSigningKey: signingKey,
                props,
                fee: feeUnitsToAsset(0)   // "0.000 PIXA" — registration fee, unused for an existing witness
            });
            if (!this._mounted) return;
            this.setState({
                _propsBroadcasting: false,
                _propsSuccess: true
            });
        } catch (e) {
            console.warn('[GDVMWitnesses] witnessUpdate failed:', e?.message);
            if (!this._mounted) return;
            this.setState({
                _propsBroadcasting: false,
                _propsError: e?.message || t("components.gdvmwitnesses.broadcast_failed")
            });
        }
    };

    // ── Render helpers ────────────────────────────────────────────

    // The round, as the chain sees it right now. database::get_scheduled_witness()
    // reads current_shuffled_witnesses[current_aslot % num_scheduled_witnesses];
    // `current_witness` is the authoritative name of who signed the head block,
    // the modulo only places it in the strip.
    _roundState = () => {
        const { _dgp, _schedule } = this.state;
        const head = Number(_dgp?.head_block_number) || 0;
        const currentWitness = typeof _dgp?.current_witness === 'string' ? _dgp.current_witness : '';
        const chainNowMs = chainMs(_dgp?.time);
        const shuffled = Array.isArray(_schedule?.current_shuffled_witnesses)
            ? _schedule.current_shuffled_witnesses.filter(n => typeof n === 'string' && n)
            : [];
        let slotIdx = shuffled.length ? (Number(_dgp?.current_aslot) || 0) % shuffled.length : -1;
        if (slotIdx >= 0 && shuffled[slotIdx] !== currentWitness) {
            const i = shuffled.indexOf(currentWitness);
            if (i >= 0) slotIdx = i;
        }
        const nextIdx = (shuffled.length && slotIdx >= 0) ? (slotIdx + 1) % shuffled.length : -1;
        return {
            head,
            currentWitness,
            chainNowMs,
            shuffled,
            roundSet: new Set(shuffled),
            slotIdx,
            nextIdx,
            nextWitness: nextIdx >= 0 ? shuffled[nextIdx] : ''
        };
    }

    // The per-list row view-models, rebuilt only when the list (or the
    // language) changes — see buildRowStatics.
    _rowStatics = (witnesses, epoch) => {
        if (witnesses !== this._rowStaticsFor || epoch !== this._rowStaticsEpoch) {
            this._rowStaticsFor = witnesses;
            this._rowStaticsEpoch = epoch;
            this._rowStaticsList = witnesses.map(buildRowStatics);
        }
        return this._rowStaticsList;
    }

    render() {
        const { classes } = this.props;
        const {
            _loading, _witnesses, _avatars, _myVotes, _currentAccount, _vestPrice,
            _dgp, _schedule, _witnessCount, _medianFeed, _scheduleOpen, _selfWitness,
            customWitness
        } = this.state;

        // Our props object only changes when something outside re-renders us
        // (withLanguage on a language switch; withStyles on a theme change),
        // never on our own setState. The memoised sections get this counter
        // as a prop so they re-render exactly then and re-translate.
        if (this.props !== this._propsSeen) {
            this._propsSeen = this.props;
            this._epoch++;
        }
        const epoch = this._epoch;

        const canAct = !!_currentAccount;
        const round = this._roundState();
        const rows = this._rowStatics(_witnesses, epoch);

        const participation = (_dgp && Number.isFinite(Number(_dgp.participation_count)))
            ? Number(_dgp.participation_count) / 128 * 100
            : null;
        const chainTime = Number.isFinite(round.chainNowMs) ? new Date(round.chainNowMs).toLocaleTimeString() : '—';

        return (
            <DialogContent className={classes.dialogContent}>
                <Typography className={classes.sectionTitle}>
                    {t("components.gdvmwitnesses.vote_for_witnesses")}
                </Typography>
                <Typography className={classes.sectionDescription}>
                    {t("words.you_can_delegate_your_vote_if_you")}
                </Typography>
                <VoteForm
                    classes={classes}
                    epoch={epoch}
                    value={customWitness}
                    canAct={canAct}
                    onChange={this._handleCustomWitnessChange}
                    onVote={this._handleVoteForAccount}
                    onDelegate={this._handleDelegateVote}
                />
                <WitnessAdminPanel
                    classes={classes}
                    epoch={epoch}
                    account={_selfWitness ? _currentAccount : null}
                    baseFee={this.state._propsBaseFee}
                    maxBlockSize={this.state._propsMaxBlockSize}
                    interestRate={this.state._propsInterestRate}
                    url={this.state._propsUrl}
                    broadcasting={this.state._propsBroadcasting}
                    error={this.state._propsError}
                    success={this.state._propsSuccess}
                    onBaseFeeChange={this._handlePropsBaseFeeChange}
                    onUrlChange={this._handlePropsUrlChange}
                    onBroadcast={this._handleBroadcastWitnessProps}
                />
                <Typography className={classes.sectionTitle}>
                    {t("words.top_witnesses")}
                </Typography>
                <Typography className={classes.sectionDescription}>
                    {t("components.gdvmwitnesses.you_can_vote_for_up_to_30")}
                </Typography>
                <SchedulePanel
                    classes={classes}
                    epoch={epoch}
                    open={_scheduleOpen}
                    onToggle={this._handleToggleSchedule}
                    head={round.head}
                    currentWitness={round.currentWitness}
                    nextWitness={round.nextWitness}
                    slotIdx={round.slotIdx}
                    nextIdx={round.nextIdx}
                    shuffled={round.shuffled}
                    participation={participation}
                    chainTime={chainTime}
                    schedule={_schedule}
                    dgpMaxBlockSize={_dgp?.maximum_block_size}
                    medianFeed={_medianFeed}
                    witnessCount={_witnessCount}
                />
                <div className={classes.witnessTableWrapper} ref={this._tableWrapRef}>
                    <table className={classes.witnessTable}>
                        <thead>
                        <tr>
                            <th>{t("words.rank")}</th>
                            <th>{t("words.witness")}</th>
                            <th>{t("words.version")}</th>
                            <th>{t("words.votes")}</th>
                            <th>{t("words.last_block")}</th>
                            <th>{t("words.miss")}</th>
                            <th>{t("words.price_feed")}</th>
                            <th>{t("components.gdvmwitnesses.creation_fee")}</th>
                            <th>{t("components.gdvmwitnesses.max_block_size")}</th>
                            <th>{t("words.voted")}</th>
                        </tr>
                        </thead>
                        <tbody>
                        {_loading ? (
                            <LoadingRows classes={classes} />
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={10} className={classes.emptyRow}>
                                    {t("components.gdvmwitnesses.no_active_witnesses_found")}
                                </td>
                            </tr>
                        ) : (
                            rows.map((row, i) => {
                                const power = sharesToPower(row.votes, _vestPrice);
                                return (
                                    <WitnessRow
                                        key={row.name}
                                        classes={classes}
                                        epoch={epoch}
                                        rank={i + 1}
                                        row={row}
                                        avatarUrl={_avatars[row.name] || ''}
                                        status={statusFor(row.name, round)}
                                        lastBlockAgo={lastBlockAgoFor(row, round)}
                                        powerText={power === null ? '' : formatPower(power)}
                                        voted={_myVotes.has(row.name)}
                                        canVote={canAct}
                                        onToggleVote={this._handleToggleVote}
                                    />
                                );
                            })
                        )}
                        </tbody>
                    </table>
                </div>
            </DialogContent>
        );
    }
}

export default withLanguage(withStyles(styles)(GDVMWitnesses));