"use strict";

import { LIMITS, SEARCH_API_URL } from "./config";

// ── pixagram-search Worker client ─────────────────────────────────────────────
// GET /search?q=…&type=artwork — full text over title/tags/description/AI caption
// plus semantic (SigLIP) matches, fused server-side. Items carry the artwork's
// native size and content-addressed image URLs served by the Worker from R2.

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

function normalize(item) {
    const a = item.artwork || {};
    const width = Number(a.width) || 0;
    const height = Number(a.height) || 0;
    return {
        id: item.id,
        author: item.author,
        permlink: item.permlink,
        category: item.category || null,
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

/**
 * Search artworks. Resolves to [] on any failure (the dropdown must never break
 * because the search Worker is unreachable) and rethrows only on abort.
 */
export async function searchArtworks(term, { signal, limit = LIMITS.artworks, nsfw = "exclude" } = {}) {
    const q = String(term || "").trim();
    if (!q) return [];
    const url = SEARCH_API_URL + "/search?" + new URLSearchParams({
        q, type: "artwork", limit: String(limit), nsfw, sort: "relevance",
    }).toString();
    let res;
    try {
        res = await fetch(url, { signal, headers: { accept: "application/json" } });
    } catch (e) {
        if (e && e.name === "AbortError") throw e;
        return [];
    }
    if (!res.ok) return [];
    let json;
    try { json = await res.json(); } catch (e) { return []; }
    const items = Array.isArray(json?.items) ? json.items : [];
    return items.map(normalize).filter((it) => it.src && it.path);
}
