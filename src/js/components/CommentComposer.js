import * as React from "preact/compat";
import { memo, useCallback, useEffect, useRef, useState } from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import TextField from "@material-ui/core/TextField";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import CircularProgress from "@material-ui/core/CircularProgress";
import FormatBoldIcon from "@material-ui/icons/FormatBold";
import FormatItalicIcon from "@material-ui/icons/FormatItalic";
import FormatQuoteIcon from "@material-ui/icons/FormatQuote";
import FormatListBulletedIcon from "@material-ui/icons/FormatListBulleted";
import FormatListNumberedIcon from "@material-ui/icons/FormatListNumbered";
import ImageIcon from "@material-ui/icons/Image";
import CloseIcon from "@material-ui/icons/Close";

import * as actions from "../actions/utils";
import { t, tx, getLocaleCode, useLanguage } from "../utils/text";
import { storeImageOnArweave } from "../utils/lexical/arweaveImage";
import { getImageProxyBase, inspectImageDataUri } from "../utils/api/sanitizer";
import {
    MAX_COMMENT_IMAGES, commentBodyForBroadcast, toggleInline, toggleQuote, cycleList, continueOnNewline,
    insertImage, removeFirstImage, formatState, altFromFileName,
} from "../utils/commentMarkdown";

export { MAX_COMMENT_IMAGES, commentBodyForBroadcast, commentImageProblem } from "../utils/commentMarkdown";

/* ══════════════════════════════════════════════════════════════════════
 * Comment composer: a format bar over a multi-line markdown text area.
 *
 *   B  I  ❝  ≡  🖼            [thumbnail ×]
 *   ┌──────────────────────────────────────┐
 *   │ Reply to @author                     │
 *   └──────────────────────────────────────┘
 *
 * The dialogs still read and write the text area by id (submitComment,
 * setTextFieldValue), as they always have: it holds its text in state, which
 * follows the DOM through `input` events (see CommentComposerFieldInner for
 * why it can't be uncontrolled any more). The bar only rewrites its
 * markdown (utils/commentMarkdown): **bold**,
 * *italic*, > quote, the list button's three states (none → bullets →
 * numbers → none) and one image, uploaded to Arweave like the blog editor's
 * (utils/lexical/arweaveImage: WebP, ≤ 99 kB) and written as ![alt](url).
 * A comment holds MAX_COMMENT_IMAGES (one): picking another image replaces
 * it, and the comment tier renders only the first.
 *
 * FormatBar is exported on its own for any other text area — give the
 * TextField an id and render <FormatBar targetId={id} /> above it (and
 * onKeyDown={(e) => handleComposerKeyDown(e)} on the field for the
 * shortcuts and list continuation). It follows the field through
 * document-level listeners filtered by that id, so it survives the field
 * remounting under it. `maxImages` is 1 (the default) or 0 for a field
 * that takes no image. A multi-line field it edits must be controlled
 * (value + onChange) for the reason given in CommentComposerFieldInner;
 * its edits fire `input`, i.e. the field's onChange.
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * How comment-tier images (class "pixa-comment-image", see the sanitizer's
 * comment tier) sit in a thread. Spread under
 * `"& img.pixa-comment-image"` in the container that renders comment HTML.
 */


export const commentImageStyles = Object.freeze({
    display: "block",
    maxWidth: "100%",
    maxHeight: 360,
    width: "auto",
    height: "auto",
    margin: "8px 0",
    borderRadius: 16,
    backgroundColor: "#0c0c0c",
});

// A translated string, or `fallback` while the key is not in the locales yet.
function tOr(key, fallback, vars) {
    let s = "";
    try { s = t(key, vars); } catch (e) { s = ""; }
    return typeof s === "string" && s && s !== key && s.indexOf(key) === -1 ? s : fallback;
}

/** The snackbar text for a comment over its image limit. */
export function commentImageLimitMessage() {
    return tOr("components.comment_composer.one_image_per_comment",
        "A comment can show one image. Remove the other ones to post it.");
}

/* ── Applying an edit ─────────────────────────────────────────────────── */

function setNativeValue(el, value) {
    const proto = Object.getPrototypeOf(el);
    const desc = proto && Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
}

/**
 * Apply an edit ({ from, to, text, selStart, selEnd }) to a text area as ONE
 * insertText — the browser's own undo stack keeps it, and it fires the
 * `input` event that resizes the field and feeds the toxicity watcher and
 * the bar. Where insertText is unavailable the value is written and an
 * `input` event dispatched instead (the same thing setTextFieldValue does).
 */
