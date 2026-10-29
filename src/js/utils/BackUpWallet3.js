import QRCode from "qrcode-svg";
import {encode} from "@pixagram/turbobase64"
import JSLoader from "./JSLoader";
import { PrivateKey } from "@pixagram/dpixa";
// pixa_bip39 ≥ 0.0.7 is a wasm-pack *bundler*-target build: the wasm module
// initialises through the import graph (webpack asyncWebAssembly) and exposes
// no init function — do not `await init()` anywhere for this package.
import { generate_mnemonic, mnemonic_to_base58_master_key, search_mnemonic_words } from 'pixa_bip39';
import { default as initB, PdfConverter} from "svg2pdf-wasm"
import {font1, font2, font3} from "./fonts";

// Key-backup sheet v3 (data/masterKeyTemplate3): A4 or US Letter, localized labels.
//
// Real (selectable, copyable) text in the PDF: the @username, the master key, the four
// private keys and the seed words. Everything else is drawn as vector outlines and cannot
// be selected: the localized labels (pre-outlined per locale at build time) and, at runtime,
// the seed-word numbers, the seed passphrase and the date, which the template's outliner
// draws from pre-built glyph tables (Latin, Greek, Cyrillic, kana and hangul).
// The logo, the header text and the "pixagram.com" of the copy note link to pixagram.com.

// Selectable text: same faces, sizes and colour as before. svg2pdf ignores
// dominant-baseline, so y is the baseline (the attribute is left out on purpose).
const TEXT_ATTRS = 'fill="black" font-family="Industry"';

// svg2pdf resolves ONE face per <text> element and prints blanks for characters that face
// lacks, so kana/hangul seed words go wholesale to "Pixa Seed CJK" (font3: printable ASCII,
// kana and the wordlist hangul). Seed words outside both faces are refused up front.
const CJK_FAMILY = "Pixa Seed CJK";
const SELECTABLE_RE = /^[ -~ -ƒ–—‘-„†-•…‰‹›€ぁ-ヿ가-힣]*$/;

// Passphrase box: one line shrunk to fit, else two lines with the "Password:" caption moved
// up. Spaces print as a light ␣ so leading, trailing, doubled and line-end spaces stay
// visible, and no character is ever dropped at a line break.
const PASS_LINE_STEP = 1.25;   // line spacing, × font size
const PASS_CAPTION_GAP = 0.9;  // caption baseline → highest ink of the first line (pt)
const PASS_OUTLINE = { visibleSpaces: true };
const CJK_RE = /[ぁ-ヿ가-힣]/u;
const GRAPHEMES = /\P{M}\p{M}*|\p{M}+/gu;

// Latin, Greek and Cyrillic share look-alike letters (A/А/Α, o/о/ο …): on paper a passphrase
// mixing them cannot be told apart from another one.
const LOOKALIKE_SCRIPTS = [["Latin", /\p{Script=Latin}/u], ["Greek", /\p{Script=Greek}/u], ["Cyrillic", /\p{Script=Cyrillic}/u]];

