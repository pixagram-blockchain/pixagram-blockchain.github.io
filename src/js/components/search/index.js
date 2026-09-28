"use strict";

// ── components/search ─────────────────────────────────────────────────────────
// Everything the toolbar search needs, in one folder:
//
//   useSearch(apiRef)        hook — same contract as the old useBlockchainSearch
//                            ({ query, results, handleChange, reset, isOpen }),
//                            results now carry user/community profiles and artworks
//   <SearchBar …/>           input + button + click-away + results dropdown (owns styles)
//   <SearchResults …/>       the dropdown alone, if a page wants to embed it elsewhere
//   <UserResult/> <CommunityResult/> <TagResult/> <PostResult/>   rows
//   <ArtworkMasonry/> <ArtworkCard/>                 two-column artwork grid + plain image card
//   artworkPath(item)        "/<category>/@author/permlink" for history.push
//
// Index.js wiring (see the diff shipped with this folder):
//   const search = useSearch(apiRef);
//   <SearchBar open={search.isOpen} value={search.query} results={search.results} … onGoToArtwork={goToArtwork} />

export { useSearch, SEARCH_IDLE, profileOf } from "./useSearch";
export { SearchBar } from "./SearchBar";
export { SearchResults } from "./SearchResults";
export { UserResult } from "./UserResult";
export { CommunityResult } from "./CommunityResult";
export { TagResult } from "./TagResult";
export { ArtworkMasonry } from "./ArtworkMasonry";
export { ArtworkCard } from "./ArtworkCard";
export { PostResult } from "./PostResult";
export { searchIndex, searchArtworks, artworkPath, artworkImageUrl } from "./searchApi";
export { searchStyles } from "./styles";
export { highlightNode } from "./highlight";
export { SEARCH_API_URL, LIMITS } from "./config";
