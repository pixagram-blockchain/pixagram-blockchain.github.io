"use strict";

// ── PagedLoader ────────────────────────────────────────────────────────
// Progressive replacement for the `while (true)` fetch-all loops in
// MembersListDialog and FollowListModal (and any future cursor-paged
// endpoint: listSubscribers, getFollowers, getFollowing, …).
//
//   Suggested location: src/utils/api/paged-list.js
//
// Two ways to drive it:
//
//   start()     STREAM — fetch every page back to back (the original
//               behaviour; MembersListDialog and the follow-checkbox set
//               still use it).
//
//   loadMore()  ON DEMAND — fetch exactly one more page and stop. Used by
//               infinite-scroll lists: call it when the user nears the end.
//               Re-entrant safe: while a page is in flight it returns that
//               same promise instead of firing a second request, and once
//               the list has ended it resolves immediately without a call.
//
// State a UI can read at any time:
//   loading  — a page request is in flight
//   hasMore  — more pages may exist (not ended, not errored, not cancelled)
//   done     — ended (naturally, by cap, or by error)
//   error    — the transport error that stopped it, if any
//
// Correctness guarantees:
//
//   • Seen-set dedup — chain cursor endpoints repeat the cursor row as
//     the first element of the next page; the seen-set covers that AND
//     pathological repeats, so paging provably terminates.
//   • Raw-tail cursor — the next cursor comes from the raw batch tail, so
//     a page whose rows were all already seen doesn't stall paging; it
//     only gives up after `maxEmptyPages` consecutive such pages, or when
//     the cursor stops advancing.
//   • A page that is fully deduped is NOT reported to loadMore() callers as
//     "a page": loadMore() keeps going until it has something new or the
//     list has ended, so a scroll trigger can never spin on empty pages.
//   • Hard caps — `maxItems` and a `maxPages` backstop.
//   • Cancellation — `cancel()` makes all subsequent callbacks no-ops;
//     in-flight responses are silently dropped.
//
// Options:
//   fetchPage(cursor, limit) → Promise<array>   cursor is null on page 1
//   itemKey(item)            → string           dedup key AND next cursor
//   limit      = 100
//   maxItems   = Infinity
//   maxPages   = 200
//   maxEmptyPages = 3
//   onPage(items, { fresh, page, done })        items is a fresh copy;
//                                               fresh = new items this page;
//                                               done=true on the final page.
//                                               Fires exactly ONCE with
//                                               done=true on every natural
//                                               completion path (including an
//                                               empty first page).
//   onDone(items)                               after natural completion ONLY
//   onError(err, items)                         transport error → loader
//                                               stops, keeps partial data.
//                                               onDone is NOT called.
// ───────────────────────────────────────────────────────────────────────

export class PagedLoader {
    constructor(opts) {
        this._fetchPage = opts.fetchPage;
        this._itemKey   = opts.itemKey;
        this._limit     = opts.limit    ?? 100;
        this._maxItems  = opts.maxItems ?? Infinity;
        this._maxPages  = opts.maxPages ?? 200;
        this._maxEmpty  = opts.maxEmptyPages ?? 3;
        this._onPage    = opts.onPage   || null;
        this._onDone    = opts.onDone   || null;
        this._onError   = opts.onError  || null;

        if (typeof this._fetchPage !== 'function') throw new TypeError('PagedLoader: fetchPage is required');
        if (typeof this._itemKey   !== 'function') throw new TypeError('PagedLoader: itemKey is required');

        this._items      = [];
        this._seen       = new Set();
        this._cancelled  = false;
        this._done       = false;
        this._error      = null;
        this._promise    = null;   // start() stream
        this._inflight   = null;   // current one-page request

        this._cursor     = null;
        this._page       = 0;
        this._emptyPages = 0;
        this._owesFinal  = true;   // a done:true onPage is still owed
    }

    get items()     { return this._items; }
    get count()     { return this._items.length; }
    get done()      { return this._done; }
    get cancelled() { return this._cancelled; }
    /** The transport error that stopped the loader, if any. */
    get error()     { return this._error; }
    /** A page request is in flight. */
    get loading()   { return this._inflight !== null; }
    /** More pages may exist. False once ended, errored or cancelled. */
    get hasMore()   { return !this._done && !this._cancelled; }

    /** Idempotent. After cancel(), no callback will ever fire again. */
    cancel() { this._cancelled = true; }

    /**
     * Stream every page back to back. Resolves with the accumulated items
     * when the loader finishes, errors out, or is cancelled. Calling it
     * again returns the SAME promise.
     */
    start() {
        if (!this._promise) this._promise = this.#stream();
        return this._promise;
    }

    /**
     * Fetch the next page only. Resolves with the accumulated items.
     * No-op (resolved) when the list has ended; returns the in-flight
     * promise when a page is already loading.
     */
    loadMore() {
        if (!this.hasMore) return Promise.resolve(this._items);
        if (this._inflight) return this._inflight;
        const p = this.#nextPage().then(
            (items) => { this._inflight = null; return items; },
            (err)   => { this._inflight = null; throw err; },
        );
        this._inflight = p;
        return p;
    }

    async #stream() {
        while (this.hasMore) await this.loadMore();
        return this._items;
    }

    /** Fetch until one page brings something new, or the list ends. */
    async #nextPage() {
        while (this.hasMore) {
            let batch;
            try {
                batch = await this._fetchPage(this._cursor, this._limit);
            } catch (err) {
                this._error = err;
                this._done  = true;
                if (!this._cancelled && this._onError) {
                    this._onError(err, this._items.slice());
                }
                return this._items;   // deliberately NOT onDone
            }

            if (this._cancelled) return this._items;
            if (!Array.isArray(batch) || batch.length === 0) {
                this.#finish();
                return this._items;
            }

            const fresh = [];
            let capReached = false;
            for (const item of batch) {
                const k = this._itemKey(item);
                if (k == null || this._seen.has(k)) continue;
                this._seen.add(k);
                fresh.push(item);
                if (this._items.length + fresh.length >= this._maxItems) { capReached = true; break; }
            }

            this._items.push(...fresh);
            this._page++;
            this._emptyPages = fresh.length === 0 ? this._emptyPages + 1 : 0;

            const nextCursor = this._itemKey(batch[batch.length - 1]);

            const exhausted = batch.length < this._limit;
            const capped    = capReached || this._items.length >= this._maxItems || this._page >= this._maxPages;
            const stalled   = this._emptyPages >= this._maxEmpty;
            const stuck     = nextCursor == null || nextCursor === this._cursor;
            const willStop  = exhausted || capped || stalled || stuck;

            if (willStop) this._done = true;
            if (this._onPage && (fresh.length > 0 || willStop)) {
                this._onPage(this._items.slice(), { fresh, page: this._page, done: willStop });
                if (willStop) this._owesFinal = false;
            }
            if (willStop) {
                this.#finish();
                return this._items;
            }

            this._cursor = nextCursor;
            if (fresh.length > 0) return this._items;   // one page delivered
            // Fully deduped page: keep going from the raw tail.
        }
        return this._items;
    }

    #finish() {
        this._done = true;
        if (this._cancelled) return;
        // Covers the empty-batch and empty-first-page exits, so consumers
        // can rely on exactly one done:true to clear their loading state.
        if (this._owesFinal && this._onPage) {
            this._onPage(this._items.slice(), { fresh: [], page: this._page, done: true });
        }
        this._owesFinal = false;
        if (this._onDone) this._onDone(this._items.slice());
    }
}

export default PagedLoader;
