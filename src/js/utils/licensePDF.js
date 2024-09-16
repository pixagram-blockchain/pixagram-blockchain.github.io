/**
 * PIXA LICENSE 1.0 — Dynamic NFT License PDF Generator (v10)
 *
 * Single A4/Letter landscape, two-column layout.
 * LEFT:  Title, About box, Legal Agreement text, Sections 1-5
 * RIGHT: Holder rights table, Visitor rights table, Logo
 *
 * All colors are pure black (or white where needed) with opacity 0–1.
 * Justified paragraphs. SVG icons.
 *
 * Background watermark: CMYK halftone dither (classic preset) of
 * opts.artworkImage.  Input pixel art is upscaled by a crisp NN factor
 * (4, 9, 16, 25, 36, 49, or 64).  scale = √factor, sharpness = scale/2.
 */

import { PDFDocument, rgb, PageSizes } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit'
import Engine from "./guilloche";


const ST = {
    "page": {
        "width": 842,
        "height": 595,
        "bgColor": "#ffffff",
        "showBg": true,
        "sizePreset": "a4l"
    },
    "style": {
        "colorMode": "rainbow",
        "color1": "#ff0070",
        "color2": "#00ffc8",
        "strokeWidth": 0.1,
        "opacity": 100
    },
    "borderBands": [
        {
            "enabled": true,
            "margin": 30,
            "bandWidth": 20,
            "cornerRadius": 20,
            "lines": 27,
            "lobesPerSide": 14,
            "lobeDepth": 47,
            "waveFreq": 8,
            "waveAmp": 0,
            "waveType": "sine",
            "phaseSpread": 90,
            "edgeLines": 0,
            "thicknessVar": 43,
            "colorMode": "",
            "color1": "",
            "color2": ""
        },
        {
            "enabled": true,
            "margin": 29,
            "bandWidth": 30,
            "cornerRadius": 20,
            "lines": 25,
            "lobesPerSide": 5,
            "lobeDepth": 46,
            "waveFreq": 11,
            "waveAmp": 4,
            "waveType": "sine",
            "phaseSpread": 104,
            "edgeLines": 0,
            "thicknessVar": 63,
            "colorMode": "rainbow",
            "color1": "",
            "color2": ""
        },
        {
            "enabled": true,
            "margin": 117,
            "bandWidth": 177,
            "cornerRadius": 4,
            "lines": 28,
            "lobesPerSide": 3,
            "lobeDepth": 60,
            "waveFreq": 4,
            "waveAmp": 15,
            "waveType": "sine",
            "phaseSpread": 196,
            "edgeLines": 0,
            "thicknessVar": 38,
            "colorMode": "mono",
            "color1": "#474747",
            "color2": ""
        }
    ],
    "fineLines": {
        "outer": true,
        "outerOffset": 22,
        "inner": true,
        "innerOffset": 64
    },
    "corners": {
        "enabled": true,
        "type": "burst",
        "size": 100,
        "copies": 17,
        "R": 25,
        "r": 21,
        "dMin": 40,
        "dSpread": 50,
        "phaseSpread": 3.1,
        "petals": 21,
        "colorMode": "mono",
        "color1": "#a3a3a3",
        "color2": ""
    },
    "tbOrnament": {
        "mode": "both",
        "type": "envelope",
        "width": 500,
        "height": 200,
        "lines": 75,
        "lobes": 4,
        "lobeDepth": 0.15,
        "yOffset": 296,
        "waveFreq": 40,
        "waveAmp": 0,
        "waveType": "sine",
        "phaseSpread": 6.7,
        "fanSpread": 180,
        "R": 154,
        "r": 92,
        "dMin": 5,
        "dSpread": 55,
        "opacityMult": 1,
        "colorMode": "neon",
        "color1": "#ffffff",
        "color2": "#00ffc8"
    },
    "sideOrnament": {
        "enabled": true,
        "width": 125,
        "height": 40,
        "lines": 28,
        "lobes": 2,
        "lobeDepth": 0.3,
        "waveFreq": 8,
        "waveAmp": 4,
        "xOffset": 100,
        "phaseSpread": 8,
        "opacityMult": 0.8,
        "colorMode": "rainbow",
        "color1": "#ffffff",
        "color2": "#000000"
    },
    "medallion": {
        "enabled": true,
        "type": "rosette",
        "spiroType": "rose",
        "size": 178,
        "copies": 59,
        "R": 97,
        "r": 12,
        "dMin": 13,
        "dSpread": 53,
        "phaseSpread": 2.6,
        "opacity": 55,
        "petals": 8,
        "colorMode": "rainbow",
        "color1": "#ffffff",
        "color2": ""
    },
    "background": {
        "enabled": false,
        "pattern": "radial",
        "waveType": "sine",
        "spacing": 2,
        "frequency": 10,
        "amplitude": 10,
        "opacity": 60,
        "colorMode": "",
        "color1": "#808080",
        "color2": "#292929"
    },
    "moire": {
        "enabled": false,
        "spacing": 10,
        "angleSeparation": 1,
        "opacity": 30
    }
};

