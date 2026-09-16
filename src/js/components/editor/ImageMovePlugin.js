import React from 'preact/compat';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext.js';
import { $isCodeNode } from '@lexical/code';
import {
    $createParagraphNode,
    $createRangeSelection,
    $getNearestNodeFromDOMNode,
    $getNodeByKey,
    $insertNodes,
    $isDecoratorNode,
    $isElementNode,
    $isLineBreakNode,
    $isRootNode,
    $isTextNode,
    $setSelection,
    COMMAND_PRIORITY_HIGH,
    COMMAND_PRIORITY_LOW,
    DRAGEND_COMMAND,
    DRAGOVER_COMMAND,
    DRAGSTART_COMMAND,
    DROP_COMMAND,
} from 'lexical';

import { $createImageNode, $isImageNode, isRenderableImageSrc } from '../../utils/ImageNode';

/**
 * ImageMovePlugin — drag an image that is already in the post to a new
 * position in the visual editor. (The <img> itself is draggable, see
 * ImageNode.createDOM; this plugin is what makes the drag do something.)
 *
 * Why the browser can't be left to it: a native contenteditable drag of an
 * <img> is a copy at best — Lexical routes the drop through its paste
 * pipeline and only removes the source for drags it marked itself, which
 * are text selections, never a bare element drag. Worse, Chrome attaches an
 * implicit image File to every <img> drag, and @lexical/rich-text's DROP
 * handler forwards any files to DRAG_DROP_PASTE: ImageDropPlugin would then
 * re-upload the very same picture to Arweave. That trap is why images used
 * to be `draggable = false` — and immovable.
 *
 * Three HIGH-priority command handlers run ahead of rich-text's EDITOR ones:
 *
 *   DRAGSTART  the drag target resolves to an ImageNode → stamp the
 *              DataTransfer with IMAGE_MOVE_MIME ({editorKey, key, src,
 *              altText}) plus a text/plain markdown reference, swap the
 *              ghost for a capped thumbnail, dim the source.
 *   DRAGOVER   ours (IMAGE_MOVE_MIME listed in `types` — getData() is empty
 *              during dragover) → resolve the drop target under the pointer.
 *              Over a usable spot in text the event is deliberately left
 *              uncancelled: an uncancelled dragover over an editing host
 *              makes the browser draw its native insertion caret, and that
 *              caret is the drop indicator. Cancelling switches the browser
 *              to "the page handles this drop" (no caret), which is used
 *              only to refuse a spot (dropEffect 'none': no-drop cursor, no
 *              drop event) or to claim a decorator — non-editable to the
 *              browser, so it shows no caret there and fires no drop unless
 *              the page asks; a side mark on the decorator (is-drop-before /
 *              -after / -above / -below, styled in EditorSection) stands in
 *              for the caret.
 *   DROP       ours → preventDefault + return true unconditionally, so
 *              neither the native move nor rich-text's file/paste fallbacks
 *              run; then detach the node and re-insert it at the resolved
 *              point in the same update — one history entry, so Ctrl+Z puts
 *              the image back.
 *
 * ImageDropPlugin's file-drag overlay checks IMAGE_MOVE_MIME to stay out of
 * the way (Chrome lists 'Files' for element drags too).
 *
 * Drop targets: any block that holds inline content — paragraph, heading,
 * quote, list item, a paragraph inside a table cell — including the middle
 * of a text run, which is split around the image. A point inside a link
 * lands beside the link (an image inside a link would export as a linked
 * image). A point on the root (between blocks) gets a paragraph of its own.
 * Structural elements (table, row, list) resolve down to the block at the
 * caret; a code block or an empty structural element is refused, and so is
 * the dragged image's own slot.
 */

/** DataTransfer type marking "an ImageNode of this page being moved". */
export const IMAGE_MOVE_MIME = 'application/x-pixagram-image-move';

// Class toggled on the source ImageNode's DOM (the .lexical-image span)
// for the duration of the drag; EditorSection styles it.
const DRAGGING_CLASS = 'is-dragging';

