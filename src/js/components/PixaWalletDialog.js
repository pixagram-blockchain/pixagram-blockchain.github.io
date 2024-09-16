import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import Card from '@material-ui/core/Card';
import Backdrop from '@material-ui/core/Backdrop';
import Tab from "@material-ui/core/Tab";
import Tabs from "@material-ui/core/Tabs";
import PixaSupra from "../icons/PixaSupra";
import PixaPower from "../icons/PixaPower";
import PixaLiquid from "../icons/PixaLiquid";
import { utils } from "@pixagram/dpixa";

import Portal from '@material-ui/core/Portal';
import {HISTORY} from "../utils/constants";
import { get_cached_settings, subscribe as subscribe_settings } from "../utils/settings";
import DialogTitle from "@material-ui/core/DialogTitle";
import InfoOutlined from "@material-ui/icons/InfoOutlined";
import Typography from "@material-ui/core/Typography";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import IconButton from "@material-ui/core/IconButton";
import ListSubheader from "@material-ui/core/ListSubheader";
import Button from "@material-ui/core/Button";
import Tooltip from "@material-ui/core/Tooltip";
import ListItem from "@material-ui/core/ListItem";
import ListItemAvatar from "@material-ui/core/ListItemAvatar";
import ListItemText from "@material-ui/core/ListItemText";
import List from "@material-ui/core/List";
import Avatar from "@material-ui/core/Avatar";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import CloseIcon from "@material-ui/icons/Close";
import CallMadeRounded from "@material-ui/icons/CallMadeRounded";
import CallReceivedRounded from "@material-ui/icons/CallReceivedRounded";
import HistoryRounded from "@material-ui/icons/HistoryRounded";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import HandCoin from "../icons/HandCoin";
import Transfer from "../icons/Transfer";
import LightningBoltCIrcle from "../icons/LightningBoltCIrcle";
import CashFast from "../icons/CashFast";
import BankTransferOut from "../icons/BankTransferOut";
import FormControl from "@material-ui/core/FormControl";
import FormGroup from "@material-ui/core/FormGroup";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Checkbox from "@material-ui/core/Checkbox";
import Switch from "@material-ui/core/Switch";
import ShieldKey from "../icons/shieldKey";
import PersonAddRounded from "@material-ui/icons/PersonAddRounded";
import SwipeableViews from 'react-swipeable-views';
import SyncAltRounded from "@material-ui/icons/SyncAltRounded";
import * as actions from "../actions/utils";
import timeAgo from '../utils/TimeAgo';

import {ResponsiveContainer} from 'recharts/lib/component/ResponsiveContainer';
import {LineChart} from 'recharts/lib/chart/LineChart';
import {Line} from 'recharts/lib/cartesian/Line';
import {XAxis} from 'recharts/lib/cartesian/XAxis';
import {YAxis} from 'recharts/lib/cartesian/YAxis';
import {Tooltip as TooltipChart} from 'recharts/lib/component/Tooltip';
import {CartesianGrid} from 'recharts/lib/cartesian/CartesianGrid';

import ButtonGroup from "@material-ui/core/ButtonGroup";
import { lazyDialog, preloadOnIdle } from "./LazyDialog";

// Code-split sub-dialogs: each ships as its own chunk and is fetched only
// when first opened. Render sites are unchanged — lazyDialog gates on `open`
// and passes every prop straight through.
const PixaWalletPowerDialog     = lazyDialog(() => import("../components/PixaWalletPowerDialog"),     { name: "WalletPower" });
const PixaWalletKeysDialog      = lazyDialog(() => import("../components/PixaWalletKeysDialog"),      { name: "WalletKeys" });
const PixaWalletSwapDialog      = lazyDialog(() => import("../components/PixaWalletSwapDialog"),      { name: "WalletSwap" });
const PixaWalletSendDialog      = lazyDialog(() => import("../components/PixaWalletSendDialog"),      { name: "WalletSend" });
const PixaWalletDelegateDialog  = lazyDialog(() => import("../components/PixaWalletDelegateDialog"),  { name: "WalletDelegate" });
const PixaWalletSendPowerDialog = lazyDialog(() => import("../components/PixaWalletSendPowerDialog"), { name: "WalletSendPower" });
const PixaWalletSupraInfoDialog = lazyDialog(() => import("../components/PixaWalletSupraInfoDialog"), { name: "WalletSupraInfo" });
const PixaWalletPowerInfoDialog = lazyDialog(() => import("../components/PixaWalletPowerInfoDialog"), { name: "WalletPowerInfo" });
const PixaWalletPixaInfoDialog  = lazyDialog(() => import("../components/PixaWalletPixaInfoDialog"),  { name: "WalletPixaInfo" });
const PixaWalletSavingsDialog   = lazyDialog(() => import("../components/PixaWalletSavingsDialog"),   { name: "WalletSavings" });
const CreateBulkAccountDialog   = lazyDialog(() => import("../components/CreateBulkAccountDialog"),   { name: "WalletBulkCreate" });
const PixaWalletBulkPowerDialog = lazyDialog(() => import("../components/PixaWalletBulkPowerDialog"), { name: "WalletBulkPower" });
const PixaWalletTaxesDialog     = lazyDialog(() => import("../components/PixaWalletTaxesDialog"),     { name: "WalletTaxes" });

// ── First-open wallet tour ───────────────────────────────────────────────────
// Walks the user through the wallet's views (main, PXP, PXA, PXS, history)
// the first time the wallet opens. Shares the app-wide tour storage entry
// (same key Index.js uses) under the `wallet` flag, and the engine chunk is
// only fetched when the tour actually fires.
const LazyTour = React.lazy(() => import("./Tour"));

const TOUR_STORAGE_KEY = "pixagram_tour_v1";

