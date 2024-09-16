import React from 'preact/compat';
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import InputAdornment from "@material-ui/core/InputAdornment";

import SearchIcon from "@material-ui/icons/Search";
import AddIcon from "@material-ui/icons/Add";
import ArticleIcon from "@material-ui/icons/DockOutlined";

import DraftCard from './DraftCard';

import { t, useLanguage } from "../utils/text";

// Portal dialog: keep typed keys (search field, Enter) away from
// document-level hotkey listeners. Escape passes through for close.
const stopKeyLeak = (e) => {
    if (e.key !== 'Escape' && e.key !== 'Esc') e.stopPropagation();
};

// Hoisted static props — inline literals here were re-allocated on every
// search keystroke (the controlled field re-renders the whole dialog).
const KEY_LEAK_PAPER_PROPS = { onKeyDown: stopKeyLeak, onKeyUp: stopKeyLeak };
const SEARCH_INPUT_PROPS = {
    startAdornment: (
        <InputAdornment position="start">
            <SearchIcon />
        </InputAdornment>
    ),
};
const EMPTY_TITLE_STYLE = { fontWeight: 500 };
const EMPTY_BODY_STYLE = { color: "rgba(255,255,255,0.6)" };

export const draftsDialogStyles = (theme) => ({
    draftsDialog: {
        "& .MuiDialog-paper": {
            backgroundColor: "#1a1a1a",
            color: "#fff",
            borderRadius: 24,
            maxWidth: 900,
            width: "95%",
            maxHeight: "85vh",
            overflow: "hidden"
        }
    },
    draftsDialogTitle: {
        background: "#1a1a1a",
        padding: theme.spacing(3, 4),
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "space-between",
        alignItems: "center",
        gap: theme.spacing(2),
    },
    draftsDialogTitleRow: {
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(2),
        flex: "1 1 auto",
        minWidth: 0,
        [theme.breakpoints.down("xs")]: {
            width: "calc(100% - 96px)",
        }
    },
    draftsDialogActions: {
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(1),
        flexShrink: 0,
        [theme.breakpoints.down("xs")]: {
            width: "100%",
            justifyContent: "space-between",
        }
    },
    draftsDialogContent: {
        padding: 0,
        backgroundColor: "#1a1a1a",
        display: "flex",
        flexDirection: "column"
    },
    searchField: {
        flex: "1 1 196px",
        maxWidth: 196,
        "& .MuiOutlinedInput-root": {
            color: "#fff",
            backgroundColor: "rgba(255,255,255,0.05)",
            borderRadius: 16,
            "& fieldset": {
                borderColor: "rgba(255,255,255,0.15)"
            },
            "&:hover fieldset": {
                borderColor: "rgba(255,255,255,0.25)"
            },
            "&.Mui-focused fieldset": {
                borderColor: "rgba(255,255,255,0.4)"
            }
        },
        "& .MuiInputLabel-root": {
            color: "rgba(255,255,255,0.6)"
        },
        "& .MuiInputAdornment-root svg": {
            color: "rgba(255,255,255,0.4)"
        }
    },
    draftsList: {
        padding: 0,
        flex: 1,
        overflow: "auto"
    },
    emptyState: {
        padding: theme.spacing(8, 4),
        textAlign: "center",
        color: "rgba(255,255,255,0.5)",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center"
    },
    emptyStateIcon: {
        fontSize: 80,
        marginBottom: theme.spacing(3),
        color: "rgba(255,255,255,0.3)"
    },
    loadingState: {
        padding: theme.spacing(8),
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flex: 1
    },
    newDraftButton: {
        backgroundColor: "#ffffff",
        color: "#000000",
        borderRadius: 16,
        textTransform: "none",
        fontWeight: 500,
        padding: "8px 16px",
        "&:hover": {
            backgroundColor: "#f0f0f0"
        },
        [theme.breakpoints.down("xs")]: {
            "& .MuiButton-endIcon": {
                marginLeft: -4
            },
            "& .MuiButton-endIcon > span": {

            },
        }
    }
});

const DraftsDialog = React.memo(({
                                     classes,
                                     open,
                                     drafts,
                                     loading,
                                     searchQuery,
                                     onClose,
                                     onNewDraft,
                                     onLoadDraft,
                                     onDeleteDraft,
                                     onSearchChange,
                                     formatDate
                                 }) => {
    useLanguage();
    return (
    <Dialog
        className={classes.draftsDialog}
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
PaperProps={KEY_LEAK_PAPER_PROPS}
    >
        <div className={classes.draftsDialogTitle}>
            <div className={classes.draftsDialogTitleRow}>
                <TextField
                    className={classes.searchField}
                    variant="outlined"
                    placeholder={t("components.drafts_dialog.search_drafts")}
                    value={searchQuery}
                    onChange={onSearchChange}
                    size="small"
                    InputProps={SEARCH_INPUT_PROPS}
                />
            </div>
            <div className={classes.draftsDialogActions}>
                <Button
                    className={classes.newDraftButton}
                    onClick={onNewDraft}
                    endIcon={<AddIcon />}
                >
                    <span>{t("components.drafts_dialog.new_draft")}</span>
                </Button>
            </div>
        </div>

        <DialogContent className={classes.draftsDialogContent}>
            {loading ? (
                <div className={classes.loadingState}>
                    <CircularProgress />
                </div>
            ) : drafts.length === 0 ? (
                <div className={classes.emptyState}>
                    <ArticleIcon className={classes.emptyStateIcon} />
                    <Typography variant="h5" gutterBottom style={EMPTY_TITLE_STYLE}>
                        {searchQuery ? 'No drafts found' : 'No drafts yet'}
                    </Typography>
                    <Typography variant="body1" style={EMPTY_BODY_STYLE}>
                        {searchQuery ? 'Try a different search query' : 'Start writing to save your first draft automatically'}
                    </Typography>
                </div>
            ) : (
                <div className={classes.draftsList}>
                    {drafts.map((draft) => (
                        <DraftCard
                            key={draft._id}
                            classes={classes}
                            draft={draft}
                            onLoad={onLoadDraft}
                            onDelete={onDeleteDraft}
                            formatDate={formatDate}
                        />
                    ))}
                </div>
            )}
        </DialogContent>
    </Dialog>
    );
});

export default DraftsDialog;
