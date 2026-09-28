"use strict";
import React, { useMemo } from "preact/compat";
import Popper from "@material-ui/core/Popper";
import List from "@material-ui/core/List";
import ListSubheader from "@material-ui/core/ListSubheader";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";

import { T } from "../../utils/T";
import { t, useLanguage } from "../../utils/text";

import { tr } from "./highlight";
import { UserResult } from "./UserResult";
import { TagResult } from "./TagResult";
import { CommunityResult } from "./CommunityResult";
import { PostResult } from "./PostResult";
import { ArtworkMasonry } from "./ArtworkMasonry";

// ── SearchResults ─────────────────────────────────────────────────────────────
// The dropdown under the search bar. Sections, top to bottom:
//   Users · Tags · Communities · History · Posts · Artworks (two-column masonry)
// Chain sections render as soon as the node answers; posts and the artwork masonry
// fill in when the search Worker answers (a small spinner holds their place).

const POPPER_MODIFIERS = Object.freeze({
    flip: { enabled: false },
    preventOverflow: { enabled: true, boundariesElement: "scrollParent" },
    arrow: { enabled: false },
});

export const SearchResults = React.memo(
    ({
         classes, query, results, anchorEl, history,
         onGoToUsername, onGoToTag, onGoToCommunity, onGoToArtwork, onGoToPost, onSetTagNavigation,
     }) => {
        useLanguage();
        const { users, tags, communities, artworks, posts, loading, artworksLoading } = results;
        // Community titles for the "in …" line of post rows, from the communities the
        // same search returned (the bridge rows carry name + title).
        const communityTitles = useMemo(() => {
            const m = {};
            for (const c of communities) if (c && c.name && c.title) m[c.name] = c.title;
            return m;
        }, [communities]);
        const goToPost = onGoToPost || onGoToArtwork; // same route shape: /<category>/@author/permlink

        const tagRows = useMemo(() => {
            const rest = tags.filter((x) => x.name !== query).map((x) => ({ name: x.name, exact: false }));
            return [{ name: query, exact: true }].concat(rest);
        }, [tags, query]);

        const hasChain = users.length > 0 || tags.length > 0 || communities.length > 0;
        const hasAny = hasChain || artworks.length > 0 || posts.length > 0;

        const postSection = posts.length > 0 ? (
            <React.Fragment>
                <ListSubheader className={classes.subheaderSticky}>{tr(t, "words.posts", "Posts")}</ListSubheader>
                {posts.map((post) => (
                    <PostResult key={"p-" + post.id} classes={classes} post={post} query={query} communityTitles={communityTitles} onGoToPost={goToPost} />
                ))}
            </React.Fragment>
        ) : null;

        const artworkSection = (artworks.length > 0 || artworksLoading) ? (
            <React.Fragment>
                <ListSubheader className={classes.subheaderSticky}>{tr(t, "words.artworks", "Artworks")}</ListSubheader>
                {artworks.length > 0
                    ? <ArtworkMasonry items={artworks} onOpen={onGoToArtwork} />
                    : (
                        <div className={classes.loading} style={{ padding: "8px 0 12px 0" }}>
                            <CircularProgress size={18} style={{ color: "#666" }} />
                        </div>
                    )}
            </React.Fragment>
        ) : null;

        return (
            <Popper
                open
                placement="bottom-start"
                className={classes.searchBarOpenMenu}
                disablePortal
                anchorEl={anchorEl}
                modifiers={POPPER_MODIFIERS}
            >
                <div
                    className={classes.searchBarResult}
                    style={{ width: anchorEl && anchorEl.width ? `${anchorEl.width}px` : "100%" }}
                >
                    {loading ? (
                        <div className={classes.loading}>
                            <CircularProgress size={24} style={{ color: "#666" }} />
                        </div>
                    ) : hasAny ? (
                        <List dense>
                            {users.length > 0 && (
                                <ListSubheader className={classes.subheaderSticky}>{t("components.index.users")}</ListSubheader>
                            )}
                            {users.map((user) => (
                                <UserResult key={"@" + user.username} classes={classes} user={user} query={query} onGoToUsername={onGoToUsername} />
                            ))}

                            <ListSubheader className={classes.subheaderSticky}>{t("words.tags")}</ListSubheader>
                            {tagRows.map((tag) => (
                                <TagResult key={"#" + tag.name} classes={classes} name={tag.name} exact={tag.exact} query={query} onGoToTag={onGoToTag} />
                            ))}

                            {communities.length > 0 && (
                                <ListSubheader className={classes.subheaderSticky}>{t("components.index.communities")}</ListSubheader>
                            )}
                            {communities.map((community) => (
                                <CommunityResult key={"c-" + community.name} classes={classes} community={community} query={query} onGoToCommunity={onGoToCommunity} />
                            ))}

                            {history}
                            {postSection}
                            {artworkSection}
                        </List>
                    ) : (
                        <React.Fragment>
                            <Typography className={classes.noResult} variant="body2" component="p">
                                <T
                                    k="components.index.no_result_found_for_0_0"
                                    vars={{ searchInputText: query }}
                                    slots={[<span className={classes.noResultLink} onClick={() => onSetTagNavigation(query)} key="0" />]}
                                />
                            </Typography>
                            <List dense>
                                {history}
                                {artworkSection}
                            </List>
                        </React.Fragment>
                    )}
                </div>
            </Popper>
        );
    },
    (prev, next) =>
        prev.query === next.query &&
        prev.results === next.results &&
        prev.anchorEl === next.anchorEl &&
        prev.history === next.history &&
        prev.classes === next.classes &&
        prev.onGoToUsername === next.onGoToUsername &&
        prev.onGoToTag === next.onGoToTag &&
        prev.onGoToCommunity === next.onGoToCommunity &&
        prev.onGoToArtwork === next.onGoToArtwork &&
        prev.onGoToPost === next.onGoToPost &&
        prev.onSetTagNavigation === next.onSetTagNavigation,
);
