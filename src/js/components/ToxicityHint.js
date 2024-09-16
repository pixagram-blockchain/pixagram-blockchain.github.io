import React, { useCallback, useEffect, useRef, useState } from "react";

import Typography from "@material-ui/core/Typography";
import Tooltip from "@material-ui/core/Tooltip";
import Fade from "@material-ui/core/Fade";
import FavoriteBorderRounded from "@material-ui/icons/FavoriteBorderRounded";

import { create_toxicity_checker } from "../utils/toxicity";
import * as settings_api from "../utils/settings";

import { t, useLanguage } from "../utils/text";

/**
 * ToxicityHint / ToxicityWatcher — the visible half of the Toxic Comment
 * Helper. A gentle, dismiss-by-rephrasing amber caption; never a blocker.
 *
 * <ToxicityWatcher> is fully self-driven (own state, own debounced checker),
 * so it can sit INSIDE heavily memoized trees (BottomBarComments in
 * PostDialog, the comment bar in BlogPostDialog) without adding a single prop
 * to their custom comparators. Two modes:
 *
 *   <ToxicityWatcher text={title} label="title" />
 *      controlled fields — re-checks (debounced) whenever `text` changes.
 *
 *   <ToxicityWatcher targetId="comment-textfield" />
 *      uncontrolled fields — listens to native `input` events on the DOM
 *      element with that id (MUI puts the id on the <input>/<textarea>
 *      itself). Also fires on the synthetic input event the submit handlers
 *      dispatch after clearing the field, so the hint vanishes on send.
 *
 * The model behind it only ever loads once the user typed more than 3
 * characters, and only while the setting is enabled — both enforced in
 * utils/toxicity, not here.
 */

const HINT_STYLE = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    color: "#999",
    lineHeight: 1.3,
    marginTop: 4,
};

export const ToxicityHint = React.memo(function ToxicityHint({ result, label = "message", style }) {
    useLanguage();
    if (!result || !result.toxic) return null;
    const percent = Math.round((result.score || 0) * 100);
    return (
        <Fade in timeout={220}>
            <Typography variant="caption" component="div" style={style ? { ...HINT_STYLE, ...style } : HINT_STYLE}>
                <FavoriteBorderRounded style={{ fontSize: 14, flexShrink: 0 }} />
                <Tooltip
                    arrow
                    enterTouchDelay={200}
                    title={t("components.toxicity_hint.rated_likely_to_read_as_toxic_by", {
                        percent: percent
                    })}
                >
                    <span>{t("components.toxicity_hint.your_might_come_across_as_toxic_a", {
                            label: label
                        })}</span>
                </Tooltip>
            </Typography>
        </Fade>
    );
});

export const ToxicityWatcher = React.memo(function ToxicityWatcher({ text, targetId, label = "message", style, delay }) {
    useLanguage();
    const [result, setResult] = useState(null);
    const checkerRef = useRef(null);

    const onResult = useCallback((r) => { setResult(r); }, []);

    // One debounced checker per mounted watcher.
    useEffect(() => {
        const checker = create_toxicity_checker(onResult, delay);
        checkerRef.current = checker;
        return () => { checker.cancel(); checkerRef.current = null; };
    }, [onResult, delay]);

    // Controlled mode: react to the `text` prop.
    useEffect(() => {
        if (targetId) return;
        if (checkerRef.current) checkerRef.current.check(text);
    }, [text, targetId]);

    // Uncontrolled mode: listen to the DOM field directly.
    useEffect(() => {
        if (!targetId) return undefined;
        let input = null;
        let retryTimer = null;
        const read = () => (input && input.value !== undefined ? input.value : "");
        const onInput = () => { if (checkerRef.current) checkerRef.current.check(read()); };
        const attach = () => {
            const el = document.getElementById(targetId);
            if (!el) return false;
            input = (el.tagName === "INPUT" || el.tagName === "TEXTAREA")
                ? el
                : ((el.querySelector && el.querySelector("input, textarea")) || el);
            input.addEventListener("input", onInput);
            if (String(read()).trim()) onInput(); // pre-filled (edit mode)
            return true;
        };
        if (!attach()) {
            // Field can mount a beat later (Fade / collapse) — retry once.
            retryTimer = setTimeout(attach, 350);
        }
        return () => {
            if (retryTimer) clearTimeout(retryTimer);
            if (input) input.removeEventListener("input", onInput);
        };
    }, [targetId]);

    // If the helper gets disabled in Settings while a hint is showing, clear it.
    useEffect(() => {
        const unsub = settings_api.subscribe((s) => {
            if (s && s.toxicity_enabled === false) setResult(null);
        });
        return unsub;
    }, []);

    return <ToxicityHint result={result} label={label} style={style} />;
});

export default ToxicityHint;
