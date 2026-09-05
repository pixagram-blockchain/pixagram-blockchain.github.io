import * as React from "preact/compat";
import { useState, useRef, useLayoutEffect } from "preact/hooks";
import withStyles from "@material-ui/core/styles/withStyles";
import Avatar from "@material-ui/core/Avatar";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import ListItemAvatar from "@material-ui/core/ListItemAvatar";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import Typography from "@material-ui/core/Typography";
import ReplyRounded from "@material-ui/icons/ReplyRounded";
import MoreVertRounded from "@material-ui/icons/MoreVertRounded";
import EditRounded from "@material-ui/icons/EditRounded";
import DeleteOutlineRounded from "@material-ui/icons/DeleteOutlineRounded";
import CircularProgress from '@material-ui/core/CircularProgress';
import ArrowUpDropCircle from '../icons/ArrowUpDropCircle';
import ArrowUpDropCircleOutline from '../icons/ArrowUpDropCircleOutline';
import ArrowDownDropCircle from '../icons/ArrowDownDropCircle';
import ArrowDownDropCircleOutline from '../icons/ArrowDownDropCircleOutline';
import useLiveTimeAgo from "../hooks/useLiveTimeAgo";
import { HISTORY } from "../utils/constants";
import * as actions from "../actions/utils";
import { voteSign } from "../utils/voteValue";
import { votesWithLocalVote } from "../utils/voteSync";
import { safeHTML } from "../utils/api/sanitizer";

import { t } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";

// Hoisted static styles — were inline literals re-created on every render.
const ST_D_INLINE_FLEX = { display: 'inline-flex' };
const ST_CUR_POINTER__MR_NEG4__ML_4 = { cursor: 'pointer', marginRight: 4, marginLeft: -4 };
const ST_ML_AUTO__D_FLEX__AI_CENTER = { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' };
const ST_D_FLEX__AI_FLEX_START = { display: "flex", alignItems: "flex-start" };
const ST_MB_4__D_BLOCK__FLEX_1 = { marginBottom: 4, display: "block", flex: 1, minWidth: 0 };
const ST_C_999 = { color: "#999" };
const ST_C_DDD__FS_14 = { color: "#ddd", fontSize: 14 };
const ST_LH_1REM__LS_0__D_BLOCK = { lineHeight: "1rem", letterSpacing: 0, display: "block" };
const ST_C_888 = { color: '#888' };
const ST_ML_8 = { marginLeft: 8 };

/**
 * Render user-supplied markdown at the correct trust tier.
 *
 * pixaproxyapi documents four WASM-backed tiers and states that every string
 * reaching dangerouslySetInnerHTML must pass through one of them. Until now
 * none of them had a single caller: every site used safeHTML(), which applies
 * the POST allowlist — headings, tables, images — to comment bodies, and does
 * no markdown rendering at all.
 *
 * sanitizeCommentHTML() renders AND sanitises at the comment tier in one
 * synchronous call. safeHTML stays as the fallback for the case where `api`
 * has not been threaded in yet, so this can never render less safely than it
 * did before.
 */
function renderCommentBody(api, body) {
    if (!body) return "";
    if (api && typeof api.sanitizeCommentHTML === "function") return api.sanitizeCommentHTML(body);
    return safeHTML(body);
}

const DATE_TOOLTIP_FORMAT = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric'
};

function renderPostBody(api, body) {
    if (!body) return "";
    if (api && typeof api.sanitizePostHTML === "function") return api.sanitizePostHTML(body);
    return safeHTML(body);
}

// CommentInList is a class component, so the live-timeago hook can't run in
// it directly — this leaf carries it instead. Each mounted comment holds one
// watcher (age-scaled cadence: per-second under a minute old, per-minute
// under an hour, per-hour under a day, then daily), released when the
// comment unmounts. A tick re-renders ONLY this span: the comment's
// WASM-sanitized body never re-renders on the clock. forwardRef + the prop
// spread keep MUI's Tooltip working — it clones its child with positioning
// handlers and needs the underlying DOM node's ref.
const LiveTimeAgoSpan = React.forwardRef(function LiveTimeAgoSpan({ date, options, ...rest }, ref) {
    const label = useLiveTimeAgo(date, options);
    return <span ref={ref} {...rest}>{label}</span>;
});


// How many comment levels to render inline before navigation is required.
// 3 -> the comment itself (level 1), its direct replies (level 2) and their
// replies (level 3). Deeper levels are reached via "Show Replies".
const MAX_VISIBLE_DEPTH = 3;

