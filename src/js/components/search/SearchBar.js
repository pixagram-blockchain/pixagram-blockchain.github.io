"use strict";
import React, { useCallback, useState } from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import ClickAwayListener from "@material-ui/core/ClickAwayListener";
import IconButton from "@material-ui/core/IconButton";
import Fade from "@material-ui/core/Fade";
import CloseIcon from "@material-ui/icons/Close";
import ArrowBackRounded from "@material-ui/icons/ArrowBackRounded";

import { searchStyles } from "./styles";
import { SearchResults } from "./SearchResults";

// ── SearchBar ─────────────────────────────────────────────────────────────────
// The toolbar's search box: input, close/back button, click-away, and the
// results dropdown anchored to the bar. Owns the anchor element (and its
// measured width, which the dropdown copies) so Index no longer has to.
// Styles come from ./styles (moved out of Index); the bar renders exactly
// where and how it did.

const SearchBarInner = React.memo(
    ({
         classes, open, value, placeholder, onChange, onReset, onGoHome,
         results, history,
         onGoToUsername, onGoToTag, onGoToCommunity, onGoToArtwork, onGoToPost, onSetTagNavigation,
     }) => {
        const [anchorEl, setAnchorEl] = useState(null);
        const setRef = useCallback((el) => {
            if (el) {
                el.width = el.getBoundingClientRect().width;
                setAnchorEl(el);
            }
        }, []);
        const onButton = useCallback(() => (value.length ? onReset() : onGoHome()), [value, onReset, onGoHome]);

        return (
            <ClickAwayListener onClickAway={onReset}>
                <div className={classes.searchBarWrapper}>
                    <Fade in timeout={600}>
                        <div className={open ? classes.searchBarOpen : classes.searchBar} ref={setRef}>
                            <input
                                className={classes.searchInput}
                                type="text"
                                value={value}
                                placeholder={placeholder}
                                onChange={onChange}
                                autoComplete="off"
                                spellCheck={false}
                            />
                            <IconButton className={classes.searchButton} onClick={onButton}>
                                {open ? <CloseIcon /> : <ArrowBackRounded />}
                            </IconButton>
                        </div>
                    </Fade>
                    {open && anchorEl && (
                        <SearchResults
                            classes={classes}
                            query={value}
                            results={results}
                            anchorEl={anchorEl}
                            history={history}
                            onGoToUsername={onGoToUsername}
                            onGoToTag={onGoToTag}
                            onGoToCommunity={onGoToCommunity}
                            onGoToArtwork={onGoToArtwork}
                            onGoToPost={onGoToPost}
                            onSetTagNavigation={onSetTagNavigation}
                        />
                    )}
                </div>
            </ClickAwayListener>
        );
    },
    (prev, next) =>
        prev.open === next.open &&
        prev.value === next.value &&
        prev.placeholder === next.placeholder &&
        prev.results === next.results &&
        prev.history === next.history &&
        prev.classes === next.classes &&
        prev.onChange === next.onChange &&
        prev.onReset === next.onReset &&
        prev.onGoHome === next.onGoHome &&
        prev.onGoToUsername === next.onGoToUsername &&
        prev.onGoToTag === next.onGoToTag &&
        prev.onGoToCommunity === next.onGoToCommunity &&
        prev.onGoToArtwork === next.onGoToArtwork &&
        prev.onGoToPost === next.onGoToPost &&
        prev.onSetTagNavigation === next.onSetTagNavigation,
);

export const SearchBar = withStyles(searchStyles)(SearchBarInner);
