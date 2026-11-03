import * as React from "preact/compat";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "preact/compat";

import withStyles from "@material-ui/core/styles/withStyles";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Button from "@material-ui/core/Button";
import Tab from "@material-ui/core/Tab";
import Tabs from "@material-ui/core/Tabs";
import SwipeableViews from "react-swipeable-views";

import { HISTORY } from "../utils/constants";
import timeAgo from "../utils/TimeAgo";
import { t, useLanguage } from "../utils/text";
import { usePrices } from "../hooks/usePrices";
import {
    voteSign, votePercentBp, formatPxs,
    valueOfRshares, estimateVoteValue, fiatOf,
    getRewardSnapshot, getRewardSnapshotSync,
    getVoterAccount, getVoterAccountSync,
} from "../utils/voteValue";
import { AccountList, AccountRowLayout, AccountImageStore } from "./list/AccountList";

// ── VotingListModal — who voted, and what each vote is worth ──────────────
//
// Rebuilt on the shared account list (components/list/AccountList). What the
// old class did on every render, and what replaces it:
//
//   · Props were mirrored into state (open, votes, positive, locales, even
//     classes) and re-synced in componentWillReceiveProps with setState +
//     forceUpdate (two renders per prop change). → Props are read directly.
//   · Both tabs' votes were valued, sorted and summed on EVERY render (tab
//     switches, profile batches, snapshot…). → One memo, recomputed only when
//     the votes, the reward snapshot, the prices or a pending voter's
//     account change.
//   · Every voter's account was fetched up front in ONE raw getAccounts()
//     call (1 200 votes → 1 200 accounts to paint ~10 rows). → Avatars
//     hydrate for the rows on screen only, batched and deduped app-wide
//     (AccountImageStore over account-cache); the page's pre-fetched
//     voter_profiles seed it.
//   · A fixed 480px react-virtualized box (a second scrollbar inside the
//     dialog, cut off on short phones), a new rowRenderer closure per render
//     (all rows re-rendered), MUI ListItem / Avatar / ListItemText and a
//     Tooltip per row, toLocaleDateString per row per render. → Rows window
//     against the dialog's own scroll area; memoised rows of plain elements;
//     the date is a native title from a cached Intl.DateTimeFormat.
//   · The tab-switch scroll reset queried `document` for the FIRST swipeable
//     container on the page (any dialog's). → Scoped to this dialog.
//   · Clicking a voter navigated under the still-open dialog. → It closes,
//     like the followers and members lists.
//
// Props are unchanged: { open, onClose, positive, votes, voterProfiles,
// api, locales }.

const SLIDE_STYLE = { height: "100%", overflowY: "auto", overflowX: "hidden" };
const FILL_STYLE = { height: "100%" };
const SPRING = { tension: 450, friction: 60, duration: "120ms", easeFunction: "cubic-bezier(0.280, 0.840, 0.420, 1)", delay: "5ms" };
const EMPTY_OBJ = Object.freeze({});
const EMPTY_LIST = Object.freeze([]);

