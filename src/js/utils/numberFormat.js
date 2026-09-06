/**
 * utils/numberFormat.js — locale-aware number, money, percent and date
 * formatting for the wallet.
 *
 * Every figure the wallet prints goes through here so that the language /
 * location chosen in Settings decides the separators, the digit grouping, the
 * position of the currency code and the shape of dates — "1 234,56 PXA" in
 * fr-CH, "1.234,56 PXA" in de-DE, "1'234.56 PXA" in de-CH, "12,34,567.89 PXA"
 * in hi-IN, "CHF 1'234.50" vs "1 234.50 CHF", and so on. Nothing is computed
 * here: callers keep working on plain numbers and only format at the last
 * moment, so figures never round-trip through a localised string.
 *
 * Locale source
 * -------------
 * The Settings `locales` field ("fr-CH") — the language *and* the location the
 * user picked — read synchronously from the settings cache; `getLocaleCode()`
 * (utils/text.js, the code `setLanguage()` validated from that same field) is
 * the fallback, then "en-US".
 *
 * Digits
 * ------
 * Latin digits are forced (`-u-nu-latn`) for every locale. The amount inputs
 * (react-number-format) can only render Latin digits, so letting ar/bn/fa
 * locales switch the *display* to native digits would make the typed value
 * and the printed value disagree on the same screen. Separators, grouping,
 * currency placement and dates still follow the locale in full. Flip
 * `WALLET_LATIN_DIGITS` to let the locale's native digit set through.
 *
 * Formatter instances are ICU lookups — expensive to build, cheap to use — so
 * they are cached per (locale, options) and reused across renders.
 */

import { getLocaleCode } from "./text";
import { get_cached_settings } from "./settings";

export const NBSP = "\u00a0";
export const WALLET_LATIN_DIGITS = true;

const FALLBACK_LOCALE = "en-US";
// Permissive BCP-47 check: language, optional script/region/variants and a
// -u- extension. Anything else falls back rather than making Intl throw.
const CODE_RE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$/;

const hasIntl = typeof Intl !== "undefined";

/**
 * The user's language/location code from Settings, e.g. "fr-CH".
 *
 * The Settings bag is read first because it changes synchronously the moment
 * the user picks a locale, while `setLanguage()` (which feeds getLocaleCode)
 * lands a tick later once the catalogue chunk is in. Formatting therefore
 * follows the new choice on the very first re-render, whichever fires first.
 */
export const resolveLocale = () => {
    let code = "";
    try {
        const s = get_cached_settings();
        code = String((s && s.locales) || "");
    } catch (_) { code = ""; }
    if (!CODE_RE.test(code)) {
        try { code = String(getLocaleCode() || ""); } catch (_) { code = ""; }
    }
    return CODE_RE.test(code) ? code : FALLBACK_LOCALE;
};

/** The tag handed to Intl: the user's locale plus the Latin-digit request. */
export const intlLocale = (locale) => {
    const base = locale && CODE_RE.test(String(locale)) ? String(locale) : resolveLocale();
    if (!WALLET_LATIN_DIGITS || base.indexOf("-nu-") !== -1) return base;
    return base.indexOf("-u-") !== -1 ? base + "-nu-latn" : base + "-u-nu-latn";
};

/* ───────────────────────────── formatter cache ─────────────────────────── */

const CACHE_MAX = 256;
const cache = new Map();

const cached = (key, build) => {
    let f = cache.get(key);
    if (f !== undefined) return f;
    f = build();
    if (cache.size >= CACHE_MAX) cache.clear();
    cache.set(key, f);
    return f;
};

const numberFormatter = (locale, opts) => {
    const tag = intlLocale(locale);
    const key = "n|" + tag + "|" + JSON.stringify(opts);
    return cached(key, () => {
        if (!hasIntl || !Intl.NumberFormat) return null;
        try { return new Intl.NumberFormat(tag, opts); }
        catch (_) {
            try { return new Intl.NumberFormat(FALLBACK_LOCALE, opts); }
            catch (__) { return null; }
        }
    });
};

const dateFormatter = (locale, opts) => {
    const tag = intlLocale(locale);
    const key = "d|" + tag + "|" + JSON.stringify(opts);
    return cached(key, () => {
        if (!hasIntl || !Intl.DateTimeFormat) return null;
        try { return new Intl.DateTimeFormat(tag, opts); }
        catch (_) {
            try { return new Intl.DateTimeFormat(FALLBACK_LOCALE, opts); }
            catch (__) { return null; }
        }
    });
};

