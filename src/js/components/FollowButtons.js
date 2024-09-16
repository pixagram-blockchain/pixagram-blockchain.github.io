import * as React from "preact/compat";
import Button from "@material-ui/core/Button";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import BellIcon from "../icons/Bell"
import BellRingIcon from "../icons/BellRing"
import Tooltip from "@material-ui/core/Tooltip";
import AccountArrowLeft from "../icons/AccountArrowLeft";
import AccountArrowRight from "../icons/AccountArrowRight";

import { t, useLanguage } from "../utils/text";

const FollowButtons = React.memo(({
                                      classes,
                                      following,
                                      isOwnProfile,
                                      isLoggedOut,
                                      followerCount,
                                      followingCount,
                                      onOpenFollowersModal,
                                      onOpenFollowingModal,
                                      onToggleFollowing,
                                      isMobile
                                  }) => {
    useLanguage();
    const formatCount = (count) => {
        if (count === undefined || count === null) return '0';
        if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
        if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
        return count.toString();
    };

    const containerClass = isMobile ? classes.followButtonsMobile : classes.followButtons;

    return (
        <div className={containerClass}>
            <ButtonGroup variant="contained" aria-label={t("components.follow_buttons.follow_actions")}>
                <Button onClick={onOpenFollowersModal}>
                    <Typography component="span" style={{ textTransform: 'none' }}>
                        <span style={{ marginRight: 4, opacity: 0.8 }}><AccountArrowLeft/></span>
                        <strong>{formatCount(followerCount)}</strong>
                    </Typography>
                </Button>
                <Button onClick={onOpenFollowingModal}>
                    <Typography component="span" style={{ textTransform: 'none' }}>
                        <span style={{ marginRight: 4, opacity: 0.8 }}><AccountArrowRight/></span>
                        <strong>{formatCount(followingCount)}</strong>
                    </Typography>
                </Button>
            </ButtonGroup>
            {!isOwnProfile && (
                <Tooltip arrow enterTouchDelay={200} leaveTouchDelay={4000} title={isLoggedOut ? "You must create an account or login to follow this account": following ? "You are following this account": "You are not following this account"}>
                    <IconButton
                        disabled={isLoggedOut}
                        variant="contained"
                        className={classes.whiteButton}
                        onClick={onToggleFollowing}
                        style={{ width: 48, arginTop: isMobile ? 8 : 0, marginLeft: isMobile ? 0 : 8 }}
                    >
                        {following ? <BellRingIcon/> : <BellIcon/>}
                    </IconButton>
                </Tooltip>
            )}
        </div>
    );
});

export default FollowButtons;
