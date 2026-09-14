import * as React from "preact/compat";
import List from "@material-ui/core/List";
import ListSubheader from "@material-ui/core/ListSubheader";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import Typography from "@material-ui/core/Typography";

import { t, useLanguage } from "../utils/text";

// Hoisted static styles — were inline literals re-created on every render,
// once per rule.
const ST_MINW_32 = { minWidth: 32, marginTop: "3px" };
const ST_BULLET = { color: "#777", fontSize: "13px", lineHeight: "1.25rem" };
const ST_RULE = { fontSize: "13px", color: "#ddd", lineHeight: "1.25rem" };
const ST_EMPTY = { fontSize: "13px", color: "#777", lineHeight: "1.25rem", fontStyle: "italic" };

// A bullet, not "1." — numbering claims these are a sequence, which rules are
// not, and the number shown was the renderer's own: the loader strips a "1."
// the admin typed and this list then prints a position that may not match it.
// The editor writes bullets; this shows bullets.
const BULLET = "\u2022";

const RulesSection = React.memo(({ rules, metaListHeaderClass }) => {
    useLanguage();
    const items = Array.isArray(rules) ? rules : [];

    return (
        <List dense>
            <ListSubheader disableSticky className={metaListHeaderClass}>
                {t("components.rules_section.community_rules")}
            </ListSubheader>
            {items.length === 0 ? (
                <ListItem>
                    <ListItemText
                        primary={
                            <Typography style={ST_EMPTY} component="span" variant="body2">
                                {t("components.rules_section.this_portal_has_not_set_any_rules")}
                            </Typography>
                        }
                    />
                </ListItem>
            ) : items.map((rule, index) => (
                // alignItems: a rule long enough to wrap kept its marker
                // vertically centred against the whole block, floating it into
                // the middle of the text instead of marking its first line.
                <ListItem key={index + "-" + rule} alignItems="flex-start">
                    <ListItemIcon style={ST_MINW_32}>
                        <Typography style={ST_BULLET} component="span" aria-hidden="true">
                            {BULLET}
                        </Typography>
                    </ListItemIcon>
                    <ListItemText
                        primary={
                            <Typography style={ST_RULE} component="span" variant="body2">
                                {rule}
                            </Typography>
                        }
                    />
                </ListItem>
            ))}
        </List>
    );
});

export default RulesSection;
