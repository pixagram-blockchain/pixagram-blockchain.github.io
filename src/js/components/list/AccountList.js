import * as React from "preact/compat";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "preact/compat";
import makeStyles from "@material-ui/core/styles/makeStyles";
import Checkbox from "@material-ui/core/Checkbox";
import CircularProgress from "@material-ui/core/CircularProgress";

import { useScrollParentWindowing, useEndReached } from "../../hooks/useScrollParentWindowing";
import { AccountImageStore, accountKey } from "./accountImageStore";

// ── AccountList — the account lists' shared rows, windowing and hydration ─
//
// VotingListModal, FollowListModal and MembersListDialog list accounts the
// same way: avatar, @name, one line under it, sometimes a follow checkbox.
// Each carried its own copy of the row styles and its own rendering, and
// every visible row was a stack of MUI components — ListItem, ListItemAvatar,
// Avatar (which builds an Image() per src to detect load errors),
// ListItemText (two Typographies), a Tooltip per row in the voters list —
// rebuilt for every row on every render, with fresh inline closures and
// style objects defeating any memoisation.
//
// Here instead:
//
//   · <AccountList> windows the rows against the dialog's own scroll area
//     (useScrollParentWindowing: one scrollbar, no boxed 480px list) and
//     renders only the rows in view plus an overscan band. Rows sit in
//     fixed-height slots absolutely positioned in a container of the list's
//     full height, so a window move adds / removes slots and moves nothing
//     else; each slot is layout/paint/style/size-contained.
//   · Rows are memoised components with primitive props: a scroll tick, a
//     page landing or an avatar arriving re-renders only the rows whose own
//     data changed. Plain elements, one shared stylesheet, no per-row
//     closures: clicks are DELEGATED — one listener on the list reads
//     data-account from the row that was hit.
//   · Avatars hydrate on demand through an AccountImageStore: the names in
//     the window plus a look-ahead block, block-aligned (a slow scroll asks
//     once per block, not once per row), debounced (a fling asks where it
//     stops), deduped — see accountImageStore.js.
//   · The avatar is a bare <img> (lazy, async-decoded) over the account's
//     initial: a broken image simply hides and the initial shows.

export const ROW_H = 64;
// Hydration look-ahead: rows beyond the rendered window on each side, and the
// block size requests are aligned to.
const HYDRATE_AHEAD = 12;
const HYDRATE_BLOCK = 25;

const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

