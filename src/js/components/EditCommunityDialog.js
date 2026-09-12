// ============================================================================
// EditCommunityDialog.js — Edit portal/community properties
// On save, prompts for the portal's posting/active key, broadcasts, discards
// the keys, then waits until hivemind has indexed the edit (via
// api.communities.awaitPropsVisible) before reporting success and closing —
// so a parent that re-fetches bridge.get_community on onSave/onClose sees
// the new props instead of racing the indexer.
// ============================================================================

import * as React from "preact/compat";
import { useState, useCallback, useMemo, useEffect, useRef, memo } from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import Typography from "@material-ui/core/Typography";
import Input from "@material-ui/core/Input";
import TextField from "@material-ui/core/TextField";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import CircularProgress from "@material-ui/core/CircularProgress";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import InputAdornment from "@material-ui/core/InputAdornment";
import OutlinedInput from "@material-ui/core/OutlinedInput";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import ListItemText from "@material-ui/core/ListItemText";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Checkbox from "@material-ui/core/Checkbox";
import CloseIcon from "@material-ui/icons/Close";
import PersonIcon from "@material-ui/icons/Person";
import InfoOutlinedIcon from "@material-ui/icons/InfoOutlined";
import VpnKeyOutlined from "@material-ui/icons/VpnKeyOutlined";
import Visibility from "@material-ui/icons/Visibility";
import VisibilityOff from "@material-ui/icons/VisibilityOff";
import CropFreeIcon from "@material-ui/icons/CropFree";
import Alert from "@material-ui/lab/Alert";
import { lazyDialog } from "./LazyDialog";
const QRScannerDialog = lazyDialog(() => import("./QrScanner"), { name: "QRScanner" });
const ImageWizard = lazyDialog(() => import("./ImageWizard"), { name: "ImageWizard" });
import * as actions from "../actions/utils";
import JSLoader from "../utils/JSLoader";
import { CONTENT_LANGUAGES, LANGUAGE_NAME } from "../utils/locale-status";
import { ToxicityWatcher } from "./ToxicityHint";

import { T } from "../utils/T";
import { t, useLanguage } from "../utils/text";

/**
 * The indexer's updateProps limits. Read from api.communities.PROPS_RULES
 * at runtime; this fallback (stock hivemind CommunityOp._read_props) only
 * covers renders that happen before `api` is available. Note the title cap
 * is 20, not 32 — 32 is the cap on a member's *user title* (setUserTitle),
 * a different op; a 21–32 char community title is silently discarded by the
 * indexer while hived reports the tx as included.
 */
const FALLBACK_PROPS_RULES = {
    title: { min: 3, max: 20 }, about: { max: 120 }, description: { max: 1000 }, flag_text: { max: 1000 },
};

/**
 * A WIF private key is base58check: [0x80][32-byte key][4-byte SHA256d checksum].
 *
 * The previous test was `key.startsWith("5") && key.length >= 50`, which is a
 * shape check, not validation. Two consequences:
 *
 *   1. A typo'd key passed and failed later as an opaque signing error.
 *   2. Posting, active and OWNER keys are indistinguishable under it — all
 *      start with "5", all are ~51 chars. The dialog asks for a posting key
 *      and an active key in separate fields and would accept an owner key in
 *      either. Owner is the key that can rotate every other key on the
 *      account; a user pasting it here hands the highest-privilege credential
 *      to a form that needed the lowest.
 *
 * This verifies the checksum, so a mistyped key is rejected up front. It still
 * cannot tell posting from active from owner — nothing in the key itself can.
 * That needs api.auth.wifToPublic(key) compared against the account's declared
 * authority; see _validateKeyRole below, which does exactly that when `api` is
 * available.
 */
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Decode(str) {
    const bytes = [0];
    for (const ch of str) {
        const v = B58.indexOf(ch);
        if (v < 0) return null;
        let carry = v;
        for (let i = 0; i < bytes.length; i++) {
            carry += bytes[i] * 58;
            bytes[i] = carry & 0xff;
            carry >>= 8;
        }
        while (carry) { bytes.push(carry & 0xff); carry >>= 8; }
    }
    for (let i = 0; i < str.length && str[i] === "1"; i++) bytes.push(0);
    return new Uint8Array(bytes.reverse());
}

async function isValidWif(key) {
    if (typeof key !== "string" || key.length < 50 || key.length > 52) return false;
    const raw = base58Decode(key.trim());
    if (!raw || raw.length !== 37 || raw[0] !== 0x80) return false;
    try {
        const body = raw.slice(0, 33);
        const want = raw.slice(33);
        const h1 = new Uint8Array(await crypto.subtle.digest("SHA-256", body));
        const h2 = new Uint8Array(await crypto.subtle.digest("SHA-256", h1));
        return h2[0] === want[0] && h2[1] === want[1] && h2[2] === want[2] && h2[3] === want[3];
    } catch (_) {
        return false;   // no WebCrypto: fall back to the shape check at the call site
    }
}

