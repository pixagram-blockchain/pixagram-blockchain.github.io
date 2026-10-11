import * as React from "preact/compat";

import withStyles from "@material-ui/core/styles/withStyles";
import DialogContent from "@material-ui/core/DialogContent";
import { ResponsiveContainer } from "recharts/lib/component/ResponsiveContainer";
import { LineChart } from "recharts/lib/chart/LineChart";
import { BarChart } from "recharts/lib/chart/BarChart";
import { Line } from "recharts/lib/cartesian/Line";
import { Bar } from "recharts/lib/cartesian/Bar";
import { XAxis } from "recharts/lib/cartesian/XAxis";
import { YAxis } from "recharts/lib/cartesian/YAxis";
import { CartesianGrid } from "recharts/lib/cartesian/CartesianGrid";
import { ReferenceLine } from "recharts/lib/cartesian/ReferenceLine";
import { Tooltip } from "recharts/lib/component/Tooltip";
import { Cell } from "recharts/lib/component/Cell";
import { LabelList } from "recharts/lib/component/LabelList";

import { withLanguage } from "../utils/withLanguage";
import {
    towerGet, towerSeries, PERIODS, nowSec, sumWindows, pivot, fmtCompact, fmtInt, fmtPct, fmtAgo
} from "../utils/tower";
import {
    tr, trf, Section, Card, Tile, ChartTip, Legend, Pill, Switch, Empty, Skeleton, Meter, Visible,
    SERIES, AXIS, GRID, CURSOR, BAR_CURSOR, ACTIVE_DOT, INK, BAR, HBAR, stackShape, niceScale, tickFormat, axisTick, bucketLabel, fillBuckets, newestOnly
} from "./GDTowerKit";
import GDReports from "./GDReports";

const K = "components.gdmetrics.";

const styles = theme => ({
    dialogContent: {
        padding: "24px",
        [theme.breakpoints.down("sm")]: { padding: "16px" }
    },
    topBar: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        flexWrap: "wrap"
    },
    asOf: { fontSize: "12px", color: "#666", fontFamily: "'Geist Mono', monospace" },
    tiles: {
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: "16px",
        [theme.breakpoints.down("sm")]: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
        [theme.breakpoints.down("xs")]: { gridTemplateColumns: "minmax(0, 1fr)" }
    },
    tiles3: { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" },
    grid2: {
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: "16px",
        alignItems: "start",
        [theme.breakpoints.down("sm")]: { gridTemplateColumns: "minmax(0, 1fr)" }
    },
    chart: { width: "100%", height: "220px" },
    chartTall: { width: "100%", height: "260px" },
    // list rows: separated by spacing and a hover fill, never by a rule
    rows: { display: "flex", flexDirection: "column", gap: "2px", margin: "0 -8px" },
    row: {
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        alignItems: "center",
        gap: "12px",
        padding: "8px",
        borderRadius: "10px",
        transition: "background-color 150ms ease",
        "&:hover": { backgroundColor: "#171717" }
    },
    rowMain: { minWidth: 0 },
    rowTitle: {
        [theme.breakpoints.down("xs")]: { whiteSpace: "normal" },
        fontSize: "14px",
        color: "#ddd",
        fontFamily: "'Normative Pro'",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
    },
    rowSub: { fontSize: "12px", color: "#666", fontFamily: "'Normative Pro'", marginTop: "2px" },
    rowValue: { fontSize: "13px", color: "#fff", fontFamily: "'Geist Mono', monospace", textAlign: "right", whiteSpace: "nowrap" },
    rowMeter: { marginTop: "6px" },
    link: { color: "inherit", textDecoration: "none", "&:hover": { color: "#fff" } },
    funnelRow: { display: "grid", gridTemplateColumns: "110px minmax(0, 1fr) 72px", alignItems: "center", gap: "12px", padding: "5px 0" },
    funnelLabel: { fontSize: "13px", color: "#aaa", fontFamily: "'Normative Pro'" },
    funnelBarTrack: { height: "18px", borderRadius: "4px", backgroundColor: "#171717", position: "relative", overflow: "hidden" },
    funnelBar: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: "4px", backgroundColor: "#8a8a8a" },
    funnelValue: { fontSize: "12px", color: "#fff", fontFamily: "'Geist Mono', monospace", textAlign: "right" },
    note: { fontSize: "12px", color: "#666", fontFamily: "'Normative Pro'", marginTop: "10px", lineHeight: 1.5 },
    chartShort: { width: "100%", height: "160px" },
    // two lists side by side inside one card (top artists by rewards / by voters)
    cols2: {
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        columnGap: "24px",
        rowGap: "16px",
        [theme.breakpoints.down("xs")]: { gridTemplateColumns: "minmax(0, 1fr)" }
    },
    listTitle: { fontSize: "11px", color: "#666", fontFamily: "'Industry Book'", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 4px 0" },
    // label / value pairs under a chart
    stats: {
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        rowGap: "8px",
        columnGap: "16px",
        alignItems: "center",
        marginTop: "14px",
        [theme.breakpoints.down("xs")]: { gridTemplateColumns: "minmax(112px, 1fr) auto" }
    },
    statLabel: { fontSize: "13px", color: "#aaa", fontFamily: "'Normative Pro'" },
    statValue: {
        fontSize: "13px",
        color: "#fff",
        fontFamily: "'Geist Mono', monospace",
        textAlign: "right",
        whiteSpace: "nowrap",
        [theme.breakpoints.down("xs")]: { whiteSpace: "normal" }
    },
    error: {
        backgroundColor: "#101010",
        borderRadius: "16px",
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        marginTop: "16px",
        fontSize: "13px",
        color: "#aaa",
        fontFamily: "'Normative Pro'"
    }
});

const PERIOD_OPTIONS = ["24h", "7d", "30d", "90d"].map((p) => ({ value: p, label: p }));

const REWARD_TYPES = [
    { type: "author", label: () => tr(K + "reward_author", "Authors") },
    { type: "curation", label: () => tr(K + "reward_curation", "Curators") },
    { type: "beneficiary", label: () => tr(K + "reward_beneficiary", "Beneficiaries") },
    { type: "producer", label: () => tr(K + "reward_producer", "Block producers") }
];

const FUNNEL_STAGES = [
    ["created", () => tr(K + "stage_created", "Created")],
    ["profile", () => tr(K + "stage_profile", "Profile set")],
    ["follow", () => tr(K + "stage_follow", "First follow")],
    ["vote", () => tr(K + "stage_vote", "First vote")],
    ["artwork", () => tr(K + "stage_artwork", "First artwork")],
    ["reward", () => tr(K + "stage_reward", "First reward")],
    ["claim", () => tr(K + "stage_claim", "First claim")],
    ["power_up", () => tr(K + "stage_power_up", "First power-up")]
];

// Who holds the supply (supply_split dimensions).
const SPLIT_NAMES = {
    staked: () => tr(K + "split_staked", "Staked by users"),
    dpf: () => tr(K + "split_dpf", "Decentralized Pixa Fund"),
    liquid: () => tr(K + "split_liquid", "Liquid, users"),
    savings: () => tr(K + "split_savings", "Savings, users"),
    unclaimed: () => tr(K + "split_unclaimed", "Unclaimed rewards"),
    exchanges: () => tr(K + "split_exchanges", "Exchanges"),
    system: () => tr(K + "split_system", "System accounts"),
    other: () => tr(K + "split_other", "Other: reward pool, conversions, orders")
};

const STAKE_BANDS = ["<1k", "1k-10k", "10k-100k", "100k-1M", "1M+"];
const CANVAS_DIMS = ["canvas:<=32", "canvas:<=64", "canvas:<=128", "canvas:<=256", "canvas:<=512", "canvas:>512"];
const BYTES_DIMS = ["bytes:<1KB", "bytes:1-10KB", "bytes:10-100KB", "bytes:>=100KB"];

// Stacks, bottom to top (stackShape: 2 px between segments, rounded outer end only).
const VOTE_STACK = stackShape(["up", "down", "unvote"]);
const POWER_STACK = stackShape(["up", "down"]);

/** Sum of each dimension of a series over [from, to). */
function sumByDim(points, from, to) {
    const m = new Map();
    for (const p of points || []) {
        if (p.value == null || p.bucket < from || p.bucket >= to) continue;
        m.set(p.dim, (m.get(p.dim) || 0) + p.value);
    }
    return m;
}

/** Latest values of a metric as a Map dim → { value, extra }. */
const byDim = (values) => new Map((values || []).map((v) => [v.dim, v]));

/** Top `n` dimensions of a Map by value, without the total (dim ""). */
const topOf = (m, n) => Array.from(m.entries()).filter(([k, v]) => k !== "" && v > 0).sort((a, b) => b[1] - a[1]).slice(0, n);

class GDMetrics extends React.PureComponent {
    // `period` is the period the data in `d` was loaded for; `pending` is the one asked for while it loads,
    // so the charts never draw one period's data on another period's time axis.
    state = { period: "7d", pending: null, cohortWeeksAgo: 2, loading: true, error: null, d: {}, meta: null };
    root = React.createRef();
    seq = 0;

    componentDidMount() {
        this.visible = new Visible(() => this.load(), 60000);
        this.visible.attach(this.root.current);
    }

    componentWillUnmount() {
        if (this.visible) this.visible.detach();
    }

    _setPeriod = (period) => {
        if (period === (this.state.pending || this.state.period)) return;
        this.setState({ pending: period, loading: true }, () => this.load());
    };

    _setCohort = (cohortWeeksAgo) => {
        this.setState({ cohortWeeksAgo }, () => this.loadFunnel());
    };

    loadFunnel() {
        // Rounded to the day (same cohort week), so polls reuse the cached response.
        const at = Math.floor((nowSec() - this.state.cohortWeeksAgo * 7 * 86400) / 86400) * 86400;
        return towerGet(`/funnel?cohort=${at}`, 300000)
            .then((r) => this.setState((s) => ({ d: { ...s.d, funnel: r.data } })))
            .catch(() => null);
    }

