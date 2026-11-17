// ── AI disclosure (NewPost → json_metadata.oc and json_metadata.ai) ─────────
// Every artwork NewPost publishes says how it was made, in two keys:
//
//   oc: true | false
//       Original content: the picture was the author's own real picture, a
//       photo or a drawing, before any style transformation. Never true for
//       a generation, which starts from no picture.
//   ai: "SDXL + RetroArt LoRA + FaceID"
//       Which AI made or transformed the picture, in the author's words;
//       "" when no AI was involved.
//
// Both are the author's declaration, pre-filled by the app: `ai` with the AI
// its pipeline ran (processImageFile reports it as { type, model }, see
// AI_TYPE and NO_AI below), `oc` on for an uploaded picture unless the file
// itself declares AI (fileDeclaresAi). Like `nsfw` and `license`, they are a
// convention of the app: the chain checks neither, and nothing can prove a
// picture was made without AI. Specified in the information repository,
// 11-protocol-reference/data-model.md ("AI and original content").

export const AI_TYPE = Object.freeze({
    GENERATION: "generation",           // text to image, from the description
    TRANSFORMATION: "transformation",   // image to image, from the author's picture
    NONE: "none"                        // no AI step: in-browser conversion, or published as is
});

/** What processImageFile reports when no AI step ran. */
export const NO_AI = Object.freeze({ type: AI_TYPE.NONE, model: "" });

// Longest `ai` text shown back. The app writes at most 128 characters;
// hand-written metadata can hold more.
const AI_DISPLAY_MAX = 256;

/**
 * The AI disclosure a post carries, as PostDialog shows it and EditPostDialog
 * loads it: { oc: true | false | null, ai: string }, or null when the post
 * declares neither (published before the keys existed, or by another app).
 * Takes json_metadata as stored, string or object. Lenient like the app's
 * other flags ("true" and 1 count as true). A missing `ai` beside a present
 * `oc` reads as "": the app's sanitizer drops empty strings.
 *
 * @param {string|object} jsonMetadata
 * @returns {{oc: (boolean|null), ai: string}|null}
 */
export const readAiDisclosure = (jsonMetadata) => {
    let meta = jsonMetadata;
    if (typeof meta === "string") {
        try { meta = JSON.parse(meta); } catch (e) { return null; }
    }
    if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
    const oc = meta.oc === true || meta.oc === "true" || meta.oc === 1
        ? true
        : (meta.oc === false || meta.oc === "false" || meta.oc === 0 ? false : null);
    const ai = typeof meta.ai === "string" ? meta.ai.trim().slice(0, AI_DISPLAY_MAX) : "";
    if (oc === null && !ai && typeof meta.ai !== "string") return null;
    return { oc, ai };
};

/**
 * The keys an edit writes back (EditPostDialog), to merge onto the stored
 * metadata. A post that carries the disclosure gets both keys again; one
 * published before they existed gains them only once the author sets one
 * here, so an edit of its title never adds a declaration nobody made. A
 * switch the author has not set stays unwritten (null is never stored).
 *
 * @param {{declared: boolean, oc: (boolean|null), ai: string}} edit
 * @returns {{oc?: boolean, ai?: string}}
 */
export const editedAiDisclosure = ({ declared, oc, ai }) => {
    const patch = {};
    const text = String(ai || "").trim();
    if (typeof oc === "boolean") patch.oc = oc;
    if (declared || typeof oc === "boolean" || text) patch.ai = text;
    return patch;
};

// Comma-separated parts, trimmed of the separators an edit leaves behind.
const tidyList = (text) => text.split(",")
    .map((part) => part.replace(/^[\s+]+|[\s+]+$/g, ""))
    .filter(Boolean)
    .join(", ");

/**
 * The "AI used" field after a new conversion result. Whatever the author
 * wrote of their own is kept, and the AI the app ran for this result takes
 * the place of the one it ran before, so the field never loses either:
 * "Midjourney" then a transformation gives "Midjourney, SDXL + VGA LoRA +
 * FaceID"; going back and converting without AI gives "Midjourney" again.
 *
 * @param {string} text The field as it is.
 * @param {string} previous What the app pre-filled last ("" for none).
 * @param {string} next What the app ran for the new result ("" for none).
 * @returns {string}
 */
export const prefillAiUsed = (text, previous, next) => {
    const current = String(text || "");
    // The previous pre-fill is still there: swap it in place.
    if (previous && current.includes(previous)) {
        return tidyList(current.split(previous).join(next || ""));
    }
    // Otherwise the author's words stay first, as the earlier step.
    const own = tidyList(current);
    if (!next || own.includes(next)) return own;
    return own ? `${own}, ${next}` : next;
};

