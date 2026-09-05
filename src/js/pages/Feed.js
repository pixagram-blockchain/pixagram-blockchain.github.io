import * as React from "preact/compat";
import { useState, useEffect, useCallback, useMemo, useRef, memo } from "preact/compat";
// Coalesce co-arriving setState calls into one render. Preact auto-batches
// inside event handlers but NOT across an `await` (each setState in a promise
// continuation would otherwise re-render separately).
import { unstable_batchedUpdates as batch } from "preact/compat";
import { HISTORY, buildPostUrl, isPostUrl, parsePostUrl, isDeletedPost } from "../utils/constants";
import withStyles from "@material-ui/core/styles/withStyles";
import * as actions from "../actions/utils";
import { CellMeasurer } from "@pixagram/virtualized/dist/es/index";
import MasonryExtended from "../components/MasonryExtended";
import useWindowDimensions from "../hooks/useWindowDimensions";
import useMasonryGrid from "../hooks/useMasonryGrid";
import { idle, cancelIdle } from "../utils/idle";
import viewCache, { postsSignature } from "../utils/viewCache";
import useVoteSync from "../hooks/useVoteSync";
import { applyOptimisticVote, overlayPendingVote, overlayPendingVotes, mergeFreshVoteDataInto, votesSignature } from "../utils/voteSync";
import { EASE, RAINBOW_RIPPLE } from "../theme/motion";
import ImageMeasurer from "../components/ImageMeasurer";

import PaperCard, { isArtworkBlurred } from "../components/PaperCard";
import Tab from "@material-ui/core/Tab";
import Tabs from "@material-ui/core/Tabs";
import PaperCardMenuOption from "../components/PaperCardMenuOption";
import PhotoCameraRounded from "@material-ui/icons/PhotoCameraRounded";
import MonetizationOnRounded from "@material-ui/icons/MonetizationOnRounded";
import Fab from "@material-ui/core/Fab";
import Community from "../icons/Community";
import NewBox from "../icons/NewBox";
import Fire from "../icons/Fire";
import TrendingUp from "../icons/TrendingUp";

import { t, useLanguage } from "../utils/text";

// ── Deferred create dialog ───────────────────────────────────────────────
// Single loader shared by React.lazy and the idle prefetch below, so both
// resolve the SAME dynamic-import module-cache entry. NewPost is the heaviest
// dialog (the full artwork editor) and is only needed on the CREATE action,
// so it's split out of the feed chunk and loaded on demand.
const loadNewPost = () => import("../components/NewPost");
const LazyNewPost = React.lazy(loadNewPost);

// PostDialog is the full post viewer (recursive comment threads, vote lists,
// artwork rendering) — the most common thing opened after the feed, but not
// needed to PAINT the feed. Feed is the default landing surface after Home
// (`/created/` and every non-community post deep-link cold-mounts here — see
// Index's OVERLAY_HOSTS_BY_POST_KIND), so keeping the viewer out of this
// chunk directly shrinks the app's main entry path. Warmed on idle for
// everyone (see effect in the component) so the open-from-card animation
// isn't gated on a cold chunk fetch. Mirrors FeedPersonal / Profile, which
// already lazy-load it; Feed was the last page chaining it in statically.
const loadPostDialog = () => import("../components/PostDialog");
const LazyPostDialog = React.lazy(loadPostDialog);

// Edit / delete share one module and are reached only from the card menu on
// your own posts — warmed on idle for logged-in users only. Same split as
// FeedPersonal / Profile.
const loadOwnPostDialogs = () => import("../components/EditPostDialog");
const LazyEditPostDialog = React.lazy(loadOwnPostDialogs);
const LazyDeletePostDialog = React.lazy(() => loadOwnPostDialogs().then(m => ({ default: m.DeletePostDialog })));

// Suspense fallback for a lazily-loaded dialog. Shown ONLY on a cold open —
// when the dialog's chunk isn't cached yet because idle-prefetch hasn't run.
// A dim backdrop appears instantly so the tap reads as "opening…" instead of
// a blank frame; the real dialog (with its own backdrop + open animation)
// replaces it the moment the chunk resolves. Warm opens never hit this.
const DIALOG_FALLBACK = (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1300 }} />
);


// ╔══════════════════════════════════════════════════════════════════════╗
// ║  1. STYLES                                                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

const styles = theme => ({
    mainTab: {
        animation: `$slideInFromTop 300ms ${EASE} 0ms`,
        "@global": {
            "@keyframes slideInFromTop": {
                "0%": { transform: "translateY(-96px)", filter: "opacity(0)" },
                "100%": { transform: "translateY(0px)", filter: "opacity(1)" },
            },
        },
        backgroundColor: "#101010",
        "& .MuiTab-textColorPrimary.Mui-selected": { backgroundColor: "transparent" },
        "& .MuiTab-textColorPrimary.Mui-selected .MuiTab-wrapper": { color: "#101010 !important" },
        "& .MuiTab-fullWidth": {
            backgroundColor: "transparent", color: "#989898",
            transition: `all 225ms ${EASE} 0ms`, borderRadius: "21px",
        },
        "& .MuiTab-fullWidth:hover": { backgroundColor: "rgba(255,255,255,0.06)" },
        "& span.MuiTabs-indicator": {
            zIndex: "-1", height: "48px", backgroundColor: "#c7c7c7",
            borderRadius: "21px", transform: "scale3d(0.875, 0.75, 1)",
        },
        margin: "21px 16px", width: "calc(100% - 32px)", borderRadius: "21px",
        position: "absolute", top: 0, left: 0, zIndex: 1,
        transition: `transform 225ms ${EASE} 75ms`,
    },
    mainFab: {
        animation: `$slideInFromBottom 300ms ${EASE} 0ms`,
        "@global": {
            "@keyframes slideInFromBottom": {
                "0%": { transform: "translateY(160px)", filter: "opacity(0)" },
                "100%": { transform: "translateY(0px)", filter: "opacity(1)" },
            },
        },
        // env() lifts the FAB above the Android gesture nav bar when Chrome
        // draws edge-to-edge (Android 15+); resolves to 0px everywhere else.
        position: "fixed", right: 16, bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
        transition: `transform 225ms ${EASE} 75ms`,
        "& .MuiButtonBase-root": {
            borderRadius: "32px", background: "#f6f6f6", transform: "scale(1)",
            animationName: "$bounce-feed", animationTimingFunction: EASE,
            animationDuration: "3.2s", animationFillMode: "both",
            animationDelay: "1s", animationIterationCount: "infinite",
            boxShadow: "0 0 8px #ffffff88, 0 0 16px #ffffffcc",
            "@global": {
                "@keyframes bounce-feed": {
                    "0%": { boxShadow: "0 0 8px #ffffff88, 0 0 16px #ffffffcc", transform: "scale(1)" },
                    "3%": { boxShadow: "0 0 12px #ffffff88, 0 0 24px #ffffffcc", transform: "scale(1.05)" },
                    "6%": { boxShadow: "0 0 4px #ffffff88, 0 0 8px #ffffffcc", transform: "scale(0.975)" },
                    "9%": { boxShadow: "0 0 8px #ffffff88, 0 0 16px #ffffffcc", transform: "scale(1)" },
                },
            },
            transition: `background 225ms ${EASE} 75ms`,
            "& .MuiTouchRipple-root": {
                filter: "opacity(1)",
                "& .MuiTouchRipple-child": {
                    backgroundImage: `radial-gradient(circle at 50% 50%,
                        magenta 0%, blue 20%, cyan 40%, green 60%, yellow 80%, red 100%)`,
                },
            },
        },
        "& .MuiButtonBase-root:hover": {
            background: "#ffffff", boxShadow: "0 0 8px #ffffff88, 0 0 16px #ffffffcc",
        },
        "& .MuiTouchRipple-child": { backgroundImage: RAINBOW_RIPPLE },
        "& .MuiFab-extended": { padding: "0 24px", height: 64, fontSize: "1.125rem" },
        "& .MuiFab-extended .MuiSvgIcon-root": { fontSize: "1.75rem" },
    },
    masonry: {
        overflow: "hidden overlay !important", contain: "style layout",
        "& > .ReactVirtualized__Masonry": {
            zIndex: 0, position: "absolute", margin: 0, scrollBehavior: "smooth",
            willChange: "scroll-position !important", overscrollBehavior: "none",
            contentVisibility: "auto", boxSizing: "content-box !important",
            touchAction: "pan-y", overflow: "hidden overlay !important",
            padding: "86px 12px 32px 16px", contain: "style layout size",
            "& > .ReactVirtualized__Masonry__innerScrollContainer": {
                top: "auto !important", left: "auto !important",
                overflow: "initial !important", position: "absolute !important",
                paddingBottom: "160px", boxSizing: "content-box",
                contain: "style layout size",
                "& div": { contain: "style layout" },
            },
        },
    },
});


// ╔══════════════════════════════════════════════════════════════════════╗
// ║  2. PURE HELPERS                                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

const SORT_METHODS = ['created', 'hot', 'trending', 'promoted'];

