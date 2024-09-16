import React from "react";
import { t, isElementValue } from "./text";

/**
 * utils/T.js — render a translated string that contains inline markup.
 *
 * The last untranslatable shape in the codebase is a sentence split by inline
 * elements:
 *
 *     <span>Use your <b>active key</b> to sign this batch.</span>
 *
 * Extracting that as two keys ("Use your" / "to sign this batch.") produces
 * strings no translator can reorder — and German, Japanese and Arabic all
 * need to reorder. Keeping it as one key requires the markup to live inside
 * the translated value, which in turn requires turning that markup back into
 * React elements at render time.
 *
 *     locale:  "use_your_key": "Use your <b>active key</b> to sign this batch."
 *     usage:   <T k="components.pixa_wallet_bulk_power_dialog.use_your_key" />
 *
 * Numbered slots carry arbitrary elements — links, buttons, styled spans —
 * without putting any of their attributes in the locale file:
 *
 *     locale:  "read_the_<0>docs</0>_first": "Read the <0>docs</0> first."
 *     usage:   <T k="…" slots={[<a href={url} key="0" />]} />
 *
 * SECURITY: this parser builds React elements. It never touches
 * dangerouslySetInnerHTML, so a hostile locale file cannot inject script,
 * event handlers, or a javascript: URL — the worst it can do is emit a <b>.
 * Contrast the six sites that reach for dangerouslySetInnerHTML to render
 * markdown; this needs none of that machinery because the tag set is closed.
 *
 * ── engine notes ──────────────────────────────────────────────────────────
 *
 * <T> replaces a bare t() call on the render path, so it must not cost more
 * than one. What that means here:
 *
 *   - The no-markup case (nearly every key) returns the translated string
 *     itself. No Fragment, no children array, no extra vnode for the
 *     reconciler to diff.
 *   - The props rest object is only built when `as` is given, since that is
 *     the only branch that forwards it.
 *   - The parser's `walk` lives at module scope with its node budget beside
 *     it, so parsing a string does not allocate a closure pair, and it reads
 *     the match by index instead of destructuring it — array destructuring a
 *     RegExp match runs the iterator protocol and allocates per token.
 */

/**
 * The only tags a locale file may use. Everything else renders as text.
 *
 * Null-prototype on purpose. `TAGS[tag]` is a lookup with a locale-controlled
 * key, and as a plain object literal this map inherits Object.prototype —
 * where `valueOf` and `toString` are FUNCTIONS that would pass the truthiness
 * test and reach createElement as a component type. Nothing exploits that
 * today only because the parser lower-cases first (`valueof` is not a real
 * inherited property) and because the grammar caps a tag at eight letters, so
 * `constructor` cannot be spelled. Both are accidents of two unrelated rules.
 * A null prototype makes it structural, and costs nothing: on a miss — the
 * common case for an unknown tag — there is no prototype chain to walk.
 */
const TAGS = Object.assign(Object.create(null), {
    b: "b", strong: "strong",
    i: "i", em: "em",
    u: "u", code: "code",
    small: "small", mark: "mark", br: "br"
});

const TOKEN = /<(\/?)([a-z]{1,8}|\d{1,2})\s*\/?>/gi;

/** Numbered slots a locale value already spends, so synthetic ones start above. */
const NUM_TAG = /<(\d{1,2})>/g;

const MAX_DEPTH = 6;
const MAX_NODES = 400;

/**
 * Node budget for the parse in progress. Module scope rather than a closure
 * variable: parsing is synchronous and non-reentrant, so a single counter is
 * safe, and `walk` can then be hoisted out of `parse` — which otherwise
 * allocates a fresh function object every time a marked-up string renders.
 */
let budget = 0;

/**
 * Parse `text` into React children. Bounded on both depth and node count so a
 * malformed or hostile locale value cannot produce unbounded work.
 */
