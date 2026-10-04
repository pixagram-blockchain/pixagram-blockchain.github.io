import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import { formatAmount, formatFiatFromUsd } from "../utils/numberFormat";

/*
 * RewardClaimAnimation — the moment a reward claim lands (wallet → History →
 * "Claim reward"), played once the claim_reward_balance broadcast succeeded.
 *
 * Always 6 s, in three acts:
 *   0 → 1 s  the app behind greys out and blurs. Home / Index's rainbow, cut
 *            as an ellipse around a hole for the numbers, springs open from
 *            the centre point with a bounce; its colour rings widen outward
 *            until they cover the whole screen. The wallet total fades in,
 *            then the rewards drop into a queue above it, top to bottom.
 *   1 → 4 s  the ellipse breathes. Each reward > 0 ("+ 121.750 PXA ($14.51)")
 *            counts down to zero while the total climbs by the same value —
 *            one currency after the other, the 3 s shared evenly: 3 s for one
 *            currency, 1.5 s each for two, 1 s each for three.
 *   4 → 6 s  the rings squeeze together while the ellipse widens, and the
 *            tightened rainbow flies out past the screen edges, fading.
 *
 * The rainbow is drawn on a canvas (one gradient fill a frame, at half
 * resolution — it is soft anyway): its rings must move relative to each
 * other, which no transform of a CSS gradient can do. The numbers tick in the
 * same frame loop, written straight into their text nodes; the component
 * never re-renders after mount. Entrances and fades run as Web Animations.
 * Click, tap or Escape skips to the closing act.
 *
 * Props
 *   claim         { startUsd, items: [{ symbol, amount, usd }] } — the total
 *                 before the claim and the rewards > 0, in filling order
 *   fiatRate      USD → display-currency rate (PixaWalletDialog's fiatRate)
 *   currency      display currency code (CHF, USD, …)
 *   announcement  sentence read to screen readers
 *   onDone        called once the last frame has played (unmount then)
 */

// ── Timeline (ms) ────────────────────────────────────────────────────────────
const OPEN_MS = 1000;
const FILL_MS = 3000;
const CLOSE_MS = 2000;
const CLOSE_AT = OPEN_MS + FILL_MS;
const TOTAL_MS = CLOSE_AT + CLOSE_MS;
const at = (ms) => ms / TOTAL_MS; // time on the timeline → keyframe offset

// Opening, after the ellipse's first bounce: the total fades in, then the
// rewards drop into their queue one after the other, top to bottom.
const TOTAL_IN_AT = 300;
const TOTAL_IN_MS = 380;
const QUEUE_AT = 520;
const QUEUE_STAGGER_MS = 110;
const QUEUE_IN_MS = 340;

const TOKEN_DECIMALS = 3; // PXA / PXS chain precision (PXP shown alike)
const FIAT_DECIMALS = 2;  // cents, so the climb visibly rolls

// ── The rainbow ──────────────────────────────────────────────────────────────
// Home's and Index's rainbow: transparent → violet → blue → cyan → lime →
// orange → deep red → transparent, between 31 % and 61 % of the ray,
// interpolated `in hsl shorter hue`. A canvas gradient only interpolates in
// sRGB, so each span is pre-split into HSL steps (premultiplied, shorter
// hue — the CSS rule), which renders the same band.
const RAINBOW = [
    ["transparent", 31], ["#f000ff6b", 36], ["#0095ffdb", 42], ["#0cffe9ba", 46],
    ["#d8ff00b5", 50], ["#f59300c2", 53], ["#6f0000c7", 57], ["transparent", 61],
];
const DEEP_RED_X = (57 - 31) / 30; // where the last colour peaks, across the band

