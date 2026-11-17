// ============================================================================
// pixel-editor/PixelEditorDialog.js — the pixel editor, full screen
//
// Opened by "Open editor" in NewPost (Adjust step) and in ImageWizard (Adjust
// phase) with the picture of the moment, and from EditPostDialog with the
// picture a published post shows. Built on the headless editor core
// (utils/pixa-editor): the core owns the document, layers, history and the
// canvas zone; this file is the frame around it, in the app's Material look —
// black, flat, no borders, white for what is on, every region a rounded card
// on its own tone. It fades in.
//
//   top      close · title and size · undo · redo · Done
//   left     tools (a rail from 600 px; a scrolling toolbar on top on phones);
//            the tool in hand picked again opens its options
//   centre   the canvas: pan, zoom, pinch; floating pixels get an action bar
//   tabs     seven panels, with the app's sliding-pill tab bar (BottomBar.js),
//            swiped through in the drawer: along the bottom with the drawer
//            above on phones and upright tablets; on wide screens a column on
//            the right, the drawer over a bar as wide as it, narrowing to
//            upright tabs when closed — or always open where the canvas stays
//            at least square beside it
//   context  right-click, long press, double tap: an expandable ring menu
//   import   images picked in Layers, dropped or pasted on the canvas float
//            over the active layer (pixel art keeps its pixels, enlarged
//            pixel art is scaled back, photos become pixel art)
//
// Props:
//   open      bool
//   image     ImageData — the picture to edit (one layer)
//   project   Uint8Array | null — a project saved by an earlier Done; when
//             given it reopens with its layers instead of `image`
//   onClose   () => void — leave without keeping anything
//   onSave    ({ imageData, project }) => void — Done: the flattened picture
//             (same size, straight RGBA) and the layered project, which can
//             be passed back as `project` to continue later. The parent
//             closes the dialog.
//   onReady   (editor) => void — optional: the editor core once it is ready,
//             for hosts that preset tools or colours (and for tests)
//
// Store builds (the Google Play and App Store apps, utils/store.js): no mature
// picture may be shown or kept there, whichever host opened the editor, so
// the dialog checks pictures itself with utils/storeGate.js: the picture it
// opens on (shown only once checked), an image imported — picked in Layers,
// pasted or dropped on the canvas — (floats in only once checked) and the
// result of Done (handed to onSave only once checked). A refused picture is
// not shown or kept, and a snackbar says why. In the browser none of this
// runs.
// ============================================================================

import * as React from "preact/compat";
import { useState, useEffect, useLayoutEffect, useRef, useCallback, memo } from "preact/compat";
import makeStyles from "@material-ui/core/styles/makeStyles";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Fade from "@material-ui/core/Fade";
import Button from "@material-ui/core/Button";
import ButtonBase from "@material-ui/core/ButtonBase";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";
import CloseIcon from "@material-ui/icons/Close";
import UndoIcon from "@material-ui/icons/Undo";
import RedoIcon from "@material-ui/icons/Redo";
import CheckIcon from "@material-ui/icons/Check";

import { createEditor } from "../../utils/pixa-editor/index.js";
import "../../utils/pixa-editor/view/index.js";
import { useLanguage, subscribe as subscribeLanguage } from "../../utils/text";
import { STORE_GATE, SCREEN, screenPicture, notifyStoreGate, screenPictureOrNotify } from "../../utils/storeGate";

import { tp, layerName } from "./labels";
import { useEditorEvents, documentFromImageData, imageDataFromDocument } from "./editorUtils";
import ToolStrip from "./ToolStrip";
import FloatingBar from "./FloatingBar";
import RadialMenu from "./RadialMenu";
import { Drawer, BottomTabs, SideColumn, TABS, SIDE_WIDTH } from "./BottomBar";
import LayersPanel from "./panels/LayersPanel";
import ColorsPanel from "./panels/ColorsPanel";
import ToolPanel from "./panels/ToolPanel";
import SelectionPanel from "./panels/SelectionPanel";
import EffectsPanel from "./panels/EffectsPanel";
import FiltersPanel from "./panels/FiltersPanel";
import HistoryPanel from "./panels/HistoryPanel";
import { EASE, SURFACE, RADIUS, GAP } from "./ui";

