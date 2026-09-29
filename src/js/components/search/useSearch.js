"use strict";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "preact/compat";

import { CACHE_MAX_TERMS, CACHE_TTL_MS, COMMUNITY_ACCOUNT_RE, DEBOUNCE_MS, LIMITS, SUGGEST_LIMIT } from "./config";
import { EMPTY_FILTERS, filtersKey, hasFilters, normalizeFilters } from "./filters";
import { searchIndex } from "./searchApi";

// ── useSearch ─────────────────────────────────────────────────────────────────
// Replaces Index's useBlockchainSearch with the same contract
//   { query, results, handleChange, reset, isOpen }
// plus `controls` (one stable object for the filter UI) and these additions
// inside `results`:
//   users            [{ username, name, about, profile_image }]  (was: bare names)
//   communities      [{ ...bridge row, profile_image }]          (community account's avatar)
//   communityTitles  { "portal-<id>": title }  every community the node lists
//   artworks         [...]  from the pixagram-search Worker, `artworksLoading` while in flight
//   posts            [...]  blog posts incl. community (portal) posts, same request as artworks
//   filters          the active filters (see filters.js)
//   filtersOpen      whether the filter panel is expanded
//
//   controls = { setFilters, toggleFilters, suggestAuthors, suggestCommunities }
//
// and `restore({ query, filters, panel })`, which puts the whole state back at
// once — how Index brings back a search from the address (+search-…).
//
// Two-phase delivery: chain results (users/tags/communities + their profiles)
// land as soon as the node answers; artworks and posts arrive in a second
// dispatch so a slow semantic query never holds the whole dropdown back. A
// filter change re-runs only the Worker request (the chain sections do not
// depend on filters); with an empty input and active filters the Worker
// browses, so filters work on their own. The dropdown is open while there is
// a term, an active filter, or the filter panel is expanded.

const EMPTY = Object.freeze([]);
const EMPTY_OBJ = Object.freeze({});

export const SEARCH_IDLE = Object.freeze({
    users: EMPTY, tags: EMPTY, communities: EMPTY, communityTitles: EMPTY_OBJ,
    artworks: EMPTY, posts: EMPTY,
    filters: EMPTY_FILTERS, filtersOpen: false,
    loading: false, artworksLoading: false,
});

