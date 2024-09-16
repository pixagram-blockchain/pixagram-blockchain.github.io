# Translating Pixagram

Everything a translator needs to know about the value syntax. Read `GLOSSARY.md` first — it lists the terms that must not be translated.

---

## Adding a language

Copy `en.js` to `<code>.js` — `de.js`, `fr.js`, `pt.js`. Two-letter language code, lowercase.

**You do not have to translate everything.** Define the keys you have; anything missing falls back to English automatically. A half-finished locale ships safely.

Regional variants (`pt-BR`, `zh-TW`) inherit from their base language (`pt`, `zh`) unless a dedicated file exists. The Settings list colours itself from this: white for a dedicated regional file, grey-white for an inherited base language, dim with *not translated yet* for the rest.

---

## The four things inside a value

### `{{variable}}` — a value inserted at runtime

```js
"received_from": "Received from @{{from}}"
```

**Move them wherever the sentence needs them.** That is the whole point — the English order is not binding.

```js
// German: verb to the end
"received_from": "Von @{{from}} erhalten"
```

Do not rename, delete or invent variables. If a key has `{{from}}`, your translation must contain `{{from}}` exactly once.

### `%n {{{_plurals.key}}}` — a count and its noun

```js
"arrives_in_day": "Arrives in %n {{{_plurals.day}}}"
```

`%n` becomes the number, `{{{_plurals.day}}}` becomes the right form of the noun.

**They do not have to sit together.** Not every language puts the count next to
the word it counts — English itself does not, in
`"%n more {{{_plurals.character}}} needed"`. Put `%n` where the number belongs
and `{{{_plurals.x}}}` where the noun belongs. One plural per string is the only
rule; with two, `%n` would be ambiguous and is left as written. Define the forms at the top of your file:

```js
_plurals: {
    "day": { "one": "Tag", "many": "Tage" }
}
```

English needs two forms. **Russian needs three, Polish four, Arabic six** — declare as many as your language uses:

```js
"day": { "one": "день", "few": "дня", "many": "дней", "plenty": "дней" }
```

`few` applies between 2 and the `few` threshold; `plenty` above the `plenty` threshold. Both are supplied by the code per call site. If your language only needs two forms, give only `one` and `many`.

### `<b>` `<i>` `<u>` `<code>` `<small>` `<mark>` `<br>` — formatting

```js
"permissions_use_your_key_to": "<b>{{title}} permissions</b><br>Use your {{title}} to:"
```

Move them, nest them, drop them if your language does not want the emphasis. They are rebuilt as real elements — no HTML is injected, and any tag outside this list renders as literal text.

### `<0>` `<1>` … — a link, button or styled element supplied by the code

```js
"entitled_post": "Entitled <0></0>{{where}}"
```

`<0></0>` is a placeholder for something the app provides — usually a link to a post. **Put it wherever your sentence needs it.**

```js
// French: the link moves
"entitled_post": "<0></0> a été publié{{where}}"
```

Keep the numbering. `<0>` must stay `<0>`. If a slot has text inside it in English, that text is yours to translate:

```js
"read_the_docs": "Read the <0>docs</0> first."
→ "Lisez d'abord la <0>documentation</0>."
```

---

## Punctuation is yours

The English strings carry their own punctuation deliberately, so you can change it:

- **French** — narrow no-break space before `: ; ! ?` and inside `« »`
- **Chinese / Japanese** — full-width `：` `，` `。` and no space around them
- **German** — `„quotes"`; **French** — `« quotes »`; **Japanese** — `「quotes」`
- **Spanish** — opening `¿` and `¡`

If a colon or quote looks wrong in your language, change it. It is inside the string for exactly that reason.

---

## What not to touch

**Numbers, dates and currency.** The code formats them for your locale before they reach you. A value arriving as `{{total}}` is already `1 234,50` in French. Reformatting it inside the string double-formats it.

**Key names.** The left-hand side (`"received_from"`) is code. Only the right-hand side is text.

**Anything in `GLOSSARY.md`.**

---

## Before you submit

```
node scripts/check-i18n.js src/components src/locales/en.js
```

That checks the **English** catalog against the source. For your file, the things to self-check:

- every `{{variable}}` from the English value is present, spelled identically
- every `<0>`, `<1>` … is present with its number unchanged
- `%n {{{_plurals.x}}}` keys have matching entries in your `_plurals` block
- protocol terms match `GLOSSARY.md`
- the four key names (`owner`, `active`, `posting`, `memo`) are distinguishable from one another

That last one is not stylistic. Those words tell a user which credential to paste into which field, and the highest-privilege key is accepted where the lowest was asked for.

---

## Current coverage

