"use strict";

import { DEFAULT_COLORS, LIMITS, SEARCH_API_URL } from "./config";
import { filtersToParams, hasFilters } from "./filters";

// ── pixagram-search Worker client ─────────────────────────────────────────────
// GET /search?q=…&<filters> returns two independent result sets (plus facets on request):
//   artworks — full text + SigLIP image vectors, fused server-side; items carry the
//              artwork's native size and content-addressed image URLs (R2)
//   posts    — blog posts incl. community (portal-<id>) posts: full text + résumé
//              vectors; items carry the résumé, keywords and an excerpt
//   facets   — only when asked for ({ facets: true }): { author, community,
//              primary_color, has_color, type, month, … } as [{ key, n }] counts
// Without a query the Worker browses (newest first) — that is how filters work
// on their own.

/** Absolute URL of the best thumbnail: the native WebP (small, exact pixels) first. */
export function artworkImageUrl(item) {
    const images = item?.artwork?.images;
    const rel = images?.original || images?.upscaled;
    if (!rel) return null;
    return /^https?:\/\//i.test(rel) ? rel : SEARCH_API_URL + rel;
}

/** App route of a post: /<category>/@<author>/<permlink> (what the feed/profile pages push). */
export function artworkPath(item) {
    const author = String(item.author || "").replaceAll("@", "");
    const permlink = String(item.permlink || "");
    if (!author || !permlink) return null;
    const category = String(item.category || "").replace(/^\/+|\/+$/g, "");
    return (category ? "/" + category : "") + "/@" + author + "/" + permlink;
}

function normalizePost(item) {
    const p = item.post || {};
    return {
        id: item.id,
        author: item.author,
        permlink: item.permlink,
        category: item.category || null,
        community: item.community || null,
        title: item.title || "",
        tags: Array.isArray(item.tags) ? item.tags : [],
        summary: typeof p.summary === "string" ? p.summary : "",
        excerpt: typeof p.excerpt === "string" ? p.excerpt : "",
        keywords: Array.isArray(p.keywords) ? p.keywords : [],
        lang: p.lang || null,
        wordCount: p.word_count || 0,
        created: item.created,
        netVotes: item.net_votes || 0,
        path: artworkPath(item),
        score: item.score ? item.score.fused : 0,
    };
}

function normalize(item) {
    const a = item.artwork || {};
    const width = Number(a.width) || 0;
    const height = Number(a.height) || 0;
    return {
        id: item.id,
        author: item.author,
        permlink: item.permlink,
        category: item.category || null,
        community: item.community || null,
        title: item.title || "",
        tags: Array.isArray(item.tags) ? item.tags : [],
        width,
        height,
        // aspect = height / width; used to reserve space and balance the masonry
        aspect: width > 0 && height > 0 ? height / width : 1,
        src: artworkImageUrl(item),
        path: artworkPath(item),
        primaryColor: a.primary_color || null,
        score: item.score ? item.score.fused : 0,
    };
}

const FACET_DIMS = ["author", "community", "primary_color", "has_color", "type", "month", "tag", "size_class"];

function normalizeFacets(raw) {
    if (!raw || typeof raw !== "object") return null;
    const out = {};
    for (const dim of FACET_DIMS) {
        const rows = Array.isArray(raw[dim]) ? raw[dim] : [];
        out[dim] = rows
            .filter((r) => r && typeof r.key === "string" && r.key)
            .map((r) => ({ key: r.key, n: Number(r.n) || 0 }));
    }
    return out;
}

const EMPTY = Object.freeze({ artworks: [], posts: [], facets: null });

/**
 * Search artworks and posts in one call. Resolves to empty sets on any failure (the
 * dropdown must never break because the search Worker is unreachable) and rethrows
 * only on abort. An empty term with filters browses (newest first).
 */
export async function searchIndex(term, { signal, filters = null, limit = LIMITS.artworks, postsLimit = LIMITS.posts, nsfw = "exclude", facets = false } = {}) {
    const q = String(term || "").trim();
    if (!q && !hasFilters(filters)) return EMPTY;
    // One request; `limit` applies per result set, so ask for the larger of the two and trim.
    const params = {
        limit: String(Math.max(limit, postsLimit)),
        nsfw,
        sort: q ? "relevance" : "newest",
        ...filtersToParams(filters),
    };
    if (q) params.q = q;
    if (facets) params.facets = "1";
    const url = SEARCH_API_URL + "/search?" + new URLSearchParams(params).toString();
    let res;
    try {
        res = await fetch(url, { signal, headers: { accept: "application/json" } });
    } catch (e) {
        if (e && e.name === "AbortError") throw e;
        return EMPTY;
    }
    if (!res.ok) return EMPTY;
    let json;
    try { json = await res.json(); } catch (e) { return EMPTY; }
    const artworks = (Array.isArray(json?.artworks?.items) ? json.artworks.items : []).map(normalize).filter((it) => it.src && it.path).slice(0, limit);
    const posts = (Array.isArray(json?.posts?.items) ? json.posts.items : []).map(normalizePost).filter((it) => it.path).slice(0, postsLimit);
    return { artworks, posts, facets: normalizeFacets(json?.facets) };
}

/** Artworks only (kept for callers that do not want posts). */
export async function searchArtworks(term, opts = {}) {
    return (await searchIndex(term, { ...opts, postsLimit: 0 })).artworks;
}

// ── Vocabulary ────────────────────────────────────────────────────────────────
// The colour buckets the Worker classifies artworks into (name + representative
// hex). Fetched once from /vocab so the swatches always match the index; the
// static copy in config.js is the fallback while it loads or if it fails.

export const DEFAULT_VOCAB = Object.freeze({ colors: DEFAULT_COLORS });

let vocabCache = null;
let vocabPromise = null;

export function getVocab() {
    return vocabCache || DEFAULT_VOCAB;
}

export function loadVocab() {
    if (vocabCache) return Promise.resolve(vocabCache);
    if (!vocabPromise) {
        vocabPromise = fetch(SEARCH_API_URL + "/vocab", { headers: { accept: "application/json" } })
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => {
                const colors = Array.isArray(j?.colors)
                    ? j.colors.filter((c) => c && typeof c.name === "string" && /^#[0-9a-f]{6}$/i.test(String(c.hex))).map((c) => ({ name: c.name, hex: c.hex }))
                    : [];
                vocabCache = Object.freeze({ colors: colors.length ? colors : DEFAULT_COLORS });
                return vocabCache;
            })
            .catch(() => {
                vocabPromise = null; // retry on the next call
                return DEFAULT_VOCAB;
            });
    }
    return vocabPromise;
}
