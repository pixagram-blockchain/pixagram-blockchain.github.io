"use strict";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import ListSubheader from "@material-ui/core/ListSubheader";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import Collapse from "@material-ui/core/Collapse";
import Tooltip from "@material-ui/core/Tooltip";
import CircularProgress from "@material-ui/core/CircularProgress";
import VerifiedUserRounded from "@material-ui/icons/VerifiedUserRounded";
import WarningRounded from "@material-ui/icons/WarningRounded";
import HourglassEmptyRounded from "@material-ui/icons/HourglassEmptyRounded";
import InfoOutlined from "@material-ui/icons/InfoOutlined";
import HelpOutlineRounded from "@material-ui/icons/HelpOutlineRounded";
import BrokenImageRounded from "@material-ui/icons/BrokenImageRounded";
import ExpandMoreRounded from "@material-ui/icons/ExpandMoreRounded";
import CollectionsRounded from "@material-ui/icons/CollectionsRounded";
import EmojiObjectsRounded from "@material-ui/icons/EmojiObjectsRounded";

import { ORIGINALITY, MATCH, fetchOriginality, fetchSimilar, timeline } from "./search/originalityApi";
import timeAgo from "../utils/TimeAgo";
import { t, useLanguage } from "../utils/text";
import { T } from "../utils/T";

// ── PostOriginality ───────────────────────────────────────────────────────────
// The last section of the post drawer's Details tab, after Actions:
//
//   Originality   one status line, asked of the search Worker when the section scrolls into
//                 view: original, copied by others later, re-posted by its artist, loose
//                 matches only, a possible fake (another artist published a matching artwork
//                 earlier), or matches whose order the chain history cannot settle (an image
//                 the Worker could only date from below). The matching artworks are NOT
//                 shown until asked for: "Show
//                 matches" expands a single horizontally scrolling row, a timeline oldest image
//                 first with this artwork outlined in it, and the thumbnails only start loading
//                 once the expand has finished, each fading in as it arrives.
//   Inspiration   "Reveal artworks with similar themes": up to eight of the Worker's SigLIP
//                 neighbours (copies left out), fetched on the first reveal, laid out in three
//                 masonry columns and faded in the same way.
//
// The parent keys this component by post, so every post starts collapsed. Opening a thumbnail
// goes through `onOpenArtwork(item)` (the dialog swaps the post in place).

const NS = "components.post_originality.";

const COLLAPSE_TIMEOUT = Object.freeze({ enter: 360, exit: 260 });
const TILE_H = 96;            // matches row: every thumbnail this tall...
const TILE_MIN_W = 72;        // ...and this wide at least (room for the verdict badge),
const TILE_MAX_W = 168;       // ...at most (very wide or very tall works are letterboxed)
const COLUMNS = 3;            // inspiration masonry
const STAGGER_MS = 55;        // fade-in delay between consecutive thumbnails
const STAGGER_MAX = 8;
const DATE_OPTIONS = Object.freeze({ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric" });
const SKELETON = [[1, 0.8], [1.25, 0.75], [0.85, 1.1]]; // height / width of the placeholder cells, per column

const stagger = (index) => Math.min(index, STAGGER_MAX) * STAGGER_MS + "ms";
const stopPropagation = (e) => e.stopPropagation();
const activateOnKey = (fn) => (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); }
};

/** Width of a row thumbnail: the artwork's aspect at TILE_H, clamped. */
function tileWidth(item) {
    if (!(item.width > 0 && item.height > 0)) return TILE_H;
    return Math.round(Math.min(TILE_MAX_W, Math.max(TILE_MIN_W, (TILE_H * item.width) / item.height)));
}

function verdictLabel(m) {
    if (m.state === MATCH.IDENTICAL) return t(NS + "identical");
    if (m.state === MATCH.COPY) return m.mirrored ? t(NS + "mirrored") : t(NS + "copy");
    return t(NS + "possible");
}

const relationLabel = (m) => t(NS + (m.relation === "earlier" ? "earlier" : m.relation === "later" ? "later" : "order_unknown"));

function formatDate(seconds, locales) {
    if (!seconds) return "";
    try {
        return new Date(seconds * 1000).toLocaleDateString(locales, DATE_OPTIONS);
    } catch (e) {
        return new Date(seconds * 1000).toLocaleDateString();
    }
}

