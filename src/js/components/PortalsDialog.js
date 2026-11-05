// ============================================================================
// PortalsDialog.js — the portal directory ("+portals")
// ----------------------------------------------------------------------------
// Every portal (on-chain community) in one place: a search box with the
// Create button beside it, then the portals the bridge lists, page after page
// as the reader scrolls. Desktop shows them as a grid of cards, phones as a
// list; both lay a portal out the same way — its picture on the left with
// the week's post count in a badge on it, the title and description on the
// right, then a row of member faces closed by a "+N" tile for the rest of
// the members (see "Member faces"). Three ways in, all through the
// "+portals" address suffix, so the
// directory deep-links and the back arrow closes it (utils/constants, "Meta
// overlays"):
//   · the desktop toolbar's Portals button, between Ask Help and Governance
//   · the compact ⋮ menu's Portals entry (ToolbarMenuOption)
//   · the drawer's "See all portals" row, under Trending Portals (MenuContent)
//
// Mounted by pages/Index.js at the shell (usePortalsOverlay, §8e), NOT in
// the single dialog slot: creating a portal (the Create button opens
// CreateCommunityDialog over the directory) broadcasts with the creator's
// active key, and the PIN / add-key prompt asking for it opens in the slot —
// a directory living there would be swapped out at the first broadcast,
// Create dialog, progress and all. Out at the shell the prompt stacks above.
//
// Data
//   · bridge.list_communities through api.communities.listCommunities —
//     sorted by rank, PAGE_SIZE per page, `last` as the cursor, `query` for
//     the search — paged by utils/api/paged-list (PagedLoader.loadMore()):
//     one page each time the end of the list comes within PREFETCH_PX.
//   · The bridge's `query` matches whole words of the title and about. A
//     search also gets (a) the portal itself when the box holds a full id
//     ("portal-123456": a portal too new to be ranked is in no rank-sorted
//     listing) and (b) the ranked portals whose title or id CONTAINS the
//     text, from one ranked pass of up to POOL_MAX portals — the toolbar
//     search's recipe (components/search/useSearch). They come after the
//     bridge's matches, once its listing has ended, so the list never
//     reshuffles under the reader.
//   · The official governance portals (PROPOSALS_PORTAL, COMMUNITY_PORTALS in
//     utils/constants) are never listed, searched for or not: the drawer's
//     governance grid and the Governance dialog are their place, and the
//     drawer's Trending Portals leaves them out the same way (MenuContent's
//     GOVERNANCE_PORTAL_IDS). Nor are empty portals, those without a name
//     and a description (isDescribed): a portal never given a title carries
//     "@portal-…", its own id. A page that held some just shows fewer cards.
//   · A portal's picture is the profile image of its account — this chain's
//     bridge carries no avatar_url (components/search/CommunityResult) —
//     fetched with one get_accounts per page, as MenuContent does.
//   · The counts: `subscribers` (members) and `num_pending`, the bridge's
//     posts still inside their 7-day payout window — the posts of the last
//     week, the badge's figure (none on a quiet week).
//     bridge.list_communities carries no all-time post total.
//   · The member faces: bridge.list_subscribers, and for a signed-in reader
//     condenser_api.get_following — see MemberPreviewStore.
//   · listCommunities answers [] when the node fails (it never throws), so
//     an empty unfiltered first page reads "nothing to show right now" with
//     a Retry — never a confident "there are no portals". A listing that did
//     answer, with official or empty portals only, says "nothing to show"
//     alone.
// ============================================================================

import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import { useTheme } from "@material-ui/core/styles";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import Dialog from "@material-ui/core/Dialog";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import Button from "@material-ui/core/Button";
import ButtonBase from "@material-ui/core/ButtonBase";
import InputBase from "@material-ui/core/InputBase";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemAvatar from "@material-ui/core/ListItemAvatar";
import Avatar from "@material-ui/core/Avatar";
import Badge from "@material-ui/core/Badge";
import CircularProgress from "@material-ui/core/CircularProgress";
import Skeleton from "@material-ui/lab/Skeleton";
import CloseRounded from "@material-ui/icons/CloseRounded";
import SearchRounded from "@material-ui/icons/SearchRounded";
import AddRounded from "@material-ui/icons/AddRounded";
import CommunityIcon from "../icons/Community";

import * as actions from "../actions/utils";
import dispatcher from "../dispatcher";
import { PagedLoader } from "../utils/api/paged-list";
import { getProfiles } from "../utils/api/account-cache";
import { HISTORY, COMMUNITY_TAG_REGEX, PROPOSALS_PORTAL, COMMUNITY_PORTALS } from "../utils/constants";
import { formatCompact, formatInteger } from "../utils/numberFormat";
import { t, useLanguage } from "../utils/text";

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ============================================================================
// Constants
// ============================================================================

// Portals per bridge page (the bridge allows 100). 36 fills 2, 3 or 4 grid
// columns evenly, and is tall enough that a desktop screen does not reach
// the prefetch margin before the reader scrolls.
const PAGE_SIZE = 36;
const POOL_PAGE = 100;           // the ranked pass behind a search's substring matches…
const POOL_MAX = 500;            // …and how far it reads
const SEARCH_DEBOUNCE_MS = 300;  // one bridge query per typing pause
const QUERY_MAX = 64;            // characters a search keeps
const PREFETCH_PX = 640;         // the next page loads while the end is this far away
const SKELETON_CARDS = 9;
const SKELETON_ROWS = 8;

// Member faces (see MemberPreviewStore)
const MEMBER_FACES = 7;          // faces in a row at most
const MEMBER_PAGE = 100;         // bridge.list_subscribers' page ceiling
const MEMBER_SCAN_MAX = 500;     // signed in: members checked against the follows, per portal
const FOLLOWING_MAX = 1000;      // follows read (MembersListDialog's ceiling)
const PREVIEW_PARALLEL = 4;      // portals looked into at once
const POSTS_BADGE_MAX = 99;      // the badge reads "99+" beyond

const EMPTY = Object.freeze([]);
const NO_IMAGES = new Map();

// CreateCommunityDialog's _creation_phase values while its broadcasts run —
// "done" being the 700 ms before it navigates to the new portal itself. A
// back arrow then leaves both dialogs up (see the close guard below).
const CREATING_PHASES = new Set(["creating", "delegating", "admin", "configuring", "indexing", "done"]);

// Chunk of the Create dialog: loaded on the first Create, then kept mounted
// (Profile hosts it the same way).
const LazyCreateCommunityDialog = React.lazy(() => import("./CreateCommunityDialog"));
const CREATE_FALLBACK = (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1300 }} />
);

// ── Hoisted props (stable identity across renders) ─────────────────────────
const SEARCH_INPUT_PROPS = Object.freeze({
    maxLength: QUERY_MAX,
    spellCheck: false,
    autoComplete: "off",
    autoCapitalize: "off",
    enterKeyHint: "search",
});
const BADGE_ANCHOR = Object.freeze({ vertical: "top", horizontal: "right" });
const SKELETON_TITLE_STYLE = Object.freeze({ marginBottom: 2 });
const SKELETON_IMAGE_STYLE = Object.freeze({ borderRadius: 14, flexShrink: 0 });
const SKELETON_ROW_IMAGE_STYLE = Object.freeze({ borderRadius: 12, flexShrink: 0 });
const SKELETON_ROW_TEXT_STYLE = Object.freeze({ flex: 1, minWidth: 0 });

// ============================================================================
// Helpers
// ============================================================================

