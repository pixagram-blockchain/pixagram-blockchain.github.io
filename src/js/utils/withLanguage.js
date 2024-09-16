/**
 * utils/withLanguage.js — language subscription for class components.
 *
 * `useLanguage()` in utils/text.js makes a component its own subscriber, and
 * every function component in this app already calls it. **A class cannot.**
 *
 * That gap was invisible because it is not a missing feature — it is a missing
 * possibility. 53 class components render translated text, 47 of them extend
 * `React.PureComponent`, and `PureComponent` shallow-compares props and state
 * exactly the way `memo` does. So when the language changed:
 *
 *   · function components re-rendered, because they had subscribed
 *   · classes did not, because they could not, and their props had not moved
 *
 * The result was a half-translated screen — new labels in the tabs and toolbar,
 * old ones in every wallet dialog, StatusView, WitnessesView and Home.
 *
 * This HOC closes it by holding the subscription *outside* the class and
 * passing the active language down as a prop. The changing prop is the point:
 * `PureComponent`'s shallow compare cannot call two different language codes
 * equal, so the re-render always lands. The class never has to read it.
 *
 *   export default withLanguage(withStyles(styles)(MyDialog));
 *
 * Outermost on purpose. Wrapped inside `withStyles` it would work too, but
 * outermost means one uniform edit per file and no reasoning about which HOC
 * forwards what.
 *
 * `__i18nLang` is safe to add because no class in this codebase spreads
 * `{...this.props}` onto a DOM node — checked before this was written. If that
 * ever changes, React will warn about an unknown attribute, which is a loud
 * failure rather than a silent one.
 */

import { createElement } from "preact";
import { useLanguage } from "./text";

export const withLanguage = (Wrapped) => {
    const WithLanguage = (props) =>
        createElement(Wrapped, { ...props, __i18nLang: useLanguage() });

    WithLanguage.displayName =
        "i18n(" + (Wrapped.displayName || Wrapped.name || "Component") + ")";

    return WithLanguage;
};

export default withLanguage;