const styles = theme => ({
    card: {
        width: "100%",
        position: "relative",
        borderRadius: "21px",
        transition: 'background-color 275ms cubic-bezier(0.4, 0, 0.2, 1) 5ms',
        "&:hover": {
            backgroundColor: "#29292958",
            transition: 'background-color 275ms cubic-bezier(0.4, 0, 0.2, 1) 275ms',
        },
        "& .MuiAvatar-root": {
            cursor: "pointer",
            borderRadius: "14px"
        },
        "& .MuiListItemAvatar-root": {
            minWidth: "48px"
        },
        "& .MuiListItem-gutters": {
            padding: "0px"
        },
    },
    commentNode: {
        width: "100%",
        // The tree connectors (::before/::after below) sit at z-index -1.
        // Without a stacking context on the thread root they escape to the
        // nearest ancestor context — in BlogPostDialog that is a wrapper
        // OUTSIDE the opaque #101010 comments card, so the whole tree painted
        // underneath the card and was invisible. (PostDialog only worked
        // because its comments panel happens to form a stacking context via
        // will-change/contain.) Isolating the thread root keeps the
        // connectors inside it, in any host.
        position: "relative",
        zIndex: 0,
        isolation: "isolate",
    },
    // Root of a thread: drop a stem from the parent's avatar down to the replies'
    // trunk, so the parent visibly connects to its branches.
    cardHasReplies: {
        "&::before": {
            content: "''",
            position: "absolute",
            left: 32,
            top: 30,
            bottom: 0,
            width: 4,
            backgroundColor: "#202020",
            zIndex: -1
        },
    },
    repliesContainer: {
        position: "relative",
        marginLeft: 32,
    },
    // A single reply in the tree. ::after is the rounded elbow joining it to the
    // trunk; ::before is the trunk continuing down to the next sibling (hidden on
    // the last child, so the branch ends cleanly).
    replyNode: {
        position: "relative",
        paddingLeft: 4,
        "&::before": {
            content: "''",
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            backgroundColor: "#202020",
            zIndex: -1
        },
        "&::after": {
            content: "''",
            position: "absolute",
            left: 0,
            top: 0,
            width: 24,
            height: 30,
            borderLeft: "4px solid #202020",
            borderBottom: "4px solid #202020",
            borderBottomLeftRadius: 14,
            zIndex: -1
        },
        "&:last-child::before": {
            display: "none",
        },
    },
    // ── Focused-comment highlight (deep-link "#replies&focus=…") ──────────
    // The pinned comment renders in its hover state permanently, and every
    // connector segment on the path from the thread root down to it swaps
    // #202020 for a brighter grey so the eye can follow the branch. These
    // classes sit AFTER their base classes on purpose: same specificity,
    // later in the sheet wins.
    cardFocused: {
        backgroundColor: "#29292958",
    },
    // Stem of an on-path parent — the vertical drop from its avatar into the
    // replies that lead to the focused comment.
    cardHasRepliesFocusPath: {
        "&::before": { backgroundColor: "#4d4d4d" },
    },
    // The on-path reply itself: its elbow (the vertical + the turn into the
    // comment) brightens. Its own downward trunk stays dim — the path ends at
    // it (or continues through its OWN stem), never past it to later siblings.
    replyNodeFocusElbow: {
        "&::after": {
            borderLeftColor: "#4d4d4d",
            borderBottomColor: "#4d4d4d",
        },
    },
    // Siblings ABOVE the on-path reply: the trunk running alongside them is
    // part of the path, so their vertical segments brighten — the trunk and
    // the vertical half of their elbow — while the turn into them stays dim.
    replyNodeFocusTrunk: {
        "&::before": { backgroundColor: "#4d4d4d" },
        "&::after": { borderLeftColor: "#4d4d4d" },
    },
    repliesLoading: {
        display: "flex",
        alignItems: "center",
        padding: "8px 0 8px 28px",
        color: "#888",
    },
    subheaderName: {
        color: "#aaa",
        cursor: "pointer",
        fontWeight: "bold"
    },
    replyText: {
        color: "#666"
    },
    replyTextPointer: {
        cursor: "pointer",
        color: "#666"
    },
    replyButton: {
        cursor: "pointer",
        color: "#999"
    },
    subheaderBy: {
        color: "#aaa"
    },
    subheaderDate: {
        color: "#ddd"
    },
    voted: {
        color: '#eee',
        transition: 'color 275ms cubic-bezier(0.4, 0, 0.2, 1) 5ms',
        "& svg": {
            transform: "scale(1)",
        }
    },
    votedAnimated: {
        color: '#eee',
        transition: 'color 275ms cubic-bezier(0.4, 0, 0.2, 1) 5ms',
        "& svg": {
            animation: "$growOnce both 350ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
            "@global": {
                "@keyframes growOnce": {
                    "0%": {
                        transform: "scale(1)",
                    },
                    "25%": {
                        transform: "scale(.85)",
                    },
                    "50%": {
                        transform: "scale(1.3)",
                    },
                    "100%": {
                        transform: "scale(1)",
                    },
                }
            },
        }
    },
    vote: {
        color: '#888',
        transition: 'color 275ms cubic-bezier(0.4, 0, 0.2, 1) 5ms',
        '&:hover': {
            color: '#bbb',
            transition: 'color 275ms cubic-bezier(0.4, 0, 0.2, 1) 5ms',
        },
    },
    voteLoading: {
        color: '#888',
        transition: 'color 275ms cubic-bezier(0.4, 0, 0.2, 1) 5ms',
        '&:hover': {
            color: '#bbb',
            transition: 'color 275ms cubic-bezier(0.4, 0, 0.2, 1) 5ms',
        },
    },
    voteButtonWrapper: {
        position: 'relative',
        display: 'inline-flex',
        // Let the floating +1 / -1 escape the button bounds without clipping.
        overflow: 'visible',
    },
    voteProgress: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginTop: -14,
        marginLeft: -14,
        color: '#bbb'
    },
    // Floating "+1" rises / "-1" falls while fading — shown only for a fresh vote.
    '@keyframes floatUp': {
        '0%':   { opacity: 0, transform: 'translateX(-50%) translateY(2px) scale(0.7)' },
        '20%':  { opacity: 1, transform: 'translateX(-50%) translateY(-2px) scale(1.1)' },
        '100%': { opacity: 0, transform: 'translateX(-50%) translateY(-22px) scale(1)' },
    },
    '@keyframes floatDown': {
        '0%':   { opacity: 0, transform: 'translateX(-50%) translateY(-2px) scale(0.7)' },
        '20%':  { opacity: 1, transform: 'translateX(-50%) translateY(2px) scale(1.1)' },
        '100%': { opacity: 0, transform: 'translateX(-50%) translateY(22px) scale(1)' },
    },
    floatUp: {
        position: 'absolute',
        left: '50%',
        top: '50%',
        marginTop: '-0.5em',
        pointerEvents: 'none',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        fontWeight: 700,
        fontSize: '0.8rem',
        lineHeight: 1,
        color: '#eee', // soft green; set to '#eee' to match the monochrome palette
        willChange: 'transform, opacity',
        animation: '$floatUp 800ms cubic-bezier(0.22, 1, 0.36, 1) both',
    },
    floatDown: {
        position: 'absolute',
        left: '50%',
        top: '50%',
        marginTop: '-0.5em',
        pointerEvents: 'none',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        fontWeight: 700,
        fontSize: '0.8rem',
        lineHeight: 1,
        color: '#eee', // soft red; set to '#eee' to match the monochrome palette
        willChange: 'transform, opacity',
        animation: '$floatDown 800ms cubic-bezier(0.22, 1, 0.36, 1) both',
    },
    voteActions: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        marginTop: '8px',
    },
    menuButton: {
        color: '#666',
        padding: 4,
        marginLeft: 8,
        '&:hover': {
            color: '#999',
        },
    },
    ownerMenu: {
        '& .MuiPaper-root': {
            backgroundColor: '#1a1a1a',
            borderRadius: '12px',
        },
        '& .MuiMenuItem-root': {
            '&:hover': { backgroundColor: '#2a2a2a' },
        },
        '& .MuiListItemIcon-root': {
            color: '#999',
            minWidth: 36,
        },
    }
});

