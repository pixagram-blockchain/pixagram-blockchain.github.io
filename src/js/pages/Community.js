import * as React from "preact/compat";
import { useState, useEffect, useCallback, useMemo, useReducer, useRef, memo } from "preact/compat";
// Coalesce co-arriving setState calls after an await into a single render
// (Preact doesn't auto-batch in promise continuations).
import { unstable_batchedUpdates as batch } from "preact/compat";
import { HISTORY, buildPostUrl, isPostUrl, parsePostUrl } from "../utils/constants";
import withStyles from "@material-ui/core/styles/withStyles";
import * as actions from "../actions/utils";

import { CellMeasurer } from "@pixagram/virtualized/dist/es/index";
import MasonryExtended from "../components/MasonryExtended";
import useWindowDimensions from "../hooks/useWindowDimensions";
import useMasonryGrid from "../hooks/useMasonryGrid";
import { idle, cancelIdle } from "../utils/idle";
import {
    EASE as EASE_STANDARD, TRANSITION_FAST, TRANSITION_MEDIUM, TRANSITION_ENTRY,
    RAINBOW_RIPPLE, RAINBOW_RIPPLE_SIMPLE,
} from "../theme/motion";
import PaperCardBlog from "../components/PaperCardBlog";
import PaperCardMenuOption from "../components/PaperCardMenuOption";
import timeAgo from "../utils/TimeAgo";

import SortingTabs from "../components/SortingTabs";
import CommunityHeader from "../components/CommunityHeader";
import CommunityInfo from "../components/CommunityInfo";
import EditCommunityDialog from "../components/EditCommunityDialog";
import AddSomeoneCommunityDialog from "../components/AddSomeoneCommunityDialog";
import MembersListDialog from "../components/MembersListDialog";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContentText from "@material-ui/core/DialogContentText";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";

import { t, useLanguage } from "../utils/text";

// ── Deferred text editor import ──────────────────────────────────────────
// Single loader shared by React.lazy and the idle prefetch below, so both
// resolve the SAME dynamic-import module-cache entry: warming the chunk on
// idle means the first real open hydrates instantly instead of suspending.
const loadTextEditorDialog = () => import("../components/editor/LexicalTextEditorDialog");
const LazyTextEditorDialog = React.lazy(loadTextEditorDialog);

// ── Deferred post viewer ─────────────────────────────────────────────────
// BlogPostDialog is the full community-post viewer (rich blog body, comment
// threads, vote lists) — the most common thing opened after the community
// feed, but not needed to PAINT it. Splitting it out shrinks Community's
// route chunk the same way Feed / FeedPersonal / Profile split PostDialog.
// Warmed on idle for everyone (see effect in the component) so the
// open-from-card transition isn't gated on a cold chunk fetch; a cold-entry
// community-post URL mounts it on the first commit while the orphan fetch
// runs in parallel.
const loadBlogPostDialog = () => import("../components/BlogPostDialog");
const LazyBlogPostDialog = React.lazy(loadBlogPostDialog);

// Edit / delete share one module and are reached only from the card menu on
// your own posts — warmed on idle for logged-in users only. Same split as
// Feed / FeedPersonal / Profile.
const loadOwnPostDialogs = () => import("../components/EditPostDialog");
const LazyEditPostDialog = React.lazy(loadOwnPostDialogs);
const LazyDeletePostDialog = React.lazy(() => loadOwnPostDialogs().then(m => ({ default: m.DeletePostDialog })));

// Suspense fallback for a lazily-loaded dialog — shown only on a cold open
// (chunk not yet cached, before idle-prefetch ran). A dim backdrop appears
// instantly so the action reads as "opening…" instead of a blank frame; the
// real dialog replaces it once its chunk resolves. Warm opens never hit this.
const DIALOG_FALLBACK = (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1300 }} />
);


// ╔══════════════════════════════════════════════════════════════════════╗
// ║  1. STYLES                                                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

const tabBaseStyles = (bg) => ({
    backgroundColor: bg,
    "& .MuiTab-root": { minWidth: "72px !important" },
    "& .MuiTab-textColorPrimary.Mui-selected": { backgroundColor: "transparent" },
    "& .MuiTab-fullWidth": {
        backgroundColor: "transparent", color: "#989898",
        transition: `all ${TRANSITION_MEDIUM}`, borderRadius: "21px",
    },
    "& .MuiTab-fullWidth:hover": { backgroundColor: "rgba(255,255,255,0.06)" },
    "& span.MuiTabs-indicator": {
        zIndex: "-1", height: "48px", backgroundColor: "#c7c7c7",
        borderRadius: "21px", transform: "scale3d(0.875, 0.75, 1)",
    },
});

const slideKeyframe = (axis, from) => ({
    "0%": { transform: `translate${axis}(${from}px)`, filter: "opacity(0)" },
    "100%": { transform: `translate${axis}(0px)`, filter: "opacity(1)" },
});

