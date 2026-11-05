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
    "/src/images/manifest/icons/icon-192.png",
    "/src/images/manifest/icons/badge-96.png",
    "/pwa.js",
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
var V = "Nov-5-2026";
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

    // ── Web Share Target: POST from the OS share sheet (manifest share_target) ──
    if (request.method === "POST" && PWA_SHARE_PATHS.indexOf(new URL(url).pathname) !== -1) {
        event.respondWith(pwaHandleShareTarget(request));
        return;
    }

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

// ═══════════════════════════════════════════════════
// PWA capabilities
//   share_target · Windows widgets · periodic background sync ·
//   background sync · push notifications
// Everything below is additive: the caching code above is unchanged except
// for the share-target branch at the top of the fetch handler.
// ═══════════════════════════════════════════════════
var PWA_API_NODE = "https://api.pixagram.com";
var PWA_SHARE_CACHE = "pixagram-share-target";   // one pending share at a time; read once, then deleted
var PWA_DATA_CACHE = "pixagram-pwa-data";        // last trending snapshot (widget + offline)
var PWA_TRENDING_KEY = "/__pwa/trending.json";
var PWA_WIDGET_TAG = "pixagram-trending";        // = manifest widgets[0].tag
var PWA_WIDGET_TEMPLATE = "/widgets/trending-template.json";
var PWA_WIDGET_DATA = "/widgets/trending-data.json";
var PWA_PERIODIC_TAG = "pixagram-refresh";       // registered by /pwa.js once installed
var PWA_SYNC_TAG = "pixagram-resync";            // registered by /pwa.js when the device goes offline
var PWA_ICON = "/src/images/manifest/icons/icon-192.png";
var PWA_BADGE = "/src/images/manifest/icons/badge-96.png";

// The activate handler purges every cache that is not in ALL_CACHES; these two
// are not versioned (they hold data, not code), so they must survive a V bump.
ALL_CACHES.push(PWA_SHARE_CACHE, PWA_DATA_CACHE);

// Same-origin path from untrusted input (push payloads, widget verbs), or null.
function pwaSafePath(value) {
    if (typeof value !== "string" || !value) return null;
    try {
        var u = new URL(value, self.location.origin);
        if (u.origin !== self.location.origin) return null;
        return u.pathname + u.search + u.hash;
    } catch (e) {
        return null;
    }
}

function pwaPostToClients(message) {
    return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
        list.forEach(function (client) { client.postMessage(message); });
        return list;
    });
}

// Focus an open Pixagram window and route it client-side (no reload), or open one.
function pwaFocusOrOpen(path) {
    var target = pwaSafePath(path) || "/trending/";
    return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
        for (var i = 0; i < list.length; i++) {
            if (new URL(list[i].url).origin === self.location.origin && "focus" in list[i]) {
                list[i].postMessage({ type: "pixagram:navigate", url: target });
                return list[i].focus();
            }
        }
        return self.clients.openWindow(target);
    });
}

// ─── Web Share Target ───
// manifest share_target: POST multipart/form-data to /share-target/. The host
// (GitHub Pages) cannot answer a POST, so the worker reads the form, keeps the
// files in Cache Storage and redirects to a GET page; /pwa.js picks them up
// there and opens the creation wizard with the shared image.
var PWA_SHARE_PATHS = ["/share-target/", "/share-target"];

function pwaHandleShareTarget(request) {
    return request.formData().then(function (form) {
        var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        var files = form.getAll("image").filter(function (f) {
            return f && typeof f === "object" && typeof f.size === "number" && f.size > 0;
        }).slice(0, 10);
        var meta = {
            id: id,
            title: String(form.get("title") || "").slice(0, 2000),
            text: String(form.get("text") || "").slice(0, 2000),
            url: String(form.get("url") || "").slice(0, 2000),
            files: []
        };
        return caches.open(PWA_SHARE_CACHE).then(function (cache) {
            // A new share replaces any share that was never picked up.
            return cache.keys().then(function (keys) {
                return Promise.all(keys.map(function (k) { return cache.delete(k); }));
            }).then(function () {
                return Promise.all(files.map(function (file, i) {
                    var key = "/__pwa/share/" + id + "/" + i;
                    var type = file.type || "application/octet-stream";
                    meta.files.push({ key: key, name: file.name || ("shared-" + i), type: type });
                    return cache.put(key, new Response(file, { headers: { "Content-Type": type } }));
                }));
            }).then(function () {
                return cache.put("/__pwa/share/" + id + "/meta.json", new Response(JSON.stringify(meta), {
                    headers: { "Content-Type": "application/json" }
                }));
            });
        }).then(function () {
            return Response.redirect("/trending/?pwa=share&id=" + id, 303);
        });
    }).catch(function () {
        return Response.redirect("/trending/?pwa=share&error=1", 303);
    });
}

