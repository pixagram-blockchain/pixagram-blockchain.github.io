"use strict";;
import React, {
    Suspense,
    memo,
    useCallback,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    useState,
} from "preact/compat";

import JSLoader from "../utils/JSLoader";
import withStyles from "@material-ui/core/styles/withStyles";
import Slide from "@material-ui/core/Slide";
import Snackbar from "@material-ui/core/Snackbar";
import SwipeableDrawer from "@material-ui/core/SwipeableDrawer";
import Tooltip from "@material-ui/core/Tooltip";
import ClickAwayListener from "@material-ui/core/ClickAwayListener";
import IconButton from "@material-ui/core/IconButton";
import MoreVertIcon from "@material-ui/icons/MoreVert";
import CloseIcon from "@material-ui/icons/Close";
import MenuIcon from "@material-ui/icons/Menu";

import dispatcher from "../dispatcher";
import * as actions from "../actions/utils";
import * as api from "../utils/settings";
import { update_meta_title } from "../utils/meta-tags";
import { PAGE_ROUTES, isPostUrl, hostPageForPostUrl } from "../utils/constants";

import LogoutModal from "../components/LogoutModal";
import MenuContent from "../components/MenuContent";
import ToolbarMenuOption from "../components/ToolbarMenuOption";
import VoteIcon from "../icons/Vote";
import SaleIcon from "../icons/Sale";
import SettingsIcon from "@material-ui/icons/Settings";
import HelpIcon from "@material-ui/icons/Help";
import Button from "@material-ui/core/Button";
import ListSubheader from "@material-ui/core/ListSubheader";
import Popper from "@material-ui/core/Popper";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import List from "@material-ui/core/List";
import Typography from "@material-ui/core/Typography";
import Portal from "@material-ui/core/Portal";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import Backdrop from "@material-ui/core/Backdrop";
import ArrowBackRounded from "@material-ui/icons/ArrowBackRounded";
import Fade from "@material-ui/core/Fade";
import GroupIcon from "@material-ui/icons/Group";
import CircularProgress from "@material-ui/core/CircularProgress";
import shareContent from "../utils/share";
import { idle, cancelIdle } from "../utils/idle";
import getIT from "../data/pixaLogoWhite";
// No static sanitizer import anymore. `safeHTML` was only used to highlight
// the search-term match in usernames/tags via dangerouslySetInnerHTML, and a
// static import here welded the ENTIRE sanitizer module into the entry
// bundle — while client.js dutifully "warmed" it as a lazy chunk that could
// never exist. The highlight is now built from React nodes (highlightNode
// below, same pattern the communities rows already used), which needs no
// sanitizer at all; the sanitizer loads lazily with the API layer.
// Home is the landing route — eagerly imported so it mounts on first paint
// instead of arriving asynchronously after the app shell. Every other page
// stays lazy via PAGE_IMPORTERS below.
import HomeEager from "./Home";

import { T } from "../utils/T";
import { t, setLanguage, subscribe as subscribe_language, useLanguage } from "../utils/text";

const pixaLogoWhite = getIT();

// ── Boot hint (written by utils/settings on every emitted settings bag) ──────
// The app renders BEFORE the async settings load completes, which means
// usePixaAPI kicks off its first connection while `_api_node_url` is still
// unknown. Without a hint that first init would always target the default
// node, then tear down and reconnect the moment settings land for anyone who
// picked a different one. This synchronous localStorage read lets the very
// first init aim at the saved endpoint. Post-hydration, normalizeSettings
// always yields a truthy `_api_node_url`, so the hint only ever applies
// pre-hydration. The legacy id-shaped pair older client.js builds wrote is
// still understood as a fallback (resolved exactly like a legacy settings
// document); absent/unreadable storage falls through to the default.
let BOOT_API_NODE_URL_HINT = null;
try {
    BOOT_API_NODE_URL_HINT = api.normalize_node_url(localStorage.getItem("pixa_api_node_url_hint"));
    if (!BOOT_API_NODE_URL_HINT) {
        const legacyId = localStorage.getItem("pixa_api_node_hint");
        if (legacyId) {
            BOOT_API_NODE_URL_HINT = api.resolve_api_node_url({
                api_node: legacyId,
                api_node_custom_url: localStorage.getItem("pixa_api_node_custom_url_hint") || "",
            });
        }
    }
} catch (e) { /* private mode / storage disabled */ }

// ─── Constants ────────────────────────────────────────────────────────────────

// Route/page Suspense fallback — shown only on a COLD page-chunk load (rare,
// since sibling routes are idle-prefetched). It must NOT be a fixed full-screen
// backdrop: the toolbar is a persistent shell sibling of the page content, so a
// fixed overlay would dim/cover it during the swap. Instead this fills the
// content area below the toolbar with a centered spinner, leaving the shell
// intact. (Was a bare <div/>, i.e. a blank flash.)
const SUSPENSE_FALLBACK = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", width: "100%" }}>
        <CircularProgress />
    </div>
);

// Dialog Suspense fallback — for the shell-level lazy dialog slot, which IS a
// full-screen overlay. A dim backdrop appears instantly on a cold open so the
// action reads as "opening…" instead of blank; the real dialog replaces it once
// its chunk resolves. Warm opens never hit this.
const DIALOG_FALLBACK = (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1300 }} />
);
const DRAWER_TRANSITION = { enter: 125, exit: 75 };
const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
const EMPTY_ARRAY = Object.freeze([]);
const EMPTY_I32 = new Int32Array(0);

// ── Hoisted static props (avoid re-creation inside memoized components) ───
const POPPER_MODIFIERS = Object.freeze({
    flip: { enabled: false },
    preventOverflow: { enabled: true, boundariesElement: "scrollParent" },
    arrow: { enabled: false },
});
const SNACKBAR_TRANSITION_PROPS = Object.freeze({ direction: "up" });
const SNACKBAR_ANCHOR = Object.freeze({ vertical: "bottom", horizontal: "center" });
const SNACKBAR_STYLE = Object.freeze({ zIndex: 2147483647 });

// Aligned with _get_default_settings() in utils/settings.js — that table is
// the source of truth, since its values are what actually get persisted and
// what every resolved settings bag is merged over. These backstops only fill
// keys MISSING from an arriving raw bag, but keeping the two tables identical
// guarantees a first-run user sees no value flip between the pre-hydration
// window and the moment the real bag lands. If you change a default, change
// it in BOTH files.
const SETTINGS_DEFAULTS = {
    activation_enabled: true,
    sfx_enabled: true,
    closed_menu_ads: false,
    renderer: "xbrz",
    payout: "share",
    voting: 100,
    format: "webp",
    mode: "CPU",
    askvote: false,
    voice_enabled: true,
    nsfw_enabled: false,
    nsfw_filter: true,
    toxicity_enabled: true,
    locales: "en-US",
    pdf_page_size: "A4",
    // The node is stored as its URL plus who chose it — see utils/settings.js.
    api_node_url: api.DEFAULT_API_NODE_URL,
    api_node_source: api.API_NODE_SOURCE.DEFAULT,
};

// Which already-mounted page is allowed to host a post URL as an overlay
// without being unmounted. Feed/FeedPersonal/Profile render <PostDialog>;
// Community renders <BlogPostDialog>. A community-post URL pushed from inside
// any of feed/feedpersonal/profile must unmount that page and mount Community
// so the correct dialog can take over (and vice versa).
const OVERLAY_HOSTS_BY_POST_KIND = {
    feed: ["feed", "feedpersonal", "profile"],
    community: ["community"],
};

// ═════════════════════════════════════════════════════════════════════════════
// §0b — First-visit tour (lazy)
// ═════════════════════════════════════════════════════════════════════════════
// Guided tour for first visits to Feed / Community / Profile. The engine
// (components/Tour.js) only ships when a tour actually fires, so returning
// visitors never download it. Seen/skipped state is one localStorage entry:
//   { intro: true, feed: true, community: true, profile: true }
// Completing OR skipping a page's tour marks that page seen; the intro steps
// (menu, governance, info, settings) are prepended once, to whichever
// tourable page is visited first.

const LazyTour = React.lazy(() => import("../components/Tour"));

// Post-publish WebGL logo overlay — only ever mounted AFTER a successful
// broadcast, so its shader/animation code has no business in the main chunk
// (it was pure evaluation weight on every cold start, including for visitors
// who never log in). Conditionally mounted behind Suspense at the bottom of
// the tree; its chunk is warmed in the idle sibling-prefetch chain so the
// post-publish moment never waits on a download.
const LazyPublishLogoLoader = React.lazy(() => import("../components/PublishLogoLoader"));

const TOUR_STORAGE_KEY = "pixagram_tour_v1";
const TOURABLE_PAGES = { feed: true, community: true, profile: true };