// VoteButton Component (from PaperCardActions)
function VoteButton({
                        classes,
                        direction, // 'up' or 'down'
                        isVoted,
                        isLoading,
                        onVote,
                        disabled,
                        loggedOut,
                        voteNonce = 0,
                    }) {
    // Animation is driven by voteNonce, never derived from isVoted — same
    // contract as VoteButton in PaperCardActions, kept in step deliberately.
    //
    // A false -> true crossing on isVoted is not evidence of a click: it also
    // fires when a recycled row is re-pointed at a different comment and when a
    // background refresh surfaces a vote this instance didn't know about. The
    // class bumps voteNonce only inside a vote callback that succeeded, so a
    // change in it is proof of intent. The mount value is the silent baseline,
    // which covers hydrated votes and the remount that a comment-identity change
    // forces (CommentVoteActions is keyed on author/permlink).
    const [animate, setAnimate] = useState(false);
    const [floats, setFloats] = useState([]);
    const prevNonce = useRef(voteNonce); // baseline = the value we mounted with
    const idCounter = useRef(0);

    // useLayoutEffect so the class swap to votedAnimated and the float insertion
    // happen before paint — no intermediate static frame, so the bounce is clean.
    useLayoutEffect(() => {
        if (voteNonce !== prevNonce.current) {
            prevNonce.current = voteNonce;
            if (isVoted) {
                // the user cast this vote just now, on this comment
                setAnimate(true);
                setFloats((prev) => [...prev, ++idCounter.current]);
                return;
            }
        }
        // Hydrated, refreshed, unvoted, or switched away: stay static, and reset
        // so the next real vote can animate again.
        if (!isVoted) setAnimate(false);
    }, [voteNonce, isVoted]);

    const removeFloat = (id) =>
        setFloats((prev) => prev.filter((f) => f !== id));

    const getIcon = () => {
        if (direction === 'up') {
            return isVoted ? <ArrowUpDropCircle /> : <ArrowUpDropCircleOutline />;
        }
        return isVoted ? <ArrowDownDropCircle /> : <ArrowDownDropCircleOutline />;
    };

    const getClassName = () => {
        if (isLoading) return classes.voteLoading;
        if (!isVoted) return classes.vote;
        // Bounce only for a vote cast in this session, on this comment;
        // hydrated votes and re-pointed rows stay static.
        return animate ? classes.votedAnimated : classes.voted;
    };

    const floatClass = direction === 'up' ? classes.floatUp : classes.floatDown;
    const floatLabel = direction === 'up' ? '+1' : '−1';

    const button = (
        <div className={classes.voteButtonWrapper}>
            <IconButton
                className={getClassName()}
                aria-label={`${direction === 'up' ? 'Up' : 'Down'}-Vote`}
                onClick={loggedOut ? undefined : onVote}
                disabled={loggedOut || disabled || isLoading}
                size="small"
            >
                {getIcon()}
            </IconButton>
            {isLoading && (
                <CircularProgress
                    size={28}
                    thickness={4}
                    className={classes.voteProgress}
                />
            )}
            {floats.map((id) => (
                <span
                    key={id}
                    className={floatClass}
                    onAnimationEnd={() => removeFloat(id)}
                    aria-hidden="true"
                >
                    {floatLabel}
                </span>
            ))}
        </div>
    );

    if (loggedOut) {
        return (
            <Tooltip title={t("words.log_in_or_create_an_account_to_2")} arrow>
                <span style={ST_D_INLINE_FLEX}>{button}</span>
            </Tooltip>
        );
    }

    return button;
}

