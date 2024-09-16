import * as React from "preact/compat";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import CardContent from "@material-ui/core/CardContent";
import ButtonBase from "@material-ui/core/ButtonBase";
import IconButton from "@material-ui/core/IconButton";
import ArrowDropDown from "@material-ui/icons/ArrowDropDown";
import Collapse from "@material-ui/core/Collapse";
import Fade from "@material-ui/core/Fade";
import Grow from "@material-ui/core/Grow";
import AccountBalanceWalletRounded from "@material-ui/icons/AccountBalanceWalletRounded";
import InfoRounded from "@material-ui/icons/InfoRounded";
import DescriptionRounded from "@material-ui/icons/DescriptionRounded";
import Community from "../icons/Community";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import SwipeableViews from "react-swipeable-views";
import FollowButtons from "./FollowButtons";
import CommunitiesList from "./CommunitiesList";
import ProfileDescription from "./ProfileDescription";
import VotingPowerDisplay from "./VotingPowerDisplay";
import Edit from "@material-ui/icons/Edit";
import { cssBackgroundImage } from "../utils/safeUrl";

const ProfileMobileCard = React.memo(({
                                          classes,
                                          account,
                                          expanded,
                                          following,
                                          tabValue,
                                          height,
                                          y,
                                          scrollTop,
                                          timeAgo,
                                          postsCount,
                                          isOwnProfile,
                                          isLoggedOut,
                                          subscriptions,
                                          vpMana,
                                          rcMana,
                                          onToggleExpanded,
                                          onCloseExpanded,
                                          onOpenFollowersModal,
                                          onOpenFollowingModal,
                                          onToggleFollowing,
                                          onTabChange,
                                          onGoToCommunity,
                                          onCreateCommunity,
                                          onWalletOpen,
                                          onEditProfile
                                      }) => {
    const handleTabChange = React.useCallback((e, v) => {
        onTabChange(e, v);
    }, [onTabChange]);

    // Dismiss on a real CLICK on the backdrop (not a pointer/touch-down), and
    // consume the event. Closing on the actual click keeps the backdrop "live"
    // (pointerEvents:auto) at the moment the click fires, so it absorbs the tap
    // instead of the menu closing on touchstart and letting the synthesized
    // click fall through to a feed card behind it (which would open a post).
    const handleBackdropClick = React.useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        onCloseExpanded();
    }, [onCloseExpanded]);

    const swipeableViewScrollTop = React.useCallback(() => {
        let views = document.getElementsByClassName("react-swipeable-view-container");
        let view = views.item(0);
        if (view) {
            let child = view.children.item(0);
            if (child) {
                child.style.scrollBehavior = "smooth";
                child.scrollTop = 0;
            }
        }
    }, []);

    React.useEffect(() => {
        if (expanded) {
            swipeableViewScrollTop();
        }
    }, [tabValue, expanded, swipeableViewScrollTop]);

    const username = account?.name || '';
    const customDisplayName = account?._profile?.display_name || null;
    const displayName = customDisplayName || username || 'Unknown';
    const fallbackAvatar = `https://images.hive.blog/u/${username}/avatar`;
    const profileBg = cssBackgroundImage(account?._profile?.profile_image, fallbackAvatar);
    const description = account?._profile?.about || '';

    const mobileTitle = customDisplayName
        ? <span><span style={{fontWeight: "bold"}}>{`@${username}`}</span> <span>{`(${customDisplayName})`}</span></span>
        : <span style={{fontWeight: "bold"}}>{`@${username}`}</span>;

    return (
        <React.Fragment>
            <div
                className={`${classes.mobileBackdrop} ${expanded ? classes.mobileBackdropVisible : classes.mobileBackdropHidden}`}
                onClick={handleBackdropClick}
                aria-hidden={!expanded}
            />
            <div className={classes.viewMobile} style={{transform: `translateY(${(48 > y && scrollTop >= 72) ? -96: 0}px)`}}>
                <Card className={(expanded ? classes.viewMobileCardOpened : classes.viewMobileCard)} >
                    <CardHeader
                        onClick={onToggleExpanded}
                        data-tour="profile-card-toggle"
                        avatar={
                            <ButtonBase style={{borderRadius: "12px"}}>
                                <div className={(expanded ? classes.profileImageMobileOpened : classes.profileImageMobile) + " pixelated"}
                                     style={{backgroundImage: profileBg}}
                                     alt={displayName + " (@" + username + ")"}>
                                </div>
                            </ButtonBase>
                        }
                        action={
                            <IconButton aria-label="settings">
                                <ArrowDropDown style={{transition: "transform 225ms cubic-bezier(0.4, 0, 0.2, 1) 5ms !important", transform: `rotate(${expanded ? -180: 0}deg)`}} />
                            </IconButton>
                        }
                        title={mobileTitle}
                        subheader={description}
                    />
                    <Collapse in={expanded} timeout="auto">
                        <CardContent>
                            <div style={{display: "flex"}}>
                                <Fade in={expanded} timeout={450}>
                                    <ButtonBase style={{borderRadius: "32px"}}>
                                        <div className={classes.profileImageMobileBig + " pixelated"}
                                             style={{backgroundImage: profileBg}}
                                             alt={displayName + " (@" + username + ")"}>
                                            {isOwnProfile && (
                                                <IconButton onClick={onEditProfile} className={classes.menuButtonEdit}><Edit/></IconButton>
                                            )}
                                        </div>
                                    </ButtonBase>
                                </Fade>
                                <Fade in={expanded} timeout={450}>
                                    <div style={{width: "100%"}}>
                                        <FollowButtons
                                            classes={classes}
                                            following={following}
                                            isOwnProfile={isOwnProfile}
                                            isLoggedOut={isLoggedOut}
                                            followerCount={account?.follower_count}
                                            followingCount={account?.following_count}
                                            onOpenFollowersModal={onOpenFollowersModal}
                                            onOpenFollowingModal={onOpenFollowingModal}
                                            onToggleFollowing={onToggleFollowing}
                                            isMobile={true}
                                        />
                                    </div>
                                </Fade>
                            </div>
                        </CardContent>
                        <div style={{paddingTop: "64px", position: "relative"}}>
                            <Tabs
                                className={classes.cardTabs}
                                value={tabValue}
                                variant="fullWidth"
                                indicatorColor="primary"
                                textColor="primary"
                                onChange={handleTabChange}
                                fullwidth={true}
                            >
                                <Tab icon={<Community/>} />
                                <Tab icon={<DescriptionRounded/>} />
                                <Tab icon={<InfoRounded/>} />
                            </Tabs>
                            <SwipeableViews ignoreNativeScroll={true}
                                            animateHeight={false}
                                            containerStyle={{height: Math.max(300, Math.min(height-600, 720))}}
                                            animateTransitions={true}
                                            disableLazyLoading={true}
                                            resistance={true}
                                            springConfig={{tension: 450, friction: 60, duration: '120ms', easeFunction: 'cubic-bezier(0.280, 0.840, 0.420, 1)', delay: '5ms'}}
                                            index={tabValue}
                                            onChangeIndex={handleTabChange}
                                            disabled={false}
                                            key={"swipe-able-view-profile"}>
                                <div key={"communities"} className={classes.metadataSwipeableViews}>
                                    <CommunitiesList
                                        classes={classes}
                                        subscriptions={subscriptions}
                                        onGoToCommunity={onGoToCommunity}
                                        onCreateCommunity={onCreateCommunity}
                                    />
                                </div>
                                <div key={"know-more-about"} className={classes.metadataSwipeableViews}>
                                    <ProfileDescription classes={classes} account={account} />
                                </div>
                                <div key={"meta-information"} className={classes.metadataSwipeableViews}>
                                    <VotingPowerDisplay
                                        classes={classes}
                                        timeAgo={timeAgo}
                                        postsCount={postsCount}
                                        account={account}
                                        vpMana={vpMana}
                                        rcMana={rcMana}
                                    />
                                </div>
                            </SwipeableViews>
                        </div>
                    </Collapse>
                    <Grow
                        in={expanded}
                        timeout={{ enter: 300, exit: 180 }}
                        style={{ transformOrigin: "center center", transitionDelay: expanded ? "300ms" : "0ms" }}
                        unmountOnExit
                    >
                        <div className={classes.walletMobileButtons}>
                            <IconButton className={classes.walletMobileButton} onClick={onWalletOpen} data-tour="profile-wallet"><AccountBalanceWalletRounded/></IconButton>
                        </div>
                    </Grow>
                </Card>
            </div>
        </React.Fragment>
    );
});

export default ProfileMobileCard;