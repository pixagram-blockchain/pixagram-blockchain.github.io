"use strict";

var either_ends_with = function (possibilities, onto) {
    for (var i = 0; i < possibilities.length; i++) {
        if (onto.endsWith(possibilities[i])) return true;
    }
    return false;
};

var either_starts_with = function (possibilities, onto) {
    for (var i = 0; i < possibilities.length; i++) {
        if (onto.startsWith(possibilities[i])) return true;
    }
    return false;
};

// Helper functions
var F_IMG = function (n) { return "/src/images/" + n; };
var F_CNK = function (n, i) { return "/client/chunk_" + (typeof n == "undefined" ? (i | 0) : (n | 0)) + ".min.js"; };
var F_SND = function (n) { return "/src/sounds/" + n + ".mp3"; };
var F_VID = function (n) { return "/src/videos/" + n + ".mp4"; };

// NSFW model (nsfwjs MobileNetV2, ~4 MB layers model) + tfjs-wasm binaries.
// These rarely change and are worth pre-caching so the off-thread NSFW
// classifier loads instantly (and offline) after the first install.
var NSFW_MODEL_DIR = "/src/models/nsfw/mobilenet_v2/";
var TFJS_WASM_DIR = "/src/wasm/tfjs/";
var INSTALL_FILES_NSFW = [
    NSFW_MODEL_DIR + "model.json",
    NSFW_MODEL_DIR + "group1-shard1of1.bin",
    // tfjs-backend-wasm ships a few variants; the loader picks the supported
    // one at runtime. Caching all three keeps it offline-capable everywhere.
    TFJS_WASM_DIR + "tfjs-backend-wasm.wasm",
    TFJS_WASM_DIR + "tfjs-backend-wasm-simd.wasm",
    TFJS_WASM_DIR + "tfjs-backend-wasm-threaded-simd.wasm"
];

var INSTALL_FILES_USEFUL = [
    "/src/images/favicon.ico",
    "/src/images/manifest/logo-white.png",
    "/src/fonts/industry/index.css",
    "/src/fonts/redhat/index.css",
    "/src/fonts/normative/index.css"
];
var LOAD_FILES_REQUIRED = [];
var LOAD_FILES_USEFUL = [];
var LOAD_FILES_STATIC = [];

// Cache names
var REQUIRED_CACHE = "unless-update-cache-v186-required";
var USEFUL_CACHE = "unless-update-cache-v186-useful";
var STATIC_CACHE = "unless-update-cache-v186-static";
var OTHER_CACHE = "unless-update-cache-v186-other";
var ALL_CACHES = [REQUIRED_CACHE, STATIC_CACHE, USEFUL_CACHE, OTHER_CACHE];

// Regular expressions for chunk matching
var MAIN_CHILD_CHUNK_REGEX = /chunk_(main_[a-zA-Z0-9_-]+)\.min\.js$/i;
var CHILD_CHUNK_REGEX = /chunk_([a-zA-Z0-9_-]+)\.min\.js$/i;

// Lazy-opened cache handles (promises)
var required_cache = caches.open(REQUIRED_CACHE);
var useful_cache = caches.open(USEFUL_CACHE);
var static_cache = caches.open(STATIC_CACHE);
var other_cache = caches.open(OTHER_CACHE);

// ─── Serve from cache, falling back to network ───
function serve_cache(cachePromise, url) {
    return cachePromise.then(function (cache) {
        return cache.match(url).then(function (response) {
            if (response && response.status === 200) {
                return response;
            }
            // Special case: root may have been stored with 404 during first install
            if (url === "/" && response) {
                return response.clone().text().then(function (body) {
                    return new Response(body, {
                        status: 200,
                        statusText: "OK",
                        headers: response.headers
                    });
                });
            }
            return fetchAndCache(url, cache);
        });
    }).catch(function () {
        return fetch(url);
    });
}

// ─── Fetch from network and store in given cache ───
function fetchAndCache(url, cache) {
    return fetch(url).then(function (response) {
        if (response.status === 200 || url === "/") {
            try { cache.put(url, response.clone()); } catch (e) { /* quota */ }
        }
        return response;
    });
}

// ─── Guarded fetch for binary model assets (.wasm/.bin/model.json) ───
// A misconfigured SPA dev server / CDN often answers an unknown path with a
// 200 + index.html. If we cached that under a .wasm URL, WebAssembly.compile
// would choke on "<!DO…" (magic-word error) on every load until the cache is
// versioned out. So: verify the body really is the asset before caching, and
// never serve/cache an HTML page in place of a binary.
function looksLikeHTML(response) {
    var ct = (response.headers.get("content-type") || "").toLowerCase();
    return ct.indexOf("text/html") !== -1;
}
function serveBinaryAsset(cachePromise, url) {
    return cachePromise.then(function (cache) {
        return cache.match(url).then(function (cached) {
            // Trust a cached entry only if it isn't an HTML page.
            if (cached && cached.status === 200 && !looksLikeHTML(cached)) {
                return cached;
            }
            return fetch(url).then(function (response) {
                if (response && response.status === 200 && !looksLikeHTML(response)) {
                    try { cache.put(url, response.clone()); } catch (e) {}
                    return response;
                }
                // Got HTML or an error for a binary asset → do NOT cache it.
                // Surface a clear failure so the model loader's fallback runs
                // (WASM → WebGL → CPU) instead of poisoning the cache.
                if (cached && cached.status === 200 && !looksLikeHTML(cached)) return cached;
                return response; // let the caller see the real (bad) response
            });
        });
    }).catch(function () {
        return fetch(url);
    });
}

