import * as React from "preact/compat";

import withStyles from "@material-ui/core/styles/withStyles";
import DialogContent from "@material-ui/core/DialogContent";
import {
    ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell
} from "recharts";

import { withLanguage } from "../utils/withLanguage";
import {
    towerGet, towerSeries, PERIODS, nowSec, sumWindows, pivot, fmtCompact, fmtInt, fmtPct, fmtBucket, fmtAgo
} from "../utils/tower";
import {
    tr, trf, Section, Card, Tile, ChartTip, Legend, Pill, Switch, Empty, Skeleton, Meter, Visible,
    SERIES, AXIS, GRID, CURSOR, BAR_CURSOR, ACTIVE_DOT, INK
} from "./GDTowerKit";

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

class GDMetrics extends React.PureComponent {
    state = { period: "7d", cohortWeeksAgo: 2, loading: true, error: null, d: {}, meta: null };
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
        if (period === this.state.period) return;
        this.setState({ period, loading: true }, () => this.load());
    };

    _setCohort = (cohortWeeksAgo) => {
        this.setState({ cohortWeeksAgo }, () => this.loadFunnel());
    };

    loadFunnel() {
        const at = nowSec() - this.state.cohortWeeksAgo * 7 * 86400;
        return towerGet(`/funnel?cohort=${at}`, 300000)
            .then((r) => this.setState((s) => ({ d: { ...s.d, funnel: r.data } })))
            .catch(() => null);
    }

    load() {
        const seq = ++this.seq;
        const { period } = this.state;
        const P = PERIODS[period];
        const to = nowSec() + 3600;
        const from = to - P.seconds;
        const from2 = from - P.seconds; // the previous period, for the change
        const g = P.grain;
        const dayFrom = period === "24h" ? to - 3 * 86400 : from2;
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
            status: soft(towerGet("/status", 15000))
        };
        const keys = Object.keys(jobs);
        Promise.all(keys.map((k) => jobs[k])).then((values) => {
            if (seq !== this.seq) return;
            const d = { ...this.state.d };
            keys.forEach((k, i) => (d[k] = values[i]));
            const ok = values.some((v) => v !== null);
            this.setState({
                d, loading: false, meta: d.status ? d.status.meta : null,
                error: ok ? null : tr(K + "unreachable", "The statistics service cannot be reached right now.")
            });
        });
        this.loadFunnel();
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
        const xFmt = (b) => fmtBucket(b, g);
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
                                        <XAxis dataKey="bucket" tickFormatter={xFmt} {...AXIS} minTickGap={24} />
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
                                        <XAxis dataKey="bucket" tickFormatter={xFmt} {...AXIS} minTickGap={24} />
                                        <YAxis {...AXIS} allowDecimals={false} width={48} />
                                        <Tooltip cursor={BAR_CURSOR} content={<ChartTip labelFormatter={xFmt} names={names} />} />
                                        <Bar dataKey="artworks" name={names.artworks} fill={SERIES[0].fill} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                                        <Bar dataKey="blogs" name={names.blogs} fill={SERIES[1].fill} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <Legend items={[{ label: names.artworks, color: SERIES[0].fill, dash: "" }, { label: names.blogs, color: SERIES[1].fill, dash: "" }]} />
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
        const xFmt = (b) => fmtBucket(b, g);
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
                                        <XAxis dataKey="bucket" tickFormatter={xFmt} {...AXIS} minTickGap={24} />
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
                                        <XAxis dataKey="bucket" tickFormatter={xFmt} {...AXIS} minTickGap={24} />
                                        <YAxis {...AXIS} domain={["auto", "auto"]} width={56} tickFormatter={(v) => v.toFixed(1)} />
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
        const xFmt = (b) => fmtBucket(b, g);
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
                                        <XAxis dataKey="bucket" tickFormatter={xFmt} {...AXIS} minTickGap={24} />
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

    _placeholder(value, emptyText) {
        if (value === undefined && this.state.loading) return <Skeleton height={220} />;
        return <Empty>{emptyText || tr(K + "no_data", "No data for this period yet.")}</Empty>;
    }

    render() {
        const { classes } = this.props;
        const { period, error, meta } = this.state;
        return (
            <DialogContent className={classes.dialogContent}>
                <div ref={this.root}>
                    <div className={classes.topBar}>
                        <Switch label={tr(K + "period", "Period")} value={period} onChange={this._setPeriod} options={PERIOD_OPTIONS} />
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

                    <Section title={tr(K + "chain_and_onboarding", "Chain and onboarding")} description={tr(K + "chain_description", "Throughput, and how new accounts become active members.")} />
                    {this._renderChainAndFunnel()}
                </div>
            </DialogContent>
        );
    }
}

export default withLanguage(withStyles(styles)(GDMetrics));
