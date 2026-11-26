import * as React from "preact/compat";
import { createContext, memo, useCallback, useContext, useLayoutEffect, useMemo, useRef } from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";

// Lexical — the same packages, and the same import style, as the blog
// editor (components/editor). This module is only ever loaded on demand
// (CommentComposer imports it dynamically), so none of it weighs on the
// dialogs that show a comment bar.
import { LexicalComposer } from "@lexical/react/LexicalComposer.js";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin.js";
import { ContentEditable } from "@lexical/react/LexicalContentEditable.js";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin.js";
import { ListPlugin } from "@lexical/react/LexicalListPlugin.js";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary.js";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext.js";
import {
    $applyNodeReplacement,
    $createLineBreakNode,
    $createParagraphNode,
    $createTextNode,
    $getNodeByKey,
    $getRoot,
    $getSelection,
    $isElementNode,
    $isLineBreakNode,
    $isParagraphNode,
    $isRangeSelection,
    $isRootOrShadowRoot,
    $isTextNode,
    $setSelection,
    CLEAR_HISTORY_COMMAND,
    COMMAND_PRIORITY_HIGH,
    COMMAND_PRIORITY_LOW,
    DecoratorNode,
    FORMAT_ELEMENT_COMMAND,
    FORMAT_TEXT_COMMAND,
    INDENT_CONTENT_COMMAND,
    INSERT_LINE_BREAK_COMMAND,
    INSERT_PARAGRAPH_COMMAND,
    KEY_ENTER_COMMAND,
    PASTE_COMMAND,
    ParagraphNode,
    TextNode,
} from "lexical";
import { QuoteNode, $createQuoteNode, $isQuoteNode, DRAG_DROP_PASTE } from "@lexical/rich-text";
import { ListNode, ListItemNode, $createListNode, $createListItemNode, $isListNode } from "@lexical/list";

import { t, useLanguage } from "../utils/text";
import { parseComment, serializeComment, normalizeLine } from "../utils/commentRichText";

/* ══════════════════════════════════════════════════════════════════════
 * The comment composer's VISUAL mode.
 *
 * A Lexical editor that shows a comment's markdown as what it will look
 * like — bold, italic, a quote, a list, its image — and writes markdown
 * back on every change. It knows nothing of the text area, the format bar
 * or the dialogs: CommentComposer hands it the text (api.load), takes the
 * text back (onChange) and drives it through the `api` object it gets
 * from onReady:
 *
 *   load(markdown)            show this text (no onChange for it)
 *   focus()                   put the caret in the editor
 *   toggleBold() toggleItalic() toggleQuote() cycleList()
 *   insertImage(url, alt)     the one image: replaces the one there is
 *   getState()                "bold|italic|quote|list|0|" — the format
 *   subscribe(fn)             bar's state string, and its changes
 *
 * The document ⇄ markdown rules are utils/commentRichText's, the same on
 * the way in and on the way out, and markdown typed here is read by those
 * rules as it is typed: "**word**" turns bold, "> " starts a quote, "- " a
 * list. What the editor shows is therefore what the comment will be.
 * ══════════════════════════════════════════════════════════════════════ */

const LOAD_TAG = "pixa-comment-load";
// Formats a comment cannot carry: pasted text arrives with them, Ctrl+U
// asks for one. They are taken off again (see the TextNode transform).
const FOREIGN_FORMATS = ["underline", "strikethrough", "code", "subscript", "superscript", "highlight", "lowercase", "uppercase", "capitalize"];

const preventDefault = (e) => e.preventDefault();
// Keys typed in the editor are text, not shortcuts: they must not reach a
// document-level hotkey listener (the pages behind the dialogs have some,
// and they only know <input> and <textarea> as "typing"). Escape goes
// through, as it does from the text area.
const stopKeyLeak = (e) => {
    if (e.key !== "Escape" && e.key !== "Esc") e.stopPropagation();
};

/* ── The image ────────────────────────────────────────────────────────
 * One inline node: `![alt](url)` in the markdown, the picture here. `raw`
 * is the markdown it was read from, written back unchanged for as long as
 * the node lives (an image with a title, a <…> address). */

const ImageContext = createContext(null);

function CommentImage({ src, alt, nodeKey }) {
    useLanguage();
    const [editor] = useLexicalComposerContext();
    const ctx = useContext(ImageContext);
    const shown = ctx && ctx.resolve ? ctx.resolve(src) : null;
    const remove = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!editor.isEditable()) return;
        editor.update(() => {
            const node = $getNodeByKey(nodeKey);
            if (node) $removeImage(node);
        });
        editor.focus();
    }, [editor, nodeKey]);
    // A click on the picture puts the caret after it, as one on a letter would.
    const caretAfter = useCallback(() => {
        if (!editor.isEditable()) return;
        editor.update(() => {
            const node = $getNodeByKey(nodeKey);
            if (node) node.selectNext(0, 0);
        });
    }, [editor, nodeKey]);
    const label = t("components.cover_image_upload.remove");
    return (
        <React.Fragment>
            {shown
                ? <img src={shown} alt={alt || ""} draggable={false} decoding="async" referrerPolicy="no-referrer" onClick={caretAfter} />
                : <span className="pce-image-missing" onClick={caretAfter}>{alt || src}</span>}
            <button type="button" className="pce-image-remove" tabIndex={-1} title={label} aria-label={label}
                    onMouseDown={preventDefault} onClick={remove}>
                <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                    <path fill="currentColor" d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
            </button>
        </React.Fragment>
    );
}

