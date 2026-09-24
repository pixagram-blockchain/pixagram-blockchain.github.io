import * as React from "preact/compat";

import withStyles from "@material-ui/core/styles/withStyles";
import DialogContent from "@material-ui/core/DialogContent";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import Tooltip from "@material-ui/core/Tooltip";
import ButtonBase from "@material-ui/core/ButtonBase";
import InfoIcon from "@material-ui/icons/Info";
import DescriptionIcon from "@material-ui/icons/Description";
import { HISTORY } from "../utils/constants";
import { cssBackgroundImage } from "../utils/safeUrl";
// The TGE ledger — plain JSON so entries can be added by hand. Its `_readme`
// key documents the schema; everything on this tab is recomputed from it, and
// the on-chain balances are read live only to reconcile against it.
import TOKENOMICS from "../data/tokenomics.json";

import { t } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";

const styles = theme => ({
    dialogContent: {
        padding: "24px"
    },
    tooltip: {
        margin: "8px",
        display: "block",
        fontSize: "14px",
        fontFamily: "'Normative Pro'",
        lineHeight: "22px"
    },
    // ── Panels — the same surface as the DAO treasury box in GDVMProposals ─
    panel: {
        backgroundColor: "#101010",
        borderRadius: "16px",
        padding: "24px",
        margin: "0px 0px 24px 0px",
        transition: "background-color 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms",
        "&:hover": {
            backgroundColor: "#171717",
            transition: "background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        },
        [theme.breakpoints.down("sm")]: {
            padding: "20px 16px"
        }
    },
    panelHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "8px 16px",
        marginBottom: "16px",
        fontFamily: "'Industry Book'"
    },
    panelTitle: {
        fontSize: "32px",
        fontWeight: 600,
        color: "#e0e0e0",
        display: "flex",
        alignItems: "center",
        gap: "8px"
    },
    panelSubtitle: {
        fontSize: "12px",
        color: "#777",
        fontFamily: "'Geist Mono', monospace"
    },
    infoIcon: {
        fontSize: "18px",
        color: "#888",
        cursor: "pointer",
        transition: "color 150ms ease",
        "&:hover": {
            color: "#aaa"
        }
    },
    // ── Stat grid ────────────────────────────────────────────
    statsGrid: {
        display: "flex",
        flexWrap: "wrap",
        gap: "16px 24px",
        margin: "0px 0px 20px 0px",
        [theme.breakpoints.down("sm")]: {
            gap: "16px"
        }
    },
    statItem: {
        flex: "1 1 auto",
        minWidth: "120px",
        [theme.breakpoints.down("sm")]: {
            minWidth: "calc(50% - 8px)"
        }
    },
    statLabel: {
        fontSize: "12px",
        fontWeight: 500,
        color: "#888",
        textTransform: "uppercase",
        fontFamily: "'Industry Book'",
        letterSpacing: "0.5px",
        marginBottom: "4px"
    },
    statValue: {
        fontSize: "21px",
        fontWeight: 500,
        color: "#ffffff",
        fontFamily: "'Geist Mono', monospace",
        whiteSpace: "nowrap"
    },
    statSub: {
        fontSize: "11px",
        color: "#6e6e6e",
        fontFamily: "'Geist Mono', monospace",
        marginTop: "2px"
    },
    notice: {
        fontSize: "12px",
        lineHeight: 1.5,
        color: "#8a8a8a",
        fontFamily: "'Normative Pro'",
        padding: "8px 12px",
        borderRadius: "8px",
        backgroundColor: "#0b0b0b",
        border: "1px solid #ffffff12",
        margin: "0px 0px 16px 0px"
    },
    // ── Bars & legends: SVG bars clipped by a rounded HTML track ───
    barTrack: {
        width: "100%",
        borderRadius: "8px",
        overflow: "hidden",
        backgroundColor: "#1e1e1e",
        lineHeight: 0,
        "& svg": {
            display: "block"
        }
    },
    legend: {
        display: "flex",
        flexWrap: "wrap",
        gap: "6px 18px",
        marginTop: "10px"
    },
    legendItem: {
        display: "inline-flex",
        alignItems: "center",
        gap: "7px",
        fontSize: "12px",
        fontFamily: "'Industry Book'",
        color: "#aaa"
    },
    legendSwatch: {
        width: 10,
        height: 10,
        borderRadius: "3px",
        border: "1px solid #2e2e2e",
        flexShrink: 0
    },
    legendValue: {
        color: "#6e6e6e",
        fontFamily: "'Geist Mono', monospace",
        fontSize: "11px"
    },
    // ── Explainer ────────────────────────────────────────────
    explainerGrid: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "20px 32px",
        [theme.breakpoints.down("sm")]: {
            gridTemplateColumns: "1fr"
        }
    },
    explainerHeading: {
        fontSize: "15px",
        fontWeight: 600,
        color: "#e0e0e0",
        fontFamily: "'Industry Book'",
        marginBottom: "6px"
    },
    explainerText: {
        fontSize: "14px",
        lineHeight: 1.6,
        color: "#999",
        fontFamily: "'Normative Pro'"
    },
    // ── Account card ─────────────────────────────────────────
    accountHeader: {
        display: "flex",
        alignItems: "flex-start",
        gap: "16px",
        marginBottom: "20px",
        [theme.breakpoints.down("sm")]: {
            gap: "12px"
        }
    },
    accountAvatar: {
        width: 48,
        height: 48,
        borderRadius: "12px",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: "#1c1c1c"
    },
    accountInfo: {
        flex: "1 1 auto",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: "8px"
    },
    accountTitleRow: {
        display: "flex",
        alignItems: "baseline",
        flexWrap: "wrap",
        gap: "4px 10px"
    },
    accountName: {
        fontSize: "18px",
        fontWeight: 600,
        color: "#ffffff",
        fontFamily: "'Industry Book'",
        cursor: "pointer",
        "&:hover": {
            textDecoration: "underline"
        }
    },
    accountRole: {
        fontSize: "13px",
        color: "#888",
        fontFamily: "'Industry Book'"
    },
    chipRow: {
        display: "flex",
        flexWrap: "wrap",
        gap: "6px"
    },
    chip: {
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "8px",
        backgroundColor: "#262626",
        color: "#bbb",
        fontSize: "10px",
        lineHeight: "16px",
        fontFamily: "'Geist Mono', monospace",
        fontWeight: "bold",
        letterSpacing: "0.5px",
        whiteSpace: "nowrap",
        cursor: "default"
    },
    chipStrong: {
        backgroundColor: "#ffffff",
        color: "#000000"
    },
    chipMuted: {
        backgroundColor: "#1a1a1a",
        color: "#777"
    },
    section: {
        marginTop: "20px"
    },
    sectionHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "8px",
        marginBottom: "10px"
    },
    sectionLabel: {
        fontSize: "11px",
        fontWeight: 600,
        color: "#666",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        fontFamily: "'Industry Book'"
    },
    // ── Recipients ───────────────────────────────────────────
    recipientRow: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "5px 0px"
    },
    recipientWho: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        width: "150px",
        flexShrink: 0,
        minWidth: 0,
        [theme.breakpoints.down("sm")]: {
            width: "110px"
        }
    },
    recipientAvatar: {
        width: 20,
        height: 20,
        borderRadius: "6px",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: "#1c1c1c",
        flexShrink: 0
    },
    recipientName: {
        fontSize: "13px",
        color: "#ddd",
        fontFamily: "'Industry Book'",
        cursor: "pointer",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        "&:hover": {
            textDecoration: "underline"
        }
    },
    recipientBar: {
        flex: "1 1 auto",
        minWidth: 0
    },
    recipientAmount: {
        width: "170px",
        flexShrink: 0,
        textAlign: "right",
        fontSize: "12px",
        color: "#ddd",
        fontFamily: "'Geist Mono', monospace",
        whiteSpace: "nowrap",
        [theme.breakpoints.down("sm")]: {
            width: "auto"
        }
    },
    recipientPct: {
        color: "#6e6e6e",
        marginLeft: "6px"
    },
    // ── Ledger table ─────────────────────────────────────────
    tableWrapper: {
        overflowX: "auto",
        touchAction: "manipulation",
        "-webkit-overflow-scrolling": "touch",
        borderRadius: "12px"
    },
    table: {
        width: "100%",
        minWidth: "640px",
        borderCollapse: "collapse",
        fontSize: "0.875rem",
        "& th": {
            backgroundColor: "#191919",
            padding: "10px 12px",
            textAlign: "left",
            fontWeight: 600,
            whiteSpace: "nowrap",
            fontSize: "11px",
            color: "#888",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            fontFamily: "'Industry Book'"
        },
        "& td": {
            padding: "8px 12px",
            borderBottom: "1px solid #ffffff12",
            verticalAlign: "middle",
            color: "#ccc",
            transition: "background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 5ms"
        },
        "& tbody": {
            backgroundColor: "#0c0c0c"
        },
        "& tbody tr:hover > td": {
            backgroundColor: "#151515"
        },
        "& tbody tr:last-child > td": {
            borderBottom: "0px"
        }
    },
    cellRight: {
        textAlign: "right"
    },
    cellMono: {
        fontFamily: "'Geist Mono', monospace",
        whiteSpace: "nowrap"
    },
    cellNote: {
        fontFamily: "'Normative Pro'",
        fontSize: "13px",
        color: "#888",
        minWidth: "180px"
    },
    cellWho: {
        display: "flex",
        alignItems: "center",
        gap: "8px"
    },
    subRow: {
        "& > td": {
            color: "#888",
            fontSize: "12px",
            paddingTop: "4px",
            paddingBottom: "6px",
            backgroundColor: "#0a0a0a"
        }
    },
    subRowText: {
        fontFamily: "'Normative Pro'",
        fontSize: "12px",
        color: "#8a8a8a"
    },
    // ── Roadmap chart: SVG geometry, HTML labels and marker ──
    roadmap: {
        display: "grid",
        gridTemplateColumns: "40px 1fr",
        gridTemplateRows: "220px 18px",
        columnGap: "8px",
        rowGap: "6px",
        marginTop: "8px"
    },
    roadmapY: {
        position: "relative",
        fontFamily: "'Geist Mono', monospace",
        fontSize: "10px",
        color: "#666",
        "& span": {
            position: "absolute",
            right: 0,
            transform: "translateY(-50%)"
        }
    },
    roadmapPlot: {
        position: "relative",
        borderRadius: "10px",
        overflow: "hidden",
        backgroundColor: "#0b0b0b",
        border: "1px solid #1c1c1c",
        "& svg": {
            display: "block",
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%"
        }
    },
    roadmapX: {
        gridColumn: 2,
        position: "relative",
        fontFamily: "'Geist Mono', monospace",
        fontSize: "10px",
        color: "#666",
        "& span": {
            position: "absolute",
            whiteSpace: "nowrap"
        }
    },
    roadmapTodayLine: {
        position: "absolute",
        top: 0,
        bottom: 0,
        width: "1px",
        backgroundColor: "#3a3a3a",
        pointerEvents: "none"
    },
    roadmapDot: {
        position: "absolute",
        width: 10,
        height: 10,
        borderRadius: "50%",
        backgroundColor: "#ffffff",
        boxShadow: "0 0 0 3px rgba(255,255,255,0.16)",
        transform: "translate(-50%, -50%)"
    },
    roadmapDotLabel: {
        position: "absolute",
        transform: "translate(10px, -50%)",
        fontSize: "10px",
        fontFamily: "'Geist Mono', monospace",
        color: "#ffffff",
        whiteSpace: "nowrap",
        pointerEvents: "none"
    },
    openProposalsButton: {
        color: "#888",
        fontSize: "12px",
        textTransform: "none",
        "&:hover": {
            color: "#fbfbfb",
            backgroundColor: "transparent"
        }
    }
});

