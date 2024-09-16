// ============================================================================
// NotificationsDialog.js - Notification Center (Fullscreen Mobile / Menu Desktop)
// ============================================================================

import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import useTheme from "@material-ui/core/styles/useTheme";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import Slide from "@material-ui/core/Slide";
import Popover from "@material-ui/core/Popover";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import CircularProgress from "@material-ui/core/CircularProgress";
import Divider from "@material-ui/core/Divider";
import Fade from "@material-ui/core/Fade";

// Icons
import CloseIcon from "@material-ui/icons/Close";
import DoneAllIcon from "@material-ui/icons/DoneAll";
import ThumbUpAlt from "@material-ui/icons/ThumbUpAlt";
import Reply from "@material-ui/icons/Reply";
import Repeat from "@material-ui/icons/Repeat";
import PersonAdd from "@material-ui/icons/PersonAdd";
import AlternateEmail from "@material-ui/icons/AlternateEmail";
import Flag from "@material-ui/icons/Flag";
import Error from "@material-ui/icons/Error";
import Group from "@material-ui/icons/Group";
import Settings from "@material-ui/icons/Settings";
import Label from "@material-ui/icons/Label";
import VolumeOff from "@material-ui/icons/VolumeOff";
import VolumeUp from "@material-ui/icons/VolumeUp";
import Bookmark from "@material-ui/icons/Bookmark";
import BookmarkBorder from "@material-ui/icons/BookmarkBorder";
import NotificationsNone from "@material-ui/icons/NotificationsNone";
import Notifications from "@material-ui/icons/Notifications";

import { HISTORY } from "../utils/constants";

import { t, tk, tx, useLanguage, getLocaleCode } from "../utils/text";

const { useState, useEffect, useCallback, useRef, memo, useMemo } = React;

// ── Notification type → icon + color mapping ──
const NOTIFICATION_TYPE_MAP = {
    vote:          { Icon: ThumbUpAlt,       color: "#cccccc", label: "Vote" },
    reply:         { Icon: Reply,            color: "#cccccc", label: "Reply" },
    reply_comment: { Icon: Reply,            color: "#cccccc", label: "Reply" },
    reblog:        { Icon: Repeat,           color: "#cccccc", label: "Reblog" },
    follow:        { Icon: PersonAdd,        color: "#cccccc", label: "Follow" },
    mention:       { Icon: AlternateEmail,   color: "#cccccc", label: "Mention" },
    flag_post:     { Icon: Flag,             color: "#cccccc", label: "Flagged" },
    error:         { Icon: Error,            color: "#cccccc", label: "Error" },
    new_community: { Icon: Group,            color: "#cccccc", label: "New Community" },
    set_role:      { Icon: Settings,         color: "#cccccc", label: "Role Change" },
    set_props:     { Icon: Settings,         color: "#cccccc", label: "Properties" },
    set_label:     { Icon: Label,            color: "#cccccc", label: "Label" },
    mute_post:     { Icon: VolumeOff,        color: "#cccccc", label: "Muted" },
    unmute_post:   { Icon: VolumeUp,         color: "#cccccc", label: "Unmuted" },
    pin_post:      { Icon: Bookmark,         color: "#cccccc", label: "Pinned" },
    unpin_post:    { Icon: BookmarkBorder,    color: "#cccccc", label: "Unpinned" },
    subscribe:     { Icon: Notifications,    color: "#cccccc", label: "Subscribed" },
};

const DEFAULT_TYPE = { Icon: NotificationsNone, color: "#9e9e9e", label: "Notification" };

