"use strict";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "preact/compat";

import { CACHE_MAX_TERMS, CACHE_TTL_MS, COMMUNITY_ACCOUNT_RE, DEBOUNCE_MS, LIMITS, SUGGEST_DEBOUNCE_MS, SUGGEST_LIMIT, SUGGEST_ROWS } from "./config";
import { EMPTY_FILTERS, filtersKey, hasFilters, normalizeFilters } from "./filters";
import { fetchAnswer, fetchSuggestions, loadExamples, searchIndex, sendFeedback } from "./searchApi";
import { answerPlan, ghostFor } from "./intent";

// ── useSearch ─────────────────────────────────────────────────────────────────
// Replaces Index's useBlockchainSearch with the same contract
//   { query, results, handleChange, reset, isOpen }
// plus `controls` (one stable object for the filter UI and the box) and these
// additions inside `results`:
//   users            [{ username, name, about, profile_image }]  (was: bare names)
//   communities      [{ ...bridge row, profile_image }]          (community account's avatar)
//   communityTitles  { "portal-<id>": title }  every community the node lists
//   artworks         [...]  from the pixagram-search Worker, `artworksLoading` while in flight
//   posts            [...]  blog posts incl. community (portal) posts, same request as artworks
//   filters          the active filters (see filters.js)
//   filtersOpen      whether the filter panel is expanded
// and, from the v3 Worker:
//   suggest          { q, completion, items } what it proposes for the text typed
//                    (completions, questions, titles, documentation sections,
//                    popular searches, a correction); null when nothing
//   answer           an answer to the question typed: { q, route, loading: true }
//                    while it comes, then { q, route, loading: false, data }
//                    (data: see searchApi.fetchAnswer); null when none
//   didYouMean       { text, term }: the search for `term` (trimmed, lower case)
//                    corrected a word into `text`; null when not
//   examples         examples for the placeholder, in the UI language (kept
//                    across resets)
//
//   controls = { setFilters, toggleFilters, suggestAuthors, suggestCommunities,
//                applyText(text), pickSuggestion(s), acceptCompletion(),
//                submit(), feedback(item, action) }
//
// useSearch(apiRef, { lang }) — `lang` is the UI language (two letters): the
// examples and the suggestions' questions come in it. Without it (settings
// not loaded yet) the examples wait.
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
//
// Three paces: suggestions at every short pause (SUGGEST_DEBOUNCE_MS, cheap),
// the search at the usual one (DEBOUNCE_MS), an answer only for a finished
// question or on Enter (intent.answerPlan: answers spend a small budget). A
// picked suggestion runs at once and hides the suggestions until the next
// keystroke; an answer always belongs to the text it answers.

const EMPTY = Object.freeze([]);
const EMPTY_OBJ = Object.freeze({});

export const SEARCH_IDLE = Object.freeze({
    users: EMPTY, tags: EMPTY, communities: EMPTY, communityTitles: EMPTY_OBJ,
    artworks: EMPTY, posts: EMPTY,
    filters: EMPTY_FILTERS, filtersOpen: false,
    loading: false, artworksLoading: false,
    suggest: null, answer: null, didYouMean: null, examples: EMPTY,
});

