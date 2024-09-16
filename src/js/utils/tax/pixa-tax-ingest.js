/* =============================================================================
 * dpixa -> TaxEvent ingestion adapter
 *
 * Bridges @pixagram/dpixa (your dhive-derived Pixa RPC client) into the
 * canonical TaxEvent[] consumed by pixa-tax-engine.ts.
 *
 * IMPORTANT: I could not load the @pixagram/dpixa README (npm blocks bots and
 * its repo didn't surface in search), so this is written against the STANDARD
 * Hive/dhive account-history operation shapes a fork inherits. Everything
 * Pixa-specific is isolated in IngestConfig below — confirm against one real
 * `get_account_history` response and adjust the maps. The op -> event mapping
 * itself is chain-agnostic and is the part you keep regardless.
 *
 * In your repo: `import type { TaxEvent } from "./pixa-tax-engine"` and delete
 * the re-declared types here. They are inlined only so this file runs stand-alone.
 * ===========================================================================*/

// ---- shared types (mirror pixa-tax-engine.ts) -----------------------------

/**
 * Boundary realm — does value stay inside the Pixa ecosystem, or cross out of it?
 * This single axis drives four downstream decisions: which price source is
 * authoritative, whether the move realizes a gain, where cost basis originates,
 * and whether it is in scope for CARF/DAC8 cross-border reporting.
 */

// fiat on-ramp / off-ramp gateway

// ---------------------------------------------------------------------------
// CONFIG  — the only Pixa-specific surface. CONFIRM these against real data.
// ---------------------------------------------------------------------------

export function defaultConfig(account) {
  return {
    account,
    ownAccounts: [account],
    symbolMap: {
      PXA: "PXA",
      PIXA: "PXA",
      TESTS: "PXA",
      PXS: "PXS",
      TBD: "PXS",
      PXP: "PXP",
      PP: "PXP",
      VESTS: "PXP"
    },
    incomeRecognition: "claim",
    externalAccounts: {},
    vestingPerPxa: 1, // VESTS per PXA (shares/fund); used only for the placeholder warning now
    pixaPerVest: 1, // PXA per VEST (fund/shares); VESTS x this = PXP. 1 = early-chain / demo.
  };
}

// ---------------------------------------------------------------------------
// ASSET PARSING  (condenser_api returns legacy strings like "10.000 PXA")
// ---------------------------------------------------------------------------

function parseAsset(raw, cfg) {
  let amount, asset;
  if (typeof raw === "string" && raw.includes(" ")) {
    const [amountStr, symbol] = raw.trim().split(/\s+/);
    asset = cfg.symbolMap[symbol];
    amount = Number(amountStr);
  } else if (raw && typeof raw === "object") {
    const o = raw;
    if (typeof o.amount === "string" && o.amount.includes(" ")) {
      const [amountStr, symbol] = o.amount.trim().split(/\s+/);
      asset = cfg.symbolMap[symbol];
      amount = Number(amountStr);
    } else if (o.nai && o.amount != null && cfg.naiMap) {
      const sym = cfg.naiMap[String(o.nai)];
      if (!sym) return null;
      const prec = typeof o.precision === "number" ? o.precision : 0;
      asset = sym;
      amount = Number(o.amount) / 10 ** prec;
    }
  }
  if (!asset || amount == null || !isFinite(amount)) return null;
  // Vesting is stored on-chain in raw VESTS but is displayed and valued as PXP
  // (the PXA-equivalent): VESTS x ratio = PXP. Convert once, here, so the whole
  // pipeline works in PXP units. ratio defaults to 1 (the early-chain ~1:1 case).
  if (asset === "PXP") amount *= (cfg.pixaPerVest ?? 1);
  return { amount, asset };
}

/** All asset-valued fields of an op, as inbound legs (naming-agnostic). */
function inboundFromAllAssetFields(op, cfg) {
  const legs = [];
  for (const v of Object.values(op)) {
    const p = parseAsset(v, cfg);
    if (p && p.amount > 0) legs.push({
      asset: p.asset,
      amount: p.amount,
      direction: "in"
    });
  }
  return legs;
}

