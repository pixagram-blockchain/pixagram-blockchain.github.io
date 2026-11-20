"use strict";

// ── The subheader in focus ────────────────────────────────────────────────────
// The results are a run of sections, each under a sticky subheader — Users, Tags,
// Communities, History (Index's own rows), Posts, Artworks, in that order, each
// only when it has something to show. The subheader in focus is the one standing
// at the top of the list's window: the section the reader has scrolled to. At
// the top of the list there is none.
//
// It is part of the search's address (+search-…, Index §8d) by its key below, so
// the back arrow, a reload or a shared link brings the list back to it — and,
// for any subheader at all, the search back as the full-screen panel
// (fullScreen.js: "An order").
//
// Every subheader carries its key in SECTION_ATTR (sectionMark): the list is read
// from the DOM, where the sections are, whoever renders them.

/** The sections' keys, in the order they stand in the list. */
export const SECTIONS = Object.freeze(["users", "tags", "communities", "history", "posts", "artworks"]);

export const SECTION_ATTR = "data-search-section";

// A stuck subheader stands on the window's top edge, give or take a fraction of a pixel.
const FOCUS_SLACK_PX = 1;

/** The props that mark a subheader as its section's: <ListSubheader {...sectionMark("users")}>. */
export const sectionMark = (key) => ({ [SECTION_ATTR]: key });

/** A section's key from anything (the address, a report), or null: none. */
export const normalizeFocus = (v) => (typeof v === "string" && SECTIONS.includes(v) ? v : null);

/** The top edge of the list's window (where a subheader sticks), in viewport coordinates. */
const windowTop = (list) => list.getBoundingClientRect().top + list.clientTop;

/**
 * The subheader in focus in the scrolling `list`: the last one, in the order they stand, that
 * has reached the top of the list's window. Null for none: the list is at its top, or still above
 * its first section (the suggestions, an answer).
 *
 * Read from where the subheaders are drawn. A sticky one stays on the window's top edge once its
 * section has reached it (or leaves above it with its section), so it stands at or above that
 * edge exactly when its section does.
 */
export function focusOf(list) {
    if (!list || !(list.scrollTop > 0)) return null;
    const top = windowTop(list) + FOCUS_SLACK_PX;
    const headers = list.querySelectorAll(`[${SECTION_ATTR}]`);
    let focus = null;
    for (let i = 0; i < headers.length; i++) {
        const r = headers[i].getBoundingClientRect();
        if (r.height > 0 && r.top <= top) focus = headers[i].getAttribute(SECTION_ATTR);
    }
    return normalizeFocus(focus);
}

/**
 * The subheader the list goes to for `focus`: its own when that section is there; else the next
 * one that is (where the missing one would stand), else the one before. Null without any section.
 */
function headerFor(list, focus) {
    const at = SECTIONS.indexOf(focus);
    if (at === -1) return null;
    const there = new Map();
    const headers = list.querySelectorAll(`[${SECTION_ATTR}]`);
    for (let i = 0; i < headers.length; i++) {
        const key = headers[i].getAttribute(SECTION_ATTR);
        if (!there.has(key)) there.set(key, headers[i]);
    }
    for (let i = at; i < SECTIONS.length; i++) if (there.has(SECTIONS[i])) return there.get(SECTIONS[i]);
    for (let i = at - 1; i >= 0; i--) if (there.has(SECTIONS[i])) return there.get(SECTIONS[i]);
    return null;
}

/**
 * Put the list where `focus` says: that subheader at the top of the list's window (the nearest
 * section's when its own has nothing to show), as far as the list can scroll — or, for none, the
 * list at its top. Returns whether there was a section to go to; without one the list is left at
 * its top.
 */
export function scrollToFocus(list, focus) {
    if (!list) return false;
    const header = focus ? headerFor(list, focus) : null;
    // From the list's top, where no subheader is stuck: each stands where its section starts.
    list.scrollTop = 0;
    if (!header) return false;
    const top = header.getBoundingClientRect().top - windowTop(list);
    // (a pixel down at least: at the very top of the list no subheader is in focus)
    list.scrollTop = Math.max(1, Math.ceil(top));
    // A subheader still below the window's top edge is not stuck: it stands where its section
    // starts, so what is left to it is exact — one more step, should the first have fallen short.
    // (It changes nothing when the list simply ended before the section could reach the top.)
    const left = header.getBoundingClientRect().top - windowTop(list);
    if (left > FOCUS_SLACK_PX) list.scrollTop += Math.ceil(left);
    return true;
}