    load() {
        const seq = ++this.seq;
        const period = this.state.pending || this.state.period;
        const P = PERIODS[period];
        // Through the hour now running. Ends are rounded up and starts down to 5 minutes, so the polls of the
        // next 5 minutes ask for the same paths and are served from the cache.
        const end = nowSec() + 3600;
        const r5 = (t) => Math.floor(t / 300) * 300;
        const to = Math.ceil(end / 300) * 300;
        const from = r5(end - P.seconds);
        const from2 = r5(end - 2 * P.seconds); // the previous period, for the change
        const g = P.grain;
        const dayFrom = period === "24h" ? r5(end - 3 * 86400) : from2;
        const opt = { grain: g, from: from2, to };
        const soft = (p) => p.catch(() => null);

        const jobs = {
            overview: soft(towerGet("/overview", 30000).then((r) => r.data)),
            created: soft(towerSeries("accounts_created", opt)),
            artworks: soft(towerSeries("artworks_created", opt)),
            blogs: soft(towerSeries("blog_posts_created", opt)),
            votes: soft(towerSeries("votes_cast", opt)),
            tx: soft(towerSeries("transactions", opt)),
            rewardsV: soft(towerSeries("rewards_paid_vests", opt)),
            dau: soft(towerSeries("active_accounts", { grain: "day", from: dayFrom, to, dim: "*" })),
            dauTotal: soft(towerSeries("active_accounts", { grain: "day", from: dayFrom, to, dim: "" })),
            activity: soft(towerSeries("active_accounts", { grain: g, from, to, dim: "*" })),
            activityTotal: soft(towerSeries("active_accounts", { grain: g, from, to, dim: "" })),
            tps: soft(towerSeries("tps", { grain: g, from, to, dim: "*" })),
            debt: soft(towerSeries("pxs_debt_ratio", { grain: period === "24h" ? "hour" : "day", from, to })),
            feed: soft(towerGet(`/feed?grain=${period === "24h" ? "hour" : "day"}&from=${from}&to=${to}`, 300000).then((r) => r.data)),
            pxp: soft(towerGet("/distribution/pxp", 300000).then((r) => r.data)),
            rewards: soft(towerGet(`/rewards?window=${period}`, 120000).then((r) => r.data)),
            portals: soft(towerGet("/portals", 300000).then((r) => r.data)),
            controversial: soft(towerGet(`/posts/controversial?window=${period === "24h" ? "7d" : period}&limit=8`, 300000).then((r) => r.data)),
            status: soft(towerGet("/status", 15000)),
            // Finance, network and artwork sections. Daily metrics show at least the last 7 days.
            ...this._extraJobs(soft, period, from, to)
        };
        const keys = Object.keys(jobs);
        Promise.all(keys.map((k) => jobs[k])).then((values) => {
            if (seq !== this.seq) return;
            const d = { ...this.state.d };
            keys.forEach((k, i) => (d[k] = values[i]));
            const ok = values.some((v) => v !== null);
            this.setState({
                d, period, pending: null, loading: false, meta: d.status ? d.status.meta : null,
                error: ok ? null : tr(K + "unreachable", "The statistics service cannot be reached right now.")
            });
        });
        this.loadFunnel();
    }

    /** Requests for the finance, network and artwork sections (cached 5 minutes: they move slowly). */
    _extraJobs(soft, period, from0, to0) {
        // Rounded to 5 minutes, so a refresh inside that window reuses the cached responses.
        const to = to0 - (to0 % 300) + 300;
        const from = from0 - (from0 % 300);
        const g = PERIODS[period].grain;
        const dg = period === "24h" ? "hour" : "day"; // gauges
        const dFrom = period === "24h" ? to - 7 * 86400 : from; // daily metrics
        const T = 300000;
        const series = (metric, grain, f, dim = "*") => soft(towerSeries(metric, { grain, from: f, to, dim }, T));
        const latest = (metric, grain) => soft(towerGet(`/metrics/${metric}/latest?grain=${grain}`, T).then((r) => newestOnly(r.data.values)));
        return {
            votesDim: series("votes_cast", g, from),
            artists: series("artists", "day", dFrom),
            split: latest("supply_split", "hour"),
            inflation: series("inflation", "day", dFrom),
            burns: series("burns", g, from),
            conv: series("conversions_volume", g, from),
            collateral: latest("conversion_collateral", "day"),
            savings: series("pxs_savings", dg, from),
            savFlows: series("savings_flows", g, from),
            interest: series("savings_interest", "day", dFrom, ""),
            power: series("power_flow", g, from),
            pdStarted: series("powerdowns_started", g, from),
            delegFlows: series("delegation_flows", g, from),
            delegated: latest("delegated_total", "hour"),
            transfers: series("transfer_activity", g, from),
            market: latest("market_price", "hour"),
            marketVol: series("market_volume", g, from, ""),
            regs: series("registrations_activated", "day", dFrom, ""),
            everActive: series("ever_active_accounts", "day", dFrom, ""),
            creators: series("account_creators", "day", dFrom), // beside the daily registrations chart
            apps: series("posting_apps", "day", dFrom),
            // 90 days of day rows by tag can pass the API's 2,000-row cap: weeks overlapping the period instead
            tags: period === "90d" ? series("tags_used", "week", from - 7 * 86400) : series("tags_used", g, from),
            bandsS: latest("stake_by_band", "day"),
            bandsA: latest("accounts_by_band", "day"),
            payStats: latest("payout_stats_30d", "day"),
            payouts: series("payouts", g, from),
            engagement: series("artwork_engagement_7d", "day", Math.min(dFrom, to - 21 * 86400)),
            formats: series("artwork_formats", "day", dFrom),
            topArtists: latest("top_artists_30d", "day"),
            topCurators: latest("top_curators_30d", "day")
        };
    }

    // ------------------------------------------------------------ pulse

    _counterTile(key, label, points, unit) {
        const P = PERIODS[this.state.period];
        const to = nowSec() + 3600;
        const from = to - P.seconds;
        const total = (points || []).filter((p) => p.dim === "");
        const w = sumWindows(total, from, to);
        const spark = total.filter((p) => p.bucket >= from).map((p) => ({ v: p.value || 0 }));
        return (
            <Tile
                key={key}
                label={label}
                value={points ? fmtCompact(w.cur) : "–"}
                unit={unit}
                change={w.prev ? w.change : null}
                sub={trf(K + "vs_previous_n", "vs. previous {n}", { n: this.state.period })}
                spark={spark}
                loading={this.state.loading && !points}
            />
        );
    }

    _renderPulse() {
        const { classes } = this.props;
        const { d, period, loading } = this.state;
        const P = PERIODS[period];
        const to = nowSec() + 3600;
        const from = to - P.seconds;
        const ov = d.overview;
        // Daily active: mean of the closed days in the period, against the period before.
        const days = (d.dauTotal || []).filter((p) => p.bucket + 86400 <= to - 3600);
        const inP = days.filter((p) => p.bucket >= from - 86400);
        const prevP = days.filter((p) => p.bucket < from - 86400);
        const mean = (xs) => (xs.length ? xs.reduce((s, p) => s + (p.value || 0), 0) / xs.length : null);
        const dau = period === "24h" ? (days.length ? days[days.length - 1].value : null) : mean(inP);
        const dauPrev = period === "24h" ? (days.length > 1 ? days[days.length - 2].value : null) : mean(prevP);
        return (
            <div className={classes.tiles}>
                <Tile
                    label={tr(K + "live_now", "Live now")}
                    value={ov ? fmtInt(ov.kpis.live_now) : "–"}
                    sub={tr(K + "live_now_sub", "signed an operation in the last 15 min")}
                    loading={loading && !ov}
                />
                <Tile
                    label={tr(K + "daily_active", "Daily active accounts")}
                    value={dau == null ? "–" : fmtCompact(dau)}
                    change={dauPrev ? (dau - dauPrev) / dauPrev : null}
                    sub={period === "24h" ? tr(K + "last_full_day", "last full day") : tr(K + "daily_average", "daily average")}
                    spark={(period === "24h" ? days.slice(-7) : inP).map((p) => ({ v: p.value || 0 }))}
                    loading={loading && !d.dauTotal}
                />
                {this._counterTile("created", tr(K + "accounts_created", "Accounts created"), d.created)}
                {this._counterTile("artworks", tr(K + "artworks", "Artworks published"), d.artworks)}
                {this._counterTile("blogs", tr(K + "blog_posts", "Blog posts"), d.blogs)}
                {this._counterTile("votes", tr(K + "votes", "Votes cast"), d.votes)}
                {this._counterTile("tx", tr(K + "transactions", "Transactions"), d.tx)}
                {this._counterTile("rewards", tr(K + "rewards_paid", "Rewards paid"), d.rewardsV, "PXP")}
            </div>
        );
    }

    // ------------------------------------------------------------ activity

