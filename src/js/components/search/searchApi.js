"use strict";

import { COMMUNITY_ACCOUNT_RE, DEFAULT_COLORS, LIMITS, SEARCH_API_URL, SUGGEST_ROWS } from "./config";
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
//   flat   (pixagram-search-v2 and v3, the SigLIP 2 stacks)
//            { items, mode, next_cursor, total_candidates, facets?, notes?, query_id?, did_you_mean? }
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
// v3 (flat) also returns a `query_id` per answer: every item keeps the one it came with and its
// rank there (`qid`, `rank`), so a click can be reported to /feedback (the ranker learns from
// it). `did_you_mean` (a corrected query) is passed on.
//
//   facets — only when asked for ({ facets: true }): { author, community, primary_color,
//            has_color, type, month, … } as [{ key, n }] counts
// Without a query the Worker browses (newest first) — that is how filters work on their own.

/**
 * Absolute URL of the best thumbnail: the native WebP (small, exact pixels) first. Only the
 * Worker's own image paths ("/img/…") or an https URL: anything else is no image.
 */
export function artworkImageUrl(item) {
    const images = item?.artwork?.images;
    return workerImage(images?.original) || workerImage(images?.upscaled);
}

const httpsUrl = (v) => (typeof v === "string" && /^https:\/\/[^\s]+$/i.test(v) ? v : null);

/** An image path of the Worker ("/img/orig/…") or an https URL, as an absolute URL; else null. */
function workerImage(v) {
    if (typeof v !== "string" || !v) return null;
    if (/^\/img\/[A-Za-z0-9._/-]+$/.test(v) && !v.includes("..")) return SEARCH_API_URL + v;
    return httpsUrl(v);
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
        qid: typeof item._qid === "string" ? item._qid : null,
        rank: Number(item._rank) || null,
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
        qid: typeof item._qid === "string" ? item._qid : null,
        rank: Number(item._rank) || null,
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

const EMPTY = Object.freeze({ artworks: [], posts: [], facets: null, didYouMean: null });

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
    return { artworks, posts, facets: normalizeFacets(json?.facets), didYouMean: null };
}

/** The corrected query of the first answer that has one (a word was misspelled). */
function didYouMeanOf(answers) {
    for (const json of answers) {
        const d = json && typeof json.did_you_mean === "string" ? json.did_you_mean.trim() : "";
        if (d) return d.slice(0, 120);
    }
    return null;
}

/**
 * Items of several flat answers as one list: first seen wins, re-ordered when several scopes were
 * merged. Each keeps the query_id of its answer and its rank there (for /feedback).
 */
