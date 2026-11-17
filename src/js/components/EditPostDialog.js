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
import BrushRounded from "@material-ui/icons/BrushRounded";
import LicenseCustomizationDialog from "./LicenseCustomizationDialog";
import PixelEditorDialog, { preloadPixelEditor } from "./pixel-editor";
import { PIXA_LICENSE_BASE, createDefaultCustomization } from "../utils/pixa_license";
import { readAiDisclosure, editedAiDisclosure } from "../utils/ai_provenance";
import {
    ARTWORK, ARTWORK_BODY_MAX_LENGTH, readArtworkBody, decodeArtworkBody, encodeArtworkBody, sameImageData, artworkKb
} from "../utils/artwork_body";
import { nsfwImageKey, warmNsfwCheck, peekNsfw, checkNsfw } from "../utils/nsfw_suggest";
import * as actions from "../actions/utils";

import { t, tk, tx, useLanguage, getLocaleCode } from "../utils/text";

const { useState, useEffect, useCallback, useMemo, useRef } = React;

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
 * Pixel-art posts carry NewPost's AI disclosure too: the "Original content"
 * switch (json_metadata.oc) under NSFW, and the "AI used" field (.ai) below
 * it (utils/ai_provenance.js). A post published before those keys existed
 * shows the switch as not declared, and gains the keys only once the author
 * sets one here. An AI the post declares can be reworded, not removed.
 *
 * The artwork itself (the body: one lossless WebP as a data URI) opens in
 * NewPost's pixel editor. The post's picture is decoded when the editor is
 * first asked for, the editor's Done is encoded as NewPost encodes a new
 * artwork (utils/artwork_body.js), and Save sends it as the new body. A Done
 * without a change replaces nothing; Reset drops the edits; a picture over
 * what one request to the API can carry cannot be saved. Like the picture
 * NewPost publishes, the edited one gets the on-device NSFW check, which
 * turns the NSFW switch on when it looks sensitive (utils/nsfw_suggest.js).
 *
 * For pixel-art posts a separate, explicitly-confirmed danger action erases
 * the body content itself (the encoded artwork) — irreversible by design,
 * per the platform's soft-delete model: posts with votes can never be
 * removed with delete_comment, so "deleting" a pixel-art post means wiping
 * its body and tagging it `deleted`. Erasing wins over an edited artwork.
 *
 * All writes go through api.broadcast.updateComment(), which performs
 * HIVE-style content patching (same permlink + parent ⇒ edit) and emits
 * `content_updated` so open pages refresh themselves.
 * ════════════════════════════════════════════════════════════════════════ */

const VALIDATION = {
    TITLE_MAX_LENGTH_PIXEL: 24,   // matches NewPost
    TITLE_MAX_LENGTH_BLOG: 250,   // chain limit is < 256
    DESCRIPTION_MAX_LENGTH: 1024,
    AI_MAX_LENGTH: 128,           // matches NewPost's "AI used" field
    TAGS_MAX_COUNT: 5,
    TAG_MIN_LENGTH: 3,
    TAG_PATTERN: /^[a-z][a-z0-9\-]*$/,
    TAG_STARTS_WITH_NUMBER_OR_MINUS: /^[0-9\-]/,
    TAG_CONTAINS_DOT: /\./
};

// The artwork in the pixel editor, from one opening of the dialog to the next.
const ARTWORK_IDLE = Object.freeze({
    source: null,         // ImageData of the post's picture, decoded once
    opening: false,       // decoding it for the editor
    failed: false,        // it could not be decoded
    editorOpen: false,
    edited: null,         // ImageData from the editor's Done, when it changed the picture
    project: null,        // the editor's layered project, to reopen with the layers
    body: null,           // `edited` encoded: the new post body
    encoding: false,
    encodeFailed: false,
});

// A weight shown to the user, with the app locale's decimal separator (as NewPost).
const formatKb = (kb) => Number(kb).toLocaleString(getLocaleCode(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});
// The heaviest artwork an edit can send, counted as artworkKb counts: 750 kB.
const ARTWORK_MAX_KB = Math.floor(ARTWORK_BODY_MAX_LENGTH * 3 / 4 / 1000);

