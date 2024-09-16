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
//   3. The locale boot hint is applied synchronously, so non-English users
//      get their language on first paint instead of an English flash.
//   4. React.render runs IMMEDIATELY with settings=null. Index was already
//      built for this: normalizeSettings(null) leaves the previous state,
//      settingsRef starts at { _know_the_settings: false }, and every
//      settings-dependent effect is gated on that flag. Settings hydrate
//      through a plain prop update when the I/O resolves (Index's memo
//      comparator keys on `settings`, so the update always lands).
//
// Boot hints (localStorage, written here on every successful settings
// resolution, read synchronously on the next boot):
//   pixa_locale_hint              → raw `locales` code ("fr-FR", …)
//   pixa_api_node_hint            → raw `api_node` id
//   pixa_api_node_custom_url_hint → raw `api_node_custom_url`
// The node hints are consumed by Index.js's apiNodeUrl memo so the very
// first PixaProxyAPI init targets the user's chosen node pre-hydration,
// instead of connecting to the default and re-connecting when settings land.

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
// Index will authoritatively call setLanguage() once settings hydrate; this
// just starts the locale chunk fetch/swap ~one settings-I/O earlier so the
// first paint is already in the user's language. Redundant for "en-US" and
// self-corrects if the hint is ever stale (e.g. language changed mid-session
// last visit): the authoritative call wins.
try {
    const hintedLocale = localStorage.getItem("pixa_locale_hint");
    if (hintedLocale) setLanguage(hintedLocale);
} catch (e) { /* private mode / storage disabled — default-language first paint */ }

// ── (1) Settings I/O — kicked off at evaluation time ─────────────────────────
let _resolvedSettings = null;
let _notifySettings = null;
api.init((response) => {
    _resolvedSettings = response;

    // Refresh the boot hints for the NEXT cold start. Cleared when the value
    // is absent so reverting to defaults doesn't leave a stale hint behind.
    try {
        if (response && response.locales) localStorage.setItem("pixa_locale_hint", response.locales);
        else localStorage.removeItem("pixa_locale_hint");
        if (response && response.api_node) localStorage.setItem("pixa_api_node_hint", response.api_node);
        else localStorage.removeItem("pixa_api_node_hint");
        if (response && response.api_node_custom_url) localStorage.setItem("pixa_api_node_custom_url_hint", response.api_node_custom_url);
        else localStorage.removeItem("pixa_api_node_custom_url_hint");
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