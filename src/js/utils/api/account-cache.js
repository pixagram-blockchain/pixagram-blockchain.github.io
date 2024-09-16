"use strict";

// ── account-cache ──────────────────────────────────────────────────────
// Shared, batched, deduplicated cache for chain account entities and
// their normalized profiles.
//
//   Suggested location: src/utils/api/account-cache.js
//
// Why: `api.accounts.getAccounts()` is currently called independently
// by VotingListModal, MembersListDialog, EditProfileDialog, PostDialog's
// inline comment-author resolution, etc. N components mounting in the
// same frame fire N round-trips.
//
// ── FRESHNESS POLICY: TTL_MS = 0 ──────────────────────────────────────
//
// This module does NOT serve cached account data. Every logical read goes
// to the network, matching pixaproxyapi v4.4.0's rule that an API call
// returns freshly-sanitized data and never a stale object. What remains is
// request-shaping, not caching:
//
//   • In-flight dedup — concurrent requests for the same name share one
//     promise, so a burst of components resolves with one round-trip.
//   • Micro-batching — names requested within a 16 ms window coalesce
//     into ONE `getAccounts([...])` call (chunked at 100, 4 in parallel).
//   • Negative caching (60 s) for usernames the chain says don't exist,
//     so bad @mentions don't hammer the node. This is the ONE deliberate
//     exception to no-stale-reads: it bounds abuse from a post carrying
//     50 bogus @mentions, at the cost of a brand-new account not
//     resolving for up to a minute. `invalidate()` and `{ force: true }`
//     both bypass it.
//
// CONSEQUENCE: because nothing is served from cache, a component that
// calls getProfile() directly in a render path will issue a request per
// render once the previous one settles. Read synchronously with
// `peekProfile()` and fetch in an effect, or hold the result in state.
//
// To re-enable caching, set TTL_MS to a non-zero value — the read path
// still honours it.
//   • One-time normalization — `posting_json_metadata` is parsed HERE,
//     once, instead of in render-adjacent code (PostDialog.js:2817+).
//     Prefers the sanitizer's `_profile` when present, falls back to
//     raw metadata parsing with the same precedence PostDialog uses.
//   • Invalidation — call `invalidate(api, name)` after a profile
//     broadcast (EditProfileDialog save), or emit `account_updated` on
//     `api.eventEmitter` (the cache subscribes lazily, mirroring the
//     `prices_updated` pattern in GDAttributes.js). With TTL_MS = 0 this
//     only matters for negative entries and for `peek*`.
//   • `prime(api, accounts)` — ingest account objects you already have
//     from another call (entities embedded in a post payload) so other
//     views can `peek*` them synchronously without a request.
//
// All functions take `api` as the first argument (matching how every
// component already receives it as a prop); state is keyed per api
// instance via WeakMap, so the long-lived pixaAPI singleton gets one
// shared cache and tests/secondary instances stay isolated. Use
// `bind(api)` for an ergonomically pre-bound bundle.
// ───────────────────────────────────────────────────────────────────────

// 0 = never serve a found account from cache (see FRESHNESS POLICY above).
// Any positive value re-enables normal TTL caching with no other changes.
const TTL_MS      = 0;
const NEG_TTL_MS  = 60_000;      // freshness window for "not found"
// Cap on the store that backs `peek*` only. Nothing is served from it, so this
// trades memory for placeholder coverage and can be lowered freely.
const MAX_ENTRIES = 2000;
// Upper bound on how old a `peek*` result may be. Peeks are placeholders for
// the first paint, so unbounded staleness would reintroduce exactly what
// TTL_MS = 0 is meant to prevent — just on screen instead of in a variable.
const PEEK_MAX_AGE_MS = 5 * 60_000;
const BATCH_MS    = 16;          // coalescing window (~one frame)
const CHUNK_SIZE  = 100;         // names per getAccounts() call
const MAX_PARALLEL = 4;          // concurrent getAccounts() calls per flush

// Keep in sync with PixaEvents.Account.UPDATED in events.js. Not imported
// because this module's final location (src/utils/api/) differs from the auth
// stack's — swap in the import once that path is settled.
const EVT_ACCOUNT_UPDATED = "account_updated";

const STATES = new WeakMap();    // api → state

function st(api) {
    let s = STATES.get(api);
    if (!s) {
        s = {
            cache:    new Map(),  // key → { account, profile, at, neg }
            inflight: new Map(),  // key → shared Promise
            queue:    new Map(),  // key → { res, rej } awaiting next flush
            timer:    0,
            subscribed: false,
        };
        STATES.set(api, s);
    }
    // Retried on EVERY call, not just on creation. `api.eventEmitter` is
    // usually wired during host init; if the first cache read happened before
    // that, the subscription was skipped once and never attempted again —
    // invalidation was then silently dead for the lifetime of the api instance.
    if (!s.subscribed) subscribeInvalidation(api, s);
    return s;
}

