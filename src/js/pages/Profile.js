import * as React from "preact/compat";
import { useState, useEffect, useCallback, useMemo, useReducer, useRef, memo } from "preact/compat";
// Coalesce co-arriving setState calls after an await into one render (Preact
// doesn't auto-batch in promise continuations).
import { unstable_batchedUpdates as batch } from "preact/compat";
import { HISTORY, buildPostUrl, buildCommentFocusHash, isPostUrl, parsePostUrl, isDeletedPost, isCommunityPostUrl, COMMUNITY_TAG_REGEX } from "../utils/constants";
import withStyles from "@material-ui/core/styles/withStyles";
import * as actions from "../actions/utils";
import { CellMeasurer, CellMeasurerCache, createMasonryCellPositioner } from "@pixagram/virtualized/dist/es/index";
import MasonryExtended from "../components/MasonryExtended";
import useWindowDimensions from "../hooks/useWindowDimensions";
import { idle, cancelIdle } from "../utils/idle";
import {
    EASE as E, TRANSITION_FAST as TF, TRANSITION_MEDIUM as TM,
    TRANSITION_ENTRY as TE, RAINBOW_RIPPLE as RIPPLE, slideKF,
} from "../theme/motion";
import PaperCard, { isArtworkBlurred } from "../components/PaperCard";
import PaperCardMenuOption from "../components/PaperCardMenuOption";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";
import ImageMeasurer from "../components/ImageMeasurer";
import PaperCardComment from "../components/PaperCardComment";
import PaperCardReply from "../components/PaperCardReply";
import FollowListModal from "../components/FollowListModal";
import timeAgo from "../utils/TimeAgo";
import CreateCommunityDialog from "../components/CreateCommunityDialog";
import ProfileTabs from "../components/ProfileTabs";
import ProfileMobileCard from "../components/ProfileMobileCard";
import ProfileSidebar from "../components/ProfileSidebar";
import TimelineEvent, { parseTimestamp } from "../components/TimelineEvent";
import EditProfileDialog from "../components/EditProfileDialog";
import DeleteCommentModal from "../components/DeleteCommentModal";
import Timeline from "@material-ui/lab/Timeline";
import Fab from "@material-ui/core/Fab";
import PhotoCameraRounded from "@material-ui/icons/PhotoCameraRounded";
import AddAPhoto from "@material-ui/icons/AddAPhoto";

import { t, useLanguage } from "../utils/text";

// ── Deferred wallet import ─────────────────────────────────────────────
// Single loader shared by React.lazy and the idle prefetch below, so both
// resolve the SAME dynamic-import module-cache entry: warming the chunk on
// idle means the first real open hydrates instantly instead of suspending.
const loadWalletDialog = () => import("../components/PixaWalletDialog");
const LazyPixaWalletDialog = React.lazy(loadWalletDialog);

// ── Deferred create-post import ────────────────────────────────────────
// Same pattern as the wallet: NewPost (editor, uploader, AI pipeline UI)
// was the one heavyweight component still statically imported here, which
// chained it into Profile's chunk for every visitor — Feed/FeedPersonal
// already lazy-load it. One loader shared by React.lazy and the idle
// prefetch below keeps the first open instant on the user's own profile.
const loadNewPost = () => import("../components/NewPost");
const LazyNewPost = React.lazy(loadNewPost);

// ── Deferred post viewer + own-post dialogs ────────────────────────────
// PostDialog (recursive comment threads, vote lists, artwork rendering) was
// statically imported AND always mounted, so it sat in Profile's chunk and
// instantiated on every render even though most visits just browse the grid.
// Split it out and warm it on idle for everyone (opening a post is the most
// common next action) so the open-from-card transition isn't gated on a cold
// chunk fetch. Edit/Delete share one module, reached only from the card menu.
const loadPostDialog = () => import("../components/PostDialog");
const LazyPostDialog = React.lazy(loadPostDialog);
const loadOwnPostDialogs = () => import("../components/EditPostDialog");
const LazyEditPostDialog = React.lazy(loadOwnPostDialogs);
const LazyDeletePostDialog = React.lazy(() => loadOwnPostDialogs().then(m => ({ default: m.DeletePostDialog })));

// Suspense fallback for a lazily-loaded dialog — shown only on a cold open
// (chunk not yet cached, before idle-prefetch ran). A dim backdrop appears
// instantly so the action reads as "opening…" instead of a blank frame; the
// real dialog (with its own backdrop + open animation) replaces it the moment
// its chunk resolves. Warm opens never hit this.
const DIALOG_FALLBACK = (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1300 }} />
);


// ╔══════════════════════════════════════════════════════════════════════╗
// ║  1. STYLES                                                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

const styles = theme => ({
    root: { position: "absolute", width: "100%", height: "100%", display: "flex", overflow: "hidden" },
    viewLeft: { width: "100%", marginRight: "396px", position: "relative", [theme.breakpoints.down("sm")]: { marginRight: "0px" } },
    viewMobile: {
        display: "none",
        [theme.breakpoints.down("sm")]: {
            "& div.MuiPaper-rounded": { borderRadius: "0px", backgroundColor: "#151515" },
            zIndex: 9, display: "inline-block", transition: `transform ${TM}`, position: "fixed",
            width: "100%", minHeight: "72px", margin: "0px", animation: `$slideInFromTop ${TE}`,
            "@global": { "@keyframes slideInFromTop": slideKF('Y', -160) },
        },
    },
    mobileBackdrop: {
        display: "none",
        [theme.breakpoints.down("sm")]: {
            display: "block", position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.55)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)",
            zIndex: 8, pointerEvents: "auto", transition: `opacity ${TE}, filter ${TE}`,
        },
    },
    mobileBackdropHidden: { filter: "opacity(0)", pointerEvents: "none" },
    mobileBackdropVisible: { filter: "opacity(1)" },
    viewMobileCard: {
        borderRadius: "21px", boxShadow: "none", transition: `all ${TF}`,
        "& .MuiCardHeader-avatar": { margin: "-16px 16px -16px -16px" },
        "& .MuiCardHeader-title": { transition: `all ${TF}` },
        "& .MuiCardHeader-content": { width: "calc(100% - 104px)", transition: `all ${TF}` },
        "& .MuiCardHeader-subheader": { filter: "opacity(1)", transition: `all ${TF}`, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
        "& svg": { transition: `transform ${TF}` },
    },
    mainFab: {
        animation: `$slideInFromBottom ${TE}`,
        "@global": { "@keyframes slideInFromBottom": slideKF('Y', 160) },
        // Inset raises shown AND hidden states equally (0px off gesture-nav),
        // so the translateY choreography below needs no changes.
        position: "fixed", right: 380+32+8, bottom: "calc(env(safe-area-inset-bottom, 0px) - 64px)", zIndex: 1, transition: `transform ${TM}`,
        "& .MuiButtonBase-root": {
            borderRadius: "32px", background: "#f6f6f6", transform: "scale(1)",
            animationName: "$bounce-feed", animationTimingFunction: E, animationDuration: "3.2s",
            animationFillMode: "both", animationDelay: "1s", animationIterationCount: "infinite",
            boxShadow: "0 0 8px #ffffff88, 0 0 16px #ffffffcc",
            "@global": { "@keyframes bounce-feed": {
                    "0%": { boxShadow: "0 0 8px #ffffff88, 0 0 16px #ffffffcc", transform: "scale(1)" },
                    "3%": { boxShadow: "0 0 12px #ffffff88, 0 0 24px #ffffffcc", transform: "scale(1.05)" },
                    "6%": { boxShadow: "0 0 4px #ffffff88, 0 0 8px #ffffffcc", transform: "scale(0.975)" },
                    "9%": { boxShadow: "0 0 8px #ffffff88, 0 0 16px #ffffffcc", transform: "scale(1)" },
                }},
            transition: `background ${TM}`,
            "& .MuiTouchRipple-root": { filter: "opacity(1)", "& .MuiTouchRipple-child": { backgroundImage: `radial-gradient(circle at 50% 50%, magenta 0%, blue 20%, cyan 40%, green 60%, yellow 80%, red 100%)` } },
        },
        "& .MuiButtonBase-root:hover": { background: "#ffffff", boxShadow: "0 0 8px #ffffff88, 0 0 16px #ffffffcc" },
        "& .MuiTouchRipple-child": { backgroundImage: RIPPLE },
        "& .MuiFab-extended": { padding: "0 24px", height: 64, fontSize: "1.125rem" },
        "& .MuiFab-extended .MuiSvgIcon-root": { fontSize: "1.75rem" },
        [theme.breakpoints.down("sm")]: {
            bottom: "calc(env(safe-area-inset-bottom, 0px) - 88px)", right: "50%", transform: "translateX(50%)",
            "& .MuiButtonBase-root": { width: 64, height: 64 },
            "@global": { "@keyframes slideInFromBottom": { "0%": { transform: "translateX(50%) translateY(160px)", filter: "opacity(0)" }, "100%": { transform: "translateX(50%) translateY(0px)", filter: "opacity(1)" } } },
        },
    },
    viewMobileCardOpened: {
        borderRadius: "0px 0px 21px 21px", boxShadow: "0px 0px 16px 4px black", transition: `all ${TF}`, overflow: "visible",
        "& .MuiCardHeader-avatar": { margin: "-16px 16px -16px -16px" },
        "& .MuiCardHeader-title": { fontSize: "1.225rem", transition: `all ${TF}`, "& > span > span:last-child": { display: "block" } },
        "& .MuiCardHeader-content": { width: "calc(100% - 40px)", transition: `all ${TF}` },
        "& .MuiCardHeader-subheader": { filter: "opacity(0)", height: 0, transition: `all ${TF}`, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
        "& svg": { transition: `transform ${TF}` },
    },
    viewRight: {
        zIndex: 1, width: "374px", margin: "21px 16px", position: "absolute", right: 0, top: 0,
        height: "calc(100% - 42px)", boxSizing: "border-box", animation: `$slideInFromRight ${TE}`,
        "@global": { "@keyframes slideInFromRight": { "0%": { transform: "translateX(384px)", filter: "opacity(0)" }, "100%": { transform: "translateY(0px)", filter: "opacity(1)" } } },
        [theme.breakpoints.down("sm")]: { display: "none" }, display: "flex", flexDirection: "column", gap: "21px",
    },
    viewRightTopCard: { width: "100%", borderRadius: "32px", background: "#101010" },
    viewRightBottomCard: { paddingTop: 0, position: "relative", width: "100%", borderRadius: "32px", background: "#101010", flex: "1", display: "flex", flexDirection: "column", minHeight: 64 },
    profileImage: { borderRadius: "56px 0px 0px 56px", display: "block", width: "300px", height: "300px", backgroundPosition: "50% 50%", backgroundSize: "cover", transition: `height ${TF}` },
    profileImageMobile: { borderRadius: "0px 12px 12px 0px", display: "block", width: "72px", height: "72px", backgroundPosition: "50% 50%", backgroundSize: "cover", transition: `all ${TF}` },
    profileImageMobileOpened: { borderRadius: "8px", display: "block", width: "40px", height: "40px", margin: "-18px 16px -16px -72px", backgroundPosition: "50% 50%", backgroundSize: "cover", transition: `all ${TF}` },
    profileImageMobileBig: { borderRadius: "24px", display: "block", width: "160px", height: "160px", margin: "0px", backgroundPosition: "50% 50%", backgroundSize: "cover", transition: `all ${TF}` },
    mainTab: {
        animation: `$slideInFromTop ${TE}`, "@global": { "@keyframes slideInFromTop": slideKF('Y', -160) },
        [theme.breakpoints.down("sm")]: { animation: `$slideInFromBottom ${TE}`, "@global": { "@keyframes slideInFromBottom": slideKF('Y', 160) } },
        backgroundColor: "#101010", "& .MuiTab-root": { minWidth: "72px !important" },
        "& .MuiTab-textColorPrimary.Mui-selected": { backgroundColor: "transparent" },
        "& .MuiTab-textColorPrimary.Mui-selected .MuiTab-wrapper": { color: "#101010 !important" },
        "& .MuiTab-fullWidth": { backgroundColor: "transparent", color: "#989898", transition: `all 225ms ${E} 0ms`, borderRadius: "21px" },
        "& .MuiTab-fullWidth:hover": { backgroundColor: "rgba(255,255,255,0.06)" },
        "& span.MuiTabs-indicator": { zIndex: "-1", height: "48px", backgroundColor: "#c7c7c7", borderRadius: "21px", transform: "scale3d(0.875, 0.75, 1)" },
        margin: "21px 16px 16px 16px", width: "calc(100% - 32px)", borderRadius: "21px", position: "absolute", left: 0, zIndex: 1, transition: `transform ${TM}`,
    },
    followButtons: { display: "flex", gap: "16px", justifyContent: "center", padding: "16px 32px", "& .MuiButtonGroup-groupedContainedHorizontal:not(:last-child)": { borderRight: "1px solid #000" }, "& .MuiButtonGroup-groupedHorizontal": { borderRadius: "32px", color: "rgb(183 183 183)", backgroundColor: "#1e1e1e", "&:hover": { color: "rgb(220 220 220)", backgroundColor: "#212121" } } },
    followButtonsMobile: { width: "100%", display: "flex", flexFlow: "column", gap: "16px", justifyContent: "center", padding: "16px 16px", "& .MuiButtonGroup-groupedContainedHorizontal:not(:last-child)": { borderRight: "1px solid #000" }, "& .MuiButtonGroup-root": { display: "block" }, "& .MuiButtonGroup-groupedHorizontal": { borderRadius: "32px", marginBottom: "12px", color: "rgb(183 183 183)", backgroundColor: "#1e1e1e", "&:hover": { color: "rgb(220 220 220)", backgroundColor: "#212121" } } },
    communityListItem: { "& .MuiListItemAvatar-root": { minWidth: 64 }, "& .MuiAvatar-root": { width: 48, height: 48, borderRadius: "14px" } },
    communityBadge: { "& .MuiBadge-badge": { right: "24px !important" } },
    communityChip: { opacity: "0.75", height: "21px", backgroundColor: "#2b2b2b", color: "#aaa", "& > svg.MuiChip-iconSmall": { color: "#777", width: "15px", height: "15px" }, "& > span.MuiChip-labelSmall": { fontSize: "12px" } },
    votingPower: { width: "100%", display: "flex", flexWrap: "nowrap", gap: "16px", justifyContent: "center", padding: "0px 16px 0px 16px", userSelect: "none", [theme.breakpoints.down("sm")]: { width: "100%" }, "& .MuiBox-root > .MuiBox-root ~.MuiTypography-colorTextSecondary": { marginTop: "8px" }, "& .MuiBox-root > .MuiBox-root > .MuiCircularProgress-colorPrimary": { color: "#333", transition: `color 175ms ${E} 0ms`, cursor: "pointer" }, "& .MuiBox-root:hover > .MuiBox-root > .MuiBox-root > .MuiCircularProgress-colorPrimary": { color: "#ccc", transition: `color 175ms ${E} 175ms` }, "& .MuiTypography-colorTextSecondary": { fontSize: "11.5px !important", color: "#fff !important", textAlign: "center" } },
    walletMobileButton: { width: 72, height: 72, marginTop: -32, "& svg": { width: "1.125em", height: "1.125em" }, transition: `color ${TF}, background-color ${TF}`, color: "#101010", backgroundColor: "#c7c7c7", "&:hover": { color: "#000", backgroundColor: "#fff", transition: `color 225ms ${E} 125ms, background-color 225ms ${E} 125ms` }, "& .MuiTouchRipple-child": { backgroundImage: RIPPLE } },
    whiteButton: { "&.MuiIconButton-root": { color: "#b5b5b5", background: "#1e1e1e", transition: `background-color 250ms ${E} 0ms, box-shadow 250ms ${E} 0ms, border 250ms ${E} 0ms, color 250ms ${E} 0ms` }, "&.MuiIconButton-root:hover": { color: "#c7c7c7", background: "#212121" } },
    whiteDiscreteButton: { "&.MuiButton-contained": { backgroundColor: "#D0D0D010", color: "#999999", transition: `background-color 250ms ${E} 0ms, box-shadow 250ms ${E} 0ms, border 250ms ${E} 0ms, color 250ms ${E} 0ms` }, "&.MuiButton-contained:hover": { backgroundColor: "#D0D0D016", color: "#ffffff" } },
    walletButtons: { float: "left", margin: "16px 0px 16px 16px", width: "42px", display: "flow", flexFlow: "column", alignContent: "center" },
    walletMobileButtons: { height: 0, padding: "0px 16px", backgroundColor: "transparent", borderRadius: "0px 0px 16px 16px", textAlign: "center" },
    masonryTimeline: { paddingTop: "16px !important", "& > .ReactVirtualized__Masonry": { paddingLeft: "0px !important", paddingRight: "396px !important", [theme.breakpoints.down("sm")]: { paddingRight: "0px !important" }, "& > .ReactVirtualized__Masonry__innerScrollContainer": { "& div": { textAlign: "end", zIndex: "1" }, "& .MuiPaper-root": { zIndex: 1 }, "& .MuiTimelineSeparator-root": { zIndex: 0 }, "& .MuiTimelineOppositeContent-root": { flex: "0" }, [theme.breakpoints.down("sm")]: { "& .MuiTimelineOppositeContent-root": { display: "none" } } } } },
    masonry: { overflow: "hidden overlay !important", contain: "style layout", "& > .ReactVirtualized__Masonry": { zIndex: 0, position: "absolute", margin: 0, scrollBehavior: "smooth", overscrollBehavior: "none", boxSizing: "content-box !important", willChange: "scroll-position !important", touchAction: "pan-y", overflow: "hidden overlay !important", padding: "86px 380px 32px 16px", [theme.breakpoints.down("sm")]: { padding: "100px 16px 32px 16px", width: "calc(100% - 32px)" }, contain: "style layout size", "& > .ReactVirtualized__Masonry__innerScrollContainer": { top: "auto !important", left: "auto !important", overflow: "initial !important", position: "absolute !important", paddingBottom: "144px", boxSizing: "content-box", contain: "style layout size", "& div": { contain: "style layout" } } } },
    inline: { display: 'inline' },
    emptyState: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", fallbacks: { minHeight: "calc(100vh - 200px)" }, minHeight: "calc(100dvh - 200px)", padding: "48px 24px", textAlign: "center", userSelect: "none", animation: `$fadeIn 600ms ${E} 0ms`, "@global": { "@keyframes fadeIn": { "0%": { filter: "opacity(0)", transform: "translateY(24px)" }, "100%": { filter: "opacity(1)", transform: "translateY(0px)" } } } },
    emptyStateIcon: { width: 96, height: 96, borderRadius: "32px", backgroundColor: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, "& svg": { width: 48, height: 48, color: "#444" } },
    emptyStateTitle: { fontFamily: '"Industry Book", "Normative Pro", sans-serif', fontSize: "1.375rem", fontWeight: "bold", color: "#c7c7c7", marginBottom: 8 },
    emptyStateSubtitle: { fontSize: "0.925rem", color: "#666", maxWidth: 360, lineHeight: 1.5 },
    menuButton: { display: "block", position: "fixed", zIndex: 1, width: 80, height: 80, transform: "translate(calc(50% - 21px), calc(-50% + 8px))", transition: `color ${TF}, background-color ${TF}`, color: "#101010", backgroundColor: "#c7c7c7", boxShadow: "0 0 8px #c7c7c788, 0 0 16px #c7c7c7cc", "&:hover": { color: "#101010", backgroundColor: "#fff", boxShadow: "0 0 8px #ffffff88, 0 0 16px #ffffffcc" }, "& svg": { width: "1.375em", height: "1.375em" }, "& .MuiTouchRipple-child": { backgroundImage: RIPPLE } },
    menuButtonEdit: { position: "absolute", top: 16, right: 16, backgroundColor: "#000", color: "#fff", transition: `color 175ms ${E} 5ms, background-color 175ms ${E} 5ms`, "&:hover": { backgroundColor: "#171717", color: "#c7c7c7" } },
    cardTabs: { backgroundColor: "#1e1e1e", "& .MuiTab-root": { minWidth: "72px !important" }, "& .MuiTab-textColorPrimary.Mui-selected": { backgroundColor: "transparent" }, "& .MuiTab-textColorPrimary.Mui-selected .MuiTab-wrapper": { color: "#171717 !important" }, "& .MuiTab-fullWidth": { backgroundColor: "transparent", color: "#989898", transition: `all 225ms ${E} 0ms`, borderRadius: "21px" }, "& .MuiTab-fullWidth:hover": { backgroundColor: "rgba(255,255,255,0.06)" }, "& span.MuiTabs-indicator": { zIndex: "-1", height: "48px", backgroundColor: "#c7c7c7", borderRadius: "21px", transform: "scale3d(0.875, 0.75, 1)" }, margin: "16px 16px 0px 16px", width: "calc(100% - 32px)", borderRadius: "21px", position: "absolute", top: 0, left: 0, zIndex: 1, transition: `transform 300ms ${E} 0ms` },
    metadataSwipeableViews: { padding: "72px 16px 4px 16px", overflow: "overlay", height: "100%", [theme.breakpoints.down("sm")]: { paddingTop: "0px !important" } },
    communitiesTitle: {}, communitiesDescription: {},
    metaListHeader: { color: "#ebebeb", backgroundColor: "#66666630", borderRadius: "21px", marginTop: 8, marginBottom: 8 },
    timelineSeparator: { zIndex: "0 !important" },
    timelineEventPaper: { padding: '12px 16px', backgroundColor: "#1a1a1a", borderRadius: "21px", display: "inline-block" },
    timelineEventTitle: { fontFamily: '"Industry Book"', fontSize: "14px", fontWeight: "bold", color: "#ccc", marginBottom: "4px" },
    timelineEventDescription: { fontSize: "12px", color: "#aaa", lineHeight: "1.4" },
    timelineEventTime: { fontSize: "11px", color: "#777", margin: "4px 16px" },
    timelineDot: {
        backgroundColor: "#000 !important",
        boxShadow: "0 0 8px #0000004d !important",
        color: "#999",
        cursor: "pointer",
        marginTop: 6,
        marginBottom: 6,
        borderRadius: "21px",
        // The ::before pseudo-element is the short horizontal "ear" bridging
        // the dot to the card. Its height now matches the connector width (6px)
        // so the joinery looks continuous.
        "&::before": { content: '""', width: "64px", position: "absolute", backgroundColor: "#000000", height: "6px", top: "21px", right: "9px", borderRadius: "3px", zIndex: "-1" },
        // Scope the MuiSvgIcon-root tweak to icons inside the timeline dot so it
        // doesn't bleed into the rest of the app (where icons have their own
        // sizing). fill: currentColor + 6px padding gives the dot an even ring.
        "& .MuiSvgIcon-root": { fill: "currentColor", width: "1em", height: "1em", padding: "6px", fontSize: "1.25rem" },
        [theme.breakpoints.down("sm")]: {}
    },
    // Connector is the vertical line between dots. Wider (6px) + rounded (3px)
    // so it reads as the same visual element as the dot's ::before ear.
    timelineConnector: { width: "6px", backgroundColor: "#000000", borderRadius: "3px" },
    // Inline clickable username inside a timeline title. Mirrors the link
    // affordance used elsewhere in the profile (cursor pointer + subtle hover).
    timelineUsername: { cursor: "pointer", color: "#fff", "&:hover": { textDecoration: "underline" } },
    // Inline clickable post reference (permlink/title) inside the description.
    timelinePostLink: { cursor: "pointer", color: "#ccc", "&:hover": { textDecoration: "underline", color: "#fff" } },
    timelineContainer: { "&.MuiTimeline-root": { padding: 0, margin: 0, marginBlock: 0 }, "& .MuiTimelineItem-root": { minHeight: "107px !important", contain: "layout style", "&:before": { flex: 0, padding: 0 } }, "& .MuiTimelineItem-missingOppositeContent:before": { display: "none" }, "& .MuiTimelineContent-root": { paddingTop: 0, paddingBottom: "16px" }, "& .MuiTimelineOppositeContent-root": { display: "none" } },
});


