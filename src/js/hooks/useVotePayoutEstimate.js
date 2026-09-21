"use strict";

import { useEffect, useMemo, useState } from "preact/compat";
import {
    getRewardSnapshot, getRewardSnapshotSync,
    getVoterAccount, getVoterAccountSync,
    estimateVoteRshares, estimatePayoutDeltaPxs,
} from "../utils/voteValue";

// ── useVotePayoutEstimate ──────────────────────────────────────────────
// The card's `payout` is the chain's pending payout as of the last fetch.
// Between a vote and the chain refresh (utils/voteSync, ~6 s) that figure is
// stale — it used to sit at 0.0 on a fresh post even though the vote button
// had flipped. This hook detects the optimistic state on the card data:
//
//   • a placeholder row for `voter` (`_optimistic: true`, written by
//     placeOptimisticVote) → estimate its rshares from the voter's account
//     (Hive estimate_upvote recipe) and net out `_prev_rshares`, the chain
//     row it replaced;
//   • `_withdrawn_rshares` on the card (an unvote) → subtract that row.
//
// The delta is converted through the reward fund exactly like the chain does
// (curve-aware when the card carries net_rshares) into PXA, priced in PXS
// through `prices` — the caller's usePrices() result, PXA anchored in USD
// and PXS derived from it — and added to the chain payout. The raw witness
// feed (1:1 while the chain bootstraps) is never used when prices exist:
// pricing the delta through it made a fresh vote jump the headline by every
// PXA counted as a full PXS. Once mergeFreshVoteData lands the real figures
// the placeholder and the flag vanish and this returns the chain payout
// untouched.
//
// Fetches happen only while an optimistic state exists (RAM-cached, deduped
// in utils/voteValue), so an idle feed costs nothing.

const EMPTY = [];

const useVotePayoutEstimate = (api, voter, data, payout, prices) => {
    const votes = data && Array.isArray(data.active_votes) ? data.active_votes : EMPTY;
    const mine = voter ? (votes.find(v => v && v.voter === voter) || null) : null;
    const pending = mine && mine._optimistic ? mine : null;
    const withdrawn = data && data._withdrawn_rshares ? String(data._withdrawn_rshares) : null;
    const active = !!(pending || withdrawn);
    const pendingWeight = pending ? pending.weight : 0;
    const prevRshares = pending ? String(pending._prev_rshares || '0') : '0';
    const netRshares = data ? data.net_rshares : null;
    // Primitives, so the memo below keys on the numbers rather than on the
    // fresh object usePrices() hands out every render.
    const pxaUsd = Number(prices && prices.pxaUsdPrice) || 0;
    const pxsUsd = Number(prices && prices.pxsUsdPrice) || 0;

    const [snap, setSnap] = useState(() => getRewardSnapshotSync(api));
    const [account, setAccount] = useState(() => (active && voter ? getVoterAccountSync(api, voter) : null));

    useEffect(() => {
        if (!active || !api) return undefined;
        let cancelled = false;
        // A different voter (login switch) must not be priced with the
        // previous voter's vesting shares while its own account loads.
        setAccount(voter ? getVoterAccountSync(api, voter) : null);
        getRewardSnapshot(api)
            .then(s => { if (!cancelled && s) setSnap(s); })
            .catch(() => {});
        if (pending && voter) {
            getVoterAccount(api, voter)
                .then(a => { if (!cancelled && a) setAccount(a); })
                .catch(() => {});
        }
        return () => { cancelled = true; };
        // pendingWeight re-arms the fetch when the same card is re-voted at
        // another weight (the voter's manabar moved; account cache was
        // invalidated by useVoteSync).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, api, voter, pendingWeight]);

    const base = Number(payout) || 0;

    const delta = useMemo(() => {
        if (!active || !snap || !snap.ok) return 0;
        let deltaRshares = 0;
        if (pending) {
            const est = account ? estimateVoteRshares(account, pendingWeight, snap) : 0;
            deltaRshares += est - (Number(prevRshares) || 0);
        }
        if (withdrawn) deltaRshares -= Number(withdrawn) || 0;
        return estimatePayoutDeltaPxs({ baseNetRshares: netRshares, deltaRshares }, snap,
            { pxaUsdPrice: pxaUsd, pxsUsdPrice: pxsUsd });
    }, [active, snap, account, pending, pendingWeight, prevRshares, withdrawn, netRshares, pxaUsd, pxsUsd]);

    return {
        payout: Math.max(0, base + delta),
        delta,
        isEstimate: active,
        ready: !active || !!(snap && snap.ok && (!pending || account)),
    };
};

export default useVotePayoutEstimate;
