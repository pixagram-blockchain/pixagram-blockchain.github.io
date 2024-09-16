import React from 'preact/compat';
import { createPortal } from 'preact/compat';

import FormatBoldIcon from "@material-ui/icons/FormatBold";
import FormatItalicIcon from "@material-ui/icons/FormatItalic";
import FormatUnderlinedIcon from "@material-ui/icons/FormatUnderlined";
import FormatQuoteIcon from "@material-ui/icons/FormatQuote";
import LinkIcon from "@material-ui/icons/Link";
import ImageIcon from "@material-ui/icons/Image";
import UndoIcon from "@material-ui/icons/Undo";
import RedoIcon from "@material-ui/icons/Redo";
import CloseRoundedIcon from "@material-ui/icons/CloseRounded";

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext.js';

import { t, useLanguage } from "../../utils/text";
import {
    $getSelection,
    $isRangeSelection,
    $isTextNode,
    FORMAT_TEXT_COMMAND,
    UNDO_COMMAND,
    REDO_COMMAND,
} from 'lexical';

/**
 * RadialContextMenu — right-click inside the visual editor opens a circular
 * menu of 8 actions blooming out from the cursor: Bold, Italic, Underline,
 * Quote, Link, Image, Undo, Redo, with a close button at the center.
 *
 * Self-contained Lexical plugin (must live inside the LexicalComposer).
 * Formats and undo/redo are dispatched directly on the editor; Quote, Link
 * and Image go through the parent dialog's handlers (props). Link is
 * disabled unless text is selected — same rule as everywhere else.
 *
 * All mousedowns inside the overlay preventDefault so the editor keeps
 * focus and the selection survives until an action runs.
 */

const RADIUS = 84;        // distance from cursor to item centers
const ITEM_SIZE = 44;     // action button diameter
const CENTER_SIZE = 32;   // close button diameter
// Keep the whole ring on-screen when right-clicking near an edge.
const EDGE_MARGIN = RADIUS + ITEM_SIZE / 2 + 12;

const OVERLAY_STYLE = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2000, // above the editor dialog (MUI modal ~1300)
};

const ITEM_BASE_STYLE = {
    position: 'absolute',
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    padding: 0,
    borderRadius: '50%',
    border: 'none',
    outline: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 6px 18px rgba(0,0,0,0.45)',
};

const ICON_STYLE = { fontSize: 20 };
const CENTER_ICON_STYLE = { fontSize: 16 };

const stopMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
};

