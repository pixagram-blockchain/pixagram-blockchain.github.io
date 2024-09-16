"use strict";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * favorites.js — LacertaDB-backed favorites (bookmarks) store
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Persists the user's favorite artworks and blog posts into the SAME
 * LacertaDB instance the rest of the app uses: `pixaAPI.settingsDb`
 * (the 'user_settings' database opened by PixaProxyAPI.initialize() in
 * pages/Index.js). No new database is created — only a new collection.
 *
 * Storage layout (mirrors the notification_reads per-account pattern, but
 * split into one document per favorite so a single doc never balloons with
 * base64 artwork thumbnails):
 *
 *   collection 'favorites'
 *     ├─ favindex_<account>                  → { artworks: [ref], blogs: [ref] }
 *     │      ref = { author, permlink, bookmarked_at }   (newest first)
 *     └─ fav_<type>_<account>_<author>_<permlink> → full entry document
 *
 * Only the primitives this codebase already exercises on LacertaDB
 * collections are used: getCollection / ensureCollection, get, upsert,
 * delete. Everything is guarded — favorites are best-effort UX sugar and
 * must never take the app down.
 *
 * Entry document shape (both types; nulls where unknown):
 *   {
 *     type: 'artworks' | 'blogs',
 *     author, author_name, author_image,
 *     permlink, title, image,
 *     width, height,               // artwork pixel dims (AR for the manager)
 *     description, tags: [],
 *     category,                    // parent community / first tag (portal-NNNNN)
 *     community_title,             // resolved real community name (blogs)
 *     url,                         // canonical '/<category>/@author/permlink'
 *     created,                     // post date (ms)
 *     bookmarked_at                // ms — "recently bookmarked first" sort key
 *   }
 *
 * Missing category / url / community_title are back-filled asynchronously
 * from the chain (api.content.getContent + api.communities.getCommunity)
 * right after add — see _enrich(). Subscribers are re-notified when the
 * enriched document lands, so an open FavoriteManagerDialog upgrades its
 * "portal-NNNNN" group header to the real community name in place.
 */

const COLLECTION_NAME = "favorites";
const INDEX_PREFIX = "favindex_";
const DOC_PREFIX = "fav_";
const MAX_PER_TYPE = 300;      // keep the index + doc count bounded
const GUEST_KEY = "_guest";    // favorites saved while logged out

/* A routable post URL MUST carry a leading category/tag segment:
 * /<segment>/@author/permlink. The sanitizer fabricates "/@author/permlink"
 * when the raw chain payload has no usable url (safe_url_path fallback) —
 * that shape does NOT resolve in the SPA router, so it is rejected here and
 * rebuilt from category / first tag instead. */
const SEGMENTED_URL_RE = /^\/[^/@][^/]*\/@[^/]+\/[^/]+/;
const normalizeUrl = (url) =>
    (typeof url === "string" && SEGMENTED_URL_RE.test(url)) ? url : null;

export const FAVORITE_TYPES = Object.freeze({ ARTWORKS: "artworks", BLOGS: "blogs" });

// ── Change notification ─────────────────────────────────────────────────────
// Tiny local pub/sub so open dialogs (manager, PostDialog…) stay in sync
// without threading callbacks through the dispatcher.

const listeners = new Set();

/**
 * Subscribe to any favorites change (add / remove / enrichment).
 * @param {function} fn
 * @returns {function} unsubscribe
 */
export function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

function notify() {
    listeners.forEach((fn) => {
        try { fn(); } catch (_) { /* subscriber errors must not cascade */ }
    });
}

// ── Internals ───────────────────────────────────────────────────────────────

/** In-flight collection handle (per settingsDb identity). */
let colPromise = null;
let colDbRef = null;

/**
 * Resolve the 'favorites' collection on the app's settingsDb.
 * ensureCollection() is called first (idempotent, mirrors setupCollections)
 * so a cold profile that never bookmarked anything still resolves cleanly.
 * @param {object} api - PixaProxyAPI instance
 * @returns {Promise<object>} LacertaDB collection handle
 */
async function getCol(api) {
    const db = api && api.settingsDb;
    if (!db) throw new Error("Favorites unavailable: database not ready");
    if (colPromise && colDbRef === db) return colPromise;
    colDbRef = db;
    colPromise = (async () => {
        try {
            if (typeof db.ensureCollection === "function") db.ensureCollection(COLLECTION_NAME);
        } catch (_) { /* already exists / handled by getCollection below */ }
        return await db.getCollection(COLLECTION_NAME);
    })().catch((e) => {
        // Don't cache a rejected promise — allow retry on next call
        colPromise = null;
        throw e;
    });
    return colPromise;
}

/**
 * Account key for per-account scoping. Sync-first / async-fallback, the
 * same pattern CommunitiesAPI._getActiveUser uses. Logged-out sessions
 * share the '_guest' bucket.
 * @param {object} api
 * @returns {Promise<string>}
 */
