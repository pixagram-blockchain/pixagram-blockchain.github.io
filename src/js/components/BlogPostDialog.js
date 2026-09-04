import * as React from "preact/compat";
import { memo } from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import Card from '@material-ui/core/Card';
import Backdrop from '@material-ui/core/Backdrop';
import CardContent from '@material-ui/core/CardContent';
import Typography from '@material-ui/core/Typography';
import Portal from '@material-ui/core/Portal';
import IconButton from '@material-ui/core/IconButton';
import Avatar from "@material-ui/core/Avatar";
import Chip from "@material-ui/core/Chip";
import Divider from "@material-ui/core/Divider";
import TextField from "@material-ui/core/TextField";
import Grid from "@material-ui/core/Grid";
import Fade from "@material-ui/core/Fade";
import Tooltip from "@material-ui/core/Tooltip";
import List from "@material-ui/core/List";
import Collapse from "@material-ui/core/Collapse";
import Radio from "@material-ui/core/Radio";
import RadioGroup from "@material-ui/core/RadioGroup";
import FormControl from "@material-ui/core/FormControl";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import FormLabel from "@material-ui/core/FormLabel";
import CircularProgress from "@material-ui/core/CircularProgress";
import Skeleton from "@material-ui/lab/Skeleton";
import Button from "@material-ui/core/Button";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import ShareRounded from "@material-ui/icons/ShareRounded";
import CommentRounded from "@material-ui/icons/CommentRounded";
import SendRounded from "@material-ui/icons/SendRounded";
import CloseIcon from "@material-ui/icons/Close";
import ArrowForwardIosIcon from "@material-ui/icons/ArrowForwardIos";
import VisibilityRounded from "@material-ui/icons/VisibilityRounded";
import VisibilityOffRounded from "@material-ui/icons/VisibilityOffRounded";
import MoreVertRounded from "@material-ui/icons/MoreVertRounded";
import EditRounded from "@material-ui/icons/EditRounded";
import TuneRounded from "@material-ui/icons/TuneRounded";
import DeleteOutlineRounded from "@material-ui/icons/DeleteOutlineRounded";
import FavoriteRounded from "@material-ui/icons/FavoriteRounded";
import FavoriteBorderRounded from "@material-ui/icons/FavoriteBorderRounded";
import InfoOutlined from "@material-ui/icons/InfoOutlined";
import useLiveTimeAgo from "../hooks/useLiveTimeAgo";
import { HISTORY, getPostState, POST_STATE, parsePostDrawerHash, POST_DRAWER_HASH_TABS, parseCommentFocusHash } from "../utils/constants";
import CommentInList from "./CommentInList";
import { ToxicityWatcher } from "./ToxicityHint";
import * as toxicity from "../utils/toxicity";
import PaperCardActions from "./PaperCardActions";
import EditPostDialog, { DeletePostDialog } from "./EditPostDialog";
import DeleteCommentModal from "./DeleteCommentModal";
import * as clipboard from "clipboard-polyfill";
import * as actions from "../actions/utils";
import * as favorites from "../utils/favorites";
import { sanitizeComment as rawSanitizeComment, safeHTML } from "../utils/api/sanitizer";
import { cssBackgroundImage } from "../utils/safeUrl";

import { T } from "../utils/T";
import { t, useLanguage } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";

// Hoisted static styles — were inline literals re-created on every render.
const ST_POS_RELATIVE__P_12PX_12PX_12PX__M_32PX_4PX_0PX_4 = { position: "relative", padding: "12px 12px 12px 12px", margin: "32px 4px 0px 4px", borderRadius: "12px", backgroundColor: "#121212" };
const ST_MB_4__D_BLOCK = { marginBottom: 4, display: "block" };
const ST_C_999 = { color: "#999" };
const ST_LH_1REM__LS_0 = { lineHeight: "1rem", letterSpacing: 0 };
const ST_C_888 = { color: "#888" };
const ST_FS_13__VA_TEXT_BOTTOM__MR_4 = { fontSize: 13, verticalAlign: "text-bottom", marginRight: 4 };
const ST_P_2__ML_4 = { padding: 2, marginLeft: 4 };
const ST_FS_14__C_666 = { fontSize: 14, color: "#666" };
const ST_C_BBB = { color: "#bbb" };
const ST_PL_48 = { paddingLeft: 48 };
const ST_C_666 = { color: "#666" };
const ST_D_INLINE_FLEX__FLOAT_LEFT = { display: "inline-flex", float: "left" };
const ST_C_999__MINW_36 = { color: "#999", minWidth: 36 };
const ST_C_DDD__FS_14 = { color: "#ddd", fontSize: 14 };
const ST_D_FLOW__H_48PX__POS_RELATIVE = { display: "flow", height: "48px", position: "relative", width: "calc(100% - 16px)", margin: "8px 8px 0px 8px" };
const ST_FLOAT_LEFT__D_FLEX__POS_RELATIVE = { float: "left", display: "flex", position: "relative" };
const ST_VA_MIDDLE__LH_48PX__C_FFF = { verticalAlign: "middle", lineHeight: "48px", color: "#fff" };
const ST_C_575757__TRANSF_ROTATE_180DEG__M_8PX_0PX_8PX_0P = { color: "#575757", transform: "rotate(-180deg)", margin: "8px 0px 8px 0px" };
const ST_D_FLOW__POS_RELATIVE__W_CALC_100_16PX = { display: "flow", position: "relative", width: "calc(100% - 16px)", margin: "8px 8px 0px 8px" };
const ST_C_FFF__M_10PX_8PX_8PX_0__FLOAT_LEFT = { color: "#fff", margin: "10px 8px 8px 0px", float: "left", fontWeight: "bold" };
const ST_JC_END__FLOAT_RIGHT = { justifyContent: "end", float: "right" };
const ST_P_8PX_0 = { padding: "8px 0" };
const ST_D_FLEX__P_12PX_16PX__GAP_12 = { display: "flex", padding: "12px 16px", gap: 12 };
const ST_FLEX_1 = { flex: 1 };
const ST_MT_6 = { marginTop: 6 };
const ST_TA_CENTER__P_32PX_16PX = { textAlign: "center", padding: "32px 16px" };
const ST_FS_48__C_333__MB_8 = { fontSize: 48, color: "#333", marginBottom: 8 };
const ST_C_666__MB_4 = { color: "#666", marginBottom: 4 };
const ST_C_444 = { color: "#444" };

/**
 * Guard user-supplied HTML at the dangerouslySetInnerHTML boundary.
 *
 * Bodies arriving here are ALREADY rendered and sanitised: pixaproxyapi's
 * SanitizationPipeline runs markdown → HTML, mention/link processing and the
 * tier allowlist once, at the data layer, and stores the result in `body`.
 * The component's job is only defence in depth.
 *
 * These used to call api.sanitizePostHTML()/sanitizeCommentHTML(), which is a
 * full SECOND render — marked, MentionProcessor, the <a> transform and the
 * image cap all run again over HTML that is already output. Besides the wasted
 * work, isPredominantlyHtml() needs two HTML indicators to trip, so a rendered
 * body that is a bare <img> or a single unwrapped line scored zero and got fed
 * back through the markdown parser.
 *
 * safeHTML() is allowlist-only and performs no rendering, so it is idempotent
 * over already-sanitised markup. It applies the POST allowlist; that is not a
 * widening for comments, because comment bodies were already narrowed to the
 * comment tier upstream and a guard can only remove tags, never restore them.
 */
function renderCommentBody(body) {
    if (!body) return "";
    return safeHTML(body);
}

function renderPostBody(body) {
    if (!body) return "";
    return safeHTML(body);
}

/**
 * Table-of-contents processing — runs AFTER safeHTML(), never before.
 *
 * The post allowlist deliberately has no `id` attribute, so any id an author
 * writes into their markup is stripped by the guard above. The ids injected
 * here are therefore the only ones that can exist inside the article: they
 * are derived from the heading text, restricted to [a-z0-9-] and prefixed
 * "bp-", so they can never collide with application element ids nor clobber
 * window/document properties.
 *
 * DOMParser produces an inert document (no script execution, no fetches),
 * and what we serialize back is the output of the very parser that will
 * re-parse it at the dangerouslySetInnerHTML boundary — no mutation gap.
 *
 * The boundary guard (ArticleBody below) runs safeHTML() one more time, and
 * a plain safeHTML() would strip these ids right back out — that is why the
 * TOC clicks used to find no target. ARTICLE_GUARD tells it the one id shape
 * it may keep, on headings only; everything else the guard does is unchanged.
 */
const HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6";
const HEADING_ID_PREFIX = "bp-";
const HEADING_ID_RE = /^bp-[a-z0-9-]+$/;          // prefix + slugifyHeading alphabet
// One frozen object, module-wide: safeHTML caches its compiled config per
// options object, so this must not be an inline literal at the call site.
const ARTICLE_GUARD = Object.freeze({ allowedIds: HEADING_ID_RE });

function slugifyHeading(text) {
    return (text || "")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")   // é → e, ü → u …
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 64) || "section";
}

function processArticleHtml(safeHtml) {
    if (!safeHtml || typeof DOMParser === "undefined") {
        return { html: safeHtml || "", headings: [] };
    }
    let doc = null;
    try {
        doc = new DOMParser().parseFromString(safeHtml, "text/html");
    } catch (e) {
        return { html: safeHtml, headings: [] };
    }
    const nodes = doc.body.querySelectorAll(HEADING_SELECTOR);
    if (!nodes.length) return { html: safeHtml, headings: [] };

    const counters = Object.create(null);
    const used = Object.create(null);
    const headings = [];
    nodes.forEach((el) => {
        const text = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (!text) return;
        const base = HEADING_ID_PREFIX + slugifyHeading(text);
        let id = base;
        if (counters[base] === undefined) {
            counters[base] = 0;
        } else {
            counters[base] += 1;
            id = base + "-" + counters[base];
        }
        while (used[id]) {                 // a literal "…-1" heading can collide
            counters[base] += 1;
            id = base + "-" + counters[base];
        }
        used[id] = true;
        el.setAttribute("id", id);
        headings.push({ id, text, level: parseInt(el.tagName.charAt(1), 10) || 6 });
    });
    return { html: doc.body.innerHTML, headings };
}

/**
 * The rendered article — the ONE dangerouslySetInnerHTML boundary for the
 * post body. safeHTML() stays the last call before the DOM, with the TOC
 * namespace declared through ARTICLE_GUARD (a plain safeHTML() here stripped
 * the "bp-" heading ids, so the side menu had nothing to scroll to).
 *
 * memo(): every prop is referentially stable — `html` is the memoized string
 * out of _get_article, `className` comes from withStyles, `setRef` and
 * `onClick` are instance arrows — so this re-renders once per body change
 * instead of on every dialog render. The dialog re-renders on each scroll
 * frame (_scrollTop), and running the guard over a 500 kB article per frame
 * was the cost _get_article's memoization was meant to remove; the guard
 * itself is untouched — it just isn't re-run on identical input.
 */
const ArticleBody = memo(({ className, html, setRef, onClick }) => (
    <div
        className={className}
        ref={setRef}
        onClick={onClick}
        dangerouslySetInnerHTML={{ __html: safeHTML(html, ARTICLE_GUARD) }}
    />
));

// ── Image lightbox (hero zoom) tuning ────────────────────────────────────
const LIGHTBOX_VIEWPORT_RATIO = 0.8;      // zoomed image fits 80% of the screen
const LIGHTBOX_MIN_SOURCE_PX = 48;        // inline icons / tiny images stay put
const LIGHTBOX_SCROLL_DISMISS_PX = 100;   // container travel that sends it home
const LIGHTBOX_GESTURE_DISMISS_PX = 140;  // accumulated wheel/touch when the container can't move
const LIGHTBOX_MAX_RADIUS = 42;           // house radius of the cover surface
const LIGHTBOX_MS = 340;
const LIGHTBOX_EASING = "cubic-bezier(0.2, 0, 0, 1)";
const TOC_MS = 260;                       // minimap grow / shrink duration
// Synthetic TOC entry for the post's main title (rendered above the body,
// in view at scrollTop = 0). Underscores sit outside the [a-z0-9-] slug
// alphabet and the id carries no "bp-" prefix, so it can never collide
// with a heading id generated by processArticleHtml.
const TOC_TITLE_ID = "__title__";

// The fixed header's top inset: a 16px floating gap on desktop, flush 0 on
// mobile (< 960px — the app's phone cutoff, the same line as the sm style
// overrides below) where the cover runs full-bleed from the screen's top edge.
const headerTopOffset = () =>
    (typeof window !== "undefined" && window.innerWidth < 960) ? 0 : 16;


// The full Lexical editor is heavy — load it only when the owner actually
// opens "Edit content" (same deferred pattern as Community.js).
const loadTextEditorDialog = () => import("./editor/LexicalTextEditorDialog");
const LazyTextEditorDialog = React.lazy(loadTextEditorDialog);

