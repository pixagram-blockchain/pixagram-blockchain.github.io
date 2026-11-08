// ============================================================================
// pixel-editor/index.js — the editor dialog, code-split
//
// NewPost and ImageWizard render <PixelEditorDialog open … /> as if it were
// static; the editor core and its UI (one chunk) download on the first open,
// behind a spinner on a dark backdrop. Hovering, focusing or touching an
// "Open editor" button calls preloadPixelEditor() to start that download
// early.
// ============================================================================

import * as React from "preact/compat";
import Backdrop from "@material-ui/core/Backdrop";
import CircularProgress from "@material-ui/core/CircularProgress";
import { lazyDialog } from "../LazyDialog";

const LOADING = (
    <Backdrop open style={{ zIndex: 1301, color: "#ffffff", backgroundColor: "rgba(0, 0, 0, 0.72)" }}>
        <CircularProgress color="inherit" size={28} />
    </Backdrop>
);

export const PixelEditorDialog = lazyDialog(() => import("./PixelEditorDialog"), {
    name: "PixelEditorDialog",
    fallback: LOADING,
});

/** Starts downloading the editor; a failure is retried by the next open. */
export const preloadPixelEditor = () => {
    PixelEditorDialog.preload().catch(() => {});
};

export default PixelEditorDialog;
