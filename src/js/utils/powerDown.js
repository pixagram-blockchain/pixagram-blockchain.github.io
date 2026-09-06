/**
 * utils/powerDown.js — what a power-down actually pays, and when.
 *
 * A `withdraw_vesting` splits the requested VESTS into equal instalments
 * (`vesting_withdraw_rate`), one per interval; each instalment is converted
 * to liquid PXA at the vesting price *of the day it fills*. The chain's two
 * schedule constants are read from `get_config` when the API exposes it
 * (HIVE/PIXA_VESTING_WITHDRAW_INTERVALS, …_INTERVAL_SECONDS) and default to
 * the Hive schedule — 13 instalments, one a week — otherwise.
 *
 * Two entry points:
 *   previewPowerDown()  — before broadcasting: the plan for an amount
 *   powerDownStatus()   — after: the live schedule from the account object
 *
 * Both return plain numbers/Dates; formatting is the caller's job
 * (utils/numberFormat.js).
 */

import { parseChainDate } from "./numberFormat";

export const DEFAULT_POWER_DOWN_INTERVALS = 13;
export const DEFAULT_POWER_DOWN_INTERVAL_SECONDS = 7 * 24 * 60 * 60;

// to_withdraw / withdrawn are integers in micro-VESTS (1e6 = 1 VESTS).
const MICRO = 1e6;

const posNumber = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : fallback;
};

/**
 * Pick the withdraw schedule out of a `get_config` bag whatever the fork
 * prefix (HIVE_, STEEM_, PIXA_…). Unknown / missing → defaults.
 */
export const readPowerDownConfig = (config) => {
    let intervals = DEFAULT_POWER_DOWN_INTERVALS;
    let intervalSeconds = DEFAULT_POWER_DOWN_INTERVAL_SECONDS;
    if (config && typeof config === "object") {
        for (const k of Object.keys(config)) {
            if (/_VESTING_WITHDRAW_INTERVALS$/.test(k)) intervals = posNumber(config[k], intervals);
            else if (/_VESTING_WITHDRAW_INTERVAL_SECONDS$/.test(k)) intervalSeconds = posNumber(config[k], intervalSeconds);
        }
    }
    return { intervals: Math.round(intervals), intervalSeconds: Math.round(intervalSeconds) };
};

// Chain-wide, so one lookup per session is plenty.
let _configPromise = null;

/**
 * Resolve the schedule from the node (cached). Never rejects: a node or API
 * without `get_config` yields the defaults.
 */
export const loadPowerDownConfig = (api) => {
    if (_configPromise) return _configPromise;
    let answered = false;
    _configPromise = (async () => {
        try {
            const g = api && api.globals;
            if (g && typeof g.getConfig === "function") {
                const cfg = await g.getConfig();
                if (cfg && typeof cfg === "object") {
                    answered = true;
                    return readPowerDownConfig(cfg);
                }
            }
        } catch (_) { /* fall through to defaults */ }
        return readPowerDownConfig(null);
    })();
    // A lookup the node did not answer is retried next time (node switch,
    // transient error); a real answer is kept for the session.
    _configPromise.then(() => { if (!answered) _configPromise = null; });
    return _configPromise;
};

/**
 * The plan for powering down `amountPxa` (PXP expressed in PXA terms, as the
 * wallet holds it) — instalment size, first and last payment dates, total.
 */
export const previewPowerDown = ({ amountPxa, intervals, intervalSeconds, now = Date.now() }) => {
    const n = Math.max(1, Math.round(posNumber(intervals, DEFAULT_POWER_DOWN_INTERVALS)));
    const secs = posNumber(intervalSeconds, DEFAULT_POWER_DOWN_INTERVAL_SECONDS);
    const total = Math.max(0, Number(amountPxa) || 0);
    return {
        instalments: n,
        intervalDays: secs / 86400,
        instalmentPxa: total / n,
        totalPxa: total,
        firstDate: new Date(now + secs * 1000),
        lastDate: new Date(now + secs * 1000 * n),
    };
};

/**
 * The live schedule of an active power-down.
 *
 * @param rateVests        vesting_withdraw_rate as a VESTS number (per instalment)
 * @param toWithdrawMicro  to_withdraw   (micro-VESTS, chain integer)
 * @param withdrawnMicro   withdrawn     (micro-VESTS, chain integer)
 * @param nextDate         next_vesting_withdrawal (chain timestamp)
 * @param vestToPixa       live VESTS → PXA converter
 *
 * Per chain rule each fill pays min(rate, remaining) — the last instalment is
 * whatever is left. The instalment count is rounded rather than ceil'd
 * because the chain computes the rate with integer division, which leaves a
 * few micro-VESTS of remainder that would otherwise count as a phantom extra
 * week.
 */
export const powerDownStatus = ({ rateVests, toWithdrawMicro, withdrawnMicro, nextDate, vestToPixa, intervals, intervalSeconds, now = Date.now() }) => {
    const rate = Number(rateVests) || 0;
    const toWithdraw = (Number(toWithdrawMicro) || 0) / MICRO;
    const withdrawn = (Number(withdrawnMicro) || 0) / MICRO;
    const remaining = Math.max(0, toWithdraw - withdrawn);
    const conv = typeof vestToPixa === "function" ? vestToPixa : (v) => Number(v) || 0;
    const active = rate > 0 && remaining > 0;
    const secs = posNumber(intervalSeconds, DEFAULT_POWER_DOWN_INTERVAL_SECONDS);
    const n = Math.max(1, Math.round(posNumber(intervals, DEFAULT_POWER_DOWN_INTERVALS)));

    if (!active) {
        return { active: false, nextPxa: 0, nextDate: null, daysToNext: 0, instalmentsLeft: 0, totalInstalments: n, remainingPxa: 0, paidPxa: 0, totalPxa: 0, completionDate: null };
    }

    const next = parseChainDate(nextDate);
    const instalmentsLeft = Math.max(1, Math.round(remaining / rate));
    const totalInstalments = Math.max(instalmentsLeft, Math.round(toWithdraw / rate) || n);
    const nextVests = Math.min(rate, remaining);
    const daysToNext = next ? Math.max(0, Math.ceil((next.getTime() - now) / 86400000)) : 0;
    const completionDate = next ? new Date(next.getTime() + (instalmentsLeft - 1) * secs * 1000) : null;

    return {
        active: true,
        nextPxa: conv(nextVests),
        nextDate: next,
        daysToNext,
        instalmentsLeft,
        totalInstalments,
        remainingPxa: conv(remaining),
        paidPxa: conv(withdrawn),
        totalPxa: conv(toWithdraw),
        completionDate,
    };
};