const styles = theme => ({
    backdrop: {
        zIndex: theme.zIndex.drawer + 1,
        backdropFilter: "blur(9px) grayscale(1)",
        overflow: "hidden",
        // No userSelect: "none" here — it cascaded over the whole dialog and
        // made the title, article body and comments impossible to copy.
        // Interactive chrome stays unselectable on its own: MUI ButtonBase
        // ships userSelect: none, and the author/TOC/label classes below
        // each carry their own flag.
    },
    scrollContainer: {
        width: "100%",
        height: "100%",
        overflow: "auto",
        position: "relative"
    },
    headerWrapper: {
        position: "fixed",
        width: "100%",
        top: 16,
        left: 0,
        overflow: "hidden",
        zIndex: 10,
        pointerEvents: "none",
        // Mobile: no floating inset — the cover starts at the very top of the
        // screen. Pairs with the square corners on coverImage below and the
        // taller expanded headerHeight computed in render().
        [theme.breakpoints.down("sm")]: {
            top: 0,
        }
    },
    headerContainer: {
        position: "relative",
        width: "100%",
        height: "100%",
        willChange: "transform",
        transition: "none",
    },
    coverImage: {
        width: "100%",
        maxWidth: "932px",
        height: "100%",
        margin: "0 auto",
        display: "block",
        borderRadius: "42px",
        position: "relative",
        overflow: "hidden",
        transition: "border-radius 300ms cubic-bezier(0.4, 0, 0.2, 1)",
        // Mobile: full-bleed — square corners and no width cap, so the cover
        // reads as one uninterrupted surface from the screen top to the card.
        [theme.breakpoints.down("sm")]: {
            maxWidth: "100%",
            borderRadius: 0,
        }
    },
    coverBackground: {
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        willChange: "transform, filter",
        transition: "filter 300ms cubic-bezier(0.4, 0, 0.2, 1)",
    },
    coverOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        padding: "24px 48px",
        background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.3) 60%, rgba(0,0,0,0.7) 100%)",
        transition: "background 300ms cubic-bezier(0.4, 0, 0.2, 1)",
        [theme.breakpoints.down("sm")]: {
            padding: "16px 24px",
        }
    },
    coverOverlayDark: {
        background: "linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.6) 60%, rgba(0,0,0,0.85) 100%)",
    },
    headerTitle: {
        fontSize: "1.75rem",
        fontWeight: "bold",
        lineHeight: 1.2,
        textShadow: "0 2px 8px rgba(0,0,0,0.8)",
        color: "#fff",
        fontFamily: '"Industry Book", "Normative Pro"',
        margin: 0,
        opacity: 0,
        transform: "translateY(10px)",
        transition: "opacity 300ms cubic-bezier(0.4, 0, 0.2, 1), transform 300ms cubic-bezier(0.4, 0, 0.2, 1)",
        // The close icon is fixed top-right: 24px inset + ~48px button width
        // reaches ~72px in from the right edge, inside the collapsed title's
        // vertical band. Keep the text out of that zone — overlay padding
        // (48 desktop / 24 mobile) + this paddingRight = 80px clearance, so
        // a long wrapping title breaks before the icon instead of under it.
        paddingRight: 32,
        [theme.breakpoints.down("sm")]: {
            fontSize: "1.25rem",
            paddingRight: 56,
        }
    },
    headerTitleVisible: {
        opacity: 1,
        transform: "translateY(0)",
    },
    /* ── Stacked layout: content on top, comments below ── */
    contentWrapper: {
        position: "relative",
        width: "100%",
        paddingBottom: "48px",
        zIndex: 1,
    },
    desktopLayout: {
        display: "flex",
        flexDirection: "column",
        maxWidth: "800px",
        margin: "0 auto",
        gap: 0,
        [theme.breakpoints.down("md")]: {
            maxWidth: "100%",
        }
    },
    paperCardColumn: {
        width: "100%",
    },
    commentsColumn: {
        width: "100%",
        display: "flex",
        flexDirection: "column",
    },
    commentsCard: {
        backgroundColor: "#101010",
        borderRadius: "0px 0px 32px 32px !important",
        boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        display: "flex",
        flexDirection: "column",
        overflow: "visible",
    },
    commentsCardContent: {
        padding: "16px 16px 16px 16px",
    },
    /* ── Comment input bar at bottom of comments panel ── */
    commentInputBar: {
        backgroundColor: "#060606",
        padding: "12px 16px",
        borderRadius: "32px"
    },
    commentInputBarReply: {
        display: "flex",
        alignItems: "center",
        marginBottom: 6,
        gap: 6,
    },
    /* ── Existing styles ── */
    paperCard: {
        width: "100%",
        position: "relative",
        backgroundColor: "#101010",
        borderRadius: "32px 32px 0px 0px !important",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        willChange: "transform",
        // Mobile: square top corners — the cover's bottom edge sits exactly
        // on the card (gap 0), so rounded corners would let the backdrop
        // peek through at the seam. !important mirrors the base rule (both
        // fight MUI Card's own radius); the media-query rule wins by order.
        [theme.breakpoints.down("sm")]: {
            borderRadius: "0px !important",
        }
    },
    paperContent: {
        padding: "48px 48px 48px 48px",
        [theme.breakpoints.down("sm")]: {
            padding: "32px 24px 32px 24px",
        }
    },
    authorSection: {
        display: "flow-root",
        alignItems: "center",
        marginBottom: "24px",
        width: "100%"
    },
    authorAvatar: {
        cursor: "pointer",
        borderRadius: "14px",
        width: 48,
        height: 48,
        userSelect: "none",
        marginRight: 8,
    },
    authorDetails: {
        display: "flex",
        flexDirection: "column",
    },
    authorName: {
        fontWeight: "bold",
        fontFamily: '"Industry Book", "Normative Pro"',
        color: "#fff",
        cursor: "pointer",
        userSelect: "none",
        fontSize: "1rem",
        "&:hover": {
            textDecoration: "underline",
        }
    },
    authorMeta: {
        display: "inline-block",
        textOverflow: "ellipsis",
        overflow: "hidden",
        whiteSpace: "nowrap",
        userSelect: "none",
    },
    subheaderName: {
        color: "#fff",
        cursor: "pointer",
        userSelect: "none",
    },
    subheaderBy: {
        color: "#aaa",
        userSelect: "none",
    },
    subheaderDate: {
        color: "#ddd",
        userSelect: "none",
    },
    title: {
        fontSize: "3em",
        fontWeight: "normal",
        marginBottom: "24px",
        lineHeight: 1.2,
        color: "#ffffff",
        fontFamily: '"Industry Book", "Normative Pro"',
        [theme.breakpoints.down("sm")]: {
            fontSize: "1.75rem",
            marginBottom: "12px",
        }
    },
    chipTags: {
        display: "none",
        lineHeight: "34px",
        gap: "8px",
        width: "100%",
        padding: "0px",
        flexWrap: "wrap",
        justifyContent: "flex-start",
        marginTop: "12px",
        marginBottom: "12px",
        "& .MuiChip-root": {
            cursor: "pointer",
            borderRadius: "12px",
            backgroundColor: "#1b1b1b",
            color: "#979797",
            transition: "background-color 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms, color 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms, box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
        },
        "& .MuiChip-root:hover": {
            backgroundColor: "#2a2a2a",
            color: "#e3e3e3",
        }
    },
    blogContent: {
        fontSize: "1.125rem",
        lineHeight: 1.35,
        color: "#ddd",
        fontFamily: "'Normative Pro'",
        textAlign: "justify",              // body copy is justified…
        "& h1, & h2, & h3, & h4, & h5, & h6": {
            fontFamily: "'Industry Book'",
            fontWeight: "normal",
            textAlign: "left",             // …headings are not
        },
        "& p": {
            marginBottom: "1.5rem",
        },
        "& h2": {
            fontSize: "2rem",
            marginTop: "2.5rem",
            marginBottom: "1rem",
            color: "#fff",
        },
        "& h3": {
            fontSize: "1.5rem",
            marginTop: "2rem",
            marginBottom: "0.75rem",
            color: "#eee",
        },
        "& blockquote": {
            borderLeft: "4px solid #444",
            paddingLeft: "1.5rem",
            marginLeft: 0,
            marginRight: 0,
            fontStyle: "italic",
            color: "#888",
        },
        "& code": {
            backgroundColor: "#1a1a1a",
            padding: "2px 6px",
            borderRadius: "4px",
            fontFamily: "monospace",
            fontSize: "0.9em",
            color: "#ccc",
        },
        "& pre": {
            backgroundColor: "#0a0a0a",
            padding: "1rem",
            borderRadius: "12px",
            overflow: "auto",
        },
        "& a": {
            color: "#ffffff",
            textDecoration: "underline",
        },
        "& img": {
            maxWidth: "100%",
            height: "auto",
            cursor: "zoom-in",
        },
        "& a img": {
            cursor: "pointer",   // linked images navigate, they don't zoom
        }
    },
    actions: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        float: "right"
    },
    shareButton: {
        color: "#888",
        transition: "color 275ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        "&:hover": {
            color: "#bbb",
        }
    },
    commentsHeader: {
        fontSize: "1.5rem",
        fontWeight: "bold",
        marginBottom: "24px",
        color: "#fff",
        fontFamily: '"Industry Book", "Normative Pro"',
        display: "flex",
        alignItems: "center",
        gap: "8px",
        "& svg": {
            verticalAlign: "middle",
        }
    },
    commentTextField: {
        width: "100%",
        "& .MuiInputBase-input": {
            color: "#e0e0e0",
        },
        "& .MuiInputLabel-root": {
            color: "rgba(255,255,255,0.5)",
            userSelect: "none",
        },
        "& .MuiInput-underline:after": {
            borderBottom: "2px solid #ffffff",
        },
        "& .MuiInput-underline:hover:not(.Mui-disabled):before": {
            borderBottom: "2px solid #bbbbbb",
        },
        "& .MuiInput-underline:before": {
            borderBottom: "1px solid #444",
        },
        "& .MuiInputBase-fullWidth": {
            width: "100%",
        }
    },
    commentAvatar: {
        width: 48,
        height: 48,
        cursor: "pointer",
        borderRadius: "14px",
    },
    commentSendButton: {
        backgroundColor: "#ffffff17",
        color: "#fff",
        "&:hover": {
            backgroundColor: "#ffffff24"
        },
        "&:disabled": {
            color: "#555"
        }
    },
    closeButton: {
        position: "fixed",
        top: "24px",
        right: "24px",
        color: "#fff",
        zIndex: 100
    },
    /* ── Table of contents (Medium-style minimap) ─────────────────────────
       A tiny vertical black capsule, vertically centered on the right edge:
       bars = main titles, dots = sub-titles. On hover or click it grows into
       the full table of contents, set in Industry Book. Both states use
       explicit row heights and paddings, so the growth is a pure CSS
       transition on the same nodes — markers slide, labels fade in. */
    tocPanel: {
        position: "fixed",
        top: "50%",
        right: "24px",
        transform: "translateY(-50%)",
        zIndex: 100,
        width: "36px",
        maxWidth: "calc(100vw - 48px)",
        maxHeight: "calc(100vh - 160px)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#101010",
        borderRadius: "18px",
        boxShadow: "0 6px 18px rgba(0,0,0,0.3)",
        padding: "12px 0",
        boxSizing: "border-box",
        cursor: "pointer",
        "& > button:first-child": {
            marginBottom: 4
        },
        transition: [
            "width " + TOC_MS + "ms " + LIGHTBOX_EASING,
            "border-radius " + TOC_MS + "ms " + LIGHTBOX_EASING,
            "padding " + TOC_MS + "ms " + LIGHTBOX_EASING,
            "box-shadow " + TOC_MS + "ms " + LIGHTBOX_EASING,
        ].join(", "),
        scrollbarWidth: "thin",
        scrollbarColor: "#555 transparent",
        "&::-webkit-scrollbar": { width: "6px" },
        "&::-webkit-scrollbar-thumb": { backgroundColor: "#555", borderRadius: "3px" },
        "&::-webkit-scrollbar-track": { backgroundColor: "transparent" },
        // Mobile: dock the capsule at the far right edge and slim it so it
        // lives entirely inside the article's 24px right gutter — the
        // justified body text never runs underneath it. (tocPanelOpen is
        // emitted later in the sheet, so the grown 300px width still wins.)
        [theme.breakpoints.down("sm")]: {
            right: "env(safe-area-inset-right, 0px)",
            width: "22px",
        },
    },
    tocPanelOpen: {
        width: "300px",
        borderRadius: "32px",
        padding: "14px 0",
        boxShadow: "0 24px 64px rgba(0,0,0,0.55)",
        overflowY: "auto",
        cursor: "default",
    },
    tocMarkerSlot: {
        flexShrink: 0,
        width: "14px",
        marginRight: "0px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "margin-right " + TOC_MS + "ms " + LIGHTBOX_EASING,
        "$tocPanelOpen &": { marginRight: "8px" },
    },
    tocBar: {
        width: "14px",
        height: "3px",
        borderRadius: "2px",
        backgroundColor: "#8a8a8a",
        transition: "background-color 150ms ease",
    },
    tocDot: {
        width: "5px",
        height: "5px",
        borderRadius: "50%",
        backgroundColor: "#8a8a8a",
        transition: "background-color 150ms ease",
    },
    // The main title's collapsed marker: a circle, clearly bigger than the
    // sub-title dots, sitting at the top of the capsule.
    tocCircle: {
        width: "10px",
        height: "10px",
        borderRadius: "50%",
        backgroundColor: "#8a8a8a",
        transition: "background-color 150ms ease",
    },
    tocItem: {
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
        width: "100%",
        height: "11px",
        border: "none",
        background: "transparent",
        textAlign: "left",
        fontFamily: '"Industry Book", "Normative Pro"',
        fontSize: "14px",
        color: "#b5b5b5",
        padding: "0 0 0 11px",
        cursor: "pointer",
        userSelect: "none",
        overflow: "hidden",
        boxSizing: "border-box",
        transition: [
            "height " + TOC_MS + "ms " + LIGHTBOX_EASING,
            "padding-left " + TOC_MS + "ms " + LIGHTBOX_EASING,
            "color 150ms ease",
        ].join(", "),
        // Collapsed rows re-center the 14px marker slot inside the 22px
        // mobile capsule; "$tocPanelOpen &" below carries two class names,
        // so the open indent still overrides this media rule.
        [theme.breakpoints.down("sm")]: {
            padding: "0 0 0 4px",
        },
        "&:focus": { outline: "none" },
        "$tocPanelOpen &": {
            height: "30px",
            paddingLeft: "var(--toc-indent)",
        },
        "$tocPanelOpen &:hover": {
            color: "#ffffff",
        },
    },
    tocItemActive: {
        color: "#ffffff",
        "& $tocBar, & $tocDot, & $tocCircle": { backgroundColor: "#ffffff" },
    },
    tocLabel: {
        flex: 1,
        minWidth: 0,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        paddingRight: "16px",
        opacity: 0,
        transition: "opacity 120ms ease",
        "$tocPanelOpen &": {
            opacity: 1,
            transition: "opacity 180ms ease 90ms",
        },
    },
    // The open panel sets the document title apart from the section rows.
    tocLabelTitle: {
        fontSize: "15px",
    },
    /* ── Image lightbox (hero zoom of article images) ────────────────────── */
    lightboxOverlay: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 150,
        cursor: "zoom-out",
        touchAction: "none",
        userSelect: "none",
    },
    lightboxBackdrop: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.82)",
        backdropFilter: "blur(12px)",
        opacity: 0,
        transitionProperty: "opacity",
        transitionTimingFunction: LIGHTBOX_EASING,
        transitionDuration: `${LIGHTBOX_MS}ms`,
        willChange: "opacity",
    },
    lightboxImage: {
        position: "absolute",
        display: "block",
        transformOrigin: "0 0",
        willChange: "transform",
        boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
        objectFit: "fill",
    },
    // ── Deleted / unavailable / loading post ─────────────────────────────
    // Replaces the cover + article + comments entirely. Strictly greyscale,
    // same 42px rounded surface language as the rest of the dialog.
    unavailableWrap: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        boxSizing: "border-box",
    },
    unavailableCard: {
        width: "100%",
        maxWidth: 420,
        backgroundColor: "#101010",
        borderRadius: "42px",
        padding: "48px 32px",
        textAlign: "center",
        boxSizing: "border-box",
        [theme.breakpoints.down("sm")]: {
            borderRadius: "32px",
            padding: "40px 24px",
        },
    },
    unavailableIcon: {
        fontSize: 64,
        color: "#555",
    },
    unavailableTitle: {
        marginTop: 12,
        fontSize: "1.35rem",
        fontWeight: "bold",
        lineHeight: 1.25,
        color: "#fff",
        fontFamily: '"Industry Book", "Normative Pro"',
    },
    unavailableAuthorRow: {
        display: "inline-flex",
        alignItems: "center",
        marginTop: 20,
        padding: "6px 16px 6px 6px",
        borderRadius: "999px",
        backgroundColor: "#1a1a1a",
        cursor: "pointer",
        transition: "background-color 150ms ease",
        "&:hover": { backgroundColor: "#242424" },
    },
    unavailableAvatar: {
        width: 28,
        height: 28,
        borderRadius: "10px",
        marginRight: 10,
    },
    unavailableAuthorName: {
        fontSize: 14,
        color: "#ddd",
    },
    unavailableText: {
        marginTop: 20,
        fontSize: 14,
        lineHeight: 1.55,
        color: "#8a8a8a",
    },
    unavailableButton: {
        marginTop: 28,
        borderRadius: "999px",
        padding: "8px 28px",
        color: "#101010",
        backgroundColor: "#ffffff",
        textTransform: "none",
        fontSize: 14,
        "&:hover": { backgroundColor: "#e0e0e0" },
    },
    tooltipRoot: {
        maxWidth: "min(67vw, 325px)",
        backgroundColor: "#ddd !important",
        borderRadius: "32px",
        color: "#101010 !important",
    },
    cardActionsWrapper: {
        borderRadius: "0px",
        backgroundColor: "#0c0c0c",
        position: "relative",
        width: "100%",
        zIndex: 1,
    },
    commentsList: {
        "& > div": {
            marginBottom: "16px",
        }
    },
    /* ── Reply chain styles (ported from PostDialog) ── */
    repliesGroup: {
        marginTop: 4,
        display: "flex",
        float: "right",
        flexFlow: "row-reverse",
        gap: 2,
        "& .MuiAvatar-root": {
            cursor: "pointer",
            borderRadius: "14px"
        },
        "& .MuiAvatar-root::after": {
            background: "#00000080 url(\"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iMjRweCIgdmlld0JveD0iMCAtOTYwIDk2MCA5NjAiIHdpZHRoPSIyNHB4IiBmaWxsPSIjOTk5OTk5Ij48cGF0aCBkPSJtMjU2LTIwMC01Ni01NiAyMjQtMjI0LTIyNC0yMjQgNTYtNTYgMjI0IDIyNCAyMjQtMjI0IDU2IDU2LTIyNCAyMjQgMjI0IDIyNC01NiA1Ni0yMjQtMjI0LTIyNCAyMjRaIi8+PC9zdmc+\")",
            content: "''",
            position: "absolute",
            width: "100%",
            height: "100%",
            top: 0,
            left: 0,
            backdropFilter: "brightness(0.5)",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            filter: "opacity(0)",
            transition: "filter 225ms cubic-bezier(0.4, 0, 0.2, 1) 35ms",
        },
        "& .MuiAvatar-root:hover::after": {
            filter: "opacity(1)",
            transition: "filter 175ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        }
    },
});

