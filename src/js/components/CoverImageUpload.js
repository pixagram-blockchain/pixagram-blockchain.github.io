import React from 'preact/compat';
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import Box from "@material-ui/core/Box";
import Tooltip from "@material-ui/core/Tooltip";
import IconButton from "@material-ui/core/IconButton";

import DeleteIcon from "@material-ui/icons/Delete";
import AddPhotoAlternateIcon from "@material-ui/icons/AddPhotoAlternate";
import AddAPhotoRounded from "@material-ui/icons/AddAPhotoRounded";
import InfoOutlined from "@material-ui/icons/InfoOutlined";

import { t, useLanguage } from "../utils/text";

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
const HIDDEN_INPUT_STYLE = { display: "none" };
const WHITE_TEXT_STYLE = { color: "#fff" };
const UPLOAD_ICON_STYLE = { fontSize: 48, color: "#666" };
const UPLOAD_HINT_STYLE = { color: "#999", marginTop: 8 };
const POINTER_STYLE = { cursor: "pointer" };

const CoverImageUpload = React.memo(({
                                         classes,
                                         gradient,
                                         fileInputRef,
                                         onImageUpload,
                                         onRemoveImage,
                                         onOpenGradientEditor
                                     }) => {
    useLanguage();
    // Stable: was an inline `() => fileInputRef.current?.click()` closure,
    // re-created on every render. The ref object itself never changes.
    const openFilePicker = React.useCallback(() => fileInputRef.current?.click(), [fileInputRef]);

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
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={HIDDEN_INPUT_STYLE}
                    onChange={onImageUpload}
                />
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
                    <Box
                        textAlign="center"
                        onClick={openFilePicker}
                        style={POINTER_STYLE}
                    >
                        <AddPhotoAlternateIcon style={UPLOAD_ICON_STYLE} />
                        <Typography variant="body2" style={UPLOAD_HINT_STYLE}>
                            {t("components.cover_image_upload.click_to_upload")}
                        </Typography>
                        <div className={classes.imageOverlay}>
                            <Button
                                size="small"
                                startIcon={<AddAPhotoRounded />}
                                onClick={onOpenGradientEditor}
                                style={WHITE_TEXT_STYLE}
                            >
                                {t("components.cover_image_upload.generate")}
                            </Button>
                        </div>
                    </Box>
                )}
            </div>
        </div>
    );
});

export default CoverImageUpload;
