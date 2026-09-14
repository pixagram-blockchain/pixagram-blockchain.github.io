/**
 * Convert Markdown to Lexical EditorState
 * Uses @lexical/markdown for parsing with custom table support
 */

import { $createParagraphNode, $createTextNode, $getRoot, $isTextNode, $isElementNode } from 'lexical';
import { $convertFromMarkdownString, TRANSFORMERS } from '@lexical/markdown';
import { HeadingNode, QuoteNode, $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode, $createListNode, $createListItemNode } from '@lexical/list';
import { CodeNode, CodeHighlightNode, $createCodeNode } from '@lexical/code';
import { LinkNode, $createLinkNode, $isLinkNode } from '@lexical/link';
import { TableNode, TableRowNode, TableCellNode, TableCellHeaderStates, $createTableNode, $createTableRowNode, $createTableCellNode } from '@lexical/table';
import { HorizontalRuleNode, $createHorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode.js';
import { ImageNode, $createImageNode, $isImageNode, isRenderableImageSrc } from './ImageNode';

// Extended transformers for GFM support
const HEADING_TRANSFORMER = {
    dependencies: [HeadingNode],
    export: (node, exportChildren) => {
        if (node.getType() !== 'heading') return null;
        const level = node.getTag().replace('h', '');
        return '#'.repeat(parseInt(level)) + ' ' + exportChildren(node);
    },
    regExp: /^(#{1,6})\s/,
    replace: (parentNode, children, match) => {
        const level = match[1].length;
        const tag = `h${level}`;
        const headingNode = $createHeadingNode(tag);
        if (children && children.length > 0) {
            headingNode.append(...children);
        }
        parentNode.replace(headingNode);
    },
    type: 'element',
};

const QUOTE_TRANSFORMER = {
    dependencies: [QuoteNode],
    export: (node, exportChildren) => {
        if (node.getType() !== 'quote') return null;
        return '> ' + exportChildren(node);
    },
    regExp: /^>\s/,
    replace: (parentNode, children) => {
        const quoteNode = $createQuoteNode();
        if (children && children.length > 0) {
            quoteNode.append(...children);
        }
        parentNode.replace(quoteNode);
    },
    type: 'element',
};

const UNORDERED_LIST_TRANSFORMER = {
    dependencies: [ListNode, ListItemNode],
    export: (node, exportChildren) => {
        if (node.getType() !== 'listitem') return null;
        const listNode = node.getParent();
        if (!listNode || listNode.getListType() !== 'bullet') return null;
        return '- ' + exportChildren(node);
    },
    regExp: /^[-*+]\s/,
    replace: (parentNode, children) => {
        const listItemNode = $createListItemNode();
        if (children && children.length > 0) {
            listItemNode.append(...children);
        }

        const prevSibling = parentNode.getPreviousSibling();
        if (prevSibling && prevSibling.getType() === 'list' && prevSibling.getListType() === 'bullet') {
            prevSibling.append(listItemNode);
            parentNode.remove();
        } else {
            const listNode = $createListNode('bullet');
            listNode.append(listItemNode);
            parentNode.replace(listNode);
        }
    },
    type: 'element',
};

const ORDERED_LIST_TRANSFORMER = {
    dependencies: [ListNode, ListItemNode],
    export: (node, exportChildren) => {
        if (node.getType() !== 'listitem') return null;
        const listNode = node.getParent();
        if (!listNode || listNode.getListType() !== 'number') return null;
        const index = listNode.getChildren().indexOf(node) + 1;
        return `${index}. ` + exportChildren(node);
    },
    regExp: /^\d+\.\s/,
    replace: (parentNode, children) => {
        const listItemNode = $createListItemNode();
        if (children && children.length > 0) {
            listItemNode.append(...children);
        }

        const prevSibling = parentNode.getPreviousSibling();
        if (prevSibling && prevSibling.getType() === 'list' && prevSibling.getListType() === 'number') {
            prevSibling.append(listItemNode);
            parentNode.remove();
        } else {
            const listNode = $createListNode('number');
            listNode.append(listItemNode);
            parentNode.replace(listNode);
        }
    },
    type: 'element',
};

const CODE_BLOCK_TRANSFORMER = {
    dependencies: [CodeNode, CodeHighlightNode],
    export: (node) => {
        if (node.getType() !== 'code') return null;
        const language = node.getLanguage() || '';
        return '```' + language + '\n' + node.getTextContent() + '\n```';
    },
    regExp: /^```(\w+)?/,
    replace: (parentNode, children, match) => {
        const codeNode = $createCodeNode(match ? match[1] : undefined);
        parentNode.replace(codeNode);
    },
    type: 'element',
};

const HORIZONTAL_RULE_TRANSFORMER = {
    dependencies: [HorizontalRuleNode],
    export: (node) => {
        if (node.getType() !== 'horizontalrule') return null;
        return '---';
    },
    regExp: /^(?:---|\*\*\*|___)$/,
    replace: (parentNode) => {
        const hrNode = $createHorizontalRuleNode();
        parentNode.replace(hrNode);
    },
    type: 'element',
};

// Inline transformers
const BOLD_TRANSFORMER = {
    format: ['bold'],
    tag: '**',
    type: 'text-format',
};

const ITALIC_TRANSFORMER = {
    format: ['italic'],
    tag: '_',
    type: 'text-format',
};

const STRIKETHROUGH_TRANSFORMER = {
    format: ['strikethrough'],
    tag: '~~',
    type: 'text-format',
};

const UNDERLINE_TRANSFORMER = {
    format: ['underline'],
    tag: '++',
    type: 'text-format',
};

const INLINE_CODE_TRANSFORMER = {
    format: ['code'],
    tag: '`',
    type: 'text-format',
};

const LINK_TRANSFORMER = {
    dependencies: [LinkNode],
    export: (node, exportChildren) => {
        if (node.getType() !== 'link') return null;
        const url = node.getURL();
        return `[${exportChildren(node)}](${url})`;
    },
    importRegExp: /\[([^\]]+)\]\(([^)]+)\)/,
    regExp: /\[([^\]]+)\]\(([^)]+)\)/,
    replace: (textNode, match) => {
        const [, text, url] = match;
        const linkNode = $createLinkNode(url);
        linkNode.append($createTextNode(text));
        textNode.replace(linkNode);
    },
    type: 'text-match',
};