// ╔══════════════════════════════════════════════════════════════════════╗
// ║  2. PURE HELPERS (unchanged logic)                                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

const TAB_NAMES = ['posts', 'comments', 'replies', 'history'];
const WALLET_VIEW_NAMES = ['power', 'pixa', 'supra', 'history'];

const parseProfilePathname = (pathname) => {
    let s = String(pathname || '').trim();
    try { s = decodeURIComponent(s); } catch {}
    s = s.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, '');
    const qi = s.indexOf('?'); if (qi !== -1) s = s.slice(0, qi);
    const hi = s.indexOf('#'); if (hi !== -1) s = s.slice(0, hi);
    s = s.replace(/\/{2,}/g, '/');
    if (!s.startsWith('/')) s = '/' + s;
    const m = s.match(/^\/@([a-z0-9\.\-]+)(\/(posts|comments|replies|history))?(\/(followers|following|wallet)(\/(overview|power|pixa|supra|history))?)?/);
    if (m) return { username: m[1] || '', tab: m[3] || 'posts', modal: m[5] || '', walletView: m[7] || 'overview' };
    // The loose `/@<name>/` match is the source of truth for username
    // extraction on community-post URLs and any other URL that mentions an
    // account. It runs BEFORE `parsePostUrl` — that helper is owned by
    // ../utils/constants and is allowed to throw, return null, or return a
    // shape we don't expect; the loose regex is local, deterministic, and
    // can't fail. If neither matches, fall back to parsePostUrl as a last
    // resort (wrapped in try/catch so an exception there never strands the
    // username at '').
    const loose = s.match(/\/@([a-z0-9\.\-]+)(?:\/|$)/);
    if (loose) return { username: loose[1], tab: 'posts', modal: '', walletView: 'overview' };
    try {
        const p = parsePostUrl(s);
        if (p && p.author) return { username: p.author, tab: 'posts', modal: '', walletView: 'overview' };
    } catch {}
    return { username: '', tab: 'posts', modal: '', walletView: 'overview' };
};

const walletViewToTabValue = (v) => ({ power: 0, pixa: 1, supra: 2, history: 3 }[v] ?? false);
const tabValueToWalletView = (v) => ['power', 'pixa', 'supra', 'history'][v] || 'overview';

const buildProfileUrl = (username, tab, modal, walletView) => {
    // No username → don't build a broken URL like `/@` or `/@/comments`.
    // Returning null lets callers detect this and bail (skip the navigation
    // rather than push a URL that won't parse back to anything resolvable,
    // which would strand the user on a route that no PAGE_ROUTES regex
    // matches and leaves `parsed.username` empty for every subsequent render).
    if (!username) return null;
    let url = `/@${username}`;
    if (tab && tab !== 'posts') url += `/${tab}`;
    if (modal) { url += `/${modal}`; if (modal === 'wallet' && walletView && walletView !== 'overview') url += `/${walletView}`; }
    return url;
};

const parsePayout = (raw) => parseFloat((raw || '0').replace(/[^0-9.\-]/g, '')) || 0;
const resolveDisplayName = (account, fallback) => { const dn = account._profile && account._profile.display_name; return (typeof dn === 'string' && dn.trim()) || account.name || fallback || ''; };

// ── Blur-aware sibling walk (dialog prev/next) — see Feed.js ───────────
// PaperCard owns the "is this card blurred" truth (author/server NSFW flag
// OR the on-device detector's cached verdict, honoured only while the
// user's "show NSFW" toggle is off); prev/next skips exactly those cards
// and an arrow only renders when the walk can land somewhere. The posts
// grid's measurer is keyed by item.id, so the card id equals the post id.
const isSamePost = (p, cur) => !!p && !!cur
    && p.permlink === cur.permlink
    && (p.author?.username || p.author) === (cur.author?.username || cur.author);

const findNavigableIndex = (list, from, dir, nsfwEnabled, getPost) => {
    for (let i = from + dir; i >= 0 && i < list.length; i += dir) {
        const p = getPost ? getPost(list[i]) : list[i];
        if (p && !isArtworkBlurred(p, p.id, nsfwEnabled)) return i;
    }
    return -1;
};

// ── Parsed-metadata cache ───────────────────────────────────────────────
// json_metadata is consulted several times per post (NSFW here, the deleted
// flag, hydration) and AGAIN in the deferred voter-profile pass of every
// tab loader, which re-maps the SAME raw objects to patch avatars in. One
// WeakMap-cached parse per raw object; an edited post arrives as a NEW
// object from the node, so staleness is impossible. See Feed.js.
const JSON_META_CACHE = new WeakMap();
const getJsonMeta = (post) => {
    if (!post || typeof post !== 'object') return {};
    const raw = post.json_metadata;
    if (!raw) return {};
    if (typeof raw !== 'string') return raw;
    let meta = JSON_META_CACHE.get(post);
    if (meta === undefined) {
        try { meta = JSON.parse(raw) || {}; } catch { meta = {}; }
        JSON_META_CACHE.set(post, meta);
    }
    return meta;
};

// A post can declare NSFW via the "nsfw" tag or a top-level json_metadata
// boolean. Consumers must consult both signals or metadata-only NSFW posts
// slip through unblurred. Tag matching is case-insensitive.
const isNsfwPost = (post) => {
    const tags = post?._tags || [];
    if (tags.some(t => typeof t === 'string' && t.toLowerCase() === 'nsfw')) return true;
    const meta = getJsonMeta(post);
    if (meta && (meta.nsfw === true || meta.nsfw === 'true' || meta.nsfw === 1)) return true;
    const metaTags = (meta && Array.isArray(meta.tags)) ? meta.tags : [];
    return metaTags.some(t => typeof t === 'string' && t.toLowerCase() === 'nsfw');
};

// Soft-deleted content (meta.deleted set by the edit flow — a metadata
// flag, never a tag). Filtered out unconditionally — see Feed.js.
// isDeletedPost now lives in utils/constants. Feed, FeedPersonal, Profile and
// Community each carried a byte-identical private copy, and the two full-view
// dialogs need the same predicate against the enriched card shape. One
// definition, no drift.

// ── Root category / content type ───────────────────────────────────────
// A post's URL segment is NOT cosmetic: `hostPageForPostUrl` in constants
// routes `/portal-N/@a/p` to <Community> + <BlogPostDialog> and everything
// else to <Feed>/<Profile> + <PostDialog>. Get the segment wrong and a blog
// post opens in the artwork viewer — or, when nothing resolves at all,
// `buildPostUrl` falls through to its "general" placeholder and the link
// lands nowhere.
//
// On chain the category of a ROOT post is its `parent_permlink` (the
// community for a blog post, the first tag for a pixel art), and every
// comment beneath it inherits that same `category`. Both are read here so a
// blank `category` on a sanitised payload can't silently degrade to
// "general".
//
// NOTE the deliberate divergence from `isCommunityPermlink` below, which
// also accepts `pixa-N`: only `portal-N` is a routable community segment
// (COMMUNITY_TAG_REGEX is what the router itself tests), so URL decisions
// use the regex and the timeline's cosmetic blog/art labelling keeps its
// wider match.
const isCommunityCategory = (s) => COMMUNITY_TAG_REGEX.test(typeof s === 'string' ? s : '');

// Walk a comment's parent links up to its thread root. Timeline references
// can point at a COMMENT (a vote on one, a reply, a curation reward) just as
// well as at a root post — and only root posts have URLs. Returns the root's
// author/permlink plus its category (for a root, `parent_permlink` IS the
// category: the community for a blog post, the first tag for a pixel art),
// or null when the chain can't be resolved. A root reference resolves in one
// fetch; sanitized content that already names root_author/root_permlink
// shortcuts deeper chains to two.
const resolveThreadRoot = async (commentApi, author, permlink) => {
    if (!commentApi || !commentApi.content || !author || !permlink) return null;
    let a = author, p = permlink, content = null;
    for (let hops = 0; hops < 12; hops++) {
        content = await commentApi.content.getContent(a, p);
        if (!content || !content.permlink) return null;
        if (!content.parent_author) break; // reached the thread root
        if (content.root_author && content.root_permlink
            && (content.root_author !== a || content.root_permlink !== p)) {
            a = content.root_author; p = content.root_permlink; // jump straight to it
        } else {
            a = content.parent_author; p = content.parent_permlink || "";
        }
        if (!p) return null;
    }
    if (content.parent_author) return null; // never reached a root
    const category = content.category || content.parent_permlink || "";
    return { author: a, permlink: p, category };
};

// Category of the root post a raw chain object belongs to. Read in order:
//
//   1. `category` — a root post's own, and the one every comment beneath it
//      inherits. Authoritative whenever it survives the payload.
//   2. the leading segment of `url` (`/category/@rootAuthor/rootPermlink…`,
//      with the commenter's own anchor appended on a comment). Validated
//      rather than split blindly, because pixaproxyapi's sanitizer fabricates
//      a segment-less `/@author/permlink` when it can't verify the real one —
//      the same shape that broke stored favorites.
//   3. `parent_permlink`, but ONLY on a root post.
//
// That last restriction is the whole point. `parent_permlink` is the category
// exclusively when `parent_author` is empty, i.e. the object IS a root post.
// On a comment it is the PARENT's permlink: the post's permlink for a
// top-level comment, the parent comment's for a nested reply. Reading it
// unconditionally makes every comment on a blog post resolve to a permlink
// instead of `portal-N` — which reads back as an artwork, and would build a
// URL pointing at nothing.
//
// A `portal-N` parent_permlink is accepted regardless: only a root post can
// have one, so its presence is proof on its own.
const resolveRootCategory = (raw) => {
    if (!raw) return '';
    if (raw.category) return raw.category;
    const m = typeof raw.url === 'string' ? raw.url.match(/^\/([a-z0-9\-]+)\/@/) : null;
    if (m) return m[1];
    const pp = raw.parent_permlink || '';
    if (COMMUNITY_TAG_REGEX.test(pp)) return pp;
    return raw.parent_author ? '' : pp;
};

// The rule, in full: anything inside a portal is a blog post, everything else
// is an artwork. The third state matters — '' means the payload carried no
// resolvable category at all, and a card that can't tell shows no chip rather
// than asserting the wrong one.
const resolveContentType = (raw) => {
    const cat = resolveRootCategory(raw);
    if (!cat) return '';
    return isCommunityCategory(cat) ? 'blog' : 'pixel_art';
};

