/**
 * Session Manager v6 — Byte-level key lifecycle.
 *
 * Keys are stored internally as Uint8Array (WIF UTF-8 bytes), never as
 * JS strings. This allows .fill(0) to actually zero the memory on wipe,
 * unlike JS strings which are immutable.
 *
 * Encryption pipeline:
 *   No PIN:  keys(bytes) → DeviceKeyManager.wrap → LacertaDB
 *   PIN:     keys(bytes) → vault.sealKeysBytes → DeviceKeyManager.wrap → LacertaDB
 *
 * v6.2 changes:
 *   - DeviceKeyManager serializes wrap() payloads with TurboSerial (injected
 *     via options.serializer, e.g. lacerta.serializer) instead of JSON +
 *     Array.from. No unzeroable strings / number arrays hold plaintext key
 *     bytes anymore; {iv, ct} are stored as raw Uint8Array (v2 format).
 *     Legacy hex+JSON records remain readable (detected by string iv).
 *   - createSession THROWS 'NO_VAULT' if a PIN is requested while the vault
 *     is not loaded — a requested PIN is never silently dropped.
 *   - createSession/addPin default Argon2 params from the injected vault
 *     (auto-tuned) before falling back to config/constants, so auto-tune
 *     actually reaches sealing.
 *
 * v6.3 changes (key-material lifecycle):
 *   - Every assignment to #cachedKeys goes through #setCachedKeys(), which
 *     zeros the previous map. createSession / resume / unlockWithPin /
 *     importKeys used to orphan the old plaintext (double-submitted unlock,
 *     re-login) unzeroed.
 *   - PIN auto-lock is enforced against a WALL-CLOCK deadline, not only the
 *     setTimeout: browsers pause timers across system sleep (macOS/Linux
 *     monotonic clocks) and in frozen tabs, so a 30-minute lock could
 *     survive a night with the lid closed. getKeys()/isLocked check the
 *     deadline on every access; visibilitychange/pageshow/focus re-check it;
 *     the timer remains as the eager path. The session's own expires_at is
 *     enforced the same way — an expired persist-mode session no longer
 *     serves keys until reload.
 *   - unlockWithPin THROWS SessionError('DEVICE_UNWRAP_FAILED') when the
 *     device-key unwrap fails, instead of returning false. `false` means
 *     "wrong PIN" to PixaProxyAPI, which records a failed attempt — an
 *     IndexedDB hiccup could walk a legitimate user into lockout or wipe.
 *   - All key copies are off-heap (CryptoUtils.secureCopy): V8 keeps ≤ 64-byte
 *     typed arrays on its moving heap where fill(0) is not final.
 *   - Legacy hex+JSON records are migrated to v2 on the first successful
 *     resume(), so their string round-trip happens one last time instead of
 *     on every launch. DeviceKeyManager.wrap() now REQUIRES the serializer
 *     (symmetric with unwrap) — a missing serializer is a wiring bug, not a
 *     reason to silently write the legacy format.
 *   - #verifyPin uses vault.verifyPinAgainstSealed() (commitment-tag check,
 *     no plaintext) when available; unsealKeysBytes gets the account so the
 *     AAD is recomputed rather than trusted from the record.
 *   - createSession stops a leftover PIN timer from a previous session (it
 *     used to fire later and wipe the new session's keys).
 *   - dispose(): tear down timers/listeners and zero in-memory keys without
 *     ending the persisted session (instance replacement).
 *   - exportKeysAsStrings() is deprecated (no caller in pixaproxyapi.js).
 *
 * @version 6.3.0
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

// ── DeviceKeyManager ────────────────────────────────

export class DeviceKeyManager {
    static #DB_NAME = 'pixa_device_keys';
    static #STORE_NAME = 'keys';
    static #KEY_ID = 'device_key';
    #cryptoKey = null;
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
    // v6.3 (wrap() no longer produces this format); resume() migrates on read.
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
        const db = await DeviceKeyManager.#openDB();
        try {
            let key = await DeviceKeyManager.#idbGet(db);
            if (!key) {
                key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
                await DeviceKeyManager.#idbPut(db, key);
            }
            this.#cryptoKey = key;
            return key;
        } finally { db.close(); }
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
    static #idbPut(db, key) {
        return new Promise((res, rej) => {
            const tx = db.transaction(DeviceKeyManager.#STORE_NAME, 'readwrite');
            tx.objectStore(DeviceKeyManager.#STORE_NAME).put(key, DeviceKeyManager.#KEY_ID);
            tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
        });
    }
}

// ── Device Fingerprint ──────────────────────────────

/**
 * Fingerprint recipe version. Bump whenever `computeDeviceFingerprint`
 * changes what it hashes; records carrying an older version are re-based
 * instead of being treated as a mismatch (see resume()).
 */
