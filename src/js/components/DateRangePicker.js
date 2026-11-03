import React from 'preact/compat';
import withStyles from "@material-ui/core/styles/withStyles";
import Dialog from "@material-ui/core/Dialog";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import Typography from "@material-ui/core/Typography";

import ChevronLeftIcon from "@material-ui/icons/ChevronLeft";
import ChevronRightIcon from "@material-ui/icons/ChevronRight";
import EventIcon from "@material-ui/icons/Event";

import { t, useLanguage, getLocaleCode } from "../utils/text";

/**
 * DateRangePicker — a single field + modal calendar for picking a start/end
 * date pair, modeled on MUI X's MobileDateRangePicker (the "SELECT DATE
 * RANGE" modal with the two-date header, one-month grid with a range band,
 * and CANCEL / OK actions) but rebuilt from scratch on Material-UI v4 +
 * preact/compat, in Pixagram greyscale — endpoints are white circles, the
 * band is a translucent white pill, no blue anywhere.
 *
 * Self-contained on purpose (own withStyles, no date library — plain Date
 * math): drop it anywhere without the editor dialog's merged stylesheet.
 *
 * Selection follows MUI X's rules: the header chips show which endpoint is
 * being picked; choosing a day fills the active endpoint and auto-advances
 * from start to end; picking a day before the current start while choosing
 * the end re-anchors the start instead. OK commits, CANCEL discards.
 *
 * Props:
 *   startDate / endDate        Date | null — controlled values
 *   onChangeStart / onChangeEnd(date)     — both fired on OK
 *   label                      field label (default: translated "Date
 *                              range"; null for no label)
 *   helperText, error          forwarded to the TextField
 *   className                  extra class on the field (greyscale error
 *                              overrides ride in from the caller)
 *   disablePast, minDate, maxDate, disabled, fullWidth, margin, id
 */

// ── date-only helpers (no library) ───────────────────────────────────────
// Calendar days compare as y*10000 + m*100 + d — immune to time-of-day
// and DST offsets.
const dayKey = (d) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const isValidDate = (d) => d instanceof Date && !isNaN(d.getTime());
const asDate = (v) => {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    return isValidDate(d) ? d : null;
};

// Picking a day keeps the time-of-day of the value it replaces (falling
// back to "now") — exactly what KeyboardDatePicker did, so the chain-date
// conversion downstream keeps producing the same kind of instants.
const withTimeOf = (day, ref) => {
    const t = isValidDate(ref) ? ref : new Date();
    return new Date(
        day.getFullYear(), day.getMonth(), day.getDate(),
        t.getHours(), t.getMinutes(), t.getSeconds(), t.getMilliseconds()
    );
};

const pad2 = (n) => String(n).padStart(2, '0');

// ── locale helpers (Intl only, still no date library) ────────────────────
// Everything the picker shows follows the APP language (getLocaleCode(),
// e.g. "fr-CH"), not en-US and not the browser: month and weekday names,
// the first day of the week and the numeric day/month/year order. Digits
// stay Latin (-u-nu-latn), as in utils/numberFormat: the day grid prints
// plain numbers and the typed KeyboardDatePicker (SettingsPanel) only
// accepts 0-9, so a bn-BD user sees one digit set everywhere. Exported for
// that picker, which shares the numeric layout and the week start.

const FALLBACK_CODE = 'en-US';
const latnTag = (code) => {
    const base = String(code || FALLBACK_CODE);
    if (base.indexOf('-nu-') !== -1) return base;
    return base.indexOf('-u-') !== -1 ? base + '-nu-latn' : base + '-u-nu-latn';
};

// Intl formatters are ICU lookups: build each (locale, options) pair once.
const intlCache = new Map();
const dateFormatter = (code, id, opts) => {
    code = code || FALLBACK_CODE;
    const key = code + '|' + id;
    let f = intlCache.get(key);
    if (!f) {
        try { f = new Intl.DateTimeFormat(latnTag(code), opts); }
        catch (_) { f = new Intl.DateTimeFormat(latnTag(FALLBACK_CODE), opts); }
        if (intlCache.size > 200) intlCache.clear();
        intlCache.set(key, f);
    }
    return f;
};

