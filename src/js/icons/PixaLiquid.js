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
                <path fill="currentColor" fill-rule="evenodd" d="M11.982 7.173c-1.249 3.018-3.089 3.917-4.648 4.66 3.079 1.634 3.789 3.09 4.375 4.205.09.142.187.312.291.511.104-.199.201-.369.291-.511.586-1.115 1.296-2.571 4.375-4.205-1.559-.743-3.399-1.642-4.648-4.66L12 7.146l-.018.027zm.941 13.91c-.215.995-.469 1.877-.778 2.451a.938.938 0 0 1-.149.256c-.039-.03-.124-.202-.154-.279-.31-.574-.55-1.433-.765-2.428-.906-2.095-1.596-3.465-2.861-5.218-2.339-1.93-4.418-2.402-7.875-4.032 6.209-2.28 6.457-2.729 7.875-4.032 1.972-2.405 2.304-4.628 3.78-7.591L12 .223l.004-.013c1.476 2.963 1.808 5.186 3.78 7.591 1.418 1.303 1.666 1.752 7.875 4.032-3.457 1.63-5.536 2.102-7.875 4.032-1.265 1.753-1.955 3.123-2.861 5.218z"/>
            </SvgIcon>
        );
    }
}

export default withStyles(styles)(PixaLiquid);