const styles = theme => ({
    dialog: {
        // A definite paper height gives the slides a bounded height, so each
        // slide is the single scroll area its list windows against.
        "& .MuiDialog-paperScrollPaper": {
            height: "calc(100% - 64px)",
            maxHeight: 720,
            [theme.breakpoints.down("sm")]: {
                margin: 12,
                width: "calc(100% - 24px)",
                maxWidth: "none",
                height: "calc(100% - 24px)",
                maxHeight: "none",
            },
        },
    },
    swipeRoot: {
        position: "relative",
        flex: "1 1 auto",
        minHeight: 0,
    },
    cardTabs: {
        backgroundColor: "#171717",
        "& .MuiTab-root": {
            minWidth: "72px !important"
        },
        "& .MuiTab-textColorPrimary.Mui-selected": {
            backgroundColor: "transparent",
        },
        "& .MuiTab-textColorPrimary.Mui-selected .MuiTab-wrapper": {
            color: "#171717 !important"
        },
        "& .MuiTab-fullWidth": {
            backgroundColor: "transparent",
            color: "#989898",
            transition: "all 225ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
            borderRadius: "21px"
        },
        "& .MuiTab-fullWidth:hover": {
            backgroundColor: "rgba(255,255,255,0.06)"
        },
        "& span.MuiTabs-indicator": {
            zIndex: "-1",
            height: "48px",
            backgroundColor: "#c7c7c7",
            borderRadius: "21px",
            transform: "scale3d(0.875, 0.75, 1)"
        },
        flex: "0 0 auto",
        margin: "16px 16px 0px 16px",
        width: "calc(100% - 32px)",
        borderRadius: "21px",
        top: 0,
        left: 0,
        zIndex: 1,
        transition: "transform 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
    },
    dialogContent: {
        margin: "0px 0px 8px 0px",
        paddingTop: 0,
        // The slide around it scrolls; never a second scroller in here.
        overflowY: "visible",
    },
    // Per-tab total, right-aligned above the list; stays in view while the
    // list scrolls under it.
    tabTotal: {
        position: "sticky",
        top: 0,
        zIndex: 2,
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "baseline",
        gap: 8,
        padding: "8px 16px 4px 16px",
        backgroundColor: "#000",
        color: "#9a9a9a",
        fontFamily: '"Geist Mono", monospace',
        fontVariantNumeric: "tabular-nums",
        fontSize: 12,
        lineHeight: "16px",
        minHeight: 20,
        "& b": {
            color: "#fff",
            fontWeight: 500,
        },
    },
    // What the vote is worth: PXS from its rshares through the reward fund,
    // then the user's display currency. Greyscale like the rest of the UI —
    // an estimate (vote still waiting for the chain) is dimmer and prefixed ≈.
    voteValue: {
        color: "#fff",
        fontFamily: '"Geist Mono", monospace',
        fontVariantNumeric: "tabular-nums",
    },
    voteValueFiat: {
        color: "#9a9a9a",
        fontFamily: '"Geist Mono", monospace',
        fontVariantNumeric: "tabular-nums",
    },
    voteValueEstimate: {
        color: "#bdbdbd",
    },
    votePercent: { color: "#ccc" },
    voteTime: { color: "#fff" },
});

// ── Pure helpers ─────────────────────────────────────────────────────────

/** Translation with an English fallback while a locale chunk is loading. */
function tr(key, fallback) {
    const v = t(key);
    return !v || v === key || v === key.slice(key.lastIndexOf(".") + 1) ? fallback : v;
}