const NUMERIC = { year: 'numeric', month: '2-digit', day: '2-digit' };
const FIELDS = { day: 1, month: 1, year: 1 };
const BIDI_MARKS = /[\u200e\u200f\u061c]/g;
const US_LAYOUT = { order: ['month', 'day', 'year'], literals: ['', '/', '/', ''] };

/**
 * The locale's all-numeric date layout, read from Intl.formatToParts:
 * `order` is the field sequence, `literals[i]` the text before field i and
 * `literals[3]` the text after the last one.
 *   en-US → month "/" day "/" year      de-DE → day "." month "." year
 *   ja-JP → year "/" month "/" day      hu-HU → year ". " month ". " day "."
 */
const layoutCache = new Map();
export const numericDateLayout = (code) => {
    const c = code || FALLBACK_CODE;
    let layout = layoutCache.get(c);
    if (layout) return layout;
    const order = [];
    const literals = [''];
    try {
        dateFormatter(c, 'numeric', NUMERIC).formatToParts(new Date(2001, 10, 22)).forEach((p) => {
            if (FIELDS[p.type]) { order.push(p.type); literals.push(''); }
            else literals[literals.length - 1] += String(p.value).replace(BIDI_MARKS, '');
        });
    } catch (_) { order.length = 0; }
    layout = (order.length === 3 && new Set(order).size === 3) ? { order, literals } : US_LAYOUT;
    layoutCache.set(c, layout);
    return layout;
};

const fieldText = (d, field) => field === 'day' ? pad2(d.getDate())
    : field === 'month' ? pad2(d.getMonth() + 1)
        : String(d.getFullYear()).padStart(4, '0');

// Lays the three fields out in the locale's order: per field, `piece`
// supplies the text ("02" / "11" / "2026", or the placeholder letters).
const layOut = (code, piece) => {
    const { order, literals } = numericDateLayout(code);
    let out = literals[0];
    for (let i = 0; i < order.length; i++) out += piece(order[i]) + literals[i + 1];
    return out;
};

/** "11/22/2001" (en-US), "22.11.2001" (de-DE), "2001/11/22" (ja-JP). */
export const formatNumericDate = (d, code) => layOut(code, (field) => fieldText(d, field));

/**
 * The same layout as a date-fns pattern ("dd.MM.yyyy") for the typed
 * KeyboardDatePicker. Literals keep only separator characters: the picker
 * derives its input mask from the pattern by turning every letter into a
 * digit slot, so a letter in a literal would become one.
 */
export const dateFnsPattern = (code) => {
    const { order, literals } = numericDateLayout(code);
    const sep = (s) => s.replace(/[\u00a0\u202f]/g, ' ').replace(/[^ .,/-]/g, '');
    const token = { day: 'dd', month: 'MM', year: 'yyyy' };
    let out = sep(literals[0]);
    for (let i = 0; i < order.length; i++) out += token[order[i]] + sep(literals[i + 1]);
    return out;
};

// Territories whose week starts on Sunday / Saturday (CLDR weekData) — only
// consulted when the browser has no Intl.Locale week info (Firefox).
const SUNDAY_FIRST = new Set(('AG AS BD BR BS BT BW BZ CA CO DM DO ET GT GU HK HN ID IL IN JM JP KE '
    + 'KH KR LA MH MM MO MT MX MZ NI NP PA PE PH PK PR PT PY SA SG SV TH TT TW UM US VE VI WS YE ZA ZW').split(' '));
const SATURDAY_FIRST = new Set('AE AF BH DJ DZ EG IQ IR JO KW LY OM QA SD SY'.split(' '));

/** First day of the week as Date#getDay() counts (0 = Sunday, 1 = Monday). */
const firstDayCache = new Map();
export const firstDayOfWeek = (code) => {
    const c = code || FALLBACK_CODE;
    let day = firstDayCache.get(c);
    if (day !== undefined) return day;
    day = null;
    try {
        const loc = new Intl.Locale(c);
        const info = typeof loc.getWeekInfo === 'function' ? loc.getWeekInfo() : loc.weekInfo;
        if (info && info.firstDay >= 1 && info.firstDay <= 7) day = info.firstDay % 7;  // 7 = Sunday
    } catch (_) { day = null; }
    if (day === null) {
        const m = /^[a-z]{2,3}(?:-[A-Za-z]{4})?-([A-Za-z]{2})(?:-|$)/.exec(c);
        const region = m ? m[1].toUpperCase() : null;
        day = !region || SUNDAY_FIRST.has(region) ? 0 : (SATURDAY_FIRST.has(region) ? 6 : 1);
    }
    firstDayCache.set(c, day);
    return day;
};

