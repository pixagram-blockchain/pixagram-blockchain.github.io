import { useEffect, useMemo, useState } from 'preact/hooks';
import { resolvePortal, fetchPortalTitle } from '../utils/portal';

/**
 * resolvePortal() for a rendered post, with the title back-filled from the
 * chain when nobody has it up front — one getCommunity() per portal per
 * session, shared through utils/portal's cache.
 *
 * Returns the resolver's { name, title, known } or null. While a lookup is
 * in flight `title` is "" and the caller renders no "in …" segment; once
 * the cache holds an answer the tick below re-runs the resolver and the
 * proper name appears — a single-line, nowrap subheader, so the card's
 * measured height never changes.
 *
 * The pending handle is derived from the CURRENT post, so a virtualized-row
 * recycle re-pointing this instance at another post drops the old lookup on
 * its own (the effect re-keys), and a warm cache costs no effect at all.
 */
export default function usePostPortal(api, data, portal) {
    const [tick, setTick] = useState(0);
    // `tick` is how the cache's arrival reaches a memo keyed on the inputs.
    const resolved = useMemo(() => resolvePortal(data, portal), [data, portal, tick]); // eslint-disable-line react-hooks/exhaustive-deps
    const pending = (resolved && !resolved.known) ? resolved.name : '';
    useEffect(() => {
        if (!pending) return undefined;
        let alive = true;
        fetchPortalTitle(api, pending).then((settled) => {
            if (alive && settled) setTick((n) => n + 1);
        });
        return () => { alive = false; };
    }, [api, pending]);
    return resolved;
}
