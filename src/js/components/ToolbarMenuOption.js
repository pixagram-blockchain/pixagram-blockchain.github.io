import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import MenuItem from "@material-ui/core/MenuItem";
import MenuList from "@material-ui/core/MenuList";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import Menu from "@material-ui/core/Menu";
import VoteIcon from "../icons/Vote";
import SaleIcon from "../icons/Sale";
import SettingsIcon from "@material-ui/icons/Settings";
import BallotIcon from "@material-ui/icons/Ballot";
import HelpIcon from "@material-ui/icons/Help";
import { Divider } from "@material-ui/core";

import { t, useLanguage } from "../utils/text";

const { useMemo, memo } = React;

const styles = theme => ({});

// Memoized menu items to prevent re-renders
const MenuItems = React.memo(({
                            onIcoClick,
                            onWitnessesClick,
                            onInfoClick,
                            onSettingsClick
                        }) => (
    <MenuList>
        <MenuItem onClick={onIcoClick}>
            <ListItemIcon>
                <SaleIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={t("components.toolbar_menu_option.shop")} secondary={t("components.toolbar_menu_option.buy_now")} />
        </MenuItem>
        <Divider />
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
));

MenuItems.displayName = "MenuItems";

const PaperCardMenuOption = ({
                                 classes,
                                 xy = [],
                                 onClose,
                                 onIcoClick,
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
                onIcoClick={onIcoClick}
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
        prevProps.onIcoClick !== nextProps.onIcoClick ||
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