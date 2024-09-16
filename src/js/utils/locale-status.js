/**
 * utils/locale-status.js
 *
 * Single source of truth for "how well is this locale actually served?".
 * Drives the flag colouring in SettingsDialog, and replaces the old
 * `LANGUAGES = ["en"]` constant in utils/constants.js — a hand-maintained
 * one-element list that greyed out every flag except English.
 *
 * Three things are deliberately kept apart, because they are different
 * questions and only the first one is a yes/no:
 *
 *   1. Does a locale file load for this code?     -> STATUS
 *   2. Is that file written in the right script /
 *      regional convention for this code?         -> VARIANTS
 *   3. How much of the catalog is filled in?      -> COVERAGE
 *
 * A locale can load perfectly and still be the wrong variant. zh.js is
 * Simplified, so it loads for zh-TW and zh-HK but shows the wrong script to
 * readers who expect Traditional. Presenting that as "fully available" would
 * be a lie told in colour, so it gets its own state.
 */

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE LIST — edit this and nothing else.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * One row per file in src/locales/. Adding a language is one line; removing
 * one is deleting that line. `TRANSLATED` and `COVERAGE` below are derived
 * from this, so they cannot fall out of step with each other.
 *
 *   code      the filename without .js — "de" for locales/de.js. Use an
 *             underscore for a regional file: "pt_br" for locales/pt_br.js.
 *   coverage  how much of the catalog is filled in, 0–1. Shown as a badge in
 *             Settings. Informational only — a 6 % locale renders fine, every
 *             missing key just falls through to English.
 *
 * If you list a code whose file does not exist, nothing breaks: setLanguage()
 * fails to load it and falls back. The only symptom is an optimistic flag in
 * Settings — a colour flag for a language that shows English. So when you
 * delete a locale file, delete its line here too.
 */
export const LOCALE_FILES = [
    { code: "en", coverage: 1.00 },   // the source of truth
    { code: "de", coverage: 0.95 },
    { code: "es", coverage: 0.95 },
    { code: "fr", coverage: 0.95 },
    { code: "hi", coverage: 0.95 },
    { code: "id", coverage: 0.95 },
    { code: "it", coverage: 0.95 },
    { code: "ja", coverage: 0.95 },
    { code: "ko", coverage: 0.95 },
    { code: "pt", coverage: 0.95 },
    { code: "ru", coverage: 0.95 },
    { code: "zh", coverage: 0.95 },
    { code: "el", coverage: 0.95 },
    { code: "bn", coverage: 0.95 },
    { code: "no", coverage: 0.95 },
    { code: "sv", coverage: 0.95 },
    { code: "cs", coverage: 0.95 },
    { code: "da", coverage: 0.95 },
    { code: "sk", coverage: 0.95 },
    { code: "uk", coverage: 0.95 },
    { code: "fi", coverage: 0.95 },
    { code: "hu", coverage: 0.95 },
    { code: "ta", coverage: 0.95 },
    { code: "tr", coverage: 0.95 },
    { code: "nl", coverage: 0.95 },
    { code: "pl", coverage: 0.95 },
    { code: "ro", coverage: 0.95 }
    // { code: "pt_br", coverage: 0.40 },   // regional file, once it exists
];

/* ── derived — nothing below needs editing when you add a language ────────── */

/** Regional files, e.g. "pt_br" for locales/pt_br.js */
export const TRANSLATED_REGIONAL = LOCALE_FILES
    .map((l) => l.code)
    .filter((c) => c.includes("_"));

/** Base-language files, e.g. "de" for locales/de.js */
export const TRANSLATED = LOCALE_FILES
    .map((l) => l.code)
    .filter((c) => !c.includes("_"));

/** code -> 0–1, for the Settings badge. */
export const COVERAGE = LOCALE_FILES.reduce((acc, l) => {
    acc[l.code] = l.coverage;
    return acc;
}, {});

/**
 * Region codes whose base file loads but was NOT written for that region.
 * The value is what the reader will actually get, so the UI can say so.
 *
 * These are not fixed by editing this map — they are fixed by adding a
 * regional file to LOCALE_FILES above, at which point the entry becomes dead.
 */
export const VARIANTS = {
    "zh-tw": "Simplified characters — this locale expects Traditional",
    "zh-hk": "Simplified characters — this locale expects Traditional",
    "pt-br": "European Portuguese wording (utilizador, iniciar sessao)"
};

const norm = (code) => String(code || "").toLowerCase();

/**
 * Locales whose script runs right-to-left.
 *
 * This is a fourth question, separate from the three above, and it is the one
 * a catalog cannot answer on its own: he.js can be 100 % translated and still
 * render in a left-to-right layout, which is the same class of untruth as
 * zh.js showing Simplified to a Traditional reader — the words are right and
 * the presentation is wrong.
 *
 * Covers content languages too, not just UI locales: a community may be
 * written in Arabic whether or not the interface is.
 *
 * `utils/text.js` imports this set for `<html dir>`, which it already sets on
 * every setLanguage() — so the document direction is handled. What is NOT
 * handled is the component layer: MUI v4 emits physical properties
 * (marginLeft, paddingRight, textAlign: left), and those do not follow
 * `dir`. Until the theme carries `direction: "rtl"` and jss-rtl is in the
 * JSS plugin chain, `describe(code).rtl` is true and the layout is still
 * mirrored the wrong way. Kept visible rather than assumed away.
 */
