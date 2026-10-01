import * as React from 'preact/compat';
import { h } from 'preact';
import { forwardRef } from 'preact/compat';
import Avatar from '@material-ui/core/Avatar';

// ── FadeAvatar ───────────────────────────────────────────────────────
// Drop-in for @material-ui/core/Avatar. It no longer fades: the picture
// paints as soon as the browser has it, and with no `src`, or once the
// picture has failed, MUI's own silhouette (the same 75% box as before)
// shows at once. The name is a leftover, kept so the card imports
// (PaperCard, PaperCardBlog, PaperCardReply) stay unchanged. The fading
// version is in the git history.
//
// The opacity hold went with the animation. It only existed to give the
// fade a starting point; on its own it would still hide every avatar until
// its `load` event, which arrives as a separate task, so even a cached
// picture could sit blank for a frame. A virtualized feed mounts avatars on
// every recycle and every scroll-back, so there is no state, stylesheet or
// load listener left here.
//
// Why the Avatar is still keyed on `src`:
// virtualized cells are recycled, so a live card is re-pointed at another
// post instead of being remounted. Swapping the src of a live <img> keeps
// the old picture on screen until the new one has loaded, so the PREVIOUS
// author would sit next to the new post for that whole time. Keying
// mounts a fresh <img> instead, which stays empty until the right picture
// arrives. Same author on consecutive posts → same src → no remount.

// Shared defaults for the common case (no caller imgProps), so a render
// doesn't allocate a fresh object. Caller imgProps still win.
const DEFAULT_IMG_PROPS = { decoding: 'async', loading: 'lazy' };

const FadeAvatar = forwardRef(function FadeAvatar({ src, imgProps, ...rest }, ref) {
    // '' / null / undefined all mean "no picture" to MUI; normalise so the
    // key and MUI's own hasImg check see one value.
    const url = src || undefined;
    return (
        <Avatar
            key={url || ''}
            ref={ref}
            {...rest}
            src={url}
            imgProps={imgProps ? { ...DEFAULT_IMG_PROPS, ...imgProps } : DEFAULT_IMG_PROPS}
        />
    );
});

export default FadeAvatar;