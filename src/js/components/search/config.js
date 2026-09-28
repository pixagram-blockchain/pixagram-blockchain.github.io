"use strict";

// ── Search configuration ──────────────────────────────────────────────────────
// The artwork leg talks to the pixagram-search Worker (D1 + FTS5 + Vectorize +
// SigLIP); everything else stays on the chain node through pixaAPI. The base
// URL can be overridden at runtime (window.__PIXAGRAM_SEARCH_API__) so a
// staging Worker can be pointed at without a rebuild.
export const SEARCH_API_URL = (
    (typeof window !== "undefined" && window.__PIXAGRAM_SEARCH_API__) ||
    "https://pixagram-search.p1x4.workers.dev"
).replace(/\/+$/, "");

export const LIMITS = Object.freeze({
    users: 8,
    tags: 10,
    communities: 10,
    artworks: 12,
    posts: 5,
});

// Community accounts are named portal-<id>; lookup_accounts returns them like any
// account, but they belong in the Communities section (with title + picture), not Users.
export const COMMUNITY_ACCOUNT_RE = /^portal-\d+$/;

export const DEBOUNCE_MS = 250;
export const CACHE_TTL_MS = 600_000;   // 10 min, same as before
export const CACHE_MAX_TERMS = 50;

// Masonry: two columns, gap in px, corner radius of the artwork cards.
export const MASONRY_COLUMNS = 2;
export const MASONRY_GAP = 6;
export const ARTWORK_RADIUS = 8;
