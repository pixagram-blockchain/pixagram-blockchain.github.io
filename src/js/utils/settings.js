import { CURRENCY_COUNTRIES, DEFAULT_NODES, CUSTOM_API_NODE_ID } from "./constants";
import get_browser_locales from "./locales";
import { LacertaDB } from "@pixagram/lacerta-db";

// ── ONE LacertaDB instance, ONE database ─────────────────────────────────────
// Constructed HERE because this module lives in the main bundle and runs at
// script evaluation — before the pixaproxyapi chunk even downloads.
// PixaProxyAPI imports this instance instead of minting its own, so both the
// app-settings layer and the blockchain API share a single connection over a
// single database ('user_settings'). The turboSerial options are
// PixaProxyAPI's, moved here verbatim: SessionManager serializes key material
// through `lacerta.serializer` and depends on this exact byte-level config.
export const lacerta = new LacertaDB({turboSerial: {
        compression: false,
        preservePropertyDescriptors: false,
        deduplication: false,
        simdOptimization: false,
        detectCircular: false,
        shareArrayBuffers: false,
        allowFunction: false,
        serializeFunctions: false,
        memoryPoolSize: 65536
    }});
let settingsDB = null;
let isInitialized = false;

// Initialize database and collections
const initializeDatabase = async () => {
    if (isInitialized) return;

    try {
        // Same database PixaProxyAPI uses (sessions, preferences,
        // accounts_registry, …). The app-settings document lives in the
        // quickStore namespace, which nothing in pixaproxyapi touches — its
        // collections are all named — so the two sides can't collide.
        settingsDB = await lacerta.getDatabase('user_settings');
        isInitialized = true;
        console.log('LacertaDB initialized successfully');
    } catch (error) {
        console.error('Failed to initialize database:', error);
        throw error;
    }
};

// ── One-time migration from the legacy standalone 'settings' database ────────
// Existing browsers have their preferences in a separate LacertaDB database
// named 'settings'. On the first boot where user_settings has no
// main_settings document, we read the legacy doc (through LacertaDB — the
// stored format is its serializer's, not raw JSON), resolve with it, persist
// it to the new home in the background, and then delete the legacy database.
// The existence probe aborts a would-be creation (same trick as
// pixaproxyapi's warm-start probe), so fresh browsers never mint a zombie
// 'settings' DB just by probing for it.
let _legacyDB = null;

const _read_legacy_settings = async () => {
    try {
        const exists = await new Promise((resolve) => {
            try {
                const req = indexedDB.open("settings");
                req.onupgradeneeded = () => { req.transaction.abort(); resolve(false); };
                req.onsuccess = () => { req.result.close(); resolve(true); };
                req.onerror = () => resolve(false);
            } catch (_) { resolve(false); }
        });
        if (!exists) return null;
        _legacyDB = await lacerta.getDatabase("settings");
        let doc = null;
        try { doc = await _legacyDB.quickStore.get("main_settings"); } catch (_) {}
        return doc || null;
    } catch (_) {
        return null;
    }
};

const _drop_legacy_settings_db = () => {
    // Best effort. If the handle from the migration read keeps the database
    // pinned, deleteDatabase stays pending and completes once the connection
    // goes away (page close at the latest) — the new home is authoritative
    // either way, because the migration write finished before this ran.
    try { if (_legacyDB && typeof _legacyDB.close === "function") _legacyDB.close(); } catch (_) {}
    _legacyDB = null;
    try {
        const req = indexedDB.deleteDatabase("settings");
        req.onblocked = () => { /* live handle — completes when it closes */ };
    } catch (_) {}
};

// Helper functions
const _merge_object = (obj1, obj2) => {
    return Object.assign({}, obj1, obj2);
};

