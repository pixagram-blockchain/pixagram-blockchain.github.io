import * as React from "preact/compat";
import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef, memo } from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import Dialog from "@material-ui/core/Dialog";
import Fade from "@material-ui/core/Fade";
import Slide from "@material-ui/core/Slide";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import Button from "@material-ui/core/Button";
import Tooltip from "@material-ui/core/Tooltip";
import CircularProgress from "@material-ui/core/CircularProgress";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import FilledInput from "@material-ui/core/FilledInput";
import InputAdornment from "@material-ui/core/InputAdornment";
import CloseIcon from "@material-ui/icons/Close";
import CloudDownload from "@material-ui/icons/CloudDownload";
import BrokenImageRounded from "@material-ui/icons/BrokenImageRounded";
import * as clipboard from "clipboard-polyfill";
import ClipboardText from "../icons/ClipboardText";
import ClipboardCheck from "../icons/ClipboardCheck";
import * as actions from "../actions/utils";
import { buildPostUrl } from "../utils/constants";
import { watermarkedRatio, artworkFraction, BAND_SKELETON } from "../utils/shareArtwork";
import { t, useLanguage } from "../utils/text";

/* ══════════════════════════════════════════════════════════════════════
 * ShareArtworkDialog — "share your creation", after an artwork is published.
 *
 * Mounted by Index (§9f), which starts the share image the moment the
 * post's broadcast succeeds and opens this dialog a few seconds after the
 * publish animation. It shows the artwork as it will be shared — rendered
 * with the viewer's renderer and stamped with the wordmark + license band
 * (utils/shareArtworkRender) — or, while that is still being made, a
 * skeleton of the file's exact shape: the artwork's proportions plus the
 * band, with the band's wordmark and license where they will land
 * (utils/shareArtwork). A download button sits on the image's top-right
 * corner; below it, the post's link with a copy button, as in PostDialog.
 * Full screen on mobile.
 *
 * Props
 *   open, onClose, onExited   the dialog; onExited after its closing transition
 *   post                      { author, permlink, category, tags, title }
 *   image                     the utils/shareArtworkRender snapshot
 *   fullScreen                Index's compact layout
 *   onRetry                   makes the image again after a failure
 * ══════════════════════════════════════════════════════════════════════ */

const TITLE_ID = "share-artwork-title";
const LEAD_ID = "share-artwork-lead";
const URL_FIELD_ID = "share-artwork-url";

// The floating dialog's image box: at most this share of the window's
// height, and this many px — and what the dialog has left (its paper keeps
// PAPER_MARGIN_PX from the window's edges), but no less than STAGE_MIN_PX.
// Full screen, it takes the room the rest leaves.
const STAGE_MAX_SHARE = 0.56;
const STAGE_MAX_PX = 520;
const STAGE_MIN_PX = 160;
const PAPER_MARGIN_PX = 16;
// The skeleton stays under the image while it fades in.
const IMAGE_FADE_MS = 320;

const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
const EMPTY_IMAGE = Object.freeze({ status: "preparing", width: 0, height: 0, href: null, type: "", filename: "" });
const URL_INPUT_PROPS = Object.freeze({ spellCheck: false, autoComplete: "off" });

