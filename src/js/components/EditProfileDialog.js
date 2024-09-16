import * as React from "preact/compat";
import { useState, useCallback, useMemo, useEffect, useRef, memo } from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import Typography from "@material-ui/core/Typography";
import Input from "@material-ui/core/Input";
import TextField from "@material-ui/core/TextField";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import IconButton from "@material-ui/core/IconButton";
import Collapse from "@material-ui/core/Collapse";
import Fade from "@material-ui/core/Fade";
import Paper from "@material-ui/core/Paper";
import Tooltip from "@material-ui/core/Tooltip";
import CircularProgress from "@material-ui/core/CircularProgress";
import CloseIcon from "@material-ui/icons/Close";
import AddIcon from "@material-ui/icons/Add";
import PersonIcon from "@material-ui/icons/Person";
import LocationOnIcon from "@material-ui/icons/LocationOn";
import LanguageIcon from "@material-ui/icons/Language";
import AccountBalanceWalletIcon from "@material-ui/icons/AccountBalanceWallet";
import LinkIcon from "@material-ui/icons/Link";
import InfoOutlinedIcon from "@material-ui/icons/InfoOutlined";
import ContactMailIcon from "@material-ui/icons/ContactMail";
import Portal from "@material-ui/core/Portal";
import dispatcher from "../dispatcher";
import { ToxicityWatcher } from "./ToxicityHint";
import { lazyDialog } from "./LazyDialog";
import { T } from "../utils/T";
import { t, useLanguage } from "../utils/text";
import JSLoader from "../utils/JSLoader";
const ImageWizard = lazyDialog(() => import("./ImageWizard"), { name: "ImageWizard" });

const styles = theme => ({
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
        "& .MuiInputBase-root.Mui-focused": {
            border: "1px solid #666",
        },
        "& .MuiRadio-colorPrimary.Mui-checked, & .MuiCheckbox-colorPrimary.Mui-checked": {
            color: "#000 !important"
        },
        "& .MuiRadio-root, & .MuiFormLabel-root.Mui-focused, .MuiTypography-root": {
            color: "#000 !important",
        },
        "& .MuiOutlinedInput-root": {
            "& fieldset": {
                borderColor: "#ccc"
            },
            "&:hover": {
                borderColor: "#999"
            },
            "&.Mui-focused fieldset": {
                borderColor: "#000"
            }
        },
        "& .MuiInputLabel-root": {
            color: "#666 !important"
        },
        "& .MuiInputBase-input": {
            color: "#000 !important"
        }
    },
    profileHeader: {
        display: "flex",
        gap: theme.spacing(3),
        marginBottom: theme.spacing(2),
        [theme.breakpoints.down('xs')]: {
            flexDirection: "column",
            alignItems: "center"
        }
    },
    profilePictureContainer: {
        position: "relative",
        flexShrink: 0
    },
    dropZone: {
        width: 140,
        height: 140,
        border: "2px dashed #555",
        borderRadius: "16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        backgroundColor: "#1a1a1a",
        cursor: "pointer",
        transition: "all 225ms cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": {
            backgroundColor: "#252525",
            borderColor: "#777"
        }
    },
    dropZoneActive: {
        width: 140,
        height: 140,
        border: "2px solid #888",
        borderRadius: "16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        cursor: "pointer",
        transition: "all 225ms cubic-bezier(0.4, 0, 0.2, 1)"
    },
    profilePicture: {
        width: 140,
        height: 140,
        borderRadius: "16px",
        objectFit: "cover"
    },
    removeButton: {
        position: "absolute",
        top: -8,
        right: -8,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        color: "#fff",
        padding: 4,
        "&:hover": {
            backgroundColor: "rgba(0, 0, 0, 0.9)"
        }
    },
    profileFields: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: theme.spacing(2),
        minWidth: 0
    },
    collapsibleSection: {
        marginTop: theme.spacing(2)
    },
    sectionHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: theme.spacing(1.5, 2),
        backgroundColor: "#171717",
        borderRadius: "12px",
        cursor: "pointer",
        transition: "background-color 200ms ease",
        "&:hover": {
            backgroundColor: "#222"
        }
    },
    sectionTitle: {
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(1),
        color: "#ccc",
        fontWeight: 500
    },
    sectionContent: {
        padding: theme.spacing(0, 0, 2, 0)
    },
    permanenceNotice: {
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "12px 14px",
        marginBottom: 20,
        borderRadius: 12,
        border: "1px solid #333",
        backgroundColor: "#131313",
    },
    permanenceNoticeIcon: {
        fontSize: 18,
        color: "#bbb",
        flexShrink: 0,
        marginTop: 1,
    },
    permanenceNoticeText: {
        color: "#bbb",
        fontSize: 12,
        lineHeight: 1.5,
        "& strong": { color: "#fff", fontWeight: 600 },
    },
    addressList: {
        backgroundColor: "#171717",
        borderRadius: "12px",
        overflow: "hidden",
        marginTop: theme.spacing(2)
    },
    addressListEmpty: {
        padding: theme.spacing(3),
        textAlign: "center",
        color: "#666"
    },
    addressListItems: {
        "& .MuiListItem-container > .MuiListItem-root": {
            backgroundColor: "#171717",
            borderBottom: "1px solid #252525",
            transition: "background-color 225ms cubic-bezier(0.4, 0, 0.2, 1) 5ms"
        },
        "& .MuiListItem-container:last-child > .MuiListItem-root": {
            borderBottom: "none",
        },
        "& .MuiListItem-container > .MuiListItem-root:hover": {
            backgroundColor: "#1f1f1f",
            transition: "background-color 175ms cubic-bezier(0.4, 0, 0.2, 1) 5ms"
        }
    },
    addressName: {
        color: "#fff",
        fontWeight: 600,
        fontSize: "0.9rem"
    },
    addressValue: {
        color: "#888",
        fontSize: "0.8rem",
        fontFamily: "monospace",
        wordBreak: "break-all"
    },
    addButton: {
        marginTop: theme.spacing(1),
        color: "#aaa",
        borderColor: "#444",
        "&:hover": {
            borderColor: "#666",
            backgroundColor: "rgba(255,255,255,0.05)"
        }
    },
    infoTip: {
        marginTop: 8,
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(0.5),
        color: "#888",
        fontSize: "0.75rem",
    },
    dialogTitle: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: theme.spacing(3)
    },
    loadingContainer: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: theme.spacing(6),
        gap: theme.spacing(2)
    },
    errorContainer: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: theme.spacing(4),
        gap: theme.spacing(2),
        textAlign: "center"
    }
});

