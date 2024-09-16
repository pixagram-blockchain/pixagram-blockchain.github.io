import { useState, useEffect } from "preact/hooks";
/**
 * utils/text.js — remastered translation runtime.
 *
 * Design contract (why it is shaped like this):
 *
 *  1. `t()` MUST stay synchronous. It is called inline inside render() in
 *     ~178 components. Any async signature would require touching every call
 *     site. So: `en` is statically imported as the guaranteed baseline, and
 *     every other locale is fetched with a dynamic `import()` that produces
 *     its own webpack chunk. Until the chunk lands, `t()` answers from the
 *     baseline and notifies subscribers when the real bundle arrives.
 *
 *  2. No JSON.stringify -> string replace -> JSON.parse round trip. That was
 *     both the hot-path cost and the injection primitive (see report).
 *     Interpolation now happens on already-parsed strings, in ONE pass, with
 *     a callback replacer, so a substituted value can never introduce a new
 *     token and can never be re-scanned.
 *
 *  3. Lookups go through a flat Map built once per locale. No `obj[seg]`
 *     walking, therefore no prototype-chain traversal, no `__proto__` reach.
 *
 *  4. A missing key returns the key. It never throws. An incomplete locale
 *     must degrade, not white-screen the app.
 *
 * ── engine notes (what the optimisation pass changed and why) ──────────────
 *
 *  t() sits on the render path of every component, so its cost is paid a few
 *  thousand times per frame budget. The rules applied throughout this file:
 *
 *   - Do not allocate on the common path. Default parameters (`= {}`),
 *     `Object.keys()` probes, `{ ...a, ...b }` merges, rest arguments and
 *     `for (const [k, v] of map)` destructuring each hand the GC an object
 *     per call. Every one of them has been removed from the hot path.
 *   - Do not recompute what the language change already invalidates. The
 *     fallback chain, the resolved-value cache, the raw-lookup cache and the
 *     expanded-SVG cache are all keyed by nothing but the path, because they
 *     are dropped wholesale when the active bundle changes.
 *   - Do not build what nobody asked for. The FAW secondary index doubles
 *     index-build time and allocates two strings per catalogue entry, and
 *     most sessions never issue a FAW lookup — so it is built on first use.
 *   - Prefer the narrow regex. A string carrying only `{{name}}` tokens is
 *     the overwhelming majority, and it no longer pays for the plural/SVG
 *     alternation or for the `solePluralKey()` pre-scan.
 *   - Construct expensive platform objects once. `Intl.PluralRules` is
 *     memoised per locale code instead of being built per plural resolution.
 */

import en from "../locales/en";
import { RTL } from "./locale-status";

/**
 * A locale module reaches us in one of two shapes and we do not get to pick
 * which: as the catalogue object itself, or wrapped in an ESM namespace with
 * the catalogue on `.default`. Which one depends on how the file was authored
 * (`export default` vs `module.exports`) and how it was pulled in (static
 * import, dynamic import(), or require()) — and those can disagree.
 *
 * Getting it wrong does not throw. buildIndex() happily walks the namespace
 * and produces "default.components.home.x" for every path, so every lookup
 * misses and t() answers with the key — the whole UI renders as bare
 * snake_case identifiers, in every language. Normalise once, here, and let
 * every load path go through it.
 */
const unwrapLocale = (m) => (m && typeof m === "object" && m.default) ? m.default : m;

/* ───────────────────────────── configuration ───────────────────────────── */

const BASE_FALLBACK = "en";

/** Only these shapes may reach the dynamic import. Prevents `../../evil`. */
const LANG_RE = /^[a-z]{2,3}$/;
const CODE_RE = /^[a-z]{2,3}(-[A-Za-z]{2,8})?$/;

/** Guards against a hostile / malformed locale file DoS-ing the indexer. */
const MAX_DEPTH = 12;
const MAX_NODES = 50000;

/** Bounded so a pathological string cannot spin. */
const MAX_EXPANSIONS = 128;

/** Resolved-value cache ceiling (per language; cleared on language change). */
const CACHE_MAX = 2000;

/**
 * Both casings are in the set so the common call — `t(key, { AED: true })` —
 * is answered by a hash hit, with no `toLowerCase()` allocation per key.
 */
const PARAM_KEYS = new Set([
    "faw", "fluc", "flc", "fllc", "tuc", "tlc", "aed", "ated",
    "FAW", "FLUC", "FLC", "FLLC", "TUC", "TLC", "AED", "ATED"
]);

// RTL now lives in utils/locale-status.js, next to the other three questions
// about how well a locale is served. Imported rather than restated so the
// <html dir> here and the Settings row there can never disagree.

/* ─────────────────────────── allocation-free stubs ─────────────────────── */

const hasOwn = Object.prototype.hasOwnProperty;

/** Stand-ins for the omitted arguments, so t() never allocates to say "none". */
const EMPTY = Object.freeze({});
const EMPTY_KEYS = Object.freeze([]);

