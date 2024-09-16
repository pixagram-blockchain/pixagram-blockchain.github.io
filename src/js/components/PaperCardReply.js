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
import MoreVertIcon from '@material-ui/icons/MoreVert';
import Chip from '@material-ui/core/Chip';
import useLiveTimeAgo from '../hooks/useLiveTimeAgo';
import { HISTORY, COMMUNITY_TAG_REGEX, buildCommentFocusHash } from '../utils/constants';
import { t, useLanguage } from '../utils/text';
import * as actions from '../actions/utils';
import PaperCardActions from './PaperCardActions';
import { safeHTML } from '../utils/api/sanitizer';

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

function renderPostBody(api, body) {
    if (!body) return "";
    if (api && typeof api.sanitizePostHTML === "function") return api.sanitizePostHTML(body);
    return safeHTML(body);
}

/**
 * Root-post identity: what the card's title actually opens — a pixel art
 * (<PostDialog>) or a blog post (<Community> + <BlogPostDialog>).
 *
 * The rule is the whole rule: anything inside a portal is a blog post.
 * Pixel art can wear any tag; blog posts always sit in a `portal-N`
 * community, and COMMUNITY_TAG_REGEX is the same predicate the router uses
 * to pick the host for a URL. Both the chip and the title click resolve
 * through rootIsBlog(), so the label can never disagree with where the
 * title actually leads.
 */

/**
 * Root triplet of a chain-shaped url: "/<category>/@<author>/<permlink>".
 * On a comment the pre-anchor triplet identifies the ROOT post — the
 * "#@author/permlink" tail (the comment itself) is ignored. The leading
 * segment is mandatory: pixaproxyapi fabricates segment-less "/@a/p" urls
 * when the raw url fails safe_url_path, and that shape points at the
 * comment itself, not the root, so it must never parse as a root triplet.
 */
