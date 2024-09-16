/**
 * ConnectivityMonitor — Standalone offline/online detection.
 *
 * Combines navigator.onLine with optional heartbeat pings to detect
 * actual reachability (navigator.onLine lies on some platforms).
 *
 * Fully standalone — no circular imports.
 *
 * @version 2.0.0
 * @module ConnectivityMonitor
 */

import { PixaEvents } from './events.js';

// ============================================
// Configuration
// ============================================

/** @typedef {object} ConnectivityConfig
 *  @property {string|null}  [heartbeatUrl=null]       — URL to ping for reachability
 *  @property {number}       [heartbeatInterval=30000]  — ms between heartbeat pings
 *  @property {number}       [heartbeatTimeout=5000]    — max wait for heartbeat response
 *  @property {number}       [retryDelay=3000]          — delay before retrying after offline
 */

const DEFAULTS = Object.freeze({
    heartbeatUrl:      null,
    heartbeatInterval: 30_000,
    heartbeatTimeout:  5_000,
    retryDelay:        3_000,
});

// ============================================
// ConnectivityMonitor Class
// ============================================

export class ConnectivityMonitor {

    // ── Private fields ──────────────────────────────

    /** @type {boolean} — current connectivity belief */
    #online;
    /** @type {string|null} */
    #heartbeatUrl;
    /** @type {number} */
    #heartbeatInterval;
    /** @type {number} */
    #heartbeatTimeout;
    /** @type {number} — poll interval while we believe we're offline */
    #retryDelay;

    /** @type {object|null} — shared EventEmitter */
    #emitter = null;
    /** @type {ReturnType<typeof setTimeout>|null} */
    #heartbeatTimer = null;
    /** @type {boolean} */
    #initialized = false;
    /** @type {boolean} — guards against overlapping heartbeats */
    #beating = false;

    /** @type {Function} — bound handler for cleanup */
    #onBrowserOnline;
    /** @type {Function} — bound handler for cleanup */
    #onBrowserOffline;
    /** @type {Function} — bound handler for cleanup */
    #onVisibilityChange;

    // ── Constructor ─────────────────────────────────

