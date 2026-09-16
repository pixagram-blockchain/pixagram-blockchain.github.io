import * as React from "preact/compat";
import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef, memo } from "preact/compat";
// Coalesce co-arriving setState calls after an await into a single render
// (Preact doesn't auto-batch across await / in promise continuations).
import { unstable_batchedUpdates as batch } from "preact/compat";
import { HISTORY, buildPostUrl, isPostUrl, parsePostUrl, isCommunityPostUrl, isDeletedPost, POST_DRAWER_TAB_HASHES, parseFeedFocusHash } from "../utils/constants";
import withStyles from "@material-ui/core/styles/withStyles";
import * as actions from "../actions/utils";
import { CellMeasurer } from "@pixagram/virtualized/dist/es/index";
import MasonryExtended from "../components/MasonryExtended";
import useWindowDimensions from "../hooks/useWindowDimensions";
import useMasonryGrid, { GUTTER_SIZE } from "../hooks/useMasonryGrid";
import { idle, cancelIdle } from "../utils/idle";
import viewCache, { postsSignature } from "../utils/viewCache";
import useVoteSync from "../hooks/useVoteSync";
import { applyOptimisticVote, overlayPendingVote, overlayPendingVotes, mergeFreshVoteDataInto, votesSignature } from "../utils/voteSync";
import { markFeedSeen, toMs } from "../utils/feedSeen";
import { EASE } from "../theme/motion";
import ImageMeasurer from "../components/ImageMeasurer";

import PaperCard, { isArtworkBlurred } from "../components/PaperCard";
import PaperCardBlog from "../components/PaperCardBlog";
import { enrichPostForBlogCard, isPortalBlogPost, isBlogCard, buildPortalPostUrl } from "../utils/blogCard";
import PaperCardMenuOption from "../components/PaperCardMenuOption";
import PhotoCameraRounded from "@material-ui/icons/PhotoCameraRounded";
import Fab from "@material-ui/core/Fab";

import { t, useLanguage } from "../utils/text";

// ── Deferred dialogs ─────────────────────────────────────────────────────
// The feed itself is just the masonry + cards. Every dialog below is opened
// in response to a user action (or a deep-link), so none of them belong in
// the initial feed chunk. Splitting them out shrinks the parse/eval cost of
// first paint; idle prefetch (see effects in the component) then warms the
// ones the user is most likely to reach, so the first open stays instant.
//
// NewPost is the heaviest (the full artwork editor) and only the CREATE
// action needs it.
const loadNewPost = () => import("../components/NewPost");
const LazyNewPost = React.lazy(loadNewPost);

// PostDialog is the full post viewer (recursive comment threads, vote lists,
// artwork rendering) — the most common thing opened after the feed. Warmed on
// idle for everyone (see effect) so the open-from-card animation isn't gated
// on a cold chunk fetch.
const loadPostDialog = () => import("../components/PostDialog");
const LazyPostDialog = React.lazy(loadPostDialog);

// BlogPostDialog is the portal-post viewer — the same one Community hosts.
// The personal feed mixes portal blog posts in, and Index lets this page host
// their /portal-N/@author/permlink URLs (OVERLAY_HOSTS_BY_POST_KIND), so a
// blog card opens over the feed instead of switching to the portal page.
// Warmed on idle only once a blog card is actually loaded.
const loadBlogPostDialog = () => import("../components/BlogPostDialog");
const LazyBlogPostDialog = React.lazy(loadBlogPostDialog);

// Edit / delete share one module and are reached only from the card menu on
// your own posts — warmed on idle for logged-in users only.
const loadOwnPostDialogs = () => import("../components/EditPostDialog");
const LazyEditPostDialog = React.lazy(loadOwnPostDialogs);
const LazyDeletePostDialog = React.lazy(() => loadOwnPostDialogs().then(m => ({ default: m.DeletePostDialog })));

// Suspense fallback for a lazily-loaded dialog — shown only on a cold open
// (chunk not yet cached, before idle-prefetch ran). A dim backdrop appears
// instantly so the tap reads as "opening…" instead of a blank frame; the real
// dialog replaces it the moment its chunk resolves. Warm opens never hit this.
const DIALOG_FALLBACK = (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1300 }} />
);

// What the viewer that is NOT holding the current post receives, so PostDialog
// never sees a blog card and BlogPostDialog never sees an artwork.
const NO_POST = Object.freeze({});


// ╔══════════════════════════════════════════════════════════════════════╗
// ║  1. STYLES                                                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

const styles = theme => ({
    mainFab: {
        animation: `$slideInFromBottom 300ms ${EASE} 0ms`,
        "@global": { "@keyframes slideInFromBottom": { "0%": { transform: "translateY(160px)", filter: "opacity(0)" }, "100%": { transform: "translateY(0px)", filter: "opacity(1)" } } },
        // env() lifts the FAB above the Android gesture nav bar when Chrome
        // draws edge-to-edge (Android 15+); resolves to 0px everywhere else.
        position: "fixed", right: 16, bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
        transition: `transform 225ms ${EASE} 75ms`,
        "& .MuiButtonBase-root": {
            borderRadius: "32px", background: "#f6f6f6", transition: `background 225ms ${EASE} 75ms`,
            mixBlendMode: "overlay",
            "& .MuiTouchRipple-root": { filter: "opacity(1)", "& .MuiTouchRipple-child": { backgroundImage: `radial-gradient(circle at 50% 50%, magenta 0%, blue 20%, cyan 40%, green 60%, yellow 80%, red 100%)` } },
        },
        "& .MuiButtonBase-root:hover": { background: "white", transition: `background 225ms ${EASE} 5ms` },
        "& .MuiFab-extended": { padding: "0 24px", height: 64, fontSize: "1.125rem" },
        "& .MuiFab-extended .MuiSvgIcon-root": { fontSize: "1.75rem" },
    },
    masonry: {
        overflow: "hidden overlay !important", contain: "style layout",
        "& > .ReactVirtualized__Masonry": {
            zIndex: 0, position: "absolute", margin: 0, scrollBehavior: "smooth",
            overscrollBehavior: "none", boxSizing: "content-box !important", touchAction: "pan-y",
            overflow: "hidden overlay !important", willChange: "scroll-position !important",
            "& > .ReactVirtualized__Masonry__innerScrollContainer": {
                top: "auto !important", left: "auto !important", contentVisibility: "auto",
                overflow: "initial !important", position: "absolute !important",
                paddingBottom: "48px", boxSizing: "content-box",
            },
        },
    },
});


// ╔══════════════════════════════════════════════════════════════════════╗
// ║  2. PURE HELPERS                                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

// ImageMeasurer accessors — hoisted so they're referentially stable across
// renders. Inline `item => item.image` lambdas handed ImageMeasurer a fresh
// prop identity on every render (every scroll tick included), defeating any
// shallow-compare bail-out inside it.
const GET_ITEM_IMAGE = (item) => item.image;
const GET_ITEM_ID = (item) => item.id;

// ── Portal blog posts in the personal feed ─────────────────────────────
// The followed-accounts feed returns portal blog posts alongside artworks.
// They used to go through the artwork path: no body image → ImageMeasurer
// never sized them → the cell rendered nothing (and one with an image in
// its body showed up as a bogus artwork card). They now render as
// PaperCardBlog. Their height is the card's own layout, not an image, so
// they bypass ImageMeasurer: each gets a fixed placeholder entry (stable per
// card object, so identity holds across renders) and CellMeasurer measures
// the real card, exactly as on the portal page.
const BLOG_ENTRY_CACHE = new WeakMap();
const blogEntryOf = (card) => {
    let entry = BLOG_ENTRY_CACHE.get(card);
    if (!entry) {
        entry = { item: card, size: { id: card.id, width: 1, height: 1 } };
        BLOG_ENTRY_CACHE.set(card, entry);
    }
    return entry;
};
// An artwork the measurer hasn't listed yet: same "not sized" shape the
// cellRenderer already skips (`!size.height`), so it keeps its index.
const PENDING_ENTRY_CACHE = new WeakMap();
const pendingEntryOf = (post) => {
    let entry = PENDING_ENTRY_CACHE.get(post);
    if (!entry) {
        entry = { item: post, size: { id: post.id, width: 0, height: 0 } };
        PENDING_ENTRY_CACHE.set(post, entry);
    }
    return entry;
};

// A blog card can't blur its cover the way PaperCard blurs an artwork, so
// while "show NSFW" is off an nsfw-flagged blog card is shown without it.
// Cached per card object for the same identity reason.
const COVERLESS_CACHE = new WeakMap();
const withoutCover = (card) => {
    let copy = COVERLESS_CACHE.get(card);
    if (!copy) { copy = { ...card, image: null }; COVERLESS_CACHE.set(card, copy); }
    return copy;
};

const sameEntries = (a, b) => {
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
};

// Which viewer a post URL opens in. The URL decides, exactly as it decides
// the host page in Index (hostPageForPostUrl): a community-post URL
// (/portal-N/@author/permlink) is a blog post → BlogPostDialog; any other
// post URL is an artwork → PostDialog.
const POST_KIND_ARTWORK = "artwork";
const POST_KIND_BLOG = "blog";
const postKindOfUrl = (pathname) => (isCommunityPostUrl(pathname) ? POST_KIND_BLOG : POST_KIND_ARTWORK);

// The URL a card pushes when opened. Blog cards build theirs from the portal
// slug they were classified with, so it always parses as a community post.
const postUrlOf = (data) => (isBlogCard(data) ? buildPortalPostUrl(data) : buildPostUrl(data));

