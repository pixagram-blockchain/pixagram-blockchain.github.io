import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Button from "@material-ui/core/Button";
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemAvatar from '@material-ui/core/ListItemAvatar';
import Avatar from '@material-ui/core/Avatar';
import VirtualizedList from "@pixagram/virtualized/dist/es/List";
import AutoSizer from "@pixagram/virtualized/dist/es/AutoSizer";
import { HISTORY } from "../utils/constants";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import Checkbox from "@material-ui/core/Checkbox";
import CircularProgress from "@material-ui/core/CircularProgress";
import Tab from "@material-ui/core/Tab";
import Tabs from "@material-ui/core/Tabs";
import SwipeableViews from "react-swipeable-views";
import * as actions from "../actions/utils";
import { PagedLoader } from "../utils/api/paged-list";
import { getProfiles } from "../utils/api/account-cache";

import { t } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";
// ── FollowListModal (progressive) ──────────────────────────────────────
// What changed vs. the previous version:
//
//   1. PROGRESSIVE LOADING — the old code awaited _fetchAllFollowers +
//      _fetchAllFollowing (up to 10 serial pages EACH), then the
//      logged-in user's full following list, then one bulk avatar
//      hydration, before rendering anything. Both tabs now render
//      after their FIRST page and stream the rest via PagedLoader,
//      with tab labels counting up live ("240+ Followers" while
//      streaming, "412 Followers" once settled).
//
//   2. SHARED AVATAR HYDRATION — per-page, through account-cache's
//      getProfiles(): batched, deduped app-wide, non-blocking. A user
//      appearing in both tabs (or already cached by MembersListDialog
//      / VotingListModal) costs zero extra network.
//
//   3. onCountsUpdated CONTRACT PRESERVED — still called exactly once
//      per open, with final (followers, following) counts, after both
//      target lists settle.
//
//   4. LIFECYCLE CLEANUP — `open` read from props (no state mirror),
//      componentWillReceiveProps removed (componentDidUpdate handles
//      open/account changes), forceUpdate removed from tab switching,
//      and a generation counter + loader.cancel() guards every async
//      write against a closed or re-targeted dialog.
//
// Public props are unchanged:
//   { open, onClose, api, account, isFollowing, onCountsUpdated }.
// ───────────────────────────────────────────────────────────────────────

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
    dialogContent: {
        margin: "8px 0px 8px 0px"
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
    loadingContainer: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: 480
    },
});

class FollowListModal extends React.PureComponent {

    constructor(props) {
        super(props);
        this.state = {
            _tab: props.isFollowing ? 1 : 0,
            _followers: [],
            _following: [],
            _followersFirst: false,   // first page landed
            _followingFirst: false,
            _followersDone: false,    // all pages landed (or capped)
            _followingDone: false,
            _followingSet: new Set(), // logged-in user's follows
            _loggedInUser: null,
        };

        // Async-staleness guard: bumped on every (re)start and cancel.
        this._gen = 0;
        this._loaders = [];
        this._countsReported = false;
    }

    // ── Lifecycle ─────────────────────────────────────────────────────

    componentDidMount() {
        if (this.props.open) this._startLoaders();
    }

    componentDidUpdate(prevProps) {
        const opened = this.props.open && !prevProps.open;
        const accountChanged = this.props.open &&
            (prevProps.account && prevProps.account.name) !==
            (this.props.account && this.props.account.name);

        if (opened || accountChanged) {
            this._startLoaders();
        } else if (!this.props.open && prevProps.open) {
            this._cancelLoaders();
        }
    }

    componentWillUnmount() {
        this._cancelLoaders();
    }

    _cancelLoaders = () => {
        this._gen++;
        for (const l of this._loaders) l.cancel();
        this._loaders = [];
    };

    // ── Data loading ──────────────────────────────────────────────────

