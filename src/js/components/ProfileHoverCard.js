import * as React from 'preact/compat';
import { render } from 'preact/compat';
import { withStyles, ThemeProvider, useTheme } from '@material-ui/core/styles';
import Popper from '@material-ui/core/Popper';
import Fade from '@material-ui/core/Fade';
import ButtonBase from '@material-ui/core/ButtonBase';
import Button from '@material-ui/core/Button';
import ButtonGroup from '@material-ui/core/ButtonGroup';
import Typography from '@material-ui/core/Typography';
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';
import BellIcon from '../icons/Bell';
import BellRingIcon from '../icons/BellRing';
import AccountArrowLeft from '../icons/AccountArrowLeft';
import AccountArrowRight from '../icons/AccountArrowRight';
import { t, useLanguage } from '../utils/text';
import { TRANSITION_FAST as TF, RAINBOW_RIPPLE as RIPPLE } from '../theme/motion';

const { useState, useEffect, useRef, useCallback, useReducer } = React;

if (typeof window !== 'undefined') {
    window.__PIXA_VERSIONS__ = window.__PIXA_VERSIONS__ || {};
    window.__PIXA_VERSIONS__.ProfileHoverCard = '3.2.2-namelink';
}

/* ────────────────────────────────────────────────────────────────────────────
 * ProfileHoverCard — author hover card for PaperCard / PaperCardBlog.
 *
 * Rounded-square design: the card and the avatar share one border radius
 * (CARD_RADIUS); the avatar sits flush inside the card — no padding, no
 * margin, its left corners coinciding with the card's — and only the text
 * column at the right carries padding. Fonts: Industry everywhere except
 * the biography → Normative Pro (3-line CSS clamp). No reputation badge.
 * The action row follows the app's FollowButtons conventions: follower /
 * following count ButtonGroup (AccountArrowLeft/Right + formatCount,
 * navigating to /@name/followers|following) and the Bell / BellRing
 * IconButton follow toggle (whiteButton styling, disabled + explanatory
 * tooltip when logged out, hidden on the viewer's own account).
 *
 * PERFORMANCE — singleton layer, page-level invocation:
 * A page renders hundreds of cards, so the per-card anchor must cost
 * nothing. ProfileHoverAnchor is now just a <span> with two pointer
 * listeners — no Popper, no state, no timers per card. All of that lives
 * in ONE ProfileHoverCardLayer holding the single Popper + card, and the
 * anchors invoke it through a module-level controller:
 *
 *   · lazy portal (default): the first hover creates a host div on
 *     document.body and renders the layer into it — nothing to wire up;
 *   · page-level (optional): render <ProfileHoverCardLayer /> once in a
 *     page/app root; it registers itself and the lazy portal never mounts.
 *
 * Hover-intent timing (open 420 ms / close 280 ms), retargeting (moving
 * from one author name to another while open swaps the card in place),
 * scroll/Escape close and mouse-only gating are all handled by the layer.
 *
 * The anchor API is unchanged: PaperCard / PaperCardBlog wrap their name
 * span in <ProfileHoverAnchor api author onOpenProfile> and need no edits —
 * count navigation reuses onOpenProfile('name/followers'), which both
 * cards' openAuthor turn into HISTORY.push('/@name/followers').
 * ──────────────────────────────────────────────────────────────────────── */

/* ── Module-level caches ─────────────────────────────────────────────────
 * One author bundle fetch (account + follow counts, 5 min TTL) per author
 * across every card on the page; one active-account resolution and one
 * following-list fetch per api instance and TTL window. The following list
 * is a lowercased Set mutated optimistically on follow/unfollow — cached
 * counts get the same ±1 — so every later hover agrees without refetching. */
const BUNDLE_TTL_MS = 5 * 60 * 1000;
const BUNDLE_CACHE_MAX = 200;
const bundleCache = new Map(); // username → { at, bundle } | { at, promise }

