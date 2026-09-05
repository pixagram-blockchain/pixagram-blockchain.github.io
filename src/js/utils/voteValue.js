"use strict";

/**
 * voteValue — what a vote is worth on the Pixa chain.
 *
 * Port of the HIVE recipe
 *   https://developers.hive.io/tutorials-recipes/estimate_upvote.html
 * adapted to Pixa:
 *
 *   effective_vests = vesting_shares + received − delegated (− next weekly power-down)
 *   mana            = voting_manabar regenerated to "now" (max = effective_vests × 1e6)
 *   used_mana       = mana × |weight| × 86 400 / 10 000
 *   rshares         = ceil(used_mana / (vote_power_reserve_rate × regen_seconds)) − dust
 *   PXA             = rshares / reward_fund.recent_claims × reward_fund.reward_balance
 *   PXS             = PXA × (feed.base PXS / feed.quote PXA)
 *
 * The chain's own `pending_payout_value` is denominated in PXS through the
 * same witness feed, so figures produced here are directly comparable with
 * the payout printed on the cards. Everything above is the marginal, linear
 * value of one vote (what the recipe computes). For a WHOLE post the chain
 * applies the reward fund's `author_reward_curve` to net_rshares before
 * dividing by recent_claims — payoutPxsForRshares() / estimatePayoutDeltaPxs()
 * implement that curve so a card's estimated payout tracks the chain figure
 * even on a convergent-linear fund.
 *
 * Nothing here touches the network on its own: getRewardSnapshot() and
 * getVoterAccount() are the only fetchers, both RAM-cached per api instance
 * with a short TTL and in-flight dedup. Every other export is pure math and
 * safe to call from a render.
 *
 * Doubles are used throughout. recent_claims is ~1e18 on a mature chain, above
 * 2^53, but every consumer only needs ratios for display, so the relative
 * error (≤ 1e-16) is irrelevant.
 */

const HUNDRED_PERCENT = 10000;
const SECONDS_PER_DAY = 86400;
const VESTS_PRECISION = 1e6;

export const VOTE_DEFAULTS = Object.freeze({
    regenSeconds: 432000,      // *_VOTING_MANA_REGENERATION_SECONDS (5 days)
    dustThreshold: 50000000,   // *_VOTE_DUST_THRESHOLD
    reserveRate: 10,           // dgp.vote_power_reserve_rate
    pxsPerPxa: 1,              // feed fallback — the bootstrap feed reads 1:1
});

const SNAPSHOT_TTL_MS = 60_000;
const ACCOUNT_TTL_MS = 20_000;

// ── Asset parsing ─────────────────────────────────────────────────────

/**
 * Numeric amount of an asset in any of the shapes the API layer hands out:
 * "12.345 PIXA" (condenser string), dpixa Asset { amount: 12.345, symbol },
 * NAI { amount: "12345", precision: 3, nai } or a plain number.
 */
export function assetAmount(x) {
    if (x == null) return 0;
    if (typeof x === 'number') return Number.isFinite(x) ? x : 0;
    if (typeof x === 'string') {
        const n = parseFloat(x);
        return Number.isFinite(n) ? n : 0;
    }
    if (typeof x === 'object') {
        if (typeof x.amount === 'number' && typeof x.symbol === 'string') {
            return Number.isFinite(x.amount) ? x.amount : 0;
        }
        if (x.amount != null && x.precision != null) {
            const raw = Number(x.amount);
            const p = Number(x.precision);
            return Number.isFinite(raw) && Number.isFinite(p) ? raw / Math.pow(10, p) : 0;
        }
        if (typeof x.toString === 'function') {
            const n = parseFloat(x.toString());
            return Number.isFinite(n) ? n : 0;
        }
    }
    return 0;
}

/** PXS per 1 PXA from a witness feed { base: "x PXS", quote: "y PXA" }; null when unusable. */
export function feedPxsPerPxa(feed) {
    const base = assetAmount(feed && feed.base);
    const quote = assetAmount(feed && feed.quote);
    return base > 0 && quote > 0 ? base / quote : null;
}

// ── Vote helpers (shared by cards, lists and the sync layer) ──────────

