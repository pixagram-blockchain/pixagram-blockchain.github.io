import * as React from "preact/compat";
import List from "@material-ui/core/List";
import ListSubheader from "@material-ui/core/ListSubheader";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import Typography from "@material-ui/core/Typography";

import { t, useLanguage } from "../utils/text";

const RulesSection = React.memo(({ rules, metaListHeaderClass }) => {
    useLanguage();
    return (
        <List dense>
            <ListSubheader disableSticky className={metaListHeaderClass}>
                {t("components.rules_section.community_rules")}
            </ListSubheader>
            {rules.map((rule, index) => (
                <ListItem key={index}>
                    <ListItemIcon style={{minWidth: 32}}>
                        <Typography style={{color: "#777", fontWeight: "bold"}}>
                            {index + 1}.
                        </Typography>
                    </ListItemIcon>
                    <ListItemText
                        primary={
                            <Typography style={{fontSize: "13px", color: "#ddd", lineHeight: "1.25rem"}} component="span" variant="body2">
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