// 1 Jan 2023 was a Sunday: index i of the result is the name for getDay() === i.
const weekdayNames = (code, width) =>
    [0, 1, 2, 3, 4, 5, 6].map((i) => dateFormatter(code, 'wd-' + width, { weekday: width }).format(new Date(2023, 0, 1 + i)));

/** Weekday names for the column headers, starting on the locale's first day. */
const headerCache = new Map();
export const weekdayHeaders = (code, width = 'narrow') => {
    const key = (code || FALLBACK_CODE) + '|' + width;
    let headers = headerCache.get(key);
    if (!headers) {
        const names = weekdayNames(code || FALLBACK_CODE, width);
        const first = firstDayOfWeek(code);
        headers = names.slice(first).concat(names.slice(0, first));
        headerCache.set(key, headers);
    }
    return headers;
};

/** Any Intl date format in the app language (Latin digits, cached formatter). */
export const formatIntlDate = (d, code, opts) => dateFormatter(code, JSON.stringify(opts), opts).format(d);

/** Month name + year, e.g. "November 2026", "novembre 2026", "2026年11月". */
export const formatMonthYear = (d, code) => dateFormatter(code, 'month-year', { month: 'long', year: 'numeric' }).format(d);

// Header chips — "Apr 1" / "1 avr." like the MUI X modal.
const formatShort = (d, code) => dateFormatter(code, 'short', { month: 'short', day: 'numeric' }).format(d);
// Day buttons' accessible name — the full date, not just the number.
const formatLong = (d, code) => dateFormatter(code, 'long', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(d);

// Weeks (rows of 7, null-padded) for the month containing `view`, the first
// column being the locale's first day of the week (0 = Sunday … 6 = Saturday).
const buildWeeks = (view, firstDay = 0) => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const weeks = [];
    let week = new Array((first.getDay() - firstDay + 7) % 7).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
        week.push(new Date(view.getFullYear(), view.getMonth(), d));
        if (week.length === 7) { weeks.push(week); week = []; }
    }
    if (week.length) { while (week.length < 7) week.push(null); weeks.push(week); }
    return weeks;
};

const CELL = 40;   // grid cell (band height)
const DAY = 36;    // day circle inside the cell

// Portal dialog: keep keys typed while it's open away from document-level
// hotkey listeners; Escape passes through so the modal can still close.
const stopKeyLeak = (e) => {
    if (e.key !== 'Escape' && e.key !== 'Esc') e.stopPropagation();
};
const KEY_LEAK_PAPER_PROPS = { onKeyDown: stopKeyLeak, onKeyUp: stopKeyLeak };

