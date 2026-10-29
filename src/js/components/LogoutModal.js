import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import Button from "@material-ui/core/Button";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContentText from "@material-ui/core/DialogContentText";
import CircularProgress from "@material-ui/core/CircularProgress";

import { t } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";

// ============================================================================
// LogoutModal — confirms a logout, then hands it to the parent.
//
// Multi-account (pixaproxyapi v4.8 / session-manager v7): the logout itself is
// the parent's onConfirm — Index calls api.logout({ account }), which ends the
// account on this device (every tab), clears KeyManager, cancels the account's
// queued offline operations and lets another logged-in account take over. This
// dialog waits for it (onConfirm may return a promise) and then calls
// onLogoutComplete.
//
// It used to end the session again by itself right after onConfirm
// (sessionManager.endSession(), then keyManager.removeAccount — which does not
// exist, so the throw also skipped clearAllSessions — and api.cacheManager,
// which does not exist either). Its endSession reached SessionManager's queue
// before api.logout's, so the account was ended with no hand-over: with several
// accounts logged in, the next one never took over.
//
// Props: open, onConfirm, onClose, onLogoutComplete, api, account (the account
// being logged out, shown in the title; Index passes the one active when the
// dialog opened).
// ============================================================================

// components.logout_modal.* strings, with an English fallback for a build whose
// locale files predate them (they were hard-coded English).
const tr = (key, fallback, params) => {
    let s = null;
    try { s = t(key, params); } catch (e) { s = null; }
    // utils/text.js renders a missing key as its last segment ("title_account").
    const last = key.slice(key.lastIndexOf(".") + 1);
    return typeof s === "string" && s && s !== key && s !== last ? s : fallback;
};

const styles = theme => ({
    whiteDialog: {
        backgroundColor: "#fff !important",
        color: "#000 !important",
        boxShadow: "0px 11px 15px -7px rgb(255 255 255 / 20%), 0px 24px 38px 3px rgb(255 255 255 / 14%), 0px 9px 46px 8px rgb(255 255 255 / 12%) !important",
        "& .MuiTypography-colorTextSecondary": {
            color: "#000 !important",
        },
        "& .MuiButton-textPrimary": {
            color: "#222 !important",
            "&:hover": {
                color: "#000 !important",
            }
        },
        "& .MuiButton-containedPrimary": {
            color: "#fff !important",
            backgroundColor: "#000 !important",
            "&:hover": {
                color: "#ddd !important",
                backgroundColor: "#222 !important",
            }
        }
    },
    progressContainer: {
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
    },
    error: {
        display: "block",
        marginTop: "12px",
        color: "#b00020",
    },
    others: {
        display: "block",
        marginTop: "12px",
    },
});

class LogoutModal extends React.PureComponent {

    constructor(props) {
        super(props);
        this.state = {
            classes: props.classes,
            keepMounted: props.keepMounted || false,
            open: props.open,
            loggingOut: false,
            error: null,
            // Other logged-in accounts: they stay logged in (one takes over).
            others: 0,
        };
        this._mounted = false;
    };

    componentDidMount() {
        this._mounted = true;
        if (this.props.open) this._countOthers(this.props);
    }

    componentWillUnmount() {
        this._mounted = false;
    }

    componentWillReceiveProps(new_props) {
        const opening = new_props.open && !this.state.open;
        this.setState({
            open: new_props.open,
            keepMounted: new_props.keepMounted || false,
            // Reset states when dialog opens
            ...(opening ? {
                loggingOut: false,
                error: null,
                others: 0,
            } : {})
        });
        if (opening) this._countOthers(new_props);
    }

    /** How many other accounts are logged in on this device (they are not logged out). */
    _countOthers = async (props) => {
        const { api, account } = props;
        if (!api || typeof api.listAccounts !== "function") return;
        try {
            const list = await api.listAccounts();
            const gone = String(account || "").toLowerCase();
            const others = (Array.isArray(list) ? list : [])
                .filter((s) => s && s.account && (gone ? s.account !== gone : !s.active)).length;
            if (this._mounted) this.setState({ others });
        } catch (_) { /* informational only */ }
    };

    handleLogout = async () => {
        const { api, account, onConfirm, onLogoutComplete } = this.props;
        if (this.state.loggingOut) return;
        this.setState({ loggingOut: true, error: null });

        try {
            // The whole logout is the parent's (see the header). Without a
            // parent handler, the API's logout does the same.
            if (onConfirm) {
                await onConfirm();
            } else if (api && typeof api.logout === "function") {
                await api.logout(account ? { account } : {});
            }
            if (onLogoutComplete) onLogoutComplete();
        } catch (error) {
            console.error('LogoutModal: Logout failed:', error);
            if (this._mounted) {
                this.setState({
                    loggingOut: false,
                    error: (error && error.message) || tr("components.logout_modal.logout_failed", "Logout failed"),
                });
            }
        }
    };

    handleClose = () => {
        // Don't allow closing while logging out
        if (this.state.loggingOut) {
            return;
        }

        if (this.props.onClose) {
            this.props.onClose();
        }
    };

    render() {
        const {
            classes,
            open,
            loggingOut,
            error,
            others,
        } = this.state;
        const { account } = this.props;

        const title = loggingOut
            ? tr("components.logout_modal.logging_out", "Logging out...")
            : account
                ? tr("components.logout_modal.title_account", "Log out @" + account + "?", { account })
                : tr("components.logout_modal.title", "Do you really want to logout?");

        return (
            <Dialog
                open={open}
                keepMounted={false}
                PaperProps={{ classes: { root: classes.whiteDialog } }}
                onClose={this.handleClose}
                maxWidth={"xs"}
                fullWidth={true}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
                disableBackdropClick={loggingOut}
                disableEscapeKeyDown={loggingOut}
            >
                <DialogTitle id="alert-dialog-title">
                    {title}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText id="alert-dialog-description">
                        {loggingOut ? (
                            tr("components.logout_modal.please_wait", "Please wait while we securely end your session...")
                        ) : (
                            <React.Fragment>
                                {tr("components.logout_modal.forgotten_on_device",
                                    "Your account will be forgotten on this device's web browser. Use private navigation or always logout to close the access to your account if you don't trust this device.")}
                                {others > 0 ? (
                                    // Its own line: no space to join sentences
                                    // with (none after "。").
                                    <span className={classes.others}>
                                        {tr("components.logout_modal.others_stay_logged_in",
                                            "Your other accounts stay logged in.", { count: others })}
                                    </span>
                                ) : null}
                            </React.Fragment>
                        )}
                        {error ? <span className={classes.error}>{error}</span> : null}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    {!loggingOut && (
                        <Button onClick={this.handleClose} color="primary">
                            {t("words.cancel")}
                        </Button>
                    )}
                    <Button
                        onClick={this.handleLogout}
                        color="primary"
                        variant={"contained"}
                        autoFocus
                        disabled={loggingOut}
                    >
                        {loggingOut ? (
                            <span className={classes.progressContainer}>
                                <CircularProgress size={16} color="inherit" />
                                {t("components.logout_modal.logging_out")}
                            </span>
                        ) : error ? (
                            tr("components.logout_modal.retry", "Retry")
                        ) : (
                            tr("components.logout_modal.logout", "Logout")
                        )}
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }
}

export default withLanguage(withStyles(styles)(LogoutModal));