// ═════════════════════════════════════════════════════════════════════════════
// utils/leakProbe.js — what outlives the page it belonged to?
// ═════════════════════════════════════════════════════════════════════════════
// A development aid for "memory grows as I browse page after page". Nothing
// imports it: Index.js fetches it the first time window.__pixaLeakProbe() is
// called from the console, so a normal session never downloads it. Reload
// the page to remove it.
//
// From the moment it starts it watches:
//   • components    every Preact component unmounted since then that is
//                   still alive after a garbage collection, by name (plus
//                   its MUI class keys, which survive minification)
//   • elements      unmounted <canvas> / <img> / <video> / <iframe> still alive
//   • registrations window/document listeners, the API event emitter, the
//                   dispatcher and setInterval — added and never removed,
//                   with the stack line that added them
//   • resources     blob: URLs never revoked, canvas contexts still alive (and
//                   WebGL ones not lost), workers never terminated,
//                   AudioContexts never closed
//
// Usage — desktop Chrome, or a phone through chrome://inspect:
//   1. __pixaLeakProbe()   on the page you will come back to (say the feed)
//   2. browse a loop two or three times: feed → a post → a profile →
//      a community → back to the feed
//   3. back on the starting page, wait a few seconds, then DevTools ▸
//      Memory ▸ "Collect garbage" (the bin icon)
//   4. __pixaLeaks()        prints the report, and returns it
// What leaks grows by one set per loop: compare the "from earlier pages"
// column with the number of loops. A development build gives readable
// component names and stack lines.
//
// Relies on Preact 10's internal field names (vnode.__c = component,
// vnode.__e = DOM node), the ones preact/debug and the devtools read too.

import { options, Fragment } from "preact";

const W = typeof window !== "undefined" ? window : globalThis;
const TRACKED_TAGS = { canvas: true, img: true, video: true, iframe: true };
const TAG = "[leak probe]";

let started = false;
let seq = 0;
let nav = 0;        // page changes seen since start ("+meta" overlays excluded)
let path = "";      // current page path
let baseline = null;
let sources = { dispatcher: null, getEmitter: null };

// Unmounted since start, not collected yet: token → record.
const live = new Map();
const unmounted = new Map();   // group key → unmounted since start
const bornAt = new WeakMap();  // component / element → page change it mounted on
let registry = null;
let unmountsSeen = 0;
let componentsSeen = 0;

// Registrations still in place: (group) → Map(handle → record).
const listeners = new Map();   // "window resize" → Map(fn → rec)
const emitterRegs = new Map(); // event → Map(fn → rec)
const dispatcherRegs = new Map();
const intervals = new Map();
const blobs = new Map();
const contexts = [];
const workers = [];
const audios = [];
const terminated = new WeakSet();
const closedAudio = new WeakSet();
const watchedEmitters = new WeakSet();
let watchedEmitter = false;      // an emitter has been wrapped already
let emitterReplaced = false;

// ── helpers ──────────────────────────────────────────────────────────────────

const pagePath = () => {
    try { return String(W.location.pathname).split("+")[0]; } catch (e) { return ""; }
};

// The two stack frames above the probe's wrapper: who registered it. Only
// ever called through record(), from inside a wrapper.
function site() {
    const lines = String(new Error().stack || "").split("\n");
    // Chrome: "Error", then site(), record(), the wrapper — then the caller.
    const from = /^Error/.test(lines[0]) ? 4 : 3;
    const out = [];
    for (let i = from; i < lines.length && out.length < 2; i++) {
        const l = lines[i].trim().replace(/^at\s+/, "");
        if (l) out.push(l);
    }
    return out.join("  ←  ") || "(no stack)";
}

const record = () => ({ site: site(), nav });

// A watcher that can't install (a frozen object, a missing API) is skipped;
// the probe must never break the app it observes.
function safely(fn) {
    try { fn(); } catch (e) { console.warn(TAG + " skipped a watcher:", e && e.message); }
}
const mb = (bytes) => Math.round((bytes / 1048576) * 10) / 10;

