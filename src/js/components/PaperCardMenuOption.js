import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import MenuItem from "@material-ui/core/MenuItem";
import MenuList from "@material-ui/core/MenuList";
import Divider from "@material-ui/core/Divider";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import Menu from "@material-ui/core/Menu";
import FavoriteIcon from "@material-ui/icons/Favorite";
import FavoriteBorderIcon from "@material-ui/icons/FavoriteBorder";
import ShareIcon from "@material-ui/icons/Share";
import Description from "@material-ui/icons/Description";
import HowToVote from "@material-ui/icons/HowToVote";
import ReportIcon from "@material-ui/icons/Report";
import VisibilityOffIcon from "@material-ui/icons/VisibilityOff";
import VisibilityIcon from "@material-ui/icons/Visibility";
// MUI v4 has no PushPin; alias Bookmark icons for pin visuals.
import PushPinOutlined from "@material-ui/icons/BookmarkBorder";
import PushPin from "@material-ui/icons/Bookmark";
import BookmarkIcon from "@material-ui/icons/Bookmark";
import BookmarkBorderIcon from "@material-ui/icons/BookmarkBorder";
import LinkIcon from "@material-ui/icons/Link";
import CodeIcon from "@material-ui/icons/Code";
import EditRounded from "@material-ui/icons/EditRounded";
import TuneRounded from "@material-ui/icons/TuneRounded";
import DeleteOutlineRounded from "@material-ui/icons/DeleteOutlineRounded";
import * as actions from "../actions/utils";

import { t, useLanguage } from "../utils/text";

const { memo, useCallback, useMemo, useState } = React;

const styles = theme => ({
    menu: {
        "& .MuiPaper-root": {
            backgroundColor: "#1a1a1a",
            borderRadius: "21px"
        },
        "& .MuiMenuItem-root": {
            "&:hover": {
                backgroundColor: "#2a2a2a"
            }
        },
        "& .MuiListItemIcon-root": {
            color: "#999",
            minWidth: 36
        },
        "& .MuiListItemText-primary": {
            color: "#ddd",
            fontSize: 14
        },
        "& .MuiDivider-root": {
            backgroundColor: "#2a2a2a",
            margin: "4px 0"
        }
    }
});

// ── Role helpers ───────────────────────────────────────────────────
const MOD_ROLES = ['owner', 'admin', 'mod'];
const isModOrHigher = role => MOD_ROLES.includes(role);

const getAuthorUsername = author =>
    (author && typeof author === 'object') ? (author.username || author.name || '') : (author || '');

/**
 * Compare function for React.memo
 */
const compareProps = (prevProps, nextProps) => {
    if (prevProps.xy?.[0] !== nextProps.xy?.[0] || prevProps.xy?.[1] !== nextProps.xy?.[1]) {
        return false;
    }
    if (prevProps.onClose !== nextProps.onClose) return false;
    if (prevProps.data !== nextProps.data) return false;
    if (prevProps.classes !== nextProps.classes) return false;
    if (prevProps.api !== nextProps.api) return false;
    if (prevProps.onModerate !== nextProps.onModerate) return false;
    if (prevProps.viewerRole !== nextProps.viewerRole) return false;
    if (prevProps.viewer !== nextProps.viewer) return false;
    if (prevProps.onEditPost !== nextProps.onEditPost) return false;
    if (prevProps.onEditContent !== nextProps.onEditContent) return false;
    if (prevProps.onDeletePost !== nextProps.onDeletePost) return false;
    if (prevProps.onDeleteComment !== nextProps.onDeleteComment) return false;
    return true;
};

