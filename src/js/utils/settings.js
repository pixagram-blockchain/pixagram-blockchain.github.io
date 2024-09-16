import { CURRENCY_COUNTRIES, DEFAULT_NODES } from "./constants";
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
        api_node: "eu-central",
        api_node_custom_url: "",
        attachment_previews: {},
        _id: "main_settings", // Fixed ID for settings document
        lastModified: Date.now()
    };
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

// ── First-run API node selection ─────────────────────────────────────────────
// Brand-new visitors have no stored preference, so rather than always defaulting
// to the first entry in DEFAULT_NODES we time a lightweight request to each one
// and keep the fastest responder — with mainnet nodes always preferred over
// testnet ones (see _select_fastest_node below), so a new visitor never lands
// on the testnet just because it happened to answer first. This runs once,
// inside init() below, and only when there's no settings document yet — an
// existing user's saved api_node (or custom URL) is never second-guessed on
// subsequent loads.
const _ping_node = (url, timeout = 4000) => {
    return new Promise((resolve) => {
        if (typeof fetch === "undefined") { resolve(-1); return; }
        const now = () => (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
        const start = now();
        const controller = (typeof AbortController !== "undefined") ? new AbortController() : null;
        const timer = setTimeout(() => { if (controller) controller.abort(); resolve(-1); }, timeout);
        fetch(url, { method: "HEAD", mode: "no-cors", cache: "no-store", signal: controller ? controller.signal : undefined })
            .then(() => { clearTimeout(timer); resolve(Math.round(now() - start)); })
            .catch(() => { clearTimeout(timer); resolve(-1); });
    });
};

const _select_fastest_node = async () => {
    const fallback = (DEFAULT_NODES[0] && DEFAULT_NODES[0].id) || "eu-central";
    if (!DEFAULT_NODES || DEFAULT_NODES.length === 0) return fallback;

    try {
        const results = await Promise.all(
            DEFAULT_NODES.map(async (node) => ({
                id: node.id,
                network: node.network,
                elapsed: await _ping_node(node.url),
            }))
        );
        const reachable = results.filter((r) => r.elapsed >= 0);
        if (reachable.length === 0) return fallback;

        // Mainnet beats testnet outright, regardless of latency. Only fall
        // back to the testnet pool if no mainnet node answered at all —
        // better to land a new visitor on a slow mainnet node than a fast
        // testnet one, but still better than no connection whatsoever.
        const mainnetReachable = reachable.filter((r) => r.network !== "testnet");
        const pool = mainnetReachable.length > 0 ? mainnetReachable : reachable;

        pool.sort((a, b) => a.elapsed - b.elapsed);
        return pool[0].id;
    } catch (error) {
        return fallback;
    }
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
        // null/undefined. (The pre-unification code only set the flag in the
        // catch branch, so a resolve-with-null store silently skipped the
        // node contest AND never persisted the settings document at all.)
        const isFirstRun = !storedSettings;
        const settings = storedSettings
            ? _merge_object(_get_default_settings(), storedSettings)
            : _get_default_settings();

        // Resolve FIRST — the node contest no longer blocks boot. It used to
        // have to land before resolve() because usePixaAPI read api_node once
        // off the resolved object; the API layer now reacts to api_node
        // changes live (apiNodeUrl → [nodeUrl] re-init in Index.js) and
        // client.js consumes this module's subscribe() stream, so a winner
        // that arrives late simply swaps the connection. Worst case before:
        // a brand-new visitor's first paint of every settings-gated feature
        // waited up to the full ping timeout on the contest.
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

        // First-ever load for this browser: persist the defaults right away,
        // race the contest in the background, and apply the winner only if
        // (a) it differs from what we resolved with and (b) nobody changed
        // api_node in the meantime (e.g. the user opened Settings and picked
        // a node while the pings were still out — their choice wins).
        if (isFirstRun) {
            (async () => {
                const contestPromise = _select_fastest_node(); // network — starts now
                try {
                    await settingsDB.quickStore.add("main_settings", settings);
                } catch (e) {
                    // Another tab may have written first — the update below
                    // still lands on the existing document.
                }
                try {
                    const nodeId = await contestPromise;
                    const current = _cache || settings;
                    if (nodeId && nodeId !== current.api_node && current.api_node === settings.api_node) {
                        const updated = _merge_object(current, {
                            api_node: nodeId,
                            lastModified: Date.now()
                        });
                        await settingsDB.quickStore.update("main_settings", updated);
                        _emit(updated);
                    }
                } catch (e) {
                    console.warn('[settings] Background node selection failed:', e && e.message ? e.message : e);
                }
            })();
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
            settings = storedSettings ? _merge_object(_get_default_settings(), storedSettings) : _get_default_settings();
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

        // Merge with new settings
        const baseSettings = currentSettings || _get_default_settings();
        const newSettings = _merge_object(baseSettings, {
            ...info,
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