function nameOf(type) {
    return (type && (type.displayName || type.name)) || "(anonymous)";
}

// MUI's withStyles hands every styled component a `classes` object keyed by
// the names in its source (homeRoot, toolbar…): a hint that stays readable
// in a production build where the component names are minified.
function classHint(c) {
    try {
        const cls = c && c.props && c.props.classes;
        if (cls && typeof cls === "object") {
            const keys = Object.keys(cls);
            if (keys.length) return keys.slice(0, 2).join(",");
        }
    } catch (e) { /* no hint */ }
    return "";
}

function elementKey(tag, el) {
    if (tag === "canvas") return "<canvas>";
    const src = String(el.currentSrc || el.src || "");
    let kind = "no src";
    if (src.startsWith("blob:")) kind = "blob:";
    else if (src.startsWith("data:")) kind = src.slice(0, Math.max(5, src.indexOf(";")));
    else if (src) kind = "url";
    return "<" + tag + "> " + kind;
}

function elementBytes(tag, el) {
    try {
        if (tag === "canvas") return (el.width | 0) * (el.height | 0) * 4;
        if (tag === "img") return (el.naturalWidth | 0) * (el.naturalHeight | 0) * 4;
    } catch (e) { /* unknown */ }
    return 0;
}

// `born`: the page change the target mounted on (-1: before the probe
// started). A page's components unmount on the way to the NEXT page, so
// "from earlier pages" is decided by where they were born, not by when
// they went.
function track(target, kind, key, bytes) {
    unmounted.set(key, (unmounted.get(key) || 0) + 1);
    const token = ++seq;
    const born = bornAt.has(target) ? bornAt.get(target) : -1;
    live.set(token, { kind, key, at: path, nav: born, bytes });
    registry.register(target, token);
}

function remember(map, group, handle, rec) {
    let m = map.get(group);
    if (!m) map.set(group, (m = new Map()));
    if (!m.has(handle)) m.set(handle, rec);
}

function forget(map, group, handle) {
    const m = map.get(group);
    if (m) m.delete(handle);
}

const captureOf = (opts) => (typeof opts === "boolean" ? opts : !!(opts && opts.capture));

// ── watchers ─────────────────────────────────────────────────────────────────

function watchNavigation() {
    path = pagePath();
    const moved = () => {
        const p = pagePath();
        if (p !== path) {
            path = p;
            nav += 1;
        }
    };
    const h = W.history;
    for (const name of ["pushState", "replaceState"]) {
        const orig = h && h[name];
        if (typeof orig !== "function") continue;
        h[name] = function () {
            const r = orig.apply(this, arguments);
            moved();
            return r;
        };
    }
    // Registered before the window listener wrapper goes in, so the probe's
    // own listener never shows up in the report.
    W.addEventListener("popstate", moved);
}

function hookMount() {
    const prev = options.diffed;
    options.diffed = (vnode) => {
        try {
            const type = vnode && vnode.type;
            const target = typeof type === "function" ? vnode.__c
                : typeof type === "string" && TRACKED_TAGS[type] ? vnode.__e
                    : null;
            if (target && typeof target === "object" && !bornAt.has(target)) bornAt.set(target, nav);
        } catch (e) { /* never break a render */ }
        if (prev) prev(vnode);
    };
}

function hookUnmount() {
    const prev = options.unmount;
    options.unmount = (vnode) => {
        try {
            const type = vnode && vnode.type;
            unmountsSeen++;
            if (typeof type === "function") {
                if (type !== Fragment) {
                    const c = vnode.__c; // Preact 10: vnode._component
                    if (c && typeof c === "object") {
                        componentsSeen++;
                        const hint = classHint(c);
                        track(c, "component", nameOf(type) + (hint ? " [" + hint + "]" : ""), 0);
                    }
                }
            } else if (typeof type === "string" && TRACKED_TAGS[type]) {
                const el = vnode.__e; // Preact 10: vnode._dom
                if (el && el.nodeType === 1) track(el, "element", elementKey(type, el), elementBytes(type, el));
            }
        } catch (e) { /* never break an unmount */ }
        if (prev) prev(vnode);
    };
}