// The paging cursor and dedup key: the chain name, whatever it holds.
const keyOf = (c) => (c && typeof c.name === "string" && c.name) || null;
// Only a portal-<id> routes to a portal page (PAGE_ROUTES' community route):
// a row without one has nowhere to link and is not shown.
const isPortal = (c) => !!c && typeof c.name === "string" && COMMUNITY_TAG_REGEX.test(c.name);
// The official governance portals, never listed here (see the header).
const OFFICIAL_PORTAL_IDS = new Set([PROPOSALS_PORTAL, ...COMMUNITY_PORTALS].map((p) => p.id));
// A listed portal has a name and a description: a title of its own — an
// untitled portal's title is "@portal-…", its id — and an about line.
const textOf = (v) => (typeof v === "string" ? v.trim() : "");
const isDescribed = (c) => {
    const title = textOf(c.title);
    return !!title && title !== c.name && title !== "@" + c.name && !!textOf(c.about);
};
const isListed = (c) => isPortal(c) && !OFFICIAL_PORTAL_IDS.has(c.name) && isDescribed(c);
const countOf = (v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

// "1,234 members" / "1 234 membres": the grouping follows the reader's locale
// (utils/numberFormat), the noun the count (the catalogue's plural forms).
const membersLabel = (n) => t("components.portals_dialog.member_count", { count: formatInteger(n), member: { member: n } });
const postsLabel = (n) => t("components.portals_dialog.posts_this_week", { count: formatInteger(n), post: { post: n } });

// The account the Create button acts for, or null when logged out.
async function activeAccount(api) {
    const sm = api && api.sessionManager;
    if (!sm) return null;
    try {
        return sm.currentAccount || (typeof sm.getActiveAccount === "function" ? await sm.getActiveAccount() : null) || null;
    } catch (e) {
        return null;
    }
}

// "+portals" again, after the log-in a logged-out Create asked for: the
// log-in replaced the directory's suffix in the address, its success puts it
// back (the META event — Index.js's way to open any overlay by its meta).
function reopenDirectory() {
    if (dispatcher.isDispatching()) { setTimeout(reopenDirectory, 10); return; }
    dispatcher.dispatch({ type: "META", data: { kind: "portals" } });
}

// The ranked pass a search's substring matches come from. Read once per
// directory visit (and again only after a pass that came back empty).
function loadRankedPool(api) {
    const loader = new PagedLoader({
        limit: POOL_PAGE,
        maxItems: POOL_MAX,
        itemKey: keyOf,
        fetchPage: (cursor, limit) => api.communities.listCommunities(
            cursor ? { sort: "rank", limit, last: cursor } : { sort: "rank", limit }
        ),
    });
    return loader.start().catch(() => EMPTY);
}

// What a search adds to the bridge's whole-word matches: the portal named by
// a full id, then the ranked portals whose title or id contains the text.
// (An official portal's id is not looked up: it would not be listed.)
async function findExtras(api, query, poolPromise) {
    const q = query.toLowerCase();
    const byId = COMMUNITY_TAG_REGEX.test(q) && !OFFICIAL_PORTAL_IDS.has(q) && typeof api.communities.getCommunity === "function"
        ? Promise.resolve(api.communities.getCommunity(q)).catch(() => null)
        : Promise.resolve(null);
    const [exact, pool] = await Promise.all([byId, Promise.resolve(poolPromise).catch(() => EMPTY)]);
    const out = [];
    const seen = new Set();
    const add = (c) => {
        const k = keyOf(c);
        if (k && !seen.has(k)) { seen.add(k); out.push(c); }
    };
    add(exact);
    for (const c of Array.isArray(pool) ? pool : EMPTY) {
        const k = keyOf(c);
        if (!k) continue;
        const title = typeof c.title === "string" ? c.title.toLowerCase() : "";
        if (title.includes(q) || k.includes(q)) add(c);
    }
    return out;
}

// ============================================================================
// usePortalDirectory — the paged listing for one search (or none)
// ============================================================================
// `attempt` only re-runs the listing (Retry). Returns [state, loadMore]:
//   items    the bridge's portals so far, in rank order
//   extras   what a search adds (see findExtras), shown once `done`
//   loading  a page is on its way
//   done     the listing has ended
//   extrasPending  the extras of this search are still being gathered

const DIRECTORY_START = Object.freeze({ items: EMPTY, extras: EMPTY, loading: true, done: false, extrasPending: false });
const DIRECTORY_NONE = Object.freeze({ items: EMPTY, extras: EMPTY, loading: false, done: true, extrasPending: false });

function usePortalDirectory(api, query, attempt) {
    const [state, setState] = useState(DIRECTORY_START);
    const loaderRef = useRef(null);
    const poolRef = useRef(null);   // { api, promise } — the ranked pass, shared by every search

    useEffect(() => {
        const communities = api && api.communities;
        if (!communities || typeof communities.listCommunities !== "function") {
            loaderRef.current = null;
            setState(DIRECTORY_NONE);
            return undefined;
        }
        let live = true;
        const loader = new PagedLoader({
            limit: PAGE_SIZE,
            itemKey: keyOf,
            fetchPage: (cursor, limit) => {
                const options = { sort: "rank", limit };
                if (cursor) options.last = cursor;
                if (query) options.query = query;
                return communities.listCommunities(options);
            },
            onPage: (items, { done }) => {
                if (live) setState((prev) => ({ ...prev, items, done, loading: false }));
            },
            onError: (err, items) => {
                if (live) setState((prev) => ({ ...prev, items, done: true, loading: false }));
            },
        });
        loaderRef.current = loader;
        setState(query ? { ...DIRECTORY_START, extrasPending: true } : DIRECTORY_START);
        loader.loadMore().catch(() => {});

        if (query) {
            let pool = poolRef.current;
            if (!pool || pool.api !== api) {
                const entry = { api, promise: null };
                entry.promise = loadRankedPool(api).then((rows) => {
                    // An empty pass is a failed one: the next search asks again.
                    if (!rows.length && poolRef.current === entry) poolRef.current = null;
                    return rows;
                });
                poolRef.current = pool = entry;
            }
            findExtras(api, query, pool.promise).then(
                (extras) => { if (live) setState((prev) => ({ ...prev, extras, extrasPending: false })); },
                () => { if (live) setState((prev) => ({ ...prev, extrasPending: false })); },
            );
        }
        return () => {
            live = false;
            loader.cancel();
        };
    }, [api, query, attempt]);

    const loadMore = useCallback(() => {
        const loader = loaderRef.current;
        if (!loader || !loader.hasMore || loader.loading) return;
        setState((prev) => (prev.loading ? prev : { ...prev, loading: true }));
        loader.loadMore().catch(() => {});
    }, []);

    return [state, loadMore];
}

// ============================================================================
// Member faces — MemberPreviewStore
// ============================================================================
// The faces a portal shows, MEMBER_FACES at most, then "+N" for the rest.
//
// Signed in, only members the reader follows — never strangers. The session
// account's follows are read once per visit (condenser_api.get_following,
// up to FOLLOWING_MAX), then each portal's members are paged through
// (bridge.list_subscribers, up to MEMBER_SCAN_MAX) until a page brings the
// count of followed ones to MEMBER_FACES. Two followed members, two faces;
// none, the "+N" tile alone. The bridge lists members by NAME, so in a
// portal bigger than MEMBER_SCAN_MAX a followed member named late in the
// alphabet goes unseen.
// Signed out, nobody is followed: the newest members of the first page.
// Either way the faces go newest member first (the join date of each row),
// and muted members and the portal's own account are never one.
//
// The first page is asked with `last: null`. This chain's bridge reads an
// empty string as an account name and fails ("subscription on portal-… does
// not exist"), and the wrapper turns that into [] — no face anywhere. That is
// why the cursor is never "" here (MembersListDialog passes null too).
//
// A preview is { names, images } — the account names and their profile
// pictures in the same order ("" for none) — fetched together, so a row
// appears once, whole. Pictures come through utils/api/account-cache:
// batched and deduped with every other view's requests.
//
// Framework-agnostic, like list/accountImageStore: the dialog keeps one per
// (api, account), says which portals it lists (want — their order is the
// fetch order, PREVIEW_PARALLEL at a time) and re-renders when one lands
// (subscribe). Previews stay for the visit: a search showing a portal seen
// earlier costs nothing. The bridge wrappers answer [] when the node fails,
// so a failure reads as no face, and the "+N" tile still shows.

const NO_PREVIEW = Object.freeze({ names: EMPTY, images: EMPTY });

// A list_subscribers row ([account, role, title, joined]) worth a face.
const faceOf = (row, portal) => {
    const name = Array.isArray(row) && typeof row[0] === "string" ? row[0] : "";
    return name && name !== portal && row[1] !== "muted" ? name : "";
};
// The row's join date ("2026-11-03T23:18:06"), comparable; 0 when unreadable.
const joinedOf = (row) => {
    const t = Array.isArray(row) && typeof row[3] === "string" ? Date.parse(row[3]) : NaN;
    return Number.isFinite(t) ? t : 0;
};
// The rows' faces, newest member first, MEMBER_FACES at most.
const newestFaces = (rows) => rows
    .slice()
    .sort((a, b) => joinedOf(b) - joinedOf(a))
    .slice(0, MEMBER_FACES)
    .map((row) => row[0]);
const subscriberKey = (row) => (Array.isArray(row) && typeof row[0] === "string" && row[0]) || null;
const followingKey = (f) => (f && typeof f.following === "string" && f.following) || null;

class MemberPreviewStore {
    constructor(api, account) {
        this.api = api || null;
        this.account = account || null;
        this._previews = new Map();   // portal → frozen preview
        this._queue = [];             // portals waiting, in listing order
        this._running = new Set();    // portals on their way
        this._scanning = 0;           // …of which reading members (≤ PREVIEW_PARALLEL)
        this._loaders = new Set();    // their pagers, cancelled by dispose()
        this._following = null;       // Promise<Set> — the follows, read once
        this._listeners = new Set();
        this._disposed = false;
    }

    /** The preview of `portal`, or undefined while it is unknown. */
    get(portal) { return this._previews.get(portal); }

    /** The portals listed now, in order: those not known yet are fetched. */
    want(portals) {
        if (this._disposed) return;
        this._queue = portals.filter((p) => !this._previews.has(p) && !this._running.has(p));
        this._pump();
    }

    /** fn(portal, preview) as each lands. Returns the unsubscribe. */
    subscribe(fn) {
        this._listeners.add(fn);
        return () => { this._listeners.delete(fn); };
    }

    dispose() {
        this._disposed = true;
        this._queue = [];
        this._listeners.clear();
        this._loaders.forEach((loader) => loader.cancel());
        this._loaders.clear();
    }

    // PREVIEW_PARALLEL portals read their members at a time; a portal's slot
    // frees as soon as its names are known, so the next one starts while the
    // pictures load (and those coalesce in account-cache's batches).
    _pump() {
        while (!this._disposed && this._scanning < PREVIEW_PARALLEL && this._queue.length) {
            const portal = this._queue.shift();
            if (this._previews.has(portal) || this._running.has(portal)) continue;
            this._running.add(portal);
            this._scanning += 1;
            let scanning = true;
            const release = () => {
                if (!scanning) return;
                scanning = false;
                this._scanning -= 1;
                this._pump();
            };
            this._load(portal, release).then(
                (preview) => { release(); this._settle(portal, preview); },
                () => { release(); this._settle(portal, NO_PREVIEW); },
            );
        }
    }

    _settle(portal, preview) {
        this._running.delete(portal);
        if (this._disposed) return;
        this._previews.set(portal, preview);
        this._listeners.forEach((fn) => {
            try { fn(portal, preview); } catch (e) { /* a listener's problem stays its own */ }
        });
    }

    // Every page of a cursor-paged list (PagedLoader.start); `hold` gets the
    // loader, to stop it early.
    _page(options, hold) {
        const loader = new PagedLoader(options);
        this._loaders.add(loader);
        if (hold) hold(loader);
        return loader.start().then(
            (items) => { this._loaders.delete(loader); return items; },
            () => { this._loaders.delete(loader); return EMPTY; },
        );
    }

    _followingSet() {
        if (!this._following) {
            const follow = this.api && this.api.follow;
            const account = this.account;
            this._following = follow && typeof follow.getFollowing === "function"
                ? this._page({
                    limit: MEMBER_PAGE,
                    maxItems: FOLLOWING_MAX,
                    itemKey: followingKey,
                    fetchPage: (cursor, limit) => follow.getFollowing(account, cursor || "", "blog", limit),
                }).then((rows) => new Set(rows.map(followingKey)))
                : Promise.resolve(new Set());
        }
        return this._following;
    }

    async _faces(portal) {
        const communities = this.api.communities;
        // null, never "": see the section's header.
        const page = (cursor, limit) => communities.listSubscribers(portal, cursor || null, limit);
        if (!this.account) {
            const rows = await page(null, MEMBER_PAGE);
            const seen = new Set();
            return newestFaces((Array.isArray(rows) ? rows : EMPTY).filter((row) => {
                const name = faceOf(row, portal);
                if (!name || seen.has(name)) return false;
                seen.add(name);
                return true;
            }));
        }
        const following = await this._followingSet();
        if (this._disposed || following.size === 0) return EMPTY;
        const followed = [];
        let pager = null;
        await this._page({
            limit: MEMBER_PAGE,
            maxItems: MEMBER_SCAN_MAX,
            itemKey: subscriberKey,
            fetchPage: page,
            onPage: (_items, { fresh }) => {
                for (const row of fresh) {
                    const name = faceOf(row, portal);
                    if (name && following.has(name)) followed.push(row);
                }
                // Enough faces: the next pages are not read.
                if (followed.length >= MEMBER_FACES && pager) pager.cancel();
            },
        }, (loader) => { pager = loader; });
        return newestFaces(followed);
    }

    async _load(portal, release) {
        const communities = this.api && this.api.communities;
        if (!communities || typeof communities.listSubscribers !== "function") return NO_PREVIEW;
        const names = await this._faces(portal);
        release();
        if (!names.length || this._disposed) return NO_PREVIEW;
        let images = names.map(() => "");
        try {
            const profiles = await getProfiles(this.api, names);
            images = names.map((name) => {
                const profile = profiles && profiles.get(name.toLowerCase());
                return (profile && typeof profile.image === "string" && profile.image) || "";
            });
        } catch (e) { /* no pictures: the initials show */ }
        return Object.freeze({ names: Object.freeze(names), images: Object.freeze(images) });
    }
}

// The signed-in account, kept current: a deep link may open the directory
// before the session is restored, and the faces depend on who is reading.
const SESSION_EVENTS = Object.freeze([
    "session_created", "session_restored", "session_resumed", "account_switched", "session_ended", "session_expired",
]);
const sessionAccountOf = (api) => {
    try {
        return (api && api.sessionManager && api.sessionManager.currentAccount) || null;
    } catch (e) {
        return null;
    }
};

function useSessionAccount(api) {
    const [account, setAccount] = useState(() => sessionAccountOf(api));
    useEffect(() => {
        let live = true;
        const sync = () => { if (live) setAccount(sessionAccountOf(api)); };
        sync();
        const emitter = api && api.eventEmitter;
        if (!emitter || typeof emitter.on !== "function") return () => { live = false; };
        // Read once the event's other listeners have run: the account may be
        // announced a moment before the session manager holds it.
        const later = () => { setTimeout(sync, 0); };
        SESSION_EVENTS.forEach((ev) => emitter.on(ev, later));
        return () => {
            live = false;
            SESSION_EVENTS.forEach((ev) => emitter.off(ev, later));
        };
    }, [api]);
    return account;
}

// ============================================================================
// Styles — greyscale; the only colour comes from the portals' own pictures
// ============================================================================

const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
const T = `200ms ${EASE}`;
const PAPER_BG = "#0e0e0e";      // the dialog, behind the phone rows
const CARD_BG = "#141414";
const CARD_BG_HOVER = "#1b1b1b";
const CARD_RADIUS = 16;
const IMAGE = 56;                // a card's portal picture
const ROW_IMAGE = 48;            // a phone row's
const TILE = 26;                 // a member face
const ROW_TILE = 22;
const TILE_OVERLAP = 8;          // how far each face slides under the one before
const ROW_TILE_OVERLAP = 7;
// The faces overlap, so they are told apart by a 2 px cut-out in the colour
// of what is behind them (a box-shadow ring) — no border is drawn.
const cutOut = (color) => `0px 0px 0px 2px ${color}`;
// Three columns at the dialog's full width, each wide enough for a readable
// title beside the picture (the overlapped faces row needs about 200 px).
const CARD_MIN = 300;

const styles = (theme) => ({
    // Solid scrim instead of the app's light global tint (theme/overrides);
    // the compound selector outranks it, as in FavoriteManagerDialog.
    backdrop: {
        "&.MuiBackdrop-root": { backgroundColor: "rgba(0, 0, 0, 0.72)" },
    },
    paper: {
        "&.MuiDialog-paper": {
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            width: "calc(100% - 64px)",
            maxWidth: 1180,
            height: "min(880px, calc(100% - 64px))",
            maxHeight: "none",
            backgroundColor: PAPER_BG,
            backgroundImage: "none",
            color: "#ffffff",
        },
        // Full screen on phones: square, edge to edge. The compound selector
        // outranks the global rounded-paper rule of theme/overrides.
        "&.MuiDialog-paperFullScreen.MuiPaper-rounded": {
            width: "100%",
            maxWidth: "100%",
            height: "100%",
            borderRadius: 0,
        },
    },

    // ── Header ──
    header: {
        display: "flex",
        alignItems: "flex-start",
        gap: 16,
        flexShrink: 0,
        padding: "28px 24px 0px 32px",
        [theme.breakpoints.down("sm")]: { padding: "14px 10px 0px 20px", gap: 8 },
    },
    headerText: { flex: 1, minWidth: 0 },
    heading: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        margin: 0,
        color: "#ffffff",
        fontWeight: 600,
        "& svg": { color: "#8a8a8a" },
        [theme.breakpoints.down("sm")]: { fontSize: "1.35rem", lineHeight: "40px" },
    },
    subtitle: {
        margin: "4px 0px 0px 0px",
        color: "#8a8a8a",
        [theme.breakpoints.down("sm")]: { margin: "0px", fontSize: 13, lineHeight: "18px" },
    },
    closeButton: {
        flexShrink: 0,
        color: "#c0c0c0",
        backgroundColor: "#151515",
        transition: `background-color ${T}, color ${T}`,
        "&:hover": { backgroundColor: "#212121", color: "#ffffff" },
    },

    // ── Search + Create ──
    searchRow: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexShrink: 0,
        padding: "20px 32px 16px 32px",
        [theme.breakpoints.down("sm")]: { padding: "12px 16px 10px 16px", gap: 8 },
    },
    searchField: {
        flex: 1,
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        height: 48,
        boxSizing: "border-box",
        padding: "0px 6px 0px 16px",
        borderRadius: 24,
        backgroundColor: "#1a1a1a",
        border: "0px solid #232323",
        transition: `border-color ${T}, background-color ${T}`,
        "&:hover": { borderColor: "#2e2e2e" },
        "&:focus-within": { borderColor: "#4d4d4d", backgroundColor: "#1d1d1d" },
        [theme.breakpoints.down("sm")]: { height: 44, padding: "0px 4px 0px 14px" },
    },
    searchIcon: { flexShrink: 0, marginRight: 10, color: "#7a7a7a" },
    searchInput: {
        flex: 1,
        minWidth: 0,
        fontSize: 15,
        fontFamily: '"Normative Pro", "Industry Book"',
        "& input": { padding: "0px", height: 24 },
        "& input::placeholder": { color: "#7a7a7a", opacity: 1 },
    },
    clearButton: {
        flexShrink: 0,
        color: "#8a8a8a",
        "&:hover": { color: "#ffffff" },
    },
    // The directory's one filled pill, like the toolbar's Trade button.
    // "&.MuiButton-root" outranks the global button radius of theme/overrides.
    createButton: {
        "&.MuiButton-root": {
            flexShrink: 0,
            height: 48,
            padding: "0px 22px 0px 18px",
            borderRadius: 24,
            backgroundColor: "#e6e6e6",
            color: "#111111",
            fontWeight: 700,
            fontSize: 15,
            textTransform: "none",
            whiteSpace: "nowrap",
            boxShadow: "none",
            transition: `background-color ${T}, box-shadow ${T}`,
            "&:hover": { backgroundColor: "#ffffff", boxShadow: "0px 0px 8px 1px #ffffff55" },
            // MUI clears a button's hover fill on touch screens: keep it light.
            "@media (hover: none)": { "&:hover": { backgroundColor: "#e6e6e6", boxShadow: "none" } },
            [theme.breakpoints.down("sm")]: { height: 44, padding: "0px 16px 0px 12px", fontSize: 14 },
        },
        "& .MuiButton-startIcon": { marginRight: 6 },
    },

    // ── Scrolling body ──
    body: {
        flex: 1,
        minHeight: 0,
        overflowX: "hidden",
        overflowY: "auto",
        overscrollBehavior: "contain",
        padding: "4px 32px 32px 32px",
        [theme.breakpoints.down("sm")]: { padding: "0px 0px 24px 0px" },
    },

    // ── Desktop grid of cards ──
    grid: {
        display: "grid",
        gridTemplateColumns: `repeat(auto-fill, minmax(${CARD_MIN}px, 1fr))`,
        gap: 12,
    },
    // No border, no banner: a flat tile, the picture on the left, the text
    // on the right, the faces along the bottom.
    card: {
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "flex-start",
        gap: 14,
        position: "relative",
        minWidth: 0,
        height: "100%",
        boxSizing: "border-box",
        padding: 16,
        border: 0,
        borderRadius: CARD_RADIUS,
        backgroundColor: CARD_BG,
        color: "inherit",
        textAlign: "left",
        textDecoration: "none",
        transition: `background-color ${T}`,
        "&:hover, &.Mui-focusVisible": { backgroundColor: CARD_BG_HOVER },
        // The faces' cut-out follows the card's colour.
        "&:hover $face, &.Mui-focusVisible $face": { boxShadow: cutOut(CARD_BG_HOVER) },
        // Keyboard focus only (no outline otherwise): an inner ring.
        "&.Mui-focusVisible": { boxShadow: "inset 0px 0px 0px 2px #ffffff40" },
    },
    cardHead: {
        display: "flex",
        alignItems: "center",
        gap: 16,
        minWidth: 0,
    },
    cardText: {
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minWidth: 0,
    },
    cardTitle: {
        fontFamily: '"Industry Book", "Normative Pro"',
        fontSize: 17,
        fontWeight: 600,
        lineHeight: "22px",
        color: "#ffffff",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    cardAbout: {
        marginTop: 2,
        fontFamily: '"Normative Pro", "Industry Book"',
        fontSize: 13,
        lineHeight: "18px",
        color: "#8a8a8a",
        overflowWrap: "anywhere",
        display: "-webkit-box",
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: 2,
        overflow: "hidden",
    },

    // ── The portal's picture and its posts badge ──
    picture: { flexShrink: 0 },
    image: {
        width: IMAGE,
        height: IMAGE,
        borderRadius: 14,
        backgroundColor: "#1f1f1f",
        color: "#7a7a7a",
        "& svg": { fontSize: 28 },
    },
    rowImage: {
        width: ROW_IMAGE,
        height: ROW_IMAGE,
        borderRadius: 12,
        backgroundColor: "#1f1f1f",
        color: "#7a7a7a",
        "& svg": { fontSize: 24 },
    },
    // Dark grey, white figures, pinned on the picture's top right corner,
    // mostly over it. The compound selectors outrank MUI's own Badge rules.
    postsBadge: {
        "&.MuiBadge-badge": {
            height: 20,
            minWidth: 20,
            padding: "0px 6px",
            borderRadius: 10,
            backgroundColor: "#3a3a3a",
            color: "#ffffff",
            fontFamily: '"Normative Pro", "Industry Book"',
            fontSize: 11,
            fontWeight: 700,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
            boxShadow: "0px 2px 6px rgba(0, 0, 0, 0.6)",
        },
        "&.MuiBadge-anchorOriginTopRightRectangular": { transform: "scale(1) translate(30%, -30%)" },
        "&.MuiBadge-anchorOriginTopRightRectangular.MuiBadge-invisible": { transform: "scale(0) translate(30%, -30%)" },
    },

    // ── Member faces: overlapping rounded squares, then "+N" ──
    // Each face slides TILE_OVERLAP under the one before it (the first is on
    // top, as in MUI's AvatarGroup); the "+N" tile goes under the last face,
    // its text pushed clear of the overlap.
    "@keyframes facesIn": {
        from: { opacity: 0 },
        to: { opacity: 1 },
    },
    faces: {
        display: "flex",
        alignItems: "center",
        height: TILE,
        minWidth: 0,
        marginTop: "auto",
    },
    facesIn: {
        animation: `$facesIn 240ms ${EASE}`,
        "@media (prefers-reduced-motion: reduce)": { animation: "none" },
    },
    face: {
        position: "relative",
        flex: "0 0 auto",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: TILE,
        height: TILE,
        overflow: "hidden",
        borderRadius: 8,
        backgroundColor: "#2a2a2a",
        boxShadow: cutOut(CARD_BG),
        transition: `box-shadow ${T}`,
        color: "#8a8a8a",
        fontFamily: '"Industry Book", "Normative Pro"',
        fontSize: 12,
        lineHeight: 1,
        textTransform: "uppercase",
        "& + $face": { marginLeft: -TILE_OVERLAP },
        "& > img": {
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            // alt="" hides alt text already; this keeps a broken-image icon
            // from flashing before onError hides the element.
            color: "transparent",
        },
    },
    more: {
        position: "relative",
        zIndex: 0,
        flex: "0 0 auto",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        height: TILE,
        minWidth: TILE,
        padding: "0px 7px",
        borderRadius: 8,
        backgroundColor: "#262626",
        color: "#d4d4d4",
        fontFamily: '"Normative Pro", "Industry Book"',
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1,
        whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums",
        "$face + &": {
            marginLeft: -TILE_OVERLAP,
            minWidth: TILE + TILE_OVERLAP,
            paddingLeft: 7 + TILE_OVERLAP,
        },
    },
    // For screen readers: the counts the badge and the "+N" tile show.
    srOnly: {
        position: "absolute",
        width: 1,
        height: 1,
        margin: -1,
        padding: 0,
        overflow: "hidden",
        clip: "rect(0 0 0 0)",
        whiteSpace: "nowrap",
        border: 0,
    },

    // ── Phone list ──
    list: { padding: "0px 8px" },
    row: {
        alignItems: "flex-start",
        padding: "12px 12px",
        borderRadius: 12,
        color: "inherit",
        textDecoration: "none",
    },
    rowPicture: { minWidth: 64, marginTop: 2 },
    rowText: {
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minWidth: 0,
        "& $faces": { height: ROW_TILE, marginTop: 8 },
        "& $face": { width: ROW_TILE, height: ROW_TILE, borderRadius: 7, fontSize: 10, boxShadow: cutOut(PAPER_BG) },
        "& $face + $face": { marginLeft: -ROW_TILE_OVERLAP },
        "& $more": { height: ROW_TILE, minWidth: ROW_TILE, padding: "0px 6px", borderRadius: 7, fontSize: 10 },
        "& $face + $more": {
            marginLeft: -ROW_TILE_OVERLAP,
            minWidth: ROW_TILE + ROW_TILE_OVERLAP,
            paddingLeft: 6 + ROW_TILE_OVERLAP,
        },
    },
    rowTitle: {
        display: "block",
        fontFamily: '"Industry Book", "Normative Pro"',
        fontSize: 15,
        fontWeight: 600,
        lineHeight: "20px",
        color: "#ffffff",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    rowAbout: {
        display: "-webkit-box",
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: 2,
        overflow: "hidden",
        marginTop: 2,
        fontFamily: '"Normative Pro", "Industry Book"',
        fontSize: 13,
        lineHeight: "18px",
        color: "#8a8a8a",
        overflowWrap: "anywhere",
    },

    // ── Loading, empty and end states ──
    skeleton: { backgroundColor: "#1c1c1c" },
    skeletonCard: {
        display: "flex",
        flexDirection: "column",
        gap: 14,
        boxSizing: "border-box",
        minHeight: 2 * 16 + IMAGE + 14 + TILE,
        padding: 16,
        borderRadius: CARD_RADIUS,
        backgroundColor: CARD_BG,
    },
    skeletonRow: { display: "flex", gap: 16, padding: "12px 20px" },
    skeletonFaces: {
        display: "flex",
        marginTop: 8,
    },
    sentinel: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 1,
    },
    moreSpinner: { margin: "24px 0px 8px 0px", color: "#666666" },
    state: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: "56px 24px",
    },
    stateIcon: { fontSize: 48, color: "#3a3a3a", marginBottom: 12 },
    stateTitle: {
        fontFamily: '"Industry Book", "Normative Pro"',
        fontSize: 16,
        fontWeight: 600,
        color: "#dddddd",
        overflowWrap: "anywhere",
    },
    stateText: {
        marginTop: 6,
        maxWidth: 420,
        fontFamily: '"Normative Pro", "Industry Book"',
        fontSize: 13,
        lineHeight: "19px",
        color: "#777777",
    },
    stateActions: {
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: 12,
        marginTop: 20,
    },
    ghostButton: {
        "&.MuiButton-root": {
            height: 40,
            padding: "0px 18px",
            borderRadius: 20,
            backgroundColor: "#1a1a1a",
            color: "#cccccc",
            textTransform: "none",
            fontWeight: 600,
            "&:hover": { backgroundColor: "#262626", color: "#ffffff" },
        },
    },
});

