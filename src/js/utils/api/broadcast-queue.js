/**
 * BroadcastQueue — Offline-aware operation queue for blockchain broadcasts.
 *
 * Queues write operations (votes, comments, follows) when offline and
 * drains them automatically on reconnect. Financial operations (transfers,
 * power-ups) are NEVER queued — they fail immediately for safety.
 *
 * v2.1.0 — multi-account sessions (session-manager v7). Several accounts can
 * be logged in; one is active per tab, and only its keys are at hand.
 *   - Every entry records the account that signs it (`account`: meta.account,
 *     else the active account when it was queued).
 *   - A drain sends the ACTIVE account's entries (activeAccountFn, injected
 *     like isLockedFn). The others wait, counted as `waiting`, until that
 *     account is active again — the drain used to ask for the key of
 *     whichever account an entry named, from the background, or sign with
 *     the active account's key. An entry whose broadcast reports
 *     ACCOUNT_NOT_ACTIVE (or KEY_NOT_AVAILABLE, below) goes back to pending
 *     without using up a retry.
 *   - The PIN check before a drain only counts the active account's entries
 *     (a locked parked account used to block nothing, a locked active one
 *     with nothing queued no longer prompts), and PIN_REQUIRED names it.
 *   - cancelAccount(account): a logout drops that account's operations —
 *     they could no longer be signed, must not go out after a later login of
 *     the account, and a logout forgets the account on this device. It
 *     writes a logout mark first (a row, status 'logout'), then deletes the
 *     account's rows. Whatever it cannot reach — a row being sent, by this
 *     tab or another, that a failure writes back; a row left mid-send by a
 *     closed tab — was queued before the mark: never sent, deleted by the
 *     next drain in any tab. The mark goes after maxAge, with the rows it
 *     could concern.
 *   - One drain at a time, across tabs: a drain holds a Web Lock
 *     (navigator.locks; this tab only without it). Each tab has its own
 *     queue over the same store: on reconnect, or when a logout handed over
 *     in every tab, each tab sent the same entries, and a tab starting up
 *     re-queued the row another tab was sending. Under the lock a drain
 *     reads current rows, and a row still marked 'broadcasting' was left by
 *     a tab that closed mid-send (recovered then, not at start-up).
 *   - A drain never waits on the user while it holds the lock in a hidden
 *     tab: entries that need a confirmation, or a key that is not at hand
 *     (KEY_NOT_AVAILABLE from the broadcast), wait for a drain in a visible
 *     tab — a prompt nobody could see held the lock for a minute, then used
 *     up a retry or cancelled a comment.
 *   - A drain asked for while one runs (an account switch during a
 *     confirmation) runs after it, instead of being dropped.
 *   - Dedup by what the operation does, per signer: a newer vote on the same
 *     post, or a newer version of the same comment, replaces the queued one;
 *     any other operation only an identical one. A replaced entry moves to
 *     the end (follow, unfollow, follow again ends followed). The key used to
 *     come from `meta` — operations whose meta named nothing more (follows,
 *     reblogs, other custom_json, witness votes) replaced each other.
 *   - Entries queued before v2.1 (no `account`) drain as before.
 *
 * @version 2.1.0
 * @module BroadcastQueue
 */

import { CryptoUtils } from './crypto-utils.js';
import { PixaEvents }  from './events.js';

// ============================================
// Queue Policy
// ============================================

/**
 * Defines how each operation type is handled when offline.
 *
 *   'queue'         — Silently queue and auto-broadcast on reconnect.
 *   'queue_confirm' — Queue, but require user confirmation before draining.
 *   'fail'          — Throw immediately. Never persist financial ops.
 */
const QueuePolicy = Object.freeze({

    // Idempotent / safe to retry
    vote:                          'queue',
    custom_json:                   'queue',

    // Content — user should review before sending stale content
    comment:                       'queue_confirm',
    delete_comment:                'queue_confirm',

    // Profile
    account_update:                'queue_confirm',
    account_update2:               'queue_confirm',

    // Financial — NEVER QUEUE
    transfer:                      'fail',
    transfer_to_vesting:           'fail',
    withdraw_vesting:              'fail',
    delegate_vesting_shares:       'fail',
    transfer_to_savings:           'fail',
    transfer_from_savings:         'fail',
    cancel_transfer_from_savings:  'fail',
    convert:                       'fail',
    collateralized_convert:        'fail',
    limit_order_create:            'fail',
    limit_order_create2:           'fail',
    limit_order_cancel:            'fail',

    // Governance — safe to queue
    witness_vote:                  'queue',
    account_witness_vote:          'queue',
    account_witness_proxy:         'queue',
    update_proposal_votes:         'queue',

    // Authority changes — too sensitive
    change_recovery_account:       'fail',
    request_account_recovery:      'fail',
    recover_account:               'fail',
    set_withdraw_vesting_route:    'fail',
});