// ──────────────────────────────────────────────────────────────
// Chain helpers — the same entity shapes GDVMProposals and
// GDVMWitnesses read (sanitized accounts, dynamic global properties).
// ──────────────────────────────────────────────────────────────

// Chain symbol → the symbol the app writes (PIXA is shown as PXA everywhere).
const DISPLAY_SYMBOL = { PIXA: 'PXA', PXS: 'PXS', VESTS: 'PXP', PXP: 'PXP' };
const displaySymbol = (sym) => DISPLAY_SYMBOL[sym] || sym || '';

// Amount of a legacy asset string ("245554.228 PXS" → 245554.228), of an NAI
// object ({ amount: "245554228", precision: 3 }) or of a ledger figure
// ({ amount: 25000000, asset: "PIXA" }); 0 when missing or malformed.
const assetAmount = (asset) => {
    if (asset && typeof asset === 'object') {
        const n = Number(asset.amount);
        const p = Number(asset.precision) || 0;
        return Number.isFinite(n) ? n / Math.pow(10, p) : 0;
    }
    const n = parseFloat(String(asset == null ? '' : asset).split(' ')[0]);
    return Number.isFinite(n) ? n : 0;
};

// Chain timestamps are naive UTC ("2026-09-23T12:00:00"); NaN when absent.
const chainMs = (s) => (s ? Date.parse(String(s).replace(/Z?$/, 'Z')) : NaN);

// Ledger dates are "YYYY-MM-DD" (read as UTC midnight) or a full timestamp.
const dateMs = (s) => {
    if (!s) return NaN;
    const str = String(s);
    return str.length <= 10 ? Date.parse(`${str}T00:00:00Z`) : chainMs(str);
};

const MS_PER_YEAR = 365.25 * 86400000;

// Vesting share price: total_vesting_fund_<coin> / total_vesting_shares, the
// fund key found by prefix so the fork's coin name does not matter.
const vestingSharePrice = (dgp) => {
    if (!dgp || typeof dgp !== 'object') return null;
    const fundKey = Object.keys(dgp).find(k => k.startsWith('total_vesting_fund_'));
    const fund = fundKey ? assetAmount(dgp[fundKey]) : 0;
    const shares = assetAmount(dgp.total_vesting_shares);
    return (fund > 0 && shares > 0) ? fund / shares : null;
};

// VESTS → Pixa Power; null without a price (globals read failed).
const vestsToPower = (vests, price) =>
    (Number.isFinite(price) && price > 0) ? (Number(vests) || 0) * price : null;

// Share units (1e6 per VESTS — how to_withdraw / withdrawn are kept) → PXP.
const sharesToPower = (shares, price) => vestsToPower((Number(shares) || 0) / 1e6, price);

