/**
 * PublishLogoLoader
 * ─────────────────────────────────────────────────────────────────────────────
 * Full-screen overlay shown the instant a post is broadcast, after the NewPost
 * dialog closes. A WebGL particle field of small squares is scattered across
 * the viewport, gathers inward to draw the white area of the Pixagram mark,
 * holds for a beat, then detonates outward in a "big bang" before fading.
 *
 * The whole timeline runs in ~5s, then the overlay dismisses itself via
 * `onDone`. It does NOT reload the page — whatever in-page feed refresh the app
 * already performs is what surfaces the new post.
 *
 * Self-contained: the logo geometry is sampled at runtime from the inlined SVG
 * (no asset fetch), and everything tears down cleanly on unmount. When WebGL is
 * unavailable or the user prefers reduced motion it simply dismisses (no image).
 *
 * Props
 *   open          {boolean}        mount/animate (default true)
 *   onDone        {function}       called when the timeline finishes / dismisses
 *   holdAfterMs   {number}         ms to linger after the animation ends (default 300)
 *   particleCount {number}         square count (default 11000)
 */
import * as React from "preact/compat";
import { useEffect, useRef } from "preact/compat";
import Portal from "@material-ui/core/Portal";

// ── The Pixagram mark. The white-filled path is what the particles draw. The
//    blur filter is stripped before rasterizing so the sampled mask has crisp
//    edges (the glow is recreated by additive blending of the particles). ──────
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2500 2500"><path d="M1150 2200h860c104.864 0 190-85.136 190-190V490c0-104.864-85.136-190-190-190H490c-104.864 0-190 85.136-190 190v1520c0 104.864 85.136 190 190 190h260v-530h0v-420-420c0-44.153 35.847-80 80-80h840c44.153 0 80 35.847 80 80v840c0 44.153-35.847 80-80 80h-520 0 0v450zm240-1150h-280 0 0 0c-33.115 0-60 26.885-60 60h0v280c0 33.115 26.885 60 60 60h280c33.115 0 60-26.885 60-60h0v-280c0-33.115-26.885-60-60-60zm490.82-568h-194c-27.496 0-49.82 22.324-49.82 49.82v88.36c0 27.496 22.324 49.82 49.82 49.82H1750q40.5 2.5 59 18c18.5 15.5 21.438 47.625 22 62v64.18c0 27.496 22.324 49.82 49.82 49.82h88.36c27.496 0 49.82-22.324 49.82-49.82v-194h0v-88.36c0-27.496-22.324-49.82-49.82-49.82h0-88.36 0 0 0z" fill-rule="evenodd" fill="#fff"/></svg>`;

// ── Animation timeline (seconds) ─────────────────────────────────────────────
const T_GATHER = 2.5;                  // scattered → formed
const T_HOLD = 1.0;                    // formed, breathing
const T_BANG = 1.5;                    // explode outward + fade
const HOLD_END = T_GATHER + T_HOLD;    // 3.4
const BANG_END = HOLD_END + T_BANG;    // 5.0
const FADE_OUT_MS = 320;               // overlay fades opacity 1→0 before unmount

// Fraction of the viewport's shorter side the formed logo occupies.
const LOGO_FRAC = 0.50;

