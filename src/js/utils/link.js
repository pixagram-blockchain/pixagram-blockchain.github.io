// ═════════════════════════════════════════════════════════════════════════════
// utils/link.js — navigation that is also a link
// ═════════════════════════════════════════════════════════════════════════════
// Every in-app navigation used to be a click handler on a <span>, a <div> or a
// button: `onClick={() => HISTORY.push("/@" + name)}`. The page moved, but the
// browser never learned that the element led anywhere: no Ctrl/Cmd+click, no
// middle click, no "Open link in new tab" or "Copy link address" in its menu,
// no address in the status bar, nothing to long-press on a phone.
//
// The router is address-driven end to end (PAGE_ROUTES, the post overlays and
// their cold-entry seed, the "+meta" overlays), so every address the app
// pushes also loads on its own. All a navigation element lacked was that
// address, in an href. This module adds it, and changes nothing else:
//
//   link(href, onNavigate)   props for an <a>, or for any component that
//                            renders one (MUI: component="a", or simply an
//                            href on a ButtonBase). A plain click runs
//                            `onNavigate` — the handler the element already
//                            had, so the same push / replace / back, the same
//                            dialog closing, the same hero rect — or, without
//                            one, HISTORY.push(href). A click the browser has
//                            its own plans for (Ctrl, Cmd, Shift, Alt, the
//                            middle button) is left to it, and NOTHING runs in
//                            this tab: the search stays open, the dialog stays
//                            up, no entry is pushed. The right click needs no
//                            code at all: the element is a link, the menu is
//                            the browser's.
//   useLink(href, onNavigate)  the same, memoised, for memo'd leaves.
//   linkClick(handler)       the click rule alone, for a handler that takes
//                            more than the event (MUI Tabs' onChange) or whose
//                            href is set somewhere else.
//
// A few targets have no address until they are clicked: the thread of a reply
// card, a timeline entry, a notification — the root post is looked up on the
// chain first. With no href to give, the click itself carries the intent:
//
//   deferredLink(onOpen)     props for such an element: `onOpen(event)` also
//                            runs for the middle button.
//   pendingNavigation(event) called first thing in that handler, before any
//                            await. It tells whether the click asked for a new
//                            tab and, if so, has already opened it — a tab
//                            opened after an await is no longer the click's
//                            doing and is blocked as a pop-up — so the lookup
//                            only has to point it at the address: go(to), or
//                            cancel() when there is none.
//   pendingTab()             that tab alone, for an "Open in new tab" menu
//                            entry on such a target: there the click is plain
//                            and the entry itself is the request.
//
// Styling. An <a> picks up the theme's content-link colours (theme/overrides,
// MuiCssBaseline: "a", "a:visited", "a:hover"). Every element made here
// carries `data-nav`; that rule set leaves those out and resets them — colour
// inherited, no underline, at zero specificity — so the element looks as it
// did as a span and its own class still decides.
//
// A button is the other case. It never inherited its typography (the browser
// gives a <button> its own, and the theme a font), and a link in its place
// would. The theme therefore gives the button's to a MUI button that became a
// link (it knows them by their ButtonBase class), and to a plain <button> of
// the app's own that did, which says so itself: data-nav="button", set after
// the spread — `<a {...link(href, open)} data-nav="button">`.
//
// Dragging. A link can be dragged where a span or a button could not, and a
// press that slides a few pixels then starts a drag instead of the click.
// The links made here are not draggable, so a plain click lands exactly as
// often as it did.
//
// Two rules for whoever adds a link, both about what goes inside it.
//   · A control with a click of its own (a row's delete button) that stops
//     the click's propagation keeps link()'s handler from running, and the
//     browser then follows the href — a full page load in place of the
//     button's action. Such a control must call preventDefault as well
//     (FavoriteManagerDialog's delete button does).
//   · A <button> that is only decoration (a ButtonBase for its ripple) takes
//     the click's activation from the link around it: Ctrl+click on it opens
//     nothing. Render it as a <span> (PostOriginality's tiles do; the theme
//     keeps a button's typography on it).

import { useMemo } from "preact/hooks";
import { HISTORY } from "./constants";

/**
 * A click the app handles itself: the primary button, no modifier key, not
 * already dealt with. Everything else on a link belongs to the browser.
 * No event at all (a handler called by hand) counts as plain.
 */
export function isPlainClick(event) {
    if (!event) return true;
    if (event.defaultPrevented) return false;
    if (typeof event.button === "number" && event.button !== 0) return false;
    return !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
}

/**
 * A click that asks for the target somewhere else: another tab (Ctrl, Cmd,
 * the middle button) or another window (Shift).
 */
export function wantsNewTab(event) {
    if (!event) return false;
    return event.button === 1 || !!(event.metaKey || event.ctrlKey || event.shiftKey);
}

// An in-app address is an absolute path: "/…", and not "//host/…" (nor
// "/\host", which browsers read the same way) — that is protocol-relative,
// another origin. Parts of these addresses are chain data (a community's
// name, a notification's url); HISTORY.push throws on such a value, and a
// link must not follow it either. Anything else is simply not an address:
// link() makes a plain element of it, a new tab is not opened for it.
const IN_APP_PATH = /^\/(?![\/\\])/;
const isInAppPath = (to) => typeof to === "string" && IN_APP_PATH.test(to);

const absolute = (to) => {
    if (!isInAppPath(to)) return null;
    try {
        const url = new URL(to, window.location.href);
        return url.origin === window.location.origin ? url.href : null;
    } catch (e) { return null; }
};

