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
    }
});

class LogoutModal extends React.PureComponent {

    constructor(props) {
        super(props);
        this.state = {
            classes: props.classes,
            keepMounted: props.keepMounted || false,
            open: props.open,
            loggingOut: false,
            error: null
        };
    };

    componentWillReceiveProps(new_props) {
        this.setState({
            open: new_props.open,
            keepMounted: new_props.keepMounted || false,
            // Reset states when dialog opens
            ...(new_props.open && !this.state.open ? {
                loggingOut: false,
                error: null
            } : {})
        });
    }

    handleLogout = async () => {
        const { api, onConfirm, onLogoutComplete } = this.props;

        console.log('LogoutModal: Starting logout process');
        this.setState({ loggingOut: true, error: null });

        // Call onConfirm immediately to notify parent that logout is starting
        if (onConfirm) {
            console.log('LogoutModal: Calling onConfirm');
            onConfirm();
        }

        try {
            if (api) {
                // Get current account before clearing
                const currentAccount = api.keyManager?.getActiveAccount?.();
                console.log('LogoutModal: Current account:', currentAccount);

                // End the current session - this emits 'session_ended' event
                if (api.sessionManager) {
                    console.log('LogoutModal: Ending session');
                    try {
                        await api.sessionManager.endSession();
                        console.log('LogoutModal: Session ended');
                    } catch (e) {
                        console.warn('LogoutModal: endSession error (continuing):', e);
                    }
                }

                // Clear session keys from memory
                if (api.keyManager) {
                    try {
                        if (currentAccount) {
                            console.log('LogoutModal: Removing account from key manager');
                            await api.keyManager.removeAccount(currentAccount);
                        }
                        api.keyManager.clearAllSessions();
                        console.log('LogoutModal: Cleared all sessions');
                    } catch (e) {
                        console.warn('LogoutModal: keyManager error (continuing):', e);
                    }
                }

                // Invalidate any cached account data
                if (api.cacheManager && currentAccount) {
                    try {
                        await api.cacheManager.invalidateKey('accounts', `account_${currentAccount}`);
                        console.log('LogoutModal: Cache invalidated');
                    } catch (e) {
                        console.warn('LogoutModal: cacheManager error (continuing):', e);
                    }
                }
            }

            console.log('LogoutModal: Logout successful, calling onLogoutComplete');
            // Always call logout complete callback
            if (onLogoutComplete) {
                onLogoutComplete();
            }

        } catch (error) {
            console.error('LogoutModal: Logout failed:', error);
            // Even on error, try to complete the logout on UI side
            if (onLogoutComplete) {
                console.log('LogoutModal: Calling onLogoutComplete despite error');
                onLogoutComplete();
            }
            this.setState({
                loggingOut: false
            });
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
            error
        } = this.state;

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
                    {loggingOut ? "Logging out..." : "Do you really want to logout?"}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText id="alert-dialog-description">
                        {error ? (
                            <span style={{ color: "#ffffff" }}>{error}</span>
                        ) : loggingOut ? (
                            "Please wait while we securely end your session..."
                        ) : (
                            "Your account will be forgotten on this device's web browser. Use private navigation or always logout to close the access to your account if you don't trust this device."
                        )}
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
                            "Retry"
                        ) : (
                            "Logout"
                        )}
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }
}

export default withLanguage(withStyles(styles)(LogoutModal));