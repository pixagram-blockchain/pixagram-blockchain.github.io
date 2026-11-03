/**
 * utils/docLanguage.js — the language a generated document (PDF) is written in.
 *
 * A PDF can only print what its font can draw. The tax report uses pdf-lib's
 * StandardFonts (Helvetica, WinAnsi: no Polish, Czech, Turkish, Romanian,
 * Greek, Cyrillic, CJK or Indic letters — pdf-lib throws on them); the license
 * PDF embeds the Industry fonts (Latin-1 and most of Latin Extended-A, no
 * Greek, Cyrillic or CJK — a missing glyph prints as a box). So:
 *
 *   A document is written in the UI language when its font can print every
 *   string the document prints in that language, and in English otherwise.
 *   Its numbers and dates follow the document's language, not the UI's.
 *
 * renderInDocLanguage(render, { canPrint }) makes that choice:
 *   1. render(translator) in the UI language. The translator checks, with the
 *      document's `canPrint`, every string it hands out: labels, notes, plural
 *      words, formatted numbers and dates.
 *   2. If any of them cannot be printed, the document is rendered again in
 *      English and that one is returned.
 * The check therefore covers exactly the strings this document prints — not a
 * guessed list of keys — and nothing unprintable reaches the page. Text that
 * does not depend on the language (account names, artwork titles, tickers) is
 * not part of the choice; each renderer sanitises it.
 *
 * Engine output (utils/tax/*) carries tk() descriptors — { $t: key, v: vars },
 * the shape utils/text.js tk() builds — instead of prose, because the engine
 * also runs in Node, outside this runtime. `translator.text(x)` resolves them:
 * a number variable is formatted in the document's locale, an array becomes a
 * localised list, a nested descriptor is resolved first. uiText() does the same
 * in the UI language, for showing that output on screen.
 */

import { getLanguage, loadLocale, tIn, t, isTk } from "./text";
import { resolveLocale, formatNumber, formatDate } from "./numberFormat";

/** The language a document falls back to — and the one every key exists in. */
export const DOC_FALLBACK_LANGUAGE = "en";

/** Default precision for a number variable inside a descriptor. */
const VAR_DECIMALS = { min: 0, max: 4 };

/**
 * The locale a document in `lang` formats numbers and dates with: the user's
 * own locale from Settings ("fr-CH") when it is written in their language,
 * otherwise the bare language ("en" for an English fallback document).
 */
export const docLocale = (lang) => {
    const ui = resolveLocale();
    return String(ui).split("-")[0].toLowerCase() === lang ? ui : lang;
};

const upperIn = (s, locale) => {
    try { return String(s).toLocaleUpperCase(locale); } catch (_) { return String(s).toUpperCase(); }
};

/** `{ TUC, FLUC, AED }` from a descriptor's params — the subset documents use. */
const applyParams = (s, p, locale) => {
    let v = String(s);
    if (p.FLUC || p.fluc) v = v.charAt(0).toLocaleUpperCase(locale) + v.slice(1);
    if (p.TUC || p.tuc) v = upperIn(v, locale);
    if (p.AED || p.aed) v += ".";
    return v;
};

const listIn = (items, locale) => {
    try {
        if (typeof Intl !== "undefined" && Intl.ListFormat) {
            return new Intl.ListFormat(locale, { style: "short", type: "unit" }).format(items);
        }
    } catch (_) { /* unknown locale — plain join below */ }
    return items.join(", ");
};

/**
 * A descriptor resolver. `lookup(key, vars)` is the catalogue access (tIn for
 * a document, t for the UI); `number` and `list` format variables.
 */
const makeResolver = (lookup, number, list, locale) => {
    const resolveVar = (v) => {
        if (isTk(v)) return resolve(v);
        if (typeof v === "number") return number(v, VAR_DECIMALS);
        if (Array.isArray(v)) return list(v.map((x) => String(resolveVar(x))));
        return v;   // strings, plural specs ({ word: n }) and anything else pass through
    };
    const resolve = (x) => {
        if (isTk(x)) {
            let vars;
            if (x.v) {
                vars = {};
                const keys = Object.keys(x.v);
                for (let i = 0; i < keys.length; i++) vars[keys[i]] = resolveVar(x.v[keys[i]]);
            }
            const s = lookup(x.$t, vars);
            return x.p ? applyParams(s, x.p, locale) : s;
        }
        if (Array.isArray(x)) return x.map(resolve).join("");
        return x == null ? "" : String(x);
    };
    return resolve;
};

/**
 * Variables as the printability check sees them: scalar values become "0" —
 * a translated value was already checked when it was produced, and user text
 * (an account name, an artwork title) is not the language's to answer for —
 * while plural specs stay, so the plural word the template picks is checked.
 */
const probeVars = (vars) => {
    if (!vars) return vars;
    const out = {};
    const keys = Object.keys(vars);
    for (let i = 0; i < keys.length; i++) {
        const v = vars[keys[i]];
        out[keys[i]] = (v !== null && typeof v === "object") ? v : "0";
    }
    return out;
};

