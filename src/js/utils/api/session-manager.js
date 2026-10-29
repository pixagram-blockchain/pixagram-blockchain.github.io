/**
 * Session Manager v7 — Multi-account sessions, byte-level key lifecycle.
 *
 * Keys are stored internally as Uint8Array (WIF UTF-8 bytes), never as
 * JS strings. This allows .fill(0) to actually zero the memory on wipe,
 * unlike JS strings which are immutable.
 *
 * Encryption pipeline:
 *   No PIN:  keys(bytes) → DeviceKeyManager.wrap → LacertaDB
 *   PIN:     keys(bytes) → vault.sealKeysBytes → DeviceKeyManager.wrap → LacertaDB
 *
 * v7.0 changes (multi-account, session lifetime):
 *   - Several accounts can be logged in at once. Exactly one is ACTIVE (its
 *     keys may be in memory); the others are PARKED — a persistent session
 *     as its row in `sessions` (device-wrapped, optionally PIN-sealed,
 *     nothing in memory), a tab-only session device-wrapped in memory.
 *     switchTo(account) parks the active account and activates the other one,
 *     listSessions() enumerates every logged-in account with its expiry,
 *     removeSession(account, { handover }) logs one out, endAll() logs out
 *     everyone. createSession() for another account parks the active one
 *     instead of orphaning it.
 *   - Who takes over when the active account leaves (logout with handover,
 *     expiry, a logout in another tab, a PIN wipe) is decided HERE, inside
 *     the operation queue: the successor is loaded first, then
 *     Session.ENDED { account, reason, next, switching } and SWITCHED
 *     { reason, replaces } go out back to back. Decided outside the queue,
 *     a switch landing in between made a logout end the wrong account.
 *   - Default session lifetime is 7 days (was 12 h here and 30 min in the
 *     proxy's CONFIG), never less than config.MIN_SESSION_TIMEOUT (3 days) —
 *     older rows are lifted on their next refresh. The window slides on user
 *     presence (pointer, keyboard, returning to the tab; at most once per
 *     SLIDE_THROTTLE_MS), locked PIN sessions included, and on resume,
 *     unlock and switch, under the absolute cap (MAX_SESSION_LIFETIME). It
 *     used to slide only on resume/unlock, so an active user could be logged
 *     out — row and keys deleted — mid-session. A row without an absolute
 *     cap gets one (created_at + MAX_SESSION_LIFETIME) when it is loaded.
 *   - Nothing is deleted on stale information. A tab's own deadline and
 *     LacertaDB's per-tab document cache can both lag behind another tab
 *     that keeps the account in use, so every "expired → delete" decision
 *     re-reads the row from IndexedDB first, and deletes only the session it
 *     read (session_id). An active session whose window another tab slid is
 *     kept and, if this tab dropped it, reopened. A logout, on the other
 *     hand, ends the ACCOUNT on this device: whichever session of it the row
 *     holds (another tab may have logged it in again), in every tab.
 *   - Expired rows are deleted when found: on resume, listing and switch.
 *     resume() used to run #fullLogout() before #currentAccount was set, so
 *     an expired row — device-wrapped keys included — was never deleted.
 *     unlockWithPin() honours absolute_expires_at too.
 *   - resume() prefers the account THIS tab was using (sessionStorage), then
 *     the last one used on the device, then the most recently active valid
 *     session. Every tab used to resume the device-wide `active_account`, so
 *     a reload — or the instance replacement after an API-node switch —
 *     brought back whatever account another tab had switched to.
 *   - State-changing operations run one at a time (#serial), every row write
 *     included: LacertaDB's update() is read-then-put, so a write racing a
 *     logout could re-create the deleted row, and an unlock finishing after
 *     a switch could install one account's keys as another's.
 *   - Tabs: logouts and deletions ('removed': the session_id of the row
 *     deleted, `all` for a logout), window slides ('refreshed') and other
 *     changes ('changed': logins, switches, PIN changes) are broadcast. A tab
 *     drops the keys of an account logged out elsewhere (and hands over),
 *     refuses to activate it if a load was in flight (tombstones), and
 *     deletes the row again if one of its own writes put it back. Slides
 *     keep the other tabs' deadlines in step.
 *   - A tab follows its row (#reconcileActive): when another tab logged the
 *     same account in again, or added or removed its PIN, the tab reloads
 *     the session from the row (a PIN-sealed row arrives locked); when the
 *     row is gone — a 'removed' message it never got (frozen or
 *     back/forward-cached page) — it hands over. Checked on 'changed' /
 *     'refreshed' messages about its account, when a window write finds the
 *     row gone or replaced, and on a back/forward-cache restore. Before, such
 *     a tab kept sliding a session that no longer existed (keys in memory,
 *     "7 days left", indefinitely), stayed locked behind a PIN removed
 *     elsewhere, or kept unprotected keys after a PIN was added elsewhere.
 *     A window write that finds the PIN added or removed has the tab follow
 *     too, and an unlock that finds the PIN removed follows the row and
 *     succeeds (it answered AUTH_FAILED to the right PIN until a reload).
 *     addPin/removePin/changePin re-read the row right before writing it —
 *     after their seconds of Argon2 — and refuse (SESSION_CHANGED) when it
 *     now holds another session or PIN: update() would have merged this
 *     tab's keys and PIN state into a newer login. changePin refuses a
 *     tab-only session (it has no PIN).
 *   - A tab whose write raced a deletion and put the row back deletes it
 *     again AND says so (LIST_CHANGED, 'removed'): the account lists that
 *     saw it come back would otherwise keep a logged-out account.
 *   - A retired instance (dispose()) neither emits events nor touches the
 *     tab's remembered account from work still queued.
 *   - unlockWithPin(pin, { account }) refuses (ACCOUNT_NOT_ACTIVE) when a
 *     queued switch made another account active first: the PIN was tried on
 *     that account and a failure counted against the one the user meant.
 *   - The PIN-sealed blob is always unwrapped from the row being unlocked:
 *     a cached blob went stale when another tab changed the PIN (new salt,
 *     old blob — every PIN failed and counted towards the wipe).
 *   - Device fingerprint v3 drops timezone and browser language: travelling
 *     or changing the UI language soft-logged the user out on every launch.
 *     Records are re-based once (see #loadPersisted), as for v2.
 *   - DeviceKeyManager no longer overwrites a device key another tab stored
 *     a moment earlier (first-run race that left that tab's rows unreadable).
 *   - Pre-v7 rows other than the active one are deleted on the first v7
 *     resume (SESSION_FORMAT): v6 left them behind on every account change.
 *   - isSessionValid() answers true for a tab-only session (it has no row);
 *     updateSession() refuses to rewrite expiry, identity and fingerprint;
 *     dispose() stops queued work from reviving keys in a retired instance.
 *   - Logging out a tab-only session ends the account on the device too: a
 *     stored session of it, made in another tab since, is deleted as well
 *     (removeSession of a parked tab-only account already did this).
 *
 * v6.3 changes (key-material lifecycle):
 *   - Every assignment to #cachedKeys goes through #setCachedKeys(), which
 *     zeros the previous map.
 *   - PIN auto-lock and session expiry are enforced against WALL-CLOCK
 *     deadlines, not only setTimeout (timers pause across system sleep and in
 *     frozen tabs). getKeys()/isLocked check them on every access;
 *     visibilitychange/pageshow/focus re-check them.
 *   - unlockWithPin THROWS SessionError('DEVICE_UNWRAP_FAILED') when the
 *     device-key unwrap fails, instead of returning false (which PixaProxyAPI
 *     counts as a wrong PIN).
 *   - All key copies are off-heap (CryptoUtils.secureCopy).
 *   - Legacy hex+JSON records are migrated to v2 on the first successful read.
 *   - #verifyPin uses vault.verifyPinAgainstSealed() (commitment-tag check, no
 *     plaintext); unsealKeysBytes gets the account so the AAD is recomputed.
 *   - dispose(): tear down timers/listeners and zero in-memory keys without
 *     ending the persisted session (instance replacement).
 *
 * @version 7.0.0
 * @module SessionManager
 */

import { CryptoUtils } from './crypto-utils.js';
import { PixaEvents }  from './events.js';
import { YOLOBuffer }  from './yolo-buffer.js';

// ── Errors ──────────────────────────────────────────

export class SessionError extends Error {
    code; data;
    constructor(message, code, data = null) {
        super(message); this.name = 'SessionError'; this.code = code; this.data = data;
    }
}
export class SessionExpiredError extends SessionError {
    constructor(account) { super(`Session expired for ${account}`, 'SESSION_EXPIRED', { account }); this.name = 'SessionExpiredError'; }
}
export class SessionNotFoundError extends SessionError {
    constructor() { super('No active session found', 'SESSION_NOT_FOUND'); this.name = 'SessionNotFoundError'; }
}
export class PinRequiredError extends SessionError {
    constructor(account) { super(`PIN required to unlock keys for ${account}`, 'PIN_REQUIRED', { account }); this.name = 'PinRequiredError'; }
}

// ── Multi-account events ────────────────────────────
// Registered in events.js v1.1 (PixaEvents.Account.SWITCHED / LIST_CHANGED,
// PixaEvents.Session.REFRESHED / DEACTIVATED); AccountEvents is the same set
// under one name. The string fallbacks keep this module working next to an
// events.js that predates them (the values are the ones the UI subscribes to).
//
//   SWITCHED      { account, previous, reason, replaces, locked, persistent,
//                   pinProtected, mode } — reason: 'user' | 'logout' |
//                   'expired' | 'remote' | 'wiped' | …; `replaces` is the
//                   account that left when this one took over
//   LIST_CHANGED  { reason, account?, removed? } — the set of logged-in
//                   accounts, or one of their expiries, changed: re-read
//                   listSessions(). `removed` lists accounts logged out here.
//   REFRESHED     { account, expiresAt } — the active session's window slid
//   DEACTIVATED   { account, reason } — the active account's keys just left
//                   memory without a call from this tab: its deadline passed
//                   ('expired') or another tab logged it out ('remote'). The
//                   outcome follows once the row has been re-read: EXPIRED /
//                   ENDED (+ SWITCHED when someone takes over), or RESUMED /
//                   PIN.LOCKED { reason: 'refreshed' } when the session turns
//                   out to be alive. For key caches, not for the UI.
//
// Session.ENDED now carries { account, reason?, next?, switching? }:
// `switching` means `next` takes over in the same breath (SWITCHED follows).
export const AccountEvents = Object.freeze({
    SWITCHED:     PixaEvents.Account?.SWITCHED      ?? 'account_switched',
    LIST_CHANGED: PixaEvents.Account?.LIST_CHANGED  ?? 'accounts_changed',
    REFRESHED:    PixaEvents.Session?.REFRESHED     ?? 'session_refreshed',
    DEACTIVATED:  PixaEvents.Session?.DEACTIVATED   ?? 'session_deactivated',
});

// ── DeviceKeyManager ────────────────────────────────

export class DeviceKeyManager {
    static #DB_NAME = 'pixa_device_keys';
    static #STORE_NAME = 'keys';
    static #KEY_ID = 'device_key';
    #cryptoKey = null;
    /** @type {Promise<CryptoKey>|null} in-flight #getOrCreate, shared by concurrent callers */
    #pending = null;
    /** @type {object|null} TurboSerial instance (serialize/deserialize).
     *  When present, wrap() uses the v2 raw-bytes format. */
    #serializer = null;

    /** @param {object|null} [serializer] — TurboSerial instance (e.g. lacerta.serializer) */
    constructor(serializer = null) {
        this.#serializer = serializer;
    }

    set serializer(s) { this.#serializer = s; }

    /** Whether a stored record is in the legacy v6.1 hex+JSON format. */
    static isLegacyRecord(wrapped) {
        return typeof wrapped?.iv === 'string';
    }

    async wrap(payload) {
        if (!this.#serializer) {
            // v6.3: symmetric with unwrap(). The legacy JSON write path went
            // through JSON.stringify + Array.from — an unzeroable string holding
            // every key byte — and produced records only the legacy reader can
            // open. A missing serializer is a wiring bug; fail loudly.
            throw new Error('DeviceKeyManager: serializer required to wrap (inject options.serializer)');
        }
        const key = await this.#getOrCreate();
        const iv  = CryptoUtils.getRandomBytes(12);

        // TurboSerial path — payload → bytes with NO string/number-array
        // intermediaries, so every plaintext copy is zeroable.
        // serialize() may return a view into an internal memory pool: copy it
        // (off-heap), then zero the view so no key bytes linger in pooled
        // memory (and a concurrent serialize() cannot clobber our buffer
        // mid-encrypt).
        const raw  = this.#serializer.serialize(payload);
        const view = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
        const pt   = CryptoUtils.secureCopy(view);
        view.fill(0);

        try {
            const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, pt);
            // v2 format: raw bytes. TurboSerial/LacertaDB persist Uint8Array
            // natively — hex encoding would only double the stored size.
            return { v: 2, iv, ct: new Uint8Array(ct) };
        } finally {
            pt.fill(0);
        }
    }

