/**
 * Clickable link areas for the one-page PDF svg2pdf produces (svg2pdf drops SVG <a> links).
 *
 * The links are added as a PDF incremental update: the original bytes stay untouched, and a
 * new revision of the page (with /Annots), one /Link annotation per area, an xref section
 * and a trailer pointing back to the original xref are appended. The annotations have no
 * border and no appearance, so the page looks exactly the same.
 */

const latin1 = (bytes) => {
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
        s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return s;
};

const pdfString = (s) => "(" + String(s).replace(/[\\()]/g, "\\$&") + ")";
const num = (v) => {
    const s = Number(v.toFixed(2)).toString();
    return s === "-0" ? "0" : s;
};

/**
 * `areas`: [{ rect: [x0, y0, x1, y1] in PDF points (origin at the bottom left), uri }].
 * Returns a new Uint8Array (or the input unchanged when there is nothing to add).
 */
export function addLinkAnnotations(pdf, areas) {
    const bytes = pdf instanceof Uint8Array ? pdf : new Uint8Array(pdf);
    if (!areas || areas.length === 0) { return bytes; }
    const text = latin1(bytes);

    const sx = text.lastIndexOf("startxref");
    const tr = text.lastIndexOf("trailer", sx);
    if (sx < 0 || tr < 0) { throw new Error("PDF links: no classic trailer found"); }
    const prevXref = parseInt(text.slice(sx + 9).trim(), 10);
    const trailer = text.slice(tr, sx);
    const size = parseInt((/\/Size\s+(\d+)/.exec(trailer) || [])[1], 10);
    const root = (/\/Root\s+(\d+\s+\d+\s+R)/.exec(trailer) || [])[1];
    const info = (/\/Info\s+(\d+\s+\d+\s+R)/.exec(trailer) || [])[1];
    if (!(size > 0) || !root || !(prevXref >= 0)) { throw new Error("PDF links: unreadable trailer"); }

    const page = /(\d+)\s+0\s+obj\s*(<<\s*\/Type\s*\/Page(?![A-Za-z])[\s\S]*?)endobj/.exec(text);
    if (!page) { throw new Error("PDF links: no page object found"); }
    const pageNum = parseInt(page[1], 10);
    const dict = page[2].trimEnd();

    const firstAnnot = size;
    const refs = areas.map((_, i) => `${firstAnnot + i} 0 R`).join(" ");
    const pageDict = /\/Annots\s*\[/.test(dict)
        ? dict.replace(/\/Annots\s*\[/, `/Annots [${refs} `)
        : dict.slice(0, dict.lastIndexOf(">>")) + `  /Annots [${refs}]\n>>`;

    const parts = [];
    const offsets = {};
    let offset = bytes.length;
    const add = (s) => { parts.push(s); offset += s.length; };

    add("\n");
    areas.forEach((area, i) => {
        const [x0, y0, x1, y1] = area.rect;
        offsets[firstAnnot + i] = offset;
        add(`${firstAnnot + i} 0 obj\n<< /Type /Annot /Subtype /Link /Rect [${num(Math.min(x0, x1))} ${num(Math.min(y0, y1))} ${num(Math.max(x0, x1))} ${num(Math.max(y0, y1))}]`
            + ` /Border [0 0 0] /A << /Type /Action /S /URI /URI ${pdfString(area.uri)} >> >>\nendobj\n`);
    });
    offsets[pageNum] = offset;
    add(`${pageNum} 0 obj\n${pageDict}\nendobj\n`);

    // cross-reference section: consecutive object numbers grouped into subsections
    const xrefAt = offset;
    const nums = Object.keys(offsets).map(Number).sort((a, b) => a - b);
    let xref = "xref\n0 1\n0000000000 65535 f\r\n";     // free-list head, as readers expect first
    for (let i = 0; i < nums.length;) {
        let j = i;
        while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) { j++; }
        xref += `${nums[i]} ${j - i + 1}\n`;
        for (let k = i; k <= j; k++) { xref += `${String(offsets[nums[k]]).padStart(10, "0")} 00000 n\r\n`; }
        i = j + 1;
    }
    add(xref);
    add(`trailer\n<< /Size ${firstAnnot + areas.length} /Root ${root}${info ? ` /Info ${info}` : ""} /Prev ${prevXref} >>\n`
        + `startxref\n${xrefAt}\n%%EOF\n`);

    const tail = parts.join("");
    const out = new Uint8Array(bytes.length + tail.length);
    out.set(bytes, 0);
    for (let i = 0; i < tail.length; i++) { out[bytes.length + i] = tail.charCodeAt(i); }
    return out;
}
