import * as React from "preact/compat";

import withStyles from "@material-ui/core/styles/withStyles";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import Typography from "@material-ui/core/Typography";
import Tab from "@material-ui/core/Tab";
import Tabs from "@material-ui/core/Tabs";
import SwipeableViews from "react-swipeable-views";
import IconButton from "@material-ui/core/IconButton";
import CloseIcon from "@material-ui/icons/Close";
import PieChart from "@material-ui/icons/PieChart";
import Description from "@material-ui/icons/Description";
import Vote from "../icons/Vote";
import JSLoader from "../utils/JSLoader";

// Import view components
import StatusView from "./StatusView";
import WitnessesView from "./WitnessesView";
import ProposalsView from "./ProposalsView";

import { t } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";
const styles = theme => ({
    dialog: {
        "& .MuiDialog-paperScrollPaper": {
            maxHeight: "calc(100% - 60px)",
            [theme.breakpoints.down("sm")]: {
                maxHeight: "100%",
                minHeight: "100%",
                margin: "0px",
                borderRadius: "0px !important",
                display: "flex",
                flexDirection: "column"
            }
        },
        "& .MuiDialog-paperFullWidth": {
            [theme.breakpoints.down("sm")]: {
                width: "100% !important"
            }
        },
        "& .react-swipeable-view-container": {
            height: "max(80vh, calc(-372px + 100vh)) !important",
            [theme.breakpoints.down("sm")]: {
                flex: "1 1 auto !important",
                height: "auto !important"
            }
        },
        "& .react-swipeable-view-container > div": {
            height: "max(80vh, calc(-372px + 100vh)) !important",
            overflow: "hidden auto !important",
            [theme.breakpoints.down("sm")]: {
                height: "100% !important"
            }
        }
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
        margin: "0px 16px 0px 16px",
        width: "calc(100% - 32px)",
        borderRadius: "21px",
        top: 0,
        left: 0,
        zIndex: 1,
        transition: "transform 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
    },
    closeButton: {
        position: "absolute",
        right: 8,
        top: 8
    }
});

class WitnessesDialog extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            classes: props.classes,
            open: props.open,
            _authors: [],
            _tab_value: 0,
            _blocks_number: 0
        };
    }

    shouldComponentUpdate(nextProps, nextState, nextContext) {
        return false;
    }

    componentDidMount() {
        JSLoader(() => import("../data/authors")).then((d1) => {
            const authors = d1.default();
            this.setState({ _authors: authors }, () => {
                this.forceUpdate();
            });
        });
    }

    componentWillReceiveProps(nextProps, nextContext) {
        if (this.state.open !== nextProps.open) {
            this.setState({ open: nextProps.open }, () => {
                this.forceUpdate(() => {
                    if (this.state.open) {
                        const interval = setInterval(() => {
                            this.setState({ _blocks_number: this.state._blocks_number + 1 }, () => {
                                this.forceUpdate();
                            });
                            if (this.state._blocks_number >= 4) {
                                clearInterval(interval);
                            }
                        }, 3000);
                    } else {
                        this.setState({ _blocks_number: 0 }, () => {
                            this.forceUpdate();
                        });
                    }
                });
            });
        }
    }

    _handleTabChange = (e, value) => {
        this.setState({ _tab_value: value }, () => {
            this._swipeableViewScrollTop();
            this.forceUpdate();
        });
    }

    _swipeableViewScrollTop = () => {
        const views = document.getElementsByClassName("react-swipeable-view-container");
        const view = views.item(0);
        if (view) {
            const child = view.children.item(0);
            if (child) {
                child.style.scrollBehavior = "smooth";
                child.scrollTop = 0;
            }
        }
    }

    render() {
        const {
            classes,
            open,
            _authors,
            _tab_value,
            _blocks_number
        } = this.state;

        return (
            <Dialog
                className={classes.dialog}
                open={open}
                maxWidth={"lg"}
                fullWidth={true}
                disablePortal={false}
                onClose={this.props.onClose}
                keepMounted={false}
            >
                <DialogTitle style={{ display: "flex", margin: "0px 0px 0px 0px", position: "relative" }}>
                    <Typography component={"h1"} variant={"h4"} style={{ float: "left", width: "100%", margin: "0px" }}>
                        {t("words.governance")}
                    </Typography>
                    <IconButton className={classes.closeButton} onClick={this.props.onClose} aria-label="close">
                        <CloseIcon />
                    </IconButton>
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
                    <Tab icon={<PieChart />} />
                    <Tab icon={<Vote />} />
                    <Tab icon={<Description />} />
                </Tabs>
                <SwipeableViews
                    ignoreNativeScroll={true}
                    containerStyle={{ height: "100%" }}
                    animateHeight={false}
                    animateTransitions={true}
                    disableLazyLoading={true}
                    resistance={true}
                    springConfig={{
                        tension: 450,
                        friction: 60,
                        duration: '120ms',
                        easeFunction: 'cubic-bezier(0.280, 0.840, 0.420, 1)',
                        delay: '5ms'
                    }}
                    index={_tab_value}
                    onChangeIndex={(v) => this._handleTabChange({}, v)}
                    disabled={false}
                    key={"swipe-able-view"}
                >
                    <StatusView blocksNumber={_blocks_number} />
                    <WitnessesView authors={_authors} />
                    <ProposalsView />
                </SwipeableViews>
            </Dialog>
        );
    }
}

export default withLanguage(withStyles(styles)(WitnessesDialog));