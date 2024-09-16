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
import ListItemText from '@material-ui/core/ListItemText';
import ListItemAvatar from '@material-ui/core/ListItemAvatar';
import Avatar from '@material-ui/core/Avatar';
import Tooltip from "@material-ui/core/Tooltip";
import VirtualizedList from "@pixagram/virtualized/dist/es/List";
import AutoSizer from "@pixagram/virtualized/dist/es/AutoSizer";
import {HISTORY} from "../utils/constants";
import timeAgo from "../utils/TimeAgo";
import Tab from "@material-ui/core/Tab";
import Tabs from "@material-ui/core/Tabs";
import SwipeableViews from "react-swipeable-views";

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
        margin: "16px 16px 0px 16px",
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
        margin: "8px 0px 8px 0px"
    },
    link: {
        cursor: "pointer",
        textDecoration: "underline"
    },
    boxContainer: {
        display: "flex",
        flexWrap: "wrap"
    },
    listItemTitle: {
        fontWeight: 'bold',
        fontFamily: '"Industry Book", "Normative Pro"',
        color: '#fff',
        cursor: 'pointer',
    },
    listItemSubTitle: {
        display: 'inline-block',
        textOverflow: 'ellipsis',
        overflow: 'hidden',
        whiteSpace: 'nowrap'
    },
    listItemAvatar: {
        cursor: 'pointer',
        borderRadius: '14px',
        width: 48,
        height: 48,
        '& .MuiCardHeader-avatar': { marginRight: '8px' },
    },
    action: {
        display: "inline-flex",
        justifyContent: "right",
        right: "0px !important",
        left: "auto !important",
        width: "64px !important",
        paddingRight: 16,
        transform: "translateY(0px)",
        "& .MuiIconButton-edgeEnd": {
            marginRight: "0px !important"
        }
    },
    listItem: {
        "&.MuiListItem-root": {
            borderRadius: "16px",
            backgroundColor: "#ffffff00",
            transition: "background-color 225ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        },
        "&.MuiListItem-root:hover": {
            borderRadius: "16px",
            backgroundColor: "#ffffff14",
            transition: "background-color 225ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",

        },
    },
    badgeItem: {
        "& .MuiBadge-anchorOriginTopRightCircular": {
            top: "0%",
            right: "0%",
            backgroundColor: "#212121ff"
        }
    }
});

class VotingListModal extends React.PureComponent {

    constructor(props) {
        super(props);
        this.state = {
            classes: props.classes,
            open: props.open || false,
            positive: props.positive != null ? props.positive : true,
            locales: props.locales,
            votes: props.votes || [],
            _voter_profiles: props.voterProfiles || {}, // pre-fetched from Profile.js
            _history: HISTORY,
        };
    };

    componentWillMount() {

    }

    componentDidMount(){
        this._fetchVoterProfiles(this.state.votes);
    }

    componentWillReceiveProps(nextProps, nextContext) {

        if(this.state.open !== nextProps.open || this.state.positive !== nextProps.positive || this.state.votes !== nextProps.votes) {
            const merged = { ...(nextProps.voterProfiles || {}), ...this.state._voter_profiles };
            this.setState({locales: nextProps.locales, open: nextProps.open, positive: nextProps.positive, votes: nextProps.votes || [], _voter_profiles: merged}, () => {
                this._fetchVoterProfiles(nextProps.votes || []);
                this.forceUpdate();
            });
        }
    }

    _fetchVoterProfiles = (votes) => {
        const api = this.props.api;
        if (!api || !Array.isArray(votes) || votes.length === 0) return;

        const voterNames = votes.map(v => v.voter).filter(Boolean);
        if (voterNames.length === 0) return;

        // Only fetch names we don't already have
        const missing = voterNames.filter(name => !this.state._voter_profiles[name]);
        if (missing.length === 0) return;

        api.accounts.getAccounts(missing).then((accounts) => {
            if (!Array.isArray(accounts)) return;
            const profiles = { ...this.state._voter_profiles };
            accounts.forEach((acc) => {
                if (!acc) return;
                const name = acc.name || acc._entity_id;
                const image = (acc._profile && acc._profile.profile_image) || '';
                if (name) profiles[name] = image;
            });
            this.setState({ _voter_profiles: profiles }, () => this.forceUpdate());
        }).catch((e) => {
            console.warn('[VotingListModal] Failed to fetch voter profiles:', e.message);
        });
    }

    _open_author = (username) => {
        this.state._history.push("/@"+username);
    }

    swipeableViewScrollTop = () => {

        let views = document.getElementsByClassName("react-swipeable-view-container"), i = 0;
        let view = views.item(0);
        let child = view.children.item(0);
        child.style.scrollBehavior = "smooth";
        child.scrollTop = 0;
    };

