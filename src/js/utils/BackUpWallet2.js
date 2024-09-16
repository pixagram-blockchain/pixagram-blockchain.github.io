import QRCode from "qrcode-svg";
import {B64chromium} from "chromium-base64"
import JSLoader from "./JSLoader";
import { PrivateKey } from "@pixagram/dpixa";
// pixa_bip39 ≥ 0.0.7 is a wasm-pack *bundler*-target build: the wasm module
// initialises through the import graph (webpack asyncWebAssembly) and exposes
// no init function — do not `await init()` anywhere for this package.
import { generate_mnemonic, mnemonic_to_base58_master_key, search_mnemonic_words } from 'pixa_bip39';
import { default as initB, PdfConverter} from "svg2pdf-wasm"
import {font1, font2, font3} from "./fonts";

// Constants
const SVG_NS = "http://www.w3.org/2000/svg";
const COMMON_TEXT_ATTRS = {
    "font-size": "10px",
    "fill": "black",
    "font-family": "Industry",
    "text-anchor": "left",
    "dominant-baseline": "middle"
};

// The svg2pdf pipeline resolves ONE face per <text> element (the first
// font-family present in its database) and its cross-face per-character
// fallback outputs blank glyphs — so any element that can carry kana or
// hangul must be routed WHOLESALE to the CJK face. font3 ("Pixa Seed CJK",
// a Noto Sans KR subset) therefore also embeds printable ASCII and full
// kana, so numbered seed lines ("12. ばしょ") and mixed alphanumeric+kana
// passwords render completely. Characters in NEITHER face would print as
// blanks (or abort when a whole element is unmappable) — generatePDF
// refuses those up front instead.
const CJK_FAMILY = "Pixa Seed CJK";
const CJK_RE = /[\u3040-\u30FF\uAC00-\uD7A3]/;

function seedTextFontFamily(text) {
    "use strict";
    return CJK_RE.test(String(text)) ? CJK_FAMILY : "Industry";
}

// Helper functions
function svgToBase64(svgString, prefix) {
    "use strict";

    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(svgString);
    const base64 = new B64chromium().bytesToBase64(uint8Array);
    return prefix + base64;
}

function generateQRsvg(text, size) {

    return new QRCode({
        content: text,
        join: true,
        width: size,
        height: size,
        color: "#000000ff",
        background: "#ffffff00",
        padding: 0
    }).svg();
}

function setAttributes(element, attrs) {
    "use strict";
    Object.entries(attrs).forEach(([key, value]) => {
        element.setAttribute(key, value);
    });
}

function createTextElement(doc, x, y, text, attrs) {
    "use strict";
    attrs = attrs || {};
    const group = doc.createElementNS(SVG_NS, "g");
    const element = doc.createElementNS(SVG_NS, "text");
    setAttributes(element, { x, y, ...COMMON_TEXT_ATTRS, ...attrs});
    element.textContent = text;
    group.appendChild(element);
    return group;
}

function insertPublicKeysTextIntoSVG(mainSVGDoc, x, postingKey, postingKeyY, activeKey, activeKeyY, memoKey, memoKeyY, ownerKey, ownerKeyY) {
    "use strict";
    const textGroup = mainSVGDoc.createElementNS(SVG_NS, "g");

    const keysData = [
        { text: postingKey, y: postingKeyY },
        { text: activeKey, y: activeKeyY },
        { text: memoKey, y: memoKeyY },
        { text: ownerKey, y: ownerKeyY }
    ];

    keysData.forEach(({ text, y }) => {
        textGroup.appendChild(createTextElement(mainSVGDoc, x, y, text, {"font-size": "10px"}));
    });

    mainSVGDoc.documentElement.appendChild(textGroup);
    return mainSVGDoc;
}

function insertPrivateKeysTextIntoSVG(mainSVGDoc, keysData) {
    "use strict";
    const textGroup = mainSVGDoc.createElementNS(SVG_NS, "g");

    keysData.forEach(({ xy, text }) => {
        textGroup.appendChild(createTextElement(mainSVGDoc, xy[0], xy[1], text, {"font-size": "7px"}));
    });

    mainSVGDoc.documentElement.appendChild(textGroup);
    return mainSVGDoc;
}

function insertSeedPhraseIntoSVG(mainSVGDoc, words, y, x1, x2, x3, pass, passX, passY) {
    "use strict";
    const textGroup = mainSVGDoc.createElementNS(SVG_NS, "g");
    const x = [x1, x2, x3];
    words.forEach((text, i) => {
        textGroup.appendChild(createTextElement(mainSVGDoc, x[(i) % 3], y + (i/3|0)*10, `${i+1}. ${text}`, {"font-size": "8px", "font-family": seedTextFontFamily(text)}));
    });

    pass = pass || "";
    if(pass === ""){
        textGroup.appendChild(createTextElement(mainSVGDoc, passX, passY+4, `(No password set)`, {"font-size": "8.5px", "font-style": "italic"}));
    }else {
        textGroup.appendChild(createTextElement(mainSVGDoc, passX, passY+2, `Password :`, {"font-size": "4px"}));
        textGroup.appendChild(createTextElement(mainSVGDoc, passX, passY+6, `${pass}`, {"font-size": "6.5px", "font-family": seedTextFontFamily(pass)}));
    }

    mainSVGDoc.documentElement.appendChild(textGroup);
    return mainSVGDoc;
}
function insertTextIntoSVG(mainSVGDoc, username, usernameX, usernameY, centeredMasterKey, keyX, keyY) {
    const textGroup = mainSVGDoc.createElementNS(SVG_NS, "g");

    const masterKeyElement = createTextElement(mainSVGDoc, keyX, keyY, centeredMasterKey, {
        "font-size": "10px"
    });

    const dateElement = createTextElement(mainSVGDoc, 48, 32,
        "Pixagram.com generated it on " + new Date(Date.now()).toDateString() + ".",
        { "font-size": "10px", "fill": "grey" }
    );

    const usernameElement = createTextElement(mainSVGDoc, usernameX, usernameY, username, {
        "font-size": "16px",
        "text-anchor": "middle",
        "dominant-baseline": "middle"
    });

    textGroup.appendChild(masterKeyElement);
    textGroup.appendChild(usernameElement);
    textGroup.appendChild(dateElement);
    mainSVGDoc.documentElement.appendChild(textGroup);

    return mainSVGDoc;
}
function moveChildrenToGroup(sourceDoc, targetGroup) {
    "use strict";
    while (sourceDoc.documentElement.firstChild) {
        targetGroup.appendChild(sourceDoc.documentElement.firstChild);
    }
}