// Memoized comparison functions
const areProfilePicturePropsEqual = (prevProps, nextProps) => {
    return prevProps.pictureUrl === nextProps.pictureUrl &&
        prevProps.dropzoneActive === nextProps.dropzoneActive;
};

const areNameValueListPropsEqual = (prevProps, nextProps) => {
    return JSON.stringify(prevProps.items) === JSON.stringify(nextProps.items);
};

// Memoized Profile Picture Component — visual only, drag/drop handled by Portal overlay
const ProfilePictureZone = memo(({
                                     classes,
                                     pictureUrl,
                                     dropzoneActive,
                                     onFileUpload,
                                     onRemove
                                 }) => {
    useLanguage();
    return (
        <div className={classes.profilePictureContainer}>
            {pictureUrl ? (
                <React.Fragment>
                    <img
                        src={pictureUrl}
                        className={classes.profilePicture}
                        alt={t("components.edit_profile_dialog.profile")}
                    />
                    <IconButton
                        className={classes.removeButton}
                        onClick={onRemove}
                        size="small"
                    >
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </React.Fragment>
            ) : (
                <label htmlFor="profile-picture-input">
                    <div className={dropzoneActive ? classes.dropZoneActive : classes.dropZone}>
                        <PersonIcon style={{ fontSize: 40, color: "#555", marginBottom: 8 }} />
                        <Typography variant="caption" style={{ color: "#666", textAlign: "center" }}>
                            {t("words.drop_image")}<br />{t("words.or_click")}
                        </Typography>
                    </div>
                </label>
            )}
            <Input
                onChange={onFileUpload}
                accept="image/*"
                style={{ display: "none" }}
                id="profile-picture-input"
                type="file"
            />
            <div className={classes.infoTip}>
                <Tooltip title={t("components.edit_profile_dialog.profile_picture_must_be_pixel_art_under")}>
                    <InfoOutlinedIcon style={{ fontSize: 14 }} />
                </Tooltip>
                <span>{t("words.base64")}</span>
            </div>
        </div>
    );
}, areProfilePicturePropsEqual);

// Hard cap per list. The JSON sanitizer truncates arrays at 100; we stay well
// under that so a profile can never be rejected or silently trimmed on read.
const MAX_ITEMS_PER_LIST = 15;
const MAX_ITEM_NAME_LEN  = 64;
const MAX_ITEM_VALUE_LEN = 256;

// Permanence warning shown above every field whose contents are broadcast to the
// chain. Greyscale only, per the global UI rule.
const PermanenceNotice = memo(({ classes }) => (
    <div className={classes.permanenceNotice}>
        <InfoOutlinedIcon className={classes.permanenceNoticeIcon} />
        <Typography variant="body2" className={classes.permanenceNoticeText}><T k="components.edit_profile_dialog.everything_you_add_below_is_written_to" /></Typography>
    </div>
));