/** Shortest-column-first, in display order; each entry keeps its rank for the fade-in stagger. */
function distribute(items, columns) {
    const cols = Array.from({ length: columns }, () => ({ items: [], height: 0 }));
    items.forEach((item, index) => {
        let target = cols[0];
        for (const c of cols) if (c.height < target.height) target = c;
        target.items.push({ item, index });
        target.height += cellRatio(item) + 0.06;
    });
    return cols.map((c) => c.items);
}

/** Height / width of an inspiration cell: the artwork's own, kept between 1:2 and 2:1. */
function cellRatio(item) {
    if (!(item.width > 0 && item.height > 0)) return 1;
    return Math.min(2, Math.max(0.5, item.height / item.width));
}

// ── thumbnails ────────────────────────────────────────────────────────────────

const TIP_TITLE = { display: "block", fontWeight: "bold", marginBottom: 2, overflowWrap: "anywhere" };
const TIP_LINE = { display: "block", opacity: 0.85 };

function MatchTip({ item, locales }) {
    const facts = item.isSelf
        ? [t(NS + "this_artwork")]
        : [verdictLabel(item), relationLabel(item), item.sameAuthor ? t(NS + "same_artist") : null].filter(Boolean);
    const date = formatDate(item.publishedAt, locales);
    return (
        <React.Fragment>
            {item.title ? <span style={TIP_TITLE}>{item.title}</span> : null}
            <span style={TIP_LINE}>@{item.author}{date ? " · " + date : ""}</span>
            <span style={TIP_LINE}>{facts.join(" · ")}</span>
        </React.Fragment>
    );
}

const MatchTile = React.memo(function MatchTile({ item, index, classes, reveal, nsfw, locales, lang, onOpen }) {
    // A match the Worker has no image URL for still shows its author, date and verdict.
    const [loaded, setLoaded] = useState(!item.src);
    const done = useCallback(() => setLoaded(true), []);
    // Blurred NSFW opens nothing, like a blurred card in the feed.
    const blurred = item.nsfw && !nsfw;
    const openable = !item.isSelf && !blurred;
    const open = useCallback(() => { if (openable && onOpen) onOpen(item); }, [openable, item, onOpen]);
    const width = tileWidth(item);
    const delay = { animationDelay: stagger(index) };
    const shown = loaded ? " loaded" : "";
    const meta = item.isSelf
        ? t(NS + "this_artwork")
        : (item.sameAuthor ? t(NS + "same_artist") : relationLabel(item)) + " · " + timeAgo.format(item.publishedAt * 1000, { labels: "short" });
    // Nearest-neighbour only when the box enlarges the artwork; a reduced one reads better smooth.
    const scale = item.width > 0 && item.height > 0 ? Math.min(width / item.width, TILE_H / item.height) : 0;
    const imgClass = classes.tileImg + shown
        + (scale >= 1 ? " pixelated" : "")
        + (blurred ? " nsfw" : "");
    return (
        <Tooltip arrow placement="top" enterDelay={300} title={<MatchTip item={item} locales={locales} />}>
            <div
                className={classes.tile + (item.isSelf ? " self" : "") + (openable ? "" : " inert")}
                data-self={item.isSelf ? "" : undefined}
                style={{ width }}
                role={openable ? "link" : undefined}
                tabIndex={openable ? 0 : undefined}
                aria-label={openable ? (item.title ? item.title + " — " : "") + "@" + item.author : undefined}
                onClick={open}
                onKeyDown={openable ? activateOnKey(open) : undefined}
            >
                <div className={classes.tileBox} style={{ height: TILE_H }}>
                    {reveal && item.src ? (
                        <img src={item.src} alt={item.title || ""} decoding="async" draggable={false}
                             onLoad={done} onError={done} className={imgClass} style={delay} />
                    ) : null}
                    {reveal && !item.src ? <BrokenImageRounded className={classes.noImage} /> : null}
                    {item.isSelf ? null : <span className={classes.badge + shown} style={delay}>{verdictLabel(item)}</span>}
                </div>
                <div className={classes.caption + shown} style={delay}>
                    <span className={classes.captionAuthor}>@{item.author}</span>
                    <span className={classes.captionMeta}>{meta}</span>
                </div>
            </div>
        </Tooltip>
    );
});

/**
 * The matches as one scrolling row, oldest image first. The row keeps horizontal touch gestures
 * to itself: the drawer's tabs (SwipeableViews, which runs with ignoreNativeScroll) would
 * otherwise read a sideways scroll here as a swipe to the comments.
 */
