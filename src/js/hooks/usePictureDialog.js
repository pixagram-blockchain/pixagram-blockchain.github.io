import { useState, useEffect, useCallback, useMemo, useRef } from "preact/compat";
import { HISTORY } from "../utils/constants";

/* ══════════════════════════════════════════════════════════════════════
 * usePictureDialog — page-side state for <PictureDialog>.
 *
 * Owns everything the dialog itself deliberately doesn't (mirroring the
 * PostDialog ↔ usePostNavigation split):
 *
 *   • the "#picture" history entry — pushed on open, popped on close;
 *   • the clicked element (anchor): measured at click time for the open
 *     hero, re-measured live on close for the reverse hero;
 *   • URL → state sync, so the browser Back arrow closes the dialog and a
 *     Forward / shared "/@user#picture" link reopens it (hero-less).
 *
 * This module imports nothing heavy on purpose: the dialog is lazy-loaded
 * by its host pages, and a page must be able to wire the avatar click
 * before the dialog chunk exists.
 * ══════════════════════════════════════════════════════════════════════ */

export const PICTURE_HASH = "#picture";

const ZERO_RADIUS = [0, 0, 0, 0];

// "56px" → 56, "50%" → ref × 0.5, "56px / 28px" → 56 (first radius only),
// anything else → 0. Clamped to ref / 2 the way the browser clamps overlapping
// corner radii, so a 50% circle measures as a true half-width radius.
function radiusPx(value, ref) {
    if (!value) return 0;
    const first = String(value).trim().split(/\s+/)[0];
    let n = parseFloat(first);
    if (!isFinite(n) || n <= 0) return 0;
    if (first.endsWith("%")) n = n * ref / 100;
    return Math.min(n, ref / 2);
}

/* Rect + corner radii of an element, in viewport CSS px. This is the shape
 * both `originRect` and `getReturnRect()` hand to the dialog:
 *   { left, top, width, height, radius: [tl, tr, br, bl] }
 * A one-shot layout read at click time (same as the card-side gBCR in the
 * feeds); the dialog's own geometry is arithmetic and never measures. */
export function measureAnchor(el) {
    if (!el || typeof el.getBoundingClientRect !== "function") return null;
    // The pages wrap the picture in a MUI ButtonBase (a <button> holding the
    // picture element followed by its ripple <span>). Measure the picture
    // itself: the button's box is NOT always the painted picture — the mobile
    // header's opened state gives the picture class negative margins, which
    // shrink and shift the button around it.
    if (el.tagName === "BUTTON") {
        const kids = el.children;
        for (let i = 0; i < kids.length; i++) {
            const k = kids[i];
            if (k.classList && k.classList.contains("MuiTouchRipple-root")) continue;
            if (typeof k.getBoundingClientRect === "function") { el = k; break; }
        }
    }
    const r = el.getBoundingClientRect();
    if (!(r.width > 0) || !(r.height > 0)) return null;
    let radius = ZERO_RADIUS;
    try {
        const cs = window.getComputedStyle(el);
        const ref = Math.min(r.width, r.height);
        radius = [
            radiusPx(cs.borderTopLeftRadius, ref),
            radiusPx(cs.borderTopRightRadius, ref),
            radiusPx(cs.borderBottomRightRadius, ref),
            radiusPx(cs.borderBottomLeftRadius, ref),
        ];
    } catch (e) {}
    return { left: r.left, top: r.top, width: r.width, height: r.height, radius };
}

const baseUrl = () => (HISTORY.location.pathname || "/") + (HISTORY.location.search || "");
const currentHash = () => HISTORY.location.hash || "";

/**
 * @param {string} src  the picture currently shown on the page ('' while the
 *                      account / community is still loading)
 * @returns {{ open, src, originRect, openPicture, closePicture, getReturnRect }}
 *   openPicture(target) — `target` is the click event (its currentTarget is
 *   the anchor), the anchor element itself, or a pre-measured rect.
 */
