/**
 * Which portal (community) a blog post was published into, and what to call
 * it — the one resolver behind the "… in Portal's Name" line of PaperCardBlog
 * and the author line of BlogPostDialog.
 *
 * Three sources, cheapest first:
 *
 *   • `portal` — { name, title } handed down by the page. The Community page
 *     knows the portal it is displaying (community._name / community.name),
 *     and a deep-linked post (Community.js → fetchOrphanPost → get_content)
 *     carries no community fields of its own, so this is how its proper name
 *     reaches the dialog there. Trusted only when the post does not name a
 *     DIFFERENT portal itself.
 *
 *   • the post — the bridge stamps `community` (the handle, "portal-12") and
 *     `community_title` (the proper name) on every post served by
 *     get_ranked_posts; a get_content post has only `category`, which for a
 *     portal post IS the handle (its parent_permlink).
 *
 *   • the chain — for a post whose handle is known but whose title nobody
 *     has (a get_content post opened outside its portal page: Profile,
 *     favorites, a notification): one api.communities.getCommunity() per
 *     handle per session, through fetchPortalTitle() below, whose answer
 *     lands in a module-wide cache that this resolver reads synchronously.
 *
 * Returns null for a post that is not in a portal (the card's cue to show
 * the post's tags instead), else { name, title, known }:
 *
 *   known: true   title is settled — from the page, the post, or the cache.
 *                 A portal the chain does not know keeps its handle as the
 *                 title, exactly as the Community page header does.
 *   known: false  title is "" — nobody has it yet. Callers render no
 *                 "in …" segment (never a raw handle flashing before the
 *                 real name) and ask fetchPortalTitle() for it.
 */
export const PORTAL_HANDLE_RE = /^portal-[0-9]+$/;

const asHandle = (v) => (typeof v === "string" && PORTAL_HANDLE_RE.test(v)) ? v : "";
const asTitle = (v) => (typeof v === "string" ? v.trim() : "");

// ── Title cache ──────────────────────────────────────────────────────────
// handle → title; "" records a definitive miss (the chain has no such
// portal), so a dead handle is looked up once, not once per card.
const _titles = new Map();
// handle → the one in-flight lookup, so twenty cards of the same portal
// mounting together share a single request.
const _inflight = new Map();

export function resolvePortal(data, portal) {
    const d = data || {};
    const own = asHandle(d.community) || asHandle(d.category);
    const host = (portal && asHandle(portal.name)) ? portal : null;
    const name = own || (host ? host.name : "");
    if (!name) return null;
    const hostTitle = (host && host.name === name) ? asTitle(host.title) : "";
    const title = hostTitle || asTitle(d.community_title);
    if (title) return { name, title, known: true };
    if (_titles.has(name)) return { name, title: _titles.get(name) || name, known: true };
    return { name, title: "", known: false };
}

/**
 * Look a portal's title up on the chain, once per handle per session.
 * Resolves true when the cache now holds an answer for `name` — a title, or
 * a definitive miss — so the caller re-renders and resolvePortal() picks it
 * up; false when no lookup could be made (no api, a rejected call), which
 * is NOT cached so a later mount retries. Never rejects.
 */
export function fetchPortalTitle(api, name) {
    if (!asHandle(name)) return Promise.resolve(false);
    if (_titles.has(name)) return Promise.resolve(true);
    const running = _inflight.get(name);
    if (running) return running;
    if (!api || !api.communities || typeof api.communities.getCommunity !== "function") {
        return Promise.resolve(false);
    }
    const lookup = Promise.resolve()
        .then(() => api.communities.getCommunity(name))
        .then(
            (community) => { _titles.set(name, asTitle(community && community.title)); return true; },
            () => false,
        )
        .finally(() => { _inflight.delete(name); });
    _inflight.set(name, lookup);
    return lookup;
}

/** Drop a cached title — after the portal was edited, so other pages refetch. */
export function forgetPortalTitle(name) {
    _titles.delete(name);
}
