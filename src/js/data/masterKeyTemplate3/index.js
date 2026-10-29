/**
 * Pixagram key-backup sheet — template v3.
 *
 * Same artwork as masterKeyTemplate2, rebuilt from SVG primitives (rect + rx, linear
 * gradient, a few custom paths) and split from its text:
 *   - every label is localized and pre-outlined per locale by build/build.py
 *     (labels/<locale>.js), so none of it is selectable in the PDF;
 *   - dynamic content (keys, seed, QR codes …) is placed by the generator through the
 *     slots in layout.js (generated from layout.json by the build).
 * Design units are points on the original A4 artboard. US Letter reuses the same design,
 * scaled uniformly to fit inside the page margins and centred.
 */
import layout from "./layout.js";

export { createOutliner } from "./outline.js";
export { addLinkAnnotations } from "./pdflinks.js";

const LABEL_LOADERS = {
    bn: () => import("./labels/bn.js"),
    cs: () => import("./labels/cs.js"),
    da: () => import("./labels/da.js"),
    de: () => import("./labels/de.js"),
    el: () => import("./labels/el.js"),
    en: () => import("./labels/en.js"),
    es: () => import("./labels/es.js"),
    fi: () => import("./labels/fi.js"),
    fr: () => import("./labels/fr.js"),
    hi: () => import("./labels/hi.js"),
    hu: () => import("./labels/hu.js"),
    id: () => import("./labels/id.js"),
    it: () => import("./labels/it.js"),
    ja: () => import("./labels/ja.js"),
    ko: () => import("./labels/ko.js"),
    nl: () => import("./labels/nl.js"),
    no: () => import("./labels/no.js"),
    pl: () => import("./labels/pl.js"),
    pt: () => import("./labels/pt.js"),
    ro: () => import("./labels/ro.js"),
    ru: () => import("./labels/ru.js"),
    sk: () => import("./labels/sk.js"),
    sv: () => import("./labels/sv.js"),
    ta: () => import("./labels/ta.js"),
    tr: () => import("./labels/tr.js"),
    uk: () => import("./labels/uk.js"),
    zh: () => import("./labels/zh.js")
};

export const LAYOUT = layout;
export const TEMPLATE_LOCALES = Object.freeze(Object.keys(LABEL_LOADERS));
export const PAPER_FORMATS = Object.freeze(Object.keys(layout.paper));

// Other codes seen in the wild for the same languages (nb/nn Norwegian, legacy "in" Indonesian …).
const LOCALE_ALIASES = { nb: "no", nn: "no", "in": "id", ua: "uk", gr: "el", cz: "cs", jp: "ja", kr: "ko", cn: "zh" };

/** "fr-CH", "pt_BR", "nb", "zh-Hant" … → one of TEMPLATE_LOCALES (falls back to "en"). */
export function resolveTemplateLocale(code) {
    const raw = String(code || "").trim().toLowerCase();
    if (TEMPLATE_LOCALES.includes(raw)) { return raw; }
    const primary = raw.split(/[-_]/)[0];
    const alias = LOCALE_ALIASES[primary] || primary;
    return TEMPLATE_LOCALES.includes(alias) ? alias : "en";
}

// Regions that use US Letter rather than A4.
const LETTER_REGIONS = new Set(["US", "CA", "MX", "PH", "CL", "CO", "VE", "PR", "GT", "CR", "PA", "DO", "SV", "NI", "HN"]);

/**
 * "a4" | "letter". Accepts "A4", "Letter", "us-letter", "usletter"; when `paper` is empty,
 * a full locale ("en-US", "es-MX") picks Letter for regions that use it, A4 otherwise.
 */
export function resolvePaper(paper, locale) {
    const p = String(paper || "").trim().toLowerCase().replace(/[\s_-]/g, "");
    if (p === "a4") { return "a4"; }
    if (p === "letter" || p === "usletter") { return "letter"; }
    const region = String(locale || "").split(/[-_]/)[1];
    return region && LETTER_REGIONS.has(region.toUpperCase()) ? "letter" : "a4";
}

/**
 * Outlined labels for a locale: { locale, defs, labels, generatedOn }.
 * `load` lets the app wrap chunk loading (e.g. a retrying loader): load(() => import(...)).
 */