function watchTarget(target, label) {
    if (!target || typeof target.addEventListener !== "function") return;
    const add = target.addEventListener;
    const remove = target.removeEventListener;
    target.addEventListener = function (type, fn, opts) {
        try {
            // `once` listeners remove themselves where the probe can't see it.
            if (fn && !(opts && typeof opts === "object" && opts.once)) {
                const group = label + " " + type + (captureOf(opts) ? " (capture)" : "");
                remember(listeners, group, fn, record());
                const signal = opts && typeof opts === "object" && opts.signal;
                if (signal && typeof signal.addEventListener === "function") {
                    signal.addEventListener("abort", () => forget(listeners, group, fn), { once: true });
                }
            }
        } catch (e) { /* ignore */ }
        return add.apply(this, arguments);
    };
    target.removeEventListener = function (type, fn, opts) {
        try { forget(listeners, label + " " + type + (captureOf(opts) ? " (capture)" : ""), fn); } catch (e) { /* ignore */ }
        return remove.apply(this, arguments);
    };
}

function watchTimers() {
    const setI = W.setInterval;
    const clearI = W.clearInterval;
    const clearT = W.clearTimeout;
    if (typeof setI !== "function") return;
    W.setInterval = function () {
        const id = setI.apply(this, arguments);
        try { intervals.set(id, record()); } catch (e) { /* ignore */ }
        return id;
    };
    W.clearInterval = function (id) {
        intervals.delete(id);
        return clearI.apply(this, arguments);
    };
    // Browsers share the id pool: clearTimeout stops an interval too.
    W.clearTimeout = function (id) {
        intervals.delete(id);
        return clearT.apply(this, arguments);
    };
}

function watchBlobs() {
    const U = W.URL;
    if (!U || typeof U.createObjectURL !== "function") return;
    const create = U.createObjectURL;
    const revoke = U.revokeObjectURL;
    U.createObjectURL = function (obj) {
        const url = create.apply(this, arguments);
        try { blobs.set(url, { ...record(), bytes: (obj && obj.size) || 0 }); } catch (e) { /* ignore */ }
        return url;
    };
    U.revokeObjectURL = function (url) {
        blobs.delete(url);
        return revoke.apply(this, arguments);
    };
}

function watchCanvas() {
    const seen = new WeakSet();
    for (const Ctor of [W.HTMLCanvasElement, W.OffscreenCanvas]) {
        const proto = Ctor && Ctor.prototype;
        const get = proto && proto.getContext;
        if (typeof get !== "function") continue;
        proto.getContext = function (type) {
            const ctx = get.apply(this, arguments);
            try {
                if (ctx && !seen.has(ctx)) {
                    seen.add(ctx);
                    contexts.push({ type: String(type), canvas: new WeakRef(this), ctx: new WeakRef(ctx), ...record() });
                }
            } catch (e) { /* ignore */ }
            return ctx;
        };
    }
}

function watchConstructor(name, list, done, closer) {
    const Native = W[name];
    if (typeof Native !== "function" || !Native.prototype) return;
    const end = Native.prototype[closer];
    if (typeof end === "function") {
        Native.prototype[closer] = function () {
            done.add(this);
            return end.apply(this, arguments);
        };
    }
    const Probe = function () {
        // new.target keeps subclasses (class X extends Worker) intact.
        const obj = Reflect.construct(Native, arguments, new.target || Native);
        try { list.push({ ref: new WeakRef(obj), what: name === "Worker" ? String(arguments[0]).slice(0, 80) : name, ...record() }); } catch (e) { /* ignore */ }
        return obj;
    };
    Probe.prototype = Native.prototype; // instanceof keeps working
    W[name] = Probe;
}

function watchDispatcher(d) {
    if (!d || typeof d.register !== "function") return;
    const reg = d.register;
    const unreg = d.unregister;
    d.register = function (cb) {
        const rec = record();
        const id = reg.apply(this, arguments);
        try { dispatcherRegs.set(id !== undefined ? id : cb, rec); } catch (e) { /* ignore */ }
        return id;
    };
    if (typeof unreg === "function") {
        d.unregister = function (id) {
            dispatcherRegs.delete(id);
            return unreg.apply(this, arguments);
        };
    }
}

