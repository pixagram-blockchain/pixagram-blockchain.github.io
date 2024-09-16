import * as React from "preact/compat";
import { ToxicityWatcher } from "./ToxicityHint";
import withStyles from "@material-ui/core/styles/withStyles";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";
import Chip from "@material-ui/core/Chip";
import Tooltip from "@material-ui/core/Tooltip";
import Switch from "@material-ui/core/Switch";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import CircularProgress from "@material-ui/core/CircularProgress";
import Fade from "@material-ui/core/Fade";
import Autocomplete from "@material-ui/lab/Autocomplete";
import WarningRounded from "@material-ui/icons/WarningRounded";
import DeleteForeverRounded from "@material-ui/icons/DeleteForeverRounded";
import LockRounded from "@material-ui/icons/LockRounded";
import GavelIcon from "@material-ui/icons/Gavel";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import LicenseCustomizationDialog from "./LicenseCustomizationDialog";
import { PIXA_LICENSE_BASE, createDefaultCustomization } from "../utils/pixa_license";
import * as actions from "../actions/utils";

import { t } from "../utils/text";

const { useState, useEffect, useCallback, useMemo } = React;

/* ════════════════════════════════════════════════════════════════════════
 * EditPostDialog — edit the metadata of an existing post (pixel art or blog)
 *
 * Modeled on NewPost's final "Post" panel: Title, Description, Tags, NSFW —
 * plus the new "Deleted" switch. Marking a post deleted sets the `deleted`
 * METADATA FLAG — never a tag, since tags are browsable and deleted posts
 * must not be enumerable through a tag page. Every feed/profile/community
 * page filters flagged posts out. The switch is reversible (metadata only).
 *
 * Pixel-art posts also carry a PIXA_LICENSE in their metadata; the dialog
 * loads the stored license back into a customization object and reuses
 * NewPost's LicenseCustomizationDialog to edit it, re-broadcasting the full
 * payload on save (every field defined — a missing nested key makes the
 * comment-op signature diverge from the bytes the chain reconstructs).
 *
 * For pixel-art posts a separate, explicitly-confirmed danger action erases
 * the body content itself (the encoded artwork) — irreversible by design,
 * per the platform's soft-delete model: posts with votes can never be
 * removed with delete_comment, so "deleting" a pixel-art post means wiping
 * its body and tagging it `deleted`.
 *
 * Body modification (replacing the artwork image) is intentionally left as
 * a stub section — the dialog is structured so it can host it later.
 *
 * All writes go through api.broadcast.updateComment(), which performs
 * HIVE-style content patching (same permlink + parent ⇒ edit) and emits
 * `content_updated` so open pages refresh themselves.
 * ════════════════════════════════════════════════════════════════════════ */

