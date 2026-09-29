"use strict";
import React, { useCallback } from "preact/compat";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";

import { T } from "../../utils/T";

import { highlightNode, NO_SLOTS } from "./highlight";

// ── PostResult ────────────────────────────────────────────────────────────────
// One blog-post row (community/portal posts included): title in "Industry Book" with
// the match highlighted, "@author · in <community>" and the résumé in "Normative Pro"
// (the first words of the post stand in while the résumé is pending).

// Same faces as the toolbar wordmark: "Industry Book" for titles, "Normative Pro" for text.
const TITLE_FONT = '"Industry Book"';
const BODY_FONT = '"Normative Pro"';

const TITLE_STYLE = { fontFamily: TITLE_FONT, fontSize: 15, letterSpacing: 0.2, color: "#ccc", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const META_STYLE = { fontFamily: BODY_FONT, color: "#777", fontSize: "0.8em", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const SUMMARY_STYLE = {
    fontFamily: BODY_FONT, color: "#8a8a8a", fontSize: "0.82em", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
    overflow: "hidden", lineHeight: 1.35, marginTop: 2,
};

export const PostResult = React.memo(
    ({ classes, post, query, communityTitles, onGoToPost }) => {
        const onClick = useCallback(() => onGoToPost(post), [onGoToPost, post]);
        const where = post.community ? (communityTitles && communityTitles[post.community]) || post.community : null;
        const text = post.summary || post.excerpt;
        return (
            <ListItem button dense onClick={onClick} className={classes.row}>
                <ListItemText
                    className={classes.rowText}
                    disableTypography
                    primary={<span style={TITLE_STYLE}>{highlightNode(post.title || post.permlink, query)}</span>}
                    secondary={
                        <React.Fragment>
                            <span style={META_STYLE}>
                                @{post.author}
                                {where ? (
                                    <span> · <T k="components.post_result.in_community" vars={{ community: where }} slots={NO_SLOTS} /></span>
                                ) : null}
                            </span>
                            {text ? <span style={SUMMARY_STYLE}>{highlightNode(text, query)}</span> : null}
                        </React.Fragment>
                    }
                />
            </ListItem>
        );
    },
    (prev, next) =>
        prev.post === next.post &&
        prev.query === next.query &&
        prev.communityTitles === next.communityTitles &&
        prev.onGoToPost === next.onGoToPost &&
        prev.classes === next.classes,
);
