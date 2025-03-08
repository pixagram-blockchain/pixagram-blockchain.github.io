
var either_ends_with = function (possibilities, onto){
    var result = false;
    possibilities.forEach(function (possibility){
        if(onto.endsWith(possibility)){result = true;}
    });
    return result;
};
var either_starts_with = function (possibilities, onto){
    var result = false;
    possibilities.forEach(function (possibility){
        if(onto.startsWith(possibility)){result = true;}
    });
    return result;
};

// Helper functions
var F_IMG = function (n) { return `/src/images/${n}`; };
var F_CNK = function (n, i) { return `/client/chunk_${typeof n == "undefined" ? (i | 0) : (n | 0)}.min.js`; };
var F_SND = function (n) { return `/src/sounds/${n}.mp3`; };
var F_VID = function (n) { return `/src/videos/${n}.mp4`; };

var INSTALL_FILES_USEFUL = ["/src/images/favicon.ico", "/src/images/manifest/logo-white.png", "/src/fonts/industry/index.css", "/src/fonts/normative/index.css"];
var LOAD_FILES_REQUIRED = [];
var LOAD_FILES_USEFUL = [];
var LOAD_FILES_STATIC = [];

// Cache names
var REQUIRED_CACHE = "unless-update-cache-v35-required";
var USEFUL_CACHE = "unless-update-cache-v35-useful";
var STATIC_CACHE = "unless-update-cache-v35-static";
var OTHER_CACHE = "unless-update-cache-v35-other";

// Regular expressions for chunk matching
var MAIN_CHILD_CHUNK_REGEX = /chunk_(main_[a-zA-Z0-9_-]+)\.min\.js$/i;
var CHILD_CHUNK_REGEX = /chunk_([a-zA-Z0-9_-]+)\.min\.js$/i;

// Cache objects and their initialization
function initializeCache(cacheName, cacheObject) {
    return caches.open(cacheName).then(function(cache) {
        cacheObject = cache;
        return cacheObject;
    });
}

var required_cache_object, useful_cache_object, static_cache_object, other_cache_object;
var required_cache = initializeCache(REQUIRED_CACHE, required_cache_object);
var useful_cache = initializeCache(USEFUL_CACHE, useful_cache_object);
var static_cache = initializeCache(STATIC_CACHE, static_cache_object);
var other_cache = initializeCache(OTHER_CACHE, other_cache_object);

// Function to serve cache
function serve_cache(cache, url) {
    return cache.then(function (cache) {
        return cache.match(url).then(function (response) {
            if(url === "/" && response.status === 404) {
                var cr = response.clone();
                return cr.text().then(function (body){
                    return new Response(body, {
                        status: 200,
                        statusText: 'OK',
                        headers: cr.headers
                    });
                });
            }else if (response && response.status === 200) {
                return response.clone() || response;
            } else {
                return fetchAndCache(url, cache);
            }
        });
    }).catch(function () {
        return fetch(url);
    });
}

// Fetch and cache utility
function fetchAndCache(url, cache) {
    return fetch(url).then(function (response) {
        if(url === "/"){
            try {
                cache.put(url, response.clone());
            } catch (e){}
            return response.clone() || response;
        }else if (response.status === 200) {
            try {
                cache.put(url, response.clone());
            } catch (e){}
            return response.clone() || response;
        } else {
            return response.clone() || response;
        }
    });
}

// Install event
self.addEventListener("install", function(event) {
    event.waitUntil(
        Promise.allSettled([
            useful_cache.then(function(cache) {
                return cache.addAll(INSTALL_FILES_USEFUL);
            })
        ])
    );
});

// Fetch event
self.addEventListener("fetch", function(event) {
    "use strict";
    const request = event.request;
    const url = request.url;
    const same_site = event.request.referrer.startsWith(url.hostname);

    if (event.request.headers.get('range') && url.indexOf('http') === 0) {

        event.respondWith(fetch(request));

    }else if(either_starts_with(["data:image", "blob:http", "data:application"], url)) {

        event.respondWith(fetch(request));

    }else if(either_starts_with(["data:,all"], url)) {

        event.respondWith(
            Promise.all([
                useful_cache.then(function (cache) {
                    return cache.addAll(LOAD_FILES_USEFUL);
                }),
                required_cache.then(function (cache) {
                    return cache.addAll(LOAD_FILES_REQUIRED);
                }),
                static_cache.then(function (cache) {
                    return cache.addAll(LOAD_FILES_STATIC);
                })
            ])
                .then(function(){return new Response("all",{status: 200})})
                .catch(function(){return new Response("all", {status: 500})})
        );

    }else if(same_site && either_ends_with([".wasm", ".png", ".json", ".svg", ".jpg", ".jpeg", ".gif", ".ico", ".onnx"], url)) {

        // Serve cached image if doesn't fail
        event.respondWith(serve_cache(useful_cache, url));

    }else if(same_site && either_ends_with([".wav", ".mp3", ".mp4"], url)) {

        event.respondWith(serve_cache(static_cache, url));

    }else if(same_site && either_ends_with([".woff2", ".ttf", ".css", ".json"], url)) {

        event.respondWith(serve_cache(useful_cache, url));

    }else if(same_site && url.endsWith("chunk_norris.min.js")) {

        event.respondWith(serve_cache(required_cache, "/client/chunk_norris.min.js"));

    }else if(same_site && (url.match(MAIN_CHILD_CHUNK_REGEX) || []).length >= 1) {

        const middle_name = url.match(MAIN_CHILD_CHUNK_REGEX)[1];
        event.respondWith(serve_cache(required_cache, `/client/chunk_${middle_name}.min.js`));

    }else if(same_site && (url.match(CHILD_CHUNK_REGEX) || []).length >= 1) {

        const middle_name = url.match(CHILD_CHUNK_REGEX)[1];
        event.respondWith(serve_cache(required_cache, `/client/chunk_${middle_name}.min.js`));

    }else if(event.request.mode === "navigate") {

        event.respondWith(serve_cache(required_cache, "/"));

    } else if(event.request.method === "GET") {

        event.respondWith(
            Promise.any([
                required_cache.then(function (cache) {
                    return cache.match(url).then(function (response) {
                        return !response ? Promise.reject('Required cache missing') : response.status === 200 ? Promise.resolve(response.clone() || response) : Promise.reject('Required cache error');
                    });
                }),
                useful_cache.then(function (cache) {
                    return cache.match(url).then(function (response) {
                        return !response ? Promise.reject('Useful cache missing') : response.status === 200 ? Promise.resolve(response.clone() || response) : Promise.reject('Useful cache error');
                    });
                }),
                static_cache.then(function (cache) {
                    return cache.match(url).then(function (response) {
                        return !response ? Promise.reject('Static cache missing') : response.status === 200 ? Promise.resolve(response.clone() || response) : Promise.reject('Static cache error');
                    });
                }),
                // Repeat for other caches
                fetch(request)
            ])
        );
    } else if(url.startsWith('https') || url.contains('extension')){

        return;
    }else {
        return;
    }
});

// Activate event
self.addEventListener("activate", function(event) {
    event.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(
                keys.filter(function(key) {
                    return ![REQUIRED_CACHE, STATIC_CACHE, USEFUL_CACHE, OTHER_CACHE].includes(key);
                }).map(function(key) {
                    return caches.delete(key);
                })
            );
        })
    );
});