"use strict";

// ── Search configuration ──────────────────────────────────────────────────────
// The artwork/post leg talks to the pixagram-search Worker (D1 + FTS5 + Vectorize +
// SigLIP 2); everything else stays on the chain node through pixaAPI. The base
// URL can be overridden at runtime (window.__PIXAGRAM_SEARCH_API__) so a
// staging Worker can be pointed at without a rebuild.
//
// v3 adds what the box uses while typing: /suggest (completions, questions,
// titles, documentation sections, popular searches, and the placeholder's
// examples) and /query (an answer to a question: /ask about the artworks,
// /help about the platform). Against an older Worker they simply stay silent.
//
// v4 keeps all of it, field for field, and answers questions with its own
// engine: the index's answer first (result_text), and a reasoning model's
// explanation of it when that passed claim verification.
//
// v4.8 makes the answer a long one (the Worker's README, "Rich answers"): the
// index's answer with a deterministic digest (facts, overview, caveats,
// follow-up questions, related searches) comes back at once (/query with
// defer=1), and the model's part — a body of several paragraphs, its reasoning
// trail, its own follow-ups, every sentence verified — is fetched afterwards
// from GET /ask/elaboration/:query_id and merged in. /help answers at length
// too, with follow-up questions and related sections; every search carries a
// one-line overview; /suggest?after=<query_id> continues the conversation.
// Against a v4 Worker the extra fields are simply absent and the box shows the
// v4 answer; against a v3 one, the v3 answer.
export const SEARCH_API_URL = (
    (typeof window !== "undefined" && window.__PIXAGRAM_SEARCH_API__) ||
    "https://pixagram-search-v4.p1x4.workers.dev"
).replace(/\/+$/, "");

export const LIMITS = Object.freeze({
    users: 10,
    tags: 20,
    communities: 10,
    artworks: 15,
    posts: 5,
});

// Community accounts are named portal-<id>; lookup_accounts returns them like any
// account, but they belong in the Communities section (with title + picture), not Users.
export const COMMUNITY_ACCOUNT_RE = /^portal-\d+$/;

export const DEBOUNCE_MS = 250;
export const CACHE_TTL_MS = 600_000;   // 10 min, same as before
export const CACHE_MAX_TERMS = 50;

// Masonry: two columns, gap in px, corner radius of the artwork cards (shared by
// the avatars and the colour swatches' rounding).
export const MASONRY_COLUMNS = 2;
export const MASONRY_GAP = 8;
export const ARTWORK_RADIUS = 12;

// Desktop (MUI md and up): the open search widens by up to SEARCH_EXPAND_PX when
// the viewport has room to its right. The dropdown runs from the bar's bottom edge
// down to the viewport's (minus a gutter), within these bounds.
export const DESKTOP_MIN_WIDTH = 960;
export const SEARCH_EXPAND_PX = 192;
export const DROPDOWN_MIN_HEIGHT = 320;
export const DROPDOWN_MAX_HEIGHT = 786;

// Filter panel: suggestions shown under the author / community text fields.
export const SUGGEST_LIMIT = 6;

// ── v3: the box guesses ───────────────────────────────────────────────────────
// Suggestions are cheap (index lookups, cached at the edge): asked at every
// short pause in typing. Answers are not (an /ask plan or a documentation
// answer, 20 a minute per client): asked for a finished question ("…?") after a
// longer pause, for a question-like text after a long one, and at once on Enter
// or when a question is picked.
export const SUGGEST_DEBOUNCE_MS = 180;
export const SUGGEST_ROWS = 6;              // suggestion rows in the dropdown
export const ANSWER_DEBOUNCE_MS = 700;      // after "…?"
export const ANSWER_IDLE_MS = 1600;         // after a question word and three words, without "?"

// ── v4.8: the long answer, in two steps ───────────────────────────────────────
// /query?defer=1 answers from the index at once (one of the visitor's 20
// answers a minute); the model's part comes from GET /ask/elaboration/:id,
// which is on the ordinary request budget: the Worker runs the model the first
// time it is asked and holds the request meanwhile (up to its own model
// timeout, about two minutes for the deepest questions), so one call usually
// brings the whole elaboration. "pending" means another call is running it:
// asked again after ELABORATION_POLL_MS, ELABORATION_MAX_POLLS times at most.
// A transient failure (retry: true) is asked once more after
// ELABORATION_RETRY_MS; afterwards the card offers "Try again".
export const ELABORATION_POLL_MS = 1500;
export const ELABORATION_MAX_POLLS = 60;
export const ELABORATION_RETRY_MS = 1200;

// The answer's follow-up questions and related searches shown as chips under
// it (the Worker sends up to SEARCH_FOLLOW_UPS, six by default).
export const FOLLOW_UPS_SHOWN = 4;
export const SEARCHES_SHOWN = 3;

// After an answer, /suggest is asked with after=<query_id> so the answer's own
// follow-ups come first while typing: the Worker keeps them for half an hour.
export const CONVERSATION_TTL_MS = 25 * 60_000;

// The answer's longer parts: the body is shown whole up to this many
// characters, then cut with "Read more"; the facts, the reasoning trail and the
// caveats are folded by default (one click opens them).
export const BODY_FOLD_CHARS = 1400;

// The placeholder: the plain "Search" first, then the Worker's examples (in the
// UI language, from what the index holds), each fading out and the next in.
export const EXAMPLE_FIRST_MS = 2200;
export const EXAMPLE_INTERVAL_MS = 3800;
export const EXAMPLE_FADE_MS = 280;

// The Worker's 20 colour buckets (name + representative hex), in the order the
// swatches are drawn. /vocab is the source of truth and replaces this at runtime.
// SWATCH_HEX overrides the drawn colour where the representative one would vanish
// on the dark panel (the swatches have no border).
export const DEFAULT_COLORS = Object.freeze([
    { name: "black", hex: "#111111" },
    { name: "white", hex: "#f4f4f4" },
    { name: "gray", hex: "#808080" },
    { name: "red", hex: "#d62828" },
    { name: "orange", hex: "#f77f00" },
    { name: "yellow", hex: "#f5d000" },
    { name: "green", hex: "#2a9d3f" },
    { name: "lime", hex: "#9bdc28" },
    { name: "teal", hex: "#1f9e93" },
    { name: "cyan", hex: "#3cc8e8" },
    { name: "sky", hex: "#8ec8f0" },
    { name: "blue", hex: "#2a5fd1" },
    { name: "navy", hex: "#1b2a5c" },
    { name: "purple", hex: "#7b3fbf" },
    { name: "magenta", hex: "#d63ba8" },
    { name: "pink", hex: "#f5a3c7" },
    { name: "brown", hex: "#7a4a26" },
    { name: "tan", hex: "#d2b48c" },
    { name: "olive", hex: "#7a7a2a" },
    { name: "maroon", hex: "#6e1a2a" },
]);

export const SWATCH_HEX = Object.freeze({ black: "#000000" });