/**
 * Direction of a vote: +1 up, −1 down, 0 for a withdrawn vote (hivemind keeps
 * listing the zeroed row after an unvote).
 *
 * rshares decide first — the `weight` field of a chain row is not reliably
 * the percent: bridge rows omit it and condenser rows may carry the curation
 * weight, which is never negative. With rshares at 0 the row is either an
 * unvote or the upvote of an account below the dust threshold; only
 * `percent` (kept by pixaproxyapi's safe_active_vote for condenser rows)
 * tells them apart. When neither rshares nor percent nor weight says
 * anything, presence is read as an upvote — the app's historical reading and
 * the right one for zero-PXP accounts — never as an unvote.
 */
export function voteSign(vote) {
    if (!vote) return 0;
    const rs = Number(vote.rshares);
    if (rs < 0) return -1;
    if (rs > 0) return 1;
    if (vote.percent != null) {
        const p = Number(vote.percent);
        if (Number.isFinite(p)) return p < 0 ? -1 : (p > 0 ? 1 : 0);
    }
    const w = Number(vote.weight);
    if (w < 0) return -1;
    if (w > 0) return 1;
    return 1;
}

/** Vote percent in basis points when the row knows it (|value| ≤ 10 000), else null. */
export function votePercentBp(vote) {
    if (!vote) return null;
    const candidates = [vote.percent, vote.weight];
    for (const c of candidates) {
        const n = Number(c);
        if (Number.isFinite(n) && n !== 0 && Math.abs(n) <= HUNDRED_PERCENT) return n;
    }
    return null;
}

export const countUpvotes = (votes) => (Array.isArray(votes) ? votes : []).reduce((n, v) => n + (voteSign(v) > 0 ? 1 : 0), 0);
export const countDownvotes = (votes) => (Array.isArray(votes) ? votes : []).reduce((n, v) => n + (voteSign(v) < 0 ? 1 : 0), 0);

// ── Chain constants (get_config, fetched once per api) ────────────────

const CONFIG_CACHE = new WeakMap(); // api → Promise<{ regenSeconds, dustThreshold }>

function getChainConstants(api) {
    if (!api) return Promise.resolve({ ...VOTE_DEFAULTS });
    let p = CONFIG_CACHE.get(api);
    if (p) return p;
    p = (async () => {
        let cfg = null;
        try {
            cfg = api.globals && typeof api.globals.getConfig === 'function'
                ? await api.globals.getConfig()
                : null;
        } catch (_) { cfg = null; }
        // The fork may have renamed the HIVE_ prefix; match on the suffix.
        const pick = (suffix, def) => {
            if (!cfg || typeof cfg !== 'object') return def;
            for (const k of Object.keys(cfg)) {
                if (k.endsWith(suffix)) {
                    const n = Number(cfg[k]);
                    if (Number.isFinite(n) && n > 0) return n;
                }
            }
            return def;
        };
        return {
            regenSeconds: pick('_VOTING_MANA_REGENERATION_SECONDS', VOTE_DEFAULTS.regenSeconds),
            dustThreshold: pick('_VOTE_DUST_THRESHOLD', VOTE_DEFAULTS.dustThreshold),
        };
    })();
    CONFIG_CACHE.set(api, p);
    return p;
}

// ── Reward snapshot: fund + dgp + feed, 60 s RAM cache per api ────────

const SNAP_CACHE = new WeakMap(); // api → { value, inflight }

/** Last fetched snapshot for this api, or null. Never fetches. */
export function getRewardSnapshotSync(api) {
    const c = api ? SNAP_CACHE.get(api) : null;
    return c && c.value ? c.value : null;
}

/**
 * Reward fund + dynamic global properties + median feed, reduced to the few
 * numbers the estimators need. Resolves to the last good snapshot when a
 * refresh partially fails, and to a non-`ok` snapshot only when nothing was
 * ever read (consumers then render no estimate rather than a wrong one).
 */
