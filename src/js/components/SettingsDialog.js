import React, { memo, useState, useEffect, useMemo, useCallback, useRef } from "react";

import { t, setLanguage, useLanguage } from "../utils/text";
import { safeHTML } from "../utils/api/sanitizer";
import makeStyles from "@material-ui/core/styles/makeStyles";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogActions from "@material-ui/core/DialogActions";
import Typography from "@material-ui/core/Typography";
import Divider from "@material-ui/core/Divider";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import CloseIcon from "@material-ui/icons/Close";
import CheckIcon from "@material-ui/icons/Check";
import ClearIcon from "@material-ui/icons/Clear";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import Radio from "@material-ui/core/Radio";
import RadioGroup from "@material-ui/core/RadioGroup";
import Autocomplete from "@material-ui/lab/Autocomplete";
import Slider from "@material-ui/core/Slider";

import { CURRENCIES, DEFAULT_NODES, CUSTOM_API_NODE_ID } from "../utils/constants";
import { describe as describe_locale, STATUS } from "../utils/locale-status";
import LOCALES from "../utils/constant_locales";
import get_svg_in_b64 from "../utils/svgToBase64";

import * as api from "../utils/settings";
import * as actions from "../actions/utils";
import fuzzy from "fuzzy";

import Globe from "./Globe";


const useStyles = makeStyles({
    subTitle: {
        margin: "24px 0px 12px 0px"
    },
    // ── Language row ────────────────────────────────────────────────────────
    // The flag is one asset rendered in colour; `filter` in the inline style
    // desaturates it when the locale is not served. Keeping it to a filter
    // means the three states differ by one CSS property, not three sprites.
    localeRow: {
        display: "flex",
        alignItems: "center",
        width: "100%",
        minWidth: 0
    },
    localeFlag: {
        marginRight: 8,
        height: 24,
        width: 24,
        flex: "0 0 auto",
        verticalAlign: "middle",
        transition: "filter 120ms ease"
    },
    localeName: {
        flex: "1 1 auto",
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
    },
    // The caveat sits inline after the name rather than replacing it, so the
    // row still answers "which language is this?" first.
    localeNote: {
        marginLeft: 8,
        fontSize: 11,
        fontStyle: "italic",
        opacity: 0.9
    },
    localeCoverage: {
        flex: "0 0 auto",
        marginLeft: 12,
        fontSize: 11,
        fontVariantNumeric: "tabular-nums",
        color: "#9d9d9d"
    },
    localeFallback: {
        flex: "0 0 auto",
        marginLeft: 12,
        fontSize: 11,
        color: "#6d6d6d"
    },
    dialogContent: {
        margin: "12px 0px 24px 0px"
    },
    slider: {
        margin: "16px 16px 32px 16px",
        width: "calc(100% - 32px)",
        "& .MuiSlider-valueLabel": {
            color: "#fff"
        },
        "& .MuiSlider-valueLabel > span > span": {
            color: "#000"
        },
        "& .MuiSlider-thumb": {
            boxShadow: "0px 0px 0px 14px rgb(255 255 255 / 16%)"
        },
        "& .MuiSlider-active.MuiSlider-thumb": {
            boxShadow: "0px 0px 0px 14px rgb(255 255 255 / 24%)"
        }
    },
    switch: {
        margin: "16px 0px 8px 0px",
        width: "100%",
        textAlign: "right"
    }
});

const VOTING_MARKS = [
    { value: 0, label: "0%" },
    { value: 25, label: "25%" },
    { value: 50, label: "50%" },
    { value: 75, label: "75%" },
    { value: 100, label: "100%" }
];

// Pure helpers — no dependency on component state, so they live at module scope.
const nsfwSwitchLabel = (title, subtitle) => (
    <span style={{ display: "block", textAlign: "right", lineHeight: 1.3 }}>
        <span style={{ display: "block" }}>{title}</span>
        <span style={{ display: "block", fontSize: 12, color: "#9d9d9d", marginTop: 2 }}>{subtitle}</span>
    </span>
);

