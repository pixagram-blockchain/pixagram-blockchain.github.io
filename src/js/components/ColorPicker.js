import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';

// HSLuv implementation
class Hsluv {
    static hexChars = "0123456789abcdef";
    static refY = 1.0;
    static refU = 0.19783000664283;
    static refV = 0.46831999493879;
    static kappa = 903.2962962;
    static epsilon = 0.0088564516;
    static m_r0 = 3.240969941904521;
    static m_r1 = -1.537383177570093;
    static m_r2 = -0.498610760293;
    static m_g0 = -0.96924363628087;
    static m_g1 = 1.87596750150772;
    static m_g2 = 0.041555057407175;
    static m_b0 = 0.055630079696993;
    static m_b1 = -0.20397695888897;
    static m_b2 = 1.056971514242878;

    constructor() {
        this.hex = '#000000';
        this.rgb_r = 0;
        this.rgb_g = 0;
        this.rgb_b = 0;
        this.xyz_x = 0;
        this.xyz_y = 0;
        this.xyz_z = 0;
        this.luv_l = 0;
        this.luv_u = 0;
        this.luv_v = 0;
        this.lch_l = 0;
        this.lch_c = 0;
        this.lch_h = 0;
        this.hsluv_h = 0;
        this.hsluv_s = 0;
        this.hsluv_l = 0;
        this.hpluv_h = 0;
        this.hpluv_p = 0;
        this.hpluv_l = 0;
        this.r0s = 0;
        this.r0i = 0;
        this.r1s = 0;
        this.r1i = 0;
        this.g0s = 0;
        this.g0i = 0;
        this.g1s = 0;
        this.g1i = 0;
        this.b0s = 0;
        this.b0i = 0;
        this.b1s = 0;
        this.b1i = 0;
    }

    static fromLinear(c) {
        if (c <= 0.0031308) {
            return 12.92 * c;
        } else {
            return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
        }
    }

    static toLinear(c) {
        if (c > 0.04045) {
            return Math.pow((c + 0.055) / 1.055, 2.4);
        } else {
            return c / 12.92;
        }
    }

    static yToL(Y) {
        if (Y <= Hsluv.epsilon) {
            return Y / Hsluv.refY * Hsluv.kappa;
        } else {
            return 116 * Math.pow(Y / Hsluv.refY, 1 / 3) - 16;
        }
    }

    static lToY(L) {
        if (L <= 8) {
            return Hsluv.refY * L / Hsluv.kappa;
        } else {
            return Hsluv.refY * Math.pow((L + 16) / 116, 3);
        }
    }

    static rgbChannelToHex(chan) {
        const c = Math.round(chan * 255);
        const digit2 = c % 16;
        const digit1 = (c - digit2) / 16 | 0;
        return Hsluv.hexChars.charAt(digit1) + Hsluv.hexChars.charAt(digit2);
    }

    static distanceFromOriginAngle(slope, intercept, angle) {
        const d = intercept / (Math.sin(angle) - slope * Math.cos(angle));
        if (d < 0) {
            return Infinity;
        } else {
            return d;
        }
    }

    static min6(f1, f2, f3, f4, f5, f6) {
        return Math.min(f1, Math.min(f2, Math.min(f3, Math.min(f4, Math.min(f5, f6)))));
    }

    rgbToHex() {
        this.hex = "#";
        this.hex += Hsluv.rgbChannelToHex(this.rgb_r);
        this.hex += Hsluv.rgbChannelToHex(this.rgb_g);
        this.hex += Hsluv.rgbChannelToHex(this.rgb_b);
    }

    xyzToRgb() {
        this.rgb_r = Hsluv.fromLinear(Hsluv.m_r0 * this.xyz_x + Hsluv.m_r1 * this.xyz_y + Hsluv.m_r2 * this.xyz_z);
        this.rgb_g = Hsluv.fromLinear(Hsluv.m_g0 * this.xyz_x + Hsluv.m_g1 * this.xyz_y + Hsluv.m_g2 * this.xyz_z);
        this.rgb_b = Hsluv.fromLinear(Hsluv.m_b0 * this.xyz_x + Hsluv.m_b1 * this.xyz_y + Hsluv.m_b2 * this.xyz_z);
    }

