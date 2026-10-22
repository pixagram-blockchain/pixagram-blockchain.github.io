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
// Non-finite values print "n/a" (a NaN valuation must never pass for a real
// zero), and amounts that round to zero never print as "-0.00".
const fmt = (n, dp = 2) => {
  const v = n == null ? NaN : Number(n);
  if (!Number.isFinite(v)) return "n/a";
  const shown = Math.round(v * 10 ** dp) / 10 ** dp === 0 ? 0 : v;
  return shown.toLocaleString("en-US", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp
  });
};

// Display names. PIXA is the ticker; PXA is only the engine's internal alias
// (kept as-is in the CSV exports, which the Basis section states). PXP is Pixa
// Power, i.e. staked PIXA.
const ASSET_LABELS = { PXA: "PIXA" };
const assetName = (a) => ASSET_LABELS[a] || a;

// "1,800.0000 PIXA  ·  12.0000 PXS" — full per-asset breakdown for a row sub-line,
// so token amounts are shown in full instead of truncated inside a column.
const assetBreakdown = (byAsset, dp = 4) =>
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
const WINANSI_HIGH = "\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D" +
    "\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178";
const winAnsi = (c) => {
  const p = c.codePointAt(0);
  return (p >= 0x20 && p <= 0x7e) || (p >= 0xa0 && p <= 0xff) || WINANSI_HIGH.includes(c);
};
const TRANSLIT = [
  [/\u2192/g, "->"], [/\u2190/g, "<-"], [/\u2194/g, "<->"], [/\u21D2/g, "=>"], [/\u21D0/g, "<="],
  [/\u2212/g, "-"], [/[\u2032\u2035]/g, "'"], [/\u2264/g, "<="], [/\u2265/g, ">="], [/\u2248/g, "~"],
  [/[\u2000-\u200A\u202F\u205F\u3000]/g, " "], [/[\u200B-\u200D\u2060\uFEFF]/g, ""],
  [/\u20A9\s*/g, "KRW "], [/\u20B9\s*/g, "INR "], [/\u20A6\s*/g, "NGN "],
  [/\u96D1\u6240\u5F97/g, "zatsu shotoku"],                          // JP: miscellaneous income
  [/\u7DCF\u5E73\u5747\u6CD5/g, "so-heikin-ho"],                       // JP: total-average method
  [/\u79FB\u52D5\u5E73\u5747\u6CD5/g, "ido-heikin-ho"],                // JP: moving-average method
  [/\u56FD\u5916\u8CA1\u7523\u8ABF\u66F8/g, "kokugai zaisan chosho"],  // JP: overseas assets report
  [/\u7A0E\u7406\u58EB/g, "zeirishi (tax accountant)"],                // JP: licensed tax accountant
  [/\uC138\uBB34\uC0AC/g, "semusa (tax accountant)"],                  // KR: licensed tax accountant
  [/\u05E8\u05D5\u05D0\u05D4 \u05D7\u05E9\u05D1\u05D5\u05DF/g, "roeh heshbon (CPA)"] // IL: CPA
];
function safe(s) {
  if (s == null) return "";
  s = String(s).replace(/[\u0000-\u001F\u007F]/g, " ");
  for (const [re, to] of TRANSLIT) s = s.replace(re, to);
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

// ASCII-only labels (the embedded Helvetica is WinAnsi — CJK cannot render).
const METHOD_LABELS = {
  FIFO: "First-in, first-out (FIFO)",
  LIFO: "Last-in, first-out (LIFO)",
  HIFO: "Highest-in, first-out (HIFO)",
  POOL: "Weighted-average pool (section-104 / adjusted-cost-base style)",
  TOTAL_AVG: "Total average (Japan, so-heikin-ho) — each disposal priced at the full year's average cost"
};
const TIMING_LABELS = {
  claim: "On claim — rewards become income when collected",
  accrual: "On accrual — rewards become income when credited"
};

// Human labels for the engine's category codes (the tables used to print the
// raw codes: "reward_claim", "market_fill", "delegation_out" ...).
const CATEGORY_LABELS = {
  reward_author: "Author rewards",
  reward_curation: "Curation rewards",
  reward_benefactor: "Beneficiary rewards",
  reward_claim: "Rewards claimed (author + curation)",
  proposal_income: "Proposal (DPF) payouts",
  savings_interest: "Savings interest",
  transfer_out: "Payments / transfers out",
  swap: "Conversions (PIXA / PXS)",
  market_fill: "Internal market trades"
};
const catLabel = (c) => CATEGORY_LABELS[c] || c;
const SOURCE_LABELS = {
  fta_list: "Official year-end list",
  platform_price: "Platform price",
  cost_basis: "Acquisition cost"
};

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
const unpricedMessage = (b) => `Some figures could not be valued in ${b.fiat}: the price source returned no ${b.fiat} rate for them. They are shown as "n/a" (not zero), and every total that includes them is incomplete. Fix the price source before using this report.`;

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
function sendDisposals(b) {
  const out = ((b.transactions && b.transactions.lines) || []).filter(l => l.category === "transfer_out");
  const taxed = out.filter(l => l.taxable).length;
  const label = !out.length ? "Disposal"
      : taxed === 0 ? "Disposal — gain not taxed here"
          : taxed === out.length ? "Taxable disposal" : "Disposal — partly taxable";
  return { count: out.length, taxed, label };
}
function outboundTreatment(kind, slot, send) {
  if (kind === "payment") return send.label;
  if (kind === "own_exchange") return "Sale is off-platform";
  if (kind === "own") return "Internal — not a disposal";
  if (kind === "gift") return slot.taxable ? "Disposal at market value" : "Not a disposal here";
  if (kind === "charity") return slot.taxable ? "Treated as a disposal" : "Exempt donation";
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
function priceBasisText(b, mode) {
  const ps = b.priceSnapshot;
  const ver = b.priceDataVersion || "n/a";
  const asOf = ps ? `${ps.asOf} ${ps.timezone}` : String(b.periodEnd || "");
  if (mode === "snapshot") {
    return `${ver}. One unit price per token (snapshot ${asOf}) was applied to every date, so receipt-time and disposal-time values are approximations. Income must be valued on the day it is received: regenerate with historical prices before filing.`;
  }
  if (mode === "historical") {
    return `${ver}. Each event is valued at the price for its own date; the unit prices on the summary page are the ${asOf} values used for closing balances.`;
  }
  return `${ver}. Each event is valued with the price provider's quote for its own date; the unit prices on the summary page are the ${asOf} values used for closing balances.`;
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
    textR(ctx.page, `Tax Report ${ctx.bundle.year} · continued`, PAGE_W - MRG, PAGE_H - MRG, 9, ctx.f.regular, SUB);
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
      pg = ctx.page;
  let y = PAGE_H - MRG - 6;

  // right meta block
  const meta = [`Generated ${b.generatedAt.slice(0, 10)}`, `Ruleset ${b.rulesVersion}`, `Prices ${b.priceDataVersion}`];
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
  text(pg, `Tax Report ${b.year}`, titleX, titleBaseline, 23, ctx.f.bold, INK);
  y -= 20;
  text(pg, `@${b.account}   ·   ${b.jurisdiction}   ·   reported in ${b.fiat}`, titleX, y, 10, ctx.f.regular, SUB);
  y -= 16;
  bar(pg, MRG, y, CONTENT_W, 1.8, ACCENT);
  y -= 16;

  // KPI cards. Each card says what its figure IS here: the first is the tax
  // value of the on-platform holdings (it was labelled "net wealth", but the
  // report knows no liabilities), and when no gain is taxed (e.g. a Swiss
  // private investor) the second says so instead of a bare "TAXABLE AMOUNT 0.00".
  // Labels and values shrink to fit, so JPY/KRW/IDR amounts stay inside.
  const cards = [];
  if (b.wealth) cards.push([`HOLDINGS VALUE @ ${b.wealth.refDate}`, `${fmt(b.wealth.totalFiat)} ${b.fiat}`,
    b.jurisdiction === "CH" ? "Declare as wealth (securities list)" : "Tax value of on-platform holdings"]);
  if (b.transactions) {
    const regime = gainsRegime(b);
    if (regime === "exempt") {
      cards.push(["CAPITAL GAINS (RECORD ONLY)", `${fmt(b.transactions.totalGainFiat)} ${b.fiat}`,
        b.jurisdiction === "CH" ? "Tax-exempt for a private investor" : "Not taxed as a capital gain here"]);
    } else {
      cards.push(["TAXABLE AMOUNT", `${txUnpriced(b) ? "n/a" : fmt(b.transactions.taxableAmountFiat ?? b.transactions.taxableGainFiat)} ${b.fiat}`,
        regime === "none" ? "No disposals this period"
            : b.transactions.deductionSteps ? "After the deductions shown" : "Gains on disposals"]);
    }
  }
  if (b.operations) cards.push(["INCOME TAXED AT RECEIPT", `${fmt(b.operations.totalIncomeFiat)} ${b.fiat}`,
    b.operations.deferredIncomeFiat
        ? `+ ${fmt(b.operations.deferredIncomeFiat)} received at zero cost basis`
        : "Rewards and interest, value on receipt"]);
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
    const px = (a, v) => `${a} ${v != null ? fmt(v, 4) : "n/a"}`;
    const parts = [px("PIXA", ps.PXA), px("PXS", ps.PXS), `PXP ${ps.PXP != null ? fmt(ps.PXP, 4) : "n/a"} (= PIXA)`];
    if (ps.vestingRatio != null) parts.push(`VESTS x ${fmt(ps.vestingRatio, 6)} = PXP`);
    text(pg, `Valuation basis @ ${ps.asOf} ${ps.timezone} — prices in ${ps.fiat}:`, MRG, yy, 7.5, ctx.f.bold, SUB);
    text(pg, parts.join("      "), MRG, yy - 11, 8, ctx.f.regular, INK);
    ctx.y = yy - 24;
  } else {
    ctx.y = y - ch - 22;
  }
  if (unpricedFigures(b)) {
    for (const ln of wrap(unpricedMessage(b), ctx.f.bold, 8, CONTENT_W)) {
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
  const words = safe(s).split(/\s+/),
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
  if (!r.lines.length) {
    sectionTitle(ctx, nextSection(ctx), "Wealth statement", r.note);
    para(ctx, `No on-platform holdings at ${r.refDate}.`, { size: 9, color: INK, gap: 10 });
    return;
  }
  const cols = fit([{
    title: "Asset",
    w: 60,
    align: "l"
  }, {
    title: "Quantity",
    w: 92,
    align: "r"
  }, {
    title: `Unit (${r.fiat})`,
    w: 86,
    align: "r"
  }, {
    title: `Value (${r.fiat})`,
    w: 96,
    align: "r"
  }, {
    title: "Valuation source",
    w: 110,
    align: "l"
  }]);
  const rows = r.lines.map(l => ({
    cells: [assetName(l.asset), fmt(l.qty, 4), fmt(l.fiatPerUnit, 4), fmt(l.valueFiat), SOURCE_LABELS[l.source] || l.source],
    sub: l.asset === "PXP" ? "Pixa Power: staked PIXA you own (1 PXP = 1 PIXA)" : undefined
  }));
  sectionTitle(ctx, nextSection(ctx), "Wealth statement", r.note, tableHeight(rows, true));
  drawTable(ctx, cols, rows, {
    cells: ["Total", "", "", `${fmt(r.totalFiat)}`, ""]
  });
  // Staked PIXA is the line users are most tempted to leave out (or declare at
  // zero), so the statement says plainly why it is in.
  if (r.lines.some(l => l.asset === "PXP")) {
    csvNote(ctx, "PXP (Pixa Power) is PIXA you have staked. You still own it and can convert it back with a power-down (paid out over 13 weeks), so it is part of your wealth at its PIXA value. Neither staking nor delegating it to another account removes it; PXP that others delegated to you is not yours and is not included.");
  }
  csvNote(ctx, `Per-asset holdings at the reference date. Full balance detail is in ${ctx.csv}.`);
}
function renderTransactions(ctx, r) {
  // A Swiss profile flagged as professional trader gets taxable lines; the
  // private-investor wording ("tax-free... listed for your records") and the
  // safe-harbour caveat would then contradict the figures below.
  const proCH = ctx.bundle.jurisdiction === "CH" && gainsRegime(ctx.bundle) === "taxable";
  const note = proCH
      ? "This report treats you as a professional trader (self-employment): the gains below are taxable income and booked losses are deductible. The tax-free treatment for private investors does not apply."
      : [r.note, r.safeHarbourCheck ? `Disposals this period: ${r.safeHarbourCheck.disposalCount}. ${r.safeHarbourCheck.note}` : ""].filter(Boolean).join("  ");
  const title = "Transactions — disposals & swaps";
  if (!r.lines.length) {
    sectionTitle(ctx, nextSection(ctx), title, note);
    para(ctx, "No disposals or swaps in this period.", { size: 9, color: INK, gap: 10 });
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
    title: "Type",
    w: 132,
    align: "l"
  }, {
    title: "Count",
    w: 52,
    align: "r"
  }, {
    title: `Proceeds (${r.fiat})`,
    w: 92,
    align: "r"
  }, {
    title: `Cost basis (${r.fiat})`,
    w: 92,
    align: "r"
  }, {
    title: `Gain (${r.fiat})`,
    w: 82,
    align: "r"
  }]);
  const rows = [...by.entries()].map(([cat, g]) => ({
    cells: [catLabel(cat), String(g.n), fmt(g.proceeds), fmt(g.basis), fmt(g.gain)],
    sub: assetBreakdown(g.byAsset)
  }));
  sectionTitle(ctx, nextSection(ctx), title, note, tableHeight(rows, true));
  drawTable(ctx, cols, rows, {
    cells: ["Total", String(r.lines.length), fmt(tp), fmt(tb), fmt(r.totalGainFiat)]
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
      { title: "Asset", w: 64, align: "l" },
      { title: "Disposals", w: 60, align: "r" },
      { title: `Proceeds (${r.fiat})`, w: 88, align: "r" },
      { title: `Cost basis (${r.fiat})`, w: 88, align: "r" },
      { title: `Gain (${r.fiat})`, w: 74, align: "r" },
      { title: "Taxable", w: 66, align: "r" },
      { title: "Exempt", w: 60, align: "r" }
    ]);
    const arows = [...byAsset.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(([asset, a]) => ({
      cells: [assetName(asset), String(a.n), fmt(a.proceeds), fmt(a.basis), fmt(a.gain), fmt(a.taxable), a.exempt ? fmt(a.exempt) : "-"]
    }));
    const ah = tableHeight(arows, false);
    ensure(ctx, 12 + (ah <= KEEP_TOGETHER_MAX ? ah : TABLE_MIN)); // keep the label with its table
    text(ctx.page, "By asset", MRG, ctx.y - 9, 9, ctx.f.bold, INK);
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
  const amt = (v) => (txUnpriced(ctx.bundle) ? "n/a" : fmt(v)); // engine totals mask NaN as 0
  const steps = r.deductionSteps && r.deductionSteps.length ? r.deductionSteps : null;
  if (regime === "exempt") {
    para(ctx, jur === "CH"
            ? `Not taxed: for a private investor in Switzerland these gains (total ${fmt(r.totalGainFiat)} ${r.fiat}) are tax-exempt capital gains, and losses are not deductible. They are not entered on the return; they are listed for your records.`
            : `None of these gains (total ${fmt(r.totalGainFiat)} ${r.fiat}) is taxed as a capital gain in ${jur} on the basis stated above; the lines are listed for your records.`,
        { size: 9, color: INK, gap: 6 });
  } else if ((steps && steps.length > 1) || r.disallowedLossesFiat) {
    ensure(ctx, 16);
    text(ctx.page, `Taxable gain for ${jur}: ${amt(r.taxableGainFiat)} ${r.fiat}`, MRG, ctx.y - 4, 9, ctx.f.bold, INK);
    ctx.y -= 14;
  }
  if (r.splitByTerm || (r.exemptGainFiat && regime !== "exempt")) {
    const parts = [];
    if (r.splitByTerm) parts.push(`short-term ${amt(r.shortTermGainFiat)}`, `long-term ${amt(r.longTermGainFiat)}`);
    if (r.exemptGainFiat) parts.push(`tax-free ${amt(r.exemptGainFiat)}`);
    ensure(ctx, 12);
    text(ctx.page, `Gain split — ${parts.join("  ·  ")} ${r.fiat}`, MRG, ctx.y - 2, 8.5, ctx.f.regular, SUB);
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
      text(ctx.page, `Share matching — same-day ${fmt(sd, 4)}  ·  30-day ${fmt(td, 4)}  ·  from pool ${fmt(pl, 4)} (units; per-disposal split in the CSV)`, MRG, ctx.y - 2, 8.5, ctx.f.regular, SUB);
      ctx.y -= 12;
    }
  }
  // Computation of taxable amount — a proper schedule instead of a chain string.
  // The informational disallowed-losses row (India: no set-off permitted) leads,
  // then each deduction step, with the final taxable amount as the bold total.
  if (regime !== "exempt" && ((steps && steps.length > 1) || r.disallowedLossesFiat)) {
    const cols = fit([
      { title: "Step", w: 330, align: "l" },
      { title: `Amount (${r.fiat})`, w: 130, align: "r" }
    ]);
    const allSteps = steps || [{ label: "Taxable gain", value: r.taxableAmountFiat ?? r.taxableGainFiat }];
    const rows = [];
    if (r.disallowedLossesFiat) {
      rows.push({ cells: ["Losses disregarded — no set-off or carry-forward permitted (informational)", fmt(r.disallowedLossesFiat)] });
    }
    for (const s of allSteps.slice(0, -1)) rows.push({ cells: [s.label, fmt(s.value)] });
    const last = allSteps[allSteps.length - 1];
    ensure(ctx, 18 + tableHeight(rows, true)); // keep the heading with its schedule
    text(ctx.page, "Computation of taxable amount", MRG, ctx.y - 10, 9.5, ctx.f.bold, INK);
    ctx.y -= 18;
    drawTable(ctx, cols, rows, { cells: [last.label, fmt(last.value)] });
  }
  if (regime !== "exempt") {
    ensure(ctx, 14);
    text(ctx.page, `Taxable amount for ${jur}: ${amt(r.taxableAmountFiat)} ${r.fiat}`, MRG, ctx.y - 4, 9.5, ctx.f.bold, INK);
    ctx.y -= 14;
  }
  if (r.lossCarryforwardOutFiat) {
    ensure(ctx, 11);
    text(ctx.page, `Loss to carry forward: ${fmt(r.lossCarryforwardOutFiat)} ${r.fiat}`, MRG, ctx.y - 2, 8.5, ctx.f.regular, SUB);
    ctx.y -= 12;
  }
  csvNote(ctx, `Summary by type. All ${r.lines.length} disposals — with the cost-basis lots consumed and holding period — are itemised line-by-line in ${ctx.csv}.`);
}
function renderOperations(ctx, r) {
  const title = "Operations — reward & interest income";
  if (!r.lines.length) {
    sectionTitle(ctx, nextSection(ctx), title, r.note);
    para(ctx, "No reward or interest income in this period.", { size: 9, color: INK, gap: 10 });
    return;
  }

  // sub-details: aggregate by income type; every individual receipt goes to the
  // CSV. Zero-basis jurisdictions (FR/AT) flag lines taxedAtReceipt=false —
  // those aggregate separately and are excluded from the income total, matching
  // the engine's totalIncomeFiat.
  const by = new Map();
  for (const l of r.lines) {
    const deferred = l.taxedAtReceipt === false;
    const key = deferred ? `${catLabel(l.category)} (not taxed at receipt)` : catLabel(l.category);
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
    title: "Income type",
    w: 210,
    align: "l"
  }, {
    title: "Count",
    w: 64,
    align: "r"
  }, {
    title: `Amount (${r.fiat})`,
    w: 106,
    align: "r"
  }]);
  const rows = [...by.entries()].map(([cat, g]) => ({
    cells: [cat, String(g.n), fmt(g.amt)],
    sub: assetBreakdown(g.byAsset)
  }));
  const taxedCount = r.lines.filter(l => l.taxedAtReceipt !== false).length;
  sectionTitle(ctx, nextSection(ctx), title, r.note, tableHeight(rows, true));
  drawTable(ctx, cols, rows, {
    cells: ["Total income (taxed at receipt)", String(taxedCount), fmt(r.totalIncomeFiat)]
  });
  if (r.deferredIncomeFiat) {
    ensure(ctx, 12);
    text(ctx.page, `Received but not taxed at receipt (zero acquisition cost — taxed at the later fiat conversion): ${fmt(r.deferredIncomeFiat)} ${r.fiat}`, MRG, ctx.y - 2, 8.5, ctx.f.regular, SUB);
    ctx.y -= 12;
  }
  // Rewards paid as staked PIXA are still income on receipt — not a later
  // capital gain — which is exactly the point users get wrong.
  if (r.lines.some(l => l.asset === "PXP")) {
    csvNote(ctx, "Rewards paid in PXP (staked) are treated exactly like liquid rewards: their PIXA value on the day received is what counts, not a later capital gain.");
  }
  if (ctx.priceMode === "snapshot") {
    csvNote(ctx, "Caution: these values use one snapshot price for every date, not the price on the day each reward was received. Income must be valued on the day it is received — regenerate with historical prices before filing.");
  }
  csvNote(ctx, `Summary by type. All ${r.lines.length} income events are itemised line-by-line in ${ctx.csv}.`);
}