// dgp.current_supply is the liquid coin. The stable coin's supply key is
// `current_<coin>_supply` (current_hbd_supply on Hive) — found by shape.
const readSupply = (dgp) => {
    if (!dgp || typeof dgp !== 'object') return null;
    const pxsKey = Object.keys(dgp).find(k => /^current_[a-z]+_supply$/.test(k));
    return {
        PIXA: assetAmount(dgp.current_supply),
        PXS: pxsKey ? assetAmount(dgp[pxsKey]) : 0
    };
};

// Live figures of one sanitized account entity, keyed by chain symbol. The
// power-down block follows Hive's account fields (to_withdraw / withdrawn in
// share units, vesting_withdraw_rate per week); it is null when the entity
// does not carry them or no power-down is running.
const readLive = (acc, price) => {
    const toWithdraw = Number(acc.to_withdraw) || 0;
    const withdrawn = Number(acc.withdrawn) || 0;
    const rate = assetAmount(acc.vesting_withdraw_rate);
    const powerDown = (toWithdraw > withdrawn && rate > 0) ? {
        total: sharesToPower(toWithdraw, price),
        withdrawn: sharesToPower(withdrawn, price),
        perWeek: vestsToPower(rate, price),
        nextMs: chainMs(acc.next_vesting_withdrawal)
    } : null;
    return {
        PXP: vestsToPower(assetAmount(acc.vesting_shares), price),
        PXS: assetAmount(acc.pxs_balance),
        PIXA: assetAmount(acc.pixa_balance != null ? acc.pixa_balance : acc.balance),
        powerDown
    };
};

