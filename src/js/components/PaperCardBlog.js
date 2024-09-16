import * as React from 'preact/compat';
import { h } from 'preact';
import { memo } from 'preact/compat';
import { useCallback, useMemo, useRef, useState } from 'preact/hooks';
import withStyles from '@material-ui/core/styles/withStyles';
import Card from '@material-ui/core/Card';
import CardHeader from '@material-ui/core/CardHeader';
import CardContent from '@material-ui/core/CardContent';
import Avatar from '@material-ui/core/Avatar';
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import Chip from '@material-ui/core/Chip';
import ButtonBase from '@material-ui/core/ButtonBase';
import MoreVert from '@material-ui/icons/MoreVert';
import useLiveTimeAgo from '../hooks/useLiveTimeAgo';
import { HISTORY } from '../utils/constants';
import * as actions from '../actions/utils';
import PaperCardActions from './PaperCardActions';
import ProfileHoverAnchor from './ProfileHoverCard';

import { t, useLanguage } from "../utils/text";

const styles = theme => ({
    card: {
        width: '100%',
        marginTop: '24px',
        userSelect: 'none',
        contain: 'style layout',
        willChange: 'auto',
        transform: 'translateZ(0)',
        '&.MuiCard-root': {
            overflow: 'hidden',
            backgroundColor: '#101010',
            transition:
                'background-color 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms, box-shadow 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms',
            padding: 0,
        },
        '&.MuiCard-root:hover': {
            backgroundColor: '#000000',
            boxShadow:
                '0px 2px 4px -1px rgb(0 0 0 / 20%), 0px 4px 5px 0px rgb(0 0 0 / 14%), 0px 1px 10px 0px rgb(0 0 0 / 12%)',
            transition:
                'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 10ms, box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1) 10ms',
        },
        '& .MuiCardActions-root': {
            fontFamily: 'Geist Mono',
            fontSize: '1.125rem',
            fontWeight: '300',
        },
    },
    // Applied when the post is muted by community moderators
    // (stats.hide or stats.gray). Grayscale+dim by default so the moderation
    // state is always visible at a glance; hover restores the full card so
    // users can still read the content on demand. Transition is smooth.
    cardMuted: {
        filter: 'grayscale(1) brightness(0.5)',
        transition: 'filter 225ms cubic-bezier(0.4, 0, 0.2, 1) !important',
        '&:hover': {
            filter: 'grayscale(0) brightness(1)',
            transition: 'filter 175ms cubic-bezier(0.4, 0, 0.2, 1) !important',
        },
    },
    cardLayout: {
        display: 'flex',
        minHeight: '200px',
        '@media (max-width: 1199px)': {
            flexDirection: 'column',
            minHeight: 'auto',
        },
    },
    imageContainer: {
        width: '360px',
        marginRight: 4,
        flexShrink: 0,
        position: 'relative',
        cursor: 'pointer',
        '@media (max-width: 1599px)': {
            width: '180px',
        },
        '@media (max-width: 1199px)': {
            display: 'none',
        },
    },
    imageContainerMobile: {
        display: 'none',
        width: '100%',
        height: '180px',
        marginRight: 0,
        marginLeft: 0,
        marginTop: 0,
        marginBottom: 16,
        flexShrink: 0,
        position: 'relative',
        cursor: 'pointer',
        '@media (max-width: 1199px)': {
            display: 'block',
        },
    },
    contentContainer: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: '200px',
        '@media (max-width: 1199px)': {
            minHeight: 'auto',
        },
    },
    cardHeader: {
        padding: "16px 16px 8px 16px",
        '& .MuiCardHeader-title': {
            fontWeight: 'bold',
            fontFamily: '"Industry Book", "Normative Pro"',
            color: '#ddd',
            cursor: 'pointer',
            fontSize: '1.125rem',
            lineHeight: '1.25rem',
        },
        '& .MuiCardHeader-subheader': {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '4px',
            "& .MuiSvgIcon-root": {
                fontSize: "1rem"
            }
        },
        '& .MuiAvatar-root': {
            cursor: 'pointer',
            borderRadius: '21px',
            width: 64,
            height: 64,
        },
        '& .MuiCardHeader-avatar': {
            marginRight: '12px'
        },
        '& .MuiCardHeader-content': {
            overflow: 'hidden',
        }
    },
    subheaderName: {
        color: '#fff',
        cursor: 'pointer',
        fontWeight: '500',
    },
    subheaderBy: {
        color: '#aaa'
    },
    subheaderDate: {
        color: '#888',
        fontSize: '0.875rem',
    },
    subheaderReadingTime: {
        color: '#888',
        fontSize: '0.875rem',
    },
    cardContent: {
        padding: '8px 16px',
        flex: 1,
        cursor: 'pointer',
        '&:last-child': {
            paddingBottom: '16px',
        }
    },
    excerpt: {
        color: '#999',
        fontSize: '0.9375rem',
        lineHeight: '1.25rem',
        marginBottom: '0px',
        display: '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    metadata: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        marginTop: '12px',
        color: '#888',
        fontSize: '0.875rem',
        flexWrap: 'wrap',
    },
    metaItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        '& svg': {
            width: '18px',
            height: '18px',
        }
    },
    tags: {
        display: 'none',
        //display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        marginTop: '12px',
    },
    tag: {
        display: 'none',
        height: '21px',
        fontSize: '0.75rem',
        backgroundColor: '#171717',
        color: '#999',
        borderRadius: '12px',
        padding: "0px 2px",
        '&:hover': {
            backgroundColor: '#1a1a1a',
            color: '#ccc',
        },
        '& .MuiChip-label': {
            paddingLeft: '8px',
            paddingRight: '8px',
        }
    },
    cardImage: {
        borderRadius: "24px",
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        position: 'absolute',
        top: 0,
        left: 0,
    },
    cardImageMobile: {
        borderRadius: '24px',
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        position: 'absolute',
        top: 0,
        left: 0,
    },
    cardImageElements: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        position: 'absolute',
        boxSizing: "border-box",
        top: 0,
        left: 0,
        padding: 16,
    },
    actions: {
        color: '#666',
        padding: '0px 16px 0px 4px',
        marginTop: 'auto',
        '& .MuiIconButton-root': {
            padding: '12px 12px 12px 12px'
        },
    },
    tooltipRoot: {
        maxWidth: 'min(67vw, 325px)',
        backgroundColor: '#0e0e0e !important',
        borderRadius: '16px',
        color: '#dddddd !important',
    },
});

