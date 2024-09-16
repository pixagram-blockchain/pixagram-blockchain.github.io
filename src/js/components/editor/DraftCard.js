import React from 'preact/compat';
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";
import IconButton from "@material-ui/core/IconButton";
import Chip from "@material-ui/core/Chip";

import DeleteIcon from "@material-ui/icons/Delete";
import AccessTimeIcon from "@material-ui/icons/AccessTime";

import { t, useLanguage } from "../../utils/text";

export const draftCardStyles = (theme) => ({
    draftCard: {
        backgroundColor: "#0c0c0c",
        borderRadius: "32px !important",
        margin: theme.spacing(1, 4, 2, 4),
        cursor: "pointer",
        transition: "background-color 0.2s ease",
        "&:hover": {
            backgroundColor: "#000000",
        },
        [theme.breakpoints.down("xs")]: {
            margin: "0px 12px 12px 12px"
        }
    },
    draftCardContent: {
        padding: theme.spacing(3),
        "&:last-child": {
            paddingBottom: theme.spacing(3)
        },
        [theme.breakpoints.down("xs")]: {
            padding: "16px"
        }
    },
    draftCardLayout: {
        display: "flex",
        gap: theme.spacing(2),
    },
    draftCoverPreview: {
        width: 120,
        borderRadius: "21px",
        overflow: "hidden",
        flexShrink: 0,
        backgroundColor: "rgba(255,255,255,0.05)",
        [theme.breakpoints.down("xs")]: {
            width: "32px",
        }
    },
    draftCoverImage: {
        width: "100%",
        height: "100%",
        objectFit: "cover",
    },
    draftCardMain: {
        flex: 1,
        minWidth: 0,
        padding: "8px 0px 0px 0px"
    },
    draftHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: "12px",
        fontFamily: `"Industry Book", "Normative Pro"`,
        [theme.breakpoints.down("xs")]: {
            marginBottom: "8px",
        }
    },
    draftTitle: {
        fontSize: "1.25rem",
        fontWeight: 600,
        color: "#fff",
        lineHeight: 1.3
    },
    draftDescription: {
        color: "rgba(255,255,255,0.7)",
        fontSize: "0.95rem",
        lineHeight: 1.5,
        marginBottom: theme.spacing(1)
    },
    draftMeta: {
        display: "flex",
        flexWrap: "wrap",
        gap: theme.spacing(2),
        alignItems: "center",
        color: "rgba(255,255,255,0.5)",
        fontSize: "0.85rem",
        fontFamily: `"Industry Book", "Normative Pro"`
    },
    draftMetaItem: {
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(0.5)
    },
    draftTags: {
        display: "flex",
        gap: theme.spacing(0.5),
        flexWrap: "wrap",
        marginTop: theme.spacing(1)
    },
    draftTag: {
        backgroundColor: "rgba(255,255,255,0.1)",
        color: "rgba(255,255,255,0.8)",
        borderRadius: 12,
        fontSize: "0.75rem",
        height: 24
    },
    deleteButton: {
        color: "rgba(255,255,255,0.333)",
        padding: "0px !important",
        "&:hover": {
            color: "rgba(255,255,255,0.666)",
        }
    },
});

const DraftCard = React.memo(({ classes, draft, onLoad, onDelete, formatDate }) => {
    useLanguage();

    // Stable per-card handlers — the inline lambdas re-created two closures
    // per card on every drafts-list render (i.e. every search keystroke,
    // now that filtering is synchronous).
    const handleOpen = React.useCallback(() => onLoad(draft._id), [onLoad, draft._id]);
    const handleDelete = React.useCallback((e) => {
        e.stopPropagation();
        onDelete(draft._id, draft.title);
    }, [onDelete, draft._id, draft.title]);

    return (
    <Card
        className={classes.draftCard}
        onClick={handleOpen}
    >
        <CardContent className={classes.draftCardContent}>
            <div className={classes.draftCardLayout}>
                {draft.gradient && (
                    <div className={classes.draftCoverPreview}>
                        <img src={draft.gradient} alt="" className={classes.draftCoverImage} />
                    </div>
                )}
                <div className={classes.draftCardMain}>
                    <div className={classes.draftHeader}>
                        <Box flex={1}>
                            <Typography className={classes.draftTitle}>
                                {draft.title || t("components.draft_card.untitled_draft")}
                            </Typography>
                        </Box>
                        <IconButton
                            className={classes.deleteButton}
                            onClick={handleDelete}
                        >
                            <DeleteIcon />
                        </IconButton>
                    </div>

                    {draft.description && (
                        <Typography className={classes.draftDescription}>
                            {draft.description}
                        </Typography>
                    )}

                    <div className={classes.draftMeta}>
                        <div className={classes.draftMetaItem}>
                            <AccessTimeIcon fontSize="small" />
                            <span>{formatDate(draft.lastSaved)}</span>
                        </div>
                        <div className={classes.draftMetaItem}>
                            <span>{t("components.draft_card.n_words", { count: draft.metadata?.wordCount || 0 })}</span>
                        </div>
                        <div className={classes.draftMetaItem}>
                            <span>{t("components.draft_card.n_min_read", { count: draft.metadata?.readingTime || 0 })}</span>
                        </div>
                    </div>

                    {draft.tags && draft.tags.length > 0 && (
                        <div className={classes.draftTags}>
                            {draft.tags.slice(0, 3).map((tag, index) => (
                                <Chip
                                    key={index}
                                    label={tag}
                                    size="small"
                                    className={classes.draftTag}
                                />
                            ))}
                            {draft.tags.length > 3 && (
                                <Chip
                                    label={`+${draft.tags.length - 3}`}
                                    size="small"
                                    className={classes.draftTag}
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </CardContent>
    </Card>
    );
});

export default DraftCard;
