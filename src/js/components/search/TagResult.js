"use strict";
import React, { useCallback } from "preact/compat";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";

import { highlightNode } from "./highlight";

// ── TagResult ─────────────────────────────────────────────────────────────────
// "#tag" row, as before. `exact` marks the synthetic first row that always
// offers the typed term itself (it has no partial match to highlight).

const PRIMARY_STYLE = { color: "#bbb" };

export const TagResult = React.memo(
    ({ classes, name, query, exact, onGoToTag }) => {
        const onClick = useCallback(() => onGoToTag(name), [onGoToTag, name]);
        return (
            <ListItem button dense onClick={onClick} className={classes.row}>
                <ListItemText
                    className={classes.rowText}
                    disableTypography
                    primary={<span style={PRIMARY_STYLE}>#{exact ? name : highlightNode(name, query)}</span>}
                />
            </ListItem>
        );
    },
    (prev, next) =>
        prev.name === next.name &&
        prev.query === next.query &&
        prev.exact === next.exact &&
        prev.onGoToTag === next.onGoToTag &&
        prev.classes === next.classes,
);
