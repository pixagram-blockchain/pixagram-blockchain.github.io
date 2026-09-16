import React from 'preact/compat';
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import Tooltip from "@material-ui/core/Tooltip";
import IconButton from "@material-ui/core/IconButton";

import DeleteIcon from "@material-ui/icons/Delete";
import GradientIcon from "@material-ui/icons/Gradient";
import InfoOutlined from "@material-ui/icons/InfoOutlined";

import { t, useLanguage } from "../../utils/text";

// A post's cover is either nothing or an SVG gradient from
// GradientEditorDialog — the only form the publish paths put on-chain.
// This is the one definition every cover consumer shares (the dialog's
// state accessors, the drafts list): anything else — raster data URLs left
// in drafts by the retired upload path, foreign URLs in on-chain metadata —
// counts as "no cover", so nothing is ever previewed that can't be
// published.
export const isGradientCover = (value) =>
    typeof value === 'string' && value.startsWith('data:image/svg+xml');

export const coverImageUploadStyles = (theme) => ({
    imageUploadArea: {
        position: "relative",
        width: "100%",
        height: 175.5,
        border: "2px dashed rgba(255,255,255,0.2)",
        borderRadius: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "all 0.3s ease",
        overflow: "hidden",
        "&:hover": {
            borderColor: "rgba(255,255,255,0.4)",
            backgroundColor: "rgba(255,255,255,0.02)"
        }
    },
    uploadedImage: {
        position: "absolute",
        width: "100%",
        height: "100%",
        objectFit: "cover",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    imageOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%)",
        display: "flex",
        alignItems: "flex-end",
        padding: theme.spacing(2),
        opacity: 0.5,
        transition: "opacity 0.3s",
        "&:hover": {
            opacity: 1
        }
    },
});

// Hoisted static styles — were inline literals re-created per render.
const WHITE_TEXT_STYLE = { color: "#fff" };
// Empty state fills the dashed area so the whole of it is the click target,
// as the retired "click to upload" area was.
const GENERATE_AREA_STYLE = {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    cursor: "pointer",
};
const GENERATE_ICON_STYLE = { fontSize: 48, color: "#666" };
const GENERATE_BUTTON_STYLE = { color: "#fff", borderColor: "rgba(255,255,255,0.4)" };

// The cover is either none or a generated gradient: the only way in is the
// gradient editor, and the only way out is Remove. There is deliberately no
// file input — a raster cover never went on-chain (the publish paths only
// ever broadcast the SVG gradient), so uploading one showed a cover the
// post would not actually have.
const CoverImageUpload = React.memo(({
                                         classes,
                                         gradient,
                                         onRemoveImage,
                                         onOpenGradientEditor
                                     }) => {
    useLanguage();

    return (
        <div className={classes.settingsSection}>
            <Typography variant={"subtitle2"} className={classes.subTitle2}>
                {t("components.cover_image_upload.cover_image")}
                <Tooltip interactive
                         enterTouchDelay={200}
                         leaveTouchDelay={4000}
                         classes={{ tooltip: classes.tooltipRoot }}
                         title={<span className={classes.tooltip}>{t("components.cover_image_upload.the_cover_image_has_a_purpose_of")}</span>}>
                    <IconButton><InfoOutlined/></IconButton>
                </Tooltip>
            </Typography>
            <div className={classes.imageUploadArea}>
                {gradient ? (
                    <div>
                        <img src={gradient} alt={t("components.cover_image_upload.cover")} className={classes.uploadedImage} />
                        <div className={classes.imageOverlay}>
                            <Button
                                size="small"
                                startIcon={<DeleteIcon />}
                                onClick={onRemoveImage}
                                style={WHITE_TEXT_STYLE}
                            >
                                {t("components.cover_image_upload.remove")}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div style={GENERATE_AREA_STYLE} onClick={onOpenGradientEditor}>
                        <GradientIcon style={GENERATE_ICON_STYLE} />
                        {/* No handler of its own on purpose: the whole dashed
                        area is the target, and a click on the button — or
                        Enter/Space while it has keyboard focus — bubbles up
                        to it. Wiring both would open the editor twice. */}
                        <Button
                            size="small"
                            variant="outlined"
                            style={GENERATE_BUTTON_STYLE}
                        >
                            {t("components.cover_image_upload.generate")}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
});

export default CoverImageUpload;