function currentEmitter() {
    try { return (sources.getEmitter && sources.getEmitter()) || null; } catch (e) { return null; }
}

// Attribution starts when the emitter is first seen; a node switch in
// Settings brings a new API instance (and emitter), wrapped on the next
// report.
function watchEmitter(em) {
    if (!em || typeof em !== "object" || watchedEmitters.has(em)) return;
    watchedEmitters.add(em);
    // Any emitter seen before this one means the API was re-initialised.
    // (Nothing here holds a retired emitter: the probe must not create the
    // kind of retention it is looking for.)
    if (watchedEmitter) emitterReplaced = true;
    watchedEmitter = true;
    for (const name of ["on", "addListener"]) {
        const orig = em[name];
        if (typeof orig !== "function") continue;
        em[name] = function (event, fn) {
            try { if (typeof fn === "function") remember(emitterRegs, String(event), fn, record()); } catch (e) { /* ignore */ }
            return orig.apply(this, arguments);
        };
    }
    for (const name of ["off", "removeListener"]) {
        const orig = em[name];
        if (typeof orig !== "function") continue;
        em[name] = function (event, fn) {
            try { forget(emitterRegs, String(event), fn); } catch (e) { /* ignore */ }
            return orig.apply(this, arguments);
        };
    }
    const removeAll = em.removeAllListeners;
    if (typeof removeAll === "function") {
        em.removeAllListeners = function (event) {
            if (event === undefined) emitterRegs.clear();
            else emitterRegs.delete(String(event));
            return removeAll.apply(this, arguments);
        };
    }
}

// ── totals ───────────────────────────────────────────────────────────────────

const sizeOf = (v) => (!v ? 0 : Array.isArray(v) ? v.length : (v instanceof Set || v instanceof Map) ? v.size : 1);

// Listener count per event, or null when the emitter is missing or of a
// shape this can't read.
function emitterCounts(em) {
    if (!em) return null;
    const out = {};
    try {
        if (typeof em.eventNames === "function" && typeof em.listenerCount === "function") {
            for (const ev of em.eventNames()) out[String(ev)] = em.listenerCount(ev);
            return out;
        }
        const store = [em._events, em.events, em._listeners, em.listeners, em._handlers, em.handlers]
            .find((s) => s && typeof s === "object");
        if (!store) return null;
        if (store instanceof Map) store.forEach((v, k) => { out[String(k)] = sizeOf(v); });
        else for (const k of Object.keys(store)) out[k] = sizeOf(store[k]);
    } catch (e) { return null; }
    return out;
}

function dispatcherCount(d) {
    try {
        const s = d && [d._callbacks, d.callbacks, d._listeners, d.listeners].find((x) => x && typeof x === "object");
        if (!s) return null;
        if (s instanceof Map || s instanceof Set) return s.size;
        if (Array.isArray(s)) return s.filter(Boolean).length;
        return Object.keys(s).length;
    } catch (e) { return null; }
}

function totals() {
    const counts = emitterCounts(currentEmitter());
    const byEvent = counts || {};
    let heap = null;
    try { heap = W.performance && W.performance.memory ? mb(W.performance.memory.usedJSHeapSize) : null; } catch (e) { heap = null; }
    let nodes = null;
    try { nodes = W.document.getElementsByTagName("*").length; } catch (e) { nodes = null; }
    return {
        heapMB: heap,
        domNodes: nodes,
        emitterListeners: counts ? Object.values(counts).reduce((a, b) => a + b, 0) : null,
        dispatcherCallbacks: dispatcherCount(sources.dispatcher),
        byEvent,
    };
}

// ── report ───────────────────────────────────────────────────────────────────

