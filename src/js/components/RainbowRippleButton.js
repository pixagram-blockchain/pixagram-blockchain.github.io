import React from 'react';
import withStyles from "@material-ui/core/styles/withStyles";
import ButtonBase from '@material-ui/core/ButtonBase';

const styles = theme => ({
    rainbowButton: {
        position: 'relative',
        overflow: 'hidden',
        padding: '16px 32px',
        borderRadius: '16px',
        fontWeight: 'bold',
        fontSize: '16px',
        color: '#000000',
        backgroundColor: '#ffffff',

        '& .MuiTouchRipple-root': {
            zIndex: 1,
        },
        '& .MuiButtonBase-root': {
            zIndex: 2,
        },
    },
});


class RainbowRippleButton extends React.PureComponent {

    constructor(props) {
        super(props);
        this.state = {
            classes: props.classes,
            children: props.children,
            style: props.style,
            ...props
        };
    };

    shouldComponentUpdate(nextProps, nextState, nextContext) {
        return false;
    }

    render() {
        const {
            classes,
            children,
            style
        } = this.state;
        return (
            <ButtonBase style={style} className={classes.rainbowButton} onClick={this.props.onClick} focusRipple>
              {children}
            </ButtonBase>
        );
    }
}

export default withStyles(styles)(RainbowRippleButton);