export async function getRewardSnapshot(api, { maxAge = SNAPSHOT_TTL_MS, force = false } = {}) {
    if (!api || !api.globals) return null;
    let c = SNAP_CACHE.get(api);
    if (!c) { c = { value: null, inflight: null }; SNAP_CACHE.set(api, c); }
    if (!force && c.value && Date.now() - c.value.fetchedAt < maxAge) return c.value;
    if (c.inflight) return c.inflight;

    c.inflight = (async () => {
        const g = api.globals;
        const [fund, dgp, feed, consts] = await Promise.all([
            typeof g.getRewardFund === 'function' ? g.getRewardFund('post').catch(() => null) : null,
            typeof g.getDynamicGlobalProperties === 'function' ? g.getDynamicGlobalProperties().catch(() => null) : null,
            typeof g.getCurrentMedianHistoryPrice === 'function' ? g.getCurrentMedianHistoryPrice().catch(() => null) : null,
            getChainConstants(api),
        ]);

        // The chain prices pending payouts through the raw median feed —
        // bootstrap 1:1 included — so we follow the chain, not PricesAPI's
        // plausibility fallback, to stay comparable with pending_payout_value.
        let pxsPerPxa = feedPxsPerPxa(feed);
        if (pxsPerPxa == null) {
            const p = api.prices && typeof api.prices.getSync === 'function' ? api.prices.getSync() : null;
            pxsPerPxa = p && p.feedRatio > 0 ? 1 / p.feedRatio : VOTE_DEFAULTS.pxsPerPxa;
        }

        let headTimeMs = Date.now();
        if (dgp && dgp.time) {
            const t = String(dgp.time);
            const parsed = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(t) ? t : t + 'Z');
            if (Number.isFinite(parsed)) headTimeMs = parsed;
        }

        const snap = {
            rewardBalance: assetAmount(fund && fund.reward_balance),          // PXA in the fund
            recentClaims: Number(fund && fund.recent_claims) || 0,
            curve: String((fund && fund.author_reward_curve) || 'linear'),
            contentConstant: Number(fund && fund.content_constant) || 0,
            pxsPerPxa,
            reserveRate: Number(dgp && dgp.vote_power_reserve_rate) || VOTE_DEFAULTS.reserveRate,
            downvotePoolPercent: Number(dgp && dgp.downvote_pool_percent) || 0,
            totalVestingFund: assetAmount(dgp && (dgp.total_vesting_fund_pixa ?? dgp.total_vesting_fund_hive
                ?? dgp.total_vesting_fund_steem ?? dgp.total_vesting_fund)),
            totalVestingShares: assetAmount(dgp && dgp.total_vesting_shares),
            regenSeconds: consts.regenSeconds,
            dustThreshold: consts.dustThreshold,
            headTimeMs,
            fetchedAt: Date.now(),
            ok: false,
        };
        snap.ok = snap.recentClaims > 0 && snap.rewardBalance > 0;
        if (snap.ok || !c.value) c.value = snap;
        return c.value;
    })().finally(() => { c.inflight = null; });

    return c.inflight;
}

/** Chain-clock "now" in ms, extrapolated from the snapshot's head block time. */
export function chainNowMs(snap) {
    if (!snap || !Number.isFinite(snap.headTimeMs)) return Date.now();
    return snap.headTimeMs + (Date.now() - snap.fetchedAt);
}

// ── Reward curve (whole-post math) ────────────────────────────────────

/**
 * evaluate_reward_curve(): claims for a post's net rshares under the fund's
 * author curve. `linear` is the identity; `convergent_linear` (HF21 Hive)
 * halves tiny posts and converges to linear for large ones.
 */
export function claimsForRshares(rshares, snap) {
    const r = Math.max(0, Number(rshares) || 0);
    const curve = snap && snap.curve;
    const s = snap && snap.contentConstant > 0 ? snap.contentConstant : 0;
    switch (curve) {
        case 'convergent_linear':
            return s > 0 ? ((r + s) * (r + s) - s * s) / (r + 4 * s) : r;
        case 'convergent_square_root':
            return s > 0 ? r / Math.sqrt(r + 2 * s) : Math.sqrt(r);
        case 'square_root':
            return Math.sqrt(r);
        case 'quadratic':
            return s > 0 ? (r + s) * (r + s) - s * s : r * r;
        default:
            return r;
    }
}

/** Pending payout (PXS) the chain would print for a post holding `netRshares`. */
export function payoutPxsForRshares(netRshares, snap) {
    if (!snap || !snap.ok) return 0;
    return snap.rewardBalance * claimsForRshares(netRshares, snap) / snap.recentClaims * snap.pxsPerPxa;
}

/** Linear value of a bag of rshares (sign preserved), in PXA / PXS — the recipe's formula. */
export function rsharesToPxa(rshares, snap) {
    if (!snap || !snap.ok) return 0;
    return (Number(rshares) || 0) / snap.recentClaims * snap.rewardBalance;
}
export function rsharesToPxs(rshares, snap) {
    return rsharesToPxa(rshares, snap) * (snap ? snap.pxsPerPxa : 1);
}

/**
 * Change in a post's payout when `deltaRshares` land on it. Curve-aware when
 * the post's current net_rshares are known; falls back to the linear vote
 * value otherwise (a fund on the `linear` curve gives identical results).
 */