// Rows of `entries` ([group, rec] pairs) grouped by group + site.
function groupRegistrations(label, entries) {
    const rows = new Map();
    for (const [group, rec] of entries) {
        const key = group + "\u0000" + rec.site;
        let row = rows.get(key);
        if (!row) rows.set(key, (row = { what: label + group, count: 0, "from earlier pages": 0, "added at": rec.site }));
        row.count++;
        if (rec.nav < nav) row["from earlier pages"]++;
    }
    return [...rows.values()];
}

function section(title, rows, empty) {
    if (rows.length) {
        console.log("%c" + title, "font-weight:bold");
        console.table(rows);
    } else {
        console.log(title + " — " + empty);
    }
}

const byEarlier = (a, b) => (b["from earlier pages"] - a["from earlier pages"]) || ((b.alive || b.count || 0) - (a.alive || a.count || 0));

export async function report() {
    if (!started) {
        console.warn(TAG + " not running — call __pixaLeakProbe() first");
        return null;
    }
    // Only Chrome started with --js-flags=--expose-gc has window.gc; otherwise
    // use DevTools' "Collect garbage" before calling this.
    try { if (typeof W.gc === "function") W.gc(); } catch (e) { /* ignore */ }
    // Finalizers run as tasks after the collection.
    await new Promise((r) => setTimeout(r, 300));
    watchEmitter(currentEmitter());

    // Components and elements unmounted since start, still alive.
    const groups = new Map();
    for (const rec of live.values()) {
        let g = groups.get(rec.key);
        if (!g) groups.set(rec.key, (g = { kind: rec.kind, key: rec.key, alive: 0, earlier: 0, pages: new Set(), bytes: 0, at: rec.at }));
        g.alive++;
        g.bytes += rec.bytes;
        if (rec.nav < nav) g.earlier++;
        g.pages.add(rec.nav);
        g.at = rec.at;
    }
    const components = [];
    const elements = [];
    for (const g of groups.values()) {
        if (g.kind === "component") {
            components.push({
                component: g.key,
                alive: g.alive,
                "from earlier pages": g.earlier,
                "unmounted since start": unmounted.get(g.key) || 0,
                "page visits": g.pages.size,
                "unmounted at route": g.at,
            });
        } else {
            elements.push({
                element: g.key,
                alive: g.alive,
                "from earlier pages": g.earlier,
                "approx. MB": mb(g.bytes),
            });
        }
    }
    components.sort(byEarlier);
    elements.sort(byEarlier);

    // Registrations still in place.
    const flat = (map) => {
        const out = [];
        map.forEach((m, group) => m.forEach((rec) => out.push([group, rec])));
        return out;
    };
    const registrations = [
        ...groupRegistrations("", flat(listeners)),
        ...groupRegistrations("api event ", flat(emitterRegs)),
        ...groupRegistrations("dispatcher callback", [...dispatcherRegs.values()].map((rec) => ["", rec])),
        ...groupRegistrations("setInterval", [...intervals.values()].map((rec) => ["", rec])),
    ].sort(byEarlier);

    // Resources.
    const resources = [];
    const resRow = (what, rec, extra) => {
        const key = what + "\u0000" + rec.site;
        let row = resources.find((r) => r._key === key);
        if (!row) resources.push((row = { _key: key, resource: what, count: 0, "from earlier pages": 0, "approx. MB": 0, "created at": rec.site }));
        row.count++;
        if (rec.nav < nav) row["from earlier pages"]++;
        row["approx. MB"] = Math.round((row["approx. MB"] + mb(extra || 0)) * 10) / 10;
    };
    blobs.forEach((rec) => resRow("blob: URL never revoked", rec, rec.bytes));
    for (const c of contexts) {
        const canvas = c.canvas.deref();
        if (!canvas) continue;
        const ctx = c.ctx.deref();
        const gl = /webgl/i.test(c.type);
        const lost = gl && ctx && typeof ctx.isContextLost === "function" ? ctx.isContextLost() : false;
        if (gl && lost) continue; // released its GPU memory
        const where = W.OffscreenCanvas && canvas instanceof W.OffscreenCanvas
            ? "offscreen canvas"
            : canvas.isConnected ? "canvas on screen" : "canvas detached";
        resRow(c.type + " context, " + where + (gl ? " (GPU)" : ""), c, (canvas.width | 0) * (canvas.height | 0) * 4);
    }
    for (const w of workers) {
        const obj = w.ref.deref();
        if (obj && !terminated.has(obj)) resRow("Worker not terminated: " + w.what, w, 0);
    }
    for (const a of audios) {
        const obj = a.ref.deref();
        if (obj && !closedAudio.has(obj) && obj.state !== "closed") resRow("AudioContext not closed", a, 0);
    }
    resources.forEach((r) => delete r._key);
    resources.sort(byEarlier);

    // Totals against the start.
    const now = totals();
    const delta = (k) => ({ "at start": baseline[k], now: now[k], change: baseline[k] == null || now[k] == null ? "" : Math.round((now[k] - baseline[k]) * 10) / 10 });
    const totalRows = {
        "JS heap (MB)": delta("heapMB"),
        "DOM nodes on screen": delta("domNodes"),
        "API emitter listeners": delta("emitterListeners"),
        "dispatcher callbacks": delta("dispatcherCallbacks"),
    };
    const eventRows = Object.keys(now.byEvent)
        .map((ev) => ({ event: ev, "at start": baseline.byEvent[ev] || 0, now: now.byEvent[ev] }))
        .filter((r) => r.now > r["at start"])
        .sort((a, b) => (b.now - b["at start"]) - (a.now - a["at start"]));

    console.group(TAG + " " + nav + " page change(s) since start, now on " + path);
    if (unmountsSeen > 50 && !componentsSeen) {
        console.warn(TAG + " saw unmounts but no component instance on them — not Preact 10? The component rows below are empty for that reason.");
    }
    section("Components unmounted but still alive", components.slice(0, 40), "none: every unmounted component was collected");
    section("Elements unmounted but still alive", elements, "none");
    section("Registrations never removed", registrations.slice(0, 40), "none");
    section("Resources still held", resources.slice(0, 40), "none");
    console.log("%cTotals", "font-weight:bold");
    console.table(totalRows);
    if (eventRows.length) {
        console.log("API emitter events that gained listeners");
        console.table(eventRows);
    }
    if (emitterReplaced) console.info(TAG + " the API was re-initialised since start (node switch): listeners on the old emitter are not listed.");
    console.info(TAG + " read \"from earlier pages\": what grows with every loop you browse is the leak. Rows only on the current page are usually fine.");
    console.groupEnd();

    return { navigations: nav, components, elements, registrations, resources, totals: totalRows, events: eventRows };
}