const ROOT_URL_REGEX = /^\/([^\/@#?\s]+)\/@([\w.-]+)\/([^\/#?\s]+)/;

function parseRootUrl(url) {
    if (typeof url !== 'string') return null;
    const m = ROOT_URL_REGEX.exec(url);
    return m ? { category: m[1], author: m[2], permlink: m[3] } : null;
}

// Accounts arrive as plain names on raw chain fields and as profile objects
// after enrichment — accept both.
function accountName(v) {
    if (!v) return '';
    if (typeof v === 'string') return v;
    return v.username || v.name || '';
}

/**
 * true → blog post, false → pixel art, null → unknown.
 *
 * The host page resolves `_content_type` once during enrichment; `category`
 * is the standalone fallback for hosts that don't (a comment keeps its
 * ROOT's category on-chain), and the validated leading segment of `url`
 * (also the root's) is the last witness. Null when none of them speak — an
 * unlabelled card beats a mislabelled one.
 */
function rootIsBlog(data) {
    const d = data || {};
    if (d._content_type === 'blog' || d._content_type === 'pixel_art') return d._content_type === 'blog';
    if (d.category) return COMMUNITY_TAG_REGEX.test(d.category);
    const fromUrl = parseRootUrl(d.url);
    if (fromUrl) return COMMUNITY_TAG_REGEX.test(fromUrl.category);
    return null;
}

/**
 * "/portal-N/@rootAuthor/rootPermlink" for a blog root, or null when the
 * data cannot prove all three parts. The portal segment must itself pass
 * COMMUNITY_TAG_REGEX — never buildPostUrl's "general" fallback. Root
 * author/permlink resolve from the segmented url's root triplet, then
 * `root_author`/`root_permlink`, then — only when the data states
 * depth === 1 — `parent_author`/`parent_permlink`: at depth 1 the parent
 * IS the root, while any deeper it's the parent COMMENT, which is exactly
 * the wrong-parent bug. Roots this data can't prove are resolved from the
 * chain by openRoot instead of guessed here.
 */
function blogRootPath(data) {
    const d = data || {};
    const fromUrl = parseRootUrl(d.url);

    let category = null;
    if (fromUrl && COMMUNITY_TAG_REGEX.test(fromUrl.category)) category = fromUrl.category;
    else if (d.category && COMMUNITY_TAG_REGEX.test(d.category)) category = d.category;
    if (!category) return null;

    let author = fromUrl ? fromUrl.author : '';
    let permlink = fromUrl ? fromUrl.permlink : '';
    if (!author || !permlink) {
        author = accountName(d.root_author);
        permlink = d.root_permlink || '';
    }
    if ((!author || !permlink) && d.depth === 1) {
        author = accountName(d.parent_author);
        permlink = d.parent_permlink || '';
    }
    if (!author || !permlink) return null;

    return '/' + category + '/@' + author + '/' + permlink;
}

/**
 * Same contract as blogRootPath, but fed by the comment's own on-chain
 * record (api.content.getContent of THIS comment): every chain comment
 * names its thread root via root_author/root_permlink and carries the
 * root's category and chain-shaped url. The card's local data stays as the
 * last category witness.
 */
function blogRootPathFromChain(chainComment, data) {
    const c = chainComment || {};
    const d = data || {};
    const fromUrl = parseRootUrl(c.url);

    let category = null;
    const candidates = [c.category, fromUrl && fromUrl.category, d.category];
    for (let i = 0; i < candidates.length; i++) {
        if (candidates[i] && COMMUNITY_TAG_REGEX.test(candidates[i])) { category = candidates[i]; break; }
    }
    if (!category) return null;

    let author = accountName(c.root_author);
    let permlink = c.root_permlink || '';
    if ((!author || !permlink) && fromUrl) {
        author = fromUrl.author;
        permlink = fromUrl.permlink;
    }
    if (!author || !permlink) return null;

    return '/' + category + '/@' + author + '/' + permlink;
}

function rootTypeLabel(data) {
    const blog = rootIsBlog(data);
    if (blog === null) return null;
    // utils/text renders an unknown key as its own last path segment, so until
    // the two keys are in all 12 catalogs the chip shows English rather than a
    // raw key. Delete the two fallback lines once they land.
    const s = t(blog ? 'components.paper_card.root_type_blog_post' : 'components.paper_card.root_type_artwork');
    if (s === 'root_type_blog_post') return 'Blog Post';
    if (s === 'root_type_artwork') return 'Artwork';
    return s;
}


const styles = theme => ({
    card: {
        '&.MuiCard-root': {
            width: '100%',
            borderRadius: '21px',
            marginTop: '24px',
            userSelect: 'none',
            overflow: 'hidden',
            backgroundColor: '#101010',
            transition: 'all 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms',
        },
        '&.MuiCard-root:hover': {
            backgroundColor: '#000000',
            contain: 'inherit',
            boxShadow: '0px 2px 4px -1px rgb(0 0 0 / 20%), 0px 4px 5px 0px rgb(0 0 0 / 14%), 0px 1px 10px 0px rgb(0 0 0 / 12%)',
            transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1) 5ms',
        },
    },
    titleText: { cursor: 'pointer' },
    typeChip: {
        '&.MuiChip-root': {
            height: '20px',
            marginLeft: '8px',
            verticalAlign: 'middle',
            cursor: 'default',
            backgroundColor: '#2b2b2b',
            color: '#bdbdbd',
            borderRadius: '10px',
            fontFamily: '"Industry Book", "Normative Pro"',
            fontWeight: 'normal',
            fontSize: '11px',
            letterSpacing: '0.4px',
            textTransform: 'uppercase',
        },
        '& .MuiChip-label': { paddingLeft: '8px', paddingRight: '8px' },
    },
    subheaderName: { color: '#fff', cursor: 'pointer' },
    subheaderBy: { color: '#aaa' },
    subheaderDate: { color: '#ddd' },
    cardHeader: {
        '& .MuiCardHeader-title': {
            fontWeight: 'bold',
            fontFamily: '"Industry Book", "Normative Pro"',
            color: '#fff',
            cursor: 'pointer',
        },
        '& .MuiAvatar-root': {
            cursor: 'pointer',
            borderRadius: '16px',
        },
    },
});

function PaperCardReplyInner({
                                 classes, data = {}, id, locales, selected, onOpen, onMenuClick,
                                 api, voter, column_width, style, is_scrolling,
                             }) {
    // Re-render when the UI language changes, so the subheader and the
    // root-type chip follow a language switch without a remount.
    useLanguage();

    // Determine initial vote state from active_votes — same pattern as PaperCard
    const initialVoted = useMemo(() => {
        if (!voter || !Array.isArray(data.active_votes)) return 0;
        const myVote = data.active_votes.find(v => v && v.voter === voter);
        if (!myVote) return 0;
        if (myVote.weight < 0) return -1;
        return 1;
    }, [voter, data.active_votes]);

    // Identity of the post this instance is currently pointed at. A sort change
    // or a virtualized-row recycle re-points a live instance at a different post
    // instead of remounting it, so every piece of local vote state is scoped to
    // this rather than to the component's lifetime.
    const postKey = ((data.author || {}).username || '') + '/' + (data.permlink || data.id || '');

    // Optimistic vote, tagged with the post it was cast on and with the chain
    // value it was cast against. Read, not synced: when the instance is
    // re-pointed — or when the chain catches up, or the same post is voted from
    // a dialog — the tag stops matching and initialVoted is used directly, in
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
    const historyRef = useRef(HISTORY);

    // Live relative date — re-renders the card exactly when the label is
    // due to change (per-second under a minute old, per-minute under an
    // hour, per-hour under a day, then daily); watcher released on unmount.
    const liveTimeAgo = useLiveTimeAgo(data.date);

    // Memoized: the live-date ticks re-render this component up to once a
    // second while the comment is fresh — the WASM render+sanitize pass
    // must run once per body, not once per tick.
    const bodyHTML = useMemo(() => renderCommentBody(api, data.body), [api, data.body]);


    const openAuthor = useCallback((username) => {
        historyRef.current.push('/@' + username);
    }, []);

    // Title click. A pixel art root keeps the host flow — onOpen opens the
    // host's PostDialog, which already works. A blog root is pushed as its
    // portal URL instead, so the router mounts <Community> +
    // <BlogPostDialog>: hosts like Profile carry no BlogPostDialog, and
    // routing a blog root through them lands on buildPostUrl's "/general/…"
    // fallback. The pushed URL carries "#replies&focus=<b64url(author/
    // permlink)>" — BlogPostDialog reads the same hash scheme as
    // PostDialog, so it opens scrolled onto THIS comment, pinned in its
    // hover state with the tree path down to it lit; when the comment's
    // identity is missing the hash degrades to bare "#replies", which just
    // scrolls the comments section into view.
    //
    // When the local data can't PROVE the root — the reply-of-a-reply
    // case: fabricated segment-less url, no root_* fields, parent_* naming
    // the parent COMMENT — the root is resolved from the chain: one
    // getContent of THIS comment yields root_author/root_permlink and the
    // root's category. Only if that too fails does the click fall back to
    // the host flow, so it can never navigate to the wrong parent.
    const openRoot = useCallback(() => {
        if (rootIsBlog(data) === true) {
            const anchor = buildCommentFocusHash(accountName(data.author), data.permlink);
            const path = blogRootPath(data);
            if (path) {
                historyRef.current.push(path + anchor);
                return;
            }
            const a = accountName(data.author);
            const p = data.permlink;
            if (api && api.content && a && p) {
                api.content.getContent(a, p)
                    .then((c) => {
                        const resolved = blogRootPathFromChain(c, data);
                        if (resolved) historyRef.current.push(resolved + anchor);
                        else onOpen?.(data);
                    })
                    .catch(() => { onOpen?.(data); });
                return;
            }
        }
        onOpen?.(data);
    }, [data, onOpen, api]);

    // Compute active_votes reflecting current local vote state — same as PaperCard
    const currentActiveVotes = useMemo(() => {
        const base = (data.active_votes || []).filter(v => v && v.voter !== voter);
        if (voted === 1 && voter) {
            base.push({ voter, weight: 10000, rshares: '0', time: null });
        } else if (voted === -1 && voter) {
            base.push({ voter, weight: -10000, rshares: '0', time: null });
        }
        return base;
    }, [data.active_votes, voted, voter]);

    const triggerPositiveVotes = useCallback(() => actions.trigger_votes({ sign: '+', votes: currentActiveVotes, voter_profiles: data._voter_profiles || {} }), [currentActiveVotes, data._voter_profiles]);
    const triggerNegativeVotes = useCallback(() => actions.trigger_votes({ sign: '-', votes: currentActiveVotes, voter_profiles: data._voter_profiles || {} }), [currentActiveVotes, data._voter_profiles]);

    const handleUpvote = useCallback(() => {
        if (!voter) return;
        if (upvoteLoading || downvoteLoading) return;
        const authorUsername = (data.author || {}).username;
        const permlink = data.permlink;
        if (!authorUsername || !permlink) return;

        setUpvoteLoading(true);
        // Intent weight — the weight dialog (when enabled) may change the
        // percentage, flip the sign, or be cancelled, so the optimistic state
        // below is driven by what vote() reports it *actually* did.
        const newVoted = voted !== 1 ? 1 : 0;
        const weight = newVoted === 1 ? 10000 : 0;

        if (api) {
            api.broadcast.vote(voter, authorUsername, permlink, weight)
                .then((res) => {
                    // res.outcome: 'nothing' | 'positive' | 'negative' | 'withdrawal'
                    if (!res || res.outcome === 'nothing') return; // cancelled — leave UI as-is
                    const w = res.weight || 0;
                    applyVote(w);
                    // success toast shown centrally via the 'vote_done' event (Index)
                })
                .catch((e) => {
                    console.warn('[PaperCardReply] vote failed:', e.message);
                    actions.trigger_snackbar(e.message || 'Failed to vote');
                })
                .finally(() => { setUpvoteLoading(false); });
        } else {
            setUpvoteLoading(false);
        }
    }, [voted, upvoteLoading, downvoteLoading, api, voter, data, applyVote]);

    const handleDownvote = useCallback(() => {
        if (!voter) return;
        if (upvoteLoading || downvoteLoading) return;
        const authorUsername = (data.author || {}).username;
        const permlink = data.permlink;
        if (!authorUsername || !permlink) return;

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
                    // success toast shown centrally via the 'vote_done' event (Index)
                })
                .catch((e) => {
                    console.warn('[PaperCardReply] vote failed:', e.message);
                    actions.trigger_snackbar(e.message || 'Failed to vote');
                })
                .finally(() => { setDownvoteLoading(false); });
        } else {
            setDownvoteLoading(false);
        }
    }, [voted, upvoteLoading, downvoteLoading, api, voter, data, applyVote]);

    const author = data.author || {};
    const replyTo = data.replyTo || {};
    const replyToUsername = replyTo.username || replyTo.name || '';
    const replyToDisplayName = replyTo.name || replyTo.display_name || replyToUsername;

    const payout = parseFloat((data.payout || '').replace('$', '')) || 0;
    // Delta from initial state — avoids double-counting votes already in data
    const upVotesNumber = (data.upVotesNumber || 0) + (voted === 1 ? 1 : 0) - (initialVoted === 1 ? 1 : 0);
    const downVotesNumber = (data.downVotesNumber || 0) + (voted === -1 ? 1 : 0) - (initialVoted === -1 ? 1 : 0);

    const typeLabel = rootTypeLabel(data);

    const move_style = is_scrolling ? { pointerEvents: 'none', touchActions: 'pan-y' } : {};

    return (
        <Card
            key={id}
            className={classes.card + (selected ? ' Mui-selected' : '')}
            style={{ ...style, ...move_style }}
        >
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
                    <IconButton onClick={(e) => onMenuClick(e, data)}>
                        <MoreVertIcon style={{ color: '#666' }} />
                    </IconButton>
                }
                title={
                    <span>
                        <span className={classes.titleText} onClick={openRoot}>
                            {data.title}
                        </span>
                        {typeLabel ? (
                            <Chip
                                component="span"
                                size="small"
                                className={classes.typeChip}
                                label={typeLabel}
                            />
                        ) : null}
                    </span>
                }
                subheader={
                    <span>
                        <Tooltip
                            arrow
                            title={new Date(data.date || Date.now()).toLocaleDateString(locales, {
                                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric',
                            })}
                        >
                            <span className={classes.subheaderDate}>
                                {liveTimeAgo}
                            </span>
                        </Tooltip>
                        <span className={classes.subheaderBy}> {t('words.by')} </span>
                        <Tooltip title={'@' + author.username}>
                            <span className={classes.subheaderName} onClick={() => openAuthor(author.username)}>
                                {author.name}
                            </span>
                        </Tooltip>
                        {replyToUsername ? (
                            <span>
                                <span className={classes.subheaderBy}> {t('words.to')} </span>
                                <Tooltip title={'@' + replyToUsername}>
                                    <span className={classes.subheaderName} onClick={() => openAuthor(replyToUsername)}>
                                        {replyToDisplayName}
                                    </span>
                                </Tooltip>
                            </span>
                        ) : null}
                    </span>
                }
            />
            <CardContent>
                <div dangerouslySetInnerHTML={{ __html: safeHTML(bodyHTML) }} />
            </CardContent>
            <PaperCardActions
                api={api}
                upvoteLoading={upvoteLoading}
                downvoteLoading={downvoteLoading}
                voted={voted}
                voteNonce={voteNonce}
                handleUpvote={handleUpvote}
                handleDownvote={handleDownvote}
                upVotesNumber={upVotesNumber}
                downVotesNumber={downVotesNumber}
                triggerPositiveVotes={triggerPositiveVotes}
                triggerNegativeVotes={triggerNegativeVotes}
                showComments={false}
                payout={payout}
                data={data}
                voter={voter}
            />
        </Card>
    );
}

const PaperCardReply = withStyles(styles)(PaperCardReplyInner);

export default PaperCardReply;