"use strict";
import React, { useCallback, useMemo, useState } from "preact/compat";
import Avatar from "@material-ui/core/Avatar";
import ListItem from "@material-ui/core/ListItem";
import ListItemAvatar from "@material-ui/core/ListItemAvatar";
import ListItemText from "@material-ui/core/ListItemText";
import GroupIcon from "@material-ui/icons/Group";

import { highlightNode } from "./highlight";
import { ARTWORK_RADIUS } from "./config";

// ── CommunityResult ───────────────────────────────────────────────────────────
// One community row: the community account's profile picture (Hivemind on this
// chain carries no avatar_url; the picture is the profile image of the account
// behind the community, e.g. portal-156480), the title with the match
// highlighted (a query that matched `about` simply shows the plain title), and
// the subscriber count. Group icon when there is no picture.

const AVATAR_STYLE = { width: 36, height: 36, borderRadius: ARTWORK_RADIUS, backgroundColor: "#3a3a3a", color: "#888" };
const PRIMARY_STYLE = { color: "#bbb", display: "flex", alignItems: "center", gap: 6, minWidth: 0 };
const TITLE_STYLE = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const SUBS_STYLE = { color: "#555", fontSize: "0.8em", marginLeft: "auto", flexShrink: 0 };
const ABOUT_STYLE = { color: "#666", fontSize: "0.8em", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

export const CommunityResult = React.memo(
    ({ classes, community, query, onGoToCommunity }) => {
        const title = community.title || community.name;
        const image = community.profile_image || null;
        const [failed, setFailed] = useState(null);
        const onError = useCallback(() => setFailed(image), [image]);
        const imgProps = useMemo(() => ({ onError, loading: "lazy", decoding: "async" }), [onError]);
        const showImage = !!image && failed !== image;
        const onClick = useCallback(() => onGoToCommunity(community.name), [onGoToCommunity, community.name]);
        const about = typeof community.about === "string" ? community.about.trim() : "";
        return (
            <ListItem button dense onClick={onClick} className={classes.row}>
                <ListItemAvatar className={classes.rowAvatar}>
                    <Avatar variant="rounded" src={showImage ? image : undefined} imgProps={imgProps} style={AVATAR_STYLE} alt={title}>
                        <GroupIcon style={{ fontSize: 20 }} />
                    </Avatar>
                </ListItemAvatar>
                <ListItemText
                    className={classes.rowText}
                    disableTypography
                    primary={
                        <span style={PRIMARY_STYLE}>
                            <span style={TITLE_STYLE}>{highlightNode(title, query)}</span>
                            {community.subscribers != null && (
                                <span style={SUBS_STYLE}>{community.subscribers} subs</span>
                            )}
                        </span>
                    }
                    secondary={about ? <span style={ABOUT_STYLE}>{about}</span> : null}
                />
            </ListItem>
        );
    },
    (prev, next) =>
        prev.community === next.community &&
        prev.query === next.query &&
        prev.onGoToCommunity === next.onGoToCommunity &&
        prev.classes === next.classes,
);
