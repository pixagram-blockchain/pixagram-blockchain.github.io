"use strict";

// ── Search styles ─────────────────────────────────────────────────────────────
// Moved from Index's stylesheet (searchBar*, searchInput, searchButton,
// subheaderSticky, listItemText, history*) so the search folder owns its look;
// the row/avatar/masonry/filter additions live here too. Same breakpoints and
// numbers for the closed bar: it still sits exactly where the toolbar expects it.
//
// Closed, the bar is flat (no inset shadow). Open, bar + dropdown share one
// outer shadow (searchBarOpenMenu::before).
//
// Open on desktop, the bar widens by --search-extra (set by SearchBar when the
// viewport has room to its right). Its right margin shrinks by the same amount,
// so the toolbar's layout does not move: the open search simply grows over the
// (backdrop-dimmed) toolbar buttons next to it.

const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
const EXTRA = "var(--search-extra, 0px)";

// Bar box: content height + vertical padding (desktop / phone). The open-state
// shadow box reaches up by exactly the bar's height.
const BAR_CONTENT_H = 32;
const BAR_PAD_Y = 12;
const BAR_CONTENT_H_SM = 24;
const BAR_PAD_Y_SM = 8;
const BAR_H = BAR_CONTENT_H + 2 * BAR_PAD_Y;          // 56
const BAR_H_SM = BAR_CONTENT_H_SM + 2 * BAR_PAD_Y_SM; // 40

// Flat when closed (no inset); open, bar + dropdown lift off the page together.
const OPEN_SHADOW = "0 18px 40px rgba(0,0,0,0.5), 0 6px 14px rgba(0,0,0,0.35)";

// Panel palette: the dropdown is #222; the filter panel is one step darker and
// its controls one step lighter than the panel.
const PANEL_BG = "#191919";
const FIELD_BG = "#262626";
const FIELD_BG_HOVER = "#2f2f2f";
const ON_BG = "#e6e6e6";