const RadialContextMenu = ({ onLink, onImage, onToggleBlockType }) => {
    const [editor] = useLexicalComposerContext();
    // null when closed, else { x, y, canLink }
    const [menu, setMenu] = React.useState(null);
    const [shown, setShown] = React.useState(false); // drives the bloom-in
    const [hovered, setHovered] = React.useState(-1);

    // Native contextmenu on the editor root (re-attached if Lexical swaps
    // the root element). Replaces the browser menu inside the editor only.
    React.useEffect(() => {
        const handleContextMenu = (event) => {
            event.preventDefault();

            let canLink = false;
            editor.getEditorState().read(() => {
                const selection = $getSelection();
                canLink =
                    $isRangeSelection(selection) &&
                    !selection.isCollapsed() &&
                    selection.getNodes().some($isTextNode);
            });

            const x = Math.min(
                Math.max(event.clientX, EDGE_MARGIN),
                window.innerWidth - EDGE_MARGIN
            );
            const y = Math.min(
                Math.max(event.clientY, EDGE_MARGIN),
                window.innerHeight - EDGE_MARGIN
            );

            setShown(false);
            setHovered(-1);
            setMenu({ x, y, canLink });
        };

        return editor.registerRootListener((rootElement, prevRootElement) => {
            if (prevRootElement) {
                prevRootElement.removeEventListener('contextmenu', handleContextMenu);
            }
            if (rootElement) {
                rootElement.addEventListener('contextmenu', handleContextMenu);
            }
        });
    }, [editor]);

    // Bloom in on the frame after mount / reposition.
    React.useEffect(() => {
        if (!menu) return;
        const id = requestAnimationFrame(() => setShown(true));
        return () => cancelAnimationFrame(id);
    }, [menu]);

    // Escape closes (captured before the dialog's own Escape handling).
    React.useEffect(() => {
        if (!menu) return;
        const onKeyDown = (e) => {
            if (e.key === 'Escape' || e.key === 'Esc') {
                e.stopPropagation();
                setMenu(null);
            }
        };
        document.addEventListener('keydown', onKeyDown, true);
        return () => document.removeEventListener('keydown', onKeyDown, true);
    }, [menu]);

    const close = React.useCallback(() => setMenu(null), []);

    const items = React.useMemo(() => ([
        {
            key: 'bold',
            label: t("components.radial_context_menu.bold"),
            Icon: FormatBoldIcon,
            run: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold'),
        },
        {
            key: 'italic',
            label: t("components.radial_context_menu.italic"),
            Icon: FormatItalicIcon,
            run: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic'),
        },
        {
            key: 'underline',
            label: t("components.radial_context_menu.underline"),
            Icon: FormatUnderlinedIcon,
            run: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline'),
        },
        {
            key: 'quote',
            label: t("components.radial_context_menu.quote"),
            Icon: FormatQuoteIcon,
            run: () => onToggleBlockType && onToggleBlockType('quote'),
        },
        {
            key: 'link',
            label: t("components.radial_context_menu.link"),
            Icon: LinkIcon,
            needsSelection: true,
            run: () => onLink && onLink(),
        },
        {
            key: 'image',
            label: t("components.radial_context_menu.image"),
            Icon: ImageIcon,
            run: () => onImage && onImage(),
        },
        {
            key: 'undo',
            label: t("components.radial_context_menu.undo"),
            Icon: UndoIcon,
            run: () => editor.dispatchCommand(UNDO_COMMAND, undefined),
        },
        {
            key: 'redo',
            label: t("components.radial_context_menu.redo"),
            Icon: RedoIcon,
            run: () => editor.dispatchCommand(REDO_COMMAND, undefined),
        },
    ]), [editor, onLink, onImage, onToggleBlockType]);

    if (!menu) return null;

    const handleOverlayMouseDown = (e) => {
        // Only the transparent backdrop dismisses; item mousedowns stop
        // propagation. preventDefault keeps the editor selection alive.
        if (e.target === e.currentTarget) {
            e.preventDefault();
            close();
        }
    };

    const handleOverlayContextMenu = (e) => {
        e.preventDefault();
        if (e.target === e.currentTarget) close();
    };

    const step = 360 / items.length;

    return createPortal(
        <div
            style={OVERLAY_STYLE}
            onMouseDown={handleOverlayMouseDown}
            onContextMenu={handleOverlayContextMenu}
        >
            {items.map((item, i) => {
                const angle = ((-90 + i * step) * Math.PI) / 180; // start at top
                const dx = Math.cos(angle) * RADIUS;
                const dy = Math.sin(angle) * RADIUS;
                const disabled = Boolean(item.needsSelection) && !menu.canLink;
                const isHovered = hovered === i && !disabled;
                const ItemIcon = item.Icon;

                return (
                    <button
                        key={item.key}
                        type="button"
                        title={disabled ? t("components.radial_context_menu.select_text_first") : item.label}
                        onMouseDown={stopMouseDown}
                        onClick={() => {
                            if (disabled) return;
                            close();
                            item.run();
                        }}
                        onMouseEnter={() => setHovered(i)}
                        onMouseLeave={() => setHovered(-1)}
                        style={{
                            ...ITEM_BASE_STYLE,
                            left: menu.x - ITEM_SIZE / 2,
                            top: menu.y - ITEM_SIZE / 2,
                            cursor: disabled ? 'default' : 'pointer',
                            backgroundColor: isHovered ? '#ffffff' : '#e9e9e9',
                            color: disabled ? '#b5b5b5' : '#1d1d1d',
                            opacity: shown ? (disabled ? 0.55 : 1) : 0,
                            transform: shown
                                ? `translate(${dx}px, ${dy}px) scale(${isHovered ? 1.12 : 1})`
                                : 'translate(0px, 0px) scale(0.4)',
                            transition:
                                `transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1) ${i * 14}ms, ` +
                                `opacity 140ms ease ${i * 14}ms, ` +
                                'background-color 120ms ease',
                        }}
                    >
                        <ItemIcon style={ICON_STYLE} />
                    </button>
                );
            })}
        </div>,
        document.body
    );
};

export default RadialContextMenu;