// Lazy, guarded subscription — a no-op if the host never emits the event.
function subscribeInvalidation(api, s) {
    const ee = api && api.eventEmitter;
    if (s.subscribed || !ee || typeof ee.on !== "function") return;
    s.subscribed = true;
    ee.on(EVT_ACCOUNT_UPDATED, (payload) => {
        const name = typeof payload === "string"
            ? payload
            : payload && (payload.username || payload.account || payload.name);
        if (name) s.cache.delete(key(name));
    });
}

// Chain usernames are lowercase; normalize so "Voter" and "voter" share
// one entry and one request.
const key = (name) => String(name || "").trim().toLowerCase();

function parseMeta(raw) {
    if (!raw) return null;
    if (typeof raw !== "string") return raw;
    try { return JSON.parse(raw); } catch (e) { return null; }
}

// Same field precedence as PostDialog's inline resolver:
// _profile → posting_json_metadata.profile → json_metadata.profile.
function normalizeProfile(k, acc) {
    if (!acc) return null;
    let p = acc._profile || null;
    if (!p) {
        const meta = parseMeta(acc.posting_json_metadata) || parseMeta(acc.json_metadata);
        p = (meta && meta.profile) || {};
    }
    return {
        username: acc.name || acc._entity_id || k,
        name:     p.name || acc.name || k,
        image:    p.profile_image || p.image || "",
        about:    p.about || "",
        website:  p.website || "",
        raw:      acc,
    };
}

function writeEntry(s, k, account) {
    if (s.cache.has(k)) s.cache.delete(k); // refresh insertion order
    s.cache.set(k, {
        account,
        profile: normalizeProfile(k, account),
        at: Date.now(),
        neg: !account,
    });
    if (s.cache.size > MAX_ENTRIES) {
        s.cache.delete(s.cache.keys().next().value); // evict oldest
    }
}

function readFresh(s, k, force) {
    if (force) return undefined;
    const e = s.cache.get(k);
    if (!e) return undefined;
    const ttl = e.neg ? NEG_TTL_MS : TTL_MS;
    // Explicit branch rather than `elapsed <= 0`: with TTL_MS = 0 that
    // comparison is true for entries written in the same millisecond, so a
    // second call would hit or miss depending on how fast the machine is.
    if (ttl <= 0) return undefined;
    return (Date.now() - e.at) <= ttl ? e : undefined;
}

// Register interest in a name; returns the shared in-flight promise.
function enqueue(api, s, k) {
    let p = s.inflight.get(k);
    if (p) return p;
    let resolver;
    p = new Promise((res, rej) => { resolver = { res, rej }; });
    s.inflight.set(k, p);
    s.queue.set(k, resolver);
    if (!s.timer) s.timer = setTimeout(() => flush(api, s), BATCH_MS);
    return p;
}

// Settle exactly once and drop the resolver, so the safety net below can see
// what is still outstanding.
function settle(batch, s, k, method, value) {
    const resolver = batch.get(k);
    if (!resolver) return;
    batch.delete(k);
    s.inflight.delete(k);
    resolver[method](value);
}

async function fetchChunk(api, s, batch, chunk) {
    try {
        const accounts = await api.accounts.getAccounts(chunk);
        const byName = new Map();
        (Array.isArray(accounts) ? accounts : []).forEach((acc) => {
            if (acc) byName.set(key(acc.name || acc._entity_id), acc);
        });
        for (const k of chunk) {
            const acc = byName.get(k) || null;   // null → negative-cached
            writeEntry(s, k, acc);
            settle(batch, s, k, "res", acc);
        }
    } catch (err) {
        // Transport failure: reject this chunk's waiters and clear in-flight
        // so a later call can retry. Nothing is cached.
        for (const k of chunk) settle(batch, s, k, "rej", err);
    }
}