// ─── SPA fallback: serve "/" for any HTML navigation request ───
function serveSPAFallback() {
    return required_cache.then(function (cache) {
        return cache.match("/").then(function (response) {
            if (response) return response;
            return fetchAndCache("/", cache);
        });
    }).catch(function () {
        return fetch("/");
    });
}

// ═══════════════════════════════════════════════════
// Install
// ═══════════════════════════════════════════════════
self.addEventListener("install", function (event) {
    event.waitUntil(
        Promise.allSettled([
            useful_cache.then(function (cache) {
                return cache.addAll(INSTALL_FILES_USEFUL);
            }),
            // NSFW assets: cache each individually so a missing wasm variant
            // (only one is actually needed at runtime) never fails install.
            useful_cache.then(function (cache) {
                return Promise.allSettled(
                    INSTALL_FILES_NSFW.map(function (u) {
                        return cache.add(u);
                    })
                );
            })
        ])
    );
});

// ═══════════════════════════════════════════════════
// Fetch
// ═══════════════════════════════════════════════════
self.addEventListener("fetch", function (event) {
    var request = event.request;
    var url = request.url;

    // ── Skip non-GET (POST, etc.) ──
    if (request.method !== "GET") return;

    // ── Range requests (video seeking etc.) – always network ──
    if (request.headers.get("range") && url.indexOf("http") === 0) {
        event.respondWith(fetch(request));
        return;
    }

    // ── Data / blob URIs – pass through ──
    if (either_starts_with(["data:image", "blob:http", "data:application"], url)) {
        return; // browser handles these natively
    }

    // ── Bulk pre-cache trigger ──
    if (either_starts_with(["data:,all"], url)) {
        event.respondWith(
            Promise.all([
                useful_cache.then(function (c) { return c.addAll(LOAD_FILES_USEFUL); }),
                required_cache.then(function (c) { return c.addAll(LOAD_FILES_REQUIRED); }),
                static_cache.then(function (c) { return c.addAll(LOAD_FILES_STATIC); })
            ])
                .then(function () { return new Response("all", { status: 200 }); })
                .catch(function () { return new Response("all", { status: 500 }); })
        );
        return;
    }

    // ── Same-site detection ──
    var referrer = request.referrer || "";
    var same_site = referrer && new URL(url).origin === new URL(referrer).origin;

    // ── NSFW model + tfjs wasm (same-origin) → useful cache ──
    // Handled before the same_site block because these are fetched from the
    // classification Web Worker, whose requests often carry no referrer, so
    // `same_site` would be false and the assets would skip the cache.
    var sameOrigin = new URL(url).origin === self.location.origin;
    if (sameOrigin && (url.indexOf("/src/models/nsfw/") !== -1 || url.indexOf("/src/wasm/tfjs/") !== -1)) {
        event.respondWith(serveBinaryAsset(useful_cache, url));
        return;
    }

    if (same_site) {
        // Static assets → useful cache
        if (either_ends_with([".wasm", ".png", ".json", ".svg", ".jpg", ".jpeg", ".gif", ".ico", ".onnx", ".woff2", ".ttf", ".css", ".bin"], url)) {
            event.respondWith(serve_cache(useful_cache, url));
            return;
        }

        // Media → static cache
        if (either_ends_with([".wav", ".mp3", ".mp4"], url)) {
            event.respondWith(serve_cache(static_cache, url));
            return;
        }

        // Named chunks → required cache
        if (url.endsWith("chunk_norris.min.js")) {
            event.respondWith(serve_cache(required_cache, "/client/chunk_norris.min.js"));
            return;
        }

        var mainMatch = url.match(MAIN_CHILD_CHUNK_REGEX);
        if (mainMatch) {
            event.respondWith(serve_cache(required_cache, "/client/chunk_" + mainMatch[1] + ".min.js"));
            return;
        }

        var childMatch = url.match(CHILD_CHUNK_REGEX);
        if (childMatch) {
            event.respondWith(serve_cache(required_cache, "/client/chunk_" + childMatch[1] + ".min.js"));
            return;
        }
    }

    // ══════════════════════════════════════════════
    // FIX: SPA fallback – serve "/" for ALL navigation requests
    // This is the key fix: /created/hype, /@user, /trending/art
    // all get the same index.html, and client-side routing takes over.
    // ══════════════════════════════════════════════
    if (request.mode === "navigate") {
        event.respondWith(serveSPAFallback());
        return;
    }

    // ── Extension / external – let the browser handle it ──
    if (url.startsWith("https://") && url.indexOf(self.location.hostname) === -1) {
        return;
    }

    // ── Any remaining GET: race all caches then network ──
    event.respondWith(
        caches.match(url).then(function (cached) {
            return cached || fetch(request);
        })
    );
});

// ═══════════════════════════════════════════════════
// Activate – purge old versioned caches
// ═══════════════════════════════════════════════════
self.addEventListener("activate", function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys.filter(function (key) {
                    return ALL_CACHES.indexOf(key) === -1;
                }).map(function (key) {
                    return caches.delete(key);
                })
            );
        })
    );
});