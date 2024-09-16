import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import Typography from "@material-ui/core/Typography";
import TextField from "@material-ui/core/TextField";
import Divider from "@material-ui/core/Divider";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import PixaPaperWallet from "../utils/paperWallet";

import { t } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";
const styles = theme => ({

});

class WalletDialog extends React.PureComponent {

    constructor(props) {
        super(props);
        this.state = {
            classes: props.classes,
            keepMounted: props.keepMounted || false,
            open: props.open,
            api: props.api,
            _username: "",
            _token_number: 666,
            _legal_name: ""
        };
    };

    componentWillReceiveProps(new_props) {

        this.setState(new_props, () => {

            this.forceUpdate();
        });
    }

    _handle_username_text_change = (event) => {

        this.setState({_username: event.target.value.toString()}, () => {

            this.forceUpdate();
        });
    };

    _handle_legal_name_text_change = (event) => {

        this.setState({_legal_name: event.target.value.toString()}, () => {

            this.forceUpdate();
        });
    };

    _download_files = (_username, _legal_name) => {

        // Example usage:
        const wallet = new PixaPaperWallet(this.state._username, this.state._legal_name);
        wallet.generateKeys().then(() => {
            wallet.createPaperWalletImage();
            wallet.createJSONFile();
        });
    };

    render() {

        const {
            classes,
            _username,
            _token_number,
            _legal_name,
            open,
            keepMounted
        } = this.state;

        return (
            <Dialog open={open}
                    fullWidth={true}
                    disablePortal={false}
                    onClose={this.props.onClose}
                    keepMounted={false}>
                <DialogContent>
                    <Typography component={"h2"} variant={"h6"}>{t("components.wallet_dialog.generate_a_wallet_for_pixagram")}</Typography>
                    <Divider />
                    <form noValidate autoComplete="off">
                        <TextField
                            fullWidth={true}
                            label={t("components.wallet_dialog.users_name")}
                            value={_username}
                            placeholder={t("components.wallet_dialog.stafford_beer")}
                            onChange={this._handle_username_text_change}
                        />
                        <TextField
                            fullWidth={true}
                            label={t("components.wallet_dialog.legal_name")}
                            value={_legal_name}
                            placeholder={t("components.wallet_dialog.stafford_beer_2")}
                            onChange={this._handle_legal_name_text_change}
                        />
                    </form>
                </DialogContent>
                <DialogActions style={{textAlign: "right"}}>
                    <Button variant="text" color="primary" onClick={() => {this._download_files(_username, _legal_name)}}>{t("words.download", {TUC: true})}</Button>
                    <Button variant="contained" color="primary" autoFocus onClick={this.props.onClose}>{t("words.close", {TUC: true})}</Button>
                </DialogActions>
            </Dialog>
        );
    }
}

export default withLanguage(withStyles(styles)(WalletDialog));