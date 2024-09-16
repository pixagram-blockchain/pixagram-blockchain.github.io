"use strict";

// ── PagedLoader ────────────────────────────────────────────────────────
// Progressive replacement for the `while (true)` fetch-all loops in
// MembersListDialog and FollowListModal (and any future cursor-paged
// endpoint: listSubscribers, getFollowers, getFollowing, …).
//
//   Suggested location: src/utils/api/paged-list.js
//
// Behavior change vs. the old loops:
//
//   OLD: fetch page 1 → page 2 → … → page N serially, THEN hydrate,
//        THEN render. A 2 000-member community = up to 20 serial
//        round-trips behind a spinner before a single row appears.
//
//   NEW: `onPage` fires after EVERY page (including the first), so the
//        UI renders the first 100 rows after ONE round-trip and streams
//        the rest in while the user is already scrolling/searching.
//
// Correctness guarantees the old loops only approximated:
//
//   • Seen-set dedup — chain cursor endpoints repeat the cursor row as
//     the first element of the next page (the old code handled this
//     with `filter(s => s[0] !== last)` / `slice(1)`); the seen-set
//     subsumes both AND protects against pathological repeats, so the
//     loop provably terminates.
//   • Hard caps — `maxItems` (same 2000 / 1000 ceilings as before) and
//     a `maxPages` backstop.
//   • Cancellation — `cancel()` makes all subsequent callbacks no-ops.
//     Call it when the dialog closes or its target changes; in-flight
//     responses are silently dropped.
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
//                                               done=true on every completion
//                                               path (including an empty
//                                               first page).
//   onDone(items)                               after natural completion ONLY
//   onError(err, items)                         transport error → loader
//                                               stops, keeps partial data.
//                                               onDone is NOT called.
//
// Fixes vs. the first cut:
//
//   • onError used to be followed by onDone, so a transport failure looked
//     like a successful completion to the consumer.
//   • `fresh.length === 0` used to break out of the loop, which contradicted
//     the raw-tail-cursor design two comments above: a page whose rows were
//     all already seen (overlapping cursor windows, a reorg) silently ended
//     pagination mid-list and reported success. Now paging continues from the
//     raw tail and only gives up after `maxEmptyPages` consecutive pages with
//     nothing new — or when the cursor stops advancing, which is the real
//     non-termination risk.
//   • onPage(done:true) is guaranteed, so spinners always get turned off.
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

        this._items     = [];
        this._seen      = new Set();
        this._cancelled = false;
        this._done      = false;
        this._error     = null;
        this._promise   = null;
    }

    get items()     { return this._items; }
    get count()     { return this._items.length; }
    get done()      { return this._done; }
    get cancelled() { return this._cancelled; }
    /** The transport error that stopped the loader, if any. */
    get error()     { return this._error; }

    /** Idempotent. After cancel(), no callback will ever fire again. */
    cancel() { this._cancelled = true; }

    /**
     * Begin streaming pages. Resolves with the accumulated items when
     * the loader finishes, errors out, or is cancelled. Safe to ignore
     * the returned promise — all delivery happens through callbacks.
     *
     * Calling start() again returns the SAME promise rather than resolving
     * immediately with a half-filled array.
     */
    start() {
        if (!this._promise) this._promise = this.#run();
        return this._promise;
    }

    async #run() {
        let cursor     = null;
        let page       = 0;
        let emptyPages = 0;
        let owesFinal  = true;   // a done:true onPage is still owed

        while (!this._cancelled) {
            let batch;
            try {
                batch = await this._fetchPage(cursor, this._limit);
            } catch (err) {
                this._error = err;
                this._done  = true;
                if (!this._cancelled && this._onError) {
                    this._onError(err, this._items.slice());
                }
                return this._items;   // deliberately NOT onDone
            }

            if (this._cancelled) break;
            if (!Array.isArray(batch) || batch.length === 0) break;

            // Dedup against everything already accepted (covers the
            // repeated-cursor-row convention and any server hiccups).
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
            page++;
            emptyPages = fresh.length === 0 ? emptyPages + 1 : 0;

            // Next cursor comes from the RAW batch tail (chain convention),
            // not from `fresh`, so a fully-deduped page can't stall paging.
            const nextCursor = this._itemKey(batch[batch.length - 1]);

            const exhausted = batch.length < this._limit;
            const capped    = capReached || this._items.length >= this._maxItems || page >= this._maxPages;
            const stalled   = emptyPages >= this._maxEmpty;
            const stuck     = nextCursor == null || nextCursor === cursor;
            const willStop  = exhausted || capped || stalled || stuck;

            if (this._onPage && (fresh.length > 0 || willStop)) {
                this._onPage(this._items.slice(), { fresh, page, done: willStop });
                if (willStop) owesFinal = false;
            }
            if (willStop) break;

            cursor = nextCursor;
        }

        this._done = true;
        if (!this._cancelled) {
            // Covers the empty-batch and empty-first-page exits, so consumers
            // can rely on exactly one done:true to clear their loading state.
            if (owesFinal && this._onPage) {
                this._onPage(this._items.slice(), { fresh: [], page, done: true });
            }
            if (this._onDone) this._onDone(this._items.slice());
        }
        return this._items;
    }
}

export default PagedLoader;
