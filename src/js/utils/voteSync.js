"use strict";

import { voteSign, countUpvotes, countDownvotes } from './voteValue';

/**
 * voteSync — keeps an optimistic vote alive until the chain confirms it, and
 * refreshes the voted post from the chain once the block is indexed.
 *
 * The problem this solves: a vote is broadcast, the card flips instantly, but
 * every later hydration of that post (sort/tab switch, cache-served return
 * visit, revalidation fetch) reads hivemind, which lags the head block by a
 * couple of seconds — so the vote "disappears" until some unrelated refetch
 * happens to run late enough. Component state can't carry the vote across
 * those hydrations (cards are recycled / remounted), and the pages'
 * stale-while-revalidate caches were never told about it.
 *
 * Three cooperating pieces, all module-level so they survive page remounts:
 *
 *   1. PENDING registry — one record per post: who voted, with what weight,
 *      when. Written on `vote_done` (useVoteSync) and by applyOptimisticVote.
 *      A record lives until the chain reflects it (confirmed) or it expires.
 *
 *   2. overlayPendingVotes(cards) — pages pass every list they are about to
 *      render through this. A pending vote is re-applied as a placeholder row
 *      (`_optimistic: true`, rshares '0', `_prev_rshares` = the stale chain
 *      row it replaces) unless the fresh data already carries it, in which
 *      case the record is cleared. Pure: returns the same array when nothing
 *      changed, so memo/signature checks keep working.
 *
 *   3. scheduleVoteRefresh(api, vote) — VOTE_REFRESH_DELAY_MS (6 s = the
 *      vote's own block + one block for the indexer) after `vote_done`, fetch
 *      getContent(author, permlink) and emit `vote_synced` on the api event
 *      emitter with the sanitized content. Retries at the same interval while
 *      the vote isn't visible yet, up to VOTE_REFRESH_ATTEMPTS. One timer per
 *      post per api instance; a newer vote on the same post restarts it.
 *      Pages merge the content with mergeFreshVoteDataInto().
 *
 * Card shape assumed (every enricher in Feed/FeedPersonal/Community/Profile
 * produces it): { author: { username } | string, permlink, active_votes,
 * upVotesNumber, downVotesNumber, payout: "$x.xx", net_rshares? }.
 */

export const VOTE_REFRESH_DELAY_MS = 6000;
export const VOTE_REFRESH_ATTEMPTS = 3;
const PENDING_TTL_MS = 90_000;
// A stale same-sign vote row from an EARLIER cast must not pass for the new
// one; chain vote `time` is compared against the cast time with this slack
// (block time vs. client clock, plus indexer lag).
const CONFIRM_TIME_SLACK_MS = 10 * 60 * 1000;

const EVENT_SYNCED = 'vote_synced';

// ── Keys ──────────────────────────────────────────────────────────────

export const postKeyOf = (author, permlink) => `${author || ''}/${permlink || ''}`;

/** Author username of an enriched card (object form) or raw post (string form). */
export const cardAuthor = (card) => {
    if (!card) return '';
    const a = card.author;
    if (a && typeof a === 'object') return a.username || a.name || '';
    return typeof a === 'string' ? a : '';
};

const parsePayoutValue = (raw) => parseFloat(String(raw == null ? '0' : raw).replace(/[^0-9.\-]/g, '')) || 0;

/** Card payout (PXS) from a sanitized post — same rule every page enricher uses. */
export const payoutOf = (content) => {
    const pending = parsePayoutValue(content && content.pending_payout_value);
    if (pending > 0) return pending;
    return parsePayoutValue(content && content.total_payout_value) + parsePayoutValue(content && content.curator_payout_value);
};

// ── Pending registry ──────────────────────────────────────────────────

const PENDING = new Map(); // key → { author, permlink, voter, weight, at, prevRshares }

function purgeExpired() {
    const now = Date.now();
    for (const [k, rec] of PENDING) {
        if (now - rec.at > PENDING_TTL_MS) PENDING.delete(k);
    }
}