// Image transformer. It MUST be ordered before every link transformer:
// text-match transformers are tried in array order (first match wins), and
// the link regexp also matches the `[alt](url)` inside `![alt](url)` — which
// is exactly how images used to import as a literal "!" followed by a link.
export const IMAGE_TRANSFORMER = {
    dependencies: [ImageNode],
    export: (node) => {
        if (!$isImageNode(node)) return null;
        return `![${node.getAltText()}](${node.getSrc()})`;
    },
    importRegExp: /!\[([^\]]*)\]\(([^)]+?)(?:\s+"[^"]*")?\)/,
    regExp: /!\[([^\]]*)\]\(([^)]+?)(?:\s+"[^"]*")?\)$/,
    // REQUIRED for the typing path: MarkdownShortcutPlugin indexes text-match
    // transformers by their trigger character. Without this, typing
    // `![alt](url)` in the visual editor never reaches this transformer and
    // the core link transformer (trigger ')') converts the inner part
    // instead — producing "!" + link as you type.
    trigger: ')',
    replace: (textNode, match) => {
        const [, altText, src] = match;
        // https-only: anything else stays literal text. On the typing path
        // the match still counts as handled, so the core link transformer
        // can't mangle it into "!" + link; on the import path the matched
        // segment is simply left as the text it already is.
        if (!isRenderableImageSrc(src)) return;
        textNode.replace($createImageNode({ src, altText }));
    },
    type: 'text-match',
};

// Extended transformers with GFM support
const GFM_TRANSFORMERS = [
    IMAGE_TRANSFORMER,
    HEADING_TRANSFORMER,
    QUOTE_TRANSFORMER,
    UNORDERED_LIST_TRANSFORMER,
    ORDERED_LIST_TRANSFORMER,
    CODE_BLOCK_TRANSFORMER,
    HORIZONTAL_RULE_TRANSFORMER,
    BOLD_TRANSFORMER,
    ITALIC_TRANSFORMER,
    STRIKETHROUGH_TRANSFORMER,
    UNDERLINE_TRANSFORMER,
    INLINE_CODE_TRANSFORMER,
    LINK_TRANSFORMER,
    ...TRANSFORMERS,
];

