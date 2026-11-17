/*
 * utils/store.js — is this session the Google Play or the App Store app?
 *
 * The same pixagram.com code runs in the browser and inside the store
 * packages PWABuilder generates:
 *
 *   - Google Play: a Trusted Web Activity (TWA). It runs in the user's Chrome
 *     and SHARES Chrome's storage for pixagram.com — cookies, localStorage,
 *     IndexedDB, the settings document included. A store-only restriction
 *     must therefore never be written into the settings document: someone
 *     who also uses pixagram.com in Chrome would lose their web settings.
 *     applyStorePolicy() below only changes the bag handed to the app.
 *   - App Store: PWABuilder's iOS shell, a WKWebView with its own storage.
 *
 * Store builds follow the store's content policies (Google Play: Sexual
 * Content and Profanity, AI-Generated Content; Apple: guidelines 1.1.4 and
 * 1.2). Mature content can't be shown, uploaded or generated there, so:
 *   - utils/settings.js locks the two "show NSFW" settings (applyStorePolicy),
 *   - components/SettingsDialog.js shows them disabled, with a notice,
 *   - components/NewPost.js screens every image that enters the wizard,
 *   - components/PaperCard.js and PostDialog.js hide mature artworks instead
 *     of blurring them (the policy names blurred nudity too).
 *
 * Detection runs once, when this module is evaluated (utils/settings imports
 * it, so: at boot). First match wins:
 *
 *   1. ?pxg_store=play | appstore on the launch URL. Set the Start URL in
 *      PWABuilder's Android options to  /?pxg_store=play  — the parameter
 *      survives every TWA provider, unlike the referrer.
 *   2. document.referrer android-app://com.pixagram… — set by the TWA launcher
 *      on each launch when Chrome hosts the activity (deep links and shortcuts
 *      included). Blank with some other TWA providers, hence 1.
 *   3. PWABuilder's iOS shell: "PWAShell" in the user agent, its
 *      "app-platform" cookie, its app-info://platform/ios-store referrer, or
 *      its native message handlers on window.webkit.
 *   4. This tab already detected a store launch (sessionStorage): reloads and
 *      in-app navigations keep the mode.
 *   5. An installed-app window (display-mode standalone/fullscreen…) on an
 *      Android device that has already launched the Play app (localStorage):
 *      notification taps and captured links that open the TWA without the
 *      start URL or the referrer. A Chrome tab is display-mode "browser", so
 *      the marker never reaches the website itself.
 *
 * There is deliberately no way to switch a detected store session back to
 * the web behaviour.
 */

"use strict";

export const STORE_IDS = Object.freeze({ PLAY: "play", APP_STORE: "appstore" });

// Shown in UI copy, never translated (they are product names).
const STORE_NAMES = Object.freeze({
    [STORE_IDS.PLAY]: "Google Play",
    [STORE_IDS.APP_STORE]: "App Store",
});

// Launch parameter (see 1 above) and the two storage keys.
export const STORE_PARAM = "pxg_store";
const SESSION_KEY = "pxg_store";
const PLAY_SEEN_KEY = "pxg_store_play_seen";

// Package id prefix of the Play app (manifest "id": "com.pixagram"). Matching
// the prefix also covers ids such as com.pixagram.twa. Other apps that open
// pixagram.com in a Custom Tab (Gmail, chat apps…) have their own package in
// the referrer and stay web sessions.
const PLAY_REFERRER_PREFIX = "android-app://com.pixagram";

// Native message handlers registered by PWABuilder's iOS shell (WebView.swift).
const IOS_SHELL_HANDLERS = ["push-permission-request", "push-permission-state", "push-subscribe", "push-token"];

const INSTALLED_DISPLAY_MODES = ["standalone", "fullscreen", "minimal-ui", "window-controls-overlay"];

const normalizeId = (value) => {
    const v = String(value || "").trim().toLowerCase();
    if (v === "play" || v === "googleplay" || v === "google-play" || v === "android") return STORE_IDS.PLAY;
    if (v === "appstore" || v === "app-store" || v === "ios") return STORE_IDS.APP_STORE;
    return null;
};