// ── Shaders ──────────────────────────────────────────────────────────────────
const VERT_SRC = `
precision highp float;

attribute vec2  aTarget;   // formed position (logo), normalized centered, y-up
attribute vec2  aStart;    // scattered start position
attribute vec2  aScatter;  // big-bang displacement vector
attribute float aSeed;     // per-particle randomness [0,1)
attribute float aSize;     // base point size (css px, pre-dpr)

uniform float uTime;       // seconds since start
uniform vec2  uScale;      // normalized → clip, aspect-corrected
uniform float uDpr;

varying float vAlpha;
varying float vSeed;
varying float vBang;       // 0 during form/hold, 0..1 across the explosion

const float GATHER   = ${T_GATHER.toFixed(3)};
const float HOLD_END = ${HOLD_END.toFixed(3)};
const float BANG     = ${T_BANG.toFixed(3)};

vec2 rot(vec2 p, float a) {
    float c = cos(a), s = sin(a);
    return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}
float easeOutCubic(float x) { return 1.0 - pow(1.0 - x, 3.0); }

void main() {
    float t = uTime;
    vec2  pos;
    float alpha;
    float sizeMul;
    float bang = 0.0;

    if (t < GATHER) {
        // Fly in from the scattered ring, unwinding a per-particle swirl.
        float k = easeOutCubic(clamp(t / GATHER, 0.0, 1.0));
        float ang = (1.0 - k) * 3.0 * (aSeed - 0.5);
        vec2  s = rot(aStart, ang);
        pos = mix(s, aTarget, k);
        alpha = clamp(k * 1.7, 0.0, 1.0);
        sizeMul = mix(0.45, 1.0, k);
    } else if (t < HOLD_END) {
        // Hold the formed mark with a gentle, per-particle breathing pulse.
        float h = (t - GATHER) / (HOLD_END - GATHER);
        pos = aTarget;
        alpha = 1.0;
        sizeMul = 1.0 + 0.06 * sin(h * 6.2831853 + aSeed * 6.2831853);
    } else {
        // Big bang: accelerate outward, twist a little, grow then thin out.
        float b = clamp((t - HOLD_END) / BANG, 0.0, 1.0);
        bang = b;
        float eased = b * b;
        vec2  off = rot(aScatter * eased, b * 1.3 * (aSeed - 0.5));
        pos = aTarget + off;
        alpha = 1.0 - smoothstep(0.32, 1.0, b);
        sizeMul = mix(1.0, 1.9, b) * (1.0 - 0.45 * b);
    }

    gl_Position = vec4(pos * uScale, 0.0, 1.0);
    gl_PointSize = max(1.0, aSize * uDpr * sizeMul);
    vAlpha = alpha;
    vSeed = aSeed;
    vBang = bang;
}
`;

