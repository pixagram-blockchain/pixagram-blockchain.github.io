import React from 'preact/compat';
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import Button from "@material-ui/core/Button";
import Box from "@material-ui/core/Box";
import CircularProgress from "@material-ui/core/CircularProgress";

import CloseIcon from "@material-ui/icons/Close";
import PublishIcon from "@material-ui/icons/Publish";
import {safeHTML} from "../../utils/api/sanitizer";

import { t, useLanguage } from "../utils/text";

// Portal dialog: keep keys pressed while previewing away from
// document-level hotkey listeners. Escape passes through for close.
const stopKeyLeak = (e) => {
    if (e.key !== 'Escape' && e.key !== 'Esc') e.stopPropagation();
};

// Hoisted static props — were inline literals re-created per render.
const KEY_LEAK_PAPER_PROPS = { onKeyDown: stopKeyLeak, onKeyUp: stopKeyLeak };
const PUBLISH_BUTTON_STYLE = { backgroundColor: "#fff", color: "#000", borderRadius: 24 };
// Inline style would override MUI's .Mui-disabled gray, so the disabled
// state needs its own explicit look.
const PUBLISH_BUTTON_DISABLED_STYLE = { backgroundColor: "rgba(255,255,255,0.25)", color: "rgba(0,0,0,0.55)", borderRadius: 24 };
const PUBLISH_SPINNER_STYLE = { color: "#000" };

// memo comparator: while CLOSED, the parent still re-renders this dialog on
// every title/description keystroke and word-count tick (all props here).
// A closed, non-keepMounted MUI Dialog renders nothing, so that work is pure
// overhead — skip it entirely until `open` flips. Once either side is open,
// fall through to a normal shallow compare so live props still propagate.
const previewPropsEqual = (prev, next) => {
    if (!prev.open && !next.open) return true;
    const keys = Object.keys(next);
    if (keys.length !== Object.keys(prev).length) return false;
    for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (prev[k] !== next[k]) return false;
    }
    return true;
};

export const previewDialogStyles = (theme) => ({
    previewDialog: {
        "& .MuiDialog-paper": {
            backgroundColor: "#1a1a1a",
            color: "#fff",
            borderRadius: 24,
            maxWidth: 900,
            width: "95%",
            maxHeight: "90vh",
            overflow: "hidden"
        }
    },
    previewDialogTitle: {
        background: "linear-gradient(180deg, #1a1a1a 0%, transparent 100%)",
        padding: theme.spacing(3, 4),
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
    },
    previewDialogContent: {
        padding: theme.spacing(4),
        backgroundColor: "#0a0a0a",
        overflow: "auto"
    },
    previewTitle: {
        fontSize: "2.5rem",
        fontWeight: 700,
        color: "#fff",
        marginBottom: theme.spacing(2),
        lineHeight: 1.2
    },
    previewDescription: {
        fontSize: "1.25rem",
        color: "rgba(255,255,255,0.8)",
        marginBottom: theme.spacing(4),
        lineHeight: 1.5
    },
    previewContent: {
        color: "#e0e0e0",
        fontSize: "1.125rem",
        lineHeight: 1.8,
        "& h1": {
            fontSize: "2.5em",
            fontWeight: 600,
            color: "#fff",
            margin: "1em 0 0.5em"
        },
        "& h2": {
            fontSize: "2em",
            fontWeight: 600,
            color: "#fff",
            margin: "1em 0 0.5em"
        },
        "& h3": {
            fontSize: "1.5em",
            fontWeight: 600,
            color: "#fff",
            margin: "1em 0 0.5em"
        },
        "& p": {
            marginBottom: "1em"
        },
        "& blockquote": {
            borderLeft: "4px solid rgba(255,255,255,0.3)",
            paddingLeft: 24,
            margin: "1.5em 0",
            color: "rgba(255,255,255,0.8)",
            fontStyle: "italic"
        },
        "& pre": {
            backgroundColor: "rgba(255,255,255,0.05)",
            padding: 24,
            borderRadius: 12,
            overflow: "auto",
            fontFamily: "monospace",
            margin: "1.5em 0"
        },
        "& code": {
            backgroundColor: "rgba(255,255,255,0.1)",
            padding: "2px 6px",
            borderRadius: 4,
            fontFamily: "monospace",
            fontSize: "0.9em"
        },
        "& pre code": {
            backgroundColor: "transparent",
            padding: 0
        },
        "& a": {
            color: "#90caf9",
            textDecoration: "none",
            "&:hover": {
                textDecoration: "underline"
            }
        },
        "& ul, & ol": {
            marginBottom: "1em",
            paddingLeft: "2em"
        },
        "& li": {
            marginBottom: "0.5em"
        },
        "& img": {
            maxWidth: "100%",
            height: "auto",
            borderRadius: 12,
            margin: "1.5em 0"
        },
        "& table": {
            width: "100%",
            borderCollapse: "collapse",
            margin: "1.5em 0",
            "& th, & td": {
                padding: 12,
                borderBottom: "1px solid rgba(255,255,255,0.1)",
                textAlign: "left"
            },
            "& th": {
                fontWeight: 600,
                color: "#fff"
            }
        }
    },
    previewDialogActions: {
        padding: theme.spacing(3, 4),
        background: "linear-gradient(0deg, #1a1a1a 0%, transparent 100%)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
    },
});