    rgbToXyz() {
        const lr = Hsluv.toLinear(this.rgb_r);
        const lg = Hsluv.toLinear(this.rgb_g);
        const lb = Hsluv.toLinear(this.rgb_b);
        this.xyz_x = 0.41239079926595 * lr + 0.35758433938387 * lg + 0.18048078840183 * lb;
        this.xyz_y = 0.21263900587151 * lr + 0.71516867876775 * lg + 0.072192315360733 * lb;
        this.xyz_z = 0.019330818715591 * lr + 0.11919477979462 * lg + 0.95053215224966 * lb;
    }

    xyzToLuv() {
        const divider = this.xyz_x + 15 * this.xyz_y + 3 * this.xyz_z;
        let varU = 4 * this.xyz_x;
        let varV = 9 * this.xyz_y;
        if (divider !== 0) {
            varU /= divider;
            varV /= divider;
        } else {
            varU = NaN;
            varV = NaN;
        }
        this.luv_l = Hsluv.yToL(this.xyz_y);
        if (this.luv_l === 0) {
            this.luv_u = 0;
            this.luv_v = 0;
        } else {
            this.luv_u = 13 * this.luv_l * (varU - Hsluv.refU);
            this.luv_v = 13 * this.luv_l * (varV - Hsluv.refV);
        }
    }

    luvToXyz() {
        if (this.luv_l === 0) {
            this.xyz_x = 0;
            this.xyz_y = 0;
            this.xyz_z = 0;
            return;
        }
        const varU = this.luv_u / (13 * this.luv_l) + Hsluv.refU;
        const varV = this.luv_v / (13 * this.luv_l) + Hsluv.refV;
        this.xyz_y = Hsluv.lToY(this.luv_l);
        this.xyz_x = 0 - 9 * this.xyz_y * varU / ((varU - 4) * varV - varU * varV);
        this.xyz_z = (9 * this.xyz_y - 15 * varV * this.xyz_y - varV * this.xyz_x) / (3 * varV);
    }

    luvToLch() {
        this.lch_l = this.luv_l;
        this.lch_c = Math.sqrt(this.luv_u * this.luv_u + this.luv_v * this.luv_v);
        if (this.lch_c < 0.00000001) {
            this.lch_h = 0;
        } else {
            const hrad = Math.atan2(this.luv_v, this.luv_u);
            this.lch_h = hrad * 180.0 / Math.PI;
            if (this.lch_h < 0) {
                this.lch_h = 360 + this.lch_h;
            }
        }
    }

    lchToLuv() {
        const hrad = this.lch_h / 180.0 * Math.PI;
        this.luv_l = this.lch_l;
        this.luv_u = Math.cos(hrad) * this.lch_c;
        this.luv_v = Math.sin(hrad) * this.lch_c;
    }

