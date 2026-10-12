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
import { useScrollParentWindowing, useEndReached } from "../hooks/useScrollParentWindowing";

import { t } from "../utils/text";
import { FollowHistory } from "./AccountCharts";
import { tr, CollapseSection } from "./GDTowerKit";

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
//   5. ONE SCROLLBAR + LOAD ON SCROLL — the fixed 480px react-virtualized
//      box (its own boxed scrollbar) is gone. Rows window against the
//      dialog's scroll area exactly like WalletHistory, and each list
//      fetches its next page only when the user scrolls within ~20 rows
//      of the end (PagedLoader.loadMore: one request in flight at most,
//      explicit loading / hasMore / ended state, nothing after the end).
//      Tab labels show the chain's follow counts (get_follow_count) right
//      away instead of counting up with the pages.
//
// Public props are unchanged:
//   { open, onClose, api, account, isFollowing, onCountsUpdated }.
// ───────────────────────────────────────────────────────────────────────

const styles = theme => ({
    dialog: {
        // A definite paper height gives the swipeable slides a bounded
        // height, so the slide is the dialog's single scroll area.
        "& .MuiDialog-paperScrollPaper": {
            height: "calc(100% - 64px)",
            maxHeight: 760,
            [theme.breakpoints.down("sm")]: {
                height: "100%",
                maxHeight: "100%"
            },
        },
    },
    swipeRoot: {
        position: "relative",
        flex: "1 1 auto",
        minHeight: 0,
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
        margin: "8px 0px 8px 0px",
        // The slide around it scrolls; never let this become a second scroller.
        overflowY: "visible",
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
    moreRow: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: 64,
    },
});

const ROW_H = 64;
const ACTION_STYLE = { top: 0, height: ROW_H };
// Each slide is the dialog's scroll area (one scrollbar, like the wallet).
const SLIDE_STYLE = { height: "100%", overflowY: "auto", overflowX: "hidden" };

/**
 * Windowed rows against the dialog's own scrollbar (same technique as
 * WalletHistory), plus the load-more trigger and its footer:
 * spinner while a page is in flight, nothing once the list has ended.
 */
function WindowedUserList({ users, renderRow, hasMore, loading, onLoadMore, emptyText, classes }) {
    const { listRef, start, end } = useScrollParentWindowing(users.length, ROW_H);
    useEndReached({
        end,
        count: users.length,
        enabled: hasMore && !loading,
        onEndReached: onLoadMore,
    });

    const slice = users.slice(start, end);
    return (
        <div ref={listRef}>
            {users.length === 0 && !hasMore ? (
                <ListItem component="div"><ListItemText secondary={emptyText} /></ListItem>
            ) : (
                <List component="div" disablePadding>
                    <div style={{ height: start * ROW_H }} />
                    {slice.map((u) => (u ? renderRow(u) : null))}
                    <div style={{ height: Math.max(0, (users.length - end) * ROW_H) }} />
                </List>
            )}
            {hasMore && loading ? (
                <div className={classes.moreRow}><CircularProgress size={24} color={"secondary"} /></div>
            ) : null}
        </div>
    );
}

class FollowListModal extends React.PureComponent {