async function accountKey(api) {
    try {
        const sm = api && api.sessionManager;
        if (!sm) return GUEST_KEY;
        const acct = sm.currentAccount || (sm.getActiveAccount ? await sm.getActiveAccount() : null);
        return (acct && String(acct).toLowerCase()) || GUEST_KEY;
    } catch (_) {
        return GUEST_KEY;
    }
}

const normType = (type) => (type === FAVORITE_TYPES.BLOGS ? FAVORITE_TYPES.BLOGS : FAVORITE_TYPES.ARTWORKS);
const indexId = (acct) => INDEX_PREFIX + acct;
const docId = (type, acct, author, permlink) =>
    DOC_PREFIX + normType(type) + "_" + acct + "_" + String(author || "") + "_" + String(permlink || "");

/** Read the per-account index doc; tolerate absence. */
async function readIndex(col, acct) {
    try {
        const doc = await col.get(indexId(acct));
        if (doc && typeof doc === "object") {
            return {
                artworks: Array.isArray(doc.artworks) ? doc.artworks : [],
                blogs: Array.isArray(doc.blogs) ? doc.blogs : [],
            };
        }
    } catch (_) { /* first use — no index yet */ }
    return { artworks: [], blogs: [] };
}

async function writeIndex(col, acct, index) {
    await col.upsert(indexId(acct), {
        artworks: index.artworks,
        blogs: index.blogs,
        updated_at: Date.now(),
    });
}

const sameRef = (ref, author, permlink) => ref && ref.author === author && ref.permlink === permlink;

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Is (author, permlink) bookmarked under `type` for the active account?
 * Index-only lookup — cheap enough for dialog-open checks.
 * @returns {Promise<boolean>}
 */
export async function isFavorite(api, type, author, permlink) {
    if (!author || !permlink) return false;
    try {
        const col = await getCol(api);
        const acct = await accountKey(api);
        const index = await readIndex(col, acct);
        return index[normType(type)].some((ref) => sameRef(ref, author, permlink));
    } catch (_) {
        return false;
    }
}

/**
 * Add a favorite. `entry` carries whatever the calling dialog already has
 * in hand — nothing is fetched on the hot path. Newest-first insertion;
 * duplicates are replaced (bookmarking again refreshes bookmarked_at).
 * Missing category / url / community_title are enriched in the background.
 * @param {object} api
 * @param {'artworks'|'blogs'} type
 * @param {object} entry - { author, permlink, title, image, ... } see header
 * @returns {Promise<boolean>} success
 */
export async function addFavorite(api, type, entry) {
    const t = normType(type);
    const author = entry && entry.author;
    const permlink = entry && entry.permlink;
    if (!author || !permlink) return false;

    try {
        const col = await getCol(api);
        const acct = await accountKey(api);
        const now = Date.now();

        const doc = {
            type: t,
            author: String(author),
            author_name: entry.author_name || String(author),
            author_image: entry.author_image || "",
            permlink: String(permlink),
            title: entry.title || "",
            image: entry.image || null,
            width: Number(entry.width) || 0,
            height: Number(entry.height) || 0,
            description: typeof entry.description === "string" ? entry.description.slice(0, 512) : "",
            tags: Array.isArray(entry.tags)
                ? entry.tags.filter((x) => typeof x === "string" && x).map((x) => x.toLowerCase()).slice(0, 24)
                : [],
            category: entry.category || null,
            community_title: entry.community_title || null,
            // Reject fabricated "/@author/permlink" urls; compose a proper
            // segmented one from the category when we already have it.
            url: normalizeUrl(entry.url)
                || (entry.category ? "/" + entry.category + "/@" + String(author) + "/" + String(permlink) : null),
            created: Number(entry.created) || now,
            bookmarked_at: now,
        };

        await col.upsert(docId(t, acct, author, permlink), doc);

        const index = await readIndex(col, acct);
        const list = index[t].filter((ref) => !sameRef(ref, author, permlink));
        list.unshift({ author: doc.author, permlink: doc.permlink, bookmarked_at: now });

        // Cap: evict the oldest overflow entries AND their documents.
        const evicted = list.length > MAX_PER_TYPE ? list.splice(MAX_PER_TYPE) : [];
        index[t] = list;
        await writeIndex(col, acct, index);
        for (const ref of evicted) {
            try { await col.delete(docId(t, acct, ref.author, ref.permlink)); } catch (_) {}
        }

        notify();
        _enrich(api, t, acct, doc).catch(() => {});
        return true;
    } catch (e) {
        console.warn("[favorites] addFavorite failed:", e && e.message);
        return false;
    }
}

/**
 * Remove a favorite (document + index ref).
 * @returns {Promise<boolean>} success
 */
export async function removeFavorite(api, type, author, permlink) {
    const t = normType(type);
    if (!author || !permlink) return false;
    try {
        const col = await getCol(api);
        const acct = await accountKey(api);

        const index = await readIndex(col, acct);
        index[t] = index[t].filter((ref) => !sameRef(ref, author, permlink));
        await writeIndex(col, acct, index);
        try { await col.delete(docId(t, acct, author, permlink)); } catch (_) {}

        notify();
        return true;
    } catch (e) {
        console.warn("[favorites] removeFavorite failed:", e && e.message);
        return false;
    }
}

