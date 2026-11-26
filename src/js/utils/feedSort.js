// ── Feed sort memory ───────────────────────────────────────────────────
// The sort a tag link opens on: DEFAULT_FEED_SORT (trending) until the reader
// picks another one on the feed, then that one. Feed's sort tabs write the
// sort into the address (HISTORY.replace("/hot/<tag>/")), so following the
// address is all it takes: the sort of the last feed address shown is the one
// kept, whether it got there by a tab, a link or the back/forward arrows. A
// tag link then changes the tag and keeps the sort.
//
// Every tag link builds its path here — the drawer's tag chips and its home
// chip (MenuContent), the search's tag rows and history entries (Index's
// goToTag / setTagNavigation), the post dialog's tag chips — and Feed falls
// back on it for an address that names no sort (a post deep-link).
//
// Kept in memory, for the visit: a fresh load starts on trending, unless the
// address it loads is itself a sorted feed (a shared "/hot/gaming" link).
// Only the feed counts: a community's own sort tabs, a profile or a post
// leave the kept sort as it was. The landing page's Browse button always
// enters on trending (BROWSE_PATH), and the kept sort follows it there.
//
// Tag links are real links (utils/link): what a click pushes is also printed
// in the element's href, at render. A component that shows one calls
// useFeedSort() so the href follows the kept sort when it changes — the click
// itself reads the sort as it always did, when it happens.

import { useEffect, useState } from "preact/hooks";
import { HISTORY, PAGE_ROUTES, DEFAULT_FEED_SORT, splitMetaPath } from "./constants";

// The router's own feed route. Its first capture is the sort, so the sorts
// kept here are exactly the ones a feed address can route with.
const FEED_ROUTE = PAGE_ROUTES.find((route) => route.page_name === "feed");

/** The sort of a feed address ("/hot/gaming/+settings" → "hot"); null for any other address. */
export function feedSortOf(pathname) {
    if (!FEED_ROUTE) return null;
    const match = FEED_ROUTE.page_regex.exec(splitMetaPath(pathname).path);
    return match ? match[1] : null;
}

let current = feedSortOf(HISTORY.location.pathname) || DEFAULT_FEED_SORT;

// The components showing a tag link (useFeedSort): told when the sort changes.
const watchers = new Set();

// For the app's lifetime: push, replace and the back/forward arrows alike.
HISTORY.listen(({ location }) => {
    const sort = feedSortOf(location.pathname);
    if (!sort || sort === current) return;
    current = sort;
    watchers.forEach((notify) => notify(sort));
});

/** The sort a tag link opens on now. */
export function getFeedSort() {
    return current;
}

/**
 * The kept sort, as state: re-renders the caller when it changes, so the
 * href it builds with feedTagPath() stays the address a click would push.
 */
export function useFeedSort() {
    const [sort, setSort] = useState(current);
    useEffect(() => {
        setSort(current); // it may have moved between the render and this effect
        watchers.add(setSort);
        return () => { watchers.delete(setSort); };
    }, []);
    return sort;
}

/**
 * The feed address of `tag` in the kept sort: "/hot/gaming", or "/hot/" with
 * no tag (the drawer's home chip). The tag is taken as callers hold it —
 * "#gaming", "gaming", "/gaming" (a feed route capture) — and normalised.
 */
export function feedTagPath(tag) {
    const name = String(tag == null ? "" : tag).replace(/[#\/]/g, "").trim().toLowerCase();
    return "/" + current + "/" + name;
}