function mergeItems(answers, newest) {
    const seen = new Set();
    const items = [];
    for (const json of answers) {
        const qid = json && typeof json.query_id === "string" ? json.query_id : null;
        const list = Array.isArray(json?.items) ? json.items : [];
        list.forEach((it, i) => {
            if (it && it.id != null && !seen.has(it.id)) {
                seen.add(it.id);
                items.push(qid ? { ...it, _qid: qid, _rank: i + 1 } : it);
            }
        });
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
    return { artworks, posts, facets: normalizeFacets(facetAnswers[0]?.facets), didYouMean: didYouMeanOf(artAnswers.concat(postAnswers)) };
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
// ── v3: suggestions, examples, answers, feedback ──────────────────────────────
// /suggest and /query exist on the v3 Worker only. Against an older one (or when
// it cannot be reached) these resolve to null / the built-in examples and the box
// behaves as before. Everything from the Worker is checked here: texts are
// plain strings (rendered as text nodes, never HTML), links are https only.

const SUGGESTION_KINDS = new Set(["complete", "question", "title", "help", "popular", "correction"]);
const ROUTES = new Set(["search", "ask", "help"]);

/** GET `path` on the Worker: the parsed body, or null on any failure. Rethrows only on abort. */
async function getJson(path, params, signal) {
    const url = SEARCH_API_URL + path + (params ? "?" + new URLSearchParams(params).toString() : "");
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

const clean = (v, max) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** One suggestion from /suggest, checked; null when it is not one. */
export function normalizeSuggestion(raw) {
    if (!raw || typeof raw !== "object") return null;
    const text = clean(raw.text, 160);
    if (!text) return null;
    const kind = SUGGESTION_KINDS.has(raw.kind) ? raw.kind : "complete";
    const route = ROUTES.has(raw.route) ? raw.route : "search";
    const out = { text, kind, route };
    const query = clean(raw.query, 300);
    if (query) out.query = query;
    if (Number.isFinite(Number(raw.n)) && Number(raw.n) > 0) out.n = Number(raw.n);
    if (raw.source && typeof raw.source === "object") {
        const url = httpsUrl(raw.source.url);
        if (url) out.source = { title: clean(raw.source.title, 120), heading: clean(raw.source.heading, 120), url };
    }
    const p = raw.post;
    if (p && typeof p === "object" && typeof p.author === "string" && typeof p.permlink === "string" && p.author && p.permlink) {
        const post = {
            id: Number(p.id) || null,
            author: p.author,
            permlink: p.permlink,
            category: typeof p.category === "string" ? p.category : null,
            type: p.type === "blog" ? "blog" : "artwork",
            image: workerImage(p.image),
        };
        if (artworkPath(post)) out.post = post;
    }
    return out;
}

/**
 * What the Worker proposes for the text typed (a trailing space says the last word is finished):
 * { q, completion, items }, or null when it cannot say (an older Worker, a network error).
 */
export async function fetchSuggestions(text, { signal, lang, limit = SUGGEST_ROWS + 2 } = {}) {
    const q = String(text || "").replace(/^\s+/, "").slice(0, 100);
    if (!q.trim()) return null;
    const params = { q, limit: String(limit) };
    if (lang) params.lang = lang;
    const json = await getJson("/suggest", params, signal);
    if (!json || !Array.isArray(json.suggestions)) return null;
    const items = json.suggestions.map(normalizeSuggestion).filter(Boolean);
    const completion = typeof json.completion === "string" && json.completion.length > q.length ? json.completion.slice(0, 160) : null;
    return { q: text, completion, items };
}

// Examples for the placeholder when the Worker has none to give (an older Worker, offline):
// a few searches and questions every Pixagram index can answer.
const FALLBACK_EXAMPLES = Object.freeze({
    en: ["pixel cat", "who posted the first dragon?", "blue landscape", "who is the most active artist?", "how many cat artworks?"],
    fr: ["chat", "qui a posté la première œuvre de dragon ?", "paysage bleu", "quel est l'artiste le plus actif ?", "combien de chats ?"],
    de: ["Katze", "wer hat den ersten Drachen gepostet?", "blaue Landschaft", "wer ist der aktivste Künstler?", "wie viele Katzen?"],
    es: ["gato", "dragón", "paisaje azul"],
    it: ["gatto", "drago", "paesaggio blu"],
    pt: ["gato", "dragão", "paisagem azul"],
});

const fallbackExamples = (lang) =>
    (FALLBACK_EXAMPLES[lang] || FALLBACK_EXAMPLES.en).map((text) => ({ text, kind: /[?？]$/.test(text) ? "question" : "complete", route: /[?？]$/.test(text) ? "ask" : "search" }));

const examplesCache = new Map(); // lang → Promise<[suggestion]>

/**
 * Examples for the placeholder in the UI language, once per language and page load. When the
 * Worker could not give any (offline, a refusal, an older Worker), the built-in ones come back,
 * marked `fallback`, and are not kept: the next call asks again.
 */
export function loadExamples(lang) {
    const key = /^[a-z]{2}$/.test(String(lang || "")) ? lang : "en";
    if (!examplesCache.has(key)) {
        const fallback = () => {
            examplesCache.delete(key);
            const list = fallbackExamples(key);
            list.fallback = true;
            return Object.freeze(list);
        };
        const p = getJson("/suggest", { lang: key })
            .then((json) => {
                if (!json) return fallback();
                const list = Array.isArray(json.examples) ? json.examples.map(normalizeSuggestion).filter(Boolean) : [];
                // the Worker answered: an index with nothing to show yet gets the built-in ones, kept
                return Object.freeze(list.length ? list : fallbackExamples(key));
            })
            .catch(fallback);
        examplesCache.set(key, p);
    }
    return examplesCache.get(key);
}

/** The text of an answer with at most `max` characters, as plain text. */
const answerText = (v, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function normalizeSources(list) {
    return (Array.isArray(list) ? list : [])
        .map((s, i) => {
            const url = httpsUrl(s && s.url);
            if (!url) return null;
            return { n: Number(s.n) || i + 1, title: clean(s.title, 120), heading: clean(s.heading, 120), url, excerpt: clean(s.excerpt, 400) };
        })
        .filter(Boolean)
        .slice(0, 8);
}

/**
 * GET /query: the Worker's router decides between a search, an /ask answer and a /help answer
 * (or `route` forces one). Resolves to
 *   { route: "ask",  text, value, confidence, empty, items: [artwork…] }
 *   { route: "help", text, status, sources: [{ n, title, heading, url, excerpt }] }
 *   { route: "search", links: [{ title, heading, url }] }   (documentation pages that match, maybe none)
 *   { route: "search", links: [], retry: true }             (the answer budget is spent: ask again later)
 * or null when the Worker cannot say. Rethrows only on abort.
 */
export async function fetchAnswer(text, { signal, route = null, filters = null, nsfw = "exclude" } = {}) {
    const q = String(text || "").trim().slice(0, 300);
    if (!q) return null;
    // results=0: the box runs its own search; the Worker need not run (and log) another
    const params = { q, nsfw, results: "0" };
    if (route === "ask" || route === "help") params.route = route;
    if (filters && (filters.type === "artwork" || filters.type === "blog")) params.type = filters.type;
    const json = await getJson("/query", params, signal);
    if (!json || typeof json.route !== "string") return null;
    // The client's answer budget was spent: no verdict about the text, ask again later.
    if (json.answer_budget === "spent") return { route: "search", links: [], retry: true };
    const a = json.answer && typeof json.answer === "object" ? json.answer : null;
    if (json.route === "ask" && a) {
        const items = (Array.isArray(a.items) ? a.items : []).map(normalize).filter((it) => it.src && it.path).slice(0, 8);
        const value = typeof a.answer === "string" || typeof a.answer === "number" ? a.answer : null;
        return {
            route: "ask",
            text: answerText(a.answer_text, 600),
            value,
            empty: value === null || value === 0,
            confidence: Number(a.confidence) || 0,
            items,
        };
    }
    if (json.route === "help" && a) {
        const status = typeof a.status === "string" ? a.status : "not_found";
        if (status === "disabled" || status === "no_docs") return { route: "search", links: [] };
        return { route: "help", text: answerText(a.answer_text), status, sources: normalizeSources(a.sources) };
    }
    return { route: "search", links: normalizeSources(json.help_links) };
}

/**
 * Tell the Worker which result was opened (POST /feedback): fire and forget, survives the
 * navigation that follows. Only for items that came with a query_id (v3).
 */
export function sendFeedback(item, action = "click") {
    if (!item || typeof item.qid !== "string" || !item.qid || !(Number(item.id) > 0)) return;
    const body = JSON.stringify({ query_id: item.qid, post_id: Number(item.id), rank: item.rank || undefined, action });
    const url = SEARCH_API_URL + "/feedback";
    try {
        // text/plain: a simple request, no CORS preflight; the Worker reads the JSON body as is
        const blob = typeof Blob === "function" ? new Blob([body], { type: "text/plain;charset=UTF-8" }) : null;
        if (blob && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function" && navigator.sendBeacon(url, blob)) return;
        fetch(url, { method: "POST", body, keepalive: true, headers: { "content-type": "text/plain;charset=UTF-8" } }).catch(() => {});
    } catch (e) {
        // feedback is best effort
    }
}
