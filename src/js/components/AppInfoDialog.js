import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogContentText from "@material-ui/core/DialogContentText";
import DialogTitle from "@material-ui/core/DialogTitle";
import Tab from "@material-ui/core/Tab";
import Tabs from "@material-ui/core/Tabs";
import Typography from "@material-ui/core/Typography";
import IntellectualProperty from "./IntellectualProperty";
import TermsOfUse from "./TermsOfUse";
import SwipeableViews from "react-swipeable-views";
import TeamAndCompany from "./TeamAndCompany";
import FAQ from "./FAQ";
import CommunityPrinciples from "./CommunityPrinciples";
import { t } from "../utils/text";
import { withLanguage } from "../utils/withLanguage";

// Hoisted static styles — were inline literals re-created on every render.
const ST_D_FLEX__M_0PX_0PX_16PX_0 = { display: "flex", margin: "0px 0px 16px 0px" };
const ST_FLOAT_LEFT__W_100__M_0PX = { float: "left", width: "100%", margin: "0px" };

const styles = theme => ({
    dialog: {
        "& .MuiDialog-paperScrollPaper": {
            [theme.breakpoints.down("sm")]: {
                maxHeight: "100%"
            }
        },
        "& .MuiDialog-paperFullWidth": {
            [theme.breakpoints.down("sm")]: {
                width: "100% !important"
            }
        },
        "& .react-swipeable-view-container": {
            height: "min(80vh, calc(-420px + 100vh)) !important"
        },
        "& .react-swipeable-view-container > div": {
            height: "min(80vh, calc(-420px + 100vh)) !important",
            overflow: "hidden overlay !important"
        }
    },
    dialogBody: {
        overflowY: "auto",
        display: "flex",
        flexDirection: "column"
    },
    breakAllWords: {
        wordBreak: "break-all"
    },
    cardTabs: {
        backgroundColor: "#171717",
        "& .MuiTab-root": {
            minWidth: "72px !important"
        },
        "& .MuiTab-textColorPrimary.Mui-selected": {
            backgroundColor: "transparent",
        },
        "& .MuiTab-textColorPrimary.Mui-selected .MuiTab-wrapper": {
            color: "#171717 !important"
        },
        "& .MuiTab-fullWidth": {
            backgroundColor: "transparent",
            color: "#989898",
            transition: "all 225ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
            borderRadius: "21px"
        },
        "& .MuiTab-fullWidth:hover": {
            backgroundColor: "rgba(255,255,255,0.06)"
        },
        "& span.MuiTabs-indicator": {
            zIndex: "-1",
            height: "48px",
            backgroundColor: "#c7c7c7",
            borderRadius: "21px",
            transform: "scale3d(0.875, 0.75, 1)"
        },
        margin: "8px 16px 0px 16px",
        width: "calc(100% - 32px)",
        borderRadius: "21px",
        top: 0,
        left: 0,
        zIndex: 1,
        transition: "transform 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
    },
    subTitle: {
        margin: "24px 0px 12px 0px"
    },
    dialogContent: {
        margin: "12px 0px 24px 0px"
    },
});

// Key paths only — never the resolved strings. t() must run inside render(),
// otherwise the titles freeze in whatever locale was active at import time.
const TAB_TITLE_KEYS = [
    "components.app_info_dialog.intellectual_property",
    "components.app_info_dialog.terms_of_use",
    "components.app_info_dialog.team_and_contributors",
    "components.app_info_dialog.faq",
    "components.app_info_dialog.community_principles",
];

const TAB_LABEL_KEYS = [
    "components.app_info_dialog.tab_ip",
    "components.app_info_dialog.tab_terms",
    "components.app_info_dialog.tab_team",
    "components.app_info_dialog.tab_faq",
    "components.app_info_dialog.tab_ethos",
];

class AppInfoDialog extends React.PureComponent {

    constructor(props) {
        super(props);
        this.state = {
            classes: props.classes,
            open: props.open,
            _tab_value: 0,
        };
    };

    shouldComponentUpdate(nextProps, nextState, nextContext) {
        return false;
    }

    componentWillReceiveProps(nextProps, nextContext) {

        this.setState(nextProps, this.forceUpdate);
    }

    _on_close = (event) => {

        this.props.onClose(event);
    };

    _handleTabChange = (e, value) => {
        this.setState({_tab_value: value}, () => {
            this.swipeableViewScrollTop();
            this.forceUpdate();
        })
    }

    swipeableViewScrollTop = () => {

        let views = document.getElementsByClassName("react-swipeable-view-container"), i = 0;
        let view = views.item(0);
        let child = view.children.item(0);
        child.style.scrollBehavior = "smooth";
        child.scrollTop = 0;
    };

    _get_views =  () => {
        const { classes } = this.state;
        return [
            <DialogContent scroll={"paper"} className={classes.dialogContent}>
                <IntellectualProperty/>
            </DialogContent>,
            <DialogContent scroll={"paper"} className={classes.dialogContent}>
                <TermsOfUse/>
            </DialogContent>,
            <DialogContent scroll={"paper"} className={classes.dialogContent}>
                <TeamAndCompany/>
            </DialogContent>,
            <DialogContent scroll={"paper"} className={classes.dialogContent}>
                <FAQ/>
            </DialogContent>,
            <DialogContent scroll={"paper"} className={classes.dialogContent}>
                <CommunityPrinciples/>
            </DialogContent>,
        ];
    }

    render() {

        const { classes, open } = this.state;
        const { _tab_value } = this.state;

        const title = t(TAB_TITLE_KEYS[_tab_value] || TAB_TITLE_KEYS[0]);

        return (
            <Dialog className={classes.dialog}
                    open={open}
                    maxWidth={"md"}
                    fullWidth={true}
                    disablePortal={false}
                    onClose={this.props.onClose}
                    keepMounted={false}>
                <DialogTitle style={ST_D_FLEX__M_0PX_0PX_16PX_0}>
                    <Typography component={"h1"} variant={"h4"} style={ST_FLOAT_LEFT__W_100__M_0PX}>
                        {title}
                    </Typography>
                </DialogTitle>
                <Tabs
                    className={classes.cardTabs}
                    value={_tab_value}
                    variant="fullWidth"
                    indicatorColor="primary"
                    textColor="primary"
                    onChange={this._handleTabChange}
                    fullwidth={true}
                >
                    <Tab icon={t(TAB_LABEL_KEYS[0])} />
                    <Tab icon={t(TAB_LABEL_KEYS[1])} />
                    <Tab icon={t(TAB_LABEL_KEYS[2])} />
                    <Tab icon={t(TAB_LABEL_KEYS[3])} />
                    <Tab icon={t(TAB_LABEL_KEYS[4])} />
                </Tabs>
                <SwipeableViews
                    ignoreNativeScroll={true}
                    containerStyle={{height: "100%"}}
                    animateHeight={false}
                    animateTransitions={true}
                    disableLazyLoading={true}
                    resistance={true}
                    springConfig={{tension: 450, friction: 60, duration: '120ms', easeFunction: 'cubic-bezier(0.280, 0.840, 0.420, 1)', delay: '5ms'}}
                    index={_tab_value}
                    onChangeIndex={(v) => this._handleTabChange({}, v)}
                    disabled={false}
                    key={"swipe-able-view"}
                >
                    {this._get_views()}
                </SwipeableViews>
                <DialogActions>
                    <Button onClick={this.props.onClose} autoFocus variant="contained" color="primary">
                        {t("words.close")}
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }
}

export default withLanguage(withStyles(styles)(AppInfoDialog));