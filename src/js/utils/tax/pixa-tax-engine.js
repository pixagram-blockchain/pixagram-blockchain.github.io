/* =============================================================================
 * Pixagram tax-reporting engine — reference implementation
 *
 * One classified ledger -> three independent user-facing reports:
 *   1. WEALTH       point-in-time holdings valued at the year-end reference date
 *   2. TRANSACTIONS disposals/swaps -> capital gain/loss (taxable per residence)
 *   3. OPERATIONS   rewards & interest -> ordinary income at FMV on receipt
 *
 * The user supplies a profile ONCE (residence, owned wallets, election); after
 * that, buildAllReports(profile, events, year) is the "one click".
 *
 * Tax treatments below are ILLUSTRATIVE of the architecture. The Swiss rules are
 * modelled on public guidance but must be signed off by qualified counsel before
 * production use — especially the open PXP (utility token) and PXS (supracoin)
 * characterisation questions, which are exposed here as configurable flags.
 *
 * TEXT: every user-facing string the engine emits (ruleset names and notes,
 * deduction step labels, warnings, movement notes) is a translation
 * descriptor { $t: key, v: vars } — the shape utils/text.js tk() builds — not
 * prose. The engine imports nothing, so it still runs in Node (see the demo at
 * the end); the dialog resolves descriptors on screen (utils/docLanguage.js
 * uiText) and the PDF/CSV resolve them in the document's language. Number
 * variables stay numbers, so they are formatted in that language too.
 *
 * OPTIMISATION (Nov 2026): buildAllReports() also returns `optimization` — the
 * legal levers still open to the user, computed from the same ledger (dates
 * when lots pass a holding period, unused allowances, losses that could still
 * offset gains, Swiss private-investor checks, sends still taxed by default,
 * a cheaper cost-basis method where the law lets the user choose), plus plain
 * statements of what does NOT lower tax: powering up before the reference
 * date, delaying a power-down, staking rewards. It never changes a reported
 * figure — everything stays reported in full. Same pass, corrections the
 * levers depend on: holding periods end on the calendar anniversary (a sale ON
 * the anniversary is still short-term in US/DE/AU), the DE Freigrenze is
 * "less than" EUR 1,000, UK and ZA losses brought forward follow the
 * statutory order instead of being used up below the allowance, the US
 * $3,000 ordinary-income offset is no longer carried forward, and sends to
 * accounts the ingest marked as your own default to "own", not "payment".
 *
 * ACCURACY AUDIT (25 Nov 2026) — what the law actually taxes, and when:
 *  - FR / AT / PT tax a private holder when crypto is sold for money or SPENT
 *    on goods and services; exchanging one crypto for another is not the
 *    taxable event and the cost carries over (ruleset.swapRollover). The engine
 *    did the reverse on both counts: payments were never taxed, and each swap
 *    stepped the cost up to market value, so the gain escaped for good.
 *  - FR: the whole-portfolio formula of art. 150 VH bis III ("PORTFOLIO"), the
 *    EUR 305 threshold on disposal prices, no loss carry-forward, and rewards
 *    as BNC income on receipt (impots.gouv.fr) instead of a zero-cost deferral.
 *  - AT: moving-average cost is mandatory (KryptowährungsVO § 2), no loss
 *    carry-forward. PT: FIFO is mandatory, crypto-paid income is taxed only on
 *    disposal (art. 5 n.º 11 CIRS), gifts are not category-G disposals.
 *  - An exchange has ONE value: both sides are booked at it (exchangeValues).
 *    Valuing each side at its own price let a fee or a spread leak out of —
 *    or into — the gain.
 *  - DE: the Freigrenze is tested on the year's own gain before losses brought
 *    forward (BFH IX R 27/04), and counts other private-sale gains.
 *  - Statutory amounts follow their history (ZA R50,000 from 1 March 2026; UK
 *    and DE earlier years); non-calendar tax years are flagged
 *    (statutoryPeriodFor); AU donations are CGT events; DE donations are not
 *    sales; the year-end residence is the one in force on the last day.
 *  - JP: the total-average fixed point is iterated to convergence (eight
 *    passes left the year's average off when stake moved both ways).
 *  - Robustness: an unknown category or jurisdiction no longer throws, a
 *    staking move on an unpriced day still carries its cost, and a send to an
 *    exchange account configured as the user's own is not taxed as a payment.
 *  - New levers: swaps that defer tax, the DE EUR 256 / UK £1,000 income
 *    limits, the FR micro-BNC allowance and EUR 305 headroom, the NL actual-
 *    return claim, the BR reading that keeps the R$35,000 month exempt, and
 *    pending law in US / UK / JP / KR / NL next to DE.
 * ===========================================================================*/

/** Deferred translation — same shape as utils/text.js tk(), resolved by the caller. */
function tk(key, vars) {
  return vars ? { $t: key, v: vars } : { $t: key };
}

// ---------------------------------------------------------------------------
// 1. DOMAIN MODEL  (jurisdiction-invariant)
// ---------------------------------------------------------------------------

/** Canonical categories. Each maps to one or more underlying Pixa/HIVE ops. */

// interest

/** One normalised on-chain event. `id` is the idempotency key (tx + op index). */

/**
 * Optional reporting window. When omitted, buildAllReports uses the full
 * calendar `year` (Jan 1 .. Dec 31, identical to the original behaviour). When
 * supplied (e.g. from the dialog's date-range pickers), it overrides the scope
 * and the valuation reference date; `end` is inclusive. Residence and the filing
 * year stay keyed to `year`.
 */

// ---------------------------------------------------------------------------
// 2. VALUATION LAYER  (jurisdiction-invariant; PXS oracle anchors the rest)
// ---------------------------------------------------------------------------

/**
 * Demo provider. The point of interest: PXS is oracle-referenced (a basket peg),
 * so it provides the fiat ANCHOR. PXA derives from the PXA/PXS market rate, and
 * PXP from the vesting (power) conversion rate. A real provider swaps in live
 * oracle + DEX data and a real Kursliste lookup.
 */
export class PxsAnchoredPriceProvider {
  version = "demo-prices-2026.1";
  vestingPerPxa = 1; // VESTS per PXA (1:1 in the demo)
  pixaPerVest = 1;   // PXA per VEST — VESTS x this = PXP (= PXA). 1:1 in the demo.
  // The asset this provider prices first-hand; the others derive from it. An
  // exchange with a leg in it is valued at that leg (see exchangeValues). A
  // provider that leaves it unset gets the legal default: the value received.
  anchorAsset = "PXS";

  // PXS basket reference per fiat (Big-Mac-index style anchor). Every fiat a
  // ruleset can file in must be present — a missing key silently poisons all
  // downstream valuations for that jurisdiction (NaN basis, null gains). Ten
  // of the rulesets' currencies were missing here (AED … NGN): illustrative
  // values, like the rest of the demo.
  pxsBase = {
    CHF: 6.5,
    USD: 5.69,
    EUR: 5.9,
    GBP: 4.45,
    CAD: 7.8,
    AUD: 8.7,
    JPY: 885,
    BRL: 31,
    KRW: 7800,
    INR: 480,
    SGD: 7.6,
    AED: 20.9,
    HKD: 44.3,
    NZD: 9.6,
    ZAR: 103,
    MXN: 105,
    ARS: 7000,
    THB: 185,
    ILS: 21,
    IDR: 92000,
    NGN: 8700
  };

  // Mild deterministic drift so receipt-date and year-end values differ
  // (this is what makes gains/losses non-zero in the demo).
  drift(isoDate) {
    const d = new Date(isoDate);
    const months = (d.getUTCFullYear() - 2024) * 12 + d.getUTCMonth();
    return 1 + 0.01 * months; // ~1% / month
  }
  pxsFiat(fiat, isoDate) {
    return this.pxsBase[fiat] * this.drift(isoDate);
  }

  // PXA per PXS: starts at 20, eases to ~18 as PXA appreciates vs PXS.
  pxaPerPxs(isoDate) {
    const d = new Date(isoDate);
    const months = (d.getUTCFullYear() - 2024) * 12 + d.getUTCMonth();
    return Math.max(18, 20 - 0.05 * months);
  }
  price(asset, fiat, isoDate) {
    const pxs = this.pxsFiat(fiat, isoDate);
    if (asset === "PXS") return {
      fiatPerUnit: pxs,
      source: "market_oracle"
    };
    const pxa = pxs / this.pxaPerPxs(isoDate); // PXA via market rate
    if (asset === "PXA") return {
      fiatPerUnit: pxa,
      source: "market_oracle"
    };
    // PXP valued at its PXA-equivalent (vesting rate ~1:1 in the demo).
    return {
      fiatPerUnit: pxa,
      source: "market_oracle"
    };
  }
  officialYearEnd(asset, fiat, year) {
    // PXA/PXP/PXS are not on any tax authority's official list -> null,
    // which forces the wealth report down the platform_price fallback.
    return null;
  }
}

// ---------------------------------------------------------------------------
// 3. COST-BASIS LOT LEDGER
// ---------------------------------------------------------------------------

/**
 * Lots are pooled per (account, asset) for clarity. NOTE: US Rev. Proc. 2024-28
 * mandates wallet-by-wallet basis — for US users, key lots by
 * `${account}::${wallet}::${asset}` and treat own-wallet transfers as lot moves.
 * That switch is a one-line change to `key()` plus transfer handling.
 */
export class LotBook {
  lots = new Map();
  grossIn = new Map();   // total qty acquired per asset (incl. opening) — for reconciliation
  grossOut = new Map();  // total qty that left holdings per asset (disposals + sends + fees)
  key(account, asset) {
    return `${account}::${asset}`;
  }
  acquire(account, asset, qty, basisFiat, ts) {
    if (qty <= 0) return;
    const k = this.key(account, asset);
    const arr = this.lots.get(k) ?? [];
    arr.push({
      qty,
      basisFiat,
      acquiredTs: ts
    });
    this.lots.set(k, arr);
    this.grossIn.set(asset, (this.grossIn.get(asset) || 0) + qty);
  }
  consume(account, asset, qty, method, ts, valueFiat) {
    const k = this.key(account, asset);
    const arr = this.lots.get(k) ?? [];

    // France — art. 150 VH bis III CGI. A disposal is not costed from the lots
    // of the token sold: its cost is the WHOLE portfolio's acquisition price
    // times (price of the disposal / value of the whole portfolio), and the
    // portfolio's acquisition price falls by that amount. So every lot of
    // every asset gives up the same fraction of its cost, and the token sold
    // gives up quantity only. Used for everything that leaves the portfolio
    // (the notice to form 2086 deducts the fraction of the acquisition price
    // contained in earlier disposals, for value or free of charge); exchanges
    // and staking moves carry their cost instead and are consumed as "POOL".
    // `this.priceAt(asset, ts)` is injected by the engine, `valueFiat` is the
    // disposal's price when the caller has it. Only on-platform holdings are
    // visible: the figure is exact only when they are the whole portfolio.
    if (method === "PORTFOLIO") {
      const totalQty = arr.reduce((s, l) => s + l.qty, 0);
      const take = Math.min(totalQty, qty);
      const prefix = `${account}::`;
      const mine = [];
      let cost = 0, value = 0;
      for (const [key, lots] of this.lots) {
        if (!key.startsWith(prefix)) continue;
        mine.push([key, lots]);
        cost += lots.reduce((s, l) => s + l.basisFiat, 0);
        const q = lots.reduce((s, l) => s + l.qty, 0);
        const u = this.priceAt ? Number(this.priceAt(key.slice(prefix.length), ts)) : NaN;
        if (q > 1e-12 && Number.isFinite(u) && u > 0) value += q * u;
      }
      const unit = this.priceAt ? Number(this.priceAt(asset, ts)) : NaN;
      const price = Number.isFinite(valueFiat) && qty > 0 ? valueFiat * (take / qty)
          : (Number.isFinite(unit) && unit > 0 ? unit * take : NaN);
      let fraction;
      if (Number.isFinite(price) && value > 0) {
        fraction = Math.min(1, Math.max(0, price / value));
      } else {
        // Unpriced: fall back to this token's own average cost.
        const own = arr.reduce((s, l) => s + l.basisFiat, 0);
        fraction = cost !== 0 && totalQty > 0 ? (own * (take / totalQty)) / cost : 0;
      }
      const basisFiat = cost * fraction;
      for (const [, lots] of mine) for (const lot of lots) lot.basisFiat -= lot.basisFiat * fraction;
      if (totalQty > 0) {
        const fracQ = take / totalQty;
        for (const lot of arr) lot.qty -= lot.qty * fracQ;
      }
      // Lots emptied here are dropped, but — unlike every other method — they
      // still hold cost: only quantity left with the sale. That cost stays in
      // the portfolio: on what remains of this token, or, when the token is
      // sold out (float dust aside), on the other assets' lots.
      const soldOut = !(arr.reduce((s, l) => s + l.qty, 0) > 1e-9);
      const kept = [];
      let residual = 0;
      for (const lot of arr) {
        if (!soldOut && lot.qty > 1e-12) kept.push(lot); else residual += lot.basisFiat;
      }
      if (residual !== 0) {
        const heirs = kept.slice();
        if (!heirs.length) {
          for (const [key, lots] of mine) if (key !== k) heirs.push(...lots.filter(l => l.qty > 1e-12));
        }
        const heirsCost = heirs.reduce((s, l) => s + l.basisFiat, 0);
        for (const lot of heirs) lot.basisFiat += residual * (heirsCost > 0 ? lot.basisFiat / heirsCost : 1 / heirs.length);
      }
      this.lots.set(k, kept);
      this.grossOut.set(asset, (this.grossOut.get(asset) || 0) + take);
      return {
        basisFiat,
        shortfallQty: Math.max(0, qty - take),
        consumedLots: take > 1e-12 ? [{ qty: take, basisFiat, acquiredTs: null }] : [],
        portfolio: { valueFiat: value, costFiat: cost, fraction }
      };
    }

    // Japan 総平均法 (total average): every disposal in a calendar year is priced
    // at that year's overall average unit cost — including acquisitions made
    // LATER in the same year — so the unit price comes from a two-pass plan
    // (buildTotalAveragePlan) injected as this.totalAvgPlan, not from the lots'
    // running state. Quantities draw down proportionally like POOL; recorded
    // lot costs are reduced by the plan-priced basis, which can transiently
    // exceed the recorded cost mid-year (an early sale carries December's
    // purchases in its price). The identity `remaining cost = avg × remaining
    // qty` is restored exactly at each year boundary — by construction, not
    // drift. Falls back to running-average pricing when no plan is present.
    if (method === "TOTAL_AVG") {
      const totalQty = arr.reduce((s, l) => s + l.qty, 0);
      const totalBasis = arr.reduce((s, l) => s + l.basisFiat, 0);
      const take = Math.min(totalQty, qty);
      const unit = this.totalAvgPlan && ts
          ? this.totalAvgPlan.unit(asset, ts)
          : (totalQty > 0 ? totalBasis / totalQty : 0);
      const basisFiat = unit * take;
      if (totalQty > 0) {
        const fracQ = take / totalQty;
        const fracB = totalBasis !== 0 ? basisFiat / totalBasis : 0;
        for (const lot of arr) {
          lot.qty -= lot.qty * fracQ;
          lot.basisFiat -= lot.basisFiat * fracB;
        }
        if (totalBasis === 0 && basisFiat !== 0 && arr.length) arr[0].basisFiat -= basisFiat;
      }
      this.lots.set(k, arr.filter(l => l.qty > 1e-12));
      this.grossOut.set(asset, (this.grossOut.get(asset) || 0) + take);
      return {
        basisFiat,
        shortfallQty: Math.max(0, qty - take),
        consumedLots: take > 1e-12 ? [{ qty: take, basisFiat, acquiredTs: null }] : []
      };
    }

    // UK section-104 style pooling: every lot of an asset shares one
    // weighted-average unit cost, drawn down proportionally on each disposal.
    if (method === "POOL") {
      const totalQty = arr.reduce((s, l) => s + l.qty, 0);
      const totalBasis = arr.reduce((s, l) => s + l.basisFiat, 0);
      const unit = totalQty > 0 ? totalBasis / totalQty : 0;
      const take = Math.min(totalQty, qty);
      const basisFiat = unit * take;
      if (totalQty > 0) {
        const frac = take / totalQty;
        for (const lot of arr) {
          lot.qty -= lot.qty * frac;
          lot.basisFiat -= lot.basisFiat * frac;
        }
      }
      this.lots.set(k, arr.filter(l => l.qty > 1e-12));
      this.grossOut.set(asset, (this.grossOut.get(asset) || 0) + take);
      return {
        basisFiat,
        shortfallQty: Math.max(0, qty - take),
        consumedLots: take > 1e-12 ? [{ qty: take, basisFiat, acquiredTs: null }] : []
      };
    }

    const order = [...arr].sort((a, b) => {
      if (method === "FIFO") return a.acquiredTs.localeCompare(b.acquiredTs);
      if (method === "LIFO") return b.acquiredTs.localeCompare(a.acquiredTs);
      return b.basisFiat / b.qty - a.basisFiat / a.qty; // HIFO: highest unit basis first
    });

    // `order` holds references to the same lot objects as `arr`, so mutating
    // through it updates the stored lots; we then filter the original `arr`.
    let remaining = qty;
    let basisFiat = 0;
    const consumedLots = [];
    for (const lot of order) {
      if (remaining <= 1e-12) break;
      const unitBasis = lot.qty > 0 ? lot.basisFiat / lot.qty : 0;
      const take = Math.min(lot.qty, remaining);
      basisFiat += unitBasis * take;
      consumedLots.push({ qty: take, basisFiat: unitBasis * take, acquiredTs: lot.acquiredTs });
      lot.qty -= take;
      lot.basisFiat -= unitBasis * take;
      remaining -= take;
    }
    this.lots.set(k, arr.filter(l => l.qty > 1e-12));
    this.grossOut.set(asset, (this.grossOut.get(asset) || 0) + (qty - remaining));
    return {
      basisFiat,
      shortfallQty: Math.max(0, remaining),
      consumedLots
    };
  }

  /** Remaining quantity and basis per asset for the account (for wealth + fallback). */
  remaining(account) {
    const out = new Map();
    for (const [k, arr] of this.lots) {
      const [acc, asset] = k.split("::");
      if (acc !== account) continue;
      const qty = arr.reduce((s, l) => s + l.qty, 0);
      const basis = arr.reduce((s, l) => s + l.basisFiat, 0);
      if (qty > 1e-12) out.set(asset, {
        qty,
        basisFiat: basis
      });
    }
    return out;
  }
}

// ---------------------------------------------------------------------------
// 4. RULES ENGINE  (jurisdiction-variant — declarative config)
// ---------------------------------------------------------------------------

// creates basis but is not itself a taxable event

const TRANSFER_OUT_THIRD = {
  income: "capital",
  realizesDisposal: true,
  acquisitionAtFmv: false
};
const TRANSFER_IN_THIRD = {
  income: "out_of_scope",
  realizesDisposal: false,
  acquisitionAtFmv: true
};
const REWARD = {
  income: "ordinary_income",
  realizesDisposal: false,
  acquisitionAtFmv: false
};
const SWAP = {
  income: "capital",
  realizesDisposal: true,
  acquisitionAtFmv: true
};
const POWER = {
  income: "non_taxable_transfer",
  realizesDisposal: false,
  acquisitionAtFmv: false
};
const SAVINGS_MOVE = {
  income: "non_taxable_transfer",
  realizesDisposal: false,
  acquisitionAtFmv: false
};
function baseCategoryRules() {
  return {
    reward_author: REWARD,
    reward_curation: REWARD,
    reward_benefactor: REWARD,
    reward_claim: REWARD,
    proposal_income: REWARD,
    savings_interest: REWARD,
    transfer_in: TRANSFER_IN_THIRD,
    transfer_out: TRANSFER_OUT_THIRD,
    swap: SWAP,
    market_fill: SWAP,
    power_up: POWER,
    power_down: POWER,
    savings_deposit: SAVINGS_MOVE,
    savings_withdraw: SAVINGS_MOVE
  };
}

// Decides whether a single consumed lot's gain is taxable, given the ruleset and
// the disposal context. Centralises the cross-jurisdiction divergence so the main
// loop stays readable. (Not tax advice — see each ruleset's caveats.)
//
// FR / AT / PT (swapRollover): the taxable event is a sale for money or a
// PAYMENT in crypto for goods and services — art. 150 VH bis I CGI ("tout
// service, bien ou avantage"), § 27b Abs. 3 Z 2 öEStG, art. 10 n.º 1 k) CIRS —
// not the exchange of one crypto for another. This function used to return
// false for every on-chain disposal there, so paying someone in PIXA was never
// taxed. Exchanges do not normally reach it at all: their cost carries over in
// the main loop; the one that does (PT, a lot already held 365 days) is exempt.
function lotIsTaxable(ruleset, ctx) {
  if (ctx.isProfessional) return true;                                 // pros: business income everywhere
  if (ruleset.swapRollover && ctx.isSwap) return false;               // FR/AT/PT: an exchange is not the taxable event
  if (!ruleset.capitalGainsTaxableForPrivate) return false;           // CH: private capital gains tax-free
  if (ctx.term === "long" && ruleset.longTermExempt) return false;    // DE: >1yr private holdings tax-free
  return true;                                                        // US / UK / DE-short: taxable
}

// Distinct outbound counterparties with their send volume and a suggested default
// intent — feeds the dialog's per-counterparty dropdowns and the CSV round-trip.
export function summarizeCounterparties(events, ownAccounts = []) {
  const map = new Map();
  for (const ev of events) {
    if (ev.category !== "transfer_out" || !ev.counterparty) continue;
    const e = map.get(ev.counterparty) || { counterparty: ev.counterparty, sends: 0, byAsset: {} };
    e.sends++;
    for (const leg of ev.legs.filter(l => l.direction === "out")) e.byAsset[leg.asset] = (e.byAsset[leg.asset] || 0) + leg.amount;
    map.set(ev.counterparty, e);
  }
  // Default suggestion is "payment" (taxable) — the user deducts on purpose.
  // The one exception is an account the user already declared as their own
  // (ingest cfg.ownAccounts → ev.counterpartyIsOwn, or the ownAccounts passed
  // here): suggesting "payment" there made the user re-declare it.
  // … and an exchange or bridge account the ingest config marks as the user's
  // own (cfg.externalAccounts[..].own → ev.selfTransfer across the boundary).
  const own = new Set(ownAccounts);
  const ownOffPlatform = new Set();
  for (const ev of events) {
    if (ev.category !== "transfer_out" || !ev.counterparty) continue;
    if (ev.counterpartyIsOwn === true) own.add(ev.counterparty);
    else if (ev.selfTransfer === true && ev.crossesBoundary === true) ownOffPlatform.add(ev.counterparty);
  }
  return [...map.values()]
      .sort((a, b) => b.sends - a.sends)
      .map(e => ({
        counterparty: e.counterparty, sends: e.sends, byAsset: e.byAsset,
        suggestedIntent: own.has(e.counterparty) ? "own" : ownOffPlatform.has(e.counterparty) ? "own_exchange" : "payment"
      }));
}