const PreviewDialog = React.memo(({
                                      classes,
                                      open,
                                      title,
                                      description,
                                      content,
                                      wordCount,
                                      readingTime,
                                      activeAccount,
                                      isPublishing,
                                      editMode,
                                      onClose,
                                      onPublish,
                                      renderMarkdown
                                  }) => {
    useLanguage();
    // Parse + sanitize once per content change (i.e., once per preview open).
    // Previously this ran on every render of the component — including every
    // keystroke while the dialog was closed, since JSX props evaluate eagerly.
    const previewHtml = React.useMemo(
        () => safeHTML(renderMarkdown(content || '')),
        [content, renderMarkdown]
    );

    return (
        <Dialog
            className={classes.previewDialog}
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
    PaperProps={KEY_LEAK_PAPER_PROPS}
        >
            <div className={classes.previewDialogTitle}>
                <Typography variant="h5" style={{ fontWeight: 600 }}>
                    {t("components.preview_dialog.preview")}
                </Typography>
                <IconButton color="inherit" onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </div>
            <DialogContent className={classes.previewDialogContent}>
                <Typography className={classes.previewTitle}>
                    {title || 'Untitled'}
                </Typography>

                {description && (
                    <Typography className={classes.previewDescription}>
                        {description}
                    </Typography>
                )}

                <div
                    className={classes.previewContent}
                    dangerouslySetInnerHTML={{ __html: safeHTML(previewHtml) }}
                />
            </DialogContent>
            <div className={classes.previewDialogActions}>
                <Box display="flex" alignItems="center" color="rgba(255,255,255,0.6)">
                    <Typography variant="caption">{t("components.preview_dialog.words_min_read", {
                            wordCount: wordCount,
                            readingTime: readingTime
                        })}</Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={isPublishing
                        ? <CircularProgress size={18} style={PUBLISH_SPINNER_STYLE} />
                        : <PublishIcon />}
                    onClick={onPublish}
                    disabled={!activeAccount || Boolean(isPublishing)}
                    style={(!activeAccount || isPublishing) ? PUBLISH_BUTTON_DISABLED_STYLE : PUBLISH_BUTTON_STYLE}
                    title={!activeAccount ? 'Log in to publish' : undefined}
                >
                    {isPublishing
                        ? (editMode ? 'Updating...' : 'Publishing...')
                        : (editMode ? 'Update' : 'Publish')}
                </Button>
            </div>
        </Dialog>
    );
}, previewPropsEqual);

export default PreviewDialog;