// ── API node: the settings store the endpoint URL, and who chose it ──────────
// A node is identified by its URL and nothing else: the URL is unique by
// construction, so the old `api_node` id was a second name for the same thing.
// That second name needed its own "custom" sentinel (CUSTOM_API_NODE_ID) plus
// a second key holding the custom URL, and it went stale every time an entry
// in DEFAULT_NODES was renamed or removed. The document now carries
// `api_node_url` plus `api_node_source` (see API_NODE_SOURCE below). Anything
// still shaped the old way — a stored document, a boot hint, a patch from an
// old caller — goes through resolve_api_node_url, which maps id → URL through
// DEFAULT_NODES exactly once; the next persist drops the legacy keys.
//
// The default is api.pixagram.com. On a browser where nobody has chosen an
// endpoint yet, the boot race (_auto_select_node) picks the fastest node once
// and SAVES it as an automatic choice; from then on the saved endpoint — the
// race's or the user's — is authoritative, and a pick made in the Settings
// dialog can never be written over by anything automatic.
const DEFAULT_API_NODE_HOST = "api.pixagram.com";
const BOOT_HINT_KEY = "pixa_api_node_url_hint";

// Who chose the stored endpoint. This is what lets the automatic selection
// and the Settings dialog coexist without fighting:
//   "default" — nobody yet (fresh install, or a document that never carried
//               a node). The ONLY state the boot race is allowed to fill.
//   "auto"    — the boot race picked it. Settled: it is not raced again, and
//               it is what the dialog shows as selected.
//   "user"    — picked in the Settings dialog. Terminal: nothing automatic
//               ever writes over it.
export const API_NODE_SOURCE = Object.freeze({ DEFAULT: "default", AUTO: "auto", USER: "user" });

const _valid_source = (value) =>
    value === API_NODE_SOURCE.AUTO || value === API_NODE_SOURCE.USER ? value : API_NODE_SOURCE.DEFAULT;

/**
 * Canonical form of an endpoint URL, or null when it isn't one we can dial:
 * scheme + host (lower-cased by the URL parser) + path without trailing
 * slashes + query; fragment dropped. Two spellings of the same endpoint
 * ("https://Api.Pixagram.com/" vs "https://api.pixagram.com") normalize to
 * the same string, which is what makes URL-keyed selection reliable.
 */
export const normalize_node_url = (value) => {
    if (typeof value !== "string") return null;
    const raw = value.trim();
    if (!raw) return null;
    try {
        const u = new URL(raw);
        if (u.protocol !== "https:" && u.protocol !== "http:" && u.protocol !== "wss:" && u.protocol !== "ws:") return null;
        if (!u.host) return null;
        const path = u.pathname.replace(/\/+$/, "");
        return `${u.protocol}//${u.host}${path}${u.search || ""}`;
    } catch (_) {
        return null;
    }
};

/** True when both strings name the same endpoint (after normalization). */
export const same_node_url = (a, b) => {
    const na = normalize_node_url(a);
    return !!na && na === normalize_node_url(b);
};

/**
 * The default endpoint. Taken from the DEFAULT_NODES entry whose host is
 * api.pixagram.com so the stored URL is byte-identical to the picker's entry
 * (same scheme, same path); falls back to https://api.pixagram.com when the
 * node table doesn't list it.
 */
export const DEFAULT_API_NODE_URL = (() => {
    const fallback = `https://${DEFAULT_API_NODE_HOST}`;
    const listed = (DEFAULT_NODES || []).find((node) => {
        try { return new URL(node.url).hostname === DEFAULT_API_NODE_HOST; } catch (_) { return false; }
    });
    return normalize_node_url(listed ? listed.url : fallback) || fallback;
})();

/**
 * Endpoint URL for a settings-shaped object of ANY vintage:
 *   1. `api_node_url`                          — current shape, wins when valid
 *   2. `api_node` + `api_node_custom_url`      — legacy id shape, mapped once
 *   3. DEFAULT_API_NODE_URL                    — nothing usable
 */
export const resolve_api_node_url = (bag) => {
    if (!bag) return DEFAULT_API_NODE_URL;
    const direct = normalize_node_url(bag.api_node_url);
    if (direct) return direct;
    const legacyId = bag.api_node;
    if (legacyId) {
        if (legacyId === CUSTOM_API_NODE_ID) {
            const custom = normalize_node_url(bag.api_node_custom_url);
            if (custom) return custom;
        } else {
            const node = (DEFAULT_NODES || []).find((n) => n.id === legacyId);
            const url = node ? normalize_node_url(node.url) : null;
            if (url) return url;
        }
    }
    return DEFAULT_API_NODE_URL;
};

