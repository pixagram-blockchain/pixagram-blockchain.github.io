import * as React from "preact/compat";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import History from "@material-ui/icons/History";
import Image from "@material-ui/icons/Image";
import Reply from "@material-ui/icons/Reply";
import Comment from "@material-ui/icons/CommentRounded";
import Tooltip from "@material-ui/core/Tooltip";

import { t, useLanguage } from "../utils/text";

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

const ProfileTabs = React.memo(({
                                    classes,
                                    category,
                                    onChange,
                                    lessThan960w,
                                    y,
                                    isOwnProfile,
                                    scrollTop
                                }) => {
    useLanguage();

    const postsLabel = t("components.profile_tabs.posts");
    const commentsLabel = t("words.comments");
    const repliesLabel = t("components.profile_tabs.replies");
    const historyLabel = t("words.history");
    const labelDeps = [postsLabel, commentsLabel, repliesLabel, historyLabel];

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

    const tabsStyle = lessThan960w ? {bottom: 0, top: "auto"}: {bottom: "auto", top: 0};
    const transform = lessThan960w ?
        `translateY(${(y > 48 || scrollTop <= 72) ? 0: 72}px)` :
        `translateY(${(-48 > y && scrollTop >= 72) ? -88: 0}px)`;

    return (
        <Tabs
            data-tour="profile-tabs"
            style={{...tabsStyle, transform}}
            className={classes.mainTab}
            value={category}
            variant="fullWidth"
            indicatorColor="primary"
            textColor="primary"
            onChange={onChange}
            fullwidth={true}
        >
            <Tab
                icon={lessThan960w ? MOBILE_ICONS[0] : undefined}
                label={lessThan960w ? undefined : DESKTOP_LABELS[0]}
            />
            <Tab
                icon={lessThan960w ? MOBILE_ICONS[1] : undefined}
                label={lessThan960w ? undefined : DESKTOP_LABELS[1]}
                style={(lessThan960w && isOwnProfile) ? {marginRight: 24}: {}}
            />
            <Tab
                icon={lessThan960w ? MOBILE_ICONS[2] : undefined}
                label={lessThan960w ? undefined : DESKTOP_LABELS[2]}
                style={(lessThan960w && isOwnProfile) ? {marginLeft: 24}: {}}
            />
            <Tab
                icon={lessThan960w ? MOBILE_ICONS[3] : undefined}
                label={lessThan960w ? undefined : DESKTOP_LABELS[3]}
            />
        </Tabs>
    );
});

export default ProfileTabs;
