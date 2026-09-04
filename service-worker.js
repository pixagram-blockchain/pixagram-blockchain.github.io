"use strict";

var either_ends_with = function (possibilities, onto) {
    for (var i = 0; i < possibilities.length; i++) {
        if (onto.endsWith(possibilities[i])) return true;
    }
    return false;
};

// Helper functions
var F_IMG = function (n) { return "/src/images/" + n; };
var F_CNK = function (n, i) { return "/client/chunk_" + (typeof n == "undefined" ? (i | 0) : (n | 0)) + ".min.js"; };
var F_SND = function (n) { return "/src/sounds/" + n + ".mp3"; };
var F_VID = function (n) { return "/src/videos/" + n + ".mp4"; };

var ENTRY_BUNDLE = "/client/chunk_norris.min.js";

var INSTALL_FILES_USEFUL = [
    "/src/images/favicon.ico",
    "/src/images/manifest/logo-white.png",
    "/src/fonts/industry/index.css",
    "/src/fonts/redhat/index.css",
    "/src/fonts/normative/index.css"
];
// Precached at install into the REQUIRED cache. These two are special: on
// the FIRST visit they are fetched before the worker controls the page, so
// normal browsing never puts them in cache — without this list, visit #2
// paid full network for the HTML and the entry bundle. Served cache-first,
// which is safe under the existing deploy rule: V bumps on every deploy.
var INSTALL_FILES_REQUIRED = [
    "/",
    ENTRY_BUNDLE
];

// Cache names
var V = "v2";
var REQUIRED_CACHE = "unless-update-cache-"+V+"-required";
var USEFUL_CACHE = "unless-update-cache-"+V+"-useful";
var STATIC_CACHE = "unless-update-cache-"+V+"-static";
var OTHER_CACHE = "unless-update-cache-"+V+"-other";
var ALL_CACHES = [REQUIRED_CACHE, STATIC_CACHE, USEFUL_CACHE, OTHER_CACHE];

// Extension routing is decided on the URL *path* (query string ignored), the
// cache key stays the full URL.
var USEFUL_EXTENSIONS = [".wasm", ".png", ".webp", ".avif", ".json", ".webmanifest", ".svg", ".jpg", ".jpeg", ".gif", ".ico", ".onnx", ".woff2", ".woff", ".ttf", ".otf", ".css", ".bin", ".pdf"];
var MEDIA_EXTENSIONS = [".wav", ".mp3", ".mp4"];

// Regular expressions for chunk matching. The id group also accepts dots so
// a future `chunk_[id].[contenthash].min.js` output pattern routes unchanged.
var MAIN_CHILD_CHUNK_REGEX = /chunk_(main_[a-zA-Z0-9_.-]+)\.min\.js$/i;
var CHILD_CHUNK_REGEX = /chunk_([a-zA-Z0-9_.-]+)\.min\.js$/i;

// Lazy-opened cache handles (promises)
var required_cache = caches.open(REQUIRED_CACHE);
var useful_cache = caches.open(USEFUL_CACHE);
var static_cache = caches.open(STATIC_CACHE);
var other_cache = caches.open(OTHER_CACHE);

// ─── Network access for the worker's OWN cache fills ───
// `cache: "no-cache"` makes the browser revalidate against the origin (If-None-
// Match / If-Modified-Since) instead of handing back whatever its HTTP cache
// holds. This host serves everything with `Cache-Control: max-age=600` and the
// build reuses the same chunk file names on every deploy, so a plain fetch()
// could fill a freshly versioned cache with the PREVIOUS build's bundle or
// chunks straight out of the HTTP cache — and cache-first then served that mix
// until the next V bump. Unchanged files come back as 304 and cost one round
// trip; fetch() still resolves them as a normal 200.
function network(url) {
    return fetch(url, { cache: "no-cache" });
}

// A network-error Response (what the page would have received with no worker
// at all). Returned instead of letting the respondWith() promise reject: a
// rejection fails the load exactly the same way, but is additionally reported
// here as "Uncaught (in promise) TypeError: Failed to fetch".
function network_error() {
    return Response.error();
}

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
        return network(url).catch(network_error);
    });
}

// ─── Fetch from network and store in given cache ───
function fetchAndCache(url, cache) {
    return network(url).then(function (response) {
        if (response.status === 200 || url === "/") {
            try { cache.put(url, response.clone()); } catch (e) { /* quota */ }
        }
        return response;
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
        return network("/").catch(network_error);
    });
}

