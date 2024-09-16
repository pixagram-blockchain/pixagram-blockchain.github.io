"use strict";

// ── motion ─────────────────────────────────────────────────────────────
// Shared motion/design tokens. These were declared independently in
// Feed.js (EASE, RAINBOW_RIPPLE), FeedPersonal.js (EASE), Community.js
// (EASE_STANDARD, TRANSITION_*, RAINBOW_RIPPLE, RAINBOW_RIPPLE_SIMPLE)
// and Profile.js (E, TF, TM, TE, RIPPLE, slideKF) — same values, four
// names, four chances to drift. Pages alias on import to keep their
// bodies untouched, e.g.:
//
//     import { EASE as E, TRANSITION_FAST as TF } from "../theme/motion";

export const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

export const TRANSITION_FAST = `225ms ${EASE} 5ms`;
export const TRANSITION_MEDIUM = `225ms ${EASE} 75ms`;
export const TRANSITION_ENTRY = `300ms ${EASE} 0ms`;

export const RAINBOW_RIPPLE = `radial-gradient(
    circle at 50% 50% in hsl shorter hue,
    #f000ff6b, #0095ffdb, #0cffe9ba, #d8ff00b5, #f59300c2, #6f0000c7, transparent, transparent
)`;

export const RAINBOW_RIPPLE_SIMPLE = `radial-gradient(circle at 50% 50%,
    magenta 0%, blue 20%, cyan 40%, green 60%, yellow 80%, red 100%)`;

// JSS keyframe-body generator for the slide-in entrances
// (translateX/translateY + opacity).
export const slideKF = (axis, from) => ({
    "0%": { transform: `translate${axis}(${from}px)`, filter: "opacity(0)" },
    "100%": { transform: `translate${axis}(0px)`, filter: "opacity(1)" },
});