// Number Component (from PaperCardActions)
function Number({
                    classes,
                    count,
                    isVoted,
                    onClick,
                }) {
    return (
        <span
            onClick={onClick}
            className={'monospace ' + (isVoted ? classes.voted : classes.vote)}
            style={ST_CUR_POINTER__MR_NEG4__ML_4}
        >
            {count}
        </span>
    );
}

// CommentVoteActions Component
function CommentVoteActions({
                                classes,
                                upvoteLoading,
                                downvoteLoading,
                                voted,
                                voteNonce = 0,
                                handleUpvote,
                                handleDownvote,
                                upVotesNumber,
                                downVotesNumber,
                                triggerPositiveVotes,
                                triggerNegativeVotes,
                                numberReplies,
                                onShowReplies,
                                canShowReplies,
                                onReply,
                                loggedOut,
                            }) {
    return (
        <div className={classes.voteActions}>
            <VoteButton
                classes={classes}
                direction="up"
                isVoted={voted > 0}
                isLoading={upvoteLoading}
                onVote={handleUpvote}
                disabled={upvoteLoading || downvoteLoading}
                loggedOut={loggedOut}
                voteNonce={voteNonce}
            />
            <Number
                classes={classes}
                count={upVotesNumber}
                isVoted={voted > 0}
                onClick={triggerPositiveVotes}
            />
            <VoteButton
                classes={classes}
                direction="down"
                isVoted={voted < 0}
                isLoading={downvoteLoading}
                onVote={handleDownvote}
                disabled={upvoteLoading || downvoteLoading}
                loggedOut={loggedOut}
                voteNonce={voteNonce}
            />
            <Number
                classes={classes}
                count={downVotesNumber}
                isVoted={voted < 0}
                onClick={triggerNegativeVotes}
            />
            <span style={ST_ML_AUTO__D_FLEX__AI_CENTER}>
                {canShowReplies && numberReplies > 0 && (
                    <Tooltip arrow title={t("components.comment_in_list.show_all_replies")}>
                        <span
                            className={classes.replyTextPointer}
                            onClick={onShowReplies}
                        >
                            {t("components.comment_in_list.show_replies", {
                                numberReplies: numberReplies
                            })}
                        </span>
                    </Tooltip>
                )}
                <Tooltip arrow title={t("components.comment_in_list.reply_to_the_comment")}>
                    <IconButton aria-label={t("components.comment_in_list.reply_to_comment")} onClick={onReply} size="small">
                        <ReplyRounded className={classes.replyButton} />
                    </IconButton>
                </Tooltip>
            </span>
        </div>
    );
}

class CommentInList extends React.PureComponent {

    constructor(props) {
        super(props);

        // Resolve initial vote from active_votes
        const initialVoted = this._resolve_initial_voted(props.data, props.account);

        this.st4te = {
            classes: props.classes,
            data: props.data,
            api: props.api || null,
            account: props.account || null,
            visible: props.visible,
            is_scrolling: props.is_scrolling,
            selected: props.selected,
            column_width: props.column_width,
            key: props.key,
            id: props.id,
            rowIndex: props.rowIndex,
            columnIndex: props.columnIndex,
            style: props.style || {},
            _history: HISTORY,
            _root: undefined,
            _has_been_visible: false,
            voted: initialVoted,
            _initialVoted: initialVoted,
            // Bumped only by a vote that succeeded in this session; the sole
            // trigger for the vote-button animation.
            _voteNonce: 0,
            upvoteLoading: false,
            downvoteLoading: false,
            _menu_anchor: null,
            depth: props.depth || 0,
            _loadedReplies: undefined,
            _repliesLoading: false,
        };
    };

    componentDidMount() {
        this._maybe_load_replies();
    }

    componentWillReceiveProps(new_props) {
        var must_init = !this.st4te._init;
        var id_changed = new_props.id !== this.st4te.id;
        var is_scrolling_changed = new_props.is_scrolling !== this.st4te.is_scrolling;
        var visible_changed = new_props.visible !== this.st4te.visible;
        var column_width_changed = new_props.column_width !== this.st4te.column_width;
        var style_changed = column_width_changed;
        var selected_changed = new_props.selected !== this.st4te.selected;
        var locales_changed = new_props.locales !== this.st4te.locales;
        var api_changed = new_props.api !== this.st4te.api;
        var account_changed = new_props.account !== this.st4te.account;
        var data_changed = new_props.data !== this.st4te.data;

        var cb = () => {}

        // Always sync api/account
        const extraState = {};
        if (api_changed) extraState.api = new_props.api;
        if (account_changed) extraState.account = new_props.account;

        // Re-resolve vote state when data or account changes
        if (data_changed || account_changed || id_changed) {
            const resolved = this._resolve_initial_voted(new_props.data, new_props.account || this.st4te.account);
            extraState.voted = resolved;
            extraState._initialVoted = resolved;
        }

        // When the underlying comment changes *identity* (different permlink),
        // drop any replies we lazily loaded for the previous one so they re-fetch.
        // A new object for the *same* comment — e.g. a silent background refresh —
        // keeps its loaded replies, so we don't re-hit the network on every poll.
        if (data_changed || id_changed) {
            const prevPermlink = (this.st4te.data || {}).permlink || "";
            const nextPermlink = (new_props.data || {}).permlink || "";
            if (prevPermlink !== nextPermlink) {
                extraState._loadedReplies = undefined;
                extraState._repliesLoading = false;
            }
        }

        if(must_init || visible_changed || id_changed || is_scrolling_changed || style_changed || selected_changed || locales_changed || api_changed || account_changed || data_changed){
            this.setSt4te({...new_props, ...extraState, ...{_has_been_visible: visible_changed || this.st4te._has_been_visible, _init: true}}, () => {
                if (must_init || visible_changed || is_scrolling_changed || selected_changed || locales_changed || data_changed) {
                    this.forceUpdate(cb);
                }else if(style_changed){
                    if(typeof this.st4te._root !== "undefined"){
                        var style = new_props.style;
                        this.st4te._root.style.width = style.width + "px";
                        this.st4te._root.style.height = style.height + "px";
                        cb();
                    }else {
                        this.forceUpdate(cb);
                    }
                }
                this._maybe_load_replies();
            });
        }
    }

