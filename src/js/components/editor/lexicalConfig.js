import React from 'preact/compat';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext.js';
import {
    $createParagraphNode,
    $getRoot,
    $getSelection,
    $isRangeSelection,
    $isTextNode,
    COMMAND_PRIORITY_LOW,
    COMMAND_PRIORITY_NORMAL,
    KEY_DOWN_COMMAND,
    SELECTION_CHANGE_COMMAND,
    TextNode,
} from 'lexical';

// Enhanced markdown imports with table support
import { $convertMarkdownToNodes, IMAGE_TRANSFORMER } from '../../utils/lexical/stateFromMarkdown';
import { TRANSFORMERS } from '@lexical/markdown';

// Lexical nodes
import { HeadingNode, QuoteNode, $isHeadingNode, $isQuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode, $isListNode } from '@lexical/list';
import { CodeNode, CodeHighlightNode, $isCodeNode } from '@lexical/code';
import { LinkNode, AutoLinkNode, $isLinkNode } from '@lexical/link';
import * as LexicalSelectionModule from '@lexical/selection';
import { TableNode, TableRowNode, TableCellNode } from '@lexical/table';
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode.js';
import { ImageNode, $createImageNode } from '../../utils/lexical/ImageNode';

// Lexical theme - maps to CSS classes that match Draft.js visual output
export const lexicalTheme = {
    ltr: 'ltr',
    rtl: 'rtl',
    paragraph: 'public-DraftStyleDefault-block',
    quote: 'public-DraftStyleDefault-blockquote',
    heading: {
        h1: 'public-DraftStyleDefault-header-one',
        h2: 'public-DraftStyleDefault-header-two',
        h3: 'public-DraftStyleDefault-header-three',
        h4: 'public-DraftStyleDefault-header-four',
        h5: 'public-DraftStyleDefault-header-five',
        h6: 'public-DraftStyleDefault-header-six',
    },
    list: {
        nested: { listitem: 'public-DraftStyleDefault-depth0' },
        ol: 'public-DraftStyleDefault-ol',
        ul: 'public-DraftStyleDefault-ul',
        listitem: 'public-DraftStyleDefault-unorderedListItem',
    },
    link: 'lexical-link',
    image: 'lexical-image',
    text: {
        bold: 'lexical-bold',
        italic: 'lexical-italic',
        underline: 'lexical-underline',
        strikethrough: 'lexical-strikethrough',
        code: 'lexical-code',
    },
    code: 'public-DraftStyleDefault-pre',
    table: 'lexical-table',
    tableCell: 'lexical-table-cell',
    tableCellHeader: 'lexical-table-cell-header',
    tableRow: 'lexical-table-row',
};

// Lexical editor nodes
export const lexicalNodes = [
    HeadingNode,
    QuoteNode,
    ListNode,
    ListItemNode,
    CodeNode,
    CodeHighlightNode,
    LinkNode,
    AutoLinkNode,
    TableNode,
    TableRowNode,
    TableCellNode,
    ImageNode,
    // Already referenced by the markdown transformers but never registered:
    // creating an unregistered node throws inside $convertFromMarkdownString,
    // so any draft containing `---` fell into the plain-text fallback.
    HorizontalRuleNode,
];

// Transformer set shared by the MarkdownShortcutPlugin (so typing
// `![alt](url)` converts live in the visual editor) and by
// $convertToMarkdownString in the dialog (so ImageNodes serialize back to
// `![alt](url)` on autosave / mode switch / preview instead of vanishing).
export const EDITOR_TRANSFORMERS = [IMAGE_TRANSFORMER, ...TRANSFORMERS];

// Lexical Editor Ref Plugin - provides ref to parent
export function EditorRefPlugin({ editorRef }) {
    const [editor] = useLexicalComposerContext();
    React.useEffect(() => {
        if (editorRef) {
            editorRef.current = editor;
        }
    }, [editor, editorRef]);
    return null;
}

// Single shared path for loading markdown into the editor.
// Always clears the root first so draft loads replace instead of append.
export function loadMarkdownIntoEditor(editor, markdown) {
    editor.update(() => {
        const root = $getRoot();
        root.clear();
        if (markdown) {
            $convertMarkdownToNodes(markdown, { gfm: true, tables: true });
        }
        if (root.isEmpty()) {
            root.append($createParagraphNode());
        }
    });
}

// Lexical Keyboard Plugin: Ctrl/Cmd+S saves, Ctrl/Cmd+K opens the link dialog.
export function KeyboardPlugin({ onSave, onLink }) {
    const [editor] = useLexicalComposerContext();
    React.useEffect(() => {
        return editor.registerCommand(
            KEY_DOWN_COMMAND,
            (event) => {
                if (!(event.metaKey || event.ctrlKey)) return false;
                const key = event.key && event.key.toLowerCase();
                if (key === 's') {
                    event.preventDefault();
                    if (onSave) onSave();
                    return true;
                }
                if (key === 'k') {
                    event.preventDefault();
                    if (onLink) onLink();
                    return true;
                }
                return false;
            },
            COMMAND_PRIORITY_NORMAL
        );
    }, [editor, onSave, onLink]);
    return null;
}