export class CommentImageNode extends DecoratorNode {
    static getType() { return "pixa-comment-image"; }

    static clone(node) { return new CommentImageNode(node.__src, node.__alt, node.__raw, node.__key); }

    static importJSON(json) { return $createCommentImageNode(json.src, json.alt, json.raw); }

    constructor(src, alt, raw, key) {
        super(key);
        this.__src = String(src || "");
        this.__alt = String(alt || "");
        this.__raw = String(raw || "");
    }

    exportJSON() {
        return { type: "pixa-comment-image", version: 1, src: this.__src, alt: this.__alt, raw: this.__raw };
    }

    createDOM() {
        const span = document.createElement("span");
        span.className = "pce-image";
        return span;
    }

    updateDOM() { return false; }

    isInline() { return true; }

    // The arrow keys step over it, as over a character: there is nothing to
    // do with an image that is "selected" but type it away by accident.
    isKeyboardSelectable() { return false; }

    // what a plain-text copy of the comment holds for it
    getTextContent() { return serializeComment([{ type: "paragraph", children: [this.toInline()] }]); }

    toInline() { return { type: "image", url: this.__src, alt: this.__alt, raw: this.__raw }; }

    decorate() { return <CommentImage src={this.__src} alt={this.__alt} nodeKey={this.__key} />; }
}

function $createCommentImageNode(src, alt, raw) {
    return $applyNodeReplacement(new CommentImageNode(src, alt, raw));
}

const $isCommentImageNode = (node) => node instanceof CommentImageNode;

function $findImage(node) {
    const from = node || $getRoot();
    for (const child of from.getChildren()) {
        if ($isCommentImageNode(child)) return child;
        if ($isElementNode(child)) {
            const found = $findImage(child);
            if (found) return found;
        }
    }
    return null;
}

function $removeImage(node) {
    const parent = node.getParent();
    node.remove();
    // the paragraph the format bar gave it goes with it
    if (parent && $isParagraphNode(parent) && parent.isEmpty() && $getRoot().getChildrenSize() > 1) {
        const next = parent.getNextSibling() || parent.getPreviousSibling();
        parent.remove();
        if (next && $isElementNode(next)) next.selectStart();
    }
}

/* ── Document ⇄ nodes ─────────────────────────────────────────────────── */

function $textNode(text, bold, italic) {
    const node = $createTextNode(text);
    if (bold) node.toggleFormat("bold");
    if (italic) node.toggleFormat("italic");
    return node;
}

function $appendInline(parent, children) {
    for (const c of children || []) {
        if (c.type === "break") parent.append($createLineBreakNode());
        else if (c.type === "image") parent.append($createCommentImageNode(c.url, c.alt, c.raw));
        else if (c.text) parent.append($textNode(c.text, c.bold, c.italic));
    }
    return parent;
}

function $blockNode(block) {
    if (block.type === "quote") return $appendInline($createQuoteNode(), block.children);
    if (block.type === "list") {
        const list = $createListNode(block.ordered ? "number" : "bullet", block.ordered ? block.start : 1);
        for (const item of block.items || []) list.append($appendInline($createListItemNode(), item));
        return list;
    }
    return $appendInline($createParagraphNode(), block.children);
}

function $inlineOf(element, out) {
    for (const child of element.getChildren()) {
        if ($isLineBreakNode(child)) out.push({ type: "break" });
        else if ($isCommentImageNode(child)) out.push(child.toInline());
        else if ($isTextNode(child)) {
            out.push({ type: "text", text: child.getTextContent(), bold: child.hasFormat("bold"), italic: child.hasFormat("italic") });
        } else if ($isListNode(child)) {
            // a list inside an item is read as items of its own (see $itemsOf)
        } else if ($isElementNode(child)) {
            $inlineOf(child, out);
        } else {
            const text = child.getTextContent();
            if (text) out.push({ type: "text", text, bold: false, italic: false });
        }
    }
    return out;
}

// Items of a list, a nested list's among them: the document has one level.
function $itemsOf(list, items) {
    for (const li of list.getChildren()) {
        if (!$isElementNode(li)) continue;
        const nested = li.getChildren().filter($isListNode);
        if (!nested.length || li.getChildrenSize() > nested.length) items.push($inlineOf(li, []));
        for (const sub of nested) $itemsOf(sub, items);
    }
    return items;
}

function $documentBlocks() {
    const blocks = [];
    for (const node of $getRoot().getChildren()) {
        if ($isListNode(node)) {
            blocks.push({
                type: "list",
                ordered: node.getListType() === "number",
                start: node.getStart(),
                items: $itemsOf(node, []),
            });
        } else if ($isQuoteNode(node)) {
            blocks.push({ type: "quote", children: $inlineOf(node, []) });
        } else if ($isElementNode(node)) {
            blocks.push({ type: "paragraph", children: $inlineOf(node, []) });
        } else if ($isCommentImageNode(node)) {
            blocks.push({ type: "paragraph", children: [node.toInline()] });
        } else {
            blocks.push({ type: "paragraph", children: [{ type: "text", text: node.getTextContent(), bold: false, italic: false }] });
        }
    }
    return blocks;
}

/* ── Blocks under the selection ───────────────────────────────────────── */

function $topBlock(node) {
    if (!node || node.getKey() === "root") return null;
    return node.getTopLevelElement();
}

function $selectedBlocks(selection) {
    const seen = new Set();
    const out = [];
    const add = (node) => {
        const top = $topBlock(node);
        if (top && !seen.has(top.getKey())) {
            seen.add(top.getKey());
            out.push(top);
        }
    };
    selection.getNodes().forEach(add);
    if (!out.length) add(selection.anchor.getNode());
    return out;
}