const FINGERPRINT_VERSION = 2;

async function computeDeviceFingerprint() {
    if (!globalThis.navigator || !globalThis.crypto?.subtle) return null;
    const nav = globalThis.navigator;
    // v2: dropped navigator.userAgent and screen geometry. The full UA string
    // changes on every browser auto-update, and screen.width/height/colorDepth
    // change when the window moves to another monitor — both produced spurious
    // "different device" verdicts on the same machine.
    const parts = [
        nav.language ?? '', nav.platform ?? '',
        String(nav.hardwareConcurrency ?? ''), String(nav.deviceMemory ?? ''),
        Intl?.DateTimeFormat?.().resolvedOptions().timeZone ?? String(new Date().getTimezoneOffset()),
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

// ── Utilities ───────────────────────────────────────

function normalizeAccount(account) {
    if (!account) return null;
    const raw = typeof account === 'string' ? account : account.account ?? account.name ?? '';
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
    for (const k of Object.keys(keys)) {
        const v = keys[k];
        if (v instanceof Uint8Array) v.fill(0);
        if (v && typeof v.destroy === 'function') v.destroy();
        keys[k] = null;
    }
}

// ── Defaults ────────────────────────────────────────

const DEFAULT_TIMEOUT      = 12 * 60 * 60 * 1000;
const DEFAULT_PIN_TIMEOUT  = 30 * 60 * 1000;
const DEFAULT_MAX_LIFETIME = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_ARGON2_MEM   = 32768;
const DEFAULT_ARGON2_ITER  = 2;
// v6.3: was 3, contradicting SecureVault's corrected DEFAULT_PARALLELISM (1).
// Only reached when no vault is injected (which also means no PIN sealing),
// but a stale constant next to the real one is a trap. See the rationale on
// DEFAULT_PARALLELISM in pq-secure-vault.js.
const DEFAULT_ARGON2_PAR   = 1;

// ═════════════════════════════════════════════════════
// SessionManager v6.1
// ═════════════════════════════════════════════════════

export class SessionManager {

    #db; #config; #vault; #deviceKeys;
    #sessions = null; #preferences = null;
    #currentAccount = null; #persistent = false;
    /** @type {Object<string, Uint8Array>|null} WIF bytes, zeroable */
    #cachedKeys = null;
    /** @type {string|null} device-unwrapped sealed JSON (PIN-locked) */
    #sealedData = null;
    /** @type {boolean} whether this session is PIN-protected, independent of
     *  whether it currently happens to be locked. #sealedData is only a cache
     *  of the sealed blob and is nulled on unlock, so it cannot answer this. */
    #pinProtected = false;
    #pinTimer = null; #emitter = null;
    /** @type {number} wall-clock ms at which cached keys must be locked (0 = none) */
    #pinDeadline = 0;
    /** @type {number} wall-clock ms at which the session itself expires (0 = none) */
    #sessionDeadline = 0;
    /** @type {Function|null} bound visibilitychange/pageshow/focus handler */
    #onVisibleBound = null;
    /** @type {boolean} re-entrancy guard for the lock path */
    #locking = false;

    constructor(db, config, options = {}) {
        this.#db = db; this.#config = config;
        this.#vault = options.vault ?? null;
        // v6.2: options.serializer (TurboSerial, e.g. lacerta.serializer)
        // switches DeviceKeyManager to the byte-level v2 wrap format.
        this.#deviceKeys = new DeviceKeyManager(options.serializer ?? null);
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
        const g = globalThis;
        if (!this.#onVisibleBound && typeof g.addEventListener === 'function') {
            this.#onVisibleBound = () => {
                if (g.document?.visibilityState === 'hidden') return;
                this.#enforceDeadlines();
            };
            g.document?.addEventListener?.('visibilitychange', this.#onVisibleBound);
            g.addEventListener('pageshow', this.#onVisibleBound);
            g.addEventListener('focus', this.#onVisibleBound);
        }
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

    async createSession(account, options = {}) {
        const norm = normalizeAccount(account);
        if (!norm) throw new SessionError('Invalid account', 'INVALID_ACCOUNT');
        if (!options.keys || Object.keys(options.keys).length === 0) throw new SessionError('Keys required', 'NO_KEYS');

        // Normalize to Uint8Array immediately — no string WIFs kept
        const keyBytes = {};
        for (const [type, value] of Object.entries(options.keys)) {
            if (value) keyBytes[type] = toKeyBytes(value);
        }

        const persistent = options.persistent !== false;

        if (!persistent) {
            this.#stopPinTimer();           // a previous PIN session's timer must not wipe these keys later
            this.#setCachedKeys(keyBytes); this.#currentAccount = norm;
            this.#persistent = false; this.#sealedData = null;
            this.#pinProtected = false; this.#sessionDeadline = 0;
            this.#emit(PixaEvents.Session.CREATED, { account: norm, mode: 'ephemeral', persistent: false });
            return CryptoUtils.generateId(32);
        }

        if (!this.#sessions) throw new SessionError('DB not initialized', 'NO_DB');

        // FIX (v6.2): A requested PIN must NEVER be silently dropped. Previously,
        // if the vault WASM hadn't finished its fire-and-forget load, hasPin
        // evaluated false and the keys were stored device-wrapped only — with
        // no error and no PIN protection. Fail loud; callers must await vault init.
        if (options.pin && !this.#vault) {
            throw new SessionError('PIN requested but vault is not loaded', 'NO_VAULT');
        }

        const hasPin   = !!(options.pin && this.#vault);
        const now      = Date.now();
        const timeout  = options.timeout_ms ?? this.#config.SESSION_TIMEOUT ?? DEFAULT_TIMEOUT;
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
            account: norm, session_id: sessId,
            created_at: now, last_active: now, timeout_ms: timeout,
            expires_at: now + timeout,
            absolute_expires_at: now + (this.#config.MAX_SESSION_LIFETIME ?? DEFAULT_MAX_LIFETIME),
            pin_timeout_ms: hasPin ? pinTimeout : null,
            device_fingerprint: fingerprint, device_fingerprint_version: FINGERPRINT_VERSION,
            encrypted_keys: encryptedKeys,
            pin: pinRecord, login_type: options.login_type ?? 'unknown',
            user_agent: options.user_agent ?? 'unknown',
        };

        await this.#upsert(this.#sessions, norm, record);
        await this.#upsert(this.#preferences, 'active_account', { account: norm });

        this.#stopPinTimer();               // see the ephemeral branch
        this.#setCachedKeys(keyBytes); this.#currentAccount = norm;
        this.#persistent = true; this.#sealedData = null;
        this.#pinProtected = hasPin;
        this.#sessionDeadline = Math.min(record.expires_at, record.absolute_expires_at);
        if (hasPin) this.#startPinTimer(pinTimeout);

        this.#emit(PixaEvents.Session.CREATED, {
            account: norm, sessionId: sessId, mode: hasPin ? 'pin' : 'persist',
            persistent: true, pinProtected: hasPin,
        });
        return sessId;
    }

    // ═════════════════════════════════════════════════
    // SESSION RESUME
    // ═════════════════════════════════════════════════

    async resume() {
        if (!this.#preferences) return null;
        const pref = await this.#safeGet(this.#preferences, 'active_account');
        if (!pref?.account) return null;
        const account = pref.account;

        const session = await this.#safeGet(this.#sessions, account);
        if (!session) { await this.#preferences.delete('active_account').catch(() => {}); return null; }

        const now = Date.now();
        if (now > session.expires_at || (session.absolute_expires_at && now > session.absolute_expires_at)) {
            await this.#fullLogout(); this.#emit(PixaEvents.Session.EXPIRED, { account }); return null;
        }
        if (session.device_fingerprint) {
            const cur = await computeDeviceFingerprint();
            const versionMatches = session.device_fingerprint_version === FINGERPRINT_VERSION;
            if (cur && !versionMatches) {
                // Record predates the current recipe — re-base it rather than
                // reading a v1 hash as "different device". Without this, every
                // stored session would mismatch once on upgrade.
                await this.#sessions.update(account, {
                    device_fingerprint: cur, device_fingerprint_version: FINGERPRINT_VERSION,
                }).catch(() => {});
            } else if (cur && cur !== session.device_fingerprint) {
                // #softLogout, NOT #fullLogout: a mismatch used to delete the
                // session row, which destroys the encrypted keys and forces WIF
                // re-entry. The device AES-GCM key is non-extractable and
                // machine-local, so it — not this hash — is the real binding.
                await this.#softLogout();
                this.#emit(PixaEvents.Session.EXPIRED, { account, reason: 'device_mismatch' });
                return null;
            }
        }

        let payload;
        try { payload = await this.#deviceKeys.unwrap(session.encrypted_keys); }
        catch (e) {
            // Also non-destructive: a transient IndexedDB/device-key read failure
            // must not be indistinguishable from "wipe this account's keys".
            console.error('[SM.resume] Device-unwrap failed:', e.message);
            await this.#softLogout();
            return null;
        }

        // v6.3: migrate-on-read. A legacy hex+JSON record is only readable via
        // JSON.parse of a decoded string, i.e. every key byte passes through an
        // unzeroable string on every launch. Re-wrap it in the v2 raw-bytes
        // format once, so that exposure happens one last time.
        if (DeviceKeyManager.isLegacyRecord(session.encrypted_keys)) {
            try {
                const rewrapped = await this.#deviceKeys.wrap(payload);
                await this.#sessions.update(account, { encrypted_keys: rewrapped });
            } catch (e) {
                console.warn('[SM.resume] Legacy record migration deferred:', e?.message || e);
            }
        }

        this.#stopPinTimer();
        this.#currentAccount = account; this.#persistent = true;
        this.#sessionDeadline = session.absolute_expires_at
            ? Math.min(session.expires_at, session.absolute_expires_at)
            : session.expires_at;

        if (payload._pin_sealed) {
            this.#sealedData = payload.data; this.#setCachedKeys(null);
            this.#pinProtected = true;
            this.#emit(PixaEvents.PIN.LOCKED, { account });
            return { account, locked: true, persistent: true, pinProtected: true };
        }

        // payload values are off-heap Uint8Array copies (DeviceKeyManager.unwrap)
        this.#setCachedKeys(payload); this.#sealedData = null;
        this.#pinProtected = false;
        await this.#refreshTimeout(session);
        this.#emit(PixaEvents.Session.RESUMED, { account });
        return { account, locked: false, persistent: true, pinProtected: false };
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
            // Keyed off #pinProtected, not #sealedData: if the re-unwrap in
            // #onPinTimeout failed, #sealedData stays null and the UI used to
            // get SESSION_NOT_FOUND ("logged out") instead of the PIN prompt.
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
     * The bytes are the WIF's UTF-8 encoding (see the v6 header), so the
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

    async unlockWithPin(pin) {
        if (!this.#currentAccount) throw new SessionNotFoundError();
        if (!this.#vault) throw new SessionError('Vault not available', 'NO_VAULT');
        const session = await this.#getSession(this.#currentAccount);

        if (Date.now() > session.expires_at) { await this.#fullLogout(); throw new SessionExpiredError(this.#currentAccount); }

        let sealedData = this.#sealedData;
        if (!sealedData) {
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
        }

        const p = session.pin;
        if (!p) throw new SessionError('No PIN config', 'NO_PIN_CONFIG');

        try {
            // unsealKeysBytes → { type: Uint8Array } — byte-level, zeroable.
            // `p` carries this record's argon2_* params; no vault mutation.
            // The account is passed so the vault recomputes the AAD instead of
            // trusting the record's own aad_account (v6.3).
            const keyBytes = await this.#vault.unsealKeysBytes(pin, p.salt, sealedData, p, this.#currentAccount);
            this.#setCachedKeys(keyBytes); this.#sealedData = null;
            this.#pinProtected = true;  // unlocked ≠ no longer PIN-protected
            this.#startPinTimer(session.pin_timeout_ms ?? DEFAULT_PIN_TIMEOUT);
            await this.#refreshTimeout(session);
            this.#emit(PixaEvents.PIN.UNLOCKED, { account: this.#currentAccount });
            return true;
        } catch (e) {
            console.warn('[SM.unlockWithPin] Unseal failed:', e.message);
            return false;
        }
    }

    async addPin(pin, options = {}) {
        if (!this.#vault) throw new SessionError('Vault required', 'NO_VAULT');
        if (!this.#cachedKeys) throw new SessionError('No keys in memory', 'NO_KEYS');
        if (!this.#currentAccount || !this.#persistent) throw new SessionNotFoundError();
        const account = this.#currentAccount;
        const session = await this.#getSession(account);
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

        await this.#sessions.update(account, {
            encrypted_keys: encrypted, pin_timeout_ms: pinTimeout,
            pin: { salt, argon2_memory_kib: mem, argon2_iterations: iter, argon2_parallelism: par },
        });
        this.#pinProtected = true;
        this.#startPinTimer(pinTimeout);
        this.#emit(PixaEvents.Session.UPGRADED, { account, mode: 'pin' });
    }

    async removePin(currentPin) {
        if (!this.#currentAccount || !this.#persistent) throw new SessionNotFoundError();
        const session = await this.#getSession(this.#currentAccount);
        if (!session.pin) throw new SessionError('Not PIN-protected', 'NOT_PIN');

        // SECURITY: the PIN is proven on EVERY call. The old guard only
        // verified it when the keys happened to be sealed
        // (`if (!this.#cachedKeys) …`), so on an unlocked session anyone with
        // access to the tab could strip PIN protection without knowing it.
        if (!(await this.#verifyPin(session, currentPin))) return false;

        if (!this.#cachedKeys) { if (!(await this.unlockWithPin(currentPin))) return false; }

        const encrypted = await this.#deviceKeys.wrap(this.#cachedKeys);
        await this.#sessions.update(this.#currentAccount, { encrypted_keys: encrypted, pin: null, pin_timeout_ms: null });
        this.#stopPinTimer(); this.#sealedData = null; this.#pinProtected = false;
        this.#emit(PixaEvents.Session.DOWNGRADED, { account: this.#currentAccount, mode: 'persist' });
        return true;
    }

    async changePin(currentPin, newPin) {
        if (!this.#vault) throw new SessionError('Vault required', 'NO_VAULT');
        if (!this.#currentAccount) throw new SessionNotFoundError();
        const session = await this.#getSession(this.#currentAccount);
        if (!session.pin) throw new SessionError('Not PIN-protected', 'NOT_PIN');

        // SECURITY: same hole as removePin — an unlocked session could have its
        // PIN replaced with an attacker-chosen one without proving the old one.
        if (!(await this.#verifyPin(session, currentPin))) return false;

        if (!this.#cachedKeys) { if (!(await this.unlockWithPin(currentPin))) return false; }

        const p = session.pin;
        const newSalt = this.#vault.generateSalt();

        // The pin record is accepted directly as params (argon2_* keys), so the
        // new seal provably uses the same cost as the old one.
        const sealedJson = await this.#vault.sealKeysBytes(newPin, newSalt, this.#currentAccount, cloneKeyMap(this.#cachedKeys), p);
        const encrypted  = await this.#deviceKeys.wrap({ _pin_sealed: true, data: sealedJson });

        await this.#sessions.update(this.#currentAccount, { encrypted_keys: encrypted, pin: { ...p, salt: newSalt } });
        this.#startPinTimer(session.pin_timeout_ms ?? DEFAULT_PIN_TIMEOUT);
        this.#emit(PixaEvents.PIN.CHANGED, { account: this.#currentAccount });
        return true;
    }

    touchActivity() {
        if (!this.#pinTimer || !this.#cachedKeys) return;
        this.#safeGet(this.#sessions, this.#currentAccount).then(s => {
            if (s?.pin_timeout_ms) this.#startPinTimer(s.pin_timeout_ms);
        }).catch(() => {});
        this.#emit(PixaEvents.PIN.ACTIVITY, { account: this.#currentAccount });
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
        const s = await this.#safeGet(this.#sessions, target);
        if (!s) return false;
        const now = Date.now();
        return now < s.expires_at && (!s.absolute_expires_at || now < s.absolute_expires_at);
    }

    async updateSession(updates) {
        if (!this.#currentAccount) return false;
        const { encrypted_keys, pin, ...safe } = updates;
        try { await this.#sessions.update(this.#currentAccount, { ...safe, last_active: Date.now() }); return true; }
        catch { return false; }
    }

    async endSession() {
        const account = await this.#fullLogout();
        this.#emit(PixaEvents.Session.ENDED, { account });
        return account;
    }

    // ═════════════════════════════════════════════════
    // PRIVATE
    // ═════════════════════════════════════════════════

    /**
     * Authoritatively verify a PIN against the stored sealed record.
     *
     * v6.3: uses vault.verifyPinAgainstSealed() — the record's commitment tag
     * BLAKE3(key ‖ nonce) proves the PIN with no plaintext produced. (A stored
     * verify hash would be an offline oracle of exactly the same strength as
     * that tag, so its absence never protected anything; the point of this
     * path is that nothing gets decrypted.) Older vaults without that method
     * fall back to unsealing a throwaway copy and zeroing it immediately.
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

        let sealed = this.#sealedData;
        if (!sealed) {
            try {
                const payload = await this.#deviceKeys.unwrap(session.encrypted_keys);
                if (!payload._pin_sealed) return false;
                sealed = payload.data;
            } catch { return false; }
        }

        let probe = null;
        try {
            if (typeof this.#vault.verifyPinAgainstSealed === 'function') {
                return await this.#vault.verifyPinAgainstSealed(pin, p.salt, sealed, p);
            }
            probe = await this.#vault.unsealKeysBytes(pin, p.salt, sealed, p, this.#currentAccount);
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
        const session = await this.#safeGet(this.#sessions, this.#currentAccount);
        if (!session?.pin) return false;
        return this.#verifyPin(session, pin);
    }

    /**
     * Wall-clock enforcement of the PIN deadline and the session expiry.
     * Called from getKeys()/isLocked/hasKeysInMemory and from the page
     * visibility listeners. Lock and logout both clear in-memory state
     * synchronously; only the DB writes complete in the background.
     *
     * @returns {{expired: true, account: string}|{locked: true}|null}
     */
    #enforceDeadlines() {
        const now = Date.now();
        if (this.#currentAccount && this.#sessionDeadline > 0 && now >= this.#sessionDeadline) {
            const account = this.#currentAccount;
            this.#sessionDeadline = 0;
            this.#fullLogout()
                .then(() => this.#emit(PixaEvents.Session.EXPIRED, { account }))
                .catch(() => {});
            return { expired: true, account };
        }
        if (this.#cachedKeys && this.#pinDeadline > 0 && now >= this.#pinDeadline) {
            this.#stopPinTimer();
            this.#onPinTimeout().catch(() => {});   // wipes synchronously, re-caches the sealed blob in the background
            return { locked: true };
        }
        return null;
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
     * PIN timer, remove the page listeners, zero the in-memory keys. For
     * instance replacement (API-node switch) — the replacement instance
     * restores the session from the DB on its own. Idempotent.
     */
    dispose() {
        this.#stopPinTimer();
        const g = globalThis;
        if (this.#onVisibleBound) {
            g.document?.removeEventListener?.('visibilitychange', this.#onVisibleBound);
            g.removeEventListener?.('pageshow', this.#onVisibleBound);
            g.removeEventListener?.('focus', this.#onVisibleBound);
            this.#onVisibleBound = null;
        }
        this.#wipeCachedKeys();
        this.#sealedData = null;
    }

    /**
     * Clear in-memory session state WITHOUT touching persisted key material.
     *
     * Used for conditions that are not proof of compromise — fingerprint drift,
     * a transient device-key read failure. `active_account` is deliberately
     * left in place so a legitimate user recovers on the next launch once the
     * environment settles, instead of losing their keys permanently.
     *
     * @returns {string|null} the account that was cleared
     */
    async #softLogout() {
        const account = this.#currentAccount;
        this.#stopPinTimer(); this.#wipeCachedKeys();
        this.#sealedData = null; this.#currentAccount = null;
        this.#persistent = false; this.#pinProtected = false;
        this.#sessionDeadline = 0;
        return account;
    }

    async #getSession(a) { try { return await this.#sessions.get(a); } catch { throw new SessionNotFoundError(); } }
    async #safeGet(c, id) { try { return await c.get(id); } catch { return null; } }
    async #upsert(c, id, d) { if (c.upsert) { await c.upsert(id, d); return; } try { await c.add(d, { id }); } catch { await c.update(id, d); } }

    async #refreshTimeout(session) {
        const t = session.timeout_ms ?? DEFAULT_TIMEOUT;
        const expires_at = Date.now() + t;
        this.#sessionDeadline = session.absolute_expires_at
            ? Math.min(expires_at, session.absolute_expires_at)
            : expires_at;
        try { await this.#sessions.update(session.account, { last_active: Date.now(), expires_at }); } catch {}
    }

    #startPinTimer(ms) {
        this.#stopPinTimer();
        this.#pinDeadline = Date.now() + ms;          // wall-clock truth
        this.#pinTimer = setTimeout(() => this.#onPinTimeout(), ms); // eager path
    }
    #stopPinTimer() {
        if (this.#pinTimer !== null) { clearTimeout(this.#pinTimer); this.#pinTimer = null; }
        this.#pinDeadline = 0;
    }

    async #onPinTimeout() {
        if (this.#locking) return;                    // timer and lazy check can race
        this.#locking = true;
        this.#pinTimer = null; this.#pinDeadline = 0;
        this.#wipeCachedKeys();                       // synchronous — before the first await
        try {
            if (this.#currentAccount && this.#persistent) {
                try {
                    const s = await this.#sessions.get(this.#currentAccount);
                    if (s?.pin) {
                        // Keep the flag true regardless: if this unwrap throws, the
                        // sealed blob is simply not cached and unlockWithPin will
                        // re-read it from the DB. isLocked stays correct either way.
                        this.#pinProtected = true;
                        const p = await this.#deviceKeys.unwrap(s.encrypted_keys);
                        if (p._pin_sealed) this.#sealedData = p.data;
                    }
                } catch {}
            }
            this.#emit(PixaEvents.PIN.LOCKED, { account: this.#currentAccount });
        } finally {
            this.#locking = false;
        }
    }

    #wipeCachedKeys() {
        if (this.#cachedKeys) { zeroKeyMap(this.#cachedKeys); this.#cachedKeys = null; }
    }

    async #fullLogout() {
        const account = this.#currentAccount;
        this.#stopPinTimer(); this.#wipeCachedKeys();
        this.#sealedData = null; this.#currentAccount = null; this.#persistent = false;
        this.#pinProtected = false; this.#sessionDeadline = 0;
        if (account && this.#sessions) await this.#sessions.delete(account).catch(() => {});
        if (this.#preferences) await this.#preferences.delete('active_account').catch(() => {});
        return account;
    }

    #emit(event, data) { this.#emitter?.emit(event, data); }
}

export const SessionMode = Object.freeze({ PIN: 'pin', EPHEMERAL: 'ephemeral', PERSIST: 'persist' });
export default SessionManager;