/** Opens an in-app address in another tab, as the browser's own "Open link in new tab" does: no opener. */
export function openInNewTab(to) {
    const url = absolute(to);
    if (!url) return false;
    try { window.open(url, "_blank", "noopener"); } catch (e) { return false; }
    return true;
}

/**
 * The click rule, around `handler`: a plain click is taken from the browser
 * (preventDefault) and handed to `handler` with whatever else it was called
 * with; any other click is left alone. `stop`: the click goes no further up
 * either way — for a link inside an element that has a click of its own.
 */
export function linkClick(handler, options) {
    const stop = !!(options && options.stop);
    return function onLinkClick(event, ...rest) {
        if (stop && event && typeof event.stopPropagation === "function") event.stopPropagation();
        if (!isPlainClick(event)) return undefined;
        if (event && typeof event.preventDefault === "function") event.preventDefault();
        return typeof handler === "function" ? handler(event, ...rest) : undefined;
    };
}

/**
 * Props that make an element a link to `href` (see the header).
 *
 *   <a className={classes.name} {...link("/@" + name, () => openAuthor(name))}>
 *   <ListItem button component="a" {...link("/" + portal, onOpen)}>
 *   <Button {...link(BROWSE_PATH, this._goToFeed)}>
 *
 * `onNavigate(event)` is optional: without it a plain click pushes `href`
 * (or replaces the entry with it, `replace`). No `href` — the data it is built
 * from has not arrived, or it is not an in-app path — gives a plain element:
 * every click runs `onNavigate`, as it did before the element was a link.
 */
export function link(href, onNavigate, options) {
    const to = isInAppPath(href) ? href : null;
    if (!to) {
        const stop = !!(options && options.stop);
        return {
            "data-nav": "",
            onClick(event, ...rest) {
                if (stop && event && typeof event.stopPropagation === "function") event.stopPropagation();
                return typeof onNavigate === "function" ? onNavigate(event, ...rest) : undefined;
            },
        };
    }
    const replace = !!(options && options.replace);
    const go = typeof onNavigate === "function"
        ? onNavigate
        : () => { if (replace) HISTORY.replace(to); else HISTORY.push(to); };
    return { href: to, "data-nav": "", draggable: false, onClick: linkClick(go, options) };
}

/** link(), with stable props while `href` and `onNavigate` are: for memo'd leaves. */
export function useLink(href, onNavigate, options) {
    const stop = !!(options && options.stop);
    const replace = !!(options && options.replace);
    return useMemo(
        () => link(href, onNavigate, { stop, replace }),
        [href, onNavigate, stop, replace],
    );
}

const closeTab = (tab) => {
    try { if (tab && !tab.closed) tab.close(); } catch (e) { /* not ours to close anymore */ }
};

/**
 * Where an asynchronous navigation will land, decided while the click is
 * still being handled (see the header). Call it before the first await.
 *
 *   const nav = pendingNavigation(event);
 *   if (nav.newTab) { nav.go(await resolveAddress()); return; }
 *   …the element's own in-tab flow, unchanged…
 *
 * newTab    the click asked for another tab; that tab is open already, blank.
 * go(to)    point it at `to` (falsy: close it). On a plain click: push `to`.
 * cancel()  close it — the address could not be resolved. Safe to call twice.
 */
export function pendingNavigation(event) {
    if (!wantsNewTab(event)) {
        return {
            newTab: false,
            go(to) { if (to) HISTORY.push(to); return !!to; },
            cancel() {},
        };
    }
    return pendingTab();
}

/**
 * A new tab, opened now and blank, for an address that is still being looked
 * up: go(to) points it there, cancel() closes it. Call it from the click's
 * own handler, before the first await (see pendingNavigation).
 */
export function pendingTab() {
    let tab = null;
    try { tab = window.open("", "_blank"); } catch (e) { tab = null; }
    // Same origin either way; the tab simply has no business reaching back.
    if (tab) { try { tab.opener = null; } catch (e) { /* ignore */ } }
    let settled = false;
    return {
        newTab: true,
        go(to) {
            if (settled) return false;
            settled = true;
            const url = absolute(to);
            if (!url) { closeTab(tab); return false; }
            if (tab && !tab.closed) {
                try { tab.location.replace(url); return true; } catch (e) { /* fall through */ }
            }
            // The blank tab was blocked or closed meanwhile: one more try.
            return openInNewTab(to);
        },
        cancel() {
            if (settled) return;
            settled = true;
            closeTab(tab);
        },
    };
}

/**
 * Props for an element that navigates but has no address to put in an href
 * (see the header). `onOpen(event)` runs for every click that opens the
 * target: the plain one, the modified ones and the middle button, which the
 * handler tells apart with pendingNavigation(event). `stop`: as in linkClick.
 */
export function deferredLink(onOpen, options) {
    const stop = !!(options && options.stop);
    const halt = (event) => {
        if (stop && event && typeof event.stopPropagation === "function") event.stopPropagation();
    };
    return {
        onClick(event) {
            halt(event);
            if (typeof onOpen === "function") onOpen(event);
        },
        // The middle button never fires `click`.
        onAuxClick(event) {
            if (!event || event.button !== 1) return;
            halt(event);
            event.preventDefault();
            if (typeof onOpen === "function") onOpen(event);
        },
        // …and on a non-link it would start the browser's autoscroll instead.
        onMouseDown(event) {
            if (event && event.button === 1) event.preventDefault();
        },
    };
}