const _carries_legacy_node_keys = (bag) =>
    !!bag && (bag.api_node !== undefined || bag.api_node_custom_url !== undefined
        || bag.api_node_url === undefined || bag.api_node_source === undefined);

// A stored/resolved bag in the current shape: `api_node_url` present and
// normalized, `api_node_source` valid, legacy keys gone. Applied to the
// STORED document before it is merged over the defaults — merging first
// would let the defaults' URL win over a legacy id the user actually picked.
// A legacy document that names a node (id or custom URL) is treated as a
// user choice: we can't tell whether the old contest or the user set it, and
// "never override what's there" is the safe side of that ambiguity.
const _normalize_bag = (bag) => {
    if (!bag) return bag;
    const out = Object.assign({}, bag);
    out.api_node_url = resolve_api_node_url(bag);
    if (bag.api_node_source !== undefined) {
        out.api_node_source = _valid_source(bag.api_node_source);
    } else if (bag.api_node_url !== undefined || bag.api_node !== undefined) {
        out.api_node_source = API_NODE_SOURCE.USER;
    } else {
        out.api_node_source = API_NODE_SOURCE.DEFAULT;
    }
    delete out.api_node;
    delete out.api_node_custom_url;
    return out;
};

// A set_settings patch in the current shape. A patch that names the node in
// the legacy way (an old caller sending `api_node`) resolves like a legacy
// document; an invalid `api_node_url` keeps the base bag's endpoint rather
// than persisting garbage. A node patch that doesn't say who chose it is a
// user choice — set_settings is the dialog's write path, and marking it
// "user" here is exactly what makes that choice final for the boot race.
const _normalize_patch = (info, base) => {
    const patch = Object.assign({}, info);
    const touchesNode = patch.api_node_url !== undefined
        || patch.api_node !== undefined
        || patch.api_node_custom_url !== undefined;
    if (touchesNode) {
        const url = patch.api_node_url !== undefined
            ? normalize_node_url(patch.api_node_url)
            : resolve_api_node_url({ api_node: patch.api_node, api_node_custom_url: patch.api_node_custom_url });
        patch.api_node_url = url || resolve_api_node_url(base);
        patch.api_node_source = patch.api_node_source !== undefined
            ? _valid_source(patch.api_node_source)
            : API_NODE_SOURCE.USER;
        delete patch.api_node;
        delete patch.api_node_custom_url;
    } else if (patch.api_node_source !== undefined) {
        patch.api_node_source = _valid_source(patch.api_node_source);
    }
    return patch;
};

// Boot hint for pages/Index.js: the app renders before this module's async
// load lands, and usePixaAPI opens its first connection right away. A
// synchronous localStorage read of the last known endpoint lets that first
// connection aim at the saved node instead of connecting to the default and
// reconnecting a second later. Written on every emit so it can never lag the
// document. (Older client.js builds wrote an id-shaped pair of hints; Index
// still understands those as a fallback, but this key is the one it reads
// first.)
const _write_boot_hint = (settings) => {
    try {
        if (settings && settings.api_node_url) localStorage.setItem(BOOT_HINT_KEY, settings.api_node_url);
    } catch (_) { /* private mode / storage disabled */ }
};

const _get_default_settings = () => {

    const locales = get_browser_locales()[0].split("-").length === 2 ? get_browser_locales()[0] : "en-US";

    return {
        locales: locales,
        currency: _get_currency_by_locales(locales),
        sfx_enabled: true,
        closed_menu_ads: false,
        voice_enabled: true,
        nsfw_enabled: false,
        nsfw_filter: true,
        toxicity_enabled: true,
        format: "webp",
        payout: "share",
        voting: 100,
        renderer: "xbrz",
        mode: "CPU",
        pdf_page_size: "A4",
        askvote: false,
        activation_enabled: true,
        api_node_url: DEFAULT_API_NODE_URL,
        api_node_source: API_NODE_SOURCE.DEFAULT,
        attachment_previews: {},
        _id: "main_settings", // Fixed ID for settings document
        lastModified: Date.now()
    };
};