// ── Blur-aware sibling walk (dialog prev/next) — see Feed.js ───────────
// PaperCard owns the "is this card blurred" truth (author/server NSFW flag
// OR the on-device detector's cached verdict, honoured only while the
// user's "show NSFW" toggle is off); prev/next skips exactly those cards
// and an arrow only renders when the walk can land somewhere.
const isSamePost = (p, cur) => !!p && !!cur
    && p.permlink === cur.permlink
    && (p.author?.username || p.author) === (cur.author?.username || cur.author);

const findNavigableIndex = (list, from, dir, nsfwEnabled, getPost) => {
    for (let i = from + dir; i >= 0 && i < list.length; i += dir) {
        const p = getPost ? getPost(list[i]) : list[i];
        // Blog cards open in BlogPostDialog, never in PostDialog — step over.
        if (p && !isBlogCard(p) && !isArtworkBlurred(p, p.id, nsfwEnabled)) return i;
    }
    return -1;
};

const resolveDisplayName = (account, fallback) => {
    const dn = account._profile && account._profile.display_name;
    return (typeof dn === 'string' && dn.trim()) || account.name || fallback || '';
};

const parsePayout = (raw) => parseFloat((raw || '0').replace(/[^0-9.\-]/g, '')) || 0;

// ── Parsed-metadata cache ───────────────────────────────────────────────
// json_metadata is consulted several times per post (NSFW here, the deleted
// flag, hydration) and AGAIN in phase 2 of the two-phase enrichment, which
// re-maps the SAME raw post objects to patch avatars in. One WeakMap-cached
// parse per raw post object; an edited post arrives as a NEW object from the
// node, so staleness is impossible. See Feed.js.
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

// Portal blog post → the portal's own card shape (shared with Community),
// with the feed's NSFW / soft-delete predicates so filtering stays uniform
// across both card kinds.
const enrichFeedBlogCard = (post, account, voterProfiles) => ({
    ...enrichPostForBlogCard(post, account, voterProfiles),
    nsfw: isNsfwPost(post), deleted: isDeletedPost(post), children: post.children ?? 0,
    // Raw chain timestamp, read with the shared toMs (utils/feedSeen) by the
    // seen tracking below — the same reading MenuContent's scan applies, so
    // a card and the badge counting it agree on where it sits in the feed.
    created: post.created ?? null,
});

const enrichPostForCard = (post, account, voterProfiles) => {
    if (isPortalBlogPost(post)) return enrichFeedBlogCard(post, account, voterProfiles);
    const pp = parsePayout(post.pending_payout_value), tp = parsePayout(post.total_payout_value), cp = parsePayout(post.curator_payout_value);
    const payout = pp > 0 ? pp : tp + cp;
    const tags = post._tags || [], images = post._images || [], activeVotes = post.active_votes || [];
    const fi = images[0] ?? null;
    return {
        id: post._entity_id || post.id || `${post.author}_${post.permlink}`,
        author: { username: account.name || '', name: resolveDisplayName(account), image: account.image || account._profile?.profile_image || '' },
        title: post.root_title || post.title || '', image: fi ? (typeof fi === 'string' ? fi : fi.src) : null,
        date: post.created ? new Date(post.created).getTime() : Date.now(), payout: `$${payout.toFixed(2)}`,
        created: post.created ?? null, // raw, for the seen tracking (see enrichFeedBlogCard)
        upVotesNumber: Math.max(0, post.net_votes || activeVotes.filter(v => v?.weight >= 0).length || 0),
        downVotesNumber: Math.max(0, activeVotes.filter(v => v?.weight < 0).length || 0),
        active_votes: activeVotes, net_rshares: post.net_rshares != null ? String(post.net_rshares) : '0',
        _voter_profiles: voterProfiles || {}, nsfw: isNsfwPost(post), deleted: isDeletedPost(post), tags,
        permlink: post.permlink || '', category: post.category || '', _content_type: post._content_type || 'pixel_art',
        _description_html: post._description_html || '', _summary: post._summary || '', json_metadata: post.json_metadata || '',
        children: post.children ?? 0, commentsNumber: post.children ?? 0,
    };
};

// Shared with Feed / Community / Profile (utils/voteSync): patches the card
// AND registers the vote as pending so later hydrations keep it — see Feed.js.
const applyVoteToPost = (post, permlink, voter, weight) => applyOptimisticVote(post, permlink, voter, weight);

// Hydrate a raw discussion object into the shape enrichPostForCard expects.
// Mirrors the per-post derived fields (_images, _tags, _summary,
// _content_type) that enrichPostsList populates in the bulk-fetch path.
const hydrateContent = (content) => {
    if (content._images && content._tags) return content;
    const meta = getJsonMeta(content);
    if (!content._images) {
        const body = content.body || '', imgs = [];
        let m; const re1 = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
        while ((m = re1.exec(body)) !== null) imgs.push({ src: m[1], alt: '', is_base64: m[1].startsWith('data:'), index: imgs.length });
        if (!imgs.length) { const re2 = /!\[([^\]]*)\]\(([^)]+)\)/g; while ((m = re2.exec(body)) !== null) imgs.push({ src: m[2], alt: m[1]||'', is_base64: m[2].startsWith('data:'), index: imgs.length }); }
        // Array only: a blog post's meta.image is a string (its cover), and
        // `.forEach` on it threw — orphan blog posts resolve through here too.
        if (!imgs.length && Array.isArray(meta.image)) meta.image.forEach((src, i) => { if (typeof src === 'string' && src) imgs.push({ src, alt: '', is_base64: src.startsWith('data:'), index: i }); });
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
// `kind` is the URL's post kind: a community-post URL is always handed the
// blog-card shape (what BlogPostDialog reads — Community does the same for
// every post it resolves by URL), anything else goes through the card
// classifier as usual.
const fetchOrphanPost = async (api, author, permlink, kind = POST_KIND_ARTWORK) => {
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
                console.warn('[FeedPersonal] getContent failed:', e && e.message);
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
                _content_type: kind === POST_KIND_BLOG ? 'blog' : 'pixel_art',
            };
        }

        // hydrateContent defaults a missing type to 'pixel_art'; a post reached
        // through a community-post URL is a blog post.
        if (kind === POST_KIND_BLOG && !content._content_type) content._content_type = 'blog';
        hydrateContent(content);
        return overlayPendingVote(kind === POST_KIND_BLOG
            ? enrichFeedBlogCard(content, authorAccount, {})
            : enrichPostForCard(content, authorAccount, {}));
    } catch (e) {
        console.warn('[FeedPersonal] fetchOrphanPost failed:', e && e.message);
        return null;
    }
};

// onAvatars (optional): when provided, returns text-ready cards immediately
// (one round-trip sooner) and calls onAvatars(enrichedWithAvatars) once
// author/voter accounts resolve. Omit for the original single-phase behavior.
const fetchAndEnrichPosts = async (api, loggedInUser, existingPosts, pagination, onAvatars) => {
    let posts;
    if (loggedInUser) {
        // Database API: client.database.getDiscussions("feed", { tag: <username> })
        // — posts from accounts the logged-in user follows, ordered by head-block
        // creation time. `api.content.getDiscussionsByFeed` wraps that exact call
        // (see ContentAPI._fetchDiscussionsWithCache → database.getDiscussions).
        // Bridge get_account_posts(sort='feed') is kept as a fallback so a
        // transient database failure or empty response doesn't blank the feed.
        const dbQuery = {
            tag: loggedInUser,
            limit: 20,
            ...(pagination?.start_author ? { start_author: pagination.start_author } : {}),
            ...(pagination?.start_permlink ? { start_permlink: pagination.start_permlink } : {}),
        };
        posts = await api.content.getDiscussionsByFeed(dbQuery)
            .catch(e => { console.warn('[FeedPersonal] database.getDiscussions(feed) failed:', e.message); return null; });
        if (!Array.isArray(posts) || posts.length === 0) {
            const bridgeQuery = {
                limit: 20,
                ...(pagination?.start_author ? { start_author: pagination.start_author } : {}),
                ...(pagination?.start_permlink ? { start_permlink: pagination.start_permlink } : {}),
            };
            posts = await api.communities.getAccountPosts(loggedInUser, 'feed', bridgeQuery)
                .catch(e => { console.warn('[FeedPersonal] getAccountPosts(feed) fallback failed:', e.message); return []; });
        }
    } else {
        // Anonymous fallback: generic trending via bridge.get_ranked_posts.
        const rankedQuery = {
            sort: 'trending',
            tag: '',
            limit: 20,
            ...(pagination || {}),
        };
        posts = await api.communities.getRankedPosts(rankedQuery)
            .catch(e => { console.warn('[FeedPersonal] getRankedPosts(trending) fallback failed:', e.message); return []; });
    }
    posts = Array.isArray(posts) ? posts : [];

    // Skip duplicate cursor row when paginating (mirrors Feed.js behavior).
    if (pagination?.start_author && posts.length > 0
        && posts[0].author === pagination.start_author
        && posts[0].permlink === pagination.start_permlink) {
        posts = posts.slice(1);
    }
    if (!posts.length) return [];

    // Build cards from a (possibly empty) account map; dedup here so phase 1
    // and phase 2 agree on membership/order, differing only in avatars.
    const buildEnriched = (accountsMap, voterProfiles) => {
        const enriched = posts.map(p => enrichPostForCard(p, accountsMap[p.author] || { name: p.author || '', _profile: {} }, voterProfiles));
        if (existingPosts?.length) {
            const existingIds = new Set(existingPosts.map(p => p.id));
            return enriched.filter(p => !existingIds.has(p.id));
        }
        return enriched;
    };
    const collectNames = () => {
        const allVotes = posts.flatMap(p => p.active_votes || []);
        return [...new Set([...allVotes.map(v => v?.voter).filter(Boolean), ...posts.map(p => p.author).filter(Boolean)])];
    };
    const buildMaps = (accs) => {
        const voterProfiles = {}, accountsMap = {};
        if (Array.isArray(accs)) accs.forEach(a => { if (!a) return; const n = a.name || a._entity_id; if (n) { const img = a._profile?.profile_image || ''; voterProfiles[n] = img; a.image = img; accountsMap[n] = a; } });
        return { accountsMap, voterProfiles };
    };

    // ── Two-phase path (onAvatars provided, e.g. initial page load) ────────
    // Return text-ready cards NOW (gated on the post fetch alone); fetch avatar
    // accounts in the background and hand the enriched list back via onAvatars.
    // The names-only card is the same shape the single-phase path falls back to
    // on an account-lookup miss, so it renders identically minus the avatar.
    if (onAvatars) {
        const uniqueNames = collectNames();
        if (uniqueNames.length > 0 && api?.accounts) {
            api.accounts.getAccounts(uniqueNames)
                .then(accs => { const { accountsMap, voterProfiles } = buildMaps(accs); onAvatars(buildEnriched(accountsMap, voterProfiles)); })
                .catch(() => {});
        }
        return buildEnriched({}, {});
    }

    // ── Single-phase path (pagination / inline-avatar callers) ─────────────
    const uniqueNames = collectNames();
    let accountsMap = {}, voterProfiles = {};
    if (uniqueNames.length > 0 && api?.accounts) {
        const accs = await api.accounts.getAccounts(uniqueNames).catch(() => []);
        ({ accountsMap, voterProfiles } = buildMaps(accs));
    }
    return buildEnriched(accountsMap, voterProfiles);
};


