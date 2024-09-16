import * as React from "preact/compat";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import SwipeableViews from "react-swipeable-views";
import GroupRounded from "@material-ui/icons/GroupRounded";
import GavelRounded from "@material-ui/icons/GavelRounded";
import InfoRounded from "@material-ui/icons/InfoRounded";
import MembersSection from "./MembersSection";
import RulesSection from "./RulesSection";
import AboutSection from "./AboutSection";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import {useTheme} from "@material-ui/core/styles";

const MetadataPanel = React.memo(({
                                      tabValue,
                                      onTabChange,
                                      members,
                                      rules,
                                      community,
                                      postsCount,
                                      timeAgo,
                                      height,
                                      isAdmin,
                                      onAddSomeone,
                                      addSomeoneClass,
                                      cardTabsClass,
                                      metadataSwipeableViewsClass,
                                      memberListItemClass,
                                      memberBadgeClass,
                                      roleChipClass,
                                      metaListHeaderClass,
                                      isFullHeight
                                  }) => {
    const swipeableViewScrollTop = React.useCallback(() => {
        let views = document.getElementsByClassName("react-swipeable-view-container");
        if (views.length > 0) {
            let view = views.item(0);
            let child = view.children.item(0);
            child.style.scrollBehavior = "smooth";
            child.scrollTop = 0;
        }
    }, []);

    const handleTabChange = React.useCallback((e, value) => {
        onTabChange(e, value);
        setTimeout(swipeableViewScrollTop, 50);
    }, [onTabChange, swipeableViewScrollTop]);

    const containerStyle = isFullHeight
        ? { height: "100%" }
        : { height: Math.max(300, Math.min(height - 600, 720)) };

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    return (
        <div style={{ marginTop: isMobile ? 0: 0, paddingTop: isFullHeight ? 72 : 64, position: "relative" }}>
            <Tabs
                className={cardTabsClass}
                value={tabValue}
                variant="fullWidth"
                indicatorColor="primary"
                textColor="primary"
                onChange={handleTabChange}
                fullwidth={true}
            >
                <Tab icon={<GroupRounded/>} />
                <Tab icon={<GavelRounded/>} />
                <Tab icon={<InfoRounded/>} />
            </Tabs>
            <SwipeableViews
                ignoreNativeScroll={true}
                animateHeight={false}
                containerStyle={containerStyle}
                animateTransitions={true}
                disableLazyLoading={true}
                resistance={true}
                springConfig={{
                    tension: 450,
                    friction: 60,
                    duration: '120ms',
                    easeFunction: 'cubic-bezier(0.280, 0.840, 0.420, 1)',
                    delay: '5ms'
                }}
                index={tabValue}
                onChangeIndex={(v) => handleTabChange({}, v)}
                disabled={false}
                key={"swipe-able-view-community"}
            >
                <div key={"members"} className={metadataSwipeableViewsClass}>
                    <MembersSection
                        members={members}
                        timeAgo={timeAgo}
                        isAdmin={isAdmin}
                        onAddSomeone={onAddSomeone}
                        addSomeoneClass={addSomeoneClass}
                        memberListItemClass={memberListItemClass}
                        memberBadgeClass={memberBadgeClass}
                        roleChipClass={roleChipClass}
                        metaListHeaderClass={metaListHeaderClass}
                    />
                </div>
                <div key={"rules"} className={metadataSwipeableViewsClass}>
                    <RulesSection
                        rules={rules}
                        metaListHeaderClass={metaListHeaderClass}
                    />
                </div>
                <div key={"about"} className={metadataSwipeableViewsClass}>
                    <AboutSection
                        community={community}
                        postsCount={postsCount}
                        timeAgo={timeAgo}
                        metaListHeaderClass={metaListHeaderClass}
                    />
                </div>
            </SwipeableViews>
        </div>
    );
}, (prevProps, nextProps) => {
    return prevProps.tabValue === nextProps.tabValue &&
        prevProps.members === nextProps.members &&
        prevProps.rules === nextProps.rules &&
        prevProps.community === nextProps.community &&
        prevProps.postsCount === nextProps.postsCount &&
        prevProps.height === nextProps.height &&
        prevProps.isAdmin === nextProps.isAdmin;
});

export default MetadataPanel;