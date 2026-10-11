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
// it). `did_you_mean` (a corrected query) is passed on. v4.8: the artworks request asks for an
// `overview` (overview=1, in the UI language): one or two sentences about the page ("37 artworks
// match (showing 15). Most by @nova (12)…"), passed on as { text, lines }.
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

const EMPTY = Object.freeze({ artworks: [], posts: [], facets: null, didYouMean: null, overview: null });

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
    return { artworks, posts, facets: normalizeFacets(json?.facets), didYouMean: null, overview: null };
}

/** v4.8: the overview of a search answer ({ text, lines }), checked; null when there is none. */
function overviewOf(json) {
    const o = json && json.overview && typeof json.overview === "object" ? json.overview : null;
    const text = o ? clean(o.text, 600) : "";
    if (!text) return null;
    const lines = (Array.isArray(o.lines) ? o.lines : []).map((l) => clean(l, 300)).filter(Boolean).slice(0, 6);
    return Object.freeze({ text, lines: Object.freeze(lines.length ? lines : [text]) });
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
async function searchFlat(params, filters, { signal, limit, postsLimit, facets, lang }) {
    const base = { ...params };
    const community = base.community;
    delete base.community; // not a parameter there: each community becomes a tag scope
    delete base.type; // each request below sets its own
    const scopes = community ? String(community).split(",").filter(Boolean).map((c) => ({ tag: c })) : [{}];
    const onlyType = filters && (filters.type === "artwork" || filters.type === "blog") ? filters.type : null;
    const wantArtworks = limit > 0 && onlyType !== "blog";
    const wantPosts = postsLimit > 0 && onlyType !== "artwork";
    const newest = base.sort === "newest";
    // v4.8: the overview of the page, with the artworks (the request a search always makes),
    // in the UI language; not when browsing (no words to sum up) nor across several scopes
    const overview = base.q && scopes.length === 1 ? { overview: "1", ...(lang ? { lang } : {}) } : {};

    const ask = (extra) => Promise.all(scopes.map((scope) => fetchSearch({ ...base, ...scope, ...extra }, signal)));
    const [artAnswers, postAnswers, facetAnswers] = await Promise.all([
        wantArtworks ? ask({ type: "artwork", limit: String(limit), ...overview }) : [],
        wantPosts ? ask({ type: "blog", limit: String(postsLimit), ...(wantArtworks ? {} : overview) }) : [],
        // Facets: one light request over both types (or the one picked). Left out when several
        // communities are filtered (one request each), since the UI does not ask for them.
        facets && scopes.length === 1 ? ask({ ...(onlyType ? { type: onlyType } : {}), limit: "1", facets: "1" }) : [],
    ]);
    if (artAnswers.concat(postAnswers).length && artAnswers.concat(postAnswers).every((j) => !j)) return EMPTY;

    const artworks = mergeItems(artAnswers, newest).map(normalize).filter((it) => it.src && it.path).slice(0, limit);
    const posts = mergeItems(postAnswers, newest).map(normalizePost).filter((it) => it.path).slice(0, postsLimit);
    return {
        artworks, posts, facets: normalizeFacets(facetAnswers[0]?.facets), didYouMean: didYouMeanOf(artAnswers.concat(postAnswers)),
        overview: overviewOf(wantArtworks ? artAnswers[0] : postAnswers[0]),
    };
}

/**
 * Search artworks and posts. Resolves to empty sets on any failure (the dropdown must
 * never break because the search Worker is unreachable) and rethrows only on abort.
 * An empty term with filters browses (newest first).
 */
export async function searchIndex(term, { signal, filters = null, limit = LIMITS.artworks, postsLimit = LIMITS.posts, nsfw = "exclude", facets = false, lang = null } = {}) {
    const q = String(term || "").trim();
    if (!q && !hasFilters(filters)) return EMPTY;
    const params = { nsfw, sort: q ? "relevance" : "newest", ...filtersToParams(filters) };
    if (q) params.q = q;
    const opts = { signal, limit, postsLimit, facets, lang: /^[a-z]{2}$/.test(String(lang || "")) ? lang : null };

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
//
// v4 answers the same requests with more: a status, the index's answer apart from
// the reasoning model's explanation of it, the model's name, a query_id for votes.
//
// v4.8 (the Worker's README, "Rich answers") answers at length. normalizeAsk reads
// the long answer's parts (`rich`: the body, the index's facts and overview, the
// reasoning trail, the caveats, the follow-up questions and searches) and where the
// model's part is (`elaboration`: inline, pending at a URL, or none); fetchElaboration
// brings a pending one, mergeElaboration folds it into the first answer. /help
// answers carry follow-ups and related sections; /suggest takes after=<query_id>.

const SUGGESTION_KINDS = new Set(["complete", "question", "title", "help", "popular", "correction", "followup"]);
const ROUTES = new Set(["search", "ask", "help"]);

/** GET `path` on the Worker: { status, json } — json null on a network failure or a body that is not JSON. Rethrows only on abort. */
async function getJsonStatus(path, params, signal) {
    const url = SEARCH_API_URL + path + (params ? "?" + new URLSearchParams(params).toString() : "");
    let res;
    try {
        res = await fetch(url, { signal, headers: { accept: "application/json" } });
    } catch (e) {
        if (e && e.name === "AbortError") throw e;
        return { status: 0, json: null };
    }
    let json = null;
    try {
        json = await res.json();
    } catch (e) {
        if (e && e.name === "AbortError") throw e;
    }
    return { status: res.status, json: json && typeof json === "object" ? json : null };
}

/** GET `path` on the Worker: the parsed body of a 2xx answer, or null on any failure. Rethrows only on abort. */
async function getJson(path, params, signal) {
    const r = await getJsonStatus(path, params, signal);
    return r.status >= 200 && r.status < 300 ? r.json : null;
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

/** A query_id as the Worker issues them (the only form sent back in a URL). */
const QUERY_ID_RE = /^[A-Za-z0-9_-]{6,64}$/;

/**
 * What the Worker proposes for the text typed (a trailing space says the last word is finished):
 * { q, completion, items }, or null when it cannot say (an older Worker, a network error).
 * v4.8: with `after` (the query_id of the answer shown), that answer's follow-up questions and
 * related searches come first (kind "followup"), each with the route the box should send it to.
 */
export async function fetchSuggestions(text, { signal, lang, limit = SUGGEST_ROWS + 2, after = null } = {}) {
    const q = String(text || "").replace(/^\s+/, "").slice(0, 100);
    if (!q.trim()) return null;
    const params = { q, limit: String(limit) };
    if (lang) params.lang = lang;
    if (typeof after === "string" && QUERY_ID_RE.test(after)) params.after = after;
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

/** A longer text cut at a word boundary, with "…" when it was cut. */
function clip(v, max) {
    const s = typeof v === "string" ? v.trim() : "";
    if (s.length <= max) return s;
    const cut = s.slice(0, max);
    const at = cut.lastIndexOf(" ");
    return (at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:]+$/, "") + "…";
}

/**
 * A model's text without the evidence ids it cites ("… cats [R1].", "[E184, E201]"): the Worker
 * has checked each claim against those cards. (The long answer's body keeps them: AnswerCard
 * turns the ones that name a post into links.)
 */
const withoutEvidenceIds = (s) => s.replace(/\s*\[[REDCI]\d+(?:\s*[,;]\s*[REDCI]\d+)*\]/g, "").replace(/\s+([.,;:!?])/g, "$1").trim();

/** Known model ids, as people know them (the rest get the last part of their id). */
const MODEL_LABELS = [
    [/^glm-5\.3-flash$/i, "GLM-5.3 Flash"],
    [/^glm-5\.3$/i, "GLM-5.3"],
    [/^glm-([\d.]+)(-flash)?$/i, (m) => "GLM-" + m[1] + (m[2] ? " Flash" : "")],
    [/^gpt-oss-(\d+)b$/i, (m) => "GPT-OSS " + m[1] + "B"],
    [/^gemma-(\d+)[\w.-]*$/i, (m) => "Gemma " + m[1]],
    [/^nemotron-(\d+)[\w.-]*$/i, (m) => "Nemotron " + m[1]],
    [/^qwen3\.8-(\d+)b$/i, (m) => "Qwen3.8 " + m[1] + "B"],
    [/^deepseek-v(\d+)-(flash|pro)[\w.-]*$/i, (m) => "DeepSeek V" + m[1] + " " + m[2][0].toUpperCase() + m[2].slice(1)],
    [/^kimi-k([\d.]+)$/i, (m) => "Kimi K" + m[1]],
    [/^llama-([\d.]+)-(\d+)b[\w.-]*$/i, (m) => "Llama " + m[1] + " " + m[2] + "B"],
];

/** A model id as people know it: "@cf/zai-org/glm-5.3-flash" → "GLM-5.3 Flash", "@cf/openai/gpt-oss-120b" → "GPT-OSS 120B". */
export function modelLabel(model) {
    const id = typeof model === "string" ? model.trim() : "";
    if (!id) return "";
    // "@cf/<org>/<name>", "hf:<org>/<name>:<provider>", "<endpoint>:<name>"
    const name = id.replace(/:[a-z0-9-]+$/i, "").slice(id.replace(/:[a-z0-9-]+$/i, "").lastIndexOf("/") + 1).replace(/^[a-z0-9-]+:/i, "");
    for (const [re, label] of MODEL_LABELS) {
        const m = re.exec(name);
        if (m) return typeof label === "function" ? label(m) : label;
    }
    return name.slice(0, 40);
}

// v4's answer statuses (v3 sends none).
const ASK_STATUSES = new Set(["answered", "no_match", "insufficient_evidence", "conflict", "clarify", "not_found"]);
const ELABORATION_STATUSES = new Set(["inline", "pending", "ready", "none"]);
const ELABORATION_URL_RE = /^\/ask\/elaboration\/[A-Za-z0-9_-]{6,64}$/;
const CLAIM_STATUSES = new Set(["supported", "qualified", "unsupported", "contradicted"]);

const strings = (list, max, n) => (Array.isArray(list) ? list : []).map((x) => clean(x, max)).filter(Boolean).slice(0, n);

/** A follow-up question or a related search of an answer, as a suggestion the box can pick. */
function normalizeFollowUp(raw, dflt) {
    if (!raw || typeof raw !== "object") return null;
    const text = clean(raw.text, 200);
    if (!text) return null;
    const route = ROUTES.has(raw.route) ? raw.route : dflt;
    return { text, route, kind: "followup", source: raw.source === "model" ? "model" : "rules" };
}

/**
 * The posts the answer's citations name ([E12]: evidence cards of type artwork or post), by
 * evidence id: { id, author, permlink, path, title }. `items` (the posts behind the answer, with
 * their images and app paths) are preferred when they hold the same post.
 */
function normalizeCards(raw, items) {
    const byId = new Map(items.map((it) => [it.id, it]));
    const out = {};
    for (const c of Array.isArray(raw) ? raw : []) {
        if (!c || typeof c !== "object" || (c.type !== "artwork" && c.type !== "post")) continue;
        const eid = typeof c.evidence_id === "string" && /^E\d{1,9}$/.test(c.evidence_id) ? c.evidence_id : null;
        const m = typeof c.path === "string" ? /^\/@([a-z][a-z0-9.-]{1,14}[a-z0-9])\/([A-Za-z0-9._-]{1,256})$/.exec(c.path) : null;
        if (!eid || !m) continue;
        const id = Number(c.artwork_id) || null;
        const item = id ? byId.get(id) : null;
        out[eid] = item
            ? { id: item.id, author: item.author, permlink: item.permlink, category: item.category, path: item.path, title: item.title, src: item.src || null }
            : { id, author: m[1], permlink: m[2], category: null, path: c.path, title: clean(c.title, 160), src: null };
    }
    return out;
}

// The answers' own limit: /query asks /ask for at most 24 posts.
const ANSWER_LIMIT = 24;

/**
 * An /ask answer, from the v3, v4 or v4.8 Worker, as the box shows it:
 *   { route: "ask", question, text, value, status, empty, clarify, confidence, items, queryId,
 *     explanation, model, byModel, cards, rich, elaboration, raw }
 *   text         the index's answer (v4: result_text) — or, when there is none, what the Worker
 *                says instead (nothing found, the question asked back, a model's synthesis)
 *   status       v4: answered | no_match | insufficient_evidence | conflict | clarify | not_found;
 *                null from v3
 *   explanation  v4: the reasoning model's explanation of the index's answer, when it passed the
 *                Worker's claim verification ("" when none); `model` names the model that ran
 *   byModel      the whole text is the model's (a synthesis no operator gives, its claims verified)
 *   items        the posts behind the answer (thumbnails); cards: the posts its citations name
 *   rich         v4.8, the long answer's parts (null from an older Worker, or with style=brief):
 *                { body (Markdown, citations kept), overview[], facts[], thinking[{n, text, status}],
 *                  caveats[], followUps[{text, route}], searches[{text, route}], words }
 *   elaboration  v4.8, where the model's part is: { status: "inline" | "pending" | "none", url }
 *                — pending: fetchElaboration(url) brings it (useSearch does, and merges it)
 *   raw          the Worker's own answer (what an elaboration is merged over)
 */
function normalizeAsk(a, question) {
    const all = (Array.isArray(a.items) ? a.items : []).map(normalize).filter((it) => it.src && it.path).slice(0, ANSWER_LIMIT);
    const value = typeof a.answer === "string" || typeof a.answer === "number" || typeof a.answer === "boolean" ? a.answer : null;
    const status = typeof a.status === "string" && ASK_STATUSES.has(a.status) ? a.status : null;
    const answered = status === "answered" || status === "conflict";
    const resultText = answerText(a.result_text, 600);
    const explanation = clip(withoutEvidenceIds(answerText(a.explanation, 4000)), 1500);
    const model = typeof a.model === "string" && a.model ? a.model.slice(0, 120) : null;
    // v4.8: the direct answer is answer_short (answer_text may carry the whole answer with text=full)
    const direct = answerText(a.answer_short, 4000) || answerText(a.answer_text, 4000);
    const sections = a.sections && typeof a.sections === "object" ? a.sections : null;
    const style = a.style === "brief" ? "brief" : a.style === "rich" ? "rich" : null;
    let rich = null;
    if (sections && style === "rich") {
        const thinking = (Array.isArray(sections.thinking) ? sections.thinking : [])
            .map((t, i) => (t && typeof t === "object" ? { n: Number(t.n) || i + 1, text: clean(t.text, 600), status: CLAIM_STATUSES.has(t.status) ? t.status : "supported" } : null))
            .filter((t) => t && t.text)
            .slice(0, 12);
        rich = Object.freeze({
            body: typeof sections.body === "string" ? sections.body.trim().slice(0, 12000) : "",
            overview: Object.freeze(strings(sections.overview, 400, 6)),
            facts: Object.freeze(strings(sections.facts, 400, 12)),
            thinking: Object.freeze(thinking),
            caveats: Object.freeze(strings(sections.caveats, 400, 8)),
            followUps: Object.freeze((Array.isArray(sections.follow_ups) ? sections.follow_ups : []).map((f) => normalizeFollowUp(f, "ask")).filter(Boolean).slice(0, 8)),
            searches: Object.freeze((Array.isArray(sections.searches) ? sections.searches : []).map((f) => normalizeFollowUp(f, "search")).filter(Boolean).slice(0, 6)),
            words: a.length && Number.isFinite(Number(a.length.words)) ? Number(a.length.words) : 0,
        });
    }
    const e = a.elaboration && typeof a.elaboration === "object" ? a.elaboration : null;
    const eStatus = e && ELABORATION_STATUSES.has(e.status) ? e.status : "none";
    const url = e && typeof e.url === "string" && ELABORATION_URL_RE.test(e.url) ? e.url : null;
    const elaboration = Object.freeze({
        // ready (the merged elaboration) reads as inline; pending without a URL cannot be fetched
        status: eStatus === "ready" ? "inline" : eStatus === "pending" && !url ? "none" : eStatus,
        url: eStatus === "pending" ? url : null,
    });
    return {
        route: "ask",
        question,
        // (without a result, a v4 text may be the model's own answer: its evidence ids go too)
        text: resultText || (status ? clip(withoutEvidenceIds(direct), 1500) : answerText(direct, 600)),
        value,
        status,
        // nothing found, nothing to answer from, a zero, or the question asked back: shown dimmed
        // (v3: a null or zero answer; a v4 answer may be a boolean)
        empty: status ? !answered || value === 0 : value === null || value === 0,
        clarify: status === "clarify",
        confidence: Number(a.confidence) || 0,
        items: all.slice(0, 8),
        queryId: typeof a.query_id === "string" && QUERY_ID_RE.test(a.query_id) ? a.query_id : null,
        explanation,
        model,
        byModel: !resultText && !!model && answered,
        cards: normalizeCards(a.cards, all),
        rich,
        elaboration,
        raw: a,
    };
}

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

/** v4.8: the other sections of the pages a help answer cites, as links. */
function normalizeRelated(list, sources) {
    const cited = new Set(sources.map((s) => s.url));
    return (Array.isArray(list) ? list : [])
        .map((r) => {
            const url = httpsUrl(r && r.url);
            if (!url || cited.has(url)) return null;
            return { title: clean(r.title, 120), heading: clean(r.heading, 120), url };
        })
        .filter((r) => r && (r.title || r.heading))
        .slice(0, 6);
}

/**
 * A /help answer as the box shows it: { route: "help", text, status, sources, followUps, related, style }
 *   text       the documentation's answer (v4.8 rich: a direct sentence, the details, steps as a
 *              numbered list — light Markdown with [n] citations; AnswerCard renders it)
 *   followUps  v4.8: questions the documentation answers too (route help)
 *   related    v4.8: the other sections of the cited pages, as links
 */
function normalizeHelp(a) {
    const status = typeof a.status === "string" ? a.status : "not_found";
    const sources = normalizeSources(a.sources);
    return {
        route: "help",
        text: answerText(a.answer_text, 6000),
        status,
        sources,
        followUps: (Array.isArray(a.follow_ups) ? a.follow_ups : []).map((f) => normalizeFollowUp(f, "help")).filter(Boolean).slice(0, 6),
        related: normalizeRelated(a.related, sources),
        style: a.style === "rich" ? "rich" : a.style === "brief" ? "brief" : null,
        model: typeof a.model === "string" && a.model ? a.model.slice(0, 120) : null,
    };
}

/**
 * GET /query: the Worker's router decides between a search, an /ask answer and a /help answer
 * (or `route` forces one). Resolves to
 *   { route: "ask",  text, value, confidence, empty, items: [artwork…], rich, elaboration, … }   (see normalizeAsk)
 *   { route: "help", text, status, sources, followUps, related }                                  (see normalizeHelp)
 *   { route: "search", links: [{ title, heading, url }] }   (documentation pages that match, maybe none)
 *   { route: "search", links: [], retry: true }             (the answer budget is spent: ask again later)
 * or null when the Worker cannot say. Rethrows only on abort.
 *
 * v4.8: asked with defer=1, so the index's answer comes back at once with its digest, and the
 * model's part is left to GET /ask/elaboration/:query_id (answer.elaboration.url). A v4 Worker
 * ignores the parameter and answers as it did.
 */
export async function fetchAnswer(text, { signal, route = null, filters = null, nsfw = "exclude" } = {}) {
    const q = String(text || "").trim().slice(0, 300);
    if (!q) return null;
    // results=0: the box runs its own search; the Worker need not run (and log) another
    const params = { q, nsfw, results: "0", defer: "1" };
    if (route === "ask" || route === "help") params.route = route;
    if (filters && (filters.type === "artwork" || filters.type === "blog")) params.type = filters.type;
    const json = await getJson("/query", params, signal);
    if (!json || typeof json.route !== "string") return null;
    // The client's answer budget was spent: no verdict about the text, ask again later.
    if (json.answer_budget === "spent") return { route: "search", links: [], retry: true };
    const a = json.answer && typeof json.answer === "object" ? json.answer : null;
    if (json.route === "ask" && a) return normalizeAsk(a, q);
    if (json.route === "help" && a) {
        const status = typeof a.status === "string" ? a.status : "not_found";
        if (status === "disabled" || status === "no_docs") return { route: "search", links: [] };
        return normalizeHelp(a);
    }
    return { route: "search", links: normalizeSources(json.help_links) };
}

/**
 * v4.8: the model's part of an answer asked with defer=1 — GET answer.elaboration.url. The Worker
 * runs the model the first time it is asked and answers when it is done (the request waits
 * there), so one call usually brings it. Resolves to
 *   { outcome: "ready", fields }     the fields the model's part changed (mergeElaboration)
 *   { outcome: "pending" }           another call is running the model: ask again shortly
 *   { outcome: "failed", retry }     the model did not answer; retry: the next call tries again
 *   { outcome: "unavailable" }       the Worker could not say (a failure, an expired answer)
 * Rethrows only on abort.
 */
export async function fetchElaboration(url, { signal } = {}) {
    if (typeof url !== "string" || !ELABORATION_URL_RE.test(url)) return { outcome: "unavailable" };
    const { status, json } = await getJsonStatus(url, null, signal);
    if (!json || typeof json.status !== "string") return { outcome: "unavailable" };
    if (status === 200 && json.status === "ready" && json.answer && typeof json.answer === "object") return { outcome: "ready", fields: json.answer };
    if (status === 200 && json.status === "pending") return { outcome: "pending" };
    if (status === 200 && json.status === "failed") return { outcome: "failed", retry: json.retry === true };
    return { outcome: "unavailable" };
}

/**
 * The first answer with the model's part folded in: the fields the elaboration changed, over the
 * Worker's own first answer, read again as the box shows it (the posts, the citations and the
 * query_id are the first answer's).
 */
export function mergeElaboration(answer, fields) {
    if (!answer || answer.route !== "ask" || !fields || typeof fields !== "object") return answer;
    const merged = normalizeAsk({ ...answer.raw, ...fields, items: answer.raw.items, cards: answer.raw.cards, query_id: answer.raw.query_id }, answer.question);
    // the model's part is in: nothing left to fetch
    return { ...merged, elaboration: Object.freeze({ status: "inline", url: null }) };
}

/** POST a small JSON body as a simple request (no CORS preflight), surviving a navigation. */
function beacon(path, payload) {
    const body = JSON.stringify(payload);
    const url = SEARCH_API_URL + path;
    try {
        // text/plain: a simple request, no CORS preflight; the Worker reads the JSON body as is
        const blob = typeof Blob === "function" ? new Blob([body], { type: "text/plain;charset=UTF-8" }) : null;
        if (blob && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function" && navigator.sendBeacon(url, blob)) return;
        fetch(url, { method: "POST", body, keepalive: true, headers: { "content-type": "text/plain;charset=UTF-8" } }).catch(() => {});
    } catch (e) {
        // feedback is best effort
    }
}

// Votes sent in this page's life (query_id → rating): an answer shown again shows its vote.
const votes = new Map();

/** v4: a vote on an answer (POST /ask/feedback): 1 helpful, -1 not. Fire and forget, once per answer. */
export function sendAnswerFeedback(queryId, rating) {
    if (typeof queryId !== "string" || !queryId || (rating !== 1 && rating !== -1) || votes.has(queryId)) return;
    votes.set(queryId, rating);
    if (votes.size > 200) votes.delete(votes.keys().next().value);
    beacon("/ask/feedback", { query_id: queryId, rating });
}

/** The vote sent on an answer in this page's life (1 | -1), or 0. */
export function answerVote(queryId) {
    return (typeof queryId === "string" && votes.get(queryId)) || 0;
}

/**
 * Tell the Worker which result was opened (POST /feedback): fire and forget, survives the
 * navigation that follows. Only for items that came with a query_id (v3).
 */
export function sendFeedback(item, action = "click") {
    if (!item || typeof item.qid !== "string" || !item.qid || !(Number(item.id) > 0)) return;
    beacon("/feedback", { query_id: item.qid, post_id: Number(item.id), rank: item.rank || undefined, action });
}
