/**
 * utils/displayNames.js — names the browser already knows in every language.
 *
 * Countries, currencies and languages need no translation keys: Intl.DisplayNames gives
 * them in the UI language ("Franc suisse", "スイス・フラン"). Each helper returns
 * null when the engine has no answer, so callers keep their English fallback.
 */
import { t, getLanguage, getLocaleCode } from "./text";

const cache = new Map();   // "fr-FR|currency" -> Intl.DisplayNames | null

const displayNames = (inLocale, type) => {
    const key = inLocale + "|" + type;
    let dn = cache.get(key);
    if (dn === undefined) {
        try {
            dn = (typeof Intl !== "undefined" && Intl.DisplayNames) ? new Intl.DisplayNames([inLocale, "en"], { type }) : null;
        } catch (_) {
            dn = null;
        }
        cache.set(key, dn);
    }
    return dn;
};

const nameIn = (inLocale, type, code) => {
    const dn = code ? displayNames(inLocale, type) : null;
    if (!dn) return null;
    try {
        const name = dn.of(code);
        // An unknown code comes back as the code itself.
        return name && name !== code ? name : null;
    } catch (_) {
        return null;
    }
};

const nameOf = (type, code) => nameIn(getLocaleCode(), type, code);

/** "CHF" -> "Swiss Franc" / "Franc suisse"; null when unknown. */
export const currencyName = (code) => nameOf("currency", code);

/** "PL" -> "Poland" / "Pologne"; null when unknown. */
export const regionName = (code) => nameOf("region", code);

const capitalize = (s, locale) => {
    try { return s.charAt(0).toLocaleUpperCase(locale) + s.slice(1); } catch (_) { return s; }
};

/**
 * A row of the language picker: the language in its own words, then — when it
 * reads differently — in the UI language, so it can be found either way:
 * "Français (France) · フランス語 (フランス)" for a Japanese reader. `english`
 * (the hand-written name in utils/constant_locales) when the engine has no
 * Intl.DisplayNames.
 */
export const languageLabel = (code, english) => {
    const own = nameIn(code, "language", code);
    const ui = nameIn(getLocaleCode(), "language", code);
    if (!own && !ui) return english;
    if (!own) return capitalize(ui, getLocaleCode());
    if (!ui || ui.toLocaleLowerCase() === own.toLocaleLowerCase()) return capitalize(own, code);
    return capitalize(own, code) + " · " + capitalize(ui, getLocaleCode());
};

/**
 * An API node of utils/constants DEFAULT_NODES as shown to the user:
 * "Rex (USA)" in English, "Rex (États-Unis)" in French. The brand stays as
 * is; the place is a city (translated in locales/<lang>.js) or a country
 * (named by the browser). English keeps the hand-written `name`. Nodes the
 * user typed in have no brand and are shown by their `name`.
 */
export const nodeDisplayName = (node) => {
    if (!node) return "";
    if (!node.brand || getLanguage() === "en") return node.name || "";
    const place = node.city ? t("components.default_nodes." + node.city) : regionName(node.region);
    return place ? node.brand + " (" + place + ")" : (node.name || node.brand);
};