const styles = (theme) => ({
    backdrop: {
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(9px)",
        WebkitBackdropFilter: "blur(9px)",
    },
    paper: {
        width: "100%",
        maxWidth: 560,
        margin: PAPER_MARGIN_PX,
        maxHeight: `calc(100% - ${2 * PAPER_MARGIN_PX}px)`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        color: "#fff",
        backgroundColor: "#101010",
        backgroundImage: "none",
        borderRadius: 32,
        boxShadow: "0px 0px 16px 8px #00000070",
    },
    paperFullScreen: {
        width: "100%",
        maxWidth: "none",
        height: "100%",
        maxHeight: "none",
        margin: 0,
        borderRadius: 0,
        boxShadow: "none",
    },
    header: {
        flex: "0 0 auto",
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "24px 16px 12px 28px",
        [theme.breakpoints.down("sm")]: {
            padding: "calc(12px + env(safe-area-inset-top, 0px)) 8px 8px 20px",
        },
    },
    title: {
        flex: "1 1 auto",
        minWidth: 0,
        margin: "10px 0 0 0",
        fontFamily: '"Industry Book", "Normative Pro"',
        fontWeight: "bold",
        fontSize: "1.4rem",
        lineHeight: 1.25,
        color: "#fff",
        [theme.breakpoints.down("sm")]: {
            fontSize: "1.2rem",
            marginTop: 11,
        },
    },
    close: {
        flex: "0 0 auto",
        color: "#8a8a8a",
        transition: `color 150ms ${EASE}, background-color 150ms ${EASE}`,
        "&:hover": { color: "#fff", backgroundColor: "rgba(255, 255, 255, 0.06)" },
    },
    body: {
        flex: "1 1 auto",
        minHeight: 0,
        overflowY: "auto",
        overscrollBehavior: "contain",
        display: "flex",
        flexDirection: "column",
        gap: 20,
        padding: "8px 28px 28px",
        [theme.breakpoints.down("sm")]: {
            gap: 16,
            padding: "4px 20px calc(20px + env(safe-area-inset-bottom, 0px))",
        },
    },
    lead: {
        margin: 0,
        fontWeight: "bold",
        fontSize: "1rem",
        lineHeight: 1.45,
        color: "#d6d6d6",
    },
    // Floating: as tall as the image. Full screen: whatever the rest leaves
    // (but never so little the image turns into a stamp — the body scrolls).
    stage: {
        position: "relative",
        flex: "0 0 auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        [theme.breakpoints.down("sm")]: {
            flex: "1 1 0px",
            minHeight: 220,
        },
    },
    frame: {
        position: "relative",
        flex: "0 0 auto",
        overflow: "hidden",
        borderRadius: 16,
        backgroundColor: "#141414",
        // keeps the rounded clip over the shimmer layer in Safari
        isolation: "isolate",
    },

    // ── Skeleton: the file's shape before the file exists ────────────────
    skeleton: {
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        // One sweep across the whole frame (MUI's wave timing), so artwork
        // and band shimmer as one piece.
        "&::after": {
            content: "''",
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "linear-gradient(100deg, rgba(255, 255, 255, 0) 30%, rgba(255, 255, 255, 0.07) 50%, rgba(255, 255, 255, 0) 70%)",
            transform: "translateX(-100%)",
            animation: "$shareSkeletonWave 1.6s linear 0.5s infinite",
            "@media (prefers-reduced-motion: reduce)": {
                animation: "none",
                display: "none",
            },
        },
    },
    skeletonStill: {
        "&::after": { animation: "none", display: "none" },
    },
    "@keyframes shareSkeletonWave": {
        "0%": { transform: "translateX(-100%)" },
        "60%": { transform: "translateX(100%)" },
        "100%": { transform: "translateX(100%)" },
    },
    band: {
        position: "absolute",
        left: 0,
        width: "100%",
    },
    bone: {
        position: "absolute",
        backgroundColor: "#1f1f1f",
    },
    boneOn: {
        backgroundColor: "#2a2a2a",
    },

    // ── The image ────────────────────────────────────────────────────────
    image: {
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        display: "block",
        objectFit: "contain",
        opacity: 0,
        transition: `opacity ${IMAGE_FADE_MS}ms ${EASE}`,
    },
    imageShown: {
        opacity: 1,
    },

    // ── Download: black disc, white icon, on the image's top-right corner ─
    download: {
        position: "absolute",
        top: 12,
        right: 12,
        zIndex: 2,
    },
    downloadAnchor: {
        position: "relative",
        display: "inline-flex",
    },
    downloadButton: {
        color: "#fff",
        backgroundColor: "#000",
        boxShadow: "0 2px 10px rgba(0, 0, 0, 0.5)",
        transition: `background-color 150ms ${EASE}, color 150ms ${EASE}`,
        "&:hover": { backgroundColor: "#1c1c1c" },
        // MUI clears the hover fill on touch screens: keep the disc black
        "@media (hover: none)": {
            "&:hover": { backgroundColor: "#000" },
        },
        "&.Mui-disabled": {
            color: "rgba(255, 255, 255, 0.5)",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
        },
    },
    // The image still being made: a ring around the button, as on
    // PostDialog's download.
    downloadProgress: {
        position: "absolute",
        top: -4,
        left: -4,
        color: "#fff",
        pointerEvents: "none",
    },

    // ── Failure ──────────────────────────────────────────────────────────
    failed: {
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 24,
        textAlign: "center",
        backgroundColor: "rgba(16, 16, 16, 0.6)",
    },
    failedIcon: {
        fontSize: 44,
        color: "#666",
    },
    failedText: {
        margin: 0,
        maxWidth: 280,
        fontSize: 14,
        lineHeight: 1.5,
        color: "#bbb",
    },
    retry: {
        borderRadius: 999,
        padding: "6px 22px",
        textTransform: "none",
        fontSize: 14,
        color: "#101010",
        backgroundColor: "#fff",
        "&:hover": { backgroundColor: "#e0e0e0" },
        "@media (hover: none)": {
            "&:hover": { backgroundColor: "#fff" },
        },
    },

    // ── The link ─────────────────────────────────────────────────────────
    urlField: {
        flex: "0 0 auto",
        "& input": { textOverflow: "ellipsis" },
    },
});