const styles = (theme) => ({
    root: {
        position: "absolute", width: "100%", height: "100%",
        display: "flex", overflow: "hidden",
    },
    viewRight: {
        width: "100%", marginLeft: "396px", position: "relative",
        [theme.breakpoints.down("sm")]: { marginLeft: "0px" },
    },
    viewMobile: {
        display: "none",
        [theme.breakpoints.down("sm")]: {
            "& div.MuiPaper-rounded": { borderRadius: "0px", backgroundColor: "#151515" },
            zIndex: 9, display: "inline-block", transition: `transform ${TRANSITION_MEDIUM}`,
            position: "fixed", width: "100%", minHeight: "72px", margin: "0px",
            animation: `$slideInFromTop ${TRANSITION_ENTRY}`,
            "@global": { "@keyframes slideInFromTop": slideKeyframe('Y', -160) },
        },
    },
    mobileBackdrop: {
        display: "none",
        [theme.breakpoints.down("sm")]: {
            display: "block", position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.55)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)",
            zIndex: 8, pointerEvents: "auto", transition: `opacity ${TRANSITION_ENTRY}, filter ${TRANSITION_ENTRY}`,
        },
    },
    mobileBackdropHidden: { filter: "opacity(0)", pointerEvents: "none" },
    mobileBackdropVisible: { filter: "opacity(1)" },
    viewMobileCard: {
        borderRadius: "0px", boxShadow: "none", transition: `all ${TRANSITION_FAST}`,
        "& .MuiCardHeader-avatar": { margin: "-16px 16px -16px -16px" },
        "& .MuiCardHeader-title": { transition: `all ${TRANSITION_FAST}` },
        "& .MuiCardHeader-content": { width: "calc(100% - 104px)", transition: `all ${TRANSITION_FAST}` },
        "& .MuiCardHeader-subheader": {
            filter: "opacity(1)", transition: `all ${TRANSITION_FAST}`,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        },
        "& svg": { transition: `transform ${TRANSITION_FAST}` },
    },
    viewMobileCardOpened: {
        borderRadius: "0px 0px 21px 21px", boxShadow: "0px 0px 16px 4px black",
        transition: `all ${TRANSITION_FAST}`, overflow: "visible",
        "& .MuiCardHeader-avatar": { margin: "-16px 16px -16px -16px" },
        "& .MuiCardHeader-title": { fontSize: "1.225rem", transition: `all ${TRANSITION_FAST}` },
        "& .MuiCardHeader-content": { width: "calc(100% - 40px)", transition: `all ${TRANSITION_FAST}` },
        "& .MuiCardHeader-subheader": {
            filter: "opacity(0)", height: 0, transition: `all ${TRANSITION_FAST}`,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        },
        "& svg": { transition: `transform ${TRANSITION_FAST}` },
    },
    mainFab: {
        animation: `$slideInFromBottom ${TRANSITION_ENTRY}`,
        "@global": { "@keyframes slideInFromBottom": slideKeyframe('Y', 160) },
        // Inset raises shown AND hidden states equally (0px off gesture-nav).
        position: "fixed", right: 380 + 32 + 8, bottom: "calc(env(safe-area-inset-bottom, 0px) - 64px)", zIndex: 1,
        transition: `transform ${TRANSITION_MEDIUM}`,
        "& .MuiButtonBase-root": {
            borderRadius: "32px", background: "#f6f6f6", transform: "scale(1)",
            animationName: "$bounce-feed", animationTimingFunction: EASE_STANDARD,
            animationDuration: "3.2s", animationFillMode: "both",
            animationDelay: "1s", animationIterationCount: "infinite",
            boxShadow: "0 0 8px #ffffff88, 0 0 16px #ffffffcc",
            "@global": {
                "@keyframes bounce-feed": {
                    "0%":  { boxShadow: "0 0 8px #ffffff88, 0 0 16px #ffffffcc", transform: "scale(1)" },
                    "3%":  { boxShadow: "0 0 12px #ffffff88, 0 0 24px #ffffffcc", transform: "scale(1.05)" },
                    "6%":  { boxShadow: "0 0 4px #ffffff88, 0 0 8px #ffffffcc", transform: "scale(0.975)" },
                    "9%":  { boxShadow: "0 0 8px #ffffff88, 0 0 16px #ffffffcc", transform: "scale(1)" },
                },
            },
            transition: `background ${TRANSITION_MEDIUM}`,
            "& .MuiTouchRipple-root": {
                filter: "opacity(1)",
                "& .MuiTouchRipple-child": { backgroundImage: RAINBOW_RIPPLE_SIMPLE },
            },
        },
        "& .MuiButtonBase-root:hover": {
            background: "#ffffff", boxShadow: "0 0 8px #ffffff88, 0 0 16px #ffffffcc",
        },
        "& .MuiTouchRipple-child": { backgroundImage: RAINBOW_RIPPLE },
        "& .MuiFab-extended": { padding: "0 24px", height: 64, fontSize: "1.125rem" },
        "& .MuiFab-extended .MuiSvgIcon-root": { fontSize: "1.75rem" },
        [theme.breakpoints.down("sm")]: {
            bottom: "calc(env(safe-area-inset-bottom, 0px) - 88px)", right: "50%", transform: "translateX(50%)",
            "& .MuiButtonBase-root": { width: 64, height: 64 },
            "@global": {
                "@keyframes slideInFromBottom": {
                    "0%": { transform: "translateX(50%) translateY(160px)", filter: "opacity(0)" },
                    "100%": { transform: "translateX(50%) translateY(0px)", filter: "opacity(1)" },
                },
            },
        },
    },
    viewLeft: {
        zIndex: 1, width: "374px", margin: "21px 16px", position: "absolute",
        left: 0, top: 0, height: "calc(100% - 42px)", boxSizing: "border-box",
        animation: `$slideInFromLeft ${TRANSITION_ENTRY}`,
        "@global": { "@keyframes slideInFromLeft": slideKeyframe('X', -384) },
        [theme.breakpoints.down("sm")]: { display: "none" },
        display: "flex", flexDirection: "column", gap: "21px",
    },
    viewLeftTopCard: { width: "100%", borderRadius: "32px", background: "#101010" },
    viewLeftBottomCard: {
        paddingTop: 8, position: "relative", width: "100%",
        borderRadius: "32px", background: "#101010",
        flex: "1", display: "flex", flexDirection: "column", minHeight: 64,
    },
    whiteDiscreteButton: {
        "&.MuiButton-contained": {
            backgroundColor: "#D0D0D010", color: "#999999",
            transition: `background-color 250ms ${EASE_STANDARD} 0ms, box-shadow 250ms ${EASE_STANDARD} 0ms, border 250ms ${EASE_STANDARD} 0ms, color 250ms ${EASE_STANDARD} 0ms`,
        },
        "&.MuiButton-contained:hover": { backgroundColor: "#D0D0D016", color: "#ffffff" },
    },
    communityImage: {
        borderRadius: "0px 56px 56px 0px", display: "block", width: "300px", height: "300px",
        backgroundPosition: "50% 50%", backgroundSize: "cover", transition: `height ${TRANSITION_FAST}`,
    },
    communityImageMobile: {
        borderRadius: "0px 12px 12px 0px", display: "block", width: "72px", height: "72px",
        backgroundPosition: "50% 50%", backgroundSize: "cover", transition: `all ${TRANSITION_FAST}`,
    },
    communityImageMobileOpened: {
        borderRadius: "8px", display: "block", width: "40px", height: "40px", margin: "-18px 16px -16px -72px",
        backgroundPosition: "50% 50%", backgroundSize: "cover", transition: `all ${TRANSITION_FAST}`,
    },
    communityImageMobileBig: {
        borderRadius: "24px", display: "block", width: "160px", height: "160px", margin: "0px",
        backgroundPosition: "50% 50%", backgroundSize: "cover", transition: `all ${TRANSITION_FAST}`,
    },
    mainTab: {
        ...tabBaseStyles("#101010"),
        "& .MuiTab-textColorPrimary.Mui-selected .MuiTab-wrapper": { color: "#101010 !important" },
        animation: `$slideInFromTop ${TRANSITION_ENTRY}`,
        "@global": { "@keyframes slideInFromTop": slideKeyframe('Y', -160) },
        [theme.breakpoints.down("sm")]: {
            animation: `$slideInFromBottom ${TRANSITION_ENTRY}`,
            "@global": { "@keyframes slideInFromBottom": slideKeyframe('Y', 160) },
        },
        margin: "21px 16px 16px 16px", width: "calc(100% - 32px)", borderRadius: "21px",
        position: "absolute", left: 0, zIndex: 1, transition: `transform ${TRANSITION_MEDIUM}`,
    },
    actionButtons: {
        display: "flex", gap: "16px", justifyContent: "center", padding: "16px 32px",
        "& .MuiButtonGroup-groupedContainedHorizontal:not(:last-child)": { borderRight: "1px solid #000" },
        "& .MuiButton-contained": {
            color: "rgb(183 183 183)", backgroundColor: "#1e1e1e",
            "&:hover": { color: "rgb(220 220 220)", backgroundColor: "#212121" },
        },
    },
    actionButtonsMobile: {
        width: "100%", display: "flex", flexFlow: "column",
        gap: "16px", justifyContent: "center", padding: "16px 16px",
        "& .MuiButtonGroup-groupedContainedHorizontal:not(:last-child)": { borderRight: "1px solid #000" },
        "& .MuiButton-contained": {
            color: "rgb(183 183 183)", backgroundColor: "#1e1e1e",
            "&:hover": { color: "rgb(220 220 220)", backgroundColor: "#212121" },
        },
    },
    memberListItem: {
        "& .MuiListItemAvatar-root": { minWidth: 64 },
        "& .MuiAvatar-root": { width: 48, height: 48, borderRadius: "14px" },
    },
    memberBadge: {
        "& .MuiBadge-badge": { right: "24px !important", backgroundColor: "#2b2b2b", color: "#aaa" },
    },
    roleChip: {
        opacity: "0.75", height: "21px", backgroundColor: "#2b2b2b", color: "#aaa",
        "& > svg.MuiChip-iconSmall": { color: "#777", width: "15px", height: "15px" },
        "& > span.MuiChip-labelSmall": { fontSize: "12px" },
    },
    masonry: {
        overflow: "hidden overlay !important", contain: "style layout",
        "& > .ReactVirtualized__Masonry": {
            zIndex: 0, position: "absolute", margin: 0, scrollBehavior: "smooth",
            overscrollBehavior: "none", boxSizing: "content-box !important", touchAction: "pan-y",
            willChange: "scroll-position !important", overflow: "hidden overlay !important",
            padding: "66px 16px 32px 412px", height: "100%",
            [theme.breakpoints.down("sm")]: { padding: "80px 16px 32px 16px", width: "calc(100% - 32px)" },
            "& > .ReactVirtualized__Masonry__innerScrollContainer": {
                top: "auto !important", left: "auto !important", overflow: "initial !important",
                marginBottom: "444px", boxSizing: "content-box",
                height: "100% !important", maxHeight: "100% !important",
            },
        },
    },
    // Anchor box for the write FAB: a stretched flex item whose box spans
    // exactly the portal image's height (the image wrapper has margin
    // 16px -75px 0 0, so no bottom margin here either). The FAB is positioned
    // against it — see menuButton.
    writeButtons: {
        position: "relative", flex: "0 0 42px",
        width: 42, margin: "16px 0px 0px 16px",
    },
    writeMobileButtons: {
        height: 0, padding: "0px 16px", backgroundColor: "transparent",
        borderRadius: "0px 0px 16px 16px", textAlign: "center",
    },
    writeMobileButton: {
        width: 72, height: 72, marginTop: -32,
        "& svg": { width: "1.125em", height: "1.125em" },
        transition: `color ${TRANSITION_FAST}, background-color ${TRANSITION_FAST}`,
        color: "#101010", backgroundColor: "#c7c7c7",
        "&:hover": {
            color: "#000", backgroundColor: "#fff",
            transition: `color 225ms ${EASE_STANDARD} 125ms, background-color 225ms ${EASE_STANDARD} 125ms`,
        },
        "& .MuiTouchRipple-child": { backgroundImage: RAINBOW_RIPPLE },
    },
    // Explicitly anchored: centred on the image's outer edge (17px past the
    // anchor's right edge) and half-way down the image. It used to be
    // position:fixed with no offsets, i.e. placed by its static position, which
    // Chrome centred (align-content on the anchor) and WebKit put at the top.
    menuButton: {
        display: "block", position: "absolute", top: "50%", left: "100%",
        zIndex: 1, width: 80, height: 80,
        transform: "translate(calc(-50% + 17px), -50%)",
        transition: `color ${TRANSITION_FAST}, background-color ${TRANSITION_FAST}`,
        color: "#101010", backgroundColor: "#c7c7c7",
        boxShadow: "0 0 8px #c7c7c788, 0 0 16px #c7c7c7cc",
        "&:hover": {
            color: "#101010", backgroundColor: "#fff",
            boxShadow: "0 0 8px #ffffff88, 0 0 16px #ffffffcc",
        },
        "& svg": { width: "1.375em", height: "1.375em" },
        "& .MuiTouchRipple-child": { backgroundImage: RAINBOW_RIPPLE },
    },
    menuButtonEdit: {
        position: "absolute", top: 16, left: 16, backgroundColor: "#000", color: "#fff",
        transition: `color 175ms ${EASE_STANDARD} 5ms, background-color 175ms ${EASE_STANDARD} 5ms`,
        "&:hover": { backgroundColor: "#171717", color: "#c7c7c7" },
    },
    cardTabs: {
        ...tabBaseStyles("#171717"),
        "& .MuiTab-textColorPrimary.Mui-selected .MuiTab-wrapper": { color: "#171717 !important" },
        margin: "16px 16px 0px 16px", width: "calc(100% - 32px)", borderRadius: "21px",
        position: "absolute", top: 0, left: 0, zIndex: 1,
        transition: `transform 300ms ${EASE_STANDARD} 0ms`,
    },
    metadataSwipeableViews: { padding: "0px 16px", overflow: "overlay", height: "100%" },
    metaListHeader: { color: "#ebebeb", backgroundColor: "#101010", borderRadius: "21px", marginTop: 8 },
    whiteDialog: {
        backgroundColor: "#fff !important", color: "#000 !important",
        boxShadow: "0px 11px 15px -7px rgb(255 255 255 / 20%), 0px 24px 38px 3px rgb(255 255 255 / 14%), 0px 9px 46px 8px rgb(255 255 255 / 12%) !important",
        "& .MuiTypography-colorTextSecondary": { color: "#000 !important" },
        "& .MuiButton-textPrimary": { color: "#222 !important", "&:hover": { color: "#000 !important" } },
        "& .MuiButton-containedPrimary": {
            color: "#fff !important", backgroundColor: "#000 !important",
            "&:hover": { color: "#ddd !important", backgroundColor: "#222 !important" },
        },
    },
    darkDialog: {
        backgroundColor: "#212121",
        color: "#fff",
        borderRadius: 16,
    },
    darkDialogContent: {
        padding: 24,
    },
    darkDialogActions: {
        padding: "8px 16px 16px",
        display: "flex",
        justifyContent: "flex-end",
    },
    darkInput: {
        "& .MuiInputLabel-root": {
            color: "rgba(255,255,255,0.8)",
        },
        "& .MuiOutlinedInput-root": {
            color: "#fff",
            "& fieldset": {
                borderColor: "rgba(255,255,255,0.24)",
            },
            "&:hover fieldset": {
                borderColor: "rgba(255,255,255,0.48)",
            },
            "&.Mui-focused fieldset": {
                borderColor: "#fff",
            },
        },
    },
});


// ╔══════════════════════════════════════════════════════════════════════╗
// ║  2. PURE HELPERS                                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

const SORT_METHODS = ['created', 'hot', 'trending', 'votes'];

const parseCommunityPathname = (pathname) => {
    // A community URL may end at the community itself (`/portal-1`,
    // `/portal-1/hot`, `/portal-1/editor`) OR may be a post URL inside the
    // community (`/portal-1/@author/permlink`). In the latter case the
    // community page still needs to know which community it's displaying so
    // it can load posts and have BlogPostDialog open on top — we strip the
    // `/@author/permlink` suffix before matching.
    const raw = pathname || '';
    const postMatch = raw.match(/^(\/portal-[0-9]+)\/@[a-z0-9\.\-]+\/[a-z0-9\.\-]+\/?$/);
    const effective = postMatch ? postMatch[1] : raw;
    const match = effective.match(/^\/(portal-[0-9]+)(\/(created|hot|trending|votes))?(\/editor)?\/?$/);
    if (!match) return { communityName: '', sort: 'created', sortIndex: 0, editor: false };
    const sort = match[3] || 'created';
    return { communityName: match[1], sort, sortIndex: Math.max(0, SORT_METHODS.indexOf(sort)), editor: !!match[4] };
};

const buildCommunityUrl = (communityName, sort, editor) => {
    // Guard the empty name. `'/' + ''` is '/', and appending a sort to that
    // gives '//votes' — which a browser reads as PROTOCOL-RELATIVE, resolving
    // against the scheme rather than the path. history.replaceState then threw
    //
    //   A history state object with URL 'http://votes/' cannot be created in a
    //   document with origin 'http://localhost:8080'
    //
    // A logic error (acting on a community page with no community) surfaced as
    // an unrelated-looking SecurityError. Callers below also refuse to navigate
    // without a name; this is the last line so no caller can produce '//'.
    if (!communityName) return '/';

    let url = '/' + communityName;
    // Only include a sort segment when it's not the default. This produces
    // clean URLs like `/portal-1/editor` and `/portal-1/hot` instead of
    // `/portal-1/created/editor` and `/portal-1/hot/`. Both forms parse
    // identically via parseCommunityPathname above.
    if (sort && sort !== 'created') url += '/' + sort;
    if (editor) url += '/editor';
    return url;
};

const resolveDisplayName = (account, fallback) => {
    const dn = account._profile && account._profile.display_name;
    return (typeof dn === 'string' && dn.trim()) || account.name || fallback || '';
};

const parsePayoutValue = (raw) => parseFloat((raw || '0').replace(/[^0-9.\-]/g, '')) || 0;

// WeakMap-cached: enrichPostForBlogCard reads the metadata twice
// (description, deleted flag) and resolveImageSrc a third time, and the
// two-phase enrichment re-maps the SAME raw post objects to patch avatars
// in — six JSON.parse calls per card, per load, of multi-KB strings. One
// parse per raw post object now; an edited post arrives as a NEW object
// from the node, so the cache can never serve stale metadata. Signature
// and null-on-miss/null-on-failure semantics are unchanged.
const JSON_META_CACHE = new WeakMap();
const extractJsonMeta = (post) => {
    if (!post || !post.json_metadata) return null;
    if (typeof post.json_metadata !== 'string') return post.json_metadata;
    if (JSON_META_CACHE.has(post)) return JSON_META_CACHE.get(post);
    let meta = null;
    try { meta = JSON.parse(post.json_metadata); } catch { meta = null; }
    JSON_META_CACHE.set(post, meta);
    return meta;
};

