/**
 * PixaEvents — Centralized event name registry.
 *
 * Every event emitted across the Pixa infrastructure is defined here
 * with its expected payload shape. Replaces string literals scattered
 * across session-manager, pixaproxyapi, broadcast-queue, and UI code.
 *
 * Usage:
 *   import { PixaEvents } from './events.js';
 *   emitter.emit(PixaEvents.Session.CREATED, { account, sessionId, mode });
 *   emitter.on(PixaEvents.PIN.LOCKED, handler);
 *
 * @version 1.0.0
 * @module PixaEvents
 */

/**
 * Deep-freeze an object tree (shallow Object.freeze only freezes top level).
 * @param {object} obj
 * @returns {object} The same object, now deeply frozen
 */
function deepFreeze(obj) {
    Object.freeze(obj);
    for (const value of Object.values(obj)) {
        if (value && typeof value === 'object' && !Object.isFrozen(value)) {
            deepFreeze(value);
        }
    }
    return obj;
}

export const PixaEvents = deepFreeze({

    // ── Session lifecycle ────────────────────────────
    Session: {
        /** @payload {{ account: string, sessionId?: string, mode: 'pin'|'persist'|'ephemeral',
         *              persistent: boolean, pinProtected?: boolean }}
         *  sessionId is omitted for ephemeral sessions. */
        CREATED:    'session_created',
        /** @payload {{ account: string, mode: string }} */
        RESUMED:    'session_resumed',
        /** @payload {{ account: string, reason?: string }} */
        EXPIRED:    'session_expired',
        /** @payload {{ account: string }} */
        ENDED:      'session_ended',
        /** @payload {{ account: string, mode: string }} */
        UPGRADED:   'session_upgraded',
        /** @payload {{ account: string, mode: string }} */
        DOWNGRADED: 'session_downgraded',
    },

    // ── PIN operations ──────────────────────────────
    PIN: {
        /** @payload {{ account: string }} — keys locked, UI must show PIN dialog */
        LOCKED:   'pin_locked',
        /** @payload {{ account: string }} — keys unsealed successfully */
        UNLOCKED: 'pin_unlocked',
        /** @payload {{ account: string }} — user activity, reset inactivity timer */
        ACTIVITY: 'pin_activity',
        /** @payload {{ account: string }} — PIN changed successfully */
        CHANGED:  'pin_changed',
    },

    // ── Account management ──────────────────────────
    Account: {
        /** @payload {{ account: string, mode: string }} */
        SWITCHED: 'account_switched',
        /** @payload {{ account: string }} | string — a profile was broadcast;
         *  account-cache.js subscribes to this to drop its cached entry.
         *  Was a bare 'account_updated' string literal in account-cache. */
        UPDATED:  'account_updated',
    },

    // ── Connectivity ────────────────────────────────
    Connectivity: {
        /** @payload {{ online: boolean, source: 'browser'|'heartbeat' }} */
        CHANGED: 'connectivity_changed',
    },

    // ── Broadcast queue ─────────────────────────────
    Broadcast: {
        /** @payload {{ id: string, opType: string, meta: object }} */
        QUEUED:           'broadcast_queued',
        /** @payload {{ count: number }} */
        DRAINING:         'broadcast_draining',
        /** @payload {{ id: string, opType: string, result: object }} */
        DRAINED:          'broadcast_drained',
        /** @payload {{ id: string, opType: string, error: string, attempts: number }} */
        DRAIN_FAILED:     'broadcast_drain_failed',
        /** @payload {{ succeeded: number, failed: number, cancelled: number, deferred: number }}
         *  `deferred` counts entries skipped because their retry backoff
         *  (next_attempt_at) had not elapsed yet. */
        DRAIN_COMPLETE:   'broadcast_drain_complete',
        /** @payload {{ id, opType, meta, createdAt, confirm: Function, cancel: Function }} */
        CONFIRM_REQUIRED: 'broadcast_confirm_required',
        /** @payload {{ count: number }} — PIN needed before drain can proceed */
        PIN_REQUIRED:     'broadcast_pin_required',
    },

    // ── Vault / key sealing ─────────────────────────
    Vault: {
        /** @payload {{ account: string, error: string }} — seal operation failed */
        SEAL_FAILED: 'vault_seal_failed',
    },
});

/**
 * Every event name in the registry, flattened.
 *
 * The point of this module is that emitters and listeners agree; nothing
 * enforced that, and the payload docs above had already drifted from what
 * SessionManager actually emitted. Wrap your emitter in development:
 *
 *   emit(event, payload) {
 *       if (DEV && !isKnownEvent(event)) console.warn('[events] unknown:', event);
 *       ...
 *   }
 *
 * @type {ReadonlySet<string>}
 */
export const PixaEventNames = Object.freeze(new Set(
    Object.values(PixaEvents).flatMap((group) => Object.values(group)),
));

/**
 * @param {string} event
 * @returns {boolean} whether `event` is declared in this registry
 */
export function isKnownEvent(event) {
    return PixaEventNames.has(event);
}

export default PixaEvents;
