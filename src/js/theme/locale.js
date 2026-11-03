/**
 * theme/locale.js — Material-UI's own built-in words, in the UI language.
 *
 * MUI components carry a few English defaults of their own: Autocomplete's
 * "Clear" / "Open" / "Close" button tooltips, its "No options" and "Loading…"
 * lines, Alert's "Close". They come from `theme.props.<Component>`, which MUI
 * reads on every render (getThemeProps), so they are rewritten here in place
 * whenever the language changes.
 *
 * In place on purpose: a new theme object would make every withStyles /
 * makeStyles sheet in the app regenerate on a language switch (and once more
 * at boot when the language file lands). The texts are app keys, so each
 * locale file holds them like any other string.
 */
import { t, subscribe } from "../utils/text";

const text = (key, english) => t(key) || english;   // "" until a catalogue is live

export const bindThemeLocale = (theme) => {
    const apply = () => {
        const props = theme.props || (theme.props = {});
        props.MuiAutocomplete = {
            ...(props.MuiAutocomplete || {}),
            clearText: text("components.mui.clear", "Clear"),
            closeText: text("words.close", "Close"),
            openText: text("components.mui.open", "Open"),
            loadingText: text("components.mui.loading", "Loading…"),
            noOptionsText: text("components.mui.no_options", "No options"),
        };
        props.MuiAlert = {
            ...(props.MuiAlert || {}),
            closeText: text("words.close", "Close"),
        };
    };
    apply();
    // Subscribed before any component is: on a language change this runs
    // first, so the re-renders that follow already read the new words.
    subscribe(apply);
    return theme;
};