// Memoised: the drawer keeps all seven mounted, and a render of the dialog
// must not repaint the six out of view (they also stop listening, see
// PanelActive). Their `lang` prop changes with the language's strings, so
// they still follow a language change (or its strings landing).
const PANELS = {
    layers: memo(LayersPanel),
    colors: memo(ColorsPanel),
    tool: memo(ToolPanel),
    select: memo(SelectionPanel),
    effects: memo(EffectsPanel),
    filters: memo(FiltersPanel),
    history: memo(HistoryPanel),
};

// The canvas zone, dressed for a black interface. Images pasted or dropped on
// the canvas are only announced ('paste-image' / 'drop-file'): importFile
// brings them in, like the Layers button — checked first in store builds.
const ZONE_OPTIONS = {
    menu: "event",          // RadialMenu draws the context menu
    grid: true,
    paste: "event",
    drop: "event",
    theme: {
        checker: ["#1f1f1f", "#2a2a2a"],
        checkerSize: 8,
        grid: "rgba(0, 0, 0, 0.18)",
        accent: "#ffffff",
        frame: "rgba(0, 0, 0, 0.6)",
    },
};

// Where the drawer opens on the right: wide screens, and phones on their side
// (a bottom drawer would leave them a sliver of canvas).
const SIDE_DRAWER = "(min-width:960px), (min-width:600px) and (max-height:520px)";
// Where the side drawer may stay pinned open: desktop-sized windows (a phone
// on its side keeps the drawer it can close, for the canvas' sake).
const DESKTOP = "(min-width:960px) and (min-height:521px)";

// The canvas makes its entrance (a fade and a little bounce) this long after the
// editor opens, as the dialog's own fade (280 ms) ends — or at once, if the
// picture took longer to load.
const INTRO_AFTER = 200;

// Tools whose strength matters before the first click: picking one on a wide
// screen opens the Tool panel at its tolerance.
const MAGIC_TOOLS = new Set(["select-area", "select-color"]);

const IMAGE_FILE = /\.(png|gif|webp|jpe?g|bmp|avif|ico)$/i;
const NOTICE_MS = 4500;

