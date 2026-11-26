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
 *
 * TEXT: event notes and warnings are translation descriptors { $t: key, v }
 * (the shape utils/text.js tk() builds), resolved where they are shown — this
 * file imports nothing so it still runs stand-alone in Node.
 *
 * ACCURACY AUDIT (25 Nov 2026) — an op is booked only for the account it pays
 * or debits:
 *  - author_reward no longer books `curators_vesting_payout` (the curators'
 *    share) as the author's income; reward, interest and conversion ops are
 *    booked by their payee only.
 *  - Power-ups to or from another account, power-downs routed to another
 *    account and savings transfers to or from another account are sends and
 *    receipts, not internal moves.
 *  - Witness block rewards are booked under claim timing too (they are never
 *    claimed); account-creation fees leave holdings.
 *  - fetchTaxEvents pages correctly on both node families, without duplicates,
 *    oldest first.
 * ===========================================================================*/

/** Deferred translation — same shape as utils/text.js tk(), resolved by the caller. */
function tk(key, vars) {
  return vars ? { $t: key, v: vars } : { $t: key };
}

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

/**
 * All asset-valued fields of an op, as inbound legs (naming-agnostic) — except
 * fields that report what OTHER accounts were paid. author_reward carries
 * `curators_vesting_payout`, the curators' share of the same post (on Hive,
 * and on Pixa per the Pixagram 1.30.1 release notes), which was booked as the
 * author's own income whenever rewards are recognised at payout (CH and DE
 * before this audit; FR as well now): with a 40% curation share that
 * overstated an author's income by about two thirds, and their year-end
 * holdings with it.
 */