const walk = (text, slots, from, stopTag, depth) => {
    const out = [];
    let cursor = from;
    TOKEN.lastIndex = from;
    let m;

    while ((m = TOKEN.exec(text)) !== null) {
        if (budget-- <= 0) break;

        const raw = m[0];
        const closing = m[1];
        const tag = m[2].toLowerCase();
        const after = m.index + raw.length;

        if (m.index > cursor) out.push(text.slice(cursor, m.index));

        // Closing tag for the frame we are in — hand control back up.
        if (closing !== "") {
            if (tag === stopTag) return { children: out, end: after };
            out.push(raw);                    // stray close: literal text
            cursor = after;
            continue;
        }

        if (tag === "br") {
            out.push(React.createElement("br", { key: out.length }));
            cursor = after;
            TOKEN.lastIndex = cursor;
            continue;
        }

        // A slot tag is all digits, so its first character settles it — no
        // regex test per token.
        const c0 = tag.charCodeAt(0);
        const isSlot = c0 >= 48 && c0 <= 57;
        const slot = isSlot && slots ? slots[+tag] : undefined;
        const known = isSlot ? !!slot : TAGS[tag] !== undefined;

        if (!known || depth >= MAX_DEPTH) {
            out.push(raw);                    // unknown tag: literal text
            cursor = after;
            continue;
        }

        const inner = walk(text, slots, after, tag, depth + 1);

        if (isSlot) {
            // Only override the slot's own children when the locale
            // actually wrapped something: cloneElement treats a 3rd
            // argument as authoritative, so passing an empty [] for a
            // self-closing "<0></0>" would erase children the caller set.
            out.push(inner.children.length
                ? React.cloneElement(slot, { key: out.length }, inner.children)
                : React.cloneElement(slot, { key: out.length }));
        } else {
            out.push(React.createElement(TAGS[tag], { key: out.length }, inner.children));
        }

        cursor = inner.end;
        TOKEN.lastIndex = cursor;
    }

    if (cursor < text.length) out.push(text.slice(cursor));
    return { children: out, end: text.length };
};

const parse = (text, slots) => {
    budget = MAX_NODES;
    return walk(text, slots, 0, null, 0).children;
};

/** Props consumed by <T> itself; everything else is forwarded to `as`.
 *  Null-prototype for the same reason as TAGS: a prop named `toString` must
 *  not test as "one of ours". */
const OWN_PROPS = Object.assign(Object.create(null), {
    k: 1, vars: 1, params: 1, slots: 1, as: 1
});

/**
 * @param {string}   k          translation key, e.g. "components.x.y"
 * @param {object}   [vars]     interpolation variables, as for t(); a value
 *                              that is an element (or an array holding one) is
 *                              placed as a slot instead of being stringified
 * @param {object}   [params]   format parameters, e.g. { FLC: true }
 * @param {Array}    [slots]    elements for numbered <0>…</0> placeholders
 * @param {string}   [as]       wrapper element; omit to render a fragment
 */
export const T = (props) => {
    const k = props.k;
    const vars = props.vars;
    const slots = props.slots;
    const as = props.as;

    // An element handed in through `vars` cannot survive t(): interpolate()
    // refuses object values on purpose (an object variable is a plural spec),
    // so "{{name}}" comes back verbatim. Translate with the scalars only, then
    // rewrite each surviving token into a numbered slot and let the parser
    // below place the element — wherever the LOCALE put the token, which is
    // the point: "<0></0>{{where}} と題して" needs it mid-sentence.
    let scalars = vars;
    let nodeNames = null;
    if (vars) {
        const names = Object.keys(vars);     // one pass, not two
        for (let i = 0; i < names.length; i++) {
            if (isElementValue(vars[names[i]])) (nodeNames || (nodeNames = [])).push(names[i]);
        }
        if (nodeNames !== null) {
            scalars = {};
            for (let i = 0; i < names.length; i++) {
                const name = names[i];
                if (nodeNames.indexOf(name) === -1) scalars[name] = vars[name];
            }
        }
    }

    let value = t(k, scalars, props.params);
    if (typeof value !== "string") return null;

    let allSlots = slots;
    if (nodeNames !== null) {
        allSlots = slots ? slots.slice() : [];
        let next = allSlots.length;
        let m;
        NUM_TAG.lastIndex = 0;
        while ((m = NUM_TAG.exec(value)) !== null) {
            const n = +m[1] + 1;
            if (n > next) next = n;
        }

        for (let i = 0; i < nodeNames.length; i++) {
            const name = nodeNames[i];
            const token = "{{" + name + "}}";
            if (next > 99 || value.indexOf(token) === -1) continue;  // locale omits it
            value = value.split(token).join("<" + next + "></" + next + ">");
            const v = vars[name];
            // parse() clones a slot, and an array is not clonable — wrap it.
            allSlots[next] = Array.isArray(v) ? React.createElement(React.Fragment, null, v) : v;
            next++;
        }
    }

    // Fast path: the overwhelming majority of keys carry no markup at all.
    const children = value.indexOf("<") === -1 ? value : parse(value, allSlots);

    if (as) {
        // Built here rather than by `...rest` in the signature: the rest
        // pattern allocates and copies on every render, including the far more
        // common branch below that never looks at it.
        const rest = {};
        const keys = Object.keys(props);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            if (OWN_PROPS[key] === undefined) rest[key] = props[key];
        }
        return React.createElement(as, rest, children);
    }

    // A plain string is a valid component return, so the no-markup case costs
    // no wrapper vnode at all; only real children need the Fragment.
    return typeof children === "string"
        ? children
        : React.createElement(React.Fragment, null, children);
};

export default T;