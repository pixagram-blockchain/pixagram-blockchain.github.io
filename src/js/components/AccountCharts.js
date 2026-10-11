// Charts of one account, read from the Pixa Tower:
//   AccountActivity  profile, below "About": the last 30 days against the 30 before
//   BalanceHistory   wallet, History view: balances, rewards and transfers over time
//   FollowHistory    followers / following list: the count over time, follows gained and lost
// Same greyscale language as the governance dialog (GDTowerKit). Each loads only once it is on screen
// (the wallet and the follow list mount theirs inside a collapsed section).
import * as React from "preact/compat";

import withStyles from "@material-ui/core/styles/withStyles";
import List from "@material-ui/core/List";
import ListSubheader from "@material-ui/core/ListSubheader";
import { ResponsiveContainer } from "recharts/lib/component/ResponsiveContainer";
import { BarChart } from "recharts/lib/chart/BarChart";
import { ComposedChart } from "recharts/lib/chart/ComposedChart";
import { Bar } from "recharts/lib/cartesian/Bar";
import { Line } from "recharts/lib/cartesian/Line";
import { Area } from "recharts/lib/cartesian/Area";
import { XAxis } from "recharts/lib/cartesian/XAxis";
import { YAxis } from "recharts/lib/cartesian/YAxis";
import { CartesianGrid } from "recharts/lib/cartesian/CartesianGrid";
import { ReferenceLine } from "recharts/lib/cartesian/ReferenceLine";
import { Tooltip } from "recharts/lib/component/Tooltip";

import { useLanguage } from "../utils/text";
import { fmtCompact, fmtInt, fmtPct } from "../utils/tower";
import { accountActivity, accountHistory, changeOf, isNotFound, ACCOUNT_RANGE_OPTIONS } from "../utils/towerAccount";
import {
    tr, trf, ChartTip, Legend, Switch, Empty, Skeleton, Meter, MiniStat, MiniStats, Frame,
    SERIES, AXIS, GRID, CURSOR, BAR_CURSOR, ACTIVE_DOT, BAR, BAND, stackShape, niceScale, tickFormat, axisTick, bucketLabel, useSeen
} from "./GDTowerKit";

const K = "components.account_charts.";

// Stacks, bottom to top (stackShape: 2 px between segments, rounded outer end only).
const ACTIVITY_STACK = stackShape(["content", "votes"]);
const FLOW_STACK = stackShape(["rewards", "received", "sent"]);
const FOLLOW_STACK = stackShape(["gained", "lost"]);

