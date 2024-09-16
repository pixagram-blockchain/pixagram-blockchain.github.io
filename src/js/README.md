# Byline i18n patch — `{{date}} by {{author}}`

Replaces the hardcoded English ` by ` (and the sibling ` to ` in the reply card)
with catalog lookups, and adds the two keys to all 27 locales.

## What changed

### `components/` — 3 files

| File | Change |
|---|---|
| `PaperCard.js` | new `import { t, useLanguage }`; `useLanguage()` in `PaperCardInner`; ` by ` → `{t('words.by')}` |
| `PaperCardComment.js` | import widened to include `useLanguage`; `useLanguage()` in `PaperCardCommentInner`; ` by ` → `{t('words.by')}` |
| `PaperCardReply.js` | import widened to include `useLanguage`; `useLanguage()` in `PaperCardReplyInner`; ` by ` → `{t('words.by')}`; ` to ` → `{t('words.to')}` |

The spaces stay outside the braces (`> {t('words.by')} <`). JSX preserves
single-line whitespace, so the separator still gets its padding — which matters
for the CJK values, where there is no natural word gap.

**On `useLanguage()`:** in `PaperCard.js` this is load-bearing, not tidying.
The component is wrapped in two `memo()` layers whose comparators check
`id`/`data`/`locales`/`voter` and nothing language-related, so without the
subscription a language switch would never repaint the subheader. In the
comment and reply cards it is cheap insurance, and it also fixes the
already-latent case of the root-type chip (`rootTypeLabel`, which calls `t()`
during render) going stale after a switch.

### `locales/` — 27 files

Two keys appended to the shared `words` namespace of every catalog. `words` is
the right home rather than a component namespace: three call sites already, and
en.js's own header says to hoist there once duplicates are visible.

`svg.js` is untouched — it has no `words` block.

## The values

| Locale | `by` | `to` | Locale | `by` | `to` |
|---|---|---|---|---|---|
| `en` | by | to | `sk` | od | pre |
| `de` | von | an | `ru` | от | в ответ |
| `nl` | door | aan | `uk` | від | у відповідь |
| `da` | af | til | `id` | oleh | kepada |
| `no` | av | til | `fi` | käyttäjältä | käyttäjälle |
| `sv` | av | till | `hu` | szerző: | válasz: |
| `fr` | par | à | `tr` | paylaşan: | yanıt: |
| `es` | por | a | `ja` | 投稿者： | 返信先： |
| `pt` | por | para | `ko` | 작성자: | 답장 대상: |
| `it` | di | a | `zh` | 作者： | 回复： |
| `ro` | de | către | `hi` | लेखक: | जवाब: |
| `el` | από | προς | `bn` | লেখক: | উত্তর: |
| `pl` | przez | do | `ta` | பதிவிட்டவர்: | பதில்: |
| `cs` | od | pro | | | |

### Why some are labels rather than prepositions

In Turkish, Japanese, Korean, Hindi, Bengali, Tamil and Hungarian, "by X" is a
**postposition** — `tarafından`, `による`, `द्वारा` all follow the name. The markup
fixes the order as `date · by · author`, so a literal translation would be
grammatically broken in that slot. The `label:` form ("posted by:", "author:")
is the standard workaround and reads naturally there.

The `by` values pick a term that covers all three content types the cards
render — artwork, blog post, comment — which is why `tr` is `paylaşan:` (the
one who shared) rather than `yazan:` (the one who wrote), and `ta` is
`பதிவிட்டவர்:` (the one who posted) rather than `எழுதியவர்:`.

The `to` row is worth a native-speaker pass before shipping. A bare directional
"to" is the harder of the two: for `ru`/`uk`/`tr`/`ja`/`ko`/`zh`/`hi`/`bn`/`ta`/`hu`
the values above read as "in reply to" rather than a literal "to", which fits
the reply card's meaning but is an interpretation, not a translation.

If you only wanted `by`, drop the `"to"` line from each catalog and revert the
one line at `PaperCardReply.js:469`.

## Verification

- All 27 catalogs parse as ESM under Node 22 and resolve `words.by` /
  `words.to` to non-empty strings.
- Key counts are identical across all 27 (161 in `words`), confirming the
  insertion clobbered nothing.
- All three components compile as JSX under esbuild with `--jsx-factory=h`.

## Review

`components.diff` is a unified diff of the three components against the
originals. `locales-en-sample.diff` shows the catalog insertion shape — the
other 26 are the same edit with different values.

## Not done

The single-key alternative — `"date_by_author": "<0></0> by <1></1>"` using the
`<0>`/`<1>` slot syntax the catalogs already support — is the linguistically
correct fix, since it lets a translator reorder the whole line (`ja`:
`<1></1>が<0></0>に投稿`; `tr`: `<1></1> tarafından, <0></0>`). It needs the three
subheaders restructured to pass the Tooltip-wrapped date span and the
`ProfileHoverAnchor`-wrapped name span as slots. This patch is the low-risk
version that gets the 20 preposition languages fully right and the other 7
acceptable.
