/* =============================================================================
 * Pixagram tax report — PDF (summary) + CSV (line-item detail)
 *
 * Built on pdf-lib to match your existing licensePDF.js stack: same
 * PDFDocument flow, same { regular, bold, oblique } font object, same
 * rounded-rect (drawSvgPath) helpers. Runs in Node (StandardFonts) and in the
 * browser (pass your embedded Industry fonts — see `defaultFonts`).
 *
 * In your repo: `import type { ReportBundle } from "./pixa-tax-engine"` and
 * delete the inlined types below. The PDF is the formatted summary you hand to
 * a filing/accountant; the CSVs are the granular detail for import/audit.
 *
 * NOTE (integration): the static `import { writeFileSync } from "fs"` and the
 * Node demo `main()` were removed so this module is browser-bundle-safe (the
 * wallet dialog imports it). The inline LOGO_PNG_B64 was replaced with a small
 * placeholder PNG — paste your original logo base64 back into the constant.
 *
 * CORRECTNESS PASS (Oct 2026): Swiss wording (holdings value instead of "net
 * wealth", exempt gains stated as such, PXP shown and explained as wealth, a CH
 * annex mapping each figure to the return); outbound "tax treatment" derived
 * from the disposal lines; the price-basis statement is read off the figures
 * (or opts.priceMode: "historical" | "snapshot"); WinAnsi-safe text (the Israel
 * export crashed on Hebrew); long notes and short tables paginate cleanly;
 * unpriced figures print "n/a" with a warning; CSV cells escape CR and formula
 * prefixes. CSV schema changes: outbound column "taxable" is now "is_disposal",
 * and counterparties no longer carry an "@" prefix.
 *
 * LANGUAGE (Nov 2026): every label is a catalogue key (components.tax_report.*,
 * plus a few shared with the wallet dialog), resolved through `opts.i18n` — a
 * document translator from utils/docLanguage.js: { t, text, number, date,
 * upper }. The dialog renders through renderInDocLanguage(), which writes the
 * PDF in the UI language when Helvetica (WinAnsi) can print every string of it
 * — see printableInReport() — and in English otherwise. The engine's notes and
 * warnings arrive as descriptors and are resolved by i18n.text(). Numbers and
 * dates follow the document's language. This module still imports nothing but
 * pdf-lib: without opts.i18n (Node, tests) keys print as themselves and numbers
 * use en-US. CSV column headers and data tokens (yes/no, category codes, ISO
 * dates, "(pooled/none)") stay as they are — they are the file's schema; the
 * human-text columns (tax_treatment, note) follow opts.i18n.
 * ===========================================================================*/

import { PDFDocument, StandardFonts, rgb, PageSizes } from "pdf-lib";

// ---- types mirrored from pixa-tax-engine.ts -------------------------------

// ═══════════════════════════════════════════════════════════════════════════
// PALETTE & GEOMETRY
// ═══════════════════════════════════════════════════════════════════════════

const INK = rgb(0.09, 0.09, 0.09);
const SUB = rgb(0.42, 0.42, 0.42);
const LINE = rgb(0.84, 0.84, 0.84);
const ZEBRA = rgb(0.968, 0.968, 0.968);
const HEAD = rgb(0.11, 0.11, 0.11);
const WHITE = rgb(1, 1, 1);
const POS = rgb(0.09, 0.09, 0.09); // greyscale — no colour on gains
const ACCENT = rgb(0.23, 0.23, 0.23); // dark grey accent (#3a3a3d) — Pixagram is greyscale
const MUTED = rgb(0.58, 0.58, 0.58); // very light grey for tiny secondary text (trx ids, times)
const KP = 0.5522847498;
const [PAGE_W, PAGE_H] = PageSizes.A4; // 595.28 x 841.89, portrait
const MRG = 46;
const CONTENT_W = PAGE_W - MRG * 2;
const FOOT_Y = 34;
// Body text stops here. The footer's identity line sits at FOOT_Y + 18, so this
// keeps ~9pt between the last body line and the footer (was ~1pt at FOOT_Y + 26).
const BOTTOM_LIMIT = FOOT_Y + 34;
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYOUT CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

function rrPath(w, h, r) {
  const k = KP * r;
  return `M ${r} 0 L ${w - r} 0 C ${w - r + k} 0 ${w} ${r - k} ${w} ${r} L ${w} ${h - r} C ${w} ${h - r + k} ${w - r + k} ${h} ${w - r} ${h} L ${r} ${h} C ${r - k} ${h} 0 ${h - r + k} 0 ${h - r} L 0 ${r} C 0 ${r - k} ${r - k} 0 ${r} 0 Z`;
}
function drawRR(pg, x, y, w, h, r, color, opacity = 1) {
  pg.drawSvgPath(rrPath(w, h, r), {
    x,
    y: y + h,
    color,
    opacity
  }); // svg path y-down; shift to top
}

/** Pixagram style: anything thicker than 2px gets slightly rounded corners; thin rules stay sharp. */
function bar(pg, x, y, w, h, color, opacity = 1) {
  if (Math.min(w, h) > 2) drawRR(pg, x, y, w, h, Math.min(2.5, Math.min(w, h) / 2), color, opacity);else pg.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    color,
    opacity
  });
}

// Pixagram logo mark, embedded as a non-interlaced PNG so pdf-lib can draw it.
const LOGO_PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAVsAAAFbAQMAAABBAb+uAAAABlBMVEX+/v4BAQF0nCXuAAABZElEQVR42u3aMY6FIBDGcYgFJUfwKB5NjuZROIIlBYHdvGJ5kOwMw0qWvHz/SpNfIYjJFCqEEEIITWzLvxdafGQi1+BM5Ymn4J7DkDjW2JI4EevjVnjS+KpwpvPDWDP4JraZ3mjD4DiMLYPTMN4z04L44LD7PFxe3Mnjcn4sj8sxNjwuH8gmwboPezlWwMCr4nsaDhIcJTjRuC1KcHYS7CX4luCwBo7rY1W3Uzg22FD4brCmsFdNFL5afD6FXYuPp7Bq2xfBSYh1N84i7NTWjy9l+/F3wMDAwP+G9evy7sPmdRn7sC0zHYMLeBqXGwcMDAwMDAz8GXj+CMFPMvyMxE9fmEWBgYGBgTl8TMPnNJwFWEuwkeC9A+efgIGBgYGBgf+Adw6r9bBlcBrGhsFxGG8MDu9YM/hW7zHYj+OTxleFDxq7ClsSJ1VlSBxrvJE4qDoS+wYfFHYN3ggc8LM8QgghNLMvheF1PT8iSCUAAAAASUVORK5CYII=";
function b64ToBytes(b64) {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(b64, "base64"));
  const bin = atob(b64),
      a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a;
}
// ---- language ---------------------------------------------------------------

/**
 * Without opts.i18n (Node, tests): keys print as themselves and numbers and
 * dates use en-US — never throws. The app passes a translator from
 * utils/docLanguage.js instead; any object with this shape will do.
 */