    setSt4te = (state, callback) => {
        this.st4te = Object.assign(this.st4te, state);
        if(typeof callback == "function"){
            callback();
        }
    }

    _set_root_ref = (element) => {
        if(element === null) { return}
        this.setSt4te({_root: element});
    };

    _open_author = (username) => {
        this.st4te._history.push("/@"+username);
    }

    _show_replies = () => {
        const data = this.st4te.data || {};
        if((data.children || 0) > 0) {
            // Hand the clicked comment (the *parent* of the replies we want to
            // reveal) up to the host. The host re-roots the thread on it, so the
            // Hand the clicked comment up to the host together with its ancestors
            // that are shown inline but aren't in the breadcrumb yet (its
            // inline-shown parents, root-first). The host re-roots the thread on
            // the clicked comment, so it becomes the new top level and its own
            // replies become the next visible
            // level — and the breadcrumb now reflects the full path (…<-parent<-clicked)
            // instead of dropping a level.
            this.props.onShowReplies && this.props.onShowReplies(data, this._ancestor_path());
        }
    };

    // Inline replies render MAX_VISIBLE_DEPTH levels deep, so a nested reply's
    // inline-shown ancestors (its depth-0 root, depth-1 parent, ...) are on
    // screen but not yet in the host's breadcrumb. Surface the whole chain,
    // root-first, so navigation records the complete path rather than skipping
    // levels. `parentData` is kept as a single-ancestor fallback.
    _ancestor_path = () => {
        if (Array.isArray(this.props.ancestorChain)) return this.props.ancestorChain;
        const parent = this.props.parentData;
        return parent ? [parent] : [];
    };

    // Global comment identity — the same "author/permlink" key the focus
    // deep-link encodes (see buildCommentFocusHash in utils/constants).
    _comment_key = (d) => {
        const c = d || {};
        return ((c.username || (c.author || {}).username || "") + "/" + (c.permlink || ""));
    };

    _is_focused = () => !!this.props.focusKey && this._comment_key(this.st4te.data) === this.props.focusKey;

    _is_on_focus_path = () => {
        const keys = this.props.focusPathKeys;
        return Array.isArray(keys) && keys.indexOf(this._comment_key(this.st4te.data)) !== -1;
    };

    // Replies may be supplied eagerly on the data object as `data.replies`, or
    // fetched lazily via an `onLoadReplies(data) => Promise<replies[]>` prop.
    _get_replies = () => {
        const data = this.st4te.data || {};
        if (Array.isArray(data.replies)) return data.replies;
        if (Array.isArray(this.st4te._loadedReplies)) return this.st4te._loadedReplies;
        return [];
    };

    _maybe_load_replies = () => {
        const depth = this.st4te.depth || 0;
        const data = this.st4te.data || {};

        // Only levels that render replies inline need the data, and only when the
        // comment actually has replies to show.
        const wantsInlineReplies = depth < (MAX_VISIBLE_DEPTH - 1) && (data.children || 0) > 0;
        if (!wantsInlineReplies) return;

        // Already have them (eagerly or from a prior load), or already loading.
        if (Array.isArray(data.replies)) return;
        if (Array.isArray(this.st4te._loadedReplies) || this.st4te._repliesLoading) return;

        const loader = this.props.onLoadReplies;
        if (typeof loader !== "function") return;

        this.setSt4te({ _repliesLoading: true }, () => { this.forceUpdate(); });

        Promise.resolve(loader(data))
            .then((replies) => {
                this.setSt4te(
                    { _loadedReplies: Array.isArray(replies) ? replies : [], _repliesLoading: false },
                    () => { this.forceUpdate(); }
                );
            })
            .catch((e) => {
                console.warn("[CommentInList] failed to load replies:", e && e.message);
                this.setSt4te({ _loadedReplies: [], _repliesLoading: false }, () => { this.forceUpdate(); });
            });
    };

    /**
     * Rendered + sanitised body, cached per (api, body). This node re-renders on
     * scroll-state flips, visibility, hover-focus, votes and reply loads — and
     * every one of those re-ran the WASM markdown render AND a second safeHTML
     * pass over the result. The body string is immutable for a given comment,
     * so the cache invalidates only when the comment is edited or the slot is
     * re-pointed at another comment.
     */
    _body_html = (api, body) => {
        if (this._bodyCacheBody !== body || this._bodyCacheApi !== api) {
            this._bodyCacheBody = body;
            this._bodyCacheApi = api;
            this._bodyCacheHtml = safeHTML(renderCommentBody(api, body));
        }
        return this._bodyCacheHtml;
    };

