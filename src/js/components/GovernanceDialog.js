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
import InfoOutlinedIcon from "@material-ui/icons/InfoOutlined";
import Tooltip from "@material-ui/core/Tooltip";

// Tab Icons
import SettingsIcon from "@material-ui/icons/Settings";
import DescriptionIcon from "@material-ui/icons/Description";
import MenuBookIcon from "@material-ui/icons/MenuBook";
// import BarChartIcon from "@material-ui/icons/BarChart";   // Metrics tab (disabled, see TAB_CONFIG)
// import DashboardIcon from "@material-ui/icons/Dashboard"; // Control Tower tab (disabled, see TAB_CONFIG)
import WarningIcon from "@material-ui/icons/Warning";

// Import view components — the SwipeableViews children below MUST stay in
// lockstep with TAB_CONFIG: the tab index doubles as the view index, so a
// view mounted for a tab that isn't listed shifts every later tab onto the
// wrong content.
import GDViabilityManagement from "./GDViabilityManagement";
import GDAttributes from "./GDAttributes";
import GDMethods from "./GDMethods";
// import GDMetrics from "./GDMetrics";           // Metrics tab (disabled, see TAB_CONFIG)
// import GDControlTower from "./GDControlTower"; // Control Tower tab (disabled, see TAB_CONFIG)
import GDDisruptions from "./GDDisruptions";

import { t, subscribe as subscribe_language } from "../utils/text";

// Copy is resolved at render time (thunks), so a language switch repaints
// the header; the dialog subscribes to language changes itself because its
// shouldComponentUpdate is a hard `false`.
//
// Each `id` is also the tab's name in the address (+governance-<id>), and
// GOVERNANCE_TABS in utils/constants lists the same ids — that list is what
// the router accepts, so a tab enabled here must be added there too. An id
// can't contain "-" (it separates the levels): re-enabling "control-tower"
// means giving it a new id.
const TAB_CONFIG = [
    {
        id: "viability",
        title: () => t("components.governance_dialog.viability_management"),
        subtitle: () => t("components.governance_dialog.take_actions"),
        description: () => t("components.governance_dialog.governs_the_system_attributes_through_proposals"),
        icon: SettingsIcon
    },
    {
        id: "attributes",
        title: () => t("components.governance_dialog.attributes"),
        subtitle: () => t("components.governance_dialog.documentation"),
        description: () => t("components.governance_dialog.enabled_by_viability_management_view_system_stat"),
        icon: DescriptionIcon
    },
    {
        id: "methods",
        title: () => t("components.governance_dialog.methods"),
        subtitle: () => t("components.governance_dialog.guides"),
        description: () => t("components.governance_dialog.associated_to_metrics_download_theory_documents"),
        icon: MenuBookIcon
    },
    /*{
        id: "metrics",
        title: () => t("components.governance_dialog.metrics"),
        subtitle: () => t("components.governance_dialog.analytics"),
        description: () => t("components.governance_dialog.measured_by_the_system_track_key_performance"),
        icon: BarChartIcon
    },
    {
        id: "control-tower",
        title: () => t("components.governance_dialog.control_tower"),
        subtitle: () => t("components.governance_dialog.dashboard"),
        description: () => t("components.governance_dialog.monitor_the_entire_ecosystem_from_a_centralized"),
        icon: DashboardIcon
    },*/
    {
        id: "disruptions",
        title: () => t("components.governance_dialog.disruptions"),
        subtitle: () => t("components.governance_dialog.reports"),
        description: () => t("components.governance_dialog.affects_viability_management_track_and_report_is"),
        icon: WarningIcon
    }
];

// Tab index for the address's governance meta; missing or unknown → the
// first tab.
function tabIndexOf(meta) {
    const i = meta ? TAB_CONFIG.findIndex((tab) => tab.id === meta.tab) : -1;
    return i >= 0 ? i : 0;
}

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
    dialogTitleContainer: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 24px",
        position: "relative"
    },
    titleWrapper: {
        display: "flex",
        flexDirection: "column",
        gap: "0px"
    },
    titleRow: {
        display: "flex",
        alignItems: "center",
        gap: "8px"
    },
    mainTitle: {
        fontSize: "28px",
        fontWeight: 600,
        color: "#ffffff",
        fontFamily: "'Industry Book'",
        margin: 0,
        lineHeight: 1.2
    },
    subtitle: {
        fontSize: "14px",
        fontWeight: 400,
        color: "#888",
        fontFamily: "'Normative Pro'",
        textTransform: "uppercase",
        letterSpacing: "1px",
        marginTop: "-12px"
    },
    infoButton: {
        color: "#666",
        padding: "4px",
        transition: "color 150ms ease",
        "&:hover": {
            color: "#aaa",
            backgroundColor: "transparent"
        }
    },
    infoIcon: {
        fontSize: "18px"
    },
    closeButton: {
        color: "#888",
        "&:hover": {
            color: "#fff",
            backgroundColor: "rgba(255,255,255,0.05)"
        }
    },
    tooltip: {
        margin: "8px",
        display: "block",
        fontSize: "14px",
        fontFamily: "'Normative Pro'",
        lineHeight: "22px",
        maxWidth: "300px"
    },
    cardTabs: {
        backgroundColor: "#171717",
        "& .MuiTab-root": {
            minWidth: "60px !important",
            padding: "12px 16px"
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
            transform: "scale3d(0.9, 0.75, 1)"
        },
        margin: "0px 16px 0px 16px",
        width: "calc(100% - 32px)",
        borderRadius: "21px",
        top: 0,
        left: 0,
        zIndex: 1,
        transition: "transform 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
    }
});

