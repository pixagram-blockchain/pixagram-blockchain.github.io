import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import IconButton from "@material-ui/core/IconButton";
import CloseIcon from "@material-ui/icons/Close";
import CircularProgress from "@material-ui/core/CircularProgress";
import { HISTORY } from "../utils/constants";
import * as actions from "../actions/utils";
import { PagedLoader } from "../utils/api/paged-list";
import { AccountList, AccountImageStore, FollowableAccountRow, followTargetOf } from "./list/AccountList";

import { t, tk, tx, getLanguage } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";

// Role badge text: the chain's role ids ("mod", "muted"…) are identifiers,
// not words. Unknown roles fall through as they are.
const ROLE_LABELS = {
    owner: tk("components.notifications_dialog.role_owner"),
    admin: tk("components.notifications_dialog.role_admin"),
    mod: tk("components.notifications_dialog.role_moderator"),
    moderator: tk("components.notifications_dialog.role_moderator"),
    member: tk("components.notifications_dialog.role_member"),
    muted: tk("components.notifications_dialog.role_muted"),
};
const roleLabel = (role) => (Object.prototype.hasOwnProperty.call(ROLE_LABELS, role) ? tx(ROLE_LABELS[role]) : role);
// ── MembersListDialog (progressive) ────────────────────────────────────
// What changed vs. the previous version:
//
//   1. PROGRESSIVE LOADING — the old `while (true)` loop fetched up to
//      20 serial pages of subscribers, then hydrated ALL avatars, then
//      rendered. The list now renders after the FIRST page (one
//      round-trip) and streams the rest in via PagedLoader; a slim
//      header row shows "N+ members" with a spinner while streaming.
//
//   2. SHARED AVATAR HYDRATION — per-page, through account-cache's
//      getProfiles(): batched, deduped app-wide, and never blocking.
//      Profiles already cached by other views (VotingListModal, feed)
//      resolve with zero network.
//
//   3. NON-BLOCKING FOLLOW SET — the logged-in user's following list
//      streams in the background; checkboxes fill in as it lands
//      instead of gating the whole dialog.
//
//   4. LIFECYCLE CLEANUP — `open` is read from props (no state mirror),
//      componentWillReceiveProps is gone (componentDidUpdate drives
//      open/community changes), and all async work is guarded by a
//      generation counter + loader.cancel() so a closed or switched
//      dialog can never write stale state.
//
//   5. Search is computed in render from (_members, _search) with a
//      one-slot memo, so it stays correct while rows stream in.
//
//   6. SHARED LIST (components/list/AccountList) — the fixed 480px
//      react-virtualized box (a second scrollbar, too tall for short
//      phones) and its per-render rowRenderer factory are gone: rows
//      window against the dialog's own scroll area and are memoised
//      (a follow toggle re-renders one row). Avatars are no longer
//      hydrated per streamed page — up to 2 000 accounts fetched while
//      the first screen was showing — but for the rows ON SCREEN only,
//      through an AccountImageStore owned by this dialog.
//
// Public props are unchanged: { open, onClose, api, communityName }.
// ───────────────────────────────────────────────────────────────────────

const styles = theme => ({
    dialog: {
        "& .MuiDialog-paperScrollPaper": {
            // 12px off every edge on phones: 100% plus MUI's 32px margins
            // used to overflow the screen.
            [theme.breakpoints.down("sm")]: {
                margin: 12,
                width: "calc(100% - 24px)",
                maxWidth: "none",
                maxHeight: "calc(100% - 24px)",
            },
        },
    },
    searchField: {
        margin: "16px 16px 8px 16px",
        width: "calc(100% - 32px)",
        "& .MuiOutlinedInput-root": {
            borderRadius: "21px",
            backgroundColor: "#171717",
        },
        "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "#00000000",
        },
        "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#00000000",
        },
        "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#00000000",
        },
        "& .MuiInputBase-input": {
            color: "#fff",
        },
    },
    dialogContent: {
        margin: "0px 0px 8px 0px",
        padding: "0 8px",
    },
    loadingContainer: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: 480,
    },
    streamRow: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 16px 4px 16px",
        color: "#989898",
        fontSize: "0.8rem",
    },
});

const getUsername = (m) => (m && m.username) || "";