/*
// halftone-dither.js — Pure ES6 computational module (zero DOM)

const PRESETS = {
    classic:   { label: "Classic",   scale: 6,   sharpness: 2.5, angles: { c: 15, m: 75, y: 0, k: 45 }, gain: { c: 30, m: 50, y: 20, k: 30 },  mode: "dots",  paperWhite: true,  blend: false },
    newspaper: { label: "Newspaper", scale: 4,   sharpness: 3,   angles: { c: 15, m: 75, y: 0, k: 45 }, gain: { c: 0,  m: 0,  y: 0,  k: 100 }, mode: "dots",  paperWhite: true,  blend: false },
    popArt:    { label: "Pop Art",   scale: 8,   sharpness: 3.5, angles: { c: 15, m: 75, y: 0, k: 45 }, gain: { c: 40, m: 70, y: 30, k: 20 },  mode: "dots",  paperWhite: true,  blend: false },
    vintage:   { label: "Vintage",   scale: 5,   sharpness: 2,   angles: { c: 20, m: 70, y: 10, k: 50 }, gain: { c: 25, m: 40, y: 35, k: 25 }, mode: "dots",  paperWhite: true,  blend: false },
    banknote:  { label: "Banknote",  scale: 3,   sharpness: 4,   angles: { c: 0,  m: 45, y: 90, k: 67 }, gain: { c: 20, m: 40, y: 15, k: 60 }, mode: "lines", paperWhite: true,  blend: false },
    engraving: { label: "Engraving", scale: 2.5, sharpness: 5,   angles: { c: 45, m: 45, y: 45, k: 45 }, gain: { c: 0,  m: 0,  y: 0,  k: 100 }, mode: "lines", paperWhite: true, blend: false },
};
const CHANNEL_COLORS = {
    c: { dot: "#00aacc", label: "Cyan" },
    m: { dot: "#cc0066", label: "Magenta" },
    y: { dot: "#ccaa00", label: "Yellow" },
    k: { dot: "#222222", label: "Key" },
};

const CHANNELS = ["c", "m", "y", "k"];

// ── Color conversion ──

function rgbToCmyk(r, g, b) {
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const k = 1 - Math.max(rn, gn, bn);
    if (k === 1) return { c: 0, m: 0, y: 0, k: 1 };
    return {
        c: (1 - rn - k) / (1 - k),
        m: (1 - gn - k) / (1 - k),
        y: (1 - bn - k) / (1 - k),
        k,
    };
}

// ── Core halftone generation ──
// Returns an array of primitive descriptors:
//   { type: "circle", cx, cy, r, fill, channel }
//   { type: "path",   d, fill, channel }

function generateHalftone(imageData, width, height, params) {
    const { scale, sharpness, angles, gain } = params;
    const cellSize = scale;
    const allElements = [];

    for (const ch of CHANNELS) {
        if (gain[ch] === 0) continue;
        const angleRad = (angles[ch] * Math.PI) / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
        const gainFactor = gain[ch] / 100;
        const color = CHANNEL_COLORS[ch].dot;
        const diagonal = Math.sqrt(width * width + height * height);
        const steps = Math.ceil(diagonal / cellSize) + 4;
        const cx = width / 2, cy = height / 2;

        for (let i = -steps; i <= steps; i++) {
            for (let j = -steps; j <= steps; j++) {
                const gx = cx + (i * cosA - j * sinA) * cellSize;
                const gy = cy + (i * sinA + j * cosA) * cellSize;
                const px = Math.round(gx);
                const py = Math.round(gy);
                if (px < 0 || px >= width || py < 0 || py >= height) continue;

                const idx = (py * width + px) * 4;
                const r = imageData[idx], g = imageData[idx + 1], b = imageData[idx + 2], a = imageData[idx + 3];
                if (a < 128) continue;

                const cmyk = rgbToCmyk(r, g, b);
                const intensity = cmyk[ch] * gainFactor;
                const t = Math.pow(Math.min(1, Math.max(0, intensity)), 1 / sharpness);
                const radius = t * cellSize * 0.5;

                if (radius > 0.15) {
                    allElements.push({ type: "circle", cx: gx, cy: gy, r: radius, fill: color, channel: ch });
                }
            }
        }
    }

    return allElements;
}

// ── SVG serialization ──
// Converts element descriptors into an SVG string.
function toSvgString(elements, width, height, options = {}) {
    const { paperWhite = true, blend = false } = options;
    const bg = paperWhite ? "#f5f2eb" : "transparent";
    const mixBlend = blend ? "multiply" : "normal";

    let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;

    if (paperWhite) {
        svg += `<rect x="0" y="0" width="${width}" height="${height}" fill="${bg}"/>`;
    }

    for (const ch of CHANNELS) {
        const chElems = elements.filter(e => e.channel === ch);
        if (chElems.length === 0) continue;

        svg += `<g style="mix-blend-mode:${mixBlend}">`;
        for (const e of chElems) {
            if (e.type === "circle") {
                svg += `<circle cx="${e.cx.toFixed(2)}" cy="${e.cy.toFixed(2)}" r="${e.r.toFixed(2)}" fill="${e.fill}"/>`;
            } else {
                svg += `<path d="${e.d}" fill="${e.fill}"/>`;
            }
        }
        svg += `</g>`;
    }

    svg += `</svg>`;
    return svg;
}

// ── Convenience: full pipeline from RGBA buffer → SVG string ──
function halftone(imageData, params = {}) {
    const resolved = {
        scale:     params.scale     ?? 6,
        sharpness: params.sharpness ?? 2.5,
        angles:    { c: 15, m: 75, y: 0, k: 45, ...params.angles },
        gain:      { c: 50, m: 50, y: 50, k: 50, ...params.gain }
    };

    const elements = generateHalftone(imageData.data, imageData.width, imageData.height, resolved);

    return {
        svg: toSvgString(elements, imageData.width, imageData.height, {
            paperWhite: params.paperWhite ?? false,
            blend:      params.blend      ?? false,
        }),
        width: imageData.width,
        height: imageData.height,
    };
}
*/