// The post's link, as shared: this origin + the post's path.
function postUrlOf(post) {
    if (!post || !post.author || !post.permlink) return "";
    const path = buildPostUrl({
        category: post.category,
        tags: post.tags,
        author: { username: post.author },
        permlink: post.permlink,
    });
    if (!path) return "";
    const origin = (typeof window !== "undefined" && window.location && window.location.origin) || "";
    return origin + path;
}

function selectAll(input) {
    if (!input) return;
    try { input.setSelectionRange(0, String(input.value || "").length); } catch (e) { /* not selectable */ }
}

// A link that's focused is a link about to be copied by hand.
const selectOnFocus = (event) => selectAll(event && event.target);

/* The image box: the file's proportions, as large as the stage allows — its
 * width always; its height when full screen (the stage takes the room the
 * rest leaves), otherwise a share of the window, and never more than the
 * dialog has left once its other content is in: an image that overflowed
 * would bring a scrollbar, the scrollbar would narrow the stage, the image
 * would shrink back and the scrollbar go — and round again (classic
 * scrollbars). Measured, not left to CSS: fitting both ways at a fixed ratio
 * needs the stage's height, which CSS can't read without container
 * queries. */
function useFitBox(stageRef, ratio, fillHeight) {
    const [box, setBox] = useState(null);
    useLayoutEffect(() => {
        const stage = stageRef.current;
        if (!stage) return undefined;
        let raf = 0;
        const floatingRoom = () => {
            const body = stage.parentElement;
            const header = body && body.previousElementSibling;
            if (!body || !header) return Infinity;
            const rest = header.offsetHeight + (body.scrollHeight - stage.offsetHeight);
            return window.innerHeight - 2 * PAPER_MARGIN_PX - rest;
        };
        const measure = () => {
            raf = 0;
            const availWidth = stage.clientWidth;
            const availHeight = fillHeight
                ? stage.clientHeight
                : Math.max(STAGE_MIN_PX, Math.min(window.innerHeight * STAGE_MAX_SHARE, STAGE_MAX_PX, floatingRoom()));
            if (!(availWidth > 0) || !(availHeight > 0)) return;
            const width = Math.floor(Math.min(availWidth, availHeight * ratio));
            const height = Math.floor(width / ratio);
            setBox((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
        };
        const schedule = () => {
            if (!raf) raf = requestAnimationFrame(measure);
        };
        measure();
        let observer = null;
        if (typeof ResizeObserver !== "undefined") {
            observer = new ResizeObserver(schedule);
            observer.observe(stage);
            // the rest of the dialog settling (fonts, wrapping) changes the room
            if (stage.parentElement) observer.observe(stage.parentElement);
        }
        window.addEventListener("resize", schedule);
        return () => {
            if (observer) observer.disconnect();
            window.removeEventListener("resize", schedule);
            if (raf) cancelAnimationFrame(raf);
        };
    }, [stageRef, ratio, fillHeight]);
    return box;
}

/* The file's shape before the file exists: the artwork's rectangle, then the
 * band with the wordmark (panel, logo tile, title, rainbow rule, tagline) and
 * the license (card, badge, label, name plate) where utils/watermark will
 * draw them. Percentages throughout, so it fits any frame size. */
const ShareSkeleton = memo(function ShareSkeleton({ classes, artFraction, still }) {
    const art = (artFraction * 100).toFixed(3) + "%";
    const band = ((1 - artFraction) * 100).toFixed(3) + "%";
    return (
        <div className={still ? classes.skeleton + " " + classes.skeletonStill : classes.skeleton} aria-hidden="true">
            <div className={classes.bone} style={{ top: 0, left: 0, width: "100%", height: art }} />
            <div className={classes.band} style={{ top: art, height: band }}>
                {BAND_SKELETON.map((bone, i) => (
                    <div key={i} className={bone.tone ? classes.bone + " " + classes.boneOn : classes.bone} style={bone.style} />
                ))}
            </div>
        </div>
    );
});

const ShareContent = memo(function ShareContent({ classes, post, image, fullScreen, onClose, onRetry }) {
    useLanguage();

    // ── The image box ────────────────────────────────────────────────────
    const ratio = watermarkedRatio(image.width, image.height);
    const artFraction = artworkFraction(image.width, image.height);
    const stageRef = useRef(null);
    const box = useFitBox(stageRef, ratio, fullScreen);
    // Until measured (the first frame), CSS keeps the proportions.
    const frameStyle = box
        ? { width: box.width, height: box.height }
        : { width: "100%", maxWidth: Math.round(STAGE_MAX_PX * ratio), aspectRatio: String(ratio) };

    // ── The image: ready → loading → shown (skeleton gone) ───────────────
    const href = image.status === "ready" ? image.href : null;
    const [loadedHref, setLoadedHref] = useState(null);
    const [shownHref, setShownHref] = useState(null);
    const [brokenHref, setBrokenHref] = useState(null);
    const broken = !!href && brokenHref === href;
    const ready = !!href && !broken;
    const loaded = ready && loadedHref === href;
    const shown = loaded && shownHref === href;
    const failed = image.status === "failed" || broken;
    const preparing = !failed && !ready;

    const onImageLoad = useCallback(() => setLoadedHref(href), [href]);
    const onImageError = useCallback(() => setBrokenHref(href), [href]);
    useEffect(() => {
        if (!loaded) return undefined;
        const timer = setTimeout(() => setShownHref(href), IMAGE_FADE_MS + 60);
        return () => clearTimeout(timer);
    }, [loaded, href]);

    // Within the click itself: the file is already made, so the browser
    // still counts the download as the user's own (see PostDialog's
    // tap-to-save overlay for what happens otherwise).
    const filename = image.filename;
    const download = useCallback(() => {
        if (!ready) return;
        const a = document.createElement("a");
        a.href = href;
        a.download = filename || "Pixagram_Artwork";
        a.rel = "noopener";
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }, [ready, href, filename]);

    // ── The link (PostDialog's share field) ──────────────────────────────
    const url = useMemo(() => postUrlOf(post), [post]);
    const [copied, setCopied] = useState(false);
    const copiedTimerRef = useRef(0);
    useEffect(() => () => clearTimeout(copiedTimerRef.current), []);
    const copy = useCallback(() => {
        if (!url) return;
        let writing;
        try { writing = Promise.resolve(clipboard.writeText(url)); } catch (e) { writing = Promise.reject(e); }
        writing.then(() => {
            setCopied(true);
            actions.trigger_snackbar(t("words.link_copied_to_clipboard"));
            clearTimeout(copiedTimerRef.current);
            copiedTimerRef.current = setTimeout(() => setCopied(false), 5000);
        }, () => {
            // The clipboard said no: leave the link selected for a manual copy.
            const input = document.getElementById(URL_FIELD_ID);
            if (input) { input.focus(); selectAll(input); }
        });
    }, [url]);

    const downloadLabel = ready
        ? t("components.share_artwork_dialog.download_the_image")
        : t("components.share_artwork_dialog.preparing_your_image");
    const copyLabel = t("components.share_artwork_dialog.copy_the_link_to_the_clipboard");

    return (
        <React.Fragment>
            <div className={classes.header}>
                <Typography id={TITLE_ID} component="h2" className={classes.title}>
                    {t("components.share_artwork_dialog.share_your_creation_on_the_web")}
                </Typography>
                <IconButton aria-label={t("words.close")} className={classes.close} onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </div>
            <div className={classes.body}>
                <Typography id={LEAD_ID} component="p" className={classes.lead}>
                    {t("components.share_artwork_dialog.congratulations_share_your_artwork_with_your_friends")}
                </Typography>

                <div ref={stageRef} className={classes.stage}>
                    <div className={classes.frame} style={frameStyle} aria-busy={preparing ? "true" : "false"}>
                        {!shown && <ShareSkeleton classes={classes} artFraction={artFraction} still={failed} />}
                        {ready && (
                            <img
                                key={href}
                                src={href}
                                alt={post.title || ""}
                                decoding="async"
                                className={loaded ? classes.image + " " + classes.imageShown : classes.image}
                                onLoad={onImageLoad}
                                onError={onImageError}
                            />
                        )}
                        {failed ? (
                            <div className={classes.failed} role="alert">
                                <BrokenImageRounded className={classes.failedIcon} />
                                <Typography component="p" className={classes.failedText}>
                                    {t("components.share_artwork_dialog.your_image_could_not_be_prepared")}
                                </Typography>
                                {onRetry ? (
                                    <Button className={classes.retry} onClick={onRetry}>
                                        {t("components.share_artwork_dialog.try_again")}
                                    </Button>
                                ) : null}
                            </div>
                        ) : (
                            <div className={classes.download}>
                                <Tooltip title={downloadLabel}>
                                    <span className={classes.downloadAnchor}>
                                        <IconButton
                                            aria-label={downloadLabel}
                                            className={classes.downloadButton}
                                            disabled={!ready}
                                            onClick={download}
                                        >
                                            <CloudDownload />
                                        </IconButton>
                                        {preparing && (
                                            <CircularProgress size={56} thickness={3} className={classes.downloadProgress} />
                                        )}
                                    </span>
                                </Tooltip>
                            </div>
                        )}
                    </div>
                </div>

                <FormControl className={classes.urlField} variant="filled" fullWidth>
                    <InputLabel htmlFor={URL_FIELD_ID}>
                        {t("components.share_artwork_dialog.link_to_your_artwork")}
                    </InputLabel>
                    <FilledInput
                        id={URL_FIELD_ID}
                        type="text"
                        fullWidth
                        readOnly
                        value={url}
                        onFocus={selectOnFocus}
                        inputProps={URL_INPUT_PROPS}
                        endAdornment={
                            <InputAdornment position="end">
                                <Tooltip title={copyLabel}>
                                    <IconButton
                                        aria-label={copyLabel}
                                        onClick={copy}
                                        edge="end"
                                    >
                                        {copied ? <ClipboardCheck /> : <ClipboardText />}
                                    </IconButton>
                                </Tooltip>
                            </InputAdornment>
                        }
                    />
                </FormControl>
            </div>
        </React.Fragment>
    );
});

function ShareArtworkDialog({ classes, open, post, image, fullScreen, onClose, onExited, onRetry }) {
    const dialogClasses = useMemo(
        () => ({ paper: classes.paper, paperFullScreen: classes.paperFullScreen }),
        [classes],
    );
    const backdropProps = useMemo(() => ({ classes: { root: classes.backdrop } }), [classes]);
    // Full screen it slides up like a sheet; floating it fades, as dialogs do.
    // The choice is made as the dialog opens and kept until it has closed:
    // a transition swapped mid-way (a rotation across the breakpoint) mounts
    // already closed, never calls onExited, and the Modal's invisible layer
    // would stay over the app.
    const shown = !!open && !!post;
    const slideRef = useRef(!!fullScreen);
    const wasShownRef = useRef(false);
    if (shown && !wasShownRef.current) slideRef.current = !!fullScreen;
    wasShownRef.current = shown;
    const slide = slideRef.current;
    // (Slide's `direction` must not reach Fade: Fade hands unknown props on
    // to the DOM.)
    const transitionProps = useMemo(
        () => (slide ? { direction: "up", onExited } : { onExited }),
        [slide, onExited],
    );
    return (
        <Dialog
            open={shown}
            onClose={onClose}
            fullScreen={!!fullScreen}
            maxWidth={false}
            scroll="paper"
            TransitionComponent={slide ? Slide : Fade}
            TransitionProps={transitionProps}
            BackdropProps={backdropProps}
            classes={dialogClasses}
            aria-labelledby={TITLE_ID}
            aria-describedby={LEAD_ID}
            data-share-artwork="true"
        >
            {post ? (
                <ShareContent
                    classes={classes}
                    post={post}
                    image={image || EMPTY_IMAGE}
                    fullScreen={!!fullScreen}
                    onClose={onClose}
                    onRetry={onRetry}
                />
            ) : null}
        </Dialog>
    );
}

export default withStyles(styles)(memo(ShareArtworkDialog));