const VALIDATION = {
    TITLE_MAX_LENGTH_PIXEL: 24,   // matches NewPost
    TITLE_MAX_LENGTH_BLOG: 250,   // chain limit is < 256
    DESCRIPTION_MAX_LENGTH: 1024,
    TAGS_MAX_COUNT: 5,
    TAG_MIN_LENGTH: 3,
    TAG_PATTERN: /^[a-z][a-z0-9\-]*$/,
    TAG_STARTS_WITH_NUMBER_OR_MINUS: /^[0-9\-]/,
    TAG_CONTAINS_DOT: /\./
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

const styles = theme => ({
    dialogPaper: {
        backgroundColor: "#181818",
        borderRadius: "21px",
        color: "#fff",
        width: "100%",
    },
    dialogTitle: {
        "& .MuiTypography-root": {
            color: "#fff",
            fontWeight: "bold",
            fontFamily: '"Industry Book", "Normative Pro"',
        },
        paddingBottom: 4,
    },
    subtitle: {
        color: "#888",
        fontSize: "0.8rem",
        marginTop: 2,
    },
    errorText: {
        color: "#888",
        fontSize: "0.75rem",
        marginTop: theme.spacing(0.5),
        marginLeft: theme.spacing(1.5)
    },
    charCounter: {
        color: "#666",
        fontSize: "0.75rem",
        textAlign: "right",
        marginTop: theme.spacing(0.5)
    },
    charCounterWarning: { color: "#888" },
    charCounterError: { color: "#aaa" },
    tagPopper: {
        backgroundColor: "#242424ff !important",
    },
    switchBox: {
        marginTop: theme.spacing(2),
        padding: theme.spacing(1.5),
        borderRadius: "21px",
        border: "1px solid #333"
    },
    licenseBox: {
        marginTop: theme.spacing(2),
        padding: theme.spacing(1.5),
        borderRadius: "21px",
        border: "1px solid #333",
    },
    licenseTitle: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        color: "#ddd",
        fontWeight: "bold",
        fontSize: "0.95rem",
        "& svg": { fontSize: 18, color: "#999" },
    },
    licenseStat: {
        display: "flex",
        justifyContent: "space-between",
        margin: "2px 0",
    },
    licenseStatLabel: { color: "#888", fontSize: "0.75rem" },
    licenseStatValue: { color: "#bbb", fontSize: "0.75rem" },
    licenseButton: {
        marginTop: 12,
        color: "#ddd",
        borderColor: "#333",
        textTransform: "none",
        "&:hover": {
            borderColor: "#666",
            backgroundColor: "rgba(255, 255, 255, 0.04)",
        },
    },
    configuredChip: {
        backgroundColor: "#242424",
        color: "#aaa",
        height: 22,
        "& .MuiChip-icon": { color: "#888", fontSize: 16 },
    },
    deletedBox: {
        marginTop: theme.spacing(2),
        padding: theme.spacing(1.5),
        borderRadius: "21px",
        border: "1px solid #333",
    },
    dangerZone: {
        marginTop: theme.spacing(2),
        padding: theme.spacing(1.5),
        borderRadius: "21px",
        backgroundColor: "#171717",
    },
    dangerButton: {
        color: "#ccc",
        textTransform: "none",
        "&:hover": {
            backgroundColor: "rgba(255, 255, 255, 0.04)",
        },
    },
    categoryChip: {
        backgroundColor: "#242424",
        color: "#aaa",
        marginRight: 8,
    },
    fixedCategoryChip: {
        backgroundColor: "#202020",
        color: "#bbb",
        cursor: "default",
        flexDirection: "row-reverse",
        "& .MuiChip-icon": { color: "#777", fontSize: 15, marginLeft: -8, marginRight: 8, marginBottom: -2 },
        "& .MuiChip-label": { paddingLeft: 6 },
    },
    cancelButton: { color: "#888" },
    saveButton: {
        backgroundColor: "#fff",
        color: "#000",
        fontWeight: "bold",
        borderRadius: "21px",
        padding: "6px 24px",
        "&:hover": { backgroundColor: "#ddd" },
        "&.Mui-disabled": { backgroundColor: "#333", color: "#777" },
    },
    loadingWrap: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        padding: "48px 0",
        color: "#888",
    },
});

const getAuthorUsername = (data) => {
    const a = data?.author;
    return (a && typeof a === "object") ? (a.username || a.name || "") : (a || "");
};

// Resolve the live on-chain proposal linked to a post. A proposal references
// its post by (creator, permlink) and the post itself doesn't carry the
// proposal id, so we list the author's proposals (by_creator windows their
// entries to the front) and match on permlink. Returns the proposal object
// (carrying proposal_id / id) or null when none is found / on error.
const findProposalForPost = async (api, author, permlink) => {
    if (!api?.accounts?.listProposals || !author || !permlink) return null;
    const a = String(author).toLowerCase().trim();
    try {
        const res = await api.accounts.listProposals([a], 100, "by_creator", "ascending", "all");
        const list = Array.isArray(res) ? res : (Array.isArray(res?.proposals) ? res.proposals : null);
        if (!list) return null;
        return list.find(p => p
            && String(p.creator || "").toLowerCase().trim() === a
            && p.permlink === permlink) || null;
    } catch (e) {
        console.warn("[EditPostDialog] proposal lookup failed:", e?.message);
        return null;
    }
};