const enrichPostForCard = (post, account, voterProfiles) => {
    const pp = parsePayout(post.pending_payout_value), tp = parsePayout(post.total_payout_value), cp = parsePayout(post.curator_payout_value);
    const payout = pp > 0 ? pp : tp + cp;
    const tags = post._tags || [], images = post._images || [], activeVotes = post.active_votes || [];
    const fi = images[0] ?? null;
    return {
        id: post._entity_id || post.id || `${post.author}_${post.permlink}`,
        author: { username: account.name || '', name: resolveDisplayName(account), image: account.image || account._profile?.profile_image || '' },
        title: post.root_title || post.title || '', image: fi ? (typeof fi === 'string' ? fi : fi.src) : null,
        date: post.created ? new Date(post.created).getTime() : Date.now(), payout: `$${payout.toFixed(2)}`,
        upVotesNumber: Math.max(0, post.net_votes || activeVotes.filter(v => v?.weight >= 0).length || 0),
        downVotesNumber: Math.max(0, activeVotes.filter(v => v?.weight < 0).length || 0),
        active_votes: activeVotes, _voter_profiles: voterProfiles || {}, nsfw: isNsfwPost(post), deleted: isDeletedPost(post), tags,
        permlink: post.permlink || '', category: resolveRootCategory(post), _content_type: post._content_type || resolveContentType(post) || 'pixel_art',
        _description_html: post._description_html || '', _summary: post._summary || '', json_metadata: post.json_metadata || '',
        children: post.children ?? 0, commentsNumber: post.children ?? 0,
    };
};

const enrichCommentForCard = (comment, account, index, voterProfiles) => {
    const pp = parsePayout(comment.pending_payout_value), tp = parsePayout(comment.total_payout_value), cp = parsePayout(comment.curator_payout_value);
    const payout = pp > 0 ? pp : tp + cp;
    const activeVotes = comment.active_votes || [];
    return {
        id: comment._entity_id || comment.id || `comment_${index}`,
        date: comment.created ? new Date(comment.created).getTime() : Date.now(), body: comment.body || '',
        title: comment.root_title || comment.parent_permlink || '',
        author: { username: account.name || '', name: resolveDisplayName(account), image: account.image || account._profile?.profile_image || '' },
        payout: `$${payout.toFixed(2)}`,
        upVotesNumber: Math.max(0, comment.net_votes || activeVotes.filter(v => v?.weight >= 0).length || 0),
        downVotesNumber: Math.max(0, activeVotes.filter(v => v?.weight < 0).length || 0),
        active_votes: activeVotes, _voter_profiles: voterProfiles || {},
        permlink: comment.permlink || '', parent_author: comment.parent_author || '', parent_permlink: comment.parent_permlink || '',
        root_author: comment.root_author || '', root_permlink: comment.root_permlink || '', category: resolveRootCategory(comment),
        // Type of the ROOT this comment hangs under — what the title links to,
        // and what the card's chip announces.
        _content_type: resolveContentType(comment),
        children: comment.children ?? 0, commentsNumber: comment.children ?? 0,
    };
};

const transformRepliesToCardFormat = (rawReplies, profileOwnerAccount, voterProfiles, fetchedAccounts) => {
    if (!Array.isArray(rawReplies)) return [];
    const accountByName = {};
    if (profileOwnerAccount?.name) accountByName[profileOwnerAccount.name] = profileOwnerAccount;
    if (Array.isArray(fetchedAccounts)) fetchedAccounts.forEach(a => { if (!a) return; const n = a.name || a._entity_id; if (n) { a.image = a.image || a._profile?.profile_image || ''; accountByName[n] = a; } });
    const resolve = (u) => accountByName[u] || { name: u, image: '', _profile: null };
    return rawReplies.map((r, i) => {
        const pp = parsePayout(r.pending_payout_value), tp = parsePayout(r.total_payout_value), cp = parsePayout(r.curator_payout_value);
        const payout = pp > 0 ? pp : tp + cp; const activeVotes = r.active_votes || [];
        const ra = resolve(r.author || ''), pa = resolve(r.parent_author || '');
        return {
            id: r._entity_id || r.id || `reply_${i}`, date: r.created ? new Date(r.created).getTime() : Date.now(),
            body: r.body || '', title: r.root_title || r.parent_permlink || '',
            author: { username: ra.name || r.author, name: resolveDisplayName(ra, r.author), image: ra.image || ra._profile?.profile_image || '' },
            replyTo: { username: pa.name || r.parent_author, name: resolveDisplayName(pa, r.parent_author), image: pa.image || pa._profile?.profile_image || '' },
            payout: `$${payout.toFixed(2)}`,
            upVotesNumber: Math.max(0, r.net_votes || activeVotes.filter(v => v?.weight >= 0).length || 0),
            downVotesNumber: Math.max(0, activeVotes.filter(v => v?.weight < 0).length || 0),
            active_votes: activeVotes, _voter_profiles: voterProfiles || {}, originalComment: '',
            permlink: r.permlink || '', parent_author: r.parent_author || '', parent_permlink: r.parent_permlink || '',
            root_author: r.root_author || '', root_permlink: r.root_permlink || '', category: resolveRootCategory(r),
            _content_type: resolveContentType(r),
        };
    }).sort((a, b) => b.date - a.date);
};

// ── Timeline parser ────────────────────────────────────────────────────
// Detect if a parent_permlink is a community (pixa-NNN or portal-NNN style) vs a
// plain tag/category (e.g. "woman", "space", "clown"). Community → blog post;
// plain tag → pixel-art post. The leading 'hive-' style numeric-suffix community
// convention is preserved here under the 'pixa-'/'portal-' prefixes.
const isCommunityPermlink = (s) => typeof s === 'string' && /^(pixa|portal)-\d+$/.test(s);

const parseAccountHistoryToTimeline = (historyOps, username) => {
    if (!Array.isArray(historyOps)) return [];
    const events = [];
    for (let i = 0; i < historyOps.length; i++) {
        const entry = historyOps[i]; if (!entry || !Array.isArray(entry) || entry.length < 2) continue;
        const [opIndex, trx] = entry; if (!trx?.op || !Array.isArray(trx.op) || trx.op.length < 2) continue;
        // Stable globally-unique id. Block coordinates alone are NOT unique:
        // virtual ops (curation/author rewards, payout updates, account_created,
        // fill_order…) share trx_in_block (0xFFFFFFFF) and op_in_trx (0) inside
        // a block and are only told apart by `virtual_op` — and the previous
        // timestamp tiebreaker was dead code (`trx.timestamp | 0` on a string
        // is always 0) — so every same-block virtual-op burst collapsed to a
        // single id: duplicate Masonry React keys (misplaced / overlapping
        // rows) and false dedup hits in loadMoreTimeline. The account-history
        // sequence number (opIndex) is unique and stable per account, so
        // including it makes collisions impossible. Sorting still happens by
        // timestamp; the id is only for React keys + dedup. _histIndex stays
        // as the sort tiebreaker and the fallback pagination cursor.
        const blk = trx.block|0, tib = trx.trx_in_block|0, oit = trx.op_in_trx|0, vop = trx.virtual_op|0;
        const evId = `b${blk}_t${tib}_o${oit}_v${vop}_h${opIndex|0}`;
        const [opType, d] = trx.op; let ev = { id: evId, _histIndex: opIndex|0, timestamp: trx.timestamp || '' };
        switch (opType) {
            case 'vote':
                // For incoming votes the post is by the profile owner. For outgoing
                // votes the post is by d.author. In either case carry postAuthor +
                // postPermlink so the UI can navigate to the post on click.
                if (d.voter === username) {
                    ev.type = "outgoing_vote";
                    ev.author = d.author||''; ev.postAuthor = d.author||''; ev.postPermlink = d.permlink||'';
                    ev.postTitle = d.permlink||''; ev.strength = Math.abs(d.weight||0)/100;
                    ev.voteType = (d.weight||0)<0?"down":"up";
                } else {
                    ev.type = "incoming_vote";
                    ev.voter = d.voter||''; ev.postAuthor = username; ev.postPermlink = d.permlink||'';
                    ev.postTitle = d.permlink||''; ev.strength = Math.abs(d.weight||0)/100;
                    ev.voteType = (d.weight||0)<0?"down":"up";
                }
                break;
            case 'comment':
                if (!d.parent_author || d.parent_author === '') {
                    // Top-level post by the profile owner. The title field on a
                    // comment_operation is the human-readable title — we keep it
                    // alongside the permlink (used for the URL) so the timeline
                    // can show the title but still navigate to the post.
                    ev.type = "post_created";
                    ev.title = d.title || d.permlink || '';
                    ev.postAuthor = d.author||username;
                    ev.postPermlink = d.permlink||'';
                    // parent_permlink for a top-level post is the community
                    // ("pixa-…") for a blog post, or a tag ("woman", "space") for
                    // a pixel-art post — see isCommunityPermlink.
                    ev.community = d.parent_permlink || '';
                    ev.isBlog = isCommunityPermlink(d.parent_permlink);
                    ev.contentType = ev.isBlog ? "blog" : "art";
                } else {
                    ev.type = "comment_created";
                    ev.author = d.parent_author||''; ev.postAuthor = d.parent_author||''; ev.postPermlink = d.parent_permlink||'';
                    ev.postTitle = d.parent_permlink||'';
                    ev.commentPreview = (d.body||'').slice(0,120);
                }
                break;
            case 'transfer': if (d.from === username) { ev.type = "outgoing_transfer"; ev.to = d.to||''; } else { ev.type = "incoming_transfer"; ev.from = d.from||''; } ev.amount = d.amount||'0'; ev.currency = (d.amount||'').includes('PXS')?'PXS':'PIXA'; ev.memo = d.memo||''; break;
            case 'curation_reward': ev.type = "curation_reward"; ev.pxp = d.reward||'0'; ev.pxs = '0'; ev.usdValue = '0'; ev.postAuthor = d.comment_author||''; ev.postPermlink = d.comment_permlink||''; ev.postTitle = d.comment_permlink||''; break;
            case 'author_reward': ev.type = "curation_reward"; ev.pxp = d.vesting_payout||'0'; ev.pxs = d.pxs_payout||d.sbd_payout||'0'; ev.usdValue = '0'; ev.postAuthor = d.author||username; ev.postPermlink = d.permlink||''; ev.postTitle = d.permlink||''; break;
            case 'limit_order_create': case 'fill_order': ev.type = "market_order"; ev.fromCurrency = (d.amount_to_sell||'').includes('PXS')?'PXS':'PIXA'; ev.toCurrency = ev.fromCurrency==='PIXA'?'PXS':'PIXA'; ev.fromAmount = d.amount_to_sell||d.current_pays||'0'; ev.toAmount = d.min_to_receive||d.open_pays||'0'; break;
            case 'claim_reward_balance': ev.type = "curation_reward"; ev.pxp = d.reward_vests||d.reward_pixa||'0'; ev.pxs = d.reward_pxs||'0'; ev.usdValue = '0'; ev.postTitle = 'Reward claim'; break;
            case 'transfer_to_vesting': ev.type = "outgoing_transfer"; ev.to = d.to||username; ev.amount = d.amount||'0'; ev.currency = 'PIXA'; ev.memo = 'Power Up'; break;
            case 'account_create': ev.type = "account_create"; ev.creator = d.creator||''; ev.newAccount = d.new_account_name||''; ev.fee = d.fee||'0'; ev.memo = d.json_metadata||''; break;
            case 'account_created': ev.type = "account_created"; ev.creator = d.creator||''; ev.newAccount = d.new_account_name||''; ev.initialDelegation = d.initial_delegation||'0'; ev.initialVestingShares = d.initial_vesting_shares||'0'; break;
            case 'account_update2': ev.type = "profile_update"; ev.account = d.account||username; ev.postingJsonMetadata = d.posting_json_metadata||''; ev.jsonMetadata = d.json_metadata||''; break;
            case 'comment_payout_update': ev.type = "payout_update"; ev.author = d.author||''; ev.postAuthor = d.author||''; ev.postPermlink = d.permlink||''; ev.postTitle = d.permlink||''; ev.title = d.permlink||''; break;
            case 'delegate_vesting_shares':
                // The amount field on a delegate_vesting_shares op already includes
                // its unit (e.g. "50.000000 VESTS"). Renderer used to print
                // `${amount} ${currency}` which produced "VESTS VESTS". Strip the
                // numeric portion into `amount`, leave currency empty so the
                // renderer just prints "Sent 50 VESTS".
                if (d.delegator === username) { ev.type = "outgoing_transfer"; ev.to = d.delegatee||''; }
                else { ev.type = "incoming_transfer"; ev.from = d.delegator||''; }
                ev.amount = d.vesting_shares||'0';
                ev.currency = ''; // amount already carries the unit
                ev.memo = 'Delegation';
                break;
            default: continue;
        }
        events.push(ev);
    }
    // Primary key: timestamp (newest first). Secondary key: account-history
    // index (newest = higher index). When two ops share a timestamp (e.g. a
    // vote → unvote → revote burst in one block, or virtual ops backfilled
    // at the same chain time), the _histIndex tiebreaker keeps the order
    // deterministic and consistent with chain-time ordering.
    return events.sort((a, b) => {
        const dt = parseTimestamp(b.timestamp) - parseTimestamp(a.timestamp);
        if (dt !== 0) return dt;
        return (b._histIndex|0) - (a._histIndex|0);
    });
};

const fetchVoterProfiles = async (items, account, api) => {
    const allVotes = items.flatMap(item => item.active_votes || []);
    const uniqueVoters = [...new Set(allVotes.map(v => v?.voter).filter(Boolean))];
    const profiles = {}; if (account?.name) profiles[account.name] = account.image;
    if (uniqueVoters.length > 0 && api?.accounts) {
        try { const accs = await api.accounts.getAccounts(uniqueVoters); if (Array.isArray(accs)) accs.forEach(a => { if (!a) return; const n = a.name||a._entity_id; if (n) profiles[n] = a._profile?.profile_image||''; }); } catch {}
    }
    return profiles;
};

const applyVoteToPost = (post, permlink, voter, weight) => {
    if (!post || post.permlink !== permlink) return post;
    let nv = (post.active_votes||[]).filter(v => v?.voter !== voter);
    if (weight !== 0) nv.push({ voter, weight, rshares: '0', time: new Date().toISOString() });
    return { ...post, active_votes: nv, upVotesNumber: Math.max(0, nv.filter(v => v?.weight >= 0).length), downVotesNumber: Math.max(0, nv.filter(v => v?.weight < 0).length) };
};

// ── Content hydration for comments ─────────────────────────────────────
const hydrateContent = (content) => {
    if (content._images && content._tags) return content;
    const meta = getJsonMeta(content);
    if (!content._images) {
        const body = content.body || '', imgs = [];
        let m; const re1 = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
        while ((m = re1.exec(body)) !== null) imgs.push({ src: m[1], alt: '', is_base64: m[1].startsWith('data:'), index: imgs.length });
        if (!imgs.length) { const re2 = /!\[([^\]]*)\]\(([^)]+)\)/g; while ((m = re2.exec(body)) !== null) imgs.push({ src: m[2], alt: m[1]||'', is_base64: m[2].startsWith('data:'), index: imgs.length }); }
        if (!imgs.length) (meta.image||[]).forEach((src, i) => { if (src) imgs.push({ src, alt: '', is_base64: src.startsWith('data:'), index: i }); });
        content._images = imgs;
    }
    if (!content._tags) content._tags = meta.tags || [];
    if (!content._description_html && !content._summary) { const s = (content.body||'').replace(/<img[^>]*>/gi,'').replace(/!\[[^\]]*\]\([^)]+\)/g,'').replace(/<[^>]+>/g,'').trim(); if (s.length) content._summary = s.length > 300 ? s.slice(0,300)+'…' : s; }
    // Was hardcoded to 'pixel_art', which made every root loaded from a
    // comment an artwork regardless of where it actually lives — including
    // the blog posts this function exists to hydrate.
    if (!content._content_type) content._content_type = resolveContentType(content) || 'pixel_art';
    return content;
};

// Fetch a single post by author/permlink for direct-URL (orphan) loads.
// Sentinel telling a failed content read apart from an empty one. A rejected
// getContent is a transient condition (node down, timeout) and must NOT be
// reported to the user as a deletion.
const CONTENT_READ_FAILED = Symbol('content_read_failed');

// Returns one of:
//   • an enriched post-card object — hydrated post (soft-deleted ones carry
//     `deleted: true` straight out of enrichPostForCard)
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
                console.warn('[Profile] getContent failed:', e && e.message);
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
                _content_type: 'pixel_art',
            };
        }

        hydrateContent(content);
        return enrichPostForCard(content, authorAccount, {});
    } catch (e) {
        console.warn('[Profile] fetchOrphanPost failed:', e && e.message);
        return null;
    }
};


// ╔══════════════════════════════════════════════════════════════════════╗
// ║  4. HOOKS                                                           ║
// ╚══════════════════════════════════════════════════════════════════════╝

