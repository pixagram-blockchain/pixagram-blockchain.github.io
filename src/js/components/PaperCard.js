import * as React from 'preact/compat';
import { h } from 'preact';
import { memo, lazy, Suspense } from 'preact/compat';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import withStyles from '@material-ui/core/styles/withStyles';
import Card from '@material-ui/core/Card';
import CardHeader from '@material-ui/core/CardHeader';
import Avatar from '@material-ui/core/Avatar';
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import { xbrzF, hexF, crtF, triF, releaseId, getCachedRender, acquireCachedBitmap } from '../utils/render-pool';
import useLiveTimeAgo from '../hooks/useLiveTimeAgo';
import { HISTORY } from '../utils/constants';
import ButtonBase from '@material-ui/core/ButtonBase';
import * as actions from '../actions/utils';
import { pngdby } from '../utils/png-db';
import PaperCardActions from './PaperCardActions';
import ProfileHoverAnchor from './ProfileHoverCard';
import { withErrorBoundary } from './ErrorBoundary';
import { t, useLanguage } from '../utils/text';

// Version stamp — check in console: window.__PIXA_VERSIONS__
if (typeof window !== 'undefined') {
    if (!window.__PIXA_VERSIONS__) window.__PIXA_VERSIONS__ = {};
    window.__PIXA_VERSIONS__.PaperCard = '4.10.0-profilehover';
}

// ── Async, non-critical NSFW detector loading ───────────────────────
// The nsfw adapter module (utils/nsfw.js) bridges to @pixagram/nsfw and
// pulls in a model + classifier that are heavy and NOT critical to
// rendering a card: a card must paint with or without it. We therefore
// pull it in lazily via dynamic import() instead of a top-level static
// import, so it never blocks the card bundle/first paint. Two
// module-level caches keep the cost paid exactly once:
//   • _nsfwModPromise — dedupes concurrent in-flight imports
//   • _nsfwMod        — the resolved module, readable synchronously
// Once _nsfwMod is populated, a freshly-mounted card can seed its
// initial verdict synchronously from the classifier's own cache, so
// the common case (module already loaded) costs no extra re-render.
let _nsfwMod = null;
let _nsfwModPromise = null;

// Synchronous accessor — returns the module if it's already loaded, else
// null. Never triggers a load. Used to seed initial state without forcing
// the heavy import on the render path.
function getLoadedNsfwDetect() {
    return _nsfwMod;
}

// Idempotent loader. Returns a promise resolving to the module (default
// export) or null if loading failed. Safe to call from many cards at once.
function loadNsfwDetect() {
    if (_nsfwMod) return Promise.resolve(_nsfwMod);
    if (_nsfwModPromise) return _nsfwModPromise;
    _nsfwModPromise = import('../utils/nsfw')
        .then((m) => {
            _nsfwMod = (m && (m.default || m)) || null;
            return _nsfwMod;
        })
        .catch(() => {
            // Loading failed — clear the promise so a later mount may retry,
            // and resolve to null so callers treat detection as unavailable.
            _nsfwModPromise = null;
            return null;
        });
    return _nsfwModPromise;
}

// ── Shared blur predicate ───────────────────────────────────────────
// The single source of truth for "is this artwork blurred on its card",
// exported for the pages' prev/next navigation (Feed / FeedPersonal /
// Profile skip blurred artworks and hide an arrow when no clean sibling
// remains in that direction). It is the exact condition CanvasImage uses
// for the `nsfw-blur` class: (author/server label OR on-device verdict)
// AND the user's "show NSFW" toggle off. The verdict is read from the
// classifier's synchronous cache — an unclassified artwork (module not
// loaded, or no verdict for this id yet) is NOT blurred, which matches
// what the card shows at that instant.
export function isArtworkBlurred(data, id, nsfwEnabled) {
    if (nsfwEnabled) return false;                  // "show NSFW" on → nothing blurs
    if (data && data.nsfw === true) return true;    // author/server label
    const mod = getLoadedNsfwDetect();
    return !!mod && mod.getCached(id) === true;     // on-device verdict
}

