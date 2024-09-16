"use strict";

// ── visibility ─────────────────────────────────────────────────────────
// Shared primitives for "don't animate / poll what nobody can see."
//
//   Suggested location: src/utils/visibility.js
//
// The codebase currently has ZERO references to `visibilitychange`,
// `document.hidden`, or `IntersectionObserver`, so every rAF loop and
// timer (WebGL buttons, cobe Globe, carousel autoplay, GDAttributes'
// 1 s countdown + 30 s metrics poll) keeps burning CPU/network in
// background tabs and below the fold. These four helpers cover all of
// those cases:
//
//   pageVisible()                 — sync: is the tab visible right now?
//   onPageVisibility(cb)          — cb(visible) on every tab show/hide;
//                                   returns unsubscribe.
//   whenVisible(el, cb)           — cb(inView) when `el` enters/leaves
//                                   the viewport; returns unsubscribe.
//   visibleRafLoop(el, frame)     — requestAnimationFrame loop that
//                                   auto-pauses while the tab is hidden
//                                   OR `el` is off-screen, and resumes
//                                   seamlessly; returns cancel.
//   gatedInterval(fn, ms, opts)   — setInterval that skips ticks while
//                                   the tab is hidden; returns clear.
//
// All helpers are SSR-safe (no-op sensibly without `document`) and
// degrade gracefully where IntersectionObserver is unavailable
// (element treated as always in view; tab visibility still applies).
// ───────────────────────────────────────────────────────────────────────

/** Synchronous check — treats non-browser environments as visible. */
export function pageVisible() {
    return typeof document === "undefined" ||
        document.visibilityState !== "hidden";
}

/**
 * Subscribe to tab visibility changes. `cb(visible)` fires on every
 * change (not on subscribe). Returns an unsubscribe function.
 */
export function onPageVisibility(cb) {
    if (typeof document === "undefined") return () => {};
    const handler = () => cb(pageVisible());
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
}

/**
 * Observe whether `el` intersects the viewport. `cb(inView)` fires on
 * every transition. Without IntersectionObserver support, fires
 * `cb(true)` once and becomes a no-op. Returns an unsubscribe function.
 */
export function whenVisible(el, cb, options) {
    if (!el || typeof IntersectionObserver === "undefined") {
        cb(true);
        return () => {};
    }
    const io = new IntersectionObserver((entries) => {
        // Only the most recent entry matters for a single target.
        cb(entries[entries.length - 1].isIntersecting);
    }, options || { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
}

/**
 * requestAnimationFrame loop that runs ONLY while the tab is visible
 * and (when `el` is given) the element is on-screen.
 *
 *   const cancel = visibleRafLoop(canvas, (time, dt) => draw(time));
 *   …
 *   cancel(); // on unmount — fully tears down listeners/observers
 *
 * `frame(timeMs, dtMs)` receives the rAF timestamp plus a delta that is
 * clamped on resume (≤100 ms), so physics/animation code never sees a
 * giant jump after the tab was backgrounded for an hour.
 */
export function visibleRafLoop(el, frame, options) {
    let rafId = 0;
    let last = 0;
    let cancelled = false;
    let tabVisible = pageVisible();
    let elVisible = true; // optimistic until the observer reports

    const tick = (time) => {
        rafId = 0;
        if (cancelled) return;
        const dt = last ? Math.min(time - last, 100) : 16;
        last = time;
        frame(time, dt);
        schedule();
    };

    const schedule = () => {
        if (!cancelled && tabVisible && elVisible && !rafId) {
            rafId = requestAnimationFrame(tick);
        }
    };

    const stop = () => {
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = 0;
        }
        last = 0; // forces a clamped dt on resume
    };

    const update = () => { (tabVisible && elVisible) ? schedule() : stop(); };

    const offPage = onPageVisibility((v) => { tabVisible = v; update(); });
    const offEl = el
        ? whenVisible(el, (v) => { elVisible = v; update(); }, options)
        : () => {};

    update();

    return function cancel() {
        cancelled = true;
        stop();
        offPage();
        offEl();
    };
}

/**
 * setInterval that silently skips ticks while the tab is hidden — the
 * timer stays armed, so visibility resumption needs no re-wiring.
 *
 *   this._cancelPoll = gatedInterval(poll, 30000, { fireOnResume: true });
 *   …
 *   this._cancelPoll(); // instead of clearInterval
 *
 * `fireOnResume: true` additionally runs `fn` immediately when the tab
 * becomes visible again — right for "refresh stale data now" polls,
 * wrong for fixed-cadence countdowns (leave it off there).
 */
export function gatedInterval(fn, ms, opts) {
    const id = setInterval(() => { if (pageVisible()) fn(); }, ms);
    const offPage = (opts && opts.fireOnResume)
        ? onPageVisibility((v) => { if (v) fn(); })
        : null;
    return function clear() {
        clearInterval(id);
        if (offPage) offPage();
    };
}