// ── Latency probe: best of 3 sequential samples ─────────────────────────────
// One implementation for both readers of a node's latency — the boot race
// below and the Settings dialog's Globe. The first request to a host pays
// DNS + TCP + TLS, so a single sample overstates every node; three samples
// on the now-warm connection and the minimum is the number that reflects
// the node. Samples run one after another (parallel samples share the
// connection and queue behind each other); the series stops at the first
// failure — a host that didn't answer once won't answer faster twice.
export const NODE_LATENCY_ATTEMPTS = 3;
export const NODE_LATENCY_TIMEOUT_MS = 3000;

const _ping_once = (url, timeout) => new Promise((resolve) => {
    if (typeof fetch === "undefined") { resolve(-1); return; }
    const now = () => (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    const start = now();
    const controller = (typeof AbortController !== "undefined") ? new AbortController() : null;
    const timer = setTimeout(() => { if (controller) controller.abort(); resolve(-1); }, timeout);
    fetch(url, { method: "HEAD", mode: "no-cors", cache: "no-store", signal: controller ? controller.signal : undefined })
        .then(() => { clearTimeout(timer); resolve(Math.round(now() - start)); })
        .catch(() => { clearTimeout(timer); resolve(-1); });
});

/** Best-of-`attempts` round trip to `url` in ms, or -1 when unreachable. */
export const measure_node_latency = async (url, attempts = NODE_LATENCY_ATTEMPTS, timeout = NODE_LATENCY_TIMEOUT_MS) => {
    let best = -1;
    for (let i = 0; i < attempts; i++) {
        const ms = await _ping_once(url, timeout);
        if (ms < 0) break;
        if (best < 0 || ms < best) best = ms;
    }
    return best;
};

// ── Automatic node selection (boot race) ────────────────────────────────────
// Runs after init() has resolved, only while the stored endpoint is still
// nobody's choice (api_node_source === "default"): every DEFAULT_NODES entry
// is timed and the fastest reachable one wins, mainnet always beating
// testnet regardless of latency (a new visitor must not land on the testnet
// because it answered first). The winner is PERSISTED with source "auto",
// so it is what the Settings dialog shows as selected and it is not raced
// again on later boots — the app then connects straight to it through the
// boot hint. A pick made in the dialog is terminal for this: the winner is
// only written if, on a fresh read taken right before the write, the stored
// document still carries the endpoint the race started from and its source
// is still "default". That read — not the in-memory cache, and never a
// merge over the defaults — is what closes the old failure: a mis-detected
// first run (a store that answered null once) used to let the contest's
// update() overwrite the document, node and every other setting with it.
const _select_fastest_node_url = async () => {
    if (!DEFAULT_NODES || DEFAULT_NODES.length === 0) return null;
    try {
        const results = await Promise.all(
            DEFAULT_NODES.map(async (node) => ({
                url: normalize_node_url(node.url),
                network: node.network,
                elapsed: await measure_node_latency(node.url),
            }))
        );
        const reachable = results.filter((r) => r.url && r.elapsed >= 0);
        if (reachable.length === 0) return null;
        const mainnet = reachable.filter((r) => r.network !== "testnet");
        const pool = mainnet.length > 0 ? mainnet : reachable;
        pool.sort((a, b) => a.elapsed - b.elapsed);
        return pool[0].url;
    } catch (_) {
        return null;
    }
};

const _auto_select_node = async (startingUrl) => {
    try {
        const winner = await _select_fastest_node_url();
        if (!winner) return; // nothing reachable — stays "default", retried next boot

        // Fresh read: the dialog (this tab or another) may have written since.
        let stored = null;
        try { stored = await settingsDB.quickStore.get("main_settings"); } catch (_) { stored = null; }
        if (!stored) return; // no document to settle — next boot's first-run path recreates one
        const current = _normalize_bag(stored);
        if (current.api_node_source !== API_NODE_SOURCE.DEFAULT) return; // someone chose meanwhile
        if (!same_node_url(current.api_node_url, startingUrl)) return;   // node moved meanwhile

        const updated = _merge_object(current, {
            api_node_url: winner,
            api_node_source: API_NODE_SOURCE.AUTO,
            lastModified: Date.now()
        });
        await settingsDB.quickStore.update("main_settings", updated);
        _emit(_merge_object(_get_default_settings(), updated));
    } catch (e) {
        console.warn('[settings] Automatic node selection failed (will retry next boot):', e && e.message ? e.message : e);
    }
};

export const _get_currency_by_locales = (locales) => {
    const country = locales.split("-").length === 2 ? locales.split("-")[1] : "US";
    let currency = "USD";

    Object.entries(CURRENCY_COUNTRIES).forEach(entry => {
        const [key, value] = entry;
        if(value.includes(country.toLocaleUpperCase())) {
            currency = key.toUpperCase();
        }
    });

    return currency;
};

// ── Synchronous cache + change notification ─────────────────────────────────
// LacertaDB is async, but a lot of UI (the wallet, the price hook, card actions)
// needs the *current* settings synchronously at render time and needs to react
// the instant a setting changes — e.g. the user picks a new display currency.
// We keep the last-known settings bag in module memory and let consumers
// subscribe to changes. Self-contained: no dependency on any external event bus.
let _cache = null;
const _subscribers = new Set();

// Update the cache and notify every subscriber. Called whenever we resolve a
// fresh settings object (init / get / set). Subscriber errors are swallowed so
// one bad listener can't break the others or the write that triggered them.
const _emit = (settings) => {
    if (!settings) return settings;
    _cache = settings;
    _write_boot_hint(settings);
    for (const fn of _subscribers) {
        try { fn(settings); } catch (e) { /* listener error — ignore */ }
    }
    return settings;
};

/**
 * Last-known settings, synchronously. Returns freshly-computed defaults (without
 * caching them) until the first async load lands, so callers always get a usable
 * object — in particular a valid `currency`/`locales` — on the very first paint.
 */
export const get_cached_settings = () => _cache || _get_default_settings();

/** Convenience: the current display currency, synchronously. */
export const get_cached_currency = () => (get_cached_settings().currency || "USD");

/** Convenience: the active API endpoint URL, synchronously. */
export const get_cached_api_node_url = () => resolve_api_node_url(get_cached_settings());

/**
 * Subscribe to settings changes. The callback fires on every init/get/set with
 * the full settings bag. Returns an unsubscribe function. If the cache is
 * already warm, the callback is invoked once immediately with current values so
 * subscribers don't have to special-case the initial state.
 */
export const subscribe = (fn) => {
    if (typeof fn !== "function") return () => {};
    _subscribers.add(fn);
    if (_cache) {
        try { fn(_cache); } catch (e) { /* ignore */ }
    }
    return () => { _subscribers.delete(fn); };
};

// Main API functions

// Async initialization function
export const init = async (resolve) => {
    try {
        await initializeDatabase();

        // Try to get existing settings from the shared database
        let storedSettings = null;
        try {
            storedSettings = await settingsDB.quickStore.get("main_settings");
        } catch (error) {
            storedSettings = null;
        }

        // Not there? Check the legacy standalone 'settings' database once.
        let migrated = false;
        if (!storedSettings) {
            storedSettings = await _read_legacy_settings();
            migrated = !!storedSettings;
        }

        // Value-based first-run detection: a missing document must count as a
        // first run whether quickStore.get() REJECTS or resolves
        // null/undefined.
        const isFirstRun = !storedSettings;
        const needsNodeRewrite = !isFirstRun && !migrated && _carries_legacy_node_keys(storedSettings);
        const settings = storedSettings
            ? _merge_object(_get_default_settings(), _normalize_bag(storedSettings))
            : _get_default_settings();

        // Resolve FIRST — the boot race never blocks first paint. Whatever is
        // stored (or the api.pixagram.com default on a first run) is what the
        // API connects to now; if that endpoint is still nobody's choice, the
        // race below may settle it a moment later, once, and persist it.
        _emit(settings);
        resolve(settings);

        // Migrated from the legacy database: persist to the new home in the
        // background (the resolved bag already carries the values), and only
        // delete the legacy DB once the write has landed — if the write
        // fails or the user closes first, the legacy doc survives and the
        // next boot simply migrates again. Idempotent by construction.
        if (migrated) {
            (async () => {
                try {
                    await settingsDB.quickStore.add("main_settings", settings);
                    _drop_legacy_settings_db();
                } catch (e) {
                    console.warn('[settings] Legacy migration persist failed (will retry next boot):', e && e.message ? e.message : e);
                }
            })();
        }

        // First-ever load for this browser: persist the defaults so a
        // document exists for the race (and the dialog) to update. add()
        // only — if another tab, or a store that answered late, already
        // wrote one, that document stands untouched.
        if (isFirstRun) {
            (async () => {
                try {
                    await settingsDB.quickStore.add("main_settings", settings);
                } catch (e) {
                    /* document already exists — theirs wins */
                }
            })();
        }

        // Stored document still in the id shape: write it back once in the
        // URL shape so this resolution never runs again for this browser.
        // The resolved bag is what we already handed out, so values can't
        // diverge; lastModified is left alone (nothing the user did).
        if (needsNodeRewrite) {
            (async () => {
                try {
                    await settingsDB.quickStore.update("main_settings", settings);
                } catch (e) {
                    console.warn('[settings] Node-key migration persist failed (will retry next boot):', e && e.message ? e.message : e);
                }
            })();
        }

        // Nobody has chosen an endpoint yet (fresh install, or a document
        // whose earlier race never got to persist): race the node table in
        // the background and settle it. Anything already chosen — by a user
        // in the dialog, or by an earlier race — is left exactly as it is.
        if (settings.api_node_source === API_NODE_SOURCE.DEFAULT) {
            const startingUrl = settings.api_node_url;
            // Fire-and-forget. Its compare-and-set read happens after the
            // pings resolve, long after the first-run add() above has landed.
            _auto_select_node(startingUrl);
        }
    } catch (error) {
        console.error('Initialization error:', error);
        // Fallback to defaults on error — emitted too, so subscribe()-based
        // consumers (client.js Root) still receive a bag on this path.
        resolve(_emit(_get_default_settings()));
    }
};
// Get settings (now async)
export const get_settings = async (callback_function_info) => {
    try {
        await initializeDatabase();

        let settings;
        try {
            const storedSettings = await settingsDB.quickStore.get("main_settings");
            settings = storedSettings
                ? _merge_object(_get_default_settings(), _normalize_bag(storedSettings))
                : _get_default_settings();
        } catch (error) {
            settings = _get_default_settings();
        }

        _emit(settings);
        callback_function_info(settings);
    } catch (error) {
        console.error('Error getting settings:', error);
        callback_function_info(_get_default_settings());
    }
};

// Set settings (now async with better error handling)
export const set_settings = async (info = {}, callback_function_info = () => {}) => {
    try {
        await initializeDatabase();

        // Get current settings
        let currentSettings;
        try {
            currentSettings = await settingsDB.quickStore.get("main_settings");
        } catch (error) {
            currentSettings = null;
        }

        // Merge with new settings. The base is brought to the current shape
        // first, so a document that still carries the legacy node keys loses
        // them on this write; the patch is normalized so `api_node_url` is
        // always stored canonical.
        const baseSettings = currentSettings ? _normalize_bag(currentSettings) : _get_default_settings();
        const newSettings = _merge_object(baseSettings, {
            ..._normalize_patch(info, baseSettings),
            lastModified: Date.now()
        });

        // Save or update settings
        if (currentSettings) {
            await settingsDB.quickStore.update("main_settings", newSettings);
        } else {
            await settingsDB.quickStore.add("main_settings", newSettings);
        }

        _emit(newSettings);
        callback_function_info(newSettings);
    } catch (error) {
        console.error('Error setting settings:', error);
        callback_function_info();
    }
};
