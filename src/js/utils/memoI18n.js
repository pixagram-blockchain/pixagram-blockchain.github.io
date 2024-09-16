/**
 * utils/memoI18n.js — `memo()` that notices a language change.
 *
 * The problem it solves:
 *
 *   const SortingTabs = React.memo(({ … }) => <Tab label={t("words.trending")} />);
 *
 * The label comes from module-level state inside `text.js`, not from a prop. So
 * when the language changes, this component's props are byte-identical and
 * `memo` correctly concludes there is nothing to do. The parent re-renders, the
 * tabs do not, and the old language stays on screen.
 *
 * Threading a nonce down as a prop only fixes the components you remembered to
 * thread it to — and it stops at the first `memo` in between. There were fifty
 * memoised components rendering translated text; the feed's sort tabs and every
 * dialog sat behind that barrier, which is why SettingsDialog appeared to
 * update "one settings edit late": it was not reacting to the language at all,
 * only to its own next prop change.
 *
 * The fix relies on one detail of how memo works: **it blocks re-renders driven
 * by the parent, never a component's own state update.** So a thin wrapper
 * placed INSIDE the memo boundary can subscribe to the language and re-render
 * itself, and memo has no say in it.
 *
 *   memoI18n(Component)  ==  memo(props => { useLanguageTick(); return <Component {...props}/> })
 *
 * Which gives:
 *
 *   · no extra props reach the wrapped component, so nothing leaks onto a DOM
 *     node via {...props}
 *   · class components work — the subscriber is the wrapper, not the class
 *   · memo still does its job for ordinary parent re-renders
 *   · the call-site change is one token: `React.memo(` -> `memoI18n(`
 */

import { memo, useState, useEffect } from "preact/compat";
import { createElement } from "preact";
import { subscribe } from "./text";

/**
 * Subscribe this component to language changes. Returns the tick so the value
 * is genuinely used — a state variable that is only ever set can be dropped by
 * an over-eager minifier.
 */
export const useLanguageTick = () => {
    const [tick, setTick] = useState(0);
    useEffect(() => subscribe(() => setTick((n) => n + 1)), []);
    return tick;
};

/**
 * Drop-in replacement for `memo` / `React.memo`.
 *
 * @param {Function} Component        the component to memoise
 * @param {Function} [areEqual]       optional custom prop comparator
 */
export const memoI18n = (Component, areEqual) => {
    const I18nBoundary = (props) => {
        useLanguageTick();
        return createElement(Component, props);
    };
    I18nBoundary.displayName =
        "i18n(" + (Component.displayName || Component.name || "Component") + ")";
    return memo(I18nBoundary, areEqual);
};

export default memoI18n;