const defaultOptions = {
    gfm: true,
    tables: true,
    preserveNewlines: false
};

// ═══════════════════════════════════════════════════════════
// Tables
// ═══════════════════════════════════════════════════════════
//
// A GFM table is a multi-line block, and @lexical/markdown's transformers are
// line-oriented — none of them can consume "header line + delimiter line + n
// body lines" as one unit. So tables are lifted OUT of the markdown before
// $convertFromMarkdownString runs, replaced by a one-line placeholder, and
// spliced back in as real TableNodes afterwards. The matching export side
// lives in stateToMarkdown's TABLE_TRANSFORMER.

// One delimiter cell: at least one dash, optional leading/trailing colon.
const TABLE_DELIMITER_CELL_RE = /^:?-+:?$/;

// The placeholder carries no markdown-significant characters: the original
// `__TABLE_PLACEHOLDER_n__` had its outer `__` eaten as bold by the format
// transformers, so the replacement regexp below never matched and every table
// was silently dropped on import.
const TABLE_PLACEHOLDER_RE = /^%%TABLE-PLACEHOLDER-(\d+)%%$/;

/**
 * Split one table row into raw cell sources.
 *
 * Per GFM, `\|` is the ONLY way to put a pipe inside a cell — a pipe is a cell
 * boundary everywhere else, including inside code spans. Splitting on a plain
 * `|` (what this used to do) turned `| a \| b |` into two cells and left the
 * row wider than its header.
 */
function splitTableRow(line) {
    const cells = [];
    let current = '';

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '\\' && i + 1 < line.length) {
            const next = line[i + 1];
            // `\|` is a literal pipe; every other escape is left intact for
            // the inline parser below to deal with.
            current += next === '|' ? '|' : ch + next;
            i++;
            continue;
        }
        if (ch === '|') {
            cells.push(current);
            current = '';
            continue;
        }
        current += ch;
    }
    cells.push(current);

    // A leading/trailing pipe produces an empty outer field. Drop it, but only
    // when the row really did start/end with one.
    if (cells.length > 1 && cells[0].trim() === '' && /^[ \t]*\|/.test(line)) cells.shift();
    if (cells.length > 1 && cells[cells.length - 1].trim() === '' && /\|[ \t]*$/.test(line)) cells.pop();

    return cells.map(cell => cell.trim());
}

/**
 * Parse a delimiter line into per-column alignments, or null if the line is
 * not a delimiter row.
 */
function parseTableAlignments(line) {
    if (line.indexOf('|') === -1) return null;

    const cells = splitTableRow(line);
    if (cells.length === 0) return null;

    const alignments = [];
    for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (!TABLE_DELIMITER_CELL_RE.test(cell)) return null;
        const left = cell.charAt(0) === ':';
        const right = cell.charAt(cell.length - 1) === ':';
        alignments.push(left && right ? 'center' : right ? 'right' : left ? 'left' : '');
    }
    return alignments;
}

/**
 * Parse markdown table source into { headers, alignments, rows }.
 * Returns null when the source is not a table.
 */
function parseTable(markdown) {
    const lines = markdown.trim().split('\n');
    if (lines.length < 2) return null;

    const headers = splitTableRow(lines[0]);
    const alignments = parseTableAlignments(lines[1]);
    if (!alignments) return null;

    // GFM: the delimiter row MUST have the same number of cells as the header
    // row, otherwise it is not a table at all. Enforcing it here keeps the
    // editor's idea of "this is a table" identical to what marked/micromark
    // will render in the preview and on the published post.
    if (headers.length !== alignments.length) return null;

    const rows = lines.slice(2)
        .filter(line => line.trim() && line.indexOf('|') !== -1)
        .map(splitTableRow);

    return { headers, alignments, rows };
}