export function estimatePayoutDeltaPxs({ baseNetRshares, deltaRshares }, snap) {
    const delta = Number(deltaRshares) || 0;
    if (!snap || !snap.ok || delta === 0) return 0;
    const base = baseNetRshares == null || baseNetRshares === '' ? null : Number(baseNetRshares);
    if (base == null || !Number.isFinite(base) || snap.curve === 'linear') return rsharesToPxs(delta, snap);
    return payoutPxsForRshares(base + delta, snap) - payoutPxsForRshares(base, snap);
}

// ── Account-side math ─────────────────────────────────────────────────

/**
 * Vesting shares that count for voting (get_effective_vesting_shares): own +
 * received − delegated, minus the next weekly power-down instalment while a
 * withdrawal is running.
 */
export function effectiveVests(account) {
    if (!account) return 0;
    let v = assetAmount(account.vesting_shares)
        + assetAmount(account.received_vesting_shares)
        - assetAmount(account.delegated_vesting_shares);
    const rate = assetAmount(account.vesting_withdraw_rate);
    const remaining = ((Number(account.to_withdraw) || 0) - (Number(account.withdrawn) || 0)) / VESTS_PRECISION;
    if (rate > 0 && remaining > 0) v -= Math.min(rate, remaining);
    return Math.max(0, v);
}

/** Display conversion VESTS → PXP using the snapshot's vesting fund ratio. */
export function vestsToPxp(vests, snap) {
    if (!snap || !(snap.totalVestingShares > 0)) return 0;
    return (Number(vests) || 0) * snap.totalVestingFund / snap.totalVestingShares;
}

export function maxVotingMana(account) {
    return Math.round(effectiveVests(account) * VESTS_PRECISION);
}

function regenerate(mana, max, lastUpdateSec, nowSec, regenSeconds) {
    if (!(max > 0)) return 0;
    const elapsed = Math.max(0, nowSec - (Number(lastUpdateSec) || 0));
    if (elapsed >= regenSeconds) return max;
    return Math.max(0, Math.min(max, (Number(mana) || 0) + max * elapsed / regenSeconds));
}

/**
 * Voting mana regenerated to now → { mana, max, percent (basis points) }.
 * Uses voting_manabar when present; falls back to the legacy voting_power
 * field regenerated from last_vote_time.
 */
export function currentVotingMana(account, snap, nowMs) {
    const max = maxVotingMana(account);
    const regen = (snap && snap.regenSeconds) || VOTE_DEFAULTS.regenSeconds;
    const nowSec = Math.floor((nowMs != null ? nowMs : chainNowMs(snap)) / 1000);
    const mb = account && account.voting_manabar;
    let mana;
    if (mb && mb.current_mana != null) {
        mana = regenerate(mb.current_mana, max, mb.last_update_time, nowSec, regen);
    } else {
        const vp = Number(account && account.voting_power);
        const lastMs = Number(account && account.last_vote_time);
        const lastSec = Number.isFinite(lastMs) ? Math.floor(lastMs / 1000) : 0;
        const elapsed = Math.max(0, nowSec - lastSec);
        const pct = Math.min(HUNDRED_PERCENT,
            (Number.isFinite(vp) ? vp : HUNDRED_PERCENT) + HUNDRED_PERCENT * elapsed / regen);
        mana = max * pct / HUNDRED_PERCENT;
    }
    return { mana, max, percent: max > 0 ? Math.round(mana / max * HUNDRED_PERCENT) : 0 };
}

/** Downvote pool mana (HF21+), or null when the chain runs without a pool. */
export function currentDownvoteMana(account, snap, nowMs) {
    const pool = snap ? snap.downvotePoolPercent : 0;
    if (!(pool > 0)) return null;
    const max = Math.round(maxVotingMana(account) * pool / HUNDRED_PERCENT);
    const regen = (snap && snap.regenSeconds) || VOTE_DEFAULTS.regenSeconds;
    const nowSec = Math.floor((nowMs != null ? nowMs : chainNowMs(snap)) / 1000);
    const mb = account && account.downvote_manabar;
    if (!mb || mb.current_mana == null) return { mana: max, max };
    return { mana: regenerate(mb.current_mana, max, mb.last_update_time, nowSec, regen), max };
}

