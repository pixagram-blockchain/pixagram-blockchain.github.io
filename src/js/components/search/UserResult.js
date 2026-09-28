"use strict";
import React, { useCallback, useMemo, useState } from "preact/compat";
import Avatar from "@material-ui/core/Avatar";
import ListItem from "@material-ui/core/ListItem";
import ListItemAvatar from "@material-ui/core/ListItemAvatar";
import ListItemText from "@material-ui/core/ListItemText";

import { highlightNode } from "./highlight";
import { ARTWORK_RADIUS } from "./config";

// ── UserResult ────────────────────────────────────────────────────────────────
// One account row: profile picture, "@username (Real Name)", bio on one line.
// The picture is chain data (an on-chain data URI) through <Avatar src>, with
// the initial as the load-error fallback so a dead image never shows broken.

const AVATAR_STYLE = { width: 36, height: 36, borderRadius: ARTWORK_RADIUS, backgroundColor: "#3a3a3a", color: "#bbb", fontSize: 15 };
const PRIMARY_STYLE = { color: "#bbb", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const NAME_STYLE = { color: "#888" };
const BIO_STYLE = { color: "#666", fontSize: "0.8em", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

export const UserResult = React.memo(
    ({ classes, user, query, onGoToUsername }) => {
        const { username, name, about, profile_image } = user;
        const [failed, setFailed] = useState(null);
        const onError = useCallback(() => setFailed(profile_image), [profile_image]);
        const imgProps = useMemo(() => ({ onError, loading: "lazy", decoding: "async" }), [onError]);
        const showImage = !!profile_image && failed !== profile_image;
        const onClick = useCallback(() => onGoToUsername(username), [onGoToUsername, username]);
        const initial = (username || "?").charAt(0).toUpperCase();
        return (
            <ListItem button dense onClick={onClick} className={classes.row}>
                <ListItemAvatar className={classes.rowAvatar}>
                    <Avatar variant="rounded" src={showImage ? profile_image : undefined} imgProps={imgProps} style={AVATAR_STYLE} alt={username}>
                        {initial}
                    </Avatar>
                </ListItemAvatar>
                <ListItemText
                    className={classes.rowText}
                    disableTypography
                    primary={
                        <span style={PRIMARY_STYLE}>
                            @{highlightNode(username, query)}
                            {name ? <span style={NAME_STYLE}> ({highlightNode(name, query)})</span> : null}
                        </span>
                    }
                    secondary={about ? <span style={BIO_STYLE}>{about}</span> : null}
                />
            </ListItem>
        );
    },
    (prev, next) =>
        prev.user === next.user &&
        prev.query === next.query &&
        prev.onGoToUsername === next.onGoToUsername &&
        prev.classes === next.classes,
);
