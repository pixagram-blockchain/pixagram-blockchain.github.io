import { useEffect, useRef } from "preact/compat";

// ── usePullToRefresh ────────────────────────────────────────────────────
// Drag the list down while it is scrolled to the very top → a spinner
// follows the finger; let go past the threshold → `onRefresh()` runs and the
// spinner stays until it settles.
//
//   • Touch / pen: a real drag. Only starts when the gesture BEGINS with the
//     list at scrollTop 0 and moves downwards; a horizontal swipe or any
//     upward movement hands the gesture back to the browser at once.
//   • Desktop (trackpad / wheel): scrolling UP again once already at the top
//     pulls the same way — but only for a wheel gesture that STARTED at the
//     top, so flinging up to the top never refreshes on its own.
//
// The masonry containers already set `overscroll-behavior: none`, which
// disables the browser's own pull-to-refresh, so this does not fight it.
//
// Everything is driven imperatively (one fixed DOM element, refs, no React
// state), so a pull costs no page render — the pages re-render their whole
// grid on state changes and must not do that 60× a second.
//
// Options:
//   getContainer() → the scrolling element of the list (or any element
//                    standing in for it, e.g. an empty state); null = off
//   onRefresh()    → may return a promise; the spinner waits for it
//                    (between MIN_SPIN_MS and MAX_SPIN_MS)
//   enabled        → false while a dialog sits on top of the page

const THRESHOLD = 72;       // px of (damped) pull needed to refresh
const MAX_PULL = 128;       // the spinner never travels further than this
const HOLD_AT = 64;         // where it sits while refreshing
const DAMPING = 0.5;        // finger px → spinner px
const START_SLOP = 8;       // px of downward travel before a pull claims the gesture
const WHEEL_DAMPING = 0.3;
const WHEEL_GESTURE_GAP_MS = 220; // wheel silence that ends a gesture
const MIN_SPIN_MS = 500;
const MAX_SPIN_MS = 15000;
const SIZE = 40;
const STYLE_ID = "px-pull-to-refresh-style";

const ensureStyle = () => {
    if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent =
        "@keyframes pxPtrSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}" +
        ".px-ptr-spinning svg{animation:pxPtrSpin 800ms linear infinite}";
    document.head.appendChild(s);
};

const createIndicator = () => {
    ensureStyle();
    const el = document.createElement("div");
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = [
        "position:fixed", "top:0", "left:50%", `width:${SIZE}px`, `height:${SIZE}px`,
        "margin-left:" + (-SIZE / 2) + "px", "border-radius:50%", "background:#1e1e1e",
        "box-shadow:0 2px 12px rgba(0,0,0,0.6)", "display:flex", "align-items:center",
        "justify-content:center", "z-index:1250", "pointer-events:none", "opacity:0",
        `transform:translateY(${-SIZE}px)`, "will-change:transform,opacity",
    ].join(";");
    // 3/4 arc that fills with the pull progress.
    el.innerHTML =
        '<svg width="24" height="24" viewBox="0 0 24 24" style="display:block">' +
        '<circle cx="12" cy="12" r="9" fill="none" stroke="#c7c7c7" stroke-width="2.5" ' +
        'stroke-linecap="round" stroke-dasharray="56.5" stroke-dashoffset="56.5"/></svg>';
    document.body.appendChild(el);
    return el;
};