// Memoized Name/Value List Component (reused for crypto addresses, links and contacts)
const NameValueList = memo(({
                                classes,
                                items,
                                emptyIcon: EmptyIcon,
                                emptyText,
                                addLabel,
                                onDeleteClick,
                                onAddClick
                            }) => {
    useLanguage();
    return (
        <div>
            <Paper className={classes.addressList} elevation={0}>
                {items.length === 0 ? (
                    <div className={classes.addressListEmpty}>
                        <EmptyIcon style={{ fontSize: 32, color: "#444", marginBottom: 8 }} />
                        <Typography variant="body2" style={{ color: "#666" }}>
                            {emptyText}
                        </Typography>
                    </div>
                ) : (
                    <List disablePadding className={classes.addressListItems}>
                        {items.map((item, index) => (
                            <Fade key={item.id || index} in timeout={200 * (index + 1)}>
                                <ListItem>
                                    <ListItemText
                                        primary={
                                            <Typography className={classes.addressName}>
                                                {item.name}
                                            </Typography>
                                        }
                                        secondary={
                                            <Typography className={classes.addressValue}>
                                                {item.value}
                                            </Typography>
                                        }
                                    />
                                    <ListItemSecondaryAction>
                                        <IconButton
                                            edge="end"
                                            onClick={() => onDeleteClick(item)}
                                            style={{ color: "#666" }}
                                        >
                                            <CloseIcon />
                                        </IconButton>
                                    </ListItemSecondaryAction>
                                </ListItem>
                            </Fade>
                        ))}
                    </List>
                )}
            </Paper>
            <Button
                variant="text"
                startIcon={<AddIcon />}
                className={classes.addButton}
                onClick={onAddClick}
                fullWidth
            >
                {addLabel}
            </Button>
        </div>
    );
}, areNameValueListPropsEqual);

// Helper to convert File to Base64
const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
};

// Helper to check if data has changed
const hasDataChanged = (original, current) => {
    return JSON.stringify(original) !== JSON.stringify(current);
};

// Normalize legacy address objects ({name, address}) to unified {name, value} shape
const normalizeItems = (arr) => {
    if (!Array.isArray(arr)) return [];
    return arr.map(item => ({
        id: item.id || Date.now().toString() + Math.random().toString(36).slice(2, 6),
        name: item.name || "",
        value: item.value || item.address || ""
    }));
};

// Config for the generic "Add Item" dialog (shared by addresses and links)
const ADD_DIALOG_CONFIG = {
    address: {
        title: "Add Crypto Address",
        nameLabel: "Network Name",
        namePlaceholder: "e.g., Ethereum, Bitcoin, HIVE",
        valueLabel: "Public Address",
        valuePlaceholder: "e.g., 0x1234...abcd",
        valueMultiline: true,
        buttonLabel: "Add Address"
    },
    contact: {
        title: "Add Contact Info",
        nameLabel: "App / Protocol",
        namePlaceholder: "e.g., Email, Telegram, Threema, Matrix",
        valueLabel: "User ID / Handle",
        valuePlaceholder: "e.g., @username or ABCD1234",
        valueMultiline: false,
        buttonLabel: "Add Contact Info"
    },
    link: {
        title: "Add Link",
        nameLabel: "Label",
        namePlaceholder: "e.g., Twitter, GitHub, Portfolio",
        valueLabel: "URL",
        valuePlaceholder: "e.g., https://twitter.com/username",
        valueMultiline: false,
        buttonLabel: "Add Link"
    }
};

// Maps a list type to its state setter. Kept out of the component so the
// add/delete callbacks stay referentially stable.
const LIST_SETTERS = (type, setters) => (
    type === "address" ? setters.setAddresses
        : type === "link" ? setters.setLinks
            : type === "contact" ? setters.setContacts
                : null
);