Eleven languages exist as **partial** files — `_plurals`, the shared `words`
block, the app chrome (settings, menus, editor toolbar, tabs, community
sections), the wallet (`wallet_history` in full, plus the labels, actions and
status messages of `pixa_wallet_dialog`), `login_dialog`, `post_dialog`,
`new_post`, `pixa_wallet_bulk_power_dialog`, `pixa_wallet_taxes_dialog` and the short lines
of the three protocol-explanation dialogs, plus `pixa_wallet_keys_dialog`,
`gradient_editor_dialog` the edit/create dialogs, and every FAQ
section title, question and one-line hint, and the
dashboard / inspector / witness / account-creation surfaces, and the wallet,
editor, unlock and profile dialogs, plus notifications, menus and settings.
1554 of 1736 keys each, about 90 % — everything except the 169 legal keys
explanations (recovery window, co-signing, backup warnings), every irreversible-action
confirmation, and the full tax-classification guidance.

That is not a placeholder. The `words` block alone resolves at 125+ call sites,
and everything else falls back to English key by key, so these files are safe to
ship today and get better one namespace at a time.

**What was deliberately left in English:**

| | keys | why |
|---|--:|---|
| `terms_of_use` | 103 | Swiss-law liability text. A mistranslation is a legal problem, not a wording one — this needs a lawyer, not a translator. |
| `community_principles` | 40 | same |
| `license_customization_dialog`, `license_dialog`, `intellectual_property` | 26 | licence terms attached permanently to an NFT |

**Highest-value namespaces to translate next**, by keys × visibility:

1. **The 28 long paragraphs in the three protocol dialogs.** Their headings and
   captions are translated and the shared lexicon is hoisted into `words.*`, so
   the terms are already fixed — what remains is the prose that uses them. Read
   the metaphor section of `GLOSSARY.md` first; this is the part where a
   translator earns their keep, and machine translation will not hold the
   metaphor together across three dialogs
4. `gradient_editor_dialog` (38)
5. `pixa_wallet_dialog` — the remaining 55 keys are the long explanatory
   paragraphs; labels and actions are done

### Security-sensitive strings

`login_dialog` is done, and parts of it need review rather than translation
memory. **`"Your keys are going to be stored unencrypted."` must not soften.**
A translation that reads as *"stored securely"* or omits the negative turns a
warning into reassurance, and the user proceeds. Same for
`"Stored unencrypted. don't put your password here"`.

The five key-role names (`Master` `Posting` `Active` `Owner` `Memo`) are kept in
English across all eleven languages — they are literal chain authority names,
and the descriptions beneath them carry the meaning. **Those descriptions must
stay distinguishable from one another**, especially `owner` (account recovery
and authority changes) versus `active` (transfers): the form accepts a
higher-privilege key wherever a lower one is asked for.

### Commas inside CSV output

`pixa_wallet_taxes_dialog` writes a CSV report whose header rows are built from
translated strings. Those rows used to be concatenated raw, so a comma in any
translation would have added a column and malformed the export — silently, since
the file still opens.

That is fixed in the component (`csvCell` quotes every translated fragment), so
**you may use commas normally**. Nothing in a locale file needs to avoid them.

### Word order is genuinely free

`post_dialog.replying_to_0_0` is worth looking at as a demonstration. The
English is `"Replying to <0>@{{username}}</0>"`. Japanese and Hindi both moved
the link to the **front** of the sentence, because that is where it belongs in
those languages:

    ja   <0>@alice</0> への返信
    hi   <0>@alice</0> को उत्तर
    fr   En réponse à <0>@alice</0>

That is only possible because the whole sentence is one key with a numbered
slot. Split into `"Replying to"` + a link, every language would be stuck with
English order.

`wallet_history` is complete. It is worth opening as a reference: the mapper
emits `tk()` descriptors rather than prose, so one descriptor built before a
language change still resolves in the new language.


## ALL-CAPS button labels

Buttons that read `CANCEL`, `CONFIRM`, `DOWNLOAD` are **not** stored in capitals.
They use the ordinary word and the `TUC` ("total upper case") flag:

```jsx
{t("words.cancel", {TUC: true})}
```

Translate `words.cancel` as you normally would — *Abbrechen*, *Annuler*,
*Отмена*. The runtime uppercases your translation, not an English original:

```
de  ABBRECHEN   ·  BESTÄTIGEN  ·  HERUNTERLADEN
ru  ОТМЕНА      ·  ПОДТВЕРДИТЬ ·  СКАЧАТЬ
ja  キャンセル    ·  確認        ·  ダウンロード      <- no change, CJK has no case
```

Never type a translation in capitals to "match" the button. Uppercasing is
locale-specific — Turkish maps `i` to `İ`, not `I` — and hard-coding capitals
takes that decision away from the platform.

### `shop` / `now` — a split phrase

`SHOP NOW` is one call to action rendered as two spans so the second can be
hidden on narrow screens. Word order differs by language, so:

- put the part that must always show in **`shop`**
- put the part that may be hidden in **`now`**
- **leave `now` empty** where the phrase does not split that way

German reads *JETZT KAUFEN* — adverb first — so `now` is empty and `shop`
carries the whole phrase. Italian splits naturally: `NEGOZIO` + `ORA`. An empty
value renders nothing, so this is a supported answer, not a gap.