const relativeFormatter = (locale) => {
    const tag = intlLocale(locale);
    const key = "r|" + tag;
    return cached(key, () => {
        if (!hasIntl || !Intl.RelativeTimeFormat) return null;
        try { return new Intl.RelativeTimeFormat(tag, { numeric: "auto" }); }
        catch (_) {
            try { return new Intl.RelativeTimeFormat(FALLBACK_LOCALE, { numeric: "auto" }); }
            catch (__) { return null; }
        }
    });
};

/* ───────────────────────────────── numbers ─────────────────────────────── */

const toNumber = (v) => {
    const n = typeof v === "number" ? v : parseFloat(v);
    return Number.isFinite(n) ? n : 0;
};

// `decimals` is either a number (fixed: exactly that many decimals, like
// toFixed) or { min, max } for a variable amount of decimals.
const fractionOpts = (decimals, fallbackMin, fallbackMax) => {
    let min = fallbackMin, max = fallbackMax;
    if (typeof decimals === "number" && Number.isFinite(decimals)) {
        min = max = Math.max(0, Math.min(20, Math.floor(decimals)));
    } else if (decimals && typeof decimals === "object") {
        if (Number.isFinite(decimals.min)) min = Math.max(0, Math.min(20, Math.floor(decimals.min)));
        if (Number.isFinite(decimals.max)) max = Math.max(0, Math.min(20, Math.floor(decimals.max)));
    }
    if (max < min) max = min;
    return { minimumFractionDigits: min, maximumFractionDigits: max };
};

/**
 * Plain number with the locale's grouping and decimal separator.
 *   formatNumber(1234.5, 2)              -> "1 234,50"   (fr-CH)
 *   formatNumber(1234.5, { min: 0, max: 3 }) -> "1 234,5"
 */
export const formatNumber = (value, decimals = { min: 0, max: 3 }, locale) => {
    const n = toNumber(value);
    const fo = fractionOpts(decimals, 0, 3);
    const f = numberFormatter(locale, { style: "decimal", useGrouping: true, ...fo });
    if (f) return f.format(n);
    return n.toFixed(fo.maximumFractionDigits);
};

/** Integer with grouping — counts, whole-unit balances. */
export const formatInteger = (value, locale) => formatNumber(value, 0, locale);

/**
 * Token amount: localised number + non-breaking space + symbol.
 *   formatAmount(1234.5, "PXA")     -> "1 234,500 PXA"   (fr-CH)
 *   formatAmount(1234.5, "PXP", 2)  -> "1 234,50 PXP"
 * Chain assets carry 3 decimals (PXA/PXS) — the default — and the wallet shows
 * PXP with 2 or 6 depending on the screen, so the precision is a parameter.
 */
export const formatAmount = (value, symbol, decimals = 3, locale) => {
    const num = formatNumber(value, decimals, locale);
    return symbol ? num + NBSP + symbol : num;
};

/**
 * Fiat money in the user's reference currency. Uses Intl's currency style with
 * the ISO code (never the symbol — "$", "kr" and "¥" are shared by many
 * currencies), so the locale decides where the code goes: "CHF 1'234.50" in
 * de-CH, "1 234.50 CHF" in fr-CH, "1.234,50 CHF" in de-DE.
 *   formatFiat(1234.5, "CHF")     -> per locale, 2 decimals
 *   formatFiat(1234.5, "CHF", 0)  -> per locale, whole units
 */
export const formatFiat = (value, currency, decimals = 2, locale) => {
    const n = toNumber(value);
    const cur = String(currency || "USD").toUpperCase();
    const fo = fractionOpts(decimals, 2, 2);
    const f = /^[A-Z]{3}$/.test(cur)
        ? numberFormatter(locale, { style: "currency", currency: cur, currencyDisplay: "code", useGrouping: true, ...fo })
        : null;
    if (f) {
        // Some engines pad the code with a plain space; normalise to NBSP so
        // the amount and its currency never wrap apart.
        return f.format(n).replace(/ /g, NBSP);
    }
    return formatNumber(n, fo.maximumFractionDigits, locale) + NBSP + cur;
};

/** USD-anchored value → reference currency via the frankfurter rate. */
export const formatFiatFromUsd = (usd, fiatRate, currency, decimals = 2, locale) => {
    const rate = Number.isFinite(Number(fiatRate)) && Number(fiatRate) > 0 ? Number(fiatRate) : 1;
    return formatFiat(toNumber(usd) * rate, currency, decimals, locale);
};

/**
 * Percentage from a 0–100 figure: formatPercent(12.34, 1) -> "12,3 %" (fr),
 * "12.3%" (en), "%12,3" (tr).
 */
