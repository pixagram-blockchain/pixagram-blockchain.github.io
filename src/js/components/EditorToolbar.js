import React from 'preact/compat';
import Tooltip from "@material-ui/core/Tooltip";
import IconButton from "@material-ui/core/IconButton";
import Fab from "@material-ui/core/Fab";
import Grow from "@material-ui/core/Grow";

// Icons
import FormatBoldIcon from "@material-ui/icons/FormatBold";
import FormatItalicIcon from "@material-ui/icons/FormatItalic";
import FormatQuoteIcon from "@material-ui/icons/FormatQuote";
import MarkdownIcon from "../../icons/Markdown";
import LinkIcon from "@material-ui/icons/Link";
import ImageIcon from "@material-ui/icons/Image";
import FormatListBulletedIcon from "@material-ui/icons/FormatListBulleted";
import TitleIcon from "@material-ui/icons/Title";
import UndoIcon from "@material-ui/icons/Undo";
import RedoIcon from "@material-ui/icons/Redo";
import CloseRounded from "@material-ui/icons/CloseRounded";
import EditRounded from "@material-ui/icons/EditRounded";
import TextFormatIcon from "@material-ui/icons/TextFormat";
import Edit from "@material-ui/icons/Edit";

import { t, useLanguage } from "../utils/text";

export const editorToolbarStyles = (theme) => ({
    fixedSidebar: {
        position: "fixed",
        top: "calc(50% + 64px)",
        transform: "translateY(-50%) !important",
        height: "535px",
        width: 48,
        backgroundColor: "#ffffff",
        boxShadow: "2px 0 12px rgba(0,0,0,0.1)",
        zIndex: 1100,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "8px 0",
        borderRadius: "16px",
        marginLeft: "-24px",
        gap: 2,
        "& .close, & .edit": {
            display: "none"
        },
        [theme.breakpoints.down("sm")]: {
            right: 14,
            width: 40,
            padding: 4,
            height: 40,
            top: "75%",
            overflow: "hidden",
            transform: "translateY(-75%) !important",
            transition: "opacity 196ms cubic-bezier(0.4, 0, 0.2, 1), transform 131ms cubic-bezier(0.4, 0, 0.2, 1), height 180ms cubic-bezier(0.4, 0, 0.2, 1) 5ms, max-height 180ms cubic-bezier(0.4, 0, 0.2, 1) 5ms !important",
            "&.opened": {
                top: "75%",
                padding: 8,
                transition: "opacity 196ms cubic-bezier(0.4, 0, 0.2, 1), transform 131ms cubic-bezier(0.4, 0, 0.2, 1), height 180ms cubic-bezier(0.4, 0, 0.2, 1) 5ms, max-height 180ms cubic-bezier(0.4, 0, 0.2, 1) 5ms !important",
                height: "410px",
            },
            "& .close": {
                display: "none",
            },
            "& .edit": {
                display: "initial"
            },
            "&.opened .close": {
                display: "initial"
            },
        }
    },
    menuIconButton: {
        color: "#616161",
        padding: 0,
        margin: 0,
        height: 48,
        width: 48,
        "& .MuiSvgIcon-root": {
            fontSize: "2rem"
        },
        [theme.breakpoints.down("sm")]: {
            width: 32,
            height: 32,
            padding: 4,
            "& .MuiSvgIcon-root": {
                fontSize: "1.125rem"
            },
        },
        "&:hover": {
            backgroundColor: "rgba(0,0,0,0.1)",
            color: "#212121"
        },
        "&.active": {
            backgroundColor: "rgba(0,0,0,0.2)",
            color: "#101010"
        },
        "&.Mui-disabled": {
            color: "#c9c9c9"
        },
    },
    // Wrapper so the tooltip still fires on a disabled button (MUI can't
    // listen on disabled elements directly).
    menuButtonWrap: {
        display: "flex"
    },
    // Sidebar tooltips: white card, black text, no border, tight radius.
    // border is set explicitly so any global MuiTooltip override loses.
    menuTooltip: {
        backgroundColor: "#ffffff",
        color: "#000000",
        border: "none",
        borderRadius: 8,
        boxShadow: "0 4px 14px rgba(0,0,0,0.22)"
    },
    menuIconButtonFab: {
        position: "fixed",
        marginLeft: "-32px",
        top: "calc(50% - 290px)",
        width: 64,
        height: 64,
        backgroundColor: "#d1d1d1",
        color: "#000",
        boxShadow: "2px 0 12px rgba(0,0,0,0.1)",
        padding: 0,
        margin: 0,
        "& .MuiSvgIcon-root": {
            fontSize: "2rem"
        },
        [theme.breakpoints.down("sm")]: {
            height: 56,
            width: 56,
            marginLeft: "initial",
            marginRight: "6px",
            top: "calc(50% - 232px)",
            right: 0,
            "& .MuiSvgIcon-root": {
                fontSize: "1.125rem"
            },
        },
        "&:hover": {
            backgroundColor: "rgba(0,0,0,0.1)",
            color: "#212121"
        },
        "&.active": {
            backgroundColor: "rgba(0,0,0,0.2)",
            color: "#101010",
            borderRadius: 0,
        },
    },
    menuDivider: {
        width: "calc(100% - 16px)",
        height: 1,
        backgroundColor: "#999",
        margin: "2px 0px"
    },
});