/**
 * Remember a vote that was just broadcast. Idempotent for the same
 * (voter, weight) so the `vote_done` listener and the card callback can both
 * call it; `prevRshares` (the chain row being replaced) is filled in by
 * whichever caller knows it.
 */
export function recordPendingVote({ author, permlink, voter, weight, prevRshares }) {
    if (!author || !permlink || !voter) return null;
    purgeExpired();
    const key = postKeyOf(author, permlink);
    const w = Number(weight) || 0;
    const cur = PENDING.get(key);
    if (cur && cur.voter === voter && cur.weight === w) {
        if (prevRshares != null && cur.prevRshares == null) cur.prevRshares = String(prevRshares);
        return cur;
    }
    const rec = { author, permlink, voter, weight: w, at: Date.now(), prevRshares: prevRshares != null ? String(prevRshares) : null };
    PENDING.set(key, rec);
    return rec;
}

export function getPendingVote(author, permlink) {
    purgeExpired();
    return PENDING.get(postKeyOf(author, permlink)) || null;
}

export function clearPendingVote(author, permlink) {
    PENDING.delete(postKeyOf(author, permlink));
}

/**
 * Does this chain-side `active_votes` array already show the pending vote?
 *   weight ≠ 0 → a row for `voter` with the same sign, not older than the cast
 *                (and with different rshares than the row it replaces, when
 *                that is known — a re-vote at another weight keeps the sign).
 *   weight = 0 → no live row for `voter` (a zeroed row counts as gone).
 */
export function voteReflected(activeVotes, voter, weight, rec) {
    const votes = Array.isArray(activeVotes) ? activeVotes : [];
    const mine = votes.find(v => v && v.voter === voter) || null;
    const w = Number(weight) || 0;
    if (w === 0) return !mine || voteSign(mine) === 0;
    if (!mine || mine._optimistic) return false;
    const wantSign = w > 0 ? 1 : -1;
    if (voteSign(mine) !== wantSign) return false;
    if (rec && rec.prevRshares != null && String(mine.rshares) === rec.prevRshares) return false;
    // Row time: the sanitizer yields integer ms, 0 when the node sent none
    // (bridge rows) — an unknown time never disqualifies a row.
    const castAt = rec && rec.at;
    const t = typeof mine.time === 'number' ? mine.time : (mine.time ? Date.parse(String(mine.time).endsWith('Z') ? mine.time : mine.time + 'Z') : NaN);
    if (castAt && Number.isFinite(t) && t > 0 && t < castAt - CONFIRM_TIME_SLACK_MS) return false;
    return true;
}

// ── Card-level application ────────────────────────────────────────────

/**
 * Put `voter`'s vote of `weight` onto a card as a placeholder row. Remembers
 * the rshares of the chain row it displaces (`_prev_rshares`, or
 * `_withdrawn_rshares` on the card for an unvote) so the payout estimate can
 * net them out. Recounts up/down from the resulting rows.
 */
export function placeOptimisticVote(card, voter, weight) {
    if (!card || !voter) return card;
    const w = Number(weight) || 0;
    const votes = Array.isArray(card.active_votes) ? card.active_votes : [];
    const mine = votes.find(v => v && v.voter === voter) || null;
    const prev = mine
        ? (mine._optimistic ? String(mine._prev_rshares || '0') : String(mine.rshares || '0'))
        : String(card._withdrawn_rshares || '0');
    const rest = votes.filter(v => v && v.voter !== voter);
    const next = { ...card, active_votes: rest, _withdrawn_rshares: undefined };
    if (w !== 0) {
        rest.push({ voter, weight: w, rshares: '0', time: Date.now(), _optimistic: true, _prev_rshares: prev });
    } else if (prev !== '0') {
        next._withdrawn_rshares = prev;
    }
    next.upVotesNumber = countUpvotes(rest);
    next.downVotesNumber = countDownvotes(rest);
    return next;
}

