import * as React from 'preact/compat';
import { h } from 'preact';
import { memo } from 'preact/compat';
import { useMemo } from 'preact/hooks';
import Fab from '@material-ui/core/Fab';
import PhotoCameraRounded from '@material-ui/icons/PhotoCameraRounded';

// ── The "create" FAB of the feed pages ───────────────────────────────
// Feed and FeedPersonal used to inline this with a fresh `style` object on
// every render — and both pages re-render on every scroll tick of their
// grid hook — so the Fab subtree re-rendered every tick for a translateY
// that flips a few times per session. It takes primitives and stable
// references only and builds its style object inside, so a tick on which
// `hidden` didn't flip costs it nothing.
//
// `label` is resolved by the page (which re-renders on language change via
// useLanguage) rather than translated in here, so the memo can't leave the
// previous locale on screen.
const ICON_STYLE = { marginRight: 12 };

const CreateFab = memo(function CreateFab({ className, hidden, label, onClick }) {
    const style = useMemo(() => ({
        transform: hidden
            ? 'translateY(calc(96px + env(safe-area-inset-bottom, 0px)))'
            : 'translateY(-8px)',
    }), [hidden]);
    return (
        <div onClick={onClick} className={className} style={style}>
            <Fab variant="extended" size="large">
                <PhotoCameraRounded style={ICON_STYLE} />
                <span>{label}</span>
            </Fab>
        </div>
    );
});

export default CreateFab;