export async function loadTemplateLabels(locale, { load = (f) => f() } = {}) {
    const mod = await load(LABEL_LOADERS[resolveTemplateLocale(locale)]);
    return mod.default;
}

/** Page size and the design → page transform for a paper format. */
export function pageGeometry(paper) {
    const key = resolvePaper(paper);
    const page = layout.paper[key];
    const d = layout.design;
    if (key === "a4") {
        return { paper: key, width: page.width, height: page.height, scale: 1, tx: 0, ty: 0 };
    }
    // Fit the design's content box (cards incl. strokes, date line to footer) inside the margins.
    const m = page.margin;
    const x0 = 22.91, x1 = 569.35;
    const y0 = d.contentTop, y1 = d.contentBottom;
    const scale = Math.min((page.width - 2 * m) / (x1 - x0), (page.height - 2 * m) / (y1 - y0));
    const tx = page.width / 2 - scale * (x0 + x1) / 2;
    const ty = page.height / 2 - scale * (y0 + y1) / 2;
    return { paper: key, width: page.width, height: page.height, scale, tx, ty };
}

const r = (n) => Number(n.toFixed(3));

/**
 * Clickable areas of the sheet for a paper format, in PDF points (origin at the bottom left):
 * the logo, the wordmark + tagline, and the "pixagram.com" of the copy note. Each links to
 * layout.links.url. Feed them to addLinkAnnotations() after the SVG → PDF conversion.
 */
export function linkAreas(labels, paper) {
    const g = pageGeometry(paper);
    const pad = layout.links.pad;
    const boxes = layout.links.header.slice();
    const [ax, ay] = layout.labels.copyNote.anchor;
    for (const [x0, y0, x1, y1] of (labels.links && labels.links.copyNote) || []) {
        boxes.push([ax + x0, ay + y0, ax + x1, ay + y1]);
    }
    return boxes.map(([x0, y0, x1, y1]) => ({
        uri: layout.links.url,
        rect: [
            r(g.tx + g.scale * (x0 - pad)),
            r(g.height - (g.ty + g.scale * (y1 + pad))),
            r(g.tx + g.scale * (x1 + pad)),
            r(g.height - (g.ty + g.scale * (y0 - pad)))
        ]
    }));
}

// ---------------------------------------------------------------------------
// Static artwork (design coordinates)
// ---------------------------------------------------------------------------

