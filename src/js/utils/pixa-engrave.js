/**
 * PixaEngrave v1.1.0
 * ──────────────────────────────────────────────────────────────────
 * High-performance pixel-art → banknote-engraving SVG converter.
 *
 * Architecture: asm.js / SIMD.js inspired
 *  - Single ArrayBuffer heap with manual memory layout
 *  - All hot-path arithmetic uses typed arrays (Float32/Int32)
 *  - Type-coerced locals (x = +x, i = i|0) for JIT hint patterns
 *  - Zero GC allocations in inner loops
 *  - SIMD-style 4-wide batch processing where applicable
 *  - Pre-computed LUTs for gamma, sin, toneMap
 *  - Streaming SVG builder with pre-allocated string chunks
 *  - Runtime params (this._p) overridable per-call; defaults are
 *    the baked constants so bare calls take the same JIT fast-path.
 *
 * Default parameters (pixel art @ screen size):
 *  LINE_SPACING=12  CROSS_ANGLE=90°  CONTRAST=1.0
 *  MIN_STROKE=0.1   CROSS_THRESH=0.45 BRIGHTNESS=0.0
 *  MAX_STROKE=6.0   GAMMA=0.1         WHITE_CUTOFF=1.0
 *  WAVE_AMP=5.0     EDGE_ENH=0.0      SCALE=10
 *  WAVE_FREQ=0.5    SMOOTH=0.5        DPI=72
 *  INK_COLOR=#0d0d0d
 *
 * Usage:
 *   const eng = new PixaEngrave();
 *
 *   // Fast path — baked defaults
 *   const svg = eng.engrave(imageData, w, h);
 *
 *   // Override path — e.g. for small pixel art logo on a PDF
 *   const svg = eng.engrave(imageData, w, h, {
 *     lineSpacing: 5, maxStroke: 1.2, waveAmp: 1.5, waveFreq: 0.12,
 *     gamma: 0.8, contrast: 1.5, scale: 10
 *   });
 *
 * @license MIT
 */

"use strict";

