// ============================================================================
// feedSeen.js — how far the personal feed has actually been read
// ----------------------------------------------------------------------------
// Shared between FeedPersonal (the writer: it marks the posts whose cards the
// reader has rested on) and MenuContent (the reader: the "N+" badges of the
// drawer's Friends row count the feed posts that are NOT seen).
//
// "Seen" used to be a single moment: FeedPersonal stamped `last_feed_check`
// = now on mount / hide / unmount, so merely opening the feed marked every
// post published before that moment as read — including the ones far below
// the fold the reader never scrolled to, and the badges only moved on the
// next full scan. The state kept here is the part of the feed that was
// actually in view instead. The feed is one list ordered by `created`,
// newest first, so "what was seen" is expressed along that axis:
//
//   floor   everything created at or before this moment is seen — the old
//           semantic, kept as the base, and migrated from the legacy
//           `last_feed_check` value the first time an account is read;
//   seen    disjoint [from, to] ranges of `created` (ms epoch), above the
//           floor, that the reader scrolled through — sorted, oldest first.
//
// A post is unseen iff it is above the floor and inside no range. Ranges are
// merged as they overlap or touch, and a range reaching down to the floor is
// folded into it (the reader caught up with where they had been: everything
// up to that range's top is history). The list is capped: past MAX_RANGES the
// two closest ranges merge, which counts the (smallest) gap between them as
// seen — the only lossy step, and a deliberate one.
//
// Persisted per account in localStorage (`feed_seen:<account>`), with a copy
// in memory so readers never parse JSON on a scroll event and the store keeps
// working for the session when storage is unavailable. A write notifies this
// tab's subscribers synchronously (subscribeFeedSeen); the `storage` event
// relays writes made in other tabs.
// ============================================================================

const KEY_PREFIX = "feed_seen:";
const LEGACY_KEY = "last_feed_check";
const MAX_RANGES = 24;
const VERSION = 1;

// Sanitized post entities carry `created` as a ms number
// (VALIDATORS.safe_timestamp); numeric strings, second-precision epochs and
// ISO strings are tolerated — a naive ISO string (no zone) is chain UTC.
// Returns 0 for anything unusable, which every consumer treats as "unknown".
export const toMs = (c) => {
    if (c == null || c === "") return 0;
    const n = typeof c === "number" ? c
        : (typeof c === "string" && /^\d+(\.\d+)?$/.test(c) ? Number(c) : NaN);
    if (Number.isFinite(n)) return n > 0 ? (n < 2e10 ? n * 1000 : n) : 0;
    if (typeof c !== "string") return 0;
    const t = Date.parse(/Z$|[+-]\d{2}:?\d{2}$/.test(c) ? c : c + "Z");
    return Number.isFinite(t) ? t : 0;
};

const storage = () => {
    try { return window.localStorage; } catch (e) { return null; }
};

// The pre-range value: FeedPersonal used to write Date.now() here on every
// visit. Read once, as the floor an account starts from — never written.
const readLegacyFloor = () => {
    const ls = storage();
    if (!ls) return 0;
    try { return toMs(ls.getItem(LEGACY_KEY)); } catch (e) { return 0; }
};

const EMPTY = Object.freeze({ floor: 0, seen: Object.freeze([]) });

// Values inside a state are already ms epochs (markFeedSeen and the legacy
// read apply toMs on the way in), so normalize only guards against junk —
// re-running the seconds/ms heuristic on them would be wrong.
const ms = (x) => (typeof x === "number" && Number.isFinite(x) && x > 0 ? x : 0);

// Sort, merge, fold into the floor, cap. Pure: always returns a new state.
const normalize = (floor, ranges) => {
    let f = ms(floor);
    const list = [];
    for (const r of ranges || []) {
        const a = Array.isArray(r) ? ms(r[0]) : 0;
        const b = Array.isArray(r) ? ms(r[1]) : 0;
        if (!b) continue;
        const from = Math.min(a, b), to = Math.max(a, b);
        if (to <= f) continue;             // entirely below the floor: redundant
        list.push([from, to]);
    }
    list.sort((x, y) => x[0] - y[0]);

    const merged = [];
    for (const r of list) {
        const last = merged[merged.length - 1];
        if (last && r[0] <= last[1]) { if (r[1] > last[1]) last[1] = r[1]; }
        else merged.push([r[0], r[1]]);
    }
    // Fold: the oldest range touches the floor → the reader is caught up to
    // its top; that top is the new floor. Repeat while it keeps touching.
    while (merged.length && merged[0][0] <= f) {
        if (merged[0][1] > f) f = merged[0][1];
        merged.shift();
    }
    while (merged.length > MAX_RANGES) {
        let at = 0, gap = Infinity;
        for (let i = 0; i + 1 < merged.length; i++) {
            const g = merged[i + 1][0] - merged[i][1];
            if (g < gap) { gap = g; at = i; }
        }
        merged.splice(at, 2, [merged[at][0], merged[at + 1][1]]);
    }
    return { floor: f, seen: merged };
};

