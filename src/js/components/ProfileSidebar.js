import * as React from "preact/compat";
import Card from "@material-ui/core/Card";
import Typography from "@material-ui/core/Typography";
import ButtonBase from "@material-ui/core/ButtonBase";
import IconButton from "@material-ui/core/IconButton";
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
import Edit from "@material-ui/icons/EditRounded";
import { cssBackgroundImage } from "../utils/safeUrl";

const ProfileSidebar = React.memo(({
                                       classes,
                                       account,
                                       following,
                                       tabValue,
                                       timeAgo,
                                       postsCount,
                                       isOwnProfile,
                                       isLoggedOut,
                                       subscriptions,
                                       vpMana,
                                       rcMana,
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

    const username = account?.name || '';
    const customDisplayName = account?._profile?.display_name || null;
    const displayName = customDisplayName || username || 'Unknown';
    const profileImage = account?._profile?.profile_image || '';

    return (
        <div className={classes.viewRight}>
            <Card className={classes.viewRightTopCard}>
                <div style={{width: "100%", marginTop: "16px", marginBottom: "16px"}}>
                    <div style={{margin: "16px 16px 0px 16px"}}>
                        <Typography style={{fontSize: "32px"}} component="h2" variant="h3">
                            {customDisplayName ? displayName : `@${username}`}
                        </Typography>
                        {customDisplayName && (
                            <Typography style={{fontSize: "18px", margin: "8px 0px 8px 0px", color: "#999"}} component="h3" variant="h5">
                                <span>@{username}</span>
                            </Typography>
                        )}
                    </div>
                    <div style={{width: "100%"}}>
                        <div style={{display: "flex", position: "relative"}}>
                            <div className={classes.walletButtons}>
                                <IconButton className={classes.menuButton} onClick={onWalletOpen} data-tour="profile-wallet"><AccountBalanceWalletRounded/></IconButton>
                            </div>
                            <ButtonBase style={{margin: "16px -4px 16px 16px", borderRadius: "56px 0px 0px 56px"}}>
                                <div className={classes.profileImage + " pixelated"}
                                     style={{backgroundColor: "#1e1e1e", backgroundImage: cssBackgroundImage(profileImage), height: (tabValue === 0) ? "150px": (tabValue === 1) ? "225px": "300px"}}
                                     alt={displayName + " (@" + username + ")"}>
                                    {isOwnProfile && (
                                        <IconButton onClick={onEditProfile} className={classes.menuButtonEdit}><Edit/></IconButton>
                                    )}
                                </div>
                            </ButtonBase>
                        </div>
                    </div>
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
                        isMobile={false}
                    />
                </div>
            </Card>
            <Card className={classes.viewRightBottomCard}>
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
                                containerStyle={{height: "100%"}}
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
                            isOwnProfile={isOwnProfile}
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
            </Card>
        </div>
    );
});

export default ProfileSidebar;