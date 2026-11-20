import { h } from 'preact';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { get_cached_settings, subscribe as subscribe_settings } from '../utils/settings';

// ── shared price store ──────────────────────────────────────────────────────
//
// Nothing usePrices() tracks is per-component: token prices, display currency
// and fiat rate are the same for every caller. Each mounted caller used to
// track them on its own anyway, which put one 'prices_updated' listener per
// component on api.eventEmitter. Eleven mounted callers (any feed of cards)
// is enough for the emitter's leak warning (MaxListenersExceededWarning), and
// every one of them also kicked its own prices.get() and getFiatRate().
//
// The state now lives in one store per api. While at least one component is
// mounted the store holds exactly ONE emitter listener and ONE settings
// subscription and fans changes out to every hook instance; when the last
// component unmounts it releases both.

// Bare fallback when there is no PricesAPI to read: mirrors its seed — PXA at
// the 12-cent anchor, PXS at the design Big Mac price (DESIGN_BIG_MAC_USD, 6.22).
const DESIGN_SEED = { pxaUsd: 0.12, pxsUsd: 6.22 };

const NO_API = {};             // store key for callers that have no api yet
const stores = new WeakMap();  // api → store (dies with the api)

const has_fn = (obj, name) => !!obj && typeof obj[name] === 'function';

/** A usable USD→currency rate, or 0 if `rate` is not one. */
const valid_rate = (rate) => {
    const r = Number(rate);
    return Number.isFinite(r) && r > 0 ? r : 0;
};

/** Run `call` — which may return a promise or a plain value, or throw — as a promise. */
const as_promise = (call) => {
    try { return Promise.resolve(call()); } catch (error) { return Promise.reject(error); }
};

function read_currency() {
    const settings = get_cached_settings();
    return (settings && settings.currency) || 'USD';
}

function create_store(prices, emitter) {
    const live = !!(prices && emitter);  // live price events need both
    const subscribers = new Set();       // one re-render callback per mounted hook
    let state = null;      // { pxaUsd, pxsUsd, currency, fiatRate } — replaced, never mutated
    let detach = null;     // set while at least one component is subscribed
    let refreshed = false; // refresh() already ran in this tick

    // USD prices out of a PricesAPI snapshot (event payload or getSync()).
    const usd_of = (snap) => ({
        pxaUsd: Number(snap && snap.pxaUsd) || 0,
        pxsUsd: Number(snap && snap.pxsUsd) || 0,
    });
    const read_usd = () => usd_of(has_fn(prices, 'getSync') ? prices.getSync() : DESIGN_SEED);

    // The rate PricesAPI already holds for `currency` — no network involved.
    const cached_rate = (currency) => {
        if (currency === 'USD' || !has_fn(prices, 'getFiatRate') || !has_fn(prices, 'usdToFiat')) return 1;
        return valid_rate(prices.usdToFiat(1, currency)) || 1;
    };

    // Swap in a new state object only when a value really changed, so a
    // 'prices_updated' that carries the same numbers re-renders nothing.
    const commit = (next) => {
        if (state && Object.keys(next).every((key) => Object.is(state[key], next[key]))) return false;
        state = { ...state, ...next };
        return true;
    };
    const publish = (next) => {
        if (commit(next)) subscribers.forEach((notify) => notify());
    };

    // Re-read the synchronous sources without notifying anyone. The store hears
    // no events while nothing is mounted, so reads go through here until then.
    // Rate: what PricesAPI has cached if it has anything (a cached_rate of 1
    // also means "nothing"), else the last rate seen for this currency, else 1.
    const resync = () => {
        const currency = read_currency();
        const cached = cached_rate(currency);
        const last_seen = state && state.currency === currency ? state.fiatRate : 1;
        commit({ ...read_usd(), currency, fiatRate: cached !== 1 ? cached : last_seen });
    };

    // Refresh the USD→currency rate from the network (PricesAPI caches it).
    const request_rate = () => {
        const { currency } = state;
        if (currency === 'USD' || !has_fn(prices, 'getFiatRate')) return;
        as_promise(() => prices.getFiatRate(currency)).then((rate) => {
            const r = valid_rate(rate);
            // Drop an answer for a currency the user has since left. A failed
            // or unusable refresh keeps the rate already on screen instead of
            // resetting it to 1.
            if (r && state.currency === currency) publish({ fiatRate: r });
        }, () => {});
    };

    const on_prices = (next) => publish(next ? usd_of(next) : read_usd());

    const on_settings = (settings) => {
        const currency = (settings && settings.currency) || 'USD';
        if (currency === state.currency) return;
        // Code and rate change in one step: no render ever pairs the new
        // currency code with the previous currency's rate.
        publish({ currency, fiatRate: cached_rate(currency) });
        request_rate();
    };

    const attach = () => {
        // Catch up BEFORE subscribing: nothing was listening until now, and
        // settings.subscribe() replays the current bag to a new subscriber as
        // soon as its cache is warm. If init() landed between the first paint
        // and this call, that replay would carry a currency this store has not
        // seen yet and trigger its own rate request, on top of refresh()'s.
        // After the resync the replay finds nothing changed.
        resync();
        if (live) emitter.on('prices_updated', on_prices);
        const unsubscribe_settings = subscribe_settings(on_settings);
        return () => {
            if (live) emitter.off('prices_updated', on_prices);
            if (typeof unsubscribe_settings === 'function') unsubscribe_settings();
        };
    };

    resync();

    return {
        prices,
        emitter,

        /** Current snapshot. Its identity changes only when a value changes. */
        get_state() {
            if (!detach) resync();
            return state;
        },

        /** Register a re-render callback; returns its unsubscribe. */
        subscribe(notify) {
            subscribers.add(notify);
            if (!detach) detach = attach();
            return () => {
                subscribers.delete(notify);
                if (subscribers.size === 0 && detach) {
                    detach();
                    detach = null;
                }
            };
        },

        /**
         * Ask PricesAPI for fresh prices and a fresh rate, so values move past
         * the synchronous seed. Every mounting component calls this; a whole
         * batch of mounts (one effects flush) collapses into a single request.
         */
        refresh() {
            if (refreshed) return;
            refreshed = true;
            Promise.resolve().then(() => { refreshed = false; });
            if (live && has_fn(prices, 'get')) as_promise(() => prices.get()).catch(() => {});
            request_rate();
        },
    };
}