// Geometry is measured in "hole units": 1 is the edge of the hole the numbers
// sit in. At rest the band starts there and its rings widen outward
// geometrically — the outermost this many times wider than the innermost —
// so the deep red reaches past the screen corners.
const SPREAD = 6;
// Breathing (1 → 4 s): every ring swells and settles, the outer ones more
// and a little later, like a breath travelling outward.
const BREATH_PERIOD_MS = 1500;
const BREATH_INNER = 0.02;
const BREATH_OUTER = 0.07;
const BREATH_LAG = 1.2;   // radians across the band
const BREATH_GLOW = 0.1;  // and it brightens a little on each inhale
// Exit: the band tightens to this width (a fraction of its inner radius,
// about the proportions of the original ring) while it flies out.
const EXIT_BAND = 0.42;
// Bouncy opening: a damped spring, ~27 % overshoot, settled within ~1 s.
const SPRING_ZETA = 0.38;
const SPRING_OMEGA = 2 * Math.PI * 1.6;
const SPRING_OMEGA_D = SPRING_OMEGA * Math.sqrt(1 - SPRING_ZETA * SPRING_ZETA);
const CANVAS_RES = 0.5; // canvas pixels per CSS pixel

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smoothstep = (from, to, x) => {
    const p = clamp01((x - from) / (to - from));
    return p * p * (3 - 2 * p);
};
const easeInOutCubic = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
const mix = (a, b, f) => a + (b - a) * f;
// Position across the band (0 → 1) → share of its width, rings widening by
// `spread` from the inside out (spread 1: evenly, as on Home).
const widen = (x, spread) => (Math.abs(spread - 1) < 1e-4 ? x : (Math.pow(spread, x) - 1) / (spread - 1));
const spring = (ms) => {
    if (ms <= 0) return 0;
    const s = ms / 1000;
    const decay = Math.exp(-SPRING_ZETA * SPRING_OMEGA * s);
    return 1 - decay * (Math.cos(SPRING_OMEGA_D * s)
        + ((SPRING_ZETA * SPRING_OMEGA) / SPRING_OMEGA_D) * Math.sin(SPRING_OMEGA_D * s));
};

// ── Colour stops, built once ─────────────────────────────────────────────────
const TRANSPARENT = { h: NaN, s: 0, l: 0, a: 0 };
const hexToHsla = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const r = ((n >>> 24) & 255) / 255;
    const g = ((n >>> 16) & 255) / 255;
    const b = ((n >>> 8) & 255) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    let h = NaN;
    let s = 0;
    if (d > 0) {
        s = d / (1 - Math.abs(2 * l - 1));
        h = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
        if (h < 0) h += 360;
    }
    return { h, s, l, a: (n & 255) / 255 };
};
const hslaToCss = ({ h, s, l, a }) => {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hp = (Number.isFinite(h) ? h : 0) / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    const [r, g, b] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x]
        : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
    const m = l - c / 2;
    const to255 = (v) => Math.round((v + m) * 255);
    return `rgba(${to255(r)},${to255(g)},${to255(b)},${a.toFixed(3)})`;
};
// CSS Color 4 interpolation `in hsl shorter hue`: a missing hue (transparent)
// takes the other end's, saturation and lightness blend premultiplied by
// alpha — so fading to transparent never passes through black.
const mixHsla = (c1, c2, f) => {
    const a = mix(c1.a, c2.a, f);
    const h1 = c1.a > 0 ? c1.h : c2.h;
    const h2 = c2.a > 0 ? c2.h : c1.h;
    const dh = ((((h2 - h1) % 360) + 540) % 360) - 180;
    if (a <= 0) return { ...(c1.a > 0 ? c1 : c2), a: 0 };
    return {
        h: (h1 + dh * f + 360) % 360,
        s: (c1.s * c1.a * (1 - f) + c2.s * c2.a * f) / a,
        l: (c1.l * c1.a * (1 - f) + c2.l * c2.a * f) / a,
        a,
    };
};
const RAINBOW_STEPS = 6;
const STOPS = (() => {
    const colours = RAINBOW.map(([c]) => (c === "transparent" ? TRANSPARENT : hexToHsla(c)));
    const stops = [];
    for (let i = 0; i < RAINBOW.length - 1; i++) {
        for (let j = 0; j < RAINBOW_STEPS; j++) {
            const f = j / RAINBOW_STEPS;
            const pos = mix(RAINBOW[i][1], RAINBOW[i + 1][1], f);
            stops.push({ x: (pos - 31) / 30, color: hslaToCss(mixHsla(colours[i], colours[i + 1], f)) });
        }
    }
    const last = colours.length - 1;
    stops.push({ x: 1, color: hslaToCss(mixHsla(colours[last - 1], colours[last], 1)) });
    return stops;
})();