// Classes toggled on the decorator under the pointer to show which side of
// it the drop would land on (inline: left/right, block: top/bottom).
const DROP_BEFORE_CLASS = 'is-drop-before';
const DROP_AFTER_CLASS = 'is-drop-after';
const DROP_ABOVE_CLASS = 'is-drop-above';
const DROP_BELOW_CLASS = 'is-drop-below';

// Longest side of the drag ghost. The browser's default ghost is the <img>
// at its rendered size, which for a wide picture covers the very text you
// are aiming at.
const GHOST_MAX_PX = 160;

// ── DOM helpers ──────────────────────────────────────────────────────────

/** Caret under a viewport point, as { node, offset } — null off-document. */
function caretFromPoint(x, y) {
    if (typeof document.caretRangeFromPoint === 'function') {
        const range = document.caretRangeFromPoint(x, y);
        return range ? { node: range.startContainer, offset: range.startOffset } : null;
    }
    if (typeof document.caretPositionFromPoint === 'function') {
        const position = document.caretPositionFromPoint(x, y);
        return position ? { node: position.offsetNode, offset: position.offset } : null;
    }
    return null;
}

/** True when the DataTransfer was stamped by $onDragStart (readable mid-drag). */
function isImageMoveDrag(dataTransfer) {
    const types = dataTransfer && dataTransfer.types;
    return Boolean(types) && Array.prototype.indexOf.call(types, IMAGE_MOVE_MIME) !== -1;
}

/** The {editorKey, key, src, altText} payload — readable on drop only. */
function readMovePayload(dataTransfer) {
    let raw = '';
    try {
        raw = dataTransfer.getData(IMAGE_MOVE_MIME);
    } catch (e) {
        return null;
    }
    if (!raw) return null;
    try {
        const payload = JSON.parse(raw);
        return payload && typeof payload === 'object' ? payload : null;
    } catch (e) {
        return null;
    }
}

function setDragGhost(dataTransfer, img) {
    if (!img || typeof dataTransfer.setDragImage !== 'function') return;
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (!width || !height) return; // not decoded yet: keep the browser's default ghost

    const scale = Math.min(1, GHOST_MAX_PX / Math.max(width, height));
    const ghost = document.createElement('img');
    ghost.src = img.currentSrc || img.src;
    ghost.width = Math.max(1, Math.round(width * scale));
    ghost.height = Math.max(1, Math.round(height * scale));
    // Must be in the document to be rendered as a ghost; off-screen is fine.
    ghost.style.cssText = 'position:fixed;top:-10000px;left:-10000px;border-radius:12px;pointer-events:none;';
    document.body.appendChild(ghost);
    dataTransfer.setDragImage(ghost, ghost.width >> 1, ghost.height >> 1);
    // The snapshot is taken once dragstart has finished dispatching.
    setTimeout(() => ghost.remove(), 0);
}

// ── Lexical helpers (run inside an update / read) ────────────────────────

/**
 * A block whose children are inline (paragraph, heading, quote, list item):
 * the only kind of element an inline node can be spliced into. Same test
 * RangeSelection.insertNodes applies to the block it lands in.
 */
function $isInlineHost(node) {
    if (!$isElementNode(node) || node.isInline()) return false;
    if ($isRootNode(node) || (typeof node.isShadowRoot === 'function' && node.isShadowRoot())) return false;
    // insertNodes would splice the image between code tokens.
    if ($isCodeNode(node)) return false;
    const first = node.getFirstChild();
    return first === null
        || $isTextNode(first)
        || $isLineBreakNode(first)
        || (($isElementNode(first) || $isDecoratorNode(first)) && first.isInline());
}

/**
 * DOM caret (element DOM, child offset) → Lexical child index in `element`.
 * DOM children map 1:1 onto Lexical children, except for the reconciler's
 * own <br> (empty-block terminator) which has no node behind it; anything
 * that doesn't map to a child means "the end".
 */
