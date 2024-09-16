import * as React from "preact/compat";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import Dialog from "@material-ui/core/Dialog";
import Fade from "@material-ui/core/Fade";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import Button from "@material-ui/core/Button";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import ListSubheader from "@material-ui/core/ListSubheader";
import Chip from "@material-ui/core/Chip";
import Tooltip from "@material-ui/core/Tooltip";
import CircularProgress from "@material-ui/core/CircularProgress";
import SwipeableViews from "react-swipeable-views";
import CloseIcon from "@material-ui/icons/Close";
import DeleteOutlineRounded from "@material-ui/icons/DeleteOutlineRounded";
import ImageRounded from "@material-ui/icons/ImageRounded";
import DescriptionRounded from "@material-ui/icons/DescriptionRounded";
import FavoriteBorderRounded from "@material-ui/icons/FavoriteBorderRounded";
import timeAgo from "../utils/TimeAgo";
import { HISTORY } from "../utils/constants";
import * as actions from "../actions/utils";
import * as favorites from "../utils/favorites";

import { T } from "../utils/T";
import { t, useLanguage } from "../utils/text";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FavoriteManagerDialog — browse, search and prune LacertaDB favorites
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Registered in pages/Index.js DIALOG_REGISTRY under 'favorites' and opened
 * through actions.trigger_favorites() (FAVORITES dispatcher case) — e.g. from
 * MenuContent's Apps → Bookmarks row. Props: { open, api, onClose }.
 *
 *  · Two tabs (Artworks / Blog Posts) inside a SwipeableViews.
 *  · Recently bookmarked first (store already sorts by bookmarked_at desc).
 *  · Tag search: every tag present in the CURRENT tab's bookmarks renders as
 *    a chip inside a rounded bar FIXED at the bottom of the dialog (it never
 *    scrolls with the list). One tag selectable at a time — the selected
 *    chip turns white with black text; tapping it again clears the filter.
 *  · Artwork rows: thumbnail at LEFT, always 128px tall, width follows the
 *    artwork's aspect ratio; title / author + date / truncated description;
 *    delete icon at RIGHT (confirmation modal before removal).
 *  · Blog rows: identical layout but the image is always a 128×128 square,
 *    and the list is separated by STICKY community headers showing the
 *    community's real title (resolved via bridge.get_community), never the
 *    raw portal-NNNNN slug.
 *  · Every thumbnail has rounded corners. UI is strictly greyscale — the
 *    only color on screen comes from the thumbnails themselves.
 */

const THUMB_H = 128;
const MAX_THUMB_W = 320;                 // safety clamp for extreme ratios
const EMPTY_ARRAY = Object.freeze([]);
const PORTAL_RE = /^portal-\d+$/;
const NO_COMMUNITY_KEY = "__none__";

const SWIPEABLE_CONTAINER_STYLE = Object.freeze({ height: "100%" });
const SWIPEABLE_SPRING = Object.freeze({ duration: "0.42s", easeFunction: "cubic-bezier(0.4, 0, 0.2, 1)", delay: "0s" });