// ── Easing (Web Animations) ──────────────────────────────────────────────────
const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
const EASE_IN = "cubic-bezier(0.5, 0, 0.75, 0)";
const EASE_IN_OUT = "cubic-bezier(0.65, 0, 0.35, 1)";
const EASE_LAND = "cubic-bezier(0.34, 1.56, 0.64, 1)"; // drops in, lands with a small bounce

const styles = (theme) => ({
    root: {
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        // Above the wallet (drawer + 1) and its white confirm dialog (modal).
        zIndex: theme.zIndex.modal + 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        userSelect: "none",
        touchAction: "none",
        WebkitTapHighlightColor: "transparent",
    },
    backdrop: {
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        backdropFilter: "grayscale(1) blur(12px)",
        WebkitBackdropFilter: "grayscale(1) blur(12px)",
    },
    rainbow: {
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
    },
    content: {
        position: "relative",
    },
    fit: {
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        color: "#ffffff",
        textShadow: "0 2px 16px rgba(0, 0, 0, 0.6)",
    },
    line: {
        whiteSpace: "nowrap",
        fontSize: "clamp(13px, min(1.9vw, 2.9vh), 19px)",
        lineHeight: 1.6,
        fontVariantNumeric: "tabular-nums",
        color: "rgba(255, 255, 255, 0.55)",
        transition: "color 300ms ease, opacity 450ms ease",
        "&[data-state='active']": {
            color: "#ffffff",
        },
        "&[data-state='done']": {
            opacity: 0.4,
        },
    },
    lineFiat: {
        opacity: 0.72,
    },
    total: {
        whiteSpace: "nowrap",
        marginTop: 6,
        fontSize: "clamp(28px, min(6.5vw, 9vh), 64px)",
        fontWeight: 600,
        lineHeight: 1.15,
        letterSpacing: "-0.02em",
        fontVariantNumeric: "tabular-nums",
    },
    srOnly: {
        position: "absolute",
        width: 1,
        height: 1,
        margin: -1,
        padding: 0,
        border: 0,
        overflow: "hidden",
        clip: "rect(0 0 0 0)",
        whiteSpace: "nowrap",
    },
});

class RewardClaimAnimation extends React.Component {
    constructor(props) {
        super(props);
        this._lines = [];          // per reward line: { row, amount, fiat } nodes
        this._written = new Map(); // node → last text written, to skip no-op writes
        this._radii = new Float64Array(STOPS.length);
        this._animations = [];
        this._geo = null;
        this._reduce = false;
        this._raf = 0;
        this._t0 = null;
        this._skipped = 0;         // ms jumped over by a skip
        this._done = false;
    }

    // Everything after mount is written straight into the DOM / canvas; a
    // re-render would only put the opening values back for a frame.
    shouldComponentUpdate() {
        return false;
    }

    componentDidMount() {
        this._reduce = typeof window.matchMedia === "function"
            && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        this._ctx = this._canvasEl && this._canvasEl.getContext ? this._canvasEl.getContext("2d") : null;
        this._layout();
        this._start_motion();
        this._raf = requestAnimationFrame(this._tick);
        this._arm_watchdog(TOTAL_MS);
        window.addEventListener("keydown", this._on_key_down);
        window.addEventListener("resize", this._layout);
        // A live region only speaks about changes made after it exists, so
        // the summary is written a beat after mount. (The ticking numbers are
        // aria-hidden: sixty updates a second are not speech.)
        this._announce_timer = setTimeout(this._announce, 150);
    }

    componentWillUnmount() {
        this._done = true;
        cancelAnimationFrame(this._raf);
        clearTimeout(this._watchdog);
        clearTimeout(this._announce_timer);
        window.removeEventListener("keydown", this._on_key_down);
        window.removeEventListener("resize", this._layout);
        this._animations.forEach((a) => { try { a.cancel(); } catch (e) { /* already gone */ } });
        this._animations = [];
    }

    // ── Numbers ─────────────────────────────────────────────────────────────

