"use strict";

import { WIKI_URL } from "./config";

// ── Documentation links ───────────────────────────────────────────────────────
// The documentation left GitHub (pixagram-blockchain/information) for the wiki
// on pixa.org, page for page:
//
//   github.com/pixagram-blockchain/information/blob/main/05-pixa-supra/oracle-and-price-feed.md#from-the-witnesses-feeds-to-the-median
//   pixa.org/wiki/pixa-supra/oracle-and-price-feed.html#from-the-witnesses-feeds-to-the-median
//
// The folders lose their number, a README.md is its folder's index.html, the
// other pages end in .html, and the #section stays as it is (the wiki's anchors
// are GitHub's, heading for heading). The Worker's index still sends the GitHub
// links: wikiUrl turns them into the wiki's wherever the box shows one (a
// documentation suggestion, an answer's sources and related sections, a link in
// an answer's text) and leaves any other link alone.

// github.com/pixagram-blockchain/information[/blob|tree|raw/<branch>[/<path>]], then ?… (dropped) and #… (kept)
const GITHUB_RE = /^https:\/\/(?:www\.)?github\.com\/pixagram-blockchain\/information(?:\/(blob|tree|raw)\/[^/?#]+(\/[^?#]*)?)?\/?(?:\?[^#]*)?(#.*)?$/i;
// raw.githubusercontent.com/pixagram-blockchain/information/<branch>/<path>
const RAW_RE = /^https:\/\/raw\.githubusercontent\.com\/pixagram-blockchain\/information\/[^/?#]+(\/[^?#]+)(?:\?[^#]*)?(#.*)?$/i;

/**
 * A documentation link on the wiki: a page or a folder of pixagram-blockchain/information on GitHub
 * becomes the same page on pixa.org/wiki, its #section kept. Anything else comes back unchanged
 * (another link, a file that is not a page, a value that is not a string).
 */
export function wikiUrl(url) {
    if (typeof url !== "string") return url;
    let kind, path, hash;
    let m = GITHUB_RE.exec(url);
    if (m) [kind, path, hash] = [m[1] ? m[1].toLowerCase() : "tree", m[2], m[3]]; // no kind: the repository itself
    else if ((m = RAW_RE.exec(url))) [kind, path, hash] = ["raw", m[1], m[2]];
    else return url;
    const parts = (path || "").split("/").filter(Boolean);
    if (parts.some((p) => p.startsWith("."))) return url; // .github/…: not on the wiki
    const file = parts.length && /\.md$/i.test(parts[parts.length - 1]) ? parts.pop() : null;
    if (!file && kind !== "tree") return url; // an image, the LICENSE…: not on the wiki
    const page = !file || /^readme\.md$/i.test(file) ? "index.html" : file.slice(0, -3) + ".html";
    return WIKI_URL + "/" + parts.map((p) => p.replace(/^\d+-/, "")).concat(page).join("/") + (hash || "");
}