/** Distinguishes "cached: this key does not exist" from "not cached yet". */
const MISS = Object.freeze({});

/* ───────────────────────────── module state ────────────────────────────── */

const bundles = new Map();   // "de"     -> raw locale module
const indexes = new Map();   // "de"     -> { flat: Map, faw: Map | null }
const inflight = new Map();  // "de"     -> Promise
const listeners = new Set();
const warned = new Set();

let valueCache = new Map();  // "path"   -> resolved value (no vars, no params)
let rawCache = new Map();    // "path"   -> raw catalogue value | MISS
let svgCache = new Map();    // "svgkey" -> expanded data-URI markup
let svgCatalog = null;
let svgInflight = null;
let currentLang = BASE_FALLBACK;
let currentCode = "en-US";

/**
 * The languages a lookup walks, in order. Recomputed on language change
 * instead of being rebuilt (with a `split()`, and its array, and its strings)
 * on every single miss. Also deduplicated: a bare language has no base to
 * fall back to, so the old middle entry was a second identical Map probe.
 */
let langChain = [BASE_FALLBACK];

const rebuildLangChain = () => {
    if (currentLang === BASE_FALLBACK) { langChain = [BASE_FALLBACK]; return; }
    const cut = currentLang.indexOf("_");
    langChain = cut === -1
        ? [currentLang, BASE_FALLBACK]
        : [currentLang, currentLang.slice(0, cut), BASE_FALLBACK];
};

/**
 * Everything derived from the active bundles. Dropped whenever the answer
 * could change: a language switch, a locale chunk landing, the SVG catalogue
 * landing. That last one used to be missing, and it poisoned the cache — see
 * loadSvgCatalog().
 */
const resetCaches = () => {
    valueCache = new Map();
    rawCache = new Map();
    svgCache = new Map();
};

/* ─────────────────────────────── indexing ──────────────────────────────── */

/**
 * Flatten a locale module into `Map<"a.b.c", value>`.
 * Own enumerable keys only — `__proto__` / `constructor` are never followed,
 * so `t("constructor.prototype")` resolves to nothing instead of a JS builtin.
 */
const buildIndex = (bundle) => {
    const flat = new Map();
    let nodes = 0;

    const walk = (node, prefix, depth) => {
        if (depth > MAX_DEPTH || nodes > MAX_NODES) return;
        const keys = Object.keys(node);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
            nodes++;
            const path = prefix === "" ? key : prefix + "." + key;
            const value = node[key];
            flat.set(path, value);
            if (value !== null && typeof value === "object") walk(value, path, depth + 1);
        }
    };

    if (bundle && typeof bundle === "object") walk(bundle, "", 0);

    // `faw` is the secondary index for the FAW ("format all words") lookup
    // mode, where the caller passes a human sentence as the last path segment.
    // Building it costs a second Map the size of the catalogue plus two string
    // allocations per entry, and a session that never issues a FAW lookup —
    // which is most of them — never needs it. Deferred to fawIndex().
    return { flat, faw: null };
};

const fawIndex = (idx) => {
    if (idx.faw !== null) return idx.faw;
    const faw = new Map();
    // forEach rather than `for (const [path, value] of flat)`: the iterator
    // protocol hands back a fresh two-element array per entry, and this loop
    // runs once per catalogue key.
    idx.flat.forEach((value, path) => {
        const cut = path.lastIndexOf(".");
        const norm = cut === -1
            ? normalizeFaw(path)
            : path.slice(0, cut + 1) + normalizeFaw(path.slice(cut + 1));
        if (!faw.has(norm)) faw.set(norm, value);
    });
    idx.faw = faw;
    return faw;
};

