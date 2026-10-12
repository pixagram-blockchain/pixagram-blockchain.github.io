// Browsers name Norwegian by its written standard: nb (Bokmål) or nn (Nynorsk),
// as in "nb-NO". The app has one Norwegian file, locales/no.js (Bokmål), listed
// as "no" / "no-NO", so a Norwegian browser would never match it. These are
// reported under the app's code instead.
const LANGUAGE_ALIASES = new Map([["nb", "no"], ["nn", "no"]]);

export default function get_browser_locales(options = {}) {
    const default_options = {
        language_code_only: false,
    };

    const opt = {
        ...default_options,
        ...options,
    };

    const browser_locales =
        navigator.languages === undefined
            ? [navigator.language]
            : navigator.languages;

    if (!browser_locales) {
        return undefined;
    }

    return browser_locales.map(locale => {
        const trimmed_locale = locale.trim();
        const language_code = trimmed_locale.split(/-|_/)[0];
        const alias = LANGUAGE_ALIASES.get(language_code.toLowerCase());
        const app_locale = alias
            ? alias + trimmed_locale.slice(language_code.length)
            : trimmed_locale;

        return opt.language_code_only
            ? app_locale.split(/-|_/)[0]
            : app_locale;
    });
}