// ============================================================================
// pixel-editor/PixelEditorDialog.js — the pixel editor, full screen
//
// Opened by "Open editor" in NewPost (Adjust step) and in ImageWizard (Adjust
// phase) with the picture of the moment. Built on the headless editor core
// (utils/pixa-editor): the core owns the document, layers, history and the
// canvas zone; this file is the frame around it, in the app's Material look —
// black, flat, no borders, white for what is on.
//
//   top      close · title and size · undo · redo · Done
//   left     tools (a rail from 600 px; a scrolling toolbar on top on phones)
//   centre   the canvas: pan, zoom, pinch; floating pixels get an action bar
//   bottom   seven tabs, each opening its panel in a drawer: above the tabs on
//            phones and upright tablets, on the right of the canvas on wide
//            screens and on phones held sideways
//   context  right-click, long press, double tap: an expandable ring menu
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
// ============================================================================

import * as React from "preact/compat";
import { useState, useEffect, useLayoutEffect, useRef, useCallback, forwardRef } from "preact/compat";
import makeStyles from "@material-ui/core/styles/makeStyles";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Slide from "@material-ui/core/Slide";
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
import { useLanguage } from "../../utils/text";

import { tp, layerName } from "./labels";
import { useEditorEvents, documentFromImageData, imageDataFromDocument } from "./editorUtils";
import ToolStrip from "./ToolStrip";
import FloatingBar from "./FloatingBar";
import RadialMenu from "./RadialMenu";
import { Drawer, Tabs, TABS } from "./BottomBar";
import LayersPanel from "./panels/LayersPanel";
import ColorsPanel from "./panels/ColorsPanel";
import ToolPanel from "./panels/ToolPanel";
import SelectionPanel from "./panels/SelectionPanel";
import EffectsPanel from "./panels/EffectsPanel";
import FiltersPanel from "./panels/FiltersPanel";
import HistoryPanel from "./panels/HistoryPanel";
import { EASE } from "./ui";

const PANELS = {
    layers: LayersPanel,
    colors: ColorsPanel,
    tool: ToolPanel,
    select: SelectionPanel,
    effects: EffectsPanel,
    filters: FiltersPanel,
    history: HistoryPanel,
};