// ImageMeasurer accessors — hoisted so they're referentially stable across
// renders. Inline `item => item.image` lambdas handed ImageMeasurer a fresh
// prop identity on every render (every 380 ms scroll tick included), defeating
// any shallow-compare bail-out inside it.
const GET_ITEM_IMAGE = (item) => item.image;
const GET_ITEM_ID = (item) => item.id;

// ── Blur-aware sibling walk (dialog prev/next) ─────────────────────────
// PaperCard owns the "is this card blurred" truth (author/server NSFW flag
// OR the on-device detector's cached verdict, honoured only while the
// user's "show NSFW" toggle is off). The dialog's prev/next must skip
// exactly those cards, and an arrow only renders when this walk can land
// somewhere.
const isSamePost = (p, cur) => !!p && !!cur
    && p.permlink === cur.permlink
    && (p.author?.username || p.author) === (cur.author?.username || cur.author);

// First index after `from` (exclusive) in direction `dir` (+1/-1) whose
// artwork is NOT blurred on its card; -1 when the walk exhausts the list.
// `getPost` adapts the entry shape (Masonry's {item,size} vs plain post
// objects) — the card id equals the post id (GET_ITEM_ID feeds the
// measurer), so the detector cache is keyed the same either way.
const findNavigableIndex = (list, from, dir, nsfwEnabled, getPost) => {
    for (let i = from + dir; i >= 0 && i < list.length; i += dir) {
        const p = getPost ? getPost(list[i]) : list[i];
        if (p && !isArtworkBlurred(p, p.id, nsfwEnabled)) return i;
    }
    return -1;
};

// Sorting-tab faces — hoisted vnodes (same rationale as the accessors above).
// Mobile keeps the bare icons; desktop pairs each icon with a text label so
// the tabs say what they sort by. Order mirrors SORT_METHODS.
//
// Only the ICONS can be hoisted to module scope: they carry no text. The
// labelled faces used to live here too, which froze them in whichever locale
// was live when this chunk was parsed — switching language in Settings left
// the tabs reading the old one until a full reload, and the first-visit tour
// (which names these four tabs in its copy) would then disagree with them.
// They are built per-render inside the component instead, memoised on the
// resolved strings so identity still stays stable across scroll ticks.
const LABEL_ROW = { display: "inline-flex", alignItems: "center" };
const LABEL_TEXT = { marginLeft: 8 };
const SORT_TAB_ICONS = [<NewBox />, <Fire />, <TrendingUp />, <MonetizationOnRounded />];

const parseSortFromPathname = (pathname) => {
    const match = (pathname || '').match(/^\/(created|hot|trending|promoted)(?:\/|$)/);
    return match ? Math.max(0, SORT_METHODS.indexOf(match[1])) : 0;
};

const parseTagFromPathname = (pathname) => {
    const match = (pathname || '').match(/^\/(?:created|hot|trending|promoted)\/([a-z\-]+)(?:\/|$)/);
    return match ? match[1] : '';
};

const resolveDisplayName = (account, fallback) => {
    const dn = account._profile && account._profile.display_name;
    return (typeof dn === 'string' && dn.trim()) || account.name || fallback || '';
};

const parsePayoutValue = (raw) => parseFloat((raw || '0').replace(/[^0-9.\-]/g, '')) || 0;

// ── Parsed-metadata cache ───────────────────────────────────────────────
// json_metadata is consulted by several consumers per post (NSFW resolution
// here, the deleted flag, hydration) and AGAIN in phase 2 of the two-phase
// enrichment, which re-maps the SAME raw post objects to patch avatars in.
// Parsing a multi-KB string 3-6× per card is pure repeated main-thread work
// on every load and refetch. One WeakMap-cached parse per raw post object;
// an edited post arrives as a NEW object from the node, so staleness is
// impossible, and the map holds no reference once the post is dropped.
const JSON_META_CACHE = new WeakMap();
const getJsonMeta = (post) => {
    if (!post || typeof post !== 'object') return {};
    const raw = post.json_metadata;
    if (!raw) return {};
    if (typeof raw !== 'string') return raw;
    let meta = JSON_META_CACHE.get(post);
    if (meta === undefined) {
        // `|| {}` also absorbs a valid-JSON `null` payload, which the old
        // per-call parses handed straight to `.tags` readers.
        try { meta = JSON.parse(raw) || {}; } catch { meta = {}; }
        JSON_META_CACHE.set(post, meta);
    }
    return meta;
};

// ── NSFW resolution ─────────────────────────────────────────────────────
// A post can declare NSFW two ways: as the literal "nsfw" tag in its tags
// array, or as a top-level boolean property in json_metadata
// (e.g. { nsfw: true }). The feed pipeline only flattens the tags array,
// so consumers must consult both signals or NSFW posts using the metadata
// property slip through unblurred. Tag matching is case-insensitive
// because third-party clients don't always normalize.
const isNsfwPost = (post) => {
    const tags = post?._tags || [];
    if (tags.some(t => typeof t === 'string' && t.toLowerCase() === 'nsfw')) return true;
    const meta = getJsonMeta(post);
    if (meta && (meta.nsfw === true || meta.nsfw === 'true' || meta.nsfw === 1)) return true;
    const metaTags = (meta && Array.isArray(meta.tags)) ? meta.tags : [];
    return metaTags.some(t => typeof t === 'string' && t.toLowerCase() === 'nsfw');
};

// Soft-deleted content: the author re-broadcast the post with meta.deleted
// set via the edit flow. The flag lives ONLY in metadata — never as a tag,
// so deleted posts can't be enumerated through a browsable tag page. Posts
// with votes can never be hard-deleted on chain, so this is the platform's
// delete semantics — every listing filters it out unconditionally. The tag
// checks below are a defensive fallback only.
// isDeletedPost now lives in utils/constants. Feed, FeedPersonal, Profile and
// Community each carried a byte-identical private copy, and the two full-view
// dialogs need the same predicate against the enriched card shape. One
// definition, no drift.

// ── Content hydration for direct-URL (orphan) posts ────────────────────
// getContent from the chain returns a raw discussion; the feed pipeline
// normally populates derived fields (_images, _tags, _summary,
// _content_type) during enrichPostsList. For a single orphan fetch we
// replicate that here so the card renders consistently with feed posts.
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
    if (!content._description_html && !content._summary) {
        const s = (content.body||'').replace(/<img[^>]*>/gi,'').replace(/!\[[^\]]*\]\([^)]+\)/g,'').replace(/<[^>]+>/g,'').trim();
        if (s.length) content._summary = s.length > 300 ? s.slice(0,300)+'…' : s;
    }
    if (!content._content_type) content._content_type = 'pixel_art';
    return content;
};

const enrichPostForCard = (post, account, voterProfiles) => {
    const pendingPayout = parsePayoutValue(post.pending_payout_value);
    const totalPayout = parsePayoutValue(post.total_payout_value);
    const curatorPayout = parsePayoutValue(post.curator_payout_value);
    const payout = pendingPayout > 0 ? pendingPayout : totalPayout + curatorPayout;

    const tags = post._tags || [];
    const images = post._images || [];
    const firstImage = images[0] ?? null;
    const imageSrc = firstImage ? (typeof firstImage === 'string' ? firstImage : firstImage.src) : null;
    const activeVotes = post.active_votes || [];

    return {
        id: post._entity_id || post.id || `${post.author}_${post.permlink}`,
        author: {
            username: account.name || '',
            name: resolveDisplayName(account),
            image: account.image || account._profile?.profile_image || '',
        },
        title: post.root_title || post.title || '',
        image: imageSrc,
        date: post.created ? new Date(post.created).getTime() : Date.now(),
        payout: `$${payout.toFixed(2)}`,
        upVotesNumber: Math.max(0, post.net_votes || activeVotes.filter(v => v?.weight >= 0).length || 0),
        downVotesNumber: Math.max(0, activeVotes.filter(v => v?.weight < 0).length || 0),
        active_votes: activeVotes,
        // Post-level rshares as the chain saw them — lets the card price its
        // own pending vote on the fund's reward curve (useVotePayoutEstimate).
        net_rshares: post.net_rshares != null ? String(post.net_rshares) : '0',
        _voter_profiles: voterProfiles || {},
        nsfw: isNsfwPost(post),
        deleted: isDeletedPost(post),
        tags,
        permlink: post.permlink || '',
        category: post.category || '',
        _content_type: post._content_type || 'pixel_art',
        _description_html: post._description_html || '',
        _summary: post._summary || '',
        json_metadata: post.json_metadata || '',
        children: post.children ?? 0,
        commentsNumber: post.children ?? 0,
    };
};

// Fetch a single post by author/permlink and return an enriched post card
// object, or null if unreachable. Used when the user deep-links to a post
// that isn't in the currently loaded feed (e.g. an older post, a post from
// a different tag). Returns null on any failure so callers degrade silently.
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
                console.warn('[Feed] getContent failed:', e && e.message);
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
        console.warn('[Feed] fetchOrphanPost failed:', e && e.message);
        return null;
    }
};

