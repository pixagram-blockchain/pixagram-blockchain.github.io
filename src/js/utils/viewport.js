"use strict";

// ── Visible viewport height as a CSS custom property ────────────────────
//
//   --app-h   the height of the area the page is laid out in, in px
//             (document.documentElement.clientHeight — the initial
//             containing block, exactly what `height: 100%` on <html>
//             resolves to).
//
// Why not just 100vh / 100dvh / 100svh: this document never scrolls (html
// overflow: hidden), so mobile browser toolbars never collapse and the only
// height that matters is the one between them. The viewport units disagree
// about it from browser to browser:
//
//   · vh  is the toolbar-HIDDEN height on Android Chrome and iOS Safari —
//         ~56–110px more than is ever on screen here;
//   · dvh is right in Chrome, but Brave's ignores its bottom toolbar, so it
//         is that same large height there (the feed's CREATE button sat half
//         under Brave's toolbar because of it);
//   · none of them are measured, they are each engine's own bookkeeping.
//
// clientHeight is the measured box itself, so a style written as
//
//       height: calc(var(--app-h, 100vh) - 96px)
//
// fits the screen in every engine. The fallback only applies if this module
// never ran.
//
// Cost: one property write per actual change of height — the listener is
// rAF-coalesced and bails when nothing moved. It deliberately does NOT follow
// visualViewport: the on-screen keyboard shrinks the VISUAL viewport only
// (Chrome ≥ 108, Safari), and dialogs re-flowing every time a field is
// focused would be worse than the keyboard overlapping their lower part — the
// dialogs that need the keyboard-aware height (LoginDialog, CreateAccountDialog)
// track visualViewport themselves.
//
// Installed at module evaluation (client.js imports it first), so the value
// exists before the first React render reads any style that uses it.

const root = typeof document !== "undefined" ? document.documentElement : null;
let lastHeight = -1;
let rafId = 0;

function measure() {
    rafId = 0;
    if (!root) return;
    const h = root.clientHeight || window.innerHeight || 0;
    if (h <= 0 || h === lastHeight) return;
    lastHeight = h;
    root.style.setProperty("--app-h", h + "px");
}

function schedule() {
    if (rafId) return;
    rafId = window.requestAnimationFrame(measure);
}

if (root && typeof window !== "undefined") {
    measure();
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("orientationchange", schedule, { passive: true });
    // A page restored from the back/forward cache may come back at another size.
    window.addEventListener("pageshow", schedule, { passive: true });
}

/** The last measured visible height, in px (0 before the first measure). */
export const getAppHeight = () => Math.max(0, lastHeight);

export default getAppHeight;
