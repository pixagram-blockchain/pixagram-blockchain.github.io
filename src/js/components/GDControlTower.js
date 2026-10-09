import * as React from "preact/compat";

import withStyles from "@material-ui/core/styles/withStyles";
import DialogContent from "@material-ui/core/DialogContent";
import Typography from "@material-ui/core/Typography";
import LinearProgress from "@material-ui/core/LinearProgress";
import FlagIcon from "@material-ui/icons/Flag";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";

import { withLanguage } from "../utils/withLanguage";
import { towerGet, fmtCompact, fmtInt, fmtPct, fmtAgo } from "../utils/tower";
import { tr, trf, Section, Card, Tile, Pill, Meter, Empty, Skeleton, Visible } from "./GDTowerKit";

const K = "components.gdcontrol_tower.";

// System goals (article, component 4). Each reads live figures and returns { current, target, done, label }.
// Edit this list to change the objectives; witnesses' own drafted objectives can be added the same way.
const GOALS = [
    {
        id: "witness-seats",
        title: () => tr(K + "goal_seats", "Fill every elected witness seat"),
        description: () => tr(K + "goal_seats_desc", "Empty seats go to anyone who runs a witness node, without stake."),
        read: ({ gov }) => {
            const w = gov && gov.witnesses && gov.witnesses.extra;
            if (!w) return null;
            return { current: w.elected, target: w.max_voted, text: `${w.elected} / ${w.max_voted}` };
        }
    },
    {
        id: "capture-cost",
        title: () => tr(K + "goal_capture", "Make a majority of the schedule expensive"),
        description: () => tr(K + "goal_capture_desc", "Taking a majority of block production should cost at least half of all user stake."),
        read: ({ gov }) => {
            const m = gov && (gov.capture_cost_pxp || []).find((x) => x.dim === "majority");
            if (!m || !m.extra) return null;
            const share = m.extra.share_of_user_stake || 0;
            return { current: share, target: 0.5, text: `${fmtPct(share, 0)} / 50%` };
        }
    },
    {
        id: "participation",
        title: () => tr(K + "goal_participation", "Half of user stake votes for witnesses"),
        description: () => tr(K + "goal_participation_desc", "Directly or through a proxy. Higher participation makes the vote harder to capture."),
        read: ({ gov }) => {
            const p = gov ? gov.witness_vote_participation : null;
            if (p == null) return null;
            return { current: p, target: 0.5, text: `${fmtPct(p, 0)} / 50%` };
        }
    },
    {
        id: "debt-ratio",
        title: () => tr(K + "goal_debt", "Keep PXS below the stop-print line"),
        description: () => tr(K + "goal_debt_desc", "Above 20% of virtual supply, content rewards stop being paid in PXS."),
        read: ({ ov }) => {
            const r = ov && ov.supply ? ov.supply.pxs_debt_ratio : null;
            if (r == null) return null;
            // Progress = headroom left under the line; done while below it.
            return { current: Math.max(0, 0.2 - r), target: 0.2, done: r < 0.2, text: `${fmtPct(r, 1)} / 20%` };
        }
    },
    {
        id: "treasury",
        title: () => tr(K + "goal_treasury", "Distribute the company treasury on schedule"),
        description: () => tr(K + "goal_treasury_desc", "Stake leaving the company accounts, against the 9-to-11-year path."),
        read: ({ treasury }) => {
            if (!treasury) return null;
            const total = treasury.find((x) => x.dim === "");
            const others = treasury.find((x) => x.dim === "to_others");
            if (!total || !others || !total.extra) return null;
            const { lower, upper } = total.extra;
            const v = others.value || 0;
            return {
                current: v, target: Math.max(upper, 1e-9), done: v >= lower && v <= upper,
                text: `${fmtPct(v, 2)} · ${tr(K + "path", "path")} ${fmtPct(lower, 2)}–${fmtPct(upper, 2)}`
            };
        }
    },
    {
        id: "monthly-active",
        title: () => tr(K + "goal_mau", "1,000 monthly active accounts"),
        description: () => tr(K + "goal_mau_desc", "Accounts that signed an operation in the last 30 days."),
        read: ({ stickiness }) => {
            const s = stickiness && stickiness[0];
            if (!s || !s.extra) return null;
            return { current: s.extra.mau, target: 1000, text: `${fmtInt(s.extra.mau)} / 1,000` };
        }
    }
];

const CAPTURE_LABELS = {
    stall_finality: () => tr(K + "stall_finality", "Stall finality (more than 1/3)"),
    majority: () => tr(K + "majority", "Majority of the schedule"),
    hardfork_quorum: () => tr(K + "hardfork_quorum", "Hardfork quorum")
};