class MembersListDialog extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            _members: [],            // streamed member objects
            _membersDone: false,     // all pages landed (or capped)
            _firstPage: false,       // first page landed → list visible
            _search: "",
            _followingSet: new Set(),
            _loggedInUser: null,
        };

        // Async-staleness guard: bumped on every (re)start and cancel.
        this._gen = 0;
        this._membersLoader = null;
        this._followLoader = null;
        // Avatars for the rows on screen (see AccountImageStore); one per
        // open, dropped with the loaders.
        this._images = null;
        // One-slot memo for the row renderer (see _getRenderRow).
        this._rowCache = { followingSet: null, user: null, lang: null, fn: null };

        // One-slot memo for the search filter (see _getFiltered).
        this._filterCache = { members: null, search: "", out: [] };
    }

    // ── Lifecycle ─────────────────────────────────────────────────────

    componentDidMount() {
        if (this.props.open) this._startLoaders();
    }

    componentDidUpdate(prevProps) {
        const opened   = this.props.open && !prevProps.open;
        const switched = this.props.open &&
            prevProps.communityName !== this.props.communityName;

        if (opened || switched) {
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
        if (this._membersLoader) this._membersLoader.cancel();
        if (this._followLoader) this._followLoader.cancel();
        this._membersLoader = null;
        this._followLoader = null;
        // Stops its requests; the URLs it has stay readable for the rows
        // still fading out with the dialog. Replaced on the next open.
        if (this._images) this._images.dispose();
    };

    // ── Data loading ──────────────────────────────────────────────────

    _startLoaders = async () => {
        const api = this.props.api;
        const communityName = this.props.communityName;
        if (!api || !api.communities || !communityName) return;

        this._cancelLoaders();
        const gen = this._gen;
        this._images = new AccountImageStore(api);

        this.setState({
            _members: [],
            _membersDone: false,
            _firstPage: false,
            _search: "",
            _followingSet: new Set(),
        });

        // Resolve the session user (drives the follow checkboxes) without
        // blocking the member list itself.
        let loggedInUser = this.state._loggedInUser;
        if (!loggedInUser && api.sessionManager) {
            try { loggedInUser = await api.sessionManager.getActiveAccount(); } catch (e) {}
            if (gen !== this._gen) return;
            if (loggedInUser) this.setState({ _loggedInUser: loggedInUser });
        }

        // ── Subscribers: progressive — first page renders immediately ──
        const mapped = []; // member objects, appended page by page
        this._membersLoader = new PagedLoader({
            limit: 100,
            maxItems: 2000, // same ceiling as the old loop
            itemKey: (s) => s && s[0],
            fetchPage: (cursor, limit) =>
                api.communities.listSubscribers(communityName, cursor, limit),
            onPage: (_all, { fresh, done }) => {
                if (gen !== this._gen) return;
                // Map tuples [name, role, title, date] exactly once.
                for (const s of fresh) {
                    mapped.push({
                        username: s[0],
                        role: s[1],
                        title: s[2] || "",
                        joinedAt: s[3],
                    });
                }
                this.setState({
                    _members: mapped.slice(),
                    _firstPage: true,
                    _membersDone: done,
                });
            },
            onError: (e) => {
                if (gen !== this._gen) return;
                console.warn("[MembersListDialog] subscribers page error:", e && e.message);
                // Keep whatever already streamed in; stop the indicator.
                this.setState({ _firstPage: true, _membersDone: true });
            },
            onDone: () => {
                if (gen === this._gen) this.setState({ _membersDone: true });
            },
        });
        this._membersLoader.start();

        // ── Logged-in user's following set: background, non-blocking ──
        if (loggedInUser && api.follow) {
            const set = new Set();
            this._followLoader = new PagedLoader({
                limit: 100,
                maxItems: 1000, // same ceiling as the old loop
                itemKey: (f) => f && f.following,
                fetchPage: (cursor, limit) =>
                    api.follow.getFollowing(loggedInUser, cursor || "", "blog", limit),
                onPage: (_all, { fresh }) => {
                    if (gen !== this._gen) return;
                    for (const f of fresh) set.add(f.following);
                    this.setState({ _followingSet: new Set(set) });
                },
                onError: () => {},
            });
            this._followLoader.start();
        }
    };

    // ── Search (computed in render, one-slot memo) ────────────────────

    _getFiltered = () => {
        const { _members, _search } = this.state;
        const c = this._filterCache;
        if (c.members === _members && c.search === _search) return c.out;

        const q = _search.trim().toLowerCase();
        const out = q
            ? _members.filter((m) => m.username.toLowerCase().includes(q))
            : _members;
        this._filterCache = { members: _members, search: _search, out };
        return out;
    };

    _handleSearchChange = (e) => this.setState({ _search: e.target.value });
    _clearSearch = () => this.setState({ _search: "" });

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
            console.error("[MembersListDialog] toggle follow error:", e);
            actions.trigger_snackbar(e.message || t("components.members_list_dialog.failed_to_update_follow_status"));
        }
    };

    _onToggleFollow = (e) => {
        const username = followTargetOf(e);
        if (username) this._toggleFollow(username);
    };

    // ── Rows ──────────────────────────────────────────────────────────
    // The renderer is rebuilt only when what the rows read from state does
    // (the follow set, the session user) or the language their role badges
    // are written in: AccountList re-offers its visible rows then, and the
    // memoised rows decide which actually changed.
    _getRenderRow = () => {
        const { _followingSet, _loggedInUser } = this.state;
        const lang = getLanguage();
        const c = this._rowCache;
        if (c.fn && c.followingSet === _followingSet && c.user === _loggedInUser && c.lang === lang) return c.fn;
        const me = _loggedInUser ? String(_loggedInUser).toLowerCase() : "";
        const fn = (member, index, classes, image) => {
            const username = member.username;
            return (
                <FollowableAccountRow
                    classes={classes}
                    username={username}
                    image={image}
                    badge={member.role && member.role !== "guest" ? roleLabel(member.role) : ""}
                    canFollow={!!me && me !== String(username).toLowerCase()}
                    following={_followingSet.has(username)}
                    onToggleFollow={this._onToggleFollow}
                />
            );
        };
        this._rowCache = { followingSet: _followingSet, user: _loggedInUser, lang, fn };
        return fn;
    };

    // ── Render ────────────────────────────────────────────────────────

    render() {
        const { classes, open } = this.props;
        const { _search, _firstPage, _membersDone, _members } = this.state;
        const filtered = this._getFiltered();

        return (
            <Dialog
                className={classes.dialog}
                open={!!open}
                fullWidth={true}
                disablePortal={false}
                onClose={this.props.onClose}
                keepMounted={false}
            >
                <TextField
                    className={classes.searchField}
                    variant="outlined"
                    size="small"
                    placeholder={t("components.members_list_dialog.search_members")}
                    value={_search}
                    onChange={this._handleSearchChange}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <span style={{ color: "#989898", fontWeight: "bold" }}>@</span>
                            </InputAdornment>
                        ),
                        endAdornment: _search ? (
                            <InputAdornment position="end">
                                <IconButton size="small" onClick={this._clearSearch}>
                                    <CloseIcon style={{ fontSize: 18, color: "#989898" }} />
                                </IconButton>
                            </InputAdornment>
                        ) : null,
                    }}
                />
                {_firstPage && (
                    <div className={classes.streamRow}>
                        <span>
                            {_membersDone
                                ? t("components.members_list_dialog.member_count", { member: { member: _members.length } })
                                : t("components.members_list_dialog.member_count_more", { member: { member: _members.length } })}
                        </span>
                        {!_membersDone && (
                            <CircularProgress size={12} thickness={5} color={"secondary"} />
                        )}
                    </div>
                )}
                <DialogContent scroll={"paper"} className={classes.dialogContent}>
                    {!_firstPage ? (
                        <div className={classes.loadingContainer}>
                            <CircularProgress color={"secondary"} />
                        </div>
                    ) : (
                        <AccountList
                            items={filtered}
                            getName={getUsername}
                            renderRow={this._getRenderRow()}
                            imageStore={this._images}
                            onOpenAccount={this._open_author}
                            emptyText={_search
                                ? t("components.members_list_dialog.no_members_matching_your_search")
                                : t("components.members_list_dialog.no_members_yet")}
                        />
                    )}
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={this.props.onClose}
                        autoFocus
                        variant="contained"
                        color="primary"
                    >
                        {t("words.close")}
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }
}

export default withLanguage(withStyles(styles)(MembersListDialog));