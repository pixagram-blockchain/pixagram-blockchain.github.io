import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import MenuItem from "@material-ui/core/MenuItem";
import MenuList from "@material-ui/core/MenuList";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import Menu from "@material-ui/core/Menu";
import VoteIcon from "../icons/Vote";
// The toolbar's and the wallet's Trade buttons wear the same chart icon.
import TradeIcon from "@material-ui/icons/ShowChartRounded";
import SettingsIcon from "@material-ui/icons/Settings";
import BallotIcon from "@material-ui/icons/Ballot";
import HelpIcon from "@material-ui/icons/Help";
import TelegramIcon from "@material-ui/icons/Telegram";
import { Divider } from "@material-ui/core";

import { t, useLanguage } from "../utils/text";
import { HELP_TELEGRAM_URL } from "../utils/constants";

const { useMemo, memo } = React;

const styles = theme => ({
    // Trade, first in the menu: a light grey pill, white on hover or focus —
    // this entry stands in for the toolbar's Trade button, which compact
    // layouts hide.
    tradeItem: {
        margin: "4px 8px",
        borderRadius: 12,
        color: "#000000",
        backgroundColor: "#d0d0d0",
        "&:hover, &.Mui-focusVisible": {
            backgroundColor: "#ffffff",
        },
        // MUI clears a list item's hover fill on touch screens, which would
        // leave the black label on the dark menu after a tap: keep it white.
        "@media (hover: none)": {
            "&:hover": { backgroundColor: "#ffffff" },
        },
        "& .MuiListItemIcon-root": { color: "#000000" },
        "& .MuiListItemText-primary": { fontWeight: 700 },
    },
    // The wallet Trade button's shine (tradeShine in PixaWalletDialog, where
    // the geometry and timing are explained): a pure white streak crossing
    // the entry from the top right corner to the bottom left, bright for
    // about 0.5 s, then 3 s of rest. Only on while the menu is open, so
    // every opening restarts it: the -2.7 s delay puts the first sweep 0.3 s
    // in, right after the menu's 125 ms entrance.
    "@keyframes tradeShine": {
        "0%, 82.192%": { transform: "translate(22.667%, -22.667%)" },
        "100%": { transform: "translate(-22.667%, 22.667%)" },
    },
    tradeShine: {
        overflow: "hidden",
        isolation: "isolate",
        "&::after": {
            content: "''",
            position: "absolute",
            top: "-100%",
            left: "-100%",
            width: "300%",
            height: "300%",
            zIndex: -1,
            pointerEvents: "none",
            background: "linear-gradient(225deg, rgba(255, 255, 255, 0) 44%, rgba(255, 255, 255, 0.85) 48.5%, #ffffff 50%, rgba(255, 255, 255, 0.85) 51.5%, rgba(255, 255, 255, 0) 56%)",
            transform: "translate(22.667%, -22.667%)",
            animationName: "$tradeShine",
            animationDuration: "3.65s",
            animationTimingFunction: "linear",
            animationIterationCount: "infinite",
            animationDelay: "-2.7s",
            "@media (prefers-reduced-motion: reduce)": {
                animationName: "none",
            },
        },
    },
});

// Memoized menu items to prevent re-renders. useLanguage() so a language
// switch still re-renders them: their props don't change when it happens.
const MenuItems = React.memo(({
                                  classes,
                                  shine,
                                  onTradeClick,
                                  onWitnessesClick,
                                  onInfoClick,
                                  onSettingsClick
                              }) => {
    useLanguage();
    return (
        <MenuList>
            {/* Trade: the exchange picker, with the wallet Trade button's own
                label — "Trade", never "Buy". Shines while the menu is open. */}
            <MenuItem onClick={onTradeClick} className={shine ? `${classes.tradeItem} ${classes.tradeShine}` : classes.tradeItem}>
                <ListItemIcon>
                    <TradeIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={t("components.pixa_wallet_dialog.trade")} />
            </MenuItem>
            <Divider />
            {/* Ask Help: the community's Telegram group, as a real link
                (component="a") — the entry the desktop toolbar shows left of
                Governance. */}
            <MenuItem component="a" href={HELP_TELEGRAM_URL} target="_blank" rel="noopener noreferrer">
                <ListItemIcon>
                    <TelegramIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={t("words.ask_help")} />
            </MenuItem>
            <MenuItem onClick={onWitnessesClick}>
                <ListItemIcon>
                    <VoteIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={t("words.governance")} />
            </MenuItem>
            <MenuItem style={{display: "none"}}>
                <ListItemIcon>
                    <BallotIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={t("components.toolbar_menu_option.proposals")} />
            </MenuItem>
            <MenuItem onClick={onInfoClick}>
                <ListItemIcon>
                    <HelpIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={t("components.toolbar_menu_option.info")} />
            </MenuItem>
            <Divider />
            <MenuItem onClick={onSettingsClick}>
                <ListItemIcon>
                    <SettingsIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={t("words.settings")} />
            </MenuItem>
        </MenuList>
    );
});

