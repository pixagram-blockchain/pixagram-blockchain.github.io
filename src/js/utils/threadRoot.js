// ── Thread roots ───────────────────────────────────────────────────────
// A reference to "a post" is often a reference to a COMMENT — a comment or
// reply card, a vote on a comment or a curation reward in the timeline, a
// mention notification — and only root posts have addresses. What such a
// reference opens is its thread's root, on the replies, with that comment
// pinned. Nothing a listing hands the app says where that is (a sanitised
// comment keeps neither its root's category nor a chain-shaped url), so it
// is read from the chain, here, for every surface that needs it:
//
//   resolveThreadRoot  the root's author, permlink and category
//   resolveThreadUrl   the address that opens it — what a new-tab click on
//                      such a reference points its tab at (utils/link,
//                      pendingNavigation) and, for the same reference, the
//                      address the in-tab flow ends up pushing.
//
// resolveThreadRoot was Profile's (its timeline references); it moved here
// unchanged when the cards and the notifications needed the same answer.

import { buildPostUrl, buildCommentFocusHash } from "./constants";

// Walk a comment's parent links up to its thread root. Timeline references
// can point at a COMMENT (a vote on one, a reply, a curation reward) just as
// well as at a root post — and only root posts have URLs. Returns the root's
// author/permlink plus its category (for a root, `parent_permlink` IS the
// category: the community for a blog post, the first tag for a pixel art),
// or null when the chain can't be resolved. A root reference resolves in one
// fetch; sanitized content that already names root_author/root_permlink
// shortcuts deeper chains to two.
export const resolveThreadRoot = async (commentApi, author, permlink) => {
    if (!commentApi || !commentApi.content || !author || !permlink) return null;
    let a = author, p = permlink, content = null;
    for (let hops = 0; hops < 12; hops++) {
        content = await commentApi.content.getContent(a, p);
        if (!content || !content.permlink) return null;
        if (!content.parent_author) break; // reached the thread root
        if (content.root_author && content.root_permlink
            && (content.root_author !== a || content.root_permlink !== p)) {
            a = content.root_author; p = content.root_permlink; // jump straight to it
        } else {
            a = content.parent_author; p = content.parent_permlink || "";
        }
        if (!p) return null;
    }
    if (content.parent_author) return null; // never reached a root
    const category = content.category || content.parent_permlink || "";
    return { author: a, permlink: p, category };
};

/**
 * The address that opens the thread of `author`/`permlink`: its root post's,
 * plus "#replies&focus=<ref>" when the reference is a comment of that thread
 * rather than the root itself. Null when the chain cannot name the root or
 * its category — never buildPostUrl's "general" placeholder, which would be
 * an address to nothing. Never throws.
 */
export async function resolveThreadUrl(commentApi, author, permlink) {
    let root = null;
    try { root = await resolveThreadRoot(commentApi, author, permlink); } catch (e) { root = null; }
    if (!root || !root.category) return null;
    const path = buildPostUrl({
        category: root.category,
        author: { username: root.author },
        permlink: root.permlink,
    });
    if (!path) return null;
    const isComment = root.author !== author || root.permlink !== permlink;
    return path + (isComment ? buildCommentFocusHash(author, permlink) : "");
}