function fetchAuthorBundle(api, username) {
    const counts0 = { follower_count: 0, following_count: 0 };
    const accountsOk = api && api.accounts && typeof api.accounts.getAccounts === 'function';
    const countsOk = api && api.follow && typeof api.follow.getFollowCount === 'function';
    return Promise.all([
        accountsOk ? api.accounts.getAccounts([username], true).catch(() => []) : Promise.resolve([]),
        countsOk ? api.follow.getFollowCount(username).catch(() => counts0) : Promise.resolve(counts0),
    ]).then(([accs, fc]) => ({
        account: (Array.isArray(accs) && accs[0]) || null,
        counts: {
            follower_count: (fc && fc.follower_count) || 0,
            following_count: (fc && fc.following_count) || 0,
        },
    }));
}

function getCachedBundle(api, username) {
    const key = (username || '').toLowerCase();
    if (!key || !api) return Promise.resolve(null);
    const now = Date.now();
    const hit = bundleCache.get(key);
    if (hit && hit.bundle && now - hit.at < BUNDLE_TTL_MS) return Promise.resolve(hit.bundle);
    if (hit && hit.promise && now - hit.at < BUNDLE_TTL_MS) return hit.promise;
    const promise = fetchAuthorBundle(api, username)
        .then((bundle) => {
            bundleCache.set(key, { at: Date.now(), bundle });
            return bundle;
        })
        .catch(() => {
            bundleCache.delete(key);
            return null;
        });
    bundleCache.set(key, { at: now, promise });
    if (bundleCache.size > BUNDLE_CACHE_MAX) {
        const oldest = bundleCache.keys().next().value;
        if (oldest !== undefined) bundleCache.delete(oldest);
    }
    return promise;
}

function adjustCachedFollowerCount(username, delta) {
    const hit = bundleCache.get((username || '').toLowerCase());
    if (hit && hit.bundle && hit.bundle.counts) {
        hit.bundle.counts.follower_count = Math.max(
            0,
            (hit.bundle.counts.follower_count || 0) + delta
        );
    }
}

/* Active account (string username or null) and its following list — keyed
 * per api instance so nothing bleeds across contexts. */
const ACTIVE_TTL_MS = 5 * 60 * 1000;
const activeCache = new WeakMap(); // api → { at, name, promise }

function getCachedActiveAccount(api) {
    if (!api || typeof api.getActiveAccount !== 'function') return Promise.resolve(null);
    const now = Date.now();
    const hit = activeCache.get(api);
    if (hit && hit.name !== undefined && now - hit.at < ACTIVE_TTL_MS) {
        return Promise.resolve(hit.name);
    }
    if (hit && hit.promise && now - hit.at < ACTIVE_TTL_MS) return hit.promise;
    const promise = api
        .getActiveAccount()
        .then((name) => {
            activeCache.set(api, { at: Date.now(), name: name || null, promise: null });
            return name || null;
        })
        .catch(() => {
            activeCache.delete(api);
            return null;
        });
    activeCache.set(api, { at: now, name: undefined, promise });
    return promise;
}

/* Who does the active account follow — the Profile.js backfill call, made
 * once and kept as a Set for O(1) membership checks. */
const FOLLOWING_TTL_MS = 5 * 60 * 1000;
const followingCache = new WeakMap(); // api → { owner, at, set, promise }

function getCachedFollowingSet(api, owner) {
    if (!owner || !api || !api.follow || typeof api.follow.getFollowing !== 'function') {
        return Promise.resolve(null);
    }
    const now = Date.now();
    const hit = followingCache.get(api);
    if (hit && hit.owner === owner && hit.set && now - hit.at < FOLLOWING_TTL_MS) {
        return Promise.resolve(hit.set);
    }
    if (hit && hit.owner === owner && hit.promise && now - hit.at < FOLLOWING_TTL_MS) {
        return hit.promise;
    }
    const promise = api.follow
        .getFollowing(owner, '', 'blog', 1000)
        .then((list) => {
            const set = new Set(
                (Array.isArray(list) ? list : [])
                    .map((f) => ((f && f.following) || '').toLowerCase())
                    .filter(Boolean)
            );
            followingCache.set(api, { owner, at: Date.now(), set, promise: null });
            return set;
        })
        .catch(() => {
            const cur = followingCache.get(api);
            if (cur && cur.owner === owner) followingCache.delete(api);
            return null;
        });
    followingCache.set(api, { owner, at: now, set: null, promise });
    return promise;
}

function getFollowingSetSync(api) {
    const hit = followingCache.get(api);
    return (hit && hit.set) || null;
}

