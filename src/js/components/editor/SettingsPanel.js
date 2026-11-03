import React from 'preact/compat';
import Typography from "@material-ui/core/Typography";
import FormControl from "@material-ui/core/FormControl";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import Tooltip from "@material-ui/core/Tooltip";
import IconButton from "@material-ui/core/IconButton";
import TextField from "@material-ui/core/TextField";
import Checkbox from "@material-ui/core/Checkbox";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Fade from "@material-ui/core/Fade";
import Collapse from "@material-ui/core/Collapse";
import InfoOutlined from "@material-ui/icons/InfoOutlined";

import { MuiPickersUtilsProvider, KeyboardDatePicker } from "@material-ui/pickers";
import DateFnsUtils from "@date-io/date-fns";
import { NumericFormat } from "react-number-format";

import PixaSupra from "../../icons/PixaSupra";
import { ToxicityWatcher } from "../ToxicityHint";
import { usePrices } from "../../hooks/usePrices";

import CoverImageUpload from './CoverImageUpload';
import ActionButtons from './ActionButtons';
import DateRangePicker, {
    dateFnsPattern, firstDayOfWeek, weekdayHeaders, formatMonthYear, formatIntlDate
} from '../DateRangePicker';

import { t, useLanguage, getLocaleCode } from "../../utils/text";

// ── Proposal fee (compile-time constants) ────────────────────────────────
// The chain charges the creator a flat listing fee on create_proposal, and
// long proposals pay a per-day surcharge on top:
//     total fee = PROPOSAL_FEE_PXS
//               + max(0, days − 60) × PROPOSAL_FEE_INCREASE_PXS_PER_DAY
export const PROPOSAL_FEE_PXS = 10;                     // flat listing fee, in PXS
export const PROPOSAL_FEE_INCREASE_PXS_PER_DAY = 1;     // +1 PXS per day beyond the threshold
export const PROPOSAL_FEE_INCREASE_THRESHOLD_DAYS = 60; // days included in the flat fee

const MS_PER_DAY = 86_400_000;

// Payout split selector — applies to ALL posts, not only proposals. Pinned
// to the 60% Authors / 40% Curators split and kept out of sight until the
// payout routing ships; flip to true to surface the field again.
const SHOW_PAYOUT_FIELD = false;

// Hoisted static styles — inline literals here would be re-created on every
// render, and this panel now re-renders per keystroke (the toxicity
// watchers below track the live title/description).
const WHITE_TEXT_STYLE = { color: "#fff" };
const PROPOSAL_LABEL_STYLE = { display: "inline-flex", alignItems: "center", gap: 4 };
const PROPOSAL_FIELDS_STYLE = { display: "flex", flexDirection: "column", gap: 8, marginTop: 8 };
const PIXA_ADORNMENT_STYLE = { margin: "0px 8px -4px 0px", fontSize: "1em" };
const SMALL_INFO_ICON_STYLE = { fontSize: 18 };
const LOCKED_CAPTION_STYLE = { color: "#666", display: "block", marginTop: 4 };
const PROPOSAL_EDIT_FIELDS_STYLE = { display: "flex", flexDirection: "column", gap: 8 };
const PROPOSAL_START_CAPTION_STYLE = { color: "#666" };

// What the selector shows for a portal: its title from the subscription
// row when there is one, else the title the dialog fetched on demand
// (portalTitles — for portals that arrived as a bare id: initialCommunity
// when the account hasn't joined it, an edited post's parent_permlink, a
// draft's saved portal). The raw "portal-NNNNNN" is the last resort, shown
// only while a lookup is in flight or when the portal has no title at all.
const portalLabel = (name, title, portalTitles) =>
    (title && title !== name) ? title : (portalTitles[name] || name);

// Mirror of the wallet's NumberFormatCustom, pinned to PXS so the daily-pay
// input feels identical to Pixagram's wallet UX. (Ported from the retired
// TextEditorDialog.)
function NumberFormatPXS(props) {
    const { inputRef, onChange, ...other } = props;
    return (
        <NumericFormat
            {...other}
            getInputRef={inputRef}
            onValueChange={(values) => {
                onChange({ target: { name: props.name, value: values.value } });
            }}
            thousandSeparator={" "}
            decimalSeparator={"."}
            allowedDecimalSeparators={[",", "."]}
            thousandsGroupStyle={'thousand'}
            decimalScale={3}
            fixedDecimalScale={false}
            allowNegative={false}
            allowLeadingZeros={false}
            suffix={" PXS"}
            prefix={""}
        />
    );
}

