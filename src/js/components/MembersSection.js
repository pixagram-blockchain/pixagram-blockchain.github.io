import * as React from "preact/compat";
import List from "@material-ui/core/List";
import ListSubheader from "@material-ui/core/ListSubheader";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import ListItemAvatar from "@material-ui/core/ListItemAvatar";
import Avatar from "@material-ui/core/Avatar";
import Chip from "@material-ui/core/Chip";
import Badge from "@material-ui/core/Badge";
import Typography from "@material-ui/core/Typography";
import Tooltip from "@material-ui/core/Tooltip";
import Button from "@material-ui/core/Button";
import AccountCircleRounded from "@material-ui/icons/AccountCircleRounded";
import SecurityRounded from "@material-ui/icons/SecurityRounded";
import SettingsRounded from "@material-ui/icons/SettingsRounded";
import GavelRounded from "@material-ui/icons/GavelRounded";
import PersonAddRounded from "@material-ui/icons/PersonAddRounded";
import { HISTORY } from "../utils/constants";

import { t, useLanguage } from "../utils/text";

const MembersSection = React.memo(({ members, timeAgo, isAdmin, onAddSomeone, memberListItemClass, memberBadgeClass, roleChipClass, metaListHeaderClass, addSomeoneClass }) => {
    useLanguage();
    const goToProfile = React.useCallback((username) => {
        HISTORY.push('/@' + username);
    }, []);

    return (
        <React.Fragment>
            <List dense>
                <ListSubheader disableSticky className={metaListHeaderClass}>
                    {t("components.members_section.community_team")}
                </ListSubheader>
                {members.map((member, i) => {
                    const roleIcon = member.role === "owner" ? <SecurityRounded/> :
                        member.role === "admin" ? <SettingsRounded/> :
                            member.role === "moderator" ? <GavelRounded/> :
                                <AccountCircleRounded/>;

                    const displayName = member.display_name || member.username;

                    return (
                        <ListItem key={i} className={memberListItemClass}>
                            <ListItemAvatar style={{cursor: "pointer"}} onClick={() => goToProfile(member.username)}>
                                <Badge className={memberBadgeClass}
                                       anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
                                       overlap="rectangular"
                                       badgeContent={member.role}
                                       color="primary">
                                    <Avatar alt={displayName} src={member.image} className={"pixelated"} />
                                </Badge>
                            </ListItemAvatar>
                            <ListItemText
                                primary={
                                    <Typography style={{cursor: "pointer", lineHeight: "1.618rem", display: "block", fontWeight: "bold", fontSize: "14px", color: "#fff"}} component="span" variant="body2">
                                        <Tooltip title={'@' + member.username} placement="top" arrow>
                                            <span style={{marginRight: "8px"}} onClick={() => goToProfile(member.username)}>{displayName}</span>
                                        </Tooltip>
                                        <Chip className={roleChipClass} size="small" icon={roleIcon} label={member.role} />
                                    </Typography>
                                }
                                secondary={member.about ? (
                                    <Typography style={{display: "block", fontSize: "12px", color: "#ccc", lineHeight: "1rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}} component="span" variant="body1">
                                        {member.about}
                                    </Typography>
                                ) : null}
                            />
                        </ListItem>
                    );
                })}
            </List>
            {(isAdmin && onAddSomeone) && (<Button style={{marginBottom: 32, marginTop: 16}} fullWidth={true} variant={"contained"} className={addSomeoneClass} onClick={onAddSomeone}>{t("components.members_section.add_someone")}</Button>)}
        </React.Fragment>
    );
});

export default MembersSection;