/**
 * Page-side handler body for onVoteChange(permlink, voter, weight): apply the
 * vote to the matching card and register it as pending. Returns the input
 * untouched for non-matching cards.
 */
export function applyOptimisticVote(card, permlink, voter, weight) {
    if (!card || !permlink || card.permlink !== permlink) return card;
    const votes = Array.isArray(card.active_votes) ? card.active_votes : [];
    const mine = votes.find(v => v && v.voter === voter) || null;
    const prevRshares = mine && !mine._optimistic ? String(mine.rshares || '0') : null;
    recordPendingVote({ author: cardAuthor(card), permlink, voter, weight, prevRshares });
    return placeOptimisticVote(card, voter, weight);
}

/**
 * Re-apply a pending vote to a freshly hydrated card. Returns the same object
 * when there is nothing to do. Clears the record once the chain shows the vote.
 */
export function overlayPendingVote(card) {
    if (!card) return card;
    const author = cardAuthor(card);
    const permlink = card.permlink;
    if (!author || !permlink) return card;
    const rec = getPendingVote(author, permlink);
    if (!rec) {
        return card._withdrawn_rshares ? { ...card, _withdrawn_rshares: undefined } : card;
    }
    if (voteReflected(card.active_votes, rec.voter, rec.weight, rec)) {
        clearPendingVote(author, permlink);
        return card._withdrawn_rshares ? { ...card, _withdrawn_rshares: undefined } : card;
    }
    return placeOptimisticVote(card, rec.voter, rec.weight);
}

export function overlayPendingVotes(cards) {
    if (!Array.isArray(cards) || cards.length === 0 || PENDING.size === 0) return cards;
    let changed = false;
    const out = cards.map(c => {
        const n = overlayPendingVote(c);
        if (n !== c) changed = true;
        return n;
    });
    return changed ? out : cards;
}

/**
 * Rows to hand to the voting list for a card whose viewer may hold a LOCAL
 * vote state ahead of `votes` — the brief window between the broadcast and
 * the page applying the vote to the card data. Once the rows already say what
 * `voted` (−1 / 0 / +1) says — including the placeholder placeOptimisticVote
 * writes — they are returned untouched, so the list can price that pending
 * row from its `_optimistic` / `_prev_rshares` fields.
 */
export function votesWithLocalVote(votes, voter, voted) {
    const rows = Array.isArray(votes) ? votes : [];
    if (!voter) return rows;
    const v = voted > 0 ? 1 : voted < 0 ? -1 : 0;
    const mine = rows.find(r => r && r.voter === voter) || null;
    if ((mine ? voteSign(mine) : 0) === v) return rows;
    const base = rows.filter(r => r && r.voter !== voter);
    if (v !== 0) {
        base.push({
            voter, weight: v * 10000, rshares: '0', time: Date.now(), _optimistic: true,
            _prev_rshares: mine && !mine._optimistic ? String(mine.rshares || '0') : '0',
        });
    }
    return base;
}

// ── Merging a chain refresh into a card ───────────────────────────────

/**
 * Fold a sanitized post (api.content.getContent) into an enriched card: votes,
 * counts, payout, net_rshares, reply count. Any still-pending vote is overlaid
 * again so the UI doesn't blink while the indexer catches up.
 */
export function mergeFreshVoteData(card, content) {
    if (!card || !content || !content.permlink || card.permlink !== content.permlink) return card;
    const a = cardAuthor(card);
    if (a && content.author && a !== content.author) return card;
    const votes = Array.isArray(content.active_votes) ? content.active_votes : [];
    const payout = payoutOf(content);
    const next = {
        ...card,
        active_votes: votes,
        upVotesNumber: countUpvotes(votes),
        downVotesNumber: countDownvotes(votes),
        payout: `$${payout.toFixed(2)}`,
        _withdrawn_rshares: undefined,
        _vote_synced_at: Date.now(),
    };
    if (content.net_rshares != null) next.net_rshares = String(content.net_rshares);
    if (content.pending_payout_value != null) next.pending_payout_value = content.pending_payout_value;
    if (typeof content.children === 'number') {
        next.children = content.children;
        if (card.commentsNumber != null) next.commentsNumber = content.children;
    }
    return overlayPendingVote(next);
}