// After blocks were rebuilt: a selection that points at a node no longer in
// the document goes to the end of `fallback`.
function $keepSelection(fallback) {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
        try {
            if (selection.anchor.getNode().isAttached() && selection.focus.getNode().isAttached()) return;
        } catch (e) { /* a point on a removed node */ }
    }
    if (fallback && fallback.isAttached()) fallback.selectEnd();
}

function $rangeSelection() {
    let selection = $getSelection();
    if ($isRangeSelection(selection)) return selection;
    // never focused yet: act at the end
    $getRoot().selectEnd();
    selection = $getSelection();
    return $isRangeSelection(selection) ? selection : null;
}

/* ── Quote ────────────────────────────────────────────────────────────── */

/**
 * Quote / unquote the selected blocks. Blocks that follow each other become
 * ONE quote, a paragraph gap turning into an empty quoted line — one quote
 * with two paragraphs, as the markdown button writes it.
 */
function $toggleQuote() {
    const selection = $rangeSelection();
    if (!selection) return;
    const blocks = $selectedBlocks(selection).filter($isElementNode);
    if (!blocks.length) return;
    if (blocks.every($isQuoteNode)) {
        for (const quote of blocks) {
            const paragraph = $createParagraphNode();
            paragraph.append(...quote.getChildren());
            quote.replace(paragraph);
        }
        return;
    }
    let quote = null;
    for (const block of blocks) {
        if (!quote || block.getPreviousSibling() !== quote) {
            quote = $createQuoteNode();
            block.insertBefore(quote);
        }
        const joined = quote.getChildrenSize() > 0;
        if ($isListNode(block)) {
            // each item a line of the quote
            const items = [];
            const collect = (list) => list.getChildren().forEach((li) => {
                if (!$isElementNode(li)) return;
                const own = li.getChildren().filter((c) => !$isListNode(c));
                if (own.length) items.push(own);
                li.getChildren().filter($isListNode).forEach(collect);
            });
            collect(block);
            items.forEach((own, k) => {
                if (k > 0) quote.append($createLineBreakNode());
                else if (joined) quote.append($createLineBreakNode(), $createLineBreakNode());
                quote.append(...own);
            });
        } else {
            if (joined) quote.append($createLineBreakNode(), $createLineBreakNode());
            quote.append(...block.getChildren());
        }
        block.remove();
    }
    $keepSelection(quote);
}

/* ── Lists ────────────────────────────────────────────────────────────── */

function $listState(blocks) {
    if (!blocks.length || !blocks.every($isListNode)) return "none";
    if (blocks.every((b) => b.getListType() === "number")) return "number";
    if (blocks.every((b) => b.getListType() !== "number")) return "bullet";
    return "none";
}

/**
 * The list button's three states, in turn: no list → bullets → numbers → no
 * list. Into a list, every LINE of the selected blocks becomes an item (as
 * in markdown mode); a list of the same kind right above takes them in.
 */
function $cycleList() {
    const selection = $rangeSelection();
    if (!selection) return;
    const blocks = $selectedBlocks(selection).filter($isElementNode);
    if (!blocks.length) return;
    const state = $listState(blocks);

    if (state === "number") {
        // numbers → no list: each item a paragraph
        let last = null;
        for (const list of blocks) {
            const walk = (l) => l.getChildren().forEach((li) => {
                if (!$isElementNode(li)) return;
                const own = li.getChildren().filter((c) => !$isListNode(c));
                const nested = li.getChildren().filter($isListNode);
                if (own.length || !nested.length) {
                    const paragraph = $createParagraphNode();
                    paragraph.append(...own);
                    list.insertBefore(paragraph);
                    last = paragraph;
                }
                nested.forEach(walk);
            });
            walk(list);
            list.remove();
        }
        $keepSelection(last);
        return;
    }

    if (state === "bullet") {
        // bullets → numbers, going on from a numbered list right above
        let last = null;
        for (const list of blocks) {
            const above = list.getPreviousSibling();
            if ($isListNode(above) && above.getListType() === "number") {
                above.append(...list.getChildren());
                list.remove();
                last = above;
            } else {
                const numbered = $createListNode("number", 1);
                numbered.append(...list.getChildren());
                list.replace(numbered);
                last = numbered;
            }
        }
        $keepSelection(last);
        return;
    }

    // no list (or a mix) → bullets
    let target = null;
    for (const block of blocks) {
        if (!target || block.getPreviousSibling() !== target) {
            const above = block.getPreviousSibling();
            if ($isListNode(above) && above.getListType() === "bullet") {
                target = above;
            } else {
                target = $createListNode("bullet", 1);
                block.insertBefore(target);
            }
        }
        if ($isListNode(block)) {
            target.append(...block.getChildren());
            block.remove();
            continue;
        }
        let item = null;
        let any = false;
        for (const child of block.getChildren()) {
            if ($isLineBreakNode(child)) {
                item = null;
                child.remove();
                continue;
            }
            if (!item) {
                item = $createListItemNode();
                target.append(item);
                any = true;
            }
            item.append(child);
        }
        if (!any) target.append($createListItemNode());
        block.remove();
    }
    $keepSelection(target);
}

/* ── Image ────────────────────────────────────────────────────────────── */

/** The comment's one image: it replaces the one there is; otherwise it goes
 *  in as a paragraph of its own, after the block the caret is in. */
