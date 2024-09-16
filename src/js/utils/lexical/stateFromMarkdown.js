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
import { TableNode, TableRowNode, TableCellNode, $createTableNode, $createTableRowNode, $createTableCellNode } from '@lexical/table';
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

/**
 * Parse markdown table and create Lexical table nodes
 */
function parseTable(markdown) {
    const lines = markdown.trim().split('\n');
    if (lines.length < 3) return null;

    const headerLine = lines[0];
    const separatorLine = lines[1];

    if (!headerLine.includes('|') || !separatorLine.includes('|')) {
        return null;
    }

    if (!/[-:]/.test(separatorLine)) {
        return null;
    }

    const headers = headerLine
        .replace(/^\||\|$/g, '')
        .split('|')
        .map(h => h.trim());

    const alignments = separatorLine
        .replace(/^\||\|$/g, '')
        .split('|')
        .map(sep => {
            const trimmed = sep.trim();
            if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
            if (trimmed.endsWith(':')) return 'right';
            return 'left';
        });

    const bodyLines = lines.slice(2);
    const rows = bodyLines
        .filter(line => line.trim() && line.includes('|'))
        .map(line =>
            line
                .replace(/^\||\|$/g, '')
                .split('|')
                .map(cell => cell.trim())
        );

    return { headers, alignments, rows };
}

/**
 * Create a Lexical table node from parsed table data
 */
function createTableNode(tableData) {
    const { headers, alignments, rows } = tableData;

    const tableNode = $createTableNode();

    // Create header row
    const headerRow = $createTableRowNode();
    headers.forEach((header, idx) => {
        const cell = $createTableCellNode(1); // 1 = header
        cell.append($createTextNode(header));
        headerRow.append(cell);
    });
    tableNode.append(headerRow);

    // Create body rows
    rows.forEach(row => {
        const rowNode = $createTableRowNode();
        row.forEach((cellText, idx) => {
            const cell = $createTableCellNode(0); // 0 = body
            cell.append($createTextNode(cellText));
            rowNode.append(cell);
        });
        tableNode.append(rowNode);
    });

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
    let result = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // Check for table start
        if (line.includes('|') && i + 1 < lines.length && lines[i + 1].includes('|') && /[-:]/.test(lines[i + 1])) {
            // Collect all table lines
            const tableLines = [line, lines[i + 1]];
            i += 2;

            while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
                tableLines.push(lines[i]);
                i++;
            }

            const tableMarkdown = tableLines.join('\n');
            const tableData = parseTable(tableMarkdown);

            if (tableData) {
                // No markdown-significant characters in the placeholder: the
                // previous `__TABLE_PLACEHOLDER_n__` had its outer `__`
                // consumed as bold by the format transformers, so the
                // replacement regex below never matched and tables were
                // silently dropped on import.
                const placeholder = `%%TABLE-PLACEHOLDER-${tables.length}%%`;
                tables.push(tableData);
                result.push(placeholder);
            } else {
                result.push(...tableLines);
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
        const root = $getRoot();
        const children = root.getChildren();

        children.forEach(node => {
            if (node.getType() === 'paragraph') {
                const text = node.getTextContent();
                const match = text.match(/%%TABLE-PLACEHOLDER-(\d+)%%/);
                if (match) {
                    const tableIndex = parseInt(match[1]);
                    const tableData = tables[tableIndex];
                    if (tableData) {
                        const tableNode = createTableNode(tableData);
                        node.replace(tableNode);
                    }
                }
            }
        });
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