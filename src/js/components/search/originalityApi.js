"use strict";

import { SEARCH_API_URL } from "./config";
import { artworkImageUrl } from "./searchApi";

// ── Originality: copies of an artwork, and artworks on similar themes ─────────
// Three routes of the pixagram-search Worker (v4; PAPH-X copy detection on @pixagram/paph-x):
//
//   GET /posts/:author/:permlink    the artwork as the Worker indexed it: its id there (the Worker
//                                   numbers posts itself), when its current image appeared on-chain
//                                   (artwork.history) and whether copy detection has run on that
//                                   image (artwork.stages.paph)
//   GET /copies/:id?min=suspected   the verdicts copy detection stored for it (D1 only, edge-cached
//                                   for a minute): every live artwork whose pixels match, with the
//                                   verdict (Identical, Copy, Suspected) and whether it is mirrored;
//                                   `indexed`: the check has completed for its current image under
//                                   the Worker's current engine. Asked with nsfw=include: like
//                                   /search, the Worker leaves NSFW works out otherwise, and an NSFW
//                                   original copied by a safe work would then go unseen (its image is
//                                   not shown unless the viewer shows NSFW: see fetchOriginality)
//   GET /similar/:id                its SigLIP neighbours: the same themes, not the same pixels
//
// Who came first is decided HERE, by when each IMAGE appeared on-chain (`image_since`, which the
// Worker derives from every recorded version of a post), not by when each post was created: an
// edit can put a new image into an old post, and creation order would then hand the older date to
// the copy. When the Worker could not date an image exactly (`history.exact` false: the post was
// edited and no recorded version shows when this image arrived), its date is only a lower bound —
// the image may be younger. Such a date never decides that its post came FIRST: the order of that
// pair is "unknown", and the verdict says so instead of guessing. The Worker's own earlier/later
// (post creation, then id) only breaks an exact tie.
//
// Nothing here throws. Every failure resolves to a status the drawer can show, and a failed
// answer is not remembered, so the next look asks again.

export const ORIGINALITY = Object.freeze({
    ORIGINAL: "original",         // checked, nothing matches
    POSSIBLE: "possible",         // loose (Suspected) matches only
    REPOSTED: "reposted",         // confirmed matches, all by the same artist
    COPIED: "copied",             // the first on-chain; other artists published copies afterwards
    FAKE: "fake",                 // another artist published a matching artwork earlier
    UNDETERMINED: "undetermined", // confirmed matches by other artists, but who came first is unknown
    PENDING: "pending",           // not indexed yet, or its image not checked yet
    UNAVAILABLE: "unavailable",   // the Worker could not answer
});

/** Verdict states of PAPH-X / comparator 42 (Unrelated 0 … Identical 4) that count as a match. */
export const MATCH = Object.freeze({ SUSPECTED: 2, COPY: 3, IDENTICAL: 4 });

// The Worker's own cap. /copies is ordered by verdict strength, not by date, so a cut list may
// miss the earliest work: a full page never yields "published first".
const MATCH_LIMIT = 100;
const SIMILAR_SHOWN = 8;    // artworks shown under Inspiration
const TTL_MS = 120000;      // arrow-nav back and forth does not ask twice
const CACHE_MAX = 64;

/** GET `path` on the Worker: { status, json }. status 0 = the network failed. */
async function getJson(path) {
    let res;
    try {
        res = await fetch(SEARCH_API_URL + path, { headers: { accept: "application/json" } });
    } catch (e) {
        return { status: 0, json: null };
    }
    let json = null;
    try {
        json = await res.json();
    } catch (e) {
        json = null;
    }
    return { status: res.status, json };
}

const cache = new Map(); // key -> { at, promise }

/** `make()` once per key for TTL_MS; an answer marked `failed` is dropped as soon as it lands. */
function remember(key, make, onError) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;
    const entry = { at: Date.now(), promise: null };
    const forget = () => { if (cache.get(key) === entry) cache.delete(key); };
    entry.promise = make().then(
        (value) => {
            if (value && value.failed) forget();
            return value;
        },
        () => {
            forget();
            return onError();
        },
    );
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, entry);
    return entry.promise;
}

