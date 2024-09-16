/**
 * PixaEngrave v2.0.0
 *
 * Pixel-art → banknote-engraving SVG.
 * asm.js-style typed arrays + LUTs, but params are just arguments.
 *
 * Usage:
 *   const eng = new PixaEngrave();
 *
 *   // From RGBA ImageData:
 *   const svg = eng.engrave(imageData, w, h, params);
 *
 *   // From Float32Array grayMap (0=black, 1=white):
 *   const svg = eng.engraveGray(grayMap, w, h, params);
 *
 *   // params is always required — no hidden defaults.
 *
 * @license MIT
 */

"use strict";

var PixaEngrave = (function () {

    // ── LUT ──────────────────────────────────────────
    var SIN_N = 4096, SIN_MASK = SIN_N - 1;
    var TAU = 6.283185307179586, INV_TAU_N = SIN_N / TAU;
    var sinLUT = new Float32Array(SIN_N);
    for (var _i = 0; _i < SIN_N; _i++) sinLUT[_i] = Math.sin((_i / SIN_N) * TAU);

    function fsin(x) {
        return +sinLUT[((x * INV_TAU_N) % SIN_N + SIN_N) & SIN_MASK];
    }

    var GAM_N = 1024;
    function buildGamLUT(g) {
        var t = new Float32Array(GAM_N + 1);
        for (var i = 0; i <= GAM_N; i++) t[i] = Math.pow(i / GAM_N, g);
        return t;
    }

    function fgam(v, lut) {
        if (v <= 0) return 0;
        if (v >= 1) return 1;
        return +lut[(v * GAM_N + 0.5) | 0];
    }

    // ── Constructor ──────────────────────────────────
    function PE() {
        this._dark = null;   // Float32Array — pre-computed darkness
        this._w = 0;
        this._h = 0;
        // Path accumulators
        this._buf = null;    // Float32 [x,y,x,y,...]
        this._idx = null;    // Int32 start index per path
        this._len = null;    // Int32 point count per path
        this._sw  = null;    // Float32 avg stroke per path
        this._pc  = 0;       // path count
        this._pt  = 0;       // point count
        this._gamLUT = null;
        this._gamVal = -1;
    }

    var P = PE.prototype;

    // ── Darkness map from RGBA ───────────────────────
    P._fromRGBA = function (rgba, w, h, p) {
        var n = (w * h) | 0;
        if (!this._dark || this._dark.length < n) this._dark = new Float32Array(n);
        this._w = w; this._h = h;
        var dark = this._dark;
        var gam = +p.gamma, ctr = +p.contrast, bri = +p.brightness, wc = +p.whiteCutoff;
        if (gam !== this._gamVal) { this._gamLUT = buildGamLUT(gam); this._gamVal = gam; }
        var gl = this._gamLUT;
        var i = 0, j = 0, a = 0.0, lum = 0.0, v = 0.0;
        for (i = 0; (i|0) < (n|0); i = (i+1)|0) {
            j = (i << 2) | 0;
            a = +(rgba[j+3] / 255);
            lum = +((rgba[j]*0.299 + rgba[j+1]*0.587 + rgba[j+2]*0.114) / 255 * a + (1-a));
            v = +(0.5 + (lum + bri - 0.5) * ctr);
            if (v < 0) v = 0; if (v > 1) v = 1;
            v = +fgam(v, gl);
            if (v > wc) v = 1;
            dark[i] = +(1 - v);
        }
    };

    // ── Darkness map from Float32 grayMap ────────────
    P._fromGray = function (gray, w, h, p) {
        var n = (w * h) | 0;
        if (!this._dark || this._dark.length < n) this._dark = new Float32Array(n);
        this._w = w; this._h = h;
        var dark = this._dark;
        var gam = +p.gamma, ctr = +p.contrast, bri = +p.brightness, wc = +p.whiteCutoff;
        if (gam !== this._gamVal) { this._gamLUT = buildGamLUT(gam); this._gamVal = gam; }
        var gl = this._gamLUT;
        var i = 0, v = 0.0;
        for (i = 0; (i|0) < (n|0); i = (i+1)|0) {
            v = +(0.5 + (+gray[i] + bri - 0.5) * ctr);
            if (v < 0) v = 0; if (v > 1) v = 1;
            v = +fgam(v, gl);
            if (v > wc) v = 1;
            dark[i] = +(1 - v);
        }
    };

    // ── Bilinear sample ──────────────────────────────
    P._sd = function (x, y) {
        var w = this._w | 0, h = this._h | 0, d = this._dark;
        if (x < 0) x = 0; if (x > w-1) x = w-1;
        if (y < 0) y = 0; if (y > h-1) y = h-1;
        var x0 = ~~x, y0 = ~~y;
        var x1 = x0+1 < w ? x0+1 : x0, y1 = y0+1 < h ? y0+1 : y0;
        var dx = x-x0, dy = y-y0;
        return +(d[y0*w+x0]*(1-dx)*(1-dy) + d[y0*w+x1]*dx*(1-dy) + d[y1*w+x0]*(1-dx)*dy + d[y1*w+x1]*dx*dy);
    };

    // ── Path accumulator ─────────────────────────────
    P._alloc = function (maxPts, maxPaths) {
        if (!this._buf || this._buf.length < maxPts*2) this._buf = new Float32Array(maxPts*2);
        if (!this._idx || this._idx.length < maxPaths) {
            this._idx = new Int32Array(maxPaths);
            this._len = new Int32Array(maxPaths);
            this._sw  = new Float32Array(maxPaths);
        }
        this._pc = 0; this._pt = 0;
    };
    P._bp = function () { var c = this._pc; this._idx[c] = this._pt; this._len[c] = 0; this._sw[c] = 0; };
    P._ap = function (x, y, s) {
        var t = this._pt, o = t<<1;
        this._buf[o] = x; this._buf[o+1] = y;
        this._pt = t+1;
        var c = this._pc, n = this._len[c]+1;
        this._len[c] = n;
        this._sw[c] += (s - this._sw[c]) / n;
    };
    P._ep = function () {
        if (this._len[this._pc] > 1) this._pc++; else this._pt = this._idx[this._pc];
    };

    // ── Parallel lines ───────────────────────────────
    P._parallel = function (p) {
        var w = this._w, h = this._h, sc = +p.scale;
        var svgW = w*sc, svgH = h*sc, inv = 1/sc;
        var sp = +p.lineSpacing, step = +(Math.max(0.3, sp*0.06));
        var minSW = +p.minStroke, swR = +(p.maxStroke - p.minStroke);
        var amp = +p.waveAmp, freq = +p.waveFreq;
        var nL = ~~(svgH/sp)+1, li, by, sx, ix, iy, d, on;

        for (li = 0; li < nL; li++) {
            by = li*sp; iy = by*inv;
            if (iy >= h) break;
            on = 0;
            for (sx = 0; sx <= svgW; sx += step) {
                ix = sx*inv; if (ix >= w) break;
                d = +this._sd(ix, iy);
                if (d < 0.02) { if (on) { this._ep(); on = 0; } continue; }
                if (!on) { this._bp(); on = 1; }
                this._ap(sx, by + fsin(sx*freq + li*2.1)*amp*d, minSW + d*swR);
            }
            if (on) this._ep();
        }
    };

    // ── Cross-hatch ──────────────────────────────────
    P._cross = function (p) {
        var w = this._w, h = this._h, sc = +p.scale;
        var svgW = w*sc, svgH = h*sc, inv = 1/sc;
        var sp = +(p.lineSpacing * 1.3), step = +(Math.max(0.3, p.lineSpacing*0.06));
        var ct = +p.crossThresh, invCR = 1/Math.max(0.001, 1-ct);
        var minSW = +p.minStroke, swR = +(p.maxStroke - p.minStroke);
        var amp = +p.waveAmp, freq = +p.waveFreq;
        var rad = p.crossAngle * Math.PI / 180;
        var ca = Math.cos(rad), sa = Math.sin(rad);
        var isV = Math.abs(sa) > 0.999;

        if (isV) {
            var nL = ~~(svgW/sp)+1, li, bx, sy, d, ad, on;
            for (li = 0; li < nL; li++) {
                bx = li*sp; if (bx*inv >= w) break; on = 0;
                for (sy = 0; sy <= svgH; sy += step) {
                    if (sy*inv >= h) break;
                    d = +this._sd(bx*inv, sy*inv);
                    if (d < ct) { if (on) { this._ep(); on = 0; } continue; }
                    if (!on) { this._bp(); on = 1; }
                    ad = (d-ct)*invCR;
                    this._ap(bx + fsin(sy*freq*0.6)*amp*0.4*d, sy, (minSW + ad*swR)*0.6);
                }
                if (on) this._ep();
            }
        } else {
            var diag = Math.sqrt(svgW*svgW+svgH*svgH);
            var nD = ~~(diag/sp)+1, off, t, sx, sy, ix, iy, d, ad, on;
            for (var li2 = -nD; li2 < nD; li2++) {
                off = li2*sp; on = 0;
                for (t = -diag/2; t <= diag/2; t += step) {
                    sx = svgW/2 + t*ca - off*sa;
                    sy = svgH/2 + t*sa + off*ca;
                    if (sx < 0 || sx > svgW || sy < 0 || sy > svgH) { if (on) { this._ep(); on = 0; } continue; }
                    ix = sx*inv; iy = sy*inv;
                    if (ix >= w || iy >= h) { if (on) { this._ep(); on = 0; } continue; }
                    d = +this._sd(ix, iy);
                    if (d < ct) { if (on) { this._ep(); on = 0; } continue; }
                    if (!on) { this._bp(); on = 1; }
                    ad = (d-ct)*invCR;
                    var wv = fsin(t*freq*0.6)*amp*0.4*d;
                    this._ap(sx + wv*sa, sy - wv*ca, (minSW + ad*swR)*0.6);
                }
                if (on) this._ep();
            }
        }
    };

    // ── Catmull-Rom → SVG path ───────────────────────
    P._toD = function (si, n, sm) {
        var b = this._buf, o = si<<1, f = sm*0.167;
        var s = "M" + b[o].toFixed(1) + "," + b[o+1].toFixed(1);
        if (n < 3 || f < 0.001) {
            for (var i = 1; i < n; i++) { var q = o+(i<<1); s += "L"+b[q].toFixed(1)+","+b[q+1].toFixed(1); }
            return s;
        }
        for (var i = 0; i < n-1; i++) {
            var a = i>0?i-1:0, c = i+1<n?i+1:n-1, e = i+2<n?i+2:n-1;
            var ax=b[o+(a<<1)],ay=b[o+(a<<1)+1], bx=b[o+(i<<1)],by=b[o+(i<<1)+1];
            var cx2=b[o+(c<<1)],cy=b[o+(c<<1)+1], ex=b[o+(e<<1)],ey=b[o+(e<<1)+1];
            s += "C"+(bx+(cx2-ax)*f).toFixed(1)+","+(by+(cy-ay)*f).toFixed(1)+","
                +(cx2-(ex-bx)*f).toFixed(1)+","+(cy-(ey-by)*f).toFixed(1)+","
                +cx2.toFixed(1)+","+cy.toFixed(1);
        }
        return s;
    };

    // ── Build SVG string ─────────────────────────────
    P._svg = function (p) {
        var w = this._w, h = this._h, sc = +p.scale;
        var svgW = (w*sc)|0, svgH = (h*sc)|0;
        var ink = p.inkColor || "#000";
        var sm = +p.smooth;
        var minSW = +p.minStroke, swR = +(p.maxStroke - p.minStroke);

        var out = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+svgW+' '+svgH+'" width="'+svgW+'" height="'+svgH+'">\n';
        out += '<rect width="'+svgW+'" height="'+svgH+'" fill="none"/>\n';

        // Bucket by stroke width
        var bk = Object.create(null);
        var CK = 8; // chunk length
        for (var i = 0; i < this._pc; i++) {
            var idx = this._idx[i], len = this._len[i], avg = this._sw[i];
            if (len > CK) {
                for (var ci = 0; ci < len; ci += CK-1) {
                    var sl = Math.min(CK, len-ci); if (sl < 2) break;
                    var mi = idx+ci+(sl>>1), mo = mi<<1;
                    var md = +this._sd(this._buf[mo]/sc, this._buf[mo+1]/sc);
                    var ss = (minSW + md*swR)*0.7 + avg*0.3;
                    var k = ((ss*10+0.5)|0)+"";
                    if (!bk[k]) bk[k] = [];
                    bk[k].push(this._toD(idx+ci, sl, sm));
                }
            } else {
                var k2 = ((avg*10+0.5)|0)+"";
                if (!bk[k2]) bk[k2] = [];
                bk[k2].push(this._toD(idx, len, sm));
            }
        }

        var keys = Object.keys(bk);
        for (var ki = 0; ki < keys.length; ki++) {
            var sw = (+keys[ki]*0.1).toFixed(2);
            out += '<g stroke="'+ink+'" stroke-width="'+sw+'" fill="none" stroke-linecap="round" stroke-linejoin="round">\n';
            var ds = bk[keys[ki]];
            for (var di = 0; di < ds.length; di++) out += '<path d="'+ds[di]+'"/>\n';
            out += '</g>\n';
        }
        out += '</svg>';
        return out;
    };

    // ── Core engrave (from pre-built darkness map) ───
    P._run = function (p) {
        var w = this._w, h = this._h, sc = +p.scale;
        var svgW = (w*sc)|0, svgH = (h*sc)|0;
        var sp = +p.lineSpacing, csp = sp*1.3;
        var step = Math.max(0.3, sp*0.06);
        var maxH = ~~(svgH/sp)+2, maxV = ~~(svgW/csp)+2;
        var ppl = ~~(Math.max(svgW, svgH)/step)+2;
        this._alloc((maxH+maxV)*ppl*2, (maxH+maxV)*4);
        this._parallel(p);
        if (p.crossHatch !== false) this._cross(p);
        return this._svg(p);
    };

    // ════════════════════════════════════════════════════
    // PUBLIC API
    // ════════════════════════════════════════════════════

    /**
     * Engrave from RGBA ImageData.
     * @param {{ data: Uint8ClampedArray }} imageData
     * @param {number} w
     * @param {number} h
     * @param {object} params — ALL parameters, no hidden defaults:
     *   lineSpacing, minStroke, maxStroke, waveAmp, waveFreq, smooth,
     *   crossAngle, crossThresh, crossHatch (bool),
     *   contrast, brightness, gamma, whiteCutoff,
     *   scale, inkColor
     */
    PE.prototype.engrave = function (imageData, w, h, params) {
        this._fromRGBA(imageData.data, w|0, h|0, params);
        return this._run(params);
    };

    /**
     * Engrave from Float32Array grayMap (0=black, 1=white).
     * Skips the RGBA→luminance step entirely.
     */
    PE.prototype.engraveGray = function (grayMap, w, h, params) {
        this._fromGray(grayMap, w|0, h|0, params);
        return this._run(params);
    };

    return PE;

})();

export default PixaEngrave;