// The edit-mode end-date KeyboardDatePicker asks its utils for every name it
// prints. Stock @date-io/date-fns answers from date-fns' built-in English
// locale (no date-fns locale is bundled); this subclass answers from Intl in
// the app language instead, with the same week start and weekday letters as
// DateRangePicker. Numeric formatting and parsing stay date-fns', driven by
// the locale-ordered pattern (dateFnsPattern) passed as `format`.
const PICKER_HEADER_DATE = { weekday: 'short', month: 'short', day: 'numeric' };
const PICKER_MONTH = { month: 'long' };

class LocaleDateFnsUtils extends DateFnsUtils {
    getCalendarHeaderText(date) { return formatMonthYear(date, getLocaleCode()); }

    getDatePickerHeaderText(date) { return formatIntlDate(date, getLocaleCode(), PICKER_HEADER_DATE); }

    getMonthText(date) { return formatIntlDate(date, getLocaleCode(), PICKER_MONTH); }

    getWeekdays() { return weekdayHeaders(getLocaleCode()); }

    // Same rows as the stock version, but each week starts on the locale's
    // first day instead of date-fns' en-US Sunday.
    getWeekArray(date) {
        const weekStartsOn = firstDayOfWeek(getLocaleCode());
        const first = this.startOfMonth(date);
        const last = this.endOfMonth(date);
        const end = this.addDays(last, (weekStartsOn + 6 - last.getDay() + 7) % 7);
        let current = this.addDays(first, -((first.getDay() - weekStartsOn + 7) % 7));
        const weeks = [];
        for (let count = 0; this.isBefore(current, end); count++) {
            const week = Math.floor(count / 7);
            (weeks[week] || (weeks[week] = [])).push(current);
            current = this.addDays(current, 1);
        }
        return weeks;
    }
}

// Amounts in the user's number format ("1 234,500" in fr-CH), fixed decimals.
const formatFixed = (value, decimals) => value.toLocaleString(getLocaleCode(), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
});

export const settingsPanelStyles = (theme) => ({
    settingsPanel: {
        width: 360,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "transparent",
        overflow: "auto",
        [theme.breakpoints.down("sm")]: {
            width: "100%"
        }
    },
    settingsContent: {
        padding: "0px 24px",
        flex: 1,
        overflow: "auto",
        [theme.breakpoints.down("sm")]: {
            padding: "24px",
        }
    },
    settingsActions: {
        padding: theme.spacing(2, 3),
        display: "flex",
        justifyContent: "space-between",
    },
    settingsSection: {
        marginBottom: theme.spacing(3)
    },
    subTitle2: {
        color: "#ccc",
        fontSize: "1rem",
        "& button.MuiIconButton-root": {
            color: "#666"
        }
    },
    // Greyscale error state for the proposal fields — MUI's default red
    // (#f44336) was the only colored thing in the panel and clashed with
    // the monochrome UI. An invalid field brightens to solid white and the
    // helper line turns italic light-grey instead.
    proposalField: {
        "& .MuiFormLabel-root.Mui-error": {
            color: "#ffffff"
        },
        "& .MuiFormHelperText-root.Mui-error": {
            color: "#bbbbbb",
            fontStyle: "italic"
        },
        "& .MuiOutlinedInput-root.Mui-error .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(255,255,255,0.85)"
        },
        "& .MuiInput-underline.Mui-error:after": {
            borderBottomColor: "#ffffff"
        }
    },
    // Cost summary under the proposal fields: duration, payouts and the
    // listing fee in PXS with the local-currency conversion underneath —
    // the same two-line stack PaperCardActions and the wallet use.
    proposalSummary: {
        marginTop: 4,
        padding: "12px 14px",
        borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.04)",
        display: "flex",
        flexDirection: "column",
        gap: 8
    },
    proposalSummaryRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12
    },
    proposalSummaryLabel: {
        color: "#888",
        fontSize: "0.8rem",
        whiteSpace: "nowrap",
        display: "inline-flex",
        alignItems: "center",
        gap: 2
    },
    proposalSummaryValue: {
        color: "#fff",
        fontSize: "0.85rem",
        textAlign: "right",
        lineHeight: 1.35
    },
    proposalSummaryFiat: {
        display: "block",
        color: "#999",
        fontSize: "0.72rem",
        fontWeight: 400
    },
    proposalSummaryFeeRow: {
        paddingTop: 8,
        borderTop: "1px solid rgba(255,255,255,0.08)"
    },
});