function PaperCardBlog({
                           classes,
                           style,
                           data = {},
                           id,
                           locales,
                           onOpen,
                           onMenuClick,
                           onCommentsClick,
                           column_width,
                           voter,
                           api,
                           onVoteChange,
                           muted = false,
                       }) {
    // Behind memo(withStyles(...)(PaperCardBlog)) — a language swap changes no
    // prop, so without this the reading-time line keeps its old wording.
    useLanguage();
    // Live relative date — re-renders the card exactly when the label is
    // due to change (per-second under a minute old, per-minute under an
    // hour, per-hour under a day, then daily); watcher released on unmount.
    const liveTimeAgo = useLiveTimeAgo(data.date, { labels: 'narrow' });
    // Detect initial vote state from active_votes (reactive to external changes)
    const initialVoted = useMemo(() => {
        if (!voter || !Array.isArray(data.active_votes)) return 0;
        const myVote = data.active_votes.find(v => v && v.voter === voter);
        if (!myVote) return 0;
        if (myVote.weight < 0) return -1;
        return 1; // present in active_votes with weight >= 0 (or undefined) means upvoted
    }, [voter, data.active_votes]);

    // Identity of the post this instance is currently pointed at. A sort change
    // or a virtualized-row recycle re-points a live instance at a different post
    // instead of remounting it, so every piece of local vote state is scoped to
    // this rather than to the component's lifetime.
    const postKey = ((data.author || {}).username || '') + '/' + (data.permlink || data.id || '');

    // Optimistic vote, tagged with the post it was cast on and with the chain
    // value it was cast against. Read, not synced: when the instance is
    // re-pointed — or when the chain catches up, or the same post is voted from
    // BlogPostDialog — the tag stops matching and initialVoted is used directly, in
    // the same render as the new data. The useEffect this replaces corrected
    // `voted` one commit *after* the new post had already rendered, and that late
    // 0 -> 1 flip was what the vote buttons read as a freshly cast vote.
    const [localVote, setLocalVote] = useState(null); // { key, base, voted } | null

    // Bumped only by a vote that succeeded in this session. This is the only
    // thing that can make a vote button animate — see VoteButton in
    // PaperCardActions. Monotonic on purpose: it is never reset, because the
    // buttons remount (and re-baseline) when postKey changes.
    const [voteNonce, setVoteNonce] = useState(0);

    const local = (localVote && localVote.key === postKey && localVote.base === initialVoted)
        ? localVote
        : null;
    const voted = local ? local.voted : initialVoted; // -1, 0, +1

    const applyVote = useCallback((w) => {
        setLocalVote({ key: postKey, base: initialVoted, voted: w > 0 ? 1 : w < 0 ? -1 : 0 });
        setVoteNonce((n) => n + 1);
    }, [postKey, initialVoted]);

    const [upvoteLoading, setUpvoteLoading] = useState(false);
    const [downvoteLoading, setDownvoteLoading] = useState(false);
    const votingRef = useRef(false);

    const rootRef = useRef(null);
    const historyRef = useRef(HISTORY);

    const openAuthor = useCallback((username) => {
        historyRef.current.push('/@' + username);
    }, []);

    const openCommunity = useCallback((community) => {
        historyRef.current.push('/' + community);
    }, []);

    const handleUpvote = useCallback(() => {
        if (!voter) return;
        if (votingRef.current) return;
        const authorUsername = (data.author || {}).username;
        const permlink = data.permlink;
        if (!authorUsername || !permlink) return;

        votingRef.current = true;
        setUpvoteLoading(true);
        // Intent weight — when the weight dialog is enabled the user may change
        // the percentage, flip the sign, or cancel, so the optimistic state below
        // is driven by what vote() reports it *actually* did, not this guess.
        const newVoted = voted !== 1 ? 1 : 0;
        const weight = newVoted === 1 ? 10000 : 0;

        if (api) {
            api.broadcast.vote(voter, authorUsername, permlink, weight)
                .then((res) => {
                    // res.outcome: 'nothing' | 'positive' | 'negative' | 'withdrawal'
                    if (!res || res.outcome === 'nothing') return; // cancelled — leave UI as-is
                    const w = res.weight || 0;
                    applyVote(w);
                    if (onVoteChange) onVoteChange(permlink, voter, w);
                })
                .catch((e) => { console.warn('[PaperCardBlog] vote failed:', e.message); })
                .finally(() => { votingRef.current = false; setUpvoteLoading(false); });
        } else {
            votingRef.current = false;
            setUpvoteLoading(false);
        }
    }, [voted, api, voter, data, applyVote, onVoteChange]);

    const handleDownvote = useCallback(() => {
        if (!voter) return;
        if (votingRef.current) return;
        const authorUsername = (data.author || {}).username;
        const permlink = data.permlink;
        if (!authorUsername || !permlink) return;

        votingRef.current = true;
        setDownvoteLoading(true);
        // Intent weight — see handleUpvote: real outcome comes from vote()'s result.
        const newVoted = voted !== -1 ? -1 : 0;
        const weight = newVoted === -1 ? -10000 : 0;

        if (api) {
            api.broadcast.vote(voter, authorUsername, permlink, weight)
                .then((res) => {
                    // res.outcome: 'nothing' | 'positive' | 'negative' | 'withdrawal'
                    if (!res || res.outcome === 'nothing') return; // cancelled — leave UI as-is
                    const w = res.weight || 0;
                    applyVote(w);
                    if (onVoteChange) onVoteChange(permlink, voter, w);
                })
                .catch((e) => { console.warn('[PaperCardBlog] vote failed:', e.message); })
                .finally(() => { votingRef.current = false; setDownvoteLoading(false); });
        } else {
            votingRef.current = false;
            setDownvoteLoading(false);
        }
    }, [voted, api, voter, data, applyVote, onVoteChange]);

    // Compute active_votes reflecting current local vote state
    const currentActiveVotes = useMemo(() => {
        const base = (data.active_votes || []).filter(v => v && v.voter !== voter);
        if (voted === 1 && voter) {
            base.push({ voter, weight: 10000, rshares: '0', time: null });
        } else if (voted === -1 && voter) {
            base.push({ voter, weight: -10000, rshares: '0', time: null });
        }
        return base;
    }, [data.active_votes, voted, voter]);

    const triggerPositiveVotes = useCallback(() => actions.trigger_votes({sign: '+', votes: currentActiveVotes, voter_profiles: data._voter_profiles || {}}), [currentActiveVotes, data._voter_profiles]);
    const triggerNegativeVotes = useCallback(() => actions.trigger_votes({sign: '-', votes: currentActiveVotes, voter_profiles: data._voter_profiles || {}}), [currentActiveVotes, data._voter_profiles]);

    const handleMenuClick = useCallback((event) => {
        event.stopPropagation();
        onMenuClick?.(event, data);
    }, [onMenuClick, data]);

    const handleOpen = useCallback(() => {
        const rect = rootRef.current?.getBoundingClientRect() || {};
        onOpen?.(data, rect);
    }, [onOpen, data]);

    const handleCommentsClick = useCallback(() => {
        onCommentsClick?.(data);
    }, [onCommentsClick, data]);

    const author = data.author || {};
    const payout = parseFloat((data.payout || '').replace('$', '')) || 0;
    const upVotesNumber = (data.upVotesNumber || 0) + (voted === 1 ? 1 : 0) - (initialVoted === 1 ? 1 : 0);
    const downVotesNumber = (data.downVotesNumber || 0) + (voted === -1 ? 1 : 0) - (initialVoted === -1 ? 1 : 0);
    const commentsNumber = data.commentsNumber || 0;
    const readTime = data.readTime || 5;
    const tags = data.tags || [];
    const community = data.community || 'Community';
    // Memoized: the live-date ticks re-render this component up to once a
    // second while the post is fresh, and stripping tags out of the whole
    // content string is the one per-render cost worth pinning down.
    const excerpt = useMemo(
        () => data.excerpt || (data.content ? data.content.replace(/<[^>]*>/g, '').substring(0, 200) + '...' : ''),
        [data.excerpt, data.content]
    );

    const renderImageContent = (isMobile = false) => (
        <>
            <img
                src={data.image}
                alt={data.title}
                className={isMobile ? classes.cardImageMobile : classes.cardImage}
                loading="lazy"
                decoding="async"
            />
            <div className={classes.cardImageElements}>
                {tags.length > 0 && (
                    <div className={classes.tags}>
                        {tags.map((tag, index) => (
                            <Chip
                                key={index}
                                label={"#"+tag}
                                size="small"
                                className={classes.tag}
                                clickable
                            />
                        ))}
                    </div>
                )}
            </div>
        </>
    );

    return (
        <Card
            ref={rootRef}
            key={id}
            className={`${classes.card}${muted ? ' ' + classes.cardMuted : ''}`}
            style={style}
        >
            <div className={classes.cardLayout}>
                <div className={classes.contentContainer}>
                    <CardHeader
                        className={classes.cardHeader}
                        avatar={
                            <Avatar
                                onClick={() => openAuthor(author.username)}
                                src={author.image}
                                imgProps={{ decoding: 'async', loading: 'lazy' }}
                            />
                        }
                        action={
                            <IconButton aria-label="settings" onClick={handleMenuClick}>
                                <MoreVert />
                            </IconButton>
                        }
                        title={
                            /* display block = the click target spans the whole title
                               row, not just the glyphs of a (possibly short) title */
                            <span onClick={handleOpen} style={{ display: 'block' }}>
                                {data.title}
                            </span>
                        }
                        subheader={

                            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: '8px', width: "100%", justifyContent: "space-between" }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px'}}>
                                    {/* Rich author hover card (silhouette) instead of the old
                                        raw-@username Tooltip. Click behavior is unchanged. */}
                                    <ProfileHoverAnchor api={api} author={author} onOpenProfile={openAuthor}>
                                    <span className={classes.subheaderName} onClick={() => openAuthor(author.username)}>
                                        {(author || {}).name || ('@' + (data.author || {}).username)}
                                    </span>
                                    </ProfileHoverAnchor>
                                    <Tooltip
                                        arrow
                                        title={new Date(data.date || Date.now()).toLocaleDateString(locales, {
                                            weekday: 'long',
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                            hour: 'numeric',
                                            minute: 'numeric',
                                        })}
                                    >
                                    <span className={classes.subheaderDate}>
                                        {liveTimeAgo}
                                    </span>
                                    </Tooltip>
                                </div>
                                <div className={classes.subheaderReadingTime}>
                                    <span>{t("components.paper_card_blog.min_read", {
                                        readTime: readTime
                                    })}</span>
                                </div>
                            </div>
                        }
                    />

                    {/* Mobile image - appears below header */}
                    {false && data.image && (
                        <ButtonBase
                            className={classes.imageContainerMobile}
                            onClick={handleOpen}
                            disableRipple
                        >
                            {renderImageContent(true)}
                        </ButtonBase>
                    )}

                    {/* The whole content zone opens the post — the handler used to sit
                        on the excerpt Typography only, so short texts left most of the
                        (flex: 1) area dead. CardContent stretches between the header and
                        the actions bar, so clicking any empty space there now works too. */}
                    <CardContent className={classes.cardContent} onClick={handleOpen}>
                        <Typography
                            variant="body1"
                            className={classes.excerpt}
                        >
                            {excerpt}
                        </Typography>
                    </CardContent>

                    <PaperCardActions
                        api={api}
                        voted={voted}
                        voteNonce={voteNonce}
                        upvoteLoading={upvoteLoading}
                        downvoteLoading={downvoteLoading}
                        handleUpvote={handleUpvote}
                        handleDownvote={handleDownvote}
                        upVotesNumber={upVotesNumber}
                        downVotesNumber={downVotesNumber}
                        triggerPositiveVotes={triggerPositiveVotes}
                        triggerNegativeVotes={triggerNegativeVotes}
                        commentsNumber={commentsNumber}
                        onCommentsClick={handleCommentsClick}
                        showComments={true}
                        payout={payout}
                        data={data}
                        voter={voter}
                        style={{
                            padding: '0px 16px 0px 4px',
                            marginTop: 'auto',
                        }}
                    />
                </div>

                {/* Desktop image - appears on the side */}
                {data.image && (
                    <ButtonBase
                        className={classes.imageContainer}
                        onClick={handleOpen}
                        disableRipple
                    >
                        {renderImageContent(false)}
                    </ButtonBase>
                )}
            </div>
        </Card>
    );
}

export default memo(withStyles(styles)(PaperCardBlog), (prev, next) => {
    // Always re-render if vote-related data changed
    if (prev.voter !== next.voter) return false;
    if (prev.data !== next.data) return false;
    if (prev.id !== next.id) return false;
    if (prev.locales !== next.locales) return false;
    if (prev.column_width !== next.column_width) return false;
    if (prev.selected !== next.selected) return false;
    if (prev.visible !== next.visible) return false;
    return true;
});