    // What every line still has to pour, and the total reached, `elapsed` ms
    // into the timeline. Each currency owns an equal slot of the fill act and
    // eases in and out of it, so the total settles between currencies.
    _frame(elapsed) {
        const { startUsd, items } = this.props.claim;
        const slot = FILL_MS / items.length;
        const filled = Math.min(Math.max(elapsed - OPEN_MS, 0), FILL_MS);
        let poured = 0;
        const lines = items.map((item, i) => {
            const raw = clamp01((filled - i * slot) / slot);
            const p = easeInOutCubic(raw);
            poured += item.usd * p;
            return {
                amount: item.amount * (1 - p),
                usd: item.usd * (1 - p),
                state: raw >= 1 ? "done" : raw > 0 ? "active" : "pending",
            };
        });
        return { lines, totalUsd: startUsd + poured };
    }

    _fiat(usd) {
        const { fiatRate, currency } = this.props;
        return formatFiatFromUsd(usd, fiatRate > 0 ? fiatRate : 1, currency || "USD", FIAT_DECIMALS);
    }

    _amount(amount, symbol) {
        return formatAmount(amount, symbol, TOKEN_DECIMALS);
    }

    _write(node, text) {
        if (node && this._written.get(node) !== text) {
            node.textContent = text;
            this._written.set(node, text);
        }
    }

    _paint_numbers(elapsed) {
        const { items } = this.props.claim;
        const frame = this._frame(elapsed);
        frame.lines.forEach((line, i) => {
            const nodes = this._lines[i];
            if (!nodes) return;
            this._write(nodes.amount, this._amount(line.amount, items[i].symbol));
            this._write(nodes.fiat, this._fiat(line.usd));
            if (nodes.row && nodes.row.getAttribute("data-state") !== line.state) {
                nodes.row.setAttribute("data-state", line.state);
            }
        });
        this._write(this._totalEl, this._fiat(frame.totalUsd));
    }

    // ── Rainbow ─────────────────────────────────────────────────────────────

    // Lays the scene out for the current viewport: the hole is fitted around
    // the numbers — the reward lines at their full amounts, the total at its
    // final (longest) value — with the screen's aspect (flatter in landscape,
    // rounder in portrait). When the numbers need more room than the screen
    // allows, they are scaled down to fit instead. From the hole follow how
    // far the rings must reach to cover the corners, and how far the hole
    // must open on exit to clear them. Layout boxes only (offset*), so the
    // entrance and exit transforms never skew the measure.
    _layout = () => {
        const fit = this._fitEl;
        const total = this._totalEl;
        if (!fit || !total) return;
        const vw = window.innerWidth || document.documentElement.clientWidth || 360;
        const vh = window.innerHeight || document.documentElement.clientHeight || 640;
        const k = Math.min(0.85, Math.max(0.58, (vh / vw) * 0.95)); // hole height / width

        const shownText = total.textContent;
        total.textContent = this._fiat(this._frame(TOTAL_MS).totalUsd);
        const cx = fit.offsetWidth / 2;
        const cy = fit.offsetHeight / 2;
        let reach = 0; // hole half-width needed by the most demanding row
        this._lines.map((nodes) => nodes && nodes.row).concat(total).forEach((row) => {
            if (!row) return;
            const dx = Math.max(cx - row.offsetLeft, row.offsetLeft + row.offsetWidth - cx) + 12;
            const dy = (Math.max(cy - row.offsetTop, row.offsetTop + row.offsetHeight - cy) + 6) / k;
            reach = Math.max(reach, Math.sqrt(dx * dx + dy * dy));
        });
        total.textContent = shownText;

        const largest = Math.min(0.46 * vw, (0.44 * vh) / k);
        const a = Math.min(Math.max(reach, Math.min(0.26 * vw, 190)), largest);
        fit.style.transform = reach > a ? `scale(${(a / reach).toFixed(4)})` : "";
        const corner = Math.hypot(vw / 2 / a, vh / 2 / (k * a)); // screen corner, in hole units
        this._geo = {
            vw,
            vh,
            a,
            k,
            // Rest: the deep red peaks just past the corners.
            outer: 1 + (1.03 * corner - 1) / widen(DEEP_RED_X, SPREAD),
            // Exit: the hole ends wider than the screen.
            exitHole: 1.12 * corner,
        };

        const canvas = this._canvasEl;
        if (canvas) {
            canvas.width = Math.max(1, Math.round(vw * CANVAS_RES));
            canvas.height = Math.max(1, Math.round(vh * CANVAS_RES));
        }
    };