// ── start ────────────────────────────────────────────────────────────────────

export function start({ dispatcher = null, getEmitter = null } = {}) {
    if (started) {
        console.info(TAG + " already running — __pixaLeaks() prints the report");
        return { report };
    }
    if (typeof FinalizationRegistry !== "function" || typeof WeakRef !== "function") {
        console.warn(TAG + " needs FinalizationRegistry and WeakRef (Chrome 84+)");
        return null;
    }
    started = true;
    sources = { dispatcher, getEmitter };
    registry = new FinalizationRegistry((token) => { live.delete(token); });

    safely(watchNavigation); // first: its own popstate listener stays out of the counts
    safely(hookMount);
    safely(hookUnmount);
    safely(() => watchTarget(W, "window"));
    safely(() => watchTarget(W.document, "document"));
    safely(watchTimers);
    safely(watchBlobs);
    safely(watchCanvas);
    safely(() => watchConstructor("Worker", workers, terminated, "terminate"));
    safely(() => watchConstructor("AudioContext", audios, closedAudio, "close"));
    safely(() => watchConstructor("webkitAudioContext", audios, closedAudio, "close"));
    safely(() => watchDispatcher(dispatcher));
    safely(() => watchEmitter(currentEmitter()));
    baseline = totals();

    W.__pixaLeaks = report;
    console.info(
        TAG + " running. Browse a loop of pages two or three times, come back here, " +
        "click DevTools ▸ Memory ▸ Collect garbage, then run __pixaLeaks()."
    );
    return { report };
}