export const RTL = new Set(["ar", "he", "fa", "ur"]);

/** @param {string} code e.g. "he" or "ar-EG" */
export const is_rtl = (code) => RTL.has(norm(code).split("-")[0]);

export const STATUS = {
    FULL: "full",         // dedicated file for this exact code
    BASE: "base",         // dedicated file for the base language, right variant
    VARIANT: "variant",   // base file loads, but wrong script / regional wording
    FALLBACK: "fallback"  // no file at all — renders in English
};

/** @param {string} code e.g. "de-AT" */
export const status_of = (code) => {
    const safe = norm(code);
    const lang = safe.split("-")[0];
    const regional = safe.replace("-", "_");
    if (TRANSLATED_REGIONAL.includes(regional)) return STATUS.FULL;
    if (!TRANSLATED.includes(lang)) return STATUS.FALLBACK;
    return Object.prototype.hasOwnProperty.call(VARIANTS, safe)
        ? STATUS.VARIANT
        : STATUS.BASE;
};

/** Fraction of the catalog this code will actually find translated, 0-1. */
export const coverage_of = (code) => {
    const lang = norm(code).split("-")[0];
    return COVERAGE[lang] || 0;
};

/** The caveat for a VARIANT code, or "" when there is nothing to warn about. */
export const variant_note = (code) => VARIANTS[norm(code)] || "";

/** True when picking this code changes anything at all from plain English. */
export const is_live = (code) => status_of(code) !== STATUS.FALLBACK;

/**
 * Every base language that has a file. Drop-in replacement for the old
 * `LANGUAGES` constant so existing `LANGUAGES.includes(...)` call sites keep
 * working while meaning something true.
 */
export const LANGUAGES = TRANSLATED.slice();

/**
 * Languages a COMMUNITY may be written in — a different question from which
 * languages the interface is translated into, and it must not be answered by
 * the same list.
 *
 * Both used to read `LANGUAGES = ["en"]`, so a French-speaking portal could
 * not be marked as French: the on-chain `lang` field offered exactly one
 * option. Serving this from TRANSLATED would still be wrong — a community can
 * be written in Polish whether or not our UI is.
 *
 * Derived from the base codes of utils/constant_locales, deduplicated and
 * sorted. Kept here as a literal rather than computed from that module,
 * because constant_locales carries JSX flag components and this file is
 * imported by non-render code.
 */
export const CONTENT_LANGUAGES = [
    "bn", "cs", "da", "de", "el", "en", "es", "fi", "fr",
    "hi", "hu", "id", "it", "ja", "ko", "nl", "no", "pl",
    "pt", "ro", "ru", "sk", "sv", "ta", "th", "tr", "uk", "zh"
];

/** Endonym for the community-language dropdown, so the option reads natively. */
export const LANGUAGE_NAME = {
    ar: "العربية", bn: "বাংলা", cs: "Čeština", da: "Dansk", de: "Deutsch",
    el: "Ελληνικά", en: "English", es: "Español", fi: "Suomi", fr: "Français",
    he: "עברית", hi: "हिन्दी", hu: "Magyar", id: "Bahasa Indonesia",
    it: "Italiano", ja: "日本語", ko: "한국어", nl: "Nederlands", no: "Norsk",
    pl: "Polski", pt: "Português", ro: "Română", ru: "Русский", sk: "Slovenčina",
    sv: "Svenska", ta: "தமிழ்", th: "ไทย", tr: "Türkçe", uk: "Українська",
    zh: "中文"
};

/**
 * Presentation for the Settings option row.
 *
 * `flag` is a CSS filter applied to the <img>, not a separate asset: the flag
 * SVG is always rendered in colour and desaturated here when the locale is not
 * served. One source of truth, and a third state costs nothing.
 */
export const PRESENTATION = {
    [STATUS.FULL]:     { flag: "none",                      text: "#ffffff", note: "" },
    [STATUS.BASE]:     { flag: "none",                      text: "#ffffff", note: "" },
    [STATUS.VARIANT]:  { flag: "saturate(0.45)",            text: "#d8d8d8", note: "" },
    [STATUS.FALLBACK]: { flag: "grayscale(1) opacity(0.5)", text: "#6d6d6d", note: "" }
};

/** Everything SettingsDialog needs for one row, in a single call. */
export const describe = (code) => {
    const status = status_of(code);
    return {
        status,
        live: status !== STATUS.FALLBACK,
        coverage: coverage_of(code),
        rtl: is_rtl(code),
        note: variant_note(code),
        ...PRESENTATION[status]
    };
};

/** Kept for compatibility with the previous two-colour API. */
export const COLOR = {
    [STATUS.FULL]: "#ffffff",
    [STATUS.BASE]: "#ffffff",
    [STATUS.VARIANT]: "#d8d8d8",
    [STATUS.FALLBACK]: "#6d6d6d"
};