const styles = theme => ({
    card: {
        '&.MuiCard-root': {
            width: '100%',
            borderRadius: '21px',
            userSelect: 'none',
            contentVisibility: 'visible',
            backgroundColor: '#101010',
            transition:
                'background-color 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms, box-shadow 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms, filter 320ms cubic-bezier(0.4, 0, 0.2, 1) 30ms',
        },
        '&.MuiCard-root:hover': {
            backgroundColor: '#000000',
            contain: 'inherit',
            boxShadow:
                '0px 2px 4px -1px rgb(0 0 0 / 20%), 0px 4px 5px 0px rgb(0 0 0 / 14%), 0px 1px 10px 0px rgb(0 0 0 / 12%)',
            transition:
                'background-color 325ms cubic-bezier(0.4, 0, 0.2, 1) 10ms, box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1) 10ms, filter 320ms cubic-bezier(0.4, 0, 0.2, 1) 30ms',
        },
        '&.shown': { filter: 'opacity(1)' },
        '&.hidden': { filter: 'opacity(0)'},
        '& .MuiCardActions-root': {
            fontFamily: 'Geist Mono',
            fontSize: '1.125rem',
            fontWeight: '300',
        },
    },
    subheaderName: { color: '#fff', cursor: 'pointer', userSelect: 'none' },
    subheaderBy: { color: '#aaa', userSelect: 'none' },
    subheaderDate: { color: '#ddd', userSelect: 'none' },
    image: {
        width: '100%',
        cursor: 'pointer',
        userSelect: 'none',
        contain: 'style size layout',
        contentVisibility: "auto",
        opacity: 0,
        transition: "opacity 160ms cubic-bezier(0.4, 0, 0.2, 1) 8ms",
        '&.revealed': { opacity: 1 },
        // NSFW blur is applied via `filter` and is independent of the
        // opacity reveal, so toggling `nsfw` at runtime doesn't fight
        // the reveal animation. Both can be active simultaneously.
        '&.nsfw-blur': { filter: 'blur(24px)' },
    },
    cardHeader: {
        '& .MuiCardHeader-title': {
            fontWeight: 'bold',
            fontFamily: '"Industry Book", "Normative Pro"',
            color: '#fff',
            cursor: 'pointer',
            userSelect: 'none'
        },
        '& .MuiCardHeader-subheader': {
            display: 'inline-block',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            width: 'calc(100% - 16px)',
            userSelect: 'none'
        },
        '& .MuiAvatar-root': {
            cursor: 'pointer',
            borderRadius: '14px',
            width: 48,
            height: 48,
            userSelect: 'none'
        },
        '& .MuiCardHeader-avatar': { marginRight: '8px', userSelect: 'none' },
    },
});

function shallowEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (let i = 0; i < keysA.length; i++) {
        const k = keysA[i];
        if (a[k] !== b[k]) return false;
    }
    return true;
}

// ── requestIdleCallback / cancelIdleCallback shims ───────────────────
// Some browsers (Safari) lack requestIdleCallback; fall back to RAF.
// We always return a { type, handle } pair so the cleanup path can
// cancel the right kind of callback.
function scheduleIdle(fn) {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        return { type: 'idle', handle: window.requestIdleCallback(fn) };
    }
    return { type: 'raf', handle: requestAnimationFrame(fn) };
}
function cancelScheduled(token) {
    if (!token) return;
    try {
        if (token.type === 'idle' && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
            window.cancelIdleCallback(token.handle);
        } else if (token.type === 'raf') {
            cancelAnimationFrame(token.handle);
        }
    } catch (e) {}
}

// Map the card-level renderer name to the pool's algorithm key for
// cache-first lookups. 'square' is absent on purpose: it paints the raw
// source ImageData (CSS `pixelated` does the upscale), so it never goes
// through the pool.
const POOL_ALGO = { hexagon: 'hex', xbrz: 'xbrz', crt: 'crt', tri: 'tri' };

