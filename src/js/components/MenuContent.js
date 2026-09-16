// ============================================================================
// MenuContent.js - Single main view (Optimized)
// ----------------------------------------------------------------------------
// Optimization summary:
//   1. The exported MenuContent is wrapped in React.memo() with a custom comparator
//      so a parent re-render with the same props never re-renders this tree.
//      (The component is "always mounted" and rarely changes meaningfully.)
//   2. Every sub-component is memoized with a TARGETED comparator that only
//      checks the props that actually drive its visual output - stable refs
//      from withStyles / useCallback are skipped, so they never cause false
//      cache invalidations.
//   3. The UI is split into independent leaves:
//        MainView, CommunityItem, TagChip, TagChipIcon, ProfileImage,
//        ActionButtons, ProfileHeader, CTASection, ProposalsTile, PortalIconTile,
//        FriendTile, FeedTile, LoginView, LoggedOutHeader, LoadingView, NotificationsLayer,
//        AppsMenu, AppsMenuEntry.
//      Each one re-renders only when its own slice of state changes - chips,
//      communities, notif badge, profile header, etc. are skipped entirely.
//   4. Per-item leaves (TagChip, CommunityItem) bind their click handler with
//      a stable `data` prop instead of inline arrows, so the .map() output is
//      stable across renders of their parent view.
//   5. `debugMsg` is moved out of React state into a ref - it was triggering
//      whole-tree re-renders for an invisible value.
//   6. All inline style objects are hoisted to module-level constants so
//      their identity is stable.
//   7. CSS `contain: layout style paint` is added to the scroll view, chip
//      wrap, and lists, so scrolling and per-section updates isolate
//      paint/layout work.
//   8. Per-render allocations (the outer container's style, the isMobile-
//      dependent height) are memoized.
// ============================================================================

import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import Badge from "@material-ui/core/Badge";
import IconButton from "@material-ui/core/IconButton";
import Notifications from "@material-ui/icons/Notifications";
import AccountBalanceWallet from "@material-ui/icons/AccountBalanceWallet"; // eslint-disable-line no-unused-vars
import ExitToApp from "@material-ui/icons/ExitToApp";
import Tooltip from "@material-ui/core/Tooltip";
import * as actions from "../actions/utils";
import { HISTORY, PROPOSALS_PORTAL, COMMUNITY_PORTALS, buildFeedFocusHash } from "../utils/constants";
import NewspaperVariant from "../icons/NewspaperVariant";
import Chip from "@material-ui/core/Chip";
import Typography from "@material-ui/core/Typography";
import CloseIcon from "@material-ui/icons/Close";
import AccountPlus from "../icons/AccountPlus";
import AccountLockOpen from "../icons/AccountLockOpen";
import Collapse from "@material-ui/core/Collapse";
import getIt from "../data/linkedinBanner";
import * as legacyApi from "../utils/settings";
import ButtonBase from "@material-ui/core/ButtonBase";
import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import Skeleton from "@material-ui/lab/Skeleton";
import LogoutModal from "./LogoutModal";
import NotificationsDialog from "./NotificationsDialog";
import Fade from "@material-ui/core/Fade";
import BallotRounded from "@material-ui/icons/BallotRounded";
import ForumRounded from "@material-ui/icons/ForumRounded";
import HowToVoteRounded from "@material-ui/icons/HowToVoteRounded";
import TrendingUpRounded from "@material-ui/icons/TrendingUpRounded";
import AccountBalanceRounded from "@material-ui/icons/AccountBalanceRounded";
import WarningRounded from "@material-ui/icons/WarningRounded";
import SecurityRounded from "@material-ui/icons/SecurityRounded";
import BugReportRounded from "@material-ui/icons/BugReportRounded";
import CodeRounded from "@material-ui/icons/CodeRounded";
import Community from "../icons/Community";
import Avatar from "@material-ui/core/Avatar";
import List from "@material-ui/core/List";
import ListSubheader from "@material-ui/core/ListSubheader";
import ListItem from "@material-ui/core/ListItem";
import ListItemAvatar from "@material-ui/core/ListItemAvatar";
import ListItemText from "@material-ui/core/ListItemText";
import { useTheme } from "@material-ui/core/styles";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import HomeRounded from "@material-ui/icons/HomeRounded";
import AppsRounded from "@material-ui/icons/AppsRounded";
import FavoriteRounded from "@material-ui/icons/FavoriteRounded";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import { cssBackgroundImage } from "../utils/safeUrl";
import { readFeedSeen, isFeedPostSeen, subscribeFeedSeen, toMs } from "../utils/feedSeen";

import { t, useLanguage } from "../utils/text";

const { useMemo, useCallback, memo, useState, useEffect, useRef } = React;

// Safe Banner Load
let linkedinBanner = "";
try { linkedinBanner = getIt(); } catch (e) { }