export default function usePullToRefresh({ getContainer, onRefresh, enabled = true }) {
    const optsRef = useRef({ getContainer, onRefresh, enabled });
    optsRef.current = { getContainer, onRefresh, enabled };

    useEffect(() => {
        if (typeof document === "undefined") return undefined;
        let indicator = null;
        let refreshing = false;
        let alive = true;
        // touch gesture
        let touch = null; // { y0, x0, c, active, dist }
        // wheel gesture
        const wheel = { lastAt: 0, armed: false, acc: 0, dist: 0, endTimer: 0 };

        const ind = () => indicator || (indicator = createIndicator());

        // Place the spinner over the list's horizontal centre, `dist` px
        // below the list's top edge.
        const place = (c, dist, animate) => {
            const el = ind();
            let left = window.innerWidth / 2, top = 0;
            if (c && c.getBoundingClientRect) {
                const r = c.getBoundingClientRect();
                if (r.width) left = r.left + r.width / 2;
                top = Math.max(0, r.top);
            }
            const progress = Math.max(0, Math.min(1, dist / THRESHOLD));
            el.style.transition = animate ? "transform 220ms ease, opacity 220ms ease" : "none";
            el.style.left = left + "px";
            el.style.top = top + "px";
            el.style.opacity = String(dist > 0 ? Math.min(1, 0.25 + progress) : 0);
            el.style.transform = `translateY(${dist - SIZE}px)`;
            const svg = el.firstChild;
            if (svg && !refreshing) {
                svg.style.transform = `rotate(${progress * 270}deg)`;
                const circle = svg.firstChild;
                if (circle) circle.setAttribute("stroke-dashoffset", String(56.5 * (1 - progress * 0.75)));
            }
        };

        const hide = (c) => {
            if (!indicator) return;
            place(c, 0, true);
        };

        const trigger = (c) => {
            const { onRefresh: run } = optsRef.current;
            if (refreshing || typeof run !== "function") { hide(c); return; }
            refreshing = true;
            place(c, HOLD_AT, true);
            const el = ind();
            const circle = el.firstChild && el.firstChild.firstChild;
            if (circle) circle.setAttribute("stroke-dashoffset", String(56.5 * 0.25));
            el.firstChild.style.transform = "";
            el.classList.add("px-ptr-spinning");
            const startedAt = Date.now();
            let work;
            try { work = Promise.resolve(run()); } catch (e) { work = Promise.resolve(); }
            const capped = Promise.race([
                work.catch(() => {}),
                new Promise((r) => setTimeout(r, MAX_SPIN_MS)),
            ]);
            capped.then(() => {
                const wait = Math.max(0, MIN_SPIN_MS - (Date.now() - startedAt));
                setTimeout(() => {
                    refreshing = false;
                    if (!alive || !indicator) return;
                    indicator.classList.remove("px-ptr-spinning");
                    hide(c);
                }, wait);
            });
        };

        const resolveContainer = (target) => {
            const { getContainer: get, enabled: on } = optsRef.current;
            if (!on || refreshing || typeof get !== "function") return null;
            const c = get();
            if (!c || !c.isConnected) return null;
            if (target && !c.contains(target)) return null;
            return c;
        };

        // ── Touch ──────────────────────────────────────────────────────
        const onTouchStart = (e) => {
            touch = null;
            if (!e.touches || e.touches.length !== 1) return;
            const c = resolveContainer(e.target);
            if (!c || c.scrollTop > 0) return;
            const t = e.touches[0];
            touch = { y0: t.clientY, x0: t.clientX, c, active: false, dist: 0 };
        };

        const onTouchMove = (e) => {
            if (!touch) return;
            const t = e.touches && e.touches[0];
            if (!t || e.touches.length !== 1) { if (touch.active) hide(touch.c); touch = null; return; }
            const dy = t.clientY - touch.y0, dx = t.clientX - touch.x0;
            if (!touch.active) {
                if (dy < 0 || touch.c.scrollTop > 0) { touch = null; return; }
                if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > START_SLOP) { touch = null; return; }
                if (dy < START_SLOP) return;
                touch.active = true;
                touch.y0 += START_SLOP;
            }
            // The list scrolled after all (momentum, nested scroller): let go.
            if (touch.c.scrollTop > 0) { hide(touch.c); touch = null; return; }
            const pull = Math.max(0, t.clientY - touch.y0);
            touch.dist = Math.min(MAX_PULL, pull * DAMPING);
            if (e.cancelable) e.preventDefault();
            place(touch.c, touch.dist, false);
        };

        const onTouchEnd = (e) => {
            if (!touch) return;
            const { c, active, dist } = touch;
            touch = null;
            if (!active) return;
            if (e.type === "touchend" && dist >= THRESHOLD) trigger(c);
            else hide(c);
        };

        // ── Wheel (desktop) ────────────────────────────────────────────
        const endWheel = () => {
            const c = wheel.c;
            wheel.endTimer = 0;
            const dist = wheel.dist;
            wheel.armed = false; wheel.acc = 0; wheel.dist = 0;
            if (dist >= THRESHOLD) trigger(c);
            else hide(c);
        };

        const onWheel = (e) => {
            const now = Date.now();
            const newGesture = now - wheel.lastAt > WHEEL_GESTURE_GAP_MS;
            wheel.lastAt = now;
            const c = resolveContainer(e.target);
            if (!c) return;
            if (newGesture) {
                wheel.armed = c.scrollTop <= 0 && e.deltaY < 0;
                wheel.acc = 0; wheel.dist = 0; wheel.c = c;
            }
            if (!wheel.armed) return;
            if (e.deltaY > 0 || c.scrollTop > 0) {
                wheel.armed = false; wheel.acc = 0; wheel.dist = 0;
                if (wheel.endTimer) { clearTimeout(wheel.endTimer); wheel.endTimer = 0; }
                hide(c);
                return;
            }
            const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
            wheel.acc += -e.deltaY * unit;
            wheel.dist = Math.min(MAX_PULL, wheel.acc * WHEEL_DAMPING);
            place(c, wheel.dist, false);
            if (wheel.endTimer) clearTimeout(wheel.endTimer);
            wheel.endTimer = setTimeout(endWheel, WHEEL_GESTURE_GAP_MS);
        };

        const capPassive = { capture: true, passive: true };
        const capActive = { capture: true, passive: false };
        document.addEventListener("touchstart", onTouchStart, capPassive);
        document.addEventListener("touchmove", onTouchMove, capActive);
        document.addEventListener("touchend", onTouchEnd, capPassive);
        document.addEventListener("touchcancel", onTouchEnd, capPassive);
        document.addEventListener("wheel", onWheel, capPassive);

        return () => {
            alive = false;
            document.removeEventListener("touchstart", onTouchStart, capPassive);
            document.removeEventListener("touchmove", onTouchMove, capActive);
            document.removeEventListener("touchend", onTouchEnd, capPassive);
            document.removeEventListener("touchcancel", onTouchEnd, capPassive);
            document.removeEventListener("wheel", onWheel, capPassive);
            if (wheel.endTimer) clearTimeout(wheel.endTimer);
            if (indicator && indicator.parentNode) indicator.parentNode.removeChild(indicator);
            indicator = null;
        };
    }, []);
}