// ── Proposal cost summary ────────────────────────────────────────────────
// Duration, daily payout, total payout and the listing fee, each shown in
// PXS with the user's display currency underneath (witness-feed PXS/USD ×
// USD→currency rate — the exact conversion PaperCardActions and the wallet
// use, including the 5.69 design fallback). The fee row only renders in
// create mode: the chain charges it once, on create_proposal.
const ProposalCostSummary = React.memo(({
                                            classes,
                                            startDate,
                                            endDate,
                                            dailyPay,
                                            showFee,
                                            pxsUsdPrice,
                                            currency,
                                            fiatRate
                                        }) => {
    useLanguage();
    const start = startDate ? (startDate instanceof Date ? startDate : new Date(startDate)) : null;
    const end = endDate ? (endDate instanceof Date ? endDate : new Date(endDate)) : null;
    const validDates = !!(start && end && !isNaN(start.getTime()) && !isNaN(end.getTime())
        && end.getTime() > start.getTime());
    // Whole days, rounded — the pickers are date-granular so both ends share
    // the same time of day; the only fractional part is a DST hour.
    const durationDays = validDates
        ? Math.max(1, Math.round((end.getTime() - start.getTime()) / MS_PER_DAY))
        : null;

    const daily = Number(dailyPay);
    const validDaily = Number.isFinite(daily) && daily > 0;

    // Same guards + design fallback as PaperCardActions / PixaWalletDialog.
    const cur = currency || 'USD';
    const rate = (Number.isFinite(fiatRate) && fiatRate > 0) ? fiatRate : 1;
    const pxsRate = (Number.isFinite(pxsUsdPrice) && pxsUsdPrice > 0) ? pxsUsdPrice : 5.69;

    const extraDays = durationDays != null
        ? Math.max(0, durationDays - PROPOSAL_FEE_INCREASE_THRESHOLD_DAYS)
        : null;
    const totalFee = durationDays != null
        ? PROPOSAL_FEE_PXS + extraDays * PROPOSAL_FEE_INCREASE_PXS_PER_DAY
        : null;
    const totalPayout = (durationDays != null && validDaily) ? daily * durationDays : null;

    const pxsAndFiat = (v, decimals) => (
        <React.Fragment>
            {formatFixed(v, decimals)} PXS
            <span className={classes.proposalSummaryFiat}>
                ≈ {formatFixed(v * pxsRate * rate, 2)} {cur}
            </span>
        </React.Fragment>
    );

    return (
        <div className={classes.proposalSummary}>
            <div className={classes.proposalSummaryRow}>
                <span className={classes.proposalSummaryLabel}>{t("components.settings_panel.duration")}</span>
                <span className={classes.proposalSummaryValue + " monospace"}>
                    {durationDays != null ? t("components.settings_panel.day_count", { day: { day: durationDays } }) : '—'}
                </span>
            </div>
            <div className={classes.proposalSummaryRow}>
                <span className={classes.proposalSummaryLabel}>{t("components.settings_panel.daily_payout")}</span>
                <span className={classes.proposalSummaryValue + " monospace"}>
                    {validDaily ? pxsAndFiat(daily, 3) : '—'}
                </span>
            </div>
            <div className={classes.proposalSummaryRow}>
                <span className={classes.proposalSummaryLabel}>{t("components.settings_panel.total_payout")}</span>
                <span className={classes.proposalSummaryValue + " monospace"}>
                    {totalPayout != null ? pxsAndFiat(totalPayout, 3) : '—'}
                </span>
            </div>
            {showFee && (
                <div className={classes.proposalSummaryRow + " " + classes.proposalSummaryFeeRow}>
                    <span className={classes.proposalSummaryLabel}>
                        {t("components.settings_panel.total_fee")}
                        <Tooltip interactive
                                 enterTouchDelay={200}
                                 leaveTouchDelay={4000}
                                 classes={{ tooltip: classes.tooltipRoot }}
                                 title={
                                     // One sentence, one key. Its {{text}} slot is
                                     // the space after "plus" (the key predates this
                                     // file and is translated in every locale as is).
                                     <span className={classes.tooltip}>
                                         {t("components.settings_panel.submitting_a_proposal_costs_pxs_plus_pxs", {
                                             PROPOSAL_FEE_PXS,
                                             text: ' ',
                                             PROPOSAL_FEE_INCREASE_PXS_PER_DAY,
                                             PROPOSAL_FEE_INCREASE_THRESHOLD_DAYS
                                         })}
                                     </span>
                                 }>
                            <IconButton size="small"><InfoOutlined style={SMALL_INFO_ICON_STYLE}/></IconButton>
                        </Tooltip>
                    </span>
                    <span className={classes.proposalSummaryValue + " monospace"}>
                        {totalFee != null ? pxsAndFiat(totalFee, 0) : '—'}
                    </span>
                </div>
            )}
        </div>
    );
});

