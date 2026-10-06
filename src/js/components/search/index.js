"use strict";

// ── components/search ─────────────────────────────────────────────────────────
// Everything the toolbar search needs, in one folder:
//
//   useSearch(apiRef, { lang })  hook — same contract as the old useBlockchainSearch
//                            ({ query, results, handleChange, reset, isOpen }) plus
//                            `controls` for the filter UI and the box; results carry
//                            user/community profiles, artworks, posts, the filters and the
//                            panel state, and from the v3 Worker the suggestions, the answer
//                            to a question, "did you mean" and the placeholder's examples
//   <SearchBar …/>           input (animated examples, ghost completion, keys) + filter
//                            button (badge) + close + click-away + dropdown; owns the styles
//                            and measures itself (width, height, widening)
//   <SearchResults …/>       the dropdown alone, if a page wants to embed it elsewhere
//   <SearchFilters …/>       the filter panel (show · time · colour · authors · communities)
//   <TokenField …/>          multi-value text field with suggestions (authors, communities)
//   <SuggestionList/>        what the Worker proposes for the text typed (top of the dropdown)
//   <AnswerCard/>            the answer to a question: /ask (artworks) or /help (documentation)
//   <UserResult/> <CommunityResult/> <TagResult/> <PostResult/>   rows
//   <ArtworkMasonry/> <ArtworkCard/>                 two-column artwork grid + plain image card
//   artworkPath(item)        "/<category>/@author/permlink" for history.push
//   filters.js / tags.js     the filter state model → /search parameters; tag validity
//   intent.js                when a text deserves an answer; the ghost text
//
// Index.js wiring (see the diff shipped with this folder):
//   const search = useSearch(apiRef, { lang: processedSettings._know_the_settings ? processedSettings._language : null });
//   <SearchBar open={search.isOpen} value={search.query} results={search.results}
//              controls={search.controls} … onGoToArtwork={goToArtwork} />

export { useSearch, SEARCH_IDLE, profileOf } from "./useSearch";
export { SearchBar } from "./SearchBar";
export { SearchResults } from "./SearchResults";
export { SearchFilters } from "./SearchFilters";
export { TokenField } from "./TokenField";
export { UserResult } from "./UserResult";
export { CommunityResult } from "./CommunityResult";
export { TagResult } from "./TagResult";
export { ArtworkMasonry } from "./ArtworkMasonry";
export { ArtworkCard } from "./ArtworkCard";
export { PostResult } from "./PostResult";
export { SuggestionList } from "./SuggestionList";
export { AnswerCard } from "./AnswerCard";
export {
    searchIndex, searchArtworks, artworkPath, artworkImageUrl, loadVocab, getVocab,
    fetchSuggestions, loadExamples, fetchAnswer, sendFeedback,
} from "./searchApi";
export { answerPlan, looksLikeQuestion, ghostFor } from "./intent";
export {
    EMPTY_FILTERS, TIME_PRESETS, TYPE_OPTIONS, COLOR_MODES,
    hasFilters, countFilters, filtersToParams, filtersKey, normalizeFilters, compactFilters, toggleIn, accountName,
} from "./filters";
export { normalizeTag, isValidTag } from "./tags";
export { searchStyles } from "./styles";
export { highlightNode } from "./highlight";
export { SEARCH_API_URL, LIMITS, DEFAULT_COLORS } from "./config";