/* ── Data hooks (run only inside the single mounted card) ──────────────── */

function useAuthorBundle(api, username) {
    const [state, setState] = useState({ loading: true, bundle: null });
    useEffect(() => {
        if (!username) return undefined;
        let alive = true;
        const hit = bundleCache.get((username || '').toLowerCase());
        const cached = hit && hit.bundle && Date.now() - hit.at < BUNDLE_TTL_MS;
        if (!cached) setState({ loading: true, bundle: null });
        getCachedBundle(api, username).then((bundle) => {
            if (alive) setState({ loading: false, bundle });
        });
        return () => { alive = false; };
    }, [api, username]);
    return state;
}

/* Follow status for the hovered author:
 *   mode 'loading'    — resolving active account / following list
 *   mode 'logged-out' — no active account → bell disabled + tooltip
 *   mode 'own'        — viewer's own account → bell hidden
 *   mode 'hidden'     — follow/broadcast API unavailable
 *   mode 'ready'      — following boolean usable
 * toggle() mirrors Profile.js: optimistic flip (cache Set + cached
 * follower count included, onCountDelta re-renders the card), then
 * api.broadcast.follow/unfollow(active, author), full revert on error. */
function useFollowState(api, username, onCountDelta) {
    const [state, setState] = useState({ mode: 'loading', following: false });
    const activeUserRef = useRef(null);

    useEffect(() => {
        if (!username) return undefined;
        let alive = true;
        const broadcastOk = !!(api && api.broadcast &&
            typeof api.broadcast.follow === 'function' &&
            typeof api.broadcast.unfollow === 'function');
        if (!broadcastOk) { setState({ mode: 'hidden', following: false }); return undefined; }
        setState({ mode: 'loading', following: false });
        getCachedActiveAccount(api).then((activeUser) => {
            if (!alive) return;
            activeUserRef.current = activeUser || null;
            if (!activeUser) { setState({ mode: 'logged-out', following: false }); return; }
            if (activeUser.toLowerCase() === username.toLowerCase()) {
                setState({ mode: 'own', following: false });
                return;
            }
            getCachedFollowingSet(api, activeUser).then((set) => {
                if (!alive) return;
                if (!set) { setState({ mode: 'hidden', following: false }); return; }
                setState({ mode: 'ready', following: set.has(username.toLowerCase()) });
            });
        });
        return () => { alive = false; };
    }, [api, username]);

    const toggle = useCallback(() => {
        const activeUser = activeUserRef.current;
        if (!activeUser || !username) return;
        setState((s) => {
            if (s.mode !== 'ready') return s;
            const nf = !s.following;
            const key = username.toLowerCase();
            const delta = nf ? 1 : -1;
            const set = getFollowingSetSync(api);
            if (set) { if (nf) set.add(key); else set.delete(key); }
            adjustCachedFollowerCount(username, delta);
            if (onCountDelta) onCountDelta();
            (async () => {
                try {
                    if (nf) await api.broadcast.follow(activeUser, username);
                    else await api.broadcast.unfollow(activeUser, username);
                } catch (e) {
                    // Revert everything the optimistic path touched.
                    const s2 = getFollowingSetSync(api);
                    if (s2) { if (nf) s2.delete(key); else s2.add(key); }
                    adjustCachedFollowerCount(username, -delta);
                    if (onCountDelta) onCountDelta();
                    setState({ mode: 'ready', following: !nf });
                }
            })();
            return { mode: 'ready', following: nf };
        });
    }, [api, username, onCountDelta]);

    return { ...state, toggle };
}

/* Same compact formatting as the app's FollowButtons. */
function formatCount(count) {
    if (count === undefined || count === null) return '0';
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count.toString();
}

/* ── Card geometry ───────────────────────────────────────────────────────
 * Rounded square: CARD_RADIUS shapes the card and the avatar's LEFT
 * corners only — the avatar's right edge is square, giving the text
 * column a straight gutter. The image is flush (no padding/margin); the
 * card height equals the avatar side; only the text column pads. */
const CARD_W = 480;
const CARD_H = 204;   // fits handle + name + 3-line bio + button margins
const AVATAR = CARD_H;
const CARD_RADIUS = 32;

