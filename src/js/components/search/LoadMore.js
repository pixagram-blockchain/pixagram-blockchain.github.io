"use strict";
import React, { useCallback, useEffect, useState } from "preact/compat";
import CircularProgress from "@material-ui/core/CircularProgress";

import { t, useLanguage } from "../../utils/text";

import { MORE_AHEAD_PX } from "./config";
import { tr } from "./highlight";

// ── LoadMore ──────────────────────────────────────────────────────────────────
// The end of the artwork grid, the last thing in the results: where their next
// page comes from. An IntersectionObserver rooted on the results' scrolling list
// (`root`) watches this line and asks for the page (`onMore`) as soon as it comes
// within MORE_AHEAD_PX of the list's bottom edge, before the reader gets there.
// It is armed again after every page (`more`, the continuation, is a new object
// each time), so a page that leaves the line in reach brings the next one at
// once. While a page comes: a spinner. When it could not come: "Try again" (no
// automatic retry, which would hammer a Worker that is down or rate-limiting);
// a successful try arms it again. Without IntersectionObserver: a "Load more"
// button. Past LIMITS.artworksMax (`capped`): a line asking to narrow the search.
// Nothing at all once the Worker has no more.

export const LoadMore = React.memo(
    ({ classes, root, more, loading, failed, capped, onMore }) => {
        useLanguage();
        const [line, setLine] = useState(null);
        const auto = typeof IntersectionObserver === "function";
        const armed = auto && !!line && !!root && !!more && !!onMore && !loading && !failed;
        useEffect(() => {
            if (!armed) return undefined;
            const io = new IntersectionObserver(
                (entries) => {
                    if (entries.some((e) => e.isIntersecting)) onMore();
                },
                { root, rootMargin: `0px 0px ${MORE_AHEAD_PX}px 0px` },
            );
            io.observe(line);
            return () => io.disconnect();
        }, [armed, line, root, more, onMore]);
        const onClick = useCallback(() => {
            if (onMore) onMore();
        }, [onMore]);

        if (!onMore || (!more && !loading && !failed && !capped)) return null;
        let content = null;
        if (loading) {
            content = <CircularProgress size={18} style={{ color: "#666" }} />;
        } else if (failed || (!auto && more)) {
            content = (
                <button type="button" className={classes.loadMoreButton} onClick={onClick}>
                    {failed
                        ? tr(t, "components.search_results.try_again", "Try again")
                        : tr(t, "components.search_results.load_more", "Load more")}
                </button>
            );
        } else if (capped && !more) {
            content = (
                <p className={classes.loadMoreEnd}>
                    {tr(t, "components.search_results.narrow_the_search_to_see_more_artworks", "Narrow the search to see more artworks.")}
                </p>
            );
        }
        return (
            <div ref={setLine} className={classes.loadMore + (content ? " " + classes.loadMoreFilled : "")}>
                {content}
            </div>
        );
    },
    (prev, next) =>
        prev.root === next.root &&
        prev.more === next.more &&
        prev.loading === next.loading &&
        prev.failed === next.failed &&
        prev.capped === next.capped &&
        prev.onMore === next.onMore &&
        prev.classes === next.classes,
);