export function applyEdit(el, edit) {
    if (!el || !edit) return;
    const before = el.value;
    const expected = before.slice(0, edit.from) + edit.text + before.slice(edit.to);
    let done = false;
    if (!el.disabled && !el.readOnly) {
        try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) {} }
        try {
            el.setSelectionRange(edit.from, edit.to);
            if (edit.text) done = document.execCommand("insertText", false, edit.text);
            else done = edit.to > edit.from ? document.execCommand("delete", false) : true;
        } catch (e) {
            done = false;
        }
    }
    if (!done || el.value !== expected) {
        setNativeValue(el, expected);
        try { el.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) {}
    }
    try { el.setSelectionRange(edit.selStart, edit.selEnd); } catch (e) {}
}

// Enter sends where there is a hardware keyboard to Shift+Enter with; on a
// touch screen it writes a new line and the send button sends.
function enterSends() {
    try {
        return !(typeof window !== "undefined" && window.matchMedia
            && window.matchMedia("(hover: none) and (pointer: coarse)").matches);
    } catch (e) {
        return true;
    }
}

/**
 * Keys of a composer text area:
 *   Ctrl/⌘+B, Ctrl/⌘+I     bold, italic
 *   Ctrl/⌘+Enter           send
 *   Enter                  send (touch screens: new line) — but in a list
 *                          it adds the next item, or ends the list on an
 *                          empty one, so a list never posts half-written
 *   Shift+Enter            new line, continuing a list or a quote
 * Without `submit` (a field that is not sent on Enter) Enter is Shift+Enter.
 */
export function handleComposerKeyDown(e, submit) {
    if (!e || e.defaultPrevented) return;
    const el = e.target;
    if (!el || el.tagName !== "TEXTAREA" || el.disabled || el.readOnly) return;
    if (e.isComposing || e.keyCode === 229) return; // IME: Enter confirms the word
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key || "";
    if (mod && !e.altKey && !e.shiftKey && key.length === 1) {
        const k = key.toLowerCase();
        if (k === "b" || k === "i") {
            e.preventDefault();
            applyEdit(el, toggleInline(el.value, el.selectionStart, el.selectionEnd, k === "b" ? "bold" : "italic").edit);
            return;
        }
    }
    if (key !== "Enter" || e.altKey) return;
    if (mod) {
        if (submit) {
            e.preventDefault();
            submit();
        }
        return;
    }
    // Without a submit (a description field) Enter is always a new line.
    const sends = !!submit && !e.shiftKey && enterSends();
    const edit = continueOnNewline(el.value, el.selectionStart, el.selectionEnd, { listsOnly: sends });
    if (edit) {
        e.preventDefault();
        applyEdit(el, edit);
        return;
    }
    if (sends) {
        e.preventDefault();
        if (submit) submit();
    }
}

/** The thumbnail URL for the image the text holds — through the image proxy,
 *  like every rendered image (see makeImgTransform). Null if not renderable. */