// ╔══════════════════════════════════════════════════════════════════════╗
// ║  4. HOOKS                                                           ║
// ╚══════════════════════════════════════════════════════════════════════╝

// ── useFeedPersonalData ────────────────────────────────────────────────
const useFeedPersonalData = (api, pathname) => {
    const [posts, setPosts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [loggedInUser, setLoggedInUser] = useState(null);
    const [dataVersion, setDataVersion] = useState(0);
    const prevPathnameRef = useRef(pathname);

    // ── View cache (stale-while-revalidate) ────────────────────────────
    // Same rationale as Feed.js: Index.js remounts the page subtree on
    // every cross-page navigation, so the personal feed refetched and
    // re-measured from scratch on each return. The module-level viewCache
    // keeps the last list per account so the return paint is instant; the
    // fetch below still runs and refreshes it.
    const cacheKeyRef = useRef("");
    const pendingScrollRef = useRef(0);
    // Key the current `posts` list was loaded for (see Feed.js): guards the
    // cache-mirror effect during an account switch.
    const postsKeyRef = useRef("");

    // Shadow ref so the infinite-scroll closure always sees the latest list
    // without recapturing via dependencies (mirrors Feed.js).
    const postsRef = useRef(posts);
    postsRef.current = posts;

    const loadPage = useCallback(async () => {
        if (!api?.initialized) { setTimeout(loadPage, 250); return; }
        setIsLoading(true);
        setLoadingMore(false);
        setHasMore(true);
        try {
            const user = await api.getActiveAccount().catch(() => null);
            setLoggedInUser(user || null);
            if (!user) console.warn('[FeedPersonal] No logged-in user, falling back to trending');

            // The cache key needs the account, so the lookup happens after
            // getActiveAccount. Serve the last known list instantly on a
            // cold mount or account switch only — event-driven refetches of
            // the SAME key keep the live list and just revalidate (re-
            // serving the stale entry there would jolt the masonry).
            const cacheKey = `feedpersonal|${user || 'anon'}`;
            const keyChanged = cacheKey !== cacheKeyRef.current;
            cacheKeyRef.current = cacheKey;
            let servedFromCache = false;
            if (keyChanged || (postsRef.current || []).length === 0) {
                const cached = viewCache.get(cacheKey);
                if (cached?.posts?.length) {
                    servedFromCache = true;
                    pendingScrollRef.current = cached.scrollTop || 0;
                    postsKeyRef.current = cacheKey;
                    batch(() => {
                        // Cached rows predate any vote cast since; the pending
                        // registry re-applies it.
                        setPosts(overlayPendingVotes(cached.posts));
                        setDataVersion(v => v + 1);
                        setIsLoading(false);
                    });
                }
            }

            // Single-phase: `enriched` already carries author avatars
            // (onAvatars omitted → fetchAndEnrichPosts awaits getAccounts and
            // folds profile images in before returning), so the card paints
            // once — image and profile together. One extra round-trip on a
            // COLD load only; viewCache serves return visits instantly.
            // hivemind lags the head block: a vote cast a moment ago isn't in
            // the fetched rows yet — the pending registry puts it back.
            const enriched = overlayPendingVotes(await fetchAndEnrichPosts(api, user, null, null, null));
            const replaced = postsSignature(enriched) !== postsSignature(postsRef.current);
            batch(() => {
                // Keep an already-shown cache-served list of the SAME membership
                // (it has avatars) rather than repainting an identical list.
                // Only paint+reset when content is genuinely new.
                if (!servedFromCache || replaced) {
                    postsKeyRef.current = cacheKey;
                    setPosts(enriched);
                    viewCache.set(cacheKey, { posts: enriched });
                    // dataVersion means "the loaded list was replaced": it
                    // drives the masonry re-pack (the caches are index-keyed
                    // — see the layout effect in the component) as well as
                    // the cache-served scroll restore. An event refetch that
                    // comes back with the same membership and order repaints
                    // in place and must not re-measure the feed under the
                    // reader, so only a real replacement bumps it.
                    if (replaced) setDataVersion(v => v + 1);
                } else if (votesSignature(enriched) !== votesSignature(postsRef.current)) {
                    // Same membership, fresher vote/payout rows: commit without
                    // the Masonry reset (heights don't depend on votes). The
                    // old branch dropped this data, which is how an optimistic
                    // vote vanished on the next return visit.
                    postsKeyRef.current = cacheKey;
                    setPosts(enriched);
                    viewCache.patch(cacheKey, { posts: enriched });
                }
                setIsLoading(false);
            });
        } catch (e) { console.error('[FeedPersonal] _update_page error:', e); }
        setIsLoading(false);
    }, [api]);

    // Mirror vote patches (handleVoteChange, onVoteSynced) into the SWR cache
    // so a return visit is not served the pre-vote rows — see Feed.js.
    useEffect(() => {
        if (!posts.length) return;
        const key = cacheKeyRef.current;
        if (!key || postsKeyRef.current !== key) return;
        viewCache.patch(key, { posts });
    }, [posts]);

    // 6 s chain refresh after a vote (real rshares + pending_payout_value
    // replace the optimistic placeholder and the estimated payout) — Feed.js.
    const onVoteSynced = useCallback(({ content }) => {
        setPosts(prev => mergeFreshVoteDataInto(prev, content));
    }, []);
    useVoteSync(api, onVoteSynced);

    // Glue for the component: hand a cached scroll offset over exactly
    // once, and let unmount persist the live offset back.
    const consumePendingScrollRestore = useCallback(() => {
        const top = pendingScrollRef.current;
        pendingScrollRef.current = 0;
        return top;
    }, []);
    // Non-consuming peek for the re-pack effect: while a cache-served
    // offset is waiting to be applied, that restore owns the viewport.
    const hasPendingScrollRestore = useCallback(() => pendingScrollRef.current > 0, []);

    const saveScrollPosition = useCallback((top) => {
        viewCache.patch(cacheKeyRef.current, { scrollTop: top });
    }, []);

    // The 300 ms loading-bar tick is cancelled on unmount so a quick page
    // switch can't fire a stale progress update onto the next page.
    useEffect(() => {
        actions.trigger_page_render_complete();
        actions.trigger_loading_update(0);
        const loadingTimer = setTimeout(() => actions.trigger_loading_update(100), 300);
        loadPage();
        return () => clearTimeout(loadingTimer);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Refresh on content lifecycle events ─────────────────────────────
    // Parity with Feed.js: a publish, delete or edit (content_updated, fired
    // by api.broadcast.updateComment) refetches the personal feed after the
    // usual 6 s chain-indexing debounce, but only when the event plausibly
    // concerns it (own broadcast, or a post currently in view).
    useEffect(() => {
        if (!api?.eventEmitter) return;
        let refetchTimer = null;
        const scheduleRefetch = () => {
            if (refetchTimer) clearTimeout(refetchTimer);
            refetchTimer = setTimeout(() => { refetchTimer = null; loadPage(); }, 6000);
        };
        const inView = (payload) => (postsRef.current || []).some(
            p => p.permlink === payload?.permlink
                && (p.author?.username || p.author) === payload?.author
        );
        const onPostPublished = (payload) => {
            if (loggedInUser && payload?.author === loggedInUser) scheduleRefetch();
        };
        const onContentDeleted = (payload) => { if (inView(payload)) scheduleRefetch(); };
        const onContentUpdated = (payload) => {
            const turnedDeleted = payload?.jsonMetadata?.deleted === true;
            if (inView(payload) || turnedDeleted) scheduleRefetch();
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
    }, [api, loggedInUser, loadPage]);

    // Pathname changes. Reload only on a true feed-identity change. Opening
    // / closing PostDialog or BlogPostDialog (and in-dialog next/prev
    // navigation) only changes the URL by adding, removing, or swapping a
    // `/<sort>/@author/permlink` or `/portal-N/@author/permlink` suffix while
    // FeedPersonal stays mounted as the post overlay's host (see
    // OVERLAY_HOSTS_BY_POST_KIND in Index.js — `feedpersonal` hosts both
    // feed-kind and community-kind post URLs). The underlying personal feed
    // hasn't changed in that case, and loadPage would wipe scroll position, the `hasMore`
    // flag, and any already-paginated extra pages, then refetch the same
    // data — and again on close (HISTORY.go(-1) triggers this effect a
    // second time). The post overlay's own URL listener lives in
    // usePostNavigation, so this skip doesn't drop any work.
    useEffect(() => {
        if (pathname === prevPathnameRef.current) return;
        const prev = prevPathnameRef.current;
        prevPathnameRef.current = pathname;
        if (isPostUrl(prev) || isPostUrl(pathname)) return;
        loadPage();
    }, [pathname, loadPage]);

    const loadMorePosts = useCallback(async () => {
        const currentPosts = postsRef.current;
        if (loadingMore || isLoading || !hasMore || !currentPosts?.length || !api?.initialized) return;

        const last = currentPosts[currentPosts.length - 1];
        const startAuthor = last.author?.username || last.author || '';
        const startPermlink = last.permlink || '';
        if (!startAuthor || !startPermlink) return;

        setLoadingMore(true);
        try {
            const newPosts = overlayPendingVotes(await fetchAndEnrichPosts(api, loggedInUser, currentPosts, {
                start_author: startAuthor, start_permlink: startPermlink,
            }));
            if (newPosts.length > 0) {
                setPosts(prev => [...prev, ...newPosts]);
                // Mirror the append into the view cache (patch keeps the
                // original fetch timestamp) so a return visit restores the
                // full scrolled-through list, not just page one.
                viewCache.patch(cacheKeyRef.current, { posts: [...currentPosts, ...newPosts] });
            } else {
                // Empty page → end of feed; stop trying.
                setHasMore(false);
            }
        } catch (e) {
            console.warn('[FeedPersonal] _load_more_posts failed:', e.message);
        }
        setLoadingMore(false);
    }, [api, loggedInUser, loadingMore, isLoading, hasMore]);

    const handleVoteChange = useCallback((permlink, voter, weight) => {
        setPosts(prev => prev.map(p => applyVoteToPost(p, permlink, voter, weight)));
    }, []);

    return {
        posts, isLoading, loadingMore, hasMore, loggedInUser, dataVersion,
        handleVoteChange, loadMorePosts,
        consumePendingScrollRestore, hasPendingScrollRestore, saveScrollPosition,
    };
};

// ── Grid configuration (shared hook in ../hooks/useMasonryGrid) ───────
// Single centered column, capped at 720 px. Page chrome (centering
// padding, view width, fab visibility) is derived here from the shared
// core — it's FeedPersonal layout, not grid mechanics.
const useFeedPersonalGrid = ({ windowWidth, windowHeight, isMobile, overscanByPixels, loadMoreThreshold, loadMorePosts, loadingMore }) => {
    const core = useMasonryGrid({
        windowWidth, windowHeight, isMobile, overscanByPixels,
        loadMoreThreshold, loadMorePosts, loadingMore,
        // columnCount: fixed 1 (no getColumnCount)
        fallbackColumnWidth: 640,
        maxColumnWidth: 720,
        defaultHeight: 600,
        scrollReloadDivisor: 1,
    });

    const pageWidth = isMobile ? windowWidth : windowWidth - 284;
    const paddingX = Math.round((pageWidth - core.columnWidth) / 2);
    const viewWidth = pageWidth - paddingX * 2;
    const postListHeight = windowHeight - 16;
    const hideFab = core.scrollY > 0 && core.scrollTop > 512;

    return { ...core, pageWidth, paddingX, viewWidth, postListHeight, hideFab };
};

// ── usePostNavigation ──────────────────────────────────────────────────
const usePostNavigation = ({ api, posts, masonryRef, scrollToIndex, setSelectedPostIndex, nsfwEnabled }) => {
    const [artworkOpen, setArtworkOpen] = useState(false);
    const [currentPost, setCurrentPost] = useState({});
    const [originRect, setOriginRect] = useState(null);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [isOrphan, setIsOrphan] = useState(false);
    // Which viewer holds the post: POST_KIND_ARTWORK (PostDialog) or
    // POST_KIND_BLOG (BlogPostDialog). Deliberately NOT reset on close, so
    // the dialog that is closing keeps its `open` transition.
    const [postKind, setPostKind] = useState(POST_KIND_ARTWORK);
    const historyDepthRef = useRef(0);
    const postClosedAtRef = useRef(0);
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
        // link / refresh on an open post), seat the feed beneath the overlay
        // so Back returns to the feed and closes the dialog instead of leaving
        // the site. Same-page only. See Feed.js for the full rationale.
        if (!seededRef.current) {
            seededRef.current = true;
            const seedPath = HISTORY.location.pathname;
            const seedHash = HISTORY.location.hash || "";
            if (isPostUrl(seedPath) && historyDepthRef.current === 0) {
                HISTORY.replace("/feed/");
                HISTORY.push(seedPath + seedHash);
                historyDepthRef.current = 1;
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
            // Portal post URL → BlogPostDialog, any other → PostDialog. Set
            // before the bail-out below (a same-value set is a no-op).
            const kind = postKindOfUrl(pathname);
            setPostKind(kind);
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
            // Orphan: fetch on demand so deep-links still work. Open the
            // dialog *immediately* with a stub from the URL so the transition
            // isn't gated on the network round-trip — the dialog renders its
            // loading state from _loading until the fetch hydrates real
            // content, or shows _notFound on failure.
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
            // FeedPersonal is wrapped in `memo` so even Index's apiReady-
            // rebuild dispatching a new page element doesn't trigger a
            // FeedPersonal re-render when the api reference and other props
            // are unchanged (the memo shallow-compare passes). Polling
            // sidesteps all of that and works regardless of whether/when
            // React re-renders. The token guard inside still discards stale
            // fetches if the URL changes mid-poll.
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
                const enriched = await fetchOrphanPost(apiNow, parsed.author, parsed.permlink, kind);
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
    // history entry — PostDialog and BlogPostDialog both adopt
    // HISTORY.location.hash when they open) and seat the dialog. Blog cards
    // push their portal URL; Index keeps this page mounted for it, so the
    // blog post opens over the feed exactly like an artwork. See Feed.js for
    // the full note.
    const pushAndOpen = useCallback((data, rect, hash) => {
        const u = postUrlOf(data); if (u) HISTORY.push(hash ? u + hash : u);
        orphanFetchTokenRef.current += 1;
        setIsOrphan(false);
        const blog = isBlogCard(data);
        setPostKind(blog ? POST_KIND_BLOG : POST_KIND_ARTWORK);
        // originRect drives PostDialog's hero transition only.
        setArtworkOpen(true); setCurrentPost(data); setOriginRect(blog ? null : (rect || null)); historyDepthRef.current = 1;
    }, []);

    // Plain open — card title / image click.
    const openPost = useCallback((data, rect) => pushAndOpen(data, rect), [pushAndOpen]);

    // Comment-button open — pushes "…/permlink#replies" so PostDialog lands
    // on the comments tab (same deep-link scheme as Profile's comment links)
    // and BlogPostDialog scrolls its comments column into view (the same
    // intent Community's cards push).
    const openPostComments = useCallback(
        (data, rect) => pushAndOpen(data, rect, POST_DRAWER_TAB_HASHES[1]),
        [pushAndOpen],
    );

    const closePost = useCallback(() => {
        const depth = historyDepthRef.current;
        setArtworkOpen(false); setCurrentPost({}); setOriginRect(null); setIsOrphan(false);
        postClosedAtRef.current = Date.now(); historyDepthRef.current = 0;
        if (!isPostUrl(HISTORY.location.pathname)) return;
        // depth === 0 → dialog opened from the URL (deep-link/refresh or a
        // back→forward re-open), not via openPost, so there's nothing to
        // rewind. REPLACE the post URL with the fallback rather than pushing
        // on top of it: a push would leave the post URL behind us so the next
        // browser Back would re-open the dialog. See Feed.js for the full note.
        if (depth > 0) HISTORY.go(-depth); else HISTORY.replace("/feed/");
    }, []);

    // Counter-bump for PostDialog's drawer-hash push — see Feed.js for the
    // full rationale.
    const onDrawerPush = useCallback(() => {
        historyDepthRef.current += 1;
    }, []);

    const onDrawerPop = useCallback(() => {
        if (historyDepthRef.current > 0) historyDepthRef.current -= 1;
    }, []);

    const navigatePost = useCallback((dir) => {
        const m = masonryRef.current; if (!m?.props?.itemsWithSizes?.length) return false;
        const items = m.props.itemsWithSizes;
        const ci = items.findIndex(({ item }) => isSamePost(item, currentPost));
        // Skip artworks whose card is blurred; `false` = no clean sibling
        // left that way → the dialog bounces the current artwork back
        // instead of dead-ending. See Feed.js for the full rationale.
        const ni = findNavigableIndex(items, ci, dir, nsfwEnabled, (e) => e.item);
        if (ni === -1) return false;
        const { item } = items[ni]; const u = buildPostUrl(item);
        // Sibling navigation is a lateral swap — replace, don't push. See Feed.js.
        if (u) HISTORY.replace(u);
        setCurrentPost(item); setSelectedPostIndex?.(ni); scrollToIndex?.(ni);
        return true;
    }, [masonryRef, currentPost, scrollToIndex, setSelectedPostIndex, nsfwEnabled]);

    const nextPost = useCallback(() => navigatePost(1), [navigatePost]);
    const previousPost = useCallback(() => navigatePost(-1), [navigatePost]);

    // ── Arrow availability + reverse-hero target — see Feed.js ─────────
    // Same blur-skipping walk as navigatePost, run over `posts` (identical
    // order to the measured items) so it can run during render; an
    // exhausted direction surfaces its callback as `undefined` (the orphan
    // convention) and the dialog unmounts that arrow.
    // Artworks only: BlogPostDialog has no prev/next (as on the portal page).
    const canGoNext = useMemo(() => {
        if (!artworkOpen || isOrphan || postKind !== POST_KIND_ARTWORK) return false;
        const list = posts || [];
        if (!list.length) return false;
        const ci = list.findIndex((p) => isSamePost(p, currentPost));
        return findNavigableIndex(list, ci, 1, nsfwEnabled) !== -1;
    }, [artworkOpen, isOrphan, postKind, posts, currentPost, nsfwEnabled]);

    const canGoPrev = useMemo(() => {
        if (!artworkOpen || isOrphan || postKind !== POST_KIND_ARTWORK) return false;
        const list = posts || [];
        if (!list.length) return false;
        const ci = list.findIndex((p) => isSamePost(p, currentPost));
        return findNavigableIndex(list, ci, -1, nsfwEnabled) !== -1;
    }, [artworkOpen, isOrphan, postKind, posts, currentPost, nsfwEnabled]);

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

    // Stable return identity: re-allocate only when a field actually changes.
    // This object was previously a fresh literal every render, so every
    // downstream hook keyed on `postNav` (the cell renderer, dialog props)
    // recomputed on every parent render — scroll ticks included. Memoizing
    // lets those bail when nothing here moved. setCreateDialogOpen is a
    // stable useState setter, so it's intentionally not a dep.
    return useMemo(() => ({
        artworkOpen, currentPost, originRect, isOrphan, postKind,
        createDialogOpen, setCreateDialogOpen,
        openPost, openPostComments, closePost, onDrawerPush, onDrawerPop, getReturnRect,
        nextPost: (isOrphan || !canGoNext) ? undefined : nextPost,
        previousPost: (isOrphan || !canGoPrev) ? undefined : previousPost,
    }), [artworkOpen, currentPost, originRect, isOrphan, postKind, createDialogOpen,
        openPost, openPostComments, closePost, onDrawerPush, onDrawerPop, getReturnRect,
        nextPost, previousPost, canGoNext, canGoPrev]);
};


// ── useFeedFocus ───────────────────────────────────────────────────────
// "/feed#focus=<ref>" — open the feed scrolled to one post (buildFeedFocusHash
// in utils/constants; the drawer's Friends row pushes it for a friend's
// newest unseen post). Reaching the card is a small state machine, because
// nothing about the target is in place when the hash arrives:
//   1. it may sit on a later page — the drawer scans up to 60 feed posts,
//      the page loads 20 — so page forward (loadMorePosts) until it is in
//      the batch, at most FOCUS_MAX_EXTRA_PAGES pages;
//   2. once in the list, the masonry still has no position for it: it
//      measures and lays cells out lazily as the viewport approaches them,
//      so move the viewport towards it — one render window at a time,
//      each step anchored on the nearest cell already placed on the way —
//      until getCellPosition answers;
//   3. cells above it keep re-measuring as ImageMeasurer resolves their
//      images, which shifts it — so after landing, hold and re-check until
//      the position stands still for FOCUS_SETTLE_PASSES passes.
// One polling loop does all three (the page already polls for api readiness
// and scroll tracking), reading the live grid / lists / loader through a
// ref every tick so it can never act on a stale render. It stops on a new
// target, any navigation to a post, the reader's own wheel / touch scrolling,
// unmount, or the deadline — and giving up is always silent: the feed is
// simply left where it is.
const FOCUS_POLL_MS = 120;          // loop tick while paging / walking down
const FOCUS_SETTLE_MS = 250;        // loop tick while parked on the target
const FOCUS_SETTLE_PASSES = 4;      // ~1 s of a still position = landed
const FOCUS_DEADLINE_MS = 20000;    // api boot + paging + measuring, worst case
const FOCUS_PAGE_WAIT_MS = 8000;    // one requested page that never lands
const FOCUS_MAX_EXTRA_PAGES = 4;    // 20 + 4 × 20 = 100 posts deep — past the
                                    // drawer's 60-post scan window
const FOCUS_STALL_TICKS = 50;       // ~6 s with nothing placed and nothing growing

// ── Seen tracking (utils/feedSeen) ─────────────────────────────────────
// The feed used to stamp `last_feed_check` = now on mount / hide / unmount,
// so merely opening it marked every post read — the ones far below the fold
// included — and the drawer's Friends badges only moved on their next full
// scan. Now the page records the cards the reader actually rested on:
// on every settled render of the masonry (isScrolling false — the library's
// own scroll-end debounce, scrollingResetTimeInterval), each rendered cell
// with at least SEEN_MIN_FRACTION of itself — of the viewport, for a card
// taller than it — inside the viewport is collected (cellRenderer →
// noteSeen), and the batch goes to markFeedSeen as one `created` range once
// the render's cells are all in (SEEN_FLUSH_MS). Resting is the criterion,
// not passing: a card flung past never settles in view and stays unseen.
// Two things move the viewport without the reader looking: a focus seek
// (useFeedFocus.pendingRef) and a cache-restored scroll offset, which lands
// a few frames after the first, top-of-feed paint — batches taken under
// either are dropped, the restore for SEEN_RESTORE_GRACE_MS at most, or
// until the reader scrolls themselves. The mark carries the feed head
// (`created` of the newest loaded post) so MenuContent can tell whether
// posts were published since its scan, and `reachedEnd` when the feed's
// last post is among the rested cards (nothing older left to see).
const SEEN_MIN_FRACTION = 0.5;
const SEEN_FLUSH_MS = 80;
const SEEN_RESTORE_GRACE_MS = 3000;
const SEEN_RESTORE_TOLERANCE_PX = 8;

// `created` of a card, ms — raw chain value first (enrichPostForCard /
// enrichFeedBlogCard pass it through), the derived `date` as a fallback for
// a card shape that predates it (a view-cache entry from an older bundle).
const cardCreatedMs = (card) => toMs(card && (card.created != null ? card.created : card.date));

// The reader's own wheel / touch scrolling during a seek means they want
// to be somewhere else: hand the scroll back to them at once. Programmatic
// scrollTop writes fire neither event, so the seek can't cancel itself.
const watchUserScroll = (container, onUser) => {
    const opts = { passive: true };
    container.addEventListener("wheel", onUser, opts);
    container.addEventListener("touchmove", onUser, opts);
    return () => {
        container.removeEventListener("wheel", onUser, opts);
        container.removeEventListener("touchmove", onUser, opts);
    };
};

// A hash on a post URL is the comment focus of an open dialog, not ours.
const feedFocusTargetOf = (location) =>
    (isPostUrl(location.pathname) ? null : parseFeedFocusHash(location.hash));

const useFeedFocus = ({ grid, posts, visiblePosts, loadMorePosts, hasMore, isLoading, loadingMore }) => {
    // Everything the loop reads, refreshed every render: the grid's identity
    // moves on every scroll tick and the loader is re-created with its
    // guards, so a snapshot taken when the seek started would be stale by
    // the second tick.
    const liveRef = useRef(null);
    liveRef.current = { grid, posts, visiblePosts, loadMorePosts, hasMore, isLoading, loadingMore };

    const tokenRef = useRef(0);        // bumping it retires whatever loop is running
    const pendingRef = useRef(false);  // a seek owns the scroll position right now
    const detachRef = useRef(null);    // user-scroll listeners of the running seek

    const cancel = useCallback(() => {
        tokenRef.current += 1;
        pendingRef.current = false;
        if (detachRef.current) { detachRef.current(); detachRef.current = null; }
    }, []);

    const seek = useCallback((target) => {
        cancel();
        const token = tokenRef.current;
        pendingRef.current = true;
        const alive = () => token === tokenRef.current;
        const done = () => { if (alive()) cancel(); };

        const startedAt = Date.now();
        let pagesRequested = 0;
        let pageWait = null;      // { length, since } while a requested page is in flight
        let stallTicks = 0;
        let lastScrollHeight = -1;
        let settledTop = null;
        let settlePasses = 0;

        const tick = () => {
            if (!alive()) return;
            if (Date.now() - startedAt > FOCUS_DEADLINE_MS) { done(); return; }
            const { grid, posts, visiblePosts, loadMorePosts, hasMore, isLoading, loadingMore } = liveRef.current;
            const list = posts || [];
            const visible = visiblePosts || [];

            // Nothing loaded yet: the api is still booting or the first page
            // is in flight. Just wait — the deadline bounds it.
            if (!list.length) { setTimeout(tick, FOCUS_POLL_MS); return; }

            if (!visible.some((p) => isSamePost(p, target))) {
                // In the batch but not rendered (NSFW filter, soft-deleted):
                // there is no card to reach.
                if (list.some((p) => isSamePost(p, target))) { done(); return; }
                if (pageWait) {
                    if (list.length > pageWait.length) pageWait = null; // landed: fall through
                    else if (!hasMore || Date.now() - pageWait.since > FOCUS_PAGE_WAIT_MS) { done(); return; }
                    else { setTimeout(tick, FOCUS_POLL_MS); return; }
                }
                if (isLoading || loadingMore) { setTimeout(tick, FOCUS_POLL_MS); return; }
                if (!hasMore || pagesRequested >= FOCUS_MAX_EXTRA_PAGES) { done(); return; }
                pagesRequested += 1;
                pageWait = { length: list.length, since: Date.now() };
                if (loadMorePosts) loadMorePosts();
                setTimeout(tick, FOCUS_POLL_MS);
                return;
            }

            const masonry = grid.masonryRef.current;
            const container = masonry && masonry._scrollingContainer;
            if (!container) { setTimeout(tick, FOCUS_POLL_MS); return; }
            if (!detachRef.current) detachRef.current = watchUserScroll(container, cancel);

            // The cell index is the masonry's own (itemsWithSizes order — what
            // navigatePost and scrollToIndex use), not the visiblePosts index.
            // An entry whose image ImageMeasurer hasn't sized yet renders no
            // card (the cellRenderer bails on `!size.height`), so it can't be
            // aimed at: wait, don't walk — the image loads regardless of the
            // scroll position, and walking would drag the reader to the
            // bottom for a card that may sit near the top.
            const items = (masonry.props && masonry.props.itemsWithSizes) || [];
            const idx = items.findIndex((e) => e && isSamePost(e.item, target));
            if (idx === -1 || !(items[idx].size && items[idx].size.height)) { setTimeout(tick, FOCUS_POLL_MS); return; }

            const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
            const pos = grid.getCellPosition(idx);
            if (!pos) {
                // Not placed yet. The masonry renders — and so the page tracks
                // — only the cells around the viewport, so move the viewport
                // to the edge of what IS tracked on the target's side and let
                // the next window render. Anchoring every step on a tracked
                // neighbour means a step can never overshoot the card, however
                // the render window and the measuring batches line up (a
                // fixed stride could skip it; the cell then never renders).
                let below = -1, above = -1;
                for (let j = idx - 1; j >= 0; j--) { if (grid.getCellPosition(j)) { below = j; break; } }
                for (let j = idx + 1; j < items.length; j++) { if (grid.getCellPosition(j)) { above = j; break; } }
                let want;
                if (below !== -1) {
                    // Cells are placed in index order, so the target lies past
                    // the tracked frontier below it: put that frontier's end at
                    // the top edge and the window beyond it renders next.
                    const b = grid.getCellPosition(below);
                    want = b.top + b.height + GUTTER_SIZE;
                } else if (above !== -1) {
                    // Everything tracked sits past the target — a cache-
                    // restored offset landed deep and the cells above never
                    // rendered this mount: put the nearest tracked cell at the
                    // bottom edge and walk up the same way.
                    want = grid.getCellPosition(above).top - container.clientHeight;
                } else {
                    // Nothing tracked at all: the masonry hasn't rendered yet.
                    if (++stallTicks > FOCUS_STALL_TICKS) { done(); return; }
                    setTimeout(tick, FOCUS_POLL_MS);
                    return;
                }
                // scrollHeight is an estimate that grows as cells measure, so
                // the clamp is re-done every tick; a viewport that neither
                // moves nor grows while the card stays unplaced is a dead end.
                want = Math.min(Math.max(0, want), maxTop);
                if (Math.abs(want - container.scrollTop) > 1) { grid.scrollTo(want); stallTicks = 0; }
                else if (container.scrollHeight !== lastScrollHeight) stallTicks = 0;
                else if (++stallTicks > FOCUS_STALL_TICKS) { done(); return; }
                lastScrollHeight = container.scrollHeight;
                setTimeout(tick, FOCUS_POLL_MS);
                return;
            }

            // Placed: park the card one gutter under the top edge, so it and
            // the older unseen posts below it read downwards from there —
            // then hold until the position stops moving. Landing also makes
            // it the selected card, the same state the dialog's prev / next
            // navigation leaves behind.
            const want = Math.min(Math.max(0, pos.top - GUTTER_SIZE), maxTop);
            if (Math.abs(container.scrollTop - want) > 1) grid.scrollTo(want);
            if (settledTop !== null && Math.abs(pos.top - settledTop) < 1) settlePasses += 1;
            else settlePasses = 0;
            settledTop = pos.top;
            if (settlePasses >= FOCUS_SETTLE_PASSES) { grid.setSelectedPostIndex(idx); done(); return; }
            setTimeout(tick, FOCUS_SETTLE_MS);
        };
        tick();
    }, [cancel]);

    // The hash the page mounted with (a drawer click from another page mounts
    // FeedPersonal with it already in the URL; a refresh keeps it). Read
    // during the first render so pendingRef is set before ANY effect runs —
    // the scroll-restore effect below checks it.
    const initialRef = useRef(undefined);
    if (initialRef.current === undefined) {
        initialRef.current = feedFocusTargetOf(HISTORY.location);
        pendingRef.current = !!initialRef.current;
    }

    useEffect(() => {
        if (initialRef.current) seek(initialRef.current);
        // Later targets while mounted (drawer click from the feed itself —
        // Index.navigate() ignores the push since the pathname is unchanged,
        // so nobody else relays it). PUSH only: POP is closing a post, which
        // rewinds onto the same "/feed#focus=…" entry, and the reader must
        // not be dragged back to a card they have scrolled away from.
        const unlisten = HISTORY.listen((h) => {
            const { action, location } = h;
            if (action === "POP") return;
            const target = feedFocusTargetOf(location);
            if (target) seek(target); else cancel();
        });
        return () => { unlisten(); cancel(); };
    }, [seek, cancel]);

    return { pendingRef };
};


// ╔══════════════════════════════════════════════════════════════════════╗
// ║  5. MAIN COMPONENT                                                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

const FeedPersonal = ({ classes, settings, pathname, api }) => {
    useLanguage();
    const { windowWidth, windowHeight, isMobile, overscanByPixels, loadMoreThreshold } = useWindowDimensions();
    const {
        posts, isLoading, loadingMore, hasMore, loggedInUser, dataVersion,
        handleVoteChange, loadMorePosts,
        consumePendingScrollRestore, hasPendingScrollRestore, saveScrollPosition,
    } = useFeedPersonalData(api, pathname);
    const grid = useFeedPersonalGrid({ windowWidth, windowHeight, isMobile, overscanByPixels, loadMoreThreshold, loadMorePosts, loadingMore });

    // NSFW filtering: when the filter is ON (_nsfw_filter truthy) drop posts
    // flagged nsfw before they reach the masonry. Blur of shown posts is handled
    // by PaperCard via the separate _nsfw_enabled (blur) setting; blog cards
    // can't blur, so they lose their cover instead (withoutCover).
    // measurablePosts is what ImageMeasurer sizes — artworks only. It IS
    // visiblePosts (same array) whenever the batch holds no blog card.
    const { visiblePosts, measurablePosts } = useMemo(() => {
        const visible = [], measurable = [];
        for (const p of (posts || [])) {
            if (p.deleted || (settings._nsfw_filter && p.nsfw)) continue;
            if (isBlogCard(p)) {
                visible.push(!settings._nsfw_enabled && p.nsfw && p.image ? withoutCover(p) : p);
            } else {
                visible.push(p);
                measurable.push(p);
            }
        }
        return { visiblePosts: visible, measurablePosts: measurable.length === visible.length ? visible : measurable };
    }, [posts, settings._nsfw_filter, settings._nsfw_enabled]);

    const postNav = usePostNavigation({ api, posts: visiblePosts, masonryRef: grid.masonryRef, scrollToIndex: grid.scrollToIndex, setSelectedPostIndex: grid.setSelectedPostIndex, nsfwEnabled: settings._nsfw_enabled });

    // "/feed#focus=…" → scroll to that post (drawer Friends row). Declared
    // before the scroll-restore effect below, which yields to a pending seek.
    const feedFocus = useFeedFocus({ grid, posts, visiblePosts, loadMorePosts, hasMore, isLoading, loadingMore });

    const [menuCardXY, setMenuCardXY] = useState([]);
    const [menuCardData, setMenuCardData] = useState({});
    const locales = settings._selected_locales_code;

    // Mount the (now-lazy) create dialog on first open and keep it mounted —
    // preserving the original keepMounted wiring — while deferring its chunk
    // until the user actually opens it. The prefetch below warms it on idle.
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

    // The open post goes to exactly one viewer, picked by postNav.postKind.
    const isBlogPostOpen = postNav.postKind === POST_KIND_BLOG;
    const artworkDialogOpen = postNav.artworkOpen && !isBlogPostOpen;
    const blogDialogOpen = postNav.artworkOpen && isBlogPostOpen;

    // Mount the (now-lazy) post viewer on first open and keep it mounted, so
    // close/reopen and in-dialog next/prev stay instant. On a deep-link entry
    // artworkOpen is already true, so this mounts on the first commit while the
    // orphan fetch runs in parallel.
    const [postDialogMounted, setPostDialogMounted] = useState(false);
    useEffect(() => {
        if (artworkDialogOpen) setPostDialogMounted(true);
    }, [artworkDialogOpen]);

    // Same for the blog-post viewer (a portal post opened over the feed).
    const [blogDialogMounted, setBlogDialogMounted] = useState(false);
    useEffect(() => {
        if (blogDialogOpen) setBlogDialogMounted(true);
    }, [blogDialogOpen]);

    // Warm its chunk on idle — but only once the feed actually holds a blog
    // card (measurablePosts diverges from visiblePosts exactly then), so a
    // feed of artworks never downloads it.
    const hasBlogCards = measurablePosts !== visiblePosts;
    useEffect(() => {
        if (blogDialogMounted || !hasBlogCards) return;
        const id = idle(() => { loadBlogPostDialog().catch(() => {}); });
        return () => cancelIdle(id);
    }, [blogDialogMounted, hasBlogCards]);

    // Warm the post-viewer chunk on idle for EVERYONE (anyone can view a post),
    // so the open-from-card transition isn't gated on a cold chunk fetch.
    // Skipped once mounted (React.lazy is fetching it anyway).
    useEffect(() => {
        if (postDialogMounted) return;
        const id = idle(() => { loadPostDialog().catch(() => {}); });
        return () => cancelIdle(id);
    }, [postDialogMounted]);

    // Force masonry update when posts change
    useEffect(() => { const m = grid.masonryRef.current; if (m) m.forceUpdate(); }, [posts]);

    // ── Seen tracking: the cards the reader rested on ───────────────────
    // (See the SEEN_* constants for the model.) The collector is a ref the
    // cell renderer writes into; the flush is scheduled from the renderer
    // itself, not from an effect, because the settle render is the
    // masonry's own (its isScrolling state flips on its scroll-end timer)
    // and this page doesn't necessarily re-render with it.
    const seenRef = useRef({ batch: null, timer: null, restore: null });
    const seenLiveRef = useRef(null);
    seenLiveRef.current = { account: loggedInUser, posts, grid };

    const flushSeen = useCallback(() => {
        const s = seenRef.current;
        s.timer = null;
        const batch = s.batch;
        s.batch = null;
        if (!batch || !batch.length) return;
        const { account, posts: list, grid: liveGrid } = seenLiveRef.current;
        if (!account) return;
        // A focus seek walks the viewport down the feed: not the reader
        // resting. Drop the batch.
        if (feedFocus.pendingRef.current) return;
        // A cache-restored offset owns the viewport until it is reached —
        // for the grace period at most, and only while the reader hasn't
        // taken over (watchUserScroll below clears it).
        const restore = s.restore;
        if (restore) {
            const off = Math.abs(liveGrid.getScrollTop() - restore.top);
            if (off > SEEN_RESTORE_TOLERANCE_PX && Date.now() - restore.at < SEEN_RESTORE_GRACE_MS) return;
            s.restore = null;
            if (restore.detach) restore.detach();
        }
        let from = Infinity, to = 0, reachedEnd = false;
        for (let i = 0; i < batch.length; i++) {
            const c = batch[i];
            if (c.created < from) from = c.created;
            if (c.created > to) to = c.created;
            if (c.last) reachedEnd = true;
        }
        if (!to) return;
        const head = (list && list.length) ? cardCreatedMs(list[0]) : 0;
        markFeedSeen(account, { from, to, head, reachedEnd });
    }, [feedFocus.pendingRef]);

    // Called by the cell renderer for each cell of a settled render that
    // meets SEEN_MIN_FRACTION. `last`: this is the feed's final post.
    const noteSeen = useCallback((item, last) => {
        const created = cardCreatedMs(item);
        if (!created) return;
        const s = seenRef.current;
        (s.batch || (s.batch = [])).push({ created, last });
        if (!s.timer) s.timer = setTimeout(flushSeen, SEEN_FLUSH_MS);
    }, [flushSeen]);

    // Unmount: a batch still on its timer belongs to a viewport that is
    // gone; drop it (an 80 ms window) rather than flush over a torn-down
    // grid, and let go of the restore guard's listeners.
    useEffect(() => () => {
        const s = seenRef.current;
        if (s.timer) { clearTimeout(s.timer); s.timer = null; }
        s.batch = null;
        if (s.restore && s.restore.detach) s.restore.detach();
        s.restore = null;
    }, []);

    // ── View-cache scroll persistence ───────────────────────────────────
    // Restore the saved offset when a cache-served list lands (keyed on the
    // dataVersion bump; restoreScrollTop retries until the masonry has
    // measured enough height, and consume-once makes other bumps no-ops) …
    useEffect(() => {
        const pending = consumePendingScrollRestore();
        // A focus seek owns the scroll position: the saved offset is still
        // consumed (so it can't resurface later) but not applied under it.
        if (pending > 0 && !feedFocus.pendingRef.current) {
            // Until that offset is reached, the viewport is not where the
            // reader left it: seen marks wait (flushSeen) — for the grace
            // period at most, or until the reader scrolls themselves.
            const s = seenRef.current;
            if (s.restore && s.restore.detach) s.restore.detach();
            const restore = { top: pending, at: Date.now(), detach: null };
            const m = grid.masonryRef.current;
            const container = m && m._scrollingContainer;
            if (container) {
                restore.detach = watchUserScroll(container, () => {
                    if (s.restore === restore) { s.restore = null; restore.detach(); }
                });
            }
            s.restore = restore;
            return grid.restoreScrollTop(pending);
        }
    }, [dataVersion]); // eslint-disable-line react-hooks/exhaustive-deps

    // … and persist the live offset when the page unmounts (cross-page
    // navigation tears the subtree down — keyed Suspense in Index.js).
    useEffect(() => () => {
        saveScrollPosition(grid.getScrollTop());
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // No `last_feed_check` stamping anymore: what the reader has seen is
    // recorded card by card, above (utils/feedSeen), and the drawer's
    // Friends badges follow it live. The legacy value is only read once, as
    // the floor an account starts from.

    // Full re-pack: clear the index-keyed CellMeasurerCache and recompute
    // positions — the hook's own layout-change reset, which also drops the
    // tracked cell positions (getCellPosition must not answer for a layout
    // that no longer exists).
    const repackMasonry = () => grid.resetMasonry();

    // ── Re-pack on list replacement ────────────────────────────────────
    // The CellMeasurerCache and the masonry's position cache are keyed by
    // INDEX: a measured height and a placed position belong to "the cell at
    // index i", not to a post. An append (loadMorePosts) and an in-place
    // vote patch keep every index → post mapping; a replacement does not.
    // The fresh fetch landing after a cache-served paint with a post
    // published since, or the 6 s refetch after an own publish / edit /
    // delete: each shifts posts to new indices while the caches still hold
    // the previous occupants' heights, so the masonry drew post i+1 in the
    // slot measured for post i. In a single column of mixed-height cards
    // that is an overlap wherever the newcomer is taller than the card it
    // displaced (and a gap where it is shorter). resetMasonry exists for
    // exactly this event (see its note in useMasonryGrid); this page only
    // forced an update. dataVersion bumps exactly when the loaded list was
    // replaced (loadPage): re-pack in a layout effect so the stale layout
    // is cleared before that commit paints, then hand the reader's offset
    // back the same best-effort way the cache-served path does, so a
    // refetch re-packs under the viewport instead of dropping to the top.
    // Not under a focus seek, which owns the scroll position.
    const listVersionMountedRef = useRef(false);
    useLayoutEffect(() => {
        if (!listVersionMountedRef.current) { listVersionMountedRef.current = true; return; }
        const top = grid.getScrollTop();
        repackMasonry();
        if (top > 0 && !hasPendingScrollRestore() && !feedFocus.pendingRef.current) return grid.restoreScrollTop(top);
    }, [dataVersion]); // eslint-disable-line react-hooks/exhaustive-deps

    // The NSFW filter flips: the visible cell set (and its index→item
    // mapping) changes.
    useEffect(() => { repackMasonry(); }, [settings._nsfw_filter]); // eslint-disable-line react-hooks/exhaustive-deps

    // "Show NSFW" flips: artworks only change blur (same height), but an
    // nsfw blog card gains or loses its cover, and CellMeasurer never
    // re-measures a cached cell — re-pack only when such a card is loaded.
    const hasNsfwBlogCoverRef = useRef(false);
    hasNsfwBlogCoverRef.current = useMemo(
        () => (posts || []).some((p) => p.nsfw && p.image && isBlogCard(p)),
        [posts]
    );
    const nsfwEnabledMountedRef = useRef(false);
    useEffect(() => {
        if (!nsfwEnabledMountedRef.current) { nsfwEnabledMountedRef.current = true; return; }
        if (hasNsfwBlogCoverRef.current) repackMasonry();
    }, [settings._nsfw_enabled]); // eslint-disable-line react-hooks/exhaustive-deps

    const openCardMenu = useCallback((ev, data) => { setMenuCardXY(Int32Array.of(ev.x - 24, ev.y - 24)); setMenuCardData(data); }, []);
    const closeCardMenu = useCallback(() => { setMenuCardXY(Int32Array.of(0, 0)); setMenuCardData({}); }, []);

    // Stable create-dialog open/close: the previous inline `() =>
    // postNav.setCreateDialogOpen(true/false)` lambdas re-created both
    // closures every render (scroll ticks included), churning the FAB's and
    // NewPost's props. setCreateDialogOpen is a stable useState setter, so
    // both callbacks below are created exactly once.
    const openCreateDialog = useCallback(() => postNav.setCreateDialogOpen(true), [postNav.setCreateDialogOpen]);
    const closeCreateDialog = useCallback(() => postNav.setCreateDialogOpen(false), [postNav.setCreateDialogOpen]);

    // ── Own-post management (card menu → page-level dialogs) ───────────
    const [editPostData, setEditPostData] = useState(null);
    const [deletePostData, setDeletePostData] = useState(null);
    const onEditPost = useCallback((data) => { setEditPostData(data); }, []);
    const onDeletePost = useCallback((data) => { setDeletePostData(data); }, []);
    const closeEditPost = useCallback(() => { setEditPostData(null); }, []);
    const closeDeletePost = useCallback(() => { setDeletePostData(null); }, []);
    // The broadcast emits `content_updated` → the listener above refetches.
    const handlePostEdited = useCallback(() => {}, []);
    const handlePostDeleted = useCallback(() => {}, []);
    const onVoteChange = useCallback((permlink, voter, weight) => handleVoteChange(permlink, voter, weight), [handleVoteChange]);

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

    // ── Masonry entries: measured artworks + blog placeholders ─────────
    // ImageMeasurer only sees artworks; this re-threads the blog entries in
    // at their feed position. Every visible post keeps a fixed index — the
    // CellMeasurerCache is index-keyed — so an artwork missing from the
    // measurer's list (not listed yet) gets an unsized entry rather than
    // being dropped, which would shift every blog card behind it. The result
    // keeps its identity while nothing changed, so MasonryExtended isn't
    // handed a fresh itemsWithSizes on every render. With no blog card loaded
    // the measurer's own list passes through untouched.
    const mergeCacheRef = useRef({ sized: null, visible: null, out: null });
    const withBlogEntries = useCallback((sized) => {
        if (measurablePosts === visiblePosts) return sized;
        const cache = mergeCacheRef.current;
        if (cache.sized === sized && cache.visible === visiblePosts) return cache.out;
        const byId = new Map();
        for (const entry of (sized || [])) {
            const id = entry && (entry.size?.id ?? entry.item?.id);
            if (id != null) byId.set(id, entry);
        }
        const next = [];
        for (const p of visiblePosts) {
            if (isBlogCard(p)) next.push(blogEntryOf(p));
            else next.push(byId.get(p.id) || pendingEntryOf(p));
        }
        const out = sameEntries(cache.out, next) ? cache.out : next;
        mergeCacheRef.current = { sized, visible: visiblePosts, out };
        return out;
    }, [visiblePosts, measurablePosts]);

    // ── Cell renderer ──────────────────────────────────────────────────
    // Depend on the SPECIFIC grid fields the renderer reads, not the whole
    // `grid` object: the shared masonry hook returns a fresh object whose
    // identity changes on every scroll tick (scrollTop/scrollY live in it),
    // which used to re-create this renderer — and hand MasonryExtended a new
    // cellRenderer prop — on every tick while scrolling. The fields below
    // are all referentially stable between layout changes.
    const {
        columnCount, columnWidth, trackElementPosition, cellMeasurerCache,
        selectedPostIndex, postListHeight, pageWidth,
    } = grid;
    const { openPost, openPostComments } = postNav;
    const cellRenderer = useCallback((data) => {
        const { index, key, parent, style, isScrolling } = data;
        if (!parent?.props?.itemsWithSizes?.[index | 0]) return null;
        const { item, size } = parent.props.itemsWithSizes[index | 0]; if (!size.height) return null;
        const colIdx = index % columnCount, rowIdx = (index - colIdx) / columnCount;
        style.width = columnWidth;
        trackElementPosition(index, +style.top, +style.height, rowIdx, colIdx);

        // Visibility — use container dimensions, 2× threshold (original uses 2*root_height)
        const container = parent._scrollingContainer;
        const st = container ? container.scrollTop : 0;
        const viewH = container ? container.clientHeight : postListHeight;
        const viewW = container ? container.clientWidth : pageWidth;
        const top = +style.top, bottom = top + (+style.height);
        const threshold = 2 * viewH * (viewH / (viewW || 1));
        const visible = threshold + bottom > st && top < st + viewH + threshold;
        cellMeasurerCache.visible_ids[size.id] = visible || (cellMeasurerCache.visible_ids[size.id] || false);

        // Seen tracking — settled render only (see the SEEN_* constants):
        // the part of the cell inside the viewport, against the smaller of
        // the card and the viewport (a card taller than the viewport can
        // never show more than the viewport). Logged in only: the anonymous
        // fallback is trending, not a feed anyone's badges count.
        if (!isScrolling && loggedInUser) {
            const shown = Math.min(bottom, st + viewH) - Math.max(top, st);
            if (shown > 0 && shown >= SEEN_MIN_FRACTION * Math.min(bottom - top, viewH)) {
                noteSeen(item, !hasMore && index === parent.props.itemsWithSizes.length - 1);
            }
        }

        if (isBlogCard(item)) {
            // `stacked`: the column is capped at 720px, so the portal page's
            // viewport breakpoint (side cover ≥ 1200px) would halve the card on
            // wide screens — and change its height with no column-width change
            // to trigger a re-measure. Stacked, the height tracks the column.
            // `noMargin`: no outer margin in the feed — the masonry spacer is
            // the only gap between cells. (A class, not style.marginTop: the
            // masonry's style object belongs to the cell slot, not the card.)
            const stats = item.stats || {};
            return (
                <CellMeasurer cache={cellMeasurerCache} index={index} key={key} parent={parent}>
                    <PaperCardBlog stacked noMargin onOpen={openPost} onCommentsClick={openPostComments}
                                   locales={locales} data={item} onMenuClick={openCardMenu} api={api}
                                   voter={loggedInUser} onVoteChange={onVoteChange} is_scrolling={isScrolling}
                                   selected={selectedPostIndex === index} visible={cellMeasurerCache.visible_ids[size.id]}
                                   column_width={columnWidth} id={size.id} key={size.id} rowIndex={rowIdx} columnIndex={colIdx}
                                   style={style} muted={Boolean(stats.hide || stats.gray)} />
                </CellMeasurer>
            );
        }

        const ih = Math.ceil(columnWidth * (size.height / size.width)) || 0;
        return (
            <CellMeasurer cache={cellMeasurerCache} index={index} key={key} parent={parent}>
                <PaperCard onOpen={openPost} onCommentsClick={openPostComments} locales={locales} nsfw={settings._nsfw_enabled} data={item}
                           renderer={settings._renderer} mode={settings._mode} onMenuClick={openCardMenu} api={api}
                           voter={loggedInUser} onVoteChange={onVoteChange} is_scrolling={isScrolling}
                           selected={selectedPostIndex === index} size={size} visible={cellMeasurerCache.visible_ids[size.id]}
                           column_width={columnWidth} image_height={ih} image_width={columnWidth}
                           id={size.id} key={size.id} rowIndex={rowIdx} columnIndex={colIdx} style={style} />
            </CellMeasurer>
        );
    }, [posts, columnCount, columnWidth, trackElementPosition, cellMeasurerCache,
        selectedPostIndex, postListHeight, pageWidth, openPost, openPostComments,
        locales, settings, openCardMenu, api, loggedInUser, onVoteChange, hasMore, noteSeen]);

    // ── Render ─────────────────────────────────────────────────────────
    return (
        <React.Fragment>
            <div ref={grid.setRootElement}>
                <ImageMeasurer className={classes.masonry} items={measurablePosts} image={GET_ITEM_IMAGE} keyMapper={GET_ITEM_ID}>
                    {(measured) => { const itemsWithSizes = withBlogEntries(measured); return (
                        <MasonryExtended
                            style={{ padding: `16px ${grid.paddingX}px 0px ${grid.paddingX}px` }}
                            key="masonry-extended-feed-personal"
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
                            width={grid.viewWidth}
                        />
                    ); }}
                </ImageMeasurer>
            </div>

            <div onClick={openCreateDialog} className={classes.mainFab}
                 style={{ transform: grid.hideFab
                         ? "translateY(calc(96px + env(safe-area-inset-bottom, 0px)))"
                         : "translateY(-8px)" }}>
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
                    <LazyNewPost keepMounted={true} open={postNav.createDialogOpen} onClose={closeCreateDialog} api={api} />
                </React.Suspense>
            )}
            {postDialogMounted && (
                <React.Suspense fallback={DIALOG_FALLBACK}>
                    <LazyPostDialog renderer={settings._renderer} mode={settings._mode} nsfw={settings._nsfw_enabled}
                                    format={settings._format} data={isBlogPostOpen ? NO_POST : postNav.currentPost} open={artworkDialogOpen} locales={locales}
                                    api={api} account={loggedInUser} originRect={postNav.originRect} onVoteChange={onVoteChange}
                                    onClose={postNav.closePost} getReturnRect={postNav.getReturnRect} onDrawerPush={postNav.onDrawerPush} onDrawerPop={postNav.onDrawerPop}
                                    onPrevious={postNav.previousPost} onNext={postNav.nextPost} />
                </React.Suspense>
            )}
            {/* Portal blog post opened over the feed — same props as on the
                portal page; no prev/next there either. */}
            {blogDialogMounted && (
                <React.Suspense fallback={DIALOG_FALLBACK}>
                    <LazyBlogPostDialog
                        data={isBlogPostOpen ? postNav.currentPost : NO_POST} open={blogDialogOpen}
                        locales={locales} api={api} account={loggedInUser}
                        onVoteChange={onVoteChange} onClose={postNav.closePost}
                        onPrevious={undefined} onNext={undefined}
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
    memo(FeedPersonal, (prev, next) =>
        prev.classes === next.classes &&
        prev.settings === next.settings &&
        prev.pathname === next.pathname &&
        prev.api === next.api,
    ),
);