// ═══════════════════════════════════════════════════════
// GREY + REDUCED OPACITY PALETTE
// ═══════════════════════════════════════════════════════
const GR = rgb(0.5, 0.5, 0.5); // Changed from Black to Grey
const BK = rgb(0, 0, 0); // Changed from Black to Grey
const WH = rgb(1, 1, 1);

const C = {
    black:     { c: BK, o: 1.0    },
    dark:      { c: BK, o: 0.90   },
    body:      { c: BK, o: 0.85  },
    label:     { c: BK, o: 0.78   },
    mid:       { c: BK, o: 0.65  },
    note:      { c: BK, o: 0.50   },
    light:     { c: BK, o: 0.38   },
    border:    { c: BK, o: 0.22   },
    tableHead: { c: GR, o: 0.15  },
    tableBg:   { c: GR, o: 0.1 },
    aboutBg:   { c: GR, o: 0.125 },
    white:     { c: WH, o: 1.0    },
    iconCan:   { c: BK, o: 0.80   },
    iconCant:  { c: BK, o: 0.45  },
};

// SVG icon paths (viewBox 0 0 24 24)
const ICON_CAN = 'M19 3L5 3C3.9 3 3 3.9 3 5L3 19C3 20.1 3.9 21 5 21L19 21C20.1 21 21 20.1 21 19L21 5C21 3.9 20.1 3 19 3ZM10.71 16.29C10.32 16.68 9.69 16.68 9.3 16.29L5.71 12.7C5.32 12.31 5.32 11.68 5.71 11.29C6.1 10.9 6.73 10.9 7.12 11.29L10 14.17L16.88 7.29C17.27 6.9 17.9 6.9 18.29 7.29C18.68 7.68 18.68 8.31 18.29 8.7L10.71 16.29Z';
const ICON_CANT = 'M12 2C17.5 2 22 6.5 22 12C22 17.5 17.5 22 12 22C6.5 22 2 17.5 2 12C2 6.5 6.5 2 12 2ZM12 4C10.1 4 8.4 4.6 7.1 5.7L18.3 16.9C19.3 15.5 20 13.8 20 12C20 7.6 16.4 4 12 4ZM16.9 18.3L5.7 7.1C4.6 8.4 4 10.1 4 12C4 16.4 7.6 20 12 20C13.9 20 15.6 19.4 16.9 18.3Z';

const LOGO_BG = 'M 490 300 L 2010 300 C 2114.864 300 2200 385.136 2200 490 L 2200 2010 C 2200 2114.864 2114.864 2200 2010 2200 L 490 2200 C 385.136 2200 300 2114.864 300 2010 L 300 490 C 300 385.136 385.136 300 490 300 Z';
const LOGO_BADGE = 'M 1831 482 L 1686.82 482 C 1659.324 482 1637 504.324 1637 531.82 L 1637 620.18 C 1637 647.676 1659.324 670 1686.82 670 L 1750 670 Q 1790.5 672.5 1809 688 C 1827.5 703.5 1830.438 735.625 1831 750 L 1831 814.18 C 1831 841.676 1853.324 864 1880.82 864 L 1969.18 864 C 1996.676 864 2019 841.676 2019 814.18 L 2019 670 L 2019 620.18 L 2019 553 C 2018 510.667 1987.333 483.333 1940 482 L 1880.82 482 L 1831 482 Z';
const LOGO_P = 'M 1150 1750 L 1150 2200 L 750 2200 L 750 1670 L 750 1670 L 750 1250 L 750 830 C 750 785.847 785.847 750 830 750 L 1670 750 C 1714.153 750 1750 785.847 1750 830 L 1750 1670 C 1750 1714.153 1714.153 1750 1670 1750 L 1150 1750 L 1150 1750 Z';
const LOGO_HOLE = 'M 1110 1050 L 1390 1050 C 1423.115 1050 1450 1076.885 1450 1110 L 1450 1390 C 1450 1423.115 1423.115 1450 1390 1450 L 1110 1450 C 1076.885 1450 1050 1423.115 1050 1390 L 1050 1110 C 1050 1076.885 1076.885 1050 1110 1050 Z';

const SIZES = {
    a4:     { w: PageSizes.A4[1],     h: PageSizes.A4[0], sizePreset: "a4l" },
    letter: { w: PageSizes.Letter[1], h: PageSizes.Letter[0] , sizePreset: "ll"},
};

const PHI = 1.618;

// ═══════════════════════════════════════════════════════
// ROUNDED RECT
// ═══════════════════════════════════════════════════════
const KP = 0.5522847498;