/**
 * rshares a vote of `weight` (−10 000…10 000) would carry right now — the
 * HF20+ vote evaluator: used_mana = mana × |w| × 86 400 / 10 000, divided by
 * vote_power_reserve_rate × regen_seconds (rounded up), minus the dust
 * threshold. Downvotes draw on the downvote pool first, then on voting mana.
 * Returns a signed number (negative for downvotes), 0 when nothing would land.
 */
export function estimateVoteRshares(account, weight, snap, nowMs) {
    const w = Math.max(-HUNDRED_PERCENT, Math.min(HUNDRED_PERCENT, Math.trunc(Number(weight) || 0)));
    if (!account || w === 0) return 0;
    const absW = Math.abs(w);
    const vm = currentVotingMana(account, snap, nowMs);
    const reserve = (snap && snap.reserveRate) || VOTE_DEFAULTS.reserveRate;
    const regen = (snap && snap.regenSeconds) || VOTE_DEFAULTS.regenSeconds;
    const dust = snap && Number.isFinite(snap.dustThreshold) ? snap.dustThreshold : VOTE_DEFAULTS.dustThreshold;

    // Mana the vote consumes (in vesting-satoshi units, ×86 400 as the chain
    // does before dividing by max_vote_denom).
    const wanted = vm.mana * absW / HUNDRED_PERCENT;
    let usedMana;
    const dv = w < 0 ? currentDownvoteMana(account, snap, nowMs) : null;
    if (dv && snap && snap.downvotePoolPercent > 0) {
        // The downvote pool is downvote_pool_percent of voting mana; scaled
        // back to voting-mana units it caps the downvote when it can't cover
        // the requested weight (HF21 vote evaluator).
        const fromPool = dv.mana * HUNDRED_PERCENT / snap.downvotePoolPercent;
        usedMana = Math.min(wanted, fromPool) * SECONDS_PER_DAY;
    } else {
        usedMana = wanted * SECONDS_PER_DAY;
    }

    const denom = reserve * regen;
    const rshares = Math.ceil(usedMana / denom) - dust;
    if (!(rshares > 0)) return 0;
    return w < 0 ? -rshares : rshares;
}

/** Marginal (linear) value in PXS of a vote at `weight` cast now — the recipe's headline figure. */
export function estimateVotePxs(account, weight, snap, nowMs) {
    return rsharesToPxs(estimateVoteRshares(account, weight, snap, nowMs), snap);
}

// ── Voter account cache (vesting + manabar), 20 s TTL per api ─────────

const ACCT_CACHE = new WeakMap(); // api → Map(name → { value, at, inflight })

function acctMap(api) {
    let m = ACCT_CACHE.get(api);
    if (!m) { m = new Map(); ACCT_CACHE.set(api, m); }
    return m;
}

export function getVoterAccountSync(api, name) {
    if (!api || !name) return null;
    const e = acctMap(api).get(name);
    return e && e.value ? e.value : null;
}

/** Drop a cached account — call after the account voted (its manabar moved). */
export function invalidateVoterAccount(api, name) {
    if (!api || !name) return;
    const m = ACCT_CACHE.get(api);
    if (m) m.delete(name);
}

export async function getVoterAccount(api, name, { maxAge = ACCOUNT_TTL_MS, force = false } = {}) {
    if (!api || !api.accounts || typeof api.accounts.getAccounts !== 'function' || !name) return null;
    const m = acctMap(api);
    let e = m.get(name);
    if (!e) { e = { value: null, at: 0, inflight: null }; m.set(name, e); }
    if (!force && e.value && Date.now() - e.at < maxAge) return e.value;
    if (e.inflight) return e.inflight;
    e.inflight = (async () => {
        try {
            const accs = await api.accounts.getAccounts([name]);
            const acc = Array.isArray(accs) ? (accs.find(a => a && (a.name === name || a._entity_id === name)) || accs[0] || null) : null;
            if (acc) { e.value = acc; e.at = Date.now(); }
        } catch (_) { /* keep the last value */ }
        return e.value;
    })().finally(() => { e.inflight = null; });
    return e.inflight;
}

// ── Formatting ────────────────────────────────────────────────────────

/** "0.123" style PXS figure; sub-precision non-zero values show as "<0.001". */
export function formatPxs(v, decimals = 3) {
    const n = Number(v) || 0;
    const abs = Math.abs(n);
    const min = Math.pow(10, -decimals);
    if (abs > 0 && abs < min) return (n < 0 ? '>-' : '<') + min.toFixed(decimals);
    return n.toFixed(decimals);
}
