import * as React from "preact/compat";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import ButtonBase from "@material-ui/core/ButtonBase";
import History from "@material-ui/icons/History";
import Image from "@material-ui/icons/Image";
import Reply from "@material-ui/icons/Reply";
import Comment from "@material-ui/icons/CommentRounded";
import AddAPhoto from "@material-ui/icons/AddAPhoto";
import Tooltip from "@material-ui/core/Tooltip";

import { t, useLanguage } from "../utils/text";
import { isPlainClick } from "../utils/link";

// Desktop shows an inline icon + text label per tab (the icons alone were
// ambiguous); mobile keeps the compact icon-only tabs with tooltips.
// Hoisting was the point here, but BOTH arrays carry text — the mobile icons
// through their tooltip titles — so at module scope they resolved once when
// this chunk was parsed and stayed in that locale: switching language in
// Settings left the tabs (and their tooltips) reading the old one until a full
// reload, and the first-visit tour, whose step titles reuse these very keys,
// would then disagree with the tabs it points at. Both are built inside the
// component now, memoised on the resolved strings so vnode identity stays
// stable across scroll ticks exactly as before.
const LABEL_ROW = { display: "inline-flex", alignItems: "center" };
const LABEL_TEXT = { marginLeft: 8 };

// A tab is a link to the address its click writes (utils/link): `hrefs[i]`,
// handed by Profile ("/@name", "/@name/comments"…). Ctrl/Cmd+click, the
// middle button and the browser's menu open that tab of the profile in
// another browser tab; a plain click is onChange, as before. Without an
// address (the profile's name is not known yet) a tab is the plain button it
// was.
const tabLink = (hrefs, i) => (hrefs && hrefs[i]
    ? { component: "a", href: hrefs[i], "data-nav": "", draggable: false }
    : null);

// ── The bar's root element ─────────────────────────────────────────────
// MUI renders the Tabs root through `component`. This one is the same <div>
// with room for one more child, `trailing`, placed after the tab scroller:
// INSIDE the bar's own element — sliding, hiding and entering with it as
// one — yet OUTSIDE the tablist, whose children have to be tabs (its
// arrow-key navigation walks DOM siblings). That is where the mobile create
// button lives: part of the bar, not a second shape floating over it.
const TabsBar = React.forwardRef(function TabsBar({ trailing, children, ...rest }, ref) {
    return <div ref={ref} {...rest}>{children}{trailing}</div>;
});

// Whether the bar is tucked away: slid down off the bottom edge on mobile,
// up off the top edge on desktop. Profile passes `hidden`, a flag that flips
// a few times per scroll; the raw y/scrollTop pair is still accepted and
// reduced to the same flag with the thresholds this bar has always used.
// `forceHidden` tucks it whatever the scroll position: Profile sets it while
// the mobile card is expanded. It used to be passed and ignored here — only
// the floating create button stepped away — and the bar now holds that button.
const isTucked = ({ hidden, forceHidden, lessThan960w, y, scrollTop }) => (
    forceHidden
        ? true
        : hidden !== undefined
            ? !!hidden
            : (lessThan960w ? !(y > 48 || scrollTop <= 72) : (-48 > y && scrollTop >= 72))
);

// Shallow, like the default memo compare, except that the raw scroll numbers
// count only through isTucked — a tick that crosses no threshold changes
// nothing on screen, so it no longer re-renders the Tabs (whose indicator
// measures the DOM on every render).
const sameProps = (prev, next) => {
    for (const k in prev) {
        if (k !== "y" && k !== "scrollTop" && prev[k] !== next[k]) return false;
    }
    for (const k in next) {
        if (k !== "y" && k !== "scrollTop" && !(k in prev)) return false;
    }
    return isTucked(prev) === isTucked(next);
};

