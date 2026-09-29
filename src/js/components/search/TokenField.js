"use strict";
import React, { useCallback, useEffect, useRef, useState } from "preact/compat";
import Avatar from "@material-ui/core/Avatar";
import CloseIcon from "@material-ui/icons/Close";

import { t, useLanguage } from "../../utils/text";

import { tr } from "./highlight";

// ── TokenField ────────────────────────────────────────────────────────────────
// A text field that holds several values: the picked ones sit in the field as
// small tokens (× removes, Backspace on an empty field removes the last), the
// typed text asks `suggest(text)` for matches shown under the field.
//   ↑/↓ move · Enter or "," picks the highlighted match (or the typed text when
//   `validate(text)` accepts it) · Esc clears the text
// With `suggestOnFocus`, focusing the empty field lists `suggest("")` (e.g. the
// top communities). Suggestion rows: rounded-square picture · label · sub.
//
// Props: values [key], labelOf(key) → { label, image }, suggest(text) → Promise<[{ key, label, sub, image }]>
//        (`sub` may be a string or a node),
//        validate(text) → key | null, onAdd(key, item | null), onRemove(key), placeholder, ariaLabel

const EMPTY = Object.freeze([]);
const TOKEN_AVATAR = { width: 16, height: 16, borderRadius: 4, fontSize: 10, backgroundColor: "#555", color: "#ccc" };
const ROW_AVATAR = { width: 22, height: 22, borderRadius: 6, fontSize: 12, backgroundColor: "#3a3a3a", color: "#bbb" };
const DEBOUNCE_MS = 160;

