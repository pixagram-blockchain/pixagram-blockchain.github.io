import * as React from "preact/compat";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import CardContent from "@material-ui/core/CardContent";
import Collapse from "@material-ui/core/Collapse";
import Fade from "@material-ui/core/Fade";
import Grow from "@material-ui/core/Grow";
import IconButton from "@material-ui/core/IconButton";
import ArrowDropDown from "@material-ui/icons/ArrowDropDown";
import EditIcon from "@material-ui/icons/Edit";
import Pen from "../icons/Pen";
import CommunityImage from "./CommunityImage";
import ActionButtons from "./ActionButtons";
import MetadataPanel from "./MetadataPanel";

import { t, useLanguage } from "../utils/text";

// Hoisted static styles — were inline literals re-created on every render.
const EMPTY_STYLE = {};
const ARROW_CLOSED_STYLE = {
    transition: "transform 225ms cubic-bezier(0.4, 0, 0.2, 1) 5ms !important",
    transform: "rotate(0deg)"
};
const ARROW_OPEN_STYLE = {
    transition: "transform 225ms cubic-bezier(0.4, 0, 0.2, 1) 5ms !important",
    transform: "rotate(-180deg)"
};
const GROW_CLOSED_STYLE = { transformOrigin: "center center", transitionDelay: "0ms" };
const GROW_OPEN_STYLE = { transformOrigin: "center center", transitionDelay: "300ms" };
const ST_C_717171 = { color: "#717171" };
const ST_FW_BOLD = { fontWeight: "bold" };
const ST_D_FLEX = { display: "flex" };
const ST_POS_RELATIVE = { position: "relative" };
const ST_M_0PX = { margin: "0px" };
const ST_TOP_8__RIGHT_8__LEFT_AUTO = { top: 8, right: 8, left: "auto" };
const ST_FS_18 = { fontSize: 18 };


const CommunityHeader = React.memo(({
                                        community,
                                        members,
                                        rules,
                                        postsCount,
                                        mobileCardExpanded,
                                        joined,
                                        tabValue,
                                        y,
                                        scrollTop,
                                        height,
                                        timeAgo,
                                        isAdmin,
                                        onToggleMobileCard,
                                        onCloseMobileCard,
                                        onToggleJoined,
                                        onViewMembers,
                                        onTabChange,
                                        onTextEditor,
                                        onEditCommunity,
                                        classes
                                    }) => {
    useLanguage();
    const transform = `translateY(${(48 > y && scrollTop >= 72) ? -96 : 0}px)`;

    // Dismiss on a real CLICK on the backdrop (not a pointer/touch-down), and
    // consume the event so the synthesized click can't fall through to a feed
    // card behind it and open a post. Matches ProfileMobileCard.
    const handleBackdropClick = React.useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        onCloseMobileCard();
    }, [onCloseMobileCard]);

    return (
        <React.Fragment>
            <div
                className={`${classes.mobileBackdrop} ${mobileCardExpanded ? classes.mobileBackdropVisible : classes.mobileBackdropHidden}`}
                onClick={handleBackdropClick}
                aria-hidden={!mobileCardExpanded}
            />
            <div className={classes.viewMobile} style={{transform}}>
                <Card className={mobileCardExpanded ? classes.viewMobileCardOpened : classes.viewMobileCard}>
                    <CardHeader
                        onClick={onToggleMobileCard}
                        data-tour="community-card-toggle"
                        avatar={
                            <CommunityImage
                                image={community.image}
                                name={community.name}
                                className={mobileCardExpanded ? classes.communityImageMobileOpened : classes.communityImageMobile}
                                style={EMPTY_STYLE}
                            />
                        }
                        action={
                            <IconButton aria-label="settings">
                                <ArrowDropDown style={mobileCardExpanded ? ARROW_OPEN_STYLE : ARROW_CLOSED_STYLE} />
                            </IconButton>
                        }
                        title={
                            <span>
                                <span style={ST_C_717171}>{t("words.portal")} </span>
                                <span style={ST_FW_BOLD}>{community.name}</span>
                            </span>
                        }
                        subheader={community.about}
                    />
                    <Collapse in={mobileCardExpanded} timeout="auto">
                        <CardContent>
                            <div style={ST_D_FLEX}>
                                <Fade in={mobileCardExpanded} timeout={450}>
                                    <div style={ST_POS_RELATIVE}>
                                        <CommunityImage
                                            image={community.image}
                                            name={community.name}
                                            className={classes.communityImageMobileBig}
                                            style={ST_M_0PX}
                                        />
                                        {isAdmin && onEditCommunity && (
                                            <IconButton
                                                className={classes.menuButtonEdit}
                                                onClick={onEditCommunity}
                                                style={ST_TOP_8__RIGHT_8__LEFT_AUTO}
                                            >
                                                <EditIcon style={ST_FS_18} />
                                            </IconButton>
                                        )}
                                    </div>
                                </Fade>
                                <Fade in={mobileCardExpanded} timeout={450}>
                                    <ActionButtons
                                        joined={joined}
                                        onToggleJoined={onToggleJoined}
                                        onViewMembers={onViewMembers}
                                        isMobile={true}
                                        actionButtonsClass={classes.actionButtons}
                                        actionButtonsMobileClass={classes.actionButtonsMobile}
                                    />
                                </Fade>
                            </div>
                        </CardContent>
                        <MetadataPanel
                            tabValue={tabValue}
                            onTabChange={onTabChange}
                            members={members}
                            rules={rules}
                            community={community}
                            postsCount={postsCount}
                            timeAgo={timeAgo}
                            height={height}
                            cardTabsClass={classes.cardTabs}
                            metadataSwipeableViewsClass={classes.metadataSwipeableViews}
                            memberListItemClass={classes.memberListItem}
                            memberBadgeClass={classes.memberBadge}
                            roleChipClass={classes.roleChip}
                            metaListHeaderClass={classes.metaListHeader}
                            isFullHeight={false}
                        />
                    </Collapse>
                    <Grow
                        in={mobileCardExpanded}
                        timeout={{ enter: 300, exit: 180 }}
                        style={mobileCardExpanded ? GROW_OPEN_STYLE : GROW_CLOSED_STYLE}
                        unmountOnExit
                    >
                        <div className={classes.writeMobileButtons}>
                            <IconButton className={classes.writeMobileButton} onClick={onTextEditor} data-tour="community-write">
                                <Pen/>
                            </IconButton>
                        </div>
                    </Grow>
                </Card>
            </div>
        </React.Fragment>
    );
}, (prevProps, nextProps) => {
    return prevProps.mobileCardExpanded === nextProps.mobileCardExpanded &&
        prevProps.joined === nextProps.joined &&
        prevProps.tabValue === nextProps.tabValue &&
        prevProps.y === nextProps.y &&
        prevProps.scrollTop === nextProps.scrollTop &&
        prevProps.community === nextProps.community &&
        prevProps.members === nextProps.members &&
        prevProps.rules === nextProps.rules &&
        prevProps.postsCount === nextProps.postsCount &&
        prevProps.isAdmin === nextProps.isAdmin;
});

export default CommunityHeader;