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
import VerticalAlignTopIcon from "@material-ui/icons/VerticalAlignTop";
import VerticalAlignBottomIcon from "@material-ui/icons/VerticalAlignBottom";
import RemoveIcon from "@material-ui/icons/Remove";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext.js';
import * as LexicalTableModule from '@lexical/table';
import { $isTableCellNode, $isTableNode } from '@lexical/table';

import { $getBlockTypeAtSelection } from './lexicalConfig';

import { t, useLanguage } from "../../utils/text";
import {
    $getNearestNodeFromDOMNode,
    $getSelection,
    $createParagraphNode,
    $isRangeSelection,
    $isTextNode,
    FORMAT_TEXT_COMMAND,
    UNDO_COMMAND,
    REDO_COMMAND,
} from 'lexical';

/**
 * RadialContextMenu — right-click inside the visual editor opens a circular
 * menu blooming out from the cursor.
 *
 * TWO menus, chosen by what was clicked:
 *
 *   • inside a table cell → row and column operations (insert above/below,
 *     insert left/right, delete row, delete column, delete table). The
 *     formatting ring would be the wrong tool there, and inline formatting
 *     inside a cell is still one text-selection away via the floating bar.
 *
 *   • anywhere else → the formatting ring: Bold, Italic, Underline, Quote,
 *     Link, Image, Undo, Redo.
 *
 * Formatting items that are ALREADY applied at the caret render inverted and
 * turn themselves off when pressed — the same behaviour as the floating
 * selection bar, rather than silently re-applying a format that is already on.
 *
 * Self-contained Lexical plugin (must live inside the LexicalComposer).
 * Formats, undo/redo and the table operations are dispatched directly on the
 * editor; Quote, Link and Image go through the parent dialog's handlers
 * (props). Link is disabled unless text is selected — same rule as everywhere
 * else.
 *
 * All mousedowns inside the overlay preventDefault so the editor keeps focus
 * and the selection survives until an action runs.
 */

const RADIUS = 84;        // distance from cursor to item centers
const ITEM_SIZE = 44;     // action button diameter
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

// The ring is icon-only, and "insert column left" versus "delete column" is
// not something an icon can carry on its own. The hovered item names itself in
// the middle of the ring, where nothing else is competing for the space.
const CENTER_LABEL_STYLE = {
    position: 'absolute',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    maxWidth: RADIUS * 2 - ITEM_SIZE,
    padding: '4px 10px',
    borderRadius: 12,
    backgroundColor: 'rgba(16,16,16,0.92)',
    color: '#ffffff',
    fontSize: 12,
    lineHeight: 1.3,
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
};

// Rotations reuse one arrow-to-edge icon for all four inserts: the arrow
// points at the edge the new row or column appears on. Same trick for the
// minus: horizontal removes a row, vertical removes a column.
const ROTATE_LEFT_STYLE = { fontSize: 20, transform: 'rotate(-90deg)' };
const ROTATE_RIGHT_STYLE = { fontSize: 20, transform: 'rotate(90deg)' };
const VERTICAL_MINUS_STYLE = { fontSize: 20, transform: 'rotate(90deg)' };

const stopMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
};

// @lexical/table renamed these helpers (the `__EXPERIMENTAL` suffix was
// dropped) without keeping the old names in every release, and a named import
// of a missing export is a hard module-resolution error under strict bundlers
// — so they are resolved off the namespace at call time instead. Same pattern
// as $setBlocksTypeSafe's handling of @lexical/selection.
const resolveTableFn = (names) => {
    for (let i = 0; i < names.length; i++) {
        const fn = LexicalTableModule[names[i]];
        if (typeof fn === 'function') return fn;
    }
    return null;
};

const INSERT_ROW = ['$insertTableRowAtSelection', '$insertTableRow__EXPERIMENTAL'];
const INSERT_COLUMN = ['$insertTableColumnAtSelection', '$insertTableColumn__EXPERIMENTAL'];
const DELETE_ROW = ['$deleteTableRowAtSelection', '$deleteTableRow__EXPERIMENTAL'];
const DELETE_COLUMN = ['$deleteTableColumnAtSelection', '$deleteTableColumn__EXPERIMENTAL'];

/** Nearest enclosing table cell, or null. */
const $cellForNode = (node) => {
    let current = node;
    while (current) {
        if ($isTableCellNode(current)) return current;
        current = current.getParent();
    }
    return null;
};

const $tableForNode = (node) => {
    let current = node;
    while (current) {
        if ($isTableNode(current)) return current;
        current = current.getParent();
    }
    return null;
};

