import * as React from "preact/compat";
import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useReducer, useRef, memo } from "preact/compat";
// Coalesce co-arriving setState calls after an await into one render (Preact
// doesn't auto-batch in promise continuations).
import { unstable_batchedUpdates as batch } from "preact/compat";
import { HISTORY, buildPostUrl, buildCommentFocusHash, isPostUrl, parsePostUrl, isDeletedPost, isCommunityPostUrl, COMMUNITY_TAG_REGEX, POST_DRAWER_TAB_HASHES } from "../utils/constants";
import withStyles from "@material-ui/core/styles/withStyles";
import * as actions from "../actions/utils";
import { CellMeasurer, CellMeasurerCache } from "@pixagram/virtualized/dist/es/index";
// The positioner comes from MasonryExtended: same library positioner, but it
// remembers its config, which the Masonry's relayout needs to replay it.
import MasonryExtended, { createMasonryCellPositioner } from "../components/MasonryExtended";
import useWindowDimensions from "../hooks/useWindowDimensions";
import { BAND_REFRESH_FRACTION, useCellExit, DELETE_EXIT_DELAY_MS } from "../hooks/useMasonryGrid";
import useVoteSync from "../hooks/useVoteSync";
import { usePictureDialog } from "../hooks/usePictureDialog";
import { applyOptimisticVote, overlayPendingVote, overlayPendingVotes, mergeFreshVoteDataInto } from "../utils/voteSync";
import { idle, cancelIdle } from "../utils/idle";
import {
    EASE as E, TRANSITION_FAST as TF, TRANSITION_MEDIUM as TM,
    TRANSITION_ENTRY as TE, RAINBOW_RIPPLE as RIPPLE, slideKF,
} from "../theme/motion";
import PaperCard, { isArtworkBlurred, paperCardLayoutKey } from "../components/PaperCard";
import PaperCardMenuOption from "../components/PaperCardMenuOption";
import { ProfileHoverCardLayer } from "../components/ProfileHoverCard";
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

// ── Deferred profile-picture viewer ────────────────────────────────────
// PictureDialog is PostDialog's image half (render pool, hero animation) —
// split out the same way and warmed on idle, so the first click on the
// profile picture isn't gated on a cold chunk fetch. The page-side state
// (the "#picture" history entry, the clicked element) lives in the light
// usePictureDialog hook, imported statically above.
const loadPictureDialog = () => import("../components/PictureDialog");
const LazyPictureDialog = React.lazy(loadPictureDialog);

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

// ── Wallet FAB "make way" choreography for the picture viewer ───────────
// The desktop FAB straddles the profile picture's left edge (its right half
// hovers over it); while the picture flies to the viewer and back it steps
// aside: left by FAB_AWAY_SHIFT px and down to FAB_AWAY_SCALE — the card
// clips at its left edge and leaves only 74px beside the picture, so the
// 80px button also shrinks a little to clear the picture without leaving
// the card. The dialog holds the take-off for FAB_AWAY_MS (+ a beat) so
// the slide always completes first.
const FAB_AWAY_MS = 220;
const FAB_AWAY_SHIFT = 37;
const FAB_AWAY_SCALE = 0.85;
// After the viewer closes: the reverse hero has landed before `open` flips
// false, then the Backdrop fades for ~195ms — the FAB comes back after that.
const FAB_RETURN_DELAY_MS = 260;

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
    // Anchor box for the wallet FAB: a stretched flex item, so its box spans
    // exactly the profile image's height (same 16px top/bottom margins as the
    // image's ButtonBase). The FAB is positioned against it — see menuButton.
    walletButtons: { position: "relative", flex: "0 0 42px", width: 42, margin: "16px 0px 16px 16px" },
    walletMobileButtons: { height: 0, padding: "0px 16px", backgroundColor: "transparent", borderRadius: "0px 0px 16px 16px", textAlign: "center" },
    masonryTimeline: { paddingTop: "16px !important", "& > .ReactVirtualized__Masonry": { paddingLeft: "0px !important", paddingRight: "396px !important", [theme.breakpoints.down("sm")]: { paddingRight: "0px !important" }, "& > .ReactVirtualized__Masonry__innerScrollContainer": { "& div": { textAlign: "end", zIndex: "1" }, "& .MuiPaper-root": { zIndex: 1 }, "& .MuiTimelineSeparator-root": { zIndex: 0 }, "& .MuiTimelineOppositeContent-root": { flex: "0" }, [theme.breakpoints.down("sm")]: { "& .MuiTimelineOppositeContent-root": { display: "none" } } } } },
    masonry: { overflow: "hidden overlay !important", contain: "style layout", "& > .ReactVirtualized__Masonry": { zIndex: 0, position: "absolute", margin: 0, scrollBehavior: "smooth", overscrollBehavior: "none", boxSizing: "content-box !important", willChange: "scroll-position !important", touchAction: "pan-y", overflow: "hidden overlay !important", padding: "86px 380px 32px 16px", [theme.breakpoints.down("sm")]: { padding: "100px 16px 32px 16px", width: "calc(100% - 32px)" }, contain: "style layout size", "& > .ReactVirtualized__Masonry__innerScrollContainer": { top: "auto !important", left: "auto !important", overflow: "initial !important", position: "absolute !important", paddingBottom: "144px", boxSizing: "content-box", contain: "style layout size", "& div": { contain: "style layout" } } } },
    inline: { display: 'inline' },
    emptyState: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", fallbacks: { minHeight: "calc(100vh - 200px)" }, minHeight: "calc(100dvh - 200px)", padding: "48px 24px", textAlign: "center", userSelect: "none", animation: `$fadeIn 600ms ${E} 0ms`, "@global": { "@keyframes fadeIn": { "0%": { filter: "opacity(0)", transform: "translateY(24px)" }, "100%": { filter: "opacity(1)", transform: "translateY(0px)" } } } },
    emptyStateIcon: { width: 96, height: 96, borderRadius: "32px", backgroundColor: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, "& svg": { width: 48, height: 48, color: "#444" } },
    emptyStateTitle: { fontFamily: '"Industry Book", "Normative Pro", sans-serif', fontSize: "1.375rem", fontWeight: "bold", color: "#c7c7c7", marginBottom: 8 },
    emptyStateSubtitle: { fontSize: "0.925rem", color: "#666", maxWidth: 360, lineHeight: 1.5 },
    // Explicitly anchored: centred on the image's inner edge (17px past the
    // anchor's right edge) and half-way down the image. It used to be
    // position:fixed with no offsets, i.e. placed by its static position, which
    // Chrome centred (align-content on the anchor) and WebKit put at the top.
    menuButton: { display: "block", position: "absolute", top: "50%", left: "100%", zIndex: 1, width: 80, height: 80, transform: "translate(calc(-50% + 17px), -50%) scale(1)", transition: `color ${TF}, background-color ${TF}, transform ${FAB_AWAY_MS}ms ${E}`, color: "#101010", backgroundColor: "#c7c7c7", boxShadow: "0 0 8px #c7c7c788, 0 0 16px #c7c7c7cc", "&:hover": { color: "#101010", backgroundColor: "#fff", boxShadow: "0 0 8px #ffffff88, 0 0 16px #ffffffcc" }, "& svg": { width: "1.375em", height: "1.375em" }, "& .MuiTouchRipple-child": { backgroundImage: RIPPLE } },
    // Picture viewer open (and until the dialog has faded out after closing):
    // the FAB's right half hovers over the picture, and the flying picture is
    // a layer above the page that would seem to slice through it at take-off
    // and landing — so it steps LEFT, out from under the picture's edge,
    // before the picture moves. The card clips at its left edge and leaves
    // only 74px beside the picture, so the 80px button also shrinks a little
    // to clear the picture (2px) without leaving the card (4px).
    menuButtonAway: { transform: `translate(calc(-50% + 17px - ${FAB_AWAY_SHIFT}px), -50%) scale(${FAB_AWAY_SCALE})` },
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
        active_votes: activeVotes, net_rshares: post.net_rshares != null ? String(post.net_rshares) : '0',
        _voter_profiles: voterProfiles || {}, nsfw: isNsfwPost(post), deleted: isDeletedPost(post), tags,
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
        active_votes: activeVotes, net_rshares: comment.net_rshares != null ? String(comment.net_rshares) : '0', _voter_profiles: voterProfiles || {},
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
            active_votes: activeVotes, net_rshares: r.net_rshares != null ? String(r.net_rshares) : '0', _voter_profiles: voterProfiles || {}, originalComment: '',
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