const PATHS = {
    // Pixagram logo mark (white on the black rounded square)
    logoMark: "M121.43 51.02h-7.4c-1.41.01-2.54 1.14-2.55 2.55v4.53c0 1.41 1.15 2.56 2.56 2.56h3.24q2.08.13 3.02.92c.95.8 1.1 2.44 1.13 3.18v3.3c.01 1.41 1.16 2.55 2.57 2.54h4.53c1.41-.01 2.55-1.15 2.55-2.56v-13.38c-.05-2.17-1.62-3.57-4.05-3.64h-5.59m-36.98 29.12h14.36c1.7 0 3.08 1.38 3.08 3.08v14.36c0 1.7-1.38 3.08-3.08 3.08h-14.36c-1.7-.01-3.07-1.38-3.08-3.08v-14.36c0-1.7 1.38-3.08 3.08-3.08m2.05 35.9v23.08h-20.51v-70.26c0-2.26 1.84-4.1 4.1-4.1h43.08c2.26 0 4.1 1.84 4.1 4.1v43.08c0 2.26-1.84 4.1-4.1 4.1h-26.67z",
    // "PIXAGRAM" + ® (brand wordmark, kept as artwork)
    wordmark: "M159.14 86.4v-36.9h19.03q7.37 0 7.37 7.38v9.12q0 7.38-7.37 7.38h-12.7v13.01l-6.33.01zm6.32-31.1v12.28h11.76q2 0 2-1.95v-8.38q0-1.95-2-1.95h-11.76zm33.1 31.1h-6.32v-36.9h6.32v36.9zm29.36 0-8.6-13.55-8.53 13.54h-6.8l11.86-18.76-11.5-18.13h7.12l8.17 12.97 8.23-12.97h6.8l-11.7 18.13 12.06 18.76-7.11.01zm35.04 0-2.79-9.02h-13.65l-2.8 9.01h-6.63l12.01-36.89h8.8l12.02 36.9h-6.96zm-14.65-14.82h10.12l-5.06-16.39-5.06 16.39zm52.44-10.33h-6.32v-4q0-1.06-.45-1.5-.45-.45-1.5-.45h-10.44q-1.05 0-1.5.45-.45.44-.45 1.5v21.4q0 1.05.45 1.5t1.5.44h10.44q1.05 0 1.5-.44.45-.45.45-1.5v-6.6h-7.85v-5.58h14.17v12.54q0 7.38-7.37 7.38h-12.23q-7.38 0-7.38-7.38v-22.13q0-7.38 7.38-7.38h12.23q7.37 0 7.37 7.38v4.37zm28.52 11.12 6.9 14.02h-6.85l-6.85-13.75h-7.49v13.75h-6.32v-36.89h18.97q7.38 0 7.38 7.38v8.22q0 6.59-5.74 7.27m-14.29-17.13v11.76h11.7q1.11 0 1.56-.45t.45-1.55v-7.8q0-1.06-.45-1.5-.45-.46-1.56-.46h-11.7zm50.55 31.15-2.8-9.01h-13.65l-2.79 9.01h-6.64l12.02-36.89h8.8l12.01 36.9-6.95-.01zm-14.65-14.8h10.11l-5.06-16.4-5.05 16.4zm55.55-22.09h7.11v36.9h-6.22v-26.1l-9.17 21.03h-4.9l-9.17-21.03v26.1h-6.06v-36.9h7.11l10.65 23.45 10.65-23.45zm16.17-13.98q-2.8-.02-2.78 2.77v8.44q0 2.78 2.78 2.77h6.14c1.9 0 2.73-.91 2.73-2.77v-8.44c0-1.9-.83-2.77-2.73-2.77h-6.14zm7.96 11.25c0 1.26-.56 1.86-1.82 1.86h-6.1q-1.89.02-1.87-1.86v-8.52c0-1.27.6-1.86 1.87-1.86h6.1c1.26 0 1.82.6 1.82 1.86v8.52zm-2.02-6.9c0-1.22-.52-1.74-1.74-1.74h-4.09v8.64h.96v-3.53h2.21l1.87 3.53h.99l-1.87-3.53c1.2-.04 1.67-.55 1.67-1.74v-1.63zm-4.91 2.5v-3.37h3.13c.63 0 .83.2.83.83v1.7c0 .64-.2.84-.83.84h-3.13z",
    // ".COM"
    wordmarkCom: "M456.11 86.4h-11.8q-7.38 0-7.38-7.39v-22.13q0-7.38 7.38-7.38h11.8q7.38 0 7.38 7.38v5.32h-6.32v-4.95q0-1.06-.45-1.5-.45-.45-1.5-.45h-10.02q-1.05 0-1.5.45-.45.44-.45 1.5v21.4q0 1.05.45 1.5t1.5.44h10.02q1.05 0 1.5-.44.45-.45.45-1.5v-4.96h6.32v5.32q0 7.38-7.38 7.38m34.1 0h-12.91q-7.38 0-7.38-7.39v-22.12q0-7.38 7.38-7.38h12.91q7.38 0 7.38 7.38v22.12q0 7.38-7.38 7.38m-13.96-29.15v21.4q0 1.05.44 1.5.45.44 1.5.44h11.13q1.05 0 1.5-.44.44-.45.44-1.5v-21.4q0-1.06-.44-1.5-.45-.45-1.5-.45h-11.12q-1.06 0-1.5.45-.45.44-.45 1.5m57.81-7.75h7.12v36.9h-6.22v-26.08l-9.17 21.03h-4.9l-9.19-21.03v26.1h-6.06v-36.9h7.12l10.64 23.45 10.66-23.47zm-103.35 29.64v7.27h-7.33v-7.27h7.33z",
    // seed-phrase card: rounded card with the "seed pass" tab at its bottom right
    seedCard: "M343.28 277.03q-.13 1.17.6 1.83.71.66 1.67.64h80.65c3.93.25 6.77 2.51 6.77 5.78l.4 31.9c0 4.6-3.18 8.32-7.1 8.32h-380.89c-6.65 0-12.04-5.4-12.04-12.05v-105.9c0-6.65 5.4-12.05 12.04-12.05h285.92c6.65 0 12.05 5.4 12.05 12.04l-.07 69.49z",
    // white writing area of the seed card (word grid + passphrase box)
    seedWell: "M343.36 302.5c-2.68 0-3.09-.02-4.08-.95q-1-.94-.93-3.85v-66.8c0-5.74-4.66-10.4-10.4-10.4h-279.2c-5.74 0-10.4 4.66-10.4 10.4v79.2c0 5.74 4.66 10.4 10.4 10.4h373.8c3.79 0 6.86-2.42 6.86-5.4v-7.2c0-2.98-3.07-5.4-6.86-5.4h-79.19z",
    // keys panel with the curved notch that holds the username (even-odd cut-out)
    keysPanel: "M170.99 365.45h-129.85c-9.51.01-17.22 7.72-17.23 17.23v307.53c0 9.51 7.72 17.24 17.23 17.24h509.97c9.51 0 17.24-7.73 17.24-17.24v-307.53c0-9.51-7.73-17.24-17.24-17.24h-140.12c-93.67 0-158.03.34-240 0m-24.64 0h296c-50.85-.2-69.1 34.9-110.3 41-41.2 6.1-54.1 4.74-83.02 0-28.9-4.75-60.03-41.2-102.68-41",
    // "i" badge of the footer
    infoIcon: "M35.88 728.7h13.86c1.09 0 1.98.89 1.98 2v14c0 .53-.2 1.04-.59 1.41-.36.38-.87.59-1.4.59h-13.84c-.53 0-1.04-.21-1.4-.59-.38-.37-.59-.88-.59-1.41v-14c0-1.11.89-2 1.98-2m5.94 6h1.98v-2h-1.98v2zm2.97 8v-2h-1v-4h-2.96v2h.99v2h-1v2h3.97z"
};