const ProfileTabs = React.memo(({
                                    classes,
                                    category,
                                    onChange,
                                    hrefs,
                                    lessThan960w,
                                    hidden,
                                    forceHidden,
                                    y,
                                    isOwnProfile,
                                    scrollTop,
                                    onCreate,
                                    createLabel,
                                    createOpen
                                }) => {
    useLanguage();

    const postsLabel = t("components.profile_tabs.posts");
    const commentsLabel = t("words.comments");
    const repliesLabel = t("components.profile_tabs.replies");
    const historyLabel = t("words.history");
    const labelDeps = [postsLabel, commentsLabel, repliesLabel, historyLabel];

    // The click rule of a link, for the tabs that are one: a modified click
    // is the browser's and changes nothing here.
    const handleChange = React.useCallback((event, value) => {
        if (hrefs && hrefs[value]) {
            if (!isPlainClick(event)) return;
            event.preventDefault();
        }
        onChange(event, value);
    }, [hrefs, onChange]);

    const MOBILE_ICONS = React.useMemo(() => [
        <Tooltip title={postsLabel}><Image /></Tooltip>,
        <Tooltip title={commentsLabel}><Comment /></Tooltip>,
        <Tooltip title={repliesLabel}><Reply /></Tooltip>,
        <Tooltip title={historyLabel}><History /></Tooltip>,
    ], labelDeps);

    const DESKTOP_LABELS = React.useMemo(() => [
        <span style={LABEL_ROW}><Image /><span style={LABEL_TEXT}>{postsLabel}</span></span>,
        <span style={LABEL_ROW}><Comment /><span style={LABEL_TEXT}>{commentsLabel}</span></span>,
        <span style={LABEL_ROW}><Reply /><span style={LABEL_TEXT}>{repliesLabel}</span></span>,
        <span style={LABEL_ROW}><History /><span style={LABEL_TEXT}>{historyLabel}</span></span>,
    ], labelDeps);

    // ── Create button (mobile, own profile) ────────────────────────────
    // The circle at the bottom bar's centre, bigger than the bar: where a
    // round button used to float over a gap between the second and third
    // tab, the bar itself now swells around it. The page styles draw that
    // bulge and keep the middle of the tab row free (mainTabWithCreate), and
    // size this button to the circle (mainTabCreate); TabsBar renders it
    // inside the bar's root, so bar and button are one element, one outline.
    // While the dialog it opens is up (`createOpen`), the white area — the
    // tab indicator — leaves its tab and rests on the circle: one more class
    // on the bar (mainTabCreateActive), nothing measured or timed in here.
    const showCreate = !!(lessThan960w && isOwnProfile && onCreate);
    const createActive = showCreate && !!createOpen;
    const createButton = React.useMemo(() => (showCreate ? (
        <Tooltip title={createLabel || ""}>
            <ButtonBase className={classes.mainTabCreate} onClick={onCreate} aria-label={createLabel}
                        aria-haspopup="dialog" aria-expanded={createActive} focusRipple>
                <AddAPhoto />
            </ButtonBase>
        </Tooltip>
    ) : null), [showCreate, createActive, createLabel, onCreate, classes.mainTabCreate]);
    const barClassName = !showCreate ? classes.mainTab
        : `${classes.mainTab} ${classes.mainTabWithCreate}${createActive ? ` ${classes.mainTabCreateActive}` : ""}`;

    const tabsStyle = lessThan960w ? {bottom: 0, top: "auto"}: {bottom: "auto", top: 0};
    const tucked = isTucked({ hidden, forceHidden, lessThan960w, y, scrollTop });
    // Tucked under the bottom edge, the bar goes 16px further when it carries
    // the create circle, which stands proud of it: 8px with the 64px circle,
    // and this leaves room for one up to 80px (BULGE_D in the page styles).
    const transform = lessThan960w ?
        `translateY(${tucked ? (showCreate ? 88 : 72) : 0}px)` :
        `translateY(${tucked ? -88 : 0}px)`;

    return (
        <Tabs
            component={TabsBar}
            trailing={createButton}
            data-tour="profile-tabs"
            style={{...tabsStyle, transform}}
            className={barClassName}
            value={category}
            variant="fullWidth"
            indicatorColor="primary"
            textColor="primary"
            onChange={handleChange}
            fullwidth={true}
        >
            <Tab
                {...tabLink(hrefs, 0)}
                icon={lessThan960w ? MOBILE_ICONS[0] : undefined}
                label={lessThan960w ? undefined : DESKTOP_LABELS[0]}
            />
            <Tab
                {...tabLink(hrefs, 1)}
                icon={lessThan960w ? MOBILE_ICONS[1] : undefined}
                label={lessThan960w ? undefined : DESKTOP_LABELS[1]}
            />
            <Tab
                {...tabLink(hrefs, 2)}
                icon={lessThan960w ? MOBILE_ICONS[2] : undefined}
                label={lessThan960w ? undefined : DESKTOP_LABELS[2]}
            />
            <Tab
                {...tabLink(hrefs, 3)}
                icon={lessThan960w ? MOBILE_ICONS[3] : undefined}
                label={lessThan960w ? undefined : DESKTOP_LABELS[3]}
            />
        </Tabs>
    );
}, sameProps);

export default ProfileTabs;