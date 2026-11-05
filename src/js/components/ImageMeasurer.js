import * as React from "preact/compat";
import { pngdby } from "../utils/png-db";

// ── Shared sentinel for empty render passes ──────────────────────────
const _EMPTY = [];

/**
 * ImageMeasurer
 *
 * Measures natural dimensions for a list of image-bearing items and
 * passes `{item, size}[]` to a render-prop child.  Designed to sit
 * between a data source and @pixagram/virtualized's Masonry.
 *
 * Key properties vs. the previous implementation:
 *
 *   • ID-keyed sizes — survive reorder, filter, and append without
 *     invalidation. Each size remembers the image it was measured from: an
 *     item whose image changes (an edit) is measured again, and keeps its
 *     previous size until the new one lands — it never drops out of the
 *     output in between.
 *   • Progressive rendering — children receive items as soon as *any*
 *     measurement resolves; a single slow or broken image never blocks
 *     the entire feed.
 *   • RAF-batched updates — multiple promises settling in the same
 *     frame produce a single `forceUpdate`, not one per image.
 *   • Pending deduplication — rapid props changes cannot fire
 *     duplicate measurement requests for the same image.
 *   • Referentially stable output — `itemsWithSizes` is rebuilt only
 *     when `items` changes or a new measurement lands, so a parent
 *     re-render (scroll tick, dialog state) hands the Masonry the SAME
 *     array and its PureComponent bail-out actually holds.
 *
 * Memory — the measurer holds nothing an item doesn't already hold, and
 * nothing for longer than the page holds the item:
 *
 *   • A size is { id, hash, type, width, height, src }. `src` is the item's
 *     own image string — a reference, never a copy — from which png-db
 *     rebuilds its cache entry once it has evicted it. A size used to be
 *     png-db's whole snapshot, `data` included: the decoded file bytes of
 *     every artwork measured since mount, held here outside png-db's byte
 *     budget — which bounds what png-db keeps, not what it hands out.
 *   • Per-id state (sizes, the image each id shows, failures) covers the
 *     ids of the CURRENT `items` and is pruned on every items change. It
 *     used to keep every id ever seen, and with them the data URIs of posts
 *     the page had let go — another profile's, a feed's before a refresh
 *     (after which every artwork's string was held twice: the old copy
 *     here, the new one in the list).
 *   • An item that leaves the list and comes back as the same object (a
 *     filter switched off and on) is sized again at once, with no request:
 *     its size is also kept in a WeakMap keyed by the item object, so a
 *     post the page drops takes its size with it.
 *   • Failures and in-flight requests are per id, holding a reference to
 *     the image they were for. They used to be `${id}\n${src}` strings — a
 *     fresh copy of the whole data URI each, kept forever for every failed
 *     image, and rebuilt on every items change for every failed or pending
 *     one.
 *
 * Props:
 *   items      — array of data objects (posts, etc.)
 *   image      — accessor `(item) => url|null`
 *   keyMapper  — accessor `(item) => uniqueId`  (falls back to item.id)
 *   children   — render-prop `(itemsWithSizes) => ReactNode`
 *   className  — forwarded to wrapper div
 *   renderWhenEmpty — call `children` even while nothing is sized (with an
 *                empty array). Off by default: the render-prop only runs
 *                once at least one item is measured. A host that threads
 *                cells of its own between the measured ones (Profile's blog
 *                cards) turns it on, so those cells show before — or
 *                without — any measured image, and its masonry stays
 *                mounted across that change instead of being swapped in.
 */
class ImageMeasurer extends React.PureComponent {

    constructor(props) {
        super(props);

        // ── Per-id state, for the ids of the current `items` only ────
        // Pruned on every items change (see _measure). Invariant: every id
        // in _sizes or _failed is also in _want, so pruning _want's stale
        // ids prunes all three.
        this._sizes  = new Map();   // id → size { id, hash, type, width, height, src }
        this._want   = new Map();   // id → the image the item shows now
        this._failed = new Map();   // id → the image that failed for it; not
                                    // retried until the item shows another one
        // In-flight requests: id → the image being measured. Not pruned —
        // a request clears its own entry when it settles.
        this._pending = new Map();
        // Item object → its size, for an item that leaves the list and comes
        // back as the same object. Weak: never keeps an item alive.
        this._byItem = new WeakMap();

        // ── Output memo ──────────────────────────────────────────────
        // `_version` counts changes to the sizes the output reads. The last
        // built output is reused verbatim while (items, keyMapper, _version)
        // are unchanged — failures and in-flight ids never appear in the
        // output, so they don't bump the version.
        this._version    = 0;
        this._outItems   = null;
        this._outKeyMap  = null;
        this._outVersion = -1;
        this._out        = _EMPTY;

        // ── RAF coalescing ───────────────────────────────────────────
        this._rafId     = 0;
        this._unmounted = false;
    }

    // ── Lifecycle ────────────────────────────────────────────────────

    componentDidMount()  { this._measure(); }

    componentDidUpdate(prev) {
        if (prev.items !== this.props.items) this._measure();
    }