// Live markdown → image conversion, everywhere text can appear.
// The MarkdownShortcutPlugin only converts as you TYPE the closing ')' —
// pasted markdown, and text edited into valid image syntax after the fact,
// stayed literal. This TextNode transform runs on every text change instead,
// so `![alt](url)` becomes an ImageNode no matter how it got into the
// document — but ONLY for https sources; anything else stays literal text.
// Code blocks (CodeHighlightNode is a different node type, plus the parent
// check), inline code, and link labels are exempt.
const HTTPS_IMAGE_MD_RE = /!\[([^\]]*)\]\((https:\/\/[^\s)]+)\)/i;

export function ImageAutoConvertPlugin() {
    const [editor] = useLexicalComposerContext();

    React.useEffect(() => {
        return editor.registerNodeTransform(TextNode, (node) => {
            if (node.hasFormat('code')) return;
            const parent = node.getParent();
            if ($isCodeNode(parent) || $isLinkNode(parent)) return;

            const text = node.getTextContent();
            const match = text.match(HTTPS_IMAGE_MD_RE);
            if (!match) return;

            const start = match.index || 0;
            const end = start + match[0].length;

            let target;
            if (start === 0 && end === text.length) {
                target = node;
            } else if (start === 0) {
                target = node.splitText(end)[0];
            } else {
                target = node.splitText(start, end)[1];
            }
            target.replace($createImageNode({ src: match[2], altText: match[1] }));
        });
    }, [editor]);

    return null;
}

// Version-proof AND instance-proof $setBlocksType.
//
// Two distinct failure modes of the official helper are covered:
//
// 1. Name drift across @lexical/selection releases
//    ($setBlocksType_experimental → $setBlocksType): a missing named
//    export is undefined, and calling it throws INSIDE editor.update —
//    swallowed by the composer's onError, so heading / quote buttons just
//    "do nothing". Resolved at runtime from the namespace instead.
//
// 2. Duplicate `lexical` module instances in the bundle (version-mismatched
//    @lexical/* packages, or a nested node_modules copy after an install):
//    @lexical/selection then runs against the OTHER copy's module state and
//    silently changes nothing — same dead buttons, no error, while typing
//    and inline formats still work. Reproduced 1:1 in a browser harness.
//    The helper's result is therefore VERIFIED after the call, and when the
//    blocks did not actually convert, a self-contained manual implementation
//    takes over. The manual path only touches methods on the selection and
//    node objects themselves (same instance as the live editor) plus the
//    caller's createElement, so it is immune to duplicated bundles.
//    (`npm ls lexical` exposes the duplication; aligning @lexical/* versions
//    and deduping remains the real cure — see note at call sites.)
export function $setBlocksTypeSafe(selection, createElement) {
    // Probe what createElement produces so results can be verified.
    // The probe node is never attached to the document.
    const probe = createElement();
    const wantType = typeof probe.getType === 'function' ? probe.getType() : '';
    const wantTag = typeof probe.getTag === 'function' ? probe.getTag() : null;
    const matches = (el) => Boolean(el)
        && typeof el.getType === 'function' && el.getType() === wantType
        && (wantTag === null || (typeof el.getTag === 'function' && el.getTag() === wantTag));

    // Top-level blocks covered by a selection (falls back to the anchor's
    // block for collapsed carets).
    const collectTargets = (sel) => {
        const seen = new Set();
        const targets = [];
        const collect = (node) => {
            if (!node || typeof node.getTopLevelElement !== 'function') return;
            const top = node.getTopLevelElement();
            if (!top || seen.has(top.getKey())) return;
            seen.add(top.getKey());
            targets.push(top);
        };
        sel.getNodes().forEach(collect);
        if (targets.length === 0) collect(sel.anchor.getNode());
        return targets;
    };

    // Containers whose wholesale replacement would destroy structure are
    // intentionally left alone by both paths.
    const isProtected = (type) =>
        type === 'list' || type === 'listitem' || type === 'table' || type === 'root';

    // ── 1) Official helper, when present ────────────────────────────────
    const impl = LexicalSelectionModule.$setBlocksType;
    if (typeof impl === 'function') {
        try {
            impl(selection, createElement);
        } catch (e) {
            // fall through to the manual path
        }
        // ── 2) Verify it took ───────────────────────────────────────────
        const after = $getSelection();
        const checkSelection = $isRangeSelection(after) ? after : selection;
        const done = collectTargets(checkSelection).every((el) => {
            const type = typeof el.getType === 'function' ? el.getType() : '';
            if (isProtected(type)) return true; // legitimately skipped
            return matches(el);
        });
        if (done) return;
    }

    // ── 3) Manual per-block conversion ──────────────────────────────────
    // Replace each selected top-level block with a fresh element, carrying
    // the children over (keys survive, so the selection does too).
    const anchorNode = selection.anchor && typeof selection.anchor.getNode === 'function'
        ? selection.anchor.getNode()
        : null;
    if (anchorNode && typeof anchorNode.getKey === 'function' && anchorNode.getKey() === 'root'
        && typeof anchorNode.getFirstChild === 'function' && !anchorNode.getFirstChild()) {
        // Empty editor with a root-level selection: nothing to replace.
        anchorNode.append(createElement());
        return;
    }

    collectTargets(selection).forEach((element) => {
        const type = typeof element.getType === 'function' ? element.getType() : '';
        if (isProtected(type)) return;
        if (matches(element)) return; // already the requested type
        if (typeof element.getChildren !== 'function' || typeof element.replace !== 'function') return;
        const replacement = createElement();
        if (typeof replacement.setFormat === 'function' && typeof element.getFormatType === 'function') {
            replacement.setFormat(element.getFormatType());
        }
        if (typeof replacement.setIndent === 'function' && typeof element.getIndent === 'function') {
            replacement.setIndent(element.getIndent());
        }
        element.getChildren().forEach((child) => replacement.append(child));
        element.replace(replacement);
    });
}

