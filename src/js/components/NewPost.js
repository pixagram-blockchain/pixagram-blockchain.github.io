import * as React from "preact/compat";
import { useState, useCallback, useMemo, useEffect, useRef, memo, useReducer, useLayoutEffect } from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import RadioGroup from "@material-ui/core/RadioGroup";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogContentText from "@material-ui/core/DialogContentText";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import Typography from "@material-ui/core/Typography";
import Input from "@material-ui/core/Input";
import Box from "@material-ui/core/Box";
import CircularProgress from "@material-ui/core/CircularProgress";
import FormControl from "@material-ui/core/FormControl";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import FormHelperText from "@material-ui/core/FormHelperText";
import Radio from "@material-ui/core/Radio";
import TextField from "@material-ui/core/TextField";
import Slider from "@material-ui/core/Slider";
import Switch from "@material-ui/core/Switch";
import InputAdornment from "@material-ui/core/InputAdornment";
import * as actions from "../actions/utils";
import { ToxicityWatcher } from "./ToxicityHint";
import InsertDriveFileIcon from "@material-ui/icons/InsertDriveFileOutlined";
import CompareIcon from "@material-ui/icons/Compare";
import SendIcon from "@material-ui/icons/Send";
import ImageIcon from "@material-ui/icons/Image";
import DescriptionIcon from "@material-ui/icons/Description";
import CloseIcon from "@material-ui/icons/Close";
import {isArtworkPixelart, processImageFile, quantizeImageData} from "../utils/pix2art/file2imgd";
import JSLoader from "../utils/JSLoader";
import Fade from "@material-ui/core/Fade";
import LicenseCustomizationDialog from "./LicenseCustomizationDialog";
import { PIXA_LICENSE_BASE, createDefaultCustomization } from "../utils/pixa_license";
import Chip from "@material-ui/core/Chip";
import GavelIcon from "@material-ui/icons/Gavel";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import Paper from "@material-ui/core/Paper";
import IconButton from "@material-ui/core/IconButton";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import Grid from "@material-ui/core/Grid";
import InfoOutlinedIcon from "@material-ui/icons/InfoOutlined";
import Tab from "@material-ui/core/Tab";
import Tabs from "@material-ui/core/Tabs";
import AddPhotoAlternateIcon from "@material-ui/icons/AddPhotoAlternate";
import Portal from "@material-ui/core/Portal";
import Autocomplete from "@material-ui/lab/Autocomplete";

import { t, useLanguage } from "../utils/text";

// ============================================================================
// NSFW AUTO-DETECTION (final step)
// ============================================================================
// Bridges to the same on-device classifier PaperCard uses to blur feed
// images (utils/nsfw.js). Here it runs once on the final "Post" step over
// the image being published and auto-enables the NSFW switch when the
// content is detected as mature/sensitive.
//
// The detector pulls in a heavy model + onnxruntime that must NOT block the
// NewPost dialog bundle or first paint, so — exactly as in PaperCard.js — it
// is dynamic-import()ed lazily and cached at module scope (cost paid once per
// session). Detection is purely advisory: it never blocks publishing and only
// ever turns the flag ON.
let _nsfwMod = null;
let _nsfwModPromise = null;

// Idempotent loader. Resolves to the module (default export) or null if the
// import failed. Safe to call repeatedly / concurrently.
function loadNsfwDetect() {
    if (_nsfwMod) return Promise.resolve(_nsfwMod);
    if (_nsfwModPromise) return _nsfwModPromise;
    _nsfwModPromise = import("../utils/nsfw")
        .then((m) => { _nsfwMod = (m && (m.default || m)) || null; return _nsfwMod; })
        .catch(() => {
            // Clear the promise so a later attempt may retry, and resolve to
            // null so callers treat detection as unavailable (fail-open).
            _nsfwModPromise = null;
            return null;
        });
    return _nsfwModPromise;
}

// Fast, dependency-free 53-bit string hash (cyrb53). Used to derive a stable,
// content-addressed id for the verdict cache from the encoded image: identical
// image bytes => identical id => classified at most once per device. Matches
// utils/nsfw.js's documented convention that the cache key is a content hash.
function nsfwImageKey(str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return "img-" + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

// Fallback source of pixels for classification: decode the (bare, WEBP) post
// body to ImageData. Only used when the live `preview` ImageData isn't on hand.
function decodeBase64ToImageData(base64) {
    return new Promise((resolve) => {
        if (!base64) return resolve(null);
        try {
            const img = new Image();
            img.onload = () => {
                try {
                    const c = document.createElement("canvas");
                    c.width = img.naturalWidth;
                    c.height = img.naturalHeight;
                    const ctx = c.getContext("2d");
                    if (!ctx) return resolve(null);
                    ctx.drawImage(img, 0, 0);
                    resolve(ctx.getImageData(0, 0, c.width, c.height));
                } catch (e) { resolve(null); }
            };
            img.onerror = () => resolve(null);
            img.src = "data:image/webp;base64," + base64;
        } catch (e) { resolve(null); }
    });
}

// ============================================================================
// VALIDATION CONSTANTS
// ============================================================================

const VALIDATION = {
    TITLE_MAX_LENGTH: 24,
    DESCRIPTION_MAX_LENGTH: 1024,
    TAGS_MIN_COUNT: 1,
    TAGS_MAX_COUNT: 5,
    TAG_MIN_LENGTH: 3,
    TAG_PATTERN: /^[a-z][a-z0-9\-]*$/,
    TAG_INVALID_CHARS: /[^a-z0-9\-]/g,
    TAG_STARTS_WITH_NUMBER_OR_MINUS: /^[0-9\-]/,
    TAG_CONTAINS_DOT: /\./
};

const RECOMMENDED_TAGS = ["selfies", "gaming", "fantasy", "landscape", "retro", "couples", "technology", "animals", "family", "sport", "holidays", "work", "pets", "abstract", "nude", "friends", "drawing", "vehicules", "events", "hobbies", "art", "myself", "fun", "intro", "travel", "fashion", "nature", "space", "comics"];

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

const validateTitle = (title) => {
    if (!title || !title.trim()) {
        return { valid: false, error: "Title is required" };
    }
    if (title.length > VALIDATION.TITLE_MAX_LENGTH) {
        return { valid: false, error: t("components.new_post.title_must_be_characters_or_less_currently", {
                TITLE_MAX_LENGTH: VALIDATION.TITLE_MAX_LENGTH,
                title_count: title.length
            }) };
    }
    return { valid: true, error: null };
};

const validateDescription = (description) => {
    if (!description || !description.trim()) {
        return { valid: false, error: "Description is required" };
    }
    if (description.length > VALIDATION.DESCRIPTION_MAX_LENGTH) {
        return { valid: false, error: t("components.new_post.description_must_be_characters_or_less_currently", {
                DESCRIPTION_MAX_LENGTH: VALIDATION.DESCRIPTION_MAX_LENGTH,
                description_count: description.length
            }) };
    }
    return { valid: true, error: null };
};

const validateSingleTag = (tag) => {
    if (!tag || tag.length < VALIDATION.TAG_MIN_LENGTH) {
        return { valid: false, error: t("words.tag_must_be_at_least_tag_min", {
                TAG_MIN_LENGTH: VALIDATION.TAG_MIN_LENGTH
            }) };
    }
    if (VALIDATION.TAG_STARTS_WITH_NUMBER_OR_MINUS.test(tag)) {
        return { valid: false, error: "Tag cannot begin with a number or minus sign" };
    }
    if (VALIDATION.TAG_CONTAINS_DOT.test(tag)) {
        return { valid: false, error: "Tag cannot contain dots" };
    }
    if (!VALIDATION.TAG_PATTERN.test(tag)) {
        return { valid: false, error: "Tag can only contain lowercase letters, numbers, and hyphens" };
    }
    return { valid: true, error: null };
};

const validateTags = (tags) => {
    if (!tags || tags.length < VALIDATION.TAGS_MIN_COUNT) {
        return { valid: false, error: t("components.new_post.at_least_tag_is_required", {
                TAGS_MIN_COUNT: VALIDATION.TAGS_MIN_COUNT
            }) };
    }
    if (tags.length > VALIDATION.TAGS_MAX_COUNT) {
        return { valid: false, error: t("words.maximum_tags_max_count_tags_allowed", {
                TAGS_MAX_COUNT: VALIDATION.TAGS_MAX_COUNT
            }) };
    }

    for (const tag of tags) {
        const tagValidation = validateSingleTag(tag);
        if (!tagValidation.valid) {
            return { valid: false, error: `Tag "${tag}": ${tagValidation.error}` };
        }
    }

    return { valid: true, error: null };
};

const validateAllFields = (title, description, tags) => {
    const errors = {};

    const titleValidation = validateTitle(title);
    if (!titleValidation.valid) {
        errors.title = titleValidation.error;
    }

    const descriptionValidation = validateDescription(description);
    if (!descriptionValidation.valid) {
        errors.description = descriptionValidation.error;
    }

    const tagsValidation = validateTags(tags);
    if (!tagsValidation.valid) {
        errors.tags = tagsValidation.error;
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors
    };
};

// ============================================================================
// PERMLINK GENERATOR
// ============================================================================

const generatePermlink = (title) => {

    const timestamp = Date.now();
    const sanitized = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 24);
    return `${sanitized}-${timestamp}`;
};

