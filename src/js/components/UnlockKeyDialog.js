import * as React from "preact/compat";
import { memo, useMemo, useState, useEffect } from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import InputAdornment from "@material-ui/core/InputAdornment";
import OutlinedInput from "@material-ui/core/OutlinedInput";
import IconButton from "@material-ui/core/IconButton";
import Box from "@material-ui/core/Box";
import CircularProgress from "@material-ui/core/CircularProgress";
import Tooltip from "@material-ui/core/Tooltip";
import Fade from "@material-ui/core/Fade";
import Backdrop from "@material-ui/core/Backdrop";
import Portal from "@material-ui/core/Portal";
import Alert from "@material-ui/lab/Alert";
import ToggleButton from "@material-ui/lab/ToggleButton";
import ToggleButtonGroup from "@material-ui/lab/ToggleButtonGroup";

import Visibility from "@material-ui/icons/Visibility";
import VisibilityOff from "@material-ui/icons/VisibilityOff";
import LockOutlined from "@material-ui/icons/LockOutlined";
import LockOpenOutlined from "@material-ui/icons/LockOpenOutlined";
import VpnKeyOutlined from "@material-ui/icons/VpnKeyOutlined";
import ErrorRounded from "@material-ui/icons/ErrorRounded";
import CheckRounded from "@material-ui/icons/CheckRounded";
import CropFreeIcon from "@material-ui/icons/CropFree";
import AddCircleOutline from "@material-ui/icons/AddCircleOutline";

import { lazyDialog } from "./LazyDialog";
import { t, useLanguage } from "../utils/text";
import { withLanguage } from "../utils/withLanguage";
const QRScannerDialog = lazyDialog(() => import("./QrScanner"), { name: "QRScanner" });

