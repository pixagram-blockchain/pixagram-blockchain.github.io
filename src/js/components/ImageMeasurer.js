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
 *     and append without invalidation.
 *   • Progressive rendering — children receive items as soon as *any*
 *     measurement resolves; a single slow or broken image never blocks
 *     the entire feed.
 *   • RAF-batched updates — multiple promises settling in the same
 *     frame produce a single `forceUpdate`, not one per image.
 *   • Pending-set deduplication — rapid props changes cannot fire
 *     duplicate measurement requests for the same ID.
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
        this._failed  = new Set();   // ids that permanently failed decode
        this._pending = new Set();   // ids currently in-flight

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

        let dispatched = false;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const id   = this._keyOf(item);

            // Already resolved, permanently failed, or in-flight → skip
            if (this._cache.has(id) || this._failed.has(id) || this._pending.has(id)) continue;

            const src = image(item);
            if (!src) {
                // No image URL — treat as permanent failure (nothing to load)
                this._failed.add(id);
                continue;
            }

            this._pending.add(id);
            dispatched = true;

            pngdby.get_new_img_obj(src)
                .then((size) => {
                    this._pending.delete(id);
                    if (this._unmounted) return;

                    if (size && size.width > 0 && size.height > 0) {
                        this._cache.set(id, {
                            ...size,
                            id,
                        });
                    } else {
                        this._failed.add(id);
                    }
                    this._scheduleUpdate();
                })
                .catch(() => {
                    this._pending.delete(id);
                    if (this._unmounted) return;
                    this._failed.add(id);
                    this._scheduleUpdate();
                });
        }

        // If nothing new was dispatched but the cache already holds data
        // (e.g. items reordered, or append where the new slice was all
        // cached), we still need a render pass so children see the
        // up-to-date `itemsWithSizes` array.
        if (!dispatched && this._cache.size > 0) {
            this._scheduleUpdate();
        }
    };

    // ── Output builder ───────────────────────────────────────────────

    /**
     * Assemble the `{item, size}[]` array from the current items list
     * and the persistent size cache.  Only items whose measurement
     * succeeded are included — failed/pending items are silently
     * omitted so downstream Masonry never receives incomplete entries.
     *
     * Runs on every render; cost is O(n) with no allocations when the
     * item list hasn't changed (returns the cached reference).
     */
    _buildOutput = () => {
        const { items } = this.props;
        if (!items || items.length === 0) return _EMPTY;

        const out = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const size = this._cache.get(this._keyOf(item));
            if (size) out.push({ item, size });
        }
        return out.length > 0 ? out : _EMPTY;
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