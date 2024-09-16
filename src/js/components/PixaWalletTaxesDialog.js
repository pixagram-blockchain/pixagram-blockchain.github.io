import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import TextField from "@material-ui/core/TextField";
import { MuiPickersUtilsProvider, KeyboardDatePicker } from "@material-ui/pickers";
import DateFnsUtils from "@date-io/date-fns";
import Checkbox from "@material-ui/core/Checkbox";
import FormGroup from "@material-ui/core/FormGroup";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import CircularProgress from "@material-ui/core/CircularProgress";
import LinearProgress from "@material-ui/core/LinearProgress";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import Collapse from "@material-ui/core/Collapse";
import Step from "@material-ui/core/Step";
import StepLabel from "@material-ui/core/StepLabel";
import Stepper from "@material-ui/core/Stepper";
import Tooltip from "@material-ui/core/Tooltip";
import CloseRounded from "@material-ui/icons/CloseRounded";
import DescriptionRounded from "@material-ui/icons/DescriptionRounded";
import CloudDownloadRounded from "@material-ui/icons/CloudDownloadRounded";
import PictureAsPdfRounded from "@material-ui/icons/PictureAsPdfRounded";
import ExpandMoreRounded from "@material-ui/icons/ExpandMoreRounded";
import CallReceivedRounded from "@material-ui/icons/CallReceivedRounded";
import CallMadeRounded from "@material-ui/icons/CallMadeRounded";
import SyncAltRounded from "@material-ui/icons/SyncAltRounded";
import EmojiEventsRounded from "@material-ui/icons/EmojiEventsRounded";

// ── FairFlow tax engine (ES modules in ../tax) ───────────────────────────────
// The dialog is the UI driver; all tax logic lives in these three modules:
//   pixa-tax-ingest  — dpixa account history → canonical TaxEvent[]
//   pixa-tax-engine  — TaxEvent[] + profile  → ReportBundle (wealth/tx/ops)
//   taxReport        — ReportBundle          → PDF (pdf-lib) + CSV
import { defaultConfig, accountHistoryToTaxEvents } from "../utils/tax/pixa-tax-ingest";
import { buildAllReports, PxsAnchoredPriceProvider, summarizeCounterparties, incomeTimingFor } from "../utils/tax/pixa-tax-engine";
import { generateTaxReportPdf, generateTaxReportCsvs } from "../utils/tax/taxReport";

import { T } from "../utils/T";
import { t, getLocaleCode } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";
/**
 * Escape a value for a CSV cell: quote it if it contains a comma, quote or
 * newline, and neutralise a leading formula character.
 *
 * Hoisted to module scope because the report head is assembled outside the
 * export handler where the original local `esc` lives — and that head is built
 * from TRANSLATED strings. A French or German translation that naturally
 * contains a comma would otherwise add a column and malform the export, with
 * nothing to flag it: the file still opens, the columns are just wrong.
 */
function csvCell(s) {
    let v = String(s ?? "");
    if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
    return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}


/**
 * Linear CSV line parser. O(n), no regex, no backtracking.
 * Handles quoted fields and doubled quotes; never throws.
 */
function parseCsvLine(line) {
    const out = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQ) {
            if (ch === '"') {
                if (line[i + 1] === '"') { cur += '"'; i++; }
                else inQ = false;
            } else cur += ch;
        } else if (ch === '"') inQ = true;
        else if (ch === ",") { out.push(cur.trim()); cur = ""; }
        else cur += ch;
    }
    out.push(cur.trim());
    return out;
}


// Chain timestamps are UTC and may arrive without a trailing 'Z'.
const tsToMs = (iso) => {
    if (!iso) return NaN;
    const norm = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z';
    return Date.parse(norm);
};
const fmtDate = (iso) => {
    const ms = tsToMs(iso);
    return Number.isNaN(ms) ? (iso || '') : new Date(ms).toISOString().slice(0, 10);
};

// The KeyboardDatePicker works with Date objects (local). On-chain timestamps
// are UTC, and tax ranges are calendar days, so we read the picker's local
// Y/M/D (what the user actually sees) and build UTC day boundaries from it:
// the day shown in the picker is the UTC calendar day used for filtering.
const isValidDate = (d) => d instanceof Date && !Number.isNaN(d.getTime());
const pad2 = (n) => String(n).padStart(2, '0');
const ymd = (d) => isValidDate(d) ? `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` : '';
const dayStartMs = (d) => isValidDate(d) ? Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0) : NaN;
const dayEndMs = (d) => isValidDate(d) ? Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999) : NaN;