// ---------------------------------------------------------------------------
// OPERATION HANDLERS  (standard Hive vops -> canonical category + legs)
// ---------------------------------------------------------------------------

const incomeVop = category => (op, cfg) => {
  const legs = inboundFromAllAssetFields(op, cfg);
  return legs.length ? {
    category,
    legs
  } : null;
};
const HANDLERS = {
  // --- income (timing controlled by cfg.incomeRecognition, applied below) ---
  author_reward: incomeVop("reward_author"),
  curation_reward: incomeVop("reward_curation"),
  comment_benefactor_reward: incomeVop("reward_benefactor"),
  producer_reward: incomeVop("reward_author"),
  // witness reward -> income
  claim_reward_balance: incomeVop("reward_claim"),
  // generic income at claim
  interest: incomeVop("savings_interest"),
  // savings interest -> income

  // Treasury (DHF) proposal payout received by this account — ordinary income at
  // receipt (not claim-gated). Fields: { proposal_id, receiver, payment }.
  proposal_pay: (op, cfg) => {
    if (op.receiver && op.receiver !== cfg.account) return null; // only payouts to us
    const a = parseAsset(op.payment, cfg);
    return a && a.amount > 0 ? {
      category: "proposal_income",
      legs: [{ asset: a.asset, amount: a.amount, direction: "in" }]
    } : null;
  },

  // --- transfers ---
  transfer: (op, cfg) => {
    const a = parseAsset(op.amount, cfg);
    if (!a) return null;
    const out = op.from === cfg.account;
    const counterparty = out ? op.to : op.from;
    return {
      category: out ? "transfer_out" : "transfer_in",
      legs: [{
        asset: a.asset,
        amount: a.amount,
        direction: out ? "out" : "in"
      }],
      counterparty,
      counterpartyIsOwn: cfg.ownAccounts.includes(counterparty),
      memo: op.memo || undefined
    };
  },
  transfer_to_savings: (op, cfg) => {
    const a = parseAsset(op.amount, cfg);
    return a ? {
      category: "savings_deposit",
      legs: [{
        asset: a.asset,
        amount: a.amount,
        direction: "out"
      }]
    } : null;
  },
  transfer_from_savings: (op, cfg) => {
    const a = parseAsset(op.amount, cfg);
    return a ? {
      category: "savings_withdraw",
      legs: [{
        asset: a.asset,
        amount: a.amount,
        direction: "in"
      }]
    } : null;
  },
  // --- staking (power up / down) ---
  transfer_to_vesting: (op, cfg) => {
    const a = parseAsset(op.amount, cfg); // liquid PXA paid in
    if (!a) return null;
    return {
      category: "power_up",
      note: "power-up (PXA staked to PXP)",
      legs: [{
        asset: "PXA",
        amount: a.amount,
        direction: "out"
      }, {
        asset: "PXP",
        amount: a.amount,
        direction: "in"
      } // X PXA staked == X PXP (PXP is the PXA-equivalent value of the vesting)
      ]
    };
  },
  fill_vesting_withdraw: (op, cfg) => {
    const withdrawn = parseAsset(op.withdrawn, cfg); // PXP out
    const deposited = parseAsset(op.deposited, cfg); // PXA in
    if (!withdrawn || !deposited) return null;
    return {
      category: "power_down",
      note: "power-down (PXP unstaked to PXA)",
      legs: [{
        asset: withdrawn.asset,
        amount: withdrawn.amount,
        direction: "out"
      }, {
        asset: deposited.asset,
        amount: deposited.amount,
        direction: "in"
      }]
    };
  },
  // --- conversions & market ---
  fill_convert_request: (op, cfg) => {
    const inAsset = parseAsset(op.amount_in, cfg);
    const outAsset = parseAsset(op.amount_out, cfg);
    if (!inAsset || !outAsset) return null;
    return {
      category: "swap",
      legs: [{
        asset: inAsset.asset,
        amount: inAsset.amount,
        direction: "out"
      }, {
        asset: outAsset.asset,
        amount: outAsset.amount,
        direction: "in"
      }]
    };
  },
  fill_order: (op, cfg) => {
    const curPays = parseAsset(op.current_pays, cfg);
    const openPays = parseAsset(op.open_pays, cfg);
    if (!curPays || !openPays) return null;
    let out, inn;
    if (op.current_owner === cfg.account) {
      out = curPays;
      inn = openPays;
    } else if (op.open_owner === cfg.account) {
      out = openPays;
      inn = curPays;
    } else return null;
    return {
      category: "market_fill",
      legs: [{
        asset: out.asset,
        amount: out.amount,
        direction: "out"
      }, {
        asset: inn.asset,
        amount: inn.amount,
        direction: "in"
      }]
    };
  },

  // --- recurrent transfers ---
  // The scheduled-payment cousin of `transfer`. In HF25 the initiating
  // recurrent_transfer op only SCHEDULES the series; every actual payment
  // (including the first, whose trigger date is the creation block) is paid out
  // as a fill_recurrent_transfer virtual op. So we book the fills and leave the
  // setup op unclassified — booking both would double-count.
  fill_recurrent_transfer: (op, cfg) => {
    const a = parseAsset(op.amount, cfg);
    if (!a) return null;
    const out = op.from === cfg.account;
    const counterparty = out ? op.to : op.from;
    return {
      category: out ? "transfer_out" : "transfer_in",
      legs: [{
        asset: a.asset,
        amount: a.amount,
        direction: out ? "out" : "in"
      }],
      counterparty,
      counterpartyIsOwn: cfg.ownAccounts.includes(counterparty),
      memo: op.memo || undefined
    };
  },

  // collateralized conversion (PXA→PXS) settlement — the collateralized cousin
  // of fill_convert_request. The fill carries the finalised amounts: amount_in
  // PXA consumed → amount_out PXS produced. excess_collateral is the unused PXA
  // returned to the owner (unlocking own collateral, not a disposal), so it is
  // ignored. Booked here at settlement; the initiating collateralized_convert
  // request is left unclassified so it is not double-counted.
  fill_collateralized_convert_request: (op, cfg) => {
    const inAsset = parseAsset(op.amount_in, cfg);
    const outAsset = parseAsset(op.amount_out, cfg);
    if (!inAsset || !outAsset) return null;
    return {
      category: "swap",
      legs: [{
        asset: inAsset.asset,
        amount: inAsset.amount,
        direction: "out"
      }, {
        asset: outAsset.asset,
        amount: outAsset.amount,
        direction: "in"
      }]
    };
  },

  // --- itemized movements (not taxable disposals/income, but must be listed) ---

  // PXA fee paid to the treasury to submit a proposal. Leaves the account, so it
  // reduces holdings, but it is not a capital disposal (no gain line).
  proposal_fee: (op, cfg) => {
    if (op.creator && op.creator !== cfg.account) return null;
    const a = parseAsset(op.fee, cfg);
    return a ? {
      category: "fee_payment",
      note: "proposal fee",
      legs: [{ asset: a.asset, amount: a.amount, direction: "out" }]
    } : null;
  },

  // Completion of a savings withdrawal — funds credited to the liquid balance.
  // Internal (savings is already part of holdings); listed for completeness.
  fill_transfer_from_savings: (op, cfg) => {
    const to = op.to_account || op.to;
    if (to && to !== cfg.account) return null;
    const a = parseAsset(op.amount, cfg);
    return a ? {
      category: "savings_fill",
      note: "savings withdrawal completed",
      legs: [{ asset: a.asset, amount: a.amount, direction: "in" }]
    } : null;
  },

  // Note: transfer_to_vesting_completed is intentionally NOT handled. It is the
  // completion vop of a power-up that is already fully captured (both legs) at
  // transfer_to_vesting, so handling it would duplicate the PXA leg. It falls
  // through to the skipped tally as an informational, no-balance-impact event.

  // --- request / initiation ops (display-only; the matching fill does the real
  //     booking, so these never touch the cost-basis ledger) ---

  // Power-down request. The actual unstaking happens weekly at fill_vesting_withdraw;
  // this is the instruction. amount 0 means the power-down was cancelled.
  withdraw_vesting: (op, cfg) => {
    if (op.account && op.account !== cfg.account) return null;
    const a = parseAsset(op.vesting_shares, cfg);
    if (!a) return null;
    const cancelled = a.amount === 0;
    return {
      category: "request_powerdown",
      note: cancelled ? "power-down cancelled" : "power-down requested (unstakes over ~13 weeks)",
      legs: [{ asset: a.asset, amount: a.amount, direction: "out" }]
    };
  },

  // PXS→PXA conversion request. Settles ~3.5 days later at fill_convert_request.
  convert: (op, cfg) => {
    if (op.owner && op.owner !== cfg.account) return null;
    const a = parseAsset(op.amount, cfg);
    return a ? {
      category: "request_convert",
      note: "conversion requested (settles at fill)",
      legs: [{ asset: a.asset, amount: a.amount, direction: "out" }]
    } : null;
  },

  // Collateralized PXA→PXS conversion request (PXA collateral committed). PXS is
  // credited immediately (collateralized_convert_immediate_conversion); excess
  // collateral returns at fill_collateralized_convert_request, where we book the swap.
  collateralized_convert: (op, cfg) => {
    if (op.owner && op.owner !== cfg.account) return null;
    const a = parseAsset(op.amount, cfg);
    return a ? {
      category: "request_collateralized",
      note: "collateralized conversion requested",
      legs: [{ asset: a.asset, amount: a.amount, direction: "out" }]
    } : null;
  },

  // --- delegation (staked PXP lent to another account) ---
  // NOT a disposal anywhere we model: the delegator keeps ownership of the
  // vesting shares; only the influence/reward flow moves. No LotBook impact —
  // the PXP never leaves holdings. Listed as a movement so the report shows
  // where stake is committed. amount 0 = delegation removed (returns after the
  // chain's cooldown). If the delegatee is us, it is inbound stake we do NOT
  // own — never income, never basis.
  delegate_vesting_shares: (op, cfg) => {
    const a = parseAsset(op.vesting_shares, cfg);
    if (!a) return null;
    const isDelegator = op.delegator === cfg.account;
    const isDelegatee = op.delegatee === cfg.account;
    if (!isDelegator && !isDelegatee) return null;
    const removed = a.amount === 0;
    return {
      category: isDelegator ? "delegation_out" : "delegation_in",
      note: isDelegator
          ? (removed ? "delegation removed (stake returns after cooldown)" : "PXP delegated — still yours, not a disposal")
          : (removed ? "incoming delegation removed" : "PXP delegated to you — not yours, not income"),
      counterparty: isDelegator ? op.delegatee : op.delegator,
      counterpartyIsOwn: cfg.ownAccounts.includes(isDelegator ? op.delegatee : op.delegator),
      legs: [{ asset: a.asset, amount: a.amount, direction: isDelegator ? "out" : "in" }]
    };
  },

  // Expired-delegation return vop — the cooldown completing. Display only.
  return_vesting_delegation: (op, cfg) => {
    if (op.account && op.account !== cfg.account) return null;
    const a = parseAsset(op.vesting_shares, cfg);
    return a ? {
      category: "delegation_return",
      note: "delegated PXP returned (cooldown complete)",
      legs: [{ asset: a.asset, amount: a.amount, direction: "in" }]
    } : null;
  },

  // The immediate PXS leg of a collateralized convert (received up front). Shown
  // for visibility; the swap itself is booked at the settlement fill. The exact
  // field name varies, so scan every asset-bearing field rather than guessing.
  collateralized_convert_immediate_conversion: (op, cfg) => {
    if (op.owner && op.owner !== cfg.account) return null;
    const legs = inboundFromAllAssetFields(op, cfg);
    return legs.length ? {
      category: "immediate_conversion",
      note: "collateralized convert — immediate PXS received",
      legs
    } : null;
  }
};