// ── Inline markdown inside cells ────────────────────────────────────────
// Cell contents never reach $convertFromMarkdownString (the whole table is a
// placeholder by then), so the inline syntax has to be parsed here or it stays
// literal — and then the exporter escapes it, turning `**bold**` into
// `\*\*bold\*\*` permanently. Block syntax is intentionally not supported:
// markdown tables can't carry it either.
const INLINE_RULES = [
    { re: /^!\[([^\]]*)\]\(([^()\s]+)(?:[ \t]+"[^"]*")?\)/, kind: 'image' },
    { re: /^\[([^\]]*)\]\(([^()\s]+)(?:[ \t]+"[^"]*")?\)/, kind: 'link' },
    { re: /^`([^`]+)`/,               kind: 'code' },
    { re: /^\*\*([\s\S]+?)\*\*/,      kind: 'bold' },
    { re: /^__([\s\S]+?)__/,          kind: 'bold' },
    { re: /^~~([\s\S]+?)~~/,          kind: 'strikethrough' },
    { re: /^\+\+([\s\S]+?)\+\+/,      kind: 'underline' },
    { re: /^\*([\s\S]+?)\*/,          kind: 'italic' },
    { re: /^_([\s\S]+?)_/,            kind: 'italic' },
];

function $createFormattedText(text, formats) {
    const node = $createTextNode(text);
    for (let i = 0; i < formats.length; i++) {
        node.toggleFormat(formats[i]);
    }
    return node;
}

function $parseInline(source, formats) {
    const nodes = [];
    let plain = '';

    const flush = () => {
        if (plain === '') return;
        nodes.push($createFormattedText(plain, formats));
        plain = '';
    };

    let rest = source;
    while (rest.length > 0) {
        // A backslash escape always wins over the rules below.
        if (rest.charAt(0) === '\\' && rest.length > 1) {
            plain += rest.charAt(1);
            rest = rest.slice(2);
            continue;
        }

        let matched = false;
        for (let i = 0; i < INLINE_RULES.length; i++) {
            const rule = INLINE_RULES[i];
            const match = rule.re.exec(rest);
            if (!match) continue;

            if (rule.kind === 'image') {
                // Non-https sources are never rendered anywhere in the app —
                // keep the syntax as literal text instead of a broken image.
                if (!isRenderableImageSrc(match[2])) break;
                flush();
                nodes.push($createImageNode({ src: match[2], altText: match[1] }));
            } else if (rule.kind === 'link') {
                flush();
                const link = $createLinkNode(match[2]);
                const children = $parseInline(match[1], formats);
                if (children.length === 0) children.push($createTextNode(match[2]));
                link.append(...children);
                nodes.push(link);
            } else if (rule.kind === 'code') {
                flush();
                // Code spans are literal: no nested parsing, no other format.
                nodes.push($createFormattedText(match[1], ['code']));
            } else {
                flush();
                const inner = formats.indexOf(rule.kind) === -1
                    ? formats.concat(rule.kind)
                    : formats;
                const children = $parseInline(match[1], inner);
                for (let c = 0; c < children.length; c++) nodes.push(children[c]);
            }

            rest = rest.slice(match[0].length);
            matched = true;
            break;
        }
        if (matched) continue;

        plain += rest.charAt(0);
        rest = rest.slice(1);
    }

    flush();
    return nodes;
}

/**
 * Build one table cell: a TableCellNode wrapping a ParagraphNode.
 *
 * The paragraph is not optional. A TableCellNode is a block container, and
 * appending a TextNode straight to it (what this used to do) leaves a tree
 * Lexical has to repair on its own — with no paragraph to hold the caret,
 * typing in an empty cell and selecting across cells misbehave.
 */
function $createCell(headerState, source, alignment) {
    const cell = $createTableCellNode(headerState);
    const paragraph = $createParagraphNode();

    if (alignment) {
        // Alignment is set on both: the paragraph is what actually renders it,
        // the cell is where the exporter looks first and what survives a cell
        // being emptied out.
        paragraph.setFormat(alignment);
        if (typeof cell.setFormat === 'function') cell.setFormat(alignment);
    }

    const children = $parseInline(source || '', []);
    for (let i = 0; i < children.length; i++) paragraph.append(children[i]);

    cell.append(paragraph);
    return cell;
}

/**
 * Create a Lexical table node from parsed table data
 */
function createTableNode(tableData) {
    const { headers, alignments, rows } = tableData;

    // TableCellHeaderStates.ROW is what makes a cell render as <th>. The
    // literal `1` this used to pass happens to be that value, but only by
    // coincidence of the enum's current ordering.
    const HEADER = (TableCellHeaderStates && TableCellHeaderStates.ROW) || 1;
    const BODY = (TableCellHeaderStates && TableCellHeaderStates.NO_STATUS) || 0;

    const columns = headers.length;
    const tableNode = $createTableNode();

    const headerRow = $createTableRowNode();
    for (let c = 0; c < columns; c++) {
        headerRow.append($createCell(HEADER, headers[c], alignments[c]));
    }
    tableNode.append(headerRow);

    for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        const rowNode = $createTableRowNode();
        // Pad short rows and drop surplus cells: Lexical's table model assumes
        // a rectangular grid, and a ragged one breaks cell selection and
        // column resizing.
        for (let c = 0; c < columns; c++) {
            rowNode.append($createCell(BODY, c < row.length ? row[c] : '', alignments[c]));
        }
        tableNode.append(rowNode);
    }

    return tableNode;
}

/**
 * Pre-process markdown to extract tables before conversion
 */
function preprocessMarkdown(markdown, options) {
    if (!options.tables) {
        return { markdown, tables: [] };
    }

    const tables = [];
    const lines = markdown.split('\n');
    const result = [];
    let i = 0;
    let fence = null;

    while (i < lines.length) {
        const line = lines[i];
        const fenceMatch = /^[ \t]{0,3}(`{3,}|~{3,})/.exec(line);

        // Inside a fenced code block nothing is a table — a ``` block showing
        // markdown table syntax used to be eaten and turned into a real table.
        if (fence !== null) {
            result.push(line);
            if (fenceMatch && fenceMatch[1].charAt(0) === fence.charAt(0) && fenceMatch[1].length >= fence.length) {
                fence = null;
            }
            i++;
            continue;
        }
        if (fenceMatch) {
            fence = fenceMatch[1];
            result.push(line);
            i++;
            continue;
        }

        if (line.indexOf('|') !== -1 && i + 1 < lines.length && parseTableAlignments(lines[i + 1]) !== null) {
            const tableLines = [line, lines[i + 1]];
            i += 2;

            while (i < lines.length && lines[i].trim() && lines[i].indexOf('|') !== -1) {
                tableLines.push(lines[i]);
                i++;
            }

            const tableData = parseTable(tableLines.join('\n'));

            if (tableData) {
                // The placeholder has to end up in a paragraph of its own, or
                // it is swallowed by the preceding one and the table never
                // comes back. Exactly one blank line on each side — adding a
                // second on every load would make them accumulate.
                if (result.length > 0 && result[result.length - 1].trim() !== '') result.push('');
                result.push('%%TABLE-PLACEHOLDER-' + tables.length + '%%');
                if (i < lines.length && lines[i].trim() !== '') result.push('');
                tables.push(tableData);
            } else {
                for (let k = 0; k < tableLines.length; k++) result.push(tableLines[k]);
            }
        } else {
            result.push(line);
            i++;
        }
    }

    return {
        markdown: result.join('\n'),
        tables
    };
}