const cardStyles = () => ({
    cardRoot: {
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'stretch',
        width: CARD_W,
        maxWidth: 'calc(100vw - 24px)',
        height: CARD_H,
        boxSizing: 'border-box',
        padding: 0,
        backgroundColor: '#000000',
        borderRadius: CARD_RADIUS,
        overflow: 'hidden',
        filter: 'drop-shadow(0 10px 26px rgba(0,0,0,0.55))',
        userSelect: 'none',
    },
    avatarButton: {
        flex: 'none',
        width: AVATAR,
        height: AVATAR,
        /* Rounded only where it meets the card's own corners — the right
         * edge is a straight vertical line against the text column. */
        borderRadius: `${CARD_RADIUS}px 0 0 ${CARD_RADIUS}px`,
        overflow: 'hidden',
        backgroundColor: '#1b1b1b',
        cursor: 'pointer',
    },
    avatarImg: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block',
        /* Avatars are pixel art (48 kB probe upstream) — keep edges crisp. */
        imageRendering: 'pixelated',
    },
    avatarInitial: {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '"Industry Book", sans-serif',
        fontWeight: 600,
        fontSize: 72,
        color: '#666666',
        textTransform: 'uppercase',
    },
    col: {
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        padding: '8px 14px 8px 16px',
    },
    /* @username above, display name below — separate lines sharing one
     * left gutter against the avatar's straight right side. */
    username: {
        fontFamily: '"Industry Book", sans-serif',
        fontWeight: 400,
        fontSize: 17,
        lineHeight: '22px',
        color: '#ffffff',
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        transition: `color ${TF}`,
        '&:hover': { color: '#bdbdbd' },
    },
    displayName: {
        fontFamily: '"Industry Book", sans-serif',
        fontWeight: 600,
        fontSize: 29,
        lineHeight: '34px',
        color: '#ffffff',
        marginTop: 2,
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        transition: `color ${TF}`,
        '&:hover': { color: '#bdbdbd' },
    },
    /* Biography is the one non-Industry text — Normative Pro, 3-line clamp. */
    bio: {
        fontFamily: '"Normative Pro", sans-serif',
        fontWeight: 400,
        fontSize: 13,
        lineHeight: '17px',
        color: '#e0e0e0',
        marginTop: 2,
        maxWidth: '100%',
        display: '-webkit-box',
        '-webkit-line-clamp': 3,
        '-webkit-box-orient': 'vertical',
        overflow: 'hidden',
        overflowWrap: 'anywhere',
    },
    /* Sits after the biography (or the display name when the bio is
     * short) with a small gap above and a clear margin below. */
    actions: {
        display: 'flex',
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 16,
    },
    /* Follower / following counts — the app's FollowButtons group styling. */
    countsGroup: {
        boxShadow: 'none',
        '& .MuiButtonGroup-groupedContainedHorizontal:not(:last-child)': {
            borderRight: '1px solid #000',
        },
        '& .MuiButtonGroup-groupedHorizontal': {
            borderRadius: '32px',
            height: 43,
            color: 'rgb(183 183 183)',
            backgroundColor: '#1e1e1e',
            boxShadow: 'none',
            '&:hover': { color: 'rgb(220 220 220)', backgroundColor: '#212121' },
        },
        '& .MuiTouchRipple-child': { backgroundImage: RIPPLE },
    },
    /* Bell toggle — Profile's whiteButton look. */
    bellButton: {
        marginLeft: 8,
        width: 48,
        '&.MuiIconButton-root': {
            color: '#b5b5b5',
            background: '#1e1e1e',
            transition: `background-color ${TF}, box-shadow ${TF}, border ${TF}, color ${TF}`,
        },
        '&.MuiIconButton-root:hover': { color: '#c7c7c7', background: '#212121' },
        '&.MuiIconButton-root.Mui-disabled': { color: '#5a5a5a', background: '#161616' },
        '& .MuiTouchRipple-child': { backgroundImage: RIPPLE },
    },
    /* Loading skeletons (display name / biography / action row). */
    skeleton: {
        borderRadius: 6,
        backgroundColor: '#1f1f1f',
        animation: '$phcPulse 1.2s ease-in-out infinite',
    },
    '@keyframes phcPulse': {
        '0%': { opacity: 0.45 },
        '50%': { opacity: 1 },
        '100%': { opacity: 0.45 },
    },
    '@media (prefers-reduced-motion: reduce)': {
        skeleton: { animation: 'none' },
    },
});