const styles = (theme) => ({
    paper: {
        backgroundColor: "#141414",
        backgroundImage: "none",
        borderRadius: 24,
        width: "100%",
        maxWidth: 720,
        height: "min(760px, calc(100% - 64px))",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        [theme.breakpoints.down("xs")]: {
            borderRadius: 0,
            maxWidth: "100%",
            height: "100%",
            margin: 0,
        },
    },
    backdrop: {
        backdropFilter: "blur(9px) grayscale(1)",
    },
    header: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "20px 12px 8px 24px",
        flexShrink: 0,
    },
    headerTitle: {
        fontSize: "1.5rem",
        fontWeight: "bold",
        color: "#fff",
        fontFamily: '"Industry Book", "Normative Pro"',
        display: "flex",
        alignItems: "center",
        gap: "10px",
        "& svg": { color: "#8a8a8a" },
    },
    closeButton: {
        color: "#8a8a8a",
        "&:hover": { color: "#fff" },
    },
    /* Same pill-tabs treatment as PostDialog's cardTabs — #171717 bar,
     * 21px radii, light #c7c7c7 indicator pill sliding BEHIND the tab,
     * selected icon inverting to dark. Its fixed-position card layout is
     * replaced by normal flow. translateZ(0) keeps the zIndex:-1 indicator
     * inside this element's own stacking context (otherwise it sinks under
     * the opaque bar background — the CommentInList tree-connector lesson). */
    tabs: {
        flexShrink: 0,
        transform: "translateZ(0)",
        backgroundColor: "#171717",
        margin: "12px 16px 0px 16px",
        width: "calc(100% - 32px)",
        borderRadius: "21px",
        "& .MuiTab-root": {
            minWidth: "72px !important",
            textTransform: "none",
            fontFamily: '"Industry Book", "Normative Pro"',
            fontSize: "0.9rem",
        },
        /* Icon + label side by side, still inside the 48px pill geometry.
         * MUI's labelIcon variant stacks them and grows tabs to 72px,
         * which would break the scaled 48px indicator pill behind. */
        "& .MuiTab-labelIcon": {
            minHeight: "48px",
            paddingTop: "6px",
        },
        "& .MuiTab-wrapper": {
            flexDirection: "row",
            alignItems: "center",
        },
        "& .MuiTab-wrapper > *:first-child": {
            marginBottom: "0px !important",
            marginRight: "8px",
        },
        "& .MuiTab-textColorPrimary.Mui-selected": {
            backgroundColor: "transparent",
        },
        "& .MuiTab-textColorPrimary.Mui-selected .MuiTab-wrapper": {
            color: "#171717 !important"
        },
        "& .MuiTab-fullWidth": {
            backgroundColor: "transparent",
            color: "#989898",
            transition: "all 225ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
            borderRadius: "21px"
        },
        "& .MuiTab-fullWidth:hover": {
            backgroundColor: "rgba(255,255,255,0.06)"
        },
        "& span.MuiTabs-indicator": {
            zIndex: "-1",
            height: "48px",
            backgroundColor: "#c7c7c7",
            borderRadius: "21px",
            transform: "scale3d(0.875, 0.75, 1)"
        },
    },
    swipe: {
        flex: 1,
        minHeight: 0,
        "& .react-swipeable-view-container": { height: "100%" },
    },
    view: {
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
    },
    // ── Tag chips ──────────────────────────────────────────────────────────
    /* Bottom-fixed tag bar: a rounded #171717 area (same family as the
     * pill tabs, 21px house radius) anchored under the list in the flex
     * column — the list scrolls, the bar doesn't. Single row, chips
     * scroll horizontally when the tag set outgrows the width. */
    chipBar: {
        flexShrink: 0,
        margin: "0px",
        padding: "16px",
        backgroundColor: "#171717",
        borderRadius: "21px",
        display: "flex",
        flexWrap: "nowrap",
        alignItems: "center",
        gap: "8px",
        overflowX: "auto",
        overflowY: "hidden",
        scrollbarWidth: "thin",
        scrollbarColor: "#2e2e2e transparent",
        "& .MuiChip-root": { flexShrink: 0 },
    },
    // Exact chip values from PostDialog's chipTags "& .MuiChip-root" rules.
    chip: {
        cursor: "pointer",
        borderRadius: "12px",
        backgroundColor: "#1b1b1b",
        color: "#979797",
        transition: "background-color 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,color 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
        "&:hover, &:focus": {
            backgroundColor: "#2a2a2a",
            color: "#e3e3e3",
        },
    },
    // Selected → white (the manager's own state; PostDialog chips have none).
    chipSelected: {
        cursor: "pointer",
        borderRadius: "12px",
        backgroundColor: "#ffffff !important",
        color: "#000000",
        transition: "background-color 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,color 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
        "&:hover, &:focus": {
            backgroundColor: "#e9e9e9",
            color: "#000000",
        },
    },
    // ── Lists ──────────────────────────────────────────────────────────────
    listScroller: {
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        overscrollBehavior: "contain",
        padding: "0px 12px 16px 12px",
        scrollbarWidth: "thin",
        scrollbarColor: "#2e2e2e transparent",
    },
    list: {
        paddingTop: 0,
        // sticky headers need a non-static ancestor chain that scrolls here
        position: "relative",
    },
    /* Sticky outer stays square and paper-colored so scrolled rows never
     * peek through the corners; the visible header is the rounded inner
     * band (21px — the house radius, larger than rows/thumbnails). */
    communityHeader: {
        position: "sticky",
        top: 0,
        zIndex: 2,
        padding: "12px 8px 0px 8px",
        lineHeight: "normal",
    },
    communityHeaderBand: {
        display: "block",
        backgroundColor: "#1c1c1c",
        borderRadius: 21,
        padding: "9px 16px",
        color: "#9a9a9a",
        fontSize: "0.95rem",
        fontFamily: '"Industry Book", "Normative Pro"',
        letterSpacing: "0.02em",
        lineHeight: "22px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
    item: {
        alignItems: "flex-start",
        borderRadius: 16,
        padding: "10px 8px",
        gap: 14,
        "&:hover": { backgroundColor: "#1c1c1c" },
    },
    thumbWrap: {
        minWidth: 0,
        marginRight: 0,
        flexShrink: 0,
    },
    thumb: {
        height: THUMB_H,
        width: "auto",
        maxWidth: MAX_THUMB_W,
        display: "block",
        borderRadius: 14,
        backgroundColor: "#0d0d0d",
        objectFit: "cover",
    },
    thumbPixel: {
        imageRendering: "pixelated",
    },
    thumbSquare: {
        width: THUMB_H,
        objectFit: "cover",
    },
    thumbFallback: {
        height: THUMB_H,
        width: THUMB_H,
        borderRadius: 14,
        backgroundColor: "#0d0d0d",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        "& svg": { color: "#3a3a3a", fontSize: 40 },
    },
    itemText: {
        margin: 0,
        minWidth: 0,
        alignSelf: "stretch",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
    },
    primary: {
        color: "#f2f2f2",
        fontWeight: 600,
        fontSize: "1rem",
        lineHeight: 1.3,
        overflow: "hidden",
        textOverflow: "ellipsis",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        wordBreak: "break-word",
    },
    secondary: {
        color: "#8f8f8f",
        fontSize: "0.825rem",
        marginTop: 3,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    tertiary: {
        color: "#6a6a6a",
        fontSize: "0.8rem",
        marginTop: 5,
        lineHeight: 1.35,
        overflow: "hidden",
        textOverflow: "ellipsis",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        wordBreak: "break-word",
    },
    deleteButton: {
        color: "#6f6f6f",
        alignSelf: "center",
        flexShrink: 0,
        "&:hover": { color: "#ffffff", backgroundColor: "#242424" },
    },
    // ── States ─────────────────────────────────────────────────────────────
    stateWrap: {
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        color: "#5c5c5c",
        padding: 24,
        textAlign: "center",
        "& svg": { fontSize: 52, color: "#3a3a3a" },
    },
    stateTitle: {
        color: "#8f8f8f",
        fontFamily: '"Industry Book", "Normative Pro"',
        fontSize: "1.05rem",
    },
    stateHint: {
        color: "#5c5c5c",
        fontSize: "0.85rem",
        maxWidth: 380,
    },
    progress: {
        color: "#8a8a8a",
    },
    // ── Delete confirmation modal ──────────────────────────────────────────
    confirmPaper: {
        backgroundColor: "#1a1a1a",
        backgroundImage: "none",
        borderRadius: 21,
        padding: "24px 24px 16px 24px",
        maxWidth: 400,
        width: "calc(100% - 48px)",
    },
    confirmTitle: {
        color: "#fff",
        fontFamily: '"Industry Book", "Normative Pro"',
        fontWeight: "bold",
        fontSize: "1.2rem",
        marginBottom: 10,
    },
    confirmBody: {
        color: "#9a9a9a",
        fontSize: "0.9rem",
        lineHeight: 1.45,
        "& b": { color: "#dedede", fontWeight: 600 },
    },
    confirmActions: {
        display: "flex",
        justifyContent: "flex-end",
        gap: 8,
        marginTop: 22,
    },
    confirmCancel: {
        color: "#9a9a9a",
        textTransform: "none",
        borderRadius: 12,
        "&:hover": { color: "#fff", backgroundColor: "#242424" },
    },
    confirmRemove: {
        backgroundColor: "#ffffff",
        color: "#000000",
        textTransform: "none",
        borderRadius: 12,
        padding: "6px 18px",
        "&:hover": { backgroundColor: "#dedede" },
    },
});

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Unique tags of a favorites list, most frequent first then alphabetical. */
function collectTags(items) {
    const counts = new Map();
    for (const it of items) {
        for (const tag of (it.tags || EMPTY_ARRAY)) {
            counts.set(tag, (counts.get(tag) || 0) + 1);
        }
    }
    return Array.from(counts.keys()).sort((a, b) => {
        const d = counts.get(b) - counts.get(a);
        return d !== 0 ? d : a.localeCompare(b);
    });
}

/** Single-tag filter: no selection shows everything. */
function filterByTag(items, tag) {
    if (!tag) return items;
    return items.filter((it) => (it.tags || EMPTY_ARRAY).indexOf(tag) !== -1);
}

/** Best display date for the secondary line. */
const itemDate = (it) => it.created || it.bookmarked_at || Date.now();

/* A routable post URL MUST carry a leading segment. The sanitizer can
 * fabricate "/@author/permlink" (safe_url_path fallback) and favorites
 * saved before this fix may have persisted that shape — so a stored url
 * is only trusted when it actually matches /<segment>/@author/permlink. */
const SEGMENTED_URL_RE = /^\/[^/@][^/]*\/@[^/]+\/[^/]+/;

/** Canonical post URL: /<segment>/@author/permlink — the leading segment
 * is MANDATORY for the SPA router ("/@author/permlink" alone does not
 * resolve). Priority: the stored url IF it carries a segment, then the
 * stored category, then the FIRST TAG — for artworks the category IS the
 * first tag on non-community posts, so every artwork opens as
 * /tag/@username/permlink even when its url field is the fabricated
 * segment-less shape or enrichment hasn't landed yet. */
function itemUrl(it) {
    if (it.url && SEGMENTED_URL_RE.test(it.url)) return it.url;
    if (!it.author || !it.permlink) return null;
    const segment = it.category
        || (Array.isArray(it.tags) && it.tags.length ? it.tags[0] : null);
    return segment ? "/" + segment + "/@" + it.author + "/" + it.permlink : null;
}

// ── Row (shared by both tabs) ───────────────────────────────────────────────

const FavoriteRow = React.memo(function FavoriteRow({ classes, item, square, pixelated, onOpen, onAskDelete }) {
    useLanguage();
    const handleOpen = useCallback(() => onOpen(item), [onOpen, item]);
    const handleDelete = useCallback((e) => {
        e.stopPropagation();
        onAskDelete(item);
    }, [onAskDelete, item]);

    // Artworks: height fixed to 128, width follows the artwork's aspect
    // ratio (width/height × 128). Falls back to the image's natural ratio
    // (width:auto) when dims were never captured. Blogs: always square.
    const thumbStyle = useMemo(() => {
        if (square) return null;
        if (item.width > 0 && item.height > 0) {
            const w = Math.max(32, Math.min(MAX_THUMB_W, Math.round((item.width / item.height) * THUMB_H)));
            return { width: w };
        }
        return null;
    }, [square, item.width, item.height]);

    const secondary = (
        <React.Fragment>
            <span className={classes.secondary}>
                {"by " + (item.author_name || item.author) + " · " + timeAgo.format(new Date(itemDate(item)))}
            </span>
            {item.description ? (
                <span className={classes.tertiary}>{item.description}</span>
            ) : null}
        </React.Fragment>
    );

    return (
        <ListItem button disableRipple className={classes.item} onClick={handleOpen}>
            <ListItemIcon className={classes.thumbWrap}>
                {item.image ? (
                    <img
                        src={item.image}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                        className={
                            classes.thumb
                            + (square ? " " + classes.thumbSquare : "")
                            + (pixelated ? " " + classes.thumbPixel : "")
                        }
                        style={thumbStyle}
                    />
                ) : (
                    <div className={classes.thumbFallback}>
                        {square ? <DescriptionRounded /> : <ImageRounded />}
                    </div>
                )}
            </ListItemIcon>
            <ListItemText
                disableTypography
                className={classes.itemText}
                primary={<span className={classes.primary}>{item.title || "@" + item.author + "/" + item.permlink}</span>}
                secondary={secondary}
            />
            <Tooltip title={t("components.favorite_manager_dialog.remove_from_favorites")}>
                <IconButton className={classes.deleteButton} onClick={handleDelete} aria-label={t("components.favorite_manager_dialog.remove_from_favorites_2")}>
                    <DeleteOutlineRounded />
                </IconButton>
            </Tooltip>
        </ListItem>
    );
}, (a, b) => a.item === b.item && a.square === b.square && a.classes === b.classes);

// ── Chip row ────────────────────────────────────────────────────────────────

const TagChips = React.memo(function TagChips({ classes, tags, selected, onToggle, titles }) {
    useLanguage();
    if (!tags.length) return null;
    return (
        <div className={classes.chipBar}>
            {tags.map((tag) => {
                const isSelected = selected === tag;
                // portal-NNNNN chips wear the community's REAL title (no
                // "#" — it's a community, not a hashtag), falling back to
                // the raw slug until resolution lands. The tag VALUE used
                // for filtering stays the slug either way.
                const label = PORTAL_RE.test(tag)
                    ? ((titles && titles[tag]) || tag)
                    : "#" + tag;
                return (
                    <Chip
                        key={tag}
                        label={label}
                        clickable
                        onClick={() => onToggle(tag)}
                        className={isSelected ? classes.chipSelected : classes.chip}
                    />
                );
            })}
        </div>
    );
}, (a, b) => a.tags === b.tags && a.selected === b.selected && a.classes === b.classes && a.titles === b.titles);

// ── Empty / loading states ──────────────────────────────────────────────────

const EmptyState = ({ classes, square, filtered }) => (
    <div className={classes.stateWrap}>
        {square ? <DescriptionRounded /> : <ImageRounded />}
        <Typography className={classes.stateTitle}>
            {filtered
                ? "Nothing carries the selected tag"
                : (square ? "No favorite blog posts yet" : "No favorite artworks yet")}
        </Typography>
        <Typography className={classes.stateHint}>
            {filtered
                ? "Pick a different tag — or tap the selected one again to clear it."
                : (square
                    ? "Tap the heart next to the share icon on any blog post to keep it here."
                    : "Open an artwork and use Actions → Add to favorites to keep it here.")}
        </Typography>
    </div>
);

// ═════════════════════════════════════════════════════════════════════════════
// Main component
// ═════════════════════════════════════════════════════════════════════════════

function FavoriteManagerDialog(props) {
    const { classes, open, api, onClose } = props;

    const [tab, setTab] = useState(0);
    const [loading, setLoading] = useState(true);
    const [artworks, setArtworks] = useState(EMPTY_ARRAY);
    const [blogs, setBlogs] = useState(EMPTY_ARRAY);
    const [artTag, setArtTag] = useState(null);                 // selected chip (one at a time)
    const [blogTag, setBlogTag] = useState(null);
    const [titles, setTitles] = useState({});                   // portal-N → real name
    const [deleteTarget, setDeleteTarget] = useState(null);     // item pending confirm
    const mountedRef = useRef(false);

    // ── Data loading ───────────────────────────────────────────────────────
    const reload = useCallback((withSpinner) => {
        if (withSpinner) setLoading(true);
        Promise.all([
            favorites.getFavorites(api, favorites.FAVORITE_TYPES.ARTWORKS),
            favorites.getFavorites(api, favorites.FAVORITE_TYPES.BLOGS),
        ]).then(([arts, blgs]) => {
            if (!mountedRef.current) return;
            setArtworks(arts);
            setBlogs(blgs);
            setLoading(false);
        }).catch(() => {
            if (!mountedRef.current) return;
            setArtworks(EMPTY_ARRAY);
            setBlogs(EMPTY_ARRAY);
            setLoading(false);
        });
    }, [api]);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    useEffect(() => {
        if (!open) return;
        reload(true);
        // Live refresh: enrichment upserts + toggles from the post dialogs
        const unsubscribe = favorites.subscribe(() => reload(false));
        return unsubscribe;
    }, [open, reload]);

    // ── Community titles — sticky headers AND portal tag chips ─────────────
    // portal-NNNNN appears both as the blog grouping category and inside
    // tag arrays (the blog editor writes tags:[community]). Resolve every
    // distinct slug once; headers and chips read the same `titles` map.
    useEffect(() => {
        if (!open) return;
        const pending = new Set();
        for (const b of blogs) {
            const slug = b.category;
            if (!slug || !PORTAL_RE.test(slug)) continue;
            if (b.community_title || titles[slug]) continue;
            pending.add(slug);
        }
        for (const list of [artworks, blogs]) {
            for (const it of list) {
                for (const tag of (it.tags || EMPTY_ARRAY)) {
                    if (PORTAL_RE.test(tag) && !titles[tag]) pending.add(tag);
                }
            }
        }
        if (!pending.size) return;
        let cancelled = false;
        pending.forEach((slug) => {
            favorites.resolveCommunityTitle(api, slug).then((title) => {
                if (cancelled || !mountedRef.current || !title || title === slug) return;
                setTitles((prev) => (prev[slug] === title ? prev : { ...prev, [slug]: title }));
            }).catch(() => {});
        });
        return () => { cancelled = true; };
    }, [open, blogs, artworks, titles, api]);

    // ── Derived render data ────────────────────────────────────────────────
    const artAllTags = useMemo(() => collectTags(artworks), [artworks]);
    const blogAllTags = useMemo(() => collectTags(blogs), [blogs]);
    const artFiltered = useMemo(() => filterByTag(artworks, artTag), [artworks, artTag]);
    const blogFiltered = useMemo(() => filterByTag(blogs, blogTag), [blogs, blogTag]);

    /* Blog groups: keyed by community slug, headed by its REAL name.
     * Group order follows the most recently bookmarked item inside each
     * group, so the whole tab still reads newest-first. */
    const blogGroups = useMemo(() => {
        const map = new Map();
        for (const item of blogFiltered) {
            const slug = item.category && String(item.category);
            const key = slug || NO_COMMUNITY_KEY;
            if (!map.has(key)) map.set(key, { key, slug, items: [] });
            map.get(key).items.push(item);
        }
        const groups = Array.from(map.values());
        for (const g of groups) {
            g.latest = g.items.reduce((m, it) => Math.max(m, it.bookmarked_at || 0), 0);
            g.title = !g.slug
                ? "No community"
                : (PORTAL_RE.test(g.slug)
                    ? (g.items.find((it) => it.community_title)?.community_title || titles[g.slug] || g.slug)
                    : g.slug);
        }
        groups.sort((a, b) => b.latest - a.latest);
        return groups;
    }, [blogFiltered, titles]);

    // ── Handlers ───────────────────────────────────────────────────────────
    const handleTabChange = useCallback((event, value) => setTab(value), []);
    const handleChangeIndex = useCallback((index) => setTab(index), []);

    const toggleArtTag = useCallback((tag) => {
        setArtTag((prev) => (prev === tag ? null : tag));
    }, []);
    const toggleBlogTag = useCallback((tag) => {
        setBlogTag((prev) => (prev === tag ? null : tag));
    }, []);

    const openItem = useCallback((item) => {
        const url = itemUrl(item);
        if (!url) {
            actions.trigger_snackbar(t("components.favorite_manager_dialog.this_favorite_cant_be_opened_yet_its"));
            return;
        }
        if (typeof onClose === "function") onClose();
        HISTORY.push(url);
    }, [onClose]);

    const askDelete = useCallback((item) => setDeleteTarget(item), []);
    const cancelDelete = useCallback(() => setDeleteTarget(null), []);
    const confirmDelete = useCallback(() => {
        const target = deleteTarget;
        setDeleteTarget(null);
        if (!target) return;
        favorites.removeFavorite(api, target.type, target.author, target.permlink).then((ok) => {
            actions.trigger_snackbar(ok ? t("words.removed_from_favorites") : t("components.favorite_manager_dialog.could_not_remove_this_favorite"));
            actions.trigger_sfx("labactive");
        });
        // Optimistic prune — subscribe() will confirm with the stored truth.
        if (target.type === favorites.FAVORITE_TYPES.BLOGS) {
            setBlogs((prev) => prev.filter((it) => !(it.author === target.author && it.permlink === target.permlink)));
        } else {
            setArtworks((prev) => prev.filter((it) => !(it.author === target.author && it.permlink === target.permlink)));
        }
    }, [deleteTarget, api]);

    // ── Render ─────────────────────────────────────────────────────────────
    const isFullScreen = typeof window !== "undefined"
        && (window.innerWidth || document.documentElement.clientWidth || 960) <= 600;

    return (
        <Dialog
            open={Boolean(open)}
            onClose={onClose}
            fullScreen={isFullScreen}
            classes={{ paper: classes.paper }}
            BackdropProps={{ className: classes.backdrop }}
        >
            <div className={classes.header}>
                <Typography component="div" className={classes.headerTitle}>
                    <FavoriteBorderRounded /> {t("components.favorite_manager_dialog.favorites")}
                </Typography>
                <IconButton className={classes.closeButton} onClick={onClose} aria-label={t("components.favorite_manager_dialog.close_favorites")}>
                    <CloseIcon />
                </IconButton>
            </div>
            <Tabs
                value={tab}
                onChange={handleTabChange}
                variant="fullWidth"
                indicatorColor="primary"
                textColor="primary"
                className={classes.tabs}
            >
                <Tab icon={<ImageRounded />} label={t("components.favorite_manager_dialog.artwork")} />
                <Tab icon={<DescriptionRounded />} label={t("components.favorite_manager_dialog.blog_post")} />
            </Tabs>
            {loading ? (
                <div className={classes.stateWrap}>
                    <CircularProgress size={40} thickness={3.5} className={classes.progress} />
                </div>
            ) : (
                <SwipeableViews
                    ignoreNativeScroll={true}
                    className={classes.swipe}
                    containerStyle={SWIPEABLE_CONTAINER_STYLE}
                    springConfig={SWIPEABLE_SPRING}
                    index={tab}
                    onChangeIndex={handleChangeIndex}
                    resistance
                    animateHeight={false}
                    disableLazyLoading
                >
                    {/* ── Tab 0: Artworks ─────────────────────────────── */}
                    <div className={classes.view} key="favorites-artworks">
                        {artFiltered.length === 0 ? (
                            <EmptyState classes={classes} square={false} filtered={artworks.length > 0} />
                        ) : (
                            <div className={classes.listScroller}>
                                <List className={classes.list} disablePadding>
                                    {artFiltered.map((item) => (
                                        <FavoriteRow
                                            key={"art-" + item.author + "-" + item.permlink}
                                            classes={classes}
                                            item={item}
                                            square={false}
                                            pixelated
                                            onOpen={openItem}
                                            onAskDelete={askDelete}
                                        />
                                    ))}
                                </List>
                            </div>
                        )}
                    </div>

                    {/* ── Tab 1: Blog posts, grouped by community ─────── */}
                    <div className={classes.view} key="favorites-blogs">
                        {blogFiltered.length === 0 ? (
                            <EmptyState classes={classes} square filtered={blogs.length > 0} />
                        ) : (
                            <div className={classes.listScroller}>
                                <List className={classes.list} disablePadding>
                                    {blogGroups.map((group) => (
                                        <React.Fragment key={"grp-" + group.key}>
                                            <ListSubheader className={classes.communityHeader} disableSticky={false} disableGutters>
                                                <span className={classes.communityHeaderBand}>{group.title}</span>
                                            </ListSubheader>
                                            {group.items.map((item) => (
                                                <FavoriteRow
                                                    key={"blog-" + item.author + "-" + item.permlink}
                                                    classes={classes}
                                                    item={item}
                                                    square
                                                    pixelated={false}
                                                    onOpen={openItem}
                                                    onAskDelete={askDelete}
                                                />
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </List>
                            </div>
                        )}
                    </div>
                </SwipeableViews>
            )}
            {(tab === 0) && <Fade in><div><TagChips classes={classes} tags={artAllTags} selected={artTag} onToggle={toggleArtTag} titles={titles} /></div></Fade>}
            {(tab === 1) && <Fade in><div><TagChips classes={classes} tags={blogAllTags} selected={blogTag} onToggle={toggleBlogTag} titles={titles} /></div></Fade>}
            {/* ── Delete confirmation ───────────────────────────────────── */}
            <Dialog
                open={Boolean(deleteTarget)}
                onClose={cancelDelete}
                classes={{ paper: classes.confirmPaper }}
                BackdropProps={{ className: classes.backdrop }}
            >
                <Typography className={classes.confirmTitle}>{t("components.favorite_manager_dialog.remove_from_favorites_3")}</Typography>
                <Typography component="div" className={classes.confirmBody}><T
                        k="components.favorite_manager_dialog.b_b_will_be_removed_from_your"
                        vars={{
                            title: deleteTarget ? (deleteTarget.title || "@" + deleteTarget.author + "/" + deleteTarget.permlink) : "",
                            text: " ",
                            text_2: deleteTarget && deleteTarget.type === favorites.FAVORITE_TYPES.BLOGS ? "blog posts" : "artworks"
                        }} /></Typography>
                <div className={classes.confirmActions}>
                    <Button className={classes.confirmCancel} onClick={cancelDelete} disableElevation>
                        {t("words.cancel")}
                    </Button>
                    <Button className={classes.confirmRemove} onClick={confirmDelete} variant="contained" disableElevation>
                        {t("components.favorite_manager_dialog.remove")}
                    </Button>
                </div>
            </Dialog>
        </Dialog>
    );
}

export default withStyles(styles)(FavoriteManagerDialog);