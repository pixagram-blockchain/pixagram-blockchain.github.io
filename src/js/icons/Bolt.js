import React from 'react';
import SvgIcon from '@material-ui/core/SvgIcon';

class Bolt extends React.PureComponent {

    constructor(props) {
        super(props);
    }

    render() {

        return (
            <SvgIcon {...this.props}>
                <path d="m393-165 279-335H492l36-286-253 366h154l-36 255Zm-73 85 40-280H160l360-520h80l-40 320h240L400-80h-80Zm154-396Z" />
            </SvgIcon>
        );
    }
}

export default Bolt;