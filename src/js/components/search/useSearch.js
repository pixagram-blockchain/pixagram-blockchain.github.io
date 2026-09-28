"use strict";
import { useCallback, useEffect, useReducer, useRef, useState } from "preact/compat";

import { CACHE_MAX_TERMS, CACHE_TTL_MS, COMMUNITY_ACCOUNT_RE, DEBOUNCE_MS, LIMITS } from "./config";
import { searchIndex } from "./searchApi";

// ── useSearch ─────────────────────────────────────────────────────────────────
// Replaces Index's useBlockchainSearch with the same contract
//   { query, results, handleChange, reset, isOpen }
// plus two additions inside `results`:
//   users        [{ username, name, about, profile_image }]  (was: bare names)
//   communities  [{ ...bridge row, profile_image }]          (community account's avatar)
//   artworks     [...]  from the pixagram-search Worker, `artworksLoading` while in flight
//   posts        [...]  blog posts incl. community (portal) posts, same request as artworks
//
// Two-phase delivery: chain results (users/tags/communities + their profiles)
// land as soon as the node answers; artworks arrive in a second dispatch so a
// slow semantic query never holds the whole dropdown back.

const EMPTY = Object.freeze([]);

export const SEARCH_IDLE = Object.freeze({
    users: EMPTY, tags: EMPTY, communities: EMPTY, artworks: EMPTY, posts: EMPTY,
    loading: false, artworksLoading: false,
});

function reducer(state, action) {
    switch (action.type) {
        case "loading":
            return { ...state, loading: true, artworksLoading: true };
        case "chain":
            return { ...state, users: action.users, tags: action.tags, communities: action.communities, loading: false };
        case "artworks":
            return { ...state, artworks: action.artworks, posts: action.posts, artworksLoading: false };
        case "cached":
            return { ...action.results, loading: false, artworksLoading: false };
        case "reset":
            return SEARCH_IDLE;
        default:
            return state;
    }
}

/** Profile object of a get_accounts row, whichever shape the API layer returned. */
export function profileOf(row) {
    if (!row) return {};
    if (row._profile && typeof row._profile === "object") return row._profile;
    const raw = row.posting_json_metadata || row.json_metadata;
    if (typeof raw === "string" && raw) {
        try {
            const p = JSON.parse(raw)?.profile;
            if (p && typeof p === "object") return p;
        } catch (e) { /* unparsable metadata: no profile */ }
    }
    return {};
}