const DATE_TOOLTIP_FORMAT = {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric'
};
const LAZY_IMG_PROPS = { decoding: 'async', loading: 'lazy' };
const SORT_LABELS = ["Hype", "Votes", "New"];

// Memoized Tag Chip Component
const TagChip = memo(({ tag, index, onClick }) => (
    <Chip
        key={"#".concat(tag.concat(index.toString(10)))}
        label={"#".concat(tag.toLowerCase())}
        onClick={() => onClick(tag.toLowerCase())}
    />
), (prev, next) => prev.tag === next.tag);

// Live relative date bridge — BlogPostDialog is a class component, so
// useLiveTimeAgo (age-scaled cadence: every second while under a minute
// old, every minute under an hour, then hourly/daily — same as
// PaperCard) is consumed through this tiny function component. Each
// tick re-renders ONLY this text node, never the class render around
// it. The hook releases its watcher on unmount.
const LIVE_TIME_AGO_OPTIONS = {};
const TIME_AGO_NARROW = { labels: 'narrow' }; // stable ref so the memo'd bridge never re-arms on parent renders
const LiveTimeAgo = memo(function LiveTimeAgo({ date, options = LIVE_TIME_AGO_OPTIONS }) {
    return useLiveTimeAgo(date, options);
});

// Parent Comment (ported from PostDialog)
const ParentComment = memo(({ comment, index, classes, locales, onOpenAuthor }) => (
    <div key={"comment" + index} style={ST_POS_RELATIVE__P_12PX_12PX_12PX__M_32PX_4PX_0PX_4}>
        {index > 0 && <ArrowForwardIosIcon key={"arrow-" + index} style={{
            color: "#575757",
            transform: "translate(-50%, -50%) rotate(90deg)",
            left: "50%",
            top: "-16px",
            position: "absolute"
        }} />}
        <Typography
            component="span"
            variant="body2"
            color="textPrimary"
            style={ST_MB_4__D_BLOCK}
        >
            <Tooltip title={"@" + (comment.author || {}).username}>
                <span className={classes.subheaderName} onClick={() => { onOpenAuthor((comment.author || {}).username) }}>
                    {(comment.author || {}).name}
                </span>
            </Tooltip>
            <span style={ST_C_999}> said </span>
            <Tooltip arrow title={new Date(comment.date || Date.now()).toLocaleDateString(locales, DATE_TOOLTIP_FORMAT)}>
                <span><LiveTimeAgo date={comment.date || Date.now()} /></span>
            </Tooltip>
        </Typography>
        <Typography
            component="div"
            variant="body1"
            color="textSecondary"
            style={ST_LH_1REM__LS_0}
            dangerouslySetInnerHTML={{ __html: safeHTML(renderCommentBody(comment.body)) }}
        />
    </div>
));

// Comment Input Component (with reply + edit target support)
const CommentInput = memo(({
                               classes,
                               authorImage,
                               onSubmit,
                               onKeyDown,
                               placeholder,
                               sending,
                               replyTarget,
                               editTarget,
                               onClearReply,
                               onCancelEdit,
                               account,
                           }) => {
    useLanguage();
    const loggedOut = !account;
    return (
        <div className={classes.commentInputBar}>
            {editTarget ? (
                <div className={classes.commentInputBarReply}>
                    <Typography variant="caption" style={ST_C_888}>
                        <EditRounded style={ST_FS_13__VA_TEXT_BOTTOM__MR_4} />
                        {t(
                            "words.editing_your_comment_saving_broadcasts_the_cha"
                        )}
                    </Typography>
                    <IconButton size="small" style={ST_P_2__ML_4} onClick={onCancelEdit}>
                        <CloseIcon style={ST_FS_14__C_666} />
                    </IconButton>
                </div>
            ) : replyTarget && (
                <div className={classes.commentInputBarReply}>
                    <Typography variant="caption" style={ST_C_888}><T
                        k="words.replying_to_0_username_0"
                        vars={{
                            username: replyTarget.username || (replyTarget.author || {}).username
                        }}
                        slots={[<span style={ST_C_BBB} key="0" />]} /></Typography>
                    <IconButton size="small" style={ST_P_2__ML_4} onClick={onClearReply}>
                        <CloseIcon style={ST_FS_14__C_666} />
                    </IconButton>
                </div>
            )}
            <Grid container spacing={1} alignItems="center">
                <Grid item>
                    <Avatar
                        className={classes.commentAvatar}
                        src={authorImage}
                        imgProps={{ decoding: 'async', loading: 'lazy' }}
                    />
                </Grid>
                <Grid item xs>
                    {loggedOut ? (
                        <Tooltip title={t("words.log_in_or_create_an_account_to")} arrow>
                            <div>
                                <TextField
                                    fullWidth
                                    className={classes.commentTextField}
                                    id="blog-comment-textfield"
                                    name="blog-comment-textfield"
                                    label={placeholder}
                                    disabled={true}
                                />
                            </div>
                        </Tooltip>
                    ) : (
                        <TextField
                            fullWidth
                            className={classes.commentTextField}
                            id="blog-comment-textfield"
                            name="blog-comment-textfield"
                            label={placeholder}
                            disabled={sending}
                            onKeyDown={onKeyDown}
                        />
                    )}
                </Grid>
                <Grid item>
                    {loggedOut ? (
                        <Tooltip title={t("words.log_in_or_create_an_account_to")} arrow>
                            <span>
                                <IconButton className={classes.commentSendButton} disabled={true}>
                                    <SendRounded />
                                </IconButton>
                            </span>
                        </Tooltip>
                    ) : (
                        <Tooltip title={editTarget ? "Save the edit" : "Send"} arrow>
                            <span>
                                <IconButton className={classes.commentSendButton} onClick={onSubmit} disabled={sending}>
                                    {sending ? <CircularProgress size={24} style={ST_C_888} /> : editTarget ? <EditRounded /> : <SendRounded />}
                                </IconButton>
                            </span>
                        </Tooltip>
                    )}
                </Grid>
            </Grid>
            <ToxicityWatcher targetId="blog-comment-textfield" label="comment" style={ST_PL_48} />
        </div>
    );
}, (a, b) => a.sending === b.sending && a.authorImage === b.authorImage
    && a.replyTarget === b.replyTarget && a.editTarget === b.editTarget
    && a.account === b.account
    && a.placeholder === b.placeholder);


// Shared mapper: build author profiles for a batch of raw chain replies and map
// them into the flat comment shape the dialog renders. Returns the profileMap
// too so the caller can opportunistically cache its own profile. Used by both
// _fetch_replies_for (loading a thread level) and _load_replies_for (the lazy
// loader CommentInList calls to show a comment's inline replies).
function buildReplyComments(rawReplies, accounts, localAuthors, parentAuthor, parentPermlink) {
    const profileMap = {};
    if (Array.isArray(accounts)) {
        for (const acc of accounts) {
            const u = acc.name || acc.account || ""; if (!u) continue;
            let img = "", name = u;
            try {
                const m = typeof acc.posting_json_metadata === "string" ? JSON.parse(acc.posting_json_metadata) : (acc.posting_json_metadata || {});
                const p = m.profile || {};
                img = p.profile_image || p.image || "";
                name = p.name || u;
            } catch(e) {
                try {
                    const m2 = typeof acc.json_metadata === "string" ? JSON.parse(acc.json_metadata) : (acc.json_metadata || {});
                    const p2 = m2.profile || {};
                    img = p2.profile_image || p2.image || "";
                    name = p2.name || u;
                } catch(e2) {}
            }
            if (!img && acc._profile) {
                img = acc._profile.profile_image || "";
                if (!name || name === u) name = acc._profile.display_name || u;
            }
            profileMap[u] = { username: u, name, image: img };
        }
    }
    const locals = localAuthors || {};
    const comments = (rawReplies || []).map((r) => {
        const u = r.author || "";
        let body = r.body || "";
        try { body = rawSanitizeComment(body).html || body; } catch(e) {}
        return {
            username: u, body, date: r.created || Date.now(),
            upVotesNumber: (r.active_votes || []).filter(v => v.weight >= 0).length,
            downVotesNumber: (r.active_votes || []).filter(v => v.weight < 0).length,
            permlink: r.permlink || "", children: r.children || 0,
            active_votes: r.active_votes || [],
            parent_author: r.parent_author || parentAuthor,
            parent_permlink: r.parent_permlink || parentPermlink,
            author: profileMap[u] || locals[u] || { username: u, name: u, image: "" },
        };
    });
    return { comments, profileMap };
}


class BlogPostDialog extends React.PureComponent {
    constructor(props) {
        super(props);
        this.st4te = {
            classes: props.classes,
            open: props.open || false,
            data: props.data || {},
            locales: props.locales,
            api: props.api || null,
            account: props.account || null,
            onVoteChange: props.onVoteChange || null,
            _scrollTop: 0,
            _copied: false,
            _history: HISTORY,
            // ── Comment system state (ported from PostDialog) ──
            _comments: [],
            _current_comments: [],   // reply chain breadcrumb
            _comments_loading: false,
            _comment_sending: false,
            _reply_target: null,
            _edit_target: null,       // { comment, rawBody } — comment edited via the input bar
            _delete_target: null,     // comment pending the delete confirmation
            _owner_menu_anchor: null, // post owner ⋮ menu anchor
            _edit_post_open: false,   // EditPostDialog (metadata)
            _editor_open: false,      // TextEditorDialog (full content edit)
            _editor_mounted: false,   // keep the lazy chunk mounted once requested
            _delete_post_open: false, // DeletePostDialog (soft-delete confirm)
            _is_favorite: false,      // post bookmarked in the LacertaDB favorites store
            _show_parent: false,
            _sorting: "Hype",
            // ── Deep-linked comment focus ("#replies&focus=<b64>") ──
            // Same scheme as PostDialog: the pinned comment (author/permlink
            // parsed from the URL hash) and its ancestor-chain keys, which
            // CommentInList uses to hold the hover state and brighten the
            // tree path down to it.
            _focusComment: null,
            _focusPathKeys: [],
            _authors: {},
            _accounts: {},
            // ── Vote state ──
            _voted: 0,
            _initialVoted: 0,
            _upvoteLoading: false,
            _downvoteLoading: false,
            _titleHeight: 0,
            // Mobile full-bleed header (top: 0, square corners, expanded
            // height reaching the card) — mirrored into state so a resize
            // across the 960px line re-renders the JS geometry, not just the
            // JSS media queries.
            _isMobileHeader: headerTopOffset() === 0,
            // ── Table of contents ──
            _toc_open: false,
            _toc_active: "",          // heading id currently in view
            // ── Image lightbox (hero zoom) ──
            _lightbox: null,          // { src, alt, rendering } while an image is zoomed
        };
        this._votingRef = false;
        this._favUnsub = null;    // favorites store subscription (live heart sync)
        this._contentWrapperRef = null;
        this._commentRefreshTimer = null;
        this._commentsColumnRef = null;   // "#replies" scroll target (comments column)
        this._focusSeekTimer = null;      // short-lived polls: portal mount + async thread
        this._focusToken = 0;             // invalidates stale seeks / path walks
        this.scrollContainerRef = React.createRef();
        this.titleRef = React.createRef();
        this._ticking = false;
        // ── TOC / article processing caches ──
        this._articleCache = null;    // { raw, html, headings } — one parse per body
        this._headingEls = null;      // { token, root, els } — resolved heading nodes
        this._articleRef = null;      // rendered blogContent element
        this._tocPanelRef = null;
        this._toc_pinned = false;     // click pins the panel open; hover only previews
        this._toc_hover = false;
        this._toc_open_at_press = false;  // panel state when the last press began
        this._canHover = false;       // set in componentDidMount (matchMedia)
        // ── Lightbox bookkeeping (imperative FLIP animation state) ──
        this._lb = null;              // geometry + source element while open
        this._lightboxImg = null;
        this._lightboxBackdrop = null;
    }

    // Callback ref for the scroll container. The container is rendered inside
    // a MUI <Portal>, whose children only land in document.body a tick AFTER
    // the first render — so on a first opening (mount with open=true)
    // scrollContainerRef.current was still null in componentDidMount and the
    // scroll listener was never attached: the header didn't shrink until the
    // dialog was closed and reopened (second open goes through
    // componentWillReceiveProps, by which time the portal content exists).
    // Owning the listener here makes it timing-proof: it exists exactly as
    // long as the DOM node does, no matter when the portal mounts it.
    setScrollContainerRef = (node) => {
        const prev = this.scrollContainerRef.current;
        if (prev === node) return;
        if (prev) {
            prev.removeEventListener('scroll', this.handleScroll);
        }
        this.scrollContainerRef.current = node;
        if (node) {
            node.addEventListener('scroll', this.handleScroll, { passive: true });
        }
    }

    componentDidMount() {
        // Scroll listener is owned by setScrollContainerRef — nothing to attach here.
        this._measureTitleHeight();
        window.addEventListener("resize", this._measureTitleHeight);
        window.addEventListener("resize", this._syncMobileHeader);
        // Touch fires a synthetic mouseenter before click — only trust hover
        // events on devices that actually have a hover-capable pointer.
        this._canHover = !!(window.matchMedia && window.matchMedia("(hover: hover)").matches);
        // A viewport change invalidates the zoomed image's geometry — send it home.
        window.addEventListener("resize", this._close_lightbox_on_resize);
        this._cacheOwnProfile();
        this._check_favorite();
        // Live heart sync — e.g. a removal made in the FavoriteManagerDialog
        // opened above this dialog un-fills the icon immediately.
        this._favUnsub = favorites.subscribe(this._check_favorite);
        // A first opening can be a MOUNT with open=true (see
        // setScrollContainerRef) — componentWillReceiveProps never fires for
        // it, so URL-hash intents ("#replies", "&focus=<b64>") are adopted
        // here as well; the seeks poll, which tolerates the portal's late
        // mount and the thread's async arrival.
        if (this.st4te.open) this._adopt_url_hash();
    }

    componentWillUnmount() {
        // The callback ref fires with null on unmount and detaches the scroll
        // listener; this explicit removal is a harmless belt-and-braces no-op.
        if (this.scrollContainerRef.current) {
            this.scrollContainerRef.current.removeEventListener('scroll', this.handleScroll);
        }
        window.removeEventListener("resize", this._measureTitleHeight);
        window.removeEventListener("resize", this._syncMobileHeader);
        window.removeEventListener("resize", this._close_lightbox_on_resize);
        this._teardown_lightbox();
        if (this._favUnsub) { this._favUnsub(); this._favUnsub = null; }
        if (this._commentRefreshTimer) {
            clearInterval(this._commentRefreshTimer);
            this._commentRefreshTimer = null;
        }
        this._cancel_focus_seek();
    }

