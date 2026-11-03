import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import Button from "@material-ui/core/Button";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContentText from "@material-ui/core/DialogContentText";
import CircularProgress from "@material-ui/core/CircularProgress";
import DeleteOutlineRounded from "@material-ui/icons/DeleteOutlineRounded";

import { t, tk, tx } from "../utils/text";

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
        // Destructive confirm action — red on the white surface.
        "& .MuiButton-containedPrimary": {
            color: "#fff !important",
            backgroundColor: "#191919 !important",
            "&:hover": {
                color: "#fff !important",
                backgroundColor: "#000 !important",
            },
            "&.Mui-disabled": {
                color: "#ffffff99 !important",
                backgroundColor: "#333 !important",
            }
        }
    },
    progressContainer: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
    },
    errorText: {
        color: "#000 !important",
        fontWeight: 500,
    },
    hint: {
        display: "block",
        marginTop: 8,
        color: "#666 !important",
        fontSize: "0.78rem",
    }
});

class DeleteCommentModal extends React.PureComponent {

    constructor(props) {
        super(props);
        this.state = {
            classes: props.classes,
            keepMounted: props.keepMounted || false,
            open: props.open,
            deleting: false,
            error: null
        };
    };

    componentWillReceiveProps(new_props) {
        this.setState({
            open: new_props.open,
            keepMounted: new_props.keepMounted || false,
            // Reset transient state each time the dialog (re)opens.
            ...(new_props.open && !this.state.open ? {
                deleting: false,
                error: null
            } : {})
        });
    }

    // Resolve the comment author the same way the rest of the app does.
    _authorOf = (comment) =>
        (comment && (comment.username || (comment.author || {}).username)) || null;

    handleDelete = async () => {
        const { api, account, comment, onDeleted, onError } = this.props;

        const author = this._authorOf(comment);
        const permlink = comment && comment.permlink;

        // Guard: only the comment's own author may delete it.
        if (!api || !account || !author || !permlink || author !== account) {
            // Deferred (tk) so the message follows a language switch while shown.
            this.setState({ error: tk("components.delete_comment_modal.this_comment_can_t_be_deleted") });
            return;
        }

        this.setState({ deleting: true, error: null });

        try {
            await api.broadcast.deleteComment(author, permlink);
            // Hand control back to the parent so it can drop the comment from its
            // list, decrement the children count and show its own snackbar.
            if (onDeleted) {
                onDeleted(comment);
            }
            this.setState({ deleting: false, error: null });
        } catch (e) {
            // The chain rejects delete_comment once a comment has votes, replies
            // or a payout — surface that reason inline and keep the dialog open.
            // The chain's own reason is shown as-is; our fallback is translated at render.
            const message = (e && e.message) || null;
            console.warn("[DeleteCommentModal] delete failed:", message || e);
            if (onError) {
                onError(e);
            }
            this.setState({ deleting: false, error: message || tk("components.delete_comment_modal.failed_to_delete_comment") });
        }
    };

    handleClose = () => {
        // Don't allow dismissing mid-flight.
        if (this.state.deleting) {
            return;
        }
        if (this.props.onCancel) {
            this.props.onCancel();
        }
    };

    render() {
        const { classes, open, deleting, error } = this.state;

        return (
            <Dialog
                open={open}
                keepMounted={false}
                PaperProps={{ classes: { root: classes.whiteDialog } }}
                onClose={this.handleClose}
                maxWidth={"xs"}
                fullWidth={true}
                aria-labelledby="delete-comment-dialog-title"
                aria-describedby="delete-comment-dialog-description"
                disableBackdropClick={deleting}
                disableEscapeKeyDown={deleting}
            >
                <DialogTitle id="delete-comment-dialog-title">
                    {deleting
                        ? t("components.delete_comment_modal.deleting_comment")
                        : t("components.delete_comment_modal.delete_this_comment")}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText id="delete-comment-dialog-description">
                        {error ? (
                            <span className={classes.errorText}>{tx(error)}</span>
                        ) : deleting ? (
                            t("components.delete_comment_modal.please_wait_while_the_comment_is_removed")
                        ) : (
                            t("components.delete_comment_modal.the_comment_is_removed_from_the_chain")
                        )}
                    </DialogContentText>
                    {!error && !deleting && (
                        <span className={classes.hint}>
                            {t("components.delete_comment_modal.the_chain_refuses_the_deletion_once_a")}
                        </span>
                    )}
                </DialogContent>
                <DialogActions>
                    {!deleting && (
                        <Button onClick={this.handleClose} color="primary">
                            {t("words.cancel")}
                        </Button>
                    )}
                    <Button
                        onClick={this.handleDelete}
                        color="primary"
                        variant={"contained"}
                        startIcon={
                            deleting
                                ? <CircularProgress size={16} color="inherit" />
                                : <DeleteOutlineRounded />
                        }
                        autoFocus
                        disabled={deleting}
                    >
                        {deleting ? (
                            <span className={classes.progressContainer}>{t("components.delete_comment_modal.deleting")}</span>
                        ) : error ? (
                            t("components.delete_comment_modal.retry")
                        ) : (
                            t("components.delete_comment_modal.delete")
                        )}
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }
}

export default withLanguage(withStyles(styles)(DeleteCommentModal));