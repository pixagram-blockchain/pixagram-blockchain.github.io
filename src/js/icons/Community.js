import React from 'react';
import SvgIcon from '@material-ui/core/SvgIcon';
import { withStyles } from "@material-ui/core";

const styles = theme => ({});

class ClipboardText extends React.PureComponent {

    constructor(props) {
        super(props);
    }

    render() {

        return (
            <SvgIcon {...this.props}>
                <path fill-rule={"evenodd"} d="M9 22c-.552 0-1-.448-1-1v-3H4c-1.105 0-2-.895-2-2V4c0-1.11.9-2 2-2h16c1.105 0 2 .895 2 2v12c0 1.105-.895 2-2 2h-6.1l-3.7 3.71c-.2.19-.45.29-.7.29H9Zm5.867-7.883v1.433H4.833v-1.433S6.594 11.25 9.85 11.25c3.256 0 5.017 2.867 5.017 2.867Zm-2.509-6.809c0-1.385-1.123-2.508-2.508-2.508S7.342 5.923 7.342 7.308c0 1.386 1.123 2.509 2.508 2.509s2.508-1.123 2.508-2.509ZM13.5 11.25c1.213.626 2.215 1.382 2.8 2.867v1.433h2.867v-1.433s-1.324-2.602-5.667-2.867Zm.65-6.45c-.493-.003-.976.145-1.383.423a3.5851 3.5851 0 0 1 0 4.171c.407.278.89.425 1.383.423 1.385 0 2.508-1.123 2.508-2.509 0-1.385-1.123-2.508-2.508-2.508Z" />
            </SvgIcon>
        );
    }
}

export default withStyles(styles)(ClipboardText);