// ============================================================================
// Leaves — memoized; a card re-renders when its portal, its picture or its
// faces move
// ============================================================================

// The click handler of a card or row. A modified click (new tab, new
// window) keeps the link's own behaviour; a plain one navigates in the app.
function useOpenPortal(name, onOpen) {
    return useCallback((event) => {
        if (event && (event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;
        if (event) event.preventDefault();
        onOpen(name);
    }, [name, onOpen]);
}

// What the badge and the "+N" tile show, read out: "1,234 members, 12 posts
// this week".
const countsLabel = (members, posts) => membersLabel(members) + ", " + postsLabel(posts);

// The portal's picture, the week's post count pinned on it (no badge on a
// week without posts). MUI's Avatar falls back to its children — the portal
// icon — when the picture is missing or fails.
const PortalPicture = ({ classes, className, image, known, posts }) => (
    <Badge
        badgeContent={posts}
        max={POSTS_BADGE_MAX}
        overlap="rectangular"
        anchorOrigin={BADGE_ANCHOR}
        className={classes.picture}
        classes={{ badge: classes.postsBadge }}
        title={posts > 0 ? postsLabel(posts) : undefined}
        aria-hidden="true"
    >
        <Avatar variant="rounded" src={image || undefined} alt="" className={"pixelated " + className}>
            {known ? <CommunityIcon /> : null}
        </Avatar>
    </Badge>
);

const hideBrokenImage = (event) => {
    const img = event && event.currentTarget;
    if (img) img.style.display = "none";
};

// One face: the account's initial, covered by its picture once that loads —
// list/AccountList's AccountAvatar, in a rounded square. A bare <img>, not
// MUI's Avatar (which builds an Image() per picture to watch for errors): a
// broken picture just hides and the initial shows.
const Face = ({ className, style, name, image }) => (
    <span className={className} style={style} title={"@" + name}>
        {name.charAt(0)}
        {image ? (
            <img
                key={image}
                className="pixelated"
                src={image}
                alt=""
                loading="lazy"
                decoding="async"
                draggable={false}
                onError={hideBrokenImage}
            />
        ) : null}
    </span>
);

// Stacking order of the overlapped faces: the first on top, the "+N" tile
// (z-index 0, in the stylesheet) under the last.
const FACE_STACK = Array.from({ length: MEMBER_FACES + 1 }, (_, z) => Object.freeze({ zIndex: z }));

// The faces row (see MemberPreviewStore): up to MEMBER_FACES members, then
// "+N" for the rest of the count. While the preview is on its way the row is
// empty but keeps its height, then fades in whole.
const MemberFaces = React.memo(({ classes, preview, total }) => {
    useLanguage();
    if (!preview) return <span className={classes.faces} aria-hidden="true" />;
    const { names, images } = preview;
    const more = Math.max(0, total - names.length);
    return (
        <span className={classes.faces + " " + classes.facesIn} aria-hidden="true">
            {names.map((name, i) => (
                <Face key={name} className={classes.face} style={FACE_STACK[names.length - i]} name={name} image={images[i]} />
            ))}
            {more > 0 ? (
                <span className={classes.more} title={membersLabel(total)}>{"+" + formatCompact(more)}</span>
            ) : null}
        </span>
    );
});
MemberFaces.displayName = "MemberFaces";

const sameLeaf = (prev, next) =>
    prev.portal === next.portal &&
    prev.image === next.image &&
    prev.known === next.known &&
    prev.preview === next.preview &&
    prev.onOpen === next.onOpen &&
    prev.classes === next.classes;

const PortalCard = React.memo(({ classes, portal, image, known, preview, onOpen }) => {
    useLanguage();
    const handleClick = useOpenPortal(portal.name, onOpen);
    const title = portal.title || portal.name;
    const about = typeof portal.about === "string" ? portal.about.trim() : "";
    const members = countOf(portal.subscribers);
    const posts = countOf(portal.num_pending);
    return (
        <ButtonBase
            component="a"
            href={"/" + portal.name}
            onClick={handleClick}
            className={classes.card}
            focusRipple
        >
            <span className={classes.cardHead}>
                <PortalPicture classes={classes} className={classes.image} image={image} known={known} posts={posts} />
                <span className={classes.cardText}>
                    <span className={classes.cardTitle}>{title}</span>
                    {about ? <span className={classes.cardAbout}>{about}</span> : null}
                </span>
            </span>
            <MemberFaces classes={classes} preview={preview} total={members} />
            <span className={classes.srOnly}>{countsLabel(members, posts)}</span>
        </ButtonBase>
    );
}, sameLeaf);
PortalCard.displayName = "PortalCard";

const PortalRow = React.memo(({ classes, portal, image, known, preview, onOpen }) => {
    useLanguage();
    const handleClick = useOpenPortal(portal.name, onOpen);
    const title = portal.title || portal.name;
    const about = typeof portal.about === "string" ? portal.about.trim() : "";
    const members = countOf(portal.subscribers);
    const posts = countOf(portal.num_pending);
    return (
        <ListItem button component="a" href={"/" + portal.name} onClick={handleClick} className={classes.row}>
            <ListItemAvatar className={classes.rowPicture}>
                <PortalPicture classes={classes} className={classes.rowImage} image={image} known={known} posts={posts} />
            </ListItemAvatar>
            <span className={classes.rowText}>
                <span className={classes.rowTitle}>{title}</span>
                {about ? <span className={classes.rowAbout}>{about}</span> : null}
                <MemberFaces classes={classes} preview={preview} total={members} />
                <span className={classes.srOnly}>{countsLabel(members, posts)}</span>
            </span>
        </ListItem>
    );
}, sameLeaf);
PortalRow.displayName = "PortalRow";

// Skeleton faces, stacked like the real ones (first on top, cut out of the
// colour behind them).
const SKELETON_TILES = Object.freeze([0, 1, 2, 3]);
const skeletonTile = (j, overlap, radius, behind) => Object.freeze({
    position: "relative",
    zIndex: SKELETON_TILES.length - j,
    flexShrink: 0,
    marginLeft: j ? -overlap : 0,
    borderRadius: radius,
    boxShadow: cutOut(behind),
});
const SKELETON_TILE_STYLES = SKELETON_TILES.map((j) => skeletonTile(j, TILE_OVERLAP, 8, CARD_BG));
const SKELETON_ROW_TILE_STYLES = SKELETON_TILES.map((j) => skeletonTile(j, ROW_TILE_OVERLAP, 7, PAPER_BG));

const SkeletonCards = React.memo(({ classes }) => (
    <div className={classes.grid} aria-hidden="true">
        {Array.from({ length: SKELETON_CARDS }, (_, i) => (
            <div key={"sk-" + i} className={classes.skeletonCard}>
                <div className={classes.cardHead}>
                    <Skeleton variant="rect" width={IMAGE} height={IMAGE} animation="wave" className={classes.skeleton} style={SKELETON_IMAGE_STYLE} />
                    <div className={classes.cardText}>
                        <Skeleton variant="text" width="58%" height={22} animation="wave" className={classes.skeleton} style={SKELETON_TITLE_STYLE} />
                        <Skeleton variant="text" width="94%" animation="wave" className={classes.skeleton} />
                        <Skeleton variant="text" width="70%" animation="wave" className={classes.skeleton} />
                    </div>
                </div>
                <div className={classes.faces}>
                    {SKELETON_TILES.map((j) => (
                        <Skeleton key={j} variant="rect" width={TILE} height={TILE} animation="wave" className={classes.skeleton} style={SKELETON_TILE_STYLES[j]} />
                    ))}
                </div>
            </div>
        ))}
    </div>
));
SkeletonCards.displayName = "SkeletonCards";

const SkeletonRows = React.memo(({ classes }) => (
    <div aria-hidden="true">
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
            <div key={"sk-" + i} className={classes.skeletonRow}>
                <Skeleton variant="rect" width={ROW_IMAGE} height={ROW_IMAGE} animation="wave" className={classes.skeleton} style={SKELETON_ROW_IMAGE_STYLE} />
                <div style={SKELETON_ROW_TEXT_STYLE}>
                    <Skeleton variant="text" width="55%" height={20} animation="wave" className={classes.skeleton} />
                    <Skeleton variant="text" width="90%" animation="wave" className={classes.skeleton} />
                    <div className={classes.skeletonFaces}>
                        {SKELETON_TILES.map((j) => (
                            <Skeleton key={j} variant="rect" width={ROW_TILE} height={ROW_TILE} animation="wave" className={classes.skeleton} style={SKELETON_ROW_TILE_STYLES[j]} />
                        ))}
                    </div>
                </div>
            </div>
        ))}
    </div>
));
SkeletonRows.displayName = "SkeletonRows";