const styles = theme => ({
    dialog: {
        "& .MuiDialogContent-root": {
            padding: "24px 24px 0px 24px"
        },
        "& div.MuiPaper-rounded.MuiDialog-paper": {
            width: "min(calc(100% - 64px), 800px)",
            maxWidth: "none",
            '@media (max-width: 864px)': {
                width: "100%",
                maxWidth: "none",
                margin: "none"
            }
        }
    },
    dropZone: {
        width: "100%",
        height: "100%",
        minHeight: "384px",
        maxHeight: "70vh",
        border: "2px dashed #555",
        textAlign: "center",
        verticalAlign: "middle",
        backgroundColor: "transparent",
        transition: "all 225ms cubic-bezier(0.4, 0, 0.2, 1) 225ms",
        position: "relative",
        overflow: "hidden"
    },
    dropZoneActive: {
        width: "100%",
        height: "100%",
        minHeight: "384px",
        border: "2px solid #555",
        textAlign: "center",
        verticalAlign: "middle",
        backgroundColor: "rgba(255, 255, 255, 0.07)",
        transition: "all 225ms cubic-bezier(0.4, 0, 0.2, 1) 25ms",
        position: "relative",
        overflow: "hidden"
    },
    whiteDialog: {
        backgroundColor: "#fff !important",
        color: "#000 !important",
        boxShadow: "0px 11px 15px -7px rgb(255 255 255 / 20%), 0px 24px 38px 3px rgb(255 255 255 / 14%), 0px 9px 46px 8px rgb(255 255 255 / 12%) !important",
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
        },
        "& .MuiRadio-colorPrimary.Mui-checked, & .MuiCheckbox-colorPrimary.Mui-checked, & .MuiRadio-colorSecondary.Mui-checked": {
            color: "#000 !important"
        },
        "& .MuiRadio-root, & .MuiFormLabel-root.Mui-focused, .MuiTypography-root": {
            color: "#000 !important",
        },
        "& .MuiSlider-root": {
            color: "#000 !important",
        },
        "& span.MuiSlider-valueLabel > span > span": {
            color: "#fff !important",
        },
        "& .MuiSlider-markLabelActive": {
            color: "#000"
        },
        "& .MuiSlider-markLabel": {
            color: "rgb(0 0 0 / 70%)"
        }
    },
    tagPopper: {
        backgroundColor: "#242424ff !important",
    },
    inputImage: {
        margin: "0px",
        borderRadius: "12px",
        width: "100%",
        height: "100%",
        objectFit: "contain",
        userSelect: "none",
        filter: "grayscale(1) contrast(.8) brightness(0.55) opacity(0.65) blur(8px)",
        transition: "filter 400ms cubic-bezier(0.4, 0, 0.2, 1) 25ms !important",
        animationName: "$opacity-create",
        animationTimingFunction: "ease-in-out",
        animationDuration: "2400ms",
        animationFillMode: "both",
        animationDelay: "1200ms",
        animationDirection: "alternate",
        animationIterationCount: "infinite",
        "@global": {
            "@keyframes opacity-create": {
                "0%": {opacity: "0.666"},
                "100%": {opacity: "1.000"},
            }
        },
        "&:hover": {
            filter: "grayscale(0.15) contrast(.8) brightness(0.6) opacity(0.7) blur(0px)"
        }
    },
    licenseSection: {
        marginBottom: 16
    },
    licensePaper: {
        padding: theme.spacing(2),
        backgroundColor: "#191919",
        borderRadius: "16px",
        border: "1px solid #333"
    },
    licenseHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: theme.spacing(2)
    },
    licenseTitle: {
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(1),
        fontWeight: 600,
        fontSize: "1.1rem"
    },
    licenseSummary: {
        marginTop: theme.spacing(1),
        padding: theme.spacing(1.5),
        backgroundColor: "#0f0f0f",
        borderRadius: "12px",
        fontSize: "0.875rem",
        color: "#bbb"
    },
    licenseStat: {
        display: "flex",
        justifyContent: "space-between",
        marginBottom: theme.spacing(0.5),
        "&:last-child": {
            marginBottom: 0
        }
    },
    licenseStatLabel: {
        color: "#999",
        fontWeight: 500
    },
    licenseStatValue: {
        color: "#fff",
        fontWeight: 400,
    },
    configuredChip: {
        backgroundColor: "#aaa",
        color: "#ffffff",
        fontWeight: 600
    },
    comparisonContainer: {
        position: "relative",
        width: "100%"
    },
    comparisonCanvas: {
        borderRadius: "12px",
        width: "100%",
        transition: "opacity 300ms ease-in-out"
    },
    comparisonButton: {
        position: "absolute",
        top: 16,
        right: 16,
        padding: "6px",
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        color: "#fff",
        "&:hover": {
            backgroundColor: "rgba(0, 0, 0, 0.6)"
        }
    },
    loadingIndicator: {
        position: "absolute",
        top: 12,
        left: 12,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        color: "#fff",
        padding: "4px 12px",
        borderRadius: "16px",
        fontSize: "0.75rem",
        display: "flex",
        alignItems: "center",
        gap: 4
    },
    cardTabs: {
        backgroundColor: "#171717",
        "& .MuiTab-root": {
            minWidth: "72px !important"
        },
        // Icon + label side by side at the original 48px tab height (MUI's
        // labelIcon default is 72px with the icon stacked on top, which
        // would break the 48px pill indicator). On narrow screens the icons
        // step aside so the labels always fit on one line.
        "& .MuiTab-labelIcon": {
            minHeight: "48px",
            paddingTop: "6px"
        },
        "& .MuiTab-wrapper": {
            flexDirection: "row",
            gap: "8px"
        },
        "& .MuiTab-wrapper > *:first-child": {
            marginBottom: "0px !important"
        },
        '@media (max-width: 704px)': {
            "& .MuiTab-wrapper svg": {
                display: "none"
            }
        },
        "& .MuiTab-textColorPrimary.Mui-selected": {
            backgroundColor: "transparent",
        },
        "& .MuiTab-textColorPrimary.Mui-selected .MuiTab-wrapper": {
            color: "#171717 !important",
            zIndex: 1,
        },
        "& .MuiTab-fullWidth": {
            backgroundColor: "transparent",
            color: "#989898",
            transition: "all 225ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
            borderRadius: "21px"
        },
        "& .MuiTab-fullWidth:hover": {
            backgroundColor: "rgba(255,255,255,0.06)"
        },
        "& span.MuiTabs-indicator": {
            height: "48px",
            backgroundColor: "#c7c7c7",
            borderRadius: "21px",
            transform: "scale3d(0.875, 0.75, 1)"
        },
        margin: "0px 0px 24px 0px",
        width: "100%",
        borderRadius: "21px",
        top: 0,
        left: 0,
        zIndex: 1,
        transition: "transform 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
    },
    sendButton: {
        padding: "8px",
        color: "#fff",
        "&:disabled": {
            color: "#555"
        }
    },
    descriptionField: {
        "& .MuiOutlinedInput-root": {
            paddingRight: "4px"
        },
        "& .MuiInputAdornment-root.MuiInputAdornment-positionEnd": {
            marginRight: "16px"
        }
    },
    quantizedMessage: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: theme.spacing(2)
    },
    aspectRatioContainer: {
        marginTop: theme.spacing(2),
        marginBottom: theme.spacing(2)
    },
    aspectRatioColumn: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: theme.spacing(1)
    },
    aspectRatioLabel: {
        fontSize: "0.875rem",
        color: "#999",
        fontWeight: 500,
        marginBottom: theme.spacing(0.5)
    },
    aspectRatioButtonGroup: {
        "& .MuiButton-root": {
            color: "#ccc",
            "&:hover": {
                color: "#fff",
                backgroundColor: "rgba(255,255,255,0.15)"
            }
        },
        "& .MuiButton-contained": {
            color: "#000",
            backgroundColor: "rgba(255,255,255,0.95)",
            "&:hover": {
                color: "#171717 !important",
                backgroundColor: "rgba(255,255,255,0.85) !important"
            }
        }
    },
    sliderContainer: {
        marginTop: theme.spacing(3),
        padding: theme.spacing(2, 2, 4, 2),
        backgroundColor: "#101010",
        borderRadius: "21px 21px 0px 0px"
    },
    sliderLabel: {
        fontSize: "0.875rem",
        color: "#bbb",
        marginBottom: theme.spacing(1),
        fontWeight: 500
    },
    sliderHint: {
        fontSize: "0.75rem",
        color: "#888",
        marginTop: theme.spacing(2)
    },
    // Greyscale error styles
    errorText: {
        color: "#888",
        fontSize: "0.75rem",
        marginTop: theme.spacing(0.5),
        marginLeft: theme.spacing(1.5)
    },
    errorField: {
        "& .MuiOutlinedInput-root": {
            "& fieldset": {
                borderColor: "#666"
            },
            "&:hover fieldset": {
                borderColor: "#888"
            },
            "&.Mui-focused fieldset": {
                borderColor: "#888"
            }
        },
        "& .MuiFormLabel-root.Mui-error": {
            color: "#888"
        },
        "& .MuiOutlinedInput-root.Mui-error .MuiOutlinedInput-notchedOutline": {
            borderColor: "#666"
        }
    },
    charCounter: {
        color: "#666",
        fontSize: "0.75rem",
        textAlign: "right",
        marginTop: theme.spacing(0.5)
    },
    charCounterWarning: {
        color: "#888"
    },
    charCounterError: {
        color: "#aaa"
    },
    publishConfirmContent: {
        "& .MuiTypography-root": {
            color: "#333 !important"
        }
    },
    publishSummaryItem: {
        display: "flex",
        justifyContent: "space-between",
        padding: theme.spacing(1, 0),
        borderBottom: "1px solid #eee",
        "&:last-child": {
            borderBottom: "none"
        }
    },
    publishSummaryLabel: {
        color: "#666",
        fontWeight: 500
    },
    publishSummaryValue: {
        color: "#333",
        fontWeight: 400,
        maxWidth: "60%",
        textAlign: "right",
        wordBreak: "break-word"
    },
    nsfwSwitch: {
        marginTop: theme.spacing(2),
        marginBottom: theme.spacing(2),
        padding: theme.spacing(1.5),
        borderRadius: "21px",
        border: "1px solid #333"
    },

    // ── AI conversion loader (big spinner + sparkles) ──────────────────────
    // Star "pop" twinkle: born at scale(0)/opacity(0), bounces up past
    // scale(1.1)/opacity(1), then recedes so it can sparkle again. The
    // translate(-50%, -50%) is baked into every keyframe so each star stays
    // centred on its top/left anchor while it scales — a transform set on the
    // element itself would be clobbered by the animation's own transform.
    "@keyframes pixaStarPop": {
        "0%":   { opacity: 0,    transform: "translate(-50%, -50%) scale(0)" },
        "45%":  { opacity: 1,    transform: "translate(-50%, -50%) scale(1.1)" },
        "62%":  { opacity: 1,    transform: "translate(-50%, -50%) scale(0.84)" },
        "78%":  { opacity: 0.9,  transform: "translate(-50%, -50%) scale(1.04)" },
        "100%": { opacity: 0,    transform: "translate(-50%, -50%) scale(0)" }
    },
    // Continuous orbit for the comet layer (a whole square SVG rotated about
    // its own box centre, which coincides with the ring centre).
    "@keyframes pixaSpin": {
        "0%":   { transform: "rotate(0deg)" },
        "100%": { transform: "rotate(360deg)" }
    },
    // Gentle overall breathe so the loader feels alive.
    "@keyframes pixaBreathe": {
        "0%, 100%": { opacity: 0.9 },
        "50%":      { opacity: 1 }
    },
    loaderOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        animation: "$pixaBreathe 3.4s ease-in-out infinite"
    },
    // Square box that the ring + sparkles live in — as tall as the dropzone
    // allows (so the spinner is huge) while staying square and never wider
    // than the box.
    loaderSquare: {
        position: "relative",
        height: "86%",
        aspectRatio: "1 / 1",
        maxWidth: "92%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
    },
    // Ring + comet are inset to 82% of the square (9% margin all round) so the
    // sparkles, which sit out near the square's edges, clear the ring instead of
    // overlapping it. Shrink/grow this pair together to keep them aligned.
    loaderRing: {
        position: "absolute",
        top: "9%",
        left: "9%",
        width: "82%",
        height: "82%",
        overflow: "visible",
        filter: "drop-shadow(0 0 12px rgba(255,255,255,0.18))"
    },
    loaderComet: {
        position: "absolute",
        top: "9%",
        left: "9%",
        width: "82%",
        height: "82%",
        overflow: "visible",
        transformOrigin: "50% 50%",
        animation: "$pixaSpin 1.25s linear infinite",
        filter: "drop-shadow(0 0 7px rgba(255,255,255,0.55))",
        willChange: "transform"
    },
    loaderStar: {
        position: "absolute",
        color: "#ffffff",
        pointerEvents: "none",
        transform: "translate(-50%, -50%) scale(0)",
        animationName: "$pixaStarPop",
        animationTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        animationIterationCount: "infinite",
        animationFillMode: "both",
        filter: "drop-shadow(0 0 5px rgba(255,255,255,0.55))",
        willChange: "transform, opacity"
    },
    loaderTextWrap: {
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "66%",
        textAlign: "center",
        pointerEvents: "none",
        userSelect: "none"
    },
    loaderTitle: {
        color: "#ffffff",
        textTransform: "uppercase",
        fontWeight: 700,
        lineHeight: 1.05,
        letterSpacing: "0.14em",
        fontSize: "clamp(17px, 3.1vmin, 30px)",
        textShadow: "0 1px 16px rgba(0,0,0,0.55)"
    },
    loaderSubtitle: {
        marginTop: "0.6em",
        color: "rgba(255,255,255,0.82)",
        fontWeight: 400,
        lineHeight: 1.25,
        letterSpacing: "0.01em",
        fontSize: "clamp(11px, 1.75vmin, 15px)",
        textShadow: "0 1px 12px rgba(0,0,0,0.65)",
        minHeight: "2.5em"
    },
    loaderPercent: {
        position: "absolute",
        bottom: "14px",
        right: "18px",
        zIndex: 13,
        color: "#ffffff",
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "0.04em",
        fontSize: "clamp(13px, 2vmin, 18px)",
        textShadow: "0 1px 12px rgba(0,0,0,0.7)",
        pointerEvents: "none"
    }
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Safe URL revoke helper
const safeRevokeURL = (url) => {
    if (url && typeof url === 'string' && url.startsWith('blob:')) {
        try {
            URL.revokeObjectURL(url);
        } catch (e) {
            // Ignore revocation errors
        }
    }
};

// Check if image is already optimal for pixel art
const checkIfImageIsOptimal = (preview, maxDimension = 160, maxColors = 64) => {
    if (!preview || !preview.width || !preview.height || !preview.data) {
        return false;
    }

    if (preview.width > maxDimension || preview.height > maxDimension) {
        return false;
    }

    const colorSet = new Set();
    const data = preview.data;

    for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a > 0) {
            const colorKey = `${data[i]},${data[i + 1]},${data[i + 2]}`;
            colorSet.add(colorKey);
            if (colorSet.size > maxColors) {
                return false;
            }
        }
    }

    return true;
};

// Percentage to transformation steps (0% -> 5, 100% -> 15)
const percentToTransformationSteps = (percent) => Math.round(5 + (percent / 100) * 10);

// Percentage to fidelity (0% -> 0.05, 100% -> 0.30)
const percentToFidelity = (percent) => 0.05 + (percent / 100) * 0.45;

// Extract image file from event (cross-browser: files, items, and input sources)
const extractImageFile = (event) => {
    // 1. dataTransfer.files (Firefox, Chrome, Edge)
    const dtFiles = event?.dataTransfer?.files;
    if (dtFiles && dtFiles.length > 0) {
        for (let i = 0; i < dtFiles.length; i++) {
            if (dtFiles[i]?.type?.startsWith('image/')) return dtFiles[i];
        }
        if (dtFiles[0]) return dtFiles[0];
    }

    // 2. dataTransfer.items (Safari/WebKit may only expose items)
    const dtItems = event?.dataTransfer?.items;
    if (dtItems && dtItems.length > 0) {
        for (let i = 0; i < dtItems.length; i++) {
            if (dtItems[i]?.kind === 'file' && dtItems[i]?.type?.startsWith('image/')) {
                const file = dtItems[i].getAsFile?.();
                if (file) return file;
            }
        }
        for (let i = 0; i < dtItems.length; i++) {
            if (dtItems[i]?.kind === 'file') {
                const file = dtItems[i].getAsFile?.();
                if (file) return file;
            }
        }
    }

    // 3. Standard <input type="file"> sources
    const inputFiles = event?.target?.files ||
        event?.srcElement?.files ||
        event?.currentTarget?.files ||
        event?.path?.[0]?.files ||
        [];

    for (let i = 0; i < inputFiles.length; i++) {
        if (inputFiles[i]?.type?.startsWith('image/')) return inputFiles[i];
    }
    return inputFiles[0] || null;
};

// ============================================================================
// STATE REDUCER
// ============================================================================

const initialState = {
    // Wizard state
    tabValue: 0,
    currentStep: 0,

    // Form data
    title: "",
    description: "",
    tags: [],
    nsfw: false,

    // Validation errors
    validationErrors: {},
    touched: {
        title: false,
        description: false,
        tags: false
    },

    // Image settings
    preferredSize: "L",
    aspectRatio: "1:1",
    transformationPercent: 50,
    fidelityPercent: 50,

    // Canvas/preview data
    preview: null,
    previewCache: {},
    quantizedData: null,
    base64: "",
    processorData: null,
    availableSizes: [],

    // UI states
    dropzoneActive: false,
    message: "We don't store uploaded images",
    inputFileUrl: "",
    inputFile: null,
    showingOriginal: false,
    preloading: false,
    preloadProgress: 0,
    isGenerating: false,
    isImageOptimal: false,
    canvasKey: 0,
    isPublishing: false,

    // Dialog states
    closeConfirmOpen: false,
    useAiOpen: false,
    quantizeDialogOpen: false,
    licenseCustomizationOpen: false,

    // Quantize settings
    quantizeDownscale: 4,
    quantizeColors: 64,

    // License
    //
    // Both fields are initialised to shape-compatible placeholders rather
    // than null. Publish payloads that contain `null` or `undefined` nested
    // fields produce non-deterministic JSON (key order, omitted keys) which
    // caused comment-op signatures to diverge from the serialized bytes the
    // chain reconstructs — the "Missing Posting Authority" error on publish.
    //
    // The mount effect then overwrites licenseCustomization with the real
    // value from createDefaultCustomization() + every right toggled to true,
    // but even if publish fires before that effect runs, the placeholder
    // below is already a complete, serialisable object.
    licenseBase: null,
    licenseCustomization: {
        version: '1.0',
        isCustomized: false,
        rightsConfiguration: { holderRights: {}, visitorRights: {} },
        royaltyPercentage: 0,
        governingLaw: { jurisdiction: '' },
    },

    // Process tracking
    processName: "Click to upload",
    processStart: 0,
    processFinish: 0
};