    componentWillUnmount() {
        this._unmounted = true;
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = 0;
        }
        // Requests still in flight keep this instance alive until they
        // settle; let go of everything it holds now rather than then.
        this._sizes.clear();
        this._want.clear();
        this._failed.clear();
        this._pending.clear();
        this._byItem = new WeakMap();
        this._outItems = null;
        this._out = _EMPTY;
    }

    // ── Helpers ──────────────────────────────────────────────────────

    /** Resolve a stable unique key for an item. */
    _keyOf = (item) => {
        const km = this.props.keyMapper;
        return km ? km(item) : item.id;
    };

    /**
     * Coalesce multiple promise settlements within a single animation
     * frame into one `forceUpdate` call.  Safe to call many times —
     * duplicate scheduling is a no-op.
     */
    _scheduleUpdate = () => {
        if (this._rafId || this._unmounted) return;
        this._rafId = requestAnimationFrame(() => {
            this._rafId = 0;
            if (!this._unmounted) this.forceUpdate();
        });
    };

    // ── Core measurement pipeline ────────────────────────────────────

    _measure = () => {
        const { items, image } = this.props;
        const list = items || _EMPTY;
        const ids = new Set();
        let changed = false;

        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            const id   = this._keyOf(item);
            const src  = image(item) || '';
            ids.add(id);
            this._want.set(id, src);

            // Measured from this very image → nothing to do. (`===` compares
            // contents, so a refetched post's new copy of the same string
            // matches.) Re-point the size at the current item's string, so
            // the copy a previous object of this post held can be collected,
            // and file it under this object too — a vote patch or a refetch
            // hands over new objects, and this is the one that may leave the
            // list and come back.
            const size = this._sizes.get(id);
            if (size && size.src === src) {
                size.src = src;
                this._byItem.set(item, size);
                continue;
            }

            // This very object was measured before it left the list (a
            // filter switched off and on): file its size under its id again.
            // _buildOutput already showed it, unless the id held another
            // size (an edit) — then the output changes.
            const known = this._byItem.get(item);
            if (known && known.src === src) {
                if (size) changed = true;
                this._sizes.set(id, known);
                continue;
            }

            // In flight for this image, or failed for it → skip
            if (this._pending.get(id) === src) continue;
            if (this._failed.get(id) === src) continue;

            if (!src) {
                // No image URL — treat as permanent failure (nothing to load)
                this._failed.set(id, src);
                continue;
            }

            this._pending.set(id, src);
            this._request(item, id, src);
        }

        // Prune the per-id state of ids no longer listed. Only _want needs
        // checking (see the invariant in the constructor); a pass that only
        // appended or replaced rows of the same posts finds nothing to do.
        if (this._want.size > ids.size) {
            for (const id of this._want.keys()) {
                if (ids.has(id)) continue;
                this._want.delete(id);
                this._sizes.delete(id);
                this._failed.delete(id);
            }
        }

        if (changed) {
            this._version++;
            this._scheduleUpdate();
        }

        // No "nothing dispatched → schedule a render" fallback here: this
        // runs from componentDidMount / componentDidUpdate, i.e. AFTER the
        // render that already built the output for the current `items`.
        // Scheduling another pass only re-rendered the same array.
    };

    _request = (item, id, src) => {
        const settle = (snap) => {
            if (this._pending.get(id) === src) this._pending.delete(id);
            if (this._unmounted) return;

            if (!(snap && snap.width > 0 && snap.height > 0)) {
                // A failed image changes nothing the children see — a
                // new item stays omitted exactly as a pending one was,
                // a changed one keeps its previous size — so no render
                // pass is needed.
                if (this._want.get(id) === src) this._failed.set(id, src);
                return;
            }

            // What the layout and the card's pixel lookup read, and no more —
            // png-db's snapshot also carries the file's decoded bytes. `id`
            // is the post id (the masonry's key); png-db keys its entries by
            // the content hash, so keep it as `hash`, or every card's pixels
            // are decoded a second time under the post id. `src` lets png-db
            // rebuild an evicted entry.
            const size = {
                id,
                hash: snap.id,
                type: snap.type,
                width: snap.width,
                height: snap.height,
                src,
            };
            this._byItem.set(item, size);

            // The item moved on to another image meanwhile, or left the list:
            // this size describes neither what it shows nor what it will show.
            if (this._want.get(id) !== src) return;
            this._sizes.set(id, size);
            this._version++;
            this._scheduleUpdate();
        };

        pngdby.get_new_img_obj(src)
            .then(settle)
            .catch(() => settle(null));
    };

    // ── Output builder ───────────────────────────────────────────────

    /**
     * Assemble the `{item, size}[]` array from the current items list
     * and the sizes.  Only items whose measurement succeeded are
     * included — failed/pending items are silently omitted so
     * downstream Masonry never receives incomplete entries.
     * (An item whose image changed keeps its previous size until the new
     * image is measured.)
     *
     * Memoized on (items, keyMapper, _version): a render triggered by
     * anything else returns the previous array by reference, with no
     * allocation and no O(n) walk.
     */
    _buildOutput = () => {
        const { items, keyMapper } = this.props;
        if (!items || items.length === 0) return _EMPTY;

        if (items === this._outItems
            && keyMapper === this._outKeyMap
            && this._version === this._outVersion) {
            return this._out;
        }

        const out = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            // The id's size — or, for an object back in the list, the size it
            // had (this render runs before _measure files it under its id).
            const size = this._sizes.get(this._keyOf(item)) || this._byItem.get(item);
            if (size) out.push({ item, size });
        }

        this._outItems   = items;
        this._outKeyMap  = keyMapper;
        this._outVersion = this._version;
        this._out        = out.length > 0 ? out : _EMPTY;
        return this._out;
    };

    // ── Render ───────────────────────────────────────────────────────

    render() {
        const { children, className, renderWhenEmpty } = this.props;
        const itemsWithSizes = this._buildOutput();
        return (
            <div className={className}>
                {(itemsWithSizes.length > 0 || renderWhenEmpty) ? children(itemsWithSizes) : null}
            </div>
        );
    }
}

export default ImageMeasurer;