export const searchStyles = (theme) => {
    const buttonTransition = `225ms ${EASE}`;
    const expandTransition = `180ms ${EASE}`;
    const searchBarBase = {
        display: "inline-block",
        padding: `${BAR_PAD_Y}px 32px`,
        backgroundColor: "#222222",
        verticalAlign: "top",
        height: BAR_CONTENT_H,
        width: `calc(320px + ${EXTRA})`,
        boxSizing: "content-box",
        margin: "24px 32px 16px 32px",
        marginRight: `calc(32px - ${EXTRA})`,
        position: "relative",
        // A keyframe fade (the toolbar's 600 ms entrance) instead of MUI <Fade>,
        // which writes an inline `transition` that would cancel the ones below.
        animationName: "$search-fade-in",
        animationDuration: "600ms",
        animationTimingFunction: EASE,
        animationFillMode: "both",
        transition: `border-radius 150ms ${EASE}, width ${expandTransition}, margin-right ${expandTransition}`,
        [theme.breakpoints.down("md")]: {
            width: `calc(256px + ${EXTRA})`,
            margin: "24px 16px 16px 32px",
            marginRight: `calc(16px - ${EXTRA})`,
        },
        [theme.breakpoints.down("sm")]: {
            maxWidth: "calc(100% - 176px)",
            height: BAR_CONTENT_H_SM,
            margin: "12px 16px 8px 64px",
            padding: `${BAR_PAD_Y_SM}px 24px`,
            position: "absolute",
        },
    };

    return {
        "@keyframes search-fade-in": {
            from: { opacity: 0 },
            to: { opacity: 1 },
        },
        searchBarWrapper: {
            zIndex: 9,
            position: "relative",
            display: "inline-block",
            verticalAlign: "top",
            width: "auto",
            [theme.breakpoints.down("sm")]: { width: "100%" },
        },
        searchBar: {
            ...searchBarBase,
            borderRadius: 28,
            [theme.breakpoints.down("sm")]: { ...searchBarBase[theme.breakpoints.down("sm")], borderRadius: 16 },
        },
        searchBarOpen: {
            ...searchBarBase,
            borderRadius: "28px 28px 0 0",
            [theme.breakpoints.down("sm")]: { ...searchBarBase[theme.breakpoints.down("sm")], borderRadius: "16px 16px 0 0" },
        },
        searchButton: {
            position: "absolute",
            right: 8,
            top: 4,
            [theme.breakpoints.down("sm")]: { right: 0, top: -4, color: "#666" },
        },
        // Filter button: left of the close/back button, white icon, count badge.
        filterButton: {
            position: "absolute",
            right: 52,
            top: 4,
            color: "#ffffff",
            transition: `background-color ${buttonTransition}`,
            "&:hover": { backgroundColor: "rgba(255,255,255,0.06)" },
            // 40 px on phones so the button fits the 40 px bar.
            [theme.breakpoints.down("sm")]: { right: 44, top: 0, padding: 8 },
        },
        filterButtonOn: {
            backgroundColor: "rgba(255,255,255,0.08)",
            "&:hover": { backgroundColor: "rgba(255,255,255,0.12)" },
        },
        filterBadge: {
            backgroundColor: "#ffffff",
            color: "#111111",
            fontWeight: 700,
            fontSize: 10,
            height: 16,
            minWidth: 16,
            padding: "0 4px",
            borderRadius: 8,
            // A ring of the bar's colour keeps the white badge apart from the white icon.
            boxShadow: "0 0 0 2px #222222",
        },
        searchInput: {
            width: "100%",
            boxSizing: "border-box",
            // Room for the filter + close buttons on the right.
            paddingRight: 60,
            backgroundColor: "transparent",
            border: "none",
            marginTop: -8,
            marginLeft: -8,
            lineHeight: "48px",
            fontSize: 18,
            height: 48,
            color: "#ccc",
            "&:focus": { outline: "none" },
            "&::placeholder": { color: "#666" },
            [theme.breakpoints.down("sm")]: { lineHeight: "32px", fontSize: 14, height: 40, paddingRight: 56 },
        },

        // ── dropdown ──
        // Width (the bar's live width) and max height (bar bottom → viewport
        // bottom) are set inline by SearchBar. The panel is pinned at the top;
        // the results scroll below it.
        searchBarOpenMenu: {
            zIndex: 9,
            maxWidth: "100vw",
            // The open search's one outer shadow, around bar + dropdown as a single
            // shape: a transparent box spanning both (the popper hangs right under
            // the bar, same width) casts it from behind the dropdown. A box-shadow
            // is only painted outside its box, so none of it falls on the bar.
            "&::before": {
                content: '""',
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                top: -BAR_H,
                borderRadius: 28,
                boxShadow: OPEN_SHADOW,
                pointerEvents: "none",
                zIndex: -1,
                animationName: "$search-fade-in",
                animationDuration: "160ms",
                animationTimingFunction: EASE,
                animationFillMode: "both",
                [theme.breakpoints.down("sm")]: { top: -BAR_H_SM, borderRadius: 16 },
            },
        },
        searchBarResult: {
            width: "100%",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            contain: "style layout",
            borderRadius: "0 0 28px 28px",
            margin: 0,
            backgroundColor: "#222222",
            maxHeight: "min(75vh, 386px)", // replaced inline by the measured value
            [theme.breakpoints.down("sm")]: { borderRadius: "0 0 16px 16px" },
        },
        filterCollapse: { flex: "0 0 auto" },
        // The results scroll in a rounded window inset from the dropdown's sides (the
        // same inset as the filter panel above it). Section headers are dark rounded
        // bars in the filter panel's colour.
        searchScroll: {
            flex: "1 1 auto",
            minHeight: 0,
            overflowY: "auto",
            margin: "0 16px",
            borderRadius: 16,
            [theme.breakpoints.down("sm")]: { margin: "0 12px" },
            "& .MuiListSubheader-sticky": { backgroundColor: PANEL_BG, borderRadius: 16, margin: "8px 0" },
            "& .MuiList-padding": { paddingTop: 0 },
        },
        subheaderSticky: { color: "white", fontWeight: "bold", fontSize: 16 },
        listItemText: { cursor: "pointer" },
        historyElement: {
            justifyContent: "end",
            color: "#666",
            cursor: "pointer",
            transition: `color ${buttonTransition}`,
            "&:hover": { color: "#ccc" },
        },
        historyList: { "&.MuiListItem-gutters": { paddingRight: 0 } },

        // ── rows with avatars ──
        row: {
            paddingLeft: 4,
            paddingRight: 4,
            borderRadius: 8,
            "&.MuiListItem-button:hover": { backgroundColor: "rgba(255,255,255,0.06)" },
        },
        rowAvatar: { minWidth: 44 },
        rowText: { margin: 0, minWidth: 0 },
        // Users two per row, tags three per row: grids of ordinary rows (same hover,
        // same radius). minmax(0, 1fr) lets a long name or tag ellipsize instead of
        // widening its column.
        userGrid: {
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            columnGap: 8,
        },
        tagGrid: {
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            columnGap: 4,
        },
        // Post rows have no picture in the corner, so the title sat right inside the
        // hover background's rounded corner: they get room on every side (after
        // `row`, so these paddings win).
        postRow: {
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 6,
            paddingBottom: 6,
        },
        loading: { display: "flex", justifyContent: "center", padding: "16px 0" },
        noResult: { margin: "12px 8px 12px 8px", color: "#999999" },
        noResultLink: { textDecoration: "underline", cursor: "pointer" },
        // Posts + artworks while a filter change is in flight: the previous
        // results stay visible, dimmed, until the Worker answers.
        dimmed: { opacity: 0.45, transition: "opacity 150ms linear", pointerEvents: "none" },

        // ── filter panel ──
        // A darker rounded square pinned under the bar; scrolls on its own if
        // it ever gets taller than ~70 % of the dropdown. A two-column grid: the
        // label column is as wide as the longest label of the current language
        // (max-content), so no translation overflows it; one column on phones,
        // labels above their options.
        filterPanel: {
            margin: "4px 16px 8px 16px",
            padding: "10px 14px 10px 14px",
            backgroundColor: PANEL_BG,
            borderRadius: 16,
            overflowY: "auto",
            boxSizing: "border-box",
            display: "grid",
            gridTemplateColumns: "max-content minmax(0, 1fr)",
            columnGap: 16,
            alignItems: "start",
            [theme.breakpoints.down("sm")]: {
                margin: "4px 12px 8px 12px",
                padding: "8px 10px",
                borderRadius: 12,
                gridTemplateColumns: "minmax(0, 1fr)",
            },
        },
        filterLabel: {
            color: "#777",
            fontSize: 11,
            lineHeight: "26px",
            padding: "5px 0",
            textTransform: "uppercase",
            letterSpacing: 0.5,
            whiteSpace: "nowrap",
            [theme.breakpoints.down("sm")]: { lineHeight: "16px", padding: "6px 0 2px 0" },
        },
        filterOptions: {
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            minWidth: 0,
            alignItems: "center",
            padding: "5px 0",
            [theme.breakpoints.down("sm")]: { padding: "0 0 4px 0" },
        },
        filterBreak: { flexBasis: "100%", height: 0 },
        // Colour swatches mean nothing for posts: inert while "Posts" is selected.
        filterDisabled: { opacity: 0.35, pointerEvents: "none" },
        filterNote: { color: "#666", fontSize: 11, lineHeight: "26px", fontStyle: "italic", marginRight: 4 },
        filterFooter: { gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", paddingTop: 4 },
        filterReset: {
            background: "transparent",
            border: "none",
            color: "#888",
            fontSize: 12,
            fontFamily: "inherit",
            cursor: "pointer",
            padding: "2px 4px",
            outline: "none",
            transition: `color ${buttonTransition}`,
            "&:hover, &:focus-visible": { color: "#eee" },
        },
        pill: {
            backgroundColor: FIELD_BG,
            border: "none",
            borderRadius: 8,
            color: "#aaa",
            fontSize: 12,
            lineHeight: "18px",
            padding: "4px 10px",
            cursor: "pointer",
            fontFamily: "inherit",
            outline: "none",
            whiteSpace: "nowrap",
            transition: `color ${buttonTransition}, background-color ${buttonTransition}`,
            "&:hover, &:focus-visible": { backgroundColor: FIELD_BG_HOVER, color: "#eee" },
            "&.on": { backgroundColor: ON_BG, color: "#111" },
            [theme.breakpoints.down("sm")]: { padding: "4px 8px" },
        },
        // Flat colour squares: no border, no ring, selected = check mark.
        swatch: {
            width: 22,
            height: 22,
            borderRadius: 6,
            border: "none",
            padding: 0,
            margin: 0,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            outline: "none",
            boxSizing: "border-box",
            transition: "transform 120ms ease",
            "&:hover, &:focus-visible": { transform: "scale(1.15)" },
            "& svg": { fontSize: 15 },
        },
        // The app's DateRangePicker field, dressed like the panel's other fields:
        // flat, no outline (hover and focus included), compact. Its calendar is a
        // dialog of its own and keeps its own look.
        dateRange: { width: "100%", marginTop: 2 },
        dateRangeField: {
            "& .MuiOutlinedInput-root": {
                backgroundColor: FIELD_BG,
                borderRadius: 8,
                fontSize: 13,
                color: "#ddd",
                transition: `background-color ${buttonTransition}`,
            },
            "& .MuiOutlinedInput-root:hover, & .MuiOutlinedInput-root.Mui-focused": { backgroundColor: FIELD_BG_HOVER },
            "& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline, & .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline, & .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
                border: "none",
            },
            "& .MuiOutlinedInput-input": { padding: "6px 10px", height: 18, lineHeight: "18px" },
            "& .MuiOutlinedInput-adornedEnd": { paddingRight: 2 },
            "& .MuiInputAdornment-root .MuiIconButton-root": { color: "#888", padding: 4 },
            "& .MuiInputAdornment-root .MuiSvgIcon-root": { fontSize: 18 },
            "& input::placeholder": { color: "#666", opacity: 1 },
        },

        // ── text fields with suggestions (authors, communities) ──
        tokenField: { position: "relative", flex: "1 1 0", minWidth: 0 },
        tokenBox: {
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 4,
            minHeight: 30,
            padding: "3px 6px",
            boxSizing: "border-box",
            backgroundColor: FIELD_BG,
            borderRadius: 8,
            cursor: "text",
            transition: `background-color ${buttonTransition}`,
            "&:focus-within": { backgroundColor: FIELD_BG_HOVER },
        },
        token: {
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            maxWidth: "100%",
            height: 22,
            padding: "0 2px 0 3px",
            borderRadius: 6,
            backgroundColor: "#3a3a3a",
            color: "#ddd",
            fontSize: 12,
            boxSizing: "border-box",
        },
        tokenLabel: { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, paddingLeft: 2 },
        tokenRemove: {
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 16,
            height: 16,
            padding: 0,
            border: "none",
            borderRadius: 4,
            background: "transparent",
            color: "#999",
            cursor: "pointer",
            outline: "none",
            "&:hover, &:focus-visible": { color: "#fff", backgroundColor: "rgba(255,255,255,0.1)" },
            "& svg": { fontSize: 13 },
        },
        tokenInput: {
            flex: "1 1 60px",
            minWidth: 60,
            height: 22,
            border: "none",
            outline: "none",
            background: "transparent",
            color: "#ddd",
            fontSize: 13,
            fontFamily: "inherit",
            padding: "0 2px",
            "&::placeholder": { color: "#666" },
        },
        suggestList: {
            marginTop: 4,
            padding: 4,
            backgroundColor: FIELD_BG,
            borderRadius: 8,
        },
        suggestItem: {
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
            padding: "4px 6px",
            borderRadius: 6,
            cursor: "pointer",
            color: "#ccc",
            fontSize: 13,
            "&.on": { backgroundColor: "#353535", color: "#fff" },
        },
        suggestLabel: { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 },
        suggestSub: { color: "#777", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, marginLeft: "auto", paddingLeft: 8, flexShrink: 1 },
    };
};