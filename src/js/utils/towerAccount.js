// Per-account statistics and reports from the Pixa Tower: balances, followers and activity over time.
// Built on utils/tower (same cache and shared in-flight requests), so the profile, the wallet and the
// follow list asking for the same account's history cost one call.

import { towerGet, TOWER_URL } from "./tower";

const DAY = 86400;

/**
 * Ranges for account charts and the grain each one reads. The Tower keeps day rows for 62 days,
 * week rows for 2 years and month rows for good, so a range never asks for buckets it no longer has.
 */
export const ACCOUNT_RANGES = {
    "48h": { seconds: 48 * 3600, grain: "hour" },
    "30d": { seconds: 30 * DAY, grain: "day" },
    "1y": { seconds: 365 * DAY, grain: "week" },
    all: { seconds: null, grain: "month" }
};

export const ACCOUNT_RANGE_OPTIONS = ["48h", "30d", "1y", "all"];

const nowSec = () => Math.floor(Date.now() / 1000);

/**
 * Start of a range, rounded to the hour (hour grain) or the day, so that every caller in that hour or
 * day asks for the same path and shares one cached request.
 */
function rangeFrom(seconds, grain) {
    const from = nowSec() - seconds;
    return from - (from % (grain === "hour" ? 3600 : DAY));
}

/**
 * An account's history: [{ t, bucket, observed, balances, social, activity, rewards, transfers, interest_pxs }].
 * `balances` is null for buckets before the Tower first saw the account's balances.
 */
export function accountHistory(name, range = "30d", ttl = 300000) {
    const r = ACCOUNT_RANGES[range] || ACCOUNT_RANGES["30d"];
    const q = new URLSearchParams({ grain: r.grain });
    if (r.seconds) q.set("from", String(rangeFrom(r.seconds, r.grain)));
    return towerGet(`/accounts/${encodeURIComponent(name)}/history?${q.toString()}`, ttl).then((res) => {
        let points = (res.data && res.data.points) || [];
        // "All" asks for no start, so the API goes back years: begin at the account's first sign of life.
        if (!r.seconds) {
            const first = points.findIndex(hasAny);
            points = first < 0 ? [] : points.slice(first);
        }
        return { grain: r.grain, points, meta: res.meta };
    });
}

/** True when a history point records anything: balances, activity, rewards, transfers or follows. */
function hasAny(p) {
    const s = p.social || {};
    const f = s.followers || {};
    const t = p.transfers || { in: {}, out: {} };
    return !!(
        p.observed || p.balances ||
        (p.activity && p.activity.operations > 0) ||
        (p.rewards && p.rewards.total_pixa_eq > 0) ||
        t.in.count > 0 || t.out.count > 0 ||
        f.high > 0 || s.following > 0 || s.gained > 0 || s.lost > 0
    );
}

/** The last `days` days (1-31) of an account's activity against the same number of days before. */
export function accountActivity(name, days = 30, ttl = 300000) {
    return towerGet(`/accounts/${encodeURIComponent(name)}/activity?days=${days}`, ttl).then((res) => res.data);
}

/** True when the error means the Tower has no data for this account (or does not know the route yet). */
export function isNotFound(err) {
    return !!err && (err.status === 404 || err.code === "not_found");
}

// ---------------------------------------------------------------- reports

export const REPORT_PERIODS = ["day", "week", "month"];

/** Stored reports, newest first: [{ kind, period, date, created, json, markdown }]. */
export function listReports(kind, period, limit = 12, ttl = 300000) {
    const q = new URLSearchParams({ kind, period, limit: String(limit) });
    return towerGet(`/reports?${q.toString()}`, ttl).then((res) => res.data || []);
}

/** The API's origin, for the report paths it returns (they start with /v1). */
const ORIGIN = TOWER_URL.replace(/\/v1\/?$/, "");

/** Absolute URL of a report path returned by the API, or of the current (open) period's report. */
export function reportUrl(pathOrKind, period, format = "md") {
    if (pathOrKind.charAt(0) === "/") return ORIGIN + pathOrKind;
    const q = new URLSearchParams({ period });
    if (format === "md") q.set("format", "md");
    return `${TOWER_URL}/reports/${pathOrKind}?${q.toString()}`;
}

/** A report's Markdown, ready to post. */
export function reportMarkdown(url) {
    return fetch(url, { headers: { accept: "text/markdown, text/plain" } }).then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
    });
}

// ---------------------------------------------------------------- numbers

/** Change of `cur` against `prev` as a ratio, or null when there is nothing to compare with. */
export function changeOf(cur, prev) {
    if (cur == null || prev == null || !isFinite(cur) || !isFinite(prev) || prev === 0) return null;
    return (cur - prev) / prev;
}