// ═══════════════════════════════════════════════════
// Install
// ═══════════════════════════════════════════════════
self.addEventListener("install", function (event) {
    // Activate this version as soon as install finishes, instead of
    // waiting for every tab running the previous worker to close.
    self.skipWaiting();

    // Cache static assets individually so one missing file never fails the
    // whole install. Each add() revalidates against the origin (see network()).
    var precache = function (cachePromise, urls) {
        return cachePromise.then(function (cache) {
            return Promise.allSettled(
                urls.map(function (u) {
                    return cache.add(new Request(u, { cache: "no-cache" }));
                })
            );
        });
    };
    event.waitUntil(
        Promise.all([
            precache(useful_cache, INSTALL_FILES_USEFUL),
            precache(required_cache, INSTALL_FILES_REQUIRED)
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

    // ── Anything that is not http(s) is not ours ──
    // chrome-extension:// and moz-extension:// resources that extensions inject
    // into the page, data:, blob:, file: … The browser handles all of these
    // natively; a fetch() on an extension URL from here throws "Failed to
    // fetch" and fails the resource that would otherwise have loaded.
    if (url.indexOf("https://") !== 0 && url.indexOf("http://") !== 0) return;

    var parsed;
    try {
        parsed = new URL(url);
    } catch (e) {
        return;
    }

    // ── Cross-origin: never intercepted ──
    // Decided on the request's ORIGIN, not on `request.referrer`. The referrer
    // is empty or opaque for many legitimate same-origin requests — a
    // Referrer-Policy: no-referrer page, workers spawned from blob:/data: URLs
    // (local schemes carry no referrer), prefetches, favicon and manifest
    // fetches — and the old check routed all of those to the uncached
    // catch-all. It also treated api.pixagram.com as "internal" (the hostname
    // is a substring), proxying its GETs through the worker for no benefit.
    if (parsed.origin !== self.location.origin) return;

    var path = parsed.pathname;

    // ── Range requests (video seeking etc.) – always network ──
    if (request.headers.get("range")) {
        event.respondWith(fetch(request).catch(network_error));
        return;
    }

    // Static assets → useful cache
    if (either_ends_with(USEFUL_EXTENSIONS, path)) {
        event.respondWith(serve_cache(useful_cache, url));
        return;
    }

    // Media → static cache
    if (either_ends_with(MEDIA_EXTENSIONS, path)) {
        event.respondWith(serve_cache(static_cache, url));
        return;
    }

    // Entry bundle → required cache (canonical path whatever the page asked)
    if (path.endsWith("chunk_norris.min.js")) {
        event.respondWith(serve_cache(required_cache, ENTRY_BUNDLE));
        return;
    }

    // Lazy chunks → required cache
    var mainMatch = path.match(MAIN_CHILD_CHUNK_REGEX);
    if (mainMatch) {
        event.respondWith(serve_cache(required_cache, "/client/chunk_" + mainMatch[1] + ".min.js"));
        return;
    }

    var childMatch = path.match(CHILD_CHUNK_REGEX);
    if (childMatch) {
        event.respondWith(serve_cache(required_cache, "/client/chunk_" + childMatch[1] + ".min.js"));
        return;
    }

    // ══════════════════════════════════════════════
    // SPA fallback – serve "/" for ALL navigation requests:
    // /created/hype, /@user, /trending/art all get the same index.html
    // (the host answers them with its 404 page) and client-side routing
    // takes over.
    // ══════════════════════════════════════════════
    if (request.mode === "navigate") {
        event.respondWith(serveSPAFallback());
        return;
    }

    // ── Any remaining same-origin GET: any cache, then network ──
    // Never rejects: an offline miss becomes a network-error Response, the
    // same outcome the page would have had without a worker.
    event.respondWith(
        caches.match(url).then(function (cached) {
            return cached || fetch(request).catch(network_error);
        }).catch(function () {
            return fetch(request).catch(network_error);
        })
    );
});

// ═══════════════════════════════════════════════════
// Activate – purge old versioned caches
// ═══════════════════════════════════════════════════
self.addEventListener("activate", function (event) {
    event.waitUntil(
        Promise.all([
            // Take control of already-open tabs immediately, instead of
            // only affecting the next full navigation.
            self.clients.claim(),
            caches.keys().then(function (keys) {
                return Promise.all(
                    keys.filter(function (key) {
                        return ALL_CACHES.indexOf(key) === -1;
                    }).map(function (key) {
                        return caches.delete(key);
                    })
                );
            })
        ])
    );
});