const MatchRow = React.memo(function MatchRow({ items, classes, reveal, nsfw, locales, lang, onOpen }) {
    const rowRef = useRef(null);
    // Start with this artwork in view: with many earlier matches it would sit off to the right.
    // When it already shows from the start, the row stays where it begins.
    useLayoutEffect(() => {
        const row = rowRef.current;
        const self = row && row.querySelector("[data-self]");
        if (!self || self.offsetLeft + self.offsetWidth <= row.clientWidth - 16) return;
        row.scrollLeft = Math.max(0, self.offsetLeft - (row.clientWidth - self.offsetWidth) / 2);
    }, []);
    return (
        <div ref={rowRef} className={classes.row} role="group" onTouchStart={stopPropagation} onTouchMove={stopPropagation}>
            {items.map((item, i) => (
                <MatchTile key={item.isSelf ? "self" : item.id} item={item} index={i} classes={classes}
                           reveal={reveal} nsfw={nsfw} locales={locales} lang={lang} onOpen={onOpen} />
            ))}
        </div>
    );
});

const IdeaTile = React.memo(function IdeaTile({ item, index, classes, reveal, nsfw, onOpen }) {
    const [loaded, setLoaded] = useState(false);
    const done = useCallback(() => setLoaded(true), []);
    const blurred = item.nsfw && !nsfw;
    const open = useCallback(() => { if (!blurred && onOpen) onOpen(item); }, [blurred, item, onOpen]);
    // the columns are ~110–135 px wide: at or under that the artwork is enlarged
    const imgClass = classes.tileImg + (loaded ? " loaded" : "")
        + (item.width > 0 && item.width <= 128 ? " pixelated" : "")
        + (blurred ? " nsfw" : "");
    const tip = (
        <React.Fragment>
            {item.title ? <span style={TIP_TITLE}>{item.title}</span> : null}
            <span style={TIP_LINE}>@{item.author}</span>
        </React.Fragment>
    );
    return (
        <Tooltip arrow placement="top" enterDelay={300} title={tip}>
            <div className={classes.cell} style={{ aspectRatio: "1 / " + cellRatio(item) }} role="link" tabIndex={0}
                 aria-label={(item.title ? item.title + " — " : "") + "@" + item.author}
                 onClick={open} onKeyDown={activateOnKey(open)}>
                {reveal ? (
                    <img src={item.src} alt={item.title || ""} decoding="async" draggable={false}
                         onLoad={done} onError={done} className={imgClass} style={{ animationDelay: stagger(index) }} />
                ) : null}
            </div>
        </Tooltip>
    );
});

const IdeaGrid = React.memo(function IdeaGrid({ items, classes, reveal, nsfw, onOpen }) {
    const cols = useMemo(() => distribute(items, COLUMNS), [items]);
    return (
        <div className={classes.grid}>
            {cols.map((col, c) => (
                <div key={c} className={classes.column}>
                    {col.map(({ item, index }) => (
                        <IdeaTile key={item.id} item={item} index={index} classes={classes} reveal={reveal} nsfw={nsfw} onOpen={onOpen} />
                    ))}
                </div>
            ))}
        </div>
    );
});

function IdeaSkeleton({ classes }) {
    return (
        <div className={classes.grid} aria-hidden="true">
            {SKELETON.map((col, c) => (
                <div key={c} className={classes.column}>
                    {col.map((r, i) => <div key={i} className={classes.cell + " " + classes.skeleton} style={{ aspectRatio: "1 / " + r }} />)}
                </div>
            ))}
        </div>
    );
}

// ── the section ───────────────────────────────────────────────────────────────