// ============================================
// Error Classes
// ============================================

export class OfflineNotQueueableError extends Error {
    /** @type {string} */
    code = 'OFFLINE_NOT_QUEUEABLE';

    constructor(opType) {
        super(`Operation "${opType}" cannot be queued offline — financial operations require immediate confirmation`);
        this.name = 'OfflineNotQueueableError';
        this.data = { opType };
    }
}

export class OfflineError extends Error {
    /** @type {string} */
    code = 'OFFLINE';

    constructor(message = 'Device is offline') {
        super(message);
        this.name = 'OfflineError';
    }
}

/** Account names as the API normalizes them: trimmed, no leading @, lowercase. */
function normalizeAccount(account) {
    if (typeof account !== 'string') return null;
    return account.trim().replace(/^@+/, '').trim().toLowerCase() || null;
}

/** The account that signs a queued entry (v2.1), or null for entries queued before. */
function entryAccount(entry) {
    return normalizeAccount(entry?.account) ?? normalizeAccount(entry?.meta?.account);
}

/** A drain's result, before it counts anything. */
function none() {
    return { succeeded: 0, failed: 0, cancelled: 0, deferred: 0, waiting: 0 };
}

/** v2.1: broadcast errors that mean "not now", not a failure: the entry waits, no retry used up. */
const NOT_NOW = new Set(['ACCOUNT_NOT_ACTIVE', 'KEY_NOT_AVAILABLE']);

/** v2.1: the page is in a background tab (nobody would see a prompt). */
function pageHidden() {
    return globalThis.document?.visibilityState === 'hidden';
}

/** v2.1: logout marks (rows with status 'logout'): account → time of its last logout here. */
function logoutsOf(rows) {
    const marks = new Map();
    for (const r of rows) {
        if (r?.status === 'logout' && r.account) marks.set(r.account, Math.max(marks.get(r.account) ?? 0, Number(r.created_at) || 0));
    }
    return marks;
}

/** v2.1: queued before its account's last logout here — never to go out. */
function loggedOut(entry, marks) {
    if (entry?.status === 'logout') return false;
    const acc = entryAccount(entry);
    const at = acc ? marks.get(acc) : undefined;
    return at !== undefined && (Number(entry.created_at) || 0) <= at;
}

/** v2.1: this tab's drain lock without the Web Locks API (shared by every queue instance in the page). */
let localTail = Promise.resolve();

// ============================================
// Configuration
// ============================================

/** @typedef {object} BroadcastQueueConfig
 *  @property {number}   [maxRetries=3]
 *  @property {number}   [maxAge=86400000]      — ms before ops expire
 *  @property {number}   [retryBaseDelay=2000]   — exponential backoff base
 *  @property {number}   [confirmTimeout=60000]  — ms to wait for user confirm
 *  @property {number}   [drainDelay=1500]       — ms to wait after reconnect before draining
 *  @property {object|null} [locks]              — v2.1: Web Locks API (default navigator.locks);
 *                                                 null: one drain at a time in this tab only
 */

/** v2.1: the queue's Web Lock (one drain at a time, across tabs). */
const LOCK_NAME = 'pixa_broadcast_queue';

/** v2.1: id prefix of the logout marks (see cancelAccount). */
const LOGOUT_PREFIX = 'logout:';

const DEFAULTS = Object.freeze({
    maxRetries:     3,
    maxAge:         24 * 60 * 60 * 1000,
    retryBaseDelay: 2_000,
    confirmTimeout: 60_000,
    drainDelay:     1_500,
});

// ============================================
// BroadcastQueue Class
// ============================================

export class BroadcastQueue {

    // ── Private fields ──────────────────────────────

    /** @type {object} — LacertaDB database instance */
    #db;
    /** @type {object|null} — LacertaDB collection */
    #collection = null;
    /** @type {import('./connectivity-monitor').ConnectivityMonitor} */
    #connectivity;
    /** @type {object} — shared event emitter */
    #emitter;
    /** @type {object} — merged configuration */
    #config;

