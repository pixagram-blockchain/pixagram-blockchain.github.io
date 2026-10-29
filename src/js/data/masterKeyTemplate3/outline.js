/**
 * Runtime outliner for the key-backup sheet.
 *
 * Seed words, the seed passphrase and the date are generated per document but must not be
 * selectable in the PDF, so they are drawn from pre-built glyph outlines (glyphs/*.js, made
 * by build/build.py --glyphs) instead of being handed to svg2pdf as <text>. Only the tables a
 * document needs are loaded: Latin always, kana / hangul / extra Latin-Greek-Cyrillic on demand.
 *
 * Output is <use> references to glyph outlines collected in defs(), grouped per run under a
 * matrix(u 0 0 -u x y) transform: plain SVG that svg2pdf turns into vector shapes.
 * A character no loaded table can draw is an error, never a silent blank.
 */

const TABLE_LOADERS = {
    latin: () => import("./glyphs/latin.js"),
    extra: () => import("./glyphs/extra.js"),
    kana: () => import("./glyphs/kana.js"),
    hangul: () => import("./glyphs/hangul.js"),
    hangulExt: () => import("./glyphs/hangul-ext.js")
};

// Visible space (opts.visibleSpaces): a light open box ␣ at the baseline, in a 1000-unit em.
const SPACE_MARK = {
    upm: 1000,
    entry: [420, "M80 160V0H340V160H290V50H130V160Z", 160],
    fill: "#8c8c8c"
};

/** Tables that may hold a character, in lookup order. */
function candidatesFor(ch) {
    const c = ch.codePointAt(0);
    if (c >= 0x3041 && c <= 0x30FF) { return ["kana"]; }
    if (c >= 0xAC00 && c <= 0xD7A3) { return ["hangul", "hangulExt"]; }
    return ["latin", "extra"];
}

const fmt = (v, digits) => {
    const s = Number(v.toFixed(digits)).toString();
    return s === "-0" ? "0" : s;
};

const chars = (text) => Array.from(String(text || "").normalize("NFC"));

const codePoint = (ch) => "U+" + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0");

class Outliner {
    constructor(tables) {
        this.tables = tables;           // name -> { upm, xHeight, glyphs, kern? }
        this.ids = new Map();           // "table:char" -> id | null (blank glyph)
        this.paths = [];
    }

    /** { name, table, entry } for a character, or null when no loaded table draws it. */
    lookup(ch) {
        if (ch === " ") { ch = " "; }
        for (const name of candidatesFor(ch)) {
            const table = this.tables[name];
            const entry = table && table.glyphs[ch];
            if (entry) { return { name, table, entry }; }
        }
        return null;
    }

    /** Characters of `text` that cannot be drawn (after NFC normalisation), without repeats. */
    missing(text) {
        const out = [];
        for (const ch of chars(text)) {
            if (!this.lookup(ch) && !out.includes(ch)) { out.push(ch); }
        }
        return out;
    }

    _runs(text, opts = {}) {
        const runs = [];
        for (const ch of chars(text)) {
            let hit;
            if (opts.visibleSpaces && (ch === " " || ch === " ")) {
                hit = { name: "mark", table: SPACE_MARK, entry: SPACE_MARK.entry };
            } else {
                hit = this.lookup(ch);
                if (!hit) { throw new Error(`outline: no glyph for ${codePoint(ch)}`); }
            }
            const last = runs[runs.length - 1];
            if (last && last.name === hit.name) {
                last.items.push([ch, hit.entry]);
            } else {
                runs.push({ name: hit.name, table: hit.table, items: [[ch, hit.entry]] });
            }
        }
        return runs;
    }

    /** Advance width (pt) of `text` at `size`. */
    measure(text, size, opts = {}) {
        let w = 0;
        for (const run of this._runs(text, opts)) {
            const u = size / run.table.upm;
            run.items.forEach(([ch, entry], i) => {
                w += entry[0] * u;
                const next = run.items[i + 1];
                if (next && run.table.kern) { w += (run.table.kern[ch + next[0]] || 0) * u; }
            });
        }
        return w;
    }

    /** Highest ink point of `text` above its baseline (pt) at `size`. */
    top(text, size, opts = {}) {
        let t = 0;
        for (const run of this._runs(text, opts)) {
            for (const [, entry] of run.items) { t = Math.max(t, (entry[2] || 0) * size / run.table.upm); }
        }
        return t;
    }