function $insertImage(url, alt) {
    const node = $createCommentImageNode(url, alt, "");
    const existing = $findImage();
    if (existing) {
        existing.replace(node);
        node.selectNext(0, 0);
        return;
    }
    const selection = $getSelection();
    const root = $getRoot();
    let block = $isRangeSelection(selection) ? $topBlock(selection.focus.getNode()) : null;
    if (!block) block = root.getLastChild();
    let paragraph;
    if (block && $isParagraphNode(block) && block.isEmpty()) {
        paragraph = block;
    } else {
        paragraph = $createParagraphNode();
        if (block) block.insertAfter(paragraph); else root.append(paragraph);
    }
    paragraph.append(node);
    // …and writing goes on under it, where the comment will have it.
    let next = paragraph.getNextSibling();
    if (!next) {
        next = $createParagraphNode();
        paragraph.insertAfter(next);
    }
    if ($isElementNode(next)) next.selectStart(); else node.selectNext(0, 0);
}

/* ── New lines ────────────────────────────────────────────────────────── */

// The caret stands on an empty last line of `quote`.
function $onEmptyLastLine(selection, quote) {
    if (!selection.isCollapsed()) return false;
    const anchor = selection.anchor;
    const last = quote.getLastChild();
    if (last === null) return true;
    if (!$isLineBreakNode(last)) return false;
    return anchor.type === "element" && anchor.key === quote.getKey() && anchor.offset === quote.getChildrenSize();
}

/**
 * A new line that is not "send" — Shift+Enter with a keyboard, Enter on a
 * touch screen. As in markdown mode:
 *   in a list      the next item (an empty item ends the list — Lexical's)
 *   in a quote     a new quoted line; on an empty one, out of the quote
 *   anywhere else  a line break — a comment's lines are a break apart, a
 *                  blank line making the paragraph
 * `kind` is the command being handled; the return value is the command's
 * ("handled") — false lets Lexical do what it does for that command.
 */
function $newLine(editor, kind) {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return false;
    const block = $topBlock(selection.anchor.getNode());
    if ($isListNode(block)) {
        if (kind === "paragraph") return false;
        editor.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
        return true;
    }
    if ($isQuoteNode(block)) {
        if ($onEmptyLastLine(selection, block)) {
            const last = block.getLastChild();
            if (last) last.remove();
            const paragraph = $createParagraphNode();
            if (block.isEmpty()) block.replace(paragraph); else block.insertAfter(paragraph);
            paragraph.select();
            return true;
        }
        if (kind === "break") return false;
        editor.dispatchCommand(INSERT_LINE_BREAK_COMMAND, false);
        return true;
    }
    if (kind === "break") return false;
    editor.dispatchCommand(INSERT_LINE_BREAK_COMMAND, false);
    return true;
}

/* ── Markdown as it is typed ──────────────────────────────────────────── */

const QUOTE_PREFIX_RE = /^ {0,3}>[ \t]?/;
const ITEM_PREFIX_RE = /^ {0,3}(?:([-*+])|(\d{1,9})([.)]))[ \t]+/;
const RULE_RE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;

/**
 * What a line that starts with `text` is, by markdown: a quote ("> "), a
 * list item ("- ", "1. "), or neither (null). `first` is false for a line
 * under another one of the same paragraph, which only a quote, a bullet
 * with text or a "1." with text can end; `more` says the line goes on after
 * this text node.
 */
function readPrefix(text, first, more) {
    const q = QUOTE_PREFIX_RE.exec(text);
    if (q) {
        // a lone ">" is not a quote until something follows it
        if (q[0].length === text.length && !more && !/[ \t]$/.test(q[0])) return null;
        return { kind: "quote", len: q[0].length };
    }
    if (!more && RULE_RE.test(text)) return null; // "- - -"
    const m = ITEM_PREFIX_RE.exec(text);
    if (!m) return null;
    const ordered = !m[1];
    const start = ordered ? parseInt(m[2], 10) : 1;
    if (!first && ((m[0].length === text.length && !more) || (ordered && start !== 1))) return null;
    return { kind: "list", ordered, start, len: m[0].length };
}

/**
 * ParagraphNode transform: a line of a paragraph that starts like a quote
 * or a list item BECOMES one — that line and the ones under it, which
 * markdown reads as its continuation. Typed, pasted or left by an edit, it
 * makes no difference: the comment would be read that way, so it is shown
 * that way.
 */
function $convertBlockPrefix(paragraph, editor) {
    if (editor.isComposing() || !$isRootOrShadowRoot(paragraph.getParent())) return;
    const children = paragraph.getChildren();
    for (let i = 0; i < children.length; i++) {
        if (i > 0 && !$isLineBreakNode(children[i - 1])) continue;
        const child = children[i];
        if (!$isTextNode(child) || !child.isSimpleText()) continue;
        const text = child.getTextContent();
        const next = children[i + 1];
        const hit = readPrefix(text, i === 0, !!next && !$isLineBreakNode(next));
        if (!hit) continue;

        const selection = $getSelection();
        const key = child.getKey();
        const caretHere = $isRangeSelection(selection) && (selection.anchor.key === key || selection.focus.key === key);
        const rest = text.slice(hit.len);
        const tail = children.slice(i);
        if (rest) {
            // the caret keeps its place in the text, the prefix gone from under it
            const points = caretHere ? [selection.anchor, selection.focus].filter((p) => p.key === key && p.type === "text") : [];
            const offsets = points.map((p) => Math.max(0, p.offset - hit.len));
            child.setTextContent(rest);
            points.forEach((p, k) => p.set(key, Math.min(offsets[k], rest.length), "text"));
        } else {
            tail.shift();
            child.remove();
        }

        let block;
        let holder;
        if (hit.kind === "quote") {
            block = holder = $createQuoteNode();
        } else {
            block = $createListNode(hit.ordered ? "number" : "bullet", hit.ordered ? hit.start : 1);
            holder = $createListItemNode();
            block.append(holder);
        }
        holder.append(...tail);
        if (i === 0) {
            paragraph.replace(block);
        } else {
            paragraph.insertAfter(block);
            // The line breaks that led to this line were its distance from
            // the text above; two blocks are apart by themselves.
            for (let last = paragraph.getLastChild(); $isLineBreakNode(last); last = paragraph.getLastChild()) last.remove();
            if (paragraph.isEmpty()) paragraph.remove();
        }
        // a list goes on from the list of its kind right above
        if (hit.kind === "list") {
            const above = block.getPreviousSibling();
            if ($isListNode(above) && above.getListType() === block.getListType()) {
                above.append(holder);
                block.remove();
            }
        }
        if (caretHere && !rest) holder.selectStart();
        return;
    }
}