function $childIndexFromDOM(element, domNode, domOffset) {
    const size = element.getChildrenSize();
    if (size === 0) return 0;
    const childDOM = domNode.childNodes[domOffset];
    if (!childDOM) return size;
    let child = $getNearestNodeFromDOMNode(childDOM);
    while (child !== null && !child.is(element)) {
        const parent = child.getParent();
        if (parent === null) break;
        if (parent.is(element)) return child.getIndexWithinParent();
        child = parent;
    }
    return size;
}

/**
 * Map a DOM caret to a collapsed Lexical point an inline node can be
 * inserted at:
 *   { key, offset, type: 'text' | 'element', onDecorator }
 * `onDecorator` reports that the caret was anchored on a decorator node
 * (the point is then beside it); null means the spot cannot take the image.
 *
 * Exported for tests.
 */
export function $resolveDropPoint(domNode, domOffset, rootElement) {
    if (!domNode || !rootElement || !rootElement.contains(domNode)) return null;
    const nearest = $getNearestNodeFromDOMNode(domNode);
    if (nearest === null) return null;

    let element;
    let index;
    const onDecorator = $isDecoratorNode(nearest);

    if ($isTextNode(nearest)) {
        const size = nearest.getTextContentSize();
        // A DOM Text offset is the Lexical text offset (one DOM Text per
        // TextNode); a caret on the text's element wrapper is start or end.
        const offset = domNode.nodeType === 3 ? Math.min(domOffset, size) : (domOffset === 0 ? 0 : size);
        const parent = nearest.getParent();
        if (parent === null) return null;
        if (!parent.isInline()) {
            return $isInlineHost(parent)
                ? { key: nearest.getKey(), offset, type: 'text', onDecorator }
                : null;
        }
        // Inside a link (or any inline element) the image would become
        // linked content: land beside the outermost inline ancestor, on
        // the side the point was closer to.
        let charsBefore = offset;
        for (let sibling = nearest.getPreviousSibling(); sibling !== null; sibling = sibling.getPreviousSibling()) {
            charsBefore += sibling.getTextContentSize();
        }
        let inline = parent;
        while (inline.getParent() !== null && inline.getParent().isInline()) inline = inline.getParent();
        element = inline.getParent();
        index = inline.getIndexWithinParent() + (charsBefore < inline.getTextContentSize() / 2 ? 0 : 1);
    } else if (!$isElementNode(nearest)) {
        // A leaf that is not text (an image, a line break): the DOM caret
        // sits before (offset 0) or after (offset 1) it, in its parent.
        element = nearest.getParent();
        index = nearest.getIndexWithinParent() + (domOffset > 0 ? 1 : 0);
    } else {
        element = nearest;
        index = $childIndexFromDOM(nearest, domNode, domOffset);
    }
    if (element === null) return null;

    // An element point inside an inline element (a link): beside it instead.
    while (element.isInline()) {
        const parent = element.getParent();
        if (parent === null) return null;
        index = element.getIndexWithinParent() + (index === 0 ? 0 : 1);
        element = parent;
    }

    // Structural elements (root, table, row, cell, list) cannot hold an
    // inline node themselves: walk down into the block at the caret. Root
    // is the exception — a drop between blocks gets its own paragraph, see
    // $insertImageAt.
    for (let depth = 0; !$isInlineHost(element); depth++) {
        if ($isRootNode(element)) break;
        const children = element.getChildren();
        if (children.length === 0 || depth > 8) return null;
        const atEnd = index >= children.length;
        const child = children[atEnd ? children.length - 1 : index];
        if (!$isElementNode(child)) return null; // e.g. a block decorator
        element = child;
        index = atEnd ? child.getChildrenSize() : 0;
    }

    return { key: element.getKey(), offset: index, type: 'element', onDecorator };
}

