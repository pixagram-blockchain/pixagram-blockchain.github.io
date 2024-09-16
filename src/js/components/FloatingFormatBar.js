import React from 'preact/compat';
import { createPortal } from 'preact/compat';
import IconButton from "@material-ui/core/IconButton";

import FormatBoldIcon from "@material-ui/icons/FormatBold";
import FormatItalicIcon from "@material-ui/icons/FormatItalic";
import FormatUnderlinedIcon from "@material-ui/icons/FormatUnderlined";
import LinkIcon from "@material-ui/icons/Link";
import H1Icon from "../../icons/H1";
import H2Icon from "../../icons/H2";

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext.js';
import { $isHeadingNode } from '@lexical/rich-text';
import {
    $getSelection,
    $isRangeSelection,
    $isTextNode,
    BLUR_COMMAND,
    COMMAND_PRIORITY_LOW,
    FORMAT_TEXT_COMMAND,
    SELECTION_CHANGE_COMMAND,
} from 'lexical';

import { t } from "../utils/text";

/**
 * FloatingFormatBar — Medium-style mini toolbar that appears above the
 * current text selection with Bold | Italic | Underline | Link.
 *
 * Self-contained Lexical plugin (must live inside the LexicalComposer):
 * tracks the selection itself, positions off the DOM selection rect, and
 * portals to document.body with a z-index above the editor dialog.
 *
 * Every button uses onMouseDown+preventDefault so pressing it never blurs
 * the editor — the selection (and the bar) survive the click. The Link
 * button therefore hands a still-live selection to the parent's
 * openLinkDialog, which captures it before the URL dialog takes focus.
 */

// Estimated footprint used for viewport clamping (7 × ~30px buttons +
// 2 dividers + padding). Close enough — the bar is centered then clamped.
const BAR_WIDTH = 256;
const BAR_HEIGHT = 40;

// Borderless white card, matching the sidebar tooltips: the shadow alone
// separates it from the page.
const BAR_STYLE_BASE = {
    position: 'fixed',
    zIndex: 2000, // above the editor dialog (MUI modal ~1300)
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    padding: '4px 6px',
    backgroundColor: '#ffffff',
    border: 'none',
    borderRadius: 22,
    boxShadow: '0 8px 28px rgba(0,0,0,0.28)',
    transform: 'translateX(-50%)',
};
const BTN_STYLE = { color: 'rgba(0,0,0,0.6)', padding: 6 };
const BTN_ACTIVE_STYLE = { color: '#000000', backgroundColor: 'rgba(0,0,0,0.14)', padding: 6 };
const DIVIDER_STYLE = { width: 1, height: 20, backgroundColor: 'rgba(0,0,0,0.15)', margin: '0 4px' };
const ICON_STYLE = { fontSize: 18 };

const preventFocusSteal = (e) => e.preventDefault();

// Act ON mousedown — the pattern the retired editor's sidebar buttons used
// and proved: preventDefault keeps the editor focused AND the action runs
// in the same event, before anything can disturb the live selection. A
// separate click handler leaves a mousedown→click window where focus (and
// with it the selection some Lexical versions retain less reliably) can
// shift.
const actOnMouseDown = (action) => (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    action();
};