const safe = (fn, fallback = null) => {
    try { return fn(); } catch (e) { return fallback; }
};

const launchHref = () => safe(() => (typeof window !== "undefined" && window.__pxgLaunchHref) || location.href, "");

const fromLaunchParam = () => safe(() => normalizeId(new URL(launchHref()).searchParams.get(STORE_PARAM)));

const fromAndroidReferrer = () => safe(() => {
    const ref = String(document.referrer || "");
    return ref.indexOf(PLAY_REFERRER_PREFIX) === 0 ? STORE_IDS.PLAY : null;
});

const hasCookie = (name) => safe(() => String(document.cookie || "")
    .split(";")
    .some((part) => part.trim().split("=")[0] === name), false);

const fromIosShell = () => safe(() => {
    const ua = String((typeof navigator !== "undefined" && navigator.userAgent) || "");
    if (/\bPWAShell\b/.test(ua)) return STORE_IDS.APP_STORE;
    if (hasCookie("app-platform")) return STORE_IDS.APP_STORE;
    if (String(document.referrer || "").indexOf("app-info://platform/ios-store") === 0) return STORE_IDS.APP_STORE;
    const handlers = window.webkit && window.webkit.messageHandlers;
    if (handlers && IOS_SHELL_HANDLERS.some((name) => !!handlers[name])) return STORE_IDS.APP_STORE;
    return null;
});

const isInstalledWindow = () => safe(() => typeof window.matchMedia === "function"
    && INSTALLED_DISPLAY_MODES.some((mode) => window.matchMedia("(display-mode: " + mode + ")").matches), false);

const isAndroid = () => safe(() => /Android/i.test(navigator.userAgent || ""), false);

const fromSession = () => safe(() => normalizeId(sessionStorage.getItem(SESSION_KEY)));

const fromPlayMarker = () => safe(() => (
    localStorage.getItem(PLAY_SEEN_KEY) === "1" && isAndroid() && isInstalledWindow() ? STORE_IDS.PLAY : null
));

const remember = (id) => {
    safe(() => sessionStorage.setItem(SESSION_KEY, id));
    // Only an installed-app window may leave the device-wide marker (rule 5):
    // a website link carrying ?pxg_store=play must not mark the device.
    if (id === STORE_IDS.PLAY && isInstalledWindow()) safe(() => localStorage.setItem(PLAY_SEEN_KEY, "1"));
};

const detect = () => {
    if (typeof window === "undefined") return null;
    const fresh = fromLaunchParam() || fromAndroidReferrer() || fromIosShell();
    if (fresh) {
        remember(fresh);
        return fresh;
    }
    return fromSession() || fromPlayMarker();
};

const STORE_ID = detect();

// A hook for CSS and for debugging on a device (document.documentElement
// .dataset.store in the remote inspector).
if (STORE_ID) safe(() => { document.documentElement.setAttribute("data-store", STORE_ID); });

/** "play", "appstore", or null in the browser. Fixed for the page's lifetime. */
export const getStoreId = () => STORE_ID;

/** True in the Google Play and App Store apps. */
export const isStoreBuild = () => STORE_ID !== null;

/** "Google Play" / "App Store" for UI copy, or "" in the browser. */
export const getStoreName = () => (STORE_ID ? STORE_NAMES[STORE_ID] : "");

// ── Settings policy ──────────────────────────────────────────────────────────
// The values a store build runs with, whatever the settings document says:
// sensitive posts filtered out of the feeds (nsfw_filter) and the remaining
// mature artworks hidden (nsfw_enabled = "show NSFW" off). Keys are the raw
// settings-document names, as utils/settings.js stores them.
export const STORE_LOCKED_SETTINGS = Object.freeze({
    nsfw_enabled: false,
    nsfw_filter: true,
});

/**
 * The settings bag the app should run with. In the browser it is `settings`
 * itself; in a store build a copy with STORE_LOCKED_SETTINGS applied. Never
 * persist the result (see the header: the Play app shares Chrome's storage).
 */
