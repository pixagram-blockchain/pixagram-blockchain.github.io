import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";

import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import Grid from "@material-ui/core/Grid";
import TextField from "@material-ui/core/TextField";
import Slider from "@material-ui/core/Slider";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Collapse from "@material-ui/core/Collapse";
import Box from "@material-ui/core/Box";
import ShuffleIcon from "@material-ui/icons/Shuffle";
import GetAppIcon from "@material-ui/icons/GetAppOutlined";
import Fade from "@material-ui/core/Fade";
import Accordion from "@material-ui/core/Accordion";
import AccordionSummary from "@material-ui/core/AccordionSummary";
import AccordionDetails from "@material-ui/core/AccordionDetails";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";

// Lab toggles
import ToggleButton from "@material-ui/lab/ToggleButton";
import ToggleButtonGroup from "@material-ui/lab/ToggleButtonGroup";

// New: color picker & menu
import Menu from "@material-ui/core/Menu";
import ColorPicker from "./ColorPicker";
import {optimize} from "svgo/lib/svgo";

import { t } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";
// ===== Color Engine Class =====
class ColorEngine {
    static hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    static rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    static rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }

        return { h: h * 360, s: s * 100, l: l * 100 };
    }

    static hslToRgb(h, s, l) {
        h /= 360;
        s /= 100;
        l /= 100;

        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };

        let r, g, b;

        if (s === 0) {
            r = g = b = l;
        } else {
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }

    static generateMonotone(baseColor, steps = 5) {
        const rgb = this.hexToRgb(baseColor);
        const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
        const colors = [];

        for (let i = 0; i < steps; i++) {
            const saturation = 20 + (80 * i / (steps - 1));
            const lightness = 20 + (60 * i / (steps - 1));
            const newRgb = this.hslToRgb(hsl.h, saturation, lightness);
            colors.push(this.rgbToHex(newRgb.r, newRgb.g, newRgb.b));
        }

        return colors;
    }

    static generateComplementary(baseColor) {
        const rgb = this.hexToRgb(baseColor);
        const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
        const complementaryHue = (hsl.h + 180) % 360;
        const complementaryRgb = this.hslToRgb(complementaryHue, hsl.s, hsl.l);

        return [
            baseColor,
            this.rgbToHex(complementaryRgb.r, complementaryRgb.g, complementaryRgb.b)
        ];
    }

    static generateDarkerTones(baseColor, steps = 5) {
        const rgb = this.hexToRgb(baseColor);
        const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
        const colors = [];

        for (let i = 0; i < steps; i++) {
            const lightness = Math.max(10, hsl.l - (15 * i));
            const newRgb = this.hslToRgb(hsl.h, hsl.s, lightness);
            colors.push(this.rgbToHex(newRgb.r, newRgb.g, newRgb.b));
        }

        return colors;
    }

    static generateLighterTones(baseColor, steps = 5) {
        const rgb = this.hexToRgb(baseColor);
        const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
        const colors = [];

        for (let i = 0; i < steps; i++) {
            const lightness = Math.min(90, hsl.l + (15 * i));
            const newRgb = this.hslToRgb(hsl.h, hsl.s, lightness);
            colors.push(this.rgbToHex(newRgb.r, newRgb.g, newRgb.b));
        }

        return colors;
    }

    static interpolateColors(color1, color2, steps = 5, longPath = false) {
        const rgb1 = this.hexToRgb(color1);
        const rgb2 = this.hexToRgb(color2);
        const hsl1 = this.rgbToHsl(rgb1.r, rgb1.g, rgb1.b);
        const hsl2 = this.rgbToHsl(rgb2.r, rgb2.g, rgb2.b);

        const colors = [];

        let hueDiff = hsl2.h - hsl1.h;
        if (longPath) {
            if (Math.abs(hueDiff) < 180) {
                hueDiff = hueDiff > 0 ? hueDiff - 360 : hueDiff + 360;
            }
        } else {
            if (hueDiff > 180) hueDiff -= 360;
            if (hueDiff < -180) hueDiff += 360;
        }

        for (let i = 0; i < steps; i++) {
            const t = i / (steps - 1);
            const h = (hsl1.h + hueDiff * t + 360) % 360;
            const s = hsl1.s + (hsl2.s - hsl1.s) * t;
            const l = hsl1.l + (hsl2.l - hsl1.l) * t;

            const rgb = this.hslToRgb(h, s, l);
            colors.push(this.rgbToHex(rgb.r, rgb.g, rgb.b));
        }

        return colors;
    }

    static generateTriadic(color1, color2) {
        const rgb1 = this.hexToRgb(color1);
        const rgb2 = this.hexToRgb(color2);
        const hsl1 = this.rgbToHsl(rgb1.r, rgb1.g, rgb1.b);
        const hsl2 = this.rgbToHsl(rgb2.r, rgb2.g, rgb2.b);

        const avgHue = (hsl1.h + hsl2.h) / 2;
        const thirdHue = (avgHue + 120) % 360;
        const avgSaturation = (hsl1.s + hsl2.s) / 2;
        const avgLightness = (hsl1.l + hsl2.l) / 2;

        const rgb3 = this.hslToRgb(thirdHue, avgSaturation, avgLightness);

        return [
            color1,
            color2,
            this.rgbToHex(rgb3.r, rgb3.g, rgb3.b)
        ];
    }

    static interpolateThreeColors(color1, color2, color3, longPath = false, steps = 7) {
        const firstHalf = this.interpolateColors(color1, color2, Math.ceil(steps / 2) + 1, longPath);
        const secondHalf = this.interpolateColors(color2, color3, Math.floor(steps / 2) + 1, longPath);

        return [...firstHalf.slice(0, -1), ...secondHalf.slice(1)];
    }

    static generateRandomColor() {
        return `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
    }
}

// ===== Gradient Generator Class =====
class GradientGenerator {

    static optimizeSVG(svgInput){
        // floatPrecision 2 (was 1): 1-decimal rounding destroys small filter
        // numbers — e.g. a noise baseFrequency of 0.04 became "0" (no noise at all).
        const plugins=[{name:"cleanupNumericValues", params:{floatPrecision:2, transformPrecision:0}}];
        return optimize(svgInput, { multipass:true, plugins, js2svg:{indent:0, pretty:false} }).data;
    }

    static seededRandom(seed) {
        let m = 0x80000000;
        let a = 1103515245;
        let c = 12345;
        let state = seed ? seed : Math.floor(Math.random() * (m - 1));

        return function() {
            state = (a * state + c) % m;
            return state / (m - 1);
        };
    }

    // Attempt to place shapes avoiding heavy overlap
    static findNonOverlappingPosition(existing, random, minDist = 15, maxAttempts = 20) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const cx = 5 + random() * 90;
            const cy = 5 + random() * 90;

            let valid = true;
            for (const shape of existing) {
                const dist = Math.sqrt((cx - shape.cx) ** 2 + (cy - shape.cy) ** 2);
                if (dist < minDist) {
                    valid = false;
                    break;
                }
            }
            if (valid) return { cx, cy };
        }
        // Fallback: return random position
        return { cx: 5 + random() * 90, cy: 5 + random() * 90 };
    }

    // ===== Hue-path color assignment =====
    // Maps a canvas position to a palette index so shapes that are CLOSE in space
    // get colors that are CLOSE on the palette's hue path. Gaussian blur can only
    // mix in RGB — a crossfade between two far-apart hues always passes through
    // grey/brown. By assigning the palette as a spatial sweep, the blur only ever
    // bridges SMALL hue steps, so the visible blend follows the palette's hue path.
    // `sweep` rotates the wheel per seed; the mirror fold removes the wrap seam;
    // `spread` adds ± that many palette steps of jitter so the field stays organic.
    static paletteIndexAt(cx, cy, paletteLength, sweep, random, spread = 0.6) {
        if (paletteLength <= 1) return 0;
        const angle = Math.atan2(cy - 50, cx - 50) / (2 * Math.PI) + 0.5; // 0..1
        const t = (angle + sweep) % 1;
        const mirrored = 1 - Math.abs(2 * t - 1); // 0..1..0 — seamless wrap-around
        const idx = mirrored * (paletteLength - 1) + (random() - 0.5) * 2 * spread;
        return Math.max(0, Math.min(paletteLength - 1, Math.round(idx)));
    }

    // Generate organic blob path using bezier curves
    static generateOrganicPath(cx, cy, baseRadius, random, viewBox = { w: 100, h: 100 }) {
        const points = [];
        const numPoints = 6 + Math.floor(random() * 6);
        const radiusVariance = 0.25 + random() * 0.35;

        // Convert percentage to viewBox coordinates
        const centerX = (cx / 100) * viewBox.w;
        const centerY = (cy / 100) * viewBox.h;
        const radius = (baseRadius / 100) * Math.min(viewBox.w, viewBox.h);

        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            const noise = 1 + (random() - 0.5) * radiusVariance;
            const r = radius * noise;
            points.push({
                x: centerX + Math.cos(angle) * r,
                y: centerY + Math.sin(angle) * r
            });
        }

        // Create smooth bezier curve through points
        let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
        for (let i = 0; i < points.length; i++) {
            const p0 = points[(i - 1 + points.length) % points.length];
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            const p3 = points[(i + 2) % points.length];

            const tension = 0.3 + random() * 0.15;
            const cp1x = p1.x + (p2.x - p0.x) * tension;
            const cp1y = p1.y + (p2.y - p0.y) * tension;
            const cp2x = p2.x - (p3.x - p1.x) * tension;
            const cp2y = p2.y - (p3.y - p1.y) * tension;

            path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
        }
        path += ' Z';

        return path;
    }

    static createLinearGradient(colors, angle = 45) {
        const x1 = 50 + 50 * Math.cos((90 - angle) * Math.PI / 180);
        const y1 = 50 + 50 * Math.sin((90 - angle) * Math.PI / 180);
        const x2 = 50 - 50 * Math.cos((90 - angle) * Math.PI / 180);
        const y2 = 50 - 50 * Math.sin((90 - angle) * Math.PI / 180);

        return {
            type: 'linear',
            x1: `${x1}%`,
            y1: `${y1}%`,
            x2: `${x2}%`,
            y2: `${y2}%`,
            colors,
            angle
        };
    }

    static createRadialGradient(colors, centerX = 50, centerY = 50, radiusX = 50, radiusY = 50) {
        return {
            type: 'radial',
            cx: `${centerX}%`,
            cy: `${centerY}%`,
            rx: `${radiusX}%`,
            ry: `${radiusY}%`,
            colors
        };
    }

    static createBlobGradient(colors, blobCount = 3, smoothness = 0.8, minSize = 20, maxSize = 60, seed = null) {
        if (seed === null) seed = Math.random() * 10000;

        const random = this.seededRandom(seed);
        const blobs = [];

        // Spatial (hue-path) color assignment — see paletteIndexAt. The old
        // getColor(index) cycled the palette in PLACEMENT order, so neighbouring
        // blobs regularly held far-apart hues and the blur mixed them into mud.
        const sweep = random();
        const pick = (cx, cy, spread = 0.6) =>
            colors[this.paletteIndexAt(cx, cy, colors.length, sweep, random, spread)];

        // Define strategic positions across the canvas for even distribution
        const strategicPositions = [
            { cx: 20, cy: 20 },   // top-left quadrant
            { cx: 80, cy: 20 },   // top-right quadrant
            { cx: 20, cy: 80 },   // bottom-left quadrant
            { cx: 80, cy: 80 },   // bottom-right quadrant
            { cx: 50, cy: 50 },   // center
            { cx: 50, cy: 20 },   // top-center
            { cx: 50, cy: 80 },   // bottom-center
            { cx: 20, cy: 50 },   // left-center
            { cx: 80, cy: 50 },   // right-center
            { cx: 35, cy: 35 },   // inner positions
            { cx: 65, cy: 35 },
            { cx: 35, cy: 65 },
            { cx: 65, cy: 65 },
        ];

        // Shuffle positions for variety
        for (let i = strategicPositions.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [strategicPositions[i], strategicPositions[j]] = [strategicPositions[j], strategicPositions[i]];
        }

        // Layer 1: Large primary blobs - one for each palette color, guaranteed visible
        const primaryCount = Math.max(colors.length, Math.min(5, blobCount));
        for (let i = 0; i < primaryCount; i++) {
            const pos = strategicPositions[i % strategicPositions.length];
            const jitterX = (random() - 0.5) * 25;
            const jitterY = (random() - 0.5) * 25;

            const size = maxSize * (0.8 + random() * 0.4);
            const aspectRatio = 0.6 + random() * 0.8; // Elliptical variation

            const bx = Math.max(0, Math.min(100, pos.cx + jitterX));
            const by = Math.max(0, Math.min(100, pos.cy + jitterY));

            blobs.push({
                cx: bx,
                cy: by,
                rx: size,
                ry: size * aspectRatio,
                rotation: random() * 360,
                color: pick(bx, by),
                opacity: 0.85 + random() * 0.15, // High opacity for visibility
                shapeType: random() > 0.35 ? 'ellipse' : 'organic',
                layer: 0
            });
        }

        // Layer 2: Medium accent blobs - fill gaps and add color interplay
        const mediumCount = blobCount + 2 + Math.floor(random() * 3);
        for (let i = 0; i < mediumCount; i++) {
            const pos = this.findNonOverlappingPosition(blobs, random, 12, 15);
            const size = minSize * 0.8 + random() * (maxSize - minSize) * 0.7;
            const aspectRatio = 0.5 + random() * 1.0;

            blobs.push({
                cx: pos.cx,
                cy: pos.cy,
                rx: size,
                ry: size * aspectRatio,
                rotation: random() * 360,
                color: pick(pos.cx, pos.cy),
                opacity: 0.8 + random() * 0.2,
                shapeType: random() > 0.5 ? 'ellipse' : 'organic',
                layer: 1
            });
        }

        // Layer 3: Small vibrant highlights - ensure all colors appear
        const highlightCount = Math.max(6, colors.length * 2);
        for (let i = 0; i < highlightCount; i++) {
            const size = minSize * (0.35 + random() * 0.45);
            const hx = 8 + random() * 84;
            const hy = 8 + random() * 84;

            blobs.push({
                cx: hx,
                cy: hy,
                rx: size,
                ry: size * (0.7 + random() * 0.6),
                rotation: random() * 360,
                color: pick(hx, hy, 1.2), // wider spread = colorful shimmer
                opacity: 0.7 + random() * 0.3,
                shapeType: 'ellipse',
                layer: 2
            });
        }

        // Layer 4: Edge blobs extending beyond canvas for seamless feel
        const edgeCount = 3 + Math.floor(random() * 3);
        for (let i = 0; i < edgeCount; i++) {
            const edge = Math.floor(random() * 4);
            let cx, cy;
            switch (edge) {
                case 0: cx = random() * 100; cy = -15 + random() * 25; break; // top
                case 1: cx = random() * 100; cy = 90 + random() * 25; break;  // bottom
                case 2: cx = -15 + random() * 25; cy = random() * 100; break; // left
                default: cx = 90 + random() * 25; cy = random() * 100; break;  // right
            }

            blobs.push({
                cx,
                cy,
                rx: maxSize * (0.7 + random() * 0.6),
                ry: maxSize * (0.5 + random() * 0.5),
                rotation: random() * 360,
                color: pick(cx, cy),
                opacity: 0.8 + random() * 0.2,
                shapeType: 'ellipse',
                layer: 0
            });
        }

        // Sort: render by layer, then by size (larger first within layer)
        blobs.sort((a, b) => {
            if (a.layer !== b.layer) return a.layer - b.layer;
            return (b.rx * b.ry) - (a.rx * a.ry);
        });

        return {
            type: 'blob',
            blobs,
            smoothness,
            seed
        };
    }

    static createMeshGradient(colors, gridSize = 4, blurIntensity = 150, seed = null) {
        if (seed === null) seed = Math.random() * 10000;

        const meshPoints = [];
        const random = this.seededRandom(seed);

        // Spatial (hue-path) color assignment — see paletteIndexAt. The old
        // getColor(colorIdx++) placed palette entries in generation order, i.e.
        // spatially at random: adjacent spots often held far-apart hues, and the
        // blur averaged them straight through grey.
        const sweep = random();
        const pick = (cx, cy, spread = 0.6) =>
            colors[this.paletteIndexAt(cx, cy, colors.length, sweep, random, spread)];

        // Layer 0: Corner anchor points - ensure colors reach all edges
        const corners = [
            { cx: -5, cy: -5 },
            { cx: 105, cy: -5 },
            { cx: -5, cy: 105 },
            { cx: 105, cy: 105 }
        ];

        corners.forEach((corner) => {
            const ccx = corner.cx + (random() - 0.5) * 20;
            const ccy = corner.cy + (random() - 0.5) * 20;
            meshPoints.push({
                cx: ccx,
                cy: ccy,
                rx: 50 + random() * 35,
                ry: 40 + random() * 30,
                rotation: random() * 360,
                color: pick(ccx, ccy),
                opacity: 0.9 + random() * 0.1,
                shapeType: 'ellipse',
                layer: 0
            });
        });

        // Layer 1: Edge midpoints for better coverage
        const edgeMids = [
            { cx: 50, cy: -10 },  // top
            { cx: 50, cy: 110 },  // bottom
            { cx: -10, cy: 50 },  // left
            { cx: 110, cy: 50 }   // right
        ];

        edgeMids.forEach((edge) => {
            const ecx = edge.cx + (random() - 0.5) * 30;
            const ecy = edge.cy + (random() - 0.5) * 30;
            meshPoints.push({
                cx: ecx,
                cy: ecy,
                rx: 35 + random() * 30,
                ry: 30 + random() * 25,
                rotation: random() * 360,
                color: pick(ecx, ecy),
                opacity: 0.85 + random() * 0.15,
                shapeType: 'ellipse',
                layer: 0
            });
        });

        // Layer 2: Primary color spots using golden ratio spiral distribution
        const phi = (1 + Math.sqrt(5)) / 2;
        const primarySpots = Math.max(colors.length, gridSize + 2);

        for (let i = 0; i < primarySpots; i++) {
            // Fibonacci spiral distribution
            const theta = i * 2 * Math.PI / (phi * phi);
            const r = Math.sqrt(i / primarySpots) * 42;
            const cx = 50 + Math.cos(theta) * r + (random() - 0.5) * 18;
            const cy = 50 + Math.sin(theta) * r + (random() - 0.5) * 18;

            const size = 22 + random() * 32;
            const px = Math.max(-15, Math.min(115, cx));
            const py = Math.max(-15, Math.min(115, cy));

            meshPoints.push({
                cx: px,
                cy: py,
                rx: size,
                ry: size * (0.55 + random() * 0.9),
                rotation: random() * 360,
                color: pick(px, py),
                opacity: 0.75 + random() * 0.2,
                shapeType: random() > 0.3 ? 'ellipse' : 'circle',
                layer: 1
            });
        }

        // Layer 3: Grid-based fill with high jitter for organic feel
        const cellSize = 100 / gridSize;
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                // High probability of spawning
                if (random() > 0.2) {
                    const baseX = (x + 0.5) * cellSize;
                    const baseY = (y + 0.5) * cellSize;
                    const jitterX = (random() - 0.5) * cellSize * 1.1;
                    const jitterY = (random() - 0.5) * cellSize * 1.1;

                    const size = 14 + random() * 22;
                    const gx = baseX + jitterX;
                    const gy = baseY + jitterY;

                    meshPoints.push({
                        cx: gx,
                        cy: gy,
                        rx: size,
                        ry: size * (0.5 + random() * 1.0),
                        rotation: random() * 360,
                        color: pick(gx, gy),
                        opacity: 0.7 + random() * 0.3,
                        shapeType: 'ellipse',
                        layer: 2
                    });
                }
            }
        }

        // Layer 4: Vibrant accent spots scattered throughout - cycle all colors
        const accentCount = colors.length * 3 + Math.floor(random() * 6);
        for (let i = 0; i < accentCount; i++) {
            const size = 10 + random() * 18;
            const ax = random() * 100;
            const ay = random() * 100;

            meshPoints.push({
                cx: ax,
                cy: ay,
                rx: size,
                ry: size * (0.6 + random() * 0.8),
                rotation: random() * 360,
                color: pick(ax, ay, 1.2), // wider spread = colorful accents
                opacity: 0.65 + random() * 0.35,
                shapeType: 'ellipse',
                layer: 3
            });
        }

        // Layer 5: Tiny bright highlights on top
        const highlightCount = 6 + Math.floor(random() * 8);
        for (let i = 0; i < highlightCount; i++) {
            const hx = 10 + random() * 80;
            const hy = 10 + random() * 80;
            meshPoints.push({
                cx: hx,
                cy: hy,
                rx: 6 + random() * 10,
                ry: 6 + random() * 10,
                rotation: 0,
                color: pick(hx, hy, 1.0),
                opacity: 0.7 + random() * 0.3,
                shapeType: 'circle',
                layer: 4
            });
        }

        // Sort by layer, then by area within layer (larger first)
        meshPoints.sort((a, b) => {
            if (a.layer !== b.layer) return a.layer - b.layer;
            return (b.rx * (b.ry || b.rx)) - (a.rx * (a.ry || a.rx));
        });

        return {
            type: 'mesh',
            meshPoints,
            gridSize,
            blurIntensity,
            seed
        };
    }
}

const styles = (theme) => ({
    dialog: {
        "& .MuiDialog-paper": {
            zIndex: theme.zIndex.drawer + 10,
            backgroundColor: "#0c0c0c",
            color: "#fff",
            borderRadius: 21,
            [theme.breakpoints.down("sm")]: {
                margin: 0,
                maxWidth: "100%",
                maxHeight: "100%",
                width: "100%",
                height: "100%",
                borderRadius: 0
            },
            [theme.breakpoints.up("md")]: {
                maxWidth: "75vw",
                width: 1000,
                height: "auto"
            }
        },
        "& .MuiDialog-paperScrollPaper": { [theme.breakpoints.down("sm")]: { maxHeight: "100%" } },
        "& .MuiDialog-paperFullWidth": { [theme.breakpoints.down("sm")]: { width: "100% !important" } }
    },
    dialogContent: { margin: "12px 0 24px 0" },

    // Left: preview
    previewPanel: {
        backgroundColor: "#171717",
        borderRadius: "21px",
        paddingBottom: "16px"
    },
    gradientPreviewWrap: { position: "relative", marginBottom: "16px" },
    gradientPreview: {
        position: "relative",
        width: "100%",
        height: 405,
        borderRadius: 21,
        overflow: "hidden",
        background: "#000"
    },

    // Right: accordion controls
    controlsPanel: {
        maxHeight: "calc(80vh - 120px)",
        overflowY: "auto",
        "& div.MuiPaper-rounded": { borderRadius: "21px", backgroundColor: "#171717" },
        "& .MuiAccordionDetails-root": { overflow: "hidden" },
        "& .MuiAccordion-root:before, & div.MuiAccordion-root.Mui-expanded:before": { opacity: 0 },
        "& .MuiAccordion-root": { margin: "8px 0" },
        "& .MuiAccordion-rounded:first-child": { borderTopLeftRadius: "21px", borderTopRightRadius: "21px" },
        "& .MuiAccordion-rounded:last-child": { borderBottomLeftRadius: "21px", borderBottomRightRadius: "21px" }
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 600,
        color: "#ccc",
        letterSpacing: 0.5
    },
    colorCount: {
        "& .MuiToggleButton-root": {
            borderRadius: "21px"
        },
        "& .MuiToggleButtonGroup-groupedHorizontal:not(:last-child)": {
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0
        },
        "& .MuiToggleButtonGroup-groupedHorizontal:not(:first-child)": {
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0
        },
        marginBottom: 12
    },
    // Color picker menu styling
    menu: {
        "& .MuiPaper-root": {
            background: "transparent",
            padding: 0,
            borderRadius: "50%",
            boxShadow: "none"
        },
        "& .MuiList-padding": {
            padding: 0
        }
    },
    materialPicker: {
        width: 228,
        height: "auto",
        margin: 4
    },

    colorButton: {
        fontWeight: "bold",
        borderRadius: "32px !important",
        height: 56,
        width: "100%",
        textTransform: "none"
    },
    iconButtonSmallGrey: {
        "&.MuiIconButton-root": {
            color: "#666"
        },
        "&.MuiIconButton-root:hover": {
            color: "#999"
        }
    },
    colorSwatch: {
        width: 30,
        height: 30,
        borderRadius: 6,
        border: "2px solid #333",
        cursor: "pointer",
        transition: "transform 0.2s ease",
        "&:hover": {
            transform: "scale(1.1)"
        }
    },
    palettePreview: {
        display: "flex",
        gap: 5,
        marginTop: 10,
        flexWrap: "wrap"
    },
    canvasInputRow: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 8,
        padding: "0 12px",
        marginTop: 12
    }
});

class GradientEditorDialog extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            // Color inputs
            colorCount: 2,
            primaryColor: "#ff6b6b",
            primaryAlpha: 1.0,
            secondaryColor: "#4ecdc4",
            secondaryAlpha: 1.0,
            tertiaryColor: "#45b7d1",
            tertiaryAlpha: 1.0,

            // Palette options
            paletteType: "interpolate",

            // Gradient type and controls
            gradientType: "linear",

            // Linear controls
            angle: 45,

            // Radial controls
            centerX: 50,
            centerY: 50,
            radiusX: 50,
            radiusY: 50,

            // Blob controls
            blobCount: 3,
            smoothness: 80,
            minSize: 20,
            maxSize: 60,

            // Mesh controls
            gridSize: 4,
            blurIntensity: 150,
            // Color grading (applied to the mesh group via SVG filters)
            luminosity: 0,          // -50 .. +50 ; 0 = neutral (brightness shift)
            contrast: 0,            // -50 .. +50 ; 0 = neutral
            saturation: 0,          // -100 .. +100 ; 0 = neutral, -100 = grayscale
            // Noise texture overlay (independent of luminosity grade)
            noiseAmount: 15,        // 0..100 opacity (%) of noise overlay
            noiseFrequency: 100,    // feTurbulence baseFrequency × 100 (so 100 -> 1.0)
            noiseOctaves: 3,

            seed: "369",

            canvasWidth: 1280,
            canvasHeight: 720,

            // Expansion panel state (only one open at a time)
            expandedPanel: 'colors',

            // color picker menu
            colorMenuWhich: null,
            colorMenuAnchor: null,

            stats: {
                svgSizeText: "0 KB",
            }
        };

        // runtime
        this.currentGradient = null;
        this.currentPalette = [];
        this.svgContent = "";
        this.previewRef = React.createRef();
        this._regenTimer = null;
    }

    static getDerivedStateFromProps(nextProps, prevState) {
        const updates = {};
        let shouldUpdate = false;

        if (nextProps.open !== prevState.open) {
            updates.open = nextProps.open;
            shouldUpdate = true;
        }

        if (nextProps.size !== prevState.size) {
            updates.size = nextProps.size;
            shouldUpdate = true;
        }

        return shouldUpdate ? updates : null;
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.props.open && !prevProps.open) {
            setTimeout(() => { this.newSeed(); }, 100);
        }

        if (prevState.canvasWidth !== this.state.canvasWidth ||
            prevState.canvasHeight !== this.state.canvasHeight) {
            this.syncPreviewSize();
        }

        // 🔐 Palette safety net: regen only when relevant palette inputs changed
        const paletteInputsChanged =
            prevState.paletteType   !== this.state.paletteType   ||
            prevState.colorCount    !== this.state.colorCount    ||
            prevState.primaryColor  !== this.state.primaryColor  ||
            prevState.secondaryColor!== this.state.secondaryColor||
            prevState.tertiaryColor !== this.state.tertiaryColor;

        if (paletteInputsChanged) {
            this.generateNewGradient();
        }
    }

    handleDialogEnter = () => {
        this.newSeed();
    };

    handleDialogEntered = () => {
        this.syncPreviewSize();
        this.generateNewGradient();
    };

    componentDidMount() {
        this.generateNewGradient();
    }

    componentWillUnmount() {
        if (this._regenTimer) clearTimeout(this._regenTimer);
    }

    // ===== Expansion Panel Control =====
    handlePanelChange = (panel) => (event, isExpanded) => {
        this.setState({ expandedPanel: isExpanded ? panel : false });
    };

    // ===== Preview dimensions =====
    getPreview = () => this.previewRef.current;
    getPreviewWrap = () => this.previewRef.current?.parentElement || null;

    syncPreviewSize = () => {
        const preview = this.getPreview();
        const wrap = this.getPreviewWrap();
        if (!preview || !wrap) return;
        const { canvasWidth, canvasHeight } = this.state;
        const ar = Number(canvasHeight) / Number(canvasWidth || 1);
        const w = wrap.clientWidth;
        const h = Math.max(1, Math.round(w * ar));
        preview.style.height = `${h}px`;
    };

    // ===== Color helpers =====
    hexToRgb = (hex) => {
        let s = String(hex || "").trim();
        if (s[0] === "#") s = s.slice(1);
        if (s.length === 3) s = s.split("").map(c => c + c).join("");
        if (!/^[0-9a-fA-F]{6}$/.test(s)) return { r: 0, g: 0, b: 0 };
        const n = parseInt(s, 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    };

    rgbToHex = ({ r, g, b }) => {
        const h = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
        return ("#" + h(r) + h(g) + h(b)).toUpperCase();
    };

    luminance = ({ r, g, b }) => {
        const srgb = [r, g, b].map(v => {
            v = v / 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055)/1.055, 2.4);
        });
        return 0.2126*srgb[0] + 0.7152*srgb[1] + 0.0722*srgb[2];
    };

    // ===== Palette Generation =====
    generatePalette = () => {
        const { colorCount, primaryColor, secondaryColor, tertiaryColor, paletteType } = this.state;
        let palette = [];

        try {
            if (colorCount === 1) {
                switch (paletteType) {
                    case 'monotone':
                        palette = ColorEngine.generateMonotone(primaryColor, 5);
                        break;
                    case 'complementary':
                        palette = ColorEngine.generateComplementary(primaryColor);
                        break;
                    case 'darker':
                        palette = ColorEngine.generateDarkerTones(primaryColor, 5);
                        break;
                    case 'lighter':
                        palette = ColorEngine.generateLighterTones(primaryColor, 5);
                        break;
                    default:
                        palette = [primaryColor];
                }
            } else if (colorCount === 2) {
                const longPath = paletteType === 'longHue';
                switch (paletteType) {
                    case 'interpolate':
                    case 'shortHue':
                    case 'longHue':
                        palette = ColorEngine.interpolateColors(primaryColor, secondaryColor, 5, longPath);
                        break;
                    case 'triadic':
                        palette = ColorEngine.generateTriadic(primaryColor, secondaryColor);
                        break;
                    default:
                        palette = ColorEngine.interpolateColors(primaryColor, secondaryColor, 5, false);
                }
            } else if (colorCount === 3) {
                const longPath = paletteType === 'longHue';
                palette = ColorEngine.interpolateThreeColors(
                    primaryColor,
                    secondaryColor,
                    tertiaryColor,
                    longPath,
                    7
                );
            }

            if (palette.length === 0) {
                palette = [primaryColor];
            }
        } catch (error) {
            console.error('Error generating palette:', error);
            palette = [primaryColor];
        }

        this.currentPalette = palette;
        return palette;
    };

    // ===== SVG Generation =====
    createSVGFilter = (filterId, type, params) => {
        const ns = 'http://www.w3.org/2000/svg';
        const filter = document.createElementNS(ns, 'filter');
        filter.setAttribute('id', filterId);
        filter.setAttribute('filterUnits', 'userSpaceOnUse');
        filter.setAttribute('x', '-50%');
        filter.setAttribute('y', '-50%');
        filter.setAttribute('width', '200%');
        filter.setAttribute('height', '200%');

        // linearRGB (the spec default) mixes light additively during the blur —
        // brighter, less muddy mid-blends than sRGB. Set explicitly to lock intent.
        filter.setAttribute('color-interpolation-filters', 'linearRGB');

        // Blur is a FRACTION of the canvas' short edge, not raw user units. The
        // old raw values (mesh 50–300, blob 150–450) on a 1280×720 canvas were so
        // large that every shape averaged into every other shape — the other big
        // source of grey, washed-out output — and the same slider value produced
        // wildly different looks at different canvas sizes.
        const minDim = Math.min(Number(this.state.canvasWidth) || 1280,
            Number(this.state.canvasHeight) || 720);

        const addBlurChain = (stdDeviation) => {
            const feBlur = document.createElementNS(ns, 'feGaussianBlur');
            feBlur.setAttribute('in', 'SourceGraphic');
            feBlur.setAttribute('stdDeviation', stdDeviation);
            feBlur.setAttribute('result', 'blur');
            filter.appendChild(feBlur);

            // Gaussian mixing always bleeds a little saturation out of the
            // mid-blends; a mild post-blur boost keeps the field vivid without
            // touching the palette itself. Tune 1.1–1.3 to taste.
            const feSat = document.createElementNS(ns, 'feColorMatrix');
            feSat.setAttribute('in', 'blur');
            feSat.setAttribute('type', 'saturate');
            feSat.setAttribute('values', '1.15');
            filter.appendChild(feSat);
        };

        if (type === 'blob') {
            // smoothness 0.5..2.0 -> 5%..15% of the short edge (was 150..450 px)
            addBlurChain(((50 + params.smoothness * 200) / 3000) * minDim);
        } else if (type === 'mesh') {
            // blurIntensity 50..300 -> 2.5%..15% of the short edge (was 50..300 px)
            addBlurChain((params.blurIntensity / 2000) * minDim);
        }

        return filter;
    };

    // ===== Reusable post-processing helpers (shared by blob & mesh) =====
    // Wraps `contentGroup` in a grading-filter group when any of luminosity/contrast/saturation
    // is non-zero, then appends the appropriate node to `svg`. Returns nothing.
    appendWithColorGrade = (svg, defs, contentGroup, gradient, filterIdPrefix) => {
        const ns = 'http://www.w3.org/2000/svg';
        const lum = gradient.luminosity || 0;   // -50..+50
        const con = gradient.contrast   || 0;   // -50..+50
        const sat = gradient.saturation || 0;   // -100..+100
        const hasGrade = lum !== 0 || con !== 0 || sat !== 0;

        if (!hasGrade) {
            svg.appendChild(contentGroup);
            return;
        }

        const filterId = `${filterIdPrefix}GradeFilter`;
        const gradeFilter = document.createElementNS(ns, 'filter');
        gradeFilter.setAttribute('id', filterId);
        // Margin around the region: at exactly 0..100% of the bbox the blurred
        // halo of the inner group was hard-clipped at the geometry edge.
        gradeFilter.setAttribute('x', '-20%');
        gradeFilter.setAttribute('y', '-20%');
        gradeFilter.setAttribute('width', '140%');
        gradeFilter.setAttribute('height', '140%');
        // CRITICAL: SVG filters default to linearRGB, but all three curves below
        // are written for sRGB (pivot 0.5 = perceptual mid grey, ±0.25 = a
        // photographic lift). In linearRGB the contrast pivot lands on the wrong
        // grey (+contrast DARKENED the image: mid grey #808080 dropped to ~0.34)
        // and luminosity/saturation responded unevenly — the sliders felt broken.
        gradeFilter.setAttribute('color-interpolation-filters', 'sRGB');

        // Saturation: -100 -> 0 (true grayscale, as documented), 0 -> 1, +100 -> 2
        // (The old /200 "halved" response bottomed out at 0.5 — could never
        // fully desaturate, contradicting the state comment.)
        const satValue = Math.max(0, 1 + (sat / 100));

        // Contrast: -50 -> ~0.71, 0 -> 1, +50 -> ~1.41, pivoting on mid grey
        const slope = Math.pow(2, con / 100);
        const contrastIntercept = 0.5 - slope * 0.5;

        // Luminosity: -50 -> -0.25, 0 -> 0, +50 -> +0.25 (additive shift in sRGB)
        const lumShift = lum / 200;

        // Combined intercept: contrast pivot + luminosity additive shift
        const intercept = contrastIntercept + lumShift;

        // 1) Saturate
        if (sat !== 0) {
            const feSat = document.createElementNS(ns, 'feColorMatrix');
            feSat.setAttribute('type', 'saturate');
            feSat.setAttribute('values', String(satValue));
            feSat.setAttribute('in', 'SourceGraphic');
            feSat.setAttribute('result', 'satOut');
            gradeFilter.appendChild(feSat);
        }

        // 2) Contrast + Luminosity via linear feComponentTransfer on each channel
        if (con !== 0 || lum !== 0) {
            const feCT = document.createElementNS(ns, 'feComponentTransfer');
            feCT.setAttribute('in', sat !== 0 ? 'satOut' : 'SourceGraphic');
            ['feFuncR', 'feFuncG', 'feFuncB'].forEach(tag => {
                const fn = document.createElementNS(ns, tag);
                fn.setAttribute('type', 'linear');
                fn.setAttribute('slope', String(slope));
                fn.setAttribute('intercept', String(intercept));
                feCT.appendChild(fn);
            });
            gradeFilter.appendChild(feCT);
        }

        defs.appendChild(gradeFilter);

        const gradeGroup = document.createElementNS(ns, 'g');
        gradeGroup.setAttribute('filter', `url(#${filterId})`);
        gradeGroup.appendChild(contentGroup);
        svg.appendChild(gradeGroup);
    };

    // Appends a neutral film-grain overlay. The grain is grayscale noise centred
    // on mid grey and blended with soft-light: 50% grey is a no-op there, so the
    // overlay adds texture WITHOUT shifting the gradient's colors or lightness.
    // (The previous version overlay-blended the noise onto a WHITE rect — biasing
    // it bright — then applied it with mix-blend-mode: luminosity, which REPLACES
    // the artwork's lightness channel with the noise's. With noiseAmount
    // defaulting to 15, every mesh/blob render shipped pre-greyed/brightened —
    // a major reason the output looked washed out.)
    // No-op when noiseAmount is 0.
    appendNoiseOverlay = (svg, defs, gradient, filterIdPrefix) => {
        if (!gradient.noiseAmount || gradient.noiseAmount <= 0) return;
        const ns = 'http://www.w3.org/2000/svg';
        const filterId = `${filterIdPrefix}NoiseFilter`;

        // feTurbulence's baseFrequency is "cycles per user unit". The old code fed
        // it the raw slider scale (0.1..3.0): on a 1280×720 canvas anything from
        // ~0.3 up is identical per-pixel white noise, so the Frequency slider was
        // dead across most of its range — and Octaves (which double the frequency
        // per octave) could never change anything either. Normalize against the
        // canvas' short edge: slider 1.00 ≈ 128 noise cells across the short edge,
        // giving a real range from soft blotches (0.10) to fine grain (3.00).
        const minDim = Math.min(Number(this.state.canvasWidth) || 1280,
            Number(this.state.canvasHeight) || 720);
        const baseFrequency = (gradient.noiseFrequency * 128) / minDim;

        const noiseFilter = document.createElementNS(ns, 'filter');
        noiseFilter.setAttribute('id', filterId);
        noiseFilter.setAttribute('x', '0');
        noiseFilter.setAttribute('y', '0');
        noiseFilter.setAttribute('width', '100%');
        noiseFilter.setAttribute('height', '100%');
        // sRGB keeps the grain's mean at visual mid grey; in linearRGB (the
        // default) the same values render bright and the overlay lifts the image.
        noiseFilter.setAttribute('color-interpolation-filters', 'sRGB');

        const feTurb = document.createElementNS(ns, 'feTurbulence');
        feTurb.setAttribute('type', 'fractalNoise');
        feTurb.setAttribute('baseFrequency', baseFrequency.toFixed(3));
        feTurb.setAttribute('numOctaves', String(gradient.noiseOctaves));
        feTurb.setAttribute('stitchTiles', 'stitch');
        feTurb.setAttribute('result', 'turbulence');
        noiseFilter.appendChild(feTurb);

        // Grayscale the noise (colored noise would tint the gradient)…
        const feMono = document.createElementNS(ns, 'feColorMatrix');
        feMono.setAttribute('in', 'turbulence');
        feMono.setAttribute('type', 'saturate');
        feMono.setAttribute('values', '0');
        feMono.setAttribute('result', 'mono');
        noiseFilter.appendChild(feMono);

        // …and force full alpha (feTurbulence's alpha channel is noisy too, which
        // used to add extra speckle on top of everything).
        const feCT = document.createElementNS(ns, 'feComponentTransfer');
        feCT.setAttribute('in', 'mono');
        const feFuncA = document.createElementNS(ns, 'feFuncA');
        feFuncA.setAttribute('type', 'linear');
        feFuncA.setAttribute('slope', '0');
        feFuncA.setAttribute('intercept', '1');
        feCT.appendChild(feFuncA);
        noiseFilter.appendChild(feCT);

        defs.appendChild(noiseFilter);

        const noiseRect = document.createElementNS(ns, 'rect');
        noiseRect.setAttribute('x', '0');
        noiseRect.setAttribute('y', '0');
        noiseRect.setAttribute('width', '100%');
        noiseRect.setAttribute('height', '100%');
        // Neutral grey fallback: if the filter ever fails to apply, soft-light
        // with 50% grey is invisible instead of a white wash.
        noiseRect.setAttribute('fill', '#808080');
        noiseRect.setAttribute(
            'style',
            `mix-blend-mode: soft-light; filter: url(#${filterId}); opacity: ${gradient.noiseAmount / 100}`
        );
        svg.appendChild(noiseRect);
    };

    generateSVG = (gradient) => {
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('xmlns', ns);
        svg.setAttribute('viewBox', `0 0 ${this.state.canvasWidth} ${this.state.canvasHeight}`);
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');

        const defs = document.createElementNS(ns, 'defs');
        svg.appendChild(defs);

        switch (gradient.type) {
            case 'linear': {
                const linearGrad = document.createElementNS(ns, 'linearGradient');
                linearGrad.setAttribute('id', 'gradient');
                linearGrad.setAttribute('x1', gradient.x1);
                linearGrad.setAttribute('y1', gradient.y1);
                linearGrad.setAttribute('x2', gradient.x2);
                linearGrad.setAttribute('y2', gradient.y2);

                gradient.colors.forEach((color, index) => {
                    const stop = document.createElementNS(ns, 'stop');
                    stop.setAttribute('offset', `${(index / (gradient.colors.length - 1)) * 100}%`);
                    stop.setAttribute('stop-color', color);
                    linearGrad.appendChild(stop);
                });

                defs.appendChild(linearGrad);

                const rect = document.createElementNS(ns, 'rect');
                rect.setAttribute('width', '100%');
                rect.setAttribute('height', '100%');
                rect.setAttribute('fill', 'url(#gradient)');
                svg.appendChild(rect);
                break;
            }

            case 'radial': {
                const radialGrad = document.createElementNS(ns, 'radialGradient');
                radialGrad.setAttribute('id', 'gradient');
                radialGrad.setAttribute('cx', gradient.cx);
                radialGrad.setAttribute('cy', gradient.cy);
                radialGrad.setAttribute('r', gradient.rx);

                gradient.colors.forEach((color, index) => {
                    const stop = document.createElementNS(ns, 'stop');
                    stop.setAttribute('offset', `${(index / (gradient.colors.length - 1)) * 100}%`);
                    stop.setAttribute('stop-color', color);
                    radialGrad.appendChild(stop);
                });

                defs.appendChild(radialGrad);

                const rect = document.createElementNS(ns, 'rect');
                rect.setAttribute('width', '100%');
                rect.setAttribute('height', '100%');
                rect.setAttribute('fill', 'url(#gradient)');
                svg.appendChild(rect);
                break;
            }

            case 'blob': {
                const filter = this.createSVGFilter('blobFilter', 'blob', { smoothness: gradient.smoothness });
                defs.appendChild(filter);

                // Background fill with first color — inside contentRoot so the
                // color grade applies to it too (it used to bypass the grade,
                // leaving a mismatched backdrop behind the graded shapes).
                const contentRoot = document.createElementNS(ns, 'g');
                const rect = document.createElementNS(ns, 'rect');
                rect.setAttribute('width', '100%');
                rect.setAttribute('height', '100%');
                rect.setAttribute('fill', gradient.blobs[0]?.color || '#ffffff');
                contentRoot.appendChild(rect);

                const blobGroup = document.createElementNS(ns, 'g');
                blobGroup.setAttribute('filter', 'url(#blobFilter)');

                const viewBox = { w: this.state.canvasWidth, h: this.state.canvasHeight };
                const random = GradientGenerator.seededRandom(gradient.seed);

                gradient.blobs.forEach(blob => {
                    if (blob.shapeType === 'organic') {
                        // Generate organic path
                        const avgRadius = (blob.rx + blob.ry) / 2;
                        const path = document.createElementNS(ns, 'path');
                        path.setAttribute('d', GradientGenerator.generateOrganicPath(blob.cx, blob.cy, avgRadius, random, viewBox));
                        path.setAttribute('fill', blob.color);
                        path.setAttribute('opacity', blob.opacity);
                        blobGroup.appendChild(path);
                    } else {
                        // Use ellipse
                        const ellipse = document.createElementNS(ns, 'ellipse');
                        ellipse.setAttribute('cx', `${blob.cx}%`);
                        ellipse.setAttribute('cy', `${blob.cy}%`);
                        ellipse.setAttribute('rx', `${blob.rx}%`);
                        ellipse.setAttribute('ry', `${blob.ry || blob.rx}%`);
                        if (blob.rotation) {
                            ellipse.setAttribute('transform', `rotate(${blob.rotation} ${blob.cx}% ${blob.cy}%)`);
                        }
                        ellipse.setAttribute('fill', blob.color);
                        ellipse.setAttribute('opacity', blob.opacity);
                        blobGroup.appendChild(ellipse);
                    }
                });

                contentRoot.appendChild(blobGroup);

                // ===== Color grading + noise (shared helpers) =====
                this.appendWithColorGrade(svg, defs, contentRoot, gradient, 'blob');
                this.appendNoiseOverlay(svg, defs, gradient, 'blob');
                break;
            }

            case 'mesh': {
                const filter = this.createSVGFilter('meshFilter', 'mesh', { blurIntensity: gradient.blurIntensity });
                defs.appendChild(filter);

                // Background fill — inside contentRoot so the color grade
                // applies to it too (it used to bypass the grade).
                const contentRoot = document.createElementNS(ns, 'g');
                const rect = document.createElementNS(ns, 'rect');
                rect.setAttribute('width', '100%');
                rect.setAttribute('height', '100%');
                rect.setAttribute('fill', gradient.meshPoints[0]?.color || '#ffffff');
                contentRoot.appendChild(rect);

                const meshGroup = document.createElementNS(ns, 'g');
                meshGroup.setAttribute('filter', 'url(#meshFilter)');

                gradient.meshPoints.forEach(point => {
                    if (point.shapeType === 'circle') {
                        const circle = document.createElementNS(ns, 'circle');
                        circle.setAttribute('cx', `${point.cx}%`);
                        circle.setAttribute('cy', `${point.cy}%`);
                        circle.setAttribute('r', `${point.rx}%`);
                        circle.setAttribute('fill', point.color);
                        circle.setAttribute('opacity', point.opacity);
                        meshGroup.appendChild(circle);
                    } else {
                        // Use ellipse for more variety
                        const ellipse = document.createElementNS(ns, 'ellipse');
                        ellipse.setAttribute('cx', `${point.cx}%`);
                        ellipse.setAttribute('cy', `${point.cy}%`);
                        ellipse.setAttribute('rx', `${point.rx}%`);
                        ellipse.setAttribute('ry', `${point.ry || point.rx}%`);
                        if (point.rotation) {
                            ellipse.setAttribute('transform', `rotate(${point.rotation} ${point.cx}% ${point.cy}%)`);
                        }
                        ellipse.setAttribute('fill', point.color);
                        ellipse.setAttribute('opacity', point.opacity);
                        meshGroup.appendChild(ellipse);
                    }
                });

                contentRoot.appendChild(meshGroup);

                // ===== Color grading + noise (shared helpers) =====
                this.appendWithColorGrade(svg, defs, contentRoot, gradient, 'mesh');
                this.appendNoiseOverlay(svg, defs, gradient, 'mesh');
                break;
            }
        }

        const serializer = new XMLSerializer();
        return GradientGenerator.optimizeSVG(serializer.serializeToString(svg));
    };

    // ===== Generation =====
    generateNewGradient = () => {
        const palette = this.generatePalette();
        const s = this.state;

        let gradient;
        switch (s.gradientType) {
            case 'linear':
                gradient = GradientGenerator.createLinearGradient(palette, s.angle);
                break;
            case 'radial':
                gradient = GradientGenerator.createRadialGradient(palette, s.centerX, s.centerY, s.radiusX, s.radiusY);
                break;
            case 'blob':
                gradient = GradientGenerator.createBlobGradient(palette, s.blobCount, s.smoothness / 100, s.minSize, s.maxSize, parseInt(s.seed));
                // Color grading
                gradient.luminosity = s.luminosity;
                gradient.contrast = s.contrast;
                gradient.saturation = s.saturation;
                // Noise texture
                gradient.noiseAmount = s.noiseAmount;
                gradient.noiseFrequency = s.noiseFrequency / 100;
                gradient.noiseOctaves = s.noiseOctaves;
                break;
            case 'mesh':
                gradient = GradientGenerator.createMeshGradient(palette, s.gridSize, s.blurIntensity, parseInt(s.seed));
                // Color grading
                gradient.luminosity = s.luminosity;
                gradient.contrast = s.contrast;
                gradient.saturation = s.saturation;
                // Noise texture
                gradient.noiseAmount = s.noiseAmount;
                gradient.noiseFrequency = s.noiseFrequency / 100; // slider stores ×100 for finer control
                gradient.noiseOctaves = s.noiseOctaves;
                break;
            default:
                gradient = GradientGenerator.createLinearGradient(palette, s.angle);
        }

        this.currentGradient = gradient;
        this.svgContent = this.generateSVG(gradient);

        this.updatePreview();
        this.updateStats();
    };

    updatePreview = () => {
        const preview = this.getPreview();
        if (preview && this.svgContent) {
            const encoded = btoa(unescape(encodeURIComponent(this.svgContent)));
            const dataUri = `data:image/svg+xml;base64,${encoded}`;
            preview.style.backgroundImage = `url("${dataUri}")`;
            preview.style.backgroundSize = 'cover';
            preview.style.backgroundPosition = 'center';
        }
    };

    getPaletteOptions = () => {
        const n = this.state.colorCount|0;
        if (n === 1) {
            return [
                { value: 'monotone', label: 'Monotone' },
                { value: 'complementary', label: 'Complementary' },
                { value: 'darker', label: 'Darker Tones' },
                { value: 'lighter', label: 'Lighter Tones' },
            ];
        }
        if (n === 2) {
            return [
                { value: 'interpolate', label: 'Interpolate' },
                { value: 'triadic', label: 'Triadic' },
                { value: 'shortHue', label: 'Short Hue Path' },
                { value: 'longHue', label: 'Long Hue Path' },
            ];
        }
        // n === 3
        return [
            { value: 'shortHue', label: 'Short Hue Path' },
            { value: 'longHue', label: 'Long Hue Path' },
        ];
    };

    updateStats = () => {
        const bytes = new Blob([this.svgContent]).size;
        const kb = (bytes / 1024).toFixed(2) + " KB";
        this.setState({ stats: { svgSizeText: kb } });
    };

    // ===== Debounced regeneration =====
    scheduleRegen = () => {
        if (this._regenTimer) clearTimeout(this._regenTimer);
        this._regenTimer = setTimeout(() => {
            requestAnimationFrame(this.generateNewGradient);
        }, 120);
    };

    // ===== Change handlers =====
    handleColorCountChange = (e, value) => {
        this.setState({ colorCount: value }, () => {
            this.updatePaletteOptions(value);
            this.generateNewGradient();
        });
    };

    handleColorCountToggle = (event, next) => {
        // Preact/MUI can pass null when clicking the already-selected button — ignore it.
        if (next == null) return;

        this.setState({ colorCount: next }, () => {
            this.updatePaletteOptions(next);   // clamp paletteType to valid set
            this.generateNewGradient();        // regen immediately
        });
    };

    updatePaletteOptions = (count) => {
        const allowed = this.allowedPaletteTypes(count);
        const current = this.state.paletteType;
        const next = allowed.includes(current) ? current : allowed[0];
        if (next !== current) this.setState({ paletteType: next });
    };


    handlePaletteTypeChange = (event, _child) => {
        // MUI v4 Select with Preact can sometimes pass value on event.target.value, sometimes not
        const raw = event && event.target && (event.target.value !== undefined)
            ? event.target.value
            : (typeof event === 'string' ? event : this.state.paletteType);

        const allowed = this.allowedPaletteTypes(this.state.colorCount);
        const next = allowed.includes(raw) ? raw : allowed[0];

        // Force a regen even if user reselects the same value (to cover any stale palette)
        if (next !== this.state.paletteType) {
            this.setState({ paletteType: next }, this.generateNewGradient);
        } else {
            this.generateNewGradient();
        }
    };

    handleChangeGenerate = (name) => (event) => {
        const value = event?.target?.value ?? event;
        this.setState({ [name]: value }, () => {
            if (name === "canvasWidth" || name === "canvasHeight") this.syncPreviewSize();
            this.generateNewGradient();
        });
    };

    handleSliderGenerate = (name) => (e, value) => {
        this.setState({ [name]: value }, () => {
            this.generateNewGradient();
        });
    };

    // Seed
    newSeed = () => {
        const newSeed = String(Math.floor(10000 + Math.random() * 90000));
        this.setState({ seed: newSeed }, this.generateNewGradient);
    };

    randomize = () => {
        const colorCount = 1 + Math.floor(Math.random() * 3);
        const gradientTypes = ['linear', 'radial', 'blob', 'mesh'];
        const randomType = gradientTypes[Math.floor(Math.random() * gradientTypes.length)];

        this.setState({
            colorCount,
            primaryColor: ColorEngine.generateRandomColor(),
            secondaryColor: ColorEngine.generateRandomColor(),
            tertiaryColor: ColorEngine.generateRandomColor(),
            gradientType: randomType,
            angle: Math.floor(Math.random() * 360),
            centerX: 20 + Math.floor(Math.random() * 60),
            centerY: 20 + Math.floor(Math.random() * 60),
            radiusX: 30 + Math.floor(Math.random() * 50),
            radiusY: 30 + Math.floor(Math.random() * 50),
            blobCount: 2 + Math.floor(Math.random() * 5),
            smoothness: 60 + Math.floor(Math.random() * 40),
            gridSize: 2 + Math.floor(Math.random() * 4),
            blurIntensity: 100 + Math.floor(Math.random() * 200),
            luminosity: Math.floor(Math.random() * 61) - 30,       // -30..+30
            contrast: Math.floor(Math.random() * 61) - 30,         // -30..+30
            saturation: Math.floor(Math.random() * 121) - 60,      // -60..+60
            noiseAmount: Math.floor(Math.random() * 40),           // 0–40% feels tasteful
            noiseFrequency: 30 + Math.floor(Math.random() * 200),  // 0.30–2.30
            noiseOctaves: 1 + Math.floor(Math.random() * 4)
        }, () => {
            this.updatePaletteOptions(colorCount);
            this.generateNewGradient();
        });
    };

    downloadSVG = () => {
        const blob = new Blob([this.svgContent || ""], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `gradient-${this.state.seed}.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // ===== Color Picker Menu logic =====
    openColorMenu = (which) => (event) => {
        this.setState({ colorMenuWhich: which, colorMenuAnchor: event.currentTarget });
    };

    closeColorMenu = () => {
        this.setState({ colorMenuWhich: null, colorMenuAnchor: null }, () => {
            this.generateNewGradient();
        });
    };

    onPickerChange = (rgba) => {
        const { colorMenuWhich } = this.state;
        if (!colorMenuWhich) return;

        const hex = this.rgbToHex(rgba);
        const updates = {};

        if (colorMenuWhich === "primary") {
            updates.primaryColor = hex;
            updates.primaryAlpha = rgba.a ?? 1;
        } else if (colorMenuWhich === "secondary") {
            updates.secondaryColor = hex;
            updates.secondaryAlpha = rgba.a ?? 1;
        } else if (colorMenuWhich === "tertiary") {
            updates.tertiaryColor = hex;
            updates.tertiaryAlpha = rgba.a ?? 1;
        }

        this.setState(updates, () => {
            this.scheduleRegen();
        });
    };

    convertToBase64 = () => {
        if (!this.svgContent) return "";
        // Same UTF-8-safe encoding as updatePreview — a bare btoa() throws on
        // any non-Latin-1 character in the SVG.
        const encoded = btoa(unescape(encodeURIComponent(this.svgContent)));
        return `data:image/svg+xml;base64,${encoded}`;
    };

    allowedPaletteTypes = (count) => {
        switch (count|0) {
            case 1: return ['monotone','complementary','darker','lighter'];
            case 2: return ['interpolate','triadic','shortHue','longHue'];
            case 3: return ['shortHue','longHue'];
            default: return ['interpolate'];
        }
    };

    render() {
        const { classes, open, size } = this.props;
        const s = this.state;

        // Button contrast & shadows
        const prgb = this.hexToRgb(s.primaryColor);
        const srgb = this.hexToRgb(s.secondaryColor);
        const trgb = this.hexToRgb(s.tertiaryColor);
        const pL = this.luminance(prgb);
        const sL = this.luminance(srgb);
        const tL = this.luminance(trgb);
        const primaryText = pL < 0.45 ? "white" : "black";
        const secondaryText = sL < 0.45 ? "white" : "black";
        const tertiaryText = tL < 0.45 ? "white" : "black";

        // RGBA values for picker
        const primaryRgba = { r: prgb.r, g: prgb.g, b: prgb.b, a: s.primaryAlpha };
        const secondaryRgba = { r: srgb.r, g: srgb.g, b: srgb.b, a: s.secondaryAlpha };
        const tertiaryRgba = { r: trgb.r, g: trgb.g, b: trgb.b, a: s.tertiaryAlpha };

        return (
            <Dialog className={classes.dialog} open={open} maxWidth="md" fullWidth disablePortal={false}
                    onClose={(e) => this.props.onClose?.(e)} keepMounted={false}
                    onEnter={this.handleDialogEnter}
                    onEntered={this.handleDialogEntered}>
                <DialogTitle style={{ display: "flex", margin: "0 0 16px 0" }}>
                    <Typography component="h1" variant="h4" style={{ width: "100%", margin: 0 }}>
                        {t("components.gradient_editor_dialog.create_a_new_gradient")}
                    </Typography>
                </DialogTitle>
                <DialogContent scroll="paper" className={classes.dialogContent}>
                    <Grid container spacing={2}>
                        {/* Left: preview + actions */}
                        <Grid item xs={12} md={8}>
                            <div className={classes.previewPanel}>
                                <Fade in={open} timeout={300} appear>
                                    <div className={classes.gradientPreviewWrap}>
                                        <div className={classes.gradientPreview} ref={this.previewRef} />
                                    </div>
                                </Fade>
                                <Fade in={open} timeout={450} appear>
                                    <Grid container spacing={1}>
                                        <Grid item xs={12} md={4}>
                                            <Button fullWidth variant="text" onClick={this.newSeed} startIcon={<ShuffleIcon />}>
                                                {t("components.gradient_editor_dialog.new_seed")}
                                            </Button>
                                        </Grid>
                                        <Grid item xs={12} md={4}>
                                            <Button fullWidth variant="text" onClick={this.randomize}>
                                                {t("components.gradient_editor_dialog.randomize")}
                                            </Button>
                                        </Grid>
                                        <Grid item xs={12} md={4}>
                                            <Button fullWidth variant="text" onClick={this.downloadSVG} startIcon={<GetAppIcon />}>{t("components.gradient_editor_dialog.download", {
                                                    svgSizeText: s.stats.svgSizeText
                                                })}</Button>
                                        </Grid>
                                    </Grid>
                                </Fade>

                                {/* Canvas inputs row */}
                                <Fade in={open} timeout={500} appear>
                                    <div className={classes.canvasInputRow}>
                                        <TextField
                                            label={t("components.gradient_editor_dialog.width")}
                                            type="number"
                                            variant="outlined"
                                            size="small"
                                            value={s.canvasWidth}
                                            onChange={(e) => this.setState({ canvasWidth: e.target.value }, () => {
                                                this.syncPreviewSize();
                                                this.generateNewGradient();
                                            })}
                                            style={{display: size ? 'block' : 'none'}}
                                        />
                                        <TextField
                                            label={t("components.gradient_editor_dialog.height")}
                                            type="number"
                                            variant="outlined"
                                            size="small"
                                            value={s.canvasHeight}
                                            onChange={(e) => this.setState({ canvasHeight: e.target.value }, () => {
                                                this.syncPreviewSize();
                                                this.generateNewGradient();
                                            })}
                                            style={{display: size ? 'block' : 'none'}}
                                        />
                                        <TextField
                                            label={t("components.gradient_editor_dialog.seed")}
                                            variant="outlined"
                                            size="small"
                                            value={s.seed}
                                            onChange={this.handleChangeGenerate("seed")}
                                            style={{gridColumn: size ? 'auto' : '1 / -1'}}
                                        />
                                    </div>
                                </Fade>
                            </div>
                        </Grid>

                        {/* Right: Accordion controls */}
                        <Grid item xs={12} md={4}>
                            <div className={classes.controlsPanel}>
                                <Fade in={open} timeout={300} appear>
                                    <Accordion
                                        expanded={s.expandedPanel === 'colors'}
                                        onChange={this.handlePanelChange('colors')}
                                    >
                                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                            <Typography className={classes.sectionTitle} component={"h5"}>{t("components.gradient_editor_dialog.colors")}</Typography>
                                        </AccordionSummary>
                                        <AccordionDetails style={{ display: "block" }}>
                                            <Grid container spacing={1} alignItems="left">
                                                {/* Color count slider */}
                                                <Grid item xs={12}>
                                                    <Typography
                                                        gutterBottom
                                                        variant="caption"
                                                        style={{ display: "block", marginBottom: 6 }}
                                                    >
                                                        {t("components.gradient_editor_dialog.primary_color_count")}
                                                    </Typography>

                                                    <ToggleButtonGroup
                                                        value={s.colorCount}
                                                        exclusive
                                                        size={"small"}
                                                        className={classes.colorCount}
                                                        onChange={this.handleColorCountToggle}
                                                        aria-label={t("components.gradient_editor_dialog.color_count")}
                                                        style={{ width: "100%" }}
                                                    >
                                                        <ToggleButton
                                                            value={1}
                                                            aria-label="1 color"
                                                            style={{ flex: 1, fontWeight: "bold"}}
                                                        >
                                                            1
                                                        </ToggleButton>
                                                        <ToggleButton
                                                            value={2}
                                                            aria-label="2 colors"
                                                            style={{ flex: 1, fontWeight: "bold"}}
                                                        >
                                                            2
                                                        </ToggleButton>
                                                        <ToggleButton
                                                            value={3}
                                                            aria-label="3 colors"
                                                            style={{ flex: 1, fontWeight: "bold"}}
                                                        >
                                                            3
                                                        </ToggleButton>
                                                    </ToggleButtonGroup>
                                                </Grid>


                                                {/* Color buttons */}
                                                <Grid item xs={s.colorCount === 3 ? 4 : s.colorCount === 2 ? 6 : 12}>
                                                    <Button
                                                        variant="contained"
                                                        className={classes.colorButton}
                                                        style={{
                                                            color: primaryText,
                                                            background: s.primaryColor
                                                        }}
                                                        onClick={this.openColorMenu("primary")}
                                                    >
                                                        {t("components.gradient_editor_dialog.primary")}
                                                    </Button>
                                                </Grid>

                                                {s.colorCount >= 2 && (
                                                    <Grid item xs={s.colorCount === 3 ? 4 : 6}>
                                                        <Button
                                                            variant="contained"
                                                            className={classes.colorButton}
                                                            style={{
                                                                color: secondaryText,
                                                                background: s.secondaryColor
                                                            }}
                                                            onClick={this.openColorMenu("secondary")}
                                                        >
                                                            {t("components.gradient_editor_dialog.secondary")}
                                                        </Button>
                                                    </Grid>
                                                )}

                                                {s.colorCount >= 3 && (
                                                    <Grid item xs={4}>
                                                        <Button
                                                            variant="contained"
                                                            className={classes.colorButton}
                                                            style={{
                                                                color: tertiaryText,
                                                                background: s.tertiaryColor
                                                            }}
                                                            onClick={this.openColorMenu("tertiary")}
                                                        >
                                                            {t("components.gradient_editor_dialog.tertiary")}
                                                        </Button>
                                                    </Grid>
                                                )}

                                                {/* Palette type selector */}
                                                <Grid item xs={12}>
                                                    <Box mt={2}>
                                                        <FormControl variant="outlined" fullWidth>
                                                            <InputLabel id="palette-type-label">{t("components.gradient_editor_dialog.palette_type")}</InputLabel>
                                                            <Select
                                                                labelId="palette-type-label"
                                                                id="palette-type"
                                                                label={t("components.gradient_editor_dialog.palette_type")}
                                                                value={s.paletteType}
                                                                onChange={this.handlePaletteTypeChange}
                                                                MenuProps={{
                                                                    getContentAnchorEl: null,
                                                                    anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
                                                                    transformOrigin: { vertical: 'top', horizontal: 'left' },
                                                                }}
                                                            >
                                                                {this.getPaletteOptions().map(opt => (
                                                                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                                                                ))}
                                                            </Select>
                                                        </FormControl>
                                                    </Box>
                                                </Grid>

                                                {/* Palette preview */}
                                                <Grid item xs={12}>
                                                    <Box className={classes.palettePreview}>
                                                        {this.currentPalette.map((color, idx) => (
                                                            <div
                                                                key={idx}
                                                                className={classes.colorSwatch}
                                                                style={{ background: color }}
                                                                title={color}
                                                            />
                                                        ))}
                                                    </Box>
                                                </Grid>
                                            </Grid>
                                        </AccordionDetails>
                                    </Accordion>
                                </Fade>

                                {/* Gradient Type */}
                                <Fade in={open} timeout={450} appear>
                                    <Accordion
                                        expanded={s.expandedPanel === 'gradient'}
                                        onChange={this.handlePanelChange('gradient')}
                                    >
                                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                            <Typography className={classes.sectionTitle} component={"h5"}>{t("components.gradient_editor_dialog.shapes")}</Typography>
                                        </AccordionSummary>
                                        <AccordionDetails style={{ display: "block" }}>
                                            <FormControl variant="outlined" fullWidth>
                                                <InputLabel>{t("components.gradient_editor_dialog.type")}</InputLabel>
                                                <Select
                                                    label={t("components.gradient_editor_dialog.type")}
                                                    value={s.gradientType}
                                                    onChange={this.handleChangeGenerate("gradientType")}
                                                >
                                                    <MenuItem value="linear">{t("components.gradient_editor_dialog.linear")}</MenuItem>
                                                    <MenuItem value="radial">{t("components.gradient_editor_dialog.radial")}</MenuItem>
                                                    <MenuItem value="blob">{t("components.gradient_editor_dialog.blob")}</MenuItem>
                                                    <MenuItem value="mesh">{t("components.gradient_editor_dialog.mesh")}</MenuItem>
                                                </Select>
                                            </FormControl>

                                            {/* Linear controls */}
                                            <Collapse in={s.gradientType === 'linear'}>
                                                <Box mt={2}>
                                                    <Typography gutterBottom variant="caption">{t("components.gradient_editor_dialog.angle", {
                                                            angle: s.angle
                                                        })}</Typography>
                                                    <Slider
                                                        min={0}
                                                        max={360}
                                                        value={s.angle}
                                                        onChange={this.handleSliderGenerate("angle")}
                                                    />
                                                </Box>
                                            </Collapse>

                                            {/* Radial controls */}
                                            <Collapse in={s.gradientType === 'radial'}>
                                                <Box mt={2}>
                                                    <Typography gutterBottom variant="caption">{t("components.gradient_editor_dialog.center_x", {
                                                            centerX: s.centerX
                                                        })}</Typography>
                                                    <Slider
                                                        min={0}
                                                        max={100}
                                                        value={s.centerX}
                                                        onChange={this.handleSliderGenerate("centerX")}
                                                    />
                                                    <Typography gutterBottom variant="caption">{t("components.gradient_editor_dialog.center_y", {
                                                            centerY: s.centerY
                                                        })}</Typography>
                                                    <Slider
                                                        min={0}
                                                        max={100}
                                                        value={s.centerY}
                                                        onChange={this.handleSliderGenerate("centerY")}
                                                    />
                                                    <Typography gutterBottom variant="caption">{t("components.gradient_editor_dialog.radius_x", {
                                                            radiusX: s.radiusX
                                                        })}</Typography>
                                                    <Slider
                                                        min={10}
                                                        max={100}
                                                        value={s.radiusX}
                                                        onChange={this.handleSliderGenerate("radiusX")}
                                                    />
                                                    <Typography gutterBottom variant="caption">{t("components.gradient_editor_dialog.radius_y", {
                                                            radiusY: s.radiusY
                                                        })}</Typography>
                                                    <Slider
                                                        min={10}
                                                        max={100}
                                                        value={s.radiusY}
                                                        onChange={this.handleSliderGenerate("radiusY")}
                                                    />
                                                </Box>
                                            </Collapse>

                                            {/* Blob controls */}
                                            <Collapse in={s.gradientType === 'blob'}>
                                                <Box mt={2}>
                                                    <Typography gutterBottom variant="caption">{t("components.gradient_editor_dialog.blob_count", {
                                                            blobCount: s.blobCount
                                                        })}</Typography>
                                                    <Slider
                                                        min={2}
                                                        max={8}
                                                        value={s.blobCount}
                                                        onChange={this.handleSliderGenerate("blobCount")}
                                                    />
                                                    <Typography gutterBottom variant="caption">{t("components.gradient_editor_dialog.smoothness", {
                                                            smoothness: s.smoothness
                                                        })}</Typography>
                                                    <Slider
                                                        min={50}
                                                        max={200}
                                                        value={s.smoothness}
                                                        onChange={this.handleSliderGenerate("smoothness")}
                                                    />
                                                    <Typography gutterBottom variant="caption">{t("components.gradient_editor_dialog.min_size", {
                                                            minSize: s.minSize
                                                        })}</Typography>
                                                    <Slider
                                                        min={10}
                                                        max={50}
                                                        value={s.minSize}
                                                        onChange={this.handleSliderGenerate("minSize")}
                                                    />
                                                    <Typography gutterBottom variant="caption">{t("components.gradient_editor_dialog.max_size", {
                                                            maxSize: s.maxSize
                                                        })}</Typography>
                                                    <Slider
                                                        min={30}
                                                        max={80}
                                                        value={s.maxSize}
                                                        onChange={this.handleSliderGenerate("maxSize")}
                                                    />
                                                    <Typography gutterBottom variant="caption">{t("components.gradient_editor_dialog.luminosity", {
                                                            luminosity: s.luminosity > 0 ? `+${s.luminosity}` : s.luminosity
                                                        })}</Typography>
                                                    <Slider
                                                        min={-50}
                                                        max={50}
                                                        value={s.luminosity}
                                                        onChange={this.handleSliderGenerate("luminosity")}
                                                        marks={[{ value: 0, label: '0' }]}
                                                    />
                                                    <Typography gutterBottom variant="caption">{t("components.gradient_editor_dialog.contrast", {
                                                            contrast: s.contrast > 0 ? `+${s.contrast}` : s.contrast
                                                        })}</Typography>
                                                    <Slider
                                                        min={-50}
                                                        max={50}
                                                        value={s.contrast}
                                                        onChange={this.handleSliderGenerate("contrast")}
                                                        marks={[{ value: 0, label: '0' }]}
                                                    />
                                                    <Typography gutterBottom variant="caption">{t("components.gradient_editor_dialog.saturation", {
                                                            saturation: s.saturation > 0 ? `+${s.saturation}` : s.saturation
                                                        })}</Typography>
                                                    <Slider
                                                        min={-100}
                                                        max={100}
                                                        value={s.saturation}
                                                        onChange={this.handleSliderGenerate("saturation")}
                                                        marks={[{ value: 0, label: '0' }]}
                                                    />
                                                    <Typography gutterBottom variant="caption">{t("components.gradient_editor_dialog.noise_amount", {
                                                            noiseAmount: s.noiseAmount
                                                        })}</Typography>
                                                    <Slider
                                                        min={0}
                                                        max={100}
                                                        value={s.noiseAmount}
                                                        onChange={this.handleSliderGenerate("noiseAmount")}
                                                    />
                                                    <Typography gutterBottom variant="caption">{t("components.gradient_editor_dialog.noise_frequency", {
                                                            noiseFrequency: (s.noiseFrequency / 100).toFixed(2)
                                                        })}</Typography>
                                                    <Slider
                                                        min={10}
                                                        max={300}
                                                        value={s.noiseFrequency}
                                                        onChange={this.handleSliderGenerate("noiseFrequency")}
                                                    />
                                                    <Typography gutterBottom variant="caption">{t("components.gradient_editor_dialog.noise_octaves", {
                                                            noiseOctaves: s.noiseOctaves
                                                        })}</Typography>
                                                    <Slider
                                                        min={1}
                                                        max={6}
                                                        value={s.noiseOctaves}
                                                        onChange={this.handleSliderGenerate("noiseOctaves")}
                                                    />
                                                </Box>
                                            </Collapse>

                                            {/* Mesh controls */}
                                            <Collapse in={s.gradientType === 'mesh'}>
                                                <Box mt={2}>
                                                    <Typography gutterBottom variant="caption">{t("components.gradient_editor_dialog.grid_size_x", {
                                                            gridSize: s.gridSize,
                                                            gridSize_2: s.gridSize
                                                        })}</Typography>
                                                    <Slider
                                                        min={2}
                                                        max={6}
                                                        value={s.gridSize}
                                                        onChange={this.handleSliderGenerate("gridSize")}
                                                    />
                                                    <Typography gutterBottom variant="caption">{t("components.gradient_editor_dialog.blur_intensity", {
                                                            blurIntensity: s.blurIntensity
                                                        })}</Typography>
                                                    <Slider
                                                        min={50}
                                                        max={300}
                                                        value={s.blurIntensity}
                                                        onChange={this.handleSliderGenerate("blurIntensity")}
                                                    />
                                                    <Typography gutterBottom variant="caption">{t("components.gradient_editor_dialog.luminosity", {
                                                            luminosity: s.luminosity > 0 ? `+${s.luminosity}` : s.luminosity
                                                        })}</Typography>
                                                    <Slider
                                                        min={-50}
                                                        max={50}
                                                        value={s.luminosity}
                                                        onChange={this.handleSliderGenerate("luminosity")}
                                                        marks={[{ value: 0, label: '0' }]}
                                                    />
                                                    <Typography gutterBottom variant="caption">{t("components.gradient_editor_dialog.contrast", {
                                                            contrast: s.contrast > 0 ? `+${s.contrast}` : s.contrast
                                                        })}</Typography>
                                                    <Slider
                                                        min={-50}
                                                        max={50}
                                                        value={s.contrast}
                                                        onChange={this.handleSliderGenerate("contrast")}
                                                        marks={[{ value: 0, label: '0' }]}
                                                    />
                                                    <Typography gutterBottom variant="caption">{t("components.gradient_editor_dialog.saturation", {
                                                            saturation: s.saturation > 0 ? `+${s.saturation}` : s.saturation
                                                        })}</Typography>
                                                    <Slider
                                                        min={-100}
                                                        max={100}
                                                        value={s.saturation}
                                                        onChange={this.handleSliderGenerate("saturation")}
                                                        marks={[{ value: 0, label: '0' }]}
                                                    />
                                                    <Typography gutterBottom variant="caption">{t("components.gradient_editor_dialog.noise_amount", {
                                                            noiseAmount: s.noiseAmount
                                                        })}</Typography>
                                                    <Slider
                                                        min={0}
                                                        max={100}
                                                        value={s.noiseAmount}
                                                        onChange={this.handleSliderGenerate("noiseAmount")}
                                                    />
                                                    <Typography gutterBottom variant="caption">{t("components.gradient_editor_dialog.noise_frequency", {
                                                            noiseFrequency: (s.noiseFrequency / 100).toFixed(2)
                                                        })}</Typography>
                                                    <Slider
                                                        min={10}
                                                        max={300}
                                                        value={s.noiseFrequency}
                                                        onChange={this.handleSliderGenerate("noiseFrequency")}
                                                    />
                                                    <Typography gutterBottom variant="caption">{t("components.gradient_editor_dialog.noise_octaves", {
                                                            noiseOctaves: s.noiseOctaves
                                                        })}</Typography>
                                                    <Slider
                                                        min={1}
                                                        max={6}
                                                        value={s.noiseOctaves}
                                                        onChange={this.handleSliderGenerate("noiseOctaves")}
                                                    />
                                                </Box>
                                            </Collapse>
                                        </AccordionDetails>
                                    </Accordion>
                                </Fade>
                            </div>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={(e) => this.props.onClose?.(e)} autoFocus variant="text" color="primary">
                        {t("words.close")}
                    </Button>
                    <Button style={{ backgroundColor: "#fff", color: "#000" }}
                            onClick={(e) => this.props.onAccept?.(this.convertToBase64())} autoFocus variant="contained" color="secondary">
                        {t("components.gradient_editor_dialog.accept")}
                    </Button>
                </DialogActions>
                {/* ===== Color Picker Menus ===== */}
                <Menu
                    className={classes.menu}
                    anchorEl={s.colorMenuAnchor}
                    open={Boolean(s.colorMenuAnchor)}
                    onClose={this.closeColorMenu}
                    getContentAnchorEl={null}
                    anchorOrigin={{ vertical: "center", horizontal: "center" }}
                    transformOrigin={{ vertical: "center", horizontal: "center" }}
                    style={{ padding: 0 }}
                >
                    <ColorPicker
                        className={classes.materialPicker}
                        color={s.colorMenuWhich === "secondary" ? secondaryRgba : s.colorMenuWhich === "tertiary" ? tertiaryRgba : primaryRgba}
                        onChange={this.onPickerChange}
                        onConfirm={this.closeColorMenu}
                        onClose={this.closeColorMenu}
                    />
                </Menu>
            </Dialog>
        );
    }
}

export default withLanguage(withStyles(styles)(GradientEditorDialog));