/**
 * Full favorite entries of one type, recently-bookmarked first.
 * Broken refs (missing doc) are skipped and pruned from the index lazily.
 * @returns {Promise<object[]>}
 */
export async function getFavorites(api, type) {
    const t = normType(type);
    try {
        const col = await getCol(api);
        const acct = await accountKey(api);
        const index = await readIndex(col, acct);

        const docs = await Promise.all(index[t].map(async (ref) => {
            try { return await col.get(docId(t, acct, ref.author, ref.permlink)); }
            catch (_) { return null; }
        }));

        const out = [];
        const surviving = [];
        for (let i = 0; i < docs.length; i++) {
            if (docs[i]) { out.push(docs[i]); surviving.push(index[t][i]); }
        }
        // Self-heal a drifted index (best-effort, no await needed for caller)
        if (surviving.length !== index[t].length) {
            index[t] = surviving;
            writeIndex(col, acct, index).catch(() => {});
        }

        out.sort((a, b) => (b.bookmarked_at || 0) - (a.bookmarked_at || 0));
        return out;
    } catch (e) {
        console.warn("[favorites] getFavorites failed:", e && e.message);
        return [];
    }
}

// ── Community title resolution ──────────────────────────────────────────────

const PORTAL_RE = /^portal-\d+$/;
const titleCache = new Map();     // 'portal-NNNNN' → real title
const titleInFlight = new Map();  // dedupe concurrent lookups

/**
 * Resolve a category slug to its display name. Non-portal categories are
 * their own real name (plain tags). portal-NNNNN goes through
 * bridge.get_community and is cached for the session.
 * @returns {Promise<string>}
 */
export async function resolveCommunityTitle(api, name) {
    if (!name) return "";
    if (!PORTAL_RE.test(name)) return name;
    if (titleCache.has(name)) return titleCache.get(name);
    if (titleInFlight.has(name)) return titleInFlight.get(name);

    const p = (async () => {
        try {
            const community = api && api.communities
                ? await api.communities.getCommunity(name)
                : null;
            const title = (community && typeof community.title === "string" && community.title.trim())
                ? community.title.trim()
                : name;
            titleCache.set(name, title);
            return title;
        } catch (_) {
            return name; // don't cache failures — retry next session/open
        } finally {
            titleInFlight.delete(name);
        }
    })();
    titleInFlight.set(name, p);
    return p;
}

/**
 * Background back-fill of category / url / community_title on a freshly
 * stored favorite. One getContent + (blogs) one getCommunity, then a
 * silent upsert + notify. Never throws to the caller.
 * @private
 */
async function _enrich(api, type, acct, doc) {
    const needsContent = !doc.category || !normalizeUrl(doc.url);
    const needsTitle = type === FAVORITE_TYPES.BLOGS
        && ((doc.category && PORTAL_RE.test(doc.category) && !doc.community_title) || needsContent);
    if (!needsContent && !needsTitle) return;

    let patched = { ...doc };
    let changed = false;

    if (needsContent && api && api.content && api.content.getContent) {
        try {
            const entity = await api.content.getContent(doc.author, doc.permlink);
            if (entity) {
                if (!patched.category && entity.category) { patched.category = entity.category; changed = true; }
                if (!normalizeUrl(patched.url) && normalizeUrl(entity.url)) { patched.url = normalizeUrl(entity.url); changed = true; }
                if (!patched.description && typeof entity._summary === "string" && entity._summary) {
                    patched.description = entity._summary.slice(0, 512); changed = true;
                }
            }
        } catch (_) { /* stays un-enriched — manager falls back gracefully */ }
    }

    if (type === FAVORITE_TYPES.BLOGS && patched.category && PORTAL_RE.test(patched.category) && !patched.community_title) {
        const title = await resolveCommunityTitle(api, patched.category);
        if (title && title !== patched.category) { patched.community_title = title; changed = true; }
    }

    // Last resort: the entity url was fabricated too — compose the
    // segmented url from whatever category we ended up with. This also
    // REPAIRS documents persisted with the bad "/@author/permlink" shape.
    if (!normalizeUrl(patched.url) && patched.category) {
        patched.url = "/" + patched.category + "/@" + doc.author + "/" + doc.permlink;
        changed = true;
    }

    if (!changed) return;
    try {
        const col = await getCol(api);
        // Re-read before write: the user may have removed it mid-flight.
        let current = null;
        try { current = await col.get(docId(type, acct, doc.author, doc.permlink)); } catch (_) {}
        if (!current) return;
        await col.upsert(docId(type, acct, doc.author, doc.permlink), { ...current, ...patched, bookmarked_at: current.bookmarked_at });
        notify();
    } catch (_) { /* enrichment is optional */ }
}