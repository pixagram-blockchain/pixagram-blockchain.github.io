import React from 'react';
import SvgIcon from '@material-ui/core/SvgIcon';
import { withStyles } from "@material-ui/core";

const styles = theme => ({});

class PixaLiquid extends React.PureComponent {

    constructor(props) {
        super(props);
    }

    render() {

        return (
            <SvgIcon {...this.props}>
                <path fill="currentColor" fill-rule="evenodd" d="M10.7 0q.4.1.1.3C3 2 3 7.3 4.3 9.8c1.5 2.9 0 4.5-1.6 4.6-1.2 0-2.4-.7-2.6-2.2C-.4 9.5 1.5.4 10.7 0m13 3.3a3 3 0 0 0-2.6-1.7h-9.7q-1.6 0-2.7 1.2l-3.5 4c0 1.2.8 2.5 1.1 3.6l4.8-5.6.3-.1h8.9l.2.1V5l-2.1 2.4-.4.2h-5q-1.2 0-2 1l-5 5.6h4.3l3-3.4.3-.1H18q1.6 0 2.7-1.3l2.6-3a3 3 0 0 0 .4-3.1"/>
            </SvgIcon>
        );
    }
}

export default withStyles(styles)(PixaLiquid);