const useStyles = makeStyles({
    paper: {
        backgroundColor: `${SURFACE.page} !important`,
        color: "#eeeeee",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        paddingTop: "env(safe-area-inset-top, 0px)",
    },
    top: {
        flex: "0 0 auto",
        height: 56,
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "0 8px 0 4px",
        backgroundColor: SURFACE.page,
    },
    topButton: {
        color: "#bbbbbb",
        "&:hover": { color: "#ffffff", backgroundColor: SURFACE.panel },
        "&.Mui-disabled": { color: "#3d3d3d" },
    },
    titleBox: {
        flex: 1,
        minWidth: 0,
        padding: "0 4px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
    },
    title: {
        margin: "0 !important",    // the app gives dialog h1s a bottom margin
        fontFamily: `"Industry Book", "Normative Pro"`,
        fontSize: 16,
        lineHeight: 1.25,
        color: "#ffffff",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    subtitle: {
        marginTop: 2,
        fontFamily: `"Geist Mono", "Red Hat Display"`,
        fontSize: 11,
        lineHeight: 1.3,
        color: "#8a8a8a",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    done: {
        marginLeft: 4,
        height: 40,
        padding: "0 18px 0 14px",
        borderRadius: "21px !important",
        backgroundColor: "#ffffff !important",
        color: "#000000 !important",
        fontWeight: 600,
        boxShadow: "none",
        "&:hover": { backgroundColor: "#e0e0e0 !important", boxShadow: "none" },
        "&.Mui-disabled": { backgroundColor: "#3a3a3a !important", color: "#777777 !important" },
    },
    // Cards on black: GAP around and between them.
    body: {
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "row",
        padding: `0 ${GAP}px ${GAP}px`,
        paddingBottom: `calc(${GAP}px + env(safe-area-inset-bottom, 0px))`,
    },
    bodyNarrow: {
        flexDirection: "column",
    },
    main: {
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
    },
    work: {
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "row",
    },
    stage: {
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        position: "relative",
        overflow: "hidden",
        borderRadius: RADIUS,
        backgroundColor: SURFACE.stage,
        // A long press opens the ring menu: no callout or text pick on iOS.
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
    },
    zone: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        outline: "none",
    },
    notice: {
        position: "absolute",
        left: "50%",
        bottom: 56,
        zIndex: 4,
        maxWidth: "calc(100% - 32px)",
        transform: "translateX(-50%)",
        padding: "10px 16px",
        borderRadius: RADIUS,
        backgroundColor: SURFACE.on,
        color: SURFACE.onInk,
        fontFamily: `"Industry Book", "Normative Pro"`,
        fontSize: 13,
        lineHeight: 1.35,
        textAlign: "center",
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        pointerEvents: "none",
    },
    zoom: {
        position: "absolute",
        right: 12,
        bottom: 12,
        zIndex: 2,
        height: 32,
        padding: "0 12px",
        borderRadius: 16,
        backgroundColor: SURFACE.panel,
        color: "#bbbbbb",
        fontFamily: `"Geist Mono", "Red Hat Display"`,
        fontSize: 12,
        boxShadow: "0 6px 18px rgba(0,0,0,0.45)",
        transition: `background-color 160ms ${EASE}, color 160ms ${EASE}`,
        "&:hover": { backgroundColor: SURFACE.hover, color: "#ffffff" },
    },
    center: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 32,
        textAlign: "center",
        color: "#bbbbbb",
    },
    whiteDialog: {
        backgroundColor: "#fff !important",
        color: "#000 !important",
        "& .MuiTypography-root": { color: "#000 !important" },
        "& .MuiButton-textPrimary": { color: "#222 !important" },
        "& .MuiButton-containedPrimary": {
            color: "#fff !important",
            backgroundColor: "#000 !important",
            "&:hover": { backgroundColor: "#222 !important" },
        },
    },
});

function ZoomChip({ ed, classes }) {
    useEditorEvents(ed, ["viewport"]);
    const scale = ed.view ? ed.view.scale : 1;
    return (
        <Tooltip title={tp("view_fit")}>
            <ButtonBase className={classes.zoom} onClick={() => ed.run("view.fit")} aria-label={tp("view_fit")}>
                {Math.round(scale * 100)}%
            </ButtonBase>
        </Tooltip>
    );
}

function UndoRedo({ ed, classes }) {
    useEditorEvents(ed, ["history"]);
    return (
        <React.Fragment>
            <Tooltip title={`${tp("undo")} (Ctrl+Z)`}>
                <span>
                    <IconButton className={classes.topButton} aria-label={tp("undo")} disabled={!ed.history.canUndo()} onClick={() => ed.undo()}>
                        <UndoIcon />
                    </IconButton>
                </span>
            </Tooltip>
            <Tooltip title={`${tp("redo")} (Ctrl+Shift+Z)`}>
                <span>
                    <IconButton className={classes.topButton} aria-label={tp("redo")} disabled={!ed.history.canRedo()} onClick={() => ed.redo()}>
                        <RedoIcon />
                    </IconButton>
                </span>
            </Tooltip>
        </React.Fragment>
    );
}

/** A short message over the foot of the canvas (what an import became, or why it failed). */
function Notice({ notice, classes }) {
    const last = useRef(notice);
    if (notice) last.current = notice;
    return (
        <Fade in={!!notice} timeout={{ enter: 180, exit: 260 }}>
            <div className={classes.notice} role="status" aria-live="polite">
                {(notice || last.current || { text: "" }).text}
            </div>
        </Fade>
    );
}

/** What an import turned into, in words. */
function importSummary(r) {
    const size = { width: r.width, height: r.height };
    if (r.kind === "upscaled") return tp("import_done_upscaled", { ...size, scale: r.grid ? r.grid.kx : 1 });
    if (r.kind === "photo") return tp("import_done_photo", size);
    return tp("import_done_native", size);
}