function EditProfileDialog(props) {
    const { classes, open, onClose, onSave, api } = props;

    // Logged-in user state
    const [username, setUsername] = useState(null);
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [loadError, setLoadError] = useState(null);

    // Original data from blockchain (for change detection)
    const [originalData, setOriginalData] = useState(null);

    // Form state
    const [displayName, setDisplayName] = useState("");
    const [biography, setBiography] = useState("");
    const [location, setLocation] = useState("");
    const [website, setWebsite] = useState("");
    const [profilePictureUrl, setProfilePictureUrl] = useState("");
    const [profilePictureFile, setProfilePictureFile] = useState(null);
    const [addresses, setAddresses] = useState([]);
    const [links, setLinks] = useState([]);
    const [contacts, setContacts] = useState([]);

    // UI state
    const [dropzoneActive, setDropzoneActive] = useState(false);
    const [optionalExpanded, setOptionalExpanded] = useState(true);
    const [pictureError, setPictureError] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Delete confirmation dialog state
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null); // { item, listType: "address"|"link" }

    // Generic add-item dialog state (shared between addresses and links)
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [addDialogType, setAddDialogType] = useState("address"); // "address" | "link"
    const [newItemName, setNewItemName] = useState("");
    const [newItemValue, setNewItemValue] = useState("");

    // ImageWizard — opened when an uploaded picture is over the 48 kB budget
    const [wizardFile, setWizardFile] = useState(null);

    // Refs
    const dragCounterRef = useRef(0);
    const profilePictureUrlRef = useRef("");
    const processFileRef = useRef(null);

    // Drag overlay state
    const [isDraggingFile, setIsDraggingFile] = useState(false);

    // Load logged-in user and their profile data when dialog opens
    useEffect(() => {
        if (!open || !api) return;

        const loadProfile = async () => {
            setLoadingProfile(true);
            setLoadError(null);

            try {
                // Get the logged-in username from session manager
                let activeUsername = null;

                if (api.sessionManager) {
                    activeUsername = await api.sessionManager.getActiveAccount();
                }

                // Fallback to keyManager if sessionManager doesn't have it
                if (!activeUsername && api.keyManager?.getActiveAccount) {
                    activeUsername = api.keyManager.getActiveAccount();
                }

                if (!activeUsername) {
                    setLoadError(t("components.edit_profile_dialog.no_logged_in_user_found_please_log"));
                    setLoadingProfile(false);
                    return;
                }

                setUsername(activeUsername);
                console.log('EditProfileDialog: Loading profile for', activeUsername);

                // Fetch account data from blockchain
                const accounts = await api.accounts.getAccounts([activeUsername]);
                console.log(accounts)

                if (!accounts || accounts.length === 0 || !accounts[0]) {
                    setLoadError(t(
                        "components.edit_profile_dialog.could_not_load_account_data_from_blockchain"
                    ));
                    setLoadingProfile(false);
                    return;
                }

                const account = accounts[0];
                // An account that has never set metadata carries "" here, and
                // JSON.parse("") throws — which the catch below turned into
                // "could not load", locking those users out of profile editing
                // entirely. ProfileDescription and Feed both guard this way.
                const metadata = JSON.parse(account.posting_json_metadata || "{}");
                const profile = metadata.profile || {};

                console.log('EditProfileDialog: Loaded profile data', profile);

                // Store original data for change detection
                const originalProfile = {
                    displayName: profile.name || "",
                    biography: profile.about || "",
                    location: profile.location || "",
                    website: profile.website || "",
                    profilePictureUrl: profile.profile_image || "",
                    addresses: normalizeItems(profile.addresses),
                    links: normalizeItems(profile.links),
                    contacts: normalizeItems(profile.contacts)
                };
                setOriginalData(originalProfile);

                // Populate form fields
                setDisplayName(originalProfile.displayName);
                setBiography(originalProfile.biography);
                setLocation(originalProfile.location);
                setWebsite(originalProfile.website);
                setProfilePictureUrl(originalProfile.profilePictureUrl);
                setAddresses(originalProfile.addresses);
                setLinks(originalProfile.links);
                setContacts(originalProfile.contacts || []);
                setProfilePictureFile(null);

            } catch (error) {
                console.error('EditProfileDialog: Failed to load profile:', error);
                setLoadError(t("components.edit_profile_dialog.failed_to_load_profile", {
                    message: (error.message || "Unknown error")
                }));
            } finally {
                setLoadingProfile(false);
            }
        };

        loadProfile();
    }, [open, api]);

    // Reset state when dialog closes
    useEffect(() => {
        if (!open) {
            // Clean up blob URLs
            if (profilePictureUrl && profilePictureUrl.startsWith("blob:")) {
                URL.revokeObjectURL(profilePictureUrl);
            }
            // Reset states
            setUsername(null);
            setOriginalData(null);
            setDisplayName("");
            setBiography("");
            setLocation("");
            setWebsite("");
            setProfilePictureUrl("");
            setProfilePictureFile(null);
            setAddresses([]);
            setLinks([]);
            setPictureError("");
            setLoadError(null);
            setWizardFile(null);
        }
    }, [open]);

    // Keep refs in sync for the document-level drag handler (avoids stale closures)
    useEffect(() => { profilePictureUrlRef.current = profilePictureUrl; }, [profilePictureUrl]);
    useEffect(() => { processFileRef.current = processFile; }, [processFile]);

    // Document-level drag detection: shows the Portal overlay when a file enters the
    // window while the dialog is open and no profile picture is set. Uses a counter to
    // handle nested enter/leave from child elements. dragover + drop preventDefault on
    // document prevent the browser from navigating to the dropped file.
    useEffect(() => {
        if (!open) return;

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
            if (dragCounterRef.current === 1 && !profilePictureUrlRef.current) {
                setIsDraggingFile(true);
                setDropzoneActive(true);
            }
        };

        const onDocDragLeave = (e) => {
            e.preventDefault();
            dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
            if (dragCounterRef.current === 0) {
                setIsDraggingFile(false);
                setDropzoneActive(false);
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
            setDropzoneActive(false);
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
    }, [open]);

    // Callbacks

    // Extract image file from drop event (cross-browser: files, items, input sources)
    const extractImageFile = useCallback((event) => {
        const dtFiles = event?.dataTransfer?.files;
        if (dtFiles && dtFiles.length > 0) {
            for (let i = 0; i < dtFiles.length; i++) {
                if (dtFiles[i]?.type?.startsWith('image/')) return dtFiles[i];
            }
            if (dtFiles[0]) return dtFiles[0];
        }
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
        return null;
    }, []);

    // Handle drop on the Portal overlay
    const handleOverlayDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current = 0;
        setIsDraggingFile(false);
        setDropzoneActive(false);

        const imageFile = extractImageFile(e);
        if (imageFile && processFileRef.current) {
            processFileRef.current(imageFile);
        }
    }, [extractImageFile]);

    const handleFileUpload = useCallback((e) => {
        const files = e.target?.files || [];
        if (files.length > 0) {
            processFile(files[0]);
        }
    }, []);

    // trusted = true for files produced by the ImageWizard: they are pixel
    // art under the budget by construction, so re-probing them could only
    // false-negative and bounce the user straight back into the wizard.
    const processFile = useCallback(async (file, trusted = false) => {
        setPictureError("");

        if (!file.type.startsWith("image/")) {
            setPictureError("Please upload an image file");
            return;
        }

        if (file.size > 48000) {
            // Too heavy for blockchain storage — hand it to the ImageWizard,
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
                console.error('[EditProfileDialog] Pixel art check failed:', e);
                setPictureError("Could not read this image. Please try another file.");
                return;
            }
        }

        // Revoke previous blob URL
        if (profilePictureUrl && profilePictureUrl.startsWith("blob:")) {
            URL.revokeObjectURL(profilePictureUrl);
        }

        const url = URL.createObjectURL(file);
        setProfilePictureUrl(url);
        setProfilePictureFile(file);
    }, [profilePictureUrl]);

    const handleRemovePicture = useCallback(() => {
        if (profilePictureUrl && profilePictureUrl.startsWith("blob:")) {
            URL.revokeObjectURL(profilePictureUrl);
        }
        setProfilePictureUrl("");
        setProfilePictureFile(null);
        setPictureError("");
    }, [profilePictureUrl]);

    // --- ImageWizard callbacks ---
    const handleWizardClose = useCallback(() => setWizardFile(null), []);
    const handleWizardComplete = useCallback((optimizedFile) => {
        setWizardFile(null);
        // Re-run the normal path with trusted=true — the wizard's output is
        // pixel art under the budget by construction, so only the cheap
        // checks run and the probe is skipped. Uses the ref so this
        // callback never goes stale.
        if (optimizedFile && processFileRef.current) {
            processFileRef.current(optimizedFile, true);
        }
    }, []);

    // --- Generic delete handling (addresses & links) ---
    const handleDeleteItemClick = useCallback((item, listType) => {
        setItemToDelete({ item, listType });
        setDeleteConfirmOpen(true);
    }, []);

    const handleConfirmDelete = useCallback(() => {
        if (itemToDelete) {
            const { item, listType } = itemToDelete;
            const setter = LIST_SETTERS(listType, { setAddresses, setLinks, setContacts });
            if (setter) setter(prev => prev.filter(i => i.id !== item.id));
        }
        setDeleteConfirmOpen(false);
        setItemToDelete(null);
    }, [itemToDelete]);

    const handleCancelDelete = useCallback(() => {
        setDeleteConfirmOpen(false);
        setItemToDelete(null);
    }, []);

    // --- Generic add-item dialog handling (addresses & links) ---
    const handleOpenAddDialog = useCallback((type) => {
        setAddDialogType(type);
        setNewItemName("");
        setNewItemValue("");
        setAddDialogOpen(true);
    }, []);

    const handleCloseAddDialog = useCallback(() => {
        setAddDialogOpen(false);
        setNewItemName("");
        setNewItemValue("");
    }, []);

    const handleAddItem = useCallback(() => {
        if (newItemName.trim() && newItemValue.trim()) {
            const newItem = {
                id: Date.now().toString(),
                name: newItemName.trim().slice(0, MAX_ITEM_NAME_LEN),
                value: newItemValue.trim().slice(0, MAX_ITEM_VALUE_LEN)
            };
            const setter = LIST_SETTERS(addDialogType, { setAddresses, setLinks, setContacts });
            if (setter) setter(prev => prev.length >= MAX_ITEMS_PER_LIST ? prev : [...prev, newItem]);
            handleCloseAddDialog();
        }
    }, [newItemName, newItemValue, addDialogType, handleCloseAddDialog]);

    const handleToggleOptional = useCallback(() => {
        setOptionalExpanded(prev => !prev);
    }, []);

    const handleCancel = useCallback(() => {
        if (!isSaving) {
            onClose();
        }
    }, [onClose, isSaving]);

    // Check if any data has changed
    const hasChanges = useMemo(() => {
        if (!originalData) return false;

        // If there's a new file selected, there's definitely a change
        if (profilePictureFile) return true;

        const currentData = {
            displayName,
            biography,
            location,
            website,
            profilePictureUrl,
            addresses,
            links,
            contacts
        };

        return hasDataChanged(originalData, currentData);
    }, [originalData, displayName, biography, location, website, profilePictureUrl, addresses, links, contacts, profilePictureFile]);

    // MAIN SAVE LOGIC
    const handleConfirm = useCallback(async () => {
        if (!api || !username) {
            console.error("Missing API or username");
            setPictureError("Cannot save: not logged in");
            return;
        }

        if (!hasChanges) {
            onClose();
            return;
        }

        // Check if unlock is required before saving
        if (api.requiresUnlock) {
            try {
                const unlockStatus = await api.requiresUnlock('posting');
                if (unlockStatus.needsUnlock) {
                    console.log('EditProfileDialog: Unlock required, type:', unlockStatus.unlockType);
                    dispatcher.dispatch({
                        type: "UNLOCK",
                        data: {
                            requiredKeyType: 'posting',
                            actionDescription: 'Update profile',
                            username: username,
                            keyMissing: unlockStatus.unlockType === 'key',
                            onUnlock: () => {
                                console.log('EditProfileDialog: Retrying save after unlock');
                                handleConfirm();
                            }
                        }
                    });
                    return;
                }
            } catch (unlockErr) {
                console.error('EditProfileDialog: Unlock check failed:', unlockErr);
            }
        }

        setIsSaving(true);
        setPictureError("");

        try {
            let finalPictureUrl = profilePictureUrl;

            // If user selected a new file, convert to Base64
            if (profilePictureFile) {
                finalPictureUrl = await fileToBase64(profilePictureFile);
            }

            // Build profile object
            const profileData = {
                name: displayName,
                about: biography,
                location: location,
                website: website,
                profile_image: finalPictureUrl,
            };

            // Add addresses only if they exist
            if (addresses && addresses.length > 0) {
                profileData.addresses = addresses;
            }

            // Add links only if they exist
            if (links && links.length > 0) {
                profileData.links = links;
            }

            // Add contact info only if it exists
            if (contacts && contacts.length > 0) {
                profileData.contacts = contacts;
            }

            console.log('EditProfileDialog: Saving profile for', username, profileData);

            // This ensures it goes into posting_json_metadata and preserves other data
            await api.broadcast.updateProfile(username, profileData);

            console.log('EditProfileDialog: Metadata saved successfully');

            if (onSave) {
                onSave(profileData);
            }

            onClose();
        } catch (error) {
            console.error("EditProfileDialog: Failed to update profile", error);
            setPictureError("Update failed: " + (error.message || "Unknown error"));
        } finally {
            setIsSaving(false);
        }
    }, [displayName, biography, location, website, profilePictureUrl, profilePictureFile, addresses, links, contacts, api, username, hasChanges, onSave, onClose]);

    const isAddItemValid = useMemo(() => {
        return newItemName.trim().length > 0 && newItemValue.trim().length > 0;
    }, [newItemName, newItemValue]);

    const addDialogConfig = ADD_DIALOG_CONFIG[addDialogType] || ADD_DIALOG_CONFIG.address;

    // Render loading state
    const renderLoading = () => (
        <div className={classes.loadingContainer}>
            <CircularProgress />
            <Typography variant="body2" style={{ color: "#888" }}>
                {t("components.edit_profile_dialog.loading_profile_data")}
            </Typography>
        </div>
    );

    // Render error state
    const renderError = () => (
        <div className={classes.errorContainer}>
            <Typography variant="h6" style={{ color: "#888" }}>
                {t("words.error")}
            </Typography>
            <Typography variant="body2" style={{ color: "#888" }}>
                {loadError}
            </Typography>
            <Button variant="outlined" onClick={onClose} style={{ marginTop: 16 }}>
                {t("words.close")}
            </Button>
        </div>
    );

    // Render form content
    const renderForm = () => (
        <React.Fragment>
            <IconButton
                onClick={handleCancel}
                disabled={isSaving}
                style={{
                    position: "absolute",
                    right: 8,
                    top: 8,
                    color: "#999",
                    zIndex: 100
                }}
            >
                <CloseIcon />
            </IconButton>

            <Typography
                style={{ marginBottom: 24, paddingRight: 36 }}
                component="h2"
                variant="h6"
            >
                {t("components.edit_profile_dialog.update_your_metadata")}
                {username && (
                    <Typography variant="caption" style={{ marginLeft: 8, color: "#888" }}>
                        @{username}
                    </Typography>
                )}
            </Typography>

            {/* Profile Header - Picture and Basic Info */}
            <div className={classes.profileHeader}>
                <ProfilePictureZone
                    classes={classes}
                    pictureUrl={profilePictureUrl}
                    dropzoneActive={dropzoneActive}
                    onFileUpload={handleFileUpload}
                    onRemove={handleRemovePicture}
                />

                <div className={classes.profileFields}>
                    <TextField
                        label={t("components.edit_profile_dialog.display_name")}
                        variant="outlined"
                        fullWidth
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder={t("components.edit_profile_dialog.enter_your_display_name")}
                        disabled={isSaving}
                    />
                    <ToxicityWatcher text={displayName} label={t("components.edit_profile_dialog.display_name_2")} />

                    <TextField
                        label={t("components.edit_profile_dialog.biography")}
                        variant="outlined"
                        fullWidth
                        multiline
                        minRows={3}
                        maxRows={5}
                        value={biography}
                        onChange={(e) => setBiography(e.target.value)}
                        placeholder={t("components.edit_profile_dialog.tell_us_about_yourself")}
                        disabled={isSaving}
                    />
                    <ToxicityWatcher text={biography} label="biography" />
                </div>
            </div>

            {pictureError && (
                <Typography color="error" variant="caption" style={{display:'block', marginBottom: 16}}>
                    {pictureError}
                </Typography>
            )}

            <div className={classes.collapsibleSection}>
                <Collapse in={optionalExpanded}>
                    <div className={classes.sectionContent}>
                        <TextField
                            label={t("components.edit_profile_dialog.location")}
                            variant="outlined"
                            fullWidth
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder={t("components.edit_profile_dialog.city_country")}
                            style={{ marginBottom: 16 }}
                            disabled={isSaving}
                            InputProps={{
                                startAdornment: (
                                    <LocationOnIcon style={{ color: "#666", marginRight: 8 }} />
                                )
                            }}
                        />

                        <TextField
                            label={t("components.edit_profile_dialog.website")}
                            variant="outlined"
                            fullWidth
                            value={website}
                            onChange={(e) => setWebsite(e.target.value)}
                            placeholder="https://yourwebsite.com"
                            style={{ marginBottom: 16 }}
                            disabled={isSaving}
                            InputProps={{
                                startAdornment: (
                                    <LanguageIcon style={{ color: "#666", marginRight: 8 }} />
                                )
                            }}
                        />

                        <PermanenceNotice classes={classes} />

                        {/* Links Section */}
                        <Typography
                            variant="subtitle2"
                            style={{
                                color: "#ccc",
                                marginBottom: 8,
                                display: "flex",
                                alignItems: "center",
                                gap: 8
                            }}
                        >
                            <LinkIcon style={{ fontSize: 18 }} />
                            {t("words.links")}
                        </Typography>

                        <NameValueList
                            classes={classes}
                            items={links}
                            emptyIcon={LinkIcon}
                            emptyText="No links added yet"
                            addLabel="Add New Link"
                            onDeleteClick={(item) => handleDeleteItemClick(item, "link")}
                            onAddClick={(!isSaving && links.length < MAX_ITEMS_PER_LIST) ? () => handleOpenAddDialog("link") : undefined}
                        />

                        {/* Crypto Addresses Section */}
                        <Typography
                            variant="subtitle2"
                            style={{
                                color: "#ccc",
                                marginTop: 24,
                                marginBottom: 8,
                                display: "flex",
                                alignItems: "center",
                                gap: 8
                            }}
                        >
                            <AccountBalanceWalletIcon style={{ fontSize: 18 }} />
                            {t("components.edit_profile_dialog.crypto_public_addresses")}
                        </Typography>

                        <NameValueList
                            classes={classes}
                            items={addresses}
                            emptyIcon={AccountBalanceWalletIcon}
                            emptyText="No crypto addresses added yet"
                            addLabel="Add New Address"
                            onDeleteClick={(item) => handleDeleteItemClick(item, "address")}
                            onAddClick={(!isSaving && addresses.length < MAX_ITEMS_PER_LIST) ? () => handleOpenAddDialog("address") : undefined}
                        />

                        {/* Contact Info Section */}
                        <Typography
                            variant="subtitle2"
                            style={{
                                color: "#ccc",
                                marginTop: 24,
                                marginBottom: 8,
                                display: "flex",
                                alignItems: "center",
                                gap: 8
                            }}
                        >
                            <ContactMailIcon style={{ fontSize: 18 }} />
                            {t("words.contact_info")}
                        </Typography>

                        <NameValueList
                            classes={classes}
                            items={contacts}
                            emptyIcon={ContactMailIcon}
                            emptyText="No contact info added yet"
                            addLabel="Add Contact Info"
                            onDeleteClick={(item) => handleDeleteItemClick(item, "contact")}
                            onAddClick={(!isSaving && contacts.length < MAX_ITEMS_PER_LIST) ? () => handleOpenAddDialog("contact") : undefined}
                        />
                    </div>
                </Collapse>
            </div>
        </React.Fragment>
    );

    return (
        <React.Fragment>
            {/* Main Edit Profile Dialog */}
            <Dialog
                open={open}
                maxWidth="sm"
                fullWidth
                disablePortal={false}
                onClose={handleCancel}
                keepMounted={false}
                PaperProps={{
                    style: {
                        width: "min(calc(100% - 32px), 560px)",
                        maxWidth: "none"
                    }
                }}
            >
                <DialogContent style={{ position: "relative", paddingTop: 24 }}>
                    {loadingProfile ? renderLoading() : loadError ? renderError() : renderForm()}
                </DialogContent>

                {!loadingProfile && !loadError && (
                    <DialogActions
                        style={{
                            backgroundColor: "#171717",
                            borderRadius: "32px",
                            padding: "16px 24px",
                            justifyContent: "flex-end"
                        }}
                    >
                        <Button variant="text" color="primary" onClick={handleCancel} disabled={isSaving}>
                            {t("words.cancel")}
                        </Button>
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={handleConfirm}
                            disabled={isSaving || !hasChanges}
                            style={{ borderRadius: "32px", minWidth: 100 }}
                        >
                            {isSaving ? (
                                <CircularProgress size={24} color="inherit" />
                            ) : hasChanges ? (
                                "Save Changes"
                            ) : (
                                "No Changes"
                            )}
                        </Button>
                    </DialogActions>
                )}
            </Dialog>
            {/* Delete Confirmation Dialog (shared for addresses and links) */}
            <Dialog
                PaperProps={{ classes: { root: classes.whiteDialog } }}
                open={deleteConfirmOpen}
                maxWidth="xs"
                disablePortal={false}
                onClose={handleCancelDelete}
                keepMounted={false}
            >
                <DialogContent>
                    <Typography
                        style={{ marginTop: 8, marginBottom: 16 }}
                        component="h2"
                        variant="h6"
                    >{t("components.edit_profile_dialog.delete", {
                            text: itemToDelete?.listType === "link" ? "Link" : "Address"
                        })}</Typography>
                    <Typography variant="body2" color="textPrimary" component="p"><T
                            k="components.edit_profile_dialog.are_you_sure_you_want_to_remove"
                            vars={{
                                value: itemToDelete?.item?.name
                            }} /></Typography>
                    <Typography
                        variant="caption"
                        style={{ color: "#666", display: "block", marginTop: 8, fontFamily: "monospace", wordBreak: "break-all" }}
                    >
                        {itemToDelete?.item?.value}
                    </Typography>
                </DialogContent>
                <DialogActions style={{ textAlign: "right" }}>
                    <Button variant="text" color="primary" onClick={handleCancelDelete}>
                        {t("words.cancel")}
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleConfirmDelete}
                        style={{ backgroundColor: "#d32f2f" }}
                    >
                        {t("components.edit_profile_dialog.delete_2")}
                    </Button>
                </DialogActions>
            </Dialog>
            {/* Generic Add Item Dialog (shared between addresses and links) */}
            <Dialog
                PaperProps={{ classes: { root: classes.whiteDialog } }}
                open={addDialogOpen}
                maxWidth="sm"
                fullWidth
                disablePortal={false}
                onClose={handleCloseAddDialog}
                keepMounted={false}
            >
                <DialogContent>
                    <Typography
                        style={{ marginTop: 8, marginBottom: 24 }}
                        component="h2"
                        variant="h6"
                    >
                        {addDialogConfig.title}
                    </Typography>

                    <TextField
                        label={addDialogConfig.nameLabel}
                        variant="outlined"
                        fullWidth
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        placeholder={addDialogConfig.namePlaceholder}
                        style={{ marginBottom: 16 }}
                        autoFocus
                    />

                    <TextField
                        label={addDialogConfig.valueLabel}
                        variant="outlined"
                        fullWidth
                        value={newItemValue}
                        onChange={(e) => setNewItemValue(e.target.value)}
                        placeholder={addDialogConfig.valuePlaceholder}
                        multiline={addDialogConfig.valueMultiline}
                        minRows={addDialogConfig.valueMultiline ? 2 : undefined}
                    />
                </DialogContent>
                <DialogActions style={{ textAlign: "right" }}>
                    <Button variant="text" color="primary" onClick={handleCloseAddDialog}>
                        {t("words.cancel")}
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleAddItem}
                        disabled={!isAddItemValid}
                    >
                        {addDialogConfig.buttonLabel}
                    </Button>
                </DialogActions>
            </Dialog>
            {/* ImageWizard — shrinks oversized pictures to fit the 48 kB budget */}
            <ImageWizard
                open={!!wizardFile}
                file={wizardFile}
                maxKb={48}
                onClose={handleWizardClose}
                onComplete={handleWizardComplete}
            />
            {/* Invisible full-screen drag overlay — rendered while the dialog is open
                and no profile picture is set. pointer-events stays "none" until a file
                drag is detected on the document, then activates to catch the drop. */}
            {open && !profilePictureUrl && (
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

export default withStyles(styles)(EditProfileDialog);