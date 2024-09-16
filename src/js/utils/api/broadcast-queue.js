/**
 * BroadcastQueue — Offline-aware operation queue for blockchain broadcasts.
 *
 * Queues write operations (votes, comments, follows) when offline and
 * drains them automatically on reconnect. Financial operations (transfers,
 * power-ups) are NEVER queued — they fail immediately for safety.
 *
 * @version 2.0.0
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

// ============================================
// Configuration
// ============================================

/** @typedef {object} BroadcastQueueConfig
 *  @property {number}   [maxRetries=3]
 *  @property {number}   [maxAge=86400000]      — ms before ops expire
 *  @property {number}   [retryBaseDelay=2000]   — exponential backoff base
 *  @property {number}   [confirmTimeout=60000]  — ms to wait for user confirm
 *  @property {number}   [drainDelay=1500]       — ms to wait after reconnect before draining
 */

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

        this.#onConnectivityChanged = ({ online }) => {
            if (!online) return;
            // Tracked + coalesced: previously every CHANGED event scheduled an
            // untracked timer that could still fire after destroy().
            if (this.#drainTimer !== null) clearTimeout(this.#drainTimer);
            this.#drainTimer = setTimeout(() => {
                this.#drainTimer = null;
                this.#drain();
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

        await this.#recoverInterrupted();
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
            return all
                .filter(e => e.status === 'pending')
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
            return all
                .filter(e => e.status === 'failed')
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
     * Manually trigger a drain (e.g. from a "Retry" button).
     * @returns {Promise<{ succeeded: number, failed: number, cancelled: number }>}
     */
    async drain() {
        return this.#drain();
    }

    // ════════════════════════════════════════════════
    // Private Methods
    // ════════════════════════════════════════════════

    // ── Queue management ────────────────────────────

    async #addToQueue(opType, operations, meta, policy) {
        const dedupKey = BroadcastQueue.#buildDedupKey(opType, meta);

        // Dedup: if an identical pending entry exists, replace it
        const existing = await this.#findByDedupKey(dedupKey);
        if (existing) {
            await this.#collection.update(existing.id, {
                operations,
                meta,
                updated_at: Date.now(),
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
        const entry = {
            id,
            opType,
            operations,
            meta,
            policy,
            dedupKey,
            status:     'pending',
            attempts:   0,
            next_attempt_at: 0,
            created_at: Date.now(),
            updated_at: Date.now(),
            lastError:  null,
            result:     null,
        };

        await this.#collection.add(entry, { id });
        this.#emitter?.emit(PixaEvents.Broadcast.QUEUED, { id, opType, meta });
        return { queued: true, id };
    }

    // ── Drain logic ─────────────────────────────────

    async #drain() {
        if (this.#draining)               return { succeeded: 0, failed: 0, cancelled: 0, deferred: 0 };
        if (!this.#connectivity.isOnline)  return { succeeded: 0, failed: 0, cancelled: 0, deferred: 0 };
        if (!this.#collection)             return { succeeded: 0, failed: 0, cancelled: 0, deferred: 0 };

        // Pre-drain PIN check: if session is locked, prompt instead of failing
        if (this.#isLockedFn?.()) {
            const pending = await this.getPending();
            if (pending.length > 0) {
                this.#emitter?.emit(PixaEvents.Broadcast.PIN_REQUIRED, { count: pending.length });
            }
            return { succeeded: 0, failed: 0, cancelled: 0, deferred: 0 };
        }

        this.#draining = true;
        const results = { succeeded: 0, failed: 0, cancelled: 0, deferred: 0 };

        try {
            const pending = await this.getPending();
            if (pending.length === 0) return results;

            this.#emitter?.emit(PixaEvents.Broadcast.DRAINING, { count: pending.length });

            const now = Date.now();
            for (const entry of pending) {
                // Backoff is now a timestamp on the entry. It used to be an
                // `await sleep(delay)` inside this loop, which didn't retry the
                // failing entry at all — it just stalled every entry behind it.
                if (entry.next_attempt_at && entry.next_attempt_at > now) {
                    results.deferred++;
                    continue;
                }
                await this.#drainEntry(entry, results);
                if (!this.#connectivity.isOnline) break;
            }
        } finally {
            this.#draining = false;
        }

        this.#emitter?.emit(PixaEvents.Broadcast.DRAIN_COMPLETE, results);
        return results;
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

    static #buildDedupKey(opType, meta) {
        const parts = [opType];
        if (meta.account)  parts.push(meta.account);
        if (meta.voter)    parts.push(meta.voter);
        if (meta.author)   parts.push(meta.author);
        if (meta.permlink) parts.push(meta.permlink);
        if (meta.id)       parts.push(meta.id);
        return parts.join('|');
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
                              || entry.status === 'expired';

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