// onAvatars (optional): when provided, the function returns text-ready cards
// immediately (one round-trip sooner) and invokes onAvatars(enrichedWithAvatars)
// later, once author/voter accounts resolve. Omit it for the original
// single-phase behavior (used by pagination).
const fetchAndEnrichPosts = async (api, sort, tag, existingPosts, pagination, onAvatars) => {
    // Source selection:
    //  - sort='created': use the database API (client.database.getDiscussions)
    //    via api.tags.getDiscussionsByCreated. This returns posts ordered by
    //    head-block creation time, which is the right semantics for "latest"
    //    on the Feed and is what dpixa documents as the canonical path.
    //  - ranked sorts ('hot' / 'trending' / 'promoted'): rankings are computed
    //    by hivemind SQL and have no database-API equivalent, so we route
    //    through bridge get_ranked_posts (api.communities.getRankedPosts).
    //    A bridge fallback is also used if the database call fails or returns
    //    empty so a transient node hiccup doesn't blank the feed.
    const limit = 20;
    const dbQuery = {
        tag: tag || '',
        limit,
        ...(pagination?.start_author ? { start_author: pagination.start_author } : {}),
        ...(pagination?.start_permlink ? { start_permlink: pagination.start_permlink } : {}),
    };

    let posts = null;

    if (sort === 'created' && api?.tags?.getDiscussionsByCreated) {
        posts = await api.tags.getDiscussionsByCreated(dbQuery).catch(e => {
            console.warn('[Feed] database.getDiscussions(created) failed:', e.message);
            return null;
        });
    }

    if (!Array.isArray(posts) || posts.length === 0) {
        const rankedOpts = {
            sort,
            tag: tag || null,
            limit,
            ...(pagination || {}),
        };
        posts = await api.communities.getRankedPosts(rankedOpts).catch(e => {
            console.warn(`[Feed] getRankedPosts(${sort}) failed:`, e.message);
            return [];
        });
    }

    posts = Array.isArray(posts) ? posts : [];

    // Skip duplicate start post when paginating
    if (pagination?.start_author && posts.length > 0
        && posts[0].author === pagination.start_author
        && posts[0].permlink === pagination.start_permlink) {
        posts = posts.slice(1);
    }
    if (!posts.length) return [];

    // Build the card list from a (possibly empty) account map. Dedup against
    // the existing list happens here so phase 1 and phase 2 agree on
    // membership/order — they differ ONLY in avatars.
    const buildEnriched = (accountsMap, voterProfiles) => {
        const enriched = posts.map(p => {
            const authorAcc = accountsMap[p.author] || { name: p.author || '', _profile: {} };
            return enrichPostForCard(p, authorAcc, voterProfiles);
        });
        if (existingPosts?.length) {
            const existingIds = new Set(existingPosts.map(p => p.id));
            return enriched.filter(p => !existingIds.has(p.id));
        }
        return enriched;
    };

    // Author + voter names needed for avatars / vote-list profile images.
    const collectNames = () => {
        const allVotes = posts.flatMap(p => p.active_votes || []);
        return [...new Set([
            ...allVotes.map(v => v?.voter).filter(Boolean),
            ...posts.map(p => p.author).filter(Boolean),
        ])];
    };
    const buildMaps = (accs) => {
        const voterProfiles = {}, accountsMap = {};
        if (Array.isArray(accs)) {
            for (const a of accs) {
                if (!a) continue;
                const n = a.name || a._entity_id;
                if (n) {
                    const img = a._profile?.profile_image || '';
                    voterProfiles[n] = img; a.image = img; accountsMap[n] = a;
                }
            }
        }
        return { accountsMap, voterProfiles };
    };

    // ── Two-phase path (onAvatars provided, e.g. initial page load) ────────
    // Return the text-ready cards NOW — gated on the post fetch alone, one
    // round-trip sooner — and fetch the avatar accounts in the background,
    // handing the avatar-enriched list back through onAvatars. The names-only
    // card is the SAME shape the single-phase path falls back to when an
    // account lookup fails, so cards render identically minus the avatar image.
    if (onAvatars) {
        const uniqueNames = collectNames();
        if (uniqueNames.length > 0 && api?.accounts) {
            api.accounts.getAccounts(uniqueNames)
                .then(accs => {
                    const { accountsMap, voterProfiles } = buildMaps(accs);
                    onAvatars(buildEnriched(accountsMap, voterProfiles));
                })
                .catch(() => {}); // avatars are non-critical; cards already shown
        }
        return buildEnriched({}, {});
    }

    // ── Single-phase path (pagination / callers wanting avatars inline) ────
    const uniqueNames = collectNames();
    let accountsMap = {}, voterProfiles = {};
    if (uniqueNames.length > 0 && api?.accounts) {
        const accs = await api.accounts.getAccounts(uniqueNames).catch(() => []);
        ({ accountsMap, voterProfiles } = buildMaps(accs));
    }
    return buildEnriched(accountsMap, voterProfiles);
};

// Optimistic vote application lives in utils/voteSync now (one copy for
// Feed / FeedPersonal / Community / Profile). Besides patching the card with a
// placeholder row it registers the vote as PENDING, so every later hydration
// of this post — cache-served return visit, revalidation, sort switch, the
// 6 s chain refresh — re-applies it until the chain actually shows it. That
// is what kept "disappearing" before: the vote lived only in React state.
const applyVoteToPost = (post, permlink, voter, weight) => applyOptimisticVote(post, permlink, voter, weight);


// ╔══════════════════════════════════════════════════════════════════════╗
// ║  4. HOOKS                                                           ║
// ╚══════════════════════════════════════════════════════════════════════╝

