"use strict";

// ── Tags typed in the search box ──────────────────────────────────────────────
// The Tags section offers the typed term itself as "#term" only when it is a
// well-formed tag. The rules follow the Hive editor's: lowercase a–z and digits,
// dashes only between them (no leading, trailing or double dash), starting with
// a letter, 24 characters at most. A term that is already a known tag (e.g. in
// the trending list) is accepted as it is.

const TAG_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const MAX_TAG_LENGTH = 24;

/** The tag a search term stands for: trimmed, lower-cased, without a leading "#". */
export function normalizeTag(query) {
    return String(query == null ? "" : query).trim().toLowerCase().replace(/^#+/, "");
}

/** True when `tag` (already normalised) is a well-formed tag. */
export function isValidTag(tag) {
    return typeof tag === "string" && tag.length > 0 && tag.length <= MAX_TAG_LENGTH && TAG_RE.test(tag);
}