// The four role-key cards: [title anchor x, card x, card y]
const KEY_CARDS = [
    [36.35, 383.94], // posting
    [442.35, 383.94], // owner
    [36.35, 546.95], // active
    [442.35, 546.95] // memo
];
// Bars that hold the private-key text, under the cards
const KEY_BARS = [[36.35, 518.95], [312.35, 518.95], [36.35, 681.95], [312.35, 681.95]];

function rect(x, y, w, h, rx, attrs) {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"${attrs ? " " + attrs : ""}/>`;
}

/** Static artwork of the sheet (no text), in design coordinates. */
export function artworkSVG() {
    const s = [];
    // header: logo + wordmark + rainbow rule
    s.push(rect(42.92, 41.69, 97.43, 97.43, 9.75, 'fill="#000"'));
    s.push(`<path fill="#fff" fill-rule="evenodd" d="${PATHS.logoMark}"/>`);
    s.push(`<path fill="#000" d="${PATHS.wordmark}"/>`);
    s.push(`<path fill="#aaa" d="${PATHS.wordmarkCom}"/>`);
    s.push(rect(159.14, 127.12, 385.67, 5.48, 2.43, 'fill="url(#pxRainbow)"'));

    // seed section
    s.push(rect(23.91, 154.5, 544.44, 203, 13.28, 'fill="#f2f2f2"'));
    s.push(`<path fill="#e8e8e8" d="${PATHS.seedCard}"/>`);
    s.push(`<path fill="#fff" d="${PATHS.seedWell}"/>`);
    s.push('<g stroke="#dfdfdf" stroke-width="2" stroke-linecap="round"><path d="M138.35 228v85M238.41 228v85"/></g>');
    s.push('<path stroke="#e8e8e8" stroke-width="2" stroke-linecap="round" d="M340.13 305.1v12.96"/>');
    // master-key card + QR well
    s.push(rect(447.35, 195.51, 110, 129.99, 7.18, 'fill="#e8e8e8"'));
    s.push(rect(452.35, 220.5, 100, 100, 6, 'fill="#fff"'));
    s.push(rect(480.85, 323.13, 45.03, 6, 0, 'fill="#e8e8e8"'));
    // master-key text bar (2.5 pt grey border outside the white bar)
    s.push(rect(169.1, 330.38, 387.5, 20.5, 7.64, 'fill="#fff" stroke="#e8e8e8" stroke-width="2.5"'));
    // links between the two panels
    s.push(rect(60.87, 357.5, 50.6, 7.95, 0, 'fill="#f2f2f2"'));
    s.push(rect(480.78, 357.5, 50.6, 7.95, 0, 'fill="#f2f2f2"'));

    // keys panel with the username notch
    s.push(`<path fill="#f2f2f2" fill-rule="evenodd" d="${PATHS.keysPanel}"/>`);
    for (const [x, y] of KEY_CARDS) {
        s.push(rect(x, y, 110, 130.01, 7.18, 'fill="#e8e8e8"'));
        s.push(rect(x + 5, y + 25.01, 100, 100, 6, 'fill="#fff"'));
        s.push(rect(x + (x < 300 ? 34.21 : 39.64), y + 127.32, 45.03, 8, 0, 'fill="#e8e8e8"'));
    }
    // private-key bars (2.5 pt grey border inside the bar)
    for (const [x, y] of KEY_BARS) {
        s.push(rect(r(x + 1.25), r(y + 1.25), 237.5, 15.5, 4.6, 'fill="#fff" stroke="#e8e8e8" stroke-width="2.5"'));
    }

    // footer
    s.push('<rect x="23.91" y="719.5" width="544.44" height="90" rx="8.27" ry="8.6" fill="#fff" stroke="#e8e8e8" stroke-width="2"/>');
    s.push(`<path fill="#a2a2a2" d="${PATHS.infoIcon}"/>`);
    s.push('<path stroke="#f2f2f2" stroke-width="2" stroke-linecap="round" d="M325.93 730.5v70"/>');
    return s.join("");
}