const actionTypes = {
    SET_FIELD: 'SET_FIELD',
    SET_MULTIPLE: 'SET_MULTIPLE',
    RESET: 'RESET',
    RESET_UPLOAD: 'RESET_UPLOAD',
    SET_PREVIEW_DATA: 'SET_PREVIEW_DATA',
    CACHE_PREVIEW: 'CACHE_PREVIEW',
    SET_PROCESS: 'SET_PROCESS',
    INCREMENT_CANVAS_KEY: 'INCREMENT_CANVAS_KEY',
    SET_VALIDATION_ERROR: 'SET_VALIDATION_ERROR',
    CLEAR_VALIDATION_ERROR: 'CLEAR_VALIDATION_ERROR',
    SET_TOUCHED: 'SET_TOUCHED',
    VALIDATE_ALL: 'VALIDATE_ALL',
    GO_TO_STEP: 'GO_TO_STEP'
};

const reducer = (state, action) => {
    switch (action.type) {
        case actionTypes.SET_FIELD:
            return { ...state, [action.field]: action.value };

        case actionTypes.SET_MULTIPLE:
            return { ...state, ...action.payload };

        case actionTypes.RESET:
            return {
                ...initialState,
                licenseBase: action.licenseBase,
                licenseCustomization: action.defaultCustomization
            };

        case actionTypes.RESET_UPLOAD:
            // Reset only upload-related state, preserving settings
            return {
                ...state,
                currentStep: 0,
                preview: null,
                previewCache: {},
                quantizedData: null,
                base64: "",
                processorData: null,
                availableSizes: [],
                inputFileUrl: "",
                inputFile: null,
                showingOriginal: false,
                preloading: false,
                preloadProgress: 0,
                isGenerating: false,
                isImageOptimal: false,
                canvasKey: 0,
                quantizeDialogOpen: false,
                quantizeDownscale: 4,
                quantizeColors: 64,
                message: "We don't store uploaded images",
                processName: "Click to upload",
                processStart: 0,
                processFinish: 0
            };

        case actionTypes.SET_PREVIEW_DATA:
            return {
                ...state,
                preview: action.preview,
                previewCache: { [action.sizeName]: action.preview },
                processorData: action.processorData,
                availableSizes: action.availableSizes,
                title: action.title || state.title,
                currentStep: 1,
                processName: "Click to upload",
                processStart: 0,
                processFinish: 0,
                isGenerating: false,
                canvasKey: state.canvasKey + 1
            };

        case actionTypes.CACHE_PREVIEW:
            return {
                ...state,
                previewCache: { ...state.previewCache, [action.sizeName]: action.preview },
                preview: action.setAsCurrent ? action.preview : state.preview,
                canvasKey: action.setAsCurrent ? state.canvasKey + 1 : state.canvasKey
            };

        case actionTypes.SET_PROCESS:
            return {
                ...state,
                processName: action.name,
                processStart: action.start,
                processFinish: action.finish
            };

        case actionTypes.INCREMENT_CANVAS_KEY:
            return { ...state, canvasKey: state.canvasKey + 1 };

        case actionTypes.SET_VALIDATION_ERROR:
            return {
                ...state,
                validationErrors: {
                    ...state.validationErrors,
                    [action.field]: action.error
                }
            };

        case actionTypes.CLEAR_VALIDATION_ERROR:
            const newErrors = { ...state.validationErrors };
            delete newErrors[action.field];
            return { ...state, validationErrors: newErrors };

        case actionTypes.SET_TOUCHED:
            return {
                ...state,
                touched: {
                    ...state.touched,
                    [action.field]: true
                }
            };

        case actionTypes.VALIDATE_ALL:
            return {
                ...state,
                validationErrors: action.errors,
                touched: {
                    title: true,
                    description: true,
                    tags: true
                }
            };

        case actionTypes.GO_TO_STEP:
            return {
                ...state,
                currentStep: action.step,
                canvasKey: state.canvasKey + 1 // Increment to trigger re-render
            };

        default:
            return state;
    }
};

// ============================================================================
// MEMOIZED SUBCOMPONENTS
// ============================================================================

// ── AI conversion loader: copy + sparkle layout ────────────────────────────

// Primary status word at the centre of the spinner (replaces the old
// "COMPUTE"). Single static label — swap the key here. The English source
// text lives in locales/en.js under components.new_post ("Pixifying"); the
// loaderTitle class uppercases it via CSS so every locale stays consistent.
const LOADER_TITLE_KEY = "components.new_post.pixifying";

// Light, rotating sub-line under the title (replaces the old static
// "AI CONVERT"). One is chosen at random to start, then they cycle every
// LOADER_QUIP_MS while the conversion runs. These are translation keys —
// resolved with t() at render time so they follow the active language
// (UploadZone already subscribes via useLanguage()). Keep the copy short —
// it sits inside the ring and wraps to ~2 lines at most.
const LOADER_QUIP_KEYS = [
    "components.new_post.teaching_pixels_some_manners",
    "components.new_post.summoning_tiny_squares",
    "components.new_post.convincing_the_ai_it_went_to_art",
    "components.new_post.herding_stray_pixels",
    "components.new_post.mixing_the_perfect_palette",
    "components.new_post.downscaling_but_make_it_fashion",
    "components.new_post.negotiating_with_the_colour_wheel",
    "components.new_post.polishing_every_little_square",
    "components.new_post.sprinkling_some_8_bit_magic",
    "components.new_post.adding_a_pinch_of_nostalgia",
    "components.new_post.rounding_up_the_right_colours",
    "components.new_post.asking_the_pixels_very_nicely",
    "components.new_post.compressing_reality_gently",
    "components.new_post.buffing_the_retro_shine",
    "components.new_post.almost_suspiciously_pixel_perfect"
];
const LOADER_QUIP_MS = 1900;

// Sparkle positions around the ring, as % of the (square) loader box. Each
// star twinkles on its own delay/duration so the ring shimmers asynchronously.
// `size` is the star's width/height as a % of the box (which is square).
const LOADER_STARS = [
    { top: 13, left: 14, size: 15, delay: 0.0, dur: 2.4 },
    { top: 11, left: 86, size: 11, delay: 0.5, dur: 2.7 },
    { top: 85, left: 17, size: 13, delay: 0.9, dur: 2.5 },
    { top: 70, left: 91, size:  8, delay: 1.4, dur: 2.3 },
    { top:  3, left: 53, size:  9, delay: 0.3, dur: 2.8 },
    { top: 45, left:  3, size:  8, delay: 1.1, dur: 2.5 },
    { top: 30, left: 96, size:  7, delay: 0.7, dur: 2.9 },
    { top: 95, left: 47, size:  9, delay: 1.6, dur: 2.6 }
];

// Concave 4-point "sparkle" glyph (the AI-style twinkle), 0..24 viewBox.
const STAR_PATH = "M12 0.5 Q13.2 10.8 23.5 12 Q13.2 13.2 12 23.5 Q10.8 13.2 0.5 12 Q10.8 10.8 12 0.5 Z";

// Upload Zone Component — visual only, drag/drop is handled by a Portal overlay
const UploadZone = memo(({
                             classes,
                             dropzoneActive,
                             inputFileUrl,
                             loading,
                             processName,
                             loadingPercent,
                             message,
                             onFileUpload
                         }) => {
    useLanguage();
    const inputRef = useRef(null);

    const handleButtonClick = useCallback(() => {
        inputRef.current?.click();
    }, []);

    // "Converting" = the AI pixel-art pipeline is running. `loading` is true
    // while there's time left on the current stage; processName flips away from
    // the idle "Click to upload" the moment a stage starts and is reset back
    // (with currentStep -> 1) once a preview exists — so this also covers the
    // brief 0% / 100% windows where `loading` itself is momentarily false.
    const converting = loading || (!!processName && processName !== "Click to upload");

    // Rotating funny sub-line. Starts on a random quip, then advances every
    // LOADER_QUIP_MS — but only while converting (no timer runs otherwise).
    const [quipIndex, setQuipIndex] = useState(() => Math.floor(Math.random() * LOADER_QUIP_KEYS.length));
    useEffect(() => {
        if (!converting) return;
        const id = setInterval(() => {
            setQuipIndex((i) => (i + 1) % LOADER_QUIP_KEYS.length);
        }, LOADER_QUIP_MS);
        return () => clearInterval(id);
    }, [converting]);

    const pct = Math.round(Math.min(Math.max(loadingPercent, 0) * 100, 100));

    // Big progress ring geometry (viewBox 0..100). The arc grows with pct; a
    // separate comet layer orbits continuously so it always reads as a spinner.
    const R = 45;
    const C = 2 * Math.PI * R;
    const dashOffset = C * (1 - pct / 100);

    return (
        <div>
            <div
                style={{ borderRadius: "21px" }}
                className={dropzoneActive ? classes.dropZoneActive : classes.dropZone}
            >
                {inputFileUrl && (
                    <Fade in timeout={300}>
                        <img
                            src={inputFileUrl}
                            className={classes.inputImage + " pixelated"}
                            alt={t("words.input_image")}
                        />
                    </Fade>
                )}
                <Input
                    inputRef={inputRef}
                    onChange={onFileUpload}
                    inputProps={{ accept: "image/*" }}
                    style={{ display: "none", position: "absolute" }}
                    id="button-file-dialog-secondary"
                    type="file"
                />

                {converting ? (
                    /* ── AI conversion: big centred spinner + sparkles ──────── */
                    (<Fade in timeout={400}>
                        <div className={classes.loaderOverlay}>
                            <div className={classes.loaderSquare}>
                                {/* sparkles bouncing in around the ring */}
                                {LOADER_STARS.map((s, i) => (
                                    <svg
                                        key={i}
                                        className={classes.loaderStar}
                                        viewBox="0 0 24 24"
                                        style={{
                                            top: s.top + "%",
                                            left: s.left + "%",
                                            width: s.size + "%",
                                            height: s.size + "%",
                                            animationDelay: s.delay + "s",
                                            animationDuration: s.dur + "s"
                                        }}
                                    >
                                        <path d={STAR_PATH} fill="currentColor" />
                                    </svg>
                                ))}

                                {/* progress ring (track + determinate arc) */}
                                <svg className={classes.loaderRing} viewBox="0 0 100 100">
                                    <circle
                                        cx="50" cy="50" r={R}
                                        fill="none"
                                        stroke="rgba(255,255,255,0.14)"
                                        strokeWidth="3.2"
                                    />
                                    <circle
                                        cx="50" cy="50" r={R}
                                        fill="none"
                                        stroke="#ffffff"
                                        strokeWidth="3.6"
                                        strokeLinecap="round"
                                        strokeDasharray={C}
                                        strokeDashoffset={dashOffset}
                                        transform="rotate(-90 50 50)"
                                        style={{ transition: "stroke-dashoffset 220ms linear" }}
                                    />
                                </svg>

                                {/* Orbiting comet = the indeterminate spinner. It
                                    only appears once progress reaches 100%, turning
                                    the now-complete ring into a "finalising" spinner.
                                    While progress climbs 0–99% the determinate arc
                                    above carries it alone (no comet). The whole square
                                    SVG spins so the dot/arc track the ring perfectly. */}
                                {pct >= 100 && (
                                    <svg className={classes.loaderComet} viewBox="0 0 100 100">
                                        <path
                                            d="M 34.6 7.7 A 45 45 0 0 1 50 5"
                                            fill="none"
                                            stroke="#ffffff"
                                            strokeWidth="3.6"
                                            strokeLinecap="round"
                                            opacity="0.85"
                                        />
                                        <circle cx="50" cy="5" r="2.9" fill="#ffffff" />
                                    </svg>
                                )}

                                {/* two stacked texts in the centre */}
                                <div className={classes.loaderTextWrap}>
                                    <div className={classes.loaderTitle}>{t(LOADER_TITLE_KEY)}</div>
                                    <Fade key={quipIndex} in appear timeout={450}>
                                        <div className={classes.loaderSubtitle}>
                                            {t(LOADER_QUIP_KEYS[quipIndex])}
                                        </div>
                                    </Fade>
                                </div>
                            </div>

                            {/* progress %, bottom-right */}
                            <div className={classes.loaderPercent}>{pct}%</div>
                        </div>
                    </Fade>)
                ) : (
                    /* ── Idle: the upload affordance ────────────────────────── */
                    (<Fade in timeout={600}>
                        <div style={{
                            pointerEvents: processName !== "Click to upload" ? "none" : "auto",
                            transform: "translate(-50%, -50%)",
                            top: "50%",
                            left: "50%",
                            position: "absolute",
                            display: "inline",
                            zIndex: 10
                        }}>
                            <Fade in timeout={600}>
                                <Button
                                    disabled={processName !== "Click to upload"}
                                    onClick={handleButtonClick}
                                >
                                    <span style={{
                                        fontWeight: "bold",
                                        fontSize: "24px",
                                        verticalAlign: "super",
                                        color: "#999",
                                        marginRight: "16px"
                                    }}>
                                        {processName || "Upload Image"}
                                    </span>
                                    <AddPhotoAlternateIcon style={{ display: "inline", fontSize: 48, color: "#666" }} />
                                </Button>
                            </Fade>
                            <Fade in timeout={900}>
                                <p style={{ textAlign: "center", color: "#a7a7a7" }}>{message}</p>
                            </Fade>
                        </div>
                    </Fade>)
                )}
            </div>
        </div>
    );
}, (prev, next) => (
    prev.dropzoneActive === next.dropzoneActive &&
    prev.inputFileUrl === next.inputFileUrl &&
    prev.loading === next.loading &&
    prev.processName === next.processName &&
    prev.loadingPercent === next.loadingPercent &&
    prev.message === next.message
));

