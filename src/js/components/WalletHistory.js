import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import Typography from "@material-ui/core/Typography";
import Tooltip from "@material-ui/core/Tooltip";
import FormControl from "@material-ui/core/FormControl";
import FormGroup from "@material-ui/core/FormGroup";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Checkbox from "@material-ui/core/Checkbox";
import Switch from "@material-ui/core/Switch";
import IconButton from "@material-ui/core/IconButton";
import ButtonBase from "@material-ui/core/ButtonBase";
import CircularProgress from "@material-ui/core/CircularProgress";

import ReplayRounded from "@material-ui/icons/ReplayRounded";
import ExpandMoreRounded from "@material-ui/icons/ExpandMoreRounded";

import useLiveTimeAgo from "../hooks/useLiveTimeAgo";
import { useScrollParentWindowing, useEndReached } from "../hooks/useScrollParentWindowing";

// tx is aliased: this file uses `tx` for a blockchain transaction
// (describeOperation(tx, …), for (const tx of history)), so importing the
// resolver under its own name would shadow — and read — as the wrong thing.
import { t, tx as translate, useLanguage } from "../utils/text";
import { formatDate, resolveLocale } from "../utils/numberFormat";
import { tr } from "./GDTowerKit";

// Operation → display data (asset parsing, describeOperation, icons and
// tints) lives in utils/chainOps, shared with the transaction inspector and
// the profile's History tab so an operation reads the same everywhere.
import { describeOperation, fmtUnit, KIND_ICON, DIR_STYLE } from "../utils/chainOps";

/* ────────────────────────────────────────────────────────────────────────────
 * Windowing: rows are fixed-height and windowed against the DIALOG's own
 * scrollbar (no inner scroll box) — see hooks/useScrollParentWindowing, now
 * shared with FollowListModal.
 * ──────────────────────────────────────────────────────────────────────────── */
const ROW_H = 64;
const OVERSCAN = 8;
// Pages that load without adding a single VISIBLE row (the filters hide
// them) before auto-loading pauses behind a "load more" button. Stops a
// narrow filter from walking an account's entire history unattended.
const MAX_BARREN_AUTOLOADS = 5;

/* ── A single ledger row (memoized) ───────────────────────────────────────── */
const HistoryRow = React.memo(function HistoryRow({ row, classes, locales, onInspect }) {
    useLanguage();
    const { desc, date } = row;
    const Icon = (KIND_ICON[desc.kind] || KIND_ICON.other)(desc.direction);
    const s = DIR_STYLE[desc.direction] || DIR_STYLE.self;
    const sign = s.sign;
    const amount = desc.amounts.length
        ? desc.amounts.map((a, i) => (i === 0 ? `${sign}${fmtUnit(a)}` : fmtUnit(a))).join("  +  ")
        : "";

    // Live relative date — one watcher per MOUNTED row: the windowing above
    // unmounts off-screen rows, so their watchers are released as you scroll,
    // and the rest go with the list on dialog close. Rows without a
    // timestamp (date null) arm nothing.
    const rel = useLiveTimeAgo(date);
    // Absolute timestamp in the Settings locale (the `locales` prop is kept
    // for callers but the wallet-wide formatter is the source of truth).
    const abs = date
        ? formatDate(date, {
            weekday: "long", year: "numeric", month: "long",
            day: "numeric", hour: "numeric", minute: "numeric",
        })
        : "";

    // The round icon opens the transaction inspector. Its rect goes along so
    // the inspector's icon can fly out of this one.
    const iconStyle = { color: s.fg, backgroundColor: s.halo };
    const inspect = onInspect
        ? (e) => onInspect(row.tx, e.currentTarget.getBoundingClientRect())
        : undefined;

    return (
        <ListItem className={classes.row} style={{ height: ROW_H }}>
            {inspect ? (
                <ButtonBase
                    focusRipple
                    className={`${classes.iconWrap} ${classes.iconButton}`}
                    style={iconStyle}
                    onClick={inspect}
                    aria-haspopup="dialog"
                    aria-label={tr("components.transaction_inspector.inspect", "Inspect transaction")}
                >
                    <Icon fontSize="small" />
                </ButtonBase>
            ) : (
                <div className={classes.iconWrap} style={iconStyle}>
                    <Icon fontSize="small" />
                </div>
            )}

            <div className={classes.body}>
                <span className={classes.title}>{translate(desc.title)}</span>
                {desc.subtitle ? <span className={classes.subtitle}>{translate(desc.subtitle)}</span> : null}
            </div>

            <div className={classes.right}>
                {amount ? <span className={classes.amount} style={{ color: s.fg }}>{amount}</span> : null}
                {date ? (
                    <Tooltip arrow title={abs}>
                        <span className={classes.date}>{rel}</span>
                    </Tooltip>
                ) : null}
            </div>
        </ListItem>
    );
});