// The canvas zone, dressed for a black interface.
const ZONE_OPTIONS = {
    menu: "event",          // RadialMenu draws the context menu
    grid: true,
    paste: "import",        // images pasted or dropped on the canvas float in
    drop: "import",
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

const SlideUp = forwardRef(function SlideUp(props, ref) {
    return <Slide direction="up" ref={ref} {...props} />;
});

const useStyles = makeStyles({
    paper: {
        backgroundColor: "#000000 !important",
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
        backgroundColor: "#000000",
    },
    topButton: {
        color: "#bbbbbb",
        "&:hover": { color: "#ffffff", backgroundColor: "#171717" },
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
    body: {
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "row",
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
        backgroundColor: "#0b0b0b",
    },
    zone: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        outline: "none",
    },
    zoom: {
        position: "absolute",
        right: 12,
        bottom: 12,
        zIndex: 2,
        height: 32,
        padding: "0 12px",
        borderRadius: 16,
        backgroundColor: "rgba(23, 23, 23, 0.9)",
        color: "#bbbbbb",
        fontFamily: `"Geist Mono", "Red Hat Display"`,
        fontSize: 12,
        boxShadow: "0 6px 18px rgba(0,0,0,0.45)",
        transition: `background-color 160ms ${EASE}, color 160ms ${EASE}`,
        "&:hover": { backgroundColor: "#262626", color: "#ffffff" },
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
    const wide = useMediaQuery("(min-width:600px)", { noSsr: true });
    const side = useMediaQuery(SIDE_DRAWER, { noSsr: true });

    const [ed, setEd] = useState(null);
    const [failed, setFailed] = useState(false);
    const [tab, setTab] = useState(null);
    const [drawerTab, setDrawerTab] = useState(null);
    const [menu, setMenu] = useState(null);
    const [confirm, setConfirm] = useState(false);
    const [saving, setSaving] = useState(false);
    const zoneRef = useRef(null);
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;
    // What to edit is read when the dialog opens; a parent re-rendering with
    // a new image while the editor is up does not throw the work away.
    const sourceRef = useRef({ image, project });
    sourceRef.current = { image, project };

    // ── one editor per opening ───────────────────────────────────────────
    useEffect(() => {
        if (!open) return undefined;
        const { image, project } = sourceRef.current;
        let editor = null;
        let alive = true;
        setFailed(false);
        setTab(null);
        setDrawerTab(null);
        setMenu(null);
        setConfirm(false);
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
        if (project) {
            // A saved project brings back its layers; if it cannot be read,
            // the flattened picture is still there.
            editor.open(project).catch((error) => console.warn("[PixelEditor] Project not reopened:", error)).then(ready);
        } else {
            ready();
        }
        return () => {
            alive = false;
            setEd(null);
            editor.dispose();
            if (process.env.NODE_ENV !== "production" && window.__pixelEditor === editor) window.__pixelEditor = null;
        };
    }, [open]);

    // ── the canvas zone, once the editor and its element both exist ──────
    useLayoutEffect(() => {
        if (!ed || !zoneRef.current) return undefined;
        const zone = ed.attach(zoneRef.current, ZONE_OPTIONS);
        const off = ed.on("contextmenu", (e) => setMenu(e));
        return () => {
            off();
            zone.dispose();
            if (ed.view === zone) ed.view = null;
        };
    }, [ed]);

    // ── drawer ────────────────────────────────────────────────────────────
    const changeTab = useCallback((next) => {
        // An unapplied preview does not outlive its panel.
        if (ed && ed.previewSession) ed.previewSession.cancel();
        setTab(next);
        if (next) setDrawerTab(next);
    }, [ed]);

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
            const bytes = await ed.export.project({ blob: false });
            ed.markSaved();
            onSave({ imageData, project: bytes });
        } catch (error) {
            console.error("[PixelEditor] Could not finish:", error);
        } finally {
            setSaving(false);
        }
    }, [ed, saving, onSave]);

    const Panel = drawerTab ? PANELS[drawerTab] : null;
    const tabInfo = drawerTab ? TABS.find((x) => x.id === drawerTab) : null;
    const drawer = ed && (
        <Drawer
            open={!!tab}
            wide={wide}
            side={side}
            label={tabInfo ? tp(tabInfo.label) : undefined}
            onClose={() => changeTab(null)}
            onExited={() => setDrawerTab(null)}
        >
            {/* The side drawer is as narrow as a phone: panels lay out for one. */}
            {Panel && <Panel ed={ed} narrow={!wide || side} />}
        </Drawer>
    );

    return (
        <Dialog
            open={!!open}
            fullScreen
            disableEscapeKeyDown          // Escape belongs to the editor
            onClose={requestClose}
            TransitionComponent={SlideUp}
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
                <div className={classes.body + (wide ? "" : " " + classes.bodyNarrow)}>
                    {ed && <ToolStrip ed={ed} vertical={wide} onOpenColors={() => changeTab(tab === "colors" ? null : "colors")} />}
                    <div className={classes.main}>
                        <div className={classes.work}>
                            <div className={classes.stage}>
                                <div ref={zoneRef} className={classes.zone} />
                                {ed && <FloatingBar ed={ed} />}
                                {ed && <ZoomChip ed={ed} classes={classes} />}
                                {!ed && (
                                    <div className={classes.center} style={{ height: "100%" }}>
                                        <CircularProgress size={28} />
                                    </div>
                                )}
                            </div>
                            {ed && side && drawer}
                        </div>
                        {ed && !side && drawer}
                        <Tabs tab={tab} wide={wide} onChange={changeTab} />
                    </div>
                </div>
            )}

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