function PostOriginality({ classes, author, permlink, nsfw, locales, onOpenArtwork, onOpenAuthor }) {
    const lang = useLanguage();
    const rootRef = useRef(null);
    const mounted = useRef(true);
    useEffect(() => () => { mounted.current = false; }, []);

    const [visible, setVisible] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [data, setData] = useState(null);

    const [matchesOpen, setMatchesOpen] = useState(false);
    const [matchesMounted, setMatchesMounted] = useState(false);
    const [matchesEntered, setMatchesEntered] = useState(false);

    const [ideasOpen, setIdeasOpen] = useState(false);
    const [ideasEntered, setIdeasEntered] = useState(false);
    const [similar, setSimilar] = useState(null); // null | { status: "loading" | "ready" | "error", items }

    // Ask the Worker only once the section is (nearly) on screen: most views never scroll here.
    useEffect(() => {
        if (visible) return undefined;
        const el = rootRef.current;
        if (!el || typeof IntersectionObserver === "undefined") { setVisible(true); return undefined; }
        const io = new IntersectionObserver((entries) => {
            for (let i = 0; i < entries.length; i++) {
                if (entries[i].isIntersecting) { io.disconnect(); setVisible(true); return; }
            }
        }, { rootMargin: "160px 0px" });
        io.observe(el);
        return () => io.disconnect();
    }, [visible]);

    useEffect(() => {
        if (!visible) return undefined;
        let cancelled = false;
        fetchOriginality(author, permlink).then((r) => { if (!cancelled) setData(r); });
        return () => { cancelled = true; };
    }, [visible, author, permlink, attempt]);

    const retry = useCallback(() => { setData(null); setAttempt((n) => n + 1); }, []);

    const self = data ? data.self : null;
    const matches = data ? data.matches : null;
    const items = useMemo(() => (self && matches && matches.length ? timeline(self, matches) : null), [self, matches]);

    const toggleMatches = useCallback(() => {
        setMatchesMounted(true);
        setMatchesOpen((o) => !o);
    }, []);
    const onMatchesEntered = useCallback(() => setMatchesEntered(true), []);

    // Inspiration: fetched on the first reveal (once the artwork's id is known), never before.
    const selfId = self ? self.id : 0;
    const exclude = useMemo(() => (matches ? matches.map((m) => m.id) : []), [matches]);
    const loadSimilar = useCallback(() => {
        if (!selfId) return;
        setSimilar({ status: "loading", items: null });
        fetchSimilar(selfId, { nsfw: !!nsfw, exclude }).then((list) => {
            if (!mounted.current) return;
            setSimilar(list ? { status: "ready", items: list } : { status: "error", items: null });
        });
    }, [selfId, nsfw, exclude]);
    useEffect(() => {
        if (ideasOpen && selfId && !similar) loadSimilar();
    }, [ideasOpen, selfId, similar, loadSimilar]);
    const toggleIdeas = useCallback(() => setIdeasOpen((o) => !o), []);
    const onIdeasEntered = useCallback(() => setIdeasEntered(true), []);

    // ── status line ──
    let icon, title, body = null, warn = false;
    const status = data ? data.status : null;
    if (!data) {
        icon = <CircularProgress size={20} thickness={4} className={classes.spinner} />;
        title = t(NS + "checking");
    } else if (status === ORIGINALITY.FAKE) {
        warn = true;
        icon = <WarningRounded />;
        title = t(NS + "fake_title");
        const name = data.source.author;
        const who = (
            <span className={classes.author} role="link" tabIndex={0}
                  onClick={() => onOpenAuthor && onOpenAuthor(name)}
                  onKeyDown={activateOnKey(() => onOpenAuthor && onOpenAuthor(name))}>@{name}</span>
        );
        body = <T k={NS + (data.identical ? "fake_identical_body" : "fake_copy_body")} vars={{ author: who }} />;
    } else if (status === ORIGINALITY.UNDETERMINED) {
        icon = <HelpOutlineRounded />;
        title = t(NS + "undetermined_title");
        body = t(NS + "undetermined_body");
    } else if (status === ORIGINALITY.COPIED) {
        icon = <VerifiedUserRounded />;
        title = t(NS + "copied_title");
        body = t(NS + "copied_body");
    } else if (status === ORIGINALITY.ORIGINAL || status === ORIGINALITY.POSSIBLE || status === ORIGINALITY.REPOSTED) {
        icon = <VerifiedUserRounded />;
        title = t(NS + "original_title");
        body = t(NS + (status === ORIGINALITY.ORIGINAL ? "original_body" : status === ORIGINALITY.POSSIBLE ? "possible_body" : "reposted_body"));
    } else if (status === ORIGINALITY.PENDING) {
        icon = <HourglassEmptyRounded />;
        title = t(NS + "pending_title");
        body = t(NS + "pending_body");
    } else {
        icon = <InfoOutlined />;
        title = t(NS + "unavailable_title");
        body = (
            <span className={classes.link} role="button" tabIndex={0} onClick={retry} onKeyDown={activateOnKey(retry)}>
                {t(NS + "retry")}
            </span>
        );
    }

    // ── inspiration body ──
    let ideas = null;
    if (ideasOpen || ideasEntered) {
        if (data && !selfId && status === ORIGINALITY.UNAVAILABLE) {
            // The Worker did not answer for the artwork itself: its neighbours cannot be asked.
            ideas = (
                <div className={classes.note}>
                    {t(NS + "inspiration_error")}{" "}
                    <span className={classes.link} role="button" tabIndex={0} onClick={retry} onKeyDown={activateOnKey(retry)}>
                        {t(NS + "retry")}
                    </span>
                </div>
            );
        } else if (data && !selfId) {
            ideas = <div className={classes.note}>{t(NS + "inspiration_unindexed")}</div>;
        } else if (!similar || similar.status === "loading") {
            ideas = <IdeaSkeleton classes={classes} />;
        } else if (similar.status === "error") {
            ideas = (
                <div className={classes.note}>
                    {t(NS + "inspiration_error")}{" "}
                    <span className={classes.link} role="button" tabIndex={0} onClick={loadSimilar} onKeyDown={activateOnKey(loadSimilar)}>
                        {t(NS + "retry")}
                    </span>
                </div>
            );
        } else if (!similar.items.length) {
            ideas = <div className={classes.note}>{t(NS + "no_inspiration")}</div>;
        } else {
            ideas = <IdeaGrid items={similar.items} classes={classes} reveal={ideasEntered} nsfw={!!nsfw} onOpen={onOpenArtwork} />;
        }
    }

    return (
        <div ref={rootRef} className={classes.root}>
            <ListSubheader disableSticky>{t(NS + "originality")}</ListSubheader>
            <div role="status" aria-live="polite">
                <ListItem className={classes.status + (warn ? " " + classes.warn : "")}>
                    <ListItemIcon className={classes.statusIcon}>{icon}</ListItemIcon>
                    <ListItemText primary={title} secondary={body} />
                </ListItem>
            </div>
            {items ? (
                <React.Fragment>
                    <ListItem button onClick={toggleMatches} aria-expanded={matchesOpen} className={classes.reveal}>
                        <ListItemIcon><CollectionsRounded /></ListItemIcon>
                        <ListItemText primary={matchesOpen ? t(NS + "hide_matches") : t(NS + "show_matches", { count: data.truncated ? matches.length + "+" : matches.length })} />
                        <ExpandMoreRounded className={classes.chevron + (matchesOpen ? " open" : "")} />
                    </ListItem>
                    <Collapse in={matchesOpen} timeout={COLLAPSE_TIMEOUT} onEntered={onMatchesEntered}>
                        {matchesMounted ? (
                            <MatchRow items={items} classes={classes} reveal={matchesEntered} nsfw={!!nsfw}
                                      locales={locales} lang={lang} onOpen={onOpenArtwork} />
                        ) : null}
                    </Collapse>
                </React.Fragment>
            ) : null}

            <ListSubheader disableSticky>{t(NS + "inspiration")}</ListSubheader>
            <ListItem button onClick={toggleIdeas} aria-expanded={ideasOpen} className={classes.reveal}>
                <ListItemIcon><EmojiObjectsRounded /></ListItemIcon>
                <ListItemText primary={ideasOpen ? t(NS + "hide_inspiration") : t(NS + "show_inspiration")} />
                <ExpandMoreRounded className={classes.chevron + (ideasOpen ? " open" : "")} />
            </ListItem>
            <Collapse in={ideasOpen} timeout={COLLAPSE_TIMEOUT} onEntered={onIdeasEntered}>
                {ideas}
            </Collapse>
        </div>
    );
}

