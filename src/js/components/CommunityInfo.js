import * as React from "preact/compat";
import Card from "@material-ui/core/Card";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import EditIcon from "@material-ui/icons/Edit";
import Pen from "../icons/Pen";
import CommunityImage from "./CommunityImage";
import ActionButtons from "./ActionButtons";
import MetadataPanel from "./MetadataPanel";

import { t, useLanguage } from "../utils/text";

// Hoisted static styles — were inline literals re-created on every render.
// (Per-tab image heights are constants too, so CommunityImage's style
// comparator sees a stable reference for an unchanged tab.)
const IMAGE_H150 = { height: "150px" };
const IMAGE_H225 = { height: "225px" };
const IMAGE_H300 = { height: "300px" };
const ST_W_100__MT_16PX__MB_16PX = { width: "100%", marginTop: "16px", marginBottom: "16px" };
const ST_M_16PX_16PX_0PX_ = { margin: "16px 16px 0px 16px" };
const ST_FS_18PX__C_717171 = { fontSize: "18px", color: "#717171" };
const ST_FS_32PX = { fontSize: "32px" };
const ST_W_100 = { width: "100%" };
const ST_D_FLEX__POS_RELATIVE = { display: "flex", position: "relative" };
const ST_M_16PX_75PX_0PX___POS_RELATIVE = { margin: "16px -75px 0px 0px", position: "relative" };


const CommunityInfo = React.memo(({
                                      community,
                                      members,
                                      rules,
                                      postsCount,
                                      joined,
                                      tabValue,
                                      timeAgo,
                                      isAdmin,
                                      onToggleJoined,
                                      onViewMembers,
                                      onTabChange,
                                      onTextEditor,
                                      onEditCommunity,
                                      onAddSomeone,
                                      classes
                                  }) => {
    useLanguage();
    const imageStyle = tabValue === 0 ? IMAGE_H150 : tabValue === 1 ? IMAGE_H225 : IMAGE_H300;

    return (
        <div className={classes.viewLeft}>
            <Card className={classes.viewLeftTopCard}>
                <div style={ST_W_100__MT_16PX__MB_16PX}>
                    <div style={ST_M_16PX_16PX_0PX_}>
                        <Typography style={ST_FS_18PX__C_717171} component="span">
                            {t("words.portal")}
                        </Typography>
                        <Typography style={ST_FS_32PX} component="h2" variant="h3">
                            {community.name}
                        </Typography>
                    </div>
                    <div style={ST_W_100}>
                        <div style={ST_D_FLEX__POS_RELATIVE}>
                            <div style={ST_M_16PX_75PX_0PX___POS_RELATIVE}>
                                <CommunityImage
                                    image={community.image}
                                    name={community.name}
                                    className={classes.communityImage}
                                    style={imageStyle}
                                />
                                {isAdmin && onEditCommunity && (
                                    <IconButton
                                        className={classes.menuButtonEdit}
                                        onClick={onEditCommunity}
                                    >
                                        <EditIcon />
                                    </IconButton>
                                )}
                            </div>
                            <div className={classes.writeButtons}>
                                <IconButton
                                    className={classes.menuButton}
                                    onClick={onTextEditor}
                                    data-tour="community-write"
                                >
                                    <Pen/>
                                </IconButton>
                            </div>
                        </div>
                    </div>
                    <ActionButtons
                        joined={joined}
                        onToggleJoined={onToggleJoined}
                        onViewMembers={onViewMembers}
                        isMobile={false}
                        actionButtonsClass={classes.actionButtons}
                        actionButtonsMobileClass={classes.actionButtonsMobile}
                    />
                </div>
            </Card>
            <Card className={classes.viewLeftBottomCard}>
                <MetadataPanel
                    tabValue={tabValue}
                    onTabChange={onTabChange}
                    members={members}
                    rules={rules}
                    community={community}
                    postsCount={postsCount}
                    timeAgo={timeAgo}
                    height={0}
                    isAdmin={isAdmin}
                    onAddSomeone={onAddSomeone}
                    addSomeoneClass={classes.whiteDiscreteButton}
                    cardTabsClass={classes.cardTabs}
                    metadataSwipeableViewsClass={classes.metadataSwipeableViews}
                    memberListItemClass={classes.memberListItem}
                    memberBadgeClass={classes.memberBadge}
                    roleChipClass={classes.roleChip}
                    metaListHeaderClass={classes.metaListHeader}
                    isFullHeight={true}
                />
            </Card>
        </div>
    );
}, (prevProps, nextProps) => {
    return prevProps.joined === nextProps.joined &&
        prevProps.tabValue === nextProps.tabValue &&
        prevProps.community === nextProps.community &&
        prevProps.members === nextProps.members &&
        prevProps.rules === nextProps.rules &&
        prevProps.postsCount === nextProps.postsCount &&
        prevProps.isAdmin === nextProps.isAdmin;
});

export default CommunityInfo;