// ── Styles ──
const styles = (theme) => ({
    desktopPaper: {
        backgroundColor: "#101010",
        borderRadius: "16px",
        width: 420,
        maxHeight: 520,
        overflow: "hidden",
    },
    mobileDialog: {
        "& .MuiDialog-paper": {
            backgroundColor: "#101010",
            margin: 0,
            maxHeight: "100%",
            maxWidth: "100%",
            borderRadius: 0,
        },
    },
    header: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 8px 8px 20px",
        [theme.breakpoints.down("md")]: {
            backgroundColor: "transparent",
            borderRadius: "0px",
            minHeight: 64,
        },
        backgroundColor: "#ffffff21",
        borderRadius: "16px",
        minHeight: 52,
    },
    headerTitle: {
        fontWeight: 500,
        fontSize: "21px",
        color: "#eee",
        letterSpacing: "0.01em",
        fontFamily: `"Industry Book", "Normative Pro"`
    },
    headerActions: {
        display: "flex",
        alignItems: "center",
        gap: "2px",
    },
    headerButton: {
        color: "#888",
        "&:hover": { color: "#ccc" },
    },
    markReadButton: {
        color: "#666",
        transition: "color 200ms ease",
        "&:hover": { color: "#fff" },
    },
    content: {
        padding: "0 !important",
        overflowY: "auto",
        overflowX: "hidden",
        flex: 1,
        "&::-webkit-scrollbar": { width: 6 },
        "&::-webkit-scrollbar-track": { background: "transparent" },
        "&::-webkit-scrollbar-thumb": {
            background: "#333",
            borderRadius: 3,
        },
    },
    list: {
        padding: 0,
    },
    listItem: {
        transition: "background-color 150ms ease",
        cursor: "pointer",
        "&:hover": {
            backgroundColor: "#1e1e1e",
        },
    },
    listItemUnread: {
        backgroundColor: "#101010",
        "&:hover": {
            backgroundColor: "#171717",
        },
    },
    listItemRead: {
        opacity: 0.6,
    },
    iconContainer: {
        minWidth: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    notifIcon: {
        fontSize: 22,
    },
    primaryText: {
        fontSize: "14px",
        color: "#ddd",
        lineHeight: 1.4,
        wordBreak: "break-word",
    },
    primaryTextUnread: {
        fontSize: "14px",
        color: "#f0f0f0",
        fontWeight: 600,
        lineHeight: 1.4,
        wordBreak: "break-word",
    },
    secondaryText: {
        fontSize: "12.5px",
        color: "#aaa",
        fontFamily: `"Industry Book", "Normative Pro"`,
        marginTop: 4,
    },
    detailText: {
        display: "block",
        fontSize: "12px",
        fontWeight: 400,
        color: "#999",
        lineHeight: 1.35,
        marginTop: 2,
        wordBreak: "break-word",
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: "50%",
        backgroundColor: "#fff",
        flexShrink: 0,
        marginLeft: 8,
    },
    emptyState: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        color: "#555",
        textAlign: "center",
    },
    emptyIcon: {
        fontSize: 56,
        marginBottom: 16,
        color: "#333",
    },
    loadingContainer: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 0",
    },
    loaderColor: {
        color: "#666",
    },
    divider: {
        backgroundColor: "#1f1f1f",
    },
    typeBadge: {
        fontSize: "10px",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        padding: "1px 6px",
        borderRadius: 4,
        display: "inline-block",
        marginRight: 6,
    },
});

// ── Time ago helper ──
// This used to read `timeAgo.format(...)` — a call on the function itself. The
// refactor that retired the hand-rolled "5m ago" ladder in favour of a locale
// aware formatter never landed an import, and the local name shadowed whatever
// it was meant to reach, so `.format` was undefined. Every row threw a
// TypeError during render, which took the dialog's whole tree down with it.
//
// Intl.RelativeTimeFormat is what the old comment wanted: it covers every
// locale we ship and every plural category, with no catalogue keys to maintain.
// `numeric: "auto"` yields "yesterday"/"last week" where a language has them.
// One formatter per locale — constructing one per row is expensive, and this
// list renders up to 100 at a time.
const RELATIVE_UNITS = [
    ["year", 31536000000],
    ["month", 2592000000],
    ["week", 604800000],
    ["day", 86400000],
    ["hour", 3600000],
    ["minute", 60000],
    ["second", 1000],
];

const rtfCache = new Map();
const relativeFormatter = (code) => {
    let f = rtfCache.get(code);
    if (!f) {
        try {
            f = new Intl.RelativeTimeFormat(code, { numeric: "auto", style: "short" });
        } catch (e) {
            f = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" });
        }
        rtfCache.set(code, f);
    }
    return f;
};

function timeAgo(dateStr) {
    if (!dateStr) return "";
    const date = new Date(String(dateStr).includes("Z") ? dateStr : dateStr + "Z");
    const ms = date.getTime();
    if (!Number.isFinite(ms)) return "";

    // Clock skew between the node and the browser can put a fresh notification
    // a few seconds in the future; clamp so it never reads "in 3 seconds".
    const diff = Math.min(0, ms - Date.now());
    const abs = Math.abs(diff);
    const [unit, span] = RELATIVE_UNITS.find(([, s]) => abs >= s) || RELATIVE_UNITS[RELATIVE_UNITS.length - 1];
    return relativeFormatter(getLocaleCode()).format(Math.round(diff / span), unit);
}

