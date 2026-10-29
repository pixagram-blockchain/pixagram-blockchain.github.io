import * as React from "preact/compat";

import withStyles from "@material-ui/core/styles/withStyles";
import Tab from "@material-ui/core/Tab";
import Tabs from "@material-ui/core/Tabs";
import Tooltip from "@material-ui/core/Tooltip";
import SwipeableViews from "react-swipeable-views";
import JSLoader from "../utils/JSLoader";
import { t } from "../utils/text";
import { GOVERNANCE_SECTIONS } from "../utils/constants";
import DescriptionIcon from "@material-ui/icons/Description";
import HowToVoteIcon from "@material-ui/icons/HowToVote";
import AccountBalanceIcon from "@material-ui/icons/AccountBalance";

// Import sub-views
import GDVMWitnesses from "./GDVMWitnesses";
import GDVMProposals from "./GDVMProposals";
import GDVMTokenomics from "./GDVMTokenomics";

// Tab indices, in rail order. GDVMTokenomics jumps to the proposals tab
// from the DPF card, so the index is named rather than counted.
const TAB_PROPOSALS = 0;
const TAB_WITNESSES = 1;
const TAB_TOKENOMICS = 2;

// The rail's tabs by name in the address (+governance-viability-<name>):
// GOVERNANCE_SECTIONS.viability in utils/constants, index-aligned with the
// indices above — "proposals", "vote" (the witnesses), "tokenomics".
const SECTIONS = GOVERNANCE_SECTIONS.viability;
function tabOfSection(section) {
    const i = SECTIONS.indexOf(section);
    return i >= 0 ? i : TAB_PROPOSALS;
}

/** Translation with an English fallback: utils/text renders a missing key as its last segment. */
function label(key, fallback) {
    const v = t(key);
    return !v || v === key || v === key.slice(key.lastIndexOf(".") + 1) ? fallback : v;
}

const L = "components.gdviability_management.";

// The rail's tabs, in rail order (TAB_* above), named on hover and for screen readers.
const TABS = [
    { value: TAB_PROPOSALS, icon: DescriptionIcon, label: () => label(L + "tab_proposals", "Proposals") },
    { value: TAB_WITNESSES, icon: HowToVoteIcon, label: () => label(L + "tab_witnesses", "Witnesses") },
    { value: TAB_TOKENOMICS, icon: AccountBalanceIcon, label: () => label(L + "tab_tokenomics", "Tokenomics") }
];

// Width of the rail (a 40 px tab inside a 4 px padding) and its distance from the panel's edges.
const RAIL = 48;
const RAIL_INSET = 18.5;

// Below this width (theme breakpoint xs) the rail becomes a bar of tabs over the content, swiped sideways.
// The orientation of the tabs and the styles switch at the same width.
const PHONE = "(max-width: 599.95px)";