// One Intl.DateTimeFormat per locale for the rows' full-date title (was a
// toLocaleDateString per row per render).
const DATE_OPTS = { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric" };
const DATE_FORMATS = new Map();
function fullDate(ms, locales) {
    const key = String(locales || "");
    let f = DATE_FORMATS.get(key);
    if (!f) {
        try { f = new Intl.DateTimeFormat(locales || undefined, DATE_OPTS); }
        catch (e) { f = new Intl.DateTimeFormat(undefined, DATE_OPTS); }
        DATE_FORMATS.set(key, f);
    }
    return f.format(ms);
}

/**
 * What one vote is worth right now — the HIVE estimate_upvote recipe:
 * rshares / recent_claims × reward_balance gives PXA; PXA is then priced
 * through usePrices() (PXA anchored in USD, PXS derived from it), never
 * through the raw 1:1 bootstrap feed. Chain rows use their rshares; an
 * optimistic placeholder is estimated from the voter's vesting shares
 * and current mana. Returns { pxs, usd, estimate, ready }.
 */
function voteValue(vote, snap, prices, accounts, api) {
    const estimate = !!(vote && vote._optimistic);
    if (!vote || !snap || !snap.ok) return { pxs: 0, usd: 0, estimate, ready: false };
    if (estimate) {
        const acc = accounts[vote.voter] || getVoterAccountSync(api, vote.voter);
        if (!acc) return { pxs: 0, usd: 0, estimate: true, ready: false };
        const v = estimateVoteValue(acc, vote.weight, snap, prices);
        return { pxs: v.pxs, usd: v.usd, estimate: true, ready: true };
    }
    const v = valueOfRshares(vote.rshares, snap, prices);
    return { pxs: v.pxs, usd: v.usd, estimate: false, ready: true };
}

/**
 * Both tabs, valued, ranked and summed in one pass. A row is a flat record
 * of display-ready primitives, so a memoised row compares cheaply. Ranking:
 * a still-pending vote first (the user finds the vote they just cast at a
 * glance), then by what the vote is worth.
 */
function rankVotes(votes, snap, prices, accounts, api) {
    const up = [];
    const down = [];
    for (const vote of Array.isArray(votes) ? votes : EMPTY_LIST) {
        // Direction from rshares first (weight isn't reliably the percent);
        // zeroed rows — what hivemind keeps after an unvote — are not votes.
        const sign = vote ? voteSign(vote) : 0;
        if (!sign || !vote.voter) continue;
        const val = voteValue(vote, snap, prices, accounts, api);
        // Percent only when the row actually knows it (|weight| ≤ 10 000);
        // bridge rows omit it and condenser rows may carry a curation weight.
        const bp = votePercentBp(vote);
        let time = 0;
        if (vote.time) {
            const d = new Date(vote.time).getTime();
            if (Number.isFinite(d)) time = d;
        }
        const fiat = val.ready ? fiatOf(Math.abs(val.usd), prices) : null;
        const entry = {
            voter: vote.voter,
            optimistic: !!vote._optimistic,
            absPxs: Math.abs(val.pxs),
            absUsd: Math.abs(val.usd),
            ready: val.ready,
            estimate: val.estimate,
            pxsText: val.ready ? (val.estimate ? "≈ " : "") + formatPxs(Math.abs(val.pxs)) + " PXS" : "",
            fiatText: fiat ? fiat.amount.toFixed(2) + " " + fiat.currency : "",
            pctText: bp != null ? (Math.abs(bp) / 100).toFixed(0) + "%" : "",
            time,
        };
        (sign > 0 ? up : down).push(entry);
    }
    const byWorth = (a, b) => {
        if (a.optimistic !== b.optimistic) return a.optimistic ? -1 : 1;
        return b.absPxs - a.absPxs;
    };
    up.sort(byWorth);
    down.sort(byWorth);
    return { up, down, upTotal: totalOf(up, prices), downTotal: totalOf(down, prices) };
}

// Sum of what the listed votes are worth (PXS + display currency). "≈"
// while any row is still an estimate or the fund snapshot hasn't landed.
function totalOf(entries, prices) {
    if (!entries.length) return null;
    let pxs = 0, usd = 0, approx = false;
    for (const e of entries) {
        if (!e.ready || e.estimate) approx = true;
        pxs += e.absPxs;
        usd += e.absUsd;
    }
    const fiat = fiatOf(usd, prices);
    return {
        count: entries.length,
        pxsText: (approx ? "≈ " : "") + formatPxs(pxs) + " PXS",
        fiatText: fiat.amount.toFixed(2) + " " + fiat.currency,
    };
}

const getVoter = (entry) => (entry && entry.voter) || "";

// ── Rows ─────────────────────────────────────────────────────────────────

/** One voter. Memoised on the row record, its avatar and the locale. */
const VoterRow = memo(function VoterRow({ classes, vclasses, entry, image, locales }) {
    const value = entry.ready ? (
        <React.Fragment>
            <span className={entry.estimate ? vclasses.voteValue + " " + vclasses.voteValueEstimate : vclasses.voteValue}>
                {entry.pxsText}
            </span>
            <span className={vclasses.voteValueFiat}>{" · " + entry.fiatText}</span>
        </React.Fragment>
    ) : (
        <span className={vclasses.voteValue + " " + vclasses.voteValueEstimate}>{entry.estimate ? "≈ …" : "…"}</span>
    );
    const secondary = (
        <React.Fragment>
            {value}
            {entry.pctText ? <React.Fragment>{" • "}<span className={vclasses.votePercent}>{entry.pctText}</span></React.Fragment> : null}
            {entry.time ? (
                <React.Fragment>
                    {" • "}
                    <span className={vclasses.voteTime} title={fullDate(entry.time, locales)}>{timeAgo.format(entry.time)}</span>
                </React.Fragment>
            ) : null}
        </React.Fragment>
    );
    return <AccountRowLayout classes={classes} username={entry.voter} image={image} secondary={secondary} />;
});

const TotalLine = memo(function TotalLine({ className, total }) {
    if (!total) return <div className={className} />;
    return (
        <div className={className}>
            <span>{"Σ " + total.count}</span>
            <b>{total.pxsText}</b>
            <span>{total.fiatText}</span>
        </div>
    );
});

/** One tab: its total and its windowed voters. */
const VotesPane = memo(function VotesPane({ classes, entries, total, active, slot, store, renderRow, onOpenAccount, emptyText }) {
    return (
        <DialogContent className={classes.dialogContent}>
            <TotalLine className={classes.tabTotal} total={total} />
            <AccountList
                items={entries}
                getName={getVoter}
                renderRow={renderRow}
                imageStore={store}
                active={active}
                slot={slot}
                onOpenAccount={onOpenAccount}
                emptyText={emptyText}
            />
        </DialogContent>
    );
});

// ── Data hooks ───────────────────────────────────────────────────────────

/** Reward-fund snapshot (60 s RAM cache in utils/voteValue), while open. */
function useRewardSnapshot(api, open) {
    const [snapshot, setSnapshot] = useState(() => getRewardSnapshotSync(api));
    useEffect(() => {
        if (!api || !open) return undefined;
        let live = true;
        getRewardSnapshot(api)
            .then((snap) => { if (live && snap) setSnapshot((prev) => (prev === snap ? prev : snap)); })
            .catch(() => {});
        return () => { live = false; };
    }, [api, open]);
    return snapshot;
}

/**
 * Accounts of voters whose vote is still an optimistic placeholder
 * (rshares '0'): their value is ESTIMATED from vesting + mana. Usually one
 * row — the vote the user just cast. Deduped across renders.
 */
function usePendingVoterAccounts(api, votes, open) {
    const [accounts, setAccounts] = useState(EMPTY_OBJ);
    const asked = useRef(new Set());
    useEffect(() => {
        if (!api || !open || !Array.isArray(votes)) return undefined;
        let live = true;
        for (const v of votes) {
            if (!v || !v._optimistic || !v.voter || asked.current.has(v.voter)) continue;
            if (getVoterAccountSync(api, v.voter)) continue;
            asked.current.add(v.voter);
            getVoterAccount(api, v.voter)
                .then((acc) => {
                    if (!live || !acc) return;
                    setAccounts((prev) => (prev[v.voter] === acc ? prev : { ...prev, [v.voter]: acc }));
                })
                .catch(() => {})
                .then(() => { asked.current.delete(v.voter); });
        }
        return () => { live = false; };
    }, [api, votes, open]);
    return accounts;
}

// ── Dialog ───────────────────────────────────────────────────────────────

function VotingListModal({ classes, open, onClose, positive, votes, voterProfiles, api, locales }) {
    useLanguage();

    // ── Tabs ──
    const initialTab = positive === false ? 1 : 0;
    const [tab, setTab] = useState(initialTab);
    // Re-targeted (another post's votes, or the other sign): follow it.
    useEffect(() => { setTab(initialTab); }, [initialTab, votes]);

    const swipeRootRef = useRef(null);
    const scrollSlidesToTop = useCallback(() => {
        const root = swipeRootRef.current;
        const container = root && root.querySelector(".react-swipeable-view-container");
        if (!container) return;
        for (const slide of Array.from(container.children)) {
            slide.style.scrollBehavior = "smooth";
            slide.scrollTop = 0;
        }
    }, []);
    const onTabChange = useCallback((e, value) => {
        setTab(value);
        scrollSlidesToTop();
    }, [scrollSlidesToTop]);
    const onChangeIndex = useCallback((value) => onTabChange(null, value), [onTabChange]);

    // ── Valuation: one memo for both tabs ──
    const { pxaUsdPrice, pxsUsdPrice, fiatRate, currency } = usePrices(api);
    // usePrices() hands back a new object each render; the voteValue helpers
    // only read these four fields, so this is the stable thing to key on.
    const prices = useMemo(
        () => ({ pxaUsdPrice, pxsUsdPrice, fiatRate, currency }),
        [pxaUsdPrice, pxsUsdPrice, fiatRate, currency],
    );
    const snapshot = useRewardSnapshot(api, open);
    const pendingAccounts = usePendingVoterAccounts(api, votes, open);
    const ranked = useMemo(
        () => rankVotes(votes, snapshot, prices, pendingAccounts, api),
        [votes, snapshot, prices, pendingAccounts, api],
    );

    // ── Avatars: one store for both tabs, seeded with the page's prefetch ──
    const store = useMemo(() => new AccountImageStore(api, voterProfiles), [api]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { store.seed(voterProfiles); }, [store, voterProfiles]);
    useEffect(() => () => store.dispose(), [store]);

    // ── Rows ──
    const openAccount = useCallback((username) => {
        if (!username) return;
        if (typeof onClose === "function") onClose();
        HISTORY.push("/@" + username);
    }, [onClose]);
    const renderRow = useCallback(
        (entry, index, listClasses, image) => (
            <VoterRow classes={listClasses} vclasses={classes} entry={entry} image={image} locales={locales} />
        ),
        [classes, locales],
    );

    return (
        <Dialog
            className={classes.dialog}
            open={!!open}
            fullWidth={true}
            onClose={onClose}
            keepMounted={false}
        >
            <Tabs
                className={classes.cardTabs}
                value={tab}
                variant="fullWidth"
                indicatorColor="primary"
                textColor="primary"
                onChange={onTabChange}
            >
                <Tab label={tr("components.gdmetrics.upvotes", "Upvotes")} />
                <Tab label={tr("components.gdmetrics.downvotes_title", "Downvotes")} />
            </Tabs>
            <div className={classes.swipeRoot} ref={swipeRootRef}>
                <SwipeableViews
                    ignoreNativeScroll={true}
                    style={FILL_STYLE}
                    containerStyle={FILL_STYLE}
                    slideStyle={SLIDE_STYLE}
                    animateHeight={false}
                    animateTransitions={true}
                    disableLazyLoading={true}
                    resistance={true}
                    springConfig={SPRING}
                    index={tab}
                    onChangeIndex={onChangeIndex}
                >
                    <VotesPane
                        key="up"
                        classes={classes}
                        entries={ranked.up}
                        total={ranked.upTotal}
                        active={tab === 0}
                        slot="up"
                        store={store}
                        renderRow={renderRow}
                        onOpenAccount={openAccount}
                        emptyText={t("components.voting_list_modal.no_upvotes_yet")}
                    />
                    <VotesPane
                        key="down"
                        classes={classes}
                        entries={ranked.down}
                        total={ranked.downTotal}
                        active={tab === 1}
                        slot="down"
                        store={store}
                        renderRow={renderRow}
                        onOpenAccount={openAccount}
                        emptyText={t("components.voting_list_modal.no_downvotes_yet")}
                    />
                </SwipeableViews>
            </div>
            <DialogActions>
                <Button onClick={onClose} autoFocus variant="contained" color="primary">
                    {t("words.close")}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default withStyles(styles)(memo(VotingListModal));
