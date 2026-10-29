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
 * v1.1.0 — multi-account sessions (session-manager v7 / pixaproxyapi v4.8):
 * Account.LIST_CHANGED, Session.REFRESHED and Session.DEACTIVATED are new;
 * Account.SWITCHED is now emitted (nothing did before); the Session.ENDED,
 * CREATED, RESUMED and PIN.LOCKED payloads carry the fields documented below;
 * broadcast-queue events name the account.
 *
 * @version 1.1.0
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
    // Several accounts can be logged in (session-manager v7): one is ACTIVE
    // per tab, the others are parked. These events are about the active one.
    Session: {
        /** @payload {{ account: string, sessionId?: string, mode: 'pin'|'persist'|'ephemeral',
         *              persistent: boolean, pinProtected?: boolean, previous?: string|null }}
         *  sessionId is omitted for ephemeral sessions. `previous`: the account
         *  that was active before — parked by this login, not logged out. */
        CREATED:    'session_created',
        /** @payload {{ account: string, reason?: 'refreshed'|'replaced' }}
         *  reason 'refreshed': reopened after a stale local deadline (another
         *  tab had kept the session in use); 'replaced': reloaded from its row
         *  (a newer login of the account, or its PIN removed, in another tab). */
        RESUMED:    'session_resumed',
        /** @payload {{ account: string, reason?: string, phase?: 'resume' }} */
        EXPIRED:    'session_expired',
        /** @payload {{ account: string|null, reason?: string, next?: string,
         *              switching?: boolean, all?: boolean }}
         *  reason: 'logout' | 'expired' | 'remote' (logged out in another tab)
         *  | 'wiped' (too many wrong PINs) | 'logout_all'. `switching`: `next`
         *  takes over at once — Account.SWITCHED follows; don't show the
         *  logged-out state in between. */
        ENDED:      'session_ended',
        /** @payload {{ account: string, mode: string }} */
        UPGRADED:   'session_upgraded',
        /** @payload {{ account: string, mode: string }} */
        DOWNGRADED: 'session_downgraded',
        /** @payload {{ account: string, expiresAt: number }} — the active
         *  session's window slid (user presence); re-read the time left. */
        REFRESHED:  'session_refreshed',
        /** @payload {{ account: string, reason: 'expired'|'remote'|'replaced' }}
         *  — the active account's keys just left memory without a call from
         *  this tab; the outcome (ENDED / SWITCHED, or RESUMED / PIN.LOCKED)
         *  follows. For key caches, not for the UI. */
        DEACTIVATED: 'session_deactivated',
    },

    // ── PIN operations ──────────────────────────────
    PIN: {
        /** @payload {{ account: string, reason?: 'refreshed'|'replaced' }}
         *  — keys locked, UI must show PIN dialog */
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
        /** @payload {{ account: string, previous: string|null, reason: string,
         *              replaces: string|null, locked: boolean, persistent: boolean,
         *              pinProtected: boolean, mode: string }}
         *  Another logged-in account became the active one. reason: 'user'
         *  (the Accounts menu) | 'logout' | 'expired' | 'remote' | 'wiped';
         *  `replaces`: the account that left when this one took over. A
         *  PIN-protected account arrives locked. */
        SWITCHED: 'account_switched',
        /** @payload {{ reason: string, account?: string, removed?: string[],
         *              next?: string|null }}
         *  The set of logged-in accounts, or one of their expiries, changed:
         *  re-read api.listAccounts(). `removed`: accounts logged out here. */
        LIST_CHANGED: 'accounts_changed',
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
        /** @payload {{ succeeded: number, failed: number, cancelled: number,
         *              deferred: number, waiting: number }}
         *  `deferred` counts entries skipped because their retry backoff
         *  (next_attempt_at) had not elapsed yet; `waiting`, entries that
         *  cannot go out from here now — another logged-in account's (they
         *  go out once it is the active one), or ones that wait for the page
         *  to be visible (a confirmation, a key to ask for). Also emitted
         *  when only such entries are queued and their number changed. */
        DRAIN_COMPLETE:   'broadcast_drain_complete',
        /** @payload {{ id, opType, meta, account, createdAt, confirm: Function, cancel: Function }} */
        CONFIRM_REQUIRED: 'broadcast_confirm_required',
        /** @payload {{ count: number, account: string|null }} — the active
         *  account's PIN is needed before its queued operations can go out */
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