/**
 * Where a drag event would drop:
 *   { point, decoratorDOM, dropClass }
 * Over a decorator, the pointer's side of it decides (inline: left/right
 * half, block: top/bottom half), and decoratorDOM / dropClass name the DOM
 * to mark. The decorator is found from the event TARGET, not the caret:
 * Chrome's caretRangeFromPoint prefers an editable position and reports the
 * text beside a non-editable image rather than the image itself, so a
 * caret-only test never sees it — and the browser draws no caret there
 * anyway. Elsewhere the DOM caret under the pointer is mapped, and
 * decoratorDOM is null. `point` is null when the spot cannot take the image.
 *
 * Exported for tests.
 */
export function $dropTargetForEvent(event, editor) {
    const miss = { point: null, decoratorDOM: null, dropClass: null };
    const rootElement = editor.getRootElement();
    if (rootElement === null) return miss;

    let target = event.target;
    if (target && target.nodeType === 3) target = target.parentNode;
    if (target && target.nodeType === 1 && rootElement.contains(target)) {
        const node = $getNearestNodeFromDOMNode(target);
        if ($isDecoratorNode(node)) {
            const decoratorDOM = editor.getElementByKey(node.getKey());
            if (decoratorDOM !== null) {
                const rect = decoratorDOM.getBoundingClientRect();
                const inline = node.isInline();
                const after = inline
                    ? event.clientX >= rect.left + rect.width / 2
                    : event.clientY >= rect.top + rect.height / 2;
                return {
                    point: $resolveDropPoint(decoratorDOM, after ? 1 : 0, rootElement),
                    decoratorDOM,
                    dropClass: inline
                        ? (after ? DROP_AFTER_CLASS : DROP_BEFORE_CLASS)
                        : (after ? DROP_BELOW_CLASS : DROP_ABOVE_CLASS),
                };
            }
        }
    }

    const caret = caretFromPoint(event.clientX, event.clientY);
    if (caret === null) return miss;
    return { point: $resolveDropPoint(caret.node, caret.offset, rootElement), decoratorDOM: null, dropClass: null };
}

/** True when `point` is the slot `image` already occupies (before or after it). */
function $isOwnSlot(image, point) {
    const parent = image.getParent();
    if (parent === null || point.type !== 'element' || point.key !== parent.getKey()) return false;
    const index = image.getIndexWithinParent();
    return point.offset === index || point.offset === index + 1;
}

/** Insert `image` at a resolved point (root points get a fresh paragraph). */
function $insertImageAt(image, point) {
    const target = $getNodeByKey(point.key);
    if (target === null) return;
    if ($isRootNode(target)) {
        const paragraph = $createParagraphNode();
        const reference = target.getChildAtIndex(point.offset);
        if (reference) reference.insertBefore(paragraph);
        else target.append(paragraph);
        paragraph.append(image);
    } else {
        const selection = $createRangeSelection();
        selection.anchor.set(point.key, point.offset, point.type);
        selection.focus.set(point.key, point.offset, point.type);
        $setSelection(selection);
        $insertNodes([image]); // splits a text run around the image
    }
    image.selectEnd(); // caret right after the image: typing continues there
}

/**
 * Detach `image` and re-insert it at `point`. A drop back onto the image's
 * own slot is a no-op (returns false); a drop later in the same parent has
 * its index corrected for the removal.
 *
 * Exported for tests.
 */
export function $moveImageToPoint(image, point) {
    if ($isOwnSlot(image, point)) return false;
    const parent = image.getParent();
    const index = image.getIndexWithinParent();
    const sameParent = parent !== null && point.type === 'element' && point.key === parent.getKey();

    image.remove();
    $insertImageAt(image, sameParent && point.offset > index
        ? { key: point.key, offset: point.offset - 1, type: point.type }
        : point);
    return true;
}

// ── Drag UI state (DOM classes only, never editor state) ─────────────────

function createDragUI() {
    return {
        sourceKey: null,   // key of the ImageNode being dragged, dragstart → drop/dragend
        targetDOM: null,   // decorator DOM currently carrying a drop-side mark
        targetClass: null,
        depth: 0,          // dragenter/dragleave nesting inside the root
    };
}

