import { useEffect, useMemo, useState } from 'preact/hooks';
import timeAgo from '../utils/TimeAgo';

// ── Live "time ago" label ───────────────────────────────────────────
// timeAgo.format() is a one-shot snapshot: a card mounted at "12 seconds
// ago" still reads "12 seconds ago" ten minutes later. This hook makes
// the label live by re-rendering the caller when it is due to change,
// at a cadence that scales with the age of the post:
//
//   age < 1 minute  → every second
//   age < 1 hour    → every minute
//   age < 1 day     → every hour
//   older           → every day
//
// Ticks are aligned to the post's own clock (delay = interval − age %
// interval), so "59 seconds ago" flips to "1 minute ago" right on the
// boundary instead of up to one interval late — and a bucket change
// (second → minute cadence) happens naturally on the first tick past it.
//
// Cost model: one chained setTimeout per mounted card — the watcher —
// released in the effect cleanup on unmount, and re-armed when a
// recycled card is retargeted to another post (ts change). Hidden tabs
// throttle but never drop timeouts: an overdue tick fires as soon as
// the tab is visible again, so a long-hidden card catches up by itself.

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function intervalFor(age) {
    if (age < MINUTE) return SECOND;
    if (age < HOUR) return MINUTE;
    if (age < DAY) return HOUR;
    return DAY;
}

/**
 * @param {string|number|Date} date  post/comment timestamp (falls back to
 *                                   "now" when absent or unparsable — same
 *                                   behaviour the cards had inline)
 * @param {object} [options]        forwarded to timeAgo.format
 *                                  (e.g. { labels: 'narrow' })
 * @returns {string} the current relative label, kept fresh
 */
export default function useLiveTimeAgo(date, options) {
    // `!date` mirrors the call sites' old `date || Date.now()` fallback; a
    // missing or unparsable date resolves to null and arms no watcher at all.
    const ts = useMemo(() => {
        if (!date) return null;
        const t = new Date(date).getTime();
        return Number.isFinite(t) ? t : null;
    }, [date]);

    // Tick counter — its only job is forcing a re-render so the format
    // call below re-runs against the current wall clock.
    const [, setTick] = useState(0);

    useEffect(() => {
        if (ts == null) return; // no timestamp → nothing to watch
        let timer = 0;
        let released = false;

        const schedule = () => {
            const age = Math.max(0, Date.now() - ts);
            const interval = intervalFor(age);
            // Wake exactly at the next label boundary; the floor keeps a
            // boundary-adjacent wake-up from re-arming at delay ≈ 0.
            const delay = Math.max(interval - (age % interval), 250);
            timer = setTimeout(() => {
                if (released) return;
                setTick(n => n + 1);
                schedule();
            }, delay);
        };

        schedule();

        // Release the watcher — unmount, or retarget to a new timestamp.
        return () => {
            released = true;
            clearTimeout(timer);
        };
    }, [ts]);

    // No timestamp: render as a static "now" — the old inline fallback —
    // rather than aging a date that doesn't exist.
    return timeAgo.format(ts == null ? Date.now() : ts, options);
}