const RadialContextMenu = ({ onLink, onImage, onToggleBlockType }) => {
    useLanguage();
    const [editor] = useLexicalComposerContext();
    // null when closed, else { x, y, mode, canLink, formats, blockType }
    const [menu, setMenu] = React.useState(null);
    const [shown, setShown] = React.useState(false); // drives the bloom-in
    const [hovered, setHovered] = React.useState(-1);

    // Native contextmenu on the editor root (re-attached if Lexical swaps
    // the root element). Replaces the browser menu inside the editor only.
    React.useEffect(() => {
        const handleContextMenu = (event) => {
            event.preventDefault();

            const cellElement = event.target && event.target.closest
                ? event.target.closest('td,th')
                : null;

            let mode = 'format';
            let canLink = false;
            let formats = { bold: false, italic: false, underline: false };
            let blockType = 'paragraph';

            // One update, not an update followed by a read: the selection may
            // be moved below, and everything after has to see that move.
            editor.update(() => {
                if (cellElement) {
                    const clicked = $cellForNode($getNearestNodeFromDOMNode(cellElement));
                    if (clicked) {
                        mode = 'table';
                        // Firefox does not move the caret on right-click, and
                        // Chrome does not move it when the click lands inside
                        // an existing selection — so the caret can easily be
                        // in a different cell than the one just clicked, and
                        // "delete row" would take out the wrong row. Pull the
                        // selection into the clicked cell when it isn't
                        // already there.
                        const selection = $getSelection();
                        const anchorCell = $isRangeSelection(selection)
                            ? $cellForNode(selection.anchor.getNode())
                            : null;
                        if (!anchorCell || anchorCell.getKey() !== clicked.getKey()) {
                            clicked.selectStart();
                        }
                    }
                }

                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                    canLink = !selection.isCollapsed() &&
                        selection.getNodes().some($isTextNode);
                    formats = {
                        bold: selection.hasFormat('bold'),
                        italic: selection.hasFormat('italic'),
                        underline: selection.hasFormat('underline'),
                    };
                    blockType = $getBlockTypeAtSelection(selection);
                }
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
            setMenu({ x, y, mode, canLink, formats, blockType });
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

    // The table helpers read the selection themselves and throw when it is
    // not in a table — which can happen if the document moved under us
    // between opening the menu and pressing a button.
    const runTableOp = React.useCallback((names, arg) => {
        const fn = resolveTableFn(names);
        if (!fn) {
            console.error('Table operation unavailable in this @lexical/table build:', names[0]);
            return;
        }
        editor.update(() => {
            try {
                fn(arg);
            } catch (error) {
                console.error('Table operation failed:', error);
            }
        });
    }, [editor]);

    const deleteTable = React.useCallback(() => {
        editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;
            const table = $tableForNode(selection.anchor.getNode());
            if (!table) return;
            // Leave somewhere to put the caret, or the whole block disappears
            // and the user is left with no insertion point where it was.
            const paragraph = $createParagraphNode();
            table.insertAfter(paragraph);
            table.remove();
            paragraph.select();
        });
    }, [editor]);

    const formatItems = React.useMemo(() => ([
        {
            key: 'bold',
            label: t("components.radial_context_menu.bold"),
            Icon: FormatBoldIcon,
            format: 'bold',
            run: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold'),
        },
        {
            key: 'italic',
            label: t("components.radial_context_menu.italic"),
            Icon: FormatItalicIcon,
            format: 'italic',
            run: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic'),
        },
        {
            key: 'underline',
            label: t("components.radial_context_menu.underline"),
            Icon: FormatUnderlinedIcon,
            format: 'underline',
            run: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline'),
        },
        {
            key: 'quote',
            label: t("components.radial_context_menu.quote"),
            Icon: FormatQuoteIcon,
            // toggleBlockType turns an already-applied block type back into a
            // paragraph, so pressing an active Quote clears it.
            block: 'quote',
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

    const tableItems = React.useMemo(() => ([
        {
            key: 'row-above',
            label: t("components.radial_context_menu.insert_row_above"),
            Icon: VerticalAlignTopIcon,
            run: () => runTableOp(INSERT_ROW, false),
        },
        {
            key: 'row-below',
            label: t("components.radial_context_menu.insert_row_below"),
            Icon: VerticalAlignBottomIcon,
            run: () => runTableOp(INSERT_ROW, true),
        },
        {
            key: 'row-delete',
            label: t("components.radial_context_menu.delete_row"),
            Icon: RemoveIcon,
            run: () => runTableOp(DELETE_ROW),
        },
        {
            key: 'column-left',
            label: t("components.radial_context_menu.insert_column_left"),
            Icon: VerticalAlignTopIcon,
            iconStyle: ROTATE_LEFT_STYLE,
            run: () => runTableOp(INSERT_COLUMN, false),
        },
        {
            key: 'column-right',
            label: t("components.radial_context_menu.insert_column_right"),
            Icon: VerticalAlignTopIcon,
            iconStyle: ROTATE_RIGHT_STYLE,
            run: () => runTableOp(INSERT_COLUMN, true),
        },
        {
            key: 'column-delete',
            label: t("components.radial_context_menu.delete_column"),
            Icon: RemoveIcon,
            iconStyle: VERTICAL_MINUS_STYLE,
            run: () => runTableOp(DELETE_COLUMN),
        },
        {
            key: 'table-delete',
            label: t("components.radial_context_menu.delete_table"),
            Icon: DeleteOutlineIcon,
            run: deleteTable,
        },
    ]), [runTableOp, deleteTable]);

    if (!menu) return null;

    const items = menu.mode === 'table' ? tableItems : formatItems;

    const isActive = (item) => {
        if (item.format) return Boolean(menu.formats[item.format]);
        if (item.block) return menu.blockType === item.block;
        return false;
    };

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
    const hoveredItem = hovered >= 0 && hovered < items.length ? items[hovered] : null;

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
                const active = !disabled && isActive(item);
                const ItemIcon = item.Icon;

                // Active = inverted, so "this is already on, pressing me turns
                // it off" is readable at a glance.
                let backgroundColor = '#e9e9e9';
                let color = '#1d1d1d';
                if (disabled) {
                    color = '#b5b5b5';
                } else if (active) {
                    backgroundColor = isHovered ? '#000000' : '#1d1d1d';
                    color = '#ffffff';
                } else if (isHovered) {
                    backgroundColor = '#ffffff';
                }

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
                            backgroundColor,
                            color,
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
                        <ItemIcon style={item.iconStyle || ICON_STYLE} />
                    </button>
                );
            })}
            {hoveredItem && (
                <div style={{ ...CENTER_LABEL_STYLE, left: menu.x, top: menu.y }}>
                    {hoveredItem.label}
                </div>
            )}
        </div>,
        document.body
    );
};

export default RadialContextMenu;