/**
 * Intent of an outbound transfer: the user's explicit label wins; otherwise a
 * send to an account the ingest marked as the user's own (cfg.ownAccounts) is
 * an internal move, and everything else is a taxable payment — the
 * conservative floor. Before, own-account sends were taxed as payments while
 * the matching inbound transfer was skipped as internal, so a round trip
 * between two of the user's accounts realised a phantom gain.
 */
/**
 * Intent of an inbound transfer (profile.inboundIntents[counterparty]):
 *   "own"      from one of the user's own accounts — an internal move, skipped
 *   "income"   tokens received as pay for work, as a team or project reward,
 *              or as an airdrop: income at market value on the day received
 *              (ESTV crypto working paper §2.2.2 — airdrops are income from
 *              movable assets at allocation; pay in tokens is employment or
 *              self-employment income), and that value becomes the cost
 *   "purchase" anything else: an acquisition at market value, no income (the
 *              default, as before)
 * Accounts the ingest marked as the user's own default to "own", as before.
 */
function inboundIntentOf(profile, ev) {
  const explicit = profile.inboundIntents && profile.inboundIntents[ev.counterparty];
  if (explicit) return explicit;
  return ev.counterpartyIsOwn === true ? "own" : "purchase";
}

// Distinct inbound counterparties with their volume and a suggested intent —
// the inbound twin of summarizeCounterparties, for the dialog's dropdowns.
export function summarizeInboundCounterparties(events, ownAccounts = []) {
  const own = new Set(ownAccounts);
  const map = new Map();
  for (const ev of events) {
    if (ev.category !== "transfer_in" || !ev.counterparty) continue;
    if (ev.counterpartyIsOwn === true) own.add(ev.counterparty);
    const e = map.get(ev.counterparty) || { counterparty: ev.counterparty, receipts: 0, byAsset: {} };
    e.receipts++;
    for (const leg of ev.legs.filter(l => l.direction === "in")) e.byAsset[leg.asset] = (e.byAsset[leg.asset] || 0) + leg.amount;
    map.set(ev.counterparty, e);
  }
  return [...map.values()]
      .sort((a, b) => b.receipts - a.receipts)
      .map(e => ({ ...e, suggestedIntent: own.has(e.counterparty) ? "own" : "purchase" }));
}

function intentOf(profile, ev) {
  const explicit = profile.counterpartyIntents && profile.counterpartyIntents[ev.counterparty];
  if (explicit) return explicit;
  if (ev.counterpartyIsOwn === true) return "own";
  // An exchange or bridge account the ingest config marks as the user's own:
  // the tokens leave the platform, not the user. The sale, if any, happens
  // there — this report hands over the cost that left (offPlatformBasis).
  if (ev.selfTransfer === true && ev.crossesBoundary === true) return "own_exchange";
  return "payment";
}

// Turns the raw taxable GAIN into the taxable AMOUNT a rate would be applied to,
// by applying the jurisdiction's structural reliefs in a transparent, ordered way:
// carried-forward losses → long-term discount → inclusion rate → annual exemption.
// Each step's running value is returned so the report can show the derivation.
// Statutory ordering is simplified — always confirm with an adviser.
//
// Where losses brought forward sit is per jurisdiction (ruleset.carriedLossOrder):
//   "first"             before every relief (the default);
//   "down_to_allowance" UK (HMRC CG21500): this year's losses net in full, even
//                       below the annual exempt amount, but losses brought
//                       forward only bring the net gain DOWN TO the exempt
//                       amount — what they don't need stays carried;
//   "after_allowance"   ZA (8th Schedule paras 6–9): the annual exclusion
//                       reduces the year's net result in either direction (a
//                       net loss shrinks by it too), and the assessed loss
//                       brought forward is set off only after it.
// Both used to consume carried losses down to zero first, wasting them.
//
// Two reliefs are thresholds, not deductions, and are tested on the year's own
// figures BEFORE any loss brought forward:
//   "freigrenze"         DE §23 Abs. 3 S. 5 EStG. Under the limit the year's gain
//                        is tax-free and the carried loss stays carried; at or
//                        over it the loss is deducted and what is left is taxed
//                        even if small (BFH 11.1.2005, IX R 27/04). The test ran
//                        AFTER the loss: a EUR 4,000 gain cut to EUR 500 by a
//                        carried loss came out tax-free, and a EUR 800 gain used
//                        up EUR 800 of carried loss for nothing. Gains from other
//                        private sales count toward the limit
//                        (profile.exemptionUsedFiat).
//   "proceeds_threshold" FR art. 150 VH bis II-B CGI. No tax when the PRICES of
//                        the year's disposals — not the gains — total EUR 305 or
//                        less; disposals elsewhere count
//                        (profile.exemptionUsedFiat). ctx.proceedsFiat carries
//                        this report's taxable disposal prices.
function applyDeductions(ruleset, profile, shortT, longT, ctx = {}) {
  const discountRate = ruleset.longTermDiscountRate || 0;
  const inclusionRate = ruleset.inclusionRate ?? 1;
  const exemption = ruleset.annualExemptionFiat || 0;
  const exemptionType = ruleset.annualExemptionType || "none";
  // Japan: miscellaneous-income losses die with the year — no carryforward in
  // or out. The step below makes the dying loss visible rather than silent.
  const carryAllowed = ruleset.lossCarryforward !== false;
  const priorLoss = carryAllowed ? Math.max(0, profile.lossCarryforwardFiat || 0) : 0;
  const exemptionUsed = Math.max(0, profile.exemptionUsedFiat || 0);
  const avail = Math.max(0, exemption - exemptionUsed);
  const lossOrder = ruleset.carriedLossOrder || "first";

  // Step labels are descriptors (see TEXT in the header); numbers stay numbers.
  const steps = [{ label: tk("components.pixa_tax_engine.taxable_gain"), value: round2(shortT + longT) }];
  let base = shortT + longT;
  let carryOut = 0, anyApplied = false;

  // Losses brought forward, applied to at most `cap` of the base; whatever
  // the cap leaves unused stays carried.
  const applyCarried = (cap) => {
    if (priorLoss <= 0) return;
    const applied = Math.min(priorLoss, Math.max(0, cap));
    carryOut += priorLoss - applied;
    if (applied > 0) {
      base -= applied; anyApplied = true;
      steps.push({ label: tk("components.pixa_tax_engine.after_losses_carried_forward"), value: round2(base) });
    }
  };

  // Annual allowance, extracted so jurisdictions can ORDER it: the default
  // (UK) applies it LAST, after discount and inclusion; SARS-style (ZA) sets
  // exemptionBeforeInclusion and applies it FIRST (annual exclusion → assessed
  // loss → inclusion rate). Freigrenze (DE) is a threshold, not a deduction —
  // it stays at the end regardless.
  const applyAllowance = () => {
    if (exemptionType !== "allowance" || base <= 0) return;
    base -= Math.min(avail, base); anyApplied = true;
    steps.push({ label: tk("components.pixa_tax_engine.after_annual_exemption"), value: round2(base) });
  };

  if (exemptionType === "freigrenze" && base > 0 && base + exemptionUsed < exemption) {
    base = 0; anyApplied = true;
    steps.push({ label: tk("components.pixa_tax_engine.within_exemption_threshold", { amount: round2(exemption) }), value: 0 });
  }
  if (exemptionType === "proceeds_threshold" && base > 0 && Number.isFinite(ctx.proceedsFiat)
      && ctx.proceedsFiat + exemptionUsed <= exemption) {
    base = 0; anyApplied = true;
    steps.push({ label: tk("components.pixa_tax_engine.disposals_within_price_threshold", { amount: round2(exemption) }), value: 0 });
  }

  if (lossOrder === "after_allowance") {
    if (exemptionType === "allowance" && base < 0 && avail > 0) {
      base = Math.min(0, base + avail); anyApplied = true;
      steps.push({ label: tk("components.pixa_tax_engine.net_loss_after_annual_exclusion"), value: round2(base) });
    } else applyAllowance();
    applyCarried(base);
  } else if (lossOrder === "down_to_allowance") {
    applyCarried(exemptionType === "allowance" ? base - avail : base);
  } else {
    applyCarried(base);
  }
  if (base < 0) {
    if (carryAllowed) carryOut += -base;
    else { steps.push({ label: tk("components.pixa_tax_engine.net_loss_not_carried_forward"), value: 0 }); anyApplied = true; }
    base = 0;
  }
  // US §1211(b): up to $3,000 ($1,500 married filing separately) of a net
  // capital loss reduces ordinary income this year; only the rest carries
  // (§1212(b) computes the carryover as if the deduction were taken).
  let ordinaryOffset = 0;
  if (ruleset.ordinaryLossOffsetFiat > 0 && carryOut > 0) {
    const cap = profile.filingStatus === "married_separate" ? ruleset.ordinaryLossOffsetFiat / 2 : ruleset.ordinaryLossOffsetFiat;
    ordinaryOffset = Math.min(cap, carryOut);
    carryOut -= ordinaryOffset;
  }

  if (ruleset.exemptionBeforeInclusion && lossOrder !== "after_allowance") applyAllowance();

  if (discountRate > 0 && longT > 0 && base > 0) {
    const longPortion = Math.min(base, Math.max(0, longT));
    base -= longPortion * discountRate; anyApplied = true;
    steps.push({ label: tk("components.pixa_tax_engine.after_long_term_discount", { pct: Math.round(discountRate * 100) }), value: round2(base) });
  }
  if (inclusionRate !== 1 && base > 0) {
    base *= inclusionRate; anyApplied = true;
    steps.push({ label: tk("components.pixa_tax_engine.after_inclusion_rate", { pct: Math.round(inclusionRate * 100) }), value: round2(base) });
  }
  if (!ruleset.exemptionBeforeInclusion) applyAllowance();
  // (The Freigrenze is tested above, before losses brought forward: tax-free
  // only when the year's gain is LESS THAN the limit — exactly EUR 1,000 is
  // fully taxable.)

  const taxableAmount = round2(Math.max(0, base));
  return {
    taxableAmountFiat: taxableAmount,
    lossCarryforwardOutFiat: round2(carryOut),
    ordinaryIncomeOffsetFiat: round2(ordinaryOffset),
    steps,
    anyApplied
  };
}

// ---------------------------------------------------------------------------
// HOLDING PERIODS  (calendar-exact; UTC days, like the rest of the engine)
// ---------------------------------------------------------------------------

const DAY_MS = 86400000;
const dayOfIso = (ts) => String(ts).slice(0, 10);
function addUtcDays(day, n) {
  return new Date(Date.parse(dayOfIso(day) + "T00:00:00.000Z") + n * DAY_MS).toISOString().slice(0, 10);
}
// Same day-of-month `months` later (UTC). JS rolls an overflow forward — a lot
// acquired 31 Aug plus 6 months lands on 3 Mar, never on the last day of
// February — which errs on the late (conservative) side for every test below.
function addUtcMonths(day, months) {
  const d = new Date(Date.parse(dayOfIso(day) + "T00:00:00.000Z"));
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate())).toISOString().slice(0, 10);
}

/**
 * First UTC day on which a disposal of a lot acquired at `acquiredTs` counts
 * as long-term, or null where the ruleset has no holding-period rule.
 *   "anniversary" (US, DE, AU): the day AFTER the first anniversary. US: held
 *     "more than 1 year" (IRC §1222); DE: taxable while "nicht mehr als ein
 *     Jahr" (§23 Abs. 1 Nr. 2 EStG); AU: 12 months excluding the days of
 *     acquisition and disposal. A sale ON the anniversary is short-term in all
 *     three — the old test (heldDays >= 365) called it long-term (tax-free in
 *     DE), and in leap-year spans it did so a day earlier still.
 *   "days" (PT): held for 365 days or more (art. 10 n.º 19 CIRS).
 */
function longTermFrom(ruleset, acquiredTs) {
  if (ruleset.longTermThresholdDays == null || !acquiredTs) return null;
  if (ruleset.longTermRule === "days") return addUtcDays(acquiredTs, ruleset.longTermThresholdDays);
  return addUtcDays(addUtcMonths(acquiredTs, 12), 1);
}
function termOf(ruleset, acquiredTs, disposalTs) {
  if (ruleset.longTermThresholdDays == null) return "n/a";
  const from = longTermFrom(ruleset, acquiredTs);
  return from && dayOfIso(disposalTs) >= from ? "long" : "short";
}

