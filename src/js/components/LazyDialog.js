"use strict";

import * as React from "preact/compat";
import { lazy, Suspense } from "preact/compat";
import { useRef } from "preact/hooks";

// ── lazyDialog ─────────────────────────────────────────────────────────
// Code-splitting wrapper for heavy dialogs. Generalizes the pattern
// already used for LazyTextEditorDialog in BlogPostDialog.js so every
// dialog can adopt it with one line and ZERO changes to the dialog
// itself or to how the parent renders it.
//
//   Suggested location: src/components/LazyDialog.js
//
// Usage — at the top of the parent (App root, Profile, Feed, …):
//
//   import { lazyDialog, preloadOnIdle } from "./LazyDialog";
//
//   const PixaWalletDialog = lazyDialog(() => import("./PixaWalletDialog"));
//   const PostDialog       = lazyDialog(() => import("./PostDialog"));
//
//   // Rendered exactly as before — all props pass straight through:
//   <PixaWalletDialog open={walletOpen} api={api} account={account} … />
//
//   // Optional: warm the chunks the user is most likely to need,
//   // after first paint, without competing with it:
//   preloadOnIdle(PostDialog);
//
//   // Optional: hide first-open latency on pointer intent:
//   <IconButton onMouseEnter={PixaWalletDialog.preload} onClick={openWallet}>
//
// Semantics:
//
//   • Nothing is downloaded, parsed, or mounted until the first truthy
//     `open`. (Truthy, not `=== true` — several call sites pass a
//     length or string, e.g. `open={_send_dialog_opened.length}` in
//     PixaWalletDialog.)
//
//   • STICKY MOUNT: once opened, the gate stays mounted for the rest of
//     the session. The inner MUI <Dialog> keeps handling open/close, so
//     exit transitions play normally and re-opens are instant with no
//     Suspense flash. Memory cost equals today's always-mounted cost —
//     but only for dialogs the user actually touched.
//
//   • The module promise is cached: `preload()`, the first open, and
//     concurrent opens all share one network request. A failed import
//     clears the promise so the next open can retry (flaky mobile
//     networks shouldn't brick a dialog forever).
//
//   • Works with the project's default exports
//     (`export default withStyles(styles)(X)`); named exports resolve
//     via the `m.default || m` fallback.
//
// Also worth applying INSIDE PixaWalletDialog.js: its nine statically
// imported sub-dialogs (Send / Swap / Delegate / Keys / Power / …) can
// each become `lazyDialog(() => import("./PixaWalletXxxDialog"))` with
// no other edits, since they're already rendered with an `open` prop.
// ───────────────────────────────────────────────────────────────────────

export function lazyDialog(loader, options = {}) {
    const { fallback = null, name = "LazyDialog" } = options;

    let modPromise = null;
    const load = () => {
        if (!modPromise) {
            modPromise = loader().catch((err) => {
                modPromise = null; // allow retry on a later open
                throw err;
            });
        }
        return modPromise;
    };

    // lazy() wants a { default: Component } shape.
    const Inner = lazy(() => load().then((m) => ({ default: m.default || m })));

    function LazyDialogGate(props) {
        // Sticky mount — render nothing until first truthy open, then
        // stay mounted so close transitions and re-opens behave exactly
        // like the previous statically-imported dialog.
        const everOpened = useRef(false);
        if (props.open) everOpened.current = true;
        if (!everOpened.current) return null;

        return (
            <Suspense fallback={fallback}>
                <Inner {...props} />
            </Suspense>
        );
    }

    LazyDialogGate.preload = load;
    LazyDialogGate.displayName = `lazyDialog(${name})`;
    return LazyDialogGate;
}

// ── preloadOnIdle ──────────────────────────────────────────────────────
// Fire-and-forget warmup for the chunks a session will most plausibly
// need (PostDialog on the feed, NewPost when logged in, …). Runs after
// the browser is idle so it never competes with first paint; falls back
// to a timer where requestIdleCallback is unavailable (Safari).
// ───────────────────────────────────────────────────────────────────────

export function preloadOnIdle(...gates) {
    const run = () => {
        for (const g of gates) {
            try { if (g && typeof g.preload === "function") g.preload(); } catch (e) { /* ignore */ }
        }
    };
    if (typeof requestIdleCallback === "function") {
        requestIdleCallback(run, { timeout: 4000 });
    } else {
        setTimeout(run, 1500);
    }
}

export default lazyDialog;
