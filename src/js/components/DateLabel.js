import * as React from 'preact/compat';
import { h } from 'preact';
import { memo } from 'preact/compat';
import { useMemo } from 'preact/hooks';
import Tooltip from '@material-ui/core/Tooltip';
import useLiveTimeAgo from '../hooks/useLiveTimeAgo';
import { useLanguage } from '../utils/text';

// ── The "<time ago>" span with its full-date tooltip ─────────────────
// One leaf shared by every card (PaperCard, PaperCardBlog, PaperCardReply
// and, through it, PaperCardComment). It exists for one reason:
// useLiveTimeAgo re-renders its host exactly when the label is due to
// change — every second under a minute old, every minute under an hour,
// every hour under a day, then daily. Hosted in a card, each tick re-ran
// the whole card: header, avatar, menu button, author hover anchor, the
// artwork ButtonBase or the excerpt, PaperCardActions and its vote
// buttons. On a fresh feed with twenty cards a few minutes old that was
// twenty full card renders a minute for a five-character label. Hosted
// here, a tick re-renders one span and the Tooltip around it, and the
// card above never hears about it.
//
// The card's own useLanguage() no longer reaches this label (memo), so
// the leaf subscribes itself: a language switch re-renders it at once
// instead of waiting for the next tick — which, for a week-old post, is
// tomorrow.

// The options the cards' old inline toLocaleDateString calls used, so the
// tooltip text is unchanged: toLocaleDateString hands its options through
// untouched whenever any date field is present, which they are.
const FULL_DATE_OPTS = {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric',
};

// `toLocaleDateString(locales, opts)` builds a fresh Intl.DateTimeFormat on
// every call — and that used to run on every render of every card. One
// formatter per locale for the whole page; the string itself is memoized
// per card on (date, locales).
const _dateFormatters = new Map();
export function formatFullDate(ts, locales) {
    const key = Array.isArray(locales) ? locales.join(',') : String(locales || '');
    let f = _dateFormatters.get(key);
    if (!f) {
        try {
            f = new Intl.DateTimeFormat(locales || undefined, FULL_DATE_OPTS);
        } catch (e) {
            // Malformed locale tag — the old inline call would have thrown
            // out of render here; fall back to the browser default instead.
            f = new Intl.DateTimeFormat(undefined, FULL_DATE_OPTS);
        }
        _dateFormatters.set(key, f);
    }
    return f.format(new Date(ts || Date.now()));
}

// Hoisted so the hook sees the same options object on every render.
const NARROW_LABELS = { labels: 'narrow' };

/**
 * Props:
 *   date       — timestamp (ms) the relative label counts from
 *   locales    — settings._selected_locales_code, for the full date
 *   className  — the card's subheaderDate class
 *   narrow     — "5m" / "3h" labels (the artwork and blog cards) instead of
 *                the hook's default long form (the comment cards)
 */
const DateLabel = memo(function DateLabel({ date, locales, className, narrow = false }) {
    useLanguage();
    const liveTimeAgo = useLiveTimeAgo(date, narrow ? NARROW_LABELS : undefined);
    const fullDate = useMemo(() => formatFullDate(date, locales), [date, locales]);
    return (
        <Tooltip arrow title={fullDate}>
            <span className={className}>{liveTimeAgo}</span>
        </Tooltip>
    );
});

export default DateLabel;