    componentDidUpdate() {
        this._measureTitleHeight();
    }

    _cacheOwnProfile = () => {
        const api = this.st4te.api, account = this.st4te.account;
        if (!api || !account) return;
        // Only skip if we already have a cached entry WITH an image
        const existing = (this.st4te._accounts || {})[account] || (this.st4te._authors || {})[account];
        if (existing && existing.image) return;
        if (!api.accounts || !api.accounts.getAccounts) return;
        api.accounts.getAccounts([account]).then((accs) => {
            if (!accs || !accs.length) return;
            const acc = accs[0]; const u = acc.name || acc.account || account;
            let img = "", name = u;
            try {
                const m = typeof acc.posting_json_metadata === "string" ? JSON.parse(acc.posting_json_metadata) : (acc.posting_json_metadata || {});
                const p = m.profile || {};
                img = p.profile_image || p.image || "";
                name = p.name || u;
            } catch(e) {
                try {
                    const m2 = typeof acc.json_metadata === "string" ? JSON.parse(acc.json_metadata) : (acc.json_metadata || {});
                    const p2 = m2.profile || {};
                    img = p2.profile_image || p2.image || "";
                    name = p2.name || u;
                } catch(e2) {}
            }
            const cached = { ...this.st4te._accounts };
            cached[u] = { username: u, name, image: img };
            this.setSt4te({ _accounts: cached });
        }).catch(() => {});
    }

    // The JSS breakpoints (top: 0, square corners) flip on their own, but
    // headerHeight / contentTopPadding are computed in render() — keep them
    // in step when the viewport crosses the 960px line.
    _syncMobileHeader = () => {
        const mobile = headerTopOffset() === 0;
        if (mobile !== this.st4te._isMobileHeader) this.setSt4te({ _isMobileHeader: mobile });
    }

    _measureTitleHeight = () => {
        if (this.titleRef.current) {
            const rect = this.titleRef.current.getBoundingClientRect();
            const newHeight = rect.height;
            if (newHeight !== this.st4te._titleHeight && newHeight > 0) {
                this.setSt4te({ _titleHeight: newHeight });
            }
        }
    }

    componentWillReceiveProps = (new_props) => {
        const openChanged = new_props.open !== this.st4te.open;
        const dataChanged = (new_props.data || {}).id !== (this.st4te.data || {}).id;

        const data = new_props.data || {};
        const account = new_props.account || this.st4te.account;
        let initialVoted = 0;
        if (account && data.active_votes) {
            const myVote = data.active_votes.find(v => v && v.voter === account);
            if (myVote) initialVoted = myVote.weight < 0 ? -1 : 1;
        }

        this.setSt4te({
            ...new_props,
            api: new_props.api || this.st4te.api,
            account: account,
            onVoteChange: new_props.onVoteChange || this.st4te.onVoteChange,
            _initialVoted: initialVoted,
        }, () => {
            if (openChanged && new_props.open) {
                this.setSt4te({
                    _voted: initialVoted,
                    _comments: [],
                    _current_comments: [],
                    _reply_target: null,
                    _edit_target: null,
                    _delete_target: null,
                    _owner_menu_anchor: null,
                    _edit_post_open: false,
                    _editor_open: false,
                    _delete_post_open: false,
                    _show_parent: false,
                    _sorting: "Hype",
                    _is_favorite: false,
                    _toc_open: false,
                    _toc_active: "",
                    _focusComment: null,
                    _focusPathKeys: [],
                });
                this._toc_pinned = false;
                this._toc_hover = false;

                // Listener attachment is handled by setScrollContainerRef; here we
                // only reset the scroll position. _scrollTop must reset regardless
                // of whether the portal node exists yet, so the header always
                // starts expanded on open.
                if (this.scrollContainerRef.current) {
                    this.scrollContainerRef.current.scrollTop = 0;
                }
                this.setSt4te({ _scrollTop: 0 });
                requestAnimationFrame(() => this._measureTitleHeight());
                this._fetch_comments(data);
                this._cacheOwnProfile();
                this._check_favorite();
                // Deep-link intents ride the URL hash exactly as they do into
                // PostDialog ("#replies", "#replies&focus=<b64>").
                this._adopt_url_hash();
            } else if (openChanged && !new_props.open) {
                // The scroll listener stays attached (passive, and a hidden
                // backdrop can't scroll) — it's removed only when the node
                // leaves the DOM, via setScrollContainerRef. The timer cleanup
                // no longer depends on the ref existing.
                this._teardown_lightbox();
                this._toc_pinned = false;
                this._toc_hover = false;
                if (this._commentRefreshTimer) {
                    clearInterval(this._commentRefreshTimer);
                    this._commentRefreshTimer = null;
                }
                this._cancel_focus_seek();
                this._focusToken++;   // orphan any in-flight focus path walk
            }

            if (dataChanged && new_props.open) {
                this.setSt4te({
                    _comments: [],
                    _current_comments: [],
                    _reply_target: null,
                    _edit_target: null,
                    _delete_target: null,
                    _owner_menu_anchor: null,
                    _edit_post_open: false,
                    _editor_open: false,
                    _delete_post_open: false,
                    _show_parent: false,
                    _is_favorite: false,
                    _toc_open: false,
                    _toc_active: "",
                    _focusComment: null,
                    _focusPathKeys: [],
                });
                this._teardown_lightbox();   // the source <img> is about to be replaced
                this._toc_pinned = false;
                this._toc_hover = false;
                this._fetch_comments(data);
                this._check_favorite();
                // The new post's URL carries its own (or no) hash intents; the
                // previous post's focus never survives the switch.
                this._adopt_url_hash();
            }
        });
    }

    handleScroll = () => {
        if (!this._ticking) {
            requestAnimationFrame(() => {
                const scrollTop = this.scrollContainerRef.current?.scrollTop || 0;
                // Zoomed image: scroll travel past the threshold sends it back
                // to its place (the overlay forwards wheel/touch to the container).
                if (this._lb && !this._lb.closing &&
                    Math.abs(scrollTop - this._lb.startScrollTop) > LIGHTBOX_SCROLL_DISMISS_PX) {
                    this._close_lightbox();
                }
                this._update_toc_active();   // collapsed minimap shows the active marker too
                this.setSt4te({ _scrollTop: scrollTop });
                this._ticking = false;
            });
            this._ticking = true;
        }
    }

    setSt4te(st4te, callback) {
        let keys = Object.keys(st4te);
        let keys_length = keys.length | 0;
        let key = "";
        for (let i = 0; (i | 0) < (keys_length | 0); i = (i + 1 | 0) >>> 0) {
            key = keys[i].toString();
            this.st4te[key] = st4te[key];
        }
        if (typeof callback === "function") {
            callback();
        }
        this.forceUpdate();
    }

    // ── Favorites (LacertaDB-backed bookmark toggle) ──────────────────────
    // Backed by utils/favorites.js — the 'favorites' collection on the app's
    // settingsDb. Entries carry whatever this dialog already has in hand;
    // missing category / url / real community title are back-filled from the
    // chain by the store so the FavoriteManagerDialog can group this post
    // under its community's real name (never raw portal-NNNNN).

    _check_favorite = () => {
        const { api, data } = this.st4te;
        const author = (data.author || {}).username;
        const permlink = data.permlink;
        if (!api || !author || !permlink) return;
        // The heart isn't rendered in the unavailable states — don't hit the
        // store for a stub that may never hydrate.
        if (getPostState(data) !== POST_STATE.READY) return;
        favorites.isFavorite(api, favorites.FAVORITE_TYPES.BLOGS, author, permlink).then((value) => {
            // Guard against a post swap while the lookup was in flight
            if ((this.st4te.data || {}).permlink !== permlink) return;
            if (this.st4te._is_favorite !== value) this.setSt4te({ _is_favorite: value });
        }).catch(() => {});
    };

    _toggle_favorite = () => {
        const { api, data, _is_favorite } = this.st4te;
        const author = (data.author || {}).username;
        const permlink = data.permlink;
        if (!api || !author || !permlink) return;
        if (_is_favorite) {
            this.setSt4te({ _is_favorite: false });
            favorites.removeFavorite(api, favorites.FAVORITE_TYPES.BLOGS, author, permlink).then((ok) => {
                if (!ok) this.setSt4te({ _is_favorite: true });
                actions.trigger_snackbar(ok ? t("words.removed_from_favorites") : t("words.could_not_update_favorites"));
            });
        } else {
            this.setSt4te({ _is_favorite: true });
            favorites.addFavorite(api, favorites.FAVORITE_TYPES.BLOGS, {
                author,
                author_name: (data.author || {}).name || author,
                author_image: (data.author || {}).image || "",
                permlink,
                title: data.title || "",
                image: data.image || null,          // cover only — null on black-cover posts
                description: data.description || data._summary || "",
                tags: data.tags || data._tags || [],
                category: data.category || data.community || null,
                url: data.url || null,
                created: data.date || data.created || Date.now(),
            }).then((ok) => {
                if (!ok) this.setSt4te({ _is_favorite: false });
                actions.trigger_snackbar(ok ? t("words.added_to_favorites") : t("words.could_not_update_favorites"));
            });
        }
    };

    _copy_link = () => {
        clipboard.writeText(window.location.href);
        this.setSt4te({ _copied: true });
        actions.trigger_snackbar(t("words.link_copied_to_clipboard"));
        setTimeout(() => { this.setSt4te({ _copied: false }); }, 3000);
    }

    _open_author = (username) => {
        // Refuse to navigate when username is missing or empty — same
        // rationale as PostDialog.openAuthor: pushing the broken `/@` URL
        // strands the user on a route that no PAGE_ROUTES regex matches.
        if (!username) return;
        this.st4te._history.push("/@" + username);
    }

    _open_tag = (tag) => {
        this.st4te._history.push("/trending/" + tag.toLowerCase());
        if (this.props.onClose) this.props.onClose();
    }

    _handle_backdrop_click = (e) => {
        // An open TOC panel captures the first click anywhere in the article
        // area: it only dismisses the panel, never the dialog underneath.
        if (this.st4te._toc_open) {
            this._toc_pinned = false;
            this._toc_hover = false;
            this._set_toc_open(false);
            return;
        }
        // A drag-selection that ends past the card fires a click whose target
        // is the wrapper — never treat that as a backdrop click, or selecting
        // text to copy it would close the dialog on mouseup.
        const sel = window.getSelection ? window.getSelection() : null;
        if (sel && !sel.isCollapsed && sel.toString().length > 0) return;
        // The cover sits UNDER the scroll surface (headerWrapper is
        // pointer-events: none), so a click on the cover image actually lands
        // on the transparent wrapper and looks like a backdrop click. Compare
        // the click point against the live cover rect — it tracks the
        // scroll-shrunken height — and swallow those clicks: visually the
        // user clicked the cover, not the backdrop.
        const cover = this._coverRef;
        if (cover && cover.isConnected) {
            const r = cover.getBoundingClientRect();
            if (e.clientX >= r.left && e.clientX <= r.right &&
                e.clientY >= r.top && e.clientY <= r.bottom) {
                return;
            }
        }
        if (e.target === e.currentTarget || e.target === this._contentWrapperRef) {
            if (this.props.onClose) this.props.onClose();
        }
    }

    /* ================================================================
     * TABLE OF CONTENTS (Medium-style floating panel)
     * ================================================================ */

    // One parse per body: safeHTML + heading-id injection + TOC extraction are
    // memoized on the raw string, so the scroll-driven re-renders of this
    // dialog stop re-sanitizing the whole article on every frame.
    _get_article = () => {
        const data = this.st4te.data || {};
        const raw = data.content || data.body || data._description_html || '';
        if (this._articleCache && this._articleCache.raw === raw) return this._articleCache;
        const processed = processArticleHtml(renderPostBody(raw));
        this._articleCache = { raw, html: processed.html, headings: processed.headings };
        this._headingEls = null;
        return this._articleCache;
    }

    _set_article_ref = (el) => {
        this._articleRef = el;
        // Seed the active marker so the collapsed minimap is correct before
        // the first scroll event ever fires.
        if (el) requestAnimationFrame(() => this._update_toc_active());
    }
    _set_toc_panel_ref = (el) => { this._tocPanelRef = el; }

    // open = hovered || pinned. Hovering previews the panel, a click pins it
    // open (and is the only way in on touch, where hover doesn't exist).
    _set_toc_open = (open) => {
        if (!open && this._tocPanelRef) this._tocPanelRef.scrollTop = 0;
        if (open !== this.st4te._toc_open) this.setSt4te({ _toc_open: open });
    }

    _on_toc_mouse_enter = () => {
        if (!this._canHover) return;
        this._toc_hover = true;
        this._set_toc_open(true);
    }

    _on_toc_mouse_leave = () => {
        if (!this._canHover) return;
        this._toc_hover = false;
        if (!this._toc_pinned) this._set_toc_open(false);
    }

    _on_toc_click = () => {
        this._toc_pinned = !this._toc_pinned;
        this._set_toc_open(this._toc_pinned || this._toc_hover);
    }

    // Recorded at pointer/touch press, BEFORE any synthetic mouseenter a tap
    // fires on hover-capable hardware — so at click time we know whether the
    // press started on a collapsed capsule or an open panel.
    _on_toc_press = () => {
        this._toc_open_at_press = this.st4te._toc_open;
    }

    _on_toc_item_click = (e, id) => {
        e.stopPropagation();
        // A tap landing on the collapsed capsule opens the panel — it must
        // never jump the article to whichever marker sat under the finger
        // (touch has no hover, so this tap is the only way in). e.detail
        // === 0 is keyboard activation, only reachable while open.
        if (!this._toc_open_at_press && e.detail !== 0) {
            this._toc_pinned = true;
            this._set_toc_open(true);
            return;
        }
        this._scroll_to_heading(id);
    }

    _get_heading_els = () => {
        const cache = this._articleCache;
        const root = this._articleRef;
        if (!cache || !root) return [];
        const memo = this._headingEls;
        if (memo && memo.token === cache && memo.root === root) return memo.els;
        const els = Array.prototype.slice.call(root.querySelectorAll('[id^="' + HEADING_ID_PREFIX + '"]'));
        this._headingEls = { token: cache, root, els };
        return els;
    }

    // The heading whose top last crossed the collapsed header's lower edge is
    // the active one — the rule Medium applies. Scoped to this instance's
    // article node, so a second (hidden) BlogPostDialog can't interfere.
    _update_toc_active = () => {
        const els = this._get_heading_els();
        if (!els.length) return;
        const minHeader = this.st4te._titleHeight > 0 ? this.st4te._titleHeight + 48 : 72;
        const line = headerTopOffset() + minHeader + 48;
        // Above the first body heading we're in the main title's territory
        // (scrollTop = 0 lands here). Posts without a title keep the old
        // default — the first heading — since no title row is rendered.
        const hasTitleEntry = !!((this.st4te.data || {}).title || "").trim();
        let active = hasTitleEntry ? TOC_TITLE_ID : els[0].id;
        for (let i = 0; i < els.length; i++) {
            if (els[i].getBoundingClientRect().top <= line) active = els[i].id;
            else break;
        }
        if (active !== this.st4te._toc_active) {
            this.setSt4te({ _toc_active: active });
            // Keep the active row visible inside the expanded panel.
            if (this.st4te._toc_open) {
                try {
                    const row = this._tocPanelRef && this._tocPanelRef.querySelector('[data-hid="' + active + '"]');
                    if (row && row.scrollIntoView) row.scrollIntoView({ block: "nearest" });
                } catch (e) {}
            }
        }
    }