// Cover only: the card / dialog cover is the explicit cover declared in
// json_metadata.image — the one the editor publishes (the SVG gradient).
// Images found in the post BODY are content and are never promoted to
// cover; a post without a declared cover simply has none (PaperCardBlog
// renders imageless, BlogPostDialog falls back to its generated backdrop).
const resolveImageSrc = (post) => {
    const meta = extractJsonMeta(post);
    if (!meta) return null;
    if (typeof meta.image === 'string' && meta.image.length > 0) return meta.image;
    // Legacy posts from other frontends declare the cover as image[0]
    // (an array in metadata is still a declaration, not body scraping).
    if (Array.isArray(meta.image) && typeof meta.image[0] === 'string' && meta.image[0].length > 0) {
        return meta.image[0];
    }
    return null;
};

const enrichPostForBlogCard = (post, account, voterProfiles) => {
    const pendingPayout = parsePayoutValue(post.pending_payout_value);
    const totalPayout = parsePayoutValue(post.total_payout_value);
    const curatorPayout = parsePayoutValue(post.curator_payout_value);
    const payout = pendingPayout > 0 ? pendingPayout : totalPayout + curatorPayout;

    const tags = post._tags || [];
    const activeVotes = post.active_votes || [];
    const wordCount = post._word_count || 0;
    const meta = extractJsonMeta(post);
    const metaDescription = meta?.description?.trim() || '';
    const excerpt = metaDescription
        || post._summary
        || (post.body ? post.body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300) : '');

    return {
        id: post._entity_id || post.id || `${post.author}_${post.permlink}`,
        author: {
            username: account.name || '',
            name: resolveDisplayName(account),
            image: account.image || account._profile?.profile_image || '',
        },
        title: post.root_title || post.title || '',
        image: resolveImageSrc(post),
        date: post.created ? new Date(post.created).getTime() : Date.now(),
        payout: `$${payout.toFixed(2)}`,
        upVotesNumber: Math.max(0, post.net_votes || activeVotes.filter(v => v?.weight >= 0).length || 0),
        downVotesNumber: Math.max(0, activeVotes.filter(v => v?.weight < 0).length || 0),
        commentsNumber: post.children || 0,
        active_votes: activeVotes,
        _voter_profiles: voterProfiles || {},
        nsfw: tags.includes('nsfw'),
        // Soft-deleted content (`deleted` tag / meta.deleted from the edit
        // flow). Posts with votes can never be hard-deleted on chain, so
        // this flag carries the platform's delete semantics.
        deleted: tags.some(t => typeof t === 'string' && t.toLowerCase() === 'deleted')
            || meta?.deleted === true || meta?.deleted === 'true' || meta?.deleted === 1,
        tags,
        permlink: post.permlink || '',
        category: post.category || '',
        community: post.community || post.category || '',
        community_title: post.community_title || '',
        author_role: post.author_role || '',
        author_title: post.author_title || '',
        // Normalize stats to a well-shaped object even if the post came from
        // an older cached entity (pre-sanitizer-patch) where `stats` was
        // stripped. safe_stats-equivalent defaults so `.hide`, `.is_pinned`
        // etc. are always defined booleans downstream.
        stats: {
            gray:        Boolean(post.stats?.gray),
            hide:        Boolean(post.stats?.hide),
            is_pinned:   Boolean(post.stats?.is_pinned),
            flag_weight: Number(post.stats?.flag_weight) || 0,
            total_votes: Number(post.stats?.total_votes) || 0,
        },
        _content_type: post._content_type || 'blog',
        _description_html: post._description_html || '',
        _summary: post._summary || '',
        excerpt,
        readTime: Math.max(1, Math.round(wordCount / 200)),
        content: post.body || '',
        json_metadata: post.json_metadata || '',
    };
};

const enrichMemberAccounts = async (members, api, portalAccount) => {
    if (!members.length || !api?.accounts) return members;
    try {
        const memberNames = members.map(m => m.username).filter(u => !portalAccount || u !== portalAccount.name);
        const fetchedAccounts = memberNames.length > 0 ? await api.accounts.getAccounts(memberNames, true) : [];
        const accountMap = {};
        if (portalAccount) accountMap[portalAccount.name] = portalAccount;
        for (const acc of (fetchedAccounts || [])) { if (acc?.name) accountMap[acc.name] = acc; }
        return members.map(m => {
            const acc = accountMap[m.username];
            if (!acc) return m;
            const p = acc._profile || {};
            return {
                ...m, image: p.profile_image || '', display_name: p.display_name || '', about: p.about || '',
                joined: typeof acc.created === 'number' ? acc.created
                    : typeof acc.created === 'string'
                        ? new Date(acc.created + (acc.created.includes('Z') ? '' : 'Z')).getTime() : null,
            };
        });
    } catch (e) { console.warn('[Community] Could not fetch member accounts:', e); return members; }
};

// Hydrate a raw discussion object with the derived fields
// (_images, _tags, _summary, _content_type) that enrichPostForBlogCard
// expects. enrichPostsList normally gets these pre-populated from the
// bridge's get_ranked_posts response; a one-off getContent does not.
const hydrateContent = (content) => {
    if (content._images && content._tags) return content;
    // `|| {}` also absorbs a valid-JSON `null` payload, which the old inline
    // parse handed straight to the `.tags` read below.
    const meta = extractJsonMeta(content) || {};
    if (!content._images) {
        const body = content.body || '', imgs = [];
        let m; const re1 = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
        while ((m = re1.exec(body)) !== null) imgs.push({ src: m[1], alt: '', is_base64: m[1].startsWith('data:'), index: imgs.length });
        if (!imgs.length) { const re2 = /!\[([^\]]*)\]\(([^)]+)\)/g; while ((m = re2.exec(body)) !== null) imgs.push({ src: m[2], alt: m[1]||'', is_base64: m[2].startsWith('data:'), index: imgs.length }); }
        // _images = images IN the body, nothing else. The old meta.image
        // fallback both violated the cover-is-only-a-cover rule and threw on
        // new-editor posts, where meta.image is a string (no .forEach).
        content._images = imgs;
    }
    if (!content._tags) content._tags = meta.tags || [];
    if (!content._description_html && !content._summary) {
        const s = (content.body||'').replace(/<img[^>]*>/gi,'').replace(/!\[[^\]]*\]\([^)]+\)/g,'').replace(/<[^>]+>/g,'').trim();
        if (s.length) content._summary = s.length > 300 ? s.slice(0,300)+'…' : s;
    }
    if (!content._content_type) content._content_type = 'blog';
    return content;
};

// Sentinel telling a failed content read apart from an empty one. A rejected
// getContent is a transient condition (node down, timeout) and must NOT be
// reported to the user as a deletion.
const CONTENT_READ_FAILED = Symbol('content_read_failed');

// Fetch a single post by author/permlink for direct-URL (orphan) loads.
// Returns one of:
//   • an enriched blog-card object — hydrated post (soft-deleted ones carry
//     `deleted: true` straight out of enrichPostForBlogCard)
//   • a `_deleted` marker — the post is gone from the chain but its author
//     exists, so the link was plausibly valid and the post was deleted
//   • null — nothing we can resolve; the caller flips the stub to _notFound
const fetchOrphanPost = async (api, author, permlink) => {
    if (!api?.content?.getContent || !author || !permlink) return null;
    try {
        // Both inputs (author, permlink) are known up front, so the content
        // and the author-account reads are independent — run them in ONE
        // round-trip window instead of two. The account read carries its own
        // catch so a lookup failure still degrades to the stub account
        // (same fallback the serial version had) without failing the post.
        // The content read now carries its own catch too, so a node error
        // can't be mistaken for "this post no longer exists".
        const [content, accs] = await Promise.all([
            api.content.getContent(author, permlink).catch((e) => {
                console.warn('[Community] getContent failed:', e && e.message);
                return CONTENT_READ_FAILED;
            }),
            api.accounts?.getAccounts?.([author]).catch(() => null) ?? null,
        ]);
        if (content === CONTENT_READ_FAILED) return null;

        let authorAccount = { name: author, _profile: {}, image: '' };
        let authorExists = false;
        if (Array.isArray(accs) && accs[0]) {
            const a = accs[0];
            a.image = a.image || a._profile?.profile_image || '';
            authorAccount = a;
            authorExists = true;
        }

        if (!content?.permlink) {
            // The chain answered, but with nothing. get_content returns the
            // same empty shell for a hard-deleted post (delete_comment, only
            // possible while a post has no votes and no replies) as for one
            // that never existed, so the two are indistinguishable from the
            // content read alone. Discriminate on the AUTHOR instead: if the
            // account exists the link was plausibly valid once and the post
            // is gone — report a deletion. If it doesn't, the URL is simply
            // wrong and the caller falls through to _notFound.
            if (!authorExists) return null;
            return {
                _deleted: true,
                _hard_deleted: true,
                permlink,
                author: {
                    username: author,
                    name: resolveDisplayName(authorAccount, author),
                    image: authorAccount.image || '',
                },
                _content_type: 'blog',
            };
        }

        hydrateContent(content);
        return enrichPostForBlogCard(content, authorAccount, {});
    } catch (e) {
        console.warn('[Community] fetchOrphanPost failed:', e && e.message);
        return null;
    }
};

// onAvatars (optional): when provided, returns text-ready cards immediately
// (one round-trip sooner) and calls onAvatars(enrichedWithAvatars) once
// accounts resolve. Omit for the original single-phase (awaited) behavior.
const enrichPostsList = async (posts, api, onAvatars) => {
    const safePosts = Array.isArray(posts) ? posts : [];
    if (!safePosts.length || !api?.accounts) return safePosts;
    try {
        // Build + soft-delete filter from a (possibly empty) account map. The
        // `deleted` flag comes from post meta, not accounts, so phase 1 and
        // phase 2 filter to the same set — they differ only in avatars.
        const buildEnriched = (accountsMap, voterProfiles) =>
            safePosts.map(p => enrichPostForBlogCard(p, accountsMap[p.author] || { name: p.author || '', _profile: {} }, voterProfiles))
                .filter(p => !p.deleted);
        const collectNames = () => {
            const allVotes = safePosts.flatMap(p => p.active_votes || []);
            return [...new Set([
                ...allVotes.map(v => v?.voter).filter(Boolean),
                ...safePosts.map(p => p.author).filter(Boolean),
            ])];
        };
        const buildMaps = (accs) => {
            const voterProfiles = {}, accountsMap = {};
            if (Array.isArray(accs)) {
                for (const a of accs) {
                    if (!a) continue;
                    const n = a.name || a._entity_id;
                    if (n) { const img = a._profile?.profile_image || ''; voterProfiles[n] = img; a.image = img; accountsMap[n] = a; }
                }
            }
            return { accountsMap, voterProfiles };
        };
        const uniqueNames = collectNames();

        if (onAvatars) {
            if (uniqueNames.length > 0) {
                api.accounts.getAccounts(uniqueNames)
                    .then(accs => { const { accountsMap, voterProfiles } = buildMaps(accs); onAvatars(buildEnriched(accountsMap, voterProfiles)); })
                    .catch(() => {});
            }
            return buildEnriched({}, {});
        }

        let accountsMap = {}, voterProfiles = {};
        if (uniqueNames.length > 0) {
            const accs = await api.accounts.getAccounts(uniqueNames).catch(() => []);
            ({ accountsMap, voterProfiles } = buildMaps(accs));
        }
        return buildEnriched(accountsMap, voterProfiles);
    } catch (e) { console.warn('[Community] Post enrichment failed:', e.message); return safePosts; }
};

const applyVoteToPost = (post, voter, weight) => {
    const filteredVotes = (post.active_votes || []).filter(v => v?.voter !== voter);
    if (weight !== 0) filteredVotes.push({ voter, weight, rshares: '0', time: null });
    return {
        ...post, active_votes: filteredVotes,
        upVotesNumber: Math.max(0, filteredVotes.filter(v => v?.weight >= 0).length),
        downVotesNumber: Math.max(0, filteredVotes.filter(v => v?.weight < 0).length),
    };
};


// ╔══════════════════════════════════════════════════════════════════════╗
// ║  4. HOOKS                                                           ║
// ╚══════════════════════════════════════════════════════════════════════╝

