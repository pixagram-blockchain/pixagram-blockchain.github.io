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

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 24; // tag feeds × sorts can grow — keep it bounded

const store = new Map();

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
            store.delete(key);
            return null;
        }
        return entry;
    },

    /** Replace the entry for `key` (resets its timestamp). */
    set(key, data) {
        if (!key) return;
        // Refresh insertion order so eviction below is LRU-ish.
        store.delete(key);
        store.set(key, { ...data, ts: Date.now() });
        if (store.size > MAX_ENTRIES) {
            const oldest = store.keys().next().value;
            store.delete(oldest);
        }
    },

    /** Shallow-merge into an existing entry WITHOUT refreshing its TTL.
     *  No-op when the key isn't cached (e.g. saving scroll for an expired
     *  entry) — scroll position without its posts is meaningless. */
    patch(key, patch) {
        if (!key) return;
        const entry = store.get(key);
        if (entry) Object.assign(entry, patch);
    },

    delete(key) { store.delete(key); },
    clear() { store.clear(); },
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
