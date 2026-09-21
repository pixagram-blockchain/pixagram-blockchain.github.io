import * as React from 'preact/compat';
import { withStyles } from '@material-ui/core/styles';
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
import { HISTORY } from '../utils/constants';
import { t, useLanguage } from '../utils/text';
import { TRANSITION_FAST as TF, RAINBOW_RIPPLE as RIPPLE } from '../theme/motion';

const {
    useState, useEffect, useLayoutEffect, useRef, useCallback, useReducer,
    memo, isValidElement, cloneElement,
} = React;

if (typeof window !== 'undefined') {
    window.__PIXA_VERSIONS__ = window.__PIXA_VERSIONS__ || {};
    window.__PIXA_VERSIONS__.ProfileHoverCard = '5.0.0-layer';
}

/* ────────────────────────────────────────────────────────────────────────────
 * ProfileHoverCard — author hover card for every card that names an
 * account: PaperCard, PaperCardBlog, PaperCardReply, PaperCardComment, and
 * anything else that wraps a name in <ProfileHoverAnchor>.
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
 * ARCHITECTURE — one floating element per page, zero elements per card:
 *
 *   · <ProfileHoverCardLayer/> is mounted ONCE by each page that shows
 *     these cards (Feed, FeedPersonal, Profile, Community). It owns the
 *     single MUI <Popper> + card for the whole page and renders nothing at
 *     all while no name is hovered. The layer is part of the page tree, so
 *     it unmounts with the page: a card can never outlive the page that
 *     showed it.
 *
 *   · <ProfileHoverAnchor> is the per-card wrapper and it renders NO element
 *     of its own: it clones the name <span> it is given and attaches two
 *     pointer listeners plus a ref to it. A feed of hundreds of cards costs
 *     hundreds of listeners and not one extra node — no Popper, no Portal,
 *     no state, no timers until a name is actually hovered.
 *
 *   · Anchors and the layer meet in the module-level HOVER registry below:
 *     the one anchor whose card is up, the open / closing phase, the close
 *     grace timer and the MUI-Tooltip-style warm window that lets the card
 *     swap near-instantly when the pointer slides from one author name to
 *     the next. The registry is plain data; the layer re-renders when it is
 *     told to (notify()) and reads it during that render.
 *
 *   · Hover intent — mouse only, OPEN_DELAY_MS at rest on the name — shows
 *     the card. PREFETCH_DELAY_MS into a hover the author bundle and the
 *     active account are pulled into the module caches, so by the time the
 *     card appears its numbers are usually already there (no skeleton).
 *
 *   · While a card is on screen the layer listens for everything that
 *     should take it down, none of which the per-card wrapper could see:
 *     the pointer resting anywhere but the name or the card (checked on
 *     pointermove, so a dialog or backdrop sliding under a resting pointer
 *     is caught even when the browser never delivers a pointerleave), any
 *     pointerdown outside the card, Escape, any scroll, a route change
 *     (HISTORY — page swaps, the wallet's /@name/wallet round trip, post
 *     overlays), the tab going hidden, the window losing focus, the
 *     hovered anchor unmounting or being re-pointed at another author, and
 *     the layer itself unmounting.
 *
 * Usage — identical in every card, the click behavior is the card's own:
 *
 *   <ProfileHoverAnchor api={api} author={author} onOpenProfile={openAuthor}>
 *     <span className={classes.subheaderName} onClick={…}>{name}</span>
 *   </ProfileHoverAnchor>
 *
 * and once per page, anywhere in its tree:
 *
 *   <ProfileHoverCardLayer />
 *
 * Count navigation reuses onOpenProfile('name/followers'), which the cards'
 * openAuthor turns into HISTORY.push('/@name/followers').
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

/* ── Data hooks (run only inside the one mounted card) ─────────────────── */

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
        rootRef, onHold, onRelease,
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

    /* The layer keys the card by anchor + author, so it mounts fresh for
     * every name and every <Fade> below plays its staggered entrance on
     * mount — no keys needed to retrigger them. */
    return (
        <div
            ref={rootRef}
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
                <Fade in timeout={100}><span
                    className={classes.username}
                    onClick={openProfile}
                    role="link"
                    tabIndex={-1}
                >
                    {'@' + username}
                </span></Fade>
                <Fade in timeout={300}><span
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
                        {bio ? <Fade in timeout={500}><span className={classes.bio}>{bio}</span></Fade> : null}

                        <Fade in timeout={bio ? 700 : 500}>
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

/* ── Hover-intent timing ─────────────────────────────────────────────────── */
const OPEN_DELAY_MS = 420;      // rest on a name this long before the card shows
const OPEN_DELAY_WARM_MS = 80;  // …or only this long right after another card closed
const CLOSE_DELAY_MS = 280;     // grace period to travel from the name to the card
const PREFETCH_DELAY_MS = 150;  // hover this long → warm the data caches
const WARM_MS = 600;            // a pointer-driven close keeps the next open fast

const FADE_TIMEOUT = { enter: 200, exit: 150 };
const POPPER_STYLE = { zIndex: 1500, pointerEvents: 'none' };
const POPPER_MODIFIERS = {
    offset: { enabled: true, offset: '0, 12' },
    flip: { enabled: true },
    preventOverflow: { enabled: true, boundariesElement: 'viewport' },
};
const PASS_THROUGH_STYLE = { pointerEvents: 'none' }; // only the card itself catches the pointer
const ANCHOR_STYLE = { display: 'inline' };

/* ── Hover registry ───────────────────────────────────────────────────────
 * The single meeting point of every anchor and the one mounted layer. Plain
 * data, not React state: mutations call notify() and the layer re-renders
 * from it. `layers` is a stack so that a layer nested inside another page
 * (a dialog with its own cards, say) takes over while it is mounted and
 * hands back when it goes. */
const HOVER = {
    layers: [],        // mounted layer controllers, innermost last
    phase: 'closed',   // 'closed' | 'open' | 'closing' (exit fade playing)
    anchor: null,      // controller of the anchor whose card is up or fading
    closeTimer: null,  // pending grace-period close
    warmUntil: 0,      // Date.now() threshold under which opens are "warm"
};

function currentLayer() {
    return HOVER.layers[HOVER.layers.length - 1] || null;
}

function notify() {
    const layer = currentLayer();
    if (layer) layer.update();
}

function isWarm() { return Date.now() < HOVER.warmUntil; }
function markWarm() { HOVER.warmUntil = Date.now() + WARM_MS; }

function cancelClose() {
    if (HOVER.closeTimer) {
        clearTimeout(HOVER.closeTimer);
        HOVER.closeTimer = null;
    }
}

/* Give the pointer CLOSE_DELAY_MS to reach the card / come back to the
 * name. Armed once: re-arming on every pointer move would let a pointer
 * wandering outside postpone the close forever. */
function scheduleClose(warm) {
    if (HOVER.phase !== 'open' || HOVER.closeTimer) return;
    HOVER.closeTimer = setTimeout(() => {
        HOVER.closeTimer = null;
        closeCard(warm);
    }, CLOSE_DELAY_MS);
}

let warnedNoLayer = false;

/* Show the card for this anchor. A card already up for another anchor is
 * simply re-pointed — the layer swaps the content and repositions, so the
 * page never shows two cards and the swap is instant. */
function showCard(anchor) {
    cancelClose();
    if (!currentLayer()) {
        if (!warnedNoLayer) {
            warnedNoLayer = true;
            console.warn('[ProfileHoverCard] no <ProfileHoverCardLayer /> is mounted on this page — author hover cards are disabled here.');
        }
        return;
    }
    if (!anchor.el || !anchor.el.isConnected) return;
    HOVER.anchor = anchor;
    HOVER.phase = 'open';
    notify();
}

/* Start the exit fade. A pointer-driven close (`warm`) lets the next name
 * open near-instantly; Escape / scroll / pointerdown close cold. */
function closeCard(warm) {
    cancelClose();
    if (HOVER.phase !== 'open') return;
    if (warm) markWarm();
    HOVER.phase = 'closing';
    notify();
}

/* Drop the card with no fade — the anchor is gone, the page is going, the
 * tab is hidden: nothing to animate against. */
function closeCardNow() {
    cancelClose();
    if (HOVER.phase === 'closed') return;
    HOVER.phase = 'closed';
    HOVER.anchor = null;
    notify();
}

/* Exit fade finished → the layer renders nothing again. */
function cardExited() {
    if (HOVER.phase !== 'closing') return;
    HOVER.phase = 'closed';
    HOVER.anchor = null;
    notify();
}

/* Pointer onto the card: keep it (and rescue it mid-fade). */
function holdCard() {
    cancelClose();
    if (HOVER.phase === 'closing' && HOVER.anchor) showCard(HOVER.anchor);
}

/* Pointer off the card. */
function releaseCard() {
    markWarm();
    scheduleClose(true);
}

function applyRef(ref, value) {
    if (!ref) return;
    if (typeof ref === 'function') ref(value);
    else if (typeof ref === 'object') ref.current = value;
}

/* Programmatic dismissal for hosts that know a context switch is coming
 * (opening a dialog from a keyboard shortcut, say). The layer already
 * closes on every pointer, keyboard, scroll and route signal by itself. */
export function dismissProfileHoverCard() {
    closeCard(false);
}

/* ── Anchor controller ────────────────────────────────────────────────────
 * Created once per <ProfileHoverAnchor> instance. Its handlers never change
 * identity — they read the latest props through `latest` — so the cloned
 * name element's props are stable and its diff is a no-op. */
let anchorSeq = 0;

function createAnchorController(latest) {
    const timers = { open: null, prefetch: null };
    const clear = (k) => { if (timers[k]) { clearTimeout(timers[k]); timers[k] = null; } };

    const c = {
        id: ++anchorSeq,
        el: null,
        latest,
        /* Ref on the name element; forwards to the element's own ref if the
         * caller had one. */
        setRef(node) {
            c.el = node;
            applyRef(latest.current.childRef, node);
        },
        /* Pointer onto the name. Hover is a mouse concept — touch keeps its
         * tap-to-navigate behavior. */
        enter(e) {
            const L = latest.current;
            if (L.childEnter) L.childEnter(e);
            if (e && e.pointerType && e.pointerType !== 'mouse') return;
            if (HOVER.anchor === c) {
                cancelClose();                                    // back from the card
                if (HOVER.phase === 'closing') showCard(c);       // caught it mid-fade
                return;
            }
            const name = (L.author && L.author.username) || '';
            if (!name) return;
            clear('prefetch');
            timers.prefetch = setTimeout(() => {
                timers.prefetch = null;
                const now = latest.current;
                getCachedBundle(now.api, name);
                getCachedActiveAccount(now.api);
            }, PREFETCH_DELAY_MS);
            clear('open');
            // Another card up (or fading) or one just closed → swap fast.
            const delay = (HOVER.phase !== 'closed' || isWarm()) ? OPEN_DELAY_WARM_MS : OPEN_DELAY_MS;
            timers.open = setTimeout(() => { timers.open = null; showCard(c); }, delay);
        },
        /* Pointer off the name: cancel a pending open, or give the pointer
         * CLOSE_DELAY_MS to reach the card. Marked warm here, at leave time,
         * because the next name is usually reached inside that grace period. */
        leave(e) {
            const L = latest.current;
            if (L.childLeave) L.childLeave(e);
            clear('open');
            clear('prefetch');
            if (HOVER.anchor !== c || HOVER.phase !== 'open') return;
            markWarm();
            scheduleClose(true);
        },
        /* A recycled row re-pointed this anchor at another author. */
        reset() {
            clear('open');
            clear('prefetch');
            if (HOVER.anchor === c) closeCardNow();
        },
        /* Unmount: timers off, our card (if it is ours) gone. */
        dispose() {
            c.reset();
            c.el = null;
        },
    };
    return c;
}

/* ── Anchor: the per-card wrapper ──────────────────────────────────────────
 * Renders no element of its own: the name element it wraps is cloned with
 * two pointer listeners and a ref (its own handlers/ref, if any, still
 * run). Only when the child is not a plain DOM element does it fall back
 * to an inline <span> of its own. */
export function ProfileHoverAnchor(props) {
    const { api, author, onOpenProfile, children } = props;
    const username = (author && author.username) || '';

    const latest = useRef(null);
    if (!latest.current) latest.current = {};
    latest.current.api = api;
    latest.current.author = author;
    latest.current.onOpenProfile = onOpenProfile;

    const ctlRef = useRef(null);
    if (!ctlRef.current) ctlRef.current = createAnchorController(latest);
    const c = ctlRef.current;

    // New author under the same anchor (recycled rows) → drop the card.
    const prevUser = useRef(username);
    useEffect(() => {
        if (prevUser.current === username) return;
        prevUser.current = username;
        c.reset();
    }, [username, c]);

    useEffect(() => () => c.dispose(), [c]);

    const child = isValidElement(children) && typeof children.type === 'string' ? children : null;
    const L = latest.current;
    L.childRef = child ? (child.ref || null) : null;
    L.childEnter = child ? (child.props.onPointerEnter || null) : null;
    L.childLeave = child ? (child.props.onPointerLeave || null) : null;

    if (child) {
        return cloneElement(child, {
            ref: c.setRef,
            onPointerEnter: c.enter,
            onPointerLeave: c.leave,
        });
    }
    return (
        <span
            ref={c.setRef}
            style={ANCHOR_STYLE}
            onPointerEnter={c.enter}
            onPointerLeave={c.leave}
        >
            {children}
        </span>
    );
}

/* ── Layer: the one floating element of the page ───────────────────────────
 * Mounted once per page. Nothing is rendered while no name is hovered; the
 * MUI <Popper> (portalled to document.body, so the card is never clipped by
 * a card's overflow:hidden nor caught in its contain / transform / filter
 * transitions) exists only from the moment a card shows until its exit
 * fade ends. memo'd with no props: the page's own re-renders never reach
 * the card, only the registry's notify() does. */
export const ProfileHoverCardLayer = memo(function ProfileHoverCardLayer() {
    const [, bump] = useReducer((x) => x + 1, 0);
    const mountedRef = useRef(false);
    const popperElRef = useRef(null);
    const cardElRef = useRef(null);

    useLayoutEffect(() => {
        mountedRef.current = true;
        const ctl = { update() { if (mountedRef.current) bump(); } };
        HOVER.layers.push(ctl);
        return () => {
            mountedRef.current = false;
            const i = HOVER.layers.lastIndexOf(ctl);
            if (i >= 0) HOVER.layers.splice(i, 1);
            // Whatever this layer was showing leaves with it.
            cancelClose();
            HOVER.phase = 'closed';
            HOVER.anchor = null;
            notify();
            // The popper node lives in document.body through the Popper's
            // portal. Its own teardown removes it; should that ever be
            // skipped while the page tree is torn down around it, the node
            // must still not survive the page — check once the unmount pass
            // has fully completed.
            const el = popperElRef.current;
            if (el) {
                setTimeout(() => {
                    if (el.isConnected && el.parentNode) el.parentNode.removeChild(el);
                }, 0);
            }
        };
    }, []);

    const phase = HOVER.phase;
    const anchor = HOVER.anchor;

    // Everything that takes an on-screen card down. Attached only while a
    // card is up or fading, detached the moment it is gone.
    useEffect(() => {
        if (phase === 'closed') return undefined;
        const onScroll = () => closeCard(false);
        const onKey = (e) => { if (e.key === 'Escape') closeCard(false); };
        // Any press outside the card — a wallet button, a dialog's close
        // button, the name itself (its click navigates), the backdrop of a
        // modal that opened over the page.
        const onDown = (e) => {
            const card = cardElRef.current;
            if (card && e.target instanceof Node && card.contains(e.target)) return;
            closeCard(false);
        };
        // The pointer's real whereabouts, independent of boundary events:
        // resting on anything but the name or the card → grace close. Also
        // notices an anchor that left the document under an open card.
        const onMove = (e) => {
            if (HOVER.phase !== 'open' || !HOVER.anchor) return;
            const a = HOVER.anchor.el;
            if (!a || !a.isConnected) { closeCardNow(); return; }
            const target = e.target;
            const card = cardElRef.current;
            const inside = target instanceof Node &&
                ((card && card.contains(target)) || a.contains(target));
            if (inside) cancelClose(); else scheduleClose(true);
        };
        const onVisibility = () => { if (document.visibilityState === 'hidden') closeCardNow(); };
        const onBlur = () => closeCardNow();
        // Any route change: page swap, /@name/wallet round trip, a post
        // overlay opening, a tab switch — the card's context is gone.
        const unlisten = HISTORY.listen(() => closeCard(false));

        window.addEventListener('scroll', onScroll, { capture: true, passive: true });
        window.addEventListener('keydown', onKey);
        document.addEventListener('pointerdown', onDown, true);
        document.addEventListener('pointermove', onMove, { capture: true, passive: true });
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('blur', onBlur);
        return () => {
            window.removeEventListener('scroll', onScroll, { capture: true });
            window.removeEventListener('keydown', onKey);
            document.removeEventListener('pointerdown', onDown, true);
            document.removeEventListener('pointermove', onMove, { capture: true });
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('blur', onBlur);
            if (typeof unlisten === 'function') unlisten();
        };
    }, [phase]);

    const setCardEl = useCallback((node) => { cardElRef.current = node; }, []);

    /* A click inside the card that navigates: dismiss, then let the
     * anchor's own onOpenProfile route it (the cards' openAuthor →
     * HISTORY.push('/@name…')). */
    const openProfile = useCallback((targetPath) => {
        const a = HOVER.anchor;
        closeCard(false);
        const fn = a && a.latest.current.onOpenProfile;
        if (typeof fn === 'function') fn(targetPath);
    }, []);

    if (phase === 'closed' || !anchor || !anchor.el) return null;

    const { api, author } = anchor.latest.current;
    const username = (author && author.username) || '';

    return (
        <Popper
            ref={popperElRef}
            open={phase === 'open'}
            anchorEl={anchor.el}
            placement="bottom"
            transition
            style={POPPER_STYLE}
            modifiers={POPPER_MODIFIERS}
        >
            {({ TransitionProps }) => (
                <Fade
                    {...TransitionProps}
                    timeout={FADE_TIMEOUT}
                    onExited={(node) => {
                        // Popper's own handler first (it stops rendering),
                        // then ours (the layer renders nothing again).
                        if (TransitionProps.onExited) TransitionProps.onExited(node);
                        cardExited();
                    }}
                >
                    <div style={PASS_THROUGH_STYLE}>
                        <ProfileHoverCardBase
                            key={anchor.id + ':' + username}
                            api={api}
                            author={author}
                            onOpenProfile={openProfile}
                            rootRef={setCardEl}
                            onHold={holdCard}
                            onRelease={releaseCard}
                        />
                    </div>
                </Fade>
            )}
        </Popper>
    );
});

export default ProfileHoverAnchor;
