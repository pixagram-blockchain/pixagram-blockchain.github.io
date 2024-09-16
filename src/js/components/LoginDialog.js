import * as React from "preact/compat";
import { memo, useCallback, useMemo, useState } from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import InputAdornment from "@material-ui/core/InputAdornment";
import SwipeableViews from 'react-swipeable-views';
import Typography from "@material-ui/core/Typography";
import AccountRemove from "../icons/AccountRemove";
import AccountQuestion from "../icons/AccountQuestion";
import AccountCheck from "../icons/AccountCheck";
import OutlinedInput from "@material-ui/core/OutlinedInput";
import CircularProgress from "@material-ui/core/CircularProgress";
import IconButton from "@material-ui/core/IconButton";
import Box from "@material-ui/core/Box";
import Collapse from "@material-ui/core/Collapse";
import Visibility from "@material-ui/icons/Visibility";
import VisibilityOff from "@material-ui/icons/VisibilityOff";
import Step from "@material-ui/core/Step";
import StepLabel from "@material-ui/core/StepLabel";
import Stepper from "@material-ui/core/Stepper";
import Fade from "@material-ui/core/Fade";
import Accordion from '@material-ui/core/Accordion';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ErrorRounded from "@material-ui/icons/ErrorRounded";
import CheckRounded from "@material-ui/icons/CheckRounded";
import Tooltip from "@material-ui/core/Tooltip";
import Slider from "@material-ui/core/Slider";
import Switch from "@material-ui/core/Switch";
import Chip from "@material-ui/core/Chip";
import ToggleButton from "@material-ui/lab/ToggleButton";
import ToggleButtonGroup from "@material-ui/lab/ToggleButtonGroup";
import Link from "@material-ui/core/Link";
import CloseIcon from "@material-ui/icons/Close";
import LockOutlined from "@material-ui/icons/LockOutlined";
import VpnKeyOutlined from "@material-ui/icons/VpnKeyOutlined";
import TimerOutlined from "@material-ui/icons/TimerOutlined";
import SecurityOutlined from "@material-ui/icons/SecurityOutlined";
import BatteryChargingFullOutlined from "@material-ui/icons/BatteryChargingFullOutlined";
import CropFreeIcon from "@material-ui/icons/CropFree";

import Avatar from "@material-ui/core/Avatar";
import Autocomplete from '@material-ui/lab/Autocomplete';
import TextField from "@material-ui/core/TextField";
import Checkbox from "@material-ui/core/Checkbox";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import { lazyDialog } from "./LazyDialog";
const QRScannerDialog = lazyDialog(() => import("./QrScanner"), { name: "QRScanner" });
import InfoOutlined from "@material-ui/icons/InfoOutlined";
import WarningRounded from "@material-ui/icons/WarningRounded";


import { T } from "../utils/T";
import { t, useLanguage } from "../utils/text";
import * as actions from "../actions/utils";


import { withLanguage } from "../utils/withLanguage";
// ============================================
// Branding
// ============================================

// Pixagram app-icon logo (inline SVG — white rounded square + glyph).
const PIXAGRAM_LOGO = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHN0eWxlPSJpc29sYXRpb246aXNvbGF0ZSIgdmlld0JveD0iMCAwIDIwMDAgMjAwMCIgd2lkdGg9IjIwMDBwdCIgaGVpZ2h0PSIyMDAwcHQiPjxkZWZzPjxjbGlwUGF0aCBpZD0iYSI+PHBhdGggZD0iTTAgMGgyMDAwdjIwMDBIMHoiLz48L2NsaXBQYXRoPjwvZGVmcz48ZyBjbGlwLXBhdGg9InVybCgjYSkiPjxjbGlwUGF0aCBpZD0iYiI+PHBhdGggZmlsbD0iI0ZGRiIgZD0iTTAgMGgyMDAwdjIwMDBIMHoiLz48L2NsaXBQYXRoPjxnIGNsaXAtcGF0aD0idXJsKCNiKSI+PGNsaXBQYXRoIGlkPSJjIj48cGF0aCBmaWxsPSIjRkZGIiBkPSJNMCAwaDIwMDB2MjAwMEgweiIvPjwvY2xpcFBhdGg+PGcgY2xpcC1wYXRoPSJ1cmwoI2MpIj48cGF0aCBkPSJNMzcwIDI1MGgxMjYwYzY2LjIzIDAgMTIwIDUzLjc3IDEyMCAxMjB2MTI2MGMwIDY2LjIzLTUzLjc3IDEyMC0xMjAgMTIwSDM3MGMtNjYuMjMgMC0xMjAtNTMuNzctMTIwLTEyMFYzNzBjMC02Ni4yMyA1My43Ny0xMjAgMTIwLTEyMHoiIGZpbGw9IiNGRkYiLz48cGF0aCBkPSJNMTU1Mi40ODUgNDA1LjY4MmMyNS42NjcuNSAzOS42NjcgMTQuNSA0MC44MzMgNDIuMTY2djIxOC40NTljMCAyMS43MzItMTEuNzYyIDM5LjM3NS0yNi4yNSAzOS4zNzVoLTk3LjVjLTE0LjQ4OCAwLTI2LjI1LTE3LjY0My0yNi4yNS0zOS4zNzV2LTYyLjVxLTYuMDYyLTQwLjUtNDguNDM3LTQ4LjEyNWgtNjIuMTg4Yy0yMS43MzIgMC0zOS4zNzUtMTEuNzYyLTM5LjM3NS0yNi4yNXYtOTcuNWMwLTE0LjQ4OCAxNy42NDMtMjYuMjUgMzkuMzc1LTI2LjI1aDIxOS43OTJ6TTkyNSAxMzc1aDM5Ny41YzI4Ljk3NiAwIDUyLjUtMjMuNTI0IDUyLjUtNTIuNXYtNjQ1YzAtMjguOTc2LTIzLjUyNC01Mi41LTUyLjUtNTIuNWgtNjQ1Yy0yOC45NzYgMC01Mi41IDIzLjUyNC01Mi41IDUyLjVWMTc1MGgzMDB2LTM3NXoiIGZpbGw9IiM0ODQ4NDgiLz48cGF0aCBkPSJNOTExLjI1IDg3NWgxNzcuNWMyMC4wMDcgMCAzNi4yNSAxNi4yNDMgMzYuMjUgMzYuMjV2MTc3LjVjMCAyMC4wMDctMTYuMjQzIDM2LjI1LTM2LjI1IDM2LjI1aC0xNzcuNWMtMjAuMDA3IDAtMzYuMjUtMTYuMjQzLTM2LjI1LTM2LjI1di0xNzcuNWMwLTIwLjAwNyAxNi4yNDMtMzYuMjUgMzYuMjUtMzYuMjV6IiBmaWxsPSIjRkZGIi8+PC9nPjwvZz48L2c+PC9zdmc+";


// ============================================
// Password Analysis Utility
// ============================================

function analyzePassword(pw) {
    const hasLower  = /[a-z]/.test(pw);
    const hasUpper  = /[A-Z]/.test(pw);
    const hasDigit  = /\d/.test(pw);
    const hasSymbol = /[^a-zA-Z0-9]/.test(pw);
    const types     = [hasLower, hasUpper, hasDigit, hasSymbol];
    const typeCount = types.filter(Boolean).length;
    const MIN_BY_TYPES = { 4: 8, 3: 9, 2: 11, 1: 14, 0: 0 };
    const REC_BY_TYPES = { 4: 10, 3: 11, 2: 12, 1: 16, 0: 0 };
    const minRequired   = MIN_BY_TYPES[typeCount] || 14;
    const recommended   = REC_BY_TYPES[typeCount] || 16;
    return {
        hasLower, hasUpper, hasDigit, hasSymbol,
        typeCount, minRequired, recommended,
        meetsMinimum: pw.length >= minRequired,
        meetsRecommended: pw.length >= recommended,
        length: pw.length,
    };
}

function encryptionProfileLabel(label) {
    return { ultra: 'Very High', high: 'High', standard: 'Standard', low: 'Low' }[label] || 'Standard';
}

const PASSWORD_EXAMPLES = [
    { original: 'Bellissimo',  modified: 'Be11i$$imo'  },
    { original: 'Croissant',   modified: 'Cr0i$$ant<3'  },
    { original: 'Astronaut',   modified: 'A$tr0naut?'  },
    { original: 'Chocolate',   modified: '_Ch0c0l@te$_'  },
    { original: 'Pineapple',   modified: '(P1ne@ppl3)'  },
    { original: 'Butterfly',   modified: '=Butt3rFly$'  },
    { original: 'Cinnamon',    modified: '.C1nn@m0n!'   },
    { original: 'Spaghetti',   modified: '$p@gh3tti&!!'  },
    { original: 'Kangaroo',    modified: '&-K@ng@r00!'   },
    { original: 'Espresso',    modified: '+E$pr3$$o'   },
];

function pickExamples(n = 3) {
    const shuffled = [...PASSWORD_EXAMPLES].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
}

const styles = theme => ({
    backdrop: {
        zIndex: "1301",
        color: '#fff',
    },
    popper: {
        backgroundColor: "#242424ff !important"
    },
    whiteButton: {
        "&.MuiButton-contained": {
            backgroundColor: "#ffffff",
            color: "#000000",
            transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,border 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
        },
        "&.MuiButton-contained:hover": {
            backgroundColor: "#e8e8e8",
            color: "#000000",
            transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,border 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
        }
    },
    dialog: {
        // NOTE: was "&.MuiDialog-paperFullWidth" (same-element selector) which
        // never matched — classes.dialog sits on the Dialog *root*, the paper
        // is a descendant. Fixed to a descendant selector so the cap applies.
        // Compact login: 420px. The advanced (stepper) mode keeps the same
        // width — all step-2/3 controls already work at phone widths.
        "& .MuiDialog-paperFullWidth": {
            width: "min(100%, 420px) !important"
        },
        // Fullscreen (mobile): size the paper to the *visual* viewport so the
        // bottom action bar is never hidden behind the on-screen keyboard.
        // Mobile browsers shrink only the visual viewport when the keyboard
        // opens — the layout viewport (what 100%/100vh measure) keeps its
        // full height. --lgd-vvh / --lgd-vvt are kept in sync by
        // _updateVisualViewport().
        "& .MuiDialog-paperFullScreen": {
            height: "var(--lgd-vvh, 100%)",
            maxHeight: "var(--lgd-vvh, 100%)",
            minHeight: 0,
            margin: 0,
            // Pin the paper to the TOP of the dialog container. The
            // scrollPaper container is a flexbox with align-items:center,
            // so as soon as the paper is shorter than 100% (keyboard open,
            // height = --lgd-vvh) it floats vertically centered — gap above,
            // action bar pushed below the keyboard. flex-start keeps its top
            // edge at the layout-viewport top, which translateY(--lgd-vvt)
            // then maps onto the *visual* viewport top.
            alignSelf: "flex-start",
            // Follow the visual viewport when iOS Safari scrolls the page on
            // input focus (fixed elements stay glued to the layout viewport).
            transform: "translateY(var(--lgd-vvt, 0px))",
        }
    },
    // Scrollable middle region: absorbs all space between the stepper and the
    // action bar (paper is a flex column), so the fields stay at the top, the
    // empty space lives here, and CANCEL/the confirm button stay pinned at the
    // bottom — visible even when the keyboard shrinks the dialog.
    swipeableContainer: {
        flex: 1,
        minHeight: 0,
        overflow: "auto",
        "& .react-swipeable-view-container": {
            height: "100%",
        },
        "& .react-swipeable-view-container > div": {
            overflowY: "auto !important",
            overflowX: "hidden !important",
        },
    },
    dialogActions: {
        textAlign: "right",
        flexShrink: 0,
        [theme.breakpoints.down("md")]: {
            // Keep the buttons clear of the iOS home indicator in fullscreen.
            paddingBottom: "max(8px, env(safe-area-inset-bottom))",
        }
    },
    // ── Compact login header (logo + name + tagline) ────────────────────
    header: {
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: "28px 24px 12px 24px",
        flexShrink: 0,
        transition: "padding 250ms cubic-bezier(0.4, 0, 0.2, 1)",
    },
    headerCompact: {
        // Advanced mode: reclaim vertical space for the stepper + steps.
        padding: "16px 24px 4px 24px",
    },
    headerLogo: {
        width: "84px",
        height: "84px",
        userSelect: "none",
        pointerEvents: "none",
        transition: "width 250ms cubic-bezier(0.4, 0, 0.2, 1), height 250ms cubic-bezier(0.4, 0, 0.2, 1)",
    },
    headerLogoCompact: {
        width: "44px",
        height: "44px",
    },
    headerTitle: {
        marginTop: "8px",
        fontWeight: 500,
    },
    headerTagline: {
        marginTop: "4px",
        fontSize: "13px",
        color: "#9b9b9b",
        letterSpacing: "0.4px",
    },
    closeButton: {
        position: "absolute",
        top: "8px",
        right: "8px",
        color: "#9b9b9b",
        "&:hover": {
            color: "#ffffff",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
        }
    },
    // ── Simple-mode footer (full-width login + text links) ──────────────
    simpleFooter: {
        flexShrink: 0,
        padding: "4px 24px 20px 24px",
        [theme.breakpoints.down("md")]: {
            paddingBottom: "max(20px, env(safe-area-inset-bottom))",
        }
    },
    footerLine: {
        flexShrink: 0,
        textAlign: "center",
        fontSize: "13px",
        color: "#9b9b9b",
        marginTop: "14px",
    },
    footerLink: {
        color: "#ffffff",
        fontWeight: 600,
        cursor: "pointer",
        fontSize: "inherit",
        fontFamily: "inherit",
        verticalAlign: "baseline",
        textDecorationColor: "rgba(255, 255, 255, 0.5)",
        "&:hover": {
            color: "#e8e8e8",
        }
    },
    buttonNotDisabled: {
        "&.MuiButtonBase-root.Mui-disabled": {
            cursor: "help",
            pointerEvents: "all"
        }
    },
    inputEndAdornment: {
        "& .MuiIconButton-root.Mui-disabled": {
            color: "#7b7b7b",
        },
        "& .MuiCircularProgress-colorSecondary": {
            color: "#7b7b7b",
            marginLeft: "8px"
        }
    },
    keyTypeToggleGroup: {
        marginTop: "16px",
        marginBottom: "16px",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        "& .MuiToggleButtonGroup-grouped": {
            border: "1px solid #4a4a4a",
            padding: "8px 16px",
            [theme.breakpoints.down("md")]: {
                padding: "6px 12px",
            },
            flex: "auto",
            textTransform: "none",
            fontSize: "13px",
            fontWeight: 500,
            color: "#b0b0b0",
            backgroundColor: "#171717",
            transition: "color 125ms cubic-bezier(0.4, 0, 0.2, 1) 25ms, background-color 175ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
            "&:not(:first-child)": {
                borderLeft: "1px solid #4a4a4a",
                marginLeft: "-1px",
            },
            "&:first-child": {
                borderTopLeftRadius: "16px",
                borderBottomLeftRadius: "16px",
            },
            "&:last-child": {
                borderTopRightRadius: "16px",
                borderBottomRightRadius: "16px",
            },
            "&:hover": {
                backgroundColor: "#222",
                color: "#fff",
                zIndex: 1,
            },
            "&.Mui-selected": {
                backgroundColor: "#fff",
                color: "#222",
                borderColor: "#fff",
                zIndex: 2,
                "&:hover": {
                    color: "#000",
                }
            },
            "&.Mui-disabled": {
                opacity: 0.4,
                color: "#666",
            }
        }
    },
    qrScanButton: {
        padding: "8px",
        color: "#9b9b9b",
        "&:hover": {
            color: "#ffffff",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
        }
    },
    sliderContainer: {
        padding: "16px 8px",
        marginTop: "8px",
    },
    sliderLabel: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "8px",
        "& .MuiSvgIcon-root": {
            marginRight: "8px",
            color: "#7b7b7b",
        }
    },
    keyToggleRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 0",
        borderBottom: "1px solid #333",
        "&:last-child": {
            borderBottom: "none",
        }
    },
    summaryBox: {
        backgroundColor: "#171717",
        borderRadius: "12px",
        padding: "16px",
        marginBottom: "16px",
        "& .summary-row": {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 0",
            borderBottom: "1px solid #2a2a2a",
            "&:last-child": {
                borderBottom: "none",
            }
        },
        "& .summary-label": {
            color: "#9b9b9b",
            fontSize: "14px",
            cursor: "info"
        },
        "& .summary-value": {
            color: "#fff",
            fontSize: "14px",
            fontWeight: 500,
        }
    },
    statusIndicator: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "12px 16px",
        borderRadius: "12px",
        marginTop: "16px",
        "&.pending": {
            backgroundColor: "rgba(150, 150, 150, 0.06)",
            color: "#b0b0b0",
        },
        "&.success": {
            backgroundColor: "rgba(200, 200, 200, 0.06)",
            color: "#9b9b9b",
        },
        "&.error": {
            backgroundColor: "rgba(250, 250, 250, 0.06)",
            color: "#e1e1e1",
        },
        "&.warning": {
            backgroundColor: "rgba(250, 250, 250, 0.06)",
            color: "#e1e1e1",
        }
    },
    requiredHint: {
        backgroundColor: "rgba(150, 150, 150, 0.06)",
        borderRadius: "12px",
        padding: "12px 16px",
        marginBottom: "16px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        "& .MuiSvgIcon-root": {
            color: "#a0a0a0",
        }
    },
    rcIndicator: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 12px",
        borderRadius: "8px",
        marginTop: "12px",
        backgroundColor: "rgba(150, 150, 150, 0.1)",
        border: "1px solid rgba(150, 150, 150, 0.2)",
        "& .rc-bar": {
            flex: 1,
            height: "6px",
            backgroundColor: "#1a1a1a",
            borderRadius: "3px",
            overflow: "hidden",
            "& .rc-fill": {
                height: "100%",
                borderRadius: "3px",
                transition: "width 300ms ease",
            }
        }
    },
    pinStatusIndicator: {
        display: "flex",
        alignItems: "center",
        gap: "4px",
        marginLeft: "auto",
        fontSize: "12px",
        "&.enabled": {
            color: "#9b9b9b",
        },
        "&.disabled": {
            color: "#9b9b9b",
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
    checkboxControl: {
        "&.MuiFormControlLabel-root": {
            marginLeft: 12,
        }
    }
});