/** One get_accounts round-trip for every user and community name at once. */
async function fetchProfiles(pixaAPI, names) {
    const unique = Array.from(new Set(names.filter(Boolean)));
    const out = new Map();
    if (!unique.length || !pixaAPI?.accounts?.getAccounts) return out;
    for (let i = 0; i < unique.length; i += 100) {
        const chunk = unique.slice(i, i + 100);
        let rows;
        try {
            rows = await pixaAPI.accounts.getAccounts(chunk, true);
        } catch (e) {
            continue; // rows without a profile still render (name only)
        }
        for (const row of Array.isArray(rows) ? rows : []) {
            if (row?.name) out.set(row.name, profileOf(row));
        }
    }
    return out;
}

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function useSearch(apiRef) {
    const [query, setQuery] = useState("");
    const [results, dispatch] = useReducer(reducer, SEARCH_IDLE);
    const debounceRef = useRef(null);
    const abortRef = useRef(null);
    const cacheRef = useRef(new Map());
    // Trending tags are query-independent and filtered client-side: fetched
    // once per TTL, not once per term.
    const browseTagsRef = useRef(null);
    // Profiles are stable per account; keep them across terms so re-typing
    // does not re-pay get_accounts for the same people.
    const profilesRef = useRef(new Map());
    // Hivemind's community `query` is whole-word full-text search ("dev" does not
    // find "Development"). The ranked community list is small and query-independent,
    // so it is fetched once per TTL and matched client-side by substring on
    // title/name, merged after the server's own matches.
    const browseCommunitiesRef = useRef(null);

    const executeSearch = useCallback(async (trimmed) => {
        const pixaAPI = apiRef.current;
        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();
        const { signal } = abortRef.current;

        if (!pixaAPI) {
            dispatch({ type: "reset" });
            return;
        }

        // Artwork + post search (one request) runs in parallel with the chain calls from the start.
        const indexPromise = searchIndex(trimmed, { signal, limit: LIMITS.artworks, postsLimit: LIMITS.posts })
            .catch((e) => (e && e.name === "AbortError" ? null : { artworks: [], posts: [] }));

        let users = [];
        let tags = [];
        let communities = [];
        try {
            const now = Date.now();
            const browse = browseTagsRef.current;
            const browseFresh = !!browse && now - browse._ts < CACHE_TTL_MS;

            const browseC = browseCommunitiesRef.current;
            const browseCFresh = !!browseC && now - browseC._ts < CACHE_TTL_MS;

            const [usersRaw, tagsRaw, communitiesRaw, allCommunitiesRaw] = await Promise.allSettled([
                pixaAPI.accounts.lookupAccounts(trimmed, LIMITS.users),
                browseFresh ? browse.tags : pixaAPI.tags.getTrendingTags(null, 100),
                // Server-side: `query` matches title/about on the bridge (whole words).
                pixaAPI.communities.listCommunities({ query: trimmed, limit: LIMITS.communities, sort: "rank" }),
                browseCFresh ? browseC.communities : pixaAPI.communities.listCommunities({ limit: 100, sort: "rank" }),
            ]);
            if (signal.aborted) return;

            const usernames = usersRaw.status === "fulfilled" && Array.isArray(usersRaw.value)
                ? usersRaw.value.filter((u) => typeof u === "string" && u.toLowerCase().includes(trimmed) && !COMMUNITY_ACCOUNT_RE.test(u))
                : [];
            const tagsAll = tagsRaw.status === "fulfilled" && Array.isArray(tagsRaw.value) ? tagsRaw.value : [];
            const serverCommunities = communitiesRaw.status === "fulfilled" && Array.isArray(communitiesRaw.value)
                ? communitiesRaw.value
                : [];
            const allCommunities = allCommunitiesRaw.status === "fulfilled" && Array.isArray(allCommunitiesRaw.value)
                ? allCommunitiesRaw.value
                : [];
            if (!browseCFresh && allCommunities.length) browseCommunitiesRef.current = { communities: allCommunities, _ts: now };

            // Server matches first (they also cover `about`), then substring matches
            // on title/name the server's whole-word search missed.
            const seenC = new Set(serverCommunities.map((c) => c.name));
            const communityRows = serverCommunities.concat(
                allCommunities.filter((c) => {
                    if (!c?.name || seenC.has(c.name)) return false;
                    const title = String(c.title || "").toLowerCase();
                    return title.includes(trimmed) || c.name.toLowerCase().includes(trimmed);
                }),
            ).slice(0, LIMITS.communities);

            if (!browseFresh && tagsAll.length) browseTagsRef.current = { tags: tagsAll, _ts: now };
            tags = tagsAll
                .filter((t) => t?.name?.toLowerCase().includes(trimmed) && t.name !== "")
                .slice(0, LIMITS.tags);

            // Profiles for users AND communities (a community's picture is the
            // profile image of its account) in one round-trip, cache-first.
            const cache = profilesRef.current;
            const wanted = usernames.concat(communityRows.map((c) => c.name)).filter((n) => n && !cache.has(n));
            const fetched = await fetchProfiles(pixaAPI, wanted);
            if (signal.aborted) return;
            fetched.forEach((profile, name) => cache.set(name, profile));
            for (const n of wanted) if (!cache.has(n)) cache.set(n, {}); // negative cache: no re-fetch per keystroke

            users = usernames.map((username) => {
                const p = cache.get(username) || {};
                return {
                    username,
                    name: str(p.name, 64),
                    about: str(p.about, 160),
                    profile_image: typeof p.profile_image === "string" && p.profile_image ? p.profile_image : null,
                };
            });
            communities = communityRows.map((c) => {
                const p = cache.get(c.name) || {};
                return {
                    ...c,
                    profile_image: typeof p.profile_image === "string" && p.profile_image ? p.profile_image : null,
                };
            });

            dispatch({ type: "chain", users, tags, communities });
        } catch (e) {
            if (signal.aborted) return;
            console.warn("[search] chain search failed:", e && e.message);
            dispatch({ type: "chain", users: [], tags: [], communities: [] });
        }

        const index = await indexPromise;
        if (signal.aborted || index === null) return;
        dispatch({ type: "artworks", artworks: index.artworks, posts: index.posts });

        const cache = cacheRef.current;
        cache.set(trimmed, { users, tags, communities, artworks: index.artworks, posts: index.posts, _ts: Date.now() });
        if (cache.size > CACHE_MAX_TERMS) cache.delete(cache.keys().next().value);
    }, [apiRef]);

    const handleChange = useCallback((e) => {
        const value = e.target.value;
        setQuery(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);

        const trimmed = value.trim().toLowerCase();
        if (!trimmed) {
            if (abortRef.current) abortRef.current.abort();
            dispatch({ type: "reset" });
            return;
        }
        const cached = cacheRef.current.get(trimmed);
        if (cached && Date.now() - cached._ts < CACHE_TTL_MS) {
            if (abortRef.current) abortRef.current.abort();
            dispatch({ type: "cached", results: cached });
            return;
        }
        if (cached) cacheRef.current.delete(trimmed);

        dispatch({ type: "loading" });
        debounceRef.current = setTimeout(() => executeSearch(trimmed), DEBOUNCE_MS);
    }, [executeSearch]);

    const reset = useCallback(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (abortRef.current) abortRef.current.abort();
        setQuery("");
        dispatch({ type: "reset" });
    }, []);

    useEffect(() => () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (abortRef.current) abortRef.current.abort();
        cacheRef.current.clear();
        profilesRef.current.clear();
        browseTagsRef.current = null;
        browseCommunitiesRef.current = null;
    }, []);

    return { query, results, handleChange, reset, isOpen: query.length > 0 };
}
