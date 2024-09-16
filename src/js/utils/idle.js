"use strict";

// ── idle / cancelIdle ──────────────────────────────────────────────────
// Safe wrapper around requestIdleCallback. Safari / iOS WebKit (and some
// embedded WebViews) do NOT implement requestIdleCallback, so a bare call
// throws a TypeError in the mount effect and can take the whole page down
// with it. Every idle-prefetch site (Feed, FeedPersonal, Community,
// Profile, Index) must go through this module instead of calling the
// global directly.
//
// The fallback is a 200 ms setTimeout: long enough to clear first paint
// and let above-the-fold work settle (the same intent as "idle"), short
// enough that warmed chunks are still ready well before the user can
// reach the UI that needs them.

const HAS_RIC =
    typeof window !== "undefined" &&
    typeof window.requestIdleCallback === "function" &&
    typeof window.cancelIdleCallback === "function";

const FALLBACK_DELAY_MS = 200;

/**
 * Schedule `fn` for browser idle time (or a short timeout fallback).
 * @param {Function} fn
 * @param {{timeout?: number}} [opts] forwarded to requestIdleCallback
 * @returns {number} handle for cancelIdle()
 */
export const idle = (fn, opts) => {
    if (HAS_RIC) return window.requestIdleCallback(fn, opts);
    return setTimeout(fn, FALLBACK_DELAY_MS);
};

/**
 * Cancel a handle previously returned by idle().
 * @param {number} id
 */
export const cancelIdle = (id) => {
    if (id == null) return;
    if (HAS_RIC) window.cancelIdleCallback(id);
    else clearTimeout(id);
};

export default idle;