function EditPostDialogInner({ classes, open, onClose, api, account, data, onUpdated }) {
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const [saving, setSaving] = useState(false);

    // Editable fields (hydrated from the raw on-chain version on open)
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [tags, setTags] = useState([]);
    const [nsfw, setNsfw] = useState(false);
    const [deleted, setDeleted] = useState(false);
    // PIXA_LICENSE — pixel-art only. Hydrated from meta.license, edited via
    // NewPost's LicenseCustomizationDialog, re-broadcast in full on save.
    const [licenseCustomization, setLicenseCustomization] = useState(null);
    const [licenseDialogOpen, setLicenseDialogOpen] = useState(false);
    // Pixel-art body erasure (danger zone) — two-step confirm
    const [eraseArmed, setEraseArmed] = useState(false);
    const [eraseBody, setEraseBody] = useState(false);
    // Snapshot of the raw on-chain version, used to detect changes
    const [original, setOriginal] = useState(null);

    const authorUsername = getAuthorUsername(data);
    const permlink = data?.permlink || "";
    const contentType = data?._content_type || "pixel_art";
    const isPixelArt = contentType !== "blog";
    const titleMax = isPixelArt ? VALIDATION.TITLE_MAX_LENGTH_PIXEL : VALIDATION.TITLE_MAX_LENGTH_BLOG;

    // ── Hydrate from the chain whenever the dialog opens ────────────────
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoading(true);
        setLoadError(null);
        setSaving(false);
        setEraseArmed(false);
        setEraseBody(false);

        (async () => {
            try {
                if (!api?.content || !authorUsername || !permlink) {
                    throw new Error("Missing post identifiers");
                }
                const raw = await api.content.getContent(authorUsername, permlink, { raw: true });
                if (cancelled) return;
                if (!raw || !raw.author) throw new Error("Post not found on chain");

                let meta = {};
                try {
                    const parsed = JSON.parse(raw.json_metadata || "{}");
                    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) meta = parsed;
                } catch (_) { meta = {}; }

                const metaTags = Array.isArray(meta.tags)
                    ? meta.tags.filter(t => typeof t === "string")
                    : [];
                const isDeleted = meta.deleted === true
                    || metaTags.some(t => t.toLowerCase() === "deleted");

                setTitle(raw.title || "");
                setDescription(typeof meta.description === "string" ? meta.description : "");
                // `deleted` is owned by the switch below, never by the tag editor.
                // The category (parent_permlink) is surfaced as a fixed, non-removable
                // first chip — keep it OUT of the editable user-tag list so it can't be
                // deleted; it's re-prepended on save.
                const categoryLower = (raw.parent_permlink || "").toLowerCase();
                setTags(metaTags.filter(t => {
                    const tl = t.toLowerCase();
                    return tl !== "deleted" && tl !== categoryLower;
                }));
                setNsfw(meta.nsfw === true || meta.nsfw === "true" || meta.nsfw === 1
                    || metaTags.some(t => t.toLowerCase() === "nsfw"));
                setDeleted(isDeleted);
                // License — map the stored payload back onto a customization
                // object; fall back to the platform defaults field by field
                // so partially-stored licenses stay editable.
                const defCustomization = createDefaultCustomization(PIXA_LICENSE_BASE);
                const storedLicense = (meta && typeof meta.license === "object" && meta.license && !Array.isArray(meta.license))
                    ? meta.license : null;
                setLicenseCustomization(storedLicense ? {
                    ...defCustomization,
                    version: storedLicense.version || defCustomization.version,
                    rightsConfiguration: storedLicense.rightsConfiguration || defCustomization.rightsConfiguration,
                    royaltyPercentage: storedLicense.royaltyPercentage ?? defCustomization.royaltyPercentage,
                    governingLaw: storedLicense.governingLaw || defCustomization.governingLaw,
                    isCustomized: !!storedLicense.isCustomized,
                } : defCustomization);
                setLicenseDialogOpen(false);
                setOriginal({
                    title: raw.title || "",
                    category: raw.parent_permlink || "",
                    meta,
                    metaTags,
                    isDeleted,
                    bodyLength: (raw.body || "").length,
                });
                setLoading(false);
            } catch (e) {
                if (cancelled) return;
                console.warn("[EditPostDialog] load failed:", e.message);
                setLoadError(e.message || "Failed to load post");
                setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [open, api, authorUsername, permlink]);

    // The post's category (parent_permlink) can never change on edit, so it's
    // surfaced as a fixed, non-removable first chip in the Tags field. It is kept
    // OUT of the editable `tags` list and merged back only for display — but it
    // still counts toward the chain's tag limit.
    const category = original?.category || "";
    const displayTags = category
        ? [category, ...tags.filter(t => t.toLowerCase() !== category.toLowerCase())]
        : tags;

    // ── Validation ──────────────────────────────────────────────────────
    const titleError = !title.trim()
        ? "Title is required"
        : title.length > titleMax ? t("components.edit_post_dialog.maximum_characters", {
        titleMax: titleMax
    }) : null;
    const descriptionError = description.length > VALIDATION.DESCRIPTION_MAX_LENGTH
        ? t("components.edit_post_dialog.maximum_characters_2", {
        DESCRIPTION_MAX_LENGTH: VALIDATION.DESCRIPTION_MAX_LENGTH
    }) : null;
    const tagsError = displayTags.length > VALIDATION.TAGS_MAX_COUNT
        ? t("words.maximum_tags_max_count_tags_allowed", {
        TAGS_MAX_COUNT: VALIDATION.TAGS_MAX_COUNT
    }) : null;
    // Blog posts edit their title / description / tags through "Edit Content"
    // (the blog editor), so those fields aren't shown here and don't gate the
    // save — only NSFW and the Deleted flag do.
    const canSave = !loading && !saving && !loadError
        && (isPixelArt ? (!titleError && !descriptionError && !tagsError) : true)
        && account && account === authorUsername;

    const getCounterClass = (count, max) => {
        if (count > max) return classes.charCounterError;
        if (count > max * 0.8) return classes.charCounterWarning;
        return classes.charCounter;
    };

    // ── Danger zone (pixel art body erasure) ────────────────────────────
    const armErase = useCallback(() => setEraseArmed(true), []);
    const confirmErase = useCallback(() => {
        setEraseBody(true);
        setDeleted(true); // erasing the artwork always implies the deleted tag
        setEraseArmed(false);
    }, []);
    const cancelErase = useCallback(() => { setEraseArmed(false); setEraseBody(false); }, []);

    // ── License customization dialog ────────────────────────────────────
    const openLicenseDialog = useCallback(() => setLicenseDialogOpen(true), []);
    const closeLicenseDialog = useCallback(() => setLicenseDialogOpen(false), []);
    const saveLicenseCustomization = useCallback((customization) => {
        setLicenseCustomization(customization);
        setLicenseDialogOpen(false);
    }, []);

    // Compact summary for the license box — mirrors NewPost's LicenseSection.
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

    // ── Save ────────────────────────────────────────────────────────────
    const handleSave = useCallback(async () => {
        if (!canSave || !api?.broadcast || !original) return;
        setSaving(true);
        try {
            // Final tag list: user tags, category guaranteed first (the
            // parent_permlink can never change on edit, so the metadata
            // mirrors it for consistency). The deleted state lives ONLY in
            // meta.deleted — never a tag — so flagged posts can't be browsed;
            // seeding the dedupe set also strips any legacy 'deleted' tag.
            const seen = new Set(["deleted"]);
            const finalTags = [];
            const pushTag = (t) => {
                const v = String(t || "").toLowerCase().trim();
                if (!v || seen.has(v)) return;
                seen.add(v);
                finalTags.push(v);
            };
            if (original.category) pushTag(original.category);
            tags.forEach(pushTag);

            // Blog posts own only NSFW + Deleted here; their title, description
            // and tags are edited through "Edit Content" (the blog editor), so
            // we deliberately leave those metadata keys — and the on-chain title
            // — untouched. Pixel-art posts own the full set plus PIXA_LICENSE.
            const metaPatch = isPixelArt
                ? {
                    tags: finalTags,
                    description: description || "",
                    nsfw: !!nsfw,
                    deleted: !!deleted,
                }
                : {
                    nsfw: !!nsfw,
                    deleted: !!deleted,
                };

            // License — pixel-art posts only. Every field under `license` is
            // guaranteed to be defined: a null-valued or missing nested key
            // makes the comment-op signature diverge from the bytes the chain
            // reconstructs, surfacing as "Missing Posting Authority" (the
            // exact construction NewPost uses on publish).
            if (isPixelArt) {
                metaPatch.license = {
                    type: "PIXA_LICENSE",
                    version: licenseCustomization?.version || "1.0",
                    rightsConfiguration: licenseCustomization?.rightsConfiguration || { holderRights: {}, visitorRights: {} },
                    royaltyPercentage: licenseCustomization?.royaltyPercentage ?? 0,
                    governingLaw: licenseCustomization?.governingLaw || { jurisdiction: "" },
                    isCustomized: !!licenseCustomization?.isCustomized,
                };
            }

            await api.broadcast.updateComment({
                author: authorUsername,
                permlink,
                // Title is only re-sent for pixel-art posts. Omitting it for blog
                // posts keeps the chain's current title (owned by the blog
                // editor) — updateComment preserves any field left undefined.
                ...(isPixelArt ? { title: title.trim() } : {}),
                jsonMetadata: metaPatch,       // shallow-merged onto current metadata
                // Pixel-art "delete the body content": replace the encoded
                // artwork with a marker. Omitted otherwise (body unchanged).
                ...(eraseBody ? { body: "deleted" } : {}),
            });

            actions.trigger_snackbar(deleted ? t("components.edit_post_dialog.post_updated_marked_as_deleted") : t("components.edit_post_dialog.post_updated"));
            onUpdated?.({
                author: authorUsername,
                permlink,
                title: title.trim(),
                tags: finalTags,
                description: description || "",
                nsfw: !!nsfw,
                deleted: !!deleted,
                bodyErased: !!eraseBody,
                // The merged metadata string the chain now holds — lets the
                // open Post/BlogPost dialogs refresh data.json_metadata so
                // their license viewers and inspectors stay accurate.
                jsonMetadata: JSON.stringify({ ...(original.meta || {}), ...metaPatch }),
            });
            setSaving(false);
            onClose?.();
        } catch (e) {
            console.warn("[EditPostDialog] save failed:", e.message);
            actions.trigger_snackbar(e.message || "Failed to update post");
            setSaving(false);
        }
    }, [canSave, api, original, tags, deleted, description, nsfw, title, eraseBody,
        isPixelArt, licenseCustomization, authorUsername, permlink, onUpdated, onClose]);

    const notOwner = !!account && !!authorUsername && account !== authorUsername;

    return (
        <React.Fragment>
            <Dialog
                open={!!open}
                onClose={saving ? undefined : onClose}
                maxWidth="sm"
                fullWidth
                classes={{ paper: classes.dialogPaper }}
            >
                <DialogTitle className={classes.dialogTitle} disableTypography>
                    <Typography variant="h6">{t("words.edit_post_details")}</Typography>
                    <Typography className={classes.subtitle}>
                        @{authorUsername}/{permlink}
                    </Typography>
                </DialogTitle>
                <DialogContent>
                    {loading ? (
                        <div className={classes.loadingWrap}>
                            <CircularProgress size={32} style={{ color: "#888" }} />
                            <Typography variant="body2" style={{ color: "#666" }}>
                                {t("components.edit_post_dialog.loading_the_on_chain_version")}
                            </Typography>
                        </div>
                    ) : loadError ? (
                        <div className={classes.loadingWrap}>
                            <WarningRounded style={{ fontSize: 40, color: "#666" }} />
                            <Typography variant="body2" style={{ color: "#888" }}>{loadError}</Typography>
                        </div>
                    ) : (
                        <Fade in timeout={300}>
                            <div>
                                {notOwner && (
                                    <Typography variant="body2" style={{ color: "#ccc", marginBottom: 12 }}>{t("components.edit_post_dialog.only_can_edit_this_post", {
                                            authorUsername: authorUsername
                                        })}</Typography>
                                )}

                                {/* Blog (community) posts edit their title, description and
                                    tags through "Edit Content"; keeping them out here avoids
                                    two competing sources of truth and mixing community posts
                                    with regular pixel-art tags. Only NSFW + Deleted live here. */}
                                {!isPixelArt && (
                                    <Typography variant="body2" style={{ color: "#888", marginBottom: 4 }}>
                                        {t("components.edit_post_dialog.title_description_and_tags_for_this_post")}
                                    </Typography>
                                )}

                                {isPixelArt && (
                                    <React.Fragment>
                                        <TextField
                                            style={{ marginTop: 8 }}
                                            value={title}
                                            fullWidth
                                            label={t("components.edit_post_dialog.title")}
                                            variant="outlined"
                                            onChange={(e) => setTitle(e.target.value)}
                                            inputProps={{ maxLength: titleMax + 10 }}
                                        />
                                        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                                            {titleError ? (
                                                <Typography className={classes.errorText}>{titleError}</Typography>
                                            ) : <span />}
                                            <Typography className={getCounterClass(title.length, titleMax)}>
                                                {title.length}/{titleMax}
                                            </Typography>
                                        </Box>
                                        <ToxicityWatcher text={title} label="title" />

                                        <TextField
                                            style={{ marginTop: 16 }}
                                            label={t("words.description")}
                                            multiline
                                            minRows={4}
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            variant="outlined"
                                            fullWidth
                                            inputProps={{ maxLength: VALIDATION.DESCRIPTION_MAX_LENGTH + 100 }}
                                        />
                                        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                                            {descriptionError ? (
                                                <Typography className={classes.errorText}>{descriptionError}</Typography>
                                            ) : <span />}
                                            <Typography className={getCounterClass(description.length, VALIDATION.DESCRIPTION_MAX_LENGTH)}>
                                                {description.length}/{VALIDATION.DESCRIPTION_MAX_LENGTH}
                                            </Typography>
                                        </Box>
                                        <ToxicityWatcher text={description} label="description" />

                                        <Box style={{ marginTop: 16, marginBottom: 8 }}>
                                            <Autocomplete
                                                multiple
                                                freeSolo
                                                classes={{ paper: classes.tagPopper }}
                                                value={displayTags}
                                                options={[]}
                                                onChange={(e, newValue, reason) => {
                                                    if (reason === "select-option" || reason === "create-option") {
                                                        const lastTag = newValue[newValue.length - 1];
                                                        const raw = typeof lastTag === "string" ? lastTag : (lastTag && lastTag.label || "");
                                                        const normalized = raw.toLowerCase().trim();
                                                        if (normalized === "deleted") return; // reserved by the Deleted flag
                                                        if (category && normalized === category.toLowerCase()) return; // already the fixed category
                                                        const validation = validateSingleTag(normalized);
                                                        if (!validation.valid) {
                                                            actions.trigger_snackbar(validation.error);
                                                            return;
                                                        }
                                                        if (tags.includes(normalized)) return;
                                                        if (displayTags.length >= VALIDATION.TAGS_MAX_COUNT) {
                                                            actions.trigger_snackbar(t("words.maximum_tags_max_count_tags_allowed", {
                                                                TAGS_MAX_COUNT: VALIDATION.TAGS_MAX_COUNT
                                                            }));
                                                            return;
                                                        }
                                                        setTags([...tags, normalized]);
                                                    } else if (reason === "remove-option") {
                                                        // The category chip exposes no delete control, but a backspace on an
                                                        // empty input can still target it — always strip it back out so it survives.
                                                        const cat = category.toLowerCase();
                                                        setTags(newValue.filter(t => typeof t === "string" && t.toLowerCase() !== cat));
                                                    } else if (reason === "clear") {
                                                        setTags([]); // clears user tags only; the fixed category is re-added for display
                                                    }
                                                }}
                                                renderTags={(value, getTagProps) =>
                                                    value.map((tag, index) => {
                                                        const tagProps = getTagProps({ index });
                                                        const chipLabel = <span><span style={{ color: "#888", marginRight: 2 }}>#</span>{tag}</span>;
                                                        // First chip is the fixed category: no delete control, lock + tooltip.
                                                        if (category && index === 0) {
                                                            const { onDelete, ...rest } = tagProps;
                                                            return (
                                                                <Tooltip key={`category-${tag}`} arrow title={t("components.edit_post_dialog.category_is_fixed_and_cannot_change", {
                                                                    tag: tag
                                                                })}>
                                                                    <Chip
                                                                        {...rest}
                                                                        icon={<LockRounded />}
                                                                        className={classes.fixedCategoryChip}
                                                                        label={chipLabel}
                                                                    />
                                                                </Tooltip>
                                                            );
                                                        }
                                                        return (
                                                            <Chip
                                                                {...tagProps}
                                                                key={tag}
                                                                label={chipLabel}
                                                            />
                                                        );
                                                    })
                                                }
                                                renderInput={(params) => (
                                                    <TextField
                                                        {...params}
                                                        variant="outlined"
                                                        label={t("words.tags")}
                                                        placeholder={displayTags.length < VALIDATION.TAGS_MAX_COUNT ? "Add tag and press Enter" : ""}
                                                    />
                                                )}
                                            />
                                            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mt={0.5}>
                                                {tagsError ? (
                                                    <Typography className={classes.errorText}>{tagsError}</Typography>
                                                ) : (
                                                    <Typography className={classes.charCounter} style={{ color: "#666" }}>
                                                        {t("components.edit_post_dialog.tags_lowercase_no_dots_min_3_chars")}
                                                    </Typography>
                                                )}
                                                <Typography className={displayTags.length > VALIDATION.TAGS_MAX_COUNT ? classes.charCounterError : classes.charCounter}>
                                                    {displayTags.length}/{VALIDATION.TAGS_MAX_COUNT}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </React.Fragment>
                                )}

                                <Box className={classes.switchBox}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={nsfw}
                                                onChange={(e) => setNsfw(e.target.checked)}
                                                color="primary"
                                            />
                                        }
                                        label={t("words.not_safe_for_work")}
                                    />
                                    <Typography variant="caption" style={{ color: "#888", display: "block", marginLeft: 48 }}>
                                        {t("components.edit_post_dialog.enable_this_if_your_content_contains_mature")}
                                    </Typography>
                                </Box>

                                {isPixelArt && licenseCustomization && (
                                    <Box className={classes.licenseBox}>
                                        <Box display="flex" alignItems="center" justifyContent="space-between">
                                            <Typography className={classes.licenseTitle}>
                                                <GavelIcon /> {t("words.nft_license")}
                                            </Typography>
                                            {licenseCustomization.isCustomized && (
                                                <Chip
                                                    icon={<CheckCircleIcon />}
                                                    label={t("words.configured")}
                                                    size="small"
                                                    className={classes.configuredChip}
                                                />
                                            )}
                                        </Box>
                                        <Box style={{ marginTop: 8 }}>
                                            <div className={classes.licenseStat}>
                                                <span className={classes.licenseStatLabel}>{t("components.edit_post_dialog.holder_rights")}</span>
                                                <span className={classes.licenseStatValue}>{licenseSummary.holderRights} granted</span>
                                            </div>
                                            <div className={classes.licenseStat}>
                                                <span className={classes.licenseStatLabel}>{t("components.edit_post_dialog.visitor_rights")}</span>
                                                <span className={classes.licenseStatValue}>{licenseSummary.visitorRights} granted</span>
                                            </div>
                                            <div className={classes.licenseStat}>
                                                <span className={classes.licenseStatLabel}>{t("words.royalty")}</span>
                                                <span className={classes.licenseStatValue}>{licenseSummary.royalty}%</span>
                                            </div>
                                            <div className={classes.licenseStat}>
                                                <span className={classes.licenseStatLabel}>{t("words.jurisdiction")}</span>
                                                <span className={classes.licenseStatValue}>{licenseCustomization.governingLaw?.jurisdiction || "Not set"}</span>
                                            </div>
                                        </Box>
                                        <Button
                                            variant="outlined"
                                            fullWidth
                                            size="small"
                                            className={classes.licenseButton}
                                            onClick={openLicenseDialog}
                                        >
                                            {licenseCustomization.isCustomized ? "Edit license" : "Configure license"}
                                        </Button>
                                    </Box>
                                )}

                                <Box className={classes.deletedBox}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={deleted}
                                                onChange={(e) => {
                                                    setDeleted(e.target.checked);
                                                    // Un-deleting also disarms a pending body erasure
                                                    if (!e.target.checked) { setEraseBody(false); setEraseArmed(false); }
                                                }}
                                                color="primary"
                                            />
                                        }
                                        label={t("components.edit_post_dialog.deleted")}
                                    />
                                    <Typography variant="caption" style={{ color: "#888", display: "block", marginLeft: 48 }}>
                                        {t("components.edit_post_dialog.marks_the_post_as_deleted_in_its")}
                                    </Typography>
                                </Box>

                                {isPixelArt && (
                                    <Box className={classes.dangerZone}>
                                        <Typography variant="subtitle2" style={{ color: "#aaa", marginBottom: 4 }}>
                                            {t("components.edit_post_dialog.danger_zone")}
                                        </Typography>
                                        {!eraseBody ? (
                                            <React.Fragment>
                                                <Typography variant="caption" style={{ color: "#888", display: "block", marginBottom: 8 }}>
                                                    {t("components.edit_post_dialog.erase_the_artwork_content_itself_the_post")}
                                                </Typography>
                                                {!eraseArmed ? (
                                                    <Button
                                                        variant="outlined"
                                                        size="small"
                                                        className={classes.dangerButton}
                                                        startIcon={<DeleteForeverRounded />}
                                                        onClick={armErase}
                                                    >
                                                        {t("components.edit_post_dialog.erase_artwork_content")}
                                                    </Button>
                                                ) : (
                                                    <Box display="flex" style={{ gap: 8 }}>
                                                        <Button
                                                            variant="outlined"
                                                            size="small"
                                                            className={classes.dangerButton}
                                                            startIcon={<WarningRounded />}
                                                            onClick={confirmErase}
                                                        >
                                                            {t("components.edit_post_dialog.yes_erase_it_on_save")}
                                                        </Button>
                                                        <Button size="small" style={{ color: "#888" }} onClick={cancelErase}>
                                                            {t("words.cancel")}
                                                        </Button>
                                                    </Box>
                                                )}
                                            </React.Fragment>
                                        ) : (
                                            <Box display="flex" alignItems="center" style={{ gap: 8 }}>
                                                <WarningRounded style={{ color: "#aaa", fontSize: 18 }} />
                                                <Typography variant="caption" style={{ color: "#ccc", flex: 1 }}>
                                                    {t("components.edit_post_dialog.the_artwork_content_will_be_erased_when")}
                                                </Typography>
                                                <Button size="small" style={{ color: "#888" }} onClick={cancelErase}>
                                                    {t("words.undo")}
                                                </Button>
                                            </Box>
                                        )}
                                        <Typography variant="caption" style={{ color: "#555", display: "block", marginTop: 8 }}>
                                            {t("components.edit_post_dialog.replacing_the_artwork_with_a_new_image")}
                                        </Typography>
                                    </Box>
                                )}
                            </div>
                        </Fade>
                    )}
                </DialogContent>
                <DialogActions style={{ padding: "8px 24px 16px" }}>
                    <Button className={classes.cancelButton} onClick={onClose} disabled={saving}>
                        {t("words.cancel")}
                    </Button>
                    <Button className={classes.saveButton} onClick={handleSave} disabled={!canSave}>
                        {saving ? "Saving…" : (eraseBody ? "Save & erase" : "Save changes")}
                    </Button>
                </DialogActions>
            </Dialog>
            {/* NewPost's license editor, reused verbatim — same base, same
            customization contract, fed with the post's stored license. */}
            {isPixelArt && licenseCustomization && (
                <LicenseCustomizationDialog
                    open={licenseDialogOpen}
                    onClose={closeLicenseDialog}
                    onSave={saveLicenseCustomization}
                    licenseBase={PIXA_LICENSE_BASE}
                    initialCustomization={licenseCustomization}
                />
            )}
        </React.Fragment>
    );
}