/** Switzerland: wealth tax on year-end holdings; income taxable; private gains tax-free. */
const CH_RULESET = {
  code: "CH",
  giftIsDisposal: false,
  name: tk("components.pixa_tax_engine.jurisdiction_private_investor", { country: tk("components.pixa_wallet_taxes_dialog.jur_ch") }),
  fiat: "CHF",
  version: "CH-2025.1-illustrative",
  reports: {
    wealth: {
      enabled: true,
      note: tk("components.pixa_tax_engine.ch_wealth_note")
    },
    transactions: {
      enabled: true,
      note: tk("components.pixa_tax_engine.ch_transactions_note")
    },
    operations: {
      enabled: true,
      note: tk("components.pixa_tax_engine.ch_operations_note")
    }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: ["fta_list", "platform_price", "cost_basis"],
  defaultDisposalMethod: "FIFO",
  capitalGainsTaxableForPrivate: false,
  longTermThresholdDays: null,
  longTermExempt: false,
  taxesCryptoToCrypto: true,
  taxableOnlyOnFiatOfframp: false,
  // Income timing: the ESTV working paper on crypto (14 Dec 2021, §1 and
  // §2.2.2 on staking) treats income as realised on receipt OR on acquiring a
  // firm legal claim, whichever comes first, valued at that moment. A Pixa
  // reward is a firm claim from its payout (claiming is a formality the user
  // controls), so CH books the payout vops — not the claim, as it did before.
  incomeTiming: "accrual",
  // PXP wealth-tax valuation discount (fraction of the PIXA price). 0 = PXP is
  // declared at the PIXA year-end price, which is what the ESTV documentation
  // supports today: utility tokens are taxed at market value, and it names no
  // lock-up discount for staked tokens. Set it (here, or per user as
  // profile.pxpWealthDiscount) ONLY on a written ruling from the cantonal tax
  // administration — the optimisation layer then tells users that powering up
  // before 31 December lowers the declared value; at 0 it says it does not.
  pxpWealthDiscount: 0,
  // Safe-harbour test for private investors (ESTV Circular No. 36, applied to
  // crypto by analogy — ESTV crypto working paper, fn. 7). Some cantons (e.g.
  // Thurgau) now list a one-year holding period instead of six months; both
  // shares are reported.
  safeHarbour: { holdMonths: 6, strictHoldMonths: 12, volumeMultiple: 5, gainsShareOfIncome: 0.5 }
};

/** United States: no wealth tax; gains & swaps taxable; short/long split at 1yr. */
const US_RULESET = {
  code: "US",
  giftIsDisposal: false,
  charityGiftExempt: true,
  name: tk("components.pixa_wallet_taxes_dialog.jur_us"),
  fiat: "USD",
  version: "US-2026.2-illustrative",
  reports: {
    wealth: {
      enabled: false,
      note: tk("components.pixa_tax_engine.us_wealth_note")
    },
    transactions: {
      enabled: true,
      note: tk("components.pixa_tax_engine.us_transactions_note")
    },
    operations: {
      enabled: true,
      note: tk("components.pixa_tax_engine.us_operations_note")
    }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: [],
  defaultDisposalMethod: "FIFO",
  // Income timing: US recognises reward income when the taxpayer gains dominion
  // and control (Rev. Rul. 2023-14) — for HIVE-style chains that is the CLAIM,
  // since unclaimed rewards cannot be transferred or staked.
  // Wallet tracking: Rev. Proc. 2024-28 requires wallet-by-wallet basis from
  // 2025. STANCE: one Pixagram account = one wallet; the liquid/savings/vesting
  // sub-balances are positions within it, not separate wallets, so single-key
  // lot pooling per (account, asset) satisfies the rule for on-platform assets.
  // AUDIT NOTE: the claim date is the weaker of the two readings. Rev. Rul.
  // 2023-14 includes rewards on "actual or constructive receipt", and a reward
  // that can be claimed at will is "made available" in the sense of Treas.
  // Reg. §1.451-2(a). The stance holds up while claims are prompt; rewards
  // left unclaimed over 31 December are the exposure. Kept as the default
  // because it is the user-facing convention, and surfaced by the optimisation
  // layer (claim_timing) instead of being relied on silently.
  incomeTiming: "claim",
  capitalGainsTaxableForPrivate: true,
  longTermThresholdDays: 365,
  longTermRule: "anniversary", // long-term = held MORE than one year (IRC §1222)
  longTermExempt: false,
  taxesCryptoToCrypto: true,
  taxableOnlyOnFiatOfframp: false,
  // H.R. 10357 (Digital Asset Tax Certainty Act): reported by Ways and Means on
  // 16 Sep 2026; not passed by either chamber when last checked (25 Nov 2026).
  // Its wash-sale rule would reach digital assets sold after 14 Sep 2026 —
  // backdated to the bill's introduction. "Watch" item only; current law is applied.
  pendingChange: "us_digital_asset_tax_bill_2026",
  // §1211(b): up to $3,000 of net capital loss offsets ordinary income each year.
  ordinaryLossOffsetFiat: 3000,
  // Specific identification is allowed if recorded no later than the sale
  // (Treas. Reg. §1.1012-1(j)) — the optimiser compares these methods.
  methodChoice: ["FIFO", "HIFO", "LIFO"]
};

/** Germany: no wealth tax; private sales (§23 EStG) taxable if held <1yr, tax-free if ≥1yr. */
const DE_RULESET = {
  code: "DE",
  giftIsDisposal: false,
  charityGiftExempt: true, // a donation is not a sale (§23 needs a disposal for consideration)
  annualExemptionFiat: 1000,
  annualExemptionHistory: [["2009-01-01", 600], ["2024-01-01", 1000]],
  annualExemptionType: "freigrenze",
  // §22 Nr. 3 S. 2 EStG: income from other services (passive staking rewards
  // among them, BMF 6 Mar 2025) is tax-free when it totals less than EUR 256 in
  // the calendar year — a threshold across ALL such income, not a deduction.
  incomeAllowance: { fiat: 256, type: "freigrenze", key: "de" },
  name: tk("components.pixa_tax_engine.jurisdiction_private_investor", { country: tk("components.pixa_wallet_taxes_dialog.jur_de") }),
  fiat: "EUR",
  version: "DE-2026.2-illustrative",
  reports: {
    wealth: {
      enabled: false,
      note: tk("components.pixa_tax_engine.de_wealth_note")
    },
    transactions: {
      enabled: true,
      note: tk("components.pixa_tax_engine.de_transactions_note")
    },
    operations: {
      enabled: true,
      note: tk("components.pixa_tax_engine.de_operations_note")
    }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: [],
  defaultDisposalMethod: "FIFO",
  // Income timing: German practice recognises reward income at INFLOW (Zufluss,
  // BMF guidance) — the moment the reward is credited, not when claimed. The
  // ingest layer reads this and books the accrual vop instead of the claim op.
  // (The BMF letter of 6 Mar 2025 also accepts valuing passive-staking rewards
  // at the claim, with everything unclaimed deemed received on 31 December. The
  // engine does not model that year-end fiction, so it stays on the payout.)
  incomeTiming: "accrual",
  capitalGainsTaxableForPrivate: true,
  longTermThresholdDays: 365,
  longTermRule: "anniversary", // taxable while held "nicht mehr als ein Jahr" (§23 Abs. 1 Nr. 2)
  longTermExempt: true,
  taxesCryptoToCrypto: true,
  taxableOnlyOnFiatOfframp: false,
  // BMF Referentenentwurf of 30 Sep 2026: crypto acquired from the cut-off
  // (1 Jan 2027 in the draft) taxed at 25% regardless of holding period;
  // earlier acquisitions keep §23. Not law — shown as a "watch" item only.
  // Status 25 Nov 2026: the cabinet did not adopt it on 14 Oct 2026.
  pendingChange: "de_crypto_reform_draft_2026"
};

/**
 * France: exchanging crypto for crypto is not taxed (sursis, art. 150 VH bis
 * II-A CGI); selling for money OR paying for goods and services is, on the
 * whole-portfolio formula of art. 150 VH bis III. Flat tax 31.4% on gains
 * realised from 2025 (12.8% + 18.6% social levies: the LFSS 2026 rise of the
 * CSG reaches back to 2025 income; 30% before), or the progressive scale on
 * option.
 */
const FR_RULESET = {
  code: "FR",
  giftIsDisposal: false,   // a gift is not a "cession à titre onéreux" — it still takes its share of the portfolio's cost
  charityGiftExempt: true, // same for a donation
  // Art. 150 VH bis II-B: no tax when the year's disposal PRICES total EUR 305 or less.
  annualExemptionFiat: 305,
  annualExemptionType: "proceeds_threshold",
  name: tk("components.pixa_tax_engine.jurisdiction_occasional_investor", { country: tk("components.pixa_wallet_taxes_dialog.jur_fr") }),
  fiat: "EUR",
  version: "FR-2026.2-illustrative",
  methodLocked: true, // the portfolio formula is the statute — profile method preferences do not apply
  reports: {
    wealth: {
      enabled: false,
      note: tk("components.pixa_tax_engine.fr_wealth_note")
    },
    transactions: {
      enabled: true,
      note: tk("components.pixa_tax_engine.fr_transactions_note")
    },
    operations: {
      enabled: true,
      note: tk("components.pixa_tax_engine.fr_operations_note")
    }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: [],
  defaultDisposalMethod: "PORTFOLIO",
  // Rewards. impots.gouv.fr states that mining and staking income is taxed as
  // BNC: on receipt, at that day's value, which then counts as acquisition
  // price. The engine deferred it at zero cost (rewardBasis "zero") — against
  // the administration's published position, so the default is now income on
  // receipt. BNC receipts count when put at the taxpayer's disposal: a reward
  // that can be claimed at will is, so the payout is booked, not the claim.
  incomeTiming: "accrual",
  // Micro-BNC (art. 102 ter CGI): a flat 34% allowance on the receipts, at
  // least EUR 305 — used by the optimisation layer, no reported figure changes.
  incomeAllowance: { rate: 0.34, minFiat: 305, type: "rate", key: "fr" },
  capitalGainsTaxableForPrivate: true, // on sales for money and payments in crypto — see lotIsTaxable
  longTermThresholdDays: null,
  longTermExempt: false,
  taxesCryptoToCrypto: false,
  swapRollover: true,                  // art. 150 VH bis II-A: échange sans soulte, sursis d'imposition
  taxableOnlyOnFiatOfframp: true,      // wording flag for the optimisation layer
  lossCarryforward: false,             // a year's losses offset that year's gains only
  assumptionNote: tk("components.pixa_tax_engine.fr_assumption_note")
};

/** United Kingdom: no wealth tax; CGT on disposals using section-104 pooled cost. */
const UK_RULESET = {
  code: "UK",
  charityGiftExempt: true,
  annualExemptionFiat: 3000,
  annualExemptionHistory: [["2020-04-06", 12300], ["2023-04-06", 6000], ["2024-04-06", 3000]],
  annualExemptionType: "allowance",
  taxYearStart: [4, 6], // 6 April – 5 April
  // Trading and miscellaneous income allowance: GBP 1,000 a tax year across all
  // such income (staking and other rewards outside a trade are miscellaneous
  // income, HMRC CRYPTO21200). GBP 3,000 from 6 April 2027 was announced at the
  // Budget of 28 Oct 2026 and is not yet law.
  incomeAllowance: { fiat: 1000, type: "allowance", key: "uk" },
  // Draft Finance Bill 2026-27 clauses (13 Jul 2026), from 6 April 2027: no
  // gain / no loss for qualifying crypto lending and liquidity pools, a
  // separate regime for stablecoins. "Watch" item only.
  pendingChange: "uk_changes_april_2027",
  name: tk("components.pixa_wallet_taxes_dialog.jur_uk"),
  fiat: "GBP",
  version: "UK-2026.2-illustrative",
  methodLocked: true, // pooling is mandatory — profile method preferences do not apply
  reports: {
    wealth: {
      enabled: false,
      note: tk("components.pixa_tax_engine.no_wealth_tax_report_omitted")
    },
    transactions: {
      enabled: true,
      note: tk("components.pixa_tax_engine.uk_transactions_note")
    },
    operations: {
      enabled: true,
      note: tk("components.pixa_tax_engine.uk_operations_note")
    }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: [],
  defaultDisposalMethod: "POOL",
  matchingRules: "uk_sameday_30day",
  carriedLossOrder: "down_to_allowance", // HMRC CG21500 — see applyDeductions
  capitalGainsTaxableForPrivate: true,
  longTermThresholdDays: null,
  longTermExempt: false,
  taxesCryptoToCrypto: true,
  taxableOnlyOnFiatOfframp: false
};

/**
 * Austria (§ 27b EStG): 27.5% on realised gains — sale for euro or foreign
 * currency, and exchange for goods or services (paying in crypto). Crypto-to-
 * crypto is not a realisation: the acquisition cost carries over. Staking
 * rewards, airdrops and bounties enter at zero cost and are taxed on realisation;
 * lending fees and mining are current income on receipt.
 */
const AT_RULESET = {
  code: "AT",
  giftIsDisposal: false,
  charityGiftExempt: true, // a transfer without consideration is not a realisation
  name: tk("components.pixa_wallet_taxes_dialog.jur_at"),
  fiat: "EUR",
  version: "AT-2026.2-illustrative",
  methodLocked: true, // KryptowährungsVO § 2: moving-average cost per address is mandatory since 2023
  reports: {
    wealth: { enabled: false, note: tk("components.pixa_tax_engine.no_wealth_tax_report_omitted") },
    transactions: {
      enabled: true,
      note: tk("components.pixa_tax_engine.at_transactions_note")
    },
    operations: { enabled: true, note: tk("components.pixa_tax_engine.at_operations_note") }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: [],
  defaultDisposalMethod: "POOL", // gleitender Durchschnittspreis (was FIFO, which Austria does not use)
  rewardBasis: "zero",
  capitalGainsTaxableForPrivate: true,
  longTermThresholdDays: null,
  longTermExempt: false,
  taxesCryptoToCrypto: false,
  swapRollover: true,             // § 27b Abs. 3 Z 2: the acquisition cost carries over to the crypto received
  taxableOnlyOnFiatOfframp: true, // wording flag for the optimisation layer
  lossCarryforward: false         // private capital losses offset the same year's capital income only
};

/** Netherlands: Box 3 deemed-return wealth tax on holdings; realised gains not taxed. */
const NL_RULESET = {
  code: "NL",
  giftIsDisposal: false,
  name: tk("components.pixa_wallet_taxes_dialog.jur_nl"),
  fiat: "EUR",
  version: "NL-2026.2-illustrative",
  reports: {
    wealth: {
      enabled: true,
      note: tk("components.pixa_tax_engine.nl_wealth_note")
    },
    transactions: {
      enabled: true,
      note: tk("components.pixa_tax_engine.nl_transactions_note")
    },
    operations: { enabled: true, note: tk("components.pixa_tax_engine.nl_operations_note") }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: ["platform_price", "cost_basis"],
  wealthSnapshotAt: "year_start",
  // Box 3 taxes a deemed return on the holdings; rewards are not taxed
  // separately unless the activity is Box 1 "overige werkzaamheden". Used by
  // the optimisation layer only (the operations report still lists them).
  rewardIncomeTaxed: false,
  // Deemed return on "other assets" (crypto included), per the Belastingdienst.
  // A taxpayer whose ACTUAL return — unrealised value changes included — is
  // lower can be taxed on that instead (Wet tegenbewijsregeling box 3).
  deemedReturn: { 2024: 0.0604, 2025: 0.0588, 2026: 0.06 },
  // Wet werkelijk rendement box 3: passed by the Tweede Kamer on 12 Feb 2026,
  // aimed at 1 January 2028. "Watch" item only.
  pendingChange: "nl_box3_actual_return_2028",
  defaultDisposalMethod: "FIFO",
  capitalGainsTaxableForPrivate: false,
  longTermThresholdDays: null,
  longTermExempt: false,
  taxesCryptoToCrypto: true,
  taxableOnlyOnFiatOfframp: false
};

/** Spain: gains taxed as savings income; crypto-to-crypto taxable; FIFO mandated. */
const ES_RULESET = {
  code: "ES",
  name: tk("components.pixa_wallet_taxes_dialog.jur_es"),
  fiat: "EUR",
  version: "ES-2025.1-illustrative",
  methodLocked: true, // FIFO is mandatory — profile method preferences do not apply
  reports: {
    wealth: { enabled: false, note: tk("components.pixa_tax_engine.es_wealth_note") },
    transactions: {
      enabled: true,
      note: tk("components.pixa_tax_engine.es_transactions_note")
    },
    operations: { enabled: true, note: tk("components.pixa_tax_engine.es_operations_note") }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: [],
  defaultDisposalMethod: "FIFO",
  capitalGainsTaxableForPrivate: true,
  longTermThresholdDays: null,
  longTermExempt: false,
  taxesCryptoToCrypto: true,
  taxableOnlyOnFiatOfframp: false
};

/**
 * Portugal: gains on holdings under 365 days taxed at 28% when sold for money
 * or spent; holdings of 365 days or more are excluded (art. 10 n.º 19 CIRS).
 * Crypto received for crypto is not taxed and takes over the acquisition value
 * of what was given (n.º 20); income paid in crypto is taxed only when that
 * crypto is disposed of (art. 5 n.º 11). These reliefs need a counterparty in
 * the EU/EEA or a treaty / information-exchange state (art. 10 n.º 21) — the
 * engine cannot see that and assumes it (assumptionNote).
 */
const PT_RULESET = {
  code: "PT",
  giftIsDisposal: false,   // gratuitous transfers: stamp duty on the recipient, not a category-G gain
  charityGiftExempt: true,
  name: tk("components.pixa_wallet_taxes_dialog.jur_pt"),
  fiat: "EUR",
  version: "PT-2026.2-illustrative",
  methodLocked: true, // art. 43 n.º 6 g) CIRS: first in, first out — profile method preferences do not apply
  reports: {
    wealth: { enabled: false, note: tk("components.pixa_tax_engine.no_wealth_tax_report_omitted") },
    transactions: {
      enabled: true,
      note: tk("components.pixa_tax_engine.pt_transactions_note")
    },
    operations: { enabled: true, note: tk("components.pixa_tax_engine.pt_operations_note") }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: [],
  defaultDisposalMethod: "FIFO",
  // Art. 5 n.º 11 CIRS: income paid in crypto is not taxed on receipt; it is
  // taxed as a gain when that crypto is disposed of. Rewards therefore enter
  // at zero cost (they were taxed on receipt here — tax the law defers).
  rewardBasis: "zero",
  capitalGainsTaxableForPrivate: true,
  longTermThresholdDays: 365,
  longTermRule: "days", // "período igual ou superior a 365 dias" (art. 10 n.º 19 CIRS)
  longTermExempt: true,
  taxesCryptoToCrypto: false,
  // Art. 10 n.º 20 CIRS: no tax on a crypto-for-crypto exchange; the crypto
  // received takes the acquisition value of the crypto given. (A lot already
  // held 365 days is disposed of tax-free instead — n.º 19 — and what it buys
  // starts afresh at market value.)
  swapRollover: true,
  // The statute carries the VALUE over and is silent on the DATE. The tax
  // authority has looked through an immediate conversion into a stablecoin
  // (binding ruling 28969 of 31 Oct 2025); commentators read the exchange as a
  // new acquisition. The conservative reading is used: the 365 days restart.
  rolloverKeepsDate: false,
  taxableOnlyOnFiatOfframp: false,
  assumptionNote: tk("components.pixa_tax_engine.pt_assumption_note")
};

/** Canada: 50% inclusion rate; crypto-to-crypto a disposal; adjusted-cost-base (average). */
const CA_RULESET = {
  code: "CA",
  inclusionRate: 0.5,
  name: tk("components.pixa_wallet_taxes_dialog.jur_ca"),
  fiat: "CAD",
  version: "CA-2025.1-illustrative",
  methodLocked: true, // ACB is mandatory — profile method preferences do not apply
  reports: {
    wealth: { enabled: false, note: tk("components.pixa_tax_engine.no_wealth_tax_report_omitted") },
    transactions: {
      enabled: true,
      note: tk("components.pixa_tax_engine.ca_transactions_note")
    },
    operations: { enabled: true, note: tk("components.pixa_tax_engine.ca_operations_note") }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: [],
  defaultDisposalMethod: "POOL",
  capitalGainsTaxableForPrivate: true,
  longTermThresholdDays: null,
  longTermExempt: false,
  taxesCryptoToCrypto: true,
  taxableOnlyOnFiatOfframp: false
};

/** Australia: CGT on disposals incl. crypto-to-crypto; 50% discount for >12-month holdings. */
const AU_RULESET = {
  code: "AU",
  longTermDiscountRate: 0.5,
  // No charityGiftExempt: the ATO treats donating crypto as a CGT event like
  // any other disposal (the gift to a deductible gift recipient may earn a
  // separate deduction). It was flagged exempt here, which dropped the gain.
  taxYearStart: [7, 1], // 1 July – 30 June
  name: tk("components.pixa_wallet_taxes_dialog.jur_au"),
  fiat: "AUD",
  version: "AU-2026.2-illustrative",
  reports: {
    wealth: { enabled: false, note: tk("components.pixa_tax_engine.no_wealth_tax_report_omitted") },
    transactions: {
      enabled: true,
      note: tk("components.pixa_tax_engine.au_transactions_note")
    },
    operations: { enabled: true, note: tk("components.pixa_tax_engine.au_operations_note") }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: [],
  defaultDisposalMethod: "FIFO",
  capitalGainsTaxableForPrivate: true,
  longTermThresholdDays: 365,
  longTermRule: "anniversary", // 12 months excluding the days of acquisition and disposal (ATO)
  longTermExempt: false,
  taxesCryptoToCrypto: true,
  taxableOnlyOnFiatOfframp: false,
  // The ATO accepts identifying which units were sold when records show it.
  methodChoice: ["FIFO", "HIFO", "LIFO"]
};

/** Japan: crypto gains & rewards are miscellaneous income (雑所得) at progressive rates; total-average cost basis; losses die with the year. */
const JP_RULESET = {
  code: "JP",
  name: tk("components.pixa_wallet_taxes_dialog.jur_jp"),
  fiat: "JPY",
  version: "JP-2026.2-illustrative",
  reports: {
    wealth: { enabled: false, note: tk("components.pixa_tax_engine.jp_wealth_note") },
    transactions: {
      enabled: true,
      note: tk("components.pixa_tax_engine.jp_transactions_note")
    },
    operations: { enabled: true, note: tk("components.pixa_tax_engine.jp_operations_note") }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: [],
  defaultDisposalMethod: "TOTAL_AVG",
  methodLocked: true,
  // FY2026 tax reform: 20.315% separate taxation with a three-year loss
  // carry-forward for "specified crypto assets", from 1 January of the year
  // after the amended Financial Instruments and Exchange Act takes effect
  // (passed 15 Jul 2026; 2028 expected). A token no registered operator lists
  // would stay miscellaneous income. "Watch" item only.
  pendingChange: "jp_separate_taxation_2028",
  lossCarryforward: false,
  incomeTiming: "claim",
  capitalGainsTaxableForPrivate: true,
  longTermThresholdDays: null,
  longTermExempt: false,
  taxesCryptoToCrypto: true,
  taxableOnlyOnFiatOfframp: false
};

/** Brazil: Pixagram holdings treated as FOREIGN-held — Law 14.754/2023 flat 15% regime; DIRPF declares holdings at acquisition cost. */
const BR_RULESET = {
  code: "BR",
  name: tk("components.pixa_wallet_taxes_dialog.jur_br"),
  fiat: "BRL",
  version: "BR-2026.1-illustrative",
  reports: {
    wealth: {
      enabled: true,
      note: tk("components.pixa_tax_engine.br_wealth_note")
    },
    transactions: {
      enabled: true,
      note: tk("components.pixa_tax_engine.br_transactions_note")
    },
    operations: { enabled: true, note: tk("components.pixa_tax_engine.br_operations_note") }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: ["cost_basis"],
  defaultDisposalMethod: "POOL",
  methodLocked: true,
  incomeTiming: "claim",
  capitalGainsTaxableForPrivate: true,
  longTermThresholdDays: null,
  longTermExempt: false,
  taxesCryptoToCrypto: true,
  taxableOnlyOnFiatOfframp: false,
  assumptionNote: tk("components.pixa_tax_engine.br_assumption_note")
};

/**
 * South Korea: virtual-asset gains tax not yet in force — nothing taxable for
 * individuals in 2026; this report is the cost-basis record for the transition.
 * The start date in the Income Tax Act is still 1 Jan 2027; on 5 Nov 2026 the
 * government announced a further two-year deferral to 2029 (with a three-year
 * loss carry-forward), which the National Assembly has yet to pass.
 */
const KR_RULESET = {
  code: "KR",
  pendingChange: "kr_deferral_2029",
  name: tk("components.pixa_wallet_taxes_dialog.jur_kr"),
  fiat: "KRW",
  version: "KR-2026.2-illustrative",
  reports: {
    wealth: { enabled: false, note: tk("components.pixa_tax_engine.no_wealth_tax_report_omitted") },
    transactions: {
      enabled: true,
      note: tk("components.pixa_tax_engine.kr_transactions_note")
    },
    operations: { enabled: true, note: tk("components.pixa_tax_engine.kr_operations_note") }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: [],
  defaultDisposalMethod: "FIFO",
  rewardBasis: "zero",
  incomeTiming: "claim",
  capitalGainsTaxableForPrivate: false,
  longTermThresholdDays: null,
  longTermExempt: false,
  taxesCryptoToCrypto: false,
  taxableOnlyOnFiatOfframp: false
};

/** India: flat 30% (+4% cess) on VDA transfers under §115BBH — losses disregarded entirely; 1% TDS trail under §194S; rewards at slab rates on receipt. */
const IN_RULESET = {
  code: "IN",
  taxYearStart: [4, 1], // 1 April – 31 March
  name: tk("components.pixa_wallet_taxes_dialog.jur_in"),
  fiat: "INR",
  version: "IN-2026.1-illustrative",
  reports: {
    wealth: { enabled: false, note: tk("components.pixa_tax_engine.no_wealth_tax_report_omitted") },
    transactions: {
      enabled: true,
      note: tk("components.pixa_tax_engine.in_transactions_note")
    },
    operations: { enabled: true, note: tk("components.pixa_tax_engine.in_operations_note") }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: [],
  defaultDisposalMethod: "FIFO",
  lossOffset: "none",
  lossCarryforward: false,
  incomeTiming: "claim",
  capitalGainsTaxableForPrivate: true,
  longTermThresholdDays: null,
  longTermExempt: false,
  taxesCryptoToCrypto: true,
  taxableOnlyOnFiatOfframp: false
};

/** Singapore: no capital gains tax for individuals — disposals are records unless the activity amounts to a trade; reward taxability is fact-specific. */
const SG_RULESET = {
  code: "SG",
  name: tk("components.pixa_wallet_taxes_dialog.jur_sg"),
  rewardIncomeTaxed: false, // fact-specific for individuals — the optimiser makes no income claim
  fiat: "SGD",
  version: "SG-2026.1-illustrative",
  reports: {
    wealth: { enabled: false, note: tk("components.pixa_tax_engine.sg_wealth_note") },
    transactions: {
      enabled: true,
      note: tk("components.pixa_tax_engine.sg_transactions_note")
    },
    operations: { enabled: true, note: tk("components.pixa_tax_engine.sg_operations_note") }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: [],
  defaultDisposalMethod: "FIFO",
  incomeTiming: "claim",
  capitalGainsTaxableForPrivate: false,
  longTermThresholdDays: null,
  longTermExempt: false,
  taxesCryptoToCrypto: false,
  taxableOnlyOnFiatOfframp: false
};

/** United Arab Emirates: no personal income tax — individuals' gains and rewards are untaxed; the 9% Corporate Tax only reaches business-level activity. */
const AE_RULESET = {
  code: "AE",
  name: tk("components.pixa_wallet_taxes_dialog.jur_ae"),
  rewardIncomeTaxed: false, // no personal income tax
  fiat: "AED",
  version: "AE-2026.1-illustrative",
  reports: {
    wealth: { enabled: false, note: tk("components.pixa_tax_engine.no_wealth_tax_report_omitted") },
    transactions: {
      enabled: true,
      note: tk("components.pixa_tax_engine.ae_transactions_note")
    },
    operations: { enabled: true, note: tk("components.pixa_tax_engine.ae_operations_note") }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: [],
  defaultDisposalMethod: "FIFO",
  incomeTiming: "claim",
  capitalGainsTaxableForPrivate: false,
  longTermThresholdDays: null,
  longTermExempt: false,
  taxesCryptoToCrypto: false,
  taxableOnlyOnFiatOfframp: false
};

/** Hong Kong: no capital gains tax — capital-nature gains are not chargeable; profits tax reaches only a trade or business of dealing (DIPN 39, badges of trade). */
const HK_RULESET = {
  code: "HK",
  taxYearStart: [4, 1], // 1 April – 31 March
  name: tk("components.pixa_wallet_taxes_dialog.jur_hk"),
  rewardIncomeTaxed: false, // not chargeable for individuals outside a trade (DIPN 39)
  fiat: "HKD",
  version: "HK-2026.1-illustrative",
  reports: {
    wealth: { enabled: false, note: tk("components.pixa_tax_engine.no_wealth_tax_report_omitted") },
    transactions: {
      enabled: true,
      note: tk("components.pixa_tax_engine.hk_transactions_note")
    },
    operations: { enabled: true, note: tk("components.pixa_tax_engine.hk_operations_note") }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: [],
  defaultDisposalMethod: "FIFO",
  incomeTiming: "claim",
  capitalGainsTaxableForPrivate: false,
  longTermThresholdDays: null,
  longTermExempt: false,
  taxesCryptoToCrypto: false,
  taxableOnlyOnFiatOfframp: false
};

/** New Zealand: no general CGT, but IRD presumes cryptoassets are acquired FOR DISPOSAL — sale proceeds are taxable INCOME; rewards taxable on receipt; April–March tax year. */
const NZ_RULESET = {
  code: "NZ",
  taxYearStart: [4, 1], // 1 April – 31 March
  name: tk("components.pixa_wallet_taxes_dialog.jur_nz"),
  fiat: "NZD",
  version: "NZ-2026.1-illustrative",
  reports: {
    wealth: { enabled: false, note: tk("components.pixa_tax_engine.no_wealth_tax_report_omitted") },
    transactions: {
      enabled: true,
      note: tk("components.pixa_tax_engine.nz_transactions_note")
    },
    operations: { enabled: true, note: tk("components.pixa_tax_engine.nz_operations_note") }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: [],
  defaultDisposalMethod: "FIFO",
  incomeTiming: "claim",
  capitalGainsTaxableForPrivate: true,
  longTermThresholdDays: null,
  longTermExempt: false,
  taxesCryptoToCrypto: true,
  taxableOnlyOnFiatOfframp: false
};

/** South Africa: CGT for capital-nature holdings — annual exclusion applied BEFORE the 40% inclusion rate (SARS ordering); trading taxed in full; March–February tax year. */
const ZA_RULESET = {
  code: "ZA",
  inclusionRate: 0.4,
  // Annual exclusion: R40,000 until the 2025/26 year of assessment, R50,000
  // from 1 March 2026 (Budget 2026). The amount in force on the period's last
  // day is used (exemptionOn).
  annualExemptionFiat: 50000,
  annualExemptionHistory: [["2016-03-01", 40000], ["2026-03-01", 50000]],
  annualExemptionType: "allowance",
  taxYearStart: [3, 1], // 1 March – end of February
  exemptionBeforeInclusion: true, // SARS ordering: annual exclusion → assessed loss b/f → 40% inclusion
  carriedLossOrder: "after_allowance", // 8th Schedule paras 6–9 — see applyDeductions
  name: tk("components.pixa_wallet_taxes_dialog.jur_za"),
  fiat: "ZAR",
  version: "ZA-2026.2-illustrative",
  reports: {
    wealth: {
      enabled: true,
      note: tk("components.pixa_tax_engine.za_wealth_note")
    },
    transactions: {
      enabled: true,
      note: tk("components.pixa_tax_engine.za_transactions_note")
    },
    operations: { enabled: true, note: tk("components.pixa_tax_engine.za_operations_note") }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: ["cost_basis"],
  defaultDisposalMethod: "FIFO", // SARS default; specific identification needs full lot records
  incomeTiming: "claim",
  capitalGainsTaxableForPrivate: true,
  longTermThresholdDays: null,
  longTermExempt: false,
  taxesCryptoToCrypto: true,
  taxableOnlyOnFiatOfframp: false
};

/** Mexico: no dedicated crypto regime — disposals fall under the general LISR 'enajenación de bienes' rules at progressive rates; swaps (permuta) are disposals. */
const MX_RULESET = {
  code: "MX",
  name: tk("components.pixa_wallet_taxes_dialog.jur_mx"),
  fiat: "MXN",
  version: "MX-2026.1-illustrative",
  reports: {
    wealth: { enabled: false, note: tk("components.pixa_tax_engine.no_wealth_tax_report_omitted") },
    transactions: {
      enabled: true,
      note: tk("components.pixa_tax_engine.mx_transactions_note")
    },
    operations: { enabled: true, note: tk("components.pixa_tax_engine.mx_operations_note") }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: [],
  defaultDisposalMethod: "FIFO",
  incomeTiming: "claim",
  capitalGainsTaxableForPrivate: true,
  longTermThresholdDays: null,
  longTermExempt: false,
  taxesCryptoToCrypto: true,
  taxableOnlyOnFiatOfframp: false
};

/** Argentina: flat 15% on digital-currency gains (foreign-source reading for Pixagram holdings); Bienes Personales declares holdings at ACQUISITION COST; oldest-first costing mandated. */
const AR_RULESET = {
  code: "AR",
  name: tk("components.pixa_wallet_taxes_dialog.jur_ar"),
  fiat: "ARS",
  version: "AR-2026.1-illustrative",
  methodLocked: true, // the LIG regulatory decree mandates oldest-first costing for digital currencies — FIFO is enforced
  reports: {
    wealth: {
      enabled: true,
      note: tk("components.pixa_tax_engine.ar_wealth_note")
    },
    transactions: {
      enabled: true,
      note: tk("components.pixa_tax_engine.ar_transactions_note")
    },
    operations: { enabled: true, note: tk("components.pixa_tax_engine.ar_operations_note") }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: ["cost_basis"],
  defaultDisposalMethod: "FIFO",
  incomeTiming: "claim",
  capitalGainsTaxableForPrivate: true,
  longTermThresholdDays: null,
  longTermExempt: false,
  taxesCryptoToCrypto: true,
  taxableOnlyOnFiatOfframp: false,
  assumptionNote: tk("components.pixa_tax_engine.ar_assumption_note")
};

/** Thailand: the 2025–2029 exemption covers ONLY Thai SEC-licensed operators — foreign-platform gains stay taxable at progressive rates; losses here don't offset; remittance timing applies. */
const TH_RULESET = {
  code: "TH",
  name: tk("components.pixa_wallet_taxes_dialog.jur_th"),
  fiat: "THB",
  version: "TH-2026.1-illustrative",
  reports: {
    wealth: { enabled: false, note: tk("components.pixa_tax_engine.th_wealth_note") },
    transactions: {
      enabled: true,
      note: tk("components.pixa_tax_engine.th_transactions_note")
    },
    operations: { enabled: true, note: tk("components.pixa_tax_engine.th_operations_note") }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: [],
  defaultDisposalMethod: "FIFO",
  lossOffset: "none", // offsetting is reserved for SEC-licensed exchange trades — not available here
  lossCarryforward: false,
  incomeTiming: "claim",
  capitalGainsTaxableForPrivate: true,
  longTermThresholdDays: null,
  longTermExempt: false,
  taxesCryptoToCrypto: true,
  taxableOnlyOnFiatOfframp: false
};

/** Israel: crypto = asset (Circular 05/2018) — 25% CGT on the real gain for individuals; crypto-to-crypto taxable; surtaxes for high incomes; business dealing at marginal rates. */
const IL_RULESET = {
  code: "IL",
  name: tk("components.pixa_wallet_taxes_dialog.jur_il"),
  fiat: "ILS",
  version: "IL-2026.1-illustrative",
  reports: {
    wealth: { enabled: false, note: tk("components.pixa_tax_engine.no_wealth_tax_report_omitted") },
    transactions: {
      enabled: true,
      note: tk("components.pixa_tax_engine.il_transactions_note")
    },
    operations: { enabled: true, note: tk("components.pixa_tax_engine.il_operations_note") }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: [],
  defaultDisposalMethod: "FIFO",
  incomeTiming: "claim",
  capitalGainsTaxableForPrivate: true,
  longTermThresholdDays: null,
  longTermExempt: false,
  taxesCryptoToCrypto: true,
  taxableOnlyOnFiatOfframp: false
};

/** Indonesia: PMK 50/2025 final tax on GROSS transaction value — 1% via foreign platforms (self-assessed), 0.21% domestic; gain figures are records; SPT asset list at cost. */
const ID_RULESET = {
  code: "ID",
  name: tk("components.pixa_wallet_taxes_dialog.jur_id"),
  fiat: "IDR",
  version: "ID-2026.1-illustrative",
  reports: {
    wealth: {
      enabled: true,
      note: tk("components.pixa_tax_engine.id_wealth_note")
    },
    transactions: {
      enabled: true,
      note: tk("components.pixa_tax_engine.id_transactions_note")
    },
    operations: { enabled: true, note: tk("components.pixa_tax_engine.id_operations_note") }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: ["cost_basis"],
  defaultDisposalMethod: "FIFO",
  incomeTiming: "claim",
  capitalGainsTaxableForPrivate: false, // no gains tax — the final levy is a % of GROSS value (see annex)
  longTermThresholdDays: null,
  longTermExempt: false,
  taxesCryptoToCrypto: true, // swaps are inside the final-tax net (still levied on gross value)
  taxableOnlyOnFiatOfframp: false
};

/** Nigeria: NTA 2025 (from 1 Jan 2026) — digital/virtual assets are chargeable assets; individuals' gains taxed at progressive PIT rates on a worldwide basis. */
const NG_RULESET = {
  code: "NG",
  name: tk("components.pixa_wallet_taxes_dialog.jur_ng"),
  fiat: "NGN",
  version: "NG-2026.1-illustrative",
  reports: {
    wealth: { enabled: false, note: tk("components.pixa_tax_engine.no_wealth_tax_report_omitted") },
    transactions: {
      enabled: true,
      note: tk("components.pixa_tax_engine.ng_transactions_note")
    },
    operations: { enabled: true, note: tk("components.pixa_tax_engine.ng_operations_note") }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: [],
  defaultDisposalMethod: "FIFO",
  incomeTiming: "claim",
  capitalGainsTaxableForPrivate: true,
  longTermThresholdDays: null,
  longTermExempt: false,
  taxesCryptoToCrypto: true,
  taxableOnlyOnFiatOfframp: false
};

const RULESETS = {
  CH: CH_RULESET,
  US: US_RULESET,
  DE: DE_RULESET,
  FR: FR_RULESET,
  UK: UK_RULESET,
  AT: AT_RULESET,
  NL: NL_RULESET,
  ES: ES_RULESET,
  PT: PT_RULESET,
  CA: CA_RULESET,
  AU: AU_RULESET,
  JP: JP_RULESET,
  BR: BR_RULESET,
  KR: KR_RULESET,
  IN: IN_RULESET,
  SG: SG_RULESET,
  AE: AE_RULESET,
  HK: HK_RULESET,
  NZ: NZ_RULESET,
  ZA: ZA_RULESET,
  MX: MX_RULESET,
  AR: AR_RULESET,
  TH: TH_RULESET,
  IL: IL_RULESET,
  ID: ID_RULESET,
  NG: NG_RULESET
};

/**
 * Jurisdiction's default income-recognition timing for reward vops.
 * "claim"   — income when the user claims (US dominion-and-control reading).
 * "accrual" — income when the reward is credited (DE Zufluss reading).
 * Jurisdictions without a declared stance default to "claim" (the conservative,
 * user-action-anchored moment, and the ingest layer's historical default).
 * The dialog should pass this into the ingest config as cfg.incomeRecognition
 * BEFORE fetching, since the two timings keep different vops.
 */
export function incomeTimingFor(jurisdiction) {
  const rs = RULESETS[jurisdiction];
  return (rs && rs.incomeTiming) || "claim";
}

/**
 * The statutory tax year that STARTS in calendar year `year`, as an inclusive
 * UTC window: UK 6 April – 5 April, AU 1 July – 30 June, ZA 1 March – end of
 * February, IN / NZ / HK 1 April – 31 March; the calendar year elsewhere. Annual
 * allowances, loss rules and the "still time to act" levers all run on this
 * window, not on the calendar year buildAllReports() defaults to. The dialog
 * should preset its date pickers from it; { statutoryYear: true } in opts makes
 * buildAllReports() use it when no period is passed.
 */
export function statutoryPeriodFor(jurisdiction, year) {
  const rs = RULESETS[jurisdiction];
  const s = rs && rs.taxYearStart;
  if (!s) return { start: `${year}-01-01T00:00:00.000Z`, end: `${year}-12-31T23:59:59.999Z`, calendar: true };
  return {
    start: new Date(Date.UTC(year, s[0] - 1, s[1])).toISOString(),
    end: new Date(Date.UTC(year + 1, s[0] - 1, s[1]) - 1).toISOString(),
    calendar: false
  };
}

// A statutory amount that changed over time: annualExemptionHistory lists
// [first day it applies, amount], oldest first, and the amount in force on
// `day` (the period's last day) wins. Before the first entry, or without a
// history, the ruleset's current annualExemptionFiat is used.
function exemptionOn(ruleset, day) {
  let amount = ruleset.annualExemptionFiat || 0;
  for (const [from, v] of ruleset.annualExemptionHistory || []) {
    if (day < from) break;
    amount = v;
  }
  return amount;
}

// ---------------------------------------------------------------------------
// EXCHANGES — one value for both sides
// ---------------------------------------------------------------------------

/**
 * Fiat value of each leg of an exchange (swap, conversion, market fill), on
 * ONE transaction value: what was received is worth what was given. The value
 * is that of the leg in the price provider's anchor asset when the exchange
 * has one (it is the first-hand price; the other side's is derived from it),
 * otherwise the market value of what was received — the amount realised in
 * law (US Treas. Reg. §1.1001-1(a); the German BMF letter values an exchange's
 * proceeds at the market price of the units obtained).
 *
 * Before, the side given was priced at its own rate and the side received at
 * its own. Whenever the two disagreed — a conversion fee, a spread, a fill away
 * from the day's rate — the difference left the ledger: a 5% conversion fee
 * was taxed as a gain that was never made, and a favourable fill was never
 * taxed at all.
 *
 * Returns { out, in } aligned with the event's out- and in-legs, or null when
 * the event is not an exchange. Unpriced legs keep their own (NaN) values.
 */
function exchangeValues(ev, rule, prices, fiat) {
  if (!rule || !rule.realizesDisposal || !rule.acquisitionAtFmv) return null;
  const outLegs = ev.legs.filter(l => l.direction === "out");
  const inLegs = ev.legs.filter(l => l.direction === "in");
  if (!outLegs.length || !inLegs.length) return null;
  const fmv = (l) => {
    const q = prices.price(l.asset, fiat, ev.ts);
    return q ? q.fiatPerUnit * l.amount : NaN;
  };
  const out = outLegs.map(fmv), inn = inLegs.map(fmv);
  const priced = (a) => a.every(v => Number.isFinite(v) && v > 0);
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  const anchor = prices.anchorAsset;
  const allAnchor = (legs) => !!anchor && legs.every(l => l.asset === anchor);
  let total = null;
  if (allAnchor(outLegs) && priced(out)) total = sum(out);
  else if (allAnchor(inLegs) && priced(inn)) total = sum(inn);
  else if (priced(inn)) total = sum(inn);
  else if (priced(out)) total = sum(out);
  if (total == null) return { out, in: inn };
  const spread = (a) => (priced(a) ? a.map(v => (v / sum(a)) * total) : a.map(() => total / a.length));
  return { out: spread(out), in: spread(inn) };
}

// ---------------------------------------------------------------------------
// UK SHARE MATCHING PRE-PASS  (TCGA 1992 s.105/s.106A ordering)
// ---------------------------------------------------------------------------

/**
 * HMRC matches each disposal against acquisitions of the same asset in strict
 * priority BEFORE the section-104 pool:
 *   1. same-day acquisitions (s.105);
 *   2. acquisitions in the FOLLOWING 30 days, earliest first (s.106A —
 *      "bed and breakfasting");
 *   3. the remainder draws from the pool.
 * Matching runs across events, so it cannot live inside LotBook.consume() —
 * this pre-pass walks the ordered stream once and emits a plan the main loop
 * executes:
 *   claims:       disposalEventId -> [{ acqId, rule, qty, basisFiat, acquiredTs }]
 *   reservedQty:  acquisitionEventId -> qty claimed away from the pool
 *
 * Intent-aware: an outbound transfer the user marked own / own_exchange, an
 * exempt gift/charity send, or an inbound transfer from an own account is NOT
 * a disposal/acquisition here, mirroring the main loop exactly. Rewards under
 * a zero-basis ruleset never reach this path (UK is FMV), so acquisition
 * basis is always well-defined.
 *
 * Day boundaries use the UTC calendar date of the event timestamp — the same
 * convention the rest of the engine uses for holding periods.
 */
export function buildUkMatchPlan(profile, events, ruleset, prices, fiat) {
  const rules = ruleset.categoryRules;
  const giftIsDisposal = ruleset.giftIsDisposal ?? true;
  const charityExempt = ruleset.charityGiftExempt ?? false;
  const dayOf = ts => ts.slice(0, 10);
  const dayMs = ts => Date.parse(dayOf(ts) + "T00:00:00.000Z");

  // ---- collect disposals and acquisitions per asset, in stream order ----
  const disposalsByAsset = new Map(); // asset -> [{ id, ts, day, qty }]
  const acqsByAsset = new Map();      // asset -> [{ id, ts, day, qty, unitBasis, remainingQty }]
  const ordered = [...events].sort((a, b) => a.ts.localeCompare(b.ts));
  for (const ev of ordered) {
    const rule = rules[ev.category];
    if (!rule) continue;

    // Mirror the main loop's intent handling for outbound transfers.
    if (ev.category === "transfer_out") {
      const intent = intentOf(profile, ev);
      const isDisposalIntent = intent === "payment"
          || (intent === "gift" && giftIsDisposal)
          || (intent === "charity" && !charityExempt);
      if (!isDisposalIntent) continue;
    }
    if (ev.category === "transfer_in" && inboundIntentOf(profile, ev) === "own") continue;

    // An exchange's in-legs cost what the exchange was worth (exchangeValues),
    // exactly as the main loop books them.
    const sides = exchangeValues(ev, rule, prices, fiat);
    let inIx = 0;
    for (const leg of ev.legs) {
      if (leg.direction === "out" && rule.realizesDisposal) {
        const arr = disposalsByAsset.get(leg.asset) || [];
        arr.push({ id: ev.id, ts: ev.ts, day: dayMs(ev.ts), qty: leg.amount });
        disposalsByAsset.set(leg.asset, arr);
      } else if (leg.direction === "in" && (rule.income === "ordinary_income" || rule.acquisitionAtFmv)) {
        const q = prices.price(leg.asset, fiat, ev.ts);
        const own = q && q.fiatPerUnit > 0 ? q.fiatPerUnit : 0;
        const traded = sides && leg.amount > 0 ? sides.in[inIx] / leg.amount : NaN;
        const unitBasis = Number.isFinite(traded) && traded > 0 ? traded : own;
        const arr = acqsByAsset.get(leg.asset) || [];
        arr.push({ id: ev.id, ts: ev.ts, day: dayMs(ev.ts), qty: leg.amount, unitBasis, remainingQty: leg.amount });
        acqsByAsset.set(leg.asset, arr);
      }
      if (leg.direction === "in") inIx++;
    }
  }

  // ---- match, disposal by disposal, chronologically ----
  const claims = new Map();      // disposal id -> claim list
  const reservedQty = new Map(); // acquisition id -> qty removed from pool
  const THIRTY_DAYS = 30 * 86400000;
  for (const [asset, disposals] of disposalsByAsset) {
    const acqs = acqsByAsset.get(asset) || [];
    for (const d of disposals) {
      let unmatched = d.qty;
      // Pass 1: same day. Pass 2: following 30 days, earliest first (acqs is
      // already in stream order). An acquisition can satisfy several disposals
      // until its remainingQty is exhausted.
      for (const pass of ["same_day", "thirty_day"]) {
        if (unmatched <= 1e-12) break;
        for (const a of acqs) {
          if (unmatched <= 1e-12) break;
          if (a.remainingQty <= 1e-12) continue;
          const sameDay = a.day === d.day;
          const inWindow = a.day > d.day && a.day <= d.day + THIRTY_DAYS;
          if (pass === "same_day" ? !sameDay : !inWindow) continue;
          const take = Math.min(a.remainingQty, unmatched);
          a.remainingQty -= take;
          unmatched -= take;
          reservedQty.set(a.id, (reservedQty.get(a.id) || 0) + take);
          const list = claims.get(d.id) || [];
          list.push({ acqId: a.id, rule: pass, qty: take, basisFiat: take * a.unitBasis, acquiredTs: a.ts });
          claims.set(d.id, list);
        }
      }
    }
  }
  return { claims, reservedQty };
}

// ---------------------------------------------------------------------------
// JAPAN TOTAL-AVERAGE PRE-PASS  (総平均法)
// ---------------------------------------------------------------------------

/**
 * Japan's default cost-basis method for individuals prices EVERY disposal in a
 * calendar year at the year's overall average unit cost:
 *
 *   avg(year) = (opening cost + cost of ALL acquisitions that year)
 *             / (opening qty  + qty of ALL acquisitions that year)
 *
 * — a January sale is therefore priced with December's purchases included,
 * which cannot be known inside the single-pass main loop. This pre-pass
 * replays the ordered stream once, accumulating per-asset per-year acquisition
 * aggregates, finalising each year at its boundary; the closing cost
 * (avg × closing qty) rolls into the next year's opening.
 *
 * Cross-asset non-taxable transfers (power-up PXA→PXP and back) carry basis at
 * the SOURCE asset's year average — which can itself depend on transfers from
 * the destination asset in the same year. That circular linear system resolves
 * by fixed-point iteration at the year boundary (a handful of passes; it
 * converges because transferred quantities are bounded by the pools).
 * Same-asset internal moves (savings) cancel exactly and are skipped.
 * Disposal quantities never affect the average — only the year-close.
 */
export function buildTotalAveragePlan(profile, events, ruleset, prices, fiat) {
  const rules = ruleset.categoryRules;
  const zeroBasis = ruleset.rewardBasis === "zero";
  const SKIP = new Set(["request_powerdown", "request_convert", "request_collateralized",
    "immediate_conversion", "delegation_out", "delegation_in", "delegation_return", "savings_fill"]);
  const yearOf = ts => Number(ts.slice(0, 4));

  const open = new Map(); // asset -> { qty, cost } rolled across years
  for (const ol of (profile.openingLots || [])) {
    const o = open.get(ol.asset) || { qty: 0, cost: 0 };
    o.qty += ol.qty;
    o.cost += ol.costFiat;
    open.set(ol.asset, o);
  }

  const table = new Map(); // `${asset}|${year}` -> average unit cost
  const newYear = () => ({ byAsset: new Map(), links: [] });
  const acc = (yd, asset) => {
    let a = yd.byAsset.get(asset);
    if (!a) { a = { acqQty: 0, acqCost: 0, outQty: 0, tInQty: 0 }; yd.byAsset.set(asset, a); }
    return a;
  };

  const finalize = (year, yd) => {
    const assets = new Set([...open.keys(), ...yd.byAsset.keys()]);
    const avg = new Map();
    // Fixed point for cross-asset link costs, iterated until it stops moving.
    // It stopped after eight passes, which is not convergence: with stake
    // moved both ways in one year (power-ups and power-downs that are large
    // next to the holdings) the error shrinks only by that overlap each pass,
    // and the year's average — hence every gain of the year — came out a few
    // parts in ten thousand off on random ledgers.
    for (let pass = 0; pass < 2000; pass++) {
      let moved = 0;
      for (const a of assets) {
        const o = open.get(a) || { qty: 0, cost: 0 };
        const d = yd.byAsset.get(a) || { acqQty: 0, acqCost: 0, outQty: 0, tInQty: 0 };
        let linkCost = 0;
        for (const L of yd.links) if (L.to === a) linkCost += (avg.get(L.from) ?? 0) * L.qtyOut * L.frac;
        const q = o.qty + d.acqQty + d.tInQty;
        const next = q > 1e-12 ? (o.cost + d.acqCost + linkCost) / q : 0;
        const prev = avg.get(a) ?? 0;
        moved = Math.max(moved, Math.abs(next - prev) / (Math.abs(next) + Math.abs(prev) || 1));
        avg.set(a, next);
      }
      if (moved < 1e-13) break;
    }
    for (const a of assets) {
      const o = open.get(a) || { qty: 0, cost: 0 };
      const d = yd.byAsset.get(a) || { acqQty: 0, acqCost: 0, outQty: 0, tInQty: 0 };
      const unit = avg.get(a) ?? 0;
      table.set(`${a}|${year}`, unit);
      const closeQty = Math.max(0, o.qty + d.acqQty + d.tInQty - d.outQty);
      open.set(a, { qty: closeQty, cost: unit * closeQty });
    }
  };

  const ordered = [...events].sort((a, b) => a.ts.localeCompare(b.ts));
  let curYear = null, yd = null;
  for (const ev of ordered) {
    const y = yearOf(ev.ts);
    if (curYear === null) { curYear = y; yd = newYear(); }
    while (curYear < y) { finalize(curYear, yd); curYear++; yd = newYear(); }

    if (SKIP.has(ev.category)) continue;
    // Own-account inbound moves are skipped by the main loop; the plan used to
    // count them as acquisitions, pulling the year's average toward them.
    if (ev.category === "transfer_in" && inboundIntentOf(profile, ev) === "own") continue;
    const outs = ev.legs.filter(l => l.direction === "out");
    const ins = ev.legs.filter(l => l.direction === "in");

    if (ev.category === "fee_payment") { // leaves the account at avg, no gain line
      for (const o of outs) acc(yd, o.asset).outQty += o.amount;
      continue;
    }
    const rule = rules[ev.category];
    if (!rule) continue;

    if (rule.income === "non_taxable_transfer") {
      const sameAsset = outs.length === 1 && ins.length > 0 && ins.every(i => i.asset === outs[0].asset);
      if (sameAsset) continue; // savings round-trips cancel exactly
      const inValues = ins.map(i => prices.price(i.asset, fiat, ev.ts).fiatPerUnit * i.amount);
      const inTotal = inValues.reduce((s, v) => s + v, 0) || 1;
      for (const o of outs) {
        acc(yd, o.asset).outQty += o.amount;
        ins.forEach((i, ix) => {
          yd.links.push({ from: o.asset, to: i.asset, qtyOut: o.amount, frac: inValues[ix] / inTotal });
        });
      }
      for (const i of ins) acc(yd, i.asset).tInQty += i.amount;
      continue;
    }

    // Any other consumed out-leg (disposal, sends of every intent) reduces the
    // year-close quantity; the average itself is unaffected by outflows.
    for (const o of outs) acc(yd, o.asset).outQty += o.amount;
    // An exchange's in-legs cost what the exchange was worth (exchangeValues),
    // exactly as the main loop books them.
    const sides = exchangeValues(ev, rule, prices, fiat);
    for (const [ix, i] of ins.entries()) {
      if (rule.income === "ordinary_income") {
        const v = zeroBasis ? 0 : prices.price(i.asset, fiat, ev.ts).fiatPerUnit * i.amount;
        const A = acc(yd, i.asset);
        A.acqQty += i.amount;
        A.acqCost += v;
      } else if (rule.acquisitionAtFmv) {
        const A = acc(yd, i.asset);
        A.acqQty += i.amount;
        A.acqCost += sides ? sides.in[ix] : prices.price(i.asset, fiat, ev.ts).fiatPerUnit * i.amount;
      }
    }
  }
  if (curYear !== null) finalize(curYear, yd);

  return { unit: (asset, ts) => table.get(`${asset}|${yearOf(ts)}`) ?? 0 };
}

// ---------------------------------------------------------------------------
// 5. REPORT OUTPUT TYPES
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 6. ENGINE
// ---------------------------------------------------------------------------

function onOrBefore(iso, refIso) {
  return new Date(iso).getTime() <= new Date(refIso).getTime();
}

/** Resolve the residence that governs the reporting year (year-end determines it). */
function residenceForYear(profile, year) {
  const refEnd = `${year}-12-31`;
  const touchingYear = profile.residences.filter(r => onOrBefore(r.from, refEnd) && (!r.to || new Date(r.to).getUTCFullYear() >= year));
  // The residence in force on 31 December: started on or before it and not
  // ended before it. The old test took the first residence that reached into
  // the year at all, so someone who left Switzerland in June was still
  // reported under Swiss rules. With no residence on the last day (a gap), the
  // latest one that touched the year is used; the move is flagged either way.
  const atYearEnd = profile.residences.find(r => onOrBefore(r.from, refEnd) && (!r.to || onOrBefore(refEnd, r.to)))
      || [...touchingYear].sort((a, b) => String(b.from).localeCompare(String(a.from)))[0];
  if (!atYearEnd) return null;
  return {
    code: atYearEnd.jurisdiction,
    midYearMove: touchingYear.length > 1
  };
}
/**
 * opts (all optional):
 *   optimize  false skips the optimisation layer (used internally when the
 *             optimiser re-runs the engine to compare cost-basis methods)
 *   now       ISO timestamp treated as "now" — decides which levers can still
 *             be acted on before the period ends; defaults to the clock
 *   statutoryYear  true: with no `period`, report the statutory tax year that
 *             starts in `year` (statutoryPeriodFor) instead of the calendar year
 *
 * profile (optional additions read by this pass):
 *   exemptionUsedFiat  allowance already used elsewhere; for DE, other private-
 *             sale gains of the year; for FR, the price of disposals elsewhere
 *   unclaimedRewards   [{ asset, qty }] the account's pending reward balance
 *             right now — lets the optimisation layer put a figure on rewards
 *             that are not yet income under claim timing
 */
export function buildAllReports(profile, events, year, prices, period, fiatOverride, opts = {}) {
  const warnings = [];
  const nowIso = opts.now || new Date().toISOString();
  const residence = residenceForYear(profile, year);
  if (!residence) {
    return {
      account: profile.account,
      year,
      jurisdiction: "CH",
      fiat: fiatOverride || "CHF",
      rulesVersion: "none",
      priceDataVersion: prices.version,
      generatedAt: new Date().toISOString(),
      warnings: [tk("components.pixa_tax_engine.no_tax_residence_on_record_for_this_year")]
    };
  }
  if (residence.midYearMove) {
    warnings.push(tk("components.pixa_tax_engine.residence_changed_during_the_year"));
  }
  const ruleset = RULESETS[residence.code];
  if (!ruleset) {
    // A residence the engine has no rules for used to throw on the next line.
    return {
      account: profile.account,
      year,
      jurisdiction: residence.code,
      fiat: fiatOverride || "CHF",
      rulesVersion: "none",
      priceDataVersion: prices.version,
      generatedAt: nowIso,
      warnings: [tk("components.pixa_tax_engine.no_ruleset_for_this_jurisdiction", { code: String(residence.code) })]
    };
  }
  // Jurisdictions whose tax year is not the calendar year (UK, AU, NZ, ZA, IN,
  // HK): the caller can ask for the statutory window; a report on any other
  // window is flagged below, because its annual figures are then off-period.
  const statutory = statutoryPeriodFor(residence.code, year);
  if (!period && opts.statutoryYear && !statutory.calendar) period = { start: statutory.start, end: statutory.end };
  // The tax ruleset is keyed to a filing currency (CH→CHF, US→USD), but the
  // caller can override the display currency (e.g. the wallet's selected fiat)
  // so the report's figures match what the user sees elsewhere.
  const fiat = fiatOverride || ruleset.fiat;
  // Some jurisdictions MANDATE their cost-basis method (UK/CA pooling, ES FIFO,
  // JP total average) — a profile preference must not override it. The dialog
  // currently pins FIFO into every profile, so without this lock, UK and CA
  // users were silently getting FIFO instead of their mandated pooling.
  const method = ruleset.methodLocked
      ? ruleset.defaultDisposalMethod
      : (profile.costBasisMethod ?? ruleset.defaultDisposalMethod);
  // Exchanges and staking moves CARRY cost from one asset to another. Under
  // the French portfolio formula, where a disposal is costed from the whole
  // portfolio, that carry is a plain per-asset average.
  const carryMethod = method === "PORTFOLIO" ? "POOL" : method;

  // Trader status. Swiss gains are tax-free only for a private investor, so
  // every report states the status it used (see TRADER STATUS below). A
  // declaration wins: profile.traderStatus "private" | "professional" (the old
  // boolean professionalTrader:true still means "professional"; false is
  // treated as "not declared", since the dialog sends it by default). The
  // engine never decides "professional" on its own — undeclared users are
  // private investors, and the report says on what basis.
  const declaredStatus = profile.traderStatus === "professional" || profile.professionalTrader === true ? "professional"
      : profile.traderStatus === "private" ? "private" : null;

  // Reporting window. Defaults to the full calendar year (backward-compatible);
  // a caller-supplied period (e.g. the dialog's date-range pickers) overrides the
  // bounds. Residence + filing year stay keyed to `year`; only the scope and the
  // valuation reference date move. `end` is inclusive.
  const periodStartIso = period ? period.start : `${year}-01-01T00:00:00.000Z`;
  const periodEndIso = period ? period.end : `${year}-12-31T23:59:59.999Z`;
  const periodStartMs = Date.parse(periodStartIso);
  const periodEndMs = Date.parse(periodEndIso);
  const refDate = periodEndIso.slice(0, 10); // YYYY-MM-DD — display + valuation date
  const periodStartDate = periodStartIso.slice(0, 10);
  const inScope = iso => {
    const t = Date.parse(iso);
    return t >= periodStartMs && t <= periodEndMs;
  };

  // Statutory amounts (allowances, the US ordinary-loss offset) are written in
  // the filing currency. When the report is shown in another currency they are
  // converted at the provider's FX rate if it offers one (prices.fx(from, to,
  // date)); without one they are compared as written and the report says so —
  // the old code silently tested a EUR 1,000 Freigrenze against USD figures.
  // They also change over time (ZA R40,000 → R50,000 on 1 March 2026; the UK
  // and DE amounts before 2024): the amount in force on the period's last day
  // applies — see exemptionOn().
  const exemptionNow = exemptionOn(ruleset, refDate);
  let dedRuleset = exemptionNow === (ruleset.annualExemptionFiat || 0)
      ? ruleset
      : Object.assign({}, ruleset, { annualExemptionFiat: exemptionNow });
  if (fiat !== ruleset.fiat && (exemptionNow || ruleset.ordinaryLossOffsetFiat)) {
    const fx = typeof prices.fx === "function" ? Number(prices.fx(ruleset.fiat, fiat, refDate)) : NaN;
    if (Number.isFinite(fx) && fx > 0) {
      dedRuleset = Object.assign({}, ruleset, {
        annualExemptionFiat: exemptionNow * fx,
        ordinaryLossOffsetFiat: (ruleset.ordinaryLossOffsetFiat || 0) * fx
      });
    } else {
      warnings.push(tk("components.pixa_tax_engine.statutory_amounts_not_converted", { fiat: ruleset.fiat, shown: fiat }));
    }
  }
  // A window that is not the statutory tax year (this one or the one before):
  // the annual allowance, the loss rules and every "before the period ends"
  // lever belong to the statutory year, so say which one that is.
  if (!statutory.calendar) {
    const same = (p) => p.start.slice(0, 10) === periodStartDate && p.end.slice(0, 10) === refDate;
    if (!same(statutory) && !same(statutoryPeriodFor(residence.code, year - 1))) {
      warnings.push(tk("components.pixa_tax_engine.tax_year_is_not_the_calendar_year", {
        start: statutory.start.slice(0, 10), end: statutory.end.slice(0, 10)
      }));
    }
  }
  const book = new LotBook();

  // Opening balances: lots the account already held before its earliest recorded
  // operation (supplied by the caller as profile.openingLots). Seeding them gives
  // pre-history disposals a real cost basis instead of the zero-basis fallback.
  // Dated 1970 so FIFO always consumes them first (and they read as long-held for
  // the Swiss holding-period test).
  if (Array.isArray(profile.openingLots)) {
    for (const lot of profile.openingLots) {
      const qty = Number(lot && lot.qty) || 0;
      if (qty <= 0) continue;
      const cost = Number(lot.costFiat) || 0;
      book.acquire(profile.account, lot.asset, qty, cost, lot.date || "1970-01-01T00:00:00.000Z");
    }
  }

  const disposals = [];
  const income = [];
  const movements = [];   // itemized non-taxable movements (fees, savings fills, power-up completions)
  const offPlatformBasis = []; // crypto sent to your own exchange — disposal happens off-platform
  const outboundByIntent = {}; // every outbound transfer rolled up by purpose: count + qty per asset
  const seenAssetsMissingBasis = new Set();
  const unknownCategories = new Set();
  // Value brought into and taken out of the account during the window — what
  // separates a change in value from a deposit or a withdrawal (NL actual return).
  let flowInFiat = 0, feeOutFiat = 0;

  // UK-style share matching (same-day, then 30-day) runs as a pre-pass over the
  // whole stream; the loop below executes its plan. Empty plan = pure pooling.
  const matchPlan = ruleset.matchingRules === "uk_sameday_30day"
      ? buildUkMatchPlan(profile, events, ruleset, prices, fiat)
      : { claims: new Map(), reservedQty: new Map() };

  // Japan total average: two-pass unit costs injected into the LotBook so
  // consume("TOTAL_AVG") can price each disposal with the FULL year's
  // acquisitions — including ones that happen after the disposal.
  if (method === "TOTAL_AVG") {
    book.totalAvgPlan = buildTotalAveragePlan(profile, events, ruleset, prices, fiat);
  }
  // French portfolio formula: the LotBook values the whole portfolio at the
  // moment of each disposal (see consume("PORTFOLIO")).
  if (method === "PORTFOLIO") {
    book.priceAt = (asset, ts) => {
      const q = prices.price(asset, fiat, ts);
      return q ? q.fiatPerUnit : NaN;
    };
  }

  // Year-start wealth snapshot (NL Box 3 peildatum): freeze holdings the moment
  // the stream crosses 1 January of the filing year. Events are sorted, so the
  // first event at-or-after the boundary triggers the capture; if no event ever
  // crosses it (all activity later, or none), the post-loop capture takes
  // whatever the book held — including the legitimate empty case (an account
  // opened mid-year has a zero peildatum base for that year).
  const wantYearStart = ruleset.wealthSnapshotAt === "year_start" && ruleset.reports.wealth.enabled;
  const snapshotBoundaryMs = Date.parse(`${year}-01-01T00:00:00.000Z`);
  let snapshotHoldings = null;
  const captureSnapshot = () => { if (wantYearStart && !snapshotHoldings) snapshotHoldings = book.remaining(profile.account); };
  // Holdings when the reporting window opens — the denominator of the Swiss
  // safe-harbour volume test in the optimisation layer. Same capture pattern.
  let startHoldings = null;
  const captureStart = () => { if (!startHoldings) startHoldings = book.remaining(profile.account); };

  const ordered = [...events].sort((a, b) => a.ts.localeCompare(b.ts));
  for (const ev of ordered) {
    if (wantYearStart && !snapshotHoldings && Date.parse(ev.ts) >= snapshotBoundaryMs) captureSnapshot();
    if (!startHoldings && Date.parse(ev.ts) >= periodStartMs) captureStart();
    // Lots must reflect full history, but only events up to the ref date matter
    // for this window's holdings, and only in-scope events appear in the reports.
    if (Date.parse(ev.ts) > periodEndMs) continue;
    if (!profile.ownWallets.includes(ev.wallet)) {
      warnings.push(tk("components.pixa_tax_engine.event_wallet_not_tagged_as_yours", { id: String(ev.id), wallet: String(ev.wallet) }));
    }
    // Inbound from your own wallet is an internal move — no new basis event.
    // Inbound transfers: from an own account → internal move (skipped); marked
    // "income" → booked like a reward, income at market value on receipt;
    // otherwise an acquisition at market value (see inboundIntentOf).
    let inboundAsIncome = false;
    if (ev.category === "transfer_in") {
      const inIntent = inboundIntentOf(profile, ev);
      if (inIntent === "own") continue;
      inboundAsIncome = inIntent === "income";
      if (inScope(ev.ts)) {
        for (const leg of ev.legs) {
          if (leg.direction !== "in") continue;
          const q = prices.price(leg.asset, fiat, ev.ts);
          if (q && q.fiatPerUnit > 0) flowInFiat += q.fiatPerUnit * leg.amount;
        }
      }
    }

    // Outbound transfers: whether a send is a taxable disposal depends on INTENT
    // (who/why), which the user supplies via a counterparty map. Unlabelled sends
    // default to a third-party payment = disposal (the conservative case).
    if (ev.category === "transfer_out") {
      // Default is a taxable payment — the conservative, audit-safe floor —
      // except a send to an account the user already declared as their own at
      // ingest (see intentOf). Anything else (exchange, gift, charity) must be
      // reclassified actively; nothing else is deducted automatically.
      const intent = intentOf(profile, ev);
      const giftIsDisposal = ruleset.giftIsDisposal ?? true;
      const charityExempt = ruleset.charityGiftExempt ?? false;

      // Classify EVERY outbound transfer by its purpose (count + quantity per asset
      // + fiat value), whether or not it ends up taxable. This is the honest,
      // audit-ready breakdown: the tool says how much went where; an adviser
      // applies the exact local rules.
      if (inScope(ev.ts)) {
        const taxableHere = intent === "payment"
            || (intent === "gift" && giftIsDisposal)
            || (intent === "charity" && !charityExempt);
        const slot = outboundByIntent[intent] || (outboundByIntent[intent] = { count: 0, byAsset: {}, valueFiat: 0, taxable: taxableHere });
        slot.count++;
        for (const leg of ev.legs.filter(l => l.direction === "out")) {
          slot.byAsset[leg.asset] = (slot.byAsset[leg.asset] || 0) + leg.amount;
          const q = prices.price(leg.asset, fiat, ev.ts);
          if (q && q.fiatPerUnit > 0) slot.valueFiat += q.fiatPerUnit * leg.amount;
        }
      }

      if (intent === "own" || intent === "own_exchange") {
        // Move to your own wallet/exchange — NOT a disposal.
        if (inScope(ev.ts)) for (const leg of ev.legs) movements.push({
          id: ev.id, block: ev.block, ts: ev.ts, kind: intent === "own_exchange" ? "to_own_exchange" : "to_own_wallet",
          note: ev.memo || "", asset: leg.asset, amount: round4(leg.amount), direction: "out"
        });
        if (intent === "own_exchange") {
          // Crypto leaves the chain; its eventual sale on the exchange is the taxable
          // disposal, off-platform. Remove from holdings and record the basis that left.
          for (const leg of ev.legs) {
            const { basisFiat } = book.consume(profile.account, leg.asset, leg.amount, method, ev.ts);
            if (inScope(ev.ts)) offPlatformBasis.push({ ts: ev.ts, asset: leg.asset, qty: round4(leg.amount), basisFiat: round2(basisFiat), counterparty: ev.counterparty || "" });
          }
        }
        continue;
      }

      if ((intent === "gift" && !giftIsDisposal) || (intent === "charity" && charityExempt)) {
        // Not a taxable disposal in this jurisdiction (e.g. a US gift, or a UK/US
        // charitable donation). The crypto still leaves holdings: consume the basis,
        // realise no gain.
        for (const leg of ev.legs) {
          book.consume(profile.account, leg.asset, leg.amount, method, ev.ts);
          // The user's memo stays its own field; the explanation is a descriptor.
          // Displays join them as "memo · note".
          if (inScope(ev.ts)) movements.push({
            id: ev.id, block: ev.block, ts: ev.ts, kind: intent === "charity" ? "charity_donation" : "gift_out",
            note: intent === "charity"
                ? tk("components.pixa_tax_engine.charitable_donation_no_gain_realised_here")
                : tk("components.pixa_tax_engine.gift_not_a_disposal_here_basis_carries"),
            memo: ev.memo || undefined,
            asset: leg.asset, amount: round4(leg.amount), direction: "out"
          });
        }
        continue;
      }
      // payment / third_party / gift-as-disposal / charity-non-exempt
      //   → fall through to the normal disposal path below.
    }

    // Savings deposits/withdrawals are internal relabels of the same asset.
    if (ev.category === "savings_deposit" || ev.category === "savings_withdraw") continue;

    // Itemized movements that should be shown line-by-line but are not taxable
    // disposals/income. Two groups:
    //  • display-only (continue): proposal fees (also reduce holdings), completed
    //    savings withdrawals, and request/initiation ops (power-down request,
    //    convert/collateralized requests, the immediate PXS leg) — the matching
    //    fill does the real booking, so these never touch the cost-basis ledger.
    //  • power-up / power-down: ALSO recorded here for visibility, but they fall
    //    through to the POWER rule below, which carries the cost basis across.
    const DISPLAY_ONLY = ev.category === "fee_payment" || ev.category === "savings_fill"
        || ev.category === "request_powerdown"
        || ev.category === "request_convert" || ev.category === "request_collateralized"
        || ev.category === "immediate_conversion"
        // Delegations: never a disposal, never income, no LotBook impact — the
        // delegator retains ownership; the delegatee gains influence, not assets.
        || ev.category === "delegation_out" || ev.category === "delegation_in"
        || ev.category === "delegation_return";
    const isPowerMove = ev.category === "power_up" || ev.category === "power_down";

    if (DISPLAY_ONLY || isPowerMove) {
      if (inScope(ev.ts)) {
        for (const leg of ev.legs) {
          movements.push({
            id: ev.id,
            block: ev.block,
            ts: ev.ts,
            kind: ev.category,
            note: ev.note || "",
            asset: leg.asset,
            amount: round4(leg.amount),
            direction: leg.direction
          });
        }
      }
      // A fee paid in PXA actually leaves the account, so consume it to keep the
      // holdings total accurate — but it is not a capital disposal (no gain line).
      if (ev.category === "fee_payment") {
        for (const leg of ev.legs.filter(l => l.direction === "out")) {
          book.consume(profile.account, leg.asset, leg.amount, method, ev.ts);
          const q = inScope(ev.ts) ? prices.price(leg.asset, fiat, ev.ts) : null;
          if (q && q.fiatPerUnit > 0) feeOutFiat += q.fiatPerUnit * leg.amount;
        }
      }
      if (DISPLAY_ONLY) continue;          // display-only → skip the tax dispatch
      // power-up / power-down fall through to the POWER rule for the basis carry.
    }

    const rule = inboundAsIncome ? REWARD : ruleset.categoryRules[ev.category];
    if (!rule) {
      // A category the ruleset has no rule for used to throw on its first leg.
      // It is left out of the books and named once in the review notes.
      if (!unknownCategories.has(ev.category)) {
        unknownCategories.add(ev.category);
        warnings.push(tk("components.pixa_tax_engine.category_not_booked", { category: String(ev.category) }));
      }
      continue;
    }
    const outLegs = ev.legs.filter(l => l.direction === "out");
    const inLegs = ev.legs.filter(l => l.direction === "in");
    const isProfessional = declaredStatus === "professional";
    let carryBasis = 0;
    const carryLots = []; // consumed lots (qty, basisFiat, acquiredTs) to re-seed on the in-leg(s)
    // One value for both sides of an exchange (null for anything else).
    const sides = exchangeValues(ev, rule, prices, fiat);
    // FR / AT / PT: for a private holder an exchange of crypto for crypto is
    // not a taxable event — the cost of what was given carries over to what
    // was received, and the gain is taxed when that is sold or spent.
    const rollover = !!ruleset.swapRollover && !!sides && !isProfessional;
    let rolledValue = 0, realisedValue = 0; // the exchange's value, split by what happened to the lots given
    // Re-seed carried lots into `qtyPart` units of an in-leg; `frac` is that
    // leg's share of the carry. Lots keep their acquisition date unless the
    // clock restarts (PT exchanges; pooled lots carry no date).
    const reseed = (inLeg, qtyPart, frac, restartClock) => {
      const carryQtyTotal = carryLots.reduce((s, l) => s + l.qty, 0) || 1;
      for (const cl of carryLots) {
        const qty = qtyPart * (cl.qty / carryQtyTotal);   // lot's share of what was consumed
        if (qty <= 0) continue;
        book.acquire(profile.account, inLeg.asset, qty, cl.basisFiat * frac, restartClock ? ev.ts : (cl.acquiredTs || ev.ts));
      }
    };

    // ---- OUT legs ----
    const isSwap = inLegs.length > 0; // crypto-to-crypto (has an in-leg) vs plain transfer-out
    for (const [oi, outLeg] of outLegs.entries()) {
      if (rule.realizesDisposal) {
        const unit = prices.price(outLeg.asset, fiat, ev.ts);
        const proceeds = sides ? sides.out[oi] : unit.fiatPerUnit * outLeg.amount;

        // ---- UK matching: satisfy same-day / 30-day claims first ----
        // Claims were planned per event id; take the ones for this asset up to
        // the leg's quantity. Matched quantity never touches the pool — its
        // basis is the matched acquisition's own FMV cost.
        const evClaims = (matchPlan.claims.get(ev.id) || []).filter(c => !c.done);
        const matchedLots = [];
        let matchedQty = 0, matchedBasis = 0;
        let sameDayQty = 0, thirtyDayQty = 0;
        for (const c of evClaims) {
          if (matchedQty >= outLeg.amount - 1e-12) break;
          const take = Math.min(c.qty, outLeg.amount - matchedQty);
          const basisShare = c.qty > 0 ? c.basisFiat * (take / c.qty) : 0;
          matchedQty += take;
          matchedBasis += basisShare;
          if (c.rule === "same_day") sameDayQty += take; else thirtyDayQty += take;
          matchedLots.push({ qty: take, basisFiat: basisShare, acquiredTs: c.acquiredTs, matchRule: c.rule });
          c.qty -= take; c.basisFiat -= basisShare;
          if (c.qty <= 1e-12) c.done = true;
        }

        const poolQty = outLeg.amount - matchedQty;
        const consumed = poolQty > 1e-12
            ? book.consume(profile.account, outLeg.asset, poolQty, rollover ? carryMethod : method, ev.ts,
                outLeg.amount > 0 ? proceeds * (poolQty / outLeg.amount) : NaN)
            : { basisFiat: 0, shortfallQty: 0, consumedLots: [] };
        // Matched quantity bypassed the pool on BOTH sides (never acquired,
        // never consumed) — book it into the gross tallies directly so the
        // per-token reconciliation (opening + received − out = closing) stays
        // exact and UK activity is not under-reported.
        if (matchedQty > 1e-12) {
          book.grossIn.set(outLeg.asset, (book.grossIn.get(outLeg.asset) || 0) + matchedQty);
          book.grossOut.set(outLeg.asset, (book.grossOut.get(outLeg.asset) || 0) + matchedQty);
        }
        const basisFiat = consumed.basisFiat + matchedBasis;
        const shortfallQty = consumed.shortfallQty;
        const consumedLots = [...matchedLots, ...consumed.consumedLots];
        if (shortfallQty > 1e-9) seenAssetsMissingBasis.add(outLeg.asset);

        const unitProceeds = outLeg.amount > 0 ? proceeds / outLeg.amount : 0;

        // Rollover: lots whose cost carries over leave this disposal entirely
        // and are re-seeded on the in-leg below. Portugal keeps one exception:
        // a lot already held 365 days is disposed of here, tax-free (art. 10
        // n.º 19 CIRS), and what it buys starts afresh at market value.
        let realisedLots = consumedLots;
        let rolledQty = 0;
        if (rollover) {
          realisedLots = [];
          for (const cl of consumedLots) {
            if (ruleset.longTermExempt && termOf(ruleset, cl.acquiredTs, ev.ts) === "long") {
              realisedLots.push(cl);
              continue;
            }
            carryLots.push(cl);
            carryBasis += cl.basisFiat;
            rolledQty += cl.qty;
          }
          // Quantity with no cost on record carries over at zero cost.
          const missing = outLeg.amount - consumedLots.reduce((s, l) => s + l.qty, 0);
          if (missing > 1e-9) {
            carryLots.push({ qty: missing, basisFiat: 0, acquiredTs: null });
            rolledQty += missing;
          }
          rolledValue += unitProceeds * rolledQty;
          if (rolledQty > 1e-12 && inScope(ev.ts)) {
            movements.push({
              id: ev.id, block: ev.block, ts: ev.ts, kind: "swap_rollover",
              note: tk("components.pixa_tax_engine.exchange_not_taxed_cost_carried_over"),
              asset: outLeg.asset, amount: round4(rolledQty), direction: "out"
            });
          }
        }
        // What is disposed of here (everything, outside a rollover).
        const dQty = outLeg.amount - rolledQty;
        const dProceeds = rollover ? unitProceeds * dQty : proceeds;
        const dBasis = rollover ? realisedLots.reduce((s, l) => s + l.basisFiat, 0) : basisFiat;
        realisedValue += dProceeds;
        if (rollover && dQty <= 1e-9) continue; // everything rolled over: no disposal line

        // Classify each consumed lot by holding period and taxability, and split
        // the gain into short-term / long-term / exempt buckets accordingly.
        const lotDetail = [];
        let shortGain = 0, longGain = 0, exemptGain = 0, coveredQty = 0;
        for (const cl of realisedLots) {
          const lotProceeds = unitProceeds * cl.qty;
          const lotGain = lotProceeds - cl.basisFiat;
          const heldDays = cl.acquiredTs
              ? Math.floor((Date.parse(ev.ts) - Date.parse(cl.acquiredTs)) / 86400000)
              : null;
          // Calendar-exact holding period (see longTermFrom): a sale on the
          // anniversary is still short-term where the law says "more than".
          const term = termOf(ruleset, cl.acquiredTs, ev.ts);
          const taxable = lotIsTaxable(ruleset, { isSwap, term, isProfessional });
          if (!taxable) exemptGain += lotGain;
          else if (term === "long") longGain += lotGain;
          else shortGain += lotGain;
          coveredQty += cl.qty;
          lotDetail.push({
            acquiredTs: cl.acquiredTs,
            qty: round4(cl.qty),
            basisFiat: round2(cl.basisFiat),
            proceedsFiat: round2(lotProceeds),
            gainFiat: round2(lotGain),
            heldDays,
            term,
            matchRule: cl.matchRule,
            taxable
          });
        }
        // Any quantity with no matching lot (missing basis) is a zero-cost,
        // taxable disposal — fold it into the short-term bucket and flag it.
        const uncovered = dQty - coveredQty;
        if (uncovered > 1e-9) {
          const g = unitProceeds * uncovered;
          const taxable = lotIsTaxable(ruleset, { isSwap, term: "short", isProfessional });
          if (taxable) shortGain += g; else exemptGain += g;
          lotDetail.push({
            acquiredTs: null, qty: round4(uncovered), basisFiat: 0,
            proceedsFiat: round2(g), gainFiat: round2(g), heldDays: null,
            term: ruleset.longTermThresholdDays == null ? "n/a" : "short", taxable, missingBasis: true
          });
        }

        // Reconcile the rounded short/long/exempt buckets to the disposal's
        // rounded total gain, so the report totals add up to the cent (the
        // unrounded buckets already sum to proceeds − basis; only rounding drifts).
        const gainUn = dProceeds - dBasis;
        let rShort = round2(shortGain), rLong = round2(longGain), rExempt = round2(exemptGain);
        const resid = round2(round2(gainUn) - (rShort + rLong + rExempt));
        if (Math.abs(resid) >= 0.005) {
          const mag = [["s", Math.abs(shortGain)], ["l", Math.abs(longGain)], ["e", Math.abs(exemptGain)]]
              .sort((a, b) => b[1] - a[1])[0][0];
          if (mag === "s") rShort = round2(rShort + resid);
          else if (mag === "l") rLong = round2(rLong + resid);
          else rExempt = round2(rExempt + resid);
        }

        if (inScope(ev.ts)) {
          disposals.push({
            id: ev.id,
            block: ev.block,
            ts: ev.ts,
            category: ev.category,
            asset: outLeg.asset,
            qtyOut: dQty,
            proceedsFiat: round2(dProceeds),
            basisFiat: round2(dBasis),
            gainFiat: round2(gainUn),
            taxable: lotDetail.some(l => l.taxable),
            shortTermGainFiat: rShort,
            longTermGainFiat: rLong,
            exemptGainFiat: rExempt,
            matchedSameDayQty: sameDayQty > 1e-12 ? round4(sameDayQty) : undefined,
            matchedThirtyDayQty: thirtyDayQty > 1e-12 ? round4(thirtyDayQty) : undefined,
            pooledQty: matchedQty > 1e-12 ? round4(outLeg.amount - matchedQty) : undefined,
            isSwap,
            counterparty: ev.counterparty || "",
            method,
            // French portfolio formula: the two figures form 2086 asks for at
            // each disposal — the portfolio's value and its acquisition price
            // just before it (on-platform holdings only).
            portfolioValueFiat: consumed.portfolio ? round2(consumed.portfolio.valueFiat) : undefined,
            portfolioCostFiat: consumed.portfolio ? round2(consumed.portfolio.costFiat) : undefined,
            lots: lotDetail
          });
        }
      } else if (rule.income === "non_taxable_transfer") {
        const {
          basisFiat,
          consumedLots
        } = book.consume(profile.account, outLeg.asset, outLeg.amount, carryMethod, ev.ts);
        carryBasis += basisFiat; // carries to the in-leg(s)
        // Preserve each consumed lot's original acquisition date so the holding
        // period survives the transfer (power-up/down must NOT restart the
        // DE/PT one-year clock). POOL disposals have no per-lot date (null);
        // those fall back to ev.ts at re-acquisition, matching prior behaviour.
        carryLots.push(...consumedLots);
      }
    }

    // ---- IN legs ----
    const inValues = inLegs.map(l => prices.price(l.asset, fiat, ev.ts).fiatPerUnit * l.amount);
    // Each in-leg's share of a carried cost: by market value, or equally when a
    // leg has no price — a carry needs no price at all, and an unpriced leg
    // used to turn the carried cost into NaN.
    const inPriced = inValues.length > 0 && inValues.every(v => Number.isFinite(v) && v > 0);
    const inValueTotal = inPriced ? inValues.reduce((s, v) => s + v, 0) : 1;
    const inShare = (i) => (inPriced ? inValues[i] / inValueTotal : 1 / inLegs.length);
    inLegs.forEach((inLeg, i) => {
      if (rule.income === "ordinary_income") {
        const unit = prices.price(inLeg.asset, fiat, ev.ts);
        const value = unit.fiatPerUnit * inLeg.amount;
        // rewardBasis "fmv" (default): income at FMV on receipt; the lot enters
        // at that FMV. rewardBasis "zero" (AT staking / bounties, PT income paid
        // in crypto, KR): NOT taxed at receipt — the lot enters at ZERO cost
        // and its whole value is taxed later, when it is sold for money or
        // spent. The line still appears in the report, flagged, for the record.
        const zeroBasis = ruleset.rewardBasis === "zero";
        // UK matching: quantity claimed by a same-day / 30-day match never
        // enters the pool — its basis went straight to the matched disposal.
        // Income tax is NOT affected: the full reward is still income at FMV.
        const reserved = Math.min(inLeg.amount, matchPlan.reservedQty.get(ev.id) || 0);
        const poolable = inLeg.amount - reserved;
        if (reserved > 1e-12) matchPlan.reservedQty.set(ev.id, (matchPlan.reservedQty.get(ev.id) || 0) - reserved);
        if (poolable > 1e-12) {
          book.acquire(profile.account, inLeg.asset, poolable, zeroBasis ? 0 : value * (poolable / inLeg.amount), ev.ts);
        }
        if (inScope(ev.ts)) {
          income.push({
            id: ev.id,
            block: ev.block,
            ts: ev.ts,
            category: ev.category,
            asset: inLeg.asset,
            qtyIn: inLeg.amount,
            fmvFiat: round2(value),
            taxedAtReceipt: !zeroBasis,
            source: unit.source,
            counterparty: ev.counterparty || ""
          });
        }
      } else if (rule.acquisitionAtFmv) {
        const unit = prices.price(inLeg.asset, fiat, ev.ts);
        // Cost of this leg: what the exchange was worth (one value for both
        // sides), or its own market value for a plain receipt.
        const legValue = sides ? sides.in[i] : unit.fiatPerUnit * inLeg.amount;
        // Rollover: the share of this leg that replaces rolled-over lots takes
        // THEIR cost. Any share that replaces lots disposed of outright (PT,
        // held 365 days) is a fresh acquisition at market value, like the rest.
        const rolledIn = rollover && rolledValue + realisedValue > 0
            ? inLeg.amount * (rolledValue / (rolledValue + realisedValue))
            : 0;
        if (rolledIn > 1e-12) {
          reseed(inLeg, rolledIn, inShare(i), ruleset.rolloverKeepsDate === false);
          if (inScope(ev.ts)) {
            movements.push({
              id: ev.id, block: ev.block, ts: ev.ts, kind: "swap_rollover",
              note: tk("components.pixa_tax_engine.exchange_not_taxed_cost_carried_over"),
              asset: inLeg.asset, amount: round4(rolledIn), direction: "in"
            });
          }
        }
        const freshQty = inLeg.amount - rolledIn;
        // UK matching: same reservation as the income path — claimed quantity
        // bypasses the pool, the rest pools at its cost.
        const reserved = Math.min(freshQty, matchPlan.reservedQty.get(ev.id) || 0);
        const poolable = freshQty - reserved;
        if (reserved > 1e-12) matchPlan.reservedQty.set(ev.id, (matchPlan.reservedQty.get(ev.id) || 0) - reserved);
        if (poolable > 1e-12) {
          book.acquire(profile.account, inLeg.asset, poolable, inLeg.amount > 0 ? legValue * (poolable / inLeg.amount) : 0, ev.ts);
        }
      } else if (rule.income === "non_taxable_transfer") {
        const frac = inShare(i); // this leg's FMV share of the transfer
        if (carryLots.length) {
          // Re-seed each carried lot pro-rata into this in-leg, keeping its
          // ORIGINAL acquisition date so holding periods survive power-up/down
          // and savings moves. Quantities are rescaled to the in-leg's units
          // (e.g. PXA→PXP), basis is allocated by the lot's share of the carry.
          reseed(inLeg, inLeg.amount, frac, false);
        } else {
          const alloc = carryBasis * frac; // no lot detail — legacy basis-only carry
          book.acquire(profile.account, inLeg.asset, inLeg.amount, alloc, ev.ts);
        }
      }
    });
  }
  for (const a of seenAssetsMissingBasis) {
    warnings.push(tk("components.pixa_tax_engine.asset_more_sent_than_acquired", { asset: a }));
  }
  if (offPlatformBasis.length) {
    const byAsset = {};
    for (const m of offPlatformBasis) byAsset[m.asset] = (byAsset[m.asset] || 0) + m.qty;
    // An array variable: the resolver formats each amount and joins them as a
    // list in the reader's language.
    const amounts = Object.entries(byAsset).map(([a, q]) => tk("components.pixa_tax_engine.amount_asset", { amount: round4(q), asset: a }));
    warnings.push(tk("components.pixa_tax_engine.you_moved_to_your_own_exchange", { amounts }));
  }

  // ---- WEALTH (point-in-time holdings) ----
  let wealth;
  if (ruleset.reports.wealth.enabled) {
    // Year-start jurisdictions (NL): if no event ever crossed the boundary,
    // capture now — the book state IS the 1 January state (possibly empty).
    if (wantYearStart) captureSnapshot();
    const peildatum = `${year}-01-01`;
    const wealthDate = wantYearStart ? peildatum : refDate;
    const holdings = wantYearStart ? snapshotHoldings : book.remaining(profile.account);
    if (wantYearStart && period) {
      warnings.push(tk("components.pixa_tax_engine.box_3_peildatum_is_statutory", { year: String(year) }));
    }
    // PXP is declared at the PIXA price unless a ruling sets a lock-up
    // discount (see CH_RULESET.pxpWealthDiscount); a discount is never applied
    // silently — the line carries it and the review notes say where it came from.
    const pxpDiscount = pxpWealthDiscountOf(ruleset, profile);
    const lines = [];
    for (const [asset, {
      qty,
      basisFiat
    }] of holdings) {
      const {
        unit,
        source
      } = valueAtRefDate(asset, fiat, year, wealthDate, qty, basisFiat, ruleset.wealthValuation, prices);
      if (source === "unavailable") {
        warnings.push(wantYearStart
            ? tk("components.pixa_tax_engine.asset_no_peildatum_value", { asset })
            : tk("components.pixa_tax_engine.asset_no_year_end_value", { asset }));
        continue;
      }
      const discounted = asset === "PXP" && pxpDiscount > 0 && source !== "cost_basis";
      const u = discounted ? unit * (1 - pxpDiscount) : unit;
      lines.push({
        asset,
        qty: round4(qty),
        fiatPerUnit: round4(u),
        valueFiat: round2(u * qty),
        source,
        discount: discounted ? pxpDiscount : undefined
      });
    }
    if (lines.some(l => l.discount)) {
      warnings.push(tk("components.pixa_tax_engine.pxp_wealth_discount_applied", { pct: round2(pxpDiscount * 100) }));
    }
    wealth = {
      kind: "wealth",
      refDate: wealthDate,
      fiat,
      lines,
      totalFiat: round2(lines.reduce((s, l) => s + l.valueFiat, 0)),
      note: ruleset.reports.wealth.note
    };
  }

  // ---- TRANSACTIONS ----
  let transactions;
  let txShortT = 0, txLongT = 0; // kept for the optimisation layer's what-ifs
  let taxableProceeds = 0;
  if (ruleset.reports.transactions.enabled) {
    const totalGain = disposals.reduce((s, l) => s + l.gainFiat, 0);
    // India §115BBH: losses from VDA transfers cannot be set off against ANY
    // income — not other VDAs, not even the same asset in the same year — and
    // cannot be carried forward. Each transfer stands alone: the taxable base
    // sums only POSITIVE per-transfer gains; every loss is disregarded (still
    // listed line-by-line, and totalled below as disallowed for the record).
    const noOffset = ruleset.lossOffset === "none";
    const shortT = disposals.reduce((s, l) => s + (noOffset ? Math.max(0, l.shortTermGainFiat || 0) : (l.shortTermGainFiat || 0)), 0);
    const longT = disposals.reduce((s, l) => s + (noOffset ? Math.max(0, l.longTermGainFiat || 0) : (l.longTermGainFiat || 0)), 0);
    const disallowedLosses = noOffset
        ? disposals.reduce((s, l) => s + Math.min(0, (l.shortTermGainFiat || 0) + (l.longTermGainFiat || 0)), 0)
        : 0;
    const exemptT = disposals.reduce((s, l) => s + (l.exemptGainFiat || 0), 0);
    // Price of the taxable disposals — what the French EUR 305 threshold is
    // tested on (applyDeductions "proceeds_threshold").
    taxableProceeds = disposals.reduce((s, l) => s + (l.taxable ? (Number(l.proceedsFiat) || 0) : 0), 0);
    const ded = applyDeductions(dedRuleset, profile, shortT, longT, { proceedsFiat: taxableProceeds });
    txShortT = shortT; txLongT = longT;
    transactions = {
      kind: "transactions",
      periodStart: periodStartDate,
      periodEnd: refDate,
      fiat,
      lines: disposals,
      totalGainFiat: round2(totalGain),
      taxableGainFiat: round2(shortT + longT),
      shortTermGainFiat: round2(shortT),
      longTermGainFiat: round2(longT),
      disallowedLossesFiat: noOffset && disallowedLosses < 0 ? round2(-disallowedLosses) : undefined,
      exemptGainFiat: round2(exemptT),
      taxableAmountFiat: ded.taxableAmountFiat,
      deductionSteps: ded.anyApplied ? ded.steps : undefined,
      lossCarryforwardOutFiat: ded.lossCarryforwardOutFiat,
      // US only: the part of a net capital loss that offsets ordinary income
      // this year instead of carrying forward.
      ordinaryIncomeOffsetFiat: ded.ordinaryIncomeOffsetFiat || undefined,
      splitByTerm: ruleset.longTermThresholdDays != null,
      costBasisMethod: method,
      safeHarbourCheck: residence.code === "CH" ? {
        disposalCount: disposals.length,
        note: tk("components.pixa_tax_engine.ch_safe_harbour_note")
      } : undefined,
      note: ruleset.reports.transactions.note
    };
  }

  // ---- OPERATIONS ----
  let operations;
  if (ruleset.reports.operations.enabled) {
    const taxedLines = income.filter(l => l.taxedAtReceipt !== false);
    const deferredLines = income.filter(l => l.taxedAtReceipt === false);
    // Per-category subtotals (Fix #3): CH files interest (Vermögensertrag) and
    // reward income on different lines; UK splits miscellaneous vs savings
    // income; DE splits §22 Nr. 3 vs Kapitalerträge. The PDF renders these as
    // subtotal rows under the operations table.
    const incomeSubtotalsByCategory = {};
    for (const l of taxedLines) {
      incomeSubtotalsByCategory[l.category] = round2((incomeSubtotalsByCategory[l.category] || 0) + l.fmvFiat);
    }
    operations = {
      kind: "operations",
      periodStart: periodStartDate,
      periodEnd: refDate,
      fiat,
      lines: income,
      totalIncomeFiat: round2(taxedLines.reduce((s, l) => s + l.fmvFiat, 0)),
      deferredIncomeFiat: deferredLines.length ? round2(deferredLines.reduce((s, l) => s + l.fmvFiat, 0)) : undefined,
      incomeSubtotalsByCategory,
      note: ruleset.reports.operations.note
    };
  }
  // ---- PER-TOKEN SUMMARY (opening / in / out / closing per asset) ----
  const finalHoldings = book.remaining(profile.account);
  const openingQty = {};
  for (const o of (profile.openingLots || [])) openingQty[o.asset] = (openingQty[o.asset] || 0) + o.qty;
  const disposedQty = {}, incomeQty = {}, incomeFiatByAsset = {};
  for (const d of disposals) disposedQty[d.asset] = (disposedQty[d.asset] || 0) + d.qtyOut;
  for (const i of income) {
    incomeQty[i.asset] = (incomeQty[i.asset] || 0) + i.qtyIn;
    incomeFiatByAsset[i.asset] = (incomeFiatByAsset[i.asset] || 0) + i.fmvFiat;
  }
  const closingByAsset = {}, closingValueByAsset = {};
  for (const [a, { qty }] of finalHoldings) closingByAsset[a] = qty;
  // The wealth lines can feed closing values ONLY when they are period-end
  // figures. Year-start jurisdictions (NL peildatum) value a DIFFERENT date and
  // a DIFFERENT holdings set — mixing a 1 Jan unit price with a period-end
  // quantity would corrupt the summary, so fall through to period-end pricing.
  if (wealth && !wantYearStart) {
    for (const l of wealth.lines) closingValueByAsset[l.asset] = l.valueFiat;
  } else {
    // No period-end wealth statement — still value the closing
    // holdings at the period-end price so the per-token summary is meaningful.
    for (const [a, { qty }] of finalHoldings) {
      const q = prices.price(a, fiat, refDate);
      if (q && q.fiatPerUnit > 0) closingValueByAsset[a] = round2(q.fiatPerUnit * qty);
    }
  }
  const tokenAssets = new Set([
    ...disposals.map(d => d.asset), ...income.map(i => i.asset), ...movements.map(m => m.asset),
    ...finalHoldings.keys(), ...Object.keys(openingQty)
  ]);
  const tokenSummary = [...tokenAssets].sort().map(asset => {
    const opening = openingQty[asset] || 0;
    const closing = closingByAsset[asset] || 0;
    const grossIn = book.grossIn.get(asset) || 0;
    const grossOut = book.grossOut.get(asset) || 0;
    // Reconciles exactly: opening + received − out = closing. "Out" is every
    // reduction in holdings (taxable disposals + sends to your exchange + gifts +
    // charity + fees); the taxable subset is broken out separately for reference.
    return {
      asset,
      openingQty: round4(opening),
      receivedQty: round4(grossIn - opening),
      incomeQty: round4(incomeQty[asset] || 0),
      incomeFiat: round2(incomeFiatByAsset[asset] || 0),
      disposedQty: round4(grossOut),
      taxableDisposedQty: round4(disposedQty[asset] || 0),
      closingQty: round4(closing),
      closingValueFiat: round2(closingValueByAsset[asset] || 0)
    };
  });

  // Snapshot of the unit prices and vesting ratio used to value everything, so the
  // report is auditable. PXP is worth the same as PXA (1 PXP = 1 PXA); the vesting
  // ratio maps raw chain VESTS to PXP: VESTS x ratio = PXP (e.g. 1,000,000 VESTS x
  // 0.0005 = 500 PXP = 500 PXA). It is the vesting share price (fund / shares).
  const priceSnapshot = (() => {
    const get = (a) => { const q = prices.price(a, fiat, refDate); return q && q.fiatPerUnit > 0 ? round4(q.fiatPerUnit) : null; };
    const pxa = get("PXA");
    const ratio = prices.pixaPerVest != null ? prices.pixaPerVest
        : (prices.vestingPerPxa ? 1 / prices.vestingPerPxa : null);
    return { fiat, asOf: refDate, timezone: "UTC", PXA: pxa, PXS: get("PXS"), PXP: pxa, vestingRatio: ratio != null ? round6(ratio) : null };
  })();

  // ---- TRADER STATUS — defined on every report ----
  // Declared → used as declared. Undeclared → private investor, with the
  // basis stated: Swiss safe harbour met, no disposals at all, or presumed.
  // Wherever a safe-harbour criterion is missed (declared private or not),
  // the report says what would become taxable if the canton decided the user
  // is a professional trader — computed by the engine itself, as a professional.
  captureStart(); // no event crossed the window's start: the book IS that state
  const safeHarbour = ruleset.safeHarbour && transactions && disposals.length && declaredStatus !== "professional"
      ? swissSafeHarbour({
        sh: ruleset.safeHarbour, profile, disposals, totalGainFiat: transactions.totalGainFiat, events,
        startHoldings: startHoldings || new Map(), periodStartIso, periodEndMs, prices, fiat
      })
      : null;
  let traderStatus;
  if (declaredStatus === "professional") {
    traderStatus = { status: "professional", basis: "declared" };
  } else {
    const missed = safeHarbour ? safeHarbour.missed : 0;
    traderStatus = {
      status: "private",
      basis: declaredStatus === "private" ? "declared"
          : !ruleset.safeHarbour ? "presumed"
              : !safeHarbour ? "no_disposals"
                  : missed ? "presumed" : "safe_harbour",
      missedCriteria: missed
    };
    if (missed) {
      const asPro = buildAllReports(Object.assign({}, profile, { traderStatus: "professional" }), events, year, prices,
          period, fiatOverride, { optimize: false, now: nowIso });
      const atStake = asPro && asPro.transactions ? asPro.transactions.taxableAmountFiat : null;
      traderStatus.ifProfessionalTaxableFiat = atStake;
      warnings.push(tk("components.pixa_tax_engine.trader_status_at_risk", { count: missed, amount: atStake ?? 0, fiat }));
    }
  }

  // ---- OPTIMISATION (legal levers; changes no figure above) ----
  const optimization = opts.optimize === false ? undefined : buildOptimization({
    ruleset, dedRuleset, profile, events, year, prices, period, fiatOverride, fiat, method,
    book, disposals, income, wealth, transactions, operations,
    refDate, periodStartIso, periodEndMs, startHoldings: startHoldings || new Map(),
    shortT: txShortT, longT: txLongT, nowIso, safeHarbour, traderStatus,
    taxableProceeds, flowInFiat, feeOutFiat, outboundByIntent, tokenSummary
  });

  return {
    account: profile.account,
    year,
    jurisdiction: residence.code,
    jurisdictionName: ruleset.name || residence.code,
    fiat,
    rulesVersion: ruleset.version,
    priceDataVersion: prices.version,
    priceSnapshot,
    generatedAt: nowIso,
    periodStart: periodStartDate,
    periodEnd: refDate,
    methodUsed: method,
    traderStatus,
    incomeTiming: ruleset.incomeTiming || "claim",
    assumptionNote: ruleset.assumptionNote || "",
    lossCarryforwardInFiat: Math.max(0, profile.lossCarryforwardFiat || 0),
    exemptionUsedInFiat: Math.max(0, profile.exemptionUsedFiat || 0),
    wealth,
    transactions,
    operations,
    movements,
    tokenSummary,
    offPlatformBasis,
    outboundByIntent,
    optimization,
    warnings
  };
}

/**
 * Swiss safe-harbour test for private investors (ESTV Circular No. 36, applied
 * to crypto by analogy — ESTV crypto working paper, fn. 7). Measures what the
 * ledger can: how long what was disposed of had been held, purchase + sale
 * volume against the holdings when the window opened, and — when the profile
 * gives net income (profile.netIncomeFiat) — gains against income. Debt
 * financing and derivatives cannot be seen on-chain; the user confirms those.
 * missed = measurable criteria not met (the stricter cantonal one-year
 * holding row is shown but not counted).
 */
function swissSafeHarbour({ sh, profile, disposals, totalGainFiat, events, startHoldings, periodStartIso, periodEndMs, prices, fiat }) {
  const unitAt = (asset, day) => {
    const q = prices.price(asset, fiat, day);
    return q && q.fiatPerUnit > 0 ? q.fiatPerUnit : null;
  };
  let qty = 0, qShort = 0, qStrict = 0, qUnknown = 0;
  for (const d of disposals) {
    const day = dayOfIso(d.ts);
    for (const lot of d.lots || []) {
      qty += lot.qty;
      if (!lot.acquiredTs || lot.missingBasis) { qUnknown += lot.qty; continue; }
      if (day < addUtcMonths(lot.acquiredTs, sh.holdMonths)) qShort += lot.qty;
      if (day < addUtcMonths(lot.acquiredTs, sh.strictHoldMonths)) qStrict += lot.qty;
    }
  }
  // Only on-platform holdings are known, while the test counts every security
  // and bank balance — so the real ratio is lower than the one shown.
  const startDay = dayOfIso(periodStartIso);
  let startValue = 0;
  for (const [asset, h] of startHoldings) {
    const u = unitAt(asset, startDay);
    if (u != null) startValue += h.qty * u;
  }
  const startMs = Date.parse(periodStartIso);
  let purchases = 0;
  for (const ev of events) {
    const t = Date.parse(ev.ts);
    if (t < startMs || t > periodEndMs || (ev.category !== "swap" && ev.category !== "market_fill")) continue;
    for (const leg of ev.legs) {
      if (leg.direction !== "in") continue;
      const u = unitAt(leg.asset, ev.ts);
      if (u != null) purchases += u * leg.amount;
    }
  }
  const sales = disposals.reduce((acc, d) => acc + (Number(d.proceedsFiat) || 0), 0);
  const ratio = startValue > 0 ? (sales + purchases) / startValue : null;
  const netIncome = Number(profile.netIncomeFiat);
  const gainShare = Number.isFinite(netIncome) && netIncome > 0 ? Math.max(0, totalGainFiat) / netIncome : null;
  const pct = (x) => (qty > 0 ? round2((100 * x) / qty) : 0);
  const rows = [
    { criterion: "hold", months: sh.holdMonths, value: pct(qShort), limit: 0, unit: "pct", met: qShort <= 1e-9 },
    { criterion: "hold_strict", months: sh.strictHoldMonths, value: pct(qStrict), limit: 0, unit: "pct", met: qStrict <= 1e-9 },
    { criterion: "volume", value: ratio != null ? round2(ratio) : null, limit: sh.volumeMultiple, unit: "x", met: ratio != null ? ratio <= sh.volumeMultiple : null },
    { criterion: "gains_share", value: gainShare != null ? round2(100 * gainShare) : null, limit: 100 * sh.gainsShareOfIncome, unit: "pct", met: gainShare != null ? gainShare < sh.gainsShareOfIncome : null }
  ];
  return {
    rows,
    missed: rows.filter(r => r.met === false && r.criterion !== "hold_strict").length,
    startValue, startDay, gainShare, qUnknown
  };
}

/** Effective PXP wealth-valuation discount: profile (a user's ruling) over ruleset; 0 unless 0 < d < 1. */
function pxpWealthDiscountOf(ruleset, profile) {
  const d = Number(profile.pxpWealthDiscount ?? ruleset.pxpWealthDiscount ?? 0);
  return Number.isFinite(d) && d > 0 && d < 1 ? d : 0;
}

/** Walk the jurisdiction's valuation fallback chain (e.g. CH: FTA -> platform -> cost). */
function valueAtRefDate(asset, fiat, year, refDate, qty, basisFiat, order, prices) {
  for (const src of order) {
    if (src === "fta_list") {
      // The official year-end list is an annual snapshot, keyed to the filing year.
      const q = prices.officialYearEnd(asset, fiat, year);
      if (q) return {
        unit: q.fiatPerUnit,
        source: "fta_list"
      };
    } else if (src === "platform_price") {
      const q = prices.price(asset, fiat, refDate);
      if (q && q.fiatPerUnit > 0) return {
        unit: q.fiatPerUnit,
        source: "platform_price"
      };
    } else if (src === "cost_basis") {
      if (qty > 0) return {
        unit: basisFiat / qty,
        source: "cost_basis"
      };
    }
  }
  return {
    unit: 0,
    source: "unavailable"
  };
}
const round2 = n => Math.round(n * 100) / 100;
const round4 = n => Math.round(n * 10000) / 10000;
const round6 = n => Math.round(n * 1e6) / 1e6;

// ---------------------------------------------------------------------------
// 7. OPTIMISATION — the legal levers left, read off the same ledger
// ---------------------------------------------------------------------------

/**
 * What the user can still do, within the law, to lower the tax in this report,
 * and plain statements of what does NOT lower it. Nothing here changes a
 * reported figure; the reports above stay complete. Items:
 *   { id, kind, title, detail, notes?, caveat?, rows?, savingBaseFiat?,
 *     amountFiat?, deadline? }
 *   kind  "opportunity" a lever the user controls: timing, allowances, losses,
 *                       cost-basis method, (with a ruling) staking before 31 Dec
 *         "check"       data to fix — sends still taxed by default, missing
 *                       cost, undated opening lots, the Swiss private-investor
 *                       criteria. Some of these can RAISE the figures: the
 *                       point is a report that holds up, not just a low one
 *         "fact"        a belief that does not lower tax here: powering up
 *                       before the valuation date, delaying a power-down,
 *                       staking rewards
 *         "watch"       a pending law change that would move the levers
 *   savingBaseFiat  how far the TAXABLE BASE would fall (the engine knows no
 *                   rates); null where only the rate changes (US long-term)
 *   savingKind      "exact" (re-computed through the deduction chain),
 *                   "up_to" (only if every flagged item qualifies), or
 *                   "at_stake" (unrealised gain at today's price — moves with it)
 *   amountFiat      a related amount that is not a base reduction (unused
 *                   allowance, declared-wealth reduction, ordinary offset)
 * Items are not additive — realising a loss and using an allowance interact —
 * so no grand total is offered. Texts are descriptors; numbers stay numbers,
 * dates are ISO days.
 */
const LOSS_CAVEAT = { US: "us", UK: "uk", CA: "ca", AU: "au", DE: "holding", PT: "holding" };

function buildOptimization(c) {
  const { ruleset, profile, prices, fiat, refDate, book, method } = c;
  const account = profile.account;
  const isPro = c.traderStatus ? c.traderStatus.status === "professional" : profile.professionalTrader === true;
  const nowDay = dayOfIso(c.nowIso);
  const actionable = Date.parse(c.nowIso) <= c.periodEndMs; // the window is still open
  // Unrealised figures are valued at the reference date, or today when the
  // window is still open (a live provider has no price for 31 December yet,
  // and a decision taken now is taken at today's price).
  const valDay = refDate <= nowDay ? refDate : nowDay;
  // FR / AT used to be excluded here because nothing on-chain was ever taxed
  // there; sales for money and payments in crypto are, so the levers apply.
  const gainsTaxable = isPro || !!ruleset.capitalGainsTaxableForPrivate;
  const T = (k, v) => tk(`components.pixa_tax_engine.${k}`, v);
  const unitAt = (asset, day) => {
    const q = prices.price(asset, fiat, day);
    return q && q.fiatPerUnit > 0 ? q.fiatPerUnit : null;
  };
  const holdings = book.remaining(account);
  const lotsOf = (asset) => (book.lots.get(book.key(account, asset)) || []).filter(l => l.qty > 1e-12);
  // Open lots in the order the active method would consume them next.
  const inMethodOrder = (lots) => {
    if (method === "POOL" || method === "TOTAL_AVG" || method === "PORTFOLIO") {
      const qty = lots.reduce((s, l) => s + l.qty, 0);
      return qty > 1e-12 ? [{ qty, basisFiat: lots.reduce((s, l) => s + l.basisFiat, 0), acquiredTs: null }] : [];
    }
    // Same comparator as LotBook.consume(): FIFO, LIFO, anything else HIFO.
    return [...lots].sort((a, b) => method === "FIFO" ? a.acquiredTs.localeCompare(b.acquiredTs)
        : method === "LIFO" ? b.acquiredTs.localeCompare(a.acquiredTs)
            : b.basisFiat / b.qty - a.basisFiat / a.qty);
  };
  const items = [];

  // ---- FACTS — the user's questions about staking, answered per jurisdiction ----
  const powerVariant = !isPro && ruleset.taxableOnlyOnFiatOfframp ? "offramp"
      : gainsTaxable ? "cgt"
          : ruleset.code === "ID" ? "gross" : "none";
  items.push({
    id: "power_moves_not_taxed", kind: "fact",
    title: T("opt_power_moves_title"),
    detail: T(`opt_power_moves_${powerVariant}`)
  });
  // FR / AT / PT: exchanging one crypto for another defers the tax. The
  // strongest deferral the law offers on this platform, so it is said plainly —
  // with what does trigger tax, so nobody reads it as "never taxed".
  if (ruleset.swapRollover && !isPro) {
    items.push({
      id: "exchanges_defer_tax", kind: "fact",
      title: T("opt_exchange_rollover_title"),
      detail: T(`opt_exchange_rollover_detail_${ruleset.code === "PT" ? "pt" : "generic"}`),
      caveat: ruleset.code === "PT" ? T("opt_exchange_rollover_caveat_pt") : undefined
    });
  }
  if (c.operations && c.income.length && ruleset.rewardBasis !== "zero" && ruleset.rewardIncomeTaxed !== false) {
    items.push({
      id: "rewards_taxed_on_receipt", kind: "fact",
      title: T("opt_rewards_title"),
      detail: T("opt_rewards_detail", { amount: c.operations.totalIncomeFiat, fiat }),
      amountFiat: c.operations.totalIncomeFiat
    });
  }
  // AT / PT: rewards are not taxed when received; they enter at zero cost and
  // their whole value is taxed when sold for money or spent (PT: not at all
  // once held 365 days — the hold lever below then lists them).
  if (c.operations && c.operations.deferredIncomeFiat > 0 && ruleset.rewardBasis === "zero" && gainsTaxable && !isPro) {
    items.push({
      id: "rewards_taxed_on_disposal", kind: "fact",
      title: T("opt_rewards_deferred_title"),
      detail: T(`opt_rewards_deferred_detail_${ruleset.longTermExempt ? "hold" : "generic"}`, { amount: c.operations.deferredIncomeFiat, fiat }),
      amountFiat: c.operations.deferredIncomeFiat
    });
  }
  // Claim timing: income counts when the user claims, at that day's price.
  // That is a real choice of date — and a risk when rewards sit unclaimed over
  // the period end, because a reward that can be claimed at will may be treated
  // as received when it became claimable (US: constructive receipt).
  if (c.operations && (ruleset.incomeTiming || "claim") === "claim" && ruleset.rewardBasis !== "zero"
      && ruleset.rewardIncomeTaxed !== false) {
    let pending = 0;
    for (const r of Array.isArray(profile.unclaimedRewards) ? profile.unclaimedRewards : []) {
      const u = r && Number(r.qty) > 0 ? unitAt(r.asset, valDay) : null;
      if (u != null) pending += u * Number(r.qty);
    }
    if (c.income.length || pending > 0.005) {
      items.push({
        id: "claim_timing", kind: pending > 0.005 ? "check" : "fact",
        title: T("opt_claim_timing_title"),
        detail: pending > 0.005
            ? T("opt_claim_timing_detail_pending", { amount: round2(pending), fiat, date: valDay })
            : T("opt_claim_timing_detail"),
        caveat: T(`opt_claim_timing_caveat_${ruleset.code === "US" ? "us" : "generic"}`),
        amountFiat: pending > 0.005 ? round2(pending) : undefined
      });
    }
  }
  // Income limits that take small reward income out of tax (or part of it):
  //   "freigrenze" DE §22 Nr. 3: tax-free while ALL such income stays under the limit
  //   "allowance"  UK trading and miscellaneous income allowance
  //   "rate"       FR micro-BNC flat allowance (a share of the receipts)
  // Statutory amounts in the filing currency: skipped when the report is in another.
  const ia = ruleset.incomeAllowance;
  if (ia && !isPro && fiat === ruleset.fiat && c.operations && c.operations.totalIncomeFiat > 0.005) {
    const total = c.operations.totalIncomeFiat;
    if (ia.type === "freigrenze") {
      if (total < ia.fiat) {
        const headroom = round2(Math.max(0, ia.fiat - total - 0.01));
        items.push({
          id: "income_limit", kind: "opportunity",
          title: T(`opt_income_limit_title_${ia.key}`, { limit: ia.fiat, fiat }),
          detail: T(`opt_income_limit_detail_${ia.key}`, { amount: total, limit: ia.fiat, headroom, fiat, date: refDate }),
          caveat: T(`opt_income_limit_caveat_${ia.key}`),
          savingBaseFiat: round2(total), savingKind: "up_to",
          deadline: actionable ? refDate : undefined
        });
      }
    } else {
      const covered = ia.type === "rate" ? Math.min(total, Math.max(total * ia.rate, ia.minFiat || 0)) : Math.min(total, ia.fiat);
      items.push({
        id: "income_limit", kind: "opportunity",
        title: T(`opt_income_limit_title_${ia.key}`, { limit: ia.fiat ?? Math.round(ia.rate * 100), fiat }),
        detail: T(`opt_income_limit_detail_${ia.key}`, { amount: total, covered: round2(covered), limit: ia.fiat ?? Math.round(ia.rate * 100), fiat }),
        caveat: T(`opt_income_limit_caveat_${ia.key}`),
        savingBaseFiat: round2(covered), savingKind: "up_to"
      });
    }
  }
  if (c.wealth) {
    const d = pxpWealthDiscountOf(ruleset, profile);
    const byCost = ruleset.wealthValuation[0] === "cost_basis";
    const liquid = holdings.get("PXA");
    const pxaUnit = unitAt("PXA", c.wealth.refDate);
    if (d > 0 && !byCost && liquid && pxaUnit && c.wealth.refDate >= nowDay) {
      // Only with a ruling on record: then staking before the valuation date
      // really does lower the declared value, and the user should be told.
      const amount = round2(liquid.qty * pxaUnit * d);
      items.push({
        id: "power_up_before_valuation_date", kind: "opportunity",
        title: T("opt_power_up_wealth_title", { date: c.wealth.refDate }),
        detail: T("opt_power_up_wealth_detail", { pct: round2(d * 100), qty: round4(liquid.qty), date: c.wealth.refDate, amount, fiat }),
        amountFiat: amount,
        deadline: c.wealth.refDate,
        caveat: T("opt_power_up_wealth_caveat")
      });
    } else {
      items.push({
        id: "power_up_wealth_unchanged", kind: "fact",
        title: T("opt_wealth_unchanged_title", { date: c.wealth.refDate }),
        detail: byCost
            ? T("opt_wealth_unchanged_cost")
            : T("opt_wealth_unchanged_price", { unit: pxaUnit != null ? round4(pxaUnit) : 0, fiat })
      });
    }
  }

  // ---- OPPORTUNITY: hold past the holding period ----
  // Lots still inside the period with an unrealised gain, grouped by the day
  // they qualify. "Ready" is the quantity the next disposals can use before
  // touching a short-term lot — a prefix of the method's own order, so the
  // statement is true for FIFO, LIFO and HIFO alike.
  const holdBenefit = isPro || ruleset.longTermThresholdDays == null ? null
      : ruleset.longTermExempt ? "exempt"
          : ruleset.longTermDiscountRate > 0 ? "discount"
              : gainsTaxable ? "rate" : null;
  if (holdBenefit) {
    const byKey = new Map();
    const ready = [];
    let gainSum = 0, hasPxp = false;
    for (const [asset] of holdings) {
      const unit = unitAt(asset, valDay);
      if (unit == null) continue;
      let readyQty = 0, blocked = false;
      for (const lot of inMethodOrder(lotsOf(asset))) {
        const from = longTermFrom(ruleset, lot.acquiredTs);
        if (!from) { blocked = true; continue; }
        if (valDay >= from) { if (!blocked) readyQty += lot.qty; continue; }
        blocked = true;
        if (from <= nowDay) continue;            // qualified since the reference date
        const gain = lot.qty * unit - lot.basisFiat;
        if (gain <= 0.005) continue;             // waiting only changes gains
        const k = `${from}|${asset}`;
        const r = byKey.get(k) || { date: from, asset, qty: 0, gainFiat: 0 };
        r.qty += lot.qty;
        r.gainFiat += gain;
        byKey.set(k, r);
        gainSum += gain;
        if (asset === "PXP") hasPxp = true;
      }
      if (readyQty > 1e-9) ready.push(tk("components.pixa_tax_engine.amount_asset", { amount: round4(readyQty), asset }));
    }
    const rows = [...byKey.values()]
        .sort((a, b) => a.date.localeCompare(b.date) || a.asset.localeCompare(b.asset))
        .map(r => ({ date: r.date, asset: r.asset, qty: round4(r.qty), gainFiat: round2(r.gainFiat) }));
    if (rows.length) {
      items.push({
        id: "hold_past_holding_period", kind: "opportunity",
        title: T(`opt_hold_title_${holdBenefit}`, { pct: Math.round((ruleset.longTermDiscountRate || 0) * 100) }),
        detail: T(`opt_hold_detail_${holdBenefit}`, {
          date: valDay, gain: round2(gainSum), fiat, pct: Math.round((ruleset.longTermDiscountRate || 0) * 100)
        }),
        notes: [
          ready.length ? T("opt_hold_ready", { amounts: ready, date: valDay, method }) : null,
          hasPxp ? T("opt_hold_pxp") : null
        ].filter(Boolean),
        caveat: ruleset.pendingChange === "de_crypto_reform_draft_2026" ? T("opt_hold_caveat_de") : undefined,
        savingBaseFiat: holdBenefit === "exempt" ? round2(gainSum)
            : holdBenefit === "discount" ? round2(gainSum * ruleset.longTermDiscountRate) : null,
        savingKind: holdBenefit === "rate" ? undefined : "at_stake",
        deadline: rows[0].date,
        rows
      });
    }
  }

  // ---- OPPORTUNITY: unused allowance / Freigrenze headroom (window still open) ----
  const exType = ruleset.annualExemptionType || "none";
  if (actionable && gainsTaxable && c.transactions && exType !== "none") {
    const exemption = c.dedRuleset.annualExemptionFiat || 0;
    if (exType === "allowance") {
      // Use-it-or-lose-it: the allowance does not carry forward. Losses brought
      // forward don't eat into it (UK/ZA order), so only this year's net counts.
      const avail = Math.max(0, exemption - Math.max(0, profile.exemptionUsedFiat || 0));
      const headroom = round2(Math.max(0, avail - Math.max(0, c.shortT + c.longT)));
      if (headroom > 0.005) {
        items.push({
          id: "unused_annual_allowance", kind: "opportunity",
          title: T("opt_allowance_title", { amount: headroom, fiat }),
          detail: T("opt_allowance_detail", { amount: headroom, fiat, date: refDate }),
          caveat: T(ruleset.code === "UK" ? "opt_allowance_caveat_uk" : "opt_allowance_caveat"),
          amountFiat: headroom,
          deadline: refDate
        });
      }
    } else if (exType === "proceeds_threshold") {
      // FR: the EUR 305 is a ceiling on the year's disposal PRICES. Under it,
      // nothing is taxed; one euro over, every disposal of the year is.
      const used = c.taxableProceeds + Math.max(0, profile.exemptionUsedFiat || 0);
      if (used <= exemption) {
        const headroom = round2(Math.max(0, exemption - used));
        items.push({
          id: "small_disposals_exempt", kind: "opportunity",
          title: T("opt_small_disposals_title", { amount: headroom, fiat }),
          detail: T("opt_small_disposals_detail", { used: round2(used), threshold: round2(exemption), amount: headroom, fiat, date: refDate }),
          caveat: T("opt_small_disposals_caveat"),
          amountFiat: headroom,
          deadline: refDate
        });
      }
    } else if (exType === "freigrenze") {
      // Tested on the year's own gain, before losses brought forward, and
      // together with other private-sale gains — as applyDeductions does.
      const pre = Math.max(0, c.shortT + c.longT) + Math.max(0, profile.exemptionUsedFiat || 0);
      if (pre < exemption) {
        const headroom = round2(Math.max(0, exemption - pre - 0.01));
        items.push({
          id: "freigrenze_headroom", kind: "opportunity",
          title: T("opt_freigrenze_title", { amount: headroom, fiat }),
          detail: T("opt_freigrenze_detail", { gain: round2(pre), threshold: round2(exemption), amount: headroom, fiat, date: refDate }),
          caveat: T("opt_freigrenze_caveat"),
          amountFiat: headroom,
          deadline: refDate
        });
      }
    }
  }

  // ---- OPPORTUNITY: realise losses that can still offset this period's gains ----
  // Per asset, the prefix of the method's consumption order with the deepest
  // cumulative TAXABLE loss at the reference price (FIFO cannot pick lots, so
  // the quantity includes any older lots that come first). The saving is the
  // engine's own deduction chain re-run with those losses added, so
  // allowances, discounts, inclusion rates and the Freigrenze all count.
  // Skipped where losses can't offset (IN, TH) and for JP's total average.
  // Skipped too under the French portfolio formula: a disposal there realises
  // the whole portfolio's average gain or loss, whichever token is sold, so
  // there is no loss-making lot to pick.
  if (actionable && gainsTaxable && c.transactions && ruleset.lossOffset !== "none"
      && method !== "TOTAL_AVG" && method !== "PORTFOLIO" && (c.transactions.taxableAmountFiat || 0) > 0.005) {
    let dS = 0, dL = 0;
    const rows = [];
    for (const [asset] of holdings) {
      const unit = unitAt(asset, valDay);
      if (unit == null) continue;
      let q = 0, cum = 0, cS = 0, cL = 0, best = null;
      for (const lot of inMethodOrder(lotsOf(asset))) {
        const g = lot.qty * unit - lot.basisFiat;
        const term = termOf(ruleset, lot.acquiredTs, valDay);
        q += lot.qty;
        if (lotIsTaxable(ruleset, { term, isProfessional: isPro })) {
          cum += g;
          if (term === "long") cL += g; else cS += g;
        }
        if (cum < -0.005 && (!best || cum < best.loss)) best = { qty: q, loss: cum, s: cS, l: cL };
      }
      if (best) {
        rows.push({ asset, qty: round4(best.qty), lossFiat: round2(-best.loss) });
        dS += best.s;
        dL += best.l;
      }
    }
    if (rows.length) {
      const after = applyDeductions(c.dedRuleset, profile, c.shortT + dS, c.longT + dL);
      const saving = round2(c.transactions.taxableAmountFiat - after.taxableAmountFiat);
      if (saving > 0.005) {
        items.push({
          id: "realise_losses", kind: "opportunity",
          title: T("opt_losses_title", { date: refDate }),
          detail: T("opt_losses_detail", { loss: round2(-(dS + dL)), amount: saving, fiat, date: refDate, priceDate: valDay }),
          // Lot methods cannot pick lots: say the quantity includes whatever the
          // method uses first (pooled costs need no such note). Where exchanges
          // roll the cost over, only a sale for money or a payment realises it.
          notes: [
            method === "POOL" ? null : T("opt_losses_order_note", { method }),
            ruleset.swapRollover && !isPro ? T("opt_losses_rollover_note") : null
          ].filter(Boolean),
          caveat: T(`opt_losses_caveat_${LOSS_CAVEAT[ruleset.code] || "generic"}`),
          savingBaseFiat: saving,
          savingKind: "exact",
          deadline: refDate,
          rows
        });
      }
    }
  }

  // ---- OPPORTUNITY: a cheaper cost-basis method, where the law lets the user choose ----
  if (Array.isArray(ruleset.methodChoice) && !ruleset.methodLocked && c.transactions
      && (c.transactions.taxableAmountFiat || 0) > 0.005) {
    const current = c.transactions.taxableAmountFiat;
    const rows = [{ method, taxableFiat: current, current: true }];
    for (const m of ruleset.methodChoice) {
      if (m === method) continue;
      const alt = buildAllReports(Object.assign({}, profile, { costBasisMethod: m }), c.events, c.year, prices,
          c.period, c.fiatOverride, { optimize: false, now: c.nowIso });
      const v = alt && alt.transactions ? alt.transactions.taxableAmountFiat : NaN;
      if (Number.isFinite(v)) rows.push({ method: m, taxableFiat: v });
    }
    const best = rows.reduce((b, r) => (r.taxableFiat < b.taxableFiat ? r : b), rows[0]);
    const saving = round2(current - best.taxableFiat);
    if (best.method !== method && saving > 0.005) {
      items.push({
        id: "cost_basis_method", kind: "opportunity",
        title: T("opt_method_title", { method: best.method }),
        detail: T(ruleset.code === "US" ? "opt_method_detail_us" : "opt_method_detail", { method: best.method, current: method, amount: saving, fiat }),
        savingBaseFiat: saving,
        savingKind: "exact",
        rows
      });
    }
  }

  // ---- CHECK: the Swiss private-investor criteria (gains tax-free only as one) ----
  // Measured by the engine (swissSafeHarbour); a missed criterion carries what
  // would become taxable for a professional trader as the figure at stake.
  if (c.safeHarbour && !isPro) {
    const sh = c.safeHarbour;
    const atStake = c.traderStatus && c.traderStatus.ifProfessionalTaxableFiat;
    items.push({
      id: "ch_private_investor", kind: "check",
      title: T("opt_ch_private_title"),
      detail: T(sh.missed ? "opt_ch_private_detail_missed" : "opt_ch_private_detail_met", {
        gain: round2(c.transactions.totalGainFiat), fiat, count: sh.missed
      }),
      notes: [
        sh.startValue > 0 ? T("opt_ch_private_volume_note", { date: sh.startDay }) : T("opt_ch_private_volume_unknown"),
        sh.gainShare == null ? T("opt_ch_private_income_note") : null,
        sh.qUnknown > 1e-9 ? T("opt_ch_private_unknown_note", { qty: round4(sh.qUnknown) }) : null
      ].filter(Boolean),
      caveat: T("opt_ch_private_caveat"),
      savingBaseFiat: sh.missed && atStake > 0 ? round2(atStake) : undefined,
      savingKind: sh.missed && atStake > 0 ? "at_stake" : undefined,
      rows: sh.rows
    });
  }

  // ---- CHECK (CH): costs of earning the rewards are deductible from them ----
  // ESTV crypto working paper §2.2.2: costs directly tied to earning the
  // income and needed to administer the asset are deductible from income
  // from movable assets (art. 32 al. 1 LIFD); transaction costs of buying,
  // restructuring or selling are not.
  if (ruleset.code === "CH" && c.operations && c.operations.totalIncomeFiat > 0) {
    items.push({
      id: "ch_deductible_costs", kind: "check",
      title: T("opt_ch_costs_title"),
      detail: T("opt_ch_costs_detail", { amount: c.operations.totalIncomeFiat, fiat })
    });
  }

  // ---- CHECKS: data that changes the figures ----
  if (gainsTaxable && c.transactions) {
    // Sends never classified are taxed as payments. Only some of them should
    // move: payments to other people for goods or services stay taxable.
    const explicit = profile.counterpartyIntents || {};
    const defaulted = c.disposals.filter(d => d.category === "transfer_out" && !explicit[d.counterparty]);
    const sendGain = defaulted.reduce((s, d) => s + Math.max(0, (d.shortTermGainFiat || 0) + (d.longTermGainFiat || 0)), 0);
    if (defaulted.length && sendGain > 0.005) {
      const cps = [...new Set(defaulted.map(d => d.counterparty).filter(Boolean))];
      items.push({
        id: "classify_sends", kind: "check",
        title: T("opt_sends_title", { count: defaulted.length }),
        detail: T(ruleset.charityGiftExempt ? "opt_sends_detail_charity" : "opt_sends_detail", {
          count: defaulted.length,
          accounts: cps.slice(0, 5).join(", ") + (cps.length > 5 ? ", …" : ""),
          amount: round2(sendGain), fiat
        }),
        savingBaseFiat: round2(sendGain),
        savingKind: "up_to"
      });
    }
    // Quantity sold with no cost on record is taxed as pure gain.
    let missingGain = 0;
    const missingAssets = new Set();
    for (const d of c.disposals) {
      for (const lot of d.lots || []) {
        if (lot.missingBasis && lot.taxable) { missingGain += lot.gainFiat; missingAssets.add(d.asset); }
      }
    }
    if (missingGain > 0.005) {
      items.push({
        id: "missing_cost_basis", kind: "check",
        title: T("opt_missing_basis_title"),
        detail: T("opt_missing_basis_detail", { amount: round2(missingGain), fiat, assets: [...missingAssets].join(", ") }),
        savingBaseFiat: round2(missingGain),
        savingKind: "up_to"
      });
    }
    if (ruleset.lossCarryforward !== false && !(profile.lossCarryforwardFiat > 0) && (c.transactions.taxableAmountFiat || 0) > 0.005) {
      items.push({ id: "enter_prior_losses", kind: "check", title: T("opt_prior_losses_title"), detail: T("opt_prior_losses_detail") });
    }
  }
  // Tokens received from other accounts count as purchases unless marked:
  // pay for work, team or project rewards and airdrops are income when
  // received. This check can RAISE the figures — it is here so the report
  // holds up, not to lower it.
  if (c.operations && ruleset.rewardIncomeTaxed !== false) {
    const startMs = Date.parse(c.periodStartIso);
    const explicitIn = profile.inboundIntents || {};
    const receipts = c.events.filter(ev => {
      const t = Date.parse(ev.ts);
      return ev.category === "transfer_in" && t >= startMs && t <= c.periodEndMs
          && !explicitIn[ev.counterparty] && ev.counterpartyIsOwn !== true;
    });
    let value = 0;
    for (const ev of receipts) {
      for (const leg of ev.legs) {
        if (leg.direction !== "in") continue;
        const u = unitAt(leg.asset, ev.ts);
        if (u != null) value += u * leg.amount;
      }
    }
    if (receipts.length && value > 0.005) {
      const cps = [...new Set(receipts.map(e => e.counterparty).filter(Boolean))];
      items.push({
        id: "classify_receipts", kind: "check",
        title: T("opt_receipts_title", { count: receipts.length }),
        detail: T("opt_receipts_detail", {
          accounts: cps.slice(0, 5).join(", ") + (cps.length > 5 ? ", …" : ""),
          amount: round2(value), fiat
        }),
        amountFiat: round2(value)
      });
    }
  }
  if (c.transactions && c.transactions.ordinaryIncomeOffsetFiat > 0) {
    const amount = c.transactions.ordinaryIncomeOffsetFiat;
    items.push({
      id: "loss_offsets_other_income", kind: "check",
      title: T("opt_ordinary_offset_title", { amount, fiat }),
      detail: T("opt_ordinary_offset_detail", { amount, fiat, carry: c.transactions.lossCarryforwardOutFiat }),
      amountFiat: amount
    });
  }
  // Undated opening balances are dated 1970 by the engine — read as long-held,
  // which can make their gains look tax-free. Honest dates may raise the tax.
  if (ruleset.longTermThresholdDays != null && Array.isArray(profile.openingLots)
      && profile.openingLots.some(l => l && Number(l.qty) > 0 && !l.date)) {
    items.push({
      id: "undated_opening_lots", kind: "check",
      title: T("opt_undated_title"),
      detail: T(ruleset.longTermExempt ? "opt_undated_detail_exempt" : "opt_undated_detail")
    });
  }

  // ---- OPPORTUNITY (NL): an actual return below the deemed return ----
  // Box 3 taxes a deemed return on the 1 January value. A taxpayer whose
  // ACTUAL return — income plus the change in value, realised or not — is lower
  // can be taxed on that instead (Wet tegenbewijsregeling box 3; in the return
  // itself from 2025). Read off the ledger for a finished calendar year:
  // closing value − 1 January value − what was brought in + what was taken
  // out. The test is made over ALL box 3 assets together; this is one
  // account's part of it, hence "up to".
  const deemedRate = ruleset.deemedReturn && ruleset.deemedReturn[c.year];
  if (deemedRate && c.wealth && !isPro && !actionable
      && dayOfIso(c.periodStartIso) === `${c.year}-01-01` && refDate === `${c.year}-12-31`) {
    const opening = c.wealth.totalFiat;
    const closing = (c.tokenSummary || []).reduce((s, t) => s + (Number(t.closingValueFiat) || 0), 0);
    let takenOut = c.feeOutFiat || 0;
    for (const [k, slot] of Object.entries(c.outboundByIntent || {})) if (k !== "own") takenOut += slot.valueFiat || 0;
    const actual = closing - opening - (c.flowInFiat || 0) + takenOut;
    const deemed = opening * deemedRate;
    if (opening > 0.005 && actual < deemed - 0.005) {
      items.push({
        id: "nl_actual_return", kind: "opportunity",
        title: T("opt_nl_actual_title"),
        detail: T("opt_nl_actual_detail", {
          actual: round2(actual), deemed: round2(deemed), pct: round2(deemedRate * 100), opening: round2(opening), fiat, year: String(c.year)
        }),
        caveat: T("opt_nl_actual_caveat"),
        savingBaseFiat: round2(deemed - Math.max(0, actual)),
        savingKind: "up_to"
      });
    }
  }

  // ---- CHECK (BR): the reading that keeps the R$35,000 month exempt ----
  // The report treats the holdings as held abroad (Law 14.754/2023: 15% on the
  // year's gains, no exemption). The Receita Federal has not settled how
  // self-custody is classed; if these holdings count as held in Brazil, a
  // month in which all disposals total R$35,000 or less is exempt. The figure
  // is what that reading would take out of the base — a question for the
  // contador, not a position taken here.
  if (ruleset.code === "BR" && fiat === "BRL" && c.transactions && !isPro) {
    const byMonth = new Map();
    for (const d of c.disposals) {
      const k = String(d.ts).slice(0, 7);
      const m = byMonth.get(k) || { proceeds: 0, gain: 0 };
      m.proceeds += Number(d.proceedsFiat) || 0;
      m.gain += (d.shortTermGainFiat || 0) + (d.longTermGainFiat || 0);
      byMonth.set(k, m);
    }
    let atStake = 0, months = 0;
    for (const m of byMonth.values()) {
      if (m.proceeds <= 35000 && m.gain > 0.005) { atStake += m.gain; months++; }
    }
    if (atStake > 0.005) {
      items.push({
        id: "br_domestic_reading", kind: "check",
        title: T("opt_br_domestic_title"),
        detail: T("opt_br_domestic_detail", { amount: round2(atStake), months, fiat }),
        savingBaseFiat: round2(atStake),
        savingKind: "up_to"
      });
    }
  }

  // ---- WATCH: pending law changes ----
  // ruleset.pendingChange → item. The texts say what is proposed, how far it
  // has got, and that current law is what the report applies.
  const WATCH = {
    de_crypto_reform_draft_2026: () => ({ id: "de_reform_draft", title: T("opt_watch_de_title"), detail: T("opt_watch_de_detail") }),
    us_digital_asset_tax_bill_2026: () => ({ id: "us_tax_bill", title: T("opt_watch_us_title"), detail: T("opt_watch_us_detail") }),
    uk_changes_april_2027: () => ({ id: "uk_april_2027", title: T("opt_watch_uk_title"), detail: T("opt_watch_uk_detail") }),
    jp_separate_taxation_2028: () => ({ id: "jp_separate_taxation", title: T("opt_watch_jp_title"), detail: T("opt_watch_jp_detail") }),
    kr_deferral_2029: () => ({ id: "kr_deferral", title: T("opt_watch_kr_title"), detail: T("opt_watch_kr_detail") }),
    nl_box3_actual_return_2028: () => ({ id: "nl_box3_2028", title: T("opt_watch_nl_title"), detail: T("opt_watch_nl_detail") })
  };
  const watch = WATCH[ruleset.pendingChange];
  if (watch) items.push(Object.assign({ kind: "watch" }, watch()));

  const ORDER = { opportunity: 0, check: 1, fact: 2, watch: 3 };
  items.sort((a, b) => ORDER[a.kind] - ORDER[b.kind]); // stable: insertion order within a kind
  return { asOf: refDate, fiat, actionable, items };
}

// ---------------------------------------------------------------------------
// 8. DEMO
// ---------------------------------------------------------------------------

function demoEvents(account, wallet) {
  return [
    // Prior-year acquisition so in-year disposals have basis.
    {
      id: "tx0#0",
      ts: "2024-11-02T10:00:00Z",
      account,
      wallet,
      category: "transfer_in",
      legs: [{
        asset: "PXA",
        amount: 5000,
        direction: "in"
      }],
      counterpartyIsOwn: false,
      memo: "initial buy"
    },
    // --- Reporting-year (2025) activity ---
    {
      id: "tx1#0",
      ts: "2025-02-14T08:30:00Z",
      account,
      wallet,
      category: "reward_author",
      legs: [{
        asset: "PXA",
        amount: 120,
        direction: "in"
      }, {
        asset: "PXP",
        amount: 40,
        direction: "in"
      }]
    }, {
      id: "tx2#0",
      ts: "2025-03-20T12:00:00Z",
      account,
      wallet,
      category: "reward_curation",
      legs: [{
        asset: "PXA",
        amount: 35,
        direction: "in"
      }]
    }, {
      id: "tx3#0",
      ts: "2025-04-01T09:15:00Z",
      account,
      wallet,
      category: "power_up",
      legs: [{
        asset: "PXA",
        amount: 1000,
        direction: "out"
      }, {
        asset: "PXP",
        amount: 1000,
        direction: "in"
      }]
    }, {
      id: "tx4#0",
      ts: "2025-06-10T14:45:00Z",
      account,
      wallet,
      category: "swap",
      // 800 PXA at the demo's June-2025 rate of 19.15 PXA per PXS. (It read 12
      // PXS, a rate of 66: an exchange is now booked at ONE value, so that
      // figure would show the loss it describes.)
      legs: [{
        asset: "PXA",
        amount: 800,
        direction: "out"
      }, {
        asset: "PXS",
        amount: 41.775,
        direction: "in"
      }]
    }, {
      id: "tx5#0",
      ts: "2025-07-22T11:00:00Z",
      account,
      wallet,
      category: "savings_interest",
      legs: [{
        asset: "PXA",
        amount: 6,
        direction: "in"
      }]
    }, {
      id: "tx6#0",
      ts: "2025-09-05T16:20:00Z",
      account,
      wallet,
      category: "transfer_out",
      legs: [{
        asset: "PXA",
        amount: 300,
        direction: "out"
      }],
      counterpartyIsOwn: false,
      memo: "paid a contractor"
    }, {
      id: "tx7#0",
      ts: "2025-10-18T18:00:00Z",
      account,
      wallet,
      category: "transfer_out",
      legs: [{
        asset: "PXA",
        amount: 500,
        direction: "out"
      }],
      counterpartyIsOwn: true,
      memo: "to my cold wallet"
    }];
}
// Demo only (Node): English console text, read from locales/en.js — the
// catalogue the app resolves the same descriptors from. webpackIgnore keeps
// the bundler away from this Node-only import; without it (older Node, a key
// not yet in en.js) a descriptor prints as its key.
async function demoCatalogue() {
  try {
    const { pathToFileURL } = process.getBuiltinModule("url");
    const href = new URL("../../locales/en.js", pathToFileURL(process.argv[1])).href;
    return (await import(/* webpackIgnore: true */ href)).default;
  } catch (e) {
    return null;
  }
}
function demoText(cat) {
  const get = (path) => path.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), cat);
  const say = (x) => {
    if (Array.isArray(x)) return x.map(say).join(", ");
    if (!x || typeof x !== "object" || typeof x.$t !== "string") return x == null ? "" : String(x);
    const s = cat ? get(x.$t) : undefined;
    if (typeof s !== "string") return x.$t;
    const v = x.v || {};
    return s.replace(/\{\{(\w+)\}\}/g, (m, k) => {
      if (!(k in v)) return m;
      return typeof v[k] === "number" ? v[k].toLocaleString("en-US", { maximumFractionDigits: 4 }) : say(v[k]);
    });
  };
  return say;
}
function printBundle(b, say) {
  const c = b.fiat;
  console.log(`\n=== Tax report bundle — ${b.account} — ${b.year} — ${b.jurisdiction} ===`);
  console.log(`rules=${b.rulesVersion}  prices=${b.priceDataVersion}`);
  if (b.wealth) {
    console.log(`\n[1] WEALTH @ ${b.wealth.refDate}  (${say(b.wealth.note)})`);
    for (const l of b.wealth.lines) console.log(`    ${l.asset.padEnd(4)} ${String(l.qty).padStart(9)} @ ${l.fiatPerUnit.toFixed(4)} ${c}  = ${l.valueFiat.toFixed(2)} ${c}  [${l.source}]`);
    console.log(`    TOTAL WEALTH: ${b.wealth.totalFiat.toFixed(2)} ${c}`);
  } else {
    console.log(`\n[1] WEALTH: not applicable in ${b.jurisdiction}.`);
  }
  if (b.transactions) {
    const t = b.transactions;
    console.log(`\n[2] TRANSACTIONS ${t.periodStart}..${t.periodEnd}  (${say(t.note)})`);
    for (const l of t.lines) console.log(`    ${l.ts.slice(0, 10)} ${l.category.padEnd(13)} -${l.qtyOut} ${l.asset}  proceeds ${l.proceedsFiat.toFixed(2)} - basis ${l.basisFiat.toFixed(2)} = gain ${l.gainFiat.toFixed(2)} ${c}  ${l.taxable ? "[TAXABLE]" : "[tax-free]"}`);
    console.log(`    total gain ${t.totalGainFiat.toFixed(2)} ${c} | taxable ${t.taxableGainFiat.toFixed(2)} ${c}`);
    if (t.safeHarbourCheck) console.log(`    safe-harbour: ${t.safeHarbourCheck.disposalCount} disposals — ${say(t.safeHarbourCheck.note)}`);
  }
  if (b.operations) {
    const o = b.operations;
    console.log(`\n[3] OPERATIONS ${o.periodStart}..${o.periodEnd}  (${say(o.note)})`);
    for (const l of o.lines) console.log(`    ${l.ts.slice(0, 10)} ${l.category.padEnd(15)} +${l.qtyIn} ${l.asset}  income ${l.fmvFiat.toFixed(2)} ${c}  [${l.source}]`);
    console.log(`    TOTAL INCOME: ${o.totalIncomeFiat.toFixed(2)} ${c}`);
  }
  if (b.warnings.length) {
    console.log(`\n[!] WARNINGS (${b.warnings.length}):`);
    for (const w of b.warnings) console.log(`    - ${say(w)}`);
  }
}
async function main() {
  const say = demoText(await demoCatalogue());
  const prices = new PxsAnchoredPriceProvider();
  const events = demoEvents("primerz", "primerz-main");
  const swissUser = {
    account: "primerz",
    residences: [{
      jurisdiction: "CH",
      from: "2023-01-01"
    }],
    ownWallets: ["primerz-main"],
    professionalTrader: false,
    costBasisMethod: "FIFO"
  };
  const usUser = {
    ...swissUser,
    residences: [{
      jurisdiction: "US",
      from: "2023-01-01"
    }]
  };
  printBundle(buildAllReports(swissUser, events, 2025, prices), say);
  printBundle(buildAllReports(usUser, events, 2025, prices), say);
}

// Demo runner — Node only; guarded so importing this module into the app or a
// bundler never executes it.
if (typeof process !== "undefined" && process.argv && process.argv[1] && process.argv[1].includes("pixa-tax-engine")) {
  main();
}