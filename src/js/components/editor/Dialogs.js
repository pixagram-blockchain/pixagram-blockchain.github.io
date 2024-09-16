import React from 'preact/compat';
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import DialogTitle from "@material-ui/core/DialogTitle";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import Box from "@material-ui/core/Box";
import LinearProgress from "@material-ui/core/LinearProgress";

import SecurityIcon from "@material-ui/icons/Security";
import CloudUploadIcon from "@material-ui/icons/CloudUpload";

import { t, useLanguage } from "../../utils/text";

// These dialogs are portals on document.body: keystrokes typed inside them
// otherwise bubble to document-level hotkey listeners (feed navigation etc.).
// Escape passes through so MUI's Modal can still close the dialog.
const stopKeyLeak = (e) => {
    if (e.key !== 'Escape' && e.key !== 'Esc') e.stopPropagation();
};

// Hoisted static props — these were inline object literals, re-allocated on
// every render. The value-controlled dialogs below re-render on EVERY
// keystroke typed into their fields, so the churn was per-keypress.
const KEY_LEAK_PAPER_PROPS = { onKeyDown: stopKeyLeak, onKeyUp: stopKeyLeak };
const WHITE_BUTTON_STYLE = { backgroundColor: "#fff", color: "#000" };
// Inline style would override MUI's .Mui-disabled gray, so the disabled
// state needs its own explicit look.
const DISABLED_WHITE_BUTTON_STYLE = { backgroundColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.4)" };
const LINK_TARGET_STYLE = { color: "rgba(255,255,255,0.55)", marginBottom: 16, fontStyle: "italic" };
const OR_DIVIDER_STYLE = { textAlign: "center", margin: "12px 0 10px", color: "rgba(255,255,255,0.45)" };
const UPLOAD_BUTTON_STYLE = { color: "#fff", borderColor: "rgba(255,255,255,0.4)", textTransform: "none" };
const UPLOAD_PROGRESS_STYLE = { marginTop: 12, borderRadius: 2 };
const UPLOAD_HINT_STYLE = { display: "block", marginTop: 10, color: "rgba(255,255,255,0.45)" };
const HIDDEN_FILE_INPUT_STYLE = { display: "none" };
const SECURITY_ICON_STYLE = { marginRight: 8, color: "#4caf50" };

export const dialogStyles = (theme) => ({
    darkDialog: {
        backgroundColor: "#212121",
        color: "#fff",
        borderRadius: 16
    },
    darkDialogContent: {
        padding: 24
    },
    darkDialogActions: {
        padding: "8px 16px 16px",
        display: "flex",
        justifyContent: "flex-end"
    },
    darkInput: {
        "& .MuiInputLabel-root": {
            color: "rgba(255,255,255,0.8)"
        },
        "& .MuiOutlinedInput-root": {
            color: "#fff",
            "& fieldset": {
                borderColor: "rgba(255,255,255,0.24)"
            },
            "&:hover fieldset": {
                borderColor: "rgba(255,255,255,0.48)"
            },
            "&.Mui-focused fieldset": {
                borderColor: "#fff"
            }
        }
    },
    confirmDialog: {
        "& .MuiDialog-paper": {
            backgroundColor: "#2a2a2a",
            color: "#fff",
            borderRadius: 16,
            maxWidth: 400
        }
    },
    passwordDialog: {
        "& .MuiDialog-paper": {
            backgroundColor: "#2a2a2a",
            color: "#fff",
            borderRadius: 16,
            maxWidth: 400
        }
    },
    imageUrlDialog: {
        "& .MuiDialog-paper": {
            backgroundColor: "#2a2a2a",
            color: "#fff",
            borderRadius: 16,
            maxWidth: 400
        }
    },
});

// Link Dialog Component.
// A link is always created FROM a text selection (the entry points are
// disabled otherwise), so the selected text is shown as read-only context
// and only the URL is asked. Enter inserts, Insert is disabled while the
// URL is empty.
export const LinkDialog = React.memo(({
                                          classes,
                                          open,
                                          selectedText,
                                          linkUrl,
                                          onClose,
                                          onInsert,
                                          onUrlChange
                                      }) => {
    useLanguage();
    // This PaperProps needs `classes`, so it can't be a module constant like
    // the others — memoized instead. classes is a withStyles singleton, so
    // this allocates once for the dialog's lifetime rather than on every
    // keystroke typed into the URL field.
    const paperProps = React.useMemo(
        () => ({ classes: { root: classes.darkDialog }, onKeyDown: stopKeyLeak, onKeyUp: stopKeyLeak }),
        [classes]
    );

    const canInsert = Boolean(linkUrl && linkUrl.trim());

    const onUrlKeyDown = React.useCallback((e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            onInsert();
        }
    }, [onInsert]);

    const text = selectedText || '';
    const snippet = text.length > 64 ? text.slice(0, 64) + '…' : text;

    return (
        <Dialog
            PaperProps={paperProps}
            open={open}
            maxWidth="xs"
            fullWidth
            onClose={onClose}
        >
            <DialogContent className={classes.darkDialogContent}>
                <Typography variant="h6" gutterBottom>
                    {t("components.dialogs.insert_link")}
                </Typography>
                <Typography variant="body2" style={LINK_TARGET_STYLE}>
                    {t("components.dialogs.linking", { snippet })}
                </Typography>
                <TextField
                    className={classes.darkInput}
                    variant="outlined"
                    label="URL"
                    placeholder="https://..."
                    value={linkUrl}
                    onChange={onUrlChange}
                    onKeyDown={onUrlKeyDown}
                    fullWidth
                    autoFocus
                />
            </DialogContent>
            <DialogActions className={classes.darkDialogActions}>
                <Button onClick={onClose}>{t("components.dialogs.cancel")}</Button>
                <Button
                    variant="contained"
                    onClick={onInsert}
                    disabled={!canInsert}
                    style={canInsert ? WHITE_BUTTON_STYLE : DISABLED_WHITE_BUTTON_STYLE}
                >
                    {t("components.dialogs.insert")}
                </Button>
            </DialogActions>
        </Dialog>
    );
});

