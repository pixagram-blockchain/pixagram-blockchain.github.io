import React from 'react';
import SvgIcon from '@material-ui/core/SvgIcon';
import { withStyles } from "@material-ui/core";

const styles = theme => ({});

class PixaPower extends React.PureComponent {

    constructor(props) {
        super(props);
    }

    render() {

        return (
            <SvgIcon {...this.props}>
                <path fill="currentColor" fill-rule="evenodd" d="M14.882 10.185c-3.834 1.582-4.545-.838-5.332-2.006-1.007 2.454-2.497 3.182-3.758 3.783 2.886 1.532 3.191 2.869 3.758 3.808 1.769-3.41 3.598-3.887 5.332-4.29 5.323-.593 7.236-2.438 8.962-3.53-.575 2.666-4.214 4.274-4.773 4.57 2.387.009 2.573-.448 4.139-1.04-1.6 2.657-3.648 2.555-4.545 2.818 1.845.635 3.08.262 3.808.101-.524 1.532-2.319 1.448-3.808 1.6-2.708 0-3.182-.051-4.9-.127-2.734.296-3.022 3.512-4.114 5.535-1.244-2.954-1.777-4.294-3.148-6.195-1.885-1.555-3.561-1.936-6.347-3.25 5.005-1.838 5.205-2.199 6.347-3.25 1.59-1.939 1.858-3.731 3.047-6.119 1.295 3.521 1.853 4.503 2.996 6.119 1.193 1.109 1.244 1.16 2.336 1.473z"/>
            </SvgIcon>
        );
    }
}

export default withStyles(styles)(PixaPower);