// The nodes of the line `node` stands on: its siblings, from the line break
// before it to the next one.
function $lineOf(node) {
    const line = [node];
    for (let n = node.getPreviousSibling(); n && !$isLineBreakNode(n); n = n.getPreviousSibling()) line.unshift(n);
    for (let n = node.getNextSibling(); n && !$isLineBreakNode(n); n = n.getNextSibling()) line.push(n);
    return line;
}

/**
 * TextNode transform, part one: bold and italic are the only formats.
 * Pasted text arrives with others, and with styles; Ctrl+U asks for one.
 */
function $plainFormats(node) {
    for (const format of FOREIGN_FORMATS) {
        if (node.hasFormat(format)) node.toggleFormat(format);
    }
    if (node.getStyle() !== "") node.setStyle("");
}

/**
 * TextNode transform, part two: the line the node stands on is kept equal
 * to what its own markdown reads as (utils/commentRichText, normalizeLine).
 * That is how markdown written out turns into what it means — "**word**",
 * "_word_", an image's "![alt](url)" — wherever its markers were typed, and
 * how a mark markdown cannot carry (half an address in bold) is shown the
 * way the comment will carry it. A line the buttons formatted is already
 * that, and nothing happens.
 *
 * `rounds` counts the rebuilds of a block within one update: a line that
 * would not settle is left as it is rather than rebuilt for ever.
 */
function $settleLine(node, config, rounds) {
    const parent = node.getParent();
    if (!parent) return;
    const line = $lineOf(node);
    const items = [];
    for (const n of line) {
        if ($isCommentImageNode(n)) items.push(n.toInline());
        else if ($isTextNode(n) && (n.isSimpleText() || n.getType() === "tab")) {
            items.push({ type: "text", text: n.getTextContent(), bold: n.hasFormat("bold"), italic: n.hasFormat("italic") });
        } else return; // something this editor does not make: hands off
    }

    // The caret (both ends of a selection), as [item, offset].
    const keys = line.map((n) => n.getKey());
    const selection = $getSelection();
    const points = [];
    if ($isRangeSelection(selection)) {
        for (const point of [selection.anchor, selection.focus]) {
            let at = null;
            if (point.type === "text") {
                const k = keys.indexOf(point.key);
                if (k !== -1) at = [k, point.offset];
            } else if (point.key === parent.getKey()) {
                // between two nodes of the block: against the line's own one
                const after = parent.getChildAtIndex(point.offset);
                const before = point.offset > 0 ? parent.getChildAtIndex(point.offset - 1) : null;
                const ka = after ? keys.indexOf(after.getKey()) : -1;
                const kb = before ? keys.indexOf(before.getKey()) : -1;
                if (ka !== -1) at = [ka, 0];
                else if (kb !== -1) at = [kb, items[kb].type === "image" ? 1 : items[kb].text.length];
            }
            if (at) points.push({ point, at });
        }
    }
    const typing = points.length === 2 && selection.isCollapsed() ? 0 : -1;

    // One image per comment: text spelling one becomes it only when there
    // is none yet.
    let free = config.maxImages > 0 && !$findImage();
    const settled = normalizeLine(items, {
        carets: points.map((p) => p.at),
        typing,
        image: (url) => {
            if (!free || !config.resolve(url)) return false;
            free = false;
            return true;
        },
    });
    if (!settled) return;

    const blockKey = parent.getKey();
    const round = (rounds.get(blockKey) || 0) + 1;
    if (round > 3) return;
    rounds.set(blockKey, round);

    // The image there is stays the node it is (its picture does not reload).
    const images = line.filter($isCommentImageNode);
    const made = settled.runs.map((r) => {
        if (r.type !== "image") return $textNode(r.text, r.bold, r.italic);
        const k = images.findIndex((img) => img.__src === r.url);
        return k !== -1 ? images.splice(k, 1)[0] : $createCommentImageNode(r.url, r.alt, r.raw);
    });
    if (!made.length) return;
    const kept = new Set(made.map((n) => n.getKey()));
    let last = null;
    for (const n of made) {
        if (last) last.insertAfter(n);
        else if (n !== line[0]) line[0].insertBefore(n);
        last = n;
    }
    for (const old of line) {
        if (!kept.has(old.getKey())) old.remove();
    }
    settled.carets.forEach(([k, offset], i) => {
        const target = made[k];
        if (!target) return;
        if ($isTextNode(target)) points[i].point.set(target.getKey(), offset, "text");
        else points[i].point.set(parent.getKey(), target.getIndexWithinParent() + (offset > 0 ? 1 : 0), "element");
    });
}