function markDropTarget(ui, dom, cls) {
    if (ui.targetDOM === dom && ui.targetClass === cls) return;
    unmarkDropTarget(ui);
    dom.classList.add(cls);
    ui.targetDOM = dom;
    ui.targetClass = cls;
}

function unmarkDropTarget(ui) {
    if (ui.targetDOM !== null) ui.targetDOM.classList.remove(ui.targetClass);
    ui.targetDOM = null;
    ui.targetClass = null;
}

function clearDragUI(editor, ui) {
    unmarkDropTarget(ui);
    const key = ui.sourceKey;
    ui.sourceKey = null;
    if (key === null) return;
    const dom = editor.getElementByKey(key);
    if (dom) dom.classList.remove(DRAGGING_CLASS);
}

// ── Command handlers ─────────────────────────────────────────────────────

function $onDragStart(event, editor, ui) {
    // Whatever this drag is, the previous one is over.
    clearDragUI(editor, ui);
    const target = event.target;
    if (!target || typeof target.querySelector !== 'function') return false;
    const node = $getNearestNodeFromDOMNode(target);
    // Anything else (text, a selection) is the browser's drag, not ours.
    // Note this is decided by the drag TARGET, never by the selection: Chrome
    // makes any drag that starts on an <img> an image-only drag, even when
    // the image sits inside a wider selection, and auto-selects a clicked
    // image — so a selection-based test would hand exactly those drags back
    // to the native path and its re-upload.
    if (!$isImageNode(node)) return false;
    const dataTransfer = event.dataTransfer;
    if (!dataTransfer) return false;

    const key = node.getKey();
    dataTransfer.setData(IMAGE_MOVE_MIME, JSON.stringify({
        editorKey: editor.getKey(),
        key,
        src: node.getSrc(),
        altText: node.getAltText(),
    }));
    // text/plain doubles as the "droppable content" an editing host needs
    // before it shows its caret, and as the payload for a drop anywhere
    // else (another field, another app): the markdown reference.
    dataTransfer.setData('text/plain', node.getTextContent());
    // Both, so the browser picks: a move within this document, a copy into
    // another one (Chrome refuses a cross-document drop of a move-only
    // drag). $onDrop decides by editorKey, not by the effect.
    dataTransfer.effectAllowed = 'copyMove';

    setDragGhost(dataTransfer, target.tagName === 'IMG' ? target : target.querySelector('img'));

    ui.sourceKey = key;
    // Dim the source next frame — after the browser has snapshotted the
    // ghost, in case it fell back to the default one.
    const schedule = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn) => setTimeout(fn, 0);
    schedule(() => {
        if (ui.sourceKey !== key) return;
        const dom = editor.getElementByKey(key);
        if (dom) dom.classList.add(DRAGGING_CLASS);
    });
    return true;
}

/**
 * Ours: stamped with IMAGE_MOVE_MIME, or started on an image of this very
 * editor (sourceKey is set at dragstart and cleared at drop/dragend, and a
 * browser runs one drag at a time) — the latter covers engines that hide
 * custom types from `types` mid-drag.
 */
function isOurDrag(dataTransfer, ui) {
    return isImageMoveDrag(dataTransfer) || ui.sourceKey !== null;
}

function $onDragOver(event, editor, ui) {
    const dataTransfer = event.dataTransfer;
    if (!dataTransfer || !isOurDrag(dataTransfer, ui)) return false;

    const { point, decoratorDOM, dropClass } = $dropTargetForEvent(event, editor);
    const source = ui.sourceKey !== null ? $getNodeByKey(ui.sourceKey) : null;

    if (point === null || ($isImageNode(source) && $isOwnSlot(source, point))) {
        // Unusable spot, or where the image already is: take the drop away
        // from the browser and refuse it.
        unmarkDropTarget(ui);
        event.preventDefault();
        dataTransfer.dropEffect = 'none';
    } else if (decoratorDOM !== null) {
        // Claim it, or no drop event would reach us here (see header); the
        // side mark is the indicator the browser won't draw.
        markDropTarget(ui, decoratorDOM, dropClass);
        event.preventDefault();
        dataTransfer.dropEffect = 'move';
    } else {
        // Uncancelled on purpose — the native caret is the indicator.
        unmarkDropTarget(ui);
    }
    return true;
}