function reducer(state, action) {
    switch (action.type) {
        case "loading":
            return { ...state, loading: true, artworksLoading: true };
        case "indexLoading":
            return state.artworksLoading ? state : { ...state, artworksLoading: true };
        case "chain":
            return { ...state, users: action.users, tags: action.tags, communities: action.communities, communityTitles: action.communityTitles, loading: false };
        case "index":
            return { ...state, artworks: action.artworks, posts: action.posts, artworksLoading: false };
        case "cached":
            return { ...state, ...action.results, loading: false, artworksLoading: false };
        case "filters":
            return { ...state, filters: action.filters };
        case "filtersOpen":
            return state.filtersOpen === action.open ? state : { ...state, filtersOpen: action.open };
        case "clear":
            // Nothing left to search (input emptied, last filter removed): the results
            // go, the panel and the filter state stay as the person left them.
            return { ...SEARCH_IDLE, filters: state.filters, filtersOpen: state.filtersOpen, communityTitles: state.communityTitles };
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
/** The dropdown is open while there is a term, an active filter, or the panel is out. */
const openFor = (query, filters, panel) => query.length > 0 || hasFilters(filters) || !!panel;
const imageOf = (p) => (p && typeof p.profile_image === "string" && p.profile_image ? p.profile_image : null);
const fresh = (entry) => (entry && Date.now() - entry._ts < CACHE_TTL_MS ? entry : null);
const remember = (cache, key, value) => {
    cache.set(key, { ...value, _ts: Date.now() });
    if (cache.size > CACHE_MAX_TERMS) cache.delete(cache.keys().next().value);
};

export function useSearch(apiRef) {
    const [query, setQuery] = useState("");
    const [results, dispatch] = useReducer(reducer, SEARCH_IDLE);
    const termRef = useRef("");                 // trimmed, lower-cased input
    const filtersRef = useRef(EMPTY_FILTERS);   // mirrors results.filters for the stable callbacks
    const filtersOpenRef = useRef(false);       // mirrors results.filtersOpen
    const debounceRef = useRef(null);
    const chainAbortRef = useRef(null);
    const indexAbortRef = useRef(null);
    const chainCacheRef = useRef(new Map());    // term → { users, tags, communities }
    const indexCacheRef = useRef(new Map());    // term \0 filters → { artworks, posts }
    // Trending tags are query-independent and filtered client-side: fetched
    // once per TTL, not once per term.
    const browseTagsRef = useRef(null);
    // Profiles are stable per account; keep them across terms so re-typing
    // does not re-pay get_accounts for the same people.
    const profilesRef = useRef(new Map());
    // Hivemind's community `query` is whole-word full-text search ("dev" does not
    // find "Development"). The ranked community list is small and query-independent,
    // so it is fetched once per TTL and matched client-side by substring on
    // title/name, merged after the server's own matches. It also names every
    // portal-<id> for the post rows and the community field of the filter panel.
    const browseCommunitiesRef = useRef(null);
    const titlesRef = useRef({ map: new Map(), obj: EMPTY_OBJ, dirty: false });

    const addTitles = useCallback((rows) => {
        const t = titlesRef.current;
        for (const c of rows) {
            if (c?.name && c.title && t.map.get(c.name) !== c.title) {
                t.map.set(c.name, c.title);
                t.dirty = true;
            }
        }
    }, []);
    const titlesObj = useCallback(() => {
        const t = titlesRef.current;
        if (t.dirty) {
            t.obj = Object.freeze(Object.fromEntries(t.map));
            t.dirty = false;
        }
        return t.obj;
    }, []);

    /** Profiles for `names`, cache-first; one get_accounts round-trip for the missing ones. */
    const profilesFor = useCallback(async (pixaAPI, names) => {
        const cache = profilesRef.current;
        const wanted = names.filter((n) => n && !cache.has(n));
        if (wanted.length) {
            const fetched = await fetchProfiles(pixaAPI, wanted);
            fetched.forEach((profile, name) => cache.set(name, profile));
            for (const n of wanted) if (!cache.has(n)) cache.set(n, {}); // negative cache: no re-fetch per keystroke
        }
        return cache;
    }, []);

    /** The ranked community list (cached per TTL); fills the title map as a side effect. */
    const communityList = useCallback(async (pixaAPI) => {
        const browse = browseCommunitiesRef.current;
        if (browse && Date.now() - browse._ts < CACHE_TTL_MS) return browse.communities;
        let rows = [];
        try {
            rows = await pixaAPI.communities.listCommunities({ limit: 100, sort: "rank" });
        } catch (e) {
            return browse ? browse.communities : EMPTY;
        }
        rows = Array.isArray(rows) ? rows : [];
        if (rows.length) {
            browseCommunitiesRef.current = { communities: rows, _ts: Date.now() };
            addTitles(rows);
        }
        return rows;
    }, [addTitles]);

    /** Users / tags / communities for a term, with profiles. */
    const chainSearch = useCallback(async (pixaAPI, trimmed, signal) => {
        const now = Date.now();
        const browse = browseTagsRef.current;
        const browseFresh = !!browse && now - browse._ts < CACHE_TTL_MS;
        // "@name" looks up accounts only, "#tag" tags only; a bare term does both.
        const userTerm = trimmed.startsWith("#") ? "" : trimmed.replace(/^@+/, "");
        const tagTerm = trimmed.startsWith("@") ? "" : trimmed.replace(/^#+/, "");

        const [usersRaw, tagsRaw, communitiesRaw, allCommunitiesRaw] = await Promise.allSettled([
            userTerm ? pixaAPI.accounts.lookupAccounts(userTerm, LIMITS.users) : EMPTY,
            browseFresh ? browse.tags : pixaAPI.tags.getTrendingTags(null, 100),
            // Server-side: `query` matches title/about on the bridge (whole words).
            pixaAPI.communities.listCommunities({ query: trimmed, limit: LIMITS.communities, sort: "rank" }),
            communityList(pixaAPI),
        ]);
        if (signal.aborted) return null;

        const usernames = userTerm && usersRaw.status === "fulfilled" && Array.isArray(usersRaw.value)
            ? usersRaw.value.filter((u) => typeof u === "string" && u.toLowerCase().includes(userTerm) && !COMMUNITY_ACCOUNT_RE.test(u))
            : [];
        const tagsAll = tagsRaw.status === "fulfilled" && Array.isArray(tagsRaw.value) ? tagsRaw.value : [];
        const serverCommunities = communitiesRaw.status === "fulfilled" && Array.isArray(communitiesRaw.value)
            ? communitiesRaw.value
            : [];
        const allCommunities = allCommunitiesRaw.status === "fulfilled" && Array.isArray(allCommunitiesRaw.value)
            ? allCommunitiesRaw.value
            : [];
        addTitles(serverCommunities);

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
        const tags = tagTerm
            ? tagsAll.filter((t) => t?.name && t.name.toLowerCase().includes(tagTerm)).slice(0, LIMITS.tags)
            : [];

        // Profiles for users AND communities (a community's picture is the
        // profile image of its account) in one round-trip, cache-first.
        const cache = await profilesFor(pixaAPI, usernames.concat(communityRows.map((c) => c.name)));
        if (signal.aborted) return null;

        const users = usernames.map((username) => {
            const p = cache.get(username) || {};
            return { username, name: str(p.name, 64), about: str(p.about, 160), profile_image: imageOf(p) };
        });
        const communities = communityRows.map((c) => ({ ...c, profile_image: imageOf(cache.get(c.name)) }));
        return { users, tags, communities };
    }, [addTitles, communityList, profilesFor]);

    /**
     * Run the search for `trimmed` + `filters`. `chain` also refreshes the
     * users/tags/communities sections (a filter change leaves them alone).
     */
    const runSearch = useCallback(async (trimmed, filters, chain) => {
        const pixaAPI = apiRef.current;
        if (!pixaAPI) {
            dispatch({ type: "clear" });
            return;
        }

        // Artwork + post search (one request) starts first and runs in parallel with the chain calls.
        if (indexAbortRef.current) indexAbortRef.current.abort();
        const indexCtl = new AbortController();
        indexAbortRef.current = indexCtl;
        const indexKey = trimmed + "\0" + filtersKey(filters);
        const indexCached = fresh(indexCacheRef.current.get(indexKey));
        const indexPromise = indexCached
            ? Promise.resolve(indexCached)
            : searchIndex(trimmed, { signal: indexCtl.signal, filters, limit: LIMITS.artworks, postsLimit: LIMITS.posts })
                .catch((e) => (e && e.name === "AbortError" ? null : { artworks: EMPTY, posts: EMPTY }));

        if (chain) {
            if (chainAbortRef.current) chainAbortRef.current.abort();
            const chainCtl = new AbortController();
            chainAbortRef.current = chainCtl;
            const chainCached = fresh(chainCacheRef.current.get(trimmed));
            if (chainCached) {
                dispatch({ type: "chain", users: chainCached.users, tags: chainCached.tags, communities: chainCached.communities, communityTitles: titlesObj() });
            } else if (!trimmed) {
                // Filters alone: no chain sections, but the community titles are still needed.
                await communityList(pixaAPI);
                if (!chainCtl.signal.aborted) dispatch({ type: "chain", users: EMPTY, tags: EMPTY, communities: EMPTY, communityTitles: titlesObj() });
            } else {
                let found = null;
                try {
                    found = await chainSearch(pixaAPI, trimmed, chainCtl.signal);
                } catch (e) {
                    if (!chainCtl.signal.aborted) console.warn("[search] chain search failed:", e && e.message);
                    found = chainCtl.signal.aborted ? null : { users: EMPTY, tags: EMPTY, communities: EMPTY };
                }
                if (found) {
                    dispatch({ type: "chain", ...found, communityTitles: titlesObj() });
                    remember(chainCacheRef.current, trimmed, found);
                }
            }
        }

        const index = await indexPromise;
        if (indexCtl.signal.aborted || index === null) return;
        dispatch({ type: "index", artworks: index.artworks, posts: index.posts });
        if (!indexCached) remember(indexCacheRef.current, indexKey, { artworks: index.artworks, posts: index.posts });
    }, [apiRef, chainSearch, communityList, titlesObj]);

    const abortAll = useCallback(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            debounceRef.current = null;
        }
        if (chainAbortRef.current) chainAbortRef.current.abort();
        if (indexAbortRef.current) indexAbortRef.current.abort();
    }, []);

    const handleChange = useCallback((e) => {
        const value = e.target.value;
        setQuery(value);
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            debounceRef.current = null;
        }

        const trimmed = value.trim().toLowerCase();
        termRef.current = trimmed;
        const filters = filtersRef.current;
        if (!trimmed && !hasFilters(filters)) {
            abortAll();
            dispatch({ type: "clear" });
            return;
        }
        if (!trimmed) {
            // Input cleared while filters are active: browse them right away.
            dispatch({ type: "indexLoading" });
            runSearch("", filters, true);
            return;
        }
        const chainCached = fresh(chainCacheRef.current.get(trimmed));
        const indexCached = fresh(indexCacheRef.current.get(trimmed + "\0" + filtersKey(filters)));
        if (chainCached && indexCached) {
            abortAll();
            dispatch({
                type: "cached",
                results: {
                    users: chainCached.users, tags: chainCached.tags, communities: chainCached.communities, communityTitles: titlesObj(),
                    artworks: indexCached.artworks, posts: indexCached.posts,
                },
            });
            return;
        }

        dispatch({ type: "loading" });
        debounceRef.current = setTimeout(() => {
            debounceRef.current = null;
            runSearch(trimmed, filtersRef.current, true);
        }, DEBOUNCE_MS);
    }, [abortAll, runSearch, titlesObj]);

    /**
     * Update the filters: a patch object or an updater (prev → next). Re-runs the
     * Worker request only; the input's own debounce is left alone.
     */
    const setFilters = useCallback((patch) => {
        const prev = filtersRef.current;
        const next = normalizeFilters(typeof patch === "function" ? patch(prev) : { ...prev, ...patch });
        filtersRef.current = next;
        dispatch({ type: "filters", filters: next });

        const trimmed = termRef.current;
        if (!trimmed && !hasFilters(next)) {
            // Nothing left to search: results go, the panel stays open.
            abortAll();
            dispatch({ type: "clear" });
            return;
        }
        if (filtersKey(next) === filtersKey(prev)) return; // e.g. colour mode switched with no colour picked
        if (debounceRef.current) return; // a search for the term being typed is pending: it runs with the new filters
        dispatch({ type: "indexLoading" });
        runSearch(trimmed, next, false);
    }, [abortAll, runSearch]);

    /** Expand / collapse the filter panel (`open` forces a state). */
    const toggleFilters = useCallback((open) => {
        const next = typeof open === "boolean" ? open : !filtersOpenRef.current;
        filtersOpenRef.current = next;
        dispatch({ type: "filtersOpen", open: next });
    }, []);

    /** Account suggestions for the author field: prefix lookup + profile pictures. */
    const suggestAuthors = useCallback(async (text) => {
        const pixaAPI = apiRef.current;
        const q = String(text || "").trim().toLowerCase().replace(/^@+/, "");
        if (!q || !pixaAPI?.accounts?.lookupAccounts) return EMPTY;
        let names;
        try {
            names = await pixaAPI.accounts.lookupAccounts(q, SUGGEST_LIMIT + 4);
        } catch (e) {
            return EMPTY;
        }
        names = (Array.isArray(names) ? names : [])
            .filter((n) => typeof n === "string" && n.startsWith(q) && !COMMUNITY_ACCOUNT_RE.test(n))
            .slice(0, SUGGEST_LIMIT);
        const cache = await profilesFor(pixaAPI, names);
        return names.map((n) => {
            const p = cache.get(n) || {};
            return { key: n, label: "@" + n, sub: str(p.name, 48), image: imageOf(p) };
        });
    }, [apiRef, profilesFor]);

    /** Community suggestions by real name (title), ranked list + the node's own search. */
    const suggestCommunities = useCallback(async (text) => {
        const pixaAPI = apiRef.current;
        if (!pixaAPI?.communities?.listCommunities) return EMPTY;
        const q = String(text || "").trim().toLowerCase();
        const [ranked, server] = await Promise.all([
            communityList(pixaAPI),
            q.length >= 2
                ? Promise.resolve(pixaAPI.communities.listCommunities({ query: q, limit: SUGGEST_LIMIT, sort: "rank" })).catch(() => EMPTY)
                : EMPTY,
        ]);
        const serverRows = Array.isArray(server) ? server : EMPTY;
        addTitles(serverRows);
        const seen = new Set();
        const rows = [];
        const take = (c, matchRequired) => {
            if (!c?.name || seen.has(c.name) || rows.length >= SUGGEST_LIMIT) return;
            if (matchRequired && q) {
                const title = String(c.title || "").toLowerCase();
                if (!title.includes(q) && !c.name.toLowerCase().includes(q)) return;
            }
            seen.add(c.name);
            rows.push(c);
        };
        // Substring matches on the title first (what people type), then the node's
        // whole-word matches (which also cover the description).
        for (const c of ranked) take(c, true);
        for (const c of serverRows) take(c, false);
        const cache = await profilesFor(pixaAPI, rows.map((c) => c.name));
        return rows.map((c) => ({
            key: c.name,
            label: c.title || c.name,
            subscribers: Number(c.subscribers) || 0, // worded by the panel (words.subscribers_count)
            image: imageOf(cache.get(c.name)),
        }));
    }, [apiRef, addTitles, communityList, profilesFor]);

    const controls = useMemo(
        () => Object.freeze({ setFilters, toggleFilters, suggestAuthors, suggestCommunities }),
        [setFilters, toggleFilters, suggestAuthors, suggestCommunities],
    );

    const reset = useCallback(() => {
        abortAll();
        termRef.current = "";
        filtersRef.current = EMPTY_FILTERS;
        filtersOpenRef.current = false;
        setQuery("");
        dispatch({ type: "reset" });
    }, [abortAll]);

    /**
     * Put the search in a given state in one go — the address's +search-… (a
     * reload, the back arrow, a shared link): query, filters and panel, then
     * the search itself, with no debounce since nobody is typing. The filters
     * are URL input, so they go through normalizeFilters. Returns the state it
     * put in place — { query, filters, panel, open } — which is not always
     * what was asked for (junk filters normalize away; a search left with
     * nothing to show is not open at all).
     */
    const restore = useCallback(({ query: text, filters, panel } = {}) => {
        abortAll();
        const value = typeof text === "string" ? text : "";
        const next = normalizeFilters(filters);
        const out = !!panel;
        const trimmed = value.trim().toLowerCase();
        termRef.current = trimmed;
        filtersRef.current = next;
        filtersOpenRef.current = out;
        setQuery(value);
        dispatch({ type: "filters", filters: next });
        dispatch({ type: "filtersOpen", open: out });
        const restored = { query: value, filters: next, panel: out, open: openFor(value, next, out) };
        if (!trimmed && !hasFilters(next)) {
            dispatch({ type: "clear" });
            return restored;
        }
        dispatch({ type: trimmed ? "loading" : "indexLoading" });
        runSearch(trimmed, next, true);
        return restored;
    }, [abortAll, runSearch]);

    useEffect(() => () => {
        abortAll();
        chainCacheRef.current.clear();
        indexCacheRef.current.clear();
        profilesRef.current.clear();
        browseTagsRef.current = null;
        browseCommunitiesRef.current = null;
    }, [abortAll]);

    return {
        query,
        results,
        handleChange,
        reset,
        restore,
        controls,
        setFilters,
        isOpen: openFor(query, results.filters, results.filtersOpen),
    };
}
