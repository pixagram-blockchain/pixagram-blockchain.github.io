"use strict";
import React from "preact/compat";

// Case-insensitive first-match highlight built from React nodes — never
// innerHTML, so account names, tags, titles and free on-chain text all render
// literally by construction (no sanitizer needed). Same helper the old inline
// SearchResults used; shared by every row type now.
export function highlightNode(text, query) {
    const s = String(text == null ? "" : text);
    const q = String(query == null ? "" : query);
    const at = q ? s.toLowerCase().indexOf(q.toLowerCase()) : -1;
    if (at === -1) return s;
    return (
        <React.Fragment>
            {s.slice(0, at)}
            <b style={{ color: "#ffffff" }}>{s.slice(at, at + q.length)}</b>
            {s.slice(at + q.length)}
        </React.Fragment>
    );
}

/** Translation with a literal fallback for keys the locale files may not have yet. */
export function tr(t, key, fallback) {
    let v;
    try { v = t(key); } catch (e) { v = null; }
    return v && v !== key ? v : fallback;
}