// ── What the uploaded file says about itself ───────────────────────────────
// A picture made or edited with generative AI often says so in its file:
//   - IPTC's Digital Source Type, in XMP or in a C2PA manifest's actions:
//     `trainedAlgorithmicMedia` (created by a generative model) and
//     `compositeWithTrainedAlgorithmicMedia` (an existing picture changed by
//     one, such as inpainting) — https://cv.iptc.org/newscodes/digitalsourcetype/
//   - the generation settings Stable Diffusion front ends leave behind: the
//     AUTOMATIC1111 / Forge "parameters" text (Latin-1 in a PNG, UTF-16 in a
//     JPEG or WebP EXIF UserComment), a ComfyUI prompt graph, InvokeAI's and
//     NovelAI's text chunks.
// The bytes are searched for those markers, without parsing, in the head
// and the tail of the file, where image formats keep their metadata (a few
// milliseconds for a 4 MB photo on a desktop; no string is built). A match
// only turns the "Original content" switch off until the author says
// otherwise: a file without markers proves nothing (a screenshot or a
// re-save strips them).

const HEAD_BYTES = 2 * 1024 * 1024;
const TAIL_BYTES = 512 * 1024;

const ascii = (text) => Uint8Array.from(text, (c) => c.charCodeAt(0));
// The same text as UTF-16, whichever the byte order: "S\0t\0e…" is inside
// both "S\0t\0e\0…" (little-endian) and "\0S\0t\0e…" (big-endian).
const utf16 = (text) => ascii(text.split("").join("\u0000"));

// Any one of these is a declaration of AI. ("trainedAlgorithmicMedia" with a
// lowercase t is not inside "compositeWith…", so both are listed.)
const MARKERS = [
    "trainedAlgorithmicMedia",                  // IPTC / C2PA: generated
    "compositeWithTrainedAlgorithmicMedia",     // IPTC / C2PA: edited with generative AI
    "\"class_type\"",                           // ComfyUI: the prompt graph (PNG text "prompt")
    "invokeai_metadata",                        // InvokeAI 3 and later
    "sd-metadata",                              // InvokeAI 2
    "Software\u0000NovelAI"                     // NovelAI: PNG text "Software"
].map(ascii);
// All of these together: AUTOMATIC1111 / Forge "parameters", as text in a
// PNG or as UTF-16 in an EXIF UserComment.
const A1111_MARKERS = ["Steps: ", "Sampler: ", "CFG scale: "].map((m) => [ascii(m), utf16(m)]);

// First index of `needle` in `hay`, or -1. Candidates come from the native
// TypedArray#indexOf on the first byte; only those are compared in full.
const indexOfBytes = (hay, needle) => {
    const first = needle[0];
    const last = hay.length - needle.length;
    for (let i = hay.indexOf(first); i !== -1 && i <= last; i = hay.indexOf(first, i + 1)) {
        let j = 1;
        while (j < needle.length && hay[i + j] === needle[j]) j++;
        if (j === needle.length) return i;
    }
    return -1;
};

const readBytes = (blob) => (typeof blob.arrayBuffer === "function"
    ? blob.arrayBuffer()
    : new Promise((resolve, reject) => {
        // Older WebViews without Blob.arrayBuffer()
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error("FileReader failed"));
        reader.readAsArrayBuffer(blob);
    }));

/**
 * Whether an uploaded file declares, in its own metadata, that it was made or
 * edited with generative AI.
 *
 * @param {Blob} file The upload as picked: before HEIC conversion and before
 *        a crop, which both re-encode the picture and drop its metadata.
 * @returns {Promise<boolean>} Never rejects; false when unreadable.
 */
export const fileDeclaresAi = async (file) => {
    try {
        if (typeof Blob === "undefined" || !(file instanceof Blob) || !file.size) return false;
        // Searched one by one, so no marker is stitched across the gap.
        const parts = [new Uint8Array(await readBytes(file.slice(0, Math.min(file.size, HEAD_BYTES))))];
        if (file.size > HEAD_BYTES) {
            parts.push(new Uint8Array(await readBytes(file.slice(Math.max(HEAD_BYTES, file.size - TAIL_BYTES)))));
        }
        return parts.some((part) =>
            MARKERS.some((marker) => indexOfBytes(part, marker) !== -1)
            || A1111_MARKERS.every((forms) => forms.some((form) => indexOfBytes(part, form) !== -1)));
    } catch (e) {
        return false; // unreadable here: the switch keeps its default
    }
};
