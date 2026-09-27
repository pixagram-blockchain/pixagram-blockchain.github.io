// PaperCardComment IS PaperCardReply.
//
// The two files had become byte-identical 500-line copies of each other, apart
// from the reply card's optional "to <account>" subheader segment — which only
// renders when the data carries a `replyTo`, and a comment's data never does
// (enrichCommentForCard in Profile builds none). So the reply card, handed a
// comment, renders exactly what this file used to render, and every fix to
// one card now lands in both — memoization, the single sanitize pass, the
// shared date leaf — instead of drifting.
//
// The name is kept so every import site (Profile's comments tab) is unchanged.
// Should the comment card ever need to look different, put the component back
// here — the git history has it — rather than adding a flag to the reply card.
export { default } from './PaperCardReply';