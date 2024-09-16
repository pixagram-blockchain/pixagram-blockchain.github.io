import * as React from 'preact/compat';
import { h } from 'preact';
import { useState, useRef, useLayoutEffect } from 'preact/hooks';

import withStyles from '@material-ui/core/styles/withStyles';
import IconButton from '@material-ui/core/IconButton';
import CardActions from '@material-ui/core/CardActions';
import Tooltip from '@material-ui/core/Tooltip';
import CircularProgress from '@material-ui/core/CircularProgress';
import CommentRounded from '@material-ui/icons/CommentRounded';
import ArrowUpDropCircle from '../icons/ArrowUpDropCircle';
import ArrowUpDropCircleOutline from '../icons/ArrowUpDropCircleOutline';
import ArrowDownDropCircle from '../icons/ArrowDownDropCircle';
import ArrowDownDropCircleOutline from '../icons/ArrowDownDropCircleOutline';
import PixaSupra from '../icons/PixaSupra';
import PayoutSankey from './PayoutSankey';
import { usePrices } from '../hooks/usePrices';

import { t } from "../utils/text";

const styles = theme => ({
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
    comments: {
        color: '#888',
        transition: 'color 275ms cubic-bezier(0.4, 0, 0.2, 1) 5ms',
        '&:hover': {
            color: '#bbb',
            transition: 'color 275ms cubic-bezier(0.4, 0, 0.2, 1) 5ms',
        },
    },
    payout: {
        pointer: 'cursor',
        marginLeft: 'auto',
        marginRight: 8,
        fontSize: "18px",
        color: '#555',
        fontWeight: '500',
    },
    // Right-aligned two-line payout stack: PXS amount on top, the same value
    // converted to the user's display currency underneath.
    payoutWrap: {
        marginLeft: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        lineHeight: 1.1,
        cursor: 'pointer',
    },
    payoutFiat: {
        marginRight: 11,
        marginTop: 2,
        fontSize: '12px',
        fontWeight: 400,
        color: '#ccc',
        transition: 'color 275ms cubic-bezier(0.4, 0, 0.2, 1) 5ms',
        '&:hover': {
            color: '#fff',
            transition: 'color 275ms cubic-bezier(0.4, 0, 0.2, 1) 5ms',
        },
    },
    actions: {
        color: '#666',
        '& .MuiIconButton-root': { padding: '12px 12px 12px 12px' },
    },
    tooltipRoot: {
        maxWidth: 'min(90vw, 300px)',
        backgroundColor: '#1a1a1a !important',
        borderRadius: '12px',
        color: '#ccc !important',
        padding: '8px 4px !important',
        boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
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

    // --- Floating vote feedback ("+1" rises, "-1" falls) ---------------------
    // Standard JSS keyframes (scoped via $ref). They play once per fresh vote.
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
});

// VoteButton Component
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
    // Animation is driven by voteNonce, never derived from isVoted.
    //
    // Deriving it from a false -> true crossing looked equivalent but wasn't. That
    // crossing also happens when a card is *re-pointed* at a different post — a
    // sort change recycles keyed rows rather than remounting them — and when a
    // background refresh surfaces a vote the card didn't know about. Both are
    // first appearance, not user intent, and both used to bounce.
    //
    // The parent bumps voteNonce only inside a vote callback that succeeded, so a
    // change in it is proof of intent. The value present at mount is the silent
    // baseline, which covers a vote hydrated from active_votes and the remount
    // that a post-identity change forces (see the key= in VoteButtons below).
    const [animate, setAnimate] = useState(false);
    const [floats, setFloats] = useState([]);
    const prevNonce = useRef(voteNonce); // baseline = whatever we mounted with
    const idCounter = useRef(0);

    // useLayoutEffect so the class swap to votedAnimated and the float insertion
    // happen before paint — no intermediate static frame, so the bounce is clean.
    useLayoutEffect(() => {
        if (voteNonce !== prevNonce.current) {
            prevNonce.current = voteNonce;
            if (isVoted) {
                // the user cast this vote just now, on this post
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
        // Grow only for a vote cast in this session, on this post; hydrated
        // votes and re-pointed rows stay static.
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
                <span style={{ display: 'inline-flex' }}>{button}</span>
            </Tooltip>
        );
    }

    return button;
}

// Number Component
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
            style={{ cursor: 'pointer', marginRight: 4, marginLeft: -4 }}
        >
            {count}
        </span>
    );
}

