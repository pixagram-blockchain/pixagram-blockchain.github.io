import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import Tooltip from "@material-ui/core/Tooltip";
import Tab from "@material-ui/core/Tab";
import Tabs from "@material-ui/core/Tabs";
import SwipeableViews from "react-swipeable-views";
import IconButton from "@material-ui/core/IconButton";
import CloseIcon from "@material-ui/icons/Close";
import ArrowBackRounded from "@material-ui/icons/ArrowBackRounded";
import InfoIcon from "@material-ui/icons/Info";
import Fade from "@material-ui/core/Fade";

import { t } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";
// ─── Hex geometry (flat-top) ─────────────────────────────────────
const HEX_R = 82;
const HEX_GAP = 7;
const SQRT3 = Math.sqrt(3);
const HEX_DIST = SQRT3 * HEX_R + HEX_GAP;

function flatHexPath(cx, cy, r) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
    }
    return `M${pts.join("L")}Z`;
}

function hexPositions(cx, cy) {
    return [0, 1, 2, 3, 4, 5].map((i) => {
        const a = ((-90 + 60 * i) * Math.PI) / 180;
        return { x: cx + HEX_DIST * Math.cos(a), y: cy + HEX_DIST * Math.sin(a) };
    });
}

function getSector(mx, my, cx, cy) {
    const dx = mx - cx;
    const dy = my - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < HEX_R * 0.4) return -1;
    if (dist > HEX_DIST + HEX_R * 1.1) return -1;
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    deg = ((deg + 90) % 360 + 360) % 360;
    return Math.floor(deg / 60);
}

const SVG_W = HEX_DIST * 2 + HEX_R * 2 + 48;
const SVG_H = HEX_DIST * 2 + HEX_R * SQRT3 + 48;
const SVG_CX = SVG_W / 2;
const SVG_CY = SVG_H / 2;
const POSITIONS = hexPositions(SVG_CX, SVG_CY);