// ============================================================================
// Styles
// ============================================================================
const styles = theme => ({
    menuUserProfile: { display: "flex", position: "relative" },
    menuProfileImage: {
        position: "relative", borderRadius: "32px", margin: "16px 16px 0px 24px", width: 160, height: 160, cursor: "pointer",
        "& > div": { borderRadius: "32px", width: "100%", height: "100%", backgroundPosition: "50% 50%", backgroundSize: "cover" }
    },
    menuButtons: { margin: "0px 0px 0px 8px", alignContent: "space-around" },
    menuButton: { color: theme.palette.primary.contrastText, display: "block" },
    badge: { "& .MuiBadge-colorPrimary": { color: "#ffffff75", backgroundColor: "#ffffff21" } },
    menuProfileTextContainer: { position: "relative", display: "flex", lineHeight: "48px" },
    menuProfileText: {
        fontWeight: "400 !important", marginLeft: 24, verticalAlign: "middle", fontSize: "24px !important", cursor: "pointer",
        width: "192px", height: 56, lineHeight: "56px", wordWrap: "break-word", whiteSpace: "nowrap", textOverflow: "ellipsis",
        "&::after": { content: "''", position: "absolute", width: 96, height: 56, top: 0, right: 0, background: "linear-gradient(to right, transparent 0%, #151515 50%)" }
    },
    exitButton: { marginRight: 24, verticalAlign: "middle", float: "right", margin: "0px 24px 0px 8px", color: "#7f7f7f90", width: "56px", height: "56px", "& svg": { width: "1.125em", height: "1.125em" } },
    chips: {
        padding: "8px 16px 16px 16px", display: "flex", columnGap: "8px", rowGap: "8px", flexFlow: "wrap",
        // contain isolates paint/layout for the chip wrap, so toggling chips
        // doesn't dirty the rest of the panel.
        contain: "layout style paint",
        "& .MuiChip-root": { transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms", backgroundColor: "#000 !important", color: "#ccc", flex: "auto", paddingBottom: 4 },
        "& .MuiChip-root:hover": { transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms", backgroundColor: "#000 !important", color: "#fff" },
        "& .MuiChip-root > .MuiChip-label": { padding: "4px 6px 4px 6px", fontSize: "12px" },
        // The home chip's icon (TagChipIcon). MUI gives .MuiChip-icon its own
        // colour — grey 700 on a light-type theme, near-invisible on the
        // black chip — and the icon used to carry an inline "… !important"
        // colour, which React drops as an invalid value. Styled here instead,
        // where it outranks MUI's rule: #ccc like the label chips, #fff on
        // hover like them.
        "& .MuiChip-root .MuiChip-icon": { transition: "color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms", color: "#ccc", fill: "#ccc" },
        "& .MuiChip-root:hover .MuiChip-icon": { color: "#fff", fill: "#fff" }
    },
    CTAinfo: { position: "relative", backgroundColor: "#212121", borderRadius: "21px", overflow: "hidden", margin: "16px 16px 0px 16px", height: "144px" },
    loginButton: {
        transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,border 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,filter 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
        backgroundColor: "#222",
        color: "#ffffffab",
        boxShadow: "none",
        fontWeight: 600,
        padding: "12px 16px",
        fontSize: "14px",
        borderRadius: "21px !important",
        textTransform: "none",
        "&:hover": { transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,border 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,filter 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms", backgroundColor: "#2d2d2d", color: "#ffffffba" },
        '& .MuiTouchRipple-child': {
            backgroundImage: `
            radial-gradient(
              circle at 50% 50% in hsl shorter hue,
              #f000ff6b, #0095ffdb, #0cffe9ba, #d8ff00b5, #f59300c2, #6f0000c7, transparent, transparent
            )`,
        }
    },
    signupButton: {
        fontWeight: 600,
        fontSize: "14px",
        padding: "12px 16px",
        borderRadius: "21px !important",
        textTransform: "none",
        '& .MuiTouchRipple-child': {
            backgroundImage: `
            radial-gradient(
              circle at 50% 50% in hsl shorter hue,
              #f000ff6b, #0095ffdb, #0cffe9ba, #d8ff00b5, #f59300c2, #6f0000c7, transparent, transparent
            )`,
        }
    },
    loginContainer: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", padding: "12px 24px 12px 24px", flexFlow: "row", gap: "16px" },
    loadingContainer: { display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 24px", width: "100%", height: "200px" },
    loaderColor: { color: "#e0e0e0" },
    mainScroll: {
        // The single scrolling view: flex-fills the column under the header
        // and scrolls internally. Paint/layout is isolated so section updates
        // (chip toggles, list enrichment) never dirty the header above.
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        contain: "layout style"
    },
    communitiesList: { padding: "0px", contain: "layout style" },
    communityListItem: {
        padding: "4px 16px",
        "& .MuiAvatar-root": { width: 48, height: 48, borderRadius: "14px" },
        "& .MuiListItemAvatar-root": { minWidth: 64 }
    },
    communityBadge: { "& .MuiBadge-badge": { display: "none" } },
    communityAvatar: {
        width: 40, height: 40, borderRadius: "12px", backgroundColor: "#101010", marginRight: "12px", backgroundSize: "cover", backgroundPosition: "center"
    },
    communityInfo: { flex: 1, overflow: "hidden" },
    communityName: { fontWeight: 600, fontSize: "14px", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    communityMembers: { fontSize: "12px", color: "#888" },
    metaListHeader: { fontSize: "14px", fontWeight: 600, color: "#ccc", lineHeight: "36px", backgroundColor: "transparent" },
    // ── Main view (discover sections) ──────────────────────────────────────────────────────
    discoverGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "12px",
        padding: "4px 16px 12px 16px",
        justifyItems: "center",
        contain: "layout style"
    },
    discoverTile: { borderRadius: "16px" },
    discoverTileAvatar: {
        width: 56, height: 56, borderRadius: "16px", backgroundColor: "#101010",
        fontSize: "20px", color: "#888"
    },
    // The proposals row leading the Governance grid: spans all four columns
    // (the grid centres its items, so it must also stretch itself), keeps the
    // tiles' 56px height and radius, and carries a label + one-line hint
    // beside the avatar square instead of hiding the name in a tooltip.
    discoverWideTile: {
        gridColumn: "1 / -1", justifySelf: "stretch", width: "100%", height: 56,
        display: "flex", alignItems: "center", justifyContent: "flex-start", textAlign: "left",
        gap: "12px", paddingRight: "16px", backgroundColor: "#101010",
        transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
        "&:hover": {
            transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
            backgroundColor: "#171717"
        }
    },
    discoverWideText: { display: "flex", flexDirection: "column", flex: 1, minWidth: 0 },
    discoverWideTitle: { fontWeight: 600, fontSize: "14px", lineHeight: "18px", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    discoverWideSub: { fontSize: "12px", lineHeight: "16px", color: "#888", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    // The feed button leading the "Friends" row: a 56px rounded square like
    // the friend tiles (carrying the old header-highlight treatment) when the
    // row is full, stretched across the columns the friend tiles leave free
    // otherwise — see FeedTile / FEED_TILE_SPAN_STYLES.
    feedTile: {
        width: 56, height: 56, color: "#fff", backgroundColor: "#dddddd1a",
        transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
        "&:hover": {
            transition: "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
            backgroundColor: "#dddddd19",
        }
    },
    // The stretched form: same height and background, the icon kept in a
    // 56px square at the left so it sits exactly where the square form's
    // icon sits, the label beside it (discoverWideTitle) in the gained room.
    feedWideTile: {
        justifySelf: "stretch", width: "100%",
        display: "flex", alignItems: "center", justifyContent: "flex-start", textAlign: "left",
        gap: "12px", paddingRight: "16px"
    },
    feedTileIcon: { width: 56, height: 56, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" },
    friendBadge: {
        "& .MuiBadge-badge": {
            backgroundColor: "#c7c7c7", color: "#101010", fontWeight: 600,
            fontSize: "10px", height: "18px", minWidth: "18px", borderRadius: "9px",
            padding: "0 5px", transform: "scale(1) translate(35%, -35%)"
        }
    },
    // ── Apps menu (popover behind the grid button in the header) ───────────
    appsMenuPaper: {
        backgroundColor: "#212121",
        color: "#fff",
        borderRadius: "16px",
        minWidth: 232,
        boxShadow: "0 12px 32px #000000b0",
        "& .MuiList-padding": { padding: "8px 0px" }
    },
    appsMenuItem: {
        padding: "10px 20px 10px 16px",
        "&:hover": { backgroundColor: "#ffffff0d" },
        "&.Mui-focusVisible": { backgroundColor: "#ffffff14" },
        "& .MuiListItemIcon-root": { minWidth: 44, color: "#bbb" }
    },
    appsMenuTitle: { display: "block", fontSize: "14px", fontWeight: 600, color: "#fff", lineHeight: "20px" },
    appsMenuSub: { display: "block", fontSize: "12px", color: "#888", lineHeight: "16px" }
});

// ============================================================================
// Module-level constants (stable identity across renders)
// ============================================================================
const TAGS = ["selfies", "gaming", "fantasy", "landscape", "retro", "couples", "technology", "animals", "family", "sport", "holidays", "work", "pets", "abstract", "nude", "friends", "drawing", "vehicules", "events", "hobbies", "art", "myself", "fun", "intro", "travel", "fashion", "nature", "space", "comics"];

// ── Discover sections configuration ──────────────────────────────────────────
// The official governance portals: the proposals row (full width) followed
// by the eight topical portals as an icon-only grid (2 rows × 4). Ids and
// order are owned by utils/constants (PROPOSALS_PORTAL, COMMUNITY_PORTALS) —
// this map only attaches, per portal `name`, what the drawer adds on top of
// `{ name, id }`: the themed icon and the label (plus the one-line hint of
// the proposals row). Labels are thunks over t(), resolved by the tiles at
// render time — NOT inside the `governance` memo, which doesn't re-run on a
// language switch; portal names live in `words` because the Disruptions
// grid prints the same ones. The section is ALWAYS displayed while logged
// in, even before the portals exist on-chain. A preset portal ALWAYS shows
// its themed icon — never the community's avatar image — so the grid reads
// the same before and after enrichment; the on-chain community, once it
// shows up in the listCommunities result under the portal id, contributes
// its title only. Enriched or not, every tile links to its portal.
const PORTAL_PRESENTATION = {
    proposals:   { label: () => t("words.proposals"),   sublabel: () => t("components.menu_content.create_discuss_and_vote"), icon: BallotRounded },
    discussions: { label: () => t("words.discussion"),  icon: ForumRounded },
    governance:  { label: () => t("words.governance"),  icon: HowToVoteRounded },
    marketing:   { label: () => t("words.marketing"),   icon: TrendingUpRounded },
    legal:       { label: () => t("words.legal"),       icon: AccountBalanceRounded },
    risks:       { label: () => t("words.risks"),       icon: WarningRounded },
    security:    { label: () => t("words.security"),    icon: SecurityRounded },
    bugs:        { label: () => t("words.bug_reports"), icon: BugReportRounded },
    development: { label: () => t("words.development"), icon: CodeRounded },
};

// A tile's display name: the on-chain community title once enriched, else
// the drawer's own translated label, else the bare id. Called at render /
// click time so it always reflects the current language.
const portalTitle = (portal) => portal.title || (portal.label ? portal.label() : portal.id);

// ── Apps menu configuration ──────────────────────────────────────────────────
// Entries behind the grid ("Apps") button in the logged-in header — the old
// standalone create-account button now lives here as the first row. Adding a
// tool = adding a row: it renders automatically, in this order. Entries
// flagged `comingSoon` stay visible (secondary text words.coming_soon) but
// answer clicks with the same "opens soon" snackbar the unlinked governance
// tiles use; when a tool goes live, drop the flag and give it a real case in
// handleAppSelect. Title and description are thunks over t(), like
// PORTAL_PRESENTATION, resolved by AppsMenuEntry at render time so a language
// switch re-labels the rows.
const MENU_APPS = [
    {
        id: "create-account",
        title:       () => t("components.menu_content.create_account"),
        description: () => t("components.menu_content.use_your_credits"),
        icon: AccountPlus,
    },
    {
        id: "bookmarks",
        title:       () => t("components.menu_content.favorites"),
        description: () => t("components.menu_content.your_saved_posts"),
        icon: FavoriteRounded,
    },
];
// Popover geometry hoisted so the <Menu> props keep a stable identity.
const APPS_MENU_ANCHOR_ORIGIN = { vertical: "bottom", horizontal: "right" };
const APPS_MENU_TRANSFORM_ORIGIN = { vertical: "top", horizontal: "right" };

const FRIENDS_ROW_COLUMNS = 4;  // the Friends grid (discoverGrid): the feed
                                // tile plus up to FRIENDS_MAX author tiles;
                                // the feed tile spans whatever the authors
                                // leave free (see FeedTile)
const FRIENDS_MAX = 3;          // recent-author tiles after the leading feed
                                // tile — 1 + 3 fills one row
const FEED_PAGE_SIZE = 20;      // posts per feed page
const FEED_MAX_PAGES = 3;       // hard cap: 3 × 20 = 60 posts scanned
const DISCOVER_TAGS_MAX = 24;   // random trending tags shown in "Trending"
const DISCOVER_PORTALS_MAX = 6; // random trending portals (must stay < 8)
const COMMUNITIES_FETCH_LIMIT = 100; // listCommunities page size

// Which feed posts count as seen — the floor and the scrolled-through ranges
// FeedPersonal records as the reader rests on cards — is read through
// utils/feedSeen (readFeedSeen / isFeedPostSeen); `toMs` comes from there
// too, so both files read a post's `created` the same way.

// gridColumn spans of the feed tile, one frozen style per column count so
// the prop identity is stable per span (index 0 is unused: a span is ≥ 1).
const FEED_TILE_SPAN_STYLES = Array.from({ length: FRIENDS_ROW_COLUMNS + 1 }, (_, n) =>
    Object.freeze({ gridColumn: `span ${Math.max(1, n)}` })
);

// Fisher–Yates over indices. Sampling INDICES keyed on source LENGTH keeps
// the random pick stable across the async image-enrichment pass (which swaps
// array identity but not length), so tiles don't reshuffle mid-glance.
const sampleIndices = (length, count) => {
    const idx = Array.from({ length }, (_, i) => i);
    for (let i = length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        const tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp;
    }
    return idx.slice(0, Math.min(count, length));
};

// ── Section fade-in ──────────────────────────────────────────────────────────
// Main-view sections fade in TOP → BOTTOM: every section shares one duration
// and gets an index-based transitionDelay (the documented MUI v4 stagger
// pattern — getTransitionProps reads the delay from `style`, on the appear
// transition too, so the cascade plays once at startup).
const SECTION_FADE_MS = 350;
const SECTION_STAGGER_MS = 100;
const SECTION_FADE_STYLES = Array.from({ length: 4 }, (_, i) =>
    Object.freeze({ transitionDelay: (i * SECTION_STAGGER_MS) + "ms" })
);

// The home chip's icon, hoisted so the `icon` prop TagChipIcon's comparator
// checks keeps one identity across MainView renders (an inline element was
// a fresh one every time — a memo miss on each render). Its colour comes
// from styles.chips (.MuiChip-icon), not from the element.
const HOME_CHIP_ICON = <HomeRounded />;

const CONTAINER_STYLE_BASE = { width: "100%", display: "flex", position: "relative", flexDirection: "column" };
const TOP_CONTAINER_STYLE = { position: "relative", width: "100%" };
const CLOSE_BUTTON_STYLE = { position: "absolute", top: 8, right: 8 };
const PROFILE_TEXT_STYLE = { display: "block" };
const ICON_MR_STYLE = { marginRight: 8 };
const BANNER_IMG_STYLE = { cursor: "pointer", width: "100%", filter: "invert(1)" };
const BADGE_ANCHOR = { vertical: "bottom", horizontal: "right" };
const COMMUNITY_AVATAR_STYLE = { backgroundColor: "#333" };
const COMMUNITY_AVATAR_LINK_STYLE = { cursor: "pointer" };
const COMMUNITY_TITLE_STYLE = { cursor: "pointer", lineHeight: "1.618rem", display: "block", fontWeight: "bold", fontSize: "14px", color: "#fff" };
const COMMUNITY_LABEL_STYLE = { color: "#717171" };
const COMMUNITY_NAME_STYLE = { marginRight: "8px" };
const COMMUNITY_ABOUT_STYLE = { fontSize: "12px", color: "#ccc", lineHeight: "1rem" };
const PROFILE_LOADER_BOX = { display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" };

// ============================================================================
// Comparators - shallow-equal on a hand-picked subset of props.
// Skipping `classes` and stable callbacks avoids unnecessary re-renders, since
// withStyles emits a stable `classes` ref and useCallback handlers are stable.
// ============================================================================
const cmpKeys = (keys) => (prev, next) => {
    for (let i = 0; i < keys.length; i++) {
        if (prev[keys[i]] !== next[keys[i]]) return false;
    }
    return true;
};

// Shallow array equality (reference check on elements). Adequate because tag
// lists and community lists are produced atomically by setState.
const shallowArrayEqual = (a, b) => {
    if (a === b) return true;
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
};

// The Friends row is re-derived on every seen-mark while the feed is read
// (applyFriends). Reusing the previous element objects wherever a tile's
// data didn't move keeps MainView's shallowArrayEqual bailing and the
// untouched FriendTiles on their memo hit; the list identity only changes
// when a tile actually changes.
const sameFriend = (a, b) =>
    !!a && !!b && a.name === b.name && a.unseen === b.unseen && a.permlink === b.permlink && a.image === b.image;
const mergeFriends = (prev, next) => {
    if (prev.length === next.length && next.every((f, i) => sameFriend(prev[i], f))) return prev;
    return next.map((f, i) => (sameFriend(prev[i], f) ? prev[i] : f));
};

// ============================================================================
// Sub-components
// ============================================================================

const LoadingView = React.memo(({ classes }) => (
    <div className={classes.loadingContainer}>
        <CircularProgress className={classes.loaderColor} />
    </div>
));
LoadingView.displayName = "LoadingView";

const ProfileImage = React.memo(({ classes, onClick, imageUrl, loading }) => {
    useLanguage();
    // Stable style object per imageUrl change only.
    const bgStyle = useMemo(
        () => {
            // Chain-controlled profile_image: must not reach a CSS url() raw.
            const bg = cssBackgroundImage(imageUrl);
            return { backgroundImage: bg, backgroundColor: bg === "none" ? "#333" : "#000" };
        },
        [imageUrl]
    );
    return (
        <ButtonBase className={classes.menuProfileImage}>
            {loading
                ? <div style={PROFILE_LOADER_BOX}><Skeleton variant="rect" width="100%" height="100%" style={{ borderRadius: 32 }} /></div>
                : <div style={bgStyle} onClick={onClick} className={"pixelated"} />}
        </ButtonBase>
    );
}, cmpKeys(["imageUrl", "loading", "onClick"]));
ProfileImage.displayName = "ProfileImage";

const NotificationBadge = React.memo(React.forwardRef(({ classes, onClick, count }, ref) => {
    useLanguage();
    return (
        <Badge badgeContent={count > 0 ? count : null} color="primary" className={classes.badge}>
            <Tooltip title={t("components.menu_content.notifications")}>
                <IconButton ref={ref} className={classes.menuButton} onClick={onClick}><Notifications /></IconButton>
            </Tooltip>
        </Badge>
    );
}), (prev, next) => prev.count === next.count && prev.onClick === next.onClick);
NotificationBadge.displayName = "NotificationBadge";

const ActionButtons = React.memo(React.forwardRef(({ classes, onWalletClick, onNotificationClick, onAppsClick, appsButtonRef, notificationCount }, notifRef) => {
    useLanguage();
    return (
        (<div className={classes.menuButtons}>
            <NotificationBadge ref={notifRef} classes={classes} onClick={onNotificationClick} count={notificationCount} />
            <Tooltip title={t("components.menu_content.apps")}>
                <IconButton ref={appsButtonRef} className={classes.menuButton} onClick={onAppsClick}><AppsRounded /></IconButton>
            </Tooltip>
        </div>)
        // appsButtonRef / notifRef are stable ref objects — skipped by the
        // comparator on purpose, same as `classes`.
        // The feed button moved out of the header: it now leads the "Friends"
        // row in MainView (see FeedTile).
    );
}), cmpKeys(["notificationCount", "onWalletClick", "onNotificationClick", "onAppsClick"]));
ActionButtons.displayName = "ActionButtons";

const ProfileHeader = React.memo(({ classes, onProfileClick, onLogoutClick, username }) => {
    useLanguage();
    return (
        <div className={classes.menuProfileTextContainer}>
            <Typography style={PROFILE_TEXT_STYLE} component="h2" variant="h6" onClick={onProfileClick} className={classes.menuProfileText}>@{username}</Typography>
            <Tooltip title={t("components.menu_content.logging_out")}><IconButton className={classes.exitButton} onClick={onLogoutClick}><ExitToApp /></IconButton></Tooltip>
        </div>
    );
}, cmpKeys(["username", "onProfileClick", "onLogoutClick"]));
ProfileHeader.displayName = "ProfileHeader";

const CTASection = React.memo(({ classes, closed, onLinkedInClick, onClose, bannerUrl }) => {
    useLanguage();
    return (
        <Collapse in={!closed}>
            <div className={classes.CTAinfo}>
                {bannerUrl && <img onClick={onLinkedInClick} style={BANNER_IMG_STYLE} src={bannerUrl} alt={t("components.menu_content.banner")} />}
                <Tooltip title={t("components.menu_content.close_and_hide_this_banner_forever")}><IconButton onClick={onClose} style={CLOSE_BUTTON_STYLE}><CloseIcon /></IconButton></Tooltip>
            </div>
        </Collapse>
    );
}, cmpKeys(["closed", "bannerUrl", "onLinkedInClick", "onClose"]));
CTASection.displayName = "CTASection";

// ----- Individual chip - memoized so the .map() in MainView returns stable
// children. We bind the tag via a data prop instead of an inline arrow.
const TagChip = React.memo(({ tag, onClick }) => {
    useLanguage();
    const handle = useCallback(() => onClick(tag), [tag, onClick]);
    return <Chip label={"#" + tag} onClick={handle} />;
}, cmpKeys(["tag", "onClick"]));
TagChip.displayName = "TagChip";

const TagChipIcon = React.memo(({ icon, tag, onClick }) => {
    useLanguage();
    const handle = useCallback(() => onClick(tag), [tag, onClick]);
    return <Chip icon={icon} onClick={handle} />;
}, cmpKeys(["icon", "tag", "onClick"]));
TagChipIcon.displayName = "TagChipIcon";


// ----- Individual community row - memoized so reordering / appending the list
// doesn't re-render rows whose data didn't change.
const CommunityItem = React.memo(({ classes, community, onGoToCommunity }) => {
        useLanguage();
        const image = community.image || community.avatar_url || community.avatar || "";
        if (!image || !community.title) return null;
        const handleClick = useCallback(() => onGoToCommunity(community.name), [community.name, onGoToCommunity]);
        return (
            <ListItem className={classes.communityListItem}>
                <ListItemAvatar style={COMMUNITY_AVATAR_LINK_STYLE}>
                    <Badge className={classes.communityBadge} anchorOrigin={BADGE_ANCHOR} overlap="rectangular" color="primary">
                        <Avatar
                            src={image || undefined}
                            className={"pixelated"}
                            style={image ? COMMUNITY_AVATAR_STYLE : undefined}
                        >
                            {!image && <Community />}
                        </Avatar>
                    </Badge>
                </ListItemAvatar>
                <ListItemText
                    primary={
                        <Typography onClick={handleClick} style={COMMUNITY_TITLE_STYLE} component="span" variant="body2">
                            <span style={COMMUNITY_LABEL_STYLE}>{t("words.portal")} </span>
                            <span style={COMMUNITY_NAME_STYLE}>{community.title || community.name}</span>
                        </Typography>
                    }
                    secondary={community.about ? (
                        <Typography style={COMMUNITY_ABOUT_STYLE} component="span" variant="body1">
                            {community.about}
                        </Typography>
                    ) : null}
                />
            </ListItem>
        );
    }, (prev, next) =>
        prev.onGoToCommunity === next.onGoToCommunity &&
        prev.community === next.community
);
CommunityItem.displayName = "CommunityItem";


// ============================================================================
// Main view
// ============================================================================

// ----- Shared click handler of the governance tiles: every tile links to
// its canonical portal id, enriched or not — the ids are reserved at
// genesis, so there is no "opens soon" state to fall back to. Keyed on the
// id rather than the tile object so enrichment re-renders keep the handler.
const usePortalClick = (portal, onGoToCommunity) =>
    useCallback(() => onGoToCommunity(portal.id), [portal.id, onGoToCommunity]);

// ----- Governance portal tile: icon-only rounded square, no title or
// description — the portal name lives in the tooltip. A preset portal
// always shows its themed icon, never the community's avatar image, so
// the tile looks the same whether or not the portal exists on-chain yet;
// either way it links to the portal's canonical id.
const PortalIconTile = React.memo(({ classes, portal, onGoToCommunity }) => {
    useLanguage();
    const handleClick = usePortalClick(portal, onGoToCommunity);
    const Icon = portal.icon || Community;
    return (
        <Tooltip title={portalTitle(portal)}>
            <ButtonBase className={classes.discoverTile} onClick={handleClick}>
                <Avatar className={classes.discoverTileAvatar}>
                    <Icon />
                </Avatar>
            </ButtonBase>
        </Tooltip>
    );
}, (prev, next) => prev.portal === next.portal && prev.onGoToCommunity === next.onGoToCommunity);
PortalIconTile.displayName = "PortalIconTile";

// ----- Proposals tile: the full-width row that leads the Governance grid,
// above the eight portal tiles. Same anatomy as a portal tile (icon
// square — themed icon always, never the avatar image — same click gate)
// stretched into a labelled row, because proposals are the one governance
// portal that asks for an action rather than a topic — so the label and
// its hint are printed instead of tucked into a tooltip.
const ProposalsTile = React.memo(({ classes, portal, onGoToCommunity }) => {
    useLanguage();
    const handleClick = usePortalClick(portal, onGoToCommunity);
    const Icon = portal.icon || BallotRounded;
    return (
        <ButtonBase className={classes.discoverTile + " " + classes.discoverWideTile} onClick={handleClick}>
            <Avatar className={classes.discoverTileAvatar}>
                <Icon />
            </Avatar>
            <span className={classes.discoverWideText}>
                <span className={classes.discoverWideTitle}>{portalTitle(portal)}</span>
                {portal.sublabel && <span className={classes.discoverWideSub}>{portal.sublabel()}</span>}
            </span>
        </ButtonBase>
    );
}, (prev, next) => prev.portal === next.portal && prev.onGoToCommunity === next.onGoToCommunity);
ProposalsTile.displayName = "ProposalsTile";

// ----- Friend tile: a recent feed author as a rounded square with an
// unseen-posts badge ("4+"). Clicking it opens the personal feed — the same
// page as the feed tile leading the row, NOT the author's profile — scrolled
// to this friend's NEWEST unseen post (`friend.permlink`, kept by
// applyFriends): the badge counts posts sitting unseen in /feed, so that is
// where the click lands, with the older unseen ones reading on below it.
// Both move as the reader reads: a viewed post leaves the count, the
// permlink steps to the next unseen one, and a fully-read author's tile
// leaves the row (the feed tile grows into its column).
// The author name only survives in the tooltip. Bound with a stable data
// prop, like TagChip, so the .map() in MainView returns stable children.
const FriendTile = React.memo(({ classes, friend, onGoToFeedPost }) => {
    useLanguage();
    const handleClick = useCallback(
        () => onGoToFeedPost(friend.name, friend.permlink),
        [friend.name, friend.permlink, onGoToFeedPost]
    );
    return (
        <Tooltip title={"@" + friend.name}>
            <Badge
                className={classes.friendBadge}
                overlap="rectangular"
                badgeContent={friend.unseen > 0 ? `${friend.unseen}+` : null}
            >
                <ButtonBase className={classes.discoverTile} onClick={handleClick}>
                    <Avatar src={friend.image || undefined} className={"pixelated " + classes.discoverTileAvatar}>
                        {!friend.image && "@"}
                    </Avatar>
                </ButtonBase>
            </Badge>
        </Tooltip>
    );
}, (prev, next) => prev.friend === next.friend && prev.onGoToFeedPost === next.onGoToFeedPost);
FriendTile.displayName = "FriendTile";

// ----- Feed tile: the relocated feed button. Always the FIRST element of the
// "Friends" row, followed by up to FRIENDS_MAX recent-author tiles. Clicking
// it opens /feed — the personal feed, i.e. the `feedpersonal` page of
// PAGE_ROUTES — at the top. Every button of the Friends row is an entry to
// that one page; the friend tiles just add where in it to land.
// `span` is the number of grid columns the tile takes: the row's
// FRIENDS_ROW_COLUMNS minus the friend tiles beside it, so the feed button
// always fills the remaining space of the row — a single 56px square (the
// icon in a tooltip) when three friends sit next to it, a stretched row
// carrying the icon square plus its label when fewer or none do. The row
// re-lays out as friends are read (their tiles leave) and the tile grows
// into the freed columns.
const FeedTile = React.memo(({ classes, onGoToFeed, span }) => {
    useLanguage();
    if (!(span > 1)) {
        return (
            <Tooltip title={t("components.menu_content.feed")}>
                <ButtonBase className={classes.discoverTile + " " + classes.feedTile} onClick={onGoToFeed}>
                    <NewspaperVariant />
                </ButtonBase>
            </Tooltip>
        );
    }
    return (
        <ButtonBase
            className={classes.discoverTile + " " + classes.feedTile + " " + classes.feedWideTile}
            style={FEED_TILE_SPAN_STYLES[Math.min(span, FRIENDS_ROW_COLUMNS)]}
            onClick={onGoToFeed}
        >
            <span className={classes.feedTileIcon}><NewspaperVariant /></span>
            <span className={classes.discoverWideText}>
                <span className={classes.discoverWideTitle}>{t("components.menu_content.feed")}</span>
            </span>
        </ButtonBase>
    );
}, cmpKeys(["onGoToFeed", "span"]));
FeedTile.displayName = "FeedTile";

// ----- The main view: Friends row (led by the feed tile), random trending
// tags (led by the home chip), random trending portals, then the Governance
// grid (full-width proposals row, then the 2 × 4 portal icons). Every
// section carries its own <Fade> — one shared duration, index-staggered
// transitionDelay — so they appear TOP → BOTTOM once at startup. Sections
// with no data (e.g. Governance while logged out) simply never render. The
// Friends section is the exception: it hosts the relocated feed button, so
// it is gated on `feedEnabled` (logged in), NOT on the friend count — the
// feed must stay reachable even when no recent friend activity exists
// (friends is always empty while logged out). Every button of that row
// leads to the personal feed (/feed): the feed tile to its top
// (`onGoToFeed`), each badged friend tile to that friend's newest unseen
// post in it (`onGoToFeedPost`). The feed tile spans the columns the friend
// tiles leave free, so the row is always full.
const MainView = React.memo(({
                                 classes, proposalsPortal, governancePortals, friends, feedEnabled,
                                 trendingTags, trendingPortals,
                                 onGoToCommunity, onGoToFeed, onGoToFeedPost, onTagClick
                             }) => {
        useLanguage();
        const feedSpan = Math.max(1, FRIENDS_ROW_COLUMNS - friends.length);
        return (
            <React.Fragment>
                {feedEnabled && (
                    <Fade in timeout={SECTION_FADE_MS} style={SECTION_FADE_STYLES[0]}>
                        <div>
                            <ListSubheader disableSticky className={classes.metaListHeader}>{t("components.menu_content.friends")}</ListSubheader>
                            <div className={classes.discoverGrid}>
                                <FeedTile classes={classes} onGoToFeed={onGoToFeed} span={feedSpan} />
                                {friends.map(f => (
                                    <FriendTile key={"friend-" + f.name} classes={classes} friend={f} onGoToFeedPost={onGoToFeedPost} />
                                ))}
                            </div>
                        </div>
                    </Fade>
                )}
                {trendingTags.length > 0 && (
                    <Fade in timeout={SECTION_FADE_MS} style={SECTION_FADE_STYLES[1]}>
                        <div data-tour="menu-categories">
                            <ListSubheader disableSticky className={classes.metaListHeader}>{t("components.menu_content.trending_categories")}</ListSubheader>
                            <div className={classes.chips} style={{ paddingBottom: 8 }}>
                                {/* The icon's colour is styles.chips' .MuiChip-icon rule. */}
                                <TagChipIcon key={"disc-chiphome"} icon={HOME_CHIP_ICON} tag={""} onClick={onTagClick} />
                                {trendingTags.map(t => <TagChip key={"disc-chip-" + t} tag={t} onClick={onTagClick} />)}
                            </div>
                        </div>
                    </Fade>
                )}
                {trendingPortals.length > 0 && (
                    <Fade in timeout={SECTION_FADE_MS} style={SECTION_FADE_STYLES[2]}>
                        <List dense className={classes.communitiesList} data-tour="menu-communities">
                            <ListSubheader disableSticky className={classes.metaListHeader}>{t("components.menu_content.trending_portals")}</ListSubheader>
                            {trendingPortals.map((c, i) => (
                                <CommunityItem key={"disc-" + (c.name || i)} classes={classes} community={c} onGoToCommunity={onGoToCommunity} />
                            ))}
                        </List>
                    </Fade>
                )}
                {governancePortals.length > 0 && (
                    <Fade in timeout={SECTION_FADE_MS} style={SECTION_FADE_STYLES[3]}>
                        <div>
                            <ListSubheader disableSticky className={classes.metaListHeader}>{t("components.menu_content.governance_portals")}</ListSubheader>
                            <div className={classes.discoverGrid}>
                                {proposalsPortal && (
                                    <ProposalsTile classes={classes} portal={proposalsPortal} onGoToCommunity={onGoToCommunity} />
                                )}
                                {governancePortals.map(p => (
                                    <PortalIconTile key={"gov-" + p.key} classes={classes} portal={p} onGoToCommunity={onGoToCommunity} />
                                ))}
                            </div>
                        </div>
                    </Fade>
                )}
            </React.Fragment>
        );
    }, (prev, next) =>
        prev.onGoToCommunity === next.onGoToCommunity &&
        prev.onGoToFeed === next.onGoToFeed &&
        prev.onGoToFeedPost === next.onGoToFeedPost &&
        prev.onTagClick === next.onTagClick &&
        prev.feedEnabled === next.feedEnabled &&
        prev.proposalsPortal === next.proposalsPortal &&
        shallowArrayEqual(prev.governancePortals, next.governancePortals) &&
        shallowArrayEqual(prev.friends, next.friends) &&
        shallowArrayEqual(prev.trendingTags, next.trendingTags) &&
        shallowArrayEqual(prev.trendingPortals, next.trendingPortals)
);
MainView.displayName = "MainView";

const LoginView = React.memo(({ classes, onLogin, onSignup }) => {
    useLanguage();
    return (
        <Fade in timeout={300}>
            <div className={classes.loginContainer} data-tour="menu-login">
                <Button variant="contained" className={classes.loginButton} onClick={onLogin}><AccountLockOpen style={ICON_MR_STYLE} /> {t("components.menu_content.login")}</Button>
                <Button variant="text" className={classes.signupButton} onClick={onSignup}><AccountPlus style={ICON_MR_STYLE} /> {t("components.menu_content.signup")}</Button>
            </div>
        </Fade>
    );
}, cmpKeys(["onLogin", "onSignup"]));
LoginView.displayName = "LoginView";


// ----- One row of the Apps menu. forwardRef + prop spread keep MUI's
// MenuList focus management intact (it clones the active item to inject
// autoFocus/tabIndex, which must reach the underlying MenuItem); the click
// handler is bound with a stable `app` data prop so the .map() in AppsMenu
// returns stable children. Default shallow memo compare — every prop is
// stable module data or a stable callback.
const AppsMenuEntry = React.memo(React.forwardRef(({ classes, app, onSelect, ...other }, ref) => {
    useLanguage();
    const handleClick = useCallback(() => onSelect(app), [app, onSelect]);
    const Icon = app.icon;
    return (
        <MenuItem ref={ref} className={classes.appsMenuItem} onClick={handleClick} {...other}>
            <ListItemIcon><Icon /></ListItemIcon>
            <ListItemText
                disableTypography
                primary={<span className={classes.appsMenuTitle}>{app.title()}</span>}
                secondary={<span className={classes.appsMenuSub}>{app.comingSoon ? t("words.coming_soon") : app.description()}</span>}
            />
        </MenuItem>
    );
}));
AppsMenuEntry.displayName = "AppsMenuEntry";

// ----- The Apps popover: isolated like NotificationsLayer so opening /
// closing it never repaints the main tree. Anchored to the grid button in
// ActionButtons through the same ref-at-render-time mechanism as the
// notifications dialog. Rows come straight from MENU_APPS.
const AppsMenu = React.memo(({ classes, open, anchorEl, onClose, onSelect }) => (
    <Menu
        open={open}
        anchorEl={anchorEl}
        onClose={onClose}
        getContentAnchorEl={null}
        anchorOrigin={APPS_MENU_ANCHOR_ORIGIN}
        transformOrigin={APPS_MENU_TRANSFORM_ORIGIN}
        classes={{ paper: classes.appsMenuPaper }}
    >
        {MENU_APPS.map(app => (
            <AppsMenuEntry key={"app-" + app.id} classes={classes} app={app} onSelect={onSelect} />
        ))}
    </Menu>
), cmpKeys(["open", "anchorEl", "onClose", "onSelect"]));
AppsMenu.displayName = "AppsMenu";

// ----- Notifications + logout modal isolated so opening/closing them doesn't
// repaint the main tree.
const NotificationsLayer = React.memo(({
                                           logoutModalOpen, pixaAPI, onLogoutModalClose, onLogoutConfirm,
                                           notifOpen, notifAnchor, onNotificationClose, accountName, onUnreadCountChange
                                       }) => (
    <React.Fragment>
        <LogoutModal open={logoutModalOpen} api={pixaAPI} onClose={onLogoutModalClose} onConfirm={onLogoutConfirm} />
        <NotificationsDialog
            open={notifOpen}
            anchorEl={notifAnchor}
            onClose={onNotificationClose}
            pixaAPI={pixaAPI}
            account={accountName}
            onUnreadCountChange={onUnreadCountChange}
        />
    </React.Fragment>
), cmpKeys([
    "logoutModalOpen", "pixaAPI", "onLogoutModalClose", "onLogoutConfirm",
    "notifOpen", "notifAnchor", "onNotificationClose", "accountName", "onUnreadCountChange"
]));
NotificationsLayer.displayName = "NotificationsLayer";

// ----- The logged-in header block. Isolated so swipe/tab updates skip it.
const LoggedInHeader = React.memo(({
                                       classes, profileImage, onProfileClick, notifAnchorRef, appsButtonRef,
                                       onWalletOpen, onNotificationOpen, onAppsOpen, notifCount,
                                       username, onLogoutClick, closedMenuAds, onLinkedInClick, onCloseMenuAds, bannerUrl
                                   }) => (
    <div style={TOP_CONTAINER_STYLE}>
        <div className={classes.menuUserProfile}>
            <Fade in timeout={200}><ProfileImage classes={classes} onClick={onProfileClick} imageUrl={profileImage} loading={false} /></Fade>
            <Fade in timeout={400}><ActionButtons
                ref={notifAnchorRef}
                classes={classes}
                onWalletClick={onWalletOpen}
                onNotificationClick={onNotificationOpen}
                onAppsClick={onAppsOpen}
                appsButtonRef={appsButtonRef}
                notificationCount={notifCount}
            /></Fade>
        </div>
        <Fade in timeout={500}><ProfileHeader classes={classes} onProfileClick={onProfileClick} onLogoutClick={onLogoutClick} username={username} /></Fade>
        <Fade in timeout={600}><CTASection classes={classes} closed={closedMenuAds} onLinkedInClick={onLinkedInClick} onClose={onCloseMenuAds} bannerUrl={bannerUrl} /></Fade>
    </div>
), cmpKeys([
    "profileImage", "onProfileClick",
    "onWalletOpen", "onNotificationOpen", "onAppsOpen", "notifCount",
    "username", "onLogoutClick", "closedMenuAds", "onLinkedInClick", "onCloseMenuAds", "bannerUrl"
]));
LoggedInHeader.displayName = "LoggedInHeader";

// ----- The logged-out header block: login/signup CTAs plus the LinkedIn
// banner. The banner is intentionally NOT gated behind a session — visitors
// see it too. It honors the exact same "close forever" flag
// (closed_menu_ads) and close handler as the logged-in variant, so
// dismissing it in either state hides it everywhere, permanently.
const LoggedOutHeader = React.memo(({
                                        classes, onLogin, onSignup,
                                        closedMenuAds, onLinkedInClick, onCloseMenuAds, bannerUrl
                                    }) => (
    <div style={TOP_CONTAINER_STYLE}>
        <LoginView classes={classes} onLogin={onLogin} onSignup={onSignup} />
        <Fade in timeout={600}><CTASection classes={classes} closed={closedMenuAds} onLinkedInClick={onLinkedInClick} onClose={onCloseMenuAds} bannerUrl={bannerUrl} /></Fade>
    </div>
), cmpKeys([
    "onLogin", "onSignup",
    "closedMenuAds", "onLinkedInClick", "onCloseMenuAds", "bannerUrl"
]));
LoggedOutHeader.displayName = "LoggedOutHeader";

// ============================================================================
// Main Component
// ============================================================================

const MenuContent = ({ classes, closed_menu_ads, pixaAPI }) => {
    useLanguage();
    // ---- UI State (only state that actually drives visible UI lives here) ----
    const [loading, setLoading] = useState(true);
    const [accountData, setAccountData] = useState(null);
    const [profileImage, setProfileImage] = useState(null);
    const [logoutModalOpen, setLogoutModalOpen] = useState(false);
    const [communities, setCommunities] = useState([]);
    const [tags, setTags] = useState([]);
    const [friends, setFriends] = useState([]);
    const [notifOpen, setNotifOpen] = useState(false);
    const [notifCount, setNotifCount] = useState(0);
    const [appsOpen, setAppsOpen] = useState(false);

    // ---- Refs (no re-renders) ----
    // debugMsg was state - now a ref. It never rendered, so it was causing
    // pure-overhead re-renders on every fetch step.
    const debugMsgRef = useRef("Initializing...");
    const setDebugMsg = useCallback((m) => { debugMsgRef.current = m; }, []);

    const isMounted = useRef(true);
    const fetchInProgress = useRef(false);
    const fetchedUsername = useRef(null);
    const loggedOutRef = useRef(false);
    const accountDataRef = useRef(null);
    const notifAnchorRef = useRef(null);
    const appsButtonRef = useRef(null);
    // Friends row (see fetchFriends / applyFriends below):
    const feedScanRef = useRef(null);          // { account, head, posts: [{ author, permlink, created }] }
    const friendsScanToken = useRef(0);        // retires a superseded scan
    const rescanHeadRef = useRef(0);           // newest feed head a seen-mark already triggered a rescan for
    const avatarCacheRef = useRef(new Map());  // author → profile image ("" when none), across scans

    useEffect(() => { accountDataRef.current = accountData; }, [accountData]);

    // ---- Fetch: account ----
    const fetchAccountDetails = useCallback(async (username, forceRefresh = false) => {
        if (!pixaAPI || !username) {
            setDebugMsg(`Skip fetch: ${!pixaAPI ? "no API" : "no user"}`);
            return;
        }
        if (fetchInProgress.current && !forceRefresh) {
            setDebugMsg(`Fetch in progress, skipping: ${username}`);
            return;
        }
        if (!forceRefresh && fetchedUsername.current === username) {
            setDebugMsg(`Already loaded: ${username}`);
            setLoading(false);
            return;
        }

        fetchInProgress.current = true;
        setDebugMsg(`Fetching: ${username}`);

        try {
            const accounts = await pixaAPI.accounts.getAccounts([username], true);
            if (!isMounted.current) return;

            if (accounts && accounts.length > 0 && accounts[0]) {
                const account = accounts[0];
                setAccountData(account);
                fetchedUsername.current = username;
                setDebugMsg(`Loaded: ${username}`);
                setProfileImage((account._profile && account._profile.profile_image) || null);
            } else {
                setDebugMsg(`User ${username} not found`);
                setAccountData({ name: username });
                fetchedUsername.current = username;
                setProfileImage(null);
            }
        } catch (error) {
            setDebugMsg(`Fetch Error: ${error.message}`);
            if (isMounted.current) {
                setAccountData({ name: username });
                fetchedUsername.current = username;
                setProfileImage(null);
            }
        } finally {
            if (isMounted.current) {
                setLoading(false);
                fetchInProgress.current = false;
            }
        }
    }, [pixaAPI, setDebugMsg]);

    // ---- Fetch: communities ----
    const fetchCommunities = useCallback(async (username) => {
        if (!pixaAPI) return;
        try {
            if (pixaAPI.communities && pixaAPI.communities.listCommunities) {
                const result = await pixaAPI.communities.listCommunities({ sort: "rank", limit: COMMUNITIES_FETCH_LIMIT });
                const list = Array.isArray(result) ? result : [];
                if (isMounted.current) setCommunities(list);

                if (list.length > 0 && pixaAPI.accounts) {
                    const names = list.map(c => c.name).filter(Boolean);
                    if (names.length > 0) {
                        try {
                            const portalAccounts = await pixaAPI.accounts.getAccounts(names, true);
                            if (portalAccounts && portalAccounts.length > 0 && isMounted.current) {
                                const imageMap = {};
                                portalAccounts.forEach(pa => {
                                    if (pa && pa.name) {
                                        imageMap[pa.name] = (pa._profile && pa._profile.profile_image) || "";
                                    }
                                });
                                setCommunities(prev => prev.map(c => {
                                    const img = imageMap[c.name];
                                    return img ? { ...c, image: img } : c;
                                }));
                            }
                        } catch (e) {
                            console.log("[MenuContent] Portal account enrichment failed:", e.message);
                        }
                    }
                }
            }
        } catch (e) {
            console.log("[MenuContent] Failed to fetch communities:", e.message);
            setCommunities([]);
        }
    }, [pixaAPI]);

    // ---- Fetch: trending tags ----
    const fetchTags = useCallback(async () => {
        if (!pixaAPI || !pixaAPI.tags || !pixaAPI.tags.getTrendingTags) return;
        try {
            const result = await pixaAPI.tags.getTrendingTags(null, 100);
            if (Array.isArray(result) && result.length > 0 && isMounted.current) {
                const names = result
                    .map(t => (typeof t === "string" ? t : t.name))
                    .filter(n => n && n.length > 0)
                    .filter(n => !n.startsWith("portal-"));
                if (names.length > 0) setTags(names);
            }
        } catch (e) {
            console.log("[MenuContent] Failed to fetch trending tags:", e.message);
        }
    }, [pixaAPI]);

    // ---- Friends: recent feed authors + unseen counts ----
    // Two halves. fetchFriends (the scan) walks the personal feed newest →
    // oldest in pages of FEED_PAGE_SIZE, down to the seen floor of
    // utils/feedSeen or the FEED_MAX_PAGES cap (3 × 20 = 60 posts), whichever
    // comes first, and keeps every post above the floor in feedScanRef:
    // author, permlink, created. applyFriends then folds the CURRENT seen
    // state over that scan — a post is unseen while it is above the floor and
    // inside no range the reader scrolled through (isFeedPostSeen) — and keeps
    // the FRIENDS_MAX most recently active authors with their unseen counts
    // and the permlink of their newest unseen post: the card a tile scrolls
    // the feed to (see handleFeedFocus). Splitting the two is what makes the
    // row live: FeedPersonal marks posts seen as the reader rests on them,
    // feedSeen notifies (the subscription below), and the row re-derives from
    // the cached scan without another fetch. The scan itself is redone on
    // session events, and when a mark reports a feed head newer than the one
    // scanned — posts published since the scan ran.
    const applyFriends = useCallback(async (username) => {
        const scan = feedScanRef.current;
        if (!scan || scan.account !== username) return;
        const seen = readFeedSeen(username);

        // Aggregate per author: unseen count + most recent activity, and
        // which post that activity is.
        const byAuthor = new Map();
        for (const p of scan.posts) {
            if (isFeedPostSeen(seen, p.created)) continue;
            const entry = byAuthor.get(p.author);
            if (entry) {
                entry.unseen += 1;
                if (p.created > entry.latest) { entry.latest = p.created; entry.permlink = p.permlink; }
            } else {
                byAuthor.set(p.author, { name: p.author, unseen: 1, latest: p.created, permlink: p.permlink });
            }
        }
        const top = Array.from(byAuthor.values())
            .sort((a, b) => b.latest - a.latest)
            .slice(0, FRIENDS_MAX);

        // Profile images (same path as portals/profile), cached per author so
        // a re-derivation on a seen-mark never fetches; only a scan that
        // surfaces a new author pays the round-trip — before its single
        // paint, as before, so a tile never flashes its "@" placeholder.
        const avatars = avatarCacheRef.current;
        const commit = () => {
            if (!isMounted.current || feedScanRef.current !== scan) return;
            const next = top.map(f => ({ name: f.name, unseen: f.unseen, permlink: f.permlink, image: avatars.get(f.name) || "" }));
            setFriends(prev => mergeFriends(prev, next));
        };
        const missing = top.map(f => f.name).filter(n => !avatars.has(n));
        if (missing.length > 0 && pixaAPI && pixaAPI.accounts) {
            try {
                const accounts = await pixaAPI.accounts.getAccounts(missing, true);
                (accounts || []).forEach(a => {
                    if (a && a.name) avatars.set(a.name, (a._profile && a._profile.profile_image) || "");
                });
            } catch (e) {
                console.log("[MenuContent] Friend avatar enrichment failed:", e.message);
            }
            // Not resolved (lookup failed, or the account came back empty):
            // remembered as image-less, as a scan used to leave it, so a
            // failing node isn't asked again on every seen-mark while the
            // reader scrolls. The cache is dropped with the session.
            missing.forEach(n => { if (!avatars.has(n)) avatars.set(n, ""); });
        }
        commit();
    }, [pixaAPI]);

    const fetchFriends = useCallback(async (username) => {
        if (!pixaAPI || !username || !pixaAPI.content || !pixaAPI.content.getDiscussionsByFeed) return;
        const token = ++friendsScanToken.current;
        try {
            const floor = readFeedSeen(username).floor;
            const scanned = [];
            let head = 0;   // `created` of the newest post scanned
            let cursor = null;

            for (let pageNum = 0; pageNum < FEED_MAX_PAGES; pageNum++) {
                // The pagination cursor is inclusive, so paginated pages ask
                // for one extra row and drop the repeated head below.
                const query = { tag: username, limit: cursor ? FEED_PAGE_SIZE + 1 : FEED_PAGE_SIZE };
                if (cursor) {
                    query.start_author = cursor.author;
                    query.start_permlink = cursor.permlink;
                }
                const page = await pixaAPI.content.getDiscussionsByFeed(query);
                if (!Array.isArray(page) || page.length === 0) break;

                const fresh = cursor ? page.slice(1) : page;
                let reachedFloor = false;
                for (const post of fresh) {
                    if (!post || !post.author) continue;
                    const createdMs = toMs(post.created);
                    if (!head && createdMs) head = createdMs;
                    // At or below the floor: seen for good, and so is
                    // everything older — the scan can stop here.
                    if (floor && createdMs && createdMs <= floor) { reachedFloor = true; break; }
                    scanned.push({ author: post.author, permlink: post.permlink || "", created: createdMs });
                }
                if (reachedFloor || fresh.length < FEED_PAGE_SIZE) break; // floor or feed exhausted
                cursor = page[page.length - 1];
                if (!cursor || !cursor.author || !cursor.permlink) break;
            }

            if (!isMounted.current || token !== friendsScanToken.current) return;
            feedScanRef.current = { account: username, head, posts: scanned };
            await applyFriends(username);
        } catch (e) {
            console.log("[MenuContent] Failed to fetch friends:", e.message);
            if (isMounted.current && token === friendsScanToken.current) {
                feedScanRef.current = null;
                setFriends([]);
            }
        }
    }, [pixaAPI, applyFriends]);

    // Live updates. A mark from FeedPersonal (the reader rested on some
    // cards) re-derives the row from the cached scan — no fetch. A mark whose
    // feed head is newer than the scanned one means posts were published
    // since the scan: rescan, once per new head, so a scan that cannot see
    // that head yet (a cached page) doesn't loop on every further mark.
    useEffect(() => subscribeFeedSeen((account, state, meta) => {
        const scan = feedScanRef.current;
        if (!isMounted.current || !scan || scan.account !== account) return;
        const head = (meta && meta.head) || 0;
        if (head > scan.head && head > rescanHeadRef.current) {
            rescanHeadRef.current = head;
            fetchFriends(account);
            return;
        }
        if (!meta || meta.changed) applyFriends(account);
    }), [fetchFriends, applyFriends]);

    // ---- Session check ----
    const checkForActiveSession = useCallback(async () => {
        if (!pixaAPI || !pixaAPI.sessionManager) return null;
        try {
            return await pixaAPI.sessionManager.getActiveAccount();
        } catch (e) {
            return null;
        }
    }, [pixaAPI]);

    // ---- Initial load ----
    useEffect(() => {
        isMounted.current = true;

        const initializeSession = async () => {
            setDebugMsg("Checking for existing session...");
            const activeUser = await checkForActiveSession();

            if (activeUser && isMounted.current) {
                await Promise.all([
                    fetchAccountDetails(activeUser),
                    fetchCommunities(activeUser),
                    fetchTags(),
                    fetchFriends(activeUser)
                ]);
            } else if (isMounted.current) {
                setDebugMsg("No active session");
                setLoading(false);
                await Promise.all([
                    fetchCommunities(),
                    fetchTags()
                ]);
            }
        };

        const timeoutId = setTimeout(initializeSession, 0);

        return () => {
            isMounted.current = false;
            clearTimeout(timeoutId);
        };
    }, [pixaAPI, checkForActiveSession, fetchAccountDetails, fetchCommunities, fetchTags, fetchFriends, setDebugMsg]);

    // ---- Session events ----
    useEffect(() => {
        if (!pixaAPI || !pixaAPI.eventEmitter) return;

        let debounceTimeout = null;

        const handleSessionEvent = (eventType, account) => {
            if (debounceTimeout) clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(async () => {
                console.log(`[MenuContent] ${eventType}:`, account);
                setDebugMsg(`${eventType}: ${account}`);
                loggedOutRef.current = false;
                if (isMounted.current && account) {
                    fetchedUsername.current = null;
                    fetchInProgress.current = false;
                    setLoading(true);
                    setAccountData(null);
                    setProfileImage(null);
                    setCommunities([]);
                    setFriends([]);
                    feedScanRef.current = null;   // the scan belongs to the outgoing account
                    rescanHeadRef.current = 0;
                    avatarCacheRef.current = new Map();
                    setTimeout(async () => {
                        if (isMounted.current) {
                            await Promise.all([
                                fetchAccountDetails(account, true),
                                fetchCommunities(account),
                                fetchTags(),
                                fetchFriends(account)
                            ]);
                        }
                    }, 10);
                }
            }, 50);
        };

        const onSessionCreated = (data) => {
            const account = data?.account || data;
            console.log("[MenuContent] session_created event received:", account);
            handleSessionEvent("Session created", account);
        };
        const onSessionRestored = (data) => {
            const account = data?.account || data;
            console.log("[MenuContent] session_restored event received:", account);
            handleSessionEvent("Session restored", account);
        };
        const onSessionEnded = () => {
            if (debounceTimeout) clearTimeout(debounceTimeout);
            console.log("[MenuContent] Session ended");
            setDebugMsg("Session ended");
            loggedOutRef.current = true;
            if (isMounted.current) {
                setAccountData(null);
                setProfileImage(null);
                setLoading(false);
                setFriends([]);
                feedScanRef.current = null;
                rescanHeadRef.current = 0;
                fetchedUsername.current = null;
                fetchInProgress.current = false;
                fetchCommunities();
                fetchTags();
            }
        };

        pixaAPI.eventEmitter.on("session_created", onSessionCreated);
        pixaAPI.eventEmitter.on("session_restored", onSessionRestored);
        pixaAPI.eventEmitter.on("session_ended", onSessionEnded);

        const onProfileUpdated = async (data) => {
            if (data?.account && accountDataRef.current?.name === data.account) {
                await fetchAccountDetails(data.account, true);
            }
        };
        pixaAPI.eventEmitter.on("profile_updated", onProfileUpdated);

        return () => {
            if (debounceTimeout) clearTimeout(debounceTimeout);
            pixaAPI.eventEmitter.off("session_created", onSessionCreated);
            pixaAPI.eventEmitter.off("session_restored", onSessionRestored);
            pixaAPI.eventEmitter.off("session_ended", onSessionEnded);
            pixaAPI.eventEmitter.off("profile_updated", onProfileUpdated);
        };
    }, [pixaAPI, fetchAccountDetails, fetchCommunities, fetchTags, fetchFriends, setDebugMsg]);

    // ---- Deferred session retry ----
    useEffect(() => {
        if (!pixaAPI || !pixaAPI.sessionManager) return;
        if (accountData) return;

        const retryTimeout = setTimeout(async () => {
            if (accountData || loggedOutRef.current) return;
            try {
                const currentSession = await pixaAPI.sessionManager.getCurrentSession();
                if (currentSession && currentSession.expires_at && currentSession.expires_at > Date.now()) {
                    const activeUser = currentSession.account || (await pixaAPI.sessionManager.getActiveAccount());
                    if (activeUser && isMounted.current && !accountDataRef.current) {
                        setDebugMsg(`Deferred found: ${activeUser}`);
                        setLoading(true);
                        await Promise.all([
                            fetchAccountDetails(activeUser, true),
                            fetchCommunities(activeUser),
                            fetchTags(),
                            fetchFriends(activeUser)
                        ]);
                    }
                }
            } catch (e) {
                console.log("[MenuContent] Deferred check error (ignored):", e.message);
            }
        }, 1500);

        return () => clearTimeout(retryTimeout);
    }, [pixaAPI, accountData, fetchAccountDetails, fetchCommunities, fetchTags, fetchFriends, setDebugMsg]);

    // ---- Handlers (all stable) ----
    const handleTagNavigation = useCallback((tag) => HISTORY.push("/created/" + tag), []);
    const handleProfileClick = useCallback(() => {
        if (accountDataRef.current) HISTORY.push("/@" + accountDataRef.current.name);
    }, []);
    const handleLogin = useCallback(() => actions.trigger_login(), []);
    const handleSignup = useCallback(() => actions.trigger_account(), []);
    const handleLogoutClick = useCallback(() => setLogoutModalOpen(true), []);
    const handleLogoutModalClose = useCallback(() => setLogoutModalOpen(false), []);
    const handleLogoutConfirm = useCallback(async () => {
        setLogoutModalOpen(false);
        setLoading(true);
        if (pixaAPI) await pixaAPI.logout();
    }, [pixaAPI]);
    const handleWalletOpen = useCallback(() => actions.trigger_account(), []);
    const handleAppsOpen = useCallback(() => setAppsOpen(true), []);
    const handleAppsClose = useCallback(() => setAppsOpen(false), []);
    // One dispatcher for every Apps-menu row. New tools plug in as new cases;
    // rows flagged `comingSoon` short-circuit into the shared snackbar
    // (mirrors the unlinked governance tiles).
    const handleAppSelect = useCallback((app) => {
        setAppsOpen(false);
        if (app.comingSoon) {
            actions.trigger_snackbar(t("components.menu_content.opens_soon", {
                title: (app.title ? app.title() : t("components.menu_content.this_tool"))
            }));
            return;
        }
        switch (app.id) {
            case "create-account":
                if (!accountDataRef.current) { actions.trigger_login(); return; }
                actions.trigger_add_account();
                return;
            case "bookmarks":
                // FavoriteManagerDialog — favorites also work logged-out
                // (guest bucket in the store), so no login gate here.
                actions.trigger_favorites();
                return;
            default:
                return;
        }
    }, []);
    const handleNotificationOpen = useCallback(() => {
        if (!accountDataRef.current) { actions.trigger_login(); return; }
        setNotifOpen(true);
    }, []);
    const handleNotificationClose = useCallback(() => setNotifOpen(false), []);
    const handleUnreadCountChange = useCallback((count) => setNotifCount(count), []);
    // The Friends row's navigation. Both push /feed, which PAGE_ROUTES
    // resolves to the `feedpersonal` page (the personal feed, never the
    // public /created etc. feeds); that page marks the cards the reader
    // rests on as seen (utils/feedSeen), which is what clears the friend
    // badges — live, as the reader scrolls (see applyFriends).
    //   handleFeedOpen  — the feed tile: the top of the feed. Ignores its
    //                     arguments on purpose (handed straight to onClick).
    //   handleFeedFocus — a friend tile: "/feed#focus=<author/permlink>",
    //                     the friend's newest unseen post; FeedPersonal pages
    //                     until that post is loaded and scrolls its card into
    //                     view (buildFeedFocusHash documents why it is a hash
    //                     and how FeedPersonal picks it up whether or not it
    //                     is already the mounted page). A friend with no
    //                     permlink falls back to the plain feed.
    const handleFeedOpen = useCallback(() => HISTORY.push("/feed"), []);
    const handleFeedFocus = useCallback((author, permlink) => {
        HISTORY.push("/feed" + (permlink ? buildFeedFocusHash(author, permlink) : ""));
    }, []);
    const handleLinkedInClick = useCallback(() => window.open("https://www.linkedin.com/company/pixagram-blockchain/?viewAsMember=true", "_blank", "noopener,noreferrer"), []);
    const handleCloseMenuAds = useCallback(() => {
        legacyApi.set_settings({ closed_menu_ads: true }, () => {
            actions.trigger_settings_update();
            actions.trigger_snackbar(t("components.menu_content.banner_closed"));
        });
    }, []);
    const handleGoToCommunity = useCallback((communityName) => { HISTORY.push("/" + communityName); }, []);

    // ---- Derived ----
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    const isLoggedIn = !!accountData;
    const accountName = accountData?.name || null;
    const username = accountData?.name || "user";

    // Memoize the outer container style so its identity is stable across renders
    // when isMobile is unchanged.
    const containerStyle = useMemo(
        () => ({ ...CONTAINER_STYLE_BASE, height: `calc(100% - ${!isMobile ? 0 : 90}px)` }),
        [isMobile]
    );

    // ---- Discover data (derived) ----
    // Governance portals: logged-in users only — MainView drops the
    // section when the array is empty (same mechanism as Friends while
    // logged out). When logged in: ALWAYS the proposals row plus all eight
    // portals, in utils/constants order. A tile always shows its themed
    // icon and carries its translated label (a thunk — see portalTitle);
    // once a fetched community whose chain name equals the portal id
    // appears, only its title is taken over — a preset portal never shows
    // the community's avatar image — so the grid is visible and looks the
    // same from the very first paint. Enrichment only changes what a tile
    // is called, never where it links: every tile navigates to its
    // canonical id.
    const governance = useMemo(() => {
        if (!isLoggedIn) return { proposals: null, portals: [] };
        const byId = new Map();
        for (const c of communities) {
            if (c && c.name) byId.set(c.name, c);
        }
        const tile = (def) => {
            const match = byId.get(def.id);
            const look = PORTAL_PRESENTATION[def.name] || {};
            return {
                key: def.name,
                id: def.id,
                title: (match && match.title) || null,
                label: look.label || null,
                sublabel: look.sublabel || null,
                icon: look.icon || Community
            };
        };
        return { proposals: tile(PROPOSALS_PORTAL), portals: COMMUNITY_PORTALS.map(tile) };
    }, [isLoggedIn, communities]);
    const proposalsPortal = governance.proposals;
    const governancePortals = governance.portals;

    // Random samples for the two "Trending" sections. Indices are keyed on
    // LENGTH so the image-enrichment pass (new array identity, same length)
    // re-reads fresh objects without reshuffling the visible pick.
    // Tags fall back to the curated TAGS constant when the trending fetch
    // returned nothing, so tag navigation (and the home chip leading it)
    // never disappears — the fallback used to sit in the "Recommended tags"
    // closer, which is gone along with "Recommended portals": the view shows
    // the two random samples only, not the full fetched lists behind them.
    const tagSource = tags.length > 0 ? tags : TAGS;
    const trendingTagIdx = useMemo(() => sampleIndices(tagSource.length, DISCOVER_TAGS_MAX), [tagSource.length]);
    const discoverTags = useMemo(
        () => trendingTagIdx.map(i => tagSource[i]).filter(Boolean),
        [trendingTagIdx, tagSource]
    );
    const trendingPortalIdx = useMemo(() => sampleIndices(communities.length, DISCOVER_PORTALS_MAX), [communities.length]);
    const discoverPortals = useMemo(
        () => trendingPortalIdx.map(i => communities[i]).filter(Boolean),
        [trendingPortalIdx, communities]
    );

    return (
        <React.Fragment>
            <div style={containerStyle}>
                {loading ? (
                    <LoadingView classes={classes} />
                ) : !isLoggedIn ? (
                    <LoggedOutHeader
                        classes={classes}
                        onLogin={handleLogin}
                        onSignup={handleSignup}
                        closedMenuAds={closed_menu_ads}
                        onLinkedInClick={handleLinkedInClick}
                        onCloseMenuAds={handleCloseMenuAds}
                        bannerUrl={linkedinBanner}
                    />
                ) : (
                    <LoggedInHeader
                        classes={classes}
                        profileImage={profileImage}
                        onProfileClick={handleProfileClick}
                        notifAnchorRef={notifAnchorRef}
                        onWalletOpen={handleWalletOpen}
                        onNotificationOpen={handleNotificationOpen}
                        onAppsOpen={handleAppsOpen}
                        appsButtonRef={appsButtonRef}
                        notifCount={notifCount}
                        username={username}
                        onLogoutClick={handleLogoutClick}
                        closedMenuAds={closed_menu_ads}
                        onLinkedInClick={handleLinkedInClick}
                        onCloseMenuAds={handleCloseMenuAds}
                        bannerUrl={linkedinBanner}
                    />
                )}

                {/* The single scrolling view: flex-fills under the header. */}
                <div className={classes.mainScroll}>
                    <MainView
                        classes={classes}
                        proposalsPortal={proposalsPortal}
                        governancePortals={governancePortals}
                        friends={friends}
                        feedEnabled={isLoggedIn}
                        trendingTags={discoverTags}
                        trendingPortals={discoverPortals}
                        onGoToCommunity={handleGoToCommunity}
                        onGoToFeed={handleFeedOpen}
                        onGoToFeedPost={handleFeedFocus}
                        onTagClick={handleTagNavigation}
                    />
                </div>
            </div>

            <NotificationsLayer
                logoutModalOpen={logoutModalOpen}
                pixaAPI={pixaAPI}
                onLogoutModalClose={handleLogoutModalClose}
                onLogoutConfirm={handleLogoutConfirm}
                notifOpen={notifOpen}
                notifAnchor={notifAnchorRef.current}
                onNotificationClose={handleNotificationClose}
                accountName={accountName}
                onUnreadCountChange={handleUnreadCountChange}
            />

            <AppsMenu
                classes={classes}
                open={appsOpen}
                anchorEl={appsButtonRef.current}
                onClose={handleAppsClose}
                onSelect={handleAppSelect}
            />
        </React.Fragment>
    );
};

MenuContent.displayName = "MenuContent";

// ----------------------------------------------------------------------------
// Memoize the entire export.
//
// MenuContent is "always mounted" per the parent. The parent's frequent
// re-renders pass the same props identity (`classes` is stable from
// withStyles, `pixaAPI` is a long-lived singleton, `closed_menu_ads` is a
// small primitive flag), so a memo with a tight comparator gives us a free
// short-circuit at the boundary.
// ----------------------------------------------------------------------------
const MenuContentMemo = React.memo(MenuContent, (prev, next) =>
    prev.closed_menu_ads === next.closed_menu_ads &&
    prev.pixaAPI?.initialized === next.pixaAPI?.initialized &&
    prev.classes === next.classes
);
MenuContentMemo.displayName = "MenuContent(memo)";

export default withStyles(styles)(MenuContentMemo);