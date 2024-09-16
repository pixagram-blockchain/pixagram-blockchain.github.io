import * as React from "preact/compat";

import withStyles from "@material-ui/core/styles/withStyles";
import DialogContent from "@material-ui/core/DialogContent";
import Typography from "@material-ui/core/Typography";
import LinearProgress from '@material-ui/core/LinearProgress';
import Tooltip from "@material-ui/core/Tooltip";
import BlockViewer from "./BlockViewer";
import timeAgo from "../utils/TimeAgo";
import { gatedInterval } from "../utils/visibility";

import { t, getLocaleCode } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";
const styles = theme => ({
    dialogContent: {
        padding: "24px"
    },
    sectionTitle: {
        fontSize: "18px",
        fontWeight: 600,
        color: "#fff",
        fontFamily: "'Industry Book'",
        marginTop: "24px",
        marginBottom: "8px",
        "&:first-child": {
            marginTop: 0
        }
    },
    sectionDescription: {
        fontSize: "14px",
        color: "#888",
        fontFamily: "'Normative Pro'",
        marginBottom: "16px"
    },
    tooltip: {
        margin: "8px",
        display: "block",
        fontSize: "14px",
        fontFamily: "'Normative Pro'",
        lineHeight: "22px"
    },
    boxContainer: {
        display: "flex",
        flexWrap: "wrap",
        margin: "-8px"
    },
    boxContainerBlocks: {
        display: "flex",
        flexFlow: "row",
        position: "relative",
        marginTop: "12px",
        overflowX: "hidden"
    },
    overlayBlocks: {
        pointerEvents: "none",
        position: "absolute",
        width: "100%",
        height: "100%",
        top: 0,
        left: 0,
        backgroundImage: "linear-gradient(to right, transparent 80%, black 100%)",
    },
    boxLarge: {
        userSelect: "none",
        cursor: "pointer",
        padding: 16,
        margin: 8,
        backgroundColor: "#88888833",
        flex: "1 1 calc(100% - 16px)",
        borderRadius: "21px",
        boxSizing: "border-box",
        transition: "background-color 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms",
        "&:hover": {
            backgroundColor: "#8888884d",
            transition: "background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        }
    },
    box: {
        userSelect: "none",
        cursor: "pointer",
        padding: 16,
        margin: 8,
        backgroundColor: "#88888833",
        borderRadius: "19px",
        boxSizing: "border-box",
        transition: "background-color 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms",
        flex: "1 1 calc(25% - 16px)",
        [theme.breakpoints.down("sm")]: {
            flex: "1 1 calc(50% - 16px)",
        },
        "&:hover": {
            backgroundColor: "#8888884d",
            transition: "background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        }
    },
    boxBlock: {
        userSelect: "none",
        cursor: "pointer",
        padding: 16,
        margin: 8,
        backgroundColor: "#88888833",
        flex: "0 0 20%",
        [theme.breakpoints.down("sm")]: {
            flex: "0 0 33%",
        },
        borderRadius: "21px",
        boxSizing: "border-box",
        transition: "background-color 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms",
        "&:hover": {
            backgroundColor: "#8888884d",
            transition: "background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        }
    },
    boxBlockNew: {
        userSelect: "none",
        cursor: "pointer",
        padding: 16,
        margin: 8,
        backgroundColor: "#88888833",
        flex: "0 0 20%",
        [theme.breakpoints.down("sm")]: {
            flex: "0 0 33%",
        },
        borderRadius: "21px",
        boxSizing: "border-box",
        animation: "$blockPopIn 450ms cubic-bezier(0.22, 1, 0.36, 1) forwards",
        transition: "background-color 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms",
        "&:hover": {
            backgroundColor: "#8888884d",
            transition: "background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        }
    },
    "@keyframes blockPopIn": {
        "0%":   { transform: "scale(0)",    opacity: 0 },
        "50%":  { transform: "scale(1.08)", opacity: 1 },
        "75%":  { transform: "scale(0.96)", opacity: 1 },
        "100%": { transform: "scale(1)",    opacity: 1 }
    },
    boxBlockDisabled: {
        userSelect: "none",
        cursor: "pointer",
        padding: 16,
        margin: 8,
        color: "#000",
        backgroundColor: "#ccc",
        flex: "0 0 20%",
        [theme.breakpoints.down("sm")]: {
            flex: "0 0 33%",
        },
        borderRadius: "21px",
        boxSizing: "border-box",
        transition: "background-color 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms",
        "&:hover": {
            color: "#111",
            backgroundColor: "#eee",
            transition: "background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        }
    },
    boxPrimary: {
        fontSize: "21px",
        fontWeight: "bold",
        color: "#fff",
        fontFamily: "'Geist Mono', monospace",
        display: "block",
        marginBottom: "4px"
    },
    boxSecondary: {
        fontSize: "12px",
        color: "#999",
        fontFamily: "'Normative Pro'",
        display: "block"
    },
    nextBlockPrimary: {
        fontSize: "21px",
        color: "#000",
        display: "block",
        marginBottom: "4px"
    },
    nextBlockSecondary: {
        fontSize: "12px",
        color: "#222",
        display: "block"
    },
    linearProgress: {
        margin: "16px 0px 12px 0px",
        borderRadius: "6px",
        height: "18px",
        lineHeight: "18px",
        "@global": {
            "@keyframes glow": {
                "0%": {
                    background: "#3f3f3f",
                    color: "#d2d2d2"
                },
                "100%": {
                    background: "#595959",
                    color: "#fff"
                },
            }
        },
        "& div.MuiLinearProgress-barColorPrimary": {
            background: "#cdcdcd",
            "&::after": {
                content: `"Supra"`,
                position: "absolute",
                right: 8,
                bottom: 0,
                fontSize: "11px",
                color: "#000"
            },
        },
        "& div.MuiLinearProgress-colorPrimary": {
            "&::after": {
                content: `"Debt Limit"`,
                position: "absolute",
                right: 8,
                bottom: 0,
                fontSize: "11px",
                animation: "$glow 1s infinite linear alternate",
            },
            animation: "$glow 1s infinite linear alternate"
        },
        "& div.MuiLinearProgress-dashedColorPrimary": {
            background: "#2d2d2d",
            backgroundImage: "inherit",
            animation: "none",
            "&::after": {
                content: `"Pixa Backed"`,
                position: "absolute",
                right: 8,
                bottom: 0,
                fontSize: "11px",
                color: "#595959"
            },
        }
    },
    subheaderDate: {
        cursor: "pointer"
    },
});

// ── Helpers ────────────────────────────────────────────────────────────────

/** Parse "123.456 SYMBOL" → 123.456 */
function parseAsset(str) {
    if (!str) return 0;
    return parseFloat(String(str).split(" ")[0]) || 0;
}

/** Compact number display */
function compactNumber(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(0) + "K";
    return String(n);
}

/** Estimate block payload size from its JSON representation */
function estimateBlockSize(block) {
    if (!block) return "0kB";
    try {
        return (JSON.stringify(block).length / 1024).toFixed(1) + "kB";
    } catch {
        return "?kB";
    }
}

// ── Component ──────────────────────────────────────────────────────────────

class GDAttributes extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            api: props.api,

            // Live blockchain data
            globalProps: null,
            accountCount: 0,
            rewardFund: null,

            // Block stream
            blocks: [],            // Array of { ...blockData, block_number }
            _newBlockNumbers: new Set(), // Blocks that just appeared — animate then clear
            _lastHeadBlock: 0,
            _nextWitness: "",
            _nextBlockCountdown: 3,

            // Block viewer state
            _blockViewerOpen: false,
            _selectedBlock: 0,

            // Network metrics (fetched from proxy API)
            networkMetrics: {
                pxsPrice: "–",
                pixaPrice: "–",
                conversionRate: "–",
                pxsApr: "–",
                debt: { ratio: 0, limit: 30, margin: "0.0" },
            },

            loading: true,
        };
    }

    // ── Lifecycle ──────────────────────────────────────────────────────────

    componentDidMount() {
        this._unmounted = false;
        this._initData();
        // Hidden-tab gating: the countdown skips ticks while backgrounded
        // (its fixed cadence resumes untouched); the metrics poll also
        // fires once immediately on return so the dashboard isn't stale.
        this._cancelCountdown = gatedInterval(() => this._tickCountdown(), 1000);
        this._cancelMetrics = gatedInterval(() => this._fetchNetworkMetrics(), 30000, { fireOnResume: true });

        // Subscribe to live price updates (event-driven, no polling required)
        const api = this.state.api || this.props.api;
        if (api && api.eventEmitter && typeof api.eventEmitter.on === "function") {
            this._onPricesUpdated = () => this._fetchNetworkMetrics();
            api.eventEmitter.on('prices_updated', this._onPricesUpdated);
        }
    }

    componentWillUnmount() {
        this._unmounted = true;
        if (this._cancelCountdown) this._cancelCountdown();
        if (this._cancelMetrics) this._cancelMetrics();

        const api = this.state.api || this.props.api;
        if (api && api.eventEmitter && this._onPricesUpdated &&
            typeof api.eventEmitter.off === "function") {
            api.eventEmitter.off('prices_updated', this._onPricesUpdated);
        }
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.api && nextProps.api !== this.state.api) {
            this.setState({ api: nextProps.api }, () => {
                this._initData();
                this.forceUpdate();
            });
        }
    }

    // ── Data fetching ─────────────────────────────────────────────────────

    async _initData() {
        const api = this.state.api || this.props.api;
        if (!api) return;

        try {
            const results = await Promise.allSettled([
                api.globals.getDynamicGlobalProperties(),   // 0 (cached, fine for non-block fields)
                api.accounts.getAccountCount(),             // 1
                api.globals.getRewardFund("post"),          // 2
                api.witnesses.getActiveWitnesses(),         // 3
                api.blockchain.getCurrentBlockNum('latest'),// 4 (uncached, real head)
            ]);

            const val = (i) => results[i].status === "fulfilled" ? results[i].value : null;

            const globalProps      = val(0);
            const accountCount     = val(1) || 0;
            const rewardFund       = val(2);
            const activeWitnesses  = val(3) || [];
            const liveHead         = val(4) || (globalProps ? globalProps.head_block_number : 0);

            // Fetch initial batch of recent blocks using the live head
            const blocks = [];
            if (liveHead) {
                const blockResults = await Promise.allSettled(
                    [0, 1, 2, 3].map((i) => api.blockchain.getBlock(liveHead - i))
                );
                blockResults.forEach((r, i) => {
                    if (r.status === "fulfilled" && r.value) {
                        blocks.push({ ...r.value, block_number: liveHead - i });
                    }
                });
            }

            // Determine next witness from schedule
            let nextWitness = "";
            if (globalProps && activeWitnesses.length > 0) {
                const idx = activeWitnesses.indexOf(globalProps.current_witness);
                if (idx >= 0 && idx + 1 < activeWitnesses.length) {
                    nextWitness = activeWitnesses[idx + 1];
                } else if (activeWitnesses.length > 0) {
                    nextWitness = activeWitnesses[0];
                }
            }

            this.setState({
                globalProps,
                accountCount,
                rewardFund,
                blocks,
                _lastHeadBlock: liveHead,
                _nextWitness: nextWitness,
                _nextBlockCountdown: 3,
                loading: false,
            }, () => this.forceUpdate());

            // Fetch network metrics from the proxy API
            this._fetchNetworkMetrics();

            // Start live block streaming from the next block onward
            this._startBlockStream(liveHead + 1);
        } catch (e) {
            console.error("[GDAttributes] Init failed:", e);
            this.setState({ loading: false }, () => this.forceUpdate());
        }
    }

    /**
     * Consume the BlockchainAPI async generator to receive blocks as they're
     * produced. The generator handles its own pacing (3s block interval) and
     * uses uncached getDynamicGlobalProperties() under the hood, so we don't
     * have to poll or worry about the global_props cache TTL.
     */
    async _startBlockStream(fromBlock) {
        const api = this.state.api || this.props.api;
        if (!api || !api.blockchain) return;

        try {
            const stream = api.blockchain.getBlocks({ from: fromBlock, mode: 'latest' });
            for await (const block of stream) {
                if (this._unmounted) break;
                if (!block) continue;

                // The generator yields raw blocks without block_number — derive it.
                // SignedBlock has previous (e.g. "00bca1d4..."): blockNum = parseInt(prev, 16) + 1
                const blockNumber = block.block_number
                    || (block.previous ? parseInt(block.previous.slice(0, 8), 16) + 1 : null);
                if (!blockNumber) continue;

                // Refresh witness schedule when the producer rotates
                let nextWitness = this.state._nextWitness;
                let globalProps = this.state.globalProps;
                try {
                    const [gp, witnesses] = await Promise.all([
                        api.globals.getDynamicGlobalProperties(),
                        api.witnesses.getActiveWitnesses(),
                    ]);
                    if (gp) globalProps = gp;
                    if (witnesses && witnesses.length && gp) {
                        const idx = witnesses.indexOf(gp.current_witness);
                        nextWitness = witnesses[(idx + 1) % witnesses.length] || witnesses[0];
                    }
                } catch { /* keep previous values */ }

                if (this._unmounted) break;

                this.setState((prev) => ({
                    globalProps,
                    blocks: [{ ...block, block_number: blockNumber }, ...prev.blocks].slice(0, 20),
                    _newBlockNumbers: new Set([blockNumber]),
                    _lastHeadBlock: blockNumber,
                    _nextWitness: nextWitness,
                    _nextBlockCountdown: 3,
                }), () => this.forceUpdate());

                // Clear the "new" highlight after the pop-in animation
                setTimeout(() => {
                    if (this._unmounted) return;
                    this.setState({ _newBlockNumbers: new Set() }, () => this.forceUpdate());
                }, 600);
            }
        } catch (e) {
            console.warn("[GDAttributes] Block stream error:", e.message);
            // Auto-reconnect after a short delay if we're still mounted
            if (!this._unmounted) {
                setTimeout(() => {
                    if (!this._unmounted) {
                        this._startBlockStream(this.state._lastHeadBlock + 1);
                    }
                }, 5000);
            }
        }
    }

    _tickCountdown = () => {
        this.setState((prev) => ({
            _nextBlockCountdown: Math.max(0, prev._nextBlockCountdown - 1),
        }), () => this.forceUpdate());
    }

    // ── Block viewer ──────────────────────────────────────────────────────

    _openBlockViewer = (blockNumber) => {
        this.setState({
            _blockViewerOpen: true,
            _selectedBlock: blockNumber,
        }, () => this.forceUpdate());
    }

    _closeBlockViewer = () => {
        this.setState({ _blockViewerOpen: false }, () => this.forceUpdate());
    }

    // ── Network metrics (fetched from proxy API) ─────────────────────────────

    _fetchNetworkMetrics = async () => {
        const api = this.state.api || this.props.api;
        if (!api) return;

        // chainProps + globalProps for APR + debt; prices via the canonical PricesAPI.
        const results = await Promise.allSettled([
            api.globals.getDynamicGlobalProperties(),
            api.globals.getChainProperties(),
            api.prices.get(),
        ]);
        const val = (i) => results[i].status === "fulfilled" ? results[i].value : null;
        const globalProps = val(0);
        const chainProps  = val(1);
        const prices      = val(2);  // { pxaUsd, pxsUsd, source, feedRatio, isReal }

        try {
            const pxsUsd     = prices ? prices.pxsUsd    : 0;
            const pxaUsd     = prices ? prices.pxaUsd    : 0;
            const feedRatio  = prices ? prices.feedRatio : null;  // PXA per 1 PXS

            const pxsPrice = pxsUsd > 0 ? "$ " + pxsUsd.toFixed(2) : "–";
            const pixaPrice = pxaUsd > 0 ? "$ " + pxaUsd.toFixed(2) : "–";
            const conversionRate = (feedRatio && feedRatio > 0)
                ? Math.round(feedRatio)
                : Math.round(pxsUsd / pxaUsd);  // fallback to design ratio

            // PXS APR
            const pxsApr = (chainProps && chainProps.pxs_interest_rate !== undefined)
                ? (chainProps.pxs_interest_rate / 100).toFixed(1) + "%"
                : "–";

            // Debt ratio: PXS supply (valued in PXA via feed) vs virtual PIXA supply
            let debt = { ratio: 0, limit: 30, margin: "0.0" };
            if (globalProps && feedRatio && feedRatio > 0) {
                const pxsSupply     = parseAsset(globalProps.current_pxs_supply);
                const virtualSupply = parseAsset(globalProps.virtual_supply);
                if (virtualSupply > 0) {
                    const pxsInPixa = pxsSupply * feedRatio;
                    const ratio     = (pxsInPixa / virtualSupply) * 100;
                    const margin    = ratio > 0 ? (30 / ratio) : 0;
                    debt = {
                        ratio: Math.round(ratio * 10) / 10,
                        limit: 30,
                        margin: margin.toFixed(1),
                    };
                }
            }

            this.setState({
                networkMetrics: { pxsPrice, pixaPrice, conversionRate, pxsApr, debt },
            }, () => this.forceUpdate());
        } catch (e) {
            console.warn("[GDAttributes] Network metrics fetch failed:", e.message);
        }
    }

    // ── Render helpers ────────────────────────────────────────────────────

    _renderBlock = (block) => {
        const { classes } = this.props;
        const blockNumber  = block.block_number;
        const witness      = block.witness || "unknown";
        const txCount      = block.transactions ? block.transactions.length : 0;
        const size         = estimateBlockSize(block);
        const timestamp    = new Date(block.timestamp + "Z");
        const isNew        = this.state._newBlockNumbers.has(blockNumber);

        return (
            <div className={isNew ? classes.boxBlockNew : classes.boxBlock} onClick={() => this._openBlockViewer(blockNumber)} key={blockNumber}>
                <span className={classes.boxPrimary}>
                    {`#${blockNumber.toLocaleString(getLocaleCode())}`}
                </span>
                <span className={classes.boxSecondary}>
                    <span style={{ color: "#fff" }}>@{witness}</span>
                    <span> processed {size} </span>
                    <Tooltip arrow title={timestamp.toLocaleDateString(getLocaleCode(), {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "numeric",
                        minute: "numeric",
                        second: "numeric",
                    })}>
                        <span className={classes.subheaderDate}>{timeAgo.format(timestamp)}</span>
                    </Tooltip>
                    <span>{t("components.gdattributes.with_transactions", {
                            txCount: txCount
                        })}</span>
                </span>
            </div>
        );
    }

    // ── Render ────────────────────────────────────────────────────────────

    render() {
        const { classes } = this.props;
        const {
            globalProps,
            accountCount,
            rewardFund,
            blocks,
            _blockViewerOpen,
            _selectedBlock,
            _nextWitness,
            _nextBlockCountdown,
            loading,
        } = this.state;

        const api = this.state.api || this.props.api;

        // Derived display values (safe for null globalProps)
        const headBlock        = globalProps ? globalProps.head_block_number : 0;
        const currentSupply    = globalProps ? parseAsset(globalProps.current_supply) : 0;
        const virtualSupply    = globalProps ? parseAsset(globalProps.virtual_supply) : 0;
        const pxsSupply        = globalProps ? parseAsset(globalProps.current_pxs_supply) : 0;
        const rewardPool       = rewardFund ? parseAsset(rewardFund.reward_balance) : 0;

        // Network metrics (fetched from proxy API)
        const { pxsPrice, pixaPrice, conversionRate, pxsApr, debt } = this.state.networkMetrics;

        // "Next block" label
        const nextLabel = _nextBlockCountdown > 0
            ? `In ${_nextBlockCountdown}s${_nextWitness ? ` by @${_nextWitness}` : ""}`
            : `Now${_nextWitness ? ` by @${_nextWitness}` : ""}`;

        return (
            <React.Fragment>
                <DialogContent className={classes.dialogContent}>
                    <Typography className={classes.sectionTitle}>{t("components.gdattributes.system_status")}</Typography>
                    <Typography className={classes.sectionDescription}>
                        {t("components.gdattributes.current_state_of_the_pixagram_network_and")}
                    </Typography>
                    <div className={classes.boxContainer}>
                        <div className={classes.box}>
                            <span className={classes.boxPrimary}>
                                {loading ? "..." : compactNumber(accountCount)}
                            </span>
                            <span className={classes.boxSecondary}>{t("words.number_of_accounts")}</span>
                        </div>
                        <div className={classes.box}>
                            <span className={classes.boxPrimary}>
                                {loading ? "..." : compactNumber(Math.round(currentSupply)) + " PIXA"}
                            </span>
                            <span className={classes.boxSecondary}>{t("components.gdattributes.current_supply")}</span>
                        </div>
                        <div className={classes.box}>
                            <span className={classes.boxPrimary}>
                                {loading ? "..." : compactNumber(Math.round(virtualSupply)) + " PIXA"}
                            </span>
                            <span className={classes.boxSecondary}>{t("components.gdattributes.virtual_supply")}</span>
                        </div>
                        <div className={classes.box}>
                            <span className={classes.boxPrimary}>
                                {loading ? "..." : compactNumber(Math.round(pxsSupply)) + " PXS"}
                            </span>
                            <span className={classes.boxSecondary}>{t("components.gdattributes.pxs_supply")}</span>
                        </div>
                        <div className={classes.box}>
                            <span className={classes.boxPrimary}>9.5%</span>
                            <span className={classes.boxSecondary}>{t("words.inflation_per_year")}</span>
                        </div>
                        <div className={classes.box}>
                            <span className={classes.boxPrimary}>3.0s</span>
                            <span className={classes.boxSecondary}>{t("words.block_interval_time")}</span>
                        </div>
                        <div className={classes.box}>
                            <span className={classes.boxPrimary}>
                                {loading ? "..." : compactNumber(Math.round(rewardPool)) + " PIXA"}
                            </span>
                            <span className={classes.boxSecondary}>{t("components.gdattributes.reward_pool_balance")}</span>
                        </div>
                        <div className={classes.box}>
                            <span className={classes.boxPrimary}>
                                {loading ? "..." : `#${headBlock.toLocaleString(getLocaleCode())}`}
                            </span>
                            <span className={classes.boxSecondary}>{t("components.gdattributes.head_block")}</span>
                        </div>
                    </div>

                    <Typography className={classes.sectionTitle}>{t("components.gdattributes.network_metrics")}</Typography>
                    <Typography className={classes.sectionDescription}>
                        {t("components.gdattributes.only_active_witnesses_can_modify_these_metrics")}
                    </Typography>
                    <div className={classes.boxContainer}>
                        <Tooltip title={
                            <div className={classes.tooltip}>
                                {t("components.gdattributes.pixasupra_is_a_token_pegged_to_the")}
                            </div>
                        } interactive arrow>
                            <div className={classes.box}>
                                <span className={classes.boxPrimary}>{loading ? "..." : pxsPrice}</span>
                                <span className={classes.boxSecondary}>{t("components.gdattributes.pixasupra_pxs_price")}</span>
                            </div>
                        </Tooltip>
                        <Tooltip title={
                            <div className={classes.tooltip}>
                                {t("components.gdattributes.the_price_feed_balances_incentives_between_curre")}
                            </div>
                        } interactive arrow>
                            <div className={classes.box}>
                                <span className={classes.boxPrimary}>
                                    {loading ? "..." : `1 : ${conversionRate}`}
                                </span>
                                <span className={classes.boxSecondary}>{t("components.gdattributes.conversion_rate_pxs_pxa")}</span>
                            </div>
                        </Tooltip>
                        <Tooltip title={
                            <div className={classes.tooltip}>
                                {t("components.gdattributes.based_on_the_price_feed_the_average")}
                            </div>
                        } interactive arrow>
                            <div className={classes.box}>
                                <span className={classes.boxPrimary}>{loading ? "..." : pixaPrice}</span>
                                <span className={classes.boxSecondary}>{t("components.gdattributes.pixa_pxa_price")}</span>
                            </div>
                        </Tooltip>
                        <Tooltip title={
                            <div className={classes.tooltip}>
                                {t("components.gdattributes.apr_for_long_term_staking_of_pixasupra")}
                            </div>
                        } interactive arrow>
                            <div className={classes.box}>
                                <span className={classes.boxPrimary}>{loading ? "..." : pxsApr}</span>
                                <span className={classes.boxSecondary}>{t("components.gdattributes.pixasupra_apr")}</span>
                            </div>
                        </Tooltip>
                        <Tooltip title={
                            <div className={classes.tooltip}>
                                {t("components.gdattributes.pixasupra_acts_as_debt_of_the_blockchain")}
                            </div>
                        } interactive arrow>
                            <div className={classes.boxLarge}>
                                <span className={classes.boxPrimary}>
                                    {loading
                                        ? "..."
                                        : `${debt.ratio}% / ${debt.limit}% (${debt.margin}x margin)`}
                                </span>
                                <LinearProgress
                                    className={classes.linearProgress}
                                    variant="buffer"
                                    value={debt.ratio}
                                    valueBuffer={debt.limit}
                                />
                                <span className={classes.boxSecondary}>{t("components.gdattributes.pixa_supra_should_never_surpass_of_pixa", {
                                        limit: debt.limit
                                    })}</span>
                            </div>
                        </Tooltip>
                    </div>

                    <Typography className={classes.sectionTitle}>{t("components.gdattributes.recent_blocks")}</Typography>
                    <Typography className={classes.sectionDescription}>
                        {t("components.gdattributes.the_blockchain_produces_a_block_every_3")}
                    </Typography>
                    <div className={classes.boxContainerBlocks}>
                        <div className={classes.overlayBlocks}></div>
                        <div className={classes.boxBlockDisabled}>
                            <span className={classes.nextBlockPrimary}>{t("components.gdattributes.next_block")}</span>
                            <span className={classes.nextBlockSecondary}>{nextLabel}</span>
                        </div>
                        {blocks.map((block) => this._renderBlock(block))}
                    </div>
                </DialogContent>
                <BlockViewer
                    open={_blockViewerOpen}
                    onClose={this._closeBlockViewer}
                    api={api}
                    block={_selectedBlock}
                />
            </React.Fragment>
        );
    }
}

export default withLanguage(withStyles(styles)(GDAttributes));