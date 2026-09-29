"use strict";

// ── Search filters ────────────────────────────────────────────────────────────
// The filter state the panel edits and the pixagram-search Worker consumes.
// Every dimension maps 1:1 to a /search query parameter:
//
//   type         → type=artwork|blog        (null = both result sets)
//   authors      → author=a,b               (OR)
//   communities  → community=portal-1,…     (OR; posts and artworks published there)
//   colors       → color=… (dominant colour) or has_color=… (anywhere in the palette),
//                  picked by colorMode ("primary" | "any")
//   time         → from=/to=                { preset: "day"|"week"|"month"|"year" }
//                                           or { from: "YYYY-MM-DD"|null, to: "YYYY-MM-DD"|null }
//
// The state is immutable (every change returns a new object), so it can be a
// cache key and a memo dependency.

const EMPTY = Object.freeze([]);

export const EMPTY_FILTERS = Object.freeze({
    type: null,
    authors: EMPTY,
    communities: EMPTY,
    colors: EMPTY,
    colorMode: "primary",
    time: null,
});

export const TYPE_OPTIONS = Object.freeze([
    { key: null, label: "All", i18n: "components.search_filters.all" },
    { key: "artwork", label: "Artworks", i18n: "words.artworks" },
    { key: "blog", label: "Posts", i18n: "words.posts" },
]);

export const TIME_PRESETS = Object.freeze([
    { key: "day", days: 1, label: "24h", i18n: "components.search_filters.last_24_hours" },
    { key: "week", days: 7, label: "Week", i18n: "components.search_filters.past_week" },
    { key: "month", days: 30, label: "Month", i18n: "components.search_filters.past_month" },
    { key: "year", days: 365, label: "Year", i18n: "components.search_filters.past_year" },
]);

export const COLOR_MODES = Object.freeze([
    { key: "primary", label: "Dominant", i18n: "components.search_filters.dominant" },
    { key: "any", label: "Anywhere", i18n: "components.search_filters.anywhere" },
]);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (s) => typeof s === "string" && DATE_RE.test(s);

/** A custom { from, to } range (as opposed to a preset or no time filter). */
export const isCustomTime = (time) => !!time && typeof time === "object" && !("preset" in time);

export function timeIsSet(time) {
    if (!time) return false;
    if (time.preset) return TIME_PRESETS.some((p) => p.key === time.preset);
    return isDate(time.from) || isDate(time.to);
}

/** True when at least one dimension is active (the dropdown stays open on filters alone). */
export function hasFilters(f) {
    if (!f) return false;
    return !!f.type || f.authors.length > 0 || f.communities.length > 0 || f.colors.length > 0 || timeIsSet(f.time);
}

/** Number of active values — the badge on the filter button. */
export function countFilters(f) {
    if (!f) return 0;
    return (f.type ? 1 : 0) + f.authors.length + f.communities.length + f.colors.length + (timeIsSet(f.time) ? 1 : 0);
}

/** Toggle `value` in an immutable list. */
export function toggleIn(list, value) {
    return list.includes(value) ? list.filter((v) => v !== value) : list.concat([value]);
}

const HOUR = 3600;

/** The API's from/to (unix seconds or ISO dates). Presets are hour-aligned so a cache key stays stable within the hour. */
export function timeRange(time, nowMs = Date.now()) {
    if (!time) return { from: null, to: null };
    if (time.preset) {
        const preset = TIME_PRESETS.find((p) => p.key === time.preset);
        if (!preset) return { from: null, to: null };
        const from = Math.floor((nowMs / 1000 - preset.days * 86400) / HOUR) * HOUR;
        return { from: String(from), to: null };
    }
    const out = { from: null, to: null };
    if (isDate(time.from)) out.from = time.from;
    if (isDate(time.to)) {
        // `to` is exclusive on the API; a date picked by a person is inclusive.
        const d = new Date(time.to + "T00:00:00Z");
        d.setUTCDate(d.getUTCDate() + 1);
        out.to = d.toISOString().slice(0, 10);
    }
    return out;
}

/** Query parameters for /search (only the active dimensions). */
export function filtersToParams(f, nowMs = Date.now()) {
    const p = {};
    if (!f) return p;
    if (f.type === "artwork" || f.type === "blog") p.type = f.type;
    if (f.authors.length) p.author = f.authors.join(",");
    if (f.communities.length) p.community = f.communities.join(",");
    if (f.colors.length) p[f.colorMode === "any" ? "has_color" : "color"] = f.colors.join(",");
    const range = timeRange(f.time, nowMs);
    if (range.from) p.from = range.from;
    if (range.to) p.to = range.to;
    return p;
}

/**
 * The dimensions that differ from EMPTY_FILTERS, as a plain object — null when
 * none does. It is what the address carries (+search-…, see Index §8d), and
 * normalizeFilters() turns it back into a full state. Unlike filtersToParams it
 * keeps what the panel shows but the Worker ignores (a colour mode with no
 * colour, a custom range with no dates yet), so the panel reads back the same.
 */
export function compactFilters(f) {
    if (!f) return null;
    const out = {};
    for (const key of Object.keys(EMPTY_FILTERS)) {
        const value = f[key];
        const empty = EMPTY_FILTERS[key];
        const set = Array.isArray(empty) ? Array.isArray(value) && value.length > 0 : value != null && value !== empty;
        if (set) out[key] = value;
    }
    return Object.keys(out).length ? out : null;
}

/** Stable string of the active filters (cache keys, memo deps). */
export function filtersKey(f, nowMs = Date.now()) {
    const p = filtersToParams(f, nowMs);
    return Object.keys(p).sort().map((k) => k + "=" + p[k]).join("&");
}

// Account names on a Hive-family chain: 3–16 characters, dot-separated segments
// that start with a letter, end with a letter or digit, and hold a–z, 0–9 and dashes.
const ACCOUNT_SEGMENT = "[a-z][a-z0-9-]{1,}[a-z0-9]";
const ACCOUNT_RE = new RegExp(`^${ACCOUNT_SEGMENT}(?:\\.${ACCOUNT_SEGMENT})*$`);

/** `@Name ` → "name" when it is a well-formed account name, else null. */
export function accountName(text) {
    const s = String(text || "").trim().toLowerCase().replace(/^@+/, "");
    return s.length >= 3 && s.length <= 16 && ACCOUNT_RE.test(s) ? s : null;
}

/** Normalise anything (a patch, a parsed object) into a valid filter state. */
export function normalizeFilters(next) {
    const f = { ...EMPTY_FILTERS, ...(next || {}) };
    const list = (v, max, re) => Array.from(new Set((Array.isArray(v) ? v : []).map((x) => String(x || "").trim().toLowerCase()).filter((x) => x && (!re || re.test(x))))).slice(0, max);
    return Object.freeze({
        type: f.type === "artwork" || f.type === "blog" ? f.type : null,
        authors: list(f.authors, 10, /^[a-z0-9.-]{3,16}$/),
        communities: list(f.communities, 10, /^portal-\d+$/),
        colors: list(f.colors, 10, /^[a-z]+$/),
        colorMode: f.colorMode === "any" ? "any" : "primary",
        time: normalizeTime(f.time),
    });
}

function normalizeTime(time) {
    if (!time || typeof time !== "object") return null;
    if (time.preset) return TIME_PRESETS.some((p) => p.key === time.preset) ? Object.freeze({ preset: time.preset }) : null;
    const from = isDate(time.from) ? time.from : null;
    const to = isDate(time.to) ? time.to : null;
    // A custom range with no dates yet is kept so the date inputs stay visible.
    return Object.freeze({ from, to });
}