async function flush(api, s) {
    s.timer = 0;
    if (s.queue.size === 0) return;
    const batch = s.queue;
    s.queue = new Map();

    const names = Array.from(batch.keys());
    const chunks = [];
    for (let i = 0; i < names.length; i += CHUNK_SIZE) {
        chunks.push(names.slice(i, i + CHUNK_SIZE));
    }

    try {
        if (!api || !api.accounts || typeof api.accounts.getAccounts !== "function") {
            throw new TypeError("account-cache: api.accounts.getAccounts is not available");
        }

        // Chunks used to be awaited one after another, so 2 000 names meant 20
        // SERIAL round-trips — the batching win was undone by the chunking.
        let next = 0;
        const worker = async () => {
            while (next < chunks.length) {
                await fetchChunk(api, s, batch, chunks[next++]);
            }
        };
        await Promise.all(
            Array.from({ length: Math.min(MAX_PARALLEL, chunks.length) }, worker),
        );
    } catch (err) {
        // Nothing here should throw, but an unexpected one used to leave every
        // remaining waiter pending forever.
        for (const k of Array.from(batch.keys())) settle(batch, s, k, "rej", err);
    } finally {
        for (const k of Array.from(batch.keys())) {
            settle(batch, s, k, "rej", new Error("account-cache: request never settled"));
        }
    }
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Resolve many accounts. Returns Promise<Map<lowercaseName, account|null>>.
 * Duplicates in `usernames` are collapsed; cached names resolve without
 * any network; the rest coalesce into one batched call.
 * opts: { force?: boolean } — bypass the negative cache too. With TTL_MS = 0
 * found accounts are always refetched, so this only affects "not found".
 */
export function getAccounts(api, usernames, opts = {}) {
    const s = st(api);
    const out = new Map();
    const seen = new Set();
    const pending = [];

    for (const n of usernames || []) {
        const k = key(n);
        if (!k || seen.has(k)) continue;
        seen.add(k);
        const e = readFresh(s, k, opts.force);
        if (e !== undefined) {
            out.set(k, e.account);
        } else {
            pending.push(enqueue(api, s, k).then((acc) => { out.set(k, acc); }));
        }
    }
    return pending.length === 0
        ? Promise.resolve(out)
        : Promise.all(pending).then(() => out);
}

/** Resolve one account → Promise<account|null>. */
export function getAccount(api, username, opts = {}) {
    return getAccounts(api, [username], opts)
        .then((m) => m.get(key(username)) ?? null);
}

/** Like getAccounts, but values are normalized profiles (or null). */
export function getProfiles(api, usernames, opts = {}) {
    const s = st(api);
    return getAccounts(api, usernames, opts).then((m) => {
        const out = new Map();
        m.forEach((acc, k) => {
            // Prefer the cached (already normalized) profile, but fall back to
            // normalizing the resolved account. A large concurrent batch can
            // evict this entry via MAX_ENTRIES between resolution and this
            // read, which used to silently yield null for a name we HAD.
            const e = s.cache.get(k);
            if (e && e.profile) out.set(k, e.profile);
            else out.set(k, acc ? normalizeProfile(k, acc) : null);
        });
        return out;
    });
}

/** Resolve one normalized profile → Promise<profile|null>. */
export function getProfile(api, username, opts = {}) {
    return getProfiles(api, [username], opts)
        .then((m) => m.get(key(username)) ?? null);
}

/**
 * Synchronous, never-fetching reads.
 *
 * These are the only readers of the entry store now that TTL_MS = 0, and they
 * are for PLACEHOLDERS — seeding the first paint (avatar, display name) while
 * the real request is in flight, so the row doesn't flicker. Anything a user
 * acts on must come from the promise, not from here.
 *
 * Results older than PEEK_MAX_AGE_MS return null rather than painting data
 * from an arbitrarily distant past.
 */
function peekEntry(api, username) {
    const e = st(api).cache.get(key(username));
    if (!e || e.neg) return null;
    return (Date.now() - e.at) <= PEEK_MAX_AGE_MS ? e : null;
}

export function peekAccount(api, username) {
    const e = peekEntry(api, username);
    return (e && e.account) || null;
}
export function peekProfile(api, username) {
    const e = peekEntry(api, username);
    return (e && e.profile) || null;
}

/**
 * Ingest full account objects obtained elsewhere (e.g. a getAccounts call you
 * haven't migrated yet, or entities embedded in post payloads).
 *
 * With TTL_MS = 0 this no longer produces cache hits — `getAccount()` will
 * still go to the network. What it buys is a synchronous `peek*` for those
 * names, i.e. a first paint without a request, plus one-time profile
 * normalization done here instead of in render-adjacent code.
 */
export function prime(api, accounts) {
    const s = st(api);
    for (const acc of accounts || []) {
        if (!acc) continue;
        const k = key(acc.name || acc._entity_id);
        if (k) writeEntry(s, k, acc);
    }
}

/** Drop one name, a list of names, or (with no names) the whole cache. */
export function invalidate(api, names) {
    const s = st(api);
    if (names == null) { s.cache.clear(); return; }
    const list = Array.isArray(names) ? names : [names];
    for (const n of list) s.cache.delete(key(n));
}

/**
 * Drop all state for an api instance and cancel any pending flush.
 *
 * Only needed for tests and short-lived api instances — the long-lived
 * pixaAPI singleton should keep its cache. Note that the event subscription
 * cannot be removed without an `off`; a disposed cache that later receives
 * `account_updated` simply deletes from an empty Map.
 */
export function dispose(api) {
    const s = STATES.get(api);
    if (!s) return;
    if (s.timer) { clearTimeout(s.timer); s.timer = 0; }
    for (const [k, resolver] of s.queue) {
        s.inflight.delete(k);
        resolver.rej(new Error("account-cache: disposed"));
    }
    s.queue.clear();
    s.cache.clear();
    s.inflight.clear();
}

/** Ergonomic pre-bound bundle for components that hold `api` as a prop. */
export function bind(api) {
    return {
        getAccount:  (n, o) => getAccount(api, n, o),
        getAccounts: (n, o) => getAccounts(api, n, o),
        getProfile:  (n, o) => getProfile(api, n, o),
        getProfiles: (n, o) => getProfiles(api, n, o),
        peekAccount: (n)    => peekAccount(api, n),
        peekProfile: (n)    => peekProfile(api, n),
        prime:       (a)    => prime(api, a),
        invalidate:  (n)    => invalidate(api, n),
        dispose:     ()     => dispose(api),
    };
}
