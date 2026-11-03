// ── Default props for MUI components ─────────────────────────────────────
// Applied by MUI only where a component leaves the prop undefined, so every
// explicit value in the app (autoComplete="username", "current-password",
// "new-password", "one-time-code", "tel-national"…) still wins.

export const props = {
    // Browser form history on every other text field. With it on, focusing a
    // comment box, a search or an amount field opened the browser's own
    // suggestion pop-up — a light box under the field — and picking an entry
    // repainted the field with the light autofill background. None of those
    // fields benefits from the browser remembering what was typed in them.
    MuiInputBase: {
        autoComplete: "off",
    },
};