function get_store(api) {
    const key = api || NO_API;
    const prices = (api && api.prices) || null;
    const emitter = (api && api.eventEmitter) || null;
    let store = stores.get(key);
    // Rebuild if the api swapped its PricesAPI or emitter. The old store lets
    // go of its listener as its components move over to the new one.
    if (!store || store.prices !== prices || store.emitter !== emitter) {
        store = create_store(prices, emitter);
        stores.set(key, store);
    }
    return store;
}

/**
 * Live token prices + the user's display currency, in one hook.
 *
 * Token values are anchored in USD by PricesAPI (pixaproxyapi): PXA is the
 * one anchored token — 12 cents until it is listed, the exchange/CoinGecko
 * spot afterwards (PricesAPI.EXCHANGE_ENABLED) — and PXS is always derived
 * from it through the on-chain PXS/PXA ratio: PXS = PXA × ratio. Either way
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
 *
 * All callers share one store per api (see above), so mounting this hook in
 * any number of components costs the api's emitter a single listener.
 */
export function usePrices(api) {
    const store = get_store(api);

    // Read the store during render: the first paint — and a switch to another
    // api — shows its current values straight away. The counter below holds no
    // data; bumping it is just how the store asks this component to re-render.
    const state = store.get_state();
    const rendered = useRef(state);
    rendered.current = state;
    const [, set_tick] = useState(0);

    useEffect(() => {
        const rerender = () => set_tick((tick) => tick + 1);
        const unsubscribe = store.subscribe(rerender);
        // Catch a change that landed between this render and the subscribe.
        if (store.get_state() !== rendered.current) rerender();
        store.refresh();
        return unsubscribe;
    }, [store]);

    const { pxaUsd, pxsUsd, currency, fiatRate } = state;

    const toFiat = useCallback((usd) => (Number(usd) || 0) * fiatRate, [fiatRate]);
    const formatFiat = useCallback(
        (usd, decimals = 2) =>
            `${((Number(usd) || 0) * fiatRate).toFixed(decimals)} ${currency}`,
        [fiatRate, currency]
    );

    return { pxsUsdPrice: pxsUsd, pxaUsdPrice: pxaUsd, currency, fiatRate, toFiat, formatFiat };
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