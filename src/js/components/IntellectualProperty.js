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
        // Static text: re-render only when the UI language changes
        // (withLanguage passes the active code as __i18nLang, and a counter
        // that also moves when a fallback catalogue lands as __i18nRev).
        return nextProps.__i18nLang !== this.props.__i18nLang ||
            nextProps.__i18nRev !== this.props.__i18nRev;
    }

    render() {

        const { classes } = this.state;

        return (
            <div>
                <p>
                    {t(
                        "components.intellectual_property.mit_license_copyright_c_2024_2025_pixagram"
                    )}<br/><br/>{t("components.intellectual_property.permission_is_granted_without_charge_to_any")}<br/><br/>
                    {t("components.intellectual_property.the_software_is_delivered_as_is_without")}<br/>
                    {t("components.intellectual_property.in_no_event_shall_pixagram_sa_be")}
                </p>
            </div>
        );
    }
}

export default withLanguage(withStyles(styles)(IntellectualProperty));