/* ════════════════════════════════════════════════════════════════════════
 * DeletePostDialog — quick soft-delete confirm used by the card menus.
 *
 * Marks the post deleted (metadata tag) and, for pixel-art posts, also
 * erases the body content — the platform's "delete a post" semantics.
 * Performs the broadcast itself so pages only have to mount it with state.
 * ════════════════════════════════════════════════════════════════════════ */
function DeletePostDialogInner({ classes, open, onClose, api, data, onDeleted }) {
    const [deleting, setDeleting] = useState(false);

    const authorUsername = getAuthorUsername(data);
    const permlink = data?.permlink || "";
    const isPixelArt = (data?._content_type || "pixel_art") !== "blog";

    const handleConfirm = useCallback(async () => {
        if (!api?.broadcast || !authorUsername || !permlink) return;
        setDeleting(true);
        let removedProposal = false;
        try {
            // If the post is a DAO proposal (proposals are blog posts), remove
            // the linked proposal alongside it. We resolve it by creator+permlink
            // since the post doesn't carry the proposal id. This runs FIRST so a
            // failure here aborts before the post is touched — we never want a
            // post marked deleted while its proposal stays live on-chain.
            if (!isPixelArt) {
                const proposal = await findProposalForPost(api, authorUsername, permlink);
                if (proposal) {
                    const pid = proposal.proposal_id != null ? proposal.proposal_id : proposal.id;
                    if (pid != null) {
                        await api.broadcast.removeProposal(authorUsername, [pid]);
                        removedProposal = true;
                    }
                }
            }

            await api.broadcast.updateComment({
                author: authorUsername,
                permlink,
                // Metadata flag only — never a tag, so deleted posts can't
                // be enumerated through a browsable tag page.
                jsonMetadata: { deleted: true },
                // Pixel art: deleting also wipes the encoded artwork body.
                ...(isPixelArt ? { body: "deleted" } : {}),
            });
            actions.trigger_snackbar(removedProposal ? t("components.edit_post_dialog.post_and_proposal_removed") : t("components.edit_post_dialog.post_deleted"));
            onDeleted?.(data);
            setDeleting(false);
            onClose?.();
        } catch (e) {
            console.warn("[DeletePostDialog] delete failed:", e.message);
            actions.trigger_snackbar(e.message || "Failed to delete post");
            setDeleting(false);
        }
    }, [api, authorUsername, permlink, isPixelArt, data, onDeleted, onClose]);

    return (
        <Dialog
            open={!!open}
            onClose={deleting ? undefined : onClose}
            maxWidth="xs"
            fullWidth
            classes={{ paper: classes.dialogPaper }}
        >
            <DialogTitle className={classes.dialogTitle} disableTypography>
                <Typography variant="h6">{t("components.edit_post_dialog.delete_this_post")}</Typography>
                <Typography className={classes.subtitle}>
                    {data?.title ? `"${data.title}" — ` : ""}@{authorUsername}/{permlink}
                </Typography>
            </DialogTitle>
            <DialogContent>
                <Typography variant="body2" style={{ color: "#aaa" }}>
                    {t("components.edit_post_dialog.the_post_is_marked_as_deleted_in")}
                </Typography>
                {isPixelArt && (
                    <Typography variant="body2" style={{ color: "#ccc", marginTop: 8 }}>
                        {t("components.edit_post_dialog.the_artwork_content_post_body_is_erased")}
                    </Typography>
                )}
                {!isPixelArt && (
                    <Typography variant="body2" style={{ color: "#ccc", marginTop: 8 }}>
                        {t("components.edit_post_dialog.if_this_post_is_a_dao_proposal")}
                    </Typography>
                )}
                <Typography variant="caption" style={{ color: "#666", display: "block", marginTop: 12 }}>
                    {t("components.edit_post_dialog.blockchain_posts_with_votes_can_never_be")}
                </Typography>
            </DialogContent>
            <DialogActions style={{ padding: "8px 24px 16px" }}>
                <Button className={classes.cancelButton} onClick={onClose} disabled={deleting}>
                    {t("words.cancel")}
                </Button>
                <Button
                    variant="outlined"
                    className={classes.dangerButton}
                    startIcon={deleting ? <CircularProgress size={16} style={{ color: "#888" }} /> : <DeleteForeverRounded />}
                    onClick={handleConfirm}
                    disabled={deleting}
                >
                    {deleting ? "Deleting…" : "Delete post"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

const EditPostDialog = withStyles(styles)(EditPostDialogInner);
export const DeletePostDialog = withStyles(styles)(DeletePostDialogInner);
export default EditPostDialog;