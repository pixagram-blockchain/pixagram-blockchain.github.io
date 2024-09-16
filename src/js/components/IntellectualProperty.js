import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import { t } from "../utils/text";
import { withLanguage } from "../utils/withLanguage";
const styles = theme => ({

});

class IntellectualProperty extends React.PureComponent {

    constructor(props) {
        super(props);
        this.state = {
            classes: props.classes
        };
    };

    shouldComponentUpdate(nextProps, nextState, nextContext) {
        return false;
    }

    render() {

        const { classes } = this.state;

        return (
            <div>
                <p>
                    {t(
                        "components.intellectual_property.mit_license_copyright_c_2024_2025_pixagram"
                    )}<br/><br/>Permission is granted, without charge, to any entity obtaining a copy of this software and corresponding documentation files (the "Software"), to deal in the Software without restriction. This includes the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to allow individuals to whom the Software is provided to do so, abiding by the following conditions: The preceding copyright notice and this permission notice must be included in all copies or substantial parts of the Software.<br/><br/>
                    {t("components.intellectual_property.the_software_is_delivered_as_is_without")}<br/>
                    {t("components.intellectual_property.in_no_event_shall_pixagram_sa_be")}
                </p>
            </div>
        );
    }
}

export default withLanguage(withStyles(styles)(IntellectualProperty));