// Display formatters for engine output.
const fmtFiat = (n) => Number(n || 0).toLocaleString(getLocaleCode(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtQty = (n) => Number(n || 0).toLocaleString(getLocaleCode(), { maximumFractionDigits: 4 });

// One entry per engine ruleset — twenty-six jurisdictions. The note is the
// one-line summary shown under the options and inside the report footer.
const JURISDICTIONS = [
    { id: 'CH', labelKey: 'jur_ch', noteKey: 'jur_ch_note' },
    { id: 'US', labelKey: 'jur_us', noteKey: 'jur_us_note' },
    { id: 'DE', labelKey: 'jur_de', noteKey: 'jur_de_note' },
    { id: 'FR', labelKey: 'jur_fr', noteKey: 'jur_fr_note' },
    { id: 'UK', labelKey: 'jur_uk', noteKey: 'jur_uk_note' },
    { id: 'AT', labelKey: 'jur_at', noteKey: 'jur_at_note' },
    { id: 'NL', labelKey: 'jur_nl', noteKey: 'jur_nl_note' },
    { id: 'ES', labelKey: 'jur_es', noteKey: 'jur_es_note' },
    { id: 'PT', labelKey: 'jur_pt', noteKey: 'jur_pt_note' },
    { id: 'CA', labelKey: 'jur_ca', noteKey: 'jur_ca_note' },
    { id: 'AU', labelKey: 'jur_au', noteKey: 'jur_au_note' },
    { id: 'JP', labelKey: 'jur_jp', noteKey: 'jur_jp_note' },
    { id: 'BR', labelKey: 'jur_br', noteKey: 'jur_br_note' },
    { id: 'KR', labelKey: 'jur_kr', noteKey: 'jur_kr_note' },
    { id: 'IN', labelKey: 'jur_in', noteKey: 'jur_in_note' },
    { id: 'SG', labelKey: 'jur_sg', noteKey: 'jur_sg_note' },
    { id: 'AE', labelKey: 'jur_ae', noteKey: 'jur_ae_note' },
    { id: 'HK', labelKey: 'jur_hk', noteKey: 'jur_hk_note' },
    { id: 'NZ', labelKey: 'jur_nz', noteKey: 'jur_nz_note' },
    { id: 'ZA', labelKey: 'jur_za', noteKey: 'jur_za_note' },
    { id: 'MX', labelKey: 'jur_mx', noteKey: 'jur_mx_note' },
    { id: 'AR', labelKey: 'jur_ar', noteKey: 'jur_ar_note' },
    { id: 'TH', labelKey: 'jur_th', noteKey: 'jur_th_note' },
    { id: 'IL', labelKey: 'jur_il', noteKey: 'jur_il_note' },
    { id: 'ID', labelKey: 'jur_id', noteKey: 'jur_id_note' },
    { id: 'NG', labelKey: 'jur_ng', noteKey: 'jur_ng_note' },
];

const REPORT_TYPES = [
    { id: 'wealth', labelKey: 'report_type_wealth_statement' },
    { id: 'transactions', labelKey: 'report_type_transactions' },
    { id: 'operations', labelKey: 'report_type_operations' },
];

// An active account can hold tens of thousands of operations. The dialog is a
// summary, so each detail list renders at most VIEW_CAP rows; the complete,
// line-by-line record is always in the CSV export. Totals shown under each list
// are computed from the full set, not the capped view.
const VIEW_CAP = 100;
function capNote(total) {
    if (total <= VIEW_CAP) return null;
    return (
        <Typography style={{ color: "#8a8a8a", fontSize: "0.72rem", padding: "0 16px 8px", fontStyle: "italic" }}>{t(
            "components.pixa_wallet_taxes_dialog.showing_the_first_of_export_the_csv",
            {
                VIEW_CAP: VIEW_CAP,
                total: total.toLocaleString(getLocaleCode())
            }
        )}</Typography>
    );
}

// HIVE-standard asset identifiers. account_history_api (getAccountHistoryFull)
// returns assets as NAI objects { amount, precision, nai }; parseAsset's NAI
// branch returns this mapped value as the realm asset DIRECTLY (it does not pass
// through symbolMap), so map straight to PXA/PXS/PXP.
const NAI_MAP = {
    '@@000000021': 'PXA',   // liquid (HIVE-equivalent),  precision 3
    '@@000000013': 'PXS',   // oracle/backed (HBD-equiv), precision 3
    '@@000000037': 'PXP',   // vesting (VESTS-equivalent), precision 6
};

const HISTORY_PAGE = 1000;   // ops fetched per API call

// Friendly labels for the itemized account-movement kinds (engine bundle.movements).
// power_up is resolved per-leg in movementLabel() below (start vs completed).
const MOVEMENT_LABELS = {
    fee_payment: 'movement_fee_paid',
    savings_fill: 'movement_savings_withdrawal',
    power_down: 'movement_power_down_unstaked',
    request_powerdown: 'movement_power_down_request',
    request_convert: 'movement_conversion_request',
    request_collateralized: 'movement_collateralized_request',
    immediate_conversion: 'movement_collateralized_immediate_leg',
    to_own_exchange: 'movement_sent_to_your_exchange',
    to_own_wallet: 'movement_sent_to_your_own_wallet',
    gift_out: 'movement_gift_sent',
    charity_donation: 'movement_charity_donation',
    delegation_out: 'movement_pxp_delegated_still_yours',
    delegation_in: 'movement_pxp_delegated_to_you',
    delegation_return: 'movement_delegation_returned',
};

// Outbound-transfer intents the user can assign per counterparty. The default for
// anything unlabelled is "payment" — a taxable disposal — so doing nothing is the
// conservative choice. Each option carries a one-line note on its tax effect.
const INTENT_OPTIONS = [
    ['payment', 'intent_payment', 'intent_payment_note'],
    ['own_exchange', 'intent_own_exchange', 'intent_own_exchange_note'],
    ['own', 'intent_own', 'intent_own_note'],
    ['gift', 'intent_gift', 'intent_gift_note'],
    ['charity', 'intent_charity', 'intent_charity_note'],
];

// Resolve a movement label. A power-up is a single instant operation with two
// legs: PXA leaves (the stake starts) and PXP arrives (the stake completes), so
// each leg gets its own wording.
function movementLabel(kind, direction) {
    if (kind === 'power_up') {
        return direction === 'out' ? t("components.pixa_wallet_taxes_dialog.movement_power_up_start") : t("components.pixa_wallet_taxes_dialog.movement_power_up_completed");
    }
    const key = MOVEMENT_LABELS[kind];
    return key ? t("components.pixa_wallet_taxes_dialog." + key) : kind;
}
const MAX_PAGES = 5000;      // safety cap (5M ops)

/**
 * Price provider backed by the wallet's live feed, so the report's figures match
 * what the wallet shows. Token prices arrive in USD (api.prices.pxaUsd / pxsUsd);
 * `fiatRate` converts USD → the user's selected display currency and
 * `fiatCurrency` is the label. PXA and PXP are valued at the PXA price (PXP is
 * vesting PXA); PXS at the PXS price.
 *
 * IMPORTANT: this is a single CURRENT snapshot — the wallet has no historical
 * price feed. The engine asks for a price per event date, but we return the same
 * current price for every date. So the wealth statement (year-end holdings) is
 * accurate, while realized-gain figures are only approximate: a disposal's
 * proceeds and its cost basis use the same unit price, so most gains read ≈ 0
 * (the exception is a disposal with no recorded acquisition, whose basis is 0).
 * Wire a historical oracle / Kursliste for exact gains.
 */
class WalletPriceProvider {
    constructor({ pxaUsd, pxsUsd, fiatRate, fiatCurrency, pixaPerVest }) {
        const r = Number.isFinite(fiatRate) && fiatRate > 0 ? fiatRate : 1;
        const ppv = Number.isFinite(pixaPerVest) && pixaPerVest > 0 ? pixaPerVest : 1;
        this._pxa = (Number(pxaUsd) || 0) * r;
        this._pxs = (Number(pxsUsd) || 0) * r;
        // PXP amounts reach the engine already converted to PXP units (the ingest
        // applies VESTS x ratio = PXP via pixaPerVest), and 1 PXP = 1 PXA in value,
        // so PXP is priced at the PXA price. pixaPerVest (the vesting share price,
        // PXA per VEST) is kept for the report's "VESTS x ratio = PXP" line.
        this.pixaPerVest = ppv;
        this.vestingPerPxa = ppv > 0 ? 1 / ppv : 1;
        this._pxp = this._pxa;
        this.version = `wallet-live-${fiatCurrency || 'USD'}`;
    }
    price(asset /* , fiat, isoDate */) {
        if (asset === 'PXS') return { fiatPerUnit: this._pxs, source: 'wallet_live' };
        if (asset === 'PXP') return { fiatPerUnit: this._pxp, source: 'wallet_live' };
        return { fiatPerUnit: this._pxa, source: 'wallet_live' }; // PXA
    }
    officialYearEnd(/* asset, fiat, year */) { return null; } // forces platform-price fallback
}

const styles = theme => ({
    paper: {
        backgroundColor: "#0e0e0e",
        color: "#e8e8e8",
        borderRadius: "28px",
        width: "100%",
        maxWidth: "640px",
        [theme.breakpoints.down("sm")]: {
            margin: 0, maxWidth: "100%", width: "100%", height: "100%", maxHeight: "100%", borderRadius: 0,
        },
    },
    header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 8px 24px" },
    title: { display: "flex", alignItems: "center", gap: "10px", fontWeight: 600, color: "#fff" },
    content: { "&.MuiDialogContent-root": { padding: "8px 24px" } },
    sectionLabel: {
        fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase",
        color: "#7a7a7a", margin: "18px 0px 8px 0px",
    },
    dateRow: { display: "flex", gap: "12px", flexWrap: "wrap" },
    // Dark-theme overrides for the outlined KeyboardDatePicker input. The popover
    // calendar inherits the app's MUI theme (already dark across the wallet).
    pickerField: {
        flex: "1 1 150px",
        // Inputs carry NO border in any state — the fill is the surface, and
        // focus is a background step-up, keeping the whole dialog line-free.
        "& .MuiOutlinedInput-root": { borderRadius: 12, backgroundColor: "#151515", transition: "background-color 160ms ease" },
        "& .MuiOutlinedInput-notchedOutline": { border: "none" },
        "& .MuiOutlinedInput-root:hover": { backgroundColor: "#191919" },
        "& .MuiOutlinedInput-root.Mui-focused": { backgroundColor: "#1f1f1f" },
        "& .MuiInputBase-input": { color: "#e0e0e0", fontFamily: "monospace" },
        "& .MuiInputLabel-root": { color: "#7a7a7a" },
        "& .MuiInputLabel-root.Mui-focused": { color: "#bdbdbd" },
        "& .MuiIconButton-root": { color: "#9a9a9a" },
        "& .MuiFormHelperText-root": { color: "#6a6a6a", fontSize: "0.68rem" },
    },
    select: {
        "&.MuiInput-root": { backgroundColor: "#151515", borderRadius: "12px", padding: "6px 12px", color: "#e0e0e0" },
        "&.MuiInput-underline:before, &.MuiInput-underline:after": { display: "none" },
        "& .MuiSelect-icon": { color: "#7a7a7a" },
    },
    checkGroup: {
        "& .MuiFormControlLabel-label": { color: "#cfcfcf", fontSize: "0.92rem" },
        "& .MuiCheckbox-root": { color: "#5a5a5a" },
        "& .MuiCheckbox-colorSecondary.Mui-checked": { color: "#d0d0d0" },
    },
    note: { color: "#7f7f7f", fontSize: "0.8rem", lineHeight: 1.55, margin: "10px 0px 0px 0px" },
    greyButton: {
        "&.MuiButton-contained": { backgroundColor: "#151515", color: "#c0c0c0" },
        "&.MuiButton-contained:hover": { backgroundColor: "#242424", color: "#fff" },
        "&.MuiButton-contained.Mui-disabled": { opacity: 0.35 },
    },
    whiteButton: {
        "&.MuiButton-contained": { backgroundColor: "#d0d0d0", color: "#151515" },
        "&.MuiButton-contained:hover": { backgroundColor: "#fff", color: "#000" },
        "&.MuiButton-contained.Mui-disabled": { opacity: 0.35 },
    },
    progressWrap: { textAlign: "center", padding: "28px 8px 16px" },
    metricsGrid: {
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: "10px", margin: "8px 0px 4px 0px",
    },
    metric: { backgroundColor: "#151515", borderRadius: "16px", padding: "14px 16px" },
    metricLabel: { color: "#7a7a7a", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em" },
    metricValue: { color: "#fff", fontSize: "1.15rem", fontWeight: 600, fontFamily: "monospace", marginTop: 4 },
    metricSub: { color: "#6f6f6f", fontSize: "0.72rem", fontFamily: "monospace", marginTop: 2 },
    reportList: { backgroundColor: "#0b0b0b", borderRadius: "16px", marginTop: 8, maxHeight: 260, overflow: "auto" },
    rowMono: { fontFamily: "monospace" },
    empty: { color: "#666", padding: "12px 16px", fontSize: "0.85rem" },
    sectionHeader: {
        display: "flex", alignItems: "center", justifyContent: "space-between",
        cursor: "pointer", userSelect: "none", margin: "16px 0px 0px 0px",
        "& .chev": { transition: "transform 0.2s ease", color: "#777" },
        "& .chev.open": { transform: "rotate(180deg)" },
    },
    // Same stepper as CreateAccountDialog, restated in greyscale: dark idle
    // circles, light active, mid-grey completed. The connector inherits grey.
    stepper: {
        padding: "8px 16px 16px 16px",
        backgroundColor: "transparent",
        "& .MuiStepIcon-root": { color: "#1d1d1d" },
        "& .MuiStepIcon-root .MuiStepIcon-text": { fill: "#8a8a8a" },
        "& .MuiStepIcon-root.MuiStepIcon-active": { color: "#d0d0d0" },
        "& .MuiStepIcon-root.MuiStepIcon-active .MuiStepIcon-text": { fill: "#111" },
        "& .MuiStepIcon-root.MuiStepIcon-completed": { color: "#6f6f6f" },
        "& .MuiStepLabel-label": { color: "#6a6a6a", letterSpacing: "0.05em" },
        "& .MuiStepLabel-label.MuiStepLabel-active": { color: "#fff" },
        "& .MuiStepLabel-label.MuiStepLabel-completed": { color: "#9a9a9a" },
        "& .MuiStepConnector-line": { borderColor: "#222" },
    },
    // Slightly-lighter-than-paper rounded surface for the Advanced / Refine
    // collapses and the classification list — surfaces, never borders.
    greyPanel: {
        backgroundColor: "#161616",
        borderRadius: "18px",
        padding: "12px 16px 14px",
        marginTop: 14,
    },
    // Jurisdiction and reports sit side by side when the width allows,
    // wrapping to a single column on narrow screens.
    sideBySide: {
        display: "flex", flexWrap: "wrap", gap: "8px 24px", alignItems: "flex-start",
        "& > div": { flex: "1 1 240px", minWidth: 220 },
    },
    // Accordion panels for the report sections (transfers → review): one open
    // at a time, lighter grey rounded surfaces, chevron rotation, no borders.
    accordion: {
        backgroundColor: "#141414",
        borderRadius: "18px",
        marginTop: 10,
        overflow: "hidden",
    },
    accordionHeader: {
        display: "flex", alignItems: "center", justifyContent: "space-between",
        cursor: "pointer", userSelect: "none", padding: "12px 16px",
        transition: "background-color 160ms ease",
        "&:hover": { backgroundColor: "#181818" },
        "& .chev": { transition: "transform 0.2s ease", color: "#777" },
        "& .chev.open": { transform: "rotate(180deg)" },
    },
    accordionBody: { padding: "0px 8px 8px" },
});

class PixaWalletTaxesDialog extends React.Component {
    constructor(props) {
        super(props);
        // Default window: from 1 Jan of the year before the current year, through
        // today — a bit over a year, covering the last full year plus the current
        // year to date.
        const now = new Date();
        const startYear = now.getUTCFullYear() - 1;
        this.state = {
            _startDate: new Date(startYear, 0, 1),   // 1 Jan of last year
            _endDate: now,                           // today
            _jurisdiction: 'CH',
            _reports: { wealth: true, transactions: true, operations: true },
            _loading: false,
            _error: '',
            _bundle: null,     // ReportBundle from the engine
            _ingest: null,     // IngestResult { events, warnings, skipped, byRealm }
            _progress: { count: 0, page: 0, oldestDate: '' },
            // Stepper: 0 = Options (fill in), 1 = Classify (label each send,
            // completing it applies & recomputes), 2 = Review & export.
            _step: 0,
            // Accordion: exactly one report section open at a time (or none).
            _openSection: 'transfers',
            // Advanced inputs (collapsible). _vestingRate is the vesting SHARE PRICE
            // (PXA per VEST); VESTS x it = PXP. It prefills from the live chain rate.
            // _openingLots seeds pre-history holdings so old disposals have a basis.
            _showAdvanced: false,
            _vestingRate: '',          // '' → use the auto (chain) rate below
            _vestingRateAuto: 0,       // fetched on open
            _openingLots: {
                PXA: { qty: '', cost: '' },
                PXS: { qty: '', cost: '' },
                PXP: { qty: '', cost: '' },
            },
            // Refine panel (shown after the first build, once counterparties are known).
            // _intents maps a counterparty account → how its outbound sends are treated
            // (own / own_exchange / payment / gift / charity). _lossCarryforward and
            // _exemptionUsed feed the engine's deduction math. Persisted per account.
            _showRefine: false,
            _intents: {},
            _lossCarryforward: '',
            _exemptionUsed: '',
            _engineCtx: null,   // { prices, fiatOverride, year, period } cached for recompute
        };
    }

    componentDidUpdate(prevProps) {
        // Clear any stale report when the dialog is (re)opened.
        if (this.props.open && !prevProps.open) {
            this.setState({ _bundle: null, _ingest: null, _error: '', _step: 0, _openSection: 'transfers' });
            this._loadVestingRate();
            this._loadRefine();
        }
    }

    // Counterparty intents + deduction inputs persist per account, so the labels you
    // assign once are remembered next time. Storage failures are non-fatal.
    _refineKey = () => `pixa.tax.refine.${(this.props.account && this.props.account.username) || 'anon'}`;
    _loadRefine = () => {
        try {
            const raw = window.localStorage.getItem(this._refineKey());
            if (!raw) return;
            const v = JSON.parse(raw);
            this.setState({
                _intents: v.intents || {},
                _lossCarryforward: v.lossCarryforward || '',
                _exemptionUsed: v.exemptionUsed || '',
            }, () => this.forceUpdate());
        } catch (e) { /* no persisted state / storage unavailable */ }
    };
    _persistRefine = () => {
        try {
            const { _intents, _lossCarryforward, _exemptionUsed } = this.state;
            window.localStorage.setItem(this._refineKey(), JSON.stringify({
                intents: _intents, lossCarryforward: _lossCarryforward, exemptionUsed: _exemptionUsed,
            }));
        } catch (e) { /* storage unavailable — labels still apply this session */ }
    };

    /**
     * Prefill the vesting-rate field with the chain's current vesting SHARE PRICE —
     * PXA per VEST = total_vesting_fund / total_vesting_shares, computed at FULL
     * precision straight from the dynamic global properties. The share price sits
     * just above parity (e.g. 1.000002), so it must NOT be routed through a formatter
     * that rounds to PXA's 3 decimals — that would flatten 1.000002 back to 1.000.
     * Prefers the props the wallet already fetched; fetches its own only if absent.
     * The user can still override the field.
     */
    _loadVestingRate = async () => {
        const { api, vestToPixa: vestToPixaProp, globalProps: globalPropsProp } = this.props;
        const apply = (pixaPerVest) => {
            const pretty = pixaPerVest.toFixed(9).replace(/0+$/, '').replace(/\.$/, '');
            this.setState(prev => ({
                _vestingRateAuto: pixaPerVest,
                _vestingRate: prev._vestingRate === '' ? pretty : prev._vestingRate,
            }), () => this.forceUpdate());
        };
        const num = (v) => {
            if (v == null) return 0;
            if (typeof v === 'string') return Number(v.split(/\s+/)[0]) || 0;
            if (typeof v === 'object' && v.amount != null) {
                const prec = typeof v.precision === 'number' ? v.precision : 0;
                return (Number(v.amount) || 0) / Math.pow(10, prec);
            }
            return Number(v) || 0;
        };

        // Authoritative source: the dynamic global properties. Use the props the
        // wallet already fetched, else fetch our own. Share price = fund / shares at
        // full double precision (e.g. 1.000002), computed directly — never rounded.
        let g = globalPropsProp;
        if (!g && api && api.globals && typeof api.globals.getDynamicGlobalProperties === 'function') {
            try { g = await api.globals.getDynamicGlobalProperties(); } catch (e) { g = null; }
        }
        if (g) {
            const shares = num(g.total_vesting_shares);
            // The Pixa fork exposes total_vesting_fund_pixa; steem/hive are fallbacks.
            const fundRaw = g.total_vesting_fund_pixa || g.total_vesting_fund_steem
                || g.total_vesting_fund_hive || g.total_vesting_fund;
            const fund = num(fundRaw);
            if (shares > 0 && fund > 0) { apply(fund / shares); return; }
        }

        // Fallback only when no global properties are reachable: derive the share
        // price from the wallet's converter, probing a LARGE amount so any rounding
        // to PXA precision can't flatten a near-parity ratio.
        if (typeof vestToPixaProp === 'function') {
            const probe = 1e12;
            const px = parseFloat(vestToPixaProp(probe));
            if (Number.isFinite(px) && px > 0) { apply(px / probe); return; }
        }
    };

    // The effective vesting SHARE PRICE (PXA per VEST): the field if set & valid, else
    // the fetched chain value, else 1 (the early-chain / demo 1:1 placeholder).
    _effectiveVestingRate = () => {
        const typed = parseFloat(this.state._vestingRate);
        if (Number.isFinite(typed) && typed > 0) return typed;
        if (this.state._vestingRateAuto > 0) return this.state._vestingRateAuto;
        return 1;
    };

    _setVestingRate = (v) => this.setState({ _vestingRate: v }, () => this.forceUpdate());

    _setOpeningLot = (asset, field, v) => this.setState(prev => ({
        _openingLots: { ...prev._openingLots, [asset]: { ...prev._openingLots[asset], [field]: v } },
    }), () => this.forceUpdate());

    // Build the engine's openingLots array from the user's inputs (skips blanks).
    _buildOpeningLots = () => {
        const ol = this.state._openingLots || {};
        const out = [];
        for (const asset of ['PXA', 'PXS', 'PXP']) {
            const row = ol[asset] || {};
            const qty = parseFloat(row.qty);
            if (Number.isFinite(qty) && qty > 0) {
                out.push({ asset, qty, costFiat: parseFloat(row.cost) || 0 });
            }
        }
        return out;
    };

    // Assemble the engine profile from the current inputs — used by both the initial
    // generate and the in-memory recompute. Counterparty intents and deduction numbers
    // flow in here, so changing them and recomputing is enough to update the report.
    _buildProfile = () => {
        const { account } = this.props;
        const { _jurisdiction, _intents, _lossCarryforward, _exemptionUsed } = this.state;
        return {
            account: account.username,
            residences: [{ jurisdiction: _jurisdiction, from: '1970-01-01' }],
            ownWallets: [account.username],
            costBasisMethod: 'FIFO',
            openingLots: this._buildOpeningLots(),
            counterpartyIntents: { ...(_intents || {}) },
            lossCarryforwardFiat: parseFloat(_lossCarryforward) || 0,
            exemptionUsedFiat: parseFloat(_exemptionUsed) || 0,
        };
    };

    // Re-run the engine on the already-fetched events with the current intents and
    // deductions — no network round-trip. Triggered by the refine panel's Apply button.
    _recompute = () => {
        const { _ingest, _engineCtx } = this.state;
        if (!_ingest || !_engineCtx) return this.state._bundle;
        try {
            const profile = this._buildProfile();
            const bundle = buildAllReports(profile, _ingest.events, _engineCtx.year, _engineCtx.prices, _engineCtx.period, _engineCtx.fiatOverride);
            this.setState({ _bundle: bundle, _error: '' }, () => this.forceUpdate());
            return bundle;
        } catch (e) { this._setError((e && e.message) || t("components.pixa_wallet_taxes_dialog.recompute_failed")); return this.state._bundle; }
    };

    _setIntent = (cp, intent) => this.setState(
        prev => ({ _intents: { ...prev._intents, [cp]: intent } }),
        () => { this._persistRefine(); this.forceUpdate(); }
    );
    _setDeduction = (field, v) => this.setState(
        { [field]: v },
        () => { this._persistRefine(); this.forceUpdate(); }
    );

    // Counterparties → CSV the user can bulk-edit in a spreadsheet and re-import. The
    // editable column is `intent`; everything else is context the engine discovered.
    _exportIntentsCsv = () => {
        const { _ingest, _intents } = this.state;
        const { account } = this.props;
        if (!_ingest) return;
        const rows = summarizeCounterparties(_ingest.events, [account.username]);
        // RFC-4180 quoting AND formula-injection defence. Quoting alone does
        // nothing about a field that STARTS with = + - @ tab or CR: Excel,
        // LibreOffice and Sheets all evaluate those on open. The intent column
        // is round-tripped through _importIntentsCsv, which explicitly invites
        // the user to edit this file in a spreadsheet — so hostile content has
        // a clean path in and back out. Prefixing an apostrophe neutralises it.
        const esc = (s) => {
            let v = String(s ?? "");
            if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
            return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
        };
        const head = 'counterparty,sends,sent,intent,suggested\r\n';
        const body = rows.map(r => {
            const sent = Object.entries(r.byAsset).map(([a, q]) => `${(+q).toFixed(3)} ${a}`).join(' + ');
            const intent = (_intents && _intents[r.counterparty]) || r.suggestedIntent;
            return [r.counterparty, r.sends, sent, intent, r.suggestedIntent].map(esc).join(',');
        }).join('\r\n');
        this._download(head + body, `${this._fileBase()}_counterparties.csv`, 'text/csv');
    };
    _importIntentsCsv = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const text = String(reader.result || '');
                const lines = text.split(/\r?\n/).filter(l => l.trim());
                if (!lines.length) return;
                const header = lines[0].split(',').map(h => h.trim().toLowerCase());
                const cpIdx = header.indexOf('counterparty');
                const inIdx = header.indexOf('intent');
                if (cpIdx < 0 || inIdx < 0) { this._setError(t(
                    "components.pixa_wallet_taxes_dialog.csv_needs_a_counterparty_and_an_intent"
                )); return; }
                const valid = new Set(['own', 'own_exchange', 'payment', 'gift', 'charity']);
                const next = {};
                for (let i = 1; i < lines.length; i++) {
                    // minimal CSV parse (handles simple quoted fields)
                    // Was: lines[i].match(/("([^"]|"")*"|[^,]*)(,|$)/g)
                    // A nested quantifier inside a group that can also match
                    // empty is catastrophic-backtracking shaped: one long line
                    // of unbalanced quotes hangs the tab, and the surrounding
                    // try/catch does not help because backtracking is not an
                    // exception. Replaced with a linear character scan.
                    const cells = parseCsvLine(lines[i]);
                    const cp = cells[cpIdx], intent = (cells[inIdx] || '').toLowerCase();
                    // cp is arbitrary text from a user-supplied file and is
                    // persisted to localStorage. Bound it.
                    if (cp && cp.length <= 64 && /^[\w.@-]+$/.test(cp) && valid.has(intent)) next[cp] = intent;
                }
                this.setState(prev => ({ _intents: { ...prev._intents, ...next } }), () => { this._persistRefine(); this._recompute(); });
            } catch (e) { this._setError(t("components.pixa_wallet_taxes_dialog.could_not_read_that_csv")); }
        };
        reader.readAsText(file);
    };

    _setError = (msg) => this.setState({ _error: msg, _loading: false }, () => this.forceUpdate());
    // Toggling a report just gates which sections show/export — no regenerate needed.
    _toggleReport = (id) => this.setState(prev => ({ _reports: { ...prev._reports, [id]: !prev._reports[id] } }), () => this.forceUpdate());
    // Accordion semantics: opening a section closes the previous one.
    _toggleExpanded = (id) => this.setState(prev => ({ _openSection: prev._openSection === id ? null : id }), () => this.forceUpdate());

    // ── Stepper navigation (same dispatch shape as CreateAccountDialog) ──────
    _stepBack = () => this.setState(prev => ({ _step: Math.max(0, prev._step - 1) }), () => this.forceUpdate());
    // Step 1 (Options) completes by fetching + computing; _generate advances on success.
    _first_step_done = () => this._generate();
    // Step 2 (Classify) completes by APPLYING the labels & deductions — the old
    // "Apply changes & recompute" button is this step's Continue.
    _second_step_done = () => {
        const bundle = this._recompute();
        if (bundle) this.setState({ _step: 2 }, () => this.forceUpdate());
    };
    _step_done = (v) => {
        if (v === 0) return this._first_step_done();
        if (v === 1) return this._second_step_done();
        // Step 3 has no "next" — the export buttons are the actions.
    };
    _jurisdictionMeta = () => JURISDICTIONS.find(j => j.id === this.state._jurisdiction) || JURISDICTIONS[0];

    /**
     * Generate a report by running the FairFlow pipeline:
     *   full account history  →  accountHistoryToTaxEvents (ingest)
     *                         →  buildAllReports (engine)        →  ReportBundle
     * The date range maps to the engine's reporting period; the filing year and
     * residence are taken from the range end. Valuation comes from the engine's
     * PXS-anchored price provider.
     */
    _generate = async () => {
        const { api, account, fiatRate, fiatCurrency } = this.props;
        const { _startDate, _endDate, _jurisdiction } = this.state;
        if (!api || !account || !account.username) { this._setError(t("components.pixa_wallet_taxes_dialog.wallet_not_ready")); return; }

        const startMs = dayStartMs(_startDate);
        const endMs = dayEndMs(_endDate);
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) { this._setError(t("components.pixa_wallet_taxes_dialog.please_choose_a_valid_start_and_end")); return; }
        if (startMs > endMs) { this._setError(t("components.pixa_wallet_taxes_dialog.the_start_date_must_be_on_or")); return; }

        this.setState({ _loading: true, _error: '', _bundle: null, _ingest: null, _progress: { count: 0, page: 0, oldestDate: '' } }, () => this.forceUpdate());

        try {
            // 1) Full account history (oldest→newest). Cost-basis lots need every
            //    prior acquisition, so we never early-stop at the range start.
            const rawHistory = await this._fetchAllHistory(account.username, (count, page, oldestTs) => {
                this.setState({ _progress: { count, page, oldestDate: oldestTs ? fmtDate(oldestTs) : '' } }, () => this.forceUpdate());
            });

            // 2) Normalize + ingest. getAccountHistoryFull (account_history_api)
            //    returns AppBase ops — op = { type:"transfer_operation", value:{…} }
            //    with NAI asset objects ({amount,precision,nai}); the condenser
            //    fallback returns ["transfer", { amount:"10.000 PIXA", … }].
            //    _normalizeHistory rewrites AppBase ops to the [name, data] tuple
            //    the ingest destructures; cfg.naiMap lets parseAsset read the NAI
            //    amounts. Both paths then classify identically.
            const cfg = defaultConfig(account.username);
            cfg.naiMap = NAI_MAP;
            // Income timing is jurisdiction-dependent (DE recognises at inflow,
            // US at claim) and MUST be set before ingest — the two timings keep
            // different reward vops, so it cannot be fixed up afterwards.
            cfg.incomeRecognition = incomeTimingFor(_jurisdiction);
            const _ppv = this._effectiveVestingRate();     // PXA per VEST (share price)
            cfg.pixaPerVest = _ppv;                         // VESTS x this = PXP
            cfg.vestingPerPxa = _ppv > 0 ? 1 / _ppv : 1;    // kept for the placeholder warning
            // The rate is trustworthy if the user typed one or the live chain rate
            // loaded — suppresses the placeholder warning when 1:1 is genuinely correct.
            cfg.vestingRateReliable = (parseFloat(this.state._vestingRate) > 0) || (this.state._vestingRateAuto > 0);
            const history = this._normalizeHistory(rawHistory);
            const ingest = accountHistoryToTaxEvents(history, cfg);

            // 3) Engine: build the report bundle for the selected window.
            const pixaPerVest = this._effectiveVestingRate();   // PXA per VEST (share price)
            const profile = this._buildProfile();

            // Valuation: use the wallet's live price feed + selected currency so the
            // figures match what the wallet shows. Token prices come from api.prices
            // in USD; the fiatRate prop converts USD → the user's display currency.
            // If no live price is available, fall back to the demo provider (CHF).
            let pxaUsd = 0, pxsUsd = 0;
            try {
                const p = api.prices
                    ? await Promise.resolve(api.prices.get ? api.prices.get() : null)
                        .catch(() => (typeof api.prices.getSync === 'function' ? api.prices.getSync() : null))
                    : null;
                if (p) { pxaUsd = Number(p.pxaUsd) || 0; pxsUsd = Number(p.pxsUsd) || 0; }
            } catch (e) { /* fall back to the demo provider below */ }

            const haveLivePrices = pxaUsd > 0 && pxsUsd > 0;
            const prices = haveLivePrices
                ? new WalletPriceProvider({ pxaUsd, pxsUsd, fiatRate, fiatCurrency, pixaPerVest })
                : new PxsAnchoredPriceProvider();
            const fiatOverride = haveLivePrices ? (fiatCurrency || undefined) : undefined;

            const year = new Date(endMs).getUTCFullYear();
            const period = { start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString() };
            const bundle = buildAllReports(profile, ingest.events, year, prices, period, fiatOverride);

            // Cache everything needed to rebuild WITHOUT re-fetching, so labelling a
            // counterparty or entering a deduction just re-runs the engine in memory.
            const engineCtx = { prices, fiatOverride, year, period };
            this.setState({ _bundle: bundle, _ingest: ingest, _engineCtx: engineCtx, _loading: false, _step: 1 }, () => this.forceUpdate());
        } catch (e) {
            this._setError((e && e.message) || t("components.pixa_wallet_taxes_dialog.failed_to_generate_report"));
        }
    };

    /**
     * getAccountHistoryFull hits account_history_api, whose entries carry the op
     * as an AppBase object — op = { type:"transfer_operation", value:{…} } — and
     * asset fields as NAI objects, NOT the condenser 2-tuple [name, data] with
     * legacy string amounts the ingest destructures (line `const [name,data] =
     * entry.op`). Rewrite AppBase ops to that tuple in place; entries already in
     * tuple form (the condenser fallback path) pass through untouched. NAI amounts
     * inside `value` are left as-is — parseAsset decodes them via cfg.naiMap.
     */
    _normalizeHistory = (raw) => {
        if (!Array.isArray(raw)) return [];
        return raw.map((row) => {
            if (!Array.isArray(row) || row.length < 2) return row;
            const seq = row[0];
            const entry = row[1];
            if (!entry || typeof entry !== 'object') return row;
            const op = entry.op;
            // AppBase shape: op is a non-array object { type, value }.
            if (op && !Array.isArray(op) && typeof op === 'object' && typeof op.type === 'string') {
                const name = op.type.replace(/_operation$/, '');
                const data = op.value != null ? op.value : {};
                return [seq, Object.assign({}, entry, { op: [name, data] })];
            }
            return row;
        });
    };

    /**
     * Paginate the ENTIRE account history, HISTORY_PAGE rows per API call, newest
     * → oldest, all the way back to seq 0 (full cost basis needs every prior
     * acquisition — no date-based early stop). Returns raw history 2-tuples
     * `[[seq, { timestamp, op, ... }], ...]`; _normalizeHistory + the ingest then
     * handle either op shape.
     *
     * Prefers getAccountHistoryFull (account_history_api) — the path the wallet
     * relies on — and falls back to the condenser getAccountHistory per page if
     * Full yields nothing (older nodes / missing account_history_api). The
     * normalizer makes a mixed-shape result safe.
     *
     * UNFILTERED ON PURPOSE. An operation bitmask is faster, but on a backward
     * walk it is unsafe for a tax report: some nodes don't honour the filter and
     * return [] (the very reason the wallet keeps an unfiltered fallback), and
     * even when honoured a filtered window can end the walk early and silently
     * drop old acquisitions, corrupting cost basis. The ingest cheaply skips ops
     * it doesn't classify (votes, comments…), so over-fetching is harmless.
     *
     * HIVE pagination: (account, from, limit) returns [[seq, entry], ...]
     * ascending by seq; from=-1 means "latest", next (older) page starts at
     * (oldestSeq - 1) with limit ≤ from+1.
     */
    _fetchAllHistory = async (username, onProgress) => {
        const { api } = this.props;
        if (!api || !api.accounts) return [];

        const hasFull = typeof api.accounts.getAccountHistoryFull === 'function';
        const hasLegacy = typeof api.accounts.getAccountHistory === 'function';
        if (!hasFull && !hasLegacy) return [];

        // One page (older→newer slice ending at `from`), Full first then condenser.
        const fetchPage = async (from, limit) => {
            if (hasFull) {
                try {
                    const r = await api.accounts.getAccountHistoryFull({
                        account: username,
                        start: from,
                        limit,
                        includeReversible: true,
                    });
                    if (Array.isArray(r) && r.length > 0) return r;
                } catch (e) { /* fall through to condenser */ }
            }
            if (hasLegacy) {
                try {
                    const r = await api.accounts.getAccountHistory(username, from, limit);
                    if (Array.isArray(r)) return r;
                } catch (e) { /* ignore — treated as empty below */ }
            }
            return [];
        };

        let from = -1;
        let all = [];
        let page = 0;

        while (page < MAX_PAGES) {
            const limit = from === -1 ? HISTORY_PAGE : Math.min(HISTORY_PAGE, from + 1);
            if (from !== -1 && from < 0) break;

            const batch = await fetchPage(from, limit);
            if (!Array.isArray(batch) || batch.length === 0) break;

            all = all.concat(batch);
            page += 1;

            const oldest = batch[0];                                   // ascending by seq → [0] is oldest
            const oldestSeq = Array.isArray(oldest) ? oldest[0] : 0;
            const oldestEntry = Array.isArray(oldest) ? oldest[1] : oldest;
            const oldestTs = oldestEntry && oldestEntry.timestamp;

            if (typeof onProgress === 'function') onProgress(all.length, page, oldestTs);

            // Reached the very beginning of the account's history.
            if (oldestSeq <= 0) break;
            from = oldestSeq - 1;
        }
        return all;
    };

    /**
     * The engine emits wealth/transactions/operations per the jurisdiction
     * ruleset; the checkboxes further gate which sections are shown and exported.
     * Returns a bundle copy with unchecked sections nulled out.
     */
    _filteredBundle = (src) => {
        const { _reports } = this.state;
        const _bundle = src || this.state._bundle;
        if (!_bundle) return null;
        return {
            ..._bundle,
            wealth: _reports.wealth ? _bundle.wealth : undefined,
            transactions: _reports.transactions ? _bundle.transactions : undefined,
            operations: _reports.operations ? _bundle.operations : undefined,
        };
    };

    // Download a string (CSV/JSON) or binary (PDF Uint8Array) blob.
    _download = (data, filename, mime) => {
        if (typeof document === 'undefined') return;
        try {
            const isText = typeof data === 'string';
            const blob = new Blob([data], { type: isText ? mime + ';charset=utf-8' : mime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = filename;
            document.body.appendChild(a); a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 0);
        } catch (e) { /* ignore */ }
    };

    _rangeSlug = () => `${ymd(this.state._startDate)}_to_${ymd(this.state._endDate)}`;
    _fileBase = () => `pixa-tax-${this._rangeSlug()}-${this.state._jurisdiction}`;

    _exportCsv = () => {
        const b = this._filteredBundle(this._recompute());
        if (!b) return;
        try {
            const c = generateTaxReportCsvs(b);
            // One downloadable file, split into clearly-labelled sections. Each
            // section is itself a clean table an accountant can lift into a sheet.
            // Every translated fragment goes through csvCell, so a comma in a
            // translation stays inside its cell instead of creating a column.
            const head =
                csvCell(t("components.pixa_wallet_taxes_dialog.pixagram_tax_export", {
                    account: b.account,
                    jurisdiction: b.jurisdiction,
                    fiat: b.fiat
                })) +
                csvCell(t("components.pixa_wallet_taxes_dialog.generated_rules_prices", {
                    generatedAt: b.generatedAt.slice(0, 10),
                    rulesVersion: b.rulesVersion,
                    priceDataVersion: b.priceDataVersion
                })) +
                csvCell(t("components.pixa_wallet_taxes_dialog.all_times_iso_8601_utc_date_columns"));
            const sections = [
                [t("components.pixa_wallet_taxes_dialog.csv_wealth_holdings_at_reference_date"), c.wealth],
                [t("components.pixa_wallet_taxes_dialog.csv_per_token_summary"), c.tokens],
                [t("components.pixa_wallet_taxes_dialog.csv_disposals_swaps"), c.transactions],
                [t("components.pixa_wallet_taxes_dialog.csv_disposal_lots_cost_basis_audit"), c.lots],
                [t("components.pixa_wallet_taxes_dialog.csv_income_rewards_interest"), c.operations],
                [t("components.pixa_wallet_taxes_dialog.csv_account_movements"), c.movements],
            ];
            if (b.outboundByIntent && Object.keys(b.outboundByIntent).length) {
                sections.push([t("components.pixa_wallet_taxes_dialog.csv_transfers_out_classified_by_purpose"), c.outbound]);
            }
            if (b.offPlatformBasis && b.offPlatformBasis.length) {
                sections.push([t("components.pixa_wallet_taxes_dialog.csv_moved_to_your_exchange"), c.offplatform]);
            }
            const body = sections.map(([title, csv]) => `# ${title}\r\n${csv}`).join('\r\n\r\n');
            this._download(head + '\r\n' + body, `${this._fileBase()}.csv`, 'text/csv');
        } catch (e) { this._setError((e && e.message) || t("components.pixa_wallet_taxes_dialog.csv_export_failed")); }
    };

    _exportJson = () => {
        const b = this._filteredBundle(this._recompute());
        if (!b) return;
        const { _ingest } = this.state;
        const payload = {
            report: b,
            ingest: _ingest ? { skipped: _ingest.skipped, byRealm: _ingest.byRealm, warnings: _ingest.warnings } : null,
        };
        this._download(JSON.stringify(payload, null, 2), `${this._fileBase()}.json`, 'application/json');
    };

    // Pricing caveat text, shared by the on-screen footnote and the PDF.
    _pricingNote = (b) => (
        String(b.priceDataVersion || '').indexOf('wallet-live') === 0
            ? t(
                "components.pixa_wallet_taxes_dialog.values_use_the_wallets_current_price_a",
                {
                    fiat: b.fiat
                }
            )
            : t(
                "components.pixa_wallet_taxes_dialog.fiat_values_come_from_the_engines_pxs",
                {
                    priceDataVersion: b.priceDataVersion
                }
            )
    );

    _exportPdf = async () => {
        const b = this._filteredBundle(this._recompute());
        if (!b) return;
        try {
            const { _ingest } = this.state;
            const bytes = await generateTaxReportPdf(b, {
                csvFilename: `${this._fileBase()}.csv`,
                ingest: _ingest ? { skipped: _ingest.skipped, warnings: _ingest.warnings } : null,
                pricingNote: this._pricingNote(b),
                jurisdictionNote: t("components.pixa_wallet_taxes_dialog." + this._jurisdictionMeta().noteKey),
            });
            this._download(bytes, `${this._fileBase()}.pdf`, 'application/pdf');
        } catch (e) {
            this._setError((e && e.message) || t("components.pixa_wallet_taxes_dialog.pdf_export_failed"));
        }
    };

    _renderMetrics = () => {
        const { classes } = this.props;
        const { _bundle, _reports } = this.state;
        const fiat = _bundle.fiat;
        const w = _reports.wealth ? _bundle.wealth : null;
        const tx = _reports.transactions ? _bundle.transactions : null;
        const o = _reports.operations ? _bundle.operations : null;

        const Metric = ({ label, value, sub }) => (
            <div className={classes.metric}>
                <div className={classes.metricLabel}>{label}</div>
                <div className={classes.metricValue}>{value}</div>
                {sub ? <div className={classes.metricSub}>{sub}</div> : null}
            </div>
        );

        return (
            <div className={classes.metricsGrid}>
                {w ? <Metric label={t("components.pixa_wallet_taxes_dialog.net_wealth", {
                    refDate: w.refDate
                })} value={`${fmtFiat(w.totalFiat)} ${fiat}`} sub={t("components.pixa_wallet_taxes_dialog.asset_count", { asset: { asset: w.lines.length } })} /> : null}
                {tx ? <Metric label={t("components.pixa_wallet_taxes_dialog.taxable_gains")} value={`${fmtFiat(tx.taxableGainFiat)} ${fiat}`} sub={t("components.pixa_wallet_taxes_dialog.total_disposal", {
                    fmtFiat: fmtFiat(tx.totalGainFiat),
                    disposal: { disposal: tx.lines.length },
                })} /> : null}
                {o ? <Metric label={t("components.pixa_wallet_taxes_dialog.reward_interest_income")} value={`${fmtFiat(o.totalIncomeFiat)} ${fiat}`} sub={t("components.pixa_wallet_taxes_dialog.receipt_count", { receipt: { receipt: o.lines.length } })} /> : null}
            </div>
        );
    };

    _renderSection = (id, title, count, body) => {
        const { classes } = this.props;
        const open = this.state._openSection === id;
        return (
            <div className={classes.accordion}>
                <div className={classes.accordionHeader} onClick={() => this._toggleExpanded(id)}>
                    <Typography variant="subtitle2" style={{ color: "#cfcfcf", fontWeight: 600 }}>
                        {title}{count != null ? <span style={{ color: "#666", fontWeight: 400 }}>{`  ${count}`}</span> : null}
                    </Typography>
                    <ExpandMoreRounded className={"chev" + (open ? " open" : "")} />
                </div>
                <Collapse in={open}><div className={classes.accordionBody}>{body}</div></Collapse>
            </div>
        );
    };

    _renderReport = () => {
        const { classes } = this.props;
        const { _bundle, _ingest, _reports, _startDate, _endDate } = this.state;
        const fiat = _bundle.fiat;
        const w = _reports.wealth ? _bundle.wealth : null;
        const tx = _reports.transactions ? _bundle.transactions : null;
        const o = _reports.operations ? _bundle.operations : null;
        const movements = (_bundle.movements) || [];

        // Transfer ledger (received & sent) for the selected window, taken from
        // the classified events. The engine's Transactions report is the taxable
        // subset (disposals); this restores the full in/out view.
        const sMs = dayStartMs(_startDate), eMs = dayEndMs(_endDate);
        const inWindow = (ts) => { const m = tsToMs(ts); return Number.isFinite(m) && m >= sMs && m <= eMs; };
        const transfers = (_reports.transactions && _ingest)
            ? _ingest.events.filter(ev => (ev.category === 'transfer_in' || ev.category === 'transfer_out') && inWindow(ev.ts))
            : [];

        // Everything seen in the history that wasn't booked into the figures —
        // surfaced in full so nothing is silently ignored.
        const skipped = (_ingest && _ingest.skipped) || {};
        const skippedEntries = Object.keys(skipped)
            .sort((a, b) => skipped[b] - skipped[a])
            .map(k => ({ name: k, count: skipped[k] }));
        const skippedTotal = skippedEntries.reduce((s, e) => s + e.count, 0);
        const engineWarnings = (_bundle.warnings) || [];
        const ingestWarnings = (_ingest && _ingest.warnings) || [];
        const reviewCount = engineWarnings.length + ingestWarnings.length + (skippedEntries.length > 0 ? 1 : 0);

        const rangeText = (tx && `${tx.periodStart} → ${tx.periodEnd}`)
            || (o && `${o.periodStart} → ${o.periodEnd}`)
            || (w && t("components.pixa_wallet_taxes_dialog.as_at", { refDate: w.refDate })) || '';

        return (
            <React.Fragment>
                <Typography className={classes.sectionLabel} style={{ marginTop: 20 }}>{t("components.pixa_wallet_taxes_dialog.summary", {
                    rangeText: rangeText ? ` — ${rangeText}` : '',
                    jurisdiction: _bundle.jurisdiction,
                    fiat: fiat
                })}</Typography>
                {this._renderMetrics()}
                {_reports.transactions && transfers.length > 0 && this._renderSection('transfers', t("components.pixa_wallet_taxes_dialog.section_transfers"), transfers.length, (
                    <div className={classes.reportList}>
                        <List dense>
                            {transfers.slice(0, VIEW_CAP).map((ev, i) => {
                                const leg = ev.legs[0] || {};
                                const incoming = ev.category === 'transfer_in';
                                return (
                                    <ListItem key={i}>
                                        <div style={{ marginRight: 12, display: "flex" }}>
                                            {incoming
                                                ? <CallReceivedRounded style={{ opacity: 0.7, color: "#c0c0c0" }} />
                                                : <CallMadeRounded style={{ opacity: 0.7, color: "#8a8a8a" }} />}
                                        </div>
                                        <ListItemText classes={{ primary: classes.rowMono }}
                                                      primary={`${incoming ? '+' : '−'}${fmtQty(leg.amount)} ${leg.asset}  ·  @${ev.counterparty || '—'}${ev.counterpartyIsOwn ? ' (own)' : ''}`}
                                                      secondary={`${fmtDate(ev.ts)}${ev.memo ? ' · ' + ev.memo : ''}${ev.crossesBoundary ? ' · ' + ev.realm : ''}`} />
                                    </ListItem>
                                );
                            })}
                        </List>
                        {capNote(transfers.length)}
                        <Typography style={{ color: "#6f6f6f", fontSize: "0.72rem", padding: "0px 16px 10px" }}>
                            {t(
                                "components.pixa_wallet_taxes_dialog.full_transfer_ledger_for_the_period_received"
                            )}
                        </Typography>
                    </div>
                ))}
                {w && this._renderSection('wealth', t("components.pixa_wallet_taxes_dialog.section_wealth_statement"), w.lines.length, (
                    <div className={classes.reportList}>
                        {w.lines.length === 0 && <div className={classes.empty}>{t(
                            "components.pixa_wallet_taxes_dialog.no_holdings_reconstructed_at_the_reference_date"
                        )}</div>}
                        <List dense>
                            {w.lines.map((l, i) => (
                                <ListItem key={i}>
                                    <ListItemText classes={{ primary: classes.rowMono }}
                                                  primary={`${fmtQty(l.qty)} ${l.asset}  ·  ${fmtFiat(l.valueFiat)} ${fiat}`}
                                                  secondary={`@ ${fmtQty(l.fiatPerUnit)} ${fiat} · ${l.source}`} />
                                </ListItem>
                            ))}
                        </List>
                        {w.note ? <Typography style={{ color: "#6f6f6f", fontSize: "0.72rem", padding: "0px 16px 10px" }}>{w.note}</Typography> : null}
                    </div>
                ))}
                {_bundle.tokenSummary && _bundle.tokenSummary.length > 0 && this._renderSection('tokens', t("components.pixa_wallet_taxes_dialog.section_per_token_summary"), _bundle.tokenSummary.length, (
                    <div className={classes.reportList}>
                        <List dense>
                            {_bundle.tokenSummary.map((ts, i) => (
                                <ListItem key={i}>
                                    <ListItemText classes={{ primary: classes.rowMono }}
                                                  primary={t("components.pixa_wallet_taxes_dialog.closing_line", { asset: ts.asset, qty: fmtQty(ts.closingQty) }) + (ts.closingValueFiat ? `  (${fmtFiat(ts.closingValueFiat)} ${fiat})` : '')}
                                                  secondary={t("components.pixa_wallet_taxes_dialog.opening_in_out", {
                                                      fmtQty: fmtQty(ts.openingQty),
                                                      fmtQty_2: fmtQty(ts.receivedQty),
                                                      fmtQty_3: fmtQty(ts.disposedQty),
                                                  })} />
                                </ListItem>
                            ))}
                        </List>
                        <Typography style={{ color: "#6f6f6f", fontSize: "0.72rem", padding: "0px 16px 10px" }}>
                            {t(
                                "components.pixa_wallet_taxes_dialog.opening_received_disposed_closing_per_token_open"
                            )}
                        </Typography>
                    </div>
                ))}
                {tx && this._renderSection('transactions', t("components.pixa_wallet_taxes_dialog.section_disposals_swaps_taxable"), tx.lines.length, (
                    <div className={classes.reportList}>
                        {tx.lines.length === 0 && <div className={classes.empty}>{t(
                            "components.pixa_wallet_taxes_dialog.no_taxable_disposals_in_this_period_received"
                        )}</div>}
                        <List dense>
                            {tx.lines.slice(0, VIEW_CAP).map((l, i) => (
                                <ListItem key={i}>
                                    <div style={{ marginRight: 12, display: "flex" }}>
                                        {(l.category === 'swap' || l.category === 'market_fill')
                                            ? <SyncAltRounded style={{ opacity: 0.7 }} />
                                            : <CallMadeRounded style={{ opacity: 0.7, color: "#8a8a8a" }} />}
                                    </div>
                                    <ListItemText classes={{ primary: classes.rowMono }}
                                                  primary={t("components.pixa_wallet_taxes_dialog.gain_line", { qty: fmtQty(l.qtyOut), asset: l.asset, gain: fmtFiat(l.gainFiat), fiat: fiat }) + (l.taxable ? '' : t("components.pixa_wallet_taxes_dialog.tax_free_suffix"))}
                                                  secondary={t("components.pixa_wallet_taxes_dialog.proceeds_basis", {
                                                      fmtDate: fmtDate(l.ts),
                                                      category: l.category,
                                                      fmtFiat: fmtFiat(l.proceedsFiat),
                                                      fmtFiat_2: fmtFiat(l.basisFiat)
                                                  })} />
                                </ListItem>
                            ))}
                        </List>
                        {capNote(tx.lines.length)}
                        <Typography style={{ color: "#cfcfcf", fontSize: "0.8rem", padding: "4px 16px 2px", fontFamily: "monospace" }}>{t("components.pixa_wallet_taxes_dialog.total_gain_taxable", {
                            fmtFiat: fmtFiat(tx.totalGainFiat),
                            fiat: fiat,
                            fmtFiat_2: fmtFiat(tx.taxableGainFiat),
                            fiat_2: fiat,
                            fmtFiat_3: tx.splitByTerm ? t("components.pixa_wallet_taxes_dialog.short_long", {
                                fmtFiat: fmtFiat(tx.shortTermGainFiat),
                                fmtFiat_2: fmtFiat(tx.longTermGainFiat)
                            }) : '',
                            fmtFiat_4: tx.exemptGainFiat ? t("components.pixa_wallet_taxes_dialog.tax_free", {
                                fmtFiat: fmtFiat(tx.exemptGainFiat),
                                fiat: fiat
                            }) : '',
                            fmtFiat_5: tx.disallowedLossesFiat ? t("components.pixa_wallet_taxes_dialog.losses_disregarded", {
                                fmtFiat: fmtFiat(tx.disallowedLossesFiat),
                                fiat: fiat
                            }) : ''
                        })}</Typography>
                        {tx.deductionSteps ? (
                            <Typography style={{ color: "#9a9a9a", fontSize: "0.72rem", padding: "0 16px 2px", fontFamily: "monospace" }}>
                                {tx.deductionSteps.map((s, i) => `${i ? '→ ' : ''}${s.label} ${fmtFiat(s.value)}`).join('  ')}
                            </Typography>
                        ) : null}
                        <Typography style={{ color: "#e8e8e8", fontSize: "0.84rem", padding: "2px 16px 10px", fontFamily: "monospace", fontWeight: 600 }}>{t("components.pixa_wallet_taxes_dialog.taxable_amount", {
                            fmtFiat: fmtFiat(tx.taxableAmountFiat),
                            fiat: fiat,
                            fmtFiat_2: tx.lossCarryforwardOutFiat ? t("components.pixa_wallet_taxes_dialog.loss_to_carry_forward", {
                                fmtFiat: fmtFiat(tx.lossCarryforwardOutFiat),
                                fiat: fiat
                            }) : ''
                        })}</Typography>
                    </div>
                ))}
                {_bundle.outboundByIntent && Object.keys(_bundle.outboundByIntent).length > 0 && (() => {
                    const ob = _bundle.outboundByIntent;
                    const ORDER = ['payment', 'own_exchange', 'own', 'gift', 'charity'];
                    const LABEL = { payment: t("components.pixa_wallet_taxes_dialog.outbound_payments_sales"), own_exchange: t("components.pixa_wallet_taxes_dialog.movement_sent_to_your_exchange"), own: t("components.pixa_wallet_taxes_dialog.outbound_to_your_own_wallet"), gift: t("components.pixa_wallet_taxes_dialog.outbound_gifts"), charity: t("components.pixa_wallet_taxes_dialog.outbound_charity_donations") };
                    const treat = (k, x) => k === 'payment' ? t("components.pixa_wallet_taxes_dialog.treat_taxable_disposal") : k === 'own_exchange' ? t("components.pixa_wallet_taxes_dialog.treat_sale_is_off_platform") : k === 'own' ? t("components.pixa_wallet_taxes_dialog.treat_internal_not_a_disposal") : k === 'gift' ? (x ? t("components.pixa_wallet_taxes_dialog.treat_disposal_at_market_value") : t("components.pixa_wallet_taxes_dialog.treat_not_a_disposal_here")) : k === 'charity' ? (x ? t("components.pixa_wallet_taxes_dialog.treat_treated_as_a_disposal") : t("components.pixa_wallet_taxes_dialog.treat_exempt_donation")) : '';
                    const keys = ORDER.filter(k => ob[k]).concat(Object.keys(ob).filter(k => !ORDER.includes(k)));
                    const total = keys.reduce((s, k) => s + ob[k].count, 0);
                    return this._renderSection('outbound', t("components.pixa_wallet_taxes_dialog.section_outbound_by_purpose"), total, (
                        <div className={classes.reportList}>
                            <List dense>
                                {keys.map(k => {
                                    const s = ob[k];
                                    const sent = Object.entries(s.byAsset).map(([a, q]) => `${(+q).toFixed(3)} ${a}`).join('  ·  ');
                                    return (
                                        <ListItem key={k} style={{ paddingTop: 4, paddingBottom: 4 }}>
                                            <ListItemText
                                                primary={
                                                    <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                                        <span style={{ color: "#e0e0e0" }}>{LABEL[k] || k}<span style={{ color: "#7a7a7a", fontSize: "0.74rem" }}>{`  · ${s.count}×`}</span></span>
                                                        <span style={{ color: "#e0e0e0", fontFamily: "monospace", fontSize: "0.8rem", whiteSpace: "nowrap" }}>{`${fmtFiat(s.valueFiat || 0)} ${fiat}`}</span>
                                                    </span>}
                                                secondary={<span style={{ color: s.taxable ? "#e8e8e8" : "#888", fontFamily: "monospace", fontSize: "0.76rem" }}>{`${sent} — ${treat(k, s.taxable)}`}</span>} />
                                        </ListItem>
                                    );
                                })}
                            </List>
                        </div>
                    ));
                })()}
                {o && this._renderSection('operations', t("components.pixa_wallet_taxes_dialog.section_operations_income"), o.lines.length, (
                    <div className={classes.reportList}>
                        {o.lines.length === 0 && <div className={classes.empty}>{t("components.pixa_wallet_taxes_dialog.no_income_events_in_this_period")}</div>}
                        <List dense>
                            {o.lines.slice(0, VIEW_CAP).map((l, i) => (
                                <ListItem key={i}>
                                    <div style={{ marginRight: 12, display: "flex" }}>
                                        <EmojiEventsRounded style={{ opacity: 0.7, color: "#b0b0b0" }} />
                                    </div>
                                    <ListItemText classes={{ primary: classes.rowMono }}
                                                  primary={`+${fmtQty(l.qtyIn)} ${l.asset}  ·  ${fmtFiat(l.fmvFiat)} ${fiat}`}
                                                  secondary={`${fmtDate(l.ts)} · ${l.category} · ${l.source}`} />
                                </ListItem>
                            ))}
                        </List>
                        {capNote(o.lines.length)}
                        <Typography style={{ color: "#cfcfcf", fontSize: "0.8rem", padding: "4px 16px 10px", fontFamily: "monospace" }}>{t("components.pixa_wallet_taxes_dialog.total_income", {
                            fmtFiat: fmtFiat(o.totalIncomeFiat),
                            fiat: fiat,
                            fmtFiat_2: o.deferredIncomeFiat ? t("components.pixa_wallet_taxes_dialog.not_taxed_at_receipt", {
                                fmtFiat: fmtFiat(o.deferredIncomeFiat),
                                fiat: fiat
                            }) : ''
                        })}</Typography>
                    </div>
                ))}
                {movements.length > 0 && this._renderSection('movements', t("components.pixa_wallet_taxes_dialog.section_account_movements"), movements.length, (
                    <div className={classes.reportList}>
                        <List dense>
                            {movements.slice(0, VIEW_CAP).map((m, i) => {
                                const label = movementLabel(m.kind, m.direction);
                                return (
                                    <ListItem key={i}>
                                        <div style={{ marginRight: 12, display: "flex" }}>
                                            {m.direction === 'in'
                                                ? <CallReceivedRounded style={{ opacity: 0.7, color: "#c0c0c0" }} />
                                                : <CallMadeRounded style={{ opacity: 0.7, color: "#8a8a8a" }} />}
                                        </div>
                                        <ListItemText classes={{ primary: classes.rowMono }}
                                                      primary={`${m.direction === 'out' ? '\u2212' : '+'}${fmtQty(m.amount)} ${m.asset}  ·  ${label}`}
                                                      secondary={`${fmtDate(m.ts)}${m.note ? ' · ' + m.note : ''}`} />
                                    </ListItem>
                                );
                            })}
                        </List>
                        {capNote(movements.length)}
                        <Typography style={{ color: "#7a7a7a", fontSize: "0.74rem", padding: "4px 16px 10px", lineHeight: 1.5 }}>
                            {t(
                                "components.pixa_wallet_taxes_dialog.not_taxable_disposals_or_income_proposal_fees"
                            )}
                        </Typography>
                    </div>
                ))}
                {reviewCount > 0 && this._renderSection('review', t("components.pixa_wallet_taxes_dialog.section_review_notes"), reviewCount, (
                    <div className={classes.reportList} style={{ padding: "8px 16px" }}>
                        {engineWarnings.map((wn, i) => (
                            <Typography key={'e' + i} style={{ color: "#9a9a9a", fontSize: "0.8rem", lineHeight: 1.5 }}>• {wn}</Typography>
                        ))}
                        {ingestWarnings.map((wn, i) => (
                            <Typography key={'i' + i} style={{ color: "#9a9a9a", fontSize: "0.8rem", lineHeight: 1.5 }}>• {wn}</Typography>
                        ))}
                        {skippedEntries.length > 0 && (
                            <div style={{ marginTop: engineWarnings.length || ingestWarnings.length ? 10 : 0 }}>
                                <Typography style={{ color: "#bdbdbd", fontSize: "0.8rem", lineHeight: 1.5 }}>{t(
                                    "components.pixa_wallet_taxes_dialog.seen_in_history_but_not_booked_into",
                                    {
                                        skippedTotal: skippedTotal.toLocaleString(getLocaleCode())
                                    }
                                )}</Typography>
                                <Typography style={{ color: "#8a8a8a", fontSize: "0.74rem", lineHeight: 1.6, fontFamily: "monospace", marginTop: 4, wordBreak: "break-word" }}>
                                    {skippedEntries.map(e => `${e.name} ×${e.count}`).join('   ·   ')}
                                </Typography>
                            </div>
                        )}
                    </div>
                ))}
                <Typography className={classes.note}>{t(
                    "components.pixa_wallet_taxes_dialog.reconstructed_from_classified_events",
                    {
                        ingest: (_ingest && _ingest.events.length) || 0,
                        text: ' ',

                        fiat: String(_bundle.priceDataVersion || '').indexOf('wallet-live') === 0
                            ? t(
                                "components.pixa_wallet_taxes_dialog.values_use_the_wallets_current_price_a",
                                {
                                    fiat: _bundle.fiat
                                }
                            )
                            : t(
                                "components.pixa_wallet_taxes_dialog.fiat_values_come_from_the_engines_pxs",
                                {
                                    priceDataVersion: _bundle.priceDataVersion
                                }
                            ),

                        text_2: ' ',
                        note: t("components.pixa_wallet_taxes_dialog." + this._jurisdictionMeta().noteKey)
                    }
                )}</Typography>
            </React.Fragment>
        );
    };

    _renderProgress = () => {
        const { classes } = this.props;
        const { _progress } = this.state;
        return (
            <div className={classes.progressWrap}>
                <CircularProgress size={34} style={{ color: "#d0d0d0" }} />
                <Typography style={{ color: "#bdbdbd", marginTop: 14 }}>{t("components.pixa_wallet_taxes_dialog.fetching_transactions", {
                    count: _progress.count > 0 ? ' ' + t("components.pixa_wallet_taxes_dialog.operations_progress", { count: _progress.count.toLocaleString(getLocaleCode()) }) : ''
                })}</Typography>
                <Typography style={{ color: "#6f6f6f", fontSize: "0.75rem", marginTop: 4 }}>
                    {_progress.page > 0 ? t("components.pixa_wallet_taxes_dialog.page_1000_per_request", {
                        page: { page: _progress.page },
                    }) : t("components.pixa_wallet_taxes_dialog.starting")}
                    {_progress.oldestDate ? ' · ' + t("components.pixa_wallet_taxes_dialog.reached_date", { oldestDate: _progress.oldestDate }) : ''}
                </Typography>
                <div style={{ maxWidth: 320, margin: "16px auto 0" }}>
                    <LinearProgress style={{ backgroundColor: "#1a1a1a", borderRadius: 4 }} />
                </div>
            </div>
        );
    };

    // Refine panel (step 1) — the two deduction figures plus bulk import/export of
    // saved counterparty labels. Works before any fetch: everything persists per
    // account, and the labels are applied when step 2 completes. The per-send
    // classification itself IS step 2 (_renderClassify).
    _renderRefine = () => {
        const { classes, fiatCurrency } = this.props;
        const { _showRefine, _lossCarryforward, _exemptionUsed, _loading } = this.state;
        const cur = fiatCurrency || 'USD';
        const tf = (props) => (
            <TextField margin="dense" variant="outlined" type="number" disabled={_loading}
                       className={classes.pickerField} InputLabelProps={{ shrink: true }} {...props} />
        );
        return (
            <div className={classes.greyPanel}>
                <Typography
                    onClick={() => this.setState(p => ({ _showRefine: !p._showRefine }), () => this.forceUpdate())}
                    style={{ color: "#cfcfcf", fontSize: "0.9rem", cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}
                ><T
                    k="components.pixa_wallet_taxes_dialog.0_0_refine_deductions_saved_labels"
                    vars={{
                        text: _showRefine ? '\u25be' : '\u25b8'
                    }}
                    slots={[<span style={{ fontSize: "0.7rem" }} key="0" />]} /></Typography>
                <Collapse in={_showRefine}>
                    <div style={{ padding: "10px 2px 2px" }}>
                        <Typography style={{ color: "#8a8a8a", fontSize: "0.72rem", lineHeight: 1.5, margin: "0 0 6px" }}>
                            {t(
                                "components.pixa_wallet_taxes_dialog.deductions_optional_losses_you_carried_forward_f"
                            )}
                        </Typography>
                        <div style={{ display: "flex", gap: 8 }}>
                            {tf({
                                label: t("components.pixa_wallet_taxes_dialog.losses_carried_forward", {
                                    cur: cur
                                }), value: _lossCarryforward,
                                onChange: e => this._setDeduction('_lossCarryforward', e.target.value), style: { flex: 1 },
                            })}
                            {tf({
                                label: t("components.pixa_wallet_taxes_dialog.exemption_already_used", {
                                    cur: cur
                                }), value: _exemptionUsed,
                                onChange: e => this._setDeduction('_exemptionUsed', e.target.value), style: { flex: 1 },
                            })}
                        </div>
                        <Typography style={{ color: "#8a8a8a", fontSize: "0.72rem", lineHeight: 1.5, margin: "12px 0 2px" }}>
                            {t(
                                "components.pixa_wallet_taxes_dialog.send_labels_are_assigned_in_the_classify"
                            )}
                        </Typography>
                        <div style={{ display: "flex", gap: 8, margin: "4px 0 0" }}>
                            <Button size="small" onClick={this._exportIntentsCsv} disabled={_loading}
                                    style={{ color: "#bdbdbd", textTransform: "none", fontSize: "0.74rem" }}>
                                {t("components.pixa_wallet_taxes_dialog.export_list_csv")}
                            </Button>
                            <Button size="small" component="label" disabled={_loading}
                                    style={{ color: "#bdbdbd", textTransform: "none", fontSize: "0.74rem" }}>
                                {t("components.pixa_wallet_taxes_dialog.import_csv")}
                                <input type="file" accept=".csv,text/csv" hidden
                                       onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; this._importIntentsCsv(f); }} />
                            </Button>
                        </div>
                    </div>
                </Collapse>
            </div>
        );
    };

    // Step 2 — Classify. One row per counterparty the engine discovered; each send
    // is a taxable sale unless labelled otherwise. Completing the step (bottom-bar
    // "Apply & continue") runs the recompute with these labels and the deductions.
    _renderClassify = () => {
        const { classes, account } = this.props;
        const { _ingest, _intents, _loading } = this.state;
        if (!_ingest) return null;
        const cps = summarizeCounterparties(_ingest.events, [account.username]);
        return (
            <React.Fragment>
                <Typography style={{ color: "#8a8a8a", fontSize: "0.85rem", lineHeight: 1.5, marginTop: 16 }}>
                    {t("components.pixa_wallet_taxes_dialog.say_what_each_outbound_send_was_so")}
                </Typography>
                <div className={classes.greyPanel}>
                    {cps.length === 0 ? (
                        <Typography style={{ color: "#8a8a8a", fontSize: "0.82rem", padding: "4px 0" }}>
                            {t(
                                "components.pixa_wallet_taxes_dialog.nothing_to_classify_no_outbound_transfers_to"
                            )}
                        </Typography>
                    ) : cps.map(c => {
                        const sent = Object.entries(c.byAsset).map(([a, q]) => `${(+q).toFixed(0)} ${a}`).join(' + ');
                        const val = (_intents && _intents[c.counterparty]) || c.suggestedIntent;
                        const meta = INTENT_OPTIONS.find(o => o[0] === val);
                        return (
                            <div key={c.counterparty} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                                    <Typography style={{ color: "#dcdcdc", fontFamily: "monospace", fontSize: "0.8rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@{c.counterparty}</Typography>
                                    <Typography style={{ color: "#7a7a7a", fontSize: "0.68rem" }}>{t("components.pixa_wallet_taxes_dialog.sends_count", { send: { send: c.sends } })} · {sent}{meta ? ` — ${t("components.pixa_wallet_taxes_dialog." + meta[2])}` : ''}</Typography>
                                </div>
                                <Select
                                    disableUnderline className={classes.select} disabled={_loading}
                                    value={val} style={{ minWidth: 180 }}
                                    onChange={(e) => this._setIntent(c.counterparty, e.target.value)}
                                    MenuProps={{ PaperProps: { style: { backgroundColor: "#151515", color: "#e0e0e0" } } }}
                                >
                                    {INTENT_OPTIONS.map(([id, labelKey]) => <MenuItem key={id} value={id}>{t("components.pixa_wallet_taxes_dialog." + labelKey)}</MenuItem>)}
                                </Select>
                            </div>
                        );
                    })}
                </div>
            </React.Fragment>
        );
    };

    _renderAdvanced = () => {
        const { classes, fiatCurrency } = this.props;
        const { _showAdvanced, _vestingRate, _vestingRateAuto, _openingLots, _loading } = this.state;
        const cur = fiatCurrency || 'USD';
        const tf = (props) => (
            <TextField
                margin="dense" variant="outlined" type="number"
                disabled={_loading}
                className={classes.pickerField}
                InputLabelProps={{ shrink: true }}
                {...props}
            />
        );
        return (
            <div className={classes.greyPanel}>
                <Typography
                    onClick={() => this.setState(p => ({ _showAdvanced: !p._showAdvanced }), () => this.forceUpdate())}
                    style={{ color: "#cfcfcf", fontSize: "0.9rem", cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}
                ><T
                    k="components.pixa_wallet_taxes_dialog.0_0_advanced_opening_balances_vesting_rate"
                    vars={{
                        text: _showAdvanced ? '\u25be' : '\u25b8'
                    }}
                    slots={[<span style={{ fontSize: "0.7rem" }} key="0" />]} /></Typography>
                <Collapse in={_showAdvanced}>
                    <div style={{ padding: "12px 2px 2px" }}>
                        <Typography style={{ color: "#7a7a7a", fontSize: "0.72rem", lineHeight: 1.5, marginBottom: 10 }}>{t(
                            "components.pixa_wallet_taxes_dialog.opening_balances_are_tokens_you_already_held",
                            {
                                cur: cur
                            }
                        )}</Typography>
                        {['PXA', 'PXS', 'PXP'].map(asset => (
                            <div key={asset} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 2 }}>
                                <Typography style={{ color: "#bdbdbd", width: 40, fontFamily: "monospace", fontSize: "0.8rem" }}>{asset}</Typography>
                                {tf({ label: t("components.pixa_wallet_taxes_dialog.opening_qty"), value: _openingLots[asset].qty, onChange: e => this._setOpeningLot(asset, 'qty', e.target.value), style: { flex: 1 } })}
                                {tf({ label: t("components.pixa_wallet_taxes_dialog.cost_cur", { cur }), value: _openingLots[asset].cost, onChange: e => this._setOpeningLot(asset, 'cost', e.target.value), style: { flex: 1 } })}
                            </div>
                        ))}
                        <div style={{ marginTop: 14 }}>
                            {tf({
                                label: t("components.pixa_wallet_taxes_dialog.vesting_share_price_pxa_per_vest"),
                                placeholder: _vestingRateAuto > 0 ? _vestingRateAuto.toFixed(9).replace(/0+$/, '').replace(/\.$/, '') : t("components.pixa_wallet_taxes_dialog.auto"),
                                onChange: e => this._setVestingRate(e.target.value),
                                fullWidth: true,
                                helperText: _vestingRateAuto > 0
                                    ? t(
                                        "components.pixa_wallet_taxes_dialog.prefilled_from_the_chain_1_vest_pxa",
                                        {
                                            _vestingRateAuto: _vestingRateAuto.toFixed(9).replace(/0+$/, '').replace(/\.$/, ''),
                                            _vestingRateAuto_2: (_vestingRateAuto * 1e6).toLocaleString('en-US', { maximumFractionDigits: 3 })
                                        }
                                    )
                                    : t("components.pixa_wallet_taxes_dialog.pxa_per_vest_helper"),
                            })}
                        </div>
                    </div>
                </Collapse>
            </div>
        );
    };

    render() {
        const { classes, open, onClose } = this.props;
        const { _startDate, _endDate, _jurisdiction, _reports, _loading, _error, _bundle, _step } = this.state;
        const anyReport = _reports.wealth || _reports.transactions || _reports.operations;

        // Step 1 — Options: everything the engine needs before fetching.
        const stepOptions = (
            <React.Fragment>
                <Typography style={{ color: "#8a8a8a", fontSize: "0.85rem", lineHeight: 1.5 }}>
                    {t("components.pixa_wallet_taxes_dialog.generate_a_record_of_your_on_chain")}
                </Typography>

                <Typography className={classes.sectionLabel}>{t("components.pixa_wallet_taxes_dialog.date_range")}</Typography>
                <MuiPickersUtilsProvider utils={DateFnsUtils}>
                    <div className={classes.dateRow}>
                        <KeyboardDatePicker
                            margin="dense"
                            inputVariant="outlined"
                            id="tax-start-date"
                            label={t("components.pixa_wallet_taxes_dialog.from")}
                            format="MM/dd/yyyy"
                            fullWidth
                            disableFuture
                            className={classes.pickerField}
                            value={_startDate}
                            disabled={_loading}
                            onChange={(date) => this.setState({ _startDate: date }, () => this.forceUpdate())}
                            KeyboardButtonProps={{ 'aria-label': 'change start date' }}
                        />
                        <KeyboardDatePicker
                            margin="dense"
                            inputVariant="outlined"
                            id="tax-end-date"
                            label={t("components.pixa_wallet_taxes_dialog.to")}
                            format="MM/dd/yyyy"
                            fullWidth
                            disableFuture
                            minDate={_startDate || undefined}
                            className={classes.pickerField}
                            value={_endDate}
                            disabled={_loading}
                            onChange={(date) => this.setState({ _endDate: date }, () => this.forceUpdate())}
                            KeyboardButtonProps={{ 'aria-label': 'change end date' }}
                        />
                    </div>
                </MuiPickersUtilsProvider>

                <div className={classes.sideBySide}>
                    <div>
                        <Typography className={classes.sectionLabel}>{t("components.pixa_wallet_taxes_dialog.jurisdiction")}</Typography>
                        <Select
                            fullWidth
                            disableUnderline className={classes.select}
                            value={_jurisdiction} disabled={_loading}
                            onChange={(e) => this.setState({ _jurisdiction: e.target.value }, () => this.forceUpdate())}
                            MenuProps={{ PaperProps: { style: { backgroundColor: "#151515", color: "#e0e0e0" } } }}
                        >
                            {JURISDICTIONS.map(j => <MenuItem key={j.id} value={j.id}>{t("components.pixa_wallet_taxes_dialog." + j.labelKey)}</MenuItem>)}
                        </Select>
                    </div>
                    <div>
                        <Typography className={classes.sectionLabel}>{t("components.pixa_wallet_taxes_dialog.reports_to_include")}</Typography>
                        <FormGroup className={classes.checkGroup}>
                            {REPORT_TYPES.map(r => (
                                <FormControlLabel
                                    key={r.id}
                                    control={
                                        <Checkbox
                                            checked={!!_reports[r.id]}
                                            disabled={_loading}
                                            onChange={() => this._toggleReport(r.id)}
                                        />
                                    }
                                    label={t("components.pixa_wallet_taxes_dialog." + r.labelKey)}
                                />
                            ))}
                        </FormGroup>
                    </div>
                </div>

                {this._renderAdvanced()}
                {this._renderRefine()}

                <Typography className={classes.note} style={{ marginTop: 16 }}>
                    {t("components.pixa_wallet_taxes_dialog." + this._jurisdictionMeta().noteKey)}
                </Typography>
            </React.Fragment>
        );

        return (
            <Dialog open={!!open} onClose={onClose} scroll="paper" classes={{ paper: classes.paper }}>
                <div className={classes.header}>
                    <Typography component="h2" variant="h6" className={classes.title}>
                        <DescriptionRounded /> {t("components.pixa_wallet_taxes_dialog.tax_report")}
                    </Typography>
                    <IconButton onClick={onClose} aria-label={t("words.close")} style={{ color: "#9a9a9a" }}>
                        <CloseRounded />
                    </IconButton>
                </div>
                <Stepper activeStep={_step} className={classes.stepper}>
                    <Step completed={_step > 0}>
                        <StepLabel>{t("words.options", {TUC: true})}</StepLabel>
                    </Step>
                    <Step completed={_step > 1}>
                        <StepLabel>{t("words.classify", {TUC: true})}</StepLabel>
                    </Step>
                    <Step completed={false}>
                        <StepLabel>{t("words.export", {TUC: true})}</StepLabel>
                    </Step>
                </Stepper>
                <DialogContent className={classes.content}>
                    {_error ? (
                        <Typography style={{ color: "#cfcfcf", marginBottom: 12, fontSize: "0.85rem" }}>{_error}</Typography>
                    ) : null}

                    {_loading
                        ? this._renderProgress()
                        : (_step === 0
                            ? stepOptions
                            : (_step === 1
                                ? this._renderClassify()
                                : (_bundle ? this._renderReport() : null)))}
                </DialogContent>
                <DialogActions style={{ padding: "12px 24px 20px", flexWrap: "wrap", gap: "8px" }}>
                    {_step > 0 && (
                        <Button variant="contained" className={classes.greyButton} disabled={_loading} onClick={this._stepBack}>
                            {t("components.pixa_wallet_taxes_dialog.back")}
                        </Button>
                    )}
                    <span style={{ flex: 1 }} />
                    {_step === 2 && _bundle && !_loading ? (
                        <React.Fragment>
                            <Tooltip title={t(
                                "components.pixa_wallet_taxes_dialog.download_the_line_item_detail_csv_for"
                            )}>
                                <span><Button variant="contained" className={classes.greyButton} onClick={this._exportCsv}>CSV <CloudDownloadRounded style={{ marginLeft: 8 }} /></Button></span>
                            </Tooltip>
                            <Tooltip title={t("components.pixa_wallet_taxes_dialog.download_the_full_report_bundle_json")}>
                                <span><Button variant="contained" className={classes.greyButton} onClick={this._exportJson}>JSON <CloudDownloadRounded style={{ marginLeft: 8 }} /></Button></span>
                            </Tooltip>
                            <Tooltip title={t("components.pixa_wallet_taxes_dialog.download_the_formatted_pdf_report")}>
                                <span><Button variant="contained" className={classes.whiteButton} onClick={this._exportPdf}>PDF <PictureAsPdfRounded style={{ marginLeft: 8 }} /></Button></span>
                            </Tooltip>
                        </React.Fragment>
                    ) : null}
                    {_step < 2 && (
                        <Button
                            variant="contained" className={classes.whiteButton}
                            disabled={_loading || (_step === 0 && !anyReport)}
                            onClick={() => this._step_done(_step)}
                        >
                            {_loading
                                ? <CircularProgress size={18} style={{ color: "#151515" }} />
                                : (_step === 0 ? (_bundle ? t("components.pixa_wallet_taxes_dialog.refetch_continue") : t("components.pixa_wallet_taxes_dialog.fetch_continue")) : t("components.pixa_wallet_taxes_dialog.apply_continue"))}
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
        );
    }
}

export default withLanguage(withStyles(styles)(PixaWalletTaxesDialog));