// `error` is a tk() descriptor — resolve it with tx() where it is shown. The
// messages are the same as NewPost's, so its keys are reused.
const validateSingleTag = (tag) => {
    if (!tag || tag.length < VALIDATION.TAG_MIN_LENGTH) {
        return { valid: false, error: tk("words.tag_must_be_at_least_tag_min", {
            TAG_MIN_LENGTH: VALIDATION.TAG_MIN_LENGTH
        }) };
    }
    if (VALIDATION.TAG_STARTS_WITH_NUMBER_OR_MINUS.test(tag)) {
        return { valid: false, error: tk("components.new_post.tag_cannot_begin_with_a_number_or_minus_sign") };
    }
    if (VALIDATION.TAG_CONTAINS_DOT.test(tag)) {
        return { valid: false, error: tk("components.new_post.tag_cannot_contain_dots") };
    }
    if (!VALIDATION.TAG_PATTERN.test(tag)) {
        return { valid: false, error: tk("components.new_post.tag_can_only_contain_lowercase_letters_numbers") };
    }
    return { valid: true, error: null };
};

// An Error that also carries its user-facing text as a tk() descriptor
// (`i18n`); `message` stays English for the logs.
const i18nError = (message, descriptor) => {
    const error = new Error(message);
    error.i18n = descriptor;
    return error;
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
    artworkBox: {
        marginTop: theme.spacing(1),
        marginBottom: theme.spacing(1),
        padding: theme.spacing(1.5),
        borderRadius: "21px",
        border: "1px solid #333",
        transition: "opacity 200ms",
    },
    artworkThumb: {
        width: 64,
        height: 64,
        flexShrink: 0,
        objectFit: "contain",
        imageRendering: "pixelated",
        borderRadius: 12,
        // Transparent pixels show as a dark checkerboard.
        background: "repeating-conic-gradient(#2a2a2a 0% 25%, #202020 0% 50%) 50% / 12px 12px",
    },
    artworkMeta: { color: "#888", fontSize: "0.75rem", marginTop: 2 },
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
    useLanguage();
    const [loading, setLoading] = useState(false);
    // A tk() descriptor for our own errors, or the API's message string.
    const [loadError, setLoadError] = useState(null);
    const [saving, setSaving] = useState(false);

    // Editable fields (hydrated from the raw on-chain version on open)
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [tags, setTags] = useState([]);
    const [nsfw, setNsfw] = useState(false);
    // NSFW check of an edited picture (see the effect below): running, and
    // whether the switch is on because of it. The refs let that effect read
    // the switch without re-running on it; nsfwOverrideRef is the author
    // setting the switch for the picture nsfwKeyRef names.
    const [nsfwChecking, setNsfwChecking] = useState(false);
    const [nsfwAuto, setNsfwAuto] = useState(false);
    const nsfwRef = useRef(false);
    nsfwRef.current = nsfw;
    const nsfwAutoRef = useRef(false);
    nsfwAutoRef.current = nsfwAuto;
    const nsfwOverrideRef = useRef(false);
    const nsfwKeyRef = useRef(null);
    // AI disclosure — pixel-art only (json_metadata.oc / .ai, see NewPost).
    // `oc` stays null while the post has never declared it and the author
    // hasn't touched the switch: nothing is written for it then.
    const [oc, setOc] = useState(null);
    const [aiUsed, setAiUsed] = useState("");
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
    // The artwork in the pixel editor (pixel art only), see ARTWORK_IDLE.
    // Decodes and encodes run in the background: each takes a token, and a
    // result whose token is no longer the latest is dropped (a Reset, a newer
    // Done, a close or another opening came in between).
    const [artwork, setArtwork] = useState(ARTWORK_IDLE);
    const artworkTokenRef = useRef(0);
    useEffect(() => () => { artworkTokenRef.current++; }, []);

    const authorUsername = getAuthorUsername(data);
    const permlink = data?.permlink || "";
    const contentType = data?._content_type || "pixel_art";
    const isPixelArt = contentType !== "blog";
    const titleMax = isPixelArt ? VALIDATION.TITLE_MAX_LENGTH_PIXEL : VALIDATION.TITLE_MAX_LENGTH_BLOG;

    // ── Hydrate from the chain whenever the dialog opens ────────────────
    useEffect(() => {
        // An artwork edit belongs to one opening: closing drops its pixels
        // (several MB for a large picture), and opening starts from the post.
        artworkTokenRef.current++;
        setArtwork(ARTWORK_IDLE);
        setNsfwChecking(false);
        setNsfwAuto(false);
        nsfwOverrideRef.current = false;
        nsfwKeyRef.current = null;
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
                    throw i18nError("Missing post identifiers", tk("components.edit_post_dialog.missing_post_identifiers"));
                }
                const raw = await api.content.getContent(authorUsername, permlink, { raw: true });
                if (cancelled) return;
                if (!raw || !raw.author) throw i18nError("Post not found on chain", tk("components.edit_post_dialog.post_not_found_on_chain"));

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
                // AI disclosure as stored (the raw metadata keeps an empty
                // `ai`, which the sanitized copy would have dropped).
                const disclosure = readAiDisclosure(meta);
                const storedAi = typeof meta.ai === "string" ? meta.ai : "";
                setOc(disclosure ? disclosure.oc : null);
                setAiUsed(storedAi);
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
                    // The artwork as stored, and what it is: a picture the
                    // pixel editor can open, an erased one, or neither.
                    body: typeof raw.body === "string" ? raw.body : "",
                    artwork: readArtworkBody(raw.body),
                    // Whether the post carries the AI disclosure, and the AI
                    // it declares (which may be reworded, not removed).
                    aiDeclared: !!disclosure,
                    ai: storedAi,
                });
                setLoading(false);
            } catch (e) {
                if (cancelled) return;
                console.warn("[EditPostDialog] load failed:", e.message);
                setLoadError(e.i18n || e.message || tk("components.edit_post_dialog.failed_to_load_post"));
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
    // tk() descriptors, not t() strings: they also gate canSave, and t()
    // answers "" until the language file has loaded. Shown with tx().
    const titleError = !title.trim()
        ? tk("components.new_post.title_is_required")
        : title.length > titleMax ? tk("components.edit_post_dialog.maximum_characters", {
        titleMax: titleMax
    }) : null;
    const descriptionError = description.length > VALIDATION.DESCRIPTION_MAX_LENGTH
        ? tk("components.edit_post_dialog.maximum_characters_2", {
        DESCRIPTION_MAX_LENGTH: VALIDATION.DESCRIPTION_MAX_LENGTH
    }) : null;
    const tagsError = displayTags.length > VALIDATION.TAGS_MAX_COUNT
        ? tk("words.maximum_tags_max_count_tags_allowed", {
        TAGS_MAX_COUNT: VALIDATION.TAGS_MAX_COUNT
    }) : null;
    // "AI used": NewPost's limit and messages. An AI the post declares can be
    // reworded or added to, never emptied.
    const aiError = aiUsed.length > VALIDATION.AI_MAX_LENGTH
        ? tk("components.new_post.ai_used_must_be_characters_or_less_currently", {
            AI_MAX_LENGTH: VALIDATION.AI_MAX_LENGTH,
            ai_count: aiUsed.length
        })
        : ((original?.ai || "").trim() && !aiUsed.trim())
            ? tk("components.new_post.ai_used_is_required")
            : null;
    // The artwork: an edited picture is what Save sends as the body (unless
    // the artwork is being erased), so Save waits until it is encoded and
    // refuses one that could not be, or that one request cannot carry.
    const artworkPending = isPixelArt && !!artwork.edited && !eraseBody;
    const artworkTooLarge = !!artwork.body && artwork.body.length > ARTWORK_BODY_MAX_LENGTH;
    const artworkReady = artworkPending && !!artwork.body && !artworkTooLarge;
    // Blog posts edit their title / description / tags through "Edit Content"
    // (the blog editor), so those fields aren't shown here and don't gate the
    // save — only NSFW and the Deleted flag do.
    const canSave = !loading && !saving && !loadError
        && (isPixelArt ? (!titleError && !descriptionError && !tagsError && !aiError) : true)
        && (!artworkPending || artworkReady)
        && !nsfwChecking   // an edited picture's NSFW check decides the switch first
        && account && account === authorUsername;

    const getCounterClass = (count, max) => {
        if (count > max) return classes.charCounterError;
        if (count > max * 0.8) return classes.charCounterWarning;
        return classes.charCounter;
    };

    // ── Artwork (pixel editor) ──────────────────────────────────────────
    const originalBody = original?.body || "";
    const openArtworkEditor = useCallback(async () => {
        preloadPixelEditor();
        // The edited picture gets the NSFW check: load the classifier while
        // the author draws, so that the check after Done is quick.
        warmNsfwCheck();
        if (artwork.source) {
            setArtwork((a) => ({ ...a, editorOpen: true }));
            return;
        }
        // The post's picture is decoded once, the first time it is needed.
        const token = ++artworkTokenRef.current;
        setArtwork((a) => ({ ...a, opening: true, failed: false }));
        const source = await decodeArtworkBody(originalBody).catch(() => null);
        if (token !== artworkTokenRef.current) return;
        setArtwork((a) => (source
            ? { ...a, opening: false, source, editorOpen: true }
            : { ...a, opening: false, failed: true }));
    }, [artwork.source, originalBody]);

    const closeArtworkEditor = useCallback(() => {
        setArtwork((a) => ({ ...a, editorOpen: false }));
    }, []);

    // The editor's Done. The picture is kept only if it differs from the
    // post's, and encoded right away so that Save has nothing to wait for.
    const saveArtworkEdits = useCallback(({ imageData, project }) => {
        if (artwork.edited && imageData && sameImageData(imageData, artwork.edited) && !artwork.encodeFailed) {
            // Done again on the same picture: its encoding (done or under way) still holds.
            setArtwork((a) => ({ ...a, editorOpen: false, project: project || a.project }));
            return;
        }
        const token = ++artworkTokenRef.current;
        if (!imageData || sameImageData(imageData, artwork.source)) {
            setArtwork((a) => ({ ...a, editorOpen: false, edited: null, project: null, body: null, encoding: false, encodeFailed: false }));
            return;
        }
        setArtwork((a) => ({ ...a, editorOpen: false, edited: imageData, project: project || null, body: null, encoding: true, encodeFailed: false }));
        encodeArtworkBody(imageData).then((body) => {
            if (token === artworkTokenRef.current) setArtwork((a) => ({ ...a, body, encoding: false }));
        }, (error) => {
            console.warn("[EditPostDialog] artwork encoding failed:", error?.message);
            if (token === artworkTokenRef.current) setArtwork((a) => ({ ...a, encoding: false, encodeFailed: true }));
        });
    }, [artwork.source, artwork.edited, artwork.encodeFailed]);

    const resetArtworkEdits = useCallback(() => {
        artworkTokenRef.current++;
        setArtwork((a) => ({ ...a, edited: null, project: null, body: null, encoding: false, encodeFailed: false }));
    }, []);

    // ── NSFW check of an edited picture ─────────────────────────────────
    // NewPost's rule, for the picture the pixel editor gave back: the
    // on-device classifier turns the NSFW switch on when the picture looks
    // sensitive, unless the switch is already on, or the author has set it
    // for this picture. A flag the check set goes with its picture (Reset,
    // a Done without a change, erasing the artwork), and with a later edit
    // that no longer looks sensitive. Save waits for the check, which counts
    // as "not sensitive" when it cannot run or takes too long.
    useEffect(() => {
        if (!isPixelArt) return undefined;
        if (!artwork.edited || eraseBody) {
            if (nsfwAutoRef.current) { setNsfw(false); setNsfwAuto(false); }
            return undefined;
        }
        if (!artworkReady) return undefined; // still encoding, or nothing Save would send
        const key = nsfwImageKey(artwork.body);
        if (nsfwKeyRef.current !== key) {
            // Another picture: a fresh suggestion, whatever the author set for the last one.
            nsfwKeyRef.current = key;
            nsfwOverrideRef.current = false;
        }
        if (nsfwOverrideRef.current) return undefined;
        if (nsfwRef.current && !nsfwAutoRef.current) return undefined; // on already, not by the check
        const pixels = artwork.edited;
        let cancelled = false;
        const apply = (verdict) => {
            if (cancelled || nsfwOverrideRef.current) return;
            if (verdict) { setNsfw(true); setNsfwAuto(true); }
            else if (nsfwAutoRef.current) { setNsfw(false); setNsfwAuto(false); }
        };
        // A verdict this device already has: no spinner, no wait.
        const cached = peekNsfw(key);
        if (cached !== undefined) {
            apply(cached);
            return () => { cancelled = true; };
        }
        setNsfwChecking(true);
        checkNsfw({ key, getImgData: async () => pixels }).then((verdict) => {
            if (cancelled) return;
            setNsfwChecking(false);
            apply(verdict);
        });
        return () => { cancelled = true; setNsfwChecking(false); };
    }, [isPixelArt, artwork.edited, artwork.body, artworkReady, eraseBody]);

    // A hand on the switch decides, for the picture of the moment.
    const handleNsfwChange = useCallback((e) => {
        nsfwOverrideRef.current = true;
        setNsfwAuto(false);
        setNsfwChecking(false); // a check still running no longer matters
        setNsfw(e.target.checked);
    }, []);

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
                // AI disclosure (`oc`, `ai`): rewritten when the post carries
                // it, added only once the author sets it on an older post —
                // never null (see editedAiDisclosure).
                Object.assign(metaPatch, editedAiDisclosure({
                    declared: !!original.aiDeclared,
                    oc,
                    ai: aiUsed,
                }));
            }

            // The new body, when there is one: the erase marker, or the
            // artwork edited in the pixel editor (erasing wins). Omitted
            // otherwise, and updateComment resends the current body.
            const newBody = eraseBody ? "deleted" : (artworkReady ? artwork.body : null);

            await api.broadcast.updateComment({
                author: authorUsername,
                permlink,
                // Title is only re-sent for pixel-art posts. Omitting it for blog
                // posts keeps the chain's current title (owned by the blog
                // editor) — updateComment preserves any field left undefined.
                ...(isPixelArt ? { title: title.trim() } : {}),
                jsonMetadata: metaPatch,       // shallow-merged onto current metadata
                ...(newBody ? { body: newBody } : {}),
            });

            actions.trigger_snackbar(deleted
                ? t("components.edit_post_dialog.post_updated_marked_as_deleted")
                : (artworkReady
                    ? t("components.edit_post_dialog.artwork_updated")
                    : t("components.edit_post_dialog.post_updated")));
            onUpdated?.({
                author: authorUsername,
                permlink,
                title: title.trim(),
                tags: finalTags,
                description: description || "",
                nsfw: !!nsfw,
                deleted: !!deleted,
                bodyErased: !!eraseBody,
                // The post shows another picture now: views drawn from the
                // previous one (PostDialog's canvas) have to be redrawn.
                artworkReplaced: artworkReady,
                // The merged metadata string the chain now holds — lets the
                // open Post/BlogPost dialogs refresh data.json_metadata so
                // their license viewers and inspectors stay accurate.
                jsonMetadata: JSON.stringify({ ...(original.meta || {}), ...metaPatch }),
            });
            setSaving(false);
            onClose?.();
        } catch (e) {
            console.warn("[EditPostDialog] save failed:", e.message);
            actions.trigger_snackbar(e.message || t("components.edit_post_dialog.failed_to_update_post"));
            setSaving(false);
        }
    }, [canSave, api, original, tags, deleted, description, nsfw, oc, aiUsed, title, eraseBody,
        artworkReady, artwork.body, isPixelArt, licenseCustomization, authorUsername, permlink, onUpdated, onClose]);

    const notOwner = !!account && !!authorUsername && account !== authorUsername;

    // ── Artwork box ─────────────────────────────────────────────────────
    const artworkInfo = original?.artwork || null;
    const artworkEditable = isPixelArt && artworkInfo?.status === ARTWORK.EDITABLE && !artwork.failed;
    const artworkCanOpen = artworkEditable && !artwork.opening && !eraseBody && !saving && !notOwner;
    // A picture the app's gate let through (its type is known) can be shown,
    // edited or not; the edited one once it is encoded.
    const artworkThumb = artwork.body || (artworkInfo?.mime ? originalBody : null);
    const artworkDims = artwork.edited || (artworkInfo?.width && artworkInfo?.height ? artworkInfo : null);
    const artworkMeta = !artworkInfo?.mime ? "" : [
        artworkDims && t("components.pixel_editor.size_px", { width: artworkDims.width, height: artworkDims.height }),
        artwork.body
            ? t("components.edit_post_dialog.artwork_size_change", {
                before: formatKb(artworkKb(originalBody)),
                after: formatKb(artworkKb(artwork.body))
            })
            : t("components.edit_post_dialog.artwork_size", { size: formatKb(artworkKb(originalBody)) }),
    ].filter(Boolean).join(" · ");
    let artworkCaption = t("components.edit_post_dialog.artwork_hint");
    let artworkProblem = false;
    if (!artworkInfo || artworkInfo.status === ARTWORK.ERASED) {
        artworkCaption = t("components.edit_post_dialog.artwork_erased");
    } else if (!artworkEditable) {
        artworkCaption = t("components.pixel_editor.could_not_open");
        artworkProblem = true;
    } else if (artwork.edited && artwork.encoding) {
        artworkCaption = t("components.edit_post_dialog.artwork_encoding");
    } else if (artwork.edited && artwork.encodeFailed) {
        artworkCaption = t("components.edit_post_dialog.artwork_encode_failed");
        artworkProblem = true;
    } else if (artworkTooLarge) {
        artworkCaption = t("components.edit_post_dialog.artwork_too_large", {
            size: formatKb(artworkKb(artwork.body)),
            max: ARTWORK_MAX_KB.toLocaleString(getLocaleCode())
        });
        artworkProblem = true;
    }

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
                            <Typography variant="body2" style={{ color: "#888" }}>{tx(loadError)}</Typography>
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
                                        {/* The artwork itself, edited in NewPost's pixel editor.
                                            Dimmed while an erase is pending: erasing wins. */}
                                        <Box className={classes.artworkBox} style={eraseBody ? { opacity: 0.45 } : undefined}>
                                            <Box display="flex" alignItems="center" style={{ gap: 12 }}>
                                                {artworkThumb && (
                                                    <img src={artworkThumb} alt="" className={classes.artworkThumb} />
                                                )}
                                                <Box flex={1} minWidth={0}>
                                                    <Typography className={classes.licenseTitle}>
                                                        <BrushRounded /> {t("components.edit_post_dialog.artwork")}
                                                    </Typography>
                                                    {artworkMeta && (
                                                        <Typography className={classes.artworkMeta}>{artworkMeta}</Typography>
                                                    )}
                                                </Box>
                                                {artwork.edited && (
                                                    <Chip
                                                        icon={artwork.encoding
                                                            ? <CircularProgress size={12} style={{ color: "#888", marginLeft: 6 }} />
                                                            : <CheckCircleIcon />}
                                                        label={t("components.pixel_editor.edits_applied")}
                                                        size="small"
                                                        className={classes.configuredChip}
                                                    />
                                                )}
                                            </Box>
                                            <Typography variant="caption" style={{ color: artworkProblem ? "#bbb" : "#888", display: "block", marginTop: 8 }}>
                                                {artworkCaption}
                                            </Typography>
                                            {artworkEditable && (
                                                <Box display="flex" style={{ gap: 8 }}>
                                                    <Button
                                                        size="small"
                                                        className={classes.licenseButton}
                                                        disabled={!artworkCanOpen}
                                                        startIcon={artwork.opening
                                                            ? <CircularProgress size={14} style={{ color: "#888" }} />
                                                            : <BrushRounded />}
                                                        onClick={openArtworkEditor}
                                                        onMouseEnter={preloadPixelEditor}
                                                        onFocus={preloadPixelEditor}
                                                        onTouchStart={preloadPixelEditor}
                                                    >
                                                        {t("components.edit_post_dialog.edit_in_pixel_editor")}
                                                    </Button>
                                                    {artwork.edited && (
                                                        <Button
                                                            size="small"
                                                            className={classes.licenseButton}
                                                            style={{ color: "#888" }}
                                                            disabled={saving}
                                                            onClick={resetArtworkEdits}
                                                        >
                                                            {t("words.reset")}
                                                        </Button>
                                                    )}
                                                </Box>
                                            )}
                                        </Box>

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
                                                <Typography className={classes.errorText}>{tx(titleError)}</Typography>
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
                                                <Typography className={classes.errorText}>{tx(descriptionError)}</Typography>
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
                                                            actions.trigger_snackbar(tx(validation.error));
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
                                                        placeholder={displayTags.length < VALIDATION.TAGS_MAX_COUNT ? t("components.edit_post_dialog.add_tag_and_press_enter") : ""}
                                                    />
                                                )}
                                            />
                                            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mt={0.5}>
                                                {tagsError ? (
                                                    <Typography className={classes.errorText}>{tx(tagsError)}</Typography>
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
                                                onChange={handleNsfwChange}
                                                color="primary"
                                            />
                                        }
                                        label={
                                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                                {t("words.not_safe_for_work")}
                                                {nsfwChecking && (
                                                    <CircularProgress size={12} thickness={5} style={{ color: "#888" }} />
                                                )}
                                            </span>
                                        }
                                    />
                                    {/* NewPost's captions for its own check of the picture it publishes. */}
                                    <Typography variant="caption" style={{ color: nsfwAuto ? "#aaa" : "#888", display: "block", marginLeft: 48 }}>
                                        {nsfwChecking
                                            ? t("components.new_post.analyzing_image_for_sensitive_content")
                                            : nsfwAuto
                                                ? t("components.new_post.automatically_flagged_from_image_analysis")
                                                : t("components.edit_post_dialog.enable_this_if_your_content_contains_mature")}
                                    </Typography>

                                    {/* Original content (json_metadata.oc), as in NewPost:
                                        the picture was the author's own real picture before
                                        any style transformation. Off and "not declared" for a
                                        post published before the key existed. */}
                                    {isPixelArt && (
                                        <React.Fragment>
                                            <FormControlLabel
                                                style={{ marginTop: 8 }}
                                                control={
                                                    <Switch
                                                        checked={oc === true}
                                                        onChange={(e) => setOc(e.target.checked)}
                                                        color="primary"
                                                    />
                                                }
                                                label={t("components.new_post.original_content")}
                                            />
                                            <Typography variant="caption" style={{ color: "#888", display: "block", marginLeft: 48 }}>
                                                {oc === null
                                                    ? t("components.edit_post_dialog.original_content_not_declared")
                                                    : t("components.new_post.oc_hint")}
                                            </Typography>
                                        </React.Fragment>
                                    )}
                                </Box>

                                {/* AI used (json_metadata.ai), as in NewPost: which AI made or
                                    transformed the picture, in the author's words. */}
                                {isPixelArt && (
                                    <React.Fragment>
                                        <TextField
                                            style={{ marginTop: 16 }}
                                            value={aiUsed}
                                            fullWidth
                                            label={t("components.new_post.ai_used")}
                                            variant="outlined"
                                            onChange={(e) => setAiUsed(e.target.value)}
                                            error={!!aiError}
                                            inputProps={{ maxLength: VALIDATION.AI_MAX_LENGTH + 10 }}
                                        />
                                        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                                            {aiError ? (
                                                <Typography className={classes.errorText}>{tx(aiError)}</Typography>
                                            ) : (
                                                <Typography className={classes.errorText} style={{ color: "#666" }}>
                                                    {(original?.ai || "").trim()
                                                        ? t("components.edit_post_dialog.ai_used_as_published")
                                                        : t("components.new_post.ai_used_hint")}
                                                </Typography>
                                            )}
                                            <Typography className={getCounterClass(aiUsed.length, VALIDATION.AI_MAX_LENGTH)}>
                                                {aiUsed.length}/{VALIDATION.AI_MAX_LENGTH}
                                            </Typography>
                                        </Box>
                                    </React.Fragment>
                                )}

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
                                                <span className={classes.licenseStatValue}>{t("components.new_post.count_granted", {
                                                    granted: { granted: licenseSummary.holderRights }
                                                })}</span>
                                            </div>
                                            <div className={classes.licenseStat}>
                                                <span className={classes.licenseStatLabel}>{t("components.edit_post_dialog.visitor_rights")}</span>
                                                <span className={classes.licenseStatValue}>{t("components.new_post.count_granted", {
                                                    granted: { granted: licenseSummary.visitorRights }
                                                })}</span>
                                            </div>
                                            <div className={classes.licenseStat}>
                                                <span className={classes.licenseStatLabel}>{t("words.royalty")}</span>
                                                <span className={classes.licenseStatValue}>{licenseSummary.royalty}%</span>
                                            </div>
                                            <div className={classes.licenseStat}>
                                                <span className={classes.licenseStatLabel}>{t("words.jurisdiction")}</span>
                                                <span className={classes.licenseStatValue}>{licenseCustomization.governingLaw?.jurisdiction || t("components.new_post.not_set")}</span>
                                            </div>
                                        </Box>
                                        <Button
                                            fullWidth
                                            size="small"
                                            className={classes.licenseButton}
                                            onClick={openLicenseDialog}
                                        >
                                            {licenseCustomization.isCustomized
                                                ? t("components.edit_post_dialog.edit_license")
                                                : t("components.edit_post_dialog.configure_license")}
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
                        {saving
                            ? t("components.edit_post_dialog.saving")
                            : (eraseBody
                                ? t("components.edit_post_dialog.save_erase")
                                : t("components.edit_post_dialog.save_changes"))}
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
            {/* NewPost's pixel editor (code-split: nothing loads before the
                first opening), on the edited picture with its layers when
                there is one, else on the post's. */}
            {isPixelArt && (
                <PixelEditorDialog
                    open={!!open && artwork.editorOpen}
                    image={artwork.edited || artwork.source}
                    project={artwork.edited ? artwork.project : null}
                    onClose={closeArtworkEditor}
                    onSave={saveArtworkEdits}
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
    useLanguage();
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
            actions.trigger_snackbar(e.message || t("components.edit_post_dialog.failed_to_delete_post"));
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
            <Fade in timeout={200}>
                <DialogTitle className={classes.dialogTitle} disableTypography>
                    <Typography variant="h6">{t("components.edit_post_dialog.delete_this_post")}</Typography>
                    <Typography className={classes.subtitle}>
                        {data?.title ? `"${data.title}" — ` : ""}@{authorUsername}/{permlink}
                    </Typography>
                </DialogTitle>
            </Fade>
            <DialogContent>
                <Typography variant="body2" style={{ color: "#aaa" }}>
                    {t("components.edit_post_dialog.the_post_is_marked_as_deleted_in")}
                </Typography>
                {isPixelArt && (
                    <Fade in timeout={400}><Typography variant="body2" style={{ color: "#ccc", marginTop: 8 }}>
                        {t("components.edit_post_dialog.the_artwork_content_post_body_is_erased")}
                    </Typography></Fade>
                )}
                {!isPixelArt && (
                    <Fade in timeout={400}><Typography variant="body2" style={{ color: "#ccc", marginTop: 8 }}>
                        {t("components.edit_post_dialog.if_this_post_is_a_dao_proposal")}
                    </Typography></Fade>
                )}
                <Fade in timeout={600}><Typography variant="caption" style={{ color: "#666", display: "block", marginTop: 12 }}>
                    {t("components.edit_post_dialog.blockchain_posts_with_votes_can_never_be")}
                </Typography></Fade>
            </DialogContent>
            <DialogActions style={{ padding: "8px 24px 16px" }}>
                <Fade in timeout={800}><Button className={classes.cancelButton} onClick={onClose} disabled={deleting}>
                    {t("words.cancel")}
                </Button></Fade>
                    <Fade in timeout={1000}><Button
                    variant="contained"
                    color="primary"
                    startIcon={deleting ? <CircularProgress color="#000" size={16} /> : <DeleteForeverRounded style={{color: "#e1e1e1"}}/>}
                    onClick={handleConfirm}
                    disabled={deleting}
                >
                    {deleting
                        ? t("components.edit_post_dialog.deleting")
                        : t("components.edit_post_dialog.delete_post")}
                </Button></Fade>
            </DialogActions>
        </Dialog>
    );
}

const EditPostDialog = withStyles(styles)(EditPostDialogInner);
export const DeletePostDialog = withStyles(styles)(DeletePostDialogInner);
export default EditPostDialog;