export const formatPercent = (pct, decimals = 1, locale) => {
    const n = toNumber(pct) / 100;
    const fo = fractionOpts(decimals, 0, 1);
    const f = numberFormatter(locale, { style: "percent", useGrouping: true, ...fo });
    if (f) return f.format(n);
    return (n * 100).toFixed(fo.maximumFractionDigits) + "%";
};

/* ───────────────────────────────── dates ───────────────────────────────── */

/**
 * Chain timestamps ("2026-09-13T12:00:00") carry no zone but are UTC; a bare
 * `new Date()` would read them as local time. Anything already zoned, a Date
 * or a millisecond count passes through. Returns null when unparseable.
 */
export const parseChainDate = (ts) => {
    if (ts == null || ts === "") return null;
    if (ts instanceof Date) return Number.isNaN(ts.getTime()) ? null : ts;
    if (typeof ts === "number") { const d = new Date(ts); return Number.isNaN(d.getTime()) ? null : d; }
    let s = String(ts).trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s)) s += "Z";
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
};

const DATE_DEFAULT = { dateStyle: "medium" };
const DATETIME_DEFAULT = { dateStyle: "medium", timeStyle: "short" };

/** Locale date: "13 sept. 2026" (fr), "Sep 13, 2026" (en-US), "13.09.2026" (de-CH). */
export const formatDate = (dateLike, options = DATE_DEFAULT, locale) => {
    const d = parseChainDate(dateLike);
    if (!d) return "";
    const f = dateFormatter(locale, options);
    if (f) return f.format(d);
    return d.toLocaleDateString(resolveLocale(), options);
};

export const formatDateTime = (dateLike, locale) => formatDate(dateLike, DATETIME_DEFAULT, locale);

/**
 * "in 7 days" / "dans 7 jours" / "today" / "tomorrow" — the browser's own
 * wording for the locale. Returns null when Intl.RelativeTimeFormat is
 * unavailable so callers can fall back to a catalogue string.
 */
export const formatRelativeDays = (days, locale) => {
    const n = Math.round(toNumber(days));
    const f = relativeFormatter(locale);
    if (!f) return null;
    try { return f.format(n, "day"); } catch (_) { return null; }
};

/** Whole days from now until `dateLike` (never negative; 0 when past/unknown). */
export const daysUntil = (dateLike, now = Date.now()) => {
    const d = parseChainDate(dateLike);
    if (!d) return 0;
    return Math.max(0, Math.ceil((d.getTime() - now) / 86400000));
};

/* ─────────────────────────── amount inputs ─────────────────────────────── */

/** The locale's own grouping and decimal characters. */
export const getNumberSeparators = (locale) => {
    const f = numberFormatter(locale, { style: "decimal", useGrouping: true, minimumFractionDigits: 1, maximumFractionDigits: 1 });
    let group = ",", decimal = ".";
    if (f && typeof f.formatToParts === "function") {
        try {
            for (const p of f.formatToParts(12345.6)) {
                if (p.type === "group") group = p.value;
                else if (p.type === "decimal") decimal = p.value;
            }
        } catch (_) { /* keep defaults */ }
    }
    return { group, decimal };
};

/**
 * Props for react-number-format's <NumericFormat> so typing follows the same
 * locale as the display. The component stores "." decimals internally
 * whatever is shown, so the value the wallet receives never changes shape.
 * The decimal key is kept to "." or "," (what keyboards have); both are
 * accepted while typing, and a "." pressed where "." is the grouping
 * character still becomes the decimal mark (allowedDecimalSeparators wins on
 * a single keystroke). Grouping and decimal characters must differ, which is
 * why an exotic locale falls back to a space.
 */
const inputPropsCache = new Map();
export const numericInputProps = (locale) => {
    const tag = intlLocale(locale);
    let props = inputPropsCache.get(tag);
    if (props) return props;
    const { group, decimal } = getNumberSeparators(locale);
    const decimalSeparator = decimal === "," ? "," : ".";
    // The locale's grouping character as-is (".", "'", "’", a narrow no-break
    // space…) unless it collides with the decimal mark.
    const thousandSeparator = group && group !== decimalSeparator ? group : NBSP;
    props = Object.freeze({
        thousandSeparator,
        decimalSeparator,
        allowedDecimalSeparators: decimalSeparator === "," ? [",", "."] : [".", ","],
    });
    if (inputPropsCache.size > 64) inputPropsCache.clear();
    inputPropsCache.set(tag, props);
    return props;
};