// Aspect Ratio Selector Component
const AspectRatioSelector = memo(({ classes, aspectRatio, onAspectRatioChange, disabled }) => {
    useLanguage();
    const handleChange = useCallback((ratio) => () => {
        onAspectRatioChange(ratio);
    }, [onAspectRatioChange]);

    return (
        <Fade in timeout={600}>
            <Box className={classes.aspectRatioContainer}>
                <Grid container spacing={2}>
                    <Grid item xs={4}>
                        <div className={classes.aspectRatioColumn}>
                            <Typography className={classes.aspectRatioLabel}>{t("components.new_post.squared")}</Typography>
                            <ButtonGroup
                                className={classes.aspectRatioButtonGroup}
                                variant={aspectRatio === "1:1" ? "contained" : "outlined"}
                                fullWidth
                                disabled={disabled}
                            >
                                <Button
                                    variant={aspectRatio === "1:1" ? "contained" : "outlined"}
                                    onClick={handleChange("1:1")}
                                >
                                    1:1
                                </Button>
                            </ButtonGroup>
                        </div>
                    </Grid>
                    <Grid item xs={4}>
                        <div className={classes.aspectRatioColumn}>
                            <Typography className={classes.aspectRatioLabel}>{t("components.new_post.landscape")}</Typography>
                            <ButtonGroup
                                className={classes.aspectRatioButtonGroup}
                                variant="outlined"
                                fullWidth
                                disabled={disabled}
                            >
                                <Button
                                    variant={aspectRatio === "4:3" ? "contained" : "outlined"}
                                    onClick={handleChange("4:3")}
                                >
                                    4:3
                                </Button>
                                <Button
                                    variant={aspectRatio === "16:9" ? "contained" : "outlined"}
                                    onClick={handleChange("16:9")}
                                >
                                    16:9
                                </Button>
                            </ButtonGroup>
                        </div>
                    </Grid>
                    <Grid item xs={4}>
                        <div className={classes.aspectRatioColumn}>
                            <Typography className={classes.aspectRatioLabel}>{t("components.new_post.portrait")}</Typography>
                            <ButtonGroup
                                className={classes.aspectRatioButtonGroup}
                                variant="outlined"
                                fullWidth
                                disabled={disabled}
                            >
                                <Button
                                    variant={aspectRatio === "3:4" ? "contained" : "outlined"}
                                    onClick={handleChange("3:4")}
                                >
                                    3:4
                                </Button>
                                <Button
                                    variant={aspectRatio === "9:16" ? "contained" : "outlined"}
                                    onClick={handleChange("9:16")}
                                >
                                    9:16
                                </Button>
                            </ButtonGroup>
                        </div>
                    </Grid>
                </Grid>
            </Box>
        </Fade>
    );
}, (prev, next) => (
    prev.aspectRatio === next.aspectRatio &&
    prev.disabled === next.disabled
));

// Generation Parameters Component
const GenerationParameters = memo(({
                                       classes,
                                       showFidelity,
                                       transformationPercent,
                                       fidelityPercent,
                                       onTransformationChange,
                                       onFidelityChange,
                                       disabled
                                   }) => {
    useLanguage();
    const handleTransformationChange = useCallback((e, value) => {
        onTransformationChange(value);
    }, [onTransformationChange]);

    const handleFidelityChange = useCallback((e, value) => {
        onFidelityChange(value);
    }, [onFidelityChange]);

    return (
        <Fade in timeout={900}>
            <Box className={classes.sliderContainer}>
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: "24px",
                        ...(showFidelity && {
                            '@media (min-width: 864px)': {
                                flexDirection: 'row',
                                gap: "32px",
                            },
                        }),
                    }}
                >
                    <Box sx={{ flex: 1 }}>
                        <Typography className={classes.sliderLabel}>{t("components.new_post.transformation_strength", {
                            transformationPercent: transformationPercent
                        })}</Typography>
                        <Slider
                            value={transformationPercent}
                            onChange={handleTransformationChange}
                            min={0}
                            max={100}
                            step={10}
                            valueLabelDisplay="auto"
                            valueLabelFormat={(value) => `${value}%`}
                            disabled={disabled}
                        />
                    </Box>

                    {showFidelity && (
                        <Box sx={{ flex: 1 }}>
                            <Typography className={classes.sliderLabel}>{t("components.new_post.conservation_strength", {
                                fidelityPercent: fidelityPercent
                            })}</Typography>
                            <Slider
                                value={fidelityPercent}
                                onChange={handleFidelityChange}
                                min={0}
                                max={100}
                                step={2}
                                valueLabelDisplay="auto"
                                valueLabelFormat={(value) => `${value}%`}
                                disabled={disabled}
                            />
                        </Box>
                    )}
                </Box>
                {showFidelity && (
                    <Typography className={classes.sliderHint}>
                        {t("components.new_post.for_harmonious_results_use_the_same_value")}
                    </Typography>
                )}
            </Box>
        </Fade>
    );
}, (prev, next) => (
    prev.showFidelity === next.showFidelity &&
    prev.transformationPercent === next.transformationPercent &&
    prev.fidelityPercent === next.fidelityPercent &&
    prev.disabled === next.disabled
));

// Canvas Preview Component - Updated to handle canvas rendering internally
const CanvasPreview = memo(({
                                classes,
                                preview,
                                quantizedData,
                                preferredSize,
                                availableSizes,
                                preloading,
                                preloadProgress,
                                showingOriginal,
                                hasProcessorData,
                                originalImageData,
                                onSizeChange,
                                onToggleComparison,
                                onApplyQuantize,
                                onCancelQuantize,
                                onDownload,
                                onOpenEditor,
                                base64Kb,
                                onCanvasReady,
                                canvasKey
                            }) => {
    useLanguage();
    const canvasRef = useRef(null);
    const originalCanvasRef = useRef(null);
    const dataToRender = quantizedData || preview;

    // Render preview canvas when data changes or component mounts
    useLayoutEffect(() => {
        if (!canvasRef.current || !dataToRender || !dataToRender.width) return;

        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");

        canvas.width = dataToRender.width;
        canvas.height = dataToRender.height;
        context.putImageData(dataToRender, 0, 0);

        // Notify parent that canvas is ready for base64 encoding
        if (onCanvasReady) {
            onCanvasReady(dataToRender);
        }
    }, [dataToRender, canvasKey, onCanvasReady]);

    // Render original canvas when original data is available
    useLayoutEffect(() => {
        if (!originalCanvasRef.current || !originalImageData) return;

        const canvas = originalCanvasRef.current;
        const context = canvas.getContext("2d");

        canvas.width = originalImageData.width;
        canvas.height = originalImageData.height;
        context.putImageData(originalImageData, 0, 0);
    }, [originalImageData, canvasKey]);

    return (
        <div style={{ position: "relative" }}>
            <FormControl component="fieldset" style={{
                padding: "8px 16px 32px 16px",
                margin: "0px 0px -16px 0px",
                borderRadius: "21px 21px 0px 0px",
                background: "#101010",
                width: "100%",
                top: "0px",
                display: "flow",
                zIndex: 0
            }}>
                {quantizedData ? (
                    <Fade in timeout={600}>
                        <div className={classes.quantizedMessage}>
                            <span style={{ lineHeight: "32px" }}>{t("words.quantization_applied")}</span>
                            <Button variant="text" onClick={onCancelQuantize}>{t("words.cancel", {TUC: true})}</Button>
                        </div>
                    </Fade>
                ) : availableSizes.length === 1 ? (
                    <Fade in timeout={600}>
                        <p style={{ lineHeight: "32px" }}>{t("components.new_post.your_artwork_is_already_optimized_for_pixel")}</p>
                    </Fade>
                ) : (
                    <RadioGroup
                        row
                        defaultValue="top"
                        aria-label="size"
                        name="SIZE"
                        color="primary"
                        value={preferredSize}
                        onChange={onSizeChange}
                    >
                        {availableSizes.map((size, index) => (
                            <Fade key={size} in timeout={200 * (index + 1)}>
                                <FormControlLabel
                                    value={size}
                                    control={<Radio />}
                                    label={size}
                                />
                            </Fade>
                        ))}
                    </RadioGroup>
                )}
            </FormControl>
            <div className={classes.comparisonContainer + " pixelated"} style={{ width: "100%", marginBottom: 16 }}>

                {hasProcessorData && originalImageData && (
                    <canvas
                        className={classes.comparisonCanvas}
                        ref={originalCanvasRef}
                        width={originalImageData.width}
                        height={originalImageData.height}
                        style={{
                            borderRadius: "21px",
                            width: "100%",
                            opacity: !dataToRender ? 0: 1,
                            position: showingOriginal ? "relative" : "absolute",
                            pointerEvents: showingOriginal ? "auto" : "none",
                            top: 0,
                            left: 0
                        }}
                    />
                )}

                {dataToRender && (
                    <canvas
                        className={classes.comparisonCanvas}
                        ref={canvasRef}
                        width={dataToRender.width}
                        height={dataToRender.height}
                        style={{
                            borderRadius: "21px",
                            width: "100%",
                            opacity: showingOriginal ? 0 : 1,
                            position: showingOriginal ? "absolute" : "relative",
                            pointerEvents: showingOriginal ? "none" : "auto",
                            top: showingOriginal ? 0 : "auto",
                            left: showingOriginal ? 0 : "auto"
                        }}
                    />
                )}

                {preloading && (
                    <div className={classes.loadingIndicator}>
                        <CircularProgress size={12} style={{ color: "#fff" }} />
                        <span>{t("components.new_post.preloading", {
                            round: Math.round(preloadProgress)
                        })}</span>
                    </div>
                )}

                {hasProcessorData && originalImageData && (
                    <IconButton
                        className={classes.comparisonButton}
                        onClick={onToggleComparison}
                        size="small"
                    >
                        <CompareIcon />
                    </IconButton>
                )}
            </div>
            <div style={{
                padding: "64px 8px 16px 8px",
                textAlign: "right",
                position: "absolute",
                borderRadius: "0px 0px 21px 21px",
                background: "linear-gradient(0deg, #101010cf 20%, #10101075 60%, #10101000 90%)",
                width: "100%",
                bottom: "0px",
                zIndex: 10
            }}>
                <Fade in timeout={600}>
                    <Button variant="text" style={{ color: "#ffffff88" }} onClick={onApplyQuantize}>
                        {quantizedData ? "ADJUST" : "QUANTIZE"}
                    </Button>
                </Fade>
                <Fade in timeout={800}>
                    <Button variant="text" style={{ color: "#ffffff88" }} onClick={onDownload}>{t("components.new_post.download_kb", {
                        base64Kb: base64Kb.toFixed(2)
                    })}</Button>
                </Fade>
                <Fade in timeout={1000}>
                    <Button variant="text" style={{ color: "#ffffff88" }} onClick={onOpenEditor}>
                        {t("components.new_post.open_editor")}
                    </Button>
                </Fade>
            </div>
        </div>
    );
}, (prev, next) => (
    prev.preview === next.preview &&
    prev.quantizedData === next.quantizedData &&
    prev.preferredSize === next.preferredSize &&
    prev.preloading === next.preloading &&
    prev.preloadProgress === next.preloadProgress &&
    prev.showingOriginal === next.showingOriginal &&
    prev.base64Kb === next.base64Kb &&
    prev.availableSizes === next.availableSizes &&
    prev.hasProcessorData === next.hasProcessorData &&
    prev.originalImageData === next.originalImageData &&
    prev.canvasKey === next.canvasKey
));

// License Section Component
const LicenseSection = memo(({
                                 classes,
                                 licenseCustomization,
                                 onOpenLicense
                             }) => {
    useLanguage();
    const isLicenseCustomized = licenseCustomization?.isCustomized;

    const licenseSummary = useMemo(() => {
        if (!licenseCustomization?.rightsConfiguration) {
            return { holderRights: 0, visitorRights: 0, royalty: 0 };
        }

        const holderRights = Object.values(licenseCustomization.rightsConfiguration.holderRights || {})
            .filter(v => v === true).length;
        const visitorRights = Object.values(licenseCustomization.rightsConfiguration.visitorRights || {})
            .filter(v => v === true).length;
        const royalty = licenseCustomization.royaltyPercentage || 0;

        return { holderRights, visitorRights, royalty };
    }, [licenseCustomization]);

    return (
        <div className={classes.licenseSection}>
            <Paper className={classes.licensePaper}>
                <div className={classes.licenseHeader}>
                    <Typography className={classes.licenseTitle}>
                        <GavelIcon />
                        {t("words.nft_license")}
                    </Typography>
                    {isLicenseCustomized && (
                        <Chip
                            icon={<CheckCircleIcon />}
                            label={t("words.configured")}
                            size="small"
                            className={classes.configuredChip}
                        />
                    )}
                </div>

                <Typography variant="body2" style={{ color: "#bbb", marginBottom: 16 }}>
                    {t("components.new_post.configure_usage_rights_and_terms_for_your")}
                </Typography>

                {licenseCustomization && (
                    <div className={classes.licenseSummary}>
                        <div className={classes.licenseStat}>
                            <span className={classes.licenseStatLabel}>{t("components.new_post.holder_rights")}</span>
                            <span className={classes.licenseStatValue}>
                                {licenseSummary.holderRights} granted
                            </span>
                        </div>
                        <div className={classes.licenseStat}>
                            <span className={classes.licenseStatLabel}>{t("components.new_post.visitor_rights")}</span>
                            <span className={classes.licenseStatValue}>
                                {licenseSummary.visitorRights} granted
                            </span>
                        </div>
                        <div className={classes.licenseStat}>
                            <span className={classes.licenseStatLabel}>{t("words.royalty")}</span>
                            <span className={classes.licenseStatValue}>
                                {licenseSummary.royalty}%
                            </span>
                        </div>
                        <div className={classes.licenseStat}>
                            <span className={classes.licenseStatLabel}>{t("words.jurisdiction")}</span>
                            <span className={classes.licenseStatValue}>
                                {licenseCustomization.governingLaw?.jurisdiction || 'Not set'}
                            </span>
                        </div>
                    </div>
                )}

                <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    style={{ marginTop: 8 }}
                    onClick={onOpenLicense}
                >
                    {isLicenseCustomized ? 'Edit License' : 'Configure License'}
                </Button>
            </Paper>
        </div>
    );
}, (prev, next) => (
    prev.licenseCustomization === next.licenseCustomization
));