const styles = theme => ({
    backdrop: {
        zIndex: "1301",
        color: '#fff',
    },
    dialog: {
        "& .MuiDialog-paper": {
            backgroundColor: "#000",
            color: "#fff",
            borderRadius: "21px",
            minWidth: "360px",
            maxWidth: "480px",
        }
    },
    dialogTitle: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        paddingBottom: "8px",
        "& .MuiSvgIcon-root": {
            fontSize: "28px",
            color: "#b0b0b0",
        }
    },
    whiteButton: {
        "&.MuiButton-contained": {
            backgroundColor: "#d0d0d0",
            color: "#151515",
            transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,border 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
        },
        "&.MuiButton-contained:hover": {
            backgroundColor: "#ffffff",
            color: "#000000",
        }
    },
    modeToggleGroup: {
        marginBottom: "20px",
        width: "100%",
        display: "flex",
        "& .MuiToggleButtonGroup-grouped": {
            border: "1px solid #4a4a4a",
            padding: "8px 16px",
            flex: 1,
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
    inputEndAdornment: {
        "& .MuiIconButton-root.Mui-disabled": {
            color: "#7b7b7b",
        },
        "& .MuiCircularProgress-colorSecondary": {
            color: "#7b7b7b",
            marginLeft: "8px"
        }
    },
    buttonNotDisabled: {
        "&.MuiButtonBase-root.Mui-disabled": {
            cursor: "help",
            pointerEvents: "all"
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
    // FIX: Changed from display: "none" to display: "block"
    actionContext: {
        display: "block",
        backgroundColor: "#171717",
        borderRadius: "21px",
        padding: "16px",
        marginBottom: "20px",
        height: "56px"
    },
    actionLabel: {
        color: "#7b7b7b",
        fontSize: "12px",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        marginBottom: "4px",
    },
    actionValue: {
        color: "#ffffff",
        fontSize: "15px",
        fontWeight: 500,
    },
    keyTypeChip: {
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        backgroundColor: "#3a3a3a",
        color: "#e0e0e0",
        padding: "6px 12px",
        borderRadius: "16px",
        fontSize: "13px",
        fontWeight: 500,
        marginTop: "-24px",
        float: "right",
        "& .MuiSvgIcon-root": {
            fontSize: "16px",
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
            backgroundColor: "rgba(150, 150, 150, 0.1)",
            color: "#b0b0b0",
        },
        "&.success": {
            backgroundColor: "rgba(200, 200, 200, 0.1)",
            color: "#9b9b9b",
        },
        "&.error": {
            backgroundColor: "rgba(250, 250, 250, 0.1)",
            color: "#e1e1e1",
        }
    },
    attemptsWarning: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 12px",
        borderRadius: "6px",
        marginTop: "12px",
        backgroundColor: "rgba(180, 180, 180, 0.1)",
        color: "#fff",
        fontSize: "13px",
    }
});

// Values are translation KEYS, not prose. This object is evaluated once at
// import time, so calling t() here would pin the language to module load.
// Consumers resolve with t(key) at render. See utils/text.js.
const KEY_TYPES = {
    posting: {
        label: "components.unlock_key_dialog.posting_key",
        description: "words.for_voting_commenting_and_posting",
        placeholder: "components.unlock_key_dialog.master_password_or_posting_key_wif",
        color: "#d0d0d0",
    },
    active: {
        label: "components.unlock_key_dialog.active_key",
        description: "words.for_transfers_and_wallet_operations",
        placeholder: "components.unlock_key_dialog.master_password_or_active_key_wif",
        color: "#c8c8c8",
    },
    owner: {
        label: "components.unlock_key_dialog.owner_key",
        description: "words.for_account_recovery_and_authority_changes",
        placeholder: "components.unlock_key_dialog.master_password_or_owner_key_wif",
        color: "#b8b8b8",
    },
    memo: {
        label: "components.unlock_key_dialog.memo_key",
        description: "words.for_encrypted_messages",
        placeholder: "components.unlock_key_dialog.master_password_or_memo_key_wif",
        color: "#c0c0c0",
    }
};

const PinUnlockMode = memo(function PinUnlockMode({
                                                      classes,
                                                      pin,
                                                      showPin,
                                                      pinError,
                                                      attemptsRemaining,
                                                      vaultHint,
                                                      onPinChange,
                                                      onToggleShowPin,
                                                      onMouseDownPassword,
                                                  }) {
    useLanguage();
    const pinEndAdornment = useMemo(() => (
        <InputAdornment position="end" className={classes.inputEndAdornment}>
            <Tooltip title={showPin ? "Hide PIN" : "Show PIN"}>
                <IconButton
                    edge="end"
                    aria-label={t("components.unlock_key_dialog.toggle_pin_visibility")}
                    onClick={onToggleShowPin}
                    onMouseDown={onMouseDownPassword}
                >
                    {showPin ? <Visibility /> : <VisibilityOff />}
                </IconButton>
            </Tooltip>
        </InputAdornment>
    ), [classes, showPin, onToggleShowPin, onMouseDownPassword]);

    return (
        <div>
            <Typography style={{ fontSize: 14, color: "#9b9b9b", marginBottom: 16 }}>
                {t("components.unlock_key_dialog.enter_your_pin_to_unlock_the_requested")}
            </Typography>
            <FormControl fullWidth variant="outlined">
                <InputLabel htmlFor="unlock-pin">PIN</InputLabel>
                <OutlinedInput
                    id="unlock-pin"
                    type={showPin ? 'text' : 'password'}
                    value={pin}
                    onChange={onPinChange}
                    endAdornment={pinEndAdornment}
                    labelWidth={32}
                    autoFocus
                    error={!!pinError}
                />
            </FormControl>
            {/* FIX (v4.1): Display the PIN hint if one was set during login */}
            {vaultHint ? (
                <Typography style={{ fontSize: 13, color: "#7b7b7b", marginTop: 8 }}>{t("components.unlock_key_dialog.hint", {
                        vaultHint: vaultHint
                    })}</Typography>
            ) : null}
            {pinError && (
                <Typography style={{ fontSize: 13, color: "#7b7b7b", marginTop: 8, textAlign: "right" }}>
                    {pinError}
                </Typography>
            )}
            {attemptsRemaining !== null && attemptsRemaining < 5 && (
                <div className={classes.attemptsWarning}>
                    <ErrorRounded style={{ fontSize: 18 }} />
                    <span>{t("components.unlock_key_dialog.attempt_remaining_before_lockout", {
                            attempt: { attempt: attemptsRemaining },
                        })}</span>
                </div>
            )}
        </div>
    );
});

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Mode: Add Missing Key
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const AddKeyMode = memo(function AddKeyMode({
                                                classes,
                                                keyType,
                                                keyValue,
                                                showKey,
                                                keyValid,
                                                keyIsWif,
                                                pendingValidation,
                                                keyError,
                                                onKeyChange,
                                                onToggleShowKey,
                                                onMouseDownPassword,
                                                onOpenQRScanner,
                                            }) {
    useLanguage();
    const config = KEY_TYPES[keyType] || KEY_TYPES.posting;

    const keyEndAdornment = useMemo(() => (
        <InputAdornment position="end" className={classes.inputEndAdornment}>
            {pendingValidation ? (
                <CircularProgress size={20} color="secondary" />
            ) : keyValue.length > 0 ? (
                <Tooltip title={
                    keyIsWif
                        ? "Valid WIF key format"
                        : keyValid
                            ? "Looks like a master password — will be checked against the account"
                            : "Too short — enter your master password or a WIF key"
                }>
                    <IconButton edge="end" disabled className={classes.buttonNotDisabled}>
                        {keyIsWif
                            ? <CheckRounded style={{ color: "#ffffff" }} />
                            : keyValid
                                ? <CheckRounded style={{ color: "#9b9b9b" }} />
                                : <ErrorRounded style={{ color: "#989898" }} />}
                    </IconButton>
                </Tooltip>
            ) : null}
            <Tooltip title={t("words.scan_qr_code")}>
                <IconButton
                    edge="end"
                    className={classes.qrScanButton}
                    onClick={onOpenQRScanner}
                >
                    <CropFreeIcon />
                </IconButton>
            </Tooltip>
            <Tooltip title={showKey ? "Hide key" : "Show key"}>
                <IconButton
                    edge="end"
                    aria-label={t("words.toggle_key_visibility")}
                    onClick={onToggleShowKey}
                    onMouseDown={onMouseDownPassword}
                >
                    {showKey ? <Visibility /> : <VisibilityOff />}
                </IconButton>
            </Tooltip>
        </InputAdornment>
    ), [classes, pendingValidation, keyValue, keyValid, keyIsWif, showKey, onToggleShowKey, onMouseDownPassword, onOpenQRScanner]);

    const estimatedLabelWidth = t(config.label).length * 10;

    return (
        <div>
            <FormControl fullWidth variant="outlined">
                <InputLabel htmlFor="add-key-input">{t(config.label)}</InputLabel>
                <OutlinedInput
                    id="add-key-input"
                    type={showKey ? 'text' : 'password'}
                    value={keyValue}
                    onChange={onKeyChange}
                    endAdornment={keyEndAdornment}
                    labelWidth={estimatedLabelWidth}
                    placeholder={t(config.placeholder)}
                    autoFocus
                    error={!!keyError}
                />
            </FormControl>
            <Typography style={{ fontSize: 12, color: "#7b7b7b", marginTop: 8, textAlign: "right" }}>{t("components.unlock_key_dialog.accepts_master_password_or_wif", {
                    description: t(config.description)
                })}</Typography>
            {keyError && (
                <Typography style={{ fontSize: 13, color: "#a1a1a1", marginTop: 8, textAlign: "right" }}>
                    {keyError}
                </Typography>
            )}
        </div>
    );
});

class UnlockKeyDialog extends React.PureComponent {
    constructor(props) {
        super(props);

        this._keyValidationTimer = null;

        this.state = {
            _mode: props.mode || (props.keyMissing ? 'addKey' : 'pin'),
            _pin: "",
            _show_pin: false,
            _pin_error: null,
            _attempts_remaining: null,
            _key_value: "",
            _show_key: false,
            _key_valid: false,
            _key_is_wif: false,
            _pending_validation: false,
            _key_error: null,
            _status: null,
            _status_message: null,
            _backdrop_opened: false,
            _qr_scanner_open: false,
            _vault_hint: "",
        };
    }

    async _loadHint() {
        const { api } = this.props;
        if (!api?.settingsDb) return;
        try {
            const col = await api.settingsDb.getCollection('pq_vault_config');
            const doc = await col.get('vault_hint');
            if (doc?.hint) {
                this.setState({ _vault_hint: doc.hint });
            }
        } catch (_) {}
    }

    componentDidMount() {
        if (this.props.open) {
            this._resetState();
            this._determineMode();
        }
        // FIX (v4.1): _loadHint was in a duplicate componentDidMount that got
        // shadowed by this one — merged so the hint actually loads.
        this._loadHint();
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.open && !this.props.open) {
            this._resetState();
            // Will be set by _determineMode after async check
            this._determineMode(nextProps);
            // FIX (v4.1): Reload hint each time dialog opens (may have changed)
            this._loadHint();
        }
    }

    // Determine mode based on props and session PIN status
    _determineMode = async (props = this.props) => {
        const { mode, keyMissing, api } = props;

        // If mode is explicitly set or key is missing, use those
        if (mode) {
            this.setState({ _mode: mode });
            return;
        }

        if (keyMissing) {
            this.setState({ _mode: 'addKey' });
            return;
        }

        // Check if PIN is enabled for this session
        if (api && api.isPinEnabled) {
            try {
                const pinEnabled = await api.isPinEnabled();
                console.log('[UnlockKeyDialog] PIN enabled check:', pinEnabled);
                this.setState({ _mode: pinEnabled ? 'pin' : 'addKey' });
            } catch (err) {
                console.error('[UnlockKeyDialog] Failed to check PIN status:', err);
                this.setState({ _mode: 'addKey' }); // Default to addKey on error
            }
        } else {
            // Default to pin mode if we can't check
            this.setState({ _mode: 'pin' });
        }
    };

    componentWillUnmount() {
        if (this._keyValidationTimer) clearTimeout(this._keyValidationTimer);
    }

    _resetState = () => {
        this.setState({
            _pin: "",
            _show_pin: false,
            _pin_error: null,
            _key_value: "",
            _show_key: false,
            _key_valid: false,
            _key_is_wif: false,
            _pending_validation: false,
            _key_error: null,
            _status: null,
            _status_message: null,
            _backdrop_opened: false,
        });
    };

    _getAuth = () => {
        const { api } = this.props;
        if (!api) return null;
        return api.auth || null;
    };

    _handleModeChange = (event, newMode) => {
        if (newMode !== null) {
            this.setState({
                _mode: newMode,
                _status: null,
                _status_message: null,
                _pin_error: null,
                _key_error: null,
            });
        }
    };

    _handlePinChange = (e) => {
        this.setState({ _pin: e.target.value, _pin_error: null });
    };

    _handleToggleShowPin = () => {
        this.setState({ _show_pin: !this.state._show_pin });
    };

    _handleKeyChange = (e) => {
        const key = e.target.value;
        this.setState({
            _key_value: key,
            _pending_validation: true,
            _key_valid: false,
            _key_error: null,
        });

        if (this._keyValidationTimer) clearTimeout(this._keyValidationTimer);

        if (key.length < 8) {
            this.setState({ _pending_validation: false, _key_valid: false });
            return;
        }

        this._keyValidationTimer = setTimeout(() => {
            this._validateKey(key);
        }, 300);
    };

    /**
     * Format check only — does NOT decide submittability.
     *
     * Two shapes are accepted by the dialog:
     *   1. A WIF private key for the required role (matches `5[HJK]…`).
     *   2. A master password — anything ≥ 8 chars that's not a WIF.
     *
     * _canSubmit() only requires length ≥ 8; the actual decision between
     * "master → derive" vs "WIF → use as-is" happens in _handleSubmit.
     */
    _validateKey = (key) => {
        const auth = this._getAuth();
        let isWif = false;
        if (auth && auth.isWif) {
            try { isWif = auth.isWif(key); } catch (e) { isWif = false; }
        } else {
            isWif = /^5[HJK][1-9A-HJ-NP-Za-km-z]{49,51}$/.test(key);
        }
        // Either shape is "valid" for submission purposes; the check icon
        // shows green for WIF (definitively valid) and grey otherwise
        // (could still be a valid master password — we won't know until
        // we try to derive against the chain).
        this.setState({
            _pending_validation: false,
            _key_valid: key.length >= 8,
            _key_is_wif: isWif,
        });
    };

    _handleToggleShowKey = () => {
        this.setState({ _show_key: !this.state._show_key });
    };

    _handleOpenQRScanner = () => {
        this.setState({ _qr_scanner_open: true });
    };

    _handleCloseQRScanner = () => {
        this.setState({ _qr_scanner_open: false });
    };

    _handleQRScanResult = (result) => {
        this.setState({ _key_value: result, _qr_scanner_open: false }, () => {
            this._validateKey(result);
        });
    };

    _handleMouseDownPassword = (event) => {
        event.preventDefault();
    };

    _canSubmit = () => {
        const { _mode, _pin, _key_valid, _status } = this.state;
        if (_status === 'pending') return false;
        if (_mode === 'pin') return _pin.length >= 6;
        return _key_valid;
    };

    _handleSubmit = async () => {
        const { api, username, requiredKeyType, onUnlock, onKeyAdded, onClose } = this.props;
        const { _mode, _pin, _key_value } = this.state;

        if (!api) {
            this.setState({ _status: 'error', _status_message: 'API not available' });
            return;
        }

        this.setState({
            _status: 'pending',
            _status_message: _mode === 'pin' ? 'Verifying PIN...' : 'Validating key...',
            _backdrop_opened: true,
        });

        try {
            if (_mode === 'pin') {
                const result = await api.unlockWithPin(_pin, { keyType: requiredKeyType, account: username });
                if (!result.success) {
                    this.setState({
                        _status: 'error',
                        _pin_error: result.error || 'Invalid PIN',
                        _status_message: null,
                        _backdrop_opened: false,
                        _attempts_remaining: result.attemptsRemaining || null,
                    });
                    return;
                }
                this.setState({ _status: 'success', _status_message: 'Key unlocked!', _backdrop_opened: false });
                if (onUnlock) onUnlock({ keyType: requiredKeyType, username: username });
                setTimeout(() => { if (onClose) onClose(); }, 800);
            } else {
                // ── Resolve `_key_value` to a WIF for `requiredKeyType` ──
                //
                // The input may be either:
                //   (a) The specific WIF for requiredKeyType, or
                //   (b) The master password (we derive the WIF from it).
                //
                // Strategy: try the cheaper/more-likely shape first based on
                // format. If the input is WIF-shaped, validate as the specific
                // key; if that fails, fall back to master derivation. If the
                // input isn't WIF-shaped, skip straight to master.
                let resolvedWif = null;
                let isMasterDerived = false;
                const auth = this._getAuth();
                const looksLikeWif = !!(auth && auth.isWif && auth.isWif(_key_value));

                const tryAsSpecificKey = async () => {
                    if (!api.validateCredentials) return _key_value; // can't check, assume valid
                    const v = await api.validateCredentials(username, _key_value, requiredKeyType);
                    if (v.valid) return _key_value;
                    return null;
                };

                const tryAsMaster = async () => {
                    if (!api.validateCredentials) return null;
                    const v = await api.validateCredentials(username, _key_value, 'master');
                    if (!v.valid) return null;
                    // Master matched at least posting; check the required type also matches
                    const matched = Array.isArray(v.matchedTypes) ? v.matchedTypes : [];
                    if (!matched.includes(requiredKeyType)) return null;
                    // Derive the specific WIF
                    if (auth && auth.toWif) {
                        try {
                            return auth.toWif(username, _key_value, requiredKeyType);
                        } catch (_) { return null; }
                    }
                    return null;
                };

                if (looksLikeWif) {
                    resolvedWif = await tryAsSpecificKey();
                    if (!resolvedWif) {
                        // Unusual: WIF-shaped but didn't match. Try master as a last resort.
                        resolvedWif = await tryAsMaster();
                        if (resolvedWif) isMasterDerived = true;
                    }
                } else {
                    resolvedWif = await tryAsMaster();
                    if (resolvedWif) isMasterDerived = true;
                    // If master failed and the input wasn't WIF-shaped, try as
                    // WIF anyway in case isWif missed an edge case.
                    if (!resolvedWif) resolvedWif = await tryAsSpecificKey();
                }

                if (!resolvedWif) {
                    this.setState({
                        _status: 'error',
                        _key_error: t("components.unlock_key_dialog.not_a_valid_or_master_password_for", {
                            t: t(KEY_TYPES[requiredKeyType]?.label) || 'key',
                            username: username
                        }),
                        _status_message: null,
                        _backdrop_opened: false,
                    });
                    return;
                }

                // Ensure session crypto key exists (may have been destroyed on PIN timeout)
                if (api.keyManager && !api.keyManager._sessionCryptoKey) {
                    await api.keyManager._generateSessionCryptoKey();
                }
                // Cache the (derived or direct) WIF for the required key type.
                // Also persist to vault if vault is initialized, so future PIN
                // unlocks can recover it.
                const vaultReady = api.isVaultInitialized && api.isVaultInitialized();
                if (api.keyManager && api.keyManager.addIndividualKey) {
                    await api.keyManager.addIndividualKey(username, requiredKeyType, resolvedWif, { storeInVault: vaultReady });
                } else if (api.keyManager && api.keyManager.sessionKeys) {
                    // Last resort fallback: store directly (should not happen)
                    api.keyManager.sessionKeys.set(`${username}_${requiredKeyType}`, resolvedWif);
                }
                // Reset PIN verification timer so keys stay in-memory for the full timeout
                if (api.keyManager) {
                    api.keyManager.resetPinTimer();
                }
                this.setState({
                    _status: 'success',
                    _status_message: isMasterDerived
                        ? t("components.unlock_key_dialog.derived_from_master_and_added", {
                        t: t(KEY_TYPES[requiredKeyType]?.label) || 'Key'
                    })
                        : 'Key added successfully!',
                    _backdrop_opened: false,
                });
                // FIX: Include the resolved WIF in the callback so API can use it
                if (onKeyAdded) onKeyAdded({ keyType: requiredKeyType, username: username, key: resolvedWif });
                setTimeout(() => { if (onClose) onClose(); }, 800);
            }
        } catch (error) {
            console.error('Unlock/Add key error:', error);
            let errorMessage = error.message || 'Operation failed';
            if (error.code === 'INVALID_PIN') errorMessage = 'Invalid PIN';
            else if (error.code === 'VAULT_LOCKED') errorMessage = 'Vault is locked. Please log in again.';
            else if (error.code === 'KEY_NOT_FOUND') errorMessage = 'Key not found in vault';
            else if (error.code === 'VALIDATION_FAILED') errorMessage = 'Key does not match account';

            this.setState({
                _status: 'error',
                _status_message: null,
                _backdrop_opened: false,
                [_mode === 'pin' ? '_pin_error' : '_key_error']: errorMessage,
            });
        }
    };

    _getSubmitButtonText = () => {
        const { _mode, _status } = this.state;
        if (_status === 'pending') return 'PROCESSING...';
        if (_status === 'success') return 'DONE';
        return _mode === 'pin' ? 'UNLOCK' : 'ADD KEY';
    };

    render() {
        const { classes, open, onClose, requiredKeyType, actionDescription, username, keyMissing, allowModeSwitch } = this.props;
        const {
            _mode,
            _pin,
            _show_pin,
            _pin_error,
            _attempts_remaining,
            _key_value,
            _show_key,
            _key_valid,
            _pending_validation,
            _key_error,
            _status,
            _status_message,
            _backdrop_opened,
            _qr_scanner_open,
        } = this.state;

        const keyConfig = KEY_TYPES[requiredKeyType] || KEY_TYPES.posting;
        const showModeToggle = allowModeSwitch && !keyMissing;
        // FIX: Show action context when we have username OR actionDescription
        const showActionContext = !!(username || actionDescription);

        return (
            <React.Fragment>
                <Dialog
                    className={classes.dialog}
                    open={open}
                    onClose={_status === 'pending' ? undefined : onClose}
                    maxWidth="sm"
                    fullWidth
                >
                    <DialogTitle disableTypography>
                        <div className={classes.dialogTitle}>
                            {_mode === 'pin' ? <LockOutlined /> : <VpnKeyOutlined />}
                            <Typography variant="h5" component="h2">
                                {_mode === 'pin' ? 'Unlock Key' : 'Add Key'}
                            </Typography>
                        </div>
                    </DialogTitle>

                    <DialogContent>
                        {/* FIX: Always show action context when there's relevant info */}
                        {showActionContext && (
                            <div className={classes.actionContext}>
                                {actionDescription && (
                                    <div className={classes.actionValue}>
                                        {actionDescription}
                                    </div>
                                )}
                                <div className={classes.keyTypeChip}>
                                    <VpnKeyOutlined />
                                    {t(keyConfig.label)}
                                </div>
                            </div>
                        )}

                        <Alert severity="info" style={{ marginTop: 16 }}>
                            {t("components.unlock_key_dialog.this_key_will_be_stored_in_your")}
                        </Alert>

                        {showModeToggle && (
                            <ToggleButtonGroup
                                value={_mode}
                                exclusive
                                onChange={this._handleModeChange}
                                className={classes.modeToggleGroup}
                            >
                                <ToggleButton value="pin">
                                    <LockOpenOutlined style={{ marginRight: 8, fontSize: 18 }} />
                                    {t("components.unlock_key_dialog.unlock_with_pin")}
                                </ToggleButton>
                                <ToggleButton value="addKey">
                                    <AddCircleOutline style={{ marginRight: 8, fontSize: 18 }} />
                                    {t("components.unlock_key_dialog.enter_key")}
                                </ToggleButton>
                            </ToggleButtonGroup>
                        )}

                        {/* FIX: Removed Fade wrapper that was causing visibility issues */}
                        {_mode === 'pin' && (
                            <PinUnlockMode
                                classes={classes}
                                pin={_pin}
                                showPin={_show_pin}
                                pinError={_pin_error}
                                attemptsRemaining={_attempts_remaining}
                                vaultHint={this.state._vault_hint}
                                onPinChange={this._handlePinChange}
                                onToggleShowPin={this._handleToggleShowPin}
                                onMouseDownPassword={this._handleMouseDownPassword}
                            />
                        )}

                        {/* FIX: Removed Fade wrapper that was causing visibility issues */}
                        {_mode === 'addKey' && (
                            <AddKeyMode
                                classes={classes}
                                keyType={requiredKeyType}
                                keyValue={_key_value}
                                showKey={_show_key}
                                keyValid={_key_valid}
                                keyIsWif={this.state._key_is_wif}
                                pendingValidation={_pending_validation}
                                keyError={_key_error}
                                onKeyChange={this._handleKeyChange}
                                onToggleShowKey={this._handleToggleShowKey}
                                onMouseDownPassword={this._handleMouseDownPassword}
                                onOpenQRScanner={this._handleOpenQRScanner}
                            />
                        )}

                        {_status && _status_message && (
                            <div className={`${classes.statusIndicator} ${_status}`}>
                                {_status === 'pending' && <CircularProgress size={20} color="inherit" />}
                                {_status === 'success' && <CheckRounded />}
                                {_status === 'error' && <ErrorRounded />}
                                <Typography variant="body2">{_status_message}</Typography>
                            </div>
                        )}
                    </DialogContent>

                    <DialogActions style={{ padding: "16px 24px" }}>
                        <Button
                            variant="text"
                            color="primary"
                            onClick={onClose}
                            disabled={_status === 'pending'}
                        >{t("words.cancel", {TUC: true})} </Button>
                        <Button
                            className={classes.whiteButton}
                            variant="contained"
                            color="primary"
                            onClick={this._handleSubmit}
                            disabled={!this._canSubmit()}
                        >
                            {this._getSubmitButtonText()}
                        </Button>
                    </DialogActions>
                </Dialog>
                {/*<Portal>
                    <Backdrop className={classes.backdrop} open={_backdrop_opened}>
                        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                            <CircularProgress color="inherit" />
                            {_status_message && <Typography variant="body2">{_status_message}</Typography>}
                        </Box>
                    </Backdrop>
                </Portal>*/}
                <QRScannerDialog
                    open={_qr_scanner_open}
                    onClose={this._handleCloseQRScanner}
                    onScanResult={this._handleQRScanResult}
                />
            </React.Fragment>
        );
    }
}

UnlockKeyDialog.defaultProps = {
    open: false,
    onClose: () => {},
    onUnlock: () => {},
    onKeyAdded: () => {},
    api: null,
    username: "",
    requiredKeyType: "posting",
    actionDescription: "",
    keyMissing: false,
    allowModeSwitch: true,
    mode: null,
};

export default withLanguage(withStyles(styles)(UnlockKeyDialog));