// ── useProfileData ─────────────────────────────────────────────────────
const useProfileData = (api, pathname) => {
    const [account, setAccount] = useState({});
    const [isOwnProfile, setIsOwnProfile] = useState(false);
    const [loggedInUser, setLoggedInUser] = useState(null);
    const [following, setFollowing] = useState(false);
    const [subscriptions, setSubscriptions] = useState([]);
    const [vpMana, setVpMana] = useState(null);
    const [rcMana, setRcMana] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const prevUsernameRef = useRef('');
    // Live api ref — `loadProfile` schedules a recursive setTimeout to poll
    // for api.initialized, and the original implementation closed over the
    // `api` prop value via useCallback's closure. On cold-entry, the api
    // prop is null at first mount (setPageComponent fires in the same effect
    // tick as the proxy API's dynamic import, so apiRef.current in Index is
    // still null when Profile's element is created). The original closure
    // therefore polled `null?.initialized` forever; when Index later
    // dispatched a rebuilt element with `api=pixaAPI`, useCallback created a
    // NEW loadProfile with the right api, but the recursive setTimeout chain
    // from the first mount kept invoking the OLD function. Reading the api
    // through a ref decouples polling from the closure: each tick reads the
    // current api, so as soon as Index's apiRef-sync useEffect runs with the
    // new prop, this poll picks up the ready instance and proceeds.
    const apiRef = useRef(api);
    useEffect(() => { apiRef.current = api; }, [api]);

    const loadProfile = useCallback(async (name) => {
        const api = apiRef.current;
        if (!name || !api?.initialized) {
            if (name && !api?.initialized) {
                // Eagerly populate the account with the name we know from
                // the URL so the sidebar / mobile card show the username
                // immediately, even while we wait for the API to initialize.
                // Without this, cold-entry to a post URL shows an empty
                // profile shell behind the dialog until api init completes
                // (which can be several seconds on slow connections, or
                // forever if api init silently fails). We only set it if
                // the current account is empty OR for a different name so
                // we don't clobber a richer account already in state.
                setAccount(prev => {
                    if (!prev?.name || prev.name !== name) return { name };
                    return prev;
                });
                setTimeout(() => loadProfile(name), 250);
            }
            return;
        }
        setIsLoading(true);
        try {
            // Four reads that depend only on `name` (or nothing), in parallel.
            // getFollowCount joined the batch — it was a serial await after it,
            // needlessly delaying the header's follower/following counts.
            const [accs, activeUser, subs, fc] = await Promise.all([
                api.accounts.getAccounts([name], true).catch(() => []),
                api.getActiveAccount().catch(() => null),
                api.communities.getSubscriptions(name).catch(() => []),
                api.follow.getFollowCount(name).catch(() => ({ follower_count: 0, following_count: 0 })),
            ]);
            const acc = accs?.[0]; if (!acc) { setAccount({ name }); setIsLoading(false); return; }
            acc.follower_count = fc?.follower_count || 0; acc.following_count = fc?.following_count || 0;
            acc.image = acc._profile?.profile_image || ''; acc.cover_image = acc._profile?.cover_image || '';
            const isOwn = activeUser && activeUser.toLowerCase() === name.toLowerCase();

            // ── Commit the profile NOW (single batched render) ─────────────
            // Header (name, counts, avatar/cover) AND the post-grid load (which
            // is gated on account.name in loadTabData) no longer wait on the
            // follow-state scan below. `following` is reset so a previous
            // profile's value can't linger while the real one resolves.
            batch(() => {
                setLoggedInUser(activeUser || null);
                setIsOwnProfile(!!isOwn);
                setFollowing(false);
                setAccount(acc);
                setSubscriptions(subs || []);
                setIsLoading(false);
            });

            // ── Backfill: do-I-follow-this-profile (Follow button only) ────
            // getFollowing pulls up to 1000 entries just to derive one boolean,
            // so it must NOT gate first paint — resolve it in the background and
            // flip the button when it lands. Guarded against a profile switch.
            if (activeUser && !isOwn) {
                api.follow.getFollowing(activeUser, '', 'blog', 1000)
                    .then(fl => {
                        if (prevUsernameRef.current !== name) return;
                        if (Array.isArray(fl) && fl.some(f => (f.following || '').toLowerCase() === name.toLowerCase())) {
                            setFollowing(true);
                        }
                    })
                    .catch(() => {});
            }

            // Deferred: mana + subscription enrichment
            api.rc.getVPMana(name).then(setVpMana).catch(() => {});
            api.rc.getRCMana(name).then(setRcMana).catch(() => {});
            if (subs?.length) {
                const cNames = subs.map(s => Array.isArray(s) ? s[0] : s?.name||s?.community||'').filter(Boolean);
                if (cNames.length) {
                    Promise.all([api.accounts?.getAccounts(cNames, true).catch(()=>[]), api.communities?.listCommunities?.({sort:'rank',limit:100}).catch(()=>[])]).then(([pa, cl]) => {
                        const imgMap = {}, aboutMap = {};
                        (pa||[]).forEach(p => { if (p?.name) imgMap[p.name] = p._profile?.profile_image||''; });
                        (Array.isArray(cl)?cl:[]).forEach(c => { if (c?.name) aboutMap[c.name] = c.about||''; });
                        setSubscriptions(subs.map(s => { const cn = Array.isArray(s)?s[0]:s?.name||s?.community||''; const img = imgMap[cn]||'', ab = aboutMap[cn]||''; if (!img&&!ab) return s; if (Array.isArray(s)) return {name:s[0],title:s[1]||s[0],role:s[2]||'guest',userTitle:s[3]||'',image:img,about:ab}; return {...s,image:img||s.image||'',about:ab||s.about||''}; }));
                    }).catch(() => {});
                }
            }
        } catch (e) { console.error('[Profile] load error:', e); setIsLoading(false); }
    }, []);

    useEffect(() => {
        actions.trigger_page_render_complete(); actions.trigger_loading_update(0);
        // Cancelled on unmount so a quick page switch can't fire a stale
        // progress update onto the next page.
        const loadingTimer = setTimeout(() => actions.trigger_loading_update(100), 300);
        // Always derive the initial username from the LIVE URL, not the
        // pathname prop. Profile is memo-wrapped and the parent may not
        // re-render with a fresh prop after every HISTORY.push, so reading
        // HISTORY.location.pathname here guarantees we pick up the actual
        // current URL even when the prop is stale (e.g. mid-dialog the prop
        // is still the cold-entry post URL).
        const initialPath = HISTORY.location.pathname || pathname;
        const name = parseProfilePathname(initialPath).username;
        prevUsernameRef.current = name;
        if (name) loadProfile(name);
        return () => clearTimeout(loadingTimer);
    }, []);

    // Subscribe directly to HISTORY changes so the profile loads in step
    // with the URL even when the parent doesn't propagate a new pathname
    // prop (see the memo wrap on the default export — Index can't always
    // shallow-compare its way to a re-render here).
    //
    // Reading `account.name` through a ref keeps the listener subscription
    // stable across account loads — without the ref, the effect would tear
    // down and re-establish the listener every time a fetch flipped
    // account.name, and we'd lose the listener mid-navigation if React
    // batched the cleanup with another state update.
    const accountNameRef = useRef(account.name);
    useEffect(() => { accountNameRef.current = account.name; }, [account.name]);
    // Full account mirror for handlers that only need FALLBACK values (the
    // follower/following counts below). Reading through the ref keeps those
    // subscriptions/callbacks stable across account state changes — without
    // it, the profile_updated listener tore down and re-subscribed, and
    // refreshAccount re-allocated, on EVERY account update (follow toggles,
    // count patches, refetches).
    const accountRef = useRef(account);
    useEffect(() => { accountRef.current = account; }, [account]);
    useEffect(() => {
        const sync = (path) => {
            const newName = parseProfilePathname(path).username;
            if (!newName) return;
            // Reload on (a) name change, OR (b) we still have no account
            // loaded for this name (cold-entry recovery when the initial
            // load was racing with api init or returned an empty result).
            if (newName !== prevUsernameRef.current || !accountNameRef.current) {
                prevUsernameRef.current = newName;
                loadProfile(newName);
            }
        };
        sync(HISTORY.location.pathname || pathname);
        const unlisten = HISTORY.listen(h => sync(h.location.pathname));
        return unlisten;
    }, [pathname, loadProfile]);

    // Profile update event listener. Fallback counts are read through
    // accountRef so `account` can stay OUT of the deps — the previous
    // [api, pathname, account] deps re-subscribed this listener on every
    // account state change (every follow toggle / count patch / refetch).
    useEffect(() => {
        if (!api?.eventEmitter) return;
        const handler = (data) => {
            const name = parseProfilePathname(pathname).username;
            if (data?.account?.toLowerCase() === name) {
                setTimeout(() => { api.accounts.getAccounts([name], true).then(async (accs) => { if (!accs?.[0]) return; const a = accs[0]; a.image = a._profile?.profile_image||''; a.cover_image = a._profile?.cover_image||''; try { const fc = await api.follow.getFollowCount(name); a.follower_count = fc.follower_count||0; a.following_count = fc.following_count||0; } catch { a.follower_count = accountRef.current.follower_count||0; a.following_count = accountRef.current.following_count||0; } setAccount(a); }).catch(()=>{}); }, 1500);
            }
        };
        api.eventEmitter.on('profile_updated', handler);
        return () => api.eventEmitter.off('profile_updated', handler);
    }, [api, pathname]);

    // ── Refresh on session change ──────────────────────────────────────
    // `loggedInUser` is only assigned inside loadProfile(), which runs on
    // mount and when the URL username changes. If the user logs in (or
    // out, or switches account, or unlocks the vault) while staying on
    // the same @username page, loadProfile never re-runs, so
    // `loggedInUser` stays null and the `voter` prop forwarded to
    // PaperCardBlog / PaperCardComment / PaperCardReply / PostDialog
    // stays null — every vote click then bails out at the
    // `if (!voter) return;` guard, the Follow button no-ops on its
    // `!loggedInUser` short-circuit, and "is own profile" stays false.
    //
    // Re-running loadProfile on session events keeps the logged-in
    // identity, the follow/own-profile flags, and the post-card voter
    // state in step with the API session.
    useEffect(() => {
        if (!api?.eventEmitter) return;

        let cancelled = false;
        const refresh = async () => {
            try {
                const name = parseProfilePathname(HISTORY.location.pathname || pathname).username;
                if (!name) return;
                const user = await api.getActiveAccount().catch(() => null);
                if (cancelled) return;
                setLoggedInUser(user || null);
                const own = !!(user && user.toLowerCase() === name.toLowerCase());
                setIsOwnProfile(own);
                // Re-derive ONLY the viewer-scoped follow state. The viewed
                // profile's account, posts, comments and timeline are identity-
                // independent, so a full loadProfile here would refetch all of
                // them (and the account swap reloads the post grid), flashing
                // the page on every unlock for no content change. The initial
                // loadProfile from the URL effects owns the account itself.
                if (!user || own) { setFollowing(false); return; }
                const fl = await api.follow.getFollowing(user, '', 'blog', 1000).catch(() => null);
                if (cancelled || prevUsernameRef.current !== name) return;
                setFollowing(Array.isArray(fl) && fl.some(f => (f.following || '').toLowerCase() === name.toLowerCase()));
            } catch (e) {
                console.warn('[Profile] session refresh failed:', e);
            }
        };

        const events = [
            'session_created', 'session_restored', 'session_resumed', 'session_ended',
            'account_switched', 'pin_unlocked', 'pin_locked',
        ];
        events.forEach(ev => api.eventEmitter.on(ev, refresh));

        return () => {
            cancelled = true;
            events.forEach(ev => api.eventEmitter.off(ev, refresh));
        };
    }, [api, pathname, loadProfile]);

    const toggleFollowing = useCallback(() => {
        if (!api || !account?.name || !loggedInUser) return;
        const nf = !following;
        const ua = { ...account, follower_count: Math.max(0, (account.follower_count||0) + (nf?1:-1)) };
        setFollowing(nf); setAccount(ua);
        (async () => { try { if (nf) await api.broadcast.follow(loggedInUser, account.name); else await api.broadcast.unfollow(loggedInUser, account.name); } catch { setFollowing(!nf); setAccount({ ...account }); } })();
    }, [api, account, following, loggedInUser]);

    const refreshAccount = useCallback(() => {
        const name = parseProfilePathname(pathname).username; if (!api || !name) return;
        // Fallback counts via accountRef (not the `account` closure) so this
        // callback — and the memoized profile object it feeds — doesn't
        // re-allocate on every account state change.
        const doRefresh = () => { api.accounts.getAccounts([name], true).then(async (accs) => { if (!accs?.[0]) return; const a = accs[0]; a.image = a._profile?.profile_image||''; a.cover_image = a._profile?.cover_image||''; try { const fc = await api.follow.getFollowCount(name); a.follower_count = fc.follower_count||0; a.following_count = fc.following_count||0; } catch { a.follower_count = accountRef.current.follower_count||0; a.following_count = accountRef.current.following_count||0; } setAccount(a); }).catch(()=>{}); };
        doRefresh(); setTimeout(doRefresh, 3000);
    }, [api, pathname]);

    const onFollowCountsUpdated = useCallback((fc, fgc) => setAccount(a => ({ ...a, follower_count: fc, following_count: fgc })), []);

    // Stable return identity: re-allocate only when a field actually changes.
    // This object was previously a fresh literal every render, which forced
    // every downstream memo keyed on `profile` (sidebarProps, the comment/reply
    // cell renderers) to recompute on every parent render — scroll ticks
    // included. Memoizing lets those bail when nothing relevant moved.
    // setAccount is a stable useState setter, so it's intentionally not a dep.
    return useMemo(() => ({
        account, isOwnProfile, loggedInUser, following, subscriptions, vpMana,
        rcMana, isLoading, toggleFollowing, refreshAccount, onFollowCountsUpdated,
        setAccount,
    }), [account, isOwnProfile, loggedInUser, following, subscriptions, vpMana,
        rcMana, isLoading, toggleFollowing, refreshAccount, onFollowCountsUpdated]);
};