/* ── The card ──────────────────────────────────────────────────────────── */
const ProfileHoverCardBase = withStyles(cardStyles)(function ProfileHoverCard(props) {
    const {
        classes, api, author = {}, onOpenProfile,
        onHold, onRelease,
    } = props;
    useLanguage();
    const username = author.username || '';
    const [, forceRender] = useReducer((x) => x + 1, 0);
    const { loading, bundle } = useAuthorBundle(api, username);
    const follow = useFollowState(api, username, forceRender);

    const account = (bundle && bundle.account) || null;
    const counts = (bundle && bundle.counts) || null;
    const profile = (account && account._profile) || {};
    const displayName =
        (typeof profile.display_name === 'string' && profile.display_name.trim()) ||
        (typeof author.name === 'string' && author.name.trim()) ||
        username;
    const bio = (typeof profile.about === 'string' && profile.about.trim()) || '';
    const imageSrc = profile.profile_image || author.image || '';
    const [imgFailed, setImgFailed] = useState(false);
    useEffect(() => { setImgFailed(false); }, [imageSrc]);

    const openProfile = useCallback(() => {
        if (typeof onOpenProfile === 'function' && username) onOpenProfile(username);
    }, [onOpenProfile, username]);
    const openFollowers = useCallback(() => {
        if (typeof onOpenProfile === 'function' && username) onOpenProfile(username + '/followers');
    }, [onOpenProfile, username]);
    const openFollowing = useCallback(() => {
        if (typeof onOpenProfile === 'function' && username) onOpenProfile(username + '/following');
    }, [onOpenProfile, username]);

    const isLoggedOut = follow.mode === 'logged-out';
    const bellTitle = isLoggedOut
        ? 'You must create an account or login to follow this account'
        : follow.following
            ? 'You are following this account'
            : 'You are not following this account';

    return (
        <div
            className={classes.cardRoot}
            onPointerEnter={onHold}
            onPointerLeave={onRelease}
        >
            {/* Flush avatar — no padding/margin, no ripple recolor. */}
            <ButtonBase
                className={classes.avatarButton}
                onClick={openProfile}
                aria-label={'@' + username}
            >
                {imageSrc && !imgFailed ? (
                    <Fade in timeout={0} key={imageSrc}><img
                        className={classes.avatarImg + " pixelated"}
                        src={imageSrc}
                        alt=""
                        draggable={false}
                        onError={() => setImgFailed(true)}
                    /></Fade>
                ) : (
                    <span className={classes.avatarInitial}>
                        {(displayName || username || '?').charAt(0)}
                    </span>
                )}
            </ButtonBase>

            <div className={classes.col}>
                <Fade in timeout={100} key={imageSrc}><span
                    className={classes.username}
                    onClick={openProfile}
                    role="link"
                    tabIndex={-1}
                >
                    {'@' + username}
                </span></Fade>
                <Fade in timeout={300} key={imageSrc}><span
                    className={classes.displayName}
                    onClick={openProfile}
                    role="link"
                    tabIndex={-1}
                >
                    {displayName}
                </span></Fade>

                {loading && !bundle ? (
                    <React.Fragment>
                        <span className={classes.skeleton} style={{ width: 230, height: 11, marginTop: 8 }} />
                        <span className={classes.skeleton} style={{ width: 200, height: 11, marginTop: 6 }} />
                        <span className={classes.skeleton} style={{ width: 176, height: 43, marginTop: 12, marginBottom: 16, borderRadius: 32 }} />
                    </React.Fragment>
                ) : (
                    <React.Fragment>
                        {bio ? <Fade in timeout={500} key={imageSrc}><span className={classes.bio}>{bio}</span></Fade> : null}

                        <Fade in timeout={bio ? 700: 500} key={imageSrc}>
                            <div className={classes.actions}>
                                <ButtonGroup
                                    variant="contained"
                                    className={classes.countsGroup}
                                    aria-label={t('components.follow_buttons.follow_actions')}
                                >
                                    <Button onClick={openFollowers}>
                                        <Typography component="span" style={{ textTransform: 'none' }}>
                                            <span style={{ marginRight: 4, opacity: 0.8 }}><AccountArrowLeft /></span>
                                            <strong>{formatCount(counts ? counts.follower_count : undefined)}</strong>
                                        </Typography>
                                    </Button>
                                    <Button onClick={openFollowing}>
                                        <Typography component="span" style={{ textTransform: 'none' }}>
                                            <span style={{ marginRight: 4, opacity: 0.8 }}><AccountArrowRight /></span>
                                            <strong>{formatCount(counts ? counts.following_count : undefined)}</strong>
                                        </Typography>
                                    </Button>
                                </ButtonGroup>

                                {(follow.mode === 'ready' || isLoggedOut || follow.mode === 'loading') && (
                                    <Tooltip
                                        arrow
                                        enterTouchDelay={200}
                                        leaveTouchDelay={4000}
                                        title={bellTitle}
                                    >
                                        {/* span keeps the tooltip alive over the
                                            disabled (logged-out) button */}
                                        <span style={{ display: 'inline-flex' }}>
                                            <IconButton
                                                disabled={isLoggedOut || follow.mode === 'loading'}
                                                className={classes.bellButton}
                                                onClick={follow.toggle}
                                            >
                                                {follow.following ? <BellRingIcon /> : <BellIcon />}
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                )}
                            </div>
                        </Fade>
                    </React.Fragment>
                )}
            </div>
        </div>
    );
});