// Comments Component
function Comments({ classes, commentsNumber, onCommentsClick }) {
    const disabled = typeof onCommentsClick !== 'function';
    const handleClick = disabled ? undefined : onCommentsClick;
    return (
        <>
            <IconButton
                className={classes.comments}
                aria-label={t("words.comments")}
                onClick={handleClick}
                disabled={disabled}
                style={disabled ? { opacity: 0.5 } : undefined}
            >
                <CommentRounded />
            </IconButton>
            <span
                onClick={handleClick}
                className={'monospace ' + classes.comments}
                style={{
                    cursor: disabled ? 'default' : 'pointer',
                    marginRight: 4,
                    marginLeft: -4,
                    opacity: disabled ? 0.5 : 1,
                }}
            >
                {commentsNumber}
            </span>
        </>
    );
}

// Payout Component — uses PayoutSankey inside the tooltip
function Payout({ classes, payout, data, pxsUsdPrice, pxaUsdPrice, currency, fiatRate }) {
    // The headline figure is the pending payout in PXS. Underneath we show the
    // same value in the user's display currency: payout(PXS) × USD/PXS × rate.
    // NOTE: a local component named `Number` shadows the global in this module,
    // so `Number.isFinite`/`Number(...)` are unavailable here — use the global
    // `isFinite` and plain coercion-free guards instead.
    const rate = (isFinite(fiatRate) && fiatRate > 0) ? fiatRate : 1;
    const cur = currency || 'USD';
    const pxsRate = (isFinite(pxsUsdPrice) && pxsUsdPrice > 0) ? pxsUsdPrice : 5.69;
    const fiatValue = (payout * pxsRate * rate).toFixed(2);

    return (
        <Tooltip
            interactive
            arrow
            enterTouchDelay={200}
            leaveTouchDelay={5000}
            disableTouchListener={false}
            classes={{ tooltip: classes.tooltipRoot }}
            title={
                <PayoutSankey
                    payout={payout}
                    data={data}
                    pxsUsdPrice={pxsUsdPrice}
                    pxaUsdPrice={pxaUsdPrice}
                    currency={cur}
                    fiatRate={rate}
                />
            }
        >
            <span className={classes.payoutWrap}>
                <span className={classes.payout + " monospace"}>
                    {payout.toFixed(1)} <PixaSupra style={{ width: '24px', height: '24px', verticalAlign: 'bottom' }} />
                </span>
                <span className={classes.payoutFiat + " monospace"}>
                    <span style={{opacity: 0.666}}>≈</span> {fiatValue} {cur}
                </span>
            </span>
        </Tooltip>
    );
}

// VoteButtons Component
function VoteButtons({
                         classes,
                         api,
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
                         commentsNumber,
                         onCommentsClick,
                         showComments = false,
                         payout,
                         data,
                         style,
                         voter,
                     }) {
    // Prices live on api.prices (the witness-feed-derived values with design fallback).
    // Hook pulls the current snapshot and re-renders when prices change live. It
    // also surfaces the user's display currency and the USD→currency rate so the
    // payout can be shown in local money.
    const { pxsUsdPrice, pxaUsdPrice, currency, fiatRate } = usePrices(api);

    const loggedOut = !voter;

    // Identity of the post these buttons belong to. Sorting recycles keyed rows,
    // so a live VoteButton can be handed a different post; keying on identity
    // remounts it with a clean baseline and no leftover floating labels instead.
    // CommentInList already keys its vote row exactly this way.
    const d = data || {};
    const voteKey = (d.username || (d.author || {}).username || '')
        + '/' + (d.permlink || d.id || '');

    return (
        <CardActions disableSpacing className={classes.actions} style={style}>
            <VoteButton
                key={'up:' + voteKey}
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
                key={'down:' + voteKey}
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
            {showComments && (
                <Comments
                    classes={classes}
                    commentsNumber={commentsNumber}
                    onCommentsClick={onCommentsClick}
                />
            )}
            <Payout
                classes={classes}
                payout={payout}
                data={data}
                pxsUsdPrice={pxsUsdPrice}
                pxaUsdPrice={pxaUsdPrice}
                currency={currency}
                fiatRate={fiatRate}
            />
        </CardActions>
    );
}

// Main PaperCardActions Component
function PaperCardActions(props) {
    return <VoteButtons {...props} />;
}

export default withStyles(styles)(PaperCardActions);