    /** Locale-formatted date for the timestamp tooltip, cached per (date, locales). */
    _date_tooltip = (date, locales) => {
        if (this._dateCacheDate !== date || this._dateCacheLocales !== locales) {
            this._dateCacheDate = date;
            this._dateCacheLocales = locales;
            this._dateCacheText = new Date(date).toLocaleDateString(locales, DATE_TOOLTIP_FORMAT);
        }
        return this._dateCacheText;
    };

    /** Stable avatar/name click handler — was two fresh closures per render. */
    _open_comment_author = () => {
        const author = (this.st4te.data || {}).author || {};
        this._open_author(author.username);
    };

    _render_reply = (reply, connectorAbove, connectorOnPath) => {
        const { classes, api, account, locales, is_scrolling } = this.st4te;
        const depth = this.st4te.depth || 0;
        const key = (reply && (reply.permlink || reply.id))
            || (reply && reply.author && reply.author.username)
            || undefined;

        // Recurse with the *raw* class and pass `classes` explicitly: withStyles
        // is only applied to the default export, so nested instances would not
        // otherwise receive the injected classes. Grid-only props (style,
        // column_width, rowIndex...) are intentionally omitted — nested replies
        // are not virtualization cells.
        return (
            <CommentInList
                key={key}
                classes={classes}
                data={reply}
                api={api}
                account={account}
                locales={locales}
                is_scrolling={is_scrolling}
                depth={depth + 1}
                parentData={this.st4te.data}
                ancestorChain={(Array.isArray(this.props.ancestorChain) ? this.props.ancestorChain : []).concat([this.st4te.data])}
                onShowReplies={this.props.onShowReplies}
                onReply={this.props.onReply}
                onEdit={this.props.onEdit}
                onDelete={this.props.onDelete}
                onLoadReplies={this.props.onLoadReplies}
                focusKey={this.props.focusKey}
                focusPathKeys={this.props.focusPathKeys}
                connectorAbove={connectorAbove}
                connectorOnPath={connectorOnPath}
            />
        );
    };

    _handle_reply = () => {
        this.props.onReply && this.props.onReply(this.st4te.data, this._ancestor_path());
    };

