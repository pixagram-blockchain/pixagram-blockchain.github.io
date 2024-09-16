# Glossary — terms that must not be translated

Derived from the actual English catalog (`locales/en.js`, 1896 keys), not from guesswork. The counts are real occurrences.

A translator working without this will render `haircut` as a hairdressing term, `the weight` as a mass, and `witness` as a courtroom witness. All three are protocol concepts, and the wallet explanations stop making sense once they go.

---

## 1 · Never translate — token symbols and brand

Leave exactly as written, including capitalisation.

| Term | Uses | |
|---|--:|---|
| `PXA` | 85 | liquid token |
| `PXP` | 72 | staked token (Pixa Power) |
| `PXS` | 71 | supracoin |
| `Pixagram` | 73 | the platform |
| `Pixa` | 55 | the network / chain |
| `PixaSupra` | 13 | |
| `Supra` | 9 | |
| `Atlas` | 10 | protocol component name |
| `Pixagram SA` / `SA` | 14 | the Swiss company — a legal entity name |
| `Pixagram Foundation` | 14 | legal entity name |
| `Portal` | 15 | a community type, capital P |
| `DAO`, `NFT`, `WIF`, `CSV`, `PDF`, `URL` | — | standard acronyms |

**`Pixa Power`** is the full name of PXP. Translate neither word. It appears 43 times as `Power` inside that phrase.

---

## 2 · Translate the words, keep the meaning — protocol verbs and nouns

These are ordinary English words used as **protocol terms**. They need a consistent, deliberate translation in each language, chosen once and reused — not translated afresh at each occurrence.

| Term | Uses | What it actually means |
|---|--:|---|
| `power up` / `power down` / `powering down` / `power-down` | 30 | convert PXA↔PXP; a 13-week release schedule, **not** switching a device on or off |
| `witness` / `witnesses` | 50 | the 21 elected block-producing nodes. **Not** a legal or courtroom witness |
| `stake` / `staked` / `staking` | 19 | locking tokens for weight and bandwidth |
| `liquid` | 27 | freely transferable, as opposed to staked. **Not** a physical state |
| `vesting` / `vesting shares` | 4 | the chain-level unit behind PXP |
| `haircut` | 10 | the protocol's regulating variable in the PXS system. **Nothing to do with hair** |
| `the weight` / `the body` / `the mind` / `the soul` / `the macro` | 42 | the four-part metaphor used throughout the PXS/PXP explanations. Keep the metaphor coherent within a language — if `body` becomes one word in one string and another elsewhere, the explanation breaks |
| `collateral` | 5 | financial sense |
| `curation` | 2 | voting on content to earn a share of rewards |
| `beneficiary` | 4 | an account receiving a share of a post's payout |
| `recovery account` | 11 | the account authorised to recover yours |
| `virtual operation` | 5 | a chain-generated operation with no transaction id |
| `block reward` | 2 | |
| `permlink` | 1 | a post's URL slug. **Leave as-is** — it is an identifier, not a word |

---

## 3 · Key names — translate the adjective, never the concept

| Term | Uses | Note |
|---|--:|---|
| `owner key` | 8 | highest privilege — can rotate every other key |
| `active key` | 8 | transfers and wallet operations |
| `posting key` | 6 | voting, commenting, posting |
| `memo key` | 3 | encrypted messages |
| `master password` | 11 | derives all four keys |
| `seed phrase` | 4 | the BIP-39 mnemonic |

**These four must remain distinguishable from each other in every language.** They are how a user decides which credential to paste into which field, and the UI already accepts a higher-privilege key where a lower one was asked for. If `owner` and `active` collapse to the same word in translation, that is a security problem, not a wording problem.

---

## 4 · Numbers, dates and currency

**Do not translate or reformat these — the code does it.** `t()` interpolates the value; `toLocaleString(getLocaleCode(), …)` formats it for the active locale. A translator who "fixes" `1,234.50` to `1.234,50` inside a string will double-format it.

Move `{{variables}}` wherever the sentence needs them. Do not rename them, do not delete them, do not add new ones.

---

## 5 · Quick reference for reviewers

Signs a translation went wrong:

- `haircut` rendered as a hairdressing term
- `witness` rendered as a legal witness
- `power down` rendered as switching something off
- `liquid` rendered as a physical state
- `body` / `weight` / `mind` inconsistent between the PXA, PXP and PXS explanation dialogs
- `owner key` and `active key` rendered with the same word
- `PXA`, `PXP`, `PXS` translated or re-capitalised
- a number formatted inside the string rather than left to `{{variable}}`

---

## Amendment — `power up` / `power down`

Section 2 originally listed these under *"translate deliberately"*. Having
written the actual transaction-list labels in eleven languages, that was wrong,
and the shipped files do something different:

| script | treatment |
|---|---|
| Latin (de, es, fr, it, pt, id) and Cyrillic (ru) | **kept as `Power up` / `Power down`** |
| CJK (ja, ko, zh) | transliterated or translated — パワーアップ · 파워 업 · 充能 |
| Devanagari (hi) | **kept in Latin** inside a Devanagari sentence |

The reason is that these name a specific chain operation bound to the token
name *Pixa Power*, which is itself untranslatable. `Power up` → `Aufladen`
severs that link, and a German user reading `Aufladen` in the history has no
way to connect it to the `Pixa Power` balance above it or to the `Power up`
button that produced it.

CJK is the exception because a Latin verb phrase inside a CJK sentence does not
read as a term — it reads as an untranslated string.

**Whatever a language chooses, it must be the same everywhere in that
language.** The transaction list, the wallet tab, the confirmation dialog and
the button must agree, or a user cannot tell they refer to the same operation.

---

## The living-coin metaphor

Three dialogs — `pixa_wallet_pixa_info_dialog`, `pixa_wallet_power_info_dialog`
and `pixa_wallet_supra_info_dialog` — share one extended metaphor. It only works
if the words are the same in all three.

**Thirteen of the shared lines are now hoisted into `words.*`**, so consistency
is structural rather than a request: translate `words.one_body_two_phases_liquid_to_move`
once and all three dialogs agree by construction.

The lexicon each language must fix once and reuse:

| English | role |
|---|---|
| body | PXA + PXP together, the **Atlas** |
| liquid / flowing | PXA — the spendable phase |
| solid / frozen / at rest | PXP — the staked phase |
| weight · voice | what staking buys |
| mind · **Oracle** | the price sensor |
| soul · **Macro** | the regulating layer |
| consciousness · **Supra** | PXS — the projection you hold |

`Oracle`, `Atlas`, `Macro` and `Supra` are **component names** — leave them.
`haircut` and `supracoin` stay English.

**`Nutzungs-Token` stays German in every language, including German.** It is
FINMA's legal category as of 27 March 2025, not a description — translating it
would misstate the classification. Shipped that way in all eleven files.