// Shared with Feed / FeedPersonal / Community (utils/voteSync): patches the
// card AND registers the vote as pending, so the tab-switch refetch — which
// hits hivemind before it has indexed the vote's block — re-applies it instead
// of dropping it. See Feed.js for the full story.
const applyVoteToPost = (post, permlink, voter, weight) => applyOptimisticVote(post, permlink, voter, weight);

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
        return overlayPendingVote(enrichPostForCard(content, authorAccount, {}));
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
    // Name of the profile whose real fetch has completed (found or not).
    // The `{ name }` placeholder committed while the API initializes does
    // NOT count: the tab loader waits for this, because its own effect only
    // re-runs on a NAME change — the placeholder already carries the name,
    // so the tabs used to try once against a cold API, bail, and never
    // retry (an empty "no posts yet" profile after a refresh).
    const [readyName, setReadyName] = useState('');

    const prevUsernameRef = useRef('');
    // Name a load chain is currently running for (its API-readiness poll
    // included), so the URL sync's cold-entry recovery below doesn't start a
    // second, identical chain next to the mount's — two full profile fetches
    // and an isLoading flip-flop on every cold entry.
    const loadingNameRef = useRef('');
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
        // A newer navigation took over (prevUsernameRef is always set before
        // a load is requested): drop this call — including a 250 ms
        // API-readiness poll still running for a profile the reader left.
        if (name && prevUsernameRef.current !== name) return;
        if (name) loadingNameRef.current = name;
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
            // Superseded while in flight (A → B navigation, A answering last):
            // committing now would put A's header over B's page. The newer
            // load owns isLoading.
            if (prevUsernameRef.current !== name) return;
            if (loadingNameRef.current === name) loadingNameRef.current = '';
            const acc = accs?.[0];
            if (!acc) { batch(() => { setAccount({ name }); setIsLoading(false); setReadyName(name); }); return; }
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
                setReadyName(name);
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
        } catch (e) {
            console.error('[Profile] load error:', e);
            if (loadingNameRef.current === name) loadingNameRef.current = '';
            if (prevUsernameRef.current === name) batch(() => { setIsLoading(false); setReadyName(name); });
        }
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
            // A post dialog on top of the page: its URL names the POST's
            // author, not this page's profile — keep the loaded profile (see
            // pagePathname in the component). Only a cold entry straight
            // onto a post URL, with nothing requested yet, derives it there.
            if (prevUsernameRef.current && isPostUrl(path)) return;
            const newName = parseProfilePathname(path).username;
            if (!newName) return;
            // Reload on (a) name change, OR (b) we still have no account
            // loaded for this name (cold-entry recovery when the initial
            // load was racing with api init or returned an empty result) —
            // unless a load chain for it is still running.
            if (newName !== prevUsernameRef.current
                || (!accountNameRef.current && loadingNameRef.current !== newName)) {
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
                // The profile this page shows — not a parse of the live URL,
                // which names a post's author while a post dialog is open.
                const name = prevUsernameRef.current || parseProfilePathname(pathname).username;
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
        rcMana, isLoading, readyName, toggleFollowing, refreshAccount, onFollowCountsUpdated,
        setAccount,
    }), [account, isOwnProfile, loggedInUser, following, subscriptions, vpMana,
        rcMana, isLoading, readyName, toggleFollowing, refreshAccount, onFollowCountsUpdated]);
};

// ── useTabData ─────────────────────────────────────────────────────────
// Per-tab bookkeeping (posts 0, comments 1, replies 2, history 3).
const tabBit = (cat) => 1 << cat;

// Who a row is: author/permlink for posts, comments and replies, the
// account-history id for timeline events.
const rowIdentity = (x) => {
    if (!x) return '';
    if (x.permlink) {
        const a = x.author;
        const who = a && typeof a === 'object' ? (a.username || '') : (a || '');
        return `${who}/${x.permlink}`;
    }
    return String(x.id);
};

// The height-relevant content of a row, per list tab (comments 1, replies
// 2, history 3): what has to change for its measured height to go stale.
// Handed to that tab's MasonryExtended as `cellLayoutKey` (rowLayoutKey):
// a row whose shape changes is re-measured in place and the rows past it
// re-flow. Votes, payouts and avatars repaint in place and are deliberately
// left out. (The posts grid uses PaperCard's own paperCardLayoutKey.)
const ROW_SHAPES = [
    null,
    (c) => `${rowIdentity(c)}|${c.title}|${c.body}`,
    (r) => `${rowIdentity(r)}|${r.title}|${r.body}|${(r.replyTo && r.replyTo.username) || ''}`,
    (e) => rowIdentity(e),
];
// One string per row object (a render then costs a WeakMap lookup per cell).
const ROW_SHAPE_CACHE = [null, new WeakMap(), new WeakMap(), new WeakMap()];
const rowLayoutKey = (cat, row) => {
    if (!row) return undefined;
    const cache = ROW_SHAPE_CACHE[cat];
    let key = cache.get(row);
    if (key === undefined) {
        key = ROW_SHAPES[cat](row);
        cache.set(row, key);
    }
    return key;
};

// A reload fetches the first page again. When the reader had already paged
// past it, keep the pages they loaded below the fresh first page instead of
// truncating the list back to one page — which collapsed the grid under a
// reader scrolled further down (6 s after any publish or edit) and made
// them page everything in again. Aligned on the fresh page's LAST row, so
// new rows at the top (the window slid down) and rows gone from the first
// page both line up; when it can't be aligned, the fresh page stands alone,
// as before.
const keepLoadedTail = (prev, fresh) => {
    if (!prev || !fresh || !fresh.length || prev.length <= fresh.length) return fresh;
    const lastId = rowIdentity(fresh[fresh.length - 1]);
    let at = -1;
    for (let i = prev.length - 1; i >= 0; i--) { if (rowIdentity(prev[i]) === lastId) { at = i; break; } }
    if (at === -1 || at === prev.length - 1) return fresh;
    const inFresh = new Set(fresh.map(rowIdentity));
    const tail = prev.slice(at + 1).filter((x) => !inFresh.has(rowIdentity(x)));
    return tail.length ? fresh.concat(tail) : fresh;
};

// Phase-2 patch (voter profiles) onto a list that may carry a kept tail:
// swap the patched rows in by identity and leave every other row — and its
// object identity — alone.
const patchRows = (list, patched) => {
    if (!Array.isArray(list) || !patched || !patched.length) return list;
    const byId = new Map(patched.map((x) => [rowIdentity(x), x]));
    let touched = false;
    const next = list.map((x) => {
        const p = byId.get(rowIdentity(x));
        if (p && p !== x) { touched = true; return p; }
        return x;
    });
    return touched ? next : list;
};