/** Plain text pasted in: read as the markdown it is. */
function $insertPlainText(text, config) {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    const src = String(text).replace(/\r\n?/g, "\n");
    const block = $topBlock(selection.anchor.getNode());
    if (src.indexOf("\n") === -1) {
        selection.insertRawText(src); // the transforms read it
        return;
    }
    if ($isListNode(block)) {
        // lines become items
        src.split("\n").forEach((line, k) => {
            if (k > 0) selection.insertParagraph();
            if (line) selection.insertRawText(line);
        });
        return;
    }
    const parsed = $isQuoteNode(block) ? null : parseComment(src, {
        maxImages: config.maxImages > 0 && !$findImage() ? 1 : 0,
        isImageUrl: (url) => !!config.resolve(url),
    });
    if (!parsed || !parsed.exact || !parsed.blocks.length) {
        selection.insertRawText(src); // code and the like: as it is
        return;
    }
    const nodes = parsed.blocks.map($blockNode);
    if (nodes.length === 1 && $isParagraphNode(nodes[0])) selection.insertNodes(nodes[0].getChildren());
    else selection.insertNodes(nodes);
}

/* ── The plugin: wires the editor to the composer ─────────────────────── */

function barState() {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return null;
    const block = $topBlock(selection.anchor.getNode());
    const list = $isListNode(block) ? (block.getListType() === "number" ? "number" : "bullet") : "none";
    return [selection.hasFormat("bold") ? 1 : 0, selection.hasFormat("italic") ? 1 : 0, $isQuoteNode(block) ? 1 : 0, list, 0, ""].join("|");
}