const styles = theme => ({
    dialogContent: { padding: "24px", [theme.breakpoints.down("sm")]: { padding: "16px" } },
    // system state banner
    banner: {
        backgroundColor: "#101010",
        borderRadius: "16px",
        padding: "20px 24px",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: "16px",
        alignItems: "center",
        [theme.breakpoints.down("xs")]: { gridTemplateColumns: "minmax(0, 1fr)" }
    },
    bannerStrong: { backgroundColor: "#1b1b1b" },
    bannerLabel: { fontSize: "12px", color: "#888", fontFamily: "'Industry Book'", textTransform: "uppercase", letterSpacing: "0.5px" },
    bannerState: { fontSize: "28px", fontWeight: 600, color: "#fff", fontFamily: "'Industry Book'", lineHeight: 1.2, marginTop: "4px" },
    bannerText: { fontSize: "14px", color: "#888", fontFamily: "'Normative Pro'", marginTop: "4px" },
    bannerFacts: { display: "grid", gridTemplateColumns: "repeat(2, auto)", columnGap: "24px", rowGap: "6px" },
    factLabel: { fontSize: "12px", color: "#666", fontFamily: "'Normative Pro'" },
    factValue: { fontSize: "12px", color: "#ddd", fontFamily: "'Geist Mono', monospace", textAlign: "right" },
    grid2: {
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: "16px",
        alignItems: "start",
        [theme.breakpoints.down("sm")]: { gridTemplateColumns: "minmax(0, 1fr)" }
    },
    tiles: {
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: "16px",
        [theme.breakpoints.down("sm")]: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
        [theme.breakpoints.down("xs")]: { gridTemplateColumns: "minmax(0, 1fr)" }
    },
    // rows: spacing and hover fill, never a rule
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
    rowLead: { display: "flex", alignItems: "center", gap: "10px", minWidth: 0 },
    rowMain: { minWidth: 0 },
    rowTitle: {
        fontSize: "14px", color: "#ddd", fontFamily: "'Normative Pro'", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        [theme.breakpoints.down("xs")]: { whiteSpace: "normal" }
    },
    rowSub: { fontSize: "12px", color: "#666", fontFamily: "'Normative Pro'", marginTop: "2px" },
    rowValue: { fontSize: "13px", color: "#fff", fontFamily: "'Geist Mono', monospace", textAlign: "right", whiteSpace: "nowrap" },
    rowValueMuted: { color: "#888" },
    rowMeter: { marginTop: "6px" },
    // witness table
    wHead: {
        display: "grid",
        gridTemplateColumns: "28px minmax(0, 1.4fr) 1fr 0.7fr 0.8fr 0.8fr",
        gap: "8px",
        padding: "0 8px 6px 8px",
        fontSize: "11px",
        color: "#666",
        fontFamily: "'Industry Book'",
        textTransform: "uppercase",
        letterSpacing: "0.5px"
    },
    wRow: {
        display: "grid",
        gridTemplateColumns: "28px minmax(0, 1.4fr) 1fr 0.7fr 0.8fr 0.8fr",
        gap: "8px",
        alignItems: "center",
        padding: "8px",
        borderRadius: "10px",
        fontSize: "13px",
        fontFamily: "'Geist Mono', monospace",
        color: "#ddd",
        transition: "background-color 150ms ease",
        "&:hover": { backgroundColor: "#171717" }
    },
    wRowOut: { color: "#666" },
    wName: { fontFamily: "'Normative Pro'", fontSize: "14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    wNum: { textAlign: "right", whiteSpace: "nowrap" },
    wPos: { color: "#666" },
    tableScroll: { overflowX: "auto", margin: "0 -8px" },
    tableInner: { minWidth: "520px", padding: "0 0" },
    // stat list inside a card
    stats: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", rowGap: "10px", columnGap: "16px", alignItems: "center" },
    statLabel: { fontSize: "13px", color: "#aaa", fontFamily: "'Normative Pro'" },
    statValue: { fontSize: "13px", color: "#fff", fontFamily: "'Geist Mono', monospace", textAlign: "right" },
    statMeter: { gridColumn: "1 / -1", marginTop: "-4px" },
    spacer: { height: "16px" },
    note: { fontSize: "12px", color: "#666", fontFamily: "'Normative Pro'", marginTop: "12px", lineHeight: 1.5 },
    // goals (same card as the original GDMetrics goals)
    goals: {
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: "12px",
        [theme.breakpoints.down("sm")]: { gridTemplateColumns: "minmax(0, 1fr)" }
    },
    goalCard: {
        backgroundColor: "#101010",
        borderRadius: "16px",
        padding: "20px",
        transition: "background-color 200ms cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": { backgroundColor: "#171717" }
    },
    goalHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "16px" },
    goalInfo: { display: "flex", alignItems: "flex-start", gap: "12px", minWidth: 0 },
    goalIconWrapper: {
        width: "40px",
        height: "40px",
        borderRadius: "10px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#fff",
        flex: "0 0 auto"
    },
    goalIconWrapperOpen: { backgroundColor: "#222" },
    goalIcon: { color: "#000", fontSize: "20px" },
    goalIconOpen: { color: "#888" },
    goalTitle: { fontSize: "16px", fontWeight: 600, color: "#fff", fontFamily: "'Industry Book'", marginBottom: "4px" },
    goalDescription: { fontSize: "13px", fontFamily: "'Normative Pro'", color: "#888" },
    goalProgressBar: {
        height: "8px",
        borderRadius: "4px",
        backgroundColor: "#222",
        "& .MuiLinearProgress-bar": { backgroundColor: "#888", borderRadius: "4px" }
    },
    goalProgressBarComplete: { "& .MuiLinearProgress-bar": { backgroundColor: "#fff" } },
    goalProgressText: { display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "12px", fontFamily: "'Geist Mono', monospace", color: "#888" }
});