// Nothing to list: a search without a match, or an unfiltered listing that
// came back empty — which, since listCommunities answers [] on a node error,
// may well be a failure, hence the Retry. `answered`: the node did list
// portals, only none to show (the official ones alone) — no failure to retry.
const EmptyState = React.memo(({ classes, query, answered, onRetry, onCreate }) => {
    useLanguage();
    const failed = !query && !answered;
    return (
        <div className={classes.state}>
            <CommunityIcon className={classes.stateIcon} />
            <Typography component="p" className={classes.stateTitle}>
                {query
                    ? t("components.portals_dialog.no_portal_matches", { query })
                    : t("components.portals_dialog.nothing_to_show")}
            </Typography>
            {query || failed ? (
                <Typography component="p" className={classes.stateText}>
                    {query
                        ? t("components.portals_dialog.try_a_whole_word")
                        : t("components.portals_dialog.the_node_may_be_busy")}
                </Typography>
            ) : null}
            <div className={classes.stateActions}>
                {failed && (
                    <Button onClick={onRetry} className={classes.ghostButton}>
                        {t("components.portals_dialog.retry")}
                    </Button>
                )}
                <Button onClick={onCreate} className={classes.ghostButton} startIcon={<AddRounded />}>
                    {t("components.portals_dialog.create_portal")}
                </Button>
            </div>
        </div>
    );
});
EmptyState.displayName = "EmptyState";

