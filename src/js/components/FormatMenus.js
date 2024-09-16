import React from 'preact/compat';
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";

import FormatUnderlinedIcon from "@material-ui/icons/FormatUnderlined";
import FormatStrikethroughIcon from "@material-ui/icons/FormatStrikethrough";
import CodeIcon from "@material-ui/icons/Code";
import FormatListBulletedIcon from "@material-ui/icons/FormatListBulleted";
import FormatListNumberedIcon from "@material-ui/icons/FormatListNumbered";
import H1Icon from "../../icons/H1";
import H2Icon from "../../icons/H2";
import H3Icon from "../../icons/H3";
import PIcon from "../../icons/P";

import { t, useLanguage } from "../utils/text";

// Menus are portals on document.body: arrow keys / Enter used to navigate
// them must not reach document-level hotkey listeners. MUI's own MenuList
// key handling runs below the Paper, so it is unaffected; Escape passes
// through so the menu can still close.
const stopKeyLeak = (e) => {
    if (e.key !== 'Escape' && e.key !== 'Esc') e.stopPropagation();
};

// Pressing a menu item must not blur the editor: a blur can collapse or
// drop the text selection the item's action is about to operate on.
const preventFocusSteal = (e) => e.preventDefault();

export const formatMenuStyles = (theme) => ({
    formatMenu: {
        "& .MuiPaper-root": {
            backgroundColor: "#e3e3e3",
            borderRadius: 16,
            boxShadow: "0 4px 24px rgba(0,0,0,0.12)"
        },
        "& .MuiListItemText-root": {
            color: "#171717"
        },
        "& .MuiListItemIcon-root": {
            color: "#0c0c0c"
        },
    },
});

// The menus open on hover (see EditorToolbar): they must never steal focus
// from the editor — an editor blur would gray out the user's selection just
// because the pointer grazed a trigger. Hence autoFocus={false} + the three
// disable*Focus modal props. pointerEvents:'none' on the Menu root turns
// off the invisible full-screen backdrop, so the rest of the UI stays
// hoverable while a menu is open (that's what makes sliding from one
// trigger straight onto the next feel instant); the paper re-enables its
// own pointer events. Since the backdrop no longer catches click-away, the
// document-level mousedown listener below closes on any outside press —
// which is also what makes tap-away work on touch.
const HOVER_MENU_ROOT_STYLE = { pointerEvents: 'none' };

// Fly out to the RIGHT of the trigger, top-aligned, with a small gap.
// MUI's Menu default is Select-style: it aligns the paper over the anchor
// (and getContentAnchorEl vertically shifts it to line the first item up
// with the anchor), so the flyout landed on top of the very button that
// opened it. getContentAnchorEl must be nulled or that content-alignment
// keeps fighting the explicit origins. The 8px gap is bridged by the
// hold/release grace period, so the menu doesn't close while crossing it.
const MENU_ANCHOR_ORIGIN = { vertical: 'top', horizontal: 'right' };
const MENU_TRANSFORM_ORIGIN = { vertical: 'top', horizontal: 'left' };