function Subtitle({ ed, classes, short }) {
    useEditorEvents(ed, ["document", "layers"]);
    const d = ed.doc;
    const size = tp("size_px", { width: d.width, height: d.height });
    return (
        <span className={classes.subtitle}>
            {short ? size : `${size} · ${tp("n_layers", { n: d.layers.length })}`}
        </span>
    );
}

function PixelEditorDialog({ open, image, project, onClose, onSave, onReady }) {
    const classes = useStyles();
    useLanguage();
    // Counts the language's changes (its strings landing included): passed
    // to the memoised panels so they re-render with the new words.
    const [langRev, setLangRev] = useState(0);
    useEffect(() => subscribeLanguage(() => setLangRev((n) => n + 1)), []);
    const wide = useMediaQuery("(min-width:600px)", { noSsr: true });
    const side = useMediaQuery(SIDE_DRAWER, { noSsr: true });
    const desktop = useMediaQuery(DESKTOP, { noSsr: true });

    const [ed, setEd] = useState(null);
    const [failed, setFailed] = useState(false);
    const [tab, setTab] = useState(null);
    const [drawerTab, setDrawerTab] = useState(null);
    const [menu, setMenu] = useState(null);
    const [confirm, setConfirm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState(null);
    const zoneRef = useRef(null);
    const fileRef = useRef(null);
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;
    // Store builds: a picture refused on opening closes the editor (below).
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    // What to edit is read when the dialog opens; a parent re-rendering with
    // a new image while the editor is up does not throw the work away.
    const sourceRef = useRef({ image, project });
    sourceRef.current = { image, project };

    // ── one editor per opening ───────────────────────────────────────────
    const openedAt = useRef(0);
    useEffect(() => {
        if (!open) return undefined;
        openedAt.current = performance.now();
        const { image, project } = sourceRef.current;
        let editor = null;
        let alive = true;
        setFailed(false);
        setTab(null);
        setDrawerTab(null);
        setMenu(null);
        setConfirm(false);
        setNotice(null);
        try {
            const document = image ? documentFromImageData(image, layerName(1)) : undefined;
            editor = createEditor({ document, width: 64, height: 64, colorLimit: 0 });
        } catch (error) {
            console.error("[PixelEditor] Could not open the picture:", error);
            setFailed(true);
            return undefined;
        }
        editor.setColors({ primary: "#ffffffff", secondary: "#000000ff" });
        const ready = () => {
            if (!alive) return;
            editor.markSaved();
            setEd(editor);
            if (onReadyRef.current) onReadyRef.current(editor);
            // Development builds: the open editor is window.__pixelEditor,
            // for the console and the browser tests.
            if (process.env.NODE_ENV !== "production") window.__pixelEditor = editor;
        };
        // Store build: the picture is checked before the editor shows it — a
        // host may open it on any picture, a published artwork included. A
        // refused one closes the editor at once, unseen.
        const show = () => {
            if (!alive) return;
            if (!STORE_GATE || (!image && !project)) { ready(); return; }
            let pixels = null;
            try { pixels = imageDataFromDocument(editor.doc); } catch (error) { pixels = null; }
            screenPicture(pixels)
                .catch(() => SCREEN.UNCHECKED)
                .then((outcome) => {
                    if (!alive) return;
                    if (outcome === SCREEN.OK) { ready(); return; }
                    notifyStoreGate(outcome);
                    if (onCloseRef.current) onCloseRef.current();
                });
        };
        if (project) {
            // A saved project brings back its layers; if it cannot be read,
            // the flattened picture is still there.
            editor.open(project).catch((error) => console.warn("[PixelEditor] Project not reopened:", error)).then(show);
        } else {
            show();
        }
        return () => {
            alive = false;
            setEd(null);
            editor.dispose();
            if (process.env.NODE_ENV !== "production" && window.__pixelEditor === editor) window.__pixelEditor = null;
        };
    }, [open]);

    // ── the canvas zone, once the editor and its element both exist ──────
    // `attached` is the editor whose zone is up: an import still being
    // checked or read when the editor closes is dropped.
    const attached = useRef(null);
    useLayoutEffect(() => {
        if (!ed || !zoneRef.current) return undefined;
        const zone = ed.attach(zoneRef.current, ZONE_OPTIONS);
        zone.intro({ delay: Math.max(0, openedAt.current + INTRO_AFTER - performance.now()) });
        attached.current = ed;
        const off = ed.on("contextmenu", (e) => setMenu(e));
        return () => {
            if (attached.current === ed) attached.current = null;
            off();
            zone.dispose();
            if (ed.view === zone) ed.view = null;
        };
    }, [ed]);

    // ── no reload from the keyboard while the editor is open ─────────────
    // Ctrl+R, Cmd+R, F5 and their hard-reload forms would throw the picture
    // away. (A non-Latin layout still reloads on the R key: matched by code.)
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            const key = (e.key || "").toLowerCase();
            const r = key === "r" || (e.code === "KeyR" && !/^[a-z]$/.test(key));
            if (e.key === "F5" || ((e.ctrlKey || e.metaKey) && !e.altKey && r)) e.preventDefault();
        };
        window.addEventListener("keydown", onKey, true);
        return () => window.removeEventListener("keydown", onKey, true);
    }, [open]);

    // ── drawer ────────────────────────────────────────────────────────────
    // Desktop windows pin the drawer open where the canvas, beside it, is
    // still at least as wide as it is high (measured on the row holding both).
    const workRef = useRef(null);
    const [roomy, setRoomy] = useState(false);
    useLayoutEffect(() => {
        const el = workRef.current;
        if (!side || !el) { setRoomy(false); return undefined; }
        const measure = () => setRoomy(el.clientWidth - SIDE_WIDTH - GAP >= el.clientHeight);
        measure();
        if (typeof ResizeObserver !== "function") {
            window.addEventListener("resize", measure);
            return () => window.removeEventListener("resize", measure);
        }
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [side, ed, failed]);
    const pinned = side && desktop && roomy;
    const pinnedRef = useRef(pinned);
    pinnedRef.current = pinned;
    const lastTab = useRef("layers");

    const changeTab = useCallback((next) => {
        // A pinned drawer stays open: the open tab picked again keeps it.
        if (!next && pinnedRef.current) return;
        // An unapplied preview does not outlive its panel.
        if (ed && ed.previewSession) ed.previewSession.cancel();
        setTab(next);
        if (next) {
            setDrawerTab(next);
            lastTab.current = next;
        }
    }, [ed]);
    // Pinned with nothing open (on opening, or the window grown wide): the
    // last panel used comes back.
    useEffect(() => {
        if (pinned && ed && !tab) changeTab(lastTab.current);
    }, [pinned, ed, tab, changeTab]);

    // On a wide screen, picking a magic selection tool (from the rail, a key
    // or the ring menu) opens the Tool panel, where its strength is set.
    const sideRef = useRef(side);
    sideRef.current = side;
    useEffect(() => {
        if (!ed) return undefined;
        let current = ed.activeToolId;
        return ed.on("tool", () => {
            const id = ed.activeToolId;
            if (id !== current && sideRef.current && MAGIC_TOOLS.has(id)) changeTab("tool");
            current = id;
        });
    }, [ed, changeTab]);
    // The tool in hand picked again opens its options, on any screen (and a
    // magic tool picked again on a wide one, as it fires no event).
    const onToolPicked = useCallback((id, again) => {
        if (again || (side && MAGIC_TOOLS.has(id))) changeTab("tool");
    }, [side, changeTab]);

    // ── messages ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!notice) return undefined;
        const timer = setTimeout(() => setNotice(null), NOTICE_MS);
        return () => clearTimeout(timer);
    }, [notice]);
    const say = useCallback((text) => setNotice({ text, at: Date.now() }), []);

    // ── import: Layers' button, or an image dropped or pasted on the canvas ─
    // The picture floats over the active layer, centred: move it, then Apply
    // (onto the layer) or apply it as a new layer from the floating bar. A
    // photo is fitted to the canvas' pixel budget. Only pictures come in, as
    // their pixels: a PNG can carry a whole project, which would otherwise
    // open in their place (ignoreProject), and a bare .pixa project is
    // refused. Store build: the picture floats in only once it is checked.
    const importFile = useCallback(async (file, source = "import") => {
        if (!ed || !file) return;
        if (!(file.type && file.type.indexOf("image/") === 0) && !IMAGE_FILE.test(file.name || "")) {
            say(tp("import_failed"));
            return;
        }
        if (STORE_GATE) {
            let ok = false;
            try { ok = await screenPictureOrNotify(file); } catch (error) { ok = false; }   // refused: the gate says why
            if (!ok || attached.current !== ed) return;
        }
        if (ed.previewSession) ed.previewSession.cancel();
        try {
            const d = ed.doc;
            const r = await ed.import(file, { as: "floating", ignoreProject: true, maxPixels: Math.max(256, d.width * d.height) });
            if (attached.current === ed) say(importSummary(r));
        } catch (error) {
            ed.events.emit("error", { source, error });
            if (attached.current === ed) say(tp("import_failed"));
        }
    }, [ed, say]);
    const pickImage = useCallback(() => {
        if (fileRef.current) fileRef.current.click();
    }, []);
    useEffect(() => {
        if (!ed) return undefined;
        const offDrop = ed.on("drop-file", (e) => importFile(e.file, "drop"));
        const offPaste = ed.on("paste-image", (e) => importFile(e.file, "paste"));
        return () => { offDrop(); offPaste(); };
    }, [ed, importFile]);

    const closeMenu = useCallback(() => setMenu(null), []);
    const openTabFromMenu = useCallback((id) => changeTab(id), [changeTab]);

    // ── leaving ───────────────────────────────────────────────────────────
    const requestClose = useCallback(() => {
        if (ed && ed.dirty) setConfirm(true);
        else onClose();
    }, [ed, onClose]);

    const handleDone = useCallback(async () => {
        if (!ed || saving) return;
        setSaving(true);
        try {
            // What is on screen is what is kept: a running preview and
            // floating pixels are applied first.
            if (ed.previewSession) ed.previewSession.commit();
            if (ed.doc.floating) ed.run("floating.commit", {});
            const imageData = imageDataFromDocument(ed.doc);
            // Store build: the result is checked before it leaves the editor.
            // Mature → it is erased: the editor closes without keeping
            // anything. Not checkable → the editor stays open, and Done can
            // be tried again.
            if (STORE_GATE) {
                const outcome = await screenPicture(imageData);
                if (outcome !== SCREEN.OK) {
                    notifyStoreGate(outcome);
                    if (outcome === SCREEN.MATURE) onClose();
                    return;
                }
            }
            const bytes = await ed.export.project({ blob: false });
            ed.markSaved();
            onSave({ imageData, project: bytes });
        } catch (error) {
            console.error("[PixelEditor] Could not finish:", error);
        } finally {
            setSaving(false);
        }
    }, [ed, saving, onSave, onClose]);

    const tabInfo = drawerTab ? TABS.find((x) => x.id === drawerTab) : null;
    const label = tabInfo ? tp(tabInfo.label) : undefined;
    // In the side column a panel is as narrow as a phone: it lays out for one;
    // the column's head already names it.
    const narrow = !wide || side;
    const renderPanel = (id) => {
        const Panel = PANELS[id];
        return <Panel ed={ed} narrow={narrow} titled={side} onImport={pickImage} lang={langRev} />;
    };
    const closeDrawer = () => changeTab(null);
    const drawerExited = () => setDrawerTab(null);

    return (
        <Dialog
            open={!!open}
            fullScreen
            disableEscapeKeyDown          // Escape belongs to the editor
            onClose={requestClose}
            TransitionComponent={Fade}
            transitionDuration={{ enter: 280, exit: 200 }}
            PaperProps={{ square: true, classes: { root: classes.paper } }}
            aria-label={tp("title")}
        >
            <header className={classes.top}>
                <Tooltip title={tp("close")}>
                    <IconButton className={classes.topButton} aria-label={tp("close")} onClick={requestClose}>
                        <CloseIcon />
                    </IconButton>
                </Tooltip>
                <div className={classes.titleBox}>
                    <Typography component="h1" className={classes.title}>{tp("title")}</Typography>
                    {ed && <Subtitle ed={ed} classes={classes} short={!wide} />}
                </div>
                {ed && <UndoRedo ed={ed} classes={classes} />}
                <Button
                    variant="contained"
                    className={classes.done}
                    disabled={!ed || saving}
                    onClick={handleDone}
                    startIcon={saving ? <CircularProgress size={16} style={{ color: "#000" }} /> : <CheckIcon />}
                >
                    {tp("done")}
                </Button>
            </header>

            {failed ? (
                <div className={classes.center}>
                    <Typography variant="h6" style={{ color: "#dddddd" }}>{tp("could_not_open")}</Typography>
                    <Button variant="text" color="primary" onClick={onClose}>{tp("close")}</Button>
                </div>
            ) : (
                // The stage keeps one place in the tree in every layout, so
                // the canvas zone survives a rotation or a window resize.
                <div className={classes.body + (wide ? "" : " " + classes.bodyNarrow)}>
                    {ed && (
                        <ToolStrip
                            ed={ed}
                            vertical={wide}
                            onPick={onToolPicked}
                            onOpenColors={() => changeTab(tab === "colors" ? null : "colors")}
                        />
                    )}
                    <div className={classes.main}>
                        <div ref={workRef} className={classes.work}>
                            <div className={classes.stage}>
                                <div ref={zoneRef} className={classes.zone} />
                                {ed && <FloatingBar ed={ed} />}
                                {ed && <ZoomChip ed={ed} classes={classes} />}
                                <Notice notice={notice} classes={classes} />
                                {!ed && (
                                    <div className={classes.center} style={{ height: "100%" }}>
                                        <CircularProgress size={28} />
                                    </div>
                                )}
                            </div>
                            {ed && side && (
                                <SideColumn
                                    tab={tab}
                                    onChange={changeTab}
                                    label={label}
                                    pinned={pinned}
                                    onClose={closeDrawer}
                                    onExited={drawerExited}
                                    renderPanel={renderPanel}
                                />
                            )}
                        </div>
                        {ed && !side && (
                            <Drawer
                                open={!!tab}
                                tabId={tab || drawerTab}
                                wide={wide}
                                label={label}
                                onChange={changeTab}
                                onClose={closeDrawer}
                                onExited={drawerExited}
                                renderPanel={renderPanel}
                            />
                        )}
                        {ed && !side && <BottomTabs tab={tab} onChange={changeTab} labels={wide} />}
                    </div>
                </div>
            )}

            {/* Import: images only; a project file would replace the picture. */}
            <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                    const file = e.target.files && e.target.files[0];
                    e.target.value = "";            // the same file can be picked again
                    if (file) importFile(file);
                }}
            />

            {ed && menu && (
                <RadialMenu
                    key={`${menu.screen.x},${menu.screen.y}`}
                    ed={ed}
                    menu={menu}
                    onClose={closeMenu}
                    onOpenTab={openTabFromMenu}
                />
            )}

            <Dialog
                open={confirm}
                maxWidth="xs"
                onClose={() => setConfirm(false)}
                PaperProps={{ classes: { root: classes.whiteDialog } }}
            >
                <DialogContent>
                    <Typography style={{ marginTop: 8, marginBottom: 24 }} component="h2" variant="h6">
                        {tp("discard_title")}
                    </Typography>
                    <Typography variant="body2" component="p">
                        {tp("discard_body")}
                    </Typography>
                </DialogContent>
                <DialogActions style={{ textAlign: "right" }}>
                    <Button variant="text" color="primary" autoFocus onClick={() => setConfirm(false)}>
                        {tp("keep_editing")}
                    </Button>
                    <Button variant="contained" color="primary" onClick={() => { setConfirm(false); onClose(); }}>
                        {tp("discard")}
                    </Button>
                </DialogActions>
            </Dialog>
        </Dialog>
    );
}

export default PixelEditorDialog;
