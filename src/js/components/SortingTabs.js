import * as React from "preact/compat";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import TrendingUp from "@material-ui/icons/TrendingUp";
import NewReleases from "@material-ui/icons/NewReleases";
import Whatshot from "@material-ui/icons/Whatshot";
import LocalOffer from "@material-ui/icons/LocalOffer";

import { t, useLanguage } from "../utils/text";

// Icon + label pairs, in the order of the ranked-post sort methods used by the
// pages mounting this component: created, hot, trending, promoted. (Icons were
// previously in a different order than the sorts they triggered — realigned so
// tab 0 = Newer/created, matching Feed's own tabs.)
// Hoisted to module scope so scroll-driven re-renders (y/scrollTop change on
// every tick) don't rebuild these vnodes — same pattern as Feed/Profile.
//
// Only the ICONS can be hoisted: they carry no text. The labelled faces used to
// sit here too, which resolved them once when this chunk was parsed and froze
// them in that locale — switching language in Settings left the tabs reading
// the old one until a full reload, and the first-visit tour (whose copy names
// these four tabs) would then disagree with them. They are built inside the
// component, memoised on the resolved strings so vnode identity is still
// stable across scroll ticks.
const LABEL_ROW = { display: "inline-flex", alignItems: "center" };
const LABEL_TEXT = { marginLeft: 8 };

const MOBILE_ICONS = [
    <NewReleases />,
    <Whatshot />,
    <TrendingUp />,
    <LocalOffer />,
];

const SortingTabs = React.memo(({ 
    sorting, 
    onSortingChange, 
    mainTabClass, 
    lessThan960w, 
    y, 
    scrollTop 
}) => {
    useLanguage();

    const newerLabel = t("words.newer");
    const hottestLabel = t("words.hottest");
    const trendingLabel = t("words.trending");
    const promotedLabel = t("words.promoted");
    const DESKTOP_LABELS = React.useMemo(() => [
        <span style={LABEL_ROW}><NewReleases /><span style={LABEL_TEXT}>{newerLabel}</span></span>,
        <span style={LABEL_ROW}><Whatshot /><span style={LABEL_TEXT}>{hottestLabel}</span></span>,
        <span style={LABEL_ROW}><TrendingUp /><span style={LABEL_TEXT}>{trendingLabel}</span></span>,
        <span style={LABEL_ROW}><LocalOffer /><span style={LABEL_TEXT}>{promotedLabel}</span></span>,
    ], [newerLabel, hottestLabel, trendingLabel, promotedLabel]);

    const tabsStyle = lessThan960w ? {bottom: 0, top: "auto"}: {bottom: "auto", top: 0};
    const transform = lessThan960w 
        ? `translateY(${(y > 48 || scrollTop <= 72) ? 0: 72}px)` 
        : `translateY(${(-48 > y && scrollTop >= 72) ? -72: 0}px)`;

    return (
        <Tabs
            data-tour="sorting-tabs"
            style={{...tabsStyle, transform}}
            className={mainTabClass}
            value={sorting}
            variant="fullWidth"
            indicatorColor="primary"
            textColor="primary"
            onChange={onSortingChange}
            fullwidth={true}
        >
            <Tab icon={lessThan960w ? MOBILE_ICONS[0] : undefined} label={lessThan960w ? undefined : DESKTOP_LABELS[0]} />
            <Tab icon={lessThan960w ? MOBILE_ICONS[1] : undefined} label={lessThan960w ? undefined : DESKTOP_LABELS[1]} />
            <Tab icon={lessThan960w ? MOBILE_ICONS[2] : undefined} label={lessThan960w ? undefined : DESKTOP_LABELS[2]} />
            <Tab icon={lessThan960w ? MOBILE_ICONS[3] : undefined} label={lessThan960w ? undefined : DESKTOP_LABELS[3]} />
        </Tabs>
    );
}, (prevProps, nextProps) => {
    return prevProps.sorting === nextProps.sorting &&
        prevProps.lessThan960w === nextProps.lessThan960w &&
        prevProps.y === nextProps.y &&
        prevProps.scrollTop === nextProps.scrollTop;
});

export default SortingTabs;
