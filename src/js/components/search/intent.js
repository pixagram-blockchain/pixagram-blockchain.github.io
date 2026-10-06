"use strict";

import { ANSWER_DEBOUNCE_MS, ANSWER_IDLE_MS } from "./config";

// ── What the text in the box is asking for ────────────────────────────────────
// Pure helpers (no React, no network), shared by useSearch and the bar:
//
//   answerPlan(text)        whether to ask /query for an answer, how soon, and
//                           where: null (a plain search), { route: null } (a
//                           question: the Worker's router decides between /ask
//                           and /help), { route: "help" } (a documentation
//                           section picked from the suggestions)
//   ghostFor(value, completion)   the rest of the Worker's completion, shown
//                           as ghost text after the letters typed
//   splitSuggestion(text, value)  { typed, rest } for a suggestion row that
//                           extends the text: the typed part is drawn dimmed
//
// The Worker decides what a question is about (its router knows titles, the
// documentation and the platform's words); the box only decides when asking is
// worth an answer budget: a finished question ("…?"), or a question word and
// three words after a long pause, or Enter.

// Question words that start a question in the languages Pixagram users write
// in, folded (lower case, no accents). Words that also start ordinary titles
// ("come", "como", "que", "do", "is") are left out: with "?" those questions
// are recognised anyway.
const QUESTION_WORDS = new Set([
    // English
    "who", "whom", "whose", "what", "whats", "when", "where", "which", "why", "how", "hows",
    // French
    "qui", "quoi", "quel", "quelle", "quels", "quelles", "quand", "comment", "combien", "pourquoi", "qu'est-ce", "est-ce",
    // German
    "wer", "wen", "wem", "wessen", "was", "wann", "wo", "woher", "wohin", "welche", "welcher", "welches", "welchen",
    "warum", "weshalb", "wieso", "wie", "wieviel", "wieviele",
    // Spanish
    "quien", "quienes", "cual", "cuales", "cuando", "donde", "cuanto", "cuantos", "cuanta", "cuantas",
    // Italian
    "chi", "cosa", "dove", "quale", "quali", "perche", "quanto", "quanti", "quante",
    // Portuguese
    "quem", "qual", "quais", "onde", "quantos", "quantas",
]);

// Words a finished question does not end with: it is still being typed ("who posted the",
// "combien de", "wer hat die erste"). Only for the long pause without "?" (answerPlan).
const UNFINISHED = new Set([
    // English
    "the", "a", "an", "of", "to", "in", "on", "at", "for", "with", "by", "from", "and", "or", "my", "your", "his", "her",
    "their", "our", "its", "this", "that", "these", "those", "is", "are", "was", "were", "most", "first", "last", "latest", "many",
    // French
    "le", "la", "les", "l'", "un", "une", "des", "de", "du", "d'", "au", "aux", "et", "ou", "mon", "ma", "mes", "son", "sa",
    "ses", "plus", "premier", "premiere", "dernier", "derniere", "qui", "que",
    // German
    "der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer", "und", "oder", "mit", "von", "im",
    "am", "erste", "ersten", "erstes", "neueste", "neuesten", "meisten", "viele", "hat",
    // Spanish, Italian, Portuguese
    "el", "los", "las", "una", "del", "y", "o", "con", "por", "para", "primer", "primera", "il", "lo", "gli", "uno", "di",
    "della", "dei", "e", "primo", "os", "as", "um", "uma", "do", "da", "dos", "das", "com", "primeiro",
]);

/** Lower case, no accents, typographic apostrophes as "'". */
export function fold(s) {
    return String(s == null ? "" : s)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[’ʼ]/g, "'");
}

const words = (s) => fold(s).split(/\s+/).filter(Boolean);

/** A documentation section as /suggest names it: "Title › Heading". */
export const SECTION_SEP = " › ";
export const isSection = (text) => String(text || "").includes(SECTION_SEP);

/** Ends like a question: "?", the full-width "？", or starts with the Spanish "¿". */
export function endsAsQuestion(text) {
    const s = String(text || "").trim();
    return /[?？]$/.test(s) || /^¿/.test(s);
}

/** Starts with a question word ("who", "combien", "wie", "qu'est-ce"…). */
export function startsAsQuestion(text) {
    const first = words(String(text || "").replace(/^¿/, ""))[0] || "";
    if (QUESTION_WORDS.has(first)) return true;
    // "what's", "qu'est-ce", "quelle's": the word before the apostrophe
    const head = first.split("'")[0];
    return head !== first && (QUESTION_WORDS.has(head) || QUESTION_WORDS.has(first.replace(/'/g, "")));
}

export function looksLikeQuestion(text) {
    return endsAsQuestion(text) || (startsAsQuestion(text) && words(text).length >= 2);
}

/**
 * Whether the text deserves an answer, and when. `how`:
 *   "type"    while typing: a finished question after ANSWER_DEBOUNCE_MS, a
 *             question-like text of three words or more after ANSWER_IDLE_MS
 *             (not one that ends like it goes on: "who posted the")
 *   "submit"  Enter, a pick, a restored search: at once, for any question-like
 *             text or documentation section
 * Returns null (no answer) or { route: null | "help", q, delay }.
 */
export function answerPlan(text, how = "type") {
    const value = String(text || "").trim();
    if (value.length < 3) return null;
    if (isSection(value)) {
        // A documentation section from the suggestions: its words, to /help.
        return { route: "help", q: value.split(SECTION_SEP).join(" "), delay: 0 };
    }
    if (how === "submit") return looksLikeQuestion(value) ? { route: null, q: value, delay: 0 } : null;
    if (endsAsQuestion(value) && words(value).length >= 2) return { route: null, q: value, delay: ANSWER_DEBOUNCE_MS };
    const w = words(value);
    if (startsAsQuestion(value) && w.length >= 3 && !UNFINISHED.has(w[w.length - 1])) return { route: null, q: value, delay: ANSWER_IDLE_MS };
    return null;
}

/**
 * The rest of `completion` after `value`, when the completion extends what is
 * typed (case aside); "" otherwise. The letters typed stay as typed.
 */
export function ghostFor(value, completion) {
    const v = String(value || "");
    const c = typeof completion === "string" ? completion : "";
    if (!v.trim() || c.length <= v.length) return "";
    return c.slice(0, v.length).toLowerCase() === v.toLowerCase() ? c.slice(v.length) : "";
}

/** { typed, rest } when the suggestion extends the text typed (case aside), else null. */
export function splitSuggestion(text, value) {
    const s = String(text || "");
    const v = String(value || "").replace(/^\s+/, "");
    if (!v || s.length <= v.length || s.slice(0, v.length).toLowerCase() !== v.toLowerCase()) return null;
    return { typed: s.slice(0, v.length), rest: s.slice(v.length) };
}