export const useAccountListStyles = makeStyles(() => ({
    // The positioned container: full virtual height, rows absolutely placed.
    list: {
        position: "relative",
        width: "100%",
        contain: "layout style",
    },
    slot: {
        position: "absolute",
        left: 0,
        right: 0,
        height: ROW_H,
        contain: "strict",
    },
    row: {
        display: "flex",
        alignItems: "center",
        height: "100%",
        borderRadius: 16,
        backgroundColor: "transparent",
        transition: `background-color 225ms ${EASE} 5ms`,
        "@media (hover: hover)": {
            "&:hover": { backgroundColor: "#ffffff14" },
        },
    },
    // The whole avatar + text area is one button: it opens the account
    // (delegated, see AccountList) and is keyboard reachable.
    rowMain: {
        flex: "1 1 auto",
        minWidth: 0,
        height: "100%",
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "0 16px",
        margin: 0,
        border: 0,
        borderRadius: 16,
        background: "none",
        color: "inherit",
        font: "inherit",
        textAlign: "left",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        outline: "none",
        "&:active": { backgroundColor: "#ffffff0d" },
        "&:focus-visible": { boxShadow: "inset 0 0 0 2px #ffffff59" },
    },
    avatar: {
        position: "relative",
        flex: "0 0 auto",
        width: 40,
        height: 40,
        borderRadius: 14,
        overflow: "hidden",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#2a2a2a",
        color: "#8a8a8a",
        fontFamily: '"Industry Book", "Normative Pro"',
        fontSize: 18,
        lineHeight: 1,
        textTransform: "uppercase",
        "& > img": {
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            // alt="" already hides alt text; this keeps a broken-image icon
            // from flashing before onError hides the element.
            color: "transparent",
        },
    },
    rowText: {
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
    },
    rowTitle: {
        display: "flex",
        alignItems: "center",
        minWidth: 0,
        fontSize: "1rem",
        lineHeight: 1.5,
    },
    name: {
        fontWeight: "bold",
        fontFamily: '"Industry Book", "Normative Pro"',
        color: "#fff",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
    badge: {
        flex: "0 0 auto",
        display: "inline-flex",
        alignItems: "center",
        height: 20,
        marginLeft: 8,
        padding: "0 8px",
        borderRadius: 10,
        backgroundColor: "#333",
        color: "#fff",
        fontSize: "0.7rem",
        fontFamily: '"Industry Book", "Normative Pro"',
        lineHeight: 1,
    },
    rowSecondary: {
        display: "block",
        fontFamily: '"Industry Book", "Normative Pro"',
        fontSize: "0.875rem",
        lineHeight: 1.43,
        color: "rgba(255, 255, 255, 0.7)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
    rowAction: {
        flex: "0 0 auto",
        marginRight: 4,
    },
    empty: {
        padding: "12px 16px",
        fontFamily: '"Industry Book", "Normative Pro"',
        fontSize: "0.875rem",
        lineHeight: 1.43,
        color: "rgba(255, 255, 255, 0.7)",
    },
    spinnerRow: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: ROW_H,
    },
}), { name: "PixaAccountList" });

// ── Avatar ───────────────────────────────────────────────────────────────

const hideBrokenImage = (e) => {
    const img = e && e.currentTarget;
    if (img) img.style.display = "none";
};

const initialOf = (name) => {
    const s = String(name || "").replace(/^@/, "");
    return s ? s.charAt(0) : "?";
};

/**
 * The account's initial, covered by its avatar once the URL is known and the
 * image decodes. Keyed by URL so a hidden broken image never hides the next
 * one. `pixelated`: avatars are pixel art (global rule in theme/overrides).
 */
export const AccountAvatar = memo(function AccountAvatar({ className, username, image }) {
    return (
        <span className={className} aria-hidden="true">
            {initialOf(username)}
            {image ? (
                <img
                    key={image}
                    className="pixelated"
                    src={image}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    onError={hideBrokenImage}
                />
            ) : null}
        </span>
    );
});

// ── Row layout (composed by the memoised rows) ───────────────────────────

/**
 * avatar · @name [badge] / secondary line · [action]. `data-account` on the
 * main button is what AccountList's delegated click handler reads.
 */
export function AccountRowLayout({ classes, username, image, badge, secondary, secondaryTitle, action }) {
    return (
        <div className={classes.row}>
            <button type="button" className={classes.rowMain} data-account={username}>
                <AccountAvatar className={classes.avatar} username={username} image={image} />
                <span className={classes.rowText}>
                    <span className={classes.rowTitle}>
                        <span className={classes.name}>{"@" + username}</span>
                        {badge ? <span className={classes.badge}>{badge}</span> : null}
                    </span>
                    {secondary != null && secondary !== "" ? (
                        <span className={classes.rowSecondary} title={secondaryTitle || undefined}>{secondary}</span>
                    ) : null}
                </span>
            </button>
            {action}
        </div>
    );
}

/**
 * Row with an optional follow checkbox (followers / following / members).
 * Primitive props only, so memo holds across scroll ticks and page loads.
 * The checkbox carries its account in data-follow; `onToggleFollow` is the
 * list's ONE shared change handler.
 */
export const FollowableAccountRow = memo(function FollowableAccountRow({
    classes, username, image, badge, canFollow, following, onToggleFollow,
}) {
    const action = canFollow ? (
        <Checkbox
            className={classes.rowAction}
            size="medium"
            color="primary"
            edge="end"
            checked={!!following}
            onChange={onToggleFollow}
            inputProps={{ "data-follow": username, "aria-label": "@" + username }}
        />
    ) : null;
    return (
        <AccountRowLayout classes={classes} username={username} image={image} badge={badge} action={action} />
    );
});

/** Reads the account out of a follow checkbox's change event. */
export const followTargetOf = (e) => {
    const el = e && e.target;
    return (el && typeof el.getAttribute === "function" && el.getAttribute("data-follow")) || "";
};

// ── Image store hook ─────────────────────────────────────────────────────

/**
 * The store a list hydrates through: the one passed in (shared by sibling
 * lists, owned by their dialog) or, failing that, one owned by this hook
 * for the component's lifetime. Re-renders the caller when images land.
 */
export function useAccountImageStore(api, external, seed) {
    const own = useRef(null);
    let store = external || null;
    if (!store) {
        if (!own.current || own.current.api !== api) {
            if (own.current) own.current.dispose();
            own.current = new AccountImageStore(api, seed);
        }
        store = own.current;
    }
    const [, setVersion] = useState(0);
    useEffect(() => store.subscribe(setVersion), [store]);
    useEffect(() => () => { if (own.current) { own.current.dispose(); own.current = null; } }, []);
    useEffect(() => { if (seed) store.seed(seed); }, [store, seed]);
    return store;
}

// ── AccountList ──────────────────────────────────────────────────────────

const EMPTY = [];
const defaultName = (item) => (item && (item.username || item.name || item.voter)) || "";

/**
 * Windowed, hydrated account list.
 *
 *   items          the rows' data (any shape)
 *   getName        item → account name (key + avatar lookup); stable ref
 *   renderRow      (item, index, classes, image) → a MEMOISED row element;
 *                  stable ref (useCallback / class field) — when it changes,
 *                  the visible rows are re-offered (memo decides)
 *   api            for avatar hydration (or pass `imageStore`)
 *   imageStore     an AccountImageStore shared with sibling lists (optional)
 *   seedImages     { name: url } known up front (optional)
 *   active         hydrate only while true (e.g. the visible tab)
 *   hasMore / loading / onEndReached   paging (onEndReached near the end)
 *   emptyText      shown when the list is empty and nothing more is coming
 *   onOpenAccount  (name) → void, for a click on a row's avatar / name
 *   slot           this list's request slot in a shared store
 */
export const AccountList = memo(function AccountList({
    items,
    getName = defaultName,
    renderRow,
    api,
    imageStore,
    seedImages,
    active = true,
    hasMore = false,
    loading = false,
    onEndReached,
    emptyText = "",
    onOpenAccount,
    slot = "default",
    overscan = 8,
}) {
    const classes = useAccountListStyles();
    const store = useAccountImageStore(api, imageStore, seedImages);
    const list = Array.isArray(items) ? items : EMPTY;
    const count = list.length;

    const windowed = useScrollParentWindowing(count, ROW_H, overscan);
    // The window is measured in a layout effect, so on the render where the
    // list SHRINKS (a search narrowing 2 000 members to 3) it still spans
    // the previous count. Clamped here, never read past the end.
    const end = Math.min(windowed.end, count);
    const start = Math.min(windowed.start, end);
    const listRef = windowed.listRef;
    useEndReached({
        end,
        count,
        enabled: typeof onEndReached === "function" && hasMore && !loading,
        onEndReached,
    });

    // Hydrate the window ± HYDRATE_AHEAD, widened to whole blocks.
    useEffect(() => {
        if (!active || count === 0) return;
        const from = Math.max(0, Math.floor((start - HYDRATE_AHEAD) / HYDRATE_BLOCK) * HYDRATE_BLOCK);
        const to = Math.min(count, Math.ceil((end + HYDRATE_AHEAD) / HYDRATE_BLOCK) * HYDRATE_BLOCK);
        const names = [];
        for (let i = from; i < to; i++) {
            const n = getName(list[i]);
            if (n) names.push(n);
        }
        store.request(names, slot);
    }, [active, store, list, count, start, end, getName, slot]);

    // One delegated listener for every row: a click on a row's main button
    // (or anything inside it) opens that account.
    const openRef = useRef(onOpenAccount);
    openRef.current = onOpenAccount;
    const onClick = useCallback((e) => {
        const open = openRef.current;
        if (typeof open !== "function") return;
        const t = e.target;
        const hit = t && typeof t.closest === "function" ? t.closest("[data-account]") : null;
        if (hit && e.currentTarget.contains(hit)) open(hit.getAttribute("data-account"));
    }, []);

    const height = count * ROW_H;
    const sizeStyle = useMemo(() => ({ height }), [height]);

    let body;
    if (count === 0) {
        body = hasMore || loading
            ? <div className={classes.spinnerRow}><CircularProgress size={24} color="secondary" /></div>
            : (emptyText ? <div className={classes.empty}>{emptyText}</div> : null);
    } else {
        const slots = [];
        for (let i = start; i < end; i++) {
            const item = list[i];
            if (item == null) continue;
            const name = getName(item);
            slots.push(
                <div key={name || "#" + i} className={classes.slot} style={"top:" + (i * ROW_H) + "px"} role="listitem">
                    {renderRow(item, i, classes, store.get(name))}
                </div>
            );
        }
        body = (
            <div className={classes.list} style={sizeStyle} role="list">
                {slots}
            </div>
        );
    }

    return (
        <div ref={listRef} onClick={onClick}>
            {body}
            {count > 0 && hasMore && loading
                ? <div className={classes.spinnerRow}><CircularProgress size={24} color="secondary" /></div>
                : null}
        </div>
    );
});

export { accountKey, AccountImageStore };

export default AccountList;
