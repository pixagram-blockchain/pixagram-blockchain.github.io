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
const BOTTOM_LIMIT = FOOT_Y + 26;
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
const fmt = (n, dp = 2) => n.toLocaleString("en-US", {
  minimumFractionDigits: dp,
  maximumFractionDigits: dp
});

// "1,800.0000 PXA  ·  12.0000 PXS" — full per-asset breakdown for a row sub-line,
// so token amounts are shown in full instead of truncated inside a column.
const assetBreakdown = (byAsset, dp = 4) =>
    Object.entries(byAsset || {}).map(([a, q]) => `${fmt(q, dp)} ${a}`).join("   \u00b7   ");

// The standard PDF fonts (Helvetica) use WinAnsi encoding, which throws on any
// character outside CP1252 (arrows, the Unicode minus, CJK, emoji, …). Report
// text comes partly from user data and free-text warnings, so we sanitise before
// drawing: map common typographic glyphs to ASCII, keep the CP1252 specials, and
// replace anything else with '?' so a stray character can never break the export.
function safe(s) {
  if (s == null) return "";
  s = String(s)
      .replace(/\u2192/g, "->").replace(/\u2190/g, "<-").replace(/\u2194/g, "<->")
      .replace(/\u21D2/g, "=>").replace(/\u21D0/g, "<=")
      .replace(/\u2212/g, "-")                       // minus sign
      .replace(/[\u2032\u2035]/g, "'");              // primes
  // Keep WinAnsi-encodable typographic glyphs; drop anything else >= U+2000.
  const KEEP = "\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026\u2122\u20AC";
  return s.replace(/[\u2000-\uFFFF]/g, (c) => (KEEP.indexOf(c) >= 0 ? c : "?"));
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

  // KPI cards
  const cards = [];
  if (b.wealth) cards.push(["NET WEALTH @ " + b.wealth.refDate.slice(5), `${fmt(b.wealth.totalFiat)} ${b.fiat}`, INK]);
  if (b.transactions) cards.push(["TAXABLE AMOUNT", `${fmt(b.transactions.taxableAmountFiat ?? b.transactions.taxableGainFiat)} ${b.fiat}`, INK]);
  if (b.operations) cards.push(["REWARD & INTEREST INCOME", `${fmt(b.operations.totalIncomeFiat)} ${b.fiat}`, INK]);
  const gap = 10,
      cw = (CONTENT_W - gap * (cards.length - 1)) / cards.length,
      ch = 48;
  cards.forEach(([label, val], i) => {
    const x = MRG + i * (cw + gap);
    drawRR(pg, x, y - ch, cw, ch, 7, ZEBRA);
    bar(pg, x + 9, y - ch + 6, 3, ch - 12, ACCENT); // rounded accent edge, inset off the card corners
    text(pg, label, x + 20, y - 16, 7, ctx.f.bold, SUB);
    text(pg, val, x + 20, y - 36, 14, ctx.f.bold, INK);
  });

  // Valuation basis — the exact unit prices and vesting ratio every figure was
  // computed from, so the report is auditable and not a black box.
  const ps = b.priceSnapshot;
  if (ps) {
    const yy = y - ch - 16;
    const px = (a, v) => `${a} ${v != null ? fmt(v, 4) : "n/a"}`;
    const parts = [px("PXA", ps.PXA), px("PXS", ps.PXS), `PXP ${ps.PXP != null ? fmt(ps.PXP, 4) : "n/a"} (= PXA)`];
    if (ps.vestingRatio != null) parts.push(`VESTS x ${fmt(ps.vestingRatio, 6)} = PXP`);
    text(pg, `Valuation basis @ ${ps.asOf} ${ps.timezone} — prices in ${ps.fiat}:`, MRG, yy, 7.5, ctx.f.bold, SUB);
    text(pg, parts.join("      "), MRG, yy - 11, 8, ctx.f.regular, INK);
    ctx.y = yy - 24;
  } else {
    ctx.y = y - ch - 22;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION + TABLE
// ═══════════════════════════════════════════════════════════════════════════

// Sequential section numbers regardless of which sections a jurisdiction emits
// (no stray "T", and no gaps when wealth/movements are absent).
function nextSection(ctx) { return String(ctx.section = (ctx.section || 0) + 1); }
function sectionTitle(ctx, n, title, note) {
  ensure(ctx, note ? 54 : 42);
  const pg = ctx.page;
  text(pg, `${n}   ${title}`, MRG, ctx.y - 10, 12.5, ctx.f.bold, INK);
  ctx.y -= 18;
  bar(pg, MRG, ctx.y + 2, CONTENT_W, 1.2, ACCENT); // heavier rule anchors the section
  ctx.y -= 8;
  if (note) {
    for (const ln of wrap(note, ctx.f.oblique, 8, CONTENT_W)) {
      text(pg, ln, MRG, ctx.y - 8, 8, ctx.f.oblique, SUB);
      ctx.y -= 11;
    }
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
  ensure(ctx, 10 + HEAD_H + ROW_H);
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
  ensure(ctx, 14);
  for (const ln of wrap(msg, ctx.f.oblique, 8, CONTENT_W)) {
    text(ctx.page, ln, MRG, ctx.y - 8, 8, ctx.f.oblique, SUB);
    ctx.y -= 11;
  }
  ctx.y -= 8;
}
function renderWealth(ctx, r) {
  sectionTitle(ctx, nextSection(ctx), "Wealth statement", r.note);
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
    cells: [l.asset, fmt(l.qty, 4), fmt(l.fiatPerUnit, 4), fmt(l.valueFiat), l.source]
  }));
  drawTable(ctx, cols, rows, {
    cells: ["Total", "", "", `${fmt(r.totalFiat)}`, ""]
  });
  csvNote(ctx, `Per-asset holdings at the reference date. Full balance detail is in ${ctx.csv}.`);
}
function renderTransactions(ctx, r) {
  const note = [r.note, r.safeHarbourCheck ? `Disposals this period: ${r.safeHarbourCheck.disposalCount}. ${r.safeHarbourCheck.note}` : ""].filter(Boolean).join("  ");
  sectionTitle(ctx, nextSection(ctx), "Transactions — disposals & swaps", note);

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
    cells: [cat, String(g.n), fmt(g.proceeds), fmt(g.basis), fmt(g.gain)],
    sub: assetBreakdown(g.byAsset)
  }));
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
    ensure(ctx, 16);
    text(ctx.page, "By asset", MRG, ctx.y - 9, 9, ctx.f.bold, INK);
    ctx.y -= 12;
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
      cells: [asset, String(a.n), fmt(a.proceeds), fmt(a.basis), fmt(a.gain), fmt(a.taxable), a.exempt ? fmt(a.exempt) : "-"]
    }));
    drawTable(ctx, acols, arows);
  }
  ensure(ctx, 16);
  text(ctx.page, `Taxable gain for ${ctx.bundle.jurisdiction}: ${fmt(r.taxableGainFiat)} ${r.fiat}`, MRG, ctx.y - 4, 9, ctx.f.bold, INK);
  ctx.y -= 14;
  if (r.splitByTerm || r.exemptGainFiat) {
    const parts = [];
    if (r.splitByTerm) parts.push(`short-term ${fmt(r.shortTermGainFiat)}`, `long-term ${fmt(r.longTermGainFiat)}`);
    if (r.exemptGainFiat) parts.push(`tax-free ${fmt(r.exemptGainFiat)}`);
    ensure(ctx, 12);
    text(ctx.page, `Of which — ${parts.join("  ·  ")} ${r.fiat}`, MRG, ctx.y - 2, 8.5, ctx.f.regular, SUB);
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
  const steps = r.deductionSteps && r.deductionSteps.length ? r.deductionSteps : null;
  if ((steps && steps.length > 1) || r.disallowedLossesFiat) {
    ensure(ctx, 30);
    text(ctx.page, "Computation of taxable amount", MRG, ctx.y - 10, 9.5, ctx.f.bold, INK);
    ctx.y -= 18;
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
    drawTable(ctx, cols, rows, { cells: [last.label, fmt(last.value)] });
  }
  ensure(ctx, 14);
  text(ctx.page, `Taxable amount for ${ctx.bundle.jurisdiction}: ${fmt(r.taxableAmountFiat)} ${r.fiat}`, MRG, ctx.y - 4, 9.5, ctx.f.bold, INK);
  ctx.y -= 14;
  if (r.lossCarryforwardOutFiat) {
    ensure(ctx, 11);
    text(ctx.page, `Loss to carry forward: ${fmt(r.lossCarryforwardOutFiat)} ${r.fiat}`, MRG, ctx.y - 2, 8.5, ctx.f.regular, SUB);
    ctx.y -= 12;
  }
  csvNote(ctx, `Summary by type. All ${r.lines.length} disposals — with the cost-basis lots consumed and holding period — are itemised line-by-line in ${ctx.csv}.`);
}
function renderOperations(ctx, r) {
  sectionTitle(ctx, nextSection(ctx), "Operations — reward & interest income", r.note);

  // sub-details: aggregate by income type; every individual receipt goes to the
  // CSV. Zero-basis jurisdictions (FR/AT) flag lines taxedAtReceipt=false —
  // those aggregate separately and are excluded from the income total, matching
  // the engine's totalIncomeFiat.
  const by = new Map();
  for (const l of r.lines) {
    const deferred = l.taxedAtReceipt === false;
    const key = deferred ? `${l.category} (deferred)` : l.category;
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
  drawTable(ctx, cols, rows, {
    cells: ["Total income (taxed at receipt)", String(taxedCount), fmt(r.totalIncomeFiat)]
  });
  if (r.deferredIncomeFiat) {
    ensure(ctx, 12);
    text(ctx.page, `Received but not taxed at receipt (zero acquisition cost — taxed at the later fiat conversion): ${fmt(r.deferredIncomeFiat)} ${r.fiat}`, MRG, ctx.y - 2, 8.5, ctx.f.regular, SUB);
    ctx.y -= 12;
  }
  csvNote(ctx, `Summary by type. All ${r.lines.length} income events are itemised line-by-line in ${ctx.csv}.`);
}

// Itemized non-taxable movements: proposal fees, savings withdrawals, completed
// power-ups. Listed line-by-line; the table paginates via drawTable.
function renderMovements(ctx, movements) {
  if (!movements || !movements.length) return;
  sectionTitle(ctx, nextSection(ctx), "Account movements — fees, savings & power-ups",
      "Not taxable disposals or income. Proposal fees leave the account and reduce holdings; conversion requests, savings withdrawals and power moves are internal and shown for completeness. Each row's exact time (UTC) and transaction id appear beneath its date.");
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
    charity_donation: "Charity donation"
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
        m.asset,
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
  sectionTitle(ctx, nextSection(ctx), "Transfers out — classified by purpose",
      "Every send you made over the period, grouped by what it was for, with the total amount and the number of transfers. Payments are taxable disposals; the rest are taxed differently or not at all, as noted. Confirm the treatment for your country with an adviser.");
  const ORDER = ["payment", "own_exchange", "own", "gift", "charity"];
  const LABEL = {
    payment: "Payments / sales",
    own_exchange: "Sent to your exchange",
    own: "To your own wallet",
    gift: "Gifts",
    charity: "Charity donations"
  };
  const treat = (k, taxable) => {
    if (k === "payment") return "Taxable disposal";
    if (k === "own_exchange") return "Sale is off-platform";
    if (k === "own") return "Internal — not a disposal";
    if (k === "gift") return taxable ? "Disposal at market value" : "Not a disposal here";
    if (k === "charity") return taxable ? "Treated as a disposal" : "Exempt donation";
    return "";
  };
  const f = ctx.bundle.fiat;
  const cols = fit([
    { title: "Purpose", w: 110, align: "l" },
    { title: "Tax treatment", w: 150, align: "l" },
    { title: "Count", w: 50, align: "r" },
    { title: `Total (${f})`, w: 90, align: "r" }
  ]);
  const keys = ORDER.filter(k => outboundByIntent[k]).concat(present.filter(k => !ORDER.includes(k)));
  let taxableCount = 0, taxableValue = 0;
  const rows = keys.map(k => {
    const s = outboundByIntent[k];
    if (s.taxable) { taxableCount += s.count; taxableValue += s.valueFiat || 0; }
    return {
      cells: [LABEL[k] || k, treat(k, s.taxable), String(s.count), fmt(s.valueFiat || 0)],
      sub: assetBreakdown(s.byAsset)
    };
  });
  const grandValue = keys.reduce((acc, k) => acc + (outboundByIntent[k].valueFiat || 0), 0);
  const grandCount = keys.reduce((acc, k) => acc + outboundByIntent[k].count, 0);
  drawTable(ctx, cols, rows, { cells: ["Total sent out", "", String(grandCount), fmt(grandValue)] });
  csvNote(ctx, `${taxableCount} of these transfers (worth ${fmt(taxableValue)} ${f}) are taxable disposals — their gains are computed in the Disposals section above. Per-transfer detail is in ${ctx.csv}.`);
}

// Per-token overview: opening / received / disposed / closing + closing value.
function renderTokens(ctx, tokenSummary) {
  if (!tokenSummary || !tokenSummary.length) return;
  sectionTitle(ctx, nextSection(ctx), "Per-token summary",
      "Opening balance, total received and disposed over the period, and the closing balance for each token. Opening reflects any balances entered under Advanced.");
  const f = ctx.bundle.fiat;
  const cols = fit([
    { title: "Token", w: 48, align: "l" },
    { title: "Opening", w: 78, align: "r" },
    { title: "Received", w: 78, align: "r" },
    { title: "Out", w: 78, align: "r" },
    { title: "Closing", w: 78, align: "r" },
    { title: `Value (${f})`, w: 86, align: "r" }
  ]);
  const rows = tokenSummary.map(t => ({
    cells: [t.asset, fmt(t.openingQty, 4), fmt(t.receivedQty, 4), fmt(t.disposedQty, 4), fmt(t.closingQty, 4), fmt(t.closingValueFiat)]
  }));
  const totalValue = tokenSummary.reduce((s, t) => s + t.closingValueFiat, 0);
  drawTable(ctx, cols, rows, { cells: ["Total", "", "", "", "", fmt(totalValue)] });
}

// Wrapped paragraph that paginates. Bullet optional.
function para(ctx, s, opts = {}) {
  const size = opts.size || 8.5;
  const color = opts.color || SUB;
  const gap = opts.gap == null ? 3 : opts.gap;
  const prefix = opts.bullet ? "•  " : "";
  const lines = wrap(prefix + String(s), ctx.f.regular, size, CONTENT_W - 6);
  ensure(ctx, lines.length * (size + 2.5) + gap);
  for (const ln of lines) {
    text(ctx.page, ln, MRG, ctx.y - (size + 0.5), size, ctx.f.regular, color);
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
  if (!engineWarnings.length && !ingestWarnings.length && !skippedKeys.length
      && !ctx.pricingNote && !ctx.jurisdictionNote) return;

  sectionTitle(ctx, "!", "Review & notes");

  for (const w of engineWarnings) para(ctx, w, { bullet: true });
  for (const w of ingestWarnings) para(ctx, w, { bullet: true });

  if (skippedKeys.length) {
    const total = skippedKeys.reduce((s, k) => s + skipped[k], 0);
    para(ctx, `Operations seen in the account history but not booked into the figures above — ${total} in total. These are social/governance actions with no balance impact, income already counted at claim, or movements settled at a later fill/execution. Counts by type:`, { gap: 2 });
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
    ["Price basis", String(b.priceDataVersion || "")],
    ["Cost basis method", METHOD_LABELS[b.methodUsed] || String(b.methodUsed || "")],
    ["Income recognition", TIMING_LABELS[b.incomeTiming] || String(b.incomeTiming || "")],
    ["Report ID", ctx.reportId],
    ["Fingerprint (SHA-256)", ctx.fingerprint
        ? `${ctx.fingerprint.slice(0, 32)}\n${ctx.fingerprint.slice(32)}`
        : "unavailable in this environment"]
  ];
  const rowH = 17, pad = 12;
  const panelH = rows.reduce((h, r) => h + (r[1].includes("\n") ? rowH * 2 - 4 : rowH), 0) + pad * 2 - 4;
  drawRR(pg, MRG, y - panelH, CONTENT_W, panelH, 9, ZEBRA);
  let ry = y - pad - 8;
  for (const [label, value] of rows) {
    text(pg, label, MRG + 16, ry, 8, f.bold, SUB);
    const lines = value.split("\n");
    for (const [i, ln] of lines.entries()) {
      text(pg, ln, MRG + 170, ry - i * (rowH - 4), lines.length > 1 ? 8.5 : 9, f.regular, INK);
    }
    ry -= lines.length > 1 ? rowH * 2 - 4 : rowH;
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
    ["Price basis", `${b.priceDataVersion || "n/a"}.${ps ? ` Single point-in-time snapshot (${ps.asOf} ${ps.timezone}) applied to all dates — historical price series are not used, so receipt-time and disposal-time valuations share unit prices.` : ""}`],
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

function renderJurisdictionAnnex(ctx) {
  const b = ctx.bundle;
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
    pricingNote: opts.pricingNote || ""
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

function csvCell(v) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
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
    l.taxable ? "yes" : "no", l.isSwap ? "yes" : "no", l.counterparty ? "@" + l.counterparty : "", l.method, fiat]);

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
      g.acquiredTs ? (g.count > 1 ? `${g.acquiredTs} → ${g.lastTs}` : g.acquiredTs) : "(pooled/none)",
      g.count, r4c(g.qty),
      r2c(g.basisFiat), r2c(g.proceedsFiat), r2c(g.gainFiat),
      g.minHeld == null ? "" : (g.minHeld === g.maxHeld ? g.minHeld : `${g.minHeld}–${g.maxHeld}`),
      g.term, matchLabel(g), g.taxable ? "yes" : "no", g.missingBasis ? "yes" : "", fiat]);
  }

  const oRows = [["date", "block", "txid", "category", "asset", "qty_in", "income", "taxed_at_receipt", "source", "counterparty", "fiat"]];
  if (bundle.operations) for (const l of bundle.operations.lines) oRows.push([l.ts, l.block ?? "", l.id || "", l.category, l.asset, l.qtyIn, l.fmvFiat, l.taxedAtReceipt === false ? "no" : "yes", l.source, l.counterparty ? "@" + l.counterparty : "", fiat]);

  const mRows = [["date", "block", "txid", "kind", "asset", "direction", "amount", "note", "fiat"]];
  if (bundle.movements) for (const m of bundle.movements) mRows.push([m.ts, m.block ?? "", m.id || "", m.kind, m.asset, m.direction, m.amount, m.note, fiat]);

  // Per-token summary: opening / received / disposed / closing per asset.
  const kRows = [["asset", "opening_qty", "received_qty", "income_qty", "income_value", "out_qty", "taxable_disposed_qty", "closing_qty", "closing_value", "fiat"]];
  if (bundle.tokenSummary) for (const t of bundle.tokenSummary) kRows.push([t.asset, t.openingQty, t.receivedQty, t.incomeQty, t.incomeFiat, t.disposedQty, t.taxableDisposedQty, t.closingQty, t.closingValueFiat, fiat]);

  // Crypto moved to your own exchange — the taxable sale happens off-platform.
  const xRows = [["date", "asset", "qty", "cost_basis_that_left", "counterparty", "fiat"]];
  if (bundle.offPlatformBasis) for (const o of bundle.offPlatformBasis) xRows.push([o.ts, o.asset, o.qty, o.basisFiat, o.counterparty ? "@" + o.counterparty : "", fiat]);

  // Outbound transfers classified by purpose — total quantity per asset + count.
  const obRows = [["purpose", "tax_treatment", "asset", "total_sent", "transfers_in_purpose", "taxable"]];
  if (bundle.outboundByIntent) {
    const TR = { payment: "Taxable disposal", own_exchange: "Sale off-platform", own: "Internal move", gift: "Per jurisdiction", charity: "Per jurisdiction" };
    for (const [k, s] of Object.entries(bundle.outboundByIntent))
      for (const [a, q] of Object.entries(s.byAsset))
        obRows.push([k, TR[k] || "", a, q, s.count, s.taxable ? "yes" : "no"]);
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