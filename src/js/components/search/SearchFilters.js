"use strict";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "preact/compat";
import CheckIcon from "@material-ui/icons/Check";

import { T } from "../../utils/T";
import { t, useLanguage } from "../../utils/text";
import DateRangePicker from "../DateRangePicker";

import { SWATCH_HEX } from "./config";
import {
    COLOR_MODES, EMPTY_FILTERS, TIME_PRESETS, TYPE_OPTIONS,
    accountName, countFilters, isCustomTime, toggleIn,
} from "./filters";
import { NO_SLOTS, tr } from "./highlight";
import { getVocab, loadVocab } from "./searchApi";
import { TokenField } from "./TokenField";

// ── SearchFilters ─────────────────────────────────────────────────────────────
// The panel the bar's filter button expands: a darker rounded square pinned at
// the top of the dropdown.
//
//   SHOW         All · Artworks · Posts
//   TIME         Any · 24h · Week · Month · Year · Custom (the app's DateRangePicker)
//   COLOUR       20 flat swatches (no border; ✓ when picked) · Dominant | Anywhere
//   AUTHORS      text field: type a name, pick from the accounts suggested
//   COMMUNITIES  text field: type a community's name, pick from the matches
//                                                             Reset filters
//
// Every change goes through controls.setFilters (a patch or an updater, so a
// click never works from stale props); the hook re-runs the Worker request.

// Custom range: the app's DateRangePicker (field + calendar dialog). Choosing
// "Custom" opens its calendar right away — through the field's `id`, since the
// picker opens on a click of its field and has no `open` prop.
const PICKER_ID = "pixagram-search-date-range";
const openPicker = () => {
    const el = typeof document !== "undefined" ? document.getElementById(PICKER_ID) : null;
    if (el) el.click();
};