    calculateBoundingLines(l) {
        // Memo on l: the 12 line coefficients are a pure function of lightness.
        // The arc tessellations below convert up to 90 segments sharing ONE l
        // (hue ring) per drag frame — without this cache every segment paid the
        // full 12-line recompute. Any field write elsewhere never touches these
        // coefficients, so a same-l early return is behavior-identical.
        if (l === this._blCachedL) return;
        this._blCachedL = l;
        const sub1 = Math.pow(l + 16, 3) / 1560896;
        const sub2 = sub1 > Hsluv.epsilon ? sub1 : l / Hsluv.kappa;
        const s1r = sub2 * (284517 * Hsluv.m_r0 - 94839 * Hsluv.m_r2);
        const s2r = sub2 * (838422 * Hsluv.m_r2 + 769860 * Hsluv.m_r1 + 731718 * Hsluv.m_r0);
        const s3r = sub2 * (632260 * Hsluv.m_r2 - 126452 * Hsluv.m_r1);
        const s1g = sub2 * (284517 * Hsluv.m_g0 - 94839 * Hsluv.m_g2);
        const s2g = sub2 * (838422 * Hsluv.m_g2 + 769860 * Hsluv.m_g1 + 731718 * Hsluv.m_g0);
        const s3g = sub2 * (632260 * Hsluv.m_g2 - 126452 * Hsluv.m_g1);
        const s1b = sub2 * (284517 * Hsluv.m_b0 - 94839 * Hsluv.m_b2);
        const s2b = sub2 * (838422 * Hsluv.m_b2 + 769860 * Hsluv.m_b1 + 731718 * Hsluv.m_b0);
        const s3b = sub2 * (632260 * Hsluv.m_b2 - 126452 * Hsluv.m_b1);
        this.r0s = s1r / s3r;
        this.r0i = s2r * l / s3r;
        this.r1s = s1r / (s3r + 126452);
        this.r1i = (s2r - 769860) * l / (s3r + 126452);
        this.g0s = s1g / s3g;
        this.g0i = s2g * l / s3g;
        this.g1s = s1g / (s3g + 126452);
        this.g1i = (s2g - 769860) * l / (s3g + 126452);
        this.b0s = s1b / s3b;
        this.b0i = s2b * l / s3b;
        this.b1s = s1b / (s3b + 126452);
        this.b1i = (s2b - 769860) * l / (s3b + 126452);
    }

    calcMaxChromaHsluv(h) {
        const hueRad = h / 360 * Math.PI * 2;
        const r0 = Hsluv.distanceFromOriginAngle(this.r0s, this.r0i, hueRad);
        const r1 = Hsluv.distanceFromOriginAngle(this.r1s, this.r1i, hueRad);
        const g0 = Hsluv.distanceFromOriginAngle(this.g0s, this.g0i, hueRad);
        const g1 = Hsluv.distanceFromOriginAngle(this.g1s, this.g1i, hueRad);
        const b0 = Hsluv.distanceFromOriginAngle(this.b0s, this.b0i, hueRad);
        const b1 = Hsluv.distanceFromOriginAngle(this.b1s, this.b1i, hueRad);
        return Hsluv.min6(r0, r1, g0, g1, b0, b1);
    }

    hsluvToLch() {
        if (this.hsluv_l > 99.9999999) {
            this.lch_l = 100;
            this.lch_c = 0;
        } else if (this.hsluv_l < 0.00000001) {
            this.lch_l = 0;
            this.lch_c = 0;
        } else {
            this.lch_l = this.hsluv_l;
            this.calculateBoundingLines(this.hsluv_l);
            const max = this.calcMaxChromaHsluv(this.hsluv_h);
            this.lch_c = max / 100 * this.hsluv_s;
        }
        this.lch_h = this.hsluv_h;
    }

    lchToHsluv() {
        if (this.lch_l > 99.9999999) {
            this.hsluv_s = 0;
            this.hsluv_l = 100;
        } else if (this.lch_l < 0.00000001) {
            this.hsluv_s = 0;
            this.hsluv_l = 0;
        } else {
            this.calculateBoundingLines(this.lch_l);
            const max = this.calcMaxChromaHsluv(this.lch_h);
            this.hsluv_s = this.lch_c / max * 100;
            this.hsluv_l = this.lch_l;
        }
        this.hsluv_h = this.lch_h;
    }

    hsluvToRgb() {
        this.hsluvToLch();
        this.lchToLuv();
        this.luvToXyz();
        this.xyzToRgb();
    }

    rgbToHsluv() {
        this.rgbToXyz();
        this.xyzToLuv();
        this.luvToLch();
        this.lchToHsluv();
    }

    hsluvToHex() {
        this.hsluvToRgb();
        this.rgbToHex();
    }
}

// Optimized converter instance cache
let converterInstance = null;
const getConverter = () => {
    if (!converterInstance) {
        converterInstance = new Hsluv();
    }
    return converterInstance;
};