    _votesRenderer = (votes) => ({index, isScrolling, key, style}) => {

        const locales = this.state.locales;
        const classes = this.state.classes;
        const voterProfiles = this.state._voter_profiles;
        const vote = votes[index];
        if (!vote) return null;
        const voter = vote.voter || '';
        const profileImage = voterProfiles[voter] || '';
        const weightPercent = Math.abs(vote.weight || 0) / 100;
        const voteTime = vote.time ? new Date(vote.time) : null;
        return (
            <ListItem classes={{ root: classes.listItem }} key={voter} style={Object.assign({height: 64}, style)} component={"div"}>
                <ListItemAvatar className={classes.listItemAvatar}>
                    <Avatar onClick={() => {this._open_author(voter);}} src={profileImage} style={{borderRadius: "14px", cursor: "pointer"}} className={"pixelated"}></Avatar>
                </ListItemAvatar>
                <ListItemText id={`@${voter}`} primary={<span className={classes.listItemTitle} onClick={() => {this._open_author(voter);}}>{`@${voter}`}</span>} secondary={
                    <span className={classes.listItemSubTitle}>
                        <span style={{color: "#ccc"}}>{weightPercent > 0 ? `${weightPercent.toFixed(0)}%` : '100%'}</span>
                        {voteTime && !isNaN(voteTime.getTime()) && (
                            <span>
                                <span> • </span>
                                <Tooltip arrow title={ voteTime.toLocaleDateString(locales, {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: 'numeric'
                                })}>
                                    <span style={{color: "#fff"}}>{timeAgo.format(voteTime.getTime())}</span>
                                </Tooltip>
                            </span>
                        )}
                    </span>}
                />
            </ListItem>
        );
    }

    _get_views = () => {

        const {
            classes,
            votes,
        } = this.state;

        const upvotes = (votes || []).filter(v => v && (v.weight >= 0));
        const downvotes = (votes || []).filter(v => v && (v.weight < 0));

        return [
            <DialogContent scroll={"paper"} className={classes.dialogContent}>
                <AutoSizer disableHeight>
                    {({width}) => (
                        <List component="div" className={classes.list}>
                            <VirtualizedList
                                noRowsRenderer={() => {
                                    return <ListItem component="div"><ListItemText secondary={t("components.voting_list_modal.no_upvotes_yet")}/></ListItem>;
                                }}
                                scrollToIndex={() => {}}
                                height={480}
                                overscanRowCount={1}
                                rowCount={upvotes.length}
                                rowHeight={64}
                                rowRenderer={this._votesRenderer(upvotes)}
                                width={width}
                            />
                        </List>
                    )}
                </AutoSizer>
            </DialogContent>,
            <DialogContent scroll={"paper"} className={classes.dialogContent}>
                <AutoSizer disableHeight>
                    {({width}) => (
                        <List component="div" className={classes.list}>
                            <VirtualizedList
                                noRowsRenderer={() => {
                                    return <ListItem component="div"><ListItemText secondary={t("components.voting_list_modal.no_downvotes_yet")}/></ListItem>;
                                }}
                                scrollToIndex={() => {}}
                                height={480}
                                overscanRowCount={1}
                                rowCount={downvotes.length}
                                rowHeight={64}
                                rowRenderer={this._votesRenderer(downvotes)}
                                width={width}
                            />
                        </List>
                    )}
                </AutoSizer>
            </DialogContent>
        ];
    }

    _handleTabChange = (e, value) => {
        const isPositive = value === 0;
        this.setState({positive: isPositive}, () => {
            this.swipeableViewScrollTop();
            this.forceUpdate();
        });
    }

    render() {

        const {
            classes,
            open,
            positive,
            votes,
        } = this.state;

        return (
            <Dialog className={classes.dialog}
                    open={open}
                    fullWidth={true}
                    disablePortal={false}
                    onClose={this.props.onClose}
                    keepMounted={false}>
                <Tabs
                    className={classes.cardTabs}
                    value={positive ? 0: 1}
                    variant="fullWidth"
                    indicatorColor="primary"
                    textColor="primary"
                    onChange={this._handleTabChange}
                    fullwidth={true}
                >
                    <Tab icon={"UpVotes"} />
                    <Tab icon={"DownVotes"} />
                </Tabs>
                <SwipeableViews
                    ignoreNativeScroll={true}
                    containerStyle={{height: "100%"}}
                    animateHeight={false}
                    animateTransitions={true}
                    disableLazyLoading={true}
                    resistance={true}
                    springConfig={{tension: 450, friction: 60, duration: '120ms', easeFunction: 'cubic-bezier(0.280, 0.840, 0.420, 1)', delay: '5ms'}}
                    index={positive ? 0: 1}
                    onChangeIndex={(v) => this._handleTabChange({}, v)}
                    disabled={false}
                    key={"swipe-able-view-votes"}
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

export default withLanguage(withStyles(styles)(VotingListModal));