// ──────────────────────────────────────────────────────────────
// Formatting
// ──────────────────────────────────────────────────────────────
// "25.00M" / "245.0K" / "812". A figure that rounds up to the next unit
// ("1000.0K") is promoted to it ("1.00M").
const fmtCompact = (n) => {
    const v = Number(n) || 0;
    const a = Math.abs(v);
    const at = (div, suffix, digits) => `${(v / div).toFixed(digits)}${suffix}`;
    if (a >= 1e9) return at(1e9, 'B', 2);
    if (a >= 1e6) {
        const s = at(1e6, 'M', 2);
        return /^-?1000\.00M$/.test(s) ? at(1e9, 'B', 2) : s;
    }
    if (a >= 1e3) {
        const s = at(1e3, 'K', 1);
        return /^-?1000\.0K$/.test(s) ? at(1e6, 'M', 2) : s;
    }
    const r = Math.round(v);
    return Math.abs(r) >= 1000 ? at(1e3, 'K', 1) : String(r);
};
// Chain precision, as the wallet prints it: "8,000,000.030".
const fmtExact = (n, digits = 3) =>
    (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const fmtPct = (n) => `${(Number(n) || 0).toFixed(1)}%`;
// "0.06 y" — the unit comes from the locale, like the roadmap's axis labels.
const fmtYears = (n) => t("components.gdvmtokenomics.n_y", { n: (Number(n) || 0).toFixed(2) });
const fmtDate = (ms) => Number.isFinite(ms)
    ? new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';
const fmtMonthYear = (ms) => Number.isFinite(ms)
    ? new Date(ms).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '—';

// ──────────────────────────────────────────────────────────────
// Ledger model — pure functions over tokenomics.json.
//
// Genesis figures are in PIXA and outflows in PXP: the treasuries powered
// their allocation up before paying anything, and one PIXA became one PXP
// at that moment, so the two are added as one unit here. The on-chain PXP
// balance drifts upward from there (the vesting fund receives a share of
// inflation), which is why "on-chain now" is shown next to, not instead
// of, the ledger's remaining figure.
// ──────────────────────────────────────────────────────────────
const CATEGORY_ORDER = ['contributor_reward', 'sale', 'market_distribution', 'grant', 'other'];
// Greyscale only, from bright to dim; the bar track itself is "remaining".
const CATEGORY_SHADES = ['#f2f2f2', '#b4b4b4', '#7c7c7c', '#585858', '#3c3c3c'];
const ALLOCATION_SHADES = ['#f2f2f2', '#7c7c7c', '#4a4a4a', '#333333'];
const REMAINING_SHADE = '#1e1e1e';
const shadeFor = (i) => CATEGORY_SHADES[Math.min(i, CATEGORY_SHADES.length - 1)];

const categoryLabel = (cat) => {
    const c = String(cat || 'other');
    if (CATEGORY_ORDER.includes(c)) return t(`components.gdvmtokenomics.category_${c}`);
    // An unknown category is shown as typed, humanised.
    return c.replace(/_/g, ' ').replace(/^\w/, ch => ch.toUpperCase());
};

const isDone = (e) => !e.status || e.status === 'done';

const summarizeAccount = (account, ledger) => {
    const genesis = assetAmount(account.genesis);
    const entries = ledger.filter(e => e && e.from === account.name);
    let distributed = 0;
    const byCategory = new Map();
    const byRecipient = new Map();
    for (const e of entries) {
        if (!isDone(e)) continue;
        const v = Number(e.amount) || 0;
        distributed += v;
        const c = e.category || 'other';
        byCategory.set(c, (byCategory.get(c) || 0) + v);
        if (e.to) byRecipient.set(e.to, (byRecipient.get(e.to) || 0) + v);
    }
    const rank = (c) => { const i = CATEGORY_ORDER.indexOf(c); return i < 0 ? CATEGORY_ORDER.length : i; };
    const categories = [...byCategory.entries()]
        .sort((a, b) => rank(a[0]) - rank(b[0]))
        .map(([key, value], i) => ({ key, value, fill: shadeFor(i) }));
    const recipients = [...byRecipient.entries()].sort((a, b) => b[1] - a[1]);
    // Newest first, like the wallet; undated rows keep their file order at the end.
    const sorted = entries
        .map((e, i) => ({ e, i, ms: dateMs(e.date) }))
        .sort((a, b) => {
            const am = Number.isFinite(a.ms) ? a.ms : -Infinity;
            const bm = Number.isFinite(b.ms) ? b.ms : -Infinity;
            return bm - am || a.i - b.i;
        })
        .map(x => x.e);
    return {
        genesis,
        genesisAsset: (account.genesis && account.genesis.asset) || 'PIXA',
        distributed,
        remaining: Math.max(0, genesis - distributed),
        pct: genesis > 0 ? distributed / genesis * 100 : 0,
        categories,
        recipients,
        entries: sorted
    };
};

// The timed-distribution policy as a chart-ready roadmap: the corridor
// between the fastest allowed linear pace (everything out by min_years) and
// the slowest (by max_years), the cumulative outflows as dated steps, and
// where today sits against both. Null for any other policy.
const buildRoadmap = (account, summary, tgeMs, nowMs) => {
    const p = account.policy || {};
    if (p.kind !== 'timed_distribution') return null;
    const minYears = Math.max(0, Number(p.min_years) || 0);
    const maxYears = Math.max(minYears, Number(p.max_years) || 0);
    if (!(maxYears > 0)) return null;
    const hasTge = Number.isFinite(tgeMs);
    const yearsAt = (ms) => hasTge ? Math.max(0, (ms - tgeMs) / MS_PER_YEAR) : 0;
    const elapsedYears = yearsAt(nowMs);
    const genesis = summary.genesis;

    const dated = summary.entries
        .filter(e => isDone(e) && Number.isFinite(dateMs(e.date)))
        .sort((a, b) => dateMs(a.date) - dateMs(b.date));
    let cum = 0;
    const steps = dated.map((e) => {
        cum += Number(e.amount) || 0;
        return { years: yearsAt(dateMs(e.date)), pct: genesis > 0 ? cum / genesis * 100 : 0 };
    });

    const clamp = (v) => Math.min(100, Math.max(0, v));
    const fastPct = minYears > 0 ? clamp(elapsedYears / minYears * 100) : 100;
    const slowPct = clamp(elapsedYears / maxYears * 100);
    const actualPct = summary.pct;
    const pace = actualPct > fastPct + 0.05 ? 'ahead'
        : actualPct < slowPct - 0.05 ? 'behind'
            : 'within';

    return {
        minYears,
        maxYears,
        hasTge,
        elapsedYears,
        steps,
        actualPct,
        pace,
        windowFromMs: hasTge ? tgeMs + minYears * MS_PER_YEAR : NaN,
        windowToMs: hasTge ? tgeMs + maxYears * MS_PER_YEAR : NaN,
        // PXP per year: everything out by max_years (slowest) … by min_years (fastest).
        paceSlowPerYear: genesis / maxYears,
        paceFastPerYear: minYears > 0 ? genesis / minYears : genesis / maxYears
    };
};

const buildModel = (data, nowMs) => {
    const accounts = Array.isArray(data.accounts) ? data.accounts : [];
    const ledger = Array.isArray(data.ledger) ? data.ledger : [];
    let tgeMs = dateMs(data.tge && data.tge.date);
    if (!Number.isFinite(tgeMs)) {
        // No genesis date filed: the earliest dated outflow is the best anchor.
        const ds = ledger.map(e => dateMs(e && e.date)).filter(Number.isFinite);
        tgeMs = ds.length ? Math.min(...ds) : NaN;
    }
    const mintedByAsset = {};
    const rows = accounts.map(a => {
        const summary = summarizeAccount(a, ledger);
        mintedByAsset[summary.genesisAsset] = (mintedByAsset[summary.genesisAsset] || 0) + summary.genesis;
        return { account: a, summary, roadmap: buildRoadmap(a, summary, tgeMs, nowMs) };
    });
    // The PXP treasuries: every account whose genesis was minted in PIXA.
    const pixaRows = rows.filter(r => r.summary.genesisAsset === 'PIXA');
    const minted = mintedByAsset.PIXA || 0;
    const distributed = pixaRows.reduce((s, r) => s + r.summary.distributed, 0);
    return {
        tgeMs,
        rows,
        mintedByAsset,
        minted,
        distributed,
        held: Math.max(0, minted - distributed),
        allocation: pixaRows.map((r, i) => ({
            key: r.account.name,
            value: r.summary.genesis,
            fill: ALLOCATION_SHADES[Math.min(i, ALLOCATION_SHADES.length - 1)],
            name: r.account.name,
            role: r.account.role
        }))
    };
};

// Every account name the tab shows an avatar or a balance for.
const accountNames = (data) => {
    const names = new Set();
    for (const a of (Array.isArray(data.accounts) ? data.accounts : [])) if (a && a.name) names.add(a.name);
    for (const e of (Array.isArray(data.ledger) ? data.ledger : [])) if (e && e.to) names.add(e.to);
    return [...names];
};

// ──────────────────────────────────────────────────────────────
// Labels
// ──────────────────────────────────────────────────────────────
const roleLabel = (account) => {
    switch (account.role) {
        case 'team': return t("components.gdvmtokenomics.team_treasury");
        case 'company': return t("components.gdvmtokenomics.company_treasury");
        case 'dpf': return t("components.gdvmtokenomics.decentralized_pixa_fund");
        default: return account.label || account.role || '';
    }
};

const policyLabel = (policy) => {
    const p = policy || {};
    switch (p.kind) {
        case 'discretionary':
            return t("components.gdvmtokenomics.discretionary");
        case 'timed_distribution':
            return t("components.gdvmtokenomics.year_distribution", { min: p.min_years, max: p.max_years });
        case 'proposals':
            return t("components.gdvmtokenomics.spent_through_proposals_only");
        default:
            return '';
    }
};

const policyHint = (policy) => {
    const p = policy || {};
    switch (p.kind) {
        case 'discretionary':
            return t("components.gdvmtokenomics.the_team_may_use_these_funds_at");
        case 'timed_distribution':
            return t("components.gdvmtokenomics.the_company_treasury_must_be_fully_distributed", { min: p.min_years, max: p.max_years });
        case 'proposals':
            return t("components.gdvmtokenomics.the_dpf_has_no_private_keys_its", { divider: p.daily_budget_divider || 100 });
        default:
            return '';
    }
};

const paceLabel = (pace) =>
    pace === 'ahead' ? t("components.gdvmtokenomics.ahead_of_the_fastest_linear_pace")
        : pace === 'behind' ? t("components.gdvmtokenomics.behind_the_slowest_linear_pace")
            : t("components.gdvmtokenomics.within_the_linear_corridor");

// ──────────────────────────────────────────────────────────────
// Building blocks
// ──────────────────────────────────────────────────────────────
const StatItem = ({ classes, label, value, sub, title }) => (
    <div className={classes.statItem} title={title}>
        <div className={classes.statLabel}>{label}</div>
        <div className={classes.statValue}>{(value === null || value === undefined || value === '') ? '—' : value}</div>
        {sub ? <div className={classes.statSub}>{sub}</div> : null}
    </div>
);

const Chip = ({ classes, tone, title, children }) => (
    <span
        className={`${classes.chip}${tone === 'strong' ? ` ${classes.chipStrong}` : tone === 'muted' ? ` ${classes.chipMuted}` : ''}`}
        title={title}
    >{children}</span>
);

// A horizontal stacked bar. The SVG is stretched to the track (no aspect
// ratio) and holds nothing but rects, so stretching is invisible; the
// rounded HTML track clips the corners. What is not covered by a segment
// is the track colour, which the legends label as "remaining".
const BAR_W = 1000;
const StackedBar = ({ classes, segments, total, height, title }) => {
    const h = height || 14;
    const sum = Math.max(0, Number(total) || 0);
    const drawn = (segments || []).filter(s => (Number(s.value) || 0) > 0);
    let x = 0;
    const rects = drawn.map((s, i) => {
        const w = sum > 0 ? Math.min(BAR_W - x, (Number(s.value) || 0) / sum * BAR_W) : 0;
        const gap = i < drawn.length - 1 ? 2 : 0;
        const rect = <rect key={s.key || i} x={x} y={0} width={Math.max(0, w - gap)} height={h} fill={s.fill} />;
        x += w;
        return rect;
    });
    return (
        <div className={classes.barTrack} style={{ height: h }} title={title} role="img" aria-label={title}>
            <svg viewBox={`0 0 ${BAR_W} ${h}`} width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true">
                {rects}
            </svg>
        </div>
    );
};

const Legend = ({ classes, items }) => (
    <div className={classes.legend}>
        {items.map((it) => (
            <span key={it.key} className={classes.legendItem}>
                <span className={classes.legendSwatch} style={{ backgroundColor: it.fill }} />
                <span>{it.label}</span>
                {(it.value !== null && it.value !== undefined) ? <span className={classes.legendValue}>{it.value}</span> : null}
            </span>
        ))}
    </div>
);

const Avatar = ({ classes, className, url, onClick }) => (
    <ButtonBase style={{ borderRadius: "12px" }} onClick={onClick}>
        <div className={`pixelated ${className}`} style={{ backgroundImage: cssBackgroundImage(url) }} />
    </ButtonBase>
);

const goAccount = (e, who) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (who) HISTORY.push(`/@${who}`);
};