    /** `size`, or the smaller size (not below minSize) at which `text` fits in maxWidth. */
    fit(text, size, maxWidth, minSize = 0, opts = {}) {
        const w = this.measure(text, size, opts);
        return w <= maxWidth ? size : Math.max(minSize, Math.floor(100 * size * maxWidth / w) / 100);
    }

    /**
     * Greedy line breaking at `size` that never drops a character: a line ends right after
     * its last space when it has one (the space stays visible at the line end with
     * visibleSpaces), otherwise at the last character that fits.
     */
    wrap(text, size, maxWidth, opts = {}) {
        const cs = chars(text);
        const lines = [];
        let start = 0;
        while (start < cs.length) {
            let end = start;
            while (end < cs.length && this.measure(cs.slice(start, end + 1).join(""), size, opts) <= maxWidth) {
                end++;
            }
            if (end === cs.length) {
                lines.push(cs.slice(start).join(""));
                break;
            }
            if (end === start) { end = start + 1; }        // one glyph wider than the line
            let cut = end;
            for (let k = end - 1; k > start; k--) {
                if (cs[k] === " " || cs[k] === " ") { cut = k + 1; break; }
            }
            lines.push(cs.slice(start, cut).join(""));
            start = cut;
        }
        return lines;
    }

    _ref(name, ch, entry) {
        const key = name + ":" + ch;
        if (!this.ids.has(key)) {
            if (!entry[1]) {
                this.ids.set(key, null);
            } else {
                const id = "pxS" + this.ids.size.toString(36);
                this.ids.set(key, id);
                this.paths.push(`<path id="${id}" d="${entry[1]}"/>`);
            }
        }
        return this.ids.get(key);
    }

    /**
     * Draw `text` with its baseline at y, starting at x (align "start"), ending at x ("end")
     * or centred on x ("middle"). Returns { svg, width }.
     */
    draw(text, x, y, size, { fill = "#000", align = "start", visibleSpaces = false } = {}) {
        const opts = { visibleSpaces };
        const width = this.measure(text, size, opts);
        let cx = align === "end" ? x - width : align === "middle" ? x - width / 2 : x;
        const groups = [];
        for (const run of this._runs(text, opts)) {
            const u = size / run.table.upm;
            let fx = 0;
            const uses = [];
            run.items.forEach(([ch, entry], i) => {
                const id = this._ref(run.name, ch === " " ? " " : ch, entry);
                if (id) { uses.push(`<use href="#${id}"${fx ? ` x="${Math.round(fx)}"` : ""}/>`); }
                fx += entry[0];
                const next = run.items[i + 1];
                if (next && run.table.kern) { fx += run.table.kern[ch + next[0]] || 0; }
            });
            if (uses.length) {
                const runFill = run.name === "mark" ? SPACE_MARK.fill : fill;
                groups.push(`<g fill="${runFill}" transform="matrix(${fmt(u, 6)} 0 0 ${fmt(-u, 6)} ${fmt(cx, 2)} ${fmt(y, 2)})">${uses.join("")}</g>`);
            }
            cx += fx * u;
        }
        return { svg: groups.join(""), width };
    }

    /** <path> definitions of every glyph drawn so far (to go inside <defs>). */
    defs() {
        return this.paths.join("");
    }
}

/**
 * Load the glyph tables needed for `texts` and return an outliner.
 * `load` lets the app wrap chunk loading (e.g. a retrying loader): load(() => import(...)).
 */
export async function createOutliner(texts, { load = (f) => f() } = {}) {
    const tables = {};
    const fetchTable = async (name) => {
        if (!tables[name]) { tables[name] = (await load(TABLE_LOADERS[name])).default; }
    };
    const wanted = new Set(["latin"]);
    for (const text of texts) {
        for (const ch of chars(text)) { wanted.add(candidatesFor(ch)[0]); }
    }
    await Promise.all([...wanted].map(fetchTable));
    // Fallback tables (rarer characters) only when something is still missing.
    const probe = new Outliner(tables);
    const fallback = new Set();
    for (const text of texts) {
        for (const ch of probe.missing(text)) {
            candidatesFor(ch).slice(1).forEach((n) => fallback.add(n));
        }
    }
    await Promise.all([...fallback].map(fetchTable));
    return new Outliner(tables);
}