    _scroll_to_heading = (id) => {
        const container = this.scrollContainerRef.current;
        if (!container) return;
        let top = 0;                       // the main title lives at scrollTop = 0
        if (id !== TOC_TITLE_ID) {
            const root = this._articleRef;
            if (!root) return;
            const el = root.querySelector('#' + id);   // ids are [a-z0-9-] — selector-safe
            if (!el) return;
            const minHeader = this.st4te._titleHeight > 0 ? this.st4te._titleHeight + 48 : 72;
            top = container.scrollTop
                + el.getBoundingClientRect().top
                - container.getBoundingClientRect().top
                - (headerTopOffset() + minHeader + 32);
        }
        try { container.scrollTo({ top: Math.max(0, top), behavior: "smooth" }); }
        catch (e) { container.scrollTop = Math.max(0, top); }
        this.setSt4te({ _toc_active: id });
        // On phones the expanded panel covers the article — collapse on pick.
        if (typeof window !== "undefined" && window.innerWidth < 960) {
            this._toc_pinned = false;
            this._set_toc_open(false);
        }
    }

    /* ================================================================
     * IMAGE LIGHTBOX (hero zoom on article images)
     * ================================================================ */

    // Delegated click on the rendered article: body images are plain sanitized
    // <img> tags, so they carry no React handlers of their own.
    _on_article_click = (e) => {
        const target = e.target;
        if (!target || target.tagName !== "IMG") return;
        if (this._lb) return;
        if (target.closest && target.closest("a")) return;   // linked images navigate
        const rect = target.getBoundingClientRect();
        if (rect.width < LIGHTBOX_MIN_SOURCE_PX || rect.height < LIGHTBOX_MIN_SOURCE_PX) return;
        this._open_lightbox(target, rect);
    }