// Optimized utility functions
const hsluvToRgb = (h, s, l) => {
    const conv = getConverter();
    conv.hsluv_h = h;
    conv.hsluv_s = s;
    conv.hsluv_l = l;
    conv.hsluvToRgb();
    return {
        r: Math.round(conv.rgb_r * 255),
        g: Math.round(conv.rgb_g * 255),
        b: Math.round(conv.rgb_b * 255),
        a: 1
    };
};

const rgbToHsluv = (r, g, b) => {
    const conv = getConverter();
    conv.rgb_r = r / 255;
    conv.rgb_g = g / 255;
    conv.rgb_b = b / 255;
    conv.rgbToHsluv();
    return [conv.hsluv_h, conv.hsluv_s, conv.hsluv_l];
};

const hsluvToHex = (h, s, l) => {
    const conv = getConverter();
    conv.hsluv_h = h;
    conv.hsluv_s = s;
    conv.hsluv_l = l;
    conv.hsluvToHex();
    return conv.hex.toUpperCase();
};

// ── Static geometry ─────────────────────────────────────────────────
// Arc spans are design constants (left lightness arc 236°, right saturation
// arc 80°, ~22° gaps) — hoisted out of the component so the tessellation and
// pointer-math callbacks don't have to list them as deps.
const LIGHT_SPAN = 236;
const SAT_SPAN = 80;
const LIGHT_START_ANGLE = 180 - LIGHT_SPAN / 2;  // 62°
const LIGHT_END_ANGLE = 180 + LIGHT_SPAN / 2;    // 298°
const SAT_START_ANGLE = -SAT_SPAN / 2;           // -40°
const SAT_END_ANGLE = SAT_SPAN / 2;              // 40°

const HUE_SEGMENTS = 90;    // 4-degree segments for smooth gradient
const LIGHT_SEGMENTS = 48;
const SAT_SEGMENTS = 16;

// Path geometry for one segmented arc band. Pure function of the layout, so
// the result is memoized per size below — while dragging, only FILLS change.
// (Was: 154 SVG path strings rebuilt from scratch on every color change.)
const buildArcSegmentPaths = (segmentCount, startAngleDeg, endAngleDeg, cx, cy, innerR, outerR) => {
    const segmentAngle = (endAngleDeg - startAngleDeg) / segmentCount;
    return Array.from({ length: segmentCount }, (_, i) => {
        const startRad = ((startAngleDeg + i * segmentAngle) * Math.PI) / 180;
        const endRad = ((startAngleDeg + (i + 1) * segmentAngle) * Math.PI) / 180;
        return `
                    M ${cx + Math.cos(startRad) * innerR} ${cy + Math.sin(startRad) * innerR}
                    A ${innerR} ${innerR} 0 0 1 ${cx + Math.cos(endRad) * innerR} ${cy + Math.sin(endRad) * innerR}
                    L ${cx + Math.cos(endRad) * outerR} ${cy + Math.sin(endRad) * outerR}
                    A ${outerR} ${outerR} 0 0 0 ${cx + Math.cos(startRad) * outerR} ${cy + Math.sin(startRad) * outerR}
                    Z
                `;
    });
};

// Hoisted static styles — were inline literals re-created per render (and a
// drag renders once per frame).
const SVG_STYLE = {
    position: 'absolute',
    top: 0,
    left: 0,
    cursor: 'default',
    touchAction: 'none'
};
const POINTER_ALL_STYLE = { pointerEvents: 'all' };
const POINTER_NONE_STYLE = { pointerEvents: 'none' };

