import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContentText from "@material-ui/core/DialogContentText";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Input from "@material-ui/core/Input";
import InputAdornment from "@material-ui/core/InputAdornment";
import IconButton from "@material-ui/core/IconButton";
import Visibility from "@material-ui/icons/Visibility";
import VisibilityOff from "@material-ui/icons/VisibilityOff";

const styles = theme => ({
    usernameInput: {

    },
    passwordInput: {

    }
});

class LoginModal extends React.PureComponent {

    constructor(props) {
        super(props);
        this.state = {
            classes: props.classes,
            keepMounted: props.keepMounted || false,
            open: props.open,
            _username: "",
            _showPassword: false,
            _password: ""
        };
    };

    componentWillReceiveProps(new_props) {

        this.setState(new_props, () => {

            this.forceUpdate();
        });
    }

    _handleUsernameChange = (e) => {
        this.setState({_username: e.target.value.toString()}, () => {
            this.forceUpdate();
        });
    };

    _handlePasswordChange = (e) => {
        this.setState({_password: e.target.value.toString()}, () => {
            this.forceUpdate();
        });
    };

    _handleClickShowPassword = () => {
        this.setState({_showPassword: true}, () => {
            this.forceUpdate();
        });
    };

    _handleMouseDownPassword = (event) => {
        event.preventDefault();
    };

    render() {

        const {
            classes,
            open,
            keepMounted,
            _username,
            _showPassword,
            _password
        } = this.state;

        return (
            <Dialog
                open={open}
                keepMounted={false}
                onClose={this.props.onClose}
                maxWidth={"xs"}
                fullWidth={true}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
            >
                <DialogTitle id="alert-dialog-title">Log In</DialogTitle>
                <DialogContent>
                    <DialogContentText id="alert-dialog-description">
                        Your account's keys will be stored on this web browser.
                    </DialogContentText>
                    <FormControl fullWidth className={classes.usernameInput}>
                        <InputLabel htmlFor="username-input">Username</InputLabel>
                        <Input
                            id="username-input"
                            type={'text'}
                            value={_username}
                            onChange={this._handleUsernameChange}
                            startAdornment={<InputAdornment position="start">@</InputAdornment>}
                        />
                    </FormControl>
                    <FormControl fullWidth className={classes.passwordInput}>
                        <InputLabel htmlFor="password-input">Password</InputLabel>
                        <Input
                            id="password-input"
                            type={_showPassword ? 'text' : 'password'}
                            value={_password}
                            onChange={this._handlePasswordChange}
                            endAdornment={
                                <InputAdornment position="end">
                                    <IconButton
                                        aria-label="toggle password visibility"
                                        onClick={this._handleClickShowPassword}
                                        onMouseDown={this._handleMouseDownPassword}
                                    >
                                        {_showPassword ? <Visibility /> : <VisibilityOff />}
                                    </IconButton>
                                </InputAdornment>
                            }
                        />
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={this.props.onClose} color="primary">
                        Cancel
                    </Button>
                    <Button onClick={this.props.onConfirm} color="primary" autoFocus>
                        Log In
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }
}

export default withStyles(styles)(LoginModal);