/**
 * The part the checksum cannot do: confirm this key actually holds the
 * authority the field is asking for, rather than a higher one.
 */
async function keyMatchesAuthority(api, key, account, role) {
    try {
        if (!api || !api.auth || !api.accounts) return null;      // unknown, do not block
        const pub = api.auth.wifToPublic(key);
        const accs = await api.accounts.getAccounts([account]);
        const auth = accs && accs[0] && accs[0][role];
        const list = (auth && auth.key_auths) || [];
        return list.some((ka) => Array.isArray(ka) && ka[0] === pub);
    } catch (_) { return null; }
}


const styles = theme => ({
    dialog: {
        "& .MuiDialog-paperFullWidth": {
            width: "min(100%, 600px) !important",
            background: "#000000",
        }
    },
    profileHeader: {
        display: "flex",
        gap: theme.spacing(3),
        marginBottom: theme.spacing(2),
        [theme.breakpoints.down('xs')]: { flexDirection: "column", alignItems: "center" }
    },
    profilePictureContainer: { position: "relative", flexShrink: 0 },
    dropZone: {
        width: 120, height: 120, border: "2px dashed #555", borderRadius: "16px",
        display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
        backgroundColor: "#1a1a1a", cursor: "pointer",
        transition: "all 225ms cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": { backgroundColor: "#252525", borderColor: "#777" }
    },
    profilePicture: { width: 120, height: 120, borderRadius: "16px", objectFit: "cover" },
    removeButton: {
        position: "absolute", top: -8, right: -8, backgroundColor: "rgba(0,0,0,0.7)",
        color: "#fff", padding: 4, "&:hover": { backgroundColor: "rgba(0,0,0,0.9)" }
    },
    profileFields: { flex: 1, display: "flex", flexDirection: "column", gap: theme.spacing(2), minWidth: 0 },
    loadingContainer: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: theme.spacing(6), gap: theme.spacing(2) },
    errorContainer: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: theme.spacing(4), gap: theme.spacing(2), textAlign: "center" },
    infoTip: { marginTop: 8, display: "flex", alignItems: "center", gap: theme.spacing(0.5), color: "#888", fontSize: "0.75rem" },
    keyDialog: {
        "& .MuiDialog-paper": { backgroundColor: "#000", color: "#fff", borderRadius: "21px", minWidth: "360px", maxWidth: "480px" }
    },
    keyDialogTitle: {
        display: "flex", alignItems: "center", gap: "12px", paddingBottom: "8px",
        "& .MuiSvgIcon-root": { fontSize: "28px", color: "#b0b0b0" }
    },
    whiteButton: {
        "&.MuiButton-contained": { backgroundColor: "#d0d0d0", color: "#151515", transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms" },
        "&.MuiButton-contained:hover": { backgroundColor: "#ffffff", color: "#000000" }
    },
    inputEndAdornment: { "& .MuiIconButton-root.Mui-disabled": { color: "#7b7b7b" } },
    qrScanButton: { padding: "8px", color: "#9b9b9b", "&:hover": { color: "#ffffff", backgroundColor: "rgba(255,255,255,0.1)" } },
});

const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
});

const AvatarZone = memo(({ classes, pictureUrl, onFileUpload, onRemove }) => {
    useLanguage();
    return (
        <div className={classes.profilePictureContainer}>
            {pictureUrl ? (
                <React.Fragment>
                    <img src={pictureUrl} className={classes.profilePicture} alt={t("components.edit_community_dialog.avatar")} />
                    <IconButton className={classes.removeButton} onClick={onRemove} size="small">
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </React.Fragment>
            ) : (
                <label htmlFor="community-avatar-input">
                    <div className={classes.dropZone}>
                        <PersonIcon style={{ fontSize: 36, color: "#555", marginBottom: 8 }} />
                        <Typography variant="caption" style={{ color: "#666", textAlign: "center" }}>
                            {t("words.drop_image")}<br />{t("words.or_click")}
                        </Typography>
                    </div>
                </label>
            )}
            <Input onChange={onFileUpload} accept="image/*" style={{ display: "none" }} id="community-avatar-input" type="file" />
            <div className={classes.infoTip}>
                <Tooltip title={t("components.edit_community_dialog.avatar_must_be_pixel_art_under_48")}><InfoOutlinedIcon style={{ fontSize: 14 }} /></Tooltip>
                <span>{t("words.base64")}</span>
            </div>
        </div>
    );
});