class GDControlTower extends React.PureComponent {
    state = { loading: true, d: {} };
    root = React.createRef();
    seq = 0;

    componentDidMount() {
        this.visible = new Visible(() => this.load(), 60000);
        this.visible.attach(this.root.current);
    }

    componentWillUnmount() {
        if (this.visible) this.visible.detach();
    }

    load() {
        const seq = ++this.seq;
        const soft = (p) => p.catch(() => null);
        const jobs = {
            status: soft(towerGet("/status", 10000)),
            ov: soft(towerGet("/overview", 30000).then((r) => r.data)),
            alerts: soft(towerGet("/alerts?state=open&limit=50", 30000).then((r) => r.data)),
            gov: soft(towerGet("/governance", 60000).then((r) => r.data)),
            witnesses: soft(towerGet("/witnesses", 60000).then((r) => r.data)),
            dpf: soft(towerGet("/dpf", 300000).then((r) => r.data)),
            actions: soft(towerGet("/actions?limit=8", 300000).then((r) => r.data)),
            portals: soft(towerGet("/portals", 300000).then((r) => r.data)),
            treasury: soft(towerGet("/metrics/treasury_distribution/latest?grain=day", 600000).then((r) => r.data.values)),
            stickiness: soft(towerGet("/metrics/stickiness/latest?grain=day", 600000).then((r) => r.data.values)),
            curation: soft(towerGet("/metrics/curation_share_observed/latest?grain=day", 600000).then((r) => r.data.values)),
            fee: soft(towerGet("/metrics/account_creation_fee/latest?grain=hour", 600000).then((r) => r.data.values))
        };
        const keys = Object.keys(jobs);
        Promise.all(keys.map((k) => jobs[k])).then((values) => {
            if (seq !== this.seq) return;
            const d = {};
            keys.forEach((k, i) => (d[k] = values[i]));
            this.setState({ d, loading: false });
        });
    }

    // ------------------------------------------------------------ 2. system state

    _renderBanner() {
        const { classes } = this.props;
        const { d, loading } = this.state;
        const alerts = d.alerts || [];
        const red = alerts.filter((a) => a.severity === "red" && a.state !== "closed").length;
        const amber = alerts.filter((a) => a.severity === "amber" && a.state !== "closed").length;
        const st = d.status ? d.status.data : null;
        const level = !d.alerts ? "muted" : red ? "red" : amber ? "amber" : "ok";
        const word = !d.alerts
            ? loading ? tr(K + "connecting", "Connecting…") : tr(K + "unreachable", "Tower unreachable")
            : red ? tr(K + "state_red", "Intervention needed") : amber ? tr(K + "state_amber", "Watch") : tr(K + "state_ok", "Nominal");
        const text = !d.alerts
            ? tr(K + "unreachable_text", "The statistics service does not answer; figures below may be missing.")
            : `${red} ${tr(K + "red_alerts", "red")} · ${amber} ${tr(K + "amber_alerts", "amber")} · ${tr(K + "open_alerts", "open alerts")}`;
        return (
            <div className={`${classes.banner} ${red ? classes.bannerStrong : ""}`}>
                <div>
                    <div className={classes.bannerLabel}>{tr(K + "system_state", "System state")}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                        <div className={classes.bannerState}>{word}</div>
                        <Pill level={level}>{level === "ok" ? tr(K + "ok", "ok") : level === "muted" ? "–" : level === "red" ? tr(K + "red", "red") : tr(K + "amber", "amber")}</Pill>
                    </div>
                    <div className={classes.bannerText}>{text}</div>
                </div>
                <div className={classes.bannerFacts}>
                    <span className={classes.factLabel}>{tr(K + "block", "Block")}</span>
                    <span className={classes.factValue}>{st && st.cursor ? fmtInt(st.cursor) : "–"}</span>
                    <span className={classes.factLabel}>{tr(K + "lag", "Lag")}</span>
                    <span className={classes.factValue}>{st && st.ingest_lag_blocks != null ? `${fmtInt(st.ingest_lag_blocks)} ${tr(K + "blocks", "blocks")}` : "–"}</span>
                    <span className={classes.factLabel}>{tr(K + "scanner", "Scanner")}</span>
                    <span className={classes.factValue}>{st && st.scanner ? (st.scanner.paused ? tr(K + "paused", "paused") : st.scanner.mode || tr(K + "starting", "starting")) : "–"}</span>
                    <span className={classes.factLabel}>{tr(K + "snapshot", "Snapshot")}</span>
                    <span className={classes.factValue}>{st && st.last_snapshot ? trf(K + "ago_n", "{n} ago", { n: fmtAgo(st.last_snapshot) }) : "–"}</span>
                </div>
            </div>
        );
    }