function initialOf(label) {
    const s = String(label || "").replace(/^[@#]/, "");
    return s ? s.charAt(0).toUpperCase() : "?";
}

export const TokenField = React.memo(
    ({ classes, values, labelOf, suggest, validate, onAdd, onRemove, placeholder, ariaLabel, suggestOnFocus = false }) => {
        useLanguage();
        const removeLabel = tr(t, "components.token_field.remove", "Remove");
        const [text, setText] = useState("");
        const [items, setItems] = useState(EMPTY);
        const [active, setActive] = useState(0);
        const [focused, setFocused] = useState(false);
        const inputRef = useRef(null);
        const requestRef = useRef(0);
        const timerRef = useRef(null);
        const valuesRef = useRef(values);
        valuesRef.current = values;

        const cancel = useCallback(() => {
            requestRef.current += 1;
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        }, []);

        const lookup = useCallback((q) => {
            cancel();
            if (!q && !suggestOnFocus) {
                setItems(EMPTY);
                return;
            }
            const id = requestRef.current;
            timerRef.current = setTimeout(async () => {
                timerRef.current = null;
                let rows;
                try {
                    rows = await suggest(q);
                } catch (e) {
                    rows = EMPTY;
                }
                if (id !== requestRef.current) return; // a newer keystroke won
                const taken = new Set(valuesRef.current);
                setItems((Array.isArray(rows) ? rows : EMPTY).filter((r) => r && r.key && !taken.has(r.key)));
                setActive(0);
            }, q ? DEBOUNCE_MS : 0);
        }, [cancel, suggest, suggestOnFocus]);

        useEffect(() => cancel, [cancel]);

        const commit = useCallback((key, item) => {
            if (!key) return;
            cancel();
            onAdd(key, item || null);
            setText("");
            setItems(EMPTY);
        }, [cancel, onAdd]);

        const onChange = useCallback((e) => {
            const v = e.target.value;
            setText(v);
            lookup(v.trim());
        }, [lookup]);

        const onFocus = useCallback(() => {
            setFocused(true);
            if (suggestOnFocus && !inputRef.current?.value) lookup("");
        }, [lookup, suggestOnFocus]);
        const onBlur = useCallback(() => setFocused(false), []);

        const onKeyDown = useCallback((e) => {
            const n = items.length;
            if (e.key === "ArrowDown" && n) {
                e.preventDefault();
                setActive((a) => (a + 1) % n);
            } else if (e.key === "ArrowUp" && n) {
                e.preventDefault();
                setActive((a) => (a - 1 + n) % n);
            } else if (e.key === "Enter" || e.key === ",") {
                const item = items[Math.min(active, n - 1)];
                if (item) {
                    e.preventDefault();
                    commit(item.key, item);
                } else if (validate) {
                    const key = validate(text);
                    if (key) {
                        e.preventDefault();
                        commit(key, null);
                    } else if (e.key === ",") {
                        e.preventDefault();
                    }
                }
            } else if (e.key === "Escape") {
                if (text || n) {
                    e.preventDefault();
                    e.stopPropagation();
                    cancel();
                    setText("");
                    setItems(EMPTY);
                }
            } else if (e.key === "Backspace" && !text) {
                const vals = valuesRef.current;
                if (vals.length) onRemove(vals[vals.length - 1]);
            }
        }, [items, active, text, validate, commit, cancel, onRemove]);

        // Clicking the empty part of the box focuses the input.
        const onBoxMouseDown = useCallback((e) => {
            if (e.target === e.currentTarget) {
                e.preventDefault();
                if (inputRef.current) inputRef.current.focus();
            }
        }, []);
        const keepFocus = useCallback((e) => e.preventDefault(), []);

        const open = focused && items.length > 0;

        return (
            <div className={classes.tokenField}>
                <div className={classes.tokenBox} onMouseDown={onBoxMouseDown}>
                    {values.map((key) => {
                        const { label, image } = labelOf(key);
                        return (
                            <span key={key} className={classes.token} title={label}>
                                {image ? (
                                    <Avatar variant="rounded" src={image} style={TOKEN_AVATAR} alt="">{initialOf(label)}</Avatar>
                                ) : null}
                                <span className={classes.tokenLabel}>{label}</span>
                                <button
                                    type="button"
                                    className={classes.tokenRemove}
                                    onMouseDown={keepFocus}
                                    onClick={() => onRemove(key)}
                                    aria-label={`${removeLabel}: ${label}`}
                                    title={removeLabel}
                                >
                                    <CloseIcon />
                                </button>
                            </span>
                        );
                    })}
                    <input
                        ref={inputRef}
                        className={classes.tokenInput}
                        type="text"
                        value={text}
                        placeholder={values.length ? "" : placeholder}
                        onChange={onChange}
                        onFocus={onFocus}
                        onBlur={onBlur}
                        onKeyDown={onKeyDown}
                        autoComplete="off"
                        spellCheck="false"
                        aria-label={ariaLabel}
                        aria-autocomplete="list"
                        aria-expanded={open}
                        role="combobox"
                    />
                </div>
                {open ? (
                    <div className={classes.suggestList} role="listbox">
                        {items.map((item, i) => (
                            <div
                                key={item.key}
                                role="option"
                                aria-selected={i === active}
                                className={classes.suggestItem + (i === active ? " on" : "")}
                                onMouseDown={keepFocus}
                                onMouseEnter={() => setActive(i)}
                                onClick={() => commit(item.key, item)}
                            >
                                <Avatar variant="rounded" src={item.image || undefined} style={ROW_AVATAR} alt="">{initialOf(item.label)}</Avatar>
                                <span className={classes.suggestLabel}>{item.label}</span>
                                {item.sub ? <span className={classes.suggestSub}>{item.sub}</span> : null}
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>
        );
    },
    (prev, next) =>
        prev.values === next.values &&
        prev.labelOf === next.labelOf &&
        prev.suggest === next.suggest &&
        prev.validate === next.validate &&
        prev.onAdd === next.onAdd &&
        prev.onRemove === next.onRemove &&
        prev.placeholder === next.placeholder &&
        prev.ariaLabel === next.ariaLabel &&
        prev.suggestOnFocus === next.suggestOnFocus &&
        prev.classes === next.classes,
);