/* ────────────────────────────────────────────────────────────────────────────
 * WalletHistory — owns the filter row + the windowed list.
 * Props:
 *   history     : Array<record>  (parent's _walletHistory; see toHistoryRecord
 *                 in utils/chainOps: { idx, type, data, timestamp, trx_id, … })
 *   username    : string                                  (account.username)
 *   locales     : string | string[]
 *   vestToPixa  : (rawVests:number) => number             (live rate from parent)
 *   hasMore     : boolean   older pages may exist              (default false)
 *   loadingMore : boolean   a page request is in flight
 *   loadError   : boolean   the last page request failed (auto-load stops)
 *   onLoadMore  : () => void  fetch the next older page; the parent guards
 *                             against double calls and calls after the end
 *   onInspect   : (record, iconRect) => void  a row's round icon was clicked;
 *                             the parent hosts the one inspector dialog.
 *                             Without it the icons stay plain.
 *
 * Scrolling belongs to the dialog: the list renders at full virtual height and
 * windows against the nearest scrollable ancestor — no inner scrollbar.
 * ──────────────────────────────────────────────────────────────────────────── */
function WalletHistory({ history, username, locales, vestToPixa, classes,
                           hasMore = false, loadingMore = false, loadError = false, onLoadMore,
                           onInspect }) {
    // Re-render on a language switch; `locale` also re-keys the rows memo so
    // the few subtitle strings formatted at describe time follow it too.
    useLanguage();
    const locale = resolveLocale();
    const [fIncoming, setIncoming] = React.useState(true);
    const [fOutgoing, setOutgoing] = React.useState(true);
    const [fPersonal, setPersonal] = React.useState(true);
    const [fRewards, setRewards] = React.useState(true);
    const [fHideSpam, setHideSpam] = React.useState(false);

    // 1) Describe + filter ONCE, producing a flat array the row renderer indexes
    //    into. This is what makes virtualization clean: rows are pure data.
    const rows = React.useMemo(() => {
        const out = [];
        for (const tx of history || []) {
            const desc = describeOperation(tx, username, vestToPixa);

            const isReward = desc.kind === "reward";
            const isPersonal = desc.direction === "self";
            const isIncoming = desc.direction === "in";
            const isOutgoing = desc.direction === "out";

            if (isReward && !fRewards) continue;
            if (isIncoming && !isReward && !fIncoming) continue;
            if (isOutgoing && !fOutgoing) continue;
            if (isPersonal && !fPersonal) continue;

            if (fHideSpam && desc.amounts.length) {
                const nums = desc.amounts.map((a) => a && a.value).filter(Number.isFinite);
                if (nums.length && nums.every((n) => Math.abs(n) < 1)) continue;
            }

            out.push({
                key: tx.idx != null ? tx.idx : out.length,
                desc,
                date: tx.timestamp ? new Date(tx.timestamp + "Z") : null,
                tx,     // the record itself, for the inspector
            });
        }
        return out;
    }, [history, username, vestToPixa, fIncoming, fOutgoing, fPersonal, fRewards, fHideSpam, locale]);

    // 2) Virtualize against the dialog's own scrollbar (no inner scroll area).
    const { listRef, start, end } = useScrollParentWindowing(rows.length, ROW_H, OVERSCAN);

    // 3) Load older pages automatically near the end. A page whose rows are
    //    all hidden by the filters still counts as progress for the parent,
    //    so `version` (raw length) re-arms the check; after a few such
    //    "barren" pages in a row, auto-loading pauses behind a button.
    const historyLen = (history || []).length;
    const lens = React.useRef({ h: historyLen, r: rows.length });
    const barren = React.useRef(0);
    const [autoPaused, setAutoPaused] = React.useState(false);
    React.useEffect(() => {
        const prev = lens.current;
        if (historyLen < prev.h) barren.current = 0;            // reset / refetch
        else if (historyLen > prev.h) {
            barren.current = rows.length > prev.r ? 0 : barren.current + 1;
        }
        lens.current = { h: historyLen, r: rows.length };
        const paused = barren.current >= MAX_BARREN_AUTOLOADS;
        setAutoPaused((p) => (p === paused ? p : paused));
    }, [historyLen, rows.length]);
    React.useEffect(() => {                                     // filters changed
        barren.current = 0;
        setAutoPaused(false);
    }, [fIncoming, fOutgoing, fPersonal, fRewards, fHideSpam]);

    const canLoad = !!hasMore && typeof onLoadMore === "function";
    useEndReached({
        end,
        count: rows.length,
        enabled: canLoad && !loadingMore && !loadError && !autoPaused,
        onEndReached: onLoadMore,
        version: historyLen,
    });
    const manualLoad = () => {
        barren.current = 0;
        setAutoPaused(false);
        if (onLoadMore) onLoadMore();
    };
    const slice = rows.slice(start, end);
    const topPad = start * ROW_H;
    const bottomPad = Math.max(0, (rows.length - end) * ROW_H);

    return (
        <div className={classes.wrap}>
            <FormControl component="fieldset" className={classes.filterBar}>
                <FormGroup row className={classes.filterGroup}>
                    <FormControlLabel
                        control={<Checkbox size="small" color="primary" checked={fIncoming} onChange={(e) => setIncoming(e.target.checked)} />}
                        label={t("components.wallet_history.incoming")} labelPlacement="bottom"
                    />
                    <FormControlLabel
                        control={<Checkbox size="small" color="primary" checked={fOutgoing} onChange={(e) => setOutgoing(e.target.checked)} />}
                        label={t("components.wallet_history.outgoing")} labelPlacement="bottom"
                    />
                    <FormControlLabel
                        control={<Checkbox size="small" color="primary" checked={fPersonal} onChange={(e) => setPersonal(e.target.checked)} />}
                        label={t("components.wallet_history.personal")} labelPlacement="bottom"
                    />
                    <FormControlLabel
                        control={<Checkbox size="small" color="primary" checked={fRewards} onChange={(e) => setRewards(e.target.checked)} />}
                        label={t("components.wallet_history.rewards")} labelPlacement="bottom"
                    />
                    <FormControlLabel
                        style={{ marginTop: 8 }}
                        control={<Switch style={{ marginBottom: 8 }} size="small" color="primary" checked={fHideSpam} onChange={(e) => setHideSpam(e.target.checked)} />}
                        label={t("components.wallet_history.hide_dust")} labelPlacement="bottom"
                    />
                </FormGroup>
            </FormControl>
            {rows.length === 0 ? (
                (canLoad && !loadError && !autoPaused) ? null : (
                    <Typography className={classes.empty} variant="body2">{t("components.wallet_history.no_transactions_found")}</Typography>
                )
            ) : (
                <div ref={listRef}>
                    <List dense disablePadding>
                        <div style={{ height: topPad }} />
                        {slice.map((row) => (
                            <HistoryRow key={row.key} row={row} classes={classes} locales={locales} onInspect={onInspect} />
                        ))}
                        <div style={{ height: bottomPad }} />
                    </List>
                </div>
            )}
            {/* Footer: spinner while a page loads; a button when auto-loading
                stopped (request failed, or filters hid several pages); nothing
                once the history has ended. */}
            {canLoad && loadingMore ? (
                <div className={classes.more}><CircularProgress size={24} color="secondary" /></div>
            ) : canLoad && (loadError || autoPaused) ? (
                <div className={classes.more}>
                    <IconButton aria-label="Load more" onClick={manualLoad}>
                        {loadError ? <ReplayRounded /> : <ExpandMoreRounded />}
                    </IconButton>
                </div>
            ) : null}
        </div>
    );
}