const useTabData = (api, account, category, ready) => {
    const [posts, setPosts] = useState([]);
    const [comments, setComments] = useState([]);
    const [replies, setReplies] = useState([]);
    const [timeline, setTimeline] = useState([]);
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
    // (No per-tab data version any more. A reload that changes a tab's rows —
    // a publish, an edit, a delete — is re-flowed in place by that tab's
    // MasonryExtended: measured heights follow their rows, only new or
    // changed rows are measured, only the rows past the first change move.
    // The version used to reset the whole grid instead, every visible cell
    // re-measured with a flash, 6 s after any publish, edit or delete.)
    // Tabs whose first load for this profile has completed. The empty state
    // waits for it — and stays up while a later reload revalidates. It used
    // to follow a single global loading flag, so it flashed for a frame on
    // every switch to a not-yet-loaded tab and on every profile switch, and
    // blinked off and on again (replaying its fade-in) whenever ANY tab was
    // refreshing in the background.
    const [loadedMask, setLoadedMask] = useState(0);
    // In-flight loads per tab. Ref-only — nothing renders from it any more.
    // Per tab, so a background refresh of one tab no longer blocks load-more
    // on the tab being read; counted, so two loads of one tab can't clear
    // each other's flag (the first one back used to switch the shared flag
    // off while the other was still running).
    const busyRef = useRef([0, 0, 0, 0]);
    const isTabBusy = useCallback((cat) => busyRef.current[cat] > 0, []);
    // Newest full load per tab: a reload answering late must not overwrite
    // a newer one's rows.
    const loadGenRef = useRef([0, 0, 0, 0]);
    // The lists as last rendered — what a reload merges into / compares with.
    const listsRef = useRef(null);
    listsRef.current = [posts, comments, replies, timeline];

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
        const name = account.name;
        const gen = ++loadGenRef.current[cat];
        // Commit only while this is still the profile on screen AND the
        // newest load of this tab.
        const isLatest = () => currentNameRef.current === name && loadGenRef.current[cat] === gen;
        busyRef.current[cat] += 1;
        try {
            const prev = () => listsRef.current[cat];
            switch (cat) {
                case 0: {
                    // Fetch user's latest posts via database.getDiscussions("blog", { tag })
                    // — the canonical database-API path. Falls back to the bridge
                    // get_account_posts path if the database call fails or returns
                    // empty (e.g. transient node hiccup, or accounts whose blog
                    // index hasn't been backfilled).
                    let p = await api.content.getDiscussionsByBlog({ tag: name, limit: 20 })
                        .then(r => Array.isArray(r) ? r : [])
                        .catch(e => { console.warn('[Profile] database.getDiscussions(blog) failed:', e.message); return []; });
                    if (!p.length) {
                        p = await api.communities.getAccountPosts(name, 'blog', { limit: 20 })
                            .then(r => Array.isArray(r) ? r : [])
                            .catch(() => []);
                    }
                    if (!isLatest()) return;
                    // Two-phase: every post here is authored by the profile owner,
                    // whose avatar is `account` — already loaded — so the grid is
                    // VISUALLY COMPLETE now, gated on the post fetch alone. Only
                    // voter-list profile images (shown when a vote list is opened)
                    // need the extra account fetch, so defer it and patch in place
                    // with no remeasure (avatar swaps don't change card height).
                    // Both phases pass through overlayPendingVotes: a vote cast
                    // a moment ago isn't in the fetched rows yet (indexer lag);
                    // the pending registry keeps it until the chain shows it.
                    const fresh = overlayPendingVotes(p.map(x => enrichPostForCard(x, account, {})));
                    const merged = keepLoadedTail(prev(), fresh);
                    if (merged === fresh) setHasMorePosts(true);
                    setPosts(merged);
                    fetchVoterProfiles(p, account, api)
                        .then(vp => {
                            if (!isLatest()) return;
                            const patched = overlayPendingVotes(p.map(x => enrichPostForCard(x, account, vp)));
                            setPosts(list => patchRows(list, patched));
                        })
                        .catch(() => {});
                    break;
                }
                case 1: {
                    const c = await api.content.getDiscussionsByComments({tag:name,start_author:name,limit:20}).then(r=>Array.isArray(r)?r:[]).catch(()=>[]);
                    if (!isLatest()) return;
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
                    const buildComments = (vp) => overlayPendingVotes(c.map((x,i)=>enrichCommentForCard(x,account,i,vp)).sort((a,b)=>b.date-a.date));
                    const fresh = buildComments(ownOnly);
                    const merged = keepLoadedTail(prev(), fresh);
                    if (merged === fresh) setHasMoreComments(true);
                    setComments(merged);
                    fetchVoterProfiles(c, account, api)
                        .then(vp => {
                            if (!isLatest()) return;
                            const patched = buildComments(vp);
                            setComments(list => patchRows(list, patched));
                        })
                        .catch(() => {});
                    break;
                }
                case 2: {
                    const rr = await api.content.getRepliesByLastUpdate(name,'',20).then(r=>Array.isArray(r)?r:[]).catch(()=>[]);
                    if (!isLatest()) return;
                    // Two-phase (mirrors case 0 and the feeds' onAvatars path):
                    // commit text-ready reply cards NOW — gated on the replies
                    // fetch alone, one round-trip sooner — and resolve the
                    // author/voter accounts in the background. Phase 1 renders
                    // the same names-only stub transformRepliesToCardFormat
                    // already falls back to on an account-lookup miss, so both
                    // phases map/sort the same `rr` and differ only in avatars
                    // and display names. (No load-more on this tab, so no tail
                    // to keep: the fresh page is the list.)
                    const ownOnly = {}; if (account.name) ownOnly[account.name] = account.image;
                    const fresh = overlayPendingVotes(transformRepliesToCardFormat(rr, account, ownOnly, []));
                    setReplies(fresh);
                    const relAccs = rr.flatMap(r=>[r.author,r.parent_author].filter(Boolean));
                    const allVotes = rr.flatMap(r=>r.active_votes||[]);
                    const allToFetch = [...new Set([...allVotes.map(v=>v?.voter).filter(Boolean),...relAccs])];
                    if (allToFetch.length) {
                        api.accounts.getAccounts(allToFetch).then(a => {
                            if (!isLatest() || !Array.isArray(a)) return;
                            const vp = {}; if (account.name) vp[account.name] = account.image;
                            const fa = a.filter(Boolean);
                            fa.forEach(x => { const n=x.name||x._entity_id; if(n) vp[n]=x._profile?.profile_image||''; });
                            setReplies(overlayPendingVotes(transformRepliesToCardFormat(rr, account, vp, fa)));
                        }).catch(() => {});
                    }
                    break;
                }
                case 3: {
                    const h = await api.accounts.getAccountHistory(name,-1,100).catch(()=>[]);
                    if (!isLatest()) return;
                    let floor = Infinity;
                    for (let i = 0; i < (h||[]).length; i++) { const ix = h[i]?.[0]; if (typeof ix === 'number' && ix < floor) floor = ix; }
                    const fresh = parseAccountHistoryToTimeline(h||[], name);
                    const merged = keepLoadedTail(prev(), fresh);
                    if (merged === fresh) { setHasMoreTimeline(true); timelineFloorRef.current = floor; }
                        // Kept the deeper pages: the pagination floor stays where
                    // they reached.
                    else timelineFloorRef.current = Math.min(timelineFloorRef.current, floor);
                    setTimeline(merged);
                    break;
                }
            }
        } catch (e) { console.error('[Profile] tab data error:', e); }
        finally {
            // A profile switch already zeroed the counters for the new profile.
            if (currentNameRef.current === name) busyRef.current[cat] = Math.max(0, busyRef.current[cat] - 1);
        }
        if (!isLatest()) return;
        setLoadedMask(m => m | tabBit(cat));
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
        // Nothing loaded and nothing in flight for the new profile yet. (The
        // emptied lists clear the grid's layout: MasonryExtended re-flows from
        // index 0 with nothing left to place.)
        setLoadedMask(0);
        busyRef.current = [0, 0, 0, 0];
    }

    // Load the visible tab on a tab switch and on a profile switch — once
    // that profile has REALLY loaded (`ready`, see readyName in
    // useProfileData). Keyed on the name alone, this used to fire for the
    // `{ name }` placeholder committed while the API initializes, bail on
    // the cold API, and never fire again for the real account (same name).
    useEffect(() => { if (account?.name && ready) loadTabData(category); }, [account?.name, ready, category]); // eslint-disable-line

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

    // Load-more handlers. Each guards on its OWN tab's in-flight count and
    // drops its page if the reader switched profiles while it was out — it
    // used to append the previous profile's rows to the new one.
    const loadMorePosts = useCallback(async () => {
        if (!api || busyRef.current[0] > 0 || !hasMorePosts || !account?.name || !posts.length) return; const last = posts[posts.length-1]; if (!last?.permlink) return;
        const name = account.name;
        busyRef.current[0] += 1;
        try {
            // Paginate via database.getDiscussions("blog", …) using the last
            // visible post as the cursor. Bridge fallback mirrors the initial
            // load — same shape, slice(1) to drop the duplicated cursor row.
            let p = await api.content.getDiscussionsByBlog({
                tag: name,
                limit: 20,
                start_author: name,
                start_permlink: last.permlink,
            }).then(r => Array.isArray(r) ? r : []).catch(e => { console.warn('[Profile] database.getDiscussions(blog) page failed:', e.message); return []; });
            if (!p.length) {
                p = await api.communities.getAccountPosts(name, 'blog', {
                    limit: 20, start_author: name, start_permlink: last.permlink,
                }).then(r => Array.isArray(r) ? r : []).catch(() => []);
            }
            if (currentNameRef.current !== name) return;
            if (p.length > 1) {
                const np = overlayPendingVotes(p.slice(1).map(x => enrichPostForCard(x, account)));
                setPosts(prev => [...prev, ...np]);
            } else {
                // No new rows past the cursor — we've reached the end.
                setHasMorePosts(false);
            }
        } catch {}
        finally { if (currentNameRef.current === name) busyRef.current[0] = Math.max(0, busyRef.current[0] - 1); }
    }, [api, account, posts, hasMorePosts]);

    const loadMoreComments = useCallback(async () => {
        if (!api || busyRef.current[1] > 0 || !hasMoreComments || !account?.name || !comments.length) return; const last = comments[comments.length-1]; if (!last?.permlink) return;
        const name = account.name;
        busyRef.current[1] += 1;
        try {
            const c = await api.content.getDiscussionsByComments({tag:name,start_author:name,start_permlink:last.permlink,limit:20});
            if (currentNameRef.current !== name) return;
            if (Array.isArray(c) && c.length > 1) {
                const nc = overlayPendingVotes(c.slice(1).map((x,i)=>enrichCommentForCard(x,account,comments.length+i)));
                setComments(prev=>[...prev,...nc]);
            } else {
                setHasMoreComments(false);
            }
        } catch {}
        finally { if (currentNameRef.current === name) busyRef.current[1] = Math.max(0, busyRef.current[1] - 1); }
    }, [api, account, comments, hasMoreComments]);

    const loadMoreTimeline = useCallback(async () => {
        if (!api || busyRef.current[3] > 0 || !hasMoreTimeline || !account?.name || !timeline.length) return;
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
        const name = account.name;
        busyRef.current[3] += 1;
        try {
            const from = fromIndex - 1;
            // Clamp the limit near the head of the history: condenser-lineage
            // get_account_history asserts start >= limit, so a fixed 100 threw
            // on every 380ms poll once the cursor dropped under 100 and the
            // oldest ops never loaded. Harmless if dpixa already clamps.
            const h = await api.accounts.getAccountHistory(name, from, Math.min(100, from));
            if (currentNameRef.current !== name) return;
            if (Array.isArray(h) && h.length) {
                for (let i = 0; i < h.length; i++) { const ix = h[i]?.[0]; if (typeof ix === 'number' && ix < timelineFloorRef.current) timelineFloorRef.current = ix; }
                const nt = parseAccountHistoryToTimeline(h, name);
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
        finally { if (currentNameRef.current === name) busyRef.current[3] = Math.max(0, busyRef.current[3] - 1); }
    }, [api, account, timeline, hasMoreTimeline]);

    const handleVoteChange = useCallback((permlink, voter, weight) => {
        setPosts(prev => prev.map(p => applyVoteToPost(p, permlink, voter, weight)));
    }, []);

    // 6 s chain refresh after a vote (useVoteSync): the re-read content's real
    // rshares and pending_payout_value replace the optimistic placeholder and
    // the estimated payout wherever that author/permlink is listed — posts,
    // comments and replies share the card shape, so one merge covers all three.
    const onVoteSynced = useCallback(({ content }) => {
        setPosts(prev => mergeFreshVoteDataInto(prev, content));
        setComments(prev => mergeFreshVoteDataInto(prev, content));
        setReplies(prev => mergeFreshVoteDataInto(prev, content));
    }, []);
    useVoteSync(api, onVoteSynced);

    // Stable return identity (same rationale as useProfileData above):
    // this object was a fresh literal every render, so every downstream
    // hook keyed on `tabData` recomputed on every Profile render. setPosts
    // is a stable useState setter and isTabBusy a [] callback.
    // A post deleted from this page, once its exit animation has played:
    // flagged the way a soft delete is, so the visible list drops it.
    const markPostDeleted = useCallback((id) => {
        setPosts(prev => {
            let hit = false;
            const next = prev.map(p => {
                if (p.id !== id || p.deleted) return p;
                hit = true;
                return { ...p, deleted: true };
            });
            return hit ? next : prev;
        });
    }, []);

    return useMemo(() => ({
        posts, comments, replies, timeline, loadedMask, isTabBusy,
        loadMorePosts, loadMoreComments, loadMoreTimeline, handleVoteChange, setPosts, markPostDeleted,
    }), [posts, comments, replies, timeline, loadedMask, isTabBusy,
        loadMorePosts, loadMoreComments, loadMoreTimeline, handleVoteChange, markPostDeleted]);
};

// ── Scroll chrome store ────────────────────────────────────────────────
// The page chrome reads two numbers off the scroll position: the active
// tab's scrollTop and the clamped direction accumulator `scrollY`. They used
// to live in useState, so every 380 ms poll tick that moved them re-rendered
// the WHOLE page while the reader scrolled — the sidebar (whose MUI Tabs
// force a layout on every render), every dialog host, the card menu, the
// empty state — just so the tab bar and the FAB could read two numbers.
// They now live in this store, published every animation frame while the
// tab scrolls (the band listener in useMasonryGrid) so the chrome moves with
// the finger instead of up to 380 ms behind it. What each piece of chrome
// draws is one threshold test on the two numbers — hidden or not — so each
// subscribes to that flag (useScrollFlag below) and re-renders only when it
// flips: a few times per scroll, not per frame and not per tick. The page
// doesn't re-render at all.
const createScrollStore = (readTop, readY) => {
    const listeners = new Set();
    let top = 0, y = 0;
    return {
        getScrollTop: () => top,
        getScrollY: () => y,
        subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
        // Take a fresh reading and notify only when it moved.
        publish() {
            const t = readTop(), v = readY();
            if (t === top && v === y) return;
            top = t; y = v;
            Array.from(listeners).forEach((fn) => fn());
        },
    };
};

const bumpCount = (n) => n + 1;

// One boolean derived from the position: re-renders the caller — not its
// parent — only when it flips. Read during render, so it is never a render
// behind the store, and a caller that swaps `predicate` (the tab bar's
// mobile and desktop tests) gets the new answer in that same render.
// Predicates should be module-level: a new one resubscribes.
const useScrollFlag = (store, predicate) => {
    const [, bump] = useReducer(bumpCount, 0);
    const flag = !!predicate(store.getScrollTop(), store.getScrollY());
    const shownRef = useRef(flag);
    shownRef.current = flag;
    useEffect(() => {
        const sync = () => {
            if (!!predicate(store.getScrollTop(), store.getScrollY()) !== shownRef.current) bump();
        };
        sync(); // anything published between this render and the subscription
        return store.subscribe(sync);
    }, [store, predicate]);
    return flag;
};

// ── useMasonryGrid (multi-tab) ─────────────────────────────────────────
const GUTTER = 16;
const SCROLL_MS = 380;

const useMasonryGrid = ({ windowWidth, windowHeight, isMobile, overscanByPixels, artworkAheadPx, loadMoreThreshold, category, loadMoreFn, isTabBusy }) => {
    const masonryRefs = useRef([null,null,null,null]);
    const rootRef = useRef(null);
    const [rootDims, setRootDims] = useState({width:0,height:0});
    const [selectedPostIndex, setSelectedPostIndex] = useState(0);

    const scrollTopRef = useRef([0,0,0,0]);
    const scrollYRef = useRef(0);
    const topScrollByIndex = useRef([]);
    const heightByIndex = useRef([]);
    const xyByIndex = useRef([]);
    const lastScrollCheckH = useRef(0);
    const loadMoreRef = useRef(loadMoreFn);
    const isTabBusyRef = useRef(isTabBusy);
    loadMoreRef.current = loadMoreFn;
    isTabBusyRef.current = isTabBusy;
    const categoryRef = useRef(category);
    categoryRef.current = category;

    // Position of the ACTIVE tab, read through refs at publish time.
    const scrollStore = useMemo(() => createScrollStore(
        () => scrollTopRef.current[categoryRef.current] || 0,
        () => scrollYRef.current,
    ), []);

    // A tab switch mounts that tab's Masonry fresh, at the top. Drop the
    // offset remembered from the tab's last visit — the chrome read that
    // stale number until the next poll tick — and publish before paint.
    useLayoutEffect(() => {
        scrollTopRef.current[category] = 0;
        scrollStore.publish();
    }, [category, scrollStore]);

    // One reading of tab `cat`'s live offset: its refs, then the chrome
    // subscribers. Called every animation frame while the tab scrolls (band
    // listener) and by the poll; returns whether anything moved. A reading
    // for a tab that is no longer on screen — a frame queued just before a
    // tab switch — is dropped: the direction accumulator is shared, and the
    // old tab's unmounted container would read as a jump to the top.
    const trackScroll = useCallback((cat, top) => {
        if (cat !== categoryRef.current) return false;
        const prevTop = scrollTopRef.current[cat], prevY = scrollYRef.current;
        const yBound = cat === 0 ? 64 : 72;
        const y = Math.min(Math.max(-yBound, prevY - (top - prevTop)), yBound);
        if (top === prevTop && y === prevY) return false;
        scrollTopRef.current[cat] = top; scrollYRef.current = y;
        scrollStore.publish();
        return true;
    }, [scrollStore]);

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

    // ── Root measurement ───────────────────────────────────────────────
    // Same fix the shared hook (hooks/useMasonryGrid) already carries. Only
    // the WIDTH is load-bearing — columnWidth derives from it. The wrapper's
    // height is ~0 by design (the masonry inside it is position:absolute),
    // so the previous `height >= 100` gate meant (a) a window resize never
    // re-measured the root, and (b) the 50 ms retry loop below NEVER
    // settled: a getBoundingClientRect — a forced layout — every 50 ms for
    // as long as the profile page was open. Gate on width only, bail out on
    // unchanged values, bound the retry, and let a ResizeObserver (drawer
    // toggles, orientation changes) do the re-measuring instead of polling.
    const measureRoot = useCallback(() => {
        const el = rootRef.current;
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        if (rect.width < 100) return false;
        setRootDims(prev =>
            (prev.width === rect.width && prev.height === rect.height)
                ? prev
                : { width: rect.width, height: rect.height });
        return true;
    }, []);

    const setRootElement = useCallback((el) => {
        if (!el) return;
        rootRef.current = el;
        measureRoot();
    }, [measureRoot]);

    useEffect(() => { measureRoot(); }, [windowWidth, windowHeight, measureRoot]);

    useEffect(() => {
        const el = rootRef.current;
        if (!el || typeof ResizeObserver === "undefined") return;
        const ro = new ResizeObserver(() => { measureRoot(); });
        ro.observe(el);
        return () => ro.disconnect();
        // rootRef is populated by the callback ref before effects run.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [measureRoot]);

    // Bounded retry for the rare case where the wrapper has no width yet at
    // ref-attach time (pending layout). Stops as soon as a width lands, or
    // after 5 s — never an unbounded forced-layout loop again.
    useEffect(() => {
        if (rootDims.width >= 100) return;
        let cancelled = false;
        let attempts = 0;
        let timer = 0;
        const retry = () => {
            if (cancelled) return;
            if (!measureRoot() && ++attempts < 100) timer = setTimeout(retry, 50);
        };
        timer = setTimeout(retry, 50);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [rootDims.width, measureRoot]);

    // One ref callback per tab, created once. `setMasonryRef(cat)` used to
    // mint a new closure on every call — i.e. on every Profile render, scroll
    // ticks included — and a changed ref callback makes Preact detach the old
    // one (ref(null)) and attach the new one (ref(el)) on every commit.
    const masonryRefCallbacks = useMemo(
        () => [0, 1, 2, 3].map((cat) => (el) => { masonryRefs.current[cat] = el || null; }),
        [],
    );
    const setMasonryRef = useCallback((cat) => masonryRefCallbacks[cat], [masonryRefCallbacks]);

    // Recompute on a layout change. A new column width (resize, drawer
    // toggle) hands the MOUNTED Masonry a fresh cache and positioner while it
    // still holds the old positions, so it has to be flushed. A tab switch —
    // or the first mount — needs none of that: the tab's Masonry mounts fresh
    // against the new cache, and flushing it right after mount only bought a
    // second full render pass in the middle of the switch. Layout effect, so
    // a resize never paints a frame of stale positions.
    const laidOutCategoryRef = useRef(null);
    useLayoutEffect(() => {
        const switched = laidOutCategoryRef.current !== category;
        laidOutCategoryRef.current = category;
        if (switched) return;
        const m = masonryRefs.current[category]; if (!m || !cellMeasurerCache || !cellPositioner) return;
        cellMeasurerCache.clearAll(); cellMeasurerCache.visible_ids = {};
        cellPositioner.reset(cellPositionerConfig); m.clearCellPositions(); m.forceUpdate();
    }, [columnWidth, cellMeasurerCache, cellPositioner, cellPositionerConfig, category]);

    // Band refresh step — same mechanism as the shared hook (see "Band
    // refresh while scrolling" in hooks/useMasonryGrid): the posts renderer
    // evaluates its artwork band only when its Masonry renders, and an
    // uncontrolled Masonry renders mid-scroll only when its mounted range
    // moves, which with the overscan this deep it hardly ever does — so
    // cards only started drawing once the reader stopped scrolling. Read
    // through a ref so a resize never resubscribes the effect below.
    const bandStepRef = useRef(0);
    bandStepRef.current = Math.max(64, (artworkAheadPx || (overscanByPixels || 0) / 2) * BAND_REFRESH_FRACTION);

    // Scroll tracking
    useEffect(() => {
        // Band refresh listener — bound to the ACTIVE tab's scrolling
        // container from the poll (null until that Masonry's first real
        // render), rebinding when the tab or its Masonry changes.
        const band = { el: null, masonry: null, cat: -1, onScroll: null, raf: 0, lastTop: 0 };
        const unbindBand = () => {
            if (band.el && band.onScroll) band.el.removeEventListener("scroll", band.onScroll);
            if (band.raf) cancelAnimationFrame(band.raf);
            band.el = null; band.masonry = null; band.cat = -1; band.onScroll = null; band.raf = 0;
        };
        const bindBand = (masonry, cat) => {
            const el = masonry._scrollingContainer;
            if (band.el === el && band.masonry === masonry) return;
            unbindBand();
            band.el = el; band.masonry = masonry; band.cat = cat; band.lastTop = el.scrollTop;
            band.onScroll = () => {
                if (band.raf) return;
                band.raf = requestAnimationFrame(() => {
                    band.raf = 0;
                    if (el.isConnected === false) return; // its Masonry unmounted; the poll rebinds
                    const top = el.scrollTop;
                    // The chrome reads every frame (see the scroll store);
                    // the band only every bandStep pixels.
                    trackScroll(band.cat, top);
                    if (Math.abs(top - band.lastTop) < bandStepRef.current) return;
                    band.lastTop = top;
                    masonry.forceUpdate(); // band evaluation only — the range is unchanged
                });
            };
            el.addEventListener("scroll", band.onScroll, { passive: true });
        };

        const interval = setInterval(() => {
            const cat = categoryRef.current;
            const m = masonryRefs.current[cat]; if (!m?._scrollingContainer) return;
            bindBand(m, cat);
            const prevST = scrollTopRef.current[cat];
            const curST = m._scrollingContainer.scrollTop;
            const yDiff = curST - prevST;
            lastScrollCheckH.current += yDiff;
            const reload = Math.abs(lastScrollCheckH.current) > (overscanByPixels/2);
            // Infinite scroll — poll-driven, so it must also fire when the
            // current batch doesn't overflow the container (scrollHeight is
            // clamped to clientHeight then and no scroll can ever happen;
            // the old `scrollHeight > clientHeight` guard starved load-more
            // on under-filled first pages). Only require layout (ch > 0);
            // the tab loaders' guards (in-flight / hasMore* / empty list)
            // no-op the extra ticks once the tail is reached.
            if (!isTabBusyRef.current(cat)) { const el = m._scrollingContainer; const sh = el.scrollHeight||0, ch = el.clientHeight||0; if (ch > 0 && sh - curST - ch < loadMoreThreshold) loadMoreRef.current(); }
            // Fallback tracking — normally the band listener has already
            // taken this reading on the last frame. Chrome subscribers only,
            // no page render (see the store).
            if (trackScroll(cat, curST) && reload) lastScrollCheckH.current = 0;
        }, SCROLL_MS);
        return () => { clearInterval(interval); unbindBand(); };
    }, [overscanByPixels, loadMoreThreshold, trackScroll]);

    // A write that landed is recorded at once, the direction memory kept. A
    // smooth one — the container's CSS — is still at its start when this
    // returns; the band listener follows it frame by frame. Recording its
    // target straight away made the first animation frame read as a jump
    // the opposite way: a scroll back to the top flashed the tab bar out of
    // view before bringing it back.
    const scrollTo = useCallback((top) => {
        const cat = categoryRef.current;
        const m = masonryRefs.current[cat]; if (!m?._scrollingContainer) return;
        const el = m._scrollingContainer;
        const from = el.scrollTop;
        el.scrollTop = top;
        const now = el.scrollTop;
        if (now !== from) { scrollTopRef.current[cat] = now; scrollStore.publish(); }
        m.forceUpdate();
    }, [scrollStore]);

    const scrollToIndex = useCallback((index) => {
        const idx = index ?? selectedPostIndex;
        // Viewport height comes from the scroll container itself — the
        // wrapper div is ~0 px tall (see root measurement above), so
        // rootDims.height would pin the target card to the top edge.
        const container = masonryRefs.current[categoryRef.current]?._scrollingContainer;
        const viewH = container?.clientHeight || rootDims.height || 0;
        const top = (topScrollByIndex.current[idx]||0) + (heightByIndex.current[idx]||0)/2 - viewH/3;
        scrollTo(top);
    }, [selectedPostIndex, rootDims.height, scrollTo]);

    const trackElementPosition = useCallback((index, top, height, rowIndex, columnIndex) => {
        topScrollByIndex.current[index] = top; heightByIndex.current[index] = height; xyByIndex.current[index] = [rowIndex, columnIndex];
    }, []);

    // The tab's MasonryExtended re-placed every cell from `from` on (a row
    // added, removed or changed there): the positions tracked past it are
    // stale until those cells render again. Called during the Masonry's
    // render — refs only. Same as the shared hook's.
    const onRelayout = useCallback((from) => {
        if (topScrollByIndex.current.length > from) topScrollByIndex.current.length = from;
        if (heightByIndex.current.length > from) heightByIndex.current.length = from;
    }, []);

    const postListHeight = windowHeight - (isMobile ? 80 : 96);

    // Force-clear all Masonry caches for the specified tab. Identical to the
    // [columnWidth, …, category] layout effect above, but callable. (A tab's
    // reload no longer calls it: MasonryExtended re-flows changed rows in
    // place.)
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
    // changes. Scroll ticks no longer touch it at all — the position lives
    // in `scrollStore` — so the grid object (and everything keyed on it)
    // holds still while the reader scrolls. masonryRefs is a ref and
    // setSelectedPostIndex a stable setter, so neither is a dep; SCROLL_MS
    // and overscanByPixels are covered by the fields derived from them.
    return useMemo(() => ({
        masonryRefs, setMasonryRef, setRootElement, cellMeasurerCache, cellPositioner, columnWidth, columnCount,
        scrollingResetTimeInterval: SCROLL_MS, scrollStore, scrollTo, scrollToIndex,
        pageWidth, postListHeight, rootDims, overscanByPixels, selectedPostIndex, setSelectedPostIndex,
        trackElementPosition, gutterSize, resetMasonry, onRelayout,
    }), [setMasonryRef, setRootElement, cellMeasurerCache, cellPositioner, columnWidth, columnCount,
        scrollStore, scrollTo, scrollToIndex, pageWidth, postListHeight, rootDims,
        overscanByPixels, selectedPostIndex, trackElementPosition, gutterSize, resetMasonry, onRelayout]);
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

    // Keep the OPEN post in step with the live list. Its card object is
    // replaced when a vote is applied (applyVoteToPost → placeholder row) and
    // again when the 6 s chain refresh lands (mergeFreshVoteDataInto → real
    // rshares + payout). PostDialog reads votes and payout from props.data, so
    // without this it kept showing the snapshot taken at open time — payout
    // frozen, voter list without the new vote. Identity check only: the
    // dialog keys its heavy work on the post id and treats a same-id data
    // swap as a vote resync.
    useEffect(() => {
        if (!artworkOpen) return;
        const cur = currentPostRef.current;
        if (!cur || !cur.permlink) return;
        const live = (posts || []).find(p => isSamePost(p, cur));
        if (live && live !== cur) setCurrentPost(live);
    }, [posts, artworkOpen]);
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

    // Push the post URL (optionally with a "#…" drawer-tab hash on the SAME
    // history entry — PostDialog adopts HISTORY.location.hash when it opens,
    // exactly as openCommentArtwork below relies on) and seat the dialog.
    const pushAndOpen = useCallback((data, rect, hash) => {
        const u = buildPostUrl(data); if (u) HISTORY.push(hash ? u + hash : u);
        orphanFetchTokenRef.current += 1;
        setIsOrphan(false);
        setArtworkOpen(true); setCurrentPost(data); setOriginRect(rect||null); historyDepthRef.current = 1;
    }, []);

    // Plain open — card title / image click on the posts tab.
    const openPost = useCallback((data, rect) => pushAndOpen(data, rect), [pushAndOpen]);

    // Comment-button open — pushes "…/permlink#replies" so PostDialog lands
    // on the comments tab. The bare hash just selects the tab; the comment
    // and reply cards add "&focus=<b64>" on top of it (openCommentArtwork).
    const openPostComments = useCallback(
        (data, rect) => pushAndOpen(data, rect, POST_DRAWER_TAB_HASHES[1]),
        [pushAndOpen],
    );

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
                const enriched = overlayPendingVote(enrichPostForCard(content, ca, {}));
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
        openPost, openPostComments, closePost, onDrawerPush, onDrawerPop, getReturnRect,
        nextPost: (isOrphan || !canGoNext) ? undefined : nextPost,
        previousPost: (isOrphan || !canGoPrev) ? undefined : previousPost,
        openCommentArtwork,
    }), [artworkOpen, currentPost, originRect, isOrphan,
        openPost, openPostComments, closePost, onDrawerPush, onDrawerPop, getReturnRect,
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

// ── ImageMeasurer accessors ────────────────────────────────────────────
// Module-level so they're referentially stable across renders. They were
// inline lambdas (`item=>item.image`, `item=>item.id`) — a fresh prop
// identity on every Profile render, every 380 ms scroll tick included,
// which defeated ImageMeasurer's PureComponent bail-out AND, now that its
// output is memoized on the keyMapper's identity, would have made it
// rebuild `itemsWithSizes` on every render. Same constants Feed and
// FeedPersonal hoist.
const GET_ITEM_IMAGE = (item) => item.image;
const GET_ITEM_ID = (item) => item.id;
// Initial value of the posts key-mapper ref, before the measurer has handed
// over its first `itemsWithSizes` (see renderPostsMasonry in the component).
const EMPTY_ITEMS = [];

// ── Scroll-driven chrome ───────────────────────────────────────────────
// The tab bar and the mobile card each draw one thing off the scroll
// position — tucked away or not — so each takes that flag from the scroll
// store and re-renders when it flips: a few times per scroll, where they
// used to take the raw numbers and re-render (the card's whole expanded
// body included) on every 380 ms tick. The tests are the very thresholds
// the two components applied to the raw numbers. Not memo'd: they still
// re-render with the page (language switch, data, own-profile flags), and
// the memo'd components inside bail when nothing they show changed.
const profileTabsHiddenMobile = (scrollTop, scrollY) => !(scrollY > 48 || scrollTop <= 72); // bottom bar slides down
const profileTabsHiddenDesktop = (scrollTop, scrollY) => scrollY < -48 && scrollTop >= 72;  // top bar slides up
const mobileCardHidden = (scrollTop, scrollY) => scrollY < 48 && scrollTop >= 72;           // card slides up

const ProfileTabsLive = ({ scrollStore, ...rest }) => {
    const hidden = useScrollFlag(scrollStore, rest.lessThan960w ? profileTabsHiddenMobile : profileTabsHiddenDesktop);
    return <ProfileTabs {...rest} hidden={hidden} />;
};

const ProfileMobileCardLive = ({ scrollStore, ...rest }) => {
    const hidden = useScrollFlag(scrollStore, mobileCardHidden);
    return <ProfileMobileCard {...rest} hidden={hidden} />;
};

// The create FAB only cares whether it's shown — scrolling up, or near the
// top — so it re-renders when that flips (or a prop changes) instead of on
// every tick. Same transforms and markup as before. `label` arrives as a
// string from the page, whose useLanguage() re-renders on a switch.
const isCreateFabShown = (scrollTop, scrollY) => scrollY > 48 || scrollTop <= 72;
const CREATE_FAB_ICON_STYLE = { marginRight: 12 };

const ProfileCreateFab = memo(function ProfileCreateFab({ className, scrollStore, isMobile, pushedDown, visible, label, onClick }) {
    const shown = useScrollFlag(scrollStore, isCreateFabShown);
    const transform = isMobile
        ? `translateX(50%) translateY(${pushedDown ? 200 : (shown ? -96 : 56)}px)`
        : `translateY(${shown ? -96 : 8}px)`;
    const style = useMemo(() => ({ transform }), [transform]);
    return (
        <div className={className} style={style}>
            {visible && <Fab onClick={onClick} variant="extended" size={isMobile ? "small" : "medium"}>
                {isMobile ? <AddAPhoto/> : <PhotoCameraRounded style={CREATE_FAB_ICON_STYLE}/>}
                {isMobile ? null : <span>{label}</span>}
            </Fab>}
        </div>
    );
});


// ╔══════════════════════════════════════════════════════════════════════╗
// ║  5. MAIN COMPONENT                                                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

const Profile = ({ classes, settings, pathname, api }) => {
    useLanguage();
    const { windowWidth, windowHeight, isMobile, overscanByPixels, artworkAheadPx, loadMoreThreshold } = useWindowDimensions();

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

    // ── The page's own URL ─────────────────────────────────────────────
    // The live pathname, except while a post dialog sits on top of the
    // page. A post URL (`/<category>/@author/permlink`) names the POST's
    // author and no tab, and following it swapped the page underneath the
    // dialog: opening a comment's root post from the comments tab (or a
    // post from the timeline) flipped the tab to "posts" and, for someone
    // else's post, loaded THAT author's profile — then swapped everything
    // back on close: refetch, re-measure, scroll position gone. Hold the
    // last page URL instead. A cold entry straight onto a post URL has no
    // previous one and keeps deriving the profile from the post's author,
    // as before.
    const pagePathnameRef = useRef(null);
    if (!pagePathnameRef.current || !isPostUrl(livePathname)) pagePathnameRef.current = livePathname;
    const pagePathname = pagePathnameRef.current;

    // Memoized on the page pathname: this parse (decodeURIComponent + three
    // regexes) used to run on EVERY Profile render for a URL that only
    // changes on navigation.
    const parsed = useMemo(() => parseProfilePathname(pagePathname), [pagePathname]);

    // ── Category / tab ─────────────────────────────────────────────────
    const [category, setCategory] = useState(Math.max(0, TAB_NAMES.indexOf(parsed.tab)));
    const [tabValue, setTabValue] = useState(1);
    const [mobileCardExpanded, setMobileCardExpanded] = useState(false);

    // ── Profile data ───────────────────────────────────────────────────
    const profile = useProfileData(api, pagePathname);
    const tabsReady = !!profile.readyName
        && profile.readyName.toLowerCase() === String(profile.account?.name || '').toLowerCase();
    const tabData = useTabData(api, profile.account, category, tabsReady);

    const loadMoreFn = useMemo(() => {
        if (category === 0) return tabData.loadMorePosts;
        if (category === 1) return tabData.loadMoreComments;
        if (category === 3) return tabData.loadMoreTimeline;
        return () => {};
    }, [category, tabData.loadMorePosts, tabData.loadMoreComments, tabData.loadMoreTimeline]);

    const grid = useMasonryGrid({ windowWidth, windowHeight, isMobile, overscanByPixels, artworkAheadPx, loadMoreThreshold, category, loadMoreFn, isTabBusy: tabData.isTabBusy });

    // NSFW filtering for the posts tab: when the filter is ON (_nsfw_filter
    // truthy) drop posts flagged nsfw before the masonry sees them. Blur of
    // shown posts is handled by PaperCard via _nsfw_enabled. Only the posts grid
    // carries nsfw cards; the other tabs are unchanged.
    // Delete animation (useCellExit): `exitingKeys` makes the posts grid
    // scale the leaving card down and fade it out; `exitedKeys` keeps it out
    // of the list afterwards, whatever a lagging refetch still returns.
    const { exitingKeys, exitedKeys, exitCell } = useCellExit();
    const visiblePosts = useMemo(
        () => (tabData.posts || []).filter((p) => !p.deleted && !exitedKeys.has(p.id) && (!settings._nsfw_filter || !p.nsfw)),
        [tabData.posts, settings._nsfw_filter, exitedKeys]
    );

    const postNav = usePostNavigation({ api, posts: visiblePosts, masonryRefs: grid.masonryRefs, scrollToIndex: grid.scrollToIndex, setSelectedPostIndex: grid.setSelectedPostIndex, profileUsername: parsed.username, nsfwEnabled: settings._nsfw_enabled });

    // ── Profile picture viewer ─────────────────────────────────────────
    // Click on the profile picture (ProfileSidebar / ProfileMobileCard call
    // `onOpenPicture` with the click event) → "#picture" is pushed, the
    // picture hero-animates out of its element into PictureDialog, rendered
    // with the current renderer like an artwork; closing flies it back and
    // pops the entry. A deep-linked "/@user#picture" opens it once the
    // account image is known. Mounted lazily on first open, kept mounted
    // afterwards, chunk warmed on idle — the PostDialog pattern.
    const pictureNav = usePictureDialog(profile.account?.image || '', { heroDelay: isMobile ? 0 : FAB_AWAY_MS + 30 });
    const [pictureDialogMounted, setPictureDialogMounted] = useState(false);
    useEffect(() => {
        if (pictureNav.open) setPictureDialogMounted(true);
    }, [pictureNav.open]);
    useEffect(() => {
        if (pictureDialogMounted) return;
        const id = idle(() => { loadPictureDialog().catch(() => {}); });
        return () => cancelIdle(id);
    }, [pictureDialogMounted]);
    // The wallet FAB steps aside for the whole viewer session — out before
    // the picture takes off (the dialog waits for it), still out while the
    // picture flies back and lands, back once the dialog has faded out.
    const [fabAway, setFabAway] = useState(false);
    useEffect(() => {
        if (pictureNav.open) { setFabAway(true); return undefined; }
        const t = setTimeout(() => setFabAway(false), FAB_RETURN_DELAY_MS);
        return () => clearTimeout(t);
    }, [pictureNav.open]);

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
    // Keyed on the page URL (see pagePathname): a post dialog opening on
    // top leaves the tab and the modals alone. No scrollTo(0) on a tab
    // change any more — the new tab's Masonry mounts at the top, and the
    // old call only scrolled (and force-rendered) the tab being unmounted.
    useEffect(() => {
        const newTab = Math.max(0, TAB_NAMES.indexOf(parsed.tab));
        if (newTab !== category) setCategory(newTab);
        if (parsed.modal === 'wallet') { setWalletOpen(true); setWalletView(walletViewToTabValue(parsed.walletView)); setFollowListOpened(''); }
        else if (parsed.modal === 'followers') { setWalletOpen(false); setFollowListOpened('FOLLOWERS'); }
        else if (parsed.modal === 'following') { setWalletOpen(false); setFollowListOpened('FOLLOWING'); }
        else { setWalletOpen(false); setFollowListOpened(''); }
    }, [parsed]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-collapse the expanded mobile card once the reader scrolls down
    // past it — read off the scroll store, so the check costs no page render
    // (it runs every frame while the tab scrolls; setting false over false
    // bails without rendering).
    const { scrollStore } = grid;
    useEffect(() => {
        const check = () => {
            if (scrollStore.getScrollY() < 0 && scrollStore.getScrollTop() >= 72) setMobileCardExpanded(false);
        };
        check();
        return scrollStore.subscribe(check);
    }, [scrollStore]);

    // Force masonry update when data changes
    const activeData = [tabData.posts, tabData.comments, tabData.replies, tabData.timeline][category];

    // No masonry reset when the visible tab's rows change (a reload after a
    // publish, an edit or a delete, the NSFW filter flipping, a profile
    // switch emptying the lists): its MasonryExtended re-flows the rows past
    // the first change in place, measuring only what is new or changed —
    // where the old per-tab reset re-measured every visible cell, with a
    // flash, under the reader. Layout changes (column width, tab switch)
    // still start over in the grid hook.
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
            // No scrollTo(0) here: the new tab's Masonry mounts at the top,
            // and scrollTo would target — and force-render — the outgoing
            // tab's Masonry right before it unmounts.
            setCategory(value);
        }
        else grid.scrollTo(0); // same tab again: scroll back to its top
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
    // NewPost re-created a closure per render — and Profile then re-rendered
    // on every 380 ms scroll tick — churning those children's props for
    // nothing. All setters below are stable, so these are created once.
    const toggleMobileCard = useCallback(() => setMobileCardExpanded(p => !p), []);
    const closeMobileCard = useCallback(() => setMobileCardExpanded(false), []);
    const openCreateArtwork = useCallback(() => setCreateArtworkOpen(true), []);
    const closeCreateArtwork = useCallback(() => setCreateArtworkOpen(false), []);
    const closeCreateCommunity = useCallback(() => setCreateCommunityOpen(false), []);

    const openCardMenu = useCallback((ev, data) => { setMenuCardXY(Int32Array.of(ev.x-24,ev.y-24)); setMenuCardData(data); }, []);
    const closeCardMenu = useCallback(() => { setMenuCardXY(Int32Array.of(0,0)); setMenuCardData({}); }, []);

    // ── Delete animation ───────────────────────────────────────────────
    // A post of this profile deleted while the page is up — from the card
    // menu's dialog, or anywhere else that broadcasts it (the API's
    // content_deleted, or a content_updated carrying the `deleted` flag) —
    // scales down and fades out on the posts grid, then leaves the list, and
    // the cards past it glide into its place. The tab refetch scheduled for
    // the same event confirms it later without moving anything.
    const { markPostDeleted } = tabData;
    const visiblePostsRef = useRef(visiblePosts);
    visiblePostsRef.current = visiblePosts;
    const exitPost = useCallback((post) => {
        if (post && post.id != null) exitCell(post.id, markPostDeleted, DELETE_EXIT_DELAY_MS);
    }, [exitCell, markPostDeleted]);
    useEffect(() => {
        if (!api?.eventEmitter) return;
        const exitByRef = (payload) => {
            if (!payload?.permlink) return;
            exitPost((visiblePostsRef.current || []).find((p) => isSamePost(p, payload)));
        };
        const onContentDeleted = (payload) => exitByRef(payload);
        const onContentUpdated = (payload) => {
            if (payload?.jsonMetadata?.deleted === true) exitByRef(payload);
        };
        api.eventEmitter.on('content_deleted', onContentDeleted);
        api.eventEmitter.on('content_updated', onContentUpdated);
        return () => {
            api.eventEmitter.off('content_deleted', onContentDeleted);
            api.eventEmitter.off('content_updated', onContentUpdated);
        };
    }, [api, exitPost]);

    // ── Own-content management (card menu → page-level dialogs) ────────
    const [editPostData, setEditPostData] = useState(null);
    const [deletePostData, setDeletePostData] = useState(null);
    const [deleteCommentData, setDeleteCommentData] = useState(null);
    // The post the delete dialog was opened for, kept past the dialog's
    // close for a success callback that arrives after it.
    const deleteTargetRef = useRef(null);
    const onEditPost = useCallback((data) => { setEditPostData(data); }, []);
    const onDeletePost = useCallback((data) => { deleteTargetRef.current = data; setDeletePostData(data); }, []);
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
    // The broadcast's content event usually starts the exit first; this
    // covers a delete that reports success without one. It runs once either
    // way (useCellExit ignores a key it already has).
    const handlePostDeleted = useCallback((deleted) => {
        exitPost(deleted && deleted.id != null ? deleted : deleteTargetRef.current);
    }, [exitPost]);
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
    // `grid` object, so a layout-irrelevant change to it never re-creates
    // the renderers (and hands the mounted MasonryExtended a new
    // cellRenderer prop). The fields below only change on layout changes.
    const {
        columnCount, columnWidth, trackElementPosition, cellMeasurerCache,
        selectedPostIndex, postListHeight,
    } = grid;
    const { openPost, openPostComments, openCommentArtwork } = postNav;
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

    // `tabData.posts` is deliberately NOT a dependency of cellRendererPosts:
    // the renderer reads its rows from parent.props.itemsWithSizes, and the
    // forceUpdate effect on [activeData, category] above already re-runs it
    // for appends and vote patches. Keying it on the list handed the mounted
    // MasonryExtended a new cellRenderer on every list change for nothing.
    // (The comments / replies / timeline renderers index their lists
    // directly, so theirs stay.)
    const cellRendererPosts = useCallback((data) => {
        const {index, key, parent, style, isScrolling, top: placedTop} = data;
        if (!parent?.props?.itemsWithSizes?.[index|0]) return null;
        const {item, size} = parent.props.itemsWithSizes[index|0]; if (!size.height) return null;
        const colIdx = index%columnCount, rowIdx = (index-colIdx)/columnCount;
        const ih = Math.ceil(columnWidth*(size.height/size.width))||0; style.width = columnWidth;
        // Where the cell sits: the Masonry's `top` param (under useTransform the
        // style's `top` is 0 and the position is a transform). NaN on the
        // measurement pass — ignored by the tracker, "not visible" below.
        // `style.top` is the fallback for a Masonry build without the param.
        const top = placedTop !== undefined ? +placedTop : +style.top;
        trackElementPosition(index, top, +style.height, rowIdx, colIdx);
        // Artwork band — the card draws its artwork once it comes within
        // `artworkAheadPx` of the viewport, on either side (sticky: once
        // drawn, a card stays drawn). Shared with the feeds and Community and
        // sized by useWindowDimensions against the Masonry's mount window.
        const container = parent._scrollingContainer; const st = container?container.scrollTop:0;
        const bottom = top+(+style.height);
        const viewH = container?container.clientHeight:postListHeight;
        const visible = artworkAheadPx+bottom>st && top<st+viewH+artworkAheadPx;
        cellMeasurerCache.visible_ids[size.id] = visible||(cellMeasurerCache.visible_ids[size.id]||false);
        return (<CellMeasurer cache={cellMeasurerCache} index={index} key={key} parent={parent}>
            <PaperCard onOpen={openPost} onCommentsClick={openPostComments} locales={locales} nsfw={settings._nsfw_enabled} data={item} renderer={settings._renderer} mode={settings._mode} onMenuClick={openCardMenu} api={api} voter={profile.loggedInUser} onVoteChange={onVoteChange} is_scrolling={isScrolling} selected={selectedPostIndex===index} size={size} visible={cellMeasurerCache.visible_ids[size.id]} column_width={columnWidth} image_height={ih} image_width={columnWidth} id={size.id} key={size.id} rowIndex={rowIdx} columnIndex={colIdx} style={style} />
        </CellMeasurer>);
    }, [columnCount, columnWidth, trackElementPosition, cellMeasurerCache,
        selectedPostIndex, postListHeight, artworkAheadPx, openPost, openPostComments,
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
    // Empty only once this tab has loaded for this profile — and it stays
    // empty-stated while a later reload revalidates in the background (the
    // old global-loading test flashed it before every first load and blinked
    // it, fade-in and all, whenever any tab refreshed).
    const tabLoaded = (tabData.loadedMask & tabBit(category)) !== 0;
    const isEmpty = tabLoaded && !profile.isLoading && activeData.length === 0 && accountName;
    let emptyState = isEmpty ? (<div className={classes.emptyState} key={`empty-${es.key}`}><div className={classes.emptyStateIcon}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{es.icon}</svg></div><div className={classes.emptyStateTitle}>{es.title}</div><div className={classes.emptyStateSubtitle}>{es.sub}</div></div>) : null;

    // The four Masonry instances are rendered UNCONTROLLED — no `scrollTop`
    // prop (see the note in MasonryExtended): they track their own scroll
    // events, and the hook's scrollTo writes the container directly. The
    // page chrome (ProfileTabs, ProfileMobileCard, the FAB) reads the
    // position from grid.scrollStore.
    // Memoized: this object is spread into every MasonryExtended; its four
    // inputs only change on a layout change, so the spread never churns the
    // Masonry's props on a scroll tick.
    const masonryProps = useMemo(() => ({
        scrollingResetTimeInterval: grid.scrollingResetTimeInterval,
        height: grid.postListHeight,
        overscanByPixels: grid.overscanByPixels,
        width: grid.pageWidth,
        onRelayout: grid.onRelayout,
    }), [grid.scrollingResetTimeInterval, grid.postListHeight, grid.overscanByPixels, grid.pageWidth, grid.onRelayout]);

    // ── Masonry key-mappers, one per tab, created once ─────────────────
    // All four were inline lambdas — a fresh `keyMapper` prop on every
    // Profile render, which alone fails MasonryExtended's shallow prop
    // compare. Each now reads its list through a ref refreshed during
    // render, before the Masonry vnode is created, so it never goes stale.
    // The keys are the ones the lambdas produced (size id, date, date,
    // event id); only the never-hit fallbacks are now deterministic.
    const postsItemsRef = useRef(EMPTY_ITEMS);
    const commentsRef = useRef(tabData.comments);
    const repliesRef = useRef(tabData.replies);
    const timelineRef = useRef(tabData.timeline);
    commentsRef.current = tabData.comments;
    repliesRef.current = tabData.replies;
    timelineRef.current = tabData.timeline;
    const postsKeyMapper = useCallback((i) => { const e = postsItemsRef.current[i]; return e ? e.size.id : `missing_${i}`; }, []);
    const commentsKeyMapper = useCallback((i) => { const c = commentsRef.current?.[i]; return c ? c.date : `missing_${i}`; }, []);
    const repliesKeyMapper = useCallback((i) => { const r = repliesRef.current?.[i]; return r ? r.date : `missing_${i}`; }, []);
    const timelineKeyMapper = useCallback((i) => { const ev = timelineRef.current?.[i]; return ev ? ev.id : `tl_${i}`; }, []);
    // What each cell's height depends on, per tab (PaperCard's own key for
    // the posts grid, ROW_SHAPES for the lists): a row whose key changes —
    // an edit — is re-measured in place and the rows past it re-flow.
    const postsLayoutKey = useCallback((i) => paperCardLayoutKey(postsItemsRef.current[i]), []);
    const commentsLayoutKey = useCallback((i) => rowLayoutKey(1, commentsRef.current?.[i]), []);
    const repliesLayoutKey = useCallback((i) => rowLayoutKey(2, repliesRef.current?.[i]), []);
    const timelineLayoutKey = useCallback((i) => rowLayoutKey(3, timelineRef.current?.[i]), []);

    // The posts tab's ImageMeasurer render-prop, memoized on what it forwards
    // (it was an inline arrow, failing ImageMeasurer's PureComponent compare
    // on every render). Everything it forwards only changes on a layout
    // change, so it is stable across scroll ticks: a page render (data, a
    // dialog) re-renders neither the measurer nor the Masonry.
    const { cellMeasurerCache: gridCache, cellPositioner: gridPositioner, setMasonryRef } = grid;
    const renderPostsMasonry = useCallback((itemsWithSizes) => {
        postsItemsRef.current = itemsWithSizes || EMPTY_ITEMS;
        return (
            <MasonryExtended key="masonry-profile-posts" {...masonryProps}
                             cellCount={(itemsWithSizes||[]).length|0} itemsWithSizes={itemsWithSizes}
                             keyMapper={postsKeyMapper} cellLayoutKey={postsLayoutKey} exitingKeys={exitingKeys}
                             cellMeasurerCache={gridCache} cellPositioner={gridPositioner}
                             cellRenderer={cellRendererPosts} ref={setMasonryRef(0)} />
        );
    }, [masonryProps, postsKeyMapper, postsLayoutKey, exitingKeys, gridCache, gridPositioner, cellRendererPosts, setMasonryRef]);

    let body = null;
    if (!isEmpty) {
        if (category === 0) body = (
            <ImageMeasurer key="posts" className={classes.masonry} items={visiblePosts} image={GET_ITEM_IMAGE} keyMapper={GET_ITEM_ID}>
                {renderPostsMasonry}
            </ImageMeasurer>
        );
        else if (category === 1) body = (<div className={classes.masonry} key="comments"><MasonryExtended key="masonry-comments" {...masonryProps} cellCount={(tabData.comments||[]).length|0} items={tabData.comments} keyMapper={commentsKeyMapper} cellLayoutKey={commentsLayoutKey} cellMeasurerCache={grid.cellMeasurerCache} cellPositioner={grid.cellPositioner} cellRenderer={cellRendererComments} ref={grid.setMasonryRef(1)} /></div>);
        else if (category === 2) body = (<div className={classes.masonry} key="replies"><MasonryExtended key="masonry-replies" {...masonryProps} cellCount={(tabData.replies||[]).length|0} items={tabData.replies} keyMapper={repliesKeyMapper} cellLayoutKey={repliesLayoutKey} cellMeasurerCache={grid.cellMeasurerCache} cellPositioner={grid.cellPositioner} cellRenderer={cellRendererReplies} ref={grid.setMasonryRef(2)} /></div>);
        else body = (<div className={`${classes.masonry} ${classes.masonryTimeline}`} key="timeline"><MasonryExtended key="masonry-timeline" {...masonryProps} cellCount={(tabData.timeline||[]).length|0} items={tabData.timeline} keyMapper={timelineKeyMapper} cellLayoutKey={timelineLayoutKey} cellMeasurerCache={grid.cellMeasurerCache} cellPositioner={grid.cellPositioner} cellRenderer={cellRendererTimeline} ref={grid.setMasonryRef(3)} /></div>);
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
        // Profile picture click → PictureDialog. Pass the click event itself
        // (its currentTarget is the element the picture flies out of).
        onOpenPicture: pictureNav.openPicture,
        // fabAway (the wallet FAB stepping aside for the picture's flight) is
        // handed to the sidebar alone, below: it flips as the viewer opens,
        // and in here it rebuilt this whole object — inline handlers
        // included — so the mobile card (tabs, swipeable views and all)
        // re-rendered on the picture's first frame for a prop it never reads.
    }), [profile, postsCount, tabValue, classes, openFollowListModal, goToCommunity, handleWalletOpen, pictureNav.openPicture]);

    const bottomBarHidden = isMobile && mobileCardExpanded;
    const createLabel = t("words.create", {TUC: true});

    // ── Render ─────────────────────────────────────────────────────────
    // The tab bar, mobile card and create FAB read their hidden/shown flag
    // from grid.scrollStore and re-render themselves when it flips; nothing
    // else on this page re-renders with the scroll.
    return (
        <React.Fragment>
            <div className={classes.root}>
                {isMobile && <ProfileMobileCardLive scrollStore={scrollStore} {...sidebarProps} expanded={mobileCardExpanded} height={windowHeight} onToggleExpanded={toggleMobileCard} onCloseExpanded={closeMobileCard} />}
                <div className={classes.viewLeft}>
                    <ProfileTabsLive scrollStore={scrollStore} classes={classes} category={category} isOwnProfile={profile.isOwnProfile} onChange={handleCategoryChange} lessThan960w={isMobile} forceHidden={bottomBarHidden} />
                    <ProfileCreateFab className={classes.mainFab} scrollStore={scrollStore} isMobile={isMobile}
                                      pushedDown={bottomBarHidden} visible={!!profile.isOwnProfile}
                                      label={createLabel} onClick={openCreateArtwork} />
                    {emptyState}
                </div>
                {!isMobile && <ProfileSidebar {...sidebarProps} fabAway={fabAway} />}
            </div>

            <div style={{position:"absolute"}} ref={grid.setRootElement}>
                {body}
            </div>

            <PaperCardMenuOption xy={menuCardXY} data={menuCardData} onClose={closeCardMenu}
                                 viewer={profile.loggedInUser}
                                 onEditPost={onEditPost} onDeletePost={onDeletePost}
                                 onDeleteComment={onDeleteComment} />

            {/* The one author hover card for the posts, comments and replies
                cards of every tab — the cards' <ProfileHoverAnchor>s only
                carry listeners. Renders nothing until a name is hovered;
                closes on the wallet's /@name/wallet round trip like on any
                other route change; unmounts with the page. */}
            <ProfileHoverCardLayer />

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

            {pictureDialogMounted && (
                <React.Suspense fallback={DIALOG_FALLBACK}>
                    <LazyPictureDialog open={pictureNav.open} src={pictureNav.src}
                                       renderer={settings._renderer} mode={settings._mode}
                                       originRect={pictureNav.originRect} getReturnRect={pictureNav.getReturnRect}
                                       onClose={pictureNav.closePicture} />
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