// === Canvas leaf: memoized + race-proof + bitmaprenderer fast path, no resize on draw ===
const CanvasImage = memo(function CanvasImage({
                                                  renderer,
                                                  mode,
                                                  id,
                                                  size,
                                                  style,
                                                  column_width,
                                                  image_width,
                                                  image_height,
                                                  getImgData, // async (size) => ImageData
                                                  renderHex,  // (imgd, scale, cb, cache, id)
                                                  renderXbrz,
                                                  renderCrt,
                                                  renderTri,
                                                  className,
                                                  onOpen,
                                                  nsfwEnabled,
                                                  nsfwFlag,
                                                  canvasRef, // NEW: Accept external ref
                                              }) {
    const internalCanRef = useRef(null);
    const canRef = canvasRef || internalCanRef; // Use external ref if provided
    const ctxRef = useRef(null);              // 2D or bitmaprenderer
    const drawTokenRef = useRef(0);           // cancellation token
    const pendingScheduleRef = useRef(null);  // pending idle/RAF token
    const pendingRevealRef = useRef(0);       // pending opacity-reveal RAF id
    const pendingBitmapRef = useRef(null);    // bitmap parked until its reveal frame close()s it
    const unmountedRef = useRef(false);       // hard-stop after unmount
    const [revealed, setRevealed] = useState(false); // controls opacity-reveal class

    const renderKey = useMemo(
        () => `${renderer}:${mode}:${id}:${image_width}x${image_height}:${size?.width}x${size?.height}:${column_width || 0}`,
        [renderer, mode, id, image_width, image_height, size?.width, size?.height, column_width]
    );

    // Init context once; prefer ImageBitmapRenderingContext when supported
    useEffect(() => {
        const can = canRef.current;
        if (!can) return;
        const bm = can.getContext('bitmaprenderer');
        if (bm) {
            ctxRef.current = bm;
        } else {
            const ctx2d = can.getContext('2d', { alpha: false, desynchronized: true, willReadFrequently: false, powerPreference: "low-power" });
            if (ctx2d) ctx2d.imageSmoothingEnabled = false;
            ctxRef.current = ctx2d;
        }
    }, []);

    // ── Unmount cleanup ─────────────────────────────────────────────
    // Critical for memory: bumps the cancellation token so any pending
    // worker reply / WASM callback drops on the floor, releases this
    // id from the render pool (so the pool no longer retains our
    // callback closure → our canvas DOM node), cancels any scheduled
    // idle/RAF work, and nulls the context ref so the canvas is no
    // longer reachable through it.
    useEffect(() => {
        return () => {
            unmountedRef.current = true;
            drawTokenRef.current++;
            cancelScheduled(pendingScheduleRef.current);
            pendingScheduleRef.current = null;
            if (pendingRevealRef.current) {
                cancelAnimationFrame(pendingRevealRef.current);
                pendingRevealRef.current = 0;
            }
            // Cancelling the reveal RAF above also cancels the closure
            // that would have close()d the bitmap it was holding — close
            // it here instead so its (GPU) memory is freed now rather
            // than whenever GC gets around to it. (A bitmap consumed by
            // transferFromImageBitmap is already detached; close() on it
            // is a no-op, so this is safe on both draw paths.)
            if (pendingBitmapRef.current) {
                try { pendingBitmapRef.current.close && pendingBitmapRef.current.close(); } catch (e) {}
                pendingBitmapRef.current = null;
            }
            try { releaseId(id); } catch (e) {}
            ctxRef.current = null;
            // Note: we intentionally do NOT null canRef.current — Preact
            // owns the ref and will clear it itself. Touching it here
            // would race with Preact's own cleanup.
        };
    }, [id]);

    // ── Backing-store release (true unmount only) ───────────────────
    // After the last transferFromImageBitmap()/drawImage(), the pixels
    // live on INSIDE the canvas until GC collects the detached node —
    // for a feed of column-width bitmaps that can be a long while.
    // Zeroing the backing store releases that bitmap deterministically
    // on both the bitmaprenderer path (spec: resizing swaps the internal
    // bitmap for a transparent black one) and the 2D path. [] deps on
    // purpose: this must only run when the element is actually going
    // away, never on a prop retarget where the canvas would still be
    // needed for the next draw. (In practice the Card is keyed by id,
    // so CanvasImage never survives a retarget anyway.)
    useEffect(() => {
        return () => {
            const can = canRef.current;
            if (!can) return;
            try { can.width = 0; can.height = 0; } catch (e) {}
        };
    }, []);

    const applyImage = useCallback((imgd, bmp) => {
        if (unmountedRef.current) {
            // Late arrival — drop. Close the bitmap so GPU memory is freed.
            if (bmp) { try { bmp.close && bmp.close(); } catch (e) {} }
            return;
        }
        const ctx = ctxRef.current;
        const can = canRef.current;
        if (!ctx || !can || !can.isConnected) {
            if (bmp) { try { bmp.close && bmp.close(); } catch (e) {} }
            return;
        }

        const drawBitmap = (bm) => {
            if (!bm) return;
            if (unmountedRef.current) {
                try { bm.close && bm.close(); } catch (e) {}
                return;
            }
            if (ctx.transferFromImageBitmap) {
                ctx.transferFromImageBitmap(bm);
            } else {
                // Scale to current backing store, no width/height changes (avoids reflow)
                ctx.drawImage(bm, 0, 0, can.width, can.height);
            }
            // Reveal on next frame via React state — never touch inline
            // style imperatively, since that would clobber NSFW blur and
            // any other style props the parent flows down. The bitmap is
            // parked in pendingBitmapRef until this frame close()s it, so
            // the unmount cleanup can free it if the RAF never fires.
            pendingBitmapRef.current = bm;
            pendingRevealRef.current = requestAnimationFrame(() => {
                pendingRevealRef.current = 0;
                pendingBitmapRef.current = null;
                if (unmountedRef.current) {
                    try { bm.close && bm.close(); } catch (e) {}
                    return;
                }
                setRevealed(true);
                try { bm.close && bm.close(); } catch (e) {}
            });
        };

        if (bmp) {
            drawBitmap(bmp);
        } else if (imgd) {
            createImageBitmap(imgd, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' })
                .then((bm) => {
                    if (unmountedRef.current) {
                        try { bm.close && bm.close(); } catch (e) {}
                        return;
                    }
                    drawBitmap(bm);
                })
                .catch(() => {});
        }
    }, []);

    const draw = useCallback(async () => {
        if (unmountedRef.current) return;
        if (!ctxRef?.current?.canvas || !size) return;
        // Reset reveal so the new draw fades in. Done via state, not
        // setAttribute, so blur and other style props are preserved.
        setRevealed(false);
        const myToken = ++drawTokenRef.current;

        // Scales depend only on the probe-measured `size` prop — compute
        // them BEFORE touching pixel data so the cache-first path below
        // can run without any source decode.
        const width = column_width || image_width || 600;
        const scaleHex  = Math.max(Math.min(16, width / size.width / 2), 2);
        const scaleXbrz = Math.max(Math.min(16, (width / size.width) | 0), 2);
        const scaleCrt  = Math.max(Math.min(16, (width / size.width) | 0), 2);
        const scaleTri  = Math.max(Math.min(16, (width / size.width) | 0), 2);

        const guardedApply = (imgOrImgd, bm) => {
            if (myToken !== drawTokenRef.current || unmountedRef.current) {
                // Stale or unmounted — close any bitmap we were handed
                // so its GPU memory is freed instead of leaking.
                if (bm) { try { bm.close && bm.close(); } catch (e) {} }
                return;
            }
            applyImage(imgOrImgd, bm);
        };

        // ── Cache-first fast path ────────────────────────────────────
        // If the pool already holds THIS content at THIS scale for THIS
        // algorithm (the 40-most-recent render cache), paint straight
        // from it: no base64 decode, no PNG/WEBP decode, no upscale.
        // This is the scroll-back path.
        const poolAlgo = POOL_ALGO[renderer];
        if (poolAlgo) {
            const poolScale =
                renderer === 'hexagon' ? scaleHex :
                    renderer === 'xbrz'    ? scaleXbrz :
                        renderer === 'crt'     ? scaleCrt : scaleTri;
            const cachedRender = getCachedRender(id, poolAlgo, poolScale);
            if (cachedRender) {
                cancelScheduled(pendingScheduleRef.current);
                pendingScheduleRef.current = scheduleIdle(() => {
                    pendingScheduleRef.current = null;
                    // Serve through the pool's master-bitmap layer: the
                    // first scroll-back hit pays the ImageData raster once
                    // (and pins it pool-side), every later repaint of this
                    // artwork is a ~1 ms bitmap clone. The clone is ours to
                    // consume; the pool entry is never detached. On a null
                    // or a failure, fall back to the ImageData path
                    // (applyImage mints its own bitmap, exactly as before).
                    const acq = acquireCachedBitmap(id, poolAlgo, poolScale);
                    if (acq) {
                        acq.then(({ bitmap }) => guardedApply(cachedRender, bitmap))
                            .catch(() => guardedApply(cachedRender));
                    } else {
                        guardedApply(cachedRender);
                    }
                });
                return;
            }
        }

        // ── Miss: full pipeline ──────────────────────────────────────
        // get_new_img_data usually just joins the background decode that
        // png-db kicked off at measure time, so this await rarely pays
        // for the decode itself.
        const imgd = await getImgData();
        if (unmountedRef.current) return;
        if (!imgd || myToken !== drawTokenRef.current) return; // null or canceled

        const run = () => {
            pendingScheduleRef.current = null;
            if (myToken !== drawTokenRef.current || unmountedRef.current) return;
            if (renderer === 'hexagon')       renderHex(imgd,  scaleHex,  guardedApply, false, id, mode);
            else if (renderer === 'xbrz')     renderXbrz(imgd, scaleXbrz, guardedApply, false, id, mode);
            else if (renderer === 'crt')      renderCrt(imgd,  scaleCrt,  guardedApply, false, id, mode);
            else if (renderer === 'tri')      renderTri(imgd,  scaleTri,  guardedApply, false, id, mode);
            else if (renderer === 'square')   guardedApply(imgd); // explicit square handling
            else                              guardedApply(imgd); // fallback
        };

        // Cancel any previous scheduled draw before queueing a new one.
        cancelScheduled(pendingScheduleRef.current);
        pendingScheduleRef.current = scheduleIdle(run);
    }, [renderer, mode, id, column_width, image_width, size, getImgData, renderHex, renderXbrz, renderCrt, renderTri, applyImage]);

    useEffect(() => { draw(); }, [draw, renderKey]);

    // Compose className: base + 'revealed' for opacity reveal + 'nsfw-blur'
    // when the post is NSFW and the user has not enabled NSFW display.
    const composedClassName = useMemo(() => {
        let c = className || '';
        if (revealed) c += ' revealed';
        if (nsfwFlag && !nsfwEnabled) c += ' nsfw-blur';
        return c;
    }, [className, revealed, nsfwFlag, nsfwEnabled]);

    return (
        <canvas
            style={style}
            ref={canRef}
            className={composedClassName}
            // Lets the pages resolve THIS canvas's live rect at dialog-close
            // time (PostDialog's reverse hero flies the artwork back onto it).
            data-artwork-id={id}
            // Keep intrinsic size stable; CSS scales to fit. No resizing on paint.
            width={image_width}
            height={image_height}
            onContextMenu={e => e.preventDefault()}
        />
    );
}, (a, b) => (
    a.renderer === b.renderer &&
    a.mode === b.mode &&
    a.id === b.id &&
    a.nsfwEnabled === b.nsfwEnabled &&
    a.nsfwFlag === b.nsfwFlag &&
    a.image_width === b.image_width &&
    a.image_height === b.image_height &&
    a.column_width === b.column_width &&
    a.size?.width === b.size?.width &&
    a.size?.height === b.size?.height &&
    a.className === b.className &&
    shallowEqual(a.style, b.style)
));

// === Main Card ===
function PaperCardInner({
                            classes, data = {}, id, locales, renderer, mode, nsfw, selected,
                            image_width, image_height, column_width, size, onOpen, visible, onMenuClick,
                            api, voter, onVoteChange, onCommentsClick
                        }) {
    // Re-render when the UI language changes. This is load-bearing here, not
    // just tidy: PaperCard is wrapped in two memo() layers below whose
    // comparators check id/data/locales/voter and nothing language-related,
    // so a language switch would otherwise never reach the subheader.
    useLanguage();

    // Determine initial vote state from active_votes
    // After sanitization, votes have { voter, weight, rshares, time }.
    // The sanitizer maps weight (not percent), so presence + weight >= 0 = upvote.
    const initialVoted = useMemo(() => {
        if (!voter || !Array.isArray(data.active_votes)) return 0;
        const myVote = data.active_votes.find(v => v && v.voter === voter);
        if (!myVote) return 0;
        if (myVote.weight < 0) return -1;
        return 1; // present in active_votes with weight >= 0 means upvoted
    }, [voter, data.active_votes]);

    // Identity of the post this instance is currently pointed at. A sort change
    // or a virtualized-row recycle re-points a live instance at a different post
    // instead of remounting it, so every piece of local vote state is scoped to
    // this rather than to the component's lifetime.
    const postKey = ((data.author || {}).username || '') + '/' + (data.permlink || data.id || '');

    // Optimistic vote, tagged with the post it was cast on and with the chain
    // value it was cast against. Read, not synced: when the instance is
    // re-pointed — or when the chain catches up, or the same post is voted from
    // PostDialog — the tag stops matching and initialVoted is used directly, in
    // the same render as the new data. The useEffect this replaces corrected
    // `voted` one commit *after* the new post had already rendered, and that late
    // 0 -> 1 flip was what the vote buttons read as a freshly cast vote.
    const [localVote, setLocalVote] = useState(null); // { key, base, voted } | null

    // Bumped only by a vote that succeeded in this session. This is the only
    // thing that can make a vote button animate — see VoteButton in
    // PaperCardActions. Monotonic on purpose: it is never reset, because the
    // buttons remount (and re-baseline) when postKey changes.
    const [voteNonce, setVoteNonce] = useState(0);

    const local = (localVote && localVote.key === postKey && localVote.base === initialVoted)
        ? localVote
        : null;
    const voted = local ? local.voted : initialVoted; // -1, 0, +1

    const applyVote = useCallback((w) => {
        setLocalVote({ key: postKey, base: initialVoted, voted: w > 0 ? 1 : w < 0 ? -1 : 0 });
        setVoteNonce((n) => n + 1);
    }, [postKey, initialVoted]);

    const [hasBeenVisible, setHasBeenVisible] = useState(!!visible);
    const [upvoteLoading, setUpvoteLoading] = useState(false);
    const [downvoteLoading, setDownvoteLoading] = useState(false);
    // Synchronous guard: refs are mutable and shared across all closures,
    // so rapid clicks always see the latest value (no stale closure problem).
    const votingRef = useRef(false);

    // NEW: Create canvas ref to access getBoundingClientRect
    const canvasRef = useRef(null);

    // Visibility is managed by parent; latch once
    useEffect(() => { if (visible && !hasBeenVisible) setHasBeenVisible(true); }, [visible, hasBeenVisible]);

    const rootRef = useRef(null);

    // Live relative date — this card re-renders exactly when the label is
    // due to change (every second under a minute old, every minute under
    // an hour, every hour under a day, then daily). The hook releases its
    // watcher on unmount. CanvasImage is memo'd on stable props, so the
    // tick never reaches the render pipeline.
    const liveTimeAgo = useLiveTimeAgo(data.date, { labels: 'narrow' });

    const openAuthor = useCallback((username) => {
        // HISTORY is a module-level singleton — no need to hold a ref.
        HISTORY.push('/@' + username);
    }, []);

    // Compute active_votes reflecting current local vote state
    const currentActiveVotes = useMemo(() => {
        const base = (data.active_votes || []).filter(v => v && v.voter !== voter);
        if (voted === 1 && voter) {
            base.push({ voter, weight: 10000, rshares: '0', time: null });
        } else if (voted === -1 && voter) {
            base.push({ voter, weight: -10000, rshares: '0', time: null });
        }
        return base;
    }, [data.active_votes, voted, voter]);

    const triggerPositiveVotes = useCallback(() => actions.trigger_votes({sign: '+', votes: currentActiveVotes, voter_profiles: data._voter_profiles || {}}), [currentActiveVotes, data._voter_profiles]);
    const triggerNegativeVotes = useCallback(() => actions.trigger_votes({sign: '-', votes: currentActiveVotes, voter_profiles: data._voter_profiles || {}}), [currentActiveVotes, data._voter_profiles]);

    // Resolve full img_obj (with type + data) before requesting decoded pixels,
    // so the fallback decode path in png-db works even after cache eviction.
    const getImgData = useCallback(async () => {
        if (!size) return null;
        return pngdby.get_new_img_data(size);
    }, [size]);

    // ── Runtime NSFW detection ──────────────────────────────────────────
    // Verdict for THIS post id. Seed from any synchronous cache hit so we
    // don't flash unblurred content for an id we've already classified.
    // `data.nsfw` is the author/server label; `detectedNsfw` is what the
    // on-device classifier found. The effective flag is the OR of the two.
    // Seed from a synchronous cache hit ONLY if the detector module is
    // already loaded — otherwise start undefined (unknown). Because loading
    // is async and non-critical, the card renders immediately either way;
    // once the module is present, later-mounted cards can seed here with no
    // re-render at all.
    const [detectedNsfw, setDetectedNsfw] = useState(() => {
        const mod = getLoadedNsfwDetect();
        return mod ? mod.getCached(id) : undefined;
    });

    useEffect(() => {
        // Only classify when the user has filtering ON. When `nsfw` (the
        // "show NSFW" toggle) is true, filtering is OFF → don't spend compute.
        const filterEnabled = !nsfw;

        if (!filterEnabled) {
            // Filtering off — there's nothing to detect. Only configure the
            // module if it already happens to be loaded; never force the
            // heavy import just to switch filtering off.
            const loaded = getLoadedNsfwDetect();
            if (loaded) loaded.configure({ filterEnabled });
            return;
        }
        if (data.nsfw === true) return;      // already labelled → already blurred
        if (detectedNsfw !== undefined) return; // already have a verdict for this id

        let cancelled = false;
        // Kick off the (deduped) lazy load. The card is already on screen;
        // this only refines the NSFW verdict when the module arrives.
        loadNsfwDetect().then((mod) => {
            if (cancelled || !mod) return;   // unmounted or module unavailable
            mod.configure({ filterEnabled });

            // While we were loading, another card may have classified this id.
            // Prefer that synchronous cache hit over re-running the classifier.
            const cached = mod.getCached(id);
            if (cached !== undefined) {
                if (!cancelled && cached !== detectedNsfw) setDetectedNsfw(cached);
                return;
            }

            mod
                .ensureNsfw({ id, getImgData, alreadyFlagged: data.nsfw === true })
                .then((verdict) => { if (!cancelled) setDetectedNsfw(verdict); })
                .catch(() => {});
        });

        return () => { cancelled = true; };
    }, [id, nsfw, data.nsfw, getImgData, detectedNsfw]);

    // Effective NSFW flag: server label OR on-device detection.
    const effectiveNsfwFlag = (data.nsfw === true) || (detectedNsfw === true);

    // NEW: Helper function to get canvas bounding rect safely
    const getCanvasBoundingRect = useCallback(() => {
        if (canvasRef.current) {
            return canvasRef.current.getBoundingClientRect();
        }
        // Fallback to root element if canvas ref is not available
        return rootRef.current?.getBoundingClientRect() || {};
    }, []);

    const handleUpvote = useCallback(() => {
        if (!voter) return;
        if (votingRef.current) {
            console.warn('[PaperCard] Upvote BLOCKED — already in flight (votingRef guard)');
            return;
        }
        const authorUsername = (data.author || {}).username;
        const permlink = data.permlink;
        if (!authorUsername || !permlink) return;

        votingRef.current = true;
        setUpvoteLoading(true);
        // Intent weight — when the weight dialog is enabled the user may change
        // the percentage, flip the sign, or cancel, so the optimistic state below
        // is driven by what vote() reports it *actually* did, not this guess.
        const newVoted = voted !== 1 ? 1 : 0;
        const weight = newVoted === 1 ? 10000 : 0;

        if (api) {
            api.broadcast.vote(voter, authorUsername, permlink, weight)
                .then((res) => {
                    // res.outcome: 'nothing' | 'positive' | 'negative' | 'withdrawal'
                    if (!res || res.outcome === 'nothing') return; // cancelled — leave UI as-is
                    const w = res.weight || 0;
                    applyVote(w);
                    if (onVoteChange) onVoteChange(permlink, voter, w);
                })
                .catch((e) => { console.warn('[PaperCard] vote failed:', e.message); })
                .finally(() => { votingRef.current = false; setUpvoteLoading(false); });
        } else {
            votingRef.current = false;
            setUpvoteLoading(false);
        }
    }, [voted, api, voter, data, applyVote, onVoteChange]);

    const handleDownvote = useCallback(() => {
        if (!voter) return;
        if (votingRef.current) return; // synchronous — never stale
        const authorUsername = (data.author || {}).username;
        const permlink = data.permlink;
        if (!authorUsername || !permlink) return;

        votingRef.current = true;
        setDownvoteLoading(true);
        // Intent weight — see handleUpvote: real outcome comes from vote()'s result.
        const newVoted = voted !== -1 ? -1 : 0;
        const weight = newVoted === -1 ? -10000 : 0;

        if (api) {
            api.broadcast.vote(voter, authorUsername, permlink, weight)
                .then((res) => {
                    // res.outcome: 'nothing' | 'positive' | 'negative' | 'withdrawal'
                    if (!res || res.outcome === 'nothing') return; // cancelled — leave UI as-is
                    const w = res.weight || 0;
                    applyVote(w);
                    if (onVoteChange) onVoteChange(permlink, voter, w);
                })
                .catch((e) => { console.warn('[PaperCard] vote failed:', e.message); })
                .finally(() => { votingRef.current = false; setDownvoteLoading(false); });
        } else {
            votingRef.current = false;
            setDownvoteLoading(false);
        }
    }, [voted, api, voter, data, applyVote, onVoteChange]);

    const author = data.author || {};
    const payout = parseFloat((data.payout || '').replace('$', '')) || 0;
    // Delta from initial state — avoids double-counting votes already in data.upVotesNumber
    const upVotesNumber = (data.upVotesNumber || 0) + (voted === 1 ? 1 : 0) - (initialVoted === 1 ? 1 : 0);
    const downVotesNumber = (data.downVotesNumber || 0) + (voted === -1 ? 1 : 0) - (initialVoted === -1 ? 1 : 0);
    // Prefer explicit commentsNumber if upstream provided it; fall back to `children`
    // (the canonical field on the post object from pixaproxyapi).
    const commentsNumber = data.commentsNumber ?? data.children ?? 0;

    // Only forward a handler if the parent actually provided one. When no
    // handler is passed, leave this undefined so PaperCardActions renders the
    // comments button in its disabled / dimmed state.
    const handleCommentsClick = useCallback(
        onCommentsClick ? (() => onCommentsClick(data)) : undefined,
        [onCommentsClick, data]
    );

    const imageClass = classes.image + (renderer === 'square' ? ' pixelated ' : '');
    // Blur for NSFW is applied via the `nsfw-blur` class inside CanvasImage,
    // not via inline `filter`. That way the opacity-reveal animation and
    // the blur don't fight for the same CSS property.
    const imageStyle = useMemo(() => ({
        minWidth: '100%',
        aspectRatio: `${image_width} / ${image_height}`,
        borderRadius: (renderer === 'xbrz' || renderer === 'tri') ? '21px' : '0px',
    }), [renderer, image_width, image_height]);

    return (
        <Card
            ref={rootRef}
            key={id}
            className={classes.card + (selected ? ' Mui-selected' : '') + (hasBeenVisible ? ' shown' : ' hidden')}
        >
            <CardHeader
                className={classes.cardHeader}
                avatar={
                    <Avatar
                        onClick={() => openAuthor(author.username)}
                        src={author.image}
                        imgProps={{ decoding: 'async', loading: 'lazy' }}
                    />
                }
                action={
                    <Suspense fallback={<span />}>
                        <IconButton aria-label="settings" onClick={(e) => onMenuClick(e, data)}>
                            <MoreVertIcon />
                        </IconButton>
                    </Suspense>
                }
                title={
                    <span onClick={() => onOpen?.(data, getCanvasBoundingRect())}>
                        {data.title}
                    </span>
                }
                subheader={
                    <span>
            <Tooltip
                arrow
                title={new Date(data.date || Date.now()).toLocaleDateString(locales, {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric',
                })}
            >
              <span className={classes.subheaderDate}>
                {liveTimeAgo}
              </span>
            </Tooltip>
            <span className={classes.subheaderBy}> {t('words.by')} </span>
                        {/* Rich author hover card (silhouette) instead of the old
                raw-@username Tooltip. Click behavior is unchanged. */}
                        <ProfileHoverAnchor api={api} author={author} onOpenProfile={openAuthor}>
              <span className={classes.subheaderName} onClick={() => openAuthor(author.username)}>
                {(typeof author.name === 'string' && author.name.trim()) || author.username || ''}
              </span>
            </ProfileHoverAnchor>
          </span>
                }
            />

            <ButtonBase
                onContextMenu={e => e.preventDefault()}
                style={{ width: '100%', borderRadius: (renderer === 'xbrz' || renderer === 'tri') ? '21px' : '0px' }}
                onClick={() => (effectiveNsfwFlag && !nsfw) ? undefined : onOpen?.(data, getCanvasBoundingRect())}
            >
                <CanvasImage
                    renderer={renderer}
                    mode={mode}
                    id={id}
                    size={size}
                    column_width={column_width}
                    image_width={image_width}
                    image_height={image_height}
                    getImgData={getImgData}
                    renderHex={hexF}
                    renderXbrz={xbrzF}
                    style={imageStyle}
                    renderCrt={crtF}
                    renderTri={triF}
                    className={imageClass}
                    onOpen={() => onOpen?.(data, getCanvasBoundingRect())}
                    nsfwEnabled={nsfw}
                    nsfwFlag={effectiveNsfwFlag}
                    canvasRef={canvasRef} // NEW: Pass the ref down
                />
            </ButtonBase>

            <PaperCardActions
                api={api}
                upvoteLoading={upvoteLoading}
                downvoteLoading={downvoteLoading}
                voted={voted}
                voteNonce={voteNonce}
                handleUpvote={handleUpvote}
                handleDownvote={handleDownvote}
                upVotesNumber={upVotesNumber}
                downVotesNumber={downVotesNumber}
                triggerPositiveVotes={triggerPositiveVotes}
                triggerNegativeVotes={triggerNegativeVotes}
                payout={payout}
                data={data}
                voter={voter}
                commentsNumber={commentsNumber}
                showComments={true}
                onCommentsClick={handleCommentsClick}
            />
        </Card>
    );
}

const PaperCardInnerStyled = withStyles(styles)(PaperCardInner);

const StyledPaperCard = memo(
    ({ ...rest }) => <PaperCardInnerStyled {...rest} />,
    (prev, next) => (
        prev.id === next.id &&
        prev.data === next.data &&
        prev.visible === next.visible &&
        prev.renderer === next.renderer &&
        prev.mode === next.mode &&
        prev.nsfw === next.nsfw &&
        prev.selected === next.selected &&
        prev.locales === next.locales &&
        prev.image_height === next.image_height &&
        prev.image_width === next.image_width &&
        prev.voter === next.voter
    )
);

const PaperCard = memo(
    ({ style, key, ...rest }) => (
        <div style={style} key={key}>
            <StyledPaperCard {...rest} />
        </div>
    ),
    (prev, next) => (
        prev.id === next.id &&
        prev.data === next.data &&
        prev.visible === next.visible &&
        prev.renderer === next.renderer &&
        prev.mode === next.mode &&
        prev.nsfw === next.nsfw &&
        prev.selected === next.selected &&
        prev.locales === next.locales &&
        prev.image_height === next.image_height &&
        prev.image_width === next.image_width &&
        prev.voter === next.voter &&
        shallowEqual(prev.style, next.style)
    )
);

// Contain render crashes to the single card: a malformed post payload
// now drops one cell with a Retry box instead of white-screening the
// whole feed. resetKey is tied to the post id so a recycled virtualized
// cell that receives a NEW post clears any previous error automatically.
export default withErrorBoundary(PaperCard, {
    label: "post card",
    getResetKey: (props) => props && props.data && props.data.id,
});