const TRACKED_FORMATS = ['bold', 'italic', 'underline', 'strikethrough', 'code'];

// Tracks active inline formats and block type for the toolbar.
// Listens to both selection changes (cursor moves) and content updates,
// and fires onStateChange only when something actually changed, so the
// parent re-renders on real toolbar transitions instead of every update.
export function ToolbarStatePlugin({ onStateChange }) {
    const [editor] = useLexicalComposerContext();
    const lastRef = React.useRef({ formats: {}, blockType: 'paragraph', hasSelection: false });

    React.useEffect(() => {
        const readToolbarState = () => {
            editor.getEditorState().read(() => {
                const selection = $getSelection();
                if (!$isRangeSelection(selection)) {
                    // Selection gone (blur / node selection): only the
                    // "has text selected" flag can meaningfully change here.
                    if (lastRef.current.hasSelection) {
                        lastRef.current = { ...lastRef.current, hasSelection: false };
                        onStateChange(lastRef.current.formats, lastRef.current.blockType, false);
                    }
                    return;
                }

                const formats = {};
                let changed = false;
                for (let i = 0; i < TRACKED_FORMATS.length; i++) {
                    const f = TRACKED_FORMATS[i];
                    formats[f] = selection.hasFormat(f);
                    if (formats[f] !== lastRef.current.formats[f]) changed = true;
                }

                let blockType = 'paragraph';
                const anchorNode = selection.anchor.getNode();
                const element = anchorNode.getKey() === 'root'
                    ? anchorNode
                    : anchorNode.getTopLevelElementOrThrow();
                if ($isHeadingNode(element)) blockType = element.getTag();
                else if ($isQuoteNode(element)) blockType = 'quote';
                else if ($isCodeNode(element)) blockType = 'code';
                else if ($isListNode(element)) blockType = element.getListType() === 'number' ? 'number' : 'bullet';
                if (blockType !== lastRef.current.blockType) changed = true;

                // "Real" selection = non-collapsed range covering at least
                // one text node (an image alone doesn't count as linkable).
                const hasSelection = !selection.isCollapsed() &&
                    selection.getNodes().some($isTextNode);
                if (hasSelection !== lastRef.current.hasSelection) changed = true;

                if (changed) {
                    lastRef.current = { formats, blockType, hasSelection };
                    onStateChange(formats, blockType, hasSelection);
                }
            });
        };

        const removeSelectionListener = editor.registerCommand(
            SELECTION_CHANGE_COMMAND,
            () => {
                readToolbarState();
                return false;
            },
            COMMAND_PRIORITY_LOW
        );
        const removeUpdateListener = editor.registerUpdateListener(readToolbarState);

        return () => {
            removeSelectionListener();
            removeUpdateListener();
        };
    }, [editor, onStateChange]);

    return null;
}

// Initialize editor with markdown content
export function InitializePlugin({ initialMarkdown, onInitialized }) {
    const [editor] = useLexicalComposerContext();
    // One-shot guard as a REF: the previous useState forced a second render
    // of the plugin and an extra effect pass just to remember "already done".
    // The flag is still set only AFTER a successful load, preserving the old
    // retry-on-throw behavior. Semantics are otherwise identical: this
    // initializes at most once per composer mount; later draft loads go
    // through loadMarkdownIntoEditor directly on the live editor.
    const initializedRef = React.useRef(false);

    React.useEffect(() => {
        if (initialMarkdown && !initializedRef.current) {
            loadMarkdownIntoEditor(editor, initialMarkdown);
            initializedRef.current = true;
            if (onInitialized) onInitialized();
        }
    }, [editor, initialMarkdown, onInitialized]);

    return null;
}