function ComposerPlugin({ configRef, onReady }) {
    const [editor] = useLexicalComposerContext();

    useLayoutEffect(() => {
        const config = () => configRef.current;
        const listeners = new Set();
        const rounds = new Map(); // see $settleLine
        let state = "0|0|0|none|0|";
        let emitted = null; // the markdown last handed out (or loaded)

        const publish = () => {
            const next = editor.getEditorState().read(barState);
            if (next === null || next === state) return;
            state = next;
            listeners.forEach((fn) => { try { fn(state); } catch (e) { /* a listener's own problem */ } });
        };
        const markdown = () => editor.getEditorState().read(() => serializeComment($documentBlocks()));
        const isFocused = () => {
            const root = editor.getRootElement();
            return !!root && typeof document !== "undefined" && document.activeElement === root;
        };
        // A change asked for from outside (the format bar). The bar's
        // buttons never take the focus, so the editor has it whenever the
        // reader was typing; when it does not, it takes it now — an action
        // needs a caret, and the reader should see where it went.
        const act = (fn) => {
            if (!editor.isEditable()) return;
            const root = editor.getRootElement();
            if (root && !isFocused()) {
                try { root.focus({ preventScroll: true }); } catch (e) { try { root.focus(); } catch (e2) { /* not focusable */ } }
            }
            editor.update(() => {
                const selection = $rangeSelection();
                if (selection) fn(selection);
            });
        };

        const api = {
            load(text) {
                const src = String(text == null ? "" : text);
                const focused = isFocused();
                // Undo starts over at this text, and comes back to it. (The
                // history is emptied first, so that it takes what is loaded
                // as where it stands; emptied after, it would have nothing
                // to come back to until the second change.)
                editor.dispatchCommand(CLEAR_HISTORY_COMMAND, undefined);
                editor.update(() => {
                    const cfg = config();
                    const rootNode = $getRoot();
                    rootNode.clear();
                    const { blocks } = parseComment(src, { maxImages: cfg.maxImages, isImageUrl: (url) => !!cfg.resolve(url) });
                    for (const block of blocks) rootNode.append($blockNode(block));
                    if (rootNode.getChildrenSize() === 0) rootNode.append($createParagraphNode());
                    // An editor that is not being typed in keeps out of the
                    // page's selection. One that is keeps its caret, at the
                    // end — and without the format of the text that was
                    // there before (Lexical keeps it on the selection).
                    if (focused) {
                        rootNode.selectEnd();
                        const selection = $getSelection();
                        if ($isRangeSelection(selection)) {
                            if (typeof selection.setFormat === "function") selection.setFormat(0); else selection.format = 0;
                        }
                    } else {
                        $setSelection(null);
                    }
                }, { tag: LOAD_TAG, discrete: true });
                emitted = src;
            },
            getMarkdown: markdown,
            focus() { editor.focus(); },
            isFocused,
            toggleBold() { act((selection) => selection.formatText("bold")); },
            toggleItalic() { act((selection) => selection.formatText("italic")); },
            toggleQuote() { act($toggleQuote); },
            cycleList() { act($cycleList); },
            insertImage(url, alt) { act(() => $insertImage(url, alt)); },
            getState() { return state; },
            subscribe(fn) {
                listeners.add(fn);
                return () => { listeners.delete(fn); };
            },
        };

        const sends = () => {
            const cfg = config();
            return !!cfg.onSubmit && (!cfg.enterSends || cfg.enterSends());
        };

        const unregister = [
            editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves, tags }) => {
                rounds.clear();
                publish();
                if (tags.has(LOAD_TAG)) return;
                if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return; // the caret only
                const md = editorState.read(() => serializeComment($documentBlocks()));
                if (md === emitted) return;
                emitted = md;
                const cfg = config();
                if (cfg.onChange) cfg.onChange(md);
            }),

            // Markdown as it is typed (and pasted, and loaded): the marks of a
            // line, then what the line starts with. A paragraph's own
            // transform only runs when its list of children changes, not for
            // a character typed in one of them — hence the call from here.
            editor.registerNodeTransform(TextNode, (node) => {
                if (editor.isComposing() || !node.isAttached()) return; // not in the middle of an IME word
                if (node.isSimpleText()) $plainFormats(node);
                $settleLine(node, config(), rounds);
                const block = node.isAttached() ? node.getParent() : null;
                if ($isParagraphNode(block)) $convertBlockPrefix(block, editor);
            }),
            editor.registerNodeTransform(ParagraphNode, (node) => $convertBlockPrefix(node, editor)),
            // one level of list: an item pasted or indented deeper comes back up
            editor.registerNodeTransform(ListItemNode, (node) => {
                if (node.getIndent() > 0) node.setIndent(0);
            }),

            // Keys. Enter sends where there is a keyboard to Shift+Enter
            // with — except in a list, where it is the next item.
            editor.registerCommand(KEY_ENTER_COMMAND, (event) => {
                if (!event || event.isComposing || event.keyCode === 229) return false; // IME: Enter confirms the word
                const cfg = config();
                if (event.ctrlKey || event.metaKey) {
                    if (!cfg.onSubmit) return false;
                    event.preventDefault();
                    cfg.onSubmit();
                    return true;
                }
                if (event.shiftKey || event.altKey || !sends()) return false;
                const selection = $getSelection();
                if ($isRangeSelection(selection) && $isListNode($topBlock(selection.anchor.getNode()))) return false;
                event.preventDefault();
                cfg.onSubmit();
                return true;
            }, COMMAND_PRIORITY_HIGH),
            editor.registerCommand(INSERT_PARAGRAPH_COMMAND, () => $newLine(editor, "paragraph"), COMMAND_PRIORITY_HIGH),
            editor.registerCommand(INSERT_LINE_BREAK_COMMAND, () => $newLine(editor, "break"), COMMAND_PRIORITY_HIGH),

            // Bold and italic only; no alignment, no indent.
            editor.registerCommand(FORMAT_TEXT_COMMAND, (format) => format !== "bold" && format !== "italic", COMMAND_PRIORITY_HIGH),
            editor.registerCommand(FORMAT_ELEMENT_COMMAND, () => true, COMMAND_PRIORITY_HIGH),
            editor.registerCommand(INDENT_CONTENT_COMMAND, () => true, COMMAND_PRIORITY_HIGH),

            // Plain text pasted in is markdown; formatted text and our own
            // copies are Lexical's to read; files go to DRAG_DROP_PASTE.
            editor.registerCommand(PASTE_COMMAND, (event) => {
                const data = event && event.clipboardData;
                if (!data || typeof data.getData !== "function") return false;
                const types = Array.prototype.slice.call(data.types || []);
                if (types.indexOf("application/x-lexical-editor") !== -1 || types.indexOf("text/html") !== -1) return false;
                const text = data.getData("text/plain");
                if (!text) return false;
                event.preventDefault();
                editor.update(() => $insertPlainText(text, config()));
                return true;
            }, COMMAND_PRIORITY_LOW),
            // Image files pasted or dropped: the composer uploads them.
            editor.registerCommand(DRAG_DROP_PASTE, (files) => {
                const cfg = config();
                const images = Array.prototype.filter.call(files || [], (f) => f && f.type && f.type.indexOf("image/") === 0);
                if (!images.length) return false;
                if (cfg.maxImages > 0 && cfg.onImageFiles) cfg.onImageFiles(images);
                return true;
            }, COMMAND_PRIORITY_LOW),
        ];

        // Focus, for the field around the editor (label, underline).
        let detach = null;
        const removeRoot = editor.registerRootListener((root) => {
            if (detach) { detach(); detach = null; }
            if (!root) return;
            const onFocus = (e) => { const cfg = config(); if (cfg.onFocus) cfg.onFocus(e); };
            const onBlur = (e) => { const cfg = config(); if (cfg.onBlur) cfg.onBlur(e); };
            root.addEventListener("focus", onFocus);
            root.addEventListener("blur", onBlur);
            detach = () => {
                root.removeEventListener("focus", onFocus);
                root.removeEventListener("blur", onBlur);
            };
        });

        onReady(api);
        return () => {
            onReady(null);
            unregister.forEach((fn) => fn());
            removeRoot();
            if (detach) detach();
            listeners.clear();
        };
    }, [editor, configRef, onReady]);

    return null;
}

function EditablePlugin({ disabled }) {
    const [editor] = useLexicalComposerContext();
    useLayoutEffect(() => {
        editor.setEditable(!disabled);
    }, [editor, disabled]);
    return null;
}

/* ── Styles ───────────────────────────────────────────────────────────── */