// ── useDialogManager ───────────────────────────────────────────────────
const DIALOG_INITIAL = { editCommunity: false, addSomeone: false, membersList: false, leaveConfirm: false };
const dialogReducer = (state, action) => {
    switch (action.type) {
        case 'OPEN':  return { ...state, [action.dialog]: true };
        case 'CLOSE': return { ...state, [action.dialog]: false };
        default:      return state;
    }
};

const useDialogManager = () => {
    const [dialogs, dispatch] = useReducer(dialogReducer, DIALOG_INITIAL);
    const openDialog  = useCallback((name) => dispatch({ type: 'OPEN',  dialog: name }), []);
    const closeDialog = useCallback((name) => dispatch({ type: 'CLOSE', dialog: name }), []);
    return { dialogs, openDialog, closeDialog };
};

// ── Grid configuration (shared hook in ../hooks/useMasonryGrid) ───────
// Single wide column whose width tracks the root minus the sidebar
// offsets (not the gutter-division formula the feeds use), so the page
// supplies its own getColumnWidth. Community has no infinite scroll, so
// the load-more options are simply omitted. visible_ids stays an ARRAY
// here — the existing cellRenderer indexes it that way.
const COMMUNITY_COLUMN_WIDTH = ({ rootWidth, isMobile, gutter }) =>
    rootWidth - (isMobile ? 32 : 412) - gutter * 2;

const COMMUNITY_VISIBLE_IDS_INIT = () => [];

const useCommunityGrid = ({ windowWidth, windowHeight, isMobile, overscanByPixels }) => {
    const core = useMasonryGrid({
        windowWidth, windowHeight, isMobile, overscanByPixels,
        getColumnWidth: COMMUNITY_COLUMN_WIDTH,
        fallbackColumnWidth: 800,
        defaultHeight: 400,
        visibleIdsInit: COMMUNITY_VISIBLE_IDS_INIT,
        scrollReloadDivisor: 2,
    });

    // Page chrome — Community-specific, derived from the shared core.
    const pageWidth = isMobile ? windowWidth : windowWidth - 396 - 300;
    const postListHeight = windowHeight - (isMobile ? 80 : 96);
    const shouldCollapseMobileCard = core.scrollY < 0 && core.scrollTop >= 72;

    return { ...core, pageWidth, postListHeight, shouldCollapseMobileCard };
};

