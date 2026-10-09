// Client for the Pixa Tower API (read-only statistics of the Pixa chain).
// Responses are { data, meta }; meta says which block the figures are valid at.
// Requests are cached in memory for `ttl` ms and identical requests in flight are shared,
// so several cards asking for the same series cost one call.

export const TOWER_URL =
    (typeof window !== "undefined" && window.__PIXA_TOWER_URL__) || "https://tower-api.p1x4.workers.dev/v1";

const cache = new Map(); // path -> { at, value }
const inflight = new Map(); // path -> Promise

export function towerGet(path, ttl = 60000) {
    const hit = cache.get(path);
    if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.value);
    if (inflight.has(path)) return inflight.get(path);
    const p = fetch(TOWER_URL + path, { headers: { accept: "application/json" } })
        .then((res) =>
            res.json().then((body) => {
                if (!res.ok) {
                    const err = new Error((body && body.error && body.error.message) || `HTTP ${res.status}`);
                    err.code = body && body.error && body.error.code;
                    err.status = res.status;
                    throw err;
                }
                const value = { data: body.data, meta: body.meta || {}, stale: res.headers.get("x-tower-stale") === "1" };
                cache.set(path, { at: Date.now(), value });
                return value;
            })
        )
        .finally(() => inflight.delete(path));
    inflight.set(path, p);
    return p;
}

/** A metric series as [{ t, bucket, dim, value, extra }]. `dim` "*" returns every dimension. */
export function towerSeries(metric, { grain = "day", from, to, dim = "" } = {}, ttl = 60000) {
    const q = new URLSearchParams({ grain });
    if (from) q.set("from", String(from));
    if (to) q.set("to", String(to));
    if (dim !== undefined) q.set("dim", dim);
    return towerGet(`/metrics/${metric}?${q.toString()}`, ttl).then((r) => r.data.points);
}

// ---------------------------------------------------------------- periods

export const PERIODS = {
    "24h": { seconds: 86400, grain: "hour" },
    "7d": { seconds: 7 * 86400, grain: "day" },
    "30d": { seconds: 30 * 86400, grain: "day" },
    "90d": { seconds: 90 * 86400, grain: "day" }
};

export const nowSec = () => Math.floor(Date.now() / 1000);

/** Sum of a counter over [from, to), and over the period before it, from one series. */
export function sumWindows(points, from, to) {
    const span = to - from;
    let cur = 0;
    let prev = 0;
    for (const p of points) {
        if (p.value == null) continue;
        if (p.bucket >= from && p.bucket < to) cur += p.value;
        else if (p.bucket >= from - span && p.bucket < from) prev += p.value;
    }
    return { cur, prev, change: prev ? (cur - prev) / prev : null };
}

/** Pivot [{bucket, dim, value}] into [{bucket, [dim]: value}] for multi-series charts. */
export function pivot(points, dims) {
    const rows = new Map();
    for (const p of points) {
        if (dims && !dims.includes(p.dim)) continue;
        const row = rows.get(p.bucket) || { bucket: p.bucket };
        row[p.dim || "total"] = p.value;
        rows.set(p.bucket, row);
    }
    return Array.from(rows.values()).sort((a, b) => a.bucket - b.bucket);
}

// ---------------------------------------------------------------- formatting

export function fmtCompact(n, digits = 1) {
    if (n == null || !isFinite(n)) return "–";
    const a = Math.abs(n);
    const s = (x, u) => `${(+(n / x).toFixed(digits)).toLocaleString("en-US")}${u}`;
    if (a >= 1e9) return s(1e9, "B");
    if (a >= 1e6) return s(1e6, "M");
    if (a >= 1e4) return s(1e3, "K");
    if (a >= 100) return Math.round(n).toLocaleString("en-US");
    if (a >= 1) return (+n.toFixed(digits)).toLocaleString("en-US");
    if (a === 0) return "0";
    return n.toPrecision(2);
}

export function fmtInt(n) {
    if (n == null || !isFinite(n)) return "–";
    return Math.round(n).toLocaleString("en-US");
}

export function fmtPct(r, digits = 1) {
    if (r == null || !isFinite(r)) return "–";
    return `${(r * 100).toFixed(digits)}%`;
}

export function fmtSignedPct(r, digits = 1) {
    if (r == null || !isFinite(r)) return "";
    const v = (r * 100).toFixed(digits);
    return `${r > 0 ? "+" : ""}${v}%`;
}

export function fmtAgo(iso) {
    if (!iso) return "–";
    const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
    if (s < 90) return `${Math.round(s)}s`;
    if (s < 5400) return `${Math.round(s / 60)}m`;
    if (s < 172800) return `${Math.round(s / 3600)}h`;
    return `${Math.round(s / 86400)}d`;
}

export function fmtBucket(bucket, grain) {
    const d = new Date(bucket * 1000);
    const day = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
    if (grain === "hour") return `${day} ${String(d.getUTCHours()).padStart(2, "0")}h`;
    if (grain === "month") return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
    return day;
}
