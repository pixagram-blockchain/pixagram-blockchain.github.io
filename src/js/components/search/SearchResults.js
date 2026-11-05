"use strict";
import React, { useCallback, useMemo, useState } from "preact/compat";
import Collapse from "@material-ui/core/Collapse";
import List from "@material-ui/core/List";
import ListSubheader from "@material-ui/core/ListSubheader";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";

import { T } from "../../utils/T";
import { t, useLanguage } from "../../utils/text";

import { NO_SLOTS, tr } from "./highlight";
import { COMMUNITY_ACCOUNT_RE } from "./config";
import { hasFilters } from "./filters";
import { isValidTag, normalizeTag } from "./tags";
import { SearchFilters } from "./SearchFilters";
import { UserResult } from "./UserResult";
import { TagResult } from "./TagResult";
import { CommunityResult } from "./CommunityResult";
import { PostResult } from "./PostResult";
import { ArtworkMasonry } from "./ArtworkMasonry";
import { LoadMore } from "./LoadMore";
import { SuggestionList } from "./SuggestionList";
import { AnswerCard } from "./AnswerCard";

// ── SearchResults ─────────────────────────────────────────────────────────────
// The dropdown under the search bar:
//   filter panel (pinned, expands from the bar's filter button)
//   ─ scrolling: Users (two per row) · Tags (three per row) · Communities · History · Posts · Artworks
// Chain sections render as soon as the node answers; posts and the artwork
// masonry fill in when the search Worker answers (a small spinner holds their
// place; on a filter change the previous ones stay, dimmed, until the new ones
// land). `maxHeight` is measured live by SearchBar.
//
// It hangs right under its positioned parent, as wide as it (SearchBar renders
// it inside the bar: no measuring, no Popper). `full`: the bar is the
// full-screen panel (fullScreen.js), the dropdown fills it under the input row
// and the masonry takes `columns`. The Posts and Artworks sections carry
// data-search-index: scrolling them into sight is what opens the panel.
//
// The Tags section offers the typed term itself ("#term") on a line of its own,
// above the other matches, only when it is a valid tag (see tags.js) or a tag the
// chain already lists — and never for a portal-<id>: that is a community (its
// posts carry it as their first tag), which the Communities section covers.
//
// v3, above the sections: what the Worker proposes for the text typed
// (SuggestionList, rows picked with the mouse or the keys SearchBar handles),
// "did you mean …?" when the search corrected a word, and the answer to a
// question (AnswerCard; v4.8: the long answer, its follow-ups as chips, and a
// vote through controls). v4.8 also puts the Worker's one-line overview of the
// artworks found above their grid. Opening an artwork or a post from the
// results tells the Worker which one (controls.feedback), so its ranking learns.
//
// The artworks are the last section, so the end of their grid is the end of the
// list: LoadMore sits there and, as it comes near, adds the next page under the
// grid (controls.loadMore), watching from the scrolling list itself.

const EMPTY = Object.freeze([]);