// Reward vops are accrual-only when recognising at claim; vice-versa for accrual.
const ACCRUAL_VOPS = new Set(["author_reward", "curation_reward", "comment_benefactor_reward", "producer_reward"]);

// ---------------------------------------------------------------------------
// NORMALISER
// ---------------------------------------------------------------------------

/** One raw account-history entry: `[seq, { trx_id, op_in_trx, timestamp, op:[name,data] }]`. */

export function accountHistoryToTaxEvents(history, cfg) {
  const events = [];
  const warnings = [];
  const skipped = {};
  const byRealm = {};
  let sawPowerUp = false;
  for (const [seq, entry] of history) {
    const [name, data] = entry.op;

    // income timing: drop the side we are NOT recognising on
    if (cfg.incomeRecognition === "claim" && ACCRUAL_VOPS.has(name)) {
      bump(skipped, name);
      continue;
    }
    if (cfg.incomeRecognition === "accrual" && name === "claim_reward_balance") {
      bump(skipped, name);
      continue;
    }
    const handler = HANDLERS[name];
    if (!handler) {
      bump(skipped, name);
      continue;
    }
    const partial = handler(data, cfg);
    if (!partial) {
      bump(skipped, `${name}:unparsed`);
      continue;
    }
    if (name === "transfer_to_vesting") sawPowerUp = true;

    // ---- realm / boundary classification ----
    const ext = partial.counterparty ? cfg.externalAccounts[partial.counterparty] : undefined;
    const realm = ext ? ext.kind : "intra_pixa";
    const selfTransfer = partial.counterpartyIsOwn === true || ext?.own === true;
    bump(byRealm, realm);
    const ts = entry.timestamp.endsWith("Z") ? entry.timestamp : entry.timestamp + "Z";
    events.push({
      id: entry.trx_id ? `${entry.trx_id}#${entry.op_in_trx ?? 0}` : `seq-${seq}`,
      block: entry.block ?? entry.block_num ?? null,
      ts,
      account: cfg.account,
      wallet: cfg.account,
      // per-account chain: wallet == account
      ...partial,
      realm,
      crossesBoundary: realm !== "intra_pixa",
      selfTransfer,
      reportable: realm !== "intra_pixa"
    });
  }
  if (sawPowerUp && (cfg.pixaPerVest == null || cfg.pixaPerVest === 1) && !cfg.vestingRateReliable) {
    warnings.push("Vesting ratio is the placeholder 1 (VESTS treated 1:1 with PXP). If the chain's vesting fund has drifted from parity, set the real rate so PXP amounts and values are correct — or read PXP holdings from the account's year-end vesting balance.");
  }
  if (!cfg.naiMap) {
    warnings.push("No naiMap set — any {amount,precision,nai} asset objects (non-condenser APIs) are skipped. Use condenser_api/get_account_history (legacy strings) or add naiMap.");
  }
  if (skipped.recurrent_transfer) {
    warnings.push(`recurrent_transfer set-up ops (×${skipped.recurrent_transfer}) carry no fund movement on their own — each scheduled payment is booked at its fill_recurrent_transfer execution, so totals are not double-counted.`);
  }
  if (skipped.collateralized_convert) {
    warnings.push(`collateralized_convert requests (×${skipped.collateralized_convert}) are recognised at settlement: each fill_collateralized_convert_request is booked as a PXA→PXS swap (amount_in→amount_out). Any request still inside the conversion window has no fill yet and stays pending until it settles in a later operation.`);
  }
  events.sort((a, b) => a.ts.localeCompare(b.ts));
  return {
    events,
    warnings,
    skipped,
    byRealm
  };
}
function bump(m, k) {
  m[k] = (m[k] ?? 0) + 1;
}