const styles = (theme) => ({
    wrap: { width: "100%" },

    filterBar: {
        width: "100%",
        backgroundColor: "#111111",
        borderRadius: 16,
        margin: "24px 0px 12px 0px",
        padding: "8px 8px",
    },
    filterGroup: {
        "& > .MuiFormControlLabel-root": {
            marginLeft: 8,
            marginRight: 8,
            "& .MuiTypography-body1": { fontSize: 14 },
        },
    },

    row: {
        height: 64,
        boxSizing: "border-box",
        backgroundColor: "transparent",
        borderRadius: 0,
        gap: 12,
        transition: "background-color 220ms cubic-bezier(0.4,0,0.2,1), border-radius 220ms cubic-bezier(0.4,0,0.2,1)",
        "&:hover": { backgroundColor: "#101010", borderRadius: 12 },
    },

    iconWrap: {
        flex: "0 0 auto",
        width: 40,
        height: 40,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    // The icon as the inspector's trigger: a light lift on hover, a ring on
    // keyboard focus. The halo colour stays inline (it carries direction), so
    // the lift is an overlay rather than a second background.
    iconButton: {
        "&::after": {
            content: '""',
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            borderRadius: "50%",
            backgroundColor: "#ffffff",
            opacity: 0,
            pointerEvents: "none",
            transition: "opacity 160ms cubic-bezier(0.4,0,0.2,1)",
        },
        "&:hover::after": { opacity: 0.08 },
        "&.Mui-focusVisible": { boxShadow: "0 0 0 2px rgba(255,255,255,0.55)" },
    },

    body: {
        flex: "1 1 auto",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
    },
    title: {
        color: "#e8e8e8",
        fontSize: 15,
        fontWeight: 500,
        lineHeight: "20px",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    subtitle: {
        color: "#6f6f6f",
        fontSize: 13,
        lineHeight: "18px",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },

    right: {
        flex: "0 0 auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        justifyContent: "center",
        textAlign: "right",
        maxWidth: "48%",
    },
    amount: {
        fontSize: 15,
        fontWeight: 600,
        lineHeight: "20px",
        fontVariantNumeric: "tabular-nums",
        fontFeatureSettings: '"tnum"',
        whiteSpace: "nowrap",
    },
    date: {
        color: "#6f6f6f",
        fontSize: 12,
        lineHeight: "16px",
        whiteSpace: "nowrap",
        cursor: "default",
    },

    empty: { color: "#666", padding: 16 },
    more: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: 64,
    },
});

export default withStyles(styles)(WalletHistory);