const DEFS = '<linearGradient id="pxRainbow" x1="159.14" x2="544.81" y1="0" y2="0" gradientUnits="userSpaceOnUse">'
    + '<stop offset="0" stop-color="#f00"/><stop offset=".1375" stop-color="#f90"/><stop offset=".2708" stop-color="#ff0"/>'
    + '<stop offset=".4333" stop-color="#0f0"/><stop offset=".5667" stop-color="#0ff"/><stop offset=".6833" stop-color="#4a86e8"/>'
    + '<stop offset=".7958" stop-color="#00f"/><stop offset=".8917" stop-color="#90f"/><stop offset="1" stop-color="#f0f"/>'
    + "</linearGradient>";

/**
 * Localized labels placed at their anchors. `hasPassword` picks between the
 * "Password:" caption and the "(No password set)" placeholder; `offsets` moves
 * individual labels ({ passwordLabel: [dx, dy] }).
 */
export function labelsSVG(labels, { hasPassword = false, offsets = {} } = {}) {
    const out = [];
    for (const [name, frag] of Object.entries(labels.labels)) {
        if (!frag) { continue; }
        if (name === "passwordLabel" && !hasPassword) { continue; }
        if (name === "noPassword" && hasPassword) { continue; }
        const [x, y] = layout.labels[name].anchor;
        const [dx, dy] = offsets[name] || [0, 0];
        out.push(`<g transform="translate(${r(x + dx)} ${r(y + dy)})">${frag}</g>`);
    }
    return out.join("");
}

/**
 * Complete sheet. `content` is SVG markup in design coordinates (generator output),
 * `defs` extra <defs> markup (e.g. runtime glyph outlines), `labelOffsets` see labelsSVG.
 */
export function buildSheetSVG({ labels, paper, content = "", defs = "", hasPassword = false, labelOffsets = {} }) {
    const g = pageGeometry(paper);
    const transform = g.scale === 1 && !g.tx && !g.ty ? "" : ` transform="matrix(${r(g.scale)} 0 0 ${r(g.scale)} ${r(g.tx)} ${r(g.ty)})"`;
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${g.width} ${g.height}" width="${g.width}" height="${g.height}">`
        + `<defs>${DEFS}${labels.defs}${defs}</defs>`
        + `<rect width="${g.width}" height="${g.height}" fill="#fff"/>`
        + `<g${transform}>${artworkSVG()}${labelsSVG(labels, { hasPassword, offsets: labelOffsets })}${content}</g>`
        + "</svg>";
}