// ---------------------------------------------------------------------------
// LIVE FETCH (thin, assumed-API layer — adjust to dpixa's actual client)
// ---------------------------------------------------------------------------

/**
 * Pulls + normalises a full account history. Uses the condenser_api call any
 * dhive-derived client exposes via `client.call(...)`. If dpixa ships a typed
 * `client.database.getAccountHistory(account, from, limit)`, swap it in.
 */
// Pull the chain's dynamic global properties, tolerant of client shape
// (dpixa/dhive `.globals` or `.database`, or the raw condenser_api call).
async function getDynamicGlobalProps(client) {
  const g = client?.globals?.getDynamicGlobalProperties;
  if (g) return g.call(client.globals);
  const d = client?.database?.getDynamicGlobalProperties;
  if (d) return d.call(client.database);
  return client.call("condenser_api", "get_dynamic_global_properties", []);
}

/**
 * Current vest<->pixa conversion from the vesting fund. `pixaPerVest` is the
 * vesting SHARE PRICE: VESTS x pixaPerVest = PXP (the PXA-equivalent). Returns the
 * ratio plus both converters; mirrors api.formatter.vestToPixa / getVestingSharePrice.
 */
export async function fetchVestingRate(client) {
  const g = await getDynamicGlobalProps(client);
  const num = (v) => typeof v === "string" ? Number(v.split(/\s+/)[0]) || 0
      : (v && typeof v === "object" && v.amount != null ? Number(v.amount) / 10 ** (v.precision || 0) : Number(v) || 0);
  const totalVestingShares = g.total_vesting_shares;
  const totalVestingFundPixa = g.total_vesting_fund_pixa || g.total_vesting_fund_steem
      || g.total_vesting_fund_hive || g.total_vesting_fund;
  const totalV = num(totalVestingShares), totalF = num(totalVestingFundPixa);
  const fmt = client?.formatter?.vestToPixa;
  let pixaPerVest = totalV > 0 ? totalF / totalV : 1;
  // Prefer the chain's own formatter when available, so we match the wallet exactly.
  if (fmt && totalV > 0) {
    const px = parseFloat(fmt(1e6, totalVestingShares, totalVestingFundPixa));
    if (Number.isFinite(px) && px > 0) pixaPerVest = px / 1e6;
  }
  const vestToPixa = (vests) => {
    const v = parseFloat(vests) || 0;
    return v === 0 ? 0 : (fmt ? parseFloat(fmt(v, totalVestingShares, totalVestingFundPixa)) : v * pixaPerVest);
  };
  const pixaToVest = (pixa) => {
    const p = parseFloat(pixa) || 0;
    return p === 0 ? 0 : (p / (totalF || 1)) * (totalV || 1);
  };
  return { pixaPerVest, vestToPixa, pixaToVest };
}