    _renderAlerts() {
        const { classes } = this.props;
        const { d } = this.state;
        if (!d.alerts) return <Card>{this.state.loading ? <Skeleton height={120} /> : <Empty>{tr(K + "no_data", "No data.")}</Empty>}</Card>;
        const list = [...d.alerts].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "red" ? -1 : 1));
        return (
            <Card
                title={tr(K + "alerts", "Alerts")}
                subtitle={tr(K + "alerts_sub", "Thresholds on the metrics, and single chain events that matter on their own")}
            >
                {list.length === 0 ? (
                    <Empty>{tr(K + "no_alerts", "No open alert: every watched metric is within its bands.")}</Empty>
                ) : (
                    <div className={classes.rows}>
                        {list.map((a) => (
                            <div key={a.id} className={classes.row}>
                                <div className={classes.rowLead}>
                                    <Pill level={a.severity}>{a.severity === "red" ? tr(K + "red", "red") : tr(K + "amber", "amber")}</Pill>
                                    <div className={classes.rowMain}>
                                        <div className={classes.rowTitle} title={a.title}>{(a.title || "").replace(/^(RED|AMBER): /, "")}</div>
                                        <div className={classes.rowSub}>
                                            {a.metric_title || tr(K + "chain_event", "Chain event")}
                                            {a.state === "acknowledged" ? ` · ${tr(K + "acknowledged", "acknowledged")}` : ""}
                                            {a.note ? ` · ${a.note}` : ""}
                                        </div>
                                    </div>
                                </div>
                                <div className={`${classes.rowValue} ${classes.rowValueMuted}`}>{fmtAgo(a.opened)}</div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        );
    }

    // ------------------------------------------------------------ 6. system steering

    _renderCapture() {
        const { classes } = this.props;
        const { d } = this.state;
        const g = d.gov;
        if (!g) return <Card>{this.state.loading ? <Skeleton height={260} /> : <Empty>{tr(K + "no_data", "No data.")}</Empty>}</Card>;
        const w = g.witnesses && g.witnesses.extra;
        const order = ["stall_finality", "majority", "hardfork_quorum"];
        const capture = order.map((k) => (g.capture_cost_pxp || []).find((x) => x.dim === k)).filter(Boolean);
        const hf = g.hf_readiness;
        return (
            <Card
                title={tr(K + "cost_of_capture", "Cost of capture")}
                subtitle={tr(K + "cost_of_capture_sub", "Stake an attacker needs to win schedule seats")}
                info={tr(K + "cost_of_capture_info", "Witnesses with a signing key are scheduled by votes. While there are fewer candidates than elected seats, an empty seat is taken by anyone who runs a witness node, even with no votes at all.")}
            >
                <div className={classes.rows}>
                    {capture.map((c) => {
                        const x = c.extra || {};
                        const free = c.value === 0;
                        return (
                            <div key={c.dim} className={classes.row}>
                                <div className={classes.rowMain}>
                                    <div className={classes.rowTitle}>{CAPTURE_LABELS[c.dim] ? CAPTURE_LABELS[c.dim]() : c.dim}</div>
                                    <div className={classes.rowSub}>
                                        {x.seats} {tr(K + "seats_needed", "seats needed")} · {x.free_seats} {tr(K + "free", "free")}
                                        {x.weakest_displaced ? ` · ${trf(K + "outvote_n", "outvote {n}", { n: "@" + x.weakest_displaced })}` : ""}
                                    </div>
                                </div>
                                <div className={classes.rowValue}>
                                    {free ? <Pill level="red">{tr(K + "free_cost", "free")}</Pill> : c.value == null ? "–" : `${fmtCompact(c.value)} PXP`}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className={classes.spacer} />
                <div className={classes.stats}>
                    <span className={classes.statLabel}>{tr(K + "elected_witnesses", "Elected witnesses")}</span>
                    <span className={classes.statValue}>{w ? `${w.elected} / ${w.max_voted}` : "–"}</span>
                    <span className={classes.statLabel}>{tr(K + "bench", "Backup witnesses (bench)")}</span>
                    <span className={classes.statValue}>{g.bench == null ? "–" : fmtInt(g.bench)}</span>
                    <span className={classes.statLabel}>{tr(K + "participation", "User stake voting for witnesses")}</span>
                    <span className={classes.statValue}>{fmtPct(g.witness_vote_participation, 0)}</span>
                    <div className={classes.statMeter}><Meter value={g.witness_vote_participation || 0} marks={[0.5]} /></div>
                    <span className={classes.statLabel}>{tr(K + "largest_proxy", "Largest proxy")}</span>
                    <span className={classes.statValue}>
                        {g.proxy_top_share && g.proxy_top_share.extra && g.proxy_top_share.extra.proxy ? `@${g.proxy_top_share.extra.proxy} ${fmtPct(g.proxy_top_share.value, 0)}` : tr(K + "none", "none")}
                    </span>
                    <span className={classes.statLabel}>{tr(K + "on_majority_version", "Elected on the majority version")}</span>
                    <span className={classes.statValue}>{hf ? `${fmtPct(hf.value, 0)} · ${hf.extra ? hf.extra.majority_version : ""}` : "–"}</span>
                    <span className={classes.statLabel}>{tr(K + "shared_keys", "Signing keys shared by several witnesses")}</span>
                    <span className={classes.statValue}>{g.shared_signing_keys ? fmtInt(g.shared_signing_keys.value) : "–"}</span>
                    <span className={classes.statLabel}>{tr(K + "treasury_votes", "Votes by restricted treasury accounts")}</span>
                    <span className={classes.statValue}>
                        {g.treasury_invariant && g.treasury_invariant.violations > 0 ? <Pill level="red">{fmtInt(g.treasury_invariant.violations)}</Pill> : "0"}
                    </span>
                    <span className={classes.statLabel}>{tr(K + "fresh_stake_votes", "Witness votes from accounts under 7 days, 30 d")}</span>
                    <span className={classes.statValue}>{fmtInt((g.fresh_stake_votes_30d || []).length)}</span>
                </div>
            </Card>
        );
    }

    _renderWitnesses() {
        const { classes } = this.props;
        const { d } = this.state;
        const list = d.witnesses;
        return (
            <Card
                title={tr(K + "witnesses", "Witnesses")}
                subtitle={tr(K + "witnesses_sub", "Ranked by votes; vote for them in Viability management")}
            >
                {!list ? (this.state.loading ? <Skeleton height={260} /> : <Empty>{tr(K + "no_data", "No data.")}</Empty>) : list.length === 0 ? (
                    <Empty>{tr(K + "no_witnesses", "No witness snapshot yet.")}</Empty>
                ) : (
                    <div className={classes.tableScroll}>
                        <div className={classes.tableInner}>
                            <div className={classes.wHead}>
                                <span>#</span>
                                <span>{tr(K + "witness", "Witness")}</span>
                                <span style={{ textAlign: "right" }}>{tr(K + "votes_pxp", "Votes PXP")}</span>
                                <span style={{ textAlign: "right" }}>{tr(K + "missed_24h", "Missed 24 h")}</span>
                                <span style={{ textAlign: "right" }}>{tr(K + "feed_age", "Feed age")}</span>
                                <span style={{ textAlign: "right" }}>{tr(K + "version", "Version")}</span>
                            </div>
                            {list.map((w) => (
                                <div key={w.witness} className={`${classes.wRow} ${!w.elected ? classes.wRowOut : ""}`} title={w.disabled ? tr(K + "disabled", "disabled: no signing key") : w.url || ""}>
                                    <span className={classes.wPos}>{w.position}</span>
                                    <span className={classes.wName}>@{w.witness}{w.disabled ? " · " + tr(K + "off", "off") : ""}</span>
                                    <span className={classes.wNum}>{fmtCompact(w.votes_pxp)}</span>
                                    <span className={classes.wNum}>{w.missed_24h && w.elected ? <Pill level={w.miss_rate_24h > 0.04 ? "red" : w.miss_rate_24h > 0.01 ? "amber" : "muted"} icon={false}>{w.missed_24h}</Pill> : "0"}</span>
                                    <span className={classes.wNum}>{w.feed_age_hours == null || !w.elected ? "–" : w.feed_age_hours > 24 ? <Pill level={w.feed_age_hours > 72 ? "red" : "amber"} icon={false}>{Math.round(w.feed_age_hours)}h</Pill> : `${w.feed_age_hours.toFixed(1)}h`}</span>
                                    <span className={classes.wNum}>{w.running_version || "–"}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </Card>
        );
    }

    // ------------------------------------------------------------ 1. system attributes

    _renderAttributes() {
        const { classes } = this.props;
        const { d, loading } = this.state;
        const s = d.ov ? d.ov.supply : null;
        const g = d.ov ? d.ov.governance : null;
        const fee = d.fee && d.fee[0] ? d.fee[0].value : null;
        const cur = d.curation && d.curation[0] ? d.curation[0].value : null;
        const blockSize = d.witnesses && d.witnesses.length ? d.witnesses[0].maximum_block_size : null;
        const l = loading && !d.ov;
        return (
            <div className={classes.tiles}>
                <Tile label={tr(K + "account_fee", "Account creation fee")} value={fee == null ? "–" : fmtCompact(fee)} unit="PIXA" sub={tr(K + "median_of_witnesses", "median of the witnesses")} loading={l} />
                <Tile label={tr(K + "max_block", "Maximum block size")} value={blockSize ? fmtCompact(blockSize / 1048576, 1) : "–"} unit="MiB" sub={tr(K + "voted_by_witnesses", "voted by witnesses")} loading={l} />
                <Tile label={tr(K + "debt_ratio", "PXS debt ratio")} value={s ? fmtPct(s.pxs_debt_ratio, 1) : "–"} sub={tr(K + "stop_print_at", "printing stops at 20%")} loading={l} />
                <Tile label={tr(K + "feed", "Price feed")} value={s && s.feed_pixa_per_pxs ? s.feed_pixa_per_pxs.toFixed(3) : "–"} unit="PIXA/PXS" sub={tr(K + "median_feed", "median of the elected witnesses")} loading={l} />
                <Tile label={tr(K + "vests_ratio", "PIXA per VESTS")} value={s ? s.vests_ratio.toFixed(6) : "–"} sub={tr(K + "no_stake_yield", "flat: no yield on stake")} loading={l} />
                <Tile label={tr(K + "curation_share", "Curation share")} value={cur == null ? "–" : fmtPct(cur, 0)} sub={tr(K + "curation_expected", "observed yesterday; 40% expected")} loading={l} />
                <Tile label={tr(K + "chain_version", "Chain version")} value={g ? g.majority_version || "–" : "–"} sub={g ? `${g.hf_required_witnesses} ${tr(K + "witnesses_for_hardfork", "witnesses activate a hardfork")}` : ""} loading={l} />
            </div>
        );
    }

    // ------------------------------------------------------------ 4. system goals

    _renderGoals() {
        const { classes } = this.props;
        const { d } = this.state;
        const ctx = { gov: d.gov, ov: d.ov, treasury: d.treasury, stickiness: d.stickiness };
        return (
            <div className={classes.goals}>
                {GOALS.map((goal) => {
                    const r = goal.read(ctx);
                    const progress = r ? Math.max(0, Math.min(1, r.current / r.target)) : 0;
                    const done = r ? (r.done !== undefined ? r.done : r.current >= r.target) : false;
                    return (
                        <div key={goal.id} className={classes.goalCard}>
                            <div className={classes.goalHeader}>
                                <div className={classes.goalInfo}>
                                    <div className={`${classes.goalIconWrapper} ${done ? "" : classes.goalIconWrapperOpen}`}>
                                        {done ? <CheckCircleIcon className={classes.goalIcon} /> : <FlagIcon className={`${classes.goalIcon} ${classes.goalIconOpen}`} />}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <Typography className={classes.goalTitle}>{goal.title()}</Typography>
                                        <Typography className={classes.goalDescription}>{goal.description()}</Typography>
                                    </div>
                                </div>
                                <Pill level={!r ? "muted" : done ? "ok" : "amber"} icon={false}>
                                    {!r ? "–" : done ? tr(K + "met", "met") : tr(K + "open", "open")}
                                </Pill>
                            </div>
                            <LinearProgress
                                variant="determinate"
                                value={progress * 100}
                                className={`${classes.goalProgressBar} ${done ? classes.goalProgressBarComplete : ""}`}
                            />
                            <div className={classes.goalProgressText}>
                                <span>{r ? r.text : tr(K + "waiting_for_data", "waiting for data")}</span>
                                <span>{r ? fmtPct(progress, 0) : ""}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    // ------------------------------------------------------------ 7. decentralized funds

    _renderDpf() {
        const { classes } = this.props;
        const { d } = this.state;
        const f = d.dpf;
        if (!f) return <Card>{this.state.loading ? <Skeleton height={200} /> : <Empty>{tr(K + "no_data", "No data.")}</Empty>}</Card>;
        const active = f.proposals.filter((p) => p.status === "active");
        const ret = active.find((p) => p.id === f.return_proposal_id);
        const others = active.filter((p) => p.id !== f.return_proposal_id).sort((a, b) => b.total_votes_vests - a.total_votes_vests);
        const max = Math.max(1, ...active.map((p) => p.total_votes_vests));
        return (
            <Card
                title={tr(K + "dpf", "Decentralized Pixa Fund")}
                subtitle={`${fmtCompact(f.balance_pxs)} PXS · ${tr(K + "runway", "runway")} ${f.runway_days == null ? "–" : fmtInt(f.runway_days) + " " + tr(K + "days", "days")}`}
                info={tr(K + "dpf_info", "A proposal is paid while its votes exceed those of the return proposal (id 2), whose payments flow back into the fund. The mark on each bar is the return proposal's votes.")}
            >
                {others.length === 0 ? <Empty>{tr(K + "no_proposals", "No active proposal besides the return proposal.")}</Empty> : (
                    <div className={classes.rows}>
                        {others.map((p) => (
                            <div key={p.id} className={classes.row}>
                                <div className={classes.rowMain}>
                                    <div className={classes.rowTitle} title={p.subject}>#{p.id} · {p.subject}</div>
                                    <div className={classes.rowSub}>
                                        @{p.receiver} · {fmtCompact(p.daily_pay_pxs)} PXS/{tr(K + "day", "day")} · {trf(K + "until_n", "until {n}", { n: p.end.slice(0, 10) })}
                                    </div>
                                    <div className={classes.rowMeter}>
                                        <Meter value={p.total_votes_vests / max} marks={ret ? [ret.total_votes_vests / max] : []} strong={p.above_return} />
                                    </div>
                                </div>
                                <div className={classes.rowValue}>
                                    {p.above_return ? <Pill level="ok">{tr(K + "funded", "funded")}</Pill> : <Pill level="muted" icon={false}>{tr(K + "not_funded", "not funded")}</Pill>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {f.paid_by_receiver.filter((x) => !x.returned_to_fund).length ? (
                    <div className={classes.note}>
                        {tr(K + "paid_so_far", "Paid out so far")}:{" "}
                        {f.paid_by_receiver.filter((x) => !x.returned_to_fund).map((x) => `@${x.receiver} ${fmtCompact(x.pxs)} PXS`).join(" · ")}
                    </div>
                ) : null}
            </Card>
        );
    }

    // ------------------------------------------------------------ price feeds

    _renderFeeds() {
        const { classes } = this.props;
        const { d } = this.state;
        const list = (d.witnesses || []).filter((w) => w.elected && w.feed_pixa_per_pxs);
        const s = d.ov ? d.ov.supply : null;
        return (
            <Card
                title={tr(K + "price_feeds", "Price feeds")}
                subtitle={s && s.feed_pixa_per_pxs ? `${tr(K + "median", "median")} ${s.feed_pixa_per_pxs.toFixed(3)} PIXA ${tr(K + "per_pxs", "per PXS")}` : ""}
                info={tr(K + "feeds_info", "Each elected witness's last published feed and its distance to the median. A feed far from the others, or one not updated for a day, deserves a question to its operator.")}
            >
                {list.length === 0 ? <Empty>{tr(K + "no_feeds", "No feed published yet.")}</Empty> : (
                    <div className={classes.rows}>
                        {list.map((w) => (
                            <div key={w.witness} className={classes.row}>
                                <div className={classes.rowMain}>
                                    <div className={classes.rowTitle}>@{w.witness}</div>
                                    <div className={classes.rowSub}>{w.feed_age_hours == null ? "" : trf(K + "updated_n_ago", "updated {n} ago", { n: w.feed_age_hours < 1 ? Math.round(w.feed_age_hours * 60) + "m" : Math.round(w.feed_age_hours) + "h" })}</div>
                                </div>
                                <div className={classes.rowValue}>
                                    {w.feed_pixa_per_pxs.toFixed(3)}
                                    <span style={{ color: "#666", marginLeft: "8px" }}>
                                        {w.feed_deviation == null ? "" : Math.abs(w.feed_deviation) < 0.0005 ? "=" : `${w.feed_deviation > 0 ? "+" : ""}${(w.feed_deviation * 100).toFixed(1)}%`}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        );
    }

    // ------------------------------------------------------------ 5 & 8. system events and discussions

    _renderDiscussions() {
        const { classes } = this.props;
        const { d } = this.state;
        const portals = (d.portals || []).slice().sort((a, b) => (b.last_post_ts || 0) - (a.last_post_ts || 0));
        return (
            <Card
                title={tr(K + "discussions", "Discussions")}
                subtitle={tr(K + "discussions_sub", "Portals where the system's health and functionality are debated")}
                info={tr(K + "discussions_info", "Disruptions are reported and discussed in the portals (see the Disruptions tab). Controversy is the stake-weighted disagreement of the last 30 days.")}
            >
                {!d.portals ? (this.state.loading ? <Skeleton height={200} /> : <Empty>{tr(K + "no_data", "No data.")}</Empty>) : (
                    <div className={classes.rows}>
                        {portals.slice(0, 9).map((p) => (
                            <div key={p.portal} className={classes.row}>
                                <div className={classes.rowMain}>
                                    <div className={classes.rowTitle}>{p.title || p.portal}</div>
                                    <div className={classes.rowSub}>
                                        {fmtInt(p.posts)} {tr(K + "posts", "posts")} · {fmtInt(p.replies)} {tr(K + "replies", "replies")} · {fmtInt(p.subscribers || 0)} {tr(K + "subscribers", "subscribers")}
                                        {p.controversy_30d != null ? ` · ${tr(K + "controversy", "controversy")} ${p.controversy_30d.toFixed(2)}` : ""}
                                    </div>
                                </div>
                                <div className={`${classes.rowValue} ${classes.rowValueMuted}`}>{p.last_post ? fmtAgo(p.last_post) : "–"}</div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        );
    }

    // ------------------------------------------------------------ governance actions

    _renderActions() {
        const { classes } = this.props;
        const { d } = this.state;
        const list = d.actions || [];
        return (
            <Card
                title={tr(K + "actions", "Governance actions")}
                subtitle={tr(K + "actions_sub", "What was done about an alert, and whether the metric moved 7 and 30 days later")}
            >
                {!d.actions ? (this.state.loading ? <Skeleton height={160} /> : <Empty>{tr(K + "no_data", "No data.")}</Empty>) : list.length === 0 ? (
                    <Empty>{tr(K + "no_actions", "No action logged yet. Witnesses and operators log their responses to alerts so the Tower can show whether they worked.")}</Empty>
                ) : (
                    <div className={classes.rows}>
                        {list.map((a) => (
                            <div key={a.id} className={classes.row}>
                                <div className={classes.rowMain}>
                                    <div className={classes.rowTitle} title={a.description}>{a.description}</div>
                                    <div className={classes.rowSub}>
                                        {a.lever ? `${a.lever} · ` : ""}{a.actor || ""} · {trf(K + "ago_n", "{n} ago", { n: fmtAgo(a.t) })}
                                        {a.metric ? ` · ${a.metric}` : ""}
                                    </div>
                                </div>
                                <div className={classes.rowValue}>
                                    {a.value_at_action == null ? "–" : fmtCompact(a.value_at_action)}
                                    <span style={{ color: "#666" }}> → {a.review_7d == null ? "…" : fmtCompact(a.review_7d)} → {a.review_30d == null ? "…" : fmtCompact(a.review_30d)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        );
    }

    render() {
        const { classes } = this.props;
        return (
            <DialogContent className={classes.dialogContent}>
                <div ref={this.root}>
                    {this._renderBanner()}

                    <Section
                        title={tr(K + "s_state", "System state")}
                        description={tr(K + "s_state_desc", "Alerts raised by the Tower. Red means act now, amber means watch.")}
                    />
                    {this._renderAlerts()}

                    <Section
                        title={tr(K + "s_steering", "System steering")}
                        description={tr(K + "s_steering_desc", "Who produces the blocks, how much it would cost to take control, and how much of the stake takes part.")}
                    />
                    <div className={classes.grid2}>
                        {this._renderCapture()}
                        {this._renderWitnesses()}
                    </div>

                    <Section
                        title={tr(K + "s_attributes", "System attributes")}
                        description={tr(K + "s_attributes_desc", "The parameters the chain runs on now, as voted by witnesses or set by the protocol.")}
                    />
                    {this._renderAttributes()}

                    <Section
                        title={tr(K + "s_goals", "System goals")}
                        description={tr(K + "s_goals_desc", "The objectives the network steers towards, measured live.")}
                    />
                    {this._renderGoals()}

                    <Section
                        title={tr(K + "s_funds", "Funds and price feeds")}
                        description={tr(K + "s_funds_desc", "Proposals to the Decentralized Pixa Fund, and the feeds that set PXS conversions.")}
                    />
                    <div className={classes.grid2}>
                        {this._renderDpf()}
                        {this._renderFeeds()}
                    </div>

                    <Section
                        title={tr(K + "s_events", "System events and actions")}
                        description={tr(K + "s_events_desc", "Where the community discusses the system, and what governance did in response to alerts.")}
                    />
                    <div className={classes.grid2}>
                        {this._renderDiscussions()}
                        {this._renderActions()}
                    </div>
                </div>
            </DialogContent>
        );
    }
}

export default withLanguage(withStyles(styles)(GDControlTower));