// ──────────────────────────────────────────────────────────────
// TGE summary — what genesis minted, what has left the treasuries since,
// and the split between them.
// ──────────────────────────────────────────────────────────────
const TgeSummary = ({ classes, model, supply }) => {
    const minted = model.minted;
    const mintedPxs = model.mintedByAsset.PXS || 0;
    const supplyPct = (supply && supply.PIXA > 0 && minted > 0) ? minted / supply.PIXA * 100 : null;
    const pxsSupplyPct = (supply && supply.PXS > 0 && mintedPxs > 0) ? mintedPxs / supply.PXS * 100 : null;
    const legend = model.allocation.map((s) => ({
        key: s.key,
        fill: s.fill,
        label: `@${s.name}`,
        value: `${fmtCompact(s.value)} PXA · ${fmtPct(minted > 0 ? s.value / minted * 100 : 0)}`
    }));

    return (
        <div className={classes.panel}>
            <div className={classes.panelHeader}>
                <span className={classes.panelTitle}>
                    {t("components.gdvmtokenomics.tge")}
                    <Tooltip
                        arrow
                        interactive
                        title={
                            <div className={classes.tooltip}>
                                {t("components.gdvmtokenomics.at_genesis_the_chain_minted_a_fixed")}
                            </div>
                        }
                    >
                        <InfoIcon className={classes.infoIcon} />
                    </Tooltip>
                </span>
                <span className={classes.panelSubtitle}>
                    {t("components.gdvmtokenomics.token_generation_event")} · {fmtDate(model.tgeMs)}
                </span>
            </div>
            <div className={classes.statsGrid}>
                <StatItem
                    classes={classes}
                    label={t("components.gdvmtokenomics.minted_pxa")}
                    value={`${fmtCompact(minted)} PXA`}
                    sub={supplyPct !== null
                        ? t("components.gdvmtokenomics.of_current_supply", { pct: fmtPct(supplyPct) })
                        : fmtExact(minted)}
                    title={fmtExact(minted)}
                />
                <StatItem
                    classes={classes}
                    label={t("components.gdvmtokenomics.minted_pxs")}
                    value={`${fmtCompact(mintedPxs)} PXS`}
                    sub={pxsSupplyPct !== null
                        ? t("components.gdvmtokenomics.of_current_supply", { pct: fmtPct(pxsSupplyPct) })
                        : fmtExact(mintedPxs)}
                    title={fmtExact(mintedPxs)}
                />
                <StatItem
                    classes={classes}
                    label={t("components.gdvmtokenomics.left_the_treasuries")}
                    value={`${fmtCompact(model.distributed)} PXP`}
                    sub={t("components.gdvmtokenomics.pct_of_genesis", { pct: fmtPct(minted > 0 ? model.distributed / minted * 100 : 0) })}
                    title={fmtExact(model.distributed)}
                />
                <StatItem
                    classes={classes}
                    label={t("components.gdvmtokenomics.still_held")}
                    value={`${fmtCompact(model.held)} PXP`}
                    sub={t("components.gdvmtokenomics.pct_of_genesis", { pct: fmtPct(minted > 0 ? model.held / minted * 100 : 0) })}
                    title={fmtExact(model.held)}
                />
            </div>
            <StackedBar
                classes={classes}
                segments={model.allocation}
                total={minted}
                height={14}
                title={legend.map(l => `${l.label} ${l.value}`).join(' · ')}
            />
            <Legend classes={classes} items={legend} />
        </div>
    );
};

// ──────────────────────────────────────────────────────────────
// Explainer — the tokenomics in four short blocks. Every figure and
// account name is read from the ledger so the copy cannot drift from it.
// ──────────────────────────────────────────────────────────────
const Explainer = ({ classes, model }) => {
    const byRole = (role) => model.rows.find(r => r.account.role === role);
    const team = byRole('team');
    const company = byRole('company');
    const dpf = byRole('dpf');
    const timed = company && company.account.policy && company.account.policy.kind === 'timed_distribution'
        ? company.account.policy : {};
    const vars = {
        pixa: fmtCompact(model.minted),
        pxs: fmtCompact(model.mintedByAsset.PXS || 0),
        team: team ? `@${team.account.name}` : '',
        teamAmount: team ? fmtCompact(team.summary.genesis) : '',
        company: company ? `@${company.account.name}` : '',
        companyAmount: company ? fmtCompact(company.summary.genesis) : '',
        dpf: dpf ? `@${dpf.account.name}` : '',
        dpfAmount: dpf ? fmtCompact(dpf.summary.genesis) : '',
        min: timed.min_years,
        max: timed.max_years,
        divider: (dpf && dpf.account.policy && dpf.account.policy.daily_budget_divider) || 100
    };
    const block = (headingKey, bodyKey) => (
        <div>
            <div className={classes.explainerHeading}>{t(`components.gdvmtokenomics.${headingKey}`)}</div>
            <div className={classes.explainerText}>{t(`components.gdvmtokenomics.${bodyKey}`, vars)}</div>
        </div>
    );
    return (
        <div className={classes.panel}>
            <div className={classes.explainerGrid}>
                {block("what_the_tge_minted", "at_genesis_the_pixa_chain_minted_pxa")}
                {block("two_special_accounts", "and_are_multi_signature_accounts_restricted_at")}
                {block("two_policies", "is_discretionary_the_team_rewards_contributors")}
                {block("the_decentralized_pixa_fund", "is_the_decentralized_pixa_fund_it_has")}
            </div>
        </div>
    );
};