function rrPath(w, h, r) {
    const k = KP * r;
    return `M ${r} 0 L ${w-r} 0 C ${w-r+k} 0 ${w} ${r-k} ${w} ${r} L ${w} ${h-r} C ${w} ${h-r+k} ${w-r+k} ${h} ${w-r} ${h} L ${r} ${h} C ${r-k} ${h} 0 ${h-r+k} 0 ${h-r} L 0 ${r} C 0 ${r-k} ${r-k} 0 ${r} 0 Z`;
}

function rrTopPath(w, h, r) {
    const k = KP * r;
    return `M ${r} 0 L ${w-r} 0 C ${w-r+k} 0 ${w} ${r-k} ${w} ${r} L ${w} ${h} L 0 ${h} L 0 ${r} C 0 ${r-k} ${r-k} 0 ${r} 0 Z`;
}

function drawRR(pg, x, y, w, h, r, col) {
    pg.drawSvgPath(rrPath(w, h, r), { x, y, color: col.c, opacity: col.o });
}

function drawRRTop(pg, x, y, w, h, r, col) {
    pg.drawSvgPath(rrTopPath(w, h, r), { x, y, color: col.c, opacity: col.o });
}

// ═══════════════════════════════════════════════════════
// TEXT UTILITIES
// ═══════════════════════════════════════════════════════

function parseSegments(text) {
    const segs = [];
    const re = /\*\*([^*]+)\*\*/g;
    let last = 0, m;
    while ((m = re.exec(text)) !== null) {
        if (m.index > last) segs.push({ text: text.slice(last, m.index), bold: false });
        segs.push({ text: m[1], bold: true });
        last = m.index + m[0].length;
    }
    if (last < text.length) segs.push({ text: text.slice(last), bold: false });
    return segs;
}

function wrapTokens(text, fonts, fs, maxW) {
    const words = [];
    for (const s of parseSegments(text))
        for (const w of s.text.split(/\s+/).filter(Boolean))
            words.push({ word: w, bold: s.bold });
    const lines = [];
    let toks = [], curW = 0;
    const sp = fonts.regular.widthOfTextAtSize(' ', fs);
    for (const t of words) {
        const f = t.bold ? fonts.bold : fonts.regular;
        const ww = f.widthOfTextAtSize(t.word, fs);
        const gap = toks.length ? sp : 0;
        if (curW + gap + ww > maxW && toks.length) {
            lines.push(toks); toks = [t]; curW = ww;
        } else { toks.push(t); curW += gap + ww; }
    }
    if (toks.length) lines.push(toks);
    return lines;
}