// The filter keeps calendar days as "YYYY-MM-DD"; the picker works with local Dates.
const pad2 = (n) => String(n).padStart(2, "0");
const isoToDate = (s) => {
    if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
};
const dateToIso = (d) => (d instanceof Date && !isNaN(d.getTime())
    ? `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
    : null);

/** Text colour that reads on a swatch of `hex`. */
function contrastFor(hex) {
    const n = parseInt(String(hex).slice(1), 16);
    if (!Number.isFinite(n)) return "#fff";
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? "#111" : "#fff";
}

function Pills({ classes, options, value, onSelect }) {
    return (
        <React.Fragment>
            {options.map((o) => {
                const on = o.key === value;
                return (
                    <button
                        type="button"
                        key={String(o.key)}
                        className={classes.pill + (on ? " on" : "")}
                        aria-pressed={on}
                        onClick={() => onSelect(o.key)}
                    >
                        {o.label}
                    </button>
                );
            })}
        </React.Fragment>
    );
}

// One row of the panel's grid: the label cell and the options cell.
function Row({ classes, label, disabled, children }) {
    const dim = disabled ? " " + classes.filterDisabled : "";
    return (
        <React.Fragment>
            <span className={classes.filterLabel + dim}>{label}</span>
            <div className={classes.filterOptions + dim} aria-disabled={disabled || undefined}>{children}</div>
        </React.Fragment>
    );
}

export const SearchFilters = React.memo(
    ({ classes, filters, communityTitles, controls, maxHeight }) => {
        useLanguage();
        const trx = useCallback((key, fallback) => tr(t, key, fallback), []);
        const { setFilters, suggestAuthors, suggestCommunities } = controls;

        const [vocab, setVocab] = useState(getVocab);
        useEffect(() => {
            let alive = true;
            loadVocab().then((v) => { if (alive && v) setVocab(v); });
            return () => { alive = false; };
        }, []);

        // Labels and pictures of the values picked from suggestions ("a:<name>", "c:<portal-id>").
        const [known, setKnown] = useState(() => new Map());
        const rememberItem = useCallback((key, item) => {
            if (!item) return;
            setKnown((prev) => {
                const cur = prev.get(key);
                if (cur && cur.label === item.label && cur.image === item.image) return prev;
                const next = new Map(prev);
                next.set(key, { label: item.label, image: item.image || null });
                return next;
            });
        }, []);

        const count = countFilters(filters);
        const postsOnly = filters.type === "blog";
        const custom = isCustomTime(filters.time);
        const timeKey = filters.time ? (filters.time.preset || "custom") : null;
        const filtersRef = useRef(filters);
        filtersRef.current = filters;

        // ── show / time / colour ──
        // Posts carry no palette: switching to them drops any colour picked, so no
        // hidden filter empties the results.
        const setType = useCallback((key) => setFilters(key === "blog" ? { type: key, colors: [] } : { type: key }), [setFilters]);
        // "Custom" opens the calendar: right away when it is already the selected
        // option, else once its field has rendered (effect below).
        const openOnCustom = useRef(false);
        const setTime = useCallback((key) => {
            if (key === null) setFilters({ time: null });
            else if (key === "custom") {
                if (isCustomTime(filtersRef.current.time)) openPicker();
                else {
                    openOnCustom.current = true;
                    setFilters((prev) => ({ ...prev, time: { from: null, to: null } }));
                }
            } else setFilters({ time: { preset: key } });
        }, [setFilters]);
        useEffect(() => {
            if (custom && openOnCustom.current) {
                openOnCustom.current = false;
                openPicker();
            }
        }, [custom]);

        // The picker's OK fires onChangeStart then onChangeEnd; both land in one
        // filter update (one Worker request), applied on the next microtask.
        const rangeRef = useRef({ start: undefined, end: undefined, queued: false });
        const flushRange = useCallback(() => {
            const r = rangeRef.current;
            const { start, end } = r;
            r.start = r.end = undefined;
            r.queued = false;
            setFilters((prev) => {
                const cur = isCustomTime(prev.time) ? prev.time : { from: null, to: null };
                return {
                    ...prev,
                    time: {
                        from: start !== undefined ? dateToIso(start) : cur.from,
                        to: end !== undefined ? dateToIso(end) : cur.to,
                    },
                };
            });
        }, [setFilters]);
        const queueRange = useCallback((which, date) => {
            const r = rangeRef.current;
            r[which] = date || null;
            if (!r.queued) {
                r.queued = true;
                Promise.resolve().then(flushRange);
            }
        }, [flushRange]);
        const onRangeStart = useCallback((d) => queueRange("start", d), [queueRange]);
        const onRangeEnd = useCallback((d) => queueRange("end", d), [queueRange]);
        const rangeStart = useMemo(() => (custom ? isoToDate(filters.time.from) : null), [custom, filters.time]);
        const rangeEnd = useMemo(() => (custom ? isoToDate(filters.time.to) : null), [custom, filters.time]);
        // Posts and artworks cannot be from the future.
        const today = useMemo(() => new Date(), []);
        const setColorMode = useCallback((key) => setFilters({ colorMode: key }), [setFilters]);
        const toggleColor = useCallback((name) => setFilters((prev) => ({ ...prev, colors: toggleIn(prev.colors, name) })), [setFilters]);
        const clearAll = useCallback(() => setFilters({ ...EMPTY_FILTERS }), [setFilters]);

        // ── authors ──
        const addAuthor = useCallback((name, item) => {
            rememberItem("a:" + name, item);
            setFilters((prev) => (prev.authors.includes(name) ? prev : { ...prev, authors: prev.authors.concat([name]) }));
        }, [rememberItem, setFilters]);
        const removeAuthor = useCallback((name) => setFilters((prev) => ({ ...prev, authors: prev.authors.filter((a) => a !== name) })), [setFilters]);
        const authorLabel = useCallback((name) => {
            const k = known.get("a:" + name);
            return { label: "@" + name, image: k ? k.image : null };
        }, [known]);

        // ── communities ──
        const addCommunity = useCallback((name, item) => {
            rememberItem("c:" + name, item);
            setFilters((prev) => (prev.communities.includes(name) ? prev : { ...prev, communities: prev.communities.concat([name]) }));
        }, [rememberItem, setFilters]);
        const removeCommunity = useCallback((name) => setFilters((prev) => ({ ...prev, communities: prev.communities.filter((c) => c !== name) })), [setFilters]);
        const communityLabel = useCallback((name) => {
            const k = known.get("c:" + name);
            return { label: (k && k.label) || (communityTitles && communityTitles[name]) || name, image: k ? k.image : null };
        }, [known, communityTitles]);
        // A community is only ever picked from the matches (its id is not typed).
        const noFreeText = useCallback(() => null, []);
        // Suggestions carry the subscriber count as a number; it is worded here, with
        // the same label as the community rows (words.subscribers_count).
        const suggestCommunitiesWorded = useCallback(async (text) => {
            const rows = await suggestCommunities(text);
            return rows.map((r) => (r.subscribers
                ? { ...r, sub: <T k="words.subscribers_count" vars={{ count: r.subscribers }} slots={NO_SLOTS} /> }
                : r));
        }, [suggestCommunities]);
        // The Worker's colour buckets by name (components.search_filters.color_<name>);
        // an unknown bucket shows its own name.
        const colorName = useCallback((name) => trx("components.search_filters.color_" + name, name), [trx]);

        const typeOptions = useMemo(() => TYPE_OPTIONS.map((o) => ({ key: o.key, label: trx(o.i18n, o.label) })), [trx]);
        const timeOptions = useMemo(() => [
            { key: null, label: trx("components.search_filters.any_time", "Any") },
            ...TIME_PRESETS.map((p) => ({ key: p.key, label: trx(p.i18n, p.label) })),
            { key: "custom", label: trx("components.search_filters.custom", "Custom") },
        ], [trx]);
        const modeOptions = useMemo(() => COLOR_MODES.map((m) => ({ key: m.key, label: trx(m.i18n, m.label) })), [trx]);

        return (
            <div className={classes.filterPanel} style={maxHeight ? { maxHeight } : undefined}>
                <Row classes={classes} label={trx("components.search_filters.show", "Show")}>
                    <Pills classes={classes} options={typeOptions} value={filters.type} onSelect={setType} />
                </Row>

                <Row classes={classes} label={trx("components.search_filters.time", "Time")}>
                    <Pills classes={classes} options={timeOptions} value={timeKey} onSelect={setTime} />
                    {custom ? (
                        <React.Fragment>
                            <span className={classes.filterBreak} />
                            <div className={classes.dateRange}>
                                <DateRangePicker
                                    id={PICKER_ID}
                                    className={classes.dateRangeField}
                                    label={null}
                                    startDate={rangeStart}
                                    endDate={rangeEnd}
                                    onChangeStart={onRangeStart}
                                    onChangeEnd={onRangeEnd}
                                    maxDate={today}
                                    margin="none"
                                    fullWidth
                                />
                            </div>
                        </React.Fragment>
                    ) : null}
                </Row>

                <Row classes={classes} label={trx("components.search_filters.color", "Color")} disabled={postsOnly}>
                    {postsOnly ? <span className={classes.filterNote}>{trx("components.search_filters.artworks_only", "Artworks only")}</span> : null}
                    {vocab.colors.map((c) => {
                        const on = filters.colors.includes(c.name);
                        const hex = SWATCH_HEX[c.name] || c.hex;
                        const name = colorName(c.name);
                        return (
                            <button
                                type="button"
                                key={c.name}
                                className={classes.swatch}
                                style={{ backgroundColor: hex }}
                                title={name}
                                aria-label={name}
                                aria-pressed={on}
                                onClick={() => toggleColor(c.name)}
                            >
                                {on ? <CheckIcon style={{ color: contrastFor(hex) }} /> : null}
                            </button>
                        );
                    })}
                    <span className={classes.filterBreak} />
                    <Pills classes={classes} options={modeOptions} value={filters.colorMode} onSelect={setColorMode} />
                </Row>

                <Row classes={classes} label={trx("components.search_filters.authors", "Authors")}>
                    <TokenField
                        classes={classes}
                        values={filters.authors}
                        labelOf={authorLabel}
                        suggest={suggestAuthors}
                        validate={accountName}
                        onAdd={addAuthor}
                        onRemove={removeAuthor}
                        placeholder={trx("words.username_2", "@username")}
                        ariaLabel={trx("components.search_filters.authors", "Authors")}
                    />
                </Row>

                <Row classes={classes} label={trx("words.communities", "Communities")}>
                    <TokenField
                        classes={classes}
                        values={filters.communities}
                        labelOf={communityLabel}
                        suggest={suggestCommunitiesWorded}
                        validate={noFreeText}
                        onAdd={addCommunity}
                        onRemove={removeCommunity}
                        placeholder={trx("components.search_filters.community_name", "Community name")}
                        ariaLabel={trx("words.communities", "Communities")}
                        suggestOnFocus
                    />
                </Row>

                {count > 0 ? (
                    <div className={classes.filterFooter}>
                        <button type="button" className={classes.filterReset} onClick={clearAll}>
                            {trx("components.search_filters.reset_filters", "Reset filters")}
                        </button>
                    </div>
                ) : null}
            </div>
        );
    },
    (prev, next) =>
        prev.filters === next.filters &&
        prev.communityTitles === next.communityTitles &&
        prev.controls === next.controls &&
        prev.maxHeight === next.maxHeight &&
        prev.classes === next.classes,
);