/* ── Singleton layer ─────────────────────────────────────────────────────
 * One Popper + card for the whole page. Anchors talk to it through this
 * module-level controller; before the layer has mounted, the latest
 * request is queued and flushed on registration. */
const OPEN_DELAY_MS = 420;
const CLOSE_DELAY_MS = 280;

let layerCtl = null;      // controller registered by the mounted layer
let layerQueued = null;   // latest withLayer callback awaiting registration
let layerHostMade = false;

/* The lazy layer renders into its own root OUTSIDE the app's ThemeProvider.
 * Without the app theme, MUI would fall back to its default LIGHT theme
 * there — and because v4 injects core sheets per theme, that would append
 * light-coloured duplicates of global classes (.MuiIconButton-root,
 * .MuiSvgIcon-*, …) AFTER the app's themed sheets, flipping icons across
 * the whole app toward black. Anchors live inside the app tree, so they
 * capture the real theme and the layer re-provides it: same theme object →
 * the already-injected sheets are reused and nothing new leaks. */
let capturedAppTheme = null;

function mountLazyLayer() {
    if (layerHostMade || layerCtl || typeof document === 'undefined') return;
    layerHostMade = true;
    const host = document.createElement('div');
    host.setAttribute('data-pixa-profile-hover-layer', '');
    document.body.appendChild(host);
    render(<ProfileHoverCardLayer />, host);
}

function withLayer(fn) {
    if (typeof document === 'undefined') return;
    if (layerCtl) { fn(layerCtl); return; }
    layerQueued = fn;
    mountLazyLayer();
}

