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
import { withPrices } from "../hooks/usePrices";
import {
    voteSign, votePercentBp, formatPxs,
    rsharesToPxs, estimateVoteRshares,
    getRewardSnapshot, getRewardSnapshotSync,
    getVoterAccount, getVoterAccountSync,
} from "../utils/voteValue";
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
    // What the vote is worth: PXS from its rshares through the reward fund,
    // then the user's display currency. Greyscale like the rest of the UI —
    // an estimate (vote still waiting for the chain) is dimmer and prefixed ≈.
    voteValue: {
        color: '#fff',
        fontFamily: '"Geist Mono", monospace',
        fontVariantNumeric: 'tabular-nums',
    },
    voteValueFiat: {
        color: '#9a9a9a',
        fontFamily: '"Geist Mono", monospace',
        fontVariantNumeric: 'tabular-nums',
    },
    voteValueEstimate: {
        color: '#bdbdbd',
    },
    // Per-tab total, right-aligned above the list.
    tabTotal: {
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'baseline',
        gap: 8,
        padding: '0px 16px 4px 16px',
        color: '#9a9a9a',
        fontFamily: '"Geist Mono", monospace',
        fontVariantNumeric: 'tabular-nums',
        fontSize: 12,
        lineHeight: '16px',
        minHeight: 20,
        '& b': {
            color: '#fff',
            fontWeight: 500,
        },
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
            // Reward-fund snapshot (recent_claims / reward_balance / feed) that
            // turns each vote's rshares into PXS — see utils/voteValue.
            _snapshot: getRewardSnapshotSync(props.api),
            // Accounts of voters whose vote is still optimistic (rshares '0'
            // placeholder): their value is ESTIMATED from vesting + mana.
            _voter_accounts: {},
        };
    };

    componentWillMount() {

    }

    componentDidMount(){
        this._fetchVoterProfiles(this.state.votes);
        this._loadPricing(this.state.votes);
    }

    componentWillReceiveProps(nextProps, nextContext) {

        if(this.state.open !== nextProps.open || this.state.positive !== nextProps.positive || this.state.votes !== nextProps.votes) {
            const merged = { ...(nextProps.voterProfiles || {}), ...this.state._voter_profiles };
            this.setState({locales: nextProps.locales, open: nextProps.open, positive: nextProps.positive, votes: nextProps.votes || [], _voter_profiles: merged}, () => {
                this._fetchVoterProfiles(nextProps.votes || []);
                this._loadPricing(nextProps.votes || []);
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

    // ── Vote pricing ──────────────────────────────────────────────────
    // Fund snapshot (60 s RAM cache in utils/voteValue) + the accounts of any
    // voters whose rows are still optimistic placeholders. Both are cheap,
    // deduped and only fetched while the dialog is open.
    _loadPricing = (votes) => {
        const api = this.props.api;
        if (!api || !this.state.open) return;
        getRewardSnapshot(api)
            .then((snap) => { if (snap && snap !== this.state._snapshot) this.setState({ _snapshot: snap }); })
            .catch(() => {});
        const pending = (Array.isArray(votes) ? votes : []).filter(v => v && v._optimistic && v.voter);
        for (const v of pending) {
            if (this.state._voter_accounts[v.voter]) continue;
            getVoterAccount(api, v.voter)
                .then((acc) => {
                    if (!acc) return;
                    this.setState((st) => ({ _voter_accounts: { ...st._voter_accounts, [v.voter]: acc } }));
                })
                .catch(() => {});
        }
    }

    /**
     * What one vote is worth right now, in PXS — the HIVE estimate_upvote
     * recipe: rshares / recent_claims × reward_balance, priced in PXS through
     * the median feed. Chain rows use their rshares; an optimistic placeholder
     * is estimated from the voter's vesting shares and current mana.
     * Returns { pxs, estimate, ready }.
     */
    _voteValue = (vote) => {
        const snap = this.state._snapshot;
        if (!vote || !snap || !snap.ok) return { pxs: 0, estimate: !!(vote && vote._optimistic), ready: false };
        if (vote._optimistic) {
            const acc = this.state._voter_accounts[vote.voter] || getVoterAccountSync(this.props.api, vote.voter);
            if (!acc) return { pxs: 0, estimate: true, ready: false };
            return { pxs: rsharesToPxs(estimateVoteRshares(acc, vote.weight, snap), snap), estimate: true, ready: true };
        }
        return { pxs: rsharesToPxs(vote.rshares, snap), estimate: false, ready: true };
    }

    _fiatOf = (pxs) => {
        const prices = this.props.prices || {};
        const pxsUsd = Number(prices.pxsUsdPrice) || 0;
        const rate = Number(prices.fiatRate) || 1;
        return { amount: pxs * pxsUsd * rate, currency: prices.currency || 'USD' };
    }

    // Votes ranked by what they are worth; a voter's still-pending vote sits on
    // top so the user finds the vote they just cast at a glance.
    _rank = (list) => list.map((v) => ({ v, val: this._voteValue(v) }))
        .sort((a, b) => {
            if (!!a.v._optimistic !== !!b.v._optimistic) return a.v._optimistic ? -1 : 1;
            return Math.abs(b.val.pxs) - Math.abs(a.val.pxs);
        });

    _renderValue = (val, classes) => {
        if (!val.ready) {
            return <span className={classes.voteValue + ' ' + classes.voteValueEstimate}>{val.estimate ? '≈ …' : '…'}</span>;
        }
        const fiat = this._fiatOf(Math.abs(val.pxs));
        return (
            <span>
                <span className={classes.voteValue + (val.estimate ? ' ' + classes.voteValueEstimate : '')}>
                    {val.estimate ? '≈ ' : ''}{formatPxs(Math.abs(val.pxs))} PXS
                </span>
                <span className={classes.voteValueFiat}>{' · '}{fiat.amount.toFixed(2)} {fiat.currency}</span>
            </span>
        );
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

    _votesRenderer = (ranked) => ({index, isScrolling, key, style}) => {

        const locales = this.state.locales;
        const classes = this.state.classes;
        const voterProfiles = this.state._voter_profiles;
        const entry = ranked[index];
        if (!entry) return null;
        const vote = entry.v;
        const voter = vote.voter || '';
        const profileImage = voterProfiles[voter] || '';
        // Percent only when the row actually knows it (|weight| ≤ 10 000);
        // bridge rows omit it and condenser rows may carry a curation weight.
        const percentBp = votePercentBp(vote);
        const weightPercent = percentBp != null ? Math.abs(percentBp) / 100 : null;
        const voteTime = vote.time ? new Date(vote.time) : null;
        return (
            <ListItem classes={{ root: classes.listItem }} key={voter} style={Object.assign({height: 64}, style)} component={"div"}>
                <ListItemAvatar className={classes.listItemAvatar}>
                    <Avatar onClick={() => {this._open_author(voter);}} src={profileImage} style={{borderRadius: "14px", cursor: "pointer"}} className={"pixelated"}></Avatar>
                </ListItemAvatar>
                <ListItemText id={`@${voter}`} primary={<span className={classes.listItemTitle} onClick={() => {this._open_author(voter);}}>{`@${voter}`}</span>} secondary={
                    <span className={classes.listItemSubTitle}>
                        {this._renderValue(entry.val, classes)}
                        {weightPercent != null && (
                            <span>
                                <span> • </span>
                                <span style={{color: "#ccc"}}>{`${weightPercent.toFixed(0)}%`}</span>
                            </span>
                        )}
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

        // Direction from rshares first (weight isn't reliably the percent);
        // zeroed rows — what hivemind keeps after an unvote — are not votes.
        const upvotes = this._rank((votes || []).filter(v => v && voteSign(v) > 0));
        const downvotes = this._rank((votes || []).filter(v => v && voteSign(v) < 0));

        return [
            <DialogContent scroll={"paper"} className={classes.dialogContent}>
                {this._renderTotal(upvotes, classes)}
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
                {this._renderTotal(downvotes, classes)}
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

    // Sum of what the listed votes are worth (PXS + display currency). "≈"
    // while any row is still an estimate or the fund snapshot hasn't landed.
    _renderTotal = (ranked, classes) => {
        if (!ranked.length) return <div className={classes.tabTotal} />;
        let pxs = 0, approx = false;
        for (const e of ranked) {
            if (!e.val.ready || e.val.estimate) approx = true;
            pxs += Math.abs(e.val.pxs);
        }
        const fiat = this._fiatOf(pxs);
        return (
            <div className={classes.tabTotal}>
                <span>Σ {ranked.length}</span>
                <b>{approx ? '≈ ' : ''}{formatPxs(pxs)} PXS</b>
                <span>{fiat.amount.toFixed(2)} {fiat.currency}</span>
            </div>
        );
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

export default withLanguage(withStyles(styles)(withPrices(VotingListModal)));