    /**
     * @param {ConnectivityConfig} [config={}]
     */
    constructor(config = {}) {
        const cfg = { ...DEFAULTS, ...config };

        this.#online            = typeof navigator !== 'undefined' ? navigator.onLine : true;
        this.#heartbeatUrl      = cfg.heartbeatUrl;
        this.#heartbeatInterval = cfg.heartbeatInterval;
        this.#heartbeatTimeout  = cfg.heartbeatTimeout;
        this.#retryDelay        = cfg.retryDelay;

        // Bind once for clean add/removeEventListener pairing
        this.#onBrowserOnline  = () => this.#setOnline(true, 'browser');
        this.#onBrowserOffline = () => this.#setOnline(false, 'browser');
        this.#onVisibilityChange = () => {
            // Background tabs have their timers throttled to ~1/min or stopped
            // outright, so the cached verdict is often stale by the time the
            // user comes back. Re-check on the way in.
            if (globalThis.document?.visibilityState === 'visible') this.checkNow();
        };
    }

    // ── Public getters ──────────────────────────────

    /** Whether we believe the client is currently online. */
    get isOnline() {
        return this.#online;
    }

    /** Whether the monitor has been initialized. */
    get isInitialized() {
        return this.#initialized;
    }

    // ── Lifecycle ───────────────────────────────────

    /**
     * Initialize — attach browser events and start heartbeat.
     * @param {object} eventEmitter — Shared event emitter (must support .emit)
     */
    initialize(eventEmitter) {
        if (this.#initialized) return;

        this.#emitter = eventEmitter;
        this.#initialized = true;

        if (typeof window !== 'undefined') {
            window.addEventListener('online',  this.#onBrowserOnline);
            window.addEventListener('offline', this.#onBrowserOffline);
        }

        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', this.#onVisibilityChange);
        }

        // Sync with browser state. Routed through #setOnline rather than
        // assigning #online directly: if connectivity changed between
        // construction and initialize(), that transition used to be swallowed
        // and no CHANGED event was ever emitted for it.
        if (typeof navigator !== 'undefined') {
            this.#setOnline(navigator.onLine, 'browser');
        }

        if (this.#heartbeatUrl) {
            this.#startHeartbeat();
        }
    }

    /**
     * Tear down all listeners and timers.
     */
    destroy() {
        this.#initialized = false;

        if (typeof window !== 'undefined') {
            window.removeEventListener('online',  this.#onBrowserOnline);
            window.removeEventListener('offline', this.#onBrowserOffline);
        }
        if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', this.#onVisibilityChange);
        }

        this.#stopHeartbeat();
        this.#emitter = null;
    }

    // ── Manual check ────────────────────────────────

    /**
     * Force a connectivity check right now.
     * Useful after a failed API call to re-evaluate state.
     *
     * @returns {Promise<boolean>} Current online state after check
     */
    async checkNow() {
        if (this.#heartbeatUrl) {
            await this.#doHeartbeat();
        } else {
            const browserState = typeof navigator !== 'undefined' ? navigator.onLine : true;
            if (browserState !== this.#online) {
                this.#setOnline(browserState, 'browser');
            }
        }
        return this.#online;
    }

    // ── Heartbeat internals ─────────────────────────

    /**
     * @private
     * Self-rescheduling chain rather than setInterval, so the cadence can
     * differ by state: `retryDelay` while offline (previously configured,
     * documented, and never used — offline recovery was stuck at the full
     * heartbeatInterval), heartbeatInterval while online.
     */
    #startHeartbeat() {
        this.#doHeartbeat().finally(() => this.#scheduleNextHeartbeat());
    }

    /** @private */
    #scheduleNextHeartbeat() {
        if (!this.#initialized || !this.#heartbeatUrl) return;
        const delay = this.#online ? this.#heartbeatInterval : this.#retryDelay;
        this.#heartbeatTimer = setTimeout(() => {
            this.#heartbeatTimer = null;
            this.#doHeartbeat().finally(() => this.#scheduleNextHeartbeat());
        }, delay);
    }

    /** @private */
    #stopHeartbeat() {
        if (this.#heartbeatTimer !== null) {
            clearTimeout(this.#heartbeatTimer);
            this.#heartbeatTimer = null;
        }
    }

    /** @private */
    async #doHeartbeat() {
        if (!this.#heartbeatUrl) return;
        if (this.#beating) return;          // don't pile up on a slow network
        this.#beating = true;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.#heartbeatTimeout);
        let reachable;

        try {
            // NOTE: mode 'no-cors' yields an opaque response, so this proves
            // only that the request reached *something* — a captive portal's
            // 200 login page counts as reachable. Point heartbeatUrl at a
            // same-origin path and drop 'no-cors' if you want to read status.
            await fetch(this.#heartbeatUrl, {
                method:  'HEAD',
                mode:    'no-cors',
                cache:   'no-store',
                signal:  controller.signal,
            });
            reachable = true;
        } catch {
            // Unreachable — navigator.onLine lied (captive portal, DNS failure)
            reachable = false;
        } finally {
            clearTimeout(timeoutId);
            this.#beating = false;
        }

        // A late-resolving fetch must not resurrect a destroyed monitor.
        if (!this.#initialized) return;

        if (reachable !== this.#online) {
            this.#setOnline(reachable, 'heartbeat');
        }
    }

    // ── State transition ────────────────────────────

    /** @private */
    #setOnline(online, source) {
        if (!this.#initialized) return;   // ignore anything arriving after destroy()
        const changed = online !== this.#online;
        this.#online = online;

        if (changed && this.#emitter) {
            this.#emitter.emit(PixaEvents.Connectivity.CHANGED, { online, source });

            if (online) {
                console.info(`[ConnectivityMonitor] Back online (detected by ${source})`);
            } else {
                console.warn(`[ConnectivityMonitor] Went offline (detected by ${source})`);
            }
        }
    }
}

export default ConnectivityMonitor;