/** What the drawer draws of a Worker item. */
export function toArtwork(item) {
    const a = (item && item.artwork) || {};
    const history = a.history || {};
    const width = Number(a.width) || 0;
    const height = Number(a.height) || 0;
    const created = Number(item.created) || 0;
    const since = Number(history.image_since) || 0;
    // Exact when the Worker says so; without its word, only a never-edited post's creation is.
    const exact = history.exact === true
        || (history.exact !== false && !since && !(Number(item.updated) > created));
    return {
        id: Number(item.id) || 0,
        author: String(item.author || "").replace(/^@/, ""),
        permlink: String(item.permlink || ""),
        category: typeof item.category === "string" ? item.category : null,
        tags: Array.isArray(item.tags) ? item.tags : [],
        title: typeof item.title === "string" ? item.title : "",
        width,
        height,
        src: artworkImageUrl(item),
        nsfw: item.nsfw === true,
        // Unix seconds: when this post's current image appeared on-chain (the post's creation
        // when the Worker has no version history for it). A lower bound unless `exact`.
        publishedAt: since || created,
        exact,
    };
}

/**
 * When `a` was published relative to `b`: "earlier", "later" or "unknown". The side that looks
 * first must be dated exactly — a lower bound that is already later than the other side's date
 * still proves "later", but a lower bound that is earlier proves nothing.
 */
function order(a, b, tieBreak) {
    if (a.publishedAt < b.publishedAt) return a.exact ? "earlier" : "unknown";
    if (a.publishedAt > b.publishedAt) return b.exact ? "later" : "unknown";
    return a.exact && b.exact ? tieBreak : "unknown";
}

/** A /copies item, seen from `self`. An NSFW work counts all the same; its image is withheld unless `showNsfw`. */
function toMatch(item, self, showNsfw) {
    const art = toArtwork(item);
    const copy = item.copy || {};
    return {
        ...art,
        src: art.nsfw && !showNsfw ? null : art.src,
        state: Number(copy.state),
        mirrored: copy.mirrored === true,
        relation: order(art, self, copy.relation === "earlier" ? "earlier" : "later"),
        sameAuthor: art.author === self.author,
    };
}

/**
 * The same file, byte for byte, in an earlier post of ANOTHER account, from the Worker's image
 * history. That history also remembers posts deleted since, which covers the one case no live
 * match can show: an artwork re-posted by someone else after its first post was taken down. A
 * post that is still live is among the matches, where its date is weighed with its exactness,
 * so the history only speaks for posts that are not.
 */