/**
 * Swap the placeholder paragraphs back for real TableNodes.
 * Must be called within an editor.update() callback.
 */
function $restoreTables(tables) {
    const root = $getRoot();
    const children = root.getChildren();

    for (let i = 0; i < children.length; i++) {
        const node = children[i];
        if (typeof node.getTextContent !== 'function') continue;

        const match = TABLE_PLACEHOLDER_RE.exec(node.getTextContent().trim());
        if (!match) continue;

        const tableData = tables[parseInt(match[1], 10)];
        if (!tableData) continue;

        node.replace(createTableNode(tableData));
    }

    // A table as the last block leaves nowhere to put the caret after it, so
    // the user can't type past the table without reaching for markdown mode.
    const last = root.getLastChild();
    if (last && last.getType() === 'table') {
        root.append($createParagraphNode());
    }
}

/**
 * Post-import normalization for images — defense in depth that works
 * regardless of which @lexical/markdown version is installed and of
 * transformer ordering quirks:
 *   1. Any raw `![alt](url)` still sitting in a text node becomes an
 *      ImageNode. This also covers table cells, which the table parser
 *      fills with plain text nodes.
 *   2. A text node ending in `!` immediately followed by a LinkNode is the
 *      signature of the old "!" + link mangling (and per CommonMark that
 *      adjacency IS an image) — the pair is merged into an ImageNode. This
 *      heals drafts and content produced before the fix.
 * Must be called within an editor.update() callback.
 */
const RAW_IMAGE_RE = /!\[([^\]]*)\]\(([^)]+?)(?:\s+"[^"]*")?\)/;

