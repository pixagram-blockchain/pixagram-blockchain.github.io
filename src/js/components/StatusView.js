import * as React from "preact/compat";

import withStyles from "@material-ui/core/styles/withStyles";
import DialogContent from "@material-ui/core/DialogContent";
import Typography from "@material-ui/core/Typography";
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import LinearProgress from '@material-ui/core/LinearProgress';
import Tooltip from "@material-ui/core/Tooltip";
import BlockViewer from "./BlockViewer";
import timeAgo from "../utils/TimeAgo";

import { T } from "../utils/T";
import { t, getLocaleCode } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";
// ── Must match BlockViewer constants ──────────────────────────────────────
const BLOCK_WIDTH_DESKTOP = 160;
const BLOCK_WIDTH_MOBILE  = 140;

const styles = theme => ({
    dialogContent: {
        margin: "12px 0px 24px 0px"
    },
    tooltip: {
        margin: "8px",
        display: "block",
        fontSize: "14px",
        lineHeight: "22px"
    },
    boxContainer: {
        display: "flex",
        flexWrap: "wrap"
    },

    // ── Scrollable block strip (mirrors BlockViewer) ──────────────────────
    blockStripOuter: {
        position: "relative",
        overflow: "hidden",
        margin: "12px 0 0 0",
        "&::before, &::after": {
            content: '""',
            position: "absolute",
            top: 0,
            bottom: 0,
            width: "48px",
            zIndex: 3,
            pointerEvents: "none",
        },
        "&::before": {
            left: 0,
            background: "linear-gradient(to right, #000000ee 0%, transparent 100%)",
        },
        "&::after": {
            right: 0,
            background: "linear-gradient(to left, #000000ee 0%, transparent 100%)",
        },
    },
    blockStripScroll: {
        display: "flex",
        flexDirection: "row",
        overflowX: "auto",
        overflowY: "hidden",
        padding: "12px 12px 8px 12px",
        scrollBehavior: "smooth",
        scrollbarWidth: "thin",
        scrollbarColor: "#333 transparent",
        "&::-webkit-scrollbar": {
            height: "6px",
        },
        "&::-webkit-scrollbar-track": {
            background: "transparent",
        },
        "&::-webkit-scrollbar-thumb": {
            background: "#444",
            borderRadius: "3px",
        },
        "&::-webkit-scrollbar-thumb:hover": {
            background: "#666",
        },
    },
    boxBlock: {
        userSelect: "none",
        cursor: "pointer",
        padding: "12px 14px",
        margin: "4px",
        backgroundColor: "#88888822",
        flex: `0 0 ${BLOCK_WIDTH_DESKTOP - 8}px`,
        minWidth: `${BLOCK_WIDTH_DESKTOP - 8}px`,
        [theme.breakpoints.down("sm")]: {
            flex: `0 0 ${BLOCK_WIDTH_MOBILE - 8}px`,
            minWidth: `${BLOCK_WIDTH_MOBILE - 8}px`,
        },
        borderRadius: "16px",
        boxSizing: "border-box",
        opacity: 1,
        transition: "background-color 200ms ease, transform 200ms ease, opacity 200ms ease, box-shadow 200ms ease",
        "&:hover": {
            backgroundColor: "#88888844",
            transform: "translateY(-2px)",
        }
    },
    boxBlockGap: {
        flex: `0 0 ${BLOCK_WIDTH_DESKTOP - 8}px`,
        minWidth: `${BLOCK_WIDTH_DESKTOP - 8}px`,
        [theme.breakpoints.down("sm")]: {
            flex: `0 0 ${BLOCK_WIDTH_MOBILE - 8}px`,
            minWidth: `${BLOCK_WIDTH_MOBILE - 8}px`,
        },
        margin: "4px",
        padding: "12px 14px",
        borderRadius: "16px",
        boxSizing: "border-box",
        border: "2px dashed #ffffff18",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: 0.4,
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
    boxPrimary: {
        fontSize: "18px",
        fontWeight: "bold",
        color: "#fff",
        display: "block",
        marginBottom: "3px",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    boxSecondary: {
        fontSize: "11px",
        color: "#888",
        display: "block",
        lineHeight: "1.5",
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
    }
});

class StatusView extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            _blockViewerOpen: false,
            _blockViewerBlock: 0,
        };
    }

    _openBlockViewer = (blockNumber) => {
        this.setState({ _blockViewerOpen: true, _blockViewerBlock: blockNumber });
    }

    _closeBlockViewer = () => {
        this.setState({ _blockViewerOpen: false });
    }

    _renderBlock = (blockNumber, witness, size, timestamp, transactions) => {
        const { classes } = this.props;

        return (
            <div
                className={classes.boxBlock}
                onClick={() => this._openBlockViewer(blockNumber)}
                key={blockNumber}
            >
                <span className={classes.boxPrimary}>
                    {`#${blockNumber.toLocaleString(getLocaleCode())}`}
                </span>
                <span className={classes.boxSecondary}>
                    <span style={{ color: "#fff" }}>@{witness}</span>
                    <br />
                    <span>{size}</span>
                    <span> · </span>
                    <Tooltip arrow title={new Date(timestamp).toLocaleDateString(getLocaleCode(), {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric',
                        second: 'numeric'
                    })}>
                        <span className={classes.subheaderDate}>{timeAgo.format(new Date(timestamp))}</span>
                    </Tooltip>
                    <br />
                    <span>{t("components.status_view.tx", { transaction: { transaction: transactions } })}</span>
                </span>
            </div>
        );
    }

    _renderGapBlock = () => {
        const { classes } = this.props;
        return (
            <div className={classes.boxBlockGap} key="gap-next">
                <span style={{ fontSize: "11px", color: "#ffffff44", textAlign: "center" }}>
                    {t("words.next_block")}
                </span>
            </div>
        );
    }

    render() {
        const { classes, blocksNumber } = this.props;
        const { _blockViewerOpen, _blockViewerBlock } = this.state;

        const _currentBlock = 12889222 + blocksNumber;
        const _now = Date.now();

        const blocksData = [
            { offset: 0, witness: "sophiajulio", size: "73.6kB", timeOffset: 2100, transactions: 1675 },
            { offset: 1, witness: "debw", size: "31.9kB", timeOffset: 5100, transactions: 297 },
            { offset: 2, witness: "fririus", size: "19.2kB", timeOffset: 8100, transactions: 143 },
            { offset: 3, witness: "debw", size: "41.7kB", timeOffset: 11100, transactions: 452 }
        ];

        // Build blocks newest-first (descending) to match BlockViewer direction
        const blocks = blocksData
            .slice(0, blocksNumber)
            .map(block => this._renderBlock(
                _currentBlock - block.offset,
                block.witness,
                block.size,
                _now - block.timeOffset,
                block.transactions
            ));

        return (
            <React.Fragment>
                <DialogContent scroll={"paper"} className={classes.dialogContent}>
                    <Typography component={"h2"} variant={"h6"}>{t("components.status_view.status")}</Typography>
                    <Typography component={"p"} variant={"body1"}>{t("components.status_view.the_system_status")}</Typography>
                    <div className={classes.boxContainer}>
                        <div className={classes.box}>
                            <span className={classes.boxPrimary}>5M</span>
                            <span className={classes.boxSecondary}>{t("words.number_of_accounts")}</span>
                        </div>
                        <div className={classes.box}>
                            <span className={classes.boxPrimary}>5%</span>
                            <span className={classes.boxSecondary}>{t("components.status_view.of_active_accounts_in_the_last_7")}</span>
                        </div>
                        <div className={classes.box}>
                            <span className={classes.boxPrimary}>$ 1.2 B</span>
                            <span className={classes.boxSecondary}>{t("components.status_view.market_capitalisation")}</span>
                        </div>
                        <div className={classes.box}>
                            <span className={classes.boxPrimary}>+ 5K</span>
                            <span className={classes.boxSecondary}>{t("components.status_view.new_accounts_in_the_last_7_days")}</span>
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
                            <span className={classes.boxPrimary}>$ 50M</span>
                            <span className={classes.boxSecondary}>{t("components.status_view.decentralized_pixa_fund")}</span>
                        </div>
                        <div className={classes.box}>
                            <span className={classes.boxPrimary}>$280K</span>
                            <span className={classes.boxSecondary}>{t("components.status_view.payout_in_the_last_7_days_for")}</span>
                        </div>
                    </div>

                    <Typography component={"h2"} variant={"h6"}>{t("components.status_view.metrics")}</Typography>
                    <Typography component={"p"} variant={"body1"}>{t("components.status_view.only_next_witnesses_can_modify_the_metrics")}</Typography>
                    <div className={classes.boxContainer}>
                        <Tooltip title={
                            <div className={classes.tooltip}>
                                <span><T
                                        k="components.status_view.pixasupra_is_a_type_of_token_which"
                                        slots={[<a
                                            style={{ color: "#000" }}
                                            href={"https://truflation.com/marketplace/us-big-mac"}
                                            target={"_blank"}
                                            key="0" />]} /></span>
                            </div>
                        } interactive arrow>
                            <div className={classes.box}>
                                <span className={classes.boxPrimary}>$ 5.69</span>
                                <span className={classes.boxSecondary}>{t("components.status_view.recommended_price_of_one_pixasupra_ps")}</span>
                            </div>
                        </Tooltip>
                        <Tooltip title={
                            <div className={classes.tooltip}>
                                <span><T k="components.status_view.the_price_feed_for_the_pixasupra_versus" /></span>
                            </div>
                        } interactive arrow>
                            <div className={classes.box}>
                                <span className={classes.boxPrimary}>1 : 57</span>
                                <span className={classes.boxSecondary}>{t("components.status_view.conversion_rate_ps_pl")}</span>
                            </div>
                        </Tooltip>
                        <Tooltip title={
                            <div className={classes.tooltip}>
                                <span>{t("components.status_view.based_on_the_price_feed_1_57")}</span>
                            </div>
                        } interactive arrow>
                            <div className={classes.box}>
                                <span className={classes.boxPrimary}>$ 0.10</span>
                                <span className={classes.boxSecondary}>{t("components.status_view.price_of_one_pixaliquid_pl")}</span>
                            </div>
                        </Tooltip>
                        <Tooltip title={
                            <div className={classes.tooltip}>
                                <span>{t("components.status_view.similar_to_most_stablecoin_its_algorithms_requir")}</span>
                            </div>
                        } interactive arrow>
                            <div className={classes.box}>
                                <span className={classes.boxPrimary}>0%</span>
                                <span className={classes.boxSecondary}>{t("components.status_view.recommended_apr_on_the_stacking_of_pixasupra")}</span>
                            </div>
                        </Tooltip>
                        <Tooltip title={
                            <div className={classes.tooltip}>
                                <span>{t("components.status_view.the_blockchain_can_emit_various_ratio_of")}</span>
                            </div>
                        } interactive arrow>
                            <div className={classes.boxLarge}>
                                <span className={classes.boxPrimary}>8.1% / 30% (3.7x margin)</span>
                                <LinearProgress className={classes.linearProgress} variant="buffer" value={8.1} valueBuffer={30} />
                                <span className={classes.boxSecondary}>{t("components.status_view.pixa_supra_should_never_surpass_30_of")}<br />{t("components.status_view.so_the_price_of_pixa_could_drop")}</span>
                            </div>
                        </Tooltip>
                    </div>

                    <Typography component={"h2"} variant={"h6"}>{t("components.status_view.blocks")}</Typography>
                    <Typography component={"p"} variant={"body1"}>{t("components.status_view.the_blockchain_produces_a_block_every_3")}</Typography>

                    {/* Scrollable block strip — newest on left, gap then blocks */}
                    <div className={classes.blockStripOuter}>
                        <div className={classes.blockStripScroll}>
                            {this._renderGapBlock()}
                            {blocks}
                        </div>
                    </div>

                    <Typography component={"h2"} variant={"h6"} style={{ marginTop: 12 }}>{t("words.endpoint")}</Typography>
                    <p>{t("components.status_view.you_can_choose_the_node_of_the")}</p>
                    <List>
                        <ListItem>
                            <ListItemText primary={"https://api.pixagram.com"} secondary={t("components.status_view.located_in_monaco")} />
                        </ListItem>
                    </List>
                </DialogContent>
                <BlockViewer
                    open={_blockViewerOpen}
                    block={_blockViewerBlock}
                    onClose={this._closeBlockViewer}
                />
            </React.Fragment>
        );
    }
}

export default withLanguage(withStyles(styles)(StatusView));