    /** @type {boolean} — drain-in-progress guard */
    #draining = false;
    /** @type {boolean} */
    #initialized = false;

    /** @type {Function|null} — actual broadcast function (injected by PixaProxyAPI) */
    #broadcastFn = null;
    /** @type {Function|null} — session lock checker (injected by PixaProxyAPI) */
    #isLockedFn = null;
    /** @type {Function|null} — v2.1: the account active in this tab (injected by PixaProxyAPI) */
    #activeAccountFn = null;
    /** v2.1: the Web Locks API (or a stand-in); null → one drain at a time in this tab only. */
    #locks = null;
    /** v2.1: a drain was asked for while one ran: run another pass after it. */
    #drainAgain = false;
    /** v2.1: last queue time given out (see #stamp). */
    #lastStamp = 0;
    /** v2.1: the `waiting` count last reported by DRAIN_COMPLETE. */
    #lastWaiting = 0;

    /** @type {Function} — bound handler for cleanup */
    #onConnectivityChanged;
    /** @type {ReturnType<typeof setTimeout>|null} — pending post-reconnect drain */
    #drainTimer = null;

    // ── Constructor ─────────────────────────────────

    /**
     * @param {object} db — LacertaDB database instance
     * @param {import('./connectivity-monitor').ConnectivityMonitor} connectivity
     * @param {object} eventEmitter — shared event emitter
     * @param {BroadcastQueueConfig} [config={}]
     */
    constructor(db, connectivity, eventEmitter, config = {}) {
        this.#db           = db;
        this.#connectivity = connectivity;
        this.#emitter      = eventEmitter;
        this.#config       = { ...DEFAULTS, ...config };
        this.#locks        = config.locks !== undefined ? config.locks : (globalThis.navigator?.locks ?? null);

        this.#onConnectivityChanged = ({ online }) => {
            if (!online) return;
            // Tracked + coalesced: previously every CHANGED event scheduled an
            // untracked timer that could still fire after destroy().
            if (this.#drainTimer !== null) clearTimeout(this.#drainTimer);
            this.#drainTimer = setTimeout(() => {
                this.#drainTimer = null;
                this.#drain().catch(() => { /* retried on the next reconnect */ });
            }, this.#config.drainDelay);
        };
    }

    // ── Dependency injection ────────────────────────

    /** Set the function that performs actual blockchain broadcasts. */
    set broadcastFn(fn) {
        if (typeof fn !== 'function') throw new TypeError('broadcastFn must be a function');
        this.#broadcastFn = fn;
    }

    /** Set a function that returns whether the session is PIN-locked. */
    set isLockedFn(fn) {
        if (typeof fn !== 'function') throw new TypeError('isLockedFn must be a function');
        this.#isLockedFn = fn;
    }

    /**
     * v2.1: set a function that returns the account active in this tab (or
     * null). Without one, every entry drains (single-account behaviour).
     */
    set activeAccountFn(fn) {
        if (typeof fn !== 'function') throw new TypeError('activeAccountFn must be a function');
        this.#activeAccountFn = fn;
    }

    // ── Public getters ──────────────────────────────

    /** Whether a drain is currently in progress. */
    get isDraining() { return this.#draining; }

    /** Whether the queue has been initialized. */
    get isInitialized() { return this.#initialized; }

    // ── Lifecycle ───────────────────────────────────

    /** Initialize — create LacertaDB collection and attach listeners. */
    async initialize() {
        if (this.#initialized) return;

        try { await this.#db.createCollection('broadcast_queue'); } catch { /* exists */ }
        this.#collection = await this.#db.getCollection('broadcast_queue');

        this.#emitter?.on(PixaEvents.Connectivity.CHANGED, this.#onConnectivityChanged);
        this.#initialized = true;

        // v2.1: with cross-tab locks, a 'broadcasting' row may be another
        // tab's send in progress: drains recover stranded rows, under the lock.
        if (!this.#crossTab()) await this.#recoverInterrupted();
        await this.#cleanExpired();
    }

    /** Tear down listeners and cancel any pending drain. */
    destroy() {
        this.#initialized = false;
        if (this.#drainTimer !== null) {
            clearTimeout(this.#drainTimer);
            this.#drainTimer = null;
        }
        this.#emitter?.off(PixaEvents.Connectivity.CHANGED, this.#onConnectivityChanged);
    }

    // ── Public API ──────────────────────────────────

    /**
     * Enqueue a broadcast operation (or execute immediately if online).
     *
     * @param {string}  opType     — e.g. 'vote', 'comment', 'transfer'
     * @param {Array}   operations — [[opName, opData], ...] tuples
     * @param {object}  [meta={}]  — metadata for dedup and display
     * @returns {Promise<object>}  — broadcast result if online, queue entry if queued
     * @throws {OfflineNotQueueableError} if policy is 'fail' and offline —
     *         this includes unknown op types, which default to 'fail'
     *         (the previously documented OfflineError is never thrown)
     */
    async enqueue(opType, operations, meta = {}) {
        const policy = QueuePolicy[opType] ?? 'fail';

        // ── Online: try to broadcast immediately ──
        if (this.#connectivity.isOnline) {
            try {
                return await this.#executeBroadcast(opType, operations, meta);
            } catch (e) {
                // Network error? Re-evaluate connectivity
                const stillOnline = await this.#connectivity.checkNow();
                if (stillOnline) throw e; // Genuine broadcast error — propagate
                // Actually offline — fall through to queue logic
            }
        }

        // ── Offline: apply policy ──
        if (policy === 'fail') {
            throw new OfflineNotQueueableError(opType);
        }

        return this.#addToQueue(opType, operations, meta, policy);
    }

    /**
     * Get all pending (not yet drained) operations.
     *
     * 'failed' is TERMINAL and deliberately excluded. It used to be included,
     * so an entry that had exhausted maxRetries was re-broadcast on every
     * subsequent drain forever, with `attempts` climbing past the cap. Use
     * getFailed() + retry() to give the user an explicit retry button.
     *
     * @returns {Promise<object[]>}
     */
    async getPending() {
        if (!this.#collection) return [];
        try {
            const all = await this.#collection.getAll();
            const marks = logoutsOf(all);
            return all
                .filter(e => e.status === 'pending' && !loggedOut(e, marks))
                .sort((a, b) => a.created_at - b.created_at);
        } catch {
            return [];
        }
    }

    /**
     * Get operations that exhausted their retries and need user action.
     * @returns {Promise<object[]>}
     */
    async getFailed() {
        if (!this.#collection) return [];
        try {
            const all = await this.#collection.getAll();
            const marks = logoutsOf(all);
            return all
                .filter(e => e.status === 'failed' && !loggedOut(e, marks))
                .sort((a, b) => a.created_at - b.created_at);
        } catch {
            return [];
        }
    }

    /**
     * Move a failed entry back into the queue with a clean attempt counter.
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async retry(id) {
        if (!this.#collection) return false;
        try {
            await this.#collection.update(id, {
                status: 'pending', attempts: 0, lastError: null,
                next_attempt_at: 0, updated_at: Date.now(),
            });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Re-queue every failed entry.
     * @returns {Promise<number>} Number of entries re-queued
     */
    async retryAll() {
        const failed = await this.getFailed();
        let count = 0;
        for (const entry of failed) {
            if (await this.retry(entry.id)) count++;
        }
        return count;
    }

    /**
     * Cancel a specific queued operation.
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async cancel(id) {
        if (!this.#collection) return false;
        try {
            await this.#collection.update(id, {
                status:     'cancelled',
                updated_at: Date.now(),
            });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Cancel all pending operations.
     * @returns {Promise<number>} Number of cancelled entries
     */
    async cancelAll() {
        const pending = await this.getPending();
        let count = 0;
        for (const entry of pending) {
            if (await this.cancel(entry.id)) count++;
        }
        return count;
    }

    /**
     * v2.1: `account` was logged out on this device: drop every operation it
     * queued — they could no longer be signed here, must not go out after a
     * later login of the account, and a logout forgets the account on this
     * device. Writes the logout mark first, then deletes the account's rows,
     * at once (no waiting for a drain in progress: the page may be closed
     * right after a logout). A row being sent is left to its send; whatever
     * comes back of it, or of a row left mid-send by a closed tab, was queued
     * before the mark — never sent, and deleted by the next drain (any tab).
     * Entries queued before v2.1 carry no account and are left alone.
     * @param {string} account
     * @returns {Promise<number>} Number of operations dropped before they went out
     */
    async cancelAccount(account) {
        const acc = normalizeAccount(account);
        if (!acc || !this.#collection) return 0;
        const now = this.#stamp();
        const id = LOGOUT_PREFIX + acc;
        try {
            await this.#collection.update(id, { created_at: now, updated_at: now });
        } catch {
            try {
                await this.#collection.add({ id, status: 'logout', account: acc, created_at: now, updated_at: now }, { id });
            } catch { /* another tab wrote it meanwhile */ }
        }
        let all = [];
        try { all = await this.#collection.getAll(); } catch { return 0; }
        let count = 0;
        for (const entry of all) {
            if (entry.status === 'logout' || entry.status === 'broadcasting') continue;
            if (entryAccount(entry) !== acc) continue;
            // Queued after the mark: a later login of the account (this runs
            // in the background of the logout, and the user may be quick).
            if ((Number(entry.created_at) || 0) > now) continue;
            try {
                await this.#collection.delete(entry.id);
                if (entry.status === 'pending' || entry.status === 'failed') count++;
            } catch { /* already gone */ }
        }
        return count;
    }

    /**
     * Manually trigger a drain (e.g. from a "Retry" button, or after an
     * account switch: that account's waiting entries can go out now).
     * @returns {Promise<{ succeeded: number, failed: number, cancelled: number, deferred: number, waiting: number }>}
     */
    async drain() {
        return this.#drain();
    }

    // ════════════════════════════════════════════════
    // Private Methods
    // ════════════════════════════════════════════════

    // ── Queue management ────────────────────────────

    async #addToQueue(opType, operations, meta, policy) {
        // v2.1: who signs it — drained only while that account is active.
        const account = normalizeAccount(meta?.account) ?? this.#activeAccount() ?? null;
        const dedupKey = BroadcastQueue.#buildDedupKey(opType, operations, account);

        // Dedup: if an identical pending entry exists, replace it
        const existing = await this.#findByDedupKey(dedupKey);
        if (existing) {
            // v2.1: the newer version moves to the end — it is the latest
            // thing the user did (follow, unfollow, follow again: the follow
            // kept its first place and went out before the unfollow). Its
            // age counts from now too.
            const now = this.#stamp();
            await this.#collection.update(existing.id, {
                operations,
                meta,
                account,
                created_at: now,
                updated_at: now,
                attempts:   0,
                next_attempt_at: 0,
                status:     'pending',
            });
            this.#emitter?.emit(PixaEvents.Broadcast.QUEUED, {
                id: existing.id, opType, meta, replaced: true,
            });
            return { queued: true, id: existing.id, replaced: true };
        }

        // New entry
        const id = CryptoUtils.generateId(16);
        const stamp = this.#stamp();
        const entry = {
            id,
            opType,
            operations,
            meta,
            policy,
            dedupKey,
            account,
            status:     'pending',
            attempts:   0,
            next_attempt_at: 0,
            created_at: stamp,
            updated_at: stamp,
            lastError:  null,
            result:     null,
        };

        await this.#collection.add(entry, { id });
        this.#emitter?.emit(PixaEvents.Broadcast.QUEUED, { id, opType, meta });
        return { queued: true, id };
    }

    // ── Drain logic ─────────────────────────────────

    async #drain() {
        if (this.#draining) {
            // One is running (or waiting for the lock): it runs another pass
            // when done — an account switch or unlock during a confirmation
            // asks for one, and the running pass does not see that account's
            // entries.
            this.#drainAgain = true;
            return none();
        }
        if (!this.#connectivity.isOnline)  return none();
        if (!this.#collection)             return none();

        // Set before any await: two drain() calls close together (the
        // reconnect timer and a switch) both went through.
        this.#draining = true;
        const total = none();
        try {
            do {
                this.#drainAgain = false;
                let r = none();
                try {
                    r = await this.#exclusive(() => this.#drainPass());
                } catch (e) {
                    // A store error: the next pass (asked for meanwhile) or
                    // the next trigger tries again.
                    console.warn('[BroadcastQueue] drain pass failed:', e?.message || e);
                }
                for (const k of ['succeeded', 'failed', 'cancelled', 'deferred']) total[k] += r[k];
                total.waiting = r.waiting;
            } while (this.#drainAgain && this.#initialized && this.#connectivity.isOnline);
        } finally {
            this.#draining = false;
        }
        return total;
    }

    /** One pass over the queue, holding the queue lock (see #exclusive). */
    async #drainPass() {
        const results = none();
        if (!this.#connectivity.isOnline || !this.#collection) return results;

        // No drain runs in another tab meanwhile: rows are read as they are
        // (LacertaDB caches documents per tab), and one still marked
        // 'broadcasting' was left by a tab that closed mid-send.
        try { this.#collection.clearCache?.(); } catch { /* no cache */ }
        if (this.#crossTab()) await this.#recoverInterrupted();
        await this.#sweepLoggedOut();

        // v2.1: only the active account's entries go out; the others wait
        // for their account (see the header).
        const pending = await this.getPending();
        const active = this.#activeAccount();
        const mine = pending.filter((e) => this.#signsHere(e, active));
        results.waiting = pending.length - mine.length;

        if (mine.length === 0) {
            // Nothing to send: report the waiting ones when their number
            // changed (drains also run on every return to the page).
            if (results.waiting !== this.#lastWaiting) this.#complete(results);
            return results;
        }

        // Pre-drain PIN check: if the active session is locked, prompt
        // instead of failing — about its own entries only.
        if (this.#isLockedFn?.()) {
            this.#emitter?.emit(PixaEvents.Broadcast.PIN_REQUIRED, { count: mine.length, account: active ?? null });
            return results;
        }

        this.#emitter?.emit(PixaEvents.Broadcast.DRAINING, { count: mine.length });

        const now = Date.now();
        for (const entry of mine) {
            // v2.1: destroyed meanwhile (the API instance was replaced): its
            // keys are gone — the new instance drains.
            if (!this.#initialized) break;
            // Backoff is now a timestamp on the entry. It used to be an
            // `await sleep(delay)` inside this loop, which didn't retry the
            // failing entry at all — it just stalled every entry behind it.
            if (entry.next_attempt_at && entry.next_attempt_at > now) {
                results.deferred++;
                continue;
            }
            // A switch during the drain: the entries of the account that
            // left wait for it.
            if (!this.#signsHere(entry, this.#activeAccount())) {
                results.waiting++;
                continue;
            }
            // Logged out meanwhile (in another tab, say).
            if (await this.#loggedOutNow(entry)) continue;
            // A confirmation nobody would see: it waits for a visible tab.
            if (entry.policy === 'queue_confirm' && pageHidden()) {
                results.waiting++;
                continue;
            }
            await this.#drainEntry(entry, results);
            if (!this.#connectivity.isOnline) break;
        }

        this.#complete(results);
        return results;
    }

    #complete(results) {
        this.#lastWaiting = results.waiting;
        this.#emitter?.emit(PixaEvents.Broadcast.DRAIN_COMPLETE, results);
    }

    /**
     * v2.1: the queue time of an entry (created_at): increasing within this
     * queue, so two actions in the same millisecond keep their order.
     */
    #stamp() {
        this.#lastStamp = Math.max(Date.now(), this.#lastStamp + 1);
        return this.#lastStamp;
    }

    /** v2.1: whether the queue lock holds across tabs (Web Locks API). */
    #crossTab() {
        return !!(this.#locks && typeof this.#locks.request === 'function');
    }

    /**
     * v2.1: run `fn` (a drain pass) holding the queue lock — across tabs with
     * the Web Locks API (see the header), in this page otherwise.
     */
    #exclusive(fn) {
        if (this.#crossTab()) {
            let started = false;
            let held;
            try {
                held = this.#locks.request(LOCK_NAME, () => { started = true; return fn(); });
            } catch (e) {
                held = Promise.reject(e);
            }
            return held.catch(async (e) => {
                if (started) throw e;
                // Not now (the page is being frozen, say): the next trigger
                // drains. Dropping to this tab's lock would let this tab send
                // beside another tab's drain.
                if (e?.name !== 'SecurityError') return none();
                // No Web Locks on this origin at all: this tab only, as
                // without them — with the start-up recovery that was skipped.
                this.#locks = null;
                await this.#recoverInterrupted();
                return this.#exclusive(fn);
            });
        }
        const run = localTail.then(() => fn());
        localTail = run.catch(() => {});
        return run;
    }

    /** v2.1: delete rows of logged-out accounts queued before their logout (see cancelAccount). */
    async #sweepLoggedOut() {
        let all = [];
        try { all = await this.#collection.getAll(); } catch { return; }
        const marks = logoutsOf(all);
        if (marks.size === 0) return;
        for (const e of all) {
            // 'broadcasting' here: recovered first under the lock; without
            // it, maybe another tab's send in progress — left to it.
            if (e.status === 'broadcasting' || !loggedOut(e, marks)) continue;
            await this.#collection.delete(e.id).catch(() => {});
        }
    }

    /** v2.1: its account was logged out since it was queued (re-read: another tab may just have). Deletes it then. */
    async #loggedOutNow(entry) {
        let all = [];
        try { all = await this.#collection.getAll(); } catch { return false; }
        if (!loggedOut(entry, logoutsOf(all))) return false;
        await this.#collection.delete(entry.id).catch(() => {});
        return true;
    }

    /** v2.1: the account active in this tab; undefined when no activeAccountFn was injected. */
    #activeAccount() {
        if (!this.#activeAccountFn) return undefined;
        try { return normalizeAccount(this.#activeAccountFn()); } catch { return null; }
    }

    /** v2.1: whether `entry` is signed by `active` (entries queued before v2.1 — no account — drain as before). */
    #signsHere(entry, active) {
        if (!this.#activeAccountFn) return true;
        const acc = entryAccount(entry);
        return !acc || acc === active;
    }

    async #drainEntry(entry, results) {
        // Expired?
        if (Date.now() - entry.created_at > this.#config.maxAge) {
            await this.#collection.update(entry.id, { status: 'expired', updated_at: Date.now() });
            results.failed++;
            return;
        }

        // Needs confirmation?
        if (entry.policy === 'queue_confirm') {
            const confirmed = await this.#requestConfirmation(entry);
            if (!confirmed) {
                await this.#collection.update(entry.id, { status: 'cancelled', updated_at: Date.now() });
                results.cancelled++;
                return;
            }
            // v2.1: the user took a while — its account may have been logged
            // out (dropped), or switched away from (it waits, still pending).
            if (await this.#loggedOutNow(entry)) return;
            if (!this.#signsHere(entry, this.#activeAccount())) {
                results.waiting++;
                return;
            }
        }

        // Broadcast
        try {
            await this.#collection.update(entry.id, { status: 'broadcasting', updated_at: Date.now() });

            const result = await this.#executeBroadcast(entry.opType, entry.operations, entry.meta);

            await this.#collection.update(entry.id, {
                status: 'completed', updated_at: Date.now(), result,
            });
            this.#emitter?.emit(PixaEvents.Broadcast.DRAINED, {
                id: entry.id, opType: entry.opType, result,
            });
            results.succeeded++;
        } catch (error) {
            // v2.1: its account is not the active one (any more), or its key
            // is not at hand in this tab: not a failure — back to pending, no
            // retry used up.
            if (NOT_NOW.has(error?.code)) {
                await this.#collection.update(entry.id, { status: 'pending', updated_at: Date.now() }).catch(() => {});
                results.waiting++;
                return;
            }
            const attempts = (entry.attempts ?? 0) + 1;
            const maxedOut = attempts >= this.#config.maxRetries;

            // Exponential backoff, recorded rather than slept through.
            const delay = this.#config.retryBaseDelay * Math.pow(2, attempts - 1);

            await this.#collection.update(entry.id, {
                status:    maxedOut ? 'failed' : 'pending',
                attempts,
                lastError: error.message ?? 'Unknown error',
                next_attempt_at: maxedOut ? 0 : Date.now() + delay,
                updated_at: Date.now(),
            });

            this.#emitter?.emit(PixaEvents.Broadcast.DRAIN_FAILED, {
                id: entry.id, opType: entry.opType,
                error: error.message, attempts, maxedOut,
            });

            if (maxedOut) {
                results.failed++;
            }
        }
    }

    // ── Broadcast execution ─────────────────────────

    async #executeBroadcast(opType, operations, meta) {
        if (!this.#broadcastFn) {
            throw new Error('BroadcastQueue: broadcastFn not injected — call .broadcastFn = fn first');
        }
        return this.#broadcastFn(opType, operations, meta);
    }

    // ── User confirmation ───────────────────────────

    #requestConfirmation(entry) {
        // With no UI attached, every queue_confirm entry used to burn the full
        // confirmTimeout (60 s each, serially) before being cancelled.
        if (!this.#hasListener(PixaEvents.Broadcast.CONFIRM_REQUIRED)) {
            return Promise.resolve(false);
        }

        return new Promise(resolve => {
            const timeout = setTimeout(() => resolve(false), this.#config.confirmTimeout);

            this.#emitter?.emit(PixaEvents.Broadcast.CONFIRM_REQUIRED, {
                id:        entry.id,
                opType:    entry.opType,
                meta:      entry.meta,
                account:   entryAccount(entry),
                createdAt: entry.created_at,
                confirm:   () => { clearTimeout(timeout); resolve(true); },
                cancel:    () => { clearTimeout(timeout); resolve(false); },
            });
        });
    }

    /**
     * Best-effort check for whether anyone is subscribed to an event.
     * Supports the common emitter shapes; assumes "yes" if it can't tell,
     * so an unknown emitter degrades to the old waiting behaviour.
     *
     * @param {string} event
     * @returns {boolean}
     */
    #hasListener(event) {
        const ee = this.#emitter;
        if (!ee) return false;
        try {
            if (typeof ee.listenerCount === 'function') return ee.listenerCount(event) > 0;
            if (typeof ee.listeners === 'function')     return (ee.listeners(event) ?? []).length > 0;
            const bag = ee._events ?? ee.events ?? ee.handlers;
            if (bag) {
                const l = bag instanceof Map ? bag.get(event) : bag[event];
                return Array.isArray(l) ? l.length > 0 : !!l;
            }
        } catch { /* fall through */ }
        return true;
    }

    // ── Crash recovery ──────────────────────────────

    /**
     * Return entries stranded in 'broadcasting' to the queue.
     *
     * An entry is flipped to 'broadcasting' immediately before the network
     * call. If the tab is closed or reloaded mid-flight it stayed there
     * forever: excluded from getPending()'s filter AND from every branch of
     * #cleanExpired(), so the operation was silently lost and the row leaked.
     *
     * Re-queued rather than failed, on the assumption the broadcast did not
     * land. For non-idempotent op types ('comment'), the dedup key prevents a
     * duplicate queue entry but NOT a duplicate on-chain tx — see the note in
     * enqueue() about verifying against chain state before draining content ops.
     *
     * v2.1: called at start-up without cross-tab locks (as before), else by
     * each drain pass, under the lock — at start-up, a 'broadcasting' row may
     * be another tab's send in progress.
     */
    async #recoverInterrupted() {
        try {
            const all = await this.#collection.getAll();
            const now = Date.now();
            for (const entry of all) {
                if (entry.status !== 'broadcasting') continue;
                await this.#collection.update(entry.id, {
                    status: 'pending',
                    lastError: 'interrupted before completion (recovered on startup)',
                    next_attempt_at: 0,
                    updated_at: now,
                }).catch(() => {});
            }
        } catch { /* collection may be empty */ }
    }

    // ── Dedup ───────────────────────────────────────

    /**
     * v2.1: what makes two queued operations "the same", so that the newer
     * replaces the older — per signer: a vote on the same post (the latest
     * weight wins), the same comment (author/permlink: the latest version
     * wins); any other operation only when identical. It used to be built
     * from `meta` (account, voter, author, permlink, id), so operations whose
     * meta named nothing else — follows, reblogs, other custom_json, witness
     * votes — shared one key, and each replaced the previous one.
     */
    static #buildDedupKey(opType, operations, account) {
        const ops = Array.isArray(operations) ? operations : [];
        const op = ops.length === 1 && Array.isArray(ops[0]) ? ops[0][1] : null;
        let what;
        if (op && opType === 'vote') {
            what = [op.voter, op.author, op.permlink];
        } else if (op && (opType === 'comment' || opType === 'delete_comment')) {
            what = [op.author, op.permlink];
        } else {
            try { what = [JSON.stringify(ops)]; } catch { what = [CryptoUtils.generateId(16)]; }
        }
        return [opType, account ?? '', ...what.map((v) => String(v ?? ''))].join('|');
    }

    async #findByDedupKey(dedupKey) {
        if (!dedupKey) return null;
        try {
            const all = await this.#collection.getAll();
            return all.find(e =>
                e.dedupKey === dedupKey && (e.status === 'pending' || e.status === 'failed'),
            ) ?? null;
        } catch {
            return null;
        }
    }

    // ── Cleanup ─────────────────────────────────────

    async #cleanExpired() {
        try {
            const all = await this.#collection.getAll();
            const now = Date.now();

            for (const entry of all) {
                const age = now - entry.created_at;
                if (age <= this.#config.maxAge) continue;

                const terminal = entry.status === 'completed'
                    || entry.status === 'cancelled'
                    || entry.status === 'expired'
                    || entry.status === 'logout';   // v2.1: older than any row it could concern

                if (terminal) {
                    await this.#collection.delete(entry.id).catch(() => {});
                } else if (entry.status === 'pending' || entry.status === 'broadcasting') {
                    // 'broadcasting' was in neither branch before, so stranded
                    // rows never expired and never got cleaned.
                    await this.#collection.update(entry.id, {
                        status: 'expired', updated_at: now,
                    }).catch(() => {});
                }
            }
        } catch { /* collection may be empty */ }
    }
}

export default BroadcastQueue;