// ── useTabData ─────────────────────────────────────────────────────────
const useTabData = (api, account, category) => {
    const [posts, setPosts] = useState([]);
    const [comments, setComments] = useState([]);
    const [replies, setReplies] = useState([]);
    const [timeline, setTimeline] = useState([]);
    const [tabLoading, setTabLoading] = useState(false);
    // ── End-of-feed flags ──────────────────────────────────────────────
    // Each paginated tab gets its own hasMore flag so an empty page response
    // (we've reached the bottom) prevents further pointless load-more
    // attempts. Reset to true whenever the tab is (re)loaded from scratch.
    const [hasMorePosts, setHasMorePosts] = useState(true);
    const [hasMoreComments, setHasMoreComments] = useState(true);
    const [hasMoreTimeline, setHasMoreTimeline] = useState(true);
    // Lowest RAW account-history index fetched so far — the timeline's
    // pagination floor. Tracked from the raw node responses rather than the
    // parsed events, because a whole page can legitimately parse to zero
    // events (op types the parser skips, e.g. custom_json follow/reblog
    // traffic) or dedup to zero new ids; paginating from the parsed floor
    // re-fetched those pages forever or read the empty result as "bottom
    // reached", ending the feed while older events still existed below.
    const timelineFloorRef = useRef(Infinity);
    // Monotonic counter bumped whenever a tab's data is fully replaced
    // (initial load, account switch, post_published / comment_published
    // refetch). The main component watches this and drives a full Masonry
    // reset on the currently-visible tab — clearing CellMeasurerCache, the
    // positioner, and Masonry's internal _positionCache. Without it,
    // @pixagram/virtualized keeps cached heights keyed to the previous list's
    // ids and renders the new posts against stale geometry.
    const [dataVersion, setDataVersion] = useState(0);

    // Token bumped on every profile switch. Each loadTabData invocation
    // snapshots the active name at the time of the call; before it commits
    // any of the (async) results to state, it checks that name is still
    // the current account.name. If the user has switched profiles mid-fetch
    // (A → B), the in-flight A request resolves AFTER the B reset happens —
    // without this guard, A's payload would land into the freshly-cleared
    // B state and overwrite it.
    const currentNameRef = useRef('');
    useEffect(() => { currentNameRef.current = account?.name || ''; }, [account?.name]);

    const loadTabData = useCallback(async (cat) => {
        if (!api?.initialized || !account?.name) return;
        const name = account.name; setTabLoading(true);
        // Helper: only commit if the profile we started fetching for is still
        // the active one. Returns true when commit is safe.
        const stillCurrent = () => currentNameRef.current === name;
        try {
            switch (cat) {
                case 0: {
                    // Fetch user's latest posts via database.getDiscussions("blog", { tag })
                    // — the canonical database-API path. Falls back to the bridge
                    // get_account_posts path if the database call fails or returns
                    // empty (e.g. transient node hiccup, or accounts whose blog
                    // index hasn't been backfilled).
                    setHasMorePosts(true);
                    let p = await api.content.getDiscussionsByBlog({ tag: name, limit: 20 })
                        .then(r => Array.isArray(r) ? r : [])
                        .catch(e => { console.warn('[Profile] database.getDiscussions(blog) failed:', e.message); return []; });
                    if (!p.length) {
                        p = await api.communities.getAccountPosts(name, 'blog', { limit: 20 })
                            .then(r => Array.isArray(r) ? r : [])
                            .catch(() => []);
                    }
                    if (!stillCurrent()) return;
                    // Two-phase: every post here is authored by the profile owner,
                    // whose avatar is `account` — already loaded — so the grid is
                    // VISUALLY COMPLETE now, gated on the post fetch alone. Only
                    // voter-list profile images (shown when a vote list is opened)
                    // need the extra account fetch, so defer it and patch in place
                    // with no remeasure (avatar swaps don't change card height).
                    setPosts(p.map(x => enrichPostForCard(x, account, {})));
                    fetchVoterProfiles(p, account, api)
                        .then(vp => { if (stillCurrent()) setPosts(p.map(x => enrichPostForCard(x, account, vp))); })
                        .catch(() => {});
                    break;
                }
                case 1: {
                    setHasMoreComments(true);
                    const c = await api.content.getDiscussionsByComments({tag:name,start_author:name,limit:20}).then(r=>Array.isArray(r)?r:[]).catch(()=>[]);
                    if (!stillCurrent()) return;
                    // Two-phase (mirrors case 0): every comment here is authored
                    // by the profile owner, whose avatar is `account` — already
                    // loaded — so the tab is VISUALLY COMPLETE now, gated on the
                    // comment fetch alone instead of a serial voter-account
                    // round-trip. Only voter-list profile images (shown when a
                    // vote list is opened) need the extra fetch, so defer it and
                    // patch in place — avatar swaps don't change card height,
                    // and both phases map/sort the same `c`, so membership and
                    // order are identical.
                    const ownOnly = {}; if (account?.name) ownOnly[account.name] = account.image;
                    const buildComments = (vp) => c.map((x,i)=>enrichCommentForCard(x,account,i,vp)).sort((a,b)=>b.date-a.date);
                    setComments(buildComments(ownOnly));
                    fetchVoterProfiles(c, account, api)
                        .then(vp => { if (stillCurrent()) setComments(buildComments(vp)); })
                        .catch(() => {});
                    break;
                }
                case 2: {
                    const rr = await api.content.getRepliesByLastUpdate(name,'',20).then(r=>Array.isArray(r)?r:[]).catch(()=>[]);
                    if (!stillCurrent()) return;
                    // Two-phase (mirrors case 0 and the feeds' onAvatars path):
                    // commit text-ready reply cards NOW — gated on the replies
                    // fetch alone, one round-trip sooner — and resolve the
                    // author/voter accounts in the background. Phase 1 renders
                    // the same names-only stub transformRepliesToCardFormat
                    // already falls back to on an account-lookup miss, so both
                    // phases map/sort the same `rr` and differ only in avatars
                    // and display names.
                    const ownOnly = {}; if (account.name) ownOnly[account.name] = account.image;
                    setReplies(transformRepliesToCardFormat(rr, account, ownOnly, []));
                    const relAccs = rr.flatMap(r=>[r.author,r.parent_author].filter(Boolean));
                    const allVotes = rr.flatMap(r=>r.active_votes||[]);
                    const allToFetch = [...new Set([...allVotes.map(v=>v?.voter).filter(Boolean),...relAccs])];
                    if (allToFetch.length) {
                        api.accounts.getAccounts(allToFetch).then(a => {
                            if (!stillCurrent() || !Array.isArray(a)) return;
                            const vp = {}; if (account.name) vp[account.name] = account.image;
                            const fa = a.filter(Boolean);
                            fa.forEach(x => { const n=x.name||x._entity_id; if(n) vp[n]=x._profile?.profile_image||''; });
                            setReplies(transformRepliesToCardFormat(rr, account, vp, fa));
                        }).catch(() => {});
                    }
                    break;
                }
                case 3: {
                    setHasMoreTimeline(true); timelineFloorRef.current = Infinity;
                    const h = await api.accounts.getAccountHistory(name,-1,100).catch(()=>[]);
                    if (!stillCurrent()) return;
                    for (let i = 0; i < (h||[]).length; i++) { const ix = h[i]?.[0]; if (typeof ix === 'number' && ix < timelineFloorRef.current) timelineFloorRef.current = ix; }
                    setTimeline(parseAccountHistoryToTimeline(h||[], name));
                    break;
                }
            }
            if (!stillCurrent()) return;
            // Successful full replacement of the tab's data — signal the
            // main component to flush stale Masonry geometry for the
            // currently-visible tab.
            setDataVersion(v => v + 1);
        } catch (e) { console.error('[Profile] tab data error:', e); }
        if (stillCurrent()) setTabLoading(false);
    }, [api, account]);

    // ── Reset on profile switch ────────────────────────────────────────
    // When the URL username changes, `account.name` flips before the new
    // profile's tab data has finished fetching. Without an explicit reset,
    // the previous profile's posts/comments/replies/timeline stay rendered
    // for the duration of the new fetch (often visible as a flash of
    // someone else's content), and worse, the per-tab pagination flags
    // (hasMorePosts/Comments/Timeline) and the timeline's _histIndex
    // cursor carry over — so the first "load more" on the new profile
    // can dedupe against the old profile's ids and refuse to grow.
    //
    // We use the React-blessed "reset state during render" pattern: detect
    // the name change in the render pass itself and call the setters, which
    // React batches with the current render and re-renders synchronously
    // before commit. The user never sees a frame of stale data — unlike
    // a post-render useEffect, which would paint once with the wrong data
    // before clearing it.
    //   https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
    const [resetForName, setResetForName] = useState('');
    if (account?.name && account.name !== resetForName) {
        setResetForName(account.name);
        setPosts([]);
        setComments([]);
        setReplies([]);
        setTimeline([]);
        timelineFloorRef.current = Infinity;
        setHasMorePosts(true);
        setHasMoreComments(true);
        setHasMoreTimeline(true);
        setDataVersion(v => v + 1);
    }

    useEffect(() => { if (account?.name) loadTabData(category); }, [account?.name, category]); // eslint-disable-line

    // ── Refresh on new content for THIS profile ────────────────────────
    // When the user publishes a new post or comment, the relevant tab on
    // their (or any matching) profile should reflect it without a manual
    // reload. We listen for both events and refetch only the tabs whose data
    // actually changes:
    //
    //   post_published    → posts tab (top-level blog entries)
    //   comment_published → comments tab (replies authored by this user)
    //   content_deleted   → whichever tab might contain the deleted entry
    //
    // The timeline tab is the user's account-history feed; it changes for
    // both events, so refetch it whenever it's the active view.
    //
    // We compare `author` from the event payload (already normalized by the
    // API) against `account.name`. Case-insensitive in case any caller slips
    // through with mixed case — defensive but cheap.
    //
    // Refetches are debounced 6 s per-tab so (a) back-to-back broadcasts
    // (editor sends `comment` + `comment_options`) coalesce into a single
    // call, and (b) the bridge index has time to catch up before we hit it.
    // Each tab has its own slot so a delete-event (which triggers posts +
    // comments + timeline) doesn't lose a refetch to debounce collision.
    useEffect(() => {
        if (!api?.eventEmitter || !account?.name) return;
        const profileName = account.name.toLowerCase();

        const timers = { 0: null, 1: null, 3: null }; // posts, comments, timeline
        const schedule = (tabIndex) => {
            if (timers[tabIndex]) clearTimeout(timers[tabIndex]);
            timers[tabIndex] = setTimeout(() => {
                timers[tabIndex] = null;
                loadTabData(tabIndex);
            }, 6000);
        };

        const onPostPublished = (payload) => {
            if ((payload?.author || '').toLowerCase() !== profileName) return;
            // Posts tab always; timeline shows the new op in account history.
            // Comments tab is unaffected by a top-level post.
            schedule(0);
            schedule(3);
        };
        const onCommentPublished = (payload) => {
            if ((payload?.author || '').toLowerCase() !== profileName) return;
            schedule(1);
            schedule(3);
        };
        const onContentDeleted = (payload) => {
            if ((payload?.author || '').toLowerCase() !== profileName) return;
            // We don't know whether it was a post or a comment — refetch
            // both to be safe. Cheap given the typical 20-row page size.
            schedule(0);
            schedule(1);
            schedule(3);
        };

        // Edits behave like deletions for refetch purposes: title/tags/nsfw
        // may have changed, or the entry just gained the `deleted` tag and
        // must drop out of its tab.
        const onContentUpdated = (payload) => {
            if ((payload?.author || '').toLowerCase() !== profileName) return;
            schedule(0);
            schedule(1);
            schedule(3);
        };

        api.eventEmitter.on('post_published', onPostPublished);
        api.eventEmitter.on('comment_published', onCommentPublished);
        api.eventEmitter.on('content_deleted', onContentDeleted);
        api.eventEmitter.on('content_updated', onContentUpdated);
        return () => {
            for (const k of Object.keys(timers)) {
                if (timers[k]) clearTimeout(timers[k]);
            }
            api.eventEmitter.off('post_published', onPostPublished);
            api.eventEmitter.off('comment_published', onCommentPublished);
            api.eventEmitter.off('content_deleted', onContentDeleted);
            api.eventEmitter.off('content_updated', onContentUpdated);
        };
    }, [api, account?.name, loadTabData]);

    // Load-more handlers
    const loadMorePosts = useCallback(async () => {
        if (!api || tabLoading || !hasMorePosts || !account?.name || !posts.length) return; const last = posts[posts.length-1]; if (!last?.permlink) return;
        setTabLoading(true);
        try {
            // Paginate via database.getDiscussions("blog", …) using the last
            // visible post as the cursor. Bridge fallback mirrors the initial
            // load — same shape, slice(1) to drop the duplicated cursor row.
            let p = await api.content.getDiscussionsByBlog({
                tag: account.name,
                limit: 20,
                start_author: account.name,
                start_permlink: last.permlink,
            }).then(r => Array.isArray(r) ? r : []).catch(e => { console.warn('[Profile] database.getDiscussions(blog) page failed:', e.message); return []; });
            if (!p.length) {
                p = await api.communities.getAccountPosts(account.name, 'blog', {
                    limit: 20, start_author: account.name, start_permlink: last.permlink,
                }).then(r => Array.isArray(r) ? r : []).catch(() => []);
            }
            if (p.length > 1) {
                const np = p.slice(1).map(x => enrichPostForCard(x, account));
                setPosts(prev => [...prev, ...np]);
            } else {
                // No new rows past the cursor — we've reached the end.
                setHasMorePosts(false);
            }
        } catch {}
        setTabLoading(false);
    }, [api, account, posts, tabLoading, hasMorePosts]);

    const loadMoreComments = useCallback(async () => {
        if (!api || tabLoading || !hasMoreComments || !account?.name || !comments.length) return; const last = comments[comments.length-1]; if (!last?.permlink) return;
        setTabLoading(true);
        try {
            const c = await api.content.getDiscussionsByComments({tag:account.name,start_author:account.name,start_permlink:last.permlink,limit:20});
            if (Array.isArray(c) && c.length > 1) {
                const nc = c.slice(1).map((x,i)=>enrichCommentForCard(x,account,comments.length+i));
                setComments(prev=>[...prev,...nc]);
            } else {
                setHasMoreComments(false);
            }
        } catch {}
        setTabLoading(false);
    }, [api, account, comments, tabLoading, hasMoreComments]);

    const loadMoreTimeline = useCallback(async () => {
        if (!api || tabLoading || !hasMoreTimeline || !account?.name || !timeline.length) return;
        // Pagination cursor: the lowest RAW account-history index fetched so
        // far (timelineFloorRef), NOT the lowest parsed _histIndex — a page
        // can legitimately parse to zero events or dedup to zero new ids, and
        // the old code read that as "bottom reached" and ended the feed while
        // older events still existed below. Fall back to the parsed floor
        // once for lists that predate the ref (state restored without a fetch
        // this session).
        let fromIndex = timelineFloorRef.current;
        if (!isFinite(fromIndex)) {
            for (let i = 0; i < timeline.length; i++) {
                const hh = timeline[i]?._histIndex;
                if (typeof hh === 'number' && hh >= 0 && hh < fromIndex) fromIndex = hh;
            }
        }
        // fromIndex <= 1 ⇒ from = 0 ⇒ limit = 0: an invalid call everywhere
        // (and condenser-lineage nodes assert start >= limit anyway), so ≤1 is
        // the effective floor of the history.
        if (!isFinite(fromIndex) || fromIndex <= 1) { setHasMoreTimeline(false); return; }
        setTabLoading(true);
        try {
            const from = fromIndex - 1;
            // Clamp the limit near the head of the history: condenser-lineage
            // get_account_history asserts start >= limit, so a fixed 100 threw
            // on every 380ms poll once the cursor dropped under 100 and the
            // oldest ops never loaded. Harmless if dpixa already clamps.
            const h = await api.accounts.getAccountHistory(account.name, from, Math.min(100, from));
            if (Array.isArray(h) && h.length) {
                for (let i = 0; i < h.length; i++) { const ix = h[i]?.[0]; if (typeof ix === 'number' && ix < timelineFloorRef.current) timelineFloorRef.current = ix; }
                const nt = parseAccountHistoryToTimeline(h, account.name);
                const ids = new Set(timeline.map(e=>e.id));
                const u = nt.filter(e=>!ids.has(e.id));
                if (u.length) {
                    setTimeline(prev=>[...prev,...u].sort((a, b) => {
                        const dt = parseTimestamp(b.timestamp) - parseTimestamp(a.timestamp);
                        if (dt !== 0) return dt;
                        return (b._histIndex|0) - (a._histIndex|0);
                    }));
                }
                // A page with no new parsed events is NOT the bottom: the floor
                // advanced above, so the next 380ms poll fetches the range
                // below it. The bottom is the floor itself (≤1, checked next
                // call) or an empty node response.
                if (timelineFloorRef.current <= 1) setHasMoreTimeline(false);
            } else {
                setHasMoreTimeline(false);
            }
        } catch {}
        setTabLoading(false);
    }, [api, account, timeline, tabLoading, hasMoreTimeline]);

    const handleVoteChange = useCallback((permlink, voter, weight) => {
        setPosts(prev => prev.map(p => applyVoteToPost(p, permlink, voter, weight)));
    }, []);

    // Stable return identity (same rationale as useProfileData above):
    // this object was a fresh literal every render, so every downstream
    // hook keyed on `tabData` recomputed on every Profile render — scroll
    // ticks included. setPosts is a stable useState setter, so it's
    // intentionally not a dep.
    return useMemo(() => ({
        posts, comments, replies, timeline, tabLoading, dataVersion,
        loadMorePosts, loadMoreComments, loadMoreTimeline, handleVoteChange, setPosts,
    }), [posts, comments, replies, timeline, tabLoading, dataVersion,
        loadMorePosts, loadMoreComments, loadMoreTimeline, handleVoteChange]);
};

// ── useMasonryGrid (multi-tab) ─────────────────────────────────────────
const GUTTER = 16;
const SCROLL_MS = 380;