export const SearchResults = React.memo(
    ({
         classes, query, results, maxHeight, history, controls,
         full = false, columns, scrollRef, resultsRef,
         suggestions = EMPTY, highlight = -1, onPick, onFill,
         onGoToUsername, onGoToTag, onGoToCommunity, onGoToArtwork, onGoToPost, onSetTagNavigation,
     }) => {
        useLanguage();
        const { users, tags, communities, artworks, posts, loading, artworksLoading, filters, filtersOpen, answer, didYouMean, overview } = results;
        const { artworksMore, moreLoading, moreFailed, artworksCapped } = results;
        const filtering = hasFilters(filters);

        // The scrolling list: what the grid's end is watched from (LoadMore), and SearchBar's scrollRef.
        const [scrollEl, setScrollEl] = useState(null);
        const setScroll = useCallback((el) => {
            setScrollEl(el);
            if (typeof scrollRef === "function") scrollRef(el);
            else if (scrollRef && typeof scrollRef === "object") scrollRef.current = el;
        }, [scrollRef]);

        // Opening a result reports it (the Worker's ranker learns which ones people open).
        const openArtwork = useCallback((item) => {
            if (controls && controls.feedback) controls.feedback(item);
            onGoToArtwork(item);
        }, [controls, onGoToArtwork]);
        // "Did you mean": only for the text it corrected (the box may hold a newer one), and once —
        // not when a suggestion row already proposes the same.
        const corrected = didYouMean && didYouMean.term === query.trim().toLowerCase() ? didYouMean.text : null;
        const showDidYouMean = !!corrected && !!controls && !!controls.applyText &&
            corrected.trim().toLowerCase() !== query.trim().toLowerCase() &&
            !suggestions.some((s) => s.text.trim().toLowerCase() === corrected.trim().toLowerCase());
        const onDidYouMean = useCallback(() => {
            if (corrected && controls && controls.applyText) controls.applyText(corrected);
        }, [controls, corrected]);
        const answering = !!answer && (answer.loading || !!answer.data);

        // Community titles for the "in …" line of post rows and the community field:
        // every community the node lists, plus the bridge rows this search matched.
        const communityTitles = useMemo(() => {
            const base = results.communityTitles || {};
            let m = null;
            for (const c of communities) {
                if (c && c.name && c.title && base[c.name] !== c.title) {
                    if (!m) m = { ...base };
                    m[c.name] = c.title;
                }
            }
            return m || base;
        }, [communities, results.communityTitles]);
        const goTo = onGoToPost || onGoToArtwork; // same route shape: /<category>/@author/permlink
        const goToPost = useCallback((post) => {
            if (controls && controls.feedback) controls.feedback(post);
            goTo(post);
        }, [controls, goTo]);

        const tag = normalizeTag(query);
        const tagIsValid = !!tag && !COMMUNITY_ACCOUNT_RE.test(tag) && (isValidTag(tag) || tags.some((x) => x.name === tag));
        // Every match but the typed term itself: the grid under its line.
        const otherTags = useMemo(() => (tag ? tags.filter((x) => x.name !== tag) : EMPTY), [tags, tag]);

        // The synthetic "#term" row alone does not count as a result: with nothing
        // else found, the no-result message (with its "browse the tag" link) shows.
        const hasChain = users.length > 0 || tags.length > 0 || communities.length > 0;
        const hasAny = hasChain || artworks.length > 0 || posts.length > 0;
        const indexClass = artworksLoading && (artworks.length > 0 || posts.length > 0) ? classes.dimmed : undefined;

        const postSection = posts.length > 0 ? (
            <div className={indexClass} data-search-index="posts">
                <ListSubheader className={classes.subheaderSticky}>{tr(t, "words.posts", "Posts")}</ListSubheader>
                {posts.map((post) => (
                    <PostResult key={"p-" + post.id} classes={classes} post={post} query={query} communityTitles={communityTitles} onGoToPost={goToPost} />
                ))}
            </div>
        ) : null;

        // v4.8: the Worker's overview of the artworks found ("37 artworks match (showing 15). Most by
        // @nova…"), above the grid; an answer above already sums the question up, so not with one
        const overviewLine = overview && artworks.length > 0 && !answering && query.trim() ? (
            <p className={classes.overview} title={overview.text}>{overview.text}</p>
        ) : null;

        // The artworks' next page, under the grid: not while a new search is on its way (these
        // artworks are about to go).
        const nextPage = artworksLoading ? null : artworksMore;

        const artworkSection = (artworks.length > 0 || artworksLoading) ? (
            <div className={indexClass} data-search-index="artworks">
                <ListSubheader className={classes.subheaderSticky}>{tr(t, "words.artworks", "Artworks")}</ListSubheader>
                {overviewLine}
                {artworks.length > 0 ? (
                    <React.Fragment>
                        <ArtworkMasonry items={artworks} onOpen={openArtwork} columns={columns} />
                        <LoadMore
                            classes={classes}
                            root={scrollEl}
                            more={nextPage}
                            loading={!!moreLoading}
                            failed={!!moreFailed}
                            capped={!!artworksCapped}
                            onMore={controls ? controls.loadMore : undefined}
                        />
                    </React.Fragment>
                ) : (
                    <div className={classes.loading} style={{ padding: "8px 0 12px 0" }}>
                        <CircularProgress size={18} style={{ color: "#666" }} />
                    </div>
                )}
            </div>
        ) : null;

        let emptyMessage = null;
        if (artworksLoading || answering || suggestions.length > 0) {
            // The Worker is still searching, an answer stands above, or the suggestions offer
            // where to go next: no "nothing found" (Enter takes the suggestions away).
        } else if (query.trim()) {
            emptyMessage = tagIsValid ? (
                // The link shows and opens the tag the term stands for ("#Pixel" → #pixel).
                <T
                    k="components.search_results.no_result_found_for_0_0"
                    vars={{ searchInputText: tag }}
                    slots={[<span className={classes.noResultLink} onClick={() => onSetTagNavigation(tag)} key="0" />]}
                />
            ) : (
                // Not a tag: no "browse #…" link to a page that cannot exist.
                <T k="components.search_results.no_result_found_for_query" vars={{ query: query.trim() }} slots={NO_SLOTS} />
            );
        } else if (filtering) {
            emptyMessage = tr(t, "components.search_results.nothing_matches_these_filters_yet", "Nothing matches these filters yet.");
        }

        return (
            <div className={classes.searchBarOpenMenu} ref={resultsRef}>
                <div className={classes.searchBarResult} style={maxHeight && !full ? { maxHeight } : undefined}>
                    {controls ? (
                        <Collapse in={!!filtersOpen} appear timeout={180} className={classes.filterCollapse}>
                            <SearchFilters
                                classes={classes}
                                filters={filters}
                                communityTitles={communityTitles}
                                controls={controls}
                                maxHeight={maxHeight ? Math.max(160, Math.floor(maxHeight * 0.7)) : 0}
                            />
                        </Collapse>
                    ) : null}
                    <div className={classes.searchScroll} ref={setScroll}>
                        {suggestions.length > 0 && onPick ? (
                            <SuggestionList
                                classes={classes}
                                items={suggestions}
                                query={query}
                                highlight={highlight}
                                onPick={onPick}
                                onFill={onFill}
                            />
                        ) : null}
                        {showDidYouMean ? (
                            <p className={classes.didYouMean}>
                                {tr(t, "components.search_results.did_you_mean", "Did you mean:")}{" "}
                                <button type="button" className={classes.didYouMeanLink} onClick={onDidYouMean}>{corrected}</button>
                            </p>
                        ) : null}
                        {answering ? (
                            <AnswerCard classes={classes} answer={answer} controls={controls} onGoToUsername={onGoToUsername} onOpenArtwork={openArtwork} />
                        ) : null}
                        {loading ? (
                            <div className={classes.loading}>
                                <CircularProgress size={24} style={{ color: "#666" }} />
                            </div>
                        ) : hasAny ? (
                            <List dense>
                                {users.length > 0 && (
                                    <ListSubheader className={classes.subheaderSticky}>{tr(t, "components.search_results.users", "Users")}</ListSubheader>
                                )}
                                {users.length > 0 && (
                                    <li className={classes.userGrid}>
                                        {users.map((user) => (
                                            <UserResult key={"@" + user.username} classes={classes} user={user} query={query} onGoToUsername={onGoToUsername} />
                                        ))}
                                    </li>
                                )}

                                {(tagIsValid || otherTags.length > 0) && (
                                    <ListSubheader className={classes.subheaderSticky}>{tr(t, "words.tags", "Tags")}</ListSubheader>
                                )}
                                {tagIsValid && (
                                    <TagResult classes={classes} name={tag} exact query={tag} onGoToTag={onGoToTag} />
                                )}
                                {otherTags.length > 0 && (
                                    <li className={classes.tagGrid}>
                                        {otherTags.map((x) => (
                                            <TagResult key={"#" + x.name} classes={classes} name={x.name} query={tag} onGoToTag={onGoToTag} />
                                        ))}
                                    </li>
                                )}

                                {communities.length > 0 && (
                                    <ListSubheader className={classes.subheaderSticky}>{tr(t, "words.communities", "Communities")}</ListSubheader>
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
                                {emptyMessage ? (
                                    <Typography className={classes.noResult} variant="body2" component="p">{emptyMessage}</Typography>
                                ) : null}
                                <List dense>
                                    {history}
                                    {artworkSection}
                                </List>
                            </React.Fragment>
                        )}
                    </div>
                </div>
            </div>
        );
    },
    (prev, next) =>
        prev.query === next.query &&
        prev.results === next.results &&
        prev.suggestions === next.suggestions &&
        prev.highlight === next.highlight &&
        prev.onPick === next.onPick &&
        prev.onFill === next.onFill &&
        prev.maxHeight === next.maxHeight &&
        prev.full === next.full &&
        prev.columns === next.columns &&
        prev.scrollRef === next.scrollRef &&
        prev.resultsRef === next.resultsRef &&
        prev.history === next.history &&
        prev.controls === next.controls &&
        prev.classes === next.classes &&
        prev.onGoToUsername === next.onGoToUsername &&
        prev.onGoToTag === next.onGoToTag &&
        prev.onGoToCommunity === next.onGoToCommunity &&
        prev.onGoToArtwork === next.onGoToArtwork &&
        prev.onGoToPost === next.onGoToPost &&
        prev.onSetTagNavigation === next.onSetTagNavigation,
);