function $collectTextNodes(node, out) {
    if ($isTextNode(node)) {
        out.push(node);
        return;
    }
    if ($isElementNode(node)) {
        const children = node.getChildren();
        for (let i = 0; i < children.length; i++) {
            $collectTextNodes(children[i], out);
        }
    }
}

function $convertRawImageSyntax(startNode) {
    let node = startNode;
    let searchFrom = 0;
    while (node && node.isAttached()) {
        const text = node.getTextContent();
        const match = text.slice(searchFrom).match(RAW_IMAGE_RE);
        if (!match) return;

        const start = searchFrom + (match.index || 0);
        const end = start + match[0].length;

        // https-only: leave non-https syntax literal and keep scanning the
        // same node past it (no pointless splitText fragmentation).
        if (!isRenderableImageSrc(match[2])) {
            searchFrom = end;
            continue;
        }

        let target;
        let tail = null;

        if (start === 0) {
            const parts = node.splitText(end);
            target = parts[0];
            tail = parts[1] || null;
        } else {
            const parts = node.splitText(start, end);
            target = parts[1];
            tail = parts[2] || null;
        }

        target.replace($createImageNode({ src: match[2], altText: match[1] }));
        node = tail; // keep scanning the remainder of the original text
        searchFrom = 0;
    }
}

function $mergeBangLinkPairs(element) {
    if (!$isElementNode(element)) return;

    const children = element.getChildren();
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if ($isElementNode(child) && !$isLinkNode(child)) {
            $mergeBangLinkPairs(child);
        }
    }

    let node = element.getFirstChild();
    while (node) {
        const next = node.getNextSibling();
        if ($isTextNode(node) && $isLinkNode(next) && node.getTextContent().endsWith('!')) {
            const url = next.getURL();
            const alt = next.getTextContent();
            // https pairs heal into a real image; anything else collapses
            // back into the literal `![alt](url)` text it came from, so the
            // markdown round-trips but never renders.
            const replacement = isRenderableImageSrc(url)
                ? $createImageNode({ src: url, altText: alt })
                : $createTextNode(`![${alt}](${url})`);
            next.replace(replacement);

            const text = node.getTextContent();
            if (text === '!') {
                node.remove();
            } else {
                node.setTextContent(text.slice(0, -1));
            }
            node = replacement.getNextSibling();
            continue;
        }
        node = next;
    }
}

export function $normalizeImageNodes() {
    const root = $getRoot();
    const textNodes = [];
    $collectTextNodes(root, textNodes);
    for (let i = 0; i < textNodes.length; i++) {
        $convertRawImageSyntax(textNodes[i]);
    }
    $mergeBangLinkPairs(root);
}

/**
 * Main function to convert markdown string to Lexical nodes
 * This should be called within an editor.update() callback
 */
export function $convertMarkdownToNodes(markdown, options = {}) {
    const opts = { ...defaultOptions, ...options };

    if (!markdown || markdown.trim() === '') {
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        root.append(paragraph);
        return;
    }

    // Pre-process to handle tables
    const { markdown: processedMarkdown, tables } = preprocessMarkdown(markdown, opts);

    // Use Lexical's built-in markdown conversion
    const transformers = opts.gfm ? GFM_TRANSFORMERS : TRANSFORMERS;

    try {
        $convertFromMarkdownString(processedMarkdown, transformers);
    } catch (error) {
        console.error('Markdown conversion error:', error);
        // Fallback: create plain text
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode(markdown));
        root.append(paragraph);
        return;
    }

    // Replace table placeholders with actual table nodes
    if (tables.length > 0) {
        $restoreTables(tables);
    }

    // Guarantee image nodes no matter how the installed @lexical/markdown
    // arbitrated the text-match transformers, and heal "!" + link trees
    // produced before the image transformer existed. Also converts image
    // syntax inside table cells (parsed as plain text above).
    try {
        $normalizeImageNodes();
    } catch (error) {
        console.error('Image normalization error:', error);
    }
}

/**
 * Legacy function for compatibility - converts markdown and returns nothing
 * Must be used within editor.update() callback
 */
export default function stateFromMarkdown(markdown, options = {}) {
    $convertMarkdownToNodes(markdown, options);
}

export { stateFromMarkdown, parseTable, createTableNode };