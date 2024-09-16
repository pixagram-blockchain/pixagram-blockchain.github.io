import React from 'preact/compat';
import { createPortal } from 'preact/compat';
import ImageIcon from "@material-ui/icons/Image";

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext.js';
import { COMMAND_PRIORITY_LOW } from 'lexical';
import { DRAG_DROP_PASTE } from '@lexical/rich-text';

import { t, useLanguage } from "../../utils/text";

/**
 * ImageDropPlugin — drop zone for image files inside the visual editor.
 *
 * Two independent halves:
 *
 * 1. DRAG_DROP_PASTE (from @lexical/rich-text): Lexical's own rich-text
 *    pipeline handles dragover/drop natively, moves the caret to the drop
 *    point, then dispatches this command with the dropped files. It also
 *    fires when image files are PASTED from the clipboard — screenshots
 *    paste-upload for free. We only filter for images and hand them to the
 *    parent (which uploads to Arweave and inserts the resulting ImageNode).
 *
 * 2. A purely visual overlay while a file drag hovers the editor. The
 *    overlay has pointer-events: none and we never preventDefault here —
 *    Lexical owns the actual drag/drop event handling.
 */

const OVERLAY_STYLE_BASE = {
    position: 'fixed',
    zIndex: 2000, // above the editor dialog (MUI modal ~1300)
    pointerEvents: 'none',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(8,8,8,0.82)',
    border: '2px dashed rgba(255,255,255,0.45)',
    borderRadius: 16,
    color: '#ffffff',
};
const OVERLAY_ICON_STYLE = { fontSize: 34, opacity: 0.9 };
const OVERLAY_LABEL_STYLE = { fontSize: 15, fontWeight: 500 };
const OVERLAY_SUBLABEL_STYLE = { fontSize: 12, opacity: 0.6 };

const isImageFile = (file) =>
    Boolean(file && file.type && file.type.indexOf('image/') === 0);

const ImageDropPlugin = ({ onImageFiles }) => {
    const [editor] = useLexicalComposerContext();
    const [dropRect, setDropRect] = React.useState(null);
    // dragenter/dragleave fire per descendant element; only depth 0→1 shows
    // the overlay and only 1→0 hides it.
    const dragDepthRef = React.useRef(0);

    React.useEffect(() => {
        return editor.registerCommand(
            DRAG_DROP_PASTE,
            (files) => {
                const images = (files || []).filter(isImageFile);
                if (images.length === 0) return false;
                if (onImageFiles) onImageFiles(images);
                return true;
            },
            COMMAND_PRIORITY_LOW
        );
    }, [editor, onImageFiles]);

    React.useEffect(() => {
        let detach = null;

        const remove = editor.registerRootListener((rootElement) => {
            if (detach) {
                detach();
                detach = null;
            }
            if (!rootElement) return;

            const isFileDrag = (e) => {
                const types = e.dataTransfer && e.dataTransfer.types;
                return Boolean(types) &&
                    Array.prototype.indexOf.call(types, 'Files') !== -1;
            };
            const show = () => {
                const r = rootElement.getBoundingClientRect();
                setDropRect({ top: r.top, left: r.left, width: r.width, height: r.height });
            };
            const hide = () => {
                dragDepthRef.current = 0;
                setDropRect(null);
            };
            const onDragEnter = (e) => {
                if (!isFileDrag(e)) return;
                dragDepthRef.current += 1;
                if (dragDepthRef.current === 1) show();
            };
            const onDragLeave = (e) => {
                if (!isFileDrag(e)) return;
                dragDepthRef.current -= 1;
                if (dragDepthRef.current <= 0) hide();
            };
            const onDrop = () => hide();
            const onDragEnd = () => hide();

            rootElement.addEventListener('dragenter', onDragEnter);
            rootElement.addEventListener('dragleave', onDragLeave);
            rootElement.addEventListener('drop', onDrop);
            // A drag cancelled outside the editor (Escape, drop elsewhere)
            // never fires dragleave on the root — dragend on window does.
            window.addEventListener('dragend', onDragEnd);

            detach = () => {
                rootElement.removeEventListener('dragenter', onDragEnter);
                rootElement.removeEventListener('dragleave', onDragLeave);
                rootElement.removeEventListener('drop', onDrop);
                window.removeEventListener('dragend', onDragEnd);
            };
        });

        return () => {
            if (detach) detach();
            remove();
        };
    }, [editor]);

    if (!dropRect) return null;

    return createPortal(
        <div
            style={{
                ...OVERLAY_STYLE_BASE,
                top: dropRect.top,
                left: dropRect.left,
                width: dropRect.width,
                height: dropRect.height,
            }}
        >
            <ImageIcon style={OVERLAY_ICON_STYLE} />
            <div style={OVERLAY_LABEL_STYLE}>{t("components.image_drop_plugin.drop_image_to_upload")}</div>
            <div style={OVERLAY_SUBLABEL_STYLE}>{t("components.image_drop_plugin.stored_on_arweave")}</div>
        </div>,
        document.body
    );
};

export default ImageDropPlugin;