    constructor(props) {
        super(props);
        this.state = {
            _tab: props.isFollowing ? 1 : 0,
            _followers: [],
            _following: [],
            _followersFirst: false,   // first page landed
            _followingFirst: false,
            _followersDone: false,    // list ended (or capped / errored)
            _followingDone: false,
            _followersLoading: false, // a page request is in flight
            _followingLoading: false,
            _followerCount: null,     // chain totals (get_follow_count)
            _followingCount: null,
            _followingSet: new Set(), // logged-in user's follows
            _loggedInUser: null,
            _chartSummary: { followers: "", following: "" }, // shown in the chart sections' headers
        };

        // Async-staleness guard: bumped on every (re)start and cancel.
        this._gen = 0;
        this._loaders = [];
        this._listLoaders = {};   // listKey → on-demand PagedLoader
        this._countsReported = false;
        this._swipeRoot = null;
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
        this._listLoaders = {};
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
            _followersLoading: false,
            _followingLoading: false,
            _followerCount: null,
            _followingCount: null,
            _followingSet: new Set(),
            _chartSummary: { followers: "", following: "" },
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

        // ── Chain totals for the tab labels + onCountsUpdated ──
        // The lists now load on scroll, so their lengths are no longer the
        // totals. getFollowCount swallows errors and returns zeros, so a
        // 0/0 answer is ignored here; the both-lists-ended path covers it.
        if (typeof api.follow.getFollowCount === "function") {
            api.follow.getFollowCount(username).then((c) => {
                if (gen !== this._gen || !c) return;
                const fc = Number(c.follower_count) || 0;
                const gc = Number(c.following_count) || 0;
                if (fc + gc === 0) return;
                this.setState({ _followerCount: fc, _followingCount: gc }, this._maybeReportCounts);
            }).catch(() => {});
        }

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
            // No 1000 ceiling any more: pages are fetched only as the user
            // scrolls. maxPages (200) remains the backstop.
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
        this._listLoaders[listKey] = loader;
        this._loadMore(listKey); // first page; the rest come on scroll
    };

    /**
     * Fetch the next page of one list. Guarded three ways: nothing after
     * the end (hasMore), one request at a time (loading), and nothing from
     * a closed or re-targeted dialog (generation).
     */
    _loadMore = (listKey) => {
        const loader = this._listLoaders[listKey];
        if (!loader || !loader.hasMore || loader.loading) return;
        const gen = this._gen;
        const loadingKey = listKey + "Loading";
        this.setState({ [loadingKey]: true });
        const settle = () => {
            if (gen === this._gen) this.setState({ [loadingKey]: false });
        };
        loader.loadMore().then(settle, settle);
    };
    _loadMoreFollowers = () => this._loadMore("_followers");
    _loadMoreFollowing = () => this._loadMore("_following");

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

    /**
     * Report counts exactly once per open: the chain totals as soon as
     * they arrive, or the list lengths if both lists end first (or the
     * count call failed).
     */
    _maybeReportCounts = () => {
        if (this._countsReported || typeof this.props.onCountsUpdated !== 'function') return;
        const {
            _followerCount, _followingCount,
            _followersDone, _followingDone, _followers, _following,
        } = this.state;
        let followers, following;
        if (_followerCount != null) {
            followers = Math.max(_followerCount, _followers.length);
            following = Math.max(_followingCount, _following.length);
        } else if (_followersDone && _followingDone) {
            followers = _followers.length;
            following = _following.length;
        } else {
            return;
        }
        this._countsReported = true;
        this.props.onCountsUpdated(followers, following);
    };