const codePoints = (text) => Array.from(text).map((c) => "U+" + c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")).join(" ");

// Helper functions
function svgToBase64(svgString, prefix) {
    "use strict";

    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(svgString);
    const base64 = encode(uint8Array);
    return prefix + base64;
}

function escapeXML(text) {
    return String(text).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;", "'": "&apos;" })[c]);
}

function textSVG(x, y, size, text, anchor = "start") {
    return `<text x="${x}" y="${y}" font-size="${size}px" ${TEXT_ATTRS} text-anchor="${anchor}">${escapeXML(text)}</text>`;
}

const round2 = (v) => Number(v.toFixed(2));

/**
 * QR code as one compact path: the modules qrcode-svg computes (same options and error
 * correction as before), merged into horizontal runs, scaled to `size` at (x, y).
 */
function qrSVG(text, [x, y], size) {
    const qr = new QRCode({ content: text, join: true, width: size, height: size, padding: 0 });
    const modules = qr.qrcode.modules;
    const n = modules.length;
    let d = "";
    // The grid is modules[row][col]. qrcode-svg's own svg() reads it transposed, which prints
    // a mirror image that some scanners reject; draw it the way the QR standard lays it out.
    for (let row = 0; row < n; row++) {
        for (let col = 0; col < n;) {
            if (!modules[row][col]) { col++; continue; }
            const start = col;
            while (col < n && modules[row][col]) { col++; }
            d += `M${start} ${row}h${col - start}v1h${start - col}z`;
        }
    }
    const k = Number((size / n).toFixed(5));
    return `<path fill="#000" transform="matrix(${k} 0 0 ${k} ${x} ${y})" d="${d}"/>`;
}

/**
 * The passphrase as it will be printed, character by character: its NFC form when the
 * outlines draw it, else its NFKC form (full-width "Ａ" → "A", half-width "ｱ" → "ア").
 * pixa_bip39 derives the keys from the NFKD form, which both share, so the printed text is an
 * exact spelling of the passphrase. Returns { text } or { unprintable: [characters] }.
 */
function printablePassphrase(outliner, pass) {
    let text = "";
    const unprintable = [];
    for (const g of pass.normalize("NFC").match(GRAPHEMES) || []) {
        if (outliner.missing(g).length === 0) {
            text += g;
        } else if (outliner.missing(g.normalize("NFKC")).length === 0) {
            text += g.normalize("NFKC");
        } else if (!unprintable.includes(g)) {
            unprintable.push(g);
        }
    }
    return unprintable.length ? { unprintable } : { text };
}

/** Local calendar date as YYYY-MM-DD (the format every locale's label expects). */
function isoDate(date) {
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
    }
    const d = date === undefined || date === null ? new Date() : new Date(date);
    if (Number.isNaN(d.getTime())) {
        throw new Error("PDF: invalid date.");
    }
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "Generated by Pixagram.com on {date}." — localized prefix/suffix around the outlined date. */
function dateSVG(outliner, generatedOn, slot, dateText) {
    const out = [];
    let x = slot.x;
    const { prefix, suffix } = generatedOn;
    if (prefix.svg) { out.push(`<g transform="translate(${x + prefix.lead} ${slot.y})">${prefix.svg}</g>`); }
    x += prefix.w;
    const date = outliner.draw(dateText, x, slot.y, slot.size, { fill: slot.fill });
    out.push(date.svg);
    x += date.width;
    if (suffix.svg) { out.push(`<g transform="translate(${x + suffix.lead} ${slot.y})">${suffix.svg}</g>`); }
    return out.join("");
}

/**
 * "1. word" … in three columns, one shared size (shrunk only if a word is too wide).
 * The numbers are outlines; each word is its own <text> (one face per element) followed by
 * a space, in reading order, so selecting the grid copies just the words, space-separated.
 */
function seedWordsSVG(outliner, words, slot) {
    const items = words.map((word, i) => `${i + 1}. ${word}`);
    const size = Math.min(...items.map((t) => outliner.fit(t, slot.size, slot.maxWidth, 5)));
    const family = words.some((w) => CJK_RE.test(w)) ? CJK_FAMILY : "Industry";
    const out = [];
    words.forEach((word, i) => {
        const x = slot.columns[i % 3];
        const y = slot.y + Math.floor(i / 3) * slot.rowStep;
        const number = outliner.draw(`${i + 1}. `, x, y, size, { fill: slot.fill });
        out.push(number.svg);
        const content = escapeXML(word) + (i < words.length - 1 ? " " : "");
        out.push(`<text x="${round2(x + number.width)}" y="${y}" font-size="${size}px" fill="black" font-family="${family}" xml:space="preserve">${content}</text>`);
    });
    return out.join("");
}

/**
 * Passphrase layout: { svg, captionDy } or null when it cannot be printed at a legible size
 * (slot.minSize, or slot.minSizeCJK for kana and hangul) on at most two lines.
 */
function passphraseSVG(outliner, pass, slot, captionY) {
    const [boxTop, boxBottom] = slot.box;
    const captionMin = boxTop + 4.1;        // highest caption baseline (its cap height ≈ 2.9 pt)
    const lastBaseline = boxBottom - 2.5;   // wrapped lines sit lower, clear of the box edge
    const minSize = CJK_RE.test(pass) ? slot.minSizeCJK : slot.minSize;
    // caption baseline that clears the ink of `line` drawn at `size` on baseline `y`
    const captionAbove = (line, size, y) => y - outliner.top(line, size, PASS_OUTLINE) - PASS_CAPTION_GAP;

    let best = { size: outliner.fit(pass, slot.size, slot.maxWidth, 0, PASS_OUTLINE), lines: [pass] };
    if (best.size < 4.5) {
        const start = Math.min(slot.size, (lastBaseline - PASS_CAPTION_GAP - captionMin) / (PASS_LINE_STEP + 0.5));
        for (let s = Math.floor(start * 20) / 20; s > best.size + 0.2 && s >= minSize; s = Math.round((s - 0.05) * 100) / 100) {
            const lines = outliner.wrap(pass, s, slot.maxWidth, PASS_OUTLINE);
            const first = lastBaseline - (lines.length - 1) * PASS_LINE_STEP * s;
            if (lines.length <= 2 && captionAbove(lines[0], s, first) >= captionMin) {
                best = { size: s, lines };
                break;
            }
        }
    }
    if (best.size < minSize) {
        return null;
    }
    const style = Object.assign({ fill: slot.fill }, PASS_OUTLINE);
    if (best.lines.length === 1) {
        // the original position, raised only when tall glyphs (accents, kana, hangul) need it
        const caption = Math.min(captionY, captionAbove(pass, best.size, slot.y));
        return { svg: outliner.draw(pass, slot.x, slot.y, best.size, style).svg, captionDy: caption - captionY };
    }
    const step = PASS_LINE_STEP * best.size;
    const first = lastBaseline - (best.lines.length - 1) * step;
    const svg = best.lines.map((line, i) => outliner.draw(line, slot.x, first + i * step, best.size, style).svg).join("");
    return { svg, captionDy: captionAbove(best.lines[0], best.size, first) - captionY };
}

async function loadTemplate() {
    "use strict";
    return JSLoader(() => import("../data/masterKeyTemplate3"));
}

export async function validateUsername(username){
    "use strict";
    // Basic username validation for Pixa (similar to HIVE/STEEM rules)
    if (!username || typeof username !== 'string') return 'Username is required';
    if (username.length < 3) return 'Username must be at least 3 characters';
    if (username.length > 16) return 'Username must be at most 16 characters';
    if (!/^[a-z]/.test(username)) return 'Username must start with a letter';
    if (!/^[a-z0-9.-]+$/.test(username)) return 'Username can only contain lowercase letters, numbers, dots, and hyphens';
    if (/--/.test(username)) return 'Username cannot contain consecutive hyphens';
    if (/\.\./.test(username)) return 'Username cannot contain consecutive dots';
    if (/[.-]$/.test(username)) return 'Username cannot end with a dot or hyphen';
    return null; // null means valid
}

// ---------------------------------------------------------------------------
// BIP-39 wordlists ↔ app languages
// ---------------------------------------------------------------------------

/** Wordlists compiled into pixa_bip39 (see the crate README). */
export const BIP39_LANGUAGES = ["english", "czech", "french", "italian", "japanese", "korean", "portuguese", "spanish"];

/**
 * ISO 639-1 primary subtag → BIP-39 wordlist. The UI ships 25+ locales but
 * BIP-39 wordlists only exist for these eight; every other language falls
 * back to English.
 */
const ISO_TO_BIP39 = {
    en: "english",
    cs: "czech",
    fr: "french",
    it: "italian",
    ja: "japanese",
    ko: "korean",
    pt: "portuguese",
    es: "spanish"
};

/**
 * Resolve any language identifier — a wordlist name ("french"), an app
 * language ("fr") or a full locale code ("fr-CH", "pt_BR") — to a wordlist
 * pixa_bip39 supports. Unsupported or unknown values resolve to "english";
 * never throws.
 */
export function getBip39Language(codeOrLanguage) {
    "use strict";
    const raw = String(codeOrLanguage || "").trim().toLowerCase();
    if (raw === "") { return "english"; }
    if (BIP39_LANGUAGES.includes(raw)) { return raw; }
    return ISO_TO_BIP39[raw.split(/[-_]/)[0]] || "english";
}

/**
 * Mnemonic (string or array-like) → word array. Tolerates comma separation
 * and any Unicode whitespace, including U+3000 which some wallets use to
 * join Japanese phrases (pixa_bip39 itself joins with plain spaces).
 */
function mnemonicToWords(mnemonic) {
    "use strict";
    if (typeof mnemonic === "string") {
        return mnemonic.trim().split(/[\s,]+/u).filter(Boolean);
    }
    if (mnemonic !== null && typeof mnemonic === "object") {
        return Array.from(mnemonic);
    }
    throw new Error('MNEMONIC: You must provide a phrase being an array object or a string to generate the master key.');
}

export async function getWordsPossible(search, language, max){
    "use strict";
    const query = String(search === null || search === undefined ? "" : search).trim();
    const limit = parseInt(max, 10) > 0 ? parseInt(max, 10) : 5;
    const lang = getBip39Language(language);


    // The crate's wordlists are NFKD (per BIP-39): search with the NFKD form
    // of the query — keyboards and IMEs type NFC ("è", "가"), which the crate
    // would otherwise miss — and hand results back in NFC so they compare
    // equal to what the user typed.
    const nfkdQuery = query.normalize("NFKD");
    const results = [];
    const push = (list) => {
        Array.from(list || []).forEach((word) => {
            const nfc = word.normalize("NFC");
            if (!results.includes(nfc)) { results.push(nfc); }
        });
    };

    push(search_mnemonic_words(nfkdQuery, lang, limit));

    // Every seed issued before multi-language generation shipped is English,
    // so a user restoring an old seed on a non-English UI must still be
    // offered the English words: merge them after the UI-language matches.
    if (lang !== "english") {
        push(search_mnemonic_words(nfkdQuery, "english", limit));
    }

    // An exact hit must rank first whichever wordlist it came from — the keys
    // dialog only allows adding a word when it equals the top suggestion.
    const exactAt = results.indexOf(query.normalize("NFC"));
    if (exactAt > 0) {
        results.splice(exactAt, 1);
        results.unshift(query.normalize("NFC"));
    }

    return results.slice(0, limit);
}

export async function generateMnemonic(wordCount, language ){
    "use strict";

    wordCount = wordCount || 12;
    const wordCounts = [12, 15, 18, 21, 24];
    if(!wordCounts.includes(wordCount)) {
        throw new Error('MNEMONIC: Word count must be within the range [12, 15, 18, 21, 24]!');
    }

    // "language" may be a wordlist name, an app language ("de") or a full
    // locale code ("fr-CH"); languages without a BIP-39 wordlist fall back
    // to English.
    const defined_language = getBip39Language(language);

    const phrase = generate_mnemonic(wordCount, defined_language);

    // The crate emits NFKD (decomposed accents / hangul jamo). Store and
    // display NFC so words render as ordinary precomposed glyphs and compare
    // equal to keyboard/IME input; generateMasterKey converts back to NFKD.
    return phrase.trim().split(/\s+/u).filter(Boolean).map((w) => w.normalize("NFC"));
}

export async function generateMasterKey(mnemonic, passphrase){
    "use strict";
    const words = mnemonicToWords(mnemonic || "");

    // The crate's wordlists are NFKD; pixa_bip39 0.0.6 validated input
    // WITHOUT normalising it (NFC phrases threw "Invalid mnemonic") and 0.0.7
    // normalises internally. NFKD here is idempotent, a no-op for English,
    // and keeps this wrapper correct on either crate version — verified to
    // derive keys identical to the crate's raw NFKD output on 0.0.7. The
    // passphrase is normalised inside the crate; leave it untouched.
    const phrase = words.join(" ").normalize("NFKD");
    return await mnemonic_to_base58_master_key(phrase, passphrase);
}

/**
 * Generate private and public keys using dpixa (dhive fork)
 * Keys will have PIX prefix for public keys
 */
function generateKeysFromMasterKey(username, masterKey) {
    "use strict";
    const keyTypes = ['owner', 'active', 'posting', 'memo'];
    const privateKeys = {};
    const publicKeys = {};

    keyTypes.forEach(role => {
        // Generate private key from username + masterKey + role (like HIVE/STEEM)
        const privateKey = PrivateKey.fromLogin(username, masterKey, role);
        privateKeys[role] = privateKey.toString();

        // Generate public key with PIX prefix
        const publicKey = privateKey.createPublic("PIX");
        publicKeys[role] = publicKey.toString();
    });

    return { privateKeys, publicKeys };
}

/**
 * generatePDF options from the app settings. Index mirrors settings.locales and
 * settings.pdf_page_size onto the API object as `pdfLocale` and `pdfPageSize` (next to
 * askVote and defaultVotingPower); `fallbackLocale` covers the moment before settings load.
 */
export function backupPdfOptions(api, fallbackLocale) {
    return {
        locale: (api && api.pdfLocale) || fallbackLocale || "en",
        paper: (api && api.pdfPageSize) || undefined
    };
}

/**
 * The backup sheet as an SVG string (what generatePDF converts), plus the derived keys.
 * Same arguments as generatePDF.
 */
export async function generateBackupSVG(username, mnemonic, password, masterKey, options) {
    options = options || {};
    // Print NFC: precomposed glyphs ("è", "가") are what the outlines carry.
    const words = mnemonicToWords(mnemonic).map((w) => w.normalize("NFC"));
    const passInput = String(password || "");

    if(username.startsWith("@")){
        console.error("MNEMONIC: No need to provide the '@' from the username.")
        username = username.replaceAll("@", "");
    }

    if(masterKey.length < 1){
        throw new Error('MNEMONIC: You must provide a phrase being an array object or a string to generate the master key.');
    }

    const template = await loadTemplate();
    const locale = options.locale || "en";
    const paper = template.resolvePaper(options.paper, locale);
    const slots = template.LAYOUT.slots;
    const dateText = isoDate(options.date);
    const [labels, outliner] = await Promise.all([
        template.loadTemplateLabels(locale, { load: JSLoader }),
        template.createOutliner([...words, passInput, passInput.normalize("NFKC"), dateText], { load: JSLoader })
    ]);

    // A character the fonts or outlines cannot draw would print as a BLANK on the one
    // document meant to recover the account: refuse loudly instead (listing only the
    // characters and their code points, never the secret words themselves).
    const printed = printablePassphrase(outliner, passInput);
    const unprintable = [];
    const wordChars = words.flatMap((w) => Array.from(w).filter((c) => !SELECTABLE_RE.test(c)));
    for (const ch of wordChars.concat(printed.unprintable || [])) {
        if (!unprintable.includes(ch)) { unprintable.push(ch); }
    }
    if(unprintable.length > 0){
        throw new Error("PDF: these characters cannot be printed on the backup document (Latin, Greek, Cyrillic, kana and hangul only): "
            + unprintable.map((c) => `"${c}" (${codePoints(c)})`).join(", "));
    }
    const pass = printed.text;
    const scripts = LOOKALIKE_SCRIPTS.filter(([, re]) => re.test(pass)).map(([name]) => name);
    if(scripts.length > 1){
        throw new Error(`PDF: the seed passphrase mixes ${scripts.join(" and ")} letters, which look identical on paper; it cannot be printed unambiguously.`);
    }

    let passBlock = null;
    if(pass !== ""){
        passBlock = passphraseSVG(outliner, pass, slots.password, template.LAYOUT.labels.passwordLabel.anchor[1]);
        if(passBlock === null){
            throw new Error("PDF: the seed passphrase is too long to be printed legibly on the backup document.");
        }
    }

    // Generate keys using dpixa
    const { privateKeys: otherKeys, publicKeys: otherPublicKey } = generateKeysFromMasterKey(username, masterKey);

    const content = [
        dateSVG(outliner, labels.generatedOn, slots.date, dateText),
        seedWordsSVG(outliner, words, slots.seed),
        passBlock ? passBlock.svg : "",
        qrSVG(masterKey, slots.qr.master, slots.qr.size)
    ];
    for (const role of ["posting", "owner", "active", "memo"]) {
        content.push(qrSVG(otherKeys[role], slots.qr[role], slots.qr.size));
    }
    // Selectable text (with the seed words above): the keys, centred in their bars.
    content.push(textSVG(slots.masterKey.x, slots.masterKey.y, slots.masterKey.size, masterKey, slots.masterKey.anchor));
    for (const role of ["posting", "owner", "active", "memo"]) {
        const [x, y] = slots.privateKeys[role];
        content.push(textSVG(x, y, slots.privateKeys.size, otherKeys[role], slots.privateKeys.anchor));
    }
    content.push(textSVG(slots.username.x, slots.username.y, slots.username.size, "@" + username, "middle"));

    const svg = template.buildSheetSVG({
        labels,
        paper,
        content: content.join(""),
        defs: outliner.defs(),
        hasPassword: pass !== "",
        labelOffsets: passBlock ? { passwordLabel: [0, passBlock.captionDy] } : {}
    });
    return {
        svg,
        paper,
        locale: labels.locale,
        links: template.linkAreas(labels, paper),
        keys: { priv: otherKeys, pub: otherPublicKey }
    };
}

/**
 * Printable key backup as a PDF.
 *   options.locale  app language or locale ("fr", "pt-BR", "en-US" …): label language,
 *                   unsupported languages fall back to English
 *   options.paper   "a4" | "letter"; when omitted, Letter for locales of regions that use
 *                   it ("en-US", "es-MX" …), A4 otherwise
 *   options.date    date printed on the sheet (Date, timestamp or "YYYY-MM-DD"), default today
 * Resolves to [Blob, {priv, pub}] as before.
 */
export async function generatePDF(username, mnemonic, password, masterKey, options) {
    const { svg, keys, links } = await generateBackupSVG(username, mnemonic, password, masterKey, options || {});

    const finalSVGbase64 = svgToBase64(svg, "");

    await initB();
    const converter = new PdfConverter();

    // Load fonts from external module (avoids inlining large base64 blobs).
    // "Industry" sets the username, the keys and Latin seed words; "Pixa Seed CJK" (font3)
    // kana and hangul seed words.
    converter.load_base64_font(font1)
    converter.load_base64_font(font2)
    converter.load_base64_font(font3)

    const pdfData = await converter.svg_to_pdf_sync(finalSVGbase64, 1.0);
    // svg2pdf drops SVG links: add the pixagram.com link areas to the finished PDF.
    const template = await loadTemplate();
    const linked = template.addLinkAnnotations(pdfData, links);
    return [new Blob([linked], {type: "application/pdf"}), keys];
}