const sameState = (a, b) => {
    if (a.floor !== b.floor || a.seen.length !== b.seen.length) return false;
    for (let i = 0; i < a.seen.length; i++) {
        if (a.seen[i][0] !== b.seen[i][0] || a.seen[i][1] !== b.seen[i][1]) return false;
    }
    return true;
};

const cache = new Map();       // account → normalized state
const listeners = new Set();   // (account, state, meta) => void

const load = (account) => {
    const ls = storage();
    if (ls) {
        try {
            const raw = ls.getItem(KEY_PREFIX + account);
            if (raw) {
                const o = JSON.parse(raw);
                if (o && typeof o === "object") return normalize(o.floor, Array.isArray(o.seen) ? o.seen : []);
            }
        } catch (e) { /* corrupt entry: start over from the legacy floor */ }
    }
    return normalize(readLegacyFloor(), []);
};

const persist = (account, state) => {
    const ls = storage();
    if (!ls) return;
    try {
        ls.setItem(KEY_PREFIX + account, JSON.stringify({ v: VERSION, floor: state.floor, seen: state.seen }));
    } catch (e) { /* quota / private mode: the in-memory copy still serves this session */ }
};

const notify = (account, state, meta) => {
    for (const fn of Array.from(listeners)) {
        try { fn(account, state, meta); } catch (e) { console.log("[feedSeen] listener failed:", e && e.message); }
    }
};

// The current seen state of an account — `{ floor, seen }`, normalized.
// Treat it as immutable. An unknown / empty account reads as nothing seen.
export const readFeedSeen = (account) => {
    if (!account) return EMPTY;
    let state = cache.get(account);
    if (!state) { state = load(account); cache.set(account, state); }
    return state;
};

// Whether a post with this `created` (ms) is seen under `state`. Unknown
// timestamps (0) are never seen — better a spurious badge than a missed one.
export const isFeedPostSeen = (state, createdMs) => {
    if (!createdMs || !state) return false;
    if (createdMs <= state.floor) return true;
    const seen = state.seen;
    for (let i = 0; i < seen.length; i++) {
        if (createdMs < seen[i][0]) return false;   // sorted: nothing further can hold it
        if (createdMs <= seen[i][1]) return true;
    }
    return false;
};

// Record that the posts created in [from, to] (ms) were in view. Options:
//   head        `created` of the newest post the writer had loaded — passed
//               on to subscribers so a scan can tell whether posts were
//               published since it ran; not stored
//   reachedEnd  the range includes the last post of the feed: there is
//               nothing older to see, so the range folds into the floor
// Subscribers are always notified (meta.changed says whether the state
// moved), so the head hint reaches them even for an already-seen viewport.
// Returns the resulting state.
export const markFeedSeen = (account, mark) => {
    if (!account || !mark) return readFeedSeen(account);
    let from = toMs(mark.from), to = toMs(mark.to);
    if (!to) to = from;
    if (!to) return readFeedSeen(account);
    if (!from) from = to;
    if (from > to) { const t = from; from = to; to = t; }
    if (mark.reachedEnd) from = 0;

    const prev = readFeedSeen(account);
    const next = normalize(prev.floor, prev.seen.concat([[from, to]]));
    const changed = !sameState(prev, next);
    const state = changed ? next : prev;
    if (changed) { cache.set(account, state); persist(account, state); }
    notify(account, state, { head: toMs(mark.head), changed });
    return state;
};

// Subscribe to writes: `(account, state, meta) => void`, meta being
// `{ head, changed }`. Returns the unsubscribe function.
export const subscribeFeedSeen = (fn) => {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
};

// Writes from other tabs: drop the memory copy so the next read reloads it,
// and tell this tab's subscribers (no head hint — the other tab's scan state
// is unknown here).
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("storage", (e) => {
        if (!e || typeof e.key !== "string" || !e.key.startsWith(KEY_PREFIX)) return;
        const account = e.key.slice(KEY_PREFIX.length);
        if (!account) return;
        cache.delete(account);
        notify(account, readFeedSeen(account), { head: 0, changed: true });
    });
}