function insertQRcodesIntoSVG(mainSVGDoc, o) {
    "use strict";

    const { qr, xy } = o;
    qr.forEach((qrDoc, index) => {
        const [x, y] = xy[index];
        const qrCode = qr[index];
        const group = mainSVGDoc.createElementNS(SVG_NS, "g");
        group.setAttribute("transform", `translate(${x}, ${y})`);
        moveChildrenToGroup(qrCode, group);
        mainSVGDoc.documentElement.appendChild(group);
    });

    return mainSVGDoc;
}

async function loadTemplate() {
    "use strict";
    const d1 = await JSLoader(() => import("../data/masterKeyTemplate2"));
    return d1.default();
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

export async function generatePDF(username, mnemonic, password, masterKey) {
    // Print NFC: precomposed glyphs ("è", "가") are what embedded fonts carry —
    // a decomposed "e + combining grave" or bare jamo would not shape in the
    // SVG→PDF pipeline.
    const words = mnemonicToWords(mnemonic).map((w) => w.normalize("NFC"));

    // Anything outside the embedded faces (Industry: Latin incl. Latin-1 +
    // Latin-Ext-A + common punctuation/€; Pixa Seed CJK: kana + wordlist
    // hangul) would print as a BLANK on the one document meant to recover the
    // account. Refuse loudly instead of shipping a silently incomplete backup.
    const PRINTABLE_RE = /^[\u0020-\u007E\u00A0-\u0192\u2013\u2014\u2018-\u201E\u2020-\u2022\u2026\u2030\u2039\u203A\u20AC\u3041-\u30FF\uAC00-\uD7A3]*$/;
    const unprintable = words.concat(password || "").filter((t) => !PRINTABLE_RE.test(t));
    if(unprintable.length > 0){
        throw new Error("PDF: these characters cannot be printed on the backup document (Latin, kana and hangul only): " + unprintable.join(" "));
    }

    if(username.startsWith("@")){
        console.error("MNEMONIC: No need to provide the '@' from the username.")
        username = username.replaceAll("@", "");
    }

    if(masterKey.length < 1){
        throw new Error('MNEMONIC: You must provide a phrase being an array object or a string to generate the master key.');
    }

    const parser = new DOMParser();
    const serializer = new XMLSerializer();
    const svgSTR = await loadTemplate();
    let templateSVG = parser.parseFromString(svgSTR.toString(), "image/svg+xml");

    // Generate keys using dpixa
    const { privateKeys: otherKeys, publicKeys: otherPublicKey } = generateKeysFromMasterKey(username, masterKey);

    const otherqrcodeSIZE = 80;

    // Insert seed phrase
    templateSVG = insertSeedPhraseIntoSVG(templateSVG, words, 230, 47, 147, 247, password, 350, 310);

    // Generate all QR codes
    const keyTypes = ['posting', 'memo', 'active', 'owner'];
    const qrCodes = keyTypes.map(type =>
        parser.parseFromString(generateQRsvg(otherKeys[type], otherqrcodeSIZE), "image/svg+xml")
    );
    const masterKeyQrCode = parser.parseFromString(generateQRsvg(masterKey, otherqrcodeSIZE), "image/svg+xml");
    // Insert QR codes and text
    templateSVG = insertQRcodesIntoSVG(templateSVG, {
        qr: [...qrCodes, masterKeyQrCode],
        xy: [
            [51, 419],
            [456, 582],
            [51, 582],
            [456, 419],
            [462, 231]
        ]
    });

    templateSVG = insertPrivateKeysTextIntoSVG(templateSVG, [
        {xy: [45, 529], text: otherKeys["posting"]},
        {xy: [45, 693], text: otherKeys["active"]},
        {xy: [322, 529], text: otherKeys["owner"]},
        {xy: [322, 693], text: otherKeys["memo"]},
    ]);
    templateSVG = insertTextIntoSVG(templateSVG, "@"+username, 286, 383, masterKey, 177, 343);

    const finalSVGbase64 = svgToBase64(serializer.serializeToString(templateSVG), "");

    await initB();
    const converter = new PdfConverter();

    // Load fonts from external module (avoids inlining large base64 blobs)
    converter.load_base64_font(font1)
    converter.load_base64_font(font2)
    converter.load_base64_font(font3)

    const pdfData = await converter.svg_to_pdf_sync(finalSVGbase64, 1.0);
    return [new Blob([pdfData], {type: "application/pdf"}), {priv: otherKeys, pub: otherPublicKey}];
}