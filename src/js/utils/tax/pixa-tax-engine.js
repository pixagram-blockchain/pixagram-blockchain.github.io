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
 * ===========================================================================*/

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

  // PXS basket reference per fiat (Big-Mac-index style anchor). Every fiat a
  // ruleset can file in must be present — a missing key silently poisons all
  // downstream valuations for that jurisdiction (NaN basis, null gains).
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
    SGD: 7.6
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
  consume(account, asset, qty, method, ts) {
    const k = this.key(account, asset);
    const arr = this.lots.get(k) ?? [];

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
function lotIsTaxable(ruleset, ctx) {
  if (ctx.isProfessional) return true;                                 // pros: business income everywhere
  if (ruleset.taxableOnlyOnFiatOfframp) return false;                  // FR: on-chain events aren't the taxable event
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
  // Default suggestion is always "payment" (taxable) — the user deducts on purpose.
  return [...map.values()]
      .sort((a, b) => b.sends - a.sends)
      .map(e => ({ counterparty: e.counterparty, sends: e.sends, byAsset: e.byAsset, suggestedIntent: "payment" }));
}

// Turns the raw taxable GAIN into the taxable AMOUNT a rate would be applied to,
// by applying the jurisdiction's structural reliefs in a transparent, ordered way:
// carried-forward losses → long-term discount → inclusion rate → annual exemption.
// Each step's running value is returned so the report can show the derivation.
// Statutory ordering is simplified — always confirm with an adviser.
function applyDeductions(ruleset, profile, shortT, longT) {
  const discountRate = ruleset.longTermDiscountRate || 0;
  const inclusionRate = ruleset.inclusionRate ?? 1;
  const exemption = ruleset.annualExemptionFiat || 0;
  const exemptionType = ruleset.annualExemptionType || "none";
  // Japan: miscellaneous-income losses die with the year — no carryforward in
  // or out. The step below makes the dying loss visible rather than silent.
  const carryAllowed = ruleset.lossCarryforward !== false;
  const priorLoss = carryAllowed ? Math.max(0, profile.lossCarryforwardFiat || 0) : 0;
  const exemptionUsed = Math.max(0, profile.exemptionUsedFiat || 0);

  const steps = [{ label: "Taxable gain", value: round2(shortT + longT) }];
  let base = shortT + longT;
  let carryOut = 0, anyApplied = false;

  if (priorLoss > 0) {
    const applied = Math.min(priorLoss, Math.max(0, base));
    base -= applied; carryOut = priorLoss - applied; anyApplied = true;
    steps.push({ label: "After losses carried forward", value: round2(base) });
  }
  if (base < 0) {
    if (carryAllowed) carryOut += -base;
    else { steps.push({ label: "Net loss — not carried forward", value: 0 }); anyApplied = true; }
    base = 0;
  }

  // Annual allowance, extracted so jurisdictions can ORDER it: the default
  // (UK) applies it LAST, after discount and inclusion; SARS-style (ZA) sets
  // exemptionBeforeInclusion and applies it FIRST (losses → annual exclusion →
  // inclusion rate). Freigrenze (DE) is a threshold, not a deduction — it
  // stays at the end regardless.
  const applyAllowance = () => {
    if (exemptionType !== "allowance" || base <= 0) return;
    const avail = Math.max(0, exemption - exemptionUsed);
    base -= Math.min(avail, base); anyApplied = true;
    steps.push({ label: "After annual exemption", value: round2(base) });
  };
  if (ruleset.exemptionBeforeInclusion) applyAllowance();

  if (discountRate > 0 && longT > 0 && base > 0) {
    const longPortion = Math.min(base, Math.max(0, longT));
    base -= longPortion * discountRate; anyApplied = true;
    steps.push({ label: `After ${Math.round(discountRate * 100)}% long-term discount`, value: round2(base) });
  }
  if (inclusionRate !== 1 && base > 0) {
    base *= inclusionRate; anyApplied = true;
    steps.push({ label: `After ${Math.round(inclusionRate * 100)}% inclusion rate`, value: round2(base) });
  }
  if (!ruleset.exemptionBeforeInclusion) applyAllowance();
  if (exemptionType === "freigrenze" && base > 0 && base <= exemption) {
    base = 0; anyApplied = true;
    steps.push({ label: `Within ${round2(exemption)} exemption threshold`, value: 0 });
  }

  const taxableAmount = round2(Math.max(0, base));
  return { taxableAmountFiat: taxableAmount, lossCarryforwardOutFiat: round2(carryOut), steps, anyApplied };
}

/** Switzerland: wealth tax on year-end holdings; income taxable; private gains tax-free. */
const CH_RULESET = {
  code: "CH",
  giftIsDisposal: false,
  name: "Switzerland (private investor)",
  fiat: "CHF",
  version: "CH-2025.1-illustrative",
  reports: {
    wealth: {
      enabled: true,
      note: "Cantonal wealth tax on 31 Dec holdings."
    },
    transactions: {
      enabled: true,
      note: "In Switzerland, gains on privately held assets are generally tax-free for private investors (FTA Circular 36). The disposals below are listed for your records."
    },
    operations: {
      enabled: true,
      note: "Reward/interest income taxable as 'Einkommen aus beweglichem Vermögen'."
    }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: ["fta_list", "platform_price", "cost_basis"],
  defaultDisposalMethod: "FIFO",
  capitalGainsTaxableForPrivate: false,
  longTermThresholdDays: null,
  longTermExempt: false,
  taxesCryptoToCrypto: true,
  taxableOnlyOnFiatOfframp: false
};

/** United States: no wealth tax; gains & swaps taxable; short/long split at 1yr. */
const US_RULESET = {
  code: "US",
  giftIsDisposal: false,
  charityGiftExempt: true,
  name: "United States",
  fiat: "USD",
  version: "US-2026.1-illustrative",
  reports: {
    wealth: {
      enabled: false,
      note: "No federal wealth tax — report omitted."
    },
    transactions: {
      enabled: true,
      note: "Disposals and crypto-to-crypto swaps are taxable (Form 8949 / Schedule D). Lots held over one year are long-term; the split is shown below. Tax rates are not applied here — confirm with your preparer."
    },
    operations: {
      enabled: true,
      note: "Rewards are ordinary income at FMV on receipt."
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
  incomeTiming: "claim",
  capitalGainsTaxableForPrivate: true,
  longTermThresholdDays: 365,
  longTermExempt: false,
  taxesCryptoToCrypto: true,
  taxableOnlyOnFiatOfframp: false
};

/** Germany: no wealth tax; private sales (§23 EStG) taxable if held <1yr, tax-free if ≥1yr. */
const DE_RULESET = {
  code: "DE",
  giftIsDisposal: false,
  annualExemptionFiat: 1000,
  annualExemptionType: "freigrenze",
  name: "Germany (private investor)",
  fiat: "EUR",
  version: "DE-2025.1-illustrative",
  reports: {
    wealth: {
      enabled: false,
      note: "No German wealth tax — report omitted."
    },
    transactions: {
      enabled: true,
      note: "Private sales under §23 EStG: disposals (including crypto-to-crypto) are taxable as 'sonstige Einkünfte' only when the asset was held under one year; lots held one year or more are tax-free and shown as exempt below. A small annual exemption (Freigrenze) applies but is not computed here — confirm with a Steuerberater."
    },
    operations: {
      enabled: true,
      note: "Staking / lending rewards are taxable other income (§22) at value on receipt."
    }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: [],
  defaultDisposalMethod: "FIFO",
  // Income timing: German practice recognises reward income at INFLOW (Zufluss,
  // BMF guidance) — the moment the reward is credited, not when claimed. The
  // ingest layer reads this and books the accrual vop instead of the claim op.
  incomeTiming: "accrual",
  capitalGainsTaxableForPrivate: true,
  longTermThresholdDays: 365,
  longTermExempt: true,
  taxesCryptoToCrypto: true,
  taxableOnlyOnFiatOfframp: false
};

/** France: crypto-to-crypto NOT taxable; flat 30% PFU applies only on conversion to fiat. */
const FR_RULESET = {
  code: "FR",
  giftIsDisposal: false,
  name: "France (occasional investor)",
  fiat: "EUR",
  version: "FR-2025.1-illustrative",
  reports: {
    wealth: {
      enabled: false,
      note: "No wealth tax on crypto (IFI covers real estate only) — report omitted."
    },
    transactions: {
      enabled: true,
      note: "For occasional investors, crypto-to-crypto exchanges are NOT taxable events — they are shown below for your records only. The flat 30% levy (PFU) applies solely when you convert crypto to euros or spend it, computed on the whole portfolio via the official cession formula. Those fiat off-ramps happen off-platform and are not in this on-chain history — compute them separately or with an adviser."
    },
    operations: {
      enabled: true,
      note: "For occasional investors, rewards received are generally NOT taxed at receipt — they enter your portfolio at ZERO acquisition cost, and the full value is taxed at the eventual conversion to euros (via the portfolio cession formula, off-platform). The lines below are your record of what was received; none of it is counted as income here. If your activity is regular/professional, BNC treatment at receipt applies instead — confirm with an adviser."
    }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: [],
  defaultDisposalMethod: "FIFO",
  rewardBasis: "zero",
  capitalGainsTaxableForPrivate: false,
  longTermThresholdDays: null,
  longTermExempt: false,
  taxesCryptoToCrypto: false,
  taxableOnlyOnFiatOfframp: true,
  assumptionNote: "Crypto-to-crypto deferral assumes PXS qualifies as a digital asset (actif numérique), not electronic money. If PXS were recharacterised as fiat-referencing e-money, PXA→PXS conversions could become taxable cessions — an open characterisation question."
};

/** United Kingdom: no wealth tax; CGT on disposals using section-104 pooled cost. */
const UK_RULESET = {
  code: "UK",
  charityGiftExempt: true,
  annualExemptionFiat: 3000,
  annualExemptionType: "allowance",
  name: "United Kingdom",
  fiat: "GBP",
  version: "UK-2025.1-illustrative",
  methodLocked: true, // pooling is mandatory — profile method preferences do not apply
  reports: {
    wealth: {
      enabled: false,
      note: "No wealth tax — report omitted."
    },
    transactions: {
      enabled: true,
      note: "Capital Gains Tax applies to disposals, including crypto-to-crypto. Each disposal is matched per HMRC's ordering: same-day acquisitions first, then acquisitions in the following 30 days ('bed and breakfasting'), and only the remainder against the section-104 pooled average — the match columns below show the split. The annual exempt amount is applied in the deduction steps. Illustrative — confirm with an adviser."
    },
    operations: {
      enabled: true,
      note: "Staking / mining rewards are taxable (miscellaneous or trading income) at value on receipt."
    }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: [],
  defaultDisposalMethod: "POOL",
  matchingRules: "uk_sameday_30day",
  capitalGainsTaxableForPrivate: true,
  longTermThresholdDays: null,
  longTermExempt: false,
  taxesCryptoToCrypto: true,
  taxableOnlyOnFiatOfframp: false
};

/** Austria: crypto gains taxed at a flat 27.5%; crypto-to-crypto is tax-neutral. */
const AT_RULESET = {
  code: "AT",
  giftIsDisposal: false,
  name: "Austria",
  fiat: "EUR",
  version: "AT-2025.1-illustrative",
  reports: {
    wealth: { enabled: false, note: "No wealth tax — report omitted." },
    transactions: {
      enabled: true,
      note: "Since the 2022 reform, crypto gains are taxed at a flat 27.5%. Crypto-to-crypto exchanges are tax-NEUTRAL (not a realisation) — they are shown below for your records only; the charge arises when you convert to euros or spend, which happens off-platform and is not in this on-chain history. Illustrative — confirm with a Steuerberater."
    },
    operations: { enabled: true, note: "Since the 2022 reform, staking-style rewards are NOT taxed at receipt — they enter your holdings at ZERO acquisition cost, and the full value is taxed at 27.5% when later converted to euros or spent (off-platform). The lines below are your record of what was received; none of it is counted as income here. Illustrative — confirm with a Steuerberater." }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: [],
  defaultDisposalMethod: "FIFO",
  rewardBasis: "zero",
  capitalGainsTaxableForPrivate: true,
  longTermThresholdDays: null,
  longTermExempt: false,
  taxesCryptoToCrypto: false,
  taxableOnlyOnFiatOfframp: true
};

/** Netherlands: Box 3 deemed-return wealth tax on holdings; realised gains not taxed. */
const NL_RULESET = {
  code: "NL",
  giftIsDisposal: false,
  name: "Netherlands",
  fiat: "EUR",
  version: "NL-2025.1-illustrative",
  reports: {
    wealth: {
      enabled: true,
      note: "Box 3 taxes a deemed return on the value of your assets at the peildatum — 1 January of the filing year, NOT 31 December. The holdings below are your balance as of that date, valued at that date's prices; activity later in the year does not change this figure (it feeds NEXT year's peildatum instead)."
    },
    transactions: {
      enabled: true,
      note: "Realised gains are generally NOT taxed for private holders — wealth is taxed instead (Box 3, above). The disposals below are for your records. Illustrative — confirm with an adviser."
    },
    operations: { enabled: true, note: "For private holders, rewards usually fall under Box 3 wealth rather than income — confirm your situation." }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: ["platform_price", "cost_basis"],
  wealthSnapshotAt: "year_start",
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
  name: "Spain",
  fiat: "EUR",
  version: "ES-2025.1-illustrative",
  methodLocked: true, // FIFO is mandatory — profile method preferences do not apply
  reports: {
    wealth: { enabled: false, note: "Regional wealth tax (Patrimonio) may apply above high thresholds — not computed here; report omitted." },
    transactions: {
      enabled: true,
      note: "Gains are taxed in the savings base at progressive rates (19–28%). Crypto-to-crypto exchanges (permutas) ARE taxable disposals. Cost basis uses FIFO. Illustrative — confirm with an asesor; note also the Modelo 721 reporting duty."
    },
    operations: { enabled: true, note: "Rewards are taxable income at value on receipt." }
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

/** Portugal: gains on holdings <1yr taxed at 28%; holdings >=1yr exempt. */
const PT_RULESET = {
  code: "PT",
  name: "Portugal",
  fiat: "EUR",
  version: "PT-2025.1-illustrative",
  reports: {
    wealth: { enabled: false, note: "No wealth tax — report omitted." },
    transactions: {
      enabled: true,
      note: "Since 2023, gains on assets held UNDER one year are taxed at 28%; holdings of one year or more are exempt and shown as tax-free below. Crypto-to-crypto in the same category may be deferred — treatment is unsettled. Illustrative — confirm with a contabilista."
    },
    operations: { enabled: true, note: "Staking / validation rewards may be taxable income — confirm your situation." }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: [],
  defaultDisposalMethod: "FIFO",
  capitalGainsTaxableForPrivate: true,
  longTermThresholdDays: 365,
  longTermExempt: true,
  taxesCryptoToCrypto: true,
  taxableOnlyOnFiatOfframp: false
};

/** Canada: 50% inclusion rate; crypto-to-crypto a disposal; adjusted-cost-base (average). */
const CA_RULESET = {
  code: "CA",
  inclusionRate: 0.5,
  name: "Canada",
  fiat: "CAD",
  version: "CA-2025.1-illustrative",
  methodLocked: true, // ACB is mandatory — profile method preferences do not apply
  reports: {
    wealth: { enabled: false, note: "No wealth tax — report omitted." },
    transactions: {
      enabled: true,
      note: "Crypto-to-crypto exchanges are barter transactions and ARE disposals. Cost uses the adjusted cost base (average), shown below. Only 50% of net capital gains is taxable (the inclusion rate) — apply that to the figure here; this tool reports the full gain. Business-income treatment can apply to active traders. Illustrative — confirm with an accountant."
    },
    operations: { enabled: true, note: "Rewards are generally income at value on receipt (or business income) — confirm your situation." }
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
  charityGiftExempt: true,
  name: "Australia",
  fiat: "AUD",
  version: "AU-2025.1-illustrative",
  reports: {
    wealth: { enabled: false, note: "No wealth tax — report omitted." },
    transactions: {
      enabled: true,
      note: "CGT applies to disposals, including crypto-to-crypto. A 50% CGT discount applies to gains on assets held over 12 months — those appear as 'long-term' below, but the discount is NOT applied to the figures (apply it yourself to the long-term part). Illustrative — confirm with a registered tax agent."
    },
    operations: { enabled: true, note: "Staking / reward income is assessable at value on receipt." }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: [],
  defaultDisposalMethod: "FIFO",
  capitalGainsTaxableForPrivate: true,
  longTermThresholdDays: 365,
  longTermExempt: false,
  taxesCryptoToCrypto: true,
  taxableOnlyOnFiatOfframp: false
};

/** Japan: crypto gains & rewards are miscellaneous income (雑所得) at progressive rates; total-average cost basis; losses die with the year. */
const JP_RULESET = {
  code: "JP",
  name: "Japan",
  fiat: "JPY",
  version: "JP-2026.1-illustrative",
  reports: {
    wealth: { enabled: false, note: "No wealth tax — report omitted. If your total foreign-held assets exceed ¥50M on 31 December, the overseas assets report (国外財産調書) may apply — track that separately." },
    transactions: {
      enabled: true,
      note: "Gains on disposals — including crypto-to-crypto swaps — are MISCELLANEOUS INCOME (雑所得), aggregated with your other income at progressive rates (up to ~55% including inhabitant tax); there is no separate capital-gains rate and no long-term relief. Cost basis uses the TOTAL AVERAGE method (総平均法), the NTA default for individuals: every disposal in a year is priced at that year's overall average cost, so an early-year sale is affected by purchases made later the same year. If you have filed the election for the moving-average method (移動平均法), your figures will differ from this report. Losses offset other crypto gains in the SAME year only — no offset against salary or other income categories, and no carryforward. Salaried filers: total miscellaneous income of ¥200,000 or less may be exempt from income-tax filing (conditions apply; inhabitant tax is still due). Reform watch: a 20.315% flat separate-taxation regime has been proposed (targeted around 2028) but is NOT current law. Illustrative — confirm with a 税理士."
    },
    operations: { enabled: true, note: "Author, curation and interest rewards are miscellaneous income at market value when received; that value becomes the acquisition cost entering the year's total-average pool." }
  },
  categoryRules: baseCategoryRules(),
  wealthValuation: [],
  defaultDisposalMethod: "TOTAL_AVG",
  methodLocked: true,
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
  name: "Brazil",
  fiat: "BRL",
  version: "BR-2026.1-illustrative",
  reports: {
    wealth: {
      enabled: true,
      note: "The DIRPF 'Bens e Direitos' declaration lists crypto at ACQUISITION COST, not market value — the lines below are your 31 December holdings at their cost basis (source column: cost_basis), ready for the declaration (grupo 08)."
    },
    transactions: {
      enabled: true,
      note: "Holdings on Pixagram are treated as FOREIGN-held financial investments under Law 14.754/2023: realised gains — including crypto-to-crypto swaps (permuta) — are taxed at a FLAT 15% annually via the DIRPF. The R$35,000 monthly exemption does NOT apply here — it belongs to the domestic regime (crypto held in Brazil), which reverted after MP 1303/2025 lapsed in October 2025. Losses on foreign investments may offset gains from other foreign investments, including in later periods. Illustrative — confirm with a contador."
    },
    operations: { enabled: true, note: "Rewards and interest are taxable under the 15% foreign-investment regime at value on receipt; that value becomes the tokens' acquisition cost. Self-reporting: monthly IN RFB 1888 filings may apply when your volume on non-Brazilian platforms exceeds R$30,000 in a month; DeCripto expands reporting from 2026." }
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
  assumptionNote: "Treats Pixagram holdings as located ABROAD: the platform is operated by Pixa Rex S.A. (Panama) on a foreign chain — so the foreign characterisation holds under either the operator or the chain analysis. If characterised as domestic self-custody instead, the old regime (monthly R$35,000 exemption, 15–22.5% progressive rates) would apply — an open characterisation question."
};

/** South Korea: virtual-asset gains tax DEFERRED to 1 Jan 2027 — nothing taxable for individuals in 2026; this report is the cost-basis record for the transition. */
const KR_RULESET = {
  code: "KR",
  name: "South Korea",
  fiat: "KRW",
  version: "KR-2026.1-illustrative",
  reports: {
    wealth: { enabled: false, note: "No wealth tax — report omitted." },
    transactions: {
      enabled: true,
      note: "Virtual-asset gains are NOT taxable for individuals in 2026: the tax legislated in 2020 has been deferred three times and is now scheduled to start 1 January 2027 — 22% (20% income tax + 2% local) on annual gains above ₩2.5 million, with crypto-to-crypto swaps taxable under the future regime. Key implementation rules — including how acquisition prices will be set for holdings acquired before 2027 — remain undefined, and a fourth deferral has been publicly discussed but is not law. The disposals below are RECORDS, not tax lines: a complete cost-basis history is exactly what you will need when the regime starts. Illustrative — confirm with a 세무사."
    },
    operations: { enabled: true, note: "Reward and interest income treatment for individuals is still being studied by the NTS ahead of the 2027 start; nothing here is counted as taxable income, and received tokens are booked at ZERO acquisition cost (the conservative convention pending NTS rules). Each line still records the market value at receipt — keep it: it is your acquisition evidence if the final rules allow a receipt-value basis." }
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
  name: "India",
  fiat: "INR",
  version: "IN-2026.1-illustrative",
  reports: {
    wealth: { enabled: false, note: "No wealth tax — report omitted." },
    transactions: {
      enabled: true,
      note: "Income from transferring VDAs — sales AND crypto-to-crypto swaps — is taxed at a FLAT 30% (plus 4% cess and any surcharge) under §115BBH, carried forward into the Income-tax Act 2025 (effective April 2026); no holding-period relief exists. Only the cost of acquisition is deductible — no fees or other expenses. LOSSES ARE DISREGARDED ENTIRELY: a loss on one transfer cannot offset the gain on another (even the same asset) and cannot be carried forward — the taxable total below therefore sums only positive per-transfer gains, with disallowed losses shown for the record. Separately, a 1% TDS under §194S applies on transfer consideration (annual thresholds ₹50,000 / ₹10,000); on P2P and foreign platforms the BUYER must deduct and deposit it, and Schedule VDA must reconcile with Form 26AS. Illustrative — confirm with a CA."
    },
    operations: { enabled: true, note: "Rewards received without purchase (author/curation rewards, interest) are generally taxable as income from other sources at your SLAB rates at market value on receipt; that value becomes the acquisition cost for the later 30% transfer computation. Gifts of VDAs worth over ₹50,000 from non-relatives are taxable for the recipient." }
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
  name: "Singapore",
  fiat: "SGD",
  version: "SG-2026.1-illustrative",
  reports: {
    wealth: { enabled: false, note: "No wealth tax — report omitted. IRAS expects transaction records to be kept for five years." },
    transactions: {
      enabled: true,
      note: "Singapore has no capital gains tax: disposals of tokens held as personal investments — including crypto-to-crypto swaps — are generally NOT taxable, and the lines below are records. The exception is activity amounting to a TRADE under IRAS's badges-of-trade factors (frequency, volume, holding periods, organisation, intent): business-classified trading is taxable at income rates — this report treats gains as taxable if you enable professional/trader status. FIFO and weighted-average cost are both accepted by IRAS; LIFO is not. Illustrative — confirm with a tax adviser."
    },
    operations: { enabled: true, note: "Whether rewards are taxable in Singapore is FACT-SPECIFIC: tokens earned for providing something (content-creation rewards can resemble payment for services) or through business-like activity are income at market value on receipt, while casual hobby-level receipts and pure windfalls (airdrops without services) are generally not. IRAS has no standalone staking rule. The totals below are your market-value record at receipt — whether they are declarable depends on your classification; confirm with a tax adviser." }
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
  name: "United Arab Emirates",
  fiat: "AED",
  version: "AE-2026.1-illustrative",
  reports: {
    wealth: { enabled: false, note: "No wealth tax — report omitted." },
    transactions: {
      enabled: true,
      note: "The UAE levies no personal income tax: disposals — including crypto-to-crypto swaps — are NOT taxable for individuals investing in a personal capacity, and the lines below are records. The exception is activity that constitutes a BUSINESS: natural persons whose business turnover exceeds AED 1 million fall within the 9% Corporate Tax regime — this report treats gains as taxable if you enable professional/trader status. Crypto transfers are VAT-exempt (Cabinet Decision 100/2024, retroactive to 2018). Illustrative — confirm with a tax adviser."
    },
    operations: { enabled: true, note: "Rewards and interest received by individuals acting in a personal capacity are not subject to personal income tax; the lines below are your market-value record at receipt (useful as cost evidence, and if another jurisdiction's rules ever apply). Business-classified activity falls under Corporate Tax instead — confirm your situation." }
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
  name: "Hong Kong",
  fiat: "HKD",
  version: "HK-2026.1-illustrative",
  reports: {
    wealth: { enabled: false, note: "No wealth tax — report omitted." },
    transactions: {
      enabled: true,
      note: "Hong Kong has no capital gains tax: disposals of tokens held as capital investments — including crypto-to-crypto swaps — are NOT chargeable, and the lines below are records. Gains that are REVENUE in nature — from a trade or business of dealing in digital assets carried on in Hong Kong (badges of trade; IRD guidance in DIPN 39) — are chargeable to profits tax instead; this report treats gains as taxable if you enable professional/trader status. The territorial source principle can also carve out offshore profits — fact-specific. Illustrative — confirm with a tax adviser."
    },
    operations: { enabled: true, note: "Whether rewards are chargeable in Hong Kong is FACT-SPECIFIC: tokens earned through a business, or as payment for services, are taxable receipts at market value; casual hobby-level receipts are generally not chargeable. The totals below are your market-value record at receipt — whether they are declarable depends on your classification; confirm with a tax adviser." }
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
  name: "New Zealand",
  fiat: "NZD",
  version: "NZ-2026.1-illustrative",
  reports: {
    wealth: { enabled: false, note: "No wealth tax — report omitted." },
    transactions: {
      enabled: true,
      note: "New Zealand has no general capital gains tax, but Inland Revenue's position is that cryptoassets are typically ACQUIRED FOR THE PURPOSE OF DISPOSAL — which makes the gain on every disposal (including crypto-to-crypto swaps) taxable as ordinary INCOME at marginal rates, with no holding-period relief. The presumption is rebuttable only in narrow cases (tokens genuinely acquired to use, not to sell). Losses on revenue-account cryptoassets are generally deductible. NOTE: the NZ tax year runs 1 APRIL – 31 MARCH — set the date range to your tax year rather than the calendar year. Illustrative — confirm with a tax adviser."
    },
    operations: { enabled: true, note: "Author, curation and interest rewards are taxable income at market value when received; that value becomes the tokens' cost base. IRD accepts FIFO or weighted-average cost where specific identification is impossible." }
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
  annualExemptionFiat: 40000,
  annualExemptionType: "allowance",
  exemptionBeforeInclusion: true, // SARS ordering: losses → annual exclusion → 40% inclusion
  name: "South Africa",
  fiat: "ZAR",
  version: "ZA-2026.1-illustrative",
  reports: {
    wealth: {
      enabled: true,
      note: "No wealth tax, but the ITR12 statement of assets and liabilities lists year-end holdings at COST — the lines below are your holdings at cost basis (source column: cost_basis), ready for that statement. NOTE: the SA tax year runs 1 MARCH – END FEBRUARY; set the date range accordingly."
    },
    transactions: {
      enabled: true,
      note: "SARS treats crypto as intangible assets: for CAPITAL-nature holdings, disposals — including crypto-to-crypto swaps — produce capital gains; the deduction steps below apply the R40,000 annual exclusion FIRST and then the 40% inclusion rate (SARS ordering), so the taxable amount is what enters your income at marginal rates (maximum effective 18%). From the 2027 tax year (disposals on or after 1 March 2026) the exclusion rises to R50,000 — this report uses R40,000, the conservative figure; adjust with your adviser. REVENUE-nature activity (frequent trading, profit-scheme intent) is instead taxed IN FULL at income rates — this report treats gains that way if you enable professional/trader status. Losses offset gains and carry forward. NOTE: the SA tax year runs 1 MARCH – END FEBRUARY — set the date range to your tax year, not the calendar year. Illustrative — confirm with a tax practitioner."
    },
    operations: { enabled: true, note: "Rewards and interest are gross income at market value on receipt; that value becomes the base cost for the later disposal computation." }
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
  name: "Mexico",
  fiat: "MXN",
  version: "MX-2026.1-illustrative",
  reports: {
    wealth: { enabled: false, note: "No wealth tax — report omitted." },
    transactions: {
      enabled: true,
      note: "Mexico has no dedicated crypto tax regime: the SAT applies the general Income Tax Law, under which disposals of assets ('enajenación de bienes') — including crypto-to-crypto swaps, which are barter (permuta) — produce taxable gains at progressive rates up to 35%, declared in the annual return. Losses from disposals may be creditable against similar gains under conditions (with a limited carryforward) — not computed here. Several details are UNSETTLED in the absence of specific SAT guidance; this report takes the conservative reading. Illustrative — confirm with a contador."
    },
    operations: { enabled: true, note: "Rewards and interest are taxable income at market value on receipt; that value becomes the acquisition cost for the later disposal computation." }
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
  name: "Argentina",
  fiat: "ARS",
  version: "AR-2026.1-illustrative",
  methodLocked: true, // the LIG regulatory decree mandates oldest-first costing for digital currencies — FIFO is enforced
  reports: {
    wealth: {
      enabled: true,
      note: "ARCA's criterion (Dictamen DI ALIR 2/2022) is that crypto ARE financial assets within the Bienes Personales base — the intangibles exemption does not apply (part of the doctrine disputes this). Valuation follows the fisco's rule: ACQUISITION COST plus applicable updates/FX differences to 31 December, NOT market value — the lines below are your 31 December holdings at cost basis (source column: cost_basis). Taxpayers who prepaid under the REIBP regime are outside the annual tax; the mínimo no imponible and rates are not computed here. Illustrative — confirm with a contador."
    },
    transactions: {
      enabled: true,
      note: "For individuals, gains on disposals of digital currencies — including crypto-to-crypto swaps — are taxed at a FLAT 15%: Pixagram holdings are treated as FOREIGN-SOURCE (foreign chain, foreign operator), where 15% applies in all cases (art. 94); Argentine-source sales in pesos without an adjustment clause would instead fall under the 5% cedular rate (art. 98 inc. a). Cost basis is OLDEST-FIRST by regulation — this report enforces FIFO. Figures are NOMINAL: with high inflation, nominal ARS gains can overstate real ones — whether indexation applies to your operations is for your adviser. Losses (quebrantos) are specific: they offset only gains of the same kind and source, with a five-year carryforward. Illustrative — confirm with a contador."
    },
    operations: { enabled: true, note: "Rewards and interest are taxable income at market value on receipt (interest-type yields under art. 48); that value becomes the acquisition cost for the later 15% computation." }
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
  assumptionNote: "Treats Pixagram holdings as FOREIGN-source for the 15% rate (art. 94): the chain and the Panamanian operator are outside Argentina. If characterised as Argentine-source instead, peso sales without an adjustment clause would fall under the 5% cedular rate (art. 98 inc. a) — an open characterisation question."
};

/** Thailand: the 2025–2029 exemption covers ONLY Thai SEC-licensed operators — foreign-platform gains stay taxable at progressive rates; losses here don't offset; remittance timing applies. */
const TH_RULESET = {
  code: "TH",
  name: "Thailand",
  fiat: "THB",
  version: "TH-2026.1-illustrative",
  reports: {
    wealth: { enabled: false, note: "No wealth tax — report omitted. Keep transaction records for five years." },
    transactions: {
      enabled: true,
      note: "Gains on disposals — including crypto-to-crypto swaps — are assessable income at progressive rates (5–35%). The five-year exemption (Ministerial Regulation No. 399: 1 Jan 2025 – 31 Dec 2029) applies ONLY to transfers through Thai SEC-LICENSED exchanges, brokers or dealers — Pixagram is not one, so NOTHING in this report qualifies. Loss offsetting is likewise reserved for licensed-exchange trades: losses here are DISREGARDED — the taxable total sums only positive per-disposal gains, with disallowed losses shown for the record. For Thai residents, activity on a foreign platform is generally FOREIGN-SOURCE income, assessable when REMITTED to Thailand (remittance-timing rules have been changing since 2024) — this report computes gains on an arising basis; the remittance question is separate. Illustrative — confirm with a Thai tax adviser."
    },
    operations: { enabled: true, note: "Author, curation and interest rewards are ordinary assessable income at market value on receipt — reward income is NOT covered by the licensed-exchange exemption even where that exemption applies. The receipt value becomes the tokens' acquisition cost." }
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
  name: "Israel",
  fiat: "ILS",
  version: "IL-2026.1-illustrative",
  reports: {
    wealth: { enabled: false, note: "No wealth tax — report omitted." },
    transactions: {
      enabled: true,
      note: "The Tax Authority treats crypto as an ASSET (Circular 05/2018): disposals — including crypto-to-crypto swaps — are capital gains taxed at 25% for individuals, computed on the REAL gain (the inflationary component is exempt — the figures below are NOMINAL; the indexation adjustment is not computed here). High incomes add surtax (the 3% yisuf, plus the additional 2% on capital-source income above the threshold since 2025). Business-nature dealing is taxed at marginal rates instead — this report treats gains that way if you enable professional/trader status. Capital losses offset capital gains and carry forward. Report on Form 1399 with the annual return. Illustrative — confirm with a רואה חשבון."
    },
    operations: { enabled: true, note: "Rewards and interest are taxable income at market value on receipt (business vs miscellaneous classification is fact-specific); that value becomes the acquisition cost for the later capital-gain computation." }
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
  name: "Indonesia",
  fiat: "IDR",
  version: "ID-2026.1-illustrative",
  reports: {
    wealth: {
      enabled: true,
      note: "No wealth tax, but the annual SPT's asset list (daftar harta) declares holdings at ACQUISITION COST — the lines below are your 31 December holdings at cost basis (source column: cost_basis), ready for the declaration."
    },
    transactions: {
      enabled: true,
      note: "Since PMK 50/2025 (1 August 2025), crypto is a financial asset and seller-side tax is a FINAL income tax on the GROSS transaction value — NOT on the gain: 0.21% through registered domestic platforms (withheld), and 1% through FOREIGN or unregistered platforms, SELF-assessed and paid by the seller where no collector is appointed. Pixagram is a foreign platform, so the 1% self-assessment applies to disposals here, INCLUDING crypto-to-crypto swaps. The gain/loss figures below are therefore RECORDS (no gains tax applies); the jurisdiction annex totals your monthly gross proceeds with the indicative 1%. VAT no longer applies to the crypto transfer itself. Illustrative — confirm with a konsultan pajak."
    },
    operations: { enabled: true, note: "Platform rewards and interest are not the 'crypto sale' the final tax targets — general income-tax rules likely apply at market value on receipt (fact-specific; social-platform rewards are not squarely addressed). Each line records the market value at receipt — keep it as acquisition evidence; confirm with a konsultan pajak." }
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
  name: "Nigeria",
  fiat: "NGN",
  version: "NG-2026.1-illustrative",
  reports: {
    wealth: { enabled: false, note: "No wealth tax — report omitted." },
    transactions: {
      enabled: true,
      note: "Under the Nigeria Tax Act 2025 (effective 1 January 2026), chargeable assets EXPRESSLY include digital and virtual assets (s.34): gains on disposals — including crypto-to-crypto swaps — are taxable for individuals at the PROGRESSIVE personal rates (top 25%; the first ₦800,000 band of total annual income is exempt), replacing the flat 10% digital-assets CGT that applied through 2025. Residents are taxable on WORLDWIDE gains whether or not the proceeds are brought into Nigeria. Loss-relief mechanics under the new Act are still being clarified — this report nets losses within your crypto activity; confirm the treatment. Illustrative — confirm with a tax adviser."
    },
    operations: { enabled: true, note: "The Act brings digital-asset income and non-traditional income into the tax net: rewards and interest are taxable income at market value on receipt; that value becomes the acquisition cost for the later gains computation." }
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
      const intent = (profile.counterpartyIntents && profile.counterpartyIntents[ev.counterparty]) || "payment";
      const isDisposalIntent = intent === "payment"
          || (intent === "gift" && giftIsDisposal)
          || (intent === "charity" && !charityExempt);
      if (!isDisposalIntent) continue;
    }
    if (ev.category === "transfer_in" && ev.counterpartyIsOwn === true) continue;

    for (const leg of ev.legs) {
      if (leg.direction === "out" && rule.realizesDisposal) {
        const arr = disposalsByAsset.get(leg.asset) || [];
        arr.push({ id: ev.id, ts: ev.ts, day: dayMs(ev.ts), qty: leg.amount });
        disposalsByAsset.set(leg.asset, arr);
      } else if (leg.direction === "in" && (rule.income === "ordinary_income" || rule.acquisitionAtFmv)) {
        const q = prices.price(leg.asset, fiat, ev.ts);
        const unitBasis = q && q.fiatPerUnit > 0 ? q.fiatPerUnit : 0;
        const arr = acqsByAsset.get(leg.asset) || [];
        arr.push({ id: ev.id, ts: ev.ts, day: dayMs(ev.ts), qty: leg.amount, unitBasis, remainingQty: leg.amount });
        acqsByAsset.set(leg.asset, arr);
      }
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
    for (let pass = 0; pass < 8; pass++) { // fixed point for cross-asset link costs
      for (const a of assets) {
        const o = open.get(a) || { qty: 0, cost: 0 };
        const d = yd.byAsset.get(a) || { acqQty: 0, acqCost: 0, outQty: 0, tInQty: 0 };
        let linkCost = 0;
        for (const L of yd.links) if (L.to === a) linkCost += (avg.get(L.from) ?? 0) * L.qtyOut * L.frac;
        const q = o.qty + d.acqQty + d.tInQty;
        avg.set(a, q > 1e-12 ? (o.cost + d.acqCost + linkCost) / q : 0);
      }
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
    for (const i of ins) {
      if (rule.income === "ordinary_income") {
        const v = zeroBasis ? 0 : prices.price(i.asset, fiat, ev.ts).fiatPerUnit * i.amount;
        const A = acc(yd, i.asset);
        A.acqQty += i.amount;
        A.acqCost += v;
      } else if (rule.acquisitionAtFmv) {
        const A = acc(yd, i.asset);
        A.acqQty += i.amount;
        A.acqCost += prices.price(i.asset, fiat, ev.ts).fiatPerUnit * i.amount;
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
  const atYearEnd = profile.residences.find(r => onOrBefore(r.from, refEnd) && (!r.to || !onOrBefore(r.to, `${year}-01-01`)));
  if (!atYearEnd) return null;
  const touchingYear = profile.residences.filter(r => onOrBefore(r.from, refEnd) && (!r.to || new Date(r.to).getUTCFullYear() >= year));
  return {
    code: atYearEnd.jurisdiction,
    midYearMove: touchingYear.length > 1
  };
}
export function buildAllReports(profile, events, year, prices, period, fiatOverride) {
  const warnings = [];
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
      warnings: ["No tax residence on record for this year — cannot classify. Add a residence period."]
    };
  }
  if (residence.midYearMove) {
    warnings.push("Residence changed during the year — wealth tax is pro-rated from the arrival date; review manually.");
  }
  const ruleset = RULESETS[residence.code];
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

  const ordered = [...events].sort((a, b) => a.ts.localeCompare(b.ts));
  for (const ev of ordered) {
    if (wantYearStart && !snapshotHoldings && Date.parse(ev.ts) >= snapshotBoundaryMs) captureSnapshot();
    // Lots must reflect full history, but only events up to the ref date matter
    // for this window's holdings, and only in-scope events appear in the reports.
    if (Date.parse(ev.ts) > periodEndMs) continue;
    if (!profile.ownWallets.includes(ev.wallet)) {
      warnings.push(`Event ${ev.id}: wallet ${ev.wallet} is not tagged as yours — confirm ownership.`);
    }
    // Inbound from your own wallet is an internal move — no new basis event.
    if (ev.counterpartyIsOwn === true && ev.category === "transfer_in") continue;

    // Outbound transfers: whether a send is a taxable disposal depends on INTENT
    // (who/why), which the user supplies via a counterparty map. Unlabelled sends
    // default to a third-party payment = disposal (the conservative case).
    if (ev.category === "transfer_out") {
      // Default is ALWAYS a taxable payment — the conservative, audit-safe floor.
      // The user must actively reclassify a send (own wallet, exchange, gift,
      // charity) to make it non-taxable; nothing is deducted automatically.
      const intent = (profile.counterpartyIntents && profile.counterpartyIntents[ev.counterparty]) || "payment";
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
          if (inScope(ev.ts)) movements.push({
            id: ev.id, block: ev.block, ts: ev.ts, kind: intent === "charity" ? "charity_donation" : "gift_out",
            note: (ev.memo ? ev.memo + " · " : "") + (intent === "charity"
                ? "charitable donation — no gain realised here"
                : "gift — not a disposal here; basis carries to the recipient"),
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
        }
      }
      if (DISPLAY_ONLY) continue;          // display-only → skip the tax dispatch
      // power-up / power-down fall through to the POWER rule for the basis carry.
    }

    const rule = ruleset.categoryRules[ev.category];
    const outLegs = ev.legs.filter(l => l.direction === "out");
    const inLegs = ev.legs.filter(l => l.direction === "in");
    const isProfessional = profile.professionalTrader === true;
    let carryBasis = 0;
    const carryLots = []; // consumed lots (qty, basisFiat, acquiredTs) to re-seed on the in-leg(s)

    // ---- OUT legs ----
    const isSwap = inLegs.length > 0; // crypto-to-crypto (has an in-leg) vs plain transfer-out
    for (const outLeg of outLegs) {
      if (rule.realizesDisposal) {
        const unit = prices.price(outLeg.asset, fiat, ev.ts);
        const proceeds = unit.fiatPerUnit * outLeg.amount;

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
            ? book.consume(profile.account, outLeg.asset, poolQty, method, ev.ts)
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

        // Classify each consumed lot by holding period and taxability, and split
        // the gain into short-term / long-term / exempt buckets accordingly.
        const unitProceeds = outLeg.amount > 0 ? proceeds / outLeg.amount : 0;
        const lotDetail = [];
        let shortGain = 0, longGain = 0, exemptGain = 0, coveredQty = 0;
        for (const cl of consumedLots) {
          const lotProceeds = unitProceeds * cl.qty;
          const lotGain = lotProceeds - cl.basisFiat;
          const heldDays = cl.acquiredTs
              ? Math.floor((Date.parse(ev.ts) - Date.parse(cl.acquiredTs)) / 86400000)
              : null;
          let term;
          if (ruleset.longTermThresholdDays == null) term = "n/a";
          else if (heldDays != null && heldDays >= ruleset.longTermThresholdDays) term = "long";
          else term = "short";
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
        const uncovered = outLeg.amount - coveredQty;
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
        const gainUn = proceeds - basisFiat;
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
            qtyOut: outLeg.amount,
            proceedsFiat: round2(proceeds),
            basisFiat: round2(basisFiat),
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
            lots: lotDetail
          });
        }
      } else if (rule.income === "non_taxable_transfer") {
        const {
          basisFiat,
          consumedLots
        } = book.consume(profile.account, outLeg.asset, outLeg.amount, method, ev.ts);
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
    const inValueTotal = inValues.reduce((s, v) => s + v, 0) || 1;
    inLegs.forEach((inLeg, i) => {
      if (rule.income === "ordinary_income") {
        const unit = prices.price(inLeg.asset, fiat, ev.ts);
        const value = unit.fiatPerUnit * inLeg.amount;
        // rewardBasis "fmv" (default): income at FMV on receipt; the lot enters
        // at that FMV. rewardBasis "zero" (FR occasional / AT post-2022 current
        // income): NOT taxed at receipt — the lot enters at ZERO basis and the
        // whole value is taxed later, at the (off-platform) fiat cession. The
        // line still appears in the report, flagged, so the user has the record.
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
        // UK matching: same reservation as the income path — claimed quantity
        // bypasses the pool, the rest pools at FMV.
        const reserved = Math.min(inLeg.amount, matchPlan.reservedQty.get(ev.id) || 0);
        const poolable = inLeg.amount - reserved;
        if (reserved > 1e-12) matchPlan.reservedQty.set(ev.id, (matchPlan.reservedQty.get(ev.id) || 0) - reserved);
        if (poolable > 1e-12) {
          book.acquire(profile.account, inLeg.asset, poolable, unit.fiatPerUnit * poolable, ev.ts);
        }
      } else if (rule.income === "non_taxable_transfer") {
        const frac = inValues[i] / inValueTotal; // this leg's FMV share of the transfer
        if (carryLots.length) {
          // Re-seed each carried lot pro-rata into this in-leg, keeping its
          // ORIGINAL acquisition date so holding periods survive power-up/down
          // and savings moves. Quantities are rescaled to the in-leg's units
          // (e.g. PXA→PXP), basis is allocated by the lot's share of the carry.
          const carryQtyTotal = carryLots.reduce((s, l) => s + l.qty, 0) || 1;
          for (const cl of carryLots) {
            const share = cl.qty / carryQtyTotal;      // lot's share of what was consumed
            const qty = inLeg.amount * share;          // same share of this leg's units
            if (qty <= 0) continue;
            book.acquire(
                profile.account, inLeg.asset, qty,
                cl.basisFiat * frac,                     // lot's basis, scaled to this leg's FMV split
                cl.acquiredTs || ev.ts                   // POOL lots carry no date — fall back to now
            );
          }
        } else {
          const alloc = carryBasis * frac; // no lot detail — legacy basis-only carry
          book.acquire(profile.account, inLeg.asset, inLeg.amount, alloc, ev.ts);
        }
      }
    });
  }
  for (const a of seenAssetsMissingBasis) {
    warnings.push(`${a}: more ${a} was sent or swapped out than the fetched history shows you acquiring. The unmatched amount is treated as having zero purchase cost, which makes the reported gain too high. If you already held ${a} before this account's earliest transaction, set an opening balance and its cost to correct it.`);
  }
  if (offPlatformBasis.length) {
    const byAsset = {};
    for (const m of offPlatformBasis) byAsset[m.asset] = (byAsset[m.asset] || 0) + m.qty;
    const parts = Object.entries(byAsset).map(([a, q]) => `${round4(q)} ${a}`).join(", ");
    warnings.push(`You moved ${parts} to an account marked as your own exchange. That move is not taxed here, but the eventual SALE on the exchange is a taxable disposal that happens off-platform and is not in this history. The cost basis that left the chain is listed so you can carry it into your exchange records.`);
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
      warnings.push(`The Box 3 peildatum is statutory (1 January ${year}) and does not follow the selected date range — the wealth statement is valued at ${peildatum} regardless of the report period.`);
    }
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
        warnings.push(`${asset}: no ${wantYearStart ? "peildatum" : "year-end"} value could be determined — wealth line omitted.`);
        continue;
      }
      lines.push({
        asset,
        qty: round4(qty),
        fiatPerUnit: round4(unit),
        valueFiat: round2(unit * qty),
        source
      });
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
    const ded = applyDeductions(ruleset, profile, shortT, longT);
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
      splitByTerm: ruleset.longTermThresholdDays != null,
      costBasisMethod: method,
      safeHarbourCheck: residence.code === "CH" ? {
        disposalCount: disposals.length,
        note: "This tax-free treatment assumes you count as a private investor rather than a professional trader. FTA Circular 36 decides that using five combined tests — how long you hold, how much you trade, how much of your income comes from trading, whether you use borrowed money, and whether you use derivatives. Those need your whole portfolio (not just this account), so this tool can't confirm them — treat the tax-free status as likely, not certain."
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

  return {
    account: profile.account,
    year,
    jurisdiction: residence.code,
    jurisdictionName: ruleset.name || residence.code,
    fiat,
    rulesVersion: ruleset.version,
    priceDataVersion: prices.version,
    priceSnapshot,
    generatedAt: new Date().toISOString(),
    periodStart: periodStartDate,
    periodEnd: refDate,
    methodUsed: method,
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
    warnings
  };
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
// 7. DEMO
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
      legs: [{
        asset: "PXA",
        amount: 800,
        direction: "out"
      }, {
        asset: "PXS",
        amount: 12,
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
function printBundle(b) {
  const c = b.fiat;
  console.log(`\n=== Tax report bundle — ${b.account} — ${b.year} — ${b.jurisdiction} ===`);
  console.log(`rules=${b.rulesVersion}  prices=${b.priceDataVersion}`);
  if (b.wealth) {
    console.log(`\n[1] WEALTH @ ${b.wealth.refDate}  (${b.wealth.note})`);
    for (const l of b.wealth.lines) console.log(`    ${l.asset.padEnd(4)} ${String(l.qty).padStart(9)} @ ${l.fiatPerUnit.toFixed(4)} ${c}  = ${l.valueFiat.toFixed(2)} ${c}  [${l.source}]`);
    console.log(`    TOTAL WEALTH: ${b.wealth.totalFiat.toFixed(2)} ${c}`);
  } else {
    console.log(`\n[1] WEALTH: not applicable in ${b.jurisdiction}.`);
  }
  if (b.transactions) {
    const t = b.transactions;
    console.log(`\n[2] TRANSACTIONS ${t.periodStart}..${t.periodEnd}  (${t.note})`);
    for (const l of t.lines) console.log(`    ${l.ts.slice(0, 10)} ${l.category.padEnd(13)} -${l.qtyOut} ${l.asset}  proceeds ${l.proceedsFiat.toFixed(2)} - basis ${l.basisFiat.toFixed(2)} = gain ${l.gainFiat.toFixed(2)} ${c}  ${l.taxable ? "[TAXABLE]" : "[tax-free]"}`);
    console.log(`    total gain ${t.totalGainFiat.toFixed(2)} ${c} | taxable ${t.taxableGainFiat.toFixed(2)} ${c}`);
    if (t.safeHarbourCheck) console.log(`    safe-harbour: ${t.safeHarbourCheck.disposalCount} disposals — ${t.safeHarbourCheck.note}`);
  }
  if (b.operations) {
    const o = b.operations;
    console.log(`\n[3] OPERATIONS ${o.periodStart}..${o.periodEnd}  (${o.note})`);
    for (const l of o.lines) console.log(`    ${l.ts.slice(0, 10)} ${l.category.padEnd(15)} +${l.qtyIn} ${l.asset}  income ${l.fmvFiat.toFixed(2)} ${c}  [${l.source}]`);
    console.log(`    TOTAL INCOME: ${o.totalIncomeFiat.toFixed(2)} ${c}`);
  }
  if (b.warnings.length) {
    console.log(`\n[!] WARNINGS (${b.warnings.length}):`);
    for (const w of b.warnings) console.log(`    - ${w}`);
  }
}
function main() {
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
  printBundle(buildAllReports(swissUser, events, 2025, prices));
  printBundle(buildAllReports(usUser, events, 2025, prices));
}

// Demo runner — Node only; guarded so importing this module into the app or a
// bundler never executes it.
if (typeof process !== "undefined" && process.argv && process.argv[1] && process.argv[1].includes("pixa-tax-engine")) {
  main();
}