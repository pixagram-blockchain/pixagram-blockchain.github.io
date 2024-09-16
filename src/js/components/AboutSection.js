import * as React from "preact/compat";
import List from "@material-ui/core/List";
import ListSubheader from "@material-ui/core/ListSubheader";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import Typography from "@material-ui/core/Typography";
import NotificationsActiveRounded from "@material-ui/icons/NotificationsActiveRounded";
import GroupRounded from "@material-ui/icons/GroupRounded";
import DescriptionRounded from "@material-ui/icons/DescriptionRounded";

import { t, useLanguage } from "../utils/text";

// Hoisted static styles — were inline literals re-created on every render.
const ST_FS_12PX__C_CCC__LH_1REM = { fontSize: "12px", color: "#ccc", lineHeight: "1rem" };
const ST_MINW_32 = { minWidth: 32 };
const ST_CUR_POINTER__LH_1_618REM__D_BLOCK = { cursor: "pointer", lineHeight: "1.618rem", display: "block", fontSize: "14px", color: "#fff" };


const AboutSection = React.memo(({ community, postsCount, timeAgo, metaListHeaderClass }) => {
    useLanguage();
    return (
        <List dense>
            <ListSubheader disableSticky className={metaListHeaderClass}>
                {t("components.about_section.about_this_community")}
            </ListSubheader>
            <ListItem>
                <ListItemText
                    secondary={
                        <Typography style={ST_FS_12PX__C_CCC__LH_1REM} component="span" variant="body1">
                            {community.about}
                        </Typography>
                    }
                />
            </ListItem>
            <ListItem>
                <ListItemIcon style={ST_MINW_32}>
                    <NotificationsActiveRounded/>
                </ListItemIcon>
                <ListItemText
                    primary={
                        <Typography style={ST_CUR_POINTER__LH_1_618REM__D_BLOCK} component="span" variant="body2">{t("components.about_section.created", {
                                timeAgo: timeAgo.format(community.created || Date.now() - 1000*60*60*24*365, { labels: 'long' })
                            })}</Typography>
                    }/>
            </ListItem>
            <ListItem>
                <ListItemIcon style={ST_MINW_32}>
                    <GroupRounded/>
                </ListItemIcon>
                <ListItemText
                    primary={
                        <Typography style={ST_CUR_POINTER__LH_1_618REM__D_BLOCK} component="span" variant="body2">{t("components.about_section.members", {
                                memberCount: community.memberCount || 0
                            })}</Typography>
                    }/>
            </ListItem>
            <ListItem>
                <ListItemIcon style={ST_MINW_32}>
                    <DescriptionRounded/>
                </ListItemIcon>
                <ListItemText
                    primary={
                        <Typography style={ST_CUR_POINTER__LH_1_618REM__D_BLOCK} component="span" variant="body2">{t("components.about_section.posts", {
                                postsCount: postsCount || 0
                            })}</Typography>
                    }/>
            </ListItem>
        </List>
    );
});

export default AboutSection;
