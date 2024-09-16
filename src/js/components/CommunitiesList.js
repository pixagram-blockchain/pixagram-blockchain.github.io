import * as React from "preact/compat";
import List from "@material-ui/core/List";
import ListSubheader from "@material-ui/core/ListSubheader";
import ListItem from "@material-ui/core/ListItem";
import ListItemAvatar from "@material-ui/core/ListItemAvatar";
import ListItemText from "@material-ui/core/ListItemText";
import Avatar from "@material-ui/core/Avatar";
import Chip from "@material-ui/core/Chip";
import Badge from "@material-ui/core/Badge";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import AccountCircleRounded from "@material-ui/icons/AccountCircleRounded";
import Community from "../icons/Community";

import { t, useLanguage } from "../utils/text";

// Hoisted static styles — were inline literals re-created on every render.
const ST_FS_12PX__C_888__LH_1REM = { fontSize: "12px", color: "#888", lineHeight: "1rem", fontStyle: "italic" };
const ST_CUR_POINTER = { cursor: "pointer" };
const ST_CUR_POINTER__LH_1_618REM__D_BLOCK = { cursor: "pointer", lineHeight: "1.618rem", display: "block", fontWeight: "bold", fontSize: "14px", color: "#fff" };
const ST_C_717171 = { color: "#717171" };
const ST_MR_8PX = { marginRight: "8px" };
const ST_FS_12PX__C_CCC__LH_1REM = { fontSize: "12px", color: "#ccc", lineHeight: "1rem" };
const ST_MB_32__MT_16 = { marginBottom: 32, marginTop: 16 };


/**
 * Normalize a subscription entry from the bridge API.
 * The API returns arrays like: ["community-name", "Community Title", "role", "title"]
 * or objects with { name, title, role, ... } depending on the node.
 */
const normalizeSubscription = (entry) => {
    if (Array.isArray(entry)) {
        return {
            name: entry[0] || '',
            title: entry[1] || entry[0] || '',
            role: entry[2] || 'guest',
            userTitle: entry[3] || '',
            image: entry[4] || '',
            about: entry[5] || '',
        };
    }
    if (entry && typeof entry === 'object') {
        return {
            name: entry.name || entry.community || '',
            title: entry.title || entry.name || '',
            role: entry.role || 'guest',
            userTitle: entry.user_title || entry.userTitle || '',
            image: entry.image || entry.avatar || '',
            about: entry.about || entry.description || '',
        };
    }
    return null;
};

const CommunitiesList = React.memo(({ classes, subscriptions, onGoToCommunity, onCreateCommunity, isOwnProfile }) => {
    useLanguage();
    const entries = Array.isArray(subscriptions)
        ? subscriptions.map(normalizeSubscription).filter(Boolean)
        : [];

    const hasEntries = entries.length > 0;

    return (
        <React.Fragment>
            <List dense>
                <ListSubheader disableSticky className={classes.metaListHeader}>
                    {t("components.communities_list.portals_joined")}
                </ListSubheader>
                {!hasEntries && (
                    <ListItem>
                        <ListItemText
                            secondary={
                                <Typography style={ST_FS_12PX__C_888__LH_1REM} component="span" variant="body1">
                                    {t("components.communities_list.no_portals_joined_yet")}
                                </Typography>
                            }
                        />
                    </ListItem>
                )}
                {entries.map((d, i) => {
                    return (
                        <ListItem key={d.name || i} className={classes.communityListItem}>
                            <ListItemAvatar style={ST_CUR_POINTER}>
                                <Badge className={classes.communityBadge} anchorOrigin={{vertical: 'bottom', horizontal: 'right'}} overlap="rectangular" color="primary">
                                    <Avatar
                                        src={d.image || undefined}
                                        className={"pixelated"}
                                        style={d.image ? {backgroundColor: "#333"} : {}}
                                    >
                                        {!d.image && <Community />}
                                    </Avatar>
                                </Badge>
                            </ListItemAvatar>
                            <ListItemText
                                primary={
                                    <Typography onClick={() => onGoToCommunity(d.name)} style={ST_CUR_POINTER__LH_1_618REM__D_BLOCK} component="span" variant="body2">
                                        <span style={ST_C_717171}>{t("words.portal")} </span>
                                        <span style={ST_MR_8PX}>{d.title}</span>
                                        {d.role && d.role !== 'guest' && (
                                            <Chip className={classes.communityChip} size="small" icon={<AccountCircleRounded />} label={d.role} />
                                        )}
                                    </Typography>
                                }
                                secondary={d.about ? (
                                    <Typography style={ST_FS_12PX__C_CCC__LH_1REM} component="span" variant="body1">
                                        {d.about}
                                    </Typography>
                                ) : null}
                            />
                        </ListItem>
                    );
                })}
            </List>
            {isOwnProfile && <Button style={ST_MB_32__MT_16} fullWidth={true} variant={"contained"} className={classes.whiteDiscreteButton} onClick={onCreateCommunity}>{t("components.communities_list.create_new_portal")}</Button>}
        </React.Fragment>
    );
});

export default CommunitiesList;