function keyTranslator() {
  const isTk = (x) => !!x && typeof x === "object" && typeof x.$t === "string";
  const number = (n, d) => {
    const dp = typeof d === "number" ? { min: d, max: d } : (d || { min: 0, max: 4 });
    return Number(n).toLocaleString("en-US", { minimumFractionDigits: dp.min, maximumFractionDigits: dp.max });
  };
  const t = (key, vars) => (vars ? `${key} ${JSON.stringify(vars)}` : key);
  const text = (x) => (isTk(x) ? t(x.$t, x.v) : Array.isArray(x) ? x.map(text).join("") : x == null ? "" : String(x));
  const date = (d, o) => {
    const s = String(d || "");
    const v = new Date(/^\d{4}-\d{2}$/.test(s) ? `${s}-01T00:00:00Z` : /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00Z` : s);
    return Number.isNaN(v.getTime()) ? s : new Intl.DateTimeFormat("en-US", Object.assign({ timeZone: "UTC" }, o || { dateStyle: "medium" })).format(v);
  };
  return { lang: "en", locale: "en-US", t, text, number, date, upper: (s) => String(s).toUpperCase() };
}

// Non-finite values print "n/a" (a NaN valuation must never pass for a real
// zero), and amounts that round to zero never print as "-0.00". Formatted in
// the document's locale.
const makeFmt = (tr) => (n, dp = 2) => {
  const v = n == null ? NaN : Number(n);
  if (!Number.isFinite(v)) return tr.t("components.tax_report.not_available");
  const shown = Math.round(v * 10 ** dp) / 10 ** dp === 0 ? 0 : v;
  return tr.number(shown, dp);
};

// Dates: the engine's ISO strings ("2025-12-31", timestamps, "2025-06" months)
// shown in the document's language, always as the UTC calendar day.
const dayOf = (tr, iso) => (iso ? tr.date(String(iso).slice(0, 10)) : "");
const monthOf = (tr, ym) => tr.date(String(ym).slice(0, 7), { year: "numeric", month: "short" });

// Display names. PIXA is the ticker; PXA is only the engine's internal alias
// (kept as-is in the CSV exports, which the Basis section states). PXP is Pixa
// Power, i.e. staked PIXA.
const ASSET_LABELS = { PXA: "PIXA" };
const assetName = (a) => ASSET_LABELS[a] || a;

// "1,800.0000 PIXA  ·  12.0000 PXS" — full per-asset breakdown for a row sub-line,
// so token amounts are shown in full instead of truncated inside a column.
const assetBreakdown = (fmt, byAsset, dp = 4) =>
    Object.entries(byAsset || {}).map(([a, q]) => `${fmt(q, dp)} ${assetName(a)}`).join("   \u00b7   ");

// The standard PDF fonts (Helvetica) use WinAnsi (CP1252) encoding, and pdf-lib
// THROWS on any character outside it. The old filter only caught U+2000 and up,
// so the Hebrew in the Israel note (U+05xx) aborted the whole export, and the
// CJK terms in the Japan/Korea notes printed as "???". Every string is now
// normalised before drawing: typographic glyphs map to ASCII, currency signs
// WinAnsi lacks become ISO codes, the non-Latin terms the jurisdiction notes
// cite are romanised, accented letters outside CP1252 lose their accent, and
// anything still unencodable becomes "?" (runs collapsed; a parenthesis holding
// nothing printable is dropped).
//
// Translations: normalize() is the lossless part (typography, spaces, the
// romanised legal terms). A language whose strings are all WinAnsi after it —
// printableInReport() — gets a translated PDF; any other (Polish, Czech,
// Turkish, Greek, Cyrillic, CJK…) gets English, so the lossy part of safe()
// (accent stripping, "?") only ever touches user data, never a translation.
// Narrow and figure spaces (fr/ch digit grouping) become a no-break space so a
// number never wraps; wrap() breaks on ordinary spaces only. The romanised
// terms carry no English gloss: they are printed inside every language, like
// the other local professions the notes name (Steuerberater, contador...).
const WINANSI_HIGH = "\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D" +
    "\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178";
const winAnsi = (c) => {
  const p = c.codePointAt(0);
  return (p >= 0x20 && p <= 0x7e) || (p >= 0xa0 && p <= 0xff) || WINANSI_HIGH.includes(c);
};
const TRANSLIT = [
  [/\u2192/g, "->"], [/\u2190/g, "<-"], [/\u2194/g, "<->"], [/\u21D2/g, "=>"], [/\u21D0/g, "<="],
  [/\u2212/g, "-"], [/[\u2032\u2035]/g, "'"], [/\u2264/g, "<="], [/\u2265/g, ">="], [/\u2248/g, "~"],
  [/[\u202F\u2007]/g, "\u00A0"], [/[\u2000-\u2006\u2008-\u200A\u205F\u3000]/g, " "], [/[\u200B-\u200D\u2060\uFEFF]/g, ""],
  [/[\u2010-\u2012]/g, "-"], [/\u2015/g, "\u2014"], [/\u2033/g, "\""],
  [/\u20A9\s*/g, "KRW "], [/\u20B9\s*/g, "INR "], [/\u20A6\s*/g, "NGN "],
  [/\u96D1\u6240\u5F97/g, "zatsu shotoku"],                          // JP: miscellaneous income
  [/\u7DCF\u5E73\u5747\u6CD5/g, "so-heikin-ho"],                       // JP: total-average method
  [/\u79FB\u52D5\u5E73\u5747\u6CD5/g, "ido-heikin-ho"],                // JP: moving-average method
  [/\u56FD\u5916\u8CA1\u7523\u8ABF\u66F8/g, "kokugai zaisan chosho"],  // JP: overseas assets report
  [/\u7A0E\u7406\u58EB/g, "zeirishi"],                                 // JP: licensed tax accountant
  [/\uC138\uBB34\uC0AC/g, "semusa"],                                   // KR: licensed tax accountant
  [/\u05E8\u05D5\u05D0\u05D4 \u05D7\u05E9\u05D1\u05D5\u05DF/g, "roeh heshbon"]       // IL: CPA
];
function normalize(s) {
  s = String(s == null ? "" : s).replace(/[\u0000-\u001F\u007F]/g, " ");
  for (const [re, to] of TRANSLIT) s = s.replace(re, to);
  return s;
}

/**
 * Can the report print this string without losing anything? The `canPrint`
 * a caller hands to utils/docLanguage.js renderInDocLanguage() for this PDF.
 */
export function printableInReport(s) {
  for (const c of normalize(s)) if (!winAnsi(c)) return false;
  return true;
}

function safe(s) {
  if (s == null) return "";
  s = normalize(s);
  s = s.replace(/\s*\(([^()]*)\)/g, (m, inner) => ([...inner].some(c => winAnsi(c) && /\S/.test(c)) ? m : ""));
  let out = "";
  for (const c of s) {
    if (winAnsi(c)) {
      out += c;
      continue;
    }
    const base = c.normalize("NFD").replace(/[\u0300-\u036F]/g, "");
    out += base && [...base].every(winAnsi) ? base : "?";
  }
  return out.replace(/\?{2,}/g, "?");
}

// Largest font size <= `size` (down to `min`) at which `s` fits in `maxW`.
function fitSize(s, font, size, maxW, min = 6) {
  const t = safe(s);
  let z = size;
  while (z > min && font.widthOfTextAtSize(t, z) > maxW) z -= 0.25;
  return z;
}

// Report fingerprint: SHA-256 over the COMPACT JSON serialisation of the data
// bundle this PDF was rendered from, so the document can be tied to its
// CSV/JSON exports. WebCrypto is available in browsers and modern Node; when it
// isn't, the cover says so instead of failing the render.
async function sha256Hex(str) {
  try {
    const subtle = globalThis.crypto && globalThis.crypto.subtle;
    if (!subtle) return null;
    const d = await subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, "0")).join("");
  } catch (e) {
    return null;
  }
}

// Labels for the engine's codes, in the document's language (the catalogue
// romanises the Japanese method name: Helvetica is WinAnsi). Each entry calls
// tr.t() with a literal key so the i18n check can see it.
const METHOD_LABELS = {
  FIFO: (tr) => tr.t("components.tax_report.method_fifo"),
  LIFO: (tr) => tr.t("components.tax_report.method_lifo"),
  HIFO: (tr) => tr.t("components.tax_report.method_hifo"),
  POOL: (tr) => tr.t("components.tax_report.method_pool"),
  TOTAL_AVG: (tr) => tr.t("components.tax_report.method_total_avg")
};
const methodLabel = (tr, m) => (METHOD_LABELS[m] ? METHOD_LABELS[m](tr) : String(m || ""));
const TIMING_LABELS = {
  claim: (tr) => tr.t("components.tax_report.timing_claim"),
  accrual: (tr) => tr.t("components.tax_report.timing_accrual")
};
const timingLabel = (tr, k) => (TIMING_LABELS[k] ? TIMING_LABELS[k](tr) : String(k || ""));

// Human labels for the engine's category codes (the tables used to print the
// raw codes: "reward_claim", "market_fill", "delegation_out" ...).
const CATEGORY_LABELS = {
  reward_author: (tr) => tr.t("components.tax_report.category_reward_author"),
  reward_curation: (tr) => tr.t("components.tax_report.category_reward_curation"),
  reward_benefactor: (tr) => tr.t("components.tax_report.category_reward_benefactor"),
  reward_claim: (tr) => tr.t("components.tax_report.category_reward_claim"),
  proposal_income: (tr) => tr.t("components.tax_report.category_proposal_income"),
  savings_interest: (tr) => tr.t("components.tax_report.category_savings_interest"),
  transfer_out: (tr) => tr.t("components.tax_report.category_transfer_out"),
  swap: (tr) => tr.t("components.tax_report.category_swap"),
  market_fill: (tr) => tr.t("components.tax_report.category_market_fill")
};
const catLabel = (tr, c) => (CATEGORY_LABELS[c] ? CATEGORY_LABELS[c](tr) : c);
const SOURCE_LABELS = {
  fta_list: (tr) => tr.t("components.tax_report.source_fta_list"),
  platform_price: (tr) => tr.t("components.tax_report.source_platform_price"),
  cost_basis: (tr) => tr.t("components.tax_report.source_cost_basis")
};
const sourceLabel = (tr, s) => (SOURCE_LABELS[s] ? SOURCE_LABELS[s](tr) : s);

// True when the price source could not value something in the report currency
// (a fiat missing from the provider makes every valuation NaN). The old report
// printed "NaN" in tables and a silent 0.00 in the per-token totals; now those
// figures print "n/a" and the summary page and the review section say why.
function unpricedFigures(b) {
  const bad = (v) => v == null || !Number.isFinite(Number(v));
  const ps = b.priceSnapshot;
  if (ps && (ps.PXA == null || ps.PXS == null)) return true;
  const sets = [
    [(b.wealth && b.wealth.lines) || [], ["valueFiat", "fiatPerUnit"]],
    [(b.transactions && b.transactions.lines) || [], ["proceedsFiat", "basisFiat", "gainFiat"]],
    [(b.operations && b.operations.lines) || [], ["fmvFiat"]]
  ];
  return sets.some(([lines, keys]) => lines.some(l => keys.some(k => bad(l[k]))));
}
// The engine sums per-bucket gains with `|| 0`, so an unpriced disposal turns
// into a taxable gain of exactly 0.00. When any disposal is unpriced, the
// derived gain totals print "n/a" too.
const txUnpriced = (b) => ((b.transactions && b.transactions.lines) || [])
    .some(l => l.proceedsFiat == null || !Number.isFinite(Number(l.proceedsFiat)));
const unpricedMessage = (tr, b) => tr.t("components.tax_report.some_figures_could_not_be_valued_in", {
  fiat: b.fiat,
  na: tr.t("components.tax_report.not_available")
});

// Are this report's gains taxed at all? "exempt" when there are disposals but
// none carries a taxable lot (Swiss private investor, FR/AT before conversion
// to fiat, KR before 2027, private SG/AE/HK holders, DE/PT long-term only...).
function gainsRegime(b) {
  const lines = (b.transactions && b.transactions.lines) || [];
  if (!lines.length) return "none";
  return lines.some(l => l.taxable) ? "taxable" : "exempt";
}

// Treatment of outbound sends. The engine's outboundByIntent[..].taxable flag
// only means "is a disposal" — whether the gain is TAXED comes from the
// transfer_out disposal lines themselves (always "no" for a Swiss private
// investor, which the report used to print as "Taxable disposal").
function sendDisposals(tr, b) {
  const out = ((b.transactions && b.transactions.lines) || []).filter(l => l.category === "transfer_out");
  const taxed = out.filter(l => l.taxable).length;
  const label = !out.length ? tr.t("components.tax_report.disposal")
      : taxed === 0 ? tr.t("components.tax_report.disposal_gain_not_taxed_here")
          : taxed === out.length ? tr.t("components.pixa_wallet_taxes_dialog.treat_taxable_disposal")
              : tr.t("components.tax_report.disposal_partly_taxable");
  return { count: out.length, taxed, label };
}
function outboundTreatment(tr, kind, slot, send) {
  if (kind === "payment") return send.label;
  if (kind === "own_exchange") return tr.t("components.pixa_wallet_taxes_dialog.treat_sale_is_off_platform");
  if (kind === "own") return tr.t("components.pixa_wallet_taxes_dialog.treat_internal_not_a_disposal");
  if (kind === "gift") {
    return slot.taxable
        ? tr.t("components.pixa_wallet_taxes_dialog.treat_disposal_at_market_value")
        : tr.t("components.pixa_wallet_taxes_dialog.treat_not_a_disposal_here");
  }
  if (kind === "charity") {
    return slot.taxable
        ? tr.t("components.pixa_wallet_taxes_dialog.treat_treated_as_a_disposal")
        : tr.t("components.pixa_wallet_taxes_dialog.treat_exempt_donation");
  }
  return "";
}

// What price basis the figures actually used. The report used to state "single
// snapshot applied to all dates" unconditionally, which is false whenever the
// provider prices each event at its own date (the engine always asks for the
// event's timestamp). An explicit opts.priceMode wins; otherwise the unit prices
// implied by the income and disposal lines tell: one price per token across
// different days means a snapshot. Lines under 1 unit of fiat are ignored so
// 2-decimal rounding cannot fake a difference.
function detectPriceMode(b, opts) {
  const explicit = opts.priceMode || (b.priceSnapshot && b.priceSnapshot.mode);
  if (explicit === "historical" || explicit === "snapshot") return explicit;
  const byAsset = new Map();
  const add = (asset, qty, value, ts) => {
    if (!(qty > 0) || !(Math.abs(value) >= 1)) return;
    const u = Math.abs(value) / qty;
    const a = byAsset.get(asset) || { min: Infinity, max: -Infinity, days: new Set() };
    a.min = Math.min(a.min, u);
    a.max = Math.max(a.max, u);
    a.days.add(String(ts).slice(0, 10));
    byAsset.set(asset, a);
  };
  for (const l of (b.operations && b.operations.lines) || []) add(l.asset, l.qtyIn, l.fmvFiat, l.ts);
  for (const l of (b.transactions && b.transactions.lines) || []) add(l.asset, l.qtyOut, l.proceedsFiat, l.ts);
  let comparable = false;
  for (const a of byAsset.values()) {
    if (a.days.size < 2) continue;
    comparable = true;
    if (a.max / a.min - 1 > 0.01) return "historical";
  }
  return comparable ? "snapshot" : "unknown";
}
function priceBasisText(tr, b, mode) {
  const ps = b.priceSnapshot;
  const version = b.priceDataVersion || tr.t("components.tax_report.not_available");
  const asOf = ps ? `${dayOf(tr, ps.asOf)} ${ps.timezone}` : dayOf(tr, b.periodEnd);
  if (mode === "snapshot") return tr.t("components.tax_report.price_basis_snapshot", { version, asOf });
  if (mode === "historical") return tr.t("components.tax_report.price_basis_historical", { version, asOf });
  return tr.t("components.tax_report.price_basis_unknown", { version, asOf });
}

function text(pg, s, x, y, size, font, color = INK) {
  pg.drawText(safe(s), {
    x,
    y,
    size,
    font,
    color
  });
}
function textR(pg, s, xRight, y, size, font, color = INK) {
  const t = safe(s);
  pg.drawText(t, {
    x: xRight - font.widthOfTextAtSize(t, size),
    y,
    size,
    font,
    color
  });
}
function ellipsize(s, font, size, maxW) {
  s = safe(s);
  if (font.widthOfTextAtSize(s, size) <= maxW) return s;
  let t = s;
  while (t.length > 1 && font.widthOfTextAtSize(t + "…", size) > maxW) t = t.slice(0, -1);
  return t + "…";
}
function newPage(ctx, continuation) {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  if (continuation) {
    bar(ctx.page, MRG, PAGE_H - MRG + 10, CONTENT_W, 2.5, ACCENT); // marks continuation pages only
    text(ctx.page, "PIXAGRAM", MRG, PAGE_H - MRG, 9, ctx.f.bold, INK);
    textR(ctx.page, ctx.tr.t("components.tax_report.tax_report_year_continued", { year: String(ctx.bundle.year) }), PAGE_W - MRG, PAGE_H - MRG, 9, ctx.f.regular, SUB);
    ctx.y = PAGE_H - MRG - 22;
  } else {
    ctx.y = PAGE_H - MRG;
  }
}
function ensure(ctx, needed) {
  if (ctx.y - needed < BOTTOM_LIMIT) newPage(ctx, true);
}

// ═══════════════════════════════════════════════════════════════════════════
// HEADER (first page)
// ═══════════════════════════════════════════════════════════════════════════

function drawHeader(ctx) {
  const b = ctx.bundle,
      pg = ctx.page,
      tr = ctx.tr,
      fmt = ctx.fmt;
  let y = PAGE_H - MRG - 6;

  // right meta block
  const meta = [
    tr.t("components.tax_report.generated_date", { date: dayOf(tr, b.generatedAt) }),
    tr.t("components.tax_report.ruleset_version", { version: String(b.rulesVersion || "") }),
    tr.t("components.tax_report.prices_version", { version: String(b.priceDataVersion || "") })
  ];
  meta.forEach((m, i) => textR(pg, m, PAGE_W - MRG, y - i * 11, 8, ctx.f.regular, SUB));

  // logo mark + headline lockup
  y -= 16;
  const titleBaseline = y,
      titleCenter = titleBaseline + 8;
  let titleX = MRG;
  if (ctx.logo) {
    // Fit the artwork inside a bounding box WITHOUT distorting it: scale to the
    // box height, but never exceed the max width (so a wide wordmark stays legible).
    const BOX_H = 34, MAX_W = 170;
    const natW = ctx.logo.width || 1, natH = ctx.logo.height || 1;
    const k = Math.min(BOX_H / natH, MAX_W / natW);
    const lw = natW * k, lh = natH * k;
    pg.drawImage(ctx.logo, {
      x: MRG,
      y: titleCenter - lh / 2,
      width: lw,
      height: lh
    });
    titleX = MRG + lw + 14;
  }
  text(pg, tr.t("components.tax_report.tax_report_year", { year: String(b.year) }), titleX, titleBaseline, 23, ctx.f.bold, INK);
  y -= 20;
  text(pg, tr.t("components.tax_report.header_account_line", { account: b.account, jurisdiction: b.jurisdiction, fiat: b.fiat }), titleX, y, 10, ctx.f.regular, SUB);
  y -= 16;
  bar(pg, MRG, y, CONTENT_W, 1.8, ACCENT);
  y -= 16;

  // KPI cards. Each card says what its figure IS here: the first is the tax
  // value of the on-platform holdings (it was labelled "net wealth", but the
  // report knows no liabilities), and when no gain is taxed (e.g. a Swiss
  // private investor) the second says so instead of a bare "TAXABLE AMOUNT 0.00".
  // Labels and values shrink to fit, so JPY/KRW/IDR amounts stay inside.
  // Card labels are catalogue text in normal case, upper-cased per locale.
  const cards = [];
  if (b.wealth) {
    cards.push([tr.upper(tr.t("components.tax_report.holdings_value_at", { date: dayOf(tr, b.wealth.refDate) })), `${fmt(b.wealth.totalFiat)} ${b.fiat}`,
      b.jurisdiction === "CH"
          ? tr.t("components.tax_report.declare_as_wealth_securities_list")
          : tr.t("components.tax_report.tax_value_of_on_platform_holdings")]);
  }
  if (b.transactions) {
    const regime = gainsRegime(b);
    if (regime === "exempt") {
      cards.push([tr.upper(tr.t("components.tax_report.capital_gains_record_only")), `${fmt(b.transactions.totalGainFiat)} ${b.fiat}`,
        b.jurisdiction === "CH"
            ? tr.t("components.tax_report.tax_exempt_for_a_private_investor")
            : tr.t("components.tax_report.not_taxed_as_a_capital_gain_here")]);
    } else {
      cards.push([tr.upper(tr.t("components.tax_report.taxable_amount")), `${fmt(txUnpriced(b) ? NaN : (b.transactions.taxableAmountFiat ?? b.transactions.taxableGainFiat))} ${b.fiat}`,
        regime === "none" ? tr.t("components.tax_report.no_disposals_this_period")
            : b.transactions.deductionSteps ? tr.t("components.tax_report.after_the_deductions_shown")
                : tr.t("components.tax_report.gains_on_disposals")]);
    }
  }
  if (b.operations) {
    cards.push([tr.upper(tr.t("components.tax_report.income_taxed_at_receipt")), `${fmt(b.operations.totalIncomeFiat)} ${b.fiat}`,
      b.operations.deferredIncomeFiat
          ? tr.t("components.tax_report.plus_received_at_zero_cost_basis", { amount: fmt(b.operations.deferredIncomeFiat) })
          : tr.t("components.tax_report.rewards_and_interest_value_on_receipt")]);
  }
  const gap = 10,
      cw = cards.length ? (CONTENT_W - gap * (cards.length - 1)) / cards.length : CONTENT_W,
      ch = 56;
  cards.forEach(([label, val, caption], i) => {
    const x = MRG + i * (cw + gap),
        tw = cw - 28;
    drawRR(pg, x, y - ch, cw, ch, 7, ZEBRA);
    bar(pg, x + 9, y - ch + 6, 3, ch - 12, ACCENT); // rounded accent edge, inset off the card corners
    text(pg, label, x + 20, y - 15, fitSize(label, ctx.f.bold, 7, tw, 5.5), ctx.f.bold, SUB);
    text(pg, val, x + 20, y - 34, fitSize(val, ctx.f.bold, 14, tw, 8), ctx.f.bold, INK);
    if (caption) text(pg, ellipsize(caption, ctx.f.regular, 7, tw), x + 20, y - 47, 7, ctx.f.regular, SUB);
  });

  // Valuation basis — the exact unit prices and vesting ratio every figure was
  // computed from, so the report is auditable and not a black box.
  const ps = b.priceSnapshot;
  if (ps) {
    const yy = y - ch - 16;
    const px = (a, v) => `${a} ${fmt(v, 4)}`;   // fmt prints n/a for a missing price
    const parts = [px("PIXA", ps.PXA), px("PXS", ps.PXS), `${px("PXP", ps.PXP)} (= PIXA)`];
    if (ps.vestingRatio != null) parts.push(`VESTS x ${fmt(ps.vestingRatio, 6)} = PXP`);
    text(pg, tr.t("components.tax_report.valuation_basis_prices_in", { date: `${dayOf(tr, ps.asOf)} ${ps.timezone}`, fiat: ps.fiat }), MRG, yy, 7.5, ctx.f.bold, SUB);
    text(pg, parts.join("      "), MRG, yy - 11, 8, ctx.f.regular, INK);
    ctx.y = yy - 24;
  } else {
    ctx.y = y - ch - 22;
  }
  if (unpricedFigures(b)) {
    for (const ln of wrap(unpricedMessage(tr, b), ctx.f.bold, 8, CONTENT_W)) {
      text(pg, ln, MRG, ctx.y - 2, 8, ctx.f.bold, INK);
      ctx.y -= 11;
    }
    ctx.y -= 6;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION + TABLE
// ═══════════════════════════════════════════════════════════════════════════

// Sequential section numbers regardless of which sections a jurisdiction emits
// (no stray "T", and no gaps when wealth/movements are absent).
function nextSection(ctx) { return String(ctx.section = (ctx.section || 0) + 1); }
function sectionTitle(ctx, n, title, note, keepWith = 0) {
  const lines = note ? wrap(note, ctx.f.oblique, 8, CONTENT_W) : [];
  // Keep the heading with the start of its note and of the table that follows
  // (it used to reserve 54pt only, orphaning headings at the foot of a page).
  // `keepWith` = height of a short table that should move with the heading.
  const whole = 34 + lines.length * 11 + keepWith;
  ensure(ctx, keepWith && keepWith <= KEEP_TOGETHER_MAX && whole <= 420
      ? whole
      : 30 + Math.min(lines.length, 3) * 11 + TABLE_MIN);
  const pg = ctx.page;
  text(pg, `${n}   ${title}`, MRG, ctx.y - 10, 12.5, ctx.f.bold, INK);
  ctx.y -= 18;
  bar(pg, MRG, ctx.y + 2, CONTENT_W, 1.2, ACCENT); // heavier rule anchors the section
  ctx.y -= 8;
  // Long notes (JP, IN, BR, ZA, AR...) run 10+ lines: paginate line by line
  // instead of drawing through the footer.
  for (const ln of lines) {
    if (ctx.y - 11 < BOTTOM_LIMIT) newPage(ctx, true);
    text(ctx.page, ln, MRG, ctx.y - 8, 8, ctx.f.oblique, SUB);
    ctx.y -= 11;
  }
  ctx.y -= 4;
}
function wrap(s, font, size, maxW) {
  // Ordinary spaces only: a no-break space (digit grouping, French typography)
  // keeps its neighbours on one line.
  const words = safe(s).split(/ +/),
      out = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (font.widthOfTextAtSize(t, size) > maxW && cur) {
      out.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) out.push(cur);
  return out;
}
const ROW_H = 17,
    HEAD_H = 20;
const TABLE_MIN = 10 + HEAD_H + ROW_H; // a table's top gap + header + first row
// Full height of a table: top gap, header, rows (taller with a sub-line) and
// the totals block. Tables up to KEEP_TOGETHER_MAX are kept in one piece — and
// with their section heading — instead of leaving one row and the total
// stranded on the next page.
function tableHeight(rows, hasTotals) {
  return 10 + HEAD_H + rows.reduce((h, r) => h + (r.sub ? ROW_H + 9 : ROW_H), 0) + (hasTotals ? 33 : 0);
}
const KEEP_TOGETHER_MAX = 260;
function drawTableHeader(ctx, cols) {
  const pg = ctx.page;
  drawRR(pg, MRG, ctx.y - HEAD_H, CONTENT_W, HEAD_H, 4, HEAD);
  let x = MRG;
  for (const c of cols) {
    if (c.align === "l") text(pg, c.title, x + 7, ctx.y - 13.5, 8, ctx.f.bold, WHITE);else textR(pg, c.title, x + c.w - 7, ctx.y - 13.5, 8, ctx.f.bold, WHITE);
    x += c.w;
  }
  ctx.y -= HEAD_H;
}

/** Generic table with zebra rows, page-break-aware (re-draws header), + totals row. */
function drawTable(ctx, cols, rows, totals) {
  // Breathing room above every table, and never orphan a header at a page foot.
  const whole = tableHeight(rows, !!totals);
  ensure(ctx, whole <= KEEP_TOGETHER_MAX ? whole : TABLE_MIN);
  ctx.y -= 10;
  drawTableHeader(ctx, cols);
  let zebra = false;
  for (const row of rows) {
    // A row may carry `sub` — a tiny second line (e.g. timestamp + transaction id)
    // drawn under the left columns. It makes the row taller.
    const rh = row.sub ? ROW_H + 9 : ROW_H;
    if (ctx.y - rh < BOTTOM_LIMIT) {
      newPage(ctx, true);
      drawTableHeader(ctx, cols);
      zebra = false;
    }
    if (zebra) pg_rect(ctx, ctx.y - rh, rh, ZEBRA);
    zebra = !zebra;
    let x = MRG;
    row.cells.forEach((cell, i) => {
      const col = cols[i],
          color = row.colors?.[i] ?? INK;
      const t = col.align === "l" ? ellipsize(cell, ctx.f.regular, 8.5, col.w - 14) : cell;
      if (col.align === "l") text(ctx.page, t, x + 7, ctx.y - 12, 8.5, ctx.f.regular, color);else textR(ctx.page, t, x + col.w - 7, ctx.y - 12, 8.5, ctx.f.regular, color);
      x += col.w;
    });
    if (row.sub) {
      text(ctx.page, ellipsize(row.sub, ctx.f.regular, 6.5, CONTENT_W - 14), MRG + 7, ctx.y - 21, 6.5, ctx.f.regular, MUTED);
    }
    ctx.y -= rh;
  }
  // baseline
  ctx.page.drawRectangle({
    x: MRG,
    y: ctx.y,
    width: CONTENT_W,
    height: 0.8,
    color: LINE
  });
  if (totals) {
    if (ctx.y - ROW_H < BOTTOM_LIMIT) newPage(ctx, true);
    ctx.y -= 4;
    const totalBaseline = ctx.y - 11;
    let x = MRG;
    totals.cells.forEach((cell, i) => {
      const col = cols[i],
          color = totals.colors?.[i] ?? INK;
      if (!cell) {
        x += col.w;
        return;
      }
      if (col.align === "l") text(ctx.page, cell, x + 7, totalBaseline, 8.5, ctx.f.bold, color);else textR(ctx.page, cell, x + col.w - 7, totalBaseline, 8.5, ctx.f.bold, color);
      x += col.w;
    });
    // heavy bottom rule sits a few px below the total text + number
    const ruleY = totalBaseline - 8;
    ctx.page.drawRectangle({
      x: MRG,
      y: ruleY,
      width: CONTENT_W,
      height: 1.4,
      color: INK
    });
    ctx.y = ruleY - 10;
  }
  ctx.y -= 20; // breathing room below every table
}
function pg_rect(ctx, y, h, color) {
  bar(ctx.page, MRG, y, CONTENT_W, h, color);
}

// scale a set of column widths to fill CONTENT_W
function fit(cols) {
  const sum = cols.reduce((s, c) => s + c.w, 0);
  const k = CONTENT_W / sum;
  return cols.map(c => ({
    ...c,
    w: c.w * k
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// THE THREE SECTIONS
// ═══════════════════════════════════════════════════════════════════════════

function csvNote(ctx, msg) {
  const lines = wrap(msg, ctx.f.oblique, 8, CONTENT_W);
  ensure(ctx, (lines.length <= 4 ? lines.length : 2) * 11 + 8); // short notes stay in one piece
  for (const ln of lines) {
    if (ctx.y - 11 < BOTTOM_LIMIT) newPage(ctx, true);
    text(ctx.page, ln, MRG, ctx.y - 8, 8, ctx.f.oblique, SUB);
    ctx.y -= 11;
  }
  ctx.y -= 8;
}
function renderWealth(ctx, r) {
  const tr = ctx.tr, fmt = ctx.fmt;
  const title = tr.t("components.pixa_wallet_taxes_dialog.section_wealth_statement");
  const note = tr.text(r.note);
  if (!r.lines.length) {
    sectionTitle(ctx, nextSection(ctx), title, note);
    para(ctx, tr.t("components.tax_report.no_on_platform_holdings_at", { date: dayOf(tr, r.refDate) }), { size: 9, color: INK, gap: 10 });
    return;
  }
  const cols = fit([{
    title: tr.t("components.tax_report.col_asset"),
    w: 60,
    align: "l"
  }, {
    title: tr.t("components.tax_report.col_quantity"),
    w: 92,
    align: "r"
  }, {
    title: tr.t("components.tax_report.col_unit_fiat", { fiat: r.fiat }),
    w: 86,
    align: "r"
  }, {
    title: tr.t("components.tax_report.col_value_fiat", { fiat: r.fiat }),
    w: 96,
    align: "r"
  }, {
    title: tr.t("components.tax_report.col_valuation_source"),
    w: 110,
    align: "l"
  }]);
  const rows = r.lines.map(l => ({
    cells: [assetName(l.asset), fmt(l.qty, 4), fmt(l.fiatPerUnit, 4), fmt(l.valueFiat), sourceLabel(tr, l.source)],
    sub: l.asset === "PXP" ? tr.t("components.tax_report.pixa_power_staked_pixa_you_own") : undefined
  }));
  sectionTitle(ctx, nextSection(ctx), title, note, tableHeight(rows, true));
  drawTable(ctx, cols, rows, {
    cells: [tr.t("components.tax_report.total"), "", "", `${fmt(r.totalFiat)}`, ""]
  });
  // Staked PIXA is the line users are most tempted to leave out (or declare at
  // zero), so the statement says plainly why it is in.
  if (r.lines.some(l => l.asset === "PXP")) {
    csvNote(ctx, tr.t("components.tax_report.pxp_pixa_power_is_pixa_you_have_staked"));
  }
  csvNote(ctx, tr.t("components.tax_report.per_asset_holdings_at_the_reference_date", { csv: ctx.csv }));
}
function renderTransactions(ctx, r) {
  const tr = ctx.tr, fmt = ctx.fmt;
  // A Swiss profile flagged as professional trader gets taxable lines; the
  // private-investor wording ("tax-free... listed for your records") and the
  // safe-harbour caveat would then contradict the figures below.
  const proCH = ctx.bundle.jurisdiction === "CH" && gainsRegime(ctx.bundle) === "taxable";
  const note = proCH
      ? tr.t("components.tax_report.this_report_treats_you_as_a_professional")
      : [
        tr.text(r.note),
        r.safeHarbourCheck ? tr.t("components.tax_report.disposals_this_period", { count: fmt(r.safeHarbourCheck.disposalCount, 0) }) : "",
        r.safeHarbourCheck ? tr.text(r.safeHarbourCheck.note) : ""
      ].filter(Boolean).join("  ");
  const title = tr.t("components.tax_report.transactions_disposals_swaps");
  if (!r.lines.length) {
    sectionTitle(ctx, nextSection(ctx), title, note);
    para(ctx, tr.t("components.tax_report.no_disposals_or_swaps_in_this_period"), { size: 9, color: INK, gap: 10 });
    return;
  }

  // sub-details: aggregate by type; every individual disposal goes to the CSV
  const by = new Map();
  let tp = 0,
      tb = 0;
  for (const l of r.lines) {
    const g = by.get(l.category) ?? {
      n: 0,
      proceeds: 0,
      basis: 0,
      gain: 0,
      byAsset: {}
    };
    g.n++;
    g.proceeds += l.proceedsFiat;
    g.basis += l.basisFiat;
    g.gain += l.gainFiat;
    g.byAsset[l.asset] = (g.byAsset[l.asset] || 0) + l.qtyOut;
    by.set(l.category, g);
    tp += l.proceedsFiat;
    tb += l.basisFiat;
  }
  const cols = fit([{
    title: tr.t("components.tax_report.col_type"),
    w: 132,
    align: "l"
  }, {
    title: tr.t("components.tax_report.col_count"),
    w: 52,
    align: "r"
  }, {
    title: tr.t("components.tax_report.col_proceeds_fiat", { fiat: r.fiat }),
    w: 92,
    align: "r"
  }, {
    title: tr.t("components.tax_report.col_cost_basis_fiat", { fiat: r.fiat }),
    w: 92,
    align: "r"
  }, {
    title: tr.t("components.tax_report.col_gain_fiat", { fiat: r.fiat }),
    w: 82,
    align: "r"
  }]);
  const rows = [...by.entries()].map(([cat, g]) => ({
    cells: [catLabel(tr, cat), fmt(g.n, 0), fmt(g.proceeds), fmt(g.basis), fmt(g.gain)],
    sub: assetBreakdown(fmt, g.byAsset)
  }));
  sectionTitle(ctx, nextSection(ctx), title, note, tableHeight(rows, true));
  drawTable(ctx, cols, rows, {
    cells: [tr.t("components.tax_report.total"), fmt(r.lines.length, 0), fmt(tp), fmt(tb), fmt(r.totalGainFiat)]
  });
  // By asset — one roll-up row per token: what was sold, at what cost, and how
  // much of the result is taxable vs exempt. (For no-set-off jurisdictions the
  // final taxable amount is governed by the computation table below, which
  // disregards losses; this view shows the raw per-asset arithmetic.)
  if (r.lines.length) {
    const byAsset = new Map();
    for (const l of r.lines) {
      const a = byAsset.get(l.asset) ?? { n: 0, proceeds: 0, basis: 0, gain: 0, taxable: 0, exempt: 0 };
      a.n++;
      a.proceeds += l.proceedsFiat;
      a.basis += l.basisFiat;
      a.gain += l.gainFiat;
      a.taxable += (l.shortTermGainFiat || 0) + (l.longTermGainFiat || 0);
      a.exempt += l.exemptGainFiat || 0;
      byAsset.set(l.asset, a);
    }
    const acols = fit([
      { title: tr.t("components.tax_report.col_asset"), w: 64, align: "l" },
      { title: tr.t("components.tax_report.col_disposals"), w: 60, align: "r" },
      { title: tr.t("components.tax_report.col_proceeds_fiat", { fiat: r.fiat }), w: 88, align: "r" },
      { title: tr.t("components.tax_report.col_cost_basis_fiat", { fiat: r.fiat }), w: 88, align: "r" },
      { title: tr.t("components.tax_report.col_gain_fiat", { fiat: r.fiat }), w: 74, align: "r" },
      { title: tr.t("components.tax_report.col_taxable"), w: 66, align: "r" },
      { title: tr.t("components.tax_report.col_exempt"), w: 60, align: "r" }
    ]);
    const arows = [...byAsset.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(([asset, a]) => ({
      cells: [assetName(asset), fmt(a.n, 0), fmt(a.proceeds), fmt(a.basis), fmt(a.gain), fmt(a.taxable), a.exempt ? fmt(a.exempt) : "-"]
    }));
    const ah = tableHeight(arows, false);
    ensure(ctx, 12 + (ah <= KEEP_TOGETHER_MAX ? ah : TABLE_MIN)); // keep the label with its table
    text(ctx.page, tr.t("components.tax_report.by_asset"), MRG, ctx.y - 9, 9, ctx.f.bold, INK);
    ctx.y -= 12;
    drawTable(ctx, acols, arows);
  }
  // What the gains mean here. Where no lot is taxable — a Swiss private
  // investor above all — the report used to print "Taxable gain: 0.00" and
  // "Taxable amount: 0.00" as if a computation had run; it now says plainly that
  // the gains are not taxed and why they are listed. Elsewhere the "Taxable
  // gain" line only appears when deductions make it differ from the amount.
  const jur = ctx.bundle.jurisdiction;
  const regime = gainsRegime(ctx.bundle);
  const amt = (v) => fmt(txUnpriced(ctx.bundle) ? NaN : v); // engine totals mask NaN as 0
  const steps = r.deductionSteps && r.deductionSteps.length ? r.deductionSteps : null;
  if (regime === "exempt") {
    para(ctx, jur === "CH"
            ? tr.t("components.tax_report.ch_gains_not_taxed_for_a_private_investor", { total: fmt(r.totalGainFiat), fiat: r.fiat })
            : tr.t("components.tax_report.none_of_these_gains_is_taxed_as_a_capital", { total: fmt(r.totalGainFiat), fiat: r.fiat, jurisdiction: jur }),
        { size: 9, color: INK, gap: 6 });
  } else if ((steps && steps.length > 1) || r.disallowedLossesFiat) {
    ensure(ctx, 16);
    text(ctx.page, tr.t("components.tax_report.taxable_gain_for", { jurisdiction: jur, amount: amt(r.taxableGainFiat), fiat: r.fiat }), MRG, ctx.y - 4, 9, ctx.f.bold, INK);
    ctx.y -= 14;
  }
  if (r.splitByTerm || (r.exemptGainFiat && regime !== "exempt")) {
    const parts = [];
    if (r.splitByTerm) {
      parts.push(tr.t("components.tax_report.split_short_term", { amount: amt(r.shortTermGainFiat) }),
          tr.t("components.tax_report.split_long_term", { amount: amt(r.longTermGainFiat) }));
    }
    if (r.exemptGainFiat) parts.push(tr.t("components.tax_report.split_tax_free", { amount: amt(r.exemptGainFiat) }));
    ensure(ctx, 12);
    text(ctx.page, tr.t("components.tax_report.gain_split", { parts: parts.join("  ·  "), fiat: r.fiat }), MRG, ctx.y - 2, 8.5, ctx.f.regular, SUB);
    ctx.y -= 12;
  }
  // UK share matching (same-day / 30-day / pool): quantities matched per HMRC's
  // ordering, aggregated across disposals. Present only on UK bundles.
  {
    let sd = 0, td = 0, pl = 0, any = false;
    for (const l of r.lines) {
      if (l.matchedSameDayQty || l.matchedThirtyDayQty) {
        any = true;
        sd += l.matchedSameDayQty || 0;
        td += l.matchedThirtyDayQty || 0;
        pl += l.pooledQty || 0;
      }
    }
    if (any) {
      ensure(ctx, 12);
      text(ctx.page, tr.t("components.tax_report.share_matching_summary", { same_day: fmt(sd, 4), thirty_day: fmt(td, 4), pool: fmt(pl, 4) }), MRG, ctx.y - 2, 8.5, ctx.f.regular, SUB);
      ctx.y -= 12;
    }
  }
  // Computation of taxable amount — a proper schedule instead of a chain string.
  // The informational disallowed-losses row (India: no set-off permitted) leads,
  // then each deduction step, with the final taxable amount as the bold total.
  if (regime !== "exempt" && ((steps && steps.length > 1) || r.disallowedLossesFiat)) {
    const cols = fit([
      { title: tr.t("components.tax_report.col_step"), w: 330, align: "l" },
      { title: tr.t("components.tax_report.col_amount_fiat", { fiat: r.fiat }), w: 130, align: "r" }
    ]);
    const allSteps = steps || [{ label: tr.t("components.pixa_tax_engine.taxable_gain"), value: r.taxableAmountFiat ?? r.taxableGainFiat }];
    const rows = [];
    if (r.disallowedLossesFiat) {
      rows.push({ cells: [tr.t("components.tax_report.losses_disregarded_informational"), fmt(r.disallowedLossesFiat)] });
    }
    for (const s of allSteps.slice(0, -1)) rows.push({ cells: [tr.text(s.label), fmt(s.value)] });
    const last = allSteps[allSteps.length - 1];
    ensure(ctx, 18 + tableHeight(rows, true)); // keep the heading with its schedule
    text(ctx.page, tr.t("components.tax_report.computation_of_taxable_amount"), MRG, ctx.y - 10, 9.5, ctx.f.bold, INK);
    ctx.y -= 18;
    drawTable(ctx, cols, rows, { cells: [tr.text(last.label), fmt(last.value)] });
  }
  if (regime !== "exempt") {
    ensure(ctx, 14);
    text(ctx.page, tr.t("components.tax_report.taxable_amount_for", { jurisdiction: jur, amount: amt(r.taxableAmountFiat), fiat: r.fiat }), MRG, ctx.y - 4, 9.5, ctx.f.bold, INK);
    ctx.y -= 14;
  }
  if (r.lossCarryforwardOutFiat) {
    ensure(ctx, 11);
    text(ctx.page, tr.t("components.tax_report.loss_to_carry_forward", { amount: fmt(r.lossCarryforwardOutFiat), fiat: r.fiat }), MRG, ctx.y - 2, 8.5, ctx.f.regular, SUB);
    ctx.y -= 12;
  }
  csvNote(ctx, tr.t("components.tax_report.summary_by_type_all_disposals", { count: fmt(r.lines.length, 0), csv: ctx.csv }));
}
function renderOperations(ctx, r) {
  const tr = ctx.tr, fmt = ctx.fmt;
  const title = tr.t("components.pixa_wallet_taxes_dialog.section_operations_income");
  const note = tr.text(r.note);
  if (!r.lines.length) {
    sectionTitle(ctx, nextSection(ctx), title, note);
    para(ctx, tr.t("components.tax_report.no_reward_or_interest_income_in_this"), { size: 9, color: INK, gap: 10 });
    return;
  }

  // sub-details: aggregate by income type; every individual receipt goes to the
  // CSV. Zero-basis jurisdictions (FR/AT) flag lines taxedAtReceipt=false —
  // those aggregate separately and are excluded from the income total, matching
  // the engine's totalIncomeFiat.
  const by = new Map();
  for (const l of r.lines) {
    const deferred = l.taxedAtReceipt === false;
    const key = deferred
        ? tr.t("components.tax_report.category_not_taxed_at_receipt", { category: catLabel(tr, l.category) })
        : catLabel(tr, l.category);
    const g = by.get(key) ?? {
      n: 0,
      amt: 0,
      byAsset: {},
      deferred
    };
    g.n++;
    g.amt += l.fmvFiat;
    g.byAsset[l.asset] = (g.byAsset[l.asset] || 0) + l.qtyIn;
    by.set(key, g);
  }
  const cols = fit([{
    title: tr.t("components.tax_report.col_income_type"),
    w: 210,
    align: "l"
  }, {
    title: tr.t("components.tax_report.col_count"),
    w: 64,
    align: "r"
  }, {
    title: tr.t("components.tax_report.col_amount_fiat", { fiat: r.fiat }),
    w: 106,
    align: "r"
  }]);
  const rows = [...by.entries()].map(([cat, g]) => ({
    cells: [cat, fmt(g.n, 0), fmt(g.amt)],
    sub: assetBreakdown(fmt, g.byAsset)
  }));
  const taxedCount = r.lines.filter(l => l.taxedAtReceipt !== false).length;
  sectionTitle(ctx, nextSection(ctx), title, note, tableHeight(rows, true));
  drawTable(ctx, cols, rows, {
    cells: [tr.t("components.tax_report.total_income_taxed_at_receipt"), fmt(taxedCount, 0), fmt(r.totalIncomeFiat)]
  });
  if (r.deferredIncomeFiat) {
    ensure(ctx, 12);
    text(ctx.page, tr.t("components.tax_report.received_but_not_taxed_at_receipt", { amount: fmt(r.deferredIncomeFiat), fiat: r.fiat }), MRG, ctx.y - 2, 8.5, ctx.f.regular, SUB);
    ctx.y -= 12;
  }
  // Rewards paid as staked PIXA are still income on receipt — not a later
  // capital gain — which is exactly the point users get wrong.
  if (r.lines.some(l => l.asset === "PXP")) {
    csvNote(ctx, tr.t("components.tax_report.rewards_paid_in_pxp_are_treated_like"));
  }
  if (ctx.priceMode === "snapshot") {
    csvNote(ctx, tr.t("components.tax_report.caution_these_values_use_one_snapshot"));
  }
  csvNote(ctx, tr.t("components.tax_report.summary_by_type_all_income_events", { count: fmt(r.lines.length, 0), csv: ctx.csv }));
}

// Itemized non-taxable movements: proposal fees, savings withdrawals, completed
// power-ups. Listed line-by-line; the table paginates via drawTable.
function renderMovements(ctx, movements) {
  if (!movements || !movements.length) return;
  const tr = ctx.tr, fmt = ctx.fmt;
  sectionTitle(ctx, nextSection(ctx), tr.t("components.tax_report.account_movements_fees_savings_staking"),
      tr.t("components.tax_report.not_taxable_disposals_or_income_proposal_fees"));
  // Labels shared with the wallet dialog where the wording is the same.
  const labels = {
    fee_payment: () => tr.t("components.pixa_wallet_taxes_dialog.movement_fee_paid"),
    savings_fill: () => tr.t("components.pixa_wallet_taxes_dialog.movement_savings_withdrawal"),
    power_down: () => tr.t("components.pixa_wallet_taxes_dialog.movement_power_down_unstaked"),
    request_powerdown: () => tr.t("components.pixa_wallet_taxes_dialog.movement_power_down_request"),
    request_convert: () => tr.t("components.pixa_wallet_taxes_dialog.movement_conversion_request"),
    request_collateralized: () => tr.t("components.pixa_wallet_taxes_dialog.movement_collateralized_request"),
    immediate_conversion: () => tr.t("components.pixa_wallet_taxes_dialog.movement_collateralized_immediate_leg"),
    to_own_exchange: () => tr.t("components.pixa_wallet_taxes_dialog.movement_sent_to_your_exchange"),
    to_own_wallet: () => tr.t("components.pixa_wallet_taxes_dialog.movement_sent_to_your_own_wallet"),
    gift_out: () => tr.t("components.pixa_wallet_taxes_dialog.movement_gift_sent"),
    charity_donation: () => tr.t("components.pixa_wallet_taxes_dialog.movement_charity_donation"),
    delegation_out: () => tr.t("components.tax_report.delegated_out_still_yours"),
    delegation_in: () => tr.t("components.tax_report.delegated_to_you_not_yours"),
    delegation_return: () => tr.t("components.pixa_wallet_taxes_dialog.movement_delegation_returned")
  };
  // A power-up has two legs: PXA out starts the stake, PXP in completes it.
  const labelFor = (m) => m.kind === "power_up"
      ? (m.direction === "out"
          ? tr.t("components.pixa_wallet_taxes_dialog.movement_power_up_start")
          : tr.t("components.pixa_wallet_taxes_dialog.movement_power_up_completed"))
      : (labels[m.kind] ? labels[m.kind]() : m.kind);
  const cols = fit([
    { title: tr.t("components.tax_report.col_date"), w: 74, align: "l" },
    { title: tr.t("components.tax_report.col_type"), w: 162, align: "l" },
    { title: tr.t("components.tax_report.col_asset"), w: 54, align: "l" },
    { title: tr.t("components.tax_report.col_amount"), w: 90, align: "r" }
  ]);
  // The PDF is a summary; an active account can have thousands of movements, so
  // cap the table and send the full list to the CSV.
  const PDF_MOVE_CAP = 12;
  const shown = movements.slice(0, PDF_MOVE_CAP);
  const rows = shown.map(m => {
    const time = String(m.ts).slice(11, 19) || "00:00:00";
    const sub = [tr.t("components.tax_report.time_utc", { time })];
    if (m.block != null) sub.push(tr.t("components.tax_report.block_number", { block: String(m.block) }));
    if (m.id) sub.push(tr.t("components.tax_report.transaction_id", { id: String(m.id) }));
    return {
      cells: [
        dayOf(tr, m.ts),
        labelFor(m),
        assetName(m.asset),
        (m.direction === "out" ? "-" : "+") + fmt(m.amount, 4)
      ],
      sub: sub.join(" · ")
    };
  });
  drawTable(ctx, cols, rows);
  if (movements.length > PDF_MOVE_CAP) {
    csvNote(ctx, tr.t("components.tax_report.showing_the_first_of_movements", { shown: fmt(PDF_MOVE_CAP, 0), total: fmt(movements.length, 0), csv: ctx.csv }));
  }
}
// Outbound transfers classified by purpose — count and quantity per asset. This is
// the audit-ready breakdown: exact taxation of each kind of send is jurisdiction-
// specific, so the report states what went where and an adviser applies the local rules.
function renderOutbound(ctx, outboundByIntent) {
  const present = outboundByIntent && Object.keys(outboundByIntent);
  if (!present || !present.length) return;
  const tr = ctx.tr, fmt = ctx.fmt;
  const note = tr.t("components.tax_report.every_send_you_made_over_the_period");
  const ORDER = ["payment", "own_exchange", "own", "gift", "charity"];
  const LABEL = {
    payment: () => tr.t("components.tax_report.payments_to_others"),
    own_exchange: () => tr.t("components.pixa_wallet_taxes_dialog.movement_sent_to_your_exchange"),
    own: () => tr.t("components.pixa_wallet_taxes_dialog.outbound_to_your_own_wallet"),
    gift: () => tr.t("components.pixa_wallet_taxes_dialog.outbound_gifts"),
    charity: () => tr.t("components.pixa_wallet_taxes_dialog.outbound_charity_donations")
  };
  const send = sendDisposals(tr, ctx.bundle);
  const f = ctx.bundle.fiat;
  const cols = fit([
    { title: tr.t("components.tax_report.col_purpose"), w: 110, align: "l" },
    { title: tr.t("components.tax_report.col_tax_treatment"), w: 150, align: "l" },
    { title: tr.t("components.tax_report.col_count"), w: 50, align: "r" },
    { title: tr.t("components.tax_report.col_total_fiat", { fiat: f }), w: 90, align: "r" }
  ]);
  const keys = ORDER.filter(k => outboundByIntent[k]).concat(present.filter(k => !ORDER.includes(k)));
  let disposalValue = 0;
  const rows = keys.map(k => {
    const s = outboundByIntent[k];
    if (s.taxable) disposalValue += s.valueFiat || 0; // engine flag = "is a disposal"
    return {
      cells: [LABEL[k] ? LABEL[k]() : k, outboundTreatment(tr, k, s, send), fmt(s.count, 0), fmt(s.valueFiat || 0)],
      sub: assetBreakdown(fmt, s.byAsset)
    };
  });
  const grandValue = keys.reduce((acc, k) => acc + (outboundByIntent[k].valueFiat || 0), 0);
  const grandCount = keys.reduce((acc, k) => acc + outboundByIntent[k].count, 0);
  sectionTitle(ctx, nextSection(ctx), tr.t("components.tax_report.transfers_out_classified_by_purpose"), note, tableHeight(rows, true));
  drawTable(ctx, cols, rows, { cells: [tr.t("components.tax_report.total_sent_out"), "", fmt(grandCount, 0), fmt(grandValue)] });
  const jur = ctx.bundle.jurisdiction;
  // One sentence per case, phrased so the count needs no plural agreement.
  const vars = { count: fmt(send.count, 0), value: fmt(disposalValue), fiat: f, jurisdiction: jur, csv: ctx.csv };
  csvNote(ctx, !send.count
      ? tr.t("components.tax_report.none_of_these_transfers_is_a_disposal", { csv: ctx.csv })
      : send.taxed
          ? tr.t("components.tax_report.disposals_among_these_some_taxed", Object.assign({ taxed: fmt(send.taxed, 0) }, vars))
          : tr.t("components.tax_report.disposals_among_these_none_taxed", vars));
}

// Per-token overview: opening / received / disposed / closing + closing value.
function renderTokens(ctx, tokenSummary) {
  if (!tokenSummary || !tokenSummary.length) return;
  const tr = ctx.tr, fmt = ctx.fmt;
  const f = ctx.bundle.fiat;
  const cols = fit([
    { title: tr.t("components.tax_report.col_token"), w: 48, align: "l" },
    { title: tr.t("components.tax_report.col_opening"), w: 78, align: "r" },
    { title: tr.t("components.tax_report.col_received"), w: 78, align: "r" },
    { title: tr.t("components.tax_report.col_out"), w: 78, align: "r" },
    { title: tr.t("components.tax_report.col_closing"), w: 78, align: "r" },
    { title: tr.t("components.tax_report.col_value_fiat", { fiat: f }), w: 86, align: "r" }
  ]);
  // The engine stores an unpriced closing value as 0 (`|| 0`); show it as n/a.
  const unpriced = unpricedFigures(ctx.bundle);
  const valueOf = (t) => (unpriced && t.closingQty > 0 && !t.closingValueFiat ? NaN : t.closingValueFiat);
  const rows = tokenSummary.map(t => ({
    cells: [assetName(t.asset), fmt(t.openingQty, 4), fmt(t.receivedQty, 4), fmt(t.disposedQty, 4), fmt(t.closingQty, 4), fmt(valueOf(t))]
  }));
  const totalValue = tokenSummary.reduce((s, t) => s + valueOf(t), 0);
  sectionTitle(ctx, nextSection(ctx), tr.t("components.pixa_wallet_taxes_dialog.section_per_token_summary"),
      tr.t("components.tax_report.opening_balance_total_received_and"),
      tableHeight(rows, true));
  drawTable(ctx, cols, rows, { cells: [tr.t("components.tax_report.total"), "", "", "", "", fmt(totalValue)] });
  // The engine rebuilds PXP from history (VESTS converted at one ratio), which
  // drifts from the real stake once the vesting ratio moves. Say so.
  if (tokenSummary.some(t => t.asset === "PXP")) {
    csvNote(ctx, tr.t("components.tax_report.pxp_quantities_are_rebuilt_from_the"));
  }
}

// Wrapped paragraph that paginates. Bullet optional.
function para(ctx, s, opts = {}) {
  const size = opts.size || 8.5;
  const color = opts.color || SUB;
  const gap = opts.gap == null ? 3 : opts.gap;
  const prefix = opts.bullet ? "•  " : "";
  const font = opts.font || ctx.f.regular;
  const lines = wrap(prefix + String(s), font, size, CONTENT_W - 6);
  // Short paragraphs stay together; long ones continue on the next page.
  ensure(ctx, Math.min(lines.length, 4) * (size + 2.5) + gap);
  for (const ln of lines) {
    if (ctx.y - (size + 2.5) < BOTTOM_LIMIT) newPage(ctx, true);
    text(ctx.page, ln, MRG, ctx.y - (size + 0.5), size, font, color);
    ctx.y -= (size + 2.5);
  }
  ctx.y -= gap;
}

function renderReview(ctx) {
  const tr = ctx.tr, fmt = ctx.fmt;
  const ing = ctx.ingest || {};
  const engineWarnings = (ctx.bundle.warnings) || [];
  const ingestWarnings = ing.warnings || [];
  const skipped = ing.skipped || {};
  const skippedKeys = Object.keys(skipped).sort((a, b) => skipped[b] - skipped[a]);
  const unpriced = unpricedFigures(ctx.bundle);
  if (!unpriced && !engineWarnings.length && !ingestWarnings.length && !skippedKeys.length
      && !ctx.pricingNote && !ctx.jurisdictionNote) return;

  sectionTitle(ctx, "!", tr.t("components.pixa_wallet_taxes_dialog.section_review_notes"));

  if (unpriced) para(ctx, unpricedMessage(tr, ctx.bundle), { bullet: true, color: INK, font: ctx.f.bold });
  // Engine and ingest warnings are descriptors (plain strings pass through).
  for (const w of engineWarnings) para(ctx, tr.text(w), { bullet: true });
  for (const w of ingestWarnings) para(ctx, tr.text(w), { bullet: true });

  if (skippedKeys.length) {
    const total = fmt(skippedKeys.reduce((s, k) => s + skipped[k], 0), 0);
    para(ctx, ctx.bundle.incomeTiming === "accrual"
        ? tr.t("components.tax_report.operations_not_booked_accrual", { total })
        : tr.t("components.tax_report.operations_not_booked_claim", { total }), { gap: 2 });
    // Operation names are chain identifiers; only the counts are localised.
    para(ctx, skippedKeys.map(k => `${k} \u00d7${fmt(skipped[k], 0)}`).join("   \u00b7   "), { size: 8 });
  }

  // Caller notes: descriptors resolved in the document's language (plain
  // strings are printed as given).
  if (ctx.pricingNote) para(ctx, tr.text(ctx.pricingNote), { size: 8 });
  if (ctx.jurisdictionNote) para(ctx, tr.text(ctx.jurisdictionNote), { size: 8 });
}

// ═══════════════════════════════════════════════════════════════════════════
// FOOTERS (final pass, once page count is known)
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// COVER PAGE + BASIS OF PREPARATION
// ═══════════════════════════════════════════════════════════════════════════

function renderCover(ctx) {
  newPage(ctx, false);
  const pg = ctx.page, b = ctx.bundle, f = ctx.f, tr = ctx.tr;
  const period = tr.t("components.tax_report.period_from_to", {
    start: dayOf(tr, b.periodStart || `${b.year}-01-01`),
    end: dayOf(tr, b.periodEnd || `${b.year}-12-31`)
  });

  // Brand lockup
  let y = PAGE_H - 120;
  if (ctx.logo) {
    const BOX_H = 40, MAX_W = 200;
    const k = Math.min(BOX_H / (ctx.logo.height || 1), MAX_W / (ctx.logo.width || 1));
    pg.drawImage(ctx.logo, { x: MRG, y, width: (ctx.logo.width || 1) * k, height: (ctx.logo.height || 1) * k });
    y -= 30;
  }
  text(pg, `PIXAGRAM  ·  ${tr.upper(tr.t("components.tax_report.fairflow_tax_engine"))}`, MRG, y, 9, f.bold, SUB);
  y -= 34;
  text(pg, tr.t("components.tax_report.tax_report_year", { year: String(b.year) }), MRG, y, 30, f.bold, INK);
  y -= 14;
  bar(pg, MRG, y, CONTENT_W, 2.2, ACCENT);
  y -= 30;

  const idLine = (label, value, big) => {
    text(pg, tr.upper(label), MRG, y, 7.5, f.bold, SUB);
    text(pg, value, MRG + 130, y, big ? 11 : 10, big ? f.bold : f.regular, INK);
    y -= 20;
  };
  idLine(tr.t("components.tax_report.account"), `@${b.account}`, true);
  idLine(tr.t("components.tax_report.period"), period);
  idLine(tr.t("components.tax_report.jurisdiction"), tr.t("components.tax_report.jurisdiction_reported_in", {
    name: b.jurisdictionName ? tr.text(b.jurisdictionName) : b.jurisdiction,
    code: b.jurisdiction,
    fiat: b.fiat
  }));

  // Document control block
  y -= 16;
  text(pg, tr.upper(tr.t("components.tax_report.document_control")), MRG, y, 8, f.bold, SUB);
  y -= 10;
  const generated = b.generatedAt
      ? `${tr.date(b.generatedAt, { dateStyle: "medium", timeStyle: "medium" })} UTC`
      : "";
  const rows = [
    [tr.t("components.tax_report.generated"), generated],
    [tr.t("components.tax_report.ruleset"), String(b.rulesVersion || "")],
    [tr.t("components.tax_report.price_data"), String(b.priceDataVersion || "")],
    [tr.t("components.tax_report.cost_basis_method"), methodLabel(tr, b.methodUsed)],
    [tr.t("components.tax_report.income_recognition"), timingLabel(tr, b.incomeTiming)],
    [tr.t("components.tax_report.report_id"), ctx.reportId],
    [tr.t("components.tax_report.fingerprint_sha_256"), ctx.fingerprint
        ? `${ctx.fingerprint.slice(0, 32)}\n${ctx.fingerprint.slice(32)}`
        : tr.t("components.tax_report.unavailable_in_this_environment")]
  ];
  // Values wrap inside the panel (the Japanese total-average label used to run
  // past its right edge).
  const rowH = 17, pad = 12, VAL_W = CONTENT_W - 170 - 14;
  const rowLines = rows.map(([label, value]) => {
    const v = String(value ?? "");
    const ls = v.includes("\n") ? v.split("\n") : wrap(v, f.regular, 9, VAL_W);
    return [label, ls.length ? ls : [""]];
  });
  const panelH = rowLines.reduce((h, [, ls]) => h + rowH + (ls.length - 1) * (rowH - 4), 0) + pad * 2 - 4;
  drawRR(pg, MRG, y - panelH, CONTENT_W, panelH, 9, ZEBRA);
  let ry = y - pad - 8;
  for (const [label, lines] of rowLines) {
    text(pg, ellipsize(label, f.bold, 8, 150), MRG + 16, ry, 8, f.bold, SUB);
    for (const [i, ln] of lines.entries()) {
      text(pg, ln, MRG + 170, ry - i * (rowH - 4), lines.length > 1 ? 8.5 : 9, f.regular, INK);
    }
    ry -= rowH + (lines.length - 1) * (rowH - 4);
  }
  y = y - panelH - 18;
  for (const ln of wrap(tr.t("components.tax_report.the_fingerprint_is_computed_over_the"), f.regular, 8, CONTENT_W)) {
    text(pg, ln, MRG, y, 8, f.regular, SUB);
    y -= 10;
  }

  // Bottom: preparer statement (the page footer adds the disclaimer + identity).
  text(pg, ellipsize(tr.t("components.tax_report.prepared_by_the_pixagram_fairflow_tax"), f.regular, 8, CONTENT_W),
      MRG, FOOT_Y + 44, 8, f.regular, SUB);
}

function renderBasis(ctx) {
  const b = ctx.bundle, tr = ctx.tr, fmt = ctx.fmt;
  sectionTitle(ctx, nextSection(ctx), tr.t("components.tax_report.basis_of_preparation"),
      tr.t("components.tax_report.how_every_figure_in_this_report_was"));
  const period = tr.t("components.tax_report.period_from_to", { start: dayOf(tr, b.periodStart), end: dayOf(tr, b.periodEnd) });
  const losses = b.lossCarryforwardInFiat ? fmt(b.lossCarryforwardInFiat) : "";
  const exemption = b.exemptionUsedInFiat ? fmt(b.exemptionUsedInFiat) : "";
  const deductions = losses && exemption
      ? tr.t("components.tax_report.deductions_losses_and_exemption", { losses, exemption, fiat: b.fiat })
      : losses
          ? tr.t("components.tax_report.deductions_losses_only", { losses, fiat: b.fiat })
          : exemption
              ? tr.t("components.tax_report.deductions_exemption_only", { exemption, fiat: b.fiat })
              : tr.t("components.tax_report.deductions_none");
  const items = [
    [tr.t("components.tax_report.jurisdiction_and_rules"), tr.t("components.tax_report.jurisdiction_rules_value", {
      name: b.jurisdictionName ? tr.text(b.jurisdictionName) : b.jurisdiction,
      code: b.jurisdiction,
      version: String(b.rulesVersion || ""),
      fiat: b.fiat
    })],
    [tr.t("components.tax_report.scope"), tr.t("components.tax_report.scope_value", { account: b.account, period })],
    [tr.t("components.tax_report.cost_basis_method"), methodLabel(tr, b.methodUsed)],
    [tr.t("components.tax_report.income_recognition"), timingLabel(tr, b.incomeTiming)],
    [tr.t("components.tax_report.tokens"), tr.t("components.tax_report.tokens_value")],
    [tr.t("components.tax_report.price_basis"), priceBasisText(tr, b, ctx.priceMode)],
    [tr.t("components.tax_report.deductions_supplied"), deductions]
  ];
  if (b.assumptionNote) items.push([tr.t("components.tax_report.assumptions"), tr.text(b.assumptionNote)]);
  const LBL_W = 128;
  for (const [label, value] of items) {
    const lines = wrap(value, ctx.f.regular, 8.5, CONTENT_W - LBL_W);
    // A translated label may be longer than the English one: it wraps in its
    // own column instead of running into the value.
    const labelLines = wrap(label, ctx.f.bold, 8.5, LBL_W - 8);
    const n = Math.max(lines.length, labelLines.length);
    ensure(ctx, n * 11 + 8);
    for (let i = 0; i < n; i++) {
      if (labelLines[i]) text(ctx.page, labelLines[i], MRG, ctx.y - 9, 8.5, ctx.f.bold, SUB);
      if (lines[i]) text(ctx.page, lines[i], MRG + LBL_W, ctx.y - 9, 8.5, ctx.f.regular, INK);
      ctx.y -= 11;
    }
    ctx.y -= 6;
  }
  ctx.y -= 4;
}

// ═══════════════════════════════════════════════════════════════════════════
// JURISDICTION ANNEX — the supplementary table the local filing actually needs.
// Renders nothing for jurisdictions without one.
// ═══════════════════════════════════════════════════════════════════════════

// Switzerland — where each figure goes on the return of a PRIVATE investor.
// Rendered even without disposals: the wealth and income lines are the ones a
// Swiss filer actually needs. Labels follow the usual cantonal securities list;
// a canton's software may word them differently.
function renderSwissAnnex(ctx) {
  const b = ctx.bundle, f = b.fiat, tr = ctx.tr, fmt = ctx.fmt;
  const title = tr.t("components.tax_report.swiss_annex_title");
  const note = f === "CHF"
      ? tr.t("components.tax_report.swiss_annex_note")
      : `${tr.t("components.tax_report.swiss_annex_note")} ${tr.t("components.tax_report.swiss_annex_not_in_chf", { fiat: f })}`;
  // (the heading is drawn once the rows are known, so it moves with the table)
  const cols = fit([
    { title: tr.t("components.tax_report.col_item"), w: 190, align: "l" },
    { title: tr.t("components.tax_report.col_amount_fiat", { fiat: f }), w: 86, align: "r" },
    { title: tr.t("components.tax_report.col_where_it_goes"), w: 224, align: "l" }
  ]);
  const rows = [];
  if (b.wealth) {
    rows.push({
      cells: [tr.t("components.tax_report.holdings_at", { date: dayOf(tr, b.wealth.refDate) }), fmt(b.wealth.totalFiat), tr.t("components.tax_report.securities_list_tax_value_wealth")],
      sub: tr.t("components.tax_report.pixa_pxs_and_pxp_together")
    });
  }
  const inc = ((b.operations && b.operations.lines) || []).filter(l => l.taxedAtReceipt !== false);
  const sum = (cats) => inc.filter(l => cats.includes(l.category)).reduce((s, l) => s + l.fmvFiat, 0);
  const has = (cats) => inc.some(l => cats.includes(l.category));
  const STAKE = ["reward_curation", "savings_interest"], WORK = ["reward_author", "reward_benefactor"];
  const selfEmployment = tr.t("components.tax_report.other_income_self_employment_if_regular");
  if (has(STAKE)) rows.push({ cells: [tr.t("components.tax_report.curation_rewards_savings_interest"), fmt(sum(STAKE)), tr.t("components.tax_report.securities_list_income_no_withholding")] });
  if (has(WORK)) rows.push({ cells: [tr.t("components.tax_report.author_beneficiary_rewards"), fmt(sum(WORK)), selfEmployment] });
  if (has(["reward_claim"])) {
    rows.push({
      cells: [tr.t("components.tax_report.category_reward_claim"), fmt(sum(["reward_claim"])), tr.t("components.tax_report.split_curation_vs_author_see_below")],
      sub: tr.t("components.tax_report.claim_timing_merges_author_and_curation")
    });
  }
  if (has(["proposal_income"])) rows.push({ cells: [tr.t("components.tax_report.category_proposal_income"), fmt(sum(["proposal_income"])), selfEmployment] });
  const known = [...STAKE, ...WORK, "reward_claim", "proposal_income"];
  const other = inc.filter(l => !known.includes(l.category));
  if (other.length) {
    const otherIncome = tr.t("components.tax_report.other_income");
    rows.push({ cells: [otherIncome, fmt(other.reduce((s, l) => s + l.fmvFiat, 0)), otherIncome] });
  }
  const t = b.transactions;
  if (t && t.lines && t.lines.length) {
    rows.push(gainsRegime(b) === "taxable"
        ? { cells: [tr.t("components.tax_report.gains_on_disposals"), fmt(t.taxableAmountFiat), tr.t("components.tax_report.self_employment_income_professional")] }
        : {
          cells: [tr.t("components.tax_report.gains_on_disposals"), fmt(t.totalGainFiat), tr.t("components.tax_report.not_declared_tax_exempt_private_gain")],
          sub: tr.t("components.tax_report.kept_as_a_record_losses_are_not")
        });
  }
  sectionTitle(ctx, nextSection(ctx), title, note, rows.length ? tableHeight(rows, false) : 0);
  if (!rows.length) {
    para(ctx, tr.t("components.tax_report.nothing_to_declare_from_this_account"), { size: 9, color: INK, gap: 10 });
    return;
  }
  drawTable(ctx, cols, rows);
  csvNote(ctx, tr.t("components.tax_report.author_and_beneficiary_rewards_pay_for"));
}

function renderJurisdictionAnnex(ctx) {
  const b = ctx.bundle, tr = ctx.tr, fmt = ctx.fmt;
  if (b.jurisdiction === "CH") return renderSwissAnnex(ctx);
  const t = b.transactions;
  if (!t || !t.lines || !t.lines.length) return;
  const monthly = () => {
    const m = new Map();
    for (const l of t.lines) {
      const k = String(l.ts).slice(0, 7);
      const g = m.get(k) ?? { n: 0, proceeds: 0 };
      g.n++;
      g.proceeds += l.proceedsFiat;
      m.set(k, g);
    }
    return [...m.entries()].sort((a, z) => a[0].localeCompare(z[0]));
  };
  const col = (title, w, align) => ({ title, w, align });

  if (b.jurisdiction === "BR") {
    const inBRL = b.fiat === "BRL";
    sectionTitle(ctx, nextSection(ctx), tr.t("components.tax_report.br_annex_title"),
        inBRL
            ? tr.t("components.tax_report.br_annex_note")
            : `${tr.t("components.tax_report.br_annex_note")} ${tr.t("components.tax_report.br_annex_not_in_brl", { fiat: b.fiat })}`);
    const cols = fit([
      col(tr.t("components.tax_report.col_month"), 92, "l"),
      col(tr.t("components.tax_report.col_disposals"), 80, "r"),
      col(tr.t("components.tax_report.col_gross_proceeds_fiat", { fiat: b.fiat }), 170, "r"),
      col(tr.t("components.tax_report.col_r30000_threshold"), 132, "r")
    ]);
    const rows = monthly().map(([m, g]) => ({
      cells: [monthOf(tr, m), fmt(g.n, 0), fmt(g.proceeds), inBRL
          ? (g.proceeds > 30000 ? tr.t("components.tax_report.over_report") : tr.t("components.tax_report.under"))
          : tr.t("components.tax_report.not_available")]
    }));
    drawTable(ctx, cols, rows);
    csvNote(ctx, tr.t("components.tax_report.decripto_expands_reporting_from_2026"));
    return;
  }

  if (b.jurisdiction === "IN") {
    const inINR = b.fiat === "INR";
    sectionTitle(ctx, nextSection(ctx), tr.t("components.tax_report.in_annex_title"),
        inINR
            ? tr.t("components.tax_report.in_annex_note")
            : `${tr.t("components.tax_report.in_annex_note")} ${tr.t("components.tax_report.in_annex_not_in_inr", { fiat: b.fiat })}`);
    const cols = fit([
      col(tr.t("components.tax_report.col_month"), 92, "l"),
      col(tr.t("components.tax_report.col_transfers"), 80, "r"),
      col(tr.t("components.tax_report.col_gross_consideration_fiat", { fiat: b.fiat }), 178, "r"),
      col(tr.t("components.tax_report.col_indicative_tds_fiat", { fiat: b.fiat }), 150, "r")
    ]);
    const rows = monthly().map(([m, g]) => ({
      cells: [monthOf(tr, m), fmt(g.n, 0), fmt(g.proceeds), fmt(g.proceeds * 0.01)]
    }));
    const grand = t.lines.reduce((s, l) => s + l.proceedsFiat, 0);
    drawTable(ctx, cols, rows, { cells: [tr.t("components.tax_report.total"), fmt(t.lines.length, 0), fmt(grand), fmt(grand * 0.01)] });
    return;
  }

  if (b.jurisdiction === "ID") {
    const inIDR = b.fiat === "IDR";
    sectionTitle(ctx, nextSection(ctx), tr.t("components.tax_report.id_annex_title"),
        inIDR
            ? tr.t("components.tax_report.id_annex_note")
            : `${tr.t("components.tax_report.id_annex_note")} ${tr.t("components.tax_report.id_annex_not_in_idr", { fiat: b.fiat })}`);
    const cols = fit([
      col(tr.t("components.tax_report.col_month"), 92, "l"),
      col(tr.t("components.tax_report.col_disposals"), 80, "r"),
      col(tr.t("components.tax_report.col_gross_value_fiat", { fiat: b.fiat }), 178, "r"),
      col(tr.t("components.tax_report.col_indicative_1_fiat", { fiat: b.fiat }), 150, "r")
    ]);
    const rows = monthly().map(([m, g]) => ({
      cells: [monthOf(tr, m), fmt(g.n, 0), fmt(g.proceeds), fmt(g.proceeds * 0.01)]
    }));
    const grand = t.lines.reduce((s, l) => s + l.proceedsFiat, 0);
    drawTable(ctx, cols, rows, { cells: [tr.t("components.tax_report.total"), fmt(t.lines.length, 0), fmt(grand), fmt(grand * 0.01)] });
    return;
  }

  if (b.jurisdiction === "UK") {
    const agg = { sd: { q: 0, b: 0, p: 0, g: 0, n: 0 }, td: { q: 0, b: 0, p: 0, g: 0, n: 0 }, pool: { q: 0, b: 0, p: 0, g: 0, n: 0 } };
    for (const l of t.lines) for (const lot of (l.lots || [])) {
      const k = lot.matchRule === "same_day" ? "sd" : lot.matchRule === "thirty_day" ? "td" : "pool";
      const a = agg[k];
      a.q += lot.qty; a.b += lot.basisFiat; a.p += lot.proceedsFiat; a.g += lot.gainFiat; a.n++;
    }
    if (agg.sd.n + agg.td.n === 0) return; // pure pooling — the annex would add nothing
    sectionTitle(ctx, nextSection(ctx), tr.t("components.tax_report.uk_annex_title"), tr.t("components.tax_report.uk_annex_note"));
    const cols = fit([
      col(tr.t("components.tax_report.col_matching_rule"), 158, "l"),
      col(tr.t("components.tax_report.col_quantity"), 80, "r"),
      col(tr.t("components.tax_report.col_cost_basis_fiat", { fiat: b.fiat }), 92, "r"),
      col(tr.t("components.tax_report.col_proceeds_fiat", { fiat: b.fiat }), 92, "r"),
      col(tr.t("components.tax_report.col_gain_fiat", { fiat: b.fiat }), 82, "r")
    ]);
    const mkRow = (label, a) => ({ cells: [label, fmt(a.q, 4), fmt(a.b), fmt(a.p), fmt(a.g)] });
    const rows = [];
    if (agg.sd.n) rows.push(mkRow(tr.t("components.tax_report.same_day_s105"), agg.sd));
    if (agg.td.n) rows.push(mkRow(tr.t("components.tax_report.thirty_day_bed_and_breakfast_s106a"), agg.td));
    if (agg.pool.n) rows.push(mkRow(tr.t("components.tax_report.section_104_pool"), agg.pool));
    const tot = ["q", "b", "p", "g"].map(k => agg.sd[k] + agg.td[k] + agg.pool[k]);
    drawTable(ctx, cols, rows, { cells: [tr.t("components.tax_report.total"), fmt(tot[0], 4), fmt(tot[1]), fmt(tot[2]), fmt(tot[3])] });
  }
}

function drawFooters(doc, f, bundle, reportId, tr) {
  const pages = doc.getPages();
  const disclaimer = tr.t("components.tax_report.decision_support_document_not_a_filed");
  const period = tr.t("components.tax_report.period_from_to", {
    start: dayOf(tr, bundle.periodStart || `${bundle.year}-01-01`),
    end: dayOf(tr, bundle.periodEnd || `${bundle.year}-12-31`)
  });
  const identity = `${reportId}  ·  @${bundle.account}  ·  ${period}  ·  ${bundle.jurisdiction}`;
  pages.forEach((pg, i) => {
    // Running identity above the rule: what document, whose, which period.
    pg.drawText(safe(identity), {
      x: MRG,
      y: FOOT_Y + 18,
      size: 7,
      font: f.regular,
      color: MUTED
    });
    const pn = safe(tr.t("components.tax_report.page_of", { page: tr.number(i + 1, 0), pages: tr.number(pages.length, 0) }));
    pg.drawText(pn, {
      x: PAGE_W - MRG - f.bold.widthOfTextAtSize(pn, 7.5),
      y: FOOT_Y + 18,
      size: 7.5,
      font: f.bold,
      color: SUB
    });
    pg.drawRectangle({
      x: MRG,
      y: FOOT_Y + 14,
      width: CONTENT_W,
      height: 0.6,
      color: LINE
    });
    for (const [j, ln] of wrap(disclaimer, f.regular, 7, CONTENT_W - 70).entries()) pg.drawText(ln, {
      x: MRG,
      y: FOOT_Y + 2 - j * 8,
      size: 7,
      font: f.regular,
      color: SUB
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

/** Node default. In the browser, mirror licensePDF.js:
 *   doc.registerFontkit(fontkit);
 *   const regular = await doc.embedFont(await fetch("/src/fonts/industry/IndustryBook.ttf").then(r=>r.arrayBuffer()));
 *   ...and pass { regular, bold, oblique }.
 */
async function defaultFonts(doc) {
  return {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    oblique: await doc.embedFont(StandardFonts.HelveticaOblique)
  };
}
/**
 * opts:
 *   i18n             document translator (utils/docLanguage.js); keys print
 *                    as-is without one. Render through renderInDocLanguage()
 *                    with printableInReport so the language fits Helvetica.
 *   fonts            { regular, bold, oblique } pdf-lib fonts (default Helvetica)
 *   csvFilename      shown where the report points to the CSV
 *   ingest           { skipped, warnings } from the ingest step
 *   pricingNote,
 *   jurisdictionNote tk() descriptors (or plain strings) for the Review section
 *   priceMode        "historical" | "snapshot"
 */
export async function generateTaxReportPdf(bundle, opts = {}) {
  const tr = opts.i18n || keyTranslator();
  const doc = await PDFDocument.create();
  // Metadata is stored as PDF text strings (UTF-16), not drawn with the font.
  doc.setTitle(tr.t("components.tax_report.pdf_title", { year: String(bundle.year), account: bundle.account }));
  doc.setAuthor("Pixagram");
  doc.setSubject(tr.t("components.tax_report.pdf_subject", { jurisdiction: bundle.jurisdiction }));
  doc.setCreator("Pixagram Tax Reporting");
  if (tr.lang) doc.setLanguage(tr.lang);
  const f = opts.fonts ?? (await defaultFonts(doc));
  let logo = null;
  try {
    logo = await doc.embedPng(b64ToBytes(LOGO_PNG_B64));
  } catch (e) {
    logo = null;
  }
  const ctx = {
    doc,
    page: null,
    y: 0,
    f,
    tr,
    fmt: makeFmt(tr),
    bundle,
    logo,
    csv: opts.csvFilename ?? tr.t("components.tax_report.the_attached_csv_file"),
    ingest: opts.ingest || null,
    jurisdictionNote: opts.jurisdictionNote || "",
    pricingNote: opts.pricingNote || "",
    // "historical" | "snapshot" | "unknown". Pass opts.priceMode from the dialog
    // when the price provider is known; otherwise it is read off the figures.
    priceMode: detectPriceMode(bundle, opts)
  };
  // Fingerprint the exact data this PDF renders, so the document is verifiably
  // tied to its CSV/JSON exports. Report ID is the fingerprint's first 10 hex.
  // The bundle's text is language-neutral (descriptors), so the fingerprint
  // does not depend on the language the PDF is written in.
  const fingerprint = await sha256Hex(JSON.stringify(bundle));
  const reportId = "PIX-" + (fingerprint
      ? fingerprint.slice(0, 10).toUpperCase()
      : String(Date.parse(bundle.generatedAt) || Date.now()).slice(-10));
  ctx.fingerprint = fingerprint;
  ctx.reportId = reportId;

  renderCover(ctx);
  newPage(ctx, false);
  drawHeader(ctx);
  renderBasis(ctx);
  if (bundle.wealth) renderWealth(ctx, bundle.wealth);
  if (bundle.tokenSummary && bundle.tokenSummary.length) renderTokens(ctx, bundle.tokenSummary);
  if (bundle.transactions) renderTransactions(ctx, bundle.transactions);
  if (bundle.outboundByIntent) renderOutbound(ctx, bundle.outboundByIntent);
  if (bundle.operations) renderOperations(ctx, bundle.operations);
  renderJurisdictionAnnex(ctx);
  if (bundle.movements && bundle.movements.length) renderMovements(ctx, bundle.movements);
  renderReview(ctx);
  drawFooters(doc, f, bundle, reportId, tr);
  return doc.save();
}

// ---- CSV ------------------------------------------------------------------

// Empty for null/undefined (it used to print "undefined"); quotes CR as well
// as LF (a memo containing \r split the row); and text a spreadsheet would run
// as a formula (= + - @ ...) gets a leading apostrophe. Numbers pass through.
function csvCell(v) {
  if (v == null) return "";
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s) && !/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows) {
  return rows.map(r => r.map(csvCell).join(",")).join("\r\n");
}

/**
 * Per-section CSVs (clean schemas) plus one combined long-format detail CSV.
 * Column headers and data tokens are the schema and stay as they are; the
 * human-text columns (tax_treatment, note) are written with `opts.i18n` —
 * the dialog passes a translator in the UI language (a CSV has no font).
 */
export function generateTaxReportCsvs(bundle, opts = {}) {
  const tr = opts.i18n || keyTranslator();
  const fiat = bundle.fiat;
  // A movement's note is a descriptor (or the user's memo); a gift or charity
  // movement carries both: "memo · note".
  const noteOf = (m) => [m.memo, tr.text(m.note)].filter(Boolean).join(" · ");

  const wRows = [["asset", "quantity", "unit_value", "value", "fiat", "source", "ref_date"]];
  if (bundle.wealth) for (const l of bundle.wealth.lines) wRows.push([l.asset, l.qty, l.fiatPerUnit, l.valueFiat, fiat, l.source, bundle.wealth.refDate]);

  // Disposals: one row per disposal, now with the term split, swap flag, counterparty
  // and the UK share-matching split (blank outside UK).
  const tRows = [["date", "block", "txid", "category", "asset", "qty_out", "proceeds", "cost_basis", "gain",
    "short_term_gain", "long_term_gain", "exempt_gain", "matched_same_day_qty", "matched_30day_qty", "pooled_qty", "taxable", "is_swap", "counterparty", "method", "fiat"]];
  if (bundle.transactions) for (const l of bundle.transactions.lines) tRows.push([
    l.ts, l.block ?? "", l.id || "", l.category, l.asset, l.qtyOut, l.proceedsFiat, l.basisFiat, l.gainFiat,
    l.shortTermGainFiat ?? "", l.longTermGainFiat ?? "", l.exemptGainFiat ?? "",
    l.matchedSameDayQty ?? "", l.matchedThirtyDayQty ?? "", l.pooledQty ?? "",
    l.taxable ? "yes" : "no", l.isSwap ? "yes" : "no", l.counterparty || "", l.method, fiat]);

  // Lot-level audit trail: one row per cost-basis lot consumed by each disposal.
  // Micro-lot streams (hourly rewards, recurrent fills) can make ONE disposal
  // consume hundreds of lots; consecutive lots with the same unit cost, term,
  // taxability and match rule are tax-identical, so they coalesce into a single
  // row carrying the acquisition range and the lot count — lossless for the tax
  // math, and the CSV stays proportional to what actually differs. match_rule
  // is blank for dated lots (FIFO/LIFO/HIFO consumption carries no matching);
  // "pool" marks dateless pooled/averaged consumption; same-day / 30-day mark
  // UK-matched quantity.
  const r2c = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
  const r4c = (x) => Math.round((x + Number.EPSILON) * 10000) / 10000;
  const matchLabel = (lot) => lot.matchRule === "same_day" ? "same-day"
      : lot.matchRule === "thirty_day" ? "30-day"
          : (lot.acquiredTs ? "" : "pool");
  const unitOf = (lot) => lot.qty > 0 ? r4c(lot.basisFiat / lot.qty) : 0;
  const lRows = [["disposal_date", "block", "txid", "category", "asset", "lot_acquired", "lots", "lot_qty",
    "lot_cost_basis", "lot_proceeds", "lot_gain", "held_days", "term", "match_rule", "taxable", "missing_basis", "fiat"]];
  if (bundle.transactions) for (const l of bundle.transactions.lines) {
    const groups = [];
    for (const lot of (l.lots || [])) {
      const g = groups[groups.length - 1];
      const mergeable = g
          && unitOf(g) === unitOf(lot)
          && g.term === lot.term
          && !!g.taxable === !!lot.taxable
          && matchLabel(g) === matchLabel(lot)
          && !!g.missingBasis === !!lot.missingBasis
          && !!g.acquiredTs === !!lot.acquiredTs;
      if (mergeable) {
        g.qty += lot.qty; g.basisFiat += lot.basisFiat; g.proceedsFiat += lot.proceedsFiat; g.gainFiat += lot.gainFiat;
        if (lot.acquiredTs) g.lastTs = lot.acquiredTs;
        g.count += 1;
        if (lot.heldDays != null) {
          g.minHeld = g.minHeld == null ? lot.heldDays : Math.min(g.minHeld, lot.heldDays);
          g.maxHeld = g.maxHeld == null ? lot.heldDays : Math.max(g.maxHeld, lot.heldDays);
        }
      } else {
        groups.push({ ...lot, lastTs: lot.acquiredTs, count: 1, minHeld: lot.heldDays ?? null, maxHeld: lot.heldDays ?? null });
      }
    }
    for (const g of groups) lRows.push([
      l.ts, l.block ?? "", l.id || "", l.category, l.asset,
      g.acquiredTs ? (g.count > 1 && g.lastTs !== g.acquiredTs ? `${g.acquiredTs} to ${g.lastTs}` : g.acquiredTs) : "(pooled/none)",
      g.count, r4c(g.qty),
      r2c(g.basisFiat), r2c(g.proceedsFiat), r2c(g.gainFiat),
      g.minHeld == null ? "" : (g.minHeld === g.maxHeld ? g.minHeld : `${g.minHeld}-${g.maxHeld}`),
      g.term, matchLabel(g), g.taxable ? "yes" : "no", g.missingBasis ? "yes" : "", fiat]);
  }

  const oRows = [["date", "block", "txid", "category", "asset", "qty_in", "income", "taxed_at_receipt", "source", "counterparty", "fiat"]];
  if (bundle.operations) for (const l of bundle.operations.lines) oRows.push([l.ts, l.block ?? "", l.id || "", l.category, l.asset, l.qtyIn, l.fmvFiat, l.taxedAtReceipt === false ? "no" : "yes", l.source, l.counterparty || "", fiat]);

  const mRows = [["date", "block", "txid", "kind", "asset", "direction", "amount", "note", "fiat"]];
  if (bundle.movements) for (const m of bundle.movements) mRows.push([m.ts, m.block ?? "", m.id || "", m.kind, m.asset, m.direction, m.amount, noteOf(m), fiat]);

  // Per-token summary: opening / received / disposed / closing per asset.
  const kRows = [["asset", "opening_qty", "received_qty", "income_qty", "income_value", "out_qty", "taxable_disposed_qty", "closing_qty", "closing_value", "fiat"]];
  if (bundle.tokenSummary) for (const t of bundle.tokenSummary) kRows.push([t.asset, t.openingQty, t.receivedQty, t.incomeQty, t.incomeFiat, t.disposedQty, t.taxableDisposedQty, t.closingQty, t.closingValueFiat, fiat]);

  // Crypto moved to your own exchange — the taxable sale happens off-platform.
  const xRows = [["date", "asset", "qty", "cost_basis_that_left", "counterparty", "fiat"]];
  if (bundle.offPlatformBasis) for (const o of bundle.offPlatformBasis) xRows.push([o.ts, o.asset, o.qty, o.basisFiat, o.counterparty || "", fiat]);

  // Outbound transfers classified by purpose — total quantity per asset + count.
  // Last column renamed "taxable" -> "is_disposal": the engine flag says whether
  // the send is a disposal; whether its gain is TAXED is in the transactions file
  // (for a Swiss private investor it never is — the old "Taxable disposal" label
  // was wrong there).
  const obRows = [["purpose", "tax_treatment", "asset", "total_sent", "transfers_in_purpose", "is_disposal"]];
  if (bundle.outboundByIntent) {
    const send = sendDisposals(tr, bundle);
    for (const [k, s] of Object.entries(bundle.outboundByIntent))
      for (const [a, q] of Object.entries(s.byAsset))
        obRows.push([k, outboundTreatment(tr, k, s, send).replace(/\s*—\s*/g, " - "), a, q, s.count, s.taxable ? "yes" : "no"]);
  }

  // combined long format: one normalised row per detail line across all reports
  const cRows = [["report", "date", "category", "asset", "direction", "quantity", "unit_value", "value", "cost_basis", "gain", "taxable", "source", "fiat"]];
  if (bundle.wealth) for (const l of bundle.wealth.lines) cRows.push(["wealth", bundle.wealth.refDate, "holding", l.asset, "hold", l.qty, l.fiatPerUnit, l.valueFiat, "", "", "", l.source, fiat]);
  if (bundle.transactions) for (const l of bundle.transactions.lines) cRows.push(["transactions", l.ts, l.category, l.asset, "out", l.qtyOut, "", l.proceedsFiat, l.basisFiat, l.gainFiat, l.taxable ? "yes" : "no", l.method, fiat]);
  if (bundle.operations) for (const l of bundle.operations.lines) cRows.push(["operations", l.ts, l.category, l.asset, "in", l.qtyIn, "", l.fmvFiat, "", "", "", l.source, fiat]);
  if (bundle.movements) for (const m of bundle.movements) cRows.push(["movements", m.ts, m.kind, m.asset, m.direction, m.amount, "", "", "", "", "", noteOf(m), fiat]);

  return {
    wealth: toCsv(wRows),
    transactions: toCsv(tRows),
    lots: toCsv(lRows),
    operations: toCsv(oRows),
    movements: toCsv(mRows),
    tokens: toCsv(kRows),
    offplatform: toCsv(xRows),
    outbound: toCsv(obRows),
    combined: toCsv(cRows)
  };
}