const styles = theme => ({
    root: {
        display: "flex",
        height: "100%",
        position: "relative",
        [theme.breakpoints.down("xs")]: {
            flexDirection: "column"
        }
    },
    // Desktop: a thin rail pinned to the top left corner, just as tall as its
    // three square tabs, which stays put while the content scrolls beside it.
    // The indicator pill follows the selected tab (MUI writes its top and
    // height inline for vertical tabs) and slides from one tab to the next.
    tabs: {
        "& .MuiTabs-scroller": {
            minHeight: 0
        },
        "& .MuiTab-root": {
            flex: "0 0 auto",
            width: "40px",
            minWidth: "40px",
            height: "40px",
            minHeight: "40px",
            maxHeight: "none",
            padding: 0,
            borderRadius: "12px",
            transition: "color 225ms cubic-bezier(0.4, 0, 0.2, 1) 0ms, background-color 150ms ease"
        },
        "& button:last-child": {
            marginTop: "0px"
        },
        "& .MuiTab-labelIcon .MuiTab-wrapper > *:first-child": {
            width: "20px",
            height: "20px",
            marginBottom: 0
        },
        "& .MuiTab-textColorInherit": {
            color: "#7a7a7a",
            transition: "color 225ms cubic-bezier(0.4, 0, 0.2, 1) 0ms, background-color 150ms ease"
        },
        "& .MuiTab-textColorInherit.Mui-selected": {
            color: "#000000",
            backgroundColor: "transparent",
            transition: "color 225ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
        },
        "& .MuiTab-textColorInherit.Mui-selected .MuiTab-wrapper": {
            color: "#000000 !important"
        },
        // the rail only: its icons at full strength, lit on hover, ringed on keyboard focus
        [theme.breakpoints.up("sm")]: {
            "& .MuiTab-root": {
                opacity: 1
            },
            "& .MuiTab-textColorInherit:not(.Mui-selected):hover": {
                color: "#e8e8e8",
                backgroundColor: "rgba(255,255,255,0.06)"
            },
            "& .MuiTab-textColorInherit.Mui-focusVisible": {
                boxShadow: "inset 0 0 0 2px #555"
            }
        },
        "& .MuiTabs-flexContainerVertical": {
            gap: "4px",
            width: "40px",
            backgroundColor: "transparent"
        },
        "& span.MuiTabs-indicator": {
            zIndex: "-1",
            left: 0,
            right: "auto",
            width: "40px",
            // height and top: MUI's inline values (those of the selected tab)
            backgroundColor: "#c7c7c7",
            borderRadius: "12px",
            transition: "all 360ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
        },
        padding: "4px",
        minHeight: 0,
        width: `${RAIL}px`,
        backgroundColor: "#101010",
        display: "flex",
        position: "absolute",
        top: RAIL_INSET,
        left: 0,
        margin: `0px 0px 0px ${RAIL_INSET}px`,
        borderRadius: "16px",
        zIndex: 1,
        [theme.breakpoints.down("xs")]: {
            position: "relative",
            top: "0",
            bottom: "auto",
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
                height: "auto",
                borderRadius: "21px"
            },
            "& .MuiTab-root": {
                flex: 1,
                width: "auto",
                minWidth: "unset",
                height: "48px",
                minHeight: "48px",
                maxHeight: "none",
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
        // the rail, its inset, and as much again between the rail and the content
        marginLeft: `${RAIL + 2 * RAIL_INSET - 1}px`,
        overflow: "hidden",
        "& .react-swipeable-view-container": {
            height: "100% !important"
        },
        "& .react-swipeable-view-container > div": {
            height: "100% !important",
            overflow: "hidden auto !important"
        },
        [theme.breakpoints.down("xs")]: {
            marginLeft: 0
        }
    }
});

class GDViabilityManagement extends React.PureComponent {
    constructor(props) {
        super(props);
        this._mql = null;
        this.state = {
            _sub_tab_value: tabOfSection(props.section),
            _authors: [],
            _is_mobile: typeof window !== "undefined" && window.matchMedia ? window.matchMedia(PHONE).matches : false
        };
    }

    componentDidMount() {
        if (typeof window !== "undefined" && window.matchMedia) {
            this._mql = window.matchMedia(PHONE);
            this._mql.addEventListener("change", this._handleMediaChange);
        }
    }

    componentDidUpdate(prevProps) {
        // A new section from the address (the back arrow, a link): show it.
        // Our own report comes back naming the tab already shown.
        if (this.props.section && this.props.section !== prevProps.section) {
            const tab = tabOfSection(this.props.section);
            if (tab !== this.state._sub_tab_value) {
                this.setState({ _sub_tab_value: tab }, () => {
                    this.forceUpdate();
                });
            }
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
        const changed = value !== this.state._sub_tab_value;
        this.setState({ _sub_tab_value: value }, () => {
            this.forceUpdate();
        });
        // Mirror the rail tab in the address (+governance-viability-<name>).
        if (changed && this.props.onSectionChange && SECTIONS[value]) {
            this.props.onSectionChange(SECTIONS[value]);
        }
    }

    _openProposals = () => {
        this._handleSubTabChange({}, TAB_PROPOSALS);
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
                    {TABS.map((x) => {
                        const Icon = x.icon;
                        const tab = <Tab key={x.value} icon={<Icon />} value={x.value} aria-label={x.label()} />;
                        // The thin rail shows icons only: each one is named on hover. The Tooltip passes
                        // on to its Tab the props Tabs gives its children.
                        return _is_mobile ? tab : (
                            <Tooltip key={x.value} title={x.label()} placement="right" enterDelay={300}>
                                {tab}
                            </Tooltip>
                        );
                    })}
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
                        <GDVMTokenomics api={api} onOpenProposals={this._openProposals} />
                    </SwipeableViews>
                </div>
            </div>
        );
    }
}

export default withStyles(styles)(GDViabilityManagement);