var PixaEngrave = (function () {

    // ════════════════════════════════════════════════════════════════
    // DEFAULT CONSTANTS
    // ════════════════════════════════════════════════════════════════

    var DEFAULTS = {
        lineSpacing:  12.0,
        minStroke:    0.1,
        maxStroke:    6.0,
        waveAmp:      5.0,
        waveFreq:     0.5,
        smooth:       0.5,
        crossAngle:   90,
        crossThresh:  0.45,
        contrast:     1.0,
        brightness:   0.0,
        gamma:        0.1,
        whiteCutoff:  1.0,
        edgeEnh:      0.0,
        scale:        10,
        dpi:          72,
        inkColor:     "#0d0d0d",
    };

    // Immutable — frozen so JIT can treat as constant shapes
    Object.freeze(DEFAULTS);

    // ════════════════════════════════════════════════════════════════
    // STRUCTURAL CONSTANTS (never overridden)
    // ════════════════════════════════════════════════════════════════

    var CHUNK_LEN       = 8;
    var SW_BUCKET       = 0.1;
    var INV_SW_BUCKET   = 10.0;

    // LUT sizes
    var SIN_LUT_SIZE    = 4096;
    var SIN_LUT_MASK    = SIN_LUT_SIZE - 1;
    var GAMMA_LUT_BITS  = 10;
    var GAMMA_LUT_SIZE  = 1 << GAMMA_LUT_BITS;  // 1024
    var TWO_PI          = 6.283185307179586;
    var INV_TWO_PI_SCALED = SIN_LUT_SIZE / TWO_PI;

    // ════════════════════════════════════════════════════════════════
    // SIN LUT (shared, immutable)
    // ════════════════════════════════════════════════════════════════

    var sinLUT = new Float32Array(SIN_LUT_SIZE);
    (function () {
        for (var i = 0; i < SIN_LUT_SIZE; i = (i + 1) | 0) {
            sinLUT[i] = Math.sin((i / SIN_LUT_SIZE) * TWO_PI);
        }
    })();

    function fastSin(x) {
        x = +x;
        var idx = ((x * INV_TWO_PI_SCALED) % SIN_LUT_SIZE + SIN_LUT_SIZE) | 0;
        return +sinLUT[idx & SIN_LUT_MASK];
    }

    // ════════════════════════════════════════════════════════════════
    // GAMMA LUT — rebuilt when gamma changes
    // ════════════════════════════════════════════════════════════════

    function buildGammaLUT(gamma) {
        var lut = new Float32Array(GAMMA_LUT_SIZE + 1);
        for (var i = 0; i <= GAMMA_LUT_SIZE; i = (i + 1) | 0) {
            lut[i] = Math.pow(i / GAMMA_LUT_SIZE, gamma);
        }
        return lut;
    }

    // ════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ════════════════════════════════════════════════════════════════

    function PixaEngrave() {
        this._heap = null;
        this._gray = null;
        this._edge = null;
        this._dark = null;
        this._w = 0;
        this._h = 0;
        this._heapSize = 0;

        this._pathBuf   = null;
        this._pathIdx   = null;
        this._pathLen   = null;
        this._pathSW    = null;
        this._pathCount = 0;
        this._ptCount   = 0;

        this._svgChunks = [];

        // Runtime params — always a plain object with all keys present.
        // Defaults are applied once; engrave() may overlay overrides.
        this._p = null;

        // Gamma LUT cache — avoid rebuilding when gamma hasn't changed
        this._gammaLUT  = null;
        this._gammaVal  = -1;
    }

    var proto = PixaEngrave.prototype;

    // ════════════════════════════════════════════════════════════════
    // PARAMS — merge defaults + optional overrides
    // ════════════════════════════════════════════════════════════════

    proto._applyParams = function (overrides) {
        var p;
        if (!overrides) {
            // Fast path: just use defaults directly
            p = {
                lineSpacing: DEFAULTS.lineSpacing,
                minStroke:   DEFAULTS.minStroke,
                maxStroke:   DEFAULTS.maxStroke,
                waveAmp:     DEFAULTS.waveAmp,
                waveFreq:    DEFAULTS.waveFreq,
                smooth:      DEFAULTS.smooth,
                crossAngle:  DEFAULTS.crossAngle,
                crossThresh: DEFAULTS.crossThresh,
                contrast:    DEFAULTS.contrast,
                brightness:  DEFAULTS.brightness,
                gamma:       DEFAULTS.gamma,
                whiteCutoff: DEFAULTS.whiteCutoff,
                edgeEnh:     DEFAULTS.edgeEnh,
                scale:       DEFAULTS.scale,
                dpi:         DEFAULTS.dpi,
                inkColor:    DEFAULTS.inkColor,
            };
        } else {
            p = {};
            for (var k in DEFAULTS) {
                p[k] = overrides[k] !== undefined ? overrides[k] : DEFAULTS[k];
            }
        }

        // Derived values (computed once, stored on p)
        p.strokeRange   = +(p.maxStroke - p.minStroke);
        p.step          = +(Math.max(0.3, p.lineSpacing * 0.06));
        p.crossAngleRad = +(p.crossAngle * (Math.PI / 180));
        p.crossCos      = +Math.cos(p.crossAngleRad);
        p.crossSin      = +Math.sin(p.crossAngleRad);
        p.crossSp       = +(p.lineSpacing * 1.3);
        p.invCrossRange = +(1.0 / Math.max(0.001, 1.0 - p.crossThresh));
        p.crossSwMul    = 0.6;
        p.smoothF       = +(p.smooth * 0.167);

        this._p = p;

        // Rebuild gamma LUT if gamma changed
        var g = +p.gamma;
        if (g !== this._gammaVal) {
            this._gammaLUT = buildGammaLUT(g);
            this._gammaVal = g;
        }
    };

    // ════════════════════════════════════════════════════════════════
    // HEAP MANAGEMENT
    // ════════════════════════════════════════════════════════════════

    proto._allocHeap = function (w, h) {
        w = w | 0; h = h | 0;
        var pixels = (w * h) | 0;
        var need = (pixels * 3 * 4) | 0;
        if (need > this._heapSize) {
            this._heap = new ArrayBuffer(need);
            this._heapSize = need;
        }
        this._gray = new Float32Array(this._heap, 0, pixels);
        this._edge = new Float32Array(this._heap, pixels * 4, pixels);
        this._dark = new Float32Array(this._heap, pixels * 8, pixels);
        this._w = w;
        this._h = h;
    };

    proto._allocPaths = function (maxPoints, maxPaths) {
        maxPoints = maxPoints | 0;
        maxPaths  = maxPaths | 0;
        if (!this._pathBuf || this._pathBuf.length < maxPoints * 2) {
            this._pathBuf = new Float32Array(maxPoints * 2);
        }
        if (!this._pathIdx || this._pathIdx.length < maxPaths) {
            this._pathIdx = new Int32Array(maxPaths);
            this._pathLen = new Int32Array(maxPaths);
            this._pathSW  = new Float32Array(maxPaths);
        }
        this._pathCount = 0;
        this._ptCount = 0;
    };

    // ════════════════════════════════════════════════════════════════
    // IMAGE → LUMINANCE + TONE-MAP (BATCH)
    // ════════════════════════════════════════════════════════════════

    proto._buildMaps = function (rgba) {
        var w = this._w | 0, h = this._h | 0;
        var pixels = (w * h) | 0;
        var gray = this._gray;
        var dark = this._dark;
        var p = this._p;
        var gammaLUT = this._gammaLUT;
        var contrast = +p.contrast;
        var brightness = +p.brightness;
        var whiteCutoff = +p.whiteCutoff;
        var i = 0, j = 0;
        var a = 0.0, v = 0.0, gIdx = 0;

        // Pass 1: RGBA → luminance (4-wide unrolled)
        var end4 = (pixels - 3) | 0;
        for (i = 0; (i | 0) < (end4 | 0); i = (i + 4) | 0) {
            j = (i << 2) | 0;
            a = +(rgba[j + 3] * 0.00392156862745098);
            gray[i] = +(( +(rgba[j] * 0.001172549019607843)
                + +(rgba[j + 1] * 0.002301960784313725)
                + +(rgba[j + 2] * 0.000447058823529412)
            ) * a + (1.0 - a));
            j = ((i + 1) << 2) | 0;
            a = +(rgba[j + 3] * 0.00392156862745098);
            gray[i + 1] = +(( +(rgba[j] * 0.001172549019607843)
                + +(rgba[j + 1] * 0.002301960784313725)
                + +(rgba[j + 2] * 0.000447058823529412)
            ) * a + (1.0 - a));
            j = ((i + 2) << 2) | 0;
            a = +(rgba[j + 3] * 0.00392156862745098);
            gray[i + 2] = +(( +(rgba[j] * 0.001172549019607843)
                + +(rgba[j + 1] * 0.002301960784313725)
                + +(rgba[j + 2] * 0.000447058823529412)
            ) * a + (1.0 - a));
            j = ((i + 3) << 2) | 0;
            a = +(rgba[j + 3] * 0.00392156862745098);
            gray[i + 3] = +(( +(rgba[j] * 0.001172549019607843)
                + +(rgba[j + 1] * 0.002301960784313725)
                + +(rgba[j + 2] * 0.000447058823529412)
            ) * a + (1.0 - a));
        }
        for (; (i | 0) < (pixels | 0); i = (i + 1) | 0) {
            j = (i << 2) | 0;
            a = +(rgba[j + 3] * 0.00392156862745098);
            gray[i] = +(( +(rgba[j] * 0.001172549019607843)
                + +(rgba[j + 1] * 0.002301960784313725)
                + +(rgba[j + 2] * 0.000447058823529412)
            ) * a + (1.0 - a));
        }

        // Pass 2: toneMap → darkness
        // v = clamp(0.5 + (gray + brightness - 0.5) * contrast)
        // v = gammaLUT[v]; if v > whiteCutoff → 1.0; dark = 1 - v
        for (i = 0; (i | 0) < (pixels | 0); i = (i + 1) | 0) {
            v = +gray[i];
            v = +(0.5 + (v + brightness - 0.5) * contrast);
            if (v < 0.0) v = 0.0;
            if (v > 1.0) v = 1.0;
            gIdx = (v * GAMMA_LUT_SIZE + 0.5) | 0;
            v = +gammaLUT[gIdx];
            if (v > whiteCutoff) v = 1.0;
            dark[i] = +(1.0 - v);
        }
    };

    // ════════════════════════════════════════════════════════════════
    // BILINEAR SAMPLER
    // ════════════════════════════════════════════════════════════════

    proto._sampleDark = function (x, y) {
        x = +x; y = +y;
        var w = this._w | 0, h = this._h | 0;
        var dark = this._dark;
        if (x < 0.0) x = 0.0;
        if (x > +(w - 1)) x = +(w - 1);
        if (y < 0.0) y = 0.0;
        if (y > +(h - 1)) y = +(h - 1);
        var x0 = ~~x, y0 = ~~y;
        var x1 = (x0 + 1) | 0, y1 = (y0 + 1) | 0;
        if ((x1 | 0) >= (w | 0)) x1 = (w - 1) | 0;
        if ((y1 | 0) >= (h | 0)) y1 = (h - 1) | 0;
        var dx = +(x - x0), dy = +(y - y0);
        return +(
            +dark[(y0 * w + x0) | 0] * (1.0 - dx) * (1.0 - dy) +
            +dark[(y0 * w + x1) | 0] * dx * (1.0 - dy) +
            +dark[(y1 * w + x0) | 0] * (1.0 - dx) * dy +
            +dark[(y1 * w + x1) | 0] * dx * dy
        );
    };

    // ════════════════════════════════════════════════════════════════
    // PATH ACCUMULATOR
    // ════════════════════════════════════════════════════════════════

    proto._beginPath = function () {
        var pc = this._pathCount | 0;
        this._pathIdx[pc] = this._ptCount | 0;
        this._pathLen[pc] = 0;
        this._pathSW[pc]  = 0.0;
    };

    proto._addPoint = function (x, y, sw) {
        x = +x; y = +y; sw = +sw;
        var pt = this._ptCount | 0;
        var off = (pt << 1) | 0;
        this._pathBuf[off] = x;
        this._pathBuf[off + 1] = y;
        this._ptCount = (pt + 1) | 0;
        var pc = this._pathCount | 0;
        var len = (this._pathLen[pc] + 1) | 0;
        this._pathLen[pc] = len;
        this._pathSW[pc] = +(this._pathSW[pc] + (sw - this._pathSW[pc]) / len);
    };

    proto._endPath = function () {
        var pc = this._pathCount | 0;
        if ((this._pathLen[pc] | 0) > 1) {
            this._pathCount = (pc + 1) | 0;
        } else {
            this._ptCount = this._pathIdx[pc] | 0;
        }
    };

    // ════════════════════════════════════════════════════════════════
    // PARALLEL LINE ENGINE — reads from this._p
    // ════════════════════════════════════════════════════════════════

    proto._traceParallel = function () {
        var w = this._w | 0, h = this._h | 0;
        var p = this._p;
        var scale = +p.scale;
        var svgW = +(w * scale), svgH = +(h * scale);
        var invScale = +(1.0 / scale);
        var spacing = +p.lineSpacing;
        var minStroke = +p.minStroke;
        var strokeRange = +p.strokeRange;
        var waveAmp = +p.waveAmp;
        var waveFreq = +p.waveFreq;
        var step = +p.step;
        var numLines = ~~(svgH / spacing) + 1;
        var li = 0, baseY = 0.0, sx = 0.0;
        var ix = 0.0, iy = 0.0, d = 0.0, sw = 0.0, wave = 0.0;
        var inSeg = 0;

        for (li = 0; (li | 0) < (numLines | 0); li = (li + 1) | 0) {
            baseY = +(li * spacing);
            iy = +(baseY * invScale);
            if (iy >= +(h | 0)) break;
            inSeg = 0;

            for (sx = 0.0; sx <= svgW; sx = +(sx + step)) {
                ix = +(sx * invScale);
                if (ix >= +(w | 0)) break;

                d = +this._sampleDark(ix, iy);

                if (d < 0.02) {
                    if (inSeg) { this._endPath(); inSeg = 0; }
                    continue;
                }

                if (!inSeg) { this._beginPath(); inSeg = 1; }

                sw = +(minStroke + d * strokeRange);
                wave = +(fastSin(sx * waveFreq + +(li * 2.1 | 0)) * waveAmp * d);

                this._addPoint(sx, +(baseY + wave), sw);
            }
            if (inSeg) { this._endPath(); inSeg = 0; }
        }
    };

    // ════════════════════════════════════════════════════════════════
    // CROSS-HATCH ENGINE — reads from this._p
    // Handles arbitrary angle (not just 90°)
    // ════════════════════════════════════════════════════════════════

    proto._traceCrossHatch = function () {
        var w = this._w | 0, h = this._h | 0;
        var p = this._p;
        var scale = +p.scale;
        var svgW = +(w * scale), svgH = +(h * scale);
        var invScale = +(1.0 / scale);
        var crossSp = +p.crossSp;
        var crossThresh = +p.crossThresh;
        var invCrossRange = +p.invCrossRange;
        var minStroke = +p.minStroke;
        var strokeRange = +p.strokeRange;
        var crossSwMul = +p.crossSwMul;
        var waveAmp = +p.waveAmp;
        var waveFreq = +p.waveFreq;
        var step = +p.step;
        var cosA = +p.crossCos;
        var sinA = +p.crossSin;
        var isVert = (Math.abs(sinA) > 0.999);

        var diagLen = +Math.sqrt(svgW * svgW + svgH * svgH);
        var numLines = 0, li = 0;
        var basePos = 0.0, t = 0.0;
        var sx = 0.0, sy = 0.0, ix = 0.0, iy = 0.0;
        var d = 0.0, adjD = 0.0, sw = 0.0, wave = 0.0;
        var inSeg = 0;

        if (isVert) {
            // Optimised vertical path (90°): iterate X positions, sweep Y
            numLines = ~~(svgW / crossSp) + 1;
            for (li = 0; (li | 0) < (numLines | 0); li = (li + 1) | 0) {
                basePos = +(li * crossSp);
                ix = +(basePos * invScale);
                if (ix >= +(w | 0)) break;
                inSeg = 0;

                for (sy = 0.0; sy <= svgH; sy = +(sy + step)) {
                    iy = +(sy * invScale);
                    if (iy >= +(h | 0)) break;

                    d = +this._sampleDark(ix, iy);
                    if (d < crossThresh) {
                        if (inSeg) { this._endPath(); inSeg = 0; }
                        continue;
                    }
                    if (!inSeg) { this._beginPath(); inSeg = 1; }

                    adjD = +((d - crossThresh) * invCrossRange);
                    sw = +(minStroke + adjD * strokeRange) * crossSwMul;
                    wave = +(fastSin(sy * waveFreq * 0.6) * waveAmp * 0.4 * d);

                    this._addPoint(+(basePos + wave), sy, sw);
                }
                if (inSeg) { this._endPath(); inSeg = 0; }
            }
        } else {
            // General angle: diagonal sweep
            numLines = ~~(diagLen / crossSp) + 1;
            for (li = -numLines; (li | 0) < (numLines | 0); li = (li + 1) | 0) {
                var off = +(li * crossSp);
                inSeg = 0;

                for (t = +(-(diagLen * 0.5)); t <= +(diagLen * 0.5); t = +(t + step)) {
                    sx = +(svgW * 0.5 + t * cosA - off * sinA);
                    sy = +(svgH * 0.5 + t * sinA + off * cosA);

                    if (sx < 0.0 || sx > svgW || sy < 0.0 || sy > svgH) {
                        if (inSeg) { this._endPath(); inSeg = 0; }
                        continue;
                    }

                    ix = +(sx * invScale);
                    iy = +(sy * invScale);
                    if (ix >= +(w | 0) || iy >= +(h | 0)) {
                        if (inSeg) { this._endPath(); inSeg = 0; }
                        continue;
                    }

                    d = +this._sampleDark(ix, iy);
                    if (d < crossThresh) {
                        if (inSeg) { this._endPath(); inSeg = 0; }
                        continue;
                    }
                    if (!inSeg) { this._beginPath(); inSeg = 1; }

                    adjD = +((d - crossThresh) * invCrossRange);
                    sw = +(minStroke + adjD * strokeRange) * crossSwMul;
                    wave = +(fastSin(t * waveFreq * 0.6) * waveAmp * 0.4 * d);

                    this._addPoint(+(sx + wave * sinA), +(sy - wave * cosA), sw);
                }
                if (inSeg) { this._endPath(); inSeg = 0; }
            }
        }
    };

    // ════════════════════════════════════════════════════════════════
    // CATMULL-ROM → CUBIC BEZIER SERIALIZER
    // ════════════════════════════════════════════════════════════════

    proto._pathToSVG = function (startIdx, len) {
        startIdx = startIdx | 0;
        len = len | 0;
        var buf = this._pathBuf;
        var off = (startIdx << 1) | 0;
        var f = +this._p.smoothF;
        var i = 0;
        var p0x = 0.0, p0y = 0.0, p1x = 0.0, p1y = 0.0;
        var p2x = 0.0, p2y = 0.0, p3x = 0.0, p3y = 0.0;
        var cp1x = 0.0, cp1y = 0.0, cp2x = 0.0, cp2y = 0.0;

        var s = "M" + buf[off].toFixed(1) + "," + buf[off + 1].toFixed(1);

        if (len < 3 || f < 0.001) {
            for (i = 1; (i | 0) < (len | 0); i = (i + 1) | 0) {
                var pi = (off + (i << 1)) | 0;
                s += "L" + buf[pi].toFixed(1) + "," + buf[pi + 1].toFixed(1);
            }
            return s;
        }

        for (i = 0; (i | 0) < ((len - 1) | 0); i = (i + 1) | 0) {
            var i0 = (i > 0 ? i - 1 : 0) | 0;
            var i1 = i | 0;
            var i2 = ((i + 1 < len ? i + 1 : len - 1)) | 0;
            var i3 = ((i + 2 < len ? i + 2 : len - 1)) | 0;

            p0x = +buf[off + (i0 << 1)];     p0y = +buf[off + (i0 << 1) + 1];
            p1x = +buf[off + (i1 << 1)];     p1y = +buf[off + (i1 << 1) + 1];
            p2x = +buf[off + (i2 << 1)];     p2y = +buf[off + (i2 << 1) + 1];
            p3x = +buf[off + (i3 << 1)];     p3y = +buf[off + (i3 << 1) + 1];

            cp1x = +(p1x + (p2x - p0x) * f);
            cp1y = +(p1y + (p2y - p0y) * f);
            cp2x = +(p2x - (p3x - p1x) * f);
            cp2y = +(p2y - (p3y - p1y) * f);

            s += "C" + cp1x.toFixed(1) + "," + cp1y.toFixed(1) + ","
                + cp2x.toFixed(1) + "," + cp2y.toFixed(1) + ","
                + p2x.toFixed(1)  + "," + p2y.toFixed(1);
        }

        return s;
    };

    // ════════════════════════════════════════════════════════════════
    // SVG ASSEMBLY — reads from this._p
    // ════════════════════════════════════════════════════════════════

    proto._buildSVG = function () {
        var w = this._w | 0, h = this._h | 0;
        var p = this._p;
        var scale = +p.scale;
        var minStroke = +p.minStroke;
        var strokeRange = +p.strokeRange;
        var inkColor = p.inkColor;
        var dpiMul = +(p.dpi / 96.0);
        var svgW = (w * scale) | 0, svgH = (h * scale) | 0;
        var outW = ~~(svgW * dpiMul), outH = ~~(svgH * dpiMul);

        var chunks = this._svgChunks;
        chunks.length = 0;

        chunks.push(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ',
            svgW + ' ' + svgH,
            '" width="' + outW + '" height="' + outH + '">\n',
            '<rect width="' + svgW + '" height="' + svgH + '" fill="#f5f0e6"/>\n'
        );

        var pc = this._pathCount | 0;
        var buckets = Object.create(null);
        var i = 0, idx = 0, len = 0, avgSW = 0.0, key = "";

        for (i = 0; (i | 0) < (pc | 0); i = (i + 1) | 0) {
            idx = this._pathIdx[i] | 0;
            len = this._pathLen[i] | 0;
            avgSW = +this._pathSW[i];

            if ((len | 0) > (CHUNK_LEN | 0)) {
                var ci = 0;
                for (ci = 0; (ci | 0) < (len | 0); ci = (ci + (CHUNK_LEN - 1)) | 0) {
                    var subStart = (idx + ci) | 0;
                    var subLen = CHUNK_LEN;
                    if ((ci + subLen) > len) subLen = (len - ci) | 0;
                    if ((subLen | 0) < 2) break;

                    var midIdx = (subStart + (subLen >> 1)) | 0;
                    var midOff = (midIdx << 1) | 0;
                    var midX = +(this._pathBuf[midOff] / scale);
                    var midY = +(this._pathBuf[midOff + 1] / scale);
                    var midD = +this._sampleDark(midX, midY);
                    var subSW = +(minStroke + midD * strokeRange);
                    subSW = +(subSW * 0.7 + avgSW * 0.3);

                    key = "" + ((subSW * INV_SW_BUCKET + 0.5) | 0);
                    if (!buckets[key]) buckets[key] = [];
                    buckets[key].push(this._pathToSVG(subStart, subLen));
                }
            } else {
                key = "" + ((avgSW * INV_SW_BUCKET + 0.5) | 0);
                if (!buckets[key]) buckets[key] = [];
                buckets[key].push(this._pathToSVG(idx, len));
            }
        }

        var keys = Object.keys(buckets);
        for (var ki = 0; ki < keys.length; ki++) {
            var swVal = (+keys[ki] * SW_BUCKET).toFixed(2);
            var paths = buckets[keys[ki]];
            chunks.push(
                '<g stroke="' + inkColor + '" stroke-width="' + swVal +
                '" fill="none" stroke-linecap="round" stroke-linejoin="round">\n'
            );
            for (var pi = 0; pi < paths.length; pi++) {
                chunks.push('<path d="' + paths[pi] + '"/>\n');
            }
            chunks.push('</g>\n');
        }

        chunks.push('</svg>');
        return chunks.join('');
    };

    // ════════════════════════════════════════════════════════════════
    // PUBLIC API
    // ════════════════════════════════════════════════════════════════

    /**
     * Engrave from raw ImageData.
     *
     * @param {ImageData} imageData — from canvas.getImageData() or { data: Uint8ClampedArray }
     * @param {number}    width
     * @param {number}    height
     * @param {object}   [overrides] — optional parameter overrides, any subset of:
     *   lineSpacing, minStroke, maxStroke, waveAmp, waveFreq, smooth,
     *   crossAngle, crossThresh, contrast, brightness, gamma,
     *   whiteCutoff, edgeEnh, scale, dpi, inkColor
     * @returns {string}  SVG markup
     */
    proto.engrave = function (imageData, width, height, overrides) {
        width  = width  | 0;
        height = height | 0;

        // Apply params (defaults or merged with overrides)
        this._applyParams(overrides || null);

        var p = this._p;
        var scale = +p.scale;

        // Allocate heap
        this._allocHeap(width, height);

        // Build luminance + darkness maps
        this._buildMaps(imageData.data);

        // Estimate max paths and points
        var svgW = (width * scale) | 0, svgH = (height * scale) | 0;
        var maxHLines = ~~(svgH / p.lineSpacing) + 2;
        var maxVLines = ~~(svgW / p.crossSp) + 2;
        var ptsPerLine = ~~(Math.max(svgW, svgH) / p.step) + 2;
        var maxPaths  = (maxHLines + maxVLines) * 4;
        var maxPoints = maxPaths * ptsPerLine;

        this._allocPaths(maxPoints, maxPaths);

        // Trace
        this._traceParallel();
        this._traceCrossHatch();

        // Build SVG
        return this._buildSVG();
    };

    /**
     * Engrave from a <canvas> element.
     * @param {HTMLCanvasElement} canvas
     * @param {object}           [overrides]
     * @returns {string}
     */
    proto.engraveCanvas = function (canvas, overrides) {
        var ctx = canvas.getContext('2d');
        var id = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return this.engrave(id, canvas.width, canvas.height, overrides);
    };

    /**
     * Engrave from an image URL (async).
     * @param {string}  url
     * @param {object} [overrides]
     * @returns {Promise<string>}
     */
    proto.engraveURL = function (url, overrides) {
        var self = this;
        return new Promise(function (resolve, reject) {
            var img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = function () {
                var c = document.createElement('canvas');
                c.width = img.naturalWidth;
                c.height = img.naturalHeight;
                var ctx = c.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(img, 0, 0);
                var id = ctx.getImageData(0, 0, c.width, c.height);
                resolve(self.engrave(id, c.width, c.height, overrides));
            };
            img.onerror = function () { reject(new Error('Failed to load: ' + url)); };
            img.src = url;
        });
    };

    /**
     * Engrave from a File/Blob (async).
     * @param {File|Blob} file
     * @param {object}   [overrides]
     * @returns {Promise<string>}
     */
    proto.engraveFile = function (file, overrides) {
        var self = this;
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function (e) {
                self.engraveURL(e.target.result, overrides).then(resolve, reject);
            };
            reader.onerror = function () { reject(new Error('Failed to read file')); };
            reader.readAsDataURL(file);
        });
    };

    /**
     * Get default parameters.
     * @returns {Object}
     */
    proto.getDefaults = function () {
        var copy = {};
        for (var k in DEFAULTS) copy[k] = DEFAULTS[k];
        return copy;
    };

    return PixaEngrave;

})();

// ════════════════════════════════════════════════════════════════
// MODULE EXPORT (UMD)
// ════════════════════════════════════════════════════════════════
export default PixaEngrave();