// ── Message formatting helpers ──
// Community property keys → friendly labels, in display order.
// Values are translation KEYS. Module scope: t() here would pin the language
// to module load. formatNotification emits tk() descriptors; the row resolves
// them with tx() at render.
const PROP_LABELS = [
    ["title",       "components.notifications_dialog.prop_title"],
    ["about",       "components.notifications_dialog.prop_about"],
    ["description", "words.description"],
    ["lang",        "words.language"],
    ["flag_text",   "components.notifications_dialog.prop_flag_text"],
];

const ROLE_LABELS = {
    owner: "components.notifications_dialog.role_owner",
    admin: "components.notifications_dialog.role_admin",
    mod: "components.notifications_dialog.role_moderator",
    member: "components.notifications_dialog.role_member",
    guest: "components.notifications_dialog.role_guest",
    muted: "components.notifications_dialog.role_muted",
};

function truncateValue(value, max) {
    const str = String(value).trim();
    if (!str) return "";
    return str.length > max ? str.slice(0, max - 1).replace(/\s+$/, "") + "…" : str;
}

// "@portal-152228 set properties {…json…}" → { account, props|null }
function parseSetPropsMsg(msg) {
    const match = /^@([\w.-]+)\s+set properties\s+(\{[\s\S]*\})\s*$/.exec(msg || "");
    if (!match) return null;
    let props = null;
    try {
        props = JSON.parse(match[2]);
    } catch (e) {
        props = null; // malformed payload → show the sentence without details
    }
    return { account: match[1], props };
}

// "@alice set @bob mod" → "@alice set @bob as moderator"
function parseSetRoleMsg(msg) {
    const match = /^@([\w.-]+)\s+set\s+@?([\w.-]+)\s+([a-z]+)\s*$/i.exec(msg || "");
    if (!match) return null;
    const role = ROLE_LABELS[match[3].toLowerCase()] || match[3].toLowerCase();
    return tk("components.notifications_dialog.set_role", {
        actor: match[1],
        target: match[2],
        role: typeof role === "string" && role.indexOf(".") !== -1 ? tk(role) : role
    });
}

// Turns raw bridge messages into { primary, detail } for display.
// set_props no longer dumps the JSON payload: it becomes a sentence plus a
// compact "Title: … · Language: EN" detail line.
function formatNotification(notif) {
    const msg = notif.msg || t("components.notifications_dialog.notification");

    if (notif.type === "set_props") {
        const parsed = parseSetPropsMsg(msg);
        if (parsed) {
            const parts = [];
            if (parsed.props && typeof parsed.props === "object") {
                for (const [key, label] of PROP_LABELS) {
                    if (!(key in parsed.props)) continue;
                    let value = truncateValue(parsed.props[key], key === "title" ? 40 : 24);
                    if (!value) continue;
                    if (key === "lang") value = value.toUpperCase();
                    parts.push(tk("components.notifications_dialog.prop_line", { label: tk(label), value }));
                }
                if (parsed.props.is_nsfw === true || parsed.props.is_nsfw === "true") {
                    parts.push(tk("components.notifications_dialog.nsfw_yes"));
                }
            }
            return {
                primary: tk("components.notifications_dialog.updated_the_community_settings", { account: parsed.account }),
                detail: parts.length ? parts : null,
            };
        }
    }

    if (notif.type === "set_role") {
        const pretty = parseSetRoleMsg(msg);
        if (pretty) return { primary: pretty, detail: null };
    }

    return { primary: msg, detail: null };
}