/** Apply mergeFreshVoteData across a list; returns the SAME array when no card matched. */
export function mergeFreshVoteDataInto(cards, content) {
    if (!Array.isArray(cards) || !content || !content.permlink) return cards;
    let changed = false;
    const out = cards.map(c => {
        if (!c || c.permlink !== content.permlink) return c;
        const n = mergeFreshVoteData(c, content);
        if (n !== c) changed = true;
        return n;
    });
    return changed ? out : cards;
}

/**
 * Cheap fingerprint of the vote-related state of a list. Pages compare it when
 * a revalidation fetch returns the SAME membership as the cached list they
 * already show (postsSignature unchanged): a different votesSignature means
 * fresh vote/payout data that must still be committed — without the full
 * Masonry reset a membership change would need.
 */
export function votesSignature(cards) {
    if (!Array.isArray(cards)) return '';
    let s = '';
    for (const c of cards) {
        if (!c) continue;
        const votes = Array.isArray(c.active_votes) ? c.active_votes : [];
        let optimistic = 0;
        for (const v of votes) if (v && v._optimistic) optimistic++;
        // The optimistic-row count makes a cached list holding a placeholder
        // differ from the fresh list holding the real row even when payout
        // and counts happen to match.
        s += `${c.id}|${c.payout}|${c.upVotesNumber}|${c.downVotesNumber}|${votes.length}|${optimistic}|${c.commentsNumber ?? ''};`;
    }
    return s;
}

// ── Delayed refresh from the chain ────────────────────────────────────

const SYNC = new WeakMap(); // api → Map(postKey → state)

/**
 * Six seconds after a vote, re-read the post and broadcast `vote_synced`
 * { author, permlink, voter, weight, content, confirmed, attempt, final } on
 * api.eventEmitter. Returns a cancel function.
 */
export function scheduleVoteRefresh(api, { author, permlink, voter, weight },
                                    { delayMs = VOTE_REFRESH_DELAY_MS, attempts = VOTE_REFRESH_ATTEMPTS } = {}) {
    if (!api || !api.content || typeof api.content.getContent !== 'function' || !author || !permlink) return () => {};
    let map = SYNC.get(api);
    if (!map) { map = new Map(); SYNC.set(api, map); }
    const key = postKeyOf(author, permlink);
    const w = Number(weight) || 0;

    const prev = map.get(key);
    if (prev) {
        // Same vote queued twice (two listeners saw one vote_done) → keep it.
        if (prev.voter === voter && prev.weight === w && prev.attempt === 0) return prev.cancel;
        clearTimeout(prev.timer); // a newer vote on this post restarts the clock
    }

    const state = { author, permlink, voter, weight: w, attempt: 0, timer: null, cancel: null };
    const emit = (payload) => {
        try { if (api.eventEmitter) api.eventEmitter.emit(EVENT_SYNCED, payload); } catch (_) { /* listener error */ }
    };

    const tick = async () => {
        state.attempt += 1;
        let content = null;
        try { content = await api.content.getContent(author, permlink); } catch (_) { content = null; }
        if (map.get(key) !== state) return; // superseded or cancelled while fetching

        const rec = getPendingVote(author, permlink);
        const confirmed = !!content && voteReflected(content.active_votes, voter, w, rec);
        if (confirmed) clearPendingVote(author, permlink);
        const final = confirmed || state.attempt >= attempts;

        if (content) emit({ author, permlink, voter, weight: w, content, confirmed, attempt: state.attempt, final });

        if (final) map.delete(key);
        else state.timer = setTimeout(tick, delayMs);
    };

    state.cancel = () => {
        if (map.get(key) === state) { clearTimeout(state.timer); map.delete(key); }
    };
    state.timer = setTimeout(tick, delayMs);
    map.set(key, state);
    return state.cancel;
}
