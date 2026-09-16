import * as React from 'preact/compat';
import { h } from 'preact';
import { forwardRef } from 'preact/compat';
import { useCallback, useMemo, useRef, useState } from 'preact/hooks';
import withStyles from '@material-ui/core/styles/withStyles';
import Avatar from '@material-ui/core/Avatar';
import Person from '@material-ui/icons/Person';

// ── FadeAvatar ───────────────────────────────────────────────────────
// Drop-in for @material-ui/core/Avatar whose content always fades in
// instead of popping: the picture once its bytes are actually decoded,
// the blank silhouette as soon as it is on screen (no `src`, or the
// picture failed and MUI swapped to its fallback).
//
// Why the reveal is gated in JS rather than a mount-time CSS animation:
// an <img> sits in the DOM long before its pixels do (lazy loading, slow
// image hosts), so an animation started at mount would finish on an
// empty box and the picture would still pop in afterwards. The root is
// therefore held at opacity 0 until one of two signals fires:
//   • the <img>'s own `load` event, wired in through imgProps, or
//   • the fallback node mounting — seen through a callback ref on the
//     silhouette we hand MUI as `children`, which is exactly what it
//     renders when it has no usable picture. MUI decides the swap from
//     its own preloader, so an onError on the (lazy) <img> would not be
//     a reliable signal; the mount of the fallback is.
// Fading the ROOT rather than the child means the grey default
// background of the fallback fades in together with the icon instead of
// appearing first as a bare square.
//
// Why the styled inner component is keyed on `src`:
// virtualized cells are recycled — a live card is re-pointed at another
// post instead of being remounted. Keying remounts the avatar subtree on
// a src swap, which (a) resets the reveal state for free, (b) discards
// the old <img> so the previous author's bitmap never lingers while the
// new one loads, and (c) guarantees the CSS animation runs again even
// when the new picture comes straight from cache — a class toggled off
// and back on inside one frame would NOT restart it on a reused element.
// Same author on consecutive posts → same src → no remount, no re-fade.

const styles = {
    '@keyframes fadeAvatarIn': {
        from: { opacity: 0 },
        to: { opacity: 1 },
    },
    root: {
        opacity: 0,
        '&.revealed': {
            animation: '$fadeAvatarIn 240ms cubic-bezier(0.4, 0, 0.2, 1) both',
        },
    },
    // Same box MUI gives its built-in silhouette (classes.fallback).
    fallback: {
        width: '75%',
        height: '75%',
    },
    '@media (prefers-reduced-motion: reduce)': {
        root: {
            '&.revealed': { animation: 'none', opacity: 1 },
        },
    },
};

const FadeAvatarInner = forwardRef(function FadeAvatarInner(
    { classes, className, src, imgProps, ...rest },
    ref,
) {
    const [revealed, setRevealed] = useState(false);

    // Latest imgProps for the stable load handler below, so a caller's own
    // onLoad still runs without re-binding the listener on every render.
    const imgPropsRef = useRef(imgProps);
    imgPropsRef.current = imgProps;

    // Picture decoded → reveal.
    const handleLoad = useCallback((e) => {
        setRevealed(true);
        const fn = imgPropsRef.current && imgPropsRef.current.onLoad;
        if (fn) fn(e);
    }, []);

    // MUI mounted the silhouette (no src, or the picture failed) → reveal.
    const fallbackRef = useCallback((node) => {
        if (node) setRevealed(true);
    }, []);

    const mergedImgProps = useMemo(
        () => ({ decoding: 'async', loading: 'lazy', ...imgProps, onLoad: handleLoad }),
        [imgProps, handleLoad],
    );

    return (
        <Avatar
            ref={ref}
            {...rest}
            src={src}
            className={classes.root + (revealed ? ' revealed' : '') + (className ? ' ' + className : '')}
            imgProps={mergedImgProps}
        >
            <Person ref={fallbackRef} className={classes.fallback} />
        </Avatar>
    );
});

const StyledFadeAvatarInner = withStyles(styles, { name: 'FadeAvatar' })(FadeAvatarInner);

const FadeAvatar = forwardRef(function FadeAvatar(props, ref) {
    // '' / null / undefined all mean "no picture" to MUI; normalise so the
    // key (and MUI's own hasImg check) see one value.
    const src = props.src || undefined;
    return <StyledFadeAvatarInner key={src || ''} {...props} src={src} ref={ref} />;
});

export default FadeAvatar;