export function ProfileHoverCardLayer() {
    const [target, setTarget] = useState(null); // { anchorEl, api, author, onOpenProfile }
    const [open, setOpen] = useState(false);
    const openTimer = useRef(null);
    const closeTimer = useRef(null);
    const targetRef = useRef(null);
    const openRef = useRef(false);
    targetRef.current = target;
    openRef.current = open;

    const clearTimers = useCallback(() => {
        if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
        if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    }, []);

    const closeNow = useCallback(() => { clearTimers(); setOpen(false); }, [clearTimers]);

    // Stable controller — created once, registered for the module.
    const ctlRef = useRef(null);
    if (!ctlRef.current) {
        ctlRef.current = {
            requestOpen(payload) {
                clearTimers();
                if (openRef.current) {
                    // Already open: retarget in place (moving between names).
                    setTarget(payload);
                    return;
                }
                openTimer.current = setTimeout(() => {
                    setTarget(payload);
                    setOpen(true);
                }, OPEN_DELAY_MS);
            },
            requestClose() {
                clearTimers();
                closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
            },
            hold() { clearTimers(); },
            closeIfAnchor(el) {
                const cur = targetRef.current;
                if (openRef.current && cur && cur.anchorEl === el) closeNow();
            },
        };
    }

    useEffect(() => {
        // First registered layer wins (a page-level layer pre-empts the lazy
        // portal; a second mount stays inert).
        if (layerCtl && layerCtl !== ctlRef.current) return undefined;
        layerCtl = ctlRef.current;
        if (layerQueued) { const q = layerQueued; layerQueued = null; q(layerCtl); }
        return () => { if (layerCtl === ctlRef.current) layerCtl = null; };
    }, []);

    // Close on any scroll (capture reaches nested scrollers) and on Escape.
    useEffect(() => {
        if (!open) return undefined;
        const onScroll = () => closeNow();
        const onKey = (e) => { if (e.key === 'Escape') closeNow(); };
        window.addEventListener('scroll', onScroll, { capture: true, passive: true });
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('scroll', onScroll, { capture: true });
            window.removeEventListener('keydown', onKey);
        };
    }, [open, closeNow]);

    const openProfile = useCallback((targetPath) => {
        const cur = targetRef.current;
        closeNow();
        if (cur && typeof cur.onOpenProfile === 'function') cur.onOpenProfile(targetPath);
    }, [closeNow]);

    if (!target) return null;
    const content = (
        <Popper
            open={open}
            anchorEl={target.anchorEl}
            placement="bottom"
            transition
            style={{ zIndex: 1500, pointerEvents: 'none' }}
            modifiers={{
                offset: { enabled: true, offset: '0, 12' },
                flip: { enabled: true },
                preventOverflow: { enabled: true, boundariesElement: 'viewport' },
            }}
        >
            {({ TransitionProps }) => (
                <Fade {...TransitionProps} timeout={{ enter: 200, exit: 150 }}>
                    <div style={{ pointerEvents: 'none' }}>
                        <ProfileHoverCardBase
                            api={target.api}
                            author={target.author}
                            onOpenProfile={openProfile}
                            onHold={ctlRef.current.hold}
                            onRelease={ctlRef.current.requestClose}
                        />
                    </div>
                </Fade>
            )}
        </Popper>
    );
    return capturedAppTheme
        ? <ThemeProvider theme={capturedAppTheme}>{content}</ThemeProvider>
        : content;
}

/* ── Anchor: featherweight per-card wrapper ────────────────────────────── */
function ProfileHoverAnchorInner(props) {
    const { api, author = {}, onOpenProfile, children } = props;
    const anchorRef = useRef(null);
    // Read the app theme from context (anchors are inside the provider) so
    // the out-of-tree layer can re-provide it — see capturedAppTheme above.
    const theme = useTheme();
    const themeRef = useRef(theme);
    themeRef.current = theme;

    const handleEnter = useCallback((e) => {
        // Hover is a mouse concept — touch keeps its tap-to-navigate behavior.
        if (e && e.pointerType && e.pointerType !== 'mouse') return;
        const el = anchorRef.current;
        if (!el) return;
        capturedAppTheme = themeRef.current;
        withLayer((ctl) => ctl.requestOpen({ anchorEl: el, api, author, onOpenProfile }));
    }, [api, author, onOpenProfile]);

    const handleLeave = useCallback(() => {
        withLayer((ctl) => ctl.requestClose());
    }, []);

    // New author under the same anchor (recycled rows) or unmount → make
    // sure a card anchored here doesn't linger.
    useEffect(() => {
        const el = anchorRef.current;
        return () => { if (layerCtl && el) layerCtl.closeIfAnchor(el); };
    }, [author.username]);

    return (
        <span
            ref={anchorRef}
            style={{ display: 'inline' }}
            onPointerEnter={handleEnter}
            onPointerLeave={handleLeave}
        >
            {children}
        </span>
    );
}

const ProfileHoverAnchor = React.memo(ProfileHoverAnchorInner, (prev, next) => (
    prev.api === next.api &&
    (prev.author || {}).username === (next.author || {}).username &&
    (prev.author || {}).name === (next.author || {}).name &&
    (prev.author || {}).image === (next.author || {}).image &&
    prev.onOpenProfile === next.onOpenProfile &&
    prev.children === next.children
));

export default ProfileHoverAnchor;