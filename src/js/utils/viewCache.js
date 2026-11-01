"use strict";

// ── viewCache ──────────────────────────────────────────────────────────
// Module-level stale-while-revalidate cache for page-scoped view state
// (post lists, scroll position). Index.js intentionally tears the whole
// page subtree down on every cross-page navigation (keyed Suspense), so
// component state cannot survive feed → profile → back. This cache lives
// at module scope and does: the page serves its last-known data instantly
// on remount, then revalidates in the background.
//
// Invalidation is already handled upstream: the api eventEmitter's
// `post_published` / `content_updated` / `content_deleted` listeners
// trigger a refetch, whose result overwrites the cached entry. The TTL is
// only a backstop for long-idle tabs.
//
// NOT persisted: this is in-memory only and resets on reload — by design,
// since the api proxy layer (LacertaDB) already owns durable caching.

//
// Memory: a cached feed holds every card it ever loaded, each with its
// artwork data URI, author avatar, metadata and votes (~65 KB a card), and
// the cache used to be bounded only by key count (24) with the TTL checked on
// read. Five feeds scrolled to 150 posts kept ~49 MB after navigating away,
// 24 × 300 cards ~470 MB. It is now bounded three ways: 8 keys, an estimated
// byte budget, and a sweep of expired entries on every write. The entry being
// written is never evicted by its own write, so the page you are on keeps its
// state even when it alone exceeds the budget.

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 8;
const MAX_COST = 32 * 1024 * 1024; // estimated bytes, see costOf

const store = new Map();
let totalCost = 0;

const strLen = (s) => (typeof s === "string" ? s.length : 0);

// Estimated bytes held by an entry's posts. base64 strings are counted at one
// byte per character (V8 stores Latin-1 strings that way), other text at two.
// An author avatar shared by several cards is counted for each of them, so the
// estimate errs on the high side.
const costOf = (data) => {
    const posts = data && Array.isArray(data.posts) ? data.posts : [];
    let n = 0;
    for (let i = 0; i < posts.length; i++) {
        const p = posts[i];
        if (!p) continue;
        n += 512
            + strLen(p.image)
            + strLen(p.author && p.author.image)
            + 2 * (strLen(p.json_metadata) + strLen(p._description_html) + strLen(p._summary))
            + 150 * (Array.isArray(p.active_votes) ? p.active_votes.length : 0);
    }
    return n;
};

const drop = (key) => {
    const entry = store.get(key);
    if (!entry) return;
    totalCost -= entry._cost || 0;
    store.delete(key);
};

// Expired entries first, then the least recently written, until within both
// budgets. `keep` (the entry just written) is never dropped.
const sweep = (keep) => {
    const now = Date.now();
    for (const [k, entry] of store) {
        if (k !== keep && now - entry.ts > DEFAULT_TTL_MS) drop(k);
    }
    for (const k of store.keys()) {
        if (store.size <= MAX_ENTRIES && totalCost <= MAX_COST) break;
        if (k !== keep) drop(k);
    }
};

const viewCache = {
    /**
     * @param {string} key
     * @param {number} [ttl] override the default 5-minute freshness window
     * @returns {object|null} the entry ({...data, ts}) or null when absent/expired
     */
    get(key, ttl = DEFAULT_TTL_MS) {
        if (!key) return null;
        const entry = store.get(key);
        if (!entry) return null;
        if (Date.now() - entry.ts > ttl) {
            drop(key);
            return null;
        }
        return entry;
    },

    /** Replace the entry for `key` (resets its timestamp). */
    set(key, data) {
        if (!key) return;
        // Refresh insertion order so eviction is least-recently-written first.
        drop(key);
        const cost = costOf(data);
        store.set(key, { ...data, ts: Date.now(), _cost: cost });
        totalCost += cost;
        sweep(key);
    },

    /** Shallow-merge into an existing entry WITHOUT refreshing its TTL.
     *  No-op when the key isn't cached (e.g. saving scroll for an expired
     *  entry) — scroll position without its posts is meaningless. */
    patch(key, patch) {
        if (!key) return;
        const entry = store.get(key);
        if (!entry) return;
        Object.assign(entry, patch);
        if (patch && "posts" in patch) {
            totalCost -= entry._cost || 0;
            entry._cost = costOf(entry);
            totalCost += entry._cost;
            sweep(key);
        }
    },

    delete(key) { drop(key); },
    clear() { store.clear(); totalCost = 0; },
};

/**
 * Stable identity signature for a post list. Used to decide whether a
 * background revalidation actually changed the list (order/membership) —
 * only then is a full Masonry reset (dataVersion bump) warranted. Vote
 * count changes etc. don't alter card heights (heights are keyed by id),
 * so an identical signature lets the refresh skip the expensive
 * clearAll() / clearCellPositions() path.
 */
export const postsSignature = (posts) =>
    (posts || [])
        .map((p) => p?.id ?? `${p?.author?.username || p?.author || ""}/${p?.permlink || ""}`)
        .join("|");

export default viewCache;
