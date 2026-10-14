// ── Rendered-article tables ──────────────────────────────────────────────
// One table look shared by BlogPostDialog (the published post) and the
// editor's PreviewDialog, so the preview is exactly what readers get.
// Spread into the JSS rule of the HTML container:
//
//     blogContent: { …, ...articleTableStyles }
//
// Layout: the table is `display: block` with `width: max-content` capped at
// `max-width: 100%`. A narrow table keeps its natural width; a wide one is
// capped at the column width, where its cells first wrap their text and,
// only once a column can't shrink any further, the table itself scrolls
// horizontally — the 16px rounded frame stays put while the rows slide.
// (overflow on the block also clips the cells to the rounded corners.)
//
// Colors are white overlays rather than fixed greys, so the same rules sit
// right on the post card (#101010) and on the preview surface (#0a0a0a):
// header lighter than cells, cells lighter than the page.
//
// Header background and text color carry !important: a header cell must
// never fall back to a light background with light text, whatever another
// stylesheet or an inline style (pasted HTML) puts on <th>.

const TABLE_BORDER = "rgba(255,255,255,0.12)";
const CELL_SEPARATOR = "rgba(255,255,255,0.07)";
const HEADER_SEPARATOR = "rgba(255,255,255,0.14)";
const CELL_BACKGROUND = "rgba(255,255,255,0.035)";
const HEADER_BACKGROUND = "rgba(255,255,255,0.085)";

export const articleTableStyles = {
    "& table": {
        display: "block",
        width: "max-content",
        maxWidth: "100%",
        overflowX: "auto",
        overflowY: "hidden",
        WebkitOverflowScrolling: "touch",
        borderCollapse: "separate",
        borderSpacing: 0,
        margin: "1.5em 0",
        backgroundColor: "transparent",
        border: `1px solid ${TABLE_BORDER}`,
        borderRadius: 16,
        fontSize: "0.95em",
        lineHeight: 1.45,
        textAlign: "left",
        scrollbarWidth: "thin",
        scrollbarColor: "#444 transparent",
        "&::-webkit-scrollbar": { height: 6 },
        "&::-webkit-scrollbar-thumb": { backgroundColor: "#444", borderRadius: 3 },
        "&::-webkit-scrollbar-track": { backgroundColor: "transparent" },
    },
    "& th, & td": {
        padding: "10px 14px",
        minWidth: 64,
        verticalAlign: "top",
        textAlign: "left",
        overflowWrap: "break-word",
        border: "none",
        borderRight: `1px solid ${CELL_SEPARATOR}`,
        borderBottom: `1px solid ${CELL_SEPARATOR}`,
    },
    "& td": {
        backgroundColor: CELL_BACKGROUND,
        color: "#dddddd",
    },
    "& th": {
        backgroundColor: `${HEADER_BACKGROUND} !important`,
        color: "#ffffff !important",
        fontWeight: 600,
        borderBottomColor: HEADER_SEPARATOR,
    },
    // Interior separators only — the table's own border draws the outside.
    "& tr > *:last-child": {
        borderRight: "none",
    },
    // Last row of the body (or of a table without thead/tbody). Not a plain
    // `tr:last-child`: the header row is the last row of <thead>, and it
    // keeps its separator.
    "& tbody > tr:last-child > *, & table > tr:last-child > *": {
        borderBottom: "none",
    },
    // Paragraph margins (1.5rem on the post, 1em in the preview) read as
    // dead space at the bottom of every cell.
    "& th > p, & td > p": {
        margin: 0,
    },
    "& th > p + p, & td > p + p": {
        marginTop: "0.5em",
    },
    // Body copy is justified on the post; a narrow cell justified looks
    // like a ransom note.
    "& th *, & td *": {
        textAlign: "inherit",
    },
    // `align` is a presentational attribute, so `textAlign: left` above beats
    // it. marked and micromark emit column alignment as align="center" /
    // align="right" — without these, aligned columns render left.
    "& th[align='center'], & td[align='center']": {
        textAlign: "center",
    },
    "& th[align='right'], & td[align='right']": {
        textAlign: "right",
    },
    "& td img, & th img": {
        margin: 0,
    },
};