function wrapPlain(text, font, fs, maxW) {
    const words = text.replace(/\*\*/g, '').split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    for (const w of words) {
        const t = cur ? `${cur} ${w}` : w;
        if (font.widthOfTextAtSize(t, fs) > maxW && cur) { lines.push(cur); cur = w; }
        else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
}

function drawTokenLine(pg, tokens, x, y, fonts, fs, col) {
    let cx = x;
    const sp = fonts.regular.widthOfTextAtSize(' ', fs);
    for (let i = 0; i < tokens.length; i++) {
        if (i) cx += sp;
        const f = tokens[i].bold ? fonts.bold : fonts.regular;
        pg.drawText(tokens[i].word, { x: cx, y, size: fs, font: f, color: col.c, opacity: col.o });
        cx += f.widthOfTextAtSize(tokens[i].word, fs);
    }
}

function drawTokenLineJustified(pg, tokens, x, y, fonts, fs, col, maxW, isLastLine) {
    if (isLastLine || tokens.length <= 1) {
        drawTokenLine(pg, tokens, x, y, fonts, fs, col);
        return;
    }
    let wordsW = 0;
    for (const t of tokens) {
        const f = t.bold ? fonts.bold : fonts.regular;
        wordsW += f.widthOfTextAtSize(t.word, fs);
    }
    const gapPerSpace = (maxW - wordsW) / (tokens.length - 1);
    let cx = x;
    for (let i = 0; i < tokens.length; i++) {
        if (i) cx += gapPerSpace;
        const f = tokens[i].bold ? fonts.bold : fonts.regular;
        pg.drawText(tokens[i].word, { x: cx, y, size: fs, font: f, color: col.c, opacity: col.o });
        cx += f.widthOfTextAtSize(tokens[i].word, fs);
    }
}

function groupRights(rights) {
    const order = ['basic','commercial','creative','digital','media','display','educational','advanced'];
    const g = {};
    for (const r of rights) {
        if (!g[r.category]) g[r.category] = { label: r.categoryLabel || r.category.charAt(0).toUpperCase() + r.category.slice(1), rights: [] };
        g[r.category].rights.push(r);
    }
    return order.filter(c => g[c]).map(c => g[c]);
}


// ═══════════════════════════════════════════════════════
// COLUMN WRITER
// ═══════════════════════════════════════════════════════

const BODY_FS = 6.2;
const BODY_LH = BODY_FS * 1.4;
const TITLE_TO_PARA = 8;
const H2_ABOVE = TITLE_TO_PARA * PHI;

class Col {
    constructor(pg, fonts, x, w, topY, botY) {
        this.pg = pg; this.f = fonts;
        this.x = x; this.w = w;
        this.y = topY; this.bot = botY;
    }

    drawTitle(text, sz) {
        this.pg.drawText(text, { x: this.x, y: this.y, size: sz, font: this.f.bold, color: C.black.c, opacity: C.black.o });
        this.y -= sz + 1;
    }

    drawSub(text) {
        this.pg.drawText(text, { x: this.x, y: this.y, size: 6, font: this.f.regular, color: C.mid.c, opacity: C.mid.o });
        this.y -= 14;
    }

    drawH1(text) {
        this.pg.drawText(text.toUpperCase(), { x: this.x, y: this.y, size: 9, font: this.f.bold, color: C.black.c, opacity: C.black.o });
        this.y -= 4;
        this.pg.drawLine({
            start: { x: this.x, y: this.y },
            end: { x: this.x + this.w, y: this.y },
            thickness: 0.8, color: C.dark.c, opacity: C.dark.o,
        });
        this.y -= TITLE_TO_PARA + 2;
    }

    drawH2(text) {
        this.y -= H2_ABOVE;
        this.pg.drawText(text, { x: this.x, y: this.y, size: 8, font: this.f.bold, color: C.dark.c, opacity: C.dark.o });
        this.y -= TITLE_TO_PARA;
    }

    drawBody(text, fs = BODY_FS) {
        const lh = fs * 1.4;
        const lines = wrapTokens(text, this.f, fs, this.w);
        for (let i = 0; i < lines.length; i++) {
            drawTokenLineJustified(this.pg, lines[i], this.x, this.y, this.f, fs, C.body, this.w, i === lines.length - 1);
            this.y -= lh;
        }
        this.y -= 1.5;
    }

    skip(h) { this.y -= h; }

    drawAboutBox(exp) {
        const RD = 9, padTop = 14, padBot = 5, padLR = 9;
        const innerW = this.w - padLR * 2;
        const fs = 6, lh = fs + 2, fss = 5.5, lhs = fss + 1.8, sectionGap = 5;
        let contentH = 13;
        contentH += wrapPlain(`Purpose: ${exp.purpose}`, this.f.regular, fs, innerW).length * lh;
        contentH += sectionGap;
        contentH += wrapPlain(`How It Works: ${exp.mechanism}`, this.f.regular, fs, innerW).length * lh;
        contentH += sectionGap;
        if (exp.keyTerms) {
            contentH += lh;
            for (const [t, d] of Object.entries(exp.keyTerms))
                contentH += wrapPlain(`${t}: ${d}`, this.f.regular, fss, innerW - 8).length * lhs + 0.5;
        }
        const boxH = padTop + contentH + padBot;
        const boxTop = this.y + padTop;
        drawRR(this.pg, this.x, boxTop, this.w, boxH, RD, C.aboutBg);
        const tx = this.x + padLR;
        this.pg.drawText('ABOUT THIS LICENSE', { x: tx, y: this.y, size: 9, font: this.f.bold, color: C.black.c, opacity: C.black.o });
        this.y -= 13;
        this._lp('Purpose:', exp.purpose, tx, innerW, fs, lh);
        this.y -= sectionGap;
        this._lp('How It Works:', exp.mechanism, tx, innerW, fs, lh);
        this.y -= sectionGap;
        if (exp.keyTerms) {
            this.pg.drawText('Key Terms:', { x: tx, y: this.y, size: fs, font: this.f.bold, color: C.black.c, opacity: C.black.o });
            this.y -= lh;
            for (const [term, def] of Object.entries(exp.keyTerms)) {
                const lines = wrapPlain(`${term}: ${def}`, this.f.regular, fss, innerW - 8);
                for (let i = 0; i < lines.length; i++) {
                    if (i === 0) {
                        const tl = `${term}: `;
                        this.pg.drawText(tl, { x: tx + 6, y: this.y, size: fss, font: this.f.bold, color: C.label.c, opacity: C.label.o });
                        const tw = this.f.bold.widthOfTextAtSize(tl, fss);
                        const rest = lines[0].slice(tl.length);
                        if (rest) this.pg.drawText(rest, { x: tx + 6 + tw, y: this.y, size: fss, font: this.f.regular, color: C.mid.c, opacity: C.mid.o });
                    } else {
                        this.pg.drawText(lines[i], { x: tx + 6, y: this.y, size: fss, font: this.f.regular, color: C.mid.c, opacity: C.mid.o });
                    }
                    this.y -= lhs;
                }
            }
        }
        this.y = boxTop - boxH - H2_ABOVE;
    }

    _lp(label, text, x, maxW, fs, lh) {
        const lines = wrapPlain(`${label} ${text}`, this.f.regular, fs, maxW);
        for (let i = 0; i < lines.length; i++) {
            if (i === 0) {
                this.pg.drawText(label, { x, y: this.y, size: fs, font: this.f.bold, color: C.black.c, opacity: C.black.o });
                const lw = this.f.bold.widthOfTextAtSize(label + ' ', fs);
                const rest = lines[0].slice(label.length).trimStart();
                if (rest) this.pg.drawText(rest, { x: x + lw, y: this.y, size: fs, font: this.f.regular, color: C.body.c, opacity: C.body.o });
            } else {
                this.pg.drawText(lines[i], { x, y: this.y, size: fs, font: this.f.regular, color: C.body.c, opacity: C.body.o });
            }
            this.y -= lh;
        }
    }

    drawRightsTable(category, customization) {
        const configKey = category.id === 'holder-rights' ? 'holderRights' : 'visitorRights';
        const rc = customization?.rightsConfiguration?.[configKey] || {};
        const grouped = groupRights(category.rights);
        this.pg.drawText(category.title, { x: this.x, y: this.y, size: 7, font: this.f.bold, color: C.label.c, opacity: C.label.o });
        this.y -= 10;
        const RD = 9, pad = 7, permColW = 52;
        const rightColW = this.w - permColW;
        const headerH = 14, catH = 12, rowFs = 6.2, rowLh = 7.8;
        const icoScale = 0.35, icoSz = 24 * icoScale, minRowH = 15;
        let bodyH = 0;
        for (const group of grouped) {
            bodyH += catH;
            for (const r of group.rights) {
                if (r.dependsOn && rc[r.dependsOn] !== true) continue;
                const dep = Boolean(r.dependsOn);
                const ll = wrapPlain(r.label, this.f.regular, rowFs, rightColW - (dep ? 16 : 4) - pad);
                bodyH += Math.max(minRowH, ll.length * rowLh + (r.note ? 6 : 0) + 4);
            }
        }
        bodyH += 10;
        const totalH = headerH + bodyH, tableTop = this.y + 5;
        drawRR(this.pg, this.x, tableTop, this.w, totalH, RD, C.tableBg);
        drawRRTop(this.pg, this.x, tableTop, this.w, headerH, RD, C.tableHead);
        const hTY = tableTop - headerH / 2 - 2;
        this.pg.drawText('Right', { x: this.x + pad, y: hTY, size: 6, font: this.f.bold, color: C.label.c, opacity: C.label.o });
        this.pg.drawText('Permission', { x: this.x + rightColW, y: hTY, size: 6, font: this.f.bold, color: C.label.c, opacity: C.label.o });
        let cy = tableTop - headerH;
        for (const group of grouped) {
            cy -= 1.5;
            this.pg.drawText(group.label, { x: this.x + pad, y: cy - 7.5, size: 6.5, font: this.f.bold, color: C.black.c, opacity: C.black.o });
            cy -= catH;
            for (const right of group.rights) {
                const granted = rc[right.id] !== undefined ? rc[right.id] : right.defaultValue;
                const dep = Boolean(right.dependsOn);
                if (right.dependsOn && rc[right.dependsOn] !== true) continue;
                const labelX = this.x + pad + (dep ? 12 : 0);
                const maxLW = rightColW - (dep ? 16 : 4) - pad;
                const ll = wrapPlain(right.label, this.f.regular, rowFs, maxLW);
                const contentH = ll.length * rowLh + (right.note ? 6 : 0);
                const rowH = Math.max(minRowH, contentH + 4);
                const rowMidY = cy - rowH / 2;
                this.pg.drawLine({ start: { x: this.x + pad - 1, y: cy }, end: { x: this.x + this.w - pad + 1, y: cy }, thickness: 0.6, color: C.white.c, opacity: C.white.o });
                if (dep) this.pg.drawText('->', { x: this.x + pad + 1, y: rowMidY + 1, size: 5, font: this.f.regular, color: C.light.c, opacity: C.light.o });
                const lblBlockH = ll.length * rowLh + (right.note ? 6 : 0);
                let ly = rowMidY + lblBlockH / 2 - rowFs * 0.7;
                const lblCol = dep ? C.mid : C.body;
                for (const l of ll) { this.pg.drawText(l, { x: labelX, y: ly, size: rowFs, font: this.f.regular, color: lblCol.c, opacity: lblCol.o }); ly -= rowLh; }
                if (right.note) this.pg.drawText(right.note, { x: labelX, y: ly + 1.5, size: 4.8, font: this.f.oblique, color: C.note.c, opacity: C.note.o });
                const permX = this.x + rightColW, iconY = rowMidY + icoSz / 2 + 1;
                const icoCol = granted ? C.iconCan : C.iconCant;
                this.pg.drawSvgPath(granted ? ICON_CAN : ICON_CANT, { x: permX, y: iconY, scale: icoScale, color: icoCol.c, opacity: icoCol.o });
                this.pg.drawText(granted ? 'CAN' : "CAN'T", { x: permX + icoSz + 3, y: rowMidY - rowFs * 0.35, size: rowFs, font: this.f.bold, color: C.black.c, opacity: C.black.o });
                cy -= rowH;
            }
        }
        this.y = tableTop - totalH - 10;
    }

    drawLogo() {
        const logoScale = 0.012, contentSz = 1900 * logoScale, svgMargin = 300 * logoScale;
        const lx = this.x, ly = this.y, svgX = lx - svgMargin, svgY = ly + svgMargin;
        this.pg.drawSvgPath(LOGO_BG, { x: svgX, y: svgY, scale: logoScale, color: C.black.c, opacity: C.black.o });
        this.pg.drawSvgPath(LOGO_BADGE, { x: svgX, y: svgY, scale: logoScale, color: C.white.c, opacity: C.white.o });
        this.pg.drawSvgPath(LOGO_P, { x: svgX, y: svgY, scale: logoScale, color: C.white.c, opacity: C.white.o });
        this.pg.drawSvgPath(LOGO_HOLE, { x: svgX, y: svgY, scale: logoScale, color: C.black.c, opacity: C.black.o });
        const textX = lx + contentSz + 7, logoMidY = ly - contentSz / 2;
        this.pg.drawText('PIXAGRAM', { x: textX, y: logoMidY + 1, size: 9, font: this.f.bold, color: C.black.c, opacity: C.black.o });
        const nameW = this.f.bold.widthOfTextAtSize('PIXAGRAM', 9);
        this.pg.drawText('(R)', { x: textX + nameW + 1, y: logoMidY + 5, size: 4, font: this.f.regular, color: C.mid.c, opacity: C.mid.o });
        this.pg.drawText('Social NFTs Marketplace', { x: textX, y: logoMidY - 10, size: 6, font: this.f.regular, color: C.mid.c, opacity: C.mid.o });
        this.y = ly - contentSz;
    }
}


// ═══════════════════════════════════════════════════════
// CUSTOMIZATION
// ═══════════════════════════════════════════════════════

function applyCust(content, cust) {
    if (!cust) return content;
    let r = content;
    if (cust.royaltyPercentage !== undefined) r = r.replace('{royaltyPercentage}', String(cust.royaltyPercentage));
    if (cust.governingLaw) {
        const g = cust.governingLaw;
        r = r.replace('{jurisdiction}', g.jurisdiction || '[Not Specified]')
            .replace('{court}', g.court || '[Not Specified]')
            .replace('{arbitrationLocation}', g.arbitrationLocation || '[Not Specified]')
            .replace('{arbitrationRules}', g.arbitrationRules || '[Not Specified]');
    }
    return r;
}

function hexToBO(hex) {
    if (!hex || hex === 'none') return null;
    const h = hex.replace('#', '');
    let r, g, b;
    if (h.length === 3) { r = parseInt(h[0]+h[0],16)/255; g = parseInt(h[1]+h[1],16)/255; b = parseInt(h[2]+h[2],16)/255; }
    else if (h.length === 6) { r = parseInt(h.substr(0,2),16)/255; g = parseInt(h.substr(2,2),16)/255; b = parseInt(h.substr(4,2),16)/255; }
    else return { color: BK, opacity: 1 };
    const lum = 0.2126*r + 0.7152*g + 0.0722*b;
    if (lum > 0.95) return { color: WH, opacity: 1 };
    return { color: BK, opacity: Math.max(0, Math.min(1, 1 - lum)) };
}


// ═══════════════════════════════════════════════════════
// ARTWORK DATA-URL → RGBA PIXELS
// ═══════════════════════════════════════════════════════

/**
 * Decode a data:image/* URL to raw RGBA pixels via an off-screen canvas.
 * Works in browser environments.  Returns null if decoding fails.
 * @param {string} dataURL
 * @returns {Promise<{data:Uint8ClampedArray, w:number, h:number}|null>}
 */
async function _dataURLToRGBA(dataURL, scale) {
    if (!dataURL || typeof dataURL !== 'string') return null;
    if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(dataURL)) return null;
    try {
        const img = await new Promise((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = reject;
            i.src = dataURL;
        });
        const cvs = document.createElement('canvas');
        cvs.width = img.width * scale;
        cvs.height = img.height * scale;
        const ctx = cvs.getContext('2d');
        ctx.imageSmoothingEnabled = false;          // crisp pixel art
        ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, img.width * scale, img.height * scale);
        return ctx.getImageData(0, 0, cvs.width, cvs.height);
    } catch (e) {
        console.warn('[LicensePDF] Artwork decode failed:', e.message);
        return null;
    }
}


