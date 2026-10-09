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
 *   • ID-keyed cache (`Map<id, size>`) — survives reorder, filter,
 *     and append without invalidation. Each size remembers the image it
 *     was measured from: an item whose image changes (an edit) is measured
 *     again, and keeps its previous size until the new one lands — it never
 *     drops out of the output in between.
 *   • Progressive rendering — children receive items as soon as *any*
 *     measurement resolves; a single slow or broken image never blocks
 *     the entire feed.
 *   • RAF-batched updates — multiple promises settling in the same
 *     frame produce a single `forceUpdate`, not one per image.
 *   • Pending-set deduplication — rapid props changes cannot fire
 *     duplicate measurement requests for the same ID.
 *   • Referentially stable output — `itemsWithSizes` is rebuilt only
 *     when `items` changes or a new measurement lands, so a parent
 *     re-render (scroll tick, dialog state) hands the Masonry the SAME
 *     array and its PureComponent bail-out actually holds.
 *
 * Props:
 *   items      — array of data objects (posts, etc.)
 *   image      — accessor `(item) => url|null`
 *   keyMapper  — accessor `(item) => uniqueId`  (falls back to item.id)
 *   children   — render-prop `(itemsWithSizes) => ReactNode`
 *   className  — forwarded to wrapper div
 */
class ImageMeasurer extends React.PureComponent {

    constructor(props) {
        super(props);

        // ── Persistent caches (survive across prop changes) ──────────
        this._cache   = new Map();   // id → { width, height, id }
        this._srcOf   = new Map();   // id → the image its cached size was measured from
        this._wantSrc = new Map();   // id → the item's current image
        // Failures and in-flight requests are per image, keyed `${id}\n${src}`:
        // a new image for an id is a new request, and an image that failed
        // isn't retried until the item points at another one.
        this._failed  = new Set();
        this._pending = new Set();

        // ── Output memo ──────────────────────────────────────────────
        // `_version` counts successful measurements. The last built
        // output is reused verbatim while (items, keyMapper, _version)
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
        if (!items || items.length === 0) return;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const id   = this._keyOf(item);
            const src  = image(item) || '';
            this._wantSrc.set(id, src);

            // Measured from this very image → nothing to do
            if (this._cache.has(id) && this._srcOf.get(id) === src) continue;

            // This image permanently failed, or is in flight → skip
            const req = id + '\n' + src;
            if (this._failed.has(req) || this._pending.has(req)) continue;

            if (!src) {
                // No image URL — treat as permanent failure (nothing to load)
                this._failed.add(req);
                continue;
            }

            this._pending.add(req);

            pngdby.get_new_img_obj(src)
                .then((size) => {
                    this._pending.delete(req);
                    if (this._unmounted) return;

                    if (size && size.width > 0 && size.height > 0) {
                        // The item moved on to another image meanwhile: this
                        // size describes neither what it shows nor what it
                        // will show.
                        if (this._wantSrc.get(id) !== src) return;
                        this._cache.set(id, {
                            ...size,
                            id,
                        });
                        this._srcOf.set(id, src);
                        this._version++;
                        this._scheduleUpdate();
                    } else {
                        // A failed image changes nothing the children see — a
                        // new item stays omitted exactly as a pending one was,
                        // a changed one keeps its previous size — so no render
                        // pass is needed.
                        this._failed.add(req);
                    }
                })
                .catch(() => {
                    this._pending.delete(req);
                    if (this._unmounted) return;
                    this._failed.add(req);
                });
        }

        // No "nothing dispatched → schedule a render" fallback here: this
        // runs from componentDidMount / componentDidUpdate, i.e. AFTER the
        // render that already built the output for the current `items`.
        // Scheduling another pass only re-rendered the same array.
    };

    // ── Output builder ───────────────────────────────────────────────

    /**
     * Assemble the `{item, size}[]` array from the current items list
     * and the persistent size cache.  Only items whose measurement
     * succeeded are included — failed/pending items are silently
     * omitted so downstream Masonry never receives incomplete entries.
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
            const size = this._cache.get(this._keyOf(item));
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
        const { children, className } = this.props;
        const itemsWithSizes = this._buildOutput();
        return (
            <div className={className}>
                {itemsWithSizes.length > 0 ? children(itemsWithSizes) : null}
            </div>
        );
    }
}

export default ImageMeasurer;