export function usePictureDialog(src) {
    const [open, setOpen] = useState(false);
    const [originRect, setOriginRect] = useState(null);
    // Mirrors `open` for the synchronous paths below (HISTORY listeners and
    // the push→listen round-trip fire before React commits the state).
    const openRef = useRef(false);
    // How many history entries WE pushed above the page URL: 1 after an
    // in-app open, 0 after a deep-link / forward re-entry (see closePicture).
    const depthRef = useRef(0);
    const anchorRef = useRef(null);
    const srcRef = useRef(src);
    srcRef.current = src;

    // ── URL → state ──────────────────────────────────────────────────
    // Idempotent: the URL is the source of truth. "#picture" on the current
    // page with a known picture means open; anything else means closed. A
    // Back press pops our entry (hash gone → close, plain fade since there is
    // no user gesture to fly from); a Forward press or a shared link brings
    // the hash back (→ hero-less open).
    const sync = useCallback(() => {
        const want = currentHash() === PICTURE_HASH && !!srcRef.current;
        if (want === openRef.current) return;
        openRef.current = want;
        if (want) {
            setOriginRect(null);
            setOpen(true);
        } else {
            depthRef.current = 0;
            setOriginRect(null);
            setOpen(false);
        }
    }, []);

    useEffect(() => HISTORY.listen(sync), [sync]);

    // ── Cold entry / late picture ────────────────────────────────────
    // Mounted (or the picture arrived) on a URL that already carries the
    // hash: seat the bare page URL beneath it so Back closes the dialog
    // instead of leaving the page — the same splice usePostNavigation does
    // for a cold post URL. Gated on HISTORY.action exactly like Community's
    // seed: a PUSH arrival already has its origin one entry beneath (that is
    // how openPicture itself arrives), only POP/REPLACE entries need it.
    useEffect(() => {
        if (currentHash() === PICTURE_HASH && !openRef.current && srcRef.current
            && depthRef.current === 0 && HISTORY.action !== "PUSH") {
            const base = baseUrl();
            depthRef.current = 1;
            HISTORY.replace(base);
            HISTORY.push(base + PICTURE_HASH);
        }
        sync(); // covers the no-listener-yet case and a src that arrived late
    }, [src, sync]);

    // ── Actions ──────────────────────────────────────────────────────
    const openPicture = useCallback((target) => {
        if (!srcRef.current) return;
        let el = null;
        let rect = null;
        if (target && target.currentTarget && typeof target.currentTarget.getBoundingClientRect === "function") {
            el = target.currentTarget;
            // The picture usually sits inside something else that is
            // clickable (the mobile card toggles on tap) — opening the
            // viewer is the whole gesture, nothing above it should react.
            if (typeof target.stopPropagation === "function") target.stopPropagation();
        } else if (target && typeof target.getBoundingClientRect === "function") {
            el = target;
        } else if (target && target.width > 0 && target.height > 0) {
            rect = { left: target.left || 0, top: target.top || 0, width: target.width, height: target.height, radius: target.radius || ZERO_RADIUS };
        }
        if (el) rect = measureAnchor(el);
        anchorRef.current = el;
        openRef.current = true;
        if (currentHash() !== PICTURE_HASH) {
            depthRef.current = 1;
            HISTORY.push(baseUrl() + PICTURE_HASH); // listener → sync → no-op (already open)
        }
        setOriginRect(rect);
        setOpen(true);
    }, []);

    // Called by the dialog once its close animation has landed. Rewind the
    // entry we pushed so the address bar returns to the page URL; a depth-0
    // entry (deep link, forward re-entry) is REPLACED rather than pushed over,
    // otherwise the next Back would land on "#picture" and reopen us.
    const closePicture = useCallback(() => {
        const depth = depthRef.current;
        depthRef.current = 0;
        openRef.current = false;
        setOriginRect(null);
        setOpen(false);
        if (currentHash() !== PICTURE_HASH) return;
        if (depth > 0) HISTORY.go(-depth);
        else HISTORY.replace(baseUrl());
    }, []);

    // Live rect of the element the picture was opened from, for the reverse
    // hero; null (gone, off-viewport, hidden) → the dialog fades out instead.
    const getReturnRect = useCallback(() => {
        const el = anchorRef.current;
        if (!el || !el.isConnected) return null;
        const r = measureAnchor(el);
        if (!r) return null;
        const vw = window.innerWidth || 0, vh = window.innerHeight || 0;
        if (r.top + r.height < 0 || r.top > vh || r.left + r.width < 0 || r.left > vw) return null;
        try {
            const cs = window.getComputedStyle(el);
            if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) === 0) return null;
        } catch (e) {}
        return r;
    }, []);

    return useMemo(() => ({
        open, src, originRect,
        openPicture, closePicture, getReturnRect,
    }), [open, src, originRect, openPicture, closePicture, getReturnRect]);
}

export default usePictureDialog;
