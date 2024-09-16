import React from 'react';
import SvgIcon from '@material-ui/core/SvgIcon';
import { withStyles } from "@material-ui/core";

const styles = theme => ({});

class PixaSupra extends React.PureComponent {

    constructor(props) {
        super(props);
    }

    render() {

        return (
            <SvgIcon {...this.props}>
               <path fill="currentColor" fill-rule="evenodd" d="M7.212 7.243c1.756 4.235.822 6.953.012 9.237 4.677-1.434 6.826-.695 8.514-.169.23.051.496.123.796.218a9.376 9.376 0 0 1-.219-.796c-.525-1.687-1.264-3.837.169-8.514-2.283.81-5.001 1.744-9.236-.012l-.044-.008.008.044zm14.738 12.87c.772 1.2 1.396 2.327 1.659 3.204.065.15.084.241.106.402-.068.009-.323-.078-.43-.125-.877-.262-1.967-.876-3.167-1.649-2.979-1.181-5.023-1.855-8.018-2.34-4.235.407-6.767 2.001-11.815 3.813 3.899-8.423 3.7-9.114 3.814-11.814C3.669 7.259 1.793 4.724.317.321l.016.007A.12.12 0 0 0 .325.312c4.404 1.476 6.939 3.352 11.284 3.782C14.308 3.98 15 4.18 23.423.281 21.61 5.328 20.016 7.86 19.61 12.095c.485 2.996 1.159 5.039 2.34 8.018z"/>
            </SvgIcon>
        );
    }
}

export default withStyles(styles)(PixaSupra);