// ──────────────────────────────────────────────────────────────
// Roadmap chart — the corridor between the fastest and slowest allowed
// linear pace, the completion window, the cumulative outflows as steps
// and today's marker. Geometry is an SVG stretched to the plot (strokes
// don't scale), labels and the marker are HTML so they never distort.
// ──────────────────────────────────────────────────────────────
const RoadmapChart = ({ classes, roadmap }) => {
    const { minYears, maxYears, elapsedYears, steps, actualPct } = roadmap;
    const X = (years) => Math.min(100, Math.max(0, years / maxYears * 100));
    const Y = (pct) => 100 - Math.min(100, Math.max(0, pct));
    const fastX = X(minYears);
    const todayX = X(elapsedYears);

    // Cumulative outflows as a step line: flat until each dated entry, then up.
    const pts = [[0, 100]];
    let lastY = 100;
    for (const s of steps) {
        const x = X(s.years);
        pts.push([x, lastY]);
        lastY = Y(s.pct);
        pts.push([x, lastY]);
    }
    pts.push([todayX, lastY]);
    const stepPoints = pts.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join(' ');

    const yearTicks = [];
    for (let y = 1; y < maxYears; y++) yearTicks.push(y);
    const labelYears = [0, ...[Math.round(maxYears / 3), Math.round(maxYears * 2 / 3)], minYears, maxYears]
        .filter((y, i, arr) => y >= 0 && y <= maxYears && arr.indexOf(y) === i)
        .sort((a, b) => a - b);
    const xLabelStyle = (y) => {
        const left = `${X(y)}%`;
        if (y === 0) return { left, transform: 'none' };
        if (y === maxYears) return { left, transform: 'translateX(-100%)' };
        return { left, transform: 'translateX(-50%)' };
    };

    return (
        <div className={classes.roadmap}>
            <div className={classes.roadmapY}>
                {[100, 75, 50, 25, 0].map(p => (
                    <span key={p} style={{ top: `${100 - p}%` }}>{p}%</span>
                ))}
            </div>
            <div className={classes.roadmapPlot}>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    {/* completion window: between min_years and max_years */}
                    <rect x={fastX} y={0} width={100 - fastX} height={100} fill="rgba(255,255,255,0.035)" />
                    {/* corridor between the two linear paces */}
                    <polygon points={`0,100 ${fastX},0 100,0`} fill="rgba(255,255,255,0.07)" />
                    {[25, 50, 75].map(p => (
                        <line key={`h${p}`} x1={0} x2={100} y1={100 - p} y2={100 - p}
                              stroke="#1f1f1f" stroke-width="1" vector-effect="non-scaling-stroke" />
                    ))}
                    {yearTicks.map(y => (
                        <line key={`v${y}`} x1={X(y)} x2={X(y)} y1={0} y2={100}
                              stroke="#181818" stroke-width="1" vector-effect="non-scaling-stroke" />
                    ))}
                    <line x1={0} y1={100} x2={fastX} y2={0}
                          stroke="#8a8a8a" stroke-width="1" stroke-dasharray="4 4" vector-effect="non-scaling-stroke" />
                    <line x1={0} y1={100} x2={100} y2={0}
                          stroke="#5a5a5a" stroke-width="1" stroke-dasharray="4 4" vector-effect="non-scaling-stroke" />
                    <polyline points={stepPoints} fill="none" stroke="#ffffff" stroke-width="2"
                              stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
                </svg>
                <div className={classes.roadmapTodayLine} style={{ left: `${todayX}%` }} />
                <div
                    className={classes.roadmapDot}
                    style={{ left: `${todayX}%`, top: `${Y(actualPct)}%` }}
                    title={`${t("components.gdvmtokenomics.today")} · ${fmtPct(actualPct)}`}
                />
                <div className={classes.roadmapDotLabel} style={{ left: `${todayX}%`, top: `${Y(actualPct)}%` }}>
                    {fmtPct(actualPct)}
                </div>
            </div>
            <div className={classes.roadmapX}>
                {labelYears.map(y => (
                    <span key={y} style={xLabelStyle(y)}>
                        {y === 0 ? t("components.gdvmtokenomics.tge") : t("components.gdvmtokenomics.n_y", { n: y })}
                    </span>
                ))}
            </div>
        </div>
    );
};

const RoadmapSection = ({ classes, roadmap, summary, tgeMs }) => (
    <div className={classes.section}>
        <div className={classes.sectionHeader}>
            <span className={classes.sectionLabel}>{t("components.gdvmtokenomics.distribution_roadmap")}</span>
            {roadmap.hasTge ? (
                <Chip classes={classes} tone={roadmap.pace === 'within' ? 'strong' : undefined}
                      title={t("components.gdvmtokenomics.the_dashed_lines_are_the_linear_paces")}>
                    {paceLabel(roadmap.pace)}
                </Chip>
            ) : null}
        </div>
        {roadmap.hasTge ? (
            <>
                <div className={classes.statsGrid}>
                    <StatItem
                        classes={classes}
                        label={t("components.gdvmtokenomics.completion_window")}
                        value={`${fmtMonthYear(roadmap.windowFromMs)} – ${fmtMonthYear(roadmap.windowToMs)}`}
                        sub={t("components.gdvmtokenomics.years_after_the_tge", { min: roadmap.minYears, max: roadmap.maxYears })}
                    />
                    <StatItem
                        classes={classes}
                        label={t("components.gdvmtokenomics.target_pace")}
                        value={`${fmtCompact(roadmap.paceSlowPerYear)} – ${fmtCompact(roadmap.paceFastPerYear)} PXP`}
                        sub={t("components.gdvmtokenomics.per_year")}
                    />
                    <StatItem
                        classes={classes}
                        label={t("components.gdvmtokenomics.elapsed")}
                        value={fmtYears(roadmap.elapsedYears)}
                        sub={t("components.gdvmtokenomics.since", { date: fmtDate(tgeMs) })}
                    />
                    <StatItem
                        classes={classes}
                        label={t("components.gdvmtokenomics.distributed")}
                        value={fmtPct(roadmap.actualPct)}
                        sub={`${fmtCompact(summary.distributed)} / ${fmtCompact(summary.genesis)} PXP`}
                    />
                </div>
                <RoadmapChart classes={classes} roadmap={roadmap} />
                <Legend
                    classes={classes}
                    items={[
                        { key: 'actual', fill: '#ffffff', label: t("components.gdvmtokenomics.actual_left_the_treasury") },
                        { key: 'fast', fill: '#8a8a8a', label: t("components.gdvmtokenomics.fastest_pace_y", { years: roadmap.minYears }) },
                        { key: 'slow', fill: '#5a5a5a', label: t("components.gdvmtokenomics.slowest_pace_y", { years: roadmap.maxYears }) },
                        { key: 'window', fill: '#262626', label: t("components.gdvmtokenomics.completion_window") }
                    ]}
                />
            </>
        ) : (
            <div className={classes.notice}>{t("components.gdvmtokenomics.set_tge_date_in_tokenomics_json_to")}</div>
        )}
    </div>
);

