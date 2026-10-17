import { useState, useEffect, useLayoutEffect, useCallback } from "preact/compat";

// ── Fit an open mobile card on screen ──────────────────────────────────
// The mobile cards (ProfileMobileCard, CommunityHeader) are fixed to the top
// of the page, and nothing scrolls them. Their action button — the wallet on
// a profile, the write button on a portal — hangs off the card's bottom
// edge: 72px tall, lifted 32px into the card from a zero-height row
// (walletMobileButton / writeMobileButton in Profile.js / Community.js). So
// whenever the open card ran taller than the screen — a short phone,
// landscape, an installed app's home-indicator strip — its foot and the
// button sat below the screen, out of reach.
//
// This measures the room the card's BODY (everything its Collapse opens) has
// between its top and the line the button must stay above. The card caps
// its body there, scrolling it when capped, and can first size its own lists
// into the room so nothing needs to scroll. Measured rather than estimated:
// the card's top, its header (a display name drops to a second line as the
// card opens), its content and the inset all vary.
//
// Returns null until the card first opens, then { bodyMaxHeight, listRoom }
// in px — listRoom being the room from the top of listRef's block down to
// that line (null without a listRef).

// How far the button reaches below the card's bottom edge (72 − 32).
const BUTTON_OVERHANG = 40;
// Air kept between the button and the bottom of the screen.
const SCREEN_GAP = 16;
// The body never gets shorter than this, however little room is left.
const MIN_BODY_HEIGHT = 96;

// env(safe-area-inset-bottom) in px: the home-indicator strip an installed
// app keeps clear (0 in a browser tab, whose toolbar sits there instead).
// CSS knows it and JS doesn't, so a hidden probe carries it as padding.
let insetProbe = null;
const bottomInset = () => {
    if (typeof document === "undefined" || !document.body) return 0;
    if (!insetProbe || !insetProbe.isConnected) {
        insetProbe = document.createElement("div");
        insetProbe.setAttribute("aria-hidden", "true");
        insetProbe.style.cssText = "position:fixed;left:0;bottom:0;width:0;height:0;"
            + "visibility:hidden;pointer-events:none;"
            + "padding-bottom:env(safe-area-inset-bottom, 0px)";
        document.body.appendChild(insetProbe);
    }
    return parseFloat(getComputedStyle(insetProbe).paddingBottom) || 0;
};

// The wrapper's current slide (tucked / shown, the entry animation), taken
// off so the card is measured where it rests, even when caught mid-slide.
const slideOf = (el) => {
    const t = el ? getComputedStyle(el).transform : "none";
    if (!t || t === "none") return 0;
    const v = t.slice(t.indexOf("(") + 1, -1).split(",");
    return parseFloat(t.startsWith("matrix3d") ? v[13] : v[5]) || 0;
};

const useMobileCardFit = ({ expanded, height, wrapperRef, bodyRef, listRef }) => {
    const [fit, setFit] = useState(null);

    const measure = useCallback(() => {
        const wrapper = wrapperRef.current;
        const body = bodyRef.current;
        const viewHeight = (typeof window !== "undefined" && window.innerHeight) || height || 0;
        if (!wrapper || !body || !viewHeight) return;
        const bodyBox = body.getBoundingClientRect();
        // The lowest the card's bottom edge may come.
        const line = viewHeight - bottomInset() - BUTTON_OVERHANG - SCREEN_GAP;
        const room = Math.floor(line - (bodyBox.top - slideOf(wrapper)));
        const list = listRef ? listRef.current : null;
        // The list block's offset inside the body, however far it's scrolled.
        const listRoom = list
            ? Math.floor(room - (list.getBoundingClientRect().top - bodyBox.top + body.scrollTop))
            : null;
        const bodyMaxHeight = Math.max(MIN_BODY_HEIGHT, room);
        setFit((prev) => (prev && prev.bodyMaxHeight === bodyMaxHeight && prev.listRoom === listRoom)
            ? prev
            : { bodyMaxHeight, listRoom });
    }, [height, wrapperRef, bodyRef, listRef]);

    // Opening: the body starts from its top again — the Collapse only hides
    // it, so it keeps its scroll while closed.
    useLayoutEffect(() => {
        if (expanded && bodyRef.current) bodyRef.current.scrollTop = 0;
    }, [expanded, bodyRef]);

    // Opening, and a window resize while open: measured before the frame
    // paints, so the Collapse grows straight to the fitted height.
    useLayoutEffect(() => {
        if (expanded) measure();
    }, [expanded, measure]);

    // While open, whatever resizes the card can move the body's top: the
    // header settling into its open layout, the account landing. Re-measured
    // a frame later — a new fit applied inside the observer's callback would
    // resize what it watches, which browsers report as a ResizeObserver loop.
    useEffect(() => {
        const wrapper = wrapperRef.current;
        if (!expanded || !wrapper || typeof ResizeObserver === "undefined") return undefined;
        let frame = 0;
        const observer = new ResizeObserver(() => {
            if (!frame) frame = requestAnimationFrame(() => { frame = 0; measure(); });
        });
        observer.observe(wrapper);
        return () => {
            observer.disconnect();
            if (frame) cancelAnimationFrame(frame);
        };
    }, [expanded, measure, wrapperRef]);

    return fit;
};

export default useMobileCardFit;