// Key type configuration

// Values are translation KEYS, not prose — this object is evaluated once at
// import time, so t() here would pin the language to module load. Consumers
// resolve with t(key) at render. Same pattern as UnlockKeyDialog.
//
// The four key-role names must stay distinguishable from one another in every
// language: they are how a user decides which credential to paste where, and
// the highest-privilege key is accepted wherever a lower one is asked for.
const KEY_TYPES = {
    master: {
        label: "components.login_dialog.master",
        description: "components.login_dialog.derives_all_keys_automatically",
        inputType: "password",
        placeholder: "components.login_dialog.enter_your_master_password",
        color: "#e0e0e0",
    },
    posting: {
        label: "components.login_dialog.posting",
        description: "words.for_voting_commenting_and_posting",
        inputType: "password",
        placeholder: "components.login_dialog.enter_your_posting_private_key_wif",
        color: "#d0d0d0",
    },
    active: {
        label: "components.login_dialog.active",
        description: "words.for_transfers_and_wallet_operations",
        inputType: "password",
        placeholder: "components.login_dialog.enter_your_active_private_key_wif",
        color: "#c8c8c8",
    },
    owner: {
        label: "components.login_dialog.owner",
        description: "words.for_account_recovery_and_authority_changes",
        inputType: "password",
        placeholder: "components.login_dialog.enter_your_owner_private_key_wif",
        color: "#b8b8b8",
    },
    memo: {
        label: "components.login_dialog.memo",
        description: "words.for_encrypted_messages",
        inputType: "password",
        placeholder: "components.login_dialog.enter_your_memo_private_key_wif",
        color: "#c0c0c0",
    },
};

// Session timeout marks (in minutes) — 12h to 120h (5d) range
const SESSION_TIMEOUT_MARKS = [
    { value: 12 * 60, label: '12h' },
    { value: 24 * 60, label: '1d' },
    { value: 48 * 60, label: '2d' },
    { value: 72 * 60, label: '3d' },
    { value: 96 * 60, label: '4d' },
    { value: 120 * 60, label: '5d' },
];

// PIN timeout marks (in minutes)
const PIN_TIMEOUT_MARKS = [
    { value: 15, label: '15m' },
    { value: 30, label: '30m' },
    { value: 60, label: '1h' },
    { value: 90, label: '1h30m' },
    { value: 120, label: '2h' },
];


// RC (Resource Credits) Display Component

const RCIndicator = memo(function RCIndicator({ classes, rcPercent, rcMana }) {
    useLanguage();
    if (rcPercent === null) return null;

    // Greyscale intensity based on percentage (higher = brighter)
    const getColor = (percent) => {
        if (percent >= 80) return "#e0e0e0";
        if (percent >= 50) return "#b0b0b0";
        if (percent >= 20) return "#808080";
        return "#606060";
    };

    return (
        <div className={classes.rcIndicator}>
            <Tooltip title={t("components.login_dialog.resource_credits_used_for_blockchain_operations")}>
                <BatteryChargingFullOutlined style={{ color: getColor(rcPercent), fontSize: 20 }} />
            </Tooltip>
            <div className="rc-bar">
                <div
                    className="rc-fill"
                    style={{
                        width: `${rcPercent}%`,
                        backgroundColor: getColor(rcPercent)
                    }}
                />
            </div>
            <Typography variant="caption" style={{ color: getColor(rcPercent), minWidth: 40, textAlign: "right" }}>
                {rcPercent.toFixed(1)}%
            </Typography>
        </div>
    );
});


// Memoized Step 1: Authenticate (Username + Key)

const StepAuthenticate = memo(function StepAuthenticate({
                                                            classes,
                                                            username,
                                                            usernameMessage,
                                                            pendingUsernameValidation,
                                                            usernameExists,
                                                            selectedKeyType,
                                                            primaryKey,
                                                            showPrimaryKey,
                                                            primaryKeyValid,
                                                            pendingKeyValidation,
                                                            keyDetectionMessage,
                                                            requiredKeyType,
                                                            requiredKeyHint,
                                                            authors,
                                                            selectedAuthor,
                                                            searching,
                                                            accountReputation,
                                                            onUsernameInputChange,
                                                            onAutocompleteChange,
                                                            autocompleteOpen,
                                                            onAutocompleteOpen,
                                                            onAutocompleteClose,
                                                            onPrimaryKeyChange,
                                                            onToggleShowPrimaryKey,
                                                            onMouseDownPassword,
                                                            onOpenQRScanner,
                                                        }) {
    useLanguage();
    // Resolved avatar for the current input
    const resolvedImage = (selectedAuthor && selectedAuthor.username === username)
        ? selectedAuthor.image
        : '';

    // Primary key end adornment with QR scanner button
    const primaryKeyEndAdornment = useMemo(() => (
        <InputAdornment position="end" className={classes.inputEndAdornment}>
            {pendingKeyValidation ? (
                <CircularProgress size={20} color="secondary" />
            ) : primaryKey.length > 0 ? (
                <Tooltip title={keyDetectionMessage || (primaryKeyValid ? "Key format is valid" : "Invalid key format")}>
                    <IconButton edge="end" disabled className={classes.buttonNotDisabled}>
                        {primaryKeyValid ? <CheckRounded style={{ color: "#ffffff" }} /> : <ErrorRounded style={{ color: "#a5a5a5" }} />}
                    </IconButton>
                </Tooltip>
            ) : null}
            <Tooltip title={t("words.scan_qr_code")}>
                <IconButton
                    edge="end"
                    className={classes.qrScanButton}
                    onClick={() => onOpenQRScanner('primary')}
                >
                    <CropFreeIcon />
                </IconButton>
            </Tooltip>
            <Tooltip title={showPrimaryKey ? "Hide key" : "Show key"}>
                <IconButton
                    edge="end"
                    aria-label={t("words.toggle_key_visibility")}
                    onClick={onToggleShowPrimaryKey}
                    onMouseDown={onMouseDownPassword}
                >
                    {showPrimaryKey ? <Visibility /> : <VisibilityOff />}
                </IconButton>
            </Tooltip>
        </InputAdornment>
    ), [classes, pendingKeyValidation, primaryKey, primaryKeyValid, keyDetectionMessage, showPrimaryKey, onToggleShowPrimaryKey, onMouseDownPassword, onOpenQRScanner]);

    const keyTypeConfig = KEY_TYPES[selectedKeyType] || KEY_TYPES.master;

    return (
        <DialogContent key="view-1">
            {/* Required key hint */}
            {requiredKeyType && requiredKeyHint && (
                <div className={classes.requiredHint}>
                    <SecurityOutlined />
                    <Typography variant="body2">{requiredKeyHint}</Typography>
                </div>
            )}
            {/* Username input with Autocomplete search + profile picture */}
            <Autocomplete
                classes={{paper: classes.popper}}
                options={authors}
                getOptionLabel={(option) => typeof option === 'string' ? option : option.username || ''}
                filterOptions={(x) => x}
                inputValue={username}
                onChange={onAutocompleteChange}
                onInputChange={onUsernameInputChange}
                // Controlled popup: the parent auto-closes it once the typed
                // name resolves to an existing account (debounce means the
                // user has stopped typing by then). Typing again re-opens.
                open={autocompleteOpen}
                onOpen={onAutocompleteOpen}
                onClose={onAutocompleteClose}
                loading={searching}
                loadingText={t("words.searching")}
                noOptionsText={username.length > 0 ? "No accounts found" : "Type a username"}
                renderOption={(option) => (
                    <div style={{ display: "flex", alignItems: "center" }}>
                        <Avatar
                            src={option.image}
                            alt={option.username}
                            style={{ marginRight: 8, width: 32, height: 32, borderRadius: "8px" }}
                            className={"pixelated"}
                        />
                        <div>
                            <strong>@{option.username}</strong>
                            {option.name && option.name !== option.username && (
                                <div style={{ fontSize: 12, color: "#888" }}>{option.name}</div>
                            )}
                        </div>
                    </div>
                )}
                freeSolo
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label={t("words.username")}
                        variant="outlined"
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                        inputProps={{
                            ...params.inputProps,
                            autoComplete: 'username',
                            name: 'username',
                            'aria-label': 'Username',
                        }}
                        InputProps={{
                            ...params.InputProps,
                            startAdornment: (
                                <React.Fragment>
                                    <Avatar
                                        src={resolvedImage}
                                        style={{ width: 24, height: 24, marginRight: 6, borderRadius: "6px" }}
                                        className={"pixelated"}
                                    />
                                    <span style={{ marginRight: -4, color: '#fff' }}>@</span>
                                    {params.InputProps.startAdornment}
                                </React.Fragment>
                            ),
                            endAdornment: (
                                <React.Fragment>
                                    {searching || pendingUsernameValidation ? <CircularProgress color="inherit" size={18} /> : null}
                                    {!searching && !pendingUsernameValidation && usernameExists && (
                                        <Tooltip title={t("components.login_dialog.account_found_reputation", {
                                            accountReputation: accountReputation || 'N/A'
                                        })}>
                                            <AccountCheck style={{ color: "#e0e0e0", fontSize: 20 }} />
                                        </Tooltip>
                                    )}
                                    {!searching && !pendingUsernameValidation && !usernameExists && username.length > 2 && (
                                        <Tooltip title={t("components.login_dialog.account_not_found")}>
                                            <AccountRemove style={{ color: "#7b7b7b", fontSize: 20 }} />
                                        </Tooltip>
                                    )}
                                    {params.InputProps.endAdornment}
                                </React.Fragment>
                            ),
                        }}
                    />
                )}
                style={{ marginBottom: usernameMessage.length > 0 ? 8 : 16 }}
            />
            <Collapse in={usernameMessage.length > 0 && username.length > 0}>
                <Typography style={{ fontSize: "14px", marginBottom: "16px", color: "#9b9b9b", textAlign: "right" }}>
                    {usernameMessage}
                </Typography>
            </Collapse>
            {/* Primary key input — accepts master password OR any WIF key.
                The role is auto-detected from the input and reflected in
                `selectedKeyType` / `keyDetectionMessage`.

                NOTE: This field is ALWAYS rendered (no Collapse) so that
                password managers can autofill it. Browsers (Chrome, Safari,
                Firefox) skip autofill into inputs that live inside zero-
                height / visibility:hidden containers, which is what Collapse
                produces while closed. Visual de-emphasis is done via opacity
                until the account resolves. */}
            <div
                style={{
                    opacity: usernameExists ? 1 : 0.55,
                    transition: 'opacity 200ms cubic-bezier(0.4, 0, 0.2, 1)',
                    marginTop: 16,
                }}
            >
                <FormControl fullWidth variant="outlined">
                    <InputLabel htmlFor="login-primary-key">{t("components.login_dialog.master_password_or_private_key")}</InputLabel>
                    <OutlinedInput
                        id="login-primary-key"
                        type={showPrimaryKey ? 'text' : 'password'}
                        value={primaryKey}
                        onChange={onPrimaryKeyChange}
                        endAdornment={primaryKeyEndAdornment}
                        labelWidth={230}
                        placeholder={t("components.login_dialog.paste_your_master_password_or_any_private")}
                        autoComplete="current-password"
                        name="password"
                        inputProps={{
                            'aria-label': 'Master password or private key',
                        }}
                    />
                </FormControl>
                <Typography style={{ fontSize: 12, color: "#7b7b7b", marginTop: 8, textAlign: "right", minHeight: 18 }}>
                    {keyDetectionMessage
                        ? keyDetectionMessage
                        : (!usernameExists && username.length > 0
                            ? "Enter a valid account name to enable key detection"
                            : primaryKey.length === 0
                                ? t("components.login_dialog.any_of_master_password_posting_active_owner")
                                : keyTypeConfig.description)}
                </Typography>
                {requiredKeyType && requiredKeyType !== 'master' && (
                    <Typography style={{ fontSize: 12, color: "#9b9b9b", marginTop: 4, textAlign: "right" }}><T
                        k="components.login_dialog.this_action_specifically_requires_the_strong_str"
                        vars={{
                            requiredKeyType: KEY_TYPES[requiredKeyType]?.label ? t(KEY_TYPES[requiredKeyType].label) : requiredKeyType
                        }} /></Typography>
                )}
            </div>
        </DialogContent>
    );
});

