"use strict";

import { useEffect, useRef } from "preact/compat";
import { recordPendingVote, scheduleVoteRefresh } from "../utils/voteSync";
import { invalidateVoterAccount } from "../utils/voteValue";

// ── useVoteSync ────────────────────────────────────────────────────────
// Mount once per page (inside the page's data hook). Listens on the api
// event emitter for:
//
//   vote_done   — emitted by pixaproxyapi's BroadcastAPI.vote after a
//                 successful broadcast (any surface: card, PostDialog,
//                 BlogPostDialog). Registers the vote as pending — so every
//                 later hydration overlays it until the chain shows it — and
//                 schedules the 6-second getContent refresh. Both are deduped
//                 at module level, so several mounted pages/dialogs sharing an
//                 api instance produce exactly one refresh per vote.
//
//   vote_synced — emitted by the scheduler with the refreshed sanitized post.
//                 Forwarded to `onSynced({ content, author, permlink, voter,
//                 weight, confirmed, attempt, final })`; pages merge it into
//                 their lists with mergeFreshVoteDataInto() and patch their
//                 view cache.
//
// `onSynced` is read through a ref, so an inline callback is fine and the
// subscription is only re-created when the api instance changes.

const useVoteSync = (api, onSynced) => {
    const onSyncedRef = useRef(onSynced);
    onSyncedRef.current = onSynced;

    useEffect(() => {
        const em = api && api.eventEmitter;
        if (!em || typeof em.on !== 'function') return undefined;

        const onVoteDone = (payload) => {
            if (!payload || !payload.author || !payload.permlink || !payload.voter) return;
            if (payload.outcome === 'nothing') return; // dialog dismissed — nothing broadcast
            const weight = Number(payload.weight) || 0;
            recordPendingVote({ author: payload.author, permlink: payload.permlink, voter: payload.voter, weight });
            // The voter's manabar just moved; the next estimate must re-read it.
            invalidateVoterAccount(api, payload.voter);
            scheduleVoteRefresh(api, { author: payload.author, permlink: payload.permlink, voter: payload.voter, weight });
        };

        const onSyncedEvent = (payload) => {
            if (!payload || !payload.content) return;
            const cb = onSyncedRef.current;
            if (typeof cb === 'function') cb(payload);
        };

        em.on('vote_done', onVoteDone);
        em.on('vote_synced', onSyncedEvent);
        return () => {
            em.off('vote_done', onVoteDone);
            em.off('vote_synced', onSyncedEvent);
        };
    }, [api]);
};

export default useVoteSync;