// ──────────────────────────────────────────────────────────────
// Ledger table — one row per outflow, earmark rows under the entries that
// carry them, and the recipient's live power-down under `unvest` entries.
// ──────────────────────────────────────────────────────────────
const LedgerTable = ({ classes, entries, avatars, live }) => (
    <div className={classes.tableWrapper}>
        <table className={classes.table}>
            <thead>
            <tr>
                <th>{t("components.gdvmtokenomics.date")}</th>
                <th>{t("components.gdvmtokenomics.recipient")}</th>
                <th>{t("components.gdvmtokenomics.category")}</th>
                <th className={classes.cellRight}>{t("components.gdvmtokenomics.amount")}</th>
                <th>{t("components.gdvmtokenomics.note")}</th>
            </tr>
            </thead>
            <tbody>
            {entries.map((e, i) => {
                const key = `${e.from}-${e.to}-${e.date || ''}-${i}`;
                const rows = [
                    <tr key={key}>
                        <td className={classes.cellMono}>{fmtDate(dateMs(e.date))}</td>
                        <td>
                            <div className={classes.cellWho}>
                                <Avatar
                                    classes={classes}
                                    className={classes.recipientAvatar}
                                    url={avatars[e.to] || ''}
                                    onClick={(ev) => goAccount(ev, e.to)}
                                />
                                <span className={classes.recipientName} onClick={(ev) => goAccount(ev, e.to)}>@{e.to}</span>
                            </div>
                        </td>
                        <td>
                            <Chip classes={classes}>{categoryLabel(e.category)}</Chip>
                            {!isDone(e) ? (
                                <>{' '}<Chip classes={classes} tone="muted">{t("components.gdvmtokenomics.planned")}</Chip></>
                            ) : null}
                        </td>
                        <td className={`${classes.cellMono} ${classes.cellRight}`}>
                            {fmtExact(e.amount)} {displaySymbol(e.asset)}
                        </td>
                        <td className={classes.cellNote}>{e.note || ''}</td>
                    </tr>
                ];
                for (const [j, em] of (Array.isArray(e.earmarks) ? e.earmarks : []).entries()) {
                    rows.push(
                        <tr key={`${key}-em${j}`} className={classes.subRow}>
                            <td />
                            <td colSpan={2}>
                                <span className={classes.subRowText}>↳ {em.to}</span>
                                {em.status ? (
                                    <>{' '}<Chip classes={classes} tone="muted">
                                        {em.status === 'planned' ? t("components.gdvmtokenomics.planned")
                                            : em.status === 'done' ? t("components.gdvmtokenomics.done") : em.status}
                                    </Chip></>
                                ) : null}
                            </td>
                            <td className={`${classes.cellMono} ${classes.cellRight}`}>
                                {fmtExact(em.amount)} {displaySymbol(em.asset)}
                            </td>
                            <td className={classes.cellNote}>{em.note || ''}</td>
                        </tr>
                    );
                }
                const pd = e.unvest && live[e.to] ? live[e.to].powerDown : null;
                if (pd) {
                    rows.push(
                        <tr key={`${key}-pd`} className={classes.subRow}>
                            <td />
                            <td colSpan={4}>
                                <span className={classes.subRowText}>
                                    {t("components.gdvmtokenomics.power_down_in_progress_at_of_pxp", {
                                        account: `@${e.to}`,
                                        withdrawn: pd.withdrawn !== null ? fmtCompact(pd.withdrawn) : '—',
                                        total: pd.total !== null ? fmtCompact(pd.total) : '—',
                                        perWeek: pd.perWeek !== null ? fmtCompact(pd.perWeek) : '—',
                                        next: fmtDate(pd.nextMs)
                                    })}
                                </span>
                            </td>
                        </tr>
                    );
                }
                return rows;
            })}
            </tbody>
        </table>
    </div>
);

// ──────────────────────────────────────────────────────────────
// Account card — one treasury: who controls it, what it may do, the
// ledger figures against the live balance, its outflows by category and
// recipient, the roadmap when its policy has one, and the ledger itself.
// ──────────────────────────────────────────────────────────────
const AccountCard = ({ classes, row, tgeMs, live, avatars, onOpenProposals }) => {
    const { account, summary, roadmap } = row;
    const name = account.name;
    const holds = account.holds || (account.role === 'dpf' ? 'PXS' : 'PXP');
    const holdsSym = displaySymbol(holds);
    const genesisSym = displaySymbol(summary.genesisAsset);
    const liveAcc = live[name] || null;
    const onChain = liveAcc && Number.isFinite(liveAcc[holds]) ? liveAcc[holds] : null;
    const isDpf = account.policy && account.policy.kind === 'proposals';
    const divider = (account.policy && Number(account.policy.daily_budget_divider)) || 100;

    // Ledger vs chain. Below the ledger's remaining figure means outflows
    // are missing from the file; above it is vesting growth (or inflows).
    let notice = null;
    if (!isDpf && onChain !== null && summary.genesis > 0) {
        const delta = onChain - summary.remaining;
        const drift = delta / summary.genesis;
        if (drift < -0.001) {
            notice = t("components.gdvmtokenomics.the_on_chain_balance_is_pxp_below", { delta: fmtCompact(-delta) });
        } else if (drift > 0.001) {
            notice = t("components.gdvmtokenomics.the_on_chain_balance_is_pxp_above", { delta: fmtCompact(delta) });
        }
    }

    const transfers = Array.isArray(account.transfers) ? account.transfers : [];
    const chips = [];
    if (account.control === 'multisig') {
        chips.push(<Chip key="ctl" classes={classes} tone="strong">{t("components.gdvmtokenomics.multi_sig")}</Chip>);
    } else if (account.control === 'protocol') {
        chips.push(<Chip key="ctl" classes={classes} tone="strong">{t("components.gdvmtokenomics.protocol_controlled")}</Chip>);
        chips.push(<Chip key="keys" classes={classes}>{t("components.gdvmtokenomics.no_private_keys")}</Chip>);
    }
    if (transfers.length > 0) {
        chips.push(
            <Chip key="tx" classes={classes}>
                {t("components.gdvmtokenomics.transfers_only", { assets: transfers.map(displaySymbol).join(' / ') })}
            </Chip>
        );
    }
    if (account.can_vote === false) {
        chips.push(<Chip key="vote" classes={classes}>{t("components.gdvmtokenomics.cannot_vote")}</Chip>);
    }
    const policyText = policyLabel(account.policy);
    if (policyText) {
        chips.push(
            <Tooltip key="policy" arrow interactive title={<div className={classes.tooltip}>{policyHint(account.policy)}</div>}>
                <span><Chip classes={classes} tone="muted">{policyText}</Chip></span>
            </Tooltip>
        );
    }

    const categoryLegend = summary.categories.map(c => ({
        key: c.key,
        fill: c.fill,
        label: categoryLabel(c.key),
        value: `${fmtCompact(c.value)} ${holdsSym}`
    }));
    categoryLegend.push({
        key: 'remaining',
        fill: REMAINING_SHADE,
        label: t("components.gdvmtokenomics.remaining"),
        value: `${fmtCompact(summary.remaining)} ${holdsSym}`
    });

    return (
        <div className={classes.panel}>
            <div className={classes.accountHeader}>
                <Avatar
                    classes={classes}
                    className={classes.accountAvatar}
                    url={avatars[name] || ''}
                    onClick={(e) => goAccount(e, name)}
                />
                <div className={classes.accountInfo}>
                    <div className={classes.accountTitleRow}>
                        <span className={classes.accountName} onClick={(e) => goAccount(e, name)}>@{name}</span>
                        <span className={classes.accountRole}>{roleLabel(account)}</span>
                    </div>
                    <div className={classes.chipRow}>{chips}</div>
                </div>
            </div>

            <div className={classes.statsGrid}>
                <StatItem
                    classes={classes}
                    label={t("components.gdvmtokenomics.genesis")}
                    value={`${fmtCompact(summary.genesis)} ${genesisSym}`}
                    sub={fmtExact(summary.genesis)}
                />
                {isDpf ? (
                    <>
                        <StatItem
                            classes={classes}
                            label={t("components.gdvmtokenomics.on_chain_now")}
                            value={onChain !== null ? `${fmtCompact(onChain)} ${holdsSym}` : null}
                            sub={onChain !== null ? fmtExact(onChain) : null}
                        />
                        <StatItem
                            classes={classes}
                            label={t("components.gdvmtokenomics.daily_budget")}
                            value={onChain !== null ? `${fmtCompact(onChain / divider)} ${holdsSym}` : null}
                            sub={t("components.gdvmtokenomics.1_of_the_balance_per_day", { divider })}
                        />
                    </>
                ) : (
                    <>
                        <StatItem
                            classes={classes}
                            label={t("components.gdvmtokenomics.distributed")}
                            value={`${fmtCompact(summary.distributed)} ${holdsSym}`}
                            sub={t("components.gdvmtokenomics.pct_of_genesis", { pct: fmtPct(summary.pct) })}
                            title={fmtExact(summary.distributed)}
                        />
                        <StatItem
                            classes={classes}
                            label={t("components.gdvmtokenomics.remaining_ledger")}
                            value={`${fmtCompact(summary.remaining)} ${holdsSym}`}
                            sub={fmtExact(summary.remaining)}
                        />
                        <StatItem
                            classes={classes}
                            label={t("components.gdvmtokenomics.on_chain_now")}
                            value={onChain !== null ? `${fmtCompact(onChain)} ${holdsSym}` : null}
                            sub={onChain !== null ? fmtExact(onChain) : null}
                        />
                    </>
                )}
            </div>
            {notice ? <div className={classes.notice}>{notice}</div> : null}

            {!isDpf || summary.entries.length > 0 ? (
                <>
                    <StackedBar
                        classes={classes}
                        segments={summary.categories}
                        total={summary.genesis}
                        height={14}
                        title={categoryLegend.map(l => `${l.label} ${l.value}`).join(' · ')}
                    />
                    <Legend classes={classes} items={categoryLegend} />
                </>
            ) : null}

            {roadmap ? (
                <RoadmapSection classes={classes} roadmap={roadmap} summary={summary} tgeMs={tgeMs} />
            ) : null}

            {summary.recipients.length > 0 ? (
                <div className={classes.section}>
                    <div className={classes.sectionHeader}>
                        <span className={classes.sectionLabel}>{t("components.gdvmtokenomics.recipients")}</span>
                    </div>
                    {summary.recipients.map(([to, value]) => (
                        <div key={to} className={classes.recipientRow}>
                            <div className={classes.recipientWho}>
                                <Avatar
                                    classes={classes}
                                    className={classes.recipientAvatar}
                                    url={avatars[to] || ''}
                                    onClick={(e) => goAccount(e, to)}
                                />
                                <span className={classes.recipientName} onClick={(e) => goAccount(e, to)}>@{to}</span>
                            </div>
                            <div className={classes.recipientBar}>
                                <StackedBar
                                    classes={classes}
                                    segments={[{ key: to, value, fill: '#c7c7c7' }]}
                                    total={summary.genesis}
                                    height={10}
                                    title={`@${to} · ${fmtExact(value)} ${holdsSym}`}
                                />
                            </div>
                            <span className={classes.recipientAmount}>
                                {fmtCompact(value)} {holdsSym}
                                <span className={classes.recipientPct}>
                                    {fmtPct(summary.genesis > 0 ? value / summary.genesis * 100 : 0)}
                                </span>
                            </span>
                        </div>
                    ))}
                </div>
            ) : null}

            {summary.entries.length > 0 ? (
                <div className={classes.section}>
                    <div className={classes.sectionHeader}>
                        <span className={classes.sectionLabel}>{t("components.gdvmtokenomics.outflows")}</span>
                    </div>
                    <LedgerTable classes={classes} entries={summary.entries} avatars={avatars} live={live} />
                </div>
            ) : isDpf ? (
                <div className={classes.section}>
                    <div className={classes.sectionHeader}>
                        <span className={classes.sectionLabel}>{t("components.gdvmtokenomics.outflows")}</span>
                        {typeof onOpenProposals === 'function' ? (
                            <Button
                                className={classes.openProposalsButton}
                                startIcon={<DescriptionIcon />}
                                onClick={onOpenProposals}
                            >
                                {t("components.gdvmtokenomics.open_the_proposals")}
                            </Button>
                        ) : null}
                    </div>
                    <Typography className={classes.explainerText}>
                        {t("components.gdvmtokenomics.every_pxs_that_leaves_this_account_does", { divider })}
                    </Typography>
                </div>
            ) : (
                <div className={classes.section}>
                    <Typography className={classes.explainerText}>
                        {t("components.gdvmtokenomics.no_outflows_recorded_yet")}
                    </Typography>
                </div>
            )}
        </div>
    );
};

