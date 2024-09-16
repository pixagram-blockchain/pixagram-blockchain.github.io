/**
 * Convert Lexical EditorState to Markdown
 * Uses @lexical/markdown with custom extensions for full GFM support
 */

import { $getRoot, $isTextNode, $isElementNode, $isParagraphNode } from 'lexical';
import { $convertToMarkdownString, TRANSFORMERS } from '@lexical/markdown';
import { $isHeadingNode, $isQuoteNode } from '@lexical/rich-text';
import { $isListNode, $isListItemNode } from '@lexical/list';
import { $isCodeNode } from '@lexical/code';
import { $isLinkNode } from '@lexical/link';
import { $isTableNode, $isTableRowNode, $isTableCellNode } from '@lexical/table';
import { $isHorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode.js';
import { $isImageNode } from './ImageNode';

const defaultOptions = {
    gfm: true,
    tables: true
};

// Custom transformer for headings
const HEADING_EXPORT = {
    dependencies: [],
    export: (node, exportChildren) => {
        if (!$isHeadingNode(node)) return null;
        const tag = node.getTag();
        const level = parseInt(tag.replace('h', ''));
        const prefix = '#'.repeat(level);
        return prefix + ' ' + exportChildren(node);
    },
    regExp: /^(#{1,6})\s/,
    replace: () => {},
    type: 'element',
};

// Custom transformer for blockquotes
const QUOTE_EXPORT = {
    dependencies: [],
    export: (node, exportChildren) => {
        if (!$isQuoteNode(node)) return null;
        return '> ' + exportChildren(node);
    },
    regExp: /^>\s/,
    replace: () => {},
    type: 'element',
};

// Custom transformer for unordered lists
const UNORDERED_LIST_EXPORT = {
    dependencies: [],
    export: (node, exportChildren, exportFormat) => {
        if (!$isListItemNode(node)) return null;
        const parent = node.getParent();
        if (!parent || !$isListNode(parent) || parent.getListType() !== 'bullet') {
            return null;
        }

        const depth = getListDepth(node);
        const indent = '  '.repeat(depth);
        return indent + '- ' + exportChildren(node);
    },
    regExp: /^[-*+]\s/,
    replace: () => {},
    type: 'element',
};

// Custom transformer for ordered lists
const ORDERED_LIST_EXPORT = {
    dependencies: [],
    export: (node, exportChildren) => {
        if (!$isListItemNode(node)) return null;
        const parent = node.getParent();
        if (!parent || !$isListNode(parent) || parent.getListType() !== 'number') {
            return null;
        }

        const depth = getListDepth(node);
        const indent = '  '.repeat(depth);
        const siblings = parent.getChildren();
        const index = siblings.indexOf(node) + 1;
        return indent + `${index}. ` + exportChildren(node);
    },
    regExp: /^\d+\.\s/,
    replace: () => {},
    type: 'element',
};

// Custom transformer for code blocks
const CODE_BLOCK_EXPORT = {
    dependencies: [],
    export: (node) => {
        if (!$isCodeNode(node)) return null;
        const language = node.getLanguage() || '';
        const code = node.getTextContent();
        return '```' + language + '\n' + code + '\n```';
    },
    regExp: /^```(\w+)?/,
    replace: () => {},
    type: 'element',
};

// Custom transformer for horizontal rules
const HR_EXPORT = {
    dependencies: [],
    export: (node) => {
        if (!$isHorizontalRuleNode(node)) return null;
        return '---';
    },
    regExp: /^---$/,
    replace: () => {},
    type: 'element',
};

// Custom transformer for links
const LINK_EXPORT = {
    dependencies: [],
    export: (node, exportChildren) => {
        if (!$isLinkNode(node)) return null;
        const url = node.getURL();
        const text = exportChildren(node);
        return `[${text}](${url})`;
    },
    importRegExp: /\[([^\]]+)\]\(([^)]+)\)/,
    regExp: /\[([^\]]+)\]\(([^)]+)\)/,
    replace: () => {},
    type: 'text-match',
};

// Custom transformer for images
const IMAGE_EXPORT = {
    dependencies: [],
    export: (node) => {
        if (!$isImageNode(node)) return null;
        return `![${node.getAltText()}](${node.getSrc()})`;
    },
    importRegExp: /!\[([^\]]*)\]\(([^)]+)\)/,
    regExp: /!\[([^\]]*)\]\(([^)]+)\)/,
    replace: () => {},
    type: 'text-match',
};

// Inline style transformers
const BOLD_EXPORT = {
    format: ['bold'],
    tag: '**',
    type: 'text-format',
};

const ITALIC_EXPORT = {
    format: ['italic'],
    tag: '_',
    type: 'text-format',
};

const STRIKETHROUGH_EXPORT = {
    format: ['strikethrough'],
    tag: '~~',
    type: 'text-format',
};

const UNDERLINE_EXPORT = {
    format: ['underline'],
    tag: '++',
    type: 'text-format',
};

const INLINE_CODE_EXPORT = {
    format: ['code'],
    tag: '`',
    type: 'text-format',
};

// Get list depth for proper indentation
function getListDepth(node) {
    let depth = 0;
    let parent = node.getParent();

    while (parent) {
        if ($isListNode(parent)) {
            depth++;
        }
        parent = parent.getParent();
    }

    return Math.max(0, depth - 1);
}

// Extended transformers for GFM
const GFM_EXPORT_TRANSFORMERS = [
    IMAGE_EXPORT,
    HEADING_EXPORT,
    QUOTE_EXPORT,
    UNORDERED_LIST_EXPORT,
    ORDERED_LIST_EXPORT,
    CODE_BLOCK_EXPORT,
    HR_EXPORT,
    LINK_EXPORT,
    BOLD_EXPORT,
    ITALIC_EXPORT,
    STRIKETHROUGH_EXPORT,
    UNDERLINE_EXPORT,
    INLINE_CODE_EXPORT,
    ...TRANSFORMERS,
];

/**
 * Convert a table node to markdown string
 */
function exportTableToMarkdown(node) {
    if (!$isTableNode(node)) return '';

    const rows = node.getChildren().filter($isTableRowNode);
    if (rows.length === 0) return '';

    const lines = [];

    // Process header row (first row)
    const headerRow = rows[0];
    const headerCells = headerRow.getChildren().filter($isTableCellNode);
    const headers = headerCells.map(cell => {
        const text = cell.getTextContent().trim();
        return text || ' ';
    });

    if (headers.length === 0) return '';

    lines.push('| ' + headers.join(' | ') + ' |');

    // Generate separator
    const separators = headers.map(() => '---');
    lines.push('| ' + separators.join(' | ') + ' |');

    // Process body rows
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const cells = row.getChildren().filter($isTableCellNode);
        const cellTexts = cells.map(cell => {
            const text = cell.getTextContent().trim();
            return text || ' ';
        });

        // Pad with empty cells if necessary
        while (cellTexts.length < headers.length) {
            cellTexts.push(' ');
        }

        lines.push('| ' + cellTexts.join(' | ') + ' |');
    }

    return lines.join('\n');
}

/**
 * Custom markdown generator class for complex documents
 */
class MarkdownGenerator {
    constructor(options = {}) {
        this.options = { ...defaultOptions, ...options };
        this.output = [];
    }

    /**
     * Generate markdown from root node
     * Must be called within editor.read() or editor.update()
     */
    generate() {
        const root = $getRoot();
        const children = root.getChildren();

        for (let i = 0; i < children.length; i++) {
            const node = children[i];
            const markdown = this.processNode(node);
            if (markdown !== null) {
                this.output.push(markdown);
            }
        }

        return this.output.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
    }

    processNode(node) {
        // Handle tables specially
        if ($isTableNode(node)) {
            return this.options.tables ? exportTableToMarkdown(node) : null;
        }

        // Handle headings
        if ($isHeadingNode(node)) {
            const tag = node.getTag();
            const level = parseInt(tag.replace('h', ''));
            const prefix = '#'.repeat(level);
            return prefix + ' ' + this.getNodeText(node);
        }

        // Handle blockquotes
        if ($isQuoteNode(node)) {
            return '> ' + this.getNodeText(node);
        }

        // Handle lists
        if ($isListNode(node)) {
            return this.processListNode(node, 0);
        }

        // Handle code blocks
        if ($isCodeNode(node)) {
            const language = node.getLanguage() || '';
            const code = node.getTextContent();
            return '```' + language + '\n' + code + '\n```';
        }

        // Handle horizontal rules
        if ($isHorizontalRuleNode(node)) {
            return '---';
        }

        // Handle images (decorator leaf node — neither Element nor Text)
        if ($isImageNode(node)) {
            return `![${node.getAltText()}](${node.getSrc()})`;
        }

        // Handle paragraphs and other element nodes
        if ($isElementNode(node)) {
            const text = this.getNodeText(node);
            return text || '';
        }

        // Handle text nodes directly (shouldn't normally happen at root level)
        if ($isTextNode(node)) {
            return this.formatTextNode(node);
        }

        return null;
    }

    processListNode(listNode, depth) {
        const listType = listNode.getListType();
        const items = listNode.getChildren().filter($isListItemNode);
        const indent = '  '.repeat(depth);
        const lines = [];

        items.forEach((item, index) => {
            const prefix = listType === 'number' ? `${index + 1}. ` : '- ';
            const itemContent = [];

            item.getChildren().forEach(child => {
                if ($isListNode(child)) {
                    // Nested list
                    itemContent.push('\n' + this.processListNode(child, depth + 1));
                } else {
                    itemContent.push(this.getNodeText(child));
                }
            });

            lines.push(indent + prefix + itemContent.join(''));
        });

        return lines.join('\n');
    }

    getNodeText(node) {
        if ($isTextNode(node)) {
            return this.formatTextNode(node);
        }

        if ($isImageNode(node)) {
            return `![${node.getAltText()}](${node.getSrc()})`;
        }

        if ($isLinkNode(node)) {
            const url = node.getURL();
            const text = this.getChildrenText(node);
            return `[${text}](${url})`;
        }

        if ($isElementNode(node)) {
            return this.getChildrenText(node);
        }

        return node.getTextContent();
    }

    getChildrenText(node) {
        if (!$isElementNode(node)) {
            return node.getTextContent();
        }

        const children = node.getChildren();
        return children.map(child => this.getNodeText(child)).join('');
    }

    formatTextNode(node) {
        if (!$isTextNode(node)) {
            return node.getTextContent();
        }

        let text = node.getTextContent();

        // Escape special markdown characters in plain text
        text = text.replace(/([*_`~\\])/g, '\\$1');

        const format = node.getFormat();

        // Apply formatting in correct order
        if (format & 16) { // code
            return '`' + node.getTextContent() + '`';
        }

        if (format & 1) { // bold
            text = `**${text}**`;
        }

        if (format & 2) { // italic
            text = `_${text}_`;
        }

        if (format & 4) { // strikethrough
            text = `~~${text}~~`;
        }

        if (format & 8) { // underline
            text = `++${text}++`;
        }

        return text;
    }
}

/**
 * Convert Lexical editor state to markdown string
 * Must be called within editor.read() or editor.getEditorState().read()
 */
export function $convertToMarkdown(options = {}) {
    const generator = new MarkdownGenerator(options);
    return generator.generate();
}

/**
 * Simple conversion using Lexical's built-in converter
 * Must be called within editor.read() callback
 */
export function $simpleConvertToMarkdown(options = {}) {
    const opts = { ...defaultOptions, ...options };
    const transformers = opts.gfm ? GFM_EXPORT_TRANSFORMERS : TRANSFORMERS;

    try {
        return $convertToMarkdownString(transformers);
    } catch (error) {
        console.error('Markdown export error:', error);
        // Fallback to custom generator
        return $convertToMarkdown(opts);
    }
}

/**
 * Legacy function signature for compatibility
 * Takes a callback that should be called within editor.read()
 *
 * @param {LexicalEditor} editor - The Lexical editor instance
 * @param {Object} options - Conversion options
 * @returns {string} Markdown string
 */
export default function stateToMarkdown(editor, options = {}) {
    let markdown = '';

    editor.getEditorState().read(() => {
        markdown = $convertToMarkdown(options);
    });

    return markdown;
}

export {
    stateToMarkdown,
    exportTableToMarkdown,
    MarkdownGenerator,
    GFM_EXPORT_TRANSFORMERS
};