    _open_lightbox = (img, fromRect) => {
        const vw = window.innerWidth, vh = window.innerHeight;
        const natW = img.naturalWidth || fromRect.width;
        const natH = img.naturalHeight || fromRect.height;
        if (!natW || !natH || !vw || !vh) return;

        // Fit the image's natural aspect inside 80% of the viewport.
        const fit = Math.min((vw * LIGHTBOX_VIEWPORT_RATIO) / natW, (vh * LIGHTBOX_VIEWPORT_RATIO) / natH);
        const toW = Math.max(1, Math.round(natW * fit));
        const toH = Math.max(1, Math.round(natH * fit));
        const to = {
            x: Math.round((vw - toW) / 2),
            y: Math.round((vh - toH) / 2),
            w: toW,
            h: toH,
        };

        let srcRadius = "0px";
        let rendering = "auto";
        try {
            const cs = window.getComputedStyle(img);
            srcRadius = cs.borderRadius || "0px";
            rendering = cs.imageRendering || "auto";   // pixel art stays crisp blown up
        } catch (e) {}

        this._lb = {
            source: img,
            from: fromRect,
            to,
            radius: Math.max(12, Math.min(LIGHTBOX_MAX_RADIUS, toW / 5, toH / 5)),
            srcRadius,
            startScrollTop: this.scrollContainerRef.current ? this.scrollContainerRef.current.scrollTop : 0,
            accum: 0,
            lastTouchY: null,
            started: false,
            closing: false,
            reduceMotion: !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches),
        };
        document.addEventListener("keydown", this._on_lightbox_key);
        this.setSt4te({ _lightbox: { src: img.currentSrc || img.src, alt: img.alt || "", rendering } });
    }

    _set_lightbox_backdrop_ref = (node) => { this._lightboxBackdrop = node; }

    // FLIP: the clone mounts at its final centered geometry, is transformed
    // back onto the source rect before first paint (ref callbacks run at
    // commit), then transitions to identity — one compositor-friendly move.
    _set_lightbox_img_ref = (node) => {
        this._lightboxImg = node;
        const lb = this._lb;
        if (!node || !lb || lb.started) return;
        lb.started = true;

        const { from, to } = lb;
        node.style.left = to.x + "px";
        node.style.top = to.y + "px";
        node.style.width = to.w + "px";
        node.style.height = to.h + "px";
        node.style.transform = "translate(" + (from.left - to.x) + "px, " + (from.top - to.y) + "px) " +
            "scale(" + (from.width / to.w) + ", " + (from.height / to.h) + ")";
        node.style.borderRadius = lb.srcRadius;
        // The clone now sits exactly over the original — swap them this frame.
        try { lb.source.style.visibility = "hidden"; } catch (e) {}

        const duration = lb.reduceMotion ? 0 : LIGHTBOX_MS;
        const run = () => {
            if (this._lb !== lb || !node.isConnected) return;
            node.style.transition = duration
                ? "transform " + duration + "ms " + LIGHTBOX_EASING + ", border-radius " + duration + "ms " + LIGHTBOX_EASING
                : "none";
            node.style.transform = "none";
            node.style.borderRadius = lb.radius + "px";
            const bd = this._lightboxBackdrop;
            if (bd) {
                bd.style.transitionDuration = duration + "ms";
                bd.style.opacity = "1";
            }
        };
        if (duration) requestAnimationFrame(() => requestAnimationFrame(run));
        else run();
    }

    _close_lightbox = () => {
        const lb = this._lb;
        const node = this._lightboxImg;
        if (!lb || lb.closing) return;
        lb.closing = true;
        document.removeEventListener("keydown", this._on_lightbox_key);
        if (!node || !node.isConnected) { this._finish_lightbox_close(); return; }

        const duration = lb.reduceMotion ? 0 : LIGHTBOX_MS;
        const bd = this._lightboxBackdrop;
        if (bd) {
            bd.style.transitionDuration = duration + "ms";
            bd.style.opacity = "0";
        }

        // The page may have scrolled while zoomed — fly back to where the
        // source sits NOW (possibly off-screen, which reads naturally).
        let toRect = null;
        try {
            if (lb.source && lb.source.isConnected) toRect = lb.source.getBoundingClientRect();
        } catch (e) {}

        node.style.transition = duration
            ? "transform " + duration + "ms " + LIGHTBOX_EASING +
            ", border-radius " + duration + "ms " + LIGHTBOX_EASING +
            ", opacity " + duration + "ms " + LIGHTBOX_EASING
            : "none";
        if (toRect && toRect.width > 0 && toRect.height > 0) {
            node.style.transform = "translate(" + (toRect.left - lb.to.x) + "px, " + (toRect.top - lb.to.y) + "px) " +
                "scale(" + (toRect.width / lb.to.w) + ", " + (toRect.height / lb.to.h) + ")";
            node.style.borderRadius = lb.srcRadius;
        } else {
            // Source vanished (article re-rendered) — dissolve in place.
            node.style.transformOrigin = "50% 50%";
            node.style.transform = "scale(0.92)";
            node.style.opacity = "0";
        }

        if (duration) {
            const finish = () => this._finish_lightbox_close();
            lb._closeTimer = setTimeout(finish, duration + 80);
            node.addEventListener("transitionend", function onEnd(ev) {
                if (ev.propertyName !== "transform" && ev.propertyName !== "opacity") return;
                node.removeEventListener("transitionend", onEnd);
                finish();
            });
        } else {
            this._finish_lightbox_close();
        }
    }

    _finish_lightbox_close = () => {
        const lb = this._lb;
        if (!lb) return;
        if (lb._closeTimer) clearTimeout(lb._closeTimer);
        try { if (lb.source) lb.source.style.visibility = ""; } catch (e) {}
        this._lb = null;
        this._lightboxImg = null;
        this._lightboxBackdrop = null;
        this.setSt4te({ _lightbox: null });
    }

    // Immediate, animation-free reset — dialog closing, post swap, unmount.
    _teardown_lightbox = () => {
        const lb = this._lb;
        if (!lb) return;
        document.removeEventListener("keydown", this._on_lightbox_key);
        if (lb._closeTimer) clearTimeout(lb._closeTimer);
        try { if (lb.source) lb.source.style.visibility = ""; } catch (e) {}
        this._lb = null;
        this._lightboxImg = null;
        this._lightboxBackdrop = null;
        if (this.st4te._lightbox) this.setSt4te({ _lightbox: null });
    }

    _close_lightbox_on_resize = () => {
        if (this._lb && !this._lb.closing) this._close_lightbox();
    }

    _on_lightbox_key = (e) => {
        if (e.key === "Escape" || e.key === "Esc") {
            e.stopPropagation();
            this._close_lightbox();
        }
    }

    _on_lightbox_click = () => { this._close_lightbox(); }

    // The overlay covers the scroll container, so it forwards wheel/touch to
    // it: the article keeps moving under the dimmer, and the accumulated
    // travel doubles as the dismiss threshold for the case where the
    // container is already at one of its ends and cannot move.
    _on_lightbox_wheel = (e) => {
        const lb = this._lb;
        if (!lb || lb.closing) return;
        if (e.cancelable) e.preventDefault();
        let dy = e.deltaY || 0;
        if (e.deltaMode === 1) dy *= 16;
        else if (e.deltaMode === 2) dy *= window.innerHeight;
        const container = this.scrollContainerRef.current;
        if (container) container.scrollTop += dy;
        lb.accum += Math.abs(dy);
        if (lb.accum > LIGHTBOX_GESTURE_DISMISS_PX) this._close_lightbox();
    }

    _on_lightbox_touch_start = (e) => {
        if (this._lb && e.touches && e.touches.length) {
            this._lb.lastTouchY = e.touches[0].clientY;
        }
    }

    _on_lightbox_touch_move = (e) => {
        const lb = this._lb;
        if (!lb || lb.closing || !e.touches || !e.touches.length) return;
        if (e.cancelable) e.preventDefault();
        const y = e.touches[0].clientY;
        if (lb.lastTouchY == null) { lb.lastTouchY = y; return; }
        const dy = lb.lastTouchY - y;
        lb.lastTouchY = y;
        const container = this.scrollContainerRef.current;
        if (container) container.scrollTop += dy;
        lb.accum += Math.abs(dy);
        if (lb.accum > LIGHTBOX_GESTURE_DISMISS_PX) this._close_lightbox();
    }

    /* ================================================================
     * COMMENTS API (ported from PostDialog)
     * ================================================================ */

    _fetch_replies_for = (author, permlink, silent) => {
        const api = this.st4te.api;
        if (!api || !api.content) return;
        if (!silent) this.setSt4te({ _comments_loading: true });

        api.content.getContentReplies(author, permlink)
            .then((replies) => {
                if (!replies || !Array.isArray(replies) || replies.length === 0) {
                    const surviving = (this.st4te._comments || [])
                        .filter(c => c._optimistic && c.parent_author === author && c.parent_permlink === permlink);
                    this.setSt4te({ _comments: surviving, _comments_loading: false });
                    return;
                }
                const uniqueAuthors = [...new Set(replies.map(r => r.author).filter(Boolean))];
                const accsP = (uniqueAuthors.length > 0 && api.accounts)
                    ? api.accounts.getAccounts(uniqueAuthors).catch(() => []) : Promise.resolve([]);

                accsP.then((accounts) => {
                    const { comments, profileMap } = buildReplyComments(replies, accounts, this.st4te._authors, author, permlink);

                    const chainPermlinks = new Set(comments.map(c => c.permlink));
                    const surviving = (this.st4te._comments || [])
                        .filter(c => c._optimistic && !chainPermlinks.has(c.permlink)
                            && c.parent_author === author && c.parent_permlink === permlink);

                    // Also cache own profile if found in fetched profiles
                    const ownAccount = this.st4te.account;
                    if (ownAccount && profileMap[ownAccount] && !(this.st4te._accounts || {})[ownAccount]) {
                        const cached = { ...this.st4te._accounts };
                        cached[ownAccount] = profileMap[ownAccount];
                        this.setSt4te({ _comments: surviving.concat(comments), _comments_loading: false, _accounts: cached });
                    } else {
                        this.setSt4te({ _comments: surviving.concat(comments), _comments_loading: false });
                    }
                });
            })
            .catch((e) => {
                console.warn('[BlogPostDialog] Failed to fetch comments:', e.message);
                this.setSt4te({ _comments_loading: false });
            });
    }

    _fetch_comments = (data, silent) => {
        const d = data || this.st4te.data || {};
        // Nothing to discuss on a post that isn't there: the URL stub fires
        // this before the orphan fetch resolves, and deleted posts never
        // show their thread. Skip the round-trip in both cases.
        if (getPostState(d) !== POST_STATE.READY) return;
        const author = d.author;
        const authorUsername = (typeof author === 'object') ? (author.username || '') : (author || '');
        const permlink = d.permlink;
        if (authorUsername && permlink) this._fetch_replies_for(authorUsername, permlink, silent);
    }

    // Lazy loader handed to CommentInList so each top-level comment can render
    // its own direct replies inline (the 2nd visible level). Mirrors the fetch +
    // mapping in _fetch_replies_for, but returns the comments instead of storing
    // them in _comments.
    _load_replies_for = (comment) => {
        const api = this.st4te.api;
        if (!api || !api.content || !comment) return Promise.resolve([]);
        const author = comment.username || (comment.author || {}).username;
        const permlink = comment.permlink;
        if (!author || !permlink) return Promise.resolve([]);

        return api.content.getContentReplies(author, permlink)
            .then((replies) => {
                if (!Array.isArray(replies) || replies.length === 0) return [];
                const localAuthors = this.st4te._authors || {};
                const uniqueAuthors = [...new Set(replies.map(r => r.author).filter(Boolean))]
                    .filter(u => !localAuthors[u]);
                const accsP = (uniqueAuthors.length > 0 && api.accounts)
                    ? api.accounts.getAccounts(uniqueAuthors).catch(() => []) : Promise.resolve([]);
                return accsP.then((accounts) =>
                    buildReplyComments(replies, accounts, localAuthors, author, permlink).comments
                );
            })
            .catch((e) => {
                console.warn('[BlogPostDialog] Failed to load replies:', e && e.message);
                return [];
            });
    }

    // ── URL-hash intents ("#replies", "&focus=<b64>") ───────────────────
    // BlogPostDialog adopts PostDialog's drawer-hash scheme for the two
    // intents that make sense without a drawer: "#replies" scrolls the
    // comments section into view, and "#replies&focus=<b64url(author/
    // permlink)>" additionally pins that comment in its hover state,
    // brightens the tree path down to it (CommentInList's focusKey /
    // focusPathKeys) and centers the scroll on it. Read once per opening
    // (and per post change) from the live URL — the deep link is the whole
    // contract, exactly like PostDialog's open path.
    _adopt_url_hash = () => {
        const rawHash = (HISTORY.location && HISTORY.location.hash) || "";
        const focus = parseCommentFocusHash(rawHash);
        const wantsReplies = parsePostDrawerHash(rawHash) === POST_DRAWER_HASH_TABS.replies;
        this._cancel_focus_seek();
        const token = ++this._focusToken;
        this.setSt4te({ _focusComment: focus, _focusPathKeys: [] });
        if (focus) {
            this._resolve_focus_path(focus, token);
            this._seek_focused_comment(focus, token);
        } else if (wantsReplies) {
            this._seek_comments_section(token);
        }
    }

    _cancel_focus_seek = () => {
        if (this._focusSeekTimer) { clearTimeout(this._focusSeekTimer); this._focusSeekTimer = null; }
    }

    // Scroll the comments column into view (bare "#replies"). The column
    // lives inside a MUI <Portal> whose children land in document.body a
    // tick after the first render (see setScrollContainerRef) and behind a
    // Fade — so seek with a short poll instead of assuming the node exists.
    _seek_comments_section = (token) => {
        let tries = 0;
        const seek = () => {
            this._focusSeekTimer = null;
            if (token !== this._focusToken || !this.st4te.open) return;
            const el = this._commentsColumnRef;
            if (el) {
                try { el.scrollIntoView({ behavior: "smooth", block: "start" }); }
                catch (e) { el.scrollIntoView(); }
                return;
            }
            if (++tries < 20) this._focusSeekTimer = setTimeout(seek, 250);
        };
        this._focusSeekTimer = setTimeout(seek, 250);
    }

    // Scroll the pinned comment into view once its node exists. The thread
    // arrives in waves (top level, then each level's lazily loaded replies),
    // so seek with a short-lived poll instead of assuming it's mounted —
    // same rhythm as PostDialog's focused-comment seek. The node is found by
    // the global identity CommentInList stamps as data-comment-key.
    _seek_focused_comment = (focus, token) => {
        const key = ((focus && focus.author) || "") + "/" + ((focus && focus.permlink) || "");
        let tries = 0;
        const seek = () => {
            this._focusSeekTimer = null;
            if (token !== this._focusToken || !this.st4te.open) return;
            let el = null;
            try { el = document.querySelector('[data-comment-key="' + CSS.escape(key) + '"]'); } catch (e) {}
            if (el) {
                try { el.scrollIntoView({ behavior: "smooth", block: "center" }); }
                catch (e) { el.scrollIntoView(); }
                return;
            }
            if (++tries < 40) this._focusSeekTimer = setTimeout(seek, 250);
        };
        this._focusSeekTimer = setTimeout(seek, 250);
    }

    // Resolve the pinned comment's ancestor chain down from the thread's top
    // level, as "author/permlink" keys. CommentInList brightens exactly these
    // segments of the tree — and because the keys are global rather than
    // positional, they stay valid across sorts and "Show replies" re-roots.
    // Mirrors PostDialog's walk: at most 12 hops, stopping at the post itself
    // (or an empty parent_author).
    _resolve_focus_path = async (focus, token) => {
        const api = this.st4te.api;
        if (!api || !api.content || !focus) return;
        const rootAuthor = ((this.st4te.data || {}).author || {}).username;
        const rootPermlink = (this.st4te.data || {}).permlink;
        const keys = [];
        let a = focus.author, p = focus.permlink;
        try {
            for (let hop = 0; hop < 12; hop++) {
                if (token !== this._focusToken) return;
                keys.push(a + "/" + p);
                const c = await api.content.getContent(a, p);
                if (!c || !c.permlink) break;
                const pa = c.parent_author || "";
                const pp = c.parent_permlink || "";
                // Parent is the post itself (or a thread root): the chain of
                // COMMENT keys below it is complete.
                if (!pa || (pa === rootAuthor && pp === rootPermlink)) break;
                a = pa; p = pp;
            }
        } catch (e) {}
        if (token === this._focusToken && this.st4te.open) this.setSt4te({ _focusPathKeys: keys });
    }

    _show_replies = (comment, ancestors) => {
        // `ancestors` are inline-shown parents not yet in the breadcrumb (a nested
        // reply's depth-0 parent), so the path stays complete when drilling in.
        const anc = Array.isArray(ancestors) ? ancestors : [];
        const cc = this.st4te._current_comments.concat(...anc, comment);
        this.setSt4te({ _current_comments: cc });
        const a = comment.username || (comment.author || {}).username, p = comment.permlink;
        if (a && p) this._fetch_replies_for(a, p);
    }

    _slice_replies = (n) => {
        const cc = this.st4te._current_comments.slice(0, n);
        this.setSt4te({ _current_comments: cc });
        if (n === 0) {
            this._fetch_comments();
        } else {
            const p = cc[cc.length - 1];
            const a = p.username || (p.author || {}).username, pl = p.permlink;
            if (a && pl) this._fetch_replies_for(a, pl);
        }
    }

    _reply_to_comment = (commentData, ancestors) => {
        // Replying while editing abandons the edit — blank the pre-filled body.
        if (this.st4te._edit_target) this._set_comment_field("");
        const anc = Array.isArray(ancestors) ? ancestors : [];
        const cc = this.st4te._current_comments.concat(...anc, commentData);
        this.setSt4te({ _current_comments: cc, _reply_target: commentData, _edit_target: null });
        const a = commentData.username || (commentData.author || {}).username, p = commentData.permlink;
        if (a && p) this._fetch_replies_for(a, p);
        setTimeout(() => {
            const tf = document.getElementById("blog-comment-textfield");
            if (tf) { const inp = tf.querySelector?.("input, textarea"); (inp || tf).focus(); }
        }, 300);
    }

    _clear_reply_target = () => {
        this.setSt4te({ _reply_target: null });
    }

    /* ================================================================
     * COMMENT EDIT / DELETE (own comments — dialog-only by design)
     * ================================================================ */

    _set_comment_field = (val) => {
        const tf = document.getElementById("blog-comment-textfield");
        if (!tf) return;
        const inp = tf.querySelector?.("input, textarea");
        if (inp) inp.value = val;
        else if (tf.value !== undefined) tf.value = val;
        try {
            const ev = new Event("input", { bubbles: true });
            (inp || tf).dispatchEvent(ev);
        } catch (_) {}
    }

    // Enter edit mode: fetch the RAW on-chain body (the list renders
    // sanitized HTML; the patch must start from the exact stored bytes),
    // pre-fill the input bar with it and flag the edit target.
    _start_edit_comment = (comment) => {
        const { api, account } = this.st4te;
        if (!api || !account) return;
        const ca = comment.username || (comment.author || {}).username;
        if (!ca || ca !== account || !comment.permlink) return;
        this.setSt4te({ _reply_target: null });
        api.content.getContent(ca, comment.permlink, { raw: true })
            .then((raw) => {
                if (!raw || !raw.author) { actions.trigger_snackbar(t("words.could_not_load_the_comment_for_editing")); return; }
                this.setSt4te({ _edit_target: { comment, rawBody: raw.body || "" } });
                this._set_comment_field(raw.body || "");
                setTimeout(() => {
                    const tf = document.getElementById("blog-comment-textfield");
                    if (tf) { const inp = tf.querySelector?.("input, textarea"); (inp || tf).focus(); }
                }, 250);
            })
            .catch((e) => {
                console.warn('[BlogPostDialog] edit load failed:', e.message);
                actions.trigger_snackbar(t("words.could_not_load_the_comment_for_editing"));
            });
    }

    _cancel_edit_comment = () => {
        this.setSt4te({ _edit_target: null });
        this._set_comment_field("");
    }

    _request_delete_comment = (comment) => {
        const { account } = this.st4te;
        if (!account) return;
        const ca = comment.username || (comment.author || {}).username;
        if (!ca || ca !== account) return;
        this.setSt4te({ _delete_target: comment });
    }

    _cancel_delete_comment = () => {
        this.setSt4te({ _delete_target: null });
    }

    // Called by DeleteCommentModal once the delete_comment broadcast succeeds.
    // The modal owns the network call + its own loading state; here we only
    // reconcile local state (drop the comment, fix the count, clear any edit).
    _on_comment_deleted = (c) => {
        const ca = c.username || (c.author || {}).username;
        const cpl = c.permlink;
        const remaining = (this.st4te._comments || []).filter(x =>
            !(x.permlink === cpl && (x.username || (x.author || {}).username) === ca)
        );
        const wasEditing = this.st4te._edit_target?.comment?.permlink === cpl;
        this.setSt4te({
            _comments: remaining,
            _delete_target: null,
            ...(wasEditing ? { _edit_target: null } : {}),
        });
        if (wasEditing) this._set_comment_field("");
        if (this.st4te.data) this.st4te.data.children = Math.max(0, (this.st4te.data.children || 1) - 1);
        actions.trigger_snackbar(t("words.comment_deleted"));
    }

    /* ================================================================
     * OWNER POST ACTIONS (⋮ menu: edit content / edit details / delete)
     * ================================================================ */

    _is_own_post = () => {
        const { account, data } = this.st4te;
        return !!account && ((data || {}).author || {}).username === account;
    }

    _open_owner_menu = (e) => { this.setSt4te({ _owner_menu_anchor: e.currentTarget }); }
    _close_owner_menu = () => { this.setSt4te({ _owner_menu_anchor: null }); }

    _open_edit_post = () => { this.setSt4te({ _owner_menu_anchor: null, _edit_post_open: true }); }
    _close_edit_post = () => { this.setSt4te({ _edit_post_open: false }); }

    _open_delete_post = () => { this.setSt4te({ _owner_menu_anchor: null, _delete_post_open: true }); }
    _close_delete_post = () => { this.setSt4te({ _delete_post_open: false }); }

    // Soft-delete landed (DeletePostDialog) — the post is tagged #deleted, so
    // close the dialog; the host page's content_updated listener refetches.
    _on_post_deleted = () => {
        this.setSt4te({ _delete_post_open: false });
        this.props.onClose?.();
    }

    _open_editor = () => {
        this.setSt4te({ _owner_menu_anchor: null, _editor_mounted: true, _editor_open: true });
    }
    _close_editor = () => { this.setSt4te({ _editor_open: false }); }

    // Metadata edit landed (EditPostDialog) — reflect it in the open dialog.
    // The `content_updated` event refreshes the pages behind it.
    _on_post_edited = (payload) => {
        const data = this.st4te.data || {};
        if (data.permlink !== payload.permlink) return;
        const newData = {
            ...data,
            title: payload.title,
            tags: payload.tags || [],
            nsfw: !!payload.nsfw,
            deleted: !!payload.deleted,
            ...(payload.jsonMetadata ? { json_metadata: payload.jsonMetadata } : {}),
        };
        this.setSt4te({ data: newData });
        if (payload.deleted) {
            // A deleted post should not stay on screen — close and let the
            // host page's content_updated listener refetch the feed.
            this.props.onClose?.();
        }
    }

    // Full-content edit landed (TextEditorDialog) — refetch the sanitized
    // version so the rendered HTML, title and tags are authoritative.
    _on_editor_updated = (payload) => {
        const { api } = this.st4te;
        const data = this.st4te.data || {};
        this.setSt4te({ _editor_open: false });
        if (!api?.content || !payload || data.permlink !== payload.permlink) return;
        api.content.getContent(payload.author, payload.permlink)
            .then((fresh) => {
                if (!fresh || !fresh.author) return;
                const cur = this.st4te.data || {};
                if (cur.permlink !== payload.permlink) return; // navigated away meanwhile
                let metaTags = [];
                try {
                    const meta = typeof fresh.json_metadata === "string"
                        ? JSON.parse(fresh.json_metadata || "{}")
                        : (fresh.json_metadata || {});
                    if (Array.isArray(meta?.tags)) metaTags = meta.tags.filter(t => typeof t === "string");
                } catch (_) {}
                this.setSt4te({
                    data: {
                        ...cur,
                        title: fresh.title || cur.title,
                        content: fresh.body || cur.content,
                        body: fresh.body || cur.body,
                        ...(metaTags.length ? { tags: metaTags } : {}),
                    },
                });
                requestAnimationFrame(() => this._measureTitleHeight());
            })
            .catch((e) => console.warn('[BlogPostDialog] post refresh failed:', e.message));
    }

    _toggle_show_parent = () => {
        this.setSt4te({ _show_parent: !this.st4te._show_parent });
    }

    _handle_sorting_change = (e) => {
        this.setSt4te({ _sorting: e.target.value.toString() });
    }

    _start_comment_refresh = () => {
        if (this._commentRefreshTimer) {
            clearInterval(this._commentRefreshTimer);
            this._commentRefreshTimer = null;
        }
        let attempts = 0;
        this._commentRefreshTimer = setInterval(() => {
            attempts++;
            const cc = this.st4te._current_comments;
            if (cc && cc.length > 0) {
                const p = cc[cc.length - 1];
                const a = p.username || (p.author || {}).username, pl = p.permlink;
                if (a && pl) this._fetch_replies_for(a, pl, true);
            } else {
                this._fetch_comments(undefined, true);
            }
            if (attempts >= 3) {
                clearInterval(this._commentRefreshTimer);
                this._commentRefreshTimer = null;
            }
        }, 5000);
    }

    _submit_comment = async () => {
        const { api, account, data, _reply_target, _edit_target, _comment_sending } = this.st4te;
        if (!account) { actions.trigger_snackbar(t("components.blog_post_dialog.login_required_to_comment")); return; }
        if (!api) return;
        if (_comment_sending) return; // async now — a second click mid-gate must not double-broadcast

        const tf = document.getElementById("blog-comment-textfield");
        const body = (tf?.value !== undefined ? tf.value : (tf?.querySelector?.("input, textarea")?.value || "")).trim();
        if (!body) { actions.trigger_snackbar(t("words.comment_cannot_be_empty")); return; }

        // ── TOXIC COMMENT HELPER — pre-broadcast check (see utils/toxicity).
        //    First flagged click warns; a second click on the unchanged text
        //    broadcasts anyway. ──
        if (await toxicity.confirm_before_send("blog-comment-textfield", body)) {
            actions.trigger_snackbar(t("words.this_might_come_across_as_toxic_press"));
            return;
        }

        // ── EDIT MODE — same permlink + same parent ⇒ the chain treats the
        //    broadcast as an update; updateComment diffs against the raw
        //    on-chain body and sends the smaller of patch / full body. ──
        if (_edit_target) {
            const c = _edit_target.comment || {};
            const ca = c.username || (c.author || {}).username;
            const cpl = c.permlink;
            if (!ca || !cpl || ca !== account) { this.setSt4te({ _edit_target: null }); return; }
            if (body === (_edit_target.rawBody || "").trim()) {
                this.setSt4te({ _edit_target: null });
                this._set_comment_field("");
                return;
            }
            this.setSt4te({ _comment_sending: true });
            api.broadcast.updateComment({ author: ca, permlink: cpl, body })
                .then(() => {
                    let sanitized = body;
                    try { sanitized = rawSanitizeComment(body).html || body; } catch (e) {}
                    const updated = (this.st4te._comments || []).map(x =>
                        (x.permlink === cpl && (x.username || (x.author || {}).username) === ca)
                            ? { ...x, body: sanitized }
                            : x
                    );
                    this.setSt4te({ _comments: updated, _comment_sending: false, _edit_target: null });
                    this._set_comment_field("");
                    actions.trigger_snackbar(t("words.comment_updated"));
                })
                .catch((e) => {
                    console.warn('[BlogPostDialog] comment update failed:', e.message);
                    actions.trigger_snackbar(e.message || "Failed to update comment");
                    this.setSt4te({ _comment_sending: false });
                });
            return;
        }

        const rt = _reply_target;
        const pa = rt ? (rt.username || (rt.author || {}).username) : ((data.author || {}).username || '');
        const pp = rt ? rt.permlink : data.permlink;
        if (!pa || !pp) return;

        const cp = "re-" + pa + "-" + pp + "-" + Date.now().toString(36);
        this.setSt4te({ _comment_sending: true });

        api.broadcast.comment({
            parentAuthor: pa, parentPermlink: pp,
            author: account, permlink: cp,
            title: '', body,
            jsonMetadata: JSON.stringify({ app: 'pixagram', format: 'text' }),
        })
            .then(() => {
                let sanitized = body;
                try { sanitized = rawSanitizeComment(body).html || body; } catch(e) {}
                const la = this.st4te._authors || {}, la2 = this.st4te._accounts || {};
                const profile = la[account] || la2[account] || { username: account, name: account, image: "" };
                const opt = {
                    username: account, body: sanitized, date: Date.now(),
                    upVotesNumber: 0, downVotesNumber: 0, permlink: cp,
                    children: 0, active_votes: [],
                    parent_author: pa, parent_permlink: pp,
                    author: profile, _optimistic: true,
                };
                this.setSt4te({
                    _comments: [opt].concat(this.st4te._comments),
                    _comment_sending: false,
                    _reply_target: null,
                });
                if (tf) {
                    const inp = tf.querySelector?.("input, textarea");
                    if (inp) inp.value = "";
                    else if (tf.value !== undefined) tf.value = "";
                    const ev = new Event("input", { bubbles: true });
                    (inp || tf).dispatchEvent(ev);
                }
                actions.trigger_snackbar(t("components.blog_post_dialog.comment_posted"));
                if (rt) rt.children = (rt.children || 0) + 1;
                else if (data) data.children = (data.children || 0) + 1;

                this.props.onCommentPost?.({
                    parentAuthor: pa, parentPermlink: pp,
                    author: account, permlink: cp, body,
                    postAuthor: (data.author || {}).username,
                    postPermlink: data.permlink,
                    optimisticComment: opt,
                });
                this._start_comment_refresh();
            })
            .catch((e) => {
                console.warn('[BlogPostDialog] comment broadcast failed:', e.message);
                actions.trigger_snackbar(t("words.failed_to_post_comment"));
                this.setSt4te({ _comment_sending: false });
            });
    }

    _on_comment_key_down = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            this._submit_comment();
        }
    }

    /* ================================================================
     * VOTE HANDLERS
     * ================================================================ */

    _handle_upvote = () => {
        if (this._votingRef) return;
        const { api, account, data, _voted, onVoteChange } = this.st4te;
        if (!account) return;
        const authorUsername = (data.author || {}).username;
        const permlink = data.permlink;
        if (!authorUsername || !permlink) return;

        this._votingRef = true;
        this.setSt4te({ _upvoteLoading: true });
        const newVoted = _voted !== 1 ? 1 : 0;
        const weight = newVoted === 1 ? 10000 : 0;

        if (api) {
            api.broadcast.vote(account, authorUsername, permlink, weight)
                .then((res) => {
                    // res.outcome: 'nothing' | 'positive' | 'negative' | 'withdrawal'
                    if (!res || res.outcome === 'nothing') {
                        // cancelled — clear loading, leave the vote unchanged
                        this.setSt4te({ _upvoteLoading: false });
                        return;
                    }
                    const w = res.weight || 0;
                    this.setSt4te({ _voted: w > 0 ? 1 : w < 0 ? -1 : 0, _upvoteLoading: false });
                    if (onVoteChange) onVoteChange(permlink, account, w);
                })
                .catch((e) => {
                    console.warn('[BlogPostDialog] vote failed:', e.message);
                    this.setSt4te({ _upvoteLoading: false });
                })
                .finally(() => { this._votingRef = false; });
        } else {
            this._votingRef = false;
            this.setSt4te({ _upvoteLoading: false });
        }
    }

    _handle_downvote = () => {
        if (this._votingRef) return;
        const { api, account, data, _voted, onVoteChange } = this.st4te;
        if (!account) return;
        const authorUsername = (data.author || {}).username;
        const permlink = data.permlink;
        if (!authorUsername || !permlink) return;

        this._votingRef = true;
        this.setSt4te({ _downvoteLoading: true });
        const newVoted = _voted !== -1 ? -1 : 0;
        const weight = newVoted === -1 ? -10000 : 0;

        if (api) {
            api.broadcast.vote(account, authorUsername, permlink, weight)
                .then((res) => {
                    // res.outcome: 'nothing' | 'positive' | 'negative' | 'withdrawal'
                    if (!res || res.outcome === 'nothing') {
                        // cancelled — clear loading, leave the vote unchanged
                        this.setSt4te({ _downvoteLoading: false });
                        return;
                    }
                    const w = res.weight || 0;
                    this.setSt4te({ _voted: w > 0 ? 1 : w < 0 ? -1 : 0, _downvoteLoading: false });
                    if (onVoteChange) onVoteChange(permlink, account, w);
                })
                .catch((e) => {
                    console.warn('[BlogPostDialog] vote failed:', e.message);
                    this.setSt4te({ _downvoteLoading: false });
                })
                .finally(() => { this._votingRef = false; });
        } else {
            this._votingRef = false;
            this.setSt4te({ _downvoteLoading: false });
        }
    }

    _trigger_positive_votes = () => {
        const data = this.st4te.data || {};
        const voter = this.st4te.account;
        const voted = this.st4te._voted;
        const base = (data.active_votes || []).filter(v => v && v.voter !== voter);
        if (voted === 1 && voter) base.push({ voter, weight: 10000, rshares: '0', time: null });
        else if (voted === -1 && voter) base.push({ voter, weight: -10000, rshares: '0', time: null });
        actions.trigger_votes({sign: '+', votes: base, voter_profiles: data._voter_profiles || {}});
    }

    _trigger_negative_votes = () => {
        const data = this.st4te.data || {};
        const voter = this.st4te.account;
        const voted = this.st4te._voted;
        const base = (data.active_votes || []).filter(v => v && v.voter !== voter);
        if (voted === 1 && voter) base.push({ voter, weight: 10000, rshares: '0', time: null });
        else if (voted === -1 && voter) base.push({ voter, weight: -10000, rshares: '0', time: null });
        actions.trigger_votes({sign: '-', votes: base, voter_profiles: data._voter_profiles || {}});
    }

    /* ================================================================
     * DERIVED DATA
     * ================================================================ */

    // Memoized on (comments array identity, sorting): this dialog re-renders
    // on every scroll frame for the shrinking header, and each frame used to
    // re-slice + re-sort the whole thread (the "New" comparator also parsed
    // two Dates per comparison). The result is only rebuilt when a comment
    // arrives/leaves or the sort tab changes — which also keeps the array
    // identity stable for the CommentInList rows underneath.
    _get_sorted_comments = () => {
        const c = this.st4te._comments || [];
        const s = this.st4te._sorting;
        const memo = this._sortedMemo;
        if (memo && memo.comments === c && memo.sorting === s) return memo.sorted;
        let sorted;
        if (s === "New") {
            const ts = (x) => typeof x.date === "string" ? new Date(x.date).getTime() : (x.date || 0);
            sorted = c.map((x) => [ts(x), x])
                .sort((a, b) => b[0] - a[0])
                .map((p) => p[1]);
        } else if (s === "Votes") {
            sorted = c.slice().sort((a, b) =>
                (b.upVotesNumber - b.downVotesNumber) - (a.upVotesNumber - a.downVotesNumber));
        } else {
            sorted = c.slice().sort((a, b) =>
                ((b.upVotesNumber || 0) + (b.children || 0)) - ((a.upVotesNumber || 0) + (a.children || 0)));
        }
        this._sortedMemo = { comments: c, sorting: s, sorted };
        return sorted;
    }

    /** Locale-formatted post date for the header tooltip, cached per (date, locales). */
    _date_tooltip = (date, locales) => {
        if (this._dateCacheDate !== date || this._dateCacheLocales !== locales) {
            this._dateCacheDate = date;
            this._dateCacheLocales = locales;
            this._dateCacheText = new Date(date).toLocaleDateString(locales, DATE_TOOLTIP_FORMAT);
        }
        return this._dateCacheText;
    }

    /** Stable author-open handler for the header avatar/name (was two fresh closures per frame). */
    _open_post_author = () => {
        this._open_author(((this.st4te.data || {}).author || {}).username);
    }

    /** One delegated TOC click handler — the heading id rides on data-hid. */
    _on_toc_button_click = (e) => {
        this._on_toc_item_click(e, e.currentTarget.getAttribute("data-hid"));
    }

    /**
     * TOC entries + their per-row indent style, memoized on (article, title).
     * Pure function of the parsed article, so the per-frame render no longer
     * rebuilds the entry list, a style object and a click closure per heading.
     */
    _get_toc = (article, title) => {
        const memo = this._tocMemo;
        if (memo && memo.article === article && memo.title === title) return memo;
        let minLevel = 6;
        for (let i = 0; i < article.headings.length; i++) {
            if (article.headings[i].level < minLevel) minLevel = article.headings[i].level;
        }
        const hasTitle = !!title && article.headings.length > 0;
        const entries = hasTitle
            ? [{ id: TOC_TITLE_ID, text: title, level: minLevel - 1, isTitle: true }].concat(article.headings)
            : article.headings;
        const baseLevel = hasTitle ? minLevel - 1 : minLevel;
        const indentSteps = hasTitle ? 3 : 2;   // keep the body's depth range
        const styles = entries.map((h) => ({
            "--toc-indent": (12 + Math.min(Math.max(h.level - baseLevel, 0), indentSteps) * 14) + "px"
        }));
        this._tocMemo = { article, title, entries, styles, minLevel };
        return this._tocMemo;
    }

    _get_account_image = () => {
        const account = this.st4te.account;
        if (!account) return "";
        return (this.st4te._accounts[account] || this.st4te._authors[account] || {}).image || "";
    }

    /* ================================================================
     * RENDER
     * ================================================================ */

    /* ================================================================
     * DELETED / UNAVAILABLE POST
     * ================================================================
     * Community.js opens this dialog straight from the URL with a stub
     * ({author, permlink, _loading}) and hydrates it afterwards, so the
     * dialog has to be able to render without a post. Three cases reach
     * here, all of which used to render an empty shell:
     *
     *   LOADING   — orphan fetch in flight
     *   DELETED   — soft-deleted by its author (json_metadata.deleted),
     *               or gone from the chain with the author still around
     *   NOT_FOUND — unresolvable link / api never came up
     *
     * Deleted posts are filtered out of every listing, so they only ever
     * arrive by direct link, browser history or a stored favorite — which
     * is exactly the path the user reported as blank.
     */
    _render_unavailable = (postState) => {
        const { classes, open, data } = this.st4te;
        const author = data.author || {};
        const username = author.username || "";
        const displayName = author.name || (username ? "@" + username : "");

        const body = (() => {
            if (postState === POST_STATE.LOADING) {
                return <CircularProgress thickness={3} size={48} style={ST_C_666} />;
            }

            const deleted = postState === POST_STATE.DELETED;
            return (
                <div className={classes.unavailableCard}>
                    {deleted
                        ? <DeleteOutlineRounded className={classes.unavailableIcon} />
                        : <InfoOutlined className={classes.unavailableIcon} />}

                    <Typography className={classes.unavailableTitle}>
                        {deleted
                            ? t("components.post_unavailable.deleted_title")
                            : t("components.post_unavailable.not_found_title")}
                    </Typography>

                    {deleted && username && (
                        <Tooltip arrow classes={{ tooltip: classes.tooltipRoot }} title={"@" + username}>
                            <div
                                className={classes.unavailableAuthorRow}
                                onClick={() => this._open_author(username)}
                            >
                                <Avatar
                                    className={classes.unavailableAvatar}
                                    src={author.image}
                                    imgProps={{ decoding: "async", loading: "lazy" }}
                                />
                                <span className={classes.unavailableAuthorName}>
                                    {t("components.post_unavailable.deleted_by", { author: displayName })}
                                </span>
                            </div>
                        </Tooltip>
                    )}

                    <Typography className={classes.unavailableText}>
                        {deleted
                            ? t("components.post_unavailable.deleted_body")
                            : t("components.post_unavailable.not_found_body")}
                    </Typography>

                    <Button className={classes.unavailableButton} onClick={this.props.onClose}>
                        {t("components.post_unavailable.back")}
                    </Button>
                </div>
            );
        })();

        return (
            <Portal>
                <Backdrop open={open} className={classes.backdrop}>
                    <IconButton className={classes.closeButton} onClick={this.props.onClose}>
                        <CloseIcon />
                    </IconButton>
                    <div className={classes.unavailableWrap} onClick={this._handle_backdrop_click}>
                        {body}
                    </div>
                </Backdrop>
            </Portal>
        );
    }

    render() {
        const {
            classes, open, data, locales, api,
            _scrollTop,
            _current_comments, _show_parent, _sorting,
            _comments_loading, _comment_sending, _reply_target,
            _edit_target, _delete_target,
            _owner_menu_anchor, _edit_post_open, _editor_open, _editor_mounted, _delete_post_open,
            _voted, _initialVoted, _upvoteLoading, _downvoteLoading,
            _is_favorite,
            _titleHeight, _isMobileHeader,
            _toc_open, _toc_active, _lightbox,
            _focusComment, _focusPathKeys,
        } = this.st4te;

        // No post to render — deleted, unresolvable, or still loading. The
        // branch is deliberately NOT gated on `open`: a dialog closing on a
        // deleted post keeps rendering the same tree (with open=false) so it
        // fades out instead of flashing the empty article layout on its way
        // out. _render_unavailable passes `open` through to the Backdrop.
        const postState = getPostState(data);
        if (postState !== POST_STATE.READY) return this._render_unavailable(postState);

        const author = data.author || {};
        const readingTime = data.readTime || data.readingTime || Math.max(1, Math.round((data._word_count || 0) / 200)) || 5;
        const tags = data.tags || data._tags || [];
        const payout = parseFloat((data.payout || "0$").replace("$", "")) || 0.0;
        const upVotesNumber = (data.upVotesNumber || 0) + (_voted === 1 ? 1 : 0) - (_initialVoted === 1 ? 1 : 0);
        const downVotesNumber = (data.downVotesNumber || 0) + (_voted === -1 ? 1 : 0) - (_initialVoted === -1 ? 1 : 0);
        const dataAuthorUsername = author.username || '';

        const baseHeaderHeight = 360;
        const contentTopPadding = baseHeaderHeight + 32;   // card top — same on both layouts
        // Mobile: the wrapper sits flush at top: 0 (sm override) and its
        // expanded height equals the card's own top offset, so the cover
        // fills the entire gap between the screen top and the blog card —
        // the two 16px desktop gaps disappear and, with the square corners,
        // the view reads full-screen. It still shrinks 1:1 with the card on
        // scroll, staying glued to it until the collapsed height clamps in.
        const maxHeaderHeight = _isMobileHeader ? contentTopPadding : baseHeaderHeight;
        const minHeaderHeight = _titleHeight > 0 ? _titleHeight + 48 : 72;
        const headerHeight = Math.max(minHeaderHeight, maxHeaderHeight - _scrollTop);
        const scrollProgress = Math.min(_scrollTop / (maxHeaderHeight - minHeaderHeight), 1);
        const showHeaderTitle = scrollProgress > 0.6;
        const coverBrightness = Math.max(0.3, 1 - (scrollProgress * 0.7));

        // Coverless posts (no json_metadata.image) get a plain black cover
        // surface — no generated gradient. Black keeps the shrunken header
        // opaque so the title never floats over the scrolling content.
        const coverBackground = data.image || null;

        // Memoized: safeHTML + heading ids + TOC entries, one parse per body
        // (this used to re-sanitize the whole article on every scroll frame).
        const article = this._get_article();
        // The post's main title (rendered above the body, in view at
        // scrollTop = 0) leads the table of contents as its root entry, one
        // level above the body's shallowest heading. It only joins when body
        // headings exist — a title alone is no table of contents.
        // (Entries, indent styles and min level are memoized in _get_toc.)
        const toc = this._get_toc(article, (data.title || "").trim());
        const tocEntries = toc.entries;
        const tocStyles = toc.styles;
        const tocMinLevel = toc.minLevel;
        const sortedComments = this._get_sorted_comments();
        const accountImage = this._get_account_image();

        const commentPlaceholder = _edit_target
            ? "Edit your comment"
            : _reply_target
                ? t("words.reply_to", {
                    username: _reply_target.username || (_reply_target.author || {}).username
                })
                : t("words.reply_to_dataauthorusername", {
                    dataAuthorUsername: dataAuthorUsername
                });

        const isOwner = this._is_own_post();
        const focusKey = _focusComment
            ? ((_focusComment.author || "") + "/" + (_focusComment.permlink || ""))
            : null;

        return (
            <Portal>
                <Backdrop open={open} className={classes.backdrop}>
                    <IconButton className={classes.closeButton} onClick={this.props.onClose}>
                        <CloseIcon />
                    </IconButton>

                    {/* Table of contents — minimap capsule that grows on hover / click */}
                    {tocEntries.length > 0 && (
                        <nav
                            className={`${classes.tocPanel} ${_toc_open ? classes.tocPanelOpen : ''}`}
                            ref={this._set_toc_panel_ref}
                            aria-label={t("components.blog_post_dialog.table_of_contents")}
                            onMouseEnter={this._on_toc_mouse_enter}
                            onMouseLeave={this._on_toc_mouse_leave}
                            onPointerDown={this._on_toc_press}
                            onTouchStart={this._on_toc_press}
                            onClick={this._on_toc_click}
                        >
                            {tocEntries.map((h, i) => (
                                <button
                                    key={h.id}
                                    type="button"
                                    data-hid={h.id}
                                    title={h.text}
                                    tabIndex={_toc_open ? 0 : -1}
                                    className={`${classes.tocItem} ${h.id === _toc_active ? classes.tocItemActive : ''}`}
                                    style={tocStyles[i]}
                                    onClick={this._on_toc_button_click}
                                >
                                    <span className={classes.tocMarkerSlot}>
                                        <span className={
                                            h.isTitle ? classes.tocCircle
                                                : h.level === tocMinLevel ? classes.tocBar
                                                    : classes.tocDot
                                        } />
                                    </span>
                                    <span className={`${classes.tocLabel} ${h.isTitle ? classes.tocLabelTitle : ''}`}>{h.text}</span>
                                </button>
                            ))}
                        </nav>
                    )}

                    {/* Fixed header with cover image */}
                    <div className={classes.headerWrapper} style={{ height: headerHeight }}>
                        <div className={classes.headerContainer}>
                            <div
                                className={classes.coverImage}
                                ref={(el) => { this._coverRef = el; }}
                            >
                                <div
                                    className={classes.coverBackground}
                                    style={coverBackground ? {
                                        backgroundImage: cssBackgroundImage(coverBackground),
                                        backgroundSize: 'cover',
                                        backgroundPosition: '50% 50%',
                                        filter: `brightness(${coverBrightness})`,
                                    } : {
                                        backgroundColor: '#000000',
                                    }}
                                />
                                <div className={`${classes.coverOverlay} ${showHeaderTitle ? classes.coverOverlayDark : ''}`}>
                                    <Typography
                                        ref={this.titleRef}
                                        className={`${classes.headerTitle} ${showHeaderTitle ? classes.headerTitleVisible : ''}`}
                                    >
                                        {data.title || ""}
                                    </Typography>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div
                        className={classes.scrollContainer}
                        ref={this.setScrollContainerRef}
                        onClick={this._handle_backdrop_click}
                    >
                        <div
                            className={classes.contentWrapper}
                            ref={(el) => { this._contentWrapperRef = el; }}
                            style={{ paddingTop: contentTopPadding }}
                        >
                            {/* Desktop: side-by-side | Mobile: stacked */}
                            <div className={classes.desktopLayout}>
                                {/* Left: Blog content */}
                                <div className={classes.paperCardColumn}>
                                    <Fade in timeout={500}>
                                        <Card className={classes.paperCard}>
                                            <CardContent className={classes.paperContent}>
                                                <Typography variant="h1" className={classes.title}>
                                                    {data.title || ""}
                                                </Typography>

                                                <div className={classes.authorSection}>
                                                    <div style={ST_D_INLINE_FLEX__FLOAT_LEFT}>
                                                        <Avatar
                                                            className={classes.authorAvatar}
                                                            src={author.image}
                                                            onClick={this._open_post_author}
                                                            imgProps={LAZY_IMG_PROPS}
                                                        />
                                                        <div className={classes.authorDetails}>
                                                            <Tooltip title={'@' + (author.username || 'author')}>
                                                                <span className={classes.authorName} onClick={this._open_post_author}>
                                                                    {author.name || "Anonymous"}
                                                                </span>
                                                            </Tooltip>
                                                            <span className={classes.authorMeta}>
                                                                <Tooltip arrow classes={{ tooltip: classes.tooltipRoot }}
                                                                         title={this._date_tooltip(data.date || Date.now(), locales)}>
                                                                    <span className={classes.subheaderDate}>
                                                                        <LiveTimeAgo date={data.date || Date.now()} options={TIME_AGO_NARROW} />
                                                                    </span>
                                                                </Tooltip>
                                                                <span className={classes.subheaderBy}>{t("components.blog_post_dialog.min_read", {
                                                                    readingTime: readingTime
                                                                })}</span>
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className={classes.actions}>
                                                        <div>
                                                            <Tooltip title={_is_favorite ? "Remove from favorites" : "Add to favorites"}>
                                                                <IconButton className={classes.shareButton} onClick={this._toggle_favorite}>
                                                                    {_is_favorite ? <FavoriteRounded /> : <FavoriteBorderRounded />}
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title={t("components.blog_post_dialog.copy_link")}>
                                                                <IconButton className={classes.shareButton} onClick={this._copy_link}>
                                                                    <ShareRounded />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </div>
                                                        {isOwner && (
                                                            <div>
                                                                <Tooltip title={t("components.blog_post_dialog.manage_your_post")}>
                                                                    <IconButton className={classes.shareButton} onClick={this._open_owner_menu}>
                                                                        <MoreVertRounded />
                                                                    </IconButton>
                                                                </Tooltip>
                                                                <Menu
                                                                    anchorEl={_owner_menu_anchor}
                                                                    open={Boolean(_owner_menu_anchor)}
                                                                    onClose={this._close_owner_menu}
                                                                    MenuListProps={{ dense: true }}
                                                                    PaperProps={{ style: { backgroundColor: "#1a1a1a", borderRadius: 12 } }}
                                                                >
                                                                    <MenuItem onClick={this._open_editor}>
                                                                        <ListItemIcon style={ST_C_999__MINW_36}>
                                                                            <EditRounded fontSize="small" />
                                                                        </ListItemIcon>
                                                                        <ListItemText primary={<span style={ST_C_DDD__FS_14}>{t("components.blog_post_dialog.edit_content")}</span>} />
                                                                    </MenuItem>
                                                                    <MenuItem onClick={this._open_edit_post}>
                                                                        <ListItemIcon style={ST_C_999__MINW_36}>
                                                                            <TuneRounded fontSize="small" />
                                                                        </ListItemIcon>
                                                                        <ListItemText primary={<span style={ST_C_DDD__FS_14}>{t("components.blog_post_dialog.edit_details")}</span>} />
                                                                    </MenuItem>
                                                                    <MenuItem onClick={this._open_delete_post}>
                                                                        <ListItemIcon style={ST_C_999__MINW_36}>
                                                                            <DeleteOutlineRounded fontSize="small" />
                                                                        </ListItemIcon>
                                                                        <ListItemText primary={<span style={ST_C_DDD__FS_14}>{t("components.blog_post_dialog.delete_post")}</span>} />
                                                                    </MenuItem>
                                                                </Menu>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <ArticleBody
                                                    className={classes.blogContent}
                                                    html={article.html}
                                                    setRef={this._set_article_ref}
                                                    onClick={this._on_article_click}
                                                />

                                                <div className={classes.chipTags}>
                                                    {tags.map((tag, index) => (
                                                        <TagChip key={index} tag={tag} index={index} onClick={this._open_tag} />
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </Fade>
                                </div>

                                {/* Actions bar between article and comments */}
                                <div className={classes.cardActionsWrapper}>
                                    <PaperCardActions
                                        api={this.st4te.api}
                                        upvoteLoading={_upvoteLoading} downvoteLoading={_downvoteLoading}
                                        voted={_voted}
                                        handleUpvote={this._handle_upvote} handleDownvote={this._handle_downvote}
                                        upVotesNumber={upVotesNumber} downVotesNumber={downVotesNumber}
                                        triggerPositiveVotes={this._trigger_positive_votes}
                                        triggerNegativeVotes={this._trigger_negative_votes}
                                        payout={payout} data={data} voter={this.st4te.account}
                                    />
                                </div>

                                {/* Comments */}
                                <div className={classes.commentsColumn} ref={(node) => { this._commentsColumnRef = node; }}>
                                    <Fade in timeout={600}>
                                        <Card className={classes.commentsCard}>
                                            {/* Scrollable body */}
                                            <div className={classes.commentsCardContent}>
                                                {/* Reply chain breadcrumb */}
                                                <Collapse in={_current_comments.length > 0}>
                                                    <div>
                                                        <div style={ST_D_FLOW__H_48PX__POS_RELATIVE}>
                                                            <div style={ST_FLOAT_LEFT__D_FLEX__POS_RELATIVE}>
                                                                <IconButton onClick={this._toggle_show_parent}>
                                                                    {!_show_parent ? <VisibilityRounded /> : <VisibilityOffRounded />}
                                                                </IconButton>
                                                                <FormLabel component="legend" style={ST_VA_MIDDLE__LH_48PX__C_FFF}>{t("words.reply_to")}</FormLabel>
                                                            </div>
                                                            <div className={classes.repliesGroup}>
                                                                {_current_comments.map((cData, i) => {
                                                                    const cAuthor = cData.author || {};
                                                                    return (
                                                                        <React.Fragment key={i}>
                                                                            {i > 0 && <ArrowForwardIosIcon key={"arrow-" + i} style={ST_C_575757__TRANSF_ROTATE_180DEG__M_8PX_0PX_8PX_0P} />}
                                                                            <Avatar
                                                                                key={"avatar-" + i}
                                                                                alt={cAuthor.name}
                                                                                onClick={() => { this._slice_replies(i) }}
                                                                                src={cAuthor.image}
                                                                            />
                                                                        </React.Fragment>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </Collapse>

                                                {/* Parent comments */}
                                                <Collapse in={_show_parent}>
                                                    <div>
                                                        {_current_comments.map((comment, i) => (
                                                            <ParentComment
                                                                key={_current_comments.length - i}
                                                                comment={comment} index={i}
                                                                classes={classes} locales={locales}
                                                                onOpenAuthor={this._open_author}
                                                            />
                                                        ))}
                                                    </div>
                                                </Collapse>

                                                {/* Sorting */}
                                                <FormControl component="fieldset" style={ST_D_FLOW__POS_RELATIVE__W_CALC_100_16PX}>
                                                    <FormLabel component="legend" style={ST_C_FFF__M_10PX_8PX_8PX_0__FLOAT_LEFT}>{t("words.sort_by")}</FormLabel>
                                                    <RadioGroup
                                                        value={_sorting} defaultValue={"Hype"}
                                                        onChange={this._handle_sorting_change}
                                                        row aria-label="sorting" name="blog-sorting"
                                                        style={ST_JC_END__FLOAT_RIGHT}>
                                                        {SORT_LABELS.map((label) => (
                                                            <FormControlLabel
                                                                style={ST_C_888} labelPlacement="end"
                                                                key={label} value={label}
                                                                control={<Radio color="primary" />} label={label}
                                                            />
                                                        ))}
                                                    </RadioGroup>
                                                </FormControl>

                                                {/* Comments list */}
                                                <List>
                                                    {_comments_loading ? (
                                                        <div aria-busy="true" aria-label={t("components.blog_post_dialog.loading_comments")} style={ST_P_8PX_0}>
                                                            {[0, 1, 2].map((i) => (
                                                                <div key={`sk-${i}`} style={ST_D_FLEX__P_12PX_16PX__GAP_12}>
                                                                    <Skeleton variant="circle" width={36} height={36} />
                                                                    <div style={ST_FLEX_1}>
                                                                        <Skeleton variant="text" width={120} height={14} />
                                                                        <Skeleton variant="text" width="92%" height={12} style={ST_MT_6} />
                                                                        <Skeleton variant="text" width="78%" height={12} />
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : sortedComments.length === 0 ? (
                                                        <div style={ST_TA_CENTER__P_32PX_16PX}>
                                                            <CommentRounded style={ST_FS_48__C_333__MB_8} />
                                                            <Typography variant="body1" style={ST_C_666__MB_4}>
                                                                {t("words.no_comments_yet")}
                                                            </Typography>
                                                            <Typography variant="body2" style={ST_C_444}>
                                                                {t("words.be_the_first_to_share_your_thoughts")}
                                                            </Typography>
                                                        </div>
                                                    ) : sortedComments.map((comment, id) => (
                                                        /* permlink key: on sort changes the component instance
                                                           travels with its comment — no cross-comment slot reuse
                                                           (spurious vote-bounce) and no reply-cache invalidation
                                                           (the whole tree used to refetch on every sort). */
                                                        (<CommentInList
                                                            id={id} key={comment.permlink || id} data={comment}
                                                            api={this.st4te.api} account={this.st4te.account}
                                                            onShowReplies={this._show_replies}
                                                            onLoadReplies={this._load_replies_for}
                                                            onReply={this._reply_to_comment}
                                                            onEdit={this._start_edit_comment}
                                                            onDelete={this._request_delete_comment}
                                                            focusKey={focusKey}
                                                            focusPathKeys={_focusPathKeys}
                                                        />)
                                                    ))}
                                                </List>
                                            </div>

                                            {/* Comment input */}
                                            <CommentInput
                                                classes={classes}
                                                authorImage={accountImage}
                                                onSubmit={this._submit_comment}
                                                onKeyDown={this._on_comment_key_down}
                                                placeholder={commentPlaceholder}
                                                sending={_comment_sending}
                                                replyTarget={_reply_target}
                                                editTarget={_edit_target}
                                                onClearReply={this._clear_reply_target}
                                                onCancelEdit={this._cancel_edit_comment}
                                                account={this.st4te.account}
                                            />
                                        </Card>
                                    </Fade>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Image lightbox: hero zoom of an article image ──
                        Covers everything (incl. the close button) while open;
                        clicking anywhere, Escape, or scrolling past the
                        threshold flies the image back to its place. */}
                    {_lightbox && (
                        <div
                            className={classes.lightboxOverlay}
                            onClick={this._on_lightbox_click}
                            onWheel={this._on_lightbox_wheel}
                            onTouchStart={this._on_lightbox_touch_start}
                            onTouchMove={this._on_lightbox_touch_move}
                        >
                            <div className={classes.lightboxBackdrop} ref={this._set_lightbox_backdrop_ref} />
                            <img
                                className={classes.lightboxImage}
                                ref={this._set_lightbox_img_ref}
                                src={_lightbox.src}
                                alt={_lightbox.alt}
                                draggable={false}
                                style={{ imageRendering: _lightbox.rendering }}
                            />
                        </div>
                    )}

                </Backdrop>
                {/* ── Owner dialogs ─────────────────────────────────────── */}
                {isOwner && (
                    <EditPostDialog
                        open={_edit_post_open}
                        onClose={this._close_edit_post}
                        api={this.st4te.api}
                        account={this.st4te.account}
                        data={data}
                        onUpdated={this._on_post_edited}
                    />
                )}
                {isOwner && (
                    <DeletePostDialog
                        open={_delete_post_open}
                        onClose={this._close_delete_post}
                        api={this.st4te.api}
                        data={data}
                        onDeleted={this._on_post_deleted}
                    />
                )}
                {isOwner && _editor_mounted && (
                    <React.Suspense fallback={null}>
                        <LazyTextEditorDialog
                            api={this.st4te.api}
                            open={_editor_open}
                            editPost={{
                                author: dataAuthorUsername,
                                permlink: data.permlink,
                            }}
                            onClose={this._close_editor}
                            onUpdated={this._on_editor_updated}
                        />
                    </React.Suspense>
                )}
                {/* ── Delete-own-comment confirmation (delete_comment) ─── */}
                <DeleteCommentModal
                    open={Boolean(_delete_target)}
                    api={this.st4te.api}
                    account={this.st4te.account}
                    comment={_delete_target}
                    onCancel={this._cancel_delete_comment}
                    onDeleted={this._on_comment_deleted}
                />
            </Portal>
        );
    }
}

export default withLanguage(withStyles(styles)(BlogPostDialog));