// ── useFeedData ────────────────────────────────────────────────────────
const useFeedData = (api, pathname) => {
    // Lazy initializer: the argument form re-ran the regex on EVERY render
    // (scroll ticks included) just to be discarded after mount.
    const [sorting, setSorting] = useState(() => parseSortFromPathname(pathname));
    const [posts, setPosts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [loggedInUser, setLoggedInUser] = useState(null);
    const [dataVersion, setDataVersion] = useState(0);

    const prevPathnameRef = useRef(pathname);
    const postsRef = useRef(posts); // shadow ref for infinite scroll closure
    postsRef.current = posts;

    // Live feed identity (sort index + listing pathname) for the event-driven
    // refetch effect below. That effect used to capture `pathname` directly —
    // but the pathname prop ALSO becomes the post URL while the PostDialog
    // overlay is open (Index feeds livePathname down), so a post_published
    // event landing then re-subscribed the listeners with currentTag = ''
    // and refetched loadPage(sorting, <postUrl>): on a tagged feed that
    // swapped the masonry to an untagged query beneath the dialog. This ref
    // only ever advances on a REAL feed-identity change (mount, the pathname
    // effect's non-post branch, a tab click), so the handlers always see the
    // listing the user is actually browsing — and the listeners re-subscribe
    // only when api/loadPage change instead of on every overlay open/close.
    const feedIdRef = useRef(null);
    if (feedIdRef.current === null) {
        feedIdRef.current = {
            sortIndex: parseSortFromPathname(pathname),
            path: isPostUrl(pathname) ? '' : pathname,
        };
    }

    // ── View cache (stale-while-revalidate) ────────────────────────────
    // Index.js tears the whole page down on cross-page navigation (keyed
    // Suspense), so without this every feed → profile → back round trip
    // refetched, re-enriched and re-measured everything from scratch and
    // dumped the user at the top. The module-level viewCache keeps the
    // last list per `feed|sort|tag` so the return paint is instant; the
    // network fetch below still runs and refreshes it.
    const cacheKeyRef = useRef("");
    const pendingScrollRef = useRef(0);
    const cacheKeyFor = (sortIndex, path) =>
        `feed|${SORT_METHODS[sortIndex] || 'created'}|${parseTagFromPathname(path) || ''}`;
    // Cache key the CURRENT `posts` list was loaded for. During a sort/tag
    // switch without a cache hit, cacheKeyRef already points at the new key
    // while `posts` still holds the old list; the mirror effect below uses
    // this to avoid writing that old list under the new key.
    const postsKeyRef = useRef("");

    // Pathname changes
    useEffect(() => {
        const prev = prevPathnameRef.current;
        prevPathnameRef.current = pathname;
        if (prev === pathname) return;

        // Opening / closing PostDialog (and in-dialog next/prev navigation)
        // only changes the URL by adding, removing, or swapping a
        // `/@author/permlink` suffix on top of the same `/<sort>/[tag]`
        // feed identity. Skip the reload in that case.
        //
        // parseTagFromPathname requires `[a-z\-]+` after the sort segment
        // and rejects `@`, so a tagged-feed URL like `/trending/some-tag`
        // opening a post becomes `/trending/@a/p` — same sort but tag
        // collapses from "some-tag" to "". Without this guard, loadPage
        // refetches with an empty tag and the masonry is replaced by an
        // untagged-trending query. Even on the untagged feed (just
        // `/trending` → `/trending/@a/p`), loadPage still wipes scroll
        // position, the `hasMore` flag, and any already-paginated extra
        // pages, then bumps dataVersion which forces a full Masonry
        // reset. On close, HISTORY.go(-1) returns to the original URL
        // and this effect fires again, refetching a second time.
        //
        // The post overlay's own open/close/swap logic lives in
        // usePostNavigation (which subscribes to HISTORY directly), so
        // skipping here doesn't drop any work — the underlying feed is
        // simply left untouched while the overlay is doing its thing.
        if (isPostUrl(prev) || isPostUrl(pathname)) return;

        const newSorting = parseSortFromPathname(pathname);
        feedIdRef.current = { sortIndex: newSorting, path: pathname };
        setSorting(newSorting);
        loadPage(newSorting, pathname);
    }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

    // Initial load. The 300 ms loading-bar tick is cancelled on unmount so a
    // quick page switch can't fire a stale progress update onto the next page.
    useEffect(() => {
        actions.trigger_page_render_complete();
        actions.trigger_loading_update(0);
        const loadingTimer = setTimeout(() => actions.trigger_loading_update(100), 300);
        loadPage(sorting, pathname);
        return () => clearTimeout(loadingTimer);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const loadPage = useCallback(async (sortIndex, path) => {
        if (!api?.initialized) {
            setTimeout(() => loadPage(sortIndex, path), 250);
            return;
        }

        const cacheKey = cacheKeyFor(sortIndex, path);
        const keyChanged = cacheKey !== cacheKeyRef.current;
        cacheKeyRef.current = cacheKey;

        // Serve the last known list for this feed identity instantly —
        // but only on a cold mount or a genuine sort/tag change. Event-
        // driven refetches of the SAME key keep the live list on screen
        // and just revalidate underneath (re-serving the stale entry
        // there would force a pointless Masonry reset).
        let servedFromCache = false;
        if (keyChanged || (postsRef.current || []).length === 0) {
            const cached = viewCache.get(cacheKey);
            if (cached?.posts?.length) {
                servedFromCache = true;
                pendingScrollRef.current = cached.scrollTop || 0;
                // A vote cast since this list was cached is re-applied from
                // the pending registry — the cached rows predate it.
                postsKeyRef.current = cacheKey;
                setPosts(overlayPendingVotes(cached.posts));
                setLoggedInUser(cached.loggedInUser ?? null);
                setDataVersion(v => v + 1);
            }
        }
        setIsLoading(!servedFromCache);
        setLoadingMore(false);
        setHasMore(true);

        try {
            const sort = SORT_METHODS[sortIndex] || 'created';
            const tag = parseTagFromPathname(path);

            // The active account and the post page are independent reads — run
            // them concurrently rather than awaiting the account first, so the
            // post fetch starts immediately instead of one round-trip late
            // (the account lookup can touch the session/vault on a cold start).
            //
            // Single-phase: `enriched` here already carries author avatars
            // (onAvatars omitted → fetchAndEnrichPosts awaits getAccounts and
            // folds the profile images into the cards before returning). The
            // card therefore paints once, image and profile together, instead
            // of a names-only first pass followed by an avatar patch. Cost is
            // one extra round-trip on a COLD load only; viewCache serves return
            // visits instantly.
            const [user, fetched] = await Promise.all([
                api.getActiveAccount().catch(() => null),
                fetchAndEnrichPosts(api, sort, tag, null, null, null),
            ]);
            // hivemind lags the head block by a block or two: a vote cast a
            // moment ago is not in `fetched` yet. The pending registry puts it
            // back (and drops the record once the chain does show it).
            const enriched = overlayPendingVotes(fetched);
            const replaced = postsSignature(enriched) !== postsSignature(postsRef.current);
            batch(() => {
                setLoggedInUser(user || null);
                // dataVersion drives a FULL Masonry reset (clearAll +
                // clearCellPositions). Only paint+reset when the content is
                // genuinely new. A cache-served list of the SAME membership is
                // already on screen with avatars, so keep it rather than
                // repainting an identical list.
                if (!servedFromCache || replaced) {
                    postsKeyRef.current = cacheKey;
                    setPosts(enriched);
                    viewCache.set(cacheKey, { posts: enriched, loggedInUser: user || null });
                    setDataVersion(v => v + 1);
                } else if (votesSignature(enriched) !== votesSignature(postsRef.current)) {
                    // Same membership, fresher vote/payout data — a vote (ours
                    // or anyone's) landed since the cached list was stored.
                    // Commit it WITHOUT the Masonry reset: card heights don't
                    // depend on votes. Previously this branch kept the stale
                    // cached rows, so a vote shown optimistically vanished on
                    // the next sort round-trip and never came back.
                    postsKeyRef.current = cacheKey;
                    setPosts(enriched);
                    viewCache.patch(cacheKey, { posts: enriched, loggedInUser: user || null });
                } else {
                    viewCache.patch(cacheKey, { loggedInUser: user || null });
                }
                setIsLoading(false);
            });
            return enriched; // for initial post URL matching
        } catch (e) {
            console.error('[Feed] _update_page error:', e);
            setIsLoading(false);
            return [];
        }
    }, [api]);

    // ── Keep the view cache in step with vote patches ───────────────────
    // handleVoteChange (optimistic) and onVoteSynced (chain refresh) only
    // touch React state; without this the SWR entry kept the pre-vote rows
    // and served them straight back on the next sort round-trip. Guarded by
    // postsKeyRef so a list still belonging to the previous key is never
    // written under the key being switched to.
    useEffect(() => {
        if (!posts.length) return;
        const key = cacheKeyRef.current;
        if (!key || postsKeyRef.current !== key) return;
        viewCache.patch(key, { posts });
    }, [posts]);

    // ── Chain refresh after a vote ─────────────────────────────────────
    // useVoteSync listens for `vote_done` (any surface — card, PostDialog),
    // registers the vote as pending and, VOTE_REFRESH_DELAY_MS (6 s: the
    // vote's block plus one for the indexer) later, re-reads the post with
    // getContent. The refreshed rows carry the REAL rshares and
    // pending_payout_value, replacing the optimistic placeholder and the
    // estimated payout on the card. Retries while the vote isn't visible yet.
    const onVoteSynced = useCallback(({ content }) => {
        setPosts(prev => mergeFreshVoteDataInto(prev, content));
    }, []);
    useVoteSync(api, onVoteSynced);

    // Glue for the component: hand over a cached scroll offset exactly
    // once, and let unmount / sort-switch persist the live offset back.
    const consumePendingScrollRestore = useCallback(() => {
        const top = pendingScrollRef.current;
        pendingScrollRef.current = 0;
        return top;
    }, []);

    const saveScrollPosition = useCallback((top) => {
        viewCache.patch(cacheKeyRef.current, { scrollTop: top });
    }, []);

    // ── Refresh on new content ─────────────────────────────────────────
    // The API fires `post_published` after a successful top-level comment
    // broadcast and `content_deleted` after a delete_comment. The feed must
    // show the new post (or remove the deleted one) without the user having
    // to reload. We only react when the published post belongs in this feed:
    // - No tag filter active → any new post is relevant (it lands in /created/).
    // - Tag filter active → only refresh if the published post's parent_permlink
    //   matches the current tag (community tag), OR if its tags include the
    //   current tag. This prevents an unrelated portal-1 post from forcing a
    //   refetch on a /created/portal-7/ feed.
    //
    // A second-guard debounce coalesces back-to-back broadcasts (the editor
    // often follows up `comment` with `comment_options`) into a single
    // refetch. Three-second timeout matches the typical chain confirmation
    // window so the refetch sees the new content in the bridge index.
    //
    // Sort + tag are read from feedIdRef at EVENT time rather than captured
    // here — see the ref's comment: the captured pathname was the post URL
    // whenever the overlay was open, which made a tagged feed refetch as an
    // untagged one. Subscribes once per api/loadPage instead of on every
    // pathname change (each overlay open/close used to tear down and re-add
    // the three listeners).
    useEffect(() => {
        if (!api?.eventEmitter) return;

        let refetchTimer = null;
        const scheduleRefetch = () => {
            if (refetchTimer) clearTimeout(refetchTimer);
            refetchTimer = setTimeout(() => {
                refetchTimer = null;
                const { sortIndex, path } = feedIdRef.current;
                loadPage(sortIndex, path);
            }, 5500);
        };

        const isRelevantToFeed = (payload) => {
            const currentTag = parseTagFromPathname(feedIdRef.current.path);
            if (!currentTag) return true;
            if (payload?.parentPermlink === currentTag) return true;
            const tags = payload?.jsonMetadata?.tags;
            if (Array.isArray(tags) && tags.some(t => typeof t === 'string' && t.toLowerCase() === currentTag)) {
                return true;
            }
            return false;
        };

        const onPostPublished = (payload) => {
            if (isRelevantToFeed(payload)) scheduleRefetch();
        };
        // Deleted content is only known by author+permlink, not by tag. If the
        // deleted post is in the current view, it'll vanish on next refetch;
        // if it isn't, the refetch is a tiny wasted query — acceptable cost
        // for not having to track deletes per-tag.
        const onContentDeleted = (payload) => {
            const exists = (postsRef.current || []).some(
                p => p.permlink === payload?.permlink
                    && (p.author?.username || p.author) === payload?.author
            );
            if (exists) scheduleRefetch();
        };

        // Edits reuse the deleted-content semantics: if the edited post is in
        // view (title/tags/nsfw changed, or it just gained the `deleted` tag),
        // refetch so the cards and the deleted-filter reflect the new state.
        const onContentUpdated = (payload) => {
            const exists = (postsRef.current || []).some(
                p => p.permlink === payload?.permlink
                    && (p.author?.username || p.author) === payload?.author
            );
            const turnedDeleted = payload?.jsonMetadata?.deleted === true;
            if (exists || turnedDeleted) scheduleRefetch();
        };

        api.eventEmitter.on('post_published', onPostPublished);
        api.eventEmitter.on('content_deleted', onContentDeleted);
        api.eventEmitter.on('content_updated', onContentUpdated);
        return () => {
            if (refetchTimer) clearTimeout(refetchTimer);
            api.eventEmitter.off('post_published', onPostPublished);
            api.eventEmitter.off('content_deleted', onContentDeleted);
            api.eventEmitter.off('content_updated', onContentUpdated);
        };
    }, [api, loadPage]);

    // ── Refresh on session change ──────────────────────────────────────
    // `loggedInUser` is captured only inside loadPage(), which runs on
    // mount and on pathname change. If the user logs in (or out, or
    // switches account, or unlocks the vault) while staying on the same
    // feed URL, loadPage never fires again, so `loggedInUser` stays null
    // and the `voter` prop passed to PaperCardBlog stays null — every
    // vote click then bails out at the `if (!voter) return;` guard,
    // making the upvote / downvote buttons appear inert until the user
    // navigates to another view to force a remount.
    //
    // Subscribing to the full session-lifecycle event set keeps the
    // logged-in identity in sync with the API's session state, which is all
    // the vote buttons need — the post list itself is viewer-independent, so
    // there's no full refetch here (see the handler below).
    useEffect(() => {
        if (!api?.eventEmitter) return;

        let cancelled = false;
        const refresh = async () => {
            try {
                const user = await api.getActiveAccount().catch(() => null);
                if (cancelled) return;
                // Just resync the identity. The feed's posts and their on-chain
                // active_votes are viewer-independent, so the only thing a
                // login / unlock / account-switch changes here is which vote is
                // "mine" — derived in the card from loggedInUser. Re-running
                // loadPage would refetch the whole page and bump dataVersion,
                // flashing the grid (full Masonry reset) on every unlock for no
                // content change. The SWR view cache revalidates on the next
                // navigation if anything did drift.
                setLoggedInUser(user || null);
            } catch (e) {
                console.warn('[Feed] session refresh failed:', e);
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
    }, [api]);

    const loadMorePosts = useCallback(async () => {
        const currentPosts = postsRef.current;
        if (loadingMore || isLoading || !hasMore || !currentPosts?.length || !api?.initialized) return;

        const last = currentPosts[currentPosts.length - 1];
        const startAuthor = last.author?.username || last.author || '';
        const startPermlink = last.permlink || '';
        if (!startAuthor || !startPermlink) return;

        setLoadingMore(true);
        try {
            const sort = SORT_METHODS[sorting] || 'created';
            const tag = parseTagFromPathname(pathname);
            const newPosts = overlayPendingVotes(await fetchAndEnrichPosts(api, sort, tag, currentPosts, {
                start_author: startAuthor, start_permlink: startPermlink,
            }));
            if (newPosts.length > 0) {
                setPosts(prev => [...prev, ...newPosts]);
                // Mirror the append into the view cache (patch keeps the
                // original fetch timestamp — pagination doesn't make the
                // entry fresher) so a return visit restores the full
                // scrolled-through list, not just page one.
                viewCache.patch(cacheKeyRef.current, { posts: [...currentPosts, ...newPosts] });
            } else {
                setHasMore(false);
            }
        } catch (e) {
            console.warn('[Feed] _load_more_posts failed:', e.message);
        }
        setLoadingMore(false);
    }, [api, sorting, pathname, loadingMore, isLoading, hasMore]);

    const handleSortingChange = useCallback((e, newSorting) => {
        if (sorting === newSorting) return;

        const tag = parseTagFromPathname(pathname);
        const sortName = SORT_METHODS[newSorting] || 'created';
        const newPath = tag ? `/${sortName}/${tag}/` : `/${sortName}/`;

        // Drive state + fetch directly. Don't rely on a history → parent →
        // pathname-prop round trip: if the parent doesn't re-render Feed on
        // HISTORY.replace, the tab silently becomes unreachable. The Tabs
        // indicator also moves immediately this way, even before the URL
        // change has propagated.
        feedIdRef.current = { sortIndex: newSorting, path: newPath };
        setSorting(newSorting);
        loadPage(newSorting, newPath);

        // Pre-set the ref so the pathname-change effect skips a redundant
        // loadPage when the parent eventually re-renders us with newPath.
        // Then update the URL for shareability + back-button.
        prevPathnameRef.current = newPath;
        HISTORY.replace(newPath);
    }, [sorting, pathname, loadPage]);

    const handleVoteChange = useCallback((permlink, voter, weight) => {
        setPosts(prev => prev.map(p => applyVoteToPost(p, permlink, voter, weight)));
    }, []);

    return {
        sorting, posts, isLoading, loadingMore, loggedInUser, dataVersion,
        handleSortingChange, handleVoteChange, loadMorePosts,
        consumePendingScrollRestore, saveScrollPosition,
    };
};

// ── Grid configuration (shared hook in ../hooks/useMasonryGrid) ───────
// Module-level so the option functions stay referentially stable across
// renders (the hook treats them as static).
const FEED_COLUMN_COUNT = (width) => {
    if (width >= 1920) return 4;
    if (width >= 1280) return 3;
    if (width >= 768) return 2;
    return 1;
};

const useFeedGrid = ({ windowWidth, windowHeight, isMobile, overscanByPixels, loadMoreThreshold, loadMorePosts, loadingMore }) => {
    const core = useMasonryGrid({
        windowWidth, windowHeight, isMobile, overscanByPixels,
        loadMoreThreshold, loadMorePosts, loadingMore,
        getColumnCount: FEED_COLUMN_COUNT,
        fallbackColumnWidth: 356,
        defaultHeight: 600,
        scrollReloadDivisor: 2,
    });

    // Page chrome derived from the grid — Feed-specific, so it lives here
    // rather than in the shared hook.
    const pageWidth = isMobile ? windowWidth - 32 : windowWidth - 284 - 28;
    const postListHeight = windowHeight - (isMobile ? 64 : 96);
    const hideTab = core.scrollY < 0 && core.scrollTop > 72;
    const hideFab = core.scrollY > 0 && core.scrollTop > 512;

    return { ...core, pageWidth, postListHeight, hideTab, hideFab };
};

// ── usePostNavigation (Feed-specific: uses itemsWithSizes) ─────────────
const usePostNavigation = ({ api, posts, masonryRef, scrollToIndex, scrollTo, setSelectedPostIndex, fallbackUrl, nsfwEnabled }) => {
    const [artworkOpen, setArtworkOpen] = useState(false);
    const [currentPost, setCurrentPost] = useState({});
    const [originRect, setOriginRect] = useState(null);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    // `isOrphan` = the open post wasn't found in `posts` and was fetched
    // on-demand. The feed grid has no neighbours for it, so prev/next must
    // be unavailable (surfaced as undefined props so the dialog can hide
    // or disable its arrows).
    const [isOrphan, setIsOrphan] = useState(false);
    const historyDepthRef = useRef(0);
    const postClosedAtRef = useRef(0);
    // One-shot guard for the cold-entry history seed (see the URL effect).
    const seededRef = useRef(false);

    // Refs mirroring props/state so the URL listener can read fresh values
    // without re-subscribing on every change (which would drop events).
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
    // Track the in-flight orphan fetch so a newer URL change can invalidate
    // an older one (prevents a stale fetch from overwriting the visible
    // post if the user navigates again before the first fetch resolves).
    const orphanFetchTokenRef = useRef(0);

    // ── URL-driven open/close/swap ─────────────────────────────────────
    // Single source of truth: the URL decides whether the dialog is open and
    // which post it shows. This handles (a) direct URL entry, (b) browser
    // back/forward between posts and non-post URLs, (c) post-to-post URL
    // transitions from in-dialog links, and (d) closePost's HISTORY.go(-1).
    // It's idempotent — calling openPost/closePost also triggers this path
    // via their HISTORY.push, so state updates converge regardless of who
    // caused the URL change.
    //
    // API-readiness handling lives inside the orphan-fetch dispatch (a
    // setTimeout polling loop), not in this effect's deps. The PixaProxyAPI
    // instance is constructed once and mutated in place — same reference
    // before and after `initialize()` resolves — and Profile/Feed/Community
    // are wrapped in `memo`, so React's shallow prop compare suppresses the
    // re-render even when Index rebuilds the page element on apiReady. The
    // existing codebase pattern (loadPage / loadProfile / loadCommunity) is
    // a setTimeout polling loop on `api?.initialized`; we adopt the same.
    useEffect(() => {
        // ── Cold-entry seed: native-app Back behaviour ───────────────────
        // If we mounted directly on a post URL (a shared link, or a refresh
        // while a post was open) there is no feed entry beneath the overlay
        // for Back to land on — Back would leave the site, and closePost has
        // nothing to pop. Seat the feed beneath the post: rewrite the current
        // entry to the feed identity, then re-push the post on top. Now Back
        // (and closePost) returns to the feed and dismisses the overlay, just
        // like a mobile app. Same-page only — `fallbackUrl` is this page's own
        // listing URL (the post URL minus its /@author/permlink suffix), so it
        // never hands off to another page, and the pathname-reload guard
        // (isPostUrl(prev)) absorbs the two synchronous URL writes.
        if (!seededRef.current) {
            seededRef.current = true;
            const seedPath = HISTORY.location.pathname;
            const seedHash = HISTORY.location.hash || "";
            const seedBack = fallbackUrl;
            if (isPostUrl(seedPath) && historyDepthRef.current === 0
                && seedBack && !isPostUrl(seedBack)) {
                HISTORY.replace(seedBack);
                HISTORY.push(seedPath + seedHash);
                historyDepthRef.current = 1;
            }
        }
        const syncFromUrl = (pathname) => {
            const parsed = parsePostUrl(pathname);
            if (!parsed) {
                // Leaving post-URL space — tear down the dialog if it's open.
                orphanFetchTokenRef.current += 1; // invalidate any in-flight fetch
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
            // No match in the current feed — fetch on demand so deep-links
            // to arbitrary posts still work. Open the dialog *immediately*
            // with a stub built from the URL so the transition isn't gated
            // on the network round-trip; the dialog renders its loading
            // state from _loading until the fetch resolves and hydrates the
            // real content. If the fetch fails we surface _notFound rather
            // than silently swallowing the navigation and stranding the
            // user on a bare page.
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
            // pattern `loadPage` (and `loadProfile`, `loadCommunity`) use for
            // the same problem: the PixaProxyAPI instance is constructed once
            // and mutated in place (its `initialized` boolean flips after
            // `initialize()` resolves), so the `api` prop reference doesn't
            // change. React lifecycle hooks can't catch the mutation, and
            // Feed is wrapped in `memo` so even Index's apiReady-rebuild
            // dispatching a new page element doesn't trigger a Feed re-
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
        // Initial sync on mount and on every `posts` change. We don't depend
        // on `api` here — readiness is handled by the polling loop inside the
        // orphan-fetch dispatch, not by re-running the effect.
        syncFromUrl(HISTORY.location.pathname);
        const unlisten = HISTORY.listen(h => syncFromUrl(h.location.pathname));
        return unlisten;
    }, [posts]);

    // ── Keyboard navigation (2D grid) ──────────────────────────────────
    useEffect(() => {
        // Captured via ref to avoid stale closure on selectedPostIndex
        let selectedIdx = 0;
        const unsubIdx = { current: null };

        const handleKeydown = (event) => {
            if (postClosedAtRef.current + 300 > Date.now()) return;

            const masonry = masonryRef.current;
            if (!masonry?.props?.itemsWithSizes) return;
            const items = masonry.props.itemsWithSizes;
            const colCount = masonry.props.cellPositioner?._columnCount || 1;

            const colIdx = selectedIdx % colCount;
            const rowIdx = (selectedIdx - colIdx) / colCount;
            let newCol = colIdx, newRow = rowIdx;

            switch (event.keyCode) {
                case 40: newRow += 1; event.preventDefault(); break;
                case 38: newRow -= 1; event.preventDefault(); break;
                case 37: newCol -= 1; break;
                case 39: newCol += 1; break;
                default: return;
            }

            // We don't have xyByIndex here; use simple index math
            let newIdx = newRow * colCount + newCol;
            newIdx = Math.max(0, Math.min(items.length - 1, newIdx));

            if (newIdx !== selectedIdx) {
                selectedIdx = newIdx;
                setSelectedPostIndex?.(newIdx);
            }
        };

        document.addEventListener("keydown", handleKeydown);
        return () => document.removeEventListener("keydown", handleKeydown);
    }, [masonryRef, setSelectedPostIndex]);

    // ── Open / Close ───────────────────────────────────────────────────
    const openPost = useCallback((data, rect) => {
        const postUrl = buildPostUrl(data);
        if (postUrl) HISTORY.push(postUrl);
        // Invalidate any in-flight orphan fetch — a card click is never an
        // orphan by definition (data came from the feed grid).
        orphanFetchTokenRef.current += 1;
        setIsOrphan(false);
        setArtworkOpen(true);
        setCurrentPost(data);
        setOriginRect(rect || null);
        historyDepthRef.current = 1;
    }, []);

    const closePost = useCallback(() => {
        const depth = historyDepthRef.current;
        setArtworkOpen(false);
        setCurrentPost({});
        setOriginRect(null);
        setIsOrphan(false);
        postClosedAtRef.current = Date.now();
        historyDepthRef.current = 0;

        if (!isPostUrl(HISTORY.location.pathname)) return;
        if (depth > 0) HISTORY.go(-depth);
        // depth === 0 means the dialog was opened straight from the URL
        // (deep-link/refresh, or a back→forward re-open) rather than via
        // openPost, so there's no tracked entry to rewind. REPLACE the post
        // URL with the fallback instead of pushing on top of it — pushing
        // would leave the post URL sitting behind us in history, and the very
        // next browser Back would land on it and re-open the dialog. Replace
        // swaps it out entirely, so Back goes to whatever preceded the post.
        else HISTORY.replace(fallbackUrl || "/created/");
    }, [fallbackUrl]);

    // Counter-bump for PostDialog's drawer-hash push (mobile-only, when the
    // user opens the drawer). The drawer push adds an entry on top of the
    // post-URL push, so closePost has to pop that extra step too. (Sibling
    // arrow-nav, by contrast, uses replace and does NOT bump the counter —
    // it's a lateral swap, not a new level.)
    const onDrawerPush = useCallback(() => {
        historyDepthRef.current += 1;
    }, []);

    // Mirror image: when goBack pops the drawer push, decrement so closePost
    // doesn't over-pop on a subsequent close.
    const onDrawerPop = useCallback(() => {
        if (historyDepthRef.current > 0) historyDepthRef.current -= 1;
    }, []);

    // ── Next / Previous (uses itemsWithSizes from Masonry) ─────────────
    const navigatePost = useCallback((direction) => {
        const masonry = masonryRef.current;
        if (!masonry?.props?.itemsWithSizes?.length) return false;

        const items = masonry.props.itemsWithSizes;
        const currentIndex = items.findIndex(({ item }) => isSamePost(item, currentPost));

        // Walk past artworks whose card is blurred (author NSFW flag or
        // on-device verdict while the "show NSFW" toggle is off) — the
        // dialog must never land on a blurred artwork. Returning `false`
        // (no clean sibling left in that direction) tells the dialog to
        // bounce the current artwork back instead of dead-ending; the
        // arrow is normally hidden already (canGoNext/canGoPrev below run
        // the same walk), so this only covers the race where a detector
        // verdict landed after the last render.
        const newIndex = findNavigableIndex(items, currentIndex, direction, nsfwEnabled, (e) => e.item);
        if (newIndex === -1) return false;

        const { item } = items[newIndex];
        const postUrl = buildPostUrl(item);
        // Sibling navigation is a LATERAL swap, not a new history level: use
        // replace so the viewer stays exactly one entry deep. Back (and
        // closePost) then returns to the feed instead of walking back through
        // every sibling you arrowed past, and a deep-linked post you arrow
        // away from won't sit in the back stack waiting to re-open. (Mirrors
        // the dialog's own "use replace on a cross-pathname render" rule.)
        if (postUrl) HISTORY.replace(postUrl);
        setCurrentPost(item);
        setSelectedPostIndex?.(newIndex);
        scrollToIndex?.(newIndex);
        return true;
    }, [masonryRef, currentPost, scrollToIndex, setSelectedPostIndex, nsfwEnabled]);

    const nextPost = useCallback(() => navigatePost(1), [navigatePost]);
    const previousPost = useCallback(() => navigatePost(-1), [navigatePost]);

    // ── Arrow availability ─────────────────────────────────────────────
    // Runs the SAME blur-skipping walk navigatePost performs, but over
    // `posts` (the filtered array the masonry measures, in identical
    // order) so it can run during render. A direction with no clean
    // sibling surfaces its callback as `undefined` — the convention the
    // orphan case already uses — and the dialog unmounts that arrow.
    // Detector verdicts landing between renders are caught at click time
    // by navigatePost's own walk (which then returns false).
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

    // ── Reverse-hero target (PostDialog close) ─────────────────────────
    // Resolve the LIVE on-screen rect of the card canvas backing the open
    // post (cards stamp data-artwork-id — see PaperCard). Sibling
    // navigation keeps the masonry scrolled to the current artwork, so
    // when the card is rendered it sits at (or near) the viewport.
    // Virtualized-away, filtered-out or orphaned posts yield null, as do
    // rects fully outside the viewport (overscan cells) — flying the
    // artwork off-screen would read as a glitch, not a return — and the
    // dialog then falls back to its plain fade-out close.
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

    // When the dialog is showing an orphan (deep-linked post not in the
    // loaded feed), there are no siblings to navigate to — surface the
    // arrows as undefined so the dialog can hide or disable them. The same
    // convention now covers an exhausted direction: nothing but blurred
    // cards (or the list edge) left that way → undefined → no arrow.
    //
    // Stable return identity: re-allocate only when a field actually changes.
    // This object was previously a fresh literal every render, so every
    // downstream hook keyed on `postNav` (the cell renderer, dialog props)
    // recomputed on every parent render — scroll ticks included. Memoizing
    // lets those bail when nothing here moved. setCreateDialogOpen is a
    // stable useState setter, so it's intentionally not a dep.
    return useMemo(() => ({
        artworkOpen, currentPost, originRect, isOrphan,
        createDialogOpen, setCreateDialogOpen,
        openPost, closePost, onDrawerPush, onDrawerPop, getReturnRect,
        nextPost: (isOrphan || !canGoNext) ? undefined : nextPost,
        previousPost: (isOrphan || !canGoPrev) ? undefined : previousPost,
    }), [artworkOpen, currentPost, originRect, isOrphan, createDialogOpen,
        openPost, closePost, onDrawerPush, onDrawerPop, getReturnRect,
        nextPost, previousPost, canGoNext, canGoPrev]);
};


// ╔══════════════════════════════════════════════════════════════════════╗
// ║  5. MAIN COMPONENT                                                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

const Feed = ({ classes, settings, pathname, api }) => {
    useLanguage();
    const { windowWidth, windowHeight, isMobile, overscanByPixels, loadMoreThreshold } = useWindowDimensions();

    // Resolved every render (four cheap catalogue lookups); the vnodes rebuild
    // only when a label actually changes, so <Tabs> keeps a stable child
    // identity between renders exactly as the old module-scope array did.
    const newerLabel = t("words.newer");
    const hottestLabel = t("words.hottest");
    const trendingLabel = t("words.trending");
    const promotedLabel = t("words.promoted");
    const sortTabLabels = useMemo(() => [
        <span style={LABEL_ROW}><NewBox /><span style={LABEL_TEXT}>{newerLabel}</span></span>,
        <span style={LABEL_ROW}><Fire /><span style={LABEL_TEXT}>{hottestLabel}</span></span>,
        <span style={LABEL_ROW}><TrendingUp /><span style={LABEL_TEXT}>{trendingLabel}</span></span>,
        <span style={LABEL_ROW}><MonetizationOnRounded /><span style={LABEL_TEXT}>{promotedLabel}</span></span>,
    ], [newerLabel, hottestLabel, trendingLabel, promotedLabel]);

    const {
        sorting, posts, loggedInUser, dataVersion,
        handleSortingChange, handleVoteChange, loadMorePosts, loadingMore,
        consumePendingScrollRestore, saveScrollPosition,
    } = useFeedData(api, pathname);

    // NSFW filtering: when the filter is ON (_nsfw_filter truthy) drop posts
    // flagged nsfw so they never enter the masonry. Blurring of shown posts is
    // handled by PaperCard via the separate _nsfw_enabled (blur) setting.
    const visiblePosts = useMemo(
        () => (posts || []).filter((p) => !p.deleted && (!settings._nsfw_filter || !p.nsfw)),
        [posts, settings._nsfw_filter]
    );

    const grid = useFeedGrid({
        windowWidth, windowHeight, isMobile, overscanByPixels,
        loadMoreThreshold, loadMorePosts, loadingMore,
    });

    // Fallback URL when closing the post overlay with no browsable history
    // to step back into (e.g. the user landed here directly on the post URL).
    // Reflects the active sort + tag so closing drops you back onto the feed
    // you were logically browsing, not unconditionally `/created/`.
    const feedFallbackUrl = useMemo(() => {
        const sortName = SORT_METHODS[sorting] || 'created';
        const tag = parseTagFromPathname(pathname);
        return tag ? `/${sortName}/${tag}/` : `/${sortName}/`;
    }, [sorting, pathname]);

    const postNav = usePostNavigation({
        api,
        posts: visiblePosts,
        masonryRef: grid.masonryRef,
        scrollToIndex: grid.scrollToIndex,
        scrollTo: grid.scrollTo,
        setSelectedPostIndex: grid.setSelectedPostIndex,
        fallbackUrl: feedFallbackUrl,
        // Blur state feeds the prev/next walk + arrow availability: with
        // the "show NSFW" toggle on nothing is blurred, so nothing skips.
        nsfwEnabled: settings._nsfw_enabled,
    });

    // ── Local UI state ─────────────────────────────────────────────────
    const [menuCardXY, setMenuCardXY] = useState([]);
    const [menuCardData, setMenuCardData] = useState({});
    // Own-post management dialogs (opened from the card ⋮ menu)
    const [editPostData, setEditPostData] = useState(null);
    const [deletePostData, setDeletePostData] = useState(null);

    // Full masonry reset when data is fully replaced (sorting/filter change).
    // Clears stale CellMeasurerCache heights from the previous sort's posts.
    useEffect(() => {
        grid.resetMasonry();
    }, [dataVersion, settings._nsfw_filter]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── View-cache scroll persistence ───────────────────────────────────
    // Restore the saved offset when a cache-served list lands (runs on the
    // dataVersion bump; restoreScrollTop retries until the masonry has
    // measured enough height for the target to stick, and the consume-once
    // semantics make the no-cache bumps a no-op) …
    useEffect(() => {
        const pending = consumePendingScrollRestore();
        if (pending > 0) return grid.restoreScrollTop(pending);
    }, [dataVersion]); // eslint-disable-line react-hooks/exhaustive-deps

    // … and persist the live offset when the page unmounts (cross-page
    // navigation tears the whole subtree down — keyed Suspense in
    // Index.js). getScrollTop reads the container directly, so this is
    // safe in a cleanup where state would be stale.
    useEffect(() => () => {
        saveScrollPosition(grid.getScrollTop());
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Lighter re-render for incremental changes (infinite scroll append, vote update).
    // @pixagram/virtualized's Masonry doesn't auto-update when cellCount changes.
    useEffect(() => {
        const masonry = grid.masonryRef.current;
        if (masonry) masonry.forceUpdate();
    }, [posts]);

    // Mount the (now-lazy) create dialog on first open and keep it mounted —
    // matching NewPost's original always-rendered wiring — while deferring its
    // chunk until the user actually opens it. The prefetch below warms the
    // chunk on idle so the first open is instant.
    const [newPostMounted, setNewPostMounted] = useState(false);
    useEffect(() => {
        if (postNav.createDialogOpen) setNewPostMounted(true);
    }, [postNav.createDialogOpen]);

    // Warm the create-dialog chunk on idle, but only for a logged-in user —
    // the only one who can post — so logged-out visitors never fetch it.
    // Skipped once the dialog is open (React.lazy is loading it anyway).
    useEffect(() => {
        if (postNav.createDialogOpen || !loggedInUser) return;
        const id = idle(() => { loadNewPost().catch(() => {}); });
        return () => cancelIdle(id);
    }, [postNav.createDialogOpen, loggedInUser]);

    // Mount the (now-lazy) post viewer on first open and keep it mounted so
    // close/reopen and in-dialog next/prev stay instant. On a deep-link entry
    // (cold-entry post URL — Index cold-mounts Feed for every non-community
    // post URL) artworkOpen is already true on the first effects pass, so this
    // mounts on the first commit while the orphan fetch runs in parallel.
    const [postDialogMounted, setPostDialogMounted] = useState(false);
    useEffect(() => {
        if (postNav.artworkOpen) setPostDialogMounted(true);
    }, [postNav.artworkOpen]);

    // Warm the post-viewer chunk on idle for EVERYONE (anyone can open a post),
    // so the open-from-card transition isn't gated on a cold chunk fetch.
    // Skipped once mounted (React.lazy is fetching it anyway).
    useEffect(() => {
        if (postDialogMounted) return;
        const id = idle(() => { loadPostDialog().catch(() => {}); });
        return () => cancelIdle(id);
    }, [postDialogMounted]);

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

    const locales = settings._selected_locales_code;

    // ── Callbacks ──────────────────────────────────────────────────────
    const handleSortingChangeWithScroll = useCallback((e, value) => {
        // Bank the outgoing sort's offset (cacheKeyRef still points at it —
        // loadPage swaps the key synchronously right after) so tabbing back
        // restores position too.
        saveScrollPosition(grid.getScrollTop());
        grid.scrollTo(0);
        handleSortingChange(e, value);
        // Depend on the two stable grid functions, not the whole grid object
        // (whose identity changes every scroll tick) — keeps the Tabs
        // onChange prop from churning while scrolling.
    }, [handleSortingChange, grid.getScrollTop, grid.scrollTo, saveScrollPosition]);

    const openCardMenu = useCallback((event, data) => {
        setMenuCardXY(Int32Array.of(event.x - 24, event.y - 24));
        setMenuCardData(data);
    }, []);
    const closeCardMenu = useCallback(() => {
        setMenuCardXY(Int32Array.of(0, 0));
        setMenuCardData({});
    }, []);

    // Stable create-dialog open/close: the previous inline `() =>
    // postNav.setCreateDialogOpen(true/false)` lambdas re-created both
    // closures every render (scroll ticks included), churning the FAB's and
    // NewPost's props. setCreateDialogOpen is a stable useState setter, so
    // both callbacks below are created exactly once.
    const openCreateDialog = useCallback(() => postNav.setCreateDialogOpen(true), [postNav.setCreateDialogOpen]);
    const closeCreateDialog = useCallback(() => postNav.setCreateDialogOpen(false), [postNav.setCreateDialogOpen]);

    // ── Own-post management (card menu → page-level dialogs) ───────────
    const onEditPost = useCallback((data) => { setEditPostData(data); }, []);
    const onDeletePost = useCallback((data) => { setDeletePostData(data); }, []);
    const closeEditPost = useCallback(() => { setEditPostData(null); }, []);
    const closeDeletePost = useCallback(() => { setDeletePostData(null); }, []);
    // The broadcast emits `content_updated`, which the listener above turns
    // into a debounced refetch — nothing else to do here.
    const handlePostEdited = useCallback(() => {}, []);
    const handlePostDeleted = useCallback(() => {}, []);

    // Sync vote into currently open post
    const onVoteChange = useCallback((permlink, voter, weight) => {
        handleVoteChange(permlink, voter, weight);
    }, [handleVoteChange]);

    // ── Cell renderer ──────────────────────────────────────────────────
    // Depend on the SPECIFIC grid fields the renderer reads, not the whole
    // `grid` object: the shared masonry hook returns a fresh object whose
    // identity changes on every scroll tick (scrollTop/scrollY live in it),
    // which used to re-create this renderer — and hand MasonryExtended a new
    // cellRenderer prop — every 380 ms while scrolling. The fields below are
    // all referentially stable between layout changes.
    const {
        columnCount, columnWidth, trackElementPosition, cellMeasurerCache,
        selectedPostIndex, postListHeight, pageWidth,
    } = grid;
    const { openPost } = postNav;
    const cellRenderer = useCallback((data) => {
        const { index, key, parent, style, isScrolling } = data;
        if (!parent?.props?.itemsWithSizes?.[index | 0]) return null;

        const { item, size } = parent.props.itemsWithSizes[index | 0];
        if (!size.height) return null;

        const colIdx = index % columnCount;
        const rowIdx = (index - colIdx) / columnCount;
        const imageHeight = Math.ceil(columnWidth * (size.height / size.width)) || 0;
        style.width = columnWidth;

        trackElementPosition(index, +style.top, +style.height, rowIdx, colIdx);

        // Visibility tracking — use the scroll container's actual viewport dimensions,
        // NOT rootDimensions (the root div has height≈0 because Masonry is position:absolute)
        const container = parent._scrollingContainer;
        const st = container ? container.scrollTop : 0;
        const viewH = container ? container.clientHeight : postListHeight;
        const viewW = container ? container.clientWidth : pageWidth;
        const top = +style.top, bottom = top + (+style.height);
        const threshold = viewH * (viewH / (viewW || 1));
        const visible = threshold + bottom > st && top < st + viewH + threshold;
        cellMeasurerCache.visible_ids[size.id] = visible || (cellMeasurerCache.visible_ids[size.id] || false);

        return (
            <CellMeasurer cache={cellMeasurerCache} index={index} key={key} parent={parent}>
                <PaperCard
                    onOpen={openPost}
                    locales={locales}
                    nsfw={settings._nsfw_enabled}
                    data={item}
                    renderer={settings._renderer}
                    mode={settings._mode}
                    onMenuClick={openCardMenu}
                    api={api}
                    voter={loggedInUser}
                    onVoteChange={onVoteChange}
                    is_scrolling={isScrolling}
                    selected={selectedPostIndex === index}
                    size={size}
                    visible={cellMeasurerCache.visible_ids[size.id]}
                    column_width={columnWidth}
                    image_height={imageHeight}
                    image_width={columnWidth}
                    id={size.id}
                    key={size.id}
                    rowIndex={rowIdx}
                    columnIndex={colIdx}
                    style={style}
                />
            </CellMeasurer>
        );
    }, [posts, columnCount, columnWidth, trackElementPosition, cellMeasurerCache,
        selectedPostIndex, postListHeight, pageWidth, openPost,
        locales, settings, openCardMenu, api, loggedInUser, onVoteChange]);

    // ── Render ─────────────────────────────────────────────────────────
    return (
        <React.Fragment>
            <Tabs
                style={{ transform: `translateY(${grid.hideTab ? -72 : 0}px)` }}
                className={classes.mainTab}
                value={sorting}
                variant="fullWidth"
                indicatorColor="primary"
                textColor="primary"
                onChange={handleSortingChangeWithScroll}
                fullwidth={true}
                data-tour="feed-tabs"
            >
                <Tab icon={isMobile ? SORT_TAB_ICONS[0] : undefined} label={isMobile ? undefined : sortTabLabels[0]} />
                <Tab icon={isMobile ? SORT_TAB_ICONS[1] : undefined} label={isMobile ? undefined : sortTabLabels[1]} />
                <Tab icon={isMobile ? SORT_TAB_ICONS[2] : undefined} label={isMobile ? undefined : sortTabLabels[2]} />
                <Tab icon={isMobile ? SORT_TAB_ICONS[3] : undefined} label={isMobile ? undefined : sortTabLabels[3]} />
            </Tabs>

            <div ref={grid.setRootElement}>
                <ImageMeasurer
                    className={classes.masonry}
                    items={visiblePosts}
                    image={GET_ITEM_IMAGE}
                    keyMapper={GET_ITEM_ID}
                >
                    {(itemsWithSizes) => (
                        <MasonryExtended
                            key="masonry-extended-feed"
                            scrollTop={grid.scrollTop}
                            scrollingResetTimeInterval={grid.scrollingResetTimeInterval}
                            height={grid.postListHeight}
                            cellCount={(itemsWithSizes || []).length | 0}
                            itemsWithSizes={itemsWithSizes}
                            keyMapper={index => itemsWithSizes[index]?.size?.id}
                            cellMeasurerCache={grid.cellMeasurerCache}
                            cellPositioner={grid.cellPositioner}
                            cellRenderer={cellRenderer}
                            overscanByPixels={grid.overscanByPixels}
                            ref={grid.setMasonryElement}
                            width={grid.pageWidth}
                        />
                    )}
                </ImageMeasurer>
            </div>

            <div
                onClick={openCreateDialog}
                className={classes.mainFab}
                style={{ transform: grid.hideFab
                    ? "translateY(calc(96px + env(safe-area-inset-bottom, 0px)))"
                    : "translateY(-8px)" }}
            >
                <Fab variant="extended" size="large">
                    <PhotoCameraRounded style={{ marginRight: 12 }} />
                    <span>{t("words.create", {TUC: true})}</span>
                </Fab>
            </div>

            <PaperCardMenuOption xy={menuCardXY} data={menuCardData} onClose={closeCardMenu}
                                 viewer={loggedInUser} onEditPost={onEditPost} onDeletePost={onDeletePost} />

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

            {newPostMounted && (
                <React.Suspense fallback={DIALOG_FALLBACK}>
                    <LazyNewPost
                        keepMounted={false}
                        open={postNav.createDialogOpen}
                        onClose={closeCreateDialog}
                        api={api}
                    />
                </React.Suspense>
            )}

            {postDialogMounted && (
                <React.Suspense fallback={DIALOG_FALLBACK}>
                    <LazyPostDialog
                        renderer={settings._renderer}
                        mode={settings._mode}
                        nsfw={settings._nsfw_enabled}
                        format={settings._format}
                        data={postNav.currentPost}
                        open={postNav.artworkOpen}
                        locales={locales}
                        api={api}
                        account={loggedInUser}
                        originRect={postNav.originRect}
                        onVoteChange={onVoteChange}
                        onClose={postNav.closePost}
                        getReturnRect={postNav.getReturnRect}
                        onDrawerPush={postNav.onDrawerPush}
                        onDrawerPop={postNav.onDrawerPop}
                        onPrevious={postNav.previousPost}
                        onNext={postNav.nextPost}
                    />
                </React.Suspense>
            )}
        </React.Fragment>
    );
};

// memo comparator: these four props are referentially stable when unchanged
// (classes from withStyles, settings from Index's processedSettings, pathname
// a primitive, api the shared apiRef value), matching the default shallow
// check while documenting intent — consistent with Profile/Community/Index.
export default withStyles(styles)(
    memo(Feed, (prev, next) =>
        prev.classes === next.classes &&
        prev.settings === next.settings &&
        prev.pathname === next.pathname &&
        prev.api === next.api,
    ),
);