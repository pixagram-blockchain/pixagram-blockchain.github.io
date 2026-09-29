"use strict";

// ── Search configuration ──────────────────────────────────────────────────────
// The artwork/post leg talks to the pixagram-search Worker (D1 + FTS5 + Vectorize +
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

// Masonry: two columns, gap in px, corner radius of the artwork cards (shared by
// the avatars and the colour swatches' rounding).
export const MASONRY_COLUMNS = 2;
export const MASONRY_GAP = 6;
export const ARTWORK_RADIUS = 8;

// Desktop (MUI md and up): the open search widens by up to SEARCH_EXPAND_PX when
// the viewport has room to its right. The dropdown runs from the bar's bottom edge
// down to the viewport's (minus a gutter), within these bounds.
export const DESKTOP_MIN_WIDTH = 960;
export const SEARCH_EXPAND_PX = 128;
export const DROPDOWN_MIN_HEIGHT = 280;
export const DROPDOWN_MAX_HEIGHT = 780;

// Filter panel: suggestions shown under the author / community text fields.
export const SUGGEST_LIMIT = 6;

// The Worker's 20 colour buckets (name + representative hex), in the order the
// swatches are drawn. /vocab is the source of truth and replaces this at runtime.
// SWATCH_HEX overrides the drawn colour where the representative one would vanish
// on the dark panel (the swatches have no border).
export const DEFAULT_COLORS = Object.freeze([
    { name: "black", hex: "#111111" },
    { name: "white", hex: "#f4f4f4" },
    { name: "gray", hex: "#808080" },
    { name: "red", hex: "#d62828" },
    { name: "orange", hex: "#f77f00" },
    { name: "yellow", hex: "#f5d000" },
    { name: "green", hex: "#2a9d3f" },
    { name: "lime", hex: "#9bdc28" },
    { name: "teal", hex: "#1f9e93" },
    { name: "cyan", hex: "#3cc8e8" },
    { name: "sky", hex: "#8ec8f0" },
    { name: "blue", hex: "#2a5fd1" },
    { name: "navy", hex: "#1b2a5c" },
    { name: "purple", hex: "#7b3fbf" },
    { name: "magenta", hex: "#d63ba8" },
    { name: "pink", hex: "#f5a3c7" },
    { name: "brown", hex: "#7a4a26" },
    { name: "tan", hex: "#d2b48c" },
    { name: "olive", hex: "#7a7a2a" },
    { name: "maroon", hex: "#6e1a2a" },
]);

export const SWATCH_HEX = Object.freeze({ black: "#000000" });