// Strictly greyscale, like the rest of the drawer: the warning is told by its icon, a brighter
// line and a faint plate behind it (the same treatment as the login dialog's warnings).
const styles = {
    root: {
        paddingBottom: 8,
    },
    status: {
        alignItems: "flex-start",
        borderRadius: 21,
        "& .MuiListItemText-secondary": {
            color: "rgba(255, 255, 255, 0.5)",
            lineHeight: 1.4,
        },
    },
    statusIcon: {
        marginTop: 6,
    },
    warn: {
        backgroundColor: "rgba(250, 250, 250, 0.06)",
        "& $statusIcon": { color: "#e1e1e1" },
        "& .MuiListItemText-secondary": { color: "#c8c8c8" },
    },
    spinner: {
        color: "#666",
        marginLeft: 2,
    },
    author: {
        color: "#fff",
        cursor: "pointer",
        outline: "none",
        "&:hover, &:focus-visible": { textDecoration: "underline" },
    },
    link: {
        color: "#ddd",
        cursor: "pointer",
        textDecoration: "underline",
        outline: "none",
        "&:hover, &:focus-visible": { color: "#fff" },
    },
    reveal: {
        cursor: "pointer",
    },
    chevron: {
        color: "#666",
        marginLeft: 8,
        flexShrink: 0,
        transition: "transform 240ms cubic-bezier(0.4, 0, 0.2, 1)",
        "&.open": { transform: "rotate(180deg)" },
    },
    note: {
        padding: "4px 16px 16px 72px",
        fontSize: 14,
        lineHeight: 1.4,
        color: "rgba(255, 255, 255, 0.5)",
    },
    // matches row
    row: {
        position: "relative",
        display: "flex",
        gap: 12,
        overflowX: "auto",
        overflowY: "hidden",
        padding: "8px 16px 14px 16px",
        scrollSnapType: "x proximity",
        overscrollBehaviorX: "contain",
        scrollbarWidth: "thin",
        scrollbarColor: "#3a3a3a transparent",
        "&::-webkit-scrollbar": { height: 6 },
        "&::-webkit-scrollbar-track": { background: "transparent" },
        "&::-webkit-scrollbar-thumb": { background: "#3a3a3a", borderRadius: 3 },
        "&::-webkit-scrollbar-thumb:hover": { background: "#555" },
    },
    tile: {
        flex: "0 0 auto",
        scrollSnapAlign: "start",
        cursor: "pointer",
        outline: "none",
        "&.self, &.inert": { cursor: "default" },
        "&.self $tileBox": { boxShadow: "0 0 0 2px #e1e1e1" },
        "&:focus-visible $tileBox": { boxShadow: "0 0 0 2px #fff" },
        "&:hover $tileImg.loaded": { transform: "scale(1.04)" },
    },
    tileBox: {
        position: "relative",
        width: "100%",
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: "#161616",
    },
    noImage: {
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        color: "#3a3a3a",
    },
    tileImg: {
        display: "block",
        width: "100%",
        height: "100%",
        objectFit: "contain",
        userSelect: "none",
        opacity: 0,
        transition: "transform 220ms cubic-bezier(0.4, 0, 0.2, 1)",
        "&.loaded": { animation: "$fadeIn 460ms cubic-bezier(0.2, 0.9, 0.3, 1) both" },
        "&.pixelated": { imageRendering: "pixelated" },
        "&.nsfw": { filter: "blur(10px)" },
    },
    badge: {
        position: "absolute",
        top: 5,
        left: 5,
        maxWidth: "calc(100% - 10px)",
        padding: "1px 6px",
        borderRadius: 10,
        backgroundColor: "rgba(0, 0, 0, 0.72)",
        color: "#e1e1e1",
        fontFamily: '"Industry Book", "Normative Pro"',
        fontSize: 10,
        lineHeight: "14px",
        letterSpacing: 0.2,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        pointerEvents: "none",
        opacity: 0,
        "&.loaded": { animation: "$fadeIn 460ms cubic-bezier(0.2, 0.9, 0.3, 1) both" },
    },
    caption: {
        marginTop: 6,
        opacity: 0,
        "&.loaded": { animation: "$rise 460ms cubic-bezier(0.2, 0.9, 0.3, 1) both" },
    },
    captionAuthor: {
        display: "block",
        fontSize: 12,
        lineHeight: "16px",
        color: "#ddd",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    captionMeta: {
        display: "block",
        fontSize: 11,
        lineHeight: "15px",
        color: "#7a7a7a",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    // inspiration masonry
    grid: {
        display: "flex",
        gap: 8,
        alignItems: "flex-start",
        padding: "8px 16px 16px 16px",
    },
    column: {
        flex: "1 1 0",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 8,
    },
    cell: {
        position: "relative",
        width: "100%",
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: "#161616",
        cursor: "pointer",
        outline: "none",
        "&:focus-visible": { boxShadow: "0 0 0 2px #fff" },
        "&:hover $tileImg.loaded": { transform: "scale(1.04)" },
    },
    skeleton: {
        cursor: "default",
        animation: "$pulse 1.4s ease-in-out infinite",
    },
    "@keyframes fadeIn": {
        "0%": { opacity: 0 },
        "100%": { opacity: 1 },
    },
    "@keyframes rise": {
        "0%": { opacity: 0, transform: "translateY(4px)" },
        "100%": { opacity: 1, transform: "none" },
    },
    "@keyframes pulse": {
        "0%": { opacity: 0.55 },
        "50%": { opacity: 1 },
        "100%": { opacity: 0.55 },
    },
};

export default React.memo(withStyles(styles)(PostOriginality));
