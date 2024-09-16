import * as React from "preact/compat";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import TimelineItem from "@material-ui/lab/TimelineItem";
import TimelineSeparator from "@material-ui/lab/TimelineSeparator";
import TimelineConnector from "@material-ui/lab/TimelineConnector";
import TimelineContent from "@material-ui/lab/TimelineContent";
import TimelineOppositeContent from "@material-ui/lab/TimelineOppositeContent";
import TimelineDot from "@material-ui/lab/TimelineDot";
import ThumbUpRounded from "@material-ui/icons/ThumbUpRounded";
import ThumbDownRounded from "@material-ui/icons/ThumbDownRounded";
import CreateRounded from "@material-ui/icons/CreateRounded";
import SendRounded from "@material-ui/icons/SendRounded";
import CallReceivedRounded from "@material-ui/icons/CallReceivedRounded";
import SwapHorizRounded from "@material-ui/icons/SwapHorizRounded";
import EmojiEventsRounded from "@material-ui/icons/EmojiEventsRounded";
import CommentRounded from "@material-ui/icons/CommentRounded";
import PersonAddRounded from "@material-ui/icons/PersonAddRounded";
import PersonAddDisabledRounded from "@material-ui/icons/PersonAddDisabledRounded";
import StarRounded from "@material-ui/icons/StarRounded";
import History from "@material-ui/icons/History";
import AccountBalanceWalletRounded from "@material-ui/icons/AccountBalanceWalletRounded";
import EditRounded from "@material-ui/icons/EditRounded";
import PersonRounded from "@material-ui/icons/PersonRounded";
import ArticleRounded from "@material-ui/icons/SubjectRounded";
import PaletteRounded from "@material-ui/icons/PaletteRounded";

import { t, getLocaleCode, useLanguage } from "../utils/text";
import { T } from "../utils/T";
import useLiveTimeAgo from "../hooks/useLiveTimeAgo";

/**
 * Parse a raw timestamp (string or number) into a numeric millisecond value.
 * Handles ISO strings with or without trailing 'Z', raw numbers, and invalid values.
 * @param {string|number|undefined} raw - The raw timestamp
 * @returns {number} Milliseconds since epoch, or 0 if unparseable
 */
const parseTimestamp = (raw) => {
    if (typeof raw === "number" && isFinite(raw) && raw > 0) return raw;
    if (typeof raw === "string" && raw.length > 0) {
        const str = raw.endsWith("Z") ? raw : raw + "Z";
        const ms = new Date(str).valueOf();
        if (isFinite(ms) && ms > 0) return ms;
    }
    return 0;
};

// A community parent_permlink is "pixa-NNN" or "portal-NNN" — a numeric-suffixed
// community handle. Anything else is a pixel-art tag (e.g. "woman", "space").
// Profile.js applies the same predicate at parse time; this duplicate lets the
// component stay self-sufficient if `event.isBlog` is missing.
const isCommunityPermlink = (s) => typeof s === 'string' && /^(pixa|portal)-\d+$/.test(s);

const getTimelineEventIcon = (event) => {
    const { type, voteType, isBlog } = event || {};
    switch(type) {
        case "incoming_vote":
        case "outgoing_vote":
            return voteType === "down" ? <ThumbDownRounded /> : <ThumbUpRounded />;
        case "curation_reward":
            return <EmojiEventsRounded />;
        case "author_reward":
            return <StarRounded />;
        case "post_created":
            // Differentiate blog vs pixel-art at the icon level too. A blog is
            // long-form/text (SubjectRounded reads as "article"); a pixel-art
            // post is visual (PaletteRounded). Falls back to CreateRounded when
            // we can't tell.
            if (isBlog === true) return <ArticleRounded />;
            if (isBlog === false) return <PaletteRounded />;
            return <CreateRounded />;
        case "payout_update":
            return <AccountBalanceWalletRounded />;
        case "incoming_transfer":
            return <CallReceivedRounded />;
        case "outgoing_transfer":
            return <SendRounded />;
        case "market_order":
            return <SwapHorizRounded />;
        case "comment_created":
            return <CommentRounded />;
        case "follow":
        case "new_follower":
            return <PersonAddRounded />;
        case "unfollow":
        case "lost_follower":
            return <PersonAddDisabledRounded />;
        case "account_created":
        case "account_create":
            return <PersonRounded />;
        case "incoming_delegation":
            return <CallReceivedRounded />;
        case "outgoing_delegation":
            return <SendRounded />;
        case "profile_update":
        case "profile_updated":
            return <EditRounded />;
        default:
            return <History />;
    }
};