MenuItems.displayName = "MenuItems";

const PaperCardMenuOption = ({
                                 classes,
                                 xy = [],
                                 onClose,
                                 onTradeClick,
                                 onWitnessesClick,
                                 onInfoClick,
                                 onSettingsClick
                             }) => {
    useLanguage();
    // Memoize coordinates
    const [menuMouseX, menuMouseY] = useMemo(() => {
        return [xy[0] | 0, xy[1] | 0];
    }, [xy[0], xy[1]]);

    // Memoize menu open state
    const isOpen = useMemo(() => {
        return Boolean(menuMouseY) || Boolean(menuMouseX);
    }, [menuMouseY, menuMouseX]);

    // Memoize paper props
    const paperProps = useMemo(() => ({
        style: {
            overflowY: "overlay",
            contain: "style layout",
            scrollBehavior: "smooth",
            userSelect: "none",
            pointerEvents: isOpen ? "all" : "none"
        }
    }), [isOpen]);

    // Memoize anchor position
    const anchorPosition = useMemo(() => ({
        top: menuMouseY,
        left: menuMouseX
    }), [menuMouseY, menuMouseX]);

    // Memoize transition duration
    const transitionDuration = useMemo(() => ({
        enter: 125,
        exit: 250
    }), []);

    // Memoize menu list props
    const menuListProps = useMemo(() => ({
        dense: true
    }), []);

    return (
        <Menu
            className={classes.menu}
            PaperProps={paperProps}
            onContextMenu={(e) => e.preventDefault()}
            MenuListProps={menuListProps}
            transitionDuration={transitionDuration}
            open={isOpen}
            onClose={onClose}
            disablePortal={false}
            keepMounted={true}
            anchorReference="anchorPosition"
            anchorPosition={anchorPosition}
        >
            <MenuItems
                classes={classes}
                shine={isOpen}
                onTradeClick={onTradeClick}
                onWitnessesClick={onWitnessesClick}
                onInfoClick={onInfoClick}
                onSettingsClick={onSettingsClick}
            />
        </Menu>
    );
};

// Custom comparison function for React.memo
const arePropsEqual = (prevProps, nextProps) => {
    // Compare xy coordinates
    if (prevProps.xy?.[0] !== nextProps.xy?.[0] ||
        prevProps.xy?.[1] !== nextProps.xy?.[1]) {
        return false;
    }

    // Compare event handlers (reference equality)
    if (prevProps.onClose !== nextProps.onClose ||
        prevProps.onTradeClick !== nextProps.onTradeClick ||
        prevProps.onWitnessesClick !== nextProps.onWitnessesClick ||
        prevProps.onInfoClick !== nextProps.onInfoClick ||
        prevProps.onSettingsClick !== nextProps.onSettingsClick) {
        return false;
    }

    // Compare classes
    if (prevProps.classes !== nextProps.classes) {
        return false;
    }

    // Props are equal, skip re-render
    return true;
};

PaperCardMenuOption.displayName = "PaperCardMenuOption";

// Memoize the component with custom comparison
const MemoizedPaperCardMenuOption = React.memo(PaperCardMenuOption, arePropsEqual);

export default withStyles(styles)(MemoizedPaperCardMenuOption);