const fuzzyFilterLocales = (list, input_value) => {
    const options = {
        pre: "<b style=\"color: #ffffff;\">",
        post: "</b>",
        extract: (element) => element.name
    };

    return fuzzy.filter(input_value.inputValue, list, options);
};

// Match on either the ISO code or the currency name, so "CHF" and "Swiss"
// both find the Swiss Franc. Mirrors fuzzyFilterLocales' wrapping contract
// (returns { string, original, ... } objects).
const fuzzyFilterCurrencies = (list, input_value) => {
    const options = {
        pre: "<b style=\"color: #ffffff;\">",
        post: "</b>",
        extract: (element) => `${element.code} — ${element.name}`
    };

    return fuzzy.filter(input_value.inputValue, list, options);
};

const SettingsDialog = (props) => {
    useLanguage();

    const classes = useStyles();
    const { open, onClose, keepMounted = false } = props;

    // The settings "bag" mirrors props.settings (which already uses the _-prefixed keys).
    // _language is local-only and initialised from the document, never read in render.
    const [settings, setSettings] = useState(() => ({
        _language: document.documentElement.lang,
        ...props.settings
    }));
    const [_18_open, set_18_open] = useState(false);

    // Display currency is read straight from the settings cache (the same store
    // the wallet/usePrices read), not from props.settings — the parent's bag
    // doesn't carry it. Kept live via subscription so the control reflects the
    // real value the moment it changes, and survives the post-save re-sync.
    const [currencyCode, setCurrencyCode] = useState(() => api.get_cached_settings().currency || "USD");

    useEffect(() => {
        const unsub = api.subscribe((s) => {
            if (s && s.currency) setCurrencyCode(s.currency);
        });
        return unsub;
    }, []);

    // Draft text for the custom-endpoint field. Kept separate from `settings`
    // so typing doesn't persist on every keystroke — it's only saved on blur
    // or Enter (see _handle_custom_url_commit).
    const [customUrlDraft, setCustomUrlDraft] = useState(() => props.settings.api_node_custom_url || "");
    const [customUrlError, setCustomUrlError] = useState(false);

    // Mount-only side effects (was componentWillMount). Runs after first paint,
    // which is the correct time to signal "page render complete".
    useEffect(() => {
        actions.trigger_loading_update(0);
        actions.trigger_page_render_complete();
        const id = setTimeout(() => actions.trigger_loading_update(100), 300);
        return () => clearTimeout(id);
    }, []);

    // Re-sync local settings when the parent pushes a new settings object
    // (was componentWillReceiveProps). Skipped on the initial mount to match
    // the old lifecycle, which only fired on updates.
    const mounted = useRef(false);
    useEffect(() => {
        if (!mounted.current) {
            mounted.current = true;
            return;
        }
        setSettings(prev => ({ ...prev, ...props.settings }));
    }, [props.settings]);

    const _on_settings_changed = useCallback(() => {
        actions.trigger_loading_update(0);
        setTimeout(() => actions.trigger_loading_update(100), 250);
        actions.trigger_settings_update();
    }, []);

    const _handle_locales_changed = useCallback((event, value) => {
        if (value) {
            const code = value.original.code || "en-US";
            setSettings(prev => ({
                ...prev,
                _selected_locales_code: code,
                _language: code.split("-")[0]
            }));
            api.set_settings({ locales: code }, _on_settings_changed);

            // Persisting the preference is not the same as applying it. This
            // call is what actually loads locales/<lang>.js, swaps the active
            // bundle, sets <html lang>/<html dir>, clears the render cache and
            // notifies every subscriber. Without it the setting was written to
            // storage and the UI stayed in whatever language it started in.
            setLanguage(code);

            actions.trigger_sfx("ui_lock");
        }
    }, [_on_settings_changed]);

    const _handle_currency_changed = useCallback((event, value) => {
        if (value && value.original) {
            const code = value.original.code || "USD";
            setCurrencyCode(code);                                       // instant, optimistic
            api.set_settings({ currency: code }, _on_settings_changed);  // persist + emit to cache
            actions.trigger_sfx("ui_lock");
        }
    }, [_on_settings_changed]);

    const _handle_nsfw_enabled_switch_change = useCallback(() => {
        if (settings._nsfw_enabled) {
            actions.trigger_sfx("ui_lock");
            setSettings(prev => ({ ...prev, _nsfw_enabled: false }));
            api.set_settings({ nsfw_enabled: false }, _on_settings_changed);
        } else {
            set_18_open(true);
        }
    }, [settings._nsfw_enabled, _on_settings_changed]);

    const _handle_nsfw_filter_switch_change = useCallback(() => {
        actions.trigger_sfx("ui_lock");
        // _nsfw_filter: true = filtering ON (NSFW hidden from feed); false = shown.
        const newFilter = !(settings._nsfw_filter === true);
        setSettings(prev => ({ ...prev, _nsfw_filter: newFilter }));
        api.set_settings({ nsfw_filter: newFilter }, _on_settings_changed);
    }, [settings._nsfw_filter, _on_settings_changed]);

    const _handle_toxicity_enabled_switch_change = useCallback(() => {
        actions.trigger_sfx("ui_lock");
        const next = !(settings._toxicity_enabled !== false); // default ON
        setSettings(prev => ({ ...prev, _toxicity_enabled: next }));
        api.set_settings({ toxicity_enabled: next }, _on_settings_changed);
    }, [settings._toxicity_enabled, _on_settings_changed]);

    const _handle_askvote_enabled_switch_change = useCallback(() => {
        actions.trigger_sfx("ui_lock");
        const next = !settings._askvote;
        setSettings(prev => ({ ...prev, _askvote: next }));
        api.set_settings({ askvote: next }, _on_settings_changed);
    }, [settings._askvote, _on_settings_changed]);

    const _handle_cpu_enabled_switch_change = useCallback(() => {
        if (("" + settings._mode).toUpperCase() === "GPU") {
            actions.trigger_sfx("ui_lock");
            setSettings(prev => ({ ...prev, _mode: "CPU" }));
            api.set_settings({ mode: "CPU" }, _on_settings_changed);
        } else {
            setSettings(prev => ({ ...prev, _mode: "GPU" }));
            api.set_settings({ mode: "GPU" }, _on_settings_changed);
        }
    }, [settings._mode, _on_settings_changed]);

    const _on18_accept = useCallback(() => {
        if (!settings._nsfw_enabled) {
            actions.trigger_sfx("ui_lock");
            setSettings(prev => ({ ...prev, _nsfw_enabled: true }));
            set_18_open(false);
            api.set_settings({ nsfw_enabled: true }, _on_settings_changed);
        }
    }, [settings._nsfw_enabled, _on_settings_changed]);

    const _handle_renderer_switch_change = useCallback((v) => {
        setSettings(prev => ({ ...prev, _renderer: v }));
        api.set_settings({ renderer: v }, _on_settings_changed);
    }, [_on_settings_changed]);

    const _handle_format_switch_change = useCallback((v) => {
        setSettings(prev => ({ ...prev, _format: v }));
        api.set_settings({ format: v }, _on_settings_changed);
    }, [_on_settings_changed]);

    const _handle_payout_switch_change = useCallback((v) => {
        setSettings(prev => ({ ...prev, _payout: v }));
        api.set_settings({ payout: v }, _on_settings_changed);
    }, [_on_settings_changed]);

    const _handle_voting_percent_change = useCallback((event, v) => {
        setSettings(prev => ({ ...prev, _voting: v }));
        api.set_settings({ voting: v }, _on_settings_changed);
    }, [_on_settings_changed]);

    const _handle_pdf_page_size_change = useCallback((v) => {
        setSettings(prev => ({ ...prev, _pdf_page_size: v }));
        api.set_settings({ pdf_page_size: v }, _on_settings_changed);
    }, [_on_settings_changed]);

    const _handle_api_node_change = useCallback((nodeId) => {
        actions.trigger_sfx("ui_lock");
        setSettings(prev => ({ ...prev, _api_node: nodeId }));
        api.set_settings({ api_node: nodeId }, _on_settings_changed);
    }, [_on_settings_changed]);

    const _handle_custom_url_change = useCallback((event) => {
        setCustomUrlDraft(event.target.value);
        if (customUrlError) setCustomUrlError(false);
    }, [customUrlError]);

    const _handle_custom_url_commit = useCallback(() => {
        const url = (customUrlDraft || "").trim();
        if (!url) return;
        try {
            // eslint-disable-next-line no-new
            new URL(url);
        } catch (e) {
            setCustomUrlError(true);
            return;
        }
        actions.trigger_sfx("ui_lock");
        setSettings(prev => ({ ...prev, _api_node: CUSTOM_API_NODE_ID, _api_node_custom_url: url }));
        api.set_settings({ api_node: CUSTOM_API_NODE_ID, api_node_custom_url: url }, _on_settings_changed);
    }, [customUrlDraft, _on_settings_changed]);

    const _handle_custom_url_key_down = useCallback((event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            _handle_custom_url_commit();
            event.target.blur();
        }
    }, [_handle_custom_url_commit]);

    const _handle_custom_url_reset = useCallback(() => {
        actions.trigger_sfx("ui_lock");
        setCustomUrlDraft("");
        setCustomUrlError(false);
        const fallbackNodeId = DEFAULT_NODES[0].id;
        setSettings(prev => ({ ...prev, _api_node: fallbackNodeId, _api_node_custom_url: "" }));
        api.set_settings({ api_node: fallbackNodeId, api_node_custom_url: "" }, _on_settings_changed);
    }, [_on_settings_changed]);

    const _on18_close = useCallback(() => set_18_open(false), []);

    const {
        _voting,
        _payout,
        _format,
        _askvote,
        _nsfw_enabled,
        _nsfw_filter,
        _toxicity_enabled,
        _renderer,
        _mode,
        _pdf_page_size,
        _selected_locales_code,
        _api_node,
        _api_node_custom_url
    } = settings;

    const locales = useMemo(
        () => LOCALES.find(l => l.code === _selected_locales_code) || LOCALES[0],
        [_selected_locales_code]
    );

    // Selected currency object for the Autocomplete, resolved from the live
    // currencyCode (settings-cache backed). Default USD if the code is unknown.
    const currency = useMemo(
        () => CURRENCIES.find(c => c.code === currencyCode)
            || CURRENCIES.find(c => c.code === "USD")
            || CURRENCIES[0],
        [currencyCode]
    );

    return (
        <>
            <Dialog open={open}
                    fullWidth={true}
                    disablePortal={true}
                    onClose={onClose}
                    keepMounted={false}>
                <DialogTitle style={{display: "flex", alignItems: "center", margin: "0px 0px 0px 0px", paddingBottom: 0}}>
                    <Typography component={"h1"} variant={"h4"} style={{flex: 1, margin: "0px"}}>{t("words.settings")}</Typography>
                    <IconButton onClick={onClose} style={{ marginRight: -8, right: 24, position: "absolute", top: 16}}><CloseIcon /></IconButton>
                </DialogTitle>
                <DialogContent className={classes.dialogContent}>
                    <Typography component={"h2"} variant={"h6"} className={classes.subTitle}>{t("components.settings_dialog.languages")}</Typography>
                    <Autocomplete
                        fullWidth
                        value={locales}
                        filterOptions={fuzzyFilterLocales}
                        onChange={_handle_locales_changed}
                        id="locales-autocomplete"
                        options={LOCALES}
                        getOptionLabel={(option) => option.name || option.original.name}
                        renderOption={(option) => {
                            // One call decides the whole row: whether the flag is
                            // in colour, how the name reads, and whether there is
                            // a caveat worth showing. See utils/locale-status.js.
                            const L = describe_locale(option.original.code);
                            return (
                                <div className={classes.localeRow}>
                                    <img
                                        alt=""
                                        src={get_svg_in_b64(option.original.svg, false)}
                                        className={classes.localeFlag}
                                        style={{filter: L.flag}}
                                    />
                                    <span className={classes.localeName} style={{color: L.text}}>
                                        <span dangerouslySetInnerHTML={{ __html: safeHTML(option.string) }} />
                                        {L.note ? (
                                            <span className={classes.localeNote} style={{color: L.note}}>
                                                {L.note}
                                            </span>
                                        ) : null}
                                    </span>
                                    {L.live ? (
                                        <span
                                            className={classes.localeCoverage}
                                            title={L.status === STATUS.VARIANT ? L.note : undefined}
                                        >
                                            {Math.round(L.coverage * 100)}%
                                        </span>
                                    ) : (
                                        <span className={classes.localeFallback}>
                                            {t("components.settings_dialog.falls_back_to_english")}
                                        </span>
                                    )}
                                </div>
                            );
                        }}
                        renderInput={(params) => <TextField {...params} label={t( "words.locales", {FLC: true})} margin="normal" />}
                    />
                    <Typography component={"h2"} variant={"h6"} className={classes.subTitle}>{t("components.settings_dialog.currency")}</Typography>
                    <Autocomplete
                        fullWidth
                        value={currency}
                        filterOptions={fuzzyFilterCurrencies}
                        onChange={_handle_currency_changed}
                        id="currency-autocomplete"
                        options={CURRENCIES}
                        disableClearable
                        getOptionLabel={(option) =>
                            option.original
                                ? `${option.original.code} — ${option.original.name}`
                                : `${option.code} — ${option.name}`
                        }
                        renderOption={(option) =>
                            <div>
                                <span style={{display: "inline-block", minWidth: 36, marginRight: 8, textAlign: "center", color: "#ffffff", fontWeight: 600}}>
                                    {option.original.symbol}
                                </span>
                                <span dangerouslySetInnerHTML={{ __html: safeHTML(option.string) }} />
                            </div>
                        }
                        renderInput={(params) => <TextField {...params} label={t("components.settings_dialog.currency")} margin="normal" />}
                    />
                    <Typography component={"h2"} variant={"h6"} className={classes.subTitle}>{t("components.settings_dialog.rendering_engine")}</Typography>
                    <RadioGroup row name="rendering-engine-selection" value={_renderer}>
                        <FormControlLabel
                            value="square"
                            control={<Radio color="primary" />}
                            label={t("components.settings_dialog.square")}
                            labelPlacement="bottom"
                            onClick={() => _handle_renderer_switch_change("square")}
                        />
                        <FormControlLabel
                            value="hexagon"
                            control={<Radio color="primary" />}
                            label={t("components.settings_dialog.hexagon")}
                            labelPlacement="bottom"
                            onClick={() => _handle_renderer_switch_change("hexagon")}
                        />
                        <FormControlLabel
                            value="crt"
                            control={<Radio color="primary" />}
                            label={t("components.settings_dialog.retro")}
                            labelPlacement="bottom"
                            onClick={() => _handle_renderer_switch_change("crt")}
                        />
                        <FormControlLabel
                            value="xbrz"
                            control={<Radio color="primary" />}
                            label={t("components.settings_dialog.painting")}
                            labelPlacement="bottom"
                            onClick={() => _handle_renderer_switch_change("xbrz")}
                        />
                        {
                            /**<FormControlLabel
                            value="tri"
                            control={<Radio color="primary" />}
                            label={t("components.settings_dialog.painting_fast")}
                            labelPlacement="bottom"
                            onClick={() => _handle_renderer_switch_change("tri")}**/
                        }
                    </RadioGroup>
                    <FormControlLabel
                        value={"Enable CPU"}
                        className={classes.switch}
                        control={<Switch checked={_mode === "CPU"} onChange={_handle_cpu_enabled_switch_change} color="primary" />}
                        label={t("components.settings_dialog.disable_gpu_optimization")}
                        labelPlacement="start"
                    />
                    <Typography component={"h2"} variant={"h6"} className={classes.subTitle}>{t("components.settings_dialog.download_file_format")}</Typography>
                    <RadioGroup row name="file-format-selection" value={_format}>
                        <FormControlLabel
                            value="png"
                            control={<Radio color="primary" />}
                            label="PNG"
                            labelPlacement="bottom"
                            onClick={() => _handle_format_switch_change("png")}
                        />
                        <FormControlLabel
                            value="webp"
                            control={<Radio color="primary" />}
                            label={t("components.settings_dialog.webp")}
                            labelPlacement="bottom"
                            onClick={() => _handle_format_switch_change("webp")}
                        />
                        <FormControlLabel
                            value="jpeg"
                            control={<Radio color="primary" />}
                            label="JPEG"
                            labelPlacement="bottom"
                            onClick={() => _handle_format_switch_change("jpeg")}
                        />
                    </RadioGroup>
                    <Typography component={"h2"} variant={"h6"} className={classes.subTitle}>{t("components.settings_dialog.pdf_default_page_size")}</Typography>
                    <RadioGroup row name="pdf-page-size-selection" value={_pdf_page_size || "A4"}>
                        <FormControlLabel
                            value="A4"
                            control={<Radio color="primary" />}
                            label="A4"
                            labelPlacement="bottom"
                            onClick={() => _handle_pdf_page_size_change("A4")}
                        />
                        <FormControlLabel
                            value="US Letter"
                            control={<Radio color="primary" />}
                            label={t("components.settings_dialog.us_letter")}
                            labelPlacement="bottom"
                            onClick={() => _handle_pdf_page_size_change("US Letter")}
                        />
                    </RadioGroup>
                    <Typography component={"h2"} variant={"h6"} className={classes.subTitle}>{t("components.settings_dialog.sensible_content")}</Typography>
                    <FormControlLabel
                        className={classes.switch}
                        value={"nsfw_filter"}
                        control={<Switch checked={!_nsfw_filter} onChange={_handle_nsfw_filter_switch_change} color="primary" />}
                        label={nsfwSwitchLabel(
                            t("components.settings_dialog.dont_filter_nsfw_content"),
                            _nsfw_filter ? t("components.settings_dialog.nsfw_content_is_hidden") : t("components.settings_dialog.nsfw_content_is_shown")
                        )}
                        labelPlacement="start"
                    />
                    <FormControlLabel
                        className={classes.switch}
                        value={"nsfw_blur"}
                        control={<Switch checked={_nsfw_enabled} onChange={_handle_nsfw_enabled_switch_change} color="primary" />}
                        label={nsfwSwitchLabel(
                            t("components.settings_dialog.dont_blur_nsfw_content"),
                            _nsfw_enabled ? t("components.settings_dialog.nsfw_content_shows_normally") : t("components.settings_dialog.nsfw_content_shows_blurred")
                        )}
                        labelPlacement="start"
                    />
                    <FormControlLabel
                        className={classes.switch}
                        value={"toxicity_helper"}
                        control={<Switch checked={_toxicity_enabled !== false} onChange={_handle_toxicity_enabled_switch_change} color="primary" />}
                        label={nsfwSwitchLabel(
                            t("components.settings_dialog.toxic_comment_helper"),
                            _toxicity_enabled !== false ? t("components.settings_dialog.kindly_flags_harsh_wording_while_you_type") : t("components.settings_dialog.no_hints_while_you_write")
                        )}
                        labelPlacement="start"
                    />
                    <Typography variant="caption" component="p" style={{ color: "#9d9d9d", margin: "8px 0px 0px 0px", lineHeight: 1.4 }}>
                        {t("components.settings_dialog.the_nsfw_filter_and_the_toxic_comment")}
                    </Typography>
                    <Typography component={"h2"} variant={"h6"} className={classes.subTitle}>{t("components.settings_dialog.preferred_payout")}</Typography>
                    <RadioGroup row name="payout" value={_payout}>
                        <FormControlLabel
                            value="decline"
                            control={<Radio color="primary" />}
                            label={t("components.settings_dialog.renounced")}
                            labelPlacement="bottom"
                            onClick={() => _handle_payout_switch_change("decline")}
                        />
                        <FormControlLabel
                            value="share"
                            control={<Radio color="primary" />}
                            label={t("components.settings_dialog.balanced")}
                            labelPlacement="bottom"
                            onClick={() => _handle_payout_switch_change("share")}
                        />
                        <FormControlLabel
                            value="power"
                            control={<Radio color="primary" />}
                            label={t("components.settings_dialog.sovereign")}
                            labelPlacement="bottom"
                            onClick={() => _handle_payout_switch_change("power")}
                        />
                    </RadioGroup>
                    <Typography component={"h2"} variant={"h6"} className={classes.subTitle}>{t("components.settings_dialog.voting_power")}</Typography>
                    <Slider
                        color={"secondary"}
                        className={classes.slider}
                        value={parseInt(_voting, 10)}
                        onChange={_handle_voting_percent_change}
                        valueLabelDisplay="auto"
                        marks={VOTING_MARKS}
                    />
                    <FormControlLabel
                        value="voting"
                        className={classes.switch}
                        control={<Switch checked={_askvote} onChange={_handle_askvote_enabled_switch_change} color="primary" />}
                        label={t("components.settings_dialog.always_ask_before_voting")}
                        labelPlacement="start"
                    />
                    <Typography component={"h2"} variant={"h6"} className={classes.subTitle}>{t("words.endpoint")}</Typography>
                    <Globe
                        nodes={DEFAULT_NODES}
                        selectedNodeId={_api_node || DEFAULT_NODES[0].id}
                        onNodeSelect={_handle_api_node_change}
                        customUrl={_api_node_custom_url}
                        size={280}
                    />
                    <TextField
                        fullWidth
                        type="url"
                        variant="filled"
                        placeholder="https://your-node.example.com"
                        margin="normal"
                        value={customUrlDraft}
                        error={customUrlError}
                        helperText={
                            customUrlError
                                ? t("components.settings_dialog.enter_a_valid_url_e_g_https")
                                : _api_node === CUSTOM_API_NODE_ID
                                    ? t("components.settings_dialog.currently_active_edit_and_press_enter_to")
                                    : t("components.settings_dialog.type_a_url_then_press_enter_or")
                        }
                        onChange={_handle_custom_url_change}
                        onBlur={_handle_custom_url_commit}
                        onKeyDown={_handle_custom_url_key_down}
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    {_api_node === CUSTOM_API_NODE_ID ? (
                                        <IconButton
                                            size="small"
                                            aria-label={t("components.settings_dialog.reset_custom_endpoint")}
                                            onClick={_handle_custom_url_reset}
                                        >
                                            <ClearIcon fontSize="small" />
                                        </IconButton>
                                    ) : (
                                        <IconButton
                                            size="small"
                                            aria-label={t("components.settings_dialog.set_custom_endpoint")}
                                            disabled={!customUrlDraft.trim()}
                                            onClick={_handle_custom_url_commit}
                                        >
                                            <CheckIcon fontSize="small" />
                                        </IconButton>
                                    )}
                                </InputAdornment>
                            ),
                        }}
                    />
                </DialogContent>
            </Dialog>
            <Dialog open={_18_open}
                    maxWidth={"xs"}
                    disablePortal={false}
                    onClose={_on18_close}
                    keepMounted={keepMounted}>
                <DialogTitle style={{display: "flex", margin: "0px 0px 16px 0px"}}>
                    <Typography component={"h1"} variant={"h4"} style={{float: "left", width: "100%", margin: "0px"}}>{t("components.settings_dialog.this_is_an_adult_functionality")}</Typography>
                </DialogTitle>
                <Divider />
                <DialogContent className={classes.dialogContent}>
                    <p>{t(
                        "components.settings_dialog.this_functionality_makes_age_restricted_material"
                    )}</p>
                </DialogContent>
                <DialogActions>
                    <Button onClick={_on18_close} autoFocus variant="text" color="primary">
                        {t("words.cancel")}
                    </Button>
                    <Button onClick={_on18_accept} variant="contained" color="primary">
                        {t("components.settings_dialog.i_am_18_or_older")}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

SettingsDialog.displayName = "SettingsDialog";

export default React.memo(SettingsDialog);