// Itemized non-taxable movements: proposal fees, savings withdrawals, completed
// power-ups. Listed line-by-line; the table paginates via drawTable.
function renderMovements(ctx, movements) {
  if (!movements || !movements.length) return;
  sectionTitle(ctx, nextSection(ctx), "Account movements — fees, savings, staking & delegations",
      "Not taxable disposals or income. Proposal fees leave the account and reduce holdings; conversion requests, savings withdrawals and power moves are internal and shown for completeness. Delegations lend voting power only — the PXP stays with its owner. Each row's exact time (UTC) and transaction id appear beneath its date.");
  const labels = {
    fee_payment: "Fee paid",
    savings_fill: "Savings withdrawal",
    power_down: "Power-down (unstaked)",
    request_powerdown: "Power-down request",
    request_convert: "Conversion request",
    request_collateralized: "Collateralized request",
    immediate_conversion: "Collateralized — immediate leg",
    to_own_exchange: "Sent to your exchange",
    to_own_wallet: "Sent to your own wallet",
    gift_out: "Gift sent",
    charity_donation: "Charity donation",
    delegation_out: "Delegated out (still yours)",
    delegation_in: "Delegated to you (not yours)",
    delegation_return: "Delegation returned"
  };
  // A power-up has two legs: PXA out starts the stake, PXP in completes it.
  const labelFor = (m) => m.kind === "power_up"
      ? (m.direction === "out" ? "Power-up (stake op start)" : "Power-up (stake op completed)")
      : (labels[m.kind] || m.kind);
  const cols = fit([
    { title: "Date", w: 74, align: "l" },
    { title: "Type", w: 162, align: "l" },
    { title: "Asset", w: 54, align: "l" },
    { title: "Amount", w: 90, align: "r" }
  ]);
  // The PDF is a summary; an active account can have thousands of movements, so
  // cap the table and send the full list to the CSV.
  const PDF_MOVE_CAP = 12;
  const shown = movements.slice(0, PDF_MOVE_CAP);
  const rows = shown.map(m => {
    const time = String(m.ts).slice(11, 19) || "00:00:00";
    return {
      cells: [
        String(m.ts).slice(0, 10),
        labelFor(m),
        assetName(m.asset),
        (m.direction === "out" ? "-" : "+") + fmt(m.amount, 4)
      ],
      sub: (() => {
        const t = `${time} UTC`;
        const blk = m.block != null ? ` · block ${m.block}` : "";
        const tx = m.id ? ` · tx ${m.id}` : "";
        return t + blk + tx;
      })()
    };
  });
  drawTable(ctx, cols, rows);
  if (movements.length > PDF_MOVE_CAP) {
    csvNote(ctx, `Showing the first ${PDF_MOVE_CAP} of ${movements.length} movements. The complete list is in ${ctx.csv}.`);
  }
}
// Outbound transfers classified by purpose — count and quantity per asset. This is
// the audit-ready breakdown: exact taxation of each kind of send is jurisdiction-
// specific, so the report states what went where and an adviser applies the local rules.
function renderOutbound(ctx, outboundByIntent) {
  const present = outboundByIntent && Object.keys(outboundByIntent);
  if (!present || !present.length) return;
  const note = "Every send you made over the period, grouped by what it was for, with the total amount and the number of transfers. Payments to others are disposals: their gain is computed under Transactions and taxed only where your jurisdiction taxes it. The other purposes are treated as noted. Confirm the treatment for your country with an adviser.";
  const ORDER = ["payment", "own_exchange", "own", "gift", "charity"];
  const LABEL = {
    payment: "Payments to others",
    own_exchange: "Sent to your exchange",
    own: "To your own wallet",
    gift: "Gifts",
    charity: "Charity donations"
  };
  const send = sendDisposals(ctx.bundle);
  const f = ctx.bundle.fiat;
  const cols = fit([
    { title: "Purpose", w: 110, align: "l" },
    { title: "Tax treatment", w: 150, align: "l" },
    { title: "Count", w: 50, align: "r" },
    { title: `Total (${f})`, w: 90, align: "r" }
  ]);
  const keys = ORDER.filter(k => outboundByIntent[k]).concat(present.filter(k => !ORDER.includes(k)));
  let disposalValue = 0;
  const rows = keys.map(k => {
    const s = outboundByIntent[k];
    if (s.taxable) disposalValue += s.valueFiat || 0; // engine flag = "is a disposal"
    return {
      cells: [LABEL[k] || k, outboundTreatment(k, s, send), String(s.count), fmt(s.valueFiat || 0)],
      sub: assetBreakdown(s.byAsset)
    };
  });
  const grandValue = keys.reduce((acc, k) => acc + (outboundByIntent[k].valueFiat || 0), 0);
  const grandCount = keys.reduce((acc, k) => acc + outboundByIntent[k].count, 0);
  sectionTitle(ctx, nextSection(ctx), "Transfers out — classified by purpose", note, tableHeight(rows, true));
  drawTable(ctx, cols, rows, { cells: ["Total sent out", "", String(grandCount), fmt(grandValue)] });
  const jur = ctx.bundle.jurisdiction;
  csvNote(ctx, send.count
      ? `${send.count} of these transfers (worth ${fmt(disposalValue)} ${f}) ${send.count === 1 ? "is a disposal" : "are disposals"}, with the gain computed under Transactions; ${send.taxed ? `${send.taxed} of them produced a taxable gain in ${jur}` : `none of them produced a taxable gain in ${jur}`}. Per-transfer detail is in ${ctx.csv}.`
      : `None of these transfers is a disposal. Per-transfer detail is in ${ctx.csv}.`);
}

