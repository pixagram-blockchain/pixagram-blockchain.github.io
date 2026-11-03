/*
 * Pixagram PWA launch & capability glue — loaded by index.html (defer).
 *
 * Handles every way the installed app can be entered besides its icon:
 *   ?pwa=create           manifest shortcut "Create", note_taking, widget "Create"
 *   ?pwa=open-file        file_handlers (the files arrive through launchQueue)
 *   ?pwa=share&id=…       share_target (the service worker stored the shared files)
 *   ?pwa=protocol&uri=…   protocol_handlers (web+pixagram:)
 *   launchQueue           launch_handler "focus-existing": route inside the open window
 * plus the Window Controls Overlay title bar, background sync, periodic
 * background sync and a push-subscription helper (window.PixagramPWA).
 *
 * It drives the app only through what a user could do (the CREATE button and
 * the upload field), so it needs no change to the bundle. If the UI ever
 * changes and an element is not found, it gives up quietly after a timeout.
 */
(function () {
    "use strict";

    var SHARE_CACHE = "pixagram-share-target";
    var SYNC_TAG = "pixagram-resync";
    var PERIODIC_TAG = "pixagram-refresh";
    var PERIODIC_INTERVAL = 12 * 60 * 60 * 1000;
    var API_NODE = "https://api.pixagram.com";
    var FEED_PATH = "/trending/";
    var FEED_PAGE = /^\/(trending|created|hot|promoted|feed)(\/|$)/;
    var SAFE_PATH = /^\/[A-Za-z0-9@._~!$&'()*+,;=:%\/\-]*$/;
    var IMAGE_NAME = /\.(png|jpe?g|gif|webp|bmp|avif|heic|heif)$/i;
    // index.html records the address in <head>, before the app's router can
    // rewrite it; this file runs deferred, after the bundle.
    var initialHref = window.__pxgLaunchHref || location.href;
    var handledLaunches = {};

    // ── helpers ────────────────────────────────────────────────────────
    function isImage(file) {
        return !!file && ((file.type || "").indexOf("image/") === 0 || IMAGE_NAME.test(file.name || ""));
    }

    function safePath(value) {
        if (typeof value !== "string" || !value) return null;
        try {
            var u = new URL(value, location.origin);
            if (u.origin !== location.origin) return null;
            var p = u.pathname + u.search + u.hash;
            return SAFE_PATH.test(u.pathname) ? p : null;
        } catch (e) {
            return null;
        }
    }

    // Client-side navigation the app's router (history v5) picks up: push an
    // entry shaped like the ones it writes, then fire popstate.
    function appNavigate(path) {
        var p = safePath(path);
        if (!p || p === location.pathname + location.search + location.hash) return;
        var prev = history.state && typeof history.state.idx === "number" ? history.state.idx : 0;
        history.pushState({ usr: null, key: Math.random().toString(36).slice(2, 10), idx: prev + 1 }, "", p);
        window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
    }

    function waitFor(test, timeout) {
        return new Promise(function (resolve, reject) {
            var t0 = Date.now();
            (function poll() {
                var hit = null;
                try { hit = test(); } catch (e) { /* not there yet */ }
                if (hit) return resolve(hit);
                if (Date.now() - t0 > timeout) return reject(new Error("timeout"));
                setTimeout(poll, 150);
            })();
        });
    }

    function utf8ToBase64Url(text) {
        var bytes = new TextEncoder().encode(text);
        var binary = "";
        for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }

    // ── open the creation wizard, optionally with an image ────────────
    var UPLOAD = '[role="dialog"] input[type="file"]';

    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    // The feed's CREATE button, once the app has booted and the button has
    // stayed the same element for a second (early boot can re-render the page).
    function stableCreateButton() {
        var seen = null, since = 0;
        return waitFor(function () {
            var fab = document.body && document.body.classList.contains("loaded") &&
                document.querySelector(".MuiFab-extended");
            if (!fab) { seen = null; return null; }
            if (fab !== seen) { seen = fab; since = Date.now(); return null; }
            return Date.now() - since >= 1000 ? fab : null;
        }, 30000);
    }

    function openCreate(file) {
        if (!FEED_PAGE.test(location.pathname)) appNavigate(FEED_PATH);
        var attempt = 0;
        function run() {
            attempt++;
            return stableCreateButton().then(function (fab) {
                if (!document.querySelector(UPLOAD)) fab.click();
                return waitFor(function () { return document.querySelector(UPLOAD); }, 15000);
            }).then(function (input) {
                var wizard = input.closest('[role="dialog"]');
                if (file) {
                    var dt = new DataTransfer();
                    dt.items.add(file);
                    input.files = dt.files;
                    input.dispatchEvent(new Event("change", { bubbles: true }));
                }
                // On a first visit the app can still close a dialog it has just
                // opened (the guided tour arming, a late language swap). If the
                // wizard is gone a moment later, open it and load the file again
                // — unless the user clicked or typed meanwhile: then the close
                // was theirs and is respected.
                var userActed = false;
                var mark = function (e) { if (e.isTrusted) userActed = true; };
                document.addEventListener("pointerdown", mark, true);
                document.addEventListener("keydown", mark, true);
                return sleep(2500).then(function () {
                    document.removeEventListener("pointerdown", mark, true);
                    document.removeEventListener("keydown", mark, true);
                    if (!document.contains(wizard) && !userActed && attempt < 4) return run();
                });
            });
        }
        return run().catch(function () { /* app not ready or UI changed: the user still lands on the feed */ });
    }

    // ── share_target: read what the service worker stored ─────────────
    function consumeShare(id) {
        if (!id || !/^[a-z0-9]{4,40}$/.test(id) || !("caches" in window)) return;
        var base = "/__pwa/share/" + id + "/";
        caches.open(SHARE_CACHE).then(function (cache) {
            return cache.match(base + "meta.json").then(function (r) { return r ? r.json() : null; })
                .then(function (meta) {
                    if (!meta) return;
                    return Promise.all((meta.files || []).map(function (f) {
                        return cache.match(f.key).then(function (r) { return r ? r.blob() : null; })
                            .then(function (b) { return b ? new File([b], f.name, { type: f.type || b.type }) : null; });
                    })).then(function (files) {
                        cache.keys().then(function (keys) {
                            keys.forEach(function (k) { if (k.url.indexOf(base) !== -1) cache.delete(k); });
                        });
                        var image = files.filter(isImage)[0];
                        if (image) return openCreate(image);
                        var text = [meta.url, meta.text, meta.title].join(" ");
                        var own = text.match(/https:\/\/(?:www\.)?pixagram\.com(\/[^\s"'<>]*)/i);
                        if (own && safePath(own[1])) return appNavigate(own[1]);
                        var q = (meta.title || meta.text || meta.url || "").trim().slice(0, 256);
                        if (q) appNavigate(FEED_PATH + "+search-" + utf8ToBase64Url(JSON.stringify({ q: q })));
                    });
                });
        }).catch(function () {});
    }

    // ── protocol_handlers: web+pixagram:… ─────────────────────────────
    //   web+pixagram://@author                 → /@author
    //   web+pixagram://@author/permlink        → the post (category looked up on chain)
    //   web+pixagram://trending/art, //feed, //portal-130022, //created …  → that page
    //   web+pixagram://https://pixagram.com/…  → that path
    function handleProtocol(uri) {
        var rest = String(uri || "").replace(/^web\+pixagram:\/*/i, "").trim();
        if (/^https?:/i.test(rest)) return appNavigate(safePath(rest));
        var post = rest.match(/^@([a-z0-9.\-]{3,16})\/([a-z0-9.\-]{1,255})\/?$/);
        if (post) {
            var fallback = "/general/@" + post[1] + "/" + post[2];
            var timer = new Promise(function (resolve) { setTimeout(function () { resolve(null); }, 4000); });
            var lookup = fetch(API_NODE, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "bridge.get_post",
                                       params: { author: post[1], permlink: post[2], observer: "" } })
            }).then(function (r) { return r.json(); })
              .then(function (j) { return j && j.result && j.result.url; })
              .catch(function () { return null; });
            return Promise.race([lookup, timer]).then(function (url) { appNavigate(safePath(url) || fallback); });
        }
        appNavigate("/" + rest.replace(/^\/+/, ""));
    }

    // ── ?pwa=… launch URLs ────────────────────────────────────────────
    function handleLaunchUrl(u) {
        var action = u.searchParams.get("pwa");
        if (!action) return false;
        var once = u.searchParams.toString();
        if (handledLaunches[once]) return true;  // initial URL and launchQueue may both deliver it
        handledLaunches[once] = true;
        var id = u.searchParams.get("id");
        var uri = u.searchParams.get("uri");
        if (u.href === location.href) {
            // drop our parameters from the address bar, keep the router's state
            ["pwa", "id", "uri", "error"].forEach(function (k) { u.searchParams.delete(k); });
            history.replaceState(history.state, "", u.pathname + (u.search || "") + u.hash);
        }
        if (action === "create") openCreate();
        else if (action === "share") consumeShare(id);
        else if (action === "protocol") handleProtocol(uri);
        else if (action === "open-file" && !FEED_PAGE.test(location.pathname)) appNavigate(FEED_PATH);
        return true;
    }

    handleLaunchUrl(new URL(initialHref));

    // ── launchQueue (file_handlers + launch_handler focus-existing) ───
    if ("launchQueue" in window && window.launchQueue && window.launchQueue.setConsumer) {
        var firstLaunch = true;
        window.launchQueue.setConsumer(function (params) {
            var target = params && params.targetURL ? new URL(params.targetURL) : null;
            var isInitial = firstLaunch && target && target.href === initialHref;
            firstLaunch = false;
            if (target && !isInitial && !handleLaunchUrl(target)) {
                // a shortcut or captured link while the app was already open;
                // a plain icon launch (start_url) keeps the user where they are
                if (target.pathname !== "/" || target.search || target.hash) {
                    appNavigate(target.pathname + target.search + target.hash);
                }
            }
            var handles = (params && params.files) || [];
            if (handles.length) {
                Promise.all(handles.map(function (h) { return h.getFile(); })).then(function (files) {
                    var image = files.filter(isImage)[0];
                    if (image) openCreate(image);
                }).catch(function () {});
            }
        });
    }

    // ── messages from the service worker ──────────────────────────────
    var subscriptionListeners = [];
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.addEventListener("message", function (e) {
            var d = e.data || {};
            if (d.type === "pixagram:navigate") appNavigate(d.url);
            else if (d.type === "pixagram:back-online") window.dispatchEvent(new CustomEvent("pixagram:back-online"));
            else if (d.type === "pixagram:push-subscription") {
                subscriptionListeners.forEach(function (fn) { try { fn(d.subscription); } catch (err) { /* listener */ } });
            }
        });
    }

    // ── Window Controls Overlay title bar (desktop, title bar hidden) ──
    function mountTitlebar() {
        if (document.getElementById("pwa-titlebar")) return;
        var bar = document.createElement("div");
        bar.id = "pwa-titlebar";
        bar.setAttribute("aria-hidden", "true");
        var img = document.createElement("img");
        img.src = "/src/images/manifest/icons/icon-32.png";
        img.alt = "";
        var name = document.createElement("span");
        name.textContent = "PIXAGRAM";
        bar.appendChild(img);
        bar.appendChild(name);
        // outside <body>: the overlay layout moves <body> below the title bar
        document.documentElement.appendChild(bar);
    }
    if ("windowControlsOverlay" in navigator) mountTitlebar();

    // ── background sync + periodic background sync ────────────────────
    function isInstalled() {
        return ["standalone", "fullscreen", "minimal-ui", "window-controls-overlay", "tabbed"].some(function (m) {
            return window.matchMedia("(display-mode: " + m + ")").matches;
        });
    }

    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.ready.then(function (reg) {
            if (reg.sync) {
                window.addEventListener("offline", function () {
                    reg.sync.register(SYNC_TAG).catch(function () {});
                });
            }
            if (reg.periodicSync && isInstalled() && navigator.permissions) {
                navigator.permissions.query({ name: "periodic-background-sync" }).then(function (status) {
                    if (status.state === "granted") {
                        return reg.periodicSync.register(PERIODIC_TAG, { minInterval: PERIODIC_INTERVAL });
                    }
                }).catch(function () {});
            }
        });
    }

    // ── public helpers for the app (push, routing, creation) ──────────
    function base64UrlToUint8(b64) {
        var raw = atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64.length + 3) % 4));
        var out = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
        return out;
    }

    window.PixagramPWA = {
        navigate: appNavigate,
        openCreate: openCreate,
        // Call from a user gesture (e.g. a "Notify me" toggle in Settings).
        // vapidPublicKey: the base64url VAPID public key of your push server.
        // Resolves with the subscription JSON to POST to that server.
        subscribePush: function (vapidPublicKey) {
            if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
                return Promise.reject(new Error("Push is not supported in this browser"));
            }
            return Notification.requestPermission().then(function (perm) {
                if (perm !== "granted") throw new Error("Notification permission " + perm);
                return navigator.serviceWorker.ready;
            }).then(function (reg) {
                return reg.pushManager.getSubscription().then(function (existing) {
                    return existing || reg.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: base64UrlToUint8(vapidPublicKey)
                    });
                });
            }).then(function (sub) { return sub.toJSON(); });
        },
        unsubscribePush: function () {
            return navigator.serviceWorker.ready.then(function (reg) {
                return reg.pushManager.getSubscription();
            }).then(function (sub) { return sub ? sub.unsubscribe() : false; });
        },
        // fn(subscriptionJSON) runs when the browser rotates the subscription
        onPushSubscriptionChange: function (fn) { subscriptionListeners.push(fn); }
    };
})();