// ─── Default items ───────────────────────────────────────────────
const DEFAULT_ITEMS = [
    { id: "methods",     label: "Methods",         subtitle: "Guides",        relation: "Associated to", iconPath: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" },
    { id: "metrics",     label: "Metrics",         subtitle: "Analytics",     relation: "Measured by",   iconPath: "M18 20V10M12 20V4M6 20v-6" },
    { id: "control",     label: "Control Tower",   subtitle: "Dashboard",     relation: "Monitor",       iconPath: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" },
    { id: "disruptions", label: "Disruptions",     subtitle: "Reports",       relation: "Affects",       iconPath: "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" },
    { id: "viability",   label: "Viability Mgmt.", subtitle: "Take Actions",  relation: "Govern",        iconPath: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4" },
    { id: "attributes",  label: "Attributes",      subtitle: "Documentation", relation: "Enabled by",    iconPath: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" },
];

// ─── JSS Styles ──────────────────────────────────────────────────
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
    dialogContent: {
        margin: "12px 0px 24px 0px"
    },
    closeButton: {
        position: "absolute",
        right: 8,
        top: 8
    },
    backButton: {
        marginRight: "4px",
        marginLeft: "-12px",
        color: "#989898"
    },
    tooltip: {
        margin: "8px",
        display: "block",
        fontSize: "14px",
        lineHeight: "22px"
    },
    relationBadge: {
        display: "inline-block",
        padding: "4px 12px",
        borderRadius: "20px",
        background: "#88888833",
        fontSize: "11px",
        color: "#999",
        letterSpacing: "1.2px",
        textTransform: "uppercase",
        fontWeight: "600",
        margin: "0px 16px 4px 16px",
    },
    hexMenuContent: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "1 1 auto",
        minHeight: "max(80vh, calc(-372px + 100vh))",
        [theme.breakpoints.down("sm")]: {
            minHeight: "auto",
            flex: "1 1 auto",
        }
    },
    hexSvg: {
        width: "100%",
        maxWidth: "520px",
        maxHeight: "100%",
        overflow: "visible",
    },
    "@global": {
        "@keyframes hexSlideIn": {
            "0%": { opacity: 0, transform: "scale(0.6) translateY(8px)" },
            "100%": { opacity: 1, transform: "scale(1) translateY(0)" },
        }
    },
});

// ─── Component ───────────────────────────────────────────────────
class HexRadialMenuDialog extends React.PureComponent {

    constructor(props) {
        super(props);
        this.state = {
            classes: props.classes,
            open: props.open,
            items: props.items || DEFAULT_ITEMS,
            _hovered: -1,
            _selected: -1,
            _tab_value: 0,
            _phase: "menu", // "menu" | "view"
        };
        this._svgRef = null;
    };

    shouldComponentUpdate(nextProps, nextState, nextContext) {
        return false;
    }

    componentWillReceiveProps(nextProps, nextContext) {

        if(this.state.open !== nextProps.open) {
            this.setState({open: nextProps.open, items: nextProps.items || this.state.items}, () => {
                this.forceUpdate(() => {

                    if(!this.state.open) {
                        this.setState({_selected: -1, _hovered: -1, _phase: "menu", _tab_value: 0}, () => {
                            this.forceUpdate();
                        });
                    }
                });
            });
        }
    }

    // ── Hex SVG interaction ──
    _getSvgCoords = (e) => {
        const svg = this._svgRef;
        if (!svg) return null;
        const rect = svg.getBoundingClientRect();
        const sx = SVG_W / rect.width;
        const sy = SVG_H / rect.height;
        return {
            x: (e.clientX - rect.left) * sx,
            y: (e.clientY - rect.top) * sy
        };
    };

    _handleSvgMouseMove = (e) => {
        if (this.state._phase !== "menu") return;
        const c = this._getSvgCoords(e);
        if (!c) return;
        const sector = getSector(c.x, c.y, SVG_CX, SVG_CY);
        if (this.state._hovered !== sector) {
            this.setState({_hovered: sector});
        }
    };

    _handleSvgMouseLeave = () => {
        if (this.state._hovered !== -1) {
            this.setState({_hovered: -1});
        }
    };

    _handleSvgClick = (e) => {
        if (this.state._phase !== "menu") return;
        const c = this._getSvgCoords(e);
        if (!c) return;
        const sector = getSector(c.x, c.y, SVG_CX, SVG_CY);
        if (sector >= 0 && sector < this.state.items.length) {
            this.setState({_selected: sector, _phase: "view", _tab_value: 0, _hovered: -1}, () => {
                this.forceUpdate();
            });
        }
    };

    _handleBackToMenu = () => {
        this.setState({_phase: "menu", _selected: -1, _hovered: -1, _tab_value: 0}, () => {
            this.forceUpdate();
        });
    };

    // ── Tab handling (same as WitnessesDialog) ──
    _handleTabChange = (e, value) => {
        this.setState({_tab_value: value}, () => {
            this.swipeableViewScrollTop();
            this.forceUpdate();
        })
    }

    swipeableViewScrollTop = () => {

        let views = document.getElementsByClassName("react-swipeable-view-container"), i = 0;
        let view = views.item(0);
        if (view) {
            let child = view.children.item(0);
            if (child) {
                child.style.scrollBehavior = "smooth";
                child.scrollTop = 0;
            }
        }
    };

    _setSvgRef = (el) => {
        this._svgRef = el;
    };

    // ── Get views for selected item (same pattern as WitnessesDialog._get_views) ──
    _get_views = () => {
        const { classes, _selected, items } = this.state;
        if (_selected < 0 || _selected >= items.length) return [];

        const item = items[_selected];
        const views = item.views || [];

        if (views.length === 0) {
            return [
                <DialogContent scroll={"paper"} className={classes.dialogContent}>
                    <Typography component={"p"} variant={"body1"} style={{color: "#999"}}>{t("components.hex_radial_menu_dialog.no_content_provided")}</Typography>
                </DialogContent>
            ];
        }

        return views.map((v, i) => (
            <DialogContent key={i} scroll={"paper"} className={classes.dialogContent}>
                {v}
            </DialogContent>
        ));
    }

    render() {

        const {
            classes,
            open,
            items,
            _hovered,
            _selected,
            _phase,
            _tab_value,
        } = this.state;

        const isMenu = _phase === "menu";
        const isView = _phase === "view";
        const selectedItem = _selected >= 0 && _selected < items.length ? items[_selected] : null;
        const hasTabs = selectedItem && selectedItem.tabs && selectedItem.tabs.length > 1;

        return (
            <Dialog className={classes.dialog}
                    open={open}
                    maxWidth={"lg"}
                    fullWidth={true}
                    disablePortal={false}
                    onClose={this.props.onClose}
                    keepMounted={false}>
                {/* ── Header ── */}
                <DialogTitle style={{display: "flex", margin: "0px 0px 0px 0px", position: "relative"}}>
                    {isView && (
                        <IconButton className={classes.backButton} onClick={this._handleBackToMenu}>
                            <ArrowBackRounded/>
                        </IconButton>
                    )}
                    <Typography component={"h1"} variant={"h4"} style={{float: "left", width: "100%", margin: "0px"}}>
                        {isView && selectedItem ? selectedItem.label : "System"}
                    </Typography>
                    {isView && selectedItem && (
                        <Tooltip
                            arrow
                            interactive
                            title={
                                <div className={classes.tooltip}>{t("components.hex_radial_menu_dialog.system", {
                                        subtitle: selectedItem.subtitle,
                                        relation: selectedItem.relation
                                    })}</div>
                            }
                        >
                            <IconButton style={{color: "#888"}}><InfoIcon/></IconButton>
                        </Tooltip>
                    )}
                    <IconButton className={classes.closeButton} onClick={this.props.onClose} aria-label="close">
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                {/* ── View: relation badge + tabs + swipeable views ── */}
                {isView && selectedItem && (
                    <React.Fragment>
                        <div className={classes.relationBadge}>
                            {selectedItem.subtitle} · {selectedItem.relation}
                        </div>

                        {hasTabs && (
                            <Tabs
                                className={classes.cardTabs}
                                value={_tab_value}
                                variant="fullWidth"
                                indicatorColor="primary"
                                textColor="primary"
                                onChange={this._handleTabChange}
                                fullwidth={true}
                            >
                                {selectedItem.tabs.map((t, i) => (
                                    <Tab key={t} icon={typeof t === "string" ? t : t} />
                                ))}
                            </Tabs>
                        )}

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
                            disabled={!hasTabs}
                            key={"hex-swipeable-view"}
                        >
                            {this._get_views()}
                        </SwipeableViews>
                    </React.Fragment>
                )}
                {/* ── Menu: hex SVG ── */}
                {isMenu && (
                    <div className={classes.hexMenuContent}>
                        <svg
                            ref={this._setSvgRef}
                            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                            className={classes.hexSvg}
                            onMouseMove={this._handleSvgMouseMove}
                            onMouseLeave={this._handleSvgMouseLeave}
                            onClick={this._handleSvgClick}
                            style={{cursor: _hovered >= 0 ? "pointer" : "default"}}
                        >
                            <defs>
                                <filter id="hexShadow" x="-20%" y="-20%" width="140%" height="140%">
                                    <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="rgba(0,0,0,0.55)" floodOpacity="1"/>
                                </filter>
                                <filter id="hexShadowHov" x="-25%" y="-25%" width="150%" height="150%">
                                    <feDropShadow dx="0" dy="5" stdDeviation="8" floodColor="rgba(0,0,0,0.7)" floodOpacity="1"/>
                                    <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="rgba(255,255,255,0.03)" floodOpacity="1"/>
                                </filter>
                            </defs>

                            {POSITIONS.map((pos, i) => {
                                if (i >= items.length) return null;
                                const isHov = _hovered === i;
                                const item = items[i];
                                return (
                                    <g key={item.id || i} style={{
                                        animation: `hexSlideIn 420ms cubic-bezier(0.4,0,0.2,1) ${80 + i * 55}ms both`,
                                    }}>
                                        {/* Fill */}
                                        <path
                                            d={flatHexPath(pos.x, pos.y, HEX_R)}
                                            fill={isHov ? "#181818" : "#111111"}
                                            filter={isHov ? "url(#hexShadowHov)" : "url(#hexShadow)"}
                                            style={{transition: "fill 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"}}
                                        />
                                        {/* Border */}
                                        <path
                                            d={flatHexPath(pos.x, pos.y, HEX_R - 0.5)}
                                            fill="none"
                                            stroke={isHov ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.035)"}
                                            strokeWidth={isHov ? "1.2" : "0.8"}
                                            style={{transition: "stroke 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms, stroke-width 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"}}
                                        />
                                        {/* Subtitle */}
                                        <text x={pos.x} y={pos.y - 20} textAnchor="middle"
                                              fill={isHov ? "#a5a5a5" : "#666666"}
                                              fontSize="10" fontWeight="600" letterSpacing="1.8"
                                              style={{transition: "fill 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms", textTransform: "uppercase", pointerEvents: "none"}}
                                        >{item.subtitle}</text>
                                        {/* Icon */}
                                        <svg x={pos.x - 11} y={pos.y - 11} width="22" height="22" viewBox="0 0 24 24"
                                             fill="none" stroke={isHov ? "#d0d0d0" : "#808080"}
                                             strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
                                             style={{transition: "stroke 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms", pointerEvents: "none"}}
                                        >
                                            <path d={item.iconPath}/>
                                        </svg>
                                        {/* Label */}
                                        <text x={pos.x} y={pos.y + 26} textAnchor="middle"
                                              fill={isHov ? "#e0e0e0" : "#989898"}
                                              fontSize="12.5" fontWeight="700" letterSpacing="0.6"
                                              style={{transition: "fill 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms", textTransform: "uppercase", pointerEvents: "none"}}
                                        >{item.label}</text>
                                        {/* Relation */}
                                        <text x={pos.x} y={pos.y + 42} textAnchor="middle"
                                              fill={isHov ? "#808080" : "#444444"}
                                              fontSize="9.5" fontWeight="500" letterSpacing="1.2"
                                              style={{transition: "fill 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms", textTransform: "uppercase", pointerEvents: "none"}}
                                        >{item.relation}</text>
                                    </g>
                                );
                            })}
                        </svg>
                    </div>
                )}
            </Dialog>
        );
    }
}

export default withLanguage(withStyles(styles)(HexRadialMenuDialog));