// Per-token overview: opening / received / disposed / closing + closing value.
function renderTokens(ctx, tokenSummary) {
  if (!tokenSummary || !tokenSummary.length) return;
  const f = ctx.bundle.fiat;
  const cols = fit([
    { title: "Token", w: 48, align: "l" },
    { title: "Opening", w: 78, align: "r" },
    { title: "Received", w: 78, align: "r" },
    { title: "Out", w: 78, align: "r" },
    { title: "Closing", w: 78, align: "r" },
    { title: `Value (${f})`, w: 86, align: "r" }
  ]);
  // The engine stores an unpriced closing value as 0 (`|| 0`); show it as n/a.
  const unpriced = unpricedFigures(ctx.bundle);
  const valueOf = (t) => (unpriced && t.closingQty > 0 && !t.closingValueFiat ? NaN : t.closingValueFiat);
  const rows = tokenSummary.map(t => ({
    cells: [assetName(t.asset), fmt(t.openingQty, 4), fmt(t.receivedQty, 4), fmt(t.disposedQty, 4), fmt(t.closingQty, 4), fmt(valueOf(t))]
  }));
  const totalValue = tokenSummary.reduce((s, t) => s + valueOf(t), 0);
  sectionTitle(ctx, nextSection(ctx), "Per-token summary",
      "Opening balance, total received and disposed over the period, and the closing balance for each token. Opening reflects any balances entered under Advanced.",
      tableHeight(rows, true));
  drawTable(ctx, cols, rows, { cells: ["Total", "", "", "", "", fmt(totalValue)] });
  // The engine rebuilds PXP from history (VESTS converted at one ratio), which
  // drifts from the real stake once the vesting ratio moves. Say so.
  if (tokenSummary.some(t => t.asset === "PXP")) {
    csvNote(ctx, "PXP quantities are rebuilt from the account history at the vesting ratio shown in the valuation basis. Check the closing PXP against the account's on-chain vesting balance at the same date before filing — if they differ, the on-chain balance is the one to declare.");
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
  const ing = ctx.ingest || {};
  const engineWarnings = (ctx.bundle.warnings) || [];
  const ingestWarnings = ing.warnings || [];
  const skipped = ing.skipped || {};
  const skippedKeys = Object.keys(skipped).sort((a, b) => skipped[b] - skipped[a]);
  const unpriced = unpricedFigures(ctx.bundle);
  if (!unpriced && !engineWarnings.length && !ingestWarnings.length && !skippedKeys.length
      && !ctx.pricingNote && !ctx.jurisdictionNote) return;

  sectionTitle(ctx, "!", "Review & notes");

  if (unpriced) para(ctx, unpricedMessage(ctx.bundle), { bullet: true, color: INK, font: ctx.f.bold });
  for (const w of engineWarnings) para(ctx, w, { bullet: true });
  for (const w of ingestWarnings) para(ctx, w, { bullet: true });

  if (skippedKeys.length) {
    const total = skippedKeys.reduce((s, k) => s + skipped[k], 0);
    const counted = ctx.bundle.incomeTiming === "accrual" ? "when credited" : "at claim";
    para(ctx, `Operations seen in the account history but not booked into the figures above — ${total} in total. These are social/governance actions with no balance impact, income already counted ${counted}, or movements settled at a later fill/execution. Counts by type:`, { gap: 2 });
    para(ctx, skippedKeys.map(k => `${k} \u00d7${skipped[k]}`).join("   \u00b7   "), { size: 8 });
  }

  if (ctx.pricingNote) para(ctx, ctx.pricingNote, { size: 8 });
  if (ctx.jurisdictionNote) para(ctx, ctx.jurisdictionNote, { size: 8 });
}

// ═══════════════════════════════════════════════════════════════════════════
// FOOTERS (final pass, once page count is known)
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// COVER PAGE + BASIS OF PREPARATION
// ═══════════════════════════════════════════════════════════════════════════

function renderCover(ctx) {
  newPage(ctx, false);
  const pg = ctx.page, b = ctx.bundle, f = ctx.f;
  const period = `${String(b.periodStart || `${b.year}-01-01`).slice(0, 10)}  to  ${String(b.periodEnd || `${b.year}-12-31`).slice(0, 10)}`;

  // Brand lockup
  let y = PAGE_H - 120;
  if (ctx.logo) {
    const BOX_H = 40, MAX_W = 200;
    const k = Math.min(BOX_H / (ctx.logo.height || 1), MAX_W / (ctx.logo.width || 1));
    pg.drawImage(ctx.logo, { x: MRG, y, width: (ctx.logo.width || 1) * k, height: (ctx.logo.height || 1) * k });
    y -= 30;
  }
  text(pg, "PIXAGRAM  ·  FAIRFLOW TAX ENGINE", MRG, y, 9, f.bold, SUB);
  y -= 34;
  text(pg, `Tax Report ${b.year}`, MRG, y, 30, f.bold, INK);
  y -= 14;
  bar(pg, MRG, y, CONTENT_W, 2.2, ACCENT);
  y -= 30;

  const idLine = (label, value, big) => {
    text(pg, label.toUpperCase(), MRG, y, 7.5, f.bold, SUB);
    text(pg, value, MRG + 130, y, big ? 11 : 10, big ? f.bold : f.regular, INK);
    y -= 20;
  };
  idLine("Account", `@${b.account}`, true);
  idLine("Period", period);
  idLine("Jurisdiction", `${b.jurisdictionName || b.jurisdiction} (${b.jurisdiction})  —  reported in ${b.fiat}`);

  // Document control block
  y -= 16;
  text(pg, "DOCUMENT CONTROL", MRG, y, 8, f.bold, SUB);
  y -= 10;
  const rows = [
    ["Generated", b.generatedAt],
    ["Ruleset", String(b.rulesVersion || "")],
    ["Price data", String(b.priceDataVersion || "")],
    ["Cost basis method", METHOD_LABELS[b.methodUsed] || String(b.methodUsed || "")],
    ["Income recognition", TIMING_LABELS[b.incomeTiming] || String(b.incomeTiming || "")],
    ["Report ID", ctx.reportId],
    ["Fingerprint (SHA-256)", ctx.fingerprint
        ? `${ctx.fingerprint.slice(0, 32)}\n${ctx.fingerprint.slice(32)}`
        : "unavailable in this environment"]
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
    text(pg, label, MRG + 16, ry, 8, f.bold, SUB);
    for (const [i, ln] of lines.entries()) {
      text(pg, ln, MRG + 170, ry - i * (rowH - 4), lines.length > 1 ? 8.5 : 9, f.regular, INK);
    }
    ry -= rowH + (lines.length - 1) * (rowH - 4);
  }
  y = y - panelH - 18;
  for (const ln of wrap(
      "The fingerprint is computed over the compact JSON serialisation of this report's data bundle; " +
      "it ties this document to its CSV and JSON exports. Any figure herein can be traced to the " +
      "line-item detail in those files.", f.regular, 8, CONTENT_W)) {
    text(pg, ln, MRG, y, 8, f.regular, SUB);
    y -= 10;
  }

  // Bottom: preparer statement (the page footer adds the disclaimer + identity).
  text(pg, "Prepared by the Pixagram FairFlow tax engine from on-chain history and user-supplied classifications.",
      MRG, FOOT_Y + 44, 8, f.regular, SUB);
}

function renderBasis(ctx) {
  const b = ctx.bundle;
  sectionTitle(ctx, nextSection(ctx), "Basis of preparation",
      "How every figure in this report was computed — the method, the timing, the prices, and the assumptions.");
  const period = `${String(b.periodStart || "").slice(0, 10)} to ${String(b.periodEnd || "").slice(0, 10)}`;
  const ps = b.priceSnapshot;
  const items = [
    ["Jurisdiction & rules", `${b.jurisdictionName || b.jurisdiction} (${b.jurisdiction}), ruleset ${b.rulesVersion}. Figures reported in ${b.fiat}.`],
    ["Scope", `On-platform activity for @${b.account}, ${period}. Off-platform events (external exchanges, other chains) are out of scope and must be reported separately.`],
    ["Cost basis method", METHOD_LABELS[b.methodUsed] || String(b.methodUsed || "")],
    ["Income recognition", TIMING_LABELS[b.incomeTiming] || String(b.incomeTiming || "")],
    ["Tokens", "PIXA (liquid; exported as PXA in the CSV files), PXS (Pixa Supra), PXP (Pixa Power: staked PIXA, 1 PXP = 1 PIXA)."],
    ["Price basis", priceBasisText(b, ctx.priceMode)],
    ["Deductions supplied", (b.lossCarryforwardInFiat || b.exemptionUsedInFiat)
        ? [b.lossCarryforwardInFiat ? `losses carried forward ${fmt(b.lossCarryforwardInFiat)} ${b.fiat}` : "",
      b.exemptionUsedInFiat ? `exemption already used elsewhere ${fmt(b.exemptionUsedInFiat)} ${b.fiat}` : ""].filter(Boolean).join("; ") + "."
        : "None."]
  ];
  if (b.assumptionNote) items.push(["Assumptions", b.assumptionNote]);
  const LBL_W = 128;
  for (const [label, value] of items) {
    const lines = wrap(value, ctx.f.regular, 8.5, CONTENT_W - LBL_W);
    ensure(ctx, lines.length * 11 + 8);
    text(ctx.page, label, MRG, ctx.y - 9, 8.5, ctx.f.bold, SUB);
    for (const ln of lines) {
      text(ctx.page, ln, MRG + LBL_W, ctx.y - 9, 8.5, ctx.f.regular, INK);
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
  const b = ctx.bundle, f = b.fiat;
  const title = "Jurisdiction annex — Switzerland (where the figures go)";
  const note = ("How the figures map onto the return of a private investor in Switzerland. Wording follows the usual cantonal securities list (Wertschriftenverzeichnis / état des titres); your canton's form may label the lines differently. No Swiss withholding tax applies to these rewards, so their income goes in the column for income without withholding tax." +
      (f === "CHF" ? "" : ` These figures are in ${f}, but the Swiss return is filed in CHF: regenerate this report in CHF before using them.`));
  // (the heading is drawn once the rows are known, so it moves with the table)
  const cols = fit([
    { title: "Item", w: 190, align: "l" },
    { title: `Amount (${f})`, w: 86, align: "r" },
    { title: "Where it goes", w: 224, align: "l" }
  ]);
  const rows = [];
  if (b.wealth) {
    rows.push({
      cells: [`Holdings at ${b.wealth.refDate}`, fmt(b.wealth.totalFiat), "Securities list: tax value (wealth)"],
      sub: "PIXA, PXS and PXP together; staked and delegated-out PXP included"
    });
  }
  const inc = ((b.operations && b.operations.lines) || []).filter(l => l.taxedAtReceipt !== false);
  const sum = (cats) => inc.filter(l => cats.includes(l.category)).reduce((s, l) => s + l.fmvFiat, 0);
  const has = (cats) => inc.some(l => cats.includes(l.category));
  const STAKE = ["reward_curation", "savings_interest"], WORK = ["reward_author", "reward_benefactor"];
  if (has(STAKE)) rows.push({ cells: ["Curation rewards, savings interest", fmt(sum(STAKE)), "Securities list: income, no withholding tax"] });
  if (has(WORK)) rows.push({ cells: ["Author & beneficiary rewards", fmt(sum(WORK)), "Other income (self-employment if regular)"] });
  if (has(["reward_claim"])) {
    rows.push({
      cells: ["Rewards claimed (author + curation)", fmt(sum(["reward_claim"])), "Split: curation vs author (see below)"],
      sub: "Claim timing merges author and curation rewards; accrual timing would report them separately"
    });
  }
  if (has(["proposal_income"])) rows.push({ cells: ["Proposal (DPF) payouts", fmt(sum(["proposal_income"])), "Other income (self-employment if regular)"] });
  const known = [...STAKE, ...WORK, "reward_claim", "proposal_income"];
  const other = inc.filter(l => !known.includes(l.category));
  if (other.length) rows.push({ cells: ["Other income", fmt(other.reduce((s, l) => s + l.fmvFiat, 0)), "Other income"] });
  const t = b.transactions;
  if (t && t.lines && t.lines.length) {
    rows.push(gainsRegime(b) === "taxable"
        ? { cells: ["Gains on disposals", fmt(t.taxableAmountFiat), "Self-employment income (professional trader)"] }
        : {
          cells: ["Gains on disposals", fmt(t.totalGainFiat), "Not declared (tax-exempt private gain)"],
          sub: "Kept as a record; losses are not deductible either"
        });
  }
  sectionTitle(ctx, nextSection(ctx), title, note, rows.length ? tableHeight(rows, false) : 0);
  if (!rows.length) {
    para(ctx, "Nothing to declare from this account for the period.", { size: 9, color: INK, gap: 10 });
    return;
  }
  drawTable(ctx, cols, rows);
  csvNote(ctx, "Author and beneficiary rewards and proposal payouts pay for work rather than for holding tokens: if that activity is regular and organised, the canton may treat it as self-employment, which also brings AHV/AVS contributions. Curation rewards and savings interest are a return on your stake, like staking rewards.");
}

function renderJurisdictionAnnex(ctx) {
  const b = ctx.bundle;
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

  if (b.jurisdiction === "BR") {
    const inBRL = b.fiat === "BRL";
    sectionTitle(ctx, nextSection(ctx), "Jurisdiction annex — Brazil (IN RFB 1888)",
        "Monthly gross disposal proceeds against the R$30,000 self-reporting threshold for activity on non-Brazilian platforms; months over the threshold are flagged. Gross proceeds are shown as the volume proxy — include acquisitions when computing your full monthly operations volume." +
        (inBRL ? "" : ` Figures are in ${b.fiat}; the statutory threshold is defined in BRL — convert before comparing (flags not applied).`));
    const cols = fit([
      { title: "Month", w: 92, align: "l" },
      { title: "Disposals", w: 80, align: "r" },
      { title: `Gross proceeds (${b.fiat})`, w: 170, align: "r" },
      { title: "R$30,000 threshold", w: 132, align: "r" }
    ]);
    const rows = monthly().map(([m, g]) => ({
      cells: [m, String(g.n), fmt(g.proceeds), inBRL ? (g.proceeds > 30000 ? "OVER - report" : "under") : "n/a"]
    }));
    drawTable(ctx, cols, rows);
    csvNote(ctx, "DeCripto expands reporting from 2026 — keep the CSV line items for every flagged month.");
    return;
  }

  if (b.jurisdiction === "IN") {
    const inINR = b.fiat === "INR";
    sectionTitle(ctx, nextSection(ctx), "Jurisdiction annex — India (Form 26AS / TDS reconciliation)",
        "Gross consideration per month, with the indicative 1% that section 194S TDS would represent — reconcile against the credits in your Form 26AS / AIS. On P2P and foreign platforms the BUYER must deduct and deposit; annual thresholds Rs 50,000 / Rs 10,000 apply." +
        (inINR ? "" : ` Figures are in ${b.fiat}; statutory thresholds are defined in INR.`));
    const cols = fit([
      { title: "Month", w: 92, align: "l" },
      { title: "Transfers", w: 80, align: "r" },
      { title: `Gross consideration (${b.fiat})`, w: 178, align: "r" },
      { title: `Indicative TDS 1% (${b.fiat})`, w: 150, align: "r" }
    ]);
    const rows = monthly().map(([m, g]) => ({
      cells: [m, String(g.n), fmt(g.proceeds), fmt(g.proceeds * 0.01)]
    }));
    const grand = t.lines.reduce((s, l) => s + l.proceedsFiat, 0);
    drawTable(ctx, cols, rows, { cells: ["Total", String(t.lines.length), fmt(grand), fmt(grand * 0.01)] });
    return;
  }

  if (b.jurisdiction === "ID") {
    const inIDR = b.fiat === "IDR";
    sectionTitle(ctx, nextSection(ctx), "Jurisdiction annex — Indonesia (PMK 50/2025 final tax)",
        "Monthly gross disposal value with the indicative 1% FINAL income tax for transactions through foreign platforms (self-assessed by the seller where no collector is appointed) — the statutory base is the GROSS transaction value, not the gain. Registered domestic platforms withhold 0.21% instead." +
        (inIDR ? "" : ` Figures are in ${b.fiat}; the statutory base is assessed in IDR — convert before filing.`));
    const cols = fit([
      { title: "Month", w: 92, align: "l" },
      { title: "Disposals", w: 80, align: "r" },
      { title: `Gross value (${b.fiat})`, w: 178, align: "r" },
      { title: `Indicative 1% (${b.fiat})`, w: 150, align: "r" }
    ]);
    const rows = monthly().map(([m, g]) => ({
      cells: [m, String(g.n), fmt(g.proceeds), fmt(g.proceeds * 0.01)]
    }));
    const grand = t.lines.reduce((s, l) => s + l.proceedsFiat, 0);
    drawTable(ctx, cols, rows, { cells: ["Total", String(t.lines.length), fmt(grand), fmt(grand * 0.01)] });
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
    sectionTitle(ctx, nextSection(ctx), "Jurisdiction annex — United Kingdom (share matching)",
        "How disposal quantity was matched under HMRC's ordering (TCGA 1992 s.105 / s.106A): same-day acquisitions first, then acquisitions in the following 30 days, then the section-104 pool.");
    const cols = fit([
      { title: "Matching rule", w: 158, align: "l" },
      { title: "Quantity", w: 80, align: "r" },
      { title: `Cost basis (${b.fiat})`, w: 92, align: "r" },
      { title: `Proceeds (${b.fiat})`, w: 92, align: "r" },
      { title: `Gain (${b.fiat})`, w: 82, align: "r" }
    ]);
    const mkRow = (label, a) => ({ cells: [label, fmt(a.q, 4), fmt(a.b), fmt(a.p), fmt(a.g)] });
    const rows = [];
    if (agg.sd.n) rows.push(mkRow("Same-day (s.105)", agg.sd));
    if (agg.td.n) rows.push(mkRow("30-day bed & breakfast (s.106A)", agg.td));
    if (agg.pool.n) rows.push(mkRow("Section-104 pool", agg.pool));
    const tot = ["q", "b", "p", "g"].map(k => agg.sd[k] + agg.td[k] + agg.pool[k]);
    drawTable(ctx, cols, rows, { cells: ["Total", fmt(tot[0], 4), fmt(tot[1]), fmt(tot[2]), fmt(tot[3])] });
  }
}

function drawFooters(doc, f, bundle, reportId) {
  const pages = doc.getPages();
  const disclaimer = "Decision-support document generated from on-chain data — not a filed tax return. Figures must be reviewed and confirmed by a qualified advisor.";
  const identity = `${reportId}  ·  @${bundle.account}  ·  ${String(bundle.periodStart || `${bundle.year}-01-01`).slice(0, 10)} – ${String(bundle.periodEnd || `${bundle.year}-12-31`).slice(0, 10)}  ·  ${bundle.jurisdiction}`;
  pages.forEach((pg, i) => {
    // Running identity above the rule: what document, whose, which period.
    pg.drawText(safe(identity), {
      x: MRG,
      y: FOOT_Y + 18,
      size: 7,
      font: f.regular,
      color: MUTED
    });
    const pn = `Page ${i + 1} of ${pages.length}`;
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
export async function generateTaxReportPdf(bundle, opts = {}) {
  const doc = await PDFDocument.create();
  doc.setTitle(`Pixagram Tax Report ${bundle.year} — ${bundle.account}`);
  doc.setAuthor("Pixagram");
  doc.setSubject(`${bundle.jurisdiction} tax report`);
  doc.setCreator("Pixagram Tax Reporting");
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
    bundle,
    logo,
    csv: opts.csvFilename ?? "the attached CSV file",
    ingest: opts.ingest || null,
    jurisdictionNote: opts.jurisdictionNote || "",
    pricingNote: opts.pricingNote || "",
    // "historical" | "snapshot" | "unknown". Pass opts.priceMode from the dialog
    // when the price provider is known; otherwise it is read off the figures.
    priceMode: detectPriceMode(bundle, opts)
  };
  // Fingerprint the exact data this PDF renders, so the document is verifiably
  // tied to its CSV/JSON exports. Report ID is the fingerprint's first 10 hex.
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
  drawFooters(doc, f, bundle, reportId);
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

/** Per-section CSVs (clean schemas) plus one combined long-format detail CSV. */
export function generateTaxReportCsvs(bundle) {
  const fiat = bundle.fiat;

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
  if (bundle.movements) for (const m of bundle.movements) mRows.push([m.ts, m.block ?? "", m.id || "", m.kind, m.asset, m.direction, m.amount, m.note, fiat]);

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
    const send = sendDisposals(bundle);
    for (const [k, s] of Object.entries(bundle.outboundByIntent))
      for (const [a, q] of Object.entries(s.byAsset))
        obRows.push([k, outboundTreatment(k, s, send).replace(/\s*—\s*/g, " - "), a, q, s.count, s.taxable ? "yes" : "no"]);
  }

  // combined long format: one normalised row per detail line across all reports
  const cRows = [["report", "date", "category", "asset", "direction", "quantity", "unit_value", "value", "cost_basis", "gain", "taxable", "source", "fiat"]];
  if (bundle.wealth) for (const l of bundle.wealth.lines) cRows.push(["wealth", bundle.wealth.refDate, "holding", l.asset, "hold", l.qty, l.fiatPerUnit, l.valueFiat, "", "", "", l.source, fiat]);
  if (bundle.transactions) for (const l of bundle.transactions.lines) cRows.push(["transactions", l.ts, l.category, l.asset, "out", l.qtyOut, "", l.proceedsFiat, l.basisFiat, l.gainFiat, l.taxable ? "yes" : "no", l.method, fiat]);
  if (bundle.operations) for (const l of bundle.operations.lines) cRows.push(["operations", l.ts, l.category, l.asset, "in", l.qtyIn, "", l.fmvFiat, "", "", "", l.source, fiat]);
  if (bundle.movements) for (const m of bundle.movements) cRows.push(["movements", m.ts, m.kind, m.asset, m.direction, m.amount, "", "", "", "", "", m.note, fiat]);

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