// Publish Form Component with Validation
const PublishForm = memo(({
                              classes,
                              title,
                              description,
                              tags,
                              base64,
                              nsfw,
                              licenseCustomization,
                              validationErrors,
                              touched,
                              onTitleChange,
                              onDescriptionChange,
                              onTagsChange,
                              trendingTags,
                              onNsfwChange,
                              nsfwDetecting,
                              nsfwAutoFlagged,
                              onOpenLicense,
                              onFieldBlur
                          }) => {
    useLanguage();

    const titleCharCount = title.length;
    const descriptionCharCount = description.length;

    const getTitleCharCounterClass = () => {
        if (titleCharCount > VALIDATION.TITLE_MAX_LENGTH) return classes.charCounterError;
        if (titleCharCount > VALIDATION.TITLE_MAX_LENGTH * 0.8) return classes.charCounterWarning;
        return classes.charCounter;
    };

    const getDescriptionCharCounterClass = () => {
        if (descriptionCharCount > VALIDATION.DESCRIPTION_MAX_LENGTH) return classes.charCounterError;
        if (descriptionCharCount > VALIDATION.DESCRIPTION_MAX_LENGTH * 0.8) return classes.charCounterWarning;
        return classes.charCounter;
    };

    return (
        <Fade in timeout={300}>
            <div>
                <TextField
                    style={{ marginTop: 8 }}
                    value={title}
                    fullWidth
                    label={t("components.new_post.title")}
                    variant="outlined"
                    onChange={onTitleChange}
                    onBlur={() => onFieldBlur('title')}
                    error={touched.title && !!validationErrors.title}
                    className={touched.title && validationErrors.title ? classes.errorField : ''}
                    inputProps={{ maxLength: VALIDATION.TITLE_MAX_LENGTH + 10 }}
                />
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    {touched.title && validationErrors.title ? (
                        <Typography className={classes.errorText}>
                            {validationErrors.title}
                        </Typography>
                    ) : <span />}
                    <Typography className={getTitleCharCounterClass()}>
                        {titleCharCount}/{VALIDATION.TITLE_MAX_LENGTH}
                    </Typography>
                </Box>
                <ToxicityWatcher text={title} label="title" />

                <TextField
                    style={{ marginTop: 16 }}
                    label={t("components.new_post.content")}
                    multiline
                    rows={1}
                    defaultValue={base64}
                    variant="filled"
                    disabled
                    fullWidth
                />
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Typography className={classes.errorText}>
                        {t("components.new_post.encoded_image")}
                    </Typography>
                    <Typography className={getDescriptionCharCounterClass()}>
                        {base64 ? `${(base64.length / 1000 * 3 / 4).toFixed(2)} kB` : ''}
                    </Typography>
                </Box>
                <TextField
                    style={{ marginTop: 16 }}
                    label={t("words.description")}
                    multiline
                    minRows={6}
                    value={description}
                    onChange={onDescriptionChange}
                    onBlur={() => onFieldBlur('description')}
                    variant="outlined"
                    fullWidth
                    error={touched.description && !!validationErrors.description}
                    className={touched.description && validationErrors.description ? classes.errorField : ''}
                    inputProps={{ maxLength: VALIDATION.DESCRIPTION_MAX_LENGTH + 100 }}
                />
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    {touched.description && validationErrors.description ? (
                        <Typography className={classes.errorText}>
                            {validationErrors.description}
                        </Typography>
                    ) : <span />}
                    <Typography className={getDescriptionCharCounterClass()}>
                        {descriptionCharCount}/{VALIDATION.DESCRIPTION_MAX_LENGTH}
                    </Typography>
                </Box>
                <ToxicityWatcher text={description} label="description" />

                <Box style={{ marginTop: 16, marginBottom: 8 }}>
                    <Autocomplete
                        multiple
                        freeSolo
                        classes={{ paper: classes.tagPopper }}
                        value={tags}
                        onChange={(e, newValue, reason) => {
                            if (reason === 'select-option' || reason === 'create-option') {
                                const lastTag = newValue[newValue.length - 1];
                                const raw = typeof lastTag === 'string' ? lastTag : (lastTag && lastTag.label || '');
                                const normalized = raw.toLowerCase().trim();
                                const validation = validateSingleTag(normalized);
                                if (!validation.valid) return;
                                if (tags.includes(normalized)) return;
                                onTagsChange([...tags, normalized]);
                            } else if (reason === 'remove-option') {
                                onTagsChange(newValue.filter(t => typeof t === 'string'));
                            } else if (reason === 'clear') {
                                onTagsChange([]);
                            }
                        }}
                        filterOptions={(options, params) => {
                            const input = (params.inputValue || '').toLowerCase().trim();
                            if (!input) return [];
                            const pool = [...new Set([...trendingTags, ...RECOMMENDED_TAGS])];
                            const filtered = pool
                                .filter(t => t.startsWith(input) && !tags.includes(t) && t !== input)
                                .slice(0, 4);
                            const inputValid = validateSingleTag(input).valid;
                            const result = [];
                            if (input && !tags.includes(input)) {
                                result.push({ label: input, isCustom: true, disabled: !inputValid });
                            }
                            filtered.forEach(t => result.push({ label: t, isCustom: false, disabled: false }));
                            return result;
                        }}
                        getOptionLabel={(option) => typeof option === 'string' ? option : option.label || ''}
                        getOptionDisabled={(option) => typeof option === 'object' && option.disabled}
                        renderOption={(option) => (
                            <span style={{ opacity: option.disabled ? 0.75 : 1 }}>
                                <span style={{ color: '#666', marginRight: 2 }}>#</span>{option.label}
                                {option.isCustom && !option.disabled && <span style={{ color: '#888', marginLeft: 8, fontSize: 12 }}>{t("components.new_post.new_tag")}</span>}
                                {option.disabled && <span style={{ color: '#888', marginLeft: 8, fontSize: 12 }}>{t("components.new_post.must_start_with_a_letter_min_4")}</span>}
                            </span>
                        )}
                        options={RECOMMENDED_TAGS}
                        renderTags={(value, getTagProps) =>
                            value.map((tag, index) => (
                                <Chip key={tag} label={<span><span style={{ color: '#888', marginRight: 2 }}>#</span>{tag}</span>} {...getTagProps({ index })} />
                            ))
                        }
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                variant="outlined"
                                label={t("words.tags")}
                                placeholder={tags.length < VALIDATION.TAGS_MAX_COUNT ? "Add tag and press Enter" : ""}
                                onBlur={() => onFieldBlur('tags')}
                                error={touched.tags && !!validationErrors.tags}
                                className={touched.tags && validationErrors.tags ? classes.errorField : ''}
                            />
                        )}
                    />
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mt={0.5}>
                        {touched.tags && validationErrors.tags ? (
                            <Typography className={classes.errorText}>
                                {validationErrors.tags}
                            </Typography>
                        ) : (
                            <Typography className={classes.charCounter} style={{ color: '#666' }}>
                                {t("components.new_post.tags_lowercase_no_dots_min_4_chars")}
                            </Typography>
                        )}
                        <Typography className={tags.length > VALIDATION.TAGS_MAX_COUNT ? classes.charCounterError : classes.charCounter}>
                            {tags.length}/{VALIDATION.TAGS_MAX_COUNT}
                        </Typography>
                    </Box>
                </Box>

                <Box className={classes.nsfwSwitch}>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={nsfw}
                                onChange={onNsfwChange}
                                color="primary"
                            />
                        }
                        label={
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                {t("words.not_safe_for_work")}
                                {nsfwDetecting && (
                                    <CircularProgress size={12} thickness={5} style={{ color: '#888' }} />
                                )}
                            </span>
                        }
                    />
                    <Typography variant="caption" style={{ color: nsfwAutoFlagged ? '#aaa' : '#888', display: 'block', marginLeft: 48 }}>
                        {nsfwDetecting
                            ? 'Analyzing image for sensitive content…'
                            : nsfwAutoFlagged
                                ? 'Automatically flagged from image analysis — turn it off if this is wrong.'
                                : 'Enable this if your content contains mature or sensitive material'}
                    </Typography>
                </Box>

                <LicenseSection
                    classes={classes}
                    licenseCustomization={licenseCustomization}
                    onOpenLicense={onOpenLicense}
                />
            </div>
        </Fade>
    );
}, (prev, next) => (
    prev.title === next.title &&
    prev.description === next.description &&
    prev.tags === next.tags &&
    prev.base64 === next.base64 &&
    prev.nsfw === next.nsfw &&
    prev.nsfwDetecting === next.nsfwDetecting &&
    prev.nsfwAutoFlagged === next.nsfwAutoFlagged &&
    prev.licenseCustomization === next.licenseCustomization &&
    prev.validationErrors === next.validationErrors &&
    prev.touched === next.touched
));

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function NewPost(props) {
    const { classes, open, onClose, api } = props;

    // Use reducer for complex state management
    const [state, dispatch] = useReducer(reducer, initialState);

    // Refs
    const quantizePreviewCanvasRef = useRef(null);
    const debounceTimeoutRef = useRef(null);
    const preloadTimeoutRef = useRef(null);
    const mountedRef = useRef(true);
    const previousInputUrlRef = useRef(null);
    const dragCounterRef = useRef(0);
    const currentStepRef = useRef(0);
    const inputFileRef = useRef(null);
    const processFileUploadRef = useRef(null);

    // Drag overlay state
    const [isDraggingFile, setIsDraggingFile] = useState(false);

    // Trending tags for suggestions
    const [trendingTags, setTrendingTags] = useState([]);

    // Loading progress tick (for animation)
    const [loadingTick, setLoadingTick] = useState(0);

    // ── NSFW auto-detection (final step) ────────────────────────────────
    // Transient UI flags surfaced in PublishForm. Not part of the publish
    // payload, so kept as local state rather than in the reducer.
    const [nsfwDetecting, setNsfwDetecting] = useState(false);
    const [nsfwAutoFlagged, setNsfwAutoFlagged] = useState(false);
    // Content hash of the image we last auto-classified (so we re-suggest only
    // when the image actually changes), and a guard so a manual switch toggle
    // always wins over the auto-suggestion. Refs persist across the dialog's
    // open/close cycles (this component isn't unmounted between posts), so they
    // are reset when the dialog closes — see the effect below.
    const nsfwDetectedKeyRef = useRef(null);
    const nsfwUserOverrideRef = useRef(false);

    // Destructure state for convenience
    const {
        tabValue, currentStep, title, description, tags, nsfw, preferredSize, aspectRatio,
        transformationPercent, fidelityPercent, preview, previewCache, quantizedData,
        base64, processorData, availableSizes, dropzoneActive, message, inputFileUrl,
        inputFile, showingOriginal, preloading, preloadProgress, isGenerating,
        canvasKey, closeConfirmOpen, useAiOpen, quantizeDialogOpen,
        licenseCustomizationOpen, quantizeDownscale, quantizeColors,
        licenseBase, licenseCustomization, processName, processStart, processFinish,
        validationErrors, touched, isPublishing
    } = state;

    // Computed values
    const now = Date.now();
    const totalTimeMs = processFinish - processStart;
    const spentTimeMs = now - processStart;
    const loadingPercent = totalTimeMs > 0 ? Math.min(spentTimeMs / totalTimeMs, 1) : 0;
    const loading = totalTimeMs > spentTimeMs && totalTimeMs > 0;
    const base64Kb = ((base64 || "").length || 0) / 1000 * 3 / 4;

    // Check if form is valid for publishing
    const isFormValid = useMemo(() => {
        const validation = validateAllFields(title, description, tags);
        return validation.valid && base64;
    }, [title, description, tags, base64]);

    // ========================================================================
    // EFFECTS
    // ========================================================================

    // Initialize license on mount
    useEffect(() => {
        mountedRef.current = true;

        const initLicense = () => {
            const base = PIXA_LICENSE_BASE;
            const defaultCustomization = createDefaultCustomization(base);

            dispatch({
                type: actionTypes.SET_MULTIPLE,
                payload: {
                    licenseBase: base,
                    licenseCustomization: defaultCustomization,
                },
            });
        };

        initLicense();

        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Fetch trending tags for suggestions
    useEffect(() => {
        if (!api || !api.tags || !api.tags.getTrendingTags) return;
        (async () => {
            try {
                const result = await api.tags.getTrendingTags(null, 100);
                if (Array.isArray(result) && result.length > 0) {
                    const names = result
                        .map(t => (typeof t === 'string' ? t : t.name))
                        .filter(n => n && n.length > 0);
                    if (names.length > 0) setTrendingTags(names);
                }
            } catch (e) {
                console.log('[NewPost] Failed to fetch trending tags:', e.message);
            }
        })();
    }, [api]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            safeRevokeURL(inputFileUrl);
            if (preloadTimeoutRef.current) clearTimeout(preloadTimeoutRef.current);
            if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
        };
    }, []);

    // Revoke previous URL when inputFileUrl changes
    useEffect(() => {
        if (previousInputUrlRef.current && previousInputUrlRef.current !== inputFileUrl) {
            safeRevokeURL(previousInputUrlRef.current);
        }
        previousInputUrlRef.current = inputFileUrl;
    }, [inputFileUrl]);

    // Loading progress animation
    useEffect(() => {
        if (loading && processStart > 0 && processFinish > 0) {
            const interval = setInterval(() => {
                if (mountedRef.current) {
                    setLoadingTick(prev => prev + 1);
                }
            }, 100);
            return () => clearInterval(interval);
        }
    }, [loading, processStart, processFinish]);

    // Keep refs in sync for the document-level drag handler (avoids stale closures)
    useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);
    useEffect(() => { inputFileRef.current = inputFile; }, [inputFile]);

    // ── NSFW model warmup ───────────────────────────────────────────────
    // Once the user commits an image and reaches the "Adjust" step, warm the
    // classifier (spawn worker, load model, prime the on-device verdict cache
    // from IndexedDB) in parallel with them adjusting size — so detection on
    // the final step is instant and won't flash a "no verdict yet" spinner for
    // images this device already judged. Best-effort, non-blocking, idempotent;
    // never pulls the heavy import unless the dialog is open and past step 0.
    useEffect(() => {
        if (!open || currentStep < 1) return;
        let cancelled = false;
        loadNsfwDetect().then((mod) => {
            if (cancelled || !mod) return;
            mod.configure({ filterEnabled: true }); // warmup is a no-op while off
            if (mod.warmup) mod.warmup();
        });
        return () => { cancelled = true; };
    }, [open, currentStep]);

    // Reset per-post detection memory when the dialog closes. The guard refs
    // live outside the reducer and survive open/close, so without this a second
    // post in the same session could inherit the previous post's verdict/guard.
    useEffect(() => {
        if (open) return;
        nsfwDetectedKeyRef.current = null;
        nsfwUserOverrideRef.current = false;
        setNsfwAutoFlagged(false);
        setNsfwDetecting(false);
    }, [open]);

    // ── Auto-suggest the NSFW flag on the final ("Post") step ───────────
    // Classify the image being published and flip the switch ON if it's
    // detected as mature/sensitive. This ONLY ever enables the flag — it never
    // clears one the user (or detection) already set — and a manual toggle
    // always wins. Re-suggests when the underlying image changes (keyed by the
    // encoded-image hash); the detector's own cache makes repeat calls cheap.
    useEffect(() => {
        // Only on the final step, and only once we have something to publish.
        if (currentStep !== 2) return;
        if (!base64) return;

        let cancelled = false;

        (async () => {
            const key = nsfwImageKey(base64);

            // Image changed since we last looked → fresh suggestion: drop the
            // manual override so the new image gets auto-evaluated on its own
            // merits. (Same image re-entering step 2 keeps the user's choice.)
            if (nsfwDetectedKeyRef.current !== key) {
                nsfwDetectedKeyRef.current = key;
                nsfwUserOverrideRef.current = false;
                if (mountedRef.current) setNsfwAutoFlagged(false);
            }

            const mod = await loadNsfwDetect();
            if (cancelled || !mod) return;
            mod.configure({ filterEnabled: true }); // detector no-ops while off

            const applyVerdict = (verdict) => {
                if (cancelled || verdict !== true) return;
                if (nsfwUserOverrideRef.current) return; // user owns the value
                dispatch({ type: actionTypes.SET_FIELD, field: 'nsfw', value: true });
                if (mountedRef.current) setNsfwAutoFlagged(true);
            };

            // Fast path: a verdict for this image may already be cached on this
            // device (warmup primes it). Synchronous, no spinner, no recompute.
            const cached = mod.getCached(key);
            if (cached !== undefined) { applyVerdict(cached); return; }

            // Source pixels: prefer the live preview ImageData (already in
            // memory); fall back to decoding the encoded post body.
            const getImgData = async () => {
                if (preview && preview.data && preview.width && preview.height) return preview;
                return decodeBase64ToImageData(base64);
            };

            if (mountedRef.current) setNsfwDetecting(true);
            let verdict = false;
            try {
                verdict = await mod.ensureNsfw({ id: key, getImgData, alreadyFlagged: false });
            } catch (e) {
                verdict = false; // fail-open: never block publishing on detection
            }
            if (mountedRef.current) setNsfwDetecting(false);
            applyVerdict(verdict);
        })();

        return () => { cancelled = true; };
    }, [currentStep, base64, preview]);

    // Document-level drag detection: detects when a file is being dragged into the
    // window, activates the Portal overlay to catch the drop, and toggles the dashed
    // border visual. Uses a counter to handle nested enter/leave from child elements.
    // dragover + drop preventDefault on document are REQUIRED in all browsers to stop
    // the browser from navigating to the dropped file.
    useEffect(() => {
        const onDocDragEnter = (e) => {
            e.preventDefault();
            const types = e.dataTransfer?.types;
            const hasFiles = types && (
                typeof types.includes === 'function'
                    ? types.includes('Files')
                    : Array.prototype.indexOf.call(types, 'Files') !== -1
            );
            if (!hasFiles) return;

            dragCounterRef.current++;
            if (dragCounterRef.current === 1 && currentStepRef.current === 0 && !inputFileRef.current) {
                setIsDraggingFile(true);
                dispatch({ type: actionTypes.SET_FIELD, field: 'dropzoneActive', value: true });
            }
        };

        const onDocDragLeave = (e) => {
            e.preventDefault();
            dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
            if (dragCounterRef.current === 0) {
                setIsDraggingFile(false);
                dispatch({ type: actionTypes.SET_FIELD, field: 'dropzoneActive', value: false });
            }
        };

        const onDocDragOver = (e) => {
            e.preventDefault();
            try { e.dataTransfer.dropEffect = 'copy'; } catch (_) {}
        };

        const onDocDrop = (e) => {
            e.preventDefault();
            dragCounterRef.current = 0;
            setIsDraggingFile(false);
            dispatch({ type: actionTypes.SET_FIELD, field: 'dropzoneActive', value: false });
        };

        document.addEventListener('dragenter', onDocDragEnter);
        document.addEventListener('dragleave', onDocDragLeave);
        document.addEventListener('dragover', onDocDragOver);
        document.addEventListener('drop', onDocDrop);

        return () => {
            document.removeEventListener('dragenter', onDocDragEnter);
            document.removeEventListener('dragleave', onDocDragLeave);
            document.removeEventListener('dragover', onDocDragOver);
            document.removeEventListener('drop', onDocDrop);
            dragCounterRef.current = 0;
        };
    }, []);

    // Quantize source: the full-resolution ImageData the quantize dialog and
    // handlers operate on.
    //  - converter path: processorData.cachedBuffer (an ImageData — see
    //    continue_it in utils/pix2art/file2imgd)
    //  - detected-pixel-art path: the probe ImageData kept in `preview`.
    //    Quantization only ever writes `quantizedData` and never overwrites
    //    `preview`, so re-quantizing at new settings always restarts from the
    //    original (e.g. artwork that passed the probe but is enlarged 4x).
    const quantizeSource = processorData?.cachedBuffer
        || (preview instanceof ImageData ? preview : null);

    // Quantize preview effect
    useEffect(() => {
        if (!quantizePreviewCanvasRef.current || !quantizeSource || !quantizeDialogOpen) return;

        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }

        debounceTimeoutRef.current = setTimeout(() => {
            if (!mountedRef.current) return;

            try {
                const quantized = quantizeImageData(
                    { width: quantizeSource.width, height: quantizeSource.height },
                    quantizeSource,
                    quantizeDownscale,
                    quantizeColors
                );

                const canvas = quantizePreviewCanvasRef.current;
                if (quantized && canvas?.getContext) {
                    canvas.width = quantized.width;
                    canvas.height = quantized.height;
                    const context = canvas.getContext('2d');
                    context.clearRect(0, 0, quantized.width, quantized.height);
                    context.putImageData(quantized, 0, 0);
                }
            } catch (e) {
                console.error('Error updating quantize preview:', e);
            }
        }, 300);
    }, [quantizeDownscale, quantizeColors, quantizeSource, quantizeDialogOpen]);

    // ========================================================================
    // CALLBACKS
    // ========================================================================

    // Handle canvas ready - encode to base64
    const handleCanvasReady = useCallback((imageData) => {
        if (!imageData) return;

        JSLoader(() => import("../utils/encodeImage")).then(({ encodeIMG }) => {
            if (mountedRef.current) {
                encodeIMG(imageData, "WEBP", true).then((b) => {
                    if (mountedRef.current) {
                        dispatch({ type: actionTypes.SET_FIELD, field: 'base64', value: b });
                    }
                });
            }
        });
    }, []);

    // Process file upload (extracted for reuse)
    const processFileUpload = useCallback(async (imageFile) => {
        if (!imageFile) return;

        try {
            const pixelartImagedata = await isArtworkPixelart(imageFile, 512, 512, 160);

            if (pixelartImagedata instanceof ImageData) {
                dispatch({
                    type: actionTypes.SET_PREVIEW_DATA,
                    preview: pixelartImagedata,
                    sizeName: "default",
                    processorData: null,
                    availableSizes: ["default"],
                });
                dispatch({
                    type: actionTypes.SET_FIELD,
                    field: 'message',
                    value: "The image appears to be already optimized!"
                });
                // Encode base64 directly from the ImageData we already have.
                // Don't rely on the CanvasPreview's onCanvasReady effect — with
                // availableSizes=["default"] the user has no way to force a
                // re-render, so if the canvas effect misses the initial mount
                // (e.g. because the canvas ref isn't attached yet), base64 stays
                // empty and publish fails with the misleading "Missing Posting
                // Authority" error the empty-body case produces.
                handleCanvasReady(pixelartImagedata);
            } else {
                // Revoke any existing URL
                safeRevokeURL(inputFileUrl);

                const url = URL.createObjectURL(imageFile);
                dispatch({
                    type: actionTypes.SET_MULTIPLE,
                    payload: {
                        inputFileUrl: url,
                        inputFile: imageFile,
                        useAiOpen: true
                    }
                });
            }
        } catch (error) {
            console.error('Error processing file:', error);
            actions.trigger_snackbar(t("components.new_post.please_try_again_later"));
            dispatch({
                type: actionTypes.SET_FIELD,
                field: 'message',
                value: "We don't store uploaded images"
            });
        }
    }, [inputFileUrl, handleCanvasReady]);

    // Keep processFileUpload ref in sync for the overlay handler
    useEffect(() => { processFileUploadRef.current = processFileUpload; }, [processFileUpload]);

    // Handle drop on the Portal overlay
    const handleOverlayDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current = 0;
        setIsDraggingFile(false);
        dispatch({ type: actionTypes.SET_FIELD, field: 'dropzoneActive', value: false });

        const imageFile = extractImageFile(e);
        if (imageFile && processFileUploadRef.current) {
            processFileUploadRef.current(imageFile);
        }
    }, []);

    // Handle file input change
    const handleFileUpload = useCallback(async (event) => {
        // Prevent default immediately
        event.preventDefault();
        event.stopPropagation();

        const imageFile = extractImageFile(event);
        if (imageFile) {
            await processFileUpload(imageFile);
        }

        // Reset input value to allow re-uploading same file
        if (event.target) {
            event.target.value = '';
        }
    }, [processFileUpload]);

    // Process image with or without AI
    // style: "retroart" | "vga" — selects the AI LoRA; undefined when the
    // user declined AI (the pipeline ignores it without AI).
    const processImage = useCallback(async (useAi, style = "retroart") => {
        if (!mountedRef.current) return;

        try {
            dispatch({ type: actionTypes.SET_FIELD, field: 'isGenerating', value: true });

            const transformationSteps = percentToTransformationSteps(transformationPercent);
            const fidelity = percentToFidelity(fidelityPercent);

            const result = await processImageFile(
                {description: description.length ? description : undefined, file: inputFile ? inputFile : undefined},
                2560,
                2560,
                undefined,
                (msg) => {
                    if (mountedRef.current) {
                        dispatch({ type: actionTypes.SET_FIELD, field: 'message', value: msg });
                    }
                },
                (name, start, finish) => {
                    if (mountedRef.current) {
                        dispatch({ type: actionTypes.SET_PROCESS, name, start, finish });
                    }
                },
                useAi,
                aspectRatio,
                transformationSteps,
                fidelity,
                style
            );

            if (!mountedRef.current) return;

            // Generate initial preview
            let initialPreview = null;
            try {
                initialPreview = result.generatePreview(preferredSize);
            } catch (e) {
                console.error('Error generating initial preview:', e);
                // Try first available size
                if (result.availableSizes?.length > 0) {
                    initialPreview = result.generatePreview(result.availableSizes[0]);
                }
            }

            if (initialPreview) {
                dispatch({
                    type: actionTypes.SET_PREVIEW_DATA,
                    preview: initialPreview,
                    sizeName: preferredSize,
                    processorData: result,
                    availableSizes: result.availableSizes || [],
                    title: result.prompt || ""
                });

                // Encode base64 directly rather than relying on the
                // CanvasPreview's onCanvasReady effect. The effect *does* fire
                // on first mount in the normal case, but timing varies: if the
                // user never changes size, the only chance to encode is the
                // initial mount, and any race between canvas ref attachment
                // and the reducer dispatch can leave base64 empty. Calling
                // handleCanvasReady here guarantees encoding starts the moment
                // we have ImageData, independent of the child's render cycle.
                handleCanvasReady(initialPreview);

                // Start preloading other sizes
                startPreloading(result, result.availableSizes, preferredSize);
            } else {
                // No preview generated - this is an error condition
                throw new Error('Failed to generate preview');
            }
        } catch (error) {
            console.error('Error processing image:', error);
            if (mountedRef.current) {
                // Trigger snackbar with error message
                actions.trigger_snackbar(t("components.new_post.please_try_again_later"));

                // Reset to step 0 and clear generation state
                dispatch({
                    type: actionTypes.SET_MULTIPLE,
                    payload: {
                        isGenerating: false,
                        currentStep: 0,
                        message: "We don't store uploaded images",
                        processName: "Click to upload",
                        processStart: 0,
                        processFinish: 0,
                        // Clear upload state to allow retry
                        inputFileUrl: "",
                        inputFile: null,
                        preview: null,
                        previewCache: {},
                        processorData: null,
                        availableSizes: []
                    }
                });

                // Also revoke the URL if it exists
                safeRevokeURL(inputFileUrl);
            }
        }
    }, [description, inputFile, inputFileUrl, preferredSize, aspectRatio, transformationPercent, fidelityPercent, handleCanvasReady]);

    // Start preloading other sizes
    const startPreloading = useCallback((processor, sizes, currentSize) => {
        if (!processor || preloading) return;

        if (preloadTimeoutRef.current) {
            clearTimeout(preloadTimeoutRef.current);
        }

        preloadTimeoutRef.current = setTimeout(async () => {
            if (!mountedRef.current) return;

            dispatch({ type: actionTypes.SET_FIELD, field: 'preloading', value: true });

            for (let i = 0; i < sizes.length; i++) {
                const sizeName = sizes[i];

                if (sizeName === currentSize) continue;

                try {
                    const imageData = processor.generatePreview(sizeName);
                    if(i + 1 === sizes.length){
                        processor.disposePrepared();
                    }
                    if (mountedRef.current) {
                        dispatch({
                            type: actionTypes.CACHE_PREVIEW,
                            sizeName,
                            preview: imageData,
                            setAsCurrent: false
                        });
                        dispatch({
                            type: actionTypes.SET_FIELD,
                            field: 'preloadProgress',
                            value: ((i + 1) / sizes.length) * 100
                        });
                    }
                    await new Promise(resolve => setTimeout(resolve, 50));
                } catch (e) {
                    console.error('Error preloading size:', sizeName, e);
                }
            }

            if (mountedRef.current) {
                dispatch({
                    type: actionTypes.SET_MULTIPLE,
                    payload: {
                        preloading: false,
                        preloadProgress: 100
                    }
                });
            }
        }, 500);
    }, [preloading]);

    // Reset all state
    const resetProps = useCallback(() => {
        safeRevokeURL(inputFileUrl);

        if (preloadTimeoutRef.current) clearTimeout(preloadTimeoutRef.current);
        if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);

        const defaultCustomization = licenseBase ? createDefaultCustomization(licenseBase) : null;
        dispatch({
            type: actionTypes.RESET,
            licenseBase,
            defaultCustomization
        });
    }, [inputFileUrl, licenseBase]);

    // Reset upload state only (when going back from step 1)
    const resetUploadState = useCallback(() => {
        safeRevokeURL(inputFileUrl);

        if (preloadTimeoutRef.current) clearTimeout(preloadTimeoutRef.current);
        if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);

        dispatch({ type: actionTypes.RESET_UPLOAD });
    }, [inputFileUrl]);

    // Handle close AI dialog
    const handleCloseUseAi = useCallback((useAi, style) => {
        dispatch({ type: actionTypes.SET_FIELD, field: 'useAiOpen', value: false });
        processImage(useAi, style);
    }, [processImage]);

    // Handle size change
    const handleSizeChange = useCallback((event) => {
        const newSize = event.target.value;
        dispatch({ type: actionTypes.SET_FIELD, field: 'preferredSize', value: newSize });

        // Check cache first
        if (previewCache[newSize]) {
            dispatch({
                type: actionTypes.CACHE_PREVIEW,
                sizeName: newSize,
                preview: previewCache[newSize],
                setAsCurrent: true
            });
            return;
        }

        // Generate new preview
        if (processorData?.generatePreview) {
            try {
                const imageData = processorData.generatePreview(newSize);
                dispatch({
                    type: actionTypes.CACHE_PREVIEW,
                    sizeName: newSize,
                    preview: imageData,
                    setAsCurrent: true
                });
            } catch (e) {
                console.error('Error generating preview:', e);
            }
        }
    }, [previewCache, processorData]);

    // Field change handlers with validation
    const handleTitleChange = useCallback((e) => {
        const value = e.target.value;
        dispatch({ type: actionTypes.SET_FIELD, field: 'title', value });

        // Validate on change if already touched
        if (touched.title) {
            const validation = validateTitle(value);
            if (!validation.valid) {
                dispatch({ type: actionTypes.SET_VALIDATION_ERROR, field: 'title', error: validation.error });
            } else {
                dispatch({ type: actionTypes.CLEAR_VALIDATION_ERROR, field: 'title' });
            }
        }
    }, [touched.title]);

    const handleDescriptionChange = useCallback((e) => {
        const value = e.target.value;
        dispatch({ type: actionTypes.SET_FIELD, field: 'description', value });

        // Validate on change if already touched
        if (touched.description) {
            const validation = validateDescription(value);
            if (!validation.valid) {
                dispatch({ type: actionTypes.SET_VALIDATION_ERROR, field: 'description', error: validation.error });
            } else {
                dispatch({ type: actionTypes.CLEAR_VALIDATION_ERROR, field: 'description' });
            }
        }
    }, [touched.description]);

    const handleTagsChange = useCallback((newTags) => {
        dispatch({ type: actionTypes.SET_FIELD, field: 'tags', value: newTags });

        // Validate on change if already touched
        if (touched.tags) {
            const validation = validateTags(newTags);
            if (!validation.valid) {
                dispatch({ type: actionTypes.SET_VALIDATION_ERROR, field: 'tags', error: validation.error });
            } else {
                dispatch({ type: actionTypes.CLEAR_VALIDATION_ERROR, field: 'tags' });
            }
        }
    }, [touched.tags]);

    const handleNsfwChange = useCallback((e) => {
        // A manual toggle is authoritative: stop auto-detection from
        // overriding the user's choice for the current image, and clear the
        // "auto-flagged" hint since the value is now user-owned.
        nsfwUserOverrideRef.current = true;
        setNsfwAutoFlagged(false);
        dispatch({ type: actionTypes.SET_FIELD, field: 'nsfw', value: e.target.checked });
    }, []);

    const handleFieldBlur = useCallback((field) => {
        dispatch({ type: actionTypes.SET_TOUCHED, field });

        // Validate on blur
        let validation;
        switch (field) {
            case 'title':
                validation = validateTitle(title);
                break;
            case 'description':
                validation = validateDescription(description);
                break;
            case 'tags':
                validation = validateTags(tags);
                break;
            default:
                return;
        }

        if (!validation.valid) {
            dispatch({ type: actionTypes.SET_VALIDATION_ERROR, field, error: validation.error });
        } else {
            dispatch({ type: actionTypes.CLEAR_VALIDATION_ERROR, field });
        }
    }, [title, description, tags]);

    const handleTabChange = useCallback((e, value) => {
        dispatch({ type: actionTypes.SET_FIELD, field: 'tabValue', value });
    }, []);

    const handleAspectRatioChange = useCallback((ratio) => {
        dispatch({ type: actionTypes.SET_FIELD, field: 'aspectRatio', value: ratio });
    }, []);

    const handleTransformationChange = useCallback((value) => {
        dispatch({ type: actionTypes.SET_FIELD, field: 'transformationPercent', value });
    }, []);

    const handleFidelityChange = useCallback((value) => {
        dispatch({ type: actionTypes.SET_FIELD, field: 'fidelityPercent', value });
    }, []);

    const toggleComparison = useCallback(() => {
        dispatch({ type: actionTypes.SET_FIELD, field: 'showingOriginal', value: !showingOriginal });
    }, [showingOriginal]);

    // Download artwork
    const downloadArtwork = useCallback(() => {
        const dataToDownload = quantizedData || preview;
        if (!dataToDownload) return;

        JSLoader(() => import("../utils/encodeImage")).then(({ encodeIMG }) => {
            encodeIMG(dataToDownload, "PNG", true).then((b) => {
                const a = document.createElement("a");
                a.download = `Pixagram.png`;
                a.href = b;
                a.click();
                a.remove();
            });
        });
    }, [quantizedData, preview]);

    // Open external link
    const openLink = useCallback((url) => {
        window.open(url, "_blank", "noopener,noreferrer");
    }, []);

    // Handle back/cancel
    const handleBackOrCancel = useCallback((force = false) => {
        if (currentStep === 0) {
            if (force) {
                resetProps();
                onClose();
            } else {
                dispatch({ type: actionTypes.SET_FIELD, field: 'closeConfirmOpen', value: true });
            }
        } else if (currentStep === 1) {
            // Going back from step 1 - reset upload state to allow new upload
            resetUploadState();
        } else {
            // Going back from step 2 to step 1 - use GO_TO_STEP to trigger canvas re-render
            dispatch({ type: actionTypes.GO_TO_STEP, step: currentStep - 1 });
        }
    }, [currentStep, resetProps, resetUploadState, onClose]);

    // Publish the post. There is no confirmation step — clicking "Publish"
    // goes straight to broadcasting (the button shows a spinner while it's in
    // flight). On success the NewPost dialog closes and the full-screen logo
    // loader takes over until the feed refreshes.
    const handlePublishClick = useCallback(async () => {
        // Validate everything first; surface inline errors and bail if invalid.
        const validation = validateAllFields(title, description, tags);
        if (!validation.valid) {
            dispatch({ type: actionTypes.VALIDATE_ALL, errors: validation.errors });
            return;
        }

        dispatch({ type: actionTypes.SET_FIELD, field: 'isPublishing', value: true });

        try {
            if (!api || !api.broadcast) {
                throw new Error('API not available');
            }

            // Guard against empty body. A zero-length comment body is
            // rejected by the chain during signature verification, not during
            // content validation — the rejection surfaces as "Missing Posting
            // Authority" rather than "body required", which is actively
            // misleading. We check here to fail fast with a clear message.
            if (!base64 || base64.length === 0) {
                throw new Error('Image not ready yet — please wait a moment and try again.');
            }

            const permlink = generatePermlink(title);
            const parentPermlink = tags[0]; // First tag as parent permlink (category)

            // Build JSON metadata — description lives here, not in the body.
            // Every field under `license` is guaranteed to be defined: a
            // null-valued or missing nested key here caused the comment-op
            // signature to diverge from the bytes the chain reconstructs,
            // surfacing as "Missing Posting Authority" on publish.
            const licensePayload = {
                type: 'PIXA_LICENSE',
                version: licenseCustomization?.version || '1.0',
                rightsConfiguration: licenseCustomization?.rightsConfiguration || { holderRights: {}, visitorRights: {} },
                royaltyPercentage: licenseCustomization?.royaltyPercentage ?? 0,
                governingLaw: licenseCustomization?.governingLaw || { jurisdiction: '' },
                isCustomized: !!licenseCustomization?.isCustomized,
            };

            const jsonMetadata = {
                app: 'pixagram/3.0.2',
                format: 'image',
                tags: tags,
                image: [],
                description: description || '',
                nsfw: !!nsfw,
                license: licensePayload,
            };

            // Get active account from session
            const activeAccount = await api.sessionManager?.getActiveAccount();
            if (!activeAccount) {
                throw new Error('No active account. Please log in first.');
            }
            // Broadcast the comment/post
            await api.broadcast.comment({
                parentAuthor: '',
                parentPermlink: parentPermlink,
                author: activeAccount,
                permlink: permlink,
                title: title,
                body: base64,
                jsonMetadata: jsonMetadata
            });

            // Success — hand off to the full-screen logo loader, then close the
            // dialog underneath it. The loader owns the post-publish wait and
            // refreshes the page when its animation completes (~6s).
            actions.trigger_publish_loader();
            resetProps();
            onClose();

        } catch (error) {
            console.error('Error publishing post:', error);
            dispatch({ type: actionTypes.SET_FIELD, field: 'isPublishing', value: false });
            actions.trigger_snackbar(error.message || "Failed to publish post. Please try again.");
        }
    }, [api, title, description, tags, nsfw, base64, licenseCustomization, resetProps, onClose]);

    // Handle next/finish
    const handleNextOrFinish = useCallback(() => {
        if (currentStep === 0 && tabValue === 1) {
            // Generate from description
            if (!description.trim()) return;
            dispatch({ type: actionTypes.SET_FIELD, field: 'isGenerating', value: true });
            processImage(true);
        } else if (currentStep === 2) {
            // Final step: publish immediately (no confirmation dialog)
            handlePublishClick();
        } else {
            dispatch({ type: actionTypes.SET_FIELD, field: 'currentStep', value: currentStep + 1 });
        }
    }, [currentStep, tabValue, description, processImage, handlePublishClick]);

    // Handle apply quantize
    const handleApplyQuantize = useCallback(() => {
        if (!quantizeSource) return;

        try {
            const quantized = quantizeImageData(
                { width: quantizeSource.width, height: quantizeSource.height },
                quantizeSource,
                quantizeDownscale,
                quantizeColors
            );

            dispatch({
                type: actionTypes.SET_MULTIPLE,
                payload: {
                    quantizedData: quantized,
                    quantizeDialogOpen: !quantizeDialogOpen
                }
            });
            dispatch({ type: actionTypes.INCREMENT_CANVAS_KEY });
        } catch (e) {
            console.error('Error applying quantization:', e);
        }
    }, [quantizeSource, quantizeDownscale, quantizeColors, quantizeDialogOpen]);

    // Handle apply quantize from dialog
    const handleApplyQuantizeFromDialog = useCallback(() => {
        if (!quantizeSource) return;

        try {
            const quantized = quantizeImageData(
                { width: quantizeSource.width, height: quantizeSource.height },
                quantizeSource,
                quantizeDownscale,
                quantizeColors
            );

            dispatch({
                type: actionTypes.SET_MULTIPLE,
                payload: {
                    quantizedData: quantized,
                    quantizeDialogOpen: false
                }
            });
            dispatch({ type: actionTypes.INCREMENT_CANVAS_KEY });
        } catch (e) {
            console.error('Error applying quantization:', e);
        }
    }, [quantizeSource, quantizeDownscale, quantizeColors]);

    // Handle cancel quantize
    const handleCancelQuantize = useCallback(() => {
        dispatch({
            type: actionTypes.SET_MULTIPLE,
            payload: {
                quantizedData: null,
                quantizeDialogOpen: false,
                quantizeDownscale: 4,
                quantizeColors: 64
            }
        });

        // Reload current size
        if (previewCache[preferredSize]) {
            dispatch({
                type: actionTypes.CACHE_PREVIEW,
                sizeName: preferredSize,
                preview: previewCache[preferredSize],
                setAsCurrent: true
            });
        }
    }, [preferredSize, previewCache]);

    // License handlers
    const handleOpenLicense = useCallback(() => {
        dispatch({ type: actionTypes.SET_FIELD, field: 'licenseCustomizationOpen', value: true });
    }, []);

    const handleCloseLicense = useCallback(() => {
        dispatch({ type: actionTypes.SET_FIELD, field: 'licenseCustomizationOpen', value: false });
    }, []);

    const handleSaveLicense = useCallback((customization) => {
        dispatch({
            type: actionTypes.SET_MULTIPLE,
            payload: {
                licenseCustomization: customization,
                licenseCustomizationOpen: false
            }
        });
    }, []);

    // Quantize slider handlers
    const handleQuantizeDownscaleChange = useCallback((e, value) => {
        dispatch({ type: actionTypes.SET_FIELD, field: 'quantizeDownscale', value });
    }, []);

    const handleQuantizeColorsChange = useCallback((e, value) => {
        dispatch({ type: actionTypes.SET_FIELD, field: 'quantizeColors', value });
    }, []);

    // Close confirm handlers
    const handleCloseConfirmCancel = useCallback(() => {
        dispatch({ type: actionTypes.SET_FIELD, field: 'closeConfirmOpen', value: false });
    }, []);

    const handleCloseConfirmOk = useCallback(() => {
        dispatch({ type: actionTypes.SET_FIELD, field: 'closeConfirmOpen', value: false });
        resetProps();
        onClose();
    }, [resetProps, onClose]);

    // ========================================================================
    // RENDER
    // ========================================================================

    const totalStep = 3;
    const stepNames = ["Create", "Adjust", "Post"];

    // Render step content
    let view = null;

    switch (currentStep) {
        case 0:
            view = (
                <React.Fragment>
                    <Tabs
                        className={classes.cardTabs}
                        value={tabValue}
                        variant="fullWidth"
                        indicatorColor="primary"
                        textColor="primary"
                        onChange={handleTabChange}
                        disabled={isGenerating}
                    >
                        <Tab icon={<ImageIcon />} label={t("components.new_post.convert_picture")} />
                        <Tab icon={<DescriptionIcon />} label={t("components.new_post.create_image")} />
                    </Tabs>
                    {tabValue === 1 ? (
                        <div style={{ width: "100%" }}>
                            <AspectRatioSelector
                                classes={classes}
                                aspectRatio={aspectRatio}
                                onAspectRatioChange={handleAspectRatioChange}
                                disabled={isGenerating}
                            />
                            <Fade in timeout={900}>
                                <TextField
                                    className={classes.descriptionField}
                                    label={t("words.description")}
                                    multiline
                                    minRows={16}
                                    value={description}
                                    onChange={handleDescriptionChange}
                                    variant="outlined"
                                    fullWidth
                                    disabled={isGenerating}
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end" style={{ alignSelf: 'flex-end', marginBottom: '8px', marginRight: '16px' }}>
                                                <IconButton
                                                    className={classes.sendButton}
                                                    onClick={handleNextOrFinish}
                                                    disabled={!description.trim() || isGenerating}
                                                    edge="end"
                                                >
                                                    {isGenerating ? (
                                                        <CircularProgress size={24} style={{ color: "#fff" }} />
                                                    ) : (
                                                        <SendIcon />
                                                    )}
                                                </IconButton>
                                            </InputAdornment>
                                        )
                                    }}
                                />
                            </Fade>
                            <GenerationParameters
                                classes={classes}
                                showFidelity={false}
                                transformationPercent={transformationPercent}
                                fidelityPercent={fidelityPercent}
                                onTransformationChange={handleTransformationChange}
                                onFidelityChange={handleFidelityChange}
                                disabled={isGenerating}
                            />
                        </div>
                    ) : (
                        <React.Fragment>
                            <TextField
                                className={classes.descriptionField}
                                label={t("components.new_post.description_optional")}
                                multiline
                                minRows={1}
                                value={description}
                                onChange={handleDescriptionChange}
                                variant="outlined"
                                fullWidth
                                style={{marginBottom: "16px"}}
                            />
                            <UploadZone
                                classes={classes}
                                dropzoneActive={dropzoneActive}
                                inputFileUrl={inputFileUrl}
                                loading={loading}
                                processName={processName}
                                loadingPercent={loadingPercent}
                                message={message}
                                onFileUpload={handleFileUpload}
                            />
                            <GenerationParameters
                                classes={classes}
                                showFidelity={true}
                                transformationPercent={transformationPercent}
                                fidelityPercent={fidelityPercent}
                                onTransformationChange={handleTransformationChange}
                                onFidelityChange={handleFidelityChange}
                                disabled={loading}
                            />
                        </React.Fragment>
                    )}
                </React.Fragment>
            );
            break;

        case 1:
            view = (
                <CanvasPreview
                    classes={classes}
                    preview={preview}
                    quantizedData={quantizedData}
                    preferredSize={preferredSize}
                    availableSizes={availableSizes}
                    preloading={preloading}
                    preloadProgress={preloadProgress}
                    showingOriginal={showingOriginal}
                    hasProcessorData={!!processorData}
                    originalImageData={processorData?.originalImageData}
                    onSizeChange={handleSizeChange}
                    onToggleComparison={toggleComparison}
                    onApplyQuantize={handleApplyQuantize}
                    onCancelQuantize={handleCancelQuantize}
                    onDownload={downloadArtwork}
                    onOpenEditor={() => openLink("https://pixa.pics/")}
                    base64Kb={base64Kb}
                    onCanvasReady={handleCanvasReady}
                    canvasKey={canvasKey}
                />
            );
            break;

        case 2:
            view = (
                <PublishForm
                    classes={classes}
                    title={title}
                    description={description}
                    tags={tags}
                    base64={base64}
                    nsfw={nsfw}
                    licenseCustomization={licenseCustomization}
                    validationErrors={validationErrors}
                    touched={touched}
                    onTitleChange={handleTitleChange}
                    onDescriptionChange={handleDescriptionChange}
                    onTagsChange={handleTagsChange}
                    trendingTags={trendingTags}
                    onNsfwChange={handleNsfwChange}
                    nsfwDetecting={nsfwDetecting}
                    nsfwAutoFlagged={nsfwAutoFlagged}
                    onOpenLicense={handleOpenLicense}
                    onFieldBlur={handleFieldBlur}
                />
            );
            break;
    }

    return (
        <React.Fragment>
            {/* Main Dialog */}
            <Dialog
                className={classes.dialog}
                open={open}
                maxWidth={false}
                fullWidth={false}
                disablePortal={false}
                onClose={() => dispatch({ type: actionTypes.SET_FIELD, field: 'closeConfirmOpen', value: true })}
                keepMounted={false}
            >
                <DialogContent style={{ position: "relative" }}>
                    {view}
                </DialogContent>
                <DialogActions style={{
                    backgroundColor: "#171717",
                    borderRadius: "32px",
                    textAlign: "right",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "16px 24px"
                }}>
                    <Box style={{ textAlign: "left" }}>
                        <Typography variant="body2" style={{ textTransform: "uppercase", marginBottom: "8px", fontWeight: 600, marginTop: 0, fontSize: "1rem", color: "#ccc", lineHeight: 1 }}>
                            {stepNames[currentStep]} ({currentStep + 1}/{totalStep})
                        </Typography>
                        <Typography variant="caption" style={{ color: "#999", display: "block", fontSize: "0.875rem", lineHeight: 1.125 }}>
                            {t("components.new_post.wizard_of_creation")}
                        </Typography>
                    </Box>
                    <Box>
                        {currentStep > 0 ? (
                            <Button variant="text" color="primary" onClick={() => handleBackOrCancel()} disabled={isPublishing}>
                                {t("components.new_post.back")}
                            </Button>
                        ): (
                            <Button variant="text" color="primary" onClick={() => handleBackOrCancel()} disabled={isPublishing}>
                                {t("words.close")}
                            </Button>
                        )}
                        <Button
                            size="large"
                            style={{ borderRadius: "32px" }}
                            variant="contained"
                            color="primary"
                            disabled={
                                isPublishing ||
                                (currentStep === 0 && tabValue === 1
                                    ? !description.trim() || isGenerating
                                    : currentStep === 0
                                        ? true
                                        : currentStep === 2
                                            ? !isFormValid
                                            : false)
                            }
                            onClick={handleNextOrFinish}
                        >
                            {isPublishing ? (
                                <CircularProgress size={24} style={{ color: "#fff" }} />
                            ) : currentStep === 2 ? "Publish" : currentStep === 0 && tabValue === 1 ? "Generate" : "Next"}
                        </Button>
                    </Box>
                </DialogActions>
            </Dialog>
            {/* Close Confirmation Dialog */}
            <Dialog
                PaperProps={{ classes: { root: classes.whiteDialog } }}
                open={closeConfirmOpen}
                maxWidth="xs"
                disablePortal={false}
                onClose={handleCloseConfirmCancel}
                keepMounted={false}
            >
                <DialogContent>
                    <Typography style={{ marginTop: 8, marginBottom: 24 }} component="h2" variant="h6">
                        {t("components.new_post.are_you_sure")}
                    </Typography>
                    <Typography variant="body2" color="textPrimary" component="p">
                        {t("components.new_post.your_current_artwork_will_be_lost")}
                    </Typography>
                </DialogContent>
                <DialogActions style={{ textAlign: "right" }}>
                    <Button variant="text" color="primary" autoFocus onClick={handleCloseConfirmCancel}>
                        {t("words.cancel")}
                    </Button>
                    <Button variant="contained" color="primary" onClick={handleCloseConfirmOk}>
                        {t("words.close")}
                    </Button>
                </DialogActions>
            </Dialog>
            {/* AI Dialog */}
            <Dialog
                PaperProps={{ classes: { root: classes.whiteDialog } }}
                open={useAiOpen}
                maxWidth="xs"
                disablePortal={false}
                onClose={() => handleCloseUseAi(false)}
                keepMounted={false}
            >
                <DialogContent>
                    <Typography style={{ marginTop: 8, marginBottom: 24 }} component="h2" variant="h6">
                        {t("words.transform_your_picture_with_ai")}
                    </Typography>
                    <Typography variant="body2" color="textPrimary" component="p">
                        {t("components.new_post.the_conversion_process_that_involves_a_style")}<br/>
                        {t("components.new_post.while_being_free_and_anonymous_it_only")}
                    </Typography>
                    <Box style={{ display: "flex", gap: "12px", marginTop: 24, marginBottom: 8 }}>
                        <Button
                            variant="contained"
                            color="primary"
                            style={{ flexGrow: 1 }}
                            onClick={() => handleCloseUseAi(true, "vga")}
                        >
                            {t("words.vga_style")}
                        </Button>
                        <Button
                            variant="contained"
                            color="primary"
                            style={{ flexGrow: 1 }}
                            onClick={() => handleCloseUseAi(true, "retroart")}
                        >
                            {t("words.retro_art")}
                        </Button>
                    </Box>
                </DialogContent>
                <DialogActions style={{ textAlign: "right" }}>
                    <Button variant="text" color="primary" autoFocus onClick={() => handleCloseUseAi(false)}>
                        {t("words.no_i_don_t_want")}
                    </Button>
                </DialogActions>
            </Dialog>
            {/* Quantize Dialog */}
            <Dialog
                PaperProps={{ classes: { root: classes.whiteDialog } }}
                open={quantizeDialogOpen}
                maxWidth="md"
                fullWidth
                disablePortal={false}
                onClose={handleCancelQuantize}
                keepMounted={false}
            >
                <DialogContent>
                    <Typography style={{ marginTop: 8, marginBottom: 24 }} component="h2" variant="h6">
                        {t("components.new_post.quantization_settings")}
                    </Typography>

                    <div style={{backgroundColor: "#efefef", marginBottom: -32, padding: "24px 24px 48px 24px", borderRadius: "21px"}}>
                        <Box>
                            <Typography gutterBottom>
                                {t("words.downscale_ratio")}
                            </Typography>
                            <Slider
                                value={quantizeDownscale}
                                onChange={handleQuantizeDownscaleChange}
                                min={1}
                                max={32}
                                step={1}
                                marks={[
                                    { value: 1, label: '1x' },
                                    { value: 4, label: '4x' },
                                    { value: 8, label: '8x' },
                                    { value: 12, label: '12x' },
                                    { value: 16, label: '16x' },
                                    { value: 24, label: '24x' },
                                    { value: 32, label: '32x' }
                                ]}
                                valueLabelDisplay="auto"
                            />
                        </Box>

                        <Box>
                            <Typography gutterBottom>
                                {t("words.number_of_colors")}
                            </Typography>
                            <Slider
                                value={quantizeColors}
                                onChange={handleQuantizeColorsChange}
                                min={2}
                                max={128}
                                step={1}
                                marks={[
                                    { value: 2, label: '2' },
                                    { value: 16, label: '16' },
                                    { value: 32, label: '32' },
                                    { value: 64, label: '64' },
                                    { value: 96, label: '96' },
                                    { value: 128, label: '128' }
                                ]}
                                valueLabelDisplay="auto"
                            />
                        </Box>
                    </div>

                    <Box>
                        <div className="pixelated" style={{ width: "100%", textAlign: "center" }}>
                            <canvas
                                style={{ borderRadius: "21px", width: "100%" }}
                                ref={quantizePreviewCanvasRef}
                            />
                        </div>
                    </Box>
                </DialogContent>
                <DialogActions style={{ textAlign: "right" }}>
                    <Button variant="text" color="primary" onClick={handleCancelQuantize}>
                        {t("words.cancel")}
                    </Button>
                    <Button variant="contained" color="primary" onClick={handleApplyQuantizeFromDialog}>
                        {t("components.new_post.apply")}
                    </Button>
                </DialogActions>
            </Dialog>
            {/* License Customization Dialog */}
            {licenseBase && (
                <LicenseCustomizationDialog
                    open={licenseCustomizationOpen}
                    onClose={handleCloseLicense}
                    onSave={handleSaveLicense}
                    licenseBase={licenseBase}
                    initialCustomization={licenseCustomization}
                />
            )}
            {/* Invisible full-screen drag overlay — rendered at step 0 before a file is
                loaded. pointer-events stays "none" (so clicks pass through to the upload
                button) until the document-level dragenter detects a file, which flips
                isDraggingFile and activates the overlay to catch the drop. */}
            {currentStep === 0 && !inputFile && (
                <Portal container={document.body}>
                    <div
                        onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            try { e.dataTransfer.dropEffect = 'copy'; } catch (_) {}
                        }}
                        onDrop={handleOverlayDrop}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            zIndex: 99999,
                            pointerEvents: isDraggingFile ? 'auto' : 'none',
                        }}
                    />
                </Portal>
            )}
        </React.Fragment>
    );
}

export default withStyles(styles)(NewPost);