const PaperCardMenuOption = React.memo(({ classes, data, xy = [], onClose, api, onModerate, viewerRole = null, viewer = null, onEditPost = null, onEditContent = null, onDeletePost = null, onDeleteComment = null }) => {
    useLanguage();
    const [isFavorited, setIsFavorited] = useState(false);
    const [isBookmarked, setIsBookmarked] = useState(false);

    // Memoize menu coordinates
    const menuPosition = useMemo(() => {
        const x = xy[0] | 0;
        const y = xy[1] | 0;
        return { x, y };
    }, [xy]);

    // Memoize open state
    const isOpen = useMemo(() => {
        return Boolean(menuPosition.y) || Boolean(menuPosition.x);
    }, [menuPosition.x, menuPosition.y]);

    // Post identity ----------------------------------------------------------
    const community = data?.community || data?.category || '';
    const authorUsername = getAuthorUsername(data?.author);
    const permlink = data?.permlink || '';

    // Post state (mute / pin) — read defensively from bridge-style stats
    const stats = data?.stats || {};
    const isMuted = Boolean(stats.gray || stats.hide);
    const isPinned = Boolean(stats.is_pinned);

    // Permissions derived from viewer props (owned by parent)
    const canModerate = isModOrHigher(viewerRole);

    // ── Ownership (edit/delete own content) ────────────────────────────
    // Cards carry posts on the pages and comments/replies on the Profile
    // tabs — a non-empty parent_author marks the latter. The page that
    // mounts this menu owns the actual dialogs and broadcasts; we only
    // surface the entries it wired callbacks for.
    const isOwner = Boolean(viewer && authorUsername && viewer === authorUsername);
    const isComment = Boolean(data?.parent_author);
    const isBlogPost = (data?._content_type || '') === 'blog';
    const ownerCanEditDetails = isOwner && !isComment && typeof onEditPost === 'function';
    const ownerCanEditContent = isOwner && !isComment && isBlogPost && typeof onEditContent === 'function';
    const ownerCanDeletePost = isOwner && !isComment && typeof onDeletePost === 'function';
    const ownerCanDeleteComment = isOwner && isComment && typeof onDeleteComment === 'function';
    const showOwnerSection = ownerCanEditDetails || ownerCanEditContent || ownerCanDeletePost || ownerCanDeleteComment;

    const handleEditPost = useCallback(() => {
        if (typeof onEditPost === 'function') onEditPost(data);
        onClose();
    }, [onEditPost, data, onClose]);

    const handleEditContent = useCallback(() => {
        if (typeof onEditContent === 'function') onEditContent(data);
        onClose();
    }, [onEditContent, data, onClose]);

    const handleDeletePost = useCallback(() => {
        if (typeof onDeletePost === 'function') onDeletePost(data);
        onClose();
    }, [onDeletePost, data, onClose]);

    const handleDeleteComment = useCallback(() => {
        if (typeof onDeleteComment === 'function') onDeleteComment(data);
        onClose();
    }, [onDeleteComment, data, onClose]);

    // ── Moderation handlers ────────────────────────────────────────────────
    // These bubble up to the parent (Community.js) which owns the reason
    // dialog and the actual broadcast call.

    const emitModerate = useCallback((op) => {
        if (typeof onModerate === 'function') {
            onModerate(op, {
                community,
                author: authorUsername,
                permlink,
                isMuted,
                isPinned
            });
        }
        onClose();
    }, [onModerate, community, authorUsername, permlink, isMuted, isPinned, onClose]);

    const handleMute    = useCallback(() => emitModerate('mutePost'),    [emitModerate]);
    const handleUnmute  = useCallback(() => emitModerate('unmutePost'),  [emitModerate]);
    const handlePin     = useCallback(() => emitModerate('pinPost'),     [emitModerate]);
    const handleUnpin   = useCallback(() => emitModerate('unpinPost'),   [emitModerate]);

    // ── Existing handlers (unchanged) ──────────────────────────────────────

    const handleFavorite = useCallback(async () => {
        if (!api) {
            setIsFavorited(!isFavorited);
            actions.trigger_snackbar(isFavorited ? t("words.removed_from_favorites") : t("words.added_to_favorites"));
            onClose();
            return;
        }
        setIsFavorited(!isFavorited);
        actions.trigger_snackbar(isFavorited ? t("words.removed_from_favorites") : t("words.added_to_favorites"));
        onClose();
    }, [api, isFavorited, onClose]);

    const handleBookmark = useCallback(async () => {
        if (!api) {
            setIsBookmarked(!isBookmarked);
            actions.trigger_snackbar(isBookmarked ? t("components.paper_card_menu_option.bookmark_removed") : t("components.paper_card_menu_option.bookmarked"));
            onClose();
            return;
        }
        setIsBookmarked(!isBookmarked);
        actions.trigger_snackbar(isBookmarked ? t("components.paper_card_menu_option.bookmark_removed") : t("components.paper_card_menu_option.bookmarked"));
        onClose();
    }, [api, isBookmarked, onClose]);

    const handleShare = useCallback(() => {
        const postUrl = data?.url || data?.permlink
            ? `${window.location.origin}/@${getAuthorUsername(data.author)}/${data.permlink}`
            : window.location.href;

        if (navigator.share) {
            navigator.share({
                title: data?.title || 'Check this out',
                text: data?.body?.substring(0, 100) || '',
                url: postUrl
            }).catch(() => { /* user cancelled or error */ });
        } else {
            actions.trigger_share();
        }
        onClose();
    }, [data, onClose]);

    const handleCopyLink = useCallback(() => {
        const postUrl = data?.url || data?.permlink
            ? `${window.location.origin}/${data.category || data.community || ''}/@${getAuthorUsername(data.author)}/${data.permlink}`
            : window.location.href;

        navigator.clipboard.writeText(postUrl).then(() => {
            actions.trigger_snackbar(t("words.link_copied_to_clipboard"));
        }).catch(() => {
            actions.trigger_snackbar(t("components.paper_card_menu_option.failed_to_copy_link"));
        });
        onClose();
    }, [data, onClose]);

    const handleVotes = useCallback(() => {
        actions.trigger_votes("+");
        onClose();
    }, [onClose]);

    const handleDetails = useCallback(() => {
        if (data?.permlink && data?.author) {
            const authorName = getAuthorUsername(data.author);
            window.open(`/@${authorName}/${data.permlink}`, "_blank", "noopener,noreferrer");
        }
        onClose();
    }, [data, onClose]);

    const handleDataViewer = useCallback(() => {
        if (data) {
            actions.trigger_data_viewer(data);
        }
        onClose();
    }, [data, onClose]);

    const handleContextMenu = useCallback((e) => {
        e.preventDefault();
    }, []);

    const paperProps = useMemo(() => ({
        style: {
            overflowY: "overlay",
            contain: "style layout",
            scrollBehavior: "smooth",
            userSelect: "none",
            pointerEvents: isOpen ? "all" : "none"
        }
    }), [isOpen]);

    const menuListProps = useMemo(() => ({ dense: true }), []);
    const transitionDuration = useMemo(() => ({ enter: 125, exit: 250 }), []);
    const anchorPosition = useMemo(() => ({
        top: menuPosition.y,
        left: menuPosition.x
    }), [menuPosition.x, menuPosition.y]);

    const showModSection = canModerate;

    return (
        <Menu
            className={classes.menu}
            PaperProps={paperProps}
            onContextMenu={handleContextMenu}
            MenuListProps={menuListProps}
            transitionDuration={transitionDuration}
            open={isOpen}
            onClose={onClose}
            disablePortal={false}
            keepMounted={true}
            anchorReference="anchorPosition"
            anchorPosition={anchorPosition}
        >
            <MenuList>
                <MenuItem onClick={handleCopyLink}>
                    <ListItemIcon>
                        <LinkIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary={t("components.paper_card_menu_option.copy_link")} />
                </MenuItem>
                <MenuItem onClick={handleDataViewer}>
                    <ListItemIcon>
                        <CodeIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary={t("components.paper_card_menu_option.inspect_data")} />
                </MenuItem>

                {showOwnerSection && <Divider />}

                {/* ── Owner section — own posts / comments only ── */}
                {ownerCanEditContent && (
                    <MenuItem onClick={handleEditContent}>
                        <ListItemIcon>
                            <EditRounded fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={t("components.paper_card_menu_option.edit_content")} />
                    </MenuItem>
                )}
                {ownerCanEditDetails && (
                    <MenuItem onClick={handleEditPost}>
                        <ListItemIcon>
                            <TuneRounded fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={t("components.paper_card_menu_option.edit_details")} />
                    </MenuItem>
                )}
                {ownerCanDeletePost && (
                    <MenuItem onClick={handleDeletePost}>
                        <ListItemIcon>
                            <DeleteOutlineRounded fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={t("components.paper_card_menu_option.delete_post")} />
                    </MenuItem>
                )}
                {ownerCanDeleteComment && (
                    <MenuItem onClick={handleDeleteComment}>
                        <ListItemIcon>
                            <DeleteOutlineRounded fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={t("components.paper_card_menu_option.delete_comment")} />
                    </MenuItem>
                )}

                {showModSection && <Divider />}

                {/* Pin / Unpin — mods+ only */}
                {canModerate && !isPinned && (
                    <MenuItem onClick={handlePin} className={classes.modItem}>
                        <ListItemIcon>
                            <PushPinOutlined fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={t("components.paper_card_menu_option.pin_post")} />
                    </MenuItem>
                )}
                {canModerate && isPinned && (
                    <MenuItem onClick={handleUnpin} className={classes.modItem}>
                        <ListItemIcon>
                            <PushPin fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={t("components.paper_card_menu_option.unpin_post")} />
                    </MenuItem>
                )}

                {/* Mute / Unmute — mods+ only */}
                {canModerate && !isMuted && (
                    <MenuItem onClick={handleMute} className={classes.modItem}>
                        <ListItemIcon>
                            <VisibilityOffIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={t("components.paper_card_menu_option.mute_post")} />
                    </MenuItem>
                )}
                {canModerate && isMuted && (
                    <MenuItem onClick={handleUnmute} className={classes.modItem}>
                        <ListItemIcon>
                            <VisibilityIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={t("components.paper_card_menu_option.unmute_post")} />
                    </MenuItem>
                )}

            </MenuList>
        </Menu>
    );
}, compareProps);

PaperCardMenuOption.displayName = 'PaperCardMenuOption';

export default withStyles(styles)(PaperCardMenuOption);