const FormatMenus = React.memo(({
                                    classes,
                                    formatMenuAnchor,
                                    headingMenuAnchor,
                                    listMenuAnchor,
                                    onCloseFormatMenu,
                                    onCloseHeadingMenu,
                                    onCloseListMenu,
                                    onMenuHold,
                                    onMenuRelease,
                                    onToggleInlineStyle,
                                    onToggleBlockType
                                }) => {
    useLanguage();
    // Per-menu PaperProps: hovering the paper cancels the pending close
    // (hold), leaving it schedules one (release). Memoized — the handlers
    // are stable class methods on the parent dialog.
    const formatPaperProps = React.useMemo(() => ({
        className: 'hover-menu-paper',
        style: { pointerEvents: 'auto', marginLeft: 8 },
        onMouseDown: preventFocusSteal,
        onKeyDown: stopKeyLeak,
        onKeyUp: stopKeyLeak,
        onMouseEnter: () => onMenuHold && onMenuHold('format'),
        onMouseLeave: () => onMenuRelease && onMenuRelease('format'),
    }), [onMenuHold, onMenuRelease]);
    const headingPaperProps = React.useMemo(() => ({
        className: 'hover-menu-paper',
        style: { pointerEvents: 'auto', marginLeft: 8 },
        onMouseDown: preventFocusSteal,
        onKeyDown: stopKeyLeak,
        onKeyUp: stopKeyLeak,
        onMouseEnter: () => onMenuHold && onMenuHold('heading'),
        onMouseLeave: () => onMenuRelease && onMenuRelease('heading'),
    }), [onMenuHold, onMenuRelease]);
    const listPaperProps = React.useMemo(() => ({
        className: 'hover-menu-paper',
        style: { pointerEvents: 'auto', marginLeft: 8 },
        onMouseDown: preventFocusSteal,
        onKeyDown: stopKeyLeak,
        onKeyUp: stopKeyLeak,
        onMouseEnter: () => onMenuHold && onMenuHold('list'),
        onMouseLeave: () => onMenuRelease && onMenuRelease('list'),
    }), [onMenuHold, onMenuRelease]);

    // Backdrop-free click-away: any mousedown outside a menu paper closes
    // whichever menus are open. Capture phase so stopPropagation elsewhere
    // can't swallow it.
    const anyOpen = Boolean(formatMenuAnchor || headingMenuAnchor || listMenuAnchor);
    React.useEffect(() => {
        if (!anyOpen) return;
        const onDocMouseDown = (e) => {
            const target = e.target;
            if (target && target.closest && target.closest('.hover-menu-paper')) return;
            if (formatMenuAnchor) onCloseFormatMenu();
            if (headingMenuAnchor) onCloseHeadingMenu();
            if (listMenuAnchor) onCloseListMenu();
        };
        document.addEventListener('mousedown', onDocMouseDown, true);
        return () => document.removeEventListener('mousedown', onDocMouseDown, true);
    }, [anyOpen, formatMenuAnchor, headingMenuAnchor, listMenuAnchor,
        onCloseFormatMenu, onCloseHeadingMenu, onCloseListMenu]);

    return (
        <React.Fragment>
            <Menu
                className={classes.formatMenu}
                style={HOVER_MENU_ROOT_STYLE}
                PaperProps={formatPaperProps}
                anchorEl={formatMenuAnchor}
                open={Boolean(formatMenuAnchor)}
                onClose={onCloseFormatMenu}
                getContentAnchorEl={null}
                anchorOrigin={MENU_ANCHOR_ORIGIN}
                transformOrigin={MENU_TRANSFORM_ORIGIN}
                autoFocus={false}
                disableAutoFocus
                disableEnforceFocus
                disableRestoreFocus
            >
                <MenuItem onMouseDown={(e) => { if (e.button !== 0) return; e.preventDefault(); onToggleInlineStyle('underline'); onCloseFormatMenu(); }}>
                    <ListItemIcon><FormatUnderlinedIcon /></ListItemIcon>
                    <ListItemText primary={t("components.format_menus.underline")} />
                </MenuItem>
                <MenuItem onMouseDown={(e) => { if (e.button !== 0) return; e.preventDefault(); onToggleInlineStyle('strikethrough'); onCloseFormatMenu(); }}>
                    <ListItemIcon><FormatStrikethroughIcon /></ListItemIcon>
                    <ListItemText primary={t("components.format_menus.strikethrough")} />
                </MenuItem>
                <MenuItem onMouseDown={(e) => { if (e.button !== 0) return; e.preventDefault(); onToggleInlineStyle('code'); onCloseFormatMenu(); }}>
                    <ListItemIcon><CodeIcon /></ListItemIcon>
                    <ListItemText primary={t("components.format_menus.code")} />
                </MenuItem>
            </Menu>
            <Menu
                className={classes.formatMenu}
                style={HOVER_MENU_ROOT_STYLE}
                PaperProps={headingPaperProps}
                anchorEl={headingMenuAnchor}
                open={Boolean(headingMenuAnchor)}
                onClose={onCloseHeadingMenu}
                getContentAnchorEl={null}
                anchorOrigin={MENU_ANCHOR_ORIGIN}
                transformOrigin={MENU_TRANSFORM_ORIGIN}
                autoFocus={false}
                disableAutoFocus
                disableEnforceFocus
                disableRestoreFocus
            >
                <MenuItem onMouseDown={(e) => { if (e.button !== 0) return; e.preventDefault(); onToggleBlockType('h1'); onCloseHeadingMenu(); }}>
                    <ListItemIcon><H1Icon /></ListItemIcon>
                    <ListItemText primary={t("words.heading_1")} />
                </MenuItem>
                <MenuItem onMouseDown={(e) => { if (e.button !== 0) return; e.preventDefault(); onToggleBlockType('h2'); onCloseHeadingMenu(); }}>
                    <ListItemIcon><H2Icon /></ListItemIcon>
                    <ListItemText primary={t("words.heading_2")} />
                </MenuItem>
                <MenuItem onMouseDown={(e) => { if (e.button !== 0) return; e.preventDefault(); onToggleBlockType('h3'); onCloseHeadingMenu(); }}>
                    <ListItemIcon><H3Icon /></ListItemIcon>
                    <ListItemText primary={t("components.format_menus.heading_3")} />
                </MenuItem>
                <MenuItem onMouseDown={(e) => { if (e.button !== 0) return; e.preventDefault(); onToggleBlockType('paragraph'); onCloseHeadingMenu(); }}>
                    <ListItemIcon><PIcon /></ListItemIcon>
                    <ListItemText primary={t("components.format_menus.paragraph")} />
                </MenuItem>
            </Menu>
            <Menu
                className={classes.formatMenu}
                style={HOVER_MENU_ROOT_STYLE}
                PaperProps={listPaperProps}
                anchorEl={listMenuAnchor}
                open={Boolean(listMenuAnchor)}
                onClose={onCloseListMenu}
                getContentAnchorEl={null}
                anchorOrigin={MENU_ANCHOR_ORIGIN}
                transformOrigin={MENU_TRANSFORM_ORIGIN}
                autoFocus={false}
                disableAutoFocus
                disableEnforceFocus
                disableRestoreFocus
            >
                <MenuItem onMouseDown={(e) => { if (e.button !== 0) return; e.preventDefault(); onToggleBlockType('bullet'); onCloseListMenu(); }}>
                    <ListItemIcon><FormatListBulletedIcon /></ListItemIcon>
                    <ListItemText primary={t("components.format_menus.bullet_list")} />
                </MenuItem>
                <MenuItem onMouseDown={(e) => { if (e.button !== 0) return; e.preventDefault(); onToggleBlockType('number'); onCloseListMenu(); }}>
                    <ListItemIcon><FormatListNumberedIcon /></ListItemIcon>
                    <ListItemText primary={t("components.format_menus.numbered_list")} />
                </MenuItem>
            </Menu>
        </React.Fragment>
    );
});

export default FormatMenus;