// ============================================================================
// PortalsDialog
// ============================================================================
// Props: { open, api, onClose, onExited, locales, registerCloseGuard }
//   onClose             closes "+portals" (Index: closeMetaOf("portals"))
//   onExited            the closing transition is over (Index unmounts it)
//   locales             the Settings locale, for the Create dialog's key sheet
//   registerCloseGuard  (hold) — Index asks `hold()` when the address lets go
//                       of "+portals" on the page it was opened on (the back
//                       arrow): true keeps the directory up. A Create form is
//                       closed first; a portal being created keeps both up.

const PortalsDialog = ({ classes, open, api, onClose, onExited, locales, registerCloseGuard }) => {
    useLanguage();
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    // ── Search ──────────────────────────────────────────────────────────
    // `input` is the box, `query` what the listing asks for: trimmed, after
    // a typing pause (at once on Enter or when the box is emptied).
    const [input, setInput] = useState("");
    const [query, setQuery] = useState("");
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        const next = input.trim();
        if (next === query) return undefined;
        const id = setTimeout(() => setQuery(next), next ? SEARCH_DEBOUNCE_MS : 0);
        return () => clearTimeout(id);
    }, [input, query]);

    const handleInput = useCallback((e) => setInput(String(e.target.value || "").slice(0, QUERY_MAX)), []);
    const inputRef = useRef(null);
    const clearSearch = useCallback(() => {
        setInput("");
        if (inputRef.current) inputRef.current.focus();
    }, []);
    const handleKeyDown = useCallback((e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            setQuery(String(e.target.value || "").trim());
        } else if (e.key === "Escape" && e.target.value) {
            // Escape empties the box first; the next one closes the dialog.
            e.stopPropagation();
            setInput("");
        }
    }, []);

    // Desktop: the box takes the focus, so typing searches at once. Phones
    // are left alone — the focus would raise the keyboard over the list.
    const setInputEl = useCallback((el) => { inputRef.current = el; }, []);
    useEffect(() => {
        if (!open || fullScreen) return undefined;
        const id = setTimeout(() => { if (inputRef.current) inputRef.current.focus(); }, 60);
        return () => clearTimeout(id);
    }, [open, fullScreen]);

    // ── Listing ─────────────────────────────────────────────────────────
    const [listing, loadMore] = usePortalDirectory(api, query, attempt);
    const retry = useCallback(() => setAttempt((n) => n + 1), []);

    // The bridge's portals, then — once its listing has ended — what the
    // search adds, without duplicates; portal-<id> names only, the official
    // portals left out.
    const rows = useMemo(() => {
        const seen = new Set();
        const out = [];
        const take = (c) => {
            if (!isListed(c) || seen.has(c.name)) return;
            seen.add(c.name);
            out.push(c);
        };
        listing.items.forEach(take);
        if (listing.done) listing.extras.forEach(take);
        return out;
    }, [listing.items, listing.extras, listing.done]);

    const firstLoad = rows.length === 0 && (listing.loading || listing.extrasPending || !listing.done);
    const loadingMore = rows.length > 0 && listing.loading;

    // ── Pictures: the profile image of each portal's account ───────────
    const [images, setImages] = useState(NO_IMAGES);
    const imagesRef = useRef(NO_IMAGES);
    const askedRef = useRef(new Set());
    useEffect(() => {
        if (!api || !api.accounts || typeof api.accounts.getAccounts !== "function") return;
        const asked = askedRef.current;
        const wanted = [];
        for (const c of rows) {
            if (!asked.has(c.name)) { asked.add(c.name); wanted.push(c.name); }
        }
        const settle = (names, accounts) => {
            const next = new Map(imagesRef.current);
            for (const a of Array.isArray(accounts) ? accounts : EMPTY) {
                if (a && typeof a.name === "string") {
                    const p = a._profile;
                    next.set(a.name, (p && typeof p.profile_image === "string" && p.profile_image) || "");
                }
            }
            // Not resolved (the lookup failed, or came back empty): shown
            // without a picture, and not asked again during this visit.
            for (const n of names) if (!next.has(n)) next.set(n, "");
            imagesRef.current = next;
            if (mountedRef.current) setImages(next);
        };
        for (let i = 0; i < wanted.length; i += 100) {
            const chunk = wanted.slice(i, i + 100);
            Promise.resolve(api.accounts.getAccounts(chunk, true)).then(
                (accounts) => settle(chunk, accounts),
                () => settle(chunk, EMPTY),
            );
        }
    }, [rows, api]);

    // ── Member faces (MemberPreviewStore) ───────────────────────────────
    // One store per reader: signing in or out mid-visit starts over. Each
    // landed preview re-renders the list; only its own card moves (memo).
    const account = useSessionAccount(api);
    const previews = useMemo(() => new MemberPreviewStore(api, account), [api, account]);
    const [, setPreviewTick] = useState(0);
    useEffect(() => {
        const off = previews.subscribe(() => setPreviewTick((n) => n + 1));
        return () => {
            off();
            previews.dispose();
        };
    }, [previews]);
    useEffect(() => {
        previews.want(rows.map(keyOf));
    }, [rows, previews]);

    // ── Infinite loading ────────────────────────────────────────────────
    // A sentinel after the last row; the next page loads when it comes
    // within PREFETCH_PX of the visible end of the scrolling body.
    const [scrollEl, setScrollEl] = useState(null);
    const [sentinelEl, setSentinelEl] = useState(null);
    const loadMoreRef = useRef(loadMore);
    loadMoreRef.current = loadMore;
    const nearEnd = useCallback(() => {
        if (!scrollEl || !sentinelEl) return false;
        return sentinelEl.getBoundingClientRect().top - scrollEl.getBoundingClientRect().bottom < PREFETCH_PX;
    }, [scrollEl, sentinelEl]);
    const hasObserver = typeof IntersectionObserver === "function";
    useEffect(() => {
        if (!scrollEl || !sentinelEl || !hasObserver) return undefined;
        const io = new IntersectionObserver((entries) => {
            for (let i = 0; i < entries.length; i++) {
                if (entries[i].isIntersecting) { loadMoreRef.current(); break; }
            }
        }, { root: scrollEl, rootMargin: "0px 0px " + PREFETCH_PX + "px 0px" });
        io.observe(sentinelEl);
        return () => io.disconnect();
    }, [scrollEl, sentinelEl, hasObserver]);
    // A page that leaves the sentinel inside the margin (a tall screen, a
    // short page) gives the observer nothing new to report: ask again.
    useEffect(() => {
        if (!listing.loading && !listing.done && nearEnd()) loadMore();
    }, [listing.items, listing.loading, listing.done, nearEnd, loadMore]);
    const handleScroll = useCallback(() => { if (nearEnd()) loadMoreRef.current(); }, [nearEnd]);
    // A new search starts at the top.
    useEffect(() => {
        if (scrollEl) scrollEl.scrollTop = 0;
    }, [query, scrollEl]);

    // ── Open a portal ───────────────────────────────────────────────────
    // Close first, then push — GDDisruptions' order: the overlay's step back
    // is deferred, the push lands first and the portal page stays, with the
    // directory one step back in the history.
    const openPortal = useCallback((name) => {
        if (typeof onClose === "function") onClose();
        HISTORY.push("/" + name);
    }, [onClose]);

    // ── Create ──────────────────────────────────────────────────────────
    const [createMounted, setCreateMounted] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const createOpenRef = useRef(false);
    createOpenRef.current = createOpen;
    const creatingRef = useRef(false);

    const handleCreate = useCallback(async () => {
        const account = await activeAccount(api);
        if (!mountedRef.current) return;
        if (!account) {
            // A portal is created by a logged-in account (it pays the fee and
            // becomes its admin): log in first, then back to the directory.
            actions.trigger_login({ onLogin: reopenDirectory });
            return;
        }
        setCreateMounted(true);
        setCreateOpen(true);
    }, [api]);
    const closeCreate = useCallback(() => setCreateOpen(false), []);
    const handlePhase = useCallback((phase) => { creatingRef.current = CREATING_PHASES.has(phase); }, []);

    useEffect(() => {
        if (typeof registerCloseGuard !== "function") return undefined;
        registerCloseGuard(() => {
            if (creatingRef.current) return true;
            if (createOpenRef.current) {
                setCreateOpen(false);
                return true;
            }
            return false;
        });
        return () => registerCloseGuard(null);
    }, [registerCloseGuard]);

    // ── Render ──────────────────────────────────────────────────────────
    let content;
    if (firstLoad) {
        content = fullScreen ? <SkeletonRows classes={classes} /> : <SkeletonCards classes={classes} />;
    } else if (rows.length === 0) {
        content = (
            <EmptyState
                classes={classes}
                query={query}
                answered={listing.items.length > 0}
                onRetry={retry}
                onCreate={handleCreate}
            />
        );
    } else if (fullScreen) {
        // A <div> list: its children are links, not <li>s.
        content = (
            <List component="div" className={classes.list}>
                {rows.map((c) => (
                    <PortalRow
                        key={c.name}
                        classes={classes}
                        portal={c}
                        image={images.get(c.name) || c.avatar_url || ""}
                        known={images.has(c.name) || !!c.avatar_url}
                        preview={previews.get(c.name)}
                        onOpen={openPortal}
                    />
                ))}
            </List>
        );
    } else {
        content = (
            <div className={classes.grid}>
                {rows.map((c) => (
                    <PortalCard
                        key={c.name}
                        classes={classes}
                        portal={c}
                        image={images.get(c.name) || c.avatar_url || ""}
                        known={images.has(c.name) || !!c.avatar_url}
                        preview={previews.get(c.name)}
                        onOpen={openPortal}
                    />
                ))}
            </div>
        );
    }

    return (
        <React.Fragment>
            <Dialog
                open={Boolean(open)}
                onClose={onClose}
                fullScreen={fullScreen}
                maxWidth={false}
                classes={{ paper: classes.paper }}
                BackdropProps={{ className: classes.backdrop }}
                TransitionProps={{ onExited }}
                aria-labelledby="portals-dialog-title"
            >
                <div className={classes.header}>
                    <div className={classes.headerText}>
                        <Typography id="portals-dialog-title" component="h2" variant="h5" className={classes.heading}>
                            <CommunityIcon /> {t("words.portals")}
                        </Typography>
                        <Typography component="p" variant="body2" className={classes.subtitle}>
                            {t("components.portals_dialog.subtitle")}
                        </Typography>
                    </div>
                    <IconButton onClick={onClose} className={classes.closeButton} aria-label={t("words.close")}>
                        <CloseRounded />
                    </IconButton>
                </div>

                <div className={classes.searchRow}>
                    <div className={classes.searchField}>
                        <SearchRounded className={classes.searchIcon} />
                        <InputBase
                            value={input}
                            onChange={handleInput}
                            onKeyDown={handleKeyDown}
                            inputRef={setInputEl}
                            placeholder={t("components.portals_dialog.search_portals")}
                            className={classes.searchInput}
                            inputProps={{ ...SEARCH_INPUT_PROPS, "aria-label": t("components.portals_dialog.search_portals") }}
                        />
                        {input ? (
                            <IconButton size="small" onClick={clearSearch} className={classes.clearButton} aria-label={t("components.portals_dialog.clear_search")}>
                                <CloseRounded fontSize="small" />
                            </IconButton>
                        ) : null}
                    </div>
                    <Button onClick={handleCreate} className={classes.createButton} startIcon={<AddRounded />}>
                        {fullScreen ? t("words.create") : t("components.portals_dialog.create_portal")}
                    </Button>
                </div>

                <div ref={setScrollEl} className={classes.body} onScroll={hasObserver ? undefined : handleScroll}>
                    {content}
                    <div ref={setSentinelEl} className={classes.sentinel}>
                        {loadingMore && <CircularProgress size={24} thickness={4} className={classes.moreSpinner} />}
                    </div>
                </div>
            </Dialog>

            {/* Beside the directory, not inside its paper: it opens over it and
                lives as long as the directory is mounted, whatever the
                directory's own transition is doing. */}
            {createMounted && (
                <React.Suspense fallback={CREATE_FALLBACK}>
                    <LazyCreateCommunityDialog
                        api={api}
                        open={createOpen}
                        locales={locales}
                        onClose={closeCreate}
                        onPhaseChange={handlePhase}
                    />
                </React.Suspense>
            )}
        </React.Fragment>
    );
};

PortalsDialog.displayName = "PortalsDialog";

export default withStyles(styles)(PortalsDialog);