function reducer(state, action) {
    switch (action.type) {
        case "loading":
            // a new text: the correction of the previous one goes with it
            return { ...state, loading: true, artworksLoading: true, didYouMean: null };
        case "indexLoading":
            return state.artworksLoading ? state : { ...state, artworksLoading: true };
        case "chain":
            return { ...state, users: action.users, tags: action.tags, communities: action.communities, communityTitles: action.communityTitles, loading: false };
        case "index":
            return {
                ...state, artworks: action.artworks, posts: action.posts, artworksLoading: false,
                didYouMean: action.didYouMean ? Object.freeze({ text: action.didYouMean, term: action.term }) : null,
            };
        case "cached":
            return { ...state, ...action.results, loading: false, artworksLoading: false };
        case "filters":
            return { ...state, filters: action.filters };
        case "filtersOpen":
            return state.filtersOpen === action.open ? state : { ...state, filtersOpen: action.open };
        case "suggest":
            return state.suggest === action.suggest ? state : { ...state, suggest: action.suggest };
        case "answer":
            return state.answer === action.answer ? state : { ...state, answer: action.answer };
        case "examples":
            return state.examples === action.examples ? state : { ...state, examples: action.examples };
        case "clear":
            // Nothing left to search (input emptied, last filter removed): the results
            // go, the panel and the filter state stay as the person left them.
            return { ...SEARCH_IDLE, filters: state.filters, filtersOpen: state.filtersOpen, communityTitles: state.communityTitles, examples: state.examples };
        case "reset":
            return { ...SEARCH_IDLE, examples: state.examples };
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

export function useSearch(apiRef, { lang = null } = {}) {
    const [query, setQuery] = useState("");
    const [results, dispatch] = useReducer(reducer, SEARCH_IDLE);
    const queryRef = useRef("");                // the input as typed (for the stable callbacks)
    const suggestRef = useRef(null);            // mirrors results.suggest
    suggestRef.current = results.suggest;
    const answerRef = useRef(null);             // mirrors results.answer
    answerRef.current = results.answer;
    const langRef = useRef(lang);
    langRef.current = lang;
    const termRef = useRef("");                 // trimmed, lower-cased input
    const filtersRef = useRef(EMPTY_FILTERS);   // mirrors results.filters for the stable callbacks
    const filtersOpenRef = useRef(false);       // mirrors results.filtersOpen
    const debounceRef = useRef(null);
    const chainAbortRef = useRef(null);
    const indexAbortRef = useRef(null);
    const chainCacheRef = useRef(new Map());    // term → { users, tags, communities }
    const indexCacheRef = useRef(new Map());    // term \0 filters → { artworks, posts, didYouMean }
    // v3: what the Worker proposes while typing, and answers to questions
    const suggestTimerRef = useRef(null);
    const suggestAbortRef = useRef(null);
    const suggestCacheRef = useRef(new Map());  // lang \0 text → { value }
    const answerTimerRef = useRef(null);
    const answerPendingRef = useRef(null);      // the key of the answer the timer waits to ask
    const answerAbortRef = useRef(null);
    const answerCacheRef = useRef(new Map());   // route \0 question \0 type → { value }
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
        // A portal-<id> in the trending list is a community (its posts carry it as their
        // first tag), not a tag: the Communities section covers it, so it never shows here.
        const tags = tagTerm
            ? tagsAll.filter((t) => {
                const name = t?.name ? String(t.name).toLowerCase() : "";
                return !!name && !COMMUNITY_ACCOUNT_RE.test(name) && name.includes(tagTerm);
            }).slice(0, LIMITS.tags)
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
        dispatch({ type: "index", artworks: index.artworks, posts: index.posts, didYouMean: index.didYouMean, term: trimmed });
        if (!indexCached) remember(indexCacheRef.current, indexKey, { artworks: index.artworks, posts: index.posts, didYouMean: index.didYouMean || null });
    }, [apiRef, chainSearch, communityList, titlesObj]);

    /** The search's own debounce and requests (suggestions and answers have theirs). */
    const abortSearch = useCallback(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            debounceRef.current = null;
        }
        if (chainAbortRef.current) chainAbortRef.current.abort();
        if (indexAbortRef.current) indexAbortRef.current.abort();
    }, []);

    /** Stop asking for suggestions; `clear` also takes the ones shown away. */
    const cancelSuggest = useCallback((clear) => {
        if (suggestTimerRef.current) {
            clearTimeout(suggestTimerRef.current);
            suggestTimerRef.current = null;
        }
        if (suggestAbortRef.current) {
            suggestAbortRef.current.abort();
            suggestAbortRef.current = null;
        }
        if (clear) dispatch({ type: "suggest", suggest: null });
    }, []);

    /** Stop asking for an answer; `clear` also takes the one shown away. */
    const cancelAnswer = useCallback((clear) => {
        if (answerTimerRef.current) {
            clearTimeout(answerTimerRef.current);
            answerTimerRef.current = null;
        }
        answerPendingRef.current = null;
        if (answerAbortRef.current) {
            answerAbortRef.current.abort();
            answerAbortRef.current = null;
        }
        if (clear) dispatch({ type: "answer", answer: null });
    }, []);

    const abortAll = useCallback(() => {
        abortSearch();
        cancelSuggest(false);
        cancelAnswer(false);
    }, [abortSearch, cancelSuggest, cancelAnswer]);

    /**
     * Ask the Worker what the text typed may become, after a short pause. The
     * suggestions shown stay until new ones land (no flicker while typing); a
     * text of one letter, or one starting with @ or # (their own sections
     * cover those), has none.
     */
    const scheduleSuggest = useCallback((value) => {
        cancelSuggest(false);
        const text = String(value || "").replace(/^\s+/, "");
        const lang = langRef.current;
        if (text.trim().length < 2 || /^[@#]/.test(text)) {
            dispatch({ type: "suggest", suggest: null });
            return;
        }
        const key = (lang || "") + "\0" + text;
        const hit = fresh(suggestCacheRef.current.get(key));
        if (hit) {
            dispatch({ type: "suggest", suggest: hit.value });
            return;
        }
        suggestTimerRef.current = setTimeout(async () => {
            suggestTimerRef.current = null;
            const ctl = new AbortController();
            suggestAbortRef.current = ctl;
            let r = null;
            try {
                r = await fetchSuggestions(text, { signal: ctl.signal, lang });
            } catch (e) {
                if (e && e.name === "AbortError") return;
            }
            if (ctl.signal.aborted) return;
            suggestAbortRef.current = null;
            const value = r && (r.items.length || r.completion)
                ? Object.freeze({ q: text, completion: r.completion, items: Object.freeze(r.items.slice(0, SUGGEST_ROWS)) })
                : null;
            if (r) remember(suggestCacheRef.current, key, { value }); // a failure is not remembered
            dispatch({ type: "suggest", suggest: value });
        }, SUGGEST_DEBOUNCE_MS);
    }, [cancelSuggest]);

    /**
     * An answer for the text, when it is a question (intent.answerPlan): after
     * a pause while typing, at once on Enter, a pick or a restore. `forced`
     * ({ route, q }) comes from a picked suggestion: its route and its query.
     * Whatever answered another text goes at once.
     */
    const scheduleAnswer = useCallback((value, how, forced) => {
        const text = String(value || "").trim();
        const plan = forced ? { route: forced.route, q: forced.q, delay: 0 } : answerPlan(text, how === "type" ? "type" : "submit");
        const type = filtersRef.current && filtersRef.current.type ? filtersRef.current.type : "";
        const key = plan ? (plan.route || "auto") + "\0" + plan.q + "\0" + type : null;
        if (key) {
            // The same question (a space added, Enter on it): what it has stays — shown, on its
            // way, or waiting for its pause (only Enter hurries that one). A request stopped
            // meanwhile (a reset, a restore) is asked again.
            const cur = answerRef.current;
            if (cur && cur.key === key && (!cur.loading || answerAbortRef.current)) return;
            if (answerPendingRef.current === key && plan.delay > 0) return;
        }
        cancelAnswer(false);
        if (!plan) {
            dispatch({ type: "answer", answer: null });
            return;
        }
        const hit = fresh(answerCacheRef.current.get(key));
        if (hit) {
            dispatch({ type: "answer", answer: hit.value ? Object.freeze({ q: text, key, route: hit.value.route, loading: false, data: hit.value }) : null });
            return;
        }
        dispatch({ type: "answer", answer: null });
        const run = async () => {
            answerTimerRef.current = null;
            answerPendingRef.current = null;
            const ctl = new AbortController();
            answerAbortRef.current = ctl;
            dispatch({ type: "answer", answer: Object.freeze({ q: text, key, route: plan.route, loading: true }) });
            let data = null;
            try {
                data = await fetchAnswer(plan.q, { signal: ctl.signal, route: plan.route, filters: filtersRef.current });
            } catch (e) {
                if (e && e.name === "AbortError") return;
            }
            if (ctl.signal.aborted) return;
            answerAbortRef.current = null;
            // An answer, or documentation pages that match; a plain search verdict adds nothing.
            const shown = data && (data.route !== "search" || data.links.length > 0) ? Object.freeze(data) : null;
            // a failure, or a refusal of the answer budget, is not remembered: the next try asks again
            if (data && !data.retry) remember(answerCacheRef.current, key, { value: shown });
            dispatch({ type: "answer", answer: shown ? Object.freeze({ q: text, key, route: shown.route, loading: false, data: shown }) : null });
        };
        if (plan.delay > 0) {
            answerPendingRef.current = key;
            answerTimerRef.current = setTimeout(run, plan.delay);
        } else run();
    }, [cancelAnswer]);

    /**
     * The text changed: typed (`how` = "type": the usual pauses) or put in by
     * the box itself ("pick": a suggestion, an example, a correction — the
     * search runs at once and the suggestions go until the next keystroke).
     */
    const changeText = useCallback((value, how, forced) => {
        queryRef.current = value;
        setQuery(value);
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            debounceRef.current = null;
        }
        if (how === "type") scheduleSuggest(value);
        else cancelSuggest(true);
        scheduleAnswer(value, how, forced);

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
            abortSearch();
            dispatch({
                type: "cached",
                results: {
                    users: chainCached.users, tags: chainCached.tags, communities: chainCached.communities, communityTitles: titlesObj(),
                    artworks: indexCached.artworks, posts: indexCached.posts,
                    didYouMean: indexCached.didYouMean ? Object.freeze({ text: indexCached.didYouMean, term: trimmed }) : null,
                },
            });
            return;
        }

        dispatch({ type: "loading" });
        if (how !== "type") {
            runSearch(trimmed, filters, true);
            return;
        }
        debounceRef.current = setTimeout(() => {
            debounceRef.current = null;
            runSearch(trimmed, filtersRef.current, true);
        }, DEBOUNCE_MS);
    }, [abortAll, abortSearch, cancelSuggest, runSearch, scheduleAnswer, scheduleSuggest, titlesObj]);

    const handleChange = useCallback((e) => changeText(e.target.value, "type"), [changeText]);

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

    // ── v3: the box's own actions ──

    /** Put a text in the box and search it at once (an example, a correction). */
    const applyText = useCallback((text, how = "pick") => {
        changeText(String(text == null ? "" : text), how === "type" ? "type" : "pick");
    }, [changeText]);

    /**
     * A suggestion picked: its text in the box, searched at once; a question
     * also asks for its answer (to /ask, or a documentation section to /help).
     * A title with its post is opened by the dropdown itself.
     */
    const pickSuggestion = useCallback((s) => {
        if (!s || typeof s.text !== "string" || !s.text) return;
        if (s.route === "ask" || s.route === "help") changeText(s.text, "pick", { route: s.route, q: s.query || s.text });
        else changeText(s.text, "pick");
    }, [changeText]);

    /** Take the ghost text (Tab, →): as if typed, so the next word can follow. Returns whether there was one. */
    const acceptCompletion = useCallback(() => {
        const value = queryRef.current;
        const s = suggestRef.current;
        const ghost = ghostFor(value, s && s.completion);
        if (!ghost) return false;
        changeText(value + ghost, "type");
        return true;
    }, [changeText]);

    /** Enter: search now (no pause left to wait), answer a question now, done with suggestions. */
    const submit = useCallback(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            debounceRef.current = null;
            runSearch(termRef.current, filtersRef.current, true);
        }
        cancelSuggest(true);
        scheduleAnswer(queryRef.current, "submit");
    }, [cancelSuggest, runSearch, scheduleAnswer]);

    /** A result was opened: tell the Worker (its ranker learns from it). */
    const feedback = useCallback((item, action = "click") => sendFeedback(item, action), []);

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
        () => Object.freeze({
            setFilters, toggleFilters, suggestAuthors, suggestCommunities,
            applyText, pickSuggestion, acceptCompletion, submit, feedback,
        }),
        [setFilters, toggleFilters, suggestAuthors, suggestCommunities, applyText, pickSuggestion, acceptCompletion, submit, feedback],
    );

    const reset = useCallback(() => {
        abortAll();
        termRef.current = "";
        queryRef.current = "";
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
        queryRef.current = value;
        filtersRef.current = next;
        filtersOpenRef.current = out;
        setQuery(value);
        dispatch({ type: "filters", filters: next });
        dispatch({ type: "filtersOpen", open: out });
        // Nobody is typing: no suggestions; a question gets its answer at once.
        dispatch({ type: "suggest", suggest: null });
        const restored = { query: value, filters: next, panel: out, open: openFor(value, next, out) };
        if (!trimmed && !hasFilters(next)) {
            dispatch({ type: "clear" });
            return restored;
        }
        scheduleAnswer(value, "submit");
        dispatch({ type: trimmed ? "loading" : "indexLoading" });
        runSearch(trimmed, next, true);
        return restored;
    }, [abortAll, runSearch, scheduleAnswer]);

    // Examples for the placeholder, once per UI language (the Worker's, else built-in ones).
    // When the Worker could not give any, the built-in ones show, and it is asked again a minute
    // later (three times at most).
    useEffect(() => {
        if (!lang) return undefined;
        let live = true;
        let timer = 0;
        const load = (tries) => {
            loadExamples(lang).then((examples) => {
                if (!live) return;
                dispatch({ type: "examples", examples });
                if (examples.fallback && tries < 3) timer = setTimeout(() => load(tries + 1), 60_000);
            });
        };
        load(0);
        return () => {
            live = false;
            clearTimeout(timer);
        };
    }, [lang]);

    useEffect(() => () => {
        abortAll();
        chainCacheRef.current.clear();
        indexCacheRef.current.clear();
        suggestCacheRef.current.clear();
        answerCacheRef.current.clear();
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