class GovernanceDialog extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            open: props.open,
            _tab_value: tabIndexOf(props.meta)
        };
        // Each tab view's own sub-level, as the address names it ("vote" in
        // +governance-viability-vote). The views stay mounted across tab
        // switches, so a section is remembered while another tab is shown and
        // named again on the way back. Read at render and by the handlers
        // only: an instance field, never a reason to render by itself.
        this._sections = {};
        this._keepSection(props.meta);
    }

    _keepSection(meta) {
        if (meta && meta.section) this._sections[meta.tab] = meta.section;
    }

    shouldComponentUpdate(nextProps, nextState, nextContext) {
        return false;
    }

    // PureComponent with a hard `false` above — nothing in props changes when
    // the user switches language, so subscribe directly and force the repaint
    // (same pattern as LexicalTextEditorDialog).
    _unsubscribeLanguage = null;

    componentDidMount() {
        this._unsubscribeLanguage = subscribe_language(() => this.forceUpdate());
    }

    componentWillUnmount() {
        if (this._unsubscribeLanguage) {
            this._unsubscribeLanguage();
            this._unsubscribeLanguage = null;
        }
    }

    componentWillReceiveProps(nextProps, nextContext) {
        if (this.state.open !== nextProps.open) {
            this.setState({ open: nextProps.open }, () => {
                this.forceUpdate();
            });
        }
        // A new `meta` means the address moved (back arrow, a link to another
        // tab or section). The echo of our own change names the tab and the
        // section already shown, so it changes nothing.
        if (nextProps.meta && nextProps.meta !== this.props.meta) {
            const meta = nextProps.meta;
            const tab = tabIndexOf(meta);
            const sectionMoved = !!meta.section && meta.section !== this._sections[meta.tab];
            this._keepSection(meta);
            if (tab !== this.state._tab_value) {
                this.setState({ _tab_value: tab }, () => this.forceUpdate());
            } else if (sectionMoved) {
                this.forceUpdate(); // hand the tab's view its new section
            }
        }
    }

    _handleTabChange = (e, value) => {
        const changed = value !== this.state._tab_value;
        this.setState({ _tab_value: value }, () => {
            this._swipeableViewScrollTop();
            this.forceUpdate();
        });
        // Mirror the tab in the address (+governance-<id>[-<section>]), with
        // the section its view still shows. Index replaces the entry, so the
        // back arrow still closes the dialog.
        const tab = TAB_CONFIG[value];
        if (changed && tab && this.props.onMetaChange) {
            this.props.onMetaChange({ kind: "governance", tab: tab.id, section: this._sections[tab.id] || null });
        }
    }

    // The Viability view moved along its own rail: remember it, re-render so
    // the view's `section` prop keeps up with what it shows (a later address
    // change back to the old value must still read as a change), and mirror it
    // in the address.
    _handleViabilitySection = (section) => {
        this._sections.viability = section;
        this.forceUpdate();
        const shown = TAB_CONFIG[this.state._tab_value];
        if (shown && shown.id === "viability" && this.props.onMetaChange) {
            this.props.onMetaChange({ kind: "governance", tab: "viability", section });
        }
    }

    _swipeableViewScrollTop = () => {
        const views = document.getElementsByClassName("react-swipeable-view-container");
        const view = views.item(0);
        if (view) {
            const child = view.children.item(this.state._tab_value);
            if (child) {
                child.style.scrollBehavior = "smooth";
                child.scrollTop = 0;
            }
        }
    }

    render() {
        const { classes, api } = this.props;
        const { open, _tab_value } = this.state;

        const currentTab = TAB_CONFIG[_tab_value];

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
                <div className={classes.dialogTitleContainer}>
                    <div className={classes.titleWrapper}>
                        <div className={classes.titleRow}>
                            <Typography component="h1" className={classes.mainTitle}>
                                {currentTab.title()}
                            </Typography>
                            <Tooltip
                                arrow
                                interactive
                                title={
                                    <div className={classes.tooltip}>
                                        {currentTab.description()}
                                    </div>
                                }
                            >
                                <IconButton className={classes.infoButton} size="small">
                                    <InfoOutlinedIcon className={classes.infoIcon} />
                                </IconButton>
                            </Tooltip>
                        </div>
                        <Typography component="span" className={classes.subtitle}>
                            {currentTab.subtitle()}
                        </Typography>
                    </div>
                    <IconButton
                        className={classes.closeButton}
                        onClick={this.props.onClose}
                        aria-label={t("words.close")}
                    >
                        <CloseIcon />
                    </IconButton>
                </div>

                <Tabs
                    className={classes.cardTabs}
                    value={_tab_value}
                    variant="fullWidth"
                    indicatorColor="primary"
                    textColor="primary"
                    onChange={this._handleTabChange}
                >
                    {TAB_CONFIG.map((tab, index) => (
                        <Tab key={tab.id} icon={<tab.icon />} />
                    ))}
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
                >
                    <GDViabilityManagement
                        api={api}
                        section={this._sections.viability || null}
                        onSectionChange={this._handleViabilitySection}
                    />
                    <GDAttributes api={api} />
                    <GDMethods api={api} />
                    {/* <GDMetrics api={api} /> */}
                    {/* <GDControlTower api={api} /> */}
                    {/* The portal tiles navigate to a community page, so the
                        view closes this (modal) dialog on the way out. */}
                    <GDDisruptions api={api} onClose={this.props.onClose} />
                </SwipeableViews>
            </Dialog>
        );
    }
}

export default withStyles(styles)(GovernanceDialog);