// Memoized Step 2: Security Settings (Three-Mode Session)
const StepSecurity = memo(function StepSecurity({
                                                    classes, pin, pinConfirmation, showPIN, persistSession,
                                                    sessionTimeout, pinTimeout, pinHint, encryptionProfile,
                                                    selectedKeyType, additionalKeys, keyPINProtection, expanded,
                                                    onPINChange, onPINConfirmationChange, onToggleShowPIN,
                                                    onPersistSessionChange, onSessionTimeoutChange, onPINTimeoutChange,
                                                    onPINHintChange, onAdditionalKeyChange, onKeyPINProtectionChange,
                                                    onAccordionChange, onMouseDownPassword, onOpenQRScanner,
                                                }) {
    useLanguage();
    const pinEndAdornment = useMemo(() => (
        <Tooltip title={showPIN ? "Hide password" : "Show password"}>
            <InputAdornment position="end">
                <IconButton edge="end" onClick={onToggleShowPIN} onMouseDown={onMouseDownPassword}>
                    {showPIN ? <Visibility /> : <VisibilityOff />}
                </IconButton>
            </InputAdornment>
        </Tooltip>
    ), [showPIN, onToggleShowPIN, onMouseDownPassword]);

    const analysis = useMemo(() => analyzePassword(pin), [pin]);
    const pinsMatch    = pinConfirmation.length > 0 && pin === pinConfirmation;
    const pinsMismatch = pinConfirmation.length > 0 && pin !== pinConfirmation;
    const isPinReady   = analysis.meetsMinimum && pinsMatch;
    const [examples] = useState(() => pickExamples(3));

    const profileTooltipText = encryptionProfile
        ? t(
            "components.login_dialog.your_device_was_benchmarked_at_encryption_strength",
            {
                encryptionProfile: encryptionProfile
            }
        )
        + t("components.login_dialog.this_determines_how_much_work_the_vault")
        + t("components.login_dialog.higher_profiles_use_more_memory_making_brute")
        + t("components.login_dialog.the_more_complex_your_password_mixing_letters")
        : t("components.login_dialog.your_device_is_being_benchmarked_to_pick")
        + t("components.login_dialog.higher_profiles_use_more_memory_which_makes")
        + t("components.login_dialog.this_usually_takes_a_few_seconds_on");

    const availableAdditionalKeys = selectedKeyType === 'master'
        ? [] : ['posting', 'active', 'owner', 'memo'].filter(k => k !== selectedKeyType);

    const charChecks = [
        { label: '1 lowercase letter',  met: analysis.hasLower },
        { label: '1 uppercase letter',  met: analysis.hasUpper },
        { label: '1 number',            met: analysis.hasDigit },
        { label: '1 symbol (!@$...)',   met: analysis.hasSymbol },
    ];

    return (
        <DialogContent key="view-2">
            {/* Session persistence checkbox */}
            <FormControlLabel
                className={classes.checkboxControl}
                control={
                    <Checkbox
                        checked={persistSession}
                        onChange={onPersistSessionChange}
                        color="default"
                        size="medium"
                    />
                }
                label={
                    <Box display="flex" flexDirection="column" style={{userSelect: "none"}}>
                        <Typography variant="body2" style={{ color: "#e0e0e0" }}>
                            {t("components.login_dialog.keep_credentials_alive_across_sessions")}
                        </Typography>
                        <Typography variant="caption" style={{ color: "#7b7b7b" }}>
                            {persistSession ? "Your keys will survive page reloads" : "Session ends when the tab closes"}
                        </Typography>
                    </Box>
                }
                style={{ marginBottom: 8, alignItems: "flex-start" }}
            />
            {/* Optional password dropdown */}
            <Accordion expanded={expanded === "password"} onChange={onAccordionChange("password")} style={{ marginTop: 8 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon style={{marginRight: 8}} />}>
                    <Box display="flex" alignItems="center" gap={1}>
                        <LockOutlined style={{ color: "#7b7b7b", marginRight: 8 }} />
                        <Typography>{t("components.login_dialog.set_a_vault_password")}</Typography>
                        <Typography variant="caption" style={{ color: "#7b7b7b", marginLeft: "auto" }}>{t("components.login_dialog.recommended")}</Typography>
                    </Box>
                </AccordionSummary>
                <AccordionDetails>
                    <div style={{ width: "100%" }}>

                        {/* Character type guidance */}
                        <Box display="flex" flexWrap="wrap" style={{ gap: 6, marginBottom: 12 }}>
                            {charChecks.map(({ label, met }) => (
                                <Chip key={label} label={label} size="small"
                                      icon={met ? <CheckRounded style={{ fontSize: 14 }} /> : undefined}
                                      variant={met ? "default" : "outlined"}
                                      style={{
                                          backgroundColor: met ? "#2a2a2a" : "transparent",
                                          borderColor: "#4a4a4a", color: met ? "#e0e0e0" : "#7b7b7b",
                                          fontSize: 12, transition: "all 200ms ease",
                                      }}
                                />
                            ))}
                        </Box>

                        {/* Password input */}
                        <FormControl fullWidth variant="outlined" style={{ marginBottom: 12 }}>
                            <InputLabel htmlFor="login-pin">{t("components.login_dialog.password", {
                                minRequired: analysis.typeCount >= 2 ? t("components.login_dialog.min_chars", {
                                    minRequired: analysis.minRequired
                                }) : ''
                            })}</InputLabel>
                            <OutlinedInput id="login-pin" type={showPIN ? 'text' : 'password'}
                                           value={pin} onChange={onPINChange} endAdornment={pinEndAdornment}
                                           labelWidth={analysis.typeCount >= 2 ? 180 : 70}
                                           autoComplete="new-password"
                                           name="new-password"
                                           inputProps={{ 'aria-label': 'Vault password' }} />
                        </FormControl>

                        {/* Real-time feedback */}
                        <Collapse in={pin.length > 0}>
                            <div style={{ marginBottom: 12, textAlign: "right" }}>
                                {analysis.typeCount < 2 && (
                                    <Typography style={{ fontSize: 12, color: "#7b7b7b" }}>
                                        {t("components.login_dialog.add_more_character_types_to_enable_the")}
                                    </Typography>
                                )}
                                {analysis.typeCount >= 2 && !analysis.meetsMinimum && (
                                    <Typography style={{ fontSize: 12, color: "#9b9b9b" }}>{t("components.login_dialog.more_character_needed", {
                                        character: { character: analysis.minRequired }
                                    })}</Typography>
                                )}
                                {analysis.meetsMinimum && !analysis.meetsRecommended && (
                                    <Typography style={{ fontSize: 12, color: "#9b9b9b" }}>{t(
                                        "components.login_dialog.good_characters_are_recommended_for_extra_safety",
                                        {
                                            recommended: analysis.recommended
                                        }
                                    )}</Typography>
                                )}
                                {analysis.meetsRecommended && (
                                    <Typography style={{ fontSize: 12, color: "#b0b0b0" }}>{t("components.login_dialog.excellent_length")}</Typography>
                                )}
                            </div>
                        </Collapse>

                        {/* Confirm password */}
                        <Collapse in={analysis.meetsMinimum}>
                            <FormControl fullWidth variant="outlined" style={{ marginBottom: 8 }}>
                                <InputLabel htmlFor="login-pin-confirm">{t("components.login_dialog.confirm_password")}</InputLabel>
                                <OutlinedInput id="login-pin-confirm" type={showPIN ? 'text' : 'password'}
                                               value={pinConfirmation} onChange={onPINConfirmationChange} labelWidth={130}
                                               autoComplete="new-password"
                                               name="confirm-password"
                                               inputProps={{ 'aria-label': 'Confirm vault password' }} />
                            </FormControl>
                            <Collapse in={pinsMatch}>
                                <Typography style={{ fontSize: 12, color: "#b0b0b0", textAlign: "right", marginBottom: 4 }}>
                                    {t("components.login_dialog.passwords_match")}
                                </Typography>
                            </Collapse>
                            <Collapse in={pinsMismatch}>
                                <Typography style={{ fontSize: 12, color: "#9b9b9b", textAlign: "right", marginBottom: 4 }}>
                                    {t("components.login_dialog.passwords_do_not_match")}
                                </Typography>
                            </Collapse>
                        </Collapse>

                        <Typography style={{ display: "flex", alignItems: "flex-end", fontSize: 13, color: "#7b7b7b", marginBottom: 16 }}>
                            {/* Tip */}
                            <Tooltip interactive enterTouchDelay={200} leaveTouchDelay={8000}
                                     classes={{ tooltip: classes.tooltipRoot }}
                                     title={
                                         <span className={classes.tooltip}>
                                            {t("components.login_dialog.take_a_memorable_word_and_replace_some")}
                                             {examples.map(({ original, modified }) => (
                                                 <span key={modified} style={{ display: "block", marginTop: 6 }}>
                                        {original} - <span style={{ fontFamily: "monospace", letterSpacing: "0.5px" }}>{modified}</span>
                                    </span>
                                             ))}
                            </span>
                                     }>
                                <Typography style={{
                                    fontSize: 12, color: "#5b5b5b", marginRight: 8,
                                    cursor: "help", display: "inline-block",
                                }}>
                                    <InfoOutlined/>
                                </Typography>
                            </Tooltip>
                            <span>{t("components.login_dialog.a_password_encrypts_your_private_keys_at")}</span>
                        </Typography>

                        {/* Hint field */}
                        <Collapse in={isPinReady}>
                            <FormControl fullWidth variant="outlined" style={{ marginTop: 8, marginBottom: 8 }}>
                                <InputLabel htmlFor="login-pin-hint">{t("components.login_dialog.hint_optional_shown_on_unlock")}</InputLabel>
                                <OutlinedInput id="login-pin-hint" type="text" value={pinHint}
                                               onChange={onPINHintChange} labelWidth={220}
                                               placeholder={t("components.login_dialog.e_g_my_favorite_italian_word")}
                                               autoComplete="off"
                                               name="hint"
                                               inputProps={{ maxLength: 100, 'aria-label': 'Password hint' }} />
                            </FormControl>
                            <Typography style={{ fontSize: 11, color: "#5b5b5b", textAlign: "right" }}>
                                {t("components.login_dialog.stored_unencrypted_dont_put_your_password_here")}
                            </Typography>
                        </Collapse>

                        {/* Password Timeout Slider */}
                        <Collapse in={isPinReady}>
                            <div className={classes.sliderContainer}>
                                <div className={classes.sliderLabel}>
                                    <Box display="flex" alignItems="center">
                                        <TimerOutlined />
                                        <Typography variant="body2">{t("components.login_dialog.password_timeout")}</Typography>
                                    </Box>
                                    <Typography variant="body2" style={{ color: "#fff" }}>
                                        {pinTimeout < 60 ? `${pinTimeout} min` : `${Math.floor(pinTimeout / 60)}h${pinTimeout % 60 > 0 ? ` ${pinTimeout % 60}m` : ''}`}
                                    </Typography>
                                </div>
                                <Slider value={pinTimeout} onChange={onPINTimeoutChange}
                                        min={12} max={120} marks={PIN_TIMEOUT_MARKS} step={null}
                                        valueLabelDisplay="auto" valueLabelFormat={(v) => v < 60 ? `${v}m` : `${Math.floor(v / 60)}h${v % 60 > 0 ? `${v % 60}m` : ''}`} />
                            </div>
                        </Collapse>
                    </div>
                </AccordionDetails>
            </Accordion>
            {/* Additional Keys */}
            {availableAdditionalKeys.length > 0 && (
                <Accordion expanded={expanded === "keys"} onChange={onAccordionChange("keys")} style={{ marginTop: 0 }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon style={{marginRight: 8}} />}>
                        <Box display="flex" alignItems="center" gap={1}>
                            <VpnKeyOutlined style={{ color: "#7b7b7b", marginRight: 8 }} />
                            <Typography>{t("components.login_dialog.additional_keys")}</Typography>
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                        <div style={{ width: "100%" }}>
                            <Typography style={{ fontSize: 14, marginBottom: 16, color: "#9b9b9b" }}>
                                {t("components.login_dialog.add_other_private_keys_to_enable_more")}
                            </Typography>
                            {availableAdditionalKeys.map((keyType) => {
                                const config = KEY_TYPES[keyType];
                                return (
                                    <div key={keyType} style={{ marginBottom: 16 }}>
                                        <FormControl fullWidth variant="outlined" size="small">
                                            <InputLabel htmlFor={`additional-key-${keyType}`}>{t(config.label)}</InputLabel>
                                            <OutlinedInput id={`additional-key-${keyType}`} type="password"
                                                           value={additionalKeys[keyType] || ''}
                                                           onChange={(e) => onAdditionalKeyChange(keyType, e.target.value)}
                                                           labelWidth={t(config.label).length * 8} placeholder={t(config.placeholder)}
                                                           autoComplete="off"
                                                           name={`additional-key-${keyType}`}
                                                           inputProps={{ 'aria-label': `${t(config.label)} private key` }}
                                                           endAdornment={
                                                               <InputAdornment position="end">
                                                                   <Tooltip title={t("words.scan_qr_code")}>
                                                                       <IconButton edge="end" className={classes.qrScanButton}
                                                                                   onClick={() => onOpenQRScanner(keyType)} size="small">
                                                                           <CropFreeIcon fontSize="small" />
                                                                       </IconButton>
                                                                   </Tooltip>
                                                               </InputAdornment>
                                                           } />
                                        </FormControl>
                                        {isPinReady && additionalKeys[keyType] && (
                                            <div className={classes.keyToggleRow}>
                                                <Typography variant="body2" style={{ color: "#9b9b9b" }}>{t("components.login_dialog.require_password_for", {
                                                    label: t(config.label)
                                                })}</Typography>
                                                <Switch checked={keyPINProtection[keyType] || false}
                                                        onChange={(e) => onKeyPINProtectionChange(keyType, e.target.checked)}
                                                        color="default" size="small" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </AccordionDetails>
                </Accordion>
            )}
            {/* Session timeout */}
            <Accordion expanded={expanded === "session"} onChange={onAccordionChange("session")}
                       style={{ marginTop: availableAdditionalKeys.length > 0 ? 0 : 0 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon style={{marginRight: 8}} />}>
                    <Box display="flex" alignItems="center" gap={1}>
                        <TimerOutlined style={{ color: "#7b7b7b", marginRight: 8 }} />
                        <Typography>{t("components.login_dialog.session_timeout")}</Typography>
                    </Box>
                </AccordionSummary>
                <AccordionDetails>
                    <div style={{ width: "100%" }}>
                        <div className={classes.sliderContainer}>
                            <div className={classes.sliderLabel}>
                                <Typography variant="body2">{t("components.login_dialog.timeout")}</Typography>
                                <Typography variant="body2" style={{ color: "#fff" }}>
                                    {sessionTimeout < 60
                                        ? `${sessionTimeout} min`
                                        : sessionTimeout < 1440
                                            ? `${Math.floor(sessionTimeout / 60)}h${sessionTimeout % 60 > 0 ? ` ${sessionTimeout % 60}m` : ''}`
                                            : `${Math.floor(sessionTimeout / 1440)}d${(sessionTimeout % 1440) > 0 ? ` ${Math.floor((sessionTimeout % 1440) / 60)}h` : ''}`}
                                </Typography>
                            </div>
                            <Slider value={sessionTimeout} onChange={onSessionTimeoutChange}
                                    min={720} max={7200} marks={SESSION_TIMEOUT_MARKS} step={null}
                                    valueLabelDisplay="auto" valueLabelFormat={(v) => v < 1440 ? `${Math.floor(v / 60)}h` : `${Math.floor(v / 1440)}d`} />
                        </div>
                    </div>
                </AccordionDetails>
            </Accordion>
            {/* Security warning: persistent without password — always below checkbox */}
            <Collapse in={persistSession && !isPinReady && pin.length === 0}>
                <div className={`${classes.statusIndicator} warning`} style={{ marginTop: 4, marginBottom: 12 }}>
                    <WarningRounded style={{ fontSize: 18 }} />
                    <Typography variant="body2">
                        {t("components.login_dialog.your_keys_are_going_to_be_stored")}
                    </Typography>
                </div>
            </Collapse>
            {/*
              Encryption profile — shown prominently on step 2 so the user knows
              which Argon2id tier the vault auto-tune picked for their device.
              Renders in two states:
                • loading  — benchmark still running (first launch, no cache)
                • resolved — shows the selected tier label (Very High / High / Standard / Low)

            <Box display="flex" alignItems="center" justifyContent="space-between"
                 style={{ backgroundColor: "#171717", borderRadius: 8, padding: "10px 14px", marginTop: 12, marginBottom: 8 }}>
                <Box display="flex" alignItems="center" gap={1}>
                    <SecurityOutlined style={{ color: "#7b7b7b", fontSize: 18, marginRight: "4px" }} />
                    <Typography style={{ fontSize: 13, color: "#9b9b9b" }}>Encryption profile</Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={1}>
                    {encryptionProfile ? (
                        <Typography style={{ fontSize: 14, fontWeight: 500, color: "#c8c8c8" }}>
                            {encryptionProfile}
                        </Typography>
                    ) : (
                        <Box display="flex" alignItems="center" gap={1}>
                            <CircularProgress size={12} style={{ color: "#7b7b7b" }} />
                            <Typography style={{ fontSize: 13, color: "#7b7b7b", fontStyle: "italic", marginLeft: 6 }}>
                                Benchmarking your device…
                            </Typography>
                        </Box>
                    )}
                    <Tooltip interactive enterTouchDelay={200} leaveTouchDelay={6000}
                             classes={{ tooltip: classes.tooltipRoot }}
                             title={<span className={classes.tooltip}>{profileTooltipText}</span>}>
                        <InfoOutlined style={{ fontSize: 16, color: "#7b7b7b", cursor: "help", marginLeft: 4 }} />
                    </Tooltip>
                </Box>
            </Box>
             */}
        </DialogContent>
    );
});

// Memoized Step 3: Confirm (Review + Login)

const StepConfirm = memo(function StepConfirm({
                                                  classes,
                                                  username,
                                                  selectedKeyType,
                                                  pinEnabled,
                                                  persistSession,
                                                  sessionTimeout,
                                                  pinTimeout,
                                                  additionalKeys,
                                                  keyPINProtection,
                                                  loginStatus,
                                                  loginError,
                                                  loginProgress,
                                              }) {
    useLanguage();
    const additionalKeyCount = Object.values(additionalKeys).filter(k => k && k.length > 0).length;
    const protectedKeyCount = Object.values(keyPINProtection).filter(Boolean).length;

    return (
        <DialogContent key="view-3">
            <Typography style={{ fontSize: 14, marginBottom: 16, color: "#9b9b9b" }}>
                {t("components.login_dialog.review_your_login_configuration_before_proceedin")}
            </Typography>
            <div className={classes.summaryBox}>
                <div className="summary-row">
                    <Tooltip interactive enterTouchDelay={200} leaveTouchDelay={4000} classes={{ tooltip: classes.tooltipRoot }} title={<span className={classes.tooltip}>{t("components.login_dialog.its_your_username")}</span>}>
                        <span className="summary-label">{t("components.login_dialog.account")}</span>
                    </Tooltip>
                    <span className="summary-value">@{username}</span>
                </div>
                <div className="summary-row">
                    <Tooltip interactive enterTouchDelay={200} leaveTouchDelay={4000} classes={{ tooltip: classes.tooltipRoot }} title={<span className={classes.tooltip}>{t("components.login_dialog.its_more_secure_to_have_it_enabled")}</span>}>
                        <span className="summary-label">{t("components.login_dialog.password_protection")}</span>
                    </Tooltip>
                    <span className="summary-value" style={{ color: pinEnabled ? "#FFF" : "#9b9b9b" }}>
                        {pinEnabled ? "Enabled" : "Disabled"}
                    </span>
                </div>
                <div className="summary-row">
                    <Tooltip interactive enterTouchDelay={200} leaveTouchDelay={4000} classes={{ tooltip: classes.tooltipRoot }} title={<span className={classes.tooltip}>{t("components.login_dialog.when_enabled_your_session_is_stored_in")}</span>}>
                        <span className="summary-label">{t("components.login_dialog.session_storage")}</span>
                    </Tooltip>
                    <span className="summary-value" style={{ color: persistSession ? (pinEnabled ? "#FFF" : "#b8b8b8") : "#9b9b9b" }}>
                        {persistSession ? (pinEnabled ? "Encrypted (vault)" : "Persistent (unencrypted)") : "Temporary (tab only)"}
                    </span>
                </div>
                <div className="summary-row">
                    <Tooltip interactive enterTouchDelay={200} leaveTouchDelay={4000} classes={{ tooltip: classes.tooltipRoot }} title={<span className={classes.tooltip}>{t("components.login_dialog.when_the_session_timeout_expires_you_will")}</span>}>
                        <span className="summary-label">{t("components.login_dialog.session_timeout")}</span>
                    </Tooltip>
                    <span className="summary-value">
                        {sessionTimeout < 60
                            ? `${sessionTimeout} minutes`
                            : sessionTimeout < 1440
                                ? `${Math.floor(sessionTimeout / 60)} hours${sessionTimeout % 60 > 0 ? ` ${sessionTimeout % 60}m` : ''}`
                                : `${Math.floor(sessionTimeout / 1440)} day(s)${(sessionTimeout % 1440) > 0 ? ` ${Math.floor((sessionTimeout % 1440) / 60)}h` : ''}`
                        }
                    </span>
                </div>
                {pinEnabled && (
                    <div className="summary-row">
                        <Tooltip interactive enterTouchDelay={200} leaveTouchDelay={4000} classes={{ tooltip: classes.tooltipRoot }} title={<span className={classes.tooltip}>{t("components.login_dialog.after_a_while_not_using_any_keys")}</span>}>
                            <span className="summary-label">{t("components.login_dialog.password_timeout")}</span>
                        </Tooltip>
                        <span className="summary-value">{pinTimeout} minutes</span>
                    </div>
                )}
                {selectedKeyType !== 'master' && additionalKeyCount > 0 && (
                    <div className="summary-row">
                        <Tooltip interactive enterTouchDelay={200} leaveTouchDelay={4000} classes={{ tooltip: classes.tooltipRoot }} title={<span className={classes.tooltip}>{t("components.login_dialog.number_of_keys_the_system_can_access")}</span>}>
                            <span className="summary-label">{t("components.login_dialog.number_of_keys")}</span>
                        </Tooltip>
                        <span className="summary-value">{t("components.login_dialog.key_s", {
                            key: { key: additionalKeyCount + 1 }
                        })}</span>
                    </div>
                )}
                {pinEnabled && protectedKeyCount > 0 && (
                    <div className="summary-row">
                        <Tooltip interactive enterTouchDelay={200} leaveTouchDelay={4000} classes={{ tooltip: classes.tooltipRoot }} title={<span className={classes.tooltip}>{t("components.login_dialog.number_of_keys_that_are_protected_by")}</span>}>
                            <span className="summary-label">{t("components.login_dialog.password_protected_keys")}</span>
                        </Tooltip>
                        <span className="summary-value">{t("components.login_dialog.key_s_2", {
                            key: { key: protectedKeyCount + 1 }
                        })}</span>
                    </div>
                )}
            </div>
            {/* Login Status */}
            {loginStatus && (
                <div className={`${classes.statusIndicator} ${loginStatus}`}>
                    {loginStatus === 'pending' && (
                        <>
                            <CircularProgress size={20} color="inherit" />
                            <Typography variant="body2">{loginProgress || "Authenticating..."}</Typography>
                        </>
                    )}
                    {loginStatus === 'success' && (
                        <>
                            <CheckRounded />
                            <Typography variant="body2">{t("components.login_dialog.login_successful")}</Typography>
                        </>
                    )}
                    {loginStatus === 'error' && (
                        <>
                            <ErrorRounded />
                            <Typography variant="body2">{loginError || "Login failed"}</Typography>
                        </>
                    )}
                    {loginStatus === 'warning' && (
                        <>
                            <ErrorRounded />
                            <Typography variant="body2">{loginError}</Typography>
                        </>
                    )}
                </div>
            )}
        </DialogContent>
    );
});


class LoginDialog extends React.PureComponent {
    constructor(props) {
        super(props);

        // Debounce timers
        this._usernameValidationTimer = null;
        this._keyValidationTimer = null;
        this._searchTimer = null;
        // Cache: username -> { username, image, name }
        this._profileCache = {};
        // Hidden form ref for browser credential save
        this._credentialFormRef = React.createRef();

        this.state = {
            // UI State
            _tab_value: 0,
            _fullscreen: (window.innerWidth || document.documentElement.clientWidth || (document.body || document.getElementsByTagName('body')[0]).clientWidth) <= 960,
            // True while the on-screen keyboard has the visual viewport
            // shrunk (mobile fullscreen). Drives the compact header so the
            // fields stay visible above the keyboard.
            _keyboard_open: false,
            _expanded: null,
            // Simple mode (default): logo header + username + key + LOG IN.
            // Advanced mode: reveals the stepper and steps 2 & 3.
            _advanced_mode: false,
            // Controlled Autocomplete popup — auto-closed once the typed
            // username resolves to an existing account.
            _autocomplete_open: false,

            // Step 1: Authentication
            _username: props.defaultUsername || "",
            _pending_username_validation: false,
            _username_exists: false,
            _username_message: "",
            // _selected_key_type is now AUTO-DETECTED from the entered key.
            // It defaults to "master" (the most permissive) and is replaced
            // with the matching key role once the user pastes a WIF whose
            // public key matches one of the account's on-chain auths.
            _selected_key_type: props.requiredKeyType || "master",
            _primary_key: "",
            _show_primary_key: false,
            _primary_key_valid: false,
            _pending_key_validation: false,
            _key_detection_message: "", // user-facing feedback ("Detected: Posting Key", "Master password format")
            _account_data: null,        // full on-chain account (key_auths, memo_key) used for detection
            _account_reputation: null,
            _rc_percent: null,
            _rc_mana: null,
            _authors: [],             // Search results: [{ username, image, name }]
            _selected_author: null,   // Resolved profile of currently typed/selected user
            _searching: false,        // Loading indicator while searching

            // Step 2: Security
            _pin: "",
            _pin_confirmation: "",
            _show_pin: false,
            _pin_hint: "",
            _encryption_profile: null,
            _persist_session: true,   // true by default — persistent LacertaDB session
            _session_timeout: props.defaultSessionTimeout || 48 * 60, // minutes (default 48h)
            _pin_timeout: props.defaultPinTimeout || 60, // minutes
            _additional_keys: {
                posting: "",
                active: "",
                owner: "",
                memo: "",
            },
            _key_pin_protection: {
                posting: true,
                active: true,
                owner: true,
                memo: true,
            },

            // Step 3: Confirm
            _login_status: null, // 'pending' | 'success' | 'error' | 'warning'
            _login_error: null,
            _login_progress: null,

            // QR Scanner
            _qr_scanner_open: false,
            _qr_scanner_target: null, // 'primary' | 'posting' | 'active' | 'owner' | 'memo'
        };
    }

    componentDidMount() {
        window.addEventListener("resize", this._computeSize);

        // Mirror the visual viewport into CSS variables. When the on-screen
        // keyboard opens, mobile browsers shrink the visual viewport without
        // resizing the layout viewport, so a `height: 100%` fullscreen dialog
        // keeps its full height and its bottom action bar ends up behind the
        // keyboard. The fullscreen paper consumes these variables instead
        // (see styles.dialog → .MuiDialog-paperFullScreen).
        if (window.visualViewport) {
            window.visualViewport.addEventListener("resize", this._updateVisualViewport);
            window.visualViewport.addEventListener("scroll", this._updateVisualViewport);
            this._updateVisualViewport();
        }

        // If default username provided, validate it
        if (this.props.defaultUsername) {
            this._validateUsername(this.props.defaultUsername);
        }

        // Fetch encryption profile from vault config
        this._fetchEncryptionProfile();

        // Also listen for the vault's auto-tune completion event — this covers
        // the case where the dialog mounts BEFORE the first-ever benchmark
        // finishes. Without this, _encryption_profile would stay null for the
        // entire lifetime of the dialog on first launch.
        const { api } = this.props;
        if (api?.on) {
            this._onVaultAutotune = ({ label }) => {
                if (label) {
                    this.setState({ _encryption_profile: encryptionProfileLabel(label) });
                }
            };
            api.on('vault_autotune_ready', this._onVaultAutotune);
        }
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this._computeSize);
        if (window.visualViewport) {
            window.visualViewport.removeEventListener("resize", this._updateVisualViewport);
            window.visualViewport.removeEventListener("scroll", this._updateVisualViewport);
        }
        document.documentElement.style.removeProperty("--lgd-vvh");
        document.documentElement.style.removeProperty("--lgd-vvt");
        if (this._usernameValidationTimer) clearTimeout(this._usernameValidationTimer);
        if (this._keyValidationTimer) clearTimeout(this._keyValidationTimer);
        if (this._searchTimer) clearTimeout(this._searchTimer);

        const { api } = this.props;
        if (api?.off && this._onVaultAutotune) {
            api.off('vault_autotune_ready', this._onVaultAutotune);
            this._onVaultAutotune = null;
        }
    }

    componentWillReceiveProps(newProps) {
        if (newProps.open !== this.props.open) {
            if (newProps.open) {
                // Reset state when dialog opens
                this.setState({
                    _tab_value: 0,
                    _advanced_mode: false,
                    _autocomplete_open: false,
                    _login_status: null,
                    _login_error: null,
                    _authors: [],
                    _selected_author: null,
                    _searching: false,
                });
            }
        }

        if (newProps.defaultUsername !== this.props.defaultUsername) {
            this.setState({ _username: newProps.defaultUsername || "" }, () => {
                if (newProps.defaultUsername) {
                    this._validateUsername(newProps.defaultUsername);
                    this._resolveUsername(newProps.defaultUsername);
                }
            });
        }

        if (newProps.requiredKeyType !== this.props.requiredKeyType) {
            this.setState({ _selected_key_type: newProps.requiredKeyType || "master" });
        }
    }

    _computeSize = () => {
        const fullscreen = (window.innerWidth || document.documentElement.clientWidth || (document.body || document.getElementsByTagName('body')[0]).clientWidth) <= 960;
        if (this.state._fullscreen !== fullscreen) {
            this.setState({ _fullscreen: fullscreen });
        }
    };

    // Writes visualViewport height/offset into CSS custom properties consumed
    // by `.MuiDialog-paperFullScreen` (see styles.dialog). Height pins the
    // paper's bottom edge to the top of the keyboard; offsetTop keeps the
    // paper aligned when iOS Safari scrolls the page on input focus.
    _updateVisualViewport = () => {
        const vv = window.visualViewport;
        if (!vv) { return; }
        document.documentElement.style.setProperty("--lgd-vvh", `${Math.round(vv.height)}px`);
        document.documentElement.style.setProperty("--lgd-vvt", `${Math.round(vv.offsetTop)}px`);

        // Keyboard heuristic: the visual viewport lost >20% of the layout
        // viewport height at ~1:1 zoom. Multiplying by scale keeps
        // pinch-zoom (which also shrinks vv.height) from tripping it.
        // Only flips state on threshold crossings — the CSS vars above do
        // the per-frame work without re-renders.
        const keyboardOpen = (vv.height * (vv.scale || 1)) < (window.innerHeight * 0.8);
        if (keyboardOpen !== this.state._keyboard_open) {
            this.setState({ _keyboard_open: keyboardOpen });
        }
    };

    _getClient = () => {
        const { api } = this.props;
        if (!api) return null;

        // The api prop should be the PixaProxyAPI instance
        // which has a 'client' property that is the dpixa Client
        return api.client || null;
    };

    _getFormatter = () => {
        const { api } = this.props;
        if (!api) return null;
        return api.formatter || null;
    };

    _getAuth = () => {
        const { api } = this.props;
        if (!api) return null;
        return api.auth || null;
    };

    _getRC = () => {
        const { api } = this.props;
        if (!api) return null;
        return api.rc || null;
    };

    // ── Account Search (Autocomplete) ──────────────────────────────────

    /**
     * Normalize a sanitized account entity from the API into
     * the { username, image, name } shape the Autocomplete needs.
     */
    _normalizeAuthor = (acc) => {
        if (!acc) return null;
        const username = acc.username || acc.name || '';
        if (!username) return null;

        if (this._profileCache[username]) return this._profileCache[username];

        const entry = {
            username,
            image: acc.image || (acc._profile && acc._profile.profile_image) || '',
            name: acc.display_name || (acc._profile && acc._profile.display_name) || username,
        };
        this._profileCache[username] = entry;
        return entry;
    };

    /**
     * Called on every keystroke in the username Autocomplete.
     * Debounces 280ms, then searches via lookupAccounts + getAccounts.
     */
    _onUsernameInputChange = (event, newInputValue) => {
        const input = (newInputValue || '').toLowerCase().replace(/^@/, '').trim();

        // Browser autofill provides plain `username` + master password.
        // The key field is cleared because the on-chain account just
        // changed: any previously-typed WIF is meaningless for the new
        // account, and detected role / account data go with it.
        this.setState({
            _username: input,
            _primary_key: "",
            _primary_key_valid: false,
            _pending_username_validation: true,
            _username_exists: false,
            _username_message: "",
            _account_reputation: null,
            _account_data: null,
            _key_detection_message: "",
            _selected_key_type: this.props.requiredKeyType || "master",
            _rc_percent: null,
            _rc_mana: null,
            // Popup shows only for searchable input; typing again after an
            // auto-close re-opens it.
            _autocomplete_open: input.length >= 3,
        });

        if (this._searchTimer) clearTimeout(this._searchTimer);
        if (this._usernameValidationTimer) clearTimeout(this._usernameValidationTimer);

        if (!input) {
            this.setState({
                _authors: [],
                _searching: false,
                _selected_author: null,
                _pending_username_validation: false,
            });
            return;
        }

        if (input.length < 3) {
            this.setState({
                _pending_username_validation: false,
                _username_message: "Username must be at least 3 characters",
                _authors: [],
                _searching: false,
            });
            return;
        }

        // If exact match already in cache, resolve immediately
        if (this._profileCache[input]) {
            this.setState({ _selected_author: this._profileCache[input] });
        }

        // Debounce the API call
        this._searchTimer = setTimeout(() => {
            this._searchAccounts(input);
        }, 280);
    };

    /**
     * Perform the actual lookup + full account fetch.
     */
    _searchAccounts = async (input) => {
        const { api } = this.props;
        if (!api) return;

        this.setState({ _searching: true });

        try {
            const client = this._getClient();
            if (!client) {
                this.setState({ _searching: false, _pending_username_validation: false });
                return;
            }

            // 1. lookupAccounts: returns up to 7 account name strings starting with `input`
            let names;
            if (api.accounts && api.accounts.lookupAccounts) {
                names = await api.accounts.lookupAccounts(input, 7);
            } else {
                names = await client.database.call('lookup_accounts', [input, 7]);
            }

            if (!Array.isArray(names) || names.length === 0) {
                this.setState({
                    _authors: [],
                    _searching: false,
                    _selected_author: null,
                    _pending_username_validation: false,
                    _username_exists: false,
                    _username_message: "Account not found",
                });
                return;
            }

            // 2. getAccounts: returns full account entities
            let accounts;
            if (api.accounts && api.accounts.getAccounts) {
                accounts = await api.accounts.getAccounts(names);
            } else {
                accounts = await client.database.getAccounts(names);
            }

            const authors = (accounts || [])
                .map(a => this._normalizeAuthor(a))
                .filter(Boolean);

            // 3. Resolve selected author (exact match) and validate
            const currentInput = this.state._username;
            const exactMatch = authors.find(a => a.username === currentInput) || null;
            const exists = !!exactMatch;

            let reputation = null;
            let matchedAccount = null;
            if (exists && accounts) {
                matchedAccount = accounts.find(a => (a.username || a.name) === currentInput) || null;
                if (matchedAccount) {
                    const formatter = this._getFormatter();
                    if (formatter && formatter.reputation) {
                        reputation = formatter.reputation(matchedAccount.reputation);
                    }
                }
            }

            this.setState({
                _authors: authors,
                _searching: false,
                _selected_author: exactMatch || this.state._selected_author,
                _pending_username_validation: false,
                _username_exists: exists,
                _username_message: exists ? "" : (currentInput.length > 0 ? "Account not found" : ""),
                _account_reputation: reputation,
                _account_data: matchedAccount, // full account: key_auths + memo_key
                // The debounced search only resolves once the user has
                // stopped typing — if the typed name is an existing account,
                // dismiss the suggestion popup so the key field is next.
                ...(exists ? { _autocomplete_open: false } : {}),
            }, () => {
                // Account just resolved — re-run key detection in case the
                // user pasted the key before the username search completed.
                if (this.state._primary_key && exists) {
                    this._detectKeyType(this.state._primary_key);
                }
            });

            // If exact match exists, also fetch RC
            if (exists) {
                this._fetchRC(currentInput);
            }
        } catch (e) {
            console.warn('[LoginDialog] _searchAccounts error:', e);
            this.setState({
                _searching: false,
                _pending_username_validation: false,
            });
        }
    };

    /**
     * When the user picks an option from the dropdown (click or enter).
     */
    _onAutocompleteChange = (event, value) => {
        if (value && typeof value === 'object' && value.username) {
            this.setState({
                _username: value.username,
                _selected_author: value,
            });
            // Trigger full validation
            this._validateUsername(value.username);
        } else if (typeof value === 'string') {
            const resolved = this._profileCache[value] || null;
            this.setState({
                _username: value,
                _selected_author: resolved,
            });
            if (value.length >= 3) {
                this._validateUsername(value);
            }
        }
    };

    /**
     * Resolve a single username to get its profile.
     */
    _resolveUsername = async (username) => {
        const { api } = this.props;
        if (!api || !username) return;

        try {
            let accounts;
            if (api.accounts && api.accounts.getAccounts) {
                accounts = await api.accounts.getAccounts([username]);
            } else {
                const client = this._getClient();
                if (client) accounts = await client.database.getAccounts([username]);
            }

            if (accounts && accounts[0]) {
                const author = this._normalizeAuthor(accounts[0]);
                if (author && author.username === this.state._username) {
                    this.setState({ _selected_author: author });
                }
            }
        } catch (e) { /* ignore */ }
    };

    /**
     * Fetch RC (Resource Credits) for a given username.
     */
    _fetchRC = async (username) => {
        try {
            const rc = this._getRC();
            if (rc && rc.getRCMana) {
                const rcInfo = await rc.getRCMana(username);
                if (rcInfo) {
                    const maxRC = BigInt(Math.trunc(rcInfo.max_rc || rcInfo.max_mana || 0));
                    const currentRC = BigInt(Math.trunc(rcInfo.rc_manabar?.current_mana || rcInfo.current_mana || 0));
                    if (maxRC > 0n) {
                        this.setState({
                            _rc_percent: Number((currentRC * 10000n) / maxRC) / 100,
                            _rc_mana: rcInfo,
                        });
                    }
                }
            }
        } catch (rcError) {
            console.warn("Failed to fetch RC info:", rcError);
        }
    };

    _handleUsernameChange = (e) => {
        const username = e.target.value.toString().toLowerCase().trim();

        this.setState({
            _username: username,
            _pending_username_validation: true,
            _username_exists: false,
            _username_message: "",
            _primary_key: "",
            _primary_key_valid: false,
            _account_reputation: null,
            _rc_percent: null,
            _rc_mana: null,
        });

        if (this._usernameValidationTimer) {
            clearTimeout(this._usernameValidationTimer);
        }

        if (username.length < 3) {
            this.setState({
                _pending_username_validation: false,
                _username_message: username.length > 0 ? "Username must be at least 3 characters" : "",
            });
            return;
        }

        this._usernameValidationTimer = setTimeout(() => {
            this._validateUsername(username);
        }, 500);
    };

    _validateUsername = async (username) => {
        const { api } = this.props;
        const client = this._getClient();

        if (!api || !client) {
            this.setState({
                _pending_username_validation: false,
                _username_message: "API not available",
            });
            return;
        }

        try {
            // Use the dpixa client directly to avoid circular reference issues
            const accounts = await client.database.getAccounts([username]);
            const exists = accounts && accounts.length > 0 && accounts[0] && accounts[0].name === username;

            let reputation = null;
            let rcPercent = null;
            let rcMana = null;

            if (exists && accounts[0]) {
                // Get reputation score using the formatter
                const formatter = this._getFormatter();
                if (formatter && formatter.reputation) {
                    reputation = formatter.reputation(accounts[0].reputation);
                }

                // Try to get RC (Resource Credits) info
                try {
                    const rc = this._getRC();
                    if (rc && rc.getRCMana) {
                        const rcInfo = await rc.getRCMana(username);
                        if (rcInfo) {
                            // Calculate RC percentage
                            const maxRC = BigInt(Math.trunc(rcInfo.max_rc || rcInfo.max_mana || 0));
                            const currentRC = BigInt(Math.trunc(rcInfo.rc_manabar?.current_mana || rcInfo.current_mana || 0));

                            if (maxRC > 0n) {
                                rcPercent = Number((currentRC * 10000n) / maxRC) / 100;
                                rcMana = rcInfo;
                            }
                        }
                    }
                } catch (rcError) {
                    console.warn("Failed to fetch RC info:", rcError);
                }
            }

            this.setState({
                _pending_username_validation: false,
                _username_exists: exists,
                _username_message: exists ? "" : "Account not found",
                _account_reputation: reputation,
                _account_data: exists ? accounts[0] : null,
                _rc_percent: rcPercent,
                _rc_mana: rcMana,
            }, () => {
                // Re-run key detection now that we have account data
                if (this.state._primary_key && exists) {
                    this._detectKeyType(this.state._primary_key);
                }
            });
        } catch (error) {
            console.error("Username validation error:", error);
            this.setState({
                _pending_username_validation: false,
                _username_exists: false,
                _username_message: error.message || "Error checking account",
            });
        }
    };


    _handlePrimaryKeyChange = (e) => {
        const key = e.target.value;

        this.setState({
            _primary_key: key,
            _pending_key_validation: true,
            _primary_key_valid: false,
            _key_detection_message: "",
        });

        if (this._keyValidationTimer) {
            clearTimeout(this._keyValidationTimer);
        }

        if (key.length < 8) {
            this.setState({
                _pending_key_validation: false,
                _primary_key_valid: false,
            });
            return;
        }

        this._keyValidationTimer = setTimeout(() => {
            this._detectKeyType(key);
        }, 300);
    };

    /**
     * Auto-detect the role of the key the user typed/pasted.
     *
     * The dialog accepts five shapes interchangeably in one field:
     *   - master password (derives every role on demand)
     *   - posting WIF, active WIF, owner WIF, memo WIF
     *
     * Detection rules:
     *   1. If the input is a valid WIF, compute its public key and match
     *      against the on-chain account's key_auths for posting/active/owner
     *      and memo_key. The matching role becomes `_selected_key_type`.
     *   2. If the input is a valid WIF but matches no on-chain role, it may
     *      still be the master password: pixa_bip39 master keys are
     *      themselves valid base58 WIFs (unlike legacy P5…-prefixed HIVE
     *      master passwords), so WIF-shape alone cannot rule "role key".
     *      Derive the role keys from it (the same derivation the login
     *      path uses) and match THOSE public keys against the account —
     *      any hit means "master". Only a key that is neither a role key
     *      nor a working master is marked invalid (wrong account or
     *      rotated key). If the auth module can't derive client-side, the
     *      key is provisionally accepted as master; validateCredentials
     *      settles it at confirm.
     *   3. Otherwise (not WIF-shaped, ≥ 8 chars) treat as master password.
     *      Final on-chain matching happens in validateCredentials at confirm;
     *      here we just accept the format and label it "master".
     *
     * `requiredKeyType` (when set by the caller) restricts what counts as
     * valid: anything not matching that role or 'master' is rejected.
     *
     * Side effects: sets `_selected_key_type`, `_primary_key_valid`,
     * `_key_detection_message`, and clears `_additional_keys` if the role
     * just changed.
     */
    _detectKeyType = (key) => {
        const { requiredKeyType } = this.props;
        const { _account_data } = this.state;
        const auth = this._getAuth();

        // Empty / too-short → not valid, no role detected
        if (!key || key.length < 8) {
            this.setState({
                _pending_key_validation: false,
                _primary_key_valid: false,
                _key_detection_message: "",
            });
            return;
        }

        // ── Shape check: WIF or master password? ──────────────────────────
        let isWif = false;
        if (auth && auth.isWif) {
            try { isWif = auth.isWif(key); } catch (_) { isWif = false; }
        } else {
            // A WIF is always exactly 51 base58 chars (0x80 + 32-byte key
            // + 4-byte checksum = 37 bytes → 51 digits, first byte non-zero).
            isWif = /^5[HJK][1-9A-HJ-NP-Za-km-z]{49}$/.test(key);
        }

        // ── Path A: WIF — match against on-chain authorities ──────────────
        if (isWif) {
            // Need account data to identify which role this WIF belongs to.
            if (!_account_data) {
                // Account not yet resolved. Accept format provisionally;
                // the post-account-resolve callback will re-run detection.
                this.setState({
                    _pending_key_validation: false,
                    _primary_key_valid: true,
                    _key_detection_message: "Key format OK — waiting for account…",
                });
                return;
            }

            let publicKey = null;
            try {
                if (auth && auth.wifToPublic) {
                    publicKey = auth.wifToPublic(key);
                }
            } catch (_) { publicKey = null; }

            if (!publicKey) {
                this.setState({
                    _pending_key_validation: false,
                    _primary_key_valid: false,
                    _key_detection_message: "Invalid key format",
                });
                return;
            }

            const detected = this._matchPublicKeyToRole(publicKey, _account_data);

            if (!detected) {
                // The WIF's own public key is not one of the account's
                // authorities. On Pixagram that does NOT prove it's a wrong
                // key: pixa_bip39 master keys are themselves valid WIFs, and
                // a master's own pubkey is never on-chain — only its derived
                // children are. So before rejecting, test the key AS a
                // master password: derive the role keys from it and match
                // those public keys against the account.
                const derivedPubkeys = this._deriveRolePublicKeysFromMaster(
                    _account_data.name, key, auth
                );

                const acceptAsMaster = (message) => {
                    if (requiredKeyType && requiredKeyType !== 'master') {
                        // Caller demands a specific role WIF; a master
                        // password won't do here (mirrors Path B).
                        this.setState({
                            _pending_key_validation: false,
                            _primary_key_valid: false,
                            _key_detection_message: t("components.login_dialog.the_action_requires_the_key_wif_not", {
                                requiredKeyType: requiredKeyType
                            }),
                        });
                        return;
                    }
                    const masterRoleChanged = this.state._selected_key_type !== 'master';
                    this.setState({
                        _selected_key_type: 'master',
                        _pending_key_validation: false,
                        _primary_key_valid: true,
                        _key_detection_message: message,
                        ...(masterRoleChanged ? {
                            _additional_keys: { posting: "", active: "", owner: "", memo: "" },
                        } : {}),
                    });
                };

                if (Array.isArray(derivedPubkeys)) {
                    // Exact check possible: the key is the master iff any
                    // derived pubkey is one of the account's authorities.
                    const masterMatches = derivedPubkeys.some(
                        (pk) => this._matchPublicKeyToRole(pk, _account_data) !== null
                    );
                    if (masterMatches) {
                        acceptAsMaster("Master password — will derive all keys");
                    } else {
                        this.setState({
                            _pending_key_validation: false,
                            _primary_key_valid: false,
                            _key_detection_message: t("components.login_dialog.key_doesnt_match_any_of_s_authorities", {
                                name: _account_data.name
                            }),
                        });
                    }
                } else {
                    // The auth module exposes no client-side master
                    // derivation, so a wrong role WIF and a WIF-shaped
                    // master are indistinguishable here. Accept
                    // provisionally as master (same spirit as the
                    // !_account_data provisional path above) —
                    // validateCredentials at confirm is authoritative.
                    acceptAsMaster("Master password format — verified at login");
                }
                return;
            }

            // requiredKeyType gate: caller demanded a specific role
            if (requiredKeyType && requiredKeyType !== 'master' && detected !== requiredKeyType) {
                this.setState({
                    _pending_key_validation: false,
                    _primary_key_valid: false,
                    _key_detection_message: t("components.login_dialog.this_is_a_key_the_action_requires", {
                        detected: detected,
                        requiredKeyType: requiredKeyType
                    }),
                });
                return;
            }

            // Detection succeeded. If the role just changed, clear any
            // stale additional-keys that step 2 might have populated.
            const roleChanged = this.state._selected_key_type !== detected;
            this.setState({
                _selected_key_type: detected,
                _pending_key_validation: false,
                _primary_key_valid: true,
                _key_detection_message: t("components.login_dialog.detected_key", {
                    detected: KEY_TYPES[detected]?.label ? t(KEY_TYPES[detected].label) : detected
                }),
                ...(roleChanged ? {
                    _additional_keys: { posting: "", active: "", owner: "", memo: "" },
                } : {}),
            });
            return;
        }

        // ── Path B: master password — format-only check here ──────────────
        // Final correctness is verified by validateCredentials at confirm.
        if (requiredKeyType && requiredKeyType !== 'master') {
            // Caller demands a specific WIF; master won't do unless it
            // happens to derive a matching key, which we can't check
            // cheaply on every keystroke. Tell the user.
            this.setState({
                _pending_key_validation: false,
                _primary_key_valid: false,
                _key_detection_message: t("components.login_dialog.the_action_requires_the_key_wif_not", {
                    requiredKeyType: requiredKeyType
                }),
            });
            return;
        }

        const roleChanged = this.state._selected_key_type !== 'master';
        this.setState({
            _selected_key_type: 'master',
            _pending_key_validation: false,
            _primary_key_valid: true,
            _key_detection_message: "Master password — will derive all keys",
            ...(roleChanged ? {
                _additional_keys: { posting: "", active: "", owner: "", memo: "" },
            } : {}),
        });
    };

    /**
     * Derive the public keys of all four roles from a candidate master
     * password, using whatever derivation surface the dpixa auth module
     * exposes. This MUST be the same derivation the actual login path
     * (quickLogin / validateCredentials) uses, so detection and login
     * can never disagree.
     *
     * Returns an array of public-key strings, or null when the auth
     * module offers no client-side derivation (callers then fall back
     * to provisional acceptance — validateCredentials is authoritative).
     */
    _deriveRolePublicKeysFromMaster = (name, masterKey, auth) => {
        if (!name || !masterKey || !auth) return null;
        const roles = ['posting', 'active', 'owner', 'memo'];
        try {
            // hive-js style: one call returns { posting: wif, postingPubkey, … }
            if (typeof auth.getPrivateKeys === 'function') {
                const keys = auth.getPrivateKeys(name, masterKey, roles);
                if (keys) {
                    const pubkeys = roles.map((role) => {
                        if (keys[`${role}Pubkey`]) return keys[`${role}Pubkey`];
                        if (keys[role] && typeof auth.wifToPublic === 'function') {
                            try { return auth.wifToPublic(keys[role]); } catch (_) { return null; }
                        }
                        return null;
                    }).filter(Boolean);
                    if (pubkeys.length > 0) return pubkeys;
                }
            }
            // Per-role derivation: auth.toWif(name, password, role)
            if (typeof auth.toWif === 'function' && typeof auth.wifToPublic === 'function') {
                const pubkeys = roles.map((role) => {
                    try { return auth.wifToPublic(auth.toWif(name, masterKey, role)); }
                    catch (_) { return null; }
                }).filter(Boolean);
                if (pubkeys.length > 0) return pubkeys;
            }
        } catch (_) { /* fall through to null */ }
        return null;
    };

    /**
     * Given a public key and an on-chain account, return which role it
     * corresponds to ('posting' | 'active' | 'owner' | 'memo'), or null.
     */
    _matchPublicKeyToRole = (publicKey, accountData) => {
        if (!publicKey || !accountData) return null;
        if (publicKey === accountData.memo_key) return 'memo';
        const roles = ['posting', 'active', 'owner'];
        for (const role of roles) {
            const auths = accountData[role]?.key_auths;
            if (Array.isArray(auths) && auths.some(([pk]) => pk === publicKey)) {
                return role;
            }
        }
        return null;
    };

    _handleToggleShowPrimaryKey = () => {
        this.setState({ _show_primary_key: !this.state._show_primary_key });
    };

    // ── Autocomplete popup control ─────────────────────────────────────
    _handleAutocompleteOpen = () => {
        if (!this.state._autocomplete_open) this.setState({ _autocomplete_open: true });
    };

    _handleAutocompleteClose = () => {
        if (this.state._autocomplete_open) this.setState({ _autocomplete_open: false });
    };

    // ── Simple / Advanced mode ─────────────────────────────────────────
    /**
     * Toggle between the compact one-shot login and the full 3-step flow.
     * Always returns to step 1 and clears any stale login status so the
     * Confirm step doesn't show a result from the other mode.
     */
    _handleToggleAdvanced = () => {
        if (this.state._login_status === 'pending') return;
        this.setState(prev => ({
            _advanced_mode: !prev._advanced_mode,
            _tab_value: 0,
            _login_status: null,
            _login_error: null,
            _login_progress: null,
        }));
    };

    /**
     * Simple-mode LOG IN: skip the Security and Confirm steps entirely and
     * log in with the defaults (persistent session, no vault password).
     */
    _handleSimpleLogin = () => {
        const { _login_status } = this.state;
        if (_login_status === 'pending') return;
        if (_login_status === 'success') {
            this.props.onClose && this.props.onClose();
            return;
        }
        this._executeLogin();
    };

    _getSimpleButtonText = () => {
        switch (this.state._login_status) {
            case 'pending': return 'LOGGING IN...';
            case 'success': return 'DONE';
            case 'error': return 'RETRY';
            default: return 'LOG IN';
        }
    };

    _handleOpenCreateAccount = () => {
        const { onOpenCreateAccount } = this.props;
        if (typeof onOpenCreateAccount === 'function') onOpenCreateAccount();
    };


    _handlePINChange = (e) => {
        this.setState({ _pin: e.target.value });
    };

    _handlePINConfirmationChange = (e) => {
        this.setState({ _pin_confirmation: e.target.value });
    };

    _handleToggleShowPIN = () => {
        this.setState({ _show_pin: !this.state._show_pin });
    };

    _isPINValid = () => {
        const { _pin, _pin_confirmation } = this.state;
        const analysis = analyzePassword(_pin);
        return analysis.meetsMinimum && _pin === _pin_confirmation;
    };

    _isPINEnabled = () => {
        // PIN is enabled automatically when valid
        const valid = this._isPINValid();
        // SECURITY ENFORCEMENT: PIN requires persistent storage
        // (PIN + temporary = useless, not allowed)
        if (valid && !this.state._persist_session) {
            // Auto-enable persistence when PIN is set
            this.setState({ _persist_session: true });
        }
        return valid;
    };

    _handleSessionTimeoutChange = (e, value) => {
        this.setState({ _session_timeout: value });
    };

    _handlePINTimeoutChange = (e, value) => {
        this.setState({ _pin_timeout: value });
    };

    _handleAdditionalKeyChange = (keyType, value) => {
        this.setState(prev => ({
            _additional_keys: {
                ...prev._additional_keys,
                [keyType]: value,
            }
        }));
    };

    _handleKeyPINProtectionChange = (keyType, enabled) => {
        this.setState(prev => ({
            _key_pin_protection: {
                ...prev._key_pin_protection,
                [keyType]: enabled,
            }
        }));
    };

    _handleAccordionChange = (panel) => (_, isExpanded) => {
        this.setState({ _expanded: isExpanded ? panel : null });
    };

    _handlePersistSessionChange = (e) => {
        const persist = e.target.checked;
        if (!persist) {
            this.setState({ _persist_session: false, _pin: "", _pin_confirmation: "", _pin_hint: "" });
        } else {
            this.setState({ _persist_session: true });
        }
    };

    _handlePINHintChange = (e) => {
        this.setState({ _pin_hint: e.target.value.slice(0, 100) });
    };

    _fetchEncryptionProfile = async () => {
        const { api } = this.props;
        if (!api?.settingsDb) return;
        try {
            const col = await api.settingsDb.getCollection('pq_vault_config');
            const cached = await col.get('autotune_params');
            if (cached?.label) {
                this.setState({ _encryption_profile: encryptionProfileLabel(cached.label) });
            }
        } catch (_) {}
    };

    _handleMouseDownPassword = (event) => {
        event.preventDefault();
    };

    // ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬
    // QR Scanner Handling
    // ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬
    _handleOpenQRScanner = (target) => {
        this.setState({
            _qr_scanner_open: true,
            _qr_scanner_target: target,
        });
    };

    _handleCloseQRScanner = () => {
        this.setState({
            _qr_scanner_open: false,
            _qr_scanner_target: null,
        });
    };

    _handleQRScanResult = (result) => {
        const { _qr_scanner_target } = this.state;

        if (_qr_scanner_target === 'primary') {
            // Set primary key
            this.setState({
                _primary_key: result,
                _qr_scanner_open: false,
                _qr_scanner_target: null,
            }, () => {
                // Trigger detection (replaces old fixed-role validation)
                this._detectKeyType(result);
            });
        } else if (['posting', 'active', 'owner', 'memo'].includes(_qr_scanner_target)) {
            // Set additional key
            this.setState(prev => ({
                _additional_keys: {
                    ...prev._additional_keys,
                    [_qr_scanner_target]: result,
                },
                _qr_scanner_open: false,
                _qr_scanner_target: null,
            }));
        }
    };

    // ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬
    // Step Navigation
    // ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬
    _firstStepDone = () => {
        const { _username_exists, _primary_key_valid } = this.state;
        return _username_exists && _primary_key_valid;
    };

    _secondStepDone = () => {
        // Always done - PIN is optional and auto-enabled
        return true;
    };

    _thirdStepDone = () => {
        return true;
    };

    _canClickNext = () => {
        const { _tab_value } = this.state;

        return (
            (_tab_value === 0 && this._firstStepDone()) ||
            (_tab_value === 1 && this._secondStepDone()) ||
            (_tab_value === 2 && this._thirdStepDone())
        );
    };

    _handleTabChange = (e, value) => {
        // Steps 2 & 3 are only reachable in advanced mode.
        if (!this.state._advanced_mode && parseInt(value) !== 0) return;
        if (value < this.state._tab_value || this._canClickNext()) {
            const nextTab = parseInt(value);
            this.setState({ _tab_value: nextTab }, () => {
                this._swipeableViewScrollTop();
                // When landing on the Security step, refresh the encryption
                // profile if we don't have one yet. The benchmark might have
                // finished between mount and this moment.
                if (nextTab === 1 && !this.state._encryption_profile) {
                    this._fetchEncryptionProfile();
                }
            });
        }
    };

    _swipeableViewScrollTop = () => {
        const views = document.getElementsByClassName("react-swipeable-view-container");
        if (views.length > 0) {
            const view = views.item(0);
            const child = view.children.item(0);
            if (child) {
                child.style.scrollBehavior = "smooth";
                child.scrollTop = 0;
            }
        }
    };

    /**
     * Trigger the browser's "Save password?" prompt after successful login.
     *
     * Saves a SINGLE credential: id=username, password=primaryKey. Whatever
     * the user typed (master password or an individual WIF) becomes the saved
     * password. Next time, the browser autofills username + that same value,
     * and the user picks the matching key type if it's not the default.
     *
     * No suffixed `username:keytype` entries — one account, one credential.
     *
     * @param {string} username
     * @param {string} primaryKey — master password or individual WIF
     * @private
     */
    _triggerCredentialSave = (username, primaryKey) => {
        if (!primaryKey) return;

        // Path 1: Credential Management API (Chromium 51+)
        if (typeof window !== 'undefined' && window.PasswordCredential) {
            try {
                const cred = new window.PasswordCredential({
                    id:       username,
                    password: primaryKey,
                    name:     `@${username}`,
                });
                navigator.credentials.store(cred).catch(() => {});
                return;
            } catch (_) {}
        }

        // Path 2: Hidden form submission (Firefox, Safari)
        const form = this._credentialFormRef?.current;
        if (form) {
            try {
                const uInput = form.querySelector('input[name="username"]');
                const pInput = form.querySelector('input[name="password"]');
                if (uInput) uInput.value = username;
                if (pInput) pInput.value = primaryKey;
                if (form.requestSubmit) {
                    form.requestSubmit();
                }
            } catch (_) {}
        }
    };


// FIXED: Login Execution - Ensures Events are ALWAYS Emitted

    _executeLogin = async () => {
        const { api, onLogin, onClose } = this.props;
        const {
            _username,
            _selected_key_type,
            _primary_key,
            _pin,
            _persist_session,
            _session_timeout,
            _pin_timeout,
            _additional_keys,
            _key_pin_protection,
        } = this.state;

        const _enable_pin = this._isPINEnabled();
        // SECURITY ENFORCEMENT: Resolve the actual persist flag
        // PIN enabled → always persistent (PIN + temporary is blocked)
        // No PIN → respect user choice
        const _effective_persist = _enable_pin || _persist_session;

        if (!api) {
            this.setState({
                _login_status: 'error',
                _login_error: 'API not available',
            });
            return;
        }

        this.setState({
            _login_status: 'pending',
            _login_progress: 'Initializing...',
        });

        // ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ FIX: Track if event was emitted to prevent duplicates
        let eventEmitted = false;

        try {
            // Update API config with timeouts
            if (api.updateConfig) {
                api.updateConfig({
                    SESSION_TIMEOUT: _session_timeout * 60 * 1000,
                    PIN_TIMEOUT: _pin_timeout * 60 * 1000,
                });
            }

            // Initialize vault if PIN is enabled
            if (_enable_pin) {
                if (!api.initialized) {
                    throw new Error('API not initialized. Please refresh the page.');
                }

                this.setState({ _login_progress: 'Setting up secure vault...' });
                console.time('initializeVault');
                try {
                    await api.initializeVault(_pin, {
                        pinTimeout: _pin_timeout * 60 * 1000,
                    });
                } catch (vaultError) {
                    console.error('Vault initialization failed:', vaultError);
                    throw new Error('Failed to initialize secure storage: ' + vaultError.message);
                }
                console.timeEnd('initializeVault');

                // FIX (v4.1): Persist PIN hint so UnlockKeyDialog can display it
                if (this.state._pin_hint && api.settingsDb) {
                    try {
                        let hintCol;
                        try { await api.settingsDb.createCollection('pq_vault_config'); } catch (_) {}
                        hintCol = await api.settingsDb.getCollection('pq_vault_config');
                        const hintRecord = { hint: this.state._pin_hint, updated_at: Date.now() };
                        try {
                            await hintCol.add(hintRecord, { id: 'vault_hint' });
                        } catch (_) {
                            await hintCol.update('vault_hint', hintRecord);
                        }
                    } catch (e) {
                        console.warn('[LoginDialog] Failed to save PIN hint:', e);
                    }
                }
            }

            this.setState({ _login_progress: 'Validating credentials...' });
            console.time('validateCredentials');

            // Validate credentials first
            const validation = await api.validateCredentials(_username, _primary_key, _selected_key_type);
            console.timeEnd('validateCredentials');

            if (!validation.valid) {
                throw new Error(validation.error || 'Invalid credentials');
            }

            this.setState({ _login_progress: 'Storing keys...' });
            console.time('storeKeys');

            // Check if vault was successfully initialized
            const vaultReady = api.isVaultInitialized && api.isVaultInitialized();

            // ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚Â
            // FIX: Use consistent login path that ALWAYS creates sessions
            // ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚Â

            if (_enable_pin && vaultReady) {
                // Path 1: PIN-Protected Login
                // v6: Keys + PIN + timeouts all go to createSession in one call.
                // SessionManager handles device-wrapping + PIN sealing internally.
                let sessionKeys = {};

                if (_selected_key_type === 'master') {
                    const derivedKeys = await api.keyManager.addAccountWithMasterKey(_username, _primary_key, {
                        storeInVault: false,
                        matchedTypes: validation.matchedTypes,
                    });
                    sessionKeys = { ...derivedKeys };

                    if (validation.mismatchedTypes && validation.mismatchedTypes.length > 0) {
                        console.warn(
                            `[Login] Master password: ${validation.mismatchedTypes.join(', ')} key(s) don't match on-chain. ` +
                            t("components.login_dialog.only_key_s_will_be_available", {
                                matchedTypes: validation.matchedTypes.join(', ')
                            })
                        );
                    }
                } else {
                    await api.keyManager.addIndividualKey(_username, _selected_key_type, _primary_key, {
                        storeInVault: false,
                    });
                    sessionKeys[_selected_key_type] = _primary_key;

                    // Add additional keys if provided
                    const auth = this._getAuth();
                    for (const [keyType, keyValue] of Object.entries(_additional_keys)) {
                        if (keyValue && keyValue.length > 0) {
                            try {
                                if (auth && auth.isWif && !auth.isWif(keyValue)) {
                                    console.warn(`Invalid ${keyType} key format, skipping`);
                                    continue;
                                }
                                await api.keyManager.addIndividualKey(_username, keyType, keyValue, {
                                    storeInVault: false,
                                });
                                sessionKeys[keyType] = keyValue;
                            } catch (e) {
                                console.warn(`Failed to add ${keyType} key:`, e);
                            }
                        }
                    }
                }

                this.setState({ _login_progress: 'Creating session...' });
                console.timeEnd('storeKeys');
                console.time('createSession');

                // v6: ONE createSession call — handles device-wrap + PIN seal.
                // Timeout and Argon2 params are baked into the session record.
                if (api.sessionManager) {
                    try {
                        await api.sessionManager.createSession(_username, {
                            keys:           sessionKeys,
                            persistent:     true,
                            pin:            _pin,
                            timeout_ms:     _session_timeout * 60 * 1000,
                            pin_timeout_ms: _pin_timeout * 60 * 1000,
                            login_type:     _selected_key_type,
                            user_agent:     navigator.userAgent || 'unknown',
                        });
                        eventEmitted = true;
                    } catch (e) {
                        console.error('Session creation failed:', e);
                        throw new Error('Failed to create session: ' + e.message);
                    }
                }
                console.timeEnd('createSession');

                if (api.keyManager) {
                    api.keyManager.setActiveAccount(_username);
                }
            } else {
                // Path 2: Quick Login WITHOUT Vault
                // FIX: Don't skip session - we need the event!
                console.time('quickLogin');

                // Use quickLogin but DON'T skip session creation
                const loginResult = await api.quickLogin(_username, _primary_key, _selected_key_type, {
                    skipValidation: true,
                    validation: validation,
                    skipSession: false,
                    stayConnected: _effective_persist,
                    userAgent: navigator.userAgent || 'unknown',
                });

                // ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ FIX: Check if quickLogin created a session (event was emitted)
                eventEmitted = loginResult && (loginResult.sessionId || loginResult.eventEmitted);

                console.timeEnd('quickLogin');
                console.timeEnd('storeKeys');

                // Add additional keys to session memory
                // FIX (v4.1 — Bug B+C): Use addIndividualKey() instead of raw
                // sessionKeys.set(). The old code stored raw strings that fail
                // _decryptFromCache() (Bug B) and never updated the session
                // record's plaintext_keys, so additional keys were lost on
                // tab reload (Bug C).
                if (_selected_key_type !== 'master') {
                    const auth = this._getAuth();
                    const additionalKeysAdded = {};
                    for (const [keyType, keyValue] of Object.entries(_additional_keys)) {
                        if (keyValue && keyValue.length > 0) {
                            try {
                                if (auth && auth.isWif && !auth.isWif(keyValue)) {
                                    console.warn(`Invalid ${keyType} key format, skipping`);
                                    continue;
                                }
                                await api.keyManager.addIndividualKey(_username, keyType, keyValue, {
                                    storeInVault: false,
                                });
                                additionalKeysAdded[keyType] = keyValue;
                            } catch (e) {
                                console.warn(`Failed to add ${keyType} key:`, e);
                            }
                        }
                    }

                    // FIX (v5.0): Persist additional keys to session via public API.
                    // Previously wrote plaintext_keys JSON (v4.3 C1 regression).
                    // Now uses exportKeysForSealing/importKeys + createSession which
                    // wraps keys with device-bound CryptoKey (persist mode) or
                    // seals with Argon2id+ChaCha20 (PIN mode).
                    if (Object.keys(additionalKeysAdded).length > 0 && _effective_persist && api.sessionManager) {
                        try {
                            const sm = api.sessionManager;
                            const currentKeys = sm.exportKeysForSealing() || {};
                            const mergedKeys = { ...currentKeys, ...additionalKeysAdded };
                            sm.importKeys(mergedKeys);

                            // Re-create session with full key set — createSession
                            // handles device-key wrapping (persist) or vault sealing (PIN)
                            const normalizedUser = _username.replace(/^@/, '').toLowerCase().trim();
                            await sm.createSession(normalizedUser, {
                                keys:           mergedKeys,
                                persistent:     true,
                                timeout_ms:     _session_timeout * 60 * 1000,
                                login_type:     'additional_keys',
                                user_agent:     navigator.userAgent || 'unknown',
                            });
                        } catch (e) {
                            console.warn('[LoginDialog] Failed to persist additional keys to session:', e);
                            // Keys are still in memory via importKeys() — they'll work
                            // for this tab session, just won't survive a reload
                        }
                    }
                }
            }

            // Double-check that session was actually created
            // FIX (v5.0): Escalated to error — if this fires, there's a bug in the
            // login flow, not a normal fallback condition.
            if (!eventEmitted && api.eventEmitter) {
                console.error('[LoginDialog] BUG: session_created not emitted by normal flow — emitting manually');
                api.eventEmitter.emit('session_created', { account: _username });
            }

            this.setState({
                _login_status: 'success',
                _login_progress: null,
            });

            // Trigger browser's "Save password?" prompt — single credential only.
            // Browser stores username + primaryKey (master password or WIF).
            if (_effective_persist) {
                this._triggerCredentialSave(_username, _primary_key);
            }

            // Notify parent
            if (onLogin) {
                onLogin({
                    username: _username,
                    keyType: _selected_key_type,
                    enabledPIN: _enable_pin,
                    persistSession: _effective_persist,
                    sessionTimeout: _session_timeout,
                    pinTimeout: _pin_timeout,
                    derivedKeys: validation.derivedKeys,
                    publicKey: validation.publicKey,
                    matchedTypes: validation.matchedTypes,
                    mismatchedTypes: validation.mismatchedTypes,
                });
            }

            // Warn user about mismatched keys (master password doesn't derive all on-chain keys)
            if (_selected_key_type === 'master' && validation.mismatchedTypes && validation.mismatchedTypes.length > 0) {
                const missing = validation.mismatchedTypes.join(', ');
                if (actions && typeof actions.trigger_snackbar === 'function') {
                    actions.trigger_snackbar(
                        t("components.login_dialog.your_key_s_were_changed_on_chain", {
                            missing: missing
                        }) +
                        t("components.login_dialog.operations_requiring_those_keys_e_g_transfers"),
                        'warning'
                    );
                }
            }

            // Close dialog after short delay
            setTimeout(() => {
                if (onClose) onClose();
            }, 1000);

        } catch (error) {
            console.error('Login error:', error);
            console.error('Error code:', error.code);
            console.error('Error stack:', error.stack);

            // Handle specific error types
            let errorMessage = error.message || 'Login failed';

            if (error.code === 'PIN_TOO_SHORT') {
                errorMessage = 'PIN must be at least 6 characters';
            } else if (error.code === 'PIN_REQUIRED') {
                errorMessage = 'PIN is required';
            } else if (error.code === 'NOT_INITIALIZED') {
                errorMessage = 'API not properly initialized. Please refresh and try again.';
            } else if (error.code === 'VAULT_INIT_FAILED') {
                errorMessage = 'Failed to initialize secure storage. ' + (error.message || '');
            } else if (error.code === 'VALIDATION_FAILED') {
                errorMessage = 'Invalid credentials. Please check your key.';
            } else if (error.code === 'INVALID_KEY') {
                errorMessage = 'Invalid key format';
            } else if (error.code === 'KEY_NOT_FOUND') {
                errorMessage = `Key not found for ${error.data?.account}/${error.data?.keyType}`;
            }

            this.setState({
                _login_status: 'error',
                _login_error: errorMessage,
                _login_progress: null,
            });
        }
    };
    _handleConfirmClick = () => {
        const { _tab_value, _login_status } = this.state;

        if (_tab_value === 2) {
            if (_login_status === 'success') {
                this.props.onClose && this.props.onClose();
            } else if (_login_status !== 'pending') {
                this._executeLogin();
            }
        } else {
            this._handleTabChange({}, _tab_value + 1);
        }
    };

    _getConfirmButtonText = () => {
        const { _tab_value, _login_status } = this.state;

        if (_tab_value === 2) {
            switch (_login_status) {
                case 'pending': return 'LOGGING IN...';
                case 'success': return 'DONE';
                case 'error': return 'RETRY';
                default: return 'LOGIN';
            }
        }
        return 'NEXT';
    };

    // ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬
    // Render
    // ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬
    render() {
        const { classes, open, onClose, onOpenCreateAccount, requiredKeyType, requiredKeyHint } = this.props;
        const {
            _fullscreen,
            _keyboard_open,
            _tab_value,
            _expanded,
            _advanced_mode,
            _autocomplete_open,
            _username,
            _pending_username_validation,
            _username_exists,
            _username_message,
            _selected_key_type,
            _primary_key,
            _show_primary_key,
            _primary_key_valid,
            _pending_key_validation,
            _account_reputation,
            _rc_percent,
            _rc_mana,
            _pin,
            _pin_confirmation,
            _show_pin,
            _persist_session,
            _pin_hint,
            _encryption_profile,
            _session_timeout,
            _pin_timeout,
            _additional_keys,
            _key_pin_protection,
            _login_status,
            _login_error,
            _login_progress,
            _qr_scanner_open,
        } = this.state;

        const pinEnabled = this._isPINEnabled();
        // Shrink the brand header when vertical space is scarce: advanced
        // mode (stepper needs the room) or mobile keyboard open (the visual
        // viewport is roughly halved — keep the fields in view).
        const compactHeader = _advanced_mode || (_fullscreen && _keyboard_open);

        return (
            <React.Fragment>
                <Dialog
                    className={classes.dialog}
                    open={open}
                    fullScreen={_fullscreen}
                    fullWidth={true}
                    disablePortal={false}
                    onClose={onClose}
                    keepMounted={false}
                >
                    {/* Brand header — logo, name, tagline. Shrinks in advanced
                        mode and while the mobile keyboard is open. */}
                    <div className={`${classes.header} ${compactHeader ? classes.headerCompact : ""}`}>
                        <IconButton
                            aria-label="close"
                            className={classes.closeButton}
                            onClick={onClose}
                            disabled={_login_status === 'pending'}
                        >
                            <CloseIcon />
                        </IconButton>
                        <img
                            src={PIXAGRAM_LOGO}
                            alt={t("components.login_dialog.pixagram")}
                            draggable={false}
                            className={`${classes.headerLogo} ${compactHeader ? classes.headerLogoCompact : ""}`}
                        />
                        <Typography component="h1" variant="h5" className={classes.headerTitle}>
                            {t("components.login_dialog.pixagram")}
                        </Typography>
                        <Collapse in={!compactHeader}>
                            <Typography className={classes.headerTagline}>
                                {t("components.login_dialog.inherit_eternity_shape_infinity")}
                            </Typography>
                        </Collapse>
                    </div>

                    {/* Stepper — unlocked by Advanced mode only. */}
                    <Collapse in={_advanced_mode} style={{ flexShrink: 0 }}>
                        <Stepper activeStep={_tab_value}>
                            <Step completed={_tab_value > 0}>
                                <StepLabel>{t("components.login_dialog.auth")}</StepLabel>
                            </Step>
                            <Step completed={_tab_value > 1}>
                                <StepLabel optional={<Typography variant="caption" style={{fontWeight: "bold"}}>{t("components.login_dialog.optional")}</Typography>}>{t("words.security", {TUC: true})}</StepLabel>
                            </Step>
                            <Step completed={_tab_value > 2}>
                                <StepLabel>{t("words.confirm", {TUC: true})}</StepLabel>
                            </Step>
                        </Stepper>
                    </Collapse>

                    {/* Scrollable content area — grows to absorb the space
                        between the stepper and the pinned action bar. */}
                    <div className={classes.swipeableContainer}>
                        <SwipeableViews
                            ignoreNativeScroll={true}
                            containerStyle={{ height: "100%" }}
                            animateTransitions={true}
                            disableLazyLoading={true}
                            resistance={true}
                            springConfig={{ tension: 450, friction: 60, duration: '360ms', easeFunction: 'cubic-bezier(0.280, 0.840, 0.420, 1)', delay: '5ms' }}
                            index={_tab_value}
                            onChangeIndex={(v) => this._handleTabChange({}, v)}
                            disabled={!_advanced_mode}
                        >
                            <StepAuthenticate
                                classes={classes}
                                username={_username}
                                usernameMessage={_username_message}
                                pendingUsernameValidation={_pending_username_validation}
                                usernameExists={_username_exists}
                                selectedKeyType={_selected_key_type}
                                primaryKey={_primary_key}
                                showPrimaryKey={_show_primary_key}
                                primaryKeyValid={_primary_key_valid}
                                pendingKeyValidation={_pending_key_validation}
                                keyDetectionMessage={this.state._key_detection_message}
                                requiredKeyType={requiredKeyType}
                                requiredKeyHint={requiredKeyHint}
                                authors={this.state._authors}
                                selectedAuthor={this.state._selected_author}
                                searching={this.state._searching}
                                accountReputation={_account_reputation}
                                onUsernameInputChange={this._onUsernameInputChange}
                                onAutocompleteChange={this._onAutocompleteChange}
                                autocompleteOpen={_autocomplete_open}
                                onAutocompleteOpen={this._handleAutocompleteOpen}
                                onAutocompleteClose={this._handleAutocompleteClose}
                                onPrimaryKeyChange={this._handlePrimaryKeyChange}
                                onToggleShowPrimaryKey={this._handleToggleShowPrimaryKey}
                                onMouseDownPassword={this._handleMouseDownPassword}
                                onOpenQRScanner={this._handleOpenQRScanner}
                            />
                            <StepSecurity
                                classes={classes}
                                pin={_pin}
                                pinConfirmation={_pin_confirmation}
                                showPIN={_show_pin}
                                persistSession={_persist_session}
                                sessionTimeout={_session_timeout}
                                pinTimeout={_pin_timeout}
                                pinHint={this.state._pin_hint}
                                encryptionProfile={this.state._encryption_profile}
                                selectedKeyType={_selected_key_type}
                                additionalKeys={_additional_keys}
                                keyPINProtection={_key_pin_protection}
                                expanded={_expanded}
                                onPINChange={this._handlePINChange}
                                onPINConfirmationChange={this._handlePINConfirmationChange}
                                onToggleShowPIN={this._handleToggleShowPIN}
                                onPersistSessionChange={this._handlePersistSessionChange}
                                onSessionTimeoutChange={this._handleSessionTimeoutChange}
                                onPINTimeoutChange={this._handlePINTimeoutChange}
                                onPINHintChange={this._handlePINHintChange}
                                onAdditionalKeyChange={this._handleAdditionalKeyChange}
                                onKeyPINProtectionChange={this._handleKeyPINProtectionChange}
                                onAccordionChange={this._handleAccordionChange}
                                onMouseDownPassword={this._handleMouseDownPassword}
                                onOpenQRScanner={this._handleOpenQRScanner}
                            />
                            <StepConfirm
                                classes={classes}
                                username={_username}
                                selectedKeyType={_selected_key_type}
                                pinEnabled={pinEnabled}
                                persistSession={_persist_session || pinEnabled}
                                sessionTimeout={_session_timeout}
                                pinTimeout={_pin_timeout}
                                additionalKeys={_additional_keys}
                                keyPINProtection={_key_pin_protection}
                                loginStatus={_login_status}
                                loginError={_login_error}
                                loginProgress={_login_progress}
                            />
                        </SwipeableViews>
                    </div>

                    {_advanced_mode ? (
                        <React.Fragment>
                            <Typography className={classes.footerLine} style={{ marginTop: "0px", marginBottom: "4px" }}>
                                {t("components.login_dialog.prefer_it_simple")}{' '}
                                <Link
                                    component="button"
                                    type="button"
                                    underline="always"
                                    className={classes.footerLink}
                                    onClick={this._handleToggleAdvanced}
                                    disabled={_login_status === 'pending'}
                                >
                                    {t("components.login_dialog.simple_mode")}
                                </Link>
                            </Typography>
                            <DialogActions className={classes.dialogActions}>
                                <Fade in={_tab_value > 0}>
                                    <Button
                                        variant="text"
                                        color="primary"
                                        onClick={() => this._handleTabChange({}, _tab_value - 1)}
                                        disabled={_tab_value === 0 || _login_status === 'pending'}
                                    >{t("words.back", {TUC: true})} </Button>
                                </Fade>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={onClose}
                                    disabled={_login_status === 'pending'}
                                >{t("words.cancel", {TUC: true})} </Button>
                                <Button
                                    className={classes.whiteButton}
                                    variant="contained"
                                    color="primary"
                                    onClick={this._handleConfirmClick}
                                    disabled={!this._canClickNext() || _login_status === 'pending'}
                                >
                                    {this._getConfirmButtonText()}
                                </Button>
                            </DialogActions>
                        </React.Fragment>
                    ) : (
                        <div className={classes.simpleFooter}>
                            {/* Login status — shown here since steps 2 & 3 are skipped */}
                            <Collapse in={!!_login_status}>
                                <div
                                    className={`${classes.statusIndicator} ${_login_status || 'pending'}`}
                                    style={{ marginTop: "0px", marginBottom: "12px" }}
                                >
                                    {_login_status === 'pending' && (
                                        <React.Fragment>
                                            <CircularProgress size={20} color="inherit" />
                                            <Typography variant="body2">{_login_progress || "Authenticating..."}</Typography>
                                        </React.Fragment>
                                    )}
                                    {_login_status === 'success' && (
                                        <React.Fragment>
                                            <CheckRounded />
                                            <Typography variant="body2">{t("components.login_dialog.login_successful")}</Typography>
                                        </React.Fragment>
                                    )}
                                    {(_login_status === 'error' || _login_status === 'warning') && (
                                        <React.Fragment>
                                            <ErrorRounded />
                                            <Typography variant="body2">{_login_error || "Login failed"}</Typography>
                                        </React.Fragment>
                                    )}
                                </div>
                            </Collapse>

                            {/* One-shot login: skips Security & Confirm, uses defaults */}
                            <Button
                                className={classes.whiteButton}
                                variant="contained"
                                color="primary"
                                fullWidth
                                size="large"
                                onClick={this._handleSimpleLogin}
                                disabled={!this._firstStepDone() || _login_status === 'pending'}
                            >
                                {this._getSimpleButtonText()}
                            </Button>

                            <Typography className={classes.footerLine}>
                                {t("components.login_dialog.wants_more_control")}{' '}
                                <Link
                                    component="button"
                                    type="button"
                                    underline="always"
                                    className={classes.footerLink}
                                    onClick={this._handleToggleAdvanced}
                                >
                                    {t("components.login_dialog.advanced_mode")}
                                </Link>
                            </Typography>

                            {typeof onOpenCreateAccount === 'function' && (
                                <Typography className={classes.footerLine} style={{ marginTop: "6px" }}>
                                    {t("components.login_dialog.new_here")}{' '}
                                    <Link
                                        component="button"
                                        type="button"
                                        underline="always"
                                        className={classes.footerLink}
                                        onClick={this._handleOpenCreateAccount}
                                        disabled={_login_status === 'pending'}
                                    >
                                        {t("components.login_dialog.create_account")}
                                    </Link>
                                </Typography>
                            )}
                        </div>
                    )}
                </Dialog>
                {/* QR Scanner Dialog */}
                <QRScannerDialog
                    open={_qr_scanner_open}
                    onClose={this._handleCloseQRScanner}
                    onScanResult={this._handleQRScanResult}
                />
                {/* Hidden form for browser password manager integration.
                    Browsers intercept form submissions to trigger "Save password?"
                    The form is invisible and submitted programmatically on login success. */}
                <form
                    ref={this._credentialFormRef}
                    action="javascript:void(0)"
                    method="POST"
                    style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}
                    aria-hidden="true"
                    tabIndex={-1}
                >
                    <input type="text" name="username" autoComplete="username" tabIndex={-1} />
                    <input type="password" name="password" autoComplete="current-password" tabIndex={-1} />
                </form>
            </React.Fragment>
        );
    }
}

/**
 * LoginDialog Props:
 * @param {boolean} open - Dialog open state
 * @param {function} onClose - Close handler
 * @param {function} onLogin - Login success callback with result object
 * @param {function} onOpenCreateAccount - "New Here? Create Account." handler; the link is hidden when absent
 * @param {object} api - PixaProxyAPI instance (must have called initialize())
 * @param {string} requiredKeyType - Force specific key type ('posting'|'active'|'owner'|'memo')
 * @param {string} requiredKeyHint - Hint text when specific key is required
 * @param {string} defaultUsername - Pre-filled username
 * @param {number} defaultSessionTimeout - Default session timeout in minutes (default: 30)
 * @param {number} defaultPinTimeout - Default PIN timeout in minutes (default: 5)
 */
LoginDialog.defaultProps = {
    open: false,
    onClose: () => {},
    onLogin: () => {},
    onOpenCreateAccount: null,
    api: null,
    requiredKeyType: null,
    requiredKeyHint: null,
    defaultUsername: "",
    defaultSessionTimeout: 60 * 48,   // 48 hours (in minutes)
    defaultPinTimeout: 60,             // 60 minutes
};

export default withLanguage(withStyles(styles)(LoginDialog));