    // Shape of the rainbow `t` ms into the timeline, in hole units.
    _rainbow_at(t) {
        const g = this._geo;
        const u = clamp01((t - CLOSE_AT) / CLOSE_MS);
        if (this._reduce) {
            return {
                grow: 1, inner: 1, band: g.outer - 1, spread: SPREAD, breath: 0,
                alpha: clamp01(t / 500) * (1 - smoothstep(0, 1, u)),
            };
        }
        // Exit: the rings close up fast (squeeze) while the hole keeps
        // widening, gathering speed, until it is wider than the screen.
        const squeeze = easeOutCubic(clamp01(u / 0.45));
        const inner = Math.pow(g.exitHole, Math.pow(u, 1.8));
        return {
            grow: spring(t),
            inner,
            band: mix(g.outer - 1, EXIT_BAND * inner, squeeze),
            spread: Math.pow(SPREAD, 1 - squeeze),
            breath: smoothstep(700, 1300, t) * (1 - smoothstep(CLOSE_AT, CLOSE_AT + 350, t)),
            alpha: clamp01(t / 150) * (1 - smoothstep(0.5, 1, u)),
        };
    }

    _draw_rainbow(t) {
        const ctx = this._ctx;
        const g = this._geo;
        if (!ctx || !g) return;
        const canvas = ctx.canvas;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const s = this._rainbow_at(t);
        if (s.alpha <= 0.002 || s.grow <= 0.002) return;

        const phase = (2 * Math.PI * (t - OPEN_MS + 100)) / BREATH_PERIOD_MS;
        const glow = 1 - BREATH_GLOW * s.breath * (1 - Math.sin(phase)) / 2;
        const radii = this._radii;
        let outermost = 0;
        for (let i = 0; i < STOPS.length; i++) {
            const x = STOPS[i].x;
            const breath = 1 + s.breath * mix(BREATH_INNER, BREATH_OUTER, x) * Math.sin(phase - BREATH_LAG * x);
            const rho = s.grow * (s.inner + s.band * widen(x, s.spread)) * breath;
            outermost = radii[i] = Math.max(rho, outermost); // stops must never cross
        }
        // Circle of radius ρ·a in a space squashed by k: the hole's ellipse.
        const resX = canvas.width / g.vw;
        const resY = canvas.height / g.vh;
        ctx.setTransform(resX, 0, 0, resY * g.k, (resX * g.vw) / 2, (resY * g.vh) / 2);
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, outermost * g.a);
        for (let i = 0; i < STOPS.length; i++) gradient.addColorStop(radii[i] / outermost, STOPS[i].color);
        ctx.globalAlpha = s.alpha * glow;
        ctx.fillStyle = gradient;
        ctx.fillRect(-g.vw / 2, -g.vh / (2 * g.k), g.vw, g.vh / g.k);
    }

    _tick = (now) => {
        if (this._done) return;
        if (this._t0 === null) this._t0 = now;
        const elapsed = now - this._t0 + this._skipped;
        this._paint_numbers(elapsed);
        this._draw_rainbow(Math.min(elapsed, TOTAL_MS));
        if (elapsed >= TOTAL_MS) this._finish();
        else this._raf = requestAnimationFrame(this._tick);
    };

    // ── Entrances and fades ─────────────────────────────────────────────────

    _start_motion() {
        const reduce = this._reduce;
        const play = (el, keyframes, timing) => {
            if (!el || typeof el.animate !== "function") return;
            try { this._animations.push(el.animate(keyframes, timing)); } catch (e) { /* decoration only */ }
        };
        const whole = { duration: TOTAL_MS, fill: "both" };
        const away = reduce ? "scale(1)" : "scale(1.12)";

        // The app greys out and blurs; it comes back as the rainbow leaves.
        play(this._backdropEl, [
            { offset: 0, opacity: 0, easing: EASE_OUT },
            { offset: at(400), opacity: 1 },
            { offset: at(CLOSE_AT + 1100), opacity: 1, easing: EASE_IN_OUT },
            { offset: 1, opacity: 0 },
        ], whole);
        // The total fades in once the ellipse has sprung open…
        play(this._totalEl, [
            { opacity: 0, transform: reduce ? "none" : "scale(0.94)" },
            { opacity: 1, transform: "none" },
        ], { delay: TOTAL_IN_AT, duration: TOTAL_IN_MS, easing: EASE_OUT, fill: "backwards" });
        // …then the rewards drop into their queue above it, top to bottom.
        // (fill "backwards" only: once landed, a line's own CSS takes over —
        // its "done" state dims it.)
        this._lines.forEach((nodes, i) => {
            play(nodes && nodes.row, [
                { opacity: 0, transform: reduce ? "none" : "translateY(-0.9em)" },
                { opacity: 1, transform: "none" },
            ], { delay: QUEUE_AT + i * QUEUE_STAGGER_MS, duration: QUEUE_IN_MS, easing: EASE_LAND, fill: "backwards" });
        });
        // All the numbers leave as the closing act begins.
        play(this._contentEl, [
            { offset: 0, opacity: 1, transform: "scale(1)" },
            { offset: at(CLOSE_AT), opacity: 1, transform: "scale(1)", easing: EASE_IN },
            { offset: at(CLOSE_AT + 1000), opacity: 0, transform: away },
            { offset: 1, opacity: 0, transform: away },
        ], whole);
    }

    // ── Lifecycle helpers ───────────────────────────────────────────────────

    // Click, tap or Escape: straight to the closing act — the numbers land on
    // their final values and the rainbow flies out.
    _skip = () => {
        if (this._done || this._t0 === null) return;
        const elapsed = performance.now() - this._t0 + this._skipped;
        if (elapsed >= CLOSE_AT) return;
        this._skipped += CLOSE_AT - elapsed;
        this._animations.forEach((a) => {
            try {
                if ((a.currentTime || 0) < CLOSE_AT) a.currentTime = CLOSE_AT;
            } catch (e) { /* ignore */ }
        });
        this._arm_watchdog(CLOSE_MS);
    };

    _on_key_down = (e) => {
        if (e.key === "Escape" || e.key === "Esc") this._skip();
    };

    // requestAnimationFrame stops in a hidden tab; this still releases the
    // overlay once its time is up.
    _arm_watchdog(ms) {
        clearTimeout(this._watchdog);
        this._watchdog = setTimeout(this._finish, ms + 1000);
    }

    _finish = () => {
        if (this._done) return;
        this._done = true;
        cancelAnimationFrame(this._raf);
        clearTimeout(this._watchdog);
        if (typeof this.props.onDone === "function") this.props.onDone();
    };

    _announce = () => {
        const { announcement, claim } = this.props;
        if (!this._liveEl) return;
        const amounts = claim.items.map((item) => "+" + this._amount(item.amount, item.symbol)).join(", ");
        this._liveEl.textContent = announcement ? `${announcement} (${amounts})` : amounts;
    };

    _line_node(i, key, el) {
        this._lines[i] = this._lines[i] || {};
        this._lines[i][key] = el;
    }

    render() {
        const { classes, claim } = this.props;
        const opening = this._frame(0);
        return React.createPortal(
            <div className={classes.root} onClick={this._skip}>
                <div className={classes.backdrop} ref={(el) => { this._backdropEl = el; }}/>
                <canvas className={classes.rainbow} ref={(el) => { this._canvasEl = el; }} aria-hidden="true"/>
                <div className={classes.content} ref={(el) => { this._contentEl = el; }} aria-hidden="true">
                    <div className={classes.fit} ref={(el) => { this._fitEl = el; }}>
                        {claim.items.map((item, i) => (
                            <div
                                key={item.symbol}
                                className={classes.line + " monospace"}
                                data-state="pending"
                                ref={(el) => this._line_node(i, "row", el)}
                            >
                                {"+ "}
                                <span ref={(el) => this._line_node(i, "amount", el)}>{this._amount(opening.lines[i].amount, item.symbol)}</span>
                                <span className={classes.lineFiat}>
                                    {" ("}<span ref={(el) => this._line_node(i, "fiat", el)}>{this._fiat(opening.lines[i].usd)}</span>{")"}
                                </span>
                            </div>
                        ))}
                        <div className={classes.total + " monospace"} ref={(el) => { this._totalEl = el; }}>
                            {this._fiat(opening.totalUsd)}
                        </div>
                    </div>
                </div>
                <div className={classes.srOnly} role="status" aria-live="polite" ref={(el) => { this._liveEl = el; }}/>
            </div>,
            document.body,
        );
    }
}

export default withStyles(styles)(RewardClaimAnimation);