const FRAG_SRC = `
precision highp float;

varying float vAlpha;

void main() {
    // Square sprite with a 1px-ish antialiased edge (chebyshev distance).
    vec2 pc = gl_PointCoord - 0.5;
    float d = max(abs(pc.x), abs(pc.y));
    float mask = 1.0 - smoothstep(0.44, 0.5, d);
    if (mask <= 0.001) discard;

    // Pure white throughout — gather, hold, and explosion alike.
    gl_FragColor = vec4(1.0, 1.0, 1.0, vAlpha * mask);
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// Geometry sampling: rasterize the (un-blurred) mark, then pick `count` opaque
// pixels at random for an even, area-weighted fill. Returns normalized,
// centered, y-up target positions in [-0.5, 0.5].
// ─────────────────────────────────────────────────────────────────────────────
function sampleLogoTargets(count) {
    return new Promise((resolve) => {
        const S = 560; // raster resolution (square viewBox)
        const img = new Image();
        const crisp = LOGO_SVG.replace(/\s*filter="url\(#B\)"/g, "");
        const url =
            "data:image/svg+xml;utf8," + encodeURIComponent(crisp);

        const finish = (targets) => resolve(targets);

        img.onload = () => {
            try {
                const cv = document.createElement("canvas");
                cv.width = S;
                cv.height = S;
                const ctx = cv.getContext("2d");
                if (!ctx) return finish(null);
                ctx.clearRect(0, 0, S, S);
                ctx.drawImage(img, 0, 0, S, S);
                const data = ctx.getImageData(0, 0, S, S).data;

                // Collect opaque (white) pixel coordinates.
                const xs = [];
                const ys = [];
                for (let y = 0; y < S; y++) {
                    for (let x = 0; x < S; x++) {
                        if (data[(y * S + x) * 4 + 3] > 160) {
                            xs.push(x);
                            ys.push(y);
                        }
                    }
                }
                const pool = xs.length;
                if (pool === 0) return finish(null);

                const out = new Float32Array(count * 2);
                for (let i = 0; i < count; i++) {
                    const j = (Math.random() * pool) | 0;
                    // jitter inside the pixel so the fill never looks gridded
                    const nx = (xs[j] + Math.random()) / S - 0.5;
                    const ny = 0.5 - (ys[j] + Math.random()) / S; // flip y → up
                    out[i * 2] = nx;
                    out[i * 2 + 1] = ny;
                }
                finish(out);
            } catch (e) {
                finish(null);
            }
        };
        img.onerror = () => finish(null);
        img.src = url;
    });
}

// Compile + link helpers.
function makeShader(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh);
        return null;
    }
    return sh;
}
function makeProgram(gl) {
    const vs = makeShader(gl, gl.VERTEX_SHADER, VERT_SRC);
    const fs = makeShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        gl.deleteProgram(prog);
        return null;
    }
    return prog;
}

function prefersReducedMotion() {
    try {
        return (
            window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
        );
    } catch (e) {
        return false;
    }
}

export default function PublishLogoLoader(props) {
    const {
        open = true,
        onDone,
        holdAfterMs = 320,
        particleCount = 7200,
    } = props;

    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const onDoneRef = useRef(onDone);
    onDoneRef.current = onDone;

    useEffect(() => {
        if (!open) return undefined;

        let raf = 0;
        let doneTimer = 0;
        let fadeTimer = 0;
        let gl = null;
        let program = null;
        let buffers = [];
        let loseExt = null;
        let cancelled = false;
        let removeResize = null;

        const startTime = performance.now();

        // Fade the overlay out (opacity 1 → 0 over FADE_OUT_MS), then unmount.
        const dismiss = () => {
            const el = containerRef.current;
            if (el) {
                el.style.animation = "none";        // drop the fade-in fill state
                el.style.transition = "opacity " + FADE_OUT_MS + "ms ease";
                void el.offsetWidth;                // reflow so the transition runs
                el.style.opacity = "0";
            }
            fadeTimer = window.setTimeout(() => {
                if (onDoneRef.current) onDoneRef.current();
            }, FADE_OUT_MS);
        };

        // Dismiss once the animation has played out. No page reload — the app's
        // own in-page refresh is left to surface the new post.
        const scheduleFinish = () => {
            doneTimer = window.setTimeout(dismiss, BANG_END * 1000 + holdAfterMs);
        };

        // ── No WebGL / reduced motion: nothing to draw and no static image is
        //    shown, so dismiss promptly. ───────────────────────────────────────
        const runFallback = () => {
            doneTimer = window.setTimeout(dismiss, 500);
        };

        if (prefersReducedMotion()) {
            runFallback();
            return cleanup;
        }

        const canvas = canvasRef.current;
        if (!canvas) return undefined;

        try {
            gl =
                canvas.getContext("webgl", {
                    alpha: true,
                    antialias: true,
                    premultipliedAlpha: false,
                    depth: false,
                    preserveDrawingBuffer: false,
                }) ||
                canvas.getContext("experimental-webgl", { alpha: true });
        } catch (e) {
            gl = null;
        }

        if (!gl) {
            runFallback();
            return cleanup;
        }

        program = makeProgram(gl);
        if (!program) {
            runFallback();
            return cleanup;
        }

        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        const locs = {
            aTarget: gl.getAttribLocation(program, "aTarget"),
            aStart: gl.getAttribLocation(program, "aStart"),
            aScatter: gl.getAttribLocation(program, "aScatter"),
            aSeed: gl.getAttribLocation(program, "aSeed"),
            aSize: gl.getAttribLocation(program, "aSize"),
            uTime: gl.getUniformLocation(program, "uTime"),
            uScale: gl.getUniformLocation(program, "uScale"),
            uDpr: gl.getUniformLocation(program, "uDpr"),
        };

        const sizeCanvas = () => {
            const w = canvas.clientWidth || window.innerWidth;
            const h = canvas.clientHeight || window.innerHeight;
            const pw = Math.max(1, Math.round(w * dpr));
            const ph = Math.max(1, Math.round(h * dpr));
            if (canvas.width !== pw || canvas.height !== ph) {
                canvas.width = pw;
                canvas.height = ph;
            }
            gl.viewport(0, 0, canvas.width, canvas.height);
            // Keep the (square) logo square regardless of aspect: map the
            // shorter side to LOGO_FRAC of clip space.
            const minDim = Math.min(w, h);
            gl.useProgram(program);
            gl.uniform2f(
                locs.uScale,
                (LOGO_FRAC * minDim * 2) / w,
                (LOGO_FRAC * minDim * 2) / h
            );
            gl.uniform1f(locs.uDpr, dpr);
        };

        const setupBuffers = (targets) => {
            const n = targets.length / 2;
            const starts = new Float32Array(n * 2);
            const scatter = new Float32Array(n * 2);
            const seeds = new Float32Array(n);
            const sizes = new Float32Array(n);

            for (let i = 0; i < n; i++) {
                const tx = targets[i * 2];
                const ty = targets[i * 2 + 1];

                // Scattered start: a ring around / beyond the logo.
                const a = Math.random() * Math.PI * 2;
                const r = 0.75 + Math.random() * 0.95;
                starts[i * 2] = Math.cos(a) * r;
                starts[i * 2 + 1] = Math.sin(a) * r;

                // Big-bang vector: mostly radial from center, jittered, so the
                // formed mark blows apart evenly (center particles get a random
                // direction since their radial component is ~0).
                let dx = tx + (Math.random() - 0.5) * 0.7;
                let dy = ty + (Math.random() - 0.5) * 0.7;
                const len = Math.hypot(dx, dy) || 1;
                const speed = 1.3 + Math.random() * 1.7;
                scatter[i * 2] = (dx / len) * speed;
                scatter[i * 2 + 1] = (dy / len) * speed;

                seeds[i] = Math.random();
                sizes[i] = 3.0 + Math.random() * 2.4; // css px (pre-dpr)
            }

            const mkBuf = (arr, loc, size) => {
                const b = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, b);
                gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
                gl.enableVertexAttribArray(loc);
                gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
                buffers.push(b);
            };

            gl.useProgram(program);
            mkBuf(targets, locs.aTarget, 2);
            mkBuf(starts, locs.aStart, 2);
            mkBuf(scatter, locs.aScatter, 2);
            mkBuf(seeds, locs.aSeed, 1);
            mkBuf(sizes, locs.aSize, 1);

            return n;
        };

        // Boot once the geometry is sampled.
        sampleLogoTargets(particleCount).then((targets) => {
            if (cancelled) return;
            if (!targets) {
                runFallback();
                return;
            }

            const count = setupBuffers(targets);

            gl.disable(gl.DEPTH_TEST);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive → particles bloom
            gl.clearColor(0, 0, 0, 0);

            sizeCanvas();
            const onResize = () => sizeCanvas();
            window.addEventListener("resize", onResize, { passive: true });
            removeResize = () => window.removeEventListener("resize", onResize);

            loseExt = gl.getExtension("WEBGL_lose_context");
            scheduleFinish();

            const frame = () => {
                if (cancelled) return;
                const t = (performance.now() - startTime) / 1000;

                gl.clear(gl.COLOR_BUFFER_BIT);
                gl.useProgram(program);
                gl.uniform1f(locs.uTime, t);
                gl.drawArrays(gl.POINTS, 0, count);

                // Everything has faded by BANG_END; stop drawing and let the
                // overlay dismiss itself (scheduleFinish).
                if (t < BANG_END + 0.25) {
                    raf = requestAnimationFrame(frame);
                }
            };
            raf = requestAnimationFrame(frame);
        });

        function cleanup() {
            cancelled = true;
            if (raf) cancelAnimationFrame(raf);
            if (doneTimer) clearTimeout(doneTimer);
            if (fadeTimer) clearTimeout(fadeTimer);
            if (removeResize) removeResize();
            if (gl) {
                try {
                    buffers.forEach((b) => gl.deleteBuffer(b));
                    if (program) gl.deleteProgram(program);
                    if (loseExt) loseExt.loseContext();
                } catch (e) {
                    /* noop */
                }
            }
            buffers = [];
        }

        return cleanup;
        // holdAfterMs / particleCount are read once at mount by design.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    if (!open) return null;

    return (
        <Portal container={document.body}>
            <div
                ref={containerRef}
                aria-hidden="true"
                style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 2147483000,
                    pointerEvents: "auto",
                    // Transparent scrim — only a soft frosted blur, no dark fill,
                    // so the live page shows through behind the particles.
                    background: "#00000040",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    animation: "pixaLoaderFade 320ms ease both",
                    overflow: "hidden",
                    touchAction: "none",
                    userSelect: "none",
                }}
            >
                <style>{`@keyframes pixaLoaderFade{from{opacity:0}to{opacity:1}}`}</style>

                <canvas
                    ref={canvasRef}
                    style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        display: "block",
                        pointerEvents: "none",
                        // Screen blend: black renders as transparent, so only the
                        // white particles composite (glow) over the live page.
                        mixBlendMode: "screen",
                    }}
                />
            </div>
        </Portal>
    );
}