const formatVests = (vestsString) => {
    const num = parseFloat(vestsString);
    if (isNaN(num)) return vestsString;
    return `${num.toLocaleString(getLocaleCode(), { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

// "50.000000 VESTS" → "50.000000 VESTS" (passthrough); "50.000000" → "50.000000".
// Used to print delegate_vesting_shares amounts without doubling the unit suffix.
const stripUnit = (s) => typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : String(s);

// Clickable @username span. Stops event propagation so a click on the username
// doesn't bubble up to any wrapping click handler.
const UserLink = ({ name, onOpen, classes }) => {
    if (!name) return null;
    const handle = (e) => { e.stopPropagation(); if (typeof onOpen === 'function') onOpen(name); };
    return (
        <span className={classes.timelineUsername} onClick={handle} role="link" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handle(e); } }}>
            @{name}
        </span>
    );
};

// Clickable post reference (author + permlink). Renders the visible label —
// usually the title or the permlink — but the click resolves to the post.
const PostLink = ({ author, permlink, label, onOpen, classes }) => {
    if (!label) return null;
    if (!author || !permlink) return <>"{label}"</>;
    const handle = (e) => { e.stopPropagation(); if (typeof onOpen === 'function') onOpen(author, permlink); };
    return (
        <span className={classes.timelinePostLink} onClick={handle} role="link" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handle(e); } }}>
            "{label}"
        </span>
    );
};

// Clickable community name. Pushes /{community}/created/.
const CommunityLink = ({ name, onOpen, classes }) => {
    if (!name) return null;
    const handle = (e) => { e.stopPropagation(); if (typeof onOpen === 'function') onOpen(name); };
    return (
        <span className={classes.timelineUsername} onClick={handle} role="link" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handle(e); } }}>
            {name}
        </span>
    );
};

const renderTimelineEventContent = (event, classes, style, relLabel, isLast, eventId, handlers) => {
    const { type } = event;
    const { onOpenProfile, onOpenCommunity, onOpenPost } = handlers || {};
    // Title and description are now JSX fragments so they can embed clickable
    // <UserLink/> and <PostLink/> spans. Plain strings fall through unchanged.
    let title = null;
    let description = null;

    switch(type) {
        case "incoming_vote":
            title = (
                <>
                    {t(event.voteType === "down" ? "components.timeline_event.downvote_from" : "components.timeline_event.upvote_from")} <UserLink name={event.voter} onOpen={onOpenProfile} classes={classes} />
                </>
            );
            description = (
                <>
                    <PostLink author={event.postAuthor} permlink={event.postPermlink} label={event.postTitle} onOpen={onOpenPost} classes={classes} /> {t("components.timeline_event.at_strength", { strength: event.strength })}
                </>
            );
            break;
        case "outgoing_vote":
            title = (
                <>
                    {t(event.voteType === "down" ? "components.timeline_event.downvoted" : "components.timeline_event.upvoted")} <UserLink name={event.author} onOpen={onOpenProfile} classes={classes} />
                </>
            );
            description = (
                <>
                    <PostLink author={event.postAuthor} permlink={event.postPermlink} label={event.postTitle} onOpen={onOpenPost} classes={classes} /> {t("components.timeline_event.at_strength", { strength: event.strength })}
                </>
            );
            break;
        case "curation_reward":
            title = t("components.timeline_event.curation_reward");
            description = (
                <>
                    <T k="components.timeline_event.earned_pxp_for"
                       vars={{ pxp: event.pxp, extra: event.pxs && event.pxs !== '0.000' ? ` + ${event.pxs} PXS` : '' }}
                       slots={[<PostLink author={event.postAuthor} permlink={event.postPermlink} label={event.postTitle} onOpen={onOpenPost} classes={classes} key="0" />]} />
                </>
            );
            break;
        case "author_reward":
            title = t("components.timeline_event.author_reward");
            description = (
                <>
                    <T k="components.timeline_event.earned_pxp_for"
                       vars={{ pxp: event.pxp, extra: event.pxs && event.pxs !== '0.000' ? ` + ${event.pxs} PXS` : '' }}
                       slots={[<PostLink author={event.postAuthor} permlink={event.postPermlink} label={event.postTitle} onOpen={onOpenPost} classes={classes} key="0" />]} />
                </>
            );
            break;
        case "post_created": {
            // Blog vs pixel-art differentiation. The community/parent_permlink is
            // a "pixa-NNN" handle (blog) or a plain tag like "woman" (pixel art).
            const blog = (typeof event.isBlog === 'boolean') ? event.isBlog : isCommunityPermlink(event.community);
            title = t(blog ? "components.timeline_event.published_a_blog_post" : "components.timeline_event.published_a_pixel_art");
            const displayLabel = event.title || event.postPermlink || '';
            const inWhere = event.community
                ? (blog
                    ? <T k="components.timeline_event.in_community"
                         slots={[<CommunityLink name={event.community} onOpen={onOpenCommunity} classes={classes} key="0" />]} />
                    : t("components.timeline_event.tagged_in", {
                        community: event.community
                    }))
                : null;
            description = (
                <>
                    <T k="components.timeline_event.entitled_post"
                       vars={{ where: inWhere }}
                       slots={[<PostLink author={event.postAuthor} permlink={event.postPermlink} label={displayLabel} onOpen={onOpenPost} classes={classes} key="0" />]} />
                </>
            );
            break;
        }
        case "payout_update": {
            // Distinct event from post_created — this is the on-chain payout
            // finalization, not the original publication. Different copy + icon
            // (wallet) so the user can tell them apart at a glance.
            const displayLabel = event.title || event.postTitle || event.postPermlink || '';
            title = t("components.timeline_event.post_rewards_finalized");
            description = displayLabel
                ? (
                    <>
                        {t("components.timeline_event.payout_settled_for")} <PostLink author={event.postAuthor} permlink={event.postPermlink} label={displayLabel} onOpen={onOpenPost} classes={classes} />
                    </>
                )
                : t("components.timeline_event.payout_settled");
            break;
        }
        case "incoming_transfer":
            title = (
                <>
                    {t("components.timeline_event.transfer_from")} <UserLink name={event.from} onOpen={onOpenProfile} classes={classes} />
                </>
            );
            // Amount strings from the chain already carry their unit suffix
            // (e.g. "50.000000 VESTS"). Append currency only when it's a
            // distinct token that wasn't already in the amount string.
            description = (
                <>{t("components.timeline_event.received", {
                    stripUnit: stripUnit(event.amount),
                    currency: event.currency && !String(event.amount).includes(event.currency) ? ` ${event.currency}` : '',
                    String: event.memo ? ` — "${String(event.memo).substring(0, 50)}${String(event.memo).length > 50 ? '...' : ''}"` : ''
                })}</>
            );
            break;
        case "outgoing_transfer":
            title = (
                <>
                    {t("components.timeline_event.transfer_to")} <UserLink name={event.to} onOpen={onOpenProfile} classes={classes} />
                </>
            );
            description = (
                <>{t("components.timeline_event.sent", {
                    stripUnit: stripUnit(event.amount),
                    currency: event.currency && !String(event.amount).includes(event.currency) ? ` ${event.currency}` : '',
                    String: event.memo ? ` — "${String(event.memo).substring(0, 50)}${String(event.memo).length > 50 ? '...' : ''}"` : ''
                })}</>
            );
            break;
        case "market_order":
            title = t("components.timeline_event.market_swap");
            description = `${event.fromAmount} ${event.fromCurrency} → ${event.toAmount} ${event.toCurrency}`;
            break;
        case "comment_created":
            title = event.author ? (
                <>{t("components.timeline_event.replied_to")} <UserLink name={event.author} onOpen={onOpenProfile} classes={classes} /></>
            ) : t("components.timeline_event.comment_posted");
            description = (
                <>
                    <T k="components.timeline_event.on_post"
                       vars={{ preview: event.commentPreview ? ` — ${event.commentPreview.substring(0, 60)}${event.commentPreview.length > 60 ? '...' : ''}` : '' }}
                       slots={[<PostLink author={event.postAuthor} permlink={event.postPermlink} label={event.postTitle} onOpen={onOpenPost} classes={classes} key="0" />]} />
                </>
            );
            break;
        case "follow":
            title = <>{t("components.timeline_event.followed")} <UserLink name={event.following} onOpen={onOpenProfile} classes={classes} /></>;
            description = t("components.timeline_event.new_connection");
            break;
        case "unfollow":
            title = <>{t("components.timeline_event.unfollowed")} <UserLink name={event.following} onOpen={onOpenProfile} classes={classes} /></>;
            description = t("components.timeline_event.connection_removed");
            break;
        case "new_follower":
            title = <><UserLink name={event.follower} onOpen={onOpenProfile} classes={classes} /> {t("components.timeline_event.followed_you")}</>;
            description = t("components.timeline_event.new_follower");
            break;
        case "lost_follower":
            title = <><UserLink name={event.follower} onOpen={onOpenProfile} classes={classes} /> {t("components.timeline_event.unfollowed_you")}</>;
            description = t("components.timeline_event.follower_lost");
            break;
        case "account_create": {
            // fee can arrive as "0.000 PIXA" or a number. parseFloat handles both.
            const feeNum = parseFloat(String(event.fee).split(" ")[0]);
            title = event.creator
                ? <>{t("components.timeline_event.account_created_by")} <UserLink name={event.creator} onOpen={onOpenProfile} classes={classes} /></>
                : t("components.timeline_event.account_created");
            description = (feeNum && feeNum > 0)
                ? t("components.timeline_event.with_a_fee_of_pxa", {
                    formatVests: formatVests(feeNum)
                })
                : t("components.timeline_event.for_free");
            break;
        }
        case "account_created": {
            const delegNum = parseFloat(String(event.initialDelegation).split(" ")[0]);
            const vestNum = parseFloat(String(event.initialVestingShares).split(" ")[0]);
            title = event.creator
                ? <>{t("components.timeline_event.account_created_by")} <UserLink name={event.creator} onOpen={onOpenProfile} classes={classes} /></>
                : t("components.timeline_event.account_created");
            let descText = (delegNum && delegNum > 0)
                ? t("components.timeline_event.with_a_delegation_of_pxp", {
                    formatVests: formatVests(delegNum)
                })
                : t("components.timeline_event.without_delegation");
            descText += (vestNum && vestNum > 0)
                ? t("components.timeline_event.and_with_an_initial_vested_value_of", {
                    formatVests: formatVests(vestNum)
                })
                : t("components.timeline_event.and_with_no_initial_vested_value");
            description = descText;
            break;
        }
        case "incoming_delegation": {
            const vNum = parseFloat(String(event.vestingShares).split(" ")[0]);
            title = <>{t("components.timeline_event.delegation_from")} <UserLink name={event.delegator} onOpen={onOpenProfile} classes={classes} /></>;
            description = t("components.timeline_event.received_pxp", {
                formatVests: formatVests(vNum)
            });
            break;
        }
        case "outgoing_delegation": {
            const vNum = parseFloat(String(event.vestingShares).split(" ")[0]);
            title = <>{t("components.timeline_event.delegated_to")} <UserLink name={event.delegatee} onOpen={onOpenProfile} classes={classes} /></>;
            description = t("components.timeline_event.sent_pxp", {
                formatVests: formatVests(vNum)
            });
            break;
        }
        case "profile_update":
            title = t("components.timeline_event.profile_metadata_updated");
            description = (
                <>
                    {t("components.timeline_event.the_account")} <UserLink name={event.account} onOpen={onOpenProfile} classes={classes} /> {t("components.timeline_event.has_been_modified_by_the_owner")}
                </>
            );
            break;
        default:
            title = event.description || t("components.timeline_event.activity");
            description = event.rawType || t("components.timeline_event.unknown_event");
            break;
    }

    // Parse raw timestamp inside the component.
    const displayTs = parseTimestamp(event.timestamp);

    return (
        <TimelineItem style={style} key={eventId}>
            <TimelineContent>
                <Paper elevation={3} className={classes.timelineEventPaper}>
                    <Typography className={classes.timelineEventTitle}>
                        {title}
                    </Typography>
                    <Typography className={classes.timelineEventDescription}>
                        {description}
                    </Typography>
                </Paper>
                <Typography className={classes.timelineEventTime}>
                    {displayTs > 0 ? relLabel : t("components.timeline_event.unknown_date")}
                </Typography>
            </TimelineContent>
            <TimelineSeparator className={classes.timelineSeparator}>
                <TimelineDot
                    className={classes.timelineDot}
                    style={{ backgroundColor: "#000", boxShadow: `0 0 8px #0000004d` }}
                >
                    {getTimelineEventIcon(event)}
                </TimelineDot>
                {!isLast && (
                    <TimelineConnector className={classes.timelineConnector} />
                )}
            </TimelineSeparator>
            <TimelineOppositeContent />
        </TimelineItem>
    );
};