// NOTE on the activeFormats / activeBlockType props: this component used to
// receive hasInlineStyle / hasBlockType ACCESSOR FUNCTIONS instead. Those were
// stable class methods on the parent, which is exactly what broke the active
// highlighting: the function identity never changed while it read fresh state
// at call time, so when the state DID change, React.memo's shallow compare saw
// identical props and served the cached render — the bold/italic/quote buttons
// stayed stale until some unrelated prop moved. Passing the state itself makes
// the memo re-render precisely (and only) on real toolbar transitions.
const EditorToolbar = React.memo(({
                                      classes,
                                      editorMode,
                                      tab,
                                      mobile,
                                      editOpened,
                                      activeFormats,
                                      activeBlockType,
                                      hasSelection,
                                      onToggleEditMenu,
                                      onToggleInlineStyle,
                                      onToggleBlockType,
                                      onToggleEditorMode,
                                      onOpenFormatMenu,
                                      onOpenListMenu,
                                      onOpenHeadingMenu,
                                      onMenuRelease,
                                      onOpenLinkDialog,
                                      onInsertImage,
                                      onUndo,
                                      onRedo
                                  }) => {
    useLanguage();
    // One shared classes object for every sidebar tooltip — memoized so the
    // 12 Tooltip elements below keep a stable identity across renders.
    const tooltipClasses = React.useMemo(() => ({ tooltip: classes.menuTooltip }), [classes]);

    // Stable mouse-down handlers — previously inline `(e) => {…}` lambdas
    // re-created on every toolbar render. preventDefault keeps the editor
    // selection from collapsing when the sidebar button is pressed.
    const onBoldDown = React.useCallback((e) => { e.preventDefault(); onToggleInlineStyle('bold'); }, [onToggleInlineStyle]);
    const onItalicDown = React.useCallback((e) => { e.preventDefault(); onToggleInlineStyle('italic'); }, [onToggleInlineStyle]);
    const onQuoteDown = React.useCallback((e) => { e.preventDefault(); onToggleBlockType('quote'); }, [onToggleBlockType]);

    // ── Hover-open for the three flyout menus ────────────────────────────
    // 120 ms of hover intent opens the menu (so sliding the pointer along
    // the sidebar doesn't flash every menu); leaving the button hands the
    // menu to the parent's grace-period close (onMenuRelease) — entering
    // the menu paper cancels it (see FormatMenus). Click still opens
    // instantly, which also keeps touch devices working.
    const hoverTimerRef = React.useRef(null);
    const cancelHoverOpen = React.useCallback(() => {
        if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
        }
    }, []);
    React.useEffect(() => cancelHoverOpen, [cancelHoverOpen]);

    const scheduleHoverOpen = React.useCallback((open, target) => {
        cancelHoverOpen();
        hoverTimerRef.current = setTimeout(() => {
            hoverTimerRef.current = null;
            open({ currentTarget: target });
        }, 120);
    }, [cancelHoverOpen]);

    const onFormatEnter = React.useCallback((e) => scheduleHoverOpen(onOpenFormatMenu, e.currentTarget), [scheduleHoverOpen, onOpenFormatMenu]);
    const onListEnter = React.useCallback((e) => scheduleHoverOpen(onOpenListMenu, e.currentTarget), [scheduleHoverOpen, onOpenListMenu]);
    const onHeadingEnter = React.useCallback((e) => scheduleHoverOpen(onOpenHeadingMenu, e.currentTarget), [scheduleHoverOpen, onOpenHeadingMenu]);

    const onFormatLeave = React.useCallback(() => { cancelHoverOpen(); if (onMenuRelease) onMenuRelease('format'); }, [cancelHoverOpen, onMenuRelease]);
    const onListLeave = React.useCallback(() => { cancelHoverOpen(); if (onMenuRelease) onMenuRelease('list'); }, [cancelHoverOpen, onMenuRelease]);
    const onHeadingLeave = React.useCallback(() => { cancelHoverOpen(); if (onMenuRelease) onMenuRelease('heading'); }, [cancelHoverOpen, onMenuRelease]);

    return (
        <div>
            <Tooltip title={editorMode === 'visual' ? "Switch to markdown code": "Switch to visual editor"} placement="right" classes={tooltipClasses}>
                <Fab
                    className={classes.menuIconButtonFab}
                    onClick={onToggleEditorMode}
                >
                    {editorMode === 'visual' ? <MarkdownIcon /> : <Edit />}
                </Fab>
            </Tooltip>
            {
                (editorMode !== 'visual' || (mobile && parseInt(tab) === 1)) ? null:
                    <Grow in={(parseInt(tab) === 0 || !mobile) && editorMode === 'visual'}>
                        <div className={`${classes.fixedSidebar} ${editOpened ? 'opened' : ''}`}>
                            {!editOpened && (
                                <Tooltip title={t("components.editor_toolbar.expand")} placement="right" classes={tooltipClasses}>
                                    <IconButton className={"edit " + classes.menuIconButton} onClick={onToggleEditMenu}>
                                        <EditRounded />
                                    </IconButton>
                                </Tooltip>
                            )}

                            <Tooltip title={t("words.bold_ctrl_b")} placement="right" classes={tooltipClasses}>
                                <IconButton
                                    className={`${classes.menuIconButton} ${activeFormats.bold ? 'active' : ''}`}
                                    onMouseDown={onBoldDown}
                                >
                                    <FormatBoldIcon />
                                </IconButton>
                            </Tooltip>

                            <Tooltip title={t("words.italic_ctrl_i")} placement="right" classes={tooltipClasses}>
                                <IconButton
                                    className={`${classes.menuIconButton} ${activeFormats.italic ? 'active' : ''}`}
                                    onMouseDown={onItalicDown}
                                >
                                    <FormatItalicIcon />
                                </IconButton>
                            </Tooltip>

                            <Tooltip title={t("components.editor_toolbar.quote")} placement="right" classes={tooltipClasses}>
                                <IconButton
                                    className={`${classes.menuIconButton} ${activeBlockType === 'quote' ? 'active' : ''}`}
                                    onMouseDown={onQuoteDown}
                                >
                                    <FormatQuoteIcon />
                                </IconButton>
                            </Tooltip>

                            <div className={classes.menuDivider} />

                            <Tooltip title={t("components.editor_toolbar.more")} placement="right" classes={tooltipClasses}>
                                <IconButton
                                    className={classes.menuIconButton}
                                    onClick={onOpenFormatMenu}
                                    onMouseEnter={onFormatEnter}
                                    onMouseLeave={onFormatLeave}
                                >
                                    <TextFormatIcon />
                                </IconButton>
                            </Tooltip>

                            <Tooltip title={t("components.editor_toolbar.lists")} placement="right" classes={tooltipClasses}>
                                <IconButton
                                    className={classes.menuIconButton}
                                    onClick={onOpenListMenu}
                                    onMouseEnter={onListEnter}
                                    onMouseLeave={onListLeave}
                                >
                                    <FormatListBulletedIcon />
                                </IconButton>
                            </Tooltip>

                            <Tooltip title={t("components.editor_toolbar.heading")} placement="right" classes={tooltipClasses}>
                                <IconButton
                                    className={classes.menuIconButton}
                                    onClick={onOpenHeadingMenu}
                                    onMouseEnter={onHeadingEnter}
                                    onMouseLeave={onHeadingLeave}
                                >
                                    <TitleIcon />
                                </IconButton>
                            </Tooltip>

                            <div className={classes.menuDivider} />

                            <Tooltip title={hasSelection ? "Link (Ctrl+K)" : "Select text to add a link"} placement="right" classes={tooltipClasses}>
                            <span className={classes.menuButtonWrap}>
                                <IconButton
                                    className={classes.menuIconButton}
                                    onClick={onOpenLinkDialog}
                                    disabled={!hasSelection}
                                >
                                    <LinkIcon />
                                </IconButton>
                            </span>
                            </Tooltip>

                            <Tooltip title={t("components.editor_toolbar.image")} placement="right" classes={tooltipClasses}>
                                <IconButton className={classes.menuIconButton} onClick={onInsertImage}>
                                    <ImageIcon />
                                </IconButton>
                            </Tooltip>

                            <div className={classes.menuDivider} />

                            <Tooltip title={t("words.undo")} placement="right" classes={tooltipClasses}>
                                <IconButton className={classes.menuIconButton} onClick={onUndo}>
                                    <UndoIcon />
                                </IconButton>
                            </Tooltip>

                            <Tooltip title={t("components.editor_toolbar.redo")} placement="right" classes={tooltipClasses}>
                                <IconButton className={classes.menuIconButton} onClick={onRedo}>
                                    <RedoIcon />
                                </IconButton>
                            </Tooltip>

                            {editOpened && (
                                <Tooltip title={t("components.editor_toolbar.collapse")} placement="right" classes={tooltipClasses}>
                                    <IconButton
                                        className={"close " + classes.menuIconButton}
                                        style={{ backgroundColor: "#000", color: "#fff", marginTop: 8 }}
                                        onClick={onToggleEditMenu}
                                    >
                                        <CloseRounded />
                                    </IconButton>
                                </Tooltip>
                            )}
                        </div>
                    </Grow>
            }
        </div>
    );
});

export default EditorToolbar;