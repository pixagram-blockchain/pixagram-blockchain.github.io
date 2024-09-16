/**
 * utils/TimeAgo.js — locale-aware relative time.
 *
 * Was:
 *
 *     import TimeAgo from "javascript-time-ago";
 *     import en from "javascript-time-ago/locale/en";
 *     TimeAgo.addDefaultLocale(en);
 *     export default new TimeAgo("en-US");
 *
 * A singleton pinned to `en-US` at module load. Every "3 minutes ago" in the
 * app stayed English no matter what the user picked, and switching language
 * could not change it — the instance was already built, and only the `en`
 * locale data had been imported.
 *
 * Now backed by `Intl.RelativeTimeFormat`, which is native in every browser
 * this app targets. That buys three things the old setup could not give:
 *
 *   · every locale the browser knows, not the one bundled locale
 *   · correct plural categories per language — Russian needs one/few/many for
 *     "минуту / минуты / минут", and the platform gets that for free
 *   · `numeric: "auto"`, which yields the idiomatic "yesterday" / "gestern" /
 *     "вчера" instead of a literal "1 day ago", where the locale has a word
 *
 * The locale is read on every call rather than captured once, so a language
 * change is picked up by the next render with no subscription and no cache to
 * invalidate.
 *
 * The public shape is unchanged — consumers keep calling
 * `timeAgo.format(date)` and `timeAgo.format(ts, { labels: "long" })`.
 */

import { getLocaleCode } from "./text";

/**
 * Largest-first, so the first threshold that fits wins. Months and years use
 * the mean Gregorian lengths (30.44 d, 365.25 d) — the same convention
 * Intl itself documents, and the reason "1 month ago" stays stable across a
 * 28-day February.
 */
const UNITS = [
    ["year",   31557600],
    ["month",   2629800],
    ["week",     604800],
    ["day",       86400],
    ["hour",       3600],
    ["minute",       60],
    ["second",        1]
];

/** Intl objects are expensive to construct; one per locale+style is plenty. */
const formatters = new Map();

const formatterFor = (locale, style) => {
    const key = locale + "|" + style;
    let f = formatters.get(key);
    if (f) return f;
    try {
        f = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style });
    } catch (_) {
        // Unknown locale, or an environment without RelativeTimeFormat.
        try {
            f = new Intl.RelativeTimeFormat("en", { numeric: "auto", style });
        } catch (_e) {
            f = null;
        }
    }
    formatters.set(key, f);
    return f;
};

/** Accepts a Date, an epoch number, or an ISO string. */
const toMillis = (value) => {
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    if (typeof value === "string") {
        // Chain timestamps arrive as naive UTC ("2024-01-01T00:00:00") — without
        // a zone the browser reads them as LOCAL, which shifts every result by
        // the viewer's offset. Append Z when no zone is present.
        const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
        const t = Date.parse(hasZone ? value : value + "Z");
        return isFinite(t) ? t : NaN;
    }
    return NaN;
};

/**
 * `javascript-time-ago` took `{ labels: "long" }`. Keep accepting it so no call
 * site has to change, and accept the Intl spelling too.
 */
const styleFrom = (options) => {
    const raw = options && (options.style || options.labels);
    return raw === "short" || raw === "narrow" ? raw : "long";
};

/**
 * @param {Date|number|string} value  when it happened
 * @param {{labels?:string, style?:string}} [options]
 * @returns {string} e.g. "3 minutes ago", "vor 3 Minuten", "3 分前"
 */
export const format = (value, options) => {
    const ms = toMillis(value);
    if (!isFinite(ms)) return "";

    const locale = getLocaleCode() || "en-US";
    const fmt = formatterFor(locale, styleFrom(options));

    const deltaSeconds = (ms - Date.now()) / 1000;
    const abs = Math.abs(deltaSeconds);

    // Anything inside a few seconds reads better as "now" than "in 0 seconds".
    if (abs < 5) {
        return fmt ? fmt.format(0, "second") : "just now";
    }

    for (const [unit, seconds] of UNITS) {
        if (abs >= seconds || unit === "second") {
            // Truncate toward zero: 90 minutes is "1 hour ago", not "2 hours
            // ago". Rounding up would claim more time has passed than has.
            const amount = Math.trunc(deltaSeconds / seconds);
            if (fmt) return fmt.format(amount, unit);
            return amount < 0
                ? `${Math.abs(amount)} ${unit}${Math.abs(amount) === 1 ? "" : "s"} ago`
                : `in ${amount} ${unit}${amount === 1 ? "" : "s"}`;
        }
    }
    return "";
};

/** Default export keeps the `timeAgo.format(...)` call shape intact. */
export default { format };
