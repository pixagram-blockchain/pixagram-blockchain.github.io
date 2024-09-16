import React from 'preact/compat';
import withStyles from "@material-ui/core/styles/withStyles";
import Button from "@material-ui/core/Button";
import Fade from "@material-ui/core/Fade";
import DraftsIcon from "@material-ui/icons/Drafts";
import CheckRounded from "@material-ui/icons/CheckRounded";
import VisibilityIcon from "@material-ui/icons/Visibility";

import { t, useLanguage } from "../../utils/text";

// Hoisted static style — the same literal appeared three times below,
// re-allocated on every render.
const WHITE_PILL_STYLE = { backgroundColor: "#fff", color: "#000", borderRadius: 24 };

// Self-contained styles: ActionButtons is imported OUTSIDE the editor too
// (CommunityHeader / CommunityInfo), where the editor dialog's merged
// withStyles sheet — the previous source of `settingsActions` — doesn't
// exist. Owning the style makes the component drop-in anywhere; when a
// caller does pass a classes prop, MUI merges it with this sheet.
export const actionButtonsStyles = (theme) => ({
    settingsActions: {
        padding: theme.spacing(2, 3),
        display: "flex",
        justifyContent: "space-between",
    },
});

const ActionButtons = React.memo(({ classes, mobile, tab, editMode, onOpenDrafts, onFinish, onPreview }) => {
    // React.memo compares props shallowly, and none of them move when the user
    // switches language — so a parent re-render can't refresh these labels.
    // Subscribing here lets the component repaint itself while the memo keeps
    // doing its job for everything else. Must sit above the `mobile` early
    // return: hooks cannot be called conditionally.
    useLanguage();

    // Parse once — was parseInt(tab) three times per render.
    const tabIndex = parseInt(tab);

    // Resolved once per render and shared by both branches; the mobile and
    // desktop trees render the same three labels.
    const draftsLabel = t("components.editor_action_buttons.drafts");
    const previewLabel = t("components.editor_action_buttons.preview");

    if (mobile) {
        return (
            <div className={classes.settingsActions}>
                {/* Drafts make no sense while editing an on-chain post */}
                {!editMode ? (
                    <Button
                        variant="text"
                        color="inherit"
                        startIcon={<DraftsIcon />}
                        onClick={onOpenDrafts}
                    >
                        {draftsLabel}
                    </Button>
                ) : <span />}
                {tabIndex === 0 ? (
                    <Fade in={tabIndex === 0}>
                        <Button
                            variant="contained"
                            startIcon={<CheckRounded />}
                            onClick={onFinish}
                            style={WHITE_PILL_STYLE}
                        >
                            {t("components.editor_action_buttons.finish")}
                        </Button>
                    </Fade>
                ) : (
                    <Fade in={tabIndex === 1}>
                        <Button
                            variant="contained"
                            startIcon={<VisibilityIcon />}
                            onClick={onPreview}
                            style={WHITE_PILL_STYLE}
                        >
                            {previewLabel}
                        </Button>
                    </Fade>
                )}
            </div>
        );
    }

    return (
        <div className={classes.settingsActions}>
            {!editMode ? (
                <Button
                    variant="text"
                    color="inherit"
                    startIcon={<DraftsIcon />}
                    onClick={onOpenDrafts}
                >
                    {draftsLabel}
                </Button>
            ) : <span />}
            <Button
                variant="contained"
                startIcon={<VisibilityIcon />}
                onClick={onPreview}
                style={WHITE_PILL_STYLE}
            >
                {previewLabel}
            </Button>
        </div>
    );
});

export default withStyles(actionButtonsStyles)(ActionButtons);
