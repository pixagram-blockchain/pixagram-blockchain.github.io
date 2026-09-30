"use strict";

import { COMMUNITY_ACCOUNT_RE, DEFAULT_COLORS, LIMITS, SEARCH_API_URL } from "./config";
import { filtersToParams, hasFilters } from "./filters";

// ── pixagram-search Worker client ─────────────────────────────────────────────
// GET /search?q=…&<filters> returns artworks and posts. Two Workers answer in two shapes:
//
//   sets   (pixagram-search, production)
//            { artworks: { items, … }, posts: { items, … }, facets? }
//            artworks — full text + SigLIP image vectors, fused server-side
//            posts    — blog posts incl. community (portal-<id>) posts: full text + résumé
//                       vectors; items carry `community` and `post` (summary, excerpt, …)
//            `limit` applies per result set; `community=` filters by community.
//
//   flat   (pixagram-search-v2, the SigLIP 2 stack)
//            { items, mode, next_cursor, total_candidates, facets?, notes? }
//            One fused list for both types, so `limit` covers both. `type` narrows it.
//            There is no `community` parameter and no `community` field: a community post's
//            `category` is its portal-<id>, which is also stored as a tag, so the
//            community filter becomes `tag=portal-<id>`. Tags combine with AND, so several
//            communities take one request each. Posts carry no résumé; their
//            `description` stands in.
//
// The shape is read from the first answer and remembered. The sets Worker keeps its single
// request. The flat one gets one request per result set (each with its own limit) and per
// community. The UI sees the same normalized objects either way.
//
//   facets — only when asked for ({ facets: true }): { author, community, primary_color,
//            has_color, type, month, … } as [{ key, n }] counts
// Without a query the Worker browses (newest first) — that is how filters work on their own.

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

/** The community (portal-<id>) a post was published in: the field when the Worker sends it, else its category. */
function communityOf(item) {
    if (typeof item.community === "string" && item.community) return item.community;
    const category = String(item.category || "");
    return COMMUNITY_ACCOUNT_RE.test(category) ? category : null;
}

const text = (v) => (typeof v === "string" ? v.trim() : "");

