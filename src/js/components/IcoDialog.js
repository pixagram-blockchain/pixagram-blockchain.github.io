import * as React from "preact/compat";

import withStyles from "@material-ui/core/styles/withStyles";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogActions from "@material-ui/core/DialogActions";
import Typography from "@material-ui/core/Typography";
import Divider from "@material-ui/core/Divider";
import Button from "@material-ui/core/Button";
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemAvatar from '@material-ui/core/ListItemAvatar';
import LinearProgress from '@material-ui/core/LinearProgress';
import Avatar from '@material-ui/core/Avatar';
import Badge from "@material-ui/core/Badge";
import CallOutlined from "@material-ui/icons/CallOutlined";

import { t } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";
const styles = theme => ({
    dialog: {
        "& .MuiDialog-paperScrollPaper": {
            [theme.breakpoints.down("sm")]: {
                maxHeight: "100%"
            },
        },
    },
    subTitle: {
        margin: "24px 0px 12px 0px"
    },
    dialogContent: {
        margin: "12px 0px 24px 0px"
    },
    link: {
        cursor: "pointer",
        textDecoration: "underline"
    },
    boxContainer: {
        display: "flex",
        flexWrap: "wrap"
    },
    tooltip: {
        margin: "8px",
        display: "block",
        fontSize: "14px",
        lineHeight: "22px"
    },
    boxLarge: {
        userSelect: "none",
        cursor: "pointer",
        padding: 16,
        margin: 8,
        backgroundColor: "rgba(136,136,136,0.1)",
        border: "1px solid #333",
        flex: "1 1 calc(100% - 16px)",
        borderRadius: "24px",
        boxSizing: "border-box",
        transition: "all 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms",
        "&:hover": {
            backgroundColor: "rgba(136,136,136,0.2)",
            border: "1px solid #666",
            transition: "all 150ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        }
    },
    box: {
        userSelect: "none",
        cursor: "pointer",
        padding: 16,
        margin: 8,
        backgroundColor: "rgba(136,136,136,0.1)",
        border: "1px solid #333",
        flex: "1 1 calc(25% - 16px)",
        borderRadius: "24px",
        boxSizing: "border-box",
        transition: "all 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms",
        [theme.breakpoints.down("sm")]: {
            flex: "1 1 calc(50% - 16px)",
        },
        "&:hover": {
            backgroundColor: "rgba(136,136,136,0.2)",
            border: "1px solid #666",
            transition: "all 150ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        }
    },
    boxPrimary: {
        fontSize: "24px",
        color: "#fff",
        display: "block",
        marginBottom: "4px"
    },
    boxSecondary: {
        fontSize: "12px",
        color: "#999",
        display: "block"
    },
    linearProgress: {
        margin: "16px 0px 12px 0px",
        borderRadius: "6px",
        height: "18px",
        lineHeight: "18px",
        "@global": {
            "@keyframes glow": {
                "0%": {
                    background: "#3f3f3f",
                    color: "#d2d2d2"
                },
                "100%": {
                    background: "#595959",
                    color: "#fff"
                },
            }
        },
        "& div.MuiLinearProgress-barColorPrimary": {
            background: "#cdcdcd",
            "&::after": {
                content: `"Raised"`,
                position: "absolute",
                right: 2,
                bottom: 0,
                fontSize: "11px",
                color: "#000"
            },
        },
        "& div.MuiLinearProgress-colorPrimary": {
            "&::after": {
                content: `"Target"`,
                position: "absolute",
                right: 8,
                bottom: 0,
                fontSize: "11px",
                animation: "$glow 1s infinite linear alternate",
            },
            animation: "$glow 1s infinite linear alternate"
        },
        "& div.MuiLinearProgress-dashedColorPrimary": {
            background: "#2d2d2d",
            backgroundImage: "inherit",
            animation: "none",
            "&::after": {
                content: `""`,
                position: "absolute",
                right: 8,
                bottom: 0,
                fontSize: "11px",
                color: "#595959"
            },
        }
    },
    phoneIcon: {
        "@global": {
            "@keyframes rotateGlow": {
                "0%": {
                    transform: "rotate(-5deg) scale(1.1)"
                },
                "50%": {
                    transform: "rotate(5deg) scale(0.9)",
                },
                "100%": {
                    transform: "rotate(15deg) scale(1.1)"
                },
            }
        },
        color: "#78ff63",
        filter: "drop-shadow(0px 0px 4px #2ecb19) drop-shadow(0px 0px 8px #1CA909FF) drop-shadow(0px 0px 16px #0D6400FF)",
        animation: "$rotateGlow 1.5s infinite ease-in-out alternate"
    },
    badger: {
        "& .MuiBadge-colorSecondary": {
            backgroundColor: "#00ff00"
        }
    }
});

class IcoDialog extends React.PureComponent {

    constructor(props) {
        super(props);
        this.state = {
            classes: props.classes,
            open: props.open
        };
    };

    componentWillMount() {

    }

    shouldComponentUpdate(nextProps, nextState, nextContext) {
        return false;
    }

    componentWillReceiveProps(nextProps, nextContext) {

        if(this.state.open !== nextProps.open) {
            this.setState({open: nextProps.open}, () => {
                this.forceUpdate();
            });
        }
    }

    _open_link = (url) => {

        window.open(url, "_blank", "noopener,noreferrer");
    };

    render() {

        const {
            classes,
            open,
            keepMounted,
            _authors
        } = this.state;

        return (
            <Dialog
                    className={classes.dialog}
                    open={open}
                    fullWidth={true}
                    disablePortal={false}
                    onClose={this.props.onClose}
                    keepMounted={false}>
                <DialogTitle style={{width: "100%", margin: "0px 0px 16px 0px"}}>
                    <Typography component={"span"} variant={"h4"} style={{float: "left", margin: "0px"}}>{t("components.ico_dialog.initial_coin_offering")}</Typography>
                    <Typography component={"span"} variant={"h4"} style={{float: "right", margin: "0px", color: "#666666"}}>{t("components.ico_dialog.stage_1_5")}</Typography>
                </DialogTitle>
                <Divider />
                <DialogContent scroll={"paper"} className={classes.dialogContent}>
                    <Typography component={"h2"} variant={"h6"}>{t("components.ico_dialog.pre_seed_stage")}</Typography>
                    <p>{t("components.ico_dialog.check_our_pitch_deck_out_to_know")}</p>
                    <div className={classes.boxContainer}>
                        <div className={classes.box}>
                            <span className={classes.boxPrimary}>
                                <span style={{color: "#15ed45"}}>$0.03 </span>
                                <strike style={{color: "#999999", fontSize: "16px"}}>$0.06</strike>
                            </span>
                            <span className={classes.boxSecondary}>{t("components.ico_dialog.friends_family_fools")}</span>
                        </div>

                        <div className={classes.box}>
                            <span className={classes.boxPrimary}>-50%</span>
                            <span className={classes.boxSecondary}>{t("components.ico_dialog.at_the_pre_seed_stage_on_the")}</span>
                        </div>
                        <div className={classes.box}>
                            <span className={classes.boxPrimary}>3.33M</span>
                            <span className={classes.boxSecondary}>{t("components.ico_dialog.of_token_available_at_this_stage")}</span>
                        </div>
                        <div className={classes.box}>
                            <span className={classes.boxPrimary}>$100K</span>
                            <span className={classes.boxSecondary}>{t("components.ico_dialog.target_raise_for_pre_seed_stage")}</span>
                        </div>
                        <div className={classes.boxLarge}>
                            <span className={classes.boxPrimary}>6.1% <span style={{color: "#8f8f8f"}}>(6.1K / 100K)</span></span>
                            <LinearProgress className={classes.linearProgress} variant="buffer" value={6.1} valueBuffer={100} />
                            <span className={classes.boxSecondary}>{t("components.ico_dialog.limited_time_only_trusting_us_at_this")}</span>
                        </div>
                    </div>
                    <Typography component={"h2"} variant={"h6"} style={{marginTop: 12}}>{t("components.ico_dialog.download")}</Typography>
                    <p>{t("components.ico_dialog.you_can_check_out_our_litepaper_and")}</p>
                    <div style={{textAlign: "right"}}>
                        <Button onClick={() => this._open_link("https://drive.google.com/file/d/1YY87o9S05keK8ASHnLxaKdbxlZUbU7p3/view?usp=sharing")}>{t("components.ico_dialog.pitch_deck")}</Button>
                        <Button onClick={() => this._open_link("https://drive.google.com/file/d/1K9XE5xVFfimA3k8D3TnUGrUaXL-9mwVc/view?usp=sharing")}>{t("components.ico_dialog.lite_paper")}</Button>
                    </div>
                    <Typography component={"h2"} variant={"h6"} style={{marginTop: 12}}>{t("components.ico_dialog.book_a_meeting")}</Typography>
                    <p>{t("components.ico_dialog.book_a_meeting_with_our_team_to")}</p>
                    <List dense>
                        {Object.values(_authors).slice(0, 1).map((value, index) => {
                            const labelId = `checkbox-list-secondary-label-${value.username}`;
                            return (
                                <ListItem key={labelId}>
                                    <ListItemAvatar>
                                        <Badge color="secondary" className={classes.badger} variant="dot" invisible={index > 2} overlap="circular"  anchorOrigin={{
                                            vertical: 'top',
                                            horizontal: 'right',
                                        }}>
                                            <Avatar
                                                className={"pixelated"}
                                                alt={`Avatar ${value.username}`}
                                                src={value.image}
                                            />
                                        </Badge>
                                    </ListItemAvatar>
                                    <ListItemText id={labelId} primary={`${value.name}`} secondary={
                                        <span>
                                            <span>{value.description}</span>
                                        </span>
                                    }/>
                                    <ListItemSecondaryAction>
                                        <Button className={classes.phoneIcon} onClick={() => this._open_link("https://www.linkedin.com/in/matias-affolter/")}>{t("components.ico_dialog.reach_me_out")} <CallOutlined style={{marginLeft: 8}}/></Button>
                                    </ListItemSecondaryAction>
                                </ListItem>
                            );
                        })}
                    </List>
                </DialogContent>
                <DialogActions>
                    <Button onClick={this.props.onClose} autoFocus variant="contained" color="primary">
                        {t("words.close")}
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }
}

export default withLanguage(withStyles(styles)(IcoDialog));