function EditCommunityDialog(props) {
    const { classes, open, onClose, onSave, api, communityName } = props;

    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const [loggedInUser, setLoggedInUser] = useState(null);
    const [originalData, setOriginalData] = useState(null);

    // Form
    const [title, setTitle] = useState("");
    const [about, setAbout] = useState("");
    const [description, setDescription] = useState("");
    const [lang, setLang] = useState("en");
    const [isNsfw, setIsNsfw] = useState(false);
    const [flagText, setFlagText] = useState("");
    const [avatarUrl, setAvatarUrl] = useState("");
    const [avatarFile, setAvatarFile] = useState(null);

    // ImageWizard — opened when an uploaded picture is over the 48 kB budget
    const [wizardFile, setWizardFile] = useState(null);

    // UI
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState("");

    // Key dialog
    const [keyDialogOpen, setKeyDialogOpen] = useState(false);
    const [postingKeyValue, setPostingKeyValue] = useState("");
    const [activeKeyValue, setActiveKeyValue] = useState("");

    // Private keys must not outlive the operation that needed them: React state
    // is walked by devtools and serialised by error reporters. Declared at
    // component scope because BOTH the close-reset effect and the broadcast
    // handler need it — it used to live inside handleKeyConfirm, so the effect's
    // call site referenced an identifier that was not in scope and threw
    // "_wipeKeys is not defined" every time the dialog closed.
    const _wipeKeys = useCallback(() => {
        setPostingKeyValue("");
        setActiveKeyValue("");
    }, []);
    const [showPostingKey, setShowPostingKey] = useState(false);
    const [showActiveKey, setShowActiveKey] = useState(false);
    const [keyError, setKeyError] = useState("");
    const [broadcasting, setBroadcasting] = useState(false);
    const [qrScannerOpen, setQrScannerOpen] = useState(false);
    const [qrTarget, setQrTarget] = useState("posting"); // "posting" | "active"

    // ── Load ─────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!open || !api || !communityName) return;
        const loadData = async () => {
            setLoading(true);
            setLoadError(null);
            setSaveError("");
            try {
                let activeUser = null;
                if (api.sessionManager) activeUser = await api.sessionManager.getActiveAccount();
                if (!activeUser && api.keyManager?.getActiveAccount) activeUser = api.keyManager.getActiveAccount();
                setLoggedInUser(activeUser);

                const [community, portalAccounts] = await Promise.all([
                    api.communities.getCommunity(communityName, activeUser || ''),
                    api.accounts.getAccounts([communityName], true),
                ]);

                if (!community) { setLoadError(t("components.edit_community_dialog.community_not_found", {
                    communityName: communityName
                })); setLoading(false); return; }

                if (activeUser) {
                    const admins = community.admins || [];
                    const team = community.team || [];
                    const isAdmin = admins.includes(activeUser) || team.some(t => t[0] === activeUser && (t[1] === 'admin' || t[1] === 'owner'));
                    if (!isAdmin) { setLoadError(t("components.edit_community_dialog.you_must_be_an_admin_of_this")); setLoading(false); return; }
                } else { setLoadError(t(
                    "components.edit_community_dialog.please_log_in_to_edit_community_settings"
                )); setLoading(false); return; }

                // Avatar from portal account's json_metadata (same as user profiles)
                let portalAvatar = '';
                if (portalAccounts && portalAccounts[0]) {
                    portalAvatar = (portalAccounts[0]._profile && portalAccounts[0]._profile.profile_image) || '';
                }

                // description_source is the plain text (what the indexer
                // stores); community.description is rendered HTML for display
                // and must never be fed back into the form.
                const original = {
                    title: community.title || "", about: community.about || "",
                    description: (community.description_source ?? community.description) || "", lang: community.lang || "en",
                    isNsfw: !!community.is_nsfw, flagText: community.flag_text || "",
                    avatarUrl: portalAvatar,
                };
                setOriginalData(original);
                setTitle(original.title); setAbout(original.about); setDescription(original.description);
                setLang(original.lang); setIsNsfw(original.isNsfw); setFlagText(original.flagText);
                setAvatarUrl(original.avatarUrl); setAvatarFile(null);
            } catch (err) {
                console.error("[EditCommunityDialog] Load failed:", err);
                setLoadError(t("components.edit_community_dialog.failed_to_load_community", {
                    message: (err.message || "Unknown error")
                }));
            } finally { setLoading(false); }
        };
        loadData();
    }, [open, api, communityName]);

    useEffect(() => {
        if (!open) {
            setOriginalData(null); setTitle(""); setAbout(""); setDescription(""); setLang("en");
            setIsNsfw(false); setFlagText(""); setAvatarUrl(""); setAvatarFile(null); setSaveError("");
            setWizardFile(null);
            _wipeKeys();
            setKeyDialogOpen(false);
            setShowPostingKey(false); setShowActiveKey(false); setKeyError(""); setBroadcasting(false);
        }
    }, [open, _wipeKeys]);

    const hasChanges = useMemo(() => {
        if (!originalData) return false;
        if (avatarFile) return true;
        return title !== originalData.title || about !== originalData.about ||
            description !== originalData.description || lang !== originalData.lang ||
            isNsfw !== originalData.isNsfw || flagText !== originalData.flagText ||
            avatarUrl !== originalData.avatarUrl;
    }, [originalData, title, about, description, lang, isNsfw, flagText, avatarUrl, avatarFile]);

    // ── Avatar ───────────────────────────────────────────────────────────
    // trusted = true for files produced by the ImageWizard: they are pixel
    // art under the budget by construction, so re-probing them could only
    // false-negative and bounce the user straight back into the wizard.
    const processFile = useCallback(async (file, trusted = false) => {
        setSaveError("");
        if (!file.type.startsWith("image/")) { setSaveError("Please upload an image file"); return; }
        if (file.size > 48000) {
            // Too heavy for metadata storage — hand it to the ImageWizard,
            // which converts it (AI optional) and lets the user pick a size
            // and color quantization until it fits the budget.
            setWizardFile(file);
            return;
        }
        if (!trusted) {
            // Light enough, but it must also BE pixel art (same probe as
            // NewPost). Photos and smooth gradients go to the wizard too.
            try {
                const { isArtworkPixelart } = await JSLoader(() => import("../utils/pix2art/file2imgd"));
                const pixelartImagedata = await isArtworkPixelart(file, 512, 512, 160);
                if (!(pixelartImagedata instanceof ImageData)) {
                    setWizardFile(file);
                    return;
                }
            } catch (e) {
                console.error('[EditCommunityDialog] Pixel art check failed:', e);
                setSaveError("Could not read this image. Please try another file.");
                return;
            }
        }
        if (avatarUrl && avatarUrl.startsWith("blob:")) URL.revokeObjectURL(avatarUrl);
        setAvatarUrl(URL.createObjectURL(file)); setAvatarFile(file);
    }, [avatarUrl]);

    // ── ImageWizard callbacks ────────────────────────────────────────────
    const handleWizardClose = useCallback(() => setWizardFile(null), []);
    const handleWizardComplete = useCallback((optimizedFile) => {
        setWizardFile(null);
        // Re-run the normal path with trusted=true — the wizard's output is
        // pixel art under the budget by construction, so only the cheap
        // checks run and the probe is skipped.
        if (optimizedFile) processFile(optimizedFile, true);
    }, [processFile]);

    const handleFileUpload = useCallback((e) => { const f = e.target?.files; if (f && f[0]) processFile(f[0]); }, [processFile]);
    const handleRemoveAvatar = useCallback(() => {
        if (avatarUrl && avatarUrl.startsWith("blob:")) URL.revokeObjectURL(avatarUrl);
        setAvatarUrl(""); setAvatarFile(null);
    }, [avatarUrl]);

    // ── QR scanner ───────────────────────────────────────────────────────
    const handleQRScanResult = useCallback((result) => {
        if (result) {
            const val = result.trim();
            if (qrTarget === "active") { setActiveKeyValue(val); }
            else { setPostingKeyValue(val); }
            setKeyError("");
        }
        setQrScannerOpen(false);
    }, [qrTarget]);

    // ── Determine which keys are needed ──────────────────────────────────
    const propsChanged = useMemo(() => {
        if (!originalData) return false;
        return title !== originalData.title || about !== originalData.about ||
            description !== originalData.description || lang !== originalData.lang ||
            isNsfw !== originalData.isNsfw || flagText !== originalData.flagText;
    }, [originalData, title, about, description, lang, isNsfw, flagText]);

    const avatarChanged = useMemo(() => {
        if (avatarFile) return true;
        if (!originalData) return false;
        return avatarUrl !== (originalData.avatarUrl || '');
    }, [avatarFile, avatarUrl, originalData]);

    const needsPostingKey = propsChanged;
    const needsActiveKey = avatarChanged;

    // ── Save click → validate → open key dialog ──────────────────────────
    // Everything the indexer will validate, shaped the way it validates it.
    // Only the normalized payload is ever broadcast or compared.
    const rules = (api && api.communities && api.communities.PROPS_RULES) || FALLBACK_PROPS_RULES;
    const normalized = useMemo(() => {
        const raw = { title, about, description, lang, is_nsfw: isNsfw, flag_text: flagText };
        if (api && api.communities && typeof api.communities.normalizeProps === "function") {
            return api.communities.normalizeProps(raw);
        }
        // Old API build: at least apply the padding rule.
        return {
            props: { title: title.trim(), about: about.trim(), description: description.trim(), lang: String(lang).toLowerCase(), is_nsfw: !!isNsfw, flag_text: flagText.trim() },
            problems: [], dropped: [],
        };
    }, [api, title, about, description, lang, isNsfw, flagText]);

    const handleSaveClick = useCallback(() => {
        if (!hasChanges) { onClose(); return; }
        setSaveError("");
        // hived would include this tx and the indexer would then throw the
        // whole op away — refuse here, where the user can still fix it.
        if (propsChanged && normalized.problems.length) {
            setSaveError(normalized.problems.map((p) => p.reason).join(" · "));
            return;
        }
        setPostingKeyValue(""); setActiveKeyValue("");
        setShowPostingKey(false); setShowActiveKey(false);
        setKeyError(""); setKeyDialogOpen(true);
    }, [hasChanges, onClose, propsChanged, normalized]);


    const canConfirm = useMemo(() => {
        if (needsPostingKey && (!postingKeyValue.trim() || postingKeyValue.length < 50)) return false;
        if (needsActiveKey && (!activeKeyValue.trim() || activeKeyValue.length < 50)) return false;
        return needsPostingKey || needsActiveKey;
    }, [api, communityName, needsPostingKey, needsActiveKey, postingKeyValue, activeKeyValue]);

    // ── Key confirmed → broadcast both ops → close ───────────────────────
    const handleKeyConfirm = useCallback(async () => {
        // Validate keys that are needed
        if (needsPostingKey) {
            if (!postingKeyValue.trim()) { setKeyError(t(
                "components.edit_community_dialog.please_enter_the_portals_posting_private_key"
            )); return; }
            if (!(await isValidWif(postingKeyValue))) { setKeyError(t("components.edit_community_dialog.invalid_posting_key_format_must_be_a")); return; }
        }
        if (needsActiveKey) {
            if (!activeKeyValue.trim()) { setKeyError(t(
                "components.edit_community_dialog.please_enter_the_portals_active_private_key"
            )); return; }
            if (!(await isValidWif(activeKeyValue))) { setKeyError(t("components.edit_community_dialog.invalid_active_key_format_must_be_a")); return; }
        }

        // The checksum proves the key is well-formed; it cannot prove WHICH
        // authority it holds — posting, active and owner WIFs are structurally
        // identical. Compare the derived public key against the account's
        // declared authority so an owner key pasted into the posting field is
        // caught. Returns null when `api` is unavailable, and null never
        // blocks: refusing on uncertainty would lock out valid account_auths
        // delegation, which is authorised but not in key_auths.
        if (needsPostingKey) {
            const okPosting = await keyMatchesAuthority(api, postingKeyValue, communityName, "posting");
            if (okPosting === false) {
                setKeyError(t("components.edit_community_dialog.key_is_not_the_posting_authority", { communityName }));
                return;
            }
        }
        if (needsActiveKey) {
            const okActive = await keyMatchesAuthority(api, activeKeyValue, communityName, "active");
            if (okActive === false) {
                setKeyError(t("components.edit_community_dialog.key_is_not_the_active_authority", { communityName }));
                return;
            }
        }

        setBroadcasting(true); setKeyError("");

        try {
            // Both broadcasts resolve once hived has the tx in a block (v4.5
            // synchronous send) and return { id, block_num, … }. Keep the
            // highest block: it is what the read-back below waits for.
            let blockNum = null;
            const broadcastStartedAt = Date.now();
            const noteBlock = (res) => {
                if (Number.isInteger(res?.block_num)) blockNum = Math.max(blockNum ?? 0, res.block_num);
            };

            // ── Transaction 1: updateProps (community settings) — posting authority ──
            // The NORMALIZED payload: trimmed, lang lowercased, unknown keys
            // gone. Sending the raw form values is how a title with a
            // trailing space or a description ending in a newline gets
            // included by hived and then discarded by the indexer.
            const portalProps = normalized.props;
            if (needsPostingKey) {
                noteBlock(await api.broadcast.customJson({
                    requiredPostingAuths: [communityName],
                    id: "community",
                    json: JSON.stringify(["updateProps", { community: communityName, props: portalProps }]),
                }, { posting: postingKeyValue.trim() }));
            }

            // ── Transaction 2: update portal profile image — active authority ──
            let finalAvatarUrl = avatarUrl;
            if (needsActiveKey) {
                if (avatarFile) finalAvatarUrl = await fileToBase64(avatarFile);
                const profileData = { profile_image: finalAvatarUrl };
                noteBlock(await api.broadcast.updateProfile(communityName, profileData, activeKeyValue.trim()));
            }

            _wipeKeys();

            // ── Read-back: wait for hivemind before anyone re-fetches ──
            // hived only records the updateProps custom_json; hivemind parses
            // it when IT processes that block, a second or two later, and
            // bridge.get_community (what every portal page reads) is answered
            // by hivemind. Closing here and letting the page re-fetch lands in
            // that window and shows the OLD title/about/description. So the
            // spinner stays up until the raw bridge row carries the props we
            // just broadcast (or the budget runs out — the tx is on chain
            // either way, hivemind is just late). Avatar-only edits go
            // through hived's get_accounts, which is fresh at inclusion, but
            // bridge's copy of the profile is not — gate those on the block
            // when the node can tell us hivemind's head.
            let visible = true;
            let rejection = null;
            if (needsPostingKey && api.communities && typeof api.communities.awaitPropsVisible === "function") {
                // observer = the account the page queries with, so the cache
                // entry the page is about to hit is the one this loop refreshes.
                const rb = await api.communities.awaitPropsVisible(communityName, portalProps, {
                    blockNum, observer: loggedInUser || "",
                });
                visible = rb.visible;
                if (!visible) {
                    console.warn("[EditCommunityDialog] Portal props not indexed after", rb.tries, "reads; block", blockNum);
                    // Slow indexer, or a payload it refused? Only the actor's
                    // `error` notification can tell them apart.
                    if (typeof api.communities.getLastPropsRejection === "function") {
                        rejection = await api.communities.getLastPropsRejection(communityName, { sinceTs: broadcastStartedAt - 60000 });
                    }
                }
            } else if (blockNum && api.transaction && typeof api.transaction.awaitHivemindBlock === "function") {
                await api.transaction.awaitHivemindBlock(blockNum);
            }

            if (rejection) {
                // On chain, never applied. Keep the key dialog open with the
                // indexer's own reason so the user can fix the field and
                // resubmit (keys were wiped above, they will be asked again).
                console.error("[EditCommunityDialog] indexer rejected updateProps:", rejection);
                setKeyError("The portal index rejected this update: " + rejection.reason);
                return;
            }

            setKeyDialogOpen(false);
            actions.trigger_snackbar(t("components.edit_community_dialog.community_settings_updated"));
            if (onSave) onSave({
                ...portalProps,
                name: communityName,
                // Additive: lets the parent update its header without a
                // fetch. profile_image is the value written on chain (base64
                // data URI or '' for removal) and is only present when the
                // avatar changed; visible=false means hivemind had not caught
                // up within the budget, so a bridge re-fetch may still lag.
                ...(needsActiveKey ? { profile_image: finalAvatarUrl } : {}),
                block_num: blockNum,
                visible,
            });
            onClose();
        } catch (err) {
            console.error("[EditCommunityDialog] Broadcast failed:", err);
            setKeyError(t("components.edit_community_dialog.broadcast_failed", {
                message: (err.message || "Unknown error")
            }));
        } finally { setBroadcasting(false); }
    }, [api, communityName, needsPostingKey, needsActiveKey, postingKeyValue, activeKeyValue, normalized, loggedInUser, avatarUrl, avatarFile, onSave, onClose, _wipeKeys]);

    const handleCancel = useCallback(() => { if (!isSaving) onClose(); }, [onClose, isSaving]);

    // ── Renderers ────────────────────────────────────────────────────────
    const renderLoading = () => (
        <div className={classes.loadingContainer}>
            <CircularProgress />
            <Typography variant="body2" style={{ color: "#888" }}>{t("components.edit_community_dialog.loading_community_data")}</Typography>
        </div>
    );

    const renderError = () => (
        <div className={classes.errorContainer}>
            <Typography variant="h6" style={{ color: "#888" }}>{t("words.error")}</Typography>
            <Typography variant="body2" style={{ color: "#888" }}>{loadError}</Typography>
            <Button variant="outlined" onClick={onClose} style={{ marginTop: 16 }}>{t("words.close")}</Button>
        </div>
    );

    const renderForm = () => (
        <React.Fragment>
            <IconButton onClick={handleCancel} disabled={isSaving}
                        style={{ position: "absolute", right: 8, top: 8, color: "#999", zIndex: 100 }}>
                <CloseIcon />
            </IconButton>

            <Typography style={{ marginBottom: 8, paddingRight: 36 }} component="h2" variant="h6">{t("components.edit_community_dialog.edit_portal_settings")}</Typography>
            <Typography variant="caption" style={{ color: "#888", display: "block", marginBottom: 24 }}>{communityName}</Typography>

            <div className={classes.profileHeader}>
                <AvatarZone classes={classes} pictureUrl={avatarUrl} onFileUpload={handleFileUpload} onRemove={handleRemoveAvatar} />
                <div className={classes.profileFields}>
                    <TextField label={t("components.edit_community_dialog.title")} variant="outlined" fullWidth value={title} onChange={(e) => setTitle(e.target.value)}
                               placeholder={t("components.edit_community_dialog.community_display_name")} disabled={isSaving} inputProps={{ maxLength: rules.title.max }} />
                    <ToxicityWatcher text={title} label="title" />
                    <TextField label={t("components.edit_community_dialog.about")} variant="outlined" fullWidth value={about} onChange={(e) => setAbout(e.target.value)}
                               placeholder={t("components.edit_community_dialog.short_blurb_120_chars")} disabled={isSaving} inputProps={{ maxLength: rules.about.max }} />
                    <ToxicityWatcher text={about} label={t("components.edit_community_dialog.about_text")} />
                </div>
            </div>

            {saveError && <Typography color="error" variant="caption" style={{ display: "block", marginBottom: 16 }}>{saveError}</Typography>}

            <TextField label={t("components.edit_community_dialog.description_rules")} variant="outlined" fullWidth multiline minRows={3} maxRows={8}
                       value={description} onChange={(e) => setDescription(e.target.value)}
                       placeholder={t(
                           "components.edit_community_dialog.describe_purpose_enumerate_rules_markdown_5000_c"
                       )}
                       style={{ marginBottom: 16 }} disabled={isSaving} inputProps={{ maxLength: rules.description.max }} />
            <ToxicityWatcher text={description} label="description" style={{ marginTop: -12, marginBottom: 16 }} />

            <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                <FormControl variant="outlined" style={{ flex: 1 }}>
                    <InputLabel htmlFor="edit-lang-select">{t("words.language")}</InputLabel>
                    <Select id="edit-lang-select" value={lang} onChange={(e) => setLang(e.target.value)}
                            labelWidth={75} disabled={isSaving} renderValue={(v) => v.toUpperCase()}>
                        {CONTENT_LANGUAGES.map((l) => <MenuItem key={l} value={l}><ListItemText primary={LANGUAGE_NAME[l] || l.toUpperCase()} secondary={l.toUpperCase()} /></MenuItem>)}
                    </Select>
                </FormControl>
                <FormControlLabel
                    control={<Checkbox checked={isNsfw} onChange={(e) => setIsNsfw(e.target.checked)} disabled={isSaving} style={{ color: "#888" }} />}
                    label={t("components.edit_community_dialog.nsfw_18")} style={{ color: "#ccc", marginRight: 0 }} />
            </div>

            <TextField label={t("components.edit_community_dialog.flag_report_text")} variant="outlined" fullWidth value={flagText}
                       onChange={(e) => setFlagText(e.target.value)} placeholder={t(
                "components.edit_community_dialog.custom_text_shown_when_reporting_content"
            )} disabled={isSaving} inputProps={{ maxLength: rules.flag_text.max }} />
        </React.Fragment>
    );

    return (
        <React.Fragment>
            <Dialog className={classes.dialog} open={open} fullWidth disablePortal={false} onClose={handleCancel} keepMounted={false}>
                <DialogContent style={{ position: "relative", paddingTop: 24 }}>
                    {loading ? renderLoading() : loadError ? renderError() : renderForm()}
                </DialogContent>
                {!loading && !loadError && (
                    <DialogActions style={{ padding: "16px 24px" }}>
                        <Button variant="text" color="primary" onClick={handleCancel} disabled={isSaving}>{t("words.cancel")}</Button>
                        <Button variant="contained" onClick={handleSaveClick} disabled={isSaving || !hasChanges}
                                style={{ borderRadius: "32px", minWidth: 100, backgroundColor: hasChanges ? "#d0d0d0" : "#333", color: hasChanges ? "#151515" : "#666" }}>
                            {hasChanges ? "Save Changes" : "No Changes"}
                        </Button>
                    </DialogActions>
                )}
            </Dialog>
            {/* Portal key dialog — raised on save */}
            <Dialog className={classes.keyDialog} open={keyDialogOpen} onClose={broadcasting ? undefined : () => setKeyDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle disableTypography>
                    <div className={classes.keyDialogTitle}>
                        <VpnKeyOutlined />
                        <Typography variant="h5" component="h2">{t("components.edit_community_dialog.portal_keys_required")}</Typography>
                    </div>
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" style={{ color: "#b0b0b0", marginBottom: 16 }}><T
                        k="components.edit_community_dialog.enter_the_private_keys_of_0_0"
                        vars={{
                            communityName: communityName
                        }}
                        slots={[<strong style={{ color: "#fff" }} key="0" />]} /></Typography>
                    <Alert severity="info" style={{ marginBottom: 16 }}>
                        {t("components.edit_community_dialog.keys_will_only_be_used_for_this")}
                    </Alert>

                    {/* Posting key — for community props (customJson) */}
                    {needsPostingKey && (
                        <FormControl variant="outlined" fullWidth style={{ marginBottom: needsActiveKey ? 16 : 0 }}>
                            <InputLabel htmlFor="portal-posting-key-input">{t("components.edit_community_dialog.portal_posting_key")}</InputLabel>
                            <OutlinedInput
                                id="portal-posting-key-input"
                                type={showPostingKey ? "text" : "password"}
                                value={postingKeyValue}
                                onChange={(e) => { setPostingKeyValue(e.target.value); setKeyError(""); }}
                                error={!!keyError}
                                placeholder="5K..."
                                disabled={broadcasting}
                                className={classes.inputEndAdornment}
                                endAdornment={
                                    <InputAdornment position="end">
                                        <IconButton onClick={() => setShowPostingKey(!showPostingKey)} edge="end" disabled={broadcasting}>
                                            {showPostingKey ? <VisibilityOff /> : <Visibility />}
                                        </IconButton>
                                        <IconButton className={classes.qrScanButton} onClick={() => { setQrTarget("posting"); setQrScannerOpen(true); }} edge="end" disabled={broadcasting}>
                                            <CropFreeIcon />
                                        </IconButton>
                                    </InputAdornment>
                                }
                                labelWidth={148}
                            />
                        </FormControl>
                    )}

                    {/* Active key — for profile update (account_update2) */}
                    {needsActiveKey && (
                        <FormControl variant="outlined" fullWidth>
                            <InputLabel htmlFor="portal-active-key-input">{t("components.edit_community_dialog.portal_active_key")}</InputLabel>
                            <OutlinedInput
                                id="portal-active-key-input"
                                type={showActiveKey ? "text" : "password"}
                                value={activeKeyValue}
                                onChange={(e) => { setActiveKeyValue(e.target.value); setKeyError(""); }}
                                error={!!keyError}
                                placeholder="5K..."
                                disabled={broadcasting}
                                className={classes.inputEndAdornment}
                                endAdornment={
                                    <InputAdornment position="end">
                                        <IconButton onClick={() => setShowActiveKey(!showActiveKey)} edge="end" disabled={broadcasting}>
                                            {showActiveKey ? <VisibilityOff /> : <Visibility />}
                                        </IconButton>
                                        <IconButton className={classes.qrScanButton} onClick={() => { setQrTarget("active"); setQrScannerOpen(true); }} edge="end" disabled={broadcasting}>
                                            <CropFreeIcon />
                                        </IconButton>
                                    </InputAdornment>
                                }
                                labelWidth={140}
                            />
                        </FormControl>
                    )}

                    {keyError && <Typography variant="caption" style={{ color: "#f44336", display: "block", marginTop: 8 }}>{keyError}</Typography>}
                    {broadcasting && (
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, color: "#b0b0b0" }}>
                            <CircularProgress size={20} color="inherit" />
                            <Typography variant="body2">{t("components.edit_community_dialog.broadcasting_transactions")}</Typography>
                        </div>
                    )}
                </DialogContent>
                <DialogActions style={{ padding: "16px 24px" }}>
                    <Button variant="text" color="primary" onClick={() => setKeyDialogOpen(false)} disabled={broadcasting}>{t("words.cancel", {TUC: true})}</Button>
                    <Button className={classes.whiteButton} variant="contained" color="primary" onClick={handleKeyConfirm} disabled={!canConfirm || broadcasting}>
                        {broadcasting ? "BROADCASTING..." : "CONFIRM"}
                    </Button>
                </DialogActions>
            </Dialog>
            <QRScannerDialog open={qrScannerOpen} onClose={() => setQrScannerOpen(false)} onScanResult={handleQRScanResult} />
            {/* ImageWizard — shrinks oversized avatars to fit the 48 kB budget */}
            <ImageWizard
                open={!!wizardFile}
                file={wizardFile}
                maxKb={48}
                onClose={handleWizardClose}
                onComplete={handleWizardComplete}
            />
        </React.Fragment>
    );
}

export default withStyles(styles)(EditCommunityDialog);