    _startLoaders = async () => {
        const api = this.props.api;
        const account = this.props.account;
        if (!api || !api.follow || !account || !account.name) return;

        this._cancelLoaders();
        const gen = this._gen;
        const username = account.name;
        this._countsReported = false;

        this.setState({
            _tab: this.props.isFollowing ? 1 : 0,
            _followers: [],
            _following: [],
            _followersFirst: false,
            _followingFirst: false,
            _followersDone: false,
            _followingDone: false,
            _followingSet: new Set(),
        });

        // Resolve the session user (drives the follow checkboxes) without
        // blocking either list.
        let loggedInUser = this.state._loggedInUser;
        if (!loggedInUser && api.sessionManager) {
            try { loggedInUser = await api.sessionManager.getActiveAccount(); } catch (e) {}
            if (gen !== this._gen) return;
            if (loggedInUser) this.setState({ _loggedInUser: loggedInUser });
        }

        // ── Target's followers + following: progressive, in parallel ──
        this._spawnUserListLoader({
            gen,
            fetchPage: (cursor, limit) =>
                api.follow.getFollowers(username, cursor || '', 'blog', limit),
            itemKey: (f) => f && f.follower,
            pickName: (f) => f.follower,
            listKey: "_followers",
            firstKey: "_followersFirst",
            doneKey: "_followersDone",
        });

        this._spawnUserListLoader({
            gen,
            fetchPage: (cursor, limit) =>
                api.follow.getFollowing(username, cursor || '', 'blog', limit),
            itemKey: (f) => f && f.following,
            pickName: (f) => f.following,
            listKey: "_following",
            firstKey: "_followingFirst",
            doneKey: "_followingDone",
        });

        // ── Logged-in user's following set: background, non-blocking ──
        if (loggedInUser && loggedInUser !== "") {
            const set = new Set();
            const loader = new PagedLoader({
                limit: 100,
                maxItems: 1000,
                itemKey: (f) => f && f.following,
                fetchPage: (cursor, limit) =>
                    api.follow.getFollowing(loggedInUser, cursor || '', 'blog', limit),
                onPage: (_all, { fresh }) => {
                    if (gen !== this._gen) return;
                    for (const f of fresh) set.add(f.following);
                    this.setState({ _followingSet: new Set(set) });
                },
                onError: () => {},
            });
            this._loaders.push(loader);
            loader.start();
        }
    };

    /**
     * Spawn one progressive list loader (followers OR following of the
     * viewed account). Each page maps raw follow records to the row
     * shape, renders immediately, and kicks a non-blocking avatar
     * hydration for just that page's names.
     */
    _spawnUserListLoader = ({ gen, fetchPage, itemKey, pickName, listKey, firstKey, doneKey }) => {
        const mapped = [];
        const loader = new PagedLoader({
            limit: 100,
            maxItems: 1000, // same ceiling as the old loops
            itemKey,
            fetchPage,
            onPage: (_all, { fresh, done }) => {
                if (gen !== this._gen) return;
                for (const f of fresh) {
                    const name = pickName(f);
                    mapped.push({ username: name, name, image: '', reputation: 0 });
                }
                this.setState({
                    [listKey]: mapped.slice(),
                    [firstKey]: true,
                    [doneKey]: done,
                }, this._maybeReportCounts);
                this._hydrateAvatars(gen, mapped, listKey, fresh.map(pickName));
            },
            onError: (e) => {
                if (gen !== this._gen) return;
                console.warn('[FollowListModal] page error:', e && e.message);
                // Keep whatever streamed in; settle this list.
                this.setState({ [firstKey]: true, [doneKey]: true }, this._maybeReportCounts);
            },
            onDone: () => {
                if (gen === this._gen) {
                    this.setState({ [doneKey]: true }, this._maybeReportCounts);
                }
            },
        });
        this._loaders.push(loader);
        loader.start();
    };

    /**
     * Per-page avatar hydration through the shared account-cache:
     * batched and deduped app-wide. Patches only rows still missing an
     * image, with fresh object identities for correct re-rendering.
     */
    _hydrateAvatars = (gen, mapped, listKey, names) => {
        const api = this.props.api;
        if (!api || !names || names.length === 0) return;

        getProfiles(api, names)
            .then((profiles) => {
                if (gen !== this._gen) return;
                let changed = false;
                for (let i = 0; i < mapped.length; i++) {
                    const u = mapped[i];
                    if (u.image) continue;
                    const p = profiles.get(String(u.username).toLowerCase());
                    if (p && p.image) {
                        mapped[i] = { ...u, image: p.image };
                        changed = true;
                    }
                }
                if (changed && gen === this._gen) {
                    this.setState({ [listKey]: mapped.slice() });
                }
            })
            .catch((e) => {
                console.warn('[FollowListModal] hydrate error:', e && e.message);
            });
    };

    /** Preserve the old contract: report final counts exactly once. */
    _maybeReportCounts = () => {
        if (this._countsReported) return;
        const { _followersDone, _followingDone, _followers, _following } = this.state;
        if (_followersDone && _followingDone &&
            typeof this.props.onCountsUpdated === 'function') {
            this._countsReported = true;
            this.props.onCountsUpdated(_followers.length, _following.length);
        }
    };

    // ── Actions ───────────────────────────────────────────────────────

    _open_author = (username) => {
        this.props.onClose();
        HISTORY.push("/@" + username);
    };

    _toggleFollow = async (username) => {
        const api = this.props.api;
        const { _loggedInUser, _followingSet } = this.state;
        if (!api || !api.broadcast || !_loggedInUser) {
            actions.trigger_snackbar(t("words.please_log_in_to_follow_users"));
            return;
        }
        const isCurrentlyFollowing = _followingSet.has(username);
        try {
            if (isCurrentlyFollowing) {
                await api.broadcast.unfollow(_loggedInUser, username);
                _followingSet.delete(username);
            } else {
                await api.broadcast.follow(_loggedInUser, username);
                _followingSet.add(username);
            }
            this.setState({ _followingSet: new Set(_followingSet) });
        } catch (e) {
            console.error('[FollowListModal] toggle follow error:', e);
            actions.trigger_snackbar(e.message || "Failed to update follow status");
        }
    };