const normalizeFaw = (s) =>
    String(s).replace(/['",]/g, "").toLowerCase();

const indexFor = (lang) => {
    const cached = indexes.get(lang);
    if (cached !== undefined) return cached;           // one probe, not has()+get()
    const bundle = bundles.get(lang);
    if (bundle === undefined) return null;
    const idx = buildIndex(bundle);
    indexes.set(lang, idx);
    return idx;
};

/* ─────────────────────────────── loading ───────────────────────────────── */

bundles.set(BASE_FALLBACK, unwrapLocale(en));

if (!bundles.get(BASE_FALLBACK) || !bundles.get(BASE_FALLBACK).components) {
    // Baseline never resolved: every t() call is about to return its own key.
    console.error("[i18n] baseline locale failed to load - check locales/en.js exports", en);
}

const notify = () => { for (const fn of listeners) { try { fn(currentCode); } catch (_) {} } };

/**
 * Fetch `../locales/<lang>.js` as its own chunk. Idempotent and de-duplicated.
 * Rejection is swallowed on purpose: a missing translation file is a content
 * problem, not a runtime failure — the caller silently keeps the fallback.
 */
export const loadLocale = (lang) => {
    if (!LANG_RE.test(lang)) return Promise.resolve(false);
    if (bundles.has(lang)) return Promise.resolve(true);
    if (inflight.has(lang)) return inflight.get(lang);

    const p = import(/* webpackChunkName: "locale-[request]" */ `../locales/${lang}.js`)
        .then((mod) => {
            bundles.set(lang, unwrapLocale(mod));
            indexes.delete(lang);
            resetCaches();     // answers computed against the fallback are stale
            return true;
        })
        .catch(() => false)
        .finally(() => inflight.delete(lang));

    inflight.set(lang, p);
    return p;
};

/** The SVG catalog is large and rarely needed — always its own chunk. */
const loadSvgCatalog = () => {
    if (svgCatalog) return Promise.resolve(svgCatalog);
    if (svgInflight) return svgInflight;
    svgInflight = import(/* webpackChunkName: "locale-svg" */ "../locales/svg")
        .then((mod) => { svgCatalog = unwrapLocale(mod) || {}; return svgCatalog; })
        .catch(() => { svgCatalog = {}; return svgCatalog; })
        .finally(() => { svgInflight = null; });
    return svgInflight;
};

/**
 * Switch language. Accepts a full locale code ("pt-BR") or a bare language
 * ("pt"); regional variants fall back to their base file until a dedicated
 * one exists. Also fixes <html lang> and <html dir>, which nothing else set.
 */
export const setLanguage = async (code) => {
    const safe = CODE_RE.test(String(code || "")) ? String(code) : "en-US";
    const lang = safe.split("-")[0];

    currentCode = safe;

    // Try the region-specific file first (pt-BR.js), then the base (pt.js).
    let resolved = lang;
    if (safe !== lang) {
        const regional = safe.toLowerCase().replace("-", "_");
        if (LANG_RE.test(regional) && (await loadLocale(regional))) resolved = regional;
    }
    await loadLocale(lang);

    currentLang = bundles.has(resolved) ? resolved : (bundles.has(lang) ? lang : BASE_FALLBACK);
    rebuildLangChain();
    resetCaches();

    if (typeof document !== "undefined" && document.documentElement) {
        document.documentElement.lang = safe;
        document.documentElement.dir = RTL.has(lang) ? "rtl" : "ltr";
    }

    loadSvgCatalog();
    notify();
    return currentLang;
};

export const getLanguage = () => currentLang;
export const getLocaleCode = () => currentCode;
export const isLoaded = (lang) => bundles.has(String(lang || "").split("-")[0]);

/**
 * Re-render THIS component when the language changes.
 *
 * `t()` is a plain function, not a reactive value, so a component that calls it
 * has no idea the bundle underneath changed. Re-rendering an ancestor is not
 * enough either: fifty of this app's components sit behind `memo()`, and memo
 * compares props — a language swap changes none of them, so the subtree keeps
 * its old text.
 *
 * Calling this hook makes the component its own subscriber. That is the same
 * shape react-i18next uses for `useTranslation()`, and it is the only mechanism
 * that reaches a memo boundary without remounting the tree and throwing away
 * scroll position, open dialogs and half-filled forms — including the very
 * dialog the language was changed from.
 *
 * @returns {string} the active base language, so it can be used as a dep
 */
export const useLanguage = () => {
    const [, bump] = useState(0);
    useEffect(() => subscribe(() => bump((n) => n + 1)), []);
    return currentLang;
};

/** Subscribe to language changes so components can re-render. Returns unsub. */
export const subscribe = (fn) => {
    if (typeof fn !== "function") return () => {};
    listeners.add(fn);
    return () => listeners.delete(fn);
};

/* ─────────────────────────── SVG token expansion ───────────────────────── */

const XML_ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
const escapeXml = (s) => String(s).replace(/[&<>"']/g, (c) => XML_ESC[c]);

/** btoa() throws on any codepoint > U+00FF. Locale SVG labels are not ASCII. */
const utf8ToBase64 = (str) => {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
};

/** Defence in depth: the catalog is contributor-editable content. */
const stripActiveSvg = (svg) =>
    String(svg)
        .replace(/<\s*(script|foreignObject|iframe|object|embed|handler)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
        .replace(/<\s*(script|foreignObject|iframe|object|embed|handler)\b[^>]*\/?>/gi, "")
        .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
        .replace(/(href|xlink:href)\s*=\s*("|')\s*(javascript|vbscript|data):[^"']*\2/gi, "");

/**
 * Build one SVG entry: inject the locale's own labels (escaped as XML text),
 * strip anything active, then re-encode the inline data URI as UTF-8 base64.
 *
 * Memoised per key. The work below — four backtracking-prone regex passes, a
 * split/join per label, a TextEncoder pass and a base64 encode over the whole
 * payload — used to run on every render of every string carrying an `{{{_svg}}}`
 * token, for a result that only changes with the language. The memo is dropped
 * by resetCaches() together with everything else the bundle decides.
 */
const expandSvg = (key) => {
    if (!svgCatalog) {
        // The empty answer below is about to be cached by t() as if it were
        // the real one, so the caches have to go when the catalogue arrives —
        // otherwise notify() re-renders into the same poisoned "" forever.
        loadSvgCatalog().then(() => { resetCaches(); notify(); });
        return "";
    }
    if (!hasOwn.call(svgCatalog, key)) return "";

    const memo = svgCache.get(key);
    if (memo !== undefined) return memo;

    let svg = String(svgCatalog[key]);

    const idx = indexFor(currentLang) || indexFor(BASE_FALLBACK);
    const params = (idx && idx.flat.get("_svg." + key)) || null;

    if (params && typeof params === "object") {
        const names = Object.keys(params);
        for (let i = 0; i < names.length; i++) {
            const name = names[i];
            if (!SVG_PARAM_RE.test(name)) continue;
            const safe = escapeXml(params[name]);
            svg = svg.split("{{" + name + "}}").join(safe);
        }
    }

    const out = reencodeSvgDataUris(stripActiveSvg(svg));
    cachePut(svgCache, key, out);
    return out;
};

const SVG_PARAM_RE = /^[A-Za-z0-9_]{1,64}$/;

/**
 * `![alt](data:image/svg+xml;utf8,<svg …/>)` -> `![alt](data:image/svg+xml;base64,…)`
 *
 * Done with an index scan rather than a regex: the payload is arbitrary markup
 * containing parentheses and quotes, which is exactly what made the original
 * greedy `(.+)` both wrong and a backtracking risk.
 */
const MARK = "](data:image/svg+xml;utf8,";

const reencodeSvgDataUris = (text) => {
    if (text.indexOf(MARK) === -1) return text;      // nothing to rewrite

    let out = "";
    let i = 0;
    let guard = 0;

    while (guard++ < MAX_EXPANSIONS) {
        const at = text.indexOf(MARK, i);
        if (at === -1) break;

        const end = matchParen(text, at + 1);   // at + 1 === index of "("
        if (end === -1) break;

        const raw = text.slice(at + MARK.length, end).replace(/\\(["'])/g, "$1");

        let encoded;
        try { encoded = utf8ToBase64(raw); } catch (_) { break; }

        out += text.slice(i, at) + "](data:image/svg+xml;base64," + encoded;
        i = end;                                 // the closing ")" is kept
    }

    return out + text.slice(i);
};

/** Balanced-paren scan — replaces the old greedy `(.+)` that could backtrack. */
const matchParen = (s, from) => {
    const open = s.indexOf("(", from);
    if (open === -1) return -1;
    let depth = 0;
    for (let i = open; i < s.length; i++) {
        const c = s.charCodeAt(i);           // charCodeAt: no one-char string
        if (c === 40) depth++;               // "("
        else if (c === 41 && --depth === 0) return i;   // ")"
    }
    return -1;
};

/* ──────────────────────────────── plurals ──────────────────────────────── */

/**
 * `{ dog: 2 }` or `{ dog: 2, _n: { few: 20, plenty: 100 } }`.
 * The original read Object.entries() of an ARRAY here, so `_n` never matched
 * and few/plenty were dead code. Fixed.
 */
/**
 * Resolve the plural form for a count.
 *
 * Two strategies, in order:
 *
 * 1. **CLDR via Intl.PluralRules** — when the locale declares any of the CLDR
 *    categories (`zero` `two` `few` `many` `other`). This is the correct route
 *    for Slavic and Semitic languages: Russian needs 1 день / 2-4 дня /
 *    5+ дней, and the boundary is not a threshold anyone can hardcode
 *    (11 takes "many", 21 takes "one", 111 takes "many").
 *
 * 2. **Explicit thresholds** — the original `_n: { few, plenty }` shape, kept
 *    working for the call sites that use it.
 *
 * `one` / `many` remain the minimum a locale must declare; everything else is
 * optional and falls back through `other` -> `many` -> `one`.
 */
const CLDR_CATEGORIES = ["zero", "two", "few", "many", "other"];

/** Intl object construction is an ICU lookup — do it once per locale code. */
const pluralRules = new Map();

const pluralRulesFor = (code) => {
    const memo = pluralRules.get(code);
    if (memo !== undefined) return memo;
    let rules = null;
    try {
        if (typeof Intl !== "undefined" && Intl.PluralRules) rules = new Intl.PluralRules(code);
    } catch (_) { rules = null; }   // unknown locale tag
    pluralRules.set(code, rules);
    return rules;
};

/** Fixed arity, so no rest-argument array is allocated per resolution. */
const pickForm = (forms, a, b, c, d) => {
    if (a !== undefined && hasOwn.call(forms, a) && forms[a] != null) return String(forms[a]);
    if (b !== undefined && hasOwn.call(forms, b) && forms[b] != null) return String(forms[b]);
    if (c !== undefined && hasOwn.call(forms, c) && forms[c] != null) return String(forms[c]);
    if (d !== undefined && hasOwn.call(forms, d) && forms[d] != null) return String(forms[d]);
    return null;
};

const pluralForm = (key, spec) => {
    const idx = indexFor(currentLang) || indexFor(BASE_FALLBACK);
    const forms = idx && idx.flat.get("_plurals." + key);
    if (!forms || typeof forms !== "object") return null;

    const n = Number(spec.count);
    if (!Number.isFinite(n)) return null;

    // ── 1. CLDR ──────────────────────────────────────────────────────────
    let declaresCldr = false;
    for (let i = 0; i < CLDR_CATEGORIES.length; i++) {
        if (hasOwn.call(forms, CLDR_CATEGORIES[i])) { declaresCldr = true; break; }
    }

    if (declaresCldr) {
        const rules = pluralRulesFor(currentCode);
        if (rules !== null) {
            const hit = pickForm(forms, rules.select(n), "other", "many", "one");
            if (hit !== null) return hit;
        }
    }

    // ── 2. explicit thresholds (legacy `_n`) ─────────────────────────────
    let form = n <= 1
        ? pickForm(forms, "one", "other")
        : pickForm(forms, "many", "other", "one");
    if (spec.few != null && n > 1 && n < spec.few) form = pickForm(forms, "few") || form;
    if (spec.plenty != null && n >= spec.plenty) form = pickForm(forms, "plenty") || form;

    return form;
};

const readPluralSpec = (key, value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    if (!hasOwn.call(value, key)) return null;
    const n = value[key];
    if (typeof n !== "number") return null;
    const nn = value._n && typeof value._n === "object" ? value._n : EMPTY;
    return { count: n, few: nn.few ?? null, plenty: nn.plenty ?? null };
};

/* ───────────────────────────── interpolation ───────────────────────────── */

/**
 * ONE pass, bounded quantifiers, callback replacer.
 *   - callback form => `$&`, `$'`, `$1` in a user value are inert.
 *   - single pass  => a substituted value is never re-scanned, so it cannot
 *                     smuggle `{{other}}` or `{{{_svg.x}}}`.
 */
/**
 * `%n {{{_plurals.x}}}` is the common form — count immediately before the noun.
 *
 * `%n` and `{{{_plurals.x}}}` may also appear SEPARATELY, because not every
 * language puts the number next to the word it counts. English wants
 * "3 more characters needed"; the noun and the count are two words apart, and
 * forcing them together would change the sentence rather than translate it.
 *
 * A lone `%n` resolves against the single plural token in the same string. If a
 * string somehow contained two, `%n` is ambiguous and is left as written — the
 * catalog would need one plural per string, which every real key satisfies.
 */
const TOKEN_RE =
    /%n\s\{\{\{_plurals\.([A-Za-z0-9_]{1,64})\}\}\}|\{\{\{_plurals\.([A-Za-z0-9_]{1,64})\}\}\}|%n|\{\{\{_svg\.([A-Za-z0-9_]{1,64})\}\}\}|\{\{([A-Za-z0-9_]{1,64})\}\}/g;

/**
 * The same grammar reduced to its only reachable branch when a string carries
 * no `{{{` and no `%n`: a plain variable. Every triple-brace form and every
 * plural form is excluded by construction, so this is not a different
 * behaviour — it is the same one with the dead alternatives removed, and it
 * costs the engine a fraction of the backtracking the full pattern does.
 */
const SIMPLE_RE = /\{\{([A-Za-z0-9_]{1,64})\}\}/g;

/** The plural key referenced by a string, when there is exactly one. */
const SOLE_PLURAL_RE = /\{\{\{_plurals\.([A-Za-z0-9_]{1,64})\}\}\}/g;
const solePluralKey = (str) => {
    let key = null;
    let m;
    SOLE_PLURAL_RE.lastIndex = 0;
    while ((m = SOLE_PLURAL_RE.exec(str)) !== null) {
        if (key === null) key = m[1];
        else if (key !== m[1]) return null;      // ambiguous — leave %n written
    }
    return key;
};

/**
 * A parsed simple string: literals at even indices, variable names at odd
 * ones, always ending on a literal. The segmentation depends only on the
 * string, never on the values, so it survives every render of that key — and
 * with it in hand, interpolation is a concat loop with no regex at all.
 */
const planCache = new Map();

const buildPlan = (str) => {
    const plan = [];
    let last = 0;
    let count = 0;
    let m;
    SIMPLE_RE.lastIndex = 0;
    while ((m = SIMPLE_RE.exec(str)) !== null) {
        if (++count > MAX_EXPANSIONS) break;      // the rest stays literal
        plan.push(str.slice(last, m.index), m[1]);
        last = m.index + m[0].length;
    }
    plan.push(str.slice(last));
    return plan;
};

const applyPlan = (plan, variables) => {
    let out = plan[0];
    for (let i = 1; i < plan.length; i += 2) {
        const name = plan[i];
        if (hasOwn.call(variables, name)) {
            const v = variables[name];
            // An object is a plural spec or an element: left as written, which
            // is what tnode() and <T> then look for.
            if (v === null || v === undefined) out += plan[i + 1];
            else if (typeof v === "object") out += "{{" + name + "}}" + plan[i + 1];
            else out += String(v) + plan[i + 1];
        } else {
            out += "{{" + name + "}}" + plan[i + 1];
        }
    }
    return out;
};

const interpolate = (str, variables) => {
    const hasBraces = str.indexOf("{{") !== -1;
    const hasCount = str.indexOf("%n") !== -1;
    if (!hasBraces && !hasCount) return str;

    // ── fast lane: `{{name}}` only ────────────────────────────────────────
    if (!hasCount && str.indexOf("{{{") === -1) {
        let plan = planCache.get(str);
        if (plan === undefined) {
            plan = buildPlan(str);
            cachePut(planCache, str, plan);
        }
        if (plan.length === 1) return str;        // nothing matched the grammar
        return applyPlan(plan, variables);
    }

    // ── full grammar ──────────────────────────────────────────────────────
    let budget = MAX_EXPANSIONS;
    // Resolved on demand: only a BARE `%n` needs it, and paying for a whole
    // extra regex sweep of every plural-bearing string to find out was the
    // single biggest avoidable cost in this function.
    let sole;

    return str.replace(TOKEN_RE, (match, joinedKey, bareKey, svgKey, varName) => {
        if (budget-- <= 0) return match;

        // "%n {{{_plurals.x}}}"  — count and word together
        if (joinedKey !== undefined) {
            const spec = readPluralSpec(joinedKey, variables[joinedKey]);
            if (!spec) return match;
            const word = pluralForm(joinedKey, spec);
            return word === null ? match : spec.count + " " + word;
        }

        // "{{{_plurals.x}}}" alone — just the word, count placed elsewhere
        if (bareKey !== undefined) {
            const spec = readPluralSpec(bareKey, variables[bareKey]);
            if (!spec) return match;
            const word = pluralForm(bareKey, spec);
            return word === null ? match : word;
        }

        // "%n" alone — the count of this string's single plural
        if (match === "%n") {
            if (sole === undefined) sole = solePluralKey(str);
            if (sole === null) return match;
            const spec = readPluralSpec(sole, variables[sole]);
            return spec ? String(spec.count) : match;
        }

        if (svgKey !== undefined) return expandSvg(svgKey);

        if (!hasOwn.call(variables, varName)) return match;
        const v = variables[varName];
        if (v === null || v === undefined) return "";
        if (typeof v === "object") return match;      // plural object, handled above
        return String(v);
    });
};

/** Objects are supported as values; strings inside are interpolated, copy-on-write. */
const interpolateDeep = (value, variables, depth) => {
    if (typeof value === "string") return interpolate(value, variables);
    if (depth > MAX_DEPTH || !value || typeof value !== "object") return value;
    if (Array.isArray(value)) {
        const out = new Array(value.length);
        for (let i = 0; i < value.length; i++) out[i] = interpolateDeep(value[i], variables, depth + 1);
        return out;
    }
    const out = {};
    const keys = Object.keys(value);
    for (let i = 0; i < keys.length; i++) out[keys[i]] = interpolateDeep(value[keys[i]], variables, depth + 1);
    return out;
};

/* ────────────────────────────── formatting ─────────────────────────────── */

const applyFormat = (value, p) => {
    if (typeof value !== "string") return value;
    let v = value;
    if (p.fluc || p.FLUC || p.flc || p.FLC) v = v.charAt(0).toUpperCase() + v.slice(1);
    if (p.fllc || p.FLLC) v = v.charAt(0).toLowerCase() + v.slice(1);
    // Locale-aware on purpose. Greek drops accents in all-caps (ΑΚΥΡΩΣΗ, not
    // ΑΚΎΡΩΣΗ) and Turkish maps i→İ / I→ı; toUpperCase() does neither, and the
    // button label is the translator's word, so the casing must be theirs too.
    if (p.tuc || p.TUC) v = v.toLocaleUpperCase(currentCode);
    if (p.tlc || p.TLC) v = v.toLocaleLowerCase(currentCode);
    if (p.aed || p.AED) v = v + ".";
    if (p.ated || p.ATED) v = v + "...";
    return v;
};

/** `{AED: true}` in the variables slot is the documented shorthand. */
const allParamKeys = (keys) => {
    for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (!PARAM_KEYS.has(k) && !PARAM_KEYS.has(k.toLowerCase())) return false;
    }
    return true;
};

/* ──────────────────────────────── lookup ───────────────────────────────── */

/**
 * Strings that appear in several dialogs are hoisted out of their namespace
 * into `words.*` so the copy cannot drift between them. That rewrite touches
 * both the catalog and every call site, and the two only stay in step if they
 * ship together — a partially-updated tree leaves live code asking for
 * `components.index.governance` after the catalog moved it to
 * `words.governance`, and the string disappears.
 *
 * So a `components.<ns>.<key>` miss retries as `words.<key>` before giving up.
 * The hoist becomes non-breaking in both directions, and a stale call site
 * renders correctly instead of showing its own key path to the user.
 */
const hoistedPath = (path) => {
    if (path.charCodeAt(0) !== 99) return undefined;          // "c" — cheap reject
    if (path.lastIndexOf("components.", 0) !== 0) return undefined;
    const cut = path.lastIndexOf(".");
    return cut === -1 ? undefined : "words." + path.slice(cut + 1);
};

const lookupExact = (path, faw) => {
    const chain = langChain;
    for (let i = 0; i < chain.length; i++) {
        const idx = indexFor(chain[i]);
        if (idx === null) continue;
        let hit = idx.flat.get(path);
        if (faw && (hit === undefined || hit === null)) hit = fawIndex(idx).get(fawPath(path));
        if (hit !== undefined) return hit;
    }
    return undefined;
};

const lookup = (path, faw) => {
    const hit = lookupExact(path, faw);
    if (hit !== undefined) return hit;

    const hoisted = hoistedPath(path);
    return hoisted === undefined ? undefined : lookupExact(hoisted, faw);
};

const fawPath = (path) => {
    const cut = path.lastIndexOf(".");
    return cut === -1 ? normalizeFaw(path) : path.slice(0, cut + 1) + normalizeFaw(path.slice(cut + 1));
};

const cachePut = (map, key, value) => {
    if (map.size >= CACHE_MAX) map.clear();
    map.set(key, value);
};

/* ───────────────────────────────── t() ─────────────────────────────────── */

/**
 * @param {string} path        e.g. "words.close" / "components.x.y"
 * @param {object} [variables] e.g. { account_name: "alice" } or { dog: 2 }
 * @param {object} [parameters]e.g. { AED: true } — may be passed as `variables`
 *
 * The omitted arguments are NOT defaulted to `{}`: an object literal in a
 * default parameter is a fresh allocation on every call, and this function is
 * called a few thousand times per render pass. They fall back to a shared
 * frozen stub instead, which reads identically and allocates nothing.
 */
export const t = (path, variables, parameters) => {
    if (typeof path !== "string" || path.length === 0 || path.length > 512) return "";

    let vars = (variables !== null && typeof variables === "object") ? variables : EMPTY;
    let params = (parameters !== null && typeof parameters === "object") ? parameters : EMPTY;

    // One Object.keys() pass over the variables, reused for the shorthand test
    // and for the emptiness test — the original allocated three arrays here and
    // lower-cased every key of every call.
    let varKeys = vars === EMPTY ? EMPTY_KEYS : Object.keys(vars);

    if (varKeys.length > 0 && allParamKeys(varKeys)) {
        // `t(key, { AED: true })`. When no real parameters came in, the bag is
        // used as-is: it is only ever read, so copying it would be waste.
        params = params === EMPTY ? vars : Object.assign({}, vars, params);
        vars = EMPTY;
        varKeys = EMPTY_KEYS;
    }
    // NOTE: the old code did `Object.assign(variables, parameters)` and thereby
    // mutated the caller's object. It does not any more.

    const hasVars = varKeys.length > 0;
    const hasParams = params !== EMPTY && Object.keys(params).length > 0;

    // A FAW lookup always arrives through `parameters`, so a cacheable call is
    // never a FAW call — which is why the key is now the bare path: no language
    // prefix (the cache is dropped on language change) and no faw marker
    // (unreachable). That removes a string concat from every cached hit.
    const cacheable = !hasVars && !hasParams;
    if (cacheable) {
        const cached = valueCache.get(path);
        if (cached !== undefined) return cached;
    }

    const faw = hasParams && !!(params.faw || params.FAW);

    // Second-level memo: the resolved catalogue value before interpolation.
    // Calls that DO carry variables cannot use valueCache, but they can skip
    // the fallback-chain walk, the hoist retry and the Map probes behind it.
    let raw;
    if (faw) {
        raw = lookup(path, true);
    } else {
        const memo = rawCache.get(path);
        if (memo === undefined) {
            raw = lookup(path, false);
            cachePut(rawCache, path, raw === undefined ? MISS : raw);
        } else {
            raw = memo === MISS ? undefined : memo;
        }
    }

    if (raw === undefined) {
        if (process.env.NODE_ENV !== "production" && !warned.has(path)) {
            warned.add(path);
            console.warn(`[i18n] missing key "${path}" for "${currentLang}"`);
        }
        return path.slice(path.lastIndexOf(".") + 1);
    }

    let value = interpolateDeep(raw, vars, 0);
    if (hasParams) value = applyFormat(value, params);

    if (cacheable) cachePut(valueCache, path, value);
    return value;
};

export default t;

/* ─────────────────── element-aware interpolation (tnode) ───────────────────
 *
 * `interpolate` refuses object values on purpose — an object variable means a
 * plural spec (see `readPluralSpec`) — so a Preact/React element handed to t()
 * as a variable is returned as the literal token "{{name}}". That is the right
 * behaviour for t(), which must return a string.
 *
 * tnode() covers the case where part of a sentence IS an element: a tooltip, a
 * link, a bold username. It translates using the scalar variables only, which
 * leaves the element tokens standing, then splits the result on those tokens
 * and returns an array of children:
 *
 *     tnode("components.x.last_active", { date: <Tooltip …>3 h ago</Tooltip> })
 *     // → ["Last active ", <Tooltip …>, ""]  → renders as one sentence
 *
 * Because the split happens after translation, the element lands wherever the
 * locale puts it — which is the whole point, since word order moves.
 *
 * Values that are NOT elements fall through to ordinary t() interpolation, and
 * the return value is then a plain string. A call site can therefore pass
 * either an element or a bare string for the same variable and stay correct.
 */

/** A Preact/React element: preact/compat stamps `$$typeof`, plain preact does not. */
const isElement = (v) =>
    !!v && typeof v === "object" && !Array.isArray(v) &&
    (v.$$typeof !== undefined || (v.type !== undefined && v.props !== undefined));

/**
 * A variable value that cannot survive t(): a single element, or an array
 * holding one. Exported because utils/T.js needs the same predicate — the two
 * helpers differ in what they do with such a value, not in how they spot it.
 */
export const isElementValue = (v) => isElement(v) || (Array.isArray(v) && v.some(isElement));

export const tnode = (path = "", variables = {}, parameters = {}) => {
    const vars = variables && typeof variables === "object" ? variables : EMPTY;

    let nodeKeys = null;
    let scalars = vars;
    const keys = Object.keys(vars);
    for (let i = 0; i < keys.length; i++) {
        if (isElementValue(vars[keys[i]])) (nodeKeys || (nodeKeys = [])).push(keys[i]);
    }
    if (nodeKeys !== null) {
        scalars = {};
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            if (nodeKeys.indexOf(k) === -1) scalars[k] = vars[k];
        }
    }

    const text = t(path, scalars, parameters);
    if (nodeKeys === null || typeof text !== "string") return text;

    let parts = [text];
    for (let n = 0; n < nodeKeys.length; n++) {
        const name = nodeKeys[n];
        const token = "{{" + name + "}}";
        const next = [];
        for (let p = 0; p < parts.length; p++) {
            const part = parts[p];
            if (typeof part !== "string" || part.indexOf(token) === -1) {
                next.push(part);
                continue;
            }
            const pieces = part.split(token);
            for (let i = 0; i < pieces.length; i++) {
                if (i > 0) next.push(vars[name]);
                if (pieces[i] !== "") next.push(pieces[i]);
            }
        }
        parts = next;
    }

    // Nothing was spliced (locale is missing the token) — hand back the string.
    return parts.length === 1 && typeof parts[0] === "string" ? parts[0] : parts;
};

/* ────────────────────── deferred translation (tk / tx) ─────────────────────
 *
 * The rule this enforces: **translate at render, never at data-mapping time.**
 *
 * Calling t() outside the render path freezes the language at whatever it was
 * when that code ran. Three real instances of this in the codebase:
 *
 *   - a module-scope config table (`KEY_TYPES`) — evaluated once at import
 *   - a label mapper inside useMemo whose deps do not include the locale
 *   - notification text parsed from chain messages before render
 *
 * In each case wrapping the literal in t() looks correct and silently pins the
 * UI to the language active at module load or first memo.
 *
 * tk() records the intent; tx() resolves it where the pixels are:
 *
 *     // data layer — no locale dependency, no re-computation on switch
 *     out.title = tk("wallet_history.power_up_from", { from: d.from });
 *
 *     // render layer
 *     <ListItemText primary={tx(row.title)} />
 *
 * tx() passes plain strings through untouched, so a mapper can be migrated
 * field by field without breaking the component that renders it.
 *
 * The payoff is that the memo does NOT need the locale in its dependency
 * array — it produces keys, not prose — so switching language re-renders
 * without recomputing the data.
 */

const TK = "$t";

/** Record a translation to be resolved later. */
export const tk = (key, variables, parameters) => ({
    [TK]: key,
    v: variables || undefined,
    p: parameters || undefined
});

/** Is this a deferred translation descriptor? */
export const isTk = (x) =>
    !!x && typeof x === "object" && typeof x[TK] === "string";

/**
 * Resolve a descriptor at render time. Plain strings, numbers, null and
 * React elements pass through unchanged. Arrays are resolved element-wise so
 * a mapper can emit `[tk(…), " · ", tk(…)]`.
 *
 * Descriptors compose: a variable whose value is itself a descriptor is
 * resolved first, so a mapper can write
 *
 *     tk("set_role", { actor, target, role: tk("roles.moderator") })
 *
 * without translating anything at mapping time.
 */
export const tx = (x) => {
    if (isTk(x)) {
        const vars = x.v;
        let resolved = vars;
        if (vars) {
            resolved = {};
            const keys = Object.keys(vars);
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                const v = vars[key];
                resolved[key] = (isTk(v) || Array.isArray(v)) ? tx(v) : v;
            }
        }
        return t(x[TK], resolved, x.p);
    }
    if (Array.isArray(x)) return x.map(tx);
    return x;
};