/**
 * A translator bound to one document language:
 *   t(key, vars)      catalogue string in `lang`
 *   text(x)           tk() descriptor (or plain string, or array of both) in `lang`
 *   number(n, dec)    number in the document's locale (dec: a count, or { min, max })
 *   date(d, options)  date in the document's locale, UTC (default: dateStyle "medium")
 *   upper(s)          locale-aware upper case
 *   printable         false once anything it produced failed `canPrint`
 * The language's file (and English, the fallback for keys it lacks) must be
 * loaded — renderInDocLanguage() does that.
 */
export const docTranslator = (lang, { canPrint } = {}) => {
    const locale = docLocale(lang);
    const failed = [];
    const check = (s) => {
        if (canPrint && typeof s === "string" && s !== "" && !canPrint(s)) failed.push(s);
        return s;
    };
    const lookup = (key, vars) => {
        const out = tIn(lang, key, vars);
        check(vars ? tIn(lang, key, probeVars(vars)) : out);
        return typeof out === "string" ? out : String(out == null ? "" : out);
    };
    const number = (n, decimals) => check(formatNumber(n, decimals == null ? VAR_DECIMALS : decimals, locale));
    const list = (items) => check(listIn(items, locale));
    const resolve = makeResolver(lookup, number, list, locale);
    return {
        lang,
        locale,
        t: (key, vars) => lookup(key, vars),
        // Not re-checked as a whole: its templates, numbers and lists were
        // checked as they were resolved; what remains is user data, which is
        // printed the same in any language (and sanitised by the renderer).
        text: (x) => resolve(x),
        number,
        date: (d, options) => check(formatDate(d, Object.assign({ timeZone: "UTC" }, options || { dateStyle: "medium" }), locale)),
        upper: (s) => check(upperIn(s, locale)),
        list,
        get printable() { return failed.length === 0; },
        unprintable: failed
    };
};

/**
 * Render a document in the UI language when its font can print every string
 * it prints in that language, else in English. `render(translator)` must be
 * repeatable (it may run twice); its result is returned as-is.
 */
export const renderInDocLanguage = async (render, { canPrint } = {}) => {
    const ui = getLanguage();
    // English is the fallback document AND what tIn() falls back to for a key
    // the language lacks, so it has to be in memory whichever one is chosen.
    await loadLocale(DOC_FALLBACK_LANGUAGE);
    if (ui !== DOC_FALLBACK_LANGUAGE && (await loadLocale(ui))) {
        const tr = docTranslator(ui, { canPrint });
        const out = await render(tr);
        if (tr.printable) return out;
    }
    return render(docTranslator(DOC_FALLBACK_LANGUAGE, { canPrint }));
};

/**
 * A translator in the UI language for output with no font limit (a CSV).
 * English is loaded first, so a key the language lacks comes out in English
 * rather than as its key.
 */
export const uiDocTranslator = async () => {
    await loadLocale(DOC_FALLBACK_LANGUAGE);
    return docTranslator(getLanguage());
};

/* ─────────────────────────── on-screen resolution ─────────────────────────── */

const uiNumber = (n, decimals) => formatNumber(n, decimals == null ? VAR_DECIMALS : decimals);
const uiLookup = (key, vars) => t(key, vars);

/**
 * A tk() descriptor (or a plain string) in the UI language — for engine output
 * shown on screen. Call it at render, in a component that follows language
 * changes (useLanguage / withLanguage).
 */
export const uiText = (x) => {
    const locale = resolveLocale();
    return makeResolver(uiLookup, uiNumber, (items) => listIn(items, locale), locale)(x);
};

/* ────────────────────────────── font checks ──────────────────────────────── */

/**
 * `canPrint` for a pdf-lib StandardFont (Helvetica…): encodeText() throws on a
 * character outside the font's encoding. `normalize` is what the renderer does
 * to a string before drawing it (typographic substitutions), if anything.
 */
export const standardFontCanPrint = (pdfFont, normalize) => (s) => {
    try {
        pdfFont.encodeText(normalize ? normalize(s) : s);
        return true;
    } catch (_) {
        return false;
    }
};

/**
 * `canPrint` for embedded TrueType fonts, given their fontkit objects: every
 * character needs a glyph in every one of them (regular, bold and italic text
 * mix in one paragraph). Line breaks and tabs are layout, not glyphs.
 */
export const fontkitCanPrint = (fonts, normalize) => (s) => {
    const v = normalize ? normalize(s) : String(s);
    for (const ch of v) {
        const cp = ch.codePointAt(0);
        if (cp === 9 || cp === 10 || cp === 13) continue;
        for (let i = 0; i < fonts.length; i++) {
            if (!fonts[i].hasGlyphForCodePoint(cp)) return false;
        }
    }
    return true;
};