function firstSeenElsewhere(self, history, matches) {
    if (!history || history.first_seen_match !== "exact") return null;
    const m = /^\/@([a-z0-9.-]+)\/([^/?#]+)$/.exec(String(history.first_seen_post || ""));
    const at = Number(history.first_seen) || 0;
    if (!m || !at || m[1] === self.author || at >= self.publishedAt) return null;
    if (matches.some((x) => x.author === m[1] && x.permlink === m[2])) return null;
    return {
        id: 0, author: m[1], permlink: m[2], category: null, tags: [], title: "", width: 0, height: 0,
        src: null, nsfw: false, publishedAt: at, exact: true,
        state: MATCH.IDENTICAL, mirrored: false, relation: "earlier", sameAuthor: false, historical: true,
    };
}

/**
 * The verdict for an artwork, from its matches and its image history:
 *   fake          a confirmed match (Identical or Copy) by another artist appeared earlier
 *   undetermined  confirmed matches by other artists whose order cannot be told
 *   copied        it came first; other artists published confirmed matches afterwards
 *   reposted      confirmed matches, all the artist's own
 *   possible      loose matches only
 *   original      nothing
 * `source` (fake only) is the earliest of those earlier works: the one the sentence names.
 * `truncated`: the Worker returned a full page, so an earlier work may be missing from it.
 */
export function classify(self, matches, history, truncated = false) {
    const confirmed = matches.filter((m) => m.state >= MATCH.COPY);
    const others = confirmed.filter((m) => !m.sameAuthor);
    let source = null;
    for (const m of others) {
        if (m.relation === "earlier" && (!source || m.publishedAt < source.publishedAt)) source = m;
    }
    const seen = firstSeenElsewhere(self, history, matches);
    if (seen && (!source || seen.publishedAt < source.publishedAt)) source = seen;
    const none = { source: null, identical: false };
    if (source) return { status: ORIGINALITY.FAKE, source, identical: source.state === MATCH.IDENTICAL };
    if (others.some((m) => m.relation === "unknown")) return { status: ORIGINALITY.UNDETERMINED, ...none };
    if (others.length) return { status: truncated ? ORIGINALITY.UNDETERMINED : ORIGINALITY.COPIED, ...none };
    if (confirmed.length) return { status: ORIGINALITY.REPOSTED, ...none };
    if (matches.length) return { status: ORIGINALITY.POSSIBLE, ...none };
    return { status: ORIGINALITY.ORIGINAL, ...none };
}

/** The artwork and its matches, oldest image first: who published first reads left to right. */
export function timeline(self, matches) {
    const rank = (m) => (m.isSelf ? 0 : m.relation === "earlier" ? -1 : m.relation === "later" ? 1 : 0);
    return [{ ...self, isSelf: true }, ...matches]
        .sort((a, b) => a.publishedAt - b.publishedAt || rank(a) - rank(b) || a.id - b.id);
}

const unavailable = (self) => ({
    status: ORIGINALITY.UNAVAILABLE, self: self || null, matches: [], truncated: false,
    source: null, identical: false, failed: true,
});

async function loadOriginality(author, permlink, showNsfw) {
    const post = await getJson("/posts/" + encodeURIComponent(author) + "/" + encodeURIComponent(permlink));
    // Not indexed yet: the Worker follows the chain a few blocks behind.
    if (post.status === 404) {
        return { status: ORIGINALITY.PENDING, self: null, matches: [], truncated: false, source: null, identical: false, failed: true };
    }
    const item = post.json;
    if (post.status !== 200 || !item || !(Number(item.id) > 0)) return unavailable(null);
    const self = toArtwork(item);
    const art = item.artwork;
    if (item.type !== "artwork" || !art) {
        return { status: ORIGINALITY.PENDING, self, matches: [], truncated: false, source: null, identical: false, failed: true };
    }

    const copies = await getJson("/copies/" + self.id + "?min=suspected&nsfw=include&limit=" + MATCH_LIMIT);
    if (copies.status !== 200 || !copies.json || !Array.isArray(copies.json.items)) {
        // Copy detection unreachable (or switched off): the image history can still tell a re-post.
        const verdict = classify(self, [], art.history);
        return verdict.status === ORIGINALITY.FAKE
            ? { ...verdict, self, matches: [], truncated: false, failed: true }
            : unavailable(self);
    }
    const truncated = copies.json.items.length >= MATCH_LIMIT;
    // Every match counts for the verdict, shown or not: one without an image URL is still evidence.
    const matches = copies.json.items
        .filter((it) => it && it.copy && Number(it.id) !== self.id)
        .map((it) => toMatch(it, self, showNsfw))
        .filter((m) => m.state >= MATCH.SUSPECTED && m.state <= MATCH.IDENTICAL);
    const verdict = classify(self, matches, art.history, truncated);
    // The stage has not completed for this image: what other checks found may be shown, but
    // "original" cannot be said yet.
    const checked = copies.json.indexed === true && !(art.stages && art.stages.paph === false);
    if (!checked && verdict.status !== ORIGINALITY.FAKE) {
        return { status: ORIGINALITY.PENDING, self, matches, truncated, source: null, identical: false, failed: true };
    }
    return { ...verdict, self, matches, truncated };
}

/**
 * The originality of a post: { status, self, matches, truncated, source, identical }.
 *   self      the artwork itself (null when the Worker does not know it yet)
 *   matches   its matches, with `relation` ("earlier" | "later" | "unknown", by image time),
 *             `sameAuthor`, `state` (MATCH.*) and `mirrored`; `src` may be null — always for an
 *             NSFW match unless `nsfw` (the viewer shows NSFW): it counts for the verdict unseen
 * Always resolves.
 */
export function fetchOriginality(author, permlink, { nsfw = false } = {}) {
    const a = String(author || "").replace(/^@/, "");
    const p = String(permlink || "");
    if (!a || !p) return Promise.resolve(unavailable(null));
    const show = nsfw === true;
    return remember("o:" + a + "/" + p + ":" + (show ? 1 : 0), () => loadOriginality(a, p, show), () => unavailable(null));
}

/**
 * Up to eight artworks on similar themes (the Worker's SigLIP neighbours), without the artwork
 * itself and without `exclude` (its copies: the same pixels are not inspiration). NSFW stays out
 * unless the viewer shows it. Resolves to null when the Worker could not answer.
 */
export function fetchSimilar(id, { nsfw = false, exclude = [] } = {}) {
    const skip = new Set([Number(id)].concat(exclude.map(Number)));
    const limit = Math.min(50, SIMILAR_SHOWN + skip.size + 4);
    const key = "s:" + id + ":" + (nsfw ? 1 : 0) + ":" + limit;
    return remember(key, async () => {
        const r = await getJson("/similar/" + Number(id) + "?" + new URLSearchParams({ limit: String(limit), nsfw: nsfw ? "include" : "exclude" }).toString());
        if (r.status !== 200 || !r.json || !Array.isArray(r.json.items)) return { failed: true, items: null };
        return { items: r.json.items.filter((it) => it && it.type !== "blog").map(toArtwork) };
    }, () => ({ failed: true, items: null }))
        .then((v) => (v.items ? v.items.filter((a) => a.src && !skip.has(a.id)).slice(0, SIMILAR_SHOWN) : null));
}
