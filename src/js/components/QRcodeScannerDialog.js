import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import Typography from "@material-ui/core/Typography";
import SwitchCamera from "@material-ui/icons/SwitchCamera";
import IconButton from "@material-ui/core/IconButton";
import QrScanner from 'qr-scanner/qr-scanner.min';
import FlashOff from "@material-ui/icons/FlashOff";
import FlashOn from "@material-ui/icons/FlashOn";

import { t } from "../utils/text";

const styles = theme => ({

});

class QRcodeScannerDialog extends React.PureComponent {

    constructor(props) {
        super(props);
        this.state = {
            classes: props.classes,
            keepMounted: props.keepMounted || false,
            open: props.open,
            _list: [],
            _chosen: 0,
            _qrScanner: {},
            _flashOn: false,
            _hasFlash: false
        };
    };

    componentWillReceiveProps(new_props) {

        this.setState(new_props, () => {
            this.forceUpdate();
        });
    }

    componentDidMount() {
        QrScanner.hasCamera().then((has) => {
            if(!has){
                this.props.onClose("No Camera Found");
            }else {
                const el = document.getElementById("qr-video");
                QrScanner.listCameras().then((list) => {
                    this.setState({_list: list}, () => {
                        const qrScanner = new QrScanner(
                            el,
                            this._onDecode,
                            {alsoTryWithoutScanRegion: true},
                        );
                        qrScanner.start();
                        qrScanner.hasFlash().then((hasFlash) => {
                            this.setState({_hasFlash: hasFlash}, () => {
                                this.forceUpdate();
                            })
                        })
                        this.setState({_qrScanner: qrScanner});
                    });
                })
            }
        }); // async

    }

    _onDecode = (result) => {
        if(typeof this.props.onSuccess === "function"){
            this.props.onSuccess(result);
        }
    }

    componentWillUnmount() {
        this._resetProps();
    }

    _switch_camera = () => {

        this.setState({_chosen: ((this.state._chosen+1) % this.state._list.length) || 0}, () => {
            this.state._qrScanner.setCamera(this.state._list[this.state._chosen]);
        });
    }

    _resetProps = () => {
        this.state._qrScanner.stop();
        this.state._qrScanner.destroy();
    };


    close_confirm = () => {
        this._resetProps();
        this.props.onClose();
    }

    _toggleFlash = () => {
            if(!this.state._flashOn){
                this.state._qrScanner.turnFlashOn().then(() => {
                    this.setState({_flashOn: !this.state._flashOn}, () => {this.forceUpdate();});
                });
            }else {
                this.state._qrScanner.turnFlashOff().then(( ) => {
                    this.setState({_flashOn: !this.state._flashOn}, () => {this.forceUpdate();});
                });
            }
    }

    render() {

        const {
            classes,
            open,
            keepMounted,
            _flashOn,
            _hasFlash
        } = this.state;

        return (
            <React.Fragment>
                <Dialog open={open}
                        maxWidth={"sm"}
                        fullWidth={true}
                        disablePortal={false}
                        onClose={this.close_confirm}
                        keepMounted={false}>
                    <DialogContent>
                        <Typography style={{marginTop: 8, marginBottom: 24}} component={"h2"} variant={"h6"}>{t("components.qrcode_scanner_dialog.scanner")}</Typography>
                        <div id="video-container">
                            <video id="qr-video"></video>
                            <div style={{position: "absolute", width: "100%", left: 0, bottom: 0}}>
                                <IconButton onClick={this._switch_camera}><SwitchCamera/></IconButton>
                                {_hasFlash && <IconButton onClick={this._toggleFlash}>{_flashOn ? <FlashOff/>: <FlashOn/>}</IconButton>}
                            </div>
                        </div>
                    </DialogContent>
                    <DialogActions style={{textAlign: "right"}}>
                        <Button variant="contained" color="primary" onClick={this._nextOrFinish} onClose={this.close_confirm}>{t("words.cancel")}</Button>
                    </DialogActions>
                </Dialog>
            </React.Fragment>
        );
    }
}


export default withStyles(styles)(QRcodeScannerDialog);