    swipeableViewScrollTop = () => {
        let views = document.getElementsByClassName("react-swipeable-view-container");
        if (views.length > 0) {
            let view = views.item(0);
            if (view && view.children.item(0)) {
                let child = view.children.item(0);
                child.style.scrollBehavior = "smooth";
                child.scrollTop = 0;
            }
        }
    };

    // ── Row renderer (factory bound to the rendered list) ─────────────

    _userRenderer = (users) => ({ index, key, style }) => {
        const { classes } = this.props;
        const { _followingSet, _loggedInUser } = this.state;
        const user = users[index];
        if (!user) return null;
        const username = user.username || user.name;
        const image = user.image || '';
        const isFollowing = _followingSet.has(username);
        const isOwnAccount = _loggedInUser && _loggedInUser.toLowerCase() === username.toLowerCase();

        return (
            <ListItem classes={{ root: classes.listItem }} ContainerComponent={"div"} key={key} style={Object.assign({ height: 64 }, style)} component={"div"}>
                <ListItemAvatar>
                    <Avatar onClick={() => this._open_author(username)} src={image} style={{ borderRadius: "14px", cursor: "pointer" }} className={"pixelated"} />
                </ListItemAvatar>
                <ListItemText
                    id={`@${username}`}
                    primary={<span className={classes.listItemTitle} onClick={() => this._open_author(username)}>{`@${username}`}</span>}
                />
                {_loggedInUser && !isOwnAccount && (
                    <ListItemSecondaryAction className={classes.action} style={style}>
                        <Checkbox
                            size="medium"
                            color="primary"
                            checked={isFollowing}
                            onChange={() => this._toggleFollow(username)}
                            edge="end"
                            inputProps={{ 'aria-labelledby': `@${username}` }}
                        />
                    </ListItemSecondaryAction>
                )}
            </ListItem>
        );
    };

    _handleTabChange = (e, value) => {
        this.setState({ _tab: value }, this.swipeableViewScrollTop);
    };

    _get_views = () => {
        const { classes } = this.props;
        const { _followers, _following, _followersFirst, _followingFirst } = this.state;

        const renderList = (users, firstPageLanded, emptyText) => (
            <DialogContent scroll={"paper"} className={classes.dialogContent}>
                {!firstPageLanded ? (
                    <div className={classes.loadingContainer}><CircularProgress color={"secondary"} /></div>
                ) : (
                    <AutoSizer disableHeight>
                        {({ width }) => (
                            <List component="div">
                                <VirtualizedList
                                    noRowsRenderer={() => {
                                        return <ListItem component="div"><ListItemText secondary={emptyText} /></ListItem>;
                                    }}
                                    scrollToIndex={() => {}}
                                    height={480}
                                    overscanRowCount={5}
                                    rowCount={users.length}
                                    rowHeight={64}
                                    rowRenderer={this._userRenderer(users)}
                                    width={width}
                                />
                            </List>
                        )}
                    </AutoSizer>
                )}
            </DialogContent>
        );

        return [
            renderList(_followers, _followersFirst, "No followers yet"),
            renderList(_following, _followingFirst, "Not following anyone yet"),
        ];
    };

    render() {
        const { classes, open } = this.props;
        const {
            _tab, _followers, _following,
            _followersDone, _followingDone,
        } = this.state;

        return (
            <Dialog className={classes.dialog}
                    open={!!open}
                    fullWidth={true}
                    disablePortal={false}
                    onClose={this.props.onClose}
                    keepMounted={false}>
                <Tabs
                    className={classes.cardTabs}
                    value={_tab}
                    variant="fullWidth"
                    indicatorColor="primary"
                    textColor="primary"
                    onChange={this._handleTabChange}
                    fullwidth={true}
                >
                    <Tab label={`${_followers.length}${_followersDone ? "" : "+"} Followers`} />
                    <Tab label={`${_following.length}${_followingDone ? "" : "+"} Following`} />
                </Tabs>
                <SwipeableViews
                    ignoreNativeScroll={true}
                    containerStyle={{ height: "100%" }}
                    animateHeight={false}
                    animateTransitions={true}
                    disableLazyLoading={true}
                    resistance={true}
                    springConfig={{ tension: 450, friction: 60, duration: '120ms', easeFunction: 'cubic-bezier(0.280, 0.840, 0.420, 1)', delay: '5ms' }}
                    index={_tab}
                    onChangeIndex={(v) => this._handleTabChange({}, v)}
                    disabled={false}
                    key={"swipe-able-view-follows"}
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

export default withLanguage(withStyles(styles)(FollowListModal));