export async function fetchTaxEvents(client, cfg, pageSize = 1000) {
  // Live vest->pixa ratio so VESTS convert to PXP correctly instead of the 1:1
  // placeholder. Silent fallback keeps offline/demo use working.
  try {
    const { pixaPerVest } = await fetchVestingRate(client);
    if (pixaPerVest > 0) {
      cfg.pixaPerVest = pixaPerVest;
      cfg.vestingPerPxa = 1 / pixaPerVest;
      cfg.vestingRateReliable = true;
    }
  } catch (e) { /* keep cfg's placeholder ratio */ }
  const all = [];
  let from = -1; // -1 = most recent
  // Walk backwards in pages until we reach the start of history (seq 0).
  // (Guarded loop; production code should add retry/backoff.)
  for (let guard = 0; guard < 10_000; guard++) {
    const page = await client.call("condenser_api", "get_account_history", [cfg.account, from, Math.min(pageSize, from === -1 ? pageSize : from)]);
    if (!page.length) break;
    all.push(...page);
    const lowest = page[0][0];
    if (lowest <= 0) break;
    from = lowest - 1;
  }
  return accountHistoryToTaxEvents(all, cfg);
}

// ---------------------------------------------------------------------------
// DEMO  (synthetic Hive-style history — proves the mapping with no live RPC)
// ---------------------------------------------------------------------------