const PAID_TO_OTHERS = /^curators?_/i;
function inboundFromAllAssetFields(op, cfg) {
  const legs = [];
  for (const [k, v] of Object.entries(op)) {
    if (PAID_TO_OTHERS.test(k)) continue;
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

// A handler returns an event, null (the op could not be parsed), or
// { skip: reason } — a parsed op that is not this account's to book. The
// normaliser tallies the reason beside the op name.
const OTHER_ACCOUNT = { skip: "other_account" };

// `payee` names the field holding the account that was paid. A node writes an
// op to the history of the accounts it considers affected, which can be more
// than the payee: a beneficiary's cut (comment_benefactor_reward) names the
// author as well. Only the payee books it. Without the check, wherever such an
// op reaches the author's history, the front end's cut on each post would
// count as the author's own income under payout timing. (Which histories a
// Pixa node writes it to is worth confirming on one real response.)
const incomeVop = (category, payee) => (op, cfg) => {
  if (payee && op[payee] != null && op[payee] !== cfg.account) return OTHER_ACCOUNT;
  const legs = inboundFromAllAssetFields(op, cfg);
  return legs.length ? {
    category,
    legs
  } : null;
};

// Account-creation fee paid by this account (burned). It leaves holdings but
// is not a capital disposal. claim_account's fee is 0 when resource credits pay.
const accountFee = (op, cfg) => {
  if (op.creator && op.creator !== cfg.account) return OTHER_ACCOUNT;
  const a = parseAsset(op.fee, cfg);
  return a && a.amount > 0 ? {
    category: "fee_payment",
    note: tk("components.pixa_tax_ingest.account_creation_fee"),
    legs: [{ asset: a.asset, amount: a.amount, direction: "out" }]
  } : { skip: "no_fee" };
};

// A plain send or receipt between this account and another one.
const sendTo = (cfg, counterparty, leg, memo) => ({
  category: "transfer_out",
  legs: [{ asset: leg.asset, amount: leg.amount, direction: "out" }],
  counterparty,
  counterpartyIsOwn: cfg.ownAccounts.includes(counterparty),
  memo: memo || undefined
});
const receiveFrom = (cfg, counterparty, leg, memo) => ({
  category: "transfer_in",
  legs: [{ asset: leg.asset, amount: leg.amount, direction: "in" }],
  counterparty,
  counterpartyIsOwn: cfg.ownAccounts.includes(counterparty),
  memo: memo || undefined
});

const HANDLERS = {
  // --- income (timing controlled by cfg.incomeRecognition, applied below) ---
  author_reward: incomeVop("reward_author", "author"),
  curation_reward: incomeVop("reward_curation", "curator"),
  comment_benefactor_reward: incomeVop("reward_benefactor", "benefactor"),
  producer_reward: incomeVop("reward_author", "producer"),
  // witness reward -> income
  claim_reward_balance: incomeVop("reward_claim", "account"),
  // generic income at claim
  interest: incomeVop("savings_interest", "owner"),
  // savings interest -> income

  account_create: accountFee,
  account_create_with_delegation: accountFee,
  claim_account: accountFee,

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
  // Savings ops name a sender and a recipient, like transfers. Only from == to
  // is a move inside the account; a deposit into SOMEONE ELSE's savings is a
  // send, and one received from another account is a receipt. Both used to be
  // treated as internal, so the tokens never left (or never entered) the ledger.
  transfer_to_savings: (op, cfg) => {
    const a = parseAsset(op.amount, cfg);
    if (!a) return null;
    const from = op.from, to = op.to || op.from;
    if (from !== cfg.account && to !== cfg.account) return OTHER_ACCOUNT;
    if (from === cfg.account && to !== cfg.account) return sendTo(cfg, to, a, op.memo);
    if (to === cfg.account && from !== cfg.account) return receiveFrom(cfg, from, a, op.memo);
    return {
      category: "savings_deposit",
      legs: [{
        asset: a.asset,
        amount: a.amount,
        direction: "out"
      }]
    };
  },
  // The withdrawal REQUEST: internal and never booked by the engine. When it
  // names another recipient, the transfer is booked at its fill (three days
  // later, when the funds actually move) — see fill_transfer_from_savings.
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
  // transfer_to_vesting names a payer and a recipient. Only from == to is the
  // account staking its own PIXA: powering up ANOTHER account is a send of
  // PIXA, and being powered up by another account is a receipt of PXP. Both
  // used to be booked as the account's own power-up (PIXA out, PXP in).
  transfer_to_vesting: (op, cfg) => {
    const a = parseAsset(op.amount, cfg); // liquid PXA paid in
    if (!a) return null;
    const from = op.from, to = op.to || op.from; // an empty `to` means the sender
    if (from !== cfg.account && to !== cfg.account) return OTHER_ACCOUNT;
    if (from === cfg.account && to !== cfg.account) return sendTo(cfg, to, a);
    if (to === cfg.account && from !== cfg.account) return receiveFrom(cfg, from, { asset: "PXP", amount: a.amount });
    return {
      category: "power_up",
      note: tk("components.pixa_tax_ingest.power_up_pxa_staked_to_pxp"),
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
  // A withdraw route (set_withdraw_vesting_route) can pay the unstaked PIXA to
  // another account, or stake it there again: the fill then names two
  // accounts and is a transfer, not the account's own power-down.
  fill_vesting_withdraw: (op, cfg) => {
    const withdrawn = parseAsset(op.withdrawn, cfg); // PXP out
    const deposited = parseAsset(op.deposited, cfg); // PXA in (PXP when the route re-stakes)
    if (!withdrawn || !deposited) return null;
    const from = op.from_account || cfg.account, to = op.to_account || from;
    if (from !== cfg.account && to !== cfg.account) return OTHER_ACCOUNT;
    if (from === cfg.account && to !== cfg.account) return sendTo(cfg, to, withdrawn);
    if (to === cfg.account && from !== cfg.account) return receiveFrom(cfg, from, deposited);
    return {
      category: "power_down",
      note: tk("components.pixa_tax_ingest.power_down_pxp_unstaked_to_pxa"),
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
    if (op.owner && op.owner !== cfg.account) return OTHER_ACCOUNT;
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
    if (op.owner && op.owner !== cfg.account) return OTHER_ACCOUNT;
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
      note: tk("components.pixa_tax_ingest.proposal_fee"),
      legs: [{ asset: a.asset, amount: a.amount, direction: "out" }]
    } : null;
  },

  // Completion of a savings withdrawal — funds credited to the liquid balance.
  // Internal (savings is already part of holdings) and listed for completeness,
  // unless the withdrawal was addressed to another account: then this is the
  // moment the funds change hands, and it is booked as a send or a receipt.
  fill_transfer_from_savings: (op, cfg) => {
    const a = parseAsset(op.amount, cfg);
    if (!a) return null;
    const from = op.from_account || op.from || cfg.account, to = op.to_account || op.to || from;
    if (from !== cfg.account && to !== cfg.account) return OTHER_ACCOUNT;
    if (from === cfg.account && to !== cfg.account) return sendTo(cfg, to, a, op.memo);
    if (to === cfg.account && from !== cfg.account) return receiveFrom(cfg, from, a, op.memo);
    return {
      category: "savings_fill",
      note: tk("components.pixa_tax_ingest.savings_withdrawal_completed"),
      legs: [{ asset: a.asset, amount: a.amount, direction: "in" }]
    };
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
      note: cancelled ? tk("components.pixa_tax_ingest.power_down_cancelled") : tk("components.pixa_tax_ingest.power_down_requested_unstakes_over_13_weeks"),
      legs: [{ asset: a.asset, amount: a.amount, direction: "out" }]
    };
  },

  // PXS→PXA conversion request. Settles ~3.5 days later at fill_convert_request.
  convert: (op, cfg) => {
    if (op.owner && op.owner !== cfg.account) return null;
    const a = parseAsset(op.amount, cfg);
    return a ? {
      category: "request_convert",
      note: tk("components.pixa_tax_ingest.conversion_requested_settles_at_fill"),
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
      note: tk("components.pixa_tax_ingest.collateralized_conversion_requested"),
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
          ? (removed ? tk("components.pixa_tax_ingest.delegation_removed_stake_returns_after") : tk("components.pixa_tax_ingest.pxp_delegated_still_yours_not_a_disposal"))
          : (removed ? tk("components.pixa_tax_ingest.incoming_delegation_removed") : tk("components.pixa_tax_ingest.pxp_delegated_to_you_not_yours_not_income")),
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
      note: tk("components.pixa_tax_ingest.delegated_pxp_returned_cooldown_complete"),
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
      note: tk("components.pixa_tax_ingest.collateralized_convert_immediate_pxs"),
      legs
    } : null;
  }
};

// Reward vops are accrual-only when recognising at claim; vice-versa for accrual.
// producer_reward is NOT one of them: a witness's block reward is paid straight
// into its stake, never into the reward balance, so no claim ever follows it.
// Listed here, it was dropped under claim timing and the income vanished.
const ACCRUAL_VOPS = new Set(["author_reward", "curation_reward", "comment_benefactor_reward"]);

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
    if (!partial || partial.skip) {
      bump(skipped, `${name}:${(partial && partial.skip) || "unparsed"}`);
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
    warnings.push(tk("components.pixa_tax_ingest.vesting_ratio_is_the_placeholder_1"));
  }
  if (!cfg.naiMap) {
    warnings.push(tk("components.pixa_tax_ingest.no_naimap_set_nai_asset_objects_are_skipped"));
  }
  if (skipped.recurrent_transfer) {
    warnings.push(tk("components.pixa_tax_ingest.recurrent_transfer_set_up_ops", { count: skipped.recurrent_transfer }));
  }
  if (skipped.collateralized_convert) {
    warnings.push(tk("components.pixa_tax_ingest.collateralized_convert_requests_at_settlement", { count: skipped.collateralized_convert }));
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
  const bySeq = new Map();
  let from = -1; // -1 = most recent
  // Walk backwards in pages until we reach the start of history (seq 0).
  // (Guarded loop; production code should add retry/backoff.)
  //
  // The window may not reach below sequence 0, and the two node families count
  // it differently: Hive-era nodes return `limit` entries and require
  // start >= limit - 1; Steem-era nodes return limit + 1 and require
  // start >= limit. The old `limit = from` asked a Hive-era node for one entry
  // too few, then for `limit = 0` on the next page, which that node rejects —
  // the whole fetch threw on its last page for any account with more than one
  // page of history. Ask for from + 1 first and fall back to `from`.
  for (let guard = 0; guard < 10_000; guard++) {
    const want = from === -1 ? pageSize : Math.min(pageSize, from + 1);
    let page;
    try {
      page = await client.call("condenser_api", "get_account_history", [cfg.account, from, want]);
    } catch (e) {
      if (from < 0 || want !== from + 1) throw e;
      page = await client.call("condenser_api", "get_account_history", [cfg.account, from, from]);
    }
    if (!page || !page.length) break;
    for (const entry of page) bySeq.set(entry[0], entry);
    const lowest = page.reduce((m, entry) => Math.min(m, entry[0]), Infinity);
    if (!(lowest > 0)) break;
    from = lowest - 1;
  }
  // Oldest first, each sequence once: pages arrive newest-first, and operations
  // that share a timestamp must keep their on-chain order.
  const all = [...bySeq.values()].sort((a, b) => a[0] - b[0]);
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
// Demo only (Node): warnings in English from locales/en.js (see the engine's
// demo); a key not yet in en.js prints as itself.
async function demoCatalogue() {
  try {
    const { pathToFileURL } = process.getBuiltinModule("url");
    const href = new URL("../../locales/en.js", pathToFileURL(process.argv[1])).href;
    return (await import(/* webpackIgnore: true */ href)).default;
  } catch (e) {
    return null;
  }
}
function demoText(cat, x) {
  if (!x || typeof x !== "object" || typeof x.$t !== "string") return String(x ?? "");
  const s = cat ? x.$t.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), cat) : undefined;
  if (typeof s !== "string") return x.$t;
  return s.replace(/\{\{(\w+)\}\}/g, (m, k) => (x.v && k in x.v ? String(x.v[k]) : m));
}
async function main() {
  const cat = await demoCatalogue();
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
    warnings.forEach(w => console.log(`  - ${demoText(cat, w)}`));
  }
  console.log(`\n-> intra_pixa stays internal; exchange / bridge / fiat cross the boundary (flagged reportable).`);
}

// Demo runner — Node only; guarded so importing this module into the app or a
// bundler never executes it.
if (typeof process !== "undefined" && process.argv && process.argv[1] && process.argv[1].includes("pixa-tax-ingest")) {
  main();
}