const TimelineEvent = React.memo(
    // `timeAgo` stays in the props contract (Profile still passes it), but the
    // live hook below owns the formatting now, so the prop is no longer read.
    ({ event, classes, style, timeAgo, isLast, eventId, onOpenProfile, onOpenCommunity, onOpenPost }) => {
        // The t() calls live in renderTimelineEventContent, a plain function that
        // cannot subscribe to anything. This component subscribes on its behalf.
        useLanguage();
        // Live relative date — re-renders this event exactly when its label is
        // due to change (per-second under a minute old, per-minute under an
        // hour, per-hour under a day, then daily); the watcher is released on
        // unmount. Unparseable timestamps (displayTs 0) arm nothing and keep
        // the unknown-date branch below.
        const displayTs = parseTimestamp(event && event.timestamp);
        const relLabel = useLiveTimeAgo(displayTs > 0 ? displayTs : null, { labels: 'long' });
        return renderTimelineEventContent(event, classes, style, relLabel, isLast, eventId, { onOpenProfile, onOpenCommunity, onOpenPost });
    },
    // Re-render when the event identity, last-flag, or any of the handler
    // identities change. Handler identities are stable callbacks from Profile.js
    // (useCallback), so this stays cheap.
    (a, b) =>
        a.eventId === b.eventId &&
        a.isLast === b.isLast &&
        a.onOpenProfile === b.onOpenProfile &&
        a.onOpenCommunity === b.onOpenCommunity &&
        a.onOpenPost === b.onOpenPost
);

// Export parseTimestamp so Profile can use it for sorting.
export { parseTimestamp };
export default TimelineEvent;