// Receives PRIMITIVES (tab) + stable handlers and renders ActionButtons
// itself on desktop. It used to receive a pre-built `actionButtons` element
// from the parent instead — a fresh element identity on every parent render
// (every keystroke), which permanently defeated this memo.
const SettingsPanel = React.memo(({
                                      classes,
                                      api,
                                      gradient,
                                      payout,
                                      community,
                                      communities = [],
                                      portalTitles = {},
                                      communityLocked,
                                      activeAccount,
                                      title,
                                      description,
                                      onRemoveImage,
                                      onOpenGradientEditor,
                                      onPayoutChange,
                                      onCommunityChange,
                                      // ── Proposal props (ported from the retired TextEditorDialog) ──
                                      isProposalCommunity,
                                      isProposal,
                                      isProposalEdit,
                                      proposalOriginalDailyPay,
                                      proposalStartDate,
                                      proposalEndDate,
                                      proposalDailyPay,
                                      onIsProposalChange,
                                      onProposalStartDateChange,
                                      onProposalEndDateChange,
                                      onProposalDailyPayChange,
                                      editMode,
                                      mobile,
                                      tab,
                                      onOpenDrafts,
                                      onFinish,
                                      onPreview
                                  }) => {
    // memo() + props that never change on a language switch: subscribe.
    useLanguage();
    const localeCode = getLocaleCode();
    // Live PXS/USD (witness feed) + the user's display currency and its
    // USD→currency rate — the same hook PaperCardActions feeds its payout
    // stack with. Re-renders here are cheap: the panel already re-renders
    // per keystroke for the toxicity watchers.
    const { pxsUsdPrice, currency, fiatRate } = usePrices(api);

    return (
        <div className={classes.settingsPanel}>
            <div className={classes.settingsContent}>
                <CoverImageUpload
                    classes={classes}
                    gradient={gradient}
                    onRemoveImage={onRemoveImage}
                    onOpenGradientEditor={onOpenGradientEditor}
                />

                {/* Payout split — applies to ALL posts, not only proposals.
                 The default ("default") is pinned to 60% Authors / 40%
                 Curators; the whole field stays hidden (SHOW_PAYOUT_FIELD)
                 until the payout routing ships. */}
                {SHOW_PAYOUT_FIELD && (
                    <div className={classes.settingsSection}>
                        <Typography variant={"subtitle2"} className={classes.subTitle2}>
                            {t("components.settings_panel.payout")}
                            <Tooltip interactive
                                     enterTouchDelay={200}
                                     leaveTouchDelay={4000}
                                     classes={{ tooltip: classes.tooltipRoot }}
                                     title={<span className={classes.tooltip}>{t("components.settings_panel.you_can_choose_how_the_reward_split")}</span>}>
                                <IconButton><InfoOutlined/></IconButton>
                            </Tooltip>
                        </Typography>
                        <FormControl variant="outlined" fullWidth size="small" disabled>
                            <Select
                                value={payout}
                                onChange={onPayoutChange}
                                style={WHITE_TEXT_STYLE}
                            >
                                <MenuItem value="default">{t("components.settings_panel.60_authors_40_curators")}</MenuItem>
                                <MenuItem value="author">{t("components.settings_panel.100_author")}</MenuItem>
                                <MenuItem value="everyone">50% / 50%</MenuItem>
                                <MenuItem value="curators">{t("components.settings_panel.100_curators")}</MenuItem>
                            </Select>
                        </FormControl>
                    </div>
                )}

                <div className={classes.settingsSection}>
                    <Typography variant={"subtitle2"} className={classes.subTitle2}>
                        {t("components.settings_panel.portal")}
                        <Tooltip interactive
                                 enterTouchDelay={200}
                                 leaveTouchDelay={4000}
                                 classes={{ tooltip: classes.tooltipRoot }}
                                 title={<span className={classes.tooltip}>{t("components.settings_panel.you_can_choose_in_which_community_the")}</span>}>
                            <IconButton><InfoOutlined/></IconButton>
                        </Tooltip>
                    </Typography>
                    <FormControl variant="outlined" fullWidth size="small" disabled={!activeAccount || communityLocked}>
                        <Select
                            value={community}
                            onChange={onCommunityChange}
                            style={WHITE_TEXT_STYLE}
                            displayEmpty
                        >
                            {!activeAccount && (
                                <MenuItem value="" disabled>{t("components.settings_panel.log_in_to_select_a_community")}</MenuItem>
                            )}
                            {/* The selected portal when it isn't among the account's
                            subscriptions — in EVERY mode, not just edit mode as before.
                            Edit mode: the category (parent_permlink) is immutable on
                            HIVE-style chains, so it's a locked single option. Create
                            mode: a draft's saved portal, or a re-open's initialCommunity,
                            may be one the account never joined or has since left; without
                            this item the Select had a value with no option and rendered
                            blank. Titled like every other item. */}
                            {community && !communities.some(c => c.name === community) && (
                                <MenuItem key={community} value={community}>
                                    {portalLabel(community, '', portalTitles)}
                                </MenuItem>
                            )}
                            {communities.map((c) => (
                                <MenuItem key={c.name} value={c.name}>
                                    {portalLabel(c.name, c.title, portalTitles)}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    {communityLocked && (
                        <Typography variant="caption" style={LOCKED_CAPTION_STYLE}>
                            {t("components.settings_panel.the_community_of_an_existing_post_cannot")}
                        </Typography>
                    )}
                </div>

                {/* ── Proposal section — fades in when the selected community
                 is the dedicated proposals community. The properties below
                 the checkbox collapse/expand as it's toggled. ── */}
                <Fade in={!!isProposalCommunity} mountOnEnter unmountOnExit timeout={220}>
                    <div className={classes.settingsSection}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={!!isProposal}
                                    onChange={(e) => onIsProposalChange(e.target.checked)}
                                    color="default"
                                />
                            }
                            label={
                                <span style={PROPOSAL_LABEL_STYLE}>
                                    {t("components.settings_panel.this_is_a_proposal")}
                                    <Tooltip interactive
                                             enterTouchDelay={200}
                                             leaveTouchDelay={4000}
                                             classes={{ tooltip: classes.tooltipRoot }}
                                             title={
                                                 <span className={classes.tooltip}>
                                                     {t("components.settings_panel.when_checked_publishing_will_also_submit_an")}
                                                 </span>
                                             }>
                                        <IconButton size="small"><InfoOutlined style={SMALL_INFO_ICON_STYLE}/></IconButton>
                                    </Tooltip>
                                </span>
                            }
                        />

                        <Collapse in={!!isProposal} timeout="auto" unmountOnExit>
                            <div style={PROPOSAL_FIELDS_STYLE}>
                                {/* One MUI-X-style range picker replaces the old
                                 separate start/end KeyboardDatePickers. Both
                                 endpoints commit together on OK. */}
                                <DateRangePicker
                                    id="proposal-date-range"
                                    className={classes.proposalField}
                                    label={t("components.settings_panel.start_end")}
                                    startDate={proposalStartDate}
                                    endDate={proposalEndDate}
                                    onChangeStart={onProposalStartDateChange}
                                    onChangeEnd={onProposalEndDateChange}
                                    disablePast
                                />
                                <TextField
                                    className={classes.proposalField}
                                    margin="dense"
                                    variant="outlined"
                                    fullWidth
                                    label={t("components.settings_panel.daily_pay")}
                                    value={proposalDailyPay}
                                    onChange={(e) => onProposalDailyPayChange(e.target.value)}
                                    InputProps={{
                                        inputComponent: NumberFormatPXS,
                                        startAdornment: (
                                            <PixaSupra style={PIXA_ADORNMENT_STYLE}/>
                                        )
                                    }}
                                    helperText={t("components.settings_panel.amount_disbursed_per_day_in_pxs")}
                                />
                                <ProposalCostSummary
                                    classes={classes}
                                    startDate={proposalStartDate}
                                    endDate={proposalEndDate}
                                    dailyPay={proposalDailyPay}
                                    showFee
                                    pxsUsdPrice={pxsUsdPrice}
                                    currency={currency}
                                    fiatRate={fiatRate}
                                />
                            </div>
                        </Collapse>
                    </div>
                </Fade>

                {/* ── Proposal EDIT section — shown when the post being edited is
                 itself a DAO proposal. update_proposal only lets us change the
                 payout (which the chain only allows LOWERING) and the end date;
                 start date and receiver are fixed once a proposal exists, so
                 they're surfaced read-only for context. ── */}
                {isProposalEdit && (
                    <div className={classes.settingsSection}>
                        <Typography variant={"subtitle2"} className={classes.subTitle2}>
                            {t("components.settings_panel.proposal")}
                            <Tooltip interactive
                                     enterTouchDelay={200}
                                     leaveTouchDelay={4000}
                                     classes={{ tooltip: classes.tooltipRoot }}
                                     title={
                                         <span className={classes.tooltip}>
                                             {t("components.settings_panel.this_post_is_a_dao_proposal_saving")}
                                         </span>
                                     }>
                                <IconButton><InfoOutlined/></IconButton>
                            </Tooltip>
                        </Typography>
                        <MuiPickersUtilsProvider utils={LocaleDateFnsUtils}>
                            <div style={PROPOSAL_EDIT_FIELDS_STYLE}>
                                {proposalStartDate && (
                                    <Typography variant="caption" style={PROPOSAL_START_CAPTION_STYLE}>
                                        {t("components.settings_panel.started_start_date_is_fixed", {
                                            proposalStartDate: proposalStartDate.toLocaleDateString(localeCode)
                                        })}
                                    </Typography>
                                )}
                                {/* Typed in the locale's numeric order (dd.MM.yyyy,
                                 yyyy/MM/dd…): the same pattern formats, parses
                                 and — letters become digit slots — masks it. */}
                                <KeyboardDatePicker
                                    className={classes.proposalField}
                                    margin="dense"
                                    inputVariant="outlined"
                                    id="proposal-edit-end-date"
                                    label={t("components.settings_panel.end_date")}
                                    format={dateFnsPattern(localeCode)}
                                    fullWidth
                                    minDate={proposalStartDate || undefined}
                                    value={proposalEndDate}
                                    onChange={onProposalEndDateChange}
                                    invalidDateMessage={t("components.settings_panel.invalid_date_format")}
                                    minDateMessage={t("components.settings_panel.the_end_date_cant_be_before_the_start_date")}
                                    maxDateMessage={t("components.settings_panel.date_is_too_far_in_the_future")}
                                    okLabel={t("components.settings_panel.ok")}
                                    cancelLabel={t("words.cancel")}
                                    KeyboardButtonProps={{ 'aria-label': t("components.settings_panel.change_end_date") }}
                                />
                                <TextField
                                    className={classes.proposalField}
                                    margin="dense"
                                    variant="outlined"
                                    fullWidth
                                    label={t("components.settings_panel.daily_pay")}
                                    value={proposalDailyPay}
                                    onChange={(e) => onProposalDailyPayChange(e.target.value)}
                                    InputProps={{
                                        inputComponent: NumberFormatPXS,
                                        startAdornment: (
                                            <PixaSupra style={PIXA_ADORNMENT_STYLE}/>
                                        )
                                    }}
                                    helperText={
                                        proposalOriginalDailyPay
                                            ? t("components.settings_panel.currently_pxs_day_can_only_be_lowered", {
                                                proposalOriginalDailyPay: Number.isFinite(Number(proposalOriginalDailyPay))
                                                    ? Number(proposalOriginalDailyPay).toLocaleString(localeCode, { maximumFractionDigits: 3 })
                                                    : proposalOriginalDailyPay
                                            })
                                            : t("components.settings_panel.amount_disbursed_per_day_in_pxs_can_only_be")
                                    }
                                />
                                {/* Listing fee omitted here on purpose — it was
                                 charged once, when the proposal was created. */}
                                <ProposalCostSummary
                                    classes={classes}
                                    startDate={proposalStartDate}
                                    endDate={proposalEndDate}
                                    dailyPay={proposalDailyPay}
                                    showFee={false}
                                    pxsUsdPrice={pxsUsdPrice}
                                    currency={currency}
                                    fiatRate={fiatRate}
                                />
                            </div>
                        </MuiPickersUtilsProvider>
                    </div>
                )}

                {/* Toxicity disclaimers — the offline model's verdict on the
                title and short description, placed below the proposal
                section per spec. */}
                <div className={classes.settingsSection}>
                    <ToxicityWatcher text={title} label="title" />
                    <ToxicityWatcher text={description} label={t("components.settings_panel.short_description")} />
                </div>
            </div>
            {!mobile && (
                <ActionButtons
                    mobile={false}
                    tab={tab}
                    editMode={editMode}
                    onOpenDrafts={onOpenDrafts}
                    onFinish={onFinish}
                    onPreview={onPreview}
                />
            )}
        </div>
    );
});

export default SettingsPanel;