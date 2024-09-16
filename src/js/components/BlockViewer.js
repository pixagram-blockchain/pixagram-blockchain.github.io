import * as React from "preact/compat";

import withStyles from "@material-ui/core/styles/withStyles";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogActions from "@material-ui/core/DialogActions";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemAvatar from '@material-ui/core/ListItemAvatar';
import LinearProgress from '@material-ui/core/LinearProgress';
import Checkbox from '@material-ui/core/Checkbox';
import Avatar from '@material-ui/core/Avatar';
import Tooltip from "@material-ui/core/Tooltip";
import TextField from "@material-ui/core/TextField";
import Badge from "@material-ui/core/Badge";
import Tab from "@material-ui/core/Tab";
import PieChart from "@material-ui/icons/PieChart";
import Tabs from "@material-ui/core/Tabs";
import SwipeableDrawer from "@material-ui/core/SwipeableDrawer";
import timeAgo from "../utils/TimeAgo";
import ButtonBase from "@material-ui/core/ButtonBase";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Input from "@material-ui/core/Input";
import InputAdornment from "@material-ui/core/InputAdornment";
import ListSubheader from "@material-ui/core/ListSubheader";
import CodeIcon from "@material-ui/icons/Code";
import IconButton from "@material-ui/core/IconButton";
import CloseIcon from "@material-ui/icons/Close";
import SearchIcon from "@material-ui/icons/Search";
import InfoOutlinedIcon from "@material-ui/icons/InfoOutlined";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import { useTheme } from "@material-ui/core/styles";

import { T } from "../utils/T";
import { t, getLocaleCode, useLanguage } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";
// ── Block strip dimensions ────────────────────────────────────────────────
const BLOCK_WIDTH_DESKTOP = 160;  // px including margin
const BLOCK_WIDTH_MOBILE  = 140;
const NEIGHBOR_COUNT      = 20;   // 20 before + 20 after the selected block
// Uniform horizontal margin per card. Wide enough that the 1.12× selected card
// never overlaps its neighbours, so every card keeps the SAME layout width and
// selecting one causes no reflow.
const CARD_MARGIN         = 10;
// Easing for the filmstrip recentre animation.
const TX_TRANSITION       = "transform 380ms cubic-bezier(0.22, 0.61, 0.36, 1)";

