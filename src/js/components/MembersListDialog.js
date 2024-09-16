import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Button from "@material-ui/core/Button";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import ListItemAvatar from "@material-ui/core/ListItemAvatar";
import Avatar from "@material-ui/core/Avatar";
import VirtualizedList from "@pixagram/virtualized/dist/es/List";
import AutoSizer from "@pixagram/virtualized/dist/es/AutoSizer";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import IconButton from "@material-ui/core/IconButton";
import CloseIcon from "@material-ui/icons/Close";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import Checkbox from "@material-ui/core/Checkbox";
import CircularProgress from "@material-ui/core/CircularProgress";
import Chip from "@material-ui/core/Chip";
import { HISTORY } from "../utils/constants";
import * as actions from "../actions/utils";
import { PagedLoader } from "../utils/api/paged-list";
import { getProfiles } from "../utils/api/account-cache";

import { t } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";
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
// Public props are unchanged: { open, onClose, api, communityName }.
// ───────────────────────────────────────────────────────────────────────

const styles = theme => ({
    dialog: {
        "& .MuiDialog-paperScrollPaper": {
            [theme.breakpoints.down("sm")]: {
                maxHeight: "100%"
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
        fontWeight: "bold",
        fontFamily: '"Industry Book", "Normative Pro"',
        color: "#fff",
        cursor: "pointer",
    },
    roleChip: {
        marginLeft: 8,
        height: 20,
        fontSize: "0.7rem",
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
            marginRight: "0px !important",
        },
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
    };

    // ── Data loading ──────────────────────────────────────────────────

    _startLoaders = async () => {
        const api = this.props.api;
        const communityName = this.props.communityName;
        if (!api || !api.communities || !communityName) return;

        this._cancelLoaders();
        const gen = this._gen;

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
                        image: "",
                    });
                }
                this.setState({
                    _members: mapped.slice(),
                    _firstPage: true,
                    _membersDone: done,
                });
                this._hydrateAvatars(gen, mapped, fresh.map((s) => s[0]));
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

    /**
     * Per-page avatar hydration through the shared account-cache:
     * batched and deduped app-wide, never blocks rows from painting.
     * Patches only rows still missing an image, with new object
     * identities so PureComponent rows re-render correctly.
     */
    _hydrateAvatars = (gen, mapped, names) => {
        const api = this.props.api;
        if (!api || !names || names.length === 0) return;

        getProfiles(api, names)
            .then((profiles) => {
                if (gen !== this._gen) return;
                let changed = false;
                for (let i = 0; i < mapped.length; i++) {
                    const m = mapped[i];
                    if (m.image) continue;
                    const p = profiles.get(String(m.username).toLowerCase());
                    if (p && p.image) {
                        mapped[i] = { ...m, image: p.image };
                        changed = true;
                    }
                }
                if (changed && gen === this._gen) {
                    this.setState({ _members: mapped.slice() });
                }
            })
            .catch((e) => {
                console.warn("[MembersListDialog] hydrate error:", e && e.message);
            });
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
            actions.trigger_snackbar(e.message || "Failed to update follow status");
        }
    };

    _roleColor = (role) => {
        switch (role) {
            case "owner": return "#333";
            case "admin": return "#333";
            case "mod": return "#333";
            default: return "#333";
        }
    };

    // ── Row renderer (factory bound to the current filtered list) ─────

    _memberRenderer = (members) => ({ index, key, style }) => {
        const { classes } = this.props;
        const { _followingSet, _loggedInUser } = this.state;
        const member = members[index];
        if (!member) return null;

        const { username, image, role } = member;
        const isFollowing = _followingSet.has(username);
        const isOwnAccount = _loggedInUser &&
            _loggedInUser.toLowerCase() === username.toLowerCase();
        const roleColor = this._roleColor(role);

        return (
            <ListItem
                classes={{ root: classes.listItem }}
                ContainerComponent={"div"}
                key={key}
                style={Object.assign({ height: 64 }, style)}
                component={"div"}
            >
                <ListItemAvatar>
                    <Avatar
                        onClick={() => this._open_author(username)}
                        src={image}
                        style={{ borderRadius: "14px", cursor: "pointer" }}
                        className={"pixelated"}
                    />
                </ListItemAvatar>
                <ListItemText
                    id={`@${username}`}
                    primary={
                        <span>
                            <span
                                className={classes.listItemTitle}
                                onClick={() => this._open_author(username)}
                            >
                                {`@${username}`}
                            </span>
                            {role && role !== "guest" && (
                                <Chip
                                    label={role}
                                    size="small"
                                    className={classes.roleChip}
                                    style={roleColor ? { backgroundColor: roleColor, color: "#fff" } : undefined}
                                />
                            )}
                        </span>
                    }
                />
                {_loggedInUser && !isOwnAccount && (
                    <ListItemSecondaryAction className={classes.action} style={style}>
                        <Checkbox
                            size="medium"
                            color="primary"
                            checked={isFollowing}
                            onChange={() => this._toggleFollow(username)}
                            edge="end"
                            inputProps={{ "aria-labelledby": `@${username}` }}
                        />
                    </ListItemSecondaryAction>
                )}
            </ListItem>
        );
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
                            {_members.length}{_membersDone ? "" : "+"} member{_members.length === 1 ? "" : "s"}
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
                        <AutoSizer disableHeight>
                            {({ width }) => (
                                <List component="div">
                                    <VirtualizedList
                                        noRowsRenderer={() => (
                                            <ListItem component="div">
                                                <ListItemText
                                                    secondary={
                                                        _search
                                                            ? "No members matching your search"
                                                            : "No members yet"
                                                    }
                                                />
                                            </ListItem>
                                        )}
                                        scrollToIndex={undefined}
                                        height={480}
                                        overscanRowCount={5}
                                        rowCount={filtered.length}
                                        rowHeight={64}
                                        rowRenderer={this._memberRenderer(filtered)}
                                        width={width}
                                    />
                                </List>
                            )}
                        </AutoSizer>
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