    _renderActivity() {
        const { classes } = this.props;
        const { d, period } = this.state;
        const g = PERIODS[period].grain;
        const act = pivot([...(d.activityTotal || []), ...(d.activity || [])], ["", "voters", "creators"]);
        const content = pivot(
            [...(d.artworks || []).map((p) => ({ ...p, dim: "artworks" })), ...(d.blogs || []).filter((p) => p.dim === "").map((p) => ({ ...p, dim: "blogs" }))],
            ["artworks", "blogs"]
        ).filter((r) => r.bucket >= nowSec() + 3600 - PERIODS[period].seconds);
        const names = {
            total: tr(K + "all_active", "All active"),
            voters: tr(K + "voters", "Voters"),
            creators: tr(K + "creators", "Creators"),
            artworks: tr(K + "artworks_short", "Artworks"),
            blogs: tr(K + "blogs_short", "Blog posts")
        };
        const xFmt = (b) => bucketLabel(b, g);
        const xTick = (b) => axisTick(b, g);
        return (
            <div className={classes.grid2}>
                <Card
                    title={tr(K + "active_accounts", "Active accounts")}
                    subtitle={g === "hour" ? tr(K + "per_hour", "per hour") : tr(K + "per_day", "per day")}
                    info={tr(K + "active_accounts_info", "Distinct accounts that signed at least one operation. Voters voted; creators published an artwork or a blog post. Witness price feeds are not counted.")}
                >
                    {act.length ? (
                        <>
                            <div className={classes.chart}>
                                <ResponsiveContainer>
                                    <LineChart data={act} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                                        <CartesianGrid {...GRID} />
                                        <XAxis dataKey="bucket" tickFormatter={xTick} {...AXIS} minTickGap={24} />
                                        <YAxis {...AXIS} allowDecimals={false} width={48} />
                                        <Tooltip cursor={CURSOR} content={<ChartTip labelFormatter={xFmt} names={names} />} />
                                        {["total", "voters", "creators"].map((k, i) => (
                                            <Line key={k} type="monotone" dataKey={k} name={names[k]} stroke={SERIES[i].stroke}
                                                strokeDasharray={SERIES[i].dash} strokeWidth={2} dot={false} activeDot={ACTIVE_DOT}
                                                isAnimationActive={false} connectNulls />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            <Legend items={[{ label: names.total }, { label: names.voters }, { label: names.creators }]} />
                        </>
                    ) : this._placeholder(d.activity)}
                </Card>
                <Card
                    title={tr(K + "publications", "Publications")}
                    subtitle={tr(K + "artworks_and_blog_posts", "Artworks and blog posts")}
                    info={tr(K + "publications_info", "First versions only: edits are not counted. A blog post is a markdown post or any post in a portal.")}
                >
                    {content.length ? (
                        <>
                            <div className={classes.chart}>
                                <ResponsiveContainer>
                                    <BarChart data={content} margin={{ top: 8, right: 16, bottom: 0, left: -16 }} barGap={2} barCategoryGap="24%">
                                        <CartesianGrid {...GRID} />
                                        <XAxis dataKey="bucket" tickFormatter={xTick} {...AXIS} minTickGap={24} />
                                        <YAxis {...AXIS} allowDecimals={false} width={48} />
                                        <Tooltip cursor={BAR_CURSOR} content={<ChartTip labelFormatter={xFmt} names={names} />} />
                                        <Bar dataKey="artworks" name={names.artworks} fill={SERIES[0].fill} {...BAR} />
                                        <Bar dataKey="blogs" name={names.blogs} fill={SERIES[1].fill} {...BAR} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <Legend items={[{ label: names.artworks, color: SERIES[0].fill, shape: "block" }, { label: names.blogs, color: SERIES[1].fill, shape: "block" }]} />
                        </>
                    ) : this._placeholder(d.artworks)}
                </Card>
            </div>
        );
    }

    // ------------------------------------------------------------ controversy

    _renderControversy() {
        const { classes } = this.props;
        const { d } = this.state;
        const portals = (d.portals || []).filter((p) => p.posts > 0);
        const anyDown = portals.some((p) => p.downvote_share_30d > 0);
        const posts = d.controversial || [];
        return (
            <div className={classes.grid2}>
                <Card
                    title={tr(K + "controversy_by_portal", "Controversy by portal")}
                    subtitle={tr(K + "last_30_days", "last 30 days")}
                    info={tr(K + "controversy_info", "2·min(U,D)/(U+D) on stake: 0 when every vote agrees, 1 when upvotes and downvotes weigh the same. Weighted by the rshares at stake; a post needs 5 votes to be scored.")}
                >
                    {!d.portals ? this._placeholder(d.portals) : portals.length === 0 ? (
                        <Empty>{tr(K + "no_portal_posts", "No portal has posts yet.")}</Empty>
                    ) : (
                        <div className={classes.rows}>
                            {portals.slice(0, 8).map((p) => (
                                <div key={p.portal} className={classes.row}>
                                    <div className={classes.rowMain}>
                                        <div className={classes.rowTitle}>{p.title || p.portal}</div>
                                        <div className={classes.rowSub}>
                                            {fmtInt(p.posts)} {tr(K + "posts", "posts")} · {fmtInt(p.replies)} {tr(K + "replies", "replies")} · {tr(K + "downvotes", "downvotes")} {fmtPct(p.downvote_share_30d || 0)}
                                        </div>
                                        {p.controversy_30d != null ? <div className={classes.rowMeter}><Meter value={p.controversy_30d} /></div> : null}
                                    </div>
                                    <div className={classes.rowValue}>{p.controversy_30d == null ? "–" : p.controversy_30d.toFixed(2)}</div>
                                </div>
                            ))}
                        </div>
                    )}
                    {d.portals && !anyDown ? (
                        <div className={classes.note}>{tr(K + "no_downvotes", "No post in a portal has been downvoted in 30 days: every scored vote agreed.")}</div>
                    ) : null}
                </Card>
                <Card
                    title={tr(K + "most_controversial", "Most controversial posts")}
                    subtitle={tr(K + "both_up_and_down", "posts with both upvotes and downvotes")}
                >
                    {!d.controversial ? this._placeholder(d.controversial) : posts.length === 0 ? (
                        <Empty>{tr(K + "no_controversial", "Nothing contested in this period: no post received both upvotes and downvotes.")}</Empty>
                    ) : (
                        <div className={classes.rows}>
                            {posts.map((p) => (
                                <a key={p.author + "/" + p.permlink} className={`${classes.row} ${classes.link}`} href={p.url} target="_blank" rel="noopener noreferrer">
                                    <div className={classes.rowMain}>
                                        <div className={classes.rowTitle}>{p.title || p.permlink}</div>
                                        <div className={classes.rowSub}>@{p.author} · ▲ {p.up_count} ▼ {p.down_count}{p.portal ? " · " + p.portal : ""}</div>
                                    </div>
                                    <div className={classes.rowValue}>{p.controversy == null ? "–" : p.controversy.toFixed(2)}</div>
                                </a>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
        );
    }

    // ------------------------------------------------------------ economy

    _renderEconomy() {
        const { classes } = this.props;
        const { d, period } = this.state;
        const s = d.overview ? d.overview.supply : null;
        const g = period === "24h" ? "hour" : "day";
        const xFmt = (b) => bucketLabel(b, g);
        const xTick = (b) => axisTick(b, g);
        const debt = (d.debt || []).map((p) => ({ bucket: p.bucket, v: p.value }));
        // Median of the witnesses' published feeds per bucket: available since genesis, unlike the snapshots.
        const byBucket = new Map();
        for (const p of (d.feed && d.feed.published) || []) {
            const size = period === "24h" ? 3600 : 86400;
            const b = Math.floor(Date.parse(p.t) / 1000 / size) * size;
            byBucket.set(b, [...(byBucket.get(b) || []), p.price]);
        }
        const med = (xs) => { const a = [...xs].sort((x, y) => x - y); const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
        const feed = Array.from(byBucket.entries()).sort((a, b) => a[0] - b[0]).map(([bucket, xs]) => ({ bucket, v: med(xs), n: xs.length }));
        const feedScale = niceScale(feed.length ? Math.min(...feed.map((p) => p.v)) : null, feed.length ? Math.max(...feed.map((p) => p.v)) : null, 4);
        const short = (label) => (label === "<1" ? "<1" : label.endsWith("+") ? label : label.split("-")[0] + "+");
        const pxp = d.pxp ? d.pxp.buckets.filter((b) => b.bucket !== "0").map((b) => ({ bucket: b.bucket, tick: short(b.bucket), accounts: b.own.accounts, pxp: b.own.pxp })) : [];
        const zero = d.pxp ? d.pxp.buckets.find((b) => b.bucket === "0") : null;
        return (
            <>
                <div className={`${classes.tiles} ${classes.tiles3}`}>
                    <Tile label={tr(K + "liquid_pixa", "Liquid PIXA")} value={s ? fmtCompact(s.liquid_pixa) : "–"} sub={tr(K + "balances_and_savings", "balances and savings")} loading={!s && this.state.loading} />
                    <Tile label={tr(K + "liquid_pxs", "Liquid PXS")} value={s ? fmtCompact(s.liquid_pxs) : "–"} sub={tr(K + "dpf_excluded", "DPF excluded")} loading={!s && this.state.loading} />
                    <Tile label={tr(K + "liquid_total", "Total liquid")} value={s ? fmtCompact(s.liquid_total_pixa_eq) : "–"} unit="PIXA" sub={tr(K + "pxs_at_feed", "PXS at the median feed")} loading={!s && this.state.loading} />
                    <Tile label={tr(K + "staked", "Staked (Pixa Power)")} value={s ? fmtCompact(s.staked_pixa) : "–"} sub={s ? fmtPct(s.staked_pixa / s.current_supply_pixa) + " " + tr(K + "of_supply", "of supply") : ""} loading={!s && this.state.loading} />
                    <Tile label={tr(K + "dpf_balance", "DPF balance")} value={s ? fmtCompact(s.dpf_pxs) : "–"} unit="PXS" sub={tr(K + "decentralized_fund", "Decentralized Pixa Fund")} loading={!s && this.state.loading} />
                    <Tile label={tr(K + "reward_pool", "Reward pool")} value={s ? fmtCompact(s.reward_pool_pixa) : "–"} unit="PIXA" sub={tr(K + "to_be_distributed", "to be distributed by votes")} loading={!s && this.state.loading} />
                </div>
                <div className={classes.grid2} style={{ marginTop: "16px" }}>
                    <Card
                        title={tr(K + "debt_ratio", "PXS debt ratio")}
                        subtitle={s ? fmtPct(s.pxs_debt_ratio, 2) + " " + tr(K + "now", "now") : ""}
                        info={tr(K + "debt_ratio_info", "PXS supply at the median feed over virtual supply. PXS printing stops above 20%; the haircut applies above 30%.")}
                    >
                        {debt.length > 1 ? (
                            <div className={classes.chart}>
                                <ResponsiveContainer>
                                    <LineChart data={debt} margin={{ top: 8, right: 56, bottom: 0, left: -8 }}>
                                        <CartesianGrid {...GRID} />
                                        <XAxis dataKey="bucket" tickFormatter={xTick} {...AXIS} minTickGap={24} />
                                        <YAxis {...AXIS} domain={[0, 0.32]} tickFormatter={(v) => fmtPct(v, 0)} width={48} />
                                        <ReferenceLine y={0.2} stroke="#777" strokeDasharray="4 4" label={{ value: tr(K + "stop_print", "stop print"), position: "right", fill: INK.secondary, fontSize: 11 }} />
                                        <ReferenceLine y={0.3} stroke="#aaa" strokeDasharray="4 4" label={{ value: tr(K + "haircut", "haircut"), position: "right", fill: INK.secondary, fontSize: 11 }} />
                                        <Tooltip cursor={CURSOR} content={<ChartTip labelFormatter={xFmt} valueFormatter={(v) => fmtPct(v, 2)} />} />
                                        <Line type="monotone" dataKey="v" name={tr(K + "debt_ratio", "PXS debt ratio")} stroke={SERIES[0].stroke} strokeWidth={2} dot={false} activeDot={ACTIVE_DOT} isAnimationActive={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        ) : this._placeholder(d.debt, tr(K + "history_builds", "The history builds up from the Tower's first snapshot, every 5 minutes."))}
                    </Card>
                    <Card
                        title={tr(K + "price_feed", "Median price feed")}
                        subtitle={s && s.feed_pixa_per_pxs ? `${s.feed_pixa_per_pxs.toFixed(3)} PIXA ${tr(K + "per_pxs", "per PXS")}` : ""}
                        info={tr(K + "price_feed_info", "Median of the feeds the witnesses published in each period. PXS is a Big Mac referenced supracoin: the feed says how many PIXA one PXS converts to.")}
                    >
                        {feed.length > 1 ? (
                            <div className={classes.chart}>
                                <ResponsiveContainer>
                                    <LineChart data={feed} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                                        <CartesianGrid {...GRID} />
                                        <XAxis dataKey="bucket" tickFormatter={xTick} {...AXIS} minTickGap={24} />
                                        <YAxis {...AXIS} domain={feedScale.domain} ticks={feedScale.ticks} interval={0} width={56} tickFormatter={tickFormat(feedScale.step)} />
                                        <Tooltip cursor={CURSOR} content={<ChartTip labelFormatter={xFmt} valueFormatter={(v, p) => `${v.toFixed(3)} PIXA · ${p.payload.n} ${tr(K + "feeds", "feeds")}`} />} />
                                        <Line type="stepAfter" dataKey="v" name={tr(K + "pixa_per_pxs", "PIXA per PXS")} stroke={SERIES[0].stroke} strokeWidth={2} dot={false} activeDot={ACTIVE_DOT} isAnimationActive={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        ) : this._placeholder(d.feed, tr(K + "history_builds", "The history builds up from the Tower's first snapshot, every 5 minutes."))}
                    </Card>
                    <Card
                        title={tr(K + "pxp_distribution", "Accounts by Pixa Power")}
                        subtitle={d.pxp ? `${tr(K + "gini", "Gini")} ${d.pxp.gini == null ? "–" : d.pxp.gini.toFixed(2)} · ${tr(K + "nakamoto", "Nakamoto")} ${d.pxp.nakamoto_50 == null ? "–" : d.pxp.nakamoto_50}` : ""}
                        info={tr(K + "pxp_info", "User accounts per bucket of own Pixa Power (VESTS × ratio). System and portal accounts are excluded. Nakamoto: fewest accounts holding more than half of user stake.")}
                    >
                        {pxp.length ? (
                            <>
                                <div className={classes.chart}>
                                    <ResponsiveContainer>
                                        <BarChart data={pxp} margin={{ top: 8, right: 16, bottom: 0, left: -16 }} barCategoryGap="18%">
                                            <CartesianGrid {...GRID} />
                                            <XAxis dataKey="tick" {...AXIS} interval={0} />
                                            <YAxis {...AXIS} allowDecimals={false} width={48} />
                                            <Tooltip
                                                cursor={BAR_CURSOR}
                                                content={<ChartTip labelFormatter={(l, payload) => `${payload && payload[0] ? payload[0].payload.bucket : l} PXP`} valueFormatter={(v, p) => `${fmtInt(v)} · ${fmtCompact(p.payload.pxp)} PXP`} />}
                                            />
                                            <Bar dataKey="accounts" name={tr(K + "accounts", "Accounts")} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                                                {pxp.map((r) => <Cell key={r.bucket} fill={SERIES[1].fill} />)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                {zero ? <div className={classes.note}>{fmtInt(zero.own.accounts)} {tr(K + "accounts_without_stake", "accounts hold no Pixa Power of their own and are left out of the chart.")}</div> : null}
                            </>
                        ) : this._placeholder(d.pxp)}
                    </Card>
                    {this._renderRewards()}
                </div>
            </>
        );
    }

    _renderRewards() {
        const { classes } = this.props;
        const { d, period } = this.state;
        const r = d.rewards;
        const rows = r ? REWARD_TYPES.map((t) => ({ ...t, row: r.by_type.find((x) => x.type === t.type) })).filter((x) => x.row) : [];
        const max = Math.max(1, ...rows.map((x) => x.row.pixa_equivalent));
        return (
            <Card
                title={tr(K + "rewards_by_type", "Rewards paid")}
                subtitle={trf(K + "last_n_pixa_equivalent", "last {n} · PIXA equivalent", { n: period })}
                info={tr(K + "rewards_info", "Stake (VESTS) at the current ratio, PXS at the median feed, liquid PIXA as is. Payments by the Decentralized Pixa Fund are in the Control Tower.")}
            >
                {!r ? this._placeholder(r) : rows.length === 0 ? (
                    <Empty>{tr(K + "no_rewards", "No rewards paid in this period.")}</Empty>
                ) : (
                    <>
                        <div className={classes.rows}>
                            {rows.map((x) => (
                                <div key={x.type} className={classes.row}>
                                    <div className={classes.rowMain}>
                                        <div className={classes.rowTitle}>{x.label()}</div>
                                        <div className={classes.rowSub}>{fmtInt(x.row.payments)} {tr(K + "payments", "payments")}</div>
                                        <div className={classes.rowMeter}><Meter value={x.row.pixa_equivalent / max} /></div>
                                    </div>
                                    <div className={classes.rowValue}>{fmtCompact(x.row.pixa_equivalent)}</div>
                                </div>
                            ))}
                        </div>
                        <div className={classes.note}>
                            {tr(K + "pending_payout", "Pending payout")}: {fmtCompact(r.pending_payout_pxs)} PXS · {fmtInt(r.pending_posts)} {tr(K + "posts", "posts")}
                        </div>
                    </>
                )}
            </Card>
        );
    }

    // ------------------------------------------------------------ chain and onboarding

    _renderChainAndFunnel() {
        const { classes } = this.props;
        const { d, period, cohortWeeksAgo } = this.state;
        const g = PERIODS[period].grain;
        const xFmt = (b) => bucketLabel(b, g);
        const xTick = (b) => axisTick(b, g);
        const tps = pivot(d.tps || [], ["avg", "peak"]);
        const f = d.funnel;
        const stages = f ? FUNNEL_STAGES.map(([k, label]) => ({ k, label, s: f.stages.find((x) => x.stage === k) })) : [];
        const created = stages.length && stages[0].s ? stages[0].s.accounts : 0;
        const names = { avg: tr(K + "average", "Average"), peak: tr(K + "busiest_block", "Busiest block") };
        return (
            <div className={classes.grid2}>
                <Card
                    title={tr(K + "tps", "Transactions per second")}
                    subtitle={tr(K + "tps_sub", "average and busiest block (3 s)")}
                >
                    {tps.length ? (
                        <>
                            <div className={classes.chart}>
                                <ResponsiveContainer>
                                    <LineChart data={tps} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                                        <CartesianGrid {...GRID} />
                                        <XAxis dataKey="bucket" tickFormatter={xTick} {...AXIS} minTickGap={24} />
                                        <YAxis {...AXIS} width={48} tickFormatter={(v) => (v >= 1 ? v.toFixed(0) : v.toFixed(2))} />
                                        <Tooltip cursor={CURSOR} content={<ChartTip labelFormatter={xFmt} names={names} valueFormatter={(v) => (v == null ? "–" : v.toFixed(3))} />} />
                                        <Line type="monotone" dataKey="peak" name={names.peak} stroke={SERIES[1].stroke} strokeDasharray={SERIES[1].dash} strokeWidth={2} dot={false} activeDot={ACTIVE_DOT} isAnimationActive={false} />
                                        <Line type="monotone" dataKey="avg" name={names.avg} stroke={SERIES[0].stroke} strokeWidth={2} dot={false} activeDot={ACTIVE_DOT} isAnimationActive={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            <Legend items={[{ label: names.avg }, { label: names.peak }]} />
                        </>
                    ) : this._placeholder(d.tps)}
                </Card>
                <Card
                    title={tr(K + "onboarding", "Onboarding funnel")}
                    subtitle={f ? trf(K + "accounts_created_week_of_n", "accounts created the week of {n}", { n: f.cohort_week }) : ""}
                    info={tr(K + "funnel_info", "How far the accounts created in one week have gone so far. A recent cohort keeps moving as its accounts reach new stages.")}
                    right={
                        <Switch
                            label={tr(K + "cohort", "Cohort")}
                            value={cohortWeeksAgo}
                            onChange={this._setCohort}
                            options={[1, 2, 4, 8].map((w) => ({ value: w, label: `-${w}w` }))}
                        />
                    }
                >
                    {!f ? this._placeholder(f) : !created ? (
                        <Empty>{tr(K + "no_cohort", "No account was created that week.")}</Empty>
                    ) : (
                        <>
                            {stages.map(({ k, label, s }) => {
                                const n = s ? s.accounts : 0;
                                return (
                                    <div key={k} className={classes.funnelRow}>
                                        <span className={classes.funnelLabel}>{label()}</span>
                                        <div className={classes.funnelBarTrack}>
                                            <div className={classes.funnelBar} style={{ width: `${(n / created) * 100}%`, backgroundColor: k === "created" ? "#d6d6d6" : "#8a8a8a" }} />
                                        </div>
                                        <span className={classes.funnelValue}>{fmtInt(n)} · {fmtPct(n / created, 0)}</span>
                                    </div>
                                );
                            })}
                            {f.median_days_to_first_reward != null ? (
                                <div className={classes.note}>
                                    {tr(K + "median_first_reward", "Median time from first post to first reward")}: {f.median_days_to_first_reward.toFixed(1)} {tr(K + "days", "days")}
                                </div>
                            ) : null}
                        </>
                    )}
                </Card>
            </div>
        );
    }

    // ------------------------------------------------------------ votes and artists (activity)

    _renderVotesAndArtists() {
        const { classes } = this.props;
        const { d, period } = this.state;
        const P = PERIODS[period];
        const g = P.grain;
        const to = nowSec() + 3600;
        const from = to - P.seconds;
        const xFmt = (b) => bucketLabel(b, g);
        const xTick = (b) => axisTick(b, g);
        const dFmt = (b) => bucketLabel(b, "day");
        const dFrom = period === "24h" ? to - 7 * 86400 : from;
        const votes = d.votesDim ? fillBuckets(pivot(d.votesDim, ["up", "down", "unvote"]), from, to, g, ["up", "down", "unvote"]) : [];
        const vSum = sumByDim(d.votesDim, from, to);
        const vNames = { up: tr(K + "upvotes", "Upvotes"), down: tr(K + "downvotes_title", "Downvotes"), unvote: tr(K + "unvotes", "Vote removals") };
        const anyVote = votes.some((r) => r.up || r.down || r.unvote);
        const artists = d.artists ? fillBuckets(pivot(d.artists, ["", "new"]), dFrom, to, "day", ["total", "new"]) : [];
        const aNames = { total: tr(K + "artists_all", "Published an artwork"), new: tr(K + "artists_new", "Their first artwork") };
        return (
            <div className={classes.grid2} style={{ marginTop: "16px" }}>
                <Card
                    title={tr(K + "votes_title", "Votes")}
                    subtitle={anyVote ? `▲ ${fmtInt(vSum.get("up") || 0)} · ▼ ${fmtInt(vSum.get("down") || 0)} · ${trf(K + "removals_n", "{n} removed", { n: fmtInt(vSum.get("unvote") || 0) })}` : ""}
                    info={tr(K + "votes_info", "Vote operations by their weight: upvotes, downvotes, and votes set back to 0 (a vote removed or changed to nothing).")}
                >
                    {anyVote ? (
                        <>
                            <div className={classes.chart}>
                                <ResponsiveContainer>
                                    <BarChart data={votes} margin={{ top: 8, right: 16, bottom: 0, left: -16 }} barCategoryGap="24%">
                                        <CartesianGrid {...GRID} />
                                        <XAxis dataKey="bucket" tickFormatter={xTick} {...AXIS} minTickGap={24} />
                                        <YAxis {...AXIS} allowDecimals={false} width={48} />
                                        <Tooltip cursor={BAR_CURSOR} content={<ChartTip labelFormatter={xFmt} names={vNames} valueFormatter={(v) => fmtInt(v)} />} />
                                        <Bar dataKey="up" name={vNames.up} stackId="v" fill={SERIES[0].fill} {...BAR} shape={VOTE_STACK} />
                                        <Bar dataKey="down" name={vNames.down} stackId="v" fill={SERIES[1].fill} {...BAR} shape={VOTE_STACK} />
                                        <Bar dataKey="unvote" name={vNames.unvote} stackId="v" fill={SERIES[2].fill} {...BAR} shape={VOTE_STACK} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <Legend items={[
                                { label: vNames.up, color: SERIES[0].fill, shape: "block" },
                                { label: vNames.down, color: SERIES[1].fill, shape: "block" },
                                { label: vNames.unvote, color: SERIES[2].fill, shape: "block" }
                            ]} />
                        </>
                    ) : this._placeholder(d.votesDim, tr(K + "no_votes", "No vote in this period."))}
                </Card>
                <Card
                    title={tr(K + "artists_title", "Artists")}
                    subtitle={tr(K + "per_day", "per day")}
                    info={tr(K + "artists_info", "Accounts that published at least one artwork that day, and those among them publishing their very first.")}
                >
                    {artists.length ? (
                        <>
                            <div className={classes.chart}>
                                <ResponsiveContainer>
                                    <LineChart data={artists} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                                        <CartesianGrid {...GRID} />
                                        <XAxis dataKey="bucket" tickFormatter={dFmt} {...AXIS} minTickGap={24} />
                                        <YAxis {...AXIS} allowDecimals={false} width={48} />
                                        <Tooltip cursor={CURSOR} content={<ChartTip labelFormatter={dFmt} names={aNames} valueFormatter={(v) => fmtInt(v)} />} />
                                        {["total", "new"].map((k, i) => (
                                            <Line key={k} type="monotone" dataKey={k} name={aNames[k]} stroke={SERIES[i].stroke} strokeDasharray={SERIES[i].dash}
                                                strokeWidth={2} dot={false} activeDot={ACTIVE_DOT} isAnimationActive={false} connectNulls />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            <Legend items={[{ label: aNames.total }, { label: aNames.new }]} />
                        </>
                    ) : this._placeholder(d.artists)}
                </Card>
            </div>
        );
    }

    // ------------------------------------------------------------ finance

    _renderFinance() {
        const { classes } = this.props;
        const { d, period } = this.state;
        const P = PERIODS[period];
        const g = P.grain;
        const to = nowSec() + 3600;
        const from = to - P.seconds;
        const dFrom = period === "24h" ? to - 7 * 86400 : from;
        const xFmt = (b) => bucketLabel(b, g);
        const xTick = (b) => axisTick(b, g);
        const dFmt = (b) => bucketLabel(b, "day");
        const sFmt = (b) => bucketLabel(b, period === "24h" ? "hour" : "day");
        const sTick = (b) => axisTick(b, period === "24h" ? "hour" : "day");

        const split = (d.split || [])
            .filter((v) => v.value > 0)
            .map((v) => ({ dim: v.dim, name: SPLIT_NAMES[v.dim] ? SPLIT_NAMES[v.dim]() : v.dim, value: v.value, share: v.extra ? v.extra.share : null }))
            .sort((a, b) => b.value - a.value);

        const infl = (d.inflation || []).filter((p) => p.dim === "" && p.value != null).map((p) => ({ bucket: p.bucket, v: p.value, rate: p.extra ? p.extra.yearly_rate : null }));
        const lastRate = infl.length ? infl[infl.length - 1].rate : null;
        const paidTo = sumByDim(d.inflation, dFrom, to);
        const RECIPIENTS = [
            ["authors", tr(K + "to_authors", "Authors")],
            ["curators", tr(K + "to_curators", "Curators")],
            ["beneficiaries", tr(K + "to_beneficiaries", "Beneficiaries")],
            ["witnesses", tr(K + "to_witnesses", "Witnesses")],
            ["dpf", tr(K + "to_dpf", "Decentralized Pixa Fund")]
        ];

        const burns = sumByDim(d.burns, from, to);
        const conv = sumByDim(d.conv, from, to);
        const coll = byDim(d.collateral).get("");

        const sav = pivot((d.savings || []).filter((p) => p.bucket >= from), ["", "holders"]);
        const savNow = sav.length ? sav[sav.length - 1] : null;
        const flows = sumByDim(d.savFlows, from, to);
        const interest = sumByDim(d.interest, dFrom, to).get("") || 0;
        const anySavings = sav.some((r) => r.total > 0) || [...flows.values()].some((v) => v > 0) || interest > 0;
        const savTotals = sav.map((r) => r.total).filter((v) => v != null);
        const savScale = niceScale(savTotals.length ? Math.min(...savTotals) : null, savTotals.length ? Math.max(...savTotals) : null, 5);

        const power = fillBuckets(pivot(d.power || [], ["up", "down"]).map((r) => ({ bucket: r.bucket, up: r.up || 0, down: r.down ? -r.down : 0 })), from, to, g, ["up", "down"]);
        const pNames = { up: tr(K + "powered_up", "Powered up"), down: tr(K + "powered_down", "Paid out by power-downs") };
        const pSum = sumByDim(d.power, from, to);
        const powerScale = niceScale(Math.min(0, ...power.map((r) => r.down)), Math.max(0, ...power.map((r) => r.up)), 5, false);
        const pd = sumByDim(d.pdStarted, from, to);
        const dl = sumByDim(d.delegFlows, from, to);
        const delegated = byDim(d.delegated).get("");

        const tx = fillBuckets(pivot(d.transfers || [], ["", "pixa", "pxs"]), from, to, g, ["total", "pixa", "pxs"]);
        const txSum = sumByDim(d.transfers, from, to);
        const mkt = byDim(d.market).get("");
        const trades = sumByDim(d.marketVol, from, to).get("") || 0;

        return (
            <div className={classes.grid2}>
                <Card
                    title={tr(K + "supply_by_holder", "Supply by holder")}
                    subtitle={tr(K + "supply_by_holder_sub", "virtual supply, PIXA equivalent")}
                    info={tr(K + "supply_by_holder_info", "Who holds the supply now, PXS at the median feed and Pixa Power at the current ratio. Users are every account that is not a system, DPF or exchange account.")}
                >
                    {split.length ? (
                        <div style={{ width: "100%", height: `${Math.max(150, split.length * 34)}px` }}>
                            <ResponsiveContainer>
                                <BarChart data={split} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }} barCategoryGap="24%">
                                    <XAxis type="number" hide domain={[0, "dataMax"]} />
                                    <YAxis type="category" dataKey="name" {...AXIS} width={170} tick={{ ...AXIS.tick, fontFamily: "'Normative Pro'", fontSize: 12, fill: "#aaa" }} />
                                    <Tooltip cursor={BAR_CURSOR} content={<ChartTip valueFormatter={(v, p) => `${fmtCompact(v)} PIXA · ${fmtPct(p.payload.share, 1)}`} />} />
                                    <Bar dataKey="value" name={tr(K + "pixa_equivalent", "PIXA equivalent")} fill={SERIES[1].fill} {...HBAR}>
                                        <LabelList dataKey="share" position="right" formatter={(v) => fmtPct(v, 1)} style={{ fill: "#aaa", fontSize: 11, fontFamily: "'Geist Mono', monospace" }} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : this._placeholder(d.split, tr(K + "history_builds", "The history builds up from the Tower's first snapshot, every 5 minutes."))}
                </Card>

                <Card
                    title={tr(K + "new_supply", "New supply")}
                    subtitle={lastRate != null ? trf(K + "yearly_rate_n", "{n} a year at the last day's pace", { n: fmtPct(lastRate, 2) }) : tr(K + "per_day_pixa", "per day, PIXA equivalent")}
                    info={tr(K + "new_supply_info", "Supply created each day: the change in PIXA supply plus the change in PXS supply at the feed, between the Tower's snapshots nearest midnight. Below: what each group received in rewards over the period.")}
                >
                    {infl.length ? (
                        <div className={classes.chartShort}>
                            <ResponsiveContainer>
                                <BarChart data={infl} margin={{ top: 8, right: 16, bottom: 0, left: -8 }} barCategoryGap="24%">
                                    <CartesianGrid {...GRID} />
                                    <XAxis dataKey="bucket" tickFormatter={dFmt} {...AXIS} minTickGap={24} />
                                    <YAxis {...AXIS} width={56} tickFormatter={(v) => fmtCompact(v)} />
                                    <Tooltip
                                        cursor={BAR_CURSOR}
                                        content={<ChartTip labelFormatter={dFmt} valueFormatter={(v, p) => `${fmtCompact(v)} PIXA${p.payload.rate != null ? " · " + fmtPct(p.payload.rate, 2) + " " + tr(K + "a_year", "a year") : ""}`} />}
                                    />
                                    <Bar dataKey="v" name={tr(K + "new_supply", "New supply")} fill={SERIES[0].fill} {...BAR} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : this._placeholder(d.inflation, tr(K + "new_supply_builds", "Needs two of the Tower's snapshots around midnight: the first day appears the day after it starts."))}
                    {d.inflation ? (
                        <div className={classes.stats}>
                            <span className={classes.listTitle} style={{ gridColumn: "1 / -1", margin: 0 }}>
                                {trf(K + "paid_in_period_n", "Paid in the last {n}", { n: period === "24h" ? "7d" : period })}
                            </span>
                            {RECIPIENTS.map(([k, label]) => (
                                <React.Fragment key={k}>
                                    <span className={classes.statLabel}>{label}</span>
                                    <span className={classes.statValue}>{fmtCompact(paidTo.get(k) || 0)} PIXA</span>
                                </React.Fragment>
                            ))}
                        </div>
                    ) : null}
                </Card>

                <Card
                    title={tr(K + "conversions_burns", "Conversions and burns")}
                    subtitle={trf(K + "last_n", "last {n}", { n: period })}
                    info={tr(K + "conversions_burns_info", "PIXA→PXS conversions lock PIXA as collateral and take a 5% fee; PXS→PIXA conversions burn PXS and pay PIXA at the median feed 3.5 days later. Balances sent to the null account are burned.")}
                >
                    {!d.burns && !d.conv ? this._placeholder(d.burns) : (
                        <div className={classes.rows}>
                            <div className={classes.row}>
                                <div className={classes.rowMain}>
                                    <div className={classes.rowTitle}>PIXA → PXS</div>
                                    <div className={classes.rowSub}>{trf(K + "pixa_used_n", "{n} PIXA used, fee included", { n: fmtCompact(conv.get("pixa_to_pxs_in") || 0) })} · {trf(K + "fee_n", "fee {n} PIXA", { n: fmtCompact(burns.get("conversion_fee") || 0) })}</div>
                                </div>
                                <div className={classes.rowValue}>{fmtCompact(conv.get("pixa_to_pxs_out") || 0)} PXS</div>
                            </div>
                            <div className={classes.row}>
                                <div className={classes.rowMain}>
                                    <div className={classes.rowTitle}>PXS → PIXA</div>
                                    <div className={classes.rowSub}>{trf(K + "pxs_burned_n", "{n} PXS burned", { n: fmtCompact(conv.get("pxs_to_pixa_in") || 0) })}</div>
                                </div>
                                <div className={classes.rowValue}>{fmtCompact(conv.get("pxs_to_pixa_out") || 0)} PIXA</div>
                            </div>
                            <div className={classes.row}>
                                <div className={classes.rowMain}>
                                    <div className={classes.rowTitle}>{tr(K + "pending_conversions", "Pending PIXA → PXS")}</div>
                                    <div className={classes.rowSub}>{coll && coll.extra ? trf(K + "requests_n", "open requests: {n}", { n: fmtInt(coll.extra.requests || 0) }) : tr(K + "collateral_locked", "collateral locked")}</div>
                                </div>
                                <div className={classes.rowValue}>{coll && coll.value != null ? `${fmtCompact(coll.value)} PIXA` : "–"}</div>
                            </div>
                            <div className={classes.row}>
                                <div className={classes.rowMain}>
                                    <div className={classes.rowTitle}>{tr(K + "null_burns", "Burned by the null account")}</div>
                                    <div className={classes.rowSub}>{tr(K + "null_burns_sub", "balances sent to @null")}</div>
                                </div>
                                <div className={classes.rowValue}>{fmtCompact(burns.get("pixa_null") || 0)} PIXA · {fmtCompact(burns.get("pxs_null") || 0)} PXS</div>
                            </div>
                        </div>
                    )}
                </Card>

                <Card
                    title={tr(K + "savings", "PXS savings")}
                    subtitle={savNow ? trf(K + "holders_n", "holders: {n}", { n: fmtInt(savNow.holders || 0) }) : ""}
                    info={tr(K + "savings_info", "PXS held in savings by every account except the Decentralized Pixa Fund, and the interest paid on it at the rate the witnesses vote. Withdrawals arrive after 3 days.")}
                >
                    {!d.savings ? this._placeholder(d.savings) : !anySavings ? (
                        <Empty>{tr(K + "no_savings", "No PXS is held in savings yet.")}</Empty>
                    ) : (
                        <>
                            <div className={classes.chartShort}>
                                <ResponsiveContainer>
                                    <LineChart data={sav} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                                        <CartesianGrid {...GRID} />
                                        <XAxis dataKey="bucket" tickFormatter={sTick} {...AXIS} minTickGap={24} />
                                        <YAxis {...AXIS} width={56} domain={savScale.domain} ticks={savScale.ticks} interval={0} tickFormatter={tickFormat(savScale.step)} />
                                        <Tooltip cursor={CURSOR} content={<ChartTip labelFormatter={sFmt} valueFormatter={(v) => `${fmtCompact(v)} PXS`} />} />
                                        <Line type="monotone" dataKey="total" name={tr(K + "in_savings", "In savings")} stroke={SERIES[0].stroke} strokeWidth={2} dot={false} activeDot={ACTIVE_DOT} isAnimationActive={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            <div className={classes.stats}>
                                <span className={classes.statLabel}>{tr(K + "interest_paid", "Interest paid")}{period === "24h" ? " · 7d" : ""}</span>
                                <span className={classes.statValue}>{fmtCompact(interest)} PXS</span>
                                <span className={classes.statLabel}>{tr(K + "deposited", "Deposited")}</span>
                                <span className={classes.statValue}>{fmtCompact(flows.get("pxs_in") || 0)} PXS · {fmtCompact(flows.get("pixa_in") || 0)} PIXA</span>
                                <span className={classes.statLabel}>{tr(K + "withdrawn", "Withdrawn")}</span>
                                <span className={classes.statValue}>{fmtCompact(flows.get("pxs_out") || 0)} PXS · {fmtCompact(flows.get("pixa_out") || 0)} PIXA</span>
                            </div>
                        </>
                    )}
                </Card>

                <Card
                    title={tr(K + "staking", "Staking and delegations")}
                    subtitle={trf(K + "net_n", "net {n} PIXA", { n: `${(pSum.get("") || 0) > 0 ? "+" : ""}${fmtCompact(pSum.get("") || 0)}` })}
                    info={tr(K + "staking_info", "PIXA turned into Pixa Power, and PIXA paid back by weekly power-down instalments. Delegations lend Pixa Power without moving ownership.")}
                >
                    {!d.power ? this._placeholder(d.power) : (
                        <>
                            {power.some((r) => r.up || r.down) ? (
                                <>
                                    <div className={classes.chartShort}>
                                        <ResponsiveContainer>
                                            <BarChart data={power} margin={{ top: 8, right: 16, bottom: 0, left: -8 }} stackOffset="sign" barCategoryGap="24%">
                                                <CartesianGrid {...GRID} />
                                                <XAxis dataKey="bucket" tickFormatter={xTick} {...AXIS} minTickGap={24} />
                                                <YAxis {...AXIS} width={56} domain={powerScale.domain} ticks={powerScale.ticks} interval={0} tickFormatter={tickFormat(powerScale.step)} />
                                                <ReferenceLine y={0} stroke="rgba(255,255,255,0.18)" />
                                                <Tooltip cursor={BAR_CURSOR} content={<ChartTip labelFormatter={xFmt} names={pNames} valueFormatter={(v) => `${fmtCompact(Math.abs(v))} PIXA`} />} />
                                                <Bar dataKey="up" name={pNames.up} stackId="p" fill={SERIES[0].fill} {...BAR} shape={POWER_STACK} />
                                                <Bar dataKey="down" name={pNames.down} stackId="p" fill={SERIES[2].fill} {...BAR} shape={POWER_STACK} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <Legend items={[{ label: pNames.up, color: SERIES[0].fill, shape: "block" }, { label: pNames.down, color: SERIES[2].fill, shape: "block" }]} />
                                </>
                            ) : <Empty>{tr(K + "no_power_moves", "No power-up or power-down payment in this period.")}</Empty>}
                            <div className={classes.stats}>
                                <span className={classes.statLabel}>{tr(K + "powerdowns_started", "Power-downs started")}</span>
                                <span className={classes.statValue}>{fmtInt(pd.get("") || 0)} · {trf(K + "stopped_n", "{n} stopped", { n: fmtInt(pd.get("stopped") || 0) })}</span>
                                <span className={classes.statLabel}>{tr(K + "delegations", "Delegations")}</span>
                                <span className={classes.statValue}>{trf(K + "delegation_moves_n", "{a} new · {b} changed · {c} removed", { a: fmtInt(dl.get("started") || 0), b: fmtInt(dl.get("changed") || 0), c: fmtInt(dl.get("removed") || 0) })}</span>
                                <span className={classes.statLabel}>{tr(K + "delegated_now", "Delegated now")}</span>
                                <span className={classes.statValue}>{delegated && delegated.value != null ? `${fmtCompact(delegated.value)} PXP · ${fmtInt(delegated.extra ? delegated.extra.delegations : 0)}` : "–"}</span>
                            </div>
                        </>
                    )}
                </Card>

                <Card
                    title={tr(K + "transfers_title", "Transfers")}
                    subtitle={trf(K + "transfers_sub_n", "between accounts: {n}", { n: fmtInt(txSum.get("") || 0) })}
                    info={tr(K + "transfers_info", "PIXA and PXS sent from one account to another, recurrent payments included, savings moves excluded.")}
                >
                    {!d.transfers ? this._placeholder(d.transfers) : (
                        <>
                            {tx.some((r) => r.total) ? (
                                <div className={classes.chartShort}>
                                    <ResponsiveContainer>
                                        <BarChart data={tx} margin={{ top: 8, right: 16, bottom: 0, left: -16 }} barCategoryGap="24%">
                                            <CartesianGrid {...GRID} />
                                            <XAxis dataKey="bucket" tickFormatter={xTick} {...AXIS} minTickGap={24} />
                                            <YAxis {...AXIS} allowDecimals={false} width={48} />
                                            <Tooltip
                                                cursor={BAR_CURSOR}
                                                content={<ChartTip labelFormatter={xFmt} valueFormatter={(v, p) => `${fmtInt(v)} · ${fmtCompact(p.payload.pixa || 0)} PIXA · ${fmtCompact(p.payload.pxs || 0)} PXS`} />}
                                            />
                                            <Bar dataKey="total" name={tr(K + "transfers_title", "Transfers")} fill={SERIES[1].fill} {...BAR} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : <Empty>{tr(K + "no_transfers", "No transfer in this period.")}</Empty>}
                            <div className={classes.stats}>
                                <span className={classes.statLabel}>{tr(K + "moved", "Moved")}</span>
                                <span className={classes.statValue}>{fmtCompact(txSum.get("pixa") || 0)} PIXA · {fmtCompact(txSum.get("pxs") || 0)} PXS</span>
                                <span className={classes.statLabel}>{tr(K + "internal_market", "Internal market")}</span>
                                <span className={classes.statValue}>
                                    {mkt && mkt.value != null
                                        ? `${mkt.value.toFixed(3)} PIXA/PXS · ${trf(K + "trades_n", "trades: {n}", { n: fmtInt(trades) })}`
                                        : tr(K + "no_trade", "no trade yet")}
                                </span>
                            </div>
                        </>
                    )}
                </Card>
            </div>
        );
    }

    // ------------------------------------------------------------ network

    _renderNetwork() {
        const { classes } = this.props;
        const { d, period } = this.state;
        const P = PERIODS[period];
        const to = nowSec() + 3600;
        const from = to - P.seconds;
        const dFrom = period === "24h" ? to - 7 * 86400 : from;
        const dFmt = (b) => bucketLabel(b, "day");

        const regs = d.regs
            // computed once a day is over: up to yesterday, so today never reads as 0
            ? fillBuckets(d.regs.filter((p) => p.dim === "" && p.extra).map((p) => ({ bucket: p.bucket, created: p.extra.created || 0, active: p.value || 0 })), dFrom, Math.floor(nowSec() / 86400) * 86400, "day", ["created", "active"])
            : [];
        const created = regs.reduce((t, r) => t + r.created, 0);
        const activated = regs.reduce((t, r) => t + r.active, 0);
        const rNames = { created: tr(K + "accounts_created", "Accounts created"), active: tr(K + "became_active", "Became active since") };
        const creators = topOf(sumByDim(d.creators, dFrom, to), 4);

        const members = (d.everActive || []).filter((p) => p.dim === "").map((p) => ({ bucket: p.bucket, active: p.value, registered: p.extra ? p.extra.registered : null }));
        const lastM = members.length ? members[members.length - 1] : null;
        const mNames = { registered: tr(K + "registered", "Registered"), active: tr(K + "took_part", "Took part at least once") };

        const apps = topOf(sumByDim(d.apps, dFrom, to), 6);
        const appMax = Math.max(1, ...apps.map((x) => x[1]));
        const tags = topOf(sumByDim(d.tags, period === "90d" ? from - 7 * 86400 + 1 : from, to), 8);
        const tagMax = Math.max(1, ...tags.map((x) => x[1]));

        const bs = byDim(d.bandsS);
        const ba = byDim(d.bandsA);
        const bands = STAKE_BANDS.filter((b) => bs.has(b)).map((b) => {
            const s = bs.get(b);
            const a = ba.get(b);
            return {
                band: b, share: s.value || 0, pxp: s.extra ? s.extra.pxp : null, inactive: s.extra ? s.extra.inactive_share : null,
                accounts: a ? a.value : null, inactiveAccounts: a && a.extra ? a.extra.inactive : null
            };
        });
        const inactivePxp = bands.reduce((t, b) => t + (bs.get(b.band).extra ? bs.get(b.band).extra.inactive_pxp || 0 : 0), 0);
        const totalPxp = bands.reduce((t, b) => t + (b.pxp || 0), 0);

        const ps = byDim(d.payStats);
        const paid = (k) => ps.has(k) && ps.get(k).value != null; // the stat writes every dimension, null when nothing was paid
        const payKinds = [["all", tr(K + "all_posts", "All posts")], ["artwork", tr(K + "artworks_short", "Artworks")], ["blog", tr(K + "blogs_short", "Blog posts")]];
        const paidSum = sumByDim(d.payouts, from, to);

        return (
            <div className={classes.grid2}>
                <Card
                    title={tr(K + "registrations", "Registrations")}
                    subtitle={created ? trf(K + "activation_n", "{n} became active", { n: fmtPct(activated / created, 0) }) : tr(K + "per_day", "per day")}
                    info={tr(K + "registrations_info", "User accounts created each day, and how many of them have voted, posted or commented since. Recent days keep filling in as new accounts start.")}
                >
                    {regs.length ? (
                        <>
                            <div className={classes.chartShort}>
                                <ResponsiveContainer>
                                    <BarChart data={regs} margin={{ top: 8, right: 16, bottom: 0, left: -16 }} barGap={2} barCategoryGap="24%">
                                        <CartesianGrid {...GRID} />
                                        <XAxis dataKey="bucket" tickFormatter={dFmt} {...AXIS} minTickGap={24} />
                                        <YAxis {...AXIS} allowDecimals={false} width={48} />
                                        <Tooltip cursor={BAR_CURSOR} content={<ChartTip labelFormatter={dFmt} names={rNames} valueFormatter={(v) => fmtInt(v)} />} />
                                        <Bar dataKey="created" name={rNames.created} fill={SERIES[0].fill} {...BAR} />
                                        <Bar dataKey="active" name={rNames.active} fill={SERIES[1].fill} {...BAR} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <Legend items={[{ label: rNames.created, color: SERIES[0].fill, shape: "block" }, { label: rNames.active, color: SERIES[1].fill, shape: "block" }]} />
                        </>
                    ) : this._placeholder(d.regs)}
                    {creators.length ? (
                        <div className={classes.stats}>
                            {creators.map(([who, n]) => (
                                <React.Fragment key={who}>
                                    <span className={classes.statLabel}>{trf(K + "created_by_n", "created by @{n}", { n: who })}</span>
                                    <span className={classes.statValue}>{fmtInt(n)}</span>
                                </React.Fragment>
                            ))}
                        </div>
                    ) : null}
                </Card>

                <Card
                    title={tr(K + "members", "Members")}
                    subtitle={lastM && lastM.registered ? trf(K + "members_sub_n", "{a} of {b} accounts took part", { a: fmtInt(lastM.active), b: fmtInt(lastM.registered) }) : ""}
                    info={tr(K + "members_info", "User accounts registered, and those that have voted, posted or commented at least once, at the end of each day.")}
                >
                    {members.length ? (
                        <>
                            <div className={classes.chartShort}>
                                <ResponsiveContainer>
                                    <LineChart data={members} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                                        <CartesianGrid {...GRID} />
                                        <XAxis dataKey="bucket" tickFormatter={dFmt} {...AXIS} minTickGap={24} />
                                        <YAxis {...AXIS} allowDecimals={false} width={48} domain={[0, "auto"]} />
                                        <Tooltip cursor={CURSOR} content={<ChartTip labelFormatter={dFmt} names={mNames} valueFormatter={(v) => fmtInt(v)} />} />
                                        <Line type="monotone" dataKey="registered" name={mNames.registered} stroke={SERIES[1].stroke} strokeDasharray={SERIES[1].dash} strokeWidth={2} dot={false} activeDot={ACTIVE_DOT} isAnimationActive={false} />
                                        <Line type="monotone" dataKey="active" name={mNames.active} stroke={SERIES[0].stroke} strokeWidth={2} dot={false} activeDot={ACTIVE_DOT} isAnimationActive={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            <Legend items={[{ label: mNames.active }, { label: mNames.registered, color: SERIES[1].stroke, dash: SERIES[1].dash }]} />
                        </>
                    ) : this._placeholder(d.everActive)}
                </Card>

                <Card
                    title={tr(K + "apps", "Apps")}
                    subtitle={`${tr(K + "apps_sub", "posts and comments by the app that wrote them")}${period === "24h" ? " · 7d" : ""}`}
                    info={tr(K + "apps_info", "From the app field of each post's metadata. Posts written without one count as unknown.")}
                >
                    {!d.apps ? this._placeholder(d.apps) : apps.length === 0 ? <Empty>{tr(K + "no_posts", "No post or comment in this period.")}</Empty> : (
                        <div className={classes.rows}>
                            {apps.map(([app, n]) => (
                                <div key={app} className={classes.row}>
                                    <div className={classes.rowMain}>
                                        <div className={classes.rowTitle}>{app === "unknown" ? tr(K + "unknown_app", "No app given") : app}</div>
                                        <div className={classes.rowMeter}><Meter value={n / appMax} /></div>
                                    </div>
                                    <div className={classes.rowValue}>{fmtInt(n)}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                <Card
                    title={tr(K + "tags", "Tags")}
                    subtitle={tr(K + "tags_sub", "artworks and blog posts by tag")}
                    info={tr(K + "tags_info", "Top-level posts first published in the period with each tag. A post with several tags counts once for each.")}
                >
                    {!d.tags ? this._placeholder(d.tags) : tags.length === 0 ? <Empty>{tr(K + "no_tags", "No tagged post in this period.")}</Empty> : (
                        <div className={classes.rows}>
                            {tags.map(([tag, n]) => (
                                <div key={tag} className={classes.row}>
                                    <div className={classes.rowMain}>
                                        <div className={classes.rowTitle}>#{tag}</div>
                                        <div className={classes.rowMeter}><Meter value={n / tagMax} /></div>
                                    </div>
                                    <div className={classes.rowValue}>{fmtInt(n)}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                <Card
                    title={tr(K + "stake_by_band", "Stake by band")}
                    subtitle={totalPxp ? trf(K + "inactive_stake_n", "{n} of user stake is idle", { n: fmtPct(inactivePxp / totalPxp, 0) }) : ""}
                    info={tr(K + "stake_by_band_info", "Share of user Pixa Power held by accounts in each band of own stake. Idle: no post, comment or vote in 30 days.")}
                >
                    {bands.length ? (
                        <div className={classes.chartShort}>
                            <ResponsiveContainer>
                                <BarChart data={bands} margin={{ top: 20, right: 16, bottom: 0, left: -8 }} barCategoryGap="24%">
                                    <CartesianGrid {...GRID} />
                                    <XAxis dataKey="band" {...AXIS} interval={0} tickFormatter={(b) => (b.startsWith("<") || b.endsWith("+") ? b : b.split("-")[0] + "+")} />
                                    <YAxis {...AXIS} width={48} domain={[0, 1]} tickFormatter={(v) => fmtPct(v, 0)} />
                                    <Tooltip
                                        cursor={BAR_CURSOR}
                                        content={<ChartTip labelFormatter={(l) => `${l} PXP`} valueFormatter={(v, p) => `${fmtPct(v, 1)} · ${fmtCompact(p.payload.pxp)} PXP · ${trf(K + "accounts_n", "accounts: {n}", { n: fmtInt(p.payload.accounts) })}${p.payload.inactive != null ? " · " + trf(K + "idle_n", "{n} idle", { n: fmtPct(p.payload.inactive, 0) }) : ""}`} />}
                                    />
                                    <Bar dataKey="share" name={tr(K + "share_of_stake", "Share of user stake")} fill={SERIES[1].fill} {...BAR}>
                                        <LabelList dataKey="share" position="top" formatter={(v) => fmtPct(v, 0)} style={{ fill: "#aaa", fontSize: 11, fontFamily: "'Geist Mono', monospace" }} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : this._placeholder(d.bandsS)}
                </Card>

                <Card
                    title={tr(K + "payouts", "Payouts")}
                    subtitle={tr(K + "payouts_sub", "per top-level post, last 30 days, PXS")}
                    info={tr(K + "payouts_info", "Payout value of posts paid in the 30 days to yesterday. The line below sums everything paid in the selected period, comments included.")}
                >
                    {!d.payStats ? this._placeholder(d.payStats) : !paid("all:median") ? (
                        <Empty>{tr(K + "no_payouts", "No post was paid in the last 30 days.")}</Empty>
                    ) : (
                        <div className={classes.rows}>
                            {payKinds.filter(([k]) => paid(k + ":median")).map(([k, label]) => {
                                const max = ps.get(k + ":max");
                                const post = max && max.extra ? max.extra.post : null;
                                return (
                                    <div key={k} className={classes.row}>
                                        <div className={classes.rowMain}>
                                            <div className={classes.rowTitle}>{label}</div>
                                            <div className={classes.rowSub}>
                                                {trf(K + "avg_max_n", "average {a} · highest {m}", { a: fmtCompact(ps.get(k + ":avg") ? ps.get(k + ":avg").value : null), m: fmtCompact(max ? max.value : null) })}
                                                {post ? ` · @${post.split("/")[0]}` : ""}
                                            </div>
                                        </div>
                                        <div className={classes.rowValue}>{trf(K + "median_n", "median {n}", { n: fmtCompact(ps.get(k + ":median").value) })}</div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {d.payouts ? (
                        <div className={classes.note}>
                            {trf(K + "paid_in_period_n", "Paid in the last {n}", { n: period })}: {fmtCompact(paidSum.get("") || 0)} PXS · {tr(K + "artworks_short", "Artworks")} {fmtCompact(paidSum.get("artwork") || 0)} · {tr(K + "blogs_short", "Blog posts")} {fmtCompact(paidSum.get("blog") || 0)} · {tr(K + "comments_short", "Comments")} {fmtCompact(paidSum.get("reply") || 0)}
                        </div>
                    ) : null}
                </Card>
            </div>
        );
    }

    // ------------------------------------------------------------ artwork

    _renderArtwork() {
        const { classes } = this.props;
        const { d, period } = this.state;
        const P = PERIODS[period];
        const to = nowSec() + 3600;
        const from = to - P.seconds;
        const dFrom = period === "24h" ? to - 7 * 86400 : from;
        const dFmt = (b) => bucketLabel(b, "day");
        const eng = pivot(d.engagement || [], ["votes", "comments"]);
        const eNames = { votes: tr(K + "median_votes", "Median votes"), comments: tr(K + "median_comments", "Median comments") };
        const fm = sumByDim(d.formats, dFrom, to);
        const canvas = CANVAS_DIMS.map((k) => [k.slice(7), fm.get(k) || 0]);
        const bytes = BYTES_DIMS.map((k) => [k.slice(6), fm.get(k) || 0]);
        const fmMax = Math.max(1, ...canvas.map((x) => x[1]), ...bytes.map((x) => x[1]));
        const anyFormat = canvas.some((x) => x[1]) || bytes.some((x) => x[1]);
        const ta = byDim(d.topArtists).get("");
        const tc = byDim(d.topCurators).get("");
        const list = (rows, key, fmt) => (
            <div className={classes.rows}>
                {rows.length === 0 ? <Empty>{tr(K + "nobody_yet", "Nobody yet.")}</Empty> : rows.slice(0, 5).map((r, i) => (
                    <div key={r.account} className={classes.row}>
                        <div className={classes.rowMain}><div className={classes.rowTitle}>{i + 1}. @{r.account}</div></div>
                        <div className={classes.rowValue}>{fmt(r[key])}</div>
                    </div>
                ))}
            </div>
        );
        return (
            <div className={classes.grid2}>
                <Card
                    title={tr(K + "engagement", "Engagement per artwork")}
                    subtitle={tr(K + "engagement_sub", "within 7 days of publication, by publication day")}
                    info={tr(K + "engagement_info", "Median votes and comments an artwork received in its first 7 days, the author's own excluded. A day appears 7 days after it ends.")}
                >
                    {eng.length ? (
                        <>
                            <div className={classes.chartShort}>
                                <ResponsiveContainer>
                                    <LineChart data={eng} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                                        <CartesianGrid {...GRID} />
                                        <XAxis dataKey="bucket" tickFormatter={dFmt} {...AXIS} minTickGap={24} />
                                        <YAxis {...AXIS} width={48} allowDecimals={false} />
                                        <Tooltip cursor={CURSOR} content={<ChartTip labelFormatter={dFmt} names={eNames} valueFormatter={(v) => (v == null ? "–" : v.toFixed(1))} />} />
                                        {["votes", "comments"].map((k, i) => (
                                            <Line key={k} type="monotone" dataKey={k} name={eNames[k]} stroke={SERIES[i].stroke} strokeDasharray={SERIES[i].dash}
                                                strokeWidth={2} dot={false} activeDot={ACTIVE_DOT} isAnimationActive={false} connectNulls />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            <Legend items={[{ label: eNames.votes }, { label: eNames.comments }]} />
                        </>
                    ) : this._placeholder(d.engagement, tr(K + "engagement_wait", "Each day appears 7 days after it ends."))}
                </Card>

                <Card
                    title={tr(K + "formats", "Artwork formats")}
                    subtitle={trf(K + "published_last_n", "published in the last {n}", { n: period === "24h" ? "7d" : period })}
                    info={tr(K + "formats_info", "Canvas: the longest side in pixels. Size: the artwork's data on chain.")}
                >
                    {!d.formats ? this._placeholder(d.formats) : !anyFormat ? <Empty>{tr(K + "no_artworks", "No artwork in this period.")}</Empty> : (
                        <div className={classes.cols2}>
                            {[[tr(K + "canvas", "Canvas"), canvas, "px"], [tr(K + "data_size", "Size"), bytes, ""]].map(([title, rows, unit]) => (
                                <div key={title}>
                                    <div className={classes.listTitle}>{title}</div>
                                    <div className={classes.rows}>
                                        {rows.map(([k, n]) => (
                                            <div key={k} className={classes.row}>
                                                <div className={classes.rowMain}>
                                                    <div className={classes.rowTitle}>{k.replace("<=", "≤ ").replace(">=", "≥ ").replace(">", "> ").replace("<", "< ")}{unit ? " " + unit : ""}</div>
                                                    <div className={classes.rowMeter}><Meter value={n / fmMax} /></div>
                                                </div>
                                                <div className={classes.rowValue}>{fmtInt(n)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                <Card
                    title={tr(K + "top_artists", "Top artists")}
                    subtitle={ta ? trf(K + "artists_paid_n", "last 30 days · artists paid: {n}", { n: fmtInt(ta.value) }) : tr(K + "last_30_days", "last 30 days")}
                    info={tr(K + "top_artists_info", "By author rewards on artworks paid in the last 30 days (PIXA equivalent), and by distinct accounts that upvoted their artworks published in those days.")}
                >
                    {!ta ? this._placeholder(d.topArtists) : (
                        <div className={classes.cols2}>
                            <div>
                                <div className={classes.listTitle}>{tr(K + "by_rewards", "By rewards")}</div>
                                {list(ta.extra ? ta.extra.by_rewards || [] : [], "pixa_eq", (v) => `${fmtCompact(v)} PIXA`)}
                            </div>
                            <div>
                                <div className={classes.listTitle}>{tr(K + "by_voters", "By voters")}</div>
                                {list(ta.extra ? ta.extra.by_voters || [] : [], "voters", (v) => fmtInt(v))}
                            </div>
                        </div>
                    )}
                </Card>

                <Card
                    title={tr(K + "top_curators", "Top curators")}
                    subtitle={tc ? trf(K + "curators_paid_n", "last 30 days · curators paid: {n}", { n: fmtInt(tc.value) }) : tr(K + "last_30_days", "last 30 days")}
                    info={tr(K + "top_curators_info", "By curation rewards received in the last 30 days (Pixa Power), and by artworks of others they upvoted.")}
                >
                    {!tc ? this._placeholder(d.topCurators) : (
                        <div className={classes.cols2}>
                            <div>
                                <div className={classes.listTitle}>{tr(K + "by_rewards", "By rewards")}</div>
                                {list(tc.extra ? tc.extra.by_rewards || [] : [], "pxp", (v) => `${fmtCompact(v)} PXP`)}
                            </div>
                            <div>
                                <div className={classes.listTitle}>{tr(K + "by_artworks_voted", "By artworks upvoted")}</div>
                                {list(tc.extra ? tc.extra.by_artworks_voted || [] : [], "artworks", (v) => fmtInt(v))}
                            </div>
                        </div>
                    )}
                </Card>
            </div>
        );
    }

    _placeholder(value, emptyText) {
        if (value === undefined && this.state.loading) return <Skeleton height={220} />;
        return <Empty>{emptyText || tr(K + "no_data", "No data for this period yet.")}</Empty>;
    }

    render() {
        const { classes } = this.props;
        const { period, pending, error, meta } = this.state;
        return (
            <DialogContent className={classes.dialogContent}>
                <div ref={this.root}>
                    <div className={classes.topBar}>
                        <Switch label={tr(K + "period", "Period")} value={pending || period} onChange={this._setPeriod} options={PERIOD_OPTIONS} />
                        {meta && meta.as_of_block ? (
                            <span className={classes.asOf}>
                                {tr(K + "block", "block")} {fmtInt(meta.as_of_block)} · {trf(K + "ago_n", "{n} ago", { n: fmtAgo(meta.as_of_time) })}
                                {meta.ingest_lag_blocks > 1200 ? " · " : ""}
                                {meta.ingest_lag_blocks > 1200 ? <Pill level="amber">{tr(K + "catching_up", "catching up")}</Pill> : null}
                            </span>
                        ) : null}
                    </div>
                    {error ? <div className={classes.error}><Pill level="amber">{tr(K + "offline", "offline")}</Pill>{error}</div> : null}

                    <Section
                        title={tr(K + "pulse", "Pulse")}
                        description={tr(K + "pulse_description", "Activity on the Pixa chain over the selected period, against the period before.")}
                    />
                    {this._renderPulse()}

                    <Section title={tr(K + "activity", "Activity")} description={tr(K + "activity_description", "Who is active, and what they publish.")} />
                    {this._renderActivity()}
                    {this._renderVotesAndArtists()}

                    <Section
                        title={tr(K + "controversy", "Controversy")}
                        description={tr(K + "controversy_description", "Where stake disagrees: the topics that divide voters, by portal and by post.")}
                    />
                    {this._renderControversy()}

                    <Section
                        title={tr(K + "economy", "Economy")}
                        description={tr(K + "economy_description", "Supply, the PXS debt ratio, the price feed, how stake is spread and where rewards go.")}
                    />
                    {this._renderEconomy()}

                    <Section
                        title={tr(K + "finance", "Finance")}
                        description={tr(K + "finance_description", "Who holds the supply, how much is created, and how PIXA and PXS move: conversions, savings, staking and transfers.")}
                    />
                    {this._renderFinance()}

                    <Section
                        title={tr(K + "network", "Network")}
                        description={tr(K + "network_description", "Who joins and takes part, the apps and tags they use, how stake is spread and what posts earn.")}
                    />
                    {this._renderNetwork()}

                    <Section
                        title={tr(K + "artwork", "Artwork")}
                        description={tr(K + "artwork_description", "How artworks are received, their formats, and who leads among artists and curators.")}
                    />
                    {this._renderArtwork()}

                    <Section title={tr(K + "chain_and_onboarding", "Chain and onboarding")} description={tr(K + "chain_description", "Throughput, and how new accounts become active members.")} />
                    {this._renderChainAndFunnel()}

                    <Section
                        title={tr(K + "reports", "Reports")}
                        description={tr(K + "reports_description", "Finance and statistics reports for each day, week and month, compared with the period before, ready to post.")}
                    />
                    <GDReports
                        kinds={["finance", "statistics"]}
                        title={tr(K + "reports_card", "Finance and statistics reports")}
                        info={tr(K + "reports_info", "Written by the Tower when a period closes; the current period is built on request. Copy puts the Markdown on the clipboard.")}
                    />
                </div>
            </DialogContent>
        );
    }
}

export default withLanguage(withStyles(styles)(GDMetrics));
