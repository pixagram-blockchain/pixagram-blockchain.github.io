import { COMMUNITY_TAG_REGEX } from "./constants";

// ── Portal blog cards ───────────────────────────────────────────────────
// A portal blog post is a top-level post whose category (parent_permlink) is
// the portal slug ("portal-1") and whose body is HTML/markdown rather than a
// bare base64 artwork (_content_type 'blog'). Community lists them; the
// personal feed mixes them in between artworks. Both build the card through
// enrichPostForBlogCard below, so the two surfaces cannot drift — the same
// reason isDeletedPost moved into utils/constants.
//
// Post URLs of these cards are community-post URLs (/portal-N/@author/permlink,
// see isCommunityPostUrl in utils/constants): Community and FeedPersonal both
// host them over their list with BlogPostDialog (OVERLAY_HOSTS_BY_POST_KIND).

const resolveDisplayName = (account, fallback) => {
    const dn = account._profile && account._profile.display_name;
    return (typeof dn === 'string' && dn.trim()) || account.name || fallback || '';
};

const parsePayoutValue = (raw) => parseFloat((raw || '0').replace(/[^0-9.\-]/g, '')) || 0;

// WeakMap-cached: enrichPostForBlogCard reads the metadata twice
// (description, deleted flag) and resolveCoverImage a third time, and the
// two-phase enrichment re-maps the SAME raw post objects to patch avatars
// in — six JSON.parse calls per card, per load, of multi-KB strings. One
// parse per raw post object now; an edited post arrives as a NEW object
// from the node, so the cache can never serve stale metadata. Signature
// and null-on-miss/null-on-failure semantics are unchanged.
const JSON_META_CACHE = new WeakMap();
export const extractJsonMeta = (post) => {
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
export const resolveCoverImage = (post) => {
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

// The portal a raw post or card lives in ('' when it isn't in one).
export const portalOf = (post) => {
    const slug = (post && (post.community || post.category)) || '';
    return COMMUNITY_TAG_REGEX.test(slug) ? slug : '';
};

// Raw (sanitized) post → should it render as a blog card? A pixel-art post
// whose data URI failed inspection is also demoted to 'blog' by the API
// (_image_rejected set); that is a broken artwork, not an article.
export const isPortalBlogPost = (post) =>
    !!post && post._content_type === 'blog' && !post._image_rejected && !!portalOf(post);

// Enriched card → is it a blog card (vs a pixel-art card)? Pixel-art cards
// never carry a portal slug in `community`.
export const isBlogCard = (card) =>
    !!card && card._content_type === 'blog' && COMMUNITY_TAG_REGEX.test(card.community || '');

// "/portal-1/@author/permlink" (+ optional "#…" intent hash), or null when
// the card lacks what the route needs. Unlike buildPostUrl (category or first
// tag), the slug here comes from portalOf — the same field isPortalBlogPost
// classified the card with — so the URL always parses as a community post.
export const buildPortalPostUrl = (card, hash) => {
    const slug = portalOf(card);
    const author = card && (card.author?.username || (typeof card.author === 'string' ? card.author : ''));
    const permlink = card && card.permlink;
    if (!slug || !author || !permlink) return null;
    return `/${slug}/@${author}/${permlink}${hash || ''}`;
};

export const enrichPostForBlogCard = (post, account, voterProfiles) => {
    const pendingPayout = parsePayoutValue(post.pending_payout_value);
    const totalPayout = parsePayoutValue(post.total_payout_value);
    const curatorPayout = parsePayoutValue(post.curator_payout_value);
    const payout = pendingPayout > 0 ? pendingPayout : totalPayout + curatorPayout;

    // Type-guarded: metadata is author-controlled, and a non-array `tags` or
    // a non-string `description` used to throw here (`.some` / `.trim` is not
    // a function) — which fails the whole page's enrichment, not one card.
    const tags = Array.isArray(post._tags) ? post._tags : [];
    const activeVotes = post.active_votes || [];
    const wordCount = post._word_count || 0;
    const meta = extractJsonMeta(post);
    const metaDescription = typeof meta?.description === 'string' ? meta.description.trim() : '';
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
        image: resolveCoverImage(post),
        date: post.created ? new Date(post.created).getTime() : Date.now(),
        payout: `$${payout.toFixed(2)}`,
        upVotesNumber: Math.max(0, post.net_votes || activeVotes.filter(v => v?.weight >= 0).length || 0),
        downVotesNumber: Math.max(0, activeVotes.filter(v => v?.weight < 0).length || 0),
        commentsNumber: post.children || 0,
        active_votes: activeVotes,
        // Post-level rshares as the chain saw them — lets the card price its
        // own pending vote on the fund's reward curve (useVotePayoutEstimate).
        net_rshares: post.net_rshares != null ? String(post.net_rshares) : '0',
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