    async unwrap(wrapped) {
        const key = await this.#getOrCreate();
        // Legacy v6.1 records carry hex STRINGS; v2 records carry raw bytes.
        const isLegacyHex = typeof wrapped.iv === 'string';
        const toBytes = (x) => x instanceof Uint8Array ? x : new Uint8Array(x);
        const iv = isLegacyHex ? CryptoUtils.hexToBytes(wrapped.iv) : toBytes(wrapped.iv);
        const ct = isLegacyHex ? CryptoUtils.hexToBytes(wrapped.ct) : toBytes(wrapped.ct);
        const pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct));

        let payload;
        if (isLegacyHex) {
            payload = DeviceKeyManager.#fromJson(JSON.parse(new TextDecoder().decode(pt)));
        } else {
            if (!this.#serializer) {
                pt.fill(0);
                throw new Error('DeviceKeyManager: serializer required to unwrap v2 records');
            }
            // deserialize() may return Uint8Array VIEWS over `pt` (zero-copy).
            // Deep-copy the values so zeroing pt below cannot destroy the
            // restored key bytes (same aliasing class as the v4.5 bug).
            payload = DeviceKeyManager.#copyBytes(this.#serializer.deserialize(pt));
        }
        pt.fill(0);
        return payload;
    }

    /** Copy any Uint8Array values (one level deep) into off-heap buffers so
     *  callers own their bytes and can zero them for real. */
    static #copyBytes(obj) {
        if (obj instanceof Uint8Array) return CryptoUtils.secureCopy(obj);
        if (obj === null || typeof obj !== 'object') return obj;
        const out = {};
        for (const [k, v] of Object.entries(obj)) {
            out[k] = v instanceof Uint8Array ? CryptoUtils.secureCopy(v) : v;
        }
        return out;
    }

    dispose() { this.#cryptoKey = null; }

    // Legacy v6.1 JSON → bytes: tagged { __b: true, d: [...] }. Read-only since
    // v6.3 (wrap() no longer produces this format); records migrate on read.
    static #bytesFromNumbers(arr) {
        const tmp = Uint8Array.from(arr);           // on-heap intermediate
        const out = CryptoUtils.secureCopy(tmp);
        tmp.fill(0);
        return out;
    }
    static #fromJson(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj.__b && Array.isArray(obj.d)) return DeviceKeyManager.#bytesFromNumbers(obj.d);
        const out = {};
        for (const [k, v] of Object.entries(obj)) {
            out[k] = (v && typeof v === 'object' && v.__b && Array.isArray(v.d))
                ? DeviceKeyManager.#bytesFromNumbers(v.d) : v;
        }
        return out;
    }

    async #getOrCreate() {
        if (this.#cryptoKey) return this.#cryptoKey;
        // Concurrent first calls (a resume and a listing, two wraps) share one
        // lookup instead of each generating — and storing — its own key.
        if (!this.#pending) {
            this.#pending = (async () => {
                const db = await DeviceKeyManager.#openDB();
                try {
                    let key = await DeviceKeyManager.#idbGet(db);
                    if (!key) {
                        const fresh = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
                        // v7: add(), not put(). Two tabs opening on a fresh
                        // profile both found no key; the second put() replaced
                        // the first tab's key, and every row that tab had
                        // wrapped became unreadable. Whoever stored first wins
                        // and the other reads the winner back.
                        const stored = await DeviceKeyManager.#idbAddIfAbsent(db, fresh);
                        key = stored ? fresh : await DeviceKeyManager.#idbGet(db);
                    }
                    if (!key) throw new Error('DeviceKeyManager: device key unavailable');
                    this.#cryptoKey = key;
                    return key;
                } finally { db.close(); }
            })();
        }
        try { return await this.#pending; } finally { this.#pending = null; }
    }
    static #openDB() {
        return new Promise((res, rej) => {
            const r = indexedDB.open(DeviceKeyManager.#DB_NAME, 1);
            r.onupgradeneeded = () => r.result.createObjectStore(DeviceKeyManager.#STORE_NAME);
            r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
        });
    }
    static #idbGet(db) {
        return new Promise((res, rej) => {
            const tx = db.transaction(DeviceKeyManager.#STORE_NAME, 'readonly');
            const rq = tx.objectStore(DeviceKeyManager.#STORE_NAME).get(DeviceKeyManager.#KEY_ID);
            rq.onsuccess = () => res(rq.result ?? null); rq.onerror = () => rej(rq.error);
        });
    }
    /** Store `key` unless one exists. Resolves true if stored, false if another key was already there. */
    static #idbAddIfAbsent(db, key) {
        return new Promise((res, rej) => {
            const tx = db.transaction(DeviceKeyManager.#STORE_NAME, 'readwrite');
            const rq = tx.objectStore(DeviceKeyManager.#STORE_NAME).add(key, DeviceKeyManager.#KEY_ID);
            let exists = false;
            rq.onerror = (e) => {
                // A ConstraintError is the expected "someone was first": keep
                // the transaction alive (preventDefault) and report false.
                if (rq.error && rq.error.name === 'ConstraintError') { exists = true; e.preventDefault(); }
            };
            tx.oncomplete = () => res(!exists);
            tx.onabort = () => rej(tx.error || rq.error || new Error('DeviceKeyManager: key write aborted'));
        });
    }
}

// ── Device Fingerprint ──────────────────────────────

/**
 * Fingerprint recipe version. Bump whenever `computeDeviceFingerprint`
 * changes what it hashes; records carrying an older version are re-based
 * instead of being treated as a mismatch (see #loadPersisted).
 */
const FINGERPRINT_VERSION = 3;

async function computeDeviceFingerprintUncached() {
    if (!globalThis.navigator || !globalThis.crypto?.subtle) return null;
    const nav = globalThis.navigator;
    // v2: dropped navigator.userAgent and screen geometry (browser updates,
    // moving the window to another monitor).
    // v3: dropped navigator.language and the timezone. Both follow the USER,
    // not the machine: a trip abroad or a browser-language change produced a
    // "different device" verdict on every launch until the user re-entered
    // their key. What remains describes the hardware.
    const parts = [
        nav.platform ?? '',
        String(nav.hardwareConcurrency ?? ''), String(nav.deviceMemory ?? ''),
    ];
    try {
        const canvas = globalThis.document?.createElement('canvas');
        const gl = canvas?.getContext('webgl') ?? canvas?.getContext('experimental-webgl');
        if (gl) {
            const ext = gl.getExtension('WEBGL_debug_renderer_info');
            if (ext) { parts.push(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? ''); parts.push(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) ?? ''); }
            gl.getExtension('WEBGL_lose_context')?.loseContext();
        }
    } catch {}
    return CryptoUtils.sha256Hex(parts.join('|'));
}

// The inputs cannot change within a page load; switching accounts used to
// pay a WebGL context creation each time.
let _fingerprintPromise = null;
function computeDeviceFingerprint() {
    if (!_fingerprintPromise) {
        _fingerprintPromise = Promise.resolve()
            .then(computeDeviceFingerprintUncached)
            .catch(() => null);
    }
    return _fingerprintPromise;
}

// ── Utilities ───────────────────────────────────────

function normalizeAccount(account) {
    if (!account) return null;
    const raw = typeof account === 'string' ? account : account.account ?? account.name ?? '';
    if (typeof raw !== 'string') return null;
    // Trim FIRST: the old order ran /^@/ against an untrimmed string, so
    // " @alice" kept its @ and normalized to "@alice".
    return raw.trim().replace(/^@+/, '').trim().toLowerCase() || null;
}

function toKeyBytes(value) {
    // v6.3: never alias the caller's array — copy off-heap so our zeroing is
    // ours alone and final. (TextEncoder output is already a dedicated
    // off-heap buffer that nobody else references.)
    if (value instanceof Uint8Array) return CryptoUtils.secureCopy(value);
    if (typeof value === 'string') return new TextEncoder().encode(value);
    throw new TypeError('Key must be string or Uint8Array');
}

function cloneKeyMap(keys) {
    const out = {};
    for (const [t, b] of Object.entries(keys)) {
        if (b instanceof Uint8Array) out[t] = CryptoUtils.secureCopy(b);
    }
    return out;
}

function zeroKeyMap(keys) {
    if (!keys || typeof keys !== 'object') return;
    for (const k of Object.keys(keys)) {
        const v = keys[k];
        if (v instanceof Uint8Array) v.fill(0);
        if (v && typeof v.destroy === 'function') v.destroy();
        keys[k] = null;
    }
}

/** The account a stored row belongs to (rows are keyed by account name). */
function rowAccount(row) {
    return normalizeAccount(row?.account ?? row?._id);
}

/** When a row (or session meta) stops being valid: the sliding expiry or the absolute cap, whichever is first. 0 = never. */
function effectiveDeadline(row) {
    const e = Number(row?.expires_at) || 0;
    const a = Number(row?.absolute_expires_at) || 0;
    if (e && a) return Math.min(e, a);
    return e || a;
}

function isExpired(row, now = Date.now()) {
    const d = effectiveDeadline(row);
    return d > 0 && now >= d;
}

function metaFromRow(row) {
    return {
        session_id:          row?.session_id ?? null,
        created_at:          Number(row?.created_at) || Number(row?._created) || Date.now(),
        last_active:         Number(row?.last_active) || null,
        timeout_ms:          Number(row?.timeout_ms) || null,
        expires_at:          Number(row?.expires_at) || 0,
        absolute_expires_at: Number(row?.absolute_expires_at) || 0,
        login_type:          row?.login_type ?? null,
    };
}

// ── Defaults ────────────────────────────────────────

const DAY_MS               = 24 * 60 * 60 * 1000;
// v7: was 12 h. A login lasts 7 days without activity by default.
const DEFAULT_TIMEOUT      = 7 * DAY_MS;
// v7: floor for every session, whatever a caller or an old row asks for.
// Override with config.MIN_SESSION_TIMEOUT.
const DEFAULT_MIN_TIMEOUT  = 3 * DAY_MS;
const DEFAULT_PIN_TIMEOUT  = 30 * 60 * 1000;
const DEFAULT_MAX_LIFETIME = 30 * DAY_MS;
// The sliding window moves at most this often (each move is one row write).
const SLIDE_THROTTLE_MS    = 15 * 60 * 1000;
const CHANNEL_NAME         = 'pixa_sessions';
// sessionStorage key: the account THIS tab works as. `active_account` in the
// preferences collection is device-wide (the last account used in any tab);
// a reload, or the instance replacement after an API-node switch, resumes the
// tab's own account first.
const TAB_ACCOUNT_KEY      = 'pixa_tab_account';
// How long a cross-tab removal is remembered to refuse a racing activation.
const TOMBSTONE_TTL_MS     = 5 * 60 * 1000;
// v7: written on every row. v6 kept ONE session in use: a second login
// replaced the active account without deleting the first one's row, which
// stayed on disk, unreachable and never expired. Such pre-v7 rows — any but
// the active one — are deleted on the first v7 resume and never listed, so
// they don't reappear as "logged-in" accounts the user believes logged out.
const SESSION_FORMAT       = 7;
const DEFAULT_ARGON2_MEM   = 32768;
const DEFAULT_ARGON2_ITER  = 2;
// v6.3: was 3, contradicting SecureVault's corrected DEFAULT_PARALLELISM (1).
// Only reached when no vault is injected (which also means no PIN sealing),
// but a stale constant next to the real one is a trap. See the rationale on
// DEFAULT_PARALLELISM in pq-secure-vault.js.
const DEFAULT_ARGON2_PAR   = 1;

// Fields updateSession() must never rewrite: identity, key material and the
// expiry bookkeeping (a caller extending absolute_expires_at would defeat the
// absolute cap).
const PROTECTED_FIELDS = Object.freeze([
    'account', 'session_id', 'session_format', 'encrypted_keys', 'pin', 'created_at', 'timeout_ms',
    'expires_at', 'absolute_expires_at', 'device_fingerprint', 'device_fingerprint_version',
]);

// ═════════════════════════════════════════════════════
// SessionManager v7
// ═════════════════════════════════════════════════════

export class SessionManager {

    #db; #config; #vault; #deviceKeys;
    #sessions = null; #preferences = null;
    #currentAccount = null; #persistent = false;
    /** @type {Object<string, Uint8Array>|null} WIF bytes, zeroable */
    #cachedKeys = null;
    /** @type {boolean} whether this session is PIN-protected, independent of
     *  whether it currently happens to be locked. */
    #pinProtected = false;
    #pinTimer = null; #emitter = null;
    /** @type {number} wall-clock ms at which cached keys must be locked (0 = none) */
    #pinDeadline = 0;
    /** @type {number} wall-clock ms at which the session itself expires (0 = none) */
    #sessionDeadline = 0;
    /** @type {Function|null} bound visibilitychange/pageshow/focus handler */
    #onVisibleBound = null;
    /** @type {Function|null} v7: bound pointerdown/keydown handler (presence) */
    #onPresenceBound = null;
    /** @type {object|null} v7: the active session's row bookkeeping (see metaFromRow) */
    #activeMeta = null;
    /** @type {number} v7: when the active window last slid (ms) */
    #lastSlide = 0;
    /** @type {Map<string, {wrapped: object, created_at: number, parked_at: number, login_type: string|null}>}
     *  v7: tab-only sessions parked by a switch, device-wrapped (no plaintext in memory) */
    #parked = new Map();
    /** @type {Promise} v7: tail of the serialized operation queue */
    #queue = Promise.resolve();
    /** @type {BroadcastChannel|null} v7: cross-tab coordination */
    #channel = null;
    /** @type {Map<string, {at: number, session_id: string|null}>} v7: accounts logged out in another tab */
    #tombstones = new Map();
    /** @type {boolean} v7: retired instance — no further operations or commits */
    #disposed = false;
    /** @type {Storage|null} v7: per-tab storage (sessionStorage) — the account this tab works as */
    #tabStorage = null;

    /**
     * @param {object} db — LacertaDB database
     * @param {object} config
     * @param {object} [options]
     * @param {object} [options.vault]       — PIN vault (sealKeysBytes / unsealKeysBytes)
     * @param {object} [options.serializer]  — TurboSerial instance
     * @param {Storage|null} [options.tabStorage] — per-tab storage for the tab's
     *        own account (default: sessionStorage; null disables it)
     */
    constructor(db, config, options = {}) {
        this.#db = db; this.#config = config || {};
        this.#vault = options.vault ?? null;
        // v6.2: options.serializer (TurboSerial, e.g. lacerta.serializer)
        // switches DeviceKeyManager to the byte-level v2 wrap format.
        this.#deviceKeys = new DeviceKeyManager(options.serializer ?? null);
        // v7: sessionStorage can throw (sandboxed frames, storage disabled).
        try {
            this.#tabStorage = 'tabStorage' in options ? options.tabStorage : (globalThis.sessionStorage ?? null);
        } catch { this.#tabStorage = null; }
    }

    // ── Getters ─────────────────────────────────────

    get currentAccount()  { return this.#currentAccount; }
    get isPersistent()    { return this.#persistent; }
    get hasKeysInMemory() { this.#enforceDeadlines(); return this.#cachedKeys !== null; }
    get isLocked()        { this.#enforceDeadlines(); return this.#pinProtected && this.#cachedKeys === null; }
    get isPinProtected()  { return this.#pinProtected; }
    /** The vault's instance-level Argon2 params are now only the DEVICE PROFILE
     *  (what autoTuneParams measured), used to pick params for new seals. Every
     *  seal/unseal below passes the record's own params explicitly, so no call
     *  site depends on the vault still holding state from a previous call. */
    set vault(v)          { this.#vault = v; }
    get vault()           { return this.#vault; }
    /** v6.2: late-inject the TurboSerial instance for DeviceKeyManager. */
    set serializer(s)     { this.#deviceKeys.serializer = s; }

    // Backward compat
    get currentMode() {
        if (!this.#persistent) return 'ephemeral';
        return this.isPinProtected ? 'pin' : 'persist';
    }
    async getActiveAccount() { return this.#currentAccount; }
    getCurrentAccountSync()  { return this.#currentAccount; }
    setSessionTimeout(ms)    { this.#config.SESSION_TIMEOUT = ms; }
    setPinTimeout(ms)        { this.#config.PIN_TIMEOUT = ms; }

    // ── Initialization ──────────────────────────────

    async initialize(eventEmitter) {
        this.#emitter = eventEmitter;
        // v6.3: the PIN timer is setTimeout-based and browsers pause timers
        // across system sleep and in frozen tabs. Re-check the wall-clock
        // deadlines whenever the page comes back; getKeys() checks them on
        // every access too, so the timer is only the eager path.
        // v7: the same moments — plus pointer and keyboard input — count as
        // presence and slide the session window (throttled, see #slide).
        const g = globalThis;
        if (!this.#onVisibleBound && typeof g.addEventListener === 'function') {
            this.#onVisibleBound = (ev) => {
                if (g.document?.visibilityState === 'hidden') return;
                // Back from the back/forward cache: messages from other tabs
                // were missed while the page was stored. Check the row.
                if (ev?.type === 'pageshow' && ev.persisted) this.#queueReconcile();
                if (!this.#enforceDeadlines()) this.#slide();
            };
            this.#onPresenceBound = () => { this.#slide(); };
            g.document?.addEventListener?.('visibilitychange', this.#onVisibleBound);
            g.addEventListener('pageshow', this.#onVisibleBound);
            g.addEventListener('focus', this.#onVisibleBound);
            g.addEventListener('pointerdown', this.#onPresenceBound, { capture: true, passive: true });
            g.addEventListener('keydown', this.#onPresenceBound, { capture: true, passive: true });
        }
        this.#openChannel();
        if (this.#db) {
            try { await this.#db.createCollection('sessions'); } catch {}
            try { await this.#db.createCollection('preferences'); } catch {}
            this.#sessions    = await this.#db.getCollection('sessions');
            this.#preferences = await this.#db.getCollection('preferences');
        }
    }

    // ═════════════════════════════════════════════════
    // SESSION CREATION
    // ═════════════════════════════════════════════════

    /**
     * Log an account in. If ANOTHER account is active it is parked (see the
     * v7 header), not logged out: this is also the "add account" path.
     * Logging in again as the active account replaces its session.
     */
    createSession(account, options = {}) {
        return this.#serial(() => this.#createSession(account, options));
    }

    async #createSession(account, options) {
        const norm = normalizeAccount(account);
        if (!norm) throw new SessionError('Invalid account', 'INVALID_ACCOUNT');
        if (!options.keys || Object.keys(options.keys).length === 0) throw new SessionError('Keys required', 'NO_KEYS');

        const persistent = options.persistent !== false;
        if (persistent && !this.#sessions) throw new SessionError('DB not initialized', 'NO_DB');
        // FIX (v6.2): A requested PIN must NEVER be silently dropped. Fail loud;
        // callers must await vault init.
        if (persistent && options.pin && !this.#vault) {
            throw new SessionError('PIN requested but vault is not loaded', 'NO_VAULT');
        }

        // Normalize to Uint8Array immediately — no string WIFs kept
        const keyBytes = {};
        for (const [type, value] of Object.entries(options.keys)) {
            if (value) keyBytes[type] = toKeyBytes(value);
        }
        let keysOwned = true;    // until #setCachedKeys takes them

        try {
            // v7: everything slow (wrap the outgoing tab-only session, seal,
            // wrap, fingerprint, row writes) happens BEFORE the in-memory
            // state changes, so a failure leaves the active account untouched.
            const previous = this.#currentAccount;
            const parking = previous && previous !== norm ? await this.#prepareParking() : null;
            const now = Date.now();
            const loginType = options.login_type ?? 'unknown';

            if (!persistent) {
                // "This tab only" for this account: a stored session of the
                // same account must not come back on the next reload — and the
                // other tabs holding it drop it.
                if (this.#sessions) {
                    const row = await this.#freshRow(norm);
                    if (row && await this.#deleteStored(norm, row.session_id ?? null)) {
                        this.#broadcast({ type: 'removed', account: norm, session_id: row.session_id ?? null });
                    }
                }
                this.#assertUsable();

                this.#commitParking(parking);
                this.#parked.delete(norm);
                this.#tombstones.delete(norm);
                this.#clearActive();
                this.#setCachedKeys(keyBytes); keysOwned = false;
                this.#currentAccount = norm;
                this.#persistent = false; this.#pinProtected = false; this.#sessionDeadline = 0;
                this.#activeMeta = { session_id: null, created_at: now, last_active: now, timeout_ms: null, expires_at: 0, absolute_expires_at: 0, login_type: loginType };
                this.#emit(PixaEvents.Session.CREATED, { account: norm, mode: 'ephemeral', persistent: false, previous });
                this.#emit(AccountEvents.LIST_CHANGED, { reason: 'login', account: norm });
                return CryptoUtils.generateId(32);
            }

            const hasPin   = !!options.pin;
            const timeout  = this.#timeoutFor(options.timeout_ms);
            const sessId   = CryptoUtils.generateId(32);

            let payload, pinRecord = null;

            if (hasPin) {
                const salt = this.#vault.generateSalt();
                // v6.2: the injected vault carries the auto-tuned device profile —
                // prefer it over static config so tuning actually reaches sealing.
                const mem  = options.argon2_memory_kib ?? this.#vault.memoryKib ?? this.#config.ARGON2_MEMORY_KIB ?? DEFAULT_ARGON2_MEM;
                const iter = options.argon2_iterations ?? this.#vault.iterations ?? this.#config.ARGON2_ITERATIONS  ?? DEFAULT_ARGON2_ITER;
                const par  = options.argon2_parallelism ?? this.#vault.parallelism ?? this.#config.ARGON2_PARALLELISM ?? DEFAULT_ARGON2_PAR;
                const argon2 = { memoryKib: mem, iterations: iter, parallelism: par };

                // COPIES for vault — sealKeysBytes zeros its input
                const sealedJson = await this.#vault.sealKeysBytes(options.pin, salt, norm, cloneKeyMap(keyBytes), argon2);
                payload   = { _pin_sealed: true, data: sealedJson };
                pinRecord = { salt, argon2_memory_kib: mem, argon2_iterations: iter, argon2_parallelism: par };
            } else {
                payload = keyBytes;
            }

            const encryptedKeys = await this.#deviceKeys.wrap(payload);
            const fingerprint   = await computeDeviceFingerprint();
            const pinTimeout    = options.pin_timeout_ms ?? this.#config.PIN_TIMEOUT ?? DEFAULT_PIN_TIMEOUT;

            const record = {
                account: norm, session_id: sessId, session_format: SESSION_FORMAT,
                created_at: now, last_active: now, timeout_ms: timeout,
                expires_at: now + timeout,
                absolute_expires_at: now + this.#maxLifetime(),
                pin_timeout_ms: hasPin ? pinTimeout : null,
                device_fingerprint: fingerprint, device_fingerprint_version: FINGERPRINT_VERSION,
                encrypted_keys: encryptedKeys,
                pin: pinRecord, login_type: loginType,
                user_agent: options.user_agent ?? 'unknown',
            };

            this.#assertUsable();
            await this.#upsert(this.#sessions, norm, record);
            await this.#upsert(this.#preferences, 'active_account', { account: norm });
            this.#assertUsable();

            // ── Commit (synchronous) ──
            this.#commitParking(parking);
            this.#parked.delete(norm);
            this.#tombstones.delete(norm);
            this.#clearActive();
            this.#setCachedKeys(keyBytes); keysOwned = false;
            this.#currentAccount = norm;
            this.#persistent = true;
            this.#pinProtected = hasPin;
            this.#activeMeta = metaFromRow(record);
            this.#sessionDeadline = effectiveDeadline(record);
            this.#lastSlide = now;
            if (hasPin) this.#startPinTimer(pinTimeout);
            this.#rememberTab(norm);

            // Tabs holding an older session of this account follow the row.
            this.#broadcast({ type: 'changed', account: norm, session_id: sessId });
            this.#emit(PixaEvents.Session.CREATED, {
                account: norm, sessionId: sessId, mode: hasPin ? 'pin' : 'persist',
                persistent: true, pinProtected: hasPin, previous,
            });
            this.#emit(AccountEvents.LIST_CHANGED, { reason: 'login', account: norm });
            return sessId;
        } finally {
            if (keysOwned) zeroKeyMap(keyBytes);
        }
    }

    // ═════════════════════════════════════════════════
    // SESSION RESUME
    // ═════════════════════════════════════════════════

    /**
     * Restore the active session after a reload: the account recorded as
     * active, or — when that one is gone or expired — the most recently
     * active stored session (v7). Expired rows are deleted on the way.
     * A no-op returning the current state if an account is already active.
     */
    resume() {
        return this.#serial(() => this.#resume());
    }

    async #resume() {
        if (!this.#preferences || !this.#sessions) return null;
        if (this.#currentAccount) return this.#activeResult();

        this.#dropRowCache();
        const readAt = Date.now();     // see #loadPersisted
        const pref = await this.#safeGet(this.#preferences, 'active_account');
        // Device-wide: the last account used in any tab (and, for pre-v7
        // data, the one session that was in use).
        const preferred = normalizeAccount(pref?.account);
        // This tab's own account comes first (v7: a reload, or the instance
        // replacement after an API-node switch, used to pick up whatever
        // account another tab had switched to last).
        const tabPref = this.#tabAccount();
        const now = Date.now();
        const removed = [];
        let row = null;

        const rows = await this.#listRows();
        if (rows) {
            const live = [];
            for (const r of rows) {
                const acc = rowAccount(r);
                if (!acc) continue;
                if (isExpired(r, now)) {
                    // v7: actually delete it — it holds device-wrapped keys.
                    if (await this.#deleteStored(acc, r.session_id ?? null)) {
                        this.#broadcast({ type: 'removed', account: acc, session_id: r.session_id ?? null });
                        removed.push(acc);
                    }
                    if (acc === preferred || acc === tabPref) this.#emit(PixaEvents.Session.EXPIRED, { account: acc, phase: 'resume' });
                    continue;
                }
                if (r.session_format !== SESSION_FORMAT && acc !== preferred) {
                    // Pre-v7 orphan (see SESSION_FORMAT).
                    if (await this.#deleteStored(acc, r.session_id ?? null)) removed.push(acc);
                    continue;
                }
                live.push(r);
            }
            const find = (a) => (a ? live.find((r) => rowAccount(r) === a) : null);
            row = find(tabPref) || find(preferred)
                || live.sort((a, b) => (Number(b.last_active) || 0) - (Number(a.last_active) || 0))[0]
                || null;
        } else if (tabPref || preferred) {
            // Collection cannot be enumerated: the preferred row only (v6 behaviour).
            const target = tabPref || preferred;
            row = await this.#safeGet(this.#sessions, target);
            if (row && isExpired(row, now)) {
                if (await this.#deleteStored(target, row.session_id ?? null)) removed.push(target);
                this.#emit(PixaEvents.Session.EXPIRED, { account: target, phase: 'resume' });
                row = null;
            }
        }

        const listChanged = () => {
            if (removed.length) this.#emit(AccountEvents.LIST_CHANGED, { reason: 'expired', removed });
        };

        if (!row) {
            if (pref) await this.#preferences.delete('active_account').catch(() => {});
            if (tabPref) this.#rememberTab(null);
            listChanged();
            return null;
        }

        const account = rowAccount(row);
        let prepared;
        try {
            prepared = await this.#loadPersisted(row, readAt);
        } catch (e) {
            // Neither case is proof of compromise: in-memory state stays clear
            // but the row and `active_account` are kept, so a legitimate user
            // recovers on the next launch once the environment settles.
            if (e?.code === 'DEVICE_MISMATCH') {
                this.#emit(PixaEvents.Session.EXPIRED, { account, reason: 'device_mismatch', phase: 'resume' });
            } else {
                console.error('[SM.resume] Device-unwrap failed:', e?.message || e);
            }
            listChanged();
            return null;
        }

        if (this.#currentAccount || !this.#canCommit(prepared)) {
            // Logged out in another tab while loading (or this instance retired).
            zeroKeyMap(prepared.keys);
            listChanged();
            return this.#currentAccount ? this.#activeResult() : null;
        }
        this.#activate(prepared);
        if (preferred !== account) {
            await this.#upsert(this.#preferences, 'active_account', { account }).catch(() => {});
        }
        if (row.session_format !== SESSION_FORMAT) {
            // The active pre-v7 session: adopted, so it stays listed once
            // another account becomes the active one.
            await this.#sessions.update(account, { session_format: SESSION_FORMAT }).catch(() => {});
        }
        // A reload is presence: the window moves, locked PIN sessions included.
        await this.#refreshTimeout();
        listChanged();

        if (prepared.locked) {
            this.#emit(PixaEvents.PIN.LOCKED, { account });
            return { account, locked: true, persistent: true, pinProtected: true };
        }
        this.#emit(PixaEvents.Session.RESUMED, { account });
        return { account, locked: false, persistent: true, pinProtected: false };
    }

    // ═════════════════════════════════════════════════
    // MULTI-ACCOUNT (v7)
    // ═════════════════════════════════════════════════

    /**
     * Every logged-in account on this device/tab, active one first, then by
     * most recent activity. No key material:
     *   { account, active, persistent, pinProtected, locked,
     *     createdAt, lastActive, expiresAt, remainingMs, loginType }
     * `expiresAt`/`remainingMs` are null for a tab-only session (it ends with
     * the tab). `locked` is true for a PIN-protected account that needs its
     * PIN before signing (every parked PIN account does). Expired rows are
     * left out and deleted in the background (after a fresh re-check).
     * @returns {Promise<object[]>}
     */
    async listSessions() {
        this.#enforceDeadlines();
        const now = Date.now();
        const out = new Map();
        const expired = [];

        const rows = await this.#listRows();
        if (rows) {
            for (const r of rows) {
                const acc = rowAccount(r);
                if (!acc) continue;
                if (isExpired(r, now)) {
                    if (acc !== this.#currentAccount) expired.push(acc);
                    continue;
                }
                if (r.session_format !== SESSION_FORMAT && acc !== this.#currentAccount) continue;   // pre-v7 orphan
                const deadline = effectiveDeadline(r);
                out.set(acc, {
                    account: acc, active: false, persistent: true,
                    pinProtected: !!r.pin, locked: !!r.pin,
                    createdAt: Number(r.created_at) || Number(r._created) || null,
                    lastActive: Number(r.last_active) || Number(r._modified) || null,
                    expiresAt: deadline || null,
                    remainingMs: deadline ? Math.max(0, deadline - now) : null,
                    loginType: r.login_type ?? null,
                });
            }
        }
        for (const [acc, p] of this.#parked) {
            out.set(acc, {
                account: acc, active: false, persistent: false, pinProtected: false, locked: false,
                createdAt: p.created_at ?? null, lastActive: p.parked_at ?? null,
                expiresAt: null, remainingMs: null, loginType: p.login_type ?? null,
            });
        }
        const active = this.getSessionInfo();
        if (active) out.set(active.account, active);

        if (expired.length && !this.#disposed) this.#serial(() => this.#prune(expired)).catch(() => {});

        return [...out.values()].sort((a, b) =>
            (Number(b.active) - Number(a.active))
            || ((b.lastActive || 0) - (a.lastActive || 0))
            || a.account.localeCompare(b.account));
    }

    /**
     * The active session, synchronously — same shape as a listSessions()
     * entry, or null when nobody is logged in. For a live "time left".
     * @returns {object|null}
     */
    getSessionInfo() {
        this.#enforceDeadlines();
        const account = this.#currentAccount;
        if (!account) return null;
        const m = this.#activeMeta || {};
        const now = Date.now();
        const expiresAt = this.#persistent && this.#sessionDeadline > 0 ? this.#sessionDeadline : null;
        return {
            account, active: true, persistent: this.#persistent,
            pinProtected: this.#pinProtected,
            locked: this.#pinProtected && this.#cachedKeys === null,
            createdAt: m.created_at ?? null,
            lastActive: m.last_active ?? null,
            expiresAt,
            remainingMs: expiresAt ? Math.max(0, expiresAt - now) : null,
            loginType: m.login_type ?? null,
        };
    }

    /**
     * Make another logged-in account the active one. The outgoing account is
     * parked: a persistent session keeps its row (its in-memory keys are
     * zeroed — a PIN account will need its PIN again), a tab-only session is
     * device-wrapped into memory. The incoming account is loaded exactly like
     * a resume: a PIN account arrives LOCKED.
     *
     * If the target cannot be opened (expired, device mismatch, unreadable
     * row, logged out meanwhile) this throws and the active account is left
     * as it was.
     *
     * @param {string} account
     * @param {object} [meta] — carried by the SWITCHED event, e.g.
     *        { reason: 'user', replaces: 'alice' }
     * @returns {Promise<{account, locked, persistent, pinProtected}>}
     */
    switchTo(account, meta = {}) {
        return this.#serial(() => this.#switchTo(account, meta || {}));
    }

    async #switchTo(account, meta) {
        const target = normalizeAccount(account);
        if (!target) throw new SessionError('Invalid account', 'INVALID_ACCOUNT');
        this.#enforceDeadlines();
        if (target === this.#currentAccount) return this.#activeResult();

        // 1. Load the target without touching the active state.
        const prepared = await this.#prepareTarget(target);

        // 2. Prepare parking the outgoing account (wrap a tab-only session).
        let parking;
        try {
            parking = await this.#prepareParking();
        } catch (e) {
            zeroKeyMap(prepared.keys);
            throw e;
        }
        if (!this.#canCommit(prepared)) {
            zeroKeyMap(prepared.keys);
            throw new SessionNotFoundError();
        }

        // 3. Commit and announce — synchronously, so nothing (a logout, a
        //    key lookup) sees the new active account before its listeners do.
        const previous = this.#currentAccount;
        this.#commitParking(parking);
        this.#activate(prepared);
        const result = this.#activeResult();
        this.#emit(AccountEvents.SWITCHED, {
            reason: meta.reason ?? 'user', replaces: normalizeAccount(meta.replaces),
            ...result, previous, mode: this.currentMode,
        });

        // 4. Persist the choice and move the window (switching is presence).
        await this.#afterActivation(prepared);
        this.#broadcast({ type: 'changed', account: target, session_id: prepared.meta?.session_id ?? null });
        this.#emit(AccountEvents.LIST_CHANGED, { reason: 'switch', account: target, previous });
        return result;
    }

    /**
     * Log one account out.
     *   - a parked account: its row (or parked tab-only session) is deleted,
     *     the active account is untouched;
     *   - the active account: like endSession(); with `{ handover: true }`
     *     the most recently used other logged-in account takes over in the
     *     same operation (Session.ENDED { next, switching }, then SWITCHED
     *     { reason, replaces }).
     * @param {string} account
     * @param {{handover?: boolean, reason?: string}} [options]
     * @returns {Promise<{removed: boolean, wasActive: boolean, switchedTo: string|null}>}
     */
    removeSession(account, options = {}) {
        return this.#serial(() => this.#removeSession(account, options || {}));
    }

    async #removeSession(account, options) {
        const target = normalizeAccount(account);
        const reason = options.reason || 'logout';
        if (!target) return { removed: false, wasActive: false, switchedTo: null };
        if (target === this.#currentAccount) {
            const r = await this.#endActive({ reason, handover: !!options.handover });
            return { removed: r.removed, wasActive: true, switchedTo: r.switchedTo };
        }
        let removed = this.#parked.delete(target);
        if (this.#sessions) {
            const row = await this.#freshRow(target);
            if (row && await this.#deleteStored(target, row.session_id ?? null)) {
                // The account, in every tab (see #endActive).
                this.#broadcast({ type: 'removed', account: target, session_id: row.session_id ?? null, all: true });
                removed = true;
            }
        }
        if (removed) this.#emit(AccountEvents.LIST_CHANGED, { reason, account: target, removed: [target] });
        return { removed, wasActive: false, switchedTo: null };
    }

    /**
     * The account that would take over if the active one left: the most
     * recently active other logged-in account, or null. (Informational —
     * removeSession({ handover }) decides inside the queue.)
     * @param {string} [exclude] — also skip this account
     * @returns {Promise<string|null>}
     */
    async nextAccount(exclude) {
        const skip = new Set([this.#currentAccount, normalizeAccount(exclude)].filter(Boolean));
        const list = await this.listSessions();
        const next = list.find((s) => !s.active && !skip.has(s.account));
        return next ? next.account : null;
    }

    /**
     * Log every account out: the active one, parked tab-only sessions and
     * every stored row. Emits Session.ENDED once ({ account, all: true }).
     * @returns {Promise<string[]>} the accounts that were logged out
     */
    endAll() {
        return this.#serial(async () => {
            const current = this.#currentAccount;
            const accounts = new Map();   // account → session_id (null: unknown) | undefined (tab-only)
            if (current) accounts.set(current, this.#persistent ? (this.#activeMeta?.session_id ?? null) : undefined);
            this.#clearActive();
            for (const a of this.#parked.keys()) if (!accounts.has(a)) accounts.set(a, undefined);
            this.#parked.clear();
            const rows = await this.#listRows();
            for (const r of rows || []) { const a = rowAccount(r); if (a) accounts.set(a, r.session_id ?? null); }
            const removed = [...accounts.keys()];
            const stored = removed.filter((a) => accounts.get(a) !== undefined);   // tab-only: nothing on disk
            // Every row first, then tell the other tabs: one told early would
            // hand over to an account that is about to go too.
            for (const a of stored) await this.#deleteStored(a, null);           // whatever session it is
            if (this.#preferences) await this.#preferences.delete('active_account').catch(() => {});
            // Each message names the row deleted, so a tab whose write raced
            // the deletion deletes it again (see #onChannelMessage).
            for (const a of stored) this.#broadcast({ type: 'removed', account: a, session_id: accounts.get(a), all: true });
            this.#rememberTab(null);
            this.#emit(PixaEvents.Session.ENDED, { account: current, all: true, reason: 'logout_all' });
            this.#emit(AccountEvents.LIST_CHANGED, { reason: 'logout_all', removed });
            return removed;
        });
    }

    // ═════════════════════════════════════════════════
    // KEY ACCESS — Byte-level API
    // ═════════════════════════════════════════════════

    /** Get all cached keys. Values are Uint8Array. Returns the INTERNAL map:
     *  do not retain it, and never zero its values yourself — use getKey() /
     *  getKeyAsYOLO() for copies you own. */
    getKeys() {
        // v6.3: wall-clock enforcement on every access (the timer alone is not
        // reliable — see the header). Locks or expires synchronously.
        const verdict = this.#enforceDeadlines();
        if (verdict?.expired) throw new SessionExpiredError(verdict.account);
        if (!this.#cachedKeys) {
            if (this.#pinProtected) throw new PinRequiredError(this.#currentAccount);
            throw new SessionNotFoundError();
        }
        return this.#cachedKeys;
    }

    /**
     * Get a single key as a NEW off-heap Uint8Array copy.
     * Caller MUST zero it after use: `result.fill(0)`.
     */
    getKey(type) {
        const keys = this.getKeys();
        const val  = keys[type];
        if (!val) throw new SessionError(`Key '${type}' not found`, 'KEY_NOT_FOUND');
        return CryptoUtils.secureCopy(val);
    }

    /**
     * Get a single key as a YOLOBuffer (auto-zeroing, one-shot).
     *
     * The bytes are the WIF's UTF-8 encoding (see the header), so the
     * consumer still has to decode to a string for dpixa's PrivateKey. Keep
     * the lifetime to the signature — sign inside use(), broadcast outside:
     *
     *   const signed = await sm.getKeyAsYOLO('posting').use((wifBytes) => {
     *       const pk = PrivateKey.fromString(new TextDecoder().decode(wifBytes));
     *       try { return client.broadcast.sign(tx, pk); }   // sync
     *       finally { zeroPrivateKey(pk); }                 // dpixa keeps the raw bytes in `.secret`
     *   });
     *   await client.broadcast.send(signed);
     *
     * Throws PinRequiredError / SessionExpiredError / SessionNotFoundError
     * synchronously (before any promise), so a try/catch around the call is
     * enough to detect a locked session.
     */
    getKeyAsYOLO(type) {
        return new YOLOBuffer(this.getKey(type));
    }

    /**
     * @deprecated since 6.3 — no caller in pixaproxyapi.js, and every value
     * it returns is an unzeroable WIF string. Use getKeyAsYOLO(type) for
     * signing and exportKeysForSealing() for re-sealing. Will be removed.
     */
    exportKeysAsStrings() {
        console.warn('[SessionManager] exportKeysAsStrings() is deprecated — it mints unzeroable WIF strings; use getKeyAsYOLO()/exportKeysForSealing()');
        if (!this.#cachedKeys) return null;
        const out = {};
        for (const [t, b] of Object.entries(this.#cachedKeys)) {
            if (b instanceof Uint8Array) out[t] = new TextDecoder().decode(b);
            else if (b) out[t] = b;
        }
        return out;
    }

    /** Export key byte copies for sealing. Originals untouched. */
    exportKeysForSealing() {
        return this.#cachedKeys ? cloneKeyMap(this.#cachedKeys) : null;
    }

    /** Import keys. Accepts string WIFs or Uint8Array (copied, never aliased). */
    importKeys(keys) {
        const bytes = {};
        for (const [t, v] of Object.entries(keys)) { if (v) bytes[t] = toKeyBytes(v); }
        this.#setCachedKeys(bytes);
    }

    // ═════════════════════════════════════════════════
    // PIN OPERATIONS
    // ═════════════════════════════════════════════════

    /**
     * Unlock the active PIN-protected session.
     * @param {string} pin
     * @param {{account?: string}} [options] — v7: the account the caller means.
     *        The operation is queued: when a switch lands first, it throws
     *        SessionError ACCOUNT_NOT_ACTIVE instead of trying this PIN on
     *        whichever account is active by then (a failure there would be
     *        counted against the wrong account).
     * @returns {Promise<boolean>} false: wrong PIN
     */
    unlockWithPin(pin, options = {}) {
        return this.#serial(() => this.#unlockWithPin(pin, options?.account ?? null));
    }

    async #unlockWithPin(pin, expected = null) {
        const account = this.#currentAccount;
        if (!account) throw new SessionNotFoundError();
        const wanted = normalizeAccount(expected);
        if (wanted && wanted !== account) {
            throw new SessionError(`@${wanted} is not the active account`, 'ACCOUNT_NOT_ACTIVE', { account: wanted, active: account });
        }
        // A tab-only session has no PIN (and no row: a stored session of the
        // same account belongs to another tab).
        if (!this.#persistent) throw new SessionError('Not PIN-protected', 'NOT_PIN');
        if (!this.#vault) throw new SessionError('Vault not available', 'NO_VAULT');
        // v7: fresh from IndexedDB — another tab may have changed the PIN
        // (new salt, new blob) or logged the account out.
        const readAt = Date.now();
        const session = await this.#freshRow(account);
        if (!session) {
            this.#queueReconcile();          // logged out elsewhere: hand over
            throw new SessionNotFoundError();
        }

        // v7: the absolute cap counts too (this checked expires_at only).
        if (isExpired(session)) {
            this.#clearActive();
            let removed = [];
            if (await this.#deleteStored(account, session.session_id ?? null)) {
                this.#broadcast({ type: 'removed', account, session_id: session.session_id ?? null });
                removed = [account];
            }
            this.#emit(PixaEvents.Session.EXPIRED, { account, reason: 'expired' });
            await this.#handOver(account, 'expired', removed);
            throw new SessionExpiredError(account);
        }

        // v7: the PIN was removed in another tab and this tab has not followed
        // yet (a missed message, or this unlock queued ahead of the check):
        // nothing to unlock — follow the row, and the unlock succeeds.
        if (!session.pin) {
            const p = await this.#loadPersisted(session, readAt);
            if (p.locked || this.#currentAccount !== account || !this.#canCommit(p)) {
                zeroKeyMap(p.keys);
                throw new SessionError('Not PIN-protected', 'NOT_PIN');
            }
            this.#activate(p);
            this.#emit(PixaEvents.Session.RESUMED, { account, reason: 'replaced' });
            this.#emit(AccountEvents.LIST_CHANGED, { reason: 'replaced', account });
            return true;
        }

        // v7: the sealed blob comes from THIS row, always — salt and blob are
        // a pair. A blob cached at lock time went stale when another tab
        // changed the PIN, and every PIN then failed (and counted).
        let sealedData;
        try {
            const payload = await this.#deviceKeys.unwrap(session.encrypted_keys);
            if (!payload._pin_sealed) throw new SessionError('Not PIN-protected', 'NOT_PIN');
            sealedData = payload.data;
        } catch (e) {
            if (e instanceof SessionError) throw e;
            // v6.3: a device-unwrap failure is NOT a wrong PIN. Returning
            // false here made PixaProxyAPI record a failed attempt, so an
            // IndexedDB hiccup could walk a legitimate user into lockout or
            // the 50-attempt wipe. Throw a distinct code instead — the
            // proxy's catch path does not count exceptions.
            throw new SessionError('Device-key unwrap failed: ' + (e?.message || e), 'DEVICE_UNWRAP_FAILED', { cause: String(e?.message || e) });
        }

        const p = session.pin;
        if (!p) throw new SessionError('No PIN config', 'NO_PIN_CONFIG');

        let keyBytes;
        try {
            // unsealKeysBytes → { type: Uint8Array } — byte-level, zeroable.
            // `p` carries this record's argon2_* params; no vault mutation.
            // The account is passed so the vault recomputes the AAD instead of
            // trusting the record's own aad_account (v6.3).
            keyBytes = await this.#vault.unsealKeysBytes(pin, p.salt, sealedData, p, account);
        } catch (e) {
            console.warn('[SM.unlockWithPin] Unseal failed:', e.message);
            return false;
        }

        // v7: the account may have been logged out meanwhile (another tab, the
        // session deadline) — never install its keys as someone else's.
        if (this.#currentAccount !== account || this.#disposed) {
            zeroKeyMap(keyBytes);
            throw new SessionNotFoundError();
        }

        this.#setCachedKeys(keyBytes);
        this.#pinProtected = true;  // unlocked ≠ no longer PIN-protected
        this.#activeMeta = this.#metaWithCap(session);
        this.#sessionDeadline = effectiveDeadline(this.#activeMeta);
        this.#startPinTimer(session.pin_timeout_ms ?? DEFAULT_PIN_TIMEOUT);
        await this.#refreshTimeout();
        this.#emit(PixaEvents.PIN.UNLOCKED, { account });
        return true;
    }

    addPin(pin, options = {}) {
        return this.#serial(async () => {
            if (!this.#vault) throw new SessionError('Vault required', 'NO_VAULT');
            if (!this.#cachedKeys) throw new SessionError('No keys in memory', 'NO_KEYS');
            if (!this.#currentAccount || !this.#persistent) throw new SessionNotFoundError();
            const account = this.#currentAccount;
            const session = this.#ownRow(await this.#freshRow(account));
            if (session.pin) throw new SessionError('Already PIN-protected', 'ALREADY_PIN');

            const salt = this.#vault.generateSalt();
            // v6.2: prefer the vault's auto-tuned profile over the static constants.
            const mem = options.argon2_memory_kib ?? this.#vault.memoryKib ?? DEFAULT_ARGON2_MEM;
            const iter = options.argon2_iterations ?? this.#vault.iterations ?? DEFAULT_ARGON2_ITER;
            const par = options.argon2_parallelism ?? this.#vault.parallelism ?? DEFAULT_ARGON2_PAR;
            const pinTimeout = options.pin_timeout_ms ?? session.pin_timeout_ms ?? DEFAULT_PIN_TIMEOUT;
            const argon2 = { memoryKib: mem, iterations: iter, parallelism: par };

            const sealedJson = await this.#vault.sealKeysBytes(pin, salt, account, cloneKeyMap(this.#cachedKeys), argon2);
            const encrypted  = await this.#deviceKeys.wrap({ _pin_sealed: true, data: sealedJson });

            await this.#recheckOwnRow(account, session);
            await this.#sessions.update(account, {
                encrypted_keys: encrypted, pin_timeout_ms: pinTimeout,
                pin: { salt, argon2_memory_kib: mem, argon2_iterations: iter, argon2_parallelism: par },
            });
            this.#pinProtected = true;
            this.#startPinTimer(pinTimeout);
            this.#broadcast({ type: 'changed', account, session_id: session.session_id ?? null });
            this.#emit(PixaEvents.Session.UPGRADED, { account, mode: 'pin' });
            this.#emit(AccountEvents.LIST_CHANGED, { reason: 'pin', account });
        });
    }

    removePin(currentPin) {
        return this.#serial(async () => {
            if (!this.#currentAccount || !this.#persistent) throw new SessionNotFoundError();
            const account = this.#currentAccount;
            const session = this.#ownRow(await this.#freshRow(account));
            if (!session.pin) throw new SessionError('Not PIN-protected', 'NOT_PIN');

            // SECURITY: the PIN is proven on EVERY call. The old guard only
            // verified it when the keys happened to be sealed
            // (`if (!this.#cachedKeys) …`), so on an unlocked session anyone with
            // access to the tab could strip PIN protection without knowing it.
            if (!(await this.#verifyPin(session, currentPin))) return false;

            if (!this.#cachedKeys) { if (!(await this.#unlockWithPin(currentPin, account))) return false; }

            const encrypted = await this.#deviceKeys.wrap(this.#cachedKeys);
            await this.#recheckOwnRow(account, session);
            await this.#sessions.update(account, { encrypted_keys: encrypted, pin: null, pin_timeout_ms: null });
            this.#stopPinTimer(); this.#pinProtected = false;
            this.#broadcast({ type: 'changed', account, session_id: session.session_id ?? null });
            this.#emit(PixaEvents.Session.DOWNGRADED, { account, mode: 'persist' });
            this.#emit(AccountEvents.LIST_CHANGED, { reason: 'pin', account });
            return true;
        });
    }

    changePin(currentPin, newPin) {
        return this.#serial(async () => {
            if (!this.#vault) throw new SessionError('Vault required', 'NO_VAULT');
            if (!this.#currentAccount || !this.#persistent) throw new SessionNotFoundError();
            const account = this.#currentAccount;
            const session = this.#ownRow(await this.#freshRow(account));
            if (!session.pin) throw new SessionError('Not PIN-protected', 'NOT_PIN');

            // SECURITY: same hole as removePin — an unlocked session could have its
            // PIN replaced with an attacker-chosen one without proving the old one.
            if (!(await this.#verifyPin(session, currentPin))) return false;

            if (!this.#cachedKeys) { if (!(await this.#unlockWithPin(currentPin, account))) return false; }

            const p = session.pin;
            const newSalt = this.#vault.generateSalt();

            // The pin record is accepted directly as params (argon2_* keys), so the
            // new seal provably uses the same cost as the old one.
            const sealedJson = await this.#vault.sealKeysBytes(newPin, newSalt, account, cloneKeyMap(this.#cachedKeys), p);
            const encrypted  = await this.#deviceKeys.wrap({ _pin_sealed: true, data: sealedJson });

            await this.#recheckOwnRow(account, session);
            await this.#sessions.update(account, { encrypted_keys: encrypted, pin: { ...p, salt: newSalt } });
            this.#startPinTimer(session.pin_timeout_ms ?? DEFAULT_PIN_TIMEOUT);
            this.#broadcast({ type: 'changed', account, session_id: session.session_id ?? null });
            this.#emit(PixaEvents.PIN.CHANGED, { account });
            return true;
        });
    }

    /**
     * User activity. Restarts the PIN auto-lock timer (unchanged) and — v7 —
     * slides the session window (throttled).
     */
    touchActivity() {
        this.#slide();
        if (!this.#pinTimer || !this.#cachedKeys) return;
        const account = this.#currentAccount;
        this.#safeGet(this.#sessions, account).then(s => {
            if (s?.pin_timeout_ms && this.#currentAccount === account && this.#pinTimer) this.#startPinTimer(s.pin_timeout_ms);
        }).catch(() => {});
        this.#emit(PixaEvents.PIN.ACTIVITY, { account });
    }

    // ═════════════════════════════════════════════════
    // SESSION QUERIES & MANAGEMENT
    // ═════════════════════════════════════════════════

    async getCurrentSession() {
        if (!this.#currentAccount) return null;
        const s = await this.#safeGet(this.#sessions, this.#currentAccount);
        if (!s) return null;
        const { encrypted_keys, ...safe } = s;
        return { ...safe, locked: this.isLocked };
    }

    async isSessionValid(account = null) {
        const target = normalizeAccount(account) ?? this.#currentAccount;
        if (!target) return false;
        if (target === this.#currentAccount) {
            this.#enforceDeadlines();
            if (this.#currentAccount !== target) return false;
            // v7: a tab-only session has no row and used to answer false.
            if (!this.#persistent) return true;
        }
        if (this.#parked.has(target)) return true;
        const s = await this.#safeGet(this.#sessions, target);
        if (!s) return false;
        return !isExpired(s);
    }

    async updateSession(updates) {
        const account = this.#currentAccount;
        if (!account || !this.#sessions || this.#disposed) return false;
        const safe = { ...(updates || {}) };
        for (const f of PROTECTED_FIELDS) delete safe[f];
        return this.#serial(async () => {
            if (this.#currentAccount !== account) return false;
            const row = await this.#freshRow(account);
            if (!row || row.session_id !== (this.#activeMeta?.session_id ?? row.session_id)) return false;
            try { await this.#sessions.update(account, { ...safe, last_active: Date.now() }); return true; }
            catch { return false; }
        }).catch(() => false);
    }

    /**
     * Log out the ACTIVE account: zero its keys, delete its row. Other
     * logged-in accounts are untouched unless `{ handover: true }`, which
     * makes the most recently used one take over (see removeSession).
     * Resolves the account that was logged out (v6 contract).
     * @param {{handover?: boolean, reason?: string}} [options]
     */
    endSession(options = {}) {
        return this.#serial(async () => (await this.#endActive(options || {})).account);
    }

    // ═════════════════════════════════════════════════
    // PRIVATE
    // ═════════════════════════════════════════════════

    /**
     * Run `fn` after every previously queued operation has settled, whatever
     * its outcome. Operations queued from inside `fn` must not be awaited by
     * `fn` (they would wait for `fn` itself) — call the #private variant.
     */
    #serial(fn) {
        if (this.#disposed) return Promise.reject(new SessionError('Session manager disposed', 'DISPOSED'));
        const run = this.#queue.then(() => fn(), () => fn());
        this.#queue = run.then(() => undefined, () => undefined);
        return run;
    }

    #assertUsable() {
        if (this.#disposed) throw new SessionError('Session manager disposed', 'DISPOSED');
    }

    /** Session lifetime for a new or refreshed window: requested → config → default, clamped to [floor, cap]. */
    #timeoutFor(requested) {
        const cfg = this.#config || {};
        const floor = Number(cfg.MIN_SESSION_TIMEOUT) > 0 ? Number(cfg.MIN_SESSION_TIMEOUT) : DEFAULT_MIN_TIMEOUT;
        const t = Number(requested) > 0 ? Number(requested)
            : Number(cfg.SESSION_TIMEOUT) > 0 ? Number(cfg.SESSION_TIMEOUT)
                : DEFAULT_TIMEOUT;
        return Math.min(Math.max(t, floor), this.#maxLifetime());
    }

    #maxLifetime() {
        const v = Number(this.#config?.MAX_SESSION_LIFETIME);
        return v > 0 ? v : DEFAULT_MAX_LIFETIME;
    }

    /** Row bookkeeping with an absolute cap filled in for rows that lack one. */
    #metaWithCap(row) {
        const meta = metaFromRow(row);
        if (!meta.absolute_expires_at) meta.absolute_expires_at = meta.created_at + this.#maxLifetime();
        return meta;
    }

    /** All stored rows (read from IndexedDB, not the doc cache), or null when the collection cannot be enumerated. */
    async #listRows() {
        const col = this.#sessions;
        if (!col || typeof col.getAll !== 'function') return null;
        try {
            const rows = await col.getAll();
            return Array.isArray(rows) ? rows.filter((r) => r && typeof r === 'object' && r.encrypted_keys) : [];
        } catch (e) {
            console.warn('[SM] Listing sessions failed:', e?.message || e);
            return null;
        }
    }

    /**
     * A row as IndexedDB holds it now. LacertaDB caches documents per tab
     * with no cross-tab invalidation, and every decision taken from a row
     * (expired? whose session? which salt?) must not lag behind another tab.
     */
    async #freshRow(account) {
        if (!this.#sessions || !account) return null;
        this.#dropRowCache();
        return this.#safeGet(this.#sessions, account);
    }

    #dropRowCache() {
        try { this.#sessions?.clearCache?.(); } catch {}
        try { this.#preferences?.clearCache?.(); } catch {}
    }

    /**
     * The active session's own row, for an operation that rewrites it (PIN
     * add/remove/change). Throws SESSION_NOT_FOUND when it is gone and
     * SESSION_CHANGED when it now holds another session of the account (a
     * re-login in another tab): sealing this tab's keys into that row would
     * mix two sessions. The tab then follows the row (#reconcileActive).
     */
    #ownRow(row) {
        if (!row) { this.#queueReconcile(); throw new SessionNotFoundError(); }
        const ours = this.#activeMeta?.session_id ?? null;
        if (ours != null && (row.session_id ?? null) !== ours) {
            this.#queueReconcile();
            throw new SessionError('The session was replaced in another tab', 'SESSION_CHANGED', { account: rowAccount(row) });
        }
        return row;
    }

    /**
     * Just before a PIN operation rewrites the row — after its slow part
     * (Argon2, seconds): the row must still hold the session and the PIN
     * read at the start. A re-login or PIN change in another tab meanwhile →
     * SESSION_CHANGED (update() would merge this tab's keys into that
     * session); the session ended here meanwhile → SESSION_NOT_FOUND.
     */
    async #recheckOwnRow(account, before) {
        const ours = before?.session_id ?? null;
        const row = await this.#freshRow(account);
        if (!row) { this.#queueReconcile(); throw new SessionNotFoundError(); }
        if ((row.session_id ?? null) !== ours || (row.pin?.salt ?? null) !== (before?.pin?.salt ?? null)) {
            this.#queueReconcile();
            throw new SessionError('The session was changed in another tab', 'SESSION_CHANGED', { account });
        }
        if (this.#currentAccount !== account || (this.#activeMeta?.session_id ?? null) !== ours) throw new SessionNotFoundError();
    }

    /** Queue a #reconcileActive check of the active stored session. */
    #queueReconcile() {
        const account = this.#currentAccount;
        if (!account || !this.#persistent || this.#disposed) return;
        const sessionId = this.#activeMeta?.session_id ?? null;
        this.#serial(() => this.#reconcileActive(account, sessionId)).catch(() => {});
    }

    /**
     * The active stored session may have changed behind this tab's back: a
     * logout whose message never arrived (a frozen or back/forward-cached
     * page), a newer login of the same account, a PIN added or removed in
     * another tab. The row decides, read fresh:
     *   - same session, same PIN protection → nothing to do;
     *   - another valid session of the account, or the same one with a PIN
     *     added/removed → this tab follows the row (reloaded like a resume:
     *     a PIN-sealed row arrives locked), announced as Session.RESUMED /
     *     PIN.LOCKED { reason: 'replaced' };
     *   - no row (or unreadable here) → logged out elsewhere: the next
     *     account takes over, as for a 'removed' message.
     * Runs inside the queue.
     */
    async #reconcileActive(account, sessionId) {
        const stillOurs = () => !this.#disposed && this.#currentAccount === account && this.#persistent
            && (this.#activeMeta?.session_id ?? null) === sessionId;
        if (!stillOurs()) return;
        const readAt = Date.now();
        const row = await this.#freshRow(account);
        if (!stillOurs()) return;
        const live = !!row && row.session_format === SESSION_FORMAT && !isExpired(row);
        if (live && (row.session_id ?? null) === sessionId && !!row.pin === this.#pinProtected) return;

        this.#clearActive();
        this.#emit(AccountEvents.DEACTIVATED, { account, reason: live ? 'replaced' : 'remote' });
        if (live) {
            try {
                const p = await this.#loadPersisted(row, readAt);
                if (!this.#currentAccount && this.#canCommit(p)) {
                    this.#activate(p);
                    this.#emit(p.locked ? PixaEvents.PIN.LOCKED : PixaEvents.Session.RESUMED, { account, reason: 'replaced' });
                    this.#emit(AccountEvents.LIST_CHANGED, { reason: 'replaced', account });
                    return;
                }
                zeroKeyMap(p.keys);
            } catch { /* cannot be opened here: as if logged out */ }
        }
        if (!this.#currentAccount) await this.#handOver(account, 'remote', []);
    }

    /** v7: the account this tab works as, kept per tab (sessionStorage). */
    #tabAccount() {
        try { return normalizeAccount(this.#tabStorage?.getItem?.(TAB_ACCOUNT_KEY)); } catch { return null; }
    }

    #rememberTab(account) {
        if (this.#disposed) return;   // the replacement instance owns the tab now
        try {
            if (account) this.#tabStorage?.setItem?.(TAB_ACCOUNT_KEY, account);
            else this.#tabStorage?.removeItem?.(TAB_ACCOUNT_KEY);
        } catch { /* storage unavailable: the device-wide preference applies */ }
    }

    /**
     * Delete a stored session — only the one identified by `sessionId` when
     * given (a newer login of the same account, made meanwhile in another tab,
     * is left alone). Drops `active_account` if it pointed there.
     * @returns {Promise<boolean>} whether a row was deleted
     */
    async #deleteStored(account, sessionId = null) {
        if (!account || !this.#sessions) return false;
        let deleted = false;
        if (sessionId != null) {
            const row = await this.#freshRow(account);
            if (row && (row.session_id ?? null) === sessionId) {
                await this.#sessions.delete(account).then(() => { deleted = true; }, () => {});
            }
        } else {
            await this.#sessions.delete(account).then(() => { deleted = true; }, () => {});
        }
        if (deleted && this.#preferences) {
            const pref = await this.#safeGet(this.#preferences, 'active_account');
            if (pref && normalizeAccount(pref.account) === account) {
                await this.#preferences.delete('active_account').catch(() => {});
            }
        }
        return deleted;
    }

    /** Delete rows found expired by listSessions(), re-checking each first. */
    async #prune(accounts) {
        const removed = [];
        for (const acc of accounts) {
            if (acc === this.#currentAccount) continue;
            const row = await this.#freshRow(acc);
            if (row && isExpired(row) && await this.#deleteStored(acc, row.session_id ?? null)) {
                this.#broadcast({ type: 'removed', account: acc, session_id: row.session_id ?? null });
                removed.push(acc);
            }
        }
        if (removed.length) this.#emit(AccountEvents.LIST_CHANGED, { reason: 'expired', removed });
    }

    /**
     * Load a logged-in account (parked or stored) into a ready-to-commit
     * activation, without touching in-memory state. A stored row is read
     * fresh; an expired one is deleted. Throws SessionNotFoundError,
     * SessionExpiredError, or SessionError DEVICE_MISMATCH /
     * DEVICE_UNWRAP_FAILED.
     */
    async #prepareTarget(account) {
        const parked = this.#parked.get(account);
        if (parked) return this.#loadParked(account, parked);
        if (!this.#sessions) throw new SessionNotFoundError();
        const readAt = Date.now();
        const row = await this.#freshRow(account);
        if (!row || row.session_format !== SESSION_FORMAT) throw new SessionNotFoundError();
        if (isExpired(row)) {
            if (await this.#deleteStored(account, row.session_id ?? null)) {
                this.#broadcast({ type: 'removed', account, session_id: row.session_id ?? null });
                this.#emit(AccountEvents.LIST_CHANGED, { reason: 'expired', account, removed: [account] });
            }
            throw new SessionExpiredError(account);
        }
        return this.#loadPersisted(row, readAt);
    }

    /**
     * Read a stored session into a ready-to-commit activation, without
     * touching in-memory state. Throws SessionError DEVICE_MISMATCH /
     * DEVICE_UNWRAP_FAILED.
     * @param {object} row
     * @param {number} readAt — when the row's read STARTED: a logout of this
     *        session announced by another tab after that refuses the
     *        activation (#canCommit), however long the load took.
     */
    async #loadPersisted(row, readAt = Date.now()) {
        const account = rowAccount(row);
        if (!account) throw new SessionNotFoundError();

        if (row.device_fingerprint) {
            const cur = await computeDeviceFingerprint();
            if (cur && row.device_fingerprint_version !== FINGERPRINT_VERSION) {
                // Record predates the current recipe — re-base it rather than
                // reading an older hash as "different device".
                await this.#sessions.update(account, {
                    device_fingerprint: cur, device_fingerprint_version: FINGERPRINT_VERSION,
                }).catch(() => {});
            } else if (cur && cur !== row.device_fingerprint) {
                // Not deleted: the device AES-GCM key is non-extractable and
                // machine-local, so it — not this hash — is the real binding.
                throw new SessionError('Session belongs to a different device', 'DEVICE_MISMATCH', { account });
            }
        }

        let payload;
        try {
            payload = await this.#deviceKeys.unwrap(row.encrypted_keys);
        } catch (e) {
            throw new SessionError('Device-key unwrap failed: ' + (e?.message || e), 'DEVICE_UNWRAP_FAILED', { account, cause: String(e?.message || e) });
        }

        // v6.3: migrate-on-read. A legacy hex+JSON record is only readable via
        // JSON.parse of a decoded string, i.e. every key byte passes through an
        // unzeroable string on every launch. Re-wrap it in the v2 raw-bytes
        // format once, so that exposure happens one last time.
        if (DeviceKeyManager.isLegacyRecord(row.encrypted_keys)) {
            try {
                const rewrapped = await this.#deviceKeys.wrap(payload);
                await this.#sessions.update(account, { encrypted_keys: rewrapped });
            } catch (e) {
                console.warn('[SM] Legacy record migration deferred:', e?.message || e);
            }
        }

        const sealed = !!payload?._pin_sealed;
        const meta = this.#metaWithCap(row);
        return {
            account, persistent: true, pinProtected: sealed, locked: sealed,
            keys: sealed ? null : payload,
            meta, deadline: effectiveDeadline(meta), readAt,
        };
    }

    /** A parked tab-only session → activation (unwrapped keys). */
    async #loadParked(account, parked) {
        let keys;
        try {
            keys = await this.#deviceKeys.unwrap(parked.wrapped);
        } catch (e) {
            throw new SessionError('Device-key unwrap failed: ' + (e?.message || e), 'DEVICE_UNWRAP_FAILED', { account, cause: String(e?.message || e) });
        }
        return {
            account, persistent: false, pinProtected: false, locked: false, keys,
            meta: { session_id: null, created_at: parked.created_at, last_active: Date.now(), timeout_ms: null, expires_at: 0, absolute_expires_at: 0, login_type: parked.login_type ?? null },
            deadline: 0, readAt: Date.now(), parked: true,
        };
    }

    /**
     * Whether a prepared activation may still be committed: not after
     * dispose(), and not for a session another tab logged out after it was
     * read (its 'removed' message arrived during our awaits).
     */
    #canCommit(p) {
        if (!p || this.#disposed) return false;
        if (!p.persistent) return true;
        const t = this.#tombstones.get(p.account);
        if (!t || t.at < p.readAt) return true;
        return t.session_id != null && t.session_id !== (p.meta?.session_id ?? null);
    }

    /** Install a prepared activation as the active session. Synchronous. */
    #activate(p) {
        if (p.parked) this.#parked.delete(p.account);
        this.#clearActive();
        this.#currentAccount = p.account;
        this.#persistent = p.persistent;
        this.#activeMeta = p.meta;
        this.#sessionDeadline = p.persistent ? p.deadline : 0;
        if (p.locked) {
            this.#setCachedKeys(null);
            this.#pinProtected = true;
        } else {
            this.#setCachedKeys(p.keys);
            this.#pinProtected = false;
        }
        // A tab-only session does not survive a reload: the tab keeps
        // resuming its stored account.
        if (p.persistent) this.#rememberTab(p.account);
    }

    /** After #activate: remember the choice and move the window. */
    async #afterActivation(p) {
        if (!p.persistent) return;
        await this.#upsert(this.#preferences, 'active_account', { account: p.account }).catch(() => {});
        await this.#refreshTimeout();
    }

    /**
     * End the ACTIVE session (inside the queue). With `handover`, the most
     * recently used other logged-in account takes over (#handOver).
     *
     * A logout (or a PIN wipe) ends the ACCOUNT on this device: the row is
     * deleted whichever session of it it holds — another tab may have logged
     * the account in again since this tab loaded its own — and every tab
     * holding a stored session of it drops it ('removed' { all: true }). Only
     * the automatic deletions (expiry) are limited to the session they
     * examined.
     */
    async #endActive({ reason = null, handover = false } = {}) {
        const account = this.#currentAccount;
        const persistent = this.#persistent;
        this.#clearActive();
        let removed = [];
        if (account) {
            removed = [account];
            // A tab-only session has no row of its own, but the account may
            // have been logged in with "stay connected" in another tab since:
            // that session goes too (removeSession of a parked tab-only
            // account always did this).
            const row = await this.#freshRow(account);
            if (row) await this.#deleteStored(account, row.session_id ?? null);
            // session_id names the row deleted (a tab whose write races the
            // deletion puts it back: deleted again on receipt), `all` the scope.
            if (persistent || row) this.#broadcast({ type: 'removed', account, session_id: row?.session_id ?? null, all: true });
        }
        if (account && handover) {
            const next = await this.#handOver(account, reason || 'logout', removed);
            return { account, removed: !!account, switchedTo: next };
        }
        this.#rememberTab(null);
        this.#emit(PixaEvents.Session.ENDED, reason ? { account, reason } : { account });
        if (account) this.#emit(AccountEvents.LIST_CHANGED, { reason: reason || 'logout', account, removed });
        return { account, removed: !!account, switchedTo: null };
    }

    /**
     * Inside the queue, with nobody active: let the most recently used other
     * logged-in account take over `lost`'s place. Announces the outcome:
     * Session.ENDED { account: lost, reason, next?, switching? }, then — if
     * someone took over — SWITCHED { reason, replaces: lost }.
     * @returns {Promise<string|null>} the account that took over
     */
    async #handOver(lost, reason, removed = []) {
        let successor = null;
        if (!this.#currentAccount && !this.#disposed) {
            const candidates = (await this.listSessions()).filter((s) => !s.active && s.account !== lost);
            for (const c of candidates) {
                let p = null;
                try { p = await this.#prepareTarget(c.account); } catch { continue; }
                if (this.#canCommit(p)) { successor = p; break; }
                zeroKeyMap(p.keys);
            }
        }
        if (successor && this.#currentAccount) {
            // Someone became active meanwhile (cannot happen inside the queue,
            // but a stale successor must never replace a live account).
            zeroKeyMap(successor.keys);
            successor = null;
        }
        if (this.#currentAccount) {
            this.#emit(AccountEvents.LIST_CHANGED, { reason, account: lost, removed });
            return null;
        }

        if (!successor) this.#rememberTab(null);
        this.#emit(PixaEvents.Session.ENDED, successor
            ? { account: lost, reason, next: successor.account, switching: true }
            : { account: lost, reason });
        if (successor) {
            this.#activate(successor);
            this.#emit(AccountEvents.SWITCHED, {
                reason, replaces: lost, ...this.#activeResult(), previous: null, mode: this.currentMode,
            });
            await this.#afterActivation(successor);
        }
        this.#emit(AccountEvents.LIST_CHANGED, { reason, account: lost, removed, next: successor?.account ?? null });
        return successor?.account ?? null;
    }

    /**
     * What parking the active account needs, computed without changing state:
     * nothing for a persistent session (its row is its parked form), a
     * device-wrapped copy of the keys for a tab-only one.
     */
    async #prepareParking() {
        const account = this.#currentAccount;
        if (!account) return null;
        if (this.#persistent || !this.#cachedKeys) return { account, persistent: this.#persistent };
        const wrapped = await this.#deviceKeys.wrap(this.#cachedKeys);
        return {
            account, persistent: false, wrapped,
            created_at: this.#activeMeta?.created_at ?? Date.now(),
            login_type: this.#activeMeta?.login_type ?? null,
        };
    }

    /** Park per #prepareParking's token and clear the active state. Synchronous. */
    #commitParking(token) {
        if (token && !token.persistent && token.wrapped && token.account === this.#currentAccount) {
            this.#parked.set(token.account, {
                wrapped: token.wrapped, created_at: token.created_at,
                parked_at: Date.now(), login_type: token.login_type,
            });
        }
        if (token) this.#clearActive();
    }

    /** Clear the active session from memory (keys zeroed). No DB writes. */
    #clearActive() {
        this.#stopPinTimer(); this.#wipeCachedKeys();
        this.#currentAccount = null; this.#persistent = false;
        this.#pinProtected = false; this.#sessionDeadline = 0;
        this.#activeMeta = null; this.#lastSlide = 0;
    }

    #activeResult() {
        const account = this.#currentAccount;
        if (!account) return null;
        return { account, locked: this.#pinProtected && this.#cachedKeys === null, persistent: this.#persistent, pinProtected: this.#pinProtected };
    }

    /**
     * Authoritatively verify a PIN against the stored sealed record.
     *
     * v6.3: uses vault.verifyPinAgainstSealed() — the record's commitment tag
     * BLAKE3(key ‖ nonce) proves the PIN with no plaintext produced. Older
     * vaults without that method fall back to unsealing a throwaway copy and
     * zeroing it immediately. v7: the blob is always the given row's own.
     *
     * @param {object} session — session record (must carry .pin)
     * @param {string} pin
     * @returns {Promise<boolean>}
     */
    async #verifyPin(session, pin) {
        if (!this.#vault) throw new SessionError('Vault required', 'NO_VAULT');
        const p = session?.pin;
        if (!p) return false;
        if (typeof pin !== 'string' || pin.length === 0) return false;
        const account = rowAccount(session) ?? this.#currentAccount;

        let sealed;
        try {
            const payload = await this.#deviceKeys.unwrap(session.encrypted_keys);
            if (!payload._pin_sealed) return false;
            sealed = payload.data;
        } catch { return false; }

        let probe = null;
        try {
            if (typeof this.#vault.verifyPinAgainstSealed === 'function') {
                return await this.#vault.verifyPinAgainstSealed(pin, p.salt, sealed, p);
            }
            probe = await this.#vault.unsealKeysBytes(pin, p.salt, sealed, p, account);
            return true;
        } catch {
            return false;
        } finally {
            if (probe) zeroKeyMap(probe);  // the probe copy never outlives this call
        }
    }

    /**
     * Public form of #verifyPin for callers that must prove the PIN before a
     * sensitive export (e.g. a "show my keys" screen). Never records attempts
     * — the caller (PixaProxyAPI) owns the lockout counter.
     * @param {string} pin
     * @returns {Promise<boolean>}
     */
    async verifyPin(pin) {
        if (!this.#currentAccount) return false;
        const session = await this.#freshRow(this.#currentAccount);
        if (!session?.pin) return false;
        return this.#verifyPin(session, pin);
    }

    /**
     * Wall-clock enforcement of the PIN deadline and the session expiry.
     * Called from getKeys()/isLocked/hasKeysInMemory and from the page
     * visibility listeners. Both clear in-memory state synchronously; what
     * happens to the row is decided in the queue, on a fresh read
     * (#afterLocalExpiry).
     *
     * @returns {{expired: true, account: string}|{locked: true}|null}
     */
    #enforceDeadlines() {
        if (this.#disposed) return null;
        const now = Date.now();
        if (this.#currentAccount && this.#sessionDeadline > 0 && now >= this.#sessionDeadline) {
            const account = this.#currentAccount;
            const sessionId = this.#activeMeta?.session_id ?? null;
            this.#clearActive();
            this.#emit(AccountEvents.DEACTIVATED, { account, reason: 'expired' });
            this.#serial(() => this.#afterLocalExpiry(account, sessionId)).catch(() => {});
            return { expired: true, account };
        }
        if (this.#cachedKeys && this.#pinDeadline > 0 && now >= this.#pinDeadline) {
            this.#onPinTimeout();
            return { locked: true };
        }
        return null;
    }

    /**
     * The active session's deadline passed HERE (in-memory keys are already
     * gone). The deadline may be stale: another tab kept the account in use
     * and slid its window, or logged it in again. So the row decides:
     *   - still valid → the session is reopened here (unless someone else
     *     became active meanwhile) — no logout anywhere;
     *   - expired → deleted (that session only), EXPIRED, hand-over;
     *   - gone → EXPIRED, hand-over.
     */
    async #afterLocalExpiry(account, sessionId) {
        const readAt = Date.now();
        let row = await this.#freshRow(account);
        if (row && row.session_format !== SESSION_FORMAT) row = null;
        let removed = [];
        if (row && !isExpired(row)) {
            if (this.#currentAccount) {
                this.#emit(AccountEvents.LIST_CHANGED, { reason: 'refreshed', account });
                return;
            }
            try {
                const p = await this.#loadPersisted(row, readAt);
                if (!this.#currentAccount && this.#canCommit(p)) {
                    this.#activate(p);
                    this.#emit(p.locked ? PixaEvents.PIN.LOCKED : PixaEvents.Session.RESUMED, { account, reason: 'refreshed' });
                    this.#emit(AccountEvents.LIST_CHANGED, { reason: 'refreshed', account });
                    return;
                }
                zeroKeyMap(p.keys);
            } catch { /* cannot be reopened here: treated as gone for this tab */ }
            if (this.#currentAccount) {
                this.#emit(AccountEvents.LIST_CHANGED, { reason: 'refreshed', account });
                return;
            }
        } else if (row) {
            if (await this.#deleteStored(account, row.session_id ?? sessionId)) {
                this.#broadcast({ type: 'removed', account, session_id: row.session_id ?? sessionId });
                removed = [account];
            }
        }
        this.#emit(PixaEvents.Session.EXPIRED, { account, reason: 'expired' });
        if (this.#currentAccount) {
            this.#emit(AccountEvents.LIST_CHANGED, { reason: 'expired', account, removed });
            return;
        }
        await this.#handOver(account, 'expired', removed);
    }

    /**
     * v7: slide the active session's window on presence, at most once per
     * SLIDE_THROTTLE_MS — a locked PIN session too: using the app keeps the
     * login alive; signing still needs the PIN. An expired session is
     * #enforceDeadlines' business.
     */
    #slide() {
        if (this.#disposed || !this.#currentAccount || !this.#persistent || !this.#activeMeta || !this.#sessions) return;
        const now = Date.now();
        if (this.#sessionDeadline > 0 && now >= this.#sessionDeadline) return;
        if (now - this.#lastSlide < SLIDE_THROTTLE_MS) return;
        const account = this.#currentAccount;
        const sessionId = this.#activeMeta.session_id ?? null;
        const write = this.#advanceWindow(now);
        this.#emit(AccountEvents.REFRESHED, { account, expiresAt: this.#sessionDeadline });
        this.#serial(async () => {
            // The row is gone or holds another session: the window just moved
            // in memory belongs to a session that no longer exists as such.
            if (!(await this.#writeWindow(account, sessionId, write))) await this.#reconcileActive(account, sessionId);
        }).catch(() => {});
    }

    /** v7: refresh the active window now and persist it (inside a serialized op). */
    async #refreshTimeout() {
        if (!this.#currentAccount || !this.#persistent || !this.#activeMeta || !this.#sessions) return;
        const account = this.#currentAccount;
        const sessionId = this.#activeMeta.session_id ?? null;
        const write = this.#advanceWindow(Date.now());
        await this.#writeWindow(account, sessionId, write);
        this.#emit(AccountEvents.REFRESHED, { account, expiresAt: this.#sessionDeadline });
    }

    /**
     * Persist a window move for `sessionId` only — never onto a row logged
     * out meanwhile or replaced by a newer login (update() would merge into
     * it) — and tell the other tabs, whose deadlines for this session would
     * otherwise lag behind. Returns false — and #slide has the tab follow
     * its row — when the row is gone, holds another session, or had its PIN
     * added or removed in another tab.
     */
    async #writeWindow(account, sessionId, write) {
        const row = await this.#freshRow(account);
        if (!row || (sessionId != null && (row.session_id ?? null) !== sessionId)) return false;
        if (account === this.#currentAccount && !!row.pin !== this.#pinProtected) return false;
        try { await this.#sessions.update(account, write); } catch { return false; }
        this.#broadcast({ type: 'refreshed', account, session_id: sessionId, ...write });
        return true;
    }

    /** Move the in-memory window to `now`; returns the row fields to write. */
    #advanceWindow(now) {
        const meta = this.#activeMeta;
        const timeout = this.#timeoutFor(meta.timeout_ms);
        const expires_at = now + timeout;
        if (!meta.absolute_expires_at) meta.absolute_expires_at = (meta.created_at || now) + this.#maxLifetime();
        meta.timeout_ms = timeout; meta.expires_at = expires_at; meta.last_active = now;
        this.#sessionDeadline = effectiveDeadline(meta);
        this.#lastSlide = now;
        return { last_active: now, expires_at, timeout_ms: timeout, absolute_expires_at: meta.absolute_expires_at };
    }

    /**
     * Every assignment to #cachedKeys goes through here so the previous
     * plaintext map is zeroed instead of orphaned (v6.3).
     * @param {Object<string, Uint8Array>|null} map
     */
    #setCachedKeys(map) {
        if (this.#cachedKeys && this.#cachedKeys !== map) zeroKeyMap(this.#cachedKeys);
        this.#cachedKeys = map;
    }

    /**
     * Tear down this instance WITHOUT ending the persisted session: stop the
     * PIN timer, remove the page listeners, zero the in-memory keys, and
     * refuse every further operation — one still queued (a resume, a switch)
     * must not put keys into the retired instance. For instance replacement
     * (API-node switch) — the replacement instance restores the session from
     * the DB on its own. Tab-only sessions, active or parked, have no row and
     * do not survive it. Idempotent.
     */
    dispose() {
        this.#disposed = true;
        this.#stopPinTimer();
        const g = globalThis;
        if (this.#onVisibleBound) {
            g.document?.removeEventListener?.('visibilitychange', this.#onVisibleBound);
            g.removeEventListener?.('pageshow', this.#onVisibleBound);
            g.removeEventListener?.('focus', this.#onVisibleBound);
            this.#onVisibleBound = null;
        }
        if (this.#onPresenceBound) {
            g.removeEventListener?.('pointerdown', this.#onPresenceBound, { capture: true });
            g.removeEventListener?.('keydown', this.#onPresenceBound, { capture: true });
            this.#onPresenceBound = null;
        }
        if (this.#channel) {
            try { this.#channel.close(); } catch {}
            this.#channel = null;
        }
        this.#wipeCachedKeys();
        this.#parked.clear();
    }

    // ── Cross-tab (v7) ──────────────────────────────

    #openChannel() {
        if (this.#channel || typeof globalThis.BroadcastChannel !== 'function') return;
        try {
            this.#channel = new globalThis.BroadcastChannel(CHANNEL_NAME);
            this.#channel.onmessage = (ev) => this.#onChannelMessage(ev?.data);
        } catch { this.#channel = null; }
    }

    #broadcast(msg) {
        try { this.#channel?.postMessage(msg); } catch {}
    }

    #onChannelMessage(msg) {
        if (!msg || typeof msg !== 'object' || this.#disposed) return;
        // LacertaDB caches documents per tab and has no cross-tab
        // invalidation: point reads must not lag behind what was just written.
        this.#dropRowCache();
        const account = normalizeAccount(msg.account);
        const sid = msg.session_id ?? null;

        if (msg.type === 'removed' && account) {
            // A logout ends the account (`all`), an expiry one session.
            const all = msg.all === true || sid == null;
            // Refuse an activation of it that is still in flight here.
            const now = Date.now();
            for (const [a, t] of this.#tombstones) if (now - t.at > TOMBSTONE_TTL_MS) this.#tombstones.delete(a);
            this.#tombstones.set(account, { at: now, session_id: all ? null : sid });

            // Our copy: its row — the keys' only persistent copy — is gone, so
            // its keys go too, and someone takes over. A tab-only session of
            // the same account is a separate session and stays, and so does a
            // newer login of it when only an older session expired.
            const ourSid = this.#activeMeta?.session_id ?? null;
            const mine = account === this.#currentAccount && this.#persistent
                && (all || sid === ourSid);
            if (mine) {
                this.#clearActive();
                this.#emit(AccountEvents.DEACTIVATED, { account, reason: 'remote' });
                this.#serial(() => this.#handOver(account, 'remote', [])).catch(() => {});
            } else {
                this.#emit(AccountEvents.LIST_CHANGED, { reason: 'remote', account });
            }
            // A write that raced the deletion (LacertaDB update() is
            // read-then-put) may have put the row back: delete it again — the
            // session named, and ours if it was ours.
            const again = new Set([sid, mine ? ourSid : null].filter((s) => s != null));
            for (const s of again) {
                this.#serial(async () => {
                    if (!(await this.#deleteStored(account, s))) return;
                    // It was back: the lists that saw it (here, and in the
                    // tabs that got this tab's 'refreshed') must drop it again.
                    this.#broadcast({ type: 'removed', account, session_id: s, all });
                    this.#emit(AccountEvents.LIST_CHANGED, { reason: 'remote', account, removed: [account] });
                }).catch(() => {});
            }
            return;
        }

        if (msg.type === 'refreshed' && account) {
            // Another tab slid this session's window: keep our deadline in step.
            const meta = this.#activeMeta;
            if (account === this.#currentAccount && this.#persistent && meta && sid != null && sid !== meta.session_id) {
                // ... another session of OUR account: ours was replaced.
                this.#queueReconcile();
            } else if (account === this.#currentAccount && this.#persistent && meta && sid != null && sid === meta.session_id) {
                const e = Number(msg.expires_at) || 0;
                if (e > (meta.expires_at || 0)) {
                    meta.expires_at = e;
                    if (Number(msg.timeout_ms) > 0) meta.timeout_ms = Number(msg.timeout_ms);
                    if (Number(msg.last_active) > 0) meta.last_active = Number(msg.last_active);
                    if (!meta.absolute_expires_at && Number(msg.absolute_expires_at) > 0) meta.absolute_expires_at = Number(msg.absolute_expires_at);
                    this.#sessionDeadline = effectiveDeadline(meta);
                    this.#emit(AccountEvents.REFRESHED, { account, expiresAt: this.#sessionDeadline });
                }
            }
            this.#emit(AccountEvents.LIST_CHANGED, { reason: 'remote', account });
            return;
        }

        if (msg.type === 'changed') {
            // A login, a switch, a PIN added/removed/changed elsewhere: if it
            // concerns the account active here, re-check its row (a newer
            // login replaced it, or its PIN protection changed).
            if (account && account === this.#currentAccount && this.#persistent) this.#queueReconcile();
            this.#emit(AccountEvents.LIST_CHANGED, { reason: 'remote', account });
        }
    }

    async #safeGet(c, id) { if (!c || !id) return null; try { return await c.get(id); } catch { return null; } }
    async #upsert(c, id, d) { if (c.upsert) { await c.upsert(id, d); return; } try { await c.add(d, { id }); } catch { await c.update(id, d); } }

    #startPinTimer(ms) {
        this.#stopPinTimer();
        this.#pinDeadline = Date.now() + ms;          // wall-clock truth
        this.#pinTimer = setTimeout(() => this.#onPinTimeout(), ms); // eager path
    }
    #stopPinTimer() {
        if (this.#pinTimer !== null) { clearTimeout(this.#pinTimer); this.#pinTimer = null; }
        this.#pinDeadline = 0;
    }

    /**
     * PIN auto-lock: zero the keys. Synchronous since v7 — the sealed blob is
     * no longer cached here (unlockWithPin reads it from the row), so there
     * is no async tail to race a switch.
     */
    #onPinTimeout() {
        const account = this.#currentAccount;
        this.#pinTimer = null; this.#pinDeadline = 0;
        if (!this.#cachedKeys) return;
        this.#wipeCachedKeys();
        if (account) this.#emit(PixaEvents.PIN.LOCKED, { account });
    }

    #wipeCachedKeys() {
        if (this.#cachedKeys) { zeroKeyMap(this.#cachedKeys); this.#cachedKeys = null; }
    }

    #emit(event, data) {
        if (this.#disposed) return;   // retired: work still queued must not speak for the tab
        try { this.#emitter?.emit(event, data); }
        catch (e) { console.error('[SM] listener error on', event, e); }
    }
}

export const SessionMode = Object.freeze({ PIN: 'pin', EPHEMERAL: 'ephemeral', PERSIST: 'persist' });
export default SessionManager;