export const dateRangePickerStyles = () => ({
    // ── field ────────────────────────────────────────────────────────────
    fieldInput: {
        cursor: "pointer",
        "& input": { cursor: "pointer" },
        "& .MuiInputAdornment-root .MuiIconButton-root": { color: "#888" },
    },
    // ── modal ────────────────────────────────────────────────────────────
    paper: {
        backgroundColor: "#212121",
        color: "#fff",
        borderRadius: 16,
        width: 332,
        maxWidth: "calc(100vw - 32px)",
    },
    header: {
        padding: "16px 24px 8px 24px",
    },
    overline: {
        color: "#999",
        letterSpacing: 1,
        fontSize: "0.7rem",
    },
    headerDates: {
        display: "flex",
        alignItems: "baseline",
        gap: 8,
        marginTop: 4,
        fontSize: "1.6rem",
        fontWeight: 500,
        lineHeight: 1.2,
    },
    headerChip: {
        padding: "0px 8px",
        margin: "0 -4px",
        borderRadius: 8,
        border: "none",
        outline: "none",
        background: "transparent",
        color: "#bbb",
        font: "inherit",
        cursor: "pointer",
        transition: "background-color 120ms cubic-bezier(0.4, 0, 0.2, 1), color 120ms cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": { color: "#fff" },
    },
    headerChipActive: {
        backgroundColor: "rgba(255,255,255,0.16)",
        color: "#fff",
    },
    headerChipEmpty: {
        color: "#666",
        fontStyle: "italic",
        fontSize: "1.1rem",
    },
    // ── month navigation ─────────────────────────────────────────────────
    monthRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 12px 0px 24px",
    },
    monthLabel: {
        fontWeight: 600,
        fontSize: "1rem",
        color: "#fff",
    },
    navButton: {
        color: "#ccc",
        padding: 8,
        "&.Mui-disabled": { color: "#444" },
    },
    // ── grid ─────────────────────────────────────────────────────────────
    grid: {
        padding: "8px 24px 4px 24px",
    },
    weekdayRow: {
        display: "flex",
    },
    weekday: {
        width: CELL,
        height: 28,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#888",
        fontSize: "0.75rem",
    },
    weekRow: {
        display: "flex",
        marginBottom: 2,
    },
    cell: {
        width: CELL,
        height: CELL,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    // Committed range band — the translucent pill running through the rows.
    cellInRange: {
        backgroundColor: "rgba(255,255,255,0.12)",
    },
    // Live preview while choosing the second endpoint (hover).
    cellPreview: {
        backgroundColor: "rgba(255,255,255,0.05)",
    },
    day: {
        width: DAY,
        height: DAY,
        borderRadius: "50%",
        border: "none",
        outline: "none",
        background: "transparent",
        color: "#e0e0e0",
        fontSize: "0.8rem",
        fontFamily: "inherit",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background-color 100ms cubic-bezier(0.4, 0, 0.2, 1), color 100ms cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": { backgroundColor: "rgba(255,255,255,0.10)" },
    },
    dayToday: {
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.45)",
    },
    daySelected: {
        backgroundColor: "#ffffff",
        color: "#000000",
        fontWeight: 600,
        "&:hover": { backgroundColor: "#ffffff" },
    },
    dayDisabled: {
        color: "#555",
        cursor: "default",
        "&:hover": { backgroundColor: "transparent" },
    },
    // ── actions ──────────────────────────────────────────────────────────
    actions: {
        display: "flex",
        justifyContent: "flex-end",
        gap: 8,
        padding: "8px 16px 16px 16px",
    },
    actionButton: {
        color: "#fff",
        "&.Mui-disabled": { color: "rgba(255,255,255,0.3)" },
    },
});