// ── usePostNavigation ──────────────────────────────────────────────────
const usePostNavigation = ({ api, posts, scrollToIndex, setSelectedPostIndex, fallbackUrl }) => {
    const [artworkOpen, setArtworkOpen] = useState(false);
    const [currentPost, setCurrentPost] = useState({});
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isOrphan, setIsOrphan] = useState(false);
    const historyDepthRef = useRef(0);
    // One-shot guard for the cold-entry history seed (see the URL effect).
    const seededRef = useRef(false);

    useEffect(() => { setSelectedPostIndex?.(selectedIndex); }, [selectedIndex, setSelectedPostIndex]);

    const postsRef = useRef(posts);
    useEffect(() => { postsRef.current = posts; }, [posts]);
    const currentPostRef = useRef(currentPost);
    useEffect(() => { currentPostRef.current = currentPost; }, [currentPost]);
    const apiRef = useRef(api);
    useEffect(() => { apiRef.current = api; }, [api]);
    const orphanFetchTokenRef = useRef(0);

    // ── URL-driven open/close/swap ─────────────────────────────────────
    // Single source of truth: URL decides dialog state & content. Handles
    // direct URL entry, back/forward, post-to-post transitions from
    // in-dialog links (including governance-dialog links), and closePost's
    // HISTORY.go(-1). See Feed.js for full rationale.
    // API-readiness handling lives inside the orphan-fetch dispatch (a
    // setTimeout polling loop), not in this effect's deps. See the block
    // inside for the full rationale.
    useEffect(() => {
        // Cold-entry seed: if we mounted straight onto a community post URL
        // (shared link / refresh on an open post), seat the community feed
        // beneath the overlay so Back returns to the feed and closes
        // BlogPostDialog instead of leaving the site. Same-page only.
        // See Feed.js for the full rationale.
        if (!seededRef.current) {
            seededRef.current = true;
            const seedPath = HISTORY.location.pathname;
            const seedHash = HISTORY.location.hash || "";
            const seedBack = fallbackUrl;
            if (isPostUrl(seedPath) && historyDepthRef.current === 0
                && seedBack && !isPostUrl(seedBack)) {
                if (HISTORY.action === "PUSH") {
                    // In-app arrival: another page PUSHED this post URL
                    // (Profile's comment/reply cards and timeline, Feed, an
                    // in-dialog link), so the true origin already sits one
                    // entry beneath us. The cold-entry splice below would
                    // bury it one step deeper — closePost's go(-1) would
                    // land on the community feed instead of returning, and
                    // the origin would need a second Back (the reported
                    // "close lands on the portal"). Just record the depth:
                    // the pushed post URL IS the one tracked entry, so
                    // go(-1) walks straight back to wherever the user
                    // came from.
                    historyDepthRef.current = 1;
                } else {
                    // Cold entry — shared link, refresh, or a back/forward
                    // re-entry (all arrive as POP; a REPLACE arrival has no
                    // knowable origin beneath either): seat the community
                    // feed under the overlay so Back closes BlogPostDialog
                    // into the feed instead of leaving the site.
                    HISTORY.replace(seedBack);
                    HISTORY.push(seedPath + seedHash);
                    historyDepthRef.current = 1;
                }
            }
        }
        const syncFromUrl = (pathname) => {
            const parsed = parsePostUrl(pathname);
            if (!parsed) {
                orphanFetchTokenRef.current += 1;
                setArtworkOpen(prev => {
                    if (!prev) return prev;
                    setCurrentPost({});
                    setIsOrphan(false);
                    historyDepthRef.current = 0;
                    return false;
                });
                return;
            }
            const cur = currentPostRef.current;
            const sameUrl =
                cur && cur.permlink === parsed.permlink
                && (cur.author?.username || cur.author) === parsed.author;
            // Bail early ONLY if the dialog already shows fully-hydrated
            // content for this URL. A pending stub (_loading) or a failed
            // fetch (_notFound) for the same URL must fall through so a
            // newly-ready api can retry — that's the cold-entry path.
            if (sameUrl && !cur._loading && !cur._notFound) return;
            const match = (postsRef.current || []).find(p =>
                p.permlink === parsed.permlink && p.author?.username === parsed.author
            );
            if (match) {
                setIsOrphan(false);
                setCurrentPost(match);
                setArtworkOpen(true);
                return;
            }
            // Orphan: the post isn't in the loaded community feed. Fetch it
            // directly via getContent so deep-links to arbitrary community
            // posts still work. Open the dialog *immediately* with a stub
            // from the URL so the transition isn't gated on the network
            // round-trip — BlogPostDialog renders its loading state from
            // _loading until the fetch hydrates, or _notFound on failure.
            //
            // Soft-deleted posts ALWAYS land here: enrichPostsList filters
            // them out of the feed, so `match` above can never find one and
            // the only way to reach a deleted post is by URL. fetchOrphanPost
            // returns it with `deleted` / `_deleted` set rather than dropping
            // it, and the dialog renders the "deleted by its author" state.
            // The isOrphan flag here only suppresses keyboard navigation
            // (see the keydown effect below) since BlogPostDialog has no
            // prev/next arrows.
            const token = ++orphanFetchTokenRef.current;
            setIsOrphan(true);
            // Only install the stub when we don't already have one for this
            // URL — re-installing it on every api change would flicker the
            // dialog back to the loading state when we already had a stub.
            if (!sameUrl) {
                setCurrentPost({
                    author: { username: parsed.author },
                    permlink: parsed.permlink,
                    _loading: true,
                });
                setArtworkOpen(true);
            } else if (cur._notFound) {
                // Coming off a failed attempt — flip the stub back to loading
                // so the dialog shows the spinner during the retry instead of
                // staying in the "not found" UI while the new fetch is in flight.
                setCurrentPost({
                    author: { username: parsed.author },
                    permlink: parsed.permlink,
                    _loading: true,
                });
            }
            // Dispatch the orphan fetch via a small polling loop that waits
            // for `apiRef.current?.initialized` to flip true. This matches the
            // pattern `loadCommunity` (and `loadPage`, `loadProfile`) use for
            // the same problem: the PixaProxyAPI instance is constructed once
            // and mutated in place (its `initialized` boolean flips after
            // `initialize()` resolves), so the `api` prop reference doesn't
            // change. React lifecycle hooks can't catch the mutation, and
            // Community is wrapped in `memo` so even Index's apiReady-rebuild
            // dispatching a new page element doesn't trigger a Community re-
            // render when the api reference and other props are unchanged
            // (the memo shallow-compare passes). Polling sidesteps all of
            // that and works regardless of whether/when React re-renders.
            // The token guard inside still discards stale fetches if the URL
            // changes mid-poll.
            let tries = 0;
            const attemptFetch = async () => {
                // Discard if a newer navigation invalidated this fetch — saves
                // a pointless poll tick and prevents the eventual fetch from
                // racing a newer one.
                if (token !== orphanFetchTokenRef.current) return;
                const apiNow = apiRef.current;
                if (!apiNow?.initialized || !apiNow?.content?.getContent) {
                    // Give up after ~10 s (40 × 250 ms) so a permanently-broken
                    // api doesn't keep the timer chain alive for hours. The
                    // dialog falls back to its _notFound UI in that case.
                    if (++tries > 40) {
                        setCurrentPost(prev => ({ ...prev, _loading: false, _notFound: true }));
                        return;
                    }
                    setTimeout(attemptFetch, 250);
                    return;
                }
                const enriched = await fetchOrphanPost(apiNow, parsed.author, parsed.permlink);
                if (token !== orphanFetchTokenRef.current) return;
                if (!enriched) {
                    setCurrentPost(prev => ({ ...prev, _loading: false, _notFound: true }));
                    return;
                }
                setCurrentPost(enriched);
            };
            attemptFetch();
        };
        // API-readiness is handled by the polling loop inside the orphan-fetch
        // dispatch, not by re-running this effect — see the comment block
        // there for why a React dep on api?.initialized can't be relied on.
        syncFromUrl(HISTORY.location.pathname);
        const unlisten = HISTORY.listen(h => syncFromUrl(h.location.pathname));
        return unlisten;
    }, [posts]);

    useEffect(() => {
        const handleKeydown = (event) => {
            // Never hijack keystrokes typed into an editable element — the
            // text editor (Lexical contenteditable), comment fields, link
            // dialogs, search inputs. MUI dialogs portal to document.body,
            // so their keydowns bubble straight here; without this guard,
            // Enter in the editor opened a post (closing the editor via the
            // URL-sync effect) and arrows had their default caret movement
            // preventDefault-ed.
            const t = event.target;
            if (t && (t.isContentEditable
                || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
            // Don't cycle through feed posts while showing an orphan — the
            // `selectedIndex` doesn't correspond to anything meaningful.
            if (isOrphan && artworkOpen) return;
            let newIndex = selectedIndex;
            switch (event.keyCode) {
                case 40: newIndex = Math.min(posts.length - 1, selectedIndex + 1); event.preventDefault(); break;
                case 38: newIndex = Math.max(0, selectedIndex - 1); event.preventDefault(); break;
                case 13: if (posts[selectedIndex]) openPost(posts[selectedIndex]); return;
                default: return;
            }
            if (newIndex !== selectedIndex) {
                setSelectedIndex(newIndex); setCurrentPost(posts[newIndex]); scrollToIndex?.(newIndex);
            }
        };
        document.addEventListener("keydown", handleKeydown);
        return () => document.removeEventListener("keydown", handleKeydown);
    }, [selectedIndex, posts, scrollToIndex, isOrphan, artworkOpen]);

    // Push the post URL (optionally suffixed with a "#..." intent hash) and
    // seat the dialog. The hash must ride the SAME history entry as the post
    // URL: BlogPostDialog reads HISTORY.location.hash in _adopt_url_hash when
    // its `open`/`data` props land, and the cold-entry seed re-pushes
    // pathname + hash together, so appending it here is the whole contract.
    const pushAndOpen = useCallback((data, hash) => {
        const postUrl = buildPostUrl(data);
        if (postUrl) HISTORY.push(hash ? postUrl + hash : postUrl);
        orphanFetchTokenRef.current += 1;
        setIsOrphan(false);
        setArtworkOpen(true); setCurrentPost(data); historyDepthRef.current = 1;
    }, []);

    // Plain open — card title / excerpt / image click.
    const openPost = useCallback((data) => pushAndOpen(data), [pushAndOpen]);

    // Comment-button open — same navigation, but the pushed URL carries the
    // "#replies" intent so BlogPostDialog scrolls the comments column into
    // view once the post is mounted. Same deep-link scheme as PostDialog and
    // the Profile comment/reply links ("#replies&focus=<b64>" pins one
    // comment; the bare hash just focuses the section).
    const openPostComments = useCallback((data) => pushAndOpen(data, '#replies'), [pushAndOpen]);

    const closePost = useCallback(() => {
        const depth = historyDepthRef.current;
        setArtworkOpen(false); setCurrentPost({}); setIsOrphan(false); historyDepthRef.current = 0;
        if (!isPostUrl(HISTORY.location.pathname)) return;
        // depth === 0 → BlogPostDialog was opened from the URL (deep-link/
        // refresh or a back→forward re-open), not via openPost, so there's no
        // tracked entry to rewind. REPLACE the post URL with the fallback
        // instead of pushing on top of it: pushing leaves the post URL behind
        // us in history, so the next browser Back lands on it and syncFromUrl
        // re-opens the dialog. Replace swaps it out. See Feed.js for the note.
        if (depth > 0) HISTORY.go(-depth);
        else HISTORY.replace(fallbackUrl || '/');
    }, [fallbackUrl]);

    const nextPost = useCallback(() => {
        const idx = Math.min(posts.length - 1, posts.findIndex(p => p.id === currentPost.id) + 1);
        setSelectedIndex(idx); setCurrentPost(posts[idx]);
    }, [posts, currentPost]);

    const previousPost = useCallback(() => {
        const idx = Math.max(0, posts.findIndex(p => p.id === currentPost.id) - 1);
        setSelectedIndex(idx); setCurrentPost(posts[idx]);
    }, [posts, currentPost]);

    // Stable return identity: re-allocate only when a field actually changes.
    // This object was previously a fresh literal every render, so every
    // downstream hook keyed on `postNav` (the cell renderer, dialog props)
    // recomputed on every parent render — scroll ticks included. Memoizing
    // lets those bail when nothing here moved.
    return useMemo(() => ({
        artworkOpen, currentPost, selectedIndex, isOrphan,
        openPost, openPostComments, closePost,
        nextPost: isOrphan ? undefined : nextPost,
        previousPost: isOrphan ? undefined : previousPost,
    }), [artworkOpen, currentPost, selectedIndex, isOrphan,
        openPost, openPostComments, closePost, nextPost, previousPost]);
};

// ── useCommunityData ───────────────────────────────────────────────────
const useCommunityData = (api, pathname) => {
    // Lazy initializers: the old `const parsed = parseCommunityPathname(...)`
    // at hook top ran both regexes on EVERY render (scroll ticks included)
    // only to seed two states once. Later URL changes are handled by the
    // pathname effect below, which parses on change only.
    const [communityName, setCommunityName] = useState(() => parseCommunityPathname(pathname).communityName);
    const [sorting, setSorting] = useState(() => parseCommunityPathname(pathname).sortIndex);
    const [loading, setLoading] = useState(true);
    const [community, setCommunity] = useState({});
    const [posts, setPosts] = useState([]);
    const [members, setMembers] = useState([]);
    const [rules, setRules] = useState([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isJoined, setIsJoined] = useState(false);
    const [loggedInUser, setLoggedInUser] = useState(null);
    const [userRole, setUserRole] = useState(null);
    // Monotonic counter bumped whenever posts is fully replaced (initial load,
    // sort change, post_published refetch). The main component watches this
    // and drives a full Masonry reset — clearing CellMeasurerCache, the
    // positioner, and Masonry's internal _positionCache. Without this, react-
    // virtualized keeps cached heights keyed to the previous posts' ids and
    // renders the new list against stale geometry (visible as overlapping
    // cards, gaps, or items that don't appear until you scroll past them).
    const [dataVersion, setDataVersion] = useState(0);
    const prevPathnameRef = useRef(pathname);

    useEffect(() => {
        const prevPath = prevPathnameRef.current;
        const nextPath = pathname;
        prevPathnameRef.current = nextPath;

        const prev = parseCommunityPathname(prevPath);
        const next = parseCommunityPathname(nextPath);

        // Opening / closing BlogPostDialog (and navigating between posts
        // inside the same community via in-dialog links / arrow keys) only
        // changes the URL by adding or removing a `/@author/permlink`
        // suffix; the underlying community feed identity hasn't changed.
        // Skip BOTH the state-sync and the refetch in that case.
        //
        // parseCommunityPathname has no sort information to recover from
        // a post URL (the post form is `/portal-N/@author/permlink` — no
        // sort segment) and falls back to the default 'created' sort, so
        // letting this effect through on a post-URL transition would
        //   (a) visibly flip SortingTabs to "created" while BlogPostDialog
        //       is open over a feed still showing the previous sort, and
        //   (b) call refetchPosts with the wrong sort on open, replacing
        //       the visible masonry with a fresh default-sort query and
        //       discarding scroll position + any already-loaded extra
        //       pages. On close, HISTORY.go(-1) returns to the original
        //       URL and the same effect fires again, refetching a second
        //       time.
        //
        // The post overlay's own open/close/swap logic lives in
        // usePostNavigation (which listens to HISTORY directly), so
        // skipping here doesn't drop any work — it just keeps the
        // community feed untouched while the overlay is doing its thing.
        const prevIsPost = isPostUrl(prevPath);
        const nextIsPost = isPostUrl(nextPath);
        if ((prevIsPost || nextIsPost) && prev.communityName === next.communityName) {
            return;
        }

        setCommunityName(next.communityName);
        setSorting(next.sortIndex);
        if (prev.communityName !== next.communityName) loadCommunity(next.communityName, next.sortIndex);
        else if (prev.sort !== next.sort) refetchPosts(next.communityName, next.sortIndex);
    }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        actions.trigger_page_render_complete();
        actions.trigger_loading_update(0);
        // Cancelled on unmount so a quick page switch can't fire a stale
        // progress update onto the next page.
        const loadingTimer = setTimeout(() => actions.trigger_loading_update(100), 300);
        loadCommunity(communityName, sorting);
        return () => clearTimeout(loadingTimer);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Keep loggedInUser/role/joined in sync when the session changes after mount.
    // Without this, navigating to a community while logged-out (or before vault
    // unlock completes) leaves loggedInUser=null forever, and the Join button
    // silently no-ops on the early return inside toggleJoined.
    //
    // `sorting` is read through a ref rather than listed as an effect dep, so
    // flipping between sort tabs (trending/hot/new) doesn't tear down and
    // re-subscribe the full 7-event listener set on every click. The ref is
    // updated in a tiny separate effect below.
    const sortingRef = useRef(sorting);
    useEffect(() => { sortingRef.current = sorting; }, [sorting]);

    // Raw team/admins from the last successful community load. Lets a session
    // event refresh (and loadCommunity's own viewer branch) re-derive
    // joined/admin/role without refetching posts or members.
    const communityMetaRef = useRef({ team: [], admins: [] });

    // Monotonic token: each loadCommunity call claims the next value, and its
    // async commits (incl. the deferred avatar patch) bail if a newer load has
    // since superseded them. Community pages reconcile in place on a community
    // switch (Index doesn't remount same-name pages), so without this a slow
    // avatar fetch from the previous community could land on the new one.
    const loadTokenRef = useRef(0);

    // Resolve the active account and derive the viewer-scoped flags
    // (admin / joined / role) from the cached community meta. Shared by the
    // session-event refresh and loadCommunity so the resolution lives in one
    // place. Cheap: at most one getCommunityContext round-trip — no post or
    // member refetch, no masonry reset.
    //
    // The session-manager-first / key-manager-fallback chain mirrors what
    // loadCommunity used inline: prefer the sessionManager (unlocked account),
    // fall back to the keyManager (knows the account even while the vault is
    // locked) so a `pin_unlocked` event can't null out loggedInUser.
    const refreshViewerState = useCallback(async (name) => {
        if (!name) return;
        let user = null;
        if (api?.sessionManager) { try { user = await api.sessionManager.getActiveAccount(); } catch {} }
        if (!user && api?.keyManager?.getActiveAccount) user = api.keyManager.getActiveAccount();
        setLoggedInUser(user || null);
        if (!user) { setIsAdmin(false); setIsJoined(false); setUserRole(null); return; }

        const { team = [], admins = [] } = communityMetaRef.current || {};
        const admin = admins.includes(user) || team.some(t => t[0] === user && (t[1] === 'admin' || t[1] === 'owner'));
        const userEntry = team.find(t => t[0] === user);
        let joined = team.some(t => t[0] === user);
        if (api?.communities?.getCommunityContext) {
            try { const ctx = await api.communities.getCommunityContext(name, user); if (ctx?.subscribed) joined = true; } catch {}
        }
        setIsAdmin(admin);
        setUserRole(userEntry ? userEntry[1] : null);
        setIsJoined(joined);
    }, [api]);

    useEffect(() => {
        if (!api?.on || !api?.off) return;

        let cancelled = false;
        const refresh = async () => {
            try {
                // Session-only change (login, unlock, account switch): the
                // community's posts and member list are identity-independent,
                // so re-derive just the viewer slice instead of a full
                // loadCommunity. This drops a 20-post refetch, a full member
                // re-enrichment AND the masonry reset that used to flash the
                // grid on every unlock.
                if (cancelled) return;
                await refreshViewerState(communityName);
            } catch (e) {
                if (!cancelled) console.warn('[Community] session refresh failed:', e);
            }
        };

        const events = [
            'session_created', 'session_restored', 'session_resumed', 'session_ended',
            'account_switched', 'pin_unlocked', 'pin_locked',
        ];
        events.forEach(ev => api.on(ev, refresh));

        return () => {
            cancelled = true;
            events.forEach(ev => api.off(ev, refresh));
        };
    }, [api, communityName]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadCommunity = useCallback(async (name, sortIndex) => {
        if (!name) { console.warn('[Community] No community name'); setLoading(false); return; }
        const myToken = ++loadTokenRef.current; // claim this load
        setLoading(true);
        try {
            const sort = SORT_METHODS[sortIndex] || 'trending';
            // Three independent reads in parallel: community metadata, the
            // ranked-post page, and the portal account (header image).
            const [communityData, rawPosts, portalAccounts] = await Promise.all([
                api?.communities?.getCommunity(name) ?? null,
                api?.communities?.getRankedPosts({ sort, tag: name, limit: 20 }) ?? [],
                api?.accounts?.getAccounts([name], true) ?? [],
            ]);
            if (loadTokenRef.current !== myToken) return; // superseded by a newer load
            if (!communityData) {
                batch(() => {
                    setCommunity({ name, title: name, about: '', description: '', image: '' });
                    setPosts([]); setMembers([]); setRules([]); setLoading(false);
                });
                return;
            }
            const portalAcc = portalAccounts?.[0] ?? null;
            const communityObj = {
                ...communityData, name: communityData.title || communityData.name, _name: communityData.name,
                image: portalAcc?._profile?.profile_image || '', memberCount: communityData.subscribers || 0,
                postCount: (rawPosts || []).length,
                created: communityData.created_at
                    ? new Date(communityData.created_at + (communityData.created_at.includes('Z') ? '' : 'Z')).getTime() : 0,
            };
            const parsedRules = (communityData.description || '').split('\n')
                .map(line => line.replace(/^\d+[\.\)]\s*/, '').trim()).filter(Boolean);

            // Cache raw team/admins so refreshViewerState (here and on session
            // events) can derive viewer state without refetching.
            communityMetaRef.current = { team: communityData.team || [], admins: communityData.admins || [] };

            // ── Paint the chrome immediately ───────────────────────────────
            // Header, sidebar and rules need only the metadata we already
            // hold — commit them now rather than after the enrichment
            // round-trips below, so the page frame appears as soon as the
            // first Promise.all resolves. Batched into one render.
            batch(() => {
                setCommunity(communityObj);
                setRules(parsedRules);
            });

            const rawTeam = Array.isArray(communityData.team) ? communityData.team : [];

            // ── Three enrichment branches, all in flight at once ───────────
            // Previously these ran as a serial waterfall (user resolution →
            // community-context → member enrichment → post enrichment) and
            // committed in a single setState at the very end, so the post
            // grid waited on member-avatar enrichment AND the context call.
            // Now each branch commits its own slice the moment it resolves.

            // 1) Posts — primary content, highest priority. TWO-PHASE: the grid
            //    paints with text-ready cards (names, no avatars) one round-trip
            //    sooner; the onAvatars callback patches avatars in afterwards
            //    WITHOUT a dataVersion bump (avatar swaps don't change card
            //    height, so the masonry geometry is preserved). Both commits are
            //    token-guarded so a stale community's avatar fetch can't land.
            const postsBranch = enrichPostsList(rawPosts, api, (withAvatars) => {
                if (loadTokenRef.current !== myToken) return;
                setPosts(withAvatars);
            }).then(enriched => {
                if (loadTokenRef.current !== myToken) return;
                batch(() => {
                    setPosts(enriched);
                    setDataVersion(v => v + 1);
                    setLoading(false);
                });
            });

            // 2) Members — independent of posts; backfills the sidebar list.
            const membersBranch = enrichMemberAccounts(
                rawTeam.map(t => ({ username: t[0], role: t[1], title: t[2] || '', name: t[0], image: '', joined: null })),
                api, portalAcc,
            ).then(m => { if (loadTokenRef.current === myToken) setMembers(m); });

            // 3) Viewer state — login / admin / joined / role, via the shared
            //    resolver (reads the communityMetaRef set just above).
            const viewerBranch = refreshViewerState(name);

            // Settle on all three without blocking the early setLoading(false)
            // the posts branch already fired.
            await Promise.allSettled([postsBranch, membersBranch, viewerBranch]);
        } catch (e) {
            console.error('[Community] Failed to load:', e);
            if (loadTokenRef.current !== myToken) return;
            batch(() => {
                setCommunity({ name, title: name, description: '', image: '' });
                setPosts([]); setMembers([]); setRules([]); setLoading(false);
                setDataVersion(v => v + 1);
            });
        }
    }, [api, refreshViewerState]);

    const refetchPosts = useCallback(async (name, sortIndex) => {
        if (!api?.communities || !name) return;
        try {
            const rawPosts = await api.communities.getRankedPosts({ sort: SORT_METHODS[sortIndex] || 'trending', tag: name, limit: 20 });
            setPosts(await enrichPostsList(rawPosts, api));
            setDataVersion(v => v + 1);
        } catch (e) { console.error('[Community] Failed to refetch posts:', e); }
    }, [api]);

    // ── Refresh posts when a new blog post lands in this community ─────
    // A community blog post is a top-level comment whose parent_permlink
    // equals the community name (e.g. "portal-1"). The published event fires
    // after the broadcast succeeds, but the bridge's ranked-posts index can
    // lag a couple of seconds behind ingestion — refetchPosts is debounced so
    // the editor's typical `comment` + `comment_options` pair coalesces, and
    // the delay also gives the indexer a moment to catch up.
    //
    // We deliberately listen only for `post_published` here: replies to
    // community posts are visible inside BlogPostDialog, not on the
    // community's post list, so refetching on every reply would be wasteful.
    // Deletions of community posts are caught via `content_deleted` so the
    // disappearing card is reflected.
    useEffect(() => {
        if (!api?.on || !api?.off || !communityName) return;

        let refetchTimer = null;
        const schedule = () => {
            if (refetchTimer) clearTimeout(refetchTimer);
            refetchTimer = setTimeout(() => {
                refetchTimer = null;
                refetchPosts(communityName, sorting);
            }, 6000);
        };

        const onPostPublished = (payload) => {
            if (payload?.parentPermlink === communityName) schedule();
        };
        // We don't get a parent_permlink on delete events — refetch
        // unconditionally on a community we're currently viewing. Cheap given
        // the typical 20-row page size.
        const onContentDeleted = () => schedule();
        // Edits (api.broadcast.updateComment) change titles/tags/excerpts or
        // soft-delete a post. Scope the refetch to THIS community — exactly
        // like post_published above — so the page only refreshes for edits to
        // its own top-level posts, not for replies or posts edited elsewhere.
        // content_updated carries parent_permlink, and a community blog post's
        // parent_permlink equals the community name, so the same gate applies.
        const onContentUpdated = (payload) => {
            if (payload?.parentPermlink === communityName) schedule();
        };

        api.on('post_published', onPostPublished);
        api.on('content_deleted', onContentDeleted);
        api.on('content_updated', onContentUpdated);
        return () => {
            if (refetchTimer) clearTimeout(refetchTimer);
            api.off('post_published', onPostPublished);
            api.off('content_deleted', onContentDeleted);
            api.off('content_updated', onContentUpdated);
        };
    }, [api, communityName, sorting, refetchPosts]);

    const handleVoteChange = useCallback((permlink, voter, weight) => {
        setPosts(prev => prev.map(p => p.permlink === permlink ? applyVoteToPost(p, voter, weight) : p));
    }, []);

    // Patch a single post's stats in-place. Used for optimistic UI after
    // mutePost/unmutePost/pinPost/unpinPost broadcasts — the bridge won't
    // reflect the change until its background indexer catches up.
    const patchPostStats = useCallback((author, permlink, statsPatch) => {
        setPosts(prev => prev.map(p => {
            const pAuthor = (p.author && typeof p.author === 'object') ? (p.author.username || p.author.name) : p.author;
            if (p.permlink !== permlink || pAuthor !== author) return p;
            return { ...p, stats: { ...(p.stats || {}), ...statsPatch } };
        }));
    }, []);

    const toggleJoined = useCallback(async () => {
        if (!api?.communities || !communityName) return;

        // Read active user directly from the session manager rather than
        // trusting the React `loggedInUser` state — the state can lag behind
        // session_created events in race conditions (memo'd parents, effect
        // ordering, post-login navigation). The session manager is the
        // source of truth.
        const activeUser =
            api.sessionManager?.currentAccount ||
            (await api.sessionManager?.getActiveAccount?.()) ||
            null;

        if (!activeUser) {
            actions.trigger_snackbar(t("components.community.you_need_to_be_logged_in_to"));
            return;
        }

        // Lazily sync local state so the rest of the UI (header, role badges)
        // catches up if it was stale.
        if (activeUser !== loggedInUser) setLoggedInUser(activeUser);

        // Re-derive role from the latest member list — this matters when the
        // user just logged in and joined state hasn't been recomputed yet.
        const liveRole = userRole
            || (members?.find(m => m.username === activeUser)?.role || null);

        if (isJoined && ['owner', 'admin', 'mod'].includes(liveRole)) return 'confirm_leave';

        // Capture pre-flip value so the rollback path doesn't depend on stale closure
        // and the branching read isn't conflated with the optimistic state update.
        const wasJoined = isJoined;
        setIsJoined(!wasJoined);
        try {
            if (wasJoined) { await api.communities.unsubscribe(communityName); actions.trigger_snackbar(t("components.community.you_just_left_this_community")); }
            else { await api.communities.subscribe(communityName); actions.trigger_snackbar(t("components.community.welcome_in_this_community")); }
        } catch (e) {
            console.error('[Community] subscribe/unsubscribe failed:', e);
            setIsJoined(wasJoined);
            actions.trigger_snackbar(
                e?.code === 'NO_SESSION' ? t("components.community.you_need_to_be_logged_in_to") : t("components.community.could_not_update_membership_please_try_again")
            );
        }
    }, [api, communityName, loggedInUser, isJoined, userRole, members]);

    const confirmLeave = useCallback(async () => {
        if (!api?.communities || !communityName) return;
        setIsJoined(false);
        try { await api.communities.unsubscribe(communityName); actions.trigger_snackbar(t("components.community.you_just_left_this_community")); }
        catch (e) { console.error('[Community] unsubscribe failed:', e); setIsJoined(true); }
    }, [api, communityName]);

    const reload = useCallback(() => loadCommunity(communityName, sorting), [communityName, sorting, loadCommunity]);

    return {
        communityName, sorting, loading, community, posts, members, rules,
        isAdmin, isJoined, loggedInUser, userRole, dataVersion,
        handleVoteChange, patchPostStats, toggleJoined, confirmLeave, reload,
    };
};


// ╔══════════════════════════════════════════════════════════════════════╗
// ║  5. SUB-COMPONENTS                                                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

const LeaveConfirmDialog = memo(({ open, userRole, onCancel, onConfirm, dialogClass }) => {
        useLanguage();
        const roleLabel = userRole === 'owner' ? 'the owner' : userRole === 'admin' ? 'an admin' : 'a moderator';
        return (
            <Dialog open={open} keepMounted={false} PaperProps={{ classes: { root: dialogClass } }}
                    onClose={onCancel} maxWidth="xs" fullWidth
                    aria-labelledby="leave-dialog-title" aria-describedby="leave-dialog-desc">
                <DialogTitle id="leave-dialog-title">{t("components.community.do_you_really_want_to_leave_this")}</DialogTitle>
                <DialogContent>
                    <DialogContentText id="leave-dialog-desc">
                        {t("components.community.you_are_currently_of_this_community_leaving", {
                            roleLabel: roleLabel
                        })}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onCancel} color="primary">{t("words.cancel")}</Button>
                    <Button onClick={onConfirm} color="primary" variant="contained" autoFocus>{t("components.community.leave")}</Button>
                </DialogActions>
            </Dialog>
        );
    }, (prev, next) =>
        // Full shallow equality over every prop — correct and never stale. With
        // the parent now passing a stable onCancel/onConfirm, this lets the dialog
        // skip re-renders on unrelated parent renders (scroll, vote, tab changes)
        // and re-render only when open / userRole actually move.
        prev.open === next.open &&
        prev.userRole === next.userRole &&
        prev.onCancel === next.onCancel &&
        prev.onConfirm === next.onConfirm &&
        prev.dialogClass === next.dialogClass,
);


// ── Moderation reason dialog ───────────────────────────────────────────────
// Mirrors TextEditorDialog's LinkDialog: a small dark Dialog with labelled
// inputs and Cancel / confirm actions. Used for flagPost / mutePost /
// unmutePost which all take a free-text `notes` field on the custom_json op.
const MOD_OP_COPY = {
    flagPost:    { title: 'Flag this post',   desc: 'Flag this post for moderator review. Your reason will be sent with the flag.', confirm: 'Flag',   confirmColor: '#fff' },
    mutePost:    { title: 'Mute this post',   desc: 'Muted posts are hidden from the community feed. Use "spam" as the reason for spam.', confirm: 'Mute',   confirmColor: '#fff' },
    unmutePost:  { title: 'Unmute this post', desc: 'Restore this post in the community feed. You can optionally add a note.', confirm: 'Unmute', confirmColor: '#fff' },
};

const ModerationReasonDialog = memo(({
                                         classes,
                                         open,
                                         op,
                                         author,
                                         permlink,
                                         notes,
                                         onNotesChange,
                                         onCancel,
                                         onConfirm,
                                         submitting,
                                     }) => {
        useLanguage();
        const copy = MOD_OP_COPY[op] || { title: 'Moderation', desc: '', confirm: 'Confirm', confirmColor: '#fff' };
        const confirmTextColor = copy.confirmColor === '#fff' ? '#000' : '#fff';
        return (
            <Dialog
                PaperProps={{ classes: { root: classes.darkDialog } }}
                open={open}
                maxWidth="xs"
                fullWidth
                onClose={onCancel}
                aria-labelledby="moderation-dialog-title"
            >
                <DialogContent className={classes.darkDialogContent}>
                    <Typography variant="h6" gutterBottom id="moderation-dialog-title">
                        {copy.title}
                    </Typography>
                    {author && permlink && (
                        <Typography
                            variant="body2"
                            style={{ color: "rgba(255,255,255,0.6)", marginBottom: 12, wordBreak: "break-all" }}
                        >
                            @{author} / {permlink}
                        </Typography>
                    )}
                    <Typography variant="body2" style={{ color: "rgba(255,255,255,0.8)", marginBottom: 16 }}>
                        {copy.desc}
                    </Typography>
                    <TextField
                        className={classes.darkInput}
                        variant="outlined"
                        label={t("components.community.reason_optional")}
                        placeholder={op === 'mutePost' ? 'spam' : ''}
                        value={notes}
                        onChange={onNotesChange}
                        fullWidth
                        multiline
                        minRows={2}
                        maxRows={4}
                        autoFocus
                        disabled={submitting}
                    />
                </DialogContent>
                <DialogActions className={classes.darkDialogActions}>
                    <Button onClick={onCancel} disabled={submitting} style={{ color: "#ccc" }}>
                        {t("words.cancel")}
                    </Button>
                    <Button
                        variant="contained"
                        onClick={onConfirm}
                        disabled={submitting}
                        style={{ backgroundColor: copy.confirmColor, color: confirmTextColor }}
                    >
                        {submitting ? '…' : copy.confirm}
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }, (prev, next) =>
        // Full shallow equality. onNotesChange/onCancel are stable ([] deps) and
        // onConfirm tracks modDialog, so any real change to the dialog's data
        // moves a value prop here too — letting it skip re-renders on unrelated
        // parent renders (scroll, votes, tab changes).
        prev.classes === next.classes &&
        prev.open === next.open &&
        prev.op === next.op &&
        prev.author === next.author &&
        prev.permlink === next.permlink &&
        prev.notes === next.notes &&
        prev.submitting === next.submitting &&
        prev.onNotesChange === next.onNotesChange &&
        prev.onCancel === next.onCancel &&
        prev.onConfirm === next.onConfirm,
);


// ╔══════════════════════════════════════════════════════════════════════╗
// ║  6. MAIN COMPONENT                                                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

const Community = ({ classes, settings, pathname, api }) => {
    const { windowWidth, windowHeight, isMobile, overscanByPixels } = useWindowDimensions();

    const {
        communityName, sorting, community, posts, members, rules,
        isAdmin, isJoined, loggedInUser, userRole, dataVersion,
        handleVoteChange, patchPostStats, toggleJoined, confirmLeave, reload,
    } = useCommunityData(api, pathname);

    const grid = useCommunityGrid({ windowWidth, windowHeight, isMobile, overscanByPixels });

    const postNav = usePostNavigation({
        api, posts, scrollToIndex: grid.scrollToIndex, setSelectedPostIndex: grid.setSelectedPostIndex,
        fallbackUrl: buildCommunityUrl(communityName, SORT_METHODS[sorting] || 'created'),
    });

    const { dialogs, openDialog, closeDialog } = useDialogManager();

    // ── Local UI state ─────────────────────────────────────────────────
    const [mobileCardExpanded, setMobileCardExpanded] = useState(false);
    const [menuCardXY, setMenuCardXY] = useState([]);
    const [menuCardData, setMenuCardData] = useState({});
    const [tabValue, setTabValue] = useState(1);
    const [editorOpen, setEditorOpen] = useState(() => parseCommunityPathname(pathname).editor);
    // Edit-content mode: {author, permlink} of the post the editor is
    // updating, or null when writing a new post. Opening for an edit never
    // pushes the /editor URL, so the URL sync below must not slam the
    // dialog shut — the ref mirrors the state for the stable callbacks.
    const [editorTarget, setEditorTarget] = useState(null);
    const editorTargetRef = useRef(null);
    editorTargetRef.current = editorTarget;

    // ── Sync URL → editor state ────────────────────────────────────────
    useEffect(() => {
        const p = parseCommunityPathname(pathname);
        if (p.editor && !editorOpen) setEditorOpen(true);
        else if (!p.editor && editorOpen && !editorTargetRef.current) setEditorOpen(false);
    }, [pathname]);

    useEffect(() => {
        if (grid.shouldCollapseMobileCard) setMobileCardExpanded(false);
    }, [grid.shouldCollapseMobileCard]);

    // Full masonry reset when posts is fully replaced (initial load,
    // sort change, post_published refetch). Clears stale CellMeasurerCache
    // heights and Masonry's internal _positionCache so the new list lays
    // out from scratch. Declared BEFORE the lighter [posts] forceUpdate
    // effect so the cache flush happens first; the subsequent forceUpdate
    // then renders against fresh measurements.
    useEffect(() => {
        grid.resetMasonry();
    }, [dataVersion]); // eslint-disable-line react-hooks/exhaustive-deps

    // Force masonry to re-render when posts arrive or change.
    // @pixagram/virtualized's Masonry doesn't auto-update when cellCount changes.
    useEffect(() => {
        const masonry = grid.masonryRef.current;
        if (masonry) masonry.forceUpdate();
    }, [posts]);

    const locales = settings._selected_locales_code;

    // ── Callbacks ──────────────────────────────────────────────────────
    const handleSortingChange = useCallback((e, value) => {
        // replace (not push) so mobile back doesn't walk through every sort
        // tab the user tapped. The pathname-change effect above observes the
        // new URL via parseCommunityPathname and calls refetchPosts itself.
        // No name means this component is mounted on a URL that is not a
        // community page (the feed owns /created/, /hot/ …). Rewriting the URL
        // from here would clobber the route the user is actually on.
        if (sorting !== value && communityName) HISTORY.replace(buildCommunityUrl(communityName, SORT_METHODS[value] || 'trending'));
        else grid.scrollTo(0);
        // grid.scrollTo is a stable callback; depending on it instead of the
        // whole grid object (whose identity changes every scroll tick) keeps
        // SortingTabs' onSortingChange prop from churning while scrolling —
        // the same narrowing Feed applies to its tab handler.
    }, [sorting, communityName, grid.scrollTo]);

    const handleTabChange = useCallback((e, value) => setTabValue(value), []);

    const handleToggleJoined = useCallback(async () => {
        if ((await toggleJoined()) === 'confirm_leave') openDialog('leaveConfirm');
    }, [toggleJoined, openDialog]);

    const handleLeaveConfirm = useCallback(async () => {
        closeDialog('leaveConfirm'); await confirmLeave();
    }, [confirmLeave, closeDialog]);

    // Stable so LeaveConfirmDialog's memo can bail — an inline arrow here
    // would change identity every render and defeat the comparator.
    const handleLeaveCancel = useCallback(() => closeDialog('leaveConfirm'), [closeDialog]);

    const handleTextEditor = useCallback(() => {
        setEditorTarget(null); // new post — never reuse a stale edit target
        const sort = SORT_METHODS[sorting] || 'created';
        if (communityName) HISTORY.push(buildCommunityUrl(communityName, sort, true));
        setEditorOpen(true);
    }, [communityName, sorting]);

    const handleTextEditorClose = useCallback(() => {
        setEditorOpen(false);
        if (editorTargetRef.current) {
            // Edit mode never pushed the /editor URL — just drop the target.
            setEditorTarget(null);
            return;
        }
        HISTORY.back();
    }, []);

    // Warm the text-editor chunk during idle time, but only for a logged-in
    // user — the only one who can post here — so the first open hydrates
    // instantly. Logged-out visitors never fetch it, preserving the lazy
    // default. Skipped when the editor is already open (cold-entry
    // /<community>/<sort>/editor), since React.lazy is loading it anyway.
    useEffect(() => {
        if (editorOpen || !loggedInUser) return;
        const id = idle(() => { loadTextEditorDialog().catch(() => {}); });
        return () => cancelIdle(id);
    }, [editorOpen, loggedInUser]);
    const toggleMobileCard = useCallback(() => setMobileCardExpanded(prev => !prev), []);
    const closeMobileCard = useCallback(() => setMobileCardExpanded(false), []);

    const openCardMenu = useCallback((event, data) => {
        setMenuCardXY(Int32Array.of(event.x - 24, event.y - 24)); setMenuCardData(data);
    }, []);
    const closeCardMenu = useCallback(() => {
        setMenuCardXY(Int32Array.of(0, 0)); setMenuCardData({});
    }, []);

    // ── Own-post management (card menu → page-level dialogs) ───────────
    const [editPostData, setEditPostData] = useState(null);
    const [deletePostData, setDeletePostData] = useState(null);
    const onEditPost = useCallback((data) => { setEditPostData(data); }, []);
    const onDeletePost = useCallback((data) => { setDeletePostData(data); }, []);
    const closeEditPost = useCallback(() => { setEditPostData(null); }, []);
    const closeDeletePost = useCallback(() => { setDeletePostData(null); }, []);
    // "Edit Content" reuses the community's lazy TextEditorDialog in edit
    // mode — no URL push, the close handler knows the difference.
    const onEditContent = useCallback((data) => {
        const author = (data?.author && typeof data.author === 'object')
            ? (data.author.username || data.author.name || '')
            : (data?.author || '');
        if (!author || !data?.permlink) return;
        setEditorTarget({ author, permlink: data.permlink });
        setEditorOpen(true);
    }, []);
    // Broadcasts emit content_updated → the listener above refetches posts.
    const handlePostEdited = useCallback(() => {}, []);
    const handlePostDeleted = useCallback(() => {}, []);
    const handleEditorUpdated = useCallback(() => {}, []);

    // Mount the (now-lazy) post viewer on first open and keep it mounted so
    // close/reopen and in-dialog next/prev stay instant. On a deep-link entry
    // (cold-entry community-post URL) artworkOpen flips true on the first
    // effects pass, so this mounts on the first commit while the orphan fetch
    // runs in parallel — the Suspense backdrop covers the chunk fetch.
    const [blogDialogMounted, setBlogDialogMounted] = useState(false);
    useEffect(() => {
        if (postNav.artworkOpen) setBlogDialogMounted(true);
    }, [postNav.artworkOpen]);

    // Warm the post-viewer chunk on idle for EVERYONE (anyone can open a
    // post), so the open-from-card transition isn't gated on a cold chunk
    // fetch. Skipped once mounted (React.lazy is fetching it anyway).
    useEffect(() => {
        if (blogDialogMounted) return;
        const id = idle(() => { loadBlogPostDialog().catch(() => {}); });
        return () => cancelIdle(id);
    }, [blogDialogMounted]);

    // Mount the (now-lazy) edit/delete dialogs on first use and keep them
    // mounted (both come from one chunk). Warmed on idle for logged-in users
    // only — they're the only ones who can edit or delete their own posts.
    const [ownPostDialogsMounted, setOwnPostDialogsMounted] = useState(false);
    useEffect(() => {
        if (editPostData || deletePostData) setOwnPostDialogsMounted(true);
    }, [editPostData, deletePostData]);
    useEffect(() => {
        if (ownPostDialogsMounted || !loggedInUser) return;
        const id = idle(() => { loadOwnPostDialogs().catch(() => {}); });
        return () => cancelIdle(id);
    }, [ownPostDialogsMounted, loggedInUser]);

    // ── Moderation (flag / mute / unmute / pin / unpin) ────────────────
    // PaperCardMenuOption fires onModerate(op, ctx). Pin/unpin broadcast
    // immediately; flag/mute/unmute open ModerationReasonDialog first to
    // collect a free-text `notes` field (matching the custom_json op spec).
    const [modDialog, setModDialog] = useState({
        open: false, op: null, community: '', author: '', permlink: '', notes: '', submitting: false,
    });

    const runModBroadcast = useCallback(async (op, ctx, notes = '') => {
        if (!api?.communities) return;
        try {
            switch (op) {
                case 'flagPost':
                    await api.communities.flagPost(ctx.community, ctx.author, ctx.permlink, notes);
                    actions.trigger_snackbar(t("components.community.post_flagged_for_review"));
                    break;
                case 'mutePost':
                    await api.communities.mutePost(ctx.community, ctx.author, ctx.permlink, notes);
                    patchPostStats(ctx.author, ctx.permlink, { gray: true, hide: true, mute_reason: notes || '' });
                    actions.trigger_snackbar(t("components.community.post_muted"));
                    break;
                case 'unmutePost':
                    await api.communities.unmutePost(ctx.community, ctx.author, ctx.permlink, notes);
                    patchPostStats(ctx.author, ctx.permlink, { gray: false, hide: false, mute_reason: '' });
                    actions.trigger_snackbar(t("components.community.post_unmuted"));
                    break;
                case 'pinPost':
                    await api.communities.pinPost(ctx.community, ctx.author, ctx.permlink);
                    patchPostStats(ctx.author, ctx.permlink, { is_pinned: true });
                    actions.trigger_snackbar(t("components.community.post_pinned"));
                    break;
                case 'unpinPost':
                    await api.communities.unpinPost(ctx.community, ctx.author, ctx.permlink);
                    patchPostStats(ctx.author, ctx.permlink, { is_pinned: false });
                    actions.trigger_snackbar(t("components.community.post_unpinned"));
                    break;
                default:
                    console.warn('[Community] Unknown moderation op:', op);
                    return;
            }
        } catch (e) {
            console.warn(`[Community] ${op} failed:`, e?.message || e);
            actions.trigger_snackbar(t("components.community.failed", {
                value: e?.message || 'unknown error'
            }));
        }
    }, [api, patchPostStats]);

    const handleModerate = useCallback((op, ctx) => {
        // Pin / unpin: no notes field in the op, fire immediately.
        if (op === 'pinPost' || op === 'unpinPost') {
            runModBroadcast(op, ctx);
            return;
        }
        // Flag / mute / unmute: open the reason dialog.
        setModDialog({
            open: true, op, community: ctx.community, author: ctx.author,
            permlink: ctx.permlink, notes: '', submitting: false,
        });
    }, [runModBroadcast]);

    const handleModNotesChange = useCallback((e) => {
        const value = e?.target?.value ?? '';
        setModDialog(prev => ({ ...prev, notes: value }));
    }, []);

    const handleModCancel = useCallback(() => {
        setModDialog(prev => ({ ...prev, open: false, submitting: false }));
    }, []);

    const handleModConfirm = useCallback(async () => {
        setModDialog(prev => ({ ...prev, submitting: true }));
        const { op, community: cName, author, permlink, notes } = modDialog;
        await runModBroadcast(op, { community: cName, author, permlink }, notes.trim());
        setModDialog(prev => ({ ...prev, open: false, submitting: false }));
    }, [modDialog, runModBroadcast]);


    const onVoteChange = useCallback((permlink, voter, weight) => {
        handleVoteChange(permlink, voter, weight);
    }, [handleVoteChange]);

    const handleEditCommunityClose = useCallback(() => { closeDialog('editCommunity'); reload(); }, [closeDialog, reload]);
    const handleAddSomeoneSave = useCallback(() => { closeDialog('addSomeone'); reload(); }, [closeDialog, reload]);
    // Stable onClose for the two dialogs below: the previous inline
    // `() => closeDialog('…')` lambdas re-created a closure per render
    // (scroll ticks included), churning both dialogs' props for nothing.
    const handleAddSomeoneClose = useCallback(() => closeDialog('addSomeone'), [closeDialog]);
    const handleMembersListClose = useCallback(() => closeDialog('membersList'), [closeDialog]);

    // ── Cell renderer ──────────────────────────────────────────────────
    // Depend on the SPECIFIC grid fields the renderer reads, not the whole
    // `grid` object: the shared masonry hook returns a fresh object whose
    // identity changes on every scroll tick (scrollTop/scrollY live in it),
    // which used to re-create this renderer — and hand MasonryExtended a new
    // cellRenderer prop — on every tick while scrolling. The fields below
    // are all referentially stable between layout changes (masonryRef is a
    // ref; rootDimensions only changes on a resize/measure).
    const {
        columnCount, columnWidth, trackElementPosition, cellMeasurerCache,
        selectedPostIndex, masonryRef, rootDimensions,
    } = grid;
    const { openPost, openPostComments } = postNav;
    const cellRenderer = useCallback((data) => {
        const { index, key, parent, style, isScrolling } = data;
        const item = posts[index | 0];
        if (!item) return null;

        const columnIndex = index % columnCount;
        const rowIndex = (index - columnIndex) / columnCount;
        style.width = columnWidth;

        trackElementPosition(index, +style.top, +style.height, rowIndex, columnIndex);

        const st = masonryRef.current?._scrollingContainer?.scrollTop || 0;
        const top = +style.top, bottom = top + (+style.height);
        const threshold = rootDimensions.height * (rootDimensions.height / rootDimensions.width);
        const visible = threshold + bottom > st && top < st + rootDimensions.height + threshold;
        cellMeasurerCache.visible_ids[item.id] = visible || (cellMeasurerCache.visible_ids[item.id] || false);

        // Muted-by-mods styling: everyone sees a grayscale+dim filter on the
        // card; hover restores the full card (defined in PaperCardBlog's
        // `cardMuted` class). This preserves moderation state at a glance
        // while letting any viewer still read the content on demand.
        const stats = item.stats || {};
        const isMuted = Boolean(stats.hide || stats.gray);

        return (
            <CellMeasurer cache={cellMeasurerCache} index={index} key={key} parent={parent}>
                <PaperCardBlog
                    onOpen={openPost} onCommentsClick={openPostComments}
                    locales={locales} data={item}
                    onMenuClick={openCardMenu} is_scrolling={isScrolling}
                    selected={selectedPostIndex === index}
                    visible={cellMeasurerCache.visible_ids[item.id]}
                    column_width={columnWidth} id={item.id} key={item.id}
                    rowIndex={rowIndex} columnIndex={columnIndex} style={style}
                    api={api} voter={loggedInUser} onVoteChange={onVoteChange}
                    muted={isMuted}
                />
            </CellMeasurer>
        );
    }, [posts, columnCount, columnWidth, trackElementPosition, cellMeasurerCache,
        selectedPostIndex, masonryRef, rootDimensions, openPost, openPostComments,
        locales, openCardMenu, api, loggedInUser, onVoteChange]);

    // ── Shared props for header/info ───────────────────────────────────
    // Keyed on the posts COUNT, not the array identity: header and sidebar
    // only display the count, but every vote and the phase-2 avatar patch
    // mint a new `posts` array, which used to rebuild this object (and its
    // inline handlers) and re-render CommunityHeader/CommunityInfo for a
    // number that hadn't changed.
    const postsCount = posts?.length;
    const communityUIProps = useMemo(() => ({
        community, members, rules, postsCount, joined: isJoined,
        tabValue, timeAgo, isAdmin,
        onToggleJoined: handleToggleJoined, onViewMembers: () => openDialog('membersList'),
        onTabChange: handleTabChange, onTextEditor: handleTextEditor,
        onEditCommunity: () => openDialog('editCommunity'), onAddSomeone: () => openDialog('addSomeone'),
        classes,
    }), [community, members, rules, postsCount, isJoined, tabValue, isAdmin,
        handleToggleJoined, handleTabChange, handleTextEditor, classes, openDialog]);

    // ── Render ─────────────────────────────────────────────────────────
    return (
        <React.Fragment>
            <div className={classes.root}>
                {isMobile && (
                    <CommunityHeader {...communityUIProps}
                                     mobileCardExpanded={mobileCardExpanded}
                                     y={grid.scrollY} scrollTop={grid.scrollTop} height={windowHeight}
                                     onToggleMobileCard={toggleMobileCard} onCloseMobileCard={closeMobileCard}
                    />
                )}
                <div className={classes.viewRight}>
                    <SortingTabs sorting={sorting} onSortingChange={handleSortingChange}
                                 mainTabClass={classes.mainTab} lessThan960w={isMobile}
                                 y={grid.scrollY} scrollTop={grid.scrollTop}
                    />
                </div>
                {!isMobile && <CommunityInfo {...communityUIProps} />}
            </div>

            <div style={{ position: "absolute" }} ref={grid.setRootElement}>
                <div className={classes.viewRight} />
                <div className={classes.masonry} key="posts">
                    <MasonryExtended
                        key="masonry-extended-blog-posts"
                        scrollTop={grid.scrollTop}
                        scrollingResetTimeInterval={grid.scrollingResetTimeInterval}
                        cellCount={(posts || []).length | 0} items={posts}
                        keyMapper={index => posts[index]?.id}
                        cellMeasurerCache={grid.cellMeasurerCache}
                        cellPositioner={grid.cellPositioner}
                        cellRenderer={cellRenderer}
                        overscanByPixels={grid.overscanByPixels}
                        ref={grid.setMasonryElement}
                        width={grid.pageWidth} height={grid.postListHeight}
                    />
                </div>
            </div>

            <PaperCardMenuOption
                xy={menuCardXY} data={menuCardData} onClose={closeCardMenu}
                api={api} onModerate={handleModerate}
                viewer={loggedInUser} viewerRole={userRole}
                onEditPost={onEditPost} onEditContent={onEditContent} onDeletePost={onDeletePost}
            />

            {ownPostDialogsMounted && (
                <React.Suspense fallback={DIALOG_FALLBACK}>
                    <LazyEditPostDialog
                        open={Boolean(editPostData)}
                        onClose={closeEditPost}
                        api={api}
                        account={loggedInUser}
                        data={editPostData || {}}
                        onUpdated={handlePostEdited}
                    />
                    <LazyDeletePostDialog
                        open={Boolean(deletePostData)}
                        onClose={closeDeletePost}
                        api={api}
                        data={deletePostData || {}}
                        onDeleted={handlePostDeleted}
                    />
                </React.Suspense>
            )}

            <ModerationReasonDialog
                classes={classes}
                open={modDialog.open}
                op={modDialog.op}
                author={modDialog.author}
                permlink={modDialog.permlink}
                notes={modDialog.notes}
                submitting={modDialog.submitting}
                onNotesChange={handleModNotesChange}
                onCancel={handleModCancel}
                onConfirm={handleModConfirm}
            />

            {blogDialogMounted && (
                <React.Suspense fallback={DIALOG_FALLBACK}>
                    <LazyBlogPostDialog
                        data={postNav.currentPost} open={postNav.artworkOpen}
                        locales={locales} api={api} account={loggedInUser}
                        onVoteChange={onVoteChange} onClose={postNav.closePost}
                        onPrevious={postNav.previousPost} onNext={postNav.nextPost}
                    />
                </React.Suspense>
            )}

            {isAdmin && (
                <EditCommunityDialog api={api} open={dialogs.editCommunity}
                                     communityName={communityName} onClose={handleEditCommunityClose} onSave={handleEditCommunityClose}
                />
            )}
            {isAdmin && (
                <AddSomeoneCommunityDialog api={api} open={dialogs.addSomeone}
                                           communityName={communityName} members={members}
                                           onClose={handleAddSomeoneClose} onSave={handleAddSomeoneSave}
                />
            )}
            <MembersListDialog api={api} open={dialogs.membersList}
                               onClose={handleMembersListClose} communityName={communityName}
            />
            <LeaveConfirmDialog open={dialogs.leaveConfirm} userRole={userRole}
                                onCancel={handleLeaveCancel} onConfirm={handleLeaveConfirm}
                                dialogClass={classes.whiteDialog}
            />

            {/* Deferred text editor: only loaded when first opened */}
            {editorOpen && (
                <React.Suspense fallback={DIALOG_FALLBACK}>
                    <LazyTextEditorDialog
                        api={api} open={editorOpen}
                        initialCommunity={communityName}
                        editPost={editorTarget}
                        onUpdated={handleEditorUpdated}
                        onClose={handleTextEditorClose}
                    />
                </React.Suspense>
            )}
        </React.Fragment>
    );
};

// memo comparator: these four props are referentially stable when unchanged
// (classes from withStyles, settings from Index's processedSettings, pathname
// a primitive, api the shared apiRef value), so this matches the default
// shallow check while documenting intent — consistent with Profile/Index.
export default withStyles(styles)(
    memo(Community, (prev, next) =>
        prev.classes === next.classes &&
        prev.settings === next.settings &&
        prev.pathname === next.pathname &&
        prev.api === next.api,
    ),
);