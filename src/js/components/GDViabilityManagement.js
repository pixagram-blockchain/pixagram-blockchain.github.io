import * as React from "preact/compat";

import withStyles from "@material-ui/core/styles/withStyles";
import Tab from "@material-ui/core/Tab";
import Tabs from "@material-ui/core/Tabs";
import SwipeableViews from "react-swipeable-views";
import JSLoader from "../utils/JSLoader";
import DescriptionIcon from "@material-ui/icons/Description";
import HowToVoteIcon from "@material-ui/icons/HowToVote";

// Import sub-views
import GDVMWitnesses from "./GDVMWitnesses";
import GDVMProposals from "./GDVMProposals";

const styles = theme => ({
    root: {
        display: "flex",
        height: "100%",
        position: "relative",
        [theme.breakpoints.down("sm")]: {
            flexDirection: "column"
        }
    },
    tabs: {
        "& .MuiTab-root": {
            minWidth: "88px",
            minHeight: "64px",
            borderRadius: "16px",
            transition: "color 225ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
        },
        "& button:last-child": {
            marginTop: "0px"
        },
        "& .MuiTab-labelIcon .MuiTab-wrapper > *:first-child": {
            width: "1.25em",
            height: "1.25em",
            marginBottom: 0
        },
        "& .MuiTab-textColorInherit": {
            color: "#989898",
            transition: "color 225ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
        },
        "& .MuiTab-textColorInherit.Mui-selected": {
            color: "#000000",
            backgroundColor: "transparent",
            transition: "color 225ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
        },
        "& .MuiTab-textColorInherit.Mui-selected .MuiTab-wrapper": {
            color: "#000000 !important"
        },
        "& .MuiTabs-flexContainerVertical": {
            backgroundColor: "transparent",
            color: "#989898",
            transition: "all 225ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
            width: "88px",
            borderRadius: "16px"
        },
        "& .MuiTabs-flexContainerVertical:hover": {
            backgroundColor: "rgba(255,255,255,0.06)"
        },
        "& span.MuiTabs-indicator": {
            zIndex: "-1",
            width: "88px",
            height: "64px !important",
            marginTop: -4,
            marginRight: 0,
            backgroundColor: "#c7c7c7",
            borderRadius: "16px",
            transform: "scale3d(0.875, 0.85, 1)",
            transformOrigin: "50% 50%",
            transition: "all 360ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
        },
        padding: "0px",
        backgroundColor: "#020202",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        position: "absolute",
        top: "50%",
        transform: "translateY(-50%)",
        height: "auto",
        borderRadius: "18px",
        margin: "0px 0px 0px 18.5px",
        left: 0,
        zIndex: 1,
        transition: "background-color 320ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
        "&:hover": {
            backgroundColor: "#000000",
        },
        [theme.breakpoints.down("sm")]: {
            position: "relative",
            top: "0",
            transform: "none",
            flexDirection: "row",
            justifyContent: "center",
            padding: "0px",
            height: "auto",
            backgroundColor: "#171717",
            borderRadius: "21px",
            marginTop: 8,
            marginBottom: 16,
            marginLeft: 16,
            width: "calc(100% - 32px)",
            "& .MuiTabs-flexContainer": {
                flexDirection: "row"
            },
            "& .MuiTabs-flexContainerVertical": {
                flexDirection: "row",
                width: "100%",
                borderRadius: "21px"
            },
            "& .MuiTab-root": {
                flex: 1,
                minWidth: "unset",
                minHeight: "48px",
                borderRadius: "21px"
            },
            "& .MuiTab-textColorInherit": {
                color: "#989898"
            },
            "& .MuiTab-textColorInherit.Mui-selected": {
                color: "#171717"
            },
            "& .MuiTab-textColorInherit.Mui-selected .MuiTab-wrapper": {
                color: "#171717 !important"
            },
            "& span.MuiTabs-indicator": {
                width: "auto",
                height: "48px !important",
                marginTop: 0,
                marginBottom: 0,
                marginRight: 0,
                backgroundColor: "#c7c7c7",
                transformOrigin: "50% 50%",
                borderRadius: "21px",
                transform: "scale3d(0.9, 0.75, 1)",
                transition: "all 360ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
            },
        }
    },
    contentWrapper: {
        flex: 1,
        marginLeft: "124px",
        overflow: "hidden",
        "& .react-swipeable-view-container": {
            height: "100% !important"
        },
        "& .react-swipeable-view-container > div": {
            height: "100% !important",
            overflow: "hidden auto !important"
        },
        [theme.breakpoints.down("sm")]: {
            marginLeft: 0
        }
    }
});

class GDViabilityManagement extends React.PureComponent {
    constructor(props) {
        super(props);
        this._mql = null;
        this.state = {
            _sub_tab_value: 0,
            _authors: [],
            _is_mobile: typeof window !== "undefined" && window.innerWidth <= 600
        };
    }

    componentDidMount() {
        JSLoader(() => import("../data/authors")).then((d1) => {
            const authors = d1.default();
            this.setState({ _authors: authors }, () => {
                this.forceUpdate();
            });
        });

        if (typeof window !== "undefined" && window.matchMedia) {
            this._mql = window.matchMedia("(max-width: 600px)");
            this._mql.addEventListener("change", this._handleMediaChange);
        }
    }

    componentWillUnmount() {
        if (this._mql) {
            this._mql.removeEventListener("change", this._handleMediaChange);
        }
    }

    _handleMediaChange = (e) => {
        this.setState({ _is_mobile: e.matches }, () => {
            this.forceUpdate();
        });
    }

    _handleSubTabChange = (e, value) => {
        this.setState({ _sub_tab_value: value }, () => {
            this.forceUpdate();
        });
    }

    render() {
        const { classes, api } = this.props;
        const { _sub_tab_value, _authors, _is_mobile } = this.state;

        return (
            <div className={classes.root}>
                <Tabs
                    orientation={_is_mobile ? "horizontal" : "vertical"}
                    variant={_is_mobile ? "fullWidth" : "standard"}
                    value={_sub_tab_value}
                    onChange={this._handleSubTabChange}
                    className={classes.tabs}
                >
                    <Tab icon={<DescriptionIcon />} />
                    <Tab icon={<HowToVoteIcon />} />
                </Tabs>

                <div className={classes.contentWrapper}>
                    <SwipeableViews
                        axis={_is_mobile ? "x" : "y"}
                        containerStyle={{ height: "100%" }}
                        animateHeight={false}
                        animateTransitions={true}
                        resistance={true}
                        index={_sub_tab_value}
                        onChangeIndex={(v) => this._handleSubTabChange({}, v)}
                        disabled={true}
                    >
                        <GDVMProposals api={api} />
                        <GDVMWitnesses api={api} authors={_authors} />
                    </SwipeableViews>
                </div>
            </div>
        );
    }
}

export default withStyles(styles)(GDViabilityManagement);