const useMasonryGrid = ({ windowWidth, windowHeight, isMobile, overscanByPixels, loadMoreThreshold, category, loadMoreFn, tabLoading }) => {
    const masonryRefs = useRef([null,null,null,null]);
    const rootRef = useRef(null);
    const [scrollTops, setScrollTops] = useState([0,0,0,0]);
    const [scrollY, setScrollY] = useState(0);
    const [rootDims, setRootDims] = useState({width:0,height:0});
    const [selectedPostIndex, setSelectedPostIndex] = useState(0);

    const scrollTopRef = useRef([0,0,0,0]);
    const scrollYRef = useRef(0);
    const topScrollByIndex = useRef([]);
    const heightByIndex = useRef([]);
    const xyByIndex = useRef([]);
    const lastScrollCheckH = useRef(0);
    const loadMoreRef = useRef(loadMoreFn);
    const tabLoadingRef = useRef(tabLoading);
    loadMoreRef.current = loadMoreFn;
    tabLoadingRef.current = tabLoading;
    const categoryRef = useRef(category);
    categoryRef.current = category;

    const columnCount = useMemo(() => {
        if (category !== 0) return 1;
        if (windowWidth >= 1920) return 3;
        if (windowWidth >= 1280) return 2;
        return 1;
    }, [windowWidth, category]);

    const gutterSize = category === 3 ? 0 : GUTTER;

    const columnWidth = useMemo(() => {
        const rw = rootDims.width; if (rw < 100) return 356;
        return Math.floor((rw - (columnCount+1)*gutterSize - (isMobile?32:396)) / columnCount);
    }, [rootDims.width, columnCount, gutterSize, isMobile]);

    const pageWidth = isMobile ? windowWidth : windowWidth - 284 - 396;

    const cacheDefaults = useMemo(() => ({ defaultHeight: category===3?107:600, defaultWidth: columnWidth||356, fixedWidth: true, minHeight: category===3?107:144 }), [columnWidth, category]);

    const cellMeasurerCache = useMemo(() => { const c = new CellMeasurerCache(cacheDefaults); c.visible_ids = {}; return c; }, [cacheDefaults]);

    const cellPositionerConfig = useMemo(() => ({ cellMeasurerCache, columnCount, columnWidth, spacer: gutterSize }), [cellMeasurerCache, columnCount, columnWidth, gutterSize]);
    const cellPositioner = useMemo(() => createMasonryCellPositioner(cellPositionerConfig), [cellPositionerConfig]);

    const setRootElement = useCallback((el) => {
        if (!el) return;
        rootRef.current = el;
        const r = el.getBoundingClientRect();
        setRootDims({ width: r.width, height: r.height });
    }, []);
    // Re-measure on window resize
    useEffect(() => { if (!rootRef.current) return; const r = rootRef.current.getBoundingClientRect(); if (r.width>=100&&r.height>=100) setRootDims({width:r.width,height:r.height}); }, [windowWidth, windowHeight]);
    // Retry measurement until root has valid dimensions (position:absolute
    // div starts at 0×0 before content lays out — original retried via
    // _updated_dimensions → setTimeout(50) loop).
    useEffect(() => {
        if (rootDims.width >= 100 && rootDims.height >= 100) return;
        let cancelled = false;
        const retry = () => {
            if (cancelled || !rootRef.current) return;
            const r = rootRef.current.getBoundingClientRect();
            if (r.width >= 100 && r.height >= 100) setRootDims({ width: r.width, height: r.height });
            else setTimeout(retry, 50);
        };
        setTimeout(retry, 50);
        return () => { cancelled = true; };
    }, [rootDims.width, rootDims.height]);

    // Clear ref on unmount, set on mount
    const setMasonryRef = useCallback((cat) => (el) => {
        if (el) masonryRefs.current[cat] = el;
        else masonryRefs.current[cat] = null;
    }, []);

    // Recompute on layout change (columnWidth/cache/positioner changed, or tab switch)
    useEffect(() => {
        const m = masonryRefs.current[category]; if (!m || !cellMeasurerCache || !cellPositioner) return;
        cellMeasurerCache.clearAll(); cellMeasurerCache.visible_ids = {};
        cellPositioner.reset(cellPositionerConfig); m.clearCellPositions(); m.forceUpdate();
    }, [columnWidth, cellMeasurerCache, cellPositioner, cellPositionerConfig, category]);

    // Scroll tracking
    useEffect(() => {
        const interval = setInterval(() => {
            const cat = categoryRef.current;
            const m = masonryRefs.current[cat]; if (!m?._scrollingContainer) return;
            const prevST = scrollTopRef.current[cat]; const prevSY = scrollYRef.current;
            const curST = m._scrollingContainer.scrollTop;
            const yDiff = curST - prevST;
            lastScrollCheckH.current += yDiff;
            const reload = Math.abs(lastScrollCheckH.current) > (overscanByPixels/2);
            const yBound = cat === 0 ? 64 : 72;
            const newY = Math.min(Math.max(-yBound, prevSY - yDiff), yBound);
            // Infinite scroll — poll-driven, so it must also fire when the
            // current batch doesn't overflow the container (scrollHeight is
            // clamped to clientHeight then and no scroll can ever happen;
            // the old `scrollHeight > clientHeight` guard starved load-more
            // on under-filled first pages). Only require layout (ch > 0);
            // the tab loaders' guards (tabLoading / hasMore* / empty list)
            // no-op the extra ticks once the tail is reached.
            if (!tabLoadingRef.current) { const el = m._scrollingContainer; const sh = el.scrollHeight||0, ch = el.clientHeight||0; if (ch > 0 && sh - curST - ch < loadMoreThreshold) loadMoreRef.current(); }
            if (prevST !== curST || prevSY !== newY) {
                scrollTopRef.current[cat] = curST; scrollYRef.current = newY;
                setScrollTops(prev => { const n = [...prev]; n[cat] = curST; return n; });
                setScrollY(newY);
                if (reload) lastScrollCheckH.current = 0;
            }
        }, SCROLL_MS);
        return () => clearInterval(interval);
    }, [overscanByPixels, loadMoreThreshold]);

    const scrollTo = useCallback((top) => {
        const m = masonryRefs.current[categoryRef.current]; if (!m?._scrollingContainer) return;
        m._scrollingContainer.scrollTop = top; scrollTopRef.current[categoryRef.current] = top;
        setScrollTops(prev => { const n = [...prev]; n[categoryRef.current] = top; return n; }); m.forceUpdate();
    }, []);

    const scrollToIndex = useCallback((index) => {
        const idx = index ?? selectedPostIndex;
        const top = (topScrollByIndex.current[idx]||0) + (heightByIndex.current[idx]||0)/2 - rootDims.height/3;
        scrollTo(top);
    }, [selectedPostIndex, rootDims.height, scrollTo]);

    const trackElementPosition = useCallback((index, top, height, rowIndex, columnIndex) => {
        topScrollByIndex.current[index] = top; heightByIndex.current[index] = height; xyByIndex.current[index] = [rowIndex, columnIndex];
    }, []);

    const postListHeight = windowHeight - (isMobile ? 80 : 96);

    // Force-clear all Masonry caches for the specified tab. Used by the
    // parent whenever a tab's data is fully replaced (post_published /
    // comment_published refetch). Identical to the [columnWidth, …, category]
    // layout effect above, but exposed as a callable so a data refetch can
    // trigger the same flush without piggybacking on a layout-prop change.
    // The CellMeasurerCache and cellPositioner are shared across all four
    // tabs in this hook, so clearing them is safe — each tab will re-measure
    // its own cells on the next render. We still target a specific tab's
    // Masonry ref for clearCellPositions/forceUpdate because that's the one
    // currently mounted and rendering.
    const resetMasonry = useCallback((cat) => {
        const m = masonryRefs.current[cat]; if (!m || !cellMeasurerCache || !cellPositioner) return;
        cellMeasurerCache.clearAll(); cellMeasurerCache.visible_ids = {};
        cellPositioner.reset(cellPositionerConfig); m.clearCellPositions(); m.forceUpdate();
    }, [cellMeasurerCache, cellPositioner, cellPositionerConfig]);

    // Stable return identity: re-allocate only when a field actually
    // changes (scroll ticks still change scrollTops/scrollY, but tab-data
    // updates, dialog opens, etc. no longer mint a fresh grid object).
    // masonryRefs is a ref and setSelectedPostIndex a stable setter, so
    // neither is a dep; SCROLL_MS and overscanByPixels are covered by the
    // fields derived from them.
    return useMemo(() => ({
        masonryRefs, setMasonryRef, setRootElement, cellMeasurerCache, cellPositioner, columnWidth, columnCount,
        scrollingResetTimeInterval: SCROLL_MS, scrollTops, scrollY, scrollTo, scrollToIndex,
        pageWidth, postListHeight, rootDims, overscanByPixels, selectedPostIndex, setSelectedPostIndex,
        trackElementPosition, gutterSize, resetMasonry,
    }), [setMasonryRef, setRootElement, cellMeasurerCache, cellPositioner, columnWidth, columnCount,
        scrollTops, scrollY, scrollTo, scrollToIndex, pageWidth, postListHeight, rootDims,
        overscanByPixels, selectedPostIndex, trackElementPosition, gutterSize, resetMasonry]);
};