function demoHistory(account) {
  const mk = (seq, ts, name, data, vop = false) => [seq, {
    trx_id: vop ? "0".repeat(40) : `tx${seq}`,
    op_in_trx: 0,
    virtual_op: vop ? 1 : 0,
    timestamp: ts,
    op: [name, data]
  }];
  return [mk(0, "2025-02-14T08:30:00", "author_reward", {
    author: account,
    permlink: "my-pixel-art",
    hive_payout: "120.000 PXA",
    vesting_payout: "40.000 VESTS",
    hbd_payout: "0.000 PXS"
  }, true), mk(1, "2025-02-15T00:00:00", "claim_reward_balance", {
    account,
    reward_hive: "120.000 PXA",
    reward_vests: "40.000 VESTS",
    reward_hbd: "0.000 PXS"
  }), mk(2, "2025-04-01T09:15:00", "transfer_to_vesting", {
    from: account,
    to: account,
    amount: "1000.000 PXA"
  }), mk(3, "2025-06-10T14:45:00", "fill_convert_request", {
    owner: account,
    requestid: 1,
    amount_in: "12.000 PXS",
    amount_out: "800.000 PXA"
  }, true), mk(4, "2025-07-22T11:00:00", "interest", {
    owner: account,
    interest: "6.000 PXA"
  }, true), mk(5, "2025-09-05T16:20:00", "transfer", {
    from: account,
    to: "contractor",
    amount: "300.000 PXA",
    memo: "design work"
  }), mk(6, "2025-10-18T18:00:00", "transfer", {
    from: account,
    to: "my-cold",
    amount: "500.000 PXA",
    memo: "to cold wallet"
  }), mk(7, "2025-11-02T10:00:00", "fill_order", {
    current_owner: account,
    current_pays: "5.000 PXA",
    open_owner: "trader",
    open_pays: "0.250 PXS"
  }, true),
    // --- boundary-crossing transfers ---
    mk(8, "2025-11-20T09:00:00", "transfer", {
      from: account,
      to: "bittrex",
      amount: "400.000 PXA",
      memo: "deposit to my exchange"
    }), mk(9, "2025-12-01T12:00:00", "transfer", {
      from: account,
      to: "pixa-bridge",
      amount: "50.000 PXA",
      memo: "bridge to Ethereum"
    }), mk(10, "2025-12-10T15:00:00", "transfer", {
      from: account,
      to: "moonpay-gw",
      amount: "200.000 PXA",
      memo: "cash out to CHF"
    })];
}
function main() {
  const account = "primerz";
  const cfg = defaultConfig(account);
  cfg.ownAccounts = ["primerz", "my-cold"]; // cold wallet is my own Pixa account (intra)
  cfg.externalAccounts = {
    "bittrex": {
      kind: "exchange",
      label: "Bittrex",
      own: true
    },
    // my own exchange deposit account
    "pixa-bridge": {
      kind: "bridge",
      label: "Pixa-ETH bridge"
    },
    "moonpay-gw": {
      kind: "fiat",
      label: "MoonPay off-ramp"
    }
  };
  const {
    events,
    warnings,
    skipped,
    byRealm
  } = accountHistoryToTaxEvents(demoHistory(account), cfg);
  console.log(`\nNormalised ${events.length} TaxEvents (recognition: ${cfg.incomeRecognition}):\n`);
  for (const e of events) {
    const legs = e.legs.map(l => `${l.direction === "in" ? "+" : "-"}${l.amount} ${l.asset}`).join(", ");
    const cp = e.counterpartyIsOwn ? " [own]" : e.counterparty ? ` ->${e.counterparty}` : "";
    const tag = e.crossesBoundary ? `  «${e.realm}${e.selfTransfer ? ", self" : ""}${e.reportable ? ", reportable" : ""}»` : "";
    console.log(`  ${e.ts.slice(0, 10)}  ${e.category.padEnd(16)} ${legs.padEnd(22)}${cp}${tag}`);
  }
  console.log(`\nBy realm:`, byRealm);
  console.log(`Skipped ops:`, skipped);
  if (warnings.length) {
    console.log(`\nWarnings:`);
    warnings.forEach(w => console.log(`  - ${w}`));
  }
  console.log(`\n-> intra_pixa stays internal; exchange / bridge / fiat cross the boundary (flagged reportable).`);
}

// Demo runner — Node only; guarded so importing this module into the app or a
// bundler never executes it.
if (typeof process !== "undefined" && process.argv && process.argv[1] && process.argv[1].includes("pixa-tax-ingest")) {
  main();
}