function $onDrop(event, editor, ui) {
    const dataTransfer = event.dataTransfer;
    if (!dataTransfer || !isOurDrag(dataTransfer, ui)) return false;
    // Ours, whatever happens next: no native move, no rich-text fallback.
    event.preventDefault();
    const sourceKey = ui.sourceKey;
    clearDragUI(editor, ui);

    const { point } = $dropTargetForEvent(event, editor);
    if (point === null) return true;

    const payload = readMovePayload(dataTransfer);
    // Node keys are per editor: only trust one stamped by this editor.
    const key = payload
        ? (payload.editorKey === editor.getKey() ? payload.key : null)
        : sourceKey;
    const image = key != null ? $getNodeByKey(key) : null;

    if ($isImageNode(image)) {
        $moveImageToPoint(image, point);
    } else if (payload && isRenderableImageSrc(payload.src)) {
        // Another editor's image (or one gone since dragstart): a copy.
        $insertImageAt($createImageNode({ src: payload.src, altText: payload.altText || '' }), point);
    }
    return true;
}

/**
 * Wire the plugin up to an editor; returns the teardown. Split out of the
 * component so it can be driven without a component tree (tests).
 */
export function registerImageMove(editor) {
    const ui = createDragUI();

    const removeDragStart = editor.registerCommand(
        DRAGSTART_COMMAND,
        (event) => $onDragStart(event, editor, ui),
        COMMAND_PRIORITY_HIGH
    );
    const removeDragOver = editor.registerCommand(
        DRAGOVER_COMMAND,
        (event) => $onDragOver(event, editor, ui),
        COMMAND_PRIORITY_HIGH
    );
    const removeDrop = editor.registerCommand(
        DROP_COMMAND,
        (event) => $onDrop(event, editor, ui),
        COMMAND_PRIORITY_HIGH
    );
    // dragend fires on the source whether the drop landed, was refused or
    // happened elsewhere — always undim and unmark. Not ours to swallow.
    const removeDragEnd = editor.registerCommand(
        DRAGEND_COMMAND,
        () => {
            clearDragUI(editor, ui);
            return false;
        },
        COMMAND_PRIORITY_LOW
    );

    // A side mark must not outlive the pointer's stay in the editor: dragend
    // only fires in the document the drag started in, so for an image from
    // another Pixagram tab nothing else would clear it. dragenter/dragleave
    // fire per descendant element, hence the nesting count (as in
    // ImageDropPlugin); it reaches 0 when the pointer leaves the root.
    let detachRoot = null;
    const removeRootListener = editor.registerRootListener((rootElement) => {
        if (detachRoot) {
            detachRoot();
            detachRoot = null;
        }
        ui.depth = 0;
        if (!rootElement) return;

        const onDragEnter = (e) => {
            if (!isImageMoveDrag(e.dataTransfer)) return;
            ui.depth += 1;
        };
        const onDragLeave = (e) => {
            if (!isImageMoveDrag(e.dataTransfer)) return;
            ui.depth -= 1;
            if (ui.depth <= 0) {
                ui.depth = 0;
                unmarkDropTarget(ui);
            }
        };
        rootElement.addEventListener('dragenter', onDragEnter);
        rootElement.addEventListener('dragleave', onDragLeave);
        detachRoot = () => {
            rootElement.removeEventListener('dragenter', onDragEnter);
            rootElement.removeEventListener('dragleave', onDragLeave);
        };
    });

    return () => {
        removeDragStart();
        removeDragOver();
        removeDrop();
        removeDragEnd();
        if (detachRoot) detachRoot();
        removeRootListener();
        clearDragUI(editor, ui);
    };
}

const ImageMovePlugin = () => {
    const [editor] = useLexicalComposerContext();
    React.useEffect(() => registerImageMove(editor), [editor]);
    return null;
};

export default ImageMovePlugin;