// ── Navigation helpers ──
// Comment permlinks follow "re-<parentAuthor>-<parentPermlink>-<base36 suffix>",
// nested one level per reply depth, e.g.
//   re-primerz-re-mes-clown-1779821861939-mqpkxs6y-mqpl5ppl
//     → parent: @primerz/re-mes-clown-1779821861939-mqpkxs6y
//     → root:   @mes/clown-1779821861939
// Peels one "re-<author>-…-<suffix>" layer per iteration until the root
// "<slug>-<13-digit ms timestamp>" remains. Assumes regular account names
// contain no dashes (portal-* accounts don't author comments).
function extractRootFromReplyPermlink(permlink) {
    let current = permlink;
    let author = null;
    let guard = 0;
    while (current.indexOf("re-") === 0 && guard++ < 12) {
        const match = /^re-([a-z0-9.]+)-(.+)-([a-z0-9]{6,13})$/.exec(current);
        if (!match) return null;
        author = match[1];
        current = match[2];
    }
    if (!author || !/-\d{13}$/.test(current)) return null;
    return { author, permlink: current };
}

// Resolves the full in-app path for a post/comment notification. Post routes
// REQUIRE the category segment ("/technology/@author/permlink") and the
// notification payload doesn't carry it, so this fetches via
// pixaAPI.content.getContent:
//   - reply chains are pre-resolved to the root by the caller, so the common
//     case is a single fetch of the root post (post entities carry `category`)
//   - if we still land on a comment (unparseable chain), hop once to its root
//     through the sanitized root_author/root_permlink fields
//   - last resort: the chain-provided `url` field, when it already carries
//     the category segment ("/category/@root/rootpermlink#…")
async function resolvePostPath(contentAPI, author, permlink, wantReplies) {
    let content = await contentAPI.getContent(author, permlink);
    if (!content) return null;

    if (content._entity_type === "comment" || (content.depth || 0) > 0) {
        wantReplies = true;
        const rootAuthor = content.root_author;
        const rootPermlink = content.root_permlink;
        if (rootAuthor && rootPermlink && (rootAuthor !== content.author || rootPermlink !== content.permlink)) {
            content = (await contentAPI.getContent(rootAuthor, rootPermlink)) || content;
        }
    }

    const anchor = wantReplies ? "#replies" : "";

    const category = content.category || content.community || "";
    if (category && content.author && content.permlink && (content.depth || 0) === 0) {
        return `/${category}/@${content.author}/${content.permlink}${anchor}`;
    }

    const url = typeof content.url === "string" ? content.url : "";
    const hashIndex = url.indexOf("#");
    const base = hashIndex === -1 ? url : url.slice(0, hashIndex);
    if (/^\/[^/@][^/]*\/@[^/]+\/[^/#?]+$/.test(base)) {
        return base + anchor;
    }
    return null;
}

// ── Single notification row ──
const NotificationItem = React.memo(({ classes, notification, isRead, onClick }) => {
    useLanguage();
    const typeDef = NOTIFICATION_TYPE_MAP[notification.type] || DEFAULT_TYPE;
    const { Icon, color } = typeDef;

    // formatNotification returns descriptors, not prose, so this memo does NOT
    // need the locale in its deps — switching language re-renders and re-resolves
    // without recomputing. Resolution happens below, at render.
    const display = useMemo(() => formatNotification(notification), [notification]);
    const primaryText = tx(display.primary);
    const detailText = Array.isArray(display.detail)
        ? tx(display.detail).join("  ·  ")
        : tx(display.detail);

    const handleClick = useCallback(() => {
        if (onClick) onClick(notification);
    }, [notification, onClick]);

    return (
        <ListItem
            button
            className={`${classes.listItem} ${isRead ? classes.listItemRead : classes.listItemUnread}`}
            onClick={handleClick}
        >
            <ListItemIcon className={classes.iconContainer}>
                <Icon className={classes.notifIcon} style={{ color }} />
            </ListItemIcon>
            <ListItemText
                primary={
                    <React.Fragment>
                        {primaryText}
                        {detailText && (
                            <span className={classes.detailText}>{detailText}</span>
                        )}
                    </React.Fragment>
                }
                secondary={timeAgo(notification.date)}
                classes={{
                    primary: isRead ? classes.primaryText : classes.primaryTextUnread,
                    secondary: classes.secondaryText,
                }}
                disableTypography={false}
            />
            {!isRead && <div className={classes.unreadDot} />}
        </ListItem>
    );
});

// ── Empty state ──
const EmptyState = React.memo(({ classes }) => (
    <div className={classes.emptyState}>
        <NotificationsNone className={classes.emptyIcon} />
        <Typography variant="body2" style={{ color: "#555" }}>
            {t("components.notifications_dialog.no_notifications_yet")}
        </Typography>
        <Typography variant="caption" style={{ color: "#444", marginTop: 4 }}>
            {t(
                "components.notifications_dialog.when_people_interact_with_your_content_youll"
            )}
        </Typography>
    </div>
));

// ── Inner content (shared between mobile dialog & desktop popover) ──
const NotificationsContent = React.memo(({
                                             classes,
                                             notifications,
                                             readIds,
                                             loading,
                                             onClose,
                                             onMarkAllRead,
                                             onNotificationClick,
                                             showCloseButton,
                                         }) => {
    useLanguage();
    const unreadCount = useMemo(() => {
        if (!notifications || !readIds) return 0;
        return notifications.filter((n) => !readIds.has(n.id)).length;
    }, [notifications, readIds]);

    return (
        <React.Fragment>
            <div className={classes.header}>
                <Typography className={classes.headerTitle}>{t("components.notifications_dialog.notifications", {
                    unreadCount: unreadCount > 0 ? ` (${unreadCount})` : ""
                })}</Typography>
                <div className={classes.headerActions}>
                    {unreadCount > 0 && (
                        <Tooltip title={t("components.notifications_dialog.mark_all_as_read")}>
                            <IconButton
                                className={classes.markReadButton}
                                onClick={onMarkAllRead}
                                size="small"
                            >
                                <DoneAllIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                    {showCloseButton && (
                        <IconButton
                            className={classes.headerButton}
                            onClick={onClose}
                            size="small"
                        >
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    )}
                </div>
            </div>
            <div className={classes.content} style={{ overflowY: "auto", maxHeight: showCloseButton ? "calc(100vh - 60px)" : 440 }}>
                {loading ? (
                    <div className={classes.loadingContainer}>
                        <CircularProgress size={32} className={classes.loaderColor} />
                    </div>
                ) : !notifications || notifications.length === 0 ? (
                    <EmptyState classes={classes} />
                ) : (
                    <List className={classes.list}>
                        {notifications.map((notif, index) => (
                            <React.Fragment key={notif.id || index}>
                                <NotificationItem
                                    classes={classes}
                                    notification={notif}
                                    isRead={readIds.has(notif.id)}
                                    onClick={onNotificationClick}
                                />
                            </React.Fragment>
                        ))}
                    </List>
                )}
            </div>
        </React.Fragment>
    );
});

// ── Main component ──
const NotificationsDialog = ({
                                 classes,
                                 open,
                                 anchorEl,
                                 onClose,
                                 pixaAPI,
                                 account,
                                 onUnreadCountChange,
                             }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    const [notifications, setNotifications] = useState([]);
    const [readIds, setReadIds] = useState(new Set());
    const [loading, setLoading] = useState(false);
    const isMounted = useRef(true);

    // ── Fetch notifications from bridge + read state from LacertaDB ──
    const fetchNotifications = useCallback(async () => {
        if (!pixaAPI || !account) return;
        setLoading(true);
        try {
            const [notifs, readSet] = await Promise.all([
                pixaAPI.accounts.getAccountNotifications(account, 100),
                pixaAPI.accounts.getReadNotificationIds
                    ? pixaAPI.accounts.getReadNotificationIds(account)
                    : Promise.resolve(new Set()),
            ]);

            if (isMounted.current) {
                const list = Array.isArray(notifs) ? notifs : [];
                setNotifications(list);
                setReadIds(readSet instanceof Set ? readSet : new Set());

                // Report unread count up
                if (onUnreadCountChange) {
                    const unread = list.filter((n) => !(readSet instanceof Set ? readSet : new Set()).has(n.id)).length;
                    onUnreadCountChange(unread);
                }
            }
        } catch (e) {
            console.warn("[NotificationsDialog] fetch error:", e.message);
            if (isMounted.current) {
                setNotifications([]);
            }
        } finally {
            if (isMounted.current) setLoading(false);
        }
    }, [pixaAPI, account, onUnreadCountChange]);

    // Fetch on mount / account change so the badge count is live even before
    // the dialog is opened. Also re-fetches when `open` flips to true so the
    // list is fresh every time the user opens the popover/drawer.
    useEffect(() => {
        isMounted.current = true;
        if (account) fetchNotifications();
        return () => { isMounted.current = false; };
    }, [open, account, fetchNotifications]);

    // ── Mark all as read ──
    const handleMarkAllRead = useCallback(async () => {
        if (!pixaAPI || !notifications.length) return;
        const allIds = notifications.map((n) => n.id).filter(Boolean);
        try {
            if (pixaAPI.accounts.markNotificationsRead) {
                await pixaAPI.accounts.markNotificationsRead(account, allIds);
            }
            const newSet = new Set(allIds);
            setReadIds(newSet);
            if (onUnreadCountChange) onUnreadCountChange(0);
        } catch (e) {
            console.warn("[NotificationsDialog] markAllRead error:", e.message);
        }
    }, [pixaAPI, account, notifications, onUnreadCountChange]);

    // ── Click individual notification → mark read + navigate ──
    const handleNotificationClick = useCallback(async (notif) => {
        // Mark this one as read
        if (pixaAPI && pixaAPI.accounts.markNotificationsRead && notif.id && !readIds.has(notif.id)) {
            try {
                await pixaAPI.accounts.markNotificationsRead(account, [notif.id]);
                setReadIds((prev) => {
                    const next = new Set(prev);
                    next.add(notif.id);
                    return next;
                });
                if (onUnreadCountChange) {
                    const remaining = notifications.filter(
                        (n) => n.id && !readIds.has(n.id) && n.id !== notif.id
                    ).length;
                    onUnreadCountChange(remaining);
                }
            } catch (e) {
                console.warn("[NotificationsDialog] markRead error:", e.message);
            }
        }

        // Navigate to the relevant content. Post routes REQUIRE the category
        // segment, which only get_content can provide — so posts/comments are
        // resolved through the content API before pushing.
        const url = (notif.url || "").replace(/^\//, "");
        if (!url) return;

        // "c/portal-152228" — community notifications → portal page
        const communityMatch = /^c\/([\w.-]+)$/.exec(url);
        if (communityMatch) {
            onClose();
            HISTORY.push("/" + communityMatch[1]);
            return;
        }

        // "@author/permlink" — posts and comments
        const postMatch = /^@([^/]+)\/([^/#?]+)$/.exec(url);
        if (postMatch) {
            if (!(pixaAPI && pixaAPI.content && pixaAPI.content.getContent)) {
                console.warn("[NotificationsDialog] content API unavailable, cannot resolve:", notif.url);
                return;
            }
            const isReply = postMatch[2].indexOf("re-") === 0;
            const root = isReply ? extractRootFromReplyPermlink(postMatch[2]) : null;
            try {
                const path = await resolvePostPath(
                    pixaAPI.content,
                    root ? root.author : postMatch[1],
                    root ? root.permlink : postMatch[2],
                    isReply
                );
                if (path) {
                    onClose();
                    HISTORY.push(path);
                } else {
                    console.warn("[NotificationsDialog] could not resolve path for:", notif.url);
                }
            } catch (e) {
                console.warn("[NotificationsDialog] resolve error:", e.message);
            }
            return;
        }

        // "@account" (follows) and anything else — direct pass-through
        onClose();
        HISTORY.push("/" + url);
    }, [pixaAPI, account, readIds, notifications, onClose, onUnreadCountChange]);

    // ── Desktop: Popover ──
    if (!isMobile) {
        return (
            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={onClose}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
                transformOrigin={{ vertical: "top", horizontal: "center" }}
                PaperProps={{ className: classes.desktopPaper }}
                TransitionComponent={Fade}
                transitionDuration={200}
            >
                <NotificationsContent
                    classes={classes}
                    notifications={notifications}
                    readIds={readIds}
                    loading={loading}
                    onClose={onClose}
                    onMarkAllRead={handleMarkAllRead}
                    onNotificationClick={handleNotificationClick}
                    showCloseButton={false}
                />
            </Popover>
        );
    }

    // ── Mobile: Fullscreen Dialog ──
    return (
        <Dialog
            fullScreen
            open={open}
            onClose={onClose}
            className={classes.mobileDialog}
        >
            <NotificationsContent
                classes={classes}
                notifications={notifications}
                readIds={readIds}
                loading={loading}
                onClose={onClose}
                onMarkAllRead={handleMarkAllRead}
                onNotificationClick={handleNotificationClick}
                showCloseButton={true}
            />
        </Dialog>
    );
};

NotificationsDialog.displayName = "NotificationsDialog";
export default withStyles(styles)(NotificationsDialog);