const CircularColorPicker = ({
                                 color = { r: 0, g: 150, b: 255, a: 1 },
                                 onChange,
                                 onConfirm,
                                 onClose,
                                 size: customSize = 280
                             }) => {
    // Clamp size between 128 and 1024
    const clampedSize = Math.max(128, Math.min(1024, customSize || 280));

    const [hsluv, setHsluv] = useState(() => {
        const [h, s, l] = rgbToHsluv(color.r, color.g, color.b);
        return { h, s, l };
    });
    const [isDragging, setIsDragging] = useState(null);

    const svgRef = useRef(null);
    const containerRef = useRef(null);
    // Per-drag scratch: SVG rect cached at pointerdown (one layout read per
    // drag instead of one per move), latest pointer coords, and the rAF token
    // used to coalesce pointer events into ≤1 state update per frame — the
    // element handler AND the document safety listeners can both fire for the
    // same move (pointer capture bubbles), and high-rate mice deliver several
    // moves per frame; all of them now collapse into a single recompute.
    const dragRef = useRef({ rect: null, raf: 0, x: 0, y: 0, type: null });

    const size = clampedSize;
    const centerX = size / 2;
    const centerY = size / 2;
    const scaleFactor = size / 280;

    const innerRadius = 36 * scaleFactor;
    const hueRingWidth = 24 * scaleFactor;
    const sideRingWidth = 24 * scaleFactor;
    const hueRadius = innerRadius + 12 * scaleFactor;
    const hueOuterRadius = hueRadius + hueRingWidth;
    const sideInnerRadius = hueOuterRadius + 12 * scaleFactor;
    const sideOuterRadius = sideInnerRadius + sideRingWidth;
    const sideMidRadius = sideInnerRadius + sideRingWidth / 2;

    // Notify the parent when the COLOR changes. onChange lives in a ref so a
    // parent re-creating the callback each render no longer re-fires the
    // effect with an unchanged color (the old [hsluv, onChange] dep did).
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    useEffect(() => {
        if (onChangeRef.current) {
            onChangeRef.current(hsluvToRgb(hsluv.h, hsluv.s, hsluv.l));
        }
    }, [hsluv]);

    // Handle background click (only fires if click wasn't stopped by interactive elements)
    const handleBackgroundClick = useCallback(() => {
        if (!onClose) return;
        onClose();
    }, [onClose]);

    // Stop propagation on interactive elements
    const handleInteractiveClick = useCallback((e) => {
        e.stopPropagation();
    }, []);

    const applyPointer = useCallback((clientX, clientY, type) => {
        const rect = dragRef.current.rect ||
            (svgRef.current && svgRef.current.getBoundingClientRect());
        if (!rect) return;
        const x = clientX - rect.left - centerX;
        const y = clientY - rect.top - centerY;

        if (type === 'hue') {
            // Angle 0 starts at right (3 o'clock position)
            let angle = Math.atan2(y, x) * (180 / Math.PI);
            angle = (angle + 360) % 360;
            const h = Math.round(angle);
            setHsluv(prev => prev.h === h ? prev : { ...prev, h });
        } else if (type === 'lightness') {
            let angle = Math.atan2(y, x) * (180 / Math.PI);
            if (angle < 0) angle += 360;
            if (angle < LIGHT_START_ANGLE) angle = LIGHT_START_ANGLE;
            if (angle > LIGHT_END_ANGLE) angle = LIGHT_END_ANGLE;
            const normalized = (angle - LIGHT_START_ANGLE) / (LIGHT_END_ANGLE - LIGHT_START_ANGLE);
            const l = Math.round((1 - normalized) * 100);
            setHsluv(prev => prev.l === l ? prev : { ...prev, l });
        } else if (type === 'saturation') {
            let angle = Math.atan2(y, x) * (180 / Math.PI);
            if (angle < SAT_START_ANGLE) angle = SAT_START_ANGLE;
            if (angle > SAT_END_ANGLE) angle = SAT_END_ANGLE;
            const normalized = (angle - SAT_START_ANGLE) / (SAT_END_ANGLE - SAT_START_ANGLE);
            const s = Math.round((1 - normalized) * 100);
            setHsluv(prev => prev.s === s ? prev : { ...prev, s });
        }
    }, [centerX, centerY]);

    // Coalesce pointer/touch events into at most one applyPointer per frame.
    const schedulePointer = useCallback((e, type) => {
        const p = e.touches ? e.touches[0] : e;
        const d = dragRef.current;
        d.x = p.clientX;
        d.y = p.clientY;
        d.type = type;
        if (d.raf) return; // an update is already queued for this frame
        d.raf = requestAnimationFrame(() => {
            d.raf = 0;
            applyPointer(d.x, d.y, d.type);
        });
    }, [applyPointer]);

    useEffect(() => () => {
        if (dragRef.current.raf) cancelAnimationFrame(dragRef.current.raf);
    }, []);

    const handlePointerDown = useCallback((e, type) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(type);

        if (e.target.setPointerCapture) {
            e.target.setPointerCapture(e.pointerId);
        }

        // One layout read per drag: the SVG can't move under a captured drag
        // (touch-action: none), so the rect from pointerdown stays valid and
        // every subsequent move skips getBoundingClientRect entirely.
        dragRef.current.rect = svgRef.current
            ? svgRef.current.getBoundingClientRect()
            : null;

        // Apply synchronously so a plain tap sets the color with zero lag.
        applyPointer(
            e.touches ? e.touches[0].clientX : e.clientX,
            e.touches ? e.touches[0].clientY : e.clientY,
            type
        );
    }, [applyPointer]);

    // Stable per-band down handlers — were `(e) => handlePointerDown(e, '…')`
    // closures re-created every render.
    const handleHueDown = useCallback((e) => handlePointerDown(e, 'hue'), [handlePointerDown]);
    const handleLightnessDown = useCallback((e) => handlePointerDown(e, 'lightness'), [handlePointerDown]);
    const handleSaturationDown = useCallback((e) => handlePointerDown(e, 'saturation'), [handlePointerDown]);

    const handlePointerMove = useCallback((e) => {
        if (!isDragging) return;
        e.preventDefault();
        schedulePointer(e, isDragging);
    }, [isDragging, schedulePointer]);

    const handlePointerUp = useCallback((e) => {
        if (e.target.releasePointerCapture) {
            e.target.releasePointerCapture(e.pointerId);
        }
        setIsDragging(null);
    }, []);

    useEffect(() => {
        if (isDragging) {
            const handleGlobalMove = (e) => {
                e.preventDefault();
                schedulePointer(e, isDragging);
            };

            const handleGlobalUp = () => {
                setIsDragging(null);
            };

            document.addEventListener('pointermove', handleGlobalMove, { passive: false });
            document.addEventListener('pointerup', handleGlobalUp);
            document.addEventListener('touchmove', handleGlobalMove, { passive: false });
            document.addEventListener('touchend', handleGlobalUp);

            return () => {
                document.removeEventListener('pointermove', handleGlobalMove);
                document.removeEventListener('pointerup', handleGlobalUp);
                document.removeEventListener('touchmove', handleGlobalMove);
                document.removeEventListener('touchend', handleGlobalUp);
            };
        }
    }, [isDragging, schedulePointer]);

    // Calculate indicator positions
    const indicators = useMemo(() => {
        const hueAngle = (hsluv.h * Math.PI) / 180;
        const hueIndicatorX = centerX + Math.cos(hueAngle) * (hueRadius + hueRingWidth / 2);
        const hueIndicatorY = centerY + Math.sin(hueAngle) * (hueRadius + hueRingWidth / 2);

        const lightAngle = LIGHT_START_ANGLE + (1 - hsluv.l / 100) * (LIGHT_END_ANGLE - LIGHT_START_ANGLE);
        const lightAngleRad = (lightAngle * Math.PI) / 180;
        const lightIndicatorX = centerX + Math.cos(lightAngleRad) * sideMidRadius;
        const lightIndicatorY = centerY + Math.sin(lightAngleRad) * sideMidRadius;

        const satAngle = SAT_END_ANGLE - (hsluv.s / 100) * (SAT_END_ANGLE - SAT_START_ANGLE);
        const satAngleRad = (satAngle * Math.PI) / 180;
        const satIndicatorX = centerX + Math.cos(satAngleRad) * sideMidRadius;
        const satIndicatorY = centerY + Math.sin(satAngleRad) * sideMidRadius;

        return { hueIndicatorX, hueIndicatorY, lightIndicatorX, lightIndicatorY, satIndicatorX, satIndicatorY };
    }, [hsluv, centerX, centerY, hueRadius, hueRingWidth, sideMidRadius]);

    // ── Tessellation, split geometry/fills ──────────────────────────
    // Paths depend only on the picker size; fills depend only on the color
    // channels the band does NOT control. A hue drag therefore recomputes 64
    // hex colors (lightness + saturation fills) and zero path strings.

    const hueRingPaths = useMemo(
        () => buildArcSegmentPaths(HUE_SEGMENTS, 0, 360, centerX, centerY, hueRadius, hueOuterRadius),
        [centerX, centerY, hueRadius, hueOuterRadius]
    );
    const lightnessArcPaths = useMemo(
        () => buildArcSegmentPaths(LIGHT_SEGMENTS, LIGHT_START_ANGLE, LIGHT_END_ANGLE, centerX, centerY, sideInnerRadius, sideOuterRadius),
        [centerX, centerY, sideInnerRadius, sideOuterRadius]
    );
    const saturationArcPaths = useMemo(
        () => buildArcSegmentPaths(SAT_SEGMENTS, SAT_START_ANGLE, SAT_END_ANGLE, centerX, centerY, sideInnerRadius, sideOuterRadius),
        [centerX, centerY, sideInnerRadius, sideOuterRadius]
    );

    // End-cap centers are pure layout too.
    const arcCaps = useMemo(() => {
        const at = (deg) => {
            const rad = (deg * Math.PI) / 180;
            return {
                cx: centerX + Math.cos(rad) * sideMidRadius,
                cy: centerY + Math.sin(rad) * sideMidRadius
            };
        };
        return {
            lightStart: at(LIGHT_START_ANGLE),
            lightEnd: at(LIGHT_END_ANGLE),
            satStart: at(SAT_START_ANGLE),
            satEnd: at(SAT_END_ANGLE)
        };
    }, [centerX, centerY, sideMidRadius]);

    // Memoize hue ring fills - update when S or L changes
    const hueRingFills = useMemo(() => {
        const segmentAngle = 360 / HUE_SEGMENTS;
        return Array.from({ length: HUE_SEGMENTS }, (_, i) =>
            hsluvToHex(i * segmentAngle + segmentAngle / 2, hsluv.s, hsluv.l));
    }, [hsluv.s, hsluv.l]);

    // Lightness arc fills (depend on current H and S)
    const lightnessArcFills = useMemo(() => {
        return Array.from({ length: LIGHT_SEGMENTS }, (_, i) =>
            hsluvToHex(hsluv.h, hsluv.s, 100 * (1 - (i + 0.5) / LIGHT_SEGMENTS)));
    }, [hsluv.h, hsluv.s]);

    // Saturation arc fills (depend on current H and L)
    const saturationArcFills = useMemo(() => {
        return Array.from({ length: SAT_SEGMENTS }, (_, i) =>
            hsluvToHex(hsluv.h, 100 * (1 - (i + 0.5) / SAT_SEGMENTS), hsluv.l));
    }, [hsluv.h, hsluv.l]);

    const indicatorSize = sideRingWidth / 2 - 2 * scaleFactor; // Fits nicely inside the arc

    const containerStyle = useMemo(() => ({
        width: size,
        height: size,
        margin: '0 auto',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        position: 'relative'
    }), [size]);

    return (
        <div
            ref={containerRef}
            style={containerStyle}
        >
            <svg
                ref={svgRef}
                width={size}
                height={size}
                onClick={handleBackgroundClick}
                style={SVG_STYLE}
            >
                <defs>
                    <filter id="indicatorShadow">
                        <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.3"/>
                    </filter>

                    <filter id="ringShadow">
                        <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.25"/>
                    </filter>
                </defs>

                {/* Transparent background for click detection */}
                <rect
                    x="0"
                    y="0"
                    width={size}
                    height={size}
                    fill="transparent"
                    style={POINTER_ALL_STYLE}
                />

                {/* Hue Ring - Full torus with proper angular segments */}
                <g
                    style={POINTER_ALL_STYLE}
                    filter="url(#ringShadow)"
                    onClick={handleInteractiveClick}
                    onPointerDown={handleHueDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                >
                    {hueRingPaths.map((path, i) => (
                        <path
                            key={i}
                            d={path}
                            fill={hueRingFills[i]}
                            stroke={hueRingFills[i]}
                            strokeWidth="1"
                        />
                    ))}
                </g>

                {/* Lightness Arc - Segmented for proper gradient */}
                <g
                    style={POINTER_ALL_STYLE}
                    filter="url(#ringShadow)"
                    onClick={handleInteractiveClick}
                    onPointerDown={handleLightnessDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                >
                    {lightnessArcPaths.map((path, i) => (
                        <path
                            key={i}
                            d={path}
                            fill={lightnessArcFills[i]}
                            stroke={lightnessArcFills[i]}
                            strokeWidth="1"
                        />
                    ))}
                    {/* Rounded end caps */}
                    <circle
                        cx={arcCaps.lightStart.cx}
                        cy={arcCaps.lightStart.cy}
                        r={sideRingWidth / 2}
                        fill={hsluvToHex(hsluv.h, hsluv.s, 100)}
                        stroke="none"
                    />
                    <circle
                        cx={arcCaps.lightEnd.cx}
                        cy={arcCaps.lightEnd.cy}
                        r={sideRingWidth / 2}
                        fill={hsluvToHex(hsluv.h, hsluv.s, 0)}
                        stroke="none"
                    />
                </g>

                {/* Saturation Arc - Segmented for proper gradient */}
                <g
                    style={POINTER_ALL_STYLE}
                    filter="url(#ringShadow)"
                    onClick={handleInteractiveClick}
                    onPointerDown={handleSaturationDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                >
                    {saturationArcPaths.map((path, i) => (
                        <path
                            key={i}
                            d={path}
                            fill={saturationArcFills[i]}
                            stroke={saturationArcFills[i]}
                            strokeWidth="1"
                        />
                    ))}
                    {/* Rounded end caps */}
                    <circle
                        cx={arcCaps.satStart.cx}
                        cy={arcCaps.satStart.cy}
                        r={sideRingWidth / 2}
                        fill={hsluvToHex(hsluv.h, 100, hsluv.l)}
                        stroke="none"
                    />
                    <circle
                        cx={arcCaps.satEnd.cx}
                        cy={arcCaps.satEnd.cy}
                        r={sideRingWidth / 2}
                        fill={hsluvToHex(hsluv.h, 0, hsluv.l)}
                        stroke="none"
                    />
                </g>

                {/* Indicators */}
                <circle
                    cx={indicators.hueIndicatorX}
                    cy={indicators.hueIndicatorY}
                    r={indicatorSize}
                    fill="#101010"
                    stroke="white"
                    strokeWidth="1.5"
                    filter="url(#indicatorShadow)"
                    style={POINTER_NONE_STYLE}
                />
                <circle
                    cx={indicators.lightIndicatorX}
                    cy={indicators.lightIndicatorY}
                    r={indicatorSize}
                    fill="#101010"
                    stroke="white"
                    strokeWidth="1.5"
                    filter="url(#indicatorShadow)"
                    style={POINTER_NONE_STYLE}
                />
                <circle
                    cx={indicators.satIndicatorX}
                    cy={indicators.satIndicatorY}
                    r={indicatorSize}
                    fill="#101010"
                    stroke="white"
                    strokeWidth="1.5"
                    filter="url(#indicatorShadow)"
                    style={POINTER_NONE_STYLE}
                />
            </svg>
        </div>
    );
};

export default CircularColorPicker;