class GDVMTokenomics extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            _live: {},        // { accountName: { PXP, PXS, PIXA, powerDown } } — live chain figures
            _avatars: {},     // { accountName: imageUrl }
            _supply: null,    // { PIXA, PXS } current supply, from the dynamic global properties
        };
        this._mounted = false;
    }

    componentDidMount() {
        this._mounted = true;
        this._loadData();
    }

    componentDidUpdate(prevProps) {
        // Refetch if the api handle swaps in late.
        if (prevProps.api !== this.props.api) this._loadData();
    }

    componentWillUnmount() {
        this._mounted = false;
    }

    // The ledger renders without the chain. This only adds avatars, the live
    // balances the cards reconcile against, and the current supply; every
    // read fails soft into a dash.
    _loadData = async () => {
        const { api } = this.props;
        if (typeof api?.accounts?.getAccounts !== 'function') return;

        const names = accountNames(TOKENOMICS);

        const accountsPromise = (async () => {
            const out = [];
            for (let i = 0; i < names.length; i += 100) {
                try {
                    const accs = await api.accounts.getAccounts(names.slice(i, i + 100));
                    for (const acc of (accs || [])) if (acc?.name) out.push(acc);
                } catch (e) {
                    console.warn('[GDVMTokenomics] getAccounts failed:', e?.message);
                }
            }
            return out;
        })();

        const dgpPromise = (async () => {
            if (typeof api.globals?.getDynamicGlobalProperties !== 'function') return null;
            try {
                return await api.globals.getDynamicGlobalProperties();
            } catch (e) {
                console.warn('[GDVMTokenomics] getDynamicGlobalProperties failed:', e?.message);
                return null;
            }
        })();

        const [accs, dgp] = await Promise.all([accountsPromise, dgpPromise]);
        if (!this._mounted) return;

        const price = vestingSharePrice(dgp);
        const live = {};
        const avatars = {};
        for (const acc of accs) {
            live[acc.name] = readLive(acc, price);
            if (acc._profile?.profile_image) avatars[acc.name] = acc._profile.profile_image;
        }

        this.setState({
            _live: live,
            _avatars: avatars,
            _supply: readSupply(dgp)
        }, () => this.forceUpdate());
    }

    render() {
        const { classes, onOpenProposals } = this.props;
        const { _live, _avatars, _supply } = this.state;
        const model = buildModel(TOKENOMICS, Date.now());

        return (
            <DialogContent className={classes.dialogContent}>
                <TgeSummary classes={classes} model={model} supply={_supply} />
                <Explainer classes={classes} model={model} />
                {model.rows.map((row) => (
                    <AccountCard
                        key={row.account.name}
                        classes={classes}
                        row={row}
                        tgeMs={model.tgeMs}
                        live={_live}
                        avatars={_avatars}
                        onOpenProposals={onOpenProposals}
                    />
                ))}
            </DialogContent>
        );
    }
}

export default withLanguage(withStyles(styles)(GDVMTokenomics));