const DateRangePicker = React.memo(({
                                        classes,
                                        className,
                                        label,
                                        startDate,
                                        endDate,
                                        onChangeStart,
                                        onChangeEnd,
                                        disablePast,
                                        minDate,
                                        maxDate,
                                        disabled,
                                        helperText,
                                        error,
                                        fullWidth = true,
                                        margin = "dense",
                                        id,
                                    }) => {
    useLanguage();
    // Read per render (cheap): every name, order and week start below follows it.
    const code = getLocaleCode();
    const firstDay = firstDayOfWeek(code);
    const [open, setOpen] = React.useState(false);
    const [draftStart, setDraftStart] = React.useState(null);
    const [draftEnd, setDraftEnd] = React.useState(null);
    const [active, setActive] = React.useState('start');   // 'start' | 'end'
    const [view, setView] = React.useState(() => new Date());
    const [hoverDay, setHoverDay] = React.useState(null);  // dayKey | null

    // Selection floor/ceiling as day keys (date-only, like everything here).
    const floorKey = React.useMemo(() => {
        const candidates = [];
        if (disablePast) candidates.push(dayKey(new Date()));
        const min = asDate(minDate);
        if (min) candidates.push(dayKey(min));
        return candidates.length ? Math.max(...candidates) : null;
    }, [disablePast, minDate]);
    const ceilKey = React.useMemo(() => {
        const max = asDate(maxDate);
        return max ? dayKey(max) : null;
    }, [maxDate]);

    const openPicker = React.useCallback(() => {
        if (disabled) return;
        const s = asDate(startDate);
        const e = asDate(endDate);
        setDraftStart(s);
        setDraftEnd(e);
        setActive('start');
        setHoverDay(null);
        const anchor = s || new Date();
        setView(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
        setOpen(true);
    }, [disabled, startDate, endDate]);

    const close = React.useCallback(() => setOpen(false), []);

    const commit = React.useCallback(() => {
        if (onChangeStart) onChangeStart(draftStart);
        if (onChangeEnd) onChangeEnd(draftEnd);
        setOpen(false);
    }, [onChangeStart, onChangeEnd, draftStart, draftEnd]);

    // MUI X selection rules: fill the active endpoint, auto-advance
    // start → end, and re-anchor the start when the "end" pick lands
    // before it. All comparisons are calendar-day comparisons.
    const pickDay = React.useCallback((day) => {
        const k = dayKey(day);
        if (active === 'start' || !draftStart) {
            const next = withTimeOf(day, draftStart);
            setDraftStart(next);
            if (draftEnd && dayKey(draftEnd) < k) setDraftEnd(null);
            setActive('end');
        } else if (k < dayKey(draftStart)) {
            setDraftStart(withTimeOf(day, draftStart));
        } else {
            setDraftEnd(withTimeOf(day, draftEnd || draftStart));
        }
    }, [active, draftStart, draftEnd]);

    const goPrevMonth = React.useCallback(
        () => setView(v => new Date(v.getFullYear(), v.getMonth() - 1, 1)), []);
    const goNextMonth = React.useCallback(
        () => setView(v => new Date(v.getFullYear(), v.getMonth() + 1, 1)), []);

    // Previous month is pointless once every one of its days sits below the
    // floor — `view` is always the 1st of the month, so that's one compare.
    const prevDisabled = floorKey != null && floorKey >= dayKey(view);

    const weeks = React.useMemo(() => buildWeeks(view, firstDay), [view, firstDay]);
    const todayKey = dayKey(new Date());
    const startKey = draftStart ? dayKey(draftStart) : null;
    const endKey = draftEnd ? dayKey(draftEnd) : null;

    // Range band: the committed pair, or start→hover preview while the
    // second endpoint is still being chosen.
    const bandLo = startKey;
    const bandHi = endKey != null
        ? endKey
        : (hoverDay != null && startKey != null && hoverDay > startKey ? hoverDay : null);
    const previewOnly = endKey == null && bandHi != null;

    // Field text in the locale's numeric order — "11/22/2026 – 11/29/2026",
    // "22.11.2026 – 29.11.2026" — and a placeholder laid out the same way
    // from translated field letters (DD/MM/YYYY, TT.MM.JJJJ, JJ/MM/AAAA…).
    // Read-only: the field only opens the calendar, nothing is parsed here.
    const fieldStart = asDate(startDate);
    const fieldEnd = asDate(endDate);
    const fieldValue = (fieldStart || fieldEnd)
        ? t("components.date_range_picker.range_start_end", {
            start: fieldStart ? formatNumericDate(fieldStart, code) : '',
            end: fieldEnd ? formatNumericDate(fieldEnd, code) : '',
        })
        : '';
    const placeholderLetters = {
        day: t("components.date_range_picker.dd"),
        month: t("components.date_range_picker.mm"),
        year: t("components.date_range_picker.yyyy"),
    };
    const placeholderDate = layOut(code, (field) => placeholderLetters[field]);

    const field = (
        <TextField
            id={id}
            className={(classes.fieldInput + (className ? " " + className : ""))}
            variant="outlined"
            margin={margin}
            fullWidth={fullWidth}
            label={label === undefined ? t("components.date_range_picker.date_range") : label}
            value={fieldValue}
            placeholder={t("components.date_range_picker.range_start_end", { start: placeholderDate, end: placeholderDate })}
            onClick={openPicker}
            disabled={disabled}
            helperText={helperText}
            error={!!error}
            InputProps={{
                readOnly: true,
                endAdornment: (
                    <InputAdornment position="end">
                        <IconButton size="small" onClick={openPicker} aria-label={t("components.date_range_picker.open_date_range_picker")}>
                            <EventIcon />
                        </IconButton>
                    </InputAdornment>
                ),
            }}
        />
    );

    return (
        <React.Fragment>
            {field}
            <Dialog
                open={open}
                onClose={close}
                PaperProps={KEY_LEAK_PAPER_PROPS}
                classes={{ paper: classes.paper }}
            >
                <div className={classes.header}>
                    <Typography variant="overline" className={classes.overline}>
                        {t("components.date_range_picker.select_date_range")}
                    </Typography>
                    <div className={classes.headerDates}>
                        <button
                            type="button"
                            className={
                                classes.headerChip
                                + (active === 'start' ? " " + classes.headerChipActive : "")
                                + (!draftStart ? " " + classes.headerChipEmpty : "")
                            }
                            onClick={() => setActive('start')}
                        >
                            {draftStart ? formatShort(draftStart, code) : t("components.date_range_picker.start")}
                        </button>
                        <span>–</span>
                        <button
                            type="button"
                            className={
                                classes.headerChip
                                + (active === 'end' ? " " + classes.headerChipActive : "")
                                + (!draftEnd ? " " + classes.headerChipEmpty : "")
                            }
                            onClick={() => setActive('end')}
                        >
                            {draftEnd ? formatShort(draftEnd, code) : t("components.date_range_picker.end")}
                        </button>
                    </div>
                </div>

                <div className={classes.monthRow}>
                    <span className={classes.monthLabel}>{formatMonthYear(view, code)}</span>
                    <span>
                        <IconButton
                            className={classes.navButton}
                            onClick={goPrevMonth}
                            disabled={!!prevDisabled}
                            aria-label={t("components.date_range_picker.previous_month")}
                        >
                            <ChevronLeftIcon />
                        </IconButton>
                        <IconButton
                            className={classes.navButton}
                            onClick={goNextMonth}
                            aria-label={t("components.date_range_picker.next_month")}
                        >
                            <ChevronRightIcon />
                        </IconButton>
                    </span>
                </div>

                <div className={classes.grid} onMouseLeave={() => setHoverDay(null)}>
                    <div className={classes.weekdayRow}>
                        {weekdayHeaders(code).map((w, i) => (
                            <span key={i} className={classes.weekday}>{w}</span>
                        ))}
                    </div>
                    {weeks.map((week, wi) => (
                        <div key={wi} className={classes.weekRow}>
                            {week.map((day, di) => {
                                if (!day) return <span key={di} className={classes.cell} />;
                                const k = dayKey(day);
                                const isStart = k === startKey;
                                const isEnd = k === endKey;
                                const inBand = bandLo != null && bandHi != null && k >= bandLo && k <= bandHi;
                                const beforeFloor = floorKey != null && k < floorKey;
                                const afterCeil = ceilKey != null && k > ceilKey;
                                const isDisabled = beforeFloor || afterCeil;

                                // Round the band's row ends and endpoints so it
                                // reads as pills, like the reference calendar.
                                const roundLeft = inBand && (k === bandLo || di === 0 || day.getDate() === 1);
                                const lastOfMonth = day.getDate() === new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate();
                                const roundRight = inBand && (k === bandHi || di === 6 || lastOfMonth);

                                return (
                                    <span
                                        key={di}
                                        className={
                                            classes.cell
                                            + (inBand ? " " + (previewOnly ? classes.cellPreview : classes.cellInRange) : "")
                                        }
                                        style={inBand ? {
                                            borderTopLeftRadius: roundLeft ? CELL / 2 : 0,
                                            borderBottomLeftRadius: roundLeft ? CELL / 2 : 0,
                                            borderTopRightRadius: roundRight ? CELL / 2 : 0,
                                            borderBottomRightRadius: roundRight ? CELL / 2 : 0,
                                        } : undefined}
                                    >
                                        <button
                                            type="button"
                                            className={
                                                classes.day
                                                + ((isStart || isEnd) ? " " + classes.daySelected : "")
                                                + (k === todayKey && !isStart && !isEnd ? " " + classes.dayToday : "")
                                                + (isDisabled ? " " + classes.dayDisabled : "")
                                            }
                                            disabled={isDisabled}
                                            onClick={isDisabled ? undefined : () => pickDay(day)}
                                            onMouseEnter={isDisabled ? undefined : () => setHoverDay(k)}
                                            aria-label={formatLong(day, code)}
                                        >
                                            {day.getDate()}
                                        </button>
                                    </span>
                                );
                            })}
                        </div>
                    ))}
                </div>

                <div className={classes.actions}>
                    <Button className={classes.actionButton} onClick={close}>
                        {t("words.cancel")}
                    </Button>
                    <Button
                        className={classes.actionButton}
                        onClick={commit}
                        disabled={!draftStart || !draftEnd}
                    >
                        {t("components.date_range_picker.ok")}
                    </Button>
                </div>
            </Dialog>
        </React.Fragment>
    );
});

export default withStyles(dateRangePickerStyles)(DateRangePicker);