    /** "412 Followers" with the chain total; "200+ Followers" without it. */
    _tabLabel = (len, total, done, word) => {
        if (done) return `${len} ${word}`;
        if (total != null) return `${Math.max(len, total)} ${word}`;
        return `${len}+ ${word}`;
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

    _setSwipeRoot = (el) => { this._swipeRoot = el; };

    // Scroll this dialog's slides back to the top (scoped to this dialog,
    // so another open dialog's swipeable views are never touched).
    swipeableViewScrollTop = () => {
        const root = this._swipeRoot;
        if (!root) return;
        const container = root.querySelector(".react-swipeable-view-container");
        if (!container) return;
        for (const slide of Array.from(container.children)) {
            slide.style.scrollBehavior = "smooth";
            slide.scrollTop = 0;
        }
    };

    // ── Row renderer (factory bound to the rendered list) ─────────────

    _renderUserRow = (user) => {
        const { classes } = this.props;
        const { _followingSet, _loggedInUser } = this.state;
        if (!user) return null;
        const username = user.username || user.name;
        const image = user.image || '';
        const isFollowing = _followingSet.has(username);
        const isOwnAccount = _loggedInUser && _loggedInUser.toLowerCase() === username.toLowerCase();

        return (
            <ListItem classes={{ root: classes.listItem }} ContainerComponent={"div"} key={username} style={{ height: ROW_H }} component={"div"}>
                <ListItemAvatar>
                    <Avatar onClick={() => this._open_author(username)} src={image} style={{ borderRadius: "14px", cursor: "pointer" }} className={"pixelated"} />
                </ListItemAvatar>
                <ListItemText
                    id={`@${username}`}
                    primary={<span className={classes.listItemTitle} onClick={() => this._open_author(username)}>{`@${username}`}</span>}
                />
                {_loggedInUser && !isOwnAccount && (
                    <ListItemSecondaryAction className={classes.action} style={ACTION_STYLE}>
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

    _setChartSummary = (kind) => (text) => {
        this.setState((s) => ({ _chartSummary: { ...s._chartSummary, [kind]: text } }));
    };
    _onFollowersSummary = this._setChartSummary("followers");
    _onFollowingSummary = this._setChartSummary("following");

    /**
     * Collapsed chart above each list: the count over time (and, for followers, follows gained and
     * lost), from the statistics service. Nothing is fetched until it is opened.
     */
    _renderChart = (kind) => {
        const account = this.props.account;
        const username = account && account.name;
        if (!username) return null;
        const title = kind === "followers"
            ? tr("components.account_charts.followers_over_time", "Followers over time")
            : tr("components.account_charts.following_over_time", "Following over time");
        return (
            <CollapseSection key={kind + ":" + username} title={title} count={this.state._chartSummary[kind]} style={{ margin: "0px 0px 8px 0px" }}>
                <FollowHistory
                    username={username}
                    kind={kind}
                    onSummary={kind === "followers" ? this._onFollowersSummary : this._onFollowingSummary}
                />
            </CollapseSection>
        );
    };

    _handleTabChange = (e, value) => {
        this.setState({ _tab: value }, this.swipeableViewScrollTop);
    };

    _get_views = () => {
        const { classes } = this.props;
        const {
            _followers, _following, _followersFirst, _followingFirst,
            _followersDone, _followingDone, _followersLoading, _followingLoading,
        } = this.state;

        const renderList = (users, firstPageLanded, done, loading, onLoadMore, emptyText, kind) => (
            <DialogContent scroll={"paper"} className={classes.dialogContent} key={kind}>
                {this._renderChart(kind)}
                {!firstPageLanded ? (
                    <div className={classes.loadingContainer}><CircularProgress color={"secondary"} /></div>
                ) : (
                    <WindowedUserList
                        users={users}
                        renderRow={this._renderUserRow}
                        hasMore={!done}
                        loading={loading}
                        onLoadMore={onLoadMore}
                        emptyText={emptyText}
                        classes={classes}
                    />
                )}
            </DialogContent>
        );

        return [
            renderList(_followers, _followersFirst, _followersDone, _followersLoading, this._loadMoreFollowers, "No followers yet", "followers"),
            renderList(_following, _followingFirst, _followingDone, _followingLoading, this._loadMoreFollowing, "Not following anyone yet", "following"),
        ];
    };

    render() {
        const { classes, open } = this.props;
        const {
            _tab, _followers, _following,
            _followersDone, _followingDone,
            _followerCount, _followingCount,
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
                    <Tab label={this._tabLabel(_followers.length, _followerCount, _followersDone, "Followers")} />
                    <Tab label={this._tabLabel(_following.length, _followingCount, _followingDone, "Following")} />
                </Tabs>
                <div className={classes.swipeRoot} ref={this._setSwipeRoot}>
                <SwipeableViews
                    ignoreNativeScroll={true}
                    style={{ height: "100%" }}
                    containerStyle={{ height: "100%" }}
                    slideStyle={SLIDE_STYLE}
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
                </div>
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