const styles = () => ({
    /* The editable area. It stands where the text area stands and carries
     * the field's own input classes (className), so its type, colour and
     * disabled look are the field's. */
    editable: {
        fontFamily: "'Red Hat Display'",
        display: "block",
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        outline: "none",
        overflowX: "hidden",
        overflowY: "auto",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        overflowWrap: "anywhere",
        cursor: "text",
        // The dialogs are user-select: none around it; without this WebKit
        // lets nothing be typed.
        WebkitUserSelect: "text",
        userSelect: "text",
        // Blocks are one line apart — the blank line between them.
        "& > *": { margin: 0 },
        "& > * + *": { marginTop: "1.1876em" },
        "& .pce-quote": {
            paddingLeft: 10,
            borderLeft: "3px solid #3a3a3a",
            color: "#909090",
        },
        "& .pce-ul, & .pce-ol": { paddingLeft: 24 },
        "& .pce-li": { margin: 0 },
        "& .pce-b": { fontWeight: "bold" },
        "& .pce-i": { fontStyle: "italic" },
        // Selection as in the fields (theme/overrides): a translucent grey
        // over the text's own colour, not the page-wide white block.
        "& ::selection, &::selection": {
            background: "rgba(140, 140, 140, 0.45)",
            color: "currentColor",
        },
        // In the line, like a (large) character: the caret can stand before
        // it and after it, and the arrow keys pass it.
        "& .pce-image": {
            position: "relative",
            display: "inline-block",
            verticalAlign: "bottom",
            maxWidth: "100%",
            margin: "4px 0",
            lineHeight: 0,
            userSelect: "none",
        },
        // In the thread the image is a block: what is written on its line
        // goes above and below it. The same here.
        "& .pce-image + :not(br):not(.pce-image)::before": {
            content: '"\\A"',
            whiteSpace: "pre",
        },
        "& :not(br):not(.pce-image):has(+ .pce-image + br)::after": {
            content: '"\\A"',
            whiteSpace: "pre",
        },
        // Outranks the page-wide "p img" (width: 100%, 32px corners).
        "& .pce-image img": {
            display: "block",
            width: "auto",
            height: "auto",
            maxWidth: "100%",
            maxHeight: 168,
            borderRadius: 14,
            backgroundColor: "#0c0c0c",
        },
        "& .pce-image-missing": {
            display: "inline-block",
            padding: "6px 10px",
            borderRadius: 10,
            lineHeight: 1.2,
            fontSize: "0.85em",
            color: "#8a8a8a",
            backgroundColor: "#1a1a1a",
        },
        "& .pce-image-remove": {
            position: "absolute",
            top: 4,
            right: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 20,
            height: 20,
            padding: 0,
            border: 0,
            borderRadius: "50%",
            cursor: "pointer",
            color: "#ffffff",
            backgroundColor: "rgba(0,0,0,0.65)",
            "&:hover": { backgroundColor: "rgba(0,0,0,0.85)" },
        },
    },
});

const THEME = {
    paragraph: "pce-p",
    quote: "pce-quote",
    list: { ul: "pce-ul", ol: "pce-ol", listitem: "pce-li" },
    text: { bold: "pce-b", italic: "pce-i" },
};

/* ── The component ────────────────────────────────────────────────────── */

/**
 * Props
 *   className       the field's input classes (font, colour, disabled)
 *   minHeight / maxHeight   the text area's own bounds
 *   disabled
 *   maxImages       1, or 0 for a field that takes no image
 *   resolveImage    (url) → the address to show an image from, or null
 *   enterSends      () → whether a bare Enter sends (keyboard) or not (touch)
 *   labelledBy / describedBy   ids, for assistive technology
 *   onReady(api | null)   the `api` above; null when the editor goes
 *   onChange(markdown)    the reader changed the text
 *   onSubmit()            Enter / Ctrl+Enter
 *   onImageFiles(files)   image files pasted or dropped
 *   onFocus / onBlur
 * The callbacks are read when they are used, so a new one costs a render
 * and nothing else: the editor is never torn down for it.
 */
function CommentVisualEditorInner(props) {
    const { classes, className, minHeight, maxHeight, disabled, labelledBy, describedBy, onReady } = props;

    const configRef = useRef(null);
    configRef.current = {
        maxImages: typeof props.maxImages === "number" ? props.maxImages : 1,
        resolve: props.resolveImage || (() => null),
        enterSends: props.enterSends,
        onChange: props.onChange,
        onSubmit: props.onSubmit,
        onImageFiles: props.onImageFiles,
        onFocus: props.onFocus,
        onBlur: props.onBlur,
    };
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;
    const ready = useCallback((api) => { if (onReadyRef.current) onReadyRef.current(api); }, []);

    const initialConfig = useMemo(() => ({
        // not the blog editor's: nothing copied there pastes its nodes here
        namespace: "PixagramComment",
        theme: THEME,
        nodes: [QuoteNode, ListNode, ListItemNode, CommentImageNode],
        editable: !disabled,
        onError: (error) => { console.error("[CommentVisualEditor]", error); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), []);
    const imageContext = useMemo(() => ({ resolve: (url) => configRef.current.resolve(url) }), []);
    const style = useMemo(() => ({ minHeight, maxHeight }), [minHeight, maxHeight]);

    return (
        <div style={WRAP_STYLE} onKeyDown={stopKeyLeak} onKeyUp={stopKeyLeak} onKeyPress={stopKeyLeak}>
            <LexicalComposer initialConfig={initialConfig}>
                <ImageContext.Provider value={imageContext}>
                    <RichTextPlugin
                        contentEditable={
                            <ContentEditable
                                className={className ? classes.editable + " " + className : classes.editable}
                                style={style}
                                ariaLabelledBy={labelledBy}
                                ariaDescribedBy={describedBy}
                                ariaMultiline={true}
                                spellCheck={true}
                            />
                        }
                        ErrorBoundary={LexicalErrorBoundary}
                    />
                    <HistoryPlugin />
                    <ListPlugin />
                    <EditablePlugin disabled={!!disabled} />
                    <ComposerPlugin configRef={configRef} onReady={ready} />
                </ImageContext.Provider>
            </LexicalComposer>
        </div>
    );
}

const WRAP_STYLE = { display: "block", width: "100%", minWidth: 0 };

const CommentVisualEditor = memo(withStyles(styles)(CommentVisualEditorInner));

export default CommentVisualEditor;
