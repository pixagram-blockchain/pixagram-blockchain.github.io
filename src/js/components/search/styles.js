"use strict";

// ── Search styles ─────────────────────────────────────────────────────────────
// Moved verbatim from Index's stylesheet (searchBar*, searchInput, searchButton,
// subheaderSticky, listItemText, history*) so the search folder owns its look;
// the row/avatar/masonry additions live here too. Same breakpoints, same
// numbers: the bar still sits exactly where the toolbar expects it.

const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

export const searchStyles = (theme) => {
    const searchBarBase = {
        boxShadow: "inset 0px 3px 2px 0px rgba(0,0,0,0.2), inset 0px 2px 2px 1px rgba(0,0,0,0.14), inset 0px 2px 5px 2px rgba(0,0,0,0.12)",
        display: "inline-block",
        padding: "12px 32px",
        backgroundColor: "#222222",
        verticalAlign: "top",
        height: 32,
        width: 320,
        boxSizing: "content-box",
        margin: "24px 32px 16px 32px",
        position: "relative",
        transition: `border-radius 150ms ${EASE}`,
        [theme.breakpoints.down("md")]: { width: 256, margin: "24px 16px 16px 32px" },
        [theme.breakpoints.down("sm")]: {
            maxWidth: "calc(100% - 176px)",
            height: 24,
            margin: "12px 16px 8px 64px",
            padding: "8px 24px",
            position: "absolute",
        },
    };
    const buttonTransition = `225ms ${EASE}`;

    return {
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
            boxShadow: "none",
            borderRadius: "28px 28px 0 0",
            [theme.breakpoints.down("sm")]: { ...searchBarBase[theme.breakpoints.down("sm")], borderRadius: "16px 16px 0 0" },
        },
        searchBarOpenMenu: {
            zIndex: 9,
            width: 320,
            [theme.breakpoints.down("md")]: { width: 256 },
            [theme.breakpoints.down("sm")]: { maxWidth: "calc(100% - 176px)" },
        },
        searchBarResult: {
            padding: "0 16px",
            contain: "style layout",
            borderRadius: "0 0 28px 28px",
            margin: 0,
            backgroundColor: "#222222",
            maxHeight: "min(75vh, 386px)",
            overflow: "overlay",
            boxShadow: "#22222233 0px 7px 8px -4px, #22222224 0px 12px 17px 2px, #2222221f 0px 5px 22px 4px",
            [theme.breakpoints.down("sm")]: { borderRadius: "0 0 16px 16px" },
            "& .MuiListSubheader-sticky": { backgroundColor: "#222222" },
            "& .MuiList-padding": { paddingTop: 0 },
        },
        searchButton: {
            position: "absolute",
            right: 8,
            top: 4,
            [theme.breakpoints.down("sm")]: { right: 0, top: -4, color: "#666" },
        },
        searchInput: {
            width: "100%",
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
            [theme.breakpoints.down("sm")]: { lineHeight: "32px", fontSize: 14, height: 40 },
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
        loading: { display: "flex", justifyContent: "center", padding: "16px 0" },
        noResult: { margin: "12px 8px 12px 8px", color: "#999999" },
        noResultLink: { textDecoration: "underline", cursor: "pointer" },
    };
};