// ═══════════════════════════════════════════════════════
// 32×32 PIXAGRAM LOGO GRAYMAP
// ═══════════════════════════════════════════════════════

function createPixagramLogoMap() {
    const S = 32, map = new Float32Array(S * S);
    map.fill(1.0);
    const fill = (x0, y0, x1, y1, v) => {
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++)
            if (x >= 0 && x < S && y >= 0 && y < S) map[y * S + x] = v;
    };
    const D = 0.05, W = 0.95, m = 4;
    fill(m, m, S-m, S-m, D);
    fill(7, 7, 12, 28, W); fill(7, 7, 23, 12, W);
    fill(18, 7, 23, 18, W); fill(7, 13, 23, 18, W);
    fill(11, 11, 15, 15, D);
    fill(21, 5, 27, 11, W);
    return { grayMap: map, width: S, height: S };
}

function toBase64(str) {
    if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(str)));
    if (typeof Buffer !== 'undefined') return Buffer.from(str, 'utf-8').toString('base64');
    return '';
}

function drawSvgOverlay(page, embeddedImg, imgW, imgH, pageW, pageH, globalOpacity) {
    const margin = 0;
    const availW = pageW - margin * 2;
    const availH = pageH - margin * 2;
    const scale = Math.min(availW / imgW, availH / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const x = margin + (availW - drawW) / 2;
    const y = margin + (availH - drawH) / 2;
    page.drawImage(embeddedImg, { x, y, width: drawW, height: drawH, opacity: globalOpacity });
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════

export async function generateLicensePdf(licenseBase, customization = {}, opts = {}) {
    const doc = await PDFDocument.create();
    doc.setTitle(licenseBase.name || 'PIXA LICENSE 1.0');
    doc.setAuthor(customization?.authorInfo?.name || 'Pixagram');
    doc.setSubject('NFT License Agreement');
    doc.setCreator('Pixagram License Generator');

    doc.registerFontkit(fontkit);
    const prefix = "";
    const IndustryBookPDF = await doc.embedFont(await fetch("/src/fonts/industry/IndustryBook.ttf").then(res => res.arrayBuffer()));
    const IndustryBookItalicPDF = await doc.embedFont(await fetch("/src/fonts/industry/IndustryBookItalic.ttf").then(res => res.arrayBuffer()));
    const IndustryBoldPDF = await doc.embedFont(await fetch("/src/fonts/industry/IndustryBold.ttf").then(res => res.arrayBuffer()));

    const fonts = {
        regular: IndustryBookPDF,
        bold:    IndustryBoldPDF,
        oblique: IndustryBookItalicPDF,
    };

    const sz = SIZES[opts.pageSize || 'a4'];
    const page = doc.addPage([sz.w, sz.h]);
    const MRG = 40, GUT = 22;
    const colW = (sz.w - MRG * 2 - GUT) / 2;
    const topY = sz.h - MRG, botY = MRG + 6;

    /*
    if (opts.artworkImage) {
        const upscale = 8;
        const imgd = await _dataURLToRGBA(opts.artworkImage, upscale);
        const scale = upscale / 2;
        const sharpness = scale / 2;
        const ht = halftone(imgd, {scale, sharpness});
        const svgDataUrl = `data:image/svg+xml;base64,${toBase64(ht.svg)}`;
        const svgImg = await new Promise((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = reject;
            i.src = svgDataUrl;
        });
        const cvs = document.createElement('canvas');
        cvs.width = ht.width; cvs.height = ht.height;
        const ctx = cvs.getContext('2d');
        ctx.drawImage(svgImg, 0, 0, ht.width, ht.height);
        const pngDataUrl = cvs.toDataURL('image/png');
        const pngBase64 = pngDataUrl.split(',')[1];
        const pngBytes = Uint8Array.from(atob(pngBase64), c => c.charCodeAt(0));
        const embeddedImg = await doc.embedPng(pngBytes);
        drawSvgOverlay(page, embeddedImg, ht.width, ht.height, sz.w, sz.h, 1.0);
    }
     */

    // Overlay
    const st = JSON.parse(JSON.stringify(ST));
    st.page.sizePreset = sz.sizePreset;

    st.borderBands.forEach(b=>{if(typeof b.lobeDepth==='number'&&b.lobeDepth>1)b.lobeDepth=b.lobeDepth/100});
    const res = Engine.render(st)
    const w=st.page.width,h=st.page.height;
    const c=document.createElement('canvas');c.width=w*2;c.height=h*2;
    const ctx=c.getContext('2d');const img=new Image();

    const promise = new Promise((resolve,reject) => {
        img.onload=()=>{
            ctx.drawImage(img,0,0,w*2,h*2);
            const a=document.createElement('a');
            resolve(c.toDataURL('image/png'));
        };
        img.src='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(res.svg)))
    });

    const dataUrl = await promise;
    const base64Data = dataUrl.split(',')[1];
    const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const embeddedImg = await doc.embedPng(imageBytes);
    drawSvgOverlay(
        page,
        embeddedImg, // This is now a PDFImage object, not a string
        st.page.width,
        st.page.height,
        page.getWidth(),
        page.getHeight(),
        0.666
    );

    // Footer
    const dateStr = new Date().toLocaleDateString('en-CH');
    const artTitle = customization?.artworkInfo?.title || '';
    const authorName = customization?.authorInfo?.name || customization?.authorInfo?.username || '';
    const footerParts = [`PIXA LICENSE ${licenseBase.version || '1.0'}`];
    if (artTitle) footerParts.push(artTitle);
    if (authorName) footerParts.push(`Author: ${authorName}`);
    footerParts.push(`${dateStr}  (Generated by Pixagram(R) on ${dateStr})`);
    const fullFooter = footerParts.join('  |  ');
    page.drawText(fullFooter, { x: (sz.w - fonts.regular.widthOfTextAtSize(fullFooter, 5)) / 4, y: 10, size: 8, font: fonts.regular, color: C.black.c, opacity: C.black.o });

    // Left column
    const L = new Col(page, fonts, MRG, colW, topY, botY);
    L.drawTitle(licenseBase.shortName || licenseBase.name, 16);
    L.skip(8);
    if (licenseBase.explanation) L.drawAboutBox(licenseBase.explanation);
    for (const sec of licenseBase.sections) {
        if (sec.type === 'intro') { L.drawH1(sec.title); L.drawBody(sec.content); continue; }
        if (sec.id === 'license-options') { L.drawH2(`${sec.number}. ${sec.title}`); L.drawBody(sec.content); continue; }
        if (sec.type === 'customizable') { L.drawH2(`${sec.number}. ${sec.title}`); L.drawBody(applyCust(sec.content, customization)); continue; }
        L.drawH2(`${sec.number}. ${sec.title}`); L.drawBody(sec.content);
    }

    // Right column
    const R = new Col(page, fonts, MRG + colW + GUT, colW, topY, botY);
    const lo = licenseBase.sections.find(s => s.id === 'license-options');
    if (lo?.rightsCategories) {
        if (lo.rightsCategories[0]) R.drawRightsTable(lo.rightsCategories[0], customization);
        R.skip(12);
        if (lo.rightsCategories[1]) R.drawRightsTable(lo.rightsCategories[1], customization);
    }
    R.skip(8);
    R.drawLogo();


    return doc.save();
}

export default generateLicensePdf;