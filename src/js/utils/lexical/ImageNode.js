/**
 * ImageNode — inline Lexical decorator node for images referenced by URL.
 *
 * Rendered with plain DOM only: createDOM builds the <img> itself and
 * decorate() returns null (explicitly supported by Lexical — the reconciler
 * skips null decorators). This keeps the node independent of the
 * react/preact portal machinery, so it behaves identically under
 * preact/compat.
 *
 * getTextContent() intentionally returns the markdown form `![alt](src)`:
 * every plain-text projection (table-cell export in stateToMarkdown,
 * clipboard copy as text, any getTextContent()-based fallback) then
 * round-trips the image instead of dropping it.
 */

import { DecoratorNode, $createTextNode } from 'lexical';

/**
 * Single source of truth for "does this src get to render as an image?".
 * Only https sources render as actual <img> anywhere in the editor.
 * http still round-trips (kept as literal markdown text, see importDOM);
 * data:/blob:/javascript:/relative paths are refused outright.
 */
export function isRenderableImageSrc(src) {
    return typeof src === 'string' && /^https:\/\//i.test(src.trim());
}

export class ImageNode extends DecoratorNode {
    static getType() {
        return 'image';
    }

    static clone(node) {
        return new ImageNode(node.__src, node.__altText, node.__key);
    }

    static importJSON(serializedNode) {
        return $createImageNode({
            src: serializedNode.src,
            altText: serializedNode.altText,
        });
    }

    // Pasted HTML containing <img> becomes an ImageNode too — https only.
    static importDOM() {
        return {
            img: () => ({
                conversion: (domNode) => {
                    const src = domNode.getAttribute('src') || '';
                    if (!src) return null;
                    const altText = domNode.getAttribute('alt') || '';
                    if (isRenderableImageSrc(src)) {
                        return { node: $createImageNode({ src, altText }) };
                    }
                    // http: keep the reference as literal markdown so nothing
                    // is silently lost — it just doesn't render.
                    if (/^http:\/\//i.test(src.trim())) {
                        return { node: $createTextNode(`![${altText}](${src})`) };
                    }
                    // data:/blob:/anything else: drop.
                    return null;
                },
                priority: 0,
            }),
        };
    }

    constructor(src, altText = '', key) {
        super(key);
        this.__src = src;
        this.__altText = altText;
    }

    exportJSON() {
        return {
            type: 'image',
            version: 1,
            src: this.__src,
            altText: this.__altText,
        };
    }

    exportDOM() {
        const element = document.createElement('img');
        element.setAttribute('src', this.__src);
        element.setAttribute('alt', this.__altText);
        return { element };
    }

    createDOM(config) {
        const span = document.createElement('span');
        const className = config && config.theme && config.theme.image;
        span.className = className || 'lexical-image';
        const img = document.createElement('img');
        img.src = this.__src;
        img.alt = this.__altText;
        img.draggable = false;
        span.appendChild(img);
        return span;
    }

    updateDOM(prevNode, dom) {
        const img = dom.firstChild;
        if (img) {
            if (prevNode.__src !== this.__src) img.src = this.__src;
            if (prevNode.__altText !== this.__altText) img.alt = this.__altText;
        }
        return false; // keep the existing DOM
    }

    getSrc() {
        return this.__src;
    }

    getAltText() {
        return this.__altText;
    }

    setSrc(src) {
        const writable = this.getWritable();
        writable.__src = src;
    }

    setAltText(altText) {
        const writable = this.getWritable();
        writable.__altText = altText;
    }

    getTextContent() {
        return `![${this.__altText}](${this.__src})`;
    }

    isInline() {
        return true;
    }

    decorate() {
        return null; // DOM is built entirely in createDOM
    }
}

export function $createImageNode({ src, altText = '' } = {}) {
    return new ImageNode(src, altText);
}

export function $isImageNode(node) {
    return node instanceof ImageNode;
}
