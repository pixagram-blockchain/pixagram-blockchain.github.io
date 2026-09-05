import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { get_cached_settings, subscribe as subscribe_settings } from '../utils/settings';

/**
 * Live token prices + the user's display currency, in one hook.
 *
 * Token values are anchored in USD by PricesAPI (pixaproxyapi): exactly one
 * token is fixed and the other derived through the on-chain PXS/PXA ratio.
 * While PXA has no exchange listing (PricesAPI.EXCHANGE_ENABLED = false) PXS
 * is the fixed side and PXA = PXS ÷ ratio; once the exchange anchor is
 * switched on, PXA comes from the exchange and PXS = PXA × ratio. Either way
 * this hook only sees pxaUsd / pxsUsd. The *display* currency is a pure
 * front-end concern: we read the user's selected currency from settings and a
 * USD→currency rate from Frankfurter (cached on api.prices), then expose
 * helpers to convert/format any USD figure.
 *
 * Returns:
 *   - pxsUsdPrice / pxaUsdPrice : USD per 1 PXS / PXA   (unchanged field names —
 *                                 existing callers depend on these)
 *   - currency                 : ISO 4217 code, e.g. "CHF"
 *   - fiatRate                 : units of `currency` per 1 USD (1 for USD)
 *   - toFiat(usd)              : number, usd converted to `currency`
 *   - formatFiat(usd, d=2)     : string, e.g. "12.34 CHF"
 *
 * Everything re-renders live: price changes arrive via the 'prices_updated'
 * event, currency changes via the settings subscription, and the fiat rate is
 * (re)fetched whenever the currency changes.
 */
export function usePrices(api) {
    const prices = api && api.prices;

    // Seed synchronously so the first paint already shows real numbers (design
    // fallbacks until the live chain / exchange / fiat reads land).
    const [snap, setSnap] = useState(() =>
        prices && typeof prices.getSync === 'function'
            ? prices.getSync()
            : { pxaUsd: 0.12, pxsUsd: 6.12 }
    );
    const [currency, setCurrency] = useState(
        () => get_cached_settings().currency || 'USD'
    );
    const [fiatRate, setFiatRate] = useState(1);

    // ── live token prices (PricesAPI emits on api.eventEmitter) ─────────────
    useEffect(() => {
        if (!api || !api.eventEmitter || !prices) return undefined;
        // Kick a refresh so values move past the synchronous design seed.
        if (typeof prices.get === 'function') prices.get().catch(() => {});
        const on_prices = (next) => setSnap(next || prices.getSync());
        api.eventEmitter.on('prices_updated', on_prices);
        // Catch an update that may have landed between seed and subscribe.
        setSnap(prices.getSync());
        return () => { api.eventEmitter.off('prices_updated', on_prices); };
    }, [api, prices]);

    // ── live display currency (settings pub/sub) ────────────────────────────
    useEffect(() => {
        const unsub = subscribe_settings((s) => {
            setCurrency((s && s.currency) || 'USD');
        });
        return unsub;
    }, []);

    // ── (re)fetch USD→currency rate whenever the currency changes ───────────
    useEffect(() => {
        let cancelled = false;
        const cur = currency || 'USD';

        if (!prices || typeof prices.getFiatRate !== 'function' || cur === 'USD') {
            setFiatRate(1);
            return () => { cancelled = true; };
        }

        // Optimistic: use whatever is already cached, then refresh from network.
        if (typeof prices.usdToFiat === 'function') {
            setFiatRate(prices.usdToFiat(1, cur));
        }
        prices.getFiatRate(cur)
            .then((rate) => {
                if (cancelled) return;
                const r = Number(rate);
                setFiatRate(Number.isFinite(r) && r > 0 ? r : 1);
            })
            .catch(() => { if (!cancelled) setFiatRate(1); });

        return () => { cancelled = true; };
    }, [prices, currency]);

    const pxaUsdPrice = Number(snap && snap.pxaUsd) || 0;
    const pxsUsdPrice = Number(snap && snap.pxsUsd) || 0;
    const rate = Number.isFinite(fiatRate) && fiatRate > 0 ? fiatRate : 1;
    const cur = currency || 'USD';

    const toFiat = useCallback((usd) => (Number(usd) || 0) * rate, [rate]);
    const formatFiat = useCallback(
        (usd, decimals = 2) =>
            `${((Number(usd) || 0) * rate).toFixed(decimals)} ${cur}`,
        [rate, cur]
    );

    return { pxsUsdPrice, pxaUsdPrice, currency: cur, fiatRate: rate, toFiat, formatFiat };
}

/**
 * Class-component bridge: injects the live usePrices() result as a `prices`
 * prop ({ pxsUsdPrice, pxaUsdPrice, currency, fiatRate, toFiat, formatFiat }),
 * reading the api from `props.api`. Used by VotingListModal and
 * VoteWeightDialog, which are class components and can't call the hook.
 */
export function withPrices(Component) {
    const WithPrices = (props) => h(Component, { ...props, prices: usePrices(props.api) });
    WithPrices.displayName = `withPrices(${Component.displayName || Component.name || 'Component'})`;
    return WithPrices;
}

export default usePrices;