export const applyStorePolicy = (settings) => {
    if (!STORE_ID || !settings || typeof settings !== "object") return settings;
    let changed = false;
    for (const key of Object.keys(STORE_LOCKED_SETTINGS)) {
        if (settings[key] !== STORE_LOCKED_SETTINGS[key]) { changed = true; break; }
    }
    return changed ? Object.assign({}, settings, STORE_LOCKED_SETTINGS) : settings;
};

/**
 * A settings patch without the keys a store build may not change. In the
 * browser the patch is returned as is.
 */
export const withoutStoreLockedKeys = (patch) => {
    if (!STORE_ID || !patch || typeof patch !== "object") return patch;
    let copy = null;
    for (const key of Object.keys(STORE_LOCKED_SETTINGS)) {
        if (Object.prototype.hasOwnProperty.call(patch, key)) {
            if (!copy) copy = Object.assign({}, patch);
            delete copy[key];
        }
    }
    return copy || patch;
};

// ── Prompt pre-filter (text-to-image) ────────────────────────────────────────
// A first, cheap gate in front of the image model on the "Create image" tab:
// a description that plainly asks for sexual content is refused before any
// request is sent. The real gate is the classifier run on the generated image
// (components/NewPost.js); this list only catches the obvious requests, so it
// is kept to terms that are unambiguous in every language the app ships
// (no "nu" — "now" in Dutch and Swedish —, no "naga", no "tits", no "裸",
// which is also in 裸足, barefoot).
const MATURE_TERMS = [
    // English
    "nsfw", "nude", "nudes", "nudity", "naked", "topless", "bottomless", "porn", "porno", "pornographic",
    "pornography", "hentai", "xxx", "sex", "sexual", "sexy", "erotic", "erotica", "nipple", "nipples",
    "genital", "genitals", "penis", "vagina", "boobs", "breasts", "lingerie", "undressed",
    "stripper", "striptease", "orgasm", "fetish", "bdsm", "onlyfans", "playboy", "seductive",
    // French
    "nue", "nues", "nudité", "sexe", "sexuel", "sexuelle", "érotique", "seins", "pornographique",
    // German
    "nackt", "nackte", "nackter", "nacktheit", "brüste", "erotisch", "sexuell",
    // Spanish / Portuguese / Italian
    "desnudo", "desnuda", "desnudos", "desnudas", "senos", "erótico", "erótica",
    "nua", "nuas", "seios", "nuda", "nudi", "erotico",
    // Dutch / Scandinavian / Finnish
    "naakt", "naken", "nøgen", "alasti",
    // Czech / Slovak / Russian / Ukrainian
    "nahý", "nahá", "голый", "голая", "голые", "обнаженная", "обнажённая", "секс", "порно",
    "голий", "оголена",
    // Turkish / Indonesian
    "çıplak", "telanjang", "bugil",
    // Japanese / Chinese / Korean (matched as substrings: no word spacing)
    "ヌード", "全裸", "裸体", "裸體", "エロ", "色情", "누드", "알몸", "야한",
];
const CJK_RE = /[぀-ヿ㐀-鿿가-힯]/;
const CJK_TERMS = MATURE_TERMS.filter((term) => CJK_RE.test(term));
const WORD_TERMS = new Set(MATURE_TERMS.filter((term) => !CJK_RE.test(term)));
// Word boundaries without Unicode property escapes (the main bundle still
// targets browsers that predate them): whitespace, digits and punctuation.
const WORD_SPLIT_RE = /[\s0-9.,;:!?¡¿"'“”‘’«»()[\]{}<>/\\|@#$%^&*+=~`_\-–—…]+/;

/** True when `text` plainly asks for mature content (see MATURE_TERMS). */
export const isMaturePrompt = (text) => {
    const value = String(text || "").toLowerCase();
    if (!value.trim()) return false;
    for (const term of CJK_TERMS) {
        if (value.indexOf(term) !== -1) return true;
    }
    const words = (value.normalize ? value.normalize("NFC") : value).split(WORD_SPLIT_RE);
    for (const word of words) {
        if (word && WORD_TERMS.has(word)) return true;
    }
    return false;
};

/** True when a tag or a suggestion should not be offered in a store build. */
export const isMatureTag = (tag) => isMaturePrompt(String(tag || "").replace(/[-_]+/g, " "));
