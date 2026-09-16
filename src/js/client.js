"use strict";

// ═════════════════════════════════════════════════════════════════════════════
// Boot sequencing
// ═════════════════════════════════════════════════════════════════════════════
// The old boot was a strict waterfall — every arrow below was main-thread /
// network IDLE time in which nothing else was allowed to start:
//
//   evaluate main bundle → wait for api.init() (settings I/O)
//     → first React.render → mount effects
//       → only THEN request the pixaproxyapi chunk → evaluate it → connect
//
// New sequence — everything that can start at script evaluation starts there,
// in parallel:
//
//   1. api.init() is kicked off at module scope, so settings I/O overlaps
//      with React's first render instead of preceding it.
//   2. The pixaproxyapi chunk request is fired at module scope, so its
//      download overlaps boot; usePixaAPI's JSLoader import later resolves
//      from the module cache instead of hitting the network post-mount.
//   3. The locale boot hint is applied synchronously — and it is now what
//      starts the ONLY locale fetch of a normal boot. utils/text no longer
//      bundles en.js: every language, English included, is its own chunk,
//      fetched once the language is known. A returning user's chunk request
//      goes out at script evaluation; a first-time visitor's goes out the
//      moment settings resolve (the api.init callback below). Nobody downloads
//      English to have it replaced, and t() answers "" until the chunk lands
//      rather than flashing the wrong language.
//   4. React.render runs IMMEDIATELY with settings=null. Index was already
//      built for this: normalizeSettings(null) leaves the previous state,
//      settingsRef starts at { _know_the_settings: false }, and every
//      settings-dependent effect is gated on that flag. Settings hydrate
//      through a plain prop update when the I/O resolves (Index's memo
//      comparator keys on `settings`, so the update always lands).
//
// Boot hints (localStorage, read synchronously on the next boot):
//   pixa_locale_hint       → raw `locales` code ("fr-FR", …) — written HERE on
//                            every successful settings resolution.
//   pixa_api_node_url_hint → the API endpoint URL — written by utils/settings
//                            itself on every emitted settings bag (init / get /
//                            set, including the boot race's automatic pick), so
//                            it can never lag the document. Index.js reads it
//                            so the very first PixaProxyAPI init targets the
//                            saved node pre-hydration, instead of connecting to
//                            the default and re-connecting when settings land.
// The former id-shaped pair (pixa_api_node_hint / pixa_api_node_custom_url_hint)
// is no longer written; it is cleared below so the fallback path in Index.js
// that still understands it goes quiet after one boot.

import * as api from "./utils/settings";

import * as React from "preact/compat";
import { HISTORY } from "./utils/constants";
import { setLanguage } from "./utils/text";
// Theme
import { ThemeProvider as MuiThemeProvider } from '@material-ui/core/styles';
import CssBaseline from '@material-ui/core/CssBaseline';
import { lightTheme } from "./theme/index";

// Pages
import Index from "../js/pages/Index";

// ── (2) Warm the critical API chunks — fire-and-forget ───────────────────────
// Same module specifiers as the real load paths ⇒ same webpack chunks; these
// only move each request from "after mount effects" (pixaproxyapi) and
// "after pixaproxyapi is fetched, evaluated AND initialize() is entered"
// (sanitizer, dpixa — its Phase 0a imports) to "right now". The chained
// waterfall main → pixaproxyapi → (sanitizer + dpixa) collapses into one
// parallel fan-out at evaluation time. Errors are swallowed: the real
// (retrying) JSLoader paths still own failure handling.
// webpackChunkName gives the chunks stable filenames IF output.chunkFilename
// contains [name] — which is what makes the optional <link rel="preload">
// block in template.html possible; harmlessly ignored otherwise.
import(/* webpackChunkName: "pixaproxyapi" */ "./utils/api/pixaproxyapi.js").catch(() => {});
import(/* webpackChunkName: "sanitizer" */ "./utils/api/sanitizer").catch(() => {});
import(/* webpackChunkName: "dpixa" */ "@pixagram/dpixa/dist/dpixa").catch(() => {});

// ── (3) Locale head start ────────────────────────────────────────────────────
// This call is what fetches the locale chunk for a returning user — there is
// no English baseline in the main bundle to paint first, so the earlier it
// goes out the shorter the blank window. The settings callback and Index will
// each call setLanguage() again with the saved code; an identical request
// shares this one's promise and costs nothing. If the hint is ever stale
// (language changed mid-session last visit) the later call wins — one extra
// chunk, once — and the hint is rewritten below.
//
// No hint (first visit, cleared storage): nothing is fetched yet. Guessing
// from navigator.language would be right on a first visit but wrong for a
// returning user whose stored setting differs from their browser — exactly
// the double download this design exists to avoid — so the fetch waits for
// settings, which resolve a few milliseconds later.
try {
    const hintedLocale = localStorage.getItem("pixa_locale_hint");
    if (hintedLocale) setLanguage(hintedLocale);
} catch (e) { /* private mode / storage disabled — the settings callback starts the fetch */ }

// ── (1) Settings I/O — kicked off at evaluation time ─────────────────────────
let _resolvedSettings = null;
let _notifySettings = null;
api.init((response) => {
    _resolvedSettings = response;

    // The language is known now. Start its chunk from here rather than from
    // Index's settings effect, which runs one React commit later — for a
    // first-time visitor this is the request. With a matching hint above it
    // is the same in-flight promise, not a second request.
    if (response && response.locales) setLanguage(response.locales);

    // Refresh the locale hint for the NEXT cold start. Cleared when the value
    // is absent so reverting to defaults doesn't leave a stale hint behind.
    // The node hint is utils/settings' job now (see the header); the legacy
    // id-shaped pair is removed so nothing reads a stale id again.
    try {
        if (response && response.locales) localStorage.setItem("pixa_locale_hint", response.locales);
        else localStorage.removeItem("pixa_locale_hint");
        localStorage.removeItem("pixa_api_node_hint");
        localStorage.removeItem("pixa_api_node_custom_url_hint");
    } catch (e) { /* non-fatal */ }

    if (_notifySettings) _notifySettings(response);
});

// ── (4) Progressive root ─────────────────────────────────────────────────────
// Covers both orderings: settings resolved before mount (state seeds from
// _resolvedSettings, or the effect catches a resolution that raced between
// render and mount) and settings resolved after mount (the callback feeds
// setSettings directly).
function Root() {
    const [settings, setSettings] = React.useState(_resolvedSettings);
    React.useEffect(() => {
        if (_resolvedSettings) {
            setSettings(_resolvedSettings); // no-op if already seeded
            return;
        }
        _notifySettings = setSettings;
        return () => { if (_notifySettings === setSettings) _notifySettings = null; };
    }, []);
    return (
        <MuiThemeProvider theme={lightTheme}>
            <CssBaseline>
                <Index history={HISTORY} settings={settings}/>
            </CssBaseline>
        </MuiThemeProvider>
    );
}

var app = document.getElementById("app");
if (!app) {
    app = document.createElement("div");
    app.setAttribute("id", "app");
    document.body.appendChild(app);
}
React.render(
    <Root/>,
    app, () => {document.body.setAttribute("datainitiated", "false");});