// ─── Trending snapshot (widget data, refreshed by periodic sync) ───
function pwaRpc(method, params) {
    return fetch(PWA_API_NODE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: method, params: params }),
        cache: "no-store"
    }).then(function (r) {
        if (!r.ok) throw new Error("rpc " + r.status);
        return r.json();
    }).then(function (j) {
        if (j.error) throw new Error(j.error.message || "rpc error");
        return j.result;
    });
}

// Same filtering as the app: no NSFW, deleted, hidden or grayed posts.
function pwaBuildTrendingData(list) {
    var out = [];
    for (var i = 0; i < (list || []).length && out.length < 3; i++) {
        var p = list[i] || {};
        var meta = p.json_metadata || {};
        if (typeof meta === "string") { try { meta = JSON.parse(meta); } catch (e) { meta = {}; } }
        var stats = p.stats || {};
        if (meta.nsfw || meta.deleted || stats.hide || stats.gray || p.body === "deleted") continue;
        if (!p.url || !p.title) continue;
        var votes = stats.total_votes != null ? stats.total_votes : (p.active_votes || []).length;
        var payout = typeof p.payout === "number" ? p.payout : parseFloat(p.pending_payout_value || "0");
        out.push({
            title: String(p.title).trim().slice(0, 80),
            author: String(p.author || ""),
            votes: votes + (votes === 1 ? " vote" : " votes"),
            payout: (isFinite(payout) ? payout : 0).toFixed(2) + " PXS",
            verb: "open:" + p.url
        });
    }
    var time = "";
    try { time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch (e) { /* no Intl */ }
    return { updated: time ? "Updated " + time : "Updated", posts: out };
}

function pwaRefreshTrending() {
    return pwaRpc("bridge.get_ranked_posts", { sort: "trending", tag: "", observer: "", limit: 6 })
        .then(function (posts) {
            var data = pwaBuildTrendingData(posts);
            return caches.open(PWA_DATA_CACHE).then(function (cache) {
                return cache.put(PWA_TRENDING_KEY, new Response(JSON.stringify(data), {
                    headers: { "Content-Type": "application/json" }
                }));
            }).then(function () { return data; });
        });
}

function pwaTrendingData() {
    // fresh data, else the last snapshot, else the static file from the manifest
    return pwaRefreshTrending().catch(function () {
        return caches.match(PWA_TRENDING_KEY).then(function (r) {
            if (r) return r.json();
            return fetch(PWA_WIDGET_DATA).then(function (res) { return res.json(); });
        });
    });
}

// ─── Windows widgets (manifest "widgets") ───
function pwaRenderWidget(widget) {
    var def = (widget && widget.definition) || {};
    var templateUrl = def.msAcTemplate || def.ms_ac_template || PWA_WIDGET_TEMPLATE;
    return Promise.all([
        fetch(templateUrl).then(function (r) { return r.text(); }),
        pwaTrendingData()
    ]).then(function (parts) {
        return self.widgets.updateByTag(def.tag || PWA_WIDGET_TAG, {
            template: parts[0],
            data: JSON.stringify(parts[1])
        });
    });
}

function pwaRenderAllWidgets() {
    if (!self.widgets) return Promise.resolve();
    return self.widgets.getByTag(PWA_WIDGET_TAG).then(function (widget) {
        if (widget && widget.instances && widget.instances.length) return pwaRenderWidget(widget);
    }).catch(function () { /* no widget host */ });
}

self.addEventListener("widgetinstall", function (event) {
    event.waitUntil(pwaRenderWidget(event.widget).then(function () {
        var reg = self.registration;
        var def = (event.widget && event.widget.definition) || {};
        if (!reg.periodicSync || !def.update) return;
        return reg.periodicSync.getTags().then(function (tags) {
            if (tags.indexOf(PWA_WIDGET_TAG) === -1) {
                return reg.periodicSync.register(PWA_WIDGET_TAG, { minInterval: def.update * 1000 });
            }
        });
    }).catch(function () { /* rendering failures leave the host's placeholder */ }));
});

self.addEventListener("widgetresume", function (event) {
    event.waitUntil(pwaRenderWidget(event.widget).catch(function () {}));
});

self.addEventListener("widgetuninstall", function (event) {
    event.waitUntil(Promise.resolve().then(function () {
        var reg = self.registration;
        var w = event.widget;
        if (reg.periodicSync && w && w.instances && w.instances.length <= 1) {
            return reg.periodicSync.unregister(PWA_WIDGET_TAG);
        }
    }).catch(function () {}));
});

self.addEventListener("widgetclick", function (event) {
    var action = String(event.action || "");
    var work;
    if (action === "create") {
        work = pwaFocusOrOpen("/trending/?pwa=create");
    } else if (action === "open") {
        work = pwaFocusOrOpen("/trending/");
    } else if (action.indexOf("open:") === 0) {
        work = pwaFocusOrOpen(action.slice(5));
    } else if (action === "refresh") {
        work = pwaRenderWidget(event.widget);
    } else {
        work = Promise.resolve();
    }
    event.waitUntil(work.catch(function () {}));
});

// A new worker version re-renders widgets that were installed under the old one.
self.addEventListener("activate", function (event) {
    event.waitUntil(pwaRenderAllWidgets());
});

// ─── Periodic Background Sync ───
// Keeps the trending snapshot (and the widget) fresh while the app is closed.
self.addEventListener("periodicsync", function (event) {
    if (event.tag === PWA_PERIODIC_TAG || event.tag === PWA_WIDGET_TAG) {
        event.waitUntil(pwaRefreshTrending().then(pwaRenderAllWidgets).catch(function () {}));
    }
});

// ─── Background Sync ───
// /pwa.js registers PWA_SYNC_TAG when the device goes offline. When the
// connection is back, the browser wakes this worker even if the tab is gone:
// re-fill the offline shell (a first visit cut off mid-install leaves it
// incomplete), refresh the trending snapshot and widgets, and tell any open
// window it can refetch.
function pwaRewarmShell() {
    return required_cache.then(function (cache) {
        return Promise.all(INSTALL_FILES_REQUIRED.map(function (u) {
            return cache.match(u).then(function (hit) { return hit || fetchAndCache(u, cache); });
        }));
    });
}

self.addEventListener("sync", function (event) {
    if (event.tag !== PWA_SYNC_TAG) return;
    event.waitUntil(
        Promise.all([
            pwaRewarmShell().catch(function () {}),
            pwaRefreshTrending().then(pwaRenderAllWidgets).catch(function () {})
        ]).then(function () {
            return pwaPostToClients({ type: "pixagram:back-online" });
        })
    );
});

// ─── Push notifications ───
// Payload (JSON, all optional):
//   { "title", "body", "url", "icon", "image", "tag", "timestamp",
//     "actions": [{ "action": "<same-origin path>", "title": "…" }] }
self.addEventListener("push", function (event) {
    var payload = {};
    if (event.data) {
        try { payload = event.data.json() || {}; } catch (e) { payload = { body: event.data.text() }; }
    }
    var actions = Array.isArray(payload.actions) ? payload.actions.filter(function (a) {
        return a && pwaSafePath(a.action) && a.title;
    }).slice(0, 2) : [];
    var options = {
        body: String(payload.body || ""),
        icon: pwaSafePath(payload.icon) || PWA_ICON,
        badge: PWA_BADGE,
        tag: payload.tag ? String(payload.tag) : undefined,
        renotify: !!payload.tag,
        timestamp: typeof payload.timestamp === "number" ? payload.timestamp : Date.now(),
        data: { url: pwaSafePath(payload.url) || "/trending/" },
        actions: actions.map(function (a) { return { action: pwaSafePath(a.action), title: String(a.title) }; })
    };
    var image = pwaSafePath(payload.image);
    if (image) options.image = image;
    event.waitUntil(self.registration.showNotification(String(payload.title || "Pixagram"), options));
});

self.addEventListener("notificationclick", function (event) {
    event.notification.close();
    var target = pwaSafePath(event.action) || (event.notification.data && event.notification.data.url) || "/trending/";
    event.waitUntil(pwaFocusOrOpen(target));
});

// The push service rotated the subscription: subscribe again with the same
// options and hand the new one to the open app (window.PixagramPWA re-sends it).
self.addEventListener("pushsubscriptionchange", function (event) {
    var options = event.oldSubscription && event.oldSubscription.options;
    if (!options || !options.applicationServerKey) return;
    event.waitUntil(
        self.registration.pushManager.subscribe(options).then(function (sub) {
            return pwaPostToClients({ type: "pixagram:push-subscription", subscription: sub.toJSON() });
        }).catch(function () {})
    );
});