const FloatingFormatBar = ({ onLink, onToggleBlockType }) => {
    const [editor] = useLexicalComposerContext();
    // null when hidden, else { top, left, formats: {bold, italic, underline} }
    const [bar, setBar] = React.useState(null);

    const hide = React.useCallback(() => {
        setBar((prev) => (prev === null ? prev : null));
    }, []);

    const update = React.useCallback(() => {
        editor.getEditorState().read(() => {
            const selection = $getSelection();
            if (
                !$isRangeSelection(selection) ||
                selection.isCollapsed() ||
                !selection.getNodes().some($isTextNode)
            ) {
                hide();
                return;
            }

            const rootElement = editor.getRootElement();
            const domSelection = window.getSelection();
            if (
                !rootElement ||
                !domSelection ||
                domSelection.rangeCount === 0 ||
                !rootElement.contains(domSelection.anchorNode)
            ) {
                hide();
                return;
            }

            const rect = domSelection.getRangeAt(0).getBoundingClientRect();
            if (!rect || (rect.width === 0 && rect.height === 0)) {
                hide();
                return;
            }

            const vw = window.innerWidth;
            const left = Math.min(
                Math.max(rect.left + rect.width / 2, 8 + BAR_WIDTH / 2),
                vw - 8 - BAR_WIDTH / 2
            );
            let top = rect.top - BAR_HEIGHT - 10;
            if (top < 8) top = rect.bottom + 10; // no room above → below

            // Heading state for the H1/H2 buttons — read from the anchor's
            // top-level element (same rule the sidebar uses).
            let blockType = 'paragraph';
            const topElement = selection.anchor.getNode().getTopLevelElement();
            if (topElement && $isHeadingNode(topElement)) blockType = topElement.getTag();

            setBar({
                top,
                left,
                formats: {
                    bold: selection.hasFormat('bold'),
                    italic: selection.hasFormat('italic'),
                    underline: selection.hasFormat('underline'),
                },
                blockType,
            });
        });
    }, [editor, hide]);

    React.useEffect(() => {
        const removeSelectionListener = editor.registerCommand(
            SELECTION_CHANGE_COMMAND,
            () => {
                update();
                return false;
            },
            COMMAND_PRIORITY_LOW
        );
        const removeUpdateListener = editor.registerUpdateListener(update);
        // Editor blur = focus went somewhere real (a dialog, another field):
        // hide. Bar clicks never blur (preventFocusSteal on mousedown).
        const removeBlurListener = editor.registerCommand(
            BLUR_COMMAND,
            () => {
                hide();
                return false;
            },
            COMMAND_PRIORITY_LOW
        );
        return () => {
            removeSelectionListener();
            removeUpdateListener();
            removeBlurListener();
        };
    }, [editor, update, hide]);

    // Follow the selection through scrolls of the editor wrapper (capture
    // catches the nested scroller) and window resizes — only while visible.
    const visible = bar !== null;
    React.useEffect(() => {
        if (!visible) return;
        window.addEventListener('scroll', update, true);
        window.addEventListener('resize', update);
        return () => {
            window.removeEventListener('scroll', update, true);
            window.removeEventListener('resize', update);
        };
    }, [visible, update]);

    const toggleBold = React.useCallback(
        () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold'),
        [editor]
    );
    const toggleItalic = React.useCallback(
        () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic'),
        [editor]
    );
    const toggleUnderline = React.useCallback(
        () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline'),
        [editor]
    );
    const toggleH1 = React.useCallback(
        () => onToggleBlockType && onToggleBlockType('h1'),
        [onToggleBlockType]
    );
    const toggleH2 = React.useCallback(
        () => onToggleBlockType && onToggleBlockType('h2'),
        [onToggleBlockType]
    );

    const boldDown = React.useMemo(() => actOnMouseDown(toggleBold), [toggleBold]);
    const italicDown = React.useMemo(() => actOnMouseDown(toggleItalic), [toggleItalic]);
    const underlineDown = React.useMemo(() => actOnMouseDown(toggleUnderline), [toggleUnderline]);
    const h1Down = React.useMemo(() => actOnMouseDown(toggleH1), [toggleH1]);
    const h2Down = React.useMemo(() => actOnMouseDown(toggleH2), [toggleH2]);
    const linkDown = React.useMemo(() => actOnMouseDown(() => onLink && onLink()), [onLink]);

    if (!bar) return null;

    return createPortal(
        <div
            style={{ ...BAR_STYLE_BASE, top: bar.top, left: bar.left }}
            onMouseDown={preventFocusSteal}
        >
            <IconButton
                size="small"
                title={t("words.bold_ctrl_b")}
                style={bar.formats.bold ? BTN_ACTIVE_STYLE : BTN_STYLE}
                onMouseDown={boldDown}
            >
                <FormatBoldIcon style={ICON_STYLE} />
            </IconButton>
            <IconButton
                size="small"
                title={t("words.italic_ctrl_i")}
                style={bar.formats.italic ? BTN_ACTIVE_STYLE : BTN_STYLE}
                onMouseDown={italicDown}
            >
                <FormatItalicIcon style={ICON_STYLE} />
            </IconButton>
            <IconButton
                size="small"
                title={t("components.floating_format_bar.underline_ctrl_u")}
                style={bar.formats.underline ? BTN_ACTIVE_STYLE : BTN_STYLE}
                onMouseDown={underlineDown}
            >
                <FormatUnderlinedIcon style={ICON_STYLE} />
            </IconButton>
            <div style={DIVIDER_STYLE} />
            <IconButton
                size="small"
                title={t("words.heading_1")}
                style={bar.blockType === 'h1' ? BTN_ACTIVE_STYLE : BTN_STYLE}
                onMouseDown={h1Down}
            >
                <H1Icon style={ICON_STYLE} />
            </IconButton>
            <IconButton
                size="small"
                title={t("words.heading_2")}
                style={bar.blockType === 'h2' ? BTN_ACTIVE_STYLE : BTN_STYLE}
                onMouseDown={h2Down}
            >
                <H2Icon style={ICON_STYLE} />
            </IconButton>
            <div style={DIVIDER_STYLE} />
            <IconButton
                size="small"
                title={t("components.floating_format_bar.link_ctrl_k")}
                style={BTN_STYLE}
                onMouseDown={linkDown}
            >
                <LinkIcon style={ICON_STYLE} />
            </IconButton>
        </div>,
        document.body
    );
};

export default FloatingFormatBar;