    // ── Owner 3-dot menu (edit / delete own comment) ───────────────────
    _open_menu = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        this.setSt4te({ _menu_anchor: e.currentTarget }, () => { this.forceUpdate(); });
    };

    _close_menu = () => {
        this.setSt4te({ _menu_anchor: null }, () => { this.forceUpdate(); });
    };

    _handle_edit = () => {
        const data = this.st4te.data;
        this.setSt4te({ _menu_anchor: null }, () => { this.forceUpdate(); });
        this.props.onEdit && this.props.onEdit(data);
    };

    _handle_delete = () => {
        const data = this.st4te.data;
        this.setSt4te({ _menu_anchor: null }, () => { this.forceUpdate(); });
        this.props.onDelete && this.props.onDelete(data);
    };

    // The menu only exists for the comment's own author — and only when the
    // parent dialog actually wired the edit/delete handlers (modifications
    // are dialog-only by design).
    _is_own_comment = () => {
        const { data, account } = this.st4te;
        if (!account || !data) return false;
        const authorUsername = (data.author || {}).username || data.username || "";
        return !!authorUsername && authorUsername === account;
    };

    _resolve_initial_voted = (data, account) => {
        if (!account || !data || !Array.isArray(data.active_votes)) return 0;
        const myVote = data.active_votes.find(v => v && v.voter === account);
        // rshares first, then percent/weight — see voteSign in utils/voteValue.
        return myVote ? voteSign(myVote) : 0;
    }

    _resolveVoter = () => {
        const { account, api } = this.st4te;
        if (account) return account;
        if (api) {
            if (api.keyManager && api.keyManager.activeAccount) return api.keyManager.activeAccount;
            if (api.keyManager && api.keyManager.getActiveAccount) {
                const km = api.keyManager.getActiveAccount();
                if (km) return km;
            }
            if (api.sessionManager && api.sessionManager.currentAccount) return api.sessionManager.currentAccount;
        }
        return null;
    }

    _handleUpvote = () => {
        const { api, data, voted, upvoteLoading, downvoteLoading } = this.st4te;
        if (upvoteLoading || downvoteLoading) return;

        const voter = this._resolveVoter();
        if (!voter) return;
        if (!api) return;

        const authorUsername = data.username || (data.author || {}).username || "";
        const permlink = data.permlink;
        if (!authorUsername || !permlink) return;

        const newVoted = voted !== 1 ? 1 : 0;
        const weight = newVoted === 1 ? 10000 : 0;

        this.setSt4te({ upvoteLoading: true }, () => { this.forceUpdate(); });

        api.broadcast.vote(voter, authorUsername, permlink, weight)
            .then((res) => {
                // res.outcome: 'nothing' | 'positive' | 'negative' | 'withdrawal'
                if (!res || res.outcome === 'nothing') {
                    // cancelled — clear the loading flag, leave the vote unchanged
                    this.setSt4te({ upvoteLoading: false }, () => { this.forceUpdate(); });
                    return;
                }
                const w = res.weight || 0;
                this.setSt4te({
                    voted: w > 0 ? 1 : w < 0 ? -1 : 0,
                    _voteNonce: (this.st4te._voteNonce || 0) + 1,
                    upvoteLoading: false,
                }, () => { this.forceUpdate(); });
            })
            .catch((e) => {
                console.warn('[CommentInList] upvote failed:', e.message);
                actions.trigger_snackbar(t("components.comment_in_list.vote_failed"));
                this.setSt4te({ upvoteLoading: false }, () => { this.forceUpdate(); });
            });
    };

    _handleDownvote = () => {
        const { api, data, voted, upvoteLoading, downvoteLoading } = this.st4te;
        if (upvoteLoading || downvoteLoading) return;

        const voter = this._resolveVoter();
        if (!voter) return;
        if (!api) return;

        const authorUsername = data.username || (data.author || {}).username || "";
        const permlink = data.permlink;
        if (!authorUsername || !permlink) return;

        const newVoted = voted !== -1 ? -1 : 0;
        const weight = newVoted === -1 ? -10000 : 0;

        this.setSt4te({ downvoteLoading: true }, () => { this.forceUpdate(); });

        api.broadcast.vote(voter, authorUsername, permlink, weight)
            .then((res) => {
                // res.outcome: 'nothing' | 'positive' | 'negative' | 'withdrawal'
                if (!res || res.outcome === 'nothing') {
                    // cancelled — clear the loading flag, leave the vote unchanged
                    this.setSt4te({ downvoteLoading: false }, () => { this.forceUpdate(); });
                    return;
                }
                const w = res.weight || 0;
                this.setSt4te({
                    voted: w > 0 ? 1 : w < 0 ? -1 : 0,
                    _voteNonce: (this.st4te._voteNonce || 0) + 1,
                    downvoteLoading: false,
                }, () => { this.forceUpdate(); });
            })
            .catch((e) => {
                console.warn('[CommentInList] downvote failed:', e.message);
                actions.trigger_snackbar(t("components.comment_in_list.vote_failed"));
                this.setSt4te({ downvoteLoading: false }, () => { this.forceUpdate(); });
            });
    };

    // Voter lists for a comment — the same VotingListModal the post cards
    // open (Index.js → openVotingList), so each vote shows what it is worth.
    // The viewer's own fresh vote rides along as a priced placeholder row.
    _open_votes_list = (sign) => {
        const data = this.st4te.data || {};
        actions.trigger_votes({
            sign,
            votes: votesWithLocalVote(data.active_votes, this._resolveVoter(), this.st4te.voted),
            voter_profiles: data._voter_profiles || {},
        });
    };

    _triggerPositiveVotes = () => { this._open_votes_list('+'); };

    _triggerNegativeVotes = () => { this._open_votes_list('-'); };

    render() {
        const {
            classes,
            style,
            id,
            locales,
            selected,
            is_scrolling,
            _has_been_visible,
            voted,
            _initialVoted,
            upvoteLoading,
            downvoteLoading
        } = this.st4te;

        const data = this.st4te.data || {};
        const author = data.author || {};
        const numberReplies = data.children || 0;
        const showOwnerMenu = this._is_own_comment()
            && (typeof this.props.onEdit === "function" || typeof this.props.onDelete === "function");

        const depth = this.st4te.depth || 0;
        const replies = this._get_replies();
        // Levels above the deepest visible one render their replies inline, so
        // they never need the "Show Replies" affordance. Only the deepest
        // visible level (depth MAX_VISIBLE_DEPTH - 1) offers it, since that
        // level's own replies are not rendered.
        const renderRepliesInline = depth < (MAX_VISIBLE_DEPTH - 1) && replies.length > 0;
        const showRepliesButton = depth >= (MAX_VISIBLE_DEPTH - 1) && numberReplies > 0;
        const repliesLoading = !!this.st4te._repliesLoading;

        // Delta from initial state — avoids double-counting votes already in data counts
        const upVotesNumber = (data.upVotesNumber || 0) + (voted === 1 ? 1 : 0) - (_initialVoted === 1 ? 1 : 0);
        const downVotesNumber = (data.downVotesNumber || 0) + (voted === -1 ? 1 : 0) - (_initialVoted === -1 ? 1 : 0);

        // Deep-linked focus ("#replies&focus=…"): the pinned comment keeps its
        // hover look permanently, and an on-path ANCESTOR brightens the stem
        // that drops into the replies leading to it.
        const commentKey = this._comment_key(data);
        const isFocused = this._is_focused();
        const onFocusPath = isFocused || this._is_on_focus_path();

        const commentItem = (
            <ListItem
                key={id}
                className={classes.card
                    + (renderRepliesInline ? " " + classes.cardHasReplies : "")
                    + (renderRepliesInline && onFocusPath && !isFocused ? " " + classes.cardHasRepliesFocusPath : "")
                    + (isFocused ? " " + classes.cardFocused : "")
                    + (selected ? " Mui-selected": "")}
                alignItems="flex-start"
                component={depth > 0 ? "div" : "li"}
            >
                <ListItemAvatar>
                    <Avatar
                        alt={author.name}
                        onClick={this._open_comment_author}
                        src={author.image}
                    />
                </ListItemAvatar>
                <ListItemText
                    primary={
                        <span style={ST_D_FLEX__AI_FLEX_START}>
                            <Typography
                                component="span"
                                variant="body2"
                                color="textPrimary"
                                style={ST_MB_4__D_BLOCK__FLEX_1}
                            >
                                <Tooltip title={"@"+(author.username || "")}>
                                    <span
                                        className={classes.subheaderName}
                                        onClick={this._open_comment_author}
                                    >
                                        {author.name && author.name !== author.username ? author.name : ("@" + (author.username || ""))}
                                    </span>
                                </Tooltip>
                                <span style={ST_C_999}> said </span>
                                <Tooltip arrow title={this._date_tooltip(data.date, locales)}>
                                    <LiveTimeAgoSpan date={data.date} />
                                </Tooltip>
                            </Typography>
                            {showOwnerMenu && (
                                <Tooltip arrow title={t("components.comment_in_list.comment_options")}>
                                    <IconButton
                                        size="small"
                                        className={classes.menuButton}
                                        aria-label={t("components.comment_in_list.comment_options")}
                                        onClick={this._open_menu}
                                    >
                                        <MoreVertRounded fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            )}
                            {showOwnerMenu && (
                                <Menu
                                    className={classes.ownerMenu}
                                    anchorEl={this.st4te._menu_anchor}
                                    open={Boolean(this.st4te._menu_anchor)}
                                    onClose={this._close_menu}
                                    keepMounted={false}
                                    MenuListProps={{ dense: true }}
                                >
                                    {typeof this.props.onEdit === "function" && (
                                        <MenuItem onClick={this._handle_edit}>
                                            <ListItemIcon>
                                                <EditRounded fontSize="small" />
                                            </ListItemIcon>
                                            <ListItemText primary={<span style={ST_C_DDD__FS_14}>{t("components.comment_in_list.edit_comment")}</span>} />
                                        </MenuItem>
                                    )}
                                    {typeof this.props.onDelete === "function" && (
                                        <MenuItem onClick={this._handle_delete}>
                                            <ListItemIcon>
                                                <DeleteOutlineRounded fontSize="small" />
                                            </ListItemIcon>
                                            <ListItemText primary={<span style={ST_C_DDD__FS_14}>{t("components.comment_in_list.delete_comment")}</span>} />
                                        </MenuItem>
                                    )}
                                </Menu>
                            )}
                        </span>
                    }
                    secondary={
                        <React.Fragment>
                            <Typography
                                component="span"
                                variant="body1"
                                color="textSecondary"
                                style={ST_LH_1REM__LS_0__D_BLOCK}
                                dangerouslySetInnerHTML={{__html: safeHTML(this._body_html(this.st4te.api, data.body))}}
                            />

                            {/* Keyed by comment identity: when a host reuses this
                                slot for a DIFFERENT comment (index-keyed lists on
                                sort change, recycled grid cells), the vote buttons
                                remount and silently re-baseline — mounting state
                                never animates. Only a genuine false -> true vote
                                transition on the SAME comment fires the bounce. */}
                            <CommentVoteActions
                                key={(data.username || (data.author || {}).username || "") + "/" + (data.permlink || "")}
                                classes={classes}
                                voted={voted}
                                voteNonce={this.st4te._voteNonce || 0}
                                upvoteLoading={upvoteLoading}
                                downvoteLoading={downvoteLoading}
                                handleUpvote={this._handleUpvote}
                                handleDownvote={this._handleDownvote}
                                upVotesNumber={upVotesNumber}
                                downVotesNumber={downVotesNumber}
                                triggerPositiveVotes={this._triggerPositiveVotes}
                                triggerNegativeVotes={this._triggerNegativeVotes}
                                numberReplies={numberReplies}
                                onShowReplies={this._show_replies}
                                canShowReplies={showRepliesButton}
                                onReply={this._handle_reply}
                                loggedOut={!this.st4te.account}
                            />
                        </React.Fragment>
                    }
                />
            </ListItem>
        );

        // Inline subtree: every level below the cap renders its own replies
        // (and their loading indicator), so intermediate levels branch exactly
        // like the root does.
        // Which child (if any) continues the focus path: its elbow brightens,
        // and the trunk running through every sibling ABOVE it brightens too,
        // so the lit line is continuous from this node down to the target.
        const fkeys = this.props.focusPathKeys;
        let focusChildIdx = -1;
        if (renderRepliesInline && Array.isArray(fkeys) && fkeys.length) {
            focusChildIdx = replies.findIndex((r) => fkeys.indexOf(this._comment_key(r)) !== -1);
        }
        const inlineReplies = renderRepliesInline && (
            <div className={classes.repliesContainer}>
                {replies.map((reply, i) => this._render_reply(
                    reply,
                    focusChildIdx !== -1 && i < focusChildIdx,
                    i === focusChildIdx
                ))}
            </div>
        );
        const repliesLoadingIndicator = repliesLoading && (
            <div className={classes.repliesLoading}>
                <CircularProgress size={18} thickness={4} style={ST_C_888} />
                <span style={ST_ML_8}>{t("components.comment_in_list.loading_replies")}</span>
            </div>
        );

        // Nested replies are not virtualization cells, so they render without the
        // host's grid style. Each one is wrapped in a replyNode that draws its tree
        // connector — and carries its own subtree. The root (depth 0) owns the
        // measured row and carries the ref the host uses to size it.
        if (depth > 0) {
            return (
                <div
                    className={classes.replyNode
                        + (this.props.connectorOnPath ? " " + classes.replyNodeFocusElbow : "")
                        + (this.props.connectorAbove ? " " + classes.replyNodeFocusTrunk : "")}
                    data-comment-key={commentKey}
                >
                    {commentItem}
                    {inlineReplies}
                    {repliesLoadingIndicator}
                </div>
            );
        }

        return (
            <div ref={this._set_root_ref} className={classes.commentNode} data-comment-key={commentKey}>
                {commentItem}
                {inlineReplies}
                {repliesLoadingIndicator}
            </div>
        );
    }
}

export default withLanguage(withStyles(styles)(CommentInList));