function readTourState() {
    try {
        const raw = window.localStorage.getItem(TOUR_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

function writeTourState(patch) {
    try {
        window.localStorage.setItem(
            TOUR_STORAGE_KEY,
            JSON.stringify({ ...readTourState(), ...patch }),
        );
    } catch (e) {}
}

// Dev helper: run window.__pixaResetTour() in the console to replay the tour.
if (typeof window !== "undefined" && !window.__pixaResetTour) {
    window.__pixaResetTour = () => {
        try { window.localStorage.removeItem(TOUR_STORAGE_KEY); } catch (e) {}
    };
}

// Drive a profile tab through its real DOM button so Profile's own handler
// (state + URL rewrite) runs — the tour has no access to the page's state.
function clickProfileTab(i) {
    const tabs = document.querySelectorAll('[data-tour="profile-tabs"] .MuiTab-root');
    if (tabs[i]) tabs[i].click();
}

// On mobile the wallet / write buttons only exist while the profile or
// community card is expanded (Grow + unmountOnExit). If a step's anchor is
// missing, click the card header to expand it — the tour's retry loop then
// picks the button up once it has grown in. On desktop the anchor is always
// mounted (and the toggle isn't), so this is a no-op both ways.
function expandCardIfNeeded(anchorSelector, toggleSelector) {
    try {
        const anchors = document.querySelectorAll(anchorSelector);
        for (let i = 0; i < anchors.length; i++) {
            const r = anchors[i].getBoundingClientRect();
            if (r.width > 1 && r.height > 1) return;
        }
        const toggle = document.querySelector(toggleSelector);
        if (toggle) toggle.click();
    } catch (e) {}
}

// ── Step builders ────────────────────────────────────────────────────────────
// Steps whose anchor isn't in the DOM (wrong layout, or a data-tour attribute
// not wired up yet in a sibling component) are skipped by the engine after a
// short retry, so these lists are safe to build optimistically.
//
// Copy resolves when a tour is ARMED, not at module scope: these builders run
// inside the arming effect, after setLanguage() has swapped the locale bundle
// in, so t() returns the user's language rather than whatever was loaded when
// this module was first parsed.
//
// Where a step points at a labelled control, its title reuses the very key that
// control renders with (words.governance for the governance button, and so on),
// and the sorting blurb interpolates the four tab names instead of repeating
// them. A step can therefore never call a control something the control doesn't
// call itself — including after a translator revises one and not the other.

function buildIntroSteps(compact) {
    if (compact) {
        return [
            {
                target: '[data-tour="nav-menu-button"]',
                title: t("components.tour.your_menu"),
                content: t("components.tour.everything_lives_in_here_log_in_or"),
            },
            {
                target: '[data-tour="nav-more"]',
                title: t("components.tour.more_options"),
                content: t("components.tour.settings_governance_and_app_info_are_tucked"),
            },
        ];
    }
    return [
        {
            target: '[data-tour="menu-login"]',
            placement: "right",
            title: t("components.tour.log_in"),
            content: t("components.tour.sign_in_or_create_an_account_right"),
        },
        {
            target: '[data-tour="menu-communities"]',
            placement: "right",
            title: t("components.tour.communities"),
            content: t("components.tour.the_portals_themed_communities_you_can_browse"),
        },
        {
            target: '[data-tour="menu-categories"]',
            placement: "right",
            title: t("components.tour.categories"),
            content: t("components.tour.tag_chips_that_filter_what_you_see"),
        },
        {
            target: '[data-tour="nav-governance"]',
            title: t("words.governance"),
            content: t("components.tour.pixagram_runs_on_its_own_blockchain_vote"),
        },
        {
            target: '[data-tour="nav-info"]',
            title: t("components.index.info"),
            content: t("components.tour.guides_and_details_about_how_the_platform"),
        },
        {
            target: '[data-tour="nav-settings"]',
            title: t("words.settings"),
            content: t("components.tour.tune_the_interface_content_filters_and_blockchain"),
        },
    ];
}

// Was a module-level const, which froze the English copy at parse time. It has
// to be a call so both the sentence and the four tab names inside it resolve in
// the active locale — and so a locale that reorders the clauses can move the
// placeholders along with them.
const sortingCopy = () => t("components.tour.these_tabs_sort_what_you_see_for", {
    newer: t("words.newer"),
    hottest: t("words.hottest"),
    trending: t("words.trending"),
    promoted: t("words.promoted"),
});

function buildPageSteps(pageName) {
    switch (pageName) {
        case "feed":
            return [
                {
                    target: '[data-tour="feed-tabs"]',
                    title: t("components.tour.sort_the_feed"),
                    content: sortingCopy(),
                },
                {
                    placement: "center",
                    title: t("components.tour.every_post_is_an_artwork"),
                    content: t("components.tour.what_youre_browsing_are_pixel_art_nfts"),
                },
            ];
        case "community":
            return [
                {
                    target: '[data-tour="sorting-tabs"]',
                    title: t("components.tour.sort_the_community"),
                    content: sortingCopy(),
                },
                {
                    target: '[data-tour="community-write"]',
                    title: t("components.tour.write_a_post"),
                    content: t("components.tour.share_your_own_pixel_art_with_this"),
                    onEnter: () => expandCardIfNeeded('[data-tour="community-write"]', '[data-tour="community-card-toggle"]'),
                },
            ];
        case "profile":
            // Titles here are the profile tabs' own labels, so the tooltip and
            // the tab it spotlights always read the same in every locale.
            return [
                {
                    target: '[data-tour="profile-tabs"] .MuiTab-root:nth-child(1)',
                    title: t("components.profile_tabs.posts"),
                    content: t("components.tour.everything_this_user_has_published_their_gallery"),
                    onEnter: () => clickProfileTab(0),
                },
                {
                    target: '[data-tour="profile-tabs"] .MuiTab-root:nth-child(2)',
                    title: t("words.comments"),
                    content: t("components.tour.comments_theyve_written_on_other_peoples_posts"),
                    onEnter: () => clickProfileTab(1),
                },
                {
                    target: '[data-tour="profile-tabs"] .MuiTab-root:nth-child(3)',
                    title: t("components.profile_tabs.replies"),
                    content: t("components.tour.replies_other_people_have_left_them"),
                    onEnter: () => clickProfileTab(2),
                },
                {
                    target: '[data-tour="profile-tabs"] .MuiTab-root:nth-child(4)',
                    title: t("words.history"),
                    content: t("components.tour.their_on_chain_account_activity_votes_transfers"),
                    onEnter: () => clickProfileTab(3),
                },
                {
                    target: '[data-tour="profile-wallet"]',
                    title: t("components.tour.wallet"),
                    content: t("components.tour.balances_and_token_transfers_live_in_the"),
                    onEnter: () => expandCardIfNeeded('[data-tour="profile-wallet"]', '[data-tour="profile-card-toggle"]'),
                },
            ];
        default:
            return [];
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// §1 — Settings normalizer (pure)
// ═════════════════════════════════════════════════════════════════════════════

function normalizeSettings(raw) {
    if (!raw) return null;
    const s = {};
    for (const key of Object.keys(SETTINGS_DEFAULTS)) {
        const val = raw[key];
        const def = SETTINGS_DEFAULTS[key];
        s["_" + key] = typeof def === "boolean"
            ? (val !== undefined ? Boolean(val) : def)
            : (val !== undefined ? val : def);
    }
    s._selected_locales_code = s._locales;
    s._language = s._selected_locales_code.split("-")[0];
    delete s._locales;
    // A raw bag can still arrive in the legacy id shape (api_node +
    // api_node_custom_url, from a store that hasn't been rewritten yet).
    // The shared resolver prefers a valid api_node_url, then maps the legacy
    // id through DEFAULT_NODES, then falls back to the default — so the
    // backstop above never overrides a node the user actually picked.
    s._api_node_url = api.resolve_api_node_url(raw);
    s._know_the_settings = true;
    return s;
}

function settingsChanged(prev, next) {
    if (!prev || !next) return true;
    for (const key of Object.keys(next)) {
        if (key === "_know_the_settings") continue;
        if (prev[key] !== next[key]) return true;
    }
    return false;
}

// ═════════════════════════════════════════════════════════════════════════════
// §2 — Dialog Registry (static, no instance binding)
// ═════════════════════════════════════════════════════════════════════════════

const DIALOG_REGISTRY = {
    wallet: {
        load: () => import("../components/PixaWalletDialog"),
        props: (api, close) => ({ api, open: true, onClose: close }),
        sfxOpen: "state-change_confirm-down",
        sfxClose: "labactive",
    },
    account: {
        load: () => import("../components/CreateAccountDialog"),
        props: (api, close) => ({ open: true, api, onClose: close }),
        sfxOpen: "state-change_confirm-down",
        sfxClose: "labactive",
    },
    add_account: {
        load: () => import("../components/AddAccountDialog"),
        props: (api, close) => ({ open: true, api, onClose: close }),
        sfxOpen: "state-change_confirm-down",
        sfxClose: "labactive",
    },
    login: {
        load: () => import("../components/LoginDialog"),
        props: (api, close, options) => ({
            open: true,
            api,
            onClose: () => close(null),
            onLogin: (result) => close(result),
            // "New Here? Create Account." — close this dialog, then route
            // through the global dispatcher so the ACCOUNT case opens the
            // CreateAccountDialog exactly like every other entry point.
            onOpenCreateAccount: () => {
                close(null);
                dispatcher.dispatch({ type: "ACCOUNT" });
            },
            ...options,
        }),
        sfxOpen: "state-change_confirm-down",
        sfxClose: "labactive",
    },
    unlock: {
        load: () => import("../components/UnlockKeyDialog"),
        props: (api, close, options) => ({
            open: true,
            api,
            onClose: () => close(null),
            onUnlock: (result) => close({ unlocked: true, ...result }),
            onKeyAdded: (result) => close({ keyAdded: true, ...result }),
            ...options,
        }),
        sfxOpen: "state-change_confirm-down",
        sfxClose: "labactive",
    },
    settings: {
        load: () => import("../components/SettingsDialog"),
        props: (api, close, options, settings) => ({
            open: true,
            settings,
            onClose: close,
        }),
        sfxOpen: "state-change_confirm-down",
        sfxClose: "labactive",
    },
    qr: {
        load: () => import("../components/QrScanner"),
        props: (api, close) => ({
            open: true,
            onClose: close,
            onScanResult: close,
        }),
        sfxOpen: "state-change_confirm-down",
        sfxClose: "labactive",
    },
    edit_profile: {
        load: () => import("../components/EditProfileDialog"),
        props: (api, close) => ({
            open: true,
            onClose: close,
            api,
        }),
        sfxOpen: "state-change_confirm-down",
        sfxClose: "labactive",
    },
    witnesses: {
        load: () => import("../components/GovernanceDialog"),
        props: (api, close) => ({ open: true, onClose: close, api }),
    },
    favorites: {
        load: () => import("../components/FavoriteManagerDialog"),
        props: (api, close) => ({ open: true, api, onClose: close }),
        sfxOpen: "state-change_confirm-down",
        sfxClose: "labactive",
    },
    appinfo: {
        load: () => import("../components/AppInfoDialog.js"),
        props: (api, close) => ({ open: true, onClose: close }),
    },
    voting: {
        load: () => import("../components/VotingListModal"),
        // custom props via options
    },
    vote_weight: {
        load: () => import("../components/VoteWeightDialog"),
        // custom props via options
    },
    data_viewer: {
        load: () => import("../components/DataViewerDialog"),
        props: (api, close, options) => ({
            open: true,
            // Pass api + identifiers so the dialog can fetch fresh,
            // un-sanitized data straight from the chain.
            api,
            author: options.author || null,
            permlink: options.permlink || null,
            // Legacy direct-data path: still supported when no identifiers
            // are supplied (e.g. inspecting an arbitrary in-memory object).
            data: options.data || null,
            onClose: close,
        }),
    },
};

// ═════════════════════════════════════════════════════════════════════════════
// §3 — useDialogManager: single-slot dialog system
//
//   Only ONE dialog is ever mounted. Opening a new dialog unmounts the
//   previous one, freeing its component tree and all captured closures.
// ═════════════════════════════════════════════════════════════════════════════

const DIALOG_IDLE = { name: null, Component: null, props: null };

function dialogReducer(state, action) {
    switch (action.type) {
        case "open":
            return {
                name: action.name,
                Component: action.Component,
                props: action.props,
            };
        case "close":
            // Only close if it's the dialog we think is open (prevents stale closes)
            if (state.name === action.name || action.name == null) return DIALOG_IDLE;
            return state;
        default:
            return state;
    }
}

function useDialogManager(apiRef, settingsRef) {
    const [dialog, dispatch] = useReducer(dialogReducer, DIALOG_IDLE);
    const lockRef = useRef(null); // prevents double-open of same dialog
    const cancelledAtRef = useRef(0); // vote-weight cancel suppression
    const dialogNameRef = useRef(null);

    // Passive mirror — no render, just keeps the ref current
    dialogNameRef.current = dialog.name;

    const closeDialog = useCallback((name, result) => {
        const resolvedName = name || dialogNameRef.current;
        const entry = DIALOG_REGISTRY[resolvedName];
        dispatch({ type: "close", name: resolvedName });
        lockRef.current = null;
        if (entry?.sfxClose) actions.trigger_sfx(entry.sfxClose);
        return result;
    }, []); // ← stable: reads dialogNameRef, never closes over dialog.name

    const openDialog = useCallback((name, options = {}) => {
        const entry = DIALOG_REGISTRY[name];
        if (!entry) return;

        // Re-entrance guard
        if (lockRef.current === name) return;
        lockRef.current = name;

        entry.load().then((module) => {
            const Component = module.default;
            const api = apiRef.current;
            const settings = settingsRef.current;

            // Build close handler that can carry a result back to the caller
            const close = (result) => {
                // Propagate result to original caller options
                if (result && options) {
                    if (name === "login" && typeof options.onLogin === "function") {
                        options.onLogin(result);
                    } else if (name === "unlock") {
                        if (result?.unlocked && typeof options.onUnlock === "function") options.onUnlock(result);
                        else if (result?.keyAdded && typeof options.onKeyAdded === "function") options.onKeyAdded(result);
                    }
                }
                closeDialog(name);
            };

            let props;
            if (entry.props) {
                props = entry.props(api, close, options, settings);
            } else {
                // Dialogs with fully custom props (text, voting, vote_weight)
                props = options._resolvedProps || {};
                props.open = true;
                // Auto-inject onClose so the dialog can close itself
                if (!props.onClose) props.onClose = () => closeDialog(name);
            }

            dispatch({ type: "open", name, Component, props });
        }).catch(() => {
            lockRef.current = null;
        });

        if (entry.sfxOpen) actions.trigger_sfx(entry.sfxOpen);
    }, [closeDialog, apiRef, settingsRef]);

    return { dialog, openDialog, closeDialog, cancelledAtRef };
}

// ═════════════════════════════════════════════════════════════════════════════
// §4 — useSnackbar
// ═════════════════════════════════════════════════════════════════════════════

function snackbarReducer(state, action) {
    switch (action.type) {
        case "show":
            return { open: true, message: action.message, duration: action.duration };
        case "hide":
            return { ...state, open: false };
        default:
            return state;
    }
}

function useSnackbar() {
    const [snackbar, dispatch] = useReducer(snackbarReducer, {
        open: false,
        message: "",
        duration: 1975,
    });
    const timerRef = useRef(null);
    const openRef = useRef(false);

    // Keep ref in sync — no extra render, just a passive mirror
    openRef.current = snackbar.open;

    const show = useCallback((message, duration = 1975) => {
        if (openRef.current) {
            dispatch({ type: "hide" });
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                dispatch({ type: "show", message, duration });
            }, 500);
        } else {
            dispatch({ type: "show", message, duration });
        }
    }, []); // ← stable identity: reads openRef, never closes over snackbar.open

    const hide = useCallback((_, reason) => {
        if (reason === "clickaway") return;
        // Kill any pending re-show timer from a queued show() call,
        // otherwise the timer outlives the close and resurrects the snackbar.
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        dispatch({ type: "hide" });
    }, []);

    useEffect(() => () => {
        if (timerRef.current) clearTimeout(timerRef.current);
    }, []);

    return { snackbar, show, hide };
}

// ═════════════════════════════════════════════════════════════════════════════
// §5 — useMediaQuery (replaces resize polling)
// ═════════════════════════════════════════════════════════════════════════════

function useMediaQuery() {
    // matchMedia instead of a debounced resize listener: the change event
    // fires ONLY when the 960px boundary is actually crossed, so ordinary
    // resizes (mobile URL bar show/hide, window drags, on-screen keyboard)
    // run ZERO JS here — the old handler ran a clearTimeout/setTimeout dance
    // on every resize tick and answered 150 ms late on a real crossing.
    // 959.95px is MUI v4's own down("md") boundary.
    const [compact, setCompact] = useState(() => window.matchMedia("(max-width: 959.95px)").matches);

    useEffect(() => {
        const mql = window.matchMedia("(max-width: 959.95px)");
        const handler = (e) => setCompact(e.matches);
        // Older Safari only implements the deprecated addListener pair.
        if (mql.addEventListener) mql.addEventListener("change", handler);
        else mql.addListener(handler);
        setCompact(mql.matches); // catch a crossing between render and mount
        return () => {
            if (mql.removeEventListener) mql.removeEventListener("change", handler);
            else mql.removeListener(handler);
        };
    }, []);

    return compact;
}

// ═════════════════════════════════════════════════════════════════════════════
// §6 — useBlockchainSearch
// ═════════════════════════════════════════════════════════════════════════════

const SEARCH_IDLE = { users: EMPTY_ARRAY, tags: EMPTY_ARRAY, communities: EMPTY_ARRAY, loading: false };

function searchReducer(state, action) {
    switch (action.type) {
        case "loading":
            return { ...state, loading: true };
        case "results":
            return { users: action.users, tags: action.tags, communities: action.communities, loading: false };
        case "reset":
            return SEARCH_IDLE;
        default:
            return state;
    }
}

function useBlockchainSearch(apiRef) {
    const [query, setQuery] = useState("");
    const [results, dispatch] = useReducer(searchReducer, SEARCH_IDLE);
    const debounceRef = useRef(null);
    const abortRef = useRef(null);
    const cacheRef = useRef(new Map());
    // Query-INDEPENDENT list (trending tags only): the per-term cache above
    // only helps when the same term repeats, but this read returns the same
    // payload for EVERY term — it's filtered client-side. Cache it once with
    // the same 10-min TTL so a new search term doesn't re-pay the round-trip.
    // Communities deliberately left this cache: they now go through
    // listCommunities({ query }), whose payload is query-DEPENDENT, so the
    // per-term cache above is the right (and only) cache for them.
    const browseTagsRef = useRef(null);

    const executeSearch = useCallback(async (trimmed) => {
        const pixaAPI = apiRef.current;
        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();
        const { signal } = abortRef.current;

        if (!pixaAPI) {
            dispatch({ type: "reset" });
            return;
        }

        try {
            const now = Date.now();
            const browse = browseTagsRef.current;
            const browseFresh = !!browse && now - browse._ts < 600_000;

            const [usersRaw, tagsRaw, communitiesRaw] = await Promise.allSettled([
                pixaAPI.accounts.lookupAccounts(trimmed, 8),
                browseFresh ? browse.tags : pixaAPI.tags.getTrendingTags(null, 100),
                // Server-side community search: `query` matches title/about on
                // the bridge, so the section follows the typed term instead of
                // echoing the same popular list for every search.
                pixaAPI.communities.listCommunities({ query: trimmed, limit: 10, sort: "rank" }),
            ]);

            if (signal.aborted) return;

            const users = usersRaw.status === "fulfilled" && Array.isArray(usersRaw.value)
                ? usersRaw.value.filter((u) => u.toLowerCase().includes(trimmed))
                : [];

            const tagsAll = tagsRaw.status === "fulfilled" && Array.isArray(tagsRaw.value)
                ? tagsRaw.value
                : [];
            // Already query-matched by the node — no client-side filter.
            const communities = communitiesRaw.status === "fulfilled" && Array.isArray(communitiesRaw.value)
                ? communitiesRaw.value
                : [];

            // Refresh the tags cache only after a real fetch (a cache-served
            // pass would just rewrite the same array with a newer timestamp,
            // silently extending the TTL forever).
            if (!browseFresh && tagsAll.length) {
                browseTagsRef.current = { tags: tagsAll, _ts: now };
            }

            const tags = tagsAll
                .filter((t) => t?.name?.toLowerCase().includes(trimmed) && t.name !== "")
                .slice(0, 10);

            // Cache with eviction
            const cache = cacheRef.current;
            cache.set(trimmed, { users, tags, communities, _ts: Date.now() });
            if (cache.size > 50) cache.delete(cache.keys().next().value);

            dispatch({ type: "results", users, tags, communities });
        } catch (e) {
            if (!signal.aborted) {
                console.warn("[Index] Blockchain search failed:", e.message);
                dispatch({ type: "reset" });
            }
        }
    }, [apiRef]);

    const handleChange = useCallback((e) => {
        const value = e.target.value;
        setQuery(value);

        if (debounceRef.current) clearTimeout(debounceRef.current);

        const trimmed = value.trim().toLowerCase();
        if (!trimmed) {
            dispatch({ type: "reset" });
            return;
        }

        // Check cache (10 min TTL)
        const cached = cacheRef.current.get(trimmed);
        if (cached && Date.now() - cached._ts < 600_000) {
            dispatch({ type: "results", users: cached.users, tags: cached.tags, communities: cached.communities });
            return;
        }
        if (cached) cacheRef.current.delete(trimmed);

        dispatch({ type: "loading" });
        debounceRef.current = setTimeout(() => executeSearch(trimmed), 250);
    }, [executeSearch]);

    const reset = useCallback(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setQuery("");
        dispatch({ type: "reset" });
    }, []);

    useEffect(() => () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (abortRef.current) abortRef.current.abort();
        cacheRef.current.clear();
        browseTagsRef.current = null;
    }, []);

    return { query, results, handleChange, reset, isOpen: query.length > 0 };
}

// ═════════════════════════════════════════════════════════════════════════════
// §7 — useSoundManager
// ═════════════════════════════════════════════════════════════════════════════

function useSoundManager() {
    const play = useCallback((category, pack, name, volume, global) => {
        JSLoader(() => import("../utils/sound-api")).then((sound_api) => {
            sound_api.play_sound(category, pack, name, volume, global);
        });
    }, []);

    const stop = useCallback(() => {
        JSLoader(() => import("../utils/sound-api")).then((sound_api) => {
            sound_api.stop_sound();
        });
    }, []);

    // Stable reference — play & stop have [] deps, so this never recomputes
    return useMemo(() => ({ play, stop }), [play, stop]);
}

// ═════════════════════════════════════════════════════════════════════════════
// §8 — usePageRouter: lazy page loading with proper unload
// ═════════════════════════════════════════════════════════════════════════════

// The old `prefetch` field (and its set_prefetch/clear_prefetch actions) is
// gone: it was the vestige of a retired "mount the next page hidden to warm
// it up" mechanism — nothing dispatched the actions or rendered the field
// anymore. Chunk warming is owned entirely by the two effects in Index
// (Home→Feed warm, idle sibling warm), which fill the module cache without
// mounting anything.
function pageReducer(state, action) {
    switch (action.type) {
        case "set_page":
            return {
                name: action.name,
                element: action.element,
            };
        default:
            return state;
    }
}

// Static import map — one code-split chunk per page. Hoisted to module scope
// so navigation never rebuilds a fresh object of six closures on every call;
// the import() specifiers also stay statically analyzable for the bundler.
const PAGE_IMPORTERS = {
    feed: () => import("./Feed"),
    profile: () => import("./Profile"),
    feedpersonal: () => import("./FeedPersonal"),
    community: () => import("./Community"),
};

// Build the Suspense-wrapped page element. `key` is the resolved page name,
// so React tears down and remounts the entire page subtree (Suspense boundary
// included) on a genuine cross-page navigation, while same-name re-dispatches
// (cold-start re-runs, overlay-host re-renders) reconcile in place instead of
// remounting. settings/pathname are baked in here but ContentComponent re-
// injects both via cloneElement on every render, so the values captured at
// dispatch time only matter for the very first paint of the page.
function makePageElement(Page, settings, pathname, key) {
    return (
        <Suspense key={key} fallback={SUSPENSE_FALLBACK}>
            <Page settings={settings} pathname={pathname} />
        </Suspense>
    );
}

function usePageRouter(history, settingsRef, apiRef) {
    const [page, dispatch] = useReducer(pageReducer, { name: null, element: null });
    const pathnameRef = useRef("");
    const pageNameRef = useRef(null);
    const historyTagsRef = useRef([]);
    const [historyTags, setHistoryTags] = useState([]);
    // Live pathname state — distinct from pathnameRef, which is read
    // synchronously inside navigate() for the old-vs-new comparison. This
    // state drives a re-render so ContentComponent can cloneElement a fresh
    // `pathname` prop into the mounted page on every URL change, including
    // the two early-return overlay paths (post-overlay push and overlay-
    // close-back-to-host) where setPageComponent is intentionally skipped
    // to avoid remounting the host. Without this, the page element captures
    // pathname at setPageComponent time and stays frozen for the rest of
    // its mount — any URL→state effect keyed on the `pathname` prop (tab
    // selection, wallet modal, profile username refetch, community sort)
    // misses the close-dialog transition and renders stale.
    const [livePathname, setLivePathname] = useState("");

    // Keep pageNameRef in sync — passive mirror, no render
    pageNameRef.current = page.name;

    const pushHistoryTag = useCallback((value) => {
        // Build a fresh array; never mutate the ref/state in place.
        const prev = historyTagsRef.current;
        const next = [value, ...prev.filter((t) => t !== value)];
        if (next.length > 20) next.length = 20;
        historyTagsRef.current = next;
        setHistoryTags(next);
    }, []);

    const deleteHistoryTag = useCallback((value) => {
        // Delete by value, not index, to avoid stale-closure mis-deletes
        // when multiple clicks land before the re-render commits.
        const next = historyTagsRef.current.filter((t) => t !== value);
        historyTagsRef.current = next;
        setHistoryTags(next);
    }, []);

    const setPageComponent = useCallback((name, pathname) => {
        const settings = settingsRef.current;
        // Note: `api` is intentionally NOT captured here. makePageElement
        // creates a page element without an `api` prop; ContentComponent
        // injects the live `apiRef.current` via cloneElement on every render.
        // Capturing `currentApi = apiRef.current` at dispatch time used to
        // bake a stale (null) api into the element on cold-entry when the
        // post URL was the landing URL — the post loader fired before the
        // PixaProxyAPI dynamic import had resolved, and multiple racing
        // setPageComponent calls (history.listen initial navigate + locale-
        // settings effect + apiReady-rebuild) could land their dispatches in
        // any order. Whichever dispatch was last wrote its captured `null`
        // (or live api) into the page element, locking the page into that
        // state until the next routing-triggered re-dispatch. Letting
        // ContentComponent be the sole source of `api` removes the race.

        // Update search history for feed/profile
        for (const route of PAGE_ROUTES) {
            if (route.page_name !== name) continue;
            const match = route.page_regex.exec(pathname);
            if (!match) continue;
            let value;
            switch (name) {
                case "feed":
                    // Guard the capture: tagless feed URLs (/created/,
                    // /hot/, …) have no match[2], and "#" + undefined used
                    // to coin the truthy string "#undefined" — which then
                    // polluted historyTags and the search placeholder.
                    if (match[2]) value = "#" + match[2];
                    break;
                case "profile":
                    if (match[1]) value = "@" + match[1];
                    break;
            }
            if (value) pushHistoryTag(value);
        }

        // Home is synchronous: HomeEager is imported at module top-level so the
        // dispatch fires in the same tick as setPageComponent. This guarantees
        // `page.name === "home"` is observable on the initial render and avoids
        // the brief shell-then-home flash a lazy import("./Home") would cause on
        // cold-start. Home takes no `pathname` prop (identical to the previous
        // wiring); the keyed Suspense matches the lazy pages below.
        if (name === "home") {
            dispatch({
                type: "set_page",
                name: "home",
                element: (
                    <Suspense key="home" fallback={SUSPENSE_FALLBACK}>
                        <HomeEager settings={settings} />
                    </Suspense>
                ),
            });
            return;
        }

        // Resolve which page actually mounts. A post URL is the *cold-entry*
        // path (deep-link / refresh on a post URL with nothing mounted yet);
        // once a host page is live, `navigate` keeps the overlay there via
        // OVERLAY_HOSTS_BY_POST_KIND and never re-enters here. A community post
        // (`/portal-N/@a/p`) must cold-mount Community (→ BlogPostDialog); every
        // other post URL cold-mounts Feed (→ PostDialog) so closing the dialog
        // returns to a populated browse surface rather than an author profile
        // the visitor never asked for. The URL alone can't distinguish "from
        // feed" vs "from profile" — both produce /<cat>/@<a>/<p> — and Feed is
        // the better default there.
        const resolvedName = name === "post"
            ? (hostPageForPostUrl(pathname) === "community" ? "community" : "feed")
            : name;

        const importPage = PAGE_IMPORTERS[resolvedName];
        if (!importPage) return;

        // Same-type re-dispatches (the cold-start navigate/locale/apiReady trio,
        // or an overlay-host refresh) reuse the keyed Suspense and reconcile in
        // place; only a real page change swaps the key and forces unmount/mount.
        importPage().then(({ default: Page }) => {
            dispatch({
                type: "set_page",
                name: resolvedName,
                element: makePageElement(Page, settings, pathname, resolvedName),
            });
        });
        // apiRef intentionally NOT in deps: it's a stable ref and, per the note
        // above, is never read here — ContentComponent is the sole api source.
    }, [settingsRef, pushHistoryTag]);

    const navigate = useCallback((newPathname) => {
        const _pathname = String(newPathname || history.location.pathname);
        const oldPathname = String(pathnameRef.current);

        if (_pathname === "/index.html") {
            history.push("/");
            return;
        }

        if (_pathname === oldPathname) return;

        update_meta_title("Pixagram | " + _pathname.replace("/", "").replace(/\//g, " > "));

        const newIsPost = isPostUrl(_pathname);
        const currentPage = pageNameRef.current;

        // Post overlay push — only skip the page swap if the currently mounted
        // page is a valid host for THIS kind of post URL. A community-post URL
        // arriving while Feed is mounted must still swap to Community so that
        // BlogPostDialog (not PostDialog) renders; a regular-feed-post URL
        // arriving while Community is mounted must swap to Feed.
        if (newIsPost) {
            const hostKind = hostPageForPostUrl(_pathname); // "feed" | "community"
            const allowedHosts = OVERLAY_HOSTS_BY_POST_KIND[hostKind] || [];
            if (allowedHosts.includes(currentPage)) {
                pathnameRef.current = _pathname;
                setLivePathname(_pathname);
                return;
            }
        }

        // Resolve which page owns the new URL (first PAGE_ROUTES match wins,
        // matching the precedence used elsewhere in this file).
        let matchedPageName = null;
        for (const route of PAGE_ROUTES) {
            if (route.page_name !== "unknown" && _pathname.match(route.page_regex)) {
                matchedPageName = route.page_name;
                break;
            }
        }

        // Coming back from post overlay to the SAME page — skip re-creation
        // so the host doesn't unmount/remount around the closing dialog.
        // Guarded by BOTH (a) the new URL belongs to the currently mounted
        // page, AND (b) the old post URL was actually hosted by this page
        // (the post overlay genuinely lived here, not on a different page).
        // Either guard failing means we MUST swap pages — falling through
        // to the explicit setPageComponent below. The previous version only
        // checked (a) implicitly via `matchedPageName === currentPage`,
        // which still skipped the swap when (a) was true but the user had
        // navigated to a URL that nominally belongs to a different page —
        // e.g. closing a /community/@user/post overlay back to /@user when
        // PAGE_ROUTES ordering or regex breadth made `/@user` match the
        // community route first. In that case we'd keep Community mounted
        // with pathname=/@user, render an empty shell, and subsequent
        // in-page nav (tab clicks, etc.) would build URLs from Community's
        // logic instead of Profile's — producing artifacts like `/@/comments`.
        if (isPostUrl(oldPathname) && !newIsPost) {
            const oldHostKind = hostPageForPostUrl(oldPathname);
            const oldAllowedHosts = OVERLAY_HOSTS_BY_POST_KIND[oldHostKind] || [];
            if (matchedPageName === currentPage && oldAllowedHosts.includes(currentPage)) {
                pathnameRef.current = _pathname;
                setLivePathname(_pathname);
                return;
            }
        }

        // Page swap. Use the SINGLE matched page (first-match wins), not a
        // loop over every matching route. The original loop here called
        // setPageComponent for every route the URL touched and didn't break;
        // when multiple routes happened to match (e.g. broad community regex
        // catching profile URLs), it kicked off multiple async imports whose
        // dispatch order was non-deterministic — the wrong page could end up
        // mounted depending on which import resolved last.
        if (matchedPageName) {
            setPageComponent(matchedPageName, _pathname);
        }
        pathnameRef.current = _pathname;
        setLivePathname(_pathname);
    }, [history, setPageComponent]); // ← page.name removed, reads pageNameRef

    // Listen to history changes — registers ONCE (navigate is now stable)
    useEffect(() => {
        const unlisten = history.listen((h) => {
            requestAnimationFrame(() => navigate(h.location.pathname));
        });
        // Initial navigation
        navigate(history.location.pathname);
        return unlisten;
    }, [history, navigate]);

    return {
        page,
        historyTags,
        deleteHistoryTag,
        navigate,
        pathnameRef,
        livePathname,
        setPageComponent,
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// §9 — usePixaAPI: API lifecycle
// ═════════════════════════════════════════════════════════════════════════════

function usePixaAPI(apiRef, settingsRef, openDialog, showSnackbar, nodeUrl) {
    const [apiReady, setApiReady] = useState(false);
    // apiGeneration counts successful connections AFTER the first: 0 for the
    // whole boot, +1 for every node switch that came up. The render tree keys
    // the api consumers on it (page content, menu, drawer), so a switch
    // REMOUNTS them onto the new instance once it is ready. Passing a new
    // `api` prop alone was not enough: pages fetch with `this.props.api` on
    // mount and the menu caches the account, so they kept talking to the
    // retired instance until the next navigation. Bumping only after
    // initialize() resolves means the remount never sees a null api, and
    // not bumping on the first connection keeps boot at a single mount.
    const [apiGeneration, setApiGeneration] = useState(0);
    const connectionsRef = useRef(0);
    const handlersRef = useRef([]); // tracks { event, fn } for cleanup

    useEffect(() => {
        let cancelled = false;

        JSLoader(() => import("../utils/api/pixaproxyapi.js")).then(({ PixaProxyAPI }) => {
            if (cancelled) return;
            const pixaAPI = new PixaProxyAPI();
            apiRef.current = pixaAPI;

            // Helper: register + track for cleanup. Guarded on `cancelled` too,
            // so a superseded invocation (e.g. the node changed again before
            // this one finished) can never push a listener into the next
            // invocation's tracking array.
            const on = (event, fn) => {
                if (cancelled) return;
                pixaAPI.eventEmitter.on(event, fn);
                handlersRef.current.push({ event, fn });
            };

            (async () => {
                try {
                    await pixaAPI.initialize({ nodes: [nodeUrl] });
                    if (cancelled) return;
                    connectionsRef.current += 1;
                    setApiReady(true);
                    if (connectionsRef.current > 1) setApiGeneration((g) => g + 1);

                    pixaAPI.askVote = settingsRef.current?._askvote !== false;
                    pixaAPI.defaultVotingPower = parseInt(settingsRef.current?._voting, 10) || 100;

                    on("pin_required", (data) => {
                        openDialog("unlock", {
                            mode: "pin",
                            username: data.account,
                            requiredKeyType: data.type || "posting",
                            actionDescription: data.reason || "Security Check Required",
                            allowModeSwitch: true,
                            onUnlock: async (result) => {
                                try {
                                    const keyManager = apiRef.current.keyManager;
                                    const keyType = data.type || result.keyType || "posting";
                                    const cacheKey = `${data.account}_${keyType}`;
                                    const cachedEntry = keyManager.sessionKeys.get(cacheKey);
                                    if (cachedEntry && data.keyCallback) {
                                        const decrypted = await keyManager._decryptFromCache(cachedEntry);
                                        if (decrypted) await data.keyCallback(decrypted);
                                    }
                                } catch (e) {
                                    console.error("[pin_required] onUnlock error:", e);
                                    showSnackbar(e.message || "Unlock failed", 3000);
                                }
                            },
                            onKeyAdded: async (result) => {
                                if (data.keyCallback && result.key) {
                                    try { await data.keyCallback(result.key); }
                                    catch (e) { showSnackbar(e.message || "Failed to process key", 3000); }
                                }
                            },
                        });
                    });

                    on("key_required", (data) => {
                        openDialog("unlock", {
                            mode: "addKey",
                            username: data.account,
                            requiredKeyType: data.type,
                            actionDescription: t("components.index.permission_required_for_action", {
                                type: data.type
                            }),
                            keyMissing: true,
                            onKeyAdded: async (result) => {
                                if (data.callback && result.key) {
                                    try { await data.callback(result.key, result.save || false, false); }
                                    catch (e) { showSnackbar(e.message, 4000); }
                                }
                            },
                        });
                    });

                    on("vote_weight_required", (eventData) => {
                        const { voter, author, permlink, weight, defaultVotingPower, broadcast, cancel } = eventData;
                        openDialog("vote_weight", {
                            _resolvedProps: {
                                // `api` + `voter` drive the dialog's live value
                                // estimate (reward fund / dgp / feed reads and the
                                // voter's vesting shares + mana — utils/voteValue).
                                api: pixaAPI,
                                voter,
                                author,
                                permlink,
                                weight,
                                defaultVotingPower,
                                onBroadcast: async (finalWeight) => {
                                    // Success toast is shown centrally via the
                                    // 'vote_done' event below (covers the dialog
                                    // AND direct paths, exactly once) — don't show
                                    // a second one here.
                                    return await broadcast(finalWeight);
                                },
                                onCancel: () => {
                                    if (typeof cancel === "function") cancel();
                                },
                            },
                        });
                    });

                    // Single source of truth for the post-vote toast. Fires once
                    // per successful broadcast on every path (dialog or direct);
                    // never fires on cancel. Components must NOT show their own.
                    on("vote_done", ({ outcome }) => {
                        const msg = outcome === "positive" ? "Upvoted successfully"
                            : outcome === "negative" ? "Downvoted successfully"
                                : outcome === "withdrawal" ? "Vote removed"
                                    : null;
                        if (msg) showSnackbar(msg, 2000);
                    });

                    on("session_restored", (data) => {
                        const user = data.account || data.session?.account;
                        if (user) showSnackbar(t("components.index.welcome_back", {
                            user: user
                        }), 3000);
                    });

                    if (cancelled) return;
                    const sessionState = await pixaAPI.restoreSession();
                    if (cancelled) return;

                    // Single snackbar policy on login: the `session_restored`
                    // event above already fires "Welcome back, @user". The
                    // resolved sessionState here was producing a second
                    // "Session active" snackbar that the event-driven one
                    // had already covered, so we no longer show it.
                    if (sessionState?.needsPIN) {
                        openDialog("unlock", {
                            mode: "pin",
                            username: sessionState.account,
                            actionDescription: "Unlock your secure vault to restore session",
                            onUnlock: async (result) => {
                                await pixaAPI.initializeVault(result.pin || result);
                                await pixaAPI.restoreSession();
                            },
                        });
                    }
                } catch (e) {
                    if (cancelled) return;
                    console.error("API Init failed", e);
                    showSnackbar(t("components.index.failed_to_initialize_blockchain_connection"), 5000);
                }
            })();
        });

        return () => {
            cancelled = true;
            setApiReady(false);
            // Detach all registered event listeners from the outgoing instance,
            // then retire it. This cleanup runs both on unmount AND right
            // before a re-init when `nodeUrl` changes below — that's what makes
            // switching the API node in Settings actually swap the live
            // connection, instead of only taking effect on the next full page
            // load. release() stops the instance's background work
            // (connectivity heartbeat, offline broadcast drain, key cache)
            // WITHOUT ending the user's session — disconnect() would, it is
            // the logout path — and keeps the client object so a consumer
            // that hasn't been remounted onto the replacement yet fails soft.
            const api = apiRef.current;
            if (api?.eventEmitter) {
                for (const { event, fn } of handlersRef.current) {
                    api.eventEmitter.off(event, fn);
                }
            }
            handlersRef.current = [];
            apiRef.current = null;
            if (api && typeof api.release === "function") {
                try { api.release(); } catch (e) { /* retired instance — nothing to recover */ }
            }
        };
    }, [nodeUrl]); // Re-instantiate whenever the resolved node URL changes

    return { apiReady, apiGeneration };
}

// ═════════════════════════════════════════════════════════════════════════════
// §10 — Memoized sub-components with comparison functions
// ═════════════════════════════════════════════════════════════════════════════

// ── Wordmark ──────────────────────────────────────────────────────────────────

const Wordmark = React.memo(
    ({ classes, onGoHome }) => {
        useLanguage();
        return (
            <React.Fragment>
                <Fade in timeout={400}>
                    <img onClick={onGoHome} className={classes.toolbarImage} src={pixaLogoWhite} />
                </Fade>
                <span className={classes.toolbarTitleWrapper} onClick={onGoHome}>
                <Fade in timeout={600}>
                    <span className={classes.toolbarTitle}>PIXAGRAM</span>
                </Fade>
                <Fade in timeout={700}>
                    <span className={classes.toolbarSubtitle}>{t("components.index.omnibus_carpe_diem_aeternum_crea")}</span>
                </Fade>
            </span>
            </React.Fragment>
        );
    },
    (prev, next) => prev.classes === next.classes && prev.onGoHome === next.onGoHome,
);

// ── SearchResults (extracted from toolbar for isolation) ──────────────────────

// Case-insensitive first-match highlight built from React nodes. Replaces the
// old innerHTML path (per-row `new RegExp` + safeHTML + dangerouslySetInnerHTML):
// account names and tags are chain-restricted character sets, but the node form
// needs no sanitizer at all — it renders any input literally by construction —
// and it is what let the static sanitizer import above be deleted.
const highlightNode = (text, query) => {
    const s = String(text);
    const at = query ? s.toLowerCase().indexOf(String(query).toLowerCase()) : -1;
    if (at === -1) return s;
    return (
        <React.Fragment>
            {s.slice(0, at)}
            <b style={{ color: "#ffffff" }}>{s.slice(at, at + query.length)}</b>
            {s.slice(at + query.length)}
        </React.Fragment>
    );
};

const SearchResults = React.memo(
    ({
         classes, searchInputText, usersFound, tagsFound, communitiesFound,
         searchLoading, searchInput, history,
         onGoToUsername, onGoToTag, onGoToCommunity, onSetTagNavigation,
     }) => {
        useLanguage();
        return (
            <Popper
                open
                placement="bottom-start"
                className={classes.searchBarOpenMenu}
                disablePortal
                anchorEl={searchInput}
                modifiers={POPPER_MODIFIERS}
            >
                <div
                    className={classes.searchBarResult}
                    style={{ width: searchInput.width ? `${searchInput.width}px` : "100%" }}
                >
                    {searchLoading ? (
                        <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}>
                            <CircularProgress size={24} style={{ color: "#666" }} />
                        </div>
                    ) : (usersFound.length || tagsFound.length || communitiesFound.length) ? (
                        <List dense>
                            {usersFound.length > 0 && (
                                <ListSubheader className={classes.subheaderSticky}>{t("components.index.users")}</ListSubheader>
                            )}
                            {usersFound.map((username) => (
                                <ListItem key={"@" + username}>
                                    <ListItemText
                                        className={classes.listItemText}
                                        onClick={() => onGoToUsername(username)}
                                        primary={
                                            <span style={{ color: "#bbb" }}>@{highlightNode(username, searchInputText)}</span>
                                        }
                                    />
                                </ListItem>
                            ))}

                            <ListSubheader className={classes.subheaderSticky}>{t("words.tags")}</ListSubheader>
                            {[{ name: searchInputText, isExact: true }]
                                .concat(tagsFound.filter((t) => t.name !== searchInputText).map((t) => ({ ...t, isExact: false })))
                                .map((tag) => (
                                    <ListItem key={"#" + tag.name}>
                                        <ListItemText
                                            className={classes.listItemText}
                                            onClick={() => onGoToTag(tag.name)}
                                            primary={
                                                <span style={{ color: "#bbb" }}>
                                                    #{tag.isExact ? tag.name : highlightNode(tag.name, searchInputText)}
                                                </span>
                                            }
                                        />
                                    </ListItem>
                                ))}

                            {communitiesFound.length > 0 && (
                                <ListSubheader className={classes.subheaderSticky}>{t("components.index.communities")}</ListSubheader>
                            )}
                            {communitiesFound.map((community) => {
                                const title = community.title || community.name;
                                // Same match-highlight as users/tags, but built
                                // from React nodes instead of innerHTML: titles
                                // are free on-chain text (unlike account names
                                // and tags they may contain markup-looking
                                // characters) and must keep rendering literally.
                                // A miss (query matched `about`, not the title)
                                // simply renders the plain title.
                                const matchAt = title.toLowerCase().indexOf(searchInputText.toLowerCase());
                                const titleNode = matchAt === -1 ? title : (
                                    <React.Fragment>
                                        {title.slice(0, matchAt)}
                                        <b style={{ color: "#ffffff" }}>{title.slice(matchAt, matchAt + searchInputText.length)}</b>
                                        {title.slice(matchAt + searchInputText.length)}
                                    </React.Fragment>
                                );
                                return (
                                    <ListItem key={"c-" + community.name}>
                                        <ListItemText
                                            className={classes.listItemText}
                                            onClick={() => onGoToCommunity(community.name)}
                                            primary={
                                                <span style={{ color: "#bbb", display: "flex", alignItems: "center", gap: 6 }}>
                                                <GroupIcon style={{ fontSize: 16, color: "#666" }} />
                                                <span>{titleNode}</span>
                                                    {community.subscribers != null && (
                                                        <span style={{ color: "#555", fontSize: "0.8em", marginLeft: "auto" }}>
                                                        {community.subscribers} subs
                                                    </span>
                                                    )}
                                            </span>
                                            }
                                        />
                                    </ListItem>
                                );
                            })}
                            {history}
                        </List>
                    ) : (
                        <React.Fragment>
                            <Typography
                                style={{ margin: "12px 8px 12px 8px", color: "#999999" }}
                                variant="body2"
                                component="p"
                            ><T
                                k="components.index.no_result_found_for_0_0"
                                vars={{
                                    searchInputText: searchInputText
                                }}
                                slots={[<span
                                    style={{ textDecoration: "underline", cursor: "pointer" }}
                                    onClick={() => onSetTagNavigation(searchInputText)}
                                    key="0" />]} /></Typography>
                            <List dense>{history}</List>
                        </React.Fragment>
                    )}
                </div>
            </Popper>
        );
    },
    (prev, next) =>
        prev.searchInputText === next.searchInputText &&
        prev.searchLoading === next.searchLoading &&
        prev.usersFound === next.usersFound &&
        prev.tagsFound === next.tagsFound &&
        prev.communitiesFound === next.communitiesFound &&
        prev.searchInput === next.searchInput &&
        prev.history === next.history,
);

// ── ToolbarComponent ─────────────────────────────────────────────────────────

const ToolbarComponent = React.memo(
    ({
         classes, compact, wordmark,
         searchOpen, searchInputText, searchBarPlaceholder,
         searchInput, searchResults, searchLoading, history,
         onOpenMenuDrawer, onResetSearch, onSearchChange,
         onGoHome, onGoToUsername, onGoToTag, onGoToCommunity,
         onSetTagNavigation, onSetSearchBarRef,
         onIco, onWitnesses, onAppinfo, onSettings, onToolbarMenu,
     }) => {
        useLanguage();
        return (
            <div className={classes.toolbar}>
                <Fade in timeout={200}>
                    <IconButton className={classes.toolbarMenu} onClick={onOpenMenuDrawer} data-tour="nav-menu-button">
                        <MenuIcon />
                    </IconButton>
                </Fade>
                {compact ? null : wordmark}
                <ClickAwayListener onClickAway={onResetSearch}>
                    <div className={classes.searchBarWrapper}>
                        <Fade in timeout={600}>
                            <div
                                className={searchOpen ? classes.searchBarOpen : classes.searchBar}
                                ref={onSetSearchBarRef}
                            >
                                <input
                                    className={classes.searchInput}
                                    type="text"
                                    value={searchInputText}
                                    placeholder={searchBarPlaceholder}
                                    onChange={onSearchChange}
                                />
                                <IconButton
                                    className={classes.searchButton}
                                    onClick={() => searchInputText.length ? onResetSearch() : onGoHome()}
                                >
                                    {searchOpen ? <CloseIcon /> : <ArrowBackRounded />}
                                </IconButton>
                            </div>
                        </Fade>
                        {searchOpen && (
                            <SearchResults
                                classes={classes}
                                searchInputText={searchInputText}
                                usersFound={searchResults.users}
                                tagsFound={searchResults.tags}
                                communitiesFound={searchResults.communities}
                                searchLoading={searchLoading}
                                searchInput={searchInput}
                                history={history}
                                onGoToUsername={onGoToUsername}
                                onGoToTag={onGoToTag}
                                onGoToCommunity={onGoToCommunity}
                                onSetTagNavigation={onSetTagNavigation}
                            />
                        )}
                    </div>
                </ClickAwayListener>
                <Tooltip title={t("components.index.exclusive_discount_for_a_limited_time_only")}>
                    <Button className={classes.toolbarPrimaryButton} onClick={onIco}>
                        <SaleIcon className={classes.icoSaleHidden} />
                        <span>{t("words.shop", {TUC: true})} </span>
                        <span className={classes.icoSaleHidden}>{t("words.now", {TUC: true})}</span>
                    </Button>
                </Tooltip>
                <div className={classes.toolbarMenuButtons}>
                    <Fade in timeout={600}>
                        <Tooltip title={t("components.index.elect_the_blockchain_guardians")}>
                            <Button className={classes.toolbarSecondaryButton} onClick={onWitnesses} data-tour="nav-governance">
                                <VoteIcon /> <span className="text">{t("words.governance")}</span>
                            </Button>
                        </Tooltip>
                    </Fade>
                    <Fade in timeout={800}>
                        <Tooltip title={t("components.index.navigate_through_the_information")}>
                            <Button className={classes.toolbarSecondaryButton} onClick={onAppinfo} data-tour="nav-info">
                                <HelpIcon /> <span className="text">{t("components.index.info")}</span>
                            </Button>
                        </Tooltip>
                    </Fade>
                    <Fade in timeout={900}>
                        <Tooltip title={t("components.index.open_the_settings_panel")}>
                            <IconButton
                                style={{ marginLeft: 8 }}
                                className={classes.toolbarSettingsButton}
                                onClick={onSettings}
                                data-tour="nav-settings"
                            >
                                <SettingsIcon />
                            </IconButton>
                        </Tooltip>
                    </Fade>
                </div>
                <Fade in timeout={900}>
                    <IconButton className={classes.toolbarMenuVert} onClick={onToolbarMenu} data-tour="nav-more">
                        <MoreVertIcon />
                    </IconButton>
                </Fade>
            </div>
        );
    },
    (prev, next) =>
        prev.compact === next.compact &&
        prev.searchOpen === next.searchOpen &&
        prev.searchInputText === next.searchInputText &&
        prev.searchBarPlaceholder === next.searchBarPlaceholder &&
        prev.searchResults === next.searchResults &&
        prev.searchLoading === next.searchLoading &&
        // wordmark, searchInput and history are rendered here (or passed
        // straight into SearchResults) and CAN change identity: history
        // (the memoized history dropdown) is rebuilt whenever historyTags
        // change, and searchInput (the search-bar anchor el) is set on mount.
        // Omitting them let the toolbar bail out of a re-render and feed a
        // stale `history`/anchor down to SearchResults — whose own comparator
        // never gets a chance to run. All the on* callbacks are stable
        // (useCallback with ref-backed deps), so they're deliberately left
        // out: comparing them would only add work, never catch a real change.
        prev.wordmark === next.wordmark &&
        prev.searchInput === next.searchInput &&
        prev.history === next.history &&
        prev.classes === next.classes,
);

// ── MenuLeftComponent ────────────────────────────────────────────────────────

const MenuLeftComponent = React.memo(
    ({ classes, closedMenuAds, pixaAPI }) => (
        <div className={classes.menuLeft} data-tour="nav-menu">
            <Fade in timeout={1200}>
                <MenuContent closed_menu_ads={closedMenuAds} pixaAPI={pixaAPI} />
            </Fade>
        </div>
    ),
    (prev, next) =>
        prev.closedMenuAds === next.closedMenuAds &&
        prev.pixaAPI === next.pixaAPI &&
        prev.classes === next.classes,
);

// ── ContentComponent ─────────────────────────────────────────────────────────
// Settings, pathname, and api are injected via cloneElement into the page
// component (the child inside the Suspense wrapper) on every render, so
// changes propagate through normal React re-rendering — no async import /
// page-rebuild needed.
//
// pathname is injected here (rather than only baked into the page element at
// setPageComponent time) so the two overlay paths in `navigate` that
// intentionally skip remounting the host page still feed a fresh pathname
// down to the page on every URL change.
//
// api is injected from `apiRef.current` (the live ref shared with usePixaAPI)
// rather than only baked at setPageComponent time, because the PixaProxyAPI
// instance is constructed asynchronously: on cold-entry to a deep URL,
// setPageComponent runs in the same effect tick that kicks off the proxy
// API's dynamic import, so apiRef.current is still null when the page
// element is created. Index's apiReady-rebuild then dispatches a fresh
// element with the now-non-null api — but in practice that path can race
// or skip a render under React batching, leaving the mounted page with a
// stale `api=null` prop. Reading `apiRef.current` at every cloneElement
// render bypasses all of that: pages always see the latest api as soon as
// the host re-renders for any reason (apiReady flip, settings load, URL
// change). apiReady is in the dep array so a readiness flip alone forces
// a re-render even when nothing else moves.

// `renderNonce` is accepted but never read. Its only job is to be different on
// every settings/language update so React.memo()'s shallow compare cannot swallow the
// re-render — `settings` keeps a stable identity by design, so without this a
// settings change could leave the page painted with the previous values.
// `apiGeneration` is the key of the content wrapper. It only moves when a
// node switch has connected (see usePixaAPI), and a new key remounts the
// page: Feed/Profile/Community fetch through `this.props.api` when they
// mount, so this is what makes the freshly-chosen endpoint the one every
// request actually goes to — a changed `api` prop on an already-mounted page
// would leave its loaded data and pending pagination on the retired instance.
const ContentComponent = React.memo(
    ({ classes, pageElement, settings, pathname, apiRef, apiReady, apiGeneration, renderNonce }) => {
        useLanguage();
        if (!pageElement) {
            return <div className={classes.content} style={{ background: "#1a1a1a" }} />;
        }
        // pageElement is <Suspense><Feed .../></Suspense> — clone the inner
        // child with fresh settings + pathname + api, then wrap it back in
        // the Suspense.
        const inner = pageElement.props?.children;
        if (inner) {
            const overrides = {};
            if (settings) overrides.settings = settings;
            if (pathname) overrides.pathname = pathname;
            const liveApi = apiRef?.current;
            if (liveApi) overrides.api = liveApi;
            const updated = Object.keys(overrides).length
                ? React.cloneElement(inner, overrides)
                : inner;
            return (
                <div key={apiGeneration} className={classes.content} style={{ background: "#1a1a1a" }}>
                    {React.cloneElement(pageElement, null, updated)}
                </div>
            );
        }
        return (
            <div key={apiGeneration} className={classes.content} style={{ background: "#1a1a1a" }}>
                {pageElement}
            </div>
        );
    },
    (prev, next) =>
        prev.pageElement === next.pageElement &&
        prev.classes === next.classes &&
        prev.settings === next.settings &&
        prev.pathname === next.pathname &&
        prev.apiRef === next.apiRef &&
        prev.apiReady === next.apiReady &&
        prev.apiGeneration === next.apiGeneration,
);

// ── DialogSlot: renders exactly one dialog (or nothing) ──────────────────────

const DialogSlot = React.memo(
    ({ dialog }) => {
        useLanguage();
        if (!dialog.Component) return null;
        const { Component, props } = dialog;
        return (
            <Suspense fallback={DIALOG_FALLBACK}>
                <Component {...props} />
            </Suspense>
        );
    },
    (prev, next) =>
        prev.dialog.name === next.dialog.name &&
        prev.dialog.Component === next.dialog.Component &&
        prev.dialog.props === next.dialog.props,
);

// ── DrawerSlot: compact-only SwipeableDrawer, isolated from the main tree ────
// Renders nothing when not compact, so desktop users pay zero cost for it.
// Memoized so toolbar/search/page churn doesn't re-render the drawer subtree —
// the drawer only updates when its own props (open state, ads flag, api) move.
// CSS `contain: layout style` is applied via styles.drawerPaper to stop
// drawer-internal layout changes from invalidating the host page.
const DRAWER_WORDMARK_WRAPPER_STYLE = Object.freeze({ marginTop: 8 });
const DRAWER_CLASSES_CACHE = new WeakMap();
function getDrawerClasses(classes) {
    let entry = DRAWER_CLASSES_CACHE.get(classes);
    if (!entry) {
        entry = { root: classes.swipeableDrawer, paper: classes.drawerPaper };
        DRAWER_CLASSES_CACHE.set(classes, entry);
    }
    return entry;
}

const DrawerSlot = React.memo(
    ({ compact, classes, wordmark, drawerOpen, onOpen, onClose, closedMenuAds, pixaAPI }) => {
        useLanguage();
        if (!compact) return null;
        return (
            <SwipeableDrawer
                disablePortal={false}
                keepMounted={true}
                transitionDuration={DRAWER_TRANSITION}
                anchor="left"
                classes={getDrawerClasses(classes)}
                open={drawerOpen}
                onOpen={onOpen}
                onClose={onClose}
            >
                <div style={DRAWER_WORDMARK_WRAPPER_STYLE}>{wordmark}</div>
                {/* inDrawer disables the menu's horizontal panel swiping so
                    it can't fight the SwipeableDrawer's own swipe gesture;
                    the desktop MenuLeft instance keeps swiping enabled. */}
                <MenuContent closed_menu_ads={closedMenuAds} pixaAPI={pixaAPI} inDrawer />
            </SwipeableDrawer>
        );
    },
    (prev, next) =>
        prev.compact === next.compact &&
        prev.drawerOpen === next.drawerOpen &&
        prev.closedMenuAds === next.closedMenuAds &&
        prev.pixaAPI === next.pixaAPI &&
        prev.wordmark === next.wordmark &&
        prev.classes === next.classes,
);

// ── RootAnimationOverlay: the home→app fade overlay ──────────────────────────
// Mounted only while its one-shot fade is actually playing. It used to be a
// PERMANENT sibling of the tree: a display:none div on home, and — on app
// pages — the 200%×200% fixed gradient div left in the DOM forever after its
// 750ms animation (opacity 0, but still a composited will-change layer). That
// also made the "home→app" fade play on COLD entries straight into feed /
// profile / community, where there is no home to fade from. Now:
//   - home, and cold app entries: nothing is mounted at all;
//   - a real home→app flip mounts the animating div IN THE SAME COMMIT that
//     swaps the shells (transition is detected during render via refs — an
//     effect would mount it a frame late and flash the naked app first);
//   - animationend unmounts it, releasing the compositor layer, with a timer
//     safety net in case the event never fires (hidden-tab throttling edges).
const RootAnimationOverlay = React.memo(
    ({ classes, isHome }) => {
        const wasHomeRef = useRef(isHome);
        const playingRef = useRef(false);
        const [, forceRender] = useReducer((n) => n + 1, 0);
        if (wasHomeRef.current !== isHome) {
            wasHomeRef.current = isHome;
            // home→app starts the fade; app→home kills any in-flight one.
            playingRef.current = !isHome;
        }
        const stop = useCallback(() => {
            if (!playingRef.current) return;
            playingRef.current = false;
            forceRender();
        }, []);
        useEffect(() => {
            if (!playingRef.current) return;
            const t = setTimeout(stop, 1500); // 750ms anim + 5ms delay, doubled
            return () => clearTimeout(t);
        });
        if (!playingRef.current) return null;
        return <div className={classes.rootAnimation} onAnimationEnd={stop} />;
    },
    (prev, next) => prev.isHome === next.isHome && prev.classes === next.classes,
);

// ── SnackbarComponent ────────────────────────────────────────────────────────

const SnackbarComponent = React.memo(
    ({ classes, open, message, duration, onClose }) => (
        <Portal container={document}>
            <Snackbar
                key={message}
                TransitionComponent={Slide}
                TransitionProps={SNACKBAR_TRANSITION_PROPS}
                className={classes.snackbar}
                style={SNACKBAR_STYLE}
                open={open}
                anchorOrigin={SNACKBAR_ANCHOR}
                message={<span style={{ color: "#000" }}>{message}</span>}
                action={
                    <IconButton size="small" aria-label="close" color="inherit" onClick={onClose}>
                        <CloseIcon fontSize="small" />
                    </IconButton>
                }
                autoHideDuration={duration}
                onClose={onClose}
            />
        </Portal>
    ),
    (prev, next) =>
        prev.open === next.open &&
        prev.message === next.message &&
        prev.duration === next.duration,
);

// ═════════════════════════════════════════════════════════════════════════════
// §11 — Styles
// ═════════════════════════════════════════════════════════════════════════════

const styles = (theme) => {
    const searchBarBase = {
        boxShadow: "inset 0px 3px 2px 0px rgba(0,0,0,0.2), inset 0px 2px 2px 1px rgba(0,0,0,0.14), inset 0px 2px 5px 2px rgba(0,0,0,0.12)",
        display: "inline-block",
        padding: "12px 32px",
        backgroundColor: "#222222",
        verticalAlign: "top",
        height: 32,
        width: 320,
        boxSizing: "content-box",
        margin: "24px 32px 16px 32px",
        position: "relative",
        transition: `border-radius 150ms ${EASE}`,
        [theme.breakpoints.down("md")]: { width: 256, margin: "24px 16px 16px 32px" },
        [theme.breakpoints.down("sm")]: {
            maxWidth: "calc(100% - 176px)",
            height: 24,
            margin: "12px 16px 8px 64px",
            padding: "8px 24px",
            position: "absolute",
        },
    };

    const buttonTransition = `225ms ${EASE}`;

    return {
        root: {
            contain: "size style layout",
            overflow: "hidden",
            height: "100%",
            width: "100%",
            backgroundColor: theme.palette.primary.dark,
            color: theme.palette.primary.contrastText,
        },
        backdrop: { zIndex: 8 },
        rootAnimation: {
            overflow: "hidden",
            animationName: "$fast-slide-index",
            animationTimingFunction: EASE,
            animationDuration: "750ms",
            animationFillMode: "both",
            animationDelay: "5ms",
            left: "35%",
            top: "55%",
            willChange: "transform, opacity",
            "@global": {
                "@keyframes fast-slide-index": {
                    "0%": { opacity: 1, transform: "translate(-25%, -50%) scale(1)" },
                    "100%": { opacity: 0, transform: "translate(-100%, -50%) scale(5)" },
                },
            },
            contain: "paint size style layout",
            backgroundPosition: "0% 0%",
            zIndex: 100,
            position: "fixed",
            pointerEvents: "none",
            touchActions: "none",
            userSelect: "none",
            width: "200%",
            height: "200%",
            backgroundOrigin: "border-box",
            backgroundRepeat: "no-repeat",
            backgroundSize: "125% 150% !important",
            backgroundAttachment: "local !important",
            background:
                "radial-gradient(circle at 70% 70% in hsl shorter hue, transparent, transparent 31%, #f000ff6b 36%, #0095ffdb 42%, #0cffe9ba 46%, #d8ff00b5 50%, #f59300c2 53%, #6f0000c7 57%, transparent 61%)",
        },
        toolbar: {
            userSelect: "none",
            width: "100%",
            height: 96,
            // Layout/style containment: the toolbar is a fixed-height band;
            // internal changes (search open/close, fade-ins, menu-vert) must
            // not invalidate the layout of the menu/content below it.
            contain: "style",
            [theme.breakpoints.down("sm")]: { height: 64 },
        },
        menuLeft: {
            position: "relative",
            userSelect: "none",
            width: 284,
            height: "calc(100% - 96px)",
            // Size+layout+style containment: fixed-size left rail; its content
            // (ads, menu items) re-rendering shouldn't reflow siblings.
            contain: "size layout style",
            [theme.breakpoints.down("sm")]: { display: "none" },
        },
        toolbarImage: {
            margin: "16px 8px 16px 16px",
            width: 72,
            height: 72,
            cursor: "pointer",
            [theme.breakpoints.down("sm")]: { margin: "4px 0px 0px 16px" },
        },
        toolbarMenu: {
            display: "none",
            [theme.breakpoints.down("sm")]: {
                left: 8, top: 8, position: "absolute", display: "inherit",
            },
        },
        toolbarMenuVert: {
            display: "none",
            [theme.breakpoints.down("sm")]: {
                display: "inherit !important", position: "absolute", right: 8, top: 8,
            },
        },
        toolbarMenuButtons: {
            position: "absolute",
            display: "relative",
            right: 24,
            top: 24,
            [theme.breakpoints.down("md")]: { "& .text": { display: "none" } },
            [theme.breakpoints.down("sm")]: { display: "none" },
        },
        toolbarPrimaryButton: {
            backgroundImage: "linear-gradient(66deg, #222 17%, #7777779e 48%, #222)",
            transform: "scale(1)",
            boxShadow: "0px 0px 8px 0px #ffffffaa",
            transition: `transform ${buttonTransition}, box-shadow ${buttonTransition}`,
            color: "#ffffff",
            border: "2px solid #fff",
            borderRadius: 16,
            position: "absolute",
            [theme.breakpoints.down("sm")]: { display: "none" },
            top: 24,
            marginLeft: 8,
            marginTop: 8,
            "& svg": { marginRight: 8, color: "#ffffff" },
            "&:hover": { transform: "scale(1.08)", boxShadow: "0px 0px 12px 2px #ffffffaa" },
        },
        toolbarSecondaryButton: {
            color: "#666",
            marginLeft: 8,
            borderRadius: 16,
            backgroundColor: "transparent",
            transition: `color ${buttonTransition}, background-color ${buttonTransition}`,
            "&:hover": { color: "#aaa", backgroundColor: "rgba(255, 255, 255, 0.08)" },
            "& svg": { marginRight: 8, transition: `color ${buttonTransition}`, color: "#b8b8b8" },
            "&:hover svg": { color: "#fff" },
        },
        toolbarSettingsButton: {
            borderRadius: 16,
            color: "#222",
            backgroundColor: "#ddd",
            transition: `all ${buttonTransition}`,
            "&:hover": { color: "#000", backgroundColor: "#fff" },
            "& svg": { transition: `color ${buttonTransition}`, color: "#222" },
            "&:hover svg": { color: "#000" },
        },
        toolbarTitleWrapper: {
            cursor: "pointer",
            fontWeight: "bold",
            display: "inline-block",
            height: 64,
            verticalAlign: "top",
            marginTop: 17,
            [theme.breakpoints.down("sm")]: { margin: "8px 16px 0px 8px" },
        },
        toolbarTitle: { fontSize: "32px !important", fontFamily: '"Industry Book"' },
        toolbarSubtitle: {
            display: "block",
            fontSize: "8.33px !important",
            color: "#a5a5a5",
            textTransform: "uppercase",
            fontFamily: '"Normative Pro"',
        },
        icoSaleHidden: { [theme.breakpoints.down("md")]: { display: "none" } },
        searchBarWrapper: {
            zIndex: 9,
            position: "relative",
            display: "inline-block",
            verticalAlign: "top",
            width: "auto",
            [theme.breakpoints.down("sm")]: { width: "100%" },
        },
        searchBar: {
            ...searchBarBase,
            borderRadius: 28,
            [theme.breakpoints.down("sm")]: { ...searchBarBase[theme.breakpoints.down("sm")], borderRadius: 16 },
        },
        searchBarOpen: {
            ...searchBarBase,
            boxShadow: "none",
            borderRadius: "28px 28px 0 0",
            [theme.breakpoints.down("sm")]: { ...searchBarBase[theme.breakpoints.down("sm")], borderRadius: "16px 16px 0 0" },
        },
        searchBarOpenMenu: {
            zIndex: 9,
            width: 320,
            [theme.breakpoints.down("md")]: { width: 256 },
            [theme.breakpoints.down("sm")]: { maxWidth: "calc(100% - 176px)" },
        },
        searchBarResult: {
            padding: "0 16px",
            contain: "style layout",
            borderRadius: "0 0 28px 28px",
            margin: 0,
            backgroundColor: "#222222",
            maxHeight: "min(75vh, 386px)",
            overflow: "overlay",
            boxShadow: "#22222233 0px 7px 8px -4px, #22222224 0px 12px 17px 2px, #2222221f 0px 5px 22px 4px",
            [theme.breakpoints.down("sm")]: { borderRadius: "0 0 16px 16px" },
            "& .MuiListSubheader-sticky": { backgroundColor: "#222222" },
            "& .MuiList-padding": { paddingTop: 0 },
        },
        searchButton: {
            position: "absolute",
            right: 8,
            top: 4,
            [theme.breakpoints.down("sm")]: { right: 0, top: -4, color: "#666" },
        },
        searchInput: {
            width: "100%",
            backgroundColor: "transparent",
            border: "none",
            marginTop: -8,
            marginLeft: -8,
            lineHeight: "48px",
            fontSize: 18,
            height: 48,
            color: "#ccc",
            "&:focus": { outline: "none" },
            "&::placeholder": { color: "#666" },
            [theme.breakpoints.down("sm")]: { lineHeight: "32px", fontSize: 14, height: 32 },
        },
        content: {
            position: "absolute",
            overflow: "hidden",
            width: "calc(100% - 284px)",
            minHeight: "calc(100% - 96px)",
            marginLeft: 284,
            background: "transparent",
            backgroundColor: theme.palette.primary.light,
            contain: "size style layout",
            boxShadow: "inset 0px 3px 2px 0px rgba(0,0,0,0.2), inset 0px 2px 2px 1px rgba(0,0,0,0.14), inset 0px 2px 5px 2px rgba(0,0,0,0.12)",
            top: 96,
            right: 0,
            height: "calc(100% - 96px)",
            borderRadius: "28px 0 0 0",
            [theme.breakpoints.down("sm")]: {
                borderRadius: "0px",
                minHeight: "calc(100% - 64px)",
                width: "100%",
                top: 64,
                marginLeft: 0,
            },
        },
        snackbar: {
            zIndex: "2147483647 !important",
            "& .MuiSnackbarContent-root ": {
                backgroundColor: theme.palette.primary.contrastText,
                zIndex: "2147483647 !important",
                contain: "style layout",
                color: "#000 !important",
                borderRadius: 24,
            },
        },
        swipeableDrawer: {},
        // Style+layout containment on the drawer paper itself. The drawer is
        // off-canvas while closed (keepMounted), and a swipe gesture animates
        // transform — internal content paints/layouts shouldn't reach back
        // into the main page. Combined with the always-mounted DrawerSlot,
        // this is what makes the menu swipe feel fast on mobile.
        drawerPaper: {
            contain: "layout style",
        },
        listItemText: { cursor: "pointer" },
        subheaderSticky: { color: "white", fontWeight: "bold", fontSize: 16 },
        historyElement: {
            justifyContent: "end",
            color: "#666",
            cursor: "pointer",
            transition: `color ${buttonTransition}`,
            "&:hover": { color: "#999" },
        },
        historyList: { "&.MuiListItem-gutters": { paddingRight: 0 } },
    };
};

// ═════════════════════════════════════════════════════════════════════════════
// §12 — Index (main component — functional)
// ═════════════════════════════════════════════════════════════════════════════

function Index({ classes, history, settings: rawSettings }) {
    // ── Refs for latest values (avoids stale closures) ────────────────────
    const settingsRef = useRef({ _know_the_settings: false });
    const [searchBarAnchor, setSearchBarAnchor] = useState(null);

    // ── Settings processing ───────────────────────────────────────────────
    // settingsVersion is bumped by the SETTINGS_UPDATE dispatcher event
    // to force re-derivation of processedSettings from the freshly-fetched raw.
    const [settingsVersion, setSettingsVersion] = useState(0);
    const dispatcherRawRef = useRef(null); // holds raw from api.get_settings callback

    const processedSettings = useMemo(() => {
        // Prefer dispatcher-fetched raw if newer, else prop-based raw
        const raw = dispatcherRawRef.current || rawSettings;
        const next = normalizeSettings(raw);
        if (!next) return settingsRef.current;
        const changed = settingsChanged(settingsRef.current, next);
        if (changed) settingsRef.current = next;
        // Return the ref (stable identity when unchanged) so downstream
        // memo comparisons don't fire on every settingsVersion bump.
        return settingsRef.current;
        // settingsVersion is only here to trigger recomputation — it's not read
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rawSettings, settingsVersion]);

    // ── Core hooks ────────────────────────────────────────────────────────
    const { snackbar, show: showSnackbar, hide: hideSnackbar } = useSnackbar();
    const compact = useMediaQuery();
    const sound = useSoundManager();

    // ── API ref (single source of truth, shared across hooks) ──────────
    const apiRef = useRef(null);

    // ── Dialog manager (single slot) ─────────────────────────────────────
    const { dialog, openDialog, closeDialog } = useDialogManager(apiRef, settingsRef);

    // Resolved node URL, reactive to processedSettings. This — rather than a
    // ref read inside usePixaAPI on mount only — is what lets picking a
    // different node or custom URL in Settings actually swap the live API
    // connection, instead of only taking effect on the next full page load.
    // The setting IS the URL (normalized by utils/settings on every write and
    // read), so there is nothing to map here anymore: the boot hint only
    // matters while `_api_node_url` is still undefined (settings not yet
    // hydrated); once normalizeSettings has run it is always set.
    const apiNodeUrl = processedSettings._api_node_url || BOOT_API_NODE_URL_HINT || api.DEFAULT_API_NODE_URL;

    // ── API lifecycle (populates apiRef) ─────────────────────────────────
    const { apiReady, apiGeneration } = usePixaAPI(apiRef, settingsRef, openDialog, showSnackbar, apiNodeUrl);

    // ── Live settings stream ─────────────────────────────────────────────
    // utils/settings emits every resolved bag (init / get / set). Feeding it
    // into the same slot the SETTINGS_UPDATE re-read fills means a change made
    // anywhere — the Settings dialog, a migration, another module — reaches
    // processedSettings (and from there apiNodeUrl → usePixaAPI) without
    // depending on the parent handing us a new `settings` prop, and it fixes
    // the old staleness where, once the dispatcher path had filled
    // dispatcherRawRef, later prop-based bags were ignored for good.
    // processedSettings dedupes by value, so an unchanged bag is a no-op.
    useEffect(() => api.subscribe((bag) => {
        if (!bag) return;
        dispatcherRawRef.current = bag;
        setSettingsVersion((v) => v + 1);
    }), []);

    // ── Sync settings → API when settings change ─────────────────────────
    useEffect(() => {
        const api = apiRef.current;
        if (!api || !processedSettings._know_the_settings) return;
        api.askVote = processedSettings._askvote !== false;
        api.defaultVotingPower = parseInt(processedSettings._voting, 10) || 100;
    }, [processedSettings]);

    // ── Signal app initialization complete ───────────────────────────────
    // Flip data-initiated to "false" once BOTH the blockchain API is ready
    // and the settings have been normalized at least once. External code
    // (splash screens, e2e tests, CSS gates) watches this attribute to know
    // when the app is past its boot phase. Guarded so we don't re-set the
    // same value on every subsequent settings tick.
    const initiatedRef = useRef(false);
    useEffect(() => {
        if (initiatedRef.current) return;
        if (!apiReady) return;
        if (!processedSettings._know_the_settings) return;
        initiatedRef.current = true;
        document.body.setAttribute("datainitiated", "false");
    }, [apiReady, processedSettings]);

    // ── Router ────────────────────────────────────────────────────────────
    const {
        page, historyTags, deleteHistoryTag, navigate, livePathname, setPageComponent,
    } = usePageRouter(history, settingsRef, apiRef);

    // Re-route when locale changes or on initial settings load.
    // Other settings changes (renderer, nsfw, payout…) propagate to pages
    // via ContentComponent's cloneElement — no async page rebuild needed.
    const prevLocaleRef = useRef(null);
    useEffect(() => {
        if (!processedSettings._know_the_settings) return;
        const locale = processedSettings._selected_locales_code;
        const isInitial = prevLocaleRef.current === null;
        const localeChanged = prevLocaleRef.current !== locale;
        prevLocaleRef.current = locale;

        if (isInitial || localeChanged) {
            // Apply the locale, don't just route around it. This effect already
            // fires on both first settings load and every later change, which
            // makes it the one place that can cover boot — SettingsDialog only
            // ever sees a change. Without this call the saved preference was
            // read, used to pick a route, and then never handed to the i18n
            // runtime, so the UI rendered in English no matter what was stored.
            //
            // Fire-and-forget: setLanguage swallows a missing locale file and
            // keeps the previous bundle, and notifies subscribers when the new
            // one is live — the subscription below turns that into a re-render.
            setLanguage(locale);

            const pathname = history.location.pathname;
            for (const route of PAGE_ROUTES) {
                if (route.page_name !== "unknown" && pathname.match(route.page_regex)) {
                    setPageComponent(route.page_name, pathname);
                    return;
                }
            }
        }
    }, [processedSettings]);

    // ── Force a re-render of the tree when settings or language move ───────
    // `processedSettings` deliberately returns a STABLE ref identity when the
    // values compare equal, so downstream React.memo() comparisons don't fire on
    // every settingsVersion bump. That optimisation also means a settings
    // update can be swallowed: ContentComponent is React.memo()'d on `settings`, so
    // an unchanged identity blocks the re-render even when something below
    // genuinely needs to repaint.
    //
    // renderNonce is the escape hatch. It changes on every settings update and
    // every language swap, and is threaded into ContentComponent as a prop —
    // memo cannot compare it equal, so the subtree always re-renders. It also
    // covers the class components, which cannot subscribe with a hook.
    const [renderNonce, setRenderNonce] = useState(0);
    const forceUpdate = useCallback(() => setRenderNonce((n) => n + 1), []);

    // setLanguage() is async: it resolves the locale chunk, swaps the bundle
    // and clears the render cache, then notifies. Nothing was listening, so
    // even a correctly-applied locale only appeared after some unrelated
    // re-render happened to occur.
    useEffect(() => subscribe_language(forceUpdate), [forceUpdate]);

    // ── NSFW classifier warmup (idle, gated on the filter being ON) ────────
    // The on-device classifier (utils/nsfw.js, a shared singleton) is needed as
    // soon as image cards mount whenever NSFW filtering is active — which is
    // when the "show NSFW" setting is OFF (_nsfw_enabled === false). Left to
    // PaperCard, the FIRST card to mount pays the whole cold cost on the render
    // path: dynamic import + worker spawn + ORT session init + wasm fetch. We
    // hoist that here and run it in requestIdleCallback so the model loads (and
    // the IndexedDB verdict cache primes) before the user reaches the feed,
    // without competing with first paint. PaperCard then reuses the already-warm
    // detector and primed cache. When filtering is OFF nothing is classified, so
    // we don't import the module at all (and release a previously-warmed one).
    // Skipped on the marketing landing ("home"), which renders no classified
    // cards — no reason to ship the model to visitors who bounce there.
    const nsfwModRef = useRef(null);
    useEffect(() => {
        if (!processedSettings._know_the_settings) return;
        const filterEnabled = processedSettings._nsfw_enabled === false;

        if (!filterEnabled) {
            // User chose to see NSFW: tear down any instance warmed earlier this
            // session so its worker/ORT session is released.
            const mod = nsfwModRef.current;
            if (mod) {
                try { mod.configure({ filterEnabled: false }); } catch (e) {}
                try { mod.dispose(); } catch (e) {}
                nsfwModRef.current = null;
            }
            return;
        }

        if (!page.name || page.name === "home") return;

        // Already warmed this session: this effect re-fires on every page
        // navigation and every settings identity bump, and each re-run was
        // scheduling a fresh idle → import (cache hit) → configure → warmup
        // pass for a singleton that is already hot. The disable branch above
        // nulls the ref, so toggling the filter off and on still re-warms.
        if (nsfwModRef.current) return;

        let cancelled = false;
        const idleId = idle(() => {
            if (cancelled) return;
            import("../utils/nsfw")
                .then((m) => {
                    const mod = (m && (m.default || m)) || null;
                    if (cancelled || !mod) return;
                    nsfwModRef.current = mod;
                    mod.configure({
                        filterEnabled: true,
                        // If onnxruntime-web's .wasm/.mjs aren't served from the
                        // default path, point the detector at them here, e.g.:
                        // wasmPaths: "/ort/",
                    });
                    mod.warmup(); // loads the model + primes the verdict cache
                })
                .catch(() => {}); // non-critical: cards still render without it
        });

        return () => {
            cancelled = true;
            cancelIdle(idleId);
        };
    }, [processedSettings, page.name]);

    // ── Toxic Comment Helper (utils/toxicity.js, a shared singleton) ──────
    // Unlike the NSFW classifier above, this one is NOT warmed at idle: by
    // design its model only loads once the user has typed more than 3 chars
    // into a watched field (comments, titles, descriptions…). All Index.js
    // does is push the caught setting into the singleton so every watcher and
    // pre-broadcast gate sees it, and release the WASM session the moment the
    // user disables the helper. Importing utils/toxicity is near-free — the
    // package + onnxruntime-web stay behind dynamic imports inside it.
    const toxicityModRef = useRef(null);
    useEffect(() => {
        if (!processedSettings._know_the_settings) return;
        const enabled = processedSettings._toxicity_enabled !== false;

        if (!enabled) {
            const mod = toxicityModRef.current;
            if (mod) {
                try { mod.configure({ enabled: false }); } catch (e) {}
                try { mod.dispose(); } catch (e) {}
            }
            // Not yet imported ⇒ nothing was ever loaded ⇒ nothing to release.
            return;
        }

        let cancelled = false;
        import("../utils/toxicity")
            .then((m) => {
                const mod = (m && (m.default || m)) || null;
                if (cancelled || !mod) return;
                toxicityModRef.current = mod;
                mod.configure({
                    enabled: true,
                    // If onnxruntime-web's .wasm aren't served from the default
                    // path, point the helper at them here (same-origin), e.g.:
                    // wasmPaths: "/ort/",
                });
            })
            .catch(() => {}); // non-critical: fields work without the helper
        return () => { cancelled = true; };
    }, [processedSettings]);

    // No apiReady page-rebuild effect anymore. It used to re-import and
    // re-dispatch the current page when the API came up so the page element
    // would carry a valid `api` prop — but ContentComponent stopped reading
    // the element's baked api long ago: it injects the live `apiRef.current`
    // via cloneElement on EVERY render, and `apiReady` sits in its memo
    // comparator, so the readiness flip alone re-renders the mounted page
    // with the fresh instance. The rebuild only added a third async import +
    // dispatch + element identity swap to every boot (and to every node
    // switch), forcing a full page reconcile for props already flowing.

    // ── Search ────────────────────────────────────────────────────────────
    const search = useBlockchainSearch(apiRef);

    // ── First-visit tour ──────────────────────────────────────────────────
    const [tourSteps, setTourSteps] = useState(null);
    const tourPageRef = useRef(null);           // page the running tour belongs to
    const tourIncludesIntroRef = useRef(false); // intro steps prepended this run?

    const finishTour = useCallback((reason) => {
        const forPage = tourPageRef.current;
        if (forPage) {
            const patch = { [forPage]: true };
            if (tourIncludesIntroRef.current) patch.intro = true;
            writeTourState(patch);
        }
        tourPageRef.current = null;
        tourIncludesIntroRef.current = false;
        setTourSteps(null);
        // A finished profile tour leaves the user parked on the History tab —
        // walk them back to Posts. (Leaving mid-tour by navigating doesn't.)
        if (forPage === "profile" && reason !== "navigated") {
            clickProfileTab(0);
        }
    }, []);

    // Arm the tour on the first visit to a tourable page, once the app shell
    // and settings are up. The delay lets the lazy page mount and the masonry
    // settle so the anchors measure at their real positions.
    //
    // renderNonce is a dependency because setLanguage() is async: on a cold or
    // slow load the locale chunk can land AFTER this effect first runs, and the
    // steps would then be built from whatever bundle happened to be live —
    // English, for a user who asked for anything else. subscribe_language()
    // bumps the nonce the moment the swap completes, which restarts the timer
    // and rebuilds the steps in the right language. The `tourSteps` guard below
    // means a running tour is never restarted by this, and the nonce only moves
    // on discrete settings/language events, so the timer cannot be starved.
    useEffect(() => {
        if (tourSteps) return;                            // one tour at a time
        if (!apiReady) return;
        if (!processedSettings._know_the_settings) return;
        const name = page.name;
        if (!TOURABLE_PAGES[name]) return;
        if (isPostUrl(history.location.pathname)) return; // post overlay is open
        if (readTourState()[name]) return;

        const timer = setTimeout(() => {
            const state = readTourState();
            if (state[name]) return;
            const withIntro = !state.intro;
            const steps = [
                ...(withIntro ? buildIntroSteps(compact) : []),
                ...buildPageSteps(name),
            ];
            if (!steps.length) return;
            tourPageRef.current = name;
            tourIncludesIntroRef.current = withIntro;
            setTourSteps(steps);
        }, 900);
        return () => clearTimeout(timer);
    }, [apiReady, processedSettings, page.name, compact, tourSteps, history, renderNonce]);

    // Navigating away mid-tour closes it and marks that page as seen, so the
    // tour doesn't ambush the user again on the way back.
    useEffect(() => {
        if (tourPageRef.current && tourPageRef.current !== page.name) {
            finishTour("navigated");
        }
    }, [page.name, finishTour]);

    // ── Drawer ────────────────────────────────────────────────────────────
    const [drawerOpen, setDrawerOpen] = useState(false);
    const openDrawer = useCallback(() => setDrawerOpen(true), []);
    const closeDrawer = useCallback(() => setDrawerOpen(false), []);

    // ── Toolbar menu (vert) ───────────────────────────────────────────────
    const [menuVertXY, setMenuVertXY] = useState(EMPTY_I32);
    const openToolbarMenu = useCallback((event) => {
        const x = (event.clientX ?? event.x) || 0;
        const y = (event.clientY ?? event.y) || 0;
        setMenuVertXY(Int32Array.of(x - 24, y - 24));
    }, []);
    const closeToolbarMenu = useCallback(() => setMenuVertXY(EMPTY_I32), []);

    // ── Post-publish loader overlay ───────────────────────────────────────
    // Full-screen WebGL logo animation shown after a successful broadcast,
    // once NewPost has closed. It outlives that dialog (mounted here on the
    // app shell) and refreshes the page when its timeline completes.
    const [publishLoaderOpen, setPublishLoaderOpen] = useState(false);

    // ── Logout ────────────────────────────────────────────────────────────
    const [logoutOpen, setLogoutOpen] = useState(false);
    const openLogout = useCallback(() => setLogoutOpen(true), []);
    const closeLogout = useCallback(() => { setLogoutOpen(false); actions.trigger_sfx("labactive"); }, []);
    const doLogout = useCallback(() => {
        apiRef.current?.logout().then(() => {
            closeLogout();
            showSnackbar(t("components.index.logged_out_successfully"), 2000);
        });
    }, [closeLogout, showSnackbar]);

    // ── Navigation helpers ────────────────────────────────────────────────
    // These depend ONLY on `search.reset` (stable, [] deps) — NOT the whole
    // `search` object, whose identity changes on every keystroke because of
    // `query`/`results`. Without this, every character typed in the search
    // bar minted fresh goToUsername/goToTag/goToCommunity callbacks, which
    // propagated through ToolbarComponent → SearchResults → every list row
    // and re-rendered each row's onClick — far more work than the search
    // itself.
    const searchReset = search.reset;
    const goHome = useCallback(() => history.back(), [history]);
    const goToUsername = useCallback((n) => {
        const cleaned = String(n || "").replaceAll("@", "");
        if (!cleaned) return;  // refuse to push the broken `/@` URL
        history.push("/@" + cleaned);
        searchReset();
    }, [history, searchReset]);
    const goToTag = useCallback((n) => {
        history.push("/trending/" + n.replaceAll("#", ""));
        searchReset();
    }, [history, searchReset]);
    const goToCommunity = useCallback((name) => {
        history.push("/" + name);
        searchReset();
    }, [history, searchReset]);
    const setTagNavigation = useCallback((tagname) => {
        history.push("/trending/" + tagname);
    }, [history]);

    // ── ICO link ──────────────────────────────────────────────────────────
    const openIco = useCallback(() => {
        window.open("https://pixagram.shop", "_blank", "noopener,noreferrer");
    }, []);

    // ── Dialog convenience openers ────────────────────────────────────────
    const openWitnesses = useCallback(() => openDialog("witnesses"), [openDialog]);
    const openAppinfo = useCallback(() => openDialog("appinfo"), [openDialog]);
    const openSettings = useCallback(() => openDialog("settings"), [openDialog]);
    const openTextDialog = useCallback((options = {}) => {
        const gradient = options?.gradient || (typeof options !== 'object' ? options : undefined);
        openDialog("text", {
            _resolvedProps: {
                gradient,
                initialCommunity: options?.community || '',
                setGradient: (g) => openTextDialog({ gradient: g }),
                api: apiRef.current,
                onClose: () => closeDialog("text"),
            },
        });
    }, [openDialog, closeDialog]);
    const openVotingList = useCallback((eventData) => {
        const sign = typeof eventData === "object" ? eventData.sign || "+" : eventData;
        const votes = typeof eventData === "object" ? eventData.votes || [] : [];
        const voterProfiles = typeof eventData === "object" ? eventData.voter_profiles || {} : {};
        openDialog("voting", {
            _resolvedProps: {
                locales: settingsRef.current._selected_locales_code,
                positive: sign === "+",
                votes,
                voterProfiles,
                api: apiRef.current,
                onClose: () => closeDialog("voting"),
            },
        });
    }, [openDialog, closeDialog]);

    // ── SearchBar ref ─────────────────────────────────────────────────────
    const setSearchBarRef = useCallback((el) => {
        if (el) {
            const rect = el.getBoundingClientRect();
            el.width = rect.width;
            setSearchBarAnchor(el);
        }
    }, []);

    // ── Dispatcher ────────────────────────────────────────────────────────
    // All callbacks are stable now, but we use a ref as a firewall:
    // the dispatcher registers ONCE and always calls the latest handler.
    const handlerRef = useRef(null);

    handlerRef.current = (event) => {
        const { _sfx_enabled, _voice_enabled } = settingsRef.current;

        switch (event.type) {
            case "TRIGGER_SFX":
                if (_sfx_enabled) sound.play("sfx", event.data.pack, event.data.name, event.data.volume / 1.25, false);
                break;
            case "WITNESSES":    openWitnesses(); break;
            case "ICO":          openIco(); break;
            case "OPEN_QR":      openDialog("qr"); break;
            case "WALLET":       openDialog("wallet"); break;
            case "ACCOUNT":      openDialog("account"); break;
            case "ADD_ACCOUNT":  openDialog("add_account"); break;
            case "LOGIN":        openDialog("login", event.data || {}); break;
            case "UNLOCK":       openDialog("unlock", event.data || {}); break;
            case "VOTES":        openVotingList(event.data); break;
            case "LOGOUT":       openLogout(); break;
            case "TEXT":         openTextDialog(event.data || {}); break;
            case "EDIT_PROFILE": openDialog("edit_profile"); break;
            case "FAVORITES":    openDialog("favorites"); break;
            case "PUBLISH_LOADER": setPublishLoaderOpen(true); break;
            case "DATA_VIEWER":  openDialog("data_viewer", event.data || {}); break;
            case "TRIGGER_VOICE":
                if (_voice_enabled) sound.play("voice", event.data.pack, event.data.name, event.data.volume / 2, false);
                break;
            case "STOP_SOUND":      sound.stop(); break;
            case "SNACKBAR":        showSnackbar(event.data.message, event.data.duration); break;
            case "SETTINGS_UPDATE": api.get_settings((raw) => {
                const next = normalizeSettings(raw);
                if (next) {
                    settingsRef.current = next;
                    dispatcherRawRef.current = raw;
                    setSettingsVersion((v) => v + 1); // re-derive processedSettings
                    forceUpdate();                    // and repaint the subtree
                }
            }); break;
            case "CLOSE_MODAL":     closeDialog(null); break;
            case "SHARE_CONTENT":
                shareContent(event.data.title, event.data.text, event.data.url);
                break;
        }
    };

    // Register once, never re-runs
    useEffect(() => {
        const id = dispatcher.register((event) => handlerRef.current(event));
        return () => dispatcher.unregister(id);
    }, []);

    // Boot-up (once)
    useEffect(() => {
        document.body.setAttribute("class", "loaded");
    }, []);

    // ── Pre-load inner Feed page from Home ────────────────────────────────
    // When sitting on the landing page, warm the ./Feed chunk so the
    // transition into the app feels instant. The dynamic import resolves
    // from the browser module cache on the real navigation.
    //
    // Gated on apiReady, then scheduled on idle: the old version fired on a
    // blind 720ms timer, which raced the boot-critical downloads kicked off
    // at mount (pixaproxyapi → dpixa chunks → sanitizer wasm) — exactly the
    // network contention the sibling warm below is sequenced to avoid. The
    // gate costs nothing user-visible: Feed cannot render data before
    // apiReady anyway, so an early CTA click just loads the chunk on demand
    // alongside the still-booting API, same as before. Home is strictly
    // first, the Feed warm strictly after boot has settled. Re-arms only on
    // entering home (or when a node switch re-inits the API — the re-import
    // is then a free cache hit); leaving home cancels the pending warm.
    useEffect(() => {
        if (page.name !== "home" || !apiReady) return;
        const id = idle(() => {
            // Fire-and-forget; we just want the chunk in cache. Swallow
            // errors so a transient load failure doesn't surface as noise.
            import("./Feed").catch(() => {});
        });
        return () => cancelIdle(id);
    }, [page.name, apiReady]);

    // ── Warm sibling route chunks on idle ─────────────────────────────────
    // The Home→Feed prefetch above only covers the landing→app jump. Once the
    // user is INSIDE the app (and the API is ready, so we're past first paint),
    // warm the OTHER code-split page chunks during idle time. Cross-page
    // navigation (Feed ↔ Profile ↔ Community ↔ FeedPersonal) then resolves from
    // the module cache instead of showing the Suspense fallback while a chunk
    // downloads. Importing a page module only defines its components/styles —
    // there are no import-time side effects — so this is purely a cache warm.
    //
    // Sequential (one chunk finishes before the next starts) so the prefetch
    // never floods the network with parallel chunk requests competing with the
    // current page's data fetches. The current page's own importer resolves
    // instantly from cache. Skipped on the marketing landing, whose visitors
    // may bounce before ever entering the app.
    useEffect(() => {
        if (!apiReady || !page.name || page.name === "home") return;
        let cancelled = false;
        const importers = [
            ...Object.values(PAGE_IMPORTERS),
            // Not a page, but same reasoning: warm the (now code-split)
            // post-publish overlay so a successful broadcast never waits
            // on its chunk download.
            () => import("../components/PublishLogoLoader"),
        ];
        const id = idle(() => {
            let i = 0;
            const next = () => {
                if (cancelled || i >= importers.length) return;
                importers[i++]().catch(() => {}).then(next);
            };
            next();
        });
        return () => {
            cancelled = true;
            cancelIdle(id);
        };
    }, [apiReady, page.name]);

    // (The former online/offline effect is gone: it registered two EMPTY
    // handlers on every mount and nothing ever consumed them.)

    // ── Derived values ────────────────────────────────────────────────────
    // Always the translated "Search" hint. The placeholder used to echo
    // historyTags[0] ("#tag" / "@username" captured from the last feed or
    // profile visit), which read as a leftover query sitting in the box.
    // History entries still surface where they belong — the History section
    // of the search dropdown, with their delete buttons. Index re-renders
    // via subscribe_language, so a locale swap re-resolves the string live.
    const searchBarPlaceholder = t("words.search");

    const historyList = useMemo(() => {
        if (!search.isOpen || !historyTags.length) return null;
        return (
            <React.Fragment>
                <ListSubheader className={classes.subheaderSticky}>{t("words.history")}</ListSubheader>
                {historyTags.slice(0, 7).map((o, i) => (
                    <ListItem key={"$-" + i} className={classes.historyList}>
                        <ListItemText
                            className={classes.listItemText}
                            onClick={() => o.startsWith("#") ? goToTag(o) : goToUsername(o)}
                            primary={<span style={{ color: "#bbb" }}>{o}</span>}
                        />
                        <ListItemIcon className={classes.historyElement}>
                            <CloseIcon onClick={() => deleteHistoryTag(o)} />
                        </ListItemIcon>
                    </ListItem>
                ))}
            </React.Fragment>
        );
    }, [search.isOpen, historyTags, classes, goToTag, goToUsername, deleteHistoryTag]);

    const wordmark = useMemo(
        () => <Wordmark classes={classes} onGoHome={goHome} />,
        [classes, goHome],
    );

    // ═════════════════════════════════════════════════════════════════════
    // Render
    // ═════════════════════════════════════════════════════════════════════

    // Cold start: usePageRouter's initial navigate() runs in an effect, so
    // the very first render commits with page.name === null. Falling through
    // to the app-shell branch here would paint the toolbar/menu/feed scaffold
    // for one frame on landings that are actually destined for Home. Render
    // nothing until the router has picked a page — Home (eager-imported)
    // resolves synchronously in the same effect tick, so this is a single
    // empty frame, not a perceptible blank.
    if (page.name === null) {
        return null;
    }

    // The Snackbar (and the transition overlay's mount point) sit here,
    // outside the page-name branch, so they don't unmount/remount when
    // navigating home ↔ other pages. Unmounting the Snackbar mid-transition
    // would kill its slide animation and any in-flight autoHide timer. The
    // overlay itself only puts a node in the DOM while its home→app fade is
    // actually playing — see RootAnimationOverlay.
    const isHome = page.name === "home";

    return (
        <React.Fragment>
            {isHome ? (
                page.element
            ) : (
                <React.Fragment>
                    <main className={classes.root}>
                        <ToolbarComponent
                            classes={classes}
                            compact={compact}
                            wordmark={wordmark}
                            searchOpen={search.isOpen}
                            searchInputText={search.query}
                            searchBarPlaceholder={searchBarPlaceholder}
                            searchInput={searchBarAnchor}
                            searchResults={search.results}
                            searchLoading={search.results.loading}
                            history={historyList}
                            onOpenMenuDrawer={openDrawer}
                            onResetSearch={search.reset}
                            onSearchChange={search.handleChange}
                            onGoHome={goHome}
                            onGoToUsername={goToUsername}
                            onGoToTag={goToTag}
                            onGoToCommunity={goToCommunity}
                            onSetTagNavigation={setTagNavigation}
                            onSetSearchBarRef={setSearchBarRef}
                            onIco={openIco}
                            onWitnesses={openWitnesses}
                            onAppinfo={openAppinfo}
                            onSettings={openSettings}
                            onToolbarMenu={openToolbarMenu}
                        />
                        <MenuLeftComponent
                            key={apiGeneration}
                            classes={classes}
                            closedMenuAds={processedSettings._closed_menu_ads}
                            pixaAPI={apiRef.current}
                        />
                        <ContentComponent
                            classes={classes}
                            pageElement={page.element}
                            settings={processedSettings}
                            pathname={livePathname}
                            apiRef={apiRef}
                            apiReady={apiReady}
                            apiGeneration={apiGeneration}
                            renderNonce={renderNonce}
                        />
                        <Backdrop className={classes.backdrop} open={search.isOpen} />
                    </main>

                    <ToolbarMenuOption
                        xy={menuVertXY}
                        onClose={closeToolbarMenu}
                        onInfoClick={openAppinfo}
                        onSettingsClick={openSettings}
                        onWitnessesClick={openWitnesses}
                        onIcoClick={openIco}
                    />

                    <DrawerSlot
                        key={apiGeneration}
                        compact={compact}
                        classes={classes}
                        wordmark={wordmark}
                        drawerOpen={drawerOpen}
                        onOpen={openDrawer}
                        onClose={closeDrawer}
                        closedMenuAds={processedSettings._closed_menu_ads}
                        pixaAPI={apiRef.current}
                    />

                    <DialogSlot dialog={dialog} />

                    <LogoutModal
                        open={logoutOpen}
                        onConfirm={doLogout}
                        api={apiRef.current}
                        onLogoutComplete={goHome}
                    />

                    {tourSteps && (
                        <Suspense fallback={null}>
                            <LazyTour steps={tourSteps} onFinish={finishTour} />
                        </Suspense>
                    )}
                </React.Fragment>
            )}

            <SnackbarComponent
                classes={classes}
                open={snackbar.open}
                message={snackbar.message}
                duration={snackbar.duration}
                onClose={hideSnackbar}
            />

            <RootAnimationOverlay classes={classes} isHome={isHome} />

            {publishLoaderOpen && (
                <Suspense fallback={null}>
                    <LazyPublishLogoLoader
                        open
                        onDone={() => setPublishLoaderOpen(false)}
                    />
                </Suspense>
            )}
        </React.Fragment>
    );
}

// memo with a custom comparator: classes and history are effectively stable
// singletons in this app's wiring; rawSettings is the only prop that should
// drive a re-render of the Index root. This stops parent re-renders from
// cascading into the (large) Index tree when only an unrelated prop reference
// changed upstream.
export default withStyles(styles)(
    React.memo(Index, (prev, next) =>
        prev.classes === next.classes &&
        prev.history === next.history &&
        prev.settings === next.settings,
    ),
);