// Image URL Dialog Component.
// Two ways in: paste an https URL, or upload a local file — the file is
// encoded per utils/arweaveImage policy and stored on Arweave, then the
// gateway URL is inserted for you.
export const ImageUrlDialog = React.memo(({
                                              classes,
                                              open,
                                              value,
                                              uploading,
                                              onClose,
                                              onInsert,
                                              onChange,
                                              onFileSelected
                                          }) => {
    useLanguage();

    const fileInputRef = React.useRef(null);

    const onValueKeyDown = React.useCallback((e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            onInsert();
        }
    }, [onInsert]);

    const openFilePicker = React.useCallback(() => {
        if (fileInputRef.current) fileInputRef.current.click();
    }, []);

    const onFileChange = React.useCallback((e) => {
        const file = e.target.files && e.target.files[0];
        // Reset so picking the same file again still fires onChange.
        e.target.value = '';
        if (file && onFileSelected) onFileSelected(file);
    }, [onFileSelected]);

    const busy = Boolean(uploading);

    return (
        <Dialog
            className={classes.imageUrlDialog}
            open={open}
            onClose={onClose}
            PaperProps={KEY_LEAK_PAPER_PROPS}
        >
            <DialogTitle>{t("components.dialogs.insert_image")}</DialogTitle>
            <DialogContent>
                <TextField
                    className={classes.darkInput}
                    variant="outlined"
                    label={t("components.dialogs.image_url")}
                    value={value}
                    onChange={onChange}
                    onKeyDown={onValueKeyDown}
                    fullWidth
                    autoFocus
                    margin="normal"
                    disabled={busy}
                />
                <Typography variant="body2" style={OR_DIVIDER_STYLE}>
                    {t("components.dialogs.or")}
                </Typography>
                <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<CloudUploadIcon />}
                    onClick={openFilePicker}
                    disabled={busy}
                    style={UPLOAD_BUTTON_STYLE}
                >
                    {busy ? t("components.dialogs.uploading_to_arweave") : t("components.dialogs.upload_from_device")}
                </Button>
                {busy && <LinearProgress style={UPLOAD_PROGRESS_STYLE} />}
                <Typography variant="caption" style={UPLOAD_HINT_STYLE}>
                    {t("components.dialogs.uploads_are_converted_to_webp_and_stored")}
                </Typography>
                <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    style={HIDDEN_FILE_INPUT_STYLE}
                    onChange={onFileChange}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">
                    {t("components.dialogs.cancel")}
                </Button>
                <Button onClick={onInsert} variant="contained" color="primary" disabled={busy}>
                    {t("components.dialogs.insert")}
                </Button>
            </DialogActions>
        </Dialog>
    );
});

// Confirm Dialog Component
export const ConfirmDialog = React.memo(({
                                             classes,
                                             open,
                                             title,
                                             message,
                                             onClose,
                                             onConfirm
                                         }) => {
    useLanguage();
    return (
    <Dialog
        className={classes.confirmDialog}
        open={open}
        onClose={onClose}
        PaperProps={KEY_LEAK_PAPER_PROPS}
    >
        <DialogTitle>
            <Box display="flex" alignItems="center">
                {title}
            </Box>
        </DialogTitle>
        <DialogContent>
            <Typography>{message}</Typography>
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose} color="inherit">
                {t("components.dialogs.cancel")}
            </Button>
            <Button onClick={onConfirm} variant="contained" color="primary">
                {t("components.dialogs.confirm")}
            </Button>
        </DialogActions>
    </Dialog>
);
});

// Password Dialog Component
export const PasswordDialog = React.memo(({
                                              classes,
                                              open,
                                              title,
                                              value,
                                              onClose,
                                              onConfirm,
                                              onChange
                                          }) => {
    useLanguage();
    return (
    <Dialog
        className={classes.passwordDialog}
        open={open}
        onClose={onClose}
        PaperProps={KEY_LEAK_PAPER_PROPS}
    >
        <DialogTitle>
            <Box display="flex" alignItems="center">
                <SecurityIcon style={SECURITY_ICON_STYLE} />
                {title}
            </Box>
        </DialogTitle>
        <DialogContent>
            <TextField
                className={classes.darkInput}
                variant="outlined"
                type="password"
                label={t("components.dialogs.password")}
                value={value}
                onChange={onChange}
                fullWidth
                autoFocus
                margin="normal"
            />
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose} color="inherit">
                {t("components.dialogs.cancel")}
            </Button>
            <Button onClick={onConfirm} variant="contained" color="primary">
                {t("components.dialogs.continue")}
            </Button>
        </DialogActions>
    </Dialog>
);
});