function normalizePost(item) {
    const p = item.post || {};
    return {
        id: item.id,
        author: item.author,
        permlink: item.permlink,
        category: item.category || null,
        community: communityOf(item),
        title: item.title || "",
        tags: Array.isArray(item.tags) ? item.tags : [],
        summary: text(p.summary),
        // No excerpt from the flat Worker: the post's own description is the closest thing.
        excerpt: text(p.excerpt) || text(item.description),
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
        community: communityOf(item),
        title: item.title || "",
        tags: Array.isArray(item.tags) ? item.tags : [],
        width,
        height,
        // aspect = height / width; used to reserve space and balance the masonry
        aspect: width > 0 && height > 0 ? height / width : 1,
        src: artworkImageUrl(item),
        path: artworkPath(item),
        primaryColor: a.primary_color || null,
        // Unix seconds (the Worker stores chain time as UTC seconds): the card's tooltip.
        created: Number(item.created) || 0,
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

/** GET /search with `params`: the parsed body, or null on any failure. Rethrows only on abort. */
async function fetchSearch(params, signal) {
    const url = SEARCH_API_URL + "/search?" + new URLSearchParams(params).toString();
    let res;
    try {
        res = await fetch(url, { signal, headers: { accept: "application/json" } });
    } catch (e) {
        if (e && e.name === "AbortError") throw e;
        return null;
    }
    if (!res.ok) return null;
    try {
        return await res.json();
    } catch (e) {
        if (e && e.name === "AbortError") throw e;
        return null;
    }
}

const isSets = (json) => !!json && typeof json === "object" && (!!json.artworks || !!json.posts);

// "sets" | "flat" once the Worker has answered; null until then.
let apiShape = null;

function fromSets(json, limit, postsLimit) {
    const artworks = (Array.isArray(json?.artworks?.items) ? json.artworks.items : []).map(normalize).filter((it) => it.src && it.path).slice(0, limit);
    const posts = (Array.isArray(json?.posts?.items) ? json.posts.items : []).map(normalizePost).filter((it) => it.path).slice(0, postsLimit);
    return { artworks, posts, facets: normalizeFacets(json?.facets) };
}

/** Items of several flat answers as one list: first seen wins, re-ordered when several scopes were merged. */
function mergeItems(answers, newest) {
    const seen = new Set();
    const items = [];
    for (const json of answers) {
        for (const it of Array.isArray(json?.items) ? json.items : []) {
            if (it && it.id != null && !seen.has(it.id)) {
                seen.add(it.id);
                items.push(it);
            }
        }
    }
    if (answers.length > 1) {
        items.sort(newest
            ? (a, b) => (b.created || 0) - (a.created || 0)
            : (a, b) => (b.score?.fused || 0) - (a.score?.fused || 0));
    }
    return items;
}

/**
 * The flat Worker: one request per result set (so each gets its own limit) and per
 * community (a community is a tag there, and tags combine with AND). All in parallel.
 */
async function searchFlat(params, filters, { signal, limit, postsLimit, facets }) {
    const base = { ...params };
    const community = base.community;
    delete base.community; // not a parameter there: each community becomes a tag scope
    delete base.type; // each request below sets its own
    const scopes = community ? String(community).split(",").filter(Boolean).map((c) => ({ tag: c })) : [{}];
    const onlyType = filters && (filters.type === "artwork" || filters.type === "blog") ? filters.type : null;
    const wantArtworks = limit > 0 && onlyType !== "blog";
    const wantPosts = postsLimit > 0 && onlyType !== "artwork";
    const newest = base.sort === "newest";

    const ask = (extra) => Promise.all(scopes.map((scope) => fetchSearch({ ...base, ...scope, ...extra }, signal)));
    const [artAnswers, postAnswers, facetAnswers] = await Promise.all([
        wantArtworks ? ask({ type: "artwork", limit: String(limit) }) : [],
        wantPosts ? ask({ type: "blog", limit: String(postsLimit) }) : [],
        // Facets: one light request over both types (or the one picked). Left out when several
        // communities are filtered (one request each), since the UI does not ask for them.
        facets && scopes.length === 1 ? ask({ ...(onlyType ? { type: onlyType } : {}), limit: "1", facets: "1" }) : [],
    ]);
    if (artAnswers.concat(postAnswers).length && artAnswers.concat(postAnswers).every((j) => !j)) return EMPTY;

    const artworks = mergeItems(artAnswers, newest).map(normalize).filter((it) => it.src && it.path).slice(0, limit);
    const posts = mergeItems(postAnswers, newest).map(normalizePost).filter((it) => it.path).slice(0, postsLimit);
    return { artworks, posts, facets: normalizeFacets(facetAnswers[0]?.facets) };
}

/**
 * Search artworks and posts. Resolves to empty sets on any failure (the dropdown must
 * never break because the search Worker is unreachable) and rethrows only on abort.
 * An empty term with filters browses (newest first).
 */
export async function searchIndex(term, { signal, filters = null, limit = LIMITS.artworks, postsLimit = LIMITS.posts, nsfw = "exclude", facets = false } = {}) {
    const q = String(term || "").trim();
    if (!q && !hasFilters(filters)) return EMPTY;
    const params = { nsfw, sort: q ? "relevance" : "newest", ...filtersToParams(filters) };
    if (q) params.q = q;
    const opts = { signal, limit, postsLimit, facets };

    if (apiShape === "flat") return searchFlat(params, filters, opts);

    // Sets Worker (or not known yet): one request; `limit` applies per result set, so ask
    // for the larger of the two and trim.
    const first = { ...params, limit: String(Math.max(limit, postsLimit)) };
    if (facets) first.facets = "1";
    const json = await fetchSearch(first, signal);
    if (!json) return EMPTY;
    if (isSets(json)) {
        apiShape = "sets";
        return fromSets(json, limit, postsLimit);
    }
    if (!Array.isArray(json.items)) return EMPTY;
    // A flat Worker: that answer shared one limit between both types and ignored
    // `community`, so ask again the way it understands (only this once).
    apiShape = "flat";
    return searchFlat(params, filters, opts);
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