const styles = () => ({
    block: { padding: "0 16px 16px 16px" },
    controls: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "12px" },
    chartTitle: {
        fontSize: "11px",
        color: "#888",
        fontFamily: "'Industry Book'",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        margin: "16px 0 4px 0"
    },
    chartSub: { fontSize: "12px", color: "#666", fontFamily: "'Normative Pro'", marginBottom: "6px" },
    chart: { width: "100%", height: "150px" },
    chartTall: { width: "100%", height: "200px" },
    chartShort: { width: "100%", height: "120px" },
    rows: { display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" },
    row: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", columnGap: "12px", rowGap: "4px" },
    rowLabel: { fontSize: "13px", color: "#ccc", fontFamily: "'Normative Pro'", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    rowValue: { fontSize: "12px", color: "#fff", fontFamily: "'Geist Mono', monospace", textAlign: "right" },
    rowMeter: { gridColumn: "1 / -1" },
    note: { fontSize: "12px", color: "#666", fontFamily: "'Normative Pro'", marginTop: "10px", lineHeight: 1.5 },
    offline: { fontSize: "12px", color: "#888", fontFamily: "'Normative Pro'", lineHeight: 1.5, padding: "8px 0" }
});

// ---------------------------------------------------------------- data

/** Loads `load()` whenever `key` changes; keeps the previous data while the next arrives. */
function useTower(key, load) {
    const [state, setState] = React.useState({ data: null, error: null, loading: true, key: null });
    React.useEffect(() => {
        if (!key) return undefined;
        let alive = true;
        setState((s) => ({ ...s, loading: true }));
        load()
            .then((data) => alive && setState({ data, error: null, loading: false, key }))
            .catch((error) => alive && setState((s) => ({ data: s.key === key ? s.data : null, error, loading: false, key })));
        return () => {
            alive = false;
        };
    }, [key]);
    return state;
}


const RANGE_LABELS = {
    "48h": () => tr(K + "range_48h", "48 h"),
    "30d": () => tr(K + "range_30d", "30 d"),
    "1y": () => tr(K + "range_1y", "1 y"),
    all: () => tr(K + "range_all", "All")
};
const rangeOptions = () => ACCOUNT_RANGE_OPTIONS.map((r) => ({ value: r, label: RANGE_LABELS[r]() }));

/** Why there is nothing to draw: the Tower has no data for this account, or it cannot be reached. */
function Unavailable({ classes, error }) {
    return (
        <div className={classes.offline}>
            {isNotFound(error)
                ? tr(K + "no_data_account", "The statistics service has no data for this account yet.")
                : tr(K + "unreachable", "The statistics service cannot be reached right now.")}
        </div>
    );
}

const sum = (xs) => xs.reduce((t, x) => t + (x || 0), 0);
const humanOp = (type) => String(type || "").replace(/_operation$/, "").replace(/_/g, " ");

// ---------------------------------------------------------------- profile

/**
 * Profile, below "About": what the account did in the last 30 days against the 30 before, and its
 * daily votes and publications.
 */
export const AccountActivity = withStyles(styles)(function AccountActivity({ classes, account, headerClassName }) {
    useLanguage();
    const [seenRef, seen] = useSeen();
    const name = account && account.name;
    const activity = useTower(name && seen ? `a:${name}` : null, () => accountActivity(name, 30));
    const history = useTower(name && seen ? `h:${name}` : null, () => accountHistory(name, "30d"));
    if (!name) return null;

    const a = activity.data;
    const cur = a && a.current ? a.current : null;
    const prev = a && a.previous ? a.previous : null;
    const act = cur ? cur.activity : null;
    const pact = prev ? prev.activity : null;
    const posts = act ? act.artworks + act.blog_posts : null;
    const prevPosts = pact ? pact.artworks + pact.blog_posts : null;
    const given = act ? act.votes_up + act.votes_down : null;
    const received = act ? act.votes_received_up + act.votes_received_down : null;
    const ops = a ? a.operations_by_type || [] : [];
    const opsTotal = sum(ops.map((o) => o.count));

    const grain = history.data ? history.data.grain : "day";
    const days = (history.data ? history.data.points : []).map((p) => ({
        bucket: p.bucket,
        votes: (p.activity.votes_up || 0) + (p.activity.votes_down || 0),
        content: (p.activity.artworks || 0) + (p.activity.blog_posts || 0) + (p.activity.comments || 0),
        operations: p.activity.operations || 0
    }));
    const anyActivity = days.some((d) => d.votes || d.content);
    const names = { votes: tr(K + "votes", "Votes"), content: tr(K + "posts_and_comments", "Posts and comments") };
    const xFmt = (b) => bucketLabel(b, grain);
    const xTick = (b) => axisTick(b, grain);

    return (
        <React.Fragment>
            <List dense>
                <ListSubheader disableSticky className={headerClassName}>{tr(K + "activity_30d", "Activity · 30 days")}</ListSubheader>
            </List>
            <div className={classes.block} ref={seenRef}>
                {activity.error && !a ? (
                    <Unavailable classes={classes} error={activity.error} />
                ) : !a ? (
                    <Skeleton height={168} />
                ) : (
                    <Frame busy={activity.loading}>
                        <MiniStats>
                            <MiniStat
                                label={tr(K + "publications", "Publications")}
                                value={fmtInt(posts)}
                                change={changeOf(posts, prevPosts)}
                                sub={trf(K + "artworks_blogs_n", "artworks {a} · blog posts {b}", { a: fmtInt(act.artworks), b: fmtInt(act.blog_posts) })}
                            />
                            <MiniStat
                                label={tr(K + "comments", "Comments")}
                                value={fmtInt(act.comments)}
                                change={changeOf(act.comments, pact && pact.comments)}
                                sub={trf(K + "vs_previous_n", "vs. previous {n}", { n: RANGE_LABELS["30d"]() })}
                            />
                            <MiniStat
                                label={tr(K + "votes_given", "Votes given")}
                                value={fmtInt(given)}
                                change={changeOf(given, pact && pact.votes_up + pact.votes_down)}
                                sub={`▲ ${fmtInt(act.votes_up)} · ▼ ${fmtInt(act.votes_down)}`}
                            />
                            <MiniStat
                                label={tr(K + "votes_received", "Votes received")}
                                value={fmtInt(received)}
                                change={changeOf(received, pact && pact.votes_received_up + pact.votes_received_down)}
                                sub={`▲ ${fmtInt(act.votes_received_up)} · ▼ ${fmtInt(act.votes_received_down)}`}
                            />
                            <MiniStat
                                label={tr(K + "rewards", "Rewards")}
                                value={fmtCompact(cur.rewards.total_pixa_eq)}
                                unit="PIXA"
                                change={changeOf(cur.rewards.total_pixa_eq, prev && prev.rewards.total_pixa_eq)}
                                sub={tr(K + "pixa_equivalent", "PIXA equivalent")}
                            />
                            <MiniStat
                                label={tr(K + "followers", "Followers")}
                                value={a.followers == null ? "–" : fmtInt(a.followers)}
                                sub={trf(K + "gained_lost_n", "+{g} · −{l} in 30 days", { g: fmtInt(cur.followers_gained), l: fmtInt(cur.followers_lost) })}
                            />
                        </MiniStats>
                    </Frame>
                )}

                <div className={classes.chartTitle}>{tr(K + "per_day", "Per day")}</div>
                {history.error && !history.data ? null : !history.data ? (
                    <Skeleton height={150} />
                ) : !anyActivity ? (
                    <Empty>{tr(K + "no_activity", "No vote, post or comment in the last 30 days.")}</Empty>
                ) : (
                    <Frame busy={history.loading}>
                        <div className={classes.chart}>
                            <ResponsiveContainer>
                                <BarChart data={days} margin={{ top: 4, right: 16, bottom: 0, left: -12 }} barCategoryGap="20%">
                                    <CartesianGrid {...GRID} />
                                    <XAxis dataKey="bucket" tickFormatter={xTick} {...AXIS} minTickGap={28} />
                                    <YAxis {...AXIS} allowDecimals={false} width={44} tickCount={4} />
                                    <Tooltip
                                        cursor={BAR_CURSOR}
                                        content={<ChartTip labelFormatter={xFmt} names={names} valueFormatter={(v) => fmtInt(v)} />}
                                    />
                                    <Bar dataKey="content" name={names.content} stackId="a" fill={SERIES[0].fill} {...BAR} shape={ACTIVITY_STACK} />
                                    <Bar dataKey="votes" name={names.votes} stackId="a" fill={SERIES[1].fill} {...BAR} shape={ACTIVITY_STACK} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <Legend items={[
                            { label: names.content, color: SERIES[0].fill, shape: "block" },
                            { label: names.votes, color: SERIES[1].fill, shape: "block" }
                        ]} />
                    </Frame>
                )}

                {ops.length ? (
                    <React.Fragment>
                        <div className={classes.chartTitle}>{tr(K + "operations", "Operations")}</div>
                        <div className={classes.chartSub}>{trf(K + "ops_total_n", "{n} signed in 30 days", { n: fmtInt(opsTotal) })}</div>
                        <div className={classes.rows}>
                            {ops.slice(0, 5).map((o) => (
                                <div key={o.type} className={classes.row}>
                                    <span className={classes.rowLabel}>{humanOp(o.type)}</span>
                                    <span className={classes.rowValue}>{fmtInt(o.count)} · {fmtPct(opsTotal ? o.count / opsTotal : 0, 0)}</span>
                                    <div className={classes.rowMeter}><Meter value={opsTotal ? o.count / opsTotal : 0} /></div>
                                </div>
                            ))}
                        </div>
                    </React.Fragment>
                ) : null}
            </div>
        </React.Fragment>
    );
});

// ---------------------------------------------------------------- wallet

const ASSETS = ["value", "pxp", "pixa", "pxs"];

/**
 * One asset's series: the closing balance per bucket and its low-high range. The companion figure
 * (savings, Pixa Power with delegations) can be of another order of magnitude, so it is a stat, not
 * a second line on the same scale.
 */
function assetSeries(asset, p) {
    const b = p.balances;
    if (!b) return { close: null, band: null, other: null };
    const tuple = (x) => (x ? { close: x.close, band: [x.low, x.high] } : { close: null, band: null });
    if (asset === "value") return { close: b.value_pixa, band: null, other: b.unclaimed ? b.unclaimed.pixa + b.unclaimed.pxs * (b.feed || 0) + b.unclaimed.pxp : null };
    if (asset === "pxp") return { ...tuple(b.pxp), other: b.effective_pxp };
    if (asset === "pixa") return { ...tuple(b.pixa), other: b.pixa_savings };
    return { ...tuple(b.pxs), other: b.pxs_savings };
}

const assetNames = () => ({
    value: { label: tr(K + "asset_value", "Value"), unit: "PIXA", line: tr(K + "account_value", "Account value, PIXA equivalent"), other: tr(K + "unclaimed", "Unclaimed rewards") },
    pxp: { label: "PXP", unit: "PXP", line: tr(K + "own_pxp", "Own Pixa Power"), other: tr(K + "effective_pxp", "With delegations") },
    pixa: { label: "PIXA", unit: "PIXA", line: tr(K + "liquid_pixa", "Liquid PIXA"), other: tr(K + "in_savings", "In savings") },
    pxs: { label: "PXS", unit: "PXS", line: tr(K + "liquid_pxs", "Liquid PXS"), other: tr(K + "in_savings", "In savings") }
});

/** A signed difference, with rounding noise shown as 0. */
function fmtDelta(x) {
    if (x == null || !isFinite(x)) return "–";
    if (Math.abs(x) < 0.0005) return "0";
    return `${x > 0 ? "+" : "−"}${fmtCompact(Math.abs(x))}`;
}

/**
 * Wallet, History view: the balance of each asset over time (close, with the bucket's low-high range), and
 * what came in and went out per bucket. Balances exist from the Tower's first snapshot of the account;
 * rewards and transfers go back to its creation.
 */
export const BalanceHistory = withStyles(styles)(function BalanceHistory({ classes, username }) {
    useLanguage();
    const [range, setRange] = React.useState("30d");
    const [asset, setAsset] = React.useState("value");
    const h = useTower(username ? `${username}:${range}` : null, () => accountHistory(username, range));
    const names = assetNames();
    const meta = names[asset];

    const grain = h.data ? h.data.grain : "day";
    const points = h.data ? h.data.points : [];
    const rows = points.map((p) => ({ bucket: p.bucket, ...assetSeries(asset, p) }));
    const observed = rows.filter((r) => r.close != null);
    const first = observed[0];
    const last = observed[observed.length - 1];
    const hasBand = observed.some((r) => r.band && r.band[1] - r.band[0] > Math.abs(r.close) * 0.001);
    const low = observed.length ? Math.min(...observed.map((r) => (r.band ? r.band[0] : r.close))) : null;
    const high = observed.length ? Math.max(...observed.map((r) => (r.band ? r.band[1] : r.close))) : null;
    const scale = niceScale(low, high, 5);

    // In and out per bucket, PIXA equivalent: PXS at the bucket's feed, Pixa Power as the API values it.
    let feed = null;
    for (const p of points) if (p.balances && p.balances.feed) feed = p.balances.feed;
    const flows = points.map((p) => {
        const f = (p.balances && p.balances.feed) || feed || 0;
        const tin = p.transfers.in.pixa + p.transfers.in.pxs * f;
        const tout = p.transfers.out.pixa + p.transfers.out.pxs * f;
        return { bucket: p.bucket, rewards: p.rewards.total_pixa_eq || 0, received: tin, sent: tout ? -tout : 0 };
    });
    const anyFlow = flows.some((x) => x.rewards || x.received || x.sent);
    const flowScale = niceScale(Math.min(0, ...flows.map((x) => x.sent)), Math.max(0, ...flows.map((x) => x.rewards + x.received)), 6, false);
    const flowNames = { rewards: tr(K + "rewards", "Rewards"), received: tr(K + "received", "Received"), sent: tr(K + "sent", "Sent") };
    const xFmt = (b) => bucketLabel(b, grain);
    const xTick = (b) => axisTick(b, grain);
    const lineNames = { close: meta.line, band: tr(K + "low_high", "Low – high") };

    return (
        <div>
            <div className={classes.controls}>
                <Switch label={tr(K + "asset", "Asset")} value={asset} onChange={setAsset} options={ASSETS.map((x) => ({ value: x, label: names[x].label }))} />
                <Switch label={tr(K + "range", "Range")} value={range} onChange={setRange} options={rangeOptions()} />
            </div>
            {h.error && !h.data ? (
                <Unavailable classes={classes} error={h.error} />
            ) : !h.data ? (
                <Skeleton height={200} />
            ) : (
                <Frame busy={h.loading}>
                    {observed.length < 2 ? (
                        <Empty>{tr(K + "balances_building", "Balances are recorded from the statistics service's first snapshot of this account; the chart fills in as they change.")}</Empty>
                    ) : (
                        <React.Fragment>
                            <div className={classes.chartTall}>
                                <ResponsiveContainer>
                                    <ComposedChart data={rows} margin={{ top: 8, right: 20, bottom: 0, left: -8 }}>
                                        <CartesianGrid {...GRID} />
                                        <XAxis dataKey="bucket" tickFormatter={xTick} {...AXIS} minTickGap={28} />
                                        <YAxis {...AXIS} width={56} domain={scale.domain} ticks={scale.ticks} interval={0} tickFormatter={tickFormat(scale.step)} />
                                        <Tooltip
                                            cursor={CURSOR}
                                            content={<ChartTip labelFormatter={xFmt} names={lineNames} valueFormatter={(v) => (Array.isArray(v) ? `${fmtCompact(v[0])} – ${fmtCompact(v[1])}` : `${fmtCompact(v)} ${meta.unit}`)} />}
                                        />
                                        {hasBand ? <Area type="linear" dataKey="band" name={lineNames.band} {...BAND} connectNulls={false} /> : null}
                                        <Line type="linear" dataKey="close" name={meta.line} stroke={SERIES[0].stroke} strokeWidth={2}
                                            dot={false} activeDot={ACTIVE_DOT} isAnimationActive={false} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                            {hasBand ? (
                                <Legend items={[{ label: meta.line }, { label: lineNames.band, color: "rgba(255,255,255,0.25)", shape: "block" }]} />
                            ) : (
                                <div className={classes.chartSub} style={{ marginTop: "8px" }}>{meta.line}</div>
                            )}
                            <div style={{ marginTop: "12px" }}>
                                <MiniStats columns={4}>
                                    <MiniStat label={tr(K + "now", "Now")} value={fmtCompact(last.close)} unit={meta.unit} />
                                    <MiniStat
                                        label={tr(K + "change", "Change")}
                                        value={fmtDelta(last.close - first.close)}
                                        unit={meta.unit}
                                        change={changeOf(last.close, first.close)}
                                    />
                                    <MiniStat label={tr(K + "low_high", "Low – high")} value={`${fmtCompact(low)} – ${fmtCompact(high)}`} />
                                    <MiniStat label={meta.other} value={last.other == null ? "–" : fmtCompact(last.other)} unit={asset === "value" ? "PIXA" : meta.unit} />
                                </MiniStats>
                            </div>
                        </React.Fragment>
                    )}

                    <div className={classes.chartTitle}>{tr(K + "in_and_out", "In and out")}</div>
                    <div className={classes.chartSub}>{tr(K + "in_and_out_sub", "Rewards and transfers, PIXA equivalent")}</div>
                    {!anyFlow ? (
                        <Empty>{tr(K + "no_flows", "No reward or transfer in this range.")}</Empty>
                    ) : (
                        <React.Fragment>
                            <div className={classes.chart}>
                                <ResponsiveContainer>
                                    <BarChart data={flows} margin={{ top: 8, right: 20, bottom: 0, left: 0 }} stackOffset="sign" barCategoryGap="20%">
                                        <CartesianGrid {...GRID} />
                                        <XAxis dataKey="bucket" tickFormatter={xTick} {...AXIS} minTickGap={28} />
                                        <YAxis {...AXIS} width={56} domain={flowScale.domain} ticks={flowScale.ticks} interval={0} tickFormatter={tickFormat(flowScale.step)} />
                                        <ReferenceLine y={0} stroke="rgba(255,255,255,0.18)" />
                                        <Tooltip
                                            cursor={BAR_CURSOR}
                                            content={<ChartTip labelFormatter={xFmt} names={flowNames} valueFormatter={(v) => `${fmtCompact(Math.abs(v))} PIXA`} />}
                                        />
                                        <Bar dataKey="rewards" name={flowNames.rewards} stackId="f" fill={SERIES[0].fill} {...BAR} shape={FLOW_STACK} />
                                        <Bar dataKey="received" name={flowNames.received} stackId="f" fill={SERIES[1].fill} {...BAR} shape={FLOW_STACK} />
                                        <Bar dataKey="sent" name={flowNames.sent} stackId="f" fill={SERIES[2].fill} {...BAR} shape={FLOW_STACK} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <Legend items={[
                                { label: flowNames.rewards, color: SERIES[0].fill, shape: "block" },
                                { label: flowNames.received, color: SERIES[1].fill, shape: "block" },
                                { label: flowNames.sent, color: SERIES[2].fill, shape: "block" }
                            ]} />
                        </React.Fragment>
                    )}
                </Frame>
            )}
        </div>
    );
});

// ---------------------------------------------------------------- follow list

/**
 * Followers or following list: the count over time (followers with each bucket's low-high range) and,
 * for followers, the follows gained and lost per bucket. Mutes and ignores are not counted.
 */
export const FollowHistory = withStyles(styles)(function FollowHistory({ classes, username, kind = "followers", onSummary }) {
    useLanguage();
    const [range, setRange] = React.useState("30d");
    const h = useTower(username ? `${username}:${range}` : null, () => accountHistory(username, range));
    const grain = h.data ? h.data.grain : "day";
    const points = h.data ? h.data.points : [];
    const followers = kind === "followers";
    const rows = points.map((p) => {
        const f = p.social.followers;
        return followers
            ? { bucket: p.bucket, count: f ? f.close : null, band: f ? [f.low, f.high] : null, gained: p.social.gained || 0, lost: p.social.lost ? -p.social.lost : 0 }
            : { bucket: p.bucket, count: p.social.following };
    });
    const known = rows.filter((r) => r.count != null);
    const gained = sum(rows.map((r) => r.gained));
    const lost = Math.abs(sum(rows.map((r) => r.lost)));
    const hasBand = followers && known.some((r) => r.band && r.band[0] !== r.band[1]);
    const countScale = niceScale(
        known.length ? Math.min(...known.map((r) => (r.band ? r.band[0] : r.count))) : null,
        known.length ? Math.max(...known.map((r) => (r.band ? r.band[1] : r.count))) : null,
        5, true, true
    );
    const xFmt = (b) => bucketLabel(b, grain);
    const xTick = (b) => axisTick(b, grain);
    const names = {
        count: followers ? tr(K + "followers", "Followers") : tr(K + "following", "Following"),
        band: tr(K + "low_high", "Low – high"),
        gained: tr(K + "gained", "Gained"),
        lost: tr(K + "lost", "Lost")
    };

    // The section header shows a summary once the figures are in.
    const summaryKey = h.data && known.length ? `${range}:${known[known.length - 1].count}:${gained}:${lost}` : null;
    React.useEffect(() => {
        if (!summaryKey || !onSummary) return;
        const now = fmtInt(known[known.length - 1].count);
        onSummary(followers ? trf(K + "summary_followers_n", "{now} · +{g} −{l}", { now, g: fmtInt(gained), l: fmtInt(lost) }) : now);
    }, [summaryKey]);

    return (
        <div>
            <div className={classes.controls}>
                <span />
                <Switch label={tr(K + "range", "Range")} value={range} onChange={setRange} options={rangeOptions()} />
            </div>
            {h.error && !h.data ? (
                <Unavailable classes={classes} error={h.error} />
            ) : !h.data ? (
                <Skeleton height={160} />
            ) : known.length < 1 ? (
                <Empty>{tr(K + "no_follow_data", "No follow recorded for this account in this range.")}</Empty>
            ) : (
                <Frame busy={h.loading}>
                    <div className={classes.chart}>
                        <ResponsiveContainer>
                            <ComposedChart data={rows} margin={{ top: 8, right: 20, bottom: 0, left: -16 }}>
                                <CartesianGrid {...GRID} />
                                <XAxis dataKey="bucket" tickFormatter={xTick} {...AXIS} minTickGap={28} />
                                <YAxis {...AXIS} width={48} domain={countScale.domain} ticks={countScale.ticks} interval={0} tickFormatter={tickFormat(countScale.step)} />
                                <Tooltip
                                    cursor={CURSOR}
                                    content={<ChartTip labelFormatter={xFmt} names={names} valueFormatter={(v) => (Array.isArray(v) ? `${fmtInt(v[0])} – ${fmtInt(v[1])}` : fmtInt(v))} />}
                                />
                                {hasBand ? <Area type="stepAfter" dataKey="band" name={names.band} {...BAND} /> : null}
                                <Line type="stepAfter" dataKey="count" name={names.count} stroke={SERIES[0].stroke} strokeWidth={2} dot={false}
                                    activeDot={ACTIVE_DOT} isAnimationActive={false} connectNulls />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                    {followers ? (
                        <React.Fragment>
                            <div className={classes.chartTitle}>{tr(K + "gained_and_lost", "Gained and lost")}</div>
                            {gained || lost ? (
                                <React.Fragment>
                                    <div className={classes.chartShort}>
                                        <ResponsiveContainer>
                                            <BarChart data={rows} margin={{ top: 4, right: 20, bottom: 0, left: -16 }} stackOffset="sign" barCategoryGap="20%">
                                                <CartesianGrid {...GRID} />
                                                <XAxis dataKey="bucket" tickFormatter={xTick} {...AXIS} minTickGap={28} />
                                                <YAxis {...AXIS} width={48} allowDecimals={false} tickCount={3} />
                                                <ReferenceLine y={0} stroke="rgba(255,255,255,0.18)" />
                                                <Tooltip cursor={BAR_CURSOR} content={<ChartTip labelFormatter={xFmt} names={names} valueFormatter={(v) => fmtInt(Math.abs(v))} />} />
                                                <Bar dataKey="gained" name={names.gained} stackId="g" fill={SERIES[0].fill} {...BAR} shape={FOLLOW_STACK} />
                                                <Bar dataKey="lost" name={names.lost} stackId="g" fill={SERIES[2].fill} {...BAR} shape={FOLLOW_STACK} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <Legend items={[
                                        { label: `${names.gained} · ${fmtInt(gained)}`, color: SERIES[0].fill, shape: "block" },
                                        { label: `${names.lost} · ${fmtInt(lost)}`, color: SERIES[2].fill, shape: "block" }
                                    ]} />
                                </React.Fragment>
                            ) : (
                                <Empty>{tr(K + "no_follow_change", "No follow gained or lost in this range.")}</Empty>
                            )}
                        </React.Fragment>
                    ) : null}
                </Frame>
            )}
        </div>
    );
});