// ── usePostNavigation (Profile) ────────────────────────────────────────
const usePostNavigation = ({ api, posts, masonryRefs, scrollToIndex, setSelectedPostIndex, profileUsername, nsfwEnabled }) => {
    const [artworkOpen, setArtworkOpen] = useState(false);
    const [currentPost, setCurrentPost] = useState({});
    const [originRect, setOriginRect] = useState(null);
    const [isOrphan, setIsOrphan] = useState(false);
    const historyDepthRef = useRef(0);
    // One-shot guard for the cold-entry history seed (see the URL effect).
    const seededRef = useRef(false);

    const postsRef = useRef(posts);
    useEffect(() => { postsRef.current = posts; }, [posts]);
    const currentPostRef = useRef(currentPost);
    useEffect(() => { currentPostRef.current = currentPost; }, [currentPost]);
    const apiRef = useRef(api);
    useEffect(() => { apiRef.current = api; }, [api]);
    const orphanFetchTokenRef = useRef(0);

    // URL-driven open/close/swap — see Feed.js for rationale.
    // API-readiness handling lives inside the orphan-fetch dispatch (a
    // setTimeout polling loop), not in this effect's deps. See the block
    // inside for the full rationale.
    useEffect(() => {
        // Cold-entry seed: if we mounted straight onto a post URL (shared
        // link / refresh on an open post), seat the author's profile beneath
        // the overlay so Back returns to the profile and closes the dialog
        // instead of leaving the site. Same-page only — the fallback is the
        // post author's profile (the post URL minus its permlink). See Feed.js.
        if (!seededRef.current) {
            seededRef.current = true;
            const seedPath = HISTORY.location.pathname;
            const seedHash = HISTORY.location.hash || "";
            const pp = parsePostUrl(seedPath);
            const seedUser = profileUsername || (pp && pp.author) || '';
            const seedBack = seedUser ? `/@${seedUser}` : '';
            if (isPostUrl(seedPath) && !isCommunityPostUrl(seedPath)
                && historyDepthRef.current === 0
                && seedBack && !isPostUrl(seedBack)) {
                HISTORY.replace(seedBack);
                HISTORY.push(seedPath + seedHash);
                historyDepthRef.current = 1;
            }
        }
        const syncFromUrl = (pathname) => {
            // `/portal-N/@a/p` is a community post — <Community> +
            // <BlogPostDialog> own it (see hostPageForPostUrl). Treating it as
            // "not our post URL" closes any open overlay and stays out of the
            // router's way while it swaps the host page in.
            const parsed = isCommunityPostUrl(pathname) ? null : parsePostUrl(pathname);
            if (!parsed) {
                orphanFetchTokenRef.current += 1;
                setArtworkOpen(prev => {
                    if (!prev) return prev;
                    setCurrentPost({});
                    setOriginRect(null);
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
            // postsRef holds the UNFILTERED batch — the `!p.deleted` filter is
            // applied at render, in the visible-posts memo — so a soft-deleted
            // post still in the loaded batch is matched here and handed to the
            // dialog directly. That's fine: the dialog reads `deleted` off the
            // card and renders the "deleted by its author" state. (Community.js
            // filters inside its enrichment instead, so there the deleted post
            // always falls through to the orphan fetch below.)
            const match = (postsRef.current || []).find(p =>
                p.permlink === parsed.permlink && p.author?.username === parsed.author
            );
            if (match) {
                setIsOrphan(false);
                setCurrentPost(match);
                setArtworkOpen(true);
                return;
            }
            // Orphan: fetch on demand. Open the dialog *immediately* with a
            // stub from the URL so the cold-entry transition isn't gated on
            // the network round-trip — the dialog renders its loading state
            // from _loading until the fetch hydrates real content, or shows
            // _notFound on failure rather than silently swallowing the
            // navigation. Arrows are nulled while orphan so the dialog
            // hides/disables prev/next (no profile-grid neighbours exist).
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
            // pattern `loadProfile` (and `loadPage`, `loadCommunity`) use for
            // the same problem: the PixaProxyAPI instance is constructed once
            // and mutated in place (its `initialized` boolean flips after
            // `initialize()` resolves), so the `api` prop reference doesn't
            // change. React lifecycle hooks can't catch the mutation, and
            // Profile is wrapped in `memo` so even Index's apiReady-rebuild
            // dispatching a new page element doesn't trigger a Profile re-
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

    const openPost = useCallback((data, rect) => {
        const u = buildPostUrl(data); if (u) HISTORY.push(u);
        orphanFetchTokenRef.current += 1;
        setIsOrphan(false);
        setArtworkOpen(true); setCurrentPost(data); setOriginRect(rect||null); historyDepthRef.current = 1;
    }, []);

    const closePost = useCallback(() => {
        const depth = historyDepthRef.current;
        setArtworkOpen(false); setCurrentPost({}); setOriginRect(null); setIsOrphan(false); historyDepthRef.current = 0;
        if (!isPostUrl(HISTORY.location.pathname)) return;
        if (depth > 0) HISTORY.go(-depth);
        else {
            // Mid-dialog the URL is the post URL, not the profile URL, so
            // parseProfilePathname(HISTORY.location.pathname) yields no username.
            // Prefer the profileUsername passed in from the component (derived
            // from the cold-entry pathname prop), but fall back to extracting
            // the author from the live post URL — that guarantees we never
            // push the broken `/@` URL even if profileUsername went stale or
            // was empty at render time (e.g. cold-entry race before the
            // pathname prop was injected).
            const parsedPost = parsePostUrl(HISTORY.location.pathname);
            const username = profileUsername || (parsedPost && parsedPost.author) || '';
            // REPLACE rather than push: depth === 0 means the dialog was
            // opened straight from the URL (deep-link/refresh or a back→forward
            // re-open), so the post URL is the current entry. Pushing the
            // profile URL on top would leave the post URL behind us, and the
            // next browser Back would land on it and re-open the dialog.
            // Replacing swaps the post URL out for the profile. See Feed.js.
            HISTORY.replace(username ? `/@${username}` : '/created/');
        }
    }, [profileUsername]);

    const navigatePost = useCallback((dir) => {
        const m = masonryRefs.current[0]; if (!m?.props?.itemsWithSizes?.length) return false;
        const items = m.props.itemsWithSizes;
        const ci = items.findIndex(({item}) => isSamePost(item, currentPost));
        // Skip artworks whose card is blurred; `false` = no clean sibling
        // left that way → the dialog bounces the current artwork back
        // instead of dead-ending. See Feed.js for the full rationale.
        const ni = findNavigableIndex(items, ci, dir, nsfwEnabled, (e) => e.item);
        if (ni === -1) return false;
        const {item} = items[ni]; const u = buildPostUrl(item);
        // Sibling navigation is a lateral swap — replace, don't push. See Feed.js.
        if (u) HISTORY.replace(u);
        setCurrentPost(item); setSelectedPostIndex?.(ni); scrollToIndex?.(ni);
        return true;
    }, [masonryRefs, currentPost, scrollToIndex, setSelectedPostIndex, nsfwEnabled]);

    const nextPost = useCallback(() => navigatePost(1), [navigatePost]);
    const previousPost = useCallback(() => navigatePost(-1), [navigatePost]);

    // ── Arrow availability + reverse-hero target — see Feed.js ─────────
    // Same blur-skipping walk as navigatePost, run over `posts` (identical
    // order to the measured posts-grid items) so it can run during render;
    // an exhausted direction surfaces its callback as `undefined` (the
    // orphan convention) and the dialog unmounts that arrow.
    const canGoNext = useMemo(() => {
        if (!artworkOpen || isOrphan) return false;
        const list = posts || [];
        if (!list.length) return false;
        const ci = list.findIndex((p) => isSamePost(p, currentPost));
        return findNavigableIndex(list, ci, 1, nsfwEnabled) !== -1;
    }, [artworkOpen, isOrphan, posts, currentPost, nsfwEnabled]);

    const canGoPrev = useMemo(() => {
        if (!artworkOpen || isOrphan) return false;
        const list = posts || [];
        if (!list.length) return false;
        const ci = list.findIndex((p) => isSamePost(p, currentPost));
        return findNavigableIndex(list, ci, -1, nsfwEnabled) !== -1;
    }, [artworkOpen, isOrphan, posts, currentPost, nsfwEnabled]);

    // Live rect of the open post's card canvas (data-artwork-id stamp in
    // PaperCard) for PostDialog's reverse-hero close; null (no card
    // rendered / off-viewport / orphan) → plain fade-out. See Feed.js.
    const getReturnRect = useCallback(() => {
        const cur = currentPostRef.current;
        const id = cur && cur.id;
        if (id == null) return null;
        let el = null;
        try {
            el = document.querySelector(`canvas[data-artwork-id="${CSS.escape(String(id))}"]`);
        } catch (e) { return null; }
        if (!el || !el.isConnected) return null;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return null;
        const vw = window.innerWidth || 0, vh = window.innerHeight || 0;
        if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) return null;
        return r;
    }, []);

    // Counter-bump for PostDialog's drawer-hash push — see Feed.js for the
    // full rationale.
    const onDrawerPush = useCallback(() => {
        historyDepthRef.current += 1;
    }, []);

    const onDrawerPop = useCallback(() => {
        if (historyDepthRef.current > 0) historyDepthRef.current -= 1;
    }, []);

    // Open comment artwork (loads root post)
    const openCommentArtwork = useCallback(async (commentData, commentApi, account, focus) => {
        if (!commentApi) { actions.trigger_snackbar(t("components.profile.please_wait_connecting")); return; }
        const attempts = [{author:commentData.root_author,permlink:commentData.root_permlink},{author:commentData.parent_author,permlink:commentData.parent_permlink}].filter(a=>a.author&&a.permlink);
        for (const {author, permlink} of attempts) {
            try {
                // The author is known before the content resolves, so the
                // account lookup (only needed when the author isn't the
                // profile owner) runs in the SAME round-trip window as
                // getContent instead of serially after it. Its own catch
                // preserves the old fallback (keep `account`) on failure.
                let needsAccount = author !== account?.name;
                let [content, accs] = await Promise.all([
                    commentApi.content.getContent(author, permlink),
                    needsAccount ? commentApi.accounts.getAccounts([author]).catch(() => null) : null,
                ]);
                if (!content?.permlink) continue;
                // A non-empty parent_author means this attempt resolved to a
                // COMMENT, not the thread root — for a reply of a reply the
                // parent_* attempt is the PARENT COMMENT, and enriching it
                // opened the wrong "post". Every chain comment names its true
                // root, so hop once to root_author/root_permlink, re-running
                // the account lookup for the new author in the same
                // round-trip window.
                if (content.parent_author) {
                    const ra = content.root_author, rp = content.root_permlink;
                    if (!ra || !rp) continue;
                    needsAccount = ra !== account?.name;
                    [content, accs] = await Promise.all([
                        commentApi.content.getContent(ra, rp),
                        needsAccount ? commentApi.accounts.getAccounts([ra]).catch(() => null) : null,
                    ]);
                    if (!content?.permlink || content.parent_author) continue;
                }
                let ca = account; if (needsAccount && accs?.[0]) { ca = accs[0]; ca.image = ca.image||ca._profile?.profile_image||''; }
                hydrateContent(content);
                const enriched = enrichPostForCard(content, ca, {});
                // Last-ditch category: a comment inherits its root's category,
                // so the CARD knows the segment even when the fetched root came
                // back without one. Without this the URL degrades to
                // buildPostUrl's "general" placeholder and the link dies.
                if (!enriched.category && commentData.category) {
                    enriched.category = commentData.category;
                    enriched._content_type = isCommunityCategory(enriched.category) ? 'blog' : 'pixel_art';
                }
                const u = buildPostUrl(enriched);
                // A focus ref pins one comment of the thread: the URL gains
                // "#replies&focus=<b64>", so the dialog opens straight on the
                // comments with that comment highlighted and its tree path
                // lit (PostDialog reads the hash; BlogPostDialog can adopt
                // the same param when it learns the drawer-hash scheme).
                const hash = focus ? buildCommentFocusHash(focus.author, focus.permlink) : "";
                if (u) HISTORY.push(u + hash);
                // A blog post lives in a community, and `hostPageForPostUrl`
                // sends `/portal-N/@a/p` to <Community> + <BlogPostDialog>.
                // Profile has no BlogPostDialog and its PostDialog is the
                // artwork viewer, so the pushed URL is the whole handoff — the
                // router mounts the right host. Opening the local dialog too
                // would stack the artwork viewer on top of a blog post.
                if (u && isCommunityCategory(enriched.category)) return;
                orphanFetchTokenRef.current += 1;
                // A root post loaded from a comment isn't in the profile's
                // post grid either — it behaves like an orphan for navigation
                // purposes (no grid neighbours to arrow through).
                setIsOrphan(true);
                setArtworkOpen(true); setCurrentPost(enriched); setOriginRect(null); historyDepthRef.current = 1; return;
            } catch {}
        }
        actions.trigger_snackbar(t("components.profile.could_not_load_the_original_post"));
    }, []);

    // Stable return identity: re-allocate only when a field actually
    // changes. This object was a fresh literal every render, so every
    // downstream hook keyed on `postNav` (all four cell renderers, dialog
    // props) recomputed on every Profile render — scroll ticks included.
    return useMemo(() => ({
        artworkOpen, currentPost, originRect, isOrphan,
        openPost, closePost, onDrawerPush, onDrawerPop, getReturnRect,
        nextPost: (isOrphan || !canGoNext) ? undefined : nextPost,
        previousPost: (isOrphan || !canGoPrev) ? undefined : previousPost,
        openCommentArtwork,
    }), [artworkOpen, currentPost, originRect, isOrphan,
        openPost, closePost, onDrawerPush, onDrawerPop, getReturnRect,
        nextPost, previousPost, canGoNext, canGoPrev, openCommentArtwork]);
};


// ── Static empty-state icons (module scope) ────────────────────────────
// Constant SVG fragments for the four tabs' empty states. Building them
// inside the component re-allocated four element trees on every render —
// scroll ticks included — even though at most one is ever shown.
const EMPTY_ICONS = [
    <><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>,
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>,
    <><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></>,
    <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
];
const EMPTY_KEYS = ['posts', 'comments', 'replies', 'history'];


// ╔══════════════════════════════════════════════════════════════════════╗
// ║  5. MAIN COMPONENT                                                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

const Profile = ({ classes, settings, pathname, api }) => {
    useLanguage();
    const { windowWidth, windowHeight, isMobile, overscanByPixels, loadMoreThreshold } = useWindowDimensions();

    // ── Live pathname (memo-trap workaround) ───────────────────────────
    // Profile is wrapped in memo at the default export. The parent (Index)
    // doesn't always re-render us when HISTORY changes — same-route URL
    // changes (post URL ↔ profile URL ↔ tab URL) typically don't reissue a
    // fresh `pathname` prop. So the prop goes stale and every URL-derived
    // computation (parsed.username, parsed.tab, modal state, accountName)
    // ends up reflecting the cold-entry URL instead of where the user
    // actually is. We mirror HISTORY.location.pathname into local state and
    // use THAT for all URL-derived computations below. The prop is kept as
    // a fallback for the very first render before HISTORY.listen is wired.
    const [livePathname, setLivePathname] = useState(() => {
        try { return HISTORY.location.pathname || pathname; }
        catch { return pathname; }
    });
    useEffect(() => {
        const unlisten = HISTORY.listen(h => setLivePathname(h.location.pathname));
        // Catch any change that already happened between initial state and effect mount.
        try {
            const cur = HISTORY.location.pathname;
            if (cur && cur !== livePathname) setLivePathname(cur);
        } catch {}
        return unlisten;
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Memoized on the live pathname: this parse (decodeURIComponent + three
    // regexes) used to run on EVERY Profile render — including each 380 ms
    // scroll tick — for a URL that only changes on navigation.
    const parsed = useMemo(() => parseProfilePathname(livePathname), [livePathname]);

    // ── Category / tab ─────────────────────────────────────────────────
    const [category, setCategory] = useState(Math.max(0, TAB_NAMES.indexOf(parsed.tab)));
    const [tabValue, setTabValue] = useState(1);
    const [mobileCardExpanded, setMobileCardExpanded] = useState(false);

    // ── Profile data ───────────────────────────────────────────────────
    const profile = useProfileData(api, livePathname);
    const tabData = useTabData(api, profile.account, category);

    const loadMoreFn = useMemo(() => {
        if (category === 0) return tabData.loadMorePosts;
        if (category === 1) return tabData.loadMoreComments;
        if (category === 3) return tabData.loadMoreTimeline;
        return () => {};
    }, [category, tabData.loadMorePosts, tabData.loadMoreComments, tabData.loadMoreTimeline]);

    const grid = useMasonryGrid({ windowWidth, windowHeight, isMobile, overscanByPixels, loadMoreThreshold, category, loadMoreFn, tabLoading: tabData.tabLoading });

    // NSFW filtering for the posts tab: when the filter is ON (_nsfw_filter
    // truthy) drop posts flagged nsfw before the masonry sees them. Blur of
    // shown posts is handled by PaperCard via _nsfw_enabled. Only the posts grid
    // carries nsfw cards; the other tabs are unchanged.
    const visiblePosts = useMemo(
        () => (tabData.posts || []).filter((p) => !p.deleted && (!settings._nsfw_filter || !p.nsfw)),
        [tabData.posts, settings._nsfw_filter]
    );

    const postNav = usePostNavigation({ api, posts: visiblePosts, masonryRefs: grid.masonryRefs, scrollToIndex: grid.scrollToIndex, setSelectedPostIndex: grid.setSelectedPostIndex, profileUsername: parsed.username, nsfwEnabled: settings._nsfw_enabled });

    // ── Dialogs ────────────────────────────────────────────────────────
    const [walletOpen, setWalletOpen] = useState(parsed.modal === 'wallet');
    const [walletView, setWalletView] = useState(walletViewToTabValue(parsed.walletView));
    const [editOpen, setEditOpen] = useState(false);
    const [createCommunityOpen, setCreateCommunityOpen] = useState(false);
    const [followListOpened, setFollowListOpened] = useState(parsed.modal === 'followers' ? 'FOLLOWERS' : parsed.modal === 'following' ? 'FOLLOWING' : '');
    const [createArtworkOpen, setCreateArtworkOpen] = useState(false);
    const [menuCardXY, setMenuCardXY] = useState([]);
    const [menuCardData, setMenuCardData] = useState({});

    // ── Sync URL → state for modals ────────────────────────────────────
    useEffect(() => {
        const p = parseProfilePathname(livePathname);
        const newTab = Math.max(0, TAB_NAMES.indexOf(p.tab));
        if (newTab !== category) { setCategory(newTab); grid.scrollTo(0); }
        if (p.modal === 'wallet') { setWalletOpen(true); setWalletView(walletViewToTabValue(p.walletView)); setFollowListOpened(''); }
        else if (p.modal === 'followers') { setWalletOpen(false); setFollowListOpened('FOLLOWERS'); }
        else if (p.modal === 'following') { setWalletOpen(false); setFollowListOpened('FOLLOWING'); }
        else { setWalletOpen(false); setFollowListOpened(''); }
    }, [livePathname]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-collapse mobile card on scroll
    useEffect(() => { if (grid.scrollY < 0 && grid.scrollTops[category] >= 72) setMobileCardExpanded(false); }, [grid.scrollY, grid.scrollTops, category]);

    // Force masonry update when data changes
    const activeData = [tabData.posts, tabData.comments, tabData.replies, tabData.timeline][category];

    // Full masonry reset when a tab's data is fully replaced (initial load,
    // account switch, post_published / comment_published refetch). Declared
    // BEFORE the lighter forceUpdate effect below so the cache flush happens
    // first; the subsequent forceUpdate then renders against fresh
    // measurements. Without this, @pixagram/virtualized keeps stale cell heights
    // and the new posts render against the previous list's geometry.
    useEffect(() => {
        grid.resetMasonry(category);
    }, [tabData.dataVersion, settings._nsfw_filter]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { const m = grid.masonryRefs.current[category]; if (m) m.forceUpdate(); }, [activeData, category]);

    const locales = settings._selected_locales_code;
    // Username is ALWAYS derived from the pathname — it's the input to the
    // profile fetch, not its output. Reading it from `profile.account.name`
    // would be circular: a fetch failure or in-flight load would leave it
    // empty even when the URL clearly identifies the user. URL builders on
    // this page (tab switch, wallet modal, follow list, edit, …) all use
    // this single source of truth so navigation stays consistent regardless
    // of fetch state.
    const accountName = parsed.username || '';

    // ── Callbacks ──────────────────────────────────────────────────────
    const handleCategoryChange = useCallback((e, value) => {
        // replace (not push) so mobile back doesn't walk through every tab
        // the user tapped before leaving the profile entirely.
        if (category !== value) {
            // buildProfileUrl returns null when username is empty. In that
            // case the profile isn't even loaded yet — switching tabs would
            // drift UI from URL and the tab fetch would run against an empty
            // name. Bail rather than push a broken `/@/comments`-style URL
            // OR change local state out of sync with the URL.
            const newUrl = buildProfileUrl(accountName, TAB_NAMES[value]||'posts', '');
            if (!newUrl) { grid.scrollTo(0); return; }
            HISTORY.replace(newUrl);
            setCategory(value); grid.scrollTo(0);
        }
        else grid.scrollTo(0);
        // grid.scrollTo is a stable useCallback; depending on it instead of
        // the whole grid object keeps this handler from re-allocating on
        // every scroll tick.
    }, [category, accountName, grid.scrollTo]);

    const handleWalletOpen = useCallback((view) => {
        const vn = typeof view === 'string' ? view : 'overview';
        const newUrl = buildProfileUrl(accountName, TAB_NAMES[category]||'posts', 'wallet', vn);
        if (newUrl) HISTORY.push(newUrl);
        setWalletOpen(true); setWalletView(walletViewToTabValue(vn));
    }, [accountName, category]);

    const handleWalletClose = useCallback(() => { HISTORY.back(); setWalletOpen(false); setWalletView(false); }, []);

    const handleWalletViewChange = useCallback((tv) => {
        const vn = tabValueToWalletView(tv);
        const newUrl = buildProfileUrl(accountName, TAB_NAMES[category]||'posts', 'wallet', vn);
        if (newUrl) HISTORY.replace(newUrl);
        setWalletView(tv);
    }, [accountName, category]);

    // Warm the wallet chunk during idle time, but only on the user's OWN
    // profile — the case where opening the wallet is likely — so the first
    // open hydrates instantly. Visitors browsing other profiles never fetch
    // it, preserving the lazy default. Skipped when the wallet is already
    // open (cold-entry /@user/wallet), since React.lazy is loading it anyway.
    useEffect(() => {
        if (walletOpen || !profile.isOwnProfile) return;
        const id = idle(() => { loadWalletDialog().catch(() => {}); });
        return () => cancelIdle(id);
    }, [walletOpen, profile.isOwnProfile]);

    // Mount the (now-lazy) create dialog on first open and keep it mounted —
    // preserving the original keepMounted wiring — while deferring its chunk
    // until the user actually opens it. Mirrors Feed / FeedPersonal, which
    // already lazy-load NewPost; Profile was the last page chaining it into
    // its chunk for every visitor.
    const [newPostMounted, setNewPostMounted] = useState(false);
    useEffect(() => {
        if (createArtworkOpen) setNewPostMounted(true);
    }, [createArtworkOpen]);

    // Warm the create-post chunk on idle, own profile only — that's the only
    // place the create FAB is offered, so visitors browsing other profiles
    // never fetch it. Skipped once open (React.lazy is loading it anyway).
    useEffect(() => {
        if (createArtworkOpen || !profile.isOwnProfile) return;
        const id = idle(() => { loadNewPost().catch(() => {}); });
        return () => cancelIdle(id);
    }, [createArtworkOpen, profile.isOwnProfile]);

    // Mount the (now-lazy) post viewer on first open and keep it mounted so
    // close/reopen and in-dialog next/prev stay instant. On a deep-link entry
    // (cold-entry post URL) artworkOpen is already true, so this mounts on the
    // first commit while the orphan fetch runs in parallel.
    const [postDialogMounted, setPostDialogMounted] = useState(false);
    useEffect(() => {
        if (postNav.artworkOpen) setPostDialogMounted(true);
    }, [postNav.artworkOpen]);

    // Warm the post-viewer chunk on idle for EVERYONE (anyone can open a post),
    // so the open-from-card transition isn't gated on a cold chunk fetch.
    useEffect(() => {
        if (postDialogMounted) return;
        const id = idle(() => { loadPostDialog().catch(() => {}); });
        return () => cancelIdle(id);
    }, [postDialogMounted]);

    const handleEditClose = useCallback(() => { setEditOpen(false); profile.refreshAccount(); }, [profile.refreshAccount]);

    const openFollowListModal = useCallback((type) => {
        const mn = type === 'FOLLOWING' ? 'following' : 'followers';
        const newUrl = buildProfileUrl(accountName, TAB_NAMES[category]||'posts', mn);
        if (newUrl) HISTORY.push(newUrl);
        setFollowListOpened(type);
    }, [accountName, category]);

    const closeFollowListModal = useCallback(() => {
        const newUrl = buildProfileUrl(accountName, TAB_NAMES[category]||'posts', '');
        if (newUrl) HISTORY.replace(newUrl);
        setFollowListOpened('');
    }, [accountName, category]);

    const goToCommunity = useCallback((name) => HISTORY.push(name ? `/${name}/created/` : '/pixa-777/created/'), []);

    // Stable UI closures: the inline `() => set…(…)` lambdas previously
    // passed to ProfileMobileCard, the create FAB, CreateCommunityDialog and
    // NewPost re-created a closure per render — and Profile re-renders on
    // every 380 ms scroll tick — churning those children's props for
    // nothing. All setters below are stable, so these are created once.
    const toggleMobileCard = useCallback(() => setMobileCardExpanded(p => !p), []);
    const closeMobileCard = useCallback(() => setMobileCardExpanded(false), []);
    const openCreateArtwork = useCallback(() => setCreateArtworkOpen(true), []);
    const closeCreateArtwork = useCallback(() => setCreateArtworkOpen(false), []);
    const closeCreateCommunity = useCallback(() => setCreateCommunityOpen(false), []);

    const openCardMenu = useCallback((ev, data) => { setMenuCardXY(Int32Array.of(ev.x-24,ev.y-24)); setMenuCardData(data); }, []);
    const closeCardMenu = useCallback(() => { setMenuCardXY(Int32Array.of(0,0)); setMenuCardData({}); }, []);

    // ── Own-content management (card menu → page-level dialogs) ────────
    const [editPostData, setEditPostData] = useState(null);
    const [deletePostData, setDeletePostData] = useState(null);
    const [deleteCommentData, setDeleteCommentData] = useState(null);
    const onEditPost = useCallback((data) => { setEditPostData(data); }, []);
    const onDeletePost = useCallback((data) => { setDeletePostData(data); }, []);
    const onDeleteComment = useCallback((data) => { setDeleteCommentData(data); }, []);
    const closeEditPost = useCallback(() => { setEditPostData(null); }, []);
    const closeDeletePost = useCallback(() => { setDeletePostData(null); }, []);
    const closeDeleteComment = useCallback(() => { setDeleteCommentData(null); }, []);

    // Mount the (now-lazy) edit/delete dialogs on first use and keep them
    // mounted (both come from one chunk). Warmed on idle on your own profile —
    // the only place the card menu offers edit/delete on your own posts.
    const [ownPostDialogsMounted, setOwnPostDialogsMounted] = useState(false);
    useEffect(() => {
        if (editPostData || deletePostData) setOwnPostDialogsMounted(true);
    }, [editPostData, deletePostData]);
    useEffect(() => {
        if (ownPostDialogsMounted || !profile.isOwnProfile) return;
        const id = idle(() => { loadOwnPostDialogs().catch(() => {}); });
        return () => cancelIdle(id);
    }, [ownPostDialogsMounted, profile.isOwnProfile]);
    // Broadcasts emit content_updated / content_deleted → the tab listeners
    // above refetch after the chain-indexing debounce.
    const handlePostEdited = useCallback(() => {}, []);
    const handlePostDeleted = useCallback(() => {}, []);
    // Called by DeleteCommentModal once the delete_comment broadcast succeeds.
    // The modal owns the network call + its own loading/error state; the
    // content_deleted listener refetches the affected tabs.
    const handleCommentDeleted = useCallback(() => {
        setDeleteCommentData(null);
        actions.trigger_snackbar(t("words.comment_deleted"));
    }, []);

    const onVoteChange = useCallback((permlink, voter, weight) => tabData.handleVoteChange(permlink, voter, weight), [tabData.handleVoteChange]);

    // ── Cell renderers ─────────────────────────────────────────────────
    // Depend on the SPECIFIC grid fields the renderers read, not the whole
    // `grid` object — its identity changes on every scroll tick (scrollTops/
    // scrollY live in it), which used to re-create all four renderers — and
    // hand the mounted MasonryExtended a new cellRenderer prop — every
    // 380 ms while scrolling. The fields below only change on layout changes.
    const {
        columnCount, columnWidth, trackElementPosition, cellMeasurerCache,
        selectedPostIndex, postListHeight, pageWidth,
    } = grid;
    const { openPost, openCommentArtwork } = postNav;
    // Stable comment/reply open handler — replaces the per-cell inline
    // `(d) => postNav.openCommentArtwork(d, api, profile.account)` closure
    // and narrows those renderers' dependency from the whole `profile`
    // object down to the two fields they actually use.
    // The clicked card IS a comment of the thread being opened — hand its
    // identity to openCommentArtwork as the focus ref, so the root opens on
    // "#replies&focus=<b64>" with that comment pinned and centered
    // (PostDialog and BlogPostDialog both read the same hash scheme).
    const onOpenComment = useCallback((d) => {
        const c = d || {};
        const fa = (c.author || {}).username || (typeof c.author === "string" ? c.author : "");
        const focus = (fa && c.permlink) ? { author: fa, permlink: c.permlink } : null;
        return openCommentArtwork(c, api, profile.account, focus);
    }, [openCommentArtwork, api, profile.account]);

    const cellRendererPosts = useCallback((data) => {
        const {index, key, parent, style, isScrolling} = data;
        if (!parent?.props?.itemsWithSizes?.[index|0]) return null;
        const {item, size} = parent.props.itemsWithSizes[index|0]; if (!size.height) return null;
        const colIdx = index%columnCount, rowIdx = (index-colIdx)/columnCount;
        const ih = Math.ceil(columnWidth*(size.height/size.width))||0; style.width = columnWidth;
        trackElementPosition(index, +style.top, +style.height, rowIdx, colIdx);
        const container = parent._scrollingContainer; const st = container?container.scrollTop:0;
        const top = +style.top, bottom = top+(+style.height);
        const viewH = container?container.clientHeight:postListHeight, viewW = container?container.clientWidth:pageWidth;
        const threshold = viewH*(viewH/(viewW||1));
        const visible = threshold+bottom>st && top<st+viewH+threshold;
        cellMeasurerCache.visible_ids[size.id] = visible||(cellMeasurerCache.visible_ids[size.id]||false);
        return (<CellMeasurer cache={cellMeasurerCache} index={index} key={key} parent={parent}>
            <PaperCard onOpen={openPost} locales={locales} nsfw={settings._nsfw_enabled} data={item} renderer={settings._renderer} mode={settings._mode} onMenuClick={openCardMenu} api={api} voter={profile.loggedInUser} onVoteChange={onVoteChange} is_scrolling={isScrolling} selected={selectedPostIndex===index} size={size} visible={cellMeasurerCache.visible_ids[size.id]} column_width={columnWidth} image_height={ih} image_width={columnWidth} id={size.id} key={size.id} rowIndex={rowIdx} columnIndex={colIdx} style={style} />
        </CellMeasurer>);
    }, [tabData.posts, columnCount, columnWidth, trackElementPosition, cellMeasurerCache,
        selectedPostIndex, postListHeight, pageWidth, openPost,
        locales, settings, openCardMenu, api, profile.loggedInUser, onVoteChange]);

    const cellRendererComments = useCallback((data) => {
        const {index, key, parent, style, isScrolling} = data; const c = tabData.comments[index|0]; if (!c) return null;
        style.width = columnWidth;
        return (<CellMeasurer cache={cellMeasurerCache} index={index} key={key} parent={parent}>
            <PaperCardComment onOpen={onOpenComment} locales={locales} data={c} renderer={settings._renderer} onMenuClick={openCardMenu} is_scrolling={isScrolling} api={api} voter={profile.loggedInUser} selected={false} visible={true} column_width={columnWidth} id={c.date||c.id} key={c.date||c.id} style={style} />
        </CellMeasurer>);
    }, [tabData.comments, columnWidth, cellMeasurerCache, onOpenComment, locales, settings, openCardMenu, api, profile.loggedInUser]);

    const cellRendererReplies = useCallback((data) => {
        const {index, key, parent, style, isScrolling} = data; const r = tabData.replies[index|0]; if (!r) return null;
        style.width = columnWidth;
        return (<CellMeasurer cache={cellMeasurerCache} index={index} key={key} parent={parent}>
            <PaperCardReply onOpen={onOpenComment} locales={locales} data={r} renderer={settings._renderer} onMenuClick={openCardMenu} is_scrolling={isScrolling} api={api} voter={profile.loggedInUser} selected={false} visible={true} column_width={columnWidth} id={r.date||r.id} key={r.date||r.id} style={style} />
        </CellMeasurer>);
    }, [tabData.replies, columnWidth, cellMeasurerCache, onOpenComment, locales, settings, openCardMenu, api, profile.loggedInUser]);

    const onOpenProfileFromTimeline = useCallback((username) => {
        if (!username) return;
        HISTORY.push(`/@${username}`);
    }, []);

    const onOpenCommunityFromTimeline = useCallback((community) => {
        if (!community) return;
        HISTORY.push(`/${community}/created/`);
    }, []);

    const onOpenPostFromTimeline = useCallback(async (author, permlink) => {
        if (!author || !permlink) return;
        // A timeline reference can be a COMMENT (a vote on one, a reply, a
        // curation reward) just as well as a root post — and only root posts
        // have URLs. Resolve the thread root first: the root is what opens,
        // its category is the URL's first segment, and when the reference WAS
        // a comment the URL gains "#replies&focus=<ref>" so the dialog lands
        // on the thread with that comment pinned and its tree path lit.
        try {
            const root = await resolveThreadRoot(api, author, permlink);
            if (root) {
                const isComment = root.author !== author || root.permlink !== permlink;
                openCommentArtwork(
                    { root_author: root.author, root_permlink: root.permlink, category: root.category },
                    api,
                    profile.account,
                    isComment ? { author, permlink } : null
                );
                return;
            }
        } catch (e) {}
        // Resolution failed — fall back to the old direct open.
        openCommentArtwork(
            { root_author: author, root_permlink: permlink, parent_author: author, parent_permlink: permlink },
            api,
            profile.account
        );
    }, [openCommentArtwork, api, profile.account]);

    const cellRendererTimeline = useCallback((data) => {
        const {index, key, parent, style} = data; const ev = tabData.timeline[index|0]; if (!ev) return null;
        style.width = columnWidth;
        return (<CellMeasurer cache={cellMeasurerCache} index={index} key={key} parent={parent}>
            <TimelineEvent index={index} key={key} eventId={ev.id} style={style} event={ev} classes={classes} timeAgo={timeAgo} isLast={index>=tabData.timeline.length-1}
                           onOpenProfile={onOpenProfileFromTimeline}
                           onOpenCommunity={onOpenCommunityFromTimeline}
                           onOpenPost={onOpenPostFromTimeline} />
        </CellMeasurer>);
    }, [tabData.timeline, columnWidth, cellMeasurerCache, classes, onOpenProfileFromTimeline, onOpenCommunityFromTimeline, onOpenPostFromTimeline]);

    // ── Empty states ───────────────────────────────────────────────────
    // Only the ACTIVE tab's empty-state copy can render, so build just that
    // one instead of allocating all four entries (plus their icon JSX — now
    // hoisted to module scope as EMPTY_ICONS) on every render.
    const es = useMemo(() => {
        const own = profile.isOwnProfile;
        switch (category) {
            case 1: return { key: EMPTY_KEYS[1], icon: EMPTY_ICONS[1], title: t("components.profile.no_comments_yet"), sub: own ? t("components.profile.comments_you_leave_will_appear_here") : t("components.profile.hasnt_commented_on_any_posts_yet", {
                    accountName: accountName
                }) };
            case 2: return { key: EMPTY_KEYS[2], icon: EMPTY_ICONS[2], title: t("components.profile.no_replies_yet"), sub: own ? t("components.profile.replies_will_show_up_here") : t("components.profile.hasnt_received_any_replies_yet", {
                    accountName: accountName
                }) };
            case 3: return { key: EMPTY_KEYS[3], icon: EMPTY_ICONS[3], title: t("components.profile.no_activity_yet"), sub: own ? t("components.profile.your_activity_will_appear_here") : t("components.profile.doesnt_have_any_recorded_activity_yet", {
                    accountName: accountName
                }) };
            default: return { key: EMPTY_KEYS[0], icon: EMPTY_ICONS[0], title: t(own ? "components.profile.you_havent_posted_yet" : "components.profile.no_posts_yet"), sub: own ? t("components.profile.your_pixel_art_will_show_up_here") : t("components.profile.hasnt_published_any_pixel_art_yet_check", {
                    accountName: accountName
                }) };
        }
    }, [category, profile.isOwnProfile, accountName]);

    // ── Tab body ───────────────────────────────────────────────────────
    // `activeData` (selected above from the same four arrays the old
    // emptyStates entries carried in `data`) keeps the isEmpty semantics
    // identical to the previous `es.data.length === 0` check.
    const isEmpty = !tabData.tabLoading && !profile.isLoading && activeData.length === 0 && accountName;
    let emptyState = isEmpty ? (<div className={classes.emptyState} key={`empty-${es.key}`}><div className={classes.emptyStateIcon}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{es.icon}</svg></div><div className={classes.emptyStateTitle}>{es.title}</div><div className={classes.emptyStateSubtitle}>{es.sub}</div></div>) : null;

    const scrollTop = grid.scrollTops[category];
    // Memoized: this object is spread into MasonryExtended, which re-renders on
    // every scroll frame (scrollTop). Its four inputs don't change on scroll, so
    // a stable identity here keeps the spread from churning MasonryExtended's
    // props each frame.
    const masonryProps = useMemo(() => ({
        scrollingResetTimeInterval: grid.scrollingResetTimeInterval,
        height: grid.postListHeight,
        overscanByPixels: grid.overscanByPixels,
        width: grid.pageWidth,
    }), [grid.scrollingResetTimeInterval, grid.postListHeight, grid.overscanByPixels, grid.pageWidth]);

    let body = null;
    if (!isEmpty) {
        if (category === 0) body = (
            <ImageMeasurer key="posts" className={classes.masonry} items={visiblePosts} image={item=>item.image} keyMapper={item=>item.id}>
                {(itemsWithSizes) => (<MasonryExtended key="masonry-profile-posts" scrollTop={scrollTop} {...masonryProps} cellCount={(itemsWithSizes||[]).length|0} itemsWithSizes={itemsWithSizes} keyMapper={i=>(itemsWithSizes[i]||{size:{id:Math.random()}}).size.id} cellMeasurerCache={grid.cellMeasurerCache} cellPositioner={grid.cellPositioner} cellRenderer={cellRendererPosts} ref={grid.setMasonryRef(0)} />)}
            </ImageMeasurer>
        );
        else if (category === 1) body = (<div className={classes.masonry} key="comments"><MasonryExtended key="masonry-comments" scrollTop={scrollTop} {...masonryProps} cellCount={(tabData.comments||[]).length|0} items={tabData.comments} keyMapper={i=>(tabData.comments[i]||{date:Date.now()}).date} cellMeasurerCache={grid.cellMeasurerCache} cellPositioner={grid.cellPositioner} cellRenderer={cellRendererComments} ref={grid.setMasonryRef(1)} /></div>);
        else if (category === 2) body = (<div className={classes.masonry} key="replies"><MasonryExtended key="masonry-replies" scrollTop={scrollTop} {...masonryProps} cellCount={(tabData.replies||[]).length|0} items={tabData.replies} keyMapper={i=>(tabData.replies[i]||{date:Date.now()}).date} cellMeasurerCache={grid.cellMeasurerCache} cellPositioner={grid.cellPositioner} cellRenderer={cellRendererReplies} ref={grid.setMasonryRef(2)} /></div>);
        else body = (<div className={`${classes.masonry} ${classes.masonryTimeline}`} key="timeline"><MasonryExtended key="masonry-timeline" scrollTop={scrollTop} {...masonryProps} cellCount={(tabData.timeline||[]).length|0} items={tabData.timeline} keyMapper={i=>(tabData.timeline[i]||{id:`tl_${i}`}).id} cellMeasurerCache={grid.cellMeasurerCache} cellPositioner={grid.cellPositioner} cellRenderer={cellRendererTimeline} ref={grid.setMasonryRef(3)} /></div>);
    }

    // ── Sidebar/mobile props ───────────────────────────────────────────
    // Keyed on the posts COUNT, not the array identity: the sidebar only
    // shows the count, but every vote and the deferred voter-profile patch
    // mint a new `tabData.posts`, which used to rebuild this object (and its
    // inline handlers) and re-render ProfileSidebar/ProfileMobileCard for a
    // number that hadn't changed.
    const postsCount = tabData.posts?.length;
    const sidebarProps = useMemo(() => ({
        classes, account: profile.account, following: profile.following, tabValue, timeAgo,
        postsCount, isOwnProfile: profile.isOwnProfile, isLoggedOut: !profile.loggedInUser,
        subscriptions: profile.subscriptions, vpMana: profile.vpMana, rcMana: profile.rcMana,
        onOpenFollowersModal: () => openFollowListModal("FOLLOWERS"),
        onOpenFollowingModal: () => openFollowListModal("FOLLOWING"),
        onToggleFollowing: profile.toggleFollowing, onTabChange: (e,v) => setTabValue(v),
        onGoToCommunity: goToCommunity, onCreateCommunity: () => setCreateCommunityOpen(true),
        onWalletOpen: handleWalletOpen, onEditProfile: () => setEditOpen(true),
    }), [profile, postsCount, tabValue, classes, openFollowListModal, goToCommunity, handleWalletOpen]);

    const bottomBarHidden = isMobile && mobileCardExpanded;
    const fabTransform = isMobile
        ? `translateX(50%) translateY(${bottomBarHidden ? 200 : ((grid.scrollY>48||grid.scrollTops[category]<=72)?-96:56)}px)`
        : `translateY(${(grid.scrollY>48||grid.scrollTops[category]<=72)?-96:8}px)`;

    // ── Render ─────────────────────────────────────────────────────────
    return (
        <React.Fragment>
            <div className={classes.root}>
                {isMobile && <ProfileMobileCard {...sidebarProps} expanded={mobileCardExpanded} height={windowHeight} y={grid.scrollY} scrollTop={grid.scrollTops[category]} onToggleExpanded={toggleMobileCard} onCloseExpanded={closeMobileCard} />}
                <div className={classes.viewLeft}>
                    <ProfileTabs classes={classes} category={category} isOwnProfile={profile.isOwnProfile} onChange={handleCategoryChange} lessThan960w={isMobile} y={grid.scrollY} scrollTop={grid.scrollTops[category]} forceHidden={bottomBarHidden} />
                    <div className={classes.mainFab} style={{transform: fabTransform}}>
                        {profile.isOwnProfile && <Fab onClick={openCreateArtwork} variant="extended" size={isMobile?"small":"medium"}>
                            {isMobile ? <AddAPhoto/> : <PhotoCameraRounded style={{marginRight:12}}/>}
                            {isMobile ? null : <span>{t("words.create", {TUC: true})}</span>}
                        </Fab>}
                    </div>
                    {emptyState}
                </div>
                {!isMobile && <ProfileSidebar {...sidebarProps} />}
            </div>

            <div style={{position:"absolute"}} ref={grid.setRootElement}>
                {body}
            </div>

            <PaperCardMenuOption xy={menuCardXY} data={menuCardData} onClose={closeCardMenu}
                                 viewer={profile.loggedInUser}
                                 onEditPost={onEditPost} onDeletePost={onDeletePost}
                                 onDeleteComment={onDeleteComment} />

            {ownPostDialogsMounted && (
                <React.Suspense fallback={DIALOG_FALLBACK}>
                    <LazyEditPostDialog
                        open={Boolean(editPostData)}
                        onClose={closeEditPost}
                        api={api}
                        account={profile.loggedInUser}
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
            {/* Delete-own-comment confirmation (comments / replies tabs) */}
            <DeleteCommentModal
                open={Boolean(deleteCommentData)}
                api={api}
                account={profile.loggedInUser}
                comment={deleteCommentData}
                onCancel={closeDeleteComment}
                onDeleted={handleCommentDeleted}
            />

            {postDialogMounted && (
                <React.Suspense fallback={DIALOG_FALLBACK}>
                    <LazyPostDialog renderer={settings._renderer} mode={settings._mode} nsfw={settings._nsfw_enabled} format={settings._format} data={postNav.currentPost} open={postNav.artworkOpen} locales={locales} api={api} account={profile.loggedInUser} originRect={postNav.originRect} onVoteChange={onVoteChange} onClose={postNav.closePost} getReturnRect={postNav.getReturnRect} onDrawerPush={postNav.onDrawerPush} onDrawerPop={postNav.onDrawerPop} onPrevious={postNav.previousPost} onNext={postNav.nextPost} />
                </React.Suspense>
            )}

            <FollowListModal open={followListOpened.length > 0} isFollowing={followListOpened === "FOLLOWING"} account={profile.account} api={api} onClose={closeFollowListModal} onCountsUpdated={profile.onFollowCountsUpdated} />

            {/* Deferred wallet: only loaded when first opened */}
            {walletOpen && (
                <React.Suspense fallback={DIALOG_FALLBACK}>
                    <LazyPixaWalletDialog api={api} account={profile.account} open={walletOpen} initialView={walletView} locales={locales} isOwnProfile={profile.isOwnProfile} loggedInUser={profile.loggedInUser} isLoggedOut={!profile.loggedInUser} onClose={handleWalletClose} onViewChange={handleWalletViewChange} />
                </React.Suspense>
            )}

            <CreateCommunityDialog api={api} open={createCommunityOpen} locales={locales} onClose={closeCreateCommunity} />
            <EditProfileDialog api={api} open={editOpen} account={profile.account} locales={locales} onClose={handleEditClose} />
            {/* Deferred create-post: chunk loads on first open (or the idle prefetch above) */}
            {newPostMounted && (
                <React.Suspense fallback={DIALOG_FALLBACK}>
                    <LazyNewPost keepMounted={false} open={createArtworkOpen} onClose={closeCreateArtwork} api={api} />
                </React.Suspense>
            )}
        </React.Fragment>
    );
};

// memo comparator: these four props are referentially stable when unchanged
// (classes from withStyles, settings from Index's processedSettings, pathname
// a primitive, api the shared apiRef value), so this matches the default
// shallow check while documenting intent. Profile keeps itself in sync with
// URL changes through its own HISTORY.listen subscription rather than relying
// on the `pathname` prop being reissued, so a sticky memo here is intentional.
export default withStyles(styles)(
    memo(Profile, (prev, next) =>
        prev.classes === next.classes &&
        prev.settings === next.settings &&
        prev.pathname === next.pathname &&
        prev.api === next.api,
    ),
);