const styles = theme => ({
    dialog: {
        "& .MuiDialog-paperScrollPaper": {
            [theme.breakpoints.down("sm")]: {
                maxHeight: "100%"
            }
        },
        "& .MuiDialog-paperFullWidth": {
            [theme.breakpoints.down("sm")]: {
                width: "100% !important"
            }
        },
        "& .react-swipeable-view-container": {
            height: "max(80vh, calc(-420px + 100vh)) !important"
        },
        "& .react-swipeable-view-container > div": {
            height: "max(80vh, calc(-420px + 100vh)) !important",
            overflow: "hidden overlay !important"
        }
    },
    cardTabs: {
        backgroundColor: "#171717",
        "& .MuiTab-root": {
            minWidth: "72px !important"
        },
        "& .MuiTab-textColorPrimary.Mui-selected": {
            backgroundColor: "transparent",
        },
        "& .MuiTab-textColorPrimary.Mui-selected .MuiTab-wrapper": {
            color: "#171717 !important"
        },
        "& .MuiTab-fullWidth": {
            backgroundColor: "transparent",
            color: "#989898",
            transition: "all 225ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
            borderRadius: "21px"
        },
        "& .MuiTab-fullWidth:hover": {
            backgroundColor: "rgba(255,255,255,0.06)"
        },
        "& span.MuiTabs-indicator": {
            zIndex: "-1",
            height: "48px",
            backgroundColor: "#c7c7c7",
            borderRadius: "21px",
            transform: "scale3d(0.875, 0.75, 1)"
        },
        margin: "8px 16px 0px 16px",
        width: "calc(100% - 32px)",
        borderRadius: "21px",
        top: 0,
        left: 0,
        zIndex: 1,
        transition: "transform 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
    },
    subTitle: {
        margin: "24px 0px 12px 0px"
    },
    dialogContent: {
        margin: "12px 0px 24px 0px"
    },
    link: {
        cursor: "pointer",
        textDecoration: "underline"
    },
    boxContainer: {
        display: "flex",
        flexWrap: "wrap"
    },

    // ── Scrollable block strip ────────────────────────────────────────────
    blockStripOuter: {
        position: "relative",
        overflow: "hidden",
        margin: "0",
        padding: "0",
        cursor: "grab",
        touchAction: "pan-y",        // let vertical page scroll through; we own X
        userSelect: "none",
        "&:active": {
            cursor: "grabbing",
        },
        // Fade edges
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
    // The inner "filmstrip": positioned with translateX (set imperatively),
    // never natively scrolled. CSS transitions on the transform give a smooth
    // recentre that can be retargeted mid-flight.
    blockStripScroll: {
        display: "flex",
        flexDirection: "row",
        flexWrap: "nowrap",
        width: "max-content",
        padding: "18px 0 16px 0",
        position: "relative",
        willChange: "transform",
        transform: "translate3d(0,0,0)",
    },

    // ── Block card in the strip ───────────────────────────────────────────
    // Every card variant keeps the SAME box-model width (flex-basis + margin),
    // so selecting a card (which only scales it visually) never reflows the row.
    boxBlock: {
        userSelect: "none",
        cursor: "pointer",
        padding: "12px 14px",
        margin: `4px ${CARD_MARGIN}px`,
        backgroundColor: "#88888822",
        flex: `0 0 ${BLOCK_WIDTH_DESKTOP - CARD_MARGIN * 2}px`,
        minWidth: `${BLOCK_WIDTH_DESKTOP - CARD_MARGIN * 2}px`,
        [theme.breakpoints.down("sm")]: {
            flex: `0 0 ${BLOCK_WIDTH_MOBILE - CARD_MARGIN * 2}px`,
            minWidth: `${BLOCK_WIDTH_MOBILE - CARD_MARGIN * 2}px`,
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
    boxBlockSelected: {
        userSelect: "none",
        cursor: "pointer",
        padding: "12px 14px",
        // Same width + margin as a normal card — only the visual scale differs,
        // so the surrounding layout is identical whether selected or not.
        margin: `4px ${CARD_MARGIN}px`,
        color: "#000",
        backgroundColor: "#fff",
        flex: `0 0 ${BLOCK_WIDTH_DESKTOP - CARD_MARGIN * 2}px`,
        minWidth: `${BLOCK_WIDTH_DESKTOP - CARD_MARGIN * 2}px`,
        [theme.breakpoints.down("sm")]: {
            flex: `0 0 ${BLOCK_WIDTH_MOBILE - CARD_MARGIN * 2}px`,
            minWidth: `${BLOCK_WIDTH_MOBILE - CARD_MARGIN * 2}px`,
        },
        borderRadius: "16px",
        boxSizing: "border-box",
        zIndex: 2,
        position: "relative",
        transform: "scale(1.12)",
        boxShadow: "0 8px 28px rgba(255,255,255,0.12), 0 3px 10px rgba(0,0,0,0.35)",
        transition: "background-color 200ms ease, transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 300ms ease",
        "&:hover": {
            backgroundColor: "#f0f0f0",
        }
    },
    boxBlockNew: {
        userSelect: "none",
        cursor: "pointer",
        padding: "12px 14px",
        margin: `4px ${CARD_MARGIN}px`,
        backgroundColor: "#88888822",
        flex: `0 0 ${BLOCK_WIDTH_DESKTOP - CARD_MARGIN * 2}px`,
        minWidth: `${BLOCK_WIDTH_DESKTOP - CARD_MARGIN * 2}px`,
        [theme.breakpoints.down("sm")]: {
            flex: `0 0 ${BLOCK_WIDTH_MOBILE - CARD_MARGIN * 2}px`,
            minWidth: `${BLOCK_WIDTH_MOBILE - CARD_MARGIN * 2}px`,
        },
        borderRadius: "16px",
        boxSizing: "border-box",
        animation: "$slideInBlock 400ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        transition: "background-color 200ms ease",
        "&:hover": {
            backgroundColor: "#88888844",
            transform: "translateY(-2px)",
        }
    },
    boxBlockGap: {
        flex: `0 0 ${BLOCK_WIDTH_DESKTOP - CARD_MARGIN * 2}px`,
        minWidth: `${BLOCK_WIDTH_DESKTOP - CARD_MARGIN * 2}px`,
        [theme.breakpoints.down("sm")]: {
            flex: `0 0 ${BLOCK_WIDTH_MOBILE - CARD_MARGIN * 2}px`,
            minWidth: `${BLOCK_WIDTH_MOBILE - CARD_MARGIN * 2}px`,
        },
        margin: `4px ${CARD_MARGIN}px`,
        padding: "12px 14px",
        borderRadius: "16px",
        boxSizing: "border-box",
        border: "2px dashed #ffffff18",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: 0.4,
    },

    "@keyframes slideInBlock": {
        "0%": {
            opacity: 0,
            transform: "scale(0.96)",
        },
        "100%": {
            opacity: 1,
            transform: "scale(1)",
        }
    },

    boxPrimary: {
        fontSize: "18px",
        fontWeight: "bold",
        color: "#fff",
        display: "block",
        marginBottom: "3px",
        transition: "color 200ms ease",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    boxSecondary: {
        fontSize: "11px",
        color: "#888",
        display: "block",
        transition: "color 200ms ease",
        lineHeight: "1.5",
    },
    selectedBlockPrimary: {
        fontSize: "18px",
        fontWeight: "bold",
        color: "#000",
        display: "block",
        marginBottom: "3px",
        transition: "color 200ms ease",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    selectedBlockSecondary: {
        fontSize: "11px",
        color: "#555",
        display: "block",
        transition: "color 200ms ease",
        lineHeight: "1.5",
    },
    nextBlockPrimary: {
        fontSize: "18px",
        color: "#000",
        display: "block",
        marginBottom: "3px",
    },
    nextBlockSecondary: {
        fontSize: "11px",
        color: "#222",
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
    listItemHeader: {
        backgroundColor: "#171717",
        borderRadius: "21px",
        marginBottom: "8px"
    },
    listItem: {
        cursor: "pointer",
        backgroundColor: "rgb(255 255 255 / 0%)",
        borderRadius: "21px",
        transition: "background-color 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms",
        "&:hover": {
            backgroundColor: "rgb(255 255 255 / 5%)",
            transition: "background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        }
    },
    witnessTable:  {
        width: "100%",
        borderCollapse: "collapse",
        marginTop: theme.spacing(2),
        marginBottom: theme.spacing(4),
        fontSize: "0.875rem",
        "& tr > th": {
            backgroundColor: "#191919",
            padding: theme.spacing(1.5),
            textAlign: "left",
            fontWeight: 600,
            borderBottom: `0px solid #ffffff12`,
            transition: "background-color 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms",
        },
        "& tr:hover > th": {
            backgroundColor: "#222",
            transition: "background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        },
        "& tr > th:first-child": {
            borderRadius: "16px 0px 0px 0px"
        },
        "& tr > th:last-child": {
            borderRadius: "0px 16px 0px 0px",
        },
        "& tr > td": {
            backgroundColor: "transparent",
            transition: "background-color 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms",
        },
        "& tr:hover > td": {
            backgroundColor: "#171717",
            transition: "background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        },
        "& tr:last-child > td:first-child": {
            borderRadius: "0px 0px 0px 16px"
        },
        "& tr:last-child > td:last-child": {
            borderRadius: "0px 0px 16px 0px",
        },
        "& td": {
            padding: "4px 12px",
            borderBottom: `1px solid #ffffff12`
        },
        "& tr:last-child td": {
            borderBottom: "0px"
        },
        "& tbody": {
            backgroundColor: "#101010"
        }
    },
    // Responsive layout styles
    mainContainer: {
        display: "flex",
        [theme.breakpoints.down("sm")]: {
            flexDirection: "column"
        }
    },
    transactionListContainer: {
        padding: 16,
        width: "50%",
        [theme.breakpoints.down("sm")]: {
            width: "100%",
            padding: "16px 8px"
        }
    },
    transactionDetailContainer: {
        width: "50%",
        backgroundColor: "#171717",
        margin: "16px 24px 32px 24px",
        borderRadius: "21px",
        position: "relative",
        [theme.breakpoints.down("sm")]: {
            display: "none"
        }
    },
    bottomDrawer: {
        "& .MuiDrawer-paper": {
            backgroundColor: "#171717",
            borderRadius: "21px 21px 0 0",
            maxHeight: "80vh",
            overflow: "hidden",
            minWidth: "100%",
            zIndex: 9999999
        }
    },
    drawerHandle: {
        width: "40px",
        height: "4px",
        backgroundColor: "#555",
        borderRadius: "2px",
        margin: "12px auto 8px auto"
    },
    drawerHeader: {
        padding: "8px 16px 16px 16px",
    },
    drawerContent: {
        padding: "16px",
        overflowY: "auto",
        maxHeight: "calc(80vh - 80px)"
    },
    transactionJsonContainer: {
        backgroundColor: "#101010",
        margin: "0px 12px 12px 12px",
        padding: "21px",
        borderRadius: "21px"
    },
    transactionJson: {
        wordBreak: "break-all",
        whiteSpace: "pre-wrap"
    },

    // ── Block count badge ─────────────────────────────────────────────────
    blockStripHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "4px 16px 0 16px",
    },
    blockCountLabel: {
        fontSize: "11px",
        color: "#666",
        letterSpacing: "0.5px",
        textTransform: "uppercase",
    },
    headBlockLabel: {
        fontSize: "11px",
        color: "#ffffff",
        fontWeight: 600,
        letterSpacing: "0.3px",
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        cursor: "pointer",
        padding: "4px 10px",
        borderRadius: "12px",
        border: "1px solid #ffffff1f",
        backgroundColor: "#ffffff0a",
        transition: "background-color 150ms ease, border-color 150ms ease",
        "&:hover": {
            backgroundColor: "#ffffff1a",
            borderColor: "#ffffff33",
        },
    },
    liveDot: {
        width: "6px",
        height: "6px",
        borderRadius: "50%",
        backgroundColor: "#ffffff",
        display: "inline-block",
        animation: "$pulse 2s ease-in-out infinite",
    },
    "@keyframes pulse": {
        "0%, 100%": { opacity: 1 },
        "50%": { opacity: 0.3 },
    },

    // ── Filled (grey, no underline) text fields ───────────────────────────
    filledInput: {
        backgroundColor: "#262626",
        borderRadius: "12px",
        paddingLeft: "12px",
        paddingRight: "4px",
        transition: "background-color 150ms ease, box-shadow 150ms ease",
        "&:hover": {
            backgroundColor: "#2e2e2e",
        },
        "&.Mui-focused": {
            backgroundColor: "#2e2e2e",
            boxShadow: "0 0 0 2px #ffffff1f",
        },
        // The "#" prefix and any text sit on a light-grey field.
        "& .MuiInputAdornment-positionStart": {
            color: "#777",
        },
    },
    filledInputInner: {
        padding: "11px 8px 11px 0",
        color: "#fff",
        "&::placeholder": {
            color: "#777",
            opacity: 1,
        },
    },
    inputFetchButton: {
        color: "#bdbdbd",
        padding: "6px",
        "&:hover": {
            color: "#fff",
            backgroundColor: "#ffffff14",
        },
    },

    // ── Virtual-operation notice ──────────────────────────────────────────
    virtualNotice: {
        display: "flex",
        alignItems: "flex-start",
        gap: "8px",
        margin: "0px 12px 16px 12px",
        padding: "12px",
        borderRadius: "21px",
        backgroundColor: "#101010",
        // A brighter grey stripe flags this as a callout without using colour.
        fontSize: "12px",
        lineHeight: "1.5",
        color: "#fff",
    },
    virtualNoticeIcon: {
        flex: "0 0 auto",
        fontSize: "24px",
        color: "#ffffff",
        // Inherits the notice's grey via currentColor — stays monochrome.
        marginTop: "2px",
    },
    virtualNoticeBlock: {
        color: "#fff",
        fontWeight: 600,
    },
});

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extract the primary actor from a blockchain operation.
 */
function getOperationUser(opTuple) {
    if (!opTuple || !Array.isArray(opTuple) || opTuple.length < 2) return "unknown";
    const [type, data] = opTuple;
    if (!data) return "unknown";

    switch (type) {
        case "vote":                     return data.voter;
        case "effective_comment_vote":   return data.voter;
        case "comment":                  return data.author;
        case "comment_reward":           return data.author;
        case "comment_payout_update":    return data.author;
        case "comment_benefactor_reward":return data.benefactor;
        case "author_reward":            return data.author;
        case "curation_reward":          return data.curator;
        case "transfer":                 return data.from;
        case "transfer_to_vesting":      return data.from;
        case "withdraw_vesting":         return data.account;
        case "fill_vesting_withdraw":    return data.from_account;
        case "delegate_vesting_shares":  return data.delegator;
        case "return_vesting_delegation":return data.account;
        case "claim_reward_balance":     return data.account;
        case "account_create":           return data.creator;
        case "account_create_with_delegation": return data.creator;
        case "create_claimed_account":   return data.creator;
        case "account_update":           return data.account;
        case "account_update2":          return data.account;
        case "witness_update":           return data.owner;
        case "feed_publish":             return data.publisher;
        case "account_witness_vote":     return data.account;
        case "account_witness_proxy":    return data.account;
        case "limit_order_create":       return data.owner;
        case "limit_order_cancel":       return data.owner;
        case "fill_order":               return data.current_owner;
        case "convert":                  return data.owner;
        case "collateralized_convert":   return data.owner;
        case "custom_json":
            return (data.required_posting_auths && data.required_posting_auths[0])
                || (data.required_auths && data.required_auths[0])
                || "system";
        case "custom":
            return (data.required_auths && data.required_auths[0]) || "system";
        case "producer_reward":          return data.producer;
        case "pow":                      return data.worker_account;
        case "pow2":                     return data.work && data.work[1] && data.work[1].input
            ? data.work[1].input.worker_account : "unknown";
        default:
            return data.account || data.from || data.voter || data.author
                || data.creator || data.curator || data.owner || "unknown";
    }
}

/** Estimate block payload size */
function estimateBlockSize(block) {
    if (!block) return "0kB";
    try { return (JSON.stringify(block).length / 1024).toFixed(1) + "kB"; }
    catch { return "?kB"; }
}

/**
 * Per-block derived card data, cached by block object identity. The strip
 * renders up to 41 cards, and the dialog re-renders on every keystroke of the
 * block/transaction inputs and on every streamed head block — without this
 * cache each of those renders re-stringified EVERY block for its size label
 * (41 full-block JSON.stringify calls) and re-ran a locale date format per
 * card. Blocks are immutable once fetched, so object identity is a safe key;
 * the locale string is kept per entry so a language switch recomputes it.
 */
const BLOCK_CARD_CACHE = new WeakMap();
function getBlockCardData(block) {
    let entry = BLOCK_CARD_CACHE.get(block);
    if (!entry) {
        entry = {
            size: estimateBlockSize(block),
            timestamp: new Date(block.timestamp + "Z"),
            locale: null,
            dateLabel: "",
        };
        BLOCK_CARD_CACHE.set(block, entry);
    }
    const locale = getLocaleCode();
    if (entry.locale !== locale) {
        entry.locale = locale;
        entry.dateLabel = entry.timestamp.toLocaleDateString(locale, {
            weekday: "long", year: "numeric", month: "long",
            day: "numeric", hour: "numeric", minute: "numeric", second: "numeric",
        });
    }
    return entry;
}

// Hoisted static styles — were inline literals re-created per render.
const INPUT_FORM_STYLE = { margin: 16, width: "calc(100% - 32px)" };
const GAP_LABEL_STYLE = { fontSize: "11px", color: "#ffffff44", textAlign: "center" };
const LOADING_STRIP_STYLE = { padding: "24px", textAlign: "center", width: "100%", color: "#666" };
const VOPS_HEADER_STYLE = { marginTop: 16 };
const DRAWER_JSON_STYLE = { margin: 0 };
const DRAWER_NOTICE_STYLE = { margin: "0 0 4px 0" };
const OP_TYPE_STYLE = { color: "#eee" };
const WITNESS_DARK_STYLE = { color: "#111" };
const WITNESS_LIGHT_STYLE = { color: "#fff" };

// ── Component ──────────────────────────────────────────────────────────────

/**
 * The operation list can be hundreds of items on a busy block. Its output
 * depends only on the operations array and the styles, so we memoize it — a
 * full forceUpdate (e.g. the 3s head poll, or a block streaming in) won't
 * re-render these rows unless the operations array reference actually changes
 * (i.e. a new block's ops loaded).
 */
const OperationList = React.memo(function OperationList({ operations, classes, renderItem }) {
    useLanguage();
    return <React.Fragment>{(operations || []).map(op => renderItem(op, classes))}</React.Fragment>;
});

class BlockViewer extends React.PureComponent {

    constructor(props) {
        super(props);
        this.state = {
            classes: props.classes,
            open: props.open,
            block: props.block || 0,

            // Selected transaction / operation for detail panel
            transaction: 0,
            data: {},

            // Notice shown when the requested transaction resolves to a virtual
            // operation (which is not globally unique across blocks).
            virtualNotice: "",

            // Real data from API
            blockData: null,
            transactions: [],
            virtualOperations: [],
            neighborBlocks: [],  // Sorted ascending by block_number

            // Head block tracking for real-time updates
            headBlockNum: 0,

            loading: false,
            drawerOpen: false,
        };

        // ── Filmstrip positioning state ──────────────────────────────────
        this._viewportRef = null;   // the clipping window (measures visible width)
        this._stripRef = null;      // the translated inner strip
        this._tx = 0;               // current/target translateX target
        this._txTransition = "none";
        this._resizeObs = null;
        // Pointer-drag state for manual scrolling.
        this._pointerActive = false;
        this._dragMoved = false;
        this._dragStartX = 0;
        this._dragStartTx = 0;
        this._pollTimer = null;
        this._blockInputTimeout = null;
        this._transactionInputTimeout = null;
        // True while a slide-to-block sequence is mid-flight, so the live-poll
        // compensation doesn't fight the slide's own scroll animation.
        this._sliding = false;
        // Track which block numbers were recently added for animation
        this._newBlockNums = new Set();
    }

    shouldComponentUpdate(nextProps, nextState, nextContext) {
        return false;
    }

    componentWillReceiveProps(nextProps) {
        const stateUpdate = {};
        let needsLoad = false;

        if (nextProps.open !== undefined) {
            stateUpdate.open = nextProps.open;
        }
        if (nextProps.classes !== undefined) {
            stateUpdate.classes = nextProps.classes;
        }

        const isOpening = nextProps.open && !this.state.open;
        const isClosing = !nextProps.open && this.state.open;

        if (isOpening && nextProps.block !== undefined && nextProps.block > 0) {
            stateUpdate.block = nextProps.block;
            stateUpdate.transaction = 0;
            stateUpdate.data = {};
            stateUpdate.virtualNotice = "";
            stateUpdate.drawerOpen = false;
            stateUpdate.neighborBlocks = [];
            stateUpdate.transactions = [];
            stateUpdate.virtualOperations = [];
            stateUpdate.blockData = null;
            stateUpdate.headBlockNum = 0;
            this._newBlockNums.clear();
            needsLoad = true;
        }

        if (isClosing) {
            this._stopPolling();
        }

        this.setState(stateUpdate, () => {
            if (needsLoad) {
                this._loadBlock(this.state.block);
                this._startPolling();
            }
            this.forceUpdate();
        });
    }

    componentWillUnmount() {
        this._stopPolling();
        clearTimeout(this._blockInputTimeout);
        clearTimeout(this._transactionInputTimeout);
        if (this._wheelRaf) {
            cancelAnimationFrame(this._wheelRaf);
            this._wheelRaf = null;
        }
        if (this._resizeObs) {
            this._resizeObs.disconnect();
            this._resizeObs = null;
        }
    }

    // ── Real-time polling ─────────────────────────────────────────────────

    _startPolling = () => {
        this._stopPolling();
        this._pollForNewBlocks();
    }

    _stopPolling = () => {
        clearTimeout(this._pollTimer);
        this._pollTimer = null;
    }

    _pollForNewBlocks = async () => {
        const api = this.props.api;
        if (!api || !this.state.open) return;

        try {
            const globalProps = await api.globals.getDynamicGlobalProperties();
            if (!globalProps) return;

            const newHeadNum = globalProps.head_block_number;
            const oldHeadNum = this.state.headBlockNum;

            if (newHeadNum > oldHeadNum && oldHeadNum > 0) {
                // Defer while the user is mid-gesture (sliding or dragging): a full
                // re-render here would hitch the animation/drag. We don't advance
                // headBlockNum, so the next poll re-detects and handles it.
                if (this._sliding || this._pointerActive) return;

                // Fetch new blocks that appeared since last poll
                const { neighborBlocks, block: selectedBlock } = this.state;

                if (neighborBlocks.length > 0) {
                    const maxExisting = neighborBlocks[0].block_number;

                    // Only add blocks that are within range (selected + NEIGHBOR_COUNT)
                    const upperBound = selectedBlock + NEIGHBOR_COUNT;
                    const startFetch = Math.max(maxExisting + 1, oldHeadNum + 1);
                    const endFetch = Math.min(newHeadNum, upperBound);

                    if (endFetch >= startFetch) {
                        const nums = [];
                        for (let i = startFetch; i <= endFetch; i++) nums.push(i);

                        const results = await Promise.allSettled(
                            nums.map(n => api.blocks.getBlock(n))
                        );

                        const newBlocks = [];
                        results.forEach((r, i) => {
                            if (r.status === "fulfilled" && r.value) {
                                newBlocks.push({ ...r.value, block_number: nums[i] });
                                this._newBlockNums.add(nums[i]);
                            }
                        });

                        if (newBlocks.length > 0) {
                            // Clear animation class after animation completes
                            setTimeout(() => {
                                nums.forEach(n => this._newBlockNums.delete(n));
                            }, 500);

                            this.setState(prev => ({
                                neighborBlocks: [...prev.neighborBlocks, ...newBlocks]
                                    .sort((a, b) => b.block_number - a.block_number),
                                headBlockNum: newHeadNum,
                            }), () => {
                                // Keep the view exactly where it is. New blocks are
                                // newer, so they're inserted on the LEFT, shifting
                                // everything right by their combined width. We bake
                                // that shift into the transform BEFORE re-rendering,
                                // so the new cards and the compensating offset land
                                // in the same frame — zero visible movement, no
                                // animation.
                                const strip = this._stripRef;
                                const probe = strip && strip.querySelector("[data-block]");
                                let unit = BLOCK_WIDTH_DESKTOP;
                                if (probe) {
                                    const cs = window.getComputedStyle(probe);
                                    unit = probe.offsetWidth
                                        + (parseFloat(cs.marginLeft) || 0)
                                        + (parseFloat(cs.marginRight) || 0);
                                }
                                this._applyTx(this._currentTx() - unit * newBlocks.length, false);
                                this.forceUpdate();
                            });
                        } else {
                            this.setState({ headBlockNum: newHeadNum }, () => this.forceUpdate());
                        }
                    } else {
                        this.setState({ headBlockNum: newHeadNum });
                    }
                } else {
                    this.setState({ headBlockNum: newHeadNum });
                }
            } else if (oldHeadNum === 0) {
                this.setState({ headBlockNum: newHeadNum });
            }
        } catch (e) {
            console.warn("[BlockViewer] Poll error:", e);
        }

        // Schedule next poll (3 second interval)
        if (this.state.open) {
            this._pollTimer = setTimeout(this._pollForNewBlocks, 3000);
        }
    }

    // ── Data fetching ─────────────────────────────────────────────────────

    async _loadBlock(blockNum) {
        const api = this.props.api;
        if (!api || !blockNum || blockNum <= 0) return;

        this.setState({ loading: true }, () => this.forceUpdate());

        try {
            // Get head block number to know the ceiling
            const globalProps = await api.globals.getDynamicGlobalProperties();
            const headBlockNum = globalProps ? globalProps.head_block_number : blockNum + NEIGHBOR_COUNT;

            // Compute the range: up to NEIGHBOR_COUNT before, up to NEIGHBOR_COUNT after
            const lowerBound = Math.max(1, blockNum - NEIGHBOR_COUNT);
            const upperBound = Math.min(headBlockNum, blockNum + NEIGHBOR_COUNT);

            // Build list of block numbers to fetch (ascending)
            const neighborNums = [];
            for (let i = lowerBound; i <= upperBound; i++) {
                neighborNums.push(i);
            }

            // Fetch main block ops + all neighbor block headers in parallel
            const [allOps, ...neighborResults] = await Promise.allSettled([
                api.blocks.getOpsInBlock(blockNum, false),
                ...neighborNums.map(n => api.blocks.getBlock(n)),
            ]);

            // Separate regular vs. virtual operations
            const ops = allOps.status === "fulfilled" && Array.isArray(allOps.value) ? allOps.value : [];
            const transactions      = ops.filter(op => op.virtual_op === 0);
            const virtualOperations = ops.filter(op => op.virtual_op > 0);

            // Build neighbor blocks array (ascending order)
            const neighborBlocks = [];
            neighborResults.forEach((r, i) => {
                if (r.status === "fulfilled" && r.value) {
                    neighborBlocks.push({ ...r.value, block_number: neighborNums[i] });
                }
            });

            // Sort descending: newest (highest) block on the left
            neighborBlocks.sort((a, b) => b.block_number - a.block_number);

            const blockData = neighborBlocks.find(b => b.block_number === blockNum) || null;

            this._newBlockNums.clear();
            this._cardClickHandlers = null; // far jump: drop stale per-block handlers

            this.setState({
                blockData,
                transactions,
                virtualOperations,
                neighborBlocks,
                headBlockNum: headBlockNum,
                loading: false,
            }, () => {
                this.forceUpdate();
                // Center the selected block immediately (no animation on a fresh load).
                requestAnimationFrame(() => this._centerSelected(false));
            });
        } catch (e) {
            console.error("[BlockViewer] Failed to load block", blockNum, e);
            this.setState({ loading: false }, () => this.forceUpdate());
        }
    }

    // ── Operations for a single block (detail list) ───────────────────────

    /**
     * Fetch just the operations for one block and populate the detail list.
     * Used by the seamless slide path so we never re-fetch the whole strip.
     */
    async _loadBlockOps(blockNum) {
        const api = this.props.api;
        if (!api || !blockNum || blockNum <= 0) return;

        this.setState({ loading: true }, () => this.forceUpdate());

        try {
            const allOps = await api.blocks.getOpsInBlock(blockNum, false);
            const ops = Array.isArray(allOps) ? allOps : [];
            const transactions      = ops.filter(op => op.virtual_op === 0);
            const virtualOperations = ops.filter(op => op.virtual_op > 0);

            // Only apply if the user hasn't navigated away while we were loading.
            if (this.state.block !== blockNum) return;

            const blockData = this.state.neighborBlocks.find(b => b.block_number === blockNum)
                || this.state.blockData;

            this.setState({
                transactions,
                virtualOperations,
                blockData,
                loading: false,
            }, () => this.forceUpdate());
        } catch (e) {
            console.error("[BlockViewer] Failed to load block ops", blockNum, e);
            this.setState({ loading: false }, () => this.forceUpdate());
        }
    }

    // ── Transaction fetching from API ─────────────────────────────────────

    /** A virtual operation has a blank (all-zero) trx_id, so it is not unique. */
    _isVirtualTrxId = (id) => {
        if (!id) return true;
        const s = String(id).trim().toLowerCase();
        if (s === "virtual") return true;
        return /^0+$/.test(s);
    }

    /**
     * Resolve a virtual operation against the currently selected block. Virtual
     * ops share a blank transaction id and can appear in many blocks, so the
     * only meaningful scope is the selected block. We surface a notice and show
     * that block's virtual operations.
     */
    _showVirtualForSelectedBlock = () => {
        const { block, virtualOperations } = this.state;

        const vops = (virtualOperations || []).map(op => {
            const [type, payload] = op.op || [];
            return {
                type,
                block: op.block,
                op_in_trx: op.op_in_trx,
                virtual_op: op.virtual_op,
                timestamp: op.timestamp,
                ...(payload || {}),
            };
        });

        const data = vops.length === 1
            ? vops[0]
            : { block, virtual_operation_count: vops.length, virtual_operations: vops };

        this.setState({
            data,
            drawerOpen: true,
            virtualNotice: vops.length > 0
                ? t(
                "components.block_viewer.virtual_operations_arent_broadcast_as_transactions",
                {
                    operation: { operation: vops.length },
                    Number: Number(block).toLocaleString(getLocaleCode())
                }
            )
                : t("components.block_viewer.that_looks_like_a_virtual_operation_which", {
                Number: Number(block).toLocaleString(getLocaleCode())
            }),
        }, () => this.forceUpdate());
    }

    async _fetchTransaction(txId) {
        const api = this.props.api;
        if (!api || !txId) return;

        // Virtual ops can't be fetched globally — resolve within the selected block.
        if (this._isVirtualTrxId(txId)) {
            this._showVirtualForSelectedBlock();
            return;
        }

        try {
            const result = await api.blockchain.getTransaction(txId);
            if (this.state.transaction !== txId) return; // user moved on
            if (result) {
                this.setState({
                    data: result,
                    drawerOpen: true,
                    virtualNotice: "",
                }, () => this.forceUpdate());
            } else {
                this.setState({
                    virtualNotice: t("components.block_viewer.no_transaction_found_for_that_id_if"),
                }, () => this.forceUpdate());
            }
        } catch (e) {
            console.warn("[BlockViewer] Failed to fetch transaction:", txId, e);
            if (this.state.transaction !== txId) return;
            this.setState({
                virtualNotice: t("components.block_viewer.couldnt_fetch_that_transaction_if_its_a"),
            }, () => this.forceUpdate());
        }
    }

    // ── Filmstrip positioning ─────────────────────────────────────────────
    //
    // The strip is moved with translateX, not native scroll. A CSS transition on
    // the transform can be RETARGETED while it's running (it just re-interpolates
    // to the new value), so we can perform an instant, invisible window-swap in
    // the middle of a smooth recentre without the two fighting — which is exactly
    // what native scrollLeft could not do.

    /** Read the strip's actual on-screen translateX (its live, mid-transition value). */
    _currentTx = () => {
        const el = this._stripRef;
        if (!el) return this._tx;
        const t = window.getComputedStyle(el).transform;
        if (!t || t === "none") return this._tx;
        const m = t.match(/matrix3d\((.+)\)/) || t.match(/matrix\((.+)\)/);
        if (!m) return this._tx;
        const p = m[1].split(",").map(s => parseFloat(s));
        return t.indexOf("matrix3d") === 0 ? (p[12] || 0) : (p[4] || 0);
    };

    /** Apply a translateX to the strip, optionally animated. */
    _applyTx = (tx, smooth) => {
        this._tx = tx;
        this._txTransition = smooth ? TX_TRANSITION : "none";
        const el = this._stripRef;
        if (el) {
            el.style.transition = this._txTransition;
            el.style.transform = `translate3d(${tx}px, 0, 0)`;
        }
    };

    /** Clamp a translateX so the strip can't be dragged off into empty space. */
    _clampTx = (tx) => {
        const vp = this._viewportRef;
        const strip = this._stripRef;
        if (!vp || !strip) return tx;
        const vpW = vp.clientWidth;
        const stripW = strip.scrollWidth;
        if (stripW <= vpW) return Math.round((vpW - stripW) / 2); // centre if it fits
        return Math.min(0, Math.max(vpW - stripW, tx));
    };

    /** translateX that centers `blockNum` in the viewport. */
    _centerTxFor = (blockNum) => {
        const vp = this._viewportRef;
        const strip = this._stripRef;
        if (!vp || !strip || vp.clientWidth === 0) return this._tx;
        const el = strip.querySelector(`[data-block="${blockNum}"]`);
        if (!el) return this._tx;
        const cardCenter = el.offsetLeft + (el.offsetWidth / 2); // strip-local
        return Math.round((vp.clientWidth / 2) - cardCenter);
    };

    /** Center the currently-selected block (smooth by default). */
    _centerSelected = (smooth = true) => {
        this._applyTx(this._centerTxFor(this.state.block), smooth);
    };

    // ── Manual scrolling (wheel + pointer drag) ───────────────────────────

    _onStripWheel = (e) => {
        // Horizontal trackpad swipe, or shift+wheel. Plain vertical wheel is left
        // to scroll the page.
        const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY)
            ? e.deltaX
            : (e.shiftKey ? e.deltaY : 0);
        if (dx === 0) return;
        e.preventDefault();
        // Coalesce bursts of wheel events into one transform update per frame so
        // a fast trackpad doesn't trigger a layout read + write on every event.
        this._pendingWheelDx = (this._pendingWheelDx || 0) + dx;
        if (this._wheelRaf) return;
        this._wheelRaf = requestAnimationFrame(() => {
            this._wheelRaf = null;
            const d = this._pendingWheelDx || 0;
            this._pendingWheelDx = 0;
            this._applyTx(this._clampTx(this._tx - d), false);
        });
    };

    _onStripPointerDown = (e) => {
        if (e.button != null && e.button !== 0) return;
        // Record the start, but DON'T capture yet — capturing here would steal
        // the click from the card and break selection. We only start dragging
        // (and capture) once the pointer actually moves past a threshold.
        this._pointerActive = true;
        this._dragMoved = false;
        this._dragStartX = e.clientX;
        this._dragStartTx = this._currentTx();
        // Cache the scroll bounds ONCE here so pointermove does zero layout reads
        // (reading scrollWidth/clientWidth every move is what made dragging janky).
        const vp = this._viewportRef;
        const strip = this._stripRef;
        if (vp && strip) {
            const vpW = vp.clientWidth;
            const stripW = strip.scrollWidth;
            if (stripW <= vpW) {
                const c = Math.round((vpW - stripW) / 2);
                this._dragMin = c;
                this._dragMax = c;
            } else {
                this._dragMin = vpW - stripW;
                this._dragMax = 0;
            }
        } else {
            this._dragMin = -Infinity;
            this._dragMax = Infinity;
        }
    };

    _onStripPointerMove = (e) => {
        if (!this._pointerActive) return;
        const dx = e.clientX - this._dragStartX;
        if (!this._dragMoved) {
            if (Math.abs(dx) <= 4) return;      // still a click, not a drag
            // Drag begins now: capture so we keep getting moves even off-strip.
            this._dragMoved = true;
            const vp = this._viewportRef;
            if (vp && vp.setPointerCapture) {
                try { vp.setPointerCapture(e.pointerId); } catch (_) {}
            }
        }
        // Pure write — bounds were cached on pointerdown, so no layout is forced.
        let tx = this._dragStartTx + dx;
        if (tx < this._dragMin) tx = this._dragMin;
        else if (tx > this._dragMax) tx = this._dragMax;
        this._applyTx(tx, false);
    };

    _onStripPointerUp = (e) => {
        if (!this._pointerActive) return;
        this._pointerActive = false;
        if (this._dragMoved) {
            const vp = this._viewportRef;
            if (vp && vp.releasePointerCapture) {
                try { vp.releasePointerCapture(e.pointerId); } catch (_) {}
            }
            // Clear the flag only after the click event has fired, so the drag
            // doesn't also select. A plain click never set this, so it selects.
            setTimeout(() => { this._dragMoved = false; }, 0);
        }
    };

    // ── Seamless block selection ──────────────────────────────────────────

    /**
     * Entry point for every block selection (card click, Head pill, or the
     * block input). Slides the strip in place when the target is already loaded,
     * and only does a full reload for far jumps that have no overlap.
     */
    _selectBlock = (blockNum) => {
        if (!blockNum || blockNum <= 0) return;

        const inStrip = this.state.neighborBlocks.some(b => b.block_number === blockNum);

        if (blockNum === this.state.block && inStrip) {
            // Already selected — just re-center.
            requestAnimationFrame(() => this._centerSelected(true));
            return;
        }

        if (inStrip) {
            this._slideToBlock(blockNum);
        } else {
            // Far jump: nothing to reuse, so reload the strip around the target.
            this.setState({
                block: blockNum,
                transaction: 0,
                data: {},
                virtualNotice: "",
                drawerOpen: false,
                transactions: [],
                virtualOperations: [],
                blockData: null,
            }, () => {
                this.forceUpdate();
                this._loadBlock(blockNum);
            });
        }
    }

    /**
     * Center `blockNum` (already loaded in the strip) with a SINGLE smooth glide.
     *
     * We fetch any neighbours newly entering the ±range, then apply the selection
     * and window swap in one step. To make that swap invisible, the clicked card
     * is first pinned (instantly, no transition) to the exact on-screen position
     * it was clicked at; then it glides smoothly to the center. One animation, no
     * jump, no two transitions fighting.
     */
    _slideToBlock = async (blockNum) => {
        const api = this.props.api;
        const token = (this._slideToken || 0) + 1;
        this._slideToken = token;
        this._sliding = true;

        const sel = `[data-block="${blockNum}"]`;

        // 1. Set the selection NOW — so the ops fetch loads for the right block
        //    (it guards on this.state.block) and the card highlights immediately.
        //    The strip does not move yet.
        this.setState({
            block: blockNum,
            transaction: 0,
            data: {},
            virtualNotice: "",
            drawerOpen: false,
        }, () => this.forceUpdate());

        this._loadBlockOps(blockNum);

        // 2. Work out the new ±window and fetch only what's missing.
        let merged = this.state.neighborBlocks;
        if (api) {
            const head = this.state.headBlockNum > 0
                ? this.state.headBlockNum
                : blockNum + NEIGHBOR_COUNT;
            const lower = Math.max(1, blockNum - NEIGHBOR_COUNT);
            const upper = Math.min(head, blockNum + NEIGHBOR_COUNT);

            const existing = this.state.neighborBlocks;
            const have = new Set(existing.map(b => b.block_number));
            const missing = [];
            for (let n = lower; n <= upper; n++) if (!have.has(n)) missing.push(n);

            let fetched = [];
            if (missing.length > 0) {
                try {
                    const results = await Promise.allSettled(missing.map(n => api.blocks.getBlock(n)));
                    results.forEach((r, i) => {
                        if (r.status === "fulfilled" && r.value) {
                            fetched.push({ ...r.value, block_number: missing[i] });
                        }
                    });
                } catch (e) {
                    console.warn("[BlockViewer] Failed to fetch window blocks:", e);
                }
            }

            merged = existing
                .concat(fetched)
                .filter(b => b.block_number >= lower && b.block_number <= upper)
                .sort((a, b) => b.block_number - a.block_number);
        }

        // A newer click superseded this one while we were fetching.
        if (this._slideToken !== token) return;

        // 3. Swap the window, pin the clicked card, then glide it to center.
        this.setState({ neighborBlocks: merged }, () => {
            // Measure the clicked card's CURRENT on-screen center, while the old
            // window is still showing (sCU is false, so nothing re-rendered yet).
            const stripPre = this._stripRef;
            const preEl = stripPre ? stripPre.querySelector(sel) : null;
            const preScreenCenter = preEl
                ? preEl.offsetLeft + preEl.offsetWidth / 2 + this._currentTx()
                : null;

            this.forceUpdate(); // swap to the new window

            const strip = this._stripRef;
            const el = strip ? strip.querySelector(sel) : null;
            if (el && preScreenCenter != null) {
                // Pin instantly (no transition): keep the clicked card exactly
                // where it was, so the window swap is invisible.
                const cardCenter = el.offsetLeft + el.offsetWidth / 2;
                this._applyTx(preScreenCenter - cardCenter, false);
                // eslint-disable-next-line no-unused-expressions
                strip.offsetHeight; // commit that frame as the animation's start
            }
            // One smooth glide to the centered position.
            this._centerSelected(true);
            // Keep _sliding set until the glide finishes, so a streaming block
            // arriving mid-glide doesn't interrupt the animation.
            setTimeout(() => { if (this._slideToken === token) this._sliding = false; }, 420);
        });
    }

    // ── Input handlers ────────────────────────────────────────────────────

    _handleBlockChange = (event) => {
        const val = event?.target?.value;
        const blockNum = parseInt(val, 10);

        this.setState({ block: blockNum || 0 }, () => this.forceUpdate());

        // Debounce: load after the user stops typing.
        clearTimeout(this._blockInputTimeout);
        this._blockInputTimeout = setTimeout(() => this._commitBlock(), 500);
    }

    _handleBlockKeyDown = (event) => {
        if (event.key === "Enter") this._commitBlock();
    }

    /** Fetch the block currently in the input (Enter, the button, or debounce). */
    _commitBlock = () => {
        clearTimeout(this._blockInputTimeout);
        const blockNum = parseInt(this.state.block, 10);
        if (blockNum > 0) this._selectBlock(blockNum);
    }

    _handleTransactionInput = (event) => {
        const value = event?.target?.value || "";

        this.setState({ transaction: value }, () => this.forceUpdate());

        // Debounce a manual lookup.
        clearTimeout(this._transactionInputTimeout);
        this._transactionInputTimeout = setTimeout(() => this._commitTransaction(), 500);
    }

    _handleTransactionKeyDown = (event) => {
        if (event.key === "Enter") this._commitTransaction();
    }

    /** Look up the transaction currently in the input (Enter, button, or debounce). */
    _commitTransaction = () => {
        clearTimeout(this._transactionInputTimeout);
        const txId = this.state.transaction;
        if (!txId || typeof txId !== "string") return;

        if (this._isVirtualTrxId(txId)) {
            this._showVirtualForSelectedBlock();
            return;
        }
        if (txId.length >= 8) this._fetchTransaction(txId);
    }

    /** Selecting an operation from the list (we already hold its data). */
    _selectOperation = (trxId, operationData) => {
        const isVirtual = (operationData && operationData.virtual_op > 0)
            || this._isVirtualTrxId(trxId);

        this.setState({
            transaction: trxId,
            data: operationData || this.state.data,
            drawerOpen: true,
            virtualNotice: isVirtual
                ? t("components.block_viewer.this_is_a_virtual_operation_from_block", {
                Number: Number(this.state.block).toLocaleString(getLocaleCode())
            })
                : "",
        }, () => this.forceUpdate());
    }

    _handleDrawerClose = () => {
        this.setState({ drawerOpen: false }, () => this.forceUpdate());
    }

    _handleDrawerOpen = () => {
        this.setState({ drawerOpen: true }, () => this.forceUpdate());
    }

    _clearTransaction = () => {
        this.setState({ transaction: 0, data: {}, virtualNotice: "", drawerOpen: false }, () => this.forceUpdate());
    }

    /**
     * Detail JSON, stringified once per `data` object. The same text was
     * previously produced TWICE per render (desktop panel + keepMounted mobile
     * drawer), on every re-render of the dialog — for a busy block that's the
     * heaviest single item in the render.
     */
    _detailJson = (data) => {
        if (this._jsonCacheData !== data) {
            this._jsonCacheData = data;
            try { this._jsonCacheText = JSON.stringify(data, null, 2); }
            catch { this._jsonCacheText = ""; }
        }
        return this._jsonCacheText;
    };

    // ── Render helpers ────────────────────────────────────────────────────

    /** Cached per-block click handlers — were fresh closures per card per render. */
    _cardClickHandler = (blockNum) => {
        const cache = this._cardClickHandlers || (this._cardClickHandlers = {});
        return cache[blockNum] || (cache[blockNum] = () => {
            if (!this._dragMoved) this._selectBlock(blockNum);
        });
    };

    _renderBlockCard = (block, classes) => {
        const blockNum    = block.block_number;
        const witness     = block.witness || "unknown";
        const txCount     = block.transactions ? block.transactions.length : 0;
        const { size, timestamp, dateLabel } = getBlockCardData(block);
        const isSelected  = blockNum === this.state.block;
        const isNew       = this._newBlockNums.has(blockNum);

        let containerClass;
        if (isSelected) {
            containerClass = classes.boxBlockSelected;
        } else if (isNew) {
            containerClass = classes.boxBlockNew;
        } else {
            containerClass = classes.boxBlock;
        }

        const primaryClass   = isSelected ? classes.selectedBlockPrimary : classes.boxPrimary;
        const secondaryClass = isSelected ? classes.selectedBlockSecondary : classes.boxSecondary;
        const witnessStyle   = isSelected ? WITNESS_DARK_STYLE : WITNESS_LIGHT_STYLE;

        return (
            <div
                className={containerClass}
                key={blockNum}
                data-block={blockNum}
                onClick={this._cardClickHandler(blockNum)}
            >
                <span className={primaryClass}>
                    {`#${blockNum.toLocaleString(getLocaleCode())}`}
                </span>
                <span className={secondaryClass}>
                    <span style={witnessStyle}>@{witness}</span>
                    <br />
                    <span>{size}</span>
                    <span> · </span>
                    <Tooltip arrow title={dateLabel}>
                        <span>{timeAgo.format(timestamp)}</span>
                    </Tooltip>
                    <br />
                    <span>{t("components.block_viewer.tx", { transaction: { transaction: txCount } })}</span>
                </span>
            </div>
        );
    }

    _goToHead = () => {
        if (this.state.headBlockNum > 0) this._selectBlock(this.state.headBlockNum);
    };

    _onHeadPillKeyDown = (e) => {
        if (e.key === "Enter" || e.key === " ") this._goToHead();
    };

    _renderGapBlock = (classes) => {
        return (
            <div className={classes.boxBlockGap} key="gap-latest">
                <span style={GAP_LABEL_STYLE}>
                    {t("words.next_block")}
                </span>
            </div>
        );
    }

    _renderOperationItem = (op, classes) => {
        if (!op || !op.op) return null;

        const [opType, opData] = op.op;
        const user  = getOperationUser(op.op);
        const isVirtual = op.virtual_op > 0 || this._isVirtualTrxId(op.trx_id);
        const trxId = isVirtual ? "virtual" : op.trx_id.substring(0, 8);

        const detailData = {
            trx_id: op.trx_id,
            block: op.block,
            timestamp: op.timestamp,
            type: opType,
            virtual_op: op.virtual_op,
            ...opData,
        };

        return (
            <ListItem
                onClick={() => this._selectOperation(trxId, detailData)}
                key={`${op.trx_id}-${op.op_in_trx}-${op.virtual_op}`}
                className={classes.listItem}
            >
                <ListItemAvatar>
                    <Avatar>
                        <CodeIcon />
                    </Avatar>
                </ListItemAvatar>
                <ListItemText
                    primary={<span className={"monospace"}>{trxId}</span>}
                    secondary={
                        <span>
                            <span style={OP_TYPE_STYLE}>{opType}</span>
                            <span> by </span>
                            <span style={OP_TYPE_STYLE}>@{user}</span>
                        </span>
                    }
                />
            </ListItem>
        );
    }

    renderTransactionDetail = (classes, transaction, data) => {
        const { virtualNotice } = this.state;
        return (
            <React.Fragment>
                <FormControl fullWidth style={INPUT_FORM_STYLE}>
                    <Input
                        id="trx-input"
                        disableUnderline
                        classes={{ root: classes.filledInput, input: classes.filledInputInner }}
                        placeholder={t("components.block_viewer.transaction_id")}
                        value={transaction || ""}
                        onChange={this._handleTransactionInput}
                        onKeyDown={this._handleTransactionKeyDown}
                        startAdornment={<InputAdornment position="start">#</InputAdornment>}
                        endAdornment={
                            <InputAdornment position="end">
                                <IconButton
                                    className={classes.inputFetchButton}
                                    onClick={this._commitTransaction}
                                    aria-label={t("components.block_viewer.look_up_transaction")}
                                    size="small"
                                >
                                    <SearchIcon fontSize="small" />
                                </IconButton>
                            </InputAdornment>
                        }
                    />
                </FormControl>
                <div className={classes.transactionJsonContainer}>
                    <div className={classes.transactionJson}>
                        {this._detailJson(data)}
                    </div>
                </div>
                {virtualNotice && (
                    <div className={classes.virtualNotice}>
                        <InfoOutlinedIcon className={classes.virtualNoticeIcon} />
                        <span>{virtualNotice}</span>
                    </div>
                )}
            </React.Fragment>
        );
    }

    // ── Render ────────────────────────────────────────────────────────────

    render() {
        const {
            classes,
            open,
            block,
            transaction,
            data,
            transactions,
            virtualOperations,
            neighborBlocks,
            headBlockNum,
            loading,
            drawerOpen,
        } = this.state;

        const { isMobile } = this.props;

        // Determine if the latest block in our strip is the head block
        const highestInStrip = neighborBlocks.length > 0
            ? neighborBlocks[0].block_number
            : 0;
        const isAtHead = headBlockNum > 0 && highestInStrip >= headBlockNum;

        return (
            <React.Fragment>
                <Dialog
                    className={classes.dialog}
                    open={open}
                    maxWidth={"md"}
                    fullWidth={true}
                    disablePortal={false}
                    onClose={this.props.onClose}
                    keepMounted={false}
                >
                    {/* Block number input */}
                    <FormControl fullWidth style={INPUT_FORM_STYLE}>
                        <Input
                            id="block-input"
                            disableUnderline
                            classes={{ root: classes.filledInput, input: classes.filledInputInner }}
                            placeholder={t("components.block_viewer.block_number")}
                            value={block || ""}
                            onChange={this._handleBlockChange}
                            onKeyDown={this._handleBlockKeyDown}
                            startAdornment={<InputAdornment position="start">#</InputAdornment>}
                            endAdornment={
                                <InputAdornment position="end">
                                    <IconButton
                                        className={classes.inputFetchButton}
                                        onClick={this._commitBlock}
                                        aria-label={t("components.block_viewer.go_to_block")}
                                        size="small"
                                    >
                                        <SearchIcon fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            }
                        />
                    </FormControl>

                    {/* Block strip header */}
                    <div className={classes.blockStripHeader}>
                        <span className={classes.blockCountLabel}>
                            {neighborBlocks.length} block{neighborBlocks.length !== 1 ? "s" : ""}
                        </span>
                        {headBlockNum > 0 && (
                            <span
                                className={classes.headBlockLabel}
                                role="button"
                                tabIndex={0}
                                title="Jump to the latest block"
                                onClick={this._goToHead}
                                onKeyDown={this._onHeadPillKeyDown}
                            ><T
                                    k="components.block_viewer.0_0_head"
                                    vars={{
                                        headBlockNum: headBlockNum.toLocaleString(getLocaleCode())
                                    }}
                                    slots={[<span className={classes.liveDot} key="0" />]} /></span>
                        )}
                    </div>

                    {/* Block strip: a translateX filmstrip inside a clipping viewport */}
                    <div
                        className={classes.blockStripOuter}
                        ref={el => {
                            this._viewportRef = el;
                            if (el && !this._resizeObs && typeof ResizeObserver !== "undefined") {
                                this._resizeObs = new ResizeObserver(() => {
                                    // Keep the selection centered as the viewport resizes.
                                    if (this.state.open && !this._pointerActive) this._centerSelected(false);
                                });
                                this._resizeObs.observe(el);
                            }
                        }}
                        onWheel={this._onStripWheel}
                        onPointerDown={this._onStripPointerDown}
                        onPointerMove={this._onStripPointerMove}
                        onPointerUp={this._onStripPointerUp}
                        onPointerCancel={this._onStripPointerUp}
                    >
                        <div
                            className={classes.blockStripScroll}
                            ref={el => { this._stripRef = el; }}
                            style={{
                                transform: `translate3d(${this._tx}px, 0, 0)`,
                                transition: this._txTransition,
                            }}
                        >
                            {neighborBlocks.length > 0
                                ? (
                                    <React.Fragment>
                                        {/* Gap block on the left if at chain head */}
                                        {isAtHead && this._renderGapBlock(classes)}
                                        {neighborBlocks.map(b => this._renderBlockCard(b, classes))}
                                    </React.Fragment>
                                )
                                : loading && (
                                <div style={LOADING_STRIP_STYLE}>
                                    {t("components.block_viewer.loading_blocks")}
                                </div>
                            )
                            }
                        </div>
                    </div>

                    {/* Main split view: transaction list + detail */}
                    <div className={classes.mainContainer}>
                        <div className={classes.transactionListContainer}>
                            {loading && <LinearProgress />}
                            <List>
                                {/* Regular transactions */}
                                <ListSubheader className={classes.listItemHeader}>
                                    <ListItem>
                                        <ListItemText primary={`Transactions (${transactions.length})`} />
                                    </ListItem>
                                </ListSubheader>
                                {transactions.length === 0 && !loading && (
                                    <ListItem>
                                        <ListItemText secondary={t("components.block_viewer.no_transactions_in_this_block")} />
                                    </ListItem>
                                )}
                                <OperationList operations={transactions} classes={classes} renderItem={this._renderOperationItem} />

                                {/* Virtual operations */}
                                <ListSubheader className={classes.listItemHeader} style={VOPS_HEADER_STYLE}>
                                    <ListItem>
                                        <ListItemText primary={t("components.block_viewer.virtual_operations", {
                                            virtualOperation_count: virtualOperations.length
                                        })} />
                                    </ListItem>
                                </ListSubheader>
                                {virtualOperations.length === 0 && !loading && (
                                    <ListItem>
                                        <ListItemText secondary={t("components.block_viewer.no_virtual_operations_in_this_block")} />
                                    </ListItem>
                                )}
                                <OperationList operations={virtualOperations} classes={classes} renderItem={this._renderOperationItem} />
                            </List>
                        </div>

                        {/* Desktop transaction detail view */}
                        <div className={classes.transactionDetailContainer}>
                            {this.renderTransactionDetail(classes, transaction, data)}
                        </div>
                    </div>

                    {/* Mobile bottom drawer for transaction detail */}
                    <SwipeableDrawer
                        anchor="bottom"
                        open={isMobile && drawerOpen}
                        onClose={this._handleDrawerClose}
                        onOpen={this._handleDrawerOpen}
                        disableSwipeToOpen={true}
                        disablePortal={false}
                        className={classes.bottomDrawer}
                        keepMounted={true}
                    >
                        <div className={classes.drawerHandle} />
                        <div className={classes.drawerHeader}>
                            <FormControl fullWidth>
                                <Input
                                    id="trx-input-mobile"
                                    disableUnderline
                                    classes={{ root: classes.filledInput, input: classes.filledInputInner }}
                                    placeholder={t("components.block_viewer.transaction_id")}
                                    value={transaction || ""}
                                    onChange={this._handleTransactionInput}
                                    onKeyDown={this._handleTransactionKeyDown}
                                    startAdornment={<InputAdornment position="start">#</InputAdornment>}
                                    endAdornment={
                                        <InputAdornment position="end">
                                            <IconButton
                                                className={classes.inputFetchButton}
                                                onClick={this._commitTransaction}
                                                aria-label={t("components.block_viewer.look_up_transaction")}
                                                size="small"
                                            >
                                                <SearchIcon fontSize="small" />
                                            </IconButton>
                                        </InputAdornment>
                                    }
                                />
                            </FormControl>
                        </div>
                        <div className={classes.drawerContent}>
                            <div className={classes.transactionJsonContainer} style={DRAWER_JSON_STYLE}>
                                <div className={classes.transactionJson}>
                                    {this._detailJson(data)}
                                </div>
                            </div>
                            {this.state.virtualNotice && (
                                <div className={classes.virtualNotice} style={DRAWER_NOTICE_STYLE}>
                                    <InfoOutlinedIcon className={classes.virtualNoticeIcon} />
                                    <span>{this.state.virtualNotice}</span>
                                </div>
                            )}
                        </div>
                    </SwipeableDrawer>
                </Dialog>
            </React.Fragment>
        );
    }
}

// Wrapper component to inject isMobile prop using hooks
const BlockViewerWithMediaQuery = (props) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    return <BlockViewer {...props} isMobile={isMobile} />;
};

export default withLanguage(withStyles(styles)(BlockViewerWithMediaQuery));