function readTourState() {
    try {
        const raw = window.localStorage.getItem(TOUR_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

function writeTourState(patch) {
    try {
        window.localStorage.setItem(
            TOUR_STORAGE_KEY,
            JSON.stringify({ ...readTourState(), ...patch }),
        );
    } catch (e) {}
}

// This module only loads once the wallet itself is opened, so warming the two
// most-likely next actions on idle costs nothing for users who never open it.
preloadOnIdle(PixaWalletSendDialog, PixaWalletSwapDialog);
import Fade from "@material-ui/core/Fade";
import Collapse from "@material-ui/core/Collapse";
import HalfGaugeChart from "./HalfGaugeChart";
import CloseRounded from "@material-ui/icons/CloseRounded";
import ExpandMoreRounded from "@material-ui/icons/ExpandMoreRounded";
import DescriptionRounded from "@material-ui/icons/DescriptionRounded";
import WalletHistory from "./WalletHistory";
import { cssBackgroundImage } from "../utils/safeUrl";

import { T } from "../utils/T";
import { t } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";
const styles = theme => ({
    backdrop: {
        zIndex: theme.zIndex.drawer + 1,
        backdropFilter: "blur(5px)"
    },
    dialogCard: {
        userSelect: "none",
        height: "80%",
        maxWidth: "800px",
        width: "100%",
        margin: "auto",
        borderRadius: "32px",
        position: "relative",
        display: "flex",
        backgroundColor: "#0e0e0e !important",
        [theme.breakpoints.down("sm")]: {
            maxHeight: "100%",
            height: "100%",
            maxWidth: "100%",
            width: "100%",
            borderRadius: "0px",
        },
    },
    subTitle: {
        margin: "0px 0px 8px 0px",
        lineHeight: "48px",
        verticalAlign: "middle",
        display: "flow-root",
        position: "relative",
        [theme.breakpoints.down("sm")]: {
            margin: "24px 0px -12px 0px",
            "& > span:first-child": {
                fontSize: "2rem !important"
            },
            "& > span:last-child": {
                fontSize: "16px"
            },
            "& > span:last-child > span:last-child": {
                fontSize: "10px",
            },
            "& button": {
                marginLeft: "-8px !important",
                marginTop: -12
            }
        },
        "& > span:first-child": {
            float: "left",
            fontSize: "3rem",
            fontWeight: "600"
        },
        "& > span:last-child": {
            float: "right",
            flexDirection: "column",
            display: "flex",
            alignItems: "flex-end",
            fontWeight: "600",
            backgroundColor: "transparent",
            padding: "0px",
            borderRadius: "16px",
            color: "#666666",
            cursor: "pointer",
        },
        "& > span:last-child > span:last-child": {
            fontSize: "12px",
            lineHeight: "12px"
        },
        "& button": {
            color: "#666",
            marginLeft: "4px",
            verticalAlign: "top"
        }
    },
    // Clickable header for collapsible wallet sub-sections (Savings, Recurring
    // Transfers, Pending Swaps). Keeps the h6 text size of subTitle but lays out
    // as a flex row with a count summary on the left and a rotating chevron on
    // the right — deliberately avoiding subTitle's big-balance float rules.
    sectionHeader: {
        margin: "0px 0px 8px 0px",
        lineHeight: "48px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        cursor: "pointer",
        userSelect: "none",
        [theme.breakpoints.down("sm")]: {
            margin: "24px 0px 0px 0px",
        },
        "& .section-title": {
            display: "inline-flex",
            alignItems: "baseline",
            gap: "8px",
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
        },
        "& .section-count": {
            fontSize: "0.7em",
            color: "#666",
            fontWeight: 400,
            whiteSpace: "nowrap",
        },
        "& button": {
            color: "#666",
            margin: 0,
            padding: 6,
        },
        "& .section-chevron": {
            transition: "transform 0.2s ease",
        },
        "& .section-chevron.expanded": {
            transform: "rotate(180deg)",
        },
    },
    dialogContent: {
        "&.MuiDialogContent-root": {
            padding: "0"
        },
        "& .MuiButton-containedSizeLarge": {
            padding: "14px 22px",
            fontSize: "1.0666rem",
            borderRadius: "32px !important"
        },
        position: "relative",
        margin: "0px",
        paddingBottom: "16px",
        backgroundColor: "#040404",
        transition: "background-color 225ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
        "&:hover": {
            backgroundColor: "#020202",
            transition: "background-color 225ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
        },
        borderRadius: "24px 0px",
        height: "calc(100% - 124px)",
        "& > div, & > div > .react-swipeable-view-container > div > div": {
            position: "relative",
            height: "100%"
        },
        "& > div > .react-swipeable-view-container > div > div > .react-swipeable-view-container > div": {
            height: "100%",
            overflow: "overlay !important"
        },
        [theme.breakpoints.down("sm")]: {
            "& .MuiButton-containedSizeLarge": {
                padding: "10px 14px",
                fontSize: ".88rem",
                borderRadius: "21px !important"
            },
            borderRadius: "0px",
            height: "calc(100% - 154px)",
            marginTop: 8,
        }
    },
    mobileOuterSwipe: {
        width: "100%",
        height: "100%",
        // SwipeableViews y-axis root div
        "& > div": {
            height: "100%"
        },
        // .react-swipeable-view-container (y-axis flex column)
        "& > div > .react-swipeable-view-container": {
            height: "100%"
        },
        // Each y-axis slide: fill viewport
        "& > div > .react-swipeable-view-container > div": {
            height: "100%"
        },
    },
    mobileDetailWrapper: {
        height: "100%",
        overflow: "hidden",
        // Inner horizontal SwipeableViews root
        "& > div": {
            height: "100%"
        },
        // Inner .react-swipeable-view-container (horizontal flex row)
        "& > div > .react-swipeable-view-container": {
            height: "100%"
        },
        // Each horizontal slide: fixed height, scroll independently
        "& > div > .react-swipeable-view-container > div": {
            height: "100% !important",
            overflowY: "auto !important",
            overflowX: "hidden !important"
        },
    },
    tabsDisactivated: {
        "& .MuiTab-root": {
            minWidth: "88px",
            borderRadius: "16px"
        },
        "& button:last-child": {
            marginTop: "0px"
        },
        "& .MuiTab-labelIcon .MuiTab-wrapper > *:first-child": {
            width: "1.25em",
            height: "1.25em",
            marginBottom: 0
        },
        "& .MuiTab-textColorPrimary.Mui-selected": {
            backgroundColor: "transparent",
        },
        "& .MuiTab-textColorPrimary.Mui-selected .MuiTab-wrapper": {
            color: "#101010 !important"
        },
        "& .MuiTabs-vertical": {
            backgroundColor: "transparent",
            color: "#989898",
            transition: "all 225ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
            width: "88px",
            height: "88px !important",
            borderRadius: "16px"
        },
        "& .MuiTabs-vertical:hover": {
            backgroundColor: "rgba(255,255,255,0.06)"
        },
        "& span.MuiTabs-indicator": {
            zIndex: "-1",
            width: "100%",
            height: "88px !important",
            marginTop: -8,
            marginRight: 0,
            backgroundColor: "rgba(199,199,199,0)",
            borderRadius: "16px",
            transform: "scale3d(0, 0, 0)",
            transformOrigin: "50% 50%",
            transition: "all 360ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
        },
        padding: "0px",
        backgroundColor: "#020202",
        justifyContent: "flex-start",
        position: "absolute",
        top: "136px",
        height: "calc(100% - 132px)",
        borderRadius: "18px 18px 0px 0px",
        margin: "0px 0px 0px 18.5px",
        left: 0,
        zIndex: 1,
        transition: "background-color 320ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
        "&:hover": {
            backgroundColor: "#000000",
        },
        [theme.breakpoints.down("sm")]: {
            justifyContent: "flex-start",
            padding: "0px",
            height: "auto",
            position: "relative",
            borderRadius: "14px",
            top: "0px",
            marginTop: 8,
            marginBottom: 16,
            width: "calc(100% - 32px)",
            "& .MuiTab-root": {
                minWidth: "80px",
                borderRadius: "12px"
            },
            "& .MuiTabs-horizontal": {
                backgroundColor: "transparent",
                color: "#989898",
                transition: "all 225ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
                borderRadius: "12px",
                height: "80px !important",
            },
            "& .MuiTabs-horizontal:hover": {
                backgroundColor: "rgba(255,255,255,0.06)"
            },
            "& span.MuiTabs-indicator": {
                width: "100%",
                height: "80px !important",
                marginTop: 0,
                marginBottom: -4,
                marginRight: 0,
                backgroundColor: "rgba(199,199,199,0)",
                transform: "scale3d(0, 0, 0)",
                transformOrigin: "50% 50%",
                borderRadius: "12px",
                transition: "all 360ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
            },
        }
    },
    tabs: {
        "& .MuiTab-root": {
            minWidth: "88px",
            borderRadius: "16px"
        },
        "& button:last-child": {
            marginTop: "0px"
        },
        "& .MuiTab-labelIcon .MuiTab-wrapper > *:first-child": {
            width: "1.25em",
            height: "1.25em",
            marginBottom: 0
        },
        "& .MuiTab-textColorPrimary.Mui-selected": {
            backgroundColor: "transparent",
        },
        "& .MuiTab-textColorPrimary.Mui-selected .MuiTab-wrapper": {
            color: "#101010 !important"
        },
        "& .MuiTabs-vertical": {
            backgroundColor: "transparent",
            color: "#989898",
            transition: "all 225ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
            width: "88px",
            height: "88px !important",
            borderRadius: "16px"
        },
        "& .MuiTabs-vertical:hover": {
            backgroundColor: "rgba(255,255,255,0.06)"
        },
        "& span.MuiTabs-indicator": {
            zIndex: "-1",
            width: "100%",
            height: "88px !important",
            marginTop: -8,
            marginRight: 0,
            backgroundColor: "#c7c7c7",
            borderRadius: "16px",
            transform: "scale3d(0.875, 0.75, 1)",
            transformOrigin: "50% 50%",
            transition: "all 360ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
        },
        padding: "0px",
        backgroundColor: "#020202",
        justifyContent: "flex-start",
        position: "absolute",
        top: "136px",
        height: "calc(100% - 132px)",
        borderRadius: "18px 18px 0px 0px",
        margin: "0px 0px 0px 18.5px",
        left: 0,
        zIndex: 1,
        transition: "background-color 320ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
        "&:hover": {
            backgroundColor: "#000000",
        },
        [theme.breakpoints.down("sm")]: {
            justifyContent: "flex-start",
            padding: "0px",
            height: "auto",
            position: "relative",
            borderRadius: "14px",
            top: "0px",
            marginTop: 8,
            marginBottom: 16,
            width: "calc(100% - 32px)",
            "& .MuiTab-root": {
                minWidth: "80px",
                borderRadius: "12px"
            },
            "& .MuiTabs-horizontal": {
                backgroundColor: "transparent",
                color: "#989898",
                transition: "all 225ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
                borderRadius: "12px",
                height: "80px !important",
            },
            "& .MuiTabs-horizontal:hover": {
                backgroundColor: "rgba(255,255,255,0.06)"
            },
            "& span.MuiTabs-indicator": {
                width: "100%",
                height: "80px !important",
                marginTop: 0,
                marginBottom: -4,
                marginRight: 0,
                backgroundColor: "#c7c7c7",
                transformOrigin: "50% 50%",
                borderRadius: "12px",
                transition: "all 360ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
            },
        }
    },
    flexColumn: {
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        overflow: "none",
        position: "relative",
        minHeight: "calc(100% - 36px)",
        margin: "0px 24px 0px 24px",
        padding: "24px 0px 8px 0px",
        [theme.breakpoints.down("sm")]: {
            minHeight: "auto",
            margin: "0px",
            padding: "0px 12px 12px 12px",
            boxSizing: "border-box",
            "& > div": {
                marginBottom: 0
            }
        }
    },
    flexColumn2: {
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        overflow: "none",
        position: "relative",
        minHeight: "calc(100% - 36px)",
        margin: "24px 24px 0px 24px",
        [theme.breakpoints.down("sm")]: {
            minHeight: "auto",
            margin: "0px",
            padding: "0px 24px 24px 24px",
            boxSizing: "border-box",
            "& > div": {
                marginBottom: 24
            }
        }
    },
    rewardClaim: {
        position: "absolute",
        top: "0px",
        right: "18px",
        display: "grid",
        borderRadius: "16px",
        backgroundColor: "#101010",
        transition: "background-color 240ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
        "&:hover": {
            backgroundColor: "#171717",
            transition: "background-color 360ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
        },
        [theme.breakpoints.down("sm")]: {
            top: "12px",
            right: "12px",
            transform: "scale(0.8125)",
            "& .subtitle": {
                fontSize: "9px",
                color: "#aaa",
                maxWidth: 140
            }
        }
    },
    historyControls: {
        "& > .MuiFormControlLabel-root": {
            marginLeft: "8px",
            marginRight: "8px",
            "& .MuiTypography-body1": {
                fontSize: "14px"
            }
        }
    },
    mobileMarginTop: {
        [theme.breakpoints.down("sm")]: {
            margin: "16px 0px 0px 0px",
        }
    },
    centerRechart: {
        position: "absolute",
        display: "table",
        zIndex: 1,
        width: "100%",
        height: "100%",
        top: 0,
        left: 0,
        "& > div": {
            display: "table-cell",
            verticalAlign: "middle",  // Centers vertically
            textAlign: "center",       // Centers horizontally
            "& > button": {
                display: "inline-block",
                top: "50% !important",
                margin: "auto !important",
                transform: "translate(-50%, calc(-50% - 9px)) !important",
                [theme.breakpoints.down("sm")]: {
                    transform: "translate(-50%, calc(-50% - 21px)) !important",
                }
            }
        }
    },
    transactionListItem: {
        backgroundColor: "transparent",
        borderRadius: "0px",
        transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,border-radius 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
        "&:hover": {
            backgroundColor: "#101010",
            borderRadius: "12px",
            transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,border-radius 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
        }
    },
    currencyActionButtons: {
        margin: "0px",
        gap: "8px",
        width: "100%",
        boxSizing: 'border-box',
        display: "flex",
        padding: "0px",
        flexWrap: "wrap",
        justifyContent: "space-between",
        "& > div:first-child": {
            gap: "8px",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
        },
        "& > div:last-child": {
            gap: "8px",
            display: "flex",
            flexWrap: "wrap",
            flexFlow: "column",
            justifyContent: "flex-end",
            flex: "auto"
        },
        [theme.breakpoints.down("sm")]: {
            "& > div:first-child": {
                flex: "initial",
                justifyContent: "space-between"
            },
            "& > div:first-child > button": {
                flex: "auto"
            },
        }
    },
    glowText: {
        background: "linear-gradient(135deg, #999 25%, #777 35%, #eee 45%, #fff 50%, #eee 55%, #777 65%, #999 75%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundSize: "150%",
        color: "#bbb",
        animationName: "$textGlow",
        animationTimingFunction: "cubic-bezier(0.45, 0.425, 0.375, 0.55)",
        animationIterationCount: "infinite",
        animationDuration: "2.14s",
        animationFillMode: "both",
        animationDelay: "0ms",
        willChange: "background-position-x",
        "@global": {
            "@keyframes textGlow": {
                "0%": {backgroundPositionX: "-150%"},
                "100%": {backgroundPositionX: "150%"},
            }
        },
    },
    pricedAt: {
        textAlign: "left",
        color: "#a5a5a5",
        fontSize: "16px",
        marginBottom: "12px",
        marginTop: "8px",
        fontWeight: "bold",
        [theme.breakpoints.down("sm")]: {
            fontSize: "14px",
        }
    },
    tooltipRoot: {
        maxWidth: "min(75vw, 500px)",
        borderRadius: "16px",
        backgroundColor: "#dddddd !important",
        color: "#0e0e0e !important"
    },
    tooltip: {
        margin: "8px",
        display: "block",
        fontSize: "14px",
        lineHeight: "22px"
    },
    subHeader: {
        margin: "12px 0px 8px 0px"
    },
    delegations: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px'
    },
    delegationList: {
        flex: '1 1 292px',
        minWidth: '292px',
        boxSizing: 'border-box',
    },
    powerDownActions: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px'
    },
    powerDownActionList: {
        flex: '1 1 292px',
        minWidth: '292px',
        boxSizing: 'border-box',
    },
    delegationListItem: {
        backgroundColor: "transparent",
        borderRadius: "0px",
        transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,border-radius 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
        "&:hover": {
            backgroundColor: "#101010",
            borderRadius: "12px",
            transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,border-radius 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
        }
    },
    totalButtonMiddle: {
        "&.MuiButton-contained": {
            backgroundColor: "transparent",
            color: "#808080",
            transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,border 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
            fontSize: "21px",
            position: "absolute",
            marginLeft: "12px",
            padding: "0px 12px",
            top: "0px",
            [theme.breakpoints.down("sm")]: {
                top: "8px",
            },
            cursor: "pointer"
        },
        "&.MuiButton-contained:hover": {
            color: "#e0e0e0",
            transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,border 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
        },
    },
    totalButton: {
        "&.MuiButton-contained": {
            backgroundColor: "#1d1d1d",
            color: "#808080",
            transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,border 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
            fontSize: "21px",
            position: "absolute",
            marginLeft: "12px",
            padding: "0px 12px",
            top: "0px",
            cursor: "pointer",
            whiteSpace: "nowrap",
            [theme.breakpoints.down("sm")]: {
                top: "8px",
            },
        },
        "&.MuiButton-contained:hover": {
            backgroundColor: "#2d2d2d",
            color: "#e0e0e0",
            transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,border 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
        },
        "&.MuiButton-contained.active": {
            backgroundColor: "#ffffff",
            color: "#000000",
        }
    },
    greyButton: {
        "&.MuiButton-contained": {
            backgroundColor: "#151515",
            color: "#808080",
            transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,border 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
        },
        "&.MuiButton-contained:hover": {
            backgroundColor: "#282828",
            color: "#d0d0d0",
            transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,border 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
        },
        "&.MuiButton-contained.Mui-disabled": {
            opacity: 0.35,
        }
    },
    whiteButton: {
        "&.MuiButton-contained": {
            backgroundColor: "#d0d0d0",
            color: "#151515",
            width: "100%",
            transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,border 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
        },
        "&.MuiButton-contained:hover": {
            backgroundColor: "#ffffff",
            color: "#000000",
            transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,border 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
        },
        "&.MuiButton-contained.Mui-disabled": {
            opacity: 0.35,
        }
    },
    blackButton: {
        "&.MuiButton-contained": {
            backgroundColor: "#d0d0d0",
            color: "#151515",
            transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,border 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
        },
        "&.MuiButton-contained:hover": {
            backgroundColor: "#ffffff",
            color: "#000000",
            transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,border 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
        }
    },
    portfolioCard: {
        backgroundColor: "#151515",
        borderRadius: "18px",
        padding: "20px 24px",
        margin: "12px 0px",
        transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
        "&:hover": {
            backgroundColor: "#212121",
            transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
        }
    }
});

export function formatPriceChartData(prices, dateType = "D"){
    const options = dateType === "D" ? {hour: "numeric", minute: "numeric"}: dateType === "W" ? {day: "numeric", hour: "numeric"}: dateType === "M" ? {day: 'numeric'}: dateType === "Y" ? { day: 'numeric', month: 'numeric' }: { day: 'numeric', month: 'numeric', year: "numeric" };
    return prices.map(([timestamp, price]) => {
        const dateObj = new Date(timestamp);
        const name = dateObj.toLocaleDateString('en-GB', options); // X-axis
        const date = dateObj.toLocaleDateString('en-GB'); // Tooltip detail

        return {
            name,
            price: Number(price.toFixed(4)),
            date,
        };
    });
}

const CustomTooltip = ({ active, payload, label, fiatRate = 1, currency = 'USD' }) => {
    if (!active || !payload?.length) return null;
    const { price, date } = payload[0].payload;

    return (
        <div style={{
            background: '#1e1e1e',
            color: '#ffffff',
            borderRadius: 8,
            padding: 10,
            fontSize: 13
        }}>
            <div><strong>{t("components.pixa_wallet_dialog.date")}</strong> {date}</div>
            <div><strong>{t("components.pixa_wallet_dialog.price")}</strong> {(price * (Number.isFinite(fiatRate) && fiatRate > 0 ? fiatRate : 1)).toFixed(3)} {currency || 'USD'}</div>
        </div>
    );
};

const COLORS = ['#ffffff', '#c7c7c7', '#888888'];

// Scroll threshold in pixels for edge detection
const SCROLL_EDGE_THRESHOLD = 10;

/**
 * Translate a raw chain asset into its display string.
 *
 * Handles two incoming shapes, since different chain APIs return assets differently:
 *
 *   1. Condenser-style string:  "100.000 TESTS"  →  "100.000 PXA"
 *   2. AppBase NAI object:      { amount: "100000", precision: 3, nai: "@@000000021" }
 *      → parsed via precision + NAI lookup → formatted as "100.000 PXA"
 *
 * Translation map (chain → display):
 *   TESTS / HIVE / @@000000021  →  PXA
 *   TBD   / HBD  / @@000000013  →  PXS
 *   VESTS /      / @@000000037  →  PXP
 *
 * Returns an empty string (not the raw object) on unrecognized input so template
 * literals never get the dreaded "[object Object]".
 */
const NAI_TO_DISPLAY = {
    '@@000000021': { symbol: 'PXA', precision: 3 },  // HIVE/TESTS
    '@@000000013': { symbol: 'PXS', precision: 3 },  // HBD/TBD
    '@@000000037': { symbol: 'PXP', precision: 6 },  // VESTS
};
const CHAIN_SYMBOL_TO_DISPLAY = {
    TESTS: 'PXA', HIVE: 'PXA', PIXA: 'PXA',
    TBD:   'PXS', HBD:  'PXS',
    VESTS: 'PXP',
};
const SYMBOL_PRECISION = {
    PXA: 3, PXS: 3, PXP: 6,
    TESTS: 3, HIVE: 3, PIXA: 3,
    TBD: 3, HBD: 3,
    VESTS: 6,
};

const _translateAsset = (asset) => {
    if (asset == null) return '';

    // Shape 1: AppBase NAI object
    if (typeof asset === 'object' && asset.nai) {
        const mapping = NAI_TO_DISPLAY[asset.nai];
        if (!mapping) return '';  // unknown NAI — don't leak "[object Object]"
        const precision = typeof asset.precision === 'number' ? asset.precision : mapping.precision;
        const rawAmount = typeof asset.amount === 'string' ? asset.amount : String(asset.amount ?? '0');
        const numeric = parseFloat(rawAmount) / Math.pow(10, precision);
        if (!Number.isFinite(numeric)) return '';
        return `${numeric.toFixed(precision)} ${mapping.symbol}`;
    }

    // Shape 2: string "<amount> <SYMBOL>"
    if (typeof asset === 'string') {
        const parts = asset.trim().split(/\s+/);
        if (parts.length !== 2) return asset;
        const [amountStr, symbol] = parts;
        const numeric = parseFloat(amountStr);
        if (!Number.isFinite(numeric)) return asset;
        const displaySymbol = CHAIN_SYMBOL_TO_DISPLAY[symbol] || symbol;
        const precision = SYMBOL_PRECISION[displaySymbol] ?? SYMBOL_PRECISION[symbol] ?? 3;
        return `${numeric.toFixed(precision)} ${displaySymbol}`;
    }

    return '';
};

/**
 * Parse a VESTS asset (string "X.XXXXXX VESTS" or AppBase NAI object) to a raw
 * numeric VESTS value. Returns 0 if the input is missing or unparseable.
 * Needed because account_history_api (AppBase) returns assets as NAI objects
 * — parseFloat() on a NAI object yields NaN, silently zeroing delegations
 * that came through the AppBase path.
 */
const _assetToVests = (asset) => {
    if (asset == null) return 0;
    if (typeof asset === 'string') {
        const v = parseFloat(asset);
        return Number.isFinite(v) ? v : 0;
    }
    if (typeof asset === 'object' && asset.nai) {
        const precision = typeof asset.precision === 'number' ? asset.precision : 6;
        const amountStr = typeof asset.amount === 'string' ? asset.amount : String(asset.amount ?? '0');
        const v = parseFloat(amountStr) / Math.pow(10, precision);
        return Number.isFinite(v) ? v : 0;
    }
    return 0;
};

/**
 * Normalize a sanitized account entity into the shape the wallet UI expects.
 * The API's sanitizeAccount() produces { name, _profile: { profile_image, display_name, ... } }
 * but the wallet templates reference { username, image, name (display) }.
 */
const normalizeWalletAccount = (account) => {
    if (!account) return { username: '', image: '', name: '' };
    return {
        ...account,
        // username: always the blockchain account name
        username: account.username || account.name || '',
        // image: profile picture URL
        image: (account._profile && account._profile.profile_image) || '',
        // display name (human-readable)
        display_name: account.display_name || (account._profile && account._profile.display_name) || account.name || '',
    };
};

class PixaWalletDialog extends React.PureComponent {

    constructor(props) {
        super(props);
        this.state = {
            classes: props.classes,
            keepMounted: props.keepMounted || false,
            open: props.open,
            api: props.api,
            locales: props.locales,
            account: normalizeWalletAccount(props.account),
            _time_ago: timeAgo,
            _power_dialog_opened: "",
            _send_dialog_opened: "",
            _keys_dialog_opened: "",
            _swap_dialog_opened: "",
            _delegate_dialog_opened: false,
            _send_power_dialog_opened: false,
            _bulk_create_dialog_opened: false,
            _bulk_power_dialog_opened: false,
            _supra_info_dialog_opened: false,
            _power_info_dialog_opened: false,
            _pixa_info_dialog_opened: false,
            _taxes_dialog_opened: false,
            _history: HISTORY,
            _selectedRange: 7,
            _data: [],
            _chartLoading: false,
            _views: Array.of(<div className={props.classes.flexColumn}/>, <div className={props.classes.flexColumn}/>, <div className={props.classes.flexColumn}/>, <div className={props.classes.flexColumn}/>),
            _bigmac: formatPriceChartData([
                [1262304000000, 3.43],
                [1277942400000, 3.53],
                [1309478400000, 3.64],
                [1325376000000, 3.81],
                [1341100800000, 3.96],
                [1356998400000, 4.03],
                [1372636800000, 4.18],
                [1388534400000, 4.24],
                [1404172800000, 4.29],
                [1467331200000, 4.5],
                [1514764800000, 4.61],
                [1530403200000, 4.62],
                [1546300800000, 4.71],
                [1577836800000, 4.82],
                [1609459200000, 4.89],
                [1625097600000, 4.93],
                [1640995200000, 5.04],
                [1656633600000, 5.15],
                [1672531200000, 5.36],
                [1688169600000, 5.58],
                [1704067200000, 5.69],
                [1744372675555, 5.69]
            ], "C"),
            _tab_value: (props.initialView !== undefined && props.initialView !== null) ? props.initialView : false,
            _view_right_mobile_enabled: (window.innerWidth || document.documentElement.clientWidth || (document.body || document.getElementsByTagName('body')[0]).clientWidth) <= 960,
            // Wallet data from API
            _fullAccount: null,
            _globalProps: null,
            _vestToPixa: () => 0,
            _pixaToVest: () => 0,
            _pixaBalance: 0,
            _pxsBalance: 0,
            _pxpBalance: 0,
            _pxpInPixa: 0,
            _ownPxp: 0,
            _delegatedPxp: 0,
            _receivedPxp: 0,
            _powerDownablePxp: 0,
            _rewardPixa: 0,
            _rewardPxs: 0,
            _rewardPxp: 0,
            _rewardPxpInPixa: 0,
            _rewardPixaRaw: '0.000 PXA',
            _rewardPxsRaw: '0.000 PXS',
            _rewardVestsRaw: '0.000000 PXP',
            _isPoweringDown: false,
            _nextPowerDown: 0,
            _nextWithdrawalDate: null,
            _toWithdraw: 0,
            _withdrawn: 0,
            _pixaUsdPrice: 0.06,
            _pxsUsdPrice: 5.69,
            _fiatRate: 1,
            _currency: 'USD',
            _pxpUsd: 0,
            _pixaUsd: 0,
            _pxsUsd: 0,
            _totalUsd: 0,
            _outgoingDelegations: [],
            _incomingDelegations: [],
            // Savings (PXA + PXS) and pending savings withdrawals
            _savingsPixa: 0,
            _savingsPxs: 0,
            _savingsWithdrawals: [],   // [{ request_id, to, amount, amount_num, currency, complete, daysLeft }]
            // Outgoing recurrent transfers
            _recurrentTransfers: [],   // [{ to, amount, amount_num, currency, recurrence, remaining_executions, consecutive_failures, image }]
            // Pending PXS → PXA conversions (the ~3.5 day convert settlement)
            _pendingConversions: [],   // [{ requestid, amount, amount_num, conversion_date, daysLeft }]
            // Pending PXA → PXS collateralized conversions. PXS is credited
            // instantly; the PXA collateral is locked and any excess is returned
            // when the request settles (~3.5 days).
            _pendingCollateralizedConversions: [], // [{ requestid, collateral, collateral_num, collateral_currency, converted, converted_num, converted_currency, conversion_date, daysLeft }]
            // Funds in flight per token = pending savings withdrawals + pending
            // PXS→PXA conversions + locked PXA collateral. Already debited
            // on-chain, not yet settled, so counted toward holdings/valuation but
            // never toward spendable balance.
            _pendingPixa: 0,
            _pendingPxs: 0,
            // Savings deposit/withdraw dialog
            _savings_dialog_opened: "",      // "" | "PIXA" | "SUPRA"
            _savings_dialog_mode: "deposit", // "deposit" | "withdraw"
            // Collapsed/expanded state for the wallet sub-sections, keyed by
            // section id ("savings:PXA", "recurrent:PXS", "pendingswap", …).
            // Default collapsed for a cleaner view; counts surface in the header.
            _expandedSections: {},
            _walletHistory: [],
            _walletLoaded: false,
            _LIQUID_SYMBOL: 'PXA',
            _DOLLAR_SYMBOL: 'PXS',
            _VESTS_SYMBOL: 'PXP',
            // Confirmation dialog for self-to-self operations
            _confirm_action_open: false,
            _confirm_action_title: '',
            _confirm_action_body: '',
            _confirm_action_callback: null,
            // First-open guided tour (null = inactive)
            _tour_steps: null,
            // Own-profile vs other-profile distinction
            _itsOwnProfile: props.isOwnProfile !== false,
            _loggedInUser: props.loggedInUser || null,
        };
    };

    componentWillReceiveProps(new_props) {
        const normalizedAccount = normalizeWalletAccount(new_props.account);
        const prevUsername = (this.state.account || {}).username || '';
        const newUsername = normalizedAccount.username || '';
        var isNewAccount = newUsername !== prevUsername;
        var isNewlyClosed = new_props.open === false && this.state.open;
        var isNewlyOpened = new_props.open === true && !this.state.open;
        const initialViewChanged = new_props.initialView !== undefined && new_props.initialView !== this.state._tab_value;
        const merged = { ...new_props, account: normalizedAccount };
        // Track own-profile distinction
        if (new_props.isOwnProfile !== undefined) merged._itsOwnProfile = new_props.isOwnProfile !== false;
        if (new_props.loggedInUser !== undefined) merged._loggedInUser = new_props.loggedInUser || null;
        this.setState(merged, () => {
            if(isNewlyClosed || isNewAccount) {
                if (this.state._tour_steps) this._finish_tour("closed");
                this.setState({...merged, _tab_value: false}, () => {
                    this.forceUpdate();
                })
            } else if (isNewlyOpened) {
                // Apply initialView from props when opening
                const viewValue = (new_props.initialView !== undefined && new_props.initialView !== null) ? new_props.initialView : false;
                this.setState({_tab_value: viewValue}, () => {
                    this.forceUpdate();
                });
                this._maybe_start_tour();
            } else if (new_props.open && initialViewChanged) {
                // Sync view when parent changes it (e.g. browser back/forward)
                this.setState({_tab_value: new_props.initialView}, () => {
                    this.forceUpdate();
                });
            }
            if (isNewlyOpened || isNewAccount) {
                this._fetch_wallet_data();
            }
        });
    }

    /**
     * Fetch the USD->display-currency rate (frankfurter, cached on api.prices)
     * for the selected currency and stash it in state. Decoupled from the
     * heavy _fetch_wallet_data so a currency switch stays cheap.
     */
    _refresh_fiat_rate = () => {
        const cur = (get_cached_settings().currency) || 'USD';
        const api = this.state.api || this.props.api;
        const prices = api && api.prices;
        if (this.state._currency !== cur) this.setState({ _currency: cur });
        if (!prices || typeof prices.getFiatRate !== 'function' || cur === 'USD') {
            if (this.state._fiatRate !== 1) this.setState({ _fiatRate: 1 });
            return;
        }
        prices.getFiatRate(cur)
            .then((rate) => {
                const r = Number(rate);
                this.setState({ _fiatRate: Number.isFinite(r) && r > 0 ? r : 1 });
            })
            .catch(() => { this.setState({ _fiatRate: 1 }); });
    };

    componentDidMount() {
        window.addEventListener("resize", this._computeSize);
        this._recompute_chart();
        this._fetch_wallet_data();
        this._refresh_fiat_rate();
        this._unsub_settings = subscribe_settings(() => this._refresh_fiat_rate());
        if (this.state.open) this._maybe_start_tour();
    }

    /**
     * Re-fetch wallet data after a broadcast.
     *
     * Since _fetch_wallet_data now queries history with include_reversible,
     * just-broadcast operations appear as soon as they land in a reversible
     * block (~3s). We do a fast first refresh (1.5s) to catch that, then a
     * slower follow-up (7s) as a safety net for balance propagation and in
     * case the first call raced the block.
     */
    _refresh_after_tx = () => {
        if (this._refreshTimer) clearTimeout(this._refreshTimer);
        if (this._refreshTimer2) clearTimeout(this._refreshTimer2);
        this._refreshTimer = setTimeout(() => {
            this._fetch_wallet_data();
        }, 1500);
        this._refreshTimer2 = setTimeout(() => {
            this._fetch_wallet_data();
        }, 7000);
    };

    /**
     * Fetch raw account history for the wallet (transfers, power ops, savings,
     * rewards, swaps), returning the unprocessed [index, entry] rows.
     *
     * Tries AppBase account_history_api with include_reversible first so
     * just-broadcast ops (still in reversible blocks, ~45s window) show up
     * immediately, then falls back to the legacy condenser path, then to a full
     * unfiltered history (slow but always works on a HIVE/STEEM fork — needed
     * for brand-new accounts whose only ops are received delegations that some
     * indexers miss via bitmask). Always resolves to an array; never throws.
     *
     * Extracted from _fetch_wallet_data so the (slowest) history read can run
     * concurrently with the small balance-adjacent reads instead of gating them.
     */
    _fetch_wallet_history_raw = async (username, walletFilter) => {
        const { api } = this.state;
        try {
            // utils.makeBitMaskFilter returns a [low, high] pair.
            const [filterLow, filterHigh] = Array.isArray(walletFilter)
                ? walletFilter
                : [walletFilter, 0];

            let rawHistory = null;
            if (typeof api.accounts.getAccountHistoryFull === 'function') {
                rawHistory = await api.accounts.getAccountHistoryFull({
                    account: username,
                    start: -1,
                    limit: 1000,
                    includeReversible: true,
                    operationFilterLow: filterLow,
                    operationFilterHigh: filterHigh,
                });
            }
            // Treat an empty array the same as a missing result so we always get
            // a second chance via the condenser path (AppBase swallows errors —
            // older nodes, missing account_history_api, or bitmask not honoured
            // server-side — and yields []).
            if (!rawHistory || rawHistory.length === 0) {
                try {
                    const legacy = await api.accounts.getAccountHistory(
                        username, -1, 1000, walletFilter
                    );
                    if (Array.isArray(legacy) && legacy.length > 0) {
                        rawHistory = legacy;
                    } else {
                        const unfiltered = await api.accounts.getAccountHistory(
                            username, -1, 1000
                        );
                        rawHistory = Array.isArray(unfiltered) ? unfiltered : (rawHistory || []);
                    }
                } catch (e) {
                    rawHistory = rawHistory || [];
                }
            }
            return rawHistory || [];
        } catch (e) {
            return [];
        }
    };

    /**
     * Fetch all wallet data from the API:
     * - Full account object (balances, vesting, rewards)
     * - Dynamic global properties (for VESTS→PXA conversion)
     * - Vesting delegations (incoming/outgoing)
     * - Market ticker (for USD pricing)
     * - Recent account history (transfers)
     *
     * Two-phase for responsiveness: phase 1 resolves balances/prices in a single
     * round trip and paints them immediately; phase 2 fetches the secondary
     * lists (delegations, savings/conversion requests, history, profile images)
     * concurrently and refines the view.
     */
    _fetch_wallet_data = async () => {
        const { api, account } = this.state;
        if (!api || !account || !account.username) return;

        try {
            // Fetch in parallel for speed
            const [accountsResult, globalProps, ticker, prices] = await Promise.all([
                api.accounts.getAccounts([account.username]),
                api.globals.getDynamicGlobalProperties(),
                api.market.getTicker().catch(() => null),
                // Pricing logic lives on the API — see PricesAPI in pixaproxyapi.js.
                // Reads the witness median feed, applies plausibility guard, falls back
                // to design constants ($5.69 PXS / $0.06 PXA) when the feed is unset.
                api.prices.get().catch(() => api.prices.getSync()),
            ]);

            const fullAccount = (accountsResult || [])[0];
            if (!fullAccount || !globalProps) return;

            // Extract actual chain asset symbols from the account's own balance strings.
            // The chain returns e.g. "123.456 PXA" or "0.500 PXS" — we parse the symbol
            // from there so we never hardcode the wrong one.
            const _extractSymbol = (assetStr, fallback) => {
                if (!assetStr || typeof assetStr !== 'string') return fallback;
                const parts = assetStr.trim().split(/\s+/);
                return parts.length >= 2 ? parts[parts.length - 1] : fallback;
            };
            const LIQUID_SYMBOL = _extractSymbol(fullAccount.balance, 'PXA');
            const DOLLAR_SYMBOL = _extractSymbol(fullAccount.pxs_balance, 'PXS');
            const VESTS_SYMBOL = _extractSymbol(fullAccount.vesting_shares, 'PXP');

            // VESTS → liquid conversion using the API's own formatter
            // The chain may use total_vesting_fund_pixa, _steem, or _hive depending on the fork
            const totalVestingShares = globalProps.total_vesting_shares;
            const totalVestingFundPixa = globalProps.total_vesting_fund_pixa
                || globalProps.total_vesting_fund_steem
                || globalProps.total_vesting_fund_hive
                || `0.000 ${LIQUID_SYMBOL}`;

            const vestToPixa = (vests) => {
                const v = parseFloat(vests) || 0;
                if (v === 0) return 0;
                return api.formatter.vestToPixa(v, totalVestingShares, totalVestingFundPixa);
            };

            // Reverse conversion: PXA-equivalent → raw VESTS (for chain operations)
            const pixaToVest = (pixa) => {
                const p = parseFloat(pixa) || 0;
                if (p === 0) return 0;
                const totalV = parseFloat(totalVestingShares) || 1;
                const totalF = parseFloat(totalVestingFundPixa) || 1;
                return (p / totalF) * totalV;
            };

            // Balances. Use _assetToVests for VESTS fields so we handle both
            // condenser strings and AppBase NAI objects defensively.
            const pixaBalance = parseFloat(fullAccount.balance) || 0;
            const pxsBalance = parseFloat(fullAccount.pxs_balance) || 0;
            // Savings balances (PXA + PXS). Sanitiser exposes these as display
            // strings ("X.XXX PXA" / "X.XXX PXS"), so parseFloat is enough.
            const savingsPixa = parseFloat(fullAccount.savings_balance) || 0;
            const savingsPxs = parseFloat(fullAccount.savings_pxs_balance) || 0;
            const ownVests = _assetToVests(fullAccount.vesting_shares);
            const delegatedVests = _assetToVests(fullAccount.delegated_vesting_shares);
            const receivedVests = _assetToVests(fullAccount.received_vesting_shares);
            const effectiveVests = ownVests - delegatedVests + receivedVests;
            // PXP is the PXA-equivalent of VESTS (like HP = vestToHive(VESTS) in Hive)
            const pxpBalance = vestToPixa(effectiveVests);
            const ownPxp = vestToPixa(ownVests);
            const delegatedPxp = vestToPixa(delegatedVests);
            const receivedPxp = vestToPixa(receivedVests);
            // For USD pricing, PXP is already in PXA terms
            const pxpInPixa = pxpBalance;

            // Rewards pending
            const rewardPixa = parseFloat(fullAccount.reward_pixa_balance) || 0;
            const rewardPxs = parseFloat(fullAccount.reward_pxs_balance) || 0;
            const rewardVests = parseFloat(fullAccount.reward_vesting_balance) || 0;
            const rewardPxp = vestToPixa(rewardVests);
            const rewardPxpInPixa = rewardPxp;

            // Power down info
            const withdrawRate = parseFloat(fullAccount.vesting_withdraw_rate) || 0;
            const nextPowerDown = vestToPixa(withdrawRate);
            const toWithdraw = fullAccount.to_withdraw || 0;
            const withdrawn = fullAccount.withdrawn || 0;
            const nextWithdrawalDate = fullAccount.next_vesting_withdrawal;
            const isPoweringDown = withdrawRate > 0 && toWithdraw > withdrawn;

            // USD pricing comes from api.prices — see PricesAPI for the full model.
            // Short version: PXS = $5.69 (design), PXA = $0.06 (design, overridden by
            // witness feed when the feed carries a plausible ratio).
            const pixaUsdPrice = prices.pxaUsd;
            const pxsUsdPrice  = prices.pxsUsd;

            const pxpUsd  = pxpInPixa  * pixaUsdPrice;  // PXP is PXA-denominated
            // Per-token USD is assembled in layers: liquid (spendable) + savings
            // + pending (funds already debited on-chain for a savings withdrawal
            // or a PXS→PXA conversion but not yet settled). These full-holdings
            // figures drive the per-token cards, the distribution gauge, and the
            // "% of wealth" splits, so nothing the user owns goes missing there.
            // The headline TOTAL is deliberately narrower (see earlyTotalUsd /
            // liveTotalUsd below): it counts only cleanly-owned, spendable value
            // — owned PXP, plus liquid (+ in-flight) PXA/PXS — and EXCLUDES both
            // savings and delegated-in PXP. Those two are shown on the cards /
            // delegation lists but not totalled, the same way a statement shows
            // money on deposit separately from the spendable balance.
            const pixaUsd = (pixaBalance + savingsPixa) * pixaUsdPrice;
            const pxsUsd  = (pxsBalance  + savingsPxs)  * pxsUsdPrice;

            // ── EARLY PAINT ──────────────────────────────────────────────────
            // Everything above comes from a single round trip (accounts + global
            // props + prices). Paint the headline total and the three per-token
            // balances NOW, before the slower secondary reads (delegations,
            // savings/conversion lists, the 1000-row history, profile images).
            // Those reads only fill in collapsible sub-sections and a small
            // pending layer, so blocking the whole wallet on them is what made it
            // feel sluggish. The final setState below refines these values with
            // live delegation reconciliation and in-flight funds.
            //
            // PXP here is the account-object figure; the final pass takes
            // Math.max against the live delegation breakdown, so this can only be
            // revised upward — no jarring downward correction.
            const earlyPxpUsd   = pxpInPixa * pixaUsdPrice;
            // Headline total: cleanly-owned, spendable value only. ownPxp counts
            // your owned stake — delegated-OUT PXP is still yours, so it stays in;
            // delegated-IN PXP isn't yours, so it never enters. Liquid PXA/PXS
            // only — savings is excluded from the total even though it's shown on
            // the token cards. Pending is folded in at the final pass, once its
            // lists exist (not known yet at early paint).
            const earlyTotalUsd = ownPxp * pixaUsdPrice
                + pixaBalance * pixaUsdPrice
                + pxsBalance  * pxsUsdPrice;
            this.setState({
                _fullAccount: fullAccount,
                _globalProps: globalProps,
                _vestToPixa: vestToPixa,
                _pixaToVest: pixaToVest,
                _pixaBalance: pixaBalance,
                _pxsBalance: pxsBalance,
                _pxpBalance: pxpBalance,
                _pxpInPixa: pxpInPixa,
                _ownPxp: ownPxp,
                _delegatedPxp: delegatedPxp,
                _receivedPxp: receivedPxp,
                _powerDownablePxp: Math.max(0, ownPxp - delegatedPxp),
                _rewardPixa: rewardPixa,
                _rewardPxs: rewardPxs,
                _rewardPxp: rewardPxp,
                _rewardPxpInPixa: rewardPxpInPixa,
                _rewardPixaRaw: fullAccount.reward_pixa_balance || `0.000 ${LIQUID_SYMBOL}`,
                _rewardPxsRaw: fullAccount.reward_pxs_balance || `0.000 ${DOLLAR_SYMBOL}`,
                _rewardVestsRaw: fullAccount.reward_vesting_balance || `0.000000 ${VESTS_SYMBOL}`,
                _isPoweringDown: isPoweringDown,
                _nextPowerDown: nextPowerDown,
                _nextWithdrawalDate: nextWithdrawalDate,
                _toWithdraw: toWithdraw,
                _withdrawn: withdrawn,
                _pixaUsdPrice: pixaUsdPrice,
                _pxsUsdPrice: pxsUsdPrice,
                _pxpUsd: earlyPxpUsd,
                _pixaUsd: pixaUsd,
                _pxsUsd: pxsUsd,
                _totalUsd: earlyTotalUsd,
                _savingsPixa: savingsPixa,
                _savingsPxs: savingsPxs,
                _walletLoaded: true,
                _LIQUID_SYMBOL: LIQUID_SYMBOL,
                _DOLLAR_SYMBOL: DOLLAR_SYMBOL,
                _VESTS_SYMBOL: VESTS_SYMBOL,
            }, () => this.forceUpdate());

            // Parse a raw chain asset (string or NAI object) into display + numeric.
            // Reuses the module-level _translateAsset, which normalises NAI shapes
            // and maps chain symbols (PIXA/TBD/…) to display symbols (PXA/PXS).
            const _rawAsset = (asset) => {
                const display = _translateAsset(asset);
                if (!display) return { display: '', num: 0, symbol: '' };
                const parts = display.split(/\s+/);
                return { display, num: parseFloat(parts[0]) || 0, symbol: parts[1] || '' };
            };
            // Whole days until a chain timestamp. Chain timestamps are UTC and may
            // arrive without a trailing 'Z'; add one when absent.
            const _daysUntil = (iso) => {
                if (!iso) return 0;
                const norm = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z';
                const t = new Date(norm).getTime();
                if (!Number.isFinite(t)) return 0;
                return Math.max(0, Math.ceil((t - Date.now()) / (1000 * 60 * 60 * 24)));
            };

            // ── PHASE 2: secondary reads, all issued in parallel ─────────────
            // Outgoing delegations, savings withdrawals, recurrent transfers,
            // both conversion-request kinds, and the (slow, 1000-row) account
            // history are now fired concurrently instead of as six sequential
            // awaits. The wallet used to wait on the *sum* of every round trip,
            // and the history read in particular gated the whole view. Each
            // promise is self-guarding: a failure or a missing node method
            // resolves to [] without taking down its siblings.
            const op = utils.operationOrders;

            // Wallet history: transfers, power ops, savings, rewards, swaps
            const walletFilter = utils.makeBitMaskFilter([
                op.transfer,
                op.transfer_to_vesting,
                op.withdraw_vesting,
                op.claim_reward_balance,
                op.delegate_vesting_shares,
                op.transfer_to_savings,
                op.transfer_from_savings,
                op.fill_transfer_from_savings,
                op.fill_order,
                op.fill_vesting_withdraw,
                op.convert,
                op.fill_convert_request,
                op.fill_collateralized_convert_request,
                op.recurrent_transfer,
                op.fill_recurrent_transfer,
                // ── rewards (high-volume virtual ops; tamed by the Rewards
                //    toggle + "Hide dust" in WalletHistory) ──
                op.author_reward,
                op.curation_reward,
                op.comment_benefactor_reward,
                op.comment_reward,
                op.producer_reward,
                // ── savings / conversion / delegation lifecycle ──
                op.interest,
                op.cancel_transfer_from_savings,
                op.collateralized_convert,
                op.return_vesting_delegation,
                // ── internal market ──
                op.limit_order_create,
                op.limit_order_create2,
                op.limit_order_cancel,
                // ── power-down routing ──
                op.set_withdraw_vesting_route,
                // ── escrow ──
                op.escrow_transfer,
                op.escrow_release,
                op.escrow_approve,
                op.escrow_dispute,
            ]);

            const _pOutgoing = (async () => {
                try { return (await api.globals.getVestingDelegations(account.username, '', 100)) || []; }
                catch (e) { return []; }
            })();
            const _pSavings = (async () => {
                try {
                    let rows = [];
                    if (api.database && typeof api.database.findSavingsWithdrawals === 'function') {
                        rows = await api.database.findSavingsWithdrawals(account.username);
                    }
                    if ((!rows || rows.length === 0) && api.authority && typeof api.authority.getSavingsWithdrawFrom === 'function') {
                        rows = await api.authority.getSavingsWithdrawFrom(account.username);
                    }
                    return rows || [];
                } catch (e) { return []; }
            })();
            const _pRecurrent = (async () => {
                try {
                    if (api.accounts && typeof api.accounts.findRecurrentTransfers === 'function') {
                        return (await api.accounts.findRecurrentTransfers(account.username)) || [];
                    }
                } catch (e) { /* ignore */ }
                return [];
            })();
            const _pConversions = (async () => {
                try {
                    if (api.globals && typeof api.globals.getConversionRequests === 'function') {
                        return (await api.globals.getConversionRequests(account.username)) || [];
                    }
                } catch (e) { /* ignore */ }
                return [];
            })();
            const _pCollateralized = (async () => {
                try {
                    if (api.globals && typeof api.globals.getCollateralizedConversionRequests === 'function') {
                        return (await api.globals.getCollateralizedConversionRequests(account.username)) || [];
                    }
                } catch (e) { /* ignore */ }
                return [];
            })();
            const _pHistory = this._fetch_wallet_history_raw(account.username, walletFilter);

            const [
                _outgoingRows,
                _savingsRows,
                _recurrentRows,
                _conversionRows,
                _collateralizedRows,
                rawHistory,
            ] = await Promise.all([
                _pOutgoing, _pSavings, _pRecurrent, _pConversions, _pCollateralized, _pHistory,
            ]);

            // ── Map outgoing delegations ─────────────────────────────────────
            let outgoingDelegations = (_outgoingRows || []).map(d => ({
                ...d,
                pxp: vestToPixa(_assetToVests(d.vesting_shares)),
            }));
            let incomingDelegations = [];

            // ── Pending savings withdrawals ──────────────────────────────────
            const savingsWithdrawals = (_savingsRows || []).map(r => {
                const a = _rawAsset(r.amount);
                return {
                    request_id: r.request_id,
                    to: r.to,
                    memo: r.memo || '',
                    amount: a.display,
                    amount_num: a.num,
                    currency: a.symbol,
                    complete: r.complete,
                    daysLeft: _daysUntil(r.complete),
                };
            });

            // ── Outgoing recurrent transfers ─────────────────────────────────
            let recurrentTransfers = (_recurrentRows || [])
                .filter(r => r && r.from === account.username)
                .map(r => {
                    const a = _rawAsset(r.amount);
                    return {
                        to: r.to,
                        memo: r.memo || '',
                        amount: a.display,
                        amount_num: a.num,
                        currency: a.symbol,
                        recurrence: Number(r.recurrence) || 0,
                        remaining_executions: Number(r.remaining_executions) || 0,
                        consecutive_failures: Number(r.consecutive_failures) || 0,
                        trigger_date: r.trigger_date,
                        image: '',
                    };
                });

            // ── Pending PXS → PXA conversions (~3.5 day settlement) ───────────
            // Standard `convert`: burns PXS now, releases PXA after the window.
            const pendingConversions = (_conversionRows || []).map(r => {
                const a = _rawAsset(r.amount);
                return {
                    requestid: r.requestid,
                    amount: a.display,
                    amount_num: a.num,
                    currency: a.symbol,
                    conversion_date: r.conversion_date,
                    daysLeft: _daysUntil(r.conversion_date),
                };
            });

            // ── Pending PXA → PXS collateralized conversions ──────────────────
            // `collateralized_convert`: credits PXS instantly and locks PXA as
            // collateral; the excess collateral is returned when the request
            // settles (~3.5 days). The chain row carries both legs —
            //   collateral_amount → PXA locked (debited now)
            //   converted_amount  → PXS already credited
            const pendingCollateralizedConversions = (_collateralizedRows || []).map(r => {
                const c = _rawAsset(r.collateral_amount);
                const v = _rawAsset(r.converted_amount);
                return {
                    requestid: r.requestid,
                    collateral: c.display,
                    collateral_num: c.num,
                    collateral_currency: c.symbol,
                    converted: v.display,
                    converted_num: v.num,
                    converted_currency: v.symbol,
                    conversion_date: r.conversion_date,
                    daysLeft: _daysUntil(r.conversion_date),
                };
            });

            // ── Funds in flight, per token ───────────────────────────────────
            // transfer_from_savings, the PXS→PXA `convert`, and the PXA collateral
            // locked by `collateralized_convert` all debit the source balance the
            // instant they're initiated and release (the remainder) only after
            // their delay window. While in flight the amount is in neither
            // `balance` nor `savings_balance`, so without this it would vanish
            // from the wallet until it settles. Sum per display symbol and fold
            // into each token's valuation. (The PXS leg of a collateralized
            // convert is credited instantly and already lives in `pxs_balance`,
            // so only the locked PXA collateral is counted as pending here.)
            const _sumPending = (arr, sym) => (arr || []).reduce(
                (s, r) => s + (r.currency === sym ? (Number(r.amount_num) || 0) : 0), 0);
            const _sumCollateral = (arr, sym) => (arr || []).reduce(
                (s, r) => s + (r.collateral_currency === sym ? (Number(r.collateral_num) || 0) : 0), 0);
            const pendingPixa = _sumPending(savingsWithdrawals, 'PXA') + _sumPending(pendingConversions, 'PXA')
                + _sumCollateral(pendingCollateralizedConversions, 'PXA');
            const pendingPxs  = _sumPending(savingsWithdrawals, 'PXS') + _sumPending(pendingConversions, 'PXS')
                + _sumCollateral(pendingCollateralizedConversions, 'PXS');
            // Final per-token USD = liquid + savings (computed above) + pending.
            const pixaUsdWithPending = pixaUsd + pendingPixa * pixaUsdPrice;
            const pxsUsdWithPending  = pxsUsd  + pendingPxs  * pxsUsdPrice;

            // rawHistory was fetched in parallel with the other secondary reads
            // (see _fetch_wallet_history_raw). Here we only process it: derive
            // incoming delegations and build the transaction list. Wrapped in
            // try/catch so one malformed entry can't break the wallet render.
            let history = [];
            try {
                // Extract incoming delegations from delegate_vesting_shares ops
                // where this account is the delegatee. Keep latest state per delegator.
                //
                // Operation shape normalization:
                //   - Condenser API returns: entry.op = ["op_name", {payload}]  (2-tuple)
                //   - AppBase account_history_api returns:
                //         entry.op = { type: "op_name_operation", value: {payload} }
                //   Normalize to { name, payload } so downstream code is shape-agnostic.
                const _normalizeOp = (rawOp) => {
                    if (Array.isArray(rawOp)) {
                        return { name: rawOp[0], payload: rawOp[1] || {} };
                    }
                    if (rawOp && typeof rawOp === 'object') {
                        // AppBase: strip "_operation" suffix if present
                        const rawType = rawOp.type || '';
                        const name = rawType.endsWith('_operation')
                            ? rawType.slice(0, -'_operation'.length)
                            : rawType;
                        return { name, payload: rawOp.value || {} };
                    }
                    return { name: '', payload: {} };
                };

                const incomingMap = {};
                for (const [, entry] of rawHistory) {
                    const { name, payload } = _normalizeOp(entry.op);
                    if (name === 'delegate_vesting_shares') {
                        if (payload.delegatee === account.username) {
                            // payload.vesting_shares can be a string ("X.XXXXXX VESTS")
                            // from condenser OR a NAI object {nai, precision, amount}
                            // from AppBase account_history_api. parseFloat on a NAI
                            // object returns NaN — silently zeroing real delegations.
                            const vests = _assetToVests(payload.vesting_shares);
                            if (vests > 0) {
                                incomingMap[payload.delegator] = {
                                    delegator: payload.delegator,
                                    delegatee: payload.delegatee,
                                    pxp: vestToPixa(vests),
                                };
                            } else {
                                // Delegation of 0 PXP = revoked
                                delete incomingMap[payload.delegator];
                            }
                        }
                    }
                }
                incomingDelegations = Object.values(incomingMap);

                // Stock HIVE/STEEM has no "find delegations TO an account"
                // endpoint — only the delegator-indexed find_vesting_delegations.
                // The canonical workaround is to scan account history for
                // delegate_vesting_shares ops where this account is the delegatee
                // (done above). When that yields nothing but received_vesting_shares
                // > 0, we fall back through two more paths:
                //
                //   1. Treasury pre-scan (fast, targeted) — most fresh-account
                //      delegations come from a small known set of seeding
                //      treasury accounts. Call find_vesting_delegations on each,
                //      pick out rows where delegatee === us. One round trip per
                //      treasury, no scanning. Covers the typical "new user got
                //      seeded by pixa.team" case in one shot.
                //
                //   2. Global scan (slow, exhaustive) — list_vesting_delegations
                //      paginated by [delegator, delegatee]. Capped at 5 pages of
                //      1000 rows. Only useful on a young chain; on a populated
                //      chain it almost certainly won't reach the right rows.
                if (incomingDelegations.length === 0 && receivedVests > 0
                    && api.database && typeof api.database.findVestingDelegations === 'function') {
                    try {
                        const treasuryAccounts = this._SPECIAL_POWER_ACCOUNTS || [];
                        const found = [];
                        for (const treasury of treasuryAccounts) {
                            if (treasury === account.username) continue;
                            const rows = await api.database.findVestingDelegations(treasury);
                            if (!Array.isArray(rows)) continue;
                            for (const row of rows) {
                                if (row && row.delegatee === account.username) {
                                    const v = _assetToVests(row.vesting_shares);
                                    if (v > 0) {
                                        found.push({
                                            delegator: row.delegator,
                                            delegatee: row.delegatee,
                                            pxp: vestToPixa(v),
                                        });
                                    }
                                }
                            }
                        }
                        if (found.length > 0) incomingDelegations = found;
                    } catch (e) { /* ignore — best effort */ }
                }

                // Final fallback: global scan if everything else missed.
                // NOTE: list_vesting_delegations is on the DatabaseAPI (it's a
                // database_api.* method), not the AccountsAPI.
                if (incomingDelegations.length === 0 && receivedVests > 0
                    && api.database && typeof api.database.listVestingDelegations === 'function') {
                    try {
                        // The chain rejects empty strings here with
                        // "Assert Exception: delegator != nullptr" — the start
                        // tuple expects nulls for "before any account" positions,
                        // not empty strings. After the first page the cursor is
                        // [last.delegator, last.delegatee], both real names.
                        let start = [null, null];
                        const PAGE = 1000;
                        const MAX_PAGES = 5;
                        const found = [];
                        for (let page = 0; page < MAX_PAGES; page++) {
                            const rows = await api.database.listVestingDelegations({
                                start, limit: PAGE, order: 'by_delegation'
                            });
                            if (!Array.isArray(rows) || rows.length === 0) break;
                            for (const row of rows) {
                                if (row && row.delegatee === account.username) {
                                    const v = _assetToVests(row.vesting_shares);
                                    if (v > 0) {
                                        found.push({
                                            delegator: row.delegator,
                                            delegatee: row.delegatee,
                                            pxp: vestToPixa(v),
                                        });
                                    }
                                }
                            }
                            if (rows.length < PAGE) break;
                            const last = rows[rows.length - 1];
                            // by_delegation is keyed on [delegator, delegatee]
                            start = [last.delegator, last.delegatee];
                        }
                        if (found.length > 0) incomingDelegations = found;
                    } catch (e) { /* ignore — best effort */ }
                }

                // Build wallet transaction list (already filtered by bitmask)
                history = rawHistory
                    .map(([idx, entry]) => {
                        const { name, payload } = _normalizeOp(entry.op);
                        return {
                            idx,
                            type: name,
                            data: payload,
                            timestamp: entry.timestamp,
                        };
                    })
                    .reverse();
            } catch (e) { /* ignore */ }

            // Fetch profile images for delegation + recurrent-transfer accounts
            try {
                const profileUsernames = [
                    ...outgoingDelegations.map(d => d.delegatee),
                    ...incomingDelegations.map(d => d.delegator),
                    ...recurrentTransfers.map(r => r.to),
                ].filter((v, i, a) => v && a.indexOf(v) === i); // unique
                if (profileUsernames.length > 0) {
                    const profiles = await api.accounts.getAccounts(profileUsernames, true);
                    const profileMap = {};
                    for (const p of (profiles || [])) {
                        const u = p.username || p.name;
                        if (u) profileMap[u] = (p._profile && p._profile.profile_image) || '';
                    }
                    outgoingDelegations = outgoingDelegations.map(d => ({ ...d, image: profileMap[d.delegatee] || '' }));
                    incomingDelegations = incomingDelegations.map(d => ({ ...d, image: profileMap[d.delegator] || '' }));
                    recurrentTransfers = recurrentTransfers.map(r => ({ ...r, image: profileMap[r.to] || '' }));
                }
            } catch (e) { /* ignore */ }

            // Recompute delegated/received PXP from live delegation list and
            // reconcile against the account-object totals. Either source can
            // miss data: the breakdown lists can be empty (fetch failed, node
            // doesn't index something) and the account object can lag by a
            // block. We take Math.max so:
            //   • the headline "+received - delegated" matches the chain when
            //     the breakdown is short, and
            //   • optimistic post-broadcast updates aren't reverted by a stale
            //     account object snapshot.
            const liveDelegatedPxpFromBreakdown = outgoingDelegations.reduce((sum, d) => sum + (d.pxp || 0), 0);
            const liveReceivedPxpFromBreakdown = incomingDelegations.reduce((sum, d) => sum + (d.pxp || 0), 0);
            const liveDelegatedPxp = Math.max(delegatedPxp, liveDelegatedPxpFromBreakdown);
            const liveReceivedPxp = Math.max(receivedPxp, liveReceivedPxpFromBreakdown);
            // Effective PXP (voting power, USD valuation): own + received - delegated.
            const livePxpBalance = ownPxp - liveDelegatedPxp + liveReceivedPxp;
            // Power-down eligibility, delegate-out eligibility, and direct PXP
            // transfer eligibility all depend on the *owned, undelegated* stake
            // — you cannot power down delegated-in PXP, and you cannot delegate
            // or transfer more than (own − already-delegated-out).
            const powerDownablePxp = Math.max(0, ownPxp - liveDelegatedPxp);
            // PXP is already in PXA-equivalent terms
            const livePxpInPixa = livePxpBalance;
            const livePxpUsd = livePxpInPixa * pixaUsdPrice;
            // Headline total: cleanly-owned, spendable value only — NOT
            // livePxpUsd + pixaUsdWithPending + pxsUsdWithPending (those carry
            // delegated-in PXP and savings, which are shown but not totalled).
            // ownPxp keeps your owned stake (delegated-out is still yours);
            // delegated-in never enters. PXA/PXS = liquid + pending (in-flight
            // funds on their way to spendable); savings excluded.
            const liveTotalUsd = ownPxp * pixaUsdPrice
                + (pixaBalance + pendingPixa) * pixaUsdPrice
                + (pxsBalance  + pendingPxs)  * pxsUsdPrice;

            this.setState({
                _fullAccount: fullAccount,
                _globalProps: globalProps,
                _vestToPixa: vestToPixa,
                _pixaToVest: pixaToVest,
                _pixaBalance: pixaBalance,
                _pxsBalance: pxsBalance,
                _pxpBalance: livePxpBalance,
                _pxpInPixa: livePxpInPixa,
                _ownPxp: ownPxp,
                _delegatedPxp: liveDelegatedPxp,
                _receivedPxp: liveReceivedPxp,
                _powerDownablePxp: powerDownablePxp,
                _rewardPixa: rewardPixa,
                _rewardPxs: rewardPxs,
                _rewardPxp: rewardPxp,
                _rewardPxpInPixa: rewardPxpInPixa,
                _rewardPixaRaw: fullAccount.reward_pixa_balance || `0.000 ${LIQUID_SYMBOL}`,
                _rewardPxsRaw: fullAccount.reward_pxs_balance || `0.000 ${DOLLAR_SYMBOL}`,
                _rewardVestsRaw: fullAccount.reward_vesting_balance || `0.000000 ${VESTS_SYMBOL}`,
                _isPoweringDown: isPoweringDown,
                _nextPowerDown: nextPowerDown,
                _nextWithdrawalDate: nextWithdrawalDate,
                _toWithdraw: toWithdraw,
                _withdrawn: withdrawn,
                _pixaUsdPrice: pixaUsdPrice,
                _pxsUsdPrice: pxsUsdPrice,
                _pxpUsd: livePxpUsd,
                _pixaUsd: pixaUsdWithPending,
                _pxsUsd: pxsUsdWithPending,
                _totalUsd: liveTotalUsd,
                _outgoingDelegations: outgoingDelegations,
                _incomingDelegations: incomingDelegations,
                _savingsPixa: savingsPixa,
                _savingsPxs: savingsPxs,
                _savingsWithdrawals: savingsWithdrawals,
                _recurrentTransfers: recurrentTransfers,
                _pendingConversions: pendingConversions,
                _pendingCollateralizedConversions: pendingCollateralizedConversions,
                _pendingPixa: pendingPixa,
                _pendingPxs: pendingPxs,
                _walletHistory: history,
                _walletLoaded: true,
                _LIQUID_SYMBOL: LIQUID_SYMBOL,
                _DOLLAR_SYMBOL: DOLLAR_SYMBOL,
                _VESTS_SYMBOL: VESTS_SYMBOL,
            }, () => {
                this.forceUpdate();
            });
        } catch (err) {
            console.warn('[PixaWalletDialog] _fetch_wallet_data error:', err);
        }
    };

    /**
     * Open confirmation dialog for self-to-self operations
     */
    _open_confirm_action = (title, body, callback) => {
        this.setState({ _confirm_action_open: true, _confirm_action_title: title, _confirm_action_body: body, _confirm_action_callback: callback }, () => this.forceUpdate());
    };

    _close_confirm_action = () => {
        this.setState({ _confirm_action_open: false, _confirm_action_title: '', _confirm_action_body: '', _confirm_action_callback: null }, () => this.forceUpdate());
    };

    _execute_confirm_action = async () => {
        const cb = this.state._confirm_action_callback;
        this._close_confirm_action();
        if (typeof cb === 'function') await cb();
    };

    /**
     * Cancel an active power down by withdrawing 0 PXP
     */
    _handle_cancel_power_down = () => {
        this._open_confirm_action(
            t("components.pixa_wallet_dialog.cancel_power_down"),
            t("components.pixa_wallet_dialog.are_you_sure_you_want_to_cancel"),
            async () => {
                const { api, account, _VESTS_SYMBOL } = this.state;
                if (!api || !account) return;
                try {
                    const formatted = api.formatter.formatAsset(0, _VESTS_SYMBOL, 6);
                    await api.broadcast.withdrawVesting(account.username, formatted);
                    if (actions?.trigger_snackbar) actions.trigger_snackbar(t("components.pixa_wallet_dialog.power_down_cancelled_successfully"), 'success');
                    // Optimistic update — immediately reflect in UI before chain confirms
                    this.setState({
                        _isPoweringDown: false,
                        _nextPowerDown: 0,
                        _toWithdraw: 0,
                        _withdrawn: 0,
                    }, () => this.forceUpdate());
                    this._refresh_after_tx();
                } catch (err) {
                    console.warn('[PixaWalletDialog] cancel power down error:', err);
                    if (actions?.trigger_snackbar) actions.trigger_snackbar(t("components.pixa_wallet_dialog.failed_to_cancel_power_down", {
                        message: (err.message || t("components.pixa_wallet_dialog.unknown_error"))
                    }), 'error');
                }
            }
        );
    };

    /**
     * Claim pending rewards via the broadcast API
     */
    _claim_rewards = async () => {
        const { api, account, _fullAccount, _rewardPixa, _rewardPxs, _LIQUID_SYMBOL, _DOLLAR_SYMBOL, _VESTS_SYMBOL } = this.state;
        if (!api || !account || !_fullAccount) return;
        try {
            // Reconstruct asset strings via formatter to guarantee safe_asset format.
            // For vesting: use the raw numerical value from reward_vesting_balance
            // (this is the VESTS amount, labelled PXP by the sanitiser — the broadcast
            //  API translates PXP→VESTS before sending to the chain).
            const rawVestsAmount = parseFloat(_fullAccount.reward_vesting_balance) || 0;
            await api.broadcast.claimRewardBalance(account.username);
            if (actions?.trigger_snackbar) actions.trigger_snackbar(t("components.pixa_wallet_dialog.rewards_claimed_successfully"), 'success');
            // Refresh data after claim
            this._refresh_after_tx();
        } catch (err) {
            console.warn('[PixaWalletDialog] claimRewardBalance error:', err);
            if (actions?.trigger_snackbar) actions.trigger_snackbar(t("components.pixa_wallet_dialog.failed_to_claim_rewards", {
                message: (err.message || t("components.pixa_wallet_dialog.unknown_error"))
            }), 'error');
        }
    };

    /**
     * Cancel an outgoing delegation — opens white confirmation dialog
     */
    _request_delete_delegation = (delegatee) => {
        this._open_confirm_action(
            t("components.pixa_wallet_dialog.cancel_delegation"),
            t("components.pixa_wallet_dialog.are_you_sure_you_want_to_cancel_2", { delegatee }),
            async () => {
                const { api, account, _VESTS_SYMBOL } = this.state;
                if (!api || !account) return;
                try {
                    await api.broadcast.delegateVestingShares(
                        account.username,
                        delegatee,
                        `0.000000 ${_VESTS_SYMBOL}`
                    );
                    if (actions?.trigger_snackbar) actions.trigger_snackbar(t("components.pixa_wallet_dialog.delegation_cancelled_successfully"), 'success');
                    // Optimistic update — remove from outgoing list immediately
                    this.setState((prev) => {
                        const updated = (prev._outgoingDelegations || []).filter(d => d.delegatee !== delegatee);
                        const newDelegatedPxp = updated.reduce((sum, d) => sum + (d.pxp || 0), 0);
                        return {
                            _outgoingDelegations: updated,
                            _delegatedPxp: newDelegatedPxp,
                            _pxpBalance: (prev._ownPxp || 0) - newDelegatedPxp + (prev._receivedPxp || 0),
                            _powerDownablePxp: Math.max(0, (prev._ownPxp || 0) - newDelegatedPxp),
                        };
                    }, () => this.forceUpdate());
                    this._refresh_after_tx();
                } catch (err) {
                    console.warn('[PixaWalletDialog] cancel delegation error:', err);
                    if (actions?.trigger_snackbar) actions.trigger_snackbar(t("components.pixa_wallet_dialog.failed_to_cancel_delegation", {
                        message: (err.message || t("components.pixa_wallet_dialog.unknown_error"))
                    }), 'error');
                }
            }
        );
    };

    /**
     * Handle confirmed power-up or power-down from PixaWalletPowerDialog
     */
    _handle_power_confirm = async (username, amount) => {
        const { api, account, _power_dialog_opened, _LIQUID_SYMBOL, _VESTS_SYMBOL, _pixaToVest } = this.state;
        if (!api || !account) return;

        const type = (_power_dialog_opened || '').toUpperCase();
        const title = type === 'POWER-UP' ? t("words.power_up") : t("words.power_down");
        const body = type === 'POWER-UP'
            ? t("components.pixa_wallet_dialog.are_you_sure_you_want_to_power", {
                amount: amount.toFixed(3)
            })
            : t("components.pixa_wallet_dialog.are_you_sure_you_want_to_power_2", {
                amount: amount.toFixed(2)
            });

        this._close_power_dialog();
        this._open_confirm_action(title, body, async () => {
            try {
                if (type === 'POWER-UP') {
                    const formatted = api.formatter.formatAsset(amount, _LIQUID_SYMBOL, 3);
                    await api.broadcast.transferToVesting(account.username, account.username, formatted);
                    if (actions?.trigger_snackbar) actions.trigger_snackbar(t("components.pixa_wallet_dialog.powered_up_pxa_successfully", {
                        amount: amount.toFixed(3)
                    }), 'success');
                    // Optimistic update — PXP is stored as PXA-equivalent, so +amount is dimensionally correct.
                    // The authoritative values come from _refresh_after_tx() below; this just avoids a
                    // visible "both balances unchanged" flicker between broadcast ack and refresh.
                    this.setState((prev) => {
                        const nextPixa = Math.max(0, (prev._pixaBalance || 0) - amount);
                        const nextOwnPxp = (prev._ownPxp || 0) + amount;
                        const nextPxp = (prev._pxpBalance || 0) + amount;
                        const nextPowerDownable = Math.max(0, nextOwnPxp - (prev._delegatedPxp || 0));
                        const pxa$ = prev._pixaUsdPrice || 0;
                        const pxs$ = prev._pxsUsdPrice  || 0;
                        // Per-token valuations stay full-holdings (liquid +
                        // savings + in-flight) so the cards, gauge and "% of
                        // wealth" line keep matching the refreshed values.
                        const pixaUsd = (nextPixa + (prev._savingsPixa || 0) + (prev._pendingPixa || 0)) * pxa$;
                        const pxpUsd  = nextPxp  * pxa$;  // PXP denominated in PXA (effective)
                        const pxsUsd  = ((prev._pxsBalance || 0) + (prev._savingsPxs || 0) + (prev._pendingPxs || 0)) * pxs$;
                        // Headline total uses the same cleanly-owned basis as the
                        // load path: owned PXP (nextOwnPxp, not effective nextPxp),
                        // plus liquid + pending PXA/PXS, savings excluded. Power-up
                        // just moves liquid PXA into owned PXP 1:1 (PXA terms), so
                        // this figure stays stable through the optimistic preview.
                        const headlineUsd = nextOwnPxp * pxa$
                            + (nextPixa + (prev._pendingPixa || 0)) * pxa$
                            + ((prev._pxsBalance || 0) + (prev._pendingPxs || 0)) * pxs$;
                        return {
                            _pixaBalance: nextPixa,
                            _pxpBalance: nextPxp,
                            _ownPxp: nextOwnPxp,
                            _powerDownablePxp: nextPowerDownable,
                            _pxpInPixa: nextPxp,
                            _pixaUsd: pixaUsd,
                            _pxpUsd: pxpUsd,
                            _pxsUsd: pxsUsd,
                            _totalUsd: headlineUsd,
                        };
                    }, () => this.forceUpdate());
                } else if (type === 'POWER-DOWN') {
                    // Convert PXP (PXA-equivalent) back to raw VESTS for the chain.
                    // Use toFixed(6) string to avoid float precision loss on very large VESTS values.
                    const vestsAmount = _pixaToVest(amount);
                    const formatted = api.formatter.formatAsset(vestsAmount, _VESTS_SYMBOL, 6);
                    await api.broadcast.withdrawVesting(account.username, formatted);
                    if (actions?.trigger_snackbar) actions.trigger_snackbar(t("components.pixa_wallet_dialog.power_down_of_pxp_started", {
                        amount: amount.toFixed(2)
                    }), 'success');
                    // Optimistic update — mark as powering down. Balances don't change until the first
                    // weekly payout fills, so we only flip the state flag + next-payout estimate.
                    this.setState({
                        _isPoweringDown: true,
                        _nextPowerDown: amount / 13,
                    }, () => this.forceUpdate());
                }
                this._refresh_after_tx();
            } catch (err) {
                console.warn('[PixaWalletDialog] power operation error:', err);
                if (actions?.trigger_snackbar) actions.trigger_snackbar(t("components.pixa_wallet_dialog.power_operation_failed", {
                    message: (err.message || t("components.pixa_wallet_dialog.unknown_error"))
                }), 'error');
            }
        });
    };

    /**
     * Handle confirmed send (transfer) from PixaWalletSendDialog
     */
    _handle_send_confirm = async (to, amount, currency, memo, recurrentOpts = null) => {
        const { api, account, _LIQUID_SYMBOL, _DOLLAR_SYMBOL, _itsOwnProfile } = this.state;
        if (!api || !account) return;

        // When viewing another user's wallet, resolve the logged-in user from the API.
        // getActiveAccount() returns a username string (not an object).
        let senderUsername;
        if (_itsOwnProfile) {
            senderUsername = account.username;
        } else {
            try {
                const activeAcc = await api.getActiveAccount();
                senderUsername = typeof activeAcc === 'string' ? activeAcc : (activeAcc && (activeAcc.username || activeAcc.name));
            } catch (e) { /* fall through */ }
            if (!senderUsername) {
                if (actions?.trigger_snackbar) actions.trigger_snackbar(t("components.pixa_wallet_dialog.no_active_session_please_log_in_first"), 'error');
                return;
            }
        }

        try {
            // currency is 'PXA' or 'PXS' from the dialog — map to actual chain symbols
            const symbol = currency === 'PXA' ? _LIQUID_SYMBOL : _DOLLAR_SYMBOL;
            const formatted = api.formatter.formatAsset(amount, symbol, 3);

            if (recurrentOpts && Number(recurrentOpts.executions) > 0 && Number(recurrentOpts.recurrence) > 0) {
                // Recurring transfer: the same amount every `recurrence` hours,
                // repeated `executions` times. The chain fires the first transfer
                // immediately and the rest on the schedule (executions: 0 cancels
                // an existing schedule to the same recipient).
                await api.broadcast.recurrentTransfer({
                    from: senderUsername,
                    to,
                    amount: formatted,
                    memo: memo || '',
                    recurrence: Number(recurrentOpts.recurrence),
                    executions: Number(recurrentOpts.executions),
                });
                if (actions?.trigger_snackbar) {
                    actions.trigger_snackbar(t("components.pixa_wallet_dialog.scheduled_to_every_h", {
                        amount: amount.toFixed(3),
                        currency: currency,
                        to: to,
                        Number: Number(recurrentOpts.recurrence),
                        Number_2: Number(recurrentOpts.executions)
                    }), 'success');
                }
            } else {
                await api.broadcast.transfer(senderUsername, to, formatted, memo || '');
                if (actions?.trigger_snackbar) actions.trigger_snackbar(t("components.pixa_wallet_dialog.transferred_to", {
                    amount: amount.toFixed(3),
                    currency: currency,
                    to: to
                }), 'success');
            }
            this._close_send_dialog();
            this._refresh_after_tx();
            return true;
        } catch (err) {
            console.warn('[PixaWalletDialog] transfer error:', err);
            throw err;
        }
    };

    /**
     * Handle confirmed swap from PixaWalletSwapDialog
     */
    _handle_swap_confirm = async (amount, currency) => {
        const { api, account, _LIQUID_SYMBOL, _DOLLAR_SYMBOL } = this.state;
        if (!api || !account) return;

        const otherCurrency = currency === 'PXA' ? 'PXS' : 'PXA';
        const title = t("components.pixa_wallet_dialog.swap");
        // PXA → PXS is instant (collateralized_convert); PXS → PXA settles over
        // a ~3.5 day conversion window (convert). Surface that in the copy.
        const body = currency === 'PXA'
            ? t("components.pixa_wallet_dialog.are_you_sure_you_want_to_swap", {
                amount: amount.toFixed(3)
            })
            : t("components.pixa_wallet_dialog.are_you_sure_you_want_to_swap_2", {
                amount: amount.toFixed(3)
            });

        this._close_swap_dialog();
        this._open_confirm_action(title, body, async () => {
            try {
                if (currency === 'PXA') {
                    // Instant PXA → PXS. collateralized_convert locks PXA as
                    // collateral and immediately credits PXS at the current feed
                    // price (excess collateral is returned when the request later
                    // settles). The `amount` is the PXA collateral, so format with
                    // the liquid symbol.
                    //
                    // (Previously this path created a limit_order_create — an
                    //  open order that only fills when a counterparty matches it,
                    //  which is why "swap PXA → PXS" never completed instantly.)
                    const formatted = api.formatter.formatAsset(amount, _LIQUID_SYMBOL, 3);
                    await api.broadcast.collateralizedConvert(account.username, formatted, Math.floor(Date.now() / 1000));
                } else {
                    // PXS → PXA via the standard convert op (~3.5 day settlement).
                    // The `amount` is in PXS, so format with the dollar symbol.
                    const formatted = api.formatter.formatAsset(amount, _DOLLAR_SYMBOL, 3);
                    await api.broadcast.convertPixa(account.username, formatted, Math.floor(Date.now() / 1000));
                }
                const successMsg = currency === 'PXA'
                    ? t("components.pixa_wallet_dialog.swapped_pxa_pxs", {
                        amount: amount.toFixed(3)
                    })
                    : t("components.pixa_wallet_dialog.swap_of_pxs_started_pxa_arrives_in", {
                        amount: amount.toFixed(3)
                    });
                if (actions?.trigger_snackbar) actions.trigger_snackbar(successMsg, 'success');
                this._refresh_after_tx();
            } catch (err) {
                console.warn('[PixaWalletDialog] swap error:', err);
                if (actions?.trigger_snackbar) actions.trigger_snackbar(t("components.pixa_wallet_dialog.swap_failed", {
                    message: (err.message || t("components.pixa_wallet_dialog.unknown_error"))
                }), 'error');
            }
        });
    };

    _recompute_chart = () => {
        const n = this.state._selectedRange;
        this.setState({_chartLoading: true}, () => {
            this.forceUpdate(() => {
                fetch(`https://api.coingecko.com/api/v3/coins/hive/market_chart?vs_currency=usd&days=${n}&precision=4`)
                    .then(res => res.json())
                    .then(data => {
                        const _data = formatPriceChartData(data.prices, n <= 1 ? "D": n <= 7 ? "W": n <= 31 ? "M": n <= 365 ? "Y": "C");
                        this.setState({_data, _chartLoading: false}, () => {
                            this.forceUpdate();
                        });
                    });
            });
        });
    };

    _set_selected_range = (days) => {
        this.setState({_selectedRange: days}, () => {
            this._recompute_chart();
        });
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this._computeSize);
        if (this._unsub_settings) { this._unsub_settings(); this._unsub_settings = null; }
        if (this._refreshTimer) clearTimeout(this._refreshTimer);
        if (this._refreshTimer2) clearTimeout(this._refreshTimer2);
        if (this._tour_timer) { clearTimeout(this._tour_timer); this._tour_timer = null; }
        if (this.state._tour_steps) writeTourState({ wallet: true });
        if (this._detailRef) {
            this._detailRef.removeEventListener('touchstart', this._nativeTouchStart, true);
            this._detailRef.removeEventListener('touchmove', this._nativeTouchMove, true);
        }
    }

    _computeSize = () => {
        const mobile = (window.innerWidth || document.documentElement.clientWidth || (document.body || document.getElementsByTagName('body')[0]).clientWidth) <= 960;
        if (this.state._view_right_mobile_enabled !== mobile) {
            this.setState({_view_right_mobile_enabled: mobile}, () => { this._compute_tab_margin(); });
        }
    };

    /**
     * Find the nearest scrollable ancestor of an element.
     */
    _findScrollParent = (el) => {
        let node = el;
        while (node && node !== document.body) {
            const { overflow, overflowY } = window.getComputedStyle(node);
            if (/auto|scroll|overlay/.test(overflow + overflowY) && node.scrollHeight > node.clientHeight) {
                return node;
            }
            node = node.parentElement;
        }
        return null;
    };

    /**
     * Ref callback for the detail content wrapper on mobile.
     * Attaches native touch event listeners that intercept vertical gestures
     * to prevent the outer y-axis SwipeableViews from stealing scroll events.
     *
     * Rules:
     *  - If content scroll is NOT at top → block propagation (native scroll handles it)
     *  - If content scroll IS at top AND finger moves DOWN (pull toward overview) → allow
     *  - If content scroll IS at top AND finger moves UP (scroll down) → block propagation
     */
    _setDetailRef = (el) => {
        // Cleanup previous
        if (this._detailRef && this._detailRef !== el) {
            this._detailRef.removeEventListener('touchstart', this._nativeTouchStart, true);
            this._detailRef.removeEventListener('touchmove', this._nativeTouchMove, true);
        }
        this._detailRef = el;
        if (!el) return;

        this._nativeTouchStart = (e) => {
            if (!e.touches || !e.touches[0]) return;
            this._touchStartX = e.touches[0].clientX;
            this._touchStartY = e.touches[0].clientY;
            this._gestureDecided = false;
            this._detailScrollEl = this._findScrollParent(e.target);
        };

        this._nativeTouchMove = (e) => {
            if (!e.touches || !e.touches[0]) return;
            const deltaX = e.touches[0].clientX - this._touchStartX;
            const deltaY = e.touches[0].clientY - this._touchStartY;
            const absX = Math.abs(deltaX);
            const absY = Math.abs(deltaY);

            // Wait for enough movement to decide direction (5px threshold)
            if (!this._gestureDecided && absX < 5 && absY < 5) return;

            // Horizontal gesture → let it through for inner horizontal SwipeableViews
            if (!this._gestureDecided) {
                this._gestureIsHorizontal = absX > absY;
                this._gestureDecided = true;
            }

            if (this._gestureIsHorizontal) return; // don't interfere

            // Vertical gesture — check scroll position
            const scrollEl = this._detailScrollEl;
            const scrollTop = scrollEl ? scrollEl.scrollTop : 0;
            const atTop = scrollTop <= SCROLL_EDGE_THRESHOLD;

            // Only let the outer y-axis SwipeableViews see it if at very top AND pulling down
            if (!atTop || deltaY <= 0) {
                e.stopPropagation();
            }
        };

        el.addEventListener('touchstart', this._nativeTouchStart, { capture: true, passive: true });
        el.addEventListener('touchmove', this._nativeTouchMove, { capture: true, passive: true });
    };

    _handle_tab_value_change = (event, value) => {
        if(this.state._tab_value !== value) {
            this.setState({
                _tab_value: value,
            }, () => {
                this.forceUpdate();
                if (typeof this.props.onViewChange === 'function') {
                    this.props.onViewChange(value);
                }
            })
        }
    };

    // ── First-open tour ─────────────────────────────────────────────────────
    // Armed when the wallet opens for the first time (per localStorage). The
    // short delay lets the entrance Fades and SwipeableViews settle so the
    // anchors measure at their real positions.
    _tour_timer = null;

    _maybe_start_tour = () => {
        if (this.state._tour_steps) return;
        if (readTourState().wallet) return;
        if (this._tour_timer) clearTimeout(this._tour_timer);
        this._tour_timer = setTimeout(() => {
            this._tour_timer = null;
            if (!this.state.open) return;
            if (readTourState().wallet) return;
            this.setState({ _tour_steps: this._build_tour_steps() });
        }, 700);
    };

    // Completing, skipping, or closing the wallet mid-tour all mark it seen;
    // finishing inside the wallet also walks the user back to the main view.
    _finish_tour = (reason) => {
        writeTourState({ wallet: true });
        if (this._tour_timer) { clearTimeout(this._tour_timer); this._tour_timer = null; }
        if (this.state._tour_steps) this.setState({ _tour_steps: null });
        if (reason !== "closed") this._handle_tab_value_change({}, false);
    };

    // Views in user order: main (overview), PXP, PXA, PXS, history. Each step
    // switches the real view through _handle_tab_value_change, so the URL sync
    // via onViewChange behaves exactly as if the user tapped the tab.
    //
    // Copy resolves here rather than in a module constant, so it is read from
    // whichever locale bundle is live when the wallet actually opens. The three
    // token titles interpolate the tab's OWN label key instead of restating it,
    // so a tooltip can never name a tab something the tab doesn't call itself;
    // the ticker parentheses stay inside the translated string because ja/zh
    // use full-width （） here.
    _build_tour_steps = () => {
        const sidePlacement = this.state._view_right_mobile_enabled ? "bottom" : "right";
        const go = (value) => () => this._handle_tab_value_change({}, value);
        return [
            {
                target: '[data-tour="wallet-total"]',
                title: t("components.tour.main_view"),
                content: t("components.tour.your_estimated_wealth_everything_the_account_holds"),
                onEnter: go(false),
            },
            {
                target: '[data-tour="wallet-tabs"] .MuiTab-root:nth-child(1)',
                placement: sidePlacement,
                title: t("components.tour.pxp", { label: t("components.pixa_wallet_dialog.power") }),
                content: t("components.tour.pixa_power_is_staked_pxa_it_drives"),
                onEnter: go(0),
            },
            {
                target: '[data-tour="wallet-tabs"] .MuiTab-root:nth-child(2)',
                placement: sidePlacement,
                title: t("components.tour.pxa", { label: t("components.pixa_wallet_dialog.pixa") }),
                content: t("components.tour.the_liquid_token_send_it_swap_it"),
                onEnter: go(1),
            },
            {
                target: '[data-tour="wallet-tabs"] .MuiTab-root:nth-child(3)',
                placement: sidePlacement,
                title: t("components.tour.pxs", { label: t("components.pixa_wallet_dialog.supra") }),
                content: t("components.tour.the_purchasing_power_token_oriented_toward_the"),
                onEnter: go(2),
            },
            {
                target: '[data-tour="wallet-tabs"] .MuiTab-root:nth-child(4)',
                placement: sidePlacement,
                title: t("words.history"),
                content: t("components.tour.every_confirmed_on_chain_transaction_for_this"),
                onEnter: go(3),
            },
        ];
    };

    _open_author = (username) => {
        this.state._history.push("/@"+username);
    }

    _open_power_dialog = (type = "power-down") => {
        this.setState({_power_dialog_opened: type}, () => { this.forceUpdate(); });
    }
    _close_power_dialog = () => {
        this.setState({_power_dialog_opened: ""}, () => { this.forceUpdate(); });
    }

    _open_send_dialog = (type = "SUPRA") => {
        this.setState({_send_dialog_opened: type}, () => { this.forceUpdate(); });
    }
    _close_send_dialog = () => {
        this.setState({_send_dialog_opened: ""}, () => { this.forceUpdate(); });
    }

    _open_swap_dialog = (type = "SUPRA") => {
        this.setState({_swap_dialog_opened: type}, () => { this.forceUpdate(); });
    }
    _close_swap_dialog = () => {
        this.setState({_swap_dialog_opened: ""}, () => { this.forceUpdate(); });
    }

    _open_savings_dialog = (type = "PIXA", mode = "deposit") => {
        this.setState({_savings_dialog_opened: type, _savings_dialog_mode: mode}, () => { this.forceUpdate(); });
    }
    _close_savings_dialog = () => {
        this.setState({_savings_dialog_opened: ""}, () => { this.forceUpdate(); });
    }

    /**
     * Toggle the collapsed/expanded state of a wallet sub-section by id
     * (e.g. "savings:PXA", "recurrent:PXS", "pendingswap").
     */
    _toggle_section = (id) => {
        this.setState((prev) => {
            const next = { ...(prev._expandedSections || {}) };
            next[id] = !next[id];
            return { _expandedSections: next };
        }, () => { this.forceUpdate(); });
    }

    _is_section_expanded = (id) => !!(this.state._expandedSections || {})[id];

    /**
     * Handle a confirmed savings deposit / withdrawal from PixaWalletSavingsDialog.
     * Deposits are instant; withdrawals initiate a 3-day release. Savings are
     * personal here (from === to === the wallet owner).
     */
    _handle_savings_confirm = async (mode, amount, currency) => {
        const { api, account, _LIQUID_SYMBOL, _DOLLAR_SYMBOL } = this.state;
        if (!api || !account) return;

        const symbol = currency === 'PXA' ? _LIQUID_SYMBOL : _DOLLAR_SYMBOL;
        const isDeposit = mode === 'deposit';
        const title = isDeposit ? t("words.deposit_to_savings") : t("words.withdraw_from_savings");
        const body = isDeposit
            ? t("components.pixa_wallet_dialog.move_into_savings_you_can_take_it", {
                amount: amount.toFixed(3),
                currency: currency
            })
            : t(
                "components.pixa_wallet_dialog.withdraw_from_savings_the_funds_arrive_after",
                {
                    amount: amount.toFixed(3),
                    currency: currency
                }
            );

        this._close_savings_dialog();
        this._open_confirm_action(title, body, async () => {
            try {
                const formatted = api.formatter.formatAsset(amount, symbol, 3);
                if (isDeposit) {
                    await api.broadcast.transferToSavings(account.username, account.username, formatted, '');
                    if (actions?.trigger_snackbar) actions.trigger_snackbar(t("components.pixa_wallet_dialog.deposited_to_savings", {
                        amount: amount.toFixed(3),
                        currency: currency
                    }), 'success');
                } else {
                    await api.broadcast.transferFromSavings(
                        account.username,
                        Math.floor(Date.now() / 1000),
                        account.username,
                        formatted,
                        ''
                    );
                    if (actions?.trigger_snackbar) actions.trigger_snackbar(t("components.pixa_wallet_dialog.withdrawal_of_started_arrives_in_3_days", {
                        amount: amount.toFixed(3),
                        currency: currency
                    }), 'success');
                }
                this._refresh_after_tx();
            } catch (err) {
                console.warn('[PixaWalletDialog] savings operation error:', err);
                if (actions?.trigger_snackbar) actions.trigger_snackbar(t("components.pixa_wallet_dialog.savings_operation_failed", {
                    message: (err.message || t("components.pixa_wallet_dialog.unknown_error"))
                }), 'error');
            }
        });
    };

    /**
     * Cancel a pending savings withdrawal (cancel_transfer_from_savings).
     */
    _request_cancel_savings_withdrawal = (entry) => {
        this._open_confirm_action(
            t("components.pixa_wallet_dialog.cancel_savings_withdrawal"),
            t("components.pixa_wallet_dialog.cancel_the_pending_withdrawal_of_the", { amount: entry.amount }),
            async () => {
                const { api, account } = this.state;
                if (!api || !account) return;
                try {
                    await api.broadcast.cancelTransferFromSavings(account.username, entry.request_id);
                    if (actions?.trigger_snackbar) actions.trigger_snackbar(t("words.savings_withdrawal_cancelled"), 'success');
                    // Optimistic removal — drop it from the pending list immediately.
                    this.setState((prev) => ({
                        _savingsWithdrawals: (prev._savingsWithdrawals || []).filter(w => w.request_id !== entry.request_id),
                    }), () => this.forceUpdate());
                    this._refresh_after_tx();
                } catch (err) {
                    console.warn('[PixaWalletDialog] cancel savings withdrawal error:', err);
                    if (actions?.trigger_snackbar) actions.trigger_snackbar(t("components.pixa_wallet_dialog.failed_to_cancel_withdrawal", {
                        message: (err.message || t("components.pixa_wallet_dialog.unknown_error"))
                    }), 'error');
                }
            }
        );
    };

    /**
     * Cancel an outgoing recurrent transfer by re-broadcasting it with
     * executions: 0 — the chain's documented cancellation path.
     */
    _request_cancel_recurrent_transfer = (entry) => {
        this._open_confirm_action(
            t("components.pixa_wallet_dialog.cancel_recurring_transfer"),
            t("components.pixa_wallet_dialog.stop_the_recurring_transfer_of_to", { amount: entry.amount, to: entry.to }),
            async () => {
                const { api, account, _LIQUID_SYMBOL, _DOLLAR_SYMBOL } = this.state;
                if (!api || !account) return;
                try {
                    const symbol = entry.currency === 'PXS' ? _DOLLAR_SYMBOL : _LIQUID_SYMBOL;
                    const formatted = api.formatter.formatAsset(entry.amount_num, symbol, 3);
                    await api.broadcast.recurrentTransfer({
                        from: account.username,
                        to: entry.to,
                        amount: formatted,
                        memo: entry.memo || '',
                        recurrence: entry.recurrence || 24,
                        executions: 0,
                    });
                    if (actions?.trigger_snackbar) actions.trigger_snackbar(t("components.pixa_wallet_dialog.recurring_transfer_to_cancelled", {
                        to: entry.to
                    }), 'success');
                    // Optimistic removal.
                    this.setState((prev) => ({
                        _recurrentTransfers: (prev._recurrentTransfers || []).filter(r => r.to !== entry.to),
                    }), () => this.forceUpdate());
                    this._refresh_after_tx();
                } catch (err) {
                    console.warn('[PixaWalletDialog] cancel recurrent transfer error:', err);
                    if (actions?.trigger_snackbar) actions.trigger_snackbar(t("components.pixa_wallet_dialog.failed_to_cancel_recurring_transfer", {
                        message: (err.message || t("components.pixa_wallet_dialog.unknown_error"))
                    }), 'error');
                }
            }
        );
    };

    _open_supra_info_dialog = () => {
        this.setState({_supra_info_dialog_opened: true}, () => { this.forceUpdate(); });
    }
    _close_supra_info_dialog = () => {
        this.setState({_supra_info_dialog_opened: false}, () => { this.forceUpdate(); });
    }

    _open_power_info_dialog = () => {
        this.setState({_power_info_dialog_opened: true}, () => { this.forceUpdate(); });
    }
    _close_power_info_dialog = () => {
        this.setState({_power_info_dialog_opened: false}, () => { this.forceUpdate(); });
    }

    _open_pixa_info_dialog = () => {
        this.setState({_pixa_info_dialog_opened: true}, () => { this.forceUpdate(); });
    }
    _close_pixa_info_dialog = () => {
        this.setState({_pixa_info_dialog_opened: false}, () => { this.forceUpdate(); });
    }

    _open_taxes_dialog = () => {
        this.setState({_taxes_dialog_opened: true}, () => { this.forceUpdate(); });
    }
    _close_taxes_dialog = () => {
        this.setState({_taxes_dialog_opened: false}, () => { this.forceUpdate(); });
    }

    _open_delegate_dialog = () => {
        this.setState({_delegate_dialog_opened: true}, () => { this.forceUpdate(); });
    }
    _close_delegate_dialog = () => {
        this.setState({_delegate_dialog_opened: false}, () => { this.forceUpdate(); });
    }

    /**
     * Handle confirmed delegation from PixaWalletDelegateDialog
     */
    _handle_delegate_confirm = async (to, amount) => {
        const { api, account, _VESTS_SYMBOL, _pixaToVest, _itsOwnProfile } = this.state;
        if (!api || !account) return;

        // Resolve the broadcasting account — logged-in user when viewing another wallet.
        // getActiveAccount() returns a username string (not an object).
        let delegatorUsername;
        if (_itsOwnProfile) {
            delegatorUsername = account.username;
        } else {
            try {
                const activeAcc = await api.getActiveAccount();
                delegatorUsername = typeof activeAcc === 'string' ? activeAcc : (activeAcc && (activeAcc.username || activeAcc.name));
            } catch (e) { /* fall through */ }
            if (!delegatorUsername) {
                if (actions?.trigger_snackbar) actions.trigger_snackbar(t("components.pixa_wallet_dialog.no_active_session_please_log_in_first"), 'error');
                return;
            }
        }

        try {
            // Convert PXP (PXA-equivalent) back to raw VESTS for the chain
            const vestsAmount = _pixaToVest(amount);
            const formatted = api.formatter.formatAsset(vestsAmount, _VESTS_SYMBOL, 6);
            await api.broadcast.delegateVestingShares(delegatorUsername, to, formatted);
            if (actions?.trigger_snackbar) actions.trigger_snackbar(t("components.pixa_wallet_dialog.delegated_pxp_to", {
                amount: amount.toFixed(2),
                to: to
            }), 'success');

            // Optimistic update — immediately add to outgoing delegations list
            // so user sees the new delegation without waiting for chain confirmation.
            // Also resolve the profile image for the delegatee.
            let delegateeImage = '';
            try {
                const profiles = await api.accounts.getAccounts([to], true);
                if (profiles && profiles[0]) {
                    const p = profiles[0];
                    delegateeImage = (p._profile && p._profile.profile_image) || '';
                }
            } catch (e) { /* ignore — image will be fetched on next full refresh */ }

            this.setState((prev) => {
                const existing = (prev._outgoingDelegations || []);
                // Update existing entry or add new one
                const idx = existing.findIndex(d => d.delegatee === to);
                const newEntry = {
                    delegator: delegatorUsername,
                    delegatee: to,
                    vesting_shares: formatted,
                    pxp: amount,
                    image: delegateeImage,
                };
                const updated = idx >= 0
                    ? existing.map((d, i) => i === idx ? { ...d, ...newEntry } : d)
                    : [...existing, newEntry];
                const newDelegatedPxp = updated.reduce((sum, d) => sum + (d.pxp || 0), 0);
                return {
                    _outgoingDelegations: updated,
                    _delegatedPxp: newDelegatedPxp,
                    _pxpBalance: (prev._ownPxp || 0) - newDelegatedPxp + (prev._receivedPxp || 0),
                    _powerDownablePxp: Math.max(0, (prev._ownPxp || 0) - newDelegatedPxp),
                };
            }, () => this.forceUpdate());

            this._close_delegate_dialog();
            this._refresh_after_tx();
            return true;
        } catch (err) {
            console.warn('[PixaWalletDialog] delegation error:', err);
            if (actions?.trigger_snackbar) actions.trigger_snackbar(t("components.pixa_wallet_dialog.delegation_failed", {
                message: (err.message || t("components.pixa_wallet_dialog.unknown_error"))
            }), 'error');
            throw err;
        }
    };

    // ── Special-feature: direct PXP transfer (treasury accounts only) ──
    //
    // Allow-list of accounts permitted to broadcast a direct Pixa Power
    // transfer. Standard PXP is non-transferable on a HIVE/STEEM-style chain;
    // these accounts are treasury / multi-sig wallets that the chain (or an
    // off-chain agent listening for `pixa.power` custom_jsons) treats as
    // privileged. Keep this list small and audited.
    _SPECIAL_POWER_ACCOUNTS = ['pixa.team', 'pixa.rex'];

    _is_special_power_account = (username) => {
        if (!username) return false;
        return this._SPECIAL_POWER_ACCOUNTS.indexOf(String(username).toLowerCase()) !== -1;
    };

    _open_send_power_dialog = () => {
        this.setState({_send_power_dialog_opened: true}, () => { this.forceUpdate(); });
    }
    _close_send_power_dialog = () => {
        this.setState({_send_power_dialog_opened: false}, () => { this.forceUpdate(); });
    }

    // Feature: @initminer bulk account creation (button beside "Keys").
    _open_bulk_create_dialog = () => {
        this.setState({_bulk_create_dialog_opened: true}, () => { this.forceUpdate(); });
    }
    _close_bulk_create_dialog = () => {
        this.setState({_bulk_create_dialog_opened: false}, () => { this.forceUpdate(); });
    }

    // Feature: treasury bulk multi-sig PXP transfers (Create/Sign/Broadcast).
    _open_bulk_power_dialog = () => {
        this.setState({_bulk_power_dialog_opened: true}, () => { this.forceUpdate(); });
    }
    _close_bulk_power_dialog = () => {
        this.setState({_bulk_power_dialog_opened: false}, () => { this.forceUpdate(); });
    }

    /**
     * Handle confirmed direct PXP transfer from PixaWalletSendPowerDialog.
     *
     * Wire-format: a native `transfer` operation broadcast under *active*
     * authority. On the Pixa fork, the chain interprets a transfer whose
     * amount is denominated in VESTS as a Pixa Power transfer (the symbol
     * itself selects the semantics). Display-side we work in PXP; the API's
     * `translateAssetToChain` rewrites the symbol to VESTS before signing.
     *
     * Why `transfer` and not a custom_json envelope:
     *   - It's a first-class chain op, so it benefits from native fee/RC
     *     accounting and standard explorer indexing.
     *   - Multi-signature is handled by the account's active authority
     *     definition (threshold + key_auths/account_auths) rather than by
     *     the operation shape, so this same code path covers single-sig
     *     today and threshold multi-sig later with no UI changes.
     *
     * The chain rejects this op for non-treasury accounts; we additionally
     * gate it client-side because the dialog can in principle be opened
     * programmatically.
     */
    _handle_send_power_confirm = async (to, amount, memo) => {
        const { api, account, _VESTS_SYMBOL, _pixaToVest, _itsOwnProfile } = this.state;
        if (!api || !account) return;

        // Resolve the broadcasting (sender) account. Must be one of the
        // privileged accounts; we double-check here even though the UI button
        // is gated, because the dialog can be opened programmatically.
        let fromUsername;
        if (_itsOwnProfile) {
            fromUsername = account.username;
        } else {
            try {
                const activeAcc = await api.getActiveAccount();
                fromUsername = typeof activeAcc === 'string' ? activeAcc : (activeAcc && (activeAcc.username || activeAcc.name));
            } catch (e) { /* fall through */ }
        }

        if (!fromUsername) {
            if (actions?.trigger_snackbar) actions.trigger_snackbar(t("components.pixa_wallet_dialog.no_active_session_please_log_in_first"), 'error');
            throw new Error(t("components.pixa_wallet_dialog.no_active_session_please_log_in_first"));
        }
        if (!this._is_special_power_account(fromUsername)) {
            if (actions?.trigger_snackbar) actions.trigger_snackbar(t(
                "components.pixa_wallet_dialog.direct_pxp_transfer_is_restricted_to_treasury"
            ), 'error');
            throw new Error(t("components.pixa_wallet_dialog.direct_pxp_transfer_is_restricted_to_treasury"));
        }
        if (!to || to === fromUsername) {
            throw new Error(t("components.pixa_wallet_dialog.invalid_recipient"));
        }
        if (!(Number(amount) > 0)) {
            throw new Error(t("components.pixa_wallet_dialog.amount_must_be_greater_than_zero"));
        }

        try {
            // The dialog collects an amount in PXP (PXA-equivalent display
            // units). The chain expects raw VESTS magnitude on the transfer
            // op — VESTS is many orders of magnitude smaller than PXP, so we
            // must convert with `_pixaToVest` before formatting (same path
            // used by delegation and power-down, see _handle_delegate_confirm
            // and _handle_power_confirm).
            const vestsAmount = _pixaToVest(amount);

            // Format with the VESTS symbol directly. `_VESTS_SYMBOL` is "PXP"
            // on this fork (the display alias for VESTS); api.broadcast.transfer
            // → translateAssetToChain will rewrite the symbol to "VESTS" before
            // signing, so the on-chain op carries the raw VESTS asset string.
            const formatted = api.formatter.formatAsset(vestsAmount, _VESTS_SYMBOL, 6);

            // Note on multi-sig: when the sending account is configured with
            // a threshold > 1 active authority, the underlying signer will
            // collect partial signatures across co-signers automatically;
            // this code path stays the same. The optional `cosigners` prop
            // on the dialog is purely a UI hint.
            await api.broadcast.transfer(
                fromUsername,
                to,
                formatted,
                typeof memo === 'string' ? memo : ''
            );

            if (actions?.trigger_snackbar) {
                actions.trigger_snackbar(t("components.pixa_wallet_dialog.transferred_pxp_to", {
                    Number: Number(amount).toFixed(2),
                    to: to
                }), 'success');
            }

            this._close_send_power_dialog();
            this._refresh_after_tx();
            return true;
        } catch (err) {
            console.warn('[PixaWalletDialog] power transfer error:', err);
            if (actions?.trigger_snackbar) actions.trigger_snackbar(t("components.pixa_wallet_dialog.power_transfer_failed", {
                message: (err.message || t("components.pixa_wallet_dialog.unknown_error"))
            }), 'error');
            throw err;
        }
    };

    _open_keys_dialog = (type = "private-keys") => {
        this.setState({_keys_dialog_opened: type}, () => { this.forceUpdate(); });
    }
    _close_keys_dialog = () => {
        this.setState({_keys_dialog_opened: ""}, () => { this.forceUpdate(); });
    }

    setTabsRef = (el) => {
        if(!el){return;}
        this.setState({_tabs_el: el}, () => {
            this._compute_tab_margin();
        })
    };

    _compute_tab_margin = () => {
        if(this.state._view_right_mobile_enabled){
            const {width} = this.state._tabs_el.getBoundingClientRect();
            this.setState({_margin_last_tab: Math.max(0, width-326)}, () => { this.forceUpdate(); });
        }else {
            const {height} = this.state._tabs_el.getBoundingClientRect();
            this.setState({_margin_last_tab: height-312}, () => { this.forceUpdate(); });
        }
    }

    // ── Reusable wallet sub-sections (PXA / PXS views) ───────────────────────
    // These mirror the "Delegations" / "Powering Down" sub-sections of the PXP
    // view: a `subTitle` heading, a short descriptive line, and a list styled
    // with `delegationList` / `delegationListItem`.

    /**
     * Clickable header for a collapsible sub-section. `count` is an optional
     * short summary (e.g. "12.000 PXA", "2 active") shown muted next to the
     * title so collapsed sections still signal what's inside. Tapping anywhere
     * on the row toggles the section; the chevron rotates to match.
     */
    _render_section_header = (id, title, count) => {
        const classes = this.state.classes;
        const expanded = this._is_section_expanded(id);
        return (
            <Typography
                component={"h2"}
                variant={"h6"}
                className={classes.sectionHeader}
                onClick={() => this._toggle_section(id)}
                aria-expanded={expanded}
            >
                <span className={"section-title"}>
                    <span>{title}</span>
                    {count ? <span className={"section-count"}>{count}</span> : null}
                </span>
                <IconButton size={"small"} aria-label={expanded ? t("components.pixa_wallet_dialog.collapse_section") : t("components.pixa_wallet_dialog.expand_section")}>
                    <ExpandMoreRounded className={"section-chevron" + (expanded ? " expanded" : "")}/>
                </IconButton>
            </Typography>
        );
    };

    /**
     * Savings panel for a given currency ('PXA' | 'PXS'): current balance,
     * pending withdrawals (each cancellable), and deposit/withdraw actions.
     */
    _render_savings_section = (currency) => {
        const classes = this.state.classes;
        const { _itsOwnProfile, _savingsPixa, _savingsPxs, _savingsWithdrawals, _pixaBalance, _pxsBalance } = this.state;
        const savingsBalance = currency === 'PXA' ? _savingsPixa : _savingsPxs;
        const liquidBalance = currency === 'PXA' ? _pixaBalance : _pxsBalance;
        const dialogType = currency === 'PXA' ? 'PIXA' : 'SUPRA';
        const pending = (_savingsWithdrawals || []).filter(w => w.currency === currency);
        const sectionId = 'savings:' + currency;
        const summaryParts = [];
        if (savingsBalance > 0) summaryParts.push(`${savingsBalance.toFixed(3)} ${currency}`);
        if (pending.length > 0) summaryParts.push(t("components.pixa_wallet_dialog.pending_count", { count: pending.length }));
        return (
            <React.Fragment>
                {this._render_section_header(sectionId, t("components.pixa_wallet_dialog.savings"), summaryParts.join(" · "))}
                <Collapse in={this._is_section_expanded(sectionId)}>
                    <Typography style={{color: "#a5a5a5", margin: "8px 0px 0px 0px"}} component={"p"} variant={"body1"}>{t("components.pixa_wallet_dialog.in_savings_withdrawals_take_3_days_to", {
                        text: _itsOwnProfile ? t("components.pixa_wallet_dialog.you_have") : t("components.pixa_wallet_dialog.it_has"),
                        savingsBalance: savingsBalance.toFixed(3),
                        currency: currency
                    })}</Typography>
                    <List className={classes.delegationList} style={{minWidth: "auto", width: "100%"}}>
                        <ListSubheader disableSticky style={{backgroundColor: "transparent"}}>{t("components.pixa_wallet_dialog.pending_withdrawals", {
                            pending_count: pending.length
                        })}</ListSubheader>
                        {pending.map((w, i) => (
                            <ListItem key={w.request_id != null ? w.request_id : i} className={classes.delegationListItem}>
                                <ListItemIcon><HistoryRounded style={{opacity: 0.7}}/></ListItemIcon>
                                <ListItemText
                                    primary={w.amount}
                                    secondary={w.daysLeft > 0 ? t("components.pixa_wallet_dialog.arrives_in_day", {
                                        day: { day: w.daysLeft },
                                    }) : t("components.pixa_wallet_dialog.arriving_soon")}
                                />
                                {_itsOwnProfile && <ListItemSecondaryAction>
                                    <Tooltip title={t("components.pixa_wallet_dialog.cancel_this_withdrawal")}>
                                        <IconButton onClick={() => this._request_cancel_savings_withdrawal(w)}><CloseIcon/></IconButton>
                                    </Tooltip>
                                </ListItemSecondaryAction>}
                            </ListItem>
                        ))}
                        {pending.length === 0 && <Typography style={{color: "#666", padding: "8px 16px"}} variant="body2">{t("components.pixa_wallet_dialog.no_pending_withdrawals")}</Typography>}
                        {_itsOwnProfile && <div style={{display: "flex", gap: "8px", flexWrap: "wrap", margin: "8px 0px 16px 0px"}}>
                            <Tooltip title={liquidBalance <= 0 ? t("components.pixa_wallet_dialog.you_dont_have_any_to_deposit", {
                                currency: currency
                            }) : ""} disableHoverListener={liquidBalance > 0} disableFocusListener={liquidBalance > 0} disableTouchListener={liquidBalance > 0}>
                                <span style={{flex: "1 1 140px"}}><Button color="primary" variant={"contained"} className={classes.greyButton} size={"medium"} style={{width: "100%"}} onClick={() => this._open_savings_dialog(dialogType, "deposit")} disabled={liquidBalance <= 0}>{t("components.pixa_wallet_dialog.deposit")} <BankTransferOut style={{marginLeft: "8px"}}/></Button></span>
                            </Tooltip>
                            <Tooltip title={savingsBalance <= 0 ? t("components.pixa_wallet_dialog.nothing_in_savings_to_withdraw") : ""} disableHoverListener={savingsBalance > 0} disableFocusListener={savingsBalance > 0} disableTouchListener={savingsBalance > 0}>
                                <span style={{flex: "1 1 140px"}}><Button color="primary" variant={"contained"} className={classes.greyButton} size={"medium"} style={{width: "100%"}} onClick={() => this._open_savings_dialog(dialogType, "withdraw")} disabled={savingsBalance <= 0}>{t("components.pixa_wallet_dialog.withdraw")} <CashFast style={{marginLeft: "8px"}}/></Button></span>
                            </Tooltip>
                        </div>}
                    </List>
                </Collapse>
            </React.Fragment>
        );
    };

    /**
     * Outgoing recurring transfers for a given currency. Each row is cancellable
     * (re-broadcasts with executions: 0).
     */
    _render_recurrent_section = (currency) => {
        const classes = this.state.classes;
        const { _itsOwnProfile, _recurrentTransfers } = this.state;
        const rows = (_recurrentTransfers || []).filter(r => r.currency === currency);
        const sectionId = 'recurrent:' + currency;
        return (
            <React.Fragment>
                {this._render_section_header(sectionId, t("components.pixa_wallet_dialog.recurring_transfers"), rows.length > 0 ? t("components.pixa_wallet_dialog.active_count", { count: rows.length }) : "")}
                <Collapse in={this._is_section_expanded(sectionId)}>
                    <List className={classes.delegationList} style={{minWidth: "auto", width: "100%"}}>
                        <ListSubheader disableSticky style={{backgroundColor: "transparent"}}>{t("components.pixa_wallet_dialog.outgoing", {
                            row_count: rows.length
                        })}</ListSubheader>
                        {rows.map((r, i) => (
                            <ListItem key={(r.to || '') + '-' + i} className={classes.delegationListItem}>
                                <ListItemAvatar>
                                    <Avatar src={r.image || ''} style={{borderRadius: "12px", cursor: "pointer", backgroundColor: "#000"}} className={"pixelated"} onClick={() => this._open_author(r.to)} />
                                </ListItemAvatar>
                                <ListItemText
                                    primary={<span style={{cursor: "pointer"}} onClick={() => this._open_author(r.to)}>{`@${r.to}`}</span>}
                                    secondary={t("components.pixa_wallet_dialog.every_h_left", {
                                        amount: r.amount,
                                        recurrence: r.recurrence,
                                        remaining_executions: r.remaining_executions
                                    })}
                                />
                                {_itsOwnProfile && <ListItemSecondaryAction>
                                    <Tooltip title={t("components.pixa_wallet_dialog.cancel_this_recurring_transfer")}>
                                        <IconButton onClick={() => this._request_cancel_recurrent_transfer(r)}><CloseIcon/></IconButton>
                                    </Tooltip>
                                </ListItemSecondaryAction>}
                            </ListItem>
                        ))}
                        {rows.length === 0 && <Typography style={{color: "#666", padding: "8px 16px"}} variant="body2">{t("components.pixa_wallet_dialog.no_recurring_transfers")}</Typography>}
                    </List>
                </Collapse>
            </React.Fragment>
        );
    };

    /**
     * Pending conversions for a given currency ('PXA' | 'PXS'). Display-only —
     * neither the standard `convert` nor `collateralized_convert` can be
     * cancelled on-chain once broadcast.
     *
     * Each view shows the legs with a pending effect on its token:
     *   PXA view — collateralized PXA→PXS (PXA collateral locked, excess PXA
     *              returns after the window) and regular PXS→PXA (PXA arriving).
     *   PXS view — regular PXS→PXA only (PXS burned, settling). A collateralized
     *              convert credits PXS instantly, so it has no PXS-side pending
     *              leg; its excess-collateral return is a PXA event (PXA view).
     */
    _render_pending_swap_section = (currency = 'PXS') => {
        const classes = this.state.classes;
        const regular = this.state._pendingConversions || [];
        const collateralized = this.state._pendingCollateralizedConversions || [];
        const sectionId = 'pendingswap:' + currency;

        const _days = (d) => d > 0 ? t("components.pixa_wallet_dialog.days_approx", { day: { day: d } }) : null;

        // Build a unified, direction-aware item list for this token. Ordered so
        // the leg that *debits* this token (the one the user is most likely
        // tracking) comes first.
        const items = [];
        if (currency === 'PXA') {
            // PXA leaving as collateral; PXS credited instantly, excess PXA returns.
            collateralized.forEach((c, i) => {
                const d = _days(c.daysLeft);
                items.push({
                    key: 'c' + (c.requestid != null ? c.requestid : i),
                    icon: <CallMadeRounded style={{opacity: 0.7}}/>,
                    primary: `${c.collateral} → PXS`,
                    secondary: d ? t("components.pixa_wallet_dialog.collateral_locked_excess_returns_in", {
                        d: d
                    }) : t("components.pixa_wallet_dialog.collateral_locked_excess_returns_soon"),
                });
            });
            // PXA arriving from a PXS→PXA convert.
            regular.forEach((c, i) => {
                const d = _days(c.daysLeft);
                items.push({
                    key: 'r' + (c.requestid != null ? c.requestid : i),
                    icon: <CallReceivedRounded style={{opacity: 0.7}}/>,
                    primary: `${c.amount} → PXA`,
                    secondary: d ? t("components.pixa_wallet_dialog.arrives_in", {
                        d: d
                    }) : t("components.pixa_wallet_dialog.arriving_soon"),
                });
            });
        } else {
            // PXS view: only the standard convert (PXS→PXA) has a PXS-side
            // pending leg. A collateralized convert credits PXS instantly and
            // locks *PXA* collateral, so its pending portion (the excess
            // collateral return) is a PXA event and is surfaced in the PXA view.
            // PXS burned via convert; PXA released after the window.
            regular.forEach((c, i) => {
                const d = _days(c.daysLeft);
                items.push({
                    key: 'r' + (c.requestid != null ? c.requestid : i),
                    icon: <BankTransferOut style={{opacity: 0.7}}/>,
                    primary: `${c.amount} → PXA`,
                    secondary: d ? t("components.pixa_wallet_dialog.settles_in", {
                        d: d
                    }) : t("components.pixa_wallet_dialog.settling_soon"),
                });
            });
        }

        return (
            <React.Fragment>
                {this._render_section_header(sectionId, t("components.pixa_wallet_dialog.pending_swaps"), items.length > 0 ? t("components.pixa_wallet_dialog.in_progress", {
                    item_count: items.length
                }) : "")}
                <Collapse in={this._is_section_expanded(sectionId)}>
                    <Typography style={{color: "#a5a5a5", margin: "8px 0px 0px 0px"}} component={"p"} variant={"body1"}>
                        {t("components.pixa_wallet_dialog.swapping_pxa_to_pxs_is_instant_the")}
                    </Typography>
                    <List className={classes.delegationList} style={{minWidth: "auto", width: "100%"}}>
                        <ListSubheader disableSticky style={{backgroundColor: "transparent"}}>{t("components.pixa_wallet_dialog.in_progress", {
                            item_count: items.length
                        })}</ListSubheader>
                        {items.map((it) => (
                            <ListItem key={it.key} className={classes.delegationListItem}>
                                <ListItemIcon>{it.icon}</ListItemIcon>
                                <ListItemText
                                    primary={it.primary}
                                    secondary={it.secondary}
                                />
                            </ListItem>
                        ))}
                        {items.length === 0 && <Typography style={{color: "#666", padding: "8px 16px"}} variant="body2">{t("components.pixa_wallet_dialog.no_pending_swaps")}</Typography>}
                    </List>
                </Collapse>
            </React.Fragment>
        );
    };

    render() {
        let {
            classes,
            open,
            account,
            locales,
            _tab_value,
            _power_dialog_opened,
            _keys_dialog_opened,
            _send_dialog_opened,
            _swap_dialog_opened,
            _delegate_dialog_opened,
            _send_power_dialog_opened,
            _bulk_create_dialog_opened,
            _bulk_power_dialog_opened,
            _supra_info_dialog_opened,
            _power_info_dialog_opened,
            _pixa_info_dialog_opened,
            _taxes_dialog_opened,
            _savings_dialog_opened,
            _savings_dialog_mode,
            _savingsPixa,
            _savingsPxs,
            _pendingPixa,
            _pendingPxs,
            _margin_last_tab,
            _bigmac,
            _data,
            _selectedRange,
            _chartLoading,
            _view_right_mobile_enabled,
            _time_ago,
            _views,
            // Wallet data
            _pixaBalance,
            _pxsBalance,
            _pxpBalance,
            _ownPxp,
            _delegatedPxp,
            _receivedPxp,
            _powerDownablePxp,
            _rewardPixa,
            _rewardPxs,
            _rewardPxp,
            _rewardPxpInPixa,
            _isPoweringDown,
            _nextPowerDown,
            _nextWithdrawalDate,
            _toWithdraw,
            _withdrawn,
            _pixaUsdPrice,
            _pxsUsdPrice,
            _fiatRate,
            _currency,
            _pxpUsd,
            _pixaUsd,
            _pxsUsd,
            _totalUsd,
            _outgoingDelegations,
            _incomingDelegations,
            _walletHistory,
            _walletLoaded,
            _confirm_action_open,
            _confirm_action_title,
            _confirm_action_body,
            _itsOwnProfile,
            _loggedInUser,
        } = this.state;

        // When viewing someone else's wallet, use the logged-in user for broadcasts.
        // _loggedInUser is a username string (from api.getActiveAccount()), not an object.
        const _loggedInUsername = typeof _loggedInUser === 'string' ? _loggedInUser : (_loggedInUser && (_loggedInUser.username || _loggedInUser.name)) || '';
        const broadcastAccount = _itsOwnProfile ? account : (_loggedInUsername ? { username: _loggedInUsername, name: _loggedInUsername } : account);
        const wealthLabel = _itsOwnProfile ? "of your wealth" : "of its wealth";

        // Computed display values
        const totalUsdDisplay = _totalUsd.toFixed(0);
        // Gauge basis = ACCOUNT VALUE: delegation flows are excluded entirely
        // from the PXP component — borrowed (delegated-in) stake never adds
        // value and lent (delegated-out) stake never removes it, so PXP
        // enters at its RAW owned figure. PXA/PXS keep full holdings (liquid
        // + savings + in-flight). This drives the distribution arcs and the
        // "% of wealth" splits. It is still intentionally LARGER than the
        // headline _totalUsd (owned PXP + liquid/in-flight PXA/PXS): the gap
        // is exactly savings, shown on the cards but not totalled.
        // (_pxpUsd — the usable/effective valuation — keeps driving the
        // POWER view's usage story below.)
        const _pxpRawUsd = (Number(_ownPxp) || 0) * (Number(_pixaUsdPrice) || 0);
        const _tokenTotalUsd = _pxpRawUsd + (Number(_pixaUsd) || 0) + (Number(_pxsUsd) || 0);
        // Total holdings per token = liquid + savings + pending (in-flight). Used
        // for the big number on each token tab and in the distribution legend.
        // The liquid-only _pixaBalance / _pxsBalance are still what gate
        // transfer/swap/power-up and the savings deposit limit.
        const _pixaHoldings = (Number(_pixaBalance) || 0) + (Number(_savingsPixa) || 0) + (Number(_pendingPixa) || 0);
        const _pxsHoldings = (Number(_pxsBalance) || 0) + (Number(_savingsPxs) || 0) + (Number(_pendingPxs) || 0);
        // "X available · Y in savings · Z pending" caption under each token's
        // price line. Returns null when nothing is locked, so the line hides.
        const _breakdownLine = (liquid, savings, pending) => {
            const parts = [t("components.pixa_wallet_dialog.available_amount", { amount: (Number(liquid) || 0).toFixed(3) })];
            if ((Number(savings) || 0) > 0) parts.push(t("components.pixa_wallet_dialog.in_savings_amount", { amount: Number(savings).toFixed(3) }));
            if ((Number(pending) || 0) > 0) parts.push(t("components.pixa_wallet_dialog.pending_amount", { amount: Number(pending).toFixed(3) }));
            return parts.length > 1 ? parts.join(" · ") : null;
        };
        const _pixaBreakdown = _breakdownLine(_pixaBalance, _savingsPixa, _pendingPixa);
        const _pxsBreakdown = _breakdownLine(_pxsBalance, _savingsPxs, _pendingPxs);
        // POWER view headline: the RAW owned PXP, same basis as the gauge —
        // no delegation flows in it (borrowing adds nothing, lending removes
        // nothing). The usable (effective) figure lives in the sentence under
        // the Delegations header, which explains the borrowed / lent parts.
        const pxpDisplay = _ownPxp.toFixed(0);
        const pixaDisplay = _pixaHoldings.toFixed(0);
        const pxsDisplay = _pxsHoldings.toFixed(0);
        const pxpUsdDisplay = _pxpUsd.toFixed(0);
        const pixaUsdDisplay = _pixaUsd.toFixed(0);
        const pxsUsdDisplay = _pxsUsd.toFixed(0);
        // Display currency: token values are USD-anchored; convert at render time.
        const fiatRate = Number.isFinite(Number(_fiatRate)) && Number(_fiatRate) > 0 ? Number(_fiatRate) : 1;
        const cur = _currency || 'USD';
        const fmtFiat = (usd, d = 0) => `${((Number(usd) || 0) * fiatRate).toFixed(d)} ${cur}`;
        const totalFiatDisplay = fmtFiat(_totalUsd, 0);
        // Raw-valued (_pxpRawUsd) to match the raw pxpDisplay beside it —
        // the same basis the gauge arcs and % splits already run on.
        const pxpFiatDisplay = fmtFiat(_pxpRawUsd, 0);
        const pixaFiatDisplay = fmtFiat(_pixaUsd, 0);
        const pxsFiatDisplay = fmtFiat(_pxsUsd, 0);
        const pxpPctDisplay = _tokenTotalUsd > 0 ? ((_pxpRawUsd / _tokenTotalUsd) * 100).toFixed(1) : '0.0';
        const pixaPctDisplay = _tokenTotalUsd > 0 ? ((_pixaUsd / _tokenTotalUsd) * 100).toFixed(1) : '0.0';
        const pxsPctDisplay = _tokenTotalUsd > 0 ? ((_pxsUsd / _tokenTotalUsd) * 100).toFixed(1) : '0.0';
        const hasRewards = _rewardPixa > 0 || _rewardPxs > 0 || _rewardPxp > 0;
        const _hasAnyFunds = _totalUsd > 0 || _pxpBalance > 0 || _pixaHoldings > 0 || _pxsHoldings > 0;

        // Power down remaining info — to_withdraw and withdrawn are micro-vests (1e6 = 1 VEST)
        const powerDownWeeksRemaining = _isPoweringDown && _nextPowerDown > 0 ? Math.ceil((_toWithdraw - _withdrawn) / 1e6 / (parseFloat(this.state._fullAccount?.vesting_withdraw_rate || 0) || 1)) : 0;
        const nextPowerDownDays = _nextWithdrawalDate ? Math.max(0, Math.ceil((new Date(_nextWithdrawalDate).getTime() - Date.now()) / (1000*60*60*24))) : 0;

        // Portfolio data for pie chart.
        // When the account holds nothing the chart would otherwise compute
        // (0 / 0) * 360 for each arc, emitting NaN into SVG `d` attributes
        // (broken paths, NaN% labels). Substitute equal sentinel weights so
        // each token shows ~33.3% in an evenly-divided empty gauge.
        const _emptyWallet = !_hasAnyFunds;
        const _pxpSlice = _emptyWallet ? 1 : Math.round(_pxpRawUsd);
        const _pixaSlice = _emptyWallet ? 1 : Math.round(_pixaUsd);
        const _pxsSlice = _emptyWallet ? 1 : Math.round(_pxsUsd);
        const portfolioData = [
            { color: COLORS[0], name: 'PXP', icon: <PixaPower style={{transform: "scale(1.35)"}}/>, value: _pxpSlice, amount: Math.round(_ownPxp), symbol: 'PXP', val: 1},
            { color: COLORS[1], name: 'PXA', icon: <PixaLiquid style={{transform: "scale(1.1)"}}/>,value: _pixaSlice, amount: Math.round(_pixaHoldings), symbol: 'PXA', val: 2 },
            { color: COLORS[2], name: 'PXS', icon: <PixaSupra style={{transform: "scale(0.85)"}}/>,value: _pxsSlice, amount: Math.round(_pxsHoldings), symbol: 'PXS', val: 3 }
        ];
        // Centre figure of the overview gauge: the SAME value as the header
        // "estimated wealth" button (_totalUsd), so the two can never
        // disagree. Account value counts what the account OWNS — own PXP
        // (lent-out stake stays yours), plus liquid (+ in-flight) PXA/PXS —
        // while borrowed (delegated-in) PXP is ignored (lent to the account,
        // never yours) and savings stay off the headline. Passed as a Number
        // so the chart's count-up math stays in number-space. The ARCS run on
        // the same raw-PXP account-value basis (portfolioData /
        // _tokenTotalUsd, savings included); totalValue only drives the
        // centre number.
        const _gaugeTotal = Number(_totalUsd) || 0;
        // Net delegation effect printed under the centre figure: borrowed
        // (delegated-in) PXP is usable by the account without being owned
        // ("+ X {cur} (usable due to delegations)"), lent (delegated-out) PXP
        // is owned but not currently usable ("- X {cur} (unusable due to
        // delegations)"). Signed USD value of (received − delegated-out); the
        // chart hides it when it rounds to zero at display precision.
        const _delegationDeltaUsd = ((Number(_receivedPxp) || 0) - (Number(_delegatedPxp) || 0)) * (Number(_pixaUsdPrice) || 0);

        // Overview View (Tab 0)
        const _overview = (
            <div className={classes.flexColumn} key={"view-overview"} style={{overflow: (_view_right_mobile_enabled ? "inherit": "overlay !important").toString()}}>
                <div className={classes.mobileMarginTop}>
                    <Typography component={"h2"} variant={"h5"} style={{fontWeight: "600", color: "#ffffff"}}>
                        {t("components.pixa_wallet_dialog.portfolio_distribution")}
                    </Typography>
                    {/* Pie Chart */}
                    <div style={{
                        width: "100%",
                        height: "inherit",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                        padding: _view_right_mobile_enabled ? "0px 0px" : "0px 24px"
                    }}>
                        <Fade in={!!_walletLoaded} timeout={200}>
                            <div style={{width: "100%", display: "flex", justifyContent: "center"}}>
                                <HalfGaugeChart
                                    data={portfolioData}
                                    totalValue={_gaugeTotal}
                                    delegationDeltaValue={_delegationDeltaUsd}
                                    currency={cur}
                                    fiatRate={fiatRate}
                                    onSliceClick={(slice) => {
                                        // Navigate to the corresponding token tab. portfolioData
                                        // tags each slice with val: 1 (PXP), 2 (PXA), 3 (PXS),
                                        // matching the Power/Pixa/Supra tabs at indices 0/1/2.
                                        // (The previous switch on slice.name tested literals like
                                        // "Pixa" / "Supra" that never matched the real names
                                        // "PXP" / "PXA" / "PXS" — the legend was effectively
                                        // a no-op.)
                                        const tabIndex = (slice && slice.val) ? slice.val - 1 : -1;
                                        if (tabIndex >= 0 && tabIndex <= 2) {
                                            this._handle_tab_value_change({}, tabIndex);
                                        }
                                    }}
                                />
                            </div>
                        </Fade>
                    </div>

                    {/* Quick Stats */}
                    <div style={{display: "flex", gap: "12px", flexWrap: "wrap"}}>
                        <div className={classes.portfolioCard} onClick={() => {this._handle_tab_value_change({}, 3)}} style={{flex: "1 1 calc(50% - 6px)", backgroundImage: "url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MDAgNTAwIj4KICA8cGF0aCBkPSJNIDM3NC4wOTQgMzQzLjQyOSBDIDM2OC4wOTEgMzM3LjI3MiAzNjAuNTQ3IDMzNC4xOTQgMzUxLjc3MiAzMzQuMTk0IEwgMjQ0LjAxMiAzMzQuMTk0IEwgMjExLjk5MiAzMjIuOTU2IEwgMjE3LjA3MSAzMDguNDg2IEwgMjQ0LjAxMiAzMTguNzk5IEwgMjg3LjExNyAzMTguNzk5IEMgMjkyLjUwMyAzMTguNzk5IDI5Ni44MTUgMzE2LjY0MiAzMDAuMzU1IDMxMy4xMDMgQyAzMDMuODk2IDMwOS41NjIgMzA1LjU5IDMwNS4yNTMgMzA1LjU5IDMwMC40OCBDIDMwNS41OSAyOTIuMTY2IDMwMS41ODggMjg2LjQ3IDI5My41ODIgMjgzLjIzNyBMIDE4MS42NjYgMjQxLjgyNyBMIDE1MS42NDcgMjQxLjgyNyBMIDE1MS42NDcgMzgwLjM3NiBMIDI1OS40MDYgNDExLjE2NCBMIDM4My4wMjIgMzY0Ljk4MSBDIDM4My4xNzcgMzU2LjgyMSAzODAuMDk4IDM0OS41ODggMzc0LjA5NCAzNDMuNDI5IE0gMTIwLjg1OSAyNDEuODI3IEwgNTkuMDM0IDI0MS44MjcgTCA1OS4wMzQgNDExLjE2NCBMIDEyMC44NTkgNDExLjE2NCBMIDEyMC44NTkgMjQxLjgyNyBaIiBzdHlsZT0ic3Ryb2tlLXdpZHRoOiAxOyB0cmFuc2Zvcm0tYm94OiBmaWxsLWJveDsgdHJhbnNmb3JtLW9yaWdpbjogNTAlIDUwJTsgZmlsbDogcmdiKDI1NSwgMjU1LCAyNTUpOyBmaWxsLW9wYWNpdHk6IDAuMDU7IiB0cmFuc2Zvcm09Im1hdHJpeCgwLjgzODY3MSwgLTAuNTQ0NjM5LCAwLjU0NDYzOSwgMC44Mzg2NzEsIC0wLjAwMDAwNiwgLTAuMDAwMDA3KSI+PC9wYXRoPgogIDxwYXRoIGQ9Ik0gMzA5LjQyIDIzLjcyNCBDIDI5Mi45MTIgMjMuNjM2IDI3Ni44NDQgMzkuNTMxIDI4NC4xOCA1OS4yNzEgTCAyNTYuNDkzIDU5LjI3MSBDIDI0Ni44NDMgNTkuMjcxIDIzOS4wMjcgNjcuMDg3IDIzOS4wMjcgNzYuNzM5IEwgMjM5LjAyNyA5NC4yMDYgQyAyMzkuMDI3IDk5LjAyNyAyNDIuOTM4IDEwMi45MzkgMjQ3Ljc2IDEwMi45MzkgTCAzMjYuMzY0IDEwMi45MzkgTCAzMjYuMzY0IDc2LjczOSBMIDM0My44MyA3Ni43MzkgTCAzNDMuODMgMTAyLjkzOSBMIDQyMi40MzUgMTAyLjkzOSBDIDQyNy4yNTggMTAyLjkzOSA0MzEuMTcgOTkuMDI3IDQzMS4xNyA5NC4yMDYgTCA0MzEuMTcgNzYuNzM5IEMgNDMxLjE3IDY3LjA4NyA0MjMuMzQ0IDU5LjI3MSA0MTMuNzAzIDU5LjI3MSBMIDM4Ni4wMTYgNTkuMjcxIEMgMzk2LjIzNCAzMC43MTEgMzU3LjgwNiAxMC41MzYgMzQwLjA3NSAzNS4xNjQgTCAzMzUuMDk3IDQxLjgwMiBMIDMzMC4xMTkgMzQuOTkxIEMgMzI0LjYxNSAyNy4yMTggMzE3LjAxOCAyMy44MTIgMzA5LjQyIDIzLjcyNCBNIDMwOC44OTcgNDEuODAyIEMgMzE2LjY2OSA0MS44MDIgMzIwLjYgNTEuMjM1IDMxNS4wOTcgNTYuNzM4IEMgMzA5LjU5NiA2Mi4yNCAzMDAuMTYzIDU4LjMwOSAzMDAuMTYzIDUwLjUzNiBDIDMwMC4xNjMgNDUuNzA3IDMwNC4wNzUgNDEuODAyIDMwOC44OTcgNDEuODAyIE0gMzYxLjMgNDEuODAyIEMgMzY5LjA3MyA0MS44MDIgMzczLjAwNCA1MS4yMzUgMzY3LjUwMiA1Ni43MzggQyAzNjEuOTk4IDYyLjI0IDM1Mi41NjUgNTguMzA5IDM1Mi41NjUgNTAuNTM2IEMgMzUyLjU2NSA0NS43MDcgMzU2LjQ3OCA0MS44MDIgMzYxLjMgNDEuODAyIE0gMjQ3Ljc2IDExMS42NzIgTCAyNDcuNzYgMTgxLjU0NSBDIDI0Ny43NiAxOTEuMTg2IDI1NS41NzUgMTk5LjAxMiAyNjUuMjI3IDE5OS4wMTIgTCA0MDQuOTY5IDE5OS4wMTIgQyA0MTQuNjExIDE5OS4wMTIgNDIyLjQzNSAxOTEuMTg2IDQyMi40MzUgMTgxLjU0NSBMIDQyMi40MzUgMTExLjY3MiBMIDM0My44MyAxMTEuNjcyIEwgMzQzLjgzIDE4MS41NDUgTCAzMjYuMzY0IDE4MS41NDUgTCAzMjYuMzY0IDExMS42NzIgTCAyNDcuNzYgMTExLjY3MiBaIiBzdHlsZT0ic3Ryb2tlLXdpZHRoOiAxOyB0cmFuc2Zvcm0tYm94OiBmaWxsLWJveDsgdHJhbnNmb3JtLW9yaWdpbjogNTAlIDUwJTsgZmlsbDogcmdiKDI1NSwgMjU1LCAyNTUpOyBmaWxsLW9wYWNpdHk6IDAuMDU7IiB0cmFuc2Zvcm09Im1hdHJpeCgwLjgzODY3MSwgLTAuNTQ0NjM5LCAwLjU0NDYzOSwgMC44Mzg2NzEsIC0wLjAwMDAwNCwgLTAuMDAwMDEzKSI+PC9wYXRoPgo8L3N2Zz4K)", backgroundRepeat: "no-repeat", backgroundPosition: "90% 50%", backgroundSize: "30%", minWidth: "140px", padding: "16px"}}>
                            <Typography variant="body2" style={{color: "#999", marginBottom: "4px"}}>{t("components.pixa_wallet_dialog.rewards_pending")}</Typography>
                            <Typography variant="h6" className="monospace" style={{color: "#ffffff"}}>{((_rewardPixa * _pixaUsdPrice + _rewardPxs * _pxsUsdPrice + _rewardPxpInPixa * _pixaUsdPrice) * fiatRate).toFixed(2)} {cur}</Typography>
                            <Typography variant="caption" style={{color: "#666"}}>{t("components.pixa_wallet_dialog.pxa_pxs_pxp", {
                                rewardPixa: _rewardPixa.toFixed(1),
                                rewardPxs: _rewardPxs.toFixed(1),
                                rewardPxp: _rewardPxp.toFixed(1)
                            })}</Typography>
                        </div>
                        <div className={classes.portfolioCard} onClick={() => {this._handle_tab_value_change({}, 0)}} style={{flex: "1 1 calc(50% - 6px)", backgroundImage: "url(data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MDAgNTAwIj4KICA8cGF0aCBkPSJNIDI5Mi4xMzcgNDc0LjY0MyBMIDMzOS44MTggNDI2Ljk2MSBMIDIzOC4yMTMgMzI1LjM1OCBMIDE1NC45MzMgNDA4LjY0MiBMIDAuNjUxIDI1NC4xNSBMIDMwLjAwOCAyMjQuNzk1IEwgMTU0LjkzMyAzNDkuNzE5IEwgMjM4LjIxMyAyNjYuNDM2IEwgMzY5LjM4MiAzOTcuMzk4IEwgNDE3LjA2IDM0OS43MTkgTCA0MTcuMDYgNDc0LjY0MyBMIDI5Mi4xMzcgNDc0LjY0MyBaIiBzdHlsZT0ic3Ryb2tlLXdpZHRoOiAxOyB0cmFuc2Zvcm0tYm94OiBmaWxsLWJveDsgdHJhbnNmb3JtLW9yaWdpbjogNTAlIDUwJTsgZmlsbDogcmdiKDI1NSwgMjU1LCAyNTUpOyBmaWxsLW9wYWNpdHk6IDAuMDU7IiB0cmFuc2Zvcm09Im1hdHJpeCgwLjk5NDUyMiwgMC4xMDQ1MjgsIC0wLjEwNDUyOCwgMC45OTQ1MjIsIC0wLjAwMDAwMywgMC4wMDAwMDQpIi8+CiAgPHBhdGggZD0iTSAxODcuNDc2IDMwOC4wNjkgTCAxODcuNDc2IDE4NS41ODIgTCAxMjYuMjM2IDE4NS41ODIgTCAyMjguMzA3IDEuODU0IEwgMjI4LjMwNyAxMjQuMzQgTCAyODkuNTQ5IDEyNC4zNCBMIDE4Ny40NzYgMzA4LjA2OSBaIiBzdHlsZT0ic3Ryb2tlLXdpZHRoOiAxOyB0cmFuc2Zvcm0tYm94OiBmaWxsLWJveDsgdHJhbnNmb3JtLW9yaWdpbjogNTAlIDUwJTsgZmlsbDogcmdiKDI1NSwgMjU1LCAyNTUpOyBmaWxsLW9wYWNpdHk6IDAuMDU7IiB0cmFuc2Zvcm09Im1hdHJpeCgwLjk0NTUxOSwgMC4zMjU1NjgsIC0wLjMyNTU2OCwgMC45NDU1MTksIC0wLjAwMDAwMywgMC4wMDAwMDMpIi8+CiAgPHBhdGggZD0iTSAzOTEuMDQ3IDM2OC44MDQgTCAzOTEuMDQ3IDI4NS4yNDcgTCAzNDkuMjcxIDI4NS4yNDcgTCA0MTguOSAxNTkuOTEzIEwgNDE4LjkgMjQzLjQ3MSBMIDQ2MC42NzcgMjQzLjQ3MSBMIDM5MS4wNDcgMzY4LjgwNCBaIiBzdHlsZT0ic3Ryb2tlLXdpZHRoOiAxOyB0cmFuc2Zvcm0tb3JpZ2luOiA0MDQuOTc1cHggMjY0LjM2cHg7IGZpbGw6IHJnYigyNTUsIDI1NSwgMjU1KTsgZmlsbC1vcGFjaXR5OiAwLjA1OyIgdHJhbnNmb3JtPSJtYXRyaXgoMC45NDU1MTksIDAuMzI1NTY4LCAtMC4zMjU1NjgsIDAuOTQ1NTE5LCAtMC4wMDAwMDMsIC0wLjAwMDAxKSIvPgogIDxwYXRoIGQ9Ik0gMjA5LjIxNCA0ODguODk1IEwgMjA5LjIxNCA0MzYuMzQ3IEwgMTgyLjk0MSA0MzYuMzQ3IEwgMjI2LjczMSAzNTcuNTI1IEwgMjI2LjczMSA0MTAuMDc0IEwgMjUzLjAwNCA0MTAuMDc0IEwgMjA5LjIxNCA0ODguODk1IFoiIHN0eWxlPSJzdHJva2Utd2lkdGg6IDE7IHRyYW5zZm9ybS1vcmlnaW46IDIxNy45NzNweCA0MjMuMjExcHg7IGZpbGw6IHJnYigyNTUsIDI1NSwgMjU1KTsgZmlsbC1vcGFjaXR5OiAwLjA1OyIgdHJhbnNmb3JtPSJtYXRyaXgoMC45NDU1MTksIDAuMzI1NTY4LCAtMC4zMjU1NjgsIDAuOTQ1NTE5LCAwLjAwMDAwNywgMC4wMDAwMDkpIi8+Cjwvc3ZnPgo=)", backgroundRepeat: "no-repeat", backgroundPosition: "90% 50%", backgroundSize: "30%", minWidth: "140px", padding: "16px"}}>
                            <Typography variant="body2" style={{color: "#999", marginBottom: "4px"}}>{t("components.pixa_wallet_dialog.power_down")}</Typography>
                            <Typography variant="h6" className="monospace" style={{color: "#ffffff"}}>{_isPoweringDown ? `~${_nextPowerDown.toFixed(2)} PXA` : t("components.pixa_wallet_dialog.inactive")}</Typography>
                            <Typography variant="caption" style={{color: "#666"}}>{_isPoweringDown ? t("components.pixa_wallet_dialog.in_days", {
                                nextPowerDownDays: nextPowerDownDays
                            }) : t("components.pixa_wallet_dialog.not_powering_down")}</Typography>
                        </div>
                    </div>
                    <div style={{width: "100%"}}>
                        <Tooltip title={_pixaBalance <= 0 ? t("components.pixa_wallet_send_dialog.you_dont_have_any_to_transfer", { currency: "PXA" }) : ""} disableHoverListener={_pixaBalance > 0} disableFocusListener={_pixaBalance > 0} disableTouchListener={_pixaBalance > 0}>
                            <span style={{width: "100%"}}><Button color="primary" variant={"contained"} onClick={() => {this._open_send_dialog("PIXA");}} className={classes.whiteButton} style={{margin: "4px 0px 12px 0px"}} size={"large"} disabled={_itsOwnProfile ? _pixaBalance <= 0 : false}>{_itsOwnProfile ? <React.Fragment>{t("components.pixa_wallet_dialog.quick_transfer")} <CashFast style={{marginLeft: "8px"}}/></React.Fragment> : <React.Fragment><span style={{display: "grid", textAlign: "center", lineHeight: "1.3"}}>{t("components.pixa_wallet_dialog.quick_transfer_2")}<br/><span style={{fontSize: "0.75em"}}>{t("components.pixa_wallet_dialog.to", {
                                username: account.username
                            })}</span></span> <CashFast style={{marginLeft: "8px"}}/></React.Fragment>}</Button></span>
                        </Tooltip>
                    </div>
                </div>
                <div style={{}}>
                    <div className={classes.portfolioCard} style={{margin: 0, justifyContent: "space-between", padding: 16, display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px"}}>
                        <Typography variant="body2" style={{color: "#ddd", margin: "8px 0px 8px 0px"}}>{_itsOwnProfile ? t("components.pixa_wallet_dialog.do_you_need_more_control") : t("components.pixa_wallet_dialog.do_you_need_advanced_verifications")}</Typography>
                        <div style={{display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap", justifyContent: "flex-end"}}>
                            <Button onClick={() => this._open_keys_dialog("private-keys")} variant={"text"}>{_itsOwnProfile ? t("components.pixa_wallet_dialog.keys") : t("components.pixa_wallet_dialog.see_keys")} <ShieldKey style={{marginLeft: "8px"}}/></Button>
                            {account && account.username === "initminer" && (
                                <Button onClick={this._open_bulk_create_dialog} variant={"text"}>{t("words.create_accounts")} <PersonAddRounded style={{marginLeft: "8px"}}/></Button>
                            )}
                            {_itsOwnProfile && <Button onClick={this._open_taxes_dialog} variant={"text"}>{t("components.pixa_wallet_dialog.taxes")} <DescriptionRounded style={{marginLeft: "8px"}}/></Button>}
                        </div>
                    </div>
                </div>
            </div>
        );

        let view = null;
        switch (parseInt(_tab_value)) {
            case 0:
                view = (
                    <div className={classes.flexColumn2} key={"view-one"}>
                        <div>
                            <Typography component={"h2"} variant={"h6"} className={classes.subTitle}>
                                <span>
                                    <span className={classes.glowText + " monospace "}>PXP {pxpDisplay}</span>
                                    <IconButton onClick={this._open_power_info_dialog} aria-label={t("components.pixa_wallet_dialog.about_pxp")}><InfoOutlined/></IconButton>
                                </span>
                                <span>
                                    <span className={"monospace"}>~ {pxpFiatDisplay}</span>
                                    <span>{pxpPctDisplay}% {wealthLabel}</span>
                                </span>
                            </Typography>
                            <Typography className={classes.pricedAt} variant="body2" color="textPrimary" component="p">{t("components.pixa_wallet_dialog.fungible_with_pxa")}</Typography>
                            <Typography component={"h2"} variant={"h6"} className={classes.subTitle}>{t("components.pixa_wallet_dialog.delegations")}</Typography>
                            <Typography style={{color: "#a5a5a5", margin: "8px 0px 0px 0px"}} component={"p"} variant={"body1"}>
                                <T
                                    k="components.pixa_wallet_dialog.pxp_usable_because"
                                    vars={{
                                        text: _itsOwnProfile ? t("components.pixa_wallet_dialog.you_have") : t("components.pixa_wallet_dialog.it_has"),
                                        overall: _pxpBalance.toFixed(2),
                                        borrowed: _receivedPxp.toFixed(2),
                                        lended: _delegatedPxp.toFixed(2)
                                    }}
                                    slots={[
                                        <b className={"monospace"} key="0" style={{color: "#e0e0e0", fontWeight: 600}} />,
                                        <b className={"monospace"} key="1" style={{color: "#e0e0e0", fontWeight: 600}} />,
                                        <b className={"monospace"} key="2" style={{color: "#e0e0e0", fontWeight: 600}} />
                                    ]} />
                            </Typography>
                            <div className={classes.delegations}>
                                <List className={classes.delegationList}>
                                    <ListSubheader disableSticky style={{backgroundColor: "transparent"}}>{t("components.pixa_wallet_dialog.outgoing_2", {
                                        outgoingDelegation_count: _outgoingDelegations.length
                                    })}</ListSubheader>
                                    {_outgoingDelegations.map((d, i) => (
                                        <ListItem key={d.delegatee || i} className={classes.delegationListItem}>
                                            <ListItemAvatar>
                                                <Avatar src={d.image || ''} style={{borderRadius: "12px", cursor: "pointer", backgroundColor: "#000"}} className={"pixelated"} onClick={() => this._open_author(d.delegatee)} />
                                            </ListItemAvatar>
                                            <ListItemText primary={<span style={{cursor: "pointer"}} onClick={() => this._open_author(d.delegatee)}>{`@${d.delegatee}`}</span>} secondary={t("components.pixa_wallet_dialog.you_delegated_pxp", {
                                                pxp: d.pxp.toFixed(2)
                                            })}/>
                                            {_itsOwnProfile && <ListItemSecondaryAction>
                                                <Tooltip title={t("components.pixa_wallet_dialog.cancel_this_delegation")}>
                                                    <IconButton onClick={() => this._request_delete_delegation(d.delegatee)}><CloseIcon/></IconButton>
                                                </Tooltip>
                                            </ListItemSecondaryAction>}
                                        </ListItem>
                                    ))}
                                    {_outgoingDelegations.length === 0 && <Typography style={{color: "#666", padding: "8px 16px"}} variant="body2">{t("components.pixa_wallet_dialog.no_outgoing_delegations")}</Typography>}
                                    {_itsOwnProfile && <Tooltip title={_powerDownablePxp <= 0 ? t("components.pixa_wallet_dialog.you_dont_have_any_pxp_to_2") : ""} disableHoverListener={_powerDownablePxp > 0} disableFocusListener={_powerDownablePxp > 0} disableTouchListener={_powerDownablePxp > 0}>
                                        <span style={{width: "100%"}}><Button color="primary" variant={"contained"} className={classes.greyButton} size={"medium"} style={{width: "100%", margin: "8px 0px 16px 0px"}} onClick={this._open_delegate_dialog} disabled={_powerDownablePxp <= 0}>{t("components.pixa_wallet_dialog.delegate")} <Transfer style={{marginLeft: "8px"}}/></Button></span>
                                    </Tooltip>}
                                </List>
                                <List className={classes.delegationList}>
                                    <ListSubheader disableSticky style={{backgroundColor: "#020202"}}>{t("components.pixa_wallet_dialog.incoming", {
                                        incomingDelegation_count: _incomingDelegations.length
                                    })}</ListSubheader>
                                    {_incomingDelegations.map((d, i) => (
                                        <ListItem key={d.delegator || i} className={classes.delegationListItem}>
                                            <ListItemAvatar>
                                                <Avatar src={d.image || ''} style={{borderRadius: "12px", cursor: "pointer", backgroundColor: "#000"}} className={"pixelated"} onClick={() => this._open_author(d.delegator)} />
                                            </ListItemAvatar>
                                            <ListItemText primary={<span style={{cursor: "pointer"}} onClick={() => this._open_author(d.delegator)}>{`@${d.delegator}`}</span>} secondary={t("components.pixa_wallet_dialog.pxp_delegated_to_you", {
                                                pxp: (d.pxp || 0).toFixed(2)
                                            })}/>
                                        </ListItem>
                                    ))}
                                    {_incomingDelegations.length === 0 && <Typography style={{color: "#666", padding: "8px 16px"}} variant="body2">{t("components.pixa_wallet_dialog.no_incoming_delegations")}</Typography>}
                                    {!_itsOwnProfile && <Tooltip title="">
                                        <span style={{width: "100%"}}><Button color="primary" variant={"contained"} className={classes.greyButton} size={"medium"} style={{width: "100%", margin: "8px 0px 16px 0px"}} onClick={this._open_delegate_dialog}>{t("components.pixa_wallet_dialog.delegate")} <Transfer style={{marginLeft: "8px"}}/></Button></span>
                                    </Tooltip>}
                                </List>
                            </div>
                            <Typography component={"h2"} variant={"h6"} className={classes.subTitle}>{t("components.pixa_wallet_dialog.powering_down")}</Typography>
                            <div style={{display: "float", height: "48px"}}>
                                {_isPoweringDown
                                    ? <Tooltip title={<span className={classes.tooltip}>{t("components.pixa_wallet_dialog.weekly_rounds_remaining_pxa_per_round", {
                                        powerDownWeeksRemaining: powerDownWeeksRemaining,
                                        _nextPowerDown: _nextPowerDown.toFixed(2)
                                    })}</span>}><Typography style={{color: "#a5a5a5", lineHeight: "36px", height: "36px", verticalAlign: "middle", margin: "0px 8px 0px 0px", float: "left"}} component={"p"} variant={"body1"}>{t("components.pixa_wallet_dialog.the_next_power_down_gives_pxa_in", {
                                        nextPowerDown: _nextPowerDown.toFixed(2),
                                        nextPowerDownDays: nextPowerDownDays
                                    })}</Typography></Tooltip>
                                    : <Typography style={{color: "#a5a5a5", lineHeight: "36px", height: "36px", verticalAlign: "middle", margin: "0px 8px 0px 0px", float: "left"}} component={"p"} variant={"body1"}>{t("components.pixa_wallet_dialog.not_currently_powering_down", {
                                        text: _itsOwnProfile ? t("components.pixa_wallet_dialog.you_are") : t("components.pixa_wallet_dialog.it_is")
                                    })}</Typography>
                                }
                            </div>
                            {/* Special Features — only visible when broadcasting from a treasury account
                                (pixa.team or pixa.rex). Direct PXP transfers are off-policy for normal
                                accounts and gated server-side as well. */}
                            {this._is_special_power_account(account.username) && (
                                <React.Fragment>
                                    <Typography component={"h2"} variant={"h6"} className={classes.subTitle}>{t("components.pixa_wallet_dialog.special_features")}</Typography>
                                    <Typography style={{color: "#a5a5a5", margin: "8px 0px 0px 0px"}} component={"p"} variant={"body1"}><T
                                        k="components.pixa_wallet_dialog.strong_strong_can_transfer_pixa_power_directly"
                                        vars={{
                                            username: account.username
                                        }} /></Typography>
                                    {_itsOwnProfile && (
                                        <div style={{margin: "12px 0px 0px 0px"}}>
                                            <Tooltip title={_powerDownablePxp <= 0 ? t("components.pixa_wallet_send_dialog.you_dont_have_any_to_transfer", { currency: "PXP" }) : ""} disableHoverListener={_powerDownablePxp > 0} disableFocusListener={_powerDownablePxp > 0} disableTouchListener={_powerDownablePxp > 0}>
                                                <span style={{width: "100%"}}>
                                                    <Button color="primary" variant={"contained"} className={classes.greyButton} size={"medium"} style={{width: "100%", margin: "8px 0px 16px 0px"}} onClick={this._open_send_power_dialog} disabled={_powerDownablePxp <= 0}>
                                                        {t("components.pixa_wallet_dialog.transfer_single_sig")} <Transfer style={{marginLeft: "8px"}}/>
                                                    </Button>
                                                </span>
                                            </Tooltip>
                                        </div>
                                    )}
                                    <div style={{margin: "12px 0px 0px 0px"}}>
                                        <Button color="primary" variant={"contained"} className={classes.whiteButton} size={"medium"} style={{width: "100%", margin: "8px 0px 16px 0px"}} onClick={this._open_bulk_power_dialog}>
                                            {t("components.pixa_wallet_dialog.bulk_transfer")} <SyncAltRounded style={{marginLeft: "8px"}}/>
                                        </Button>
                                    </div>
                                </React.Fragment>
                            )}
                        </div>
                        <div className={classes.currencyActionButtons}>
                            <div>
                                <Tooltip title={!_itsOwnProfile ? t("components.pixa_wallet_dialog.not_available_on_another_users_wallet") : !_isPoweringDown ? t("components.pixa_wallet_dialog.you_are_not_currently_powering_down") : t("components.pixa_wallet_dialog.cancel_your_active_power_down")} disableHoverListener={_itsOwnProfile && _isPoweringDown} disableFocusListener={_itsOwnProfile && _isPoweringDown} disableTouchListener={_itsOwnProfile && _isPoweringDown}>
                                    <span><Button color="primary" variant={"contained"} className={classes.greyButton} style={{margin: "8px 0px 16px 0px"}} size={"large"} onClick={this._handle_cancel_power_down} disabled={!_itsOwnProfile || !_isPoweringDown}>{t("words.cancel")} <CloseIcon style={{marginLeft: "8px"}}/></Button></span>
                                </Tooltip>
                            </div>
                            <div>
                                <Tooltip title={!_itsOwnProfile ? t("components.pixa_wallet_dialog.not_available_on_another_users_wallet") : _isPoweringDown ? t("components.pixa_wallet_dialog.you_already_have_an_active_power") : _powerDownablePxp <= 0 ? t("components.pixa_wallet_dialog.you_dont_have_any_pxp_to") : ""} disableHoverListener={_itsOwnProfile && !_isPoweringDown && _powerDownablePxp > 0} disableFocusListener={_itsOwnProfile && !_isPoweringDown && _powerDownablePxp > 0} disableTouchListener={_itsOwnProfile && !_isPoweringDown && _powerDownablePxp > 0}>
                                    <span><Button color="primary" variant={"contained"} onClick={() => this._open_power_dialog("power-down")} className={classes.whiteButton} style={{margin: "8px 0px 16px 0px"}} size={"large"} disabled={!_itsOwnProfile || _isPoweringDown || _powerDownablePxp <= 0}>{t("components.pixa_wallet_dialog.power_down_2")} <HandCoin style={{marginLeft: "8px"}}/></Button></span>
                                </Tooltip>
                            </div>
                        </div>
                    </div>
                );
                break;
            case 1:
                view = (
                    <div className={classes.flexColumn2} key={"view-two"}>
                        <div>
                            <Typography component={"h2"} variant={"h6"} className={classes.subTitle}>
                            <span>
                                <span className={classes.glowText + " monospace "}>PXA {pixaDisplay}</span>
                                <IconButton onClick={this._open_pixa_info_dialog} aria-label={t("components.pixa_wallet_dialog.about_pxa")}><InfoOutlined/></IconButton>
                            </span>
                                <span>
                                <span className={"monospace"}>~ {pixaFiatDisplay}</span>
                                <span>{pixaPctDisplay}% {wealthLabel}</span>
                            </span>
                            </Typography>
                            <Typography className={classes.pricedAt} variant="body2" color="textPrimary" component="p">{t("components.pixa_wallet_dialog.priced_at_exchange", {
                                Number: ((Number(_pixaUsdPrice) || 0) * fiatRate).toFixed(4),
                                cur: cur
                            })}</Typography>
                            {_pixaBreakdown && <Typography className={classes.pricedAt} variant="body2" component="p" style={{color: "#4f4f4f"}}>{_pixaBreakdown}</Typography>}
                            <div style={{width: "100%", height: 36, display: "flow", margin: "0px 0px 16px 0px"}}>
                                <ButtonGroup disabled={_chartLoading} style={{float: "right"}}>
                                    {[
                                        { label: '1D', value: '1' },
                                        { label: '1W', value: '7' },
                                        { label: '1M', value: '30' },
                                        { label: '1Y', value: '360' },
                                    ].map(({ label, value }) => (
                                        <Button
                                            key={value}
                                            onClick={() => this._set_selected_range(value)}
                                            color={(""+_selectedRange === ""+value) ? 'secondary' : 'primary'}
                                            variant={"contained"}
                                        >
                                            {label}
                                        </Button>
                                    ))}
                                </ButtonGroup>
                            </div>
                            <ResponsiveContainer width="100%" height={_view_right_mobile_enabled ? 224: 320}>
                                <LineChart data={_data}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#2c2c2c" />
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fill: '#aaa', fontSize: 12 }}
                                        axisLine={false}
                                        tickLine={false}
                                        domain={['auto', 'auto']}
                                    />
                                    <YAxis
                                        dataKey="price"
                                        tick={{ fill: '#aaa', fontSize: 12 }}
                                        tickFormatter={(value) => `${(value * fiatRate).toFixed(3)} ${cur}`}
                                        axisLine={false}
                                        tickLine={false}
                                        domain={['auto', 'auto']}
                                    />
                                    <TooltipChart
                                        contentStyle={{
                                            backgroundColor: '#1e1e1e',
                                            border: 'none',
                                            color: '#fff',
                                        }}
                                        content={<CustomTooltip fiatRate={fiatRate} currency={cur} />}
                                        labelStyle={{ color: '#999' }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="price"
                                        stroke="#ffffff"
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                            {this._render_pending_swap_section('PXA')}
                            {this._render_savings_section('PXA')}
                            {this._render_recurrent_section('PXA')}
                        </div>
                        <div className={classes.currencyActionButtons}>
                            <div>
                                <Tooltip title={!_itsOwnProfile ? t("components.pixa_wallet_dialog.not_available_on_another_users_wallet") : _pixaBalance <= 0 ? t("components.pixa_wallet_swap_dialog.you_dont_have_any_to_swap", { currency: "PXA" }) : ""} disableHoverListener={_itsOwnProfile && _pixaBalance > 0} disableFocusListener={_itsOwnProfile && _pixaBalance > 0} disableTouchListener={_itsOwnProfile && _pixaBalance > 0}>
                                    <span><Button onClick={()=>this._open_swap_dialog("PIXA")} color="primary" variant={"contained"} className={classes.greyButton} style={{margin: "8px 0px 16px 0px"}} size={"large"} disabled={!_itsOwnProfile || _pixaBalance <= 0}>{t("words.swap")} <BankTransferOut style={{marginLeft: "8px"}}/></Button></span>
                                </Tooltip>
                                <Tooltip title={!_itsOwnProfile ? t("components.pixa_wallet_dialog.not_available_on_another_users_wallet") : _pixaBalance <= 0 ? t("components.pixa_wallet_dialog.you_dont_have_any_pxa_to") : ""} disableHoverListener={_itsOwnProfile && _pixaBalance > 0} disableFocusListener={_itsOwnProfile && _pixaBalance > 0} disableTouchListener={_itsOwnProfile && _pixaBalance > 0}>
                                    <span><Button color="primary" variant={"contained"} className={classes.greyButton} style={{margin: "8px 0px 16px 0px"}} size={"large"} onClick={() => this._open_power_dialog("power-up")} disabled={!_itsOwnProfile || _pixaBalance <= 0}>{t("components.pixa_wallet_dialog.power_up")} <LightningBoltCIrcle style={{marginLeft: "8px"}}/></Button></span>
                                </Tooltip>
                            </div>
                            <div>
                                <Tooltip title={_itsOwnProfile && _pixaBalance <= 0 ? t("components.pixa_wallet_send_dialog.you_dont_have_any_to_transfer", { currency: "PXA" }) : ""} disableHoverListener={_itsOwnProfile ? _pixaBalance > 0 : true} disableFocusListener={_itsOwnProfile ? _pixaBalance > 0 : true} disableTouchListener={_itsOwnProfile ? _pixaBalance > 0 : true}>
                                    <span><Button color="primary" variant={"contained"} onClick={() => {this._open_send_dialog("PIXA");}} className={classes.whiteButton} style={{margin: "8px 0px 16px 0px"}} size={"large"} disabled={_itsOwnProfile ? _pixaBalance <= 0 : false}>{_itsOwnProfile ? <React.Fragment>{t("components.pixa_wallet_dialog.transfer")} <CashFast style={{marginLeft: "8px"}}/></React.Fragment> : <React.Fragment><span style={{display: "grid", textAlign: "center", lineHeight: "1.3"}}>{t("words.transfer", {TUC: true})}<br/><span style={{fontSize: "0.75em"}}>{t("components.pixa_wallet_dialog.to", {
                                        username: account.username
                                    })}</span></span> <CashFast style={{marginLeft: "8px"}}/></React.Fragment>}</Button></span>
                                </Tooltip>
                            </div>
                        </div>
                    </div>
                );
                break;
            case 2:
                view = (
                    <div className={classes.flexColumn2} key={"view-three"}>
                        <div>
                            <Typography component={"h2"} variant={"h6"} className={classes.subTitle}>
                                <span>
                                    <span className={classes.glowText + " monospace "}>PXS {pxsDisplay}</span>
                                    <IconButton onClick={this._open_supra_info_dialog} aria-label={t("components.pixa_wallet_dialog.about_pxs")}><InfoOutlined/></IconButton>
                                </span>
                                <span>
                                    <span className={"monospace"}>~ {pxsFiatDisplay}</span>
                                    <span>{pxsPctDisplay}% {wealthLabel}</span>
                                </span>
                            </Typography>
                            <Typography className={classes.pricedAt} variant="body2" color="textPrimary" component="p">{t("components.pixa_wallet_dialog.priced_at_witness_feed", {
                                Number: ((Number(_pxsUsdPrice) || 0) * fiatRate).toFixed(2),
                                cur: cur
                            })}</Typography>
                            {_pxsBreakdown && <Typography className={classes.pricedAt} variant="body2" component="p" style={{color: "#4f4f4f"}}>{_pxsBreakdown}</Typography>}
                            <ResponsiveContainer width="100%" height={_view_right_mobile_enabled ? 128: 178} style={{margin: "16px 0px 8px 0px"}}>
                                <LineChart data={_bigmac}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#2c2c2c" />
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fill: '#aaa', fontSize: 12 }}
                                        axisLine={false}
                                        tickLine={false}
                                        domain={['auto', 'auto']}
                                    />
                                    <YAxis
                                        dataKey="price"
                                        tick={{ fill: '#aaa', fontSize: 12 }}
                                        tickFormatter={(value) => `${(value * fiatRate).toFixed(2)} ${cur}`}
                                        axisLine={false}
                                        tickLine={false}
                                        domain={['auto', 'auto']}
                                    />
                                    <TooltipChart
                                        contentStyle={{
                                            backgroundColor: '#1e1e1e',
                                            border: 'none',
                                            color: '#fff',
                                        }}
                                        content={<CustomTooltip fiatRate={fiatRate} currency={cur} />}
                                        labelStyle={{ color: '#999' }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="price"
                                        stroke="#ffffff"
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                            <Typography style={{marginBottom: 16}} variant="body2" color="textSecondary" component="p">
                                {t("components.pixa_wallet_dialog.the_big_mac_index_is_a_renown")}
                            </Typography>
                            {this._render_pending_swap_section('PXS')}
                            {this._render_savings_section('PXS')}
                            {this._render_recurrent_section('PXS')}
                        </div>
                        <div className={classes.currencyActionButtons}>
                            <div>
                                <Tooltip title={!_itsOwnProfile ? t("components.pixa_wallet_dialog.not_available_on_another_users_wallet") : _pxsBalance <= 0 ? t("components.pixa_wallet_swap_dialog.you_dont_have_any_to_swap", { currency: "PXS" }) : ""} disableHoverListener={_itsOwnProfile && _pxsBalance > 0} disableFocusListener={_itsOwnProfile && _pxsBalance > 0} disableTouchListener={_itsOwnProfile && _pxsBalance > 0}>
                                    <span><Button onClick={()=>this._open_swap_dialog("SUPRA")} color="primary" variant={"contained"} className={classes.greyButton} style={{margin: "8px 0px 16px 0px"}} size={"large"} disabled={!_itsOwnProfile || _pxsBalance <= 0}>{t("words.swap")} <BankTransferOut style={{marginLeft: "8px"}}/></Button></span>
                                </Tooltip>
                            </div>
                            <div>
                                <Tooltip title={_itsOwnProfile && _pxsBalance <= 0 ? t("components.pixa_wallet_send_dialog.you_dont_have_any_to_transfer", { currency: "PXS" }) : ""} disableHoverListener={_itsOwnProfile ? _pxsBalance > 0 : true} disableFocusListener={_itsOwnProfile ? _pxsBalance > 0 : true} disableTouchListener={_itsOwnProfile ? _pxsBalance > 0 : true}>
                                    <span><Button color="primary" variant={"contained"} className={classes.whiteButton} style={{margin: "8px 0px 16px 0px"}} size={"large"} onClick={() => {this._open_send_dialog("SUPRA");}} disabled={_itsOwnProfile ? _pxsBalance <= 0 : false}>{_itsOwnProfile ? <React.Fragment>{t("components.pixa_wallet_dialog.transfer")} <CashFast style={{marginLeft: "8px"}}/></React.Fragment> : <React.Fragment><span style={{display: "grid", textAlign: "center", lineHeight: "1.3"}}>{t("words.transfer", {TUC: true})}<br/><span style={{fontSize: "0.75em"}}>{t("components.pixa_wallet_dialog.to", {
                                        username: account.username
                                    })}</span></span> <CashFast style={{marginLeft: "8px"}}/></React.Fragment>}</Button></span>
                                </Tooltip>
                            </div>
                        </div>
                    </div>
                );
                break;
            case 3:
                view = (
                    <div className={classes.flexColumn2} key={"view-four"}>
                        <div>
                            <Typography component={"h2"} variant={"h5"} style={{fontWeight: "600", color: "#ffffff"}} className={classes.subTitle}>
                                {t("components.pixa_wallet_dialog.transactions")}
                                <Tooltip interactive enterTouchDelay={200} leaveTouchDelay={4000} classes={{ tooltip: classes.tooltipRoot }} title={<span className={classes.tooltip}>{t("components.pixa_wallet_dialog.beware_of_spam_and_phishing_links_in")}</span>}>
                                    <IconButton><InfoOutlined/></IconButton>
                                </Tooltip>
                            </Typography>
                            {hasRewards && <Button className={classes.rewardClaim} color="primary" variant="text" onClick={this._claim_rewards} disabled={!_itsOwnProfile}><span style={{display: "inline"}}>{t("components.pixa_wallet_dialog.claim_reward")}</span> <span className={"subtitle"} style={{display: "inline", fontWeight: "400"}}>{t("components.pixa_wallet_dialog.pxa_pxs_pxp_2", {
                                rewardPixa: _rewardPixa.toFixed(0),
                                rewardPxs: _rewardPxs.toFixed(0),
                                rewardPxp: _rewardPxp.toFixed(0)
                            })}</span></Button>}
                            <WalletHistory
                                history={_walletHistory}
                                username={account.username}
                                locales={locales}
                                vestToPixa={this.state._vestToPixa}
                            />
                        </div>
                    </div>
                );
                break;
        }

        _views[parseInt(_tab_value)] = view;

        const card = _view_right_mobile_enabled ?
            (<Card className={classes.dialogCard}>
                <div style={{width: "calc(100% - 0px)", display: "inline-block", marginTop: "8px", height: "calc(100% - 0px)"}}>
                    <DialogTitle style={{position: "relative", display: "flex", padding: "0px 16px 8px 16px", margin: "16px 4px 4px 4px"}}>
                        <Fade in={open} timeout={250}>
                            <Typography component={"h1"} variant={"h4"} style={{float: "left", width: "100%", margin: "0px 0px 8px 0px"}}>@{account.username}</Typography>
                        </Fade>
                        <Fade in={open} timeout={350}>
                            <Button
                                variant={"contained"}
                                size={"small"}
                                className={`${classes.totalButton} ${_tab_value === false ? 'active' : ''} monospace`}
                                onClick={() => this._handle_tab_value_change({}, false)}
                                data-tour="wallet-total"
                            >
                                {totalFiatDisplay}
                            </Button>
                        </Fade>
                    </DialogTitle>
                    <Fade in={open} timeout={500}>
                        <Tabs
                            ref={this.setTabsRef}
                            orientation="horizontal"
                            data-tour="wallet-tabs"
                            value={_tab_value}
                            onChange={(a, b) => this._handle_tab_value_change(a, b)}
                            indicatorColor="primary"
                            textColor="primary"
                            className={_tab_value === false ? classes.tabsDisactivated: classes.tabs}
                        >
                            <Fade in={open} timeout={600}>
                                <Tab label={t("components.pixa_wallet_dialog.power")} icon={<PixaPower style={{transform: "scale(1.35)"}}/>} />
                            </Fade>
                            <Fade in={open} timeout={800}>
                                <Tab label={t("components.pixa_wallet_dialog.pixa")} icon={<PixaLiquid style={{transform: "scale(1.1)"}}/>} />
                            </Fade>
                            <Fade in={open} timeout={1000}>
                                <Tab label={t("components.pixa_wallet_dialog.supra")} icon={<PixaSupra style={{transform: "scale(0.85)"}} />} />
                            </Fade>
                            <Fade in={open} timeout={1200}>
                                <Tab label={t("words.history")} icon={<HistoryRounded/>}  style={{marginLeft: _margin_last_tab}}/>
                            </Fade>
                        </Tabs>
                    </Fade>
                    <DialogContent className={classes.dialogContent}>
                        <Fade in={open} timeout={700}>
                            <div className={classes.mobileOuterSwipe}>
                                <SwipeableViews
                                    axis="y"
                                    ignoreNativeScroll={true}
                                    containerStyle={{height: "100%"}}
                                    animateHeight={false}
                                    animateTransitions={true}
                                    disableLazyLoading={true}
                                    resistance={true}
                                    springConfig={{tension: 450, friction: 60, duration: '240ms', easeFunction: 'cubic-bezier(0.280, 0.840, 0.420, 1)', delay: '5ms'}}
                                    index={_tab_value === false ? 0: 1}
                                    onChangeIndex={(v) => {
                                        this._handle_tab_value_change({}, v ? 0: false);
                                    }}
                                    key={"swipe-able-view-mobile-y"}
                                >
                                    {_overview}
                                    <div
                                        ref={this._setDetailRef}
                                        className={classes.mobileDetailWrapper}
                                    >
                                        <SwipeableViews
                                            ignoreNativeScroll={true}
                                            containerStyle={{height: "100%"}}
                                            animateHeight={false}
                                            animateTransitions={true}
                                            disableLazyLoading={true}
                                            resistance={true}
                                            springConfig={{tension: 450, friction: 60, duration: '240ms', easeFunction: 'cubic-bezier(0.280, 0.840, 0.420, 1)', delay: '5ms'}}
                                            index={Math.max(0, _tab_value)}
                                            onChangeIndex={(v) => this._handle_tab_value_change({}, v)}
                                            disabled={false}
                                            key={"swipe-able-view-mobile-x"}
                                        >
                                            {_views}
                                        </SwipeableViews>
                                    </div>
                                </SwipeableViews>
                            </div>
                        </Fade>
                    </DialogContent>
                </div>
                <IconButton onClick={this.props.onClose} style={{position: "absolute", right: 24, top: 24}} variant={"contained"} className={classes.blackButton}><CloseRounded/></IconButton>
            </Card>):
            (<Card className={classes.dialogCard}>
                <div style={{width: "128px"}}>
                    <Tabs
                        ref={this.setTabsRef}
                        orientation="vertical"
                        data-tour="wallet-tabs"
                        value={_tab_value}
                        onChange={(a, b) => this._handle_tab_value_change(a, b)}
                        indicatorColor="primary"
                        textColor="primary"
                        className={_tab_value === false ? classes.tabsDisactivated: classes.tabs}
                    >
                        <Fade in={open} timeout={600}>
                            <Tab label={t("components.pixa_wallet_dialog.power")} icon={<PixaPower style={{transform: "scale(1.35)"}}/>} />
                        </Fade>
                        <Fade in={open} timeout={800}>
                            <Tab label={t("components.pixa_wallet_dialog.pixa")} icon={<PixaLiquid style={{transform: "scale(1.1)"}}/>} />
                        </Fade>
                        <Fade in={open} timeout={1000}>
                            <Tab label={t("components.pixa_wallet_dialog.supra")} icon={<PixaSupra style={{transform: "scale(0.85)"}} />} />
                        </Fade>
                        <Fade in={open} timeout={1200}>
                            <Tab label={t("words.history")} icon={<HistoryRounded/>}  style={{marginTop: _margin_last_tab}}/>
                        </Fade>
                    </Tabs>
                    <div style={{backgroundImage: cssBackgroundImage(account._profile?.profile_image), backgroundSize: "cover", backgroundPosition: "center", borderRadius: "21px", width: "88px", height: "88px", position: "absolute", top: "20px", left: "20px", cursor: "pointer", backgroundColor: "#000"}} className={"pixelated"}/>
                </div>
                <div style={{width: "calc(100% - 128px)", display: "inline-block", marginTop: "8px", height: "calc(100% + 8px)"}}>
                    <DialogTitle style={{position: "relative", display: "flex", padding: "8px 16px 8px 4px", margin: "4px 0px 4px 4px"}}>
                        <Fade in={open} timeout={250}>
                            <Typography component={"h1"} variant={"h4"} style={{float: "left", width: "100%", margin: "0px 0px 8px 0px"}}>@{account.username}</Typography>
                        </Fade>
                        <Fade in={open} timeout={350}>
                            <Typography component={"h2"} variant={"h5"} style={{position: "relative", color: "#818181", float: "left", width: "100%", margin: "0px", fontWeight: "400"}}>
                                <span>{t("components.pixa_wallet_dialog.estimated_wealth")} </span>
                                <Button
                                    variant={"contained"}
                                    size={"large"}
                                    className={`${classes.totalButton} ${_tab_value === false ? 'active' : ''} monospace`}
                                    onClick={() => this._handle_tab_value_change({}, false)}
                                    data-tour="wallet-total"
                                >
                                    {totalFiatDisplay}
                                </Button>
                            </Typography>
                        </Fade>
                    </DialogTitle>
                    <DialogContent className={classes.dialogContent}>
                        <Fade in={open} timeout={700}>
                            <SwipeableViews
                                ignoreNativeScroll={true}
                                containerStyle={{height: "100%"}}
                                animateHeight={false}
                                animateTransitions={true}
                                disableLazyLoading={true}
                                resistance={true}
                                springConfig={{tension: 450, friction: 60, duration: '360ms', easeFunction: 'cubic-bezier(0.280, 0.840, 0.420, 1)', delay: '5ms'}}
                                index={_tab_value === false ? 1: 0}
                                onChangeIndex={(v) => this._handle_tab_value_change({}, v ? 0: false)}
                                disabled={false}
                                key={"swipe-able-view-desktop-x"}
                            >
                                <SwipeableViews
                                    axis="y"
                                    ignoreNativeScroll={true}
                                    containerStyle={{height: "100%"}}
                                    animateHeight={false}
                                    animateTransitions={true}
                                    disableLazyLoading={true}
                                    resistance={true}
                                    springConfig={{tension: 450, friction: 60, duration: '360ms', easeFunction: 'cubic-bezier(0.280, 0.840, 0.420, 1)', delay: '5ms'}}
                                    index={Math.max(0, _tab_value)}
                                    onChangeIndex={(v) => this._handle_tab_value_change({}, v)}
                                    disabled={false}
                                    key={"swipe-able-view-desktop-y"}
                                >
                                    {_views}
                                </SwipeableViews>
                                {_overview}
                            </SwipeableViews>
                        </Fade>
                    </DialogContent>
                </div>
            </Card>);
        return (
            <React.Fragment>
                <Portal>
                    <Backdrop open={open} className={classes.backdrop}>
                        <div style={{width: "100%", height: "100%", position: "absolute"}} onClick={() => {this.props.onClose()}}></div>
                        {card}
                    </Backdrop>
                    <Dialog open={_confirm_action_open}
                            maxWidth={"xs"}
                            onClose={this._close_confirm_action}
                            PaperProps={{style: {backgroundColor: "#ffffff", color: "#111111"}}}>
                        <DialogContent>
                            <Typography style={{marginTop: 8, marginBottom: 16, color: "#111"}} component={"h2"} variant={"h6"}>{_confirm_action_title}</Typography>
                            <Typography style={{color: "#444", fontSize: "14px", lineHeight: "1.6"}} variant="body2" component="p">{_confirm_action_body}</Typography>
                        </DialogContent>
                        <DialogActions style={{textAlign: "right", padding: "8px 24px 16px"}}>
                            <Button variant="text" style={{color: "#444"}} onClick={this._close_confirm_action}>{t("words.cancel")}</Button>
                            <Button variant="contained" style={{backgroundColor: "#111", color: "#fff"}} onClick={this._execute_confirm_action}>{t("words.confirm")}</Button>
                        </DialogActions>
                    </Dialog>
                </Portal>
                {this.state._tour_steps ? (
                    <React.Suspense fallback={null}>
                        <LazyTour steps={this.state._tour_steps} onFinish={this._finish_tour} />
                    </React.Suspense>
                ) : null}
                <PixaWalletPowerDialog type={_power_dialog_opened} open={_power_dialog_opened.length} onClose={this._close_power_dialog} onConfirm={this._handle_power_confirm} api={this.state.api} account={account} maxPXP={_powerDownablePxp} maxPXA={_pixaBalance}/>
                <PixaWalletSendDialog type={_send_dialog_opened} open={_send_dialog_opened.length} onToggleCurrency={this._open_send_dialog} onClose={this._close_send_dialog} api={this.state.api} account={_itsOwnProfile ? account : broadcastAccount} maxPXA={_itsOwnProfile ? _pixaBalance : 999999999} maxPXS={_itsOwnProfile ? _pxsBalance : 999999999} onSend={this._handle_send_confirm} initialUsername={!_itsOwnProfile ? account.username : undefined} lockedUsername={!_itsOwnProfile}/>
                <PixaWalletKeysDialog type={_keys_dialog_opened} open={_keys_dialog_opened.length} onClose={this._close_keys_dialog} api={this.state.api} account={account} isOwnProfile={_itsOwnProfile}/>
                <PixaWalletSwapDialog type={_swap_dialog_opened} open={_swap_dialog_opened.length} onToggleCurrency={this._open_swap_dialog} onClose={this._close_swap_dialog} api={this.state.api} maxPXA={_pixaBalance} maxPXS={_pxsBalance} onConfirm={this._handle_swap_confirm}/>
                <PixaWalletDelegateDialog open={_delegate_dialog_opened} onClose={this._close_delegate_dialog} api={this.state.api} account={_itsOwnProfile ? account : broadcastAccount} maxPXP={_itsOwnProfile ? _powerDownablePxp : 999999999} onDelegate={this._handle_delegate_confirm} initialDelegatee={!_itsOwnProfile ? account.username : undefined} lockedDelegatee={!_itsOwnProfile}/>
                <PixaWalletSendPowerDialog open={_send_power_dialog_opened} onClose={this._close_send_power_dialog} api={this.state.api} account={broadcastAccount} maxPXP={_powerDownablePxp} onSendPower={this._handle_send_power_confirm}/>
                <CreateBulkAccountDialog open={_bulk_create_dialog_opened} onClose={this._close_bulk_create_dialog} api={this.state.api} creator={"initminer"} liquidSymbol={this.state._LIQUID_SYMBOL}/>
                <PixaWalletBulkPowerDialog open={_bulk_power_dialog_opened} onClose={this._close_bulk_power_dialog} api={this.state.api} account={account} pixaToVest={this.state._pixaToVest} maxPXP={_powerDownablePxp} vestsSymbol={this.state._VESTS_SYMBOL} onBroadcasted={this._refresh_after_tx}/>
                <PixaWalletSupraInfoDialog open={_supra_info_dialog_opened} onClose={this._close_supra_info_dialog}/>
                <PixaWalletPowerInfoDialog open={_power_info_dialog_opened} onClose={this._close_power_info_dialog}/>
                <PixaWalletPixaInfoDialog open={_pixa_info_dialog_opened} onClose={this._close_pixa_info_dialog}/>
                <PixaWalletSavingsDialog type={_savings_dialog_opened} open={_savings_dialog_opened.length} mode={_savings_dialog_mode} onClose={this._close_savings_dialog} api={this.state.api} account={account} maxDeposit={_savings_dialog_opened === "PIXA" ? _pixaBalance : _pxsBalance} maxWithdraw={_savings_dialog_opened === "PIXA" ? _savingsPixa : _savingsPxs} onConfirm={this._handle_savings_confirm}/>
                <PixaWalletTaxesDialog open={_taxes_dialog_opened} onClose={this._close_taxes_dialog} api={this.state.api} account={account} fiatRate={fiatRate} fiatCurrency={cur} vestToPixa={this.state._vestToPixa} pixaToVest={this.state._pixaToVest} globalProps={this.state._globalProps}/>
            </React.Fragment>
        );
    }
}

export default withLanguage(withStyles(styles)(PixaWalletDialog));