function previewSrc(url) {
    let u = String(url || "").trim();
    if (!u) return null;
    if (u.startsWith("//")) u = "https:" + u;
    if (/^data:image\//i.test(u)) {
        try { return inspectImageDataUri(u).ok ? u : null; } catch (e) { return null; }
    }
    if (!/^https:\/\//i.test(u)) return null;
    const base = getImageProxyBase();
    return base && !u.startsWith(base) ? base + encodeURIComponent(u) : u;
}

function firstImageFile(dt) {
    if (!dt) return null;
    const files = dt.files;
    if (files && files.length) {
        for (let i = 0; i < files.length; i++) {
            if (files[i] && files[i].type && files[i].type.indexOf("image/") === 0) return files[i];
        }
    }
    const items = dt.items;
    if (items && items.length) {
        for (let i = 0; i < items.length; i++) {
            const it = items[i];
            if (it && it.kind === "file" && it.type && it.type.indexOf("image/") === 0) {
                const f = it.getAsFile && it.getAsFile();
                if (f) return f;
            }
        }
    }
    return null;
}

const preventFocusSteal = (e) => e.preventDefault();

/* ── Styles ───────────────────────────────────────────────────────────── */

const styles = () => ({
    root: {
        width: "100%",
    },
    bar: {
        display: "flex",
        alignItems: "center",
        flexWrap: "nowrap",
        gap: 2,
        minHeight: 32,
        marginBottom: 2,
        userSelect: "none",
    },
    wrap: {
        display: "inline-flex",
    },
    button: {
        padding: 5,
        borderRadius: 10,
        color: "#8a8a8a",
        transition: "color 150ms ease, background-color 150ms ease",
        "& .MuiSvgIcon-root": { fontSize: 20 },
        "&:hover": { color: "#e3e3e3", backgroundColor: "rgba(255,255,255,0.06)" },
        "&.Mui-disabled": { color: "#3c3c3c" },
    },
    active: {
        color: "#ffffff",
        backgroundColor: "rgba(255,255,255,0.12)",
        "&:hover": { color: "#ffffff", backgroundColor: "rgba(255,255,255,0.16)" },
    },
    divider: {
        width: 1,
        height: 18,
        margin: "0 4px",
        backgroundColor: "#2c2c2c",
        flexShrink: 0,
    },
    spacer: {
        flex: 1,
    },
    progress: {
        color: "#bdbdbd",
    },
    thumb: {
        position: "relative",
        width: 32,
        height: 32,
        flexShrink: 0,
        borderRadius: 10,
        overflow: "hidden",
        backgroundColor: "#1a1a1a",
    },
    thumbImg: {
        display: "block",
        width: "100%",
        height: "100%",
        objectFit: "cover",
    },
    thumbRemove: {
        position: "absolute",
        top: 0,
        right: 0,
        padding: 1,
        borderRadius: "0 0 0 8px",
        color: "#ffffff",
        backgroundColor: "rgba(0,0,0,0.65)",
        "& .MuiSvgIcon-root": { fontSize: 13 },
        "&:hover": { backgroundColor: "rgba(0,0,0,0.85)" },
    },
    fileInput: {
        display: "none",
    },
});

/* ── Format bar ───────────────────────────────────────────────────────── */

const BarButton = ({ classes, title, active, pressed, disabled, onClick, children }) => (
    <Tooltip title={title} placement="top" enterDelay={400}>
        <span className={classes.wrap}>
            <IconButton
                size="small"
                aria-label={title}
                aria-pressed={pressed ? (active ? "true" : "false") : undefined}
                className={active ? classes.button + " " + classes.active : classes.button}
                disabled={disabled}
                onMouseDown={preventFocusSteal}
                onClick={onClick}
            >
                {children}
            </IconButton>
        </span>
    </Tooltip>
);

const NO_STATE = "0|0|0|none|0|";

function FormatBarInner({ classes, className, targetId, disabled, maxImages = MAX_COMMENT_IMAGES, onBusyChange }) {
    useLanguage();
    // What the buttons show, as one string so an unchanged state never
    // re-renders the bar: bold|italic|quote|list|imageCount|imageUrl.
    const [state, setState] = useState(NO_STATE);
    const [busy, setBusy] = useState(false);
    const busyRef = useRef(false);
    const mountedRef = useRef(true);
    const fileRef = useRef(null);
    const disabledRef = useRef(disabled);
    disabledRef.current = disabled;

    const getEl = useCallback(() => (targetId && typeof document !== "undefined" ? document.getElementById(targetId) : null), [targetId]);

    const refresh = useCallback(() => {
        const el = getEl();
        if (!el || typeof el.value !== "string") return;
        const st = formatState(el.value, el.selectionStart || 0, el.selectionEnd || 0);
        const next = [st.bold ? 1 : 0, st.italic ? 1 : 0, st.quote ? 1 : 0, st.list, st.imageCount, st.imageUrl].join("|");
        setState((prev) => (prev === next ? prev : next));
    }, [getEl]);

    const apply = useCallback((op) => {
        const el = getEl();
        if (!el || el.disabled || el.readOnly || disabledRef.current) return;
        const edit = op(el.value, el.selectionStart || 0, el.selectionEnd || 0);
        applyEdit(el, edit && edit.edit !== undefined ? edit.edit : edit);
        refresh();
    }, [getEl, refresh]);

    const uploadImage = useCallback(async (file) => {
        if (!file) return;
        if (!file.type || file.type.indexOf("image/") !== 0) {
            actions.trigger_snackbar(t("components.lexical_text_editor_dialog.only_image_files_can_be_uploaded"));
            return;
        }
        if (busyRef.current || disabledRef.current) return;
        busyRef.current = true;
        setBusy(true);
        if (onBusyChange) onBusyChange(true);
        actions.trigger_snackbar(t("components.lexical_text_editor_dialog.uploading_image_to_arweave"));
        try {
            // Same storage policy as the blog editor's images.
            const stored = await storeImageOnArweave(file);
            const el = getEl();
            if (el && stored && stored.url) {
                applyEdit(el, insertImage(el.value, el.selectionStart || 0, el.selectionEnd || 0, stored.url, altFromFileName(file.name)));
            }
            const sizeKb = Math.max(1, Math.round(((stored && stored.bytes) || 0) / 1024)).toLocaleString(getLocaleCode());
            actions.trigger_snackbar(stored && stored.withinFreeBudget
                ? t("components.lexical_text_editor_dialog.image_stored_on_arweave_kb_free_tier", { size: sizeKb })
                : t("components.lexical_text_editor_dialog.image_stored_on_arweave_kb", { max: sizeKb, value: "" }));
        } catch (error) {
            console.warn("[CommentComposer] image upload failed:", error && (error.message || error));
            // An upload rejection carries its translated text in `i18n`
            // (utils/lexical/arweaveImage); anything else only `message`.
            const message = error && error.i18n ? tx(error.i18n) : (error && error.message);
            actions.trigger_snackbar(message
                ? t("components.lexical_text_editor_dialog.image_upload_failed", { message })
                : t("components.lexical_text_editor_dialog.image_upload_failed_unknown_error"));
        } finally {
            busyRef.current = false;
            if (mountedRef.current) setBusy(false);
            if (onBusyChange) onBusyChange(false);
            if (mountedRef.current) refresh();
        }
    }, [getEl, refresh, onBusyChange]);
    const uploadRef = useRef(uploadImage);
    uploadRef.current = uploadImage;

    // Follow the field: its selection, its value (typing, the dialogs'
    // setTextFieldValue, our own edits), and image paste / drop into it.
    useEffect(() => {
        mountedRef.current = true;
        if (typeof document === "undefined") return undefined;
        const ours = (node) => !!node && node.id === targetId;
        const onEvent = (e) => { if (ours(e.target)) refresh(); };
        const onSelection = () => { if (ours(document.activeElement)) refresh(); };
        const canTakeImage = () => maxImages > 0 && !disabledRef.current && !busyRef.current;
        const onPaste = (e) => {
            if (!ours(e.target) || !canTakeImage()) return;
            const file = firstImageFile(e.clipboardData);
            if (!file) return;
            e.preventDefault();
            uploadRef.current(file);
        };
        const onDragOver = (e) => {
            if (!ours(e.target) || !canTakeImage()) return;
            const types = e.dataTransfer && e.dataTransfer.types;
            if (types && Array.prototype.indexOf.call(types, "Files") !== -1) e.preventDefault();
        };
        const onDrop = (e) => {
            if (!ours(e.target) || !canTakeImage()) return;
            const file = firstImageFile(e.dataTransfer);
            if (!file) return;
            e.preventDefault();
            uploadRef.current(file);
        };
        const events = ["input", "keyup", "mouseup", "select", "focusin", "touchend"];
        events.forEach((ev) => document.addEventListener(ev, onEvent, true));
        document.addEventListener("selectionchange", onSelection);
        document.addEventListener("paste", onPaste, true);
        document.addEventListener("dragover", onDragOver, true);
        document.addEventListener("drop", onDrop, true);
        refresh();
        return () => {
            mountedRef.current = false;
            events.forEach((ev) => document.removeEventListener(ev, onEvent, true));
            document.removeEventListener("selectionchange", onSelection);
            document.removeEventListener("paste", onPaste, true);
            document.removeEventListener("dragover", onDragOver, true);
            document.removeEventListener("drop", onDrop, true);
        };
    }, [targetId, refresh, maxImages]);

    const onBold = useCallback(() => apply((v, s, e) => toggleInline(v, s, e, "bold")), [apply]);
    const onItalic = useCallback(() => apply((v, s, e) => toggleInline(v, s, e, "italic")), [apply]);
    const onQuote = useCallback(() => apply(toggleQuote), [apply]);
    const onList = useCallback(() => apply(cycleList), [apply]);
    const onRemoveImage = useCallback(() => apply((v) => removeFirstImage(v)), [apply]);
    const onImage = useCallback(() => {
        if (busyRef.current || disabledRef.current) return;
        const input = fileRef.current;
        if (input) input.click();
    }, []);
    const onFile = useCallback((e) => {
        const input = e.target;
        const file = input && input.files && input.files[0];
        if (input) input.value = ""; // the same file can be picked again
        if (file) uploadImage(file);
    }, [uploadImage]);

    const parts = state.split("|");
    const bold = parts[0] === "1";
    const italic = parts[1] === "1";
    const quote = parts[2] === "1";
    const list = parts[3];
    const imageUrl = parts.slice(5).join("|");
    const thumb = maxImages > 0 ? previewSrc(imageUrl) : null;
    const off = !!disabled;

    const listTitle = list === "bullet"
        ? t("components.format_menus.bullet_list")
        : list === "number"
            ? t("components.format_menus.numbered_list")
            : t("components.editor_toolbar.lists");

    return (
        <div className={className ? classes.bar + " " + className : classes.bar}>
            <BarButton classes={classes} title={t("components.editor_toolbar.bold_ctrl_b")} pressed active={bold} disabled={off} onClick={onBold}>
                <FormatBoldIcon />
            </BarButton>
            <BarButton classes={classes} title={t("components.editor_toolbar.italic_ctrl_i")} pressed active={italic} disabled={off} onClick={onItalic}>
                <FormatItalicIcon />
            </BarButton>
            <BarButton classes={classes} title={t("components.editor_toolbar.quote")} pressed active={quote} disabled={off} onClick={onQuote}>
                <FormatQuoteIcon />
            </BarButton>
            {/* One button, three states — the icon is the current one. */}
            <BarButton classes={classes} title={listTitle} pressed active={list !== "none"} disabled={off} onClick={onList}>
                {list === "number" ? <FormatListNumberedIcon /> : <FormatListBulletedIcon />}
            </BarButton>
            {maxImages > 0 && <span className={classes.divider} />}
            {maxImages > 0 && (
                <BarButton classes={classes} title={t("components.editor_toolbar.image")} disabled={off || busy} onClick={onImage}>
                    {busy ? <CircularProgress size={18} thickness={5} className={classes.progress} /> : <ImageIcon />}
                </BarButton>
            )}
            <span className={classes.spacer} />
            {thumb && (
                <span className={classes.thumb}>
                    <img className={classes.thumbImg} src={thumb} alt="" draggable={false} decoding="async" referrerPolicy="no-referrer" />
                    <Tooltip title={t("components.cover_image_upload.remove")} placement="top">
                        <span>
                            <IconButton
                                size="small"
                                className={classes.thumbRemove}
                                aria-label={t("components.cover_image_upload.remove")}
                                disabled={off || busy}
                                onMouseDown={preventFocusSteal}
                                onClick={onRemoveImage}
                            >
                                <CloseIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                </span>
            )}
            {maxImages > 0 && (
                <input ref={fileRef} type="file" accept="image/*" tabIndex={-1} aria-hidden="true"
                       className={classes.fileInput} onChange={onFile} />
            )}
        </div>
    );
}

export const FormatBar = memo(withStyles(styles)(FormatBarInner));

/* ── The composer field ───────────────────────────────────────────────── */

function CommentComposerFieldInner({
                                       classes, id, name, className, label, disabled, autoFocus,
                                       onSubmit, onBusyChange, rows = 3, rowsMax = 10,
                                       maxImages = MAX_COMMENT_IMAGES,
                                   }) {
    // Enter never sends while an image is still uploading: it would go
    // without the image.
    const busyRef = useRef(false);
    const onSubmitRef = useRef(onSubmit);
    onSubmitRef.current = onSubmit;
    const handleBusy = useCallback((b) => {
        busyRef.current = b;
        if (onBusyChange) onBusyChange(b);
    }, [onBusyChange]);
    const submit = useCallback(() => {
        if (!busyRef.current && onSubmitRef.current) onSubmitRef.current();
    }, []);
    const onKeyDown = useCallback((e) => handleComposerKeyDown(e, submit), [submit]);

    // CONTROLLED, unlike the single-line field this replaces. preact/compat
    // writes a <textarea>'s `value` prop back on every render of it — and
    // MUI's TextareaAutosize always passes the prop, `undefined` when
    // uncontrolled, which compat writes as "" — so an uncontrolled
    // multi-line field was wiped by its first focus (InputBase re-renders)
    // or line wrap (TextareaAutosize re-measures). Every write the dialogs
    // make by id (setTextFieldValue, the reset after sending) sets the DOM
    // value and dispatches `input`, which lands here, as do typing and the
    // format bar's edits; reading it by id is unchanged.
    const [text, setText] = useState("");
    const onChange = useCallback((e) => setText(e.target.value), []);

    return (
        <div className={classes.root}>
            <FormatBar targetId={id} disabled={disabled} maxImages={maxImages} onBusyChange={handleBusy} />
            <TextField
                fullWidth
                multiline
                rows={rows}
                rowsMax={rowsMax}
                id={id}
                name={name || id}
                className={className}
                label={label}
                disabled={disabled}
                autoFocus={autoFocus}
                value={text}
                onChange={onChange}